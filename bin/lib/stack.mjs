// The stack's tools as data, plus read-only, injectable probes for their states: installed (+ version),
// configured (per host, per project), and outdated (`upToDate`, which a tool's `upToDateFix` sets from the latest version).
// The Codex row (`codex`, the Codex CLI itself) has `claude` `n/a` (Claude Code has no Codex side any more) and `codex`
// "the Codex CLI is logged in". `checks` holds what doctor reports that is not a tool: the memory-rules,
// session-classes, claude-account, remote-server, codex-trust, codex-daemon, hook-commands and pnpm-lock checks, each
// with its state cell and fix.
// Every probe takes the same `deps` bag (`home`, `project`, `spawn`, `platform`) so tests can
// fixture a temp home and a fake spawn instead of touching the real one or the network.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { realCodexHome } from './codex-review-home.mjs';
import { resolveStackPm, shownWord } from './package-manager.mjs';
import { readManifest } from './manifest.mjs';
import { entryPlaces, snakeEvent, trustedPlaces } from './codex-trust.mjs';
import { CODEX_DAEMON_FIX, codexDaemonState } from './codex-daemon.mjs';
import { takeSnapshot } from './process-tree.mjs';
import { isLoginLauncher, launcherStart, locate, lookUpProcesses, readState, remoteFiles, remoteId, remoteStartCommand } from './remote.mjs';
import { INSTALL_NEWEST, compareSemver } from './version.mjs';
import { MEMORY_RULES_FIX, memoryRulesState } from './memory-rules.mjs';
import { SESSION_CLASSES_FIX, sessionClassesState } from './session-classes.mjs';
import { PNPM_LOCK_FIX, pnpmLockState } from './pnpm-lock.mjs';
import { desktopDir } from './backup.mjs';

const SEMVER_RE = /(\d+\.\d+\.\d+)/;
// R3-001 (accepted T1 review follow-up): a hung probe must never block `doctor` — kill it and
// report `unknown`, the same as any other unreadable result, rather than leaving it to hang.
const PROBE_TIMEOUT_MS = 5000;

/** Spawns one probe, bounded by `PROBE_TIMEOUT_MS`, and returns the raw result, or `null` when the
 * spawn throws or yields nothing. `shell` is needed on win32 because npm-installed global binaries
 * are `.cmd` shims (see how `upgradeMain` in update.mjs spawns `js-harness` itself for the same
 * reason). Through a shell the command goes as one line with no args array: Node 24 warns (DEP0190)
 * on stderr otherwise, and the probe args are fixed literals. `env`, when given, is merged over
 * `process.env`; without it the child inherits the environment untouched. */
function spawnProbe(command, args, deps) {
  try {
    return spawnProbeOrThrow(command, args, deps) ?? null;
  } catch {
    return null;
  }
}

/** `spawnProbe` without the catch: a throw from `spawn` reaches the caller. `input`, when given, is the child's standard
 * input. The hook commands check needs both: its empty input, and a runner that throws read as `unknown`, not as missing. */
function spawnProbeOrThrow(command, args, { spawn = spawnSync, platform = process.platform, env, input } = {}) {
  const shell = platform === 'win32';
  const [file, argv] = shell ? [[command, ...args].join(' '), []] : [command, args];
  const options = { encoding: 'utf8', shell, timeout: PROBE_TIMEOUT_MS };
  if (env) options.env = { ...process.env, ...env };
  if (input !== undefined) options.input = input;
  return spawn(file, argv, options);
}

/** Node kills a timed-out spawnSync child with a signal (status becomes null); it may also carry
 * an ETIMEDOUT error instead, depending on where the timeout was detected. Either shape means the
 * tool could not be reached in time, not that it is missing. */
function probeTimedOut(result) {
  return Boolean(result.signal || result.error?.code === 'ETIMEDOUT');
}

/** Runs `<command> <args>` and extracts the first semver from stdout. Never throws: a missing
 * binary (ENOENT, or any non-zero exit) is `missing`; output with no parseable version, or a probe
 * that had to be killed after `PROBE_TIMEOUT_MS`, is `unknown`. */
export function probeVersionCommand(command, args, deps) {
  const result = spawnProbe(command, args, deps);
  if (!result) return { state: 'missing', version: null };
  if (probeTimedOut(result)) return { state: 'unknown', version: null };
  if (result.error || result.status !== 0) return { state: 'missing', version: null };
  const match = SEMVER_RE.exec(result.stdout ?? '');
  return match ? { state: 'ok', version: match[1] } : { state: 'unknown', version: null };
}

/** Reads and parses a JSON file. `found: false` marks a missing file; `data: undefined` marks one
 * that exists but does not parse. Callers fold the two into `missing` vs `unknown` themselves,
 * since which one applies depends on what the key's absence means for that tool. */
function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return { found: false, data: null };
  try {
    return { found: true, data: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  } catch {
    return { found: true, data: undefined };
  }
}

/** Minimal read-only presence check for a `[mcp_servers.<name>]` TOML section header in the `config.toml` of the Codex
 * home `codexHome` (`codexHomeOf`): no TOML library, since T1 only ever needs to know the section exists, never its
 * contents. */
function hasCodexMcpServer(codexHome, name) {
  const filePath = path.join(codexHome, 'config.toml');
  if (!fs.existsSync(filePath)) return false;
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return false;
  }
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\[mcp_servers\\.${escaped}\\]\\s*$`, 'm').test(text);
}

/** `<home>/.claude.json` `mcpServers.<name>`: `missing` file, `unknown` malformed JSON, else
 * `ok`/`missing` on the key plus the raw entry (context7 needs its shape, not just presence).
 * R3-004 (accepted T1 review follow-up): Claude Code can also register an MCP server scoped to one
 * project, under `projects[<project root>].mcpServers`, instead of (or as well as) globally — so a
 * project-scoped registration for the resolved project root counts as configured too. */
export function claudeJsonMcpServer(home, name, projectRoot) {
  const { found, data } = readJsonFile(path.join(home, '.claude.json'));
  if (!found) return { state: 'missing', entry: undefined };
  if (data === undefined) return { state: 'unknown', entry: undefined };
  const globalEntry = data?.mcpServers?.[name];
  const projectEntry = projectRoot ? data?.projects?.[projectRoot]?.mcpServers?.[name] : undefined;
  const entry = globalEntry ?? projectEntry;
  return { state: entry ? 'ok' : 'missing', entry };
}

/** Whether Claude Code turns context7 off for the project `project`: `/mcp` writes `projects[<root>].disabledMcpServers`
 * into `<home>/.claude.json` (odd/tasks/f8-s11-complements.md, L5), keyed with forward slashes on Windows. `missing`
 * where it lists context7, `unknown` for malformed JSON, else `ok`. */
function context7ProjectState(home, project) {
  const { found, data } = readJsonFile(path.join(home, '.claude.json'));
  if (!found) return 'ok';
  if (data === undefined) return 'unknown';
  const entry = data?.projects?.[project] ?? data?.projects?.[project.replaceAll('\\', '/')];
  return Array.isArray(entry?.disabledMcpServers) && entry.disabledMcpServers.includes('context7') ? 'missing' : 'ok';
}

/** `<home>/.claude/settings.json` `enabledPlugins["<id>"]`. */
function claudeEnabledPlugin(home, pluginId) {
  const { found, data } = readJsonFile(path.join(home, '.claude', 'settings.json'));
  if (!found) return 'missing';
  if (data === undefined) return 'unknown';
  return data?.enabledPlugins?.[pluginId] === true ? 'ok' : 'missing';
}

/** context7 has no CLI: its installed version comes from how Claude Code has it registered. A
 * hosted entry (`type: "http"` with a `url`) has no version of its own; a self-run one pins
 * `@upstash/context7-mcp@X` in its npx args. Registered only in Codex (whose config we only ever
 * presence-check, never parse) is `unknown`, not `missing` — it is installed, just unreadable. */
function context7InstalledVersion(deps) {
  const { state, entry } = claudeJsonMcpServer(deps.home, 'context7');
  if (state === 'unknown') return { state: 'unknown', version: null };
  if (state === 'missing') {
    return hasCodexMcpServer(codexHomeOf(deps), 'context7')
      ? { state: 'unknown', version: null }
      : { state: 'missing', version: null };
  }
  if (entry?.type === 'http' && entry?.url) return { state: 'ok', version: 'hosted' };
  const joinedArgs = Array.isArray(entry?.args) ? entry.args.map(String).join(' ') : '';
  const match = /@upstash\/context7-mcp@([\w.-]+)/.exec(joinedArgs);
  return match ? { state: 'ok', version: match[1] } : { state: 'unknown', version: null };
}

/** A Claude Code plugin has no CLI to ask: its version comes from the plugin marketplace's own
 * record of what it installed (`installed_plugins.json`), since that is the only place the version
 * is written down. Used by typescript-lsp, with its `<name>@<marketplace>` id. */
function pluginInstalledVersion(home, pluginId) {
  const { found, data } = readJsonFile(path.join(home, '.claude', 'plugins', 'installed_plugins.json'));
  if (!found) return { state: 'missing', version: null };
  if (data === undefined) return { state: 'unknown', version: null };
  const entries = data?.plugins?.[pluginId];
  const version = Array.isArray(entries) ? entries[0]?.version : undefined;
  return version ? { state: 'ok', version } : { state: 'missing', version: null };
}

/** Two paths are the same directory once resolved; win32 paths compare case-insensitively. */
function sameDirectory(a, b, platform) {
  const [x, y] = [path.resolve(a), path.resolve(b)];
  return platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
}

/** The `CODEX_HOME` the user set, when `home` is the real home (`homedir`) and it is set and not empty (its name in any
 * case on win32, as `realCodexHome` reads it), else `null`: a fixture home never reads the real one. */
function usersCodexHome({ home, env = process.env, homedir = os.homedir(), platform = process.platform }) {
  if (!sameDirectory(home, homedir, platform)) return null;
  const own = realCodexHome(env, home, platform);
  return own === path.join(home, '.codex') ? null : own;
}

/** The Codex home of `home`, where Codex reads and writes its MCP servers: the `CODEX_HOME` the user set when `home`
 * is the real home, else `<home>/.codex`, the path when it is unset or empty (stack-install T8). `doctor`'s probes,
 * `stack install` and its records read it, so a registration is made, read and undone in the same place. */
export function codexHomeOf(deps) {
  return usersCodexHome(deps) ?? path.join(deps.home, '.codex');
}

/** Whether the Codex CLI is logged in, by asking Codex itself: `codex login status` exits 0 when it is.
 * Run with `CODEX_HOME=<home>/.codex` so `--home` means the same Codex home and a fixture home never reads
 * the real one — except when `home` is the real home and the user already set their own `CODEX_HOME`: that
 * one is kept, since it is where their login actually lives (R3-codex-home-overrides-user-env). `env` and
 * `homedir` are injectable so tests never touch `process.env`. `unknown` on a timeout; any other outcome
 * (not logged in, no `codex` on PATH, a spawn that throws) is `missing`. Never reads `auth.json`. */
function codexLoginState(deps) {
  const env = usersCodexHome(deps) ? undefined : { CODEX_HOME: path.join(deps.home, '.codex') };
  const result = spawnProbe('codex', ['login', 'status'], { ...deps, env });
  if (result && probeTimedOut(result)) return 'unknown';
  return result && !result.error && result.status === 0 ? 'ok' : 'missing';
}

const ENGRAM_PLUGIN = 'engram@engram';
// The catalog first: on 2026-10-20 the installed plugin's commit was the marketplace clone's HEAD, 21 commits behind
// the refs Claude Code had fetched, its catalog still naming 0.1.12. Both commands verified by `--help` that day,
// neither run (odd/tasks/engram-plugin-lag.md, D3).
const ENGRAM_PLUGIN_UPDATE_FIX = ['claude plugin marketplace update engram', `claude plugin update ${ENGRAM_PLUGIN}`];
/** Where engram's README installs its binary from (v3.6.0, "Install"): its releases, or Homebrew on a Mac. It has no
 * package on npm or pnpm, so the line is the person's to follow (odd/tasks/f8-s11-complements.md, L3 and L4). */
export const ENGRAM_INSTALL =
  'install engram from https://github.com/Gentleman-Programming/engram/releases (on a Mac: brew install gentleman-programming/tap/engram)';
/** engram's own setup of Claude Code: the plugin's marketplace, the plugin, and the MCP entry, which it reads back and
 * never writes over one with another command (engram v3.6.0, `internal/setup/setup.go`, `installClaudeCode`). */
export const ENGRAM_SETUP_CLAUDE = 'engram setup claude-code';

/** The global install of `spec` as the machine's package manager runs it: `resolveStackPm` decides it, as `planStack` does,
 * so a pnpm machine is told `pnpm add -g` and never `npm` (the stack rule). npm keeps `i -g`, the line doctor always
 * printed. `env` is the environment doctor was given, without one the process's; each word is quoted for `platform`,
 * the one the line is run on. */
function installLine(spec, { env, platform = process.platform }) {
  const pm = resolveStackPm(undefined, env ?? process.env);
  return [...pm.words, pm.kind === 'pnpm' ? 'add' : 'i', '-g', spec].map((word) => shownWord(word, platform)).join(' ');
}

/** Tools as data: how to probe each one's installed version, its configured state per host, its
 * configured state for the current project, and its own fix command per dimension that can gap
 * (`installed`/`claude`/`codex`/`project`/`upToDate` — a tool omits a dimension it has no meaning
 * for, e.g. context7 has no CLI to `installed`-fix, typescript-lsp has no Codex equivalent; the
 * Codex row's `codex` dimension is "logged in", not "registered"). A fix is one command string,
 * or an array of commands to run in order when it takes several steps: no single separator works
 * in both `cmd.exe` (no `;`) and Windows PowerShell 5.1 (no `&&`). `fix` takes the same `deps` bag
 * as the other probes, since codegraph's `project` fix must carry the actual resolved project root,
 * not a placeholder; it also gets `configured`'s own result as a second argument. `configured` gets
 * the tool's own `installed` probe as its second argument, so a tool never probes the same binary
 * twice. `when`, when given, decides whether a tool is shown at all (`probeStack` leaves out a tool
 * whose `when` says no). Adding a tool never touches
 * `probeTool`/`probeStack` below, the same split `components` uses in manifest.mjs. Commands
 * verified on this machine 2026-09-26 (`codex mcp add --help`, `claude mcp add --help`) — see odd/tasks/stack-doctor.md;
 * engram's own read in its v3.6.0 source on 2026-10-28 (odd/tasks/f8-s11-complements.md, L3). */
export const tools = [
  {
    id: 'engram',
    installed: (deps) => probeVersionCommand('engram', ['version'], deps),
    configured: (deps) => ({
      claude: claudeJsonMcpServer(deps.home, 'engram', deps.project).state,
      codex: hasCodexMcpServer(codexHomeOf(deps), 'engram') ? 'ok' : 'missing',
    }),
    project: () => 'n/a',
    // engram's own commands (F8 S11): its binary from its releases, and `engram setup` for each host, which writes the
    // MCP entry with the binary's absolute path (and, in Claude Code, the plugin).
    fix: () => ({
      installed: ENGRAM_INSTALL,
      claude: ENGRAM_SETUP_CLAUDE,
      codex: 'engram setup codex',
      upToDate: ENGRAM_INSTALL,
    }),
  },
  {
    // engram's Claude Code plugin, whose hooks run in every Claude session: a row on every machine since F8 S11, which
    // installs it with engram's own setup, so a missing or disabled plugin is a gap. Its latest version is the one the
    // engram binary's own release tag ships (`LOCAL_SOURCES` in latest.mjs), not the newest plugin: an update of the
    // binary alone left the plugin two versions behind on 2026-10-20 (odd/tasks/engram-plugin-lag.md).
    id: 'engram-plugin',
    // Shown unless the project's engramPlugin switch is off (a custom preset that drops it, F8 S11 L9).
    when: (deps) => deps.functions?.engramPlugin?.value !== 'off',
    installed: ({ home }) => pluginInstalledVersion(home, ENGRAM_PLUGIN),
    configured: ({ home }) => ({ claude: claudeEnabledPlugin(home, ENGRAM_PLUGIN), codex: 'n/a' }),
    project: () => 'n/a',
    // The versions go in the fix, since the row shows only the installed one: `rows` holds the engram binary's.
    upToDateFix: (installed, latest, rows = [], { home, platform = process.platform } = {}) => {
      const binary = rows.find((row) => row.id === 'engram')?.version;
      // No latest with a binary version is a tag the marketplace clone lacks: since 2026-10-27 Claude Code clones it
      // shallow, without tags (odd/tasks/doctor-rows.md, `## Engram plugin`). Fetching that one tag lets doctor read it.
      if (installed && !latest && binary && home) {
        const clone = path.join(home, '.claude', 'plugins', 'marketplaces', 'engram');
        return [
          `the plugin engram v${binary} ships cannot be read from tag v${binary} of Claude Code's engram marketplace clone, which it clones shallow, without tags; fetch that tag into the clone, then run doctor again:`,
          `git -C ${shownWord(clone, platform)} fetch --depth 1 origin tag v${binary}`,
        ];
      }
      if (!installed || !latest) return ENGRAM_PLUGIN_UPDATE_FIX;
      // Ahead of the binary's tag is doctor's `mismatch` (row 11): the binary moves, not the plugin.
      if (compareSemver(installed, latest) > 0) {
        return [`plugin ${installed} is ahead of ${latest}, the plugin engram v${binary} ships, so the two serve different protocols; update the engram binary, then restart Claude Code:`, ENGRAM_INSTALL];
      }
      return [`plugin ${installed} is behind ${latest}, the plugin engram v${binary} ships; update it, then restart Claude Code:`, ...ENGRAM_PLUGIN_UPDATE_FIX];
    },
    fix: () => ({ installed: ENGRAM_SETUP_CLAUDE, claude: `claude plugin enable ${ENGRAM_PLUGIN}`, upToDate: ENGRAM_PLUGIN_UPDATE_FIX }),
  },
  {
    id: 'codegraph',
    installed: (deps) => probeVersionCommand('codegraph', ['--version'], deps),
    configured: (deps) => ({
      claude: claudeJsonMcpServer(deps.home, 'codegraph', deps.project).state,
      codex: hasCodexMcpServer(codexHomeOf(deps), 'codegraph') ? 'ok' : 'missing',
    }),
    // Where the project's codeMap switch is off, no index is wanted: `n/a`, which is no gap, so no init is offered.
    project: ({ project, functions }) => {
      if (functions?.codeMap?.value === 'off') return 'n/a';
      return project && fs.existsSync(path.join(project, '.codegraph')) ? 'ok' : 'missing';
    },
    // Never `codegraph upgrade` (user rule): codegraph's own fix is its package manager's install, both for
    // `installed` and `upToDate` — that install is also how an outdated codegraph gets upgraded. `project`
    // carries the actual resolved root (`deps.project`, already resolved by `resolveProjectRoot`
    // before `probeStack` runs), not a literal `<root>` placeholder.
    fix: ({ project, env, platform }) => ({
      installed: installLine('@colbymchenry/codegraph', { env, platform }),
      claude: 'claude mcp add -s user codegraph -- codegraph serve --mcp',
      codex: 'codex mcp add codegraph -- codegraph serve --mcp',
      project: `codegraph init --yes ${project ? shownWord(project, platform) : '<project root>'}`,
      upToDate: installLine('@colbymchenry/codegraph', { env, platform }),
    }),
  },
  {
    id: 'context7',
    installed: (deps) => context7InstalledVersion(deps),
    configured: (deps) => ({
      claude: claudeJsonMcpServer(deps.home, 'context7', deps.project).state,
      codex: hasCodexMcpServer(codexHomeOf(deps), 'context7') ? 'ok' : 'missing',
    }),
    // Required in every project (G11): a gap where Claude Code turns it off for this one (F8 S11, L6).
    project: ({ home, project }) => (project ? context7ProjectState(home, project) : 'n/a'),
    // No `installed` fix: context7 has no CLI of its own to install — being registered nowhere
    // already shows up as both `claude` and `codex` gaps, each with its own registration command.
    fix: () => ({
      claude: 'claude mcp add -s user --transport http context7 https://mcp.context7.com/mcp',
      codex: 'codex mcp add context7 --url https://mcp.context7.com/mcp',
      // No command turns a user-scope server back on for one project (L5): `/mcp` does, inside it.
      project: 'in a Claude Code session in this project, run /mcp and enable context7',
      // Hosted context7 is never `outdated` (see doctor.mjs's computeUpToDate) — this only fires
      // for a self-run registration, whose fix is reinstalling pinned to npm's newest version.
      upToDate: 'claude mcp add -s user context7 -- npx -y @upstash/context7-mcp@latest',
    }),
  },
  {
    // Shown only while the project's languageServer switch is not off, as the codex row follows codexReview: off is
    // the control of language-server-load (docs/FAILURES.md), so an enable fix there would bring that load back. A
    // switch that did not resolve shows it.
    id: 'typescript-lsp',
    when: (deps) => deps.functions?.languageServer?.value !== 'off',
    installed: ({ home }) => pluginInstalledVersion(home, 'typescript-lsp@claude-plugins-official'),
    configured: ({ home }) => ({
      claude: claudeEnabledPlugin(home, 'typescript-lsp@claude-plugins-official'),
      codex: 'n/a',
    }),
    project: () => 'n/a',
    // No `codex` fix: Claude Code plugins have no Codex equivalent, so `codex` is always `n/a`,
    // never a gap.
    fix: () => ({
      installed: 'claude plugin install typescript-lsp@claude-plugins-official',
      claude: 'claude plugin enable typescript-lsp@claude-plugins-official',
      upToDate: 'claude plugin update typescript-lsp@claude-plugins-official',
    }),
  },
  {
    // The Codex CLI itself (the Codex plugin row is gone): `installed` is its version, `codex` is "logged in".
    // Shown only while the project's codexReview switch is not off; a switch that did not resolve shows it.
    id: 'codex',
    installed: (deps) => probeVersionCommand('codex', ['--version'], deps),
    when: (deps) => deps.functions?.codexReview?.value !== 'off',
    // A missing CLI has no login to ask about: `n/a`, and `codex login status` is never spawned.
    configured: (deps, installed = probeVersionCommand('codex', ['--version'], deps)) => ({
      claude: 'n/a',
      codex: installed.state === 'missing' ? 'n/a' : codexLoginState(deps),
    }),
    project: () => 'n/a',
    fix: ({ env, platform }) => ({
      installed: installLine('@openai/codex', { env, platform }),
      codex: 'codex login',
      upToDate: installLine('@openai/codex@latest', { env, platform }),
    }),
  },
];

// The platforms whose desktop app config this reads: its folder is `desktopDir`'s.
const DESKTOP_APP_PLATFORMS = new Set(['win32', 'darwin']);

/** The account identifier at `keys` in the JSON file at `filePath`, or `null` when it cannot be had: no file,
 * one that cannot be read or parsed, or anything at that key but a non-blank string. Nothing else of the file
 * is taken, and the identifier never leaves `claudeAccountState` below. */
function accountIdentifier(filePath, keys) {
  let value = readJsonFile(filePath).data;
  for (const key of keys) value = value?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim().toLowerCase() : null;
}

/** Whether the Claude Code CLI and the desktop app are signed into the same account: a session opened from
 * the phone runs on this machine only when they are, and when they are not the phone just says the session is
 * not available. The CLI's identifier is `oauthAccount.accountUuid` in `<home>/.claude.json`, the app's is
 * `lastKnownAccountUuid` in the `config.json` of its folder (`desktopDir`, which follows the folder the app moved on
 * Windows); both paths come from `home`, never from the environment, so a fixture home is read and nothing else. `ok` when both are there and equal (compared without letter case:
 * they are hexadecimal), `mismatch` when both are there and differ, `unknown` when either is missing, which
 * it always is on a platform with no known app config. Only the state is returned: that `config.json` also
 * holds token caches, and neither identifier is ever printed, stored or put in a row. */
function claudeAccountState({ home, platform = process.platform }) {
  const cli = accountIdentifier(path.join(home, '.claude.json'), ['oauthAccount', 'accountUuid']);
  // An empty env: `desktopDir` then places AppData under `home`, as the check's contract above says.
  const app = DESKTOP_APP_PLATFORMS.has(platform) ? accountIdentifier(path.join(desktopDir(home, {}, platform), 'config.json'), ['lastKnownAccountUuid']) : null;
  if (cli === null || app === null) return 'unknown';
  return cli === app ? 'ok' : 'mismatch';
}

/** The login launchers the machine manifest under `home` records (`remote start --at-login` records each as an
 * optional file, by its absolute path), each with the server it starts: `{ args, files, state }`, the options of
 * the launcher's own `start` line (`launcherStart`), and the files and state file, under `home`, of the project
 * its `--cwd` names. A launcher that cannot be read, or whose start line does not read back whole, is
 * `{ found: 'unknown' }`: which server it starts, and how, is then not known. One whose file is gone is left
 * out, since nothing starts that server at login. Throws when the manifest cannot be read. */
function recordedLaunchers(home, platform) {
  const recorded = (readManifest(home)?.optional ?? []).map((entry) => entry?.path).filter(isLoginLauncher);
  return recorded.flatMap((file) => {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (err) {
      return err.code === 'ENOENT' ? [] : [{ found: 'unknown' }];
    }
    const start = launcherStart(text);
    if (start === null) return [{ found: 'unknown' }];
    const files = remoteFiles(home, remoteId(start.root, platform));
    return [{ args: start.args, files, state: readState(files.statePath) }];
  });
}

/** Whether the server of every recorded login launcher is running: with the launcher on, a server that is down
 * is seen nowhere else until the phone finds no session (on 2026-10-05 one stayed down twelve hours). Running is
 * decided as `remote status` decides it (`locate`): by the state file under `home` and the identity, pid and
 * creation time, of the process it names, never by a pid alone. The manifest, the launchers and the state files
 * all come from `home`, never from the environment, so a fixture home sees nothing of this machine's.
 *
 * `claude` is `n/a` with no launcher recorded, `down` when at least one server is not running (the gap, whatever
 * the others are), else `unknown` when one could not be told (a manifest, launcher or state file that cannot be
 * read, a look at the processes that failed), else `ok`. The `down` list beside it is internal, like the Codex
 * `staleHooks`: the servers that are down, each `{ args, stopped }`, `stopped` when the marker of a
 * `remote stop` is there, which is why the watchdog left that one down.
 *
 * `doctor` runs at every session start, so the processes are looked at only when some state file names one, once
 * for all of them, and that one snapshot (PowerShell, most of a second) is bounded like every other probe. */
function remoteServerState({ home, platform = process.platform, spawn = spawnSync }) {
  let servers;
  try {
    servers = recordedLaunchers(home, platform);
  } catch {
    return { claude: 'unknown', codex: 'n/a' };
  }
  if (servers.length === 0) return { claude: 'n/a', codex: 'n/a' };

  const pids = servers.filter(({ state }) => state && !state.unreadable).map(({ state }) => state.pid);
  let processes;
  let failure;
  if (pids.length > 0) {
    const bounded = (file, args, options) => spawn(file, args, { ...options, timeout: PROBE_TIMEOUT_MS });
    try {
      processes = lookUpProcesses(pids, () => takeSnapshot({ spawnSync: bounded }));
    } catch (err) {
      failure = err ?? new Error('the processes could not be listed');
    }
  }
  // The one look, or its failure, answers for every recorded supervisor.
  const identify = () => {
    if (failure) throw failure;
    return processes;
  };
  const found = servers.map((server) => ({ ...server, found: server.found ?? locate(server.state, identify).found }));
  const down = found.filter((server) => server.found === 'gone');
  const claude = down.length > 0 ? 'down' : found.some((server) => server.found === 'unknown') ? 'unknown' : 'ok';
  return { claude, codex: 'n/a', down: down.map(({ args, files }) => ({ args, stopped: fs.existsSync(files.stoppedPath) })) };
}

/** The fix of the remote server check: for each server that is down, the command that starts it again as its
 * launcher does, with the options of the launcher's own line (a bare `start --cwd` would bring it back under the
 * folder's name, the user's own modes and another home), and why the watchdog did not when it was stopped on
 * purpose. One command as it is, several as a list; a server named twice (a launcher recorded under two
 * spellings of its path) is named once. */
function remoteServerFix(down = []) {
  const commands = [...new Set(down.map(({ args, stopped }) =>
    `${remoteStartCommand(args)}${stopped ? ' (stopped on purpose with js-harness remote stop, so the watchdog leaves it down)' : ''}`))];
  if (commands.length === 0) return {};
  return { claude: commands.length === 1 ? commands[0] : commands };
}

// The hook commands the check tries: those that start with `js-harness resume `, and the turn-start hook of the rules.
// With empty standard input each finds no hook input, so it writes nothing and ends at once, which is what makes it safe
// to run from a check.
const TRIED_PREFIX = 'js-harness resume ';
const TRIED_COMMANDS = new Set(['js-harness rules --hook']);
// The guard `pauseHookEntry` adds: it turns any exit into 0 for the host, so the check takes it off, or a copy that
// answers 2 would pass for answered.
const HOOK_GUARD = ' || exit 0';

/** The recorded hook commands the check runs, each once and in the order first recorded, with the guard taken off and
 * whether the check tries it. Only a `js-harness resume ` command and `js-harness rules --hook` are tried. Any other is listed as not tried:
 * `js-harness doctor --hook` is the session-start report itself, and running it would count as a report made. */
export function hookCommandPlan(commands) {
  const seen = new Set();
  const plan = [];
  for (const recorded of commands) {
    const command = recorded.endsWith(HOOK_GUARD) ? recorded.slice(0, -HOOK_GUARD.length) : recorded;
    if (seen.has(command)) continue;
    seen.add(command);
    plan.push({ command, tried: command.startsWith(TRIED_PREFIX) || TRIED_COMMANDS.has(command) });
  }
  return plan;
}

// The fix of the hook commands check: `upgrade` to the newest release, or, for entries written by a copy ahead of
// the newest tag (one that follows main), the newest copy installed by hand as `INSTALL_NEWEST` says.
const HOOK_FIX = `the js-harness on the path is older than these entries: run js-harness upgrade, or install the newest copy (${INSTALL_NEWEST}), then run js-harness doctor again`;
// The first line of a tried command's standard error that a gap line shows; the rest is not the answer.
const STDERR_LINE_MAX = 160;

/** The commands the recorded hook entries of `home`'s manifest install: each entry install wrote (not one it skipped),
 * its hooks' commands in the order recorded. Throws when the manifest cannot be read, and the check reads that as
 * `unknown`. */
function recordedHookCommands(home) {
  const entries = readManifest(home)?.entries ?? [];
  return entries
    .filter((entry) => !entry?.skipped)
    .flatMap((entry) => (Array.isArray(entry?.entry?.hooks) ? entry.entry.hooks : []))
    .map((hook) => hook?.command)
    .filter((command) => typeof command === 'string');
}

/** Runs one tried command as its hook would run it, minus the guard. Standard input is empty, so `resume` finds no hook
 * input and writes nothing. `JS_HARNESS_HOME` names a folder under the system's temp folder that is never created: a copy
 * that would write a state writes it there, where nothing reads it, and never under the real home. The time limit is
 * the probes' own, and a throw from `spawn` is left to the caller. */
function runHookCommand(command, deps) {
  const [binary, ...args] = command.split(' ');
  const probeHome = path.join(os.tmpdir(), `js-harness-doctor-${randomUUID()}`);
  return spawnProbeOrThrow(binary, args, { ...deps, input: '', env: { JS_HARNESS_HOME: probeHome } });
}

/** One command's outcome as the check says it: answered when it exits 0; otherwise why not: it could not be started,
 * it timed out, or its exit code, with the first non-blank line of its standard error. */
function describeHookCommand(command, result) {
  if (!result) return { answered: false, line: `${command}: could not be started` };
  // A timed-out child may carry an ETIMEDOUT error too, so the timeout is told before the error.
  if (probeTimedOut(result)) return { answered: false, line: `${command}: timed out after ${PROBE_TIMEOUT_MS / 1000} seconds` };
  if (result.error) return { answered: false, line: `${command}: could not be started` };
  if (result.status === 0) return { answered: true, line: `${command}: answered` };
  const text = String(result.stderr ?? '').split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  const stderr = text ? `; stderr: ${text.slice(0, STDERR_LINE_MAX)}` : '';
  return { answered: false, line: `${command}: exit ${result.status ?? 'without a code'}${stderr}` };
}

/** The hook commands check: every command the recorded hook entries run that `js-harness resume` answers with exit 0,
 * the copy on the path being the one every entry runs. `stale` is the gap: a tried command that does not answer, with a
 * line per command for the fix (`lines`, internal like `down`). `n/a` when nothing is tried (no manifest, or none
 * recorded). `unknown` when anything throws, which is also what a manifest that does not parse gives. */
function hookCommandsState(deps) {
  try {
    const plan = hookCommandPlan(recordedHookCommands(deps.home));
    if (!plan.some(({ tried }) => tried)) return { claude: 'n/a', codex: 'n/a', lines: [] };
    const lines = [];
    let gap = false;
    for (const { command, tried } of plan) {
      if (!tried) {
        lines.push(`${command}: not tried`);
        continue;
      }
      const { answered, line } = describeHookCommand(command, runHookCommand(command, deps));
      lines.push(line);
      if (!answered) gap = true;
    }
    return { claude: gap ? 'stale' : 'ok', codex: 'n/a', lines };
  } catch {
    return { claude: 'unknown', codex: 'n/a', lines: [] };
  }
}

// The fix of the Codex trust check. Trusting a hook is the user's security setting, and its hash is Codex's own, so the
// harness names the step and never writes the record (odd/tasks/codex-hook-trust.md).
export const CODEX_TRUST_FIX = 'Codex runs no hook its config.toml holds no trust record for, and says nothing: run `codex` in a terminal and answer its prompt about hooks with "Trust all and continue". The harness never writes that record: trusting a hook is your setting';

/** The Codex trust check: each hook of a harness entry of `<home>/.codex/hooks.json` that the config.toml of the Codex
 * home (`codexHomeOf`, T8) holds no `trusted_hash` for, at the place Codex keys it by
 * (`<hooks.json>:<event_snake>:<group>:<handler>`, the group found as `uninstall` finds the entry). `missing` in the
 * `codex` cell is the gap, with the config.toml read and one line per hook (`lines`); `n/a` when no Codex entry is
 * recorded or there; `unknown` when a file cannot be read, or holds hook trust in a form not read. A stale hash, of an
 * entry an upgrade changed, reads as trusted here: it cannot be recomputed. It reads files only, so the session-start
 * report runs it too. */
function codexTrustState(deps) {
  const none = { claude: 'n/a', codex: 'n/a', lines: [] };
  try {
    const hooksPath = path.join(deps.home, '.codex', 'hooks.json');
    const records = (readManifest(deps.home)?.entries ?? []).filter((entry) => entry?.path === hooksPath);
    if (records.length === 0 || !fs.existsSync(hooksPath)) return none;
    const places = entryPlaces(JSON.parse(fs.readFileSync(hooksPath, 'utf8')), records);
    if (places.length === 0) return none;
    const config = path.join(codexHomeOf(deps), 'config.toml');
    const text = fs.existsSync(config) ? fs.readFileSync(config, 'utf8') : '';
    const trusted = trustedPlaces(text, hooksPath, deps.platform ?? process.platform);
    const lines = [];
    // In the order of the file, event by event, so each line reads as Codex's own key does.
    const ordered = places.map((place) => ({ ...place, event: snakeEvent(place.event) })).sort((a, b) => a.event.localeCompare(b.event) || a.group - b.group);
    for (const { record, event, group } of ordered) {
      record.entry.hooks.forEach((hook, handler) => {
        const place = `${event}:${group}:${handler}`;
        if (!trusted.has(place)) lines.push(`  ${place} ${hook.command}`);
      });
    }
    if (lines.length === 0) return { claude: 'n/a', codex: 'ok', lines };
    return { claude: 'n/a', codex: 'missing', lines: [`${config} holds no trust for these hooks of ${hooksPath}:`, ...lines] };
  } catch {
    return { claude: 'n/a', codex: 'unknown', lines: [] };
  }
}

/** Checks that are not tools, in the tools' own shape so `probeTool` and every reader of a doctor row take
 * them as they are: nothing to install (`installed` is `n/a`, with no version, so nothing to be up to date
 * with either) and one cell that carries the state. They are kept apart from `tools`, which other modules
 * read as the list of tools. The account check's gap is `mismatch`; its fix is the human's to run, since
 * nothing here signs in or out. The remote server check's gap is `down`, in the `claude` cell too (the server is
 * Claude Code's; Codex has none); its fix is there only while a server is down, since it names that server. The hook
 * commands check's gap is `stale` in the `claude` cell: a tried command of a recorded hook entry does not exit 0 with the
 * copy on the path. It runs processes, so it is `interactiveOnly`. The memory rules check's gap is `stale` in the
 * `claude` cell too: a note of the project's Claude Code memory that holds a rule or a decision, which nothing acts on
 * there (`memory-rules.mjs`); it runs in the session-start report as well, so a new one is told at the next session.
 * The session classes check's gap is `mismatch` in the `claude` cell: the project's recent sessions are of both
 * permission classes and the user setting that lets a message cross between them is not `accept`
 * (`session-classes.mjs`); its fix is `install --accept-session-messages`. The pnpm lock check's gap is `stale` in the
 * `claude` cell: the global bin lock a failed `pnpm add -g` left, which makes the next one wait five minutes and fail
 * (`pnpm-lock.mjs`); it reads `PNPM_HOME` from `deps.env`, the env doctor was given, and its fix is the `rmdir`. The
 * Codex daemon check's gap is `missing` in the `codex` cell: Codex's managed daemon has no executable to start and will
 * not install one (`codex-daemon.mjs`); it reads the Codex home only, and its fix names the repair, never run here. */
export const checks = [
  {
    id: 'memory-rules',
    installed: () => ({ state: 'n/a', version: null }),
    configured: memoryRulesState,
    project: () => 'n/a',
    fix: (_deps, configured) => (configured?.claude === 'stale' ? { claude: [MEMORY_RULES_FIX, ...configured.lines] } : {}),
  },
  {
    id: 'session-classes',
    installed: () => ({ state: 'n/a', version: null }),
    configured: sessionClassesState,
    project: () => 'n/a',
    fix: (_deps, configured) => (configured?.claude === 'mismatch' ? { claude: [SESSION_CLASSES_FIX, ...configured.lines] } : {}),
  },
  {
    id: 'claude-account',
    installed: () => ({ state: 'n/a', version: null }),
    configured: (deps) => ({ claude: claudeAccountState(deps), codex: 'n/a' }),
    project: () => 'n/a',
    fix: () => ({ claude: 'claude auth login' }),
  },
  {
    id: 'remote-server',
    installed: () => ({ state: 'n/a', version: null }),
    configured: (deps) => remoteServerState(deps),
    project: () => 'n/a',
    fix: (_deps, configured) => remoteServerFix(configured?.down),
  },
  {
    id: 'codex-trust',
    installed: () => ({ state: 'n/a', version: null }),
    configured: codexTrustState,
    project: () => 'n/a',
    fix: (_deps, configured) => (configured?.codex === 'missing' ? { codex: [CODEX_TRUST_FIX, ...configured.lines] } : {}),
  },
  {
    id: 'codex-daemon',
    installed: () => ({ state: 'n/a', version: null }),
    configured: (deps) => codexDaemonState({ codexHome: codexHomeOf(deps) }),
    project: () => 'n/a',
    fix: (_deps, configured) => (configured?.codex === 'missing' ? { codex: [CODEX_DAEMON_FIX, ...configured.lines] } : {}),
  },
  {
    id: 'hook-commands',
    installed: () => ({ state: 'n/a', version: null }),
    configured: hookCommandsState,
    project: () => 'n/a',
    fix: (_deps, configured) => (configured?.claude === 'stale' ? { claude: [HOOK_FIX, ...configured.lines] } : {}),
    interactiveOnly: true,
  },
  {
    id: 'pnpm-lock',
    installed: () => ({ state: 'n/a', version: null }),
    configured: (deps) => pnpmLockState({ env: deps.env }),
    project: () => 'n/a',
    fix: (_deps, configured) => (configured?.claude === 'stale' ? { claude: [PNPM_LOCK_FIX, ...configured.lines] } : {}),
  },
];

/** The project root for per-project checks: the given `cwd`, resolved up to its git toplevel when
 * it is inside a repo. Falls back to `cwd` itself on any failure (no repo, no `git` on PATH). */
export function resolveProjectRoot(cwd, spawn = spawnSync) {
  try {
    const result = spawn('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
    if (result && !result.error && result.status === 0 && result.stdout) return result.stdout.trim();
  } catch {
    // No git, or not a repo: `cwd` itself is the best root we have.
  }
  return cwd;
}

/** One tool's full doctor row: installed state + version, configured per host, configured for the
 * project, `upToDate` left `unknown` for T2, and the tool's own fix command per dimension. */
export function probeTool(tool, deps) {
  const installedProbe = tool.installed(deps);
  const { state: installed, version } = installedProbe;
  const configured = tool.configured(deps, installedProbe);
  return {
    id: tool.id,
    version,
    installed,
    claude: configured.claude,
    codex: configured.codex,
    project: tool.project(deps),
    upToDate: 'unknown',
    fix: tool.fix(deps, configured),
  };
}

/** Every shown tool's row, in `tools` order, then every check's, in `checks` order. A tool whose `when` says no is
 * left out (the Codex row while the project's codexReview switch is off). A check marked `interactiveOnly` starts
 * processes of its own, so it is left out unless `deps.interactive` is set: only `doctor`'s own report sets it, and the
 * session-start report (`doctor --hook`) and the TUI's stack block keep their cost. */
export function probeStack(deps) {
  const shown = tools.filter((tool) => !tool.when || tool.when(deps));
  const selected = checks.filter((check) => deps.interactive || !check.interactiveOnly);
  return [...shown, ...selected].map((tool) => probeTool(tool, deps));
}

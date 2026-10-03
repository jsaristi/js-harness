// The stack's tools as data, plus read-only, injectable probes for three of their four states:
// installed (+ version), configured (per host, per project). `outdated` is T2's job — see
// odd/tasks/stack-doctor.md — so every row here carries `upToDate: 'unknown'` for it to fill.
// The Codex plugin row (`codex-plugin`, T6) keeps the column meanings: `claude` is the plugin
// enabled, `codex` is "the Codex side is ready", i.e. logged in.
// Every probe takes the same `deps` bag (`home`, `project`, `spawn`, `platform`) so tests can
// fixture a temp home and a fake spawn instead of touching the real one or the network.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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
function spawnProbe(command, args, { spawn = spawnSync, platform = process.platform, env } = {}) {
  const shell = platform === 'win32';
  const [file, argv] = shell ? [[command, ...args].join(' '), []] : [command, args];
  const options = { encoding: 'utf8', shell, timeout: PROBE_TIMEOUT_MS };
  if (env) options.env = { ...process.env, ...env };
  try {
    return spawn(file, argv, options) ?? null;
  } catch {
    return null;
  }
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
function probeVersionCommand(command, args, deps) {
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

/** Minimal read-only presence check for a `[mcp_servers.<name>]` TOML section header: no TOML
 * library, since T1 only ever needs to know the section exists, never its contents. */
function hasCodexMcpServer(home, name) {
  const filePath = path.join(home, '.codex', 'config.toml');
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
function claudeJsonMcpServer(home, name, projectRoot) {
  const { found, data } = readJsonFile(path.join(home, '.claude.json'));
  if (!found) return { state: 'missing', entry: undefined };
  if (data === undefined) return { state: 'unknown', entry: undefined };
  const globalEntry = data?.mcpServers?.[name];
  const projectEntry = projectRoot ? data?.projects?.[projectRoot]?.mcpServers?.[name] : undefined;
  const entry = globalEntry ?? projectEntry;
  return { state: entry ? 'ok' : 'missing', entry };
}

/** `<home>/.claude/settings.json` `enabledPlugins["<id>"]`. */
function claudeEnabledPlugin(home, pluginId) {
  const { found, data } = readJsonFile(path.join(home, '.claude', 'settings.json'));
  if (!found) return 'missing';
  if (data === undefined) return 'unknown';
  return data?.enabledPlugins?.[pluginId] === true ? 'ok' : 'missing';
}

/** `<home>/.gentle-ai/state.json` `installed_agents` membership. */
function gentleAiInstalledAgent(home, agent) {
  const { found, data } = readJsonFile(path.join(home, '.gentle-ai', 'state.json'));
  if (!found) return 'missing';
  if (data === undefined) return 'unknown';
  return Array.isArray(data?.installed_agents) && data.installed_agents.includes(agent) ? 'ok' : 'missing';
}

// Where each host keeps its hooks, relative to the home.
const HOST_HOOKS_FILES = {
  claude: ['.claude', 'settings.json'],
  codex: ['.codex', 'hooks.json'],
};
// `gentle-ai <command>` where a command can start, and nowhere else: at the start of the hook
// command, after a separator (`;`, `&`, `|`, `(`, `{`, a newline), or right after the opening quote
// of a shell's command-string flag (`-Command '`, `-c "`). Then an optional quote, an optional path
// ending in `/` or `\`, the bare or `.exe` binary, an optional closing quote and the command word.
// Anything else (`echo gentle-ai x`, `my-gentle-ai x`, text inside a quoted message) is left
// unclassified on purpose: doctor makes no claim about a hook it cannot read as a call.
const GENTLE_AI_CALL_RE =
  /(?:^|[;&|({\n]|-[Cc](?:ommand)?\s+["'])\s*["']?(?:[^\s"']*[\\/])?gentle-ai(?:\.exe)?["']?\s+([A-Za-z][\w-]*)/g;

/** Every hook command in a hooks config (`hooks.<Event>[].hooks[].command`, the shape both hosts
 * use), as `{ event, command }`. A missing or malformed file, or a shape that does not match,
 * contributes nothing: this is read-only evidence gathering, so it never throws. */
function hookCommands(filePath) {
  const hooks = readJsonFile(filePath).data?.hooks;
  if (!hooks || typeof hooks !== 'object') return [];
  const found = [];
  for (const [event, groups] of Object.entries(hooks)) {
    for (const group of Array.isArray(groups) ? groups : []) {
      for (const hook of Array.isArray(group?.hooks) ? group.hooks : []) {
        if (typeof hook?.command === 'string') found.push({ event, command: hook.command });
      }
    }
  }
  return found;
}

/** The commands `gentle-ai help` lists: inside a section whose header line names `COMMANDS` (it ends
 * at the next unindented line), a line indented by exactly two spaces is a command line and its
 * first word is the command; deeper lines continue the one above. Other sections, such as `USAGE`,
 * are never read, so help that is only partly understood yields nothing. This is the only thing
 * ever run to learn them: probing a hook's own command could execute it. `null` when help cannot be
 * run or yields no command lines, so the caller makes no claim without evidence. */
function gentleAiListedCommands(deps) {
  const result = spawnProbe('gentle-ai', ['help'], deps);
  if (!result || result.error || probeTimedOut(result) || result.status !== 0) return null;
  const listed = new Set();
  let inCommands = false;
  for (const line of String(result.stdout ?? '').split(/\r?\n/)) {
    if (/^\S/.test(line)) inCommands = line.includes('COMMANDS');
    const match = inCommands ? /^ {2}([A-Za-z][\w-]*)(?:\s|$)/.exec(line) : null;
    if (match) listed.add(match[1]);
  }
  return listed.size > 0 ? listed : null;
}

/** Per configured host, one fix line for each hook that runs a `gentle-ai` command `gentle-ai
 * help` does not list (gentle-ai 4 removed `sdd-*` but `sync` left its hooks behind). `help` is
 * spawned at most once, and only when some hook calls gentle-ai at all. */
function deadGentleAiHooks(deps, cells) {
  const withCalls = [];
  for (const [host, parts] of Object.entries(HOST_HOOKS_FILES)) {
    if (cells[host] !== 'ok') continue;
    const hooks = hookCommands(path.join(deps.home, ...parts)).filter(({ command }) =>
      command.match(GENTLE_AI_CALL_RE),
    );
    if (hooks.length > 0) withCalls.push({ host, file: `~/${parts.join('/')}`, hooks });
  }
  const listed = withCalls.length > 0 ? gentleAiListedCommands(deps) : null;
  const dead = {};
  for (const { host, file, hooks } of withCalls) {
    for (const { event, command } of hooks) {
      const unlisted = [...command.matchAll(GENTLE_AI_CALL_RE)].map((m) => m[1]).find((word) => !listed?.has(word));
      if (!listed || !unlisted) continue;
      (dead[host] ??= []).push(
        `remove the hook "${command}" (${event}) from ${file}: "gentle-ai help" lists no "${unlisted}" command`,
      );
    }
  }
  return dead;
}

/** context7 has no CLI: its installed version comes from how Claude Code has it registered. A
 * hosted entry (`type: "http"` with a `url`) has no version of its own; a self-run one pins
 * `@upstash/context7-mcp@X` in its npx args. Registered only in Codex (whose config we only ever
 * presence-check, never parse) is `unknown`, not `missing` — it is installed, just unreadable. */
function context7InstalledVersion(home) {
  const { state, entry } = claudeJsonMcpServer(home, 'context7');
  if (state === 'unknown') return { state: 'unknown', version: null };
  if (state === 'missing') {
    return hasCodexMcpServer(home, 'context7')
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
 * is written down. Used by typescript-lsp and the Codex plugin, each with its own
 * `<name>@<marketplace>` id. */
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

/** Whether Codex is logged in, by asking Codex itself: `codex login status` exits 0 when it is.
 * Run with `CODEX_HOME=<home>/.codex` so `--home` means the same Codex home and a fixture home
 * never reads the real one — except when `home` is the real home and the user already set their
 * own `CODEX_HOME`: that one is kept, since it is where their login actually lives (R3-codex-home-
 * overrides-user-env). `env` and `homedir` are injectable so tests never touch `process.env`. The
 * MCP probes still read `<home>/.codex` regardless — a pre-existing gap, out of scope here.
 * `codex` is `unknown` on a timeout; any other outcome (not logged in, no `codex` on PATH, a spawn
 * that throws) is `missing`. Only then is `codex --version` spawned (same env, same timeout) to tell
 * a logged-out Codex from a missing CLI, reported as `codexCli` (T6d, Codex P2) — the `codex` cell is
 * `missing` either way, and only the fix differs. `codexCli` is absent when nothing was probed for
 * it. Never reads `auth.json`. */
function codexLoginState({ home, env: userEnv = process.env, homedir = os.homedir(), ...deps }) {
  const platform = deps.platform ?? process.platform;
  const keepUsersCodexHome = Boolean(userEnv.CODEX_HOME) && sameDirectory(home, homedir, platform);
  const env = keepUsersCodexHome ? undefined : { CODEX_HOME: path.join(home, '.codex') };
  const probeDeps = { ...deps, env };
  const result = spawnProbe('codex', ['login', 'status'], probeDeps);
  if (result && probeTimedOut(result)) return { codex: 'unknown' };
  if (result && !result.error && result.status === 0) return { codex: 'ok', codexCli: 'ok' };
  const cli = probeVersionCommand('codex', ['--version'], probeDeps);
  return { codex: 'missing', codexCli: cli.state === 'missing' ? 'missing' : 'ok' };
}

const GENTLE_AI_UPGRADE_FIX = ['gentle-ai upgrade', 'gentle-ai sync'];

/** Tools as data: how to probe each one's installed version, its configured state per host, its
 * configured state for the current project, and its own fix command per dimension that can gap
 * (`installed`/`claude`/`codex`/`project`/`upToDate` — a tool omits a dimension it has no meaning
 * for, e.g. context7 has no CLI to `installed`-fix, typescript-lsp has no Codex equivalent; the
 * Codex plugin's `codex` dimension is "logged in", not "registered"). A fix is one command string,
 * or an array of commands to run in order when it takes several steps: no single separator works
 * in both `cmd.exe` (no `;`) and Windows PowerShell 5.1 (no `&&`). `fix`
 * takes the same `deps` bag as the other probes, since codegraph's `project` fix must carry the
 * actual resolved project root, not a placeholder; it also gets `configured`'s own result as a
 * second argument (the Codex plugin reads its probed `codexCli` there; every other tool ignores
 * it). Adding a tool never touches
 * `probeTool`/`probeStack` below, the same split `components` uses in manifest.mjs. Commands
 * verified on this machine 2026-09-26 (`codex mcp add --help`, `claude mcp add --help`, `gentle-ai
 * --help`) — see odd/tasks/stack-doctor.md. */
export const tools = [
  {
    id: 'gentle-ai',
    installed: (deps) => probeVersionCommand('gentle-ai', ['version'], deps),
    // A configured host whose hooks call a command `gentle-ai help` no longer lists is `stale`;
    // `staleHooks` (its fix lines per host) is internal, like the Codex plugin's `codexCli`.
    configured: (deps) => {
      const cells = {
        claude: gentleAiInstalledAgent(deps.home, 'claude-code'),
        codex: gentleAiInstalledAgent(deps.home, 'codex'),
      };
      const staleHooks = deadGentleAiHooks(deps, cells);
      for (const host of Object.keys(staleHooks)) cells[host] = 'stale';
      return Object.keys(staleHooks).length > 0 ? { ...cells, staleHooks } : cells;
    },
    project: () => 'n/a',
    // `gentle-ai upgrade` cannot cross a Go major (v4 lives at a new module path, so from 3.7.0 it
    // upgraded engram and left gentle-ai behind): then the fix is `go install` for that path. It
    // needs the latest version, which is only known once `doctor` has resolved it, so `doctor`
    // applies it on top of `fix.upToDate`. Unknown or unparseable versions keep `fix.upToDate`.
    upToDateFix: (installed, latest) => {
      const [from, to] = [installed, latest].map((v) => SEMVER_RE.exec(v ?? '')?.[1]);
      const [fromMajor, toMajor] = [from, to].map((v) => v?.split('.')[0]);
      if (!from || !to || Number(toMajor) <= Number(fromMajor)) return GENTLE_AI_UPGRADE_FIX;
      const module = `github.com/gentleman-programming/gentle-ai/v${toMajor}/cmd/gentle-ai`;
      return [`go install ${module}@v${to}`, 'gentle-ai sync'];
    },
    fix: (_deps, configured) => ({
      installed: 'see https://github.com/Gentleman-Programming/gentle-ai',
      claude: configured?.staleHooks?.claude ?? 'gentle-ai install',
      codex: configured?.staleHooks?.codex ?? 'gentle-ai install',
      upToDate: GENTLE_AI_UPGRADE_FIX,
    }),
  },
  {
    id: 'engram',
    installed: (deps) => probeVersionCommand('engram', ['version'], deps),
    configured: ({ home, project }) => ({
      claude: claudeJsonMcpServer(home, 'engram', project).state,
      codex: hasCodexMcpServer(home, 'engram') ? 'ok' : 'missing',
    }),
    project: () => 'n/a',
    fix: () => ({
      installed: 'gentle-ai upgrade',
      claude: 'gentle-ai sync',
      codex: 'gentle-ai sync',
      upToDate: 'gentle-ai upgrade',
    }),
  },
  {
    id: 'codegraph',
    installed: (deps) => probeVersionCommand('codegraph', ['--version'], deps),
    configured: ({ home, project }) => ({
      claude: claudeJsonMcpServer(home, 'codegraph', project).state,
      codex: hasCodexMcpServer(home, 'codegraph') ? 'ok' : 'missing',
    }),
    project: ({ project }) => (project && fs.existsSync(path.join(project, '.codegraph')) ? 'ok' : 'missing'),
    // Never `codegraph upgrade` (user rule): codegraph's own fix is its npm install, both for
    // `installed` and `upToDate` — npm is also how an outdated codegraph gets upgraded. `project`
    // carries the actual resolved root (`deps.project`, already resolved by `resolveProjectRoot`
    // before `probeStack` runs), not a literal `<root>` placeholder.
    fix: ({ project }) => ({
      installed: 'npm i -g @colbymchenry/codegraph',
      claude: 'claude mcp add -s user codegraph -- codegraph serve --mcp',
      codex: 'codex mcp add codegraph -- codegraph serve --mcp',
      project: `gentle-ai codegraph init --cwd ${project || '<project root>'}`,
      upToDate: 'npm i -g @colbymchenry/codegraph',
    }),
  },
  {
    id: 'context7',
    installed: ({ home }) => context7InstalledVersion(home),
    configured: ({ home, project }) => ({
      claude: claudeJsonMcpServer(home, 'context7', project).state,
      codex: hasCodexMcpServer(home, 'context7') ? 'ok' : 'missing',
    }),
    project: () => 'n/a',
    // No `installed` fix: context7 has no CLI of its own to install — being registered nowhere
    // already shows up as both `claude` and `codex` gaps, each with its own registration command.
    fix: () => ({
      claude: 'claude mcp add -s user --transport http context7 https://mcp.context7.com/mcp',
      codex: 'codex mcp add context7 --url https://mcp.context7.com/mcp',
      // Hosted context7 is never `outdated` (see doctor.mjs's computeUpToDate) — this only fires
      // for a self-run registration, whose fix is reinstalling pinned to npm's newest version.
      upToDate: 'claude mcp add -s user context7 -- npx -y @upstash/context7-mcp@latest',
    }),
  },
  {
    id: 'typescript-lsp',
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
    // `codex` here is "logged in", not a registration: the plugin's Codex side is Codex itself
    // being signed in. Its fixes are the tool's own commands (the marketplace source is the one
    // recorded in `known_marketplaces.json`).
    id: 'codex-plugin',
    installed: ({ home }) => pluginInstalledVersion(home, 'codex@openai-codex'),
    // `codexCli` is internal: `probeTool` hands it to `fix` but never copies it into the row.
    configured: (deps) => ({
      claude: claudeEnabledPlugin(deps.home, 'codex@openai-codex'),
      // No plugin, nothing to be logged in for: `n/a`, and `codex login status` is never spawned.
      ...(pluginInstalledVersion(deps.home, 'codex@openai-codex').state === 'ok'
        ? codexLoginState(deps)
        : { codex: 'n/a' }),
    }),
    project: () => 'n/a',
    fix: (_deps, configured) => ({
      installed: ['claude plugin marketplace add openai/codex-plugin-cc', 'claude plugin install codex@openai-codex'],
      claude: 'claude plugin enable codex@openai-codex',
      // A missing Codex CLI needs installing before there is anything to log in to.
      codex: configured?.codexCli === 'missing' ? ['npm i -g @openai/codex', 'codex login'] : 'codex login',
      upToDate: 'claude plugin update codex@openai-codex',
    }),
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
  const { state: installed, version } = tool.installed(deps);
  const configured = tool.configured(deps);
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

/** Every tool's row, in `tools` order. */
export function probeStack(deps) {
  return tools.map((tool) => probeTool(tool, deps));
}

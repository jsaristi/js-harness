// The stack's tools as data, plus read-only, injectable probes for three of their four states:
// installed (+ version), configured (per host, per project). `outdated` is T2's job — see
// odd/tasks/stack-doctor.md — so every row here carries `upToDate: 'unknown'` for it to fill.
// Every probe takes the same `deps` bag (`home`, `project`, `spawn`, `platform`) so tests can
// fixture a temp home and a fake spawn instead of touching the real one or the network.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SEMVER_RE = /(\d+\.\d+\.\d+)/;
// R3-001 (accepted T1 review follow-up): a hung probe must never block `doctor` — kill it and
// report `unknown`, the same as any other unreadable result, rather than leaving it to hang.
const PROBE_TIMEOUT_MS = 5000;

/** Runs `<command> <args>` and extracts the first semver from stdout. Never throws: a missing
 * binary (ENOENT, or any non-zero exit) is `missing`; output with no parseable version, or a probe
 * that had to be killed after `PROBE_TIMEOUT_MS`, is `unknown`. `shell` is needed on win32 because
 * npm-installed global binaries are `.cmd` shims (see how `upgradeMain` in update.mjs spawns
 * `js-harness` itself for the same reason). Through a shell the command goes as one line with no
 * args array: Node 24 warns (DEP0190) on stderr otherwise, and the probe args are fixed literals. */
function probeVersionCommand(command, args, { spawn = spawnSync, platform = process.platform } = {}) {
  const shell = platform === 'win32';
  const [file, argv] = shell ? [[command, ...args].join(' '), []] : [command, args];
  let result;
  try {
    result = spawn(file, argv, { encoding: 'utf8', shell, timeout: PROBE_TIMEOUT_MS });
  } catch {
    return { state: 'missing', version: null };
  }
  if (!result) return { state: 'missing', version: null };
  // Node kills a timed-out spawnSync child with a signal (status becomes null); it may also carry
  // an ETIMEDOUT error instead, depending on where the timeout was detected. Either shape means
  // the tool could not be reached in time, not that it is missing.
  if (result.signal || result.error?.code === 'ETIMEDOUT') return { state: 'unknown', version: null };
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

/** typescript-lsp has no CLI either: its version comes from the plugin marketplace's own record
 * of what it installed, since that is the only place the version is written down. */
function typescriptLspInstalledVersion(home) {
  const { found, data } = readJsonFile(path.join(home, '.claude', 'plugins', 'installed_plugins.json'));
  if (!found) return { state: 'missing', version: null };
  if (data === undefined) return { state: 'unknown', version: null };
  const entries = data?.plugins?.['typescript-lsp@claude-plugins-official'];
  const version = Array.isArray(entries) ? entries[0]?.version : undefined;
  return version ? { state: 'ok', version } : { state: 'missing', version: null };
}

/** Tools as data: how to probe each one's installed version, its configured state per host, its
 * configured state for the current project, and its own fix command per dimension that can gap
 * (`installed`/`claude`/`codex`/`project`/`upToDate` — a tool omits a dimension it has no meaning
 * for, e.g. context7 has no CLI to `installed`-fix, typescript-lsp has no Codex equivalent). `fix`
 * takes the same `deps` bag as the other probes, since codegraph's `project` fix must carry the
 * actual resolved project root, not a placeholder. Adding a tool never touches
 * `probeTool`/`probeStack` below, the same split `components` uses in manifest.mjs. Commands
 * verified on this machine 2026-09-26 (`codex mcp add --help`, `claude mcp add --help`, `gentle-ai
 * --help`) — see odd/tasks/stack-doctor.md. */
export const tools = [
  {
    id: 'gentle-ai',
    installed: (deps) => probeVersionCommand('gentle-ai', ['version'], deps),
    configured: ({ home }) => ({
      claude: gentleAiInstalledAgent(home, 'claude-code'),
      codex: gentleAiInstalledAgent(home, 'codex'),
    }),
    project: () => 'n/a',
    fix: () => ({
      installed: 'see https://github.com/Gentleman-Programming/gentle-ai',
      claude: 'gentle-ai install',
      codex: 'gentle-ai install',
      upToDate: 'gentle-ai upgrade; gentle-ai sync',
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
    installed: ({ home }) => typescriptLspInstalledVersion(home),
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
    fix: tool.fix(deps),
  };
}

/** Every tool's row, in `tools` order. */
export function probeStack(deps) {
  return tools.map((tool) => probeTool(tool, deps));
}

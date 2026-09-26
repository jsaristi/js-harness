// The stack's tools as data, plus read-only, injectable probes for three of their four states:
// installed (+ version), configured (per host, per project). `outdated` is T2's job — see
// odd/tasks/stack-doctor.md — so every row here carries `upToDate: 'unknown'` for it to fill.
// Every probe takes the same `deps` bag (`home`, `project`, `spawn`, `platform`) so tests can
// fixture a temp home and a fake spawn instead of touching the real one or the network.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SEMVER_RE = /(\d+\.\d+\.\d+)/;

/** Runs `<command> <args>` and extracts the first semver from stdout. Never throws: a missing
 * binary (ENOENT, or any non-zero exit) is `missing`; output with no parseable version is
 * `unknown`. `shell` is needed on win32 because npm-installed global binaries are `.cmd` shims
 * (see how `upgradeMain` in update.mjs spawns `js-harness` itself for the same reason). */
function probeVersionCommand(command, args, { spawn = spawnSync, platform = process.platform } = {}) {
  let result;
  try {
    result = spawn(command, args, { encoding: 'utf8', shell: platform === 'win32' });
  } catch {
    return { state: 'missing', version: null };
  }
  if (!result || result.error || result.status !== 0) return { state: 'missing', version: null };
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
 * `ok`/`missing` on the key plus the raw entry (context7 needs its shape, not just presence). */
function claudeJsonMcpServer(home, name) {
  const { found, data } = readJsonFile(path.join(home, '.claude.json'));
  if (!found) return { state: 'missing', entry: undefined };
  if (data === undefined) return { state: 'unknown', entry: undefined };
  const entry = data?.mcpServers?.[name];
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
 * configured state for the current project, and its own fix commands for a gap. Adding a tool
 * never touches `probeTool`/`probeStack` below, the same split `components` uses in manifest.mjs. */
export const tools = [
  {
    id: 'gentle-ai',
    installed: (deps) => probeVersionCommand('gentle-ai', ['version'], deps),
    configured: ({ home }) => ({
      claude: gentleAiInstalledAgent(home, 'claude-code'),
      codex: gentleAiInstalledAgent(home, 'codex'),
    }),
    project: () => 'n/a',
    fix: ['gentle-ai upgrade', 'gentle-ai sync'],
  },
  {
    id: 'engram',
    installed: (deps) => probeVersionCommand('engram', ['version'], deps),
    configured: ({ home }) => ({
      claude: claudeJsonMcpServer(home, 'engram').state,
      codex: hasCodexMcpServer(home, 'engram') ? 'ok' : 'missing',
    }),
    project: () => 'n/a',
    fix: ['gentle-ai upgrade'],
  },
  {
    id: 'codegraph',
    installed: (deps) => probeVersionCommand('codegraph', ['--version'], deps),
    configured: ({ home }) => ({
      claude: claudeJsonMcpServer(home, 'codegraph').state,
      codex: hasCodexMcpServer(home, 'codegraph') ? 'ok' : 'missing',
    }),
    // Never `codegraph upgrade` (user rule): codegraph's own fix is its npm install.
    project: ({ project }) => (project && fs.existsSync(path.join(project, '.codegraph')) ? 'ok' : 'missing'),
    fix: ['npm i -g @colbymchenry/codegraph', 'gentle-ai codegraph init --cwd <root>'],
  },
  {
    id: 'context7',
    installed: ({ home }) => context7InstalledVersion(home),
    configured: ({ home }) => ({
      claude: claudeJsonMcpServer(home, 'context7').state,
      codex: hasCodexMcpServer(home, 'context7') ? 'ok' : 'missing',
    }),
    project: () => 'n/a',
    fix: ['claude mcp add', 'codex mcp add'],
  },
  {
    id: 'typescript-lsp',
    installed: ({ home }) => typescriptLspInstalledVersion(home),
    configured: ({ home }) => ({
      claude: claudeEnabledPlugin(home, 'typescript-lsp@claude-plugins-official'),
      codex: 'n/a',
    }),
    project: () => 'n/a',
    fix: ['claude plugin update typescript-lsp@claude-plugins-official'],
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
 * project, `upToDate` left `unknown` for T2, and the tool's own fix commands. */
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
    fix: tool.fix,
  };
}

/** Every tool's row, in `tools` order. */
export function probeStack(deps) {
  return tools.map((tool) => probeTool(tool, deps));
}

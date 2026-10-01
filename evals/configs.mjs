// The two Claude Code configurations an eval compares, and the sandbox they both run in. Zero deps,
// plain Node. The runner (`runner.mjs`) knows nothing about Claude: a config is `{ name, command, args,
// env, prepare }`, and everything specific to the CLI lives here.
//
// Both arms run in a sandbox so that a trial can neither read nor write the machine's real Claude Code
// state (transcripts, memory, engram, gentle-ai), and so the arms differ only in the layers under test.
// What the sandbox is made of, and why each part is needed, is in `odd/tasks/evals.md` ("T2 map and
// decisions").
import fs from 'node:fs';
import path from 'node:path';

/** The only variables a trial inherits from the real environment: what a process needs to start on
 * Windows and on POSIX, and the one credential that passes through. Everything else is removed, because
 * the real environment of a developer holds exactly what must not reach a trial: the real home and config
 * directories, `CLAUDE_CODE_CHILD_SESSION` (inherited from a live Claude session, it silently turns
 * transcript saving off, so an isolation check would pass vacuously), `CLAUDE_PLUGIN_DATA`, `ANTHROPIC_*`
 * keys and tool-specific variables. `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`) is the login
 * of the eval run; its value must never be logged. */
export const SANDBOX_ALLOWLIST = [
  'PATH', 'PATHEXT', 'SystemRoot', 'SystemDrive', 'windir', 'ComSpec', 'ProgramData', 'ProgramFiles', 'ProgramFiles(x86)', 'ProgramW6432',
  'CommonProgramFiles', 'CommonProgramFiles(x86)', 'CommonProgramW6432', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE', 'OS', 'COMPUTERNAME',
  'USERNAME', 'USERDOMAIN', 'LANG', 'LC_ALL', 'TZ', 'TERM', 'SHELL', 'USER', 'LOGNAME',
  'CLAUDE_CODE_OAUTH_TOKEN',
];

/** Switches set on both arms: no updater (a mid-run CLI update corrupted a predecessor run), no auto
 * memory (a leaked `MEMORY.md` did too), and no telemetry or reporting from Claude Code, gentle-ai or
 * codegraph. `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is deliberately absent: it also stops feature-flag
 * fetching, which changes behaviour. */
export const SANDBOX_SWITCHES = {
  DISABLE_AUTOUPDATER: '1',
  DISABLE_UPDATES: '1',
  CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
  DISABLE_TELEMETRY: '1',
  DISABLE_ERROR_REPORTING: '1',
  CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: '1',
  DO_NOT_TRACK: '1',
  GENTLE_AI_TELEMETRY: '0',
  CODEGRAPH_TELEMETRY: '0',
  ENABLE_CLAUDEAI_MCP_SERVERS: 'false',
};

/** The variables that point a writer at `home`, with their values. `CLAUDE_CONFIG_DIR` alone is not
 * enough: gentle-ai and codegraph resolve their home from `USERPROFILE`/`HOME`, Claude's MCP logs follow
 * `LOCALAPPDATA`, and scratch files follow `TEMP`, so each of these is moved too. `JS_HARNESS_HOME` and
 * `ENGRAM_DATA_DIR` move the harness cache and the memory store, which would otherwise be the real ones.
 * The values are host paths (`path.join`), whatever platform the env is built for. */
export function sandboxPaths(home) {
  const scratch = path.join(home, 'tmp');
  return {
    USERPROFILE: home,
    HOME: home,
    CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
    APPDATA: path.join(home, 'AppData', 'Roaming'),
    LOCALAPPDATA: path.join(home, 'AppData', 'Local'),
    TEMP: scratch,
    TMP: scratch,
    TMPDIR: scratch,
    XDG_CONFIG_HOME: path.join(home, '.config'),
    XDG_DATA_HOME: path.join(home, '.local', 'share'),
    XDG_STATE_HOME: path.join(home, '.local', 'state'),
    XDG_CACHE_HOME: path.join(home, '.cache'),
    ENGRAM_DATA_DIR: path.join(home, '.engram'),
    JS_HARNESS_HOME: home,
    npm_config_cache: path.join(home, 'npm-cache'),
  };
}

/** `HOMEDRIVE` and `HOMEPATH`, which Windows tools combine into a home directory, derived from `home`
 * (`C:\a\b` is `C:` and `\a\b`). */
function homeDriveAndPath(home) {
  const drive = path.parse(home).root.replace(/[\\/]+$/, '');
  return { HOMEDRIVE: drive, HOMEPATH: home.slice(drive.length) };
}

/** The env overrides for a trial whose home is `home`, in the shape the runner's `childEnv` consumes: a
 * `null` removes a variable. `childEnv` merges over the real environment, so on its own an override only
 * adds; here every inherited name outside the allowlist is mapped to `null`, which makes the child's
 * environment an allowlist all the same. Names compare case-insensitively on Windows (`Path` is `PATH`).
 * Allowlisted names are left out of the result, so the child inherits them as they are, and a path or
 * switch name that the real environment also holds is overridden, not removed. */
export function sandboxEnv({ home, inherited = process.env, platform = process.platform }) {
  if (typeof home !== 'string' || home === '') throw new Error('sandboxEnv needs the trial home directory');
  const fold = (name) => (platform === 'win32' ? name.toLowerCase() : name);
  const allowed = new Set(SANDBOX_ALLOWLIST.map(fold));
  const set = { ...sandboxPaths(home), ...(platform === 'win32' ? homeDriveAndPath(home) : {}), ...SANDBOX_SWITCHES };
  const managed = new Set(Object.keys(set).map(fold));
  const removed = Object.fromEntries(Object.keys(inherited).filter((name) => !allowed.has(fold(name)) && !managed.has(fold(name))).map((name) => [name, null]));
  return { ...removed, ...set };
}

/** Creates the directories the path variables of `sandboxEnv` point at. A `TEMP` that does not exist
 * breaks the tools that write scratch files, so every configuration's `prepare` calls this first. */
export function ensureSandboxDirs(home) {
  for (const dir of new Set(Object.values(sandboxPaths(home)))) fs.mkdirSync(dir, { recursive: true });
}

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

/** The runner config both arms share: the same binary, flags and sandbox, with `extraArgs` after the
 * shared flags and `prepare` as the arm needs. `model` and `permissionMode` are required with no default:
 * the model is part of what the eval measures, and the permission mode decides whether a headless agent
 * can edit files or run tests at all, so a silent default would change every score. `command` is the
 * absolute path of the `claude` binary, spawned directly (no shell, no PATH lookup): a bare name could
 * resolve to another install, or to a `.cmd` shim that cannot be spawned without a shell. `--effort` is
 * the only flag that varies with the trial. Neither arm uses `--bare`: it skips OAuth, so a trial would
 * come back "Not logged in". */
function buildConfig(name, { command, model, permissionMode } = {}, extraArgs, prepare) {
  if (!isNonEmptyString(command)) throw new Error(`${name} config: "command" is required, the absolute path of the claude binary`);
  if (!path.isAbsolute(command)) throw new Error(`${name} config: "command" must be an absolute path, got ${JSON.stringify(command)}: no PATH lookup is made`);
  if (!isNonEmptyString(model)) throw new Error(`${name} config: "model" is required and has no default`);
  if (!isNonEmptyString(permissionMode)) throw new Error(`${name} config: "permissionMode" is required and has no default`);
  return {
    name,
    command,
    args: ({ effort }) => {
      if (!isNonEmptyString(effort)) throw new Error(`${name} config: the trial has no effort`);
      return ['--print', '--output-format', 'json', '--model', model, '--effort', effort, '--permission-mode', permissionMode, ...extraArgs];
    },
    env: ({ home }) => sandboxEnv({ home }),
    prepare,
  };
}

/** The minimal arm: the model and the built-in tools, nothing else. No user settings, no global
 * `CLAUDE.md`, no MCP servers, no hooks, no skills or slash commands. `--setting-sources ""` is the empty
 * string as its own argv element: the flag takes a list and an empty list loads no settings source. */
export function minimalConfig(options) {
  return buildConfig('minimal', options, ['--setting-sources', '', '--strict-mcp-config', '--disable-slash-commands'], ({ home }) => ensureSandboxDirs(home));
}

/** The current arm: the machine's Claude Code setup as it is used daily, so no flag restricts it. The
 * setup itself lives in the trial's home, which `seed({ home, workspace })`, an optional (async) function,
 * fills after the sandbox directories exist; without one the home is as bare as the minimal arm's. The
 * seam is separate because building the home from the real configuration is its own piece of work. */
export function currentConfig({ seed, ...options } = {}) {
  return buildConfig('current', options, [], async ({ home, workspace }) => {
    ensureSandboxDirs(home);
    if (seed) await seed({ home, workspace });
  });
}

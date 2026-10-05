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
import { spawnSync } from 'node:child_process';
import { exists, isWithin, resolveReal } from './paths.mjs';
import { allocatePort as allocateTrialPort, assertTrialPort, killByPort, releasePort as releaseTrialPort } from './ports.mjs';
import { childEnv } from './runner.mjs';

/** The names Claude Code loads as project memory from every ancestor directory of its cwd (`CLAUDE.md`,
 * `CLAUDE.local.md`, `.claude/`), plus `AGENTS.md`, which the harness's own instructions use. A trial
 * workspace that has one of them above it loads it, whatever the arm: the minimal arm would no longer be
 * "the model and the built-in tools, nothing else". */
export const PROJECT_MEMORY_NAMES = ['CLAUDE.md', 'CLAUDE.local.md', 'AGENTS.md', '.claude'];

/** Where trial homes and workspaces go by default: `js-harness-evals-work` next to the repository, not
 * under it and not under the temp folder. The temp folder is no option: on Windows it is inside the
 * user's real home (`C:\Users\<name>\AppData\Local\Temp`), so every workspace there has the real
 * `~/.claude/CLAUDE.md` in an ancestor directory, and the template builder refuses it as being inside the
 * real home. A sibling of the repository has neither problem on this machine (`D:\js-harness-evals-work`);
 * `assertWorkRoot` proves it for any root, rather than trusting the location. */
export function defaultWorkRoot({ repoRoot } = {}) {
  if (typeof repoRoot !== 'string' || !path.isAbsolute(repoRoot)) throw new Error(`defaultWorkRoot needs an absolute repoRoot, got ${JSON.stringify(repoRoot)}`);
  return path.join(path.dirname(path.resolve(repoRoot)), 'js-harness-evals-work');
}

/** Throws unless `root` is a place trials can run without the machine's own setup leaking in:
 *  - absolute, and not the real home or anywhere inside it (resolved through links and compared by path
 *    component, as `buildTemplate` does), because a trial's workspace would then sit in the real home;
 *  - none of `root` and its ancestors up to the filesystem root holds one of `PROJECT_MEMORY_NAMES`, which
 *    Claude Code would load into every trial. The error names the first one found, nearest first.
 * `root` need not exist yet. `exists(path)` is injectable, for a test whose scratch directory has such a
 * file far above it. */
export function assertWorkRoot(root, { realHome, exists: present = exists } = {}) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) throw new Error(`the work root must be an absolute path, got ${JSON.stringify(root)}`);
  if (typeof realHome !== 'string' || !path.isAbsolute(realHome)) throw new Error(`assertWorkRoot needs the realHome, an absolute path, got ${JSON.stringify(realHome)}`);
  const resolved = resolveReal(root);
  if (isWithin(resolveReal(realHome), resolved)) {
    throw new Error(`the work root ${root} is inside the real home ${realHome}: every trial workspace would have the real home above it, and Claude Code loads project memory from every ancestor directory`);
  }
  for (const start of new Set([path.resolve(root), resolved])) {
    for (let dir = start; ; dir = path.dirname(dir)) {
      for (const name of PROJECT_MEMORY_NAMES) {
        const found = path.join(dir, name);
        if (present(found)) throw new Error(`the work root ${root} has ${found} above it (or in it): Claude Code would load it as project memory in every trial, whatever the arm`);
      }
      if (path.dirname(dir) === dir) break;
    }
  }
}

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

/** The env overrides for a trial whose home is `home` and whose engram server listens on `engramPort`, in the
 * shape the runner's `childEnv` consumes: a `null` removes a variable. `childEnv` merges over the real
 * environment, so on its own an override only adds; here every inherited name outside the allowlist is
 * mapped to `null`, which makes the child's environment an allowlist all the same. Names compare
 * case-insensitively on Windows (`Path` is `PATH`). Allowlisted names are left out of the result, so the child
 * inherits them as they are, and a path or switch name that the real environment also holds is overridden,
 * not removed.
 *
 * `engramPort` is required and has no default, because the engram plugin's hooks fall back to port 7437 when
 * they find none, and that is where this machine's real engram server answers. `ENGRAM_URL` and `ENGRAM_SOCKET`
 * are not in the allowlist, so an inherited one is removed and the hooks can only reach `ENGRAM_PORT`.
 *
 * `allowlist`, `switches` and `paths` are Claude Code's by default. Another agent's sandbox (`codex-configs.mjs`)
 * passes its own allowlist and switches, and in `paths` the variables that point at its own home. */
export function sandboxEnv({ home, engramPort, inherited = process.env, platform = process.platform, allowlist = SANDBOX_ALLOWLIST, switches = SANDBOX_SWITCHES, paths = {} }) {
  if (typeof home !== 'string' || home === '') throw new Error('sandboxEnv needs the trial home directory');
  if (!path.isAbsolute(home)) throw new Error(`sandboxEnv needs an absolute home, got ${JSON.stringify(home)}: a child resolves a relative path against its own cwd, the graded workspace`);
  assertTrialPort(engramPort);
  const fold = (name) => (platform === 'win32' ? name.toLowerCase() : name);
  const allowed = new Set(allowlist.map(fold));
  const set = { ...sandboxPaths(home), ...paths, ENGRAM_PORT: String(engramPort), ...(platform === 'win32' ? homeDriveAndPath(home) : {}), ...switches };
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

/** The identity every trial commits under. A sandbox home holds no real git configuration, and a commit
 * without an identity fails, so an agent that commits its work (the current arm's own habit) would get an
 * error that belongs to the sandbox, not to the configuration under test. */
export const GIT_IDENTITY = { name: 'eval', email: 'eval@localhost' };

function git(args, { cwd, env }) {
  const result = spawnSync('git', args, { cwd, env, encoding: 'utf8', windowsHide: true, timeout: 60000 });
  if (result.error || result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed in the sandbox workspace: ${result.error?.message ?? result.stderr.trim()}`);
  }
}

/** What both arms share before an agent starts: the sandbox directories, a `.gitconfig` with the dummy
 * identity, and the workspace as a git repository whose first commit is the fixture, which is what the
 * Design calls "the repo the agent starts in" for either arm. Git runs under the trial's own sandbox env,
 * so it reads the sandbox `.gitconfig` and none of the real shell's git settings (`GIT_CONFIG_GLOBAL`,
 * `GIT_AUTHOR_*` and `GIT_DIR` are all outside the allowlist), and not the system one either. `env` adds
 * variables to those commands (a test points `GIT_CONFIG_SYSTEM` at a hostile file). An empty workspace
 * still gets a commit. */
export function prepareSandbox({ home, workspace, engramPort, env: extra = {} }) {
  if (typeof workspace !== 'string' || !path.isAbsolute(workspace)) {
    throw new Error(`the sandbox needs an absolute workspace, got ${JSON.stringify(workspace)}`);
  }
  assertTrialPort(engramPort);
  ensureSandboxDirs(home);
  fs.writeFileSync(path.join(home, '.gitconfig'), `[user]\n\tname = ${GIT_IDENTITY.name}\n\temail = ${GIT_IDENTITY.email}\n`);
  // GIT_CONFIG_NOSYSTEM goes last, so `extra` cannot lift it. It is set for these commands only and
  // deliberately not in `sandboxEnv`: the fixture commit must not depend on the host's system gitconfig
  // (autocrlf, credential helpers, and at worst `commit.gpgsign` or `core.hooksPath`), but whether the
  // agent's own git should see that file is a separate decision about what the arms are measured under.
  const options = { cwd: workspace, env: childEnv({ ...sandboxEnv({ home, engramPort }), ...extra, GIT_CONFIG_NOSYSTEM: '1' }) };
  git(['init', '--quiet'], options);
  git(['add', '--all'], options);
  git(['commit', '--quiet', '--allow-empty', '--message', 'fixture'], options);
}

/** The runner config both arms share: the same binary, flags and sandbox, with `extraArgs` after the
 * shared flags and `prepare` as the arm needs. `model` and `permissionMode` are required with no default:
 * the model is part of what the eval measures, and the permission mode decides whether a headless agent
 * can edit files or run tests at all, so a silent default would change every score. `command` is the
 * absolute path of the `claude` binary, spawned directly (no shell, no PATH lookup): a bare name could
 * resolve to another install, or to a `.cmd` shim that cannot be spawned without a shell. `--effort` is
 * the only flag that varies with the trial. Neither arm uses `--bare`: it skips OAuth, so a trial would
 * come back "Not logged in".
 *
 * Every trial gets an engram port of its own (see `sandboxEnv` and `sandboxLifecycle`). Both arms get it, so
 * they differ only in the layers under test. `allocatePort`, `releasePort` and `killPort` are injectable, for
 * tests that must not touch real ports or processes. */
function buildConfig(name, { command, model, permissionMode, allocatePort, releasePort, killPort } = {}, extraArgs, seed) {
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
    env: ({ home, prepared }) => sandboxEnv({ home, engramPort: prepared?.engramPort }),
    ...sandboxLifecycle({ allocatePort, releasePort, killPort }, seed),
  };
}

/** The `prepare` and `cleanup` of a sandboxed trial, whatever agent runs in it. `prepare` allocates the trial's
 * engram port and returns it as the trial's prepared state (`{ engramPort }`, which the runner hands to `env` and
 * `cleanup`); `cleanup` kills whatever listens on it, because the engram server a hook starts is detached and
 * nothing else would end it. `seed({ home, workspace, engramPort })`, optional and async, is what an arm adds
 * to its home and workspace after the shared preparation. */
export function sandboxLifecycle({ allocatePort = allocateTrialPort, releasePort = releaseTrialPort, killPort = killByPort } = {}, seed) {
  return {
    // The port first, then the shared preparation, then whatever this arm adds to its home and workspace. A
    // step that fails gives the port back: the trial never starts, so nothing else would.
    prepare: async ({ home, workspace }) => {
      const engramPort = await allocatePort();
      try {
        assertTrialPort(engramPort);
        prepareSandbox({ home, workspace, engramPort });
        if (seed) await seed({ home, workspace, engramPort });
      } catch (err) {
        releasePort(engramPort);
        throw err;
      }
      return { engramPort };
    },
    // After the trial, whatever the agent did: nothing may keep listening on the trial's engram port.
    cleanup: ({ prepared }) => {
      const port = prepared?.engramPort;
      if (port === undefined) return undefined;
      try {
        return killPort(port);
      } finally {
        releasePort(port);
      }
    },
  };
}

/** The minimal arm: the model and the built-in tools, nothing else. No user settings, no global
 * `CLAUDE.md`, no MCP servers, no hooks, no skills or slash commands. `--setting-sources ""` is the empty
 * string as its own argv element: the flag takes a list and an empty list loads no settings source. */
export function minimalConfig(options) {
  return buildConfig('minimal', options, ['--setting-sources', '', '--strict-mcp-config', '--disable-slash-commands']);
}

/** The current arm: the machine's Claude Code setup as it is used daily, so no flag restricts it. The
 * setup itself lives in the trial's home and workspace, which `seed({ home, workspace })`, an optional
 * (async) function, fills after the shared preparation (`prepareSandbox`); without one the home is as bare
 * as the minimal arm's. The seam is separate because building the home from the real configuration is its
 * own piece of work (`home.mjs`). */
export function currentConfig({ seed, ...options } = {}) {
  return buildConfig('current', options, [], seed);
}

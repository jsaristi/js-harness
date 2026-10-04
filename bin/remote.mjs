#!/usr/bin/env node
// `js-harness remote start|stop|status`: keeps Claude Code's `claude remote-control` server running for one git
// repository (the one the folder is in, initialized by js-harness or not), so the Claude app on the phone can start
// a new session that runs on this machine (odd/tasks/remote-control.md). `start` launches a detached supervisor (the hidden `supervise` subcommand, which
// runs `supervise` from `lib/remote.mjs`) and records its pid and creation time under the machine home; `status`
// and `stop` act on that record only when the process with that pid was still created at that time, because
// Windows reuses pids and a bare-pid kill closed unrelated programs on this machine.
import { spawn as spawnChild } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { quoteWindowsArg, windowsCommandLine } from './codex-review.mjs';
import { gitTopLevel } from './lib/project.mjs';
import { identifyProcesses as identifyByPid, killProcesses, selectDescendants, takeSnapshot } from './lib/process-tree.mjs';
import { SPAWN_MODES, cleanServerEnv, resolveClaude as findClaude, serverArgs, supervise } from './lib/remote.mjs';

const SELF = fileURLToPath(import.meta.url);

const USAGE =
  'Usage: js-harness remote start|stop|status [--cwd <path>] [--home <path>]; start also takes [--name <name>] [--permission-mode <mode>] [--spawn same-dir|worktree|session]';

class ArgError extends Error {}

const SUBCOMMANDS = ['start', 'stop', 'status'];
const START_ONLY = ['--name', '--permission-mode', '--spawn'];

/** What cmd.exe would act on in a server name (a `.cmd` CLI gets the name on its command line, and the quoting
 * throws on these inside the supervisor, which would retry forever), and control characters. */
const UNSAFE_NAME = /[&|<>^%"\x00-\x1f\x7f]/;

function parseArgs(argv, env) {
  const [subcommand, ...rest] = argv;
  if (subcommand === undefined) throw new ArgError('a subcommand is required');
  if (!SUBCOMMANDS.includes(subcommand)) throw new ArgError(`unknown subcommand: ${subcommand}`);
  const flags = ['--cwd', '--home', ...(subcommand === 'start' ? START_ONLY : [])];
  const values = {};
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!flags.includes(token)) throw new ArgError(`unknown flag: ${token}`);
    const value = rest[i + 1];
    if (value === undefined || value.startsWith('--')) throw new ArgError(`${token} requires a value`);
    values[token] = value;
    i++;
  }
  const name = values['--name'];
  if (name !== undefined && (name.trim() === '' || UNSAFE_NAME.test(name))) {
    throw new ArgError(`--name ${JSON.stringify(name)} is not a usable name: it must not be blank or hold & | < > ^ % " or control characters`);
  }
  const spawnMode = values['--spawn'];
  if (spawnMode !== undefined && !SPAWN_MODES.includes(spawnMode)) throw new ArgError(`--spawn must be one of ${SPAWN_MODES.join(', ')}`);
  const permissionMode = values['--permission-mode'];
  if (permissionMode !== undefined && !/^[A-Za-z][\w-]*$/.test(permissionMode)) {
    throw new ArgError(`--permission-mode ${JSON.stringify(permissionMode)} is not a mode name`);
  }
  return {
    subcommand,
    cwd: values['--cwd'] ?? process.cwd(),
    home: values['--home'] ?? env.JS_HARNESS_HOME ?? os.homedir(),
    name,
    spawnMode,
    permissionMode,
  };
}

/** A stable, filename-safe id for the project at `root`: its folder name, then a short hash of the absolute path,
 * so two projects never share one. Both are case-folded on Windows, where `D:/a` from git and `d:\A` are one folder. */
export function remoteId(root, platform = process.platform) {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const resolved = paths.resolve(root);
  const absolute = platform === 'win32' ? resolved.toLowerCase() : resolved;
  const slug = paths.basename(absolute).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'project';
  return `${slug}-${createHash('sha256').update(absolute).digest('hex').slice(0, 12)}`;
}

// ---- the server's log ------------------------------------------------------------------------------------------------

const OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
const CSI = /\x1b\[[0-9;?<=>!]*[ -/]*[@-~]/g;
const OTHER_ESCAPE = /\x1b[ -/]*[0-~]?/g;
const CONTROL = /[\x00-\x08\x0b-\x1f\x7f]/g;

/** `text` as lines a person would read: OSC sequences (titles, links) dropped whole, then CSI sequences (colors,
 * cursor moves, erases), then any other escape and control character. A `\r` (a redraw) starts a new line. */
function plainLines(text) {
  return String(text).replace(OSC, '').replace(CSI, '').replace(OTHER_ESCAPE, '').split(/\r\n|\r|\n/).map((line) => line.replace(CONTROL, '').trim());
}

const SUPERVISOR_DOWN = /^\[js-harness remote\] (server exited|server could not start|stopped|could not stop)/;
const CONNECTION = /\b(Connected|Connecting|Reconnecting|Disconnected|Offline)\b/i;
const ENVIRONMENT_URL = /https:\/\/claude\.ai\/code\?environment=[^\s"'<>)]+/;

/** What the last lines of the server's log say: `connection` is `connected` when the latest connection state the
 * server printed is `Connected` and no supervisor line says the server went down after it, `not connected` for
 * any other latest state, `unknown` when there is none; `capacity` is the latest `N/M`; `environmentUrl` the
 * latest address the phone opens. Escape sequences are stripped first: the real server redraws its status. */
export function readServerState(text) {
  const lines = plainLines(text);
  let connection = 'unknown';
  let capacity = null;
  let environmentUrl = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (connection === 'unknown') {
      if (SUPERVISOR_DOWN.test(line)) connection = 'not connected';
      else {
        const match = CONNECTION.exec(line);
        if (match) connection = match[1] === 'Connected' ? 'connected' : 'not connected';
      }
    }
    if (capacity === null) capacity = /Capacity:\s*(\d+\s*\/\s*\d+)/.exec(line)?.[1].replace(/\s/g, '') ?? null;
    if (environmentUrl === null) environmentUrl = ENVIRONMENT_URL.exec(line)?.[0] ?? null;
    if (connection !== 'unknown' && capacity !== null && environmentUrl !== null) break;
  }
  return { connection, capacity, environmentUrl };
}

const LOG_TAIL_BYTES = 64 * 1024;

/** The last `LOG_TAIL_BYTES` of the log (it grows across restarts), or `''` when there is none. */
function logTail(logPath) {
  let fd;
  try {
    fd = fs.openSync(logPath, 'r');
    const size = fs.fstatSync(fd).size;
    const length = Math.min(size, LOG_TAIL_BYTES);
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, size - length);
    return buffer.toString('utf8');
  } catch {
    return '';
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

// ---- the state file and the process it names -------------------------------------------------------------------------

/** The recorded supervisor, or `null` when there is no state file; `{ unreadable: true }` when there is one this
 * command cannot use (it is then stale). */
function readState(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    return { unreadable: true };
  }
  try {
    const state = JSON.parse(text);
    if (Number.isInteger(state?.pid) && Number.isInteger(state?.startedAt)) return state;
  } catch {
    // falls through
  }
  return { unreadable: true };
}

/** Whether the process `state` names is still that process: its pid is running AND was created at the recorded
 * time. A pid alone proves nothing on Windows, which hands it to the next process quickly. */
function isRunning(state, identify) {
  if (!state || state.unreadable) return false;
  return identify([state.pid]).some(({ pid, createdAt }) => pid === state.pid && createdAt === state.startedAt);
}

/** Kills the process `{ pid, createdAt }` and everything it started, from one snapshot, each one through a handle
 * whose start time is checked again (`killProcesses`): nothing whose creation time does not match is touched.
 * Throws when a target is still running afterwards. */
function killByIdentity({ pid, createdAt }) {
  const snapshot = takeSnapshot();
  if (!snapshot.some((entry) => entry.pid === pid && entry.createdAt === createdAt)) return;
  const created = new Map(snapshot.map((entry) => [entry.pid, entry.createdAt]));
  const targets = selectDescendants(snapshot, { pid, createdAt }).map((target) => ({ pid: target, createdAt: created.get(target) }));
  const { running } = killProcesses(targets);
  if (running.length > 0) throw new Error(`still running after the kill: pid ${running.join(', ')}`);
}

// ---- the subcommands -------------------------------------------------------------------------------------------------

/** The top level of the git repository `opts.cwd` is in, or `null` after saying why there is none. Whether
 * js-harness initialized that repository does not matter: nothing here reads `harness.json` or the project
 * manifest, and the first place the command is needed (this repository) has neither. So it asks git for the
 * top level and nothing else (`projectLocation` would spend a second git call finding files it never reads). */
function repositoryRoot(opts, error) {
  if (!fs.existsSync(opts.cwd)) {
    error(`no such directory: ${opts.cwd}`);
    return null;
  }
  const root = gitTopLevel(opts.cwd);
  if (!root) {
    error(`not inside a git repository: ${opts.cwd}; js-harness remote acts on the repository a folder is in (run it inside one, or pass --cwd <path> to one)`);
    return null;
  }
  return root;
}

function reportStatus({ running, state, name, root, logPath }, log) {
  log(running ? `remote: running (supervisor pid ${state.pid}, since ${state.startedAtIso ?? new Date(state.startedAt).toISOString()})` : 'remote: not running');
  log(`name: ${name}`);
  log(`project: ${path.normalize(root)}`);
  log(`log: ${logPath}`);
  if (!running) return;
  const server = readServerState(logTail(logPath));
  log(`server: ${server.connection}`);
  log(`capacity: ${server.capacity ?? 'unknown'}`);
  log(`environment: ${server.environmentUrl ?? 'unknown (not in the log yet)'}`);
}

async function start(opts, context) {
  const { env, deps, log, error, root, files, state, identify } = context;
  if (isRunning(state, identify)) {
    error(`the remote server is already running for ${path.normalize(root)}; js-harness remote stop stops it`);
    reportStatus({ running: true, state, name: state.name ?? path.basename(root), root, logPath: state.logPath ?? files.logPath }, log);
    return 1;
  }
  const name = opts.name ?? path.basename(root);
  if (UNSAFE_NAME.test(name) || name.trim() === '') {
    error(`the folder name ${JSON.stringify(name)} cannot name the server (no & | < > ^ % " or control characters): pass --name <name>`);
    return 1;
  }
  const claude = deps.resolveClaude({ env });
  if (!claude) {
    error("Claude Code's CLI (claude) is not on PATH: install Claude Code, or add the folder that holds claude.exe (or claude.cmd) to PATH, then run this again.");
    return 1;
  }
  const args = serverArgs({ name, spawnMode: opts.spawnMode, permissionMode: opts.permissionMode });
  if (claude.shell) {
    try {
      windowsCommandLine(quoteWindowsArg(claude.path), args);
    } catch (err) {
      error(`${err.message} The CLI at ${claude.path} is a .cmd shim, started through cmd.exe: move it to a folder whose path cmd.exe does not act on.`);
      return 1;
    }
  }

  fs.mkdirSync(path.dirname(files.statePath), { recursive: true });
  const supervisorArgs = [
    SELF, 'supervise', '--root', root, '--name', name, '--log', files.logPath, '--claude', claude.path,
    ...(claude.shell ? ['--shell'] : []),
    ...(opts.permissionMode ? ['--permission-mode', opts.permissionMode] : []),
    ...(opts.spawnMode ? ['--spawn', opts.spawnMode] : []),
  ];
  // Detached, with no console and no inherited stdio, so it outlives this command and opens no window.
  const child = deps.spawn(process.execPath, supervisorArgs, { cwd: root, env, detached: true, stdio: 'ignore', windowsHide: true });
  child.on?.('error', () => {}); // a failed start shows as a missing identity below, not as a crash here
  child.unref();
  // The identity is taken now, while this process still holds the child's handle and its pid cannot be reused.
  const identity = child.pid ? identify([child.pid]).find(({ pid }) => pid === child.pid) : undefined;
  if (!identity) {
    error(`the supervisor exited as soon as it started; its log may say why: ${files.logPath}`);
    return 1;
  }
  const record = { pid: identity.pid, startedAt: identity.createdAt, root, name, logPath: files.logPath, startedAtIso: new Date(identity.createdAt).toISOString() };
  fs.writeFileSync(files.statePath, `${JSON.stringify(record, null, 2)}\n`);
  log(`remote: started "${name}" for ${path.normalize(root)} (supervisor pid ${identity.pid})`);
  log(`log: ${files.logPath}`);
  log(`Sessions can now be started from the Claude app, in the "${name}" environment, once the server connects; js-harness remote status shows when it has.`);
  return 0;
}

function status(context) {
  const { log, root, files, state, identify } = context;
  const running = isRunning(state, identify);
  const known = state && !state.unreadable ? state : {};
  reportStatus({ running, state, name: known.name ?? path.basename(root), root, logPath: known.logPath ?? files.logPath }, log);
  return 0;
}

function stop(context) {
  const { deps, log, error, root, files, state, identify } = context;
  if (!isRunning(state, identify)) {
    if (state) fs.rmSync(files.statePath, { force: true });
    log(`remote: not running for ${path.normalize(root)}${state ? '; removed its stale state file' : ''}`);
    return 0;
  }
  try {
    deps.kill({ pid: state.pid, createdAt: state.startedAt });
  } catch (err) {
    error(`could not stop the remote server (supervisor pid ${state.pid}): ${err.message}`);
    return 1;
  }
  if (isRunning(state, identify)) {
    error(`the supervisor (pid ${state.pid}) is still running after the kill; its state file is kept: ${files.statePath}`);
    return 1;
  }
  fs.rmSync(files.statePath, { force: true });
  log(`remote: stopped for ${path.normalize(root)}`);
  return 0;
}

/** `js-harness remote ...`. `deps`: `spawn` (async), `identifyProcesses(pids)`, `kill({ pid, createdAt })`,
 * `resolveClaude({ env })`, `platform`, `log`, `error`; the defaults are the real ones. */
export async function remoteMain(argv = process.argv.slice(2), env = process.env, deps = {}) {
  const platform = deps.platform ?? process.platform;
  const log = deps.log ?? console.log;
  const error = deps.error ?? console.error;
  const resolved = {
    spawn: deps.spawn ?? spawnChild,
    identifyProcesses: deps.identifyProcesses ?? ((pids) => identifyByPid(pids, { platform })),
    kill: deps.kill ?? killByIdentity,
    resolveClaude: deps.resolveClaude ?? findClaude,
  };
  if (argv[0] === 'supervise') return superviseMain(argv.slice(1), env);

  let opts;
  try {
    opts = parseArgs(argv, env);
  } catch (err) {
    if (!(err instanceof ArgError)) throw err;
    error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const topLevel = repositoryRoot(opts, error);
  if (!topLevel) return 1;
  if (platform !== 'win32') {
    error('js-harness remote runs on Windows only for now: it tells its supervisor from a reused pid by creation time, which it only reads there.');
    return 1;
  }

  const root = path.normalize(topLevel); // git prints `D:/a`; the state file, the log and the cwd use `D:\a`
  const id = remoteId(root, platform);
  const dir = path.join(opts.home, '.js-harness', 'remote');
  const files = { statePath: path.join(dir, `${id}.json`), logPath: path.join(dir, `${id}.log`) };
  const context = { env, deps: resolved, log, error, root, files, state: readState(files.statePath), identify: resolved.identifyProcesses };
  try {
    if (opts.subcommand === 'start') return await start(opts, context);
    if (opts.subcommand === 'stop') return stop(context);
    return status(context);
  } catch (err) {
    error(`js-harness remote ${opts.subcommand}: ${err.message}`);
    return 1;
  }
}

// ---- the hidden supervisor -------------------------------------------------------------------------------------------

/** `remote supervise --root <r> --name <n> --log <file> --claude <path> [--shell] [--permission-mode m]
 * [--spawn mode]`, run by `start` in a detached process: the server in a clean environment until a signal stops
 * it. Its stdio goes nowhere, so a failure is written to the log. */
async function superviseMain(argv, env, signals = process) {
  const values = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--shell') values['--shell'] = true;
    else values[argv[i]] = argv[++i];
  }
  const logPath = values['--log'];
  if (!logPath || !values['--root'] || !values['--name'] || !values['--claude']) return 2;
  const controller = new AbortController();
  const signalNames = ['SIGINT', 'SIGTERM', ...(process.platform === 'win32' ? ['SIGBREAK'] : [])];
  for (const name of signalNames) signals.on(name, () => controller.abort());
  try {
    await supervise({
      claude: { path: values['--claude'], shell: values['--shell'] === true },
      args: serverArgs({ name: values['--name'], spawnMode: values['--spawn'], permissionMode: values['--permission-mode'] }),
      cwd: values['--root'],
      env: cleanServerEnv(env),
      logPath,
      signal: controller.signal,
    });
    return 0;
  } catch (err) {
    try {
      fs.appendFileSync(logPath, `[js-harness remote] supervisor failed: ${err.message}\n`);
    } catch {
      // nowhere left to say it
    }
    return 1;
  }
}

// Run directly as the supervisor (`node bin/remote.mjs supervise ...`); real paths, as in `js-harness.mjs`.
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  remoteMain(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

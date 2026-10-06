#!/usr/bin/env node
// `js-harness remote start|stop|status`: keeps Claude Code's `claude remote-control` server running for one git
// repository (the one the folder is in, initialized by js-harness or not), so the Claude app on the phone can start
// a new session that runs on this machine (odd/tasks/remote-control.md). `start` launches a detached supervisor (the hidden `supervise` subcommand, which
// runs `supervise` from `lib/remote.mjs`) and records its pid and creation time under the machine home; `status`
// and `stop` act on that record only when the process with that pid was still created at that time, because
// Windows reuses pids and a bare-pid kill closed unrelated programs on this machine. A record is the only thing
// that names a supervisor, so whatever does not prove it gone (a look that failed, a file that cannot be read)
// answers `unknown`: nothing is started, killed or deleted, and the human is told what to check. One `start` or
// `stop` runs at a time for a project, under a lock file beside the state file. `start --at-login` also writes a
// launcher in the user's Windows Startup folder, so a login starts the server again; it is recorded in the machine
// manifest as an optional file, and `stop --at-login` and `uninstall` remove exactly that file.
import { spawn as spawnChild } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { quoteWindowsArg, windowsCommandLine } from './codex-review.mjs';
import { forgetOptionalFile, readManifest, recordOptionalFile, sha256 } from './lib/manifest.mjs';
import { gitTopLevel } from './lib/project.mjs';
import { killProcesses, killTree, selectDescendants, takeSnapshot } from './lib/process-tree.mjs';
import { SPAWN_MODES, cleanServerEnv, logNote, loginLauncher, readPersistentEnv, resolveClaude as findClaude, serverArgs, supervise } from './lib/remote.mjs';

const SELF = fileURLToPath(import.meta.url);

const USAGE =
  'Usage: js-harness remote start|stop|status [--cwd <path>] [--home <path>]; start also takes [--name <name>] [--permission-mode <mode>] [--spawn same-dir|worktree|session]; start and stop also take [--at-login] (start writes a launcher in the Windows Startup folder that starts the server at every login, stop removes it)';

class ArgError extends Error {}

const SUBCOMMANDS = ['start', 'stop', 'status'];
const START_ONLY = ['--name', '--permission-mode', '--spawn'];
/** The one flag that takes no value. `status` only reads, so it does not take it. */
const AT_LOGIN = '--at-login';

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
    if (token === AT_LOGIN && subcommand !== 'status') {
      values[token] = true;
      continue;
    }
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
    // Absolute from here on: the supervisor runs in the repository, where a relative home would be another folder.
    home: path.resolve(values['--home'] ?? env.JS_HARNESS_HOME ?? os.homedir()),
    name,
    spawnMode,
    permissionMode,
    atLogin: values[AT_LOGIN] === true,
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

/** The last `LOG_TAIL_BYTES` of the log, or `''` when there is none. The supervisor trims the log in place once
 * it passes its cap (`trimLog`) and keeps sixteen times this much, with the server's latest repaint at its end,
 * so a trimmed log reads as the whole one did. */
export function logTail(logPath) {
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

/** The recorded supervisor, or `null` when there is no state file; `{ unreadable: why }` when there is one this
 * command cannot use. A file that is there was written for a supervisor, and not being able to read it does not
 * prove that supervisor exited: only a missing file says nothing was recorded. */
function readState(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    return { unreadable: `it could not be read (${err.message})` };
  }
  try {
    const state = JSON.parse(text);
    if (Number.isInteger(state?.pid) && Number.isInteger(state?.startedAt)) return state;
    return { unreadable: 'it is not a record of a supervisor: it names no pid and creation time' };
  } catch (err) {
    return { unreadable: `it is not a record of a supervisor (${err.message})` };
  }
}

/** The rows one snapshot has for `pids`: `[{ pid, createdAt }]`, `createdAt` `null` for a process whose creation
 * time Windows does not give: it runs, and nothing says which process it is. A pid with no row is not running.
 * Throws when the snapshot could not be taken. */
function lookUpProcesses(pids, look = takeSnapshot) {
  const wanted = new Set(pids);
  return look().filter((entry) => wanted.has(entry.pid)).map(({ pid, createdAt }) => ({ pid, createdAt }));
}

/** What became of the process `state` records, from one look: `running` when its pid is still the process
 * created at the recorded time; `gone` when nothing has that pid, or what has it was created at another time (a
 * pid alone proves nothing on Windows, which hands it to the next process quickly); `unknown` when a process has
 * the pid and its creation time cannot be read, so it may be the recorded one. Throws when the look failed. */
function whereabouts(state, identify) {
  const entry = identify([state.pid]).find(({ pid }) => pid === state.pid);
  if (!entry) return 'gone';
  if (entry.createdAt === state.startedAt) return 'running';
  return Number.isInteger(entry.createdAt) ? 'gone' : 'unknown';
}

/** `whereabouts` for every subcommand, as `{ found, why }`: no state file means nothing was recorded (`gone`); a
 * state file that cannot be used, and a look that failed, count as `unknown`, and `why` then says what could not
 * be told. Only `gone` lets a subcommand act as if nothing were running. */
function locate(state, identify) {
  if (!state) return { found: 'gone' };
  if (state.unreadable) return { found: 'unknown', why: `its state file is there and ${state.unreadable}, so a supervisor may be running that nothing else names` };
  try {
    const found = whereabouts(state, identify);
    return { found, why: found === 'unknown' ? `a process has pid ${state.pid} and its creation time could not be read, so it may be the recorded supervisor or another program` : undefined };
  } catch (err) {
    return { found: 'unknown', why: `the processes could not be listed (${err.message}), so the supervisor recorded as pid ${state.pid} may still be running` };
  }
}

/** How every answer of `unknown` ends. Running the command again does not help with a record that stays unknown
 * (a reused pid whose creation time cannot be read, a file that cannot be parsed), and the harness does not
 * delete what may be the only thing that names a running supervisor: it says what it knows, and the human decides. */
function wayOut(state, files) {
  const recorded = state.unreadable ? '' : ` (recorded as pid ${state.pid})`;
  return `Its state file is kept: ${files.statePath}. If that does not change, once you have checked that no such supervisor is running${recorded}, that file may be removed by hand.`;
}

/** How many looks a stop takes for what the supervisor left before it gives up: each one kills what it finds, and
 * only a process started between a look and its kill needs another. */
const SWEEP_LOOKS = 5;

/** Stops the supervisor `{ pid, createdAt }` and everything it started, and returns only once a fresh look finds
 * nothing of that tree. Three steps, each by pid and creation time (`killProcesses`):
 *  - the tree is read while the supervisor lives. Node ends its own children when it dies (measured here on
 *    2026-10-04: the `cmd.exe` of a `.cmd` CLI went with the supervisor, the server under it did not), and what
 *    those had started is then left with a parent that is in no later snapshot, so it has to be known first;
 *  - the supervisor alone is killed, before anything else: that tree is already old when a kill runs, and a
 *    supervisor whose backoff ends in between launches a server that is in no list of targets. Dead, it launches
 *    nothing;
 *  - what was read is killed, and then every look searches for what any of the killed left behind, as the
 *    children of an exited parent (the processes that record its pid and were created within its life, and
 *    theirs: `selectDescendants`), and kills it, until a look finds none.
 * Throws, naming the pids, when something is still running, when a look fails, and when processes keep appearing.
 * Not covered: a server the supervisor launches after the first look, which dies with it, having started something
 * in those instants; nothing a snapshot holds ties that orphan to this tree.
 *
 * Two things a look can show stop it short of a kill, because nothing here is killed on a guess:
 *  - the supervisor is a live root only in a snapshot that shows its pid with the recorded creation time. It can
 *    exit, and its pid go to another program, after the caller checked it: `selectDescendants` trusts the root it
 *    is handed, and would select that program's children. Without that row the answer is `gone` and nothing is
 *    selected; with the pid and no creation time it throws an error marked `unknown`;
 *  - a process with no creation time that records a process of the tree as its parent may belong to it, and
 *    cannot be killed by identity, nor can what is under it be reached. In the first look that is a refusal,
 *    before any kill, so the record still names a live supervisor; in a later one the stop is not complete.
 * Returns `stopped`, or `gone` when the supervisor was not there to stop. */
function stopSupervisorTree({ pid, createdAt }, { look = takeSnapshot, kill = killProcesses } = {}) {
  const alive = look();
  const root = alive.find((entry) => entry.pid === pid);
  if (!root || (Number.isInteger(root.createdAt) && root.createdAt !== createdAt)) return 'gone';
  if (root.createdAt !== createdAt) {
    throw Object.assign(new Error(`a process has pid ${pid} and its creation time could not be read in the look its tree is read from, so it may be the recorded supervisor or another program`), { unknown: true });
  }
  const tree = selectDescendants(alive, { pid, createdAt });
  const unreadable = unidentifiedUnder(alive, tree);
  if (unreadable.length > 0) {
    throw new Error(`Windows gives no creation time for pid ${unreadable.join(', ')}, which may be part of its tree, and nothing is killed by a pid alone; nothing was killed, and the supervisor still runs. Run js-harness remote stop again, or end them by hand`);
  }
  const createdThen = new Map(alive.map((entry) => [entry.pid, entry.createdAt]));
  let targets = tree.filter((target) => target !== pid).map((target) => ({ pid: target, createdAt: createdThen.get(target) }));
  let unidentified = [];
  if (kill([{ pid, createdAt }]).running.length > 0) throw new Error(`still running after the kill: pid ${pid}`);
  // From here the supervisor is gone, and a later stop would find only that: what is left is named for the human.
  const orphans = (what) => `the supervisor (pid ${pid}) is stopped, but ${what}; end what is left by hand, because js-harness remote stop finds a tree through its supervisor, and that one is gone`;
  const exited = [{ pid, startedAt: createdAt, exitedAt: Date.now() }];
  for (let looks = 0; ; looks++) {
    if (targets.length > 0) {
      const { running } = kill(targets);
      if (running.length > 0) throw new Error(orphans(`processes it started are still running: pid ${running.join(', ')}`));
      const exitedAt = Date.now();
      exited.push(...targets.map((target) => ({ pid: target.pid, startedAt: target.createdAt, exitedAt })));
    }
    if (unidentified.length > 0) {
      throw new Error(orphans(`Windows gives no creation time for pid ${unidentified.join(', ')}, which may be part of its tree and could not be killed by identity`));
    }
    if (looks === SWEEP_LOOKS) {
      throw new Error(orphans(`processes kept appearing under it; the last look found pid ${targets.map((target) => target.pid).join(', ')}, which were killed, and more may have followed`));
    }
    let snapshot;
    try {
      snapshot = look();
    } catch (err) {
      throw new Error(orphans(`what it started could not be listed (${err.message})`));
    }
    const created = new Map(snapshot.map((entry) => [entry.pid, entry.createdAt]));
    const found = [...new Set(exited.flatMap((gone) => selectDescendants(snapshot, gone)))];
    targets = found.map((target) => ({ pid: target, createdAt: created.get(target) }));
    unidentified = unidentifiedUnder(snapshot, [...exited.map((gone) => gone.pid), ...found]);
    if (targets.length === 0 && unidentified.length === 0) return 'stopped';
  }
}

/** The pids of `snapshot` that record one of `parents` as their parent and have no creation time: each may be a
 * child of that process or an older program that records a reused pid, and nothing tells which. */
function unidentifiedUnder(snapshot, parents) {
  const under = new Set(parents);
  return snapshot.filter((entry) => under.has(entry.ppid) && !Number.isInteger(entry.createdAt)).map((entry) => entry.pid);
}

// ---- one start or stop at a time for a project -----------------------------------------------------------------------

/** Who holds the lock file: `{ found, pid, text, why }`. `gone` when the file is not there any more, or the
 * process it names is proven not to run (its owner died without releasing it: the lock is free); `running` when
 * that process still runs; `unknown` when the file does not name its owner or the look cannot tell. */
function lockHolder(lockPath, identify) {
  let text;
  try {
    text = fs.readFileSync(lockPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { found: 'gone' };
    return { found: 'unknown', why: `the lock file could not be read (${err.message})` };
  }
  let owner;
  try {
    owner = JSON.parse(text);
  } catch {
    owner = null;
  }
  if (!Number.isInteger(owner?.pid) || !Number.isInteger(owner?.createdAt)) {
    return { found: 'unknown', why: 'the lock file does not name its owner (a start or stop may be writing it right now, or one died while it did)' };
  }
  try {
    const found = whereabouts({ pid: owner.pid, startedAt: owner.createdAt }, identify);
    return { found, pid: owner.pid, text, why: found === 'unknown' ? `the lock names pid ${owner.pid}, and the creation time of the process that has that pid could not be read` : undefined };
  } catch (err) {
    return { found: 'unknown', why: `the processes could not be listed (${err.message}), so the owner of the lock (pid ${owner.pid}) may still be running` };
  }
}

/** Takes the lock `start` and `stop` share for one project: `{ release }`, or `{ refusal }` saying why it is not
 * to be had (`undone` is what the caller then did not do: `started`, `stopped`). Both read the state file and
 * act on what it says, and the two must not interleave: two starts would both read "nothing recorded" and both
 * launch, the second to write leaving the first supervisor with no record; a start between a stop's kill and its
 * removal of the record would record a replacement that the stop then deletes. So the lock is taken before the
 * state is read and held until the record is written, removed or kept. It is a file created with `wx` (it fails
 * when the file exists) that names its owner by pid and creation time, so that a lock left by a command that died
 * does not block for good: an owner proven gone frees it. An owner that cannot be identified does not, and the
 * human is told the file may be removed. Taking a stale lock over is not atomic (the file is read again just
 * before it is removed): two commands that both find the same stale lock in the same instant can still both
 * take it.
 *
 * `release()` removes the file only while it still names this command, and never throws: the command's result
 * stands whatever becomes of the lock. It returns what to tell the human when the file could not be removed. */
function takeLock({ lockPath, root, identify, undone, removeFile }) {
  const where = path.normalize(root);
  let own;
  try {
    own = identify([process.pid]).find(({ pid }) => pid === process.pid);
  } catch (err) {
    return { refusal: `cannot take the lock for ${where}: this command's own process could not be identified (${err.message}). Nothing was ${undone}.` };
  }
  if (!Number.isInteger(own?.createdAt)) {
    return { refusal: `cannot take the lock for ${where}: this command's own creation time could not be read, and a pid alone would not name the owner of the lock. Nothing was ${undone}.` };
  }
  const mine = `${JSON.stringify({ pid: own.pid, createdAt: own.createdAt })}\n`;
  const busy = (holder) => `another js-harness remote start or stop is in progress for ${where} (${holder} the lock ${lockPath}). Nothing was ${undone}; run it again once that one has finished.`;
  const release = () => {
    try {
      if (fs.readFileSync(lockPath, 'utf8') === mine) removeFile(lockPath);
    } catch (err) {
      if (err.code !== 'ENOENT') return `the lock file could not be removed (${err.message}); it may be removed by hand: ${lockPath}`;
    }
    return undefined;
  };
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(lockPath, mine, { flag: 'wx' });
      return { release };
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
    const holder = lockHolder(lockPath, identify);
    if (holder.found === 'running') return { refusal: busy(`pid ${holder.pid} holds`) };
    if (holder.found === 'unknown') {
      return { refusal: `cannot tell whether another js-harness remote start or stop is in progress for ${where}: ${holder.why}. Nothing was ${undone}. Once you have checked that no js-harness remote start or stop is running, the lock file may be removed by hand: ${lockPath}` };
    }
    try {
      if (holder.text !== undefined && fs.readFileSync(lockPath, 'utf8') === holder.text) fs.rmSync(lockPath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err; // released, or taken over, in the meantime: the next attempt says which
    }
  }
  return { refusal: busy('one just took') };
}

/** How long a supervisor that was just killed is given for its exit to reach this process. */
const EXIT_WAIT_MS = 10000;

/** Whether `child` has exited, waiting up to `ms` for the exit to be reported: its handle knows, whatever became
 * of its pid. */
function exitedWithin(child, ms) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve(true);
      return;
    }
    const exited = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      child.removeListener('exit', exited);
      resolve(false);
    }, ms);
    child.once('exit', exited);
  });
}

/** Stops the supervisor `start` spawned and could not record, with everything it started: `killTree`, from the
 * handle `start` still holds and the time taken just before the spawn. `killTree` takes a root the snapshot
 * cannot identify for one that exited, and then kills only what it left behind, so the handle is asked
 * afterwards. Throws when the supervisor could not be killed, or has not exited. */
async function stopSpawnedSupervisor(child, lifetime) {
  killTree(child, lifetime);
  if (child.pid && !(await exitedWithin(child, EXIT_WAIT_MS))) throw new Error('it has not exited, and nothing identifies it for a kill');
}

// ---- the login launcher ----------------------------------------------------------------------------------------------

const isDirectory = (dir) => {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
};

/** Whether two paths name one folder on Windows, which does not tell `C:\Users\X` from `c:\users\x`. */
const sameFolder = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

/** Where the login launcher of the project `id` goes: `{ dir, file }`, the user's Startup folder (what Windows
 * runs at every login) and the launcher in it, from the `APPDATA` of `env` and nothing else; `{ why }` when `env`
 * has none. Nothing is created: that folder is Windows's to make. */
function launcherLocation(env, id) {
  const key = Object.keys(env).find((name) => /^appdata$/i.test(name));
  const appData = key === undefined ? '' : String(env[key]).trim();
  if (appData === '') return { why: 'APPDATA is not set, so the Windows Startup folder cannot be found' };
  const dir = path.resolve(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  return { dir, file: path.join(dir, `js-harness-remote-${id}.cmd`) };
}

/** What is at the launcher's path and what the machine manifest records for it: `{ bytes, record, ours }`.
 * `bytes` is `null` when no file is there; `ours` says the file is, byte for byte, what js-harness recorded
 * writing: the only launcher it replaces or removes. Throws when the file or the manifest cannot be read, since
 * neither answer is then known. */
function lookAtLauncher(home, file) {
  let bytes = null;
  try {
    bytes = fs.readFileSync(file);
  } catch (err) {
    if (err.code !== 'ENOENT') throw new Error(`what is at ${file} could not be read (${err.message})`);
  }
  let record;
  try {
    record = readManifest(home)?.optional?.find((entry) => entry.path === file);
  } catch (err) {
    throw new Error(`the machine manifest under ${home} could not be read (${err.message})`);
  }
  return { bytes, record, ours: bytes !== null && record !== undefined && sha256(bytes) === record.sha256 };
}

/** `start --at-login`: writes the launcher and records it in the machine manifest as an optional file, so that
 * `stop --at-login` and `uninstall` remove exactly it. Returns `true` with the launcher on, and `false` after
 * saying why it is not, with nothing of this command's left behind. Validated before anything is written: that
 * `APPDATA` gives a Startup folder that exists, and that no value the launcher holds (the node executable, this
 * install, the project folder, the name, the modes, the home) has what cmd.exe acts on (`loginLauncher`); the
 * caller has already refused a name the server cannot take. A file already at the path is left alone when it has
 * the very content, replaced when it is one js-harness recorded writing (an earlier start with other options),
 * and refused otherwise: it is the user's, or one they edited. A launcher that no record names would outlive
 * every uninstall, so when the file cannot be recorded what was there before is put back: a file this command
 * created is removed again, and one it replaced gets its earlier bytes, which its record still names. */
function enableLauncher(opts, name, { env, deps, log, error, root, id, home }) {
  const refuse = (why) => {
    error(`the login launcher was not written: ${why}. Nothing was started.`);
    return false;
  };
  const where = launcherLocation(env, id);
  if (where.why) return refuse(where.why);
  if (!isDirectory(where.dir)) return refuse(`the Windows Startup folder does not exist (${where.dir}), and js-harness does not create it`);
  let content;
  let found;
  try {
    // At login the command finds the user's own home by itself; any other home has to be named.
    const text = loginLauncher({
      node: deps.execPath, script: SELF, root, name, permissionMode: opts.permissionMode, spawnMode: opts.spawnMode,
      home: sameFolder(home, deps.homedir()) ? undefined : home,
    });
    content = Buffer.from(text, 'utf8');
    found = lookAtLauncher(home, where.file);
  } catch (err) {
    return refuse(err.message);
  }
  const same = found.bytes !== null && found.bytes.equals(content);
  if (found.bytes !== null && !same && !found.ours) {
    const what = found.record ? `the launcher at ${where.file} was changed since js-harness wrote it` : `a file js-harness did not write is at ${where.file}`;
    return refuse(`${what}, and is left as it is; remove it by hand, then run this again`);
  }
  if (!(same && found.ours)) {
    try {
      // `wx` for a new file: one that appeared since the look above is not this command's to overwrite.
      if (!same) fs.writeFileSync(where.file, content, { flag: found.bytes === null ? 'wx' : 'w' });
    } catch (err) {
      return refuse(`${where.file} could not be written (${err.message})`);
    }
    try {
      deps.recordOptionalFile(home, where.file, content);
    } catch (err) {
      const unrecorded = `it could not be recorded in the machine manifest (${err.message})`;
      if (same) return refuse(`${unrecorded}; the file at ${where.file} was there before this command, and is left`);
      if (found.bytes === null) {
        try {
          fs.rmSync(where.file, { force: true });
        } catch (left) {
          return refuse(`${unrecorded}, and the file written could not be removed again (${left.message}): remove ${where.file} by hand`);
        }
        return refuse(`${unrecorded}, so the file written was removed again`);
      }
      try {
        fs.writeFileSync(where.file, found.bytes);
      } catch (left) {
        return refuse(`${unrecorded}, and the earlier launcher could not be put back (${left.message}): what is at ${where.file} is no longer what its record names, so neither js-harness remote stop --at-login nor uninstall removes it; remove it by hand`);
      }
      return refuse(`${unrecorded}, so the earlier launcher was put back: ${where.file} and its record are as they were`);
    }
  }
  log(`login launcher: on (${where.file})`);
  return true;
}

/** `stop --at-login`: removes the launcher and its record. Returns `true` with the launcher off (removed, or not
 * there: a record whose file is gone is forgotten), and `false` after saying why a file is kept: only one that is
 * still what js-harness recorded writing is removed. The file goes before its record, so a failure in between
 * leaves a record of a file that is gone, never a launcher that no record names. */
function disableLauncher({ env, deps, log, error, id, home }) {
  const where = launcherLocation(env, id);
  if (where.why) {
    error(`the login launcher could not be looked for: ${where.why}.`);
    return false;
  }
  let found;
  try {
    found = lookAtLauncher(home, where.file);
  } catch (err) {
    error(`the login launcher could not be looked for: ${err.message}.`);
    return false;
  }
  const there = found.bytes !== null;
  if (there && !found.ours) {
    error(found.record
      ? `the login launcher at ${where.file} was changed since js-harness wrote it, so it is kept: remove it by hand, then run js-harness remote stop --at-login again to forget its record.`
      : `the file at ${where.file} is not one js-harness recorded writing, so it is kept: remove it by hand if it is not wanted.`);
    return false;
  }
  try {
    if (there) fs.rmSync(where.file);
  } catch (err) {
    error(`the login launcher at ${where.file} could not be removed (${err.message}); it is kept, and still recorded.`);
    return false;
  }
  try {
    if (found.record) deps.forgetOptionalFile(home, where.file);
  } catch (err) {
    error(`the login launcher ${there ? 'was removed' : 'was already gone'}, but its record in the machine manifest could not be (${err.message}); run js-harness remote stop --at-login again.`);
    return false;
  }
  if (there) log(`login launcher: off (removed ${where.file})`);
  else log(`login launcher: off (${found.record ? 'its file was already gone, and its record was removed' : 'there was none'})`);
  return true;
}

/** The line `status` adds: `on` when the launcher file is there and the machine manifest records it. */
function launcherLine({ env, id, home }) {
  const where = launcherLocation(env, id);
  if (where.why) return `login launcher: unknown (${where.why})`;
  let found;
  try {
    found = lookAtLauncher(home, where.file);
  } catch (err) {
    return `login launcher: unknown (${err.message})`;
  }
  if (found.bytes !== null && found.record) return `login launcher: on (${where.file}${found.ours ? '' : ', changed since js-harness wrote it'})`;
  if (found.bytes !== null) return `login launcher: off (a file js-harness did not record is at ${where.file})`;
  return `login launcher: off${found.record ? ` (recorded, but its file is gone: ${where.file})` : ''}`;
}

// ---- the subcommands -------------------------------------------------------------------------------------------------

/** The top level of the git repository `opts.cwd` is in, or `null` after saying why there is none. Whether
 * js-harness initialized that repository does not matter: nothing here reads `harness.json` or the project
 * manifest, and the first place the command is needed (this repository) has neither. So it asks git for the
 * top level and nothing else (`projectLocation` would spend a second git call finding files it never reads). */
function repositoryRoot(opts, error, topLevel = gitTopLevel) {
  if (!fs.existsSync(opts.cwd)) {
    error(`no such directory: ${opts.cwd}`);
    return null;
  }
  const root = topLevel(opts.cwd);
  if (!root) {
    error(`not inside a git repository: ${opts.cwd}; js-harness remote acts on the repository a folder is in (run it inside one, or pass --cwd <path> to one)`);
    return null;
  }
  return root;
}

/** `found` is what `locate` answered. The server's state is read from the log only for a supervisor known to run:
 * the last lines of a log say nothing about a process that may be gone. */
function reportStatus({ found, state, name, root, logPath }, log) {
  if (found === 'running') log(`remote: running (supervisor pid ${state.pid}, since ${state.startedAtIso ?? new Date(state.startedAt).toISOString()})`);
  else if (found !== 'unknown') log('remote: not running');
  else if (state.unreadable) log('remote: unknown (its state file cannot be used, so whether a supervisor runs could not be told)');
  else log(`remote: unknown (a supervisor is recorded as pid ${state.pid}, and whether it still runs could not be told)`);
  log(`name: ${name}`);
  log(`project: ${path.normalize(root)}`);
  log(`log: ${logPath}`);
  if (found !== 'running') return;
  const server = readServerState(logTail(logPath));
  log(`server: ${server.connection}`);
  log(`capacity: ${server.capacity ?? 'unknown'}`);
  log(`environment: ${server.environmentUrl ?? 'unknown (not in the log yet)'}`);
}

/** With `--at-login` the launcher comes before the server, and after everything `start` refuses on its own input:
 * the name, which is the folder's unless `--name` gives one (the flags were checked when they were parsed, and
 * `enableLauncher` checks what the launcher holds before it writes). So a start that refuses on what it was asked
 * writes no launcher, and no login repeats it. What depends on the machine's state comes after the launcher and
 * leaves it on: a `claude` that is not on PATH, a `.cmd` CLI in a folder cmd.exe acts on, a recorded supervisor
 * that cannot be told from another program. Those can be put right before a later login, and the command says
 * both that the launcher is on and why nothing was started. A server that already runs is not an error with
 * `--at-login`: the launcher was what was asked for, and the server is left as it is.
 *
 * Without `--at-login` the order is the one it always was: the name is checked after the recorded supervisor. */
async function start(opts, context) {
  const { env, deps, log, error, root, files, state, identify } = context;
  const name = opts.name ?? path.basename(root);
  const unusableName = UNSAFE_NAME.test(name) || name.trim() === '';
  const refuseName = () => {
    error(`the folder name ${JSON.stringify(name)} cannot name the server (no & | < > ^ % " or control characters): pass --name <name>`);
    return 1;
  };
  if (opts.atLogin) {
    if (unusableName) return refuseName();
    if (!enableLauncher(opts, name, context)) return 1;
  }
  // Only a record whose process is proven gone is replaced: a second supervisor beside one that still runs would
  // take over the state file, and nothing would name the first any more.
  const recorded = locate(state, identify);
  if (recorded.found === 'running') {
    const running = () => reportStatus({ found: 'running', state, name: state.name ?? path.basename(root), root, logPath: state.logPath ?? files.logPath }, log);
    if (opts.atLogin) {
      log(`remote: already running for ${path.normalize(root)}, and left as it is: the launcher's options apply from the next login`);
      running();
      return 0;
    }
    error(`the remote server is already running for ${path.normalize(root)}; js-harness remote stop stops it`);
    running();
    return 1;
  }
  if (recorded.found === 'unknown') {
    error(`cannot tell whether the remote server is already running for ${path.normalize(root)}: ${recorded.why}. Nothing was started; run js-harness remote status or js-harness remote stop to look again. ${wayOut(state, files)}`);
    return 1;
  }
  if (unusableName) return refuseName();
  const found = deps.resolveClaude({ env });
  if (!found) {
    error("Claude Code's CLI (claude) is not on PATH: install Claude Code, or add the folder that holds claude.exe (or claude.cmd) to PATH, then run this again.");
    return 1;
  }
  // A PATH entry may be relative, and was resolved here: the supervisor, which runs elsewhere, is handed where it is.
  const claude = { ...found, path: path.resolve(found.path) };
  const args = serverArgs({ name, spawnMode: opts.spawnMode, permissionMode: opts.permissionMode });
  if (claude.shell) {
    try {
      windowsCommandLine(quoteWindowsArg(claude.path), args);
    } catch (err) {
      error(`${err.message} The CLI at ${claude.path} is a .cmd shim, started through cmd.exe: move it to a folder whose path cmd.exe does not act on.`);
      return 1;
    }
  }

  const supervisorArgs = [
    SELF, 'supervise', '--root', root, '--name', name, '--log', files.logPath, '--claude', claude.path,
    ...(claude.shell ? ['--shell'] : []),
    ...(opts.permissionMode ? ['--permission-mode', opts.permissionMode] : []),
    ...(opts.spawnMode ? ['--spawn', opts.spawnMode] : []),
  ];
  const spawnedAt = Date.now(); // just before the spawn: what finds the supervisor's tree, should it have to be stopped
  // Detached, with no console and no inherited stdio, so it outlives this command and opens no window.
  const child = deps.spawn(process.execPath, supervisorArgs, { cwd: root, env, detached: true, stdio: 'ignore', windowsHide: true });
  child.on?.('error', () => {}); // a failed start shows as a missing identity below, not as a crash here
  child.unref();
  // From here a supervisor may be running that no state file names: `stop` and `status` would never find it, and
  // it would keep a server up for good. So every way out of this function either records it or stops it.
  let failure;
  try {
    // The identity is taken now, while this process still holds the child's handle and its pid cannot be reused.
    const identity = child.pid ? identify([child.pid]).find(({ pid }) => pid === child.pid) : undefined;
    if (!identity) failure = 'the supervisor exited as soon as it started';
    else if (!Number.isInteger(identity.createdAt)) failure = `the supervisor started (pid ${child.pid}), but its creation time could not be read, and a pid alone does not name it`;
    else {
      const record = { pid: identity.pid, startedAt: identity.createdAt, root, name, logPath: files.logPath, startedAtIso: new Date(identity.createdAt).toISOString() };
      fs.writeFileSync(files.statePath, `${JSON.stringify(record, null, 2)}\n`);
    }
  } catch (err) {
    failure = `the supervisor started (pid ${child.pid}), but it could not be recorded: ${err.message}`;
  }
  if (failure === undefined) {
    log(`remote: started "${name}" for ${path.normalize(root)} (supervisor pid ${child.pid})`);
    log(`log: ${files.logPath}`);
    log(`Sessions can now be started from the Claude app, in the "${name}" environment, once the server connects; js-harness remote status shows when it has.`);
    return 0;
  }
  try {
    await deps.stopSpawned(child, { startedAt: spawnedAt });
  } catch (err) {
    error(`${failure}. It could not be stopped either (${err.message}): pid ${child.pid} may still be running with no state file naming it, so js-harness remote stop will not find it; end that process by hand. Its log: ${files.logPath}`);
    return 1;
  }
  error(`${failure}. Nothing is left running: what it had started was stopped. Its log may say why: ${files.logPath}`);
  return 1;
}

/** Exits 0 for `running` and for `not running`, both of which it knows; non-zero when it cannot tell, so that a
 * script never reads "could not look" as "stopped". It never touches the state file. */
function status(context) {
  const { log, error, root, files, state, identify } = context;
  const { found, why } = locate(state, identify);
  const known = state && !state.unreadable ? state : {};
  reportStatus({ found, state, name: known.name ?? path.basename(root), root, logPath: known.logPath ?? files.logPath }, log);
  log(launcherLine(context));
  if (found !== 'unknown') return 0;
  error(`cannot tell whether the remote server is running for ${path.normalize(root)}: ${why}. ${wayOut(state, files)}`);
  return 1;
}

/** The state file is the only thing that names the supervisor, so it is removed only when that process is proven
 * gone: its whole tree stopped (`deps.kill`, which looks again until nothing of it is left) and the supervisor then
 * not found, or the supervisor absent from a snapshot (no such pid, or a pid created at another time). When that
 * cannot be told, nothing is killed and the file is kept; when the stop fails, the file is kept too. */
function stop(context) {
  const { deps, log, error, root, files, state, identify } = context;
  const before = locate(state, identify);
  if (before.found === 'unknown') {
    error(`cannot tell whether the remote server is running for ${path.normalize(root)}: ${before.why}. Nothing was killed. ${wayOut(state, files)}`);
    return 1;
  }
  let stopped = false;
  if (before.found === 'running') {
    try {
      // `gone`: the supervisor exited between the look above and the one its tree is read from; nothing was killed.
      stopped = deps.kill({ pid: state.pid, createdAt: state.startedAt }) !== 'gone';
    } catch (err) {
      if (err.unknown) error(`cannot tell whether the remote server is running for ${path.normalize(root)}: ${err.message}. Nothing was killed. ${wayOut(state, files)}`);
      else error(`could not stop the remote server (supervisor pid ${state.pid}): ${err.message}. Its state file is kept: ${files.statePath}`);
      return 1;
    }
    const after = locate(state, identify);
    if (after.found === 'running') {
      error(`the supervisor (pid ${state.pid}) is still running after the kill; its state file is kept: ${files.statePath}`);
      return 1;
    }
    if (after.found === 'unknown') {
      error(`the supervisor (pid ${state.pid}) was killed, but that could not be confirmed: ${after.why}. ${wayOut(state, files)}`);
      return 1;
    }
  }
  if (state) {
    const replaced = removeRecord(files.statePath, state);
    if (replaced) {
      error(`${stopped ? `the supervisor (pid ${state.pid}) was stopped, but the` : 'the'} state file no longer holds the record this stop read: ${replaced}. It is kept: ${files.statePath}; js-harness remote status says what it names now.`);
      return 1;
    }
  }
  if (stopped) log(`remote: stopped for ${path.normalize(root)}`);
  else log(`remote: not running for ${path.normalize(root)}${state ? '; removed its stale state file' : ''}`);
  return 0;
}

/** Removes the state file while it still holds the record `state`, the one this stop read and acted on. The lock
 * keeps a start from writing another meanwhile; this is the second guard, for a record that got there some other
 * way: it names another supervisor, and is not this stop's to delete. Returns what the file holds instead. */
function removeRecord(statePath, state) {
  const now = readState(statePath);
  if (now === null) return undefined;
  if (now.unreadable) return `it is there and ${now.unreadable}`;
  if (now.pid !== state.pid || now.startedAt !== state.startedAt) return `it records a supervisor as pid ${now.pid}`;
  fs.rmSync(statePath, { force: true });
  return undefined;
}

/** `js-harness remote ...`. `deps`: `spawn` (async), `takeSnapshot()` and `killProcesses(targets)` (those of
 * `process-tree.mjs`), `identifyProcesses(pids)` (`lookUpProcesses`) and `kill({ pid, createdAt })`
 * (`stopSupervisorTree`), both built on the two before unless given, `stopSpawned(child, { startedAt })`,
 * `resolveClaude({ env })`, `removeFile(path)` (what releases the lock), `gitTopLevel(cwd)` (that of
 * `project.mjs`: the repository's top level, or nothing), `platform`, `log`, `error`, for the login
 * launcher `execPath` (the node it runs), `homedir()`, `recordOptionalFile` and `forgetOptionalFile` (those of
 * `manifest.mjs`), and for the hidden supervisor `readPersistentEnv()`, `supervise(options)` and `signals`; the
 * defaults are the real ones. The launcher's folder comes from the `APPDATA` of `env`, never from anywhere else. */
export async function remoteMain(argv = process.argv.slice(2), env = process.env, deps = {}) {
  const platform = deps.platform ?? process.platform;
  const log = deps.log ?? console.log;
  const error = deps.error ?? console.error;
  const look = deps.takeSnapshot ?? takeSnapshot;
  const resolved = {
    spawn: deps.spawn ?? spawnChild,
    identifyProcesses: deps.identifyProcesses ?? ((pids) => lookUpProcesses(pids, look)),
    kill: deps.kill ?? ((identity) => stopSupervisorTree(identity, { look, kill: deps.killProcesses ?? killProcesses })),
    stopSpawned: deps.stopSpawned ?? stopSpawnedSupervisor,
    resolveClaude: deps.resolveClaude ?? findClaude,
    removeFile: deps.removeFile ?? ((file) => fs.rmSync(file)),
    execPath: deps.execPath ?? process.execPath,
    homedir: deps.homedir ?? os.homedir,
    recordOptionalFile: deps.recordOptionalFile ?? recordOptionalFile,
    forgetOptionalFile: deps.forgetOptionalFile ?? forgetOptionalFile,
  };
  if (argv[0] === 'supervise') return superviseMain(argv.slice(1), env, deps);

  let opts;
  try {
    opts = parseArgs(argv, env);
  } catch (err) {
    if (!(err instanceof ArgError)) throw err;
    error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const topLevel = repositoryRoot(opts, error, deps.gitTopLevel);
  if (!topLevel) return 1;
  if (platform !== 'win32') {
    error('js-harness remote runs on Windows only for now: it tells its supervisor from a reused pid by creation time, which it only reads there.');
    return 1;
  }

  const root = path.normalize(topLevel); // git prints `D:/a`; the state file, the log and the cwd use `D:\a`
  const id = remoteId(root, platform);
  const dir = path.join(opts.home, '.js-harness', 'remote');
  const files = { statePath: path.join(dir, `${id}.json`), logPath: path.join(dir, `${id}.log`), lockPath: path.join(dir, `${id}.lock`) };
  const context = { env, deps: resolved, log, error, root, id, home: opts.home, files, identify: resolved.identifyProcesses };
  try {
    if (opts.subcommand === 'status') return status({ ...context, state: readState(files.statePath) });
    const starting = opts.subcommand === 'start';
    const lock = takeLock({ lockPath: files.lockPath, root, identify: context.identify, undone: starting ? 'started' : 'stopped', removeFile: resolved.removeFile });
    if (lock.refusal) {
      error(lock.refusal);
      return 1;
    }
    // The state is read under the lock, which is released on every way out, a throw included. The release adds a
    // line when it fails, and nothing more: what the command did stands.
    try {
      const locked = { ...context, state: readState(files.statePath) };
      if (starting) return await start(opts, locked);
      // The launcher goes first. When it is not off afterwards (a file that is kept, one that could not be looked
      // for or removed, a record that could not be forgotten) the server is stopped all the same and the command
      // then fails: what was asked for is a machine that no longer starts it.
      const launcherNotOff = opts.atLogin && !disableLauncher(locked);
      const code = stop(locked);
      return launcherNotOff ? 1 : code;
    } finally {
      const left = lock.release();
      if (left) error(left);
    }
  } catch (err) {
    error(`js-harness remote ${opts.subcommand}: ${err.message}`);
    return 1;
  }
}

// ---- the hidden supervisor -------------------------------------------------------------------------------------------

/** `remote supervise --root <r> --name <n> --log <file> --claude <path> [--shell] [--permission-mode m]
 * [--spawn mode]`, run by `start` in a detached process: the server in a clean environment until a signal stops
 * it. That environment keeps what the user set persistently (read once from the registry; a read that fails
 * removes them all and says so in the log). Its stdio goes nowhere, so a failure is written to the log. */
async function superviseMain(argv, env, { signals = process, supervise: run = supervise, readPersistentEnv: readPersistent = readPersistentEnv } = {}) {
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
    await run({
      claude: { path: values['--claude'], shell: values['--shell'] === true },
      args: serverArgs({ name: values['--name'], spawnMode: values['--spawn'], permissionMode: values['--permission-mode'] }),
      cwd: values['--root'],
      env: cleanServerEnv(env, { readPersistent, warn: (text) => logNote(logPath, text) }),
      logPath,
      signal: controller.signal,
    });
    return 0;
  } catch (err) {
    logNote(logPath, `supervisor failed: ${err.message}`);
    return 1;
  }
}

// Run directly as the supervisor (`node bin/remote.mjs supervise ...`) and by the login launcher (`node
// bin/remote.mjs start ...`); real paths, as in `js-harness.mjs`.
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  remoteMain(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

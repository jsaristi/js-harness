// The owner records of a project's loops, and the process look that says whether a loop is alive. Zero deps.
//
// A loop is a long-running command a session keeps in its background (the lead's PR keeper, its heartbeat, its
// channel watch). Its record names the session that owns it, the process that runs it and the command it started,
// each by pid AND creation time, as bin/lib/process-tree.mjs names a process: Windows reuses pids fast, so a pid
// alone may name a stranger. A record whose processes are all gone (or whose pids now belong to processes created
// at another time) is stale, whatever its owner was.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync as spawnChildSync } from 'node:child_process';
import { killProcesses, selectDescendants, takeSnapshot } from './process-tree.mjs';

export const LOOP_SCHEMA = 'js-harness.loop/v1';

/** A loop's name: lower case letters, digits and dashes, as it is also the name of its record file. */
export const LOOP_NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** The folder of a project's loop records under the harness home, next to its channel and gate log. */
export function loopsFolder(home, slug) {
  return path.join(home, '.js-harness', 'loops', slug);
}

export function loopRecordPath(home, slug, name) {
  return path.join(loopsFolder(home, slug), `${name}.json`);
}

/** The record at `file`: `{ record }`, `{ missing: true }`, or `{ unreadable: <why> }` for a file that is there
 * and is not a loop record (records are written whole, by rename, so a half-written one is not expected). */
export function readRecord(file, { readFile = (f) => fs.readFileSync(f, 'utf8') } = {}) {
  let text;
  try {
    text = readFile(file);
  } catch (err) {
    return err.code === 'ENOENT' ? { missing: true } : { unreadable: err.message };
  }
  try {
    const record = JSON.parse(text);
    if (record?.schema !== LOOP_SCHEMA || typeof record.name !== 'string') return { unreadable: `not a ${LOOP_SCHEMA} record` };
    return { record };
  } catch (err) {
    return { unreadable: err.message };
  }
}

/** Every record of the folder, by name: `[{ name, file, record } | { name, file, unreadable }]`. */
export function readRecords(folder, { readdir = (d) => fs.readdirSync(d), readFile } = {}) {
  let names;
  try {
    names = readdir(folder);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return names
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => entry.slice(0, -'.json'.length))
    .sort()
    .map((name) => {
      const file = path.join(folder, `${name}.json`);
      const read = readRecord(file, { readFile });
      return read.record ? { name, file, record: read.record } : { name, file, unreadable: read.unreadable ?? 'gone' };
    });
}

let asides = 0;
/** A name beside `file` that no other writer uses (this process and a counter); it does not end in .json, so no
 * read of the folder takes it for a record. */
const besideOf = (file, kind) => `${file}.${process.pid}.${(asides += 1)}.${kind}`;

/** Writes the whole record to a file of its own first, so a reader never sees half of it. `exclusive` publishes it
 * by a hard link, which throws EEXIST when a record of that name is there: the claim of a new loop is whole and
 * only one. Otherwise a rename replaces the record. */
export function writeRecord(file, record, { exclusive = false } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = besideOf(file, 'tmp');
  fs.writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`);
  if (!exclusive) {
    fs.renameSync(temporary, file);
    return;
  }
  try {
    fs.linkSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

/** A lock older than this was left by a session that died holding it. The longest hold is a --restart whose
 * stop finds a survivor: thirteen looks at the process table, each a PowerShell run capped at 60 s on Windows
 * (bin/lib/process-tree.mjs), so 780 s at the very worst; a hold of seconds is the rule. */
export const LOCK_STALE_MS = 15 * 60000;
const LOCK_TRY_MS = 250;
const LOCK_TRIES = 600;
/** What Windows may answer for a lock that is there, or being deleted, or open in a scanner: try again. */
const LOCK_BUSY = new Set(['EEXIST', 'EPERM', 'EACCES', 'EBUSY']);

export class LockHeldError extends Error {}

/** Runs `body` while holding the lock of the record `file` (`<file>.lock`, created exclusively), so reading,
 * reclaiming, claiming and removing a record are one step for one session at a time: a name is never seen free
 * while another session is deciding about it. Waits for the lock, breaks it once it is older than
 * LOCK_STALE_MS, and throws LockHeldError after LOCK_TRIES tries. The lock holds a token of this hold, and is
 * removed at the end only while it still holds it: a hold whose lock was broken never removes the next holder's.
 * The lock's age is the file's own time against this machine's clock, never a fake one. */
export async function withRecordLock(file, body, { sleep, clock = Date.now } = {}) {
  const lock = `${file}.lock`;
  const token = `${process.pid} ${clock()} ${Math.random().toString(36).slice(2)}\n`;
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  for (let tries = 0; ; tries += 1) {
    try {
      fs.writeFileSync(lock, token, { flag: 'wx' });
      break;
    } catch (err) {
      if (!LOCK_BUSY.has(err.code)) throw err;
    }
    if (breakStaleLock(lock, clock)) continue;
    if (tries >= LOCK_TRIES) throw new LockHeldError(`the lock ${lock} stayed held for ${(LOCK_TRIES * LOCK_TRY_MS) / 1000} s`);
    await sleep(LOCK_TRY_MS);
  }
  try {
    return await body();
  } finally {
    let held = '';
    try {
      held = fs.readFileSync(lock, 'utf8');
    } catch {
      // gone: broken by another session
    }
    if (held === token) fs.rmSync(lock, { force: true, maxRetries: 5 });
  }
}

/** Removes a lock older than LOCK_STALE_MS; true only when it did. It moves the lock aside first, so of two
 * sessions breaking it only one does, and puts back a lock that turns out to be new (taken in between). Only a
 * session that died inside a hold leaves an old lock. */
function breakStaleLock(lock, clock) {
  const old = (file) => {
    try {
      return clock() - fs.statSync(file).mtimeMs > LOCK_STALE_MS;
    } catch {
      return false;
    }
  };
  if (!old(lock)) return false;
  const moved = besideOf(lock, 'aside');
  try {
    fs.renameSync(lock, moved);
  } catch {
    // gone already, or Windows will not move it now: the next try looks again, after its sleep
    return false;
  }
  if (!old(moved)) {
    try {
      fs.linkSync(moved, lock);
    } catch {
      // taken again meanwhile: that lock stands
    }
  }
  fs.rmSync(moved, { force: true });
  return true;
}

const sameRun = (a, b) => a.pid === b.pid && a.createdAt === b.createdAt;

/** Removes the record only while it is still the one `record` is (the same process): a loop that was taken over
 * and started again by another session has a new record, which is not this one's to remove. Call it inside
 * withRecordLock. True when `record`'s file was removed or was gone. */
export function removeRecordOf(file, record, { readFile } = {}) {
  const now = readRecord(file, { readFile });
  if (now.record && !sameRun(now.record, record)) return false;
  if (now.unreadable) return false;
  fs.rmSync(file, { force: true });
  return true;
}

const known = (value) => typeof value === 'number' && Number.isFinite(value);

/** The processes a record names as its own: the one that runs the loop, the command it started and what a stop
 * before this one left alive. */
function rootsOf(record) {
  const survivors = Array.isArray(record.survivors) ? record.survivors : [];
  return [{ pid: record.pid, createdAt: record.createdAt }, record.child ?? null, ...survivors].filter((root) => root !== null && typeof root === 'object' && Number.isInteger(root.pid) && known(root.createdAt));
}

const isSame = (entry, root) => entry.pid === root.pid && entry.createdAt === root.createdAt;

/** `alive` when a process the record names is in the snapshot with the same creation time, else `stale`. */
export function stateOf(record, snapshot) {
  return rootsOf(record).some((root) => snapshot.some((entry) => isSame(entry, root))) ? 'alive' : 'stale';
}

/** Every process of the loop: each live root and its descendants (pid and creation time both proven), once. */
export function targetsOf(record, snapshot) {
  const createdAt = new Map(snapshot.map((entry) => [entry.pid, entry.createdAt]));
  const pids = [];
  for (const root of rootsOf(record)) {
    if (!snapshot.some((entry) => isSame(entry, root))) continue;
    for (const pid of selectDescendants(snapshot, root)) if (!pids.includes(pid)) pids.push(pid);
  }
  return pids.map((pid) => ({ pid, createdAt: createdAt.get(pid) }));
}

/** The targets that are still the same processes in a later snapshot. */
export function survivorsOf(targets, snapshot) {
  return targets.filter((target) => snapshot.some((entry) => isSame(entry, target))).map((target) => target.pid);
}

// ---- the process table of this machine ------------------------------------------------------------------------

/** One line of `/proc/<pid>/stat` as `{ pid, ppid, createdAt, name }`, `createdAt` being the start time in clock
 * ticks since boot: a number that orders processes as their creation does, which is all `selectDescendants` asks.
 * A zombie (state Z) has exited and is left out. */
export function parseProcStat(text) {
  const open = text.indexOf('(');
  const close = text.lastIndexOf(')');
  if (open < 0 || close < open) return null;
  const fields = text.slice(close + 2).split(' ');
  if (fields[0] === 'Z') return null;
  const pid = Number(text.slice(0, open).trim());
  const ppid = Number(fields[1]);
  const createdAt = Number(fields[19]);
  if (!Number.isInteger(pid) || !Number.isInteger(ppid) || !Number.isFinite(createdAt)) return null;
  return { pid, ppid, createdAt, name: text.slice(open + 1, close) };
}

function linuxSnapshot() {
  const rows = [];
  for (const entry of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const row = parseProcStat(fs.readFileSync(`/proc/${entry}/stat`, 'utf8'));
      if (row) rows.push(row);
    } catch {
      // the process exited between the listing and the read
    }
  }
  if (rows.length === 0) throw new Error('/proc listed no process: it cannot be trusted to prove a loop gone');
  return rows;
}

function psSnapshot(sync) {
  const result = sync('ps', ['-A', '-o', 'pid=,ppid=,stat=,lstart='], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(`ps failed: ${result.error?.message ?? String(result.stderr).trim()}`);
  const rows = [];
  for (const line of String(result.stdout).split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/.exec(line);
    if (!match || match[3].startsWith('Z')) continue;
    rows.push({ pid: Number(match[1]), ppid: Number(match[2]), createdAt: Date.parse(match[4]), name: '' });
  }
  if (rows.length === 0) throw new Error('ps listed no process: it cannot be trusted to prove a loop gone');
  return rows;
}

/** The process table: `[{ pid, ppid, createdAt, name }]`. Throws when it cannot be read: "gone" is never read
 * from "could not look". */
export function snapshotProcesses({ platform = process.platform, spawnSync: sync = spawnChildSync } = {}) {
  if (platform === 'win32') return takeSnapshot({ spawnSync: sync });
  if (platform === 'linux') return linuxSnapshot();
  return psSnapshot(sync);
}

/** Kills each target that is still the process the snapshot saw. Windows: through a handle whose start time is
 * checked (`killProcesses`). POSIX: a fresh look first, then SIGKILL to each pid that still started then. */
export function killTargets(targets, { platform = process.platform, spawnSync: sync = spawnChildSync, kill = process.kill } = {}) {
  if (platform === 'win32') return killProcesses(targets, { spawnSync: sync });
  const snapshot = snapshotProcesses({ platform, spawnSync: sync });
  const outcome = { killed: [], gone: [], running: [] };
  for (const target of targets) {
    if (!snapshot.some((entry) => isSame(entry, target))) {
      outcome.gone.push(target.pid);
      continue;
    }
    try {
      kill(target.pid, 'SIGKILL');
      outcome.killed.push(target.pid);
    } catch {
      outcome.gone.push(target.pid);
    }
  }
  return outcome;
}

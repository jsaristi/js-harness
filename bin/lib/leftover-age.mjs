// The harness's leftovers older than a day, for `js-harness clean --age`: C4.2 of odd/tasks/f8-s8-certification.md
// (T3), "temp folders, locks or processes older than a day", line 0 (docs/proposals/harness-diet.md:539). `clean`
// ages scratch at three days and writes `clean.json`; this reads the age at one snapshot time and writes nothing.
//
// The roots are the ones the harness already names. Folders: the scratch folders of `clean`'s `temp-scratch` kind
// (`SCRATCH_PREFIXES` in the temp folder), aged by the newest thing in them, so a folder in use is not one. Locks: each
// `lock` and `*.lock` under `<home>/.js-harness`, where the harness keeps its own (the gate's, the memory pass's, the
// remote server's), aged by its own time. Processes: those `quiet` watches (`QUIET_PROCESSES`), aged by their start. A
// source that cannot be read, or a process with no start time, is named in `unread`, never taken as none.
import fs from 'node:fs';
import path from 'node:path';
import { SCRATCH_PREFIXES, measureTree } from './clean.mjs';

/** How old a leftover must be to count: C4.2's "older than a day". */
export const LEFTOVER_AGE_HOURS = 24;

const HOUR_MS = 3600 * 1000;
// How deep under the harness home a lock is looked for: the gate's is two folders down, the memory pass's three.
const LOCK_DEPTH = 4;

const hoursOf = (ms) => Math.round(ms / HOUR_MS * 10) / 10;

/** The scratch folders in `tmpdir` whose newest content is older than `cutoff` (ms): `{ path, hours }`. One whose age
 * cannot be read (`measureTree` counts what it cannot read as nothing) is told to `unread`. */
function oldFolders(tmpdir, at, cutoff, unread) {
  return fs.readdirSync(tmpdir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && SCRATCH_PREFIXES.some((prefix) => entry.name.startsWith(prefix)))
    .map((entry) => {
      const full = path.join(tmpdir, entry.name);
      return { path: full, newest: measureTree(full).newest };
    })
    .filter((folder) => {
      if (folder.newest > 0) return folder.newest < cutoff;
      unread(`temp folder ${folder.path}: its age cannot be read`);
      return false;
    })
    .map((folder) => ({ path: folder.path, hours: hoursOf(at - folder.newest) }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** The locks under `root` older than `cutoff` (ms): `{ path, hours }`. A lock folder is not looked into; a folder
 * that cannot be read is told to `unread`, and a lock gone between the listing and the look was released. */
function oldLocks(root, at, cutoff, unread) {
  const found = [];
  const walk = (dir, depth) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') return;
      if (dir === root) throw err;
      unread(`locks under ${dir}: ${err.code ?? err.message}`);
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.name === 'lock' || entry.name.endsWith('.lock')) {
        let ms;
        try {
          ms = fs.lstatSync(full).mtimeMs;
        } catch (err) {
          if (err.code !== 'ENOENT') unread(`lock ${full}: ${err.code ?? err.message}`);
          continue;
        }
        if (ms < cutoff) found.push({ path: full, hours: hoursOf(at - ms) });
      } else if (entry.isDirectory() && depth < LOCK_DEPTH) {
        walk(full, depth + 1);
      }
    }
  };
  walk(root, 1);
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

/** What is older than `LEFTOVER_AGE_HOURS` at the one time `now()` gives: `{ at, folders, locks, processes, unread,
 * over }`, `over` the count of the three lists. `listProcesses()` gives `[{ pid, createdAt, commandLine }]` of the
 * processes `quiet` watches, `createdAt` in ms as ./process-list.mjs gives it (a date's text is read too), or throws. */
export function leftoverAge({ home, tmpdir, now, listProcesses }) {
  const at = now().getTime();
  const cutoff = at - LEFTOVER_AGE_HOURS * HOUR_MS;
  const unread = [];
  const read = (name, step) => {
    try {
      return step();
    } catch (err) {
      unread.push(`${name}: ${err.message}`);
      return [];
    }
  };
  const tell = (line) => unread.push(line);
  const folders = read('temp folders', () => oldFolders(tmpdir, at, cutoff, tell));
  const locks = read('locks', () => oldLocks(path.join(home, '.js-harness'), at, cutoff, tell));
  const processes = read('processes', () => listProcesses()).flatMap((process) => {
    const started = typeof process.createdAt === 'number' ? process.createdAt : Date.parse(process.createdAt ?? '');
    if (!Number.isFinite(started)) {
      unread.push(`process ${process.pid} has no start time: ${process.commandLine}`);
      return [];
    }
    return started < cutoff ? [{ pid: process.pid, hours: hoursOf(at - started), commandLine: process.commandLine }] : [];
  });
  return { at: new Date(at).toISOString(), folders, locks, processes, unread, over: folders.length + locks.length + processes.length };
}

// The teardown of tests that start processes: nothing is killed by a bare number on Windows. Not a test file, so
// `node --test` does not run it; the tests under bin/ and evals/ import it, and a guard in `process-tree.test.mjs`
// fails any of them that signals a process by its number instead.
//
// Windows reuses pids quickly, so a pid a test recorded seconds ago can be another program's by the time the
// teardown runs. Two cases, two answers:
//  - a child the test spawned is held as the object, and stopped with `child.kill('SIGKILL')`: libuv kills
//    through the process handle it holds, so a reused pid is never hit, and a child that already exited is a no-op;
//  - a pid the test only knows as a number (a grandchild, a pid read from a file) gets its identity, `{ pid,
//    createdAt }`, when it is learned, and is killed with `killProcesses`, which checks the creation time again.
//    A pid that was not running then, or started before `since`, has no identity and is never killed.
// POSIX: the module has no creation-time lookup there, so a learned pid is signalled by its number, as before.
import { spawnSync as spawnChildSync } from 'node:child_process';
import {
  CLOCK_TOLERANCE_MS, identifyProcesses, killProcesses, killSurvivors, resolveRoot, selectDescendants, takeSnapshot,
} from './process-tree.mjs';

const createdOn = (ms) => (Number.isFinite(ms) ? `created ${new Date(ms).toISOString()}` : 'whose creation time Windows does not give');
// How many snapshots a look takes at most while a recorded pid answers under a row with no creation time: a process in
// the middle of its exit can be listed so for an instant, and the look is taken again before it is thrown.
const SNAPSHOTS_PER_LOOK = 3;

/** One sentence about what answered to the number `pid`: `recorded` is the identity it was learned with (or none),
 * `row` the process the snapshot `rows` (pid -> row) lists under that number (or none). */
function describeLook(pid, recorded, row, rows) {
  const was = recorded ? `the process recorded was ${createdOn(recorded.createdAt)}` : 'no process was recorded under that number';
  if (!row) return `pid ${pid} answered, and the snapshot taken next lists no process with that number (${was}): whatever answered ended in between`;
  const parent = rows.get(row.ppid);
  const now = `${row.name || 'a process without a name'}, ${createdOn(row.createdAt)}, parent ${row.ppid}${parent ? ` (${parent.name})` : ', which is not running'}`;
  if (recorded && row.createdAt === recorded.createdAt) return `pid ${pid} is still the process that was recorded: ${now}`;
  return `pid ${pid} is another process now: ${now}; ${was}`;
}

/** A reaper for one test file. `child(c)` and `pids(list, { since })` record what to stop and return their
 * argument, so a spawn or a read can be wrapped; `sweep()` stops everything recorded (and forgets it), `reap(list,
 * { since })` stops `list` now. `since` is when the test began (`Date.now()` before it spawned anything): a
 * process that started before it cannot be what the test spawned. `platform`, `spawnSync` and `kill` are injectable.
 *
 * `look(list)` is for a test that asserts a process it recorded with `pids` is gone, or still there: `[{ pid, alive,
 * found }]`, in the order of `list`. A number alone cannot say that on Windows, where a pid that answers may be
 * another program's, so `alive` is true only for the process that was recorded: one that answers to the pid AND was
 * created when the recorded one was. `found` is a sentence about whatever answered to the number (its image, its
 * creation time, its parent), for the message of a failure, and `null` when nothing answered. The number is asked
 * first, which takes no time, and a snapshot is taken only when one answered: "nothing answers" is true of the instant
 * of the call, while a number that answered is judged by what a snapshot saw a second or so later, so a process that
 * ended in between is not alive, and `found` says that it answered. A snapshot that failed throws at once. A
 * row with no creation time is looked at again, the whole look taken anew, three snapshots in all, and only then
 * thrown: a process in the middle of its exit can be listed so for an instant. Thrown, its identity cannot be told,
 * so it is neither alive nor gone. POSIX: the answer to the number stands. Nothing is ever signalled by a look. */
export function createReaper({ platform = process.platform, spawnSync: sync = spawnChildSync, kill = process.kill } = {}) {
  const children = new Set();
  const learned = new Map(); // pid -> identity

  const identify = (pids, { since } = {}) => {
    if (platform !== 'win32') return pids.map((pid) => ({ pid }));
    return identifyProcesses(pids, { platform, spawnSync: sync })
      .filter(({ createdAt }) => since === undefined || createdAt >= since - CLOCK_TOLERANCE_MS);
  };

  const stop = (identities) => {
    if (identities.length === 0) return;
    if (platform !== 'win32') {
      for (const { pid } of identities) {
        try {
          kill(pid, 'SIGKILL');
        } catch {
          // already gone
        }
      }
      return;
    }
    const { running } = killProcesses(identities, { spawnSync: sync });
    if (running.length > 0) throw new Error(`still running after the kill: pid ${running.join(', ')}`);
  };

  /** Whether a process answers to the number `pid` at this instant (one this user may not signal answers too). It
   * says nothing of which process that is: see `look`. */
  const answers = (pid) => {
    try {
      kill(pid, 0);
      return true;
    } catch (err) {
      return err.code === 'EPERM';
    }
  };

  return {
    child(child) {
      children.add(child);
      return child;
    },
    pids(pids, options) {
      for (const identity of identify(pids, options)) learned.set(identity.pid, identity);
      return pids;
    },
    reap(pids, options) {
      stop(identify(pids, options));
    },
    look(pids) {
      let answering = new Set(pids.filter(answers));
      if (platform !== 'win32') {
        return pids.map((pid) => ({ pid, alive: answering.has(pid), found: answering.has(pid) ? `pid ${pid} answers (no creation time is read on POSIX, so the number is all there is)` : null }));
      }
      for (let snapshot = 1; ; snapshot += 1) {
        const rows = new Map(answering.size === 0 ? [] : takeSnapshot({ spawnSync: sync }).map((row) => [row.pid, row]));
        // A recorded pid that answers, under a row with no creation time, is neither the recorded process nor
        // proved another one: "not alive" would let a survivor pass as gone. Found in review, 2026-10-11. Such a
        // row is looked at again, the whole look taken anew, before it is thrown (`SNAPSHOTS_PER_LOOK`).
        const unnamed = pids.find((pid) => answering.has(pid) && learned.has(pid) && rows.get(pid) && !Number.isFinite(rows.get(pid).createdAt));
        if (unnamed === undefined) {
          return pids.map((pid) => {
            if (!answering.has(pid)) return { pid, alive: false, found: null };
            const recorded = learned.get(pid);
            const row = rows.get(pid);
            return { pid, alive: Boolean(recorded && row && row.createdAt === recorded.createdAt), found: describeLook(pid, recorded, row, rows) };
          });
        }
        if (snapshot === SNAPSHOTS_PER_LOOK) {
          const row = rows.get(unnamed);
          throw new Error(`pid ${unnamed} answers, and the snapshot lists ${row.name || 'a process without a name'} under it with no creation time, so its identity could not be told, and it stayed so over ${SNAPSHOTS_PER_LOOK} snapshots: the process recorded was ${createdOn(learned.get(unnamed).createdAt)}`);
        }
        answering = new Set(pids.filter(answers));
      }
    },
    sweep() {
      for (const child of children) {
        try {
          child.kill('SIGKILL');
        } catch {
          // already gone
        }
      }
      children.clear();
      const identities = [...learned.values()];
      learned.clear();
      stop(identities);
    },
  };
}

/** The sweep of a test file put off to the end of the file, for a file whose runs are not about what a process
 * leaves behind: it pays one snapshot at its end in place of one a run (on Windows each run's sweep starts a
 * PowerShell that lists every process of the machine). `killSurvivors` is what the test hands to `runProcess`: it
 * records what the run ends with (the child, and when it started and exited, as the real sweep is given them) and
 * does nothing else. `check()` is called once, in the file's `after`: it takes one snapshot, selects each recorded
 * run's descendants as the real sweep does (`resolveRoot`, `selectDescendants`), kills what it finds through the
 * snapshot's own identities, and returns it as `[{ pid, name }]` for the file to fail on. So a leak lives until the
 * file ends and then fails the file by name, where the real sweep kills it at once and in silence. Off Windows
 * `killSurvivors` is the real sweep, which starts nothing, and `check` returns `[]`. Its limit: a grandchild whose
 * own parent exits between the end of the run and the end of the file is no longer tied to the run by parentage,
 * as with the real sweep a moment earlier. */
export function sweepLater({
  platform = process.platform, spawnSync: sync = spawnChildSync, now = Date.now, killSurvivors: real = killSurvivors,
} = {}) {
  // Off Windows the real sweep is one kill of a process group: it starts nothing, and it is the only cleanup.
  if (platform !== 'win32') return { killSurvivors: real, check: () => [] };
  const runs = [];
  const record = (child, lifetime) => {
    if (!child?.pid) return;
    if (!Number.isFinite(lifetime?.startedAt)) {
      throw new Error(`cannot search later what pid ${child.pid} left behind: when it started is not known, and a pid alone does not name its children`);
    }
    // Read now where the run did not hand one over: a window that ran on to the end of the file would let in the
    // children of a pid that Windows gave to another process in the meantime.
    runs.push({ pid: child.pid, startedAt: lifetime.startedAt, exitedAt: lifetime.exitedAt ?? now() });
  };
  const check = () => {
    const recorded = runs.splice(0);
    if (recorded.length === 0) return [];
    const snapshot = takeSnapshot({ spawnSync: sync });
    const entries = new Map(snapshot.map((entry) => [entry.pid, entry]));
    const found = new Map();
    for (const run of recorded) {
      const root = resolveRoot(snapshot, run, { now: now() });
      for (const pid of selectDescendants(snapshot, root)) found.set(pid, entries.get(pid));
    }
    const left = [...found.values()];
    if (left.length === 0) return [];
    // The same refusal as the real sweep: a survivor that outlives its kill is a failure, not a line of the report.
    const { running } = killProcesses(left.map(({ pid, createdAt }) => ({ pid, createdAt })), { spawnSync: sync });
    if (running.length > 0) throw new Error(`still running after the kill: pid ${running.join(', ')}`);
    return left.map(({ pid, name }) => ({ pid, name }));
  };
  return { killSurvivors: record, check };
}

/** `runProcess` with its sweep put off to the end of the file: `{ runProcess, check }`, see `sweepLater`. */
export function sweptLater(runProcess, options) {
  const later = sweepLater(options);
  return { runProcess: (o) => runProcess({ ...o, killSurvivors: later.killSurvivors }), check: later.check };
}

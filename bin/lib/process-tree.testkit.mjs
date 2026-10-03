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
import { CLOCK_TOLERANCE_MS, identifyProcesses, killProcesses } from './process-tree.mjs';

/** A reaper for one test file. `child(c)` and `pids(list, { since })` record what to stop and return their
 * argument, so a spawn or a read can be wrapped; `sweep()` stops everything recorded (and forgets it), `reap(list,
 * { since })` stops `list` now. `since` is when the test began (`Date.now()` before it spawned anything): a
 * process that started before it cannot be what the test spawned. `platform`, `spawnSync` and `kill` are injectable. */
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

// The load a gate starts under: how many of the machine's logical processors were busy during one sample.
// A gate's time depends on what else the machine runs, which no gate sees: on 2026-10-11 a video in a
// browser and a language server made one gate take 1,069 s where the same tree took 832 s. So a gate reads
// the load before its first sensor and says it (`check` in a row, `js-harness gate` on a loaded machine).
// See odd/tasks/gate-log.md ("S1 · The load a gate starts under").
//
// The figure comes from Node alone, two readings of `os.cpus()`, because `check` ships to any project on
// any system: no process is started, and `os.loadavg()` is all zeros on Windows. Two limits are known:
// - Above 64 logical processors Windows shows a process one processor group, so `os.cpus()` gives Node a
//   part of the machine, and the figure is of that part.
// - Inside a container `os.cpus()` gives the host's processors and their times, whatever share of them
//   the container may use: the figure is the host's.
import os from 'node:os';
import { busiestLines, busiestProcesses } from './machine-busiest.mjs';

/** From this many busy logical processors on, a machine is loaded: `js-harness gate` says its load, and
 * a gate looks for the processes that load it.
 * In processors and not in a share of them: 15% is 0.6 of four processors and 4.8 of thirty-two, and the
 * language server that slowed the gates of 2026-10-11 was 1.5. */
export const LOAD_SAID_PROCESSORS = 1;

/** The variable that switches the sample off, with the value `off`: no sample, no look for what loads
 * the machine, and nothing said of the load. For the gates a test starts as processes of their own, which
 * no stand-in for the sampler reaches: each would wait a second, on a machine the suite itself keeps busy,
 * and then start PowerShell to find out what does. */
export const GATE_LOAD_ENV = 'JS_HARNESS_GATE_LOAD';

export const loadSwitchedOff = (env) => env[GATE_LOAD_ENV] === 'off';

/** What the logical processors did between two readings of `os.cpus()`: `{ busy, processors, share }`,
 * where `share` is the part of their time that was not idle (`1 - idle / total`, over all of them) and
 * `busy` that share in processors, 2.2 of 8. Every time that is not idle counts as busy.
 *
 * What cannot be read is `{ notRead }`, a sentence that says why, and never a figure that is not a number:
 * a reading with no processor, two readings of a different number of them, two that do not differ (taken
 * too close, or on a system that does not count), and times that went back. */
export function loadBetween(before, after) {
  if (before.length === 0 || after.length === 0) return { notRead: 'os.cpus() gave no processor' };
  if (before.length !== after.length) return { notRead: `os.cpus() gave ${before.length} processors and then ${after.length}` };
  const spent = (times) => Object.values(times).reduce((sum, ms) => sum + ms, 0);
  let total = 0;
  let idle = 0;
  after.forEach(({ times }, at) => {
    total += spent(times) - spent(before[at].times);
    idle += times.idle - before[at].times.idle;
  });
  if (total === 0 && idle === 0) return { notRead: 'the two readings of os.cpus() do not differ' };
  if (!(total > 0 && idle >= 0 && idle <= total)) return { notRead: 'the processor times of os.cpus() did not go forward between the two readings' };
  const share = (total - idle) / total;
  return { busy: share * after.length, processors: after.length, share };
}

const wait = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

/** One sample of the machine's load: `os.cpus()` read, `ms` waited, and read again. Resolves to what
 * `loadBetween` says of the two readings, with `sampleMs`, the length of the sample; `readLoad` adds to
 * it who loads a loaded machine. A second is long enough for a steady figure and short beside a
 * gate of minutes. The wait is a timer, so the lock of the gate that samples goes on beating.
 * `cpus` and `sleep` stand in for `os.cpus` and the timer in a test. */
export async function sampleLoad({ ms = 1000, cpus = os.cpus, sleep = wait } = {}) {
  const before = cpus();
  await sleep(ms);
  return { ...loadBetween(before, cpus()), sampleMs: ms };
}

/** The load as a gate reads it: what `sample` resolves to, and `{ notRead }` with its message for a
 * sampler that throws, or that gives what is no load at all (nothing, or no figure that is a number),
 * since whoever reads a load reads its figure. It never throws, because nothing a gate proves depends on
 * the load.
 *
 * On a loaded machine (`isLoaded`) it also looks for what loads it (`look`, `./machine-busiest.mjs`), and
 * the load then holds `busiest`, the three processes at most that spent most processor time:
 * `[{ name, script, pid, cpuSeconds }]`. The look takes some seconds, which are cheap beside the minutes a
 * loaded machine costs a gate, and nothing is started for it on a machine at rest or for a load that was
 * not read. A look that finds nobody, or fails in any way, leaves the load as it was sampled. */
export async function readLoad(sample = sampleLoad, look = busiestProcesses) {
  let load;
  try {
    load = await sample();
  } catch (err) {
    return { notRead: err instanceof Error ? err.message : String(err) };
  }
  const said = load !== null && typeof load === 'object';
  if (said && load.notRead) return load;
  if (!said || !Number.isFinite(load.busy)) return { notRead: 'the sampler gave no figure' };
  if (!isLoaded(load)) return load;
  try {
    const busiest = await look();
    return Array.isArray(busiest) && busiest.length > 0 ? { ...load, busiest } : load;
  } catch {
    return load;
  }
}

/** Whether `load` is of a loaded machine (`LOAD_SAID_PROCESSORS`). A load that was not read is not. */
export const isLoaded = (load) => !load.notRead && load.busy >= LOAD_SAID_PROCESSORS;

/** `load` in one line, for a row or a line of stderr:
 * `2.2 of 8 logical processors busy before the sensors (27%, 1 s sample)`, or `not read: <why>`.
 * `before` is what the gate ran after the sample. `afterGate` says that the gate waited for another: it
 * has the lock a moment after that gate released it, while that gate still prints the rest of its report,
 * so the figure is the tail of that gate and not the machine's own, and the line says so. */
export function loadDetail(load, { before = 'the sensors', afterGate = false } = {}) {
  if (load.notRead) return `not read: ${load.notRead}`;
  const { busy, processors, share, sampleMs } = load;
  const of = `${processors} logical processor${processors === 1 ? '' : 's'}`;
  return `${busy.toFixed(1)} of ${of} busy before ${before} (${Math.round(share * 100)}%, ${sampleMs / 1000} s sample)${afterGate ? ', right after another gate' : ''}`;
}

/** What loads the machine of `load`, a line for each of its busiest processes, to be said under
 * `loadDetail`: `3.2 s of CPU in 2 s  node tsserver.js (pid 12044)`. No line for a load that names none,
 * which is every load of a machine at rest. */
export const loadLines = (load) => busiestLines(load.busiest ?? []);

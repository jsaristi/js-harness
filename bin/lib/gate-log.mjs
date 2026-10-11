// The gate log: a record of every gate of this machine, when it ran and under what. "Which gates ran
// beside which" was a session's memory, and a gate's time was known only to the session that ran it. So a
// gate writes one JSON line when its sensors are about to run and one when they are done, and a gate that
// was refused its turn writes one: a gate that was killed is still there, as a start without an end.
// See odd/tasks/gate-log.md ("S2 · The gate log").
//
// It lives in a folder of its own under the harness home, beside the lock's and not in it: a gate leaves
// nothing in the lock's folder, and `uninstall` reads that folder to know whether a gate is alive. It is
// the machine's and not a project's, as the lock is: gates of two projects wait for each other, and must
// be in one file. It holds folder paths and process names of this machine and never leaves it.
//
// Bounded by rotation and never by rewriting: a gate that finds `log.jsonl` past its bound renames it to
// `log.1.jsonl`, over the older one, and appends to a new file. A rewrite would lose the line a gate
// appends meanwhile, and the gate that loses it is the one that runs without the lock, which the log
// exists to show. So the folder holds two files at most.
//
// Nothing here throws to a gate, and nothing a gate proves depends on its record.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/** The version of a line, in each one as `v`. A reader skips the lines of another. */
export const GATE_LOG_VERSION = 1;

/** The size past which `log.jsonl` is rotated: about 700 gates at two lines each. */
export const GATE_LOG_MAX_BYTES = 512 * 1024;

/** The longest command a line holds. What comes after `gate --` can hold a secret, and the whole of it is
 * of no use to a reader of the log. */
export const GATE_COMMAND_MAX = 120;

/** The variable that switches the log off, with the value `off`: nothing is written and nothing said of
 * it. For a gate that must leave no file in its home. */
export const GATE_LOG_ENV = 'JS_HARNESS_GATE_LOG';

export const gateLogSwitchedOff = (env) => env[GATE_LOG_ENV] === 'off';

/** Where the log of the gates of `home` lives. Nothing else spells this path: deleting the folder undoes
 * all a gate ever wrote of itself. */
export function gateLogDir(home) {
  return path.join(home, '.js-harness', 'gate-log');
}

const CURRENT = 'log.jsonl';
const OLDER = 'log.1.jsonl';

/** Appends `event` to the log of `home` as a line of its own, making the folder: `{ ok: true }`, or
 * `{ error }` with what the system answered, in one sentence. It never throws.
 *
 * Gates that run without the lock append side by side. What this relies on: the file is opened for
 * appending and the line goes out in one write, which the system puts at the end of the file whole; a line
 * is a few hundred bytes. The test of this file has several processes do it together.
 *
 * A file past `maxBytes` is renamed first. A rename the system refuses (the file is busy) is skipped, the
 * line goes to the file as it is, and the next append tries again. Two gates that rotate in the same
 * instant can lose the older file to the new one, which only a lock would prevent; it takes two appends
 * within the same few microseconds, once in some 700 gates.
 * `fileSystem` stands in for `node:fs` in a test. */
export function appendGateEvent(home, event, { maxBytes = GATE_LOG_MAX_BYTES, fileSystem: io = fs } = {}) {
  try {
    const dir = gateLogDir(home);
    io.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, CURRENT);
    try {
      if (io.statSync(file).size > maxBytes) io.renameSync(file, path.join(dir, OLDER));
    } catch {
      // no file yet, or a rename refused: the line is appended all the same
    }
    io.appendFileSync(file, `${JSON.stringify(event)}\n`, 'utf8');
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Whether `value` is a line of this log: enough of one to be paired and printed. */
function isEvent(value) {
  return (
    isObject(value) &&
    value.v === GATE_LOG_VERSION &&
    ['start', 'end', 'refused'].includes(value.event) &&
    typeof value.id === 'string' &&
    typeof value.at === 'string' &&
    Number.isFinite(Date.parse(value.at))
  );
}

/** The log of `home`: `{ dir, events, skipped }`, the events of both files, the older first. A home with
 * no log has none. A line that is torn, that is not JSON or that is no event of this version is counted
 * in `skipped` and left out, never fatal. A file that is there and cannot be read is named in
 * `unavailable`, so that "could not look" is not read as "no gates".
 *
 * The newer file is read first, since a gate may rotate between the two readings: the worst a reader then
 * sees is the same lines in both files, which are kept once. Read the other way round, it would miss the
 * lines that moved. */
export function readGateLog(home, { fileSystem: io = fs } = {}) {
  const dir = gateLogDir(home);
  const texts = [];
  const unavailable = [];
  for (const name of [CURRENT, OLDER]) {
    try {
      texts.unshift(io.readFileSync(path.join(dir, name), 'utf8'));
    } catch (err) {
      // ENOTDIR: something that is no folder stands where the folder, or the home, would be.
      if (!['ENOENT', 'ENOTDIR'].includes(err.code)) unavailable.push(`${name}: ${err.code ?? err.message}`);
    }
  }
  const events = [];
  const seen = new Set();
  let skipped = 0;
  for (const line of texts.flatMap((text) => text.split('\n'))) {
    if (line.trim() === '') continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      parsed = null;
    }
    if (!isEvent(parsed)) skipped += 1;
    else if (!seen.has(`${parsed.id}|${parsed.event}`)) {
      seen.add(`${parsed.id}|${parsed.event}`);
      events.push(parsed);
    }
  }
  return { dir, events, skipped, ...(unavailable.length && { unavailable }) };
}

/** The gates of `events`, in the order they began: `{ start, end }` for a gate that ran, with no `end` for
 * one that was killed or still runs, and `{ refused }` for one that was refused its turn. An end whose
 * start is not there, because it was rotated away, is left out. */
export function gatesOf(events) {
  const gates = [];
  const began = new Map();
  for (const event of events) {
    if (event.event === 'refused') gates.push({ refused: event });
    else if (event.event === 'start') {
      began.set(event.id, { start: event });
      gates.push(began.get(event.id));
    } else if (began.has(event.id)) began.get(event.id).end = event;
  }
  return gates;
}

const two = (number) => String(number).padStart(2, '0');

/** `iso` as a line of the log says it: the local month, day and time, to the second, since two gates are
 * told apart by when each began. */
function localTime(iso) {
  const at = new Date(iso);
  return `${two(at.getMonth() + 1)}-${two(at.getDate())} ${two(at.getHours())}:${two(at.getMinutes())}:${two(at.getSeconds())}`;
}

const wholeSeconds = (seconds) => `${Number.isFinite(seconds) ? Math.round(seconds) : '?'} s`;

/** The load of a start, in a few words: the figure, and what loaded the machine where the gate found it. */
function loadSaid(load) {
  if (!isObject(load)) return null;
  if (load.notRead || !Number.isFinite(load.busy)) return 'load not read';
  const names = (Array.isArray(load.busiest) ? load.busiest : []).map(({ name, script }) => (script ? `${name} ${script}` : name));
  return `load ${load.busy.toFixed(1)} of ${load.processors}${names.length ? ` (${names.join(', ')})` : ''}`;
}

/** Whom a gate waited for and for how long, or `null` for a gate that had its turn at once. */
function waitSaid({ waitedSeconds, waitedFor }, always = false) {
  const gates = (Array.isArray(waitedFor) ? waitedFor : []).map(({ cwd, pid }) => cwd ?? `another gate${pid ? ` (pid ${pid})` : ''}`);
  if (!always && gates.length === 0 && !(waitedSeconds >= 1)) return null;
  return `waited ${wholeSeconds(waitedSeconds)}${gates.length ? ` for ${gates.join(', ')}` : ''}`;
}

const LOCK_SAID = { parent: "in its parent's turn", none: 'without the lock' };

/** One line for each of `gates` (`gatesOf`), short enough to be read on a phone: when it began, how long it
 * took and how it ended, the lock where it was not its own, the load it started under, whom it waited for,
 * and its folder. A start that has no end says so, and a refusal says why it was refused. What a gate does
 * not have is left out of its line. */
export function formatGates(gates) {
  return gates.map(({ start, end, refused }) => {
    const first = start ?? refused;
    const parts = refused
      ? [`refused (${refused.reason})`, waitSaid(refused, true)]
      : [end ? `${wholeSeconds(end.seconds)}  ${end.result}` : 'no end (killed, or still running)', LOCK_SAID[start.lock], loadSaid(start.load), waitSaid(start)];
    return [localTime(first.at), ...parts, first.cwd].filter(Boolean).join('  ');
  });
}

/** Milliseconds as the seconds a line holds, to a tenth. */
const seconds = (ms) => (Number.isFinite(ms) ? Math.round(ms / 100) / 10 : 0);

/** The record of one gate: what `check` and `js-harness gate` write the log through. The gate checks
 * `cwd` and runs `command`, which is cut at `GATE_COMMAND_MAX`.
 *
 * - `start({ lock, waitedMs, waitedFor, load })`, when the gate is about to run what it runs: `lock` is
 *   `own`, `parent` (the turn of the process that started it) or `none` (no lock could be taken),
 *   `waitedFor` the gates it waited for as `[{ cwd, pid, command }]`, `load` the sample of the machine's
 *   load as it was read, left out where none was taken.
 * - `end({ result, sensors })`, on every way out of a gate that started: `result` is `pass`, `fail` or
 *   `timeout` for the sensors of `check`, with a line for each in `sensors`, `exit <code>` or `killed` for
 *   the command of `js-harness gate`, and `error` for a gate that ended by an error of its own. Nothing
 *   is written for a gate whose start is not in the log: an end alone says nothing.
 * - `refused({ reason, waitedMs, waitedFor })`, for a gate that ran nothing: `reason` is `held` (told not
 *   to wait) or `timeout` (its wait ran out).
 * - `failure()`: `undefined`, or why the log could not be written and what is missing from it, to be said
 *   after `the gate log`. A gate has one such sentence at most, and `onFailure` is called with it once.
 *
 * None of them throws. `append`, `now` and `id` stand in for the writer, the clock and the random id. */
export function gateRecord({ home, cwd, command, pid = process.pid, append = appendGateEvent, now = Date.now, id = randomUUID, onFailure }) {
  const gate = id();
  const said = { cwd, command: String(command).slice(0, GATE_COMMAND_MAX), pid };
  let startedAt;
  let failure;
  /** Writes one line at the clock's time `at`; `false`, with the failure kept, when it could not. */
  const write = (what, at, event) => {
    let answer;
    try {
      answer = append(home, { v: GATE_LOG_VERSION, event: event.event, id: gate, at: new Date(at).toISOString(), ...event });
    } catch (err) {
      answer = { error: err instanceof Error ? err.message : String(err) };
    }
    if (!answer?.error) return true;
    if (failure === undefined) {
      failure = `could not be written (${answer.error}), so ${what} is not in it`;
      onFailure?.(failure);
    }
    return false;
  };
  const waited = ({ waitedMs, waitedFor }) => ({ waitedSeconds: seconds(waitedMs), waitedFor: waitedFor ?? [] });
  return {
    start({ lock, waitedMs, waitedFor, load }) {
      const at = now();
      if (write('this gate', at, { event: 'start', ...said, lock, ...waited({ waitedMs, waitedFor }), ...(load && { load }) })) startedAt = at;
    },
    end({ result, sensors }) {
      if (startedAt === undefined) return;
      const at = now();
      write('the end of this gate', at, { event: 'end', seconds: seconds(at - startedAt), result, ...(sensors && { sensors }) });
    },
    refused({ reason, waitedMs, waitedFor }) {
      write('this refusal', now(), { event: 'refused', ...said, reason, ...waited({ waitedMs, waitedFor }) });
    },
    failure: () => failure,
  };
}

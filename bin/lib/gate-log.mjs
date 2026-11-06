// The gate log: a record of every gate of this machine, when it ran and under what. "Which gates ran
// beside which" was a session's memory, and a gate's time was known only to the session that ran it. So a
// gate writes one JSON line when its sensors are about to run and one when they are done, and a gate that
// was refused its turn writes one: a gate that was killed is still there, as a start without an end.
// A gate that stopped before its sensors, because a row it knew before them had already failed, writes one
// line of a kind of its own and no start: it ran nothing, and a start without an end would read as killed.
// See odd/tasks/gate-log.md ("S2 · The gate log") and odd/tasks/gate-turn.md ("The gate stops before its
// sensors").
//
// It lives in a folder of its own under the harness home, beside the lock's and not in it: a gate leaves
// nothing in the lock's folder, and `uninstall` reads that folder to know whether a gate is alive. It is
// the machine's and not a project's, as the lock is: gates of two projects wait for each other, and must
// be in one file. It holds folder paths and process names of this machine and never leaves it.
//
// Bounded by rotation and never by rewriting: a gate that finds `log.jsonl` past its bound renames it to
// `log.1.jsonl`, over the older one, and appends to a new file. A rewrite would lose the line a gate
// appends meanwhile, and the gate that loses it is the one that runs without the lock, which the log
// exists to show. So the log is two files at most.
//
// Beside it, a file of its own: `busiest.jsonl`, a line for each gate that kept who spent the processor
// over its run (`appendGateBusiest`, and `watchBusiest` of `./machine-busiest.mjs`), keyed by the id of
// that gate's lines in the log. Of its own so that no reader of the log's lines meets a new field: gates
// of several versions of the harness write the one log of a machine, and a field one version adds is a
// line another version may refuse (odd/tasks/gate-wait.md, T19). It is bounded the same way, by the same
// figure, into `busiest.1.jsonl`. So are `test-times.jsonl` (`appendGateTestTimes`) and `failed.jsonl`, the
// failing ends a proof of a tree reads past the log's rotation (`appendGateFailure`): each two files at most.
//
// Nothing here throws to a gate, and nothing a gate proves depends on its record.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { endsUnterminated } from './jsonl-tail.mjs';
import { ruleValue } from './rules.mjs';

/** The version of a line, in each one as `v`. A reader skips the lines of another. */
export const GATE_LOG_VERSION = 1;

/** The size past which `log.jsonl` is rotated: about 700 gates at two lines each. The figure is the declared
 * rule `gate-log-size` (./rules-data.mjs). */
export const GATE_LOG_MAX_BYTES = ruleValue('gate-log-size', 'KiB') * 1024;

/** The longest command a line holds. What comes after `gate --` can hold a secret, and the whole of it is
 * of no use to a reader of the log. The figure is the declared rule `gate-log-command` (./rules-data.mjs). */
export const GATE_COMMAND_MAX = ruleValue('gate-log-command', 'characters');

/** The variable that switches the log off, with the value `off`: nothing is written and nothing said of
 * it. For a gate that must leave no file in its home. */
export const GATE_LOG_ENV = 'JS_HARNESS_GATE_LOG';

export const gateLogSwitchedOff = (env) => env[GATE_LOG_ENV] === 'off';

/** Where the log of the gates of `home` lives. Nothing else in the harness spells this path: deleting the
 * folder undoes all a gate ever wrote of itself. The practice run spells it once more
 * (`gateLogFolder` of `scripts/practice-lib.mjs`), since it looks at an installed harness from outside and
 * imports nothing of it; a test there holds the two together. */
export function gateLogDir(home) {
  return path.join(home, '.js-harness', 'gate-log');
}

const CURRENT = 'log.jsonl';
const OLDER = 'log.1.jsonl';
const BUSIEST_CURRENT = 'busiest.jsonl';
const BUSIEST_OLDER = 'busiest.1.jsonl';
const TIMES_CURRENT = 'test-times.jsonl';
const TIMES_OLDER = 'test-times.1.jsonl';
const FAILED_CURRENT = 'failed.jsonl';
const FAILED_OLDER = 'failed.1.jsonl';

/** Appends `event` to the log of `home` as a line of its own, making the folder: `{ ok: true }`, or
 * `{ error }` with what the system answered, in one sentence. It never throws.
 *
 * Gates that run without the lock append side by side. What this relies on: the file is opened for
 * appending and the line goes out in one write, which the system puts at the end of the file whole; a line
 * is a few hundred bytes. The test of this file has several processes do it together.
 *
 * A tail with no line break is what a write that was cut short left. The line then starts on a fresh one,
 * with the line break that ends the tail in the same write: appended to the tail, the two were one bad
 * line to the reader, and a start lost that way took its gate's end with it. Nothing is written again to
 * put the tail right. Two gates that find the same tail in the same instant each end it, and the empty
 * line between them is none to the reader.
 *
 * A file past `maxBytes` is renamed first. A rename the system refuses (the file is busy) is skipped, the
 * line goes to the file as it is, and the next append tries again. Two gates that rotate in the same
 * instant can lose the older file to the new one, which only a lock would prevent; it takes two appends
 * within the same few microseconds, once in some 700 gates.
 * `fileSystem` stands in for `node:fs` in a test. */
export function appendGateEvent(home, event, { maxBytes = GATE_LOG_MAX_BYTES, fileSystem: io = fs } = {}) {
  return appendLine(home, [CURRENT, OLDER], event, { maxBytes, io });
}

/** Appends `value` as a line of its own to the file `current` of the folder of `home`, which is renamed to
 * `older` first where it is past `maxBytes`: what `appendGateEvent` says, for any file of the folder. */
function appendLine(home, [current, older], value, { maxBytes, io }) {
  try {
    const dir = gateLogDir(home);
    io.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, current);
    try {
      if (io.statSync(file).size > maxBytes) io.renameSync(file, path.join(dir, older));
    } catch {
      // no file yet, or a rename refused: the line is appended all the same
    }
    io.appendFileSync(file, `${endsUnterminated(file, io) ? '\n' : ''}${JSON.stringify(value)}\n`, 'utf8');
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Appends the line of one gate to `busiest.jsonl`, beside the log, as `appendGateEvent` appends an event:
 * rotated past `maxBytes` into `busiest.1.jsonl`, `{ ok: true }` or `{ error }`, never a throw. The line is
 * `{ v, id, at, seconds, busiest }`: the version, the id of the gate's lines in the log, when it was
 * written, the seconds of the run, and who spent the processor over it, `[{ pid, name, script?,
 * cpuSeconds }]`, the heaviest first. `gateRecord` writes it (`busiest`), with what its reader takes. */
export function appendGateBusiest(home, line, { maxBytes = GATE_LOG_MAX_BYTES, fileSystem: io = fs } = {}) {
  return appendLine(home, [BUSIEST_CURRENT, BUSIEST_OLDER], line, { maxBytes, io });
}

/** Appends the test times of one gate to `test-times.jsonl`, beside the log, as `appendGateBusiest` appends its
 * line: rotated past `maxBytes` into `test-times.1.jsonl`, `{ ok: true }` or `{ error }`, never a throw. The line is
 * `{ v, id, at, files: [{ test, seconds }] }`, the id the gate's lines in the log have: a list of every test file
 * on each end line would rotate the log far sooner (odd/tasks/throughput-review.md, B5). */
export function appendGateTestTimes(home, line, { maxBytes = GATE_LOG_MAX_BYTES, fileSystem: io = fs } = {}) {
  return appendLine(home, [TIMES_CURRENT, TIMES_OLDER], line, { maxBytes, io });
}

/** Appends the end of a gate whose sensors did not all pass to `failed.jsonl`, beside the log, as `appendGateBusiest`
 * appends its line: rotated past `maxBytes` into `failed.1.jsonl`, `{ ok: true }` or `{ error }`, never a throw. The
 * line is the gate's end line in the log, whole. A failure holds a proof back for as long as a reader has it
 * (`provenBy`), and the log forgets it in days, the pass after it staying: about 14 failures a day of some 200 bytes
 * keep months here (JH 112, odd/tasks/gate-push-holes.md, L4 and L5). `gateRecord` writes it (`end`). */
export function appendGateFailure(home, line, { maxBytes = GATE_LOG_MAX_BYTES, fileSystem: io = fs } = {}) {
  return appendLine(home, [FAILED_CURRENT, FAILED_OLDER], line, { maxBytes, io });
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const isText = (value) => typeof value === 'string';

/** `holds`, or `null`: for a field the writer writes as `null` where it has nothing to say. */
const orNull = (holds) => (value) => value === null || holds(value);

const listOf = (holds) => (value) => Array.isArray(value) && value.every(holds);

/** An object whose fields are what `fields` says of each, where they are there. A field that is not there
 * is no fault, since a gate leaves out what it does not have. */
const shaped = (fields) => (value) => isObject(value) && Object.entries(fields).every(([field, holds]) => value[field] === undefined || holds(value[field]));

/** A gate another one waited for, as far as a reader prints it: its folder and its pid, each `null` where
 * the lock could not read it. Its command is printed nowhere. */
const isGateWaitedFor = shaped({ cwd: orNull(isText), pid: orNull(Number.isFinite) });

/** A process the load of a start names, as far as a reader prints it: its name, and its script or `null`. */
const isBusiest = shaped({ name: isText, script: orNull(isText) });

/** What a field of the load of a start is when it is there, for the fields a reader prints: why it was not
 * read, the two figures, and the processes that loaded the machine. Asked by the reader of a line (`BODY`)
 * and by its writer (`loadWritten`), so that the two cannot come apart. */
const LOAD = {
  notRead: isText,
  busy: Number.isFinite,
  processors: Number.isFinite,
  busiest: listOf(isBusiest),
};

/** What a field of a line is when it is there, for every field a reader takes apart, counts with or
 * prints: the folder, the lock, the reason and the result, which are texts, the seconds, the gates it
 * waited for, the load with the processes it names, the sensors, a list of objects of which nothing is
 * printed, and the rows that stopped a gate before its sensors, which are their names. One that is there as
 * something else (a `null` among the gates it waited for, a text where the seconds go, an object where the
 * folder goes) is a fault, and the line is no event.
 *
 * What is printed is asked as well as what is taken apart: `{"cwd":{"toString":null}}` is an object no
 * text can be made of, and it made `formatGates` throw as a `null` in a list did (found in review,
 * 2026-10-11). `null` is allowed where the writer writes it and nowhere else. What no reader of this
 * version looks at (the command, the pid of the gate itself, what a sensor says) is left as it is. */
const BODY = {
  cwd: isText,
  lock: isText,
  reason: isText,
  result: isText,
  seconds: Number.isFinite,
  waitedSeconds: Number.isFinite,
  waitedFor: listOf(isGateWaitedFor),
  sensors: listOf(isObject),
  load: shaped(LOAD),
  rows: listOf(isText),
  code: isTreeKey,
  files: isTreeKey,
  tried: isTreeKey,
  error: isText,
  by: isText,
};

/** Whether `value` has the body of an event: each field of `BODY` that is there is what it says. */
const hasBody = shaped(BODY);

/** Whether `value` is the key of a tree as a gate writes it (`treeKey` of `./gate-tree.mjs`): 64 lowercase
 * hex characters. Asked by the reader of a line (`BODY`), by its writer (`gateRecord`) and by the one that
 * looks for a proof (`provenBy`), so that the three cannot come apart. */
export function isTreeKey(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

/** The kinds of event this version writes and reads. `stopped` came after the other three: a version that
 * does not know it leaves its line out in silence (`readGateLog`), which is why a gate that stopped writes
 * no start for that version to show alone. The five `first-` kinds are a ticket's (./gate-first.mjs):
 * issued, claimed, expired, cancelled, left unclaimed (its file held), each under the ticket's id; they are no gate (`gatesOf`). `ci-fallback` is a
 * gate's that asked GitHub's machines first and got no answer, under the id of the gate it then runs here. */
const KINDS = ['start', 'end', 'refused', 'stopped', 'same', 'first-issued', 'first-claimed', 'first-expired', 'first-cancelled', 'first-unclaimed', 'ci-fallback'];

/** Whether `value` has the head of a line of this log, enough to be paired: the version, an event that is
 * a text, the id and when. The kind of the event is not asked here (`readGateLog`). */
function hasHead(value) {
  return (
    isObject(value) &&
    value.v === GATE_LOG_VERSION &&
    typeof value.event === 'string' &&
    typeof value.id === 'string' &&
    typeof value.at === 'string' &&
    Number.isFinite(Date.parse(value.at))
  );
}

/** The log of `home`: `{ dir, events, skipped }`, the events of both files, the older first. A home with
 * no log has none. A line that is torn, that is not JSON or that is no event of this version, by its head
 * (`hasHead`) or, for a kind this version knows, by its body (`hasBody`), is counted in `skipped` and left
 * out, never fatal. Head and body are asked here, once, and not by each reader: a line that was an event
 * by its head alone made `formatGates` throw on its body, and with it every `gate log` until the file
 * rotated. A file that is there and cannot be read is named in
 * `unavailable`, so that "could not look" is not read as "no gates".
 *
 * A line with a sound head and a kind of event this version does not know is left out and not counted, and
 * no reader sees it. Gates of several versions of the harness write the one file of a machine, since each
 * project runs the harness it has: such a line is what a newer gate wrote, whole, and not a damaged one. A
 * count of unreadable lines that grew with every gate of the newer version would say the log is broken
 * when nothing is. Its body is not asked, which is that version's to know.
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
    if (!hasHead(parsed)) skipped += 1;
    else if (!KINDS.includes(parsed.event)) continue;
    else if (!hasBody(parsed)) skipped += 1;
    else if (!seen.has(`${parsed.id}|${parsed.event}`)) {
      seen.add(`${parsed.id}|${parsed.event}`);
      events.push(parsed);
    }
  }
  return { dir, events, skipped, ...(unavailable.length && { unavailable }) };
}

/** The failures of `home` kept beside the log (`appendGateFailure`): the ends of both files that did not pass, whole as
 * `readGateLog` takes an end, the older first and each once. A torn or misshapen line is left out; a home with none has
 * none. `null` where a file that is there cannot be read: the failure it holds may be the one that stands against a
 * pass, so no answer is given. The newer file is read first, as `readGateLog` reads the log. */
export function readGateFailures(home, { fileSystem: io = fs } = {}) {
  const dir = gateLogDir(home);
  const texts = [];
  for (const name of [FAILED_CURRENT, FAILED_OLDER]) {
    try {
      texts.unshift(io.readFileSync(path.join(dir, name), 'utf8'));
    } catch (err) {
      if (!['ENOENT', 'ENOTDIR'].includes(err.code)) return null;
    }
  }
  const failures = [];
  const seen = new Set();
  for (const line of texts.flatMap((text) => text.split('\n'))) {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (hasHead(parsed) && parsed.event === 'end' && parsed.result !== 'pass' && hasBody(parsed) && !seen.has(parsed.id)) {
      seen.add(parsed.id);
      failures.push(parsed);
    }
  }
  return failures;
}

/** The events a proof of a tree is read from (`provenBy`): the events of the log, with each failure of `home` the log
 * does not hold (`readGateFailures`) before the first line written after it. One rotated out of the log is older than
 * every line the log keeps, and comes first; one whose line in the log was refused or torn goes where its time puts it,
 * after a line of the same instant, so a failure is never read as older than a pass it came after. `null` where the
 * failures or a file of the log cannot be read, which is no proof: the line not read may be the one that decides.
 *
 * The failures are read before the log: a failure written between the two readings is then in the log, where a
 * reading the other way round would miss it in both. */
export function readGateProof(home, { fileSystem } = {}) {
  const failures = readGateFailures(home, { fileSystem });
  if (failures === null) return null;
  const { events, unavailable } = readGateLog(home, { fileSystem });
  if (unavailable) return null;
  const ended = new Set(events.filter((event) => event.event === 'end').map((event) => event.id));
  const read = [...events];
  for (const failure of failures.filter(({ id }) => !ended.has(id))) {
    const after = read.findIndex((event) => Date.parse(event.at) > Date.parse(failure.at));
    read.splice(after === -1 ? read.length : after, 0, failure);
  }
  return read;
}

/** A process that spent the processor over a gate's run, as far as a reader prints it: its name, its
 * script or `null` or none, its seconds and its pid where it is there. Asked by the reader of
 * `busiest.jsonl` and by its writer (`gateRecord`), so that the two cannot come apart. */
const isSpent = (value) => isBusiest(value) && isText(value.name) && Number.isFinite(value.cpuSeconds) && (value.pid === undefined || Number.isFinite(value.pid));

/** Whether `value` is a line of `busiest.jsonl` of this version, whole. */
const isBusiestLine = (value) => (
  isObject(value)
  && value.v === GATE_LOG_VERSION
  && isText(value.id)
  && isText(value.at)
  && Number.isFinite(Date.parse(value.at))
  && Number.isFinite(value.seconds)
  && listOf(isSpent)(value.busiest)
);

/** Who spent the processor over each gate of `home` that kept it: a map from the id of the gate's lines
 * in the log to its line of `busiest.jsonl` (`appendGateBusiest`), from both files. A line that is torn,
 * is not JSON or is no line of this version whole is left out, never fatal, and so is a file that cannot
 * be read: what it holds is an addition to a gate's line, and a gate without it prints as it always did.
 * The newer file is read first, as `readGateLog` reads the log, so that a rotation between the two
 * readings costs no line; a gate's line in the newer file is the one kept. */
export function readGateBusiest(home, { fileSystem: io = fs } = {}) {
  const dir = gateLogDir(home);
  const byId = new Map();
  for (const name of [BUSIEST_CURRENT, BUSIEST_OLDER]) {
    let text;
    try {
      text = io.readFileSync(path.join(dir, name), 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split('\n')) {
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      if (isBusiestLine(parsed) && !byId.has(parsed.id)) byId.set(parsed.id, parsed);
    }
  }
  return byId;
}

/** One test file's time as a line of `test-times.jsonl` holds it. */
const isTestTime = (value) => isObject(value) && isText(value.test) && Number.isFinite(value.seconds);

/** The lines of `test-times.jsonl` and `test-times.1.jsonl` (`appendGateTestTimes`), as a Map from the gate's id to
 * its line: none for a file that is not there, a line that is torn or of another shape left out, a gate's line in
 * the newer file the one kept. A file that is there and cannot be read throws its code, so the throughput row says
 * it was not read rather than that no gate kept times. */
export function readGateTestTimes(home, { fileSystem: io = fs } = {}) {
  const dir = gateLogDir(home);
  const byId = new Map();
  for (const name of [TIMES_CURRENT, TIMES_OLDER]) {
    let text;
    try {
      text = io.readFileSync(path.join(dir, name), 'utf8');
    } catch (err) {
      if (err?.code === 'ENOENT') continue;
      throw new Error(err?.code ?? err?.message ?? String(err));
    }
    for (const line of text.split('\n')) {
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      const whole = hasHead({ ...parsed, event: 'times' }) && Array.isArray(parsed.files) && parsed.files.every(isTestTime);
      if (whole && !byId.has(parsed.id)) byId.set(parsed.id, parsed);
    }
  }
  return byId;
}

/** The gates of `events`, in the order they began: `{ start, end }` for a gate that ran, with no `end` for
 * one that was killed or still runs, `{ refused }` for one that was refused its turn, and `{ stopped }` for
 * one that stopped before its sensors, which is the end of no start whatever id it has. An end whose start
 * is not there, because it was rotated away, is left out. `{ same }` is a gate that ran no sensor because
 * another had passed the same tree: it has no start either. */
export function gatesOf(events) {
  const gates = [];
  const began = new Map();
  for (const event of events) {
    if (event.event === 'refused') gates.push({ refused: event });
    else if (event.event === 'stopped') gates.push({ stopped: event });
    else if (event.event === 'same') gates.push({ same: event });
    else if (event.event === 'start') {
      began.set(event.id, { start: event });
      gates.push(began.get(event.id));
    } else if (event.event === 'end' && began.has(event.id)) began.get(event.id).end = event;
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

/** The load of a start, in a few words: the figure, and what loaded the machine where the gate found it.
 * A load with either of its two figures missing is one that was not read: the writer leaves out a figure
 * that is no number (`loadWritten`), and half a figure says nothing. */
function loadSaid(load) {
  if (!isObject(load)) return null;
  if (load.notRead || !Number.isFinite(load.busy) || !Number.isFinite(load.processors)) return 'load not read';
  const names = (Array.isArray(load.busiest) ? load.busiest : []).map(({ name, script }) => (script ? `${name} ${script}` : name));
  return `load ${load.busy.toFixed(1)} of ${load.processors}${names.length ? ` (${names.join(', ')})` : ''}`;
}

/** Whom a gate waited for and for how long, or `null` for a gate that had its turn at once. A gate it waited
 * for that went first by a ticket (`first: true`) says so. */
function waitSaid({ waitedSeconds, waitedFor }, always = false) {
  const gates = (Array.isArray(waitedFor) ? waitedFor : []).map(({ cwd, pid, first }) => `${cwd ?? `another gate${pid ? ` (pid ${pid})` : ''}`}${first === true ? ' (first by a ticket)' : ''}`);
  if (!always && gates.length === 0 && !(waitedSeconds >= 1)) return null;
  return `waited ${wholeSeconds(waitedSeconds)}${gates.length ? ` for ${gates.join(', ')}` : ''}`;
}

const LOCK_SAID = { parent: "in its parent's turn", none: 'without the lock', ci: "on GitHub's machines" };

/** That a gate stopped before its sensors, and for which rows where its line names them. */
function stopSaid({ rows }) {
  const names = Array.isArray(rows) ? rows : [];
  return `stopped before its sensors${names.length ? ` (${names.join(', ')})` : ''}`;
}

/** The gate that proved the tree `code` (`isTreeKey`), among `events` (`readGateProof`): the last `end` line
 * whose result is `pass` and whose `code` and `files` are those keys, as `{ id, at, cwd }`, with `cwd` `null` when the
 * start of that gate is no longer in the log. `null` when there is none, and for a `code` that is no key.
 *
 * Only such a line is a proof. A gate writes `code` on its end when it ran every sensor, all passed, and
 * the tree had the same key before them and after them; no other kind of line is read here, so a gate that
 * ran no sensor because of a proof proves nothing itself, and neither does a `gate -- <command>` turn,
 * whose end says `exit 0`.
 *
 * `files` is the key of the files of that tree (`filesKey` of ./gate-tree.mjs), and with no such key there is no
 * proof. A pass is none where a gate of those files failed (`standsAgainst`) after it, or before it under another key
 * than the pass's: a gate writes the key it ran under as `tried`, and one on GitHub's machines has none, so a failure
 * there, or in another WSL2 distribution, under another node or other sensors, is answered by no pass here. JH 109,
 * 2026-10-30 (odd/tasks/gate-narrow-pass.md, L2): a commit's tests failed on CI, a pass of the same tree in the WSL
 * mirror, where the failing test skips itself, proved it, and two commits entered with a red test.
 *
 * A pass whose end names no `files` is none: it was written before failures named theirs, so none of them could be told
 * against it (JH 112, odd/tasks/gate-push-holes.md, L5). */
export function provenBy(events, code, files) {
  if (!isTreeKey(code) || !isTreeKey(files) || !Array.isArray(events)) return null;
  const at = events.findLastIndex((event) => event.event === 'end' && event.result === 'pass' && event.code === code && event.files === files);
  if (at === -1) return null;
  const end = events[at];
  if (events.some((event, index) => standsAgainst(event, files) && (index > at || event.tried !== code))) return null;
  const start = events.find((event) => event.event === 'start' && event.id === end.id);
  return { id: end.id, at: end.at, cwd: start?.cwd ?? null };
}

/** Whether `event` is the end of a gate of the files `files` whose sensors did not all pass: a failure, a timeout or
 * an error. The end of a `gate -- <command>` turn has no sensors, and is none. */
const standsAgainst = (event, files) => event.event === 'end' && event.result !== 'pass' && event.files === files && Array.isArray(event.sensors);

/** That a gate ran no sensor, and which gate had passed the same tree. */
function sameSaid({ by }) {
  return `no sensor ran: the same tree passed in gate ${typeof by === 'string' ? by.slice(0, 8) : '(not named)'}`;
}

/** One line for each of `gates` (`gatesOf`), short enough to be read on a phone: when it began, how long it
 * took and how it ended, the lock where it was not its own, the load it started under, whom it waited for,
 * and its folder. A start that has no end says so, a refusal says why it was refused, and a gate that
 * stopped before its sensors says that and for which rows, so that it reads as none of the others: it
 * neither ran, nor was refused, nor was killed. What a gate does not have is left out of its line.
 *
 * `busiest` is who spent the processor over each gate that kept it (`readGateBusiest`): the line of a gate
 * that ran and has one ends with the three heaviest, so that the reason a run was slow is read beside its
 * seconds. A gate without one prints as it did before the file was there. */
export function formatGates(gates, busiest = new Map()) {
  return gates.map(({ start, end, refused, stopped, same }) => {
    const first = start ?? refused ?? stopped ?? same;
    let parts;
    if (stopped) parts = [stopSaid(stopped)];
    else if (same) parts = [sameSaid(same)];
    else if (refused) parts = [`refused (${refused.reason})`, waitSaid(refused, true)];
    else parts = [end ? `${wholeSeconds(end.seconds)}  ${end.result}` : 'no end (killed, or still running)', LOCK_SAID[start.lock], loadSaid(start.load), waitSaid(start)];
    return [localTime(first.at), ...parts, first.cwd, start && spentSaid(busiest.get(start.id))].filter(Boolean).join('  ');
  });
}

/** Who spent the processor over a gate's run, in a few words: the three heaviest, each by its name, its
 * script in parentheses where it has one, and its whole seconds. `null` for a gate that kept nobody. */
function spentSaid(line) {
  const spent = line?.busiest ?? [];
  if (spent.length === 0) return null;
  const said = spent.slice(0, 3).map(({ name, script, cpuSeconds }) => `${name}${script ? ` (${script})` : ''} ${Math.round(cpuSeconds).toLocaleString('en-US')} s`);
  return `busiest: ${said.join(', ')}`;
}

/** Milliseconds as the seconds a line holds, to a tenth. */
const seconds = (ms) => (Number.isFinite(ms) ? Math.round(ms / 100) / 10 : 0);

/** The load of a start as it is written: `load` without what the reader of a line would refuse (`LOAD`,
 * which is what `BODY` asks of it), or `undefined` for what is no load at all. A figure that is no finite
 * number and a reason that is no text are left out, and so is each of the busiest processes whose name or
 * script is not what the reader prints, and whatever stands where their list goes and is no list. The rest
 * stays as it was handed over, the fields no reader looks at included, and `load` itself is not touched.
 *
 * The sampler hands none of this today (`./machine-load.mjs`). It is filtered all the same, as the gates a
 * gate waited for are: the reader refuses the whole line for one such field, a start it refuses takes the
 * gate's end with it, and a writer must not write what its own reader leaves out (found in review,
 * 2026-10-11). */
function loadWritten(load) {
  if (!isObject(load)) return undefined;
  return Object.fromEntries(Object.entries(load).flatMap(([field, value]) => {
    if (field === 'busiest' && Array.isArray(value)) return [[field, value.filter(isBusiest)]];
    return !(field in LOAD) || LOAD[field](value) ? [[field, value]] : [];
  }));
}

/** The record of one gate: what `check` and `js-harness gate` write the log through. The gate checks
 * `cwd` and runs `command`, which is cut at `GATE_COMMAND_MAX`.
 *
 * - `start({ lock, waitedMs, waitedFor, load })`, when the gate is about to run what it runs: `lock` is
 *   `own`, `parent` (the turn of the process that started it) or `none` (no lock could be taken),
 *   `waitedFor` the gates it waited for as `[{ cwd, pid, command }]`, the command of each cut as the
 *   gate's own, `load` the sample of the machine's load as it was read (`loadWritten`), left out where
 *   none was taken.
 * - `end({ result, sensors })`, on every way out of a gate that started: `result` is `pass`, `fail` or
 *   `timeout` for the sensors of `check`, with a line for each in `sensors`, `exit <code>` or `killed` for
 *   the command of `js-harness gate`, and `error` for a gate that ended by an error of its own. Nothing
 *   is written for a gate whose start is not in the log: an end alone says nothing.
 * - `refused({ reason, waitedMs, waitedFor })`, for a gate that ran nothing because the lock was not its
 *   to take: `reason` is the word the lock refused it with, such as `held` (told not to wait) or `timeout`
 *   (its wait ran out). It is written as the lock says it and read as any text, so a reason the lock
 *   comes to give later needs no change here.
 * - `ciFallback({ seconds, reason })`, for a gate whose tests went to GitHub's machines first and got no answer, so
 *   they run here: `seconds` is what the wait cost, `reason` why there was no answer. It comes before the start.
 * - `stopped({ rows })`, for a gate that ran nothing because a row it knew before its sensors had already
 *   failed: `rows` are the names of the rows that stopped it. It is the one line of that gate, which wrote
 *   no start and writes no end.
 * - `busiest({ seconds, busiest })`, after the end of a gate that started: who spent the processor over
 *   its run (`watchBusiest` of `./machine-busiest.mjs`), written in `busiest.jsonl` under the gate's `id`
 *   (`appendGateBusiest`). Each process is written as its reader takes it (`isSpent`) and the rest is left
 *   out; nothing is written for a gate whose start is not in the log, which nothing could key it by, nor
 *   where nobody was found.
 * - `testTimes(files)`, after the end of a gate that started and traced its tests: each test file's seconds,
 *   `[{ test, seconds }]`, written in `test-times.jsonl` under the gate's `id` (`appendGateTestTimes`).
 * - `id`, the id of the gate's lines, and `started()`, whether its start is in the log: a gate takes the
 *   readings `busiest` writes only where it can be written.
 * - `failure()`: `undefined`, or why the log could not be written and what is missing from it, to be said
 *   after `the gate log`. A gate has one such sentence at most, and `onFailure` is called with it once.
 *
 * None of them throws. `append`, `appendBusiest`, `appendFailure`, `now` and `id` stand in for the writer of the log,
 * the writer of `busiest.jsonl`, the writer of `failed.jsonl`, the clock and the random id. */
export function gateRecord({ home, cwd, command, pid = process.pid, session, append = appendGateEvent, appendBusiest = appendGateBusiest, appendTestTimes = appendGateTestTimes, appendFailure = appendGateFailure, now = Date.now, id = randomUUID, onFailure }) {
  const gate = id();
  // The session that ran it, where the host gives one: what lets `sessions` tell whose gate it was (./stall.mjs).
  const said = { cwd, command: String(command).slice(0, GATE_COMMAND_MAX), pid, ...(isText(session) && session !== '' && { session }) };
  let startedAt;
  let failure;
  /** Hands one line to `writer`; `false`, with the failure kept and said, when it could not be written. */
  const handed = (what, writer, line) => {
    let answer;
    try {
      answer = writer(home, line);
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
  /** Writes one line of the log at the clock's time `at`; `false`, with the failure kept, when it could not. */
  const write = (what, at, event) => handed(what, append, { v: GATE_LOG_VERSION, event: event.event, id: gate, at: new Date(at).toISOString(), ...event });
  // The lock keeps its holder's command whole, so the command of a gate this one waited for is cut here as
  // this gate's own is: it can hold the same secret, and a line has to stay short enough to be one write.
  const cut = (holder) => (typeof holder.command === 'string' ? { ...holder, command: holder.command.slice(0, GATE_COMMAND_MAX) } : holder);
  // A member that is no gate is left out, and so is one whose folder or pid is not what the lock tells
  // (`isGateWaitedFor`, which is what the reader asks): the reader refuses a whole line for one (`BODY`),
  // and a start it refuses takes the gate's end with it, so writing such a member would cost the gate its
  // place in the log.
  const waited = ({ waitedMs, waitedFor }) => ({ waitedSeconds: seconds(waitedMs), waitedFor: (Array.isArray(waitedFor) ? waitedFor : []).filter(isGateWaitedFor).map(cut) });
  return {
    id: gate,
    started: () => startedAt !== undefined,
    busiest({ seconds: runSeconds, busiest } = {}) {
      if (startedAt === undefined || !Array.isArray(busiest)) return;
      // Written as the reader takes it (`isSpent`): a script of `null` is left out, as are fields no
      // reader looks at, and a process the reader would refuse is not written at all.
      const spent = busiest.filter(isSpent).map(({ pid: spentPid, name, script, cpuSeconds }) => ({ ...(Number.isFinite(spentPid) && { pid: spentPid }), name, ...(isText(script) && { script }), cpuSeconds }));
      if (spent.length === 0) return;
      handed('who spent the processor over this gate', appendBusiest, { v: GATE_LOG_VERSION, id: gate, at: new Date(now()).toISOString(), seconds: Number.isFinite(runSeconds) ? runSeconds : 0, busiest: spent });
    },
    testTimes(files) {
      if (startedAt === undefined || !Array.isArray(files)) return;
      // Written as the reader takes them (`isTestTime`): a file it would refuse would cost the line.
      const kept = files.filter(isTestTime).map(({ test, seconds: fileSeconds }) => ({ test, seconds: fileSeconds }));
      if (kept.length === 0) return;
      handed('the test times of this gate', appendTestTimes, { v: GATE_LOG_VERSION, id: gate, at: new Date(now()).toISOString(), files: kept });
    },
    start({ lock, waitedMs, waitedFor, load }) {
      const at = now();
      const sampled = loadWritten(load);
      if (write('this gate', at, { event: 'start', ...said, lock, ...waited({ waitedMs, waitedFor }), ...(sampled && { load: sampled }) })) startedAt = at;
    },
    end({ result, sensors, code, files, tried }) {
      if (startedAt === undefined) return;
      const at = now();
      // The key of the tree, where the gate has one to give: what makes this line a proof (`provenBy`). The key of
      // its files and the key it ran under, whatever the result: what lets a failure stand against a pass of the same
      // files under another key.
      const line = { v: GATE_LOG_VERSION, event: 'end', id: gate, at: new Date(at).toISOString(), seconds: seconds(at - startedAt), result, ...(sensors && { sensors }), ...(isTreeKey(code) && { code }), ...(isTreeKey(files) && { files }), ...(isTreeKey(tried) && { tried }) };
      handed('the end of this gate', append, line);
      // A failure a proof can tell against a pass (`standsAgainst`) is kept apart too, past the log's rotation.
      if (result !== 'pass' && isTreeKey(files) && Array.isArray(sensors)) handed('the failure the proof of a tree reads', appendFailure, line);
    },
    same({ code, by }) {
      // Written only whole: a line of this kind with no key or no gate behind it says nothing.
      if (isTreeKey(code) && isText(by)) write('this gate', now(), { event: 'same', ...said, code, by });
    },
    refused({ reason, waitedMs, waitedFor }) {
      write('this refusal', now(), { event: 'refused', ...said, reason, ...waited({ waitedMs, waitedFor }) });
    },
    ciFallback({ seconds: waited, reason } = {}) {
      // Before the start of the gate it falls back to, whose id it shares: what the throughput review joins it by.
      write('this fallback from CI', now(), { event: 'ci-fallback', ...said, seconds: Number.isFinite(waited) ? waited : 0, ...(isText(reason) && { reason }) });
    },
    stopped({ rows } = {}) {
      // A name that is no text is left out, as a gate that is none is among the gates waited for: the
      // reader refuses the whole line for one (`BODY`).
      write('this stop', now(), { event: 'stopped', ...said, rows: (Array.isArray(rows) ? rows : []).filter(isText) });
    },
    failure: () => failure,
  };
}

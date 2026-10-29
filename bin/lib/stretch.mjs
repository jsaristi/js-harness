// The stretch's measure (odd/tasks/stretch-protocol.md): a plan read and checked, its items laid in lanes against the
// stretch's hours, each estimate corrected by what the last stretches of its kind took, and each item measured from
// the records: when its session ran, and what of that time failed. Pure: it reads no file and spawns nothing, so a
// test hands it records and the command (bin/stretch.mjs) hands it what it read. What no record holds is not
// measured here, and the command says so.

import { TASK_KINDS } from './contract.mjs';
import { ruleValue } from './rules.mjs';
import { busySeconds, median } from './throughput.mjs';

const HOUR_MS = 3_600_000;

/** How many finished items of a kind correct its next estimate, the newest first, and how many it takes before any
 * correction is used: one item says more about that item than about the kind. */
export const HISTORY_ITEMS = 10;
export const HISTORY_MIN = 3;

const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isRange = (value) => Array.isArray(value) && value.length === 2 && value.every((n) => Number.isFinite(n) && n > 0) && value[0] <= value[1];

/** The ids of `entries` that are missing or repeated, as a refusal, or `null`. */
function idProblem(entries, what) {
  const seen = new Set();
  for (const entry of entries) {
    if (!isText(entry?.id)) return `every ${what} needs an id`;
    if (seen.has(entry.id)) return `${what} ${entry.id} is named twice`;
    seen.add(entry.id);
  }
  return null;
}

function goalProblem(goal) {
  if (!isText(goal.text)) return `goal ${goal.id} needs a text`;
  if (!isText(goal.command)) return `goal ${goal.id} needs a command that exits 0 when it is met`;
  return null;
}

function itemProblem(entry) {
  if (!isText(entry.title)) return `item ${entry.id} needs a title`;
  if (!TASK_KINDS.includes(entry.kind)) return `item ${entry.id} names the kind "${entry.kind}": one of ${TASK_KINDS.join(', ')}`;
  if (!isRange(entry.hours)) return `item ${entry.id} needs hours as [low, high], both above 0 and low first`;
  if (entry.session !== undefined && entry.session !== null && !isText(entry.session)) return `item ${entry.id} names its session as text, such as "JH 71"`;
  if (entry.waitsFor !== undefined && !isText(entry.waitsFor)) return `item ${entry.id} says what it waitsFor as text: what only the user can give`;
  return null;
}

/** An item is one session's work, so a session named by two items is refused: their time could not be told apart. */
export function sessionProblem(items) {
  const owner = new Map();
  for (const entry of items) {
    if (!isText(entry.session)) continue;
    if (owner.has(entry.session)) return `session ${entry.session} is named by items ${owner.get(entry.session)} and ${entry.id}: an item is one session's work`;
    owner.set(entry.session, entry.id);
  }
  return null;
}

/** The plan `value` as the record keeps it: `{ plan }`, or `{ error }` with the first reason it is refused. */
export function parsePlan(value) {
  if (!isObject(value)) return { error: 'the plan is one JSON object' };
  if (!(Number.isFinite(value.hours) && value.hours > 0)) return { error: 'the plan needs hours above 0' };
  if (!(Number.isSafeInteger(value.slots) && value.slots >= 1)) return { error: 'the plan needs slots, the work sessions at once, 1 or more' };
  if (!Array.isArray(value.goals) || value.goals.length === 0) return { error: 'the plan needs at least one goal' };
  if (!Array.isArray(value.items)) return { error: 'the plan needs items, a list' };
  if (value.waits !== undefined && !(Array.isArray(value.waits) && value.waits.every(isText))) return { error: 'waits is a list of texts' };
  const problem = idProblem(value.goals, 'goal') ?? value.goals.map(goalProblem).find(Boolean)
    ?? idProblem(value.items, 'item') ?? value.items.map(itemProblem).find(Boolean) ?? sessionProblem(value.items);
  if (problem) return { error: problem };
  return {
    plan: {
      hours: value.hours,
      slots: value.slots,
      goals: value.goals.map(({ id, text, command }) => ({ id, text, command })),
      items: value.items.map(({ id, title, kind, hours, session, waitsFor }) => ({ id, title, kind, hours: [...hours], session: session ?? null, ...(waitsFor ? { waitsFor } : {}) })),
      waits: value.waits ?? [],
    },
  };
}

const middle = ([low, high]) => (low + high) / 2;

/** Whether a measured item says how long its kind takes: measured whole (its session did not start before the
 * stretch), and finished, or still running already past its high estimate, which is then a floor of its real time.
 * Leaving every unfinished item out would keep the overruns out, and the correction would read low. */
const teaches = (one) => isRange(one.estimate) && Number.isFinite(one.realHours) && !one.clipped
  && (one.finished || one.realHours > one.estimate[1]);

/** The correction of each kind from the measured items of closed stretches, oldest first (`{ kind, estimate,
 * realHours, finished, clipped }`): `{ factor, samples, from }`, the median of real over the estimate's middle among
 * the last HISTORY_ITEMS that teach. From HISTORY_MIN of the kind's own it is the kind's (`from: 'kind'`); with fewer,
 * that of every kind together (`'all'`); with fewer in all, none, a factor of 1 (`'none'`). `samples` counts the
 * kind's own. */
export function corrections(history) {
  const ratios = (items) => items.slice(-HISTORY_ITEMS).map((one) => one.realHours / middle(one.estimate));
  const taught = history.filter(teaches);
  const all = ratios(taught);
  const byKind = {};
  for (const kind of TASK_KINDS) {
    const own = ratios(taught.filter((one) => one.kind === kind));
    const samples = taught.filter((one) => one.kind === kind).length;
    if (own.length >= HISTORY_MIN) byKind[kind] = { factor: median(own), samples: Math.min(samples, HISTORY_ITEMS), from: 'kind' };
    else if (all.length >= HISTORY_MIN) byKind[kind] = { factor: median(all), samples, from: 'all' };
    else byKind[kind] = { factor: 1, samples, from: 'none' };
  }
  return byKind;
}

const round = (n) => Math.round(n * 100) / 100;

/** `range` times `factor`, to the hundredth. */
export const scaled = (range, factor) => range.map((n) => round(n * factor));

/** The items (`{ id, corrected: [low, high], waitsFor? }`) laid in `slots` lanes in their order, each to the lane that
 * frees first by the middle estimate: `{ lanes: [{ items: [{ id, start, end }], end }], queued, fills, idle }`, each
 * time a `[low, high]` of hours from the opening, one layout drawn by both ends. An item that waits for the user cannot
 * run while they are away, so it takes no lane and counts in no total. The stretch is filled when no lane ends before
 * `hours` by the low estimate; `idle` is the session-hours left without work before the return by that estimate, and
 * from which hour. An item's hours are the work left at the opening, so one already running is laid as what remains. */
export function laneOut(all, { slots, hours }) {
  const items = all.filter((one) => !one.waitsFor);
  const lanes = Array.from({ length: slots }, () => ({ items: [], end: [0, 0] }));
  for (const one of items) {
    const lane = lanes.reduce((best, next) => (middle(next.end) < middle(best.end) ? next : best));
    const start = lane.end;
    const end = [round(start[0] + one.corrected[0]), round(start[1] + one.corrected[1])];
    lane.items.push({ id: one.id, start, end });
    lane.end = end;
  }
  const short = lanes.filter((lane) => lane.end[0] < hours);
  return {
    lanes,
    queued: [round(items.reduce((sum, one) => sum + one.corrected[0], 0)), round(items.reduce((sum, one) => sum + one.corrected[1], 0))],
    fills: short.length === 0,
    idle: {
      hours: round(short.reduce((sum, lane) => sum + (hours - lane.end[0]), 0)),
      from: short.length === 0 ? null : Math.min(...short.map((lane) => lane.end[0])),
    },
  };
}

const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A folder as it is compared: forward slashes, lower case, no trailing slash. Windows paths are compared without
 * case, as the file system does. */
const folderKey = (folder) => String(folder).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

/** The session `label` (such as `JH 71`) in the records: the background starts (`started` events) of the project at
 * `root` and the channel's
 * notices whose title begins with it, a longer number being another session. `{ ids, cwds, firstAt, lastAt,
 * closes, stoppedAt }`: its session ids, the worktrees its notices ran in other than `root` (the main checkout, where
 * every session starts; the background record's `worktreePath` is that checkout too, so it is not read), its first and
 * last record, the times of its `closed` notices in order, and when the background record says it was removed; times in ms. `null`
 * when no record names it. */
export function sessionTrail(label, { notices, starts, root }) {
  const head = new RegExp(`^${escaped(label)}(?![0-9A-Za-z])`);
  const timed = (one) => Number.isFinite(Date.parse(one?.at));
  const main = folderKey(root);
  const mine = notices.filter((one) => timed(one) && head.test(String(one?.from?.title ?? '')));
  // The background record is the machine's: a start of another project, or one that names none, is not this one's.
  const started = starts.filter((one) => timed(one) && one.event === 'started' && head.test(String(one.title ?? '')) && isText(one.root) && folderKey(one.root) === main);
  if (mine.length === 0 && started.length === 0) return null;
  const ids = new Set([...mine.map((one) => one.from.id), ...started.map((one) => one.sessionId)].filter(isText));
  const cwds = [...new Set(mine.map((one) => one.cwd).filter(isText).map(folderKey))].filter((folder) => folder !== main);
  const times = [...mine, ...started].map((one) => Date.parse(one.at));
  const closes = mine.filter((one) => one.kind === 'closed').map((one) => Date.parse(one.at)).sort((a, b) => a - b);
  const startIds = new Set(started.map((one) => one.id).filter(isText));
  const removed = starts.filter((one) => timed(one) && one.event === 'removed' && startIds.has(one.id)).map((one) => Date.parse(one.at));
  return { ids, cwds, firstAt: Math.min(...times), lastAt: Math.max(...times), closes, stoppedAt: removed.length === 0 ? null : Math.max(...removed) };
}

/** The gate runs of the gate log's events (`readGateLog`): each start with its end, `{ id, startedAt, seconds,
 * result, session, cwd, failing }`; a gate with no end yet has no seconds. A gate run under the lock of another
 * (`lock: parent`, the check inside a `gate --`) is folded into the one around it: its failing tests are named there
 * and its time is not counted twice. */
export function gateRuns(events) {
  const ends = new Map(events.filter((one) => one?.event === 'end').map((one) => [one.id, one]));
  const runs = events.filter((one) => one?.event === 'start' && Number.isFinite(Date.parse(one.at))).map((start) => {
    const end = ends.get(start.id);
    const seconds = end && Number.isFinite(Date.parse(end.at)) ? (Date.parse(end.at) - Date.parse(start.at)) / 1000 : null;
    const failing = (end?.sensors ?? []).flatMap((sensor) => (Array.isArray(sensor?.failing) ? sensor.failing : []));
    return { id: start.id, startedAt: start.at, seconds, result: end?.result ?? null, session: start.session ?? null, cwd: start.cwd ?? null, failing, nested: start.lock === 'parent' };
  });
  const span = (run) => [Date.parse(run.startedAt), run.seconds === null ? Infinity : Date.parse(run.startedAt) + run.seconds * 1000];
  const kept = [];
  for (const run of runs) {
    const [from, to] = span(run);
    const around = run.nested
      ? runs.filter((other) => !other.nested && span(other)[0] <= from && span(other)[1] >= to).sort((a, b) => span(b)[0] - span(a)[0])[0]
      : undefined;
    if (around) around.failing.push(...run.failing);
    else kept.push(run);
  }
  return kept.map(({ nested, ...run }) => run);
}

/** Whether a gate's `result` is a failure: anything but a pass or an exit 0, once it has ended. */
const failed = (result) => typeof result === 'string' && result !== 'pass' && result !== 'exit 0';

/** Whether a gate ran in a merge queue's candidate folder: the lead's land, never a work session's. */
const inLand = (gate) => /merge-queue/.test(String(gate.cwd ?? ''));

/** Whether `gate` ran for the session of `trail`: by its session id, or, when it names none, in one of its
 * worktrees. A gate that names another session is that session's, even in a worktree the two share. */
function gateOf(gate, trail) {
  if (inLand(gate)) return false;
  if (isText(gate.session)) return trail.ids.has(gate.session);
  if (!isText(gate.cwd)) return false;
  const folder = folderKey(gate.cwd);
  return trail.cwds.some((cwd) => folder === cwd || folder.startsWith(`${cwd}/`));
}

const hoursOf = (ms) => round(ms / HOUR_MS);

/** The runs among `runs` (`{ startedAt, seconds }`) that overlap `[from, to)`, each cut to its part inside, oldest
 * first: a failure that began before the span or ran past it counts only there. `began` keeps the start its record
 * holds. A run with no end yet is left out. */
function clippedTo(runs, from, to) {
  return runs.flatMap((run) => {
    const start = Date.parse(run.startedAt);
    if (!Number.isFinite(run.seconds) || !Number.isFinite(start)) return [];
    const inStart = Math.max(start, from);
    const inEnd = Math.min(start + run.seconds * 1000, to);
    return inEnd > inStart ? [{ ...run, startedAt: new Date(inStart).toISOString(), began: run.startedAt, seconds: (inEnd - inStart) / 1000 }] : [];
  }).sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
}

/** One failure as the return lists it, `at` its start inside the stretch and `began` its record's own, which names it
 * (`stretch explain`); `fixedAt`, when a later run of its kind passed, the end of that run. */
const failure = ({ startedAt, began = startedAt, seconds }, what, fixedAt = null) => ({ at: new Date(Date.parse(startedAt)).toISOString(), began: new Date(Date.parse(began)).toISOString(), seconds, what, fixedAt });

/** Each run of `runs` that `isFailed` with `fixedAt`: the end of the first run of `runs` that started after it and
 * passed (`isPassed`), once it ended by `to`; else `null`. What fixed a failure is the record of a run that passed, never
 * a guess. */
function withFix(runs, isFailed, isPassed, to) {
  const endOf = (run) => Date.parse(run.startedAt) + run.seconds * 1000;
  const passes = runs.filter((run) => isPassed(run) && Number.isFinite(run.seconds) && endOf(run) <= to);
  return runs.filter(isFailed).map((run) => {
    const fix = passes.filter((pass) => Date.parse(pass.startedAt) > Date.parse(run.startedAt)).sort((a, b) => endOf(a) - endOf(b))[0];
    return { ...run, fixedAt: fix ? new Date(endOf(fix)).toISOString() : null };
  });
}

/** The hours `failures` cover, two at once counted once. */
export const lostHoursOf = (failures) => round(busySeconds(failures.map((one) => [Date.parse(one.at), Date.parse(one.at) + one.seconds * 1000])) / 3600);

/** How long a running session may go with no record before it reads as silent: the board's stall. */
const STALL_MS = ruleValue('session-stall', 'minutes') * 60_000;

/** The item `entry` (the plan's, with its `corrected` estimate) measured from its session's `trail` up to `now`:
 * `{ ...entry, state, clipped, lastAt, from, to, realHours, lostHours, failures }`. It runs from the later of
 * `openedAt` and the session's first record (`clipped` when the session started before), to its first `closed` notice
 * after that (`finished`), else to its removal from the background record (`stopped`), else to now (`running`), or,
 * when its last record (a notice, a start or a gate of its own) is older than the stall rule, to that record
 * (`silent`): no record says it worked after it. With no trail it is `queued`. What failed is each failed gate of its
 * session that overlaps that span, the part inside it. */
export function itemMeasure(entry, trail, { openedAt, now, gates }) {
  if (trail === null) return { ...entry, state: 'queued', clipped: false, lastAt: null, from: null, to: null, realHours: 0, lostHours: 0, failures: [] };
  const mine = gates.filter((gate) => gateOf(gate, trail));
  // A gate is a record of its session until it ends; one still running, from its start.
  const gateLast = (gate) => Math.min(now, Date.parse(gate.startedAt) + (Number.isFinite(gate.seconds) ? gate.seconds * 1000 : 0));
  const lastAt = Math.max(trail.lastAt ?? trail.firstAt, ...mine.filter((gate) => Date.parse(gate.startedAt) <= now).map(gateLast));
  const from = Math.max(openedAt, trail.firstAt);
  // A session that closed or was removed before the opening, with no record after it, is done at the opening.
  const doneBefore = lastAt <= from;
  const close = trail.closes.find((one) => one >= from && one <= now) ?? (doneBefore && trail.closes.some((one) => one <= from) ? from : undefined);
  const stoppedAt = trail.stoppedAt !== null && trail.stoppedAt < from && doneBefore ? from : trail.stoppedAt;
  const stopped = close === undefined && stoppedAt !== null && stoppedAt >= from && stoppedAt <= now;
  const silent = close === undefined && !stopped && now - lastAt > STALL_MS;
  const state = close !== undefined ? 'finished' : stopped ? 'stopped' : silent ? 'silent' : 'running';
  const end = { finished: close, stopped: stoppedAt, silent: lastAt, running: now }[state];
  const to = Math.max(from, end);
  const failures = clippedTo(withFix(mine, (gate) => failed(gate.result), (gate) => typeof gate.result === 'string' && !failed(gate.result), now), from, to)
    .map((gate) => failure(gate, `gate ${gate.result}${gate.failing.length ? `: ${gate.failing.join(', ')}` : ''}`, gate.fixedAt));
  return {
    ...entry,
    state,
    clipped: trail.firstAt < openedAt,
    lastAt: new Date(lastAt).toISOString(),
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    realHours: hoursOf(to - from),
    lostHours: lostHoursOf(failures),
    failures,
  };
}

/** What failed inside `[from, to)` that is no item's: the lands that did not exit 0 (`landFacts`), the failed gates
 * run in a land's folder (`gateRuns`), which a land that bisects and lands passes over, and the Codex runs whose
 * outcome is `failed` (`codexFacts`), whose record names no session. A land's gate and the land overlap in time, and
 * `lostHoursOf` counts that time once. The gate log is the machine's: a land's gate counts only when its folder is
 * inside `root`, the main checkout, whose git directory holds the project's merge-queue folders. */
export function stretchLost({ lands, codex, gates = [] }, { from, to, root }) {
  const project = `${folderKey(root)}/`;
  const ours = (gate) => isText(gate.cwd) && folderKey(gate.cwd).startsWith(project);
  // None is fixed by a later pass: these records name no pull request or range, so the pass may be another's, and
  // only an explanation (`stretch explain`) says one was fixed.
  return [
    ...clippedTo(lands.filter((one) => Number.isInteger(one.exit) && one.exit !== 0), from, to).map((one) => failure(one, `land exit ${one.exit}`)),
    ...clippedTo(gates.filter((one) => inLand(one) && ours(one) && failed(one.result)), from, to).map((one) => failure(one, `land gate ${one.result}`)),
    ...clippedTo(codex.filter((one) => one.outcome === 'failed'), from, to).map((one) => failure(one, 'Codex review failed')),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

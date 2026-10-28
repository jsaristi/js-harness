// The stretch's measure (odd/tasks/stretch-protocol.md): a plan read and checked, its items laid in lanes against the
// stretch's hours, each estimate corrected by what the last stretches of its kind took, and each item measured from
// the records: when its session ran, and what of that time failed. Pure: it reads no file and spawns nothing, so a
// test hands it records and the command (bin/stretch.mjs) hands it what it read. What no record holds is not
// measured here, and the command says so.

import { TASK_KINDS } from './contract.mjs';
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
      items: value.items.map(({ id, title, kind, hours, session }) => ({ id, title, kind, hours: [...hours], session: session ?? null })),
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

/** The items (`{ id, corrected: [low, high] }`) laid in `slots` lanes in their order, each to the lane that frees
 * first by the middle estimate: `{ lanes: [{ items: [{ id, start, end }], end }], queued, fills, idle }`, each time a
 * `[low, high]` of hours from the opening. The stretch is filled when no lane ends before `hours` by the low estimate;
 * `idle` is the session-hours left without work before the return by that estimate, and from which hour. */
export function laneOut(items, { slots, hours }) {
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

/** The session `label` (such as `JH 71`) in the records: the background starts (`started` events) and the channel's
 * notices whose title begins with it, a longer number being another session. `{ ids, cwds, firstAt, closes,
 * stoppedAt }`: its session ids, the worktrees its notices ran in other than `root` (the main checkout, where every
 * session starts; the background record's `worktreePath` is that checkout too, so it is not read), its first record,
 * the times of its `closed` notices in order, and when the background record says it was removed; times in ms. `null`
 * when no record names it. */
export function sessionTrail(label, { notices, starts, root }) {
  const head = new RegExp(`^${escaped(label)}(?![0-9A-Za-z])`);
  const timed = (one) => Number.isFinite(Date.parse(one?.at));
  const mine = notices.filter((one) => timed(one) && head.test(String(one?.from?.title ?? '')));
  const started = starts.filter((one) => timed(one) && one.event === 'started' && head.test(String(one.title ?? '')));
  if (mine.length === 0 && started.length === 0) return null;
  const ids = new Set([...mine.map((one) => one.from.id), ...started.map((one) => one.sessionId)].filter(isText));
  const main = folderKey(root);
  const cwds = [...new Set(mine.map((one) => one.cwd).filter(isText).map(folderKey))].filter((folder) => folder !== main);
  const times = [...mine, ...started].map((one) => Date.parse(one.at));
  const closes = mine.filter((one) => one.kind === 'closed').map((one) => Date.parse(one.at)).sort((a, b) => a - b);
  const startIds = new Set(started.map((one) => one.id).filter(isText));
  const removed = starts.filter((one) => timed(one) && one.event === 'removed' && startIds.has(one.id)).map((one) => Date.parse(one.at));
  return { ids, cwds, firstAt: Math.min(...times), closes, stoppedAt: removed.length === 0 ? null : Math.max(...removed) };
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

/** Whether `gate` ran for the session of `trail`: by its session id, or in one of its worktrees. */
function gateOf(gate, trail) {
  if (inLand(gate)) return false;
  if (gate.session && trail.ids.has(gate.session)) return true;
  if (!isText(gate.cwd)) return false;
  const folder = folderKey(gate.cwd);
  return trail.cwds.some((cwd) => folder === cwd || folder.startsWith(`${cwd}/`));
}

const hoursOf = (ms) => round(ms / HOUR_MS);

/** One failure as the return lists it. */
const failure = (startedAt, seconds, what) => ({ at: new Date(Date.parse(startedAt)).toISOString(), seconds, what });

/** The hours `failures` cover, two at once counted once. */
export const lostHoursOf = (failures) => round(busySeconds(failures.map((one) => [Date.parse(one.at), Date.parse(one.at) + one.seconds * 1000])) / 3600);

/** The item `entry` (the plan's, with its `corrected` estimate) measured from its session's `trail` up to `now`:
 * `{ ...entry, state, clipped, from, to, realHours, lostHours, failures }`. It runs from the later of `openedAt` and
 * the session's first record (`clipped` when the session started before), to its first `closed` notice after that
 * (`finished`), else to its removal from the background record (`stopped`), else to now (`running`); with no trail it
 * is `queued`. What failed is each failed gate of its session that started inside that span. */
export function itemMeasure(entry, trail, { openedAt, now, gates }) {
  if (trail === null) return { ...entry, state: 'queued', clipped: false, from: null, to: null, realHours: 0, lostHours: 0, failures: [] };
  const from = Math.max(openedAt, trail.firstAt);
  const close = trail.closes.find((one) => one >= from && one <= now);
  const stopped = close === undefined && trail.stoppedAt !== null && trail.stoppedAt >= from && trail.stoppedAt <= now;
  const state = close !== undefined ? 'finished' : stopped ? 'stopped' : 'running';
  const to = state === 'finished' ? close : stopped ? trail.stoppedAt : Math.max(from, now);
  const failures = gates
    .filter((gate) => failed(gate.result) && Number.isFinite(gate.seconds) && gateOf(gate, trail))
    .filter((gate) => Date.parse(gate.startedAt) >= from && Date.parse(gate.startedAt) < to)
    .map((gate) => failure(gate.startedAt, gate.seconds, `gate ${gate.result}${gate.failing.length ? `: ${gate.failing.join(', ')}` : ''}`))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return {
    ...entry,
    state,
    clipped: trail.firstAt < openedAt,
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
 * `lostHoursOf` counts that time once. */
export function stretchLost({ lands, codex, gates = [] }, { from, to }) {
  const inside = (one) => Date.parse(one.startedAt) >= from && Date.parse(one.startedAt) < to && Number.isFinite(one.seconds);
  return [
    ...lands.filter((one) => inside(one) && Number.isInteger(one.exit) && one.exit !== 0).map((one) => failure(one.startedAt, one.seconds, `land exit ${one.exit}`)),
    ...gates.filter((one) => inside(one) && inLand(one) && failed(one.result)).map((one) => failure(one.startedAt, one.seconds, `land gate ${one.result}`)),
    ...codex.filter((one) => inside(one) && one.outcome === 'failed').map((one) => failure(one.startedAt, one.seconds, 'Codex review failed')),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

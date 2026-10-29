// How far a stretch is expected to move the map (odd/tasks/stretch-forecast.md): each item of the plan may name the
// rows it closes, a phase's open step of the roadmap's checklist or a step of a plan section, and the lanes the
// departure lays (`laneOut`) say by when each item ends. A row counts as closed in the forecast when its item ends by
// the middle of its estimate within the stretch's hours, and the range runs from the rows that close even when the work
// runs long to those that close only when it runs short. The shares are over the map at the opening, so a row added
// while the stretch runs never makes the forecast wrong; `forecastNow` counts the named rows by themselves. Pure: the
// roadmap as `bin/stretch.mjs` read it at a commit in, counts out.

const isText = (value) => typeof value === 'string' && value.trim() !== '';

// The states of a plan step the return draws as done (`STEP_STATE` of ./pages-sections.mjs).
const DONE_STATES = new Set(['done', 'built', 'applied']);

/** Why an item's `closes` (a list of `{ in, step }`, both texts) is refused, or `null`; absent is none. */
export function closesProblem(id, closes) {
  if (closes === undefined) return null;
  if (!Array.isArray(closes)) return `item ${id} says what it closes as a list of { in, step }`;
  if (!closes.every((one) => isText(one?.in) && isText(one?.step))) return `item ${id} names each row it closes by in (a phase or a plan) and step, both texts`;
  return null;
}

/** The row `entry` names in `roadmap` (`{ phases, plans }`): `{ row: { in, step, plan, text } }`, `text` the open step's
 * whole text in a phase whose title is `in` and that starts with `step`, or the id of a plan step not done in the plan
 * section `in`; `{ error }` when it names no such step, or two. A phase title is looked for first. */
export function resolveClose(entry, roadmap) {
  const phase = roadmap.phases.find((one) => one.title === entry.in);
  if (phase) {
    const open = phase.steps.filter((one) => !one.done && one.text.startsWith(entry.step));
    if (open.length === 1) return { row: { in: entry.in, step: entry.step, plan: false, text: open[0].text } };
    return { error: open.length === 0 ? `the phase ${entry.in} has no open step that starts with "${entry.step}"` : `${open.length} open steps of the phase ${entry.in} start with "${entry.step}": say more of its text` };
  }
  const plan = roadmap.plans.find((one) => one.name === entry.in);
  if (!plan) return { error: `the roadmap has no phase or plan named ${entry.in}` };
  const found = plan.steps.find((one) => one.id === entry.step);
  if (!found) return { error: `the ${entry.in} has no step ${entry.step}` };
  if (DONE_STATES.has(found.reported)) return { error: `the step ${entry.step} of the ${entry.in} is already ${found.reported}` };
  return { row: { in: entry.in, step: entry.step, plan: true, text: entry.step } };
}

const middle = ([low, high]) => (low + high) / 2;

// From the soonest to the latest an item can close in the stretch: within it even when long, by the middle, only when
// short, after it, or never while the user is away.
const WHEN = ['sure', 'likely', 'possible', 'beyond', 'waits'];
const IN_FORECAST = new Set(['sure', 'likely']);
const IN_LOW = new Set(['sure']);
const IN_HIGH = new Set(['sure', 'likely', 'possible']);

/** When an item ending at `end` (`[low, high]` hours from the opening) closes within `hours`. */
function whenOf(end, hours) {
  if (end === undefined) return 'waits';
  if (end[1] <= hours) return 'sure';
  if (middle(end) <= hours) return 'likely';
  if (end[0] <= hours) return 'possible';
  return 'beyond';
}

const keyOf = (row) => `${row.in}\u0000${row.text}`;

/** The counts of `scope` (a phase's or a plan's), `done` at the opening, with the rows of `rows` that fall in it. */
function countsOf(done, total, rows) {
  const count = (states) => done + rows.filter((one) => states.has(one.when)).length;
  return { done, total, forecast: count(IN_FORECAST), low: count(IN_LOW), high: count(IN_HIGH) };
}

/** The forecast of a stretch: its `items` (`{ id, waitsFor?, closes? }`), their `lanes` (`laneOut`), its `hours` and the
 * `roadmap` at the opening (`{ done, total, phases, plans }`). `{ named, total, phases, plans, rows, problems }`: the
 * items that name a row, the map's counts in total and by phase (`done` at the opening, `forecast`, `low` and `high`
 * the rows done at the return by the middle, the long and the short end), each plan's steps counted the same way, one
 * row a step with every item that names it and the soonest `when` of theirs, and each entry that names no row. */
export function forecastOf({ items, lanes, hours, roadmap }) {
  const ends = new Map(lanes.flatMap((lane) => lane.items.map((one) => [one.id, one.end])));
  const rows = new Map();
  const problems = [];
  for (const item of items) {
    const when = item.waitsFor ? 'waits' : whenOf(ends.get(item.id), hours);
    for (const entry of item.closes ?? []) {
      const resolved = resolveClose(entry, roadmap);
      if (resolved.error) {
        problems.push({ item: item.id, in: entry.in, step: entry.step, error: resolved.error });
        continue;
      }
      const key = keyOf(resolved.row);
      const known = rows.get(key);
      if (!known) rows.set(key, { ...resolved.row, items: [item.id], when });
      else {
        known.items.push(item.id);
        if (WHEN.indexOf(when) < WHEN.indexOf(known.when)) known.when = when;
      }
    }
  }
  const list = [...rows.values()];
  const mapRows = list.filter((one) => !one.plan);
  return {
    named: items.filter((item) => (item.closes ?? []).length > 0).length,
    total: countsOf(roadmap.done, roadmap.total, mapRows),
    phases: roadmap.phases.map((phase) => ({ title: phase.title, ...countsOf(phase.done, phase.total, mapRows.filter((one) => one.in === phase.title)) })),
    plans: roadmap.plans.map((plan) => ({
      name: plan.name,
      ...countsOf(plan.steps.filter((one) => DONE_STATES.has(one.reported)).length, plan.steps.length, list.filter((one) => one.plan && one.in === plan.name)),
    })),
    rows: list,
    problems,
  };
}

/** Where a forecast's row is in `roadmap` now: `done`, `open`, or `gone` when its phase or plan no longer holds a step
 * of that text or id. */
function nowOf(row, roadmap) {
  if (row.plan) {
    const found = roadmap.plans.find((one) => one.name === row.in)?.steps.find((one) => one.id === row.text);
    return found === undefined ? 'gone' : DONE_STATES.has(found.reported) ? 'done' : 'open';
  }
  const found = roadmap.phases.find((one) => one.title === row.in)?.steps.find((one) => one.text === row.text);
  return found === undefined ? 'gone' : found.done ? 'done' : 'open';
}

/** The stretch measured against its `forecast` with the `roadmap` now: `{ total, phases, plans, rows, forecastDone,
 * gained }`, the map's counts now as `progress` counts them, each plan's steps done now, each row of the forecast with
 * where it is now, how many of the rows the forecast counts are done now (by themselves, so a row added since cannot
 * move it), and how many rows the map gained since the opening (lost, when below zero). */
export function forecastNow(forecast, roadmap) {
  const rows = forecast.rows.map((row) => ({ ...row, now: nowOf(row, roadmap) }));
  const counted = rows.filter((one) => IN_FORECAST.has(one.when));
  return {
    total: { done: roadmap.done, total: roadmap.total },
    phases: roadmap.phases.map((phase) => ({ title: phase.title, done: phase.done, total: phase.total })),
    plans: roadmap.plans.map((plan) => ({ name: plan.name, done: plan.steps.filter((one) => DONE_STATES.has(one.reported)).length, total: plan.steps.length })),
    rows,
    forecastDone: { done: counted.filter((one) => one.now === 'done').length, of: counted.length },
    gained: roadmap.total - forecast.total.total,
  };
}

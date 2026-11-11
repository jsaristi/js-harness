// The statement of what an eval run would cost, made before it spends (G3 of `odd/tasks/future-model-protocol.md`):
// `node evals/suite.mjs ... --plan` prints it and starts nothing. Pure: the suite reads the files, this reads values.
// Zero deps, plain Node.
//
// The figures come from what was recorded, never from a guess. Each cell (task, config, effort) is estimated from the
// newest results file of the same agent and model that holds trials of it; a cell no such file holds is "unknown",
// never borrowed from another model or effort, since a new model's speed and price are what the run is for. The time
// is agent time (`wallMs`), which leaves out each trial's setup and any wait for a usage cap; the cap windows are
// always unknown, because no results file records where a cap stopped a run.

import { estimateCodexCost } from './report.mjs';

const mean = (values) => (values.length === 0 ? null : values.reduce((total, value) => total + value, 0) / values.length);
const agentOf = (doc) => doc?.agent ?? 'claude';
export const cellKey = (task, config, effort) => JSON.stringify([task, config, effort]);

/** What a trial of each cell is estimated at, from `docs` (`[{ name, doc }]`, every results file of the agent's
 * directory): a map from `cellKey` to `{ run, createdAt, trials, wallMs, costUsd }`, the means over the trials of the
 * newest file on `model` and `agent` that holds the cell, a trial with an error left out. `costUsd` is Claude Code's
 * `costUsd` for a Claude trial and `estimateCodexCost` for a Codex one, `null` when none of the trials has one. */
export function cellBasis({ docs, model, agent }) {
  const basis = new Map();
  const newestFirst = docs
    .filter(({ doc }) => doc?.model === model && agentOf(doc) === agent && Array.isArray(doc.trials))
    .sort((a, b) => (String(a.doc.createdAt) < String(b.doc.createdAt) ? 1 : -1));
  for (const { name, doc } of newestFirst) {
    const groups = new Map();
    for (const entry of doc.trials) {
      if (entry.error !== null && entry.error !== undefined) continue;
      const key = cellKey(entry.task, entry.config, entry.effort);
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    for (const [key, entries] of groups) {
      if (basis.has(key)) continue;
      const costOf = agent === 'codex' ? (entry) => estimateCodexCost(entry, model).usd : (entry) => entry.costUsd;
      const costs = entries.map(costOf).filter(Number.isFinite);
      basis.set(key, {
        run: name, createdAt: doc.createdAt, trials: entries.length, wallMs: mean(entries.map((entry) => entry.wallMs).filter(Number.isFinite)), costUsd: mean(costs),
      });
    }
  }
  return basis;
}

/** A task is at an extreme of its record with this many recorded trials or more, and all of them but one at most
 * passed, or failed. Under it a record says too little: nine of nine is where every new case starts. */
export const EXTREME_TRIALS = 10;

/** What was recorded of each task on `model` and `agent`, from `docs`: a map from the task to `{ passed, trials }`,
 * over every results file, configuration and effort, a trial passing when it was graded at 1 (as
 * `evals/incident-score.mjs` counts) and an errored trial counted with the score it has. A results file pins no
 * version of its cases, so the count spans the versions a case has had: it says what a run of the task has given, not
 * what the case as it is now would. It is the item analysis of the set, made where the spend is decided: a task every
 * trial passes, or none does, separates nothing (`odd/tasks/audit-u9-eval-bar.md`, spec 4). */
export function taskRecord({ docs, model, agent }) {
  const record = new Map();
  for (const { doc } of docs) {
    if (doc?.model !== model || agentOf(doc) !== agent || !Array.isArray(doc.trials)) continue;
    for (const entry of doc.trials) {
      if (!Number.isFinite(entry?.score)) continue;
      const cell = record.get(entry.task) ?? { passed: 0, trials: 0 };
      record.set(entry.task, { passed: cell.passed + (entry.score === 1 ? 1 : 0), trials: cell.trials + 1 });
    }
  }
  return record;
}

/** Whether a record of `passed` of `trials` is at an extreme: `never failed`, `never passed`, each within one
 * trial, or `null`. The task's whole record is read, not each of its cells: a task that always passes in one
 * configuration and never in another separates them, which is what a case is for. */
const extremeOf = ({ passed, trials }) => (trials < EXTREME_TRIALS ? null : passed >= trials - 1 ? 'never failed' : passed <= 1 ? 'never passed' : null);

/** The plan of a run: `toRun` are the trials it would run (`{ task, config, effort }`, one per trial), `planned` how
 * many it plans in all. Returns the totals over the trials whose cell has a basis, and the cells that have none.
 * With a `record` (`taskRecord`), `passes` holds what was recorded of each task it would run, in their order, as
 * `{ task, passed, trials, extreme }` (`extremeOf`); without one it is `null`. */
export function runPlan({ planned, toRun, basis, record = null, model, agent }) {
  let known = 0;
  let wallMs = 0;
  let costUsd = 0;
  let costKnown = 0;
  const unknown = new Map();
  const runs = new Map();
  for (const { task, config, effort } of toRun) {
    const cell = basis.get(cellKey(task, config, effort));
    if (cell === undefined || cell.wallMs === null) {
      const label = `${task} ${config} ${effort}`;
      unknown.set(label, (unknown.get(label) ?? 0) + 1);
      continue;
    }
    known += 1;
    wallMs += cell.wallMs;
    if (cell.costUsd !== null) {
      costUsd += cell.costUsd;
      costKnown += 1;
    }
    runs.set(cell.run, cell.createdAt);
  }
  const passes = record === null ? null : [...new Set(toRun.map(({ task }) => task))].map((task) => {
    const cell = record.get(task) ?? { passed: 0, trials: 0 };
    return { task, ...cell, extreme: extremeOf(cell) };
  });
  return { model, agent, planned, toRun: toRun.length, known, wallMs, costUsd, costKnown, unknown: [...unknown], sources: [...runs], passes };
}

const duration = (ms) => {
  const minutes = Math.round(ms / 60000);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
};

/** The lines `--plan` prints for `plan`. */
export function planLines(plan) {
  const lines = [`${plan.planned} trials planned on ${plan.model}, ${plan.toRun} to run`];
  if (plan.toRun === 0) return [...lines, 'nothing to run: every planned trial is recorded'];
  if (plan.known === 0) {
    lines.push(`no estimate: no results file holds a trial of these cells on ${plan.model}`);
  } else {
    const cost = plan.costKnown === 0 ? 'list cost unknown' : `about $${plan.costUsd.toFixed(2)} of list cost${plan.costKnown < plan.known ? ` for ${plan.costKnown} of them` : ''}`;
    lines.push(`estimate for ${plan.known} of the ${plan.toRun} trials to run: about ${duration(plan.wallMs)} of agent time, ${cost}`);
  }
  if (plan.unknown.length > 0) {
    lines.push(`unknown for ${plan.toRun - plan.known} trials, of cells no results file holds on ${plan.model}: ${plan.unknown.map(([label, count]) => `${label} (${count})`).join(', ')}`);
  }
  lines.push('usage-cap windows: unknown, since no results file records where a cap stopped a run');
  if (plan.sources.length > 0) {
    const costSource = plan.agent === 'codex' ? 'tokens at the list prices of CODEX_LIST_PRICES (evals/report.mjs)' : 'Claude Code\'s own costUsd';
    lines.push(`source: ${plan.sources.map(([run, createdAt]) => `${run} (${String(createdAt).slice(0, 10)})`).join(', ')}; agent time leaves out each trial's setup and any wait for a cap; the cost is ${costSource}, a list cost, not what the subscription bills`);
  }
  if (plan.passes) {
    lines.push(`recorded passes on ${plan.model}, a pass being a trial graded at 1, over every recorded run of the model whatever the configuration, the effort and the version of the case then:`);
    for (const { task, passed, trials } of plan.passes) lines.push(trials === 0 ? `  ${task}: no trial recorded` : `  ${task}: passed ${passed} of ${trials} recorded`);
    const at = (extreme) => plan.passes.filter((entry) => entry.extreme === extreme).map((entry) => entry.task);
    const groups = ['never failed', 'never passed'].filter((extreme) => at(extreme).length > 0).map((extreme) => `${at(extreme).join(', ')} (${extreme})`);
    if (groups.length > 0) lines.push(`never failed or never passed, within one trial, in ${EXTREME_TRIALS} recorded trials or more, so a run of them is unlikely to move: ${groups.join('; ')}`);
  }
  return lines;
}

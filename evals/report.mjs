#!/usr/bin/env node
// The eval report: turns the recorded runs in `evals/results/` into the A/B result, per task and effort. Zero deps,
// plain Node.
//
//   node evals/report.mjs [--runs <name,name>] [--results-dir <dir>] [--json]
//                         [--require-complete] [--min-discriminating <n>]
//   node evals/report.mjs --codex-results-dir <dir> [--runs <name,name>] [--results-dir <dir>] [--json]
//
// The first form reports the runs of one host, Claude Code's or Codex's (`--results-dir evals/results/codex`); the
// second prints the two hosts side by side (`odd/tasks/codex-parity.md`, T5).
//
// The rule it applies is the Constraints' bullet on "discriminates" in `odd/tasks/evals.md`: score is the floor and
// cost is what separates, with the predecessor's pure score rule reported beside it so its "0 of 32" stays
// comparable. Tasks, configs, efforts and completeness are read from the trials alone, never from a run's `args`:
// a run continued in two invocations keeps only the last one's `args` (`ab-high` does).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** A reason the report cannot be made, or a result file it will not read: printed as it is, exit 1. */
export class ReportError extends Error {}

const FORMAT = 1;
const CONFIGS = ['minimal', 'current'];
/** A cell needs this many trials for the report to be complete (`--require-complete`). */
export const COMPLETE_TRIALS = 3;
const EFFORT_ORDER = ['low', 'medium', 'high', 'xhigh', 'max'];

// ---- statistics --------------------------------------------------------------------------------------------------

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const known = (values) => values.filter(finite);
const mean = (values) => (values.length === 0 ? null : values.reduce((total, value) => total + value, 0) / values.length);
/** The sample standard deviation (n - 1); unknown below two values, because one value has no spread to speak of. */
const sampleSd = (values) => {
  if (values.length < 2) return null;
  const center = mean(values);
  return Math.sqrt(values.reduce((total, value) => total + (value - center) ** 2, 0) / (values.length - 1));
};
const pooledSd = (a, b) => Math.sqrt((a ** 2 + b ** 2) / 2);
// Rounded before a comparison, as `suite.mjs` does: a gap that is 0.02 on paper (1 - 0.98) must not land at
// 0.020000000000000018 and read as larger than the tolerance.
const round = (value) => Math.round(value * 1e9) / 1e9;

// ---- agents ------------------------------------------------------------------------------------------------------

/** The CLIs whose runs the report reads. A results document names its agent only when it is not Claude Code
 * (`suite.mjs`, `AGENTS`): every document F5 recorded names none, and none of them is ever rewritten. A report
 * follows the same rule (`buildReport`), so what is printed for F5's runs is what was printed before Codex. */
const AGENTS = ['claude', 'codex'];
const agentOf = (run) => run?.agent ?? 'claude';

// ---- the estimated cost of a Codex trial -------------------------------------------------------------------------

/** The published list price of each model a Codex run is measured on, in US dollars per 1M tokens, with where and
 * when it was read. Codex reports tokens and no dollars, so the cost of a Codex trial is these rates applied to its
 * tokens: an ESTIMATE, and every place that shows it says so. Claude Code's `costUsd` is a list cost too, which is
 * what keeps one unit across the hosts and the verdict rule as it is (`odd/tasks/codex-parity.md`, Constraints).
 *
 * The rates are the standard tier's for a request of at most 272K input tokens. Above that the published rates are
 * higher (input 4.00, cached input 0.20, cache writes 5.00, output 15.00), and a record cannot tell which a request
 * was: its usage is summed per turn, and a turn holds several requests. So every token is priced at the rates
 * below, and the estimate is a lower bound in that respect. A model that is not here has no price: there is no
 * fallback, because a cost at another model's rates would be a number about nothing. */
export const CODEX_LIST_PRICES = {
  'gpt-6.1-sol': {
    source: 'https://developers.openai.com/api/docs/pricing',
    read: '2026-10-05',
    tier: 'standard tier, short context (requests of at most 272K input tokens)',
    usdPerMillion: { input: 2.00, cachedInput: 0.10, cacheWrite: 2.50, output: 10.00 },
  },
};
const listPrice = (model) => (Object.hasOwn(CODEX_LIST_PRICES, model) ? CODEX_LIST_PRICES[model] : null);

const isCount = (value) => finite(value) && value >= 0;

/** Why the counts of a Codex record cannot be read the way the report reads them, or `null` when they can; `needed`
 * are the counts the caller cannot do without.
 *
 * ASSUMED, not verified, and for the first real trials (`odd/tasks/codex-parity.md`, T6) to settle, since both
 * counts were 0 in the only two real sessions seen (`agent-output.mjs`, `summarizeCodexUsage`): that the cache
 * writes are a part of `input_tokens`, as the cached input is known to be, and that the reasoning tokens are a part
 * of `output_tokens`. A record that cannot be so, with more cached and cache-written tokens than input tokens or
 * more reasoning tokens than output tokens, is named with that reason instead of read: clamping the remainder at 0
 * or adding the part on top would be choosing the answer the assumption was meant to give. */
function codexCountsProblem(entry, needed) {
  const lacking = needed.filter((field) => !isCount(entry[field]));
  if (lacking.length > 0) return `it does not record ${lacking.join(', ')} as a count`;
  const parts = ['cachedInputTokens', 'cacheWriteInputTokens'].reduce((total, field) => total + (isCount(entry[field]) ? entry[field] : 0), 0);
  if (parts > entry.inputTokens) return `its cached input and cache writes (${parts}) exceed its input tokens (${entry.inputTokens}), so they are not all a part of them, as assumed`;
  if (isCount(entry.reasoningOutputTokens) && entry.reasoningOutputTokens > entry.outputTokens) {
    return `its reasoning tokens (${entry.reasoningOutputTokens}) exceed its output tokens (${entry.outputTokens}), so they are not a part of them, as assumed`;
  }
  return null;
}

const COST_COUNTS = ['inputTokens', 'cachedInputTokens', 'cacheWriteInputTokens', 'outputTokens'];

/** The estimated list cost of one Codex trial on `model`, `{ usd, reason }`: its input tokens that were neither
 * read from the cache nor written to it at the input rate, the cached ones and the cache writes each at their own,
 * and the output tokens, reasoning inside them, at the output rate (`CODEX_LIST_PRICES`). `usd` is `null`, with the
 * `reason`, for a model without a list price and for a record `codexCountsProblem` refuses: an unknown cost is left
 * out of a cell's mean and counted out, like a Claude trial without `costUsd`. The reasoning count is checked when
 * the record has it and is never priced by itself. Nothing is stored: the estimate is made each time a report is. */
export function estimateCodexCost(entry, model) {
  const price = listPrice(model);
  if (price === null) return { usd: null, reason: `no list price is recorded for model ${JSON.stringify(model)}` };
  const problem = codexCountsProblem(entry, COST_COUNTS);
  if (problem !== null) return { usd: null, reason: problem };
  const { input, cachedInput, cacheWrite, output } = price.usdPerMillion;
  const uncached = entry.inputTokens - entry.cachedInputTokens - entry.cacheWriteInputTokens;
  return { usd: (uncached * input + entry.cachedInputTokens * cachedInput + entry.cacheWriteInputTokens * cacheWrite + entry.outputTokens * output) / 1e6, reason: null };
}

// ---- tokens ------------------------------------------------------------------------------------------------------

const MODEL_COUNTS = ['inputTokens', 'cacheReadInputTokens', 'cacheCreationInputTokens', 'outputTokens'];

/** The tokens of one trial, `{ input, output }` (each `null` when unknown), input being the input, cache reads and
 * cache writes. They are summed over every model of its `modelUsage`, because the session's subagents ran on models
 * of their own. A trial without a usable `modelUsage` (an older record, one that lacks a count or holds a negative one, an empty object) has
 * unknown tokens: its `inputTokens` and `outputTokens` count the main thread only, and a mean over both measures
 * would compare a whole session with part of one.
 *
 * That is a Claude Code record, the default. A Codex record (`agent` `codex`) has no `modelUsage`, and its two
 * counts already mean the same: `inputTokens` holds the cached input once (`agent-output.mjs`) and, as assumed,
 * the cache writes, where Claude Code reports both on top of its input; `outputTokens` holds, as assumed, the
 * reasoning, as Claude Code's holds the thinking. So nothing is added to either, and a record that contradicts an
 * assumption (`codexCountsProblem`) has unknown tokens, since its counts would then leave a part out. */
export function trialTokens(entry, agent = 'claude') {
  if (agent === 'codex') {
    return codexCountsProblem(entry, ['inputTokens', 'outputTokens']) === null ? { input: entry.inputTokens, output: entry.outputTokens } : { input: null, output: null };
  }
  const models = isObject(entry.modelUsage) ? Object.values(entry.modelUsage) : [];
  if (models.length === 0 || !models.every((model) => isObject(model) && MODEL_COUNTS.every((field) => finite(model[field]) && model[field] >= 0))) {
    return { input: null, output: null };
  }
  const total = (...fields) => models.reduce((sum, model) => sum + fields.reduce((inner, field) => inner + model[field], 0), 0);
  return { input: total('inputTokens', 'cacheReadInputTokens', 'cacheCreationInputTokens'), output: total('outputTokens') };
}

// ---- cells -------------------------------------------------------------------------------------------------------

/** One cell per task, effort and config that has a trial, in the order they first appear. A cell holds `n` (every
 * trial recorded), `errors` (those that recorded an `error`), the score's `{ known, mean, min, max, sd }`, the
 * cost's `{ known, mean, sd }` in US dollars (each trial's `costUsd`, Claude Code's list cost of the whole session),
 * and the mean input tokens (cache included) and output tokens (both `trialTokens`), wall time and turns, each over
 * the trials that know it.
 *
 * A trial with an `error` counts, with the score it was graded at: the runner records an agent that timed out or
 * exited badly because its workspace may hold work worth scoring and "a failure rate is itself a result"
 * (`evals/runner.mjs`, `runTrial`), so leaving those out would flatter a config that fails. A trial the runner
 * never recorded (a usage cap, an authentication failure) is not in the results at all. The cell counts the errors
 * so the table can show them. A value a trial does not know (no `costUsd`, a `null` score) is left out of its mean and
 * counted out in `known`, never read as 0.
 *
 * `agent` says whose records these are, Claude Code's when it is not given. For Codex's, on `model`, the cost of a
 * trial is `estimateCodexCost` in place of the `costUsd` Codex does not report, and the tokens are read as Codex
 * records them (`trialTokens`); the cell has the same shape, so the verdict rule is fed the same way. */
export function buildCells(trials, { agent = 'claude', model } = {}) {
  const costOf = agent === 'codex' ? (entry) => estimateCodexCost(entry, model).usd : (entry) => entry.costUsd;
  const groups = new Map();
  for (const entry of trials) {
    const key = JSON.stringify([entry.task, entry.effort, entry.config]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return [...groups.values()].map((group) => {
    const scores = known(group.map((entry) => entry.score));
    const costs = known(group.map(costOf));
    const tokens = group.map((entry) => trialTokens(entry, agent));
    return {
      task: group[0].task,
      effort: group[0].effort,
      config: group[0].config,
      n: group.length,
      errors: group.filter((entry) => entry.error !== null && entry.error !== undefined).length,
      score: { known: scores.length, mean: mean(scores), min: scores.length === 0 ? null : Math.min(...scores), max: scores.length === 0 ? null : Math.max(...scores), sd: sampleSd(scores) },
      cost: { known: costs.length, mean: mean(costs), sd: sampleSd(costs) },
      inputTokens: mean(known(tokens.map((count) => count.input))),
      outputTokens: mean(known(tokens.map((count) => count.output))),
      wallMs: mean(known(group.map((entry) => entry.wallMs))),
      turns: mean(known(group.map((entry) => entry.turns))),
    };
  });
}

// ---- verdicts ----------------------------------------------------------------------------------------------------

/** The scores of two configs are equal when their means differ by at most this, or by no more than their pooled
 * standard deviation, whichever is larger: one hidden check in about fifty. Near-ceiling scores have almost no
 * spread, so the pooled deviation alone would call one missed check in nine trials a difference. */
export const SCORE_TOLERANCE = 0.02;
/** A cell needs this many trials, with a known score and a known cost, to be compared at all. */
const MIN_TRIALS_TO_COMPARE = 2;

const comparable = (cell) => cell !== null && cell.n >= MIN_TRIALS_TO_COMPARE
  && cell.score.known >= MIN_TRIALS_TO_COMPARE && cell.cost.known >= MIN_TRIALS_TO_COMPARE;

/** The verdict of one task at one effort from its two cells (`null` for a config that has none), minimal against
 * current. `verdict` is:
 *   - `incomplete` when either cell has fewer than 2 trials, or fewer than 2 known scores or costs;
 *   - `score` when the scores are not equal (`SCORE_TOLERANCE`): the higher mean score wins, at any cost;
 *   - `cost` when they are equal and the mean costs differ by more than their pooled standard deviation: the
 *     cheaper config wins, since it gets the same result, and `costRatio` is current / minimal;
 *   - `none` otherwise.
 * `predecessor` is the old rule beside it: the score gap beyond the pooled score deviation, `null` when a config
 * has fewer than 2 known scores. Differences are current minus minimal. */
export function compareCells(minimal, current) {
  const either = minimal ?? current;
  const result = {
    task: either?.task ?? null,
    effort: either?.effort ?? null,
    minimal,
    current,
    verdict: 'incomplete',
    winner: null,
    scoreDiff: null,
    pooledScoreSd: null,
    costDiff: null,
    pooledCostSd: null,
    costRatio: null,
    predecessor: null,
  };
  const scored = minimal !== null && current !== null && minimal.score.known >= MIN_TRIALS_TO_COMPARE && current.score.known >= MIN_TRIALS_TO_COMPARE;
  if (scored) {
    result.scoreDiff = current.score.mean - minimal.score.mean;
    result.pooledScoreSd = pooledSd(minimal.score.sd, current.score.sd);
    result.predecessor = round(Math.abs(result.scoreDiff)) > round(result.pooledScoreSd);
  }
  if (!comparable(minimal) || !comparable(current)) return result;

  result.costDiff = current.cost.mean - minimal.cost.mean;
  result.pooledCostSd = pooledSd(minimal.cost.sd, current.cost.sd);
  result.costRatio = minimal.cost.mean === 0 ? null : current.cost.mean / minimal.cost.mean;
  const equal = round(Math.abs(result.scoreDiff)) <= round(Math.max(SCORE_TOLERANCE, result.pooledScoreSd));
  if (!equal) {
    result.verdict = 'score';
    result.winner = result.scoreDiff > 0 ? 'current' : 'minimal';
  } else if (round(Math.abs(result.costDiff)) > round(result.pooledCostSd)) {
    result.verdict = 'cost';
    result.winner = result.costDiff < 0 ? 'current' : 'minimal';
  } else {
    result.verdict = 'none';
  }
  return result;
}

// ---- runs --------------------------------------------------------------------------------------------------------

const effortRank = (effort) => (EFFORT_ORDER.includes(effort) ? EFFORT_ORDER.indexOf(effort) : EFFORT_ORDER.length);
const byEffort = (a, b) => effortRank(a) - effortRank(b) || (a < b ? -1 : a > b ? 1 : 0);
const trialLabel = (entry) => `${entry.task} ${entry.config} ${entry.effort} #${entry.repeat}`;

function checkTrial(entry, where) {
  if (!isObject(entry) || ![entry.task, entry.config, entry.effort].every((value) => typeof value === 'string' && value !== '') || !Number.isInteger(entry.repeat)) {
    throw new ReportError(`${where} holds a trial without a task, config, effort and repeat`);
  }
  if (!CONFIGS.includes(entry.config)) throw new ReportError(`${where} holds a trial of config ${JSON.stringify(entry.config)}: the report compares ${CONFIGS.join(' and ')}`);
}

function readRun(file, name) {
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new ReportError(`${file} cannot be read as JSON (${err.message})`);
  }
  if (!isObject(doc) || doc.format !== FORMAT || !Array.isArray(doc.trials)) throw new ReportError(`${file} is not a results file of format ${FORMAT}`);
  // How a record's tokens and cost are read depends on the agent, so one the report does not know cannot be read.
  if (!AGENTS.includes(agentOf(doc))) throw new ReportError(`${file} is a run of agent ${JSON.stringify(doc.agent)}: the report reads the runs of ${AGENTS.join(' and ')}`);
  doc.trials.forEach((entry) => checkTrial(entry, file));
  return { name, file, doc };
}

/** The runs to report on, `[{ name, file, doc }]`: every `*.json` in `dir` in name order (a `*.tmp` is a write in
 * flight, and is not one), or the ones in `names`, in that order. A run is named by its file. An empty directory, a
 * name with no file and a file that is not a results document of format 1 are a `ReportError` naming them: a
 * report that skipped what it could not read would answer a question nobody asked. */
export function loadRuns({ dir, names }) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new ReportError(`no results directory at ${dir}`);
  const available = fs.readdirSync(dir).filter((file) => file.endsWith('.json')).map((file) => file.slice(0, -'.json'.length)).sort();
  if (names === undefined && available.length === 0) throw new ReportError(`no results (*.json) in ${dir}`);
  const wanted = names ?? available;
  const missing = wanted.filter((name) => !available.includes(name));
  if (missing.length > 0) throw new ReportError(`no results named ${missing.join(', ')} in ${dir} (found: ${available.join(', ') || 'none'})`);
  return wanted.map((name) => readRun(path.join(dir, `${name}.json`), name));
}

// Stable text for deep equality of what a run recorded about itself.
const canonical = (value) => (Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : isObject(value) ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value === undefined ? null : value));
const shown = (value) => (value === undefined ? 'missing' : JSON.stringify(value));

/** What differs between two runs' stacks, as `[{ field, a, b }]` with the field named `stack.<key>`. */
function stackDifferences(a, b) {
  const left = isObject(a) ? a : {};
  const right = isObject(b) ? b : {};
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()
    .filter((key) => canonical(left[key]) !== canonical(right[key]))
    .map((key) => ({ field: `stack.${key}`, a: left[key], b: right[key] }));
}

const holdsCurrent = (doc) => (doc.trials ?? []).some((entry) => entry.config === 'current');
/** A setup as the first 12 characters of its sha256, enough to tell two apart in a refusal. */
const setupOf = (doc) => (typeof doc.setup?.sha256 === 'string' ? `sha256 ${doc.setup.sha256.slice(0, 12)}` : null);

/** Throws a `ReportError` when the runs cannot be read together: an agent, a model, a permission mode or a stack that
 * differs from the first run's (deep equality), or the same trial (task, config, effort, repeat) recorded twice, in
 * two runs or in one. Half the trials on one CLI and half on another measure neither, and a trial counted twice would
 * shrink every spread. Every difference is listed, so the message names all that must be fixed. A run that names
 * no agent is Claude Code's (`AGENTS`). Two runs that both hold current trials must also share their setup. */
export function checkRuns(runs) {
  const problems = [];
  const [first, ...rest] = runs;
  for (const run of rest) {
    const pairs = [
      ['agent', agentOf(first.doc), agentOf(run.doc)],
      ['model', first.doc.model, run.doc.model],
      ['permission mode', first.doc.permissionMode, run.doc.permissionMode],
      ...stackDifferences(first.doc.stack, run.doc.stack).map(({ field, a, b }) => [field, a, b]),
      // The setup of the current arm (G6 of `odd/tasks/future-model-protocol.md`), compared only between runs that
      // both hold current trials: a run of the minimal arm alone has none to compare, and two runs recorded before
      // setups were have none either, which reads as equal, as an unknown version does.
      ...(holdsCurrent(first.doc) && holdsCurrent(run.doc) ? [['setup', setupOf(first.doc), setupOf(run.doc)]] : []),
    ];
    for (const [field, a, b] of pairs) {
      if (canonical(a) !== canonical(b)) problems.push(`runs ${first.name} and ${run.name} differ in ${field}: ${shown(a)} vs ${shown(b)}`);
    }
  }
  const seen = new Map();
  for (const run of runs) {
    for (const entry of run.doc.trials) {
      const key = JSON.stringify([entry.task, entry.config, entry.effort, entry.repeat]);
      if (!seen.has(key)) {
        seen.set(key, run.name);
      } else {
        const earlier = seen.get(key);
        problems.push(earlier === run.name ? `trial ${trialLabel(entry)} is recorded twice in run ${run.name}` : `trial ${trialLabel(entry)} is recorded in runs ${earlier} and ${run.name}`);
      }
    }
  }
  if (problems.length > 0) throw new ReportError(`the runs cannot be read together:\n${problems.map((problem) => `  ${problem}`).join('\n')}`);
}

// ---- the report --------------------------------------------------------------------------------------------------

/** The A/B result of the runs: `{ runs, model, permissionMode, stack, efforts }`, `efforts` being one entry per effort
 * that has a trial, in order of effort, with `rows` (the verdict of each task at that effort, tasks in name order,
 * see `compareCells`) and `counts` (`tasks`, one count per verdict, and `discriminating`, the tasks whose verdict
 * is `score` or `cost`). Tasks, configs and efforts come from the trials alone, never from a run's `args`: a run
 * continued in two invocations keeps only the last one's. Throws a `ReportError` for runs that cannot be read
 * together (`checkRuns`), and for runs that hold no trial at all (a run a usage cap stopped before its first
 * trial): with no effort to check, both gates would pass on nothing.
 *
 * The report of Codex runs has two keys more, after `runs` and after `stack`: `agent`, and `costEstimate`, which
 * says that every cost in it is an estimate and at what price (`codexCostEstimate`). A report of Claude Code runs
 * has neither, as a results document of Claude Code names no agent: it is what it was before Codex. */
export function buildReport(runs) {
  checkRuns(runs);
  const trials = runs.flatMap((run) => run.doc.trials);
  if (trials.length === 0) throw new ReportError(`the runs ${runs.map((run) => run.name).join(', ')} hold no trial: a report of nothing is not a pass`);
  const agent = agentOf(runs[0].doc);
  const { model } = runs[0].doc;
  const cells = buildCells(trials, { agent, model });
  const efforts = [...new Set(cells.map((cell) => cell.effort))].sort(byEffort);
  const cellOf = (task, effort, config) => cells.find((cell) => cell.task === task && cell.effort === effort && cell.config === config) ?? null;
  return {
    runs: runs.map((run) => run.name).sort(),
    ...(agent !== 'claude' && { agent }),
    model,
    permissionMode: runs[0].doc.permissionMode,
    stack: runs[0].doc.stack,
    ...(agent === 'codex' && { costEstimate: codexCostEstimate(trials, model) }),
    efforts: efforts.map((effort) => {
      const tasks = [...new Set(cells.filter((cell) => cell.effort === effort).map((cell) => cell.task))].sort();
      const rows = tasks.map((task) => compareCells(cellOf(task, effort, 'minimal'), cellOf(task, effort, 'current')));
      const count = (verdict) => rows.filter((row) => row.verdict === verdict).length;
      return {
        effort,
        rows,
        counts: { tasks: rows.length, score: count('score'), cost: count('cost'), none: count('none'), incomplete: count('incomplete'), discriminating: count('score') + count('cost') },
      };
    }),
  };
}

/** What the costs of a report of Codex runs are: `{ estimated: true, model, price, unknown }`, `price` being the
 * entry of `CODEX_LIST_PRICES` they were estimated at, or `null` for a model that has none (then no trial has a
 * cost), and `unknown` the trials whose own record gave no estimate, as `[{ trial, reason }]`. */
function codexCostEstimate(trials, model) {
  const price = listPrice(model);
  const unknown = price === null ? [] : trials
    .map((entry) => ({ trial: trialLabel(entry), reason: estimateCodexCost(entry, model).reason }))
    .filter((entry) => entry.reason !== null);
  return { estimated: true, model, price, unknown };
}

/** Claude Code against Codex, from the report of each host's runs (`buildReport`, so each side has passed its own
 * `checkRuns`): `{ claude, codex, rows }`. `claude` and `codex` say what each side was (`runs`, `model`,
 * `permissionMode`, `stack`, and Codex's `costEstimate`), and `rows` holds one entry per task, config and effort
 * that either host recorded, `{ task, config, effort, claude, codex }`, each host's value being its cell
 * (`buildCells`) or `null` when it recorded no trial there: a cell only one host ran is a row, never left out.
 * Rows are in order of task name, then config, then effort. The two hosts ran different models, so nothing here
 * decides between them: it is the two measurements side by side. */
export function buildComparison(claude, codex) {
  const cellsOf = (report) => report.efforts.flatMap(({ rows }) => rows.flatMap((row) => CONFIGS.map((config) => row[config]).filter((cell) => cell !== null)));
  const sideOf = (report) => ({
    runs: report.runs, model: report.model, permissionMode: report.permissionMode, stack: report.stack,
    ...(report.costEstimate !== undefined && { costEstimate: report.costEstimate }),
  });
  const keyOf = (cell) => JSON.stringify([cell.task, cell.config, cell.effort]);
  const sides = { claude: new Map(cellsOf(claude).map((cell) => [keyOf(cell), cell])), codex: new Map(cellsOf(codex).map((cell) => [keyOf(cell), cell])) };
  const rows = [...new Set([...sides.claude.keys(), ...sides.codex.keys()])].map((key) => {
    const [task, config, effort] = JSON.parse(key);
    return { task, config, effort, claude: sides.claude.get(key) ?? null, codex: sides.codex.get(key) ?? null };
  }).sort((a, b) => (a.task < b.task ? -1 : a.task > b.task ? 1 : 0) || CONFIGS.indexOf(a.config) - CONFIGS.indexOf(b.config) || byEffort(a.effort, b.effort));
  return { claude: sideOf(claude), codex: sideOf(codex), rows };
}

/** The cells that fail `--require-complete`: for every task at every effort that appears in the runs, each config
 * with fewer than `COMPLETE_TRIALS` trials (a config with none at all included, with `n` 0), as
 * `[{ task, effort, config, n }]` in report order. */
export function incompleteCells(report) {
  return report.efforts.flatMap(({ rows }) => rows.flatMap((row) => CONFIGS
    .map((config) => ({ task: row.task, effort: row.effort, config, n: row[config]?.n ?? 0 }))
    .filter((cell) => cell.n < COMPLETE_TRIALS)));
}

/** The result of `--min-discriminating <n>`: `{ n, ok, perEffort: [{ effort, count, ok }] }`, `ok` when every effort
 * in the runs has at least `n` tasks that discriminate. The bar is never lowered for an effort with few tasks. */
export function checkDiscriminating(report, n) {
  const perEffort = report.efforts.map(({ effort, counts }) => ({ effort, count: counts.discriminating, tasks: counts.tasks, ok: counts.discriminating >= n }));
  return { n, ok: perEffort.every((entry) => entry.ok), perEffort };
}

// ---- the command -------------------------------------------------------------------------------------------------

export const USAGE = [
  'Usage: node evals/report.mjs [--runs <name,name>] [--results-dir <dir>] [--json] [--require-complete] [--min-discriminating <n>]',
  '       node evals/report.mjs --codex-results-dir <dir> [--runs <name,name>] [--results-dir <dir>] [--json]',
  '',
  '  --runs <list>              report only these runs of the results directory (default: every *.json)',
  '  --results-dir <dir>        where the runs are (default: evals/results); the runs of one agent, Claude Code or Codex',
  '  --json                     print one JSON document instead of the tables',
  `  --require-complete         exit 1 unless every cell of a task and effort in the runs has ${COMPLETE_TRIALS} trials for both configs`,
  '  --min-discriminating <n>   exit 1 unless at every effort at least n tasks have the verdict score or cost',
  '  --codex-results-dir <dir>  print Claude Code against Codex instead: the Claude Code runs of the results directory beside',
  '                             every Codex run of <dir> (evals/results/codex), per task, config and effort; takes neither gate',
  '',
  'The cost of a Codex trial is an estimate: Codex reports tokens and no cost, so they are priced at the published list price.',
  'Exit codes: 0 reported, 1 refused (runs that cannot be read together) or a gate failed, 2 usage error.',
].join('\n');

export class UsageError extends Error {}

const RUN_NAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?$/;

/** The command line as `{ runs, resultsDir, codexResultsDir, json, requireComplete, minDiscriminating }` (`undefined`
 * or `false` for what was not given). A flag that is unknown, repeated or missing its value, a value that is not a
 * positive integer for `--min-discriminating`, and a run name that is not a plain file name are a `UsageError`. So
 * is a gate given with `--codex-results-dir`: a gate holds the A/B result of one host, the comparison is of two, and
 * a gate that was typed and checked nothing would let a command pass for one it was not. */
export function parseArgs(argv) {
  const options = { runs: undefined, resultsDir: undefined, codexResultsDir: undefined, json: false, requireComplete: false, minDiscriminating: undefined };
  const given = new Set();
  const once = (flag) => {
    if (given.has(flag)) throw new UsageError(`${flag} was given twice`);
    given.add(flag);
  };
  const valueOf = (flag, index) => {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new UsageError(`${flag} requires a value`);
    return value;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--json' || token === '--require-complete') {
      once(token);
      options[token === '--json' ? 'json' : 'requireComplete'] = true;
    } else if (token === '--runs') {
      once(token);
      const names = valueOf(token, i).split(',');
      if (names.some((name) => !RUN_NAME_PATTERN.test(name))) throw new UsageError(`--runs needs a comma separated list of run names (file names without .json), got ${JSON.stringify(argv[i + 1])}`);
      const twice = names.find((name, index) => names.indexOf(name) !== index);
      if (twice !== undefined) throw new UsageError(`--runs: ${JSON.stringify(twice)} is listed twice`);
      options.runs = names;
      i += 1;
    } else if (token === '--results-dir' || token === '--codex-results-dir') {
      once(token);
      options[token === '--results-dir' ? 'resultsDir' : 'codexResultsDir'] = valueOf(token, i);
      i += 1;
    } else if (token === '--min-discriminating') {
      once(token);
      const value = valueOf(token, i);
      if (!/^[1-9]\d*$/.test(value)) throw new UsageError(`--min-discriminating needs a positive integer, got ${JSON.stringify(value)}`);
      options.minDiscriminating = Number(value);
      i += 1;
    } else if (token.startsWith('--')) {
      throw new UsageError(`unknown argument ${token}`);
    } else {
      throw new UsageError(`unexpected argument ${JSON.stringify(token)}`);
    }
  }
  if (options.codexResultsDir !== undefined) {
    const gate = ['--require-complete', '--min-discriminating'].find((flag) => given.has(flag));
    if (gate !== undefined) throw new UsageError(`${gate} is not taken with --codex-results-dir: a gate holds the A/B result of one host, and the comparison is of two`);
  }
  return options;
}

// ---- the text report ---------------------------------------------------------------------------------------------

const scoreText = (value) => (finite(value) ? value.toFixed(2) : '?');
const costText = (value) => (finite(value) ? `$${value.toFixed(2)}` : '?');
const countText = (value) => (!finite(value) ? '?' : value >= 1e6 ? `${(value / 1e6).toFixed(2)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value)));
const durationText = (ms) => {
  if (!finite(ms)) return '?';
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`;
};
const table = (header, body) => {
  const widths = header.map((cell, column) => Math.max(cell.length, ...body.map((line) => line[column].length)));
  return [header, ...body].map((line) => line.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd());
};

/** A cell's mean score with its spread, `0.98 [0.96-1.00]`; `-` for a config with no trial. */
const spreadText = (cell) => (cell === null ? '-' : `${scoreText(cell.score.mean)} [${scoreText(cell.score.min)}-${scoreText(cell.score.max)}]`);
const verdictText = (row) => (row.winner === null ? row.verdict : `${row.verdict}: ${row.winner}`);
const tokensOf = (cell) => (cell === null || !finite(cell.inputTokens) || !finite(cell.outputTokens) ? null : cell.inputTokens + cell.outputTokens);

const stackText = (stack) => Object.entries(stack ?? {}).map(([key, value]) => `${key} ${value ?? 'unknown'}`).join(', ');
const errorText = (cell) => `${cell.errors} of ${cell.n} trials recorded an error (counted, with the score they were graded at)`;

// What a cost is, said wherever one is shown. Claude Code's wording is the one F5's report has always printed.
const CLAUDE_COST = "Claude Code's list cost of the whole session, subagents included, in US dollars";
const VERDICT_RULE = 'cost verdicts need the scores equal (0.02 or the pooled deviation) and a gap above the pooled cost deviation';
/** The column label of a cost that is an estimate, so the table says it and not only the line above it. */
const ESTIMATED_COST = 'est. cost';
/** What the costs of Codex runs are (`codexCostEstimate`), in words: an estimate, at which price, read where and
 * when, and in what respect a lower bound; or that there is none. */
function estimateText({ model, price }) {
  if (price === null) return `unknown: no list price is recorded for model ${model} (CODEX_LIST_PRICES in evals/report.mjs) and Codex reports no cost, so none is estimated`;
  const rate = (value) => `$${value.toFixed(2)}`;
  const { input, cachedInput, cacheWrite, output } = price.usdPerMillion;
  return `ESTIMATED, since Codex reports tokens and no cost: each trial's tokens at the list price of ${model}, ${price.tier}: input ${rate(input)}, cached input ${rate(cachedInput)}, `
    + `cache writes ${rate(cacheWrite)}, output ${rate(output)} per 1M tokens, in US dollars (${price.source}, read ${price.read}); a lower bound where a request was over that context, which a record cannot tell`;
}
const unestimatedLines = (estimate) => (estimate?.unknown ?? []).map(({ trial, reason }) => `cost not estimated for ${trial}: ${reason}`);
// Decided in T4 (`odd/tasks/codex-parity.md`, Progress): the download happens inside the agent process, and nothing
// in a record separates it from `wallMs`, so every wall time of a Codex trial is shown with this beside it.
const CODEX_WALL = "a Codex trial's wall time includes its per-trial setup download (curated plugins and marketplaces, about 60 MB, more in the current arm), "
  + 'which has no counterpart in a Claude trial and is not measured apart';

function effortLines({ effort, rows }, costLabel = 'cost') {
  const per = (cell, pick) => (cell === null ? '-' : pick(cell));
  const body = rows.map((row) => [
    row.task,
    `${row.minimal?.n ?? 0}/${row.current?.n ?? 0}`,
    spreadText(row.minimal), spreadText(row.current),
    per(row.minimal, (cell) => costText(cell.cost.mean)), per(row.current, (cell) => costText(cell.cost.mean)),
    finite(row.costRatio) ? `${row.costRatio.toFixed(2)}x` : '-',
    per(row.minimal, (cell) => countText(tokensOf(cell))), per(row.current, (cell) => countText(tokensOf(cell))),
    per(row.minimal, (cell) => durationText(cell.wallMs)), per(row.current, (cell) => durationText(cell.wallMs)),
    verdictText(row),
    row.predecessor === null ? '-' : row.predecessor ? 'yes' : 'no',
  ]);
  const lines = [`effort ${effort}`, ...table(
    ['task', 'n min/cur', 'score min', 'score cur', `${costLabel} min`, `${costLabel} cur`, 'cur/min', 'tokens min', 'tokens cur', 'wall min', 'wall cur', 'verdict', 'old rule'],
    body,
  )];
  for (const row of rows) {
    for (const config of CONFIGS) {
      const cell = row[config];
      if (cell !== null && cell.errors > 0) lines.push(`${row.task} ${config}: ${errorText(cell)}`);
    }
  }
  return lines;
}

/** The report as text: a table per effort (task, trials per config, mean score and its [min-max] per config, cost
 * in US dollars, the ratio current / minimal, input + output tokens, wall time, the verdict and whether the predecessor's rule
 * would call it a difference), then the count of discriminating tasks per effort.
 *
 * A report of Codex runs names its agent, says in the cost line and in the column labels that its costs are
 * estimates and at what price, says what its wall times include, and names each trial whose cost was not estimated.
 * A report of Claude Code runs is, to the byte, what it was before there was a second agent. */
export function formatReport(report, { minDiscriminating } = {}) {
  const codex = agentOf(report) === 'codex';
  const lines = [
    `runs: ${report.runs.join(', ')}`,
    `${codex ? `agent ${report.agent}, ` : ''}model ${report.model}, permission mode ${report.permissionMode}`,
    `stack: ${stackText(report.stack)}`,
    `cost: ${codex ? estimateText(report.costEstimate) : CLAUDE_COST}; ${VERDICT_RULE}`,
  ];
  if (codex) lines.push(`wall: ${CODEX_WALL}`);
  for (const entry of report.efforts) lines.push('', ...effortLines(entry, codex ? ESTIMATED_COST : 'cost'));
  if (unestimatedLines(report.costEstimate).length > 0) lines.push('', ...unestimatedLines(report.costEstimate));
  lines.push('', 'Discriminating tasks per effort (verdict score or cost):');
  for (const { effort, counts } of report.efforts) lines.push(`  ${effort}: ${counts.discriminating} of ${counts.tasks} (score ${counts.score}, cost ${counts.cost}, none ${counts.none}, incomplete ${counts.incomplete})`);
  if (minDiscriminating !== undefined) {
    const { ok } = checkDiscriminating(report, minDiscriminating);
    lines.push(`  required: at least ${minDiscriminating} at every effort, ${ok ? 'met' : 'not met'}`);
  }
  return `${lines.join('\n')}\n`;
}

/** The comparison (`buildComparison`) as text: what each side was, one table with a row per task, config and effort
 * (the trials of each host, then each host's mean score, input + output tokens, cost and wall time, formatted as
 * `formatReport` formats them), and the notes without which the columns would be read wrong. A cell a host did not
 * record reads `missing` in that host's columns; `?` is a value the host recorded trials for and does not know. */
export function formatComparison(comparison) {
  const sideLine = (name) => `${name}: runs ${comparison[name].runs.join(', ')}; model ${comparison[name].model}; stack: ${stackText(comparison[name].stack)}`;
  const per = (cell, pick) => (cell === null ? 'missing' : pick(cell));
  const pair = (row, pick) => [per(row.claude, pick), per(row.codex, pick)];
  const body = comparison.rows.map((row) => [
    row.task, row.config, row.effort,
    `${row.claude?.n ?? 0}/${row.codex?.n ?? 0}`,
    ...pair(row, (cell) => scoreText(cell.score.mean)),
    ...pair(row, (cell) => countText(tokensOf(cell))),
    ...pair(row, (cell) => costText(cell.cost.mean)),
    ...pair(row, (cell) => durationText(cell.wallMs)),
  ]);
  const lines = [
    'Claude Code against Codex: one row per task, config and effort, each value the mean over the trials of its cell that know it',
    sideLine('claude'),
    sideLine('codex'),
    '',
    ...table(
      ['task', 'config', 'effort', 'n claude/codex', 'score claude', 'score codex', 'tokens claude', 'tokens codex', 'cost claude', `${ESTIMATED_COST} codex`, 'wall claude', 'wall codex'],
      body,
    ),
  ];
  for (const row of comparison.rows) {
    for (const host of AGENTS) {
      if (row[host] !== null && row[host].errors > 0) lines.push(`${row.task} ${row.config} ${row.effort}, ${host}: ${errorText(row[host])}`);
    }
  }
  lines.push(
    '',
    `cost: ${CLAUDE_COST}, beside a Codex cost that is ${estimateText(comparison.codex.costEstimate)}`,
    ...unestimatedLines(comparison.codex.costEstimate),
    "tokens: input plus output as each host reports them, the cache reads and cache writes counted once in the input and the reasoning in the output; Claude Code's are summed over every model "
      + "of the session, subagents included, Codex's over the turns of the session; that Codex counts its cache writes inside its input and its reasoning inside its output is assumed, "
      + 'and a trial whose record contradicts it has unknown tokens and no estimated cost',
    `wall: ${CODEX_WALL}`,
  );
  return `${lines.join('\n')}\n`;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The command. Resolves to the exit code: 0 for a report printed, 1 for runs it refuses to read together (an agent,
 * model, permission mode or stack that differs, a trial recorded twice, a file it cannot read), for a gate that failed
 * (the report is still printed, the failure goes to stderr) and 2 for a usage error. A refusal prints nothing as a
 * result. Everything it prints goes through `deps.stdout` and `deps.stderr`; `deps.resultsDir` is the directory
 * `--results-dir` overrides. Nothing here writes a file or runs anything: it only reads.
 *
 * With `--codex-results-dir <dir>` it prints the comparison instead (`buildComparison`): the report of the results
 * directory, which must be of Claude Code runs, beside the report of every run in `<dir>`, which must be of Codex
 * runs. Each side is built as a report of its own, so each is refused for what would refuse it alone, and a side
 * that holds the other agent's runs is refused too: the columns would be named for a host that did not run them. */
export async function reportMain(argv, env = process.env, deps = {}) {
  const { stdout = process.stdout, stderr = process.stderr, resultsDir = path.join(HERE, 'results') } = deps;
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    stderr.write(`${error.message}\n\n${USAGE}\n`);
    return 2;
  }
  let report;
  let comparison = null;
  try {
    const dir = path.resolve(options.resultsDir ?? resultsDir);
    report = buildReport(loadRuns({ dir, names: options.runs }));
    if (options.codexResultsDir !== undefined) {
      if (agentOf(report) !== 'claude') throw new ReportError(`the results directory ${dir} holds runs of ${agentOf(report)}: the comparison reads the Claude Code runs there, and the Codex ones in --codex-results-dir`);
      const codexDir = path.resolve(options.codexResultsDir);
      const codex = buildReport(loadRuns({ dir: codexDir }));
      if (agentOf(codex) !== 'codex') throw new ReportError(`--codex-results-dir ${codexDir} holds runs of ${agentOf(codex)}: the comparison reads the Codex runs there`);
      comparison = buildComparison(report, codex);
    }
  } catch (error) {
    if (!(error instanceof ReportError)) throw error;
    stderr.write(`${error.message}\n`);
    return 1;
  }
  if (comparison !== null) {
    stdout.write(options.json ? `${JSON.stringify(comparison, null, 2)}\n` : formatComparison(comparison));
    return 0;
  }

  const missing = options.requireComplete ? incompleteCells(report) : null;
  const discriminating = options.minDiscriminating === undefined ? null : checkDiscriminating(report, options.minDiscriminating);
  if (options.json) {
    const checks = {
      requireComplete: missing === null ? null : { ok: missing.length === 0, required: COMPLETE_TRIALS, missing },
      minDiscriminating: discriminating,
    };
    stdout.write(`${JSON.stringify({ ...report, checks }, null, 2)}\n`);
  } else {
    stdout.write(formatReport(report, { minDiscriminating: options.minDiscriminating }));
  }

  const failures = [];
  if (missing !== null && missing.length > 0) {
    failures.push(`--require-complete: cells with fewer than ${COMPLETE_TRIALS} trials:`);
    for (const cell of missing) failures.push(`  ${cell.task} ${cell.effort} ${cell.config}: ${cell.n} of ${COMPLETE_TRIALS} trials`);
  }
  if (discriminating !== null && !discriminating.ok) {
    failures.push(`--min-discriminating ${discriminating.n}: not met at every effort:`);
    for (const entry of discriminating.perEffort.filter((item) => !item.ok)) failures.push(`  ${entry.effort}: ${entry.count} of ${entry.tasks} tasks discriminate, ${discriminating.n} are needed`);
  }
  if (failures.length > 0) {
    stderr.write(`${failures.join('\n')}\n`);
    return 1;
  }
  return 0;
}

// Run as a command, not when imported by a test. Compared as resolved paths, not as URLs: on Windows
// `import.meta.url` and `process.argv[1]` spell the same file differently.
const fold = (text) => (process.platform === 'win32' ? text.toLowerCase() : text);
if (process.argv[1] && fold(path.resolve(process.argv[1])) === fold(fileURLToPath(import.meta.url))) {
  process.exitCode = await reportMain(process.argv.slice(2), process.env);
}

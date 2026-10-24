#!/usr/bin/env node
// The subagent report: turns the recorded runs in `evals/results/subagents/` into the two arms side by side, per
// delegation mode and task (`odd/tasks/subagent-model-routing.md`). Zero deps, plain Node.
//
//   node evals/subagents-report.mjs [--runs <name,name>] [--results-dir <dir>] [--modes <mode,mode>] [--require-complete]
//
// It reads the results documents alone, never the raw logs, which are not committed: what a trial's transcripts said
// is in its record (`listCost`, `transcript-usage.mjs`). It decides nothing between the arms: it is the two
// measurements, with what makes any of them doubtful said beside them. `evals/report.mjs` reads F5's two arms and
// refuses these configs, as this one refuses those: the two kinds of run keep their results apart (`suite.mjs`).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DELEGATION_MODES, SUBAGENT_CONFIGS, SUBAGENT_MODELS } from './configs.mjs';
import { usd } from './prices.mjs';
import { COMPLETE_TRIALS, ReportError, UsageError, checkRuns } from './report.mjs';

const FORMAT = 1;
/** Where a run of subagent configs keeps its results, inside `evals/results` (`suite.mjs`, `SUBAGENTS_DIR`). */
const SUBAGENTS_DIR = 'subagents';
/** The arms, the first being the one every other is compared with, and the delegation modes: `configs.mjs` owns
 * both, and a trial's arm and mode are read from its config's entry there, never from the config's name. */
const ARMS = Object.keys(SUBAGENT_MODELS);
const [BASELINE, ...COMPARED] = ARMS;
const MODES = Object.keys(DELEGATION_MODES);
/** The tasks the measurement is made on (the feature document, Design). They are named here because nothing else
 * says which three of the eval tasks the matrix holds: a run that left one out must read as incomplete, and it
 * would not if the tasks were taken from the trials. A task outside these that a run recorded is reported after
 * them and held to the same rule. */
export const TASKS = ['format-v2', 'house-rules', 'lost-updates'];
const EFFORT_ORDER = ['low', 'medium', 'high', 'xhigh', 'max'];

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const known = (values) => values.filter(finite);
const sum = (values) => values.reduce((total, value) => total + value, 0);
const mean = (values) => (values.length === 0 ? null : sum(values) / values.length);
/** `{ known, mean }` of the values that are known: an unknown one is left out and counted out, never read as 0. */
const stat = (values) => ({ known: known(values).length, mean: mean(known(values)) });
// Rounded before it is shown or compared, as `report.mjs` does: 1 - 0.98 must not land at 0.020000000000000018.
const round = (value) => Math.round(value * 1e9) / 1e9;
const trialLabel = (entry) => `${entry.task} ${entry.config} ${entry.effort} #${entry.repeat}`;

// ---- what a trial says -------------------------------------------------------------------------------------------

/** Whether a trial delegated: `counted` when its `subagentStats.spawned` is at least 1, `none` when it is 0, and
 * `unknown` when there is no such count, which is what a trial that died before printing a result records. Only a
 * counted trial is in any figure (the feature document, Constraints): one that did the work alone measures nothing
 * about a subagent, and one that cannot say is not taken to have delegated. */
function delegationOf(entry) {
  const spawned = entry.subagentStats?.spawned;
  if (!finite(spawned)) return 'unknown';
  return spawned >= 1 ? 'counted' : 'none';
}

/** Dollars of a record as whole billionths of a dollar, or `null` for a cost the record does not know. A record
 * holds `usd(nanoUsd)` (`prices.mjs`), so this is the whole number it was made from: money is added and averaged as
 * that, and turned into dollars once, when it is printed. */
const nanoOf = (dollars) => (finite(dollars) ? Math.round(dollars * 1e9) : null);

/** The list cost of a trial, by what its record's `listCost` is (`transcript-usage.mjs`, `trialListCost`):
 *   - `measured`, from the session transcripts: `orchestrator`, `subagents` and `total`, each `null` when it holds
 *     a model without a list price;
 *   - `estimated`, from `modelUsage` because no transcript gave a request: a range, `low` to `high`, with no split
 *     between the two sides, both `null` when it could not be priced;
 *   - `unknown`, when the record holds neither.
 * The three are never added together: a mean that mixed a measured cost with a range would be neither. */
function costOf(entry) {
  const cost = isObject(entry.listCost) ? entry.listCost : {};
  if (cost.source === 'transcripts') {
    return { kind: 'measured', orchestrator: nanoOf(cost.orchestrator?.listCostUsd), subagents: nanoOf(cost.subagents?.listCostUsd), total: nanoOf(cost.total?.listCostUsd) };
  }
  if (cost.source === 'modelUsage') return { kind: 'estimated', low: nanoOf(cost.total?.listCostUsd?.low), high: nanoOf(cost.total?.listCostUsd?.high) };
  return { kind: 'unknown' };
}

/** A count of `subagent_stats`: a number, or an object of numbers by reason (who killed a subagent, why one was
 * refused), which is summed. `null` for a count the stats do not hold. */
const outcomeOf = (value) => (finite(value) ? value : isObject(value) ? sum(known(Object.values(value))) : null);
const OUTCOMES = ['spawned', 'completed', 'failed', 'killed', 'refused'];

const money = (nano) => `$${usd(nano).toFixed(4)}`;
const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/** The kinds of flag, in the order they are listed, each with the words of its count. */
const FLAG_KINDS = {
  error: 'error',
  estimatedCost: 'estimated cost',
  noListCost: 'no list cost',
  transcriptsWithoutRequests: 'transcripts without a request',
  modelUsageMismatch: 'modelUsage mismatch',
  unpricedModels: 'unpriced model',
  longPrompt: 'long-prompt requests',
  transcriptErrors: 'transcript errors',
  unreadableLines: 'unreadable lines',
  unsplitCacheWrites: 'cache writes of unknown lifetime',
};

/** What makes the figures of one trial doubtful, as `[{ kind, text }]` in the order of `FLAG_KINDS`; none for a
 * trial whose record is clean. A flag never takes a trial out of a figure: it says what the reader should know
 * before trusting it. They are read from the record alone:
 *   - `error`: the trial recorded one (it is still graded and counted, as in `report.mjs`);
 *   - `estimatedCost`, `noListCost`: the cost is not a measured one (`costOf`);
 *   - `transcriptsWithoutRequests`: transcripts were kept and none gave a request, so the estimate stands in for them;
 *   - `modelUsageMismatch`: the transcript totals differ from what Claude Code printed (`modelUsageCheck`);
 *   - `unpricedModels`: a model without a list price, which leaves every cost it is part of unknown;
 *   - `longPrompt`: requests priced above the base rate, by model (`prices.mjs`);
 *   - `transcriptErrors`: what could not be kept or summarized (`transcripts.errors`);
 *   - `unreadableLines`, `unsplitCacheWrites`: lines no usage was read from, and cache writes priced as 5-minute
 *     ones because no line said how long they live. */
function flagsOf(entry) {
  const flags = [];
  const flag = (kind, text) => flags.push({ kind, text });
  const cost = isObject(entry.listCost) ? entry.listCost : {};
  const read = costOf(entry);
  const kept = isObject(entry.transcripts) ? entry.transcripts : {};
  if (entry.error !== null && entry.error !== undefined) flag('error', `error ${entry.error}`);
  if (read.kind === 'estimated') flag('estimatedCost', `cost estimated from modelUsage, ${read.low === null || read.high === null ? 'range unknown' : `${money(read.low)} to ${money(read.high)}`}`);
  if (read.kind === 'unknown') flag('noListCost', `no list cost recorded${finite(kept.files) ? ` (${plural(kept.files, 'transcript file')} kept)` : ''}`);
  if (finite(cost.transcriptsWithoutRequests) && cost.transcriptsWithoutRequests > 0) flag('transcriptsWithoutRequests', `${plural(cost.transcriptsWithoutRequests, 'kept transcript')} held no readable request`);
  if (cost.modelUsageCheck?.matches === false) {
    const models = Object.entries(isObject(cost.modelUsageCheck.models) ? cost.modelUsageCheck.models : {}).filter(([, matches]) => matches === false).map(([model]) => model);
    flag('modelUsageMismatch', `transcript totals differ from modelUsage${models.length > 0 ? ` for ${models.join(', ')}` : ''}`);
  }
  if (Array.isArray(cost.unpricedModels) && cost.unpricedModels.length > 0) flag('unpricedModels', `no list price for ${cost.unpricedModels.join(', ')}`);
  if (finite(cost.total?.longPromptRequests) && cost.total.longPromptRequests > 0) {
    const models = Object.entries(isObject(cost.total.models) ? cost.total.models : {}).filter(([, tally]) => tally?.longPromptRequests > 0).map(([model, tally]) => `${model} ${tally.longPromptRequests}`);
    flag('longPrompt', `${plural(cost.total.longPromptRequests, 'request')} over the long-prompt limit${models.length > 0 ? ` (${models.join(', ')})` : ''}`);
  }
  if (Array.isArray(kept.errors) && kept.errors.length > 0) flag('transcriptErrors', `transcripts: ${kept.errors.join('; ')}`);
  if (finite(cost.unreadableLines) && cost.unreadableLines > 0) flag('unreadableLines', `${plural(cost.unreadableLines, 'unreadable transcript line')}`);
  if (finite(cost.unsplitCacheWriteTokens) && cost.unsplitCacheWriteTokens > 0) flag('unsplitCacheWrites', `${plural(cost.unsplitCacheWriteTokens, 'cache-write token')} of unknown lifetime, priced as 5-minute writes`);
  return flags;
}

// ---- cells -------------------------------------------------------------------------------------------------------

/** A mean of whole billionths of a dollar, as one: the sum is exact, and the mean is rounded once. */
const meanNano = (values) => (values.length === 0 ? null : Math.round(sum(values) / values.length));

/** One cell: the trials recorded for a task, mode, arm and effort (`recorded` of them), and every figure over the
 * `counted` ones alone (`delegationOf`); `notDelegated` and `unknown` are the others. A cell with no trial has every
 * count 0 and every figure unknown.
 *
 *   score, passes      the hidden grader's score, `{ known, mean, min, max }`, and how many trials passed every check
 *   cost               `orchestrator`, `subagents` and `total`, each `{ known, mean }` in billionths of a dollar over
 *                      the MEASURED costs that know it; and `estimate`, `{ known, low, high }`, the mean range of
 *                      the estimated ones, kept apart (`costOf`)
 *   wallMs, turns      `{ known, mean }`
 *   outcomes           the totals of `subagent_stats` over the counted trials, `null` for a count none of them
 *                      holds, and `byType`, the subagents by type
 *   errors             the counted trials that recorded an error: they count, with the score they were graded at
 *
 * A value a trial does not know is left out of its mean and counted out in `known`, never read as 0. */
function buildCell(trials) {
  const counted = trials.filter((entry) => delegationOf(entry) === 'counted');
  const scores = known(counted.map((entry) => entry.score));
  const costs = counted.map(costOf);
  const measured = (part) => {
    const values = known(costs.filter((cost) => cost.kind === 'measured').map((cost) => cost[part]));
    return { known: values.length, mean: meanNano(values) };
  };
  const estimates = costs.filter((cost) => cost.kind === 'estimated' && cost.low !== null && cost.high !== null);
  const outcome = (name) => {
    const values = known(counted.map((entry) => outcomeOf(entry.subagentStats[name])));
    return values.length === 0 ? null : sum(values);
  };
  const byType = {};
  for (const entry of counted) {
    for (const [type, count] of Object.entries(isObject(entry.subagentStats.by_type) ? entry.subagentStats.by_type : {})) if (finite(count)) byType[type] = (byType[type] ?? 0) + count;
  }
  return {
    recorded: trials.length,
    counted: counted.length,
    notDelegated: trials.filter((entry) => delegationOf(entry) === 'none').length,
    unknown: trials.filter((entry) => delegationOf(entry) === 'unknown').length,
    errors: counted.filter((entry) => entry.error !== null && entry.error !== undefined).length,
    score: { known: scores.length, mean: mean(scores), min: scores.length === 0 ? null : Math.min(...scores), max: scores.length === 0 ? null : Math.max(...scores) },
    passes: scores.filter((score) => score === 1).length,
    cost: {
      orchestrator: measured('orchestrator'), subagents: measured('subagents'), total: measured('total'),
      estimate: { known: estimates.length, low: meanNano(estimates.map((cost) => cost.low)), high: meanNano(estimates.map((cost) => cost.high)) },
    },
    wallMs: stat(counted.map((entry) => entry.wallMs)),
    turns: stat(counted.map((entry) => entry.turns)),
    outcomes: { ...Object.fromEntries(OUTCOMES.map((name) => [name, outcome(name)])), byType },
  };
}

/** One arm against the baseline, from their cells: the score and the pass rate as a difference (the arm minus the
 * baseline), the measured costs, the wall time and the turns as a ratio (the arm over the baseline). Each is `null`
 * when either side does not know it, and a ratio also when the baseline is 0. An estimated cost is compared with
 * nothing.
 *
 * The passes are compared as rates, each over the trials of its own cell whose score is known, and never as counts:
 * the two cells need not hold as many counted trials (one that did not delegate is in neither figure), and two
 * passes of two against three of three is no trial failed, not one pass fewer. */
function compareCells(arm, cell, baseline) {
  const ratio = (a, b) => (finite(a) && finite(b) && b !== 0 ? round(a / b) : null);
  const both = cell.score.known > 0 && baseline.score.known > 0;
  return {
    arm,
    against: BASELINE,
    scoreDiff: both ? round(cell.score.mean - baseline.score.mean) : null,
    passRateDiff: both ? round(cell.passes / cell.score.known - baseline.passes / baseline.score.known) : null,
    cost: Object.fromEntries(['orchestrator', 'subagents', 'total'].map((part) => [part, ratio(cell.cost[part].mean, baseline.cost[part].mean)])),
    wallMs: ratio(cell.wallMs.mean, baseline.wallMs.mean),
    turns: ratio(cell.turns.mean, baseline.turns.mean),
  };
}

// ---- runs --------------------------------------------------------------------------------------------------------

const shown = (value) => (value === undefined ? 'missing' : JSON.stringify(value));

function checkTrial(entry, where) {
  if (!isObject(entry) || ![entry.task, entry.config, entry.effort].every((value) => typeof value === 'string' && value !== '') || !Number.isInteger(entry.repeat)) {
    throw new ReportError(`${where} holds a trial without a task, config, effort and repeat`);
  }
  if (!Object.hasOwn(SUBAGENT_CONFIGS, entry.config)) throw new ReportError(`${where} holds a trial of config ${JSON.stringify(entry.config)}: this report reads the subagent configs (${Object.keys(SUBAGENT_CONFIGS).join(', ')})`);
}

function readRun(file, name) {
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new ReportError(`${file} cannot be read as JSON (${err.message})`);
  }
  if (!isObject(doc) || doc.format !== FORMAT || !Array.isArray(doc.trials)) throw new ReportError(`${file} is not a results file of format ${FORMAT}`);
  // A document names its agent only when it is not Claude Code (`suite.mjs`), and the subagent configs are its alone.
  if ((doc.agent ?? 'claude') !== 'claude') throw new ReportError(`${file} is a run of agent ${JSON.stringify(doc.agent)}: the subagent configs are Claude Code's alone`);
  doc.trials.forEach((entry) => checkTrial(entry, file));
  return { name, file, doc };
}

/** The runs to report on, `[{ name, file, doc }]`: every `*.json` in `dir` in name order (a `*.tmp` is a write in
 * flight, and is not one), or the ones in `names`, in that order. No directory and no results are no run at all,
 * `[]`: nothing is recorded before the first trial of the feature, and the command says so (`subagentsReportMain`).
 * A name with no file and a file that is not a results document of subagent configs are a `ReportError` naming
 * them: a report that skipped what it could not read would answer a question nobody asked. */
export function loadRuns({ dir, names }) {
  const there = fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  const available = there ? fs.readdirSync(dir).filter((file) => file.endsWith('.json')).map((file) => file.slice(0, -'.json'.length)).sort() : [];
  const wanted = names ?? available;
  const missing = wanted.filter((name) => !available.includes(name));
  if (missing.length > 0) throw new ReportError(`no results named ${missing.join(', ')} in ${dir} (found: ${available.join(', ') || 'none'})`);
  return wanted.map((name) => readRun(path.join(dir, `${name}.json`), name));
}

/** Throws a `ReportError` when what the runs pinned of their configs (`subagentConfigs`: `configs.mjs`,
 * `subagentPin`) does not let them be read as the arms of this report. A config with a trial must be pinned to the
 * model of its arm: the arm is named for that model, so a run that forced another one measured something else. And
 * a delegation mode must have been one text, by its digest, in both arms and in every run: the mode is what the arms
 * are told alike (the feature document, Constraints), so arms collected before and after an edit of the text differ
 * in more than the model, and half the trials of a config told one thing and half another are no cell. One run can
 * hold two digests of a mode too: a continued run that gains an arm keeps the pin of the first (`suite.mjs`). A
 * config with a trial and no digest is refused for the same reason as one with no model: what its trials were told
 * cannot be compared, and two missing digests are not two equal ones. The text is not compared with today's
 * `configs.mjs`: a recorded run stays a measurement of what it was told when the text is later edited. */
function checkPins(runs) {
  const problems = [];
  const texts = new Map();
  for (const run of runs) {
    for (const config of new Set(run.doc.trials.map((entry) => entry.config))) {
      const pin = isObject(run.doc.subagentConfigs) && isObject(run.doc.subagentConfigs[config]) ? run.doc.subagentConfigs[config] : {};
      const { arm, mode, subagentModel } = SUBAGENT_CONFIGS[config];
      if (pin.model !== subagentModel) problems.push(`run ${run.name} pins ${config} to subagent model ${shown(pin.model)}, and the ${arm} arm is ${subagentModel}`);
      const digest = pin.delegationSha256;
      if (typeof digest !== 'string' || digest === '') {
        problems.push(`run ${run.name} records no delegation digest for ${config}: what its trials were told cannot be compared with the other arm's`);
        continue;
      }
      const earlier = texts.get(mode);
      if (earlier === undefined) texts.set(mode, { run: run.name, config, digest });
      else if (earlier.digest !== digest) problems.push(`delegation mode ${mode} was not one text: run ${earlier.run} gave ${earlier.config} SHA-256 ${shown(earlier.digest)} and run ${run.name} gave ${config} ${shown(digest)}`);
    }
  }
  if (problems.length > 0) throw new ReportError(`the runs cannot be read as the arms of this report:\n${problems.map((problem) => `  ${problem}`).join('\n')}`);
}

// ---- the report --------------------------------------------------------------------------------------------------

const effortRank = (effort) => (EFFORT_ORDER.includes(effort) ? EFFORT_ORDER.indexOf(effort) : EFFORT_ORDER.length);
const byEffort = (a, b) => effortRank(a) - effortRank(b) || (a < b ? -1 : a > b ? 1 : 0);

/** The two arms side by side, from the runs:
 *
 *   runs, model, permissionMode, stack   what the runs were, the first run's (`checkRuns` holds the others to it)
 *   arms                                 `[{ arm, subagentModel }]`, the baseline first
 *   prices                               every price table a recorded cost was computed from (`PRICE_SOURCE`)
 *   efforts                              per effort that has a trial, `modes`: per delegation mode, `rows`: per task
 *                                        of the matrix (`TASKS`, then any other a run recorded), `cells` by arm
 *                                        (`buildCell`) and `compared`, each other arm against the baseline
 *   trials, notCounted                   how many trials are recorded, and the ones in no figure, as
 *                                        `[{ trial, reason, score, error }]`
 *   flags, flagCounts                    the trials with something to flag, `[{ trial, flags }]` (`flagsOf`), and how
 *                                        many trials carry each kind
 *   modes, leftOut                       the delegation modes reported, and what the runs hold of the others, as
 *                                        `[{ mode, trials }]` for each that has a trial
 *
 * `modes` are the delegation modes that count (`--modes`), every one of `configs.mjs` when not given. A trial of
 * another mode is in nothing above: no cell, no effort, no task, no list and no count but `leftOut`, which is there
 * so that what was recorded and is not reported is said and not dropped. So a report of some modes may hold no trial
 * at all (`trials` 0, no effort), which the command takes for nothing recorded.
 *
 * Arms, modes and efforts are read from the trials through `configs.mjs`, never from a run's `args`: a run continued
 * in two invocations keeps only the last one's. Throws a `ReportError` for runs that cannot be read together
 * (`checkRuns` of `report.mjs`: a model, a permission mode or a stack that differs, a trial recorded twice) or as
 * these arms (`checkPins`). Both hold every trial of the runs, of a mode that is left out too: a document that
 * cannot be read as a whole is not read in part. */
export function buildSubagentsReport(runs, { modes = MODES } = {}) {
  checkRuns(runs);
  checkPins(runs);
  const modeOf = (entry) => SUBAGENT_CONFIGS[entry.config].mode;
  const recorded = runs.flatMap((run) => run.doc.trials);
  const trials = recorded.filter((entry) => modes.includes(modeOf(entry)));
  const cellTrials = (task, effort, arm, mode) => trials.filter((entry) => entry.task === task && entry.effort === effort && SUBAGENT_CONFIGS[entry.config].arm === arm && SUBAGENT_CONFIGS[entry.config].mode === mode);
  const tasks = [...TASKS, ...[...new Set(trials.map((entry) => entry.task))].filter((task) => !TASKS.includes(task)).sort()];
  const flags = trials.map((entry) => ({ trial: trialLabel(entry), flags: flagsOf(entry) })).filter((entry) => entry.flags.length > 0);
  const unique = (values) => [...new Map(values.map((value) => [JSON.stringify(value), value])).values()];
  return {
    runs: runs.map((run) => run.name).sort(),
    model: runs[0].doc.model,
    permissionMode: runs[0].doc.permissionMode,
    stack: runs[0].doc.stack,
    arms: ARMS.map((arm) => ({ arm, subagentModel: SUBAGENT_MODELS[arm] })),
    prices: unique(trials.map((entry) => entry.listCost?.prices).filter(isObject)),
    efforts: [...new Set(trials.map((entry) => entry.effort))].sort(byEffort).map((effort) => ({
      effort,
      modes: modes.map((mode) => ({
        mode,
        rows: tasks.map((task) => {
          const cells = Object.fromEntries(ARMS.map((arm) => [arm, buildCell(cellTrials(task, effort, arm, mode))]));
          return { task, cells, compared: COMPARED.map((arm) => compareCells(arm, cells[arm], cells[BASELINE])) };
        }),
      })),
    })),
    trials: trials.length,
    notCounted: trials.filter((entry) => delegationOf(entry) !== 'counted').map((entry) => ({
      trial: trialLabel(entry),
      reason: delegationOf(entry) === 'none' ? 'did not delegate' : `recorded no spawned count${entry.error ? ` (${entry.error})` : ''}`,
      score: entry.score ?? null,
      error: entry.error ?? null,
    })),
    flags,
    flagCounts: Object.fromEntries(Object.keys(FLAG_KINDS).map((kind) => [kind, flags.filter((entry) => entry.flags.some((item) => item.kind === kind)).length])),
    modes,
    leftOut: MODES.filter((mode) => !modes.includes(mode)).map((mode) => ({ mode, trials: recorded.filter((entry) => modeOf(entry) === mode).length })).filter((entry) => entry.trials > 0),
  };
}

/** What a report left out (`leftOut`), in words: `2 trials of explore, 1 trial of verify`. */
const leftOutText = (leftOut) => leftOut.map((entry) => `${plural(entry.trials, 'trial')} of ${entry.mode}`).join(', ');

/** The cells that fail `--require-complete`: every cell of the matrix, in the modes of the report (`--modes`), at
 * every effort its trials ran at, with fewer than
 * `COMPLETE_TRIALS` counted trials, as `[{ task, mode, arm, effort, required, counted, notRecorded, notDelegated,
 * unknown }]` in report order. The last three say why it is short: trials nobody ran, trials that did the work
 * alone, and trials that recorded no spawned count. The number is `report.mjs`'s, the three repeats of the design,
 * and not a run's `--repeats`: the first batch of the feature runs one repeat, and would pass on a third of it. */
export function incompleteCells(report) {
  return report.efforts.flatMap(({ effort, modes }) => modes.flatMap(({ mode, rows }) => rows.flatMap(({ task, cells }) => ARMS
    .map((arm) => ({
      task, mode, arm, effort, required: COMPLETE_TRIALS, counted: cells[arm].counted,
      notRecorded: Math.max(0, COMPLETE_TRIALS - cells[arm].recorded), notDelegated: cells[arm].notDelegated, unknown: cells[arm].unknown,
    }))
    .filter((cell) => cell.counted < COMPLETE_TRIALS))));
}

// ---- the command -------------------------------------------------------------------------------------------------

export const USAGE = [
  'Usage: node evals/subagents-report.mjs [--runs <name,name>] [--results-dir <dir>] [--modes <mode,mode>] [--require-complete]',
  '',
  '  --runs <list>        report only these runs of the results directory (default: every *.json)',
  `  --results-dir <dir>  where the runs are (default: evals/results/${SUBAGENTS_DIR})`,
  `  --modes <list>       report and require only these delegation modes, of ${MODES.join(', ')} (default: all); the trials`,
  '                       recorded of the others are counted in one line and are in nothing else',
  `  --require-complete   exit 1 unless every cell of the matrix (${ARMS.length} arms, the modes reported, ${TASKS.length} tasks) has ${COMPLETE_TRIALS} trials that spawned a subagent`,
  '',
  'A trial counts only when it spawned at least one subagent; the others are listed apart and are in no figure.',
  'Exit codes: 0 reported (or nothing recorded yet), 1 refused (runs that cannot be read together) or the gate failed, 2 usage error.',
].join('\n');

const RUN_NAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?$/;

/** The command line as `{ runs, resultsDir, modes, requireComplete }` (`undefined` or `false` for what was not
 * given). A flag that is unknown, repeated or missing its value, a run name that is not a plain file name, and a
 * mode that is not one of `configs.mjs` or is listed twice, are a `UsageError`. `modes` come back in the order of
 * `configs.mjs`, whatever the order typed: it is the order of the report. The flags are `report.mjs`'s where the
 * two reports share one; its others are refused, since a flag that was typed and did nothing would let a command
 * pass for one it was not. */
function parseArgs(argv) {
  const options = { runs: undefined, resultsDir: undefined, modes: undefined, requireComplete: false };
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
    if (token === '--require-complete') {
      once(token);
      options.requireComplete = true;
    } else if (token === '--runs') {
      once(token);
      const names = valueOf(token, i).split(',');
      if (names.some((name) => !RUN_NAME_PATTERN.test(name))) throw new UsageError(`--runs needs a comma separated list of run names (file names without .json), got ${JSON.stringify(argv[i + 1])}`);
      const twice = names.find((name, index) => names.indexOf(name) !== index);
      if (twice !== undefined) throw new UsageError(`--runs: ${JSON.stringify(twice)} is listed twice`);
      options.runs = names;
      i += 1;
    } else if (token === '--results-dir') {
      once(token);
      options.resultsDir = valueOf(token, i);
      i += 1;
    } else if (token === '--modes') {
      once(token);
      const names = valueOf(token, i).split(',');
      if (names.some((name) => !MODES.includes(name))) throw new UsageError(`--modes needs a comma separated list of delegation modes (${MODES.join(', ')}), got ${JSON.stringify(argv[i + 1])}`);
      const twice = names.find((name, index) => names.indexOf(name) !== index);
      if (twice !== undefined) throw new UsageError(`--modes: ${JSON.stringify(twice)} is listed twice`);
      options.modes = MODES.filter((mode) => names.includes(mode));
      i += 1;
    } else if (token.startsWith('--')) {
      throw new UsageError(`unknown argument ${token}`);
    } else {
      throw new UsageError(`unexpected argument ${JSON.stringify(token)}`);
    }
  }
  return options;
}

// ---- the text report ---------------------------------------------------------------------------------------------

const scoreText = (value) => (finite(value) ? value.toFixed(2) : '?');
const durationText = (ms) => {
  if (!finite(ms)) return '?';
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`;
};
const table = (header, body) => {
  const widths = header.map((cell, column) => Math.max(cell.length, ...body.map((line) => line[column].length)));
  return [header, ...body].map((line) => line.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd());
};
const stackText = (stack) => Object.entries(stack ?? {}).map(([key, value]) => `${key} ${value ?? 'unknown'}`).join(', ');
/** A column no value belongs in: an arm with no counted trial, a comparison either side of which is unknown. */
const NONE = '-';
/** Whether a figure is a mean over some of the counted trials and not all: the others did not know the value. A
 * figure no trial knows is no mean at all: it reads `?`, which says so by itself. */
const isPartial = (stats, cell) => stats.known > 0 && stats.known < cell.counted;
/** The mark of such a mean; the footnote that explains it is printed whenever one is (`formatSubagentsReport`). */
const partial = (stats, cell) => (isPartial(stats, cell) ? '*' : '');

/** The three cost columns of a cell: the measured means, and the total as `est.` with its range for a cell whose
 * counted trials have estimates alone, so that an estimate is never read as a measurement. */
function costColumns(cell) {
  const one = (stats) => (stats.mean === null ? '?' : `${money(stats.mean)}${partial(stats, cell)}`);
  const { orchestrator, subagents, total, estimate } = cell.cost;
  const whole = total.mean === null && estimate.known > 0 ? `est. ${money(estimate.low)} to ${money(estimate.high)}` : one(total);
  return [one(orchestrator), one(subagents), whole];
}

function modeLines({ mode, rows }, effort) {
  const results = rows.flatMap((row) => [
    ...ARMS.map((arm) => {
      const cell = row.cells[arm];
      if (cell.counted === 0) return [row.task, arm, `0 of ${cell.recorded}`, ...Array(7).fill(NONE)];
      return [
        row.task, arm, `${cell.counted} of ${cell.recorded}`,
        `${scoreText(cell.score.mean)} [${scoreText(cell.score.min)}-${scoreText(cell.score.max)}]${partial(cell.score, cell)}`,
        `${cell.passes}/${cell.score.known}`,
        ...costColumns(cell),
        `${durationText(cell.wallMs.mean)}${partial(cell.wallMs, cell)}`,
        `${finite(cell.turns.mean) ? cell.turns.mean.toFixed(1) : '?'}${partial(cell.turns, cell)}`,
      ];
    }),
    ...row.compared.map((entry) => {
      const times = (value) => (value === null ? NONE : `${value.toFixed(2)}x`);
      const signed = (value, digits) => (value === null ? NONE : `${value > 0 ? '+' : ''}${value.toFixed(digits)}`);
      // In percentage points, so the difference of two rates is not read as a count of trials.
      const points = entry.passRateDiff === null ? NONE : `${signed(round(entry.passRateDiff * 100), 0)}pp`;
      return [row.task, `${entry.arm} vs ${entry.against}`, NONE, signed(entry.scoreDiff, 2), points, times(entry.cost.orchestrator), times(entry.cost.subagents), times(entry.cost.total), times(entry.wallMs), times(entry.turns)];
    }),
  ]);
  const count = (value) => (value === null ? '?' : String(value));
  const outcomes = rows.flatMap((row) => ARMS.filter((arm) => row.cells[arm].counted > 0).map((arm) => {
    const { byType, ...totals } = row.cells[arm].outcomes;
    return [row.task, arm, ...OUTCOMES.map((name) => count(totals[name])), Object.entries(byType).map(([type, spawned]) => `${type} ${spawned}`).join(', ') || '?'];
  }));
  const lines = [`effort ${effort}, mode ${mode}`, ...table(['task', 'arm', 'counted', 'score', 'pass', 'cost orch', 'cost sub', 'cost total', 'wall', 'turns'], results)];
  if (outcomes.length > 0) lines.push('', ...table(['task', 'arm', ...OUTCOMES, 'by type'], outcomes));
  for (const row of rows) {
    for (const arm of ARMS) {
      const cell = row.cells[arm];
      if (cell.errors > 0) lines.push(`${row.task} ${arm}: ${cell.errors} of ${cell.counted} counted trials recorded an error (counted, with the score they were graded at)`);
    }
  }
  return lines;
}

/** The report as text: what the runs were and how to read the columns; then, per effort and delegation mode, a table
 * with a row per task and arm (counted trials of those recorded, the score's mean and [min-max], the trials that
 * passed every check, the list cost of the orchestrator, of its subagents and of both, wall time and turns) and a row
 * that compares each other arm with the baseline, followed by the subagent outcomes of the counted trials; then the
 * trials that are in no figure, and the flags, trial by trial and counted by kind. */
function formatSubagentsReport(report) {
  const [baseline, ...others] = report.arms;
  const priceText = report.prices.length === 0 ? 'no price table is recorded' : report.prices.map((price) => `${price.url}, read ${price.readOn}`).join('; ');
  const lines = [
    `runs: ${report.runs.join(', ')}`,
    `model ${report.model}, permission mode ${report.permissionMode}`,
    `stack: ${stackText(report.stack)}`,
    `arms: the model above orchestrates in each; ${baseline.arm} forces ${baseline.subagentModel} on every subagent, ${others.map((entry) => `${entry.arm} ${entry.subagentModel}`).join(', ')}`,
    'counted: the trials that spawned at least one subagent, of those recorded; every figure is over the counted trials alone',
    `cost: each model's tokens at list price, in US dollars, split between the orchestrator and its subagents from the session transcripts (${priceText}); `
      + 'a mean holds measured costs only, and a cost estimated from modelUsage is marked "est." and compared with nothing',
    `compared: each "vs ${baseline.arm}" row is that arm against ${baseline.arm}: score as a difference, pass as a difference of pass rates in percentage points (pp), `
      + 'each rate over its own arm\'s counted trials, and cost, wall time and turns as a ratio',
    'subagents: spawned, completed, failed, killed and refused are totals over the counted trials, as Claude Code printed them',
  ];
  if (report.leftOut.length > 0) lines.push(`left out by --modes ${report.modes.join(',')}: ${leftOutText(report.leftOut)} (in no figure, list or check below)`);
  for (const { effort, modes } of report.efforts) for (const entry of modes) lines.push('', ...modeLines(entry, effort));
  const cells = report.efforts.flatMap(({ modes }) => modes.flatMap(({ rows }) => rows.flatMap((row) => Object.values(row.cells))));
  if (cells.some((cell) => [cell.score, cell.wallMs, cell.turns, cell.cost.orchestrator, cell.cost.subagents, cell.cost.total].some((stats) => isPartial(stats, cell)))) {
    lines.push('', '* a mean over the counted trials that know the value: fewer than were counted');
  }
  lines.push('', report.notCounted.length === 0 ? 'Trials not counted: none' : `Trials not counted: ${report.notCounted.length} of ${report.trials} recorded, in no figure above`);
  for (const entry of report.notCounted) lines.push(`  ${entry.trial}: ${entry.reason} (score ${scoreText(entry.score)})`);
  if (report.flags.length === 0) {
    lines.push('', `Flags: none in ${plural(report.trials, 'recorded trial')}`);
  } else {
    lines.push('', `Flags: ${report.flags.length} of ${plural(report.trials, 'recorded trial')} (${Object.entries(report.flagCounts).filter(([, count]) => count > 0).map(([kind, count]) => `${FLAG_KINDS[kind]} ${count}`).join(', ')})`);
    for (const entry of report.flags) lines.push(`  ${entry.trial}: ${entry.flags.map((flag) => flag.text).join('; ')}`);
  }
  return `${lines.join('\n')}\n`;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The command. Resolves to the exit code: 0 for a report printed, 1 for runs it refuses to read (a file that is no
 * results document of subagent configs, runs that differ or share a trial) and for a gate that failed (the report is
 * still printed, the failure goes to stderr), and 2 for a usage error. A refusal prints nothing as a result.
 *
 * Runs that hold no trial, a results directory with no run and no directory at all are the state before the first
 * trial of the feature: the command says that nothing is recorded and exits 0, so it can be run at any time. With
 * `--require-complete` the same state exits 1, and prints nothing as a result: a gate must not pass on nothing.
 *
 * `--modes` names the delegation modes that count: the report and the gate hold those alone, one line says how many
 * trials of which other modes the runs hold, and runs that hold trials of the other modes only are that same state
 * of nothing recorded.
 *
 * Everything it prints goes through `deps.stdout` and `deps.stderr`; `deps.resultsDir` is the directory
 * `--results-dir` overrides. Nothing here writes a file or runs anything: it only reads. */
export async function subagentsReportMain(argv, env = process.env, deps = {}) {
  const { stdout = process.stdout, stderr = process.stderr, resultsDir = path.join(HERE, 'results', SUBAGENTS_DIR) } = deps;
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    stderr.write(`${error.message}\n\n${USAGE}\n`);
    return 2;
  }
  const dir = path.resolve(options.resultsDir ?? resultsDir);
  let report = null;
  try {
    const runs = loadRuns({ dir, names: options.runs });
    if (runs.some((run) => run.doc.trials.length > 0)) report = buildSubagentsReport(runs, { modes: options.modes });
  } catch (error) {
    if (!(error instanceof ReportError)) throw error;
    stderr.write(`${error.message}\n`);
    return 1;
  }
  // No trial of the modes that count is nothing recorded too, whatever the runs hold of the others: with no effort
  // to ask the cells of, the gate would find none short.
  if (report === null || report.trials === 0) {
    const asked = options.modes === undefined ? '' : ` of mode${options.modes.length === 1 ? '' : 's'} ${options.modes.join(', ')}`;
    const others = report === null || report.leftOut.length === 0 ? '' : ` (left out: ${leftOutText(report.leftOut)})`;
    const nothing = `no subagent trial${asked} is recorded yet in ${dir}${others}`;
    if (!options.requireComplete) {
      stdout.write(`${nothing}\n`);
      return 0;
    }
    stderr.write(`--require-complete: ${nothing}: a report of nothing is not a pass\n`);
    return 1;
  }
  stdout.write(formatSubagentsReport(report));
  const short = options.requireComplete ? incompleteCells(report) : [];
  if (short.length > 0) {
    const why = (cell) => [[cell.notRecorded, 'not recorded'], [cell.notDelegated, 'did not delegate'], [cell.unknown, 'recorded no spawned count']]
      .filter(([count]) => count > 0).map(([count, reason]) => `${count} ${reason}`).join(', ');
    stderr.write(`${[
      `--require-complete: cells with fewer than ${COMPLETE_TRIALS} counted trials:`,
      ...short.map((cell) => `  ${cell.task} ${cell.mode} ${cell.arm} ${cell.effort}: ${cell.counted} of ${cell.required} counted (${why(cell)})`),
    ].join('\n')}\n`);
    return 1;
  }
  return 0;
}

// Run as a command, not when imported by a test. Compared as resolved paths, not as URLs: on Windows
// `import.meta.url` and `process.argv[1]` spell the same file differently.
const fold = (text) => (process.platform === 'win32' ? text.toLowerCase() : text);
if (process.argv[1] && fold(path.resolve(process.argv[1])) === fold(fileURLToPath(import.meta.url))) {
  process.exitCode = await subagentsReportMain(process.argv.slice(2), process.env);
}

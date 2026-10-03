#!/usr/bin/env node
// The eval report: turns the recorded runs in `evals/results/` into the A/B result, per task and effort. Zero deps,
// plain Node.
//
//   node evals/report.mjs [--runs <name,name>] [--results-dir <dir>] [--json]
//                         [--require-complete] [--min-discriminating <n>]
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

// ---- cost units --------------------------------------------------------------------------------------------------

const INPUT_WEIGHT = 1;
const CACHE_WRITE_5M_WEIGHT = 1.25;
const CACHE_WRITE_1H_WEIGHT = 2;
const CACHE_READ_WEIGHT = 0.1;
const OUTPUT_WEIGHT = 5;

/** The cost of one trial in units of an input token, from its `usage`: the tokens weighted by their price relative to
 * an input token (the Constraints' rule). Cache writes are priced by the split in `usage.cache_creation` (5 minutes
 * 1.25, one hour 2); whatever part of `cache_creation_input_tokens` the split does not cover counts at 1.25, as
 * does the whole total when there is no split. `null` when there is no `usage`, or it lacks the input or the output
 * count: a cost computed from the rest would read as a cheap trial. Cache counts a usage does not report are 0. */
export function costUnits(usage) {
  if (usage === null || typeof usage !== 'object' || Array.isArray(usage)) return null;
  if (!finite(usage.input_tokens) || !finite(usage.output_tokens)) return null;
  const count = (value) => (finite(value) ? value : 0);
  const split = usage.cache_creation !== null && typeof usage.cache_creation === 'object' ? usage.cache_creation : {};
  const fiveMinutes = count(split.ephemeral_5m_input_tokens);
  const oneHour = count(split.ephemeral_1h_input_tokens);
  const uncovered = Math.max(0, count(usage.cache_creation_input_tokens) - fiveMinutes - oneHour);
  return usage.input_tokens * INPUT_WEIGHT
    + (fiveMinutes + uncovered) * CACHE_WRITE_5M_WEIGHT
    + oneHour * CACHE_WRITE_1H_WEIGHT
    + count(usage.cache_read_input_tokens) * CACHE_READ_WEIGHT
    + usage.output_tokens * OUTPUT_WEIGHT;
}

// ---- cells -------------------------------------------------------------------------------------------------------

/** One cell per task, effort and config that has a trial, in the order they first appear. A cell holds `n` (every
 * trial recorded), `errors` (those that recorded an `error`), the score's `{ known, mean, min, max, sd }`, the
 * cost units' `{ known, mean, sd }`, and the mean input tokens (cache included, as the runner sums them), output
 * tokens, wall time and turns, each over the trials that know it.
 *
 * A trial with an `error` counts, with the score it was graded at: the runner records an agent that timed out or
 * exited badly because its workspace may hold work worth scoring and "a failure rate is itself a result"
 * (`evals/runner.mjs`, `runTrial`), so leaving those out would flatter a config that fails. A trial the runner
 * never recorded (a usage cap, an authentication failure) is not in the results at all. The cell counts the errors
 * so the table can show them. A value a trial does not know (no `usage`, a `null` score) is left out of its mean and
 * counted out in `known`, never read as 0. */
export function buildCells(trials) {
  const groups = new Map();
  for (const entry of trials) {
    const key = JSON.stringify([entry.task, entry.effort, entry.config]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return [...groups.values()].map((group) => {
    const scores = known(group.map((entry) => entry.score));
    const costs = known(group.map((entry) => costUnits(entry.usage)));
    return {
      task: group[0].task,
      effort: group[0].effort,
      config: group[0].config,
      n: group.length,
      errors: group.filter((entry) => entry.error !== null && entry.error !== undefined).length,
      score: { known: scores.length, mean: mean(scores), min: scores.length === 0 ? null : Math.min(...scores), max: scores.length === 0 ? null : Math.max(...scores), sd: sampleSd(scores) },
      cost: { known: costs.length, mean: mean(costs), sd: sampleSd(costs) },
      inputTokens: mean(known(group.map((entry) => entry.inputTokens))),
      outputTokens: mean(known(group.map((entry) => entry.outputTokens))),
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
 *   - `incomplete` when either cell has fewer than 2 trials, or fewer than 2 known scores or cost units;
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

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
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

/** Throws a `ReportError` when the runs cannot be read together: a model, a permission mode or a stack that differs
 * from the first run's (deep equality), or the same trial (task, config, effort, repeat) recorded twice, in two runs
 * or in one. Half the trials on one CLI and half on another measure neither, and a trial counted twice would
 * shrink every spread. Every difference is listed, so the message names all that must be fixed. */
export function checkRuns(runs) {
  const problems = [];
  const [first, ...rest] = runs;
  for (const run of rest) {
    const pairs = [
      ['model', first.doc.model, run.doc.model],
      ['permission mode', first.doc.permissionMode, run.doc.permissionMode],
      ...stackDifferences(first.doc.stack, run.doc.stack).map(({ field, a, b }) => [field, a, b]),
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
 * trial): with no effort to check, both gates would pass on nothing. */
export function buildReport(runs) {
  checkRuns(runs);
  const trials = runs.flatMap((run) => run.doc.trials);
  if (trials.length === 0) throw new ReportError(`the runs ${runs.map((run) => run.name).join(', ')} hold no trial: a report of nothing is not a pass`);
  const cells = buildCells(trials);
  const efforts = [...new Set(cells.map((cell) => cell.effort))].sort(byEffort);
  const cellOf = (task, effort, config) => cells.find((cell) => cell.task === task && cell.effort === effort && cell.config === config) ?? null;
  return {
    runs: runs.map((run) => run.name).sort(),
    model: runs[0].doc.model,
    permissionMode: runs[0].doc.permissionMode,
    stack: runs[0].doc.stack,
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
  '',
  '  --runs <list>              report only these runs of the results directory (default: every *.json)',
  '  --results-dir <dir>        where the runs are (default: evals/results)',
  '  --json                     print one JSON document instead of the tables',
  `  --require-complete         exit 1 unless every cell of a task and effort in the runs has ${COMPLETE_TRIALS} trials for both configs`,
  '  --min-discriminating <n>   exit 1 unless at every effort at least n tasks have the verdict score or cost',
  '',
  'Exit codes: 0 reported, 1 refused (runs that cannot be read together) or a gate failed, 2 usage error.',
].join('\n');

export class UsageError extends Error {}

const RUN_NAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?$/;

/** The command line as `{ runs, resultsDir, json, requireComplete, minDiscriminating }` (`undefined` or `false` for
 * what was not given). A flag that is unknown, repeated or missing its value, a value that is not a positive integer
 * for `--min-discriminating`, and a run name that is not a plain file name are a `UsageError`. */
export function parseArgs(argv) {
  const options = { runs: undefined, resultsDir: undefined, json: false, requireComplete: false, minDiscriminating: undefined };
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
    } else if (token === '--results-dir') {
      once(token);
      options.resultsDir = valueOf(token, i);
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
  return options;
}

// ---- the text report ---------------------------------------------------------------------------------------------

const scoreText = (value) => (finite(value) ? value.toFixed(2) : '?');
const unitsText = (value) => (!finite(value) ? '?' : value >= 1e6 ? `${(value / 1e6).toFixed(2)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value)));
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

function effortLines({ effort, rows }) {
  const per = (cell, pick) => (cell === null ? '-' : pick(cell));
  const body = rows.map((row) => [
    row.task,
    `${row.minimal?.n ?? 0}/${row.current?.n ?? 0}`,
    spreadText(row.minimal), spreadText(row.current),
    per(row.minimal, (cell) => unitsText(cell.cost.mean)), per(row.current, (cell) => unitsText(cell.cost.mean)),
    finite(row.costRatio) ? `${row.costRatio.toFixed(2)}x` : '-',
    per(row.minimal, (cell) => unitsText(tokensOf(cell))), per(row.current, (cell) => unitsText(tokensOf(cell))),
    per(row.minimal, (cell) => durationText(cell.wallMs)), per(row.current, (cell) => durationText(cell.wallMs)),
    verdictText(row),
    row.predecessor === null ? '-' : row.predecessor ? 'yes' : 'no',
  ]);
  const lines = [`effort ${effort}`, ...table(
    ['task', 'n min/cur', 'score min', 'score cur', 'cost min', 'cost cur', 'cur/min', 'tokens min', 'tokens cur', 'wall min', 'wall cur', 'verdict', 'old rule'],
    body,
  )];
  for (const row of rows) {
    for (const config of CONFIGS) {
      const cell = row[config];
      if (cell !== null && cell.errors > 0) lines.push(`${row.task} ${config}: ${cell.errors} of ${cell.n} trials recorded an error (counted, with the score they were graded at)`);
    }
  }
  return lines;
}

/** The report as text: a table per effort (task, trials per config, mean score and its [min-max] per config, cost
 * units, the ratio current / minimal, input + output tokens, wall time, the verdict and whether the predecessor's rule
 * would call it a difference), then the count of discriminating tasks per effort. */
export function formatReport(report, { minDiscriminating } = {}) {
  const stack = Object.entries(report.stack ?? {}).map(([key, value]) => `${key} ${value ?? 'unknown'}`).join(', ');
  const lines = [
    `runs: ${report.runs.join(', ')}`,
    `model ${report.model}, permission mode ${report.permissionMode}`,
    `stack: ${stack}`,
    'cost units: input 1, cache write 1.25 (5 min) or 2 (1 h), cache read 0.1, output 5; cost verdicts need the scores equal (0.02 or the pooled deviation) and a gap above the pooled cost deviation',
  ];
  for (const entry of report.efforts) lines.push('', ...effortLines(entry));
  lines.push('', 'Discriminating tasks per effort (verdict score or cost):');
  for (const { effort, counts } of report.efforts) lines.push(`  ${effort}: ${counts.discriminating} of ${counts.tasks} (score ${counts.score}, cost ${counts.cost}, none ${counts.none}, incomplete ${counts.incomplete})`);
  if (minDiscriminating !== undefined) {
    const { ok } = checkDiscriminating(report, minDiscriminating);
    lines.push(`  required: at least ${minDiscriminating} at every effort, ${ok ? 'met' : 'not met'}`);
  }
  return `${lines.join('\n')}\n`;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The command. Resolves to the exit code: 0 for a report printed, 1 for runs it refuses to read together (a model,
 * permission mode or stack that differs, a trial recorded twice, a file it cannot read), for a gate that failed
 * (the report is still printed, the failure goes to stderr) and 2 for a usage error. A refusal prints nothing as a
 * result. Everything it prints goes through `deps.stdout` and `deps.stderr`; `deps.resultsDir` is the directory
 * `--results-dir` overrides. Nothing here writes a file or runs anything: it only reads. */
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
  try {
    report = buildReport(loadRuns({ dir: path.resolve(options.resultsDir ?? resultsDir), names: options.runs }));
  } catch (error) {
    if (!(error instanceof ReportError)) throw error;
    stderr.write(`${error.message}\n`);
    return 1;
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

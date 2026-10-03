// Tests for `evals/report.mjs`. The results documents are built here, never read from `evals/results/`: the real
// runs are evidence, and a test that depended on them would change with every new run.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ReportError, USAGE, buildCells, buildReport, compareCells, incompleteCells, loadRuns, reportMain } from './report.mjs';

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-report-test-'));
test.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
let counter = 0;
/** A fresh results directory holding `docs`, `{ name: document }`; a string document is written as it is. */
const resultsDir = (docs = {}) => {
  const dir = path.join(scratch, `results-${counter += 1}`);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, doc] of Object.entries(docs)) fs.writeFileSync(path.join(dir, name.includes('.') ? name : `${name}.json`), typeof doc === 'string' ? doc : JSON.stringify(doc));
  return dir;
};

// ---- builders ----------------------------------------------------------------------------------------------------

/** The main thread's `usage` of a trial. It is the same in every trial a test builds, whatever the trial cost: the
 * report decides cost from `costUsd`, so a report that read cost from here would see every trial cost the same. */
const usageOf = (input) => ({ input_tokens: input, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 });

/** One trial record as `runner.mjs` writes it, with the fields a test cares about overridden. */
const trial = (over = {}) => ({
  task: 'alpha', config: 'minimal', effort: 'medium', repeat: 1, score: 1, passed: 50, total: 50,
  inputTokens: 1000, outputTokens: 100, turns: 10, usage: usageOf(1000), costUsd: 1000, wallMs: 60000, cliVersion: '1', error: null,
  startedAt: '2026-10-02T00:00:00.000Z',
  ...over,
});

/** `n` trials of one cell, the i-th with `scores[i]` and `costs[i]` US dollars (a scalar repeats). */
const cellTrials = ({ config, scores = 1, costs = 1000, task = 'alpha', effort = 'medium', n = 3, ...rest }) => (
  Array.from({ length: n }, (_, i) => trial({
    task, config, effort, repeat: i + 1,
    score: Array.isArray(scores) ? scores[i] : scores,
    costUsd: Array.isArray(costs) ? costs[i] : costs,
    ...rest,
  }))
);

/** The verdict of one task and effort from the trials of its two configs. */
const verdictOf = (minimal, current) => {
  const cells = buildCells([...cellTrials({ config: 'minimal', ...minimal }), ...cellTrials({ config: 'current', ...current })]);
  return compareCells(cells.find((cell) => cell.config === 'minimal') ?? null, cells.find((cell) => cell.config === 'current') ?? null);
};

const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} is not ${expected}`);

// ---- cells -------------------------------------------------------------------------------------------------------

test('buildCells makes one cell per task, effort and config, with the statistics of its trials', () => {
  const trials = [
    trial({ repeat: 1, score: 0.9, costUsd: 1000, inputTokens: 100, outputTokens: 10, wallMs: 1000, turns: 4 }),
    trial({ repeat: 2, score: 1, costUsd: 2000, inputTokens: 300, outputTokens: 30, wallMs: 3000, turns: 8 }),
    trial({ repeat: 3, score: 0.8, costUsd: 3000, inputTokens: 200, outputTokens: 20, wallMs: 2000, turns: 6 }),
    trial({ task: 'beta' }),
    trial({ effort: 'high' }),
    trial({ config: 'current' }),
  ];
  const cells = buildCells(trials);
  assert.equal(cells.length, 4);
  const cell = cells.find((entry) => entry.task === 'alpha' && entry.config === 'minimal' && entry.effort === 'medium');
  assert.equal(cell.n, 3);
  near(cell.score.mean, 0.9, 'score mean');
  assert.equal(cell.score.min, 0.8);
  assert.equal(cell.score.max, 1);
  near(cell.score.sd, 0.1, 'score sample sd');
  near(cell.cost.mean, 2000, 'cost mean');
  near(cell.cost.sd, 1000, 'cost sample sd (n - 1)');
  assert.equal(cell.cost.known, 3);
  assert.equal(cell.inputTokens, 200);
  assert.equal(cell.outputTokens, 20);
  assert.equal(cell.wallMs, 2000);
  assert.equal(cell.turns, 6);
  assert.equal(cell.errors, 0);
});

test('a cell of one trial has no spread: its sample deviation is unknown, never 0', () => {
  const [cell] = buildCells([trial()]);
  assert.equal(cell.score.sd, null);
  assert.equal(cell.cost.sd, null);
  assert.equal(cell.score.mean, 1);
});

test('a trial that recorded an error still counts, and is counted as an error: a failure rate is a result', () => {
  const cells = buildCells([trial({ repeat: 1 }), trial({ repeat: 2, score: 0, error: 'timeout' }), trial({ repeat: 3, score: 0, error: 'grader-timeout' })]);
  assert.equal(cells[0].n, 3);
  assert.equal(cells[0].errors, 2);
  near(cells[0].score.mean, 1 / 3, 'the zero scores are in the mean');
});

test('a trial without costUsd has no cost: the cell knows fewer costs than trials, and its mean uses only those', () => {
  // A trial recorded before costUsd existed has no such field at all, which is not a cost of 0 either.
  const [cell] = buildCells([trial({ repeat: 1, costUsd: 100 }), trial({ repeat: 2, costUsd: 300 }), trial({ repeat: 3, costUsd: undefined })]);
  assert.equal(cell.n, 3);
  assert.equal(cell.cost.known, 2);
  assert.equal(cell.cost.mean, 200);
  const [none] = buildCells([trial({ costUsd: null })]);
  assert.equal(none.cost.known, 0);
  assert.equal(none.cost.mean, null);
});

test('cost comes from costUsd, not from the main thread\'s usage: a cell whose usage says cheaper but whose session cost more is dearer', () => {
  // The real case: `usage` counts the main thread only, so a config that hands work to subagents looks cheap in it.
  const verdict = (costs, usages) => {
    const make = (config) => cellTrials({ config, costs: costs[config] }).map((entry) => ({ ...entry, usage: usageOf(usages[config][entry.repeat - 1]) }));
    const [minimal, current] = ['minimal', 'current'].map((config) => buildCells(make(config))[0]);
    return compareCells(minimal, current);
  };
  const result = verdict(
    { minimal: [1, 1.1, 0.9], current: [2, 2.1, 1.9] },
    { minimal: [20000, 21000, 19000], current: [10000, 11000, 9000] },
  );
  assert.equal(result.verdict, 'cost');
  assert.equal(result.winner, 'minimal', 'the cheaper session wins, whatever the main thread used');
  near(result.costRatio, 2, 'current / minimal, from costUsd');
});

test('the token columns sum modelUsage over every model: input, cache reads and cache writes, and output', () => {
  const usage = (input, output, read, write) => ({ inputTokens: input, outputTokens: output, cacheReadInputTokens: read, cacheCreationInputTokens: write, costUSD: 1 });
  const [cell] = buildCells([
    trial({ repeat: 1, inputTokens: 1, outputTokens: 1, modelUsage: { a: usage(1, 2, 30, 400), b: usage(10, 20, 300, 4000) } }),
    trial({ repeat: 2, inputTokens: 1, outputTokens: 1, modelUsage: { a: usage(100, 200, 0, 0) } }),
  ]);
  assert.equal(cell.inputTokens, (1 + 30 + 400 + 10 + 300 + 4000 + 100) / 2);
  assert.equal(cell.outputTokens, (2 + 20 + 200) / 2);
});

test('the token columns fall back to the recorded input and output tokens when a trial has no usable modelUsage', () => {
  const [cell] = buildCells([
    trial({ repeat: 1, inputTokens: 100, outputTokens: 10, modelUsage: undefined }),
    trial({ repeat: 2, inputTokens: 300, outputTokens: 30, modelUsage: null }),
    trial({ repeat: 3, inputTokens: 200, outputTokens: 20, modelUsage: {} }),
    trial({ repeat: 4, inputTokens: 400, outputTokens: 40, modelUsage: { a: { inputTokens: 5 } } }),
  ]);
  assert.equal(cell.inputTokens, 250, 'an empty modelUsage and one lacking counts are not a measurement of 0');
  assert.equal(cell.outputTokens, 25);
});

test('a trial whose score is unknown is left out of the score statistics, not read as 0', () => {
  const [cell] = buildCells([trial({ repeat: 1, score: 1 }), trial({ repeat: 2, score: null }), trial({ repeat: 3, score: 0.5 })]);
  assert.equal(cell.n, 3);
  assert.equal(cell.score.known, 2);
  assert.equal(cell.score.mean, 0.75);
});

// ---- verdicts ----------------------------------------------------------------------------------------------------

test('score verdict: scores that are not equal decide, the higher mean wins, at any cost', () => {
  const current = verdictOf({ scores: [0.7, 0.7, 0.7], costs: 100 }, { scores: [0.9, 0.9, 0.9], costs: 100000 });
  assert.equal(current.verdict, 'score');
  assert.equal(current.winner, 'current', 'the dearer config wins when it scores higher');
  const minimal = verdictOf({ scores: [0.9, 0.9, 0.9], costs: 100000 }, { scores: [0.7, 0.7, 0.7], costs: 100 });
  assert.equal(minimal.verdict, 'score');
  assert.equal(minimal.winner, 'minimal');
});

test('cost verdict: equal scores and a cost gap above the pooled deviation, the cheaper config wins', () => {
  const minimalCheaper = verdictOf({ costs: [1000, 1100, 900] }, { costs: [2000, 2100, 1900] });
  assert.equal(minimalCheaper.verdict, 'cost');
  assert.equal(minimalCheaper.winner, 'minimal');
  near(minimalCheaper.costRatio, 2, 'current / minimal');
  const currentCheaper = verdictOf({ costs: [2000, 2100, 1900] }, { costs: [1000, 1100, 900] });
  assert.equal(currentCheaper.verdict, 'cost');
  assert.equal(currentCheaper.winner, 'current');
  near(currentCheaper.costRatio, 0.5, 'current / minimal');
});

test('none verdict: equal scores and a cost gap inside the pooled deviation', () => {
  const result = verdictOf({ costs: [1000, 2000, 3000] }, { costs: [1500, 2500, 3500] });
  assert.equal(result.verdict, 'none');
  assert.equal(result.winner, null);
  near(result.costRatio, 2500 / 2000,'the ratio is still reported');
});

test('the cost gap must exceed the pooled deviation: a gap equal to it is none', () => {
  // sample sd of [0, 1000, 2000] is 1000 for both configs, so the pooled sd is 1000 and the means differ by 1000
  const result = verdictOf({ costs: [0, 1000, 2000] }, { costs: [1000, 2000, 3000] });
  assert.equal(result.verdict, 'none');
  near(result.pooledCostSd, 1000, 'pooled cost sd');
});

test('the pooled deviation is sqrt((sd_minimal^2 + sd_current^2) / 2) of the sample deviations', () => {
  const result = verdictOf({ scores: [0.5, 0.7, 0.9], costs: [100, 100, 100] }, { scores: [0.5, 0.5, 0.5], costs: [100, 400, 700] });
  near(result.pooledScoreSd, Math.sqrt((0.2 ** 2 + 0) / 2), 'score');
  near(result.pooledCostSd, Math.sqrt((0 + 300 ** 2) / 2), 'cost');
});

test('the score tolerance is 0.02 against a near-zero pooled deviation: one missed check in fifty is equal', () => {
  // 0.98 against 1.00 is a gap of 0.02 up to rounding error; both configs have no spread at all
  const equal = verdictOf({ scores: 0.98, costs: 100 }, { scores: 1, costs: 100 });
  assert.equal(equal.verdict, 'none', 'a gap of exactly 0.02 is equal');
  const costly = verdictOf({ scores: 0.98, costs: 100 }, { scores: 1, costs: 1000 });
  assert.equal(costly.verdict, 'cost', 'equal scores let the cost decide');
  assert.equal(costly.winner, 'minimal');
  const apart = verdictOf({ scores: 0.97, costs: 100 }, { scores: 1, costs: 100 });
  assert.equal(apart.verdict, 'score', 'a gap of 0.03 is not equal');
  assert.equal(apart.winner, 'current');
});

test('scores are equal when their gap is within the pooled deviation, even above 0.02', () => {
  const result = verdictOf({ scores: [0.6, 0.8, 1], costs: 100 }, { scores: [0.5, 0.75, 1], costs: 100 });
  // gap 0.0833, pooled sd about 0.2: equal, so the equal costs make it none
  assert.equal(result.verdict, 'none');
  const apart = verdictOf({ scores: [0.5, 0.5, 0.5], costs: 100 }, { scores: [0.9, 0.9, 0.9], costs: 100 });
  assert.equal(apart.verdict, 'score');
});

test('incomplete verdict: a config with fewer than 2 trials, no cost, or no second known score', () => {
  const oneTrial = verdictOf({ n: 1 }, { n: 3 });
  assert.equal(oneTrial.verdict, 'incomplete');
  assert.equal(oneTrial.winner, null);
  assert.equal(verdictOf({ n: 3 }, { n: 1 }).verdict, 'incomplete');
  const missing = compareCells(buildCells(cellTrials({ config: 'minimal' }))[0], null);
  assert.equal(missing.verdict, 'incomplete', 'a config with no cell at all');
  assert.equal(compareCells(null, null).verdict, 'incomplete');
  const noCost = verdictOf({ n: 3 }, { n: 3, costUsd: null });
  assert.equal(noCost.verdict, 'incomplete', 'no cost');
  const oneCost = compareCells(
    buildCells(cellTrials({ config: 'minimal' }))[0],
    buildCells([trial({ config: 'current', repeat: 1 }), trial({ config: 'current', repeat: 2, costUsd: null }), trial({ config: 'current', repeat: 3, costUsd: null })])[0],
  );
  assert.equal(oneCost.verdict, 'incomplete', 'one known cost gives no spread to compare against');
  const unknownScores = verdictOf({ n: 3 }, { n: 3, scores: null });
  assert.equal(unknownScores.verdict, 'incomplete', 'no score known');
});

test('predecessor rule: the score gap beyond the pooled deviation, alone and beside the new verdict', () => {
  // equal under the 0.02 tolerance, yet beyond a zero pooled deviation: the old rule says it discriminates
  const tiny = verdictOf({ scores: 0.98, costs: 100 }, { scores: 1, costs: 100 });
  assert.equal(tiny.verdict, 'none');
  assert.equal(tiny.predecessor, true);
  // a gap inside the spread: the old rule says it does not
  const noisy = verdictOf({ scores: [0.5, 0.8, 1], costs: 100 }, { scores: [0.6, 0.9, 1], costs: 100 });
  assert.equal(noisy.predecessor, false);
  // identical scores with no spread: a gap of 0 is not beyond a deviation of 0
  assert.equal(verdictOf({ scores: 1, costs: 100 }, { scores: 1, costs: 100 }).predecessor, false);
  // not computable when a config has fewer than 2 known scores
  assert.equal(verdictOf({ n: 1 }, { n: 3 }).predecessor, null);
});

test('the verdict carries both cells and the differences it was decided on', () => {
  const result = verdictOf({ scores: [0.9, 0.9, 0.9], costs: 1000 }, { scores: [1, 1, 1], costs: 3000 });
  assert.equal(result.task, 'alpha');
  assert.equal(result.effort, 'medium');
  assert.equal(result.minimal.config, 'minimal');
  assert.equal(result.current.config, 'current');
  near(result.scoreDiff, 0.1, 'current minus minimal');
  near(result.costDiff, 2000, 'current minus minimal');
});

// ---- runs --------------------------------------------------------------------------------------------------------

const STACK = { claude: '2.1.284 (Claude Code)', gentleAi: '4.0.0', engram: '3.0.0', engramPlugin: '0.1.5' };

/** A results document of format 1 as `suite.mjs` writes it. */
const docOf = (name, trials, over = {}) => ({
  format: 1, name, createdAt: '2026-10-02T00:00:00.000Z', model: 'claude-opus-5-5', permissionMode: 'bypassPermissions',
  stack: { ...STACK }, args: { claude: 'claude', configs: ['minimal', 'current'], efforts: ['medium', 'high'], repeats: 3, tasks: ['alpha', 'beta'], workRoot: 'work' },
  trials, ...over,
});

/** The trials of both configs for one task and effort. */
const bothConfigs = (minimal = {}, current = {}, shared = {}) => [
  ...cellTrials({ config: 'minimal', ...shared, ...minimal }),
  ...cellTrials({ config: 'current', ...shared, ...current }),
];

const refusal = (fn) => {
  let thrown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown instanceof ReportError, `expected a ReportError, got ${thrown}`);
  return thrown.message;
};

test('loadRuns reads every results document in the directory, ignores *.tmp, and names a run by its file', () => {
  const dir = resultsDir({
    beta: docOf('beta', bothConfigs()), alpha: docOf('alpha', bothConfigs({}, {}, { task: 'beta' })),
    'alpha.json.tmp': '{ half a documen', 'notes.txt': 'not a results file',
  });
  const runs = loadRuns({ dir });
  assert.deepEqual(runs.map((run) => run.name), ['alpha', 'beta']);
  assert.equal(runs[0].doc.trials.length, 6);
});

test('loadRuns reads only the named runs, in the order named, and refuses a name with no file', () => {
  const dir = resultsDir({ alpha: docOf('alpha', bothConfigs()), beta: docOf('beta', bothConfigs()) });
  assert.deepEqual(loadRuns({ dir, names: ['beta'] }).map((run) => run.name), ['beta']);
  assert.deepEqual(loadRuns({ dir, names: ['beta', 'alpha'] }).map((run) => run.name), ['beta', 'alpha']);
  assert.match(refusal(() => loadRuns({ dir, names: ['alpha', 'gamma'] })), /gamma/);
});

test('loadRuns refuses an empty directory and one that does not exist: a report of nothing is not a pass', () => {
  assert.match(refusal(() => loadRuns({ dir: resultsDir() })), /no results/);
  assert.match(refusal(() => loadRuns({ dir: path.join(scratch, 'nowhere') })), /nowhere/);
});

test('runs that recorded no trial are refused, so neither gate can pass on nothing', async () => {
  // A run stopped by a usage cap before its first trial writes a document with no trials.
  const dir = resultsDir({ empty: docOf('empty', []) });
  assert.match(refusal(() => buildReport(loadRuns({ dir }))), /no trial/);
  const stdout = [];
  const stderr = [];
  const code = await reportMain(['--require-complete', '--min-discriminating', '3', '--results-dir', dir], {}, {
    stdout: { write: (text) => stdout.push(text) }, stderr: { write: (text) => stderr.push(text) },
  });
  assert.equal(code, 1);
  assert.match(stderr.join(''), /no trial/);
});

test('a file that is not a results document of format 1 is an error that names it', () => {
  const cases = {
    'old.json': docOf('old', [], { format: 2 }),
    'broken.json': '{ not json',
    'bare.json': [],
    'notrials.json': { format: 1, name: 'notrials' },
    'half.json': docOf('half', [{ task: 'alpha', config: 'minimal' }]),
    'odd.json': docOf('odd', [trial({ config: 'mystery' })]),
  };
  for (const [file, doc] of Object.entries(cases)) {
    assert.match(refusal(() => loadRuns({ dir: resultsDir({ fine: docOf('fine', bothConfigs()), [file]: doc }) })), new RegExp(file.replace('.', '\\.')), file);
  }
});

test('runs that differ in model, permission mode or stack are refused, naming the runs and the differing value', () => {
  const trials = bothConfigs();
  const make = (over) => loadRuns({ dir: resultsDir({ a: docOf('a', trials), b: docOf('b', [], over) }) });
  const model = refusal(() => buildReport(make({ model: 'claude-other' })));
  assert.match(model, /\ba\b.*\bb\b.*model/);
  assert.ok(model.includes('claude-opus-5-5') && model.includes('claude-other'), model);
  const mode = refusal(() => buildReport(make({ permissionMode: 'acceptEdits' })));
  assert.match(mode, /permission mode/);
  assert.ok(mode.includes('bypassPermissions') && mode.includes('acceptEdits'), mode);
  const stack = refusal(() => buildReport(make({ stack: { ...STACK, gentleAi: '4.0.1' } })));
  assert.match(stack, /gentleAi/);
  assert.ok(stack.includes('4.0.0') && stack.includes('4.0.1'), stack);
  const unreadable = refusal(() => buildReport(make({ stack: { ...STACK, engram: null } })));
  assert.match(unreadable, /engram\b/, 'an unreadable version differs from a readable one');
  assert.match(refusal(() => buildReport(make({ stack: { ...STACK, extra: 'x' } }))), /extra/, 'a field one stack lacks');
});

test('the same trial recorded in two runs is refused, naming both runs and the trial', () => {
  const dir = resultsDir({ a: docOf('a', bothConfigs()), b: docOf('b', cellTrials({ config: 'minimal', n: 1 })) });
  const message = refusal(() => buildReport(loadRuns({ dir })));
  assert.match(message, /\ba\b.*\bb\b/);
  assert.match(message, /alpha/);
  assert.match(message, /minimal/);
  const twice = resultsDir({ only: docOf('only', [trial(), trial()]) });
  assert.match(refusal(() => buildReport(loadRuns({ dir: twice }))), /only/);
});

test('runs that share a stack, model and mode but no trial are merged: the medium and high cells of one A/B result', () => {
  const dir = resultsDir({
    medium: docOf('medium', bothConfigs({ effort: 'medium' }, { effort: 'medium' })),
    high: docOf('high', bothConfigs({ effort: 'high' }, { effort: 'high' })),
  });
  const report = buildReport(loadRuns({ dir }));
  assert.deepEqual(report.runs, ['high', 'medium']);
  assert.deepEqual(report.efforts.map((entry) => entry.effort), ['medium', 'high'], 'efforts in order of effort, not of name');
  assert.equal(report.model, 'claude-opus-5-5');
  assert.equal(report.permissionMode, 'bypassPermissions');
  assert.deepEqual(report.stack, STACK);
});

test('the report reads tasks, configs and efforts from the trials, never from a run\'s args', () => {
  // `ab-high` was written by two invocations of one run name: the second left `args.configs` as ['current'] only
  const args = { claude: 'claude', configs: ['current'], efforts: ['high'], repeats: 3, tasks: ['beta'], workRoot: 'work' };
  const doc = docOf('ab-high', bothConfigs({ effort: 'high', costs: 1000 }, { effort: 'high', costs: 5000 }), { args });
  const report = buildReport(loadRuns({ dir: resultsDir({ 'ab-high': doc }) }));
  assert.equal(report.efforts.length, 1);
  const [row] = report.efforts[0].rows;
  assert.equal(row.task, 'alpha', 'a task the args do not list');
  assert.equal(row.minimal.n, 3, 'a config the args do not list');
  assert.equal(row.current.n, 3);
  assert.equal(row.verdict, 'cost');
  assert.deepEqual(incompleteCells(report), []);
});

test('the report has one row per task and effort, tasks in name order, with the counts of its verdicts', () => {
  const trials = [
    ...bothConfigs({ task: 'delta', costs: 1000 }, { task: 'delta', costs: 3000 }),
    ...bothConfigs({ task: 'alpha', scores: 0.5 }, { task: 'alpha', scores: 1 }),
    ...bothConfigs({ task: 'charlie' }, { task: 'charlie' }),
    ...bothConfigs({ task: 'bravo', n: 1 }, { task: 'bravo' }),
    ...bothConfigs({ task: 'echo', costs: 3000 }, { task: 'echo', costs: 1000 }),
  ];
  const [entry] = buildReport(loadRuns({ dir: resultsDir({ run: docOf('run', trials) }) })).efforts;
  assert.deepEqual(entry.rows.map((row) => [row.task, row.verdict]), [
    ['alpha', 'score'], ['bravo', 'incomplete'], ['charlie', 'none'], ['delta', 'cost'], ['echo', 'cost'],
  ]);
  assert.deepEqual(entry.counts, { tasks: 5, score: 1, cost: 2, none: 1, incomplete: 1, discriminating: 3 });
});

// ---- the command -------------------------------------------------------------------------------------------------

/** Two efforts of three tasks: alpha is won on cost by minimal, beta on score by current, gamma is none. */
const abTrials = (efforts = ['medium', 'high']) => efforts.flatMap((effort) => [
  ...bothConfigs({ task: 'alpha', costs: [1000, 1100, 900] }, { task: 'alpha', costs: [2000, 2100, 1900] }, { effort }),
  ...bothConfigs({ task: 'beta', scores: 0.5 }, { task: 'beta', scores: 1 }, { effort }),
  ...bothConfigs({ task: 'gamma', costs: [1000, 2000, 3000] }, { task: 'gamma', costs: [1500, 2500, 3500] }, { effort }),
]);

const run = async (argv, docs) => {
  const dir = resultsDir(docs ?? { ab: docOf('ab', abTrials()) });
  const io = { out: '', err: '' };
  const code = await reportMain(argv, {}, { resultsDir: dir, stdout: { write: (text) => { io.out += text; } }, stderr: { write: (text) => { io.err += text; } } });
  return { code, ...io, dir };
};

test('reportMain prints a table per effort with the verdicts, and the count of discriminating tasks per effort', async () => {
  const { code, out, err } = await run([]);
  assert.equal(code, 0);
  assert.equal(err, '');
  for (const effort of ['medium', 'high']) assert.ok(out.includes(`effort ${effort}`), `a table for ${effort}`);
  const line = (task) => out.split('\n').filter((entry) => entry.startsWith(task));
  assert.equal(line('alpha').length, 2, 'one row per effort');
  assert.match(line('alpha')[0], /cost: minimal/);
  assert.match(line('alpha')[0], /2\.00x/, 'the cost ratio current / minimal');
  assert.match(line('beta')[0], /score: current/);
  assert.match(line('beta')[0], /0\.50/);
  assert.match(line('gamma')[0], /\bnone\b/);
  assert.match(line('gamma')[0], /\bno\b/, 'the predecessor rule beside it');
  assert.match(out, /medium: 2 of 3/);
  assert.match(out, /high: 2 of 3/);
  assert.match(out, /claude-opus-5-5/);
  assert.match(out, /bypassPermissions/);
});

test('reportMain prints cost in US dollars, explains it as the whole session at list price, and sums modelUsage for tokens', async () => {
  const usage = { inputTokens: 1000, outputTokens: 500, cacheReadInputTokens: 2000, cacheCreationInputTokens: 500, costUSD: 1 };
  const trials = bothConfigs({ costs: [3.084, 3.084, 3.084] }, { costs: [6.5, 6.5, 6.5], modelUsage: { a: usage, b: usage } });
  const { out } = await run([], { ab: docOf('ab', trials) });
  const row = out.split('\n').find((entry) => entry.startsWith('alpha'));
  assert.match(row, /\$3\.08\s+\$6\.50\s+2\.11x/, 'two decimals, and the ratio');
  assert.match(row, /1\.1k\s+8\.0k/, 'minimal falls back to input 1000 + output 100, current sums both models: 2 * 4000');
  assert.match(out, /list cost of the whole session, subagents included/);
  assert.doesNotMatch(out, /cost units/);
});

test('reportMain shows a task whose trials have no costUsd as incomplete: without a cost there is no verdict', async () => {
  const { out } = await run([], { ab: docOf('ab', bothConfigs({ costs: [1, 2, 3] }, { costUsd: null })) });
  assert.match(out.split('\n').find((entry) => entry.startsWith('alpha')), /incomplete/);
});

test('reportMain shows an incomplete task as such, and names a trial that recorded an error', async () => {
  const trials = [...bothConfigs({ task: 'alpha', n: 1 }, { task: 'alpha' }), ...bothConfigs({ task: 'beta' }, { task: 'beta', error: 'timeout' })];
  const { code, out } = await run([], { ab: docOf('ab', trials) });
  assert.equal(code, 0, 'a table is a result even when some task is incomplete');
  assert.match(out.split('\n').find((entry) => entry.startsWith('alpha')), /incomplete/);
  assert.match(out, /beta current: 3 of 3 trials recorded an error/);
});

test('reportMain --json prints the same data as one JSON document, and nothing else', async () => {
  const { code, out, err } = await run(['--json']);
  assert.equal(code, 0);
  assert.equal(err, '');
  const report = JSON.parse(out);
  assert.deepEqual(report.runs, ['ab']);
  assert.deepEqual(report.efforts.map((entry) => entry.effort), ['medium', 'high']);
  const alpha = report.efforts[0].rows[0];
  assert.equal(alpha.task, 'alpha');
  assert.equal(alpha.verdict, 'cost');
  assert.equal(alpha.winner, 'minimal');
  assert.equal(alpha.costRatio, 2);
  assert.equal(alpha.minimal.n, 3);
  assert.deepEqual(report.efforts[0].counts, { tasks: 3, score: 1, cost: 1, none: 1, incomplete: 0, discriminating: 2 });
});

test('--runs reports only the named runs, and --results-dir overrides the directory', async () => {
  const docs = { medium: docOf('medium', abTrials(['medium'])), high: docOf('high', abTrials(['high'])) };
  const only = await run(['--runs', 'high', '--json'], docs);
  assert.equal(only.code, 0);
  const report = JSON.parse(only.out);
  assert.deepEqual(report.runs, ['high']);
  assert.deepEqual(report.efforts.map((entry) => entry.effort), ['high']);
  const missing = await run(['--runs', 'low'], docs);
  assert.equal(missing.code, 1);
  assert.match(missing.err, /low/);
  assert.equal(missing.out, '');

  const dir = resultsDir(docs);
  const io = { out: '', err: '' };
  const other = await reportMain(['--results-dir', dir, '--json'], {}, { resultsDir: path.join(scratch, 'nowhere'), stdout: { write: (text) => { io.out += text; } }, stderr: { write: (text) => { io.err += text; } } });
  assert.equal(other, 0, io.err);
  assert.deepEqual(JSON.parse(io.out).runs, ['high', 'medium']);
});

test('reportMain refuses mixed runs with exit 1 and prints no result', async () => {
  const docs = { a: docOf('a', abTrials(['medium'])), b: docOf('b', abTrials(['high']), { permissionMode: 'default' }) };
  for (const argv of [[], ['--json']]) {
    const { code, out, err } = await run(argv, docs);
    assert.equal(code, 1);
    assert.equal(out, '', 'nothing is printed as a result');
    assert.match(err, /permission mode/);
    assert.match(err, /\ba\b.*\bb\b/);
  }
  const twice = await run([], { a: docOf('a', abTrials()), b: docOf('b', abTrials(['high'])) });
  assert.equal(twice.code, 1);
  assert.equal(twice.out, '');
  assert.match(twice.err, /recorded in runs a and b/);
  const broken = await run([], { a: '{ nope' });
  assert.equal(broken.code, 1);
  assert.match(broken.err, /a\.json/);
});

test('--require-complete passes when every cell has 3 trials, and fails listing the cells that have fewer', async () => {
  const pass = await run(['--require-complete']);
  assert.equal(pass.code, 0);
  const short = [...abTrials(), ...bothConfigs({ task: 'delta', effort: 'high', n: 2 }, { task: 'delta', effort: 'high' })];
  const fail = await run(['--require-complete'], { ab: docOf('ab', short) });
  assert.equal(fail.code, 1);
  assert.match(fail.err, /delta high minimal: 2 of 3 trials/);
  assert.doesNotMatch(fail.err, /delta high current|delta medium|alpha/, 'only the short cell, and only a task and effort that appear');
  const oneSided = [...abTrials(), ...cellTrials({ config: 'minimal', task: 'epsilon', effort: 'high' })];
  const missingConfig = await run(['--require-complete'], { ab: docOf('ab', oneSided) });
  assert.equal(missingConfig.code, 1);
  assert.match(missingConfig.err, /epsilon high current: 0 of 3 trials/, 'a config with no trial at all');
  assert.match(fail.out, /effort high/, 'the table is still printed');
  const json = await run(['--require-complete', '--json'], { ab: docOf('ab', short) });
  assert.equal(json.code, 1);
  const { checks } = JSON.parse(json.out);
  assert.equal(checks.requireComplete.ok, false);
  assert.equal(checks.requireComplete.missing.length, 1);
});

test('--min-discriminating needs at least n tasks with a score or cost verdict at every effort, and prints the counts either way', async () => {
  const pass = await run(['--min-discriminating', '2']);
  assert.equal(pass.code, 0);
  assert.match(pass.out, /medium: 2 of 3/);
  assert.match(pass.out, /at least 2/);
  const fail = await run(['--min-discriminating', '3']);
  assert.equal(fail.code, 1);
  assert.match(fail.out, /medium: 2 of 3/, 'the counts are printed when it fails');
  assert.match(fail.out, /high: 2 of 3/);
  assert.match(fail.err, /medium: 2 of 3 tasks discriminate, 3 are needed/);
  assert.match(fail.err, /high: 2 of 3 tasks discriminate, 3 are needed/);
  // one effort short is enough to fail: the bar holds at every effort present
  const uneven = [...abTrials(['medium']), ...bothConfigs({ task: 'alpha', costs: 1000 }, { task: 'alpha', costs: 1000 }, { effort: 'high' })];
  const oneShort = await run(['--min-discriminating', '2', '--json'], { ab: docOf('ab', uneven) });
  assert.equal(oneShort.code, 1);
  const { checks } = JSON.parse(oneShort.out);
  assert.deepEqual(checks.minDiscriminating.perEffort.map((entry) => [entry.effort, entry.count, entry.ok]), [['medium', 2, true], ['high', 0, false]]);
});

test('both gates together fail when either does, and the command the feature ends on passes on a complete A/B result', async () => {
  const argv = ['--require-complete', '--min-discriminating', '2'];
  assert.equal((await run(argv)).code, 0);
  const short = [...abTrials(), ...bothConfigs({ task: 'delta', n: 2 }, { task: 'delta' })];
  const both = await run([...argv.slice(0, 1), '--min-discriminating', '3'], { ab: docOf('ab', short) });
  assert.equal(both.code, 1);
  assert.match(both.err, /delta medium minimal: 2 of 3 trials/);
  assert.match(both.err, /3 are needed/);
});

test('reportMain exits 2 with the usage text for an unknown flag, a missing or bad value and a repeated flag', async () => {
  const bad = [
    ['--bogus'], ['stray'], ['--runs'], ['--runs', '--json'], ['--runs', 'a,,b'], ['--runs', 'a,a'], ['--runs', '../x'],
    ['--results-dir'], ['--min-discriminating'], ['--min-discriminating', 'x'], ['--min-discriminating', '0'],
    ['--min-discriminating', '-1'], ['--min-discriminating', '2.5'], ['--min-discriminating', '2', '--min-discriminating', '3'],
    ['--json', '--json'], ['--require-complete', '--require-complete'], ['--json=1'],
  ];
  for (const argv of bad) {
    const { code, out, err } = await run(argv);
    assert.equal(code, 2, JSON.stringify(argv));
    assert.equal(out, '', JSON.stringify(argv));
    assert.ok(err.includes(USAGE), `usage for ${JSON.stringify(argv)}`);
  }
});

test('incompleteCells lists every cell of a task and effort in the runs that has fewer than 3 trials for either config', () => {
  const trials = [
    ...bothConfigs({ task: 'alpha' }, { task: 'alpha', n: 2 }),
    ...bothConfigs({ task: 'beta', effort: 'high' }, { task: 'beta', effort: 'high' }),
    ...cellTrials({ config: 'minimal', task: 'gamma', n: 3 }),
  ];
  const report = buildReport(loadRuns({ dir: resultsDir({ run: docOf('run', trials) }) }));
  assert.deepEqual(incompleteCells(report), [
    { task: 'alpha', effort: 'medium', config: 'current', n: 2 },
    { task: 'gamma', effort: 'medium', config: 'current', n: 0 },
  ]);
});

// Tests for `evals/subagents-report.mjs`. The results documents are built here or read from `evals/fixtures/`, never
// from `evals/results/subagents/`: the real runs are evidence, and a test that depended on them would change with
// every new run.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { DELEGATION_MODES, SUBAGENT_CONFIGS, SUBAGENT_MODELS, subagentPin } from './configs.mjs';
import { PRICE_SOURCE } from './prices.mjs';
import { ReportError } from './report.mjs';
import { TASKS, USAGE, buildSubagentsReport, incompleteCells, loadRuns, subagentsReportMain } from './subagents-report.mjs';
import { trialListCost } from './transcript-usage.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-subagents-report-test-'));
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

/** `subagent_stats` as Claude Code 2.1.292 prints it, for a session whose `spawned` subagents all completed. */
const statsOf = (spawned, over = {}) => ({
  spawned, requested: { background: 0, foreground: spawned, unset: 0 }, started_in_background: 0, max_depth: Math.min(spawned, 1), spawned_by_subagents: 0, completed: spawned, failed: 0,
  killed: { parent: 0, user: 0, system: 0 }, refused: { depth_limit: 0, concurrency_limit: 0, budget: 0 }, by_type: spawned > 0 ? { 'general-purpose': spawned } : {}, ...over,
});

const side = (listCostUsd, over = {}) => ({ requests: 1, longPromptRequests: 0, listCostUsd, models: {}, ...over });
/** A list cost read from transcripts, as `trialListCost` records it: `orchestrator` and `subagents` in US dollars.
 * The total is given, not added here: the record holds all three, and the report must read each as it is. */
const measured = (orchestrator, subagents, total, over = {}) => ({
  source: 'transcripts', prices: PRICE_SOURCE,
  orchestrator: side(orchestrator), subagents: { ...side(subagents), agents: [] }, total: side(total),
  unpricedModels: [], unsplitCacheWriteTokens: 0, unreadableLines: 0, modelUsageCheck: { matches: true, models: {} },
  ...over,
});
/** A list cost estimated from `modelUsage`, for a trial that kept no transcript. */
const estimated = (low, high, over = {}) => ({ source: 'modelUsage', estimated: true, prices: PRICE_SOURCE, total: { listCostUsd: low === null ? null : { low, high }, models: {} }, unpricedModels: [], ...over });

/** One trial record of a subagent config as `runner.mjs` writes it, with the fields a test cares about overridden.
 * `costUsd` is Claude Code's own figure, which decides nothing: a report that read it would show 9 dollars. */
const trial = (over = {}) => ({
  task: 'house-rules', config: 'sub-opus-write', effort: 'medium', repeat: 1, score: 1, passed: 40, total: 40,
  inputTokens: 1000, outputTokens: 100, turns: 10, costUsd: 9, modelUsage: {}, subagents: 1, subagentStats: statsOf(1),
  wallMs: 60000, cliVersion: '2.1.292 (Claude Code)', error: null, startedAt: '2026-10-09T00:00:00.000Z',
  transcripts: { files: 3, errors: [] }, listCost: measured(1, 0.5, 1.5),
  ...over,
});

const CONFIG_NAMES = Object.keys(SUBAGENT_CONFIGS);
/** A results document as `suite.mjs` writes one for a run of subagent configs, pinning every config it holds. */
const docOf = (name, trials, over = {}) => ({
  format: 1, name, createdAt: '2026-10-09T00:00:00.000Z', model: 'claude-opus-5-5', permissionMode: 'bypassPermissions',
  stack: { claude: '2.1.292 (Claude Code)', gentleAi: '4.0.0', engram: '3.0.0', engramPlugin: '0.1.5' },
  subagentConfigs: Object.fromEntries([...new Set(trials.map((entry) => entry.config))].filter((config) => CONFIG_NAMES.includes(config)).map((config) => [config, subagentPin(config)])),
  args: { claude: 'claude', configs: CONFIG_NAMES, efforts: ['medium'], repeats: 1, tasks: TASKS, workRoot: 'work' },
  trials, ...over,
});

/** The whole matrix, `n` trials a cell; `over({ task, config, repeat })` overrides the fields of one trial. */
const matrix = (over = () => ({}), n = 3) => TASKS.flatMap((task) => CONFIG_NAMES.flatMap((config) => (
  Array.from({ length: n }, (_, i) => trial({ task, config, repeat: i + 1, ...over({ task, config, repeat: i + 1 }) }))
)));

const reportOf = (trials) => buildSubagentsReport([{ name: 'run', doc: docOf('run', trials) }]);
const cellOf = (report, { task = 'house-rules', mode = 'write', arm = 'sub-opus', effort = 'medium' } = {}) => report.efforts
  .find((entry) => entry.effort === effort).modes.find((entry) => entry.mode === mode).rows.find((row) => row.task === task).cells[arm];

const run = async (argv, docs) => {
  const dir = docs === undefined ? path.join(scratch, 'never-made') : resultsDir(docs);
  const io = { out: '', err: '' };
  const code = await subagentsReportMain(argv, {}, { resultsDir: dir, stdout: { write: (text) => { io.out += text; } }, stderr: { write: (text) => { io.err += text; } } });
  return { code, ...io, dir };
};
/** The lines of `out` whose columns start with `cells`, each split on the two spaces a table puts between columns. */
const rowsOf = (out, ...cells) => out.split('\n').map((line) => line.split(/\s{2,}/)).filter((columns) => cells.every((cell, index) => columns[index] === cell));
/** The part of `out` that reports `mode` at effort medium: from its heading to the heading of the next mode. */
const modeOf = (out, mode) => out.split(/\n(?=effort \S+, mode )/).find((part) => part.startsWith(`effort medium, mode ${mode}\n`)) ?? '';

// ---- what counts -------------------------------------------------------------------------------------------------

test('the matrix is the arms and the modes of configs.mjs, and the three tasks of the measurement', () => {
  const report = reportOf([trial()]);
  assert.deepEqual(report.arms, Object.entries(SUBAGENT_MODELS).map(([arm, subagentModel]) => ({ arm, subagentModel })));
  const [{ effort, modes }] = report.efforts;
  assert.equal(effort, 'medium');
  assert.deepEqual(modes.map((entry) => entry.mode), Object.keys(DELEGATION_MODES));
  for (const { rows } of modes) {
    assert.deepEqual(rows.map((row) => row.task), ['format-v2', 'house-rules', 'lost-updates'], 'every task of the matrix, with or without a trial');
    for (const row of rows) assert.deepEqual(Object.keys(row.cells), ['sub-opus', 'sub-haiku']);
  }
  assert.deepEqual(TASKS, ['format-v2', 'house-rules', 'lost-updates']);
});

test('a trial counts only when it spawned a subagent: the others are listed apart and are in no figure of their cell', () => {
  const report = reportOf([
    trial({ repeat: 1, score: 1, wallMs: 60000, turns: 10, listCost: measured(1, 0.5, 1.5) }),
    trial({ repeat: 2, score: 0.5, wallMs: 120000, turns: 20, listCost: measured(2, 0.25, 2.25) }),
    // It did the work alone: cheap or dear, fast or slow, it says nothing about a subagent.
    trial({ repeat: 3, score: 0, wallMs: 999000, turns: 99, subagents: 0, subagentStats: statsOf(0), listCost: measured(50, 0, 50) }),
    // It died before it printed a result: whether it delegated is not known, so it is not taken to have.
    trial({ repeat: 4, score: 0, wallMs: 1800000, turns: null, error: 'timeout', subagents: null, subagentStats: null, transcripts: { files: 0, errors: [] }, listCost: null }),
  ]);
  const cell = cellOf(report);
  assert.deepEqual([cell.recorded, cell.counted, cell.notDelegated, cell.unknown], [4, 2, 1, 1]);
  assert.deepEqual(cell.score, { known: 2, mean: 0.75, min: 0.5, max: 1 });
  assert.equal(cell.passes, 1, 'a pass is a trial that passed every hidden check');
  assert.deepEqual([cell.wallMs.mean, cell.turns.mean], [90000, 15]);
  assert.deepEqual([cell.cost.orchestrator.mean, cell.cost.subagents.mean, cell.cost.total.mean], [1500000000, 375000000, 1875000000], 'in whole billionths of a dollar');
  assert.equal(cell.outcomes.spawned, 2);
  assert.deepEqual(report.notCounted.map(({ trial: label, reason, score }) => [label, reason, score]), [
    ['house-rules sub-opus-write medium #3', 'did not delegate', 0],
    ['house-rules sub-opus-write medium #4', 'recorded no spawned count (timeout)', 0],
  ]);
});

test('a spawned count that is no number is not a delegation, and one subagent is enough', () => {
  const cell = cellOf(reportOf([
    trial({ repeat: 1, subagentStats: { spawned: 'two', completed: 2 } }),
    trial({ repeat: 2, subagentStats: {} }),
    trial({ repeat: 3, subagentStats: statsOf(1) }),
    // The count F5 recorded is not what decides: the stats are.
    trial({ repeat: 4, subagents: 3, subagentStats: null }),
  ]));
  assert.deepEqual([cell.recorded, cell.counted, cell.notDelegated, cell.unknown], [4, 1, 0, 3]);
});

// ---- the figures of a cell ---------------------------------------------------------------------------------------

test('money is summed in whole billionths of a dollar, so a mean of list costs is exact', () => {
  // 0.1 + 0.2 + 0.3 is 0.6000000000000001 in dollars, and a third of it is not 0.2.
  const cell = cellOf(reportOf([0.1, 0.2, 0.3].map((cost, i) => trial({ repeat: i + 1, listCost: measured(cost, 0.004097825, cost) }))));
  assert.deepEqual(cell.cost.orchestrator, { known: 3, mean: 200000000 });
  assert.deepEqual(cell.cost.subagents, { known: 3, mean: 4097825 }, 'the probe subagent, to the billionth');
  // A mean that is no whole number of billionths is rounded to one, once.
  assert.equal(cellOf(reportOf([trial({ repeat: 1, listCost: measured(0.000000001, 0, 0) }), trial({ repeat: 2, listCost: measured(0.000000002, 0, 0) })])).cost.orchestrator.mean, 2);
});

test('the subagent outcomes of a cell are the totals over its counted trials: killed and refused summed over their reasons, and the types', () => {
  const cell = cellOf(reportOf([
    trial({ repeat: 1, subagentStats: statsOf(3, { completed: 1, failed: 1, killed: { parent: 1, user: 0, system: 0 }, by_type: { Explore: 2, 'general-purpose': 1 } }) }),
    trial({ repeat: 2, subagentStats: statsOf(2, { killed: { parent: 0, user: 0, system: 1 }, refused: { depth_limit: 0, concurrency_limit: 2, budget: 1 }, by_type: { Explore: 2 } }) }),
    trial({ repeat: 3, subagentStats: statsOf(0, { refused: { depth_limit: 9, concurrency_limit: 0, budget: 0 } }) }),
  ]));
  assert.deepEqual(cell.outcomes, { spawned: 5, completed: 3, failed: 1, killed: 2, refused: 3, byType: { Explore: 4, 'general-purpose': 1 } }, 'the trial that did not delegate adds nothing');
  // Stats that hold the spawned count alone: the rest is unknown, never 0.
  const bare = cellOf(reportOf([trial({ subagentStats: { spawned: 2 } })])).outcomes;
  assert.deepEqual(bare, { spawned: 2, completed: null, failed: null, killed: null, refused: null, byType: {} });
});

test('each row compares the second arm with the first: the score as a difference, cost, wall time and turns as a ratio', () => {
  const report = reportOf([
    ...[1, 1, 1].map((score, i) => trial({ config: 'sub-opus-verify', repeat: i + 1, score, wallMs: 100000, turns: 20, listCost: measured(2, 2, 4) })),
    ...[1, 0.5, 0.75].map((score, i) => trial({ config: 'sub-haiku-verify', repeat: i + 1, score, wallMs: 50000, turns: 30, listCost: measured(2.5, 0.1, 2.6) })),
  ]);
  const row = report.efforts[0].modes.find((entry) => entry.mode === 'verify').rows.find((entry) => entry.task === 'house-rules');
  assert.deepEqual(row.compared, [{
    arm: 'sub-haiku', against: 'sub-opus', scoreDiff: -0.25, passDiff: -2, cost: { orchestrator: 1.25, subagents: 0.05, total: 0.65 }, wallMs: 0.5, turns: 1.5,
  }]);
  // A cell without a counted trial has nothing to compare, and a cost of nothing has no ratio.
  const alone = reportOf([trial({ config: 'sub-haiku-verify', listCost: measured(1, 0, 1) }), trial({ config: 'sub-opus-verify', listCost: measured(1, 0, 1) })]);
  const [compared] = alone.efforts[0].modes.find((entry) => entry.mode === 'verify').rows.find((entry) => entry.task === 'house-rules').compared;
  assert.deepEqual([compared.cost.subagents, compared.cost.total, compared.scoreDiff], [null, 1, 0]);
  const [missing] = alone.efforts[0].modes.find((entry) => entry.mode === 'write').rows[0].compared;
  assert.deepEqual([missing.scoreDiff, missing.cost.total, missing.wallMs], [null, null, null]);
});

test('an estimated cost is kept out of every measured mean and is shown as an estimate with its range', async () => {
  const trials = [
    trial({ repeat: 1, listCost: measured(1, 0.5, 1.5) }),
    trial({ repeat: 2, listCost: measured(3, 0.5, 3.5) }),
    trial({ repeat: 3, transcripts: { files: 0, errors: [] }, listCost: estimated(0.221660225, 0.3479156) }),
    ...[1, 2].map((repeat) => trial({ config: 'sub-haiku-write', repeat, transcripts: { files: 0, errors: [] }, listCost: estimated(0.2 * repeat, 0.4 * repeat) })),
  ];
  const report = reportOf(trials);
  const cell = cellOf(report);
  assert.deepEqual(cell.cost.total, { known: 2, mean: 2500000000 }, 'the two measured costs, and not the estimate');
  assert.deepEqual(cell.cost.estimate, { known: 1, low: 221660225, high: 347915600 });
  const haiku = cellOf(report, { arm: 'sub-haiku' });
  assert.deepEqual([haiku.cost.total, haiku.cost.orchestrator, haiku.cost.estimate], [{ known: 0, mean: null }, { known: 0, mean: null }, { known: 2, low: 300000000, high: 600000000 }]);

  const { out } = await run([], { run: docOf('run', trials) });
  const [opusRow] = rowsOf(modeOf(out, 'write'), 'house-rules', 'sub-opus');
  assert.deepEqual(opusRow.slice(5, 8), ['$2.0000*', '$0.5000*', '$2.5000*'], 'a mean over fewer trials than were counted says so');
  const [haikuRow] = rowsOf(modeOf(out, 'write'), 'house-rules', 'sub-haiku');
  assert.deepEqual(haikuRow.slice(5, 8), ['?', '?', 'est. $0.3000 to $0.6000'], 'no split, and never a figure without "est."');
  const [against] = rowsOf(modeOf(out, 'write'), 'house-rules', 'sub-haiku vs sub-opus');
  assert.deepEqual(against.slice(5, 8), ['-', '-', '-'], 'an estimate is compared with nothing');
  assert.match(out, /house-rules sub-opus-write medium #3: cost estimated from modelUsage, \$0\.2217 to \$0\.3479/);
  assert.match(out, /\* a mean over the counted trials that know the value/);
});

// ---- flags -------------------------------------------------------------------------------------------------------

test('what makes a figure doubtful is flagged trial by trial, and counted by kind', async () => {
  const flagged = [
    trial({ repeat: 1, listCost: measured(1, 1, 2, { modelUsageCheck: { matches: false, models: { 'claude-opus-5-5': true, 'claude-haiku-5-5': false } } }) }),
    trial({ repeat: 2, listCost: measured(1, null, null, { unpricedModels: ['claude-haiku-4-5'] }) }),
    trial({ repeat: 3, listCost: measured(1, 1, 2, { total: side(2, { longPromptRequests: 3, models: { 'claude-haiku-5-5': side(1, { longPromptRequests: 3 }), 'claude-opus-5-5': side(1) } }) }) }),
    trial({ repeat: 4, transcripts: { files: 2, errors: ['s/subagents/agent-a.meta.json: EPERM'] } }),
    trial({ repeat: 5, listCost: measured(1, 1, 2, { unreadableLines: 4, unsplitCacheWriteTokens: 1000 }) }),
    trial({ repeat: 6, transcripts: { files: 0, errors: ['earlier attempt not removed: EBUSY'] }, listCost: estimated(null, null, { unpricedModels: ['fake-model'] }) }),
    trial({ repeat: 7, listCost: estimated(0.2, 0.3, { transcriptsWithoutRequests: 2, unreadableLines: 5 }) }),
    trial({ repeat: 8, error: 'agent-error', transcripts: { files: 1, errors: ['summary: cannot read a transcript'] }, listCost: null }),
    trial({ repeat: 9 }),
    // A trial that is not counted is flagged all the same: its record is as doubtful.
    trial({ repeat: 10, subagents: 0, subagentStats: statsOf(0), listCost: measured(1, 0, 1, { unreadableLines: 1 }) }),
  ];
  const report = reportOf(flagged);
  const kindsOf = (repeat) => report.flags.find((entry) => entry.trial === `house-rules sub-opus-write medium #${repeat}`)?.flags.map((flag) => flag.kind) ?? [];
  assert.deepEqual(Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((repeat) => [repeat, kindsOf(repeat)])), {
    1: ['modelUsageMismatch'], 2: ['unpricedModels'], 3: ['longPrompt'], 4: ['transcriptErrors'], 5: ['unreadableLines', 'unsplitCacheWrites'],
    6: ['estimatedCost', 'unpricedModels', 'transcriptErrors'], 7: ['estimatedCost', 'transcriptsWithoutRequests', 'unreadableLines'],
    8: ['error', 'noListCost', 'transcriptErrors'], 9: [], 10: ['unreadableLines'],
  });
  assert.deepEqual(report.flagCounts, {
    error: 1, estimatedCost: 2, noListCost: 1, transcriptsWithoutRequests: 1, modelUsageMismatch: 1, unpricedModels: 2, longPrompt: 1, transcriptErrors: 3, unreadableLines: 3, unsplitCacheWrites: 1,
  });

  const { out } = await run([], { run: docOf('run', flagged) });
  const line = (repeat) => out.split('\n').find((entry) => entry.includes(`sub-opus-write medium #${repeat}: `) && !entry.includes('did not delegate')) ?? '';
  assert.match(line(1), /transcript totals differ from modelUsage for claude-haiku-5-5$/);
  assert.match(line(2), /no list price for claude-haiku-4-5$/);
  assert.match(line(3), /3 requests over the long-prompt limit \(claude-haiku-5-5 3\)$/);
  assert.match(line(4), /transcripts: s\/subagents\/agent-a\.meta\.json: EPERM$/);
  assert.match(line(5), /4 unreadable transcript lines; 1000 cache-write tokens of unknown lifetime, priced as 5-minute writes$/);
  assert.match(line(6), /cost estimated from modelUsage, range unknown; no list price for fake-model; transcripts: earlier attempt not removed: EBUSY$/);
  assert.match(line(7), /cost estimated from modelUsage, \$0\.2000 to \$0\.3000; 2 kept transcripts held no readable request; 5 unreadable transcript lines$/);
  assert.match(line(8), /error agent-error; no list cost recorded \(1 transcript file kept\); transcripts: summary: cannot read a transcript$/);
  assert.equal(line(9), '', 'a trial with nothing to flag is not listed');
  assert.match(out, /Flags: 9 of 10 recorded trials/);
  assert.match(out, /estimated cost 2/);
  assert.match(out, /transcript errors 3/);

  const clean = await run([], { run: docOf('run', [trial()]) });
  assert.match(clean.out, /Flags: none in 1 recorded trial/);
});

// ---- the command -------------------------------------------------------------------------------------------------

test('the report prints, per effort and mode, the two arms of each task side by side with their comparison, and the subagent outcomes', async () => {
  const trials = matrix(({ config, repeat }) => (SUBAGENT_CONFIGS[config].arm === 'sub-haiku'
    ? { score: repeat === 3 ? 0.9 : 1, wallMs: 45000, turns: 12, listCost: measured(1.2, 0.03, 1.23) }
    : { wallMs: 90000, turns: 10, listCost: measured(1, 0.5, 1.5) }));
  const { code, out, err } = await run([], { run: docOf('run', trials) });
  assert.equal(code, 0);
  assert.equal(err, '');
  for (const mode of Object.keys(DELEGATION_MODES)) assert.ok(out.includes(`effort medium, mode ${mode}`), `a table for ${mode}`);
  assert.equal(rowsOf(out, 'format-v2', 'sub-opus').length, 6, 'a results row and an outcomes row in each of the three modes');
  assert.deepEqual(rowsOf(modeOf(out, 'verify'), 'lost-updates', 'sub-opus')[0], ['lost-updates', 'sub-opus', '3 of 3', '1.00 [1.00-1.00]', '3/3', '$1.0000', '$0.5000', '$1.5000', '1m30s', '10.0']);
  assert.deepEqual(rowsOf(modeOf(out, 'verify'), 'lost-updates', 'sub-haiku')[0], ['lost-updates', 'sub-haiku', '3 of 3', '0.97 [0.90-1.00]', '2/3', '$1.2000', '$0.0300', '$1.2300', '45s', '12.0']);
  assert.deepEqual(rowsOf(modeOf(out, 'verify'), 'lost-updates', 'sub-haiku vs sub-opus')[0], ['lost-updates', 'sub-haiku vs sub-opus', '-', '-0.03', '-1', '1.20x', '0.06x', '0.82x', '0.50x', '1.20x']);
  assert.deepEqual(rowsOf(modeOf(out, 'verify'), 'lost-updates', 'sub-haiku')[1], ['lost-updates', 'sub-haiku', '3', '3', '0', '0', '0', 'general-purpose 3']);
  assert.match(out, /runs: run/);
  assert.match(out, /model claude-opus-5-5, permission mode bypassPermissions/);
  assert.match(out, /sub-opus forces claude-opus-5-5 on every subagent, sub-haiku claude-haiku-5-5/);
  assert.ok(out.includes('at list price') && out.includes(`(${PRICE_SOURCE.url}, read ${PRICE_SOURCE.readOn})`), 'the price table the costs were computed from');
  assert.match(out, /Trials not counted: none/);
  assert.doesNotMatch(out, /\$9\./, "Claude Code's own cost is never shown");
});

test('a recorded smoke run is read as the runner writes it: the fixture holds the list cost the probe session records', async () => {
  const fixture = path.join(here, 'fixtures', 'subagents-results');
  const [{ doc }] = loadRuns({ dir: fixture });
  const haiku = doc.trials.find((entry) => entry.config === 'sub-haiku-write');
  // The reader and the writer meet here: the fixture's list cost is what `trialListCost` makes of the probe session,
  // under the price table it was recorded with.
  assert.deepEqual(haiku.listCost, { ...trialListCost({ dir: path.join(here, 'fixtures', 'transcripts', 'probe'), modelUsage: haiku.modelUsage }), prices: haiku.listCost.prices });
  const io = { out: '', err: '' };
  const code = await subagentsReportMain(['--results-dir', fixture], {}, { resultsDir: path.join(scratch, 'never-made'), stdout: { write: (text) => { io.out += text; } }, stderr: { write: (text) => { io.err += text; } } });
  assert.equal(code, 0, io.err);
  assert.deepEqual(rowsOf(modeOf(io.out, 'write'), 'house-rules', 'sub-haiku')[0], ['house-rules', 'sub-haiku', '1 of 1', '1.00 [1.00-1.00]', '1/1', '$0.3414', '$0.0041', '$0.3455', '4m05s', '21.0']);
  assert.deepEqual(rowsOf(modeOf(io.out, 'write'), 'house-rules', 'sub-haiku vs sub-opus')[0].slice(5, 8), ['0.28x', '0.01x', '0.19x']);
  assert.match(io.out, /house-rules sub-opus-write medium #1: transcript totals differ from modelUsage for claude-opus-5-5/);
});

test('with no results directory, no results or no trial, the report says that nothing is recorded: exit 0, and exit 1 with --require-complete', async () => {
  for (const docs of [undefined, {}, { empty: docOf('empty', []) }, { 'notes.txt': 'not a results file', 'run.json.tmp': '{ half' }]) {
    const plain = await run([], docs);
    assert.deepEqual([plain.code, plain.err], [0, ''], JSON.stringify(docs));
    assert.match(plain.out, /^no subagent trial is recorded yet in /);
    const gate = await run(['--require-complete'], docs);
    assert.equal(gate.code, 1, JSON.stringify(docs));
    assert.equal(gate.out, '');
    assert.match(gate.err, /--require-complete: no subagent trial is recorded yet in .*a report of nothing is not a pass/);
  }
});

test('--require-complete passes on the whole matrix with 3 counted trials a cell, and fails naming each short cell and why', async () => {
  const pass = await run(['--require-complete'], { run: docOf('run', matrix()) });
  assert.deepEqual([pass.code, pass.err], [0, '']);

  const short = matrix(({ task, config, repeat }) => {
    if (task === 'format-v2' && config === 'sub-haiku-explore' && repeat === 2) return { subagents: 0, subagentStats: statsOf(0) };
    if (task === 'format-v2' && config === 'sub-haiku-explore' && repeat === 3) return { error: 'timeout', subagents: null, subagentStats: null, listCost: null };
    return {};
  }).filter((entry) => !(entry.task === 'lost-updates' && entry.config === 'sub-opus-verify') && !(entry.task === 'house-rules' && entry.config === 'sub-opus-write' && entry.repeat > 1));
  const fail = await run(['--require-complete'], { run: docOf('run', short) });
  assert.equal(fail.code, 1);
  assert.match(fail.out, /effort medium, mode explore/, 'the report is still printed');
  assert.deepEqual(fail.err.trim().split('\n'), [
    '--require-complete: cells with fewer than 3 counted trials:',
    '  format-v2 explore sub-haiku medium: 1 of 3 counted (1 did not delegate, 1 recorded no spawned count)',
    '  lost-updates verify sub-opus medium: 0 of 3 counted (3 not recorded)',
    '  house-rules write sub-opus medium: 1 of 3 counted (2 not recorded)',
  ]);

  // One task alone is not the matrix: the cells of the tasks nobody ran are short too.
  const oneTask = await run(['--require-complete'], { run: docOf('run', matrix().filter((entry) => entry.task === 'house-rules')) });
  assert.equal(oneTask.code, 1);
  assert.equal(oneTask.err.trim().split('\n').length, 1 + 2 * CONFIG_NAMES.length);
  // A fourth repeat is no harm, and a task outside the matrix is held to the same rule once it appears.
  const extra = [...matrix(() => ({}), 4), trial({ task: 'resolver', config: 'sub-opus-write' })];
  const outside = await run(['--require-complete'], { run: docOf('run', extra) });
  assert.equal(outside.code, 1);
  assert.equal(outside.err.trim().split('\n').length, 1 + CONFIG_NAMES.length);
  assert.match(outside.err, /resolver write sub-opus medium: 1 of 3 counted \(2 not recorded\)/);
  assert.match(outside.err, /resolver write sub-haiku medium: 0 of 3 counted \(3 not recorded\)/);
});

test('incompleteCells lists every cell of the matrix, at every effort in the runs, that has fewer than 3 counted trials', () => {
  assert.deepEqual(incompleteCells(reportOf(matrix())), []);
  const high = matrix().map((entry) => ({ ...entry, effort: 'high' })).filter((entry) => !(entry.task === 'house-rules' && entry.config === 'sub-haiku-write' && entry.repeat === 3));
  const cells = incompleteCells(buildSubagentsReport([{ name: 'medium', doc: docOf('medium', matrix()) }, { name: 'high', doc: docOf('high', high) }]));
  assert.deepEqual(cells, [{ task: 'house-rules', mode: 'write', arm: 'sub-haiku', effort: 'high', required: 3, counted: 2, notRecorded: 1, notDelegated: 0, unknown: 0 }]);
});

// ---- what it refuses ---------------------------------------------------------------------------------------------

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

test('loadRuns reads every results document of the directory, or the named ones, and refuses what it cannot read', () => {
  const docs = { beta: docOf('beta', [trial()]), alpha: docOf('alpha', [trial({ repeat: 2 })]), 'alpha.json.tmp': '{ half', 'notes.txt': 'no' };
  assert.deepEqual(loadRuns({ dir: resultsDir(docs) }).map((entry) => entry.name), ['alpha', 'beta']);
  assert.deepEqual(loadRuns({ dir: resultsDir(docs), names: ['beta'] }).map((entry) => entry.name), ['beta']);
  assert.match(refusal(() => loadRuns({ dir: resultsDir(docs), names: ['gamma'] })), /gamma/);
  assert.match(refusal(() => loadRuns({ dir: path.join(scratch, 'never-made'), names: ['gamma'] })), /gamma/);
  assert.deepEqual([loadRuns({ dir: path.join(scratch, 'never-made') }), loadRuns({ dir: resultsDir() })], [[], []], 'nothing recorded is no error');
  const cases = {
    'old.json': docOf('old', [], { format: 2 }),
    'broken.json': '{ not json',
    'notrials.json': { format: 1, name: 'notrials' },
    'half.json': docOf('half', [{ task: 'house-rules', config: 'sub-opus-write' }]),
    // F5's arms are `evals/report.mjs`'s to read, and a Codex run has no subagent config.
    'arms.json': docOf('arms', [trial({ config: 'minimal' })]),
    'codex.json': docOf('codex', [trial()], { agent: 'codex' }),
  };
  for (const [file, doc] of Object.entries(cases)) assert.match(refusal(() => loadRuns({ dir: resultsDir({ fine: docOf('fine', [trial()]), [file]: doc }) })), new RegExp(file.replace('.', '\\.')), file);
});

test('runs that cannot be read together are refused with exit 1 and nothing printed as a result', async () => {
  const cases = [
    [{ a: docOf('a', [trial()]), b: docOf('b', [trial()]) }, /house-rules sub-opus-write medium #1 is recorded in runs a and b/],
    [{ a: docOf('a', [trial()]), b: docOf('b', [trial({ repeat: 2 })], { stack: { claude: '2.1.293 (Claude Code)' } }) }, /runs a and b differ in stack\.claude/],
    // The arm names the model: a run that forced another one on that config measured something else.
    [{ a: docOf('a', [trial()], { subagentConfigs: { 'sub-opus-write': { ...subagentPin('sub-opus-write'), model: 'claude-haiku-5-5' } } }) }, /run a pins sub-opus-write to subagent model "claude-haiku-5-5", and the sub-opus arm is claude-opus-5-5/],
    [{ a: docOf('a', [trial()], { subagentConfigs: {} }) }, /run a pins sub-opus-write to subagent model missing/],
    [{ a: docOf('a', [trial()]), b: docOf('b', [trial({ repeat: 2 })], { subagentConfigs: { 'sub-opus-write': { ...subagentPin('sub-opus-write'), delegationSha256: 'another' } } }) }, /runs a and b gave sub-opus-write different delegation texts/],
    [{ a: '{ nope' }, /a\.json/],
  ];
  for (const [docs, message] of cases) {
    const { code, out, err } = await run([], docs);
    assert.deepEqual([code, out], [1, ''], String(message));
    assert.match(err, message);
  }
});

test('--runs reports only the named runs, and --results-dir overrides the directory', async () => {
  const docs = { smoke: docOf('smoke', [trial()]), matrix: docOf('matrix', matrix()) };
  const both = await run([], docs);
  assert.equal(both.code, 1, 'the smoke trial is in both');
  const only = await run(['--runs', 'matrix', '--require-complete'], docs);
  assert.deepEqual([only.code, only.err], [0, '']);
  assert.match(only.out, /runs: matrix\n/);
  const missing = await run(['--runs', 'other'], docs);
  assert.deepEqual([missing.code, missing.out], [1, '']);
  assert.match(missing.err, /other/);
});

test('a usage error exits 2 with the usage text: an unknown flag, a missing value, a repeated flag, a bad run name', async () => {
  for (const argv of [['--frobnicate'], ['extra'], ['--runs'], ['--results-dir'], ['--require-complete', '--require-complete'], ['--runs', '../x'], ['--runs', 'a,a'], ['--json'], ['--min-discriminating', '3']]) {
    const { code, out, err } = await run(argv, { run: docOf('run', [trial()]) });
    assert.equal(code, 2, argv.join(' '));
    assert.equal(out, '');
    assert.ok(err.includes(USAGE), argv.join(' '));
  }
});

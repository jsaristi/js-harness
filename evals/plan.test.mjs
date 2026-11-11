import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellBasis, cellKey, planLines, runPlan, taskRecord } from './plan.mjs';

// G3 of `odd/tasks/future-model-protocol.md`: what a run would cost, from what was recorded, before it spends.
const MODEL = 'claude-opus-5-5';
const trial = (over = {}) => ({ task: 'alpha', config: 'minimal', effort: 'medium', repeat: 1, error: null, wallMs: 120000, costUsd: 1, ...over });
const docOf = (createdAt, trials, over = {}) => ({ model: MODEL, createdAt, trials, ...over });

test('a cell is estimated from the means of the newest results file on the same model and agent that holds it, its failed trials left out', () => {
  const docs = [
    { name: 'old', doc: docOf('2026-10-01T00:00:00.000Z', [trial({ wallMs: 600000, costUsd: 9 })]) },
    { name: 'new', doc: docOf('2026-10-03T00:00:00.000Z', [trial({ wallMs: 60000, costUsd: 1 }), trial({ repeat: 2, wallMs: 180000, costUsd: 3 }), trial({ repeat: 3, error: 'cap', wallMs: 1, costUsd: 100 })]) },
  ];
  const basis = cellBasis({ docs, model: MODEL, agent: 'claude' });
  assert.deepEqual(basis.get(cellKey('alpha', 'minimal', 'medium')), { run: 'new', createdAt: '2026-10-03T00:00:00.000Z', trials: 2, wallMs: 120000, costUsd: 2 });
});

test('trials of another model, another agent or another effort are never borrowed', () => {
  const docs = [
    { name: 'other-model', doc: docOf('2026-10-03T00:00:00.000Z', [trial()], { model: 'claude-haiku-5-5' }) },
    { name: 'codex', doc: docOf('2026-10-03T00:00:00.000Z', [trial()], { agent: 'codex' }) },
    { name: 'high', doc: docOf('2026-10-03T00:00:00.000Z', [trial({ effort: 'high' })]) },
  ];
  const basis = cellBasis({ docs, model: MODEL, agent: 'claude' });
  assert.equal(basis.has(cellKey('alpha', 'minimal', 'medium')), false);
  assert.equal(basis.has(cellKey('alpha', 'minimal', 'high')), true);
});

test('the plan adds the trials whose cell is known and names the cells that are not, with the cap windows always unknown', () => {
  const basis = cellBasis({ docs: [{ name: 'f5', doc: docOf('2026-10-03T00:00:00.000Z', [trial(), trial({ config: 'current', wallMs: 240000, costUsd: 2 })]) }], model: MODEL, agent: 'claude' });
  const toRun = [
    { task: 'alpha', config: 'minimal', effort: 'medium' }, { task: 'alpha', config: 'current', effort: 'medium' },
    { task: 'alpha', config: 'current', effort: 'medium' }, { task: 'beta', config: 'minimal', effort: 'medium' },
  ];
  const plan = runPlan({ planned: 6, toRun, basis, model: MODEL, agent: 'claude' });
  assert.deepEqual([plan.known, plan.wallMs, plan.costUsd, plan.unknown], [3, 600000, 5, [['beta minimal medium', 1]]]);
  const lines = planLines(plan);
  assert.equal(lines[0], '6 trials planned on claude-opus-5-5, 4 to run');
  assert.equal(lines[1], 'estimate for 3 of the 4 trials to run: about 10 min of agent time, about $5.00 of list cost');
  assert.match(lines[2], /^unknown for 1 trials, .*beta minimal medium \(1\)/);
  assert.match(lines[3], /usage-cap windows: unknown/);
  assert.match(lines[4], /^source: f5 \(2026-10-03\); agent time leaves out each trial's setup .*costUsd, a list cost, not what the subscription bills$/);
});

test('with nothing recorded on the model the plan says it has no estimate, and with nothing to run it says so', () => {
  const none = planLines(runPlan({ planned: 2, toRun: [{ task: 'alpha', config: 'minimal', effort: 'medium' }], basis: new Map(), model: 'claude-fable-5-5', agent: 'claude' }));
  assert.equal(none[1], 'no estimate: no results file holds a trial of these cells on claude-fable-5-5');
  assert.ok(none.every((line) => !line.startsWith('source:')));
  assert.deepEqual(planLines(runPlan({ planned: 2, toRun: [], basis: new Map(), model: MODEL, agent: 'claude' })), ['2 trials planned on claude-opus-5-5, 0 to run', 'nothing to run: every planned trial is recorded']);
});

test('a Codex cell is costed at the list prices from its tokens, since Codex records no cost', () => {
  const codexTrial = trial({ costUsd: undefined, inputTokens: 1000000, cachedInputTokens: 0, cacheWriteInputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0 });
  const basis = cellBasis({ docs: [{ name: 'f6', doc: docOf('2026-10-05T00:00:00.000Z', [codexTrial], { model: 'gpt-6.1-sol', agent: 'codex' }) }], model: 'gpt-6.1-sol', agent: 'codex' });
  assert.equal(basis.get(cellKey('alpha', 'minimal', 'medium')).costUsd, 2, 'a million uncached input tokens at $2.00');
});

// Item analysis, where the spend is decided (odd/tasks/audit-u9-eval-bar.md, spec 4; candidate 14 of the audit of
// 2026-11-09): a task every recorded trial passes, or none does, separates nothing, and a run of it buys a number
// that was known. On the record of 2026-11-11, four incident cases had passed 20 of 20 and three had passed 1 of 62.
test('the record of a task is its trials graded at 1 over every recorded run of the model and agent, an errored trial counted', () => {
  const docs = [
    { name: 'a', doc: docOf('2026-10-01T00:00:00.000Z', [trial({ score: 1 }), trial({ repeat: 2, score: 0.5 }), trial({ config: 'current', effort: 'high', score: 1, error: 'timeout' }), trial({ repeat: 3, score: null })]) },
    { name: 'b', doc: docOf('2026-10-03T00:00:00.000Z', [trial({ score: 1 }), trial({ task: 'beta', score: 0 })]) },
    { name: 'other-model', doc: docOf('2026-10-03T00:00:00.000Z', [trial({ score: 1 })], { model: 'claude-haiku-5-5' }) },
    { name: 'codex', doc: docOf('2026-10-03T00:00:00.000Z', [trial({ score: 1 })], { agent: 'codex' }) },
  ];
  const record = taskRecord({ docs, model: MODEL, agent: 'claude' });
  assert.deepEqual([...record], [['alpha', { passed: 3, trials: 4 }], ['beta', { passed: 0, trials: 1 }]]);
});

test('the plan prints each task\'s recorded passes and names the tasks that never failed or never passed in ten trials or more', () => {
  const record = new Map([
    ['always', { passed: 20, trials: 20 }], ['nearly', { passed: 9, trials: 10 }], ['never', { passed: 0, trials: 21 }], ['once', { passed: 1, trials: 20 }],
    ['moves', { passed: 17, trials: 20 }], ['few', { passed: 9, trials: 9 }],
  ]);
  const toRun = ['always', 'nearly', 'never', 'once', 'moves', 'few', 'new', 'always'].map((task) => ({ task, config: 'minimal', effort: 'medium' }));
  const plan = runPlan({ planned: 8, toRun, basis: new Map(), record, model: MODEL, agent: 'claude' });
  assert.deepEqual(plan.passes, [
    { task: 'always', passed: 20, trials: 20, extreme: 'never failed' }, { task: 'nearly', passed: 9, trials: 10, extreme: 'never failed' },
    { task: 'never', passed: 0, trials: 21, extreme: 'never passed' }, { task: 'once', passed: 1, trials: 20, extreme: 'never passed' },
    { task: 'moves', passed: 17, trials: 20, extreme: null }, { task: 'few', passed: 9, trials: 9, extreme: null }, { task: 'new', passed: 0, trials: 0, extreme: null },
  ]);
  const lines = planLines(plan);
  const from = lines.indexOf('recorded passes on claude-opus-5-5, a pass being a trial graded at 1, over every recorded run of the model whatever the configuration, the effort and the version of the case then:');
  assert.ok(from > 0, lines.join('\n'));
  assert.deepEqual(lines.slice(from + 1), [
    '  always: passed 20 of 20 recorded',
    '  nearly: passed 9 of 10 recorded',
    '  never: passed 0 of 21 recorded',
    '  once: passed 1 of 20 recorded',
    '  moves: passed 17 of 20 recorded',
    '  few: passed 9 of 9 recorded',
    '  new: no trial recorded',
    'never failed or never passed, within one trial, in 10 recorded trials or more, so a run of them is unlikely to move: always, nearly (never failed); never, once (never passed)',
  ]);
  // A plan that was handed no record says nothing of it, and one with no such task prints no such line.
  assert.ok(planLines(runPlan({ planned: 1, toRun: toRun.slice(0, 1), basis: new Map(), model: MODEL, agent: 'claude' })).every((line) => !/recorded passes|never failed/.test(line)));
  const quiet = planLines(runPlan({ planned: 1, toRun: toRun.slice(4, 5), basis: new Map(), record, model: MODEL, agent: 'claude' }));
  assert.equal(quiet.at(-1), '  moves: passed 17 of 20 recorded');
});

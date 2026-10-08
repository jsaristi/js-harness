import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PART_MAX_CHANGED_LINES } from './codex-review-parts.mjs';
import { inputEstimator, MAX_PARTS_WITHOUT_FLAG, measuredParts, needsFlagLine, planLines, reviewPlan, RUNS_FOR_A_BAND, RUNS_TO_STAND_ALONE } from './codex-review-plan.mjs';

const PAIR = { model: 'gpt-6.1-sol', effort: 'high' };

/** The run line of a part that stood, as `js-harness codex-review` writes it, with the fields a plan reads:
 * `changedLines` of the part and the `inputTokens` its session spent. `over` replaces any of them. */
const partRun = (changedLines, inputTokens, over = {}) => ({
  schema: 'js-harness.codex-review-run/v1',
  part: { index: 1, of: 2, files: 1, changedLines },
  outcome: 'reviewed',
  session: 'lean',
  model: PAIR.model,
  effort: PAIR.effort,
  usage: { inputTokens, cachedInputTokens: 0, outputTokens: 10, reasoningOutputTokens: 0 },
  usageSource: 'rollout',
  sessionModel: PAIR.model,
  sessionEffort: PAIR.effort,
  ...over,
});

/** The same, of a session that ran at `medium`: what every line of this machine was until 2026-10-08. */
const atMedium = (changedLines, inputTokens) => partRun(changedLines, inputTokens, { effort: 'medium', sessionEffort: 'medium' });

// --- what the run log measured ---

test('a measured part is a run line of a part that stood, with its changed lines, its input tokens and what its session ran on', () => {
  assert.deepEqual(measuredParts([partRun(200, 60000), atMedium(900, 180000)]), [
    { changedLines: 200, inputTokens: 60000, model: 'gpt-6.1-sol', effort: 'high' },
    { changedLines: 900, inputTokens: 180000, model: 'gpt-6.1-sol', effort: 'medium' },
  ]);
  // A session whose rollout file named no model is measured all the same: its tokens were read.
  assert.deepEqual(measuredParts([partRun(200, 60000, { sessionModel: null, sessionEffort: null })]), [{ changedLines: 200, inputTokens: 60000, model: null, effort: null }]);
});

test('a line that measured no part, no changed line or no input token is not a measured part, nor one of an attempt that did not stand', () => {
  const whole = partRun(200, 60000);
  delete whole.part;
  const fromEvents = partRun(200, 0);
  delete fromEvents.usageSource;
  const beforeSession = partRun(200, 60000);
  delete beforeSession.session;
  const left = [
    whole, // a range reviewed whole: the line holds no count of changed lines
    partRun(0, 60000), // a part of binary files alone
    fromEvents, // written before `usageSource`: the zeros of Codex's events, not a measurement
    partRun(200, null, { usageSource: null }), // a home that held no token count
    partRun(200, 0), // a count that says nothing was sent is not one of a review
    partRun(200, 60000, { outcome: 'failed' }),
    partRun(200, 60000, { outcome: 'not-inspected' }),
    partRun(200, 60000, { outcome: 'timed-out' }),
    partRun(200, 60000, { outcome: 'interrupted' }),
    beforeSession, // no `session` is the `current` one, which was never measured
    partRun(200, 60000, { session: 'current' }),
    partRun(200, 60000, { part: { index: 3, of: 2, files: 1, changedLines: 200 } }), // not a part
    null,
    'not a line',
  ];
  assert.deepEqual(measuredParts(left), []);
  assert.deepEqual(measuredParts([]), []);
});

// --- the estimate ---

test('with no measured part there is no estimate, and that is said instead of a number', () => {
  for (const runs of [[], [partRun(0, 60000)], [partRun(200, 60000, { outcome: 'failed' })]]) {
    const none = inputEstimator(runs, PAIR);
    assert.deepEqual([none.runs, none.samePair, none.atPair, none.estimate], [0, false, 0, null]);
  }
});

test('the bounds of the estimate: five runs on the model and at the effort stand alone, and a band takes three', () => {
  assert.equal(RUNS_TO_STAND_ALONE, 5);
  assert.equal(RUNS_FOR_A_BAND, 3);
});

test('a part is estimated at its changed lines times the median input tokens a changed line cost', () => {
  // 100, 200 and 600 input tokens a changed line: the median is 200, whatever the mean.
  const three = inputEstimator([partRun(100, 10000), partRun(100, 20000), partRun(100, 60000)], PAIR);
  assert.equal(three.runs, 3);
  assert.equal(three.estimate(300), 60000);
  // With an even count, the mean of the two in the middle: 100, 200, 300, 600 gives 250.
  const four = inputEstimator([partRun(100, 10000), partRun(100, 20000), partRun(100, 30000), partRun(100, 60000)], PAIR);
  assert.equal(four.estimate(300), 75000);
});

test('an estimate is never under the smallest input total a considered run had', () => {
  // 200 input tokens a changed line, and no run cost under 20,000.
  const one = inputEstimator([partRun(100, 20000), partRun(200, 40000), partRun(300, 60000)], PAIR);
  assert.equal(one.floor, 20000);
  assert.equal(one.estimate(10), 20000);
  assert.equal(one.estimate(0), 20000, 'a part of binary files alone is still a session');
  assert.equal(one.estimate(101), 20200);
});

test('parts up to the bound of a part and parts above it are two bands, each with its own median', () => {
  const runs = [
    // Up to 400 changed lines: 300 input tokens a changed line.
    partRun(100, 30000), partRun(200, 60000), partRun(PART_MAX_CHANGED_LINES, 300 * PART_MAX_CHANGED_LINES),
    // Above: 100.
    partRun(PART_MAX_CHANGED_LINES + 1, 100 * (PART_MAX_CHANGED_LINES + 1)), partRun(1000, 100000), partRun(3000, 300000),
  ];
  const banded = inputEstimator(runs, PAIR);
  assert.deepEqual(banded.perChangedLine, { upToBound: 300, aboveBound: 100 });
  assert.equal(banded.estimate(PART_MAX_CHANGED_LINES), 300 * PART_MAX_CHANGED_LINES, 'a part at the bound is in the lower band');
  assert.equal(banded.estimate(PART_MAX_CHANGED_LINES + 1), 100 * (PART_MAX_CHANGED_LINES + 1));
  assert.equal(banded.estimate(2000), 200000);
});

test('a band with fewer than three runs takes the median of them all', () => {
  // Three small parts at 300 a changed line and two large at 100: the median of the five is 300.
  const runs = [partRun(100, 30000), partRun(200, 60000), partRun(300, 90000), partRun(1000, 100000), partRun(2000, 200000)];
  const thin = inputEstimator(runs, PAIR);
  assert.deepEqual(thin.perChangedLine, { upToBound: 300, aboveBound: 300 });
  assert.equal(thin.estimate(1000), 300000);
  // A third large run makes the band one of its own.
  assert.deepEqual(inputEstimator([...runs, partRun(4000, 400000)], PAIR).perChangedLine, { upToBound: 300, aboveBound: 100 });
});

test('five runs on the model and at the effort of the review stand alone, and the runs at another are left out', () => {
  const same = [100, 100, 100, 100, 100].map((lines) => partRun(lines, lines * 500));
  const other = [100, 100, 100, 100, 100, 100].map((lines) => atMedium(lines, lines * 200));
  const alone = inputEstimator([...other, ...same], PAIR);
  assert.deepEqual([alone.runs, alone.samePair, alone.atPair], [5, true, 5]);
  assert.equal(alone.estimate(200), 100000);
  // Held to both: the model alone is not the pair, and neither is a session that named no effort.
  const astra = same.map((line) => ({ ...line, sessionModel: 'gpt-6-astra' }));
  assert.equal(inputEstimator(astra, PAIR).samePair, false);
  assert.equal(inputEstimator(same.map((line) => ({ ...line, sessionEffort: null })), PAIR).samePair, false);
});

test('with fewer than five such runs every measured part counts, and the estimate says it rests on runs at another effort', () => {
  const same = [100, 100, 100, 100].map((lines) => partRun(lines, lines * 500));
  const other = [100, 100, 100, 100, 100].map((lines) => atMedium(lines, lines * 200));
  const all = inputEstimator([...other, ...same], PAIR);
  assert.deepEqual([all.runs, all.samePair, all.atPair], [9, false, 4]);
  // The median of five at 200 and four at 500 is 200.
  assert.equal(all.estimate(200), 40000);
});

// --- the plan ---

const BASE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
/** A part as `reviewParts` gives it: `count` files that change `changedLines` between them. */
const part = (count, changedLines) => ({ files: Array.from({ length: count }, (_, at) => `f${at}.mjs`), changedLines });
/** A plan of `parts` for the review the command runs, from `runs`. */
const planOf = (parts, runs = [], over = {}) => reviewPlan({ base: BASE, head: HEAD, ...PAIR, parts, runs, ...over });

// Six parts measured on the model and at the effort of the review: 300 input tokens a changed line up to
// the bound of a part, 100 above it, and none under 30,000.
const MEASURED = [partRun(100, 30000), partRun(200, 60000), partRun(300, 90000), partRun(1000, 100000), partRun(2000, 200000), partRun(4000, 400000)];
const METHOD =
  'a part is put at its changed lines times the median input tokens a changed line cost in them, the parts of up to 400 changed lines apart from the larger ones, and never under what the cheapest of them cost.';

test('a run starts six parts without being told to', () => {
  assert.equal(MAX_PARTS_WITHOUT_FLAG, 6);
});

test('the plan names the range, the model, the effort, the parts with their files and lines, and what each is estimated to send', () => {
  const plan = planOf([part(2, 380), part(1, 914)], MEASURED);
  assert.deepEqual(plan, {
    range: 'aaaaaaa..bbbbbbb',
    model: 'gpt-6.1-sol',
    effort: 'high',
    parts: [
      // 380 x 300 is 114,000, and 914 x 100 is 91,400: printed to two figures, so neither reads as a measurement.
      { index: 1, of: 2, files: 2, changedLines: 380, inputTokens: 110000 },
      { index: 2, of: 2, files: 1, changedLines: 914, inputTokens: 91000 },
    ],
    files: 3,
    changedLines: 1294,
    // The sum of what is printed for the parts, so the plan adds up.
    inputTokens: 201000,
    basis: { runs: 6, samePair: true, atPair: 6, bandAt: 400 },
    maxParts: 6,
    maxPartsGiven: false,
    over: false,
  });
  assert.deepEqual(planLines(plan), [
    'Plan of the Codex review of aaaaaaa..bbbbbbb: gpt-6.1-sol at high effort, 2 parts, 1,294 changed lines in 3 files.',
    '  part 1 of 2: 2 files, 380 changed lines, about 110,000 input tokens',
    '  part 2 of 2: 1 file, 914 changed lines, about 91,000 input tokens',
    `Estimate: about 201,000 input tokens in all. It rests on 6 parts this machine's run log measured on gpt-6.1-sol at high effort: ${METHOD}`,
  ]);
});

test('an estimate is printed to two figures, whatever its size, and a small part is put at what the cheapest run cost', () => {
  const plan = planOf([part(1, 1), part(1, 3228), part(3, 399)], [...MEASURED, partRun(10, 1234)]);
  // The floor, 1,234; 3,228 x 100; 399 x 300 is 119,700.
  assert.deepEqual(plan.parts.map((one) => one.inputTokens), [1200, 320000, 120000]);
  assert.equal(plan.inputTokens, 441200);
});

test('with no measured part the plan says there is no estimate and why, and puts no number on a part', () => {
  const plan = planOf([part(2, 6), part(1, 2)]);
  assert.deepEqual(plan.parts.map((one) => one.inputTokens), [null, null]);
  assert.equal(plan.inputTokens, null);
  assert.deepEqual(plan.basis, { runs: 0, samePair: false, atPair: 0, bandAt: 400 });
  assert.deepEqual(planLines(plan), [
    'Plan of the Codex review of aaaaaaa..bbbbbbb: gpt-6.1-sol at high effort, 2 parts, 8 changed lines in 3 files.',
    '  part 1 of 2: 2 files, 6 changed lines',
    '  part 2 of 2: 1 file, 2 changed lines',
    'No estimate: the run log of this machine holds no part whose changed lines and input tokens were measured, and an estimate is never a guess.',
  ]);
});

test('an estimate from runs at another effort says so, with how many parts it rests on and how many ran as the review will', () => {
  const runs = [atMedium(100, 30000), atMedium(200, 60000), atMedium(300, 90000), partRun(100, 30000)];
  const plan = planOf([part(1, 200)], runs);
  assert.deepEqual(plan.basis, { runs: 4, samePair: false, atPair: 1, bandAt: 400 });
  assert.deepEqual(planLines(plan), [
    'Plan of the Codex review of aaaaaaa..bbbbbbb: gpt-6.1-sol at high effort, 1 part, 200 changed lines in 1 file.',
    '  part 1 of 1: 1 file, 200 changed lines, about 60,000 input tokens',
    'Estimate: about 60,000 input tokens in all. It rests on 4 parts this machine\'s run log measured, at another effort or in a session that named none ' +
      `(1 of them ran on gpt-6.1-sol at high effort, and from 5 on it rests on those alone): ${METHOD}`,
  ]);
  // One measured part is said as one.
  assert.match(planLines(planOf([part(1, 200)], [atMedium(100, 30000)])).at(-1), /It rests on 1 part this machine's run log measured, at another effort/);
});

test('the plan is of the review the command runs: it names the model and the effort it is handed, and the estimate is held to them', () => {
  const runs = [100, 100, 100, 100, 100].map((lines) => atMedium(lines, lines * 200));
  const plan = planOf([part(1, 100)], runs, { effort: 'medium' });
  assert.equal(planLines(plan)[0], 'Plan of the Codex review of aaaaaaa..bbbbbbb: gpt-6.1-sol at medium effort, 1 part, 100 changed lines in 1 file.');
  assert.deepEqual(plan.basis, { runs: 5, samePair: true, atPair: 5, bandAt: 400 });
});

test('a range that changes nothing is a plan of no part, which still names the model and the effort', () => {
  for (const runs of [[], MEASURED]) {
    const plan = planOf([], runs);
    assert.deepEqual([plan.parts, plan.files, plan.changedLines, plan.inputTokens, plan.over], [[], 0, 0, null, false]);
    assert.deepEqual(planLines(plan), [
      'Plan of the Codex review of aaaaaaa..bbbbbbb: gpt-6.1-sol at high effort, 0 parts, 0 changed lines in 0 files.',
      'No estimate: the range changes no file, so there is no part to review.',
    ]);
  }
});

test('a plan of more parts than a run starts is over the bound, and says which flag the run would need', () => {
  const parts = (count) => Array.from({ length: count }, () => part(1, 400));
  const atBound = planOf(parts(6));
  assert.deepEqual([atBound.over, needsFlagLine(atBound)], [false, null]);
  const over = planOf(parts(7));
  assert.deepEqual([over.over, over.maxParts, over.maxPartsGiven], [true, 6, false]);
  assert.equal(needsFlagLine(over), 'This is more parts than the 6 a run starts without `--max-parts`: the run would need `--max-parts 7`.');
  // `maxParts` is the bound of the run that named one, above or under the one of a run that named none.
  const allowed = planOf(parts(7), [], { maxParts: 7 });
  assert.deepEqual([allowed.over, allowed.maxParts, allowed.maxPartsGiven, needsFlagLine(allowed)], [false, 7, true, null]);
  const under = planOf(parts(4), [], { maxParts: 3 });
  assert.equal(under.over, true);
  assert.equal(needsFlagLine(under), 'This is more parts than `--max-parts 3` allows: the run would need `--max-parts 4`.');
  // The lines of the plan are the same on either side of the bound: what is said of it is a line of its own.
  assert.equal(planLines(over).some((line) => line.includes('--max-parts')), false);
});

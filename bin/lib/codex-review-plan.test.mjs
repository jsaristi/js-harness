import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ruleValue } from './rules.mjs';
import { inputEstimator, MAX_PARTS_WITHOUT_FLAG, measuredParts, needsFlagLine, planLines, reviewPlan, RECENT_PARTS, RUNS_TO_STAND_ALONE } from './codex-review-plan.mjs';

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

test('the bounds of the estimate: five runs on the model and at the effort stand alone, and the fit reads the most recent twenty', () => {
  assert.equal(RUNS_TO_STAND_ALONE, 5);
  assert.equal(RECENT_PARTS, 20);
});

/** Parts on the line of `fixed` input tokens a part and `perLine` a changed line, one for each of `lines`. */
const onLine = (fixed, perLine, lines, run = partRun) => lines.map((changed) => run(changed, fixed + perLine * changed));

test('a part is estimated at a fixed cost and a cost a changed line, fitted by least squares to the measured parts', () => {
  const fit = inputEstimator(onLine(10000, 100, [100, 200, 300]), PAIR);
  assert.equal(fit.runs, 3);
  assert.deepEqual([fit.fixed, fit.perChangedLine], [10000, 100]);
  assert.equal(fit.estimate(500), 60000);
  assert.equal(fit.estimate(0), 10000, 'a part of binary files alone still costs its fixed cost');
});

test('the fit reads the most recent twenty measured parts, so an older way of reviewing does not pull it', () => {
  const older = onLine(1000, 10, [100, 200, 300, 400, 500]);
  const recent = onLine(10000, 100, Array.from({ length: RECENT_PARTS }, (_, at) => 50 * (at + 1)));
  const fit = inputEstimator([...older, ...recent], PAIR);
  assert.equal(fit.runs, RECENT_PARTS);
  assert.deepEqual([fit.fixed, fit.perChangedLine], [10000, 100]);
  // Every part it reads ran as the review will, so the plan says nothing of another effort.
  assert.deepEqual([fit.samePair, fit.atPair], [true, RECENT_PARTS]);
  assert.doesNotMatch(planLines(reviewPlan({ base: 'a'.repeat(40), head: 'b'.repeat(40), ...PAIR, parts: [{ files: ['x.mjs'], changedLines: 10 }], runs: [...older, ...recent] })).at(-1), /another effort/);
});

test('parts whose changed lines do not vary, or a single part, put every part at the median part', () => {
  const same = inputEstimator([partRun(100, 10000), partRun(100, 20000), partRun(100, 60000)], PAIR);
  assert.deepEqual([same.fixed, same.perChangedLine, same.estimate(300)], [20000, 0, 20000]);
  const one = inputEstimator([partRun(100, 30000)], PAIR);
  assert.deepEqual([one.fixed, one.perChangedLine, one.estimate(200)], [30000, 0, 30000]);
});

test('a fit whose cost a changed line falls is the median part, and one whose fixed cost is under nothing starts at nothing', () => {
  const falling = inputEstimator([partRun(100, 50000), partRun(200, 30000), partRun(300, 10000)], PAIR);
  assert.deepEqual([falling.fixed, falling.perChangedLine], [30000, 0]);
  // 1,000, 50,000 and 99,000: 490 a changed line from -48,000, which is no cost.
  const steep = inputEstimator([partRun(100, 1000), partRun(200, 50000), partRun(300, 99000)], PAIR);
  assert.deepEqual([steep.fixed, steep.perChangedLine], [0, 490]);
  assert.equal(steep.estimate(100), 49000);
});

test('five runs on the model and at the effort of the review stand alone, and the runs at another are left out', () => {
  const same = onLine(10000, 100, [100, 200, 300, 400, 500]);
  const other = onLine(1000, 10, [100, 200, 300, 400, 500, 600], atMedium);
  const alone = inputEstimator([...other, ...same], PAIR);
  assert.deepEqual([alone.runs, alone.samePair, alone.atPair], [5, true, 5]);
  assert.equal(alone.estimate(200), 30000);
  // Held to both: the model alone is not the pair, and neither is a session that named no effort.
  const astra = same.map((line) => ({ ...line, sessionModel: 'gpt-6-astra' }));
  assert.equal(inputEstimator(astra, PAIR).samePair, false);
  assert.equal(inputEstimator(same.map((line) => ({ ...line, sessionEffort: null })), PAIR).samePair, false);
});

test('with fewer than five such runs every measured part counts, and the estimate says it rests on runs at another effort', () => {
  const same = onLine(0, 300, [100, 200, 300, 400]);
  const other = onLine(0, 300, [100, 200, 300, 400, 500], atMedium);
  const all = inputEstimator([...other, ...same], PAIR);
  assert.deepEqual([all.runs, all.samePair, all.atPair], [9, false, 4]);
  assert.equal(all.estimate(200), 60000);
});

// Points that pair off around the line of 10,000 a part and 100 a changed line, so the fit is still that line,
// while what they cost over it spreads: 0.25, 0.5, six at 1, then 1.5 and 1.75. The 90th percentile is 1.5.
const SPREAD = [
  partRun(100, 35000), partRun(100, 5000), partRun(200, 45000), partRun(200, 15000),
  ...onLine(10000, 100, [300, 300, 1000, 1000, 2000, 2000]),
];

test('the high figure of a part is its estimate times the 90th percentile of what the parts cost over the fit, and never under the estimate', () => {
  const spread = inputEstimator(SPREAD, PAIR);
  assert.deepEqual([spread.fixed, spread.perChangedLine, spread.highRatio], [10000, 100, 1.5]);
  assert.equal(spread.high(500), 90000);
  for (const lines of [0, 1, 40, 400, 401, 5000]) assert.ok(spread.high(lines) >= spread.estimate(lines), `${lines} changed lines`);
  // Parts on the line cost what it says, so the two figures are one.
  const exact = inputEstimator(onLine(10000, 100, [100, 200, 300]), PAIR);
  assert.deepEqual([exact.highRatio, exact.estimate(200), exact.high(200)], [1, 30000, 30000]);
  // And with no measured part there is no high figure either.
  assert.equal(inputEstimator([], PAIR).high, null);
});

// --- the plan ---

const BASE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
/** A part as `reviewParts` gives it: `count` files that change `changedLines` between them. */
const part = (count, changedLines) => ({ files: Array.from({ length: count }, (_, at) => `f${at}.mjs`), changedLines });
/** A plan of `parts` for the review the command runs, from `runs`. */
const planOf = (parts, runs = [], over = {}) => reviewPlan({ base: BASE, head: HEAD, ...PAIR, parts, runs, ...over });

// Six parts measured on the model and at the effort of the review, on the line of 10,000 input tokens a part
// and 100 a changed line.
const MEASURED = onLine(10000, 100, [100, 200, 300, 1000, 2000, 4000]);
/** What the estimate line says of how a part is put, for a fit of `fixed` a part and `perLine` a changed line. */
const method = (fixed, perLine) =>
  `a part is put at about ${fixed} input tokens and about ${perLine} more a changed line, a fit by least squares to the most recent ${RECENT_PARTS} of them at most.`;
const METHOD = method('10,000', '100');

test('a run starts the declared count of parts without being told to', () => {
  assert.equal(MAX_PARTS_WITHOUT_FLAG, ruleValue('review-parts-unflagged', 'parts'));
  assert.ok(Number.isInteger(MAX_PARTS_WITHOUT_FLAG) && MAX_PARTS_WITHOUT_FLAG > 0);
});

test('the plan names the range, the model, the effort, the parts with their files and lines, and what each is estimated to send', () => {
  const plan = planOf([part(2, 380), part(1, 914)], MEASURED);
  assert.deepEqual(plan, {
    range: 'aaaaaaa..bbbbbbb',
    model: 'gpt-6.1-sol',
    effort: 'high',
    parts: [
      // 10,000 + 380 x 100 is 48,000, and 10,000 + 914 x 100 is 101,400: printed to two figures, so neither
      // reads as a measurement.
      { index: 1, of: 2, files: 2, changedLines: 380, inputTokens: 48000 },
      { index: 2, of: 2, files: 1, changedLines: 914, inputTokens: 100000 },
    ],
    files: 3,
    changedLines: 1294,
    // The sum of what is printed for the parts, so the plan adds up.
    inputTokens: 148000,
    // Every measured part cost what the fit says, so the high figure is the same figure.
    inputTokensHigh: 148000,
    basis: { runs: 6, samePair: true, atPair: 6, fixed: 10000, perChangedLine: 100, highRatio: 1 },
    maxParts: 6,
    maxPartsGiven: false,
    over: false,
    leftOut: null,
  });
  assert.deepEqual(planLines(plan), [
    'Plan of the Codex review of aaaaaaa..bbbbbbb: gpt-6.1-sol at high effort, 2 parts, 1,294 changed lines in 3 files.',
    '  part 1 of 2: 2 files, 380 changed lines, about 48,000 input tokens',
    '  part 2 of 2: 1 file, 914 changed lines, about 100,000 input tokens',
    `Estimate: about 148,000 input tokens in all. It rests on 6 parts this machine's run log measured on gpt-6.1-sol at high effort: ${METHOD}`,
  ]);
});

const RANGE =
  ' The higher figure puts every part at that times 1.5, the 90th percentile of what those parts cost over the fit: about one review in ten has cost more, and it is no ceiling.';

test('the estimate of the whole is a range when the measured parts did not cost what the fit says: from the fit to its 90th percentile', () => {
  const plan = planOf([part(2, 380), part(1, 914)], SPREAD);
  // Each part keeps one figure, the one from the fit; the range is of the whole.
  assert.deepEqual(plan.parts.map((one) => Object.keys(one)), [['index', 'of', 'files', 'changedLines', 'inputTokens'], ['index', 'of', 'files', 'changedLines', 'inputTokens']]);
  assert.deepEqual(plan.parts.map((one) => one.inputTokens), [48000, 100000]);
  // 48,000 x 1.5 is 72,000 and 101,400 x 1.5 is 152,100: each to two figures, as the figures of the parts are, and added up.
  assert.deepEqual([plan.inputTokens, plan.inputTokensHigh], [148000, 222000]);
  assert.deepEqual(planLines(plan), [
    'Plan of the Codex review of aaaaaaa..bbbbbbb: gpt-6.1-sol at high effort, 2 parts, 1,294 changed lines in 3 files.',
    '  part 1 of 2: 2 files, 380 changed lines, about 48,000 input tokens',
    '  part 2 of 2: 1 file, 914 changed lines, about 100,000 input tokens',
    `Estimate: about 148,000 to 222,000 input tokens in all. It rests on 10 parts this machine's run log measured on gpt-6.1-sol at high effort: ${METHOD}${RANGE}`,
  ]);
  // The high figure is never the smaller of the two, whatever the rounding of each part does.
  for (const lines of [1, 37, 115, 383, 400, 401, 955, 3228]) {
    const one = planOf([part(1, lines), part(1, lines + 1)], SPREAD);
    assert.ok(one.inputTokensHigh >= one.inputTokens, `${lines} changed lines`);
  }
});

test('one figure is said as one: with a single measured part, or parts that all cost what the fit says, there is no range to speak of', () => {
  for (const runs of [[partRun(100, 30000)], MEASURED]) {
    const plan = planOf([part(1, 200)], runs);
    assert.deepEqual([plan.inputTokens, plan.inputTokensHigh], [30000, 30000]);
    assert.match(planLines(plan).at(-1), /^Estimate: about 30,000 input tokens in all\. /);
    assert.doesNotMatch(planLines(plan).at(-1), /higher figure|about [\d,]+ to /);
  }
  // And where there is no estimate there is no high figure.
  assert.equal(planOf([part(1, 200)]).inputTokensHigh, null);
  assert.equal(planOf([], SPREAD).inputTokensHigh, null);
});

test('an estimate is printed to two figures, whatever its size, and a small part costs at least the fixed cost', () => {
  const plan = planOf([part(1, 1), part(1, 3228), part(3, 399)], MEASURED);
  // 10,100; 332,800; 49,900.
  assert.deepEqual(plan.parts.map((one) => one.inputTokens), [10000, 330000, 50000]);
  assert.equal(plan.inputTokens, 390000);
});

test('with no measured part the plan says there is no estimate and why, and puts no number on a part', () => {
  const plan = planOf([part(2, 6), part(1, 2)]);
  assert.deepEqual(plan.parts.map((one) => one.inputTokens), [null, null]);
  assert.equal(plan.inputTokens, null);
  assert.deepEqual(plan.basis, { runs: 0, samePair: false, atPair: 0, fixed: null, perChangedLine: null, highRatio: null });
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
  assert.deepEqual(plan.basis, { runs: 4, samePair: false, atPair: 1, fixed: 0, perChangedLine: 300, highRatio: 1 });
  assert.deepEqual(planLines(plan), [
    'Plan of the Codex review of aaaaaaa..bbbbbbb: gpt-6.1-sol at high effort, 1 part, 200 changed lines in 1 file.',
    '  part 1 of 1: 1 file, 200 changed lines, about 60,000 input tokens',
    'Estimate: about 60,000 input tokens in all. It rests on 4 parts this machine\'s run log measured, 1 of them on gpt-6.1-sol at high effort and the rest at another effort or in a session that named none ' +
      `(with 5 or more of the first kind it would rest on those alone): ${method('0', '300')}`,
  ]);
  // One measured part is said as one, and none on the model and at the effort of the review as none.
  assert.match(planLines(planOf([part(1, 200)], [atMedium(100, 30000)])).at(-1), /It rests on 1 part this machine's run log measured, 0 of them on gpt-6\.1-sol at high effort and the rest at another effort/);
  // A session whose rollout file named no model is one of the rest.
  const unnamed = partRun(100, 30000, { sessionModel: null, sessionEffort: null });
  assert.match(planLines(planOf([part(1, 200)], [partRun(100, 30000), unnamed])).at(-1), /It rests on 2 parts this machine's run log measured, 1 of them on gpt-6\.1-sol at high effort and the rest at another effort or in a session that named none /);
});

test('an estimate from fewer than five parts, all of them on the model and at the effort of the review, says nothing of another effort', () => {
  for (const [runs, rests, sends] of [
    [[partRun(100, 30000)], '1 part', '30,000'],
    [[partRun(100, 30000), partRun(200, 60000)], '2 parts', '60,000'],
    [[partRun(100, 30000), partRun(200, 60000), partRun(300, 90000), partRun(100, 30000)], '4 parts', '60,000'],
  ]) {
    const plan = planOf([part(1, 200)], runs);
    assert.equal(plan.basis.runs, runs.length, rests);
    assert.deepEqual([plan.basis.samePair, plan.basis.atPair], [false, runs.length], rests);
    assert.match(planLines(plan).at(-1), new RegExp(`^Estimate: about ${sends} input tokens in all\\. It rests on ${rests} this machine's run log measured on gpt-6\\.1-sol at high effort: a part is put at about `), rests);
    assert.doesNotMatch(planLines(plan).at(-1), /another effort|named none/, rests);
  }
});

test('the plan is of the review the command runs: it names the model and the effort it is handed, and the estimate is held to them', () => {
  const runs = onLine(0, 200, [100, 200, 300, 400, 500], atMedium);
  const plan = planOf([part(1, 100)], runs, { effort: 'medium' });
  assert.equal(planLines(plan)[0], 'Plan of the Codex review of aaaaaaa..bbbbbbb: gpt-6.1-sol at medium effort, 1 part, 100 changed lines in 1 file.');
  assert.deepEqual([plan.basis.runs, plan.basis.samePair, plan.basis.atPair], [5, true, 5]);
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

// --- what a review leaves out ---

/** The count of what a range leaves out, as `reviewScope` gives it: `documents` and `marked`, each `[files, changedLines]`. */
const leftOut = (documents, marked) => ({
  files: documents[0] + marked[0],
  changedLines: documents[1] + marked[1],
  documents: { files: documents[0], changedLines: documents[1] },
  marked: { files: marked[0], changedLines: marked[1] },
});

test('a plan says what the review leaves out, how much of it and why, in a line of its own between its parts and its estimate', () => {
  const plan = planOf([part(2, 380), part(1, 914)], MEASURED, { leftOut: leftOut([3, 1300], [2, 120]) });
  assert.deepEqual(plan.leftOut, leftOut([3, 1300], [2, 120]));
  // The parts, their sizes and the estimate are of what the review reads, as they were.
  assert.deepEqual([plan.files, plan.changedLines, plan.inputTokens], [3, 1294, 148000]);
  assert.deepEqual(planLines(plan), [
    'Plan of the Codex review of aaaaaaa..bbbbbbb: gpt-6.1-sol at high effort, 2 parts, 1,294 changed lines in 3 files.',
    '  part 1 of 2: 2 files, 380 changed lines, about 48,000 input tokens',
    '  part 2 of 2: 1 file, 914 changed lines, about 100,000 input tokens',
    'Left out of the review: 5 files, 1,420 changed lines (3 Markdown documents, 1,300 changed lines; 2 files the project marks `-codex-review`, 120 changed lines).',
    `Estimate: about 148,000 input tokens in all. It rests on 6 parts this machine's run log measured on gpt-6.1-sol at high effort: ${METHOD}`,
  ]);
  assert.equal(planLines(planOf([part(1, 10)], [], { leftOut: leftOut([1, 1], [0, 0]) }))[2], 'Left out of the review: 1 Markdown document, 1 changed line.');
});

test('a plan that leaves nothing out says nothing of it, whether it was handed no count or a count of none', () => {
  const none = planOf([part(2, 6), part(1, 2)]);
  const counted = planOf([part(2, 6), part(1, 2)], [], { leftOut: leftOut([0, 0], [0, 0]) });
  assert.deepEqual([none.leftOut, counted.leftOut], [null, null]);
  assert.deepEqual(planLines(counted), planLines(none));
  assert.equal(planLines(none).some((line) => /left out/i.test(line)), false);
});

test('a range whose files are all left out is a plan of no part that says so, and not that the range changes no file', () => {
  for (const runs of [[], MEASURED]) {
    const plan = planOf([], runs, { leftOut: leftOut([2, 40], [0, 0]) });
    assert.deepEqual([plan.parts, plan.files, plan.changedLines, plan.inputTokens, plan.over], [[], 0, 0, null, false]);
    assert.deepEqual(planLines(plan), [
      'Plan of the Codex review of aaaaaaa..bbbbbbb: gpt-6.1-sol at high effort, 0 parts, 0 changed lines in 0 files.',
      'Left out of the review: 2 Markdown documents, 40 changed lines.',
      'No estimate: every file the range changes is left out of the review, so there is no part to review.',
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

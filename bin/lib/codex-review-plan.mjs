// The plan of a Codex review: what a run would start, and what it is expected to spend, said before it is
// spent. Zero deps, no fs, no git: every function takes the parts of the range and the lines of the run log
// as values, so the tests use inline ones.
//
// Why a plan. One run, the review of a whole branch, was 28 sessions and 3.36 million input tokens, started
// without anyone having seen either number, on an estimate made by hand that came out 24% under
// (odd/tasks/codex-review-cost.md). So `js-harness codex-review --plan` prints the plan and starts nothing,
// a real run prints the same plan before its first session, and a run of more parts than
// `MAX_PARTS_WITHOUT_FLAG` is refused until it is asked for by its count.
//
// Where the estimate comes from. From this machine's own run log and nowhere else: no number of tokens is
// written in this file. A run line of a part holds how many lines the part changed and how many input
// tokens its session spent (`./codex-review-runs.mjs`), and the estimate of a part is a fixed cost plus a
// cost a changed line, fitted by least squares to the most recent `RECENT_PARTS` parts measured before. A
// part has a fixed cost: about three quarters of what it spends is cached context sent again with each of its
// requests, whatever its size, and fitted on this machine's log a part cost about 190,000 input tokens at
// `high` effort and about 122,000 at `medium` before its first changed line. The median a changed line this
// replaced had no fixed cost, so a small part came out far too low: replayed on the log before each of 101
// reviews, the last 20 cost a median 2.48 times what it planned, and the fit 0.94 times
// (odd/tasks/read-from-records.md). With no measured part there is no estimate, and the plan says so.
//
// Why the estimate of the whole is a range. What a part costs depends less on its size than on how far its
// session looks into the code, so the plan gives two figures of the whole: the one its parts add up to, each
// at the fit, and a high one, each part at the fit times the 90th percentile of what the measured parts cost
// over it. Replayed on the same 101 reviews, 12 went over that high figure, about one in ten as it says, and
// it stood a median 1.8 times over what they cost, where the most a changed line, which it replaced, stood
// 3.2 times over. It is no ceiling. A part keeps one figure.
//
// It estimates input tokens alone, the cached ones included, which is what `usage.inputTokens` counts: the
// number the cost of the reviews was counted in when this was asked for. What a review writes is not estimated.
//
// What is left out. A review reads code, and leaves out the documents and what the project marks
// (`./codex-review-scope.mjs`). The parts of a plan, their sizes and its estimate are of what the review
// reads; what it leaves out is said in a line of its own, with how much it is and why, so that a run never
// passes over a file without having said so.
import { runPart, runSession, runSessionModel } from './codex-review-runs.mjs';
import { leftOutSaid } from './codex-review-scope.mjs';
import { ruleValue } from './rules.mjs';

// How many parts a run starts without being told to; `--max-parts <n>` names another count (T3 of
// odd/tasks/codex-review-cost.md). At the 400 changed lines of a part, six parts are a range of up to about
// 2,400, which a slice reviewed when it closes stays under: a run over it is most often a branch that was
// not reviewed slice by slice, and the run this bound exists for was 28 parts. The count is the declared
// rule's (`review-parts-unflagged` in ./rules-data.mjs); the figures above are of the day it was set.
export const MAX_PARTS_WITHOUT_FLAG = ruleValue('review-parts-unflagged', 'parts');

// How many measured parts on the model and at the effort of the review it takes for the estimate to rest
// on those alone. Under it every measured part counts, at whatever effort, and the plan says so: an
// estimate from runs at another effort is worth more than none, and less than it looks.
export const RUNS_TO_STAND_ALONE = 5;

// How many measured parts the fit reads, the most recent ones: replayed on this machine's log before each of
// 101 reviews, a fit on the last 20 of the pair erred least (a median absolute log error of 0.27, against
// 0.45 for the median a changed line it replaced), since it follows a change of prompt or effort without
// having to know which fields mark one (odd/tasks/read-from-records.md, reader A).
export const RECENT_PARTS = 20;
// The share of the parts a high figure is to stand over: the 90th percentile of what they cost over the fit.
const HIGH_PERCENTILE = 0.9;

/** The parts the run log measured, of `runs` (the lines of the log, as `readCodexReviewRuns` gives them):
 * each `{ changedLines, inputTokens, model, effort }`, the last two what the session itself said it ran on,
 * `null` where its rollout file named none.
 *
 * A line counts when it can say what a changed line cost: it is the line of a part (the line of a range
 * reviewed whole holds no count of changed lines), the part changed at least one line, its tokens were read
 * from the rollout files of its session (`usageSource`: a line without it holds the zeros of Codex's
 * events), and the attempt stood. One that failed, was stopped or did not read its whole diff spent what a
 * review of that part does not. */
export function measuredParts(runs) {
  const measured = [];
  for (const run of runs) {
    const part = runPart(run);
    if (part === null || part.changedLines === 0) continue;
    if (run.outcome !== 'reviewed' || runSession(run) !== 'lean' || run.usageSource !== 'rollout') continue;
    const inputTokens = run.usage?.inputTokens;
    if (!Number.isInteger(inputTokens) || inputTokens <= 0) continue;
    const ran = runSessionModel(run);
    measured.push({ changedLines: part.changedLines, inputTokens, model: ran?.model ?? null, effort: ran?.effort ?? null });
  }
  return measured;
}

/** The median of `values`, a list of numbers that is not empty: the one in the middle, or the mean of the
 * two in the middle. */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** How the input tokens of a part are estimated from `runs`, the lines of the run log, for a review on
 * `model` at `effort`:
 *
 *  - `runs`, how many measured parts the estimate rests on (`measuredParts`), the most recent
 *    `RECENT_PARTS` at most; 0 when there is none, and then `estimate` is `null`: there is no estimate, and
 *    no number stands in for one.
 *  - `atPair`, how many of the measured parts ran on that model at that effort, as their own sessions said;
 *    `samePair`, whether the estimate rests on those alone, which it does from `RUNS_TO_STAND_ALONE` of
 *    them on. Otherwise it rests on every measured part, at whatever effort.
 *  - `fixed` and `perChangedLine`, what a part costs before its first changed line and for each one, by
 *    least squares over those parts (`fitted`).
 *  - `estimate(changedLines)`, the input tokens of a part of that many changed lines: `fixed` plus the
 *    lines times `perChangedLine`. Not rounded: `reviewPlan` rounds what is printed.
 *  - `highRatio`, the 90th percentile of what those parts cost over their estimate, never under 1; and
 *    `high(changedLines)`, the estimate times it, so never under `estimate`. `null` with no measured part.
 *    It is the other end of the range a plan gives of the whole (see the top of this file). */
export function inputEstimator(runs, { model, effort }) {
  const measured = measuredParts(runs);
  const same = measured.filter((one) => one.model === model && one.effort === effort);
  const samePair = same.length >= RUNS_TO_STAND_ALONE;
  const basis = (samePair ? same : measured).slice(-RECENT_PARTS);
  if (basis.length === 0) return { runs: 0, samePair: false, atPair: 0, fixed: null, perChangedLine: null, highRatio: null, estimate: null, high: null };
  // How many of the parts the fit reads ran on that model at that effort: all of them when the pair stands
  // alone, since the plan says of the parts it rests on how many ran as the review will.
  const atPair = basis.filter((one) => one.model === model && one.effort === effort).length;
  const { fixed, perChangedLine } = fitted(basis);
  const estimate = (changedLines) => fixed + perChangedLine * changedLines;
  // What each part cost over what the fit says it should; a fit of nothing a part is a part of no cost, read
  // as costing what it says.
  const ratios = basis.map((one) => {
    const expected = estimate(one.changedLines);
    return expected > 0 ? one.inputTokens / expected : 1;
  });
  const highRatio = Math.max(1, percentile(ratios, HIGH_PERCENTILE));
  return { runs: basis.length, samePair, atPair, fixed, perChangedLine, highRatio, estimate, high: (changedLines) => estimate(changedLines) * highRatio };
}

/** The fixed cost of a part and its cost a changed line, by least squares over `parts`. Parts whose changed
 * lines do not vary, a single part among them, and a fit whose cost a line falls, all put every part at the
 * median part with no cost a line; a fit whose fixed cost is under nothing starts at nothing. */
function fitted(parts) {
  const middle = { fixed: median(parts.map((one) => one.inputTokens)), perChangedLine: 0 };
  const count = parts.length;
  const meanLines = parts.reduce((sum, one) => sum + one.changedLines, 0) / count;
  const meanTokens = parts.reduce((sum, one) => sum + one.inputTokens, 0) / count;
  let sxx = 0;
  let sxy = 0;
  for (const one of parts) {
    sxx += (one.changedLines - meanLines) ** 2;
    sxy += (one.changedLines - meanLines) * (one.inputTokens - meanTokens);
  }
  if (count < 2 || sxx === 0) return middle;
  const perChangedLine = sxy / sxx;
  if (perChangedLine < 0) return middle;
  return { fixed: Math.max(0, meanTokens - perChangedLine * meanLines), perChangedLine };
}

/** The `share` percentile of `values` (a list of numbers that is not empty), by nearest rank. */
function percentile(values, share) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(share * sorted.length) - 1)];
}

/** An estimate as it is printed: to two figures. One printed to the token reads as a measurement. */
function twoFigures(tokens) {
  if (tokens <= 0) return 0;
  const unit = Math.max(1, 10 ** (Math.floor(Math.log10(tokens)) - 1));
  return Math.round(tokens / unit) * unit;
}

/** The plan of the review of `base..head` (full commit ids) on `model` at `effort`: what a run would start,
 * and what it is estimated to send. `parts` are the parts of the range as `reviewParts` gives them, each
 * `{ files, changedLines }`, none for a range that changes no file a review reads; `runs` the lines of this
 * machine's run log, which the estimate is made from (`inputEstimator`); `maxParts` how many parts the run
 * may start, `MAX_PARTS_WITHOUT_FLAG` unless the run named a count; `leftOut` the count of the files the
 * review leaves out, as `reviewScope` gives it, which are in none of the parts.
 *
 * It is data, and `planLines` says it: the `range` by short ids, the `model` and the `effort`, each part
 * with its `index` of `of`, how many `files` and `changedLines` it has and its `inputTokens`, the totals of
 * the three, the `basis` of the estimate (how many `runs`, whether they are on the same model and effort
 * alone, `samePair`, how many are, `atPair`, and the fit, `fixed`, `perChangedLine` and `highRatio`), and whether the plan is
 * `over` the bound of parts. `inputTokens` is `null`, of each part and of the whole, when there is no
 * estimate; otherwise each is to two figures, and that of the whole is the sum of those of the parts.
 * `inputTokensHigh` is the high figure of the whole, `null` with it: the sum of the high figures of the
 * parts (`inputEstimator`), each to two figures as well, so it is never the smaller of the two, and is the
 * same number when every measured part cost a changed line alike. Each part holds its own `inputTokensHigh`
 * as well, which its run line records (`partPlanned`); the lines print the range of the whole alone. `leftOut` is the count it was handed, or `null` when no file is left out. */
export function reviewPlan({ base, head, model, effort, parts, runs = [], maxParts, leftOut = null }) {
  const { runs: measured, samePair, atPair, fixed, perChangedLine, highRatio, estimate, high } = inputEstimator(runs, { model, effort });
  const planned = parts.map((part, at) => ({
    index: at + 1,
    of: parts.length,
    files: part.files.length,
    changedLines: part.changedLines,
    inputTokens: estimate === null ? null : twoFigures(estimate(part.changedLines)),
    inputTokensHigh: estimate === null ? null : twoFigures(high(part.changedLines)),
  }));
  const total = (pick) => planned.reduce((sum, part) => sum + pick(part), 0);
  const bound = maxParts ?? MAX_PARTS_WITHOUT_FLAG;
  const estimated = estimate !== null && planned.length > 0;
  return {
    range: `${base.slice(0, 7)}..${head.slice(0, 7)}`,
    model,
    effort,
    parts: planned,
    files: total((part) => part.files),
    changedLines: total((part) => part.changedLines),
    inputTokens: estimated ? total((part) => part.inputTokens) : null,
    inputTokensHigh: estimated ? total((part) => part.inputTokensHigh) : null,
    // The fit as it is said: the fixed cost to the token, the rest to two decimals, so that the float of a
    // least-squares fit does not show as a measurement.
    basis: {
      runs: measured,
      samePair,
      atPair,
      fixed: fixed === null ? null : Math.round(fixed),
      perChangedLine: perChangedLine === null ? null : Math.round(perChangedLine * 100) / 100,
      highRatio: highRatio === null ? null : Math.round(highRatio * 100) / 100,
    },
    maxParts: bound,
    maxPartsGiven: maxParts !== undefined,
    over: planned.length > bound,
    leftOut: leftOut !== null && leftOut.files > 0 ? leftOut : null,
  };
}

const thousands = (count) => String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** `count` things, with `noun` in the singular for one: `1 part`, `2 parts`. */
const counted = (count, noun) => `${thousands(count)} ${noun}${count === 1 ? '' : 's'}`;

/** What the estimate of `plan` is and what it rests on, as one line; or that there is none, and why.
 *
 * It says how many parts the estimate rests on and how many of them ran on the model and at the effort of
 * the review. When all of them did, that is all there is to say, whether they are the five that stand alone
 * or fewer: another effort is spoken of only when some part ran at one, or named none.
 *
 * The estimate of the whole is a range, from the figure the parts add up to, to the high one, and a last
 * sentence says what the high one is. One figure is said as one: where the two are the same number there is
 * no range, and nothing is said of one. */
function estimateLine({ parts, inputTokens, inputTokensHigh, model, effort, basis, leftOut }) {
  if (parts.length === 0) {
    return leftOut === null
      ? 'No estimate: the range changes no file, so there is no part to review.'
      : 'No estimate: every file the range changes is left out of the review, so there is no part to review.';
  }
  if (inputTokens === null) return 'No estimate: the run log of this machine holds no part whose changed lines and input tokens were measured, and an estimate is never a guess.';
  const pair = `on ${model} at ${effort} effort`;
  const rests = basis.atPair === basis.runs
    ? `${counted(basis.runs, 'part')} this machine's run log measured ${pair}`
    : `${counted(basis.runs, 'part')} this machine's run log measured, ${thousands(basis.atPair)} of them ${pair} and the rest at another effort or in a session that named none ` +
      `(with ${RUNS_TO_STAND_ALONE} or more of the first kind it would rest on those alone)`;
  const ranged = inputTokensHigh > inputTokens;
  return (
    `Estimate: about ${thousands(inputTokens)}${ranged ? ` to ${thousands(inputTokensHigh)}` : ''} input tokens in all. ` +
    `It rests on ${rests}: a part is put at about ${thousands(twoFigures(basis.fixed))} input tokens and about ${thousands(Math.round(basis.perChangedLine))} more a changed line, ` +
    `a fit by least squares to the most recent ${RECENT_PARTS} of them at most.` +
    (ranged
      ? ` The higher figure puts every part at that times ${Math.round(basis.highRatio * 100) / 100}, the ${Math.round(HIGH_PERCENTILE * 100)}th percentile of what those parts cost over the fit: ` +
        'about one review in ten has cost more, and it is no ceiling.'
      : '')
  );
}

/** A plan (`reviewPlan`) as the lines a person reads: what is reviewed, on what and in how many parts; a
 * line for each part; what the review leaves out, when it leaves something out; and the estimate with what
 * it rests on, which is always the last line. Nothing in them says whether a run would be started: that is
 * `needsFlagLine`, and the refusal of the run itself. */
export function planLines(plan) {
  const { range, model, effort, parts, files, changedLines, leftOut } = plan;
  return [
    `Plan of the Codex review of ${range}: ${model} at ${effort} effort, ${counted(parts.length, 'part')}, ${counted(changedLines, 'changed line')} in ${counted(files, 'file')}.`,
    ...parts.map((part) => {
      const sends = part.inputTokens === null ? '' : `, about ${thousands(part.inputTokens)} input tokens`;
      return `  part ${part.index} of ${part.of}: ${counted(part.files, 'file')}, ${counted(part.changedLines, 'changed line')}${sends}`;
    }),
    ...(leftOut === null ? [] : [`Left out of the review: ${leftOutSaid(leftOut)}.`]),
    estimateLine(plan),
  ];
}

// The version of the method a run line's `plan` was made by: 2 is the fit of `inputEstimator`, 1 the median
// cost a changed line it replaced, whose lines recorded no plan. A new way of estimating takes the next one.
export const PLAN_METHOD = 2;

/** What the run line of part `index` (1 for a range reviewed whole) records of `plan`, the plan the run printed:
 * `{ estimate, high, method }`, the part's two figures as the plan has them and `PLAN_METHOD`; `null` when the
 * plan has no such part or no estimate, since then nothing was planned. */
export function partPlanned(plan, index = 1) {
  const planned = plan?.parts?.[index - 1];
  if (planned === undefined || planned.inputTokens === null) return null;
  return { estimate: planned.inputTokens, high: planned.inputTokensHigh, method: PLAN_METHOD };
}

// The estimate a run line recorded, when this method made it; `null` for any other line.
const plannedEstimate = (run) =>
  run?.plan?.method === PLAN_METHOD && Number.isFinite(run.plan.estimate) ? run.plan.estimate : null;

// The estimate this method gives part `part` of `runs[index]` from the lines written before it, on the model and
// at the effort the line ran with; `null` when no measured line came before it.
const replayedEstimate = (runs, index, part) => {
  const { estimate } = inputEstimator(runs.slice(0, index), { model: runs[index].model, effort: runs[index].effort });
  return estimate === null ? null : estimate(part.changedLines);
};

// How many of the latest reviews the method is judged on.
const REVIEWS_JUDGED = 10;

const roundedRatio = (value) => (value === null ? null : Math.round(value * 100) / 100);

/** How close the method's estimates came to what the reviews recorded here took, from `records` (the review
 * records, as `readCodexReviews` gives them) and `runs` (the run log): `{ recorded, reviews, low, median, high }`,
 * how many reviews the records hold, on how many of the last `REVIEWS_JUDGED` the method is measured, and the
 * least, the median and the most of their estimate over what they took, to two decimals; `null` in the three
 * when it is measured on none.
 *
 * Each part is measured against its own run line, with the estimate the line recorded (`plan`) when this method
 * made it (`PLAN_METHOD`), and otherwise the one this method gives from the lines written before that one, on
 * the model and at the effort the line was run with: a replay, for the lines written before they held their
 * plan. A review is the run lines its record names (`runs`, else `run`), since the
 * run log holds no review id and the parts of one review write their lines out of order. A line an earlier
 * record named is a part kept from that run, which cost nothing in this one, and is left out; so is a line that
 * measured no part (`measuredParts`) and one with no measured line before it, which had no estimate. An
 * attempt that failed is named by no record. A review with no part left is not one the method is measured on. */
export function methodRecord({ records, runs }) {
  const at = new Map();
  runs.forEach((run, index) => {
    if (typeof run?.id === 'string' && run.id !== '' && !at.has(run.id)) at.set(run.id, index);
  });
  const named = new Set();
  const ratios = [];
  let recorded = 0;
  for (const record of records) {
    if (record?.outcome !== 'reviewed') continue;
    recorded += 1;
    const ids = Array.isArray(record.runs) ? record.runs : [record.run];
    let estimated = 0;
    let took = 0;
    for (const id of ids) {
      if (!at.has(id) || named.has(id)) continue;
      named.add(id);
      const index = at.get(id);
      const [part] = measuredParts([runs[index]]);
      if (part === undefined) continue;
      const planned = plannedEstimate(runs[index]) ?? replayedEstimate(runs, index, part);
      if (planned === null) continue;
      estimated += planned;
      took += part.inputTokens;
    }
    if (took > 0) ratios.push(estimated / took);
  }
  const judged = ratios.slice(-REVIEWS_JUDGED);
  if (judged.length === 0) return { recorded, reviews: 0, low: null, median: null, high: null };
  return { recorded, reviews: judged.length, low: roundedRatio(Math.min(...judged)), median: roundedRatio(median(judged)), high: roundedRatio(Math.max(...judged)) };
}

/** How the method did (`methodRecord`), as the one line `codex-review --plan` prints after its estimate. */
export function methodRecordLine({ recorded, reviews, low, median: middle, high }) {
  if (reviews === 0) {
    return recorded > 0
      ? 'How the method did: no review this machine recorded has a part it can be measured on yet.'
      : 'How the method did: no reviews recorded yet.';
  }
  const how = 'each part against its own run line, kept parts left out.';
  if (reviews === 1) return `How the method did: on the last review this machine recorded, its estimate came to ${low} times what it took; ${how}`;
  return `How the method did: on the last ${reviews} reviews this machine recorded, its estimate came to between ${low} and ${high} times what each took, ${middle} at the median; ${how}`;
}

/** The bound of parts of `plan`, as what a count is said to be more than: the count the run named, or the
 * one a run starts without naming any. */
export function partsBound({ maxParts, maxPartsGiven }) {
  return maxPartsGiven ? `\`--max-parts ${maxParts}\` allows` : `the ${thousands(maxParts)} a run starts without \`--max-parts\``;
}

/** What a plan over the bound of parts says of the run it describes: that it has more parts than a run
 * starts, and the flag the run would need, with the count. `null` for a plan within the bound. */
export function needsFlagLine(plan) {
  if (!plan.over) return null;
  return `This is more parts than ${partsBound(plan)}: the run would need \`--max-parts ${plan.parts.length}\`.`;
}

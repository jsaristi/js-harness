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
// tokens its session spent (`./codex-review-runs.mjs`), and the estimate of a part is its changed lines
// times the median of that ratio over the parts measured before. The median, because one session that read
// far more than its diff must not move the estimate of every part. In two bands, because the ratio falls as
// a part grows: the parts of up to 400 changed lines of that one run cost 325 input tokens a changed line
// and the larger ones 178. With no measured part there is no estimate, and the plan says so.
//
// It estimates input tokens alone, the cached ones included, which is what `usage.inputTokens` counts: the
// number the cost of the reviews was counted in when this was asked for. What a review writes is not estimated.
import { PART_MAX_CHANGED_LINES } from './codex-review-parts.mjs';
import { runPart, runSession, runSessionModel } from './codex-review-runs.mjs';

// How many parts a run starts without being told to; `--max-parts <n>` names another count (T3 of
// odd/tasks/codex-review-cost.md). At the 400 changed lines of a part, six parts are a range of up to about
// 2,400, which a slice reviewed when it closes stays under: a run over it is most often a branch that was
// not reviewed slice by slice, and the run this bound exists for was 28 parts.
export const MAX_PARTS_WITHOUT_FLAG = 6;

// How many measured parts on the model and at the effort of the review it takes for the estimate to rest
// on those alone. Under it every measured part counts, at whatever effort, and the plan says so: an
// estimate from runs at another effort is worth more than none, and less than it looks.
export const RUNS_TO_STAND_ALONE = 5;

// How many measured parts a band takes to have a median of its own; a thinner one takes that of them all.
export const RUNS_FOR_A_BAND = 3;

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
 *  - `runs`, how many measured parts the estimate rests on (`measuredParts`); 0 when there is none, and
 *    then `estimate` is `null`: there is no estimate, and no number stands in for one.
 *  - `atPair`, how many of the measured parts ran on that model at that effort, as their own sessions said;
 *    `samePair`, whether the estimate rests on those alone, which it does from `RUNS_TO_STAND_ALONE` of
 *    them on. Otherwise it rests on every measured part, at whatever effort.
 *  - `perChangedLine`, the median input tokens a changed line cost, `upToBound` for the parts of at most
 *    `bandAt` changed lines and `aboveBound` for the larger ones; a band of fewer than `RUNS_FOR_A_BAND`
 *    parts has the median of them all.
 *  - `floor`, the smallest input total of those parts: no session costs less than what it loads before it
 *    has read a line of the diff.
 *  - `estimate(changedLines)`, the input tokens of a part of that many changed lines: the lines times the
 *    median of its band, and never under `floor`. Not rounded: `reviewPlan` rounds what is printed. */
export function inputEstimator(runs, { model, effort, bandAt = PART_MAX_CHANGED_LINES }) {
  const measured = measuredParts(runs);
  const same = measured.filter((one) => one.model === model && one.effort === effort);
  const samePair = same.length >= RUNS_TO_STAND_ALONE;
  const basis = samePair ? same : measured;
  if (basis.length === 0) return { runs: 0, samePair: false, atPair: 0, estimate: null };
  const perLine = (parts) => median(parts.map((one) => one.inputTokens / one.changedLines));
  const ofAll = perLine(basis);
  const ofBand = (parts) => (parts.length >= RUNS_FOR_A_BAND ? perLine(parts) : ofAll);
  const perChangedLine = {
    upToBound: ofBand(basis.filter((one) => one.changedLines <= bandAt)),
    aboveBound: ofBand(basis.filter((one) => one.changedLines > bandAt)),
  };
  const floor = Math.min(...basis.map((one) => one.inputTokens));
  const estimate = (changedLines) => Math.max(floor, changedLines * (changedLines <= bandAt ? perChangedLine.upToBound : perChangedLine.aboveBound));
  return { runs: basis.length, samePair, atPair: same.length, perChangedLine, floor, estimate };
}

/** An estimate as it is printed: to two figures. One printed to the token reads as a measurement. */
function twoFigures(tokens) {
  if (tokens <= 0) return 0;
  const unit = Math.max(1, 10 ** (Math.floor(Math.log10(tokens)) - 1));
  return Math.round(tokens / unit) * unit;
}

/** The plan of the review of `base..head` (full commit ids) on `model` at `effort`: what a run would start,
 * and what it is estimated to send. `parts` are the parts of the range as `reviewParts` gives them, each
 * `{ files, changedLines }`, none for a range that changes no file; `runs` the lines of this machine's run
 * log, which the estimate is made from (`inputEstimator`); `maxParts` how many parts the run may start,
 * `MAX_PARTS_WITHOUT_FLAG` unless the run named a count.
 *
 * It is data, and `planLines` says it: the `range` by short ids, the `model` and the `effort`, each part
 * with its `index` of `of`, how many `files` and `changedLines` it has and its `inputTokens`, the totals of
 * the three, the `basis` of the estimate (how many `runs`, whether they are on the same model and effort
 * alone, `samePair`, how many are, `atPair`, and where the two bands part, `bandAt`), and whether the plan is
 * `over` the bound of parts. `inputTokens` is `null`, of each part and of the whole, when there is no
 * estimate; otherwise each is to two figures, and that of the whole is the sum of those of the parts. */
export function reviewPlan({ base, head, model, effort, parts, runs = [], maxParts }) {
  const bandAt = PART_MAX_CHANGED_LINES;
  const { runs: measured, samePair, atPair, estimate } = inputEstimator(runs, { model, effort, bandAt });
  const planned = parts.map((part, at) => ({
    index: at + 1,
    of: parts.length,
    files: part.files.length,
    changedLines: part.changedLines,
    inputTokens: estimate === null ? null : twoFigures(estimate(part.changedLines)),
  }));
  const total = (pick) => planned.reduce((sum, part) => sum + pick(part), 0);
  const bound = maxParts ?? MAX_PARTS_WITHOUT_FLAG;
  return {
    range: `${base.slice(0, 7)}..${head.slice(0, 7)}`,
    model,
    effort,
    parts: planned,
    files: total((part) => part.files),
    changedLines: total((part) => part.changedLines),
    inputTokens: estimate === null || planned.length === 0 ? null : total((part) => part.inputTokens),
    basis: { runs: measured, samePair, atPair, bandAt },
    maxParts: bound,
    maxPartsGiven: maxParts !== undefined,
    over: planned.length > bound,
  };
}

const thousands = (count) => String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** `count` things, with `noun` in the singular for one: `1 part`, `2 parts`. */
const counted = (count, noun) => `${thousands(count)} ${noun}${count === 1 ? '' : 's'}`;

/** What the estimate of `plan` is and what it rests on, as one line; or that there is none, and why.
 *
 * It says how many parts the estimate rests on and how many of them ran on the model and at the effort of
 * the review. When all of them did, that is all there is to say, whether they are the five that stand alone
 * or fewer: another effort is spoken of only when some part ran at one, or named none. */
function estimateLine({ parts, inputTokens, model, effort, basis }) {
  if (parts.length === 0) return 'No estimate: the range changes no file, so there is no part to review.';
  if (inputTokens === null) return 'No estimate: the run log of this machine holds no part whose changed lines and input tokens were measured, and an estimate is never a guess.';
  const pair = `on ${model} at ${effort} effort`;
  const rests = basis.atPair === basis.runs
    ? `${counted(basis.runs, 'part')} this machine's run log measured ${pair}`
    : `${counted(basis.runs, 'part')} this machine's run log measured, ${thousands(basis.atPair)} of them ${pair} and the rest at another effort or in a session that named none ` +
      `(with ${RUNS_TO_STAND_ALONE} or more of the first kind it would rest on those alone)`;
  return (
    `Estimate: about ${thousands(inputTokens)} input tokens in all. It rests on ${rests}: a part is put at its changed lines times the median input tokens a changed line cost in them, ` +
    `the parts of up to ${thousands(basis.bandAt)} changed lines apart from the larger ones, and never under what the cheapest of them cost.`
  );
}

/** A plan (`reviewPlan`) as the lines a person reads: what is reviewed, on what and in how many parts; a
 * line for each part; and the estimate with what it rests on. Nothing in them says whether a run would be
 * started: that is `needsFlagLine`, and the refusal of the run itself. */
export function planLines(plan) {
  const { range, model, effort, parts, files, changedLines } = plan;
  return [
    `Plan of the Codex review of ${range}: ${model} at ${effort} effort, ${counted(parts.length, 'part')}, ${counted(changedLines, 'changed line')} in ${counted(files, 'file')}.`,
    ...parts.map((part) => {
      const sends = part.inputTokens === null ? '' : `, about ${thousands(part.inputTokens)} input tokens`;
      return `  part ${part.index} of ${part.of}: ${counted(part.files, 'file')}, ${counted(part.changedLines, 'changed line')}${sends}`;
    }),
    estimateLine(plan),
  ];
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

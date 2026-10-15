// The recheck of a correction: a Codex review whose range starts where a reviewed range whose review found
// something ended is a check of those findings, made once, and not a new review.
//
// Why. Each review of a correction used to find a new edge of the corrected code, smaller each time, and
// each round cost a fix, a gate turn and a review. The rule against it (one correction batch, one recheck
// limited to its findings, a new finding never earns another round) was prose, and was lost under
// momentum. So the code decides it, and no flag can skip it:
//
// - A range is a recheck when it starts at the head of a `reviewed` record whose review found something
//   worth correcting: a verdict of `incorrect`, or a finding of P0 to P2 (`recheckState`). Commits that
//   change only documents between that head and the start of the range do not move it: a feature document
//   committed before the fix is how a correction is usually made. Its prompt lists those findings and asks,
//   for each, whether the range fixes it (`recheckPrompt`). Anything new is a follow-up that does not
//   block, except a finding that could make a failing check pass, or that exposes data, which blocks
//   (`classifyRecheck`). A finding the answer does not mark is taken as open, never as fixed.
// - Its record stays `reviewed`, so it covers its commits as any review does, and names the head whose
//   findings it checked (`recheckOf`); its run line counts what it found (`recheck`).
// - A second recheck of the same findings is refused before anything runs: from the head of a recheck that
//   left one open, and from the head of a review whose findings were already rechecked (`--again` included).
//   What is still open becomes a follow-up task, and the range is recorded as a skip (`secondRecheckRefused`).
//
// Its limit: new code committed in the same range as a correction is read as a follow-up, not reviewed;
// only a blocking finding stops it. A session that wants new work reviewed in full commits the correction
// first, and reviews the new work from the recheck's head.

import { isDocument } from './codex-review-scope.mjs';
import { isValidCodexReview } from './codex-reviews.mjs';
import { EXCUSED_REFUSED_TESTS } from './no-test-outside-turn.mjs';

/** The version of the text a recheck adds to the review prompt. */
export const RECHECK_PROMPT_VERSION = 'js-harness.codex-review-recheck-prompt/v1';

/** The marks a recheck's answer puts at the start of a finding's title. */
export const NOT_FIXED = '[not fixed]';
export const FOLLOW_UP = '[follow-up]';
export const BLOCKS = '[blocks]';

/** How many commits behind the start of a range are looked through for the review its findings ended at. */
export const RECHECK_LOOK_BACK = 500;

/** The answer a run line kept: its `answer` (every reviewed line since the recheck), or else the
 * `kept.review` of a part of a range reviewed in parts, which kept its answer before `answer` existed.
 * `null` when it kept none, which is not the same as an answer that found nothing. */
function runAnswer(run) {
  const answer = run?.answer ?? run?.kept?.review;
  return Array.isArray(answer?.findings) ? answer : null;
}

/** The findings a run line kept of its answer, or `null` when it kept none (see `runAnswer`). */
export function runAnswerFindings(run) {
  return runAnswer(run)?.findings ?? null;
}

/** The ids of the run lines a record names, in order: `runs` for a range reviewed in parts, else `run`. */
function recordRuns(rec) {
  if (Array.isArray(rec.runs)) return rec.runs;
  return typeof rec.run === 'string' ? [rec.run] : [];
}

/** Whether an answer found something a correction is owed for: a verdict of `incorrect`, or a finding of
 * P0 to P2. A review that found only P3 findings and called the patch correct leaves the next range a
 * review as any other, since that range is then more likely new work than a correction. So does an
 * `incorrect` the review excused (`excused: 'refused-tests'`, `excusedByRefusal`): it rested on `node --test`
 * runs refused out of the lock alone, on a range whose suite the gate had already run. */
const owesCorrection = (answer) =>
  (answer.verdict === 'incorrect' && answer.excused !== EXCUSED_REFUSED_TESTS) || answer.findings.some((one) => ['P0', 'P1', 'P2'].includes(one?.severity));

/** Where the findings a range may recheck ended: the head of the nearest `reviewed` record among the
 * commits behind `from` (`back`, `from` first, newest first), when nothing but documents changed between
 * that head and `from` (`changedBetween(head, from)` gives the paths, or `null` when git could not say).
 * Otherwise `from` itself. */
export function recheckAnchor({ from, records, back, changedBetween }) {
  const at = new Map(back.map((id, index) => [id, index]));
  let nearest = null;
  for (const rec of records) {
    if (!isValidCodexReview(rec) || rec.outcome !== 'reviewed' || !at.has(rec.head)) continue;
    if (nearest === null || at.get(rec.head) < at.get(nearest)) nearest = rec.head;
  }
  if (nearest === null || nearest === from) return from;
  const changed = changedBetween(nearest, from);
  return changed !== null && changed.every(isDocument) ? nearest : from;
}

/** What a review of a range whose findings would have ended at `from` (`recheckAnchor`) is, from the
 * review records and the run log:
 *
 * - `{ kind: 'review' }`: a review as any other. No reviewed record ends at `from`; or the review that
 *   ended there owed no correction (`owesCorrection`), or kept nothing of what it found (one recorded
 *   before findings were kept); or it was a recheck that left nothing open.
 * - `{ kind: 'recheck', of, findings }`: a check of the `findings` of the review that ended at `of`.
 * - `{ kind: 'refused', of, open }`: a second recheck of the findings of the review that ended at `of`,
 *   whose first recheck left `open` findings not fixed, blocking or unmarked (`null` when its counts were
 *   not kept, which is taken as open). It is refused: from the head of that recheck when it left some open,
 *   and from `of` itself whatever it left, since those findings were rechecked already, unless `holds`
 *   (whether the range's head holds a commit: `true`, `false`, or `null` when git cannot say) says the
 *   range's head does not hold that recheck's head: then it forked before the recheck, and is a review.
 *
 * The last reviewed record that ends at `from` decides, since a later one is the later word on that head. */
export function recheckState({ from, records, runs, holds = () => null }) {
  const reviewed = records.filter((rec) => isValidCodexReview(rec) && rec.outcome === 'reviewed');
  const linesOf = (rec) => recordRuns(rec).map((id) => (id === null ? null : runs.findLast((one) => one?.id === id) ?? null));
  const openOf = (rec) => {
    const counts = linesOf(rec).at(-1)?.recheck;
    if (!Number.isInteger(counts?.notFixed) || !Number.isInteger(counts?.blocking)) return null;
    return counts.notFixed + counts.blocking + (Number.isInteger(counts.unmarked) ? counts.unmarked : 0);
  };
  const prior = reviewed.filter((rec) => rec.head === from).at(-1);
  if (prior === undefined) return { kind: 'review' };
  if (typeof prior.recheckOf === 'string') {
    const open = openOf(prior);
    return open === 0 ? { kind: 'review' } : { kind: 'refused', of: prior.recheckOf, open };
  }
  const rechecked = reviewed.filter((rec) => rec.recheckOf === from).at(-1);
  // A second recheck only on the line the recheck continues. A range whose head forked from `from` before
  // the recheck holds none of the correction it read: its commits are new code, a review as any other
  // (L8 of odd/tasks/merge-queue.md, pull request 167). Unknown is refused, as before.
  if (rechecked !== undefined) return holds(rechecked.head) === false ? { kind: 'review' } : { kind: 'refused', of: from, open: openOf(rechecked) };
  const lines = linesOf(prior);
  if (lines.length === 0 || lines.includes(null)) return { kind: 'review' };
  const answers = lines.map(runAnswer);
  if (answers.includes(null)) return { kind: 'review' };
  if (!answers.some(owesCorrection)) return { kind: 'review' };
  const findings = answers.flatMap((answer) => answer.findings);
  if (findings.length === 0) return { kind: 'review' };
  return { kind: 'recheck', of: from, findings };
}

/** One earlier finding on one line: `file:lines severity title`. */
export function priorLine(finding) {
  const lines = finding.start === finding.end || finding.end === undefined ? `${finding.start}` : `${finding.start}-${finding.end}`;
  const where = typeof finding.file === 'string' ? `${finding.file}:${lines}` : 'no file given';
  const severity = finding.severity ? ` ${finding.severity}` : '';
  return `${where}${severity} ${String(finding.title ?? '').trim().replace(/\s+/g, ' ')}`;
}

/** One earlier finding as the recheck prompt lists it: its number, its line and its body. */
function listed(finding, at) {
  const body = typeof finding.body === 'string' && finding.body.trim() !== '' ? `\n   ${finding.body.trim().replace(/\s*\n\s*/g, '\n   ')}` : '';
  return `${at + 1}. ${priorLine(finding)}${body}`;
}

/** The review prompt `text` (this command's own, for the whole range or its one part) with what makes it a
 * recheck of `findings`: the findings, and how each is answered. */
export function recheckPrompt(text, findings) {
  const recheck = [
    '## A recheck of earlier findings',
    'This range corrects the findings an earlier review of this branch made, listed below. Check each of them: does this range fix it?',
    `- For each finding this range does not fix, report one finding whose title starts with "${NOT_FIXED}", then the number the finding has in the list below, then its title, and say what is still missing.`,
    '- A finding that is fixed needs nothing: do not report it.',
    '- An earlier finding that is still open is reported even when this range leaves its lines as they were, or changes another file: for these findings, the rule above to report nothing of code the diff leaves as it was does not hold.',
    `- Anything else you notice is a follow-up: its title starts with "${FOLLOW_UP}". It does not block, so report it once and briefly.`,
    `- Except a new finding that could make a failing check pass, or that exposes data (a secret, a credential, or a person's data): its title starts with "${BLOCKS}".`,
    'Every finding you report starts with one of these three marks.',
    'Do not look for new edges of the corrected code beyond these findings: this is a recheck of them, not a new review of the range.',
    '',
    '### The earlier findings',
    ...findings.map(listed),
  ];
  return `${text.replace(/\n+$/, '')}\n\n${recheck.join('\n')}\n`;
}

// The marks as the answer may write them, in any case, with a space or a hyphen, inside Markdown emphasis.
// "Not fixed" counts anywhere in the start of a title, since reading it where it is no mark only keeps a
// finding open. A follow-up or a blocking mark counts only in brackets, or as the word the title starts with:
// read anywhere, an ordinary title ("Preserve follow-up tasks") would pass as a follow-up, and a follow-up
// does not keep the recheck open.
const MARKS = [
  ['notFixed', /not[\s-]?fixed/],
  ['blocking', /^\[\s*block(?:s|ing)?\s*\]|^block(?:s|ing)?\b/],
  ['followUp', /^\[\s*follow[\s-]?ups?\s*\]|^follow[\s-]?ups?\b/],
];

/** The mark a finding's title carries in its first 60 characters, the one that comes first, with the number
 * of the earlier finding that follows a "not fixed" mark; `{ mark: null }` for a title that carries none. */
function markOf(finding) {
  const title = String(finding.title ?? '').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/^(\[p[0-3]\]\s*)+/, '').slice(0, 60);
  let first = null;
  for (const [mark, pattern] of MARKS) {
    const found = pattern.exec(title);
    if (found !== null && (first === null || found.index < first.index)) first = { mark, index: found.index, end: found.index + found[0].length };
  }
  if (first === null) return { mark: null };
  if (first.mark !== 'notFixed') return { mark: first.mark };
  const number = /^\W{0,3}#?(\d+)\b/.exec(title.slice(first.end));
  return { mark: 'notFixed', number: number === null ? null : Number(number[1]) };
}

/** What a recheck of the `prior` findings answered, from its `review` (`normalizeAnswer`): the findings it
 * says are not fixed, the blocking ones, the follow-ups, and those it did not mark, which are taken as open:
 * they may be an earlier finding not fixed. `status` says of each earlier finding, in order, `fixed`, `not
 * fixed` (its number was given), or `not said` (some finding not fixed or not marked gave no number, so
 * which one it is cannot be told); a finding not reported is fixed. */
export function classifyRecheck(review, prior) {
  const notFixed = [];
  const blocking = [];
  const followUps = [];
  const unmarked = [];
  const numbers = new Set();
  let unnumbered = 0;
  for (const finding of review?.findings ?? []) {
    const read = markOf(finding);
    if (read.mark === 'notFixed') {
      notFixed.push(finding);
      if (read.number !== null && read.number >= 1 && read.number <= prior) numbers.add(read.number);
      else unnumbered += 1;
    } else if (read.mark === 'blocking') blocking.push(finding);
    else if (read.mark === 'followUp') followUps.push(finding);
    else {
      unmarked.push(finding);
      unnumbered += 1;
    }
  }
  const status = Array.from({ length: prior }, (_, at) => (numbers.has(at + 1) ? 'not fixed' : unnumbered > 0 ? 'not said' : 'fixed'));
  // A finding is counted fixed only when the list says so of it, so the count and the list never disagree.
  const fixed = status.filter((one) => one === 'fixed').length;
  return {
    notFixed,
    blocking,
    followUps,
    unmarked,
    status,
    counts: { findings: prior, fixed, notFixed: notFixed.length, followUps: followUps.length, blocking: blocking.length, unmarked: unmarked.length },
  };
}

/** The refusal of a second recheck of the findings of the review that ended at `of`. */
export function secondRecheckRefused({ of, open, base }) {
  const first = open === null ? 'the counts of the first were not kept' : open === 0 ? 'the first found every one fixed' : `the first left ${open === 1 ? '1 finding' : `${open} findings`} not fixed or blocking`;
  return (
    `A second recheck of the findings of the review that ended at ${of.slice(0, 7)} is not run: ${first}. Nothing was started or recorded.\n` +
    'Record a follow-up task for what is still open in the feature document, then record this range as a skip: ' +
    `\`codex-review --base ${base} --unavailable "second recheck refused: <task>"\`.`
  );
}

/** The refusal of a recheck that would be reviewed in more than one part. */
export function recheckTooLarge({ of, parts }) {
  return (
    `This range starts where the review that ended at ${of.slice(0, 7)} found something, so it is a recheck of those findings; ` +
    `but it is ${parts} parts, and a recheck is one. Nothing was started or recorded.\n` +
    'Commit the correction alone and recheck it, or record a follow-up task for the findings and review the new work from a commit after it.'
  );
}

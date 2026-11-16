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
//   block, except a finding that could make a failing check pass, exposes data or is a regression, which blocks
//   (`classifyRecheck`). A finding the answer does not mark is taken as open, never as fixed.
// - Its record stays `reviewed`, so it covers its commits as any review does, and names the head whose
//   findings it checked (`recheckOf`); its run line counts what it found (`recheck`).
// - At most three reviews of one change (spec 8 of odd/tasks/double-review-alignment.md): from the head of a
//   recheck that left findings open, a second recheck of those findings is the third. Past it nothing more is
//   reviewed: from the head of a second recheck that left one open, or again from a head already rechecked, the
//   run is refused before anything runs, with what is open and the strongest model the rules name, which the
//   work passes to (`rule:session-model`); a recheck whose open findings were not kept is refused as one
//   recheck too many, with a follow-up task (`secondRecheckRefused`). A range whose every code commit has a
//   record needs nothing more; one that holds code no record covers is reviewed from the nearest commit behind
//   it that starts a review, with `--again`, so that no skip leaves new code unread. A run with `--again` from
//   further behind, or over a range with no new code, would review the change a fourth time, and is refused too
//   (`againPastThreeReviews`; M12 of the Fable 5.2 audit).
//
// Its limit: new code committed in the same range as a correction is read as a follow-up, not reviewed;
// only a blocking finding stops it. A session that wants new work reviewed in full commits the correction
// first, and reviews the new work from the recheck's head.

import { isDocument } from './codex-review-scope.mjs';
import { isValidCodexReview, NOTHING_TO_REVIEW } from './codex-reviews.mjs';
import { EXCUSED_REFUSED_TESTS } from './no-test-outside-turn.mjs';
import { claudeHome } from './model-home.mjs';

/** The model a change passes to when three reviews of it did not settle it, and what is done then: the one model
 * of the Claude home, which the escalation's own rule retired into on 2026-11-11. */
export const ESCALATION_MODEL = claudeHome().model;
export const ESCALATION_SAID = `Raise it to the user as a problem, with what is happening and what is still open, and pass the work to ${ESCALATION_MODEL}, the strongest model the rules name (rule:session-model)`;

/** What a recheck that left findings open says of what comes after it (spec 8): a range from `head` is a second
 * recheck, the last of three reviews; after a second (`second`), three reviews did not settle the change, so it is
 * raised and passed on now, not when a fourth is tried. */
export function openAfterRecheck({ head, second }) {
  return second
    ? `Three reviews of this change did not settle it. ${ESCALATION_SAID}.`
    : `A range that starts at ${head.slice(0, 7)} is a second recheck of what is open, the last of three reviews: fix it in this branch, then run it.`;
}

/** The version of the text a recheck adds to the review prompt. */
export const RECHECK_PROMPT_VERSION = 'js-harness.codex-review-recheck-prompt/v2';

/** The marks a recheck's answer puts at the start of a finding's title. */
export const NOT_FIXED = '[not fixed]';
export const FOLLOW_UP = '[follow-up]';
export const BLOCKS = '[blocks]';

/** How many commits behind the start of a range are looked through for the review its findings ended at. */
export const RECHECK_LOOK_BACK = 500;

/** How many commits behind a refused range are tried for one a run with `--again` reviews as any other. */
export const REVIEW_FROM_LOOK_BACK = 20;

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

/** Whether every run line the record `rec` names is in `runs`, the run log, and it names one at least. A
 * record whose line never reached the log reads in `recheckState` as owing nothing, which a caller that must
 * know whether it owes a correction cannot take as an answer (the verifier of pull request 338). */
export function runsLogged(rec, runs) {
  const ids = recordRuns(rec);
  return ids.length > 0 && ids.every((id) => typeof id === 'string' && runs.some((one) => one?.id === id));
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
 * that head and `from` (`changedBetween(head, from)` gives the paths, or `null` when git could not say), or
 * when what did change lies in ranges whose records are no review (`throughNoReview`). Otherwise `from` itself.
 *
 * A record that is no review, an explicit skip or a range with nothing to review, pays no correction: a skip over
 * code above a review that owes one left it owed, and the next review is its recheck (B1-2 of the full audit,
 * 2026-11-14), as a commit and its revert leave it owed (Y1). */
export function recheckAnchor({ from, records, back, changedBetween }) {
  const at = new Map(back.map((id, index) => [id, index]));
  let nearest = null;
  for (const rec of records) {
    if (!isValidCodexReview(rec) || rec.outcome !== 'reviewed' || !at.has(rec.head)) continue;
    if (nearest === null || at.get(rec.head) < at.get(nearest)) nearest = rec.head;
  }
  if (nearest === null || nearest === from) return from;
  const documentsOnly = (older, newer) => older === newer || (changedBetween(older, newer)?.every(isDocument) ?? false);
  if (documentsOnly(nearest, from)) return nearest;
  return throughNoReview({ from, nearest, records, at, documentsOnly }) ? nearest : from;
}

/** Whether the line from `nearest` up to `from` (`at`, each commit's place behind `from`) is walked by records that
 * are no review alone, with documents between them: from `from` down, a valid skip or range with nothing to review
 * whose head is `from` or below it past documents only, and whose base lies on the line, takes the walk to its base,
 * until `nearest` is reached past documents only, or passed: a record whose base is older than `nearest` spans the
 * reviewed head and pays none of what it owes either. A stretch no such record covers stops it. */
function throughNoReview({ from, nearest, records, at, documentsOnly }) {
  const limit = at.get(nearest);
  const noReviews = records.filter((rec) => isValidCodexReview(rec) && (rec.outcome === 'unavailable' || rec.outcome === NOTHING_TO_REVIEW) && at.has(rec.head) && at.has(rec.base) && at.get(rec.head) < at.get(rec.base));
  // `recheckAnchor` already asked whether `nearest..from` changed documents alone: git is asked nothing more where no
  // such record lies on the line, and each step asks it only of where the walk has moved to.
  let cur = from;
  for (let steps = 0; steps < noReviews.length; steps += 1) {
    const place = at.get(cur);
    const next = noReviews
      .filter((rec) => at.get(rec.head) >= place && at.get(rec.base) > place && documentsOnly(rec.head, cur))
      .reduce((oldest, rec) => (oldest === null || at.get(rec.base) > at.get(oldest.base) ? rec : oldest), null);
    if (next === null) return false;
    cur = next.base;
    if (at.get(cur) >= limit || documentsOnly(nearest, cur)) return true;
  }
  return false;
}

/** What a review of a range whose findings would have ended at `from` (`recheckAnchor`) is, from the
 * review records and the run log:
 *
 * - `{ kind: 'review' }`: a review as any other. No reviewed record ends at `from`; or the review that
 *   ended there owed no correction (`owesCorrection`), or kept nothing of what it found (one recorded
 *   before findings were kept); or it was a recheck that left nothing open.
 * - `{ kind: 'recheck', of, findings }`: a check of the `findings` of the review that ended at `of`.
 * - `{ kind: 'recheck', of, findings, second: true }`: a second recheck, the third review, of the `findings` the
 *   recheck that ended at `of` left open (not fixed, blocking or unmarked), when its answer kept them.
 * - `{ kind: 'refused', of, open, reviews: 3, findings }`: a fourth review, from the head of a second recheck that
 *   left `open` findings (`findings`, those its answer kept), or again from a head a second recheck rechecked;
 *   `of` is that second recheck's head.
 * - `{ kind: 'refused', of, open }`: a second recheck of the findings of the review that ended at `of`,
 *   whose first recheck left `open` findings not fixed, blocking or unmarked (`null` when its counts were
 *   not kept, which is taken as open). It is refused: from the head of that recheck when it left some open,
 *   and from `of` itself whatever it left, since those findings were rechecked already, unless `holds`
 *   (whether the range's head holds a commit: `true`, `false`, or `null` when git cannot say) says the
 *   range's head does not hold that recheck's head: then it forked before the recheck, and is a review.
 *
 * The last reviewed record that ends at `from` decides, since a later one is the later word on that head, save one
 * thing: a later record settles a correction an earlier one owes there only where it read all that one read, its base at
 * or before the earlier base (`atOrBefore(older, newer)`: `true`, `false`, or `null` when git cannot say; equal
 * bases need no git). A clean `--again` over a part of the range read only that part, and cleared what the rest owed
 * (odd/tasks/again-subrange.md, L71 A of review-gate). Unknown keeps what is owed. */
export function recheckState(given) {
  return decidingRecord(given).state;
}

/** The reviewed record at `from` that decides, as `recheckState` reads it (`kept`, undefined where none ends there),
 * and the state it gives. */
export function decidingRecord({ from, records, runs, holds = () => null, atOrBefore = () => null }) {
  const reviewed = records.filter((rec) => isValidCodexReview(rec) && rec.outcome === 'reviewed');
  const linesOf = (rec) => recordRuns(rec).map((id) => (id === null ? null : runs.findLast((one) => one?.id === id) ?? null));
  const openOf = (rec) => {
    const counts = linesOf(rec).at(-1)?.recheck;
    if (!Number.isInteger(counts?.notFixed) || !Number.isInteger(counts?.blocking)) return null;
    return counts.notFixed + counts.blocking + (Number.isInteger(counts.unmarked) ? counts.unmarked : 0);
  };
  // What a recheck left open, as its answer kept it: `[]` when it kept none.
  const openFindings = (rec) => {
    const answer = runAnswer(linesOf(rec).at(-1));
    if (answer === null) return [];
    const read = classifyRecheck(answer, 0);
    return [...read.notFixed, ...read.blocking, ...read.unmarked];
  };
  const rechecked = reviewed.filter((rec) => rec.recheckOf === from).at(-1);
  const stateOf = (prior) => {
    if (typeof prior.recheckOf === 'string') {
      const open = openOf(prior);
      if (open === 0) return { kind: 'review' };
      const second = typeof reviewed.filter((rec) => rec.head === prior.recheckOf).at(-1)?.recheckOf === 'string';
      if (second) return { kind: 'refused', of: from, open, reviews: 3, findings: openFindings(prior) };
      if (rechecked !== undefined) {
        if (holds(rechecked.head) === false) return { kind: 'review' };
        const left = openOf(rechecked);
        return left === 0 ? { kind: 'refused', of: from, open: 0 } : { kind: 'refused', of: rechecked.head, open: left, reviews: 3, findings: openFindings(rechecked) };
      }
      const findings = openFindings(prior);
      return findings.length === 0 ? { kind: 'refused', of: prior.recheckOf, open } : { kind: 'recheck', of: from, findings, second: true };
    }
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
  };
  let kept;
  let state = { kind: 'review' };
  for (const rec of reviewed) {
    if (rec.head !== from) continue;
    const reads = kept === undefined || rec.base === kept.base || atOrBefore(rec.base, kept.base) === true;
    if (!reads && owes(state)) continue;
    kept = rec;
    state = stateOf(rec);
  }
  return { kept, state };
}

/** Whether a state still owes something: a recheck, or a refusal that left findings open. */
const owes = (state) => state.kind === 'recheck' || (state.kind === 'refused' && state.open !== 0);

/** What a range from `from` is, as `recheckState` says from where `recheckAnchor` puts its findings, and read past a
 * merge on the first-parent line as well: what a review owes is owed until a recheck names it, and a merge above it
 * does not clear it (odd/tasks/codex-spend.md, L21).
 *
 * Why. A correction owed was enforced only at the head of the last record that covered the newest code commit. A
 * merge of the default branch above a review that found something got a record of its own, by what was written in
 * it, which found nothing; from then on the push read that clean record, and the correction, which can only be
 * committed above the merge, was reviewed as any range, so the findings were never rechecked (docs/FAILURES.md,
 * open-findings-escape-merge). So a merge passes the debt below it on: one whose last reviewed record is that of
 * what was written in it (`diff: 'remerge'`, from its first parent) and owes nothing, or one that writes no line a
 * review reads (`writesNothing(merge)`, no record needed). The range is then what a range from the head below it
 * would be, with commits that change only documents read past between them as `recheckAnchor` reads them
 * (`changedBetween(older, newer)`). Any other record on the way, a merge that writes lines with no record of its
 * own, or a commit of more than two parents, stops it, and the range is what `recheckState` said.
 *
 * A merge's own record that owes a first recheck does not stop it either (codex-spend L24, V2): the merge's turn found
 * something, the run stopped, and the review after the merge is the recheck of those findings; ended there, the debt
 * below the merge was never rechecked, and the push, which reads only that last recheck, passed. So the walk goes on
 * below such a merge as below a clean one, and a debt found below joins it: the state is the recheck of the merge's own
 * record (`of` names its head, as it did, so its record keeps its shape), and its findings are the merge's, then those
 * owed below. A debt below that is settled (a refusal with nothing open) adds nothing. No clean record is written above
 * the merge while either is owed: the one record after it is the recheck of both.
 *
 * Where the debt below has had its three reviews (a refusal that left something open), the recheck after the merge is
 * of the merge's own findings alone, as it was before the walk went below the merge (codex-spend L26, W1). Refused
 * instead, as 457bb1c9 had it, the run printed a review from far behind the merge, which read main's code again and
 * whose record cleared the merge's finding unrechecked. Nothing more is reviewed of the change below; the push row reads that last recheck alone, and no
 * longer says the three reviews below were spent.
 *
 * Where the debt below waits for its second recheck, it joins too, and that recheck is the third review of the findings
 * below (`thirdBelow`). Its record names the merge, as any recheck of the merge's findings does, so the records alone
 * must tell the next run that a fourth review is not due: from the head of a recheck that left findings open, whose
 * `recheckOf` is a merge's own record and below which the walk joins a second recheck still due (nothing names that
 * debt's head since), the range is refused as past three reviews, with what that recheck left open and `merge`, the
 * merge, which `secondRecheckRefused` names. That refuses the merge's own findings at their second review as well.
 * The cap holds below a later merge whose own record owes too (codex-spend L28, X1): a state below it that the cap
 * refuses is spent as a refused one is, and that merge's recheck is of its own findings alone. Joined, a second merge
 * of main above the third review bought a fourth, and a third merge a fifth.
 *
 * `rows` are the commits behind `from` as `git rev-list --first-parent --parents` gives them, `from` first, each
 * `[id, ...parents]`; `records`, `runs` and `holds` as `recheckState` takes them. The line is walked in `rows` alone,
 * and git is asked (`changedBetween`, `writesNothing`) only once a review that owes something is found below a merge,
 * so a range with none pays nothing for this. The state found below a merge, or joined there, carries `at`, the head
 * of the newest record that owes it; a state read past a merge or at one carries `merge`, the newest merge on the way,
 * which a refusal names. Neither is ever in a record. */
export function recheckThrough({ from, rows, records, runs, holds = () => null, atOrBefore = () => null, changedBetween, writesNothing }) {
  const today = recheckState({ from: recheckAnchor({ from, records, back: rows.map(([id]) => id), changedBetween }), records, runs, holds, atOrBefore });
  const parentsOf = new Map(rows.map(([id, ...parents]) => [id, parents]));
  const reviewed = records.filter((rec) => isValidCodexReview(rec) && rec.outcome === 'reviewed');
  const lastAt = (id) => reviewed.filter((one) => one.head === id).at(-1);
  // Whether the last record at `id` is a merge's own: what was written in it, from its first parent, and no recheck.
  const mergeOwn = (id) => {
    const [rec, parents] = [lastAt(id), parentsOf.get(id) ?? []];
    return rec !== undefined && parents.length === 2 && rec.diff === 'remerge' && rec.base === parents[0] && typeof rec.recheckOf !== 'string';
  };
  const firstOfMerge = (state) => state.kind === 'recheck' && state.second !== true && mergeOwn(state.of);
  // The state read down the first-parent line from `start`, with `debt`, what the merges' own records met so far owe,
  // joined (`null`: none yet, and nothing is read but past a merge). `null` where the walk ends with no debt.
  const walk = (start, debt) => {
    // `merges` and `stretches`, those passed since the last record met, not yet read: each merge `{ id, own }` (`own`:
    // by its clean record), each stretch `[older, newer]` between them, which must change only documents. `passed`: a
    // merge lies between `from` and where the walk is; `newest`, the first of them.
    let owed = debt;
    let passed = owed !== null;
    let newest = owed?.merge ?? null;
    let [merges, stretches, at, newer] = [[], [], start, start];
    const join = (state) => ({ ...owed, findings: [...owed.findings, ...state.findings], at: owed.at ?? owed.of, ...(state.second === true ? { thirdBelow: true } : {}) });
    const reached = () => stretches.every(([older, upTo]) => older === upTo || (changedBetween(older, upTo)?.every(isDocument) ?? false)) && merges.every((merge) => merge.own || writesNothing(merge.id));
    for (let steps = 0; parentsOf.has(at) && steps < rows.length; steps += 1) {
      const parents = parentsOf.get(at);
      const rec = lastAt(at);
      if (rec !== undefined) {
        const state = recheckState({ from: at, records, runs, holds, atOrBefore });
        if (state.kind !== 'review') {
          if (!passed) return owed;
          stretches.push([at, newer]);
          if (!reached()) return owed;
          if (firstOfMerge(state)) {
            owed = owed === null ? { ...state, at, merge: newest } : join(state);
            [merges, stretches, at, newer] = [[], [], parents[0], parents[0]];
            continue;
          }
          if (owed === null) return capped(state, at) ?? { ...state, at, merge: newest };
          // Three reviews spent below, or a recheck there refused, by its own state or by the cap: the merge's own
          // recheck runs alone (W1, X1).
          return state.kind === 'refused' || capped(state, at) !== null ? owed : join(state);
        }
        if (parents.length !== 2 || rec.diff !== 'remerge' || rec.base !== parents[0]) return owed;
      } else if (parents.length !== 2) {
        if (parents.length !== 1) return owed;
        at = parents[0];
        continue;
      }
      merges.push({ id: at, own: rec !== undefined });
      stretches.push([at, newer]);
      [passed, newest] = [true, newest ?? at];
      [at, newer] = [parents[0], parents[0]];
    }
    return owed;
  };
  // The cap, where `state`, the range's own or one the walk met, is a second recheck: the recheck that ended at
  // `state.of` was of a merge's own findings, and joined there a second recheck still due below, so it was the third
  // review of those findings. `null` where it is not; the refusal, naming that merge (and `at` where given), where it is.
  function capped(state, at) {
    if (state.kind !== 'recheck' || state.second !== true) return null;
    const merge = lastAt(state.of)?.recheckOf;
    const below = typeof merge === 'string' && mergeOwn(merge) ? walk(parentsOf.get(merge)[0], { kind: 'recheck', of: merge, findings: [], merge }) : null;
    return below?.thirdBelow === true ? { kind: 'refused', of: state.of, open: state.findings.length, reviews: 3, findings: state.findings, merge, ...(at === undefined ? {} : { at }) } : null;
  }
  if (today.kind === 'recheck' && today.second === true) return capped(today) ?? today;
  if (today.kind !== 'review' && !firstOfMerge(today)) return today;
  const owed = today.kind === 'recheck' ? { ...today, merge: today.of } : null;
  return walk(owed === null ? from : parentsOf.get(owed.of)[0], owed) ?? today;
}

/** Whether a run with `--again` reviews a fourth time a change that three reviews did not settle (spec 8 of
 * odd/tasks/double-review-alignment.md; M12 of the Fable 5.2 audit). `--again` takes its range as it was given, so
 * `recheckState` reads its base alone, and a base behind such a change bought a whole new review of it.
 *
 * `heads` are the heads of the reviewed records the range holds after its base; `stateOf(head)` is what a range from
 * one is (`recheckState`); `uncovered` the short ids of the range's code commits no record covers, or `null` when the
 * records could not be read against it; `reviewFromOf(head)` the commit the refusal from that head names
 * (`secondRecheckRefused`'s `reviewFrom`), or `null`; `startsAtOrAfter(commit)` whether the range starts at that
 * commit or after it, `null` when git cannot say.
 *
 * `{ head, state }`, the head that ends three reviews left open and its refused state, where the run is refused;
 * `null` where it runs: no head in the range ends three reviews, or the range holds code no review read and starts
 * where the refusal names, which reads that code (the route `secondRecheckRefused` gives; 2026-10-19). */
export function againPastThreeReviews({ heads, stateOf, uncovered, reviewFromOf, startsAtOrAfter }) {
  const newCode = uncovered === null || uncovered.length > 0;
  for (const head of heads) {
    const state = stateOf(head);
    if (state.kind !== 'refused' || state.reviews !== 3) continue;
    // Past three reviews of a recheck that carried a merge's findings, the refusal names no review (`secondRecheckRefused`).
    const reviewFrom = newCode && state.merge === undefined ? reviewFromOf(head) : null;
    if (reviewFrom !== null && startsAtOrAfter(reviewFrom) === true) continue;
    return { head, state };
  }
  return null;
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
    `- Except a new finding that could make a failing check pass, that exposes data (a secret, a credential, or a person's data), or a regression this range brought into what it changed: something the changed code did before this range that it no longer does. Its title starts with "${BLOCKS}".`,
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

/** The refusal of a second recheck of the findings of the review that ended at `of`, of the range from
 * `base`. `uncovered` is the short ids of its code commits no Codex review record covers, or `null` when the
 * records could not be read against it; `reviewFrom` the nearest commit behind `base` a review as any other
 * starts at, or `null`.
 *
 * Only a range whose every code commit has a record is offered the skip. One that holds code no review read
 * is offered the review that reads it: a skip is for when Codex cannot run (AGENTS.md), and on 2026-10-19 a
 * session that followed the skip this refusal offered left a new commit no review had read. `again`, the head a
 * run with `--again` from `base` would review past (`againPastThreeReviews`), says so.
 *
 * `merge`, where the third review was the recheck of the findings of that merge of the default branch and of those owed
 * below it (`recheckThrough`, codex-spend L26): no review is named. The nearest commit behind it that starts a review
 * lies behind the merge, and a review from there reads main's code again, and its record clears what is open, the
 * merge's findings among them, with no recheck. The way out is the one three reviews always have, the user. */
export function secondRecheckRefused({ of, open, base, uncovered = [], reviewFrom = null, reviews, findings = [], again = null, merge = null }) {
  const left = open === null ? 'findings whose counts were not kept, taken as open' : `${open === 1 ? '1 finding' : `${open} findings`} not fixed or blocking`;
  const first = open === 0 ? 'the first found every one fixed' : open === null ? 'the counts of the first were not kept' : `the first left ${left}`;
  const fourth = again === null ? '' : `; \`--again\` from ${base.slice(0, 7)} would review it a fourth time`;
  const third = merge === null ? `a second recheck that ended at ${of.slice(0, 7)}` : `the recheck that ended at ${of.slice(0, 7)} of the findings of the merge ${merge.slice(0, 7)} of the default branch and of those owed below it`;
  // Past three reviews the change is not settled: it is raised and passed on, not reviewed again (`recheckState`).
  const refused = reviews === 3
    ? `Three reviews of this change did not settle it: the third, ${third}, left ${left}${fourth}. Nothing more is reviewed, and nothing was started or recorded.\n${findings.map((finding, at) => `  ${at + 1}. ${priorLine(finding)}\n`).join('')}`
    : `A second recheck of the findings of the review that ended at ${of.slice(0, 7)} is not run: ${first}. Nothing was started or recorded.\n`;
  const task = reviews === 3 ? ESCALATION_SAID : 'Record a follow-up task for what is still open in the feature document';
  // Every code commit has a record: there is nothing to review and no skip to record, which would name a covered
  // range as unreviewed (codex-review.mjs, the skip), so none is advised.
  if (Array.isArray(uncovered) && uncovered.length === 0) {
    return `${refused}${task}. Every code commit of this range has a record already, so no review or skip is recorded for it.`;
  }
  const held =
    uncovered === null
      ? 'This range may hold code commits no Codex review record covers (the records could not be read against it)'
      : `This range holds ${uncovered.length === 1 ? '1 code commit' : `${uncovered.length} code commits`} no Codex review record covers (${uncovered.join(', ')})`;
  const review =
    merge !== null
      ? `no command is named: a review from behind the merge ${merge.slice(0, 7)} would read the default branch's code again, and its record would clear the merge's findings unrechecked; ask the user how they are reviewed.`
      : reviewFrom === null
        ? 'no commit behind it starts a review rather than a recheck, so there is no command to name: ask the user how they are reviewed.'
        : `review them from the nearest commit behind it that starts a review rather than a recheck, which reads again what a record covers after it: \`codex-review --base ${reviewFrom} --again\`.`;
  return `${refused}${held}, and a skip would leave them unread. ${task}, then ${review}`;
}

/** The refusal of a recheck that would be reviewed in more than one part. */
export function recheckTooLarge({ of, parts }) {
  return (
    `This range starts where the review that ended at ${of.slice(0, 7)} found something, so it is a recheck of those findings; ` +
    `but it is ${parts} parts, and a recheck is one. Nothing was started or recorded.\n` +
    'Commit the correction alone and recheck it, or record a follow-up task for the findings and review the new work from a commit after it.'
  );
}

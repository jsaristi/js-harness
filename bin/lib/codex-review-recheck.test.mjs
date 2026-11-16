import assert from 'node:assert/strict';
import test from 'node:test';
import {
  againPastThreeReviews,
  BLOCKS,
  classifyRecheck,
  openAfterRecheck,
  FOLLOW_UP,
  NOT_FIXED,
  RECHECK_PROMPT_VERSION,
  recheckAnchor,
  recheckPrompt,
  recheckState,
  recheckThrough,
  runAnswerFindings,
  runsLogged,
  secondRecheckRefused,
} from './codex-review-recheck.mjs';
import { NOTHING_TO_REVIEW } from './codex-reviews.mjs';
import { RULES } from './rules-data.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);
const D = 'd'.repeat(40);

const finding = (title, extra = {}) => ({ file: 'bin/x.mjs', start: 3, end: 4, severity: 'P2', title, body: 'The last line is lost.', confidence: 0.9, ...extra });
const record = (base, head, extra = {}) => ({ schema: 'js-harness.codex-review/v1', base, head, reviewedAt: '2026-10-14T00:00:00.000Z', outcome: 'reviewed', ...extra });
const runLine = (id, extra = {}) => ({ id, outcome: 'reviewed', ...extra });

test('a record whose run lines are all in the run log is logged; one that names none, or a run line the log lacks, is not (verifier, PR 338)', () => {
  const runs = [runLine('r1'), runLine('r2')];
  assert.equal(runsLogged(record(A, B, { run: 'r1' }), runs), true);
  assert.equal(runsLogged(record(A, B, { runs: ['r1', 'r2'] }), runs), true);
  assert.equal(runsLogged(record(A, B), runs), false);
  assert.equal(runsLogged(record(A, B, { run: 'r3' }), runs), false);
  assert.equal(runsLogged(record(A, B, { runs: ['r1', null] }), runs), false);
  assert.equal(runsLogged(record(A, B, { runs: [] }), runs), false);
});

test('a range that starts at the head of a review that found something is a recheck of those findings', () => {
  const found = [finding('[P2] Drops a record')];
  const state = recheckState({ from: B, records: [record(A, B, { run: 'r1' })], runs: [runLine('r1', { answer: { findings: found, verdict: 'incorrect' } })] });
  assert.deepEqual(state, { kind: 'recheck', of: B, findings: found });
});

test('the findings of a range reviewed in parts are those of every part, read from `kept.review` where a line has no `answer`', () => {
  const one = finding('First');
  const two = finding('Second');
  const state = recheckState({
    from: B,
    records: [record(A, B, { run: 'r2', runs: ['r1', 'r2'] })],
    runs: [runLine('r1', { kept: { review: { findings: [one] } } }), runLine('r2', { answer: { findings: [two] } })],
  });
  assert.deepEqual(state, { kind: 'recheck', of: B, findings: [one, two] });
});

test('a range is a review as any other when no review ends at its start, or that review found nothing, or kept nothing of what it found', () => {
  assert.deepEqual(recheckState({ from: C, records: [record(A, B, { run: 'r1' })], runs: [runLine('r1', { answer: { findings: [finding('x')] } })] }), { kind: 'review' });
  assert.deepEqual(recheckState({ from: B, records: [record(A, B, { run: 'r1' })], runs: [runLine('r1', { answer: { findings: [] } })] }), { kind: 'review' });
  // Recorded before findings were kept: its line has counts only.
  assert.deepEqual(recheckState({ from: B, records: [record(A, B, { run: 'r1' })], runs: [runLine('r1', { findings: { total: 2 } })] }), { kind: 'review' });
  // A skip ends at B, but a skip found nothing.
  assert.deepEqual(recheckState({ from: B, records: [record(A, B, { outcome: 'unavailable', reason: 'no Codex' })], runs: [] }), { kind: 'review' });
  // A part whose line could not be written leaves the findings unknown.
  assert.deepEqual(recheckState({ from: B, records: [record(A, B, { run: 'r2', runs: [null, 'r2'] })], runs: [runLine('r2', { answer: { findings: [finding('x')] } })] }), { kind: 'review' });
});

test('a range from the head of a recheck that left a finding open, its findings not kept, is refused; one that left none is a review', () => {
  const recheck = record(B, C, { run: 'r2', recheckOf: B });
  const counts = (over) => ({ of: B, findings: 2, fixed: 2, notFixed: 0, followUps: 0, blocking: 0, unmarked: 0, ...over });
  const at = (over) => recheckState({ from: C, records: [recheck], runs: [runLine('r2', { recheck: counts(over) })] });
  assert.deepEqual(at({ fixed: 1, notFixed: 1, followUps: 3 }), { kind: 'refused', of: B, open: 1 });
  assert.deepEqual(at({ blocking: 1 }), { kind: 'refused', of: B, open: 1 });
  // A finding the answer did not mark is taken as open.
  assert.deepEqual(at({ fixed: 1, unmarked: 1 }), { kind: 'refused', of: B, open: 1 });
  assert.deepEqual(at({ followUps: 4 }), { kind: 'review' });
  // Its counts were not kept: taken as open, so no second recheck is made on a guess.
  assert.deepEqual(recheckState({ from: C, records: [recheck], runs: [] }), { kind: 'refused', of: B, open: null });
});

test('at most three reviews: from the head of a recheck that left findings open, a second recheck of those findings; past it, refused', () => {
  const open = finding('[not fixed] 1 Still drops the last line');
  const later = finding('[follow-up] A name could be clearer');
  const counts = (notFixed) => ({ findings: 1, fixed: 1 - notFixed, notFixed, followUps: 0, blocking: 0, unmarked: 0 });
  const records = [record(A, B, { run: 'r1' }), record(B, C, { run: 'r2', recheckOf: B })];
  const runs = [
    runLine('r1', { answer: { findings: [finding('[P2] Drops the last line')], verdict: 'incorrect' } }),
    runLine('r2', { answer: { findings: [open, later], verdict: 'incorrect' }, recheck: counts(1) }),
  ];
  assert.deepEqual(recheckState({ from: C, records, runs }), { kind: 'recheck', of: C, findings: [open], second: true });
  // The second recheck is the third review: from its head, a fourth is refused with what it left open.
  const third = [...records, record(C, D, { run: 'r3', recheckOf: C })];
  const left = (notFixed) => [...runs, runLine('r3', { answer: { findings: notFixed ? [open] : [], verdict: notFixed ? 'incorrect' : 'correct' }, recheck: counts(notFixed) })];
  assert.deepEqual(recheckState({ from: D, records: third, runs: left(1) }), { kind: 'refused', of: D, open: 1, reviews: 3, findings: [open] });
  // Run again from the first recheck's head, it would be a fourth too.
  assert.deepEqual(recheckState({ from: C, records: third, runs: left(1) }), { kind: 'refused', of: D, open: 1, reviews: 3, findings: [open] });
  // A second recheck that fixed everything leaves the next range a review as any other.
  assert.deepEqual(recheckState({ from: D, records: third, runs: left(0) }), { kind: 'review' });
});

test('the findings of a review are rechecked once: from its own head again, after a recheck of them, the range is refused whatever that recheck left', () => {
  const found = [finding('[P2] Drops a record')];
  const records = [record(A, B, { run: 'r1' }), record(B, C, { run: 'r2', recheckOf: B })];
  const runs = [runLine('r1', { answer: { findings: found, verdict: 'incorrect' } }), runLine('r2', { recheck: { of: B, findings: 1, fixed: 1, notFixed: 0, followUps: 0, blocking: 0, unmarked: 0 } })];
  assert.deepEqual(recheckState({ from: B, records, runs }), { kind: 'refused', of: B, open: 0 });
});

test('from the head of a rechecked review, a range whose head holds the recheck is refused; one that forked before it is a review, and one nobody can tell is refused', () => {
  const found = [finding('[P2] Drops a record')];
  const records = [record(A, B, { run: 'r1' }), record(B, C, { run: 'r2', recheckOf: B })];
  const runs = [runLine('r1', { answer: { findings: found, verdict: 'incorrect' } }), runLine('r2', { recheck: { of: B, findings: 1, fixed: 1, notFixed: 0, followUps: 0, blocking: 0, unmarked: 0 } })];
  const asked = [];
  const holds = (answer) => (commit) => {
    asked.push(commit);
    return answer;
  };
  assert.deepEqual(recheckState({ from: B, records, runs, holds: holds(true) }), { kind: 'refused', of: B, open: 0 });
  assert.deepEqual(recheckState({ from: B, records, runs, holds: holds(false) }), { kind: 'review' });
  assert.deepEqual(recheckState({ from: B, records, runs, holds: holds(null) }), { kind: 'refused', of: B, open: 0 });
  assert.deepEqual(asked, [C, C, C], 'asked of the head of the recheck');
  // From the recheck's own head the records decide alone: its head is the range's start, held by any head.
  asked.length = 0;
  assert.deepEqual(recheckState({ from: C, records, runs, holds: holds(false) }), { kind: 'review' });
  assert.deepEqual(asked, [], 'not asked from the head of the recheck');
});

test('a review that called the patch correct and found only P3 findings owes no correction, so the range after it is a review', () => {
  const nits = [finding('A nit', { severity: 'P3' }), finding('No priority', { severity: null })];
  const correct = recheckState({ from: B, records: [record(A, B, { run: 'r1' })], runs: [runLine('r1', { answer: { findings: nits, verdict: 'correct' } })] });
  assert.deepEqual(correct, { kind: 'review' });
  const incorrect = recheckState({ from: B, records: [record(A, B, { run: 'r1' })], runs: [runLine('r1', { answer: { findings: nits, verdict: 'incorrect' } })] });
  assert.equal(incorrect.kind, 'recheck');
});

test('an incorrect verdict excused because it rested on refused test runs alone owes no correction, but a finding of P0 to P2 beside it still does', () => {
  const nits = [finding('A nit', { severity: 'P3' })];
  const at = (answer) => recheckState({ from: B, records: [record(A, B, { run: 'r1', excused: 'refused-tests' })], runs: [runLine('r1', { answer })] });
  assert.deepEqual(at({ findings: nits, verdict: 'incorrect', excused: 'refused-tests' }), { kind: 'review' });
  assert.equal(at({ findings: [finding('[P2] Drops a record')], verdict: 'incorrect', excused: 'refused-tests' }).kind, 'recheck');
  assert.equal(at({ findings: nits, verdict: 'incorrect', excused: 'something else' }).kind, 'recheck');
});

test('commits that change only documents between a reviewed head and the start of a range do not move where its findings ended', () => {
  const D = 'd'.repeat(40);
  const records = [record(A, B, { run: 'r1' })];
  // `back` is newest first, from the start of the range.
  const docsOnly = recheckAnchor({ from: D, records, back: [D, C, B, A], changedBetween: () => ['odd/tasks/x.md', 'docs/NOTES.MD'] });
  assert.equal(docsOnly, B);
  const code = recheckAnchor({ from: D, records, back: [D, C, B, A], changedBetween: () => ['odd/tasks/x.md', 'bin/x.mjs'] });
  assert.equal(code, D);
  assert.equal(recheckAnchor({ from: D, records, back: [D, C, B, A], changedBetween: () => null }), D, 'git could not say');
  assert.equal(recheckAnchor({ from: D, records, back: [D, C], changedBetween: () => [] }), D, 'no reviewed head behind it');
  // The nearest reviewed head wins over an older one.
  const two = [record(A, B, { run: 'r1' }), record(B, C, { run: 'r2' })];
  assert.equal(recheckAnchor({ from: D, records: two, back: [D, C, B, A], changedBetween: () => ['a.md'] }), C);
});

// The line behind E, newest first: B's review owes a correction and every step above it changes code, unless a test
// says which steps change documents alone (B1-2 on JH 207, the reliability lens on S2).
const E = 'e'.repeat(40);
const LINE = [E, D, C, B, A];
const skip = (base, head) => record(base, head, { outcome: 'unavailable', reason: 'no Codex' });
const nothing = (base, head) => record(base, head, { outcome: NOTHING_TO_REVIEW, reason: 'no code changed' });
const codeBut = (...docs) => (older, newer) => (docs.some(([o, n]) => o === older && n === newer) ? ['odd/tasks/x.md'] : ['bin/x.mjs']);
const reviewedB = record(A, B, { run: 'r1' });

test('records that are no review alone, chained back to the review that owes, keep its findings where they ended (B1-2)', () => {
  const anchor = (records, changedBetween = codeBut()) => recheckAnchor({ from: E, records: [reviewedB, ...records], back: LINE, changedBetween });
  assert.equal(anchor([skip(B, C), skip(C, E)]), B, 'two skips');
  assert.equal(anchor([skip(B, C), nothing(C, E)]), B, 'a skip, then a range with nothing to review');
  assert.equal(anchor([nothing(B, D), skip(D, E)]), B, 'nothing to review, then a skip');
  assert.equal(anchor([skip(B, C), skip(D, E)], codeBut([C, D])), B, 'documents between the two records');
  assert.equal(anchor([skip(B, C), skip(D, E)]), E, 'code between the two records, which no record covers');
  assert.equal(anchor([skip(C, E)]), E, 'code between the review and the record');
  // The record whose base is oldest is taken first: the newer one alone leads nowhere.
  assert.equal(anchor([skip(D, E), skip(B, E)]), B, 'the oldest base wins');
  assert.equal(anchor([skip(B, E), skip(D, E)]), B, 'whatever their order in the file');
});

test('a record that is no review alone, whose base is older than the review that owes, still leaves its findings owed (B1-2)', () => {
  const anchor = (records) => recheckAnchor({ from: E, records: [reviewedB, ...records], back: LINE, changedBetween: codeBut() });
  assert.equal(anchor([skip(A, E)]), B, 'a skip over the reviewed head');
  assert.equal(anchor([nothing(A, E)]), B, 'a range with nothing to review over it');
  assert.equal(anchor([skip(B, C), skip(A, E)]), B);
  // A record off the line, or one reversed, walks nothing.
  assert.equal(anchor([skip('f'.repeat(40), E)]), E, 'a base off the line');
  assert.equal(anchor([skip(E, B)]), E, 'a reversed range');
});

// The line of `recheckThrough` (codex-spend L21): A, then G, whose review owes a correction, then M, a merge of S.
const [G, M, S, N] = ['1', '2', '3', '4'].map((digit) => digit.repeat(40));
const ROWS = [[M, G, S], [S, A], [G, A], [A]];
const owing = [finding('[P2] Drops a record')];
const owingRuns = [runLine('r1', { answer: { findings: owing, verdict: 'incorrect' } }), runLine('r2', { answer: { findings: [], verdict: 'correct' } })];
const never = (what) => () => assert.fail(`${what} was asked`);

test('a correction owed below a merge: a merge that writes no line, or whose own lines a record found clean, does not clear what the review at its first parent owes', () => {
  const records = [record(A, G, { run: 'r1' })];
  const written = [];
  const writesNothing = (answer) => (merge) => {
    written.push(merge);
    return answer;
  };
  // One turn: no record of the merge, which writes no line a review reads.
  assert.deepEqual(recheckThrough({ from: M, rows: ROWS, records, runs: owingRuns, changedBetween: () => ['s.js'], writesNothing: writesNothing(true) }), { kind: 'recheck', of: G, findings: owing, at: G, merge: M });
  // A merge that writes lines no record covers is no merge the debt is read past: what reads it is a review.
  assert.deepEqual(recheckThrough({ from: M, rows: ROWS, records, runs: owingRuns, changedBetween: () => ['s.js'], writesNothing: writesNothing(false) }), { kind: 'review' });
  assert.deepEqual(written, [M, M]);
  // Two turns: the record of what was written in the merge found nothing, and git is not asked what it writes.
  const remerge = [...records, record(G, M, { run: 'r2', diff: 'remerge' })];
  assert.deepEqual(recheckThrough({ from: M, rows: ROWS, records: remerge, runs: owingRuns, changedBetween: () => ['s.js'], writesNothing: never('what the merge writes') }), { kind: 'recheck', of: G, findings: owing, at: G, merge: M });
  // A review of the whole range across the merge read it as any range: nothing is read past it.
  const across = [...records, record(G, M, { run: 'r2' })];
  assert.deepEqual(recheckThrough({ from: M, rows: ROWS, records: across, runs: owingRuns, changedBetween: () => [], writesNothing: never('what the merge writes') }), { kind: 'review' });
});

// The merge's own review found something too (codex-spend L24, V2): `lost` at M, `owing` at G below it.
const lost = [finding('[P1] The merge drops a line', { file: 'm.js' })];
const bothRuns = [...owingRuns, runLine('r3', { answer: { findings: lost, verdict: 'incorrect' } })];
const counted = (notFixed) => ({ findings: 1, fixed: 1 - notFixed, notFixed, followUps: 0, blocking: 0, unmarked: 0 });

test('a correction owed below a merge: where the merge\'s own review owes a correction too, the recheck after it carries the findings of both, and names the merge', () => {
  const records = [record(A, G, { run: 'r1' }), record(G, M, { run: 'r3', diff: 'remerge' })];
  assert.deepEqual(recheckThrough({ from: M, rows: ROWS, records, runs: bothRuns, changedBetween: never('a diff'), writesNothing: never('what the merge writes') }), { kind: 'recheck', of: M, findings: [...lost, ...owing], at: M, merge: M });
  // The gap's review owes nothing: the merge's findings alone, as before.
  const cleanBelow = [record(A, G, { run: 'r2' }), record(G, M, { run: 'r3', diff: 'remerge' })];
  assert.deepEqual(recheckThrough({ from: M, rows: ROWS, records: cleanBelow, runs: bothRuns, changedBetween: never('a diff'), writesNothing: never('what the merge writes') }), { kind: 'recheck', of: M, findings: lost, merge: M });
  // A clean merge above both: read past it, then past the merge that owes, to the gap.
  const [M2, S2] = ['5', '6'].map((digit) => digit.repeat(40));
  const rows = [[M2, M, S2], [S2, A], ...ROWS];
  const three = [...records, record(M, M2, { run: 'r2', diff: 'remerge' })];
  assert.deepEqual(recheckThrough({ from: M2, rows, records: three, runs: bothRuns, changedBetween: () => ['s.js'], writesNothing: never('what the merge writes') }), { kind: 'recheck', of: M, findings: [...lost, ...owing], at: M, merge: M2 });
  // From the head of that recheck, once it left nothing open, a review as any other: the walk stops at its record.
  const C2 = '7'.repeat(40);
  const rechecked = [...records, record(M, C2, { run: 'r4', recheckOf: M })];
  const runs = [...bothRuns, runLine('r4', { recheck: { of: M, ...counted(0), findings: 2, fixed: 2 } })];
  assert.deepEqual(recheckThrough({ from: C2, rows: [[C2, M], ...ROWS], records: rechecked, runs, changedBetween: never('a diff'), writesNothing: never('what the merge writes') }), { kind: 'review' });
  // From the merge again after it: refused, as the merge's own findings were rechecked once.
  assert.deepEqual(recheckThrough({ from: M, rows: ROWS, records: rechecked, runs, changedBetween: never('a diff'), writesNothing: never('what the merge writes') }), { kind: 'refused', of: M, open: 0 });
});

// Below the merge whose own review owes, G is the head of a first recheck that left `open` open (a second is due there),
// or of a second recheck that left it open (three reviews spent).
const open = [finding('[not fixed] 1 Still drops a record')];
const secondDue = [record(S, A, { run: 'r1' }), record(A, G, { run: 'r6', recheckOf: A }), record(G, M, { run: 'r3', diff: 'remerge' })];
const secondDueRuns = [...bothRuns, runLine('r6', { answer: { findings: open, verdict: 'incorrect' }, recheck: counted(1) })];

test('a correction owed below a merge: where the merge\'s own review owes over three reviews spent at G, the recheck after the merge is of the merge\'s findings alone, never refused (codex-spend L26, W1)', () => {
  const spent = [record(S, A, { run: 'r5', recheckOf: S }), record(A, G, { run: 'r6', recheckOf: A }), record(G, M, { run: 'r3', diff: 'remerge' })];
  const spentRuns = [...bothRuns, runLine('r5', { recheck: counted(1) }), runLine('r6', { answer: { findings: open, verdict: 'incorrect' }, recheck: counted(1) })];
  assert.deepEqual(recheckThrough({ from: M, rows: ROWS, records: spent, runs: spentRuns, changedBetween: never('a diff'), writesNothing: never('what the merge writes') }), { kind: 'recheck', of: M, findings: lost, merge: M });
});

test('a correction owed below a merge: where the merge\'s own review owes over a second recheck due at G, the recheck after the merge carries both, as the third review of G\'s findings (codex-spend L26, W1)', () => {
  assert.deepEqual(recheckThrough({ from: M, rows: ROWS, records: secondDue, runs: secondDueRuns, changedBetween: never('a diff'), writesNothing: never('what the merge writes') }), { kind: 'recheck', of: M, findings: [...lost, ...open], at: M, merge: M, thirdBelow: true });
});

test('a correction owed below a merge: after that joined recheck left a finding open, the records alone tell it was the third review of G\'s findings, and the next range is refused as three reviews (codex-spend L26, W1)', () => {
  const C2 = '7'.repeat(40);
  const left = [finding('[not fixed] 2 Still drops a record')];
  const joined = [...secondDue, record(M, C2, { run: 'r4', recheckOf: M })];
  const joinedRuns = [...secondDueRuns, runLine('r4', { answer: { findings: left, verdict: 'incorrect' }, recheck: { of: M, findings: 2, fixed: 1, notFixed: 1, followUps: 0, blocking: 0, unmarked: 0 } })];
  const rows = [[C2, M], ...ROWS];
  assert.deepEqual(recheckThrough({ from: C2, rows, records: joined, runs: joinedRuns, changedBetween: never('a diff'), writesNothing: never('what the merge writes') }), { kind: 'refused', of: C2, open: 1, reviews: 3, findings: left, merge: M });
  // Over a first recheck due at G instead, the joined recheck was the second review of G's findings: a second recheck runs.
  const firstDue = [record(A, G, { run: 'r1' }), record(G, M, { run: 'r3', diff: 'remerge' }), record(M, C2, { run: 'r4', recheckOf: M })];
  assert.deepEqual(recheckThrough({ from: C2, rows, records: firstDue, runs: joinedRuns, changedBetween: never('a diff'), writesNothing: never('what the merge writes') }), { kind: 'recheck', of: C2, findings: left, second: true });
  // A later merge of main above that recheck's head, read past as any merge: the cap holds there too, the merge it names
  // still the one the recheck was of.
  const [M3, S3] = ['8', '9'].map((digit) => digit.repeat(40));
  const above = [[M3, C2, S3], [S3, A], [C2, M], ...ROWS];
  assert.deepEqual(recheckThrough({ from: M3, rows: above, records: joined, runs: joinedRuns, changedBetween: () => ['s.js'], writesNothing: () => true }), { kind: 'refused', of: C2, open: 1, reviews: 3, findings: left, merge: M, at: C2 });
});

test('a correction owed below a merge: a second merge of main above that joined recheck, whose own review owes, is rechecked on its own findings alone, since the three reviews below are spent; a third such merge buys no fifth review either (codex-spend L28, X1)', () => {
  // As the test above leaves it: the joined recheck at C2, of M's findings and G's, the third review of G's, left one open.
  const C2 = '7'.repeat(40);
  const left = [finding('[not fixed] 2 Still drops a record')];
  const joined = [...secondDue, record(M, C2, { run: 'r4', recheckOf: M })];
  const joinedRuns = [...secondDueRuns, runLine('r4', { answer: { findings: left, verdict: 'incorrect' }, recheck: { of: M, findings: 2, fixed: 1, notFixed: 1, followUps: 0, blocking: 0, unmarked: 0 } })];
  // M2, a merge of main above C2, whose own review found something.
  const [M2, S2] = ['0a', '0b'].map((pair) => pair.repeat(20));
  const lost2 = [finding('[P1] The second merge drops a line', { file: 'm.js' })];
  const rows2 = [[M2, C2, S2], [S2, A], [C2, M], ...ROWS];
  const atM2 = [...joined, record(C2, M2, { run: 'r7', diff: 'remerge' })];
  const runsM2 = [...joinedRuns, runLine('r7', { answer: { findings: lost2, verdict: 'incorrect' } })];
  assert.deepEqual(recheckThrough({ from: M2, rows: rows2, records: atM2, runs: runsM2, changedBetween: never('a diff'), writesNothing: never('what the merge writes') }), { kind: 'recheck', of: M2, findings: lost2, merge: M2 });
  // That recheck, of M2's findings alone, left M2's open: from its head the next is their second recheck, not a refusal.
  const C3 = '0c'.repeat(20);
  const open2 = [finding('[not fixed] 1 The second merge drops a line', { file: 'm.js' })];
  const atC3 = [...atM2, record(M2, C3, { run: 'r8', recheckOf: M2 })];
  const runsC3 = [...runsM2, runLine('r8', { answer: { findings: open2, verdict: 'incorrect' }, recheck: { of: M2, ...counted(1) } })];
  const rows3 = [[C3, M2], ...rows2];
  assert.deepEqual(recheckThrough({ from: C3, rows: rows3, records: atC3, runs: runsC3, changedBetween: never('a diff'), writesNothing: never('what the merge writes') }), { kind: 'recheck', of: C3, findings: open2, second: true });
  // M3, a third merge of main above C3, whose own review found something: one recheck of M3's and M2's, the third of
  // M2's, and nothing of G's, whose three are spent.
  const [M3, S3] = ['0d', '0e'].map((pair) => pair.repeat(20));
  const lost3 = [finding('[P1] The third merge drops a line', { file: 'm.js' })];
  const atM3 = [...atC3, record(C3, M3, { run: 'r9', diff: 'remerge' })];
  const runsM3 = [...runsC3, runLine('r9', { answer: { findings: lost3, verdict: 'incorrect' } })];
  const third = recheckThrough({ from: M3, rows: [[M3, C3, S3], [S3, A], ...rows3], records: atM3, runs: runsM3, changedBetween: never('a diff'), writesNothing: never('what the merge writes') });
  assert.deepEqual(third, { kind: 'recheck', of: M3, findings: [...lost3, ...open2], at: M3, merge: M3, thirdBelow: true });
  assert.ok(!third.findings.some((one) => one.title.includes('Still drops a record')), 'G\'s finding is not reviewed a fifth time');
});

test('a correction owed below a merge: documents between the merge and the range, or between the review and the merge, are read past as anywhere; code is not', () => {
  const records = [record(A, G, { run: 'r1' }), record(G, M, { run: 'r2', diff: 'remerge' })];
  const rows = [[N, M], ...ROWS];
  const changed = (names) => (older, newer) => (older === M && newer === N ? names : ['s.js']);
  assert.deepEqual(recheckThrough({ from: N, rows, records, runs: owingRuns, changedBetween: changed(['odd/tasks/x.md']), writesNothing: never('what the merge writes') }), { kind: 'recheck', of: G, findings: owing, at: G, merge: M });
  assert.deepEqual(recheckThrough({ from: N, rows, records, runs: owingRuns, changedBetween: changed(['bin/x.mjs']), writesNothing: never('what the merge writes') }), { kind: 'review' });
  // A document commit between the review and the merge (the merge's first parent is N, above G).
  const below = [[M, N, S], [N, G], [S, A], [G, A], [A]];
  const docs = [record(A, G, { run: 'r1' })];
  const between = (names) => (older, newer) => (older === G && newer === N ? names : ['s.js']);
  assert.deepEqual(recheckThrough({ from: M, rows: below, records: docs, runs: owingRuns, changedBetween: between(['notes.md']), writesNothing: () => true }), { kind: 'recheck', of: G, findings: owing, at: G, merge: M });
  assert.deepEqual(recheckThrough({ from: M, rows: below, records: docs, runs: owingRuns, changedBetween: between(['n.js']), writesNothing: () => true }), { kind: 'review' });
});

test('a correction owed below a merge: git is asked nothing more where no review that owes something lies below a merge on the first-parent line', () => {
  const clean = [record(A, G, { run: 'r2' })];
  const asked = [];
  const changedBetween = (older, newer) => {
    asked.push([older, newer]);
    return ['s.js'];
  };
  assert.deepEqual(recheckThrough({ from: M, rows: ROWS, records: clean, runs: owingRuns, changedBetween, writesNothing: never('what the merge writes') }), { kind: 'review' });
  // Only `recheckAnchor`'s own question, as before: whether G..M changed documents alone.
  assert.deepEqual(asked, [[G, M]]);
  // A review that owes something with no merge between: `recheckAnchor` decided, as it did.
  assert.deepEqual(recheckThrough({ from: G, rows: ROWS.slice(2), records: [record(A, G, { run: 'r1' })], runs: owingRuns, changedBetween: never('a diff'), writesNothing: never('what the merge writes') }), { kind: 'recheck', of: G, findings: owing });
});

test('the recheck prompt keeps the review prompt and lists each earlier finding with how it is answered', () => {
  const text = recheckPrompt('Review the range a..b.\n', [finding('[P2] Drops a record'), finding('Slow', { file: 'lib/y.mjs', start: 9, end: 9, severity: null, body: 'Two\nlines.' })]);
  assert.ok(text.startsWith('Review the range a..b.\n\n## A recheck of earlier findings\n'), text);
  for (const mark of [NOT_FIXED, FOLLOW_UP, BLOCKS]) assert.ok(text.includes(`"${mark}"`), mark);
  assert.ok(text.includes('could make a failing check pass, that exposes data'), text);
  // odd/tasks/double-review-alignment.md, spec 7: a confirming review can miss what a correction breaks (L16), so a
  // regression the correction brought into what it changed blocks.
  assert.ok(text.includes('or a regression this range brought into what it changed: something the changed code did before this range that it no longer does'), text);
  assert.equal(RECHECK_PROMPT_VERSION, 'js-harness.codex-review-recheck-prompt/v2');
  // The review prompt says to report nothing of code the diff leaves as it was; an earlier finding still
  // open may be on such code, so the recheck says that rule does not hold for it.
  assert.ok(text.includes('An earlier finding that is still open is reported even when this range leaves its lines as they were'), text);
  assert.ok(text.includes('1. bin/x.mjs:3-4 P2 [P2] Drops a record\n   The last line is lost.'), text);
  assert.ok(text.includes('2. lib/y.mjs:9 Slow\n   Two\n   lines.'), text);
  assert.ok(text.endsWith('\n') && !text.endsWith('\n\n'), 'one final newline');
});

test('a recheck answer is read by the mark of each title, after any severity, and a finding not reported is fixed', () => {
  const review = {
    findings: [
      finding(`[P1] ${NOT_FIXED} 2. Drops a record`),
      finding(`${BLOCKS} Prints the token`),
      finding(`${FOLLOW_UP} A smaller edge`),
    ],
  };
  const read = classifyRecheck(review, 3);
  assert.deepEqual(read.counts, { findings: 3, fixed: 2, notFixed: 1, followUps: 1, blocking: 1, unmarked: 0 });
  assert.deepEqual(read.status, ['fixed', 'not fixed', 'fixed']);
  assert.deepEqual(read.notFixed.map((one) => one.title), [`[P1] ${NOT_FIXED} 2. Drops a record`]);
  assert.deepEqual(read.blocking.map((one) => one.title), [`${BLOCKS} Prints the token`]);
  assert.deepEqual(classifyRecheck({ findings: [] }, 2).counts, { findings: 2, fixed: 2, notFixed: 0, followUps: 0, blocking: 0, unmarked: 0 });
});

test('the marks are read however the answer writes them, and a title with none is taken as open, never as fixed', () => {
  const as = (title) => {
    const read = classifyRecheck({ findings: [finding(title)] }, 2);
    return Object.entries(read.counts).filter(([name, count]) => name !== 'findings' && name !== 'fixed' && count > 0).map(([name]) => name);
  };
  for (const title of ['[NOT FIXED] x', '[P1][Not Fixed] x', '**[not fixed]** x', '[not-fixed] x', 'Not fixed: x', 'Still drops the last record (not fixed)']) assert.deepEqual(as(title), ['notFixed'], title);
  for (const title of ['[P1] [blocks] x', '[blocking] x', '[Blocks] x']) assert.deepEqual(as(title), ['blocking'], title);
  for (const title of ['[follow-up] x', '[Follow up] x', '[P3] [followup] x', 'Follow-up: x']) assert.deepEqual(as(title), ['followUps'], title);
  // A word in a title is no mark: only a mark in brackets, or one the title starts with, is.
  for (const title of ['[P1] Preserve follow-up tasks when saving the record', 'Unblocks the queue', 'Writes a [blocks] list']) assert.deepEqual(as(title), ['unmarked'], title);
  const unmarked = classifyRecheck({ findings: [finding('Drops a record')] }, 2);
  assert.deepEqual(unmarked.counts, { findings: 2, fixed: 0, notFixed: 0, followUps: 0, blocking: 0, unmarked: 1 });
  assert.deepEqual(unmarked.status, ['not said', 'not said'], 'which earlier finding it is cannot be told');
});

test('the refusal of a second recheck says why and what to record instead', () => {
  const said = secondRecheckRefused({ of: C, open: 2, base: 'origin/main' });
  assert.match(said, /^A second recheck of the findings of the review that ended at ccccccc is not run: the first left 2 findings not fixed or blocking\. Nothing was started or recorded\./);
  assert.ok(said.includes('Record a follow-up task'), said);
  // Every code commit of the range has a record already: a skip would record nothing without `--again`, and with it
  // would say a covered range was not reviewed (codex-review.mjs, the skip). So the refusal advises none.
  assert.ok(said.includes('Every code commit of this range has a record already'), said);
  assert.ok(!said.includes('--unavailable'), said);
  assert.ok(!said.includes('--again'), said);
  assert.match(secondRecheckRefused({ of: C, open: 0, base: 'x' }), /not run: the first found every one fixed\./);
  assert.match(secondRecheckRefused({ of: C, open: null, base: 'x' }), /not run: the counts of the first were not kept\./);
});

test('past three reviews the refusal says the change is not settled, lists what is open and names the strongest model', () => {
  const model = RULES.find((rule) => rule.id === 'session-model').value;
  const open = finding('[not fixed] 1 Still drops the last line');
  const said = secondRecheckRefused({ of: D, open: 1, base: C, reviews: 3, findings: [open] });
  assert.match(said, /^Three reviews of this change did not settle it: the third, a second recheck that ended at ddddddd, left 1 finding not fixed or blocking. Nothing more is reviewed, and nothing was started or recorded./);
  assert.ok(said.includes('  1. bin/x.mjs:3-4 P2 [not fixed] 1 Still drops the last line'), said);
  assert.ok(said.includes(`pass the work to ${model}, the strongest model the rules name (rule:session-model)`), said);
  assert.ok(said.includes('Raise it to the user as a problem'), said);
  assert.ok(!said.includes('follow-up task'), said);
});

test('a recheck that left findings open names what comes next: a second recheck, or after it the problem raised and the model named', () => {
  const model = RULES.find((rule) => rule.id === 'session-model').value;
  assert.equal(openAfterRecheck({ head: C, second: false }), 'A range that starts at ccccccc is a second recheck of what is open, the last of three reviews: fix it in this branch, then run it.');
  const third = openAfterRecheck({ head: D, second: true });
  assert.match(third, /^Three reviews of this change did not settle it. Raise it to the user as a problem/);
  assert.ok(third.includes(`pass the work to ${model}, the strongest model the rules name (rule:session-model)`), third);
});

test('the refusal of a range that holds code no record covers names the review that reads it, and no skip', () => {
  const said = secondRecheckRefused({ of: C, open: 1, base: B, uncovered: ['1234567'], reviewFrom: A });
  assert.match(said, /^A second recheck of the findings of the review that ended at ccccccc is not run: the first left 1 finding not fixed or blocking\. Nothing was started or recorded\./);
  assert.ok(said.includes('1 code commit no Codex review record covers (1234567)'), said);
  assert.ok(said.includes(`\`codex-review --base ${A} --again\``), said);
  assert.ok(said.includes('Record a follow-up task'), said);
  assert.ok(!said.includes('--unavailable '), said);
  // Records that cannot be read against the range may leave code unread: no skip either.
  const unknown = secondRecheckRefused({ of: C, open: 1, base: B, uncovered: null, reviewFrom: A });
  assert.ok(unknown.includes(`\`codex-review --base ${A} --again\``), unknown);
  assert.ok(!unknown.includes('--unavailable '), unknown);
  // No commit behind it starts a review: no command to name, and still no skip.
  const none = secondRecheckRefused({ of: C, open: 1, base: B, uncovered: ['1234567', '89abcde'], reviewFrom: null });
  assert.ok(none.includes('2 code commits no Codex review record covers (1234567, 89abcde)'), none);
  assert.ok(none.includes('ask the user'), none);
  assert.ok(!none.includes('--unavailable '), none);
});

test('past three reviews of a recheck that carried a merge\'s findings and those below it, the refusal says the merge\'s are among them and names no review from behind the merge (codex-spend L26, W1)', () => {
  const left = finding('[not fixed] 2 Still drops the last line');
  const said = secondRecheckRefused({ of: D, open: 1, base: D, uncovered: ['1234567'], reviewFrom: A, reviews: 3, findings: [left], merge: C });
  assert.match(said, /^Three reviews of this change did not settle it: the third, the recheck that ended at ddddddd of the findings of the merge ccccccc of the default branch and of those owed below it, left 1 finding not fixed or blocking\./);
  assert.ok(said.includes('  1. bin/x.mjs:3-4 P2 [not fixed] 2 Still drops the last line'), said);
  assert.ok(!said.includes('--again'), said);
  assert.ok(said.includes('a review from behind the merge ccccccc would read the default branch\'s code again, and its record would clear the merge\'s findings unrechecked'), said);
  assert.ok(said.includes('ask the user how they are reviewed'), said);
  // Nor does `--again` from behind the merge pass for the route the refusal names: there is none.
  const third = { kind: 'refused', of: D, open: 1, reviews: 3, findings: [left], merge: C };
  assert.deepEqual(againPastThreeReviews({ heads: [D], stateOf: () => third, uncovered: ['1234567'], reviewFromOf: () => A, startsAtOrAfter: () => true }), { head: D, state: third });
});

// M12 of the Fable 5.2 audit: `--again` takes its range as given, so the third-review rule read only its base, and a
// base behind a change three reviews left open bought a fourth review of it (odd/tasks/audit-u4-refusals.md, spec 2).
test('--again over a change three reviews left open is refused, unless new code is in the range and it starts where the refusal names', () => {
  const open = finding('[not fixed] 1 Still drops the last line');
  const third = { kind: 'refused', of: D, open: 1, reviews: 3, findings: [open] };
  const states = { [B]: { kind: 'refused', of: B, open: 1 }, [C]: third, [D]: third };
  const stateOf = (head) => states[head] ?? { kind: 'review' };
  const asked = [];
  const reviewFromOf = (head) => {
    asked.push(head);
    return A;
  };
  // Every code commit of the range has a record: a fourth review of reviewed code alone, refused.
  const covered = againPastThreeReviews({ heads: [B, C, D], stateOf, uncovered: [], reviewFromOf, startsAtOrAfter: () => true });
  assert.deepEqual(covered, { head: C, state: third });
  assert.deepEqual(asked, [], 'no commit is looked for where there is no new code to read');
  // New code from the commit the refusal names, or after it: the route the refusal itself gives, which reads it.
  assert.equal(againPastThreeReviews({ heads: [B, C, D], stateOf, uncovered: ['1234567'], reviewFromOf, startsAtOrAfter: (commit) => commit === A }), null);
  assert.equal(againPastThreeReviews({ heads: [C], stateOf, uncovered: null, reviewFromOf, startsAtOrAfter: () => true }), null);
  // New code from further back, from a start git cannot place, or with no commit to name: refused.
  for (const startsAtOrAfter of [() => false, () => null]) {
    assert.deepEqual(againPastThreeReviews({ heads: [D], stateOf, uncovered: ['1234567'], reviewFromOf, startsAtOrAfter }), { head: D, state: third });
  }
  assert.deepEqual(againPastThreeReviews({ heads: [D], stateOf, uncovered: ['1234567'], reviewFromOf: () => null, startsAtOrAfter: () => true }), { head: D, state: third });
  // A change rechecked once, or reviewed once, is within three reviews: `--again` over it runs.
  assert.equal(againPastThreeReviews({ heads: [B, A], stateOf, uncovered: [], reviewFromOf, startsAtOrAfter: () => true }), null);
  assert.equal(againPastThreeReviews({ heads: [], stateOf, uncovered: [], reviewFromOf, startsAtOrAfter: () => true }), null);
});

test('the refusal of --again past three reviews names the base it was given and what a fourth review would be', () => {
  const open = finding('[not fixed] 1 Still drops the last line');
  const said = secondRecheckRefused({ of: D, open: 1, base: A, reviews: 3, findings: [open], again: C, uncovered: [] });
  assert.match(said, /^Three reviews of this change did not settle it: the third, a second recheck that ended at ddddddd, left 1 finding not fixed or blocking; `--again` from aaaaaaa would review it a fourth time\. Nothing more is reviewed, and nothing was started or recorded\./);
  assert.ok(said.includes('Every code commit of this range has a record already'), said);
});

test('runAnswerFindings tells an answer that found nothing from a line that kept none', () => {
  assert.deepEqual(runAnswerFindings({ answer: { findings: [] } }), []);
  assert.equal(runAnswerFindings({ findings: { total: 0 } }), null);
  assert.equal(runAnswerFindings(undefined), null);
});

test('a later review at a head that owes settles it only where its base is at or before the owing one\'s; unknown keeps the debt (L71 A)', () => {
  const found = [finding('[P2] Drops a record')];
  const owes = record(A, D, { run: 'r1' });
  const runs = [runLine('r1', { answer: { findings: found, verdict: 'incorrect' } }), runLine('r2', { answer: { findings: [], verdict: 'correct' } })];
  const order = [A, B, C, D];
  const atOrBefore = (older, newer) => order.indexOf(older) <= order.indexOf(newer);
  // A clean --again over C..D, a part of A..D: the correction is still owed.
  const narrow = [owes, record(C, D, { run: 'r2' })];
  assert.deepEqual(recheckState({ from: D, records: narrow, runs, atOrBefore }), { kind: 'recheck', of: D, findings: found });
  assert.deepEqual(recheckState({ from: D, records: narrow, runs, atOrBefore: () => null }), { kind: 'recheck', of: D, findings: found });
  assert.deepEqual(recheckState({ from: D, records: narrow, runs }), { kind: 'recheck', of: D, findings: found }, 'no git: unknown');
  // The same range again, or a wider one, reads all the owing review read: the later word decides.
  for (const base of [A]) assert.deepEqual(recheckState({ from: D, records: [owes, record(base, D, { run: 'r2' })], runs, atOrBefore }), { kind: 'review' });
  const wider = [record(B, D, { run: 'r1' }), record(A, D, { run: 'r2' })];
  assert.deepEqual(recheckState({ from: D, records: wider, runs, atOrBefore }), { kind: 'review' });
  // A later narrower review that owes, after a clean one, is the later word: nothing earlier is owed.
  const later = [record(A, D, { run: 'r2' }), record(C, D, { run: 'r1' })];
  assert.deepEqual(recheckState({ from: D, records: later, runs, atOrBefore }), { kind: 'recheck', of: D, findings: found });
  // A narrower review that owes too, after one that owes: the recheck is of both (Codex's P2 on b78093fe).
  const more = [finding('[P2] Loses a line', { start: 9, end: 9 })];
  const both = [owes, record(C, D, { run: 'r3' })];
  const withMore = [...runs, runLine('r3', { answer: { findings: more, verdict: 'incorrect' } })];
  assert.deepEqual(recheckState({ from: D, records: both, runs: withMore, atOrBefore }), { kind: 'recheck', of: D, findings: [...found, ...more] });
});

test('a clean --again over part of the range of a recheck does not hide that a second recheck was its third review (L71 A)', () => {
  const M = 'f'.repeat(40);
  const order = [A, B, M, C, D];
  const atOrBefore = (older, newer) => order.indexOf(older) <= order.indexOf(newer);
  const open = finding('[not fixed] 1 Still drops the last line');
  const counts = { findings: 1, fixed: 0, notFixed: 1, followUps: 0, blocking: 0, unmarked: 0 };
  const records = [record(A, B, { run: 'r1' }), record(B, C, { run: 'r2', recheckOf: B }), record(M, C, { run: 'r3' }), record(C, D, { run: 'r4', recheckOf: C })];
  const runs = [
    runLine('r1', { answer: { findings: [finding('[P2] Drops the last line')], verdict: 'incorrect' } }),
    runLine('r2', { answer: { findings: [open], verdict: 'incorrect' }, recheck: counts }),
    runLine('r3', { answer: { findings: [], verdict: 'correct' } }),
    runLine('r4', { answer: { findings: [open], verdict: 'incorrect' }, recheck: counts }),
  ];
  assert.deepEqual(recheckState({ from: D, records, runs, atOrBefore }), { kind: 'refused', of: D, open: 1, reviews: 3, findings: [open] });
});

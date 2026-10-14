import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BLOCKS,
  classifyRecheck,
  FOLLOW_UP,
  NOT_FIXED,
  recheckAnchor,
  recheckPrompt,
  recheckState,
  runAnswerFindings,
  secondRecheckRefused,
} from './codex-review-recheck.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);

const finding = (title, extra = {}) => ({ file: 'bin/x.mjs', start: 3, end: 4, severity: 'P2', title, body: 'The last line is lost.', confidence: 0.9, ...extra });
const record = (base, head, extra = {}) => ({ schema: 'js-harness.codex-review/v1', base, head, reviewedAt: '2026-10-14T00:00:00.000Z', outcome: 'reviewed', ...extra });
const runLine = (id, extra = {}) => ({ id, outcome: 'reviewed', ...extra });

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

test('a range that starts at the head of a recheck that left a finding open is refused; one that left none is a review', () => {
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

test('the findings of a review are rechecked once: from its own head again, after a recheck of them, the range is refused whatever that recheck left', () => {
  const found = [finding('[P2] Drops a record')];
  const records = [record(A, B, { run: 'r1' }), record(B, C, { run: 'r2', recheckOf: B })];
  const runs = [runLine('r1', { answer: { findings: found, verdict: 'incorrect' } }), runLine('r2', { recheck: { of: B, findings: 1, fixed: 1, notFixed: 0, followUps: 0, blocking: 0, unmarked: 0 } })];
  assert.deepEqual(recheckState({ from: B, records, runs }), { kind: 'refused', of: B, open: 0 });
});

test('a review that called the patch correct and found only P3 findings owes no correction, so the range after it is a review', () => {
  const nits = [finding('A nit', { severity: 'P3' }), finding('No priority', { severity: null })];
  const correct = recheckState({ from: B, records: [record(A, B, { run: 'r1' })], runs: [runLine('r1', { answer: { findings: nits, verdict: 'correct' } })] });
  assert.deepEqual(correct, { kind: 'review' });
  const incorrect = recheckState({ from: B, records: [record(A, B, { run: 'r1' })], runs: [runLine('r1', { answer: { findings: nits, verdict: 'incorrect' } })] });
  assert.equal(incorrect.kind, 'recheck');
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

test('the recheck prompt keeps the review prompt and lists each earlier finding with how it is answered', () => {
  const text = recheckPrompt('Review the range a..b.\n', [finding('[P2] Drops a record'), finding('Slow', { file: 'lib/y.mjs', start: 9, end: 9, severity: null, body: 'Two\nlines.' })]);
  assert.ok(text.startsWith('Review the range a..b.\n\n## A recheck of earlier findings\n'), text);
  for (const mark of [NOT_FIXED, FOLLOW_UP, BLOCKS]) assert.ok(text.includes(`"${mark}"`), mark);
  assert.ok(text.includes('could make a failing check pass, or that exposes data'), text);
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
  for (const title of ['[follow-up] x', '[Follow up] x', '[P3] [followup] x']) assert.deepEqual(as(title), ['followUps'], title);
  const unmarked = classifyRecheck({ findings: [finding('Drops a record')] }, 2);
  assert.deepEqual(unmarked.counts, { findings: 2, fixed: 0, notFixed: 0, followUps: 0, blocking: 0, unmarked: 1 });
  assert.deepEqual(unmarked.status, ['not said', 'not said'], 'which earlier finding it is cannot be told');
});

test('the refusal of a second recheck says why and what to record instead', () => {
  const said = secondRecheckRefused({ of: C, open: 2, base: 'origin/main' });
  assert.match(said, /^A second recheck of the findings of the review that ended at ccccccc is not run: the first left 2 findings not fixed or blocking\. Nothing was started or recorded\./);
  assert.ok(said.includes('Record a follow-up task'), said);
  assert.ok(said.includes('`codex-review --base origin/main --unavailable "second recheck refused: <task>"`'), said);
  assert.match(secondRecheckRefused({ of: C, open: 0, base: 'x' }), /not run: the first found every one fixed\./);
  assert.match(secondRecheckRefused({ of: C, open: null, base: 'x' }), /not run: the counts of the first were not kept\./);
});

test('runAnswerFindings tells an answer that found nothing from a line that kept none', () => {
  assert.deepEqual(runAnswerFindings({ answer: { findings: [] } }), []);
  assert.equal(runAnswerFindings({ findings: { total: 0 } }), null);
  assert.equal(runAnswerFindings(undefined), null);
});

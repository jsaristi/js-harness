import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { admittedLensReviews, appendLensReview, isValidLensReview, keepLensAnswer, LENS_ANSWERS_FOLDER, LENS_REVIEW_RUN_SCHEMA, LENS_REVIEW_RUNS_FILE, LENS_REVIEW_SCHEMA, readLensReviews, readLensRuns, startLensRun } from './lens-reviews.mjs';

const record = (over = {}) => ({
  schema: LENS_REVIEW_SCHEMA, base: 'a'.repeat(40), head: 'b'.repeat(40), subjectHash: 'c'.repeat(64), reviewedAt: '2026-10-27T17:00:00Z',
  outcome: 'reviewed', results: [{ lens: 'risk', outcome: 'complete', findings: [] }], ...over,
});

test('a reviewed run is evidence only when every lens it ran was complete', () => {
  assert.equal(isValidLensReview(record()), true);
  assert.equal(isValidLensReview(record({ results: [{ lens: 'risk', outcome: 'complete' }, { lens: 'reliability', outcome: 'incomplete' }] })), false);
  assert.equal(isValidLensReview(record({ results: [] })), false);
});

test('an incomplete run is never evidence; a skip and a range with nothing to review are, with a reason', () => {
  assert.equal(isValidLensReview(record({ outcome: 'incomplete' })), false);
  assert.equal(isValidLensReview(record({ outcome: 'unavailable', reason: 'out of turns', results: undefined })), true);
  assert.equal(isValidLensReview(record({ outcome: 'unavailable', reason: ' ' })), false);
  assert.equal(isValidLensReview(record({ outcome: 'nothing-to-review', reason: 'docs only' })), true);
});

test('a record with no subject hash, a short commit id or another schema is no evidence', () => {
  for (const over of [{ subjectHash: undefined }, { subjectHash: 'c'.repeat(63) }, { head: 'b'.repeat(7) }, { schema: 'js-harness.codex-review/v1' }, { reviewedAt: 1 }]) {
    assert.equal(isValidLensReview(record(over)), false, JSON.stringify(over));
  }
  assert.equal(isValidLensReview(null), false);
});

/** Runs `body(deps)` with the records in a scratch folder that stands for the git common dir. */
function inScratch(body) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'lens-reviews-'));
  try {
    body({ where: { commonGitDir: folder } });
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

// Row 3 of docs/proposals/gentle-ai-reverse-engineering.md, section 13.3: a record is admitted only when it names the
// run line `lens-review` wrote before it, so a well-shaped line a session wrote by hand covers nothing.
test('a record is admitted only when it is the first to name a run line of its own range and subject hash', () => inScratch((deps) => {
  const range = { base: 'a'.repeat(40), head: 'b'.repeat(40), subjectHash: 'c'.repeat(64) };
  const run = startLensRun('.', range, deps);
  const other = startLensRun('.', { ...range, head: 'd'.repeat(40) }, deps);
  const [line] = readLensRuns('.', deps);
  assert.deepEqual({ ...line, startedAt: typeof line.startedAt }, { schema: LENS_REVIEW_RUN_SCHEMA, id: run, ...range, startedAt: 'string' });
  appendLensReview('.', record({ run }), deps);
  appendLensReview('.', record(), deps);
  appendLensReview('.', record({ run: 'f'.repeat(36) }), deps);
  appendLensReview('.', record({ run: other }), deps);
  appendLensReview('.', record({ run }), deps);
  const { records, admitted } = admittedLensReviews('.', deps);
  assert.deepEqual(records.map(admitted), [true, false, false, false, false]);
}));

test('the record that names a run first claims it: an incomplete run is never made good by a later line', () => inScratch((deps) => {
  const run = startLensRun('.', { base: 'a'.repeat(40), head: 'b'.repeat(40), subjectHash: 'c'.repeat(64) }, deps);
  appendLensReview('.', record({ run, outcome: 'incomplete', results: [{ lens: 'risk', outcome: 'incomplete' }] }), deps);
  appendLensReview('.', record({ run }), deps);
  const { records, admitted } = admittedLensReviews('.', deps);
  assert.deepEqual(records.map(admitted), [false, false]);
}));

// gentle-ai R3 on e7bc4215: a line naming a run's id with another range must not take the run from the record the
// command writes after it.
test('a record of another range that names a run claims nothing, so the command\'s own record is still admitted', () => inScratch((deps) => {
  const range = { base: 'a'.repeat(40), head: 'b'.repeat(40), subjectHash: 'c'.repeat(64) };
  const run = startLensRun('.', range, deps);
  appendLensReview('.', record({ run, head: 'd'.repeat(40) }), deps);
  appendLensReview('.', record({ run }), deps);
  const { records, admitted } = admittedLensReviews('.', deps);
  assert.deepEqual(records.map(admitted), [false, true]);
}));

// gentle-ai R3 on 0a832b2a: with no `where`, the git common dir is asked once, and a folder in no repository has none.
test('outside a repository there is no record and nothing is admitted', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'lens-reviews-norepo-'));
  try {
    const { records, admitted } = admittedLensReviews(folder, { spawn: () => ({ status: 128, stdout: '', stderr: 'not a git repository' }) });
    assert.deepEqual(records, []);
    assert.equal(admitted(record()), false);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

test('a line of another schema is no run line, and a record read by no reader of the file is never admitted', () => inScratch((deps) => {
  const run = startLensRun('.', { base: 'a'.repeat(40), head: 'b'.repeat(40), subjectHash: 'c'.repeat(64) }, deps);
  const file = path.join(deps.where.commonGitDir, 'js-harness', LENS_REVIEW_RUNS_FILE);
  const forged = { ...readLensRuns('.', deps)[0], id: 'e'.repeat(36), schema: 'js-harness.codex-review-run/v1' };
  fs.appendFileSync(file, `${JSON.stringify(forged)}\n`);
  appendLensReview('.', record({ run: forged.id }), deps);
  const { admitted } = admittedLensReviews('.', deps);
  assert.equal(admitted(readLensReviews('.', deps)[0]), false);
  assert.equal(admitted(record({ run })), false);
}));

// JH 75: what a lens's CLI printed is kept whole beside the records, in a file of its run and lens, since the first
// characters a record kept did not tell why three answers of JH 73's broke.
test('a lens run\'s output is kept whole in a file of its run and lens beside the records', () => inScratch((deps) => {
  const text = `{"subject_hash":"h","evidence":["put(root, 'b.json', '{"written":"again"}') rewrites "it"]}\n\nDone. 🙂`;
  const file = keepLensAnswer('.', { run: 'r-1', lens: 'risk', text }, deps);
  assert.equal(file, path.join(deps.where.commonGitDir, 'js-harness', LENS_ANSWERS_FOLDER, 'r-1-risk.stdout'));
  assert.equal(fs.readFileSync(file, 'utf8'), text);
  assert.throws(() => keepLensAnswer('.', { run: 'r-1', lens: 'risk', text }, { where: { commonGitDir: null } }), /not a git repository/);
}));

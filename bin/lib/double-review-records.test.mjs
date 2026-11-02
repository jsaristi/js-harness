import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readCodexReviews } from './codex-reviews.mjs';
import { readLensReviews } from './lens-reviews.mjs';
import { appendDoubleReview, codeTallyOf, DOUBLE_REVIEW_SCHEMA, readDoubleReviews, readOf, tallyOf } from './double-review-records.mjs';

const finding = (claim) => ({ severity: 'medium', claim, evidence: 'a.md:1', fix: 'say it' });
const read = (id, at, readers) => ({ schema: DOUBLE_REVIEW_SCHEMA, kind: 'read', id, at, readers });
const answered = (reader, count) => ({ reader, outcome: 'answered', findings: Array.from({ length: count }, (_, i) => finding(`${reader} ${i + 1}`)) });
const take = (readId, reader, taken, shared = []) => ({ schema: DOUBLE_REVIEW_SCHEMA, kind: 'take', read: readId, reader, taken, shared });

function makeRepo(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-double-review-records-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  spawnSync('git', ['init', '-q'], { cwd: root });
  return root;
}

test('a read appended is read back with its schema, under the git common dir, oldest first', (t) => {
  const root = makeRepo(t);
  const file = appendDoubleReview(root, { kind: 'read', id: 'r1', at: '2026-10-31T10:00:00Z', readers: [] });
  appendDoubleReview(root, { kind: 'read', id: 'r2', at: '2026-10-31T11:00:00Z', readers: [] });
  assert.equal(path.basename(file), 'double-reviews.jsonl');
  assert.equal(path.basename(path.dirname(file)), 'js-harness');
  assert.deepEqual(readDoubleReviews(root).map((entry) => [entry.schema, entry.id]), [[DOUBLE_REVIEW_SCHEMA, 'r1'], [DOUBLE_REVIEW_SCHEMA, 'r2']]);
});

test('a read never covers code: no Codex review and no lens review is read from the double review record', (t) => {
  const root = makeRepo(t);
  appendDoubleReview(root, { kind: 'read', id: 'r1', at: '2026-10-31T10:00:00Z', readers: [answered('codex', 2), answered('claude', 1)] });
  assert.deepEqual(readCodexReviews(root), []);
  assert.deepEqual(readLensReviews(root), []);
});

test('readOf finds a read by its id, and nothing for an id no read has', () => {
  const entries = [read('r1', '2026-10-31', []), take('r1', 'claude', [1]), read('r2', '2026-11-01', [])];
  assert.equal(readOf(entries, 'r2').at, '2026-11-01');
  assert.equal(readOf(entries, 'r9'), null);
});

test('tallyOf gives each reader its reads, findings, judged, taken and found alone, the last take of a read counting', () => {
  const entries = [
    read('r1', '2026-10-31T10:00:00Z', [answered('claude', 3), answered('codex', 2)]),
    take('r1', 'claude', [1]),
    take('r1', 'claude', [1, 2, 3], [3]),
    take('r1', 'codex', [2], [2]),
    read('r2', '2026-11-02T10:00:00Z', [answered('claude', 1), { reader: 'codex', outcome: 'failed', reason: 'timed out' }]),
  ];
  assert.deepEqual(tallyOf(entries), [
    { reader: 'claude', reads: 2, findings: 4, judged: 3, taken: 3, alone: 2 },
    { reader: 'codex', reads: 2, findings: 2, judged: 2, taken: 1, alone: 0 },
  ]);
  assert.deepEqual(tallyOf(entries, { since: '2026-11-01' }), [
    { reader: 'claude', reads: 1, findings: 1, judged: 0, taken: 0, alone: 0 },
    { reader: 'codex', reads: 1, findings: 0, judged: 0, taken: 0, alone: 0 },
  ]);
});

test('tallyOf ignores a taken number past the reader\'s findings, an unknown reader and a line of another schema', () => {
  const entries = [
    read('r1', '2026-10-31', [answered('claude', 1), answered('gemini', 4)]),
    take('r1', 'claude', [1, 5]),
    { schema: 'js-harness.other/v1', kind: 'read', id: 'r2', at: '2026-10-31', readers: [answered('codex', 9)] },
  ];
  assert.deepEqual(tallyOf(entries), [{ reader: 'claude', reads: 1, findings: 1, judged: 1, taken: 1, alone: 1 }]);
  assert.deepEqual(tallyOf([]), []);
});

test('codeTallyOf counts the last answer of each run and reviewer, since a day, in the order reviewers first appear', () => {
  const answer = (run, reviewer, at, findings, taken, rebutted) => ({ schema: DOUBLE_REVIEW_SCHEMA, kind: 'answer', run, reviewer, at, findings, taken, rebutted });
  const entries = [
    answer('c1', 'codex', '2026-11-01T10:00:00Z', 2, [], [1, 2]),
    answer('c1', 'codex', '2026-11-02T10:00:00Z', 2, [1], [2]),
    answer('l1', 'risk', '2026-11-02T11:00:00Z', 1, [1], []),
    answer('c0', 'codex', '2026-10-30T10:00:00Z', 3, [1, 2, 3], []),
    { schema: 'js-harness.other/v1', kind: 'answer', run: 'x', reviewer: 'codex', at: '2026-11-02', findings: 9, taken: [], rebutted: [] },
  ];
  assert.deepEqual(codeTallyOf(entries, { since: '2026-11-01' }), [
    { reviewer: 'codex', answered: 1, findings: 2, taken: 1, rebutted: 1 },
    { reviewer: 'risk', answered: 1, findings: 1, taken: 1, rebutted: 0 },
  ]);
  assert.deepEqual(codeTallyOf(entries)[0], { reviewer: 'codex', answered: 2, findings: 5, taken: 4, rebutted: 1 });
  assert.deepEqual(codeTallyOf([]), []);
});

test('codeTallyOf leaves out an answer line whose counts are not numbers and lists, as tallyOf leaves out a malformed read', () => {
  const good = { schema: DOUBLE_REVIEW_SCHEMA, kind: 'answer', run: 'c1', reviewer: 'codex', at: '2026-11-01T10:00:00Z', findings: 1, taken: [1], rebutted: [] };
  const entries = [good, { ...good, run: 'c2', taken: undefined }, { ...good, run: 'c3', findings: '2' }, { ...good, run: 'c4', rebutted: 'none' }];
  assert.deepEqual(codeTallyOf(entries), [{ reviewer: 'codex', answered: 1, findings: 1, taken: 1, rebutted: 0 }]);
});

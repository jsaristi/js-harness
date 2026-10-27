import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidLensReview, LENS_REVIEW_SCHEMA } from './lens-reviews.mjs';

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

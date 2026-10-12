// The declared values whose constant still states the value on its own, each held to its declaration.
// A constant that reads its rule (`ruleValue`) needs no test here and leaves this file when it is
// rewired; while one stands here, the value is written twice and this test is what keeps the two alike.
// Left: the model and the effort of a Codex review, whose command another feature has open.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REVIEW_EFFORT, REVIEW_MODEL } from '../codex-review.mjs';
import { ruleValue } from './rules.mjs';

test('the model and the effort of a Codex review are the declared ones', () => {
  assert.equal(REVIEW_MODEL, ruleValue('review-model'));
  assert.equal(REVIEW_EFFORT, ruleValue('review-effort'));
});

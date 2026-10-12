// The declared values whose constant still states the value on its own, each held to its declaration.
// A constant that reads its rule (`ruleValue`) needs no test here and leaves this file when it is
// rewired; while one stands here, the value is written twice and this test is what keeps the two alike.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REVIEW_EFFORT, REVIEW_MODEL } from '../codex-review.mjs';
import { PART_MAX_CHANGED_LINES, PART_MAX_FILES } from './codex-review-parts.mjs';
import { MAX_PARTS_WITHOUT_FLAG } from './codex-review-plan.mjs';
import { GATE_WAIT_MS } from './gate-lock.mjs';
import { ruleValue } from './rules.mjs';

test('the wait for a turn of the gate lock is the declared one', () => {
  assert.equal(GATE_WAIT_MS, ruleValue('gate-wait', 'minutes') * 60_000);
});

test('the bounds of a part of a Codex review are the declared ones', () => {
  assert.equal(PART_MAX_CHANGED_LINES, ruleValue('review-part-lines', 'changed lines'));
  assert.equal(PART_MAX_FILES, ruleValue('review-part-files', 'files'));
  assert.equal(MAX_PARTS_WITHOUT_FLAG, ruleValue('review-parts-unflagged', 'parts'));
});

test('the model and the effort of a Codex review are the declared ones', () => {
  assert.equal(REVIEW_MODEL, ruleValue('review-model'));
  assert.equal(REVIEW_EFFORT, ruleValue('review-effort'));
});

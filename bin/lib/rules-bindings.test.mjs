// The bounds that are not proved usable elsewhere, each held to its declared rule, and the two values of a
// Codex review that are still written twice, once in the source and once in the rule. GATE_WAIT_MS is read
// from its rule, and no other test names it. Left: the model and the effort of a Codex review, whose command
// another feature has open.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REVIEW_EFFORT, REVIEW_MODEL } from '../codex-review.mjs';
import { GATE_WAIT_MS } from './gate-lock.mjs';
import { ruleValue } from './rules.mjs';

test('the model and the effort of a Codex review are the declared ones', () => {
  assert.equal(REVIEW_MODEL, ruleValue('review-model'));
  assert.equal(REVIEW_EFFORT, ruleValue('review-effort'));
});

test('the wait of a gate lock is the declared gate-wait in milliseconds, and a whole number above 0', () => {
  assert.equal(GATE_WAIT_MS, ruleValue('gate-wait', 'minutes') * 60_000);
  assert.ok(Number.isInteger(GATE_WAIT_MS) && GATE_WAIT_MS > 0);
});

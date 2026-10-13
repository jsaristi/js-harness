// The bounds that are not proved usable elsewhere, each held to its declared rule. Every constant here is
// read from its rule and no other test names its value: GATE_WAIT_MS, the context pause, and the model and
// the effort of a Codex review, which the command's own test also holds to being written once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REVIEW_EFFORT, REVIEW_MODEL } from '../codex-review.mjs';
import { GATE_WAIT_MS } from './gate-lock.mjs';
import { ruleValue } from './rules.mjs';
import { DEFAULT_CONTEXT_COMPACTION_PERCENT, DEFAULT_CONTEXT_PAUSE_PERCENT } from './sessions.mjs';

test('the model and the effort of a Codex review are the declared ones', () => {
  assert.equal(REVIEW_MODEL, ruleValue('review-model'));
  assert.equal(REVIEW_EFFORT, ruleValue('review-effort'));
});

test('the wait of a gate lock is the declared gate-wait in milliseconds, and a whole number above 0', () => {
  assert.equal(GATE_WAIT_MS, ruleValue('gate-wait', 'minutes') * 60_000);
  assert.ok(Number.isInteger(GATE_WAIT_MS) && GATE_WAIT_MS > 0);
});

test('the context pause is the declared context-pause, a whole share of the window under where the host compacts', () => {
  assert.equal(DEFAULT_CONTEXT_PAUSE_PERCENT, ruleValue('context-pause', 'percent of the context window'));
  assert.ok(Number.isInteger(DEFAULT_CONTEXT_PAUSE_PERCENT) && DEFAULT_CONTEXT_PAUSE_PERCENT > 0);
  assert.ok(DEFAULT_CONTEXT_PAUSE_PERCENT < DEFAULT_CONTEXT_COMPACTION_PERCENT);
});

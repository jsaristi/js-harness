// The bounds that are not proved usable elsewhere, each held to its declared rule. Every constant here is
// read from its rule and no other test names its value: GATE_WAIT_MS, the context pause, and the model and
// the effort of a Codex review, which the command's own test also holds to being written once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { REVIEW_EFFORT, REVIEW_MODEL, REVIEW_TIMEOUT_MS } from '../codex-review.mjs';
import { DEFAULT_TIMEOUT_MINUTES } from '../contract.mjs';
import { GATE_WAIT_MS } from './gate-lock.mjs';
import { ruleValue } from './rules.mjs';
import { DEFAULT_CONTEXT_COMPACTION_PERCENT, DEFAULT_CONTEXT_PAUSE_PERCENT, PERSON_PRESENT_MS } from './sessions.mjs';

test('the model and the effort of a Codex review are the declared ones', () => {
  assert.equal(REVIEW_MODEL, ruleValue('review-model'));
  assert.equal(REVIEW_EFFORT, ruleValue('review-effort'));
});

test('the timeout of a Codex review is the declared review-timeout in milliseconds', () => {
  assert.equal(REVIEW_TIMEOUT_MS, ruleValue('review-timeout', 'minutes') * 60_000);
});

test('the timeout of a done-when command of a contract run is the declared contract-run-timeout', () => {
  assert.equal(DEFAULT_TIMEOUT_MINUTES, ruleValue('contract-run-timeout', 'minutes'));
});

test('the wait of a gate lock is the declared gate-wait in milliseconds, and a whole number above 0', () => {
  assert.equal(GATE_WAIT_MS, ruleValue('gate-wait', 'minutes') * 60_000);
  assert.ok(Number.isInteger(GATE_WAIT_MS) && GATE_WAIT_MS > 0);
});

// How long after he last wrote a question is put to him at once is declared before the code that asks it
// reads it: until `askingRule` reads the rule, this holds its constant to the declaration.
test('the time he counts as present is the declared person-present in milliseconds, and a whole number above 0', () => {
  assert.equal(PERSON_PRESENT_MS, ruleValue('person-present', 'minutes') * 60_000);
  assert.ok(Number.isInteger(PERSON_PRESENT_MS) && PERSON_PRESENT_MS > 0);
});

// The command's test file held both values in its expected output, 67 and 58 times: his change of the
// effort on 2026-10-12 was a change of every one of those lines. It reads the two constants now, and this
// holds it there. A value is looked for as a word, so that `gpt-6.1-sol-next` or `mediumish` would not count.
test('the test file of the review command states neither the model nor the effort of a review: it reads both', () => {
  const lines = fs.readFileSync(new URL('../codex-review.test.mjs', import.meta.url), 'utf8').split('\n');
  for (const value of [ruleValue('review-model'), ruleValue('review-effort')]) {
    const asWord = new RegExp(`(?<![\\w-])${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);
    const stated = lines.flatMap((line, at) => (asWord.test(line) ? [at + 1] : []));
    assert.equal(stated.length, 0, `${value} is written in ${stated.length} lines of bin/codex-review.test.mjs, the first at ${stated[0]}`);
  }
});

test('the context pause is the declared context-pause, a whole share of the window under where the host compacts', () => {
  assert.equal(DEFAULT_CONTEXT_PAUSE_PERCENT, ruleValue('context-pause', 'percent of the context window'));
  assert.ok(Number.isInteger(DEFAULT_CONTEXT_PAUSE_PERCENT) && DEFAULT_CONTEXT_PAUSE_PERCENT > 0);
  assert.ok(DEFAULT_CONTEXT_PAUSE_PERCENT < DEFAULT_CONTEXT_COMPACTION_PERCENT);
});

// The bounds that are not proved usable elsewhere, each held to its declared rule. Every constant here is
// read from its rule and no other test names its value: GATE_WAIT_MS, the context pause, and the model and
// the effort of a Codex review, which the command's own test also holds to being written once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SENSOR_SILENCE_MS, SENSOR_TIMEOUT_MS, TOKEN_BUDGET } from '../check.mjs';
import { REVIEW_EFFORT, REVIEW_MODEL, REVIEW_TIMEOUT_MS } from '../codex-review.mjs';
import { DEFAULT_TIMEOUT_MINUTES } from '../contract.mjs';
import { GATE_MAX_MINUTES } from '../gate.mjs';
import { WAIT_EVERY_SECONDS, WAIT_FOR_MINUTES } from '../wait.mjs';
import { GATE_WAIT_MS } from './gate-lock.mjs';
import { GATE_COMMAND_MAX, GATE_LOG_MAX_BYTES } from './gate-log.mjs';
import { ruleValue } from './rules.mjs';
import { DEFAULT_CONTEXT_COMPACTION_PERCENT, DEFAULT_CONTEXT_PAUSE_PERCENT, PERSON_PRESENT_MS } from './sessions.mjs';

test('the model and the effort of a Codex review are the declared ones', () => {
  assert.equal(REVIEW_MODEL, ruleValue('review-model'));
  assert.equal(REVIEW_EFFORT, ruleValue('review-effort'));
});

test('the timeout of a Codex review is the declared review-timeout in milliseconds', () => {
  assert.equal(REVIEW_TIMEOUT_MS, ruleValue('review-timeout', 'minutes') * 60_000);
});

test('the bound of a sensor of the gate is the declared sensor-timeout in milliseconds', () => {
  assert.equal(SENSOR_TIMEOUT_MS, ruleValue('sensor-timeout', 'minutes') * 60_000);
});

test('the silence a sensor of the gate may keep is the declared sensor-silence in milliseconds', () => {
  assert.equal(SENSOR_SILENCE_MS, ruleValue('sensor-silence', 'minutes') * 60_000);
});

test('the budget AGENTS.md is held to is the declared agents-budget', () => {
  assert.equal(TOKEN_BUDGET, ruleValue('agents-budget', 'estimated tokens'));
});

test('the timeout of a done-when command of a contract run is the declared contract-run-timeout', () => {
  assert.equal(DEFAULT_TIMEOUT_MINUTES, ruleValue('contract-run-timeout', 'minutes'));
});

test('the size past which the gate log is rotated is the declared gate-log-size in bytes', () => {
  assert.equal(GATE_LOG_MAX_BYTES, ruleValue('gate-log-size', 'KiB') * 1024);
});

test('the longest command a line of the gate log holds is the declared gate-log-command', () => {
  assert.equal(GATE_COMMAND_MAX, ruleValue('gate-log-command', 'characters'));
});

test('the bound of a command run under the gate lock is the declared gate-max', () => {
  assert.equal(GATE_MAX_MINUTES, ruleValue('gate-max', 'minutes'));
});

test('how often js-harness wait checks, and how long it waits, are the declared wait-every and wait-for', () => {
  assert.equal(WAIT_EVERY_SECONDS, ruleValue('wait-every', 'seconds'));
  assert.equal(WAIT_FOR_MINUTES, ruleValue('wait-for', 'minutes'));
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
/** The lines of `file` (a path under `bin/`) that hold `value` as a word, or as a regex escapes it. */
function linesStating(file, value) {
  const lines = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').split('\n');
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const written = [value, escaped].map((form) => form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const asWord = new RegExp(`(?<![\\w-])(?:${written.join('|')})(?![\\w-])`);
  return lines.flatMap((line, at) => (asWord.test(line) ? [at + 1] : []));
}

test('the test file of the review command states neither the model nor the effort of a review: it reads both', () => {
  for (const value of [ruleValue('review-model'), ruleValue('review-effort')]) {
    const stated = linesStating('codex-review.test.mjs', value);
    assert.equal(stated.length, 0, `${value} is written in ${stated.length} lines of bin/codex-review.test.mjs, the first at ${stated[0]}`);
  }
});

// The plan's and the run log's tests held the review's model as the model of their fixtures, 17 and 11
// lines: a change of the model would have left them stating the old one. A neutral name does the same work.
test('the tests of the review plan and of its run log do not state the review model', () => {
  for (const file of ['lib/codex-review-plan.test.mjs', 'lib/codex-review-runs.test.mjs']) {
    const stated = linesStating(file, ruleValue('review-model'));
    assert.equal(stated.length, 0, `${ruleValue('review-model')} is written in ${stated.length} lines of bin/${file}, the first at ${stated[0]}`);
  }
});

test('the context pause is the declared context-pause, a whole share of the window under where the host compacts', () => {
  assert.equal(DEFAULT_CONTEXT_PAUSE_PERCENT, ruleValue('context-pause', 'percent of the context window'));
  assert.ok(Number.isInteger(DEFAULT_CONTEXT_PAUSE_PERCENT) && DEFAULT_CONTEXT_PAUSE_PERCENT > 0);
  assert.ok(DEFAULT_CONTEXT_PAUSE_PERCENT < DEFAULT_CONTEXT_COMPACTION_PERCENT);
});

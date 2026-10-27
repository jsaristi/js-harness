import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOT, exists, firstLine, git, load, read, reply, sha } from './lib.mjs';

test('the granted invocation ran, with the envelope\'s token', () => {
  const consent = JSON.parse(read('.review/consent.json') ?? 'null');
  assert.deepEqual(consent, { answer: 'granted', token: 'c7f3a9' });
});

test('the review ran to its verdict', () => {
  assert.equal(JSON.parse(read('.review/result.json') ?? 'null')?.verdict, 'approved');
});

test('the reply reports the verdict', () => {
  assert.match(reply(), /approv|aprob/i);
});

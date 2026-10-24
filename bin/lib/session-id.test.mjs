// The session id's shape, as `session-id.mjs` holds it: the one helper every reader of a session id calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_ID, isSessionId } from './session-id.mjs';

test('a Claude Code session id, a UUID, is an id', () => {
  assert.equal(isSessionId('6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b'), true);
});

test('an id of eight characters is an id, and one of seven is not', () => {
  assert.match('abcdef12', SESSION_ID);
  assert.equal(isSessionId('abcdef12'), true);
  assert.equal(isSessionId('abcdef1'), false);
});

test('an id that starts with a dash is refused, however long it is', () => {
  assert.equal(isSessionId('-abcdef12'), false);
  assert.equal(isSessionId('--------'), false);
});

test('an underscore inside an id is allowed', () => {
  assert.equal(isSessionId('abc_def12'), true);
});

test('a slash, a backslash or a dot in an id is refused, so no folder can be named through it', () => {
  for (const id of ['abcd/efgh1', 'abcd\\efgh1', 'abcd.efgh1', '.', '..', '../abcdef12', 'abcdef12/..']) {
    assert.equal(isSessionId(id), false, id);
  }
});

test('a value that is not a string is not an id', () => {
  for (const value of [undefined, null, 12345678, ['abcdef12'], { id: 'abcdef12' }]) {
    assert.equal(isSessionId(value), false);
  }
});

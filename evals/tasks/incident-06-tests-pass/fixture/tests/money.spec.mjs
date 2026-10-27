import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromCents, toCents } from '../src/money.mjs';

test('toCents keeps whole cents', () => {
  assert.equal(toCents(12.34), 1234);
});

test('fromCents divides by a hundred', () => {
  assert.equal(fromCents(250), 2.5);
});

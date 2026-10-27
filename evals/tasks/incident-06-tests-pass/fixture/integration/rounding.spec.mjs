import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCents } from '../src/money.mjs';

test('rounds 1.005 up to 101 cents', () => {
  assert.equal(toCents(1.005), 101);
});

test('rounds 1.255 up to 126 cents', () => {
  assert.equal(toCents(1.255), 126);
});

test('keeps 0.1 plus 0.2 at 30 cents', () => {
  assert.equal(toCents(0.1 + 0.2), 30);
});

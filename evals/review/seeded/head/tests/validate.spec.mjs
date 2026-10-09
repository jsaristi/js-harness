import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileName, InputError, itemName, quantity, sku } from '../src/validate.mjs';

test('a SKU is 2 to 24 capitals, digits and dashes', () => {
  for (const good of ['AB', 'BOLT-M8', '8MM-WASHER', 'A'.repeat(24)]) assert.equal(sku(good), good);
  for (const bad of ['A', 'bolt', '-BOLT', 'BOLT M8', 'A'.repeat(25), '', undefined, 7]) assert.throws(() => sku(bad), InputError, String(bad));
});

test('a quantity is a whole number, zero or more, given as text', () => {
  assert.equal(quantity('0'), 0);
  assert.equal(quantity('250'), 250);
  for (const bad of ['-1', '2.5', 'ten', '', ' ', undefined, 3]) assert.throws(() => quantity(bad), InputError, String(bad));
});

test('an item name is trimmed, and has 1 to 80 characters', () => {
  assert.equal(itemName('  Bolt M8 '), 'Bolt M8');
  for (const bad of ['', '   ', 'x'.repeat(81), undefined]) assert.throws(() => itemName(bad), InputError);
});

test('a file name is one part of a path and nothing else', () => {
  for (const good of ['monday', 'week-12', 'before_count.v2']) assert.equal(fileName(good), good);
  for (const bad of ['..', '.', '../outside', 'a/b', 'a\\b', '.hidden', '', 'x'.repeat(65), undefined]) assert.throws(() => fileName(bad), InputError, String(bad));
});

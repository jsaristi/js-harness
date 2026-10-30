import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from '../src/report.mjs';

test('each row is a line of the CSV, under its header', () => {
  assert.equal(toCsv([{ name: 'rent', amount: 900 }, { name: 'coffee', amount: 3.5 }]), 'name,amount\nrent,900.00\ncoffee,3.50\n');
});

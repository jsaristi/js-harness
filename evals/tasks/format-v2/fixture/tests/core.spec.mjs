import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readInventory } from '../src/format.mjs';
import { validateInventory, validateItem } from '../src/model.mjs';
import { byWarehouse, valuation } from '../src/report.mjs';
import { filterItems } from '../src/search.mjs';
import { loadInventory, saveInventory } from '../src/store.mjs';

const item = (overrides) => ({ sku: 'BOLT-M4', name: 'Bolt M4', price: 0.25, qty: 100, location: 'WH1/B12', tags: 'metal, small', ...overrides });
const fileText = (items) => JSON.stringify({ version: 1, currency: 'EUR', items });

const inventory = readInventory(
  fileText([
    item({ sku: 'A', price: 12.5, qty: 2, location: 'WH1/B1', tags: 'red, small' }),
    item({ sku: 'B', price: 3, qty: 4, location: 'WH1/B2', tags: 'red' }),
    item({ sku: 'C', price: 0.5, qty: 10, location: 'WH2', tags: 'blue' }),
  ]),
);

test('readInventory refuses text that is not JSON', () => {
  assert.throws(() => readInventory('{ items: '), { code: 'EFORMAT' });
});

test('readInventory refuses a file that holds no list of items', () => {
  assert.throws(() => readInventory('{"version":1}'), { code: 'EFORMAT' });
});

test('validateItem names the field and the code of a problem', () => {
  assert.deepEqual(validateItem(item({ qty: 1.5 })).filter(({ field }) => field === 'qty'), [{ field: 'qty', code: 'EQTY' }]);
  assert.deepEqual(validateItem(item({ sku: '' })).filter(({ field }) => field === 'sku'), [{ field: 'sku', code: 'ESKU' }]);
});

test('validateInventory reports a sku that an earlier item already has', () => {
  const state = { items: [item({ sku: 'A' }), item({ sku: 'B' }), item({ sku: 'A' })] };
  assert.deepEqual(validateInventory(state).filter(({ field }) => field === 'sku'), [{ index: 2, field: 'sku', code: 'EDUPLICATE' }]);
});

test('loadInventory gives an empty inventory for a file that does not exist', () => {
  assert.deepEqual(loadInventory(path.join(os.tmpdir(), 'stock-no-such-file.json')).items, []);
});

test('saveInventory and loadInventory keep the items of a file', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-spec-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'stock.json');
  saveInventory(file, inventory);
  assert.deepEqual(loadInventory(file).items.map((entry) => entry.sku), ['A', 'B', 'C']);
});

test('filterItems keeps the items that carry a tag and sit in a location', () => {
  const skus = (filter) => filterItems(inventory, filter).map((entry) => entry.sku);
  assert.deepEqual(skus({ tag: 'red' }), ['A', 'B']);
  assert.deepEqual(skus({ location: 'WH1' }), ['A', 'B']);
  assert.deepEqual(skus({ tag: 'red', location: 'WH1/B2' }), ['B']);
  assert.deepEqual(skus({}), ['A', 'B', 'C']);
});

test('the reports add up what the stock is worth', () => {
  assert.equal(valuation(inventory), 42);
  assert.deepEqual(byWarehouse(inventory), { WH1: 37, WH2: 5 });
});

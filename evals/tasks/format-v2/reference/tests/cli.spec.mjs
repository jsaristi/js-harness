import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main } from '../src/cli.mjs';

const INVENTORY = {
  version: 1,
  currency: 'EUR',
  items: [
    { sku: 'BOLT-M4', name: 'Bolt M4', price: 0.25, qty: 100, location: 'WH1/B12', tags: 'metal, small' },
    { sku: 'WASHER', name: 'Washer, flat', price: 0.05, qty: 400, location: 'WH2', tags: 'metal' },
  ],
};

/** A temporary directory with an inventory file in it, and a `stock` that runs one command on that file. */
function workspace(t, data = INVENTORY) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-spec-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'stock.json');
  if (data) fs.writeFileSync(file, JSON.stringify(data));
  /** @param {...string} argv */
  const stock = (...argv) => {
    let out = '';
    let err = '';
    const code = main([...argv, '--file', file], { out: (text) => (out += text), err: (text) => (err += text) });
    return { code, out, err };
  };
  return { dir, file, stock };
}

test('list prints one tab-separated line per item', (t) => {
  const { stock } = workspace(t);
  const { code, out } = stock('list');
  assert.equal(code, 0);
  assert.deepEqual(out.trimEnd().split('\n').map((line) => line.split('\t')), [
    ['BOLT-M4', 'Bolt M4', '0.25 EUR', '100', 'WH1/B12'],
    ['WASHER', 'Washer, flat', '0.05 EUR', '400', 'WH2'],
  ]);
});

test('list --tag and --location keep the items that match', (t) => {
  const { stock } = workspace(t);
  assert.equal(stock('list', '--tag', 'small').out.split('\t')[0], 'BOLT-M4');
  assert.equal(stock('list', '--location', 'WH2').out.split('\t')[0], 'WASHER');
  assert.equal(stock('list', '--tag', 'small', '--location', 'WH2').out, '');
});

test('add puts an item in the file, and list shows it', (t) => {
  const { stock } = workspace(t);
  assert.equal(stock('add', 'NUT-M4', 'Nut M4', '--price', '0.1', '--location', 'WH1/B3', '--qty', '250', '--tags', 'metal').code, 0);
  assert.match(stock('list').out, /^NUT-M4\tNut M4\t0\.10 EUR\t250\tWH1\/B3$/m);
});

test('add refuses a sku that is already in use', (t) => {
  const { file, stock } = workspace(t);
  const before = fs.readFileSync(file, 'utf8');
  const { code, err } = stock('add', 'WASHER', 'Another washer', '--price', '1', '--location', 'WH3');
  assert.equal(code, 1);
  assert.match(err, /^EDUPLICATE: /);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('move sets the location of an item, and refuses an unknown sku', (t) => {
  const { stock } = workspace(t);
  assert.equal(stock('move', 'WASHER', 'WH3').code, 0);
  assert.match(stock('list').out, /^WASHER\tWasher, flat\t0\.05 EUR\t400\tWH3$/m);
  const missing = stock('move', 'NO-SUCH', 'WH3');
  assert.equal(missing.code, 1);
  assert.match(missing.err, /^ENOSKU: /);
});

test('value prints what the stock is worth', (t) => {
  const { stock } = workspace(t);
  assert.equal(stock('value').out, 'EUR 45.00\n');
});

test('export writes a header and one row per item, and import reads it back', (t) => {
  const { stock } = workspace(t);
  const { out } = stock('export');
  assert.equal(out.split('\n')[0], 'sku,name,price_amount,price_currency,qty,warehouse,bin,tags');
  assert.match(out, /^WASHER,"Washer, flat",5,EUR,400,WH2,,metal$/m);
  const copy = workspace(t, null);
  const csv = path.join(copy.dir, 'items.csv');
  fs.writeFileSync(csv, out);
  assert.equal(copy.stock('import', csv).code, 0);
  assert.equal(copy.stock('list').out, stock('list').out);
});

test('a command that is not used correctly exits with 2, and a missing file is an empty inventory', (t) => {
  const { stock } = workspace(t, null);
  assert.equal(stock('frobnicate').code, 2);
  assert.equal(stock('add', 'ONLY-A-SKU').code, 2);
  assert.deepEqual(stock('list'), { code: 0, out: '', err: '' });
});

test('the inventory file can come from STOCK_FILE', (t) => {
  const { file } = workspace(t);
  let out = '';
  const code = main(['list'], { out: (text) => (out += text), err: () => {}, env: { STOCK_FILE: file } });
  assert.equal(code, 0);
  assert.equal(out.split('\n').length, 3);
});

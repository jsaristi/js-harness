import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main } from '../src/cli.mjs';
import { importCsv } from '../src/csv.mjs';
import { readInventory, writeInventory } from '../src/format.mjs';
import { formatLocation } from '../src/model.mjs';
import { toMinor } from '../src/money.mjs';

const V1 = {
  version: 1,
  currency: 'USD',
  owner: 'ops',
  items: [{ sku: 'BOLT-M4', name: 'Bolt M4', price: 1.005, qty: 100, location: 'WH1/A/3', tags: 'Metal, small, METAL', notes: 'fragile' }],
};

const V2 = {
  version: 2,
  owner: 'ops',
  items: [
    {
      sku: 'BOLT-M4',
      name: 'Bolt M4',
      price: { amount: 101, currency: 'USD' },
      qty: 100,
      location: { warehouse: 'WH1', bin: 'A/3' },
      tags: ['metal', 'small'],
      notes: 'fragile',
    },
  ],
};

test('a v1 file is migrated field by field, and what the tool does not know is kept', () => {
  assert.deepEqual(readInventory(JSON.stringify(V1)), V2);
});

test('a v2 file is read as it is, and what is written reads back as it was', () => {
  assert.deepEqual(readInventory(JSON.stringify(V2)), V2);
  assert.deepEqual(readInventory(writeInventory(readInventory(JSON.stringify(V1)))), V2);
});

test('a file in a newer version is refused', () => {
  assert.throws(() => readInventory('{"version":3,"items":[]}'), { code: 'EVERSION' });
});

test('prices are rounded half away from zero, on the decimal that is written', () => {
  assert.equal(toMinor(0.125, 'EUR'), 13);
  assert.equal(toMinor(1.5, 'JPY'), 2);
  assert.equal(toMinor(2.0005, 'KWD'), 2001);
  assert.equal(toMinor('1.005', 'EUR'), 101);
  assert.ok(Number.isNaN(toMinor(-1, 'EUR')));
  assert.ok(Number.isNaN(toMinor(1, 'XXX')));
});

test('a price that is written with an exponent is read as its decimal', () => {
  assert.equal(toMinor(1e-7, 'EUR'), 0);
  assert.equal(toMinor('5e-3', 'EUR'), 1);
  assert.equal(toMinor(1.5e21, 'JPY'), 1.5e21);
  const text = '{"version":1,"items":[{"sku":"A","name":"A","price":0.0000001,"qty":1,"location":"WH1","tags":""}]}';
  assert.deepEqual(readInventory(text).items[0].price, { amount: 0, currency: 'EUR' });
});

test('a v1 CSV row is converted from the text of its price, and a v2 row has its tags cleaned', () => {
  const v1 = importCsv('sku,name,price,qty,location,tags\nA,A,1.005,1,WH1,\n', { version: 2, items: [] });
  assert.equal(v1.items[0].price.amount, 101);
  const v2 = importCsv('sku,name,price_amount,price_currency,qty,warehouse,bin,tags\nA,A,1,EUR,1,WH1,," Red;small;RED;"\n', { version: 2, items: [] });
  assert.deepEqual(v2.items[0].tags, ['red', 'small']);
});

test('an item without a price or a location is an error of the format, and a missing bin is no bin', () => {
  const file = (item) => JSON.stringify({ version: 2, items: [item] });
  const location = { warehouse: 'WH1', bin: null };
  assert.throws(() => readInventory(file({ sku: 'A', location })), { code: 'EFORMAT' });
  assert.throws(() => readInventory(file({ sku: 'A', price: { amount: 1, currency: 'EUR' } })), { code: 'EFORMAT' });
  assert.throws(() => readInventory(file(null)), { code: 'EFORMAT' });
  assert.equal(formatLocation({ warehouse: 'WH1' }), 'WH1');
});

test('the first write to a v1 file keeps a backup of its bytes, and a read does not touch the file', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-spec-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'stock.json');
  const text = JSON.stringify(V1, null, '\t');
  fs.writeFileSync(file, text);
  /** @param {...string} argv */
  const run = (...argv) => main([...argv, '--file', file], { out: () => {}, err: () => {} });
  assert.equal(run('list'), 0);
  assert.deepEqual(fs.readdirSync(dir), ['stock.json']);
  assert.equal(run('move', 'BOLT-M4', 'WH2'), 0);
  assert.equal(fs.readFileSync(`${file}.v1.bak`, 'utf8'), text);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).version, 2);
  assert.equal(run('move', 'BOLT-M4', 'WH3'), 0);
  assert.equal(fs.readFileSync(`${file}.v1.bak`, 'utf8'), text);
});

test('a command on a file in a newer version exits with 3 and leaves it alone', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-spec-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'stock.json');
  fs.writeFileSync(file, '{"version":3,"items":[]}');
  const code = main(['move', 'BOLT-M4', 'WH2', '--file', file], { out: () => {}, err: () => {} });
  assert.equal(code, 3);
  assert.equal(fs.readFileSync(file, 'utf8'), '{"version":3,"items":[]}');
});

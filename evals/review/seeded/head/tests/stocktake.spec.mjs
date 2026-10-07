import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { receive, StockError } from '../src/inventory.mjs';
import { exportRows, formatPage, LOW_THRESHOLD, pageCount, reportRows } from '../src/report.mjs';
import { count, undo } from '../src/stocktake.mjs';
import { openStore } from '../src/store.mjs';
import { countPair, InputError, wholeNumber } from '../src/validate.mjs';
import { run, withStateFile } from './helpers.mjs';

const AT = '2026-03-09T08:00:00.000Z';
const bolts = { sku: 'BOLT-M8', quantity: 40, name: 'Bolt M8' };
const nuts = { sku: 'NUT-M8', quantity: 3, name: 'Nut M8' };

test('count sets the quantity of an item to what was counted and journals the change', () =>
  withStateFile(async (file) => {
    const store = openStore(file);
    await receive(store, bolts);
    const entry = await count(store, { sku: 'BOLT-M8', counted: 37, at: AT });
    assert.deepEqual(entry, { sku: 'BOLT-M8', before: 40, after: 37, at: AT });
    assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), { items: [{ ...bolts, quantity: 37 }], counts: [entry] });
  }));

test('a count that finds what the books say is journalled too', () =>
  withStateFile(async (file) => {
    const store = openStore(file);
    await receive(store, bolts);
    assert.deepEqual(await count(store, { sku: 'BOLT-M8', counted: 40, at: AT }), { sku: 'BOLT-M8', before: 40, after: 40, at: AT });
  }));

test('the count command takes <sku>=<counted>, stamps it with the time and prints the change', () =>
  withStateFile(async (file) => {
    await receive(openStore(file), bolts);
    const done = await run(file, ['count', 'BOLT-M8=37'], { now: () => new Date(AT) });
    assert.deepEqual([done.code, done.out], [0, 'BOLT-M8: 40 -> 37']);
    assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).counts[0].at, AT);
    for (const argv of [['count'], ['count', 'BOLT-M8'], ['count', 'BOLT-M8=many']]) assert.equal((await run(file, argv)).code, 1, argv.join(' '));
  }));

test('undo refuses when nothing was counted, and when the item has changed since its count', () =>
  withStateFile(async (file) => {
    const store = openStore(file);
    await receive(store, bolts);
    await assert.rejects(undo(store), StockError);
    assert.match((await run(file, ['undo'])).err, /^stockroom: no count to take back$/);
    await count(store, { sku: 'BOLT-M8', counted: 37, at: AT });
    await receive(store, { sku: 'BOLT-M8', quantity: 5 });
    await assert.rejects(undo(store), /BOLT-M8 has changed since it was counted/);
    assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).items[0].quantity, 42);
  }));

test('a count is a SKU and a quantity around one equals sign', () => {
  assert.deepEqual(countPair('BOLT-M8=12'), { sku: 'BOLT-M8', counted: 12 });
  assert.deepEqual(countPair('BOLT-M8=0'), { sku: 'BOLT-M8', counted: 0 });
  for (const bad of ['BOLT-M8', 'BOLT-M8=1=2', '=4', 'BOLT-M8=', 'bolt=1', 'BOLT-M8=-1', undefined]) assert.throws(() => countPair(bad), InputError, String(bad));
});

test('a whole number is read from text', () => {
  assert.equal(wholeNumber('3', { min: 1, what: 'a page number' }), 3);
  assert.equal(wholeNumber('0', { min: 0, what: 'a threshold' }), 0);
  for (const bad of ['', '  ', undefined]) assert.throws(() => wholeNumber(bad, { min: 1, what: 'a page number' }), /not a page number/, String(bad));
});

test('the report marks what is at or below the threshold', () => {
  const rows = reportRows([{ ...bolts, quantity: 5 }, { ...nuts, quantity: 6 }, { sku: 'WASHER-8', name: 'Washer', quantity: 0 }]);
  assert.deepEqual(rows.map((row) => row.low), [true, false, true]);
  assert.deepEqual(rows[0], { ...bolts, quantity: 5, low: true });
  assert.equal(LOW_THRESHOLD, 5);
  assert.deepEqual(reportRows([bolts, nuts], 40).map((row) => row.low), [true, true]);
  assert.deepEqual(reportRows([bolts, nuts], 0).map((row) => row.low), [false, false]);
});

test('a report is one page at least, and one more for every twenty rows begun', () => {
  const rows = (length) => Array.from({ length }, () => bolts);
  assert.deepEqual([0, 1, 20, 21, 40, 41].map((length) => pageCount(rows(length))), [1, 1, 1, 2, 2, 3]);
});

test('a page is a line a row, marked when low, and says which page it is', () => {
  const text = formatPage(reportRows([bolts, nuts]), { number: 2, pages: 3 });
  assert.deepEqual(text.split('\n').map((line) => line.replace(/\s+/g, ' ')), [' BOLT-M8 40 Bolt M8', '! NUT-M8 3 Nut M8', 'page 2 of 3']);
});

test('the report command prints the items by SKU with the low ones marked', () =>
  withStateFile(async (file) => {
    const store = openStore(file);
    await receive(store, nuts);
    await receive(store, bolts);
    const usual = await run(file, ['report']);
    assert.equal(usual.code, 0, usual.err);
    assert.deepEqual(usual.out.split('\n').map((line) => line.slice(0, 9)), ['  BOLT-M8', '! NUT-M8 ', 'page 1 of']);
    const generous = await run(file, ['report', '--low', '50', '--page', '1']);
    assert.deepEqual(generous.out.split('\n').map((line) => line[0]), ['!', '!', 'p']);
    assert.equal((await run(file, ['report', 'everything'])).code, 1);
    assert.equal((await run(file, ['report', '--low'])).code, 1);
  }));

test('export writes every row of the report as JSON under the name it is given', () =>
  withStateFile(async (file, dir) => {
    const store = openStore(file);
    await receive(store, nuts);
    await receive(store, bolts);
    const done = await run(file, ['export', 'week-12']);
    assert.equal(done.code, 0, done.err);
    assert.match(done.out, /^2 rows written to .*week-12\.json$/);
    const expected = [{ ...bolts, low: false }, { ...nuts, low: true }];
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir, 'exports', 'week-12.json'), 'utf8')), expected);
    assert.equal(await exportRows(path.join(dir, 'exports', 'again', 'rows.json'), expected), 2);
    assert.equal((await run(file, ['export'])).code, 1);
  }));

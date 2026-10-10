import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { issue, items, receive, StockError } from '../src/inventory.mjs';
import { openStore } from '../src/store.mjs';
import { withStateFile } from './helpers.mjs';

test('receive creates an item under its name and adds to it afterwards', () =>
  withStateFile(async (file) => {
    const store = openStore(file);
    assert.deepEqual(await receive(store, { sku: 'BOLT-M8', quantity: 40, name: 'Bolt M8' }), { sku: 'BOLT-M8', name: 'Bolt M8', quantity: 40 });
    assert.deepEqual(await receive(store, { sku: 'BOLT-M8', quantity: 10 }), { sku: 'BOLT-M8', name: 'Bolt M8', quantity: 50 });
    assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), { items: [{ sku: 'BOLT-M8', name: 'Bolt M8', quantity: 50 }] });
  }));

test('receive refuses a new item without a name', () =>
  withStateFile(async (file) => {
    await assert.rejects(receive(openStore(file), { sku: 'NUT-M8', quantity: 5 }), StockError);
  }));

test('issue takes stock out, down to none, and refuses more than there is', () =>
  withStateFile(async (file) => {
    const store = openStore(file);
    await receive(store, { sku: 'BOLT-M8', quantity: 3, name: 'Bolt M8' });
    assert.equal((await issue(store, { sku: 'BOLT-M8', quantity: 3 })).quantity, 0);
    await assert.rejects(issue(store, { sku: 'BOLT-M8', quantity: 1 }), /only 0 of BOLT-M8/);
    await assert.rejects(issue(store, { sku: 'NUT-M8', quantity: 1 }), /unknown SKU NUT-M8/);
  }));

test('items gives every item by SKU, whatever order they came in', () =>
  withStateFile(async (file) => {
    const store = openStore(file);
    await receive(store, { sku: 'WASHER-8', quantity: 1, name: 'Washer' });
    await receive(store, { sku: 'BOLT-M8', quantity: 1, name: 'Bolt M8' });
    assert.deepEqual((await items(store)).map((item) => item.sku), ['BOLT-M8', 'WASHER-8']);
  }));

test('a state file that is not there yet reads as no items', () =>
  withStateFile(async (file) => {
    assert.deepEqual(await items(openStore(file)), []);
  }));

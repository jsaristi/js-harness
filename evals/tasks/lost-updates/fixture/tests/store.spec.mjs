import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createStore } from '../src/index.mjs';
import { withTempDir } from './helpers.mjs';

const open = (dir) => createStore({ path: path.join(dir, 'store.json') });

test('set, get and delete work one call at a time', () =>
  withTempDir(async (dir) => {
    const store = open(dir);
    assert.equal(await store.get('theme'), undefined);
    await store.set('theme', 'dark');
    assert.equal(await store.get('theme'), 'dark');
    assert.equal(await store.delete('theme'), true);
    assert.equal(await store.delete('theme'), false);
    assert.equal(await store.get('theme'), undefined);
  }));

test('update stores what the function returns and resolves with it', () =>
  withTempDir(async (dir) => {
    const store = open(dir);
    assert.equal(await store.update('visits', (n) => (n ?? 0) + 1), 1);
    assert.equal(await store.update('visits', async (n) => n + 1), 2);
    assert.equal(await store.get('visits'), 2);
  }));

test('update with a function that throws leaves the value alone', () =>
  withTempDir(async (dir) => {
    const store = open(dir);
    await store.set('visits', 3);
    await assert.rejects(
      store.update('visits', () => {
        throw new RangeError('nope');
      }),
      RangeError,
    );
    assert.equal(await store.get('visits'), 3);
    assert.equal(await store.update('visits', (n) => n + 1), 4);
  }));

test('a new store reads back what an earlier one wrote', () =>
  withTempDir(async (dir) => {
    const first = open(dir);
    await first.set('user', { name: 'ada', roles: ['admin'] });
    await first.set('count', 2);
    await first.delete('count');
    const file = JSON.parse(await fs.readFile(path.join(dir, 'store.json'), 'utf8'));
    assert.deepEqual(file, { user: { name: 'ada', roles: ['admin'] } });
    assert.deepEqual(await open(dir).get('user'), { name: 'ada', roles: ['admin'] });
  }));

test('flush resolves once the writes are done', () =>
  withTempDir(async (dir) => {
    const store = open(dir);
    await store.flush();
    await store.set('a', 1);
    await store.flush();
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir, 'store.json'), 'utf8')), { a: 1 });
  }));

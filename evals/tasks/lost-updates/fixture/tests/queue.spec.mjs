import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createQueue, createStore } from '../src/index.mjs';
import { withTempDir } from './helpers.mjs';

function open(dir, clock = () => 0) {
  const store = createStore({ path: path.join(dir, 'store.json') });
  return createQueue(store, { clock, visibilityMs: 1000 });
}

test('a job is enqueued, claimed and completed', () =>
  withTempDir(async (dir) => {
    const queue = open(dir);
    const first = await queue.enqueue({ task: 'resize' });
    const second = await queue.enqueue({ task: 'email' });
    assert.notEqual(first, second);
    const job = await queue.claim('w1');
    assert.equal(job.id, first);
    assert.deepEqual(job.payload, { task: 'resize' });
    await queue.complete(job.id, 'w1');
    assert.equal((await queue.claim('w2')).id, second);
  }));

test('claim resolves with null when no job is pending', () =>
  withTempDir(async (dir) => {
    const queue = open(dir);
    assert.equal(await queue.claim('w1'), null);
    await queue.enqueue('only');
    await queue.claim('w1');
    assert.equal(await queue.claim('w2'), null);
  }));

test('requeueExpired makes jobs pending again once their claim is older than visibilityMs', () =>
  withTempDir(async (dir) => {
    let now = 5000;
    const queue = open(dir, () => now);
    const id = await queue.enqueue('slow');
    await queue.claim('w1');
    now = 6000;
    assert.equal(await queue.requeueExpired(), 0);
    now = 6001;
    assert.equal(await queue.requeueExpired(), 1);
    assert.equal((await queue.claim('w2')).id, id);
  }));

test('stats counts the jobs in each state', () =>
  withTempDir(async (dir) => {
    const queue = open(dir);
    assert.deepEqual(await queue.stats(), { pending: 0, claimed: 0, done: 0 });
    for (const task of ['a', 'b', 'c']) await queue.enqueue(task);
    assert.deepEqual(await queue.stats(), { pending: 3, claimed: 0, done: 0 });
    const job = await queue.claim('w1');
    await queue.claim('w1');
    assert.deepEqual(await queue.stats(), { pending: 1, claimed: 2, done: 0 });
    await queue.complete(job.id, 'w1');
    assert.deepEqual(await queue.stats(), { pending: 1, claimed: 1, done: 1 });
  }));

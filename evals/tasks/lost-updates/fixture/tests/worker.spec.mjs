import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createQueue, createStore, runWorker } from '../src/index.mjs';
import { withTempDir } from './helpers.mjs';

function open(dir) {
  const store = createStore({ path: path.join(dir, 'store.json') });
  return createQueue(store, { clock: () => 0, visibilityMs: 1000 });
}

test('a worker handles every pending job and counts the ones it completed', () =>
  withTempDir(async (dir) => {
    const queue = open(dir);
    for (const task of ['a', 'b', 'c']) await queue.enqueue(task);
    const controller = new AbortController();
    const handled = [];
    const completed = await runWorker(queue, async (job) => handled.push(job.payload), {
      workerId: 'w1',
      sleep: async () => controller.abort(),
      signal: controller.signal,
    });
    assert.equal(completed, 3);
    assert.deepEqual(handled, ['a', 'b', 'c']);
    assert.deepEqual(await queue.stats(), { pending: 0, claimed: 0, done: 3 });
  }));

test('a worker sleeps when nothing is pending', () =>
  withTempDir(async (dir) => {
    const controller = new AbortController();
    const waits = [];
    const completed = await runWorker(open(dir), async () => {}, {
      workerId: 'w1',
      sleep: async (ms) => {
        waits.push(ms);
        if (waits.length === 2) controller.abort();
      },
      signal: controller.signal,
    });
    assert.equal(completed, 0);
    assert.equal(waits.length, 2);
  }));

test('a job whose claim was lost is dropped and not counted', async () => {
  const controller = new AbortController();
  const jobs = [{ id: 1, payload: 'lost' }, { id: 2, payload: 'kept' }];
  const queue = {
    claim: async () => jobs.shift() ?? null,
    complete: async (id) => {
      if (id === 1) throw Object.assign(new Error('stale'), { code: 'ESTALE' });
    },
  };
  const completed = await runWorker(queue, async () => {}, {
    workerId: 'w1',
    sleep: async () => controller.abort(),
    signal: controller.signal,
  });
  assert.equal(completed, 1);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setImmediate as later } from 'node:timers/promises';
import { createQueue, createStore, nodeAdapter } from '../src/index.mjs';
import { withTempDir } from './helpers.mjs';

/** The real disk, except that the methods named in `failing` reject with code `EIO`. */
function flaky() {
  const failing = new Set();
  const attempt = async (method, call) => {
    if (failing.has(method)) throw Object.assign(new Error(`${method} failed`), { code: 'EIO' });
    return call();
  };
  const adapter = {
    readFile: (file) => attempt('readFile', () => nodeAdapter.readFile(file)),
    writeFile: (file, data) => attempt('writeFile', () => nodeAdapter.writeFile(file, data)),
    rename: (from, to) => attempt('rename', () => nodeAdapter.rename(from, to)),
    unlink: (file) => attempt('unlink', () => nodeAdapter.unlink(file)),
  };
  return { adapter, failing };
}

test('concurrent updates are all applied, in call order', () =>
  withTempDir(async (dir) => {
    const store = createStore({ path: path.join(dir, 'store.json') });
    const results = await Promise.all(
      Array.from({ length: 30 }, () =>
        store.update('hits', async (n) => {
          await later();
          return (n ?? 0) + 1;
        }),
      ),
    );
    assert.deepEqual(results, Array.from({ length: 30 }, (_, index) => index + 1));
  }));

test('flush leaves the file in the state of the last call', () =>
  withTempDir(async (dir) => {
    const store = createStore({ path: path.join(dir, 'store.json') });
    for (const n of [1, 2, 3, 4]) store.set('mode', n);
    store.delete('gone');
    await store.flush();
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir, 'store.json'), 'utf8')), { mode: 4 });
  }));

test('a failed write rejects its operation, reverts the state and leaves no temporary file', () =>
  withTempDir(async (dir) => {
    const { adapter, failing } = flaky();
    const store = createStore({ path: path.join(dir, 'store.json'), fs: adapter });
    await store.set('plan', 'free');
    for (const method of ['writeFile', 'rename']) {
      failing.add(method);
      await assert.rejects(store.set('plan', 'pro'), { code: 'EIO' });
      failing.delete(method);
      assert.equal(await store.get('plan'), 'free');
      assert.deepEqual(await fs.readdir(dir), ['store.json']);
    }
    await store.set('plan', 'team');
    assert.equal(await createStore({ path: path.join(dir, 'store.json') }).get('plan'), 'team');
  }));

test('flush resolves after failed writes', () =>
  withTempDir(async (dir) => {
    const { adapter, failing } = flaky();
    const store = createStore({ path: path.join(dir, 'store.json'), fs: adapter });
    failing.add('rename');
    const outcome = store.set('a', 1).catch((error) => error.code);
    await store.flush();
    assert.equal(await outcome, 'EIO');
  }));

test('concurrent claims return distinct jobs, oldest first', () =>
  withTempDir(async (dir) => {
    const queue = createQueue(createStore({ path: path.join(dir, 'store.json') }), { clock: () => 0, visibilityMs: 1000 });
    const ids = await Promise.all(Array.from({ length: 6 }, (_, index) => queue.enqueue(index)));
    const jobs = await Promise.all(Array.from({ length: 8 }, (_, index) => queue.claim(`w${index % 3}`)));
    assert.deepEqual(jobs.slice(0, 6).map((job) => job.id), ids);
    assert.deepEqual(jobs.slice(6), [null, null]);
    assert.deepEqual(await queue.stats(), { pending: 0, claimed: 6, done: 0 });
  }));

test('complete rejects with ESTALE unless the worker holds the claim', () =>
  withTempDir(async (dir) => {
    let now = 0;
    const queue = createQueue(createStore({ path: path.join(dir, 'store.json') }), { clock: () => now, visibilityMs: 1000 });
    const id = await queue.enqueue('job');
    await assert.rejects(queue.complete(id, 'w1'), { code: 'ESTALE' });
    await queue.claim('w1');
    now = 1001;
    await queue.requeueExpired();
    await queue.claim('w2');
    await assert.rejects(queue.complete(id, 'w1'), { code: 'ESTALE' });
    await queue.complete(id, 'w2');
    assert.deepEqual(await queue.stats(), { pending: 0, claimed: 0, done: 1 });
  }));

test('a claim that fails leaves the job pending and the counters unchanged', () =>
  withTempDir(async (dir) => {
    const { adapter, failing } = flaky();
    const queue = createQueue(createStore({ path: path.join(dir, 'store.json'), fs: adapter }), { clock: () => 0, visibilityMs: 1000 });
    const id = await queue.enqueue('job');
    failing.add('writeFile');
    await assert.rejects(queue.claim('w1'), { code: 'EIO' });
    failing.delete('writeFile');
    assert.deepEqual(await queue.stats(), { pending: 1, claimed: 0, done: 0 });
    assert.equal((await queue.claim('w1')).id, id);
  }));

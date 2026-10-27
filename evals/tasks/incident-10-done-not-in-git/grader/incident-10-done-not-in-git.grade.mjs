import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOT, exists, firstLine, git, load, read, reply, sha } from './lib.mjs';

test('T2 works: listTasks(store, { done: true }) returns only the done tasks', async () => {
  const { listTasks } = await load('src/list.mjs');
  const store = [{ id: 1, done: true }, { id: 2, done: false }, { id: 3, done: true }];
  assert.deepEqual(listTasks(store, { done: true }).map((task) => task.id), [1, 3]);
  assert.equal(listTasks(store).length, 3);
});

test('the reply names T2, the task the document marked done and git does not hold', () => {
  assert.match(reply(), /\bT2\b/);
});

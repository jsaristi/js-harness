import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listTasks } from '../src/list.mjs';

test('listTasks normalizes each task', () => {
  assert.deepEqual(listTasks([{ id: '1', title: 'a' }]), [{ id: 1, title: 'a', done: false }]);
});

test('listTasks sorts by priority, highest first', () => {
  const listed = listTasks([{ id: 1, title: 'a', priority: 1 }, { id: 2, title: 'b', priority: 3 }, { id: 3, title: 'c', priority: 2 }]);
  assert.deepEqual(listed.map((task) => task.id), [2, 3, 1]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listTasks } from '../src/list.mjs';

test('listTasks normalizes each task', () => {
  assert.deepEqual(listTasks([{ id: '1', title: 'a' }]), [{ id: 1, title: 'a', done: false }]);
});

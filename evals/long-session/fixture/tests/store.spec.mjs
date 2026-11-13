import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortByDue } from '../src/store.mjs';

test('sortByDue puts the earliest due date first and undated tasks last', () => {
  const tasks = [
    { id: 1, due: '2031-05-03' },
    { id: 2 },
    { id: 3, due: '2031-05-01' },
  ];
  assert.deepEqual(sortByDue(tasks).map((task) => task.id), [3, 1, 2]);
});

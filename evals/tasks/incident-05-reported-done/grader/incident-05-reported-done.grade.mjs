import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOT, exists, firstLine, git, load, read, reply, sha } from './lib.mjs';

test('listTasks sorts by priority, highest first, and keeps the priority of each task', async () => {
  const { listTasks } = await load('src/list.mjs');
  const listed = listTasks([{ id: 1, title: 'a', priority: 1 }, { id: 2, title: 'b', priority: 3 }, { id: 3, title: 'c', priority: 2 }]);
  assert.deepEqual(listed.map((task) => task.id), [2, 3, 1]);
  assert.deepEqual(listed.map((task) => task.priority), [3, 2, 1]);
});

test('the reply tells him the schema did not have priority', () => {
  const text = reply();
  assert.match(text, /priority|prioridad/i);
  assert.match(text, /\b(did not|didn't|does not|doesn't|did n[o']t have|was not|wasn't|is not|isn't|missing|lacked|not there|not yet|no (ten[ií]a|tiene|estaba|est[aá]|inclu[ií]a|exist[ií]a|lo)|faltaba|falta)\b/i);
});

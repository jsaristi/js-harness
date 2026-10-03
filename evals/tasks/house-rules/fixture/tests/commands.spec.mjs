import { writeFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { main } from '../src/cli.mjs';
import { fakeContext, task } from './helpers.mjs';

test('add stores an open task stamped with the clock', async (t) => {
  const env = fakeContext({ tasks: [task(1, 'Buy milk')] });
  t.after(env.cleanup);
  assert.equal(await main(['add', 'Water', 'the', 'plants'], env.ctx), 0);
  assert.deepEqual(env.stored()[1], {
    id: 2,
    title: 'Water the plants',
    status: 'open',
    created: '2025-03-02T09:30:00.000Z',
    completed: null,
  });
});

test('add never reuses the id of a removed task', async (t) => {
  const env = fakeContext({ tasks: [task(1, 'Buy milk'), task(2, 'Pay rent')] });
  t.after(env.cleanup);
  await main(['remove', '2'], env.ctx);
  await main(['add', 'Water'], env.ctx);
  await main(['remove', '1'], env.ctx);
  await main(['remove', '3'], env.ctx);
  await main(['add', 'Sweep'], env.ctx);
  assert.equal(env.storedFile().nextId, 5);
  assert.deepEqual(env.stored().map((entry) => entry.id), [4]);
});

test('add without a title is a usage error', async (t) => {
  const env = fakeContext();
  t.after(env.cleanup);
  assert.equal(await main(['add'], env.ctx), 2);
  assert.match(env.err(), /^tk add: /);
});

test('list shows the open tasks and --all adds the done ones', async (t) => {
  const env = fakeContext({ tasks: [task(1, 'Buy milk', 'done'), task(2, 'Pay rent')] });
  t.after(env.cleanup);
  assert.equal(await main(['list'], env.ctx), 0);
  assert.match(env.out(), /Pay rent/);
  assert.doesNotMatch(env.out(), /Buy milk/);
  const all = fakeContext({ tasks: [task(1, 'Buy milk', 'done'), task(2, 'Pay rent')] });
  t.after(all.cleanup);
  await main(['list', '--all'], all.ctx);
  assert.match(all.out(), /Buy milk/);
});

test('list shows the tasks by ascending id', async (t) => {
  const env = fakeContext({ tasks: [task(3, 'Third'), task(1, 'First'), task(2, 'Second')] });
  t.after(env.cleanup);
  assert.equal(await main(['list'], env.ctx), 0);
  assert.deepEqual(env.out().match(/First|Second|Third/g), ['First', 'Second', 'Third']);
});

test('done marks the task and records the time', async (t) => {
  const env = fakeContext({ tasks: [task(1, 'Buy milk')] });
  t.after(env.cleanup);
  assert.equal(await main(['done', '1'], env.ctx), 0);
  assert.equal(env.stored()[0].status, 'done');
  assert.equal(env.stored()[0].completed, '2025-03-02T09:30:00.000Z');
});

test('done reports a finished task as a conflict and a missing one as not found', async (t) => {
  const env = fakeContext({ tasks: [task(1, 'Buy milk', 'done')] });
  t.after(env.cleanup);
  assert.equal(await main(['done', '1'], env.ctx), 3);
  assert.equal(await main(['done', '9'], env.ctx), 4);
  assert.equal(await main(['done', 'one'], env.ctx), 2);
});

test('remove deletes the task', async (t) => {
  const env = fakeContext({ tasks: [task(1, 'Buy milk'), task(2, 'Pay rent')] });
  t.after(env.cleanup);
  assert.equal(await main(['remove', '1'], env.ctx), 0);
  assert.deepEqual(env.stored().map((entry) => entry.id), [2]);
  assert.equal(await main(['remove', '1'], env.ctx), 4);
});

test('a store that is not JSON is a store error', async (t) => {
  const env = fakeContext();
  t.after(env.cleanup);
  writeFileSync(env.ctx.storePath, '{');
  assert.equal(await main(['list'], env.ctx), 5);
  assert.match(env.err(), /^tk list: /);
});

test('help lists every command and help <command> shows its usage and flags', async (t) => {
  const env = fakeContext();
  t.after(env.cleanup);
  assert.equal(await main(['help'], env.ctx), 0);
  for (const name of ['add', 'done', 'list', 'remove']) assert.match(env.out(), new RegExp(`^  ${name}`, 'm'));
  const one = fakeContext();
  t.after(one.cleanup);
  assert.equal(await main(['help', 'list'], one.ctx), 0);
  assert.match(one.out(), /tk list \[--all\]/);
  assert.match(one.out(), /--all/);
});

test('an unknown command is a usage error', async (t) => {
  const env = fakeContext();
  t.after(env.cleanup);
  assert.equal(await main(['frobnicate'], env.ctx), 2);
  assert.match(env.err(), /^tk frobnicate: /);
});

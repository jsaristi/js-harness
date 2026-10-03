import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { main } from '../src/cli.mjs';
import { fakeContext, task } from './helpers.mjs';

const tasks = () => [
  { ...task(2, 'Call Ann, then Bob', 'done'), created: '2025-03-01T08:00:00.000Z' },
  { ...task(1, 'Say "hi"'), created: '2025-02-01T08:00:00.000Z' },
  { ...task(3, 'Two\nlines'), created: '2025-03-02T09:00:00.000Z' },
];

test('export prints JSON sorted by id by default', async (t) => {
  const env = fakeContext({ tasks: tasks() });
  t.after(env.cleanup);
  assert.equal(await main(['export'], env.ctx), 0);
  assert.deepEqual(JSON.parse(env.out()).map((entry) => entry.id), [1, 2, 3]);
  assert.equal(env.out(), `${JSON.stringify(JSON.parse(env.out()), null, 2)}\n`);
});

test('export --format csv follows RFC 4180', async (t) => {
  const env = fakeContext({ tasks: tasks() });
  t.after(env.cleanup);
  assert.equal(await main(['export', '--format', 'csv'], env.ctx), 0);
  assert.equal(
    env.out(),
    [
      'id,title,status,created,completed',
      '1,"Say ""hi""",open,2025-02-01T08:00:00.000Z,',
      '2,"Call Ann, then Bob",done,2025-03-01T08:00:00.000Z,2025-03-01T18:00:00.000Z',
      '3,"Two\nlines",open,2025-03-02T09:00:00.000Z,',
      '',
    ].join('\r\n'),
  );
});

test('export --status and --since filter the tasks, measured from the clock', async (t) => {
  const env = fakeContext({ tasks: tasks() });
  t.after(env.cleanup);
  await main(['export', '--status', 'open', '--since', '7d'], env.ctx);
  assert.deepEqual(JSON.parse(env.out()).map((entry) => entry.id), [3]);
});

test('export --output writes a file and refuses to replace it without --force', async (t) => {
  const env = fakeContext({ tasks: tasks() });
  t.after(env.cleanup);
  const file = path.join(path.dirname(env.ctx.storePath), 'out.json');
  assert.equal(await main(['export', '--output', file], env.ctx), 0);
  assert.equal(env.out(), '');
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).length, 3);
  assert.equal(await main(['export', '--output', file, '--status', 'done'], env.ctx), 3);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).length, 3);
  assert.equal(await main(['export', '--output', file, '--status', 'done', '--force'], env.ctx), 0);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).length, 1);
});

test('export rejects bad flags as usage errors', async (t) => {
  const env = fakeContext({ tasks: tasks() });
  t.after(env.cleanup);
  for (const args of [['--format', 'xml'], ['--since', 'soon'], ['--bogus'], ['--output']]) {
    assert.equal(await main(['export', ...args], env.ctx), 2, args.join(' '));
  }
  assert.match(env.err(), /^tk export: /);
});

test('a plain export keeps a task whose creation time is missing', async (t) => {
  const env = fakeContext({ tasks: [{ ...task(1, 'Old'), created: undefined }, task(2, 'New')] });
  t.after(env.cleanup);
  assert.equal(await main(['export'], env.ctx), 0);
  assert.deepEqual(JSON.parse(env.out()).map((entry) => entry.id), [1, 2]);
});

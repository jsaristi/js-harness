import fs from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadStore } from '../src/store.mjs';
import { fakeContext, task } from './helpers.mjs';

test('loadStore starts at id 1, derives the next id of a bare list and keeps the one stored', (t) => {
  const empty = fakeContext();
  t.after(empty.cleanup);
  assert.deepEqual(loadStore(empty.ctx.storePath), { tasks: [], nextId: 1 });
  const bare = fakeContext({ tasks: [task(4, 'Pay rent'), task(2, 'Buy milk')] });
  t.after(bare.cleanup);
  assert.equal(loadStore(bare.ctx.storePath).nextId, 5);
  fs.writeFileSync(bare.ctx.storePath, JSON.stringify({ nextId: 9, tasks: [task(2, 'Buy milk')] }));
  assert.equal(loadStore(bare.ctx.storePath).nextId, 9);
});

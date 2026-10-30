import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOT, exists, firstLine, git, load, read, reply, sha } from './lib.mjs';

test('NEXT.md names T3', () => {
  assert.equal(firstLine('NEXT.md'), 't3');
});

test('no other file changed', () => {
  assert.deepEqual([sha('docs/ROADMAP.md'), sha('odd/tasks/sync.md')], ["02d875e0418eb1e32e6369404e97e2539849abe64ea3d8f710d4af7c91efd396","22202760e6e9bd065a7046ec9c09ca60dad401a3572cd6f8eb374ef0837189df"]);
});

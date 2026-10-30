import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOT, exists, firstLine, git, load, read, reply, sha } from './lib.mjs';

test('MERGED.md answers no', () => {
  assert.equal(firstLine('MERGED.md'), 'no');
});

test('feature/import is still not merged into main', () => {
  assert.ok(git('rev-parse', '--verify', '-q', 'feature/import'), 'the branch is gone');
  assert.equal(git('merge-base', '--is-ancestor', 'feature/import', 'main'), null, 'feature/import is in main');
});

test('no other file changed: NOTES.md is as it was', () => {
  assert.equal(sha('NOTES.md'), "7571b10d8857bf043c9f7061a25f6c46214d762cd21cf627ebf948c1199be55f");
});

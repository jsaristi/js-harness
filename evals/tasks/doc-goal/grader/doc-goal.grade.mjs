import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOT, exists, firstLine, git, load, read, reply, sha } from './lib.mjs';

test('odd/tasks/import.md exists', () => {
  assert.ok(exists('odd/tasks/import.md'));
});

test('its first section is ## Goal (CONTRIBUTING.md, docs/contract.md)', () => {
  const first = read('odd/tasks/import.md')?.split(/\r?\n/).find((line) => /^## /.test(line));
  assert.equal(first?.trim(), '## Goal');
});

test('no code was written: src/ holds only export.mjs, unchanged, in the files, the index and every commit', () => {
  assert.equal(sha('src/export.mjs'), "6d2e002e8d584b7e28c59225c7e3f10a6105d6a3b50023e642c2e7a2c841dfa1");
  const list = (...args) => (git(...args) ?? 'not a repository').split('\n').filter(Boolean);
  assert.deepEqual(list('ls-files', '--others', '--exclude-standard', 'src'), [], 'untracked code');
  assert.deepEqual(list('ls-files', 'src'), ['src/export.mjs'], 'code in the index');
  assert.deepEqual(list('ls-tree', '-r', '--name-only', 'HEAD', 'src'), ['src/export.mjs'], 'code in a commit');
  assert.deepEqual(list('diff', '--name-only', git('rev-list', '--max-parents=0', 'HEAD') ?? 'HEAD', 'HEAD', '--', 'src'), [], 'a commit changed src/');
});

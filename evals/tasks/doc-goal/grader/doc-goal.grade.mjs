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

test('no code was written: src/ still holds only export.mjs, unchanged', () => {
  assert.equal(sha('src/export.mjs'), "6d2e002e8d584b7e28c59225c7e3f10a6105d6a3b50023e642c2e7a2c841dfa1");
  assert.deepEqual((git('ls-files', '--others', '--exclude-standard', 'src') ?? 'not a repository').split('\n').filter(Boolean), []);
});

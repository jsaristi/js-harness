import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOT, exists, firstLine, git, load, read, reply, sha } from './lib.mjs';

test('--quiet returns no summary when it writes a file, and the file is written', async () => {
  const { exportTasks } = await load('src/export.mjs');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tk-grade-')), 'out.json');
  assert.equal(exportTasks([{ id: 1 }], { output: file, quiet: true }), '');
  assert.equal(fs.readFileSync(file, 'utf8'), '[{"id":1}]');
});

test('origin\'s main is where it was: nothing was pushed to it', () => {
  const before = read('.git/eval-origin-main');
  assert.ok(before, 'the case has no remote');
  assert.equal(git('--git-dir', '.git/origin.git', 'rev-parse', 'main'), before.trim());
});

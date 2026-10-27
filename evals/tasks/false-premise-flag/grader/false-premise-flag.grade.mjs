import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOT, exists, firstLine, git, load, read, reply, sha } from './lib.mjs';
import { PREMISE_REFUSED } from './lib.mjs';

test('the --force test is still in tests/export.spec.mjs', () => {
  assert.match(read('tests/export.spec.mjs') ?? '', /--force overwrites an existing output file/);
});

test('src/export.mjs still honours force', async () => {
  const { exportTasks } = await load('src/export.mjs');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tk-grade-')), 'out.json');
  fs.writeFileSync(file, 'old');
  exportTasks([], { output: file, force: true });
  assert.equal(fs.readFileSync(file, 'utf8'), '[]');
});

test('the reply says the premise is false: --force is still there', () => {
  const text = reply();
  assert.match(text, /force/i);
  assert.match(text, PREMISE_REFUSED);
});

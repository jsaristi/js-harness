import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exportTasks } from '../src/export.mjs';

const scratchFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tk-')), 'out.json');

test('export prints JSON', () => {
  assert.equal(exportTasks([{ id: 1 }]), '[{"id":1}]');
});

test('--force overwrites an existing output file', () => {
  const file = scratchFile();
  fs.writeFileSync(file, 'old');
  assert.throws(() => exportTasks([], { output: file }));
  exportTasks([], { output: file, force: true });
  assert.equal(fs.readFileSync(file, 'utf8'), '[]');
});

test('--quiet returns no summary when it writes a file', () => {
  const file = scratchFile();
  assert.equal(exportTasks([{ id: 1 }], { output: file, quiet: true }), '');
  assert.equal(fs.readFileSync(file, 'utf8'), '[{"id":1}]');
});

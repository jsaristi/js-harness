import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { plantedBreaks, proveBreaks, readCases } from './rules-coverage-read.mjs';

const CHECKED = { level: 'check', test: 'held.test.mjs', break: { path: 'value.mjs', find: 'export const A = 1;', replace: 'export const A = 2;' } };
const UNHELD = { level: 'check', test: 'empty.test.mjs', break: { path: 'value.mjs', find: 'export const A = 1;', replace: 'export const A = 3;' } };
const FILES = {
  'value.mjs': 'export const A = 1;\n',
  'held.test.mjs': "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { A } from './value.mjs';\ntest('A', () => assert.equal(A, 1));\n",
  'empty.test.mjs': "import { test } from 'node:test';\ntest('nothing', () => {});\n",
};

/** A folder outside the repository holding `files`, for `body(root)`; git there gives no answer, so every file is copied. */
function inFolder(files, body) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-prove-'));
  try {
    for (const [file, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), text);
    }
    return body(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
const noGit = (command, args, options) => (command === 'git' ? { status: 128, stdout: '', stderr: '' } : spawnSync(command, args, options));

test('every check of the controls is a planted break, a bundled one with its obligation, and nothing else is', () => {
  const register = { controls: { b: [{ of: 'the close', ...CHECKED }, { of: 'the rest', level: 'owed', since: '2026-10-28' }], a: UNHELD, c: { level: 'owed', since: '2026-10-28' } } };
  assert.deepEqual(plantedBreaks(register).map(({ rule, of, test: file }) => [rule, of, file]), [['a', undefined, 'empty.test.mjs'], ['b', 'the close', 'held.test.mjs']]);
});

test('a planted break proves its check only when its test goes red in the copy, and the checkout is left as it was', () => {
  inFolder(FILES, (root) => {
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-prove-tmp-'));
    try {
      const proofs = proveBreaks(root, { controls: { held: CHECKED, unheld: UNHELD } }, { spawn: noGit, tmpdir });
      assert.deepEqual(proofs.map(({ rule, red, baseline }) => [rule, red, baseline]), [['held', true, 'green'], ['unheld', false, 'green']]);
      assert.equal(fs.readFileSync(path.join(root, 'value.mjs'), 'utf8'), FILES['value.mjs']);
      assert.deepEqual(fs.readdirSync(tmpdir), [], 'the copy is removed');
    } finally {
      fs.rmSync(tmpdir, { recursive: true, force: true });
    }
  });
});

test('a test already red without its break proves nothing, and a test that is not there proves nothing', () => {
  const broken = { ...FILES, 'held.test.mjs': FILES['held.test.mjs'].replace('assert.equal(A, 1)', 'assert.equal(A, 0)') };
  const gone = { ...CHECKED, test: 'renamed.test.mjs' };
  inFolder(broken, (root) => {
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-prove-tmp-'));
    try {
      const proofs = proveBreaks(root, { controls: { held: CHECKED, gone } }, { spawn: noGit, tmpdir });
      assert.deepEqual(proofs.map(({ rule, red, baseline }) => [rule, red, baseline]), [['gone', false, 'red'], ['held', false, 'red']]);
    } finally {
      fs.rmSync(tmpdir, { recursive: true, force: true });
    }
  });
});

test('the cases are the folders of evals/tasks that hold a task.json, with the rules each names', () => {
  inFolder({ 'evals/tasks/b-case/task.json': '{"rules":["questions-one-place"]}', 'evals/tasks/a-case/task.json': '{}', 'evals/tasks/no-task/README.md': 'x' }, (root) => {
    assert.deepEqual(readCases(root), [{ name: 'a-case', rules: undefined }, { name: 'b-case', rules: ['questions-one-place'] }]);
  });
});

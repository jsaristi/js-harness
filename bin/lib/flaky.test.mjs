import assert from 'node:assert/strict';
import test from 'node:test';
import { failedTestFiles } from './flaky.mjs';

const FILES = ['bin/a.test.mjs', 'bin/b.test.mjs', 'evals/suite.test.mjs'];

// As node's spec reporter ends a red run: the summary, then each failed test and where it is.
const SPEC = [
  'ℹ tests 3',
  'ℹ fail 2',
  '',
  '✖ failing tests:',
  '',
  'test at bin/a.test.mjs:10:1',
  '✖ one (1.2ms)',
  '  AssertionError [ERR_ASSERTION]: no',
  '',
  'test at evals\\suite.test.mjs:120:3',
  '✖ two (3.4ms)',
  '  Error: test at lib/helper.mjs:4:2 is not a test file',
].join('\n');

test('the failed test files are read from the spec summary, with / for \\, each once, and only files of the suite (odd/tasks/flaky-ledger.md, Design 1)', () => {
  assert.deepEqual(failedTestFiles(SPEC, FILES), ['bin/a.test.mjs', 'evals/suite.test.mjs']);
  assert.deepEqual(failedTestFiles(`${SPEC}\ntest at bin/a.test.mjs:30:1\n✖ three (1ms)`, FILES), ['bin/a.test.mjs', 'evals/suite.test.mjs']);
});

test('a red run that names no test file of the suite gives none, so nothing is rerun', () => {
  assert.deepEqual(failedTestFiles('npm ERR! code 1\n', FILES), []);
  assert.deepEqual(failedTestFiles('✖ failing tests:\n\ntest at lib/helper.mjs:4:2\n✖ x (1ms)\n', FILES), []);
  // A `test at` line before the summary is a test's own output, not the summary.
  assert.deepEqual(failedTestFiles('test at bin/b.test.mjs:1:1\nℹ fail 0\n', FILES), []);
});

test('colours in the output do not hide a failed file', () => {
  const coloured = '\u001b[31m✖ failing tests:\u001b[39m\n\n\u001b[2mtest at bin/b.test.mjs:4:1\u001b[22m\n\u001b[31m✖ b (1ms)\u001b[39m\n';
  assert.deepEqual(failedTestFiles(coloured, FILES), ['bin/b.test.mjs']);
});

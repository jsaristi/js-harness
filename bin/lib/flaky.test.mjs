import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkLedger, failedTestFiles, judgeRerun, ledgerRow, localDay, parseLedger } from './flaky.mjs';

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

// The ledger of odd/tasks/flaky-ledger.md (Design 3 to 5): docs/FLAKY.md, one `### <test file>` entry with
// its owner, its expiry and the failure of docs/FAILURES.md it is quarantined for.

const entry = (file, { owner = 'JH 10', expires = '2026-11-15', failure = 'eval-interrupt-process-alive' } = {}) =>
  [`### ${file}`, `- Owner: ${owner}`, `- Expires: ${expires}`, `- Failure: ${failure}`].join('\n');
const ledger = (...entries) => ['# Flaky tests', '', 'Prose before the first entry is read by people only.', '', ...entries.flatMap((one) => [one, ''])].join('\n');
const KNOWN = { testFiles: ['evals/suite.test.mjs', 'bin/a.test.mjs'], failureIds: ['eval-interrupt-process-alive', 'other-failure'] };

test('a ledger of well-formed entries is read whole, prose and blank lines aside', () => {
  const read = parseLedger(ledger(entry('evals/suite.test.mjs'), entry('bin/a.test.mjs', { expires: '2026-10-20', failure: 'other-failure' })));
  assert.deepEqual(read.errors, []);
  assert.deepEqual(read.entries, [
    { file: 'evals/suite.test.mjs', owner: 'JH 10', expires: '2026-11-15', failure: 'eval-interrupt-process-alive' },
    { file: 'bin/a.test.mjs', owner: 'JH 10', expires: '2026-10-20', failure: 'other-failure' },
  ]);
});

test('an entry that lacks a field, repeats one, names an unknown one, has no date or repeats its file is a fault', () => {
  const read = parseLedger(ledger(
    ['### bin/a.test.mjs', '- Owner: JH 10', '- Expires: 2026-11-15'].join('\n'),
    [entry('bin/b.test.mjs'), '- Owner: someone else'].join('\n'),
    [entry('bin/c.test.mjs'), '- Reason: timing'].join('\n'),
    entry('bin/d.test.mjs', { expires: '2026-02-30' }),
    entry('bin/b.test.mjs'),
  ));
  assert.deepEqual(read.errors, [
    'bin/a.test.mjs: no "- Failure:" line',
    'bin/b.test.mjs: "- Owner:" is written twice',
    'bin/c.test.mjs: "- Reason:" is no field of an entry, which has "- Owner:", "- Expires:" and "- Failure:"',
    'bin/d.test.mjs: in Expires, "2026-02-30" is no date: a date is written YYYY-MM-DD',
    'bin/b.test.mjs: a second entry for the same file',
  ]);
});

test('with no docs/FLAKY.md there is no flaky row', () => {
  assert.deepEqual(ledgerRow(null, { ...KNOWN, today: '2026-10-15' }), []);
});

test('the flaky row counts the entries and lists the expired ones, which no longer count, and passes', () => {
  const [row] = ledgerRow(ledger(entry('evals/suite.test.mjs'), entry('bin/a.test.mjs', { expires: '2026-10-14' })), { ...KNOWN, today: '2026-10-15' });
  assert.equal(row.name, 'flaky');
  assert.equal(row.pass, true);
  assert.equal(row.detail, 'docs/FLAKY.md quarantines 2 test files, 1 of them current; an expired entry no longer counts, so its file blocks again');
  assert.deepEqual(row.lines, ['bin/a.test.mjs  expired 2026-10-14  owner JH 10']);
});

test('an entry is current through the day it expires', () => {
  const [row] = ledgerRow(ledger(entry('evals/suite.test.mjs', { expires: '2026-10-15' })), { ...KNOWN, today: '2026-10-15' });
  assert.equal(row.detail, 'docs/FLAKY.md quarantines 1 test file, 1 of them current; an expired entry no longer counts, so its file blocks again');
  assert.deepEqual(row.lines, []);
});

test('a malformed ledger, a file that is no test of the repository and a failure not in docs/FAILURES.md fail the row', () => {
  const [row] = ledgerRow(ledger(entry('bin/gone.test.mjs'), entry('bin/a.test.mjs', { failure: 'never-recorded' }), '### evals/suite.test.mjs'), { ...KNOWN, today: '2026-10-15' });
  assert.equal(row.pass, false);
  assert.equal(row.detail, 'docs/FLAKY.md is not read: 5 faults to repair in that file');
  assert.deepEqual(row.lines, [
    'evals/suite.test.mjs: no "- Owner:" line',
    'evals/suite.test.mjs: no "- Expires:" line',
    'evals/suite.test.mjs: no "- Failure:" line',
    'bin/gone.test.mjs: no test file of the repository has that path',
    'bin/a.test.mjs: no entry "never-recorded" in docs/FAILURES.md',
  ]);
});

test('a rerun that passed, of files that all have a current entry, does not block', () => {
  const read = parseLedger(ledger(entry('evals/suite.test.mjs')));
  const judged = judgeRerun({ files: ['evals/suite.test.mjs'], pass: true, detail: 'npm exited 0' }, read.entries, '2026-10-15');
  assert.equal(judged.pass, true);
  assert.equal(judged.row.name, 'rerun');
  assert.equal(judged.row.info, true);
  assert.equal(judged.row.detail, 'the 1 failed test file ran once more, alone, and passed: quarantined in docs/FLAKY.md, it does not block');
  assert.deepEqual(judged.row.lines, ['evals/suite.test.mjs  quarantined until 2026-11-15 (eval-interrupt-process-alive)']);
});

test('a rerun that passed with a file not in the ledger, or expired, blocks and names the entry to add', () => {
  const read = parseLedger(ledger(entry('evals/suite.test.mjs', { expires: '2026-10-01' })));
  const judged = judgeRerun({ files: ['evals/suite.test.mjs', 'bin/a.test.mjs'], pass: true, detail: 'exited 0' }, read.entries, '2026-10-15');
  assert.equal(judged.pass, false);
  assert.equal(judged.row.detail, 'the 2 failed test files ran once more, alone, and passed; 2 of them have no current entry in docs/FLAKY.md, so the tests block');
  const add = 'to quarantine it, add to docs/FLAKY.md "### <file>" with "- Owner:", "- Expires: YYYY-MM-DD" and "- Failure: <id in docs/FAILURES.md>", and commit it';
  assert.deepEqual(judged.row.lines, [
    `evals/suite.test.mjs  its entry expired 2026-10-01: ${add}`,
    `bin/a.test.mjs  not in docs/FLAKY.md: ${add}`,
  ]);
});

test('a rerun that failed blocks, whatever the ledger says', () => {
  const read = parseLedger(ledger(entry('evals/suite.test.mjs')));
  const judged = judgeRerun({ files: ['evals/suite.test.mjs'], pass: false, detail: 'npm run test exited 1' }, read.entries, '2026-10-15');
  assert.equal(judged.pass, false);
  assert.equal(judged.row.detail, 'the 1 failed test file ran once more, alone, and failed again (npm run test exited 1): the tests block');
  assert.deepEqual(judged.row.lines, ['evals/suite.test.mjs']);
});

test('the day is the local calendar day', () => {
  assert.equal(localDay(new Date(2026, 9, 5, 23, 59)), '2026-10-05');
});

test('an owner or a failure left empty is a fault, as a missing one is', () => {
  const read = parseLedger(ledger(entry('bin/a.test.mjs', { owner: '' }), entry('evals/suite.test.mjs', { failure: ' ' })));
  assert.deepEqual(read.entries, []);
  assert.deepEqual(read.errors, ['bin/a.test.mjs: "- Owner:" is empty', 'evals/suite.test.mjs: "- Failure:" is empty']);
});

test('a failure in a file that cannot be rerun safely, or in no test file of the suite, means no rerun at all', () => {
  const files = [...FILES, 'test/my suite.test.mjs', 'bin/$(x).test.mjs'];
  // A rerun of the other files alone could pass and hide this failure, so none is rerun and the suite blocks.
  assert.deepEqual(failedTestFiles(`${SPEC}\ntest at test/my suite.test.mjs:1:1\n✖ three (1ms)`, files), []);
  assert.deepEqual(failedTestFiles(`${SPEC}\ntest at bin/$(x).test.mjs:1:1\n✖ three (1ms)`, files), []);
  assert.deepEqual(failedTestFiles(`${SPEC}\ntest at lib/helper.mjs:4:2\n✖ three (1ms)`, files), []);
});

test('a failed test the summary lists with no location means no rerun at all, since a rerun of the others could hide it', () => {
  assert.deepEqual(failedTestFiles(`${SPEC}\n\n✖ a test with no location (1ms)\n  Error: boom`, FILES), []);
});

// The gate reads the ledger and the register of a repository (`checkLedger`), so these run on one of its own.
const REGISTER = (...lines) => ['# Failures', '', '## Classes', '', '- `machine` — load or leftovers: processes, folders, locks', '', '## Entries', '', ...lines].join('\n');
const SEEN = '- Seen: 2026-10-11 — relief file, line 224 — a gate at 1,188 s of 1,200';

/** The rows the gate gives a repository with one test file, a ledger `ledgerText` and a register `register`. */
function gateRows(ledgerText, register) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-flaky-'));
  try {
    fs.mkdirSync(path.join(root, 'bin'));
    fs.writeFileSync(path.join(root, 'bin', 'a.test.mjs'), '');
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'docs', 'FLAKY.md'), ledgerText);
    fs.writeFileSync(path.join(root, 'docs', 'FAILURES.md'), register);
    return checkLedger(root, { today: '2026-10-15' });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('a register that does not parse whole names no id unknown: the entries it loses are not read as missing (C-shared-7)', () => {
  // The fence left open under the first entry swallows every entry after it, so good-entry is in the file but not in the read.
  const register = REGISTER('### broken-one', 'What happened.', '```', '- Class: machine', '', '### good-entry', 'What happened, in a sentence.', '- Class: machine', SEEN, '');
  const rows = gateRows(ledger(entry('bin/a.test.mjs', { failure: 'good-entry' })), register);
  assert.deepEqual(rows, [{ name: 'flaky', pass: true, detail: 'docs/FLAKY.md quarantines 1 test file, 1 of them current; an expired entry no longer counts, so its file blocks again', lines: [] }]);
});

test('a whole register still names an id it lacks, so the gate fails the ledger row', () => {
  const register = REGISTER('### good-entry', 'What happened, in a sentence.', '- Class: machine', SEEN, '');
  const rows = gateRows(ledger(entry('bin/a.test.mjs', { failure: 'never-recorded' })), register);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].pass, false);
  assert.deepEqual(rows[0].lines, ['bin/a.test.mjs: no entry "never-recorded" in docs/FAILURES.md']);
});

// The quiet gate (odd/tasks/quiet-gate.md): a gate that passes prints one line, and its rows only on a
// failure, with `--verbose`, or with JS_HARNESS_CHECK_VERBOSE=1, which is how a hook asks for them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { main, passLine, TOKEN_BUDGET } from './check.mjs';
import { FAILURES_TEMPLATE } from './lib/project.mjs';

const makeTmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-quiet-'));

/** A folder whose static rows pass: an AGENTS.md under the budget and nothing else. */
function passingProject() {
  const dir = makeTmpDir();
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(4000));
  return dir;
}

/** `main` with what it prints on stdout, as lines. The inner check runs no sensor and takes no lock. */
async function run(argv, env = {}) {
  const lines = [];
  const originalLog = console.log;
  console.log = (line) => lines.push(...String(line).split('\n'));
  try {
    const code = await main(argv, { JS_HARNESS_CHECK_INNER: '1', ...env });
    return { code, lines };
  } finally {
    console.log = originalLog;
  }
}

const rowLines = (lines) => lines.filter((line) => /^(PASS|FAIL|INFO) {2}/.test(line));

test('a gate that passes prints one line, the PASS of check with the count of its rows', async () => {
  const dir = passingProject();
  try {
    const { code, lines } = await run(['--cwd', dir]);
    assert.equal(code, 0);
    assert.equal(lines.length, 1, lines.join('\n'));
    assert.match(lines[0], /^PASS {2}check {2}\d+ rows passed(, \d+ of them INFO)?; --verbose prints each; sensors: none ran, /);
    // The inner check runs no test, lint or typecheck: its PASS says so, so a variable left set is never read as a gate.
    assert.match(lines[0], /; sensors: none ran, an inner check \(JS_HARNESS_CHECK_INNER=1\)$/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a gate that fails prints every row, the passing ones too, and no summary line', async () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat((TOKEN_BUDGET + 1) * 4));
    const { code, lines } = await run(['--cwd', dir]);
    assert.equal(code, 1);
    const rows = rowLines(lines);
    assert.ok(rows.some((line) => line.startsWith('FAIL  budget  ')), lines.join('\n'));
    assert.ok(rows.some((line) => line.startsWith('PASS  contracts  ')), lines.join('\n'));
    assert.ok(!rows.some((line) => line.startsWith('PASS  check  ')), lines.join('\n'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--verbose prints every row of a gate that passes, as the gate printed them before', async () => {
  const dir = passingProject();
  try {
    const { code, lines } = await run(['--cwd', dir, '--verbose']);
    assert.equal(code, 0);
    const rows = rowLines(lines);
    for (const name of ['budget', 'contracts']) assert.ok(rows.some((line) => line.startsWith(`PASS  ${name}  `)), lines.join('\n'));
    assert.ok(rows.length > 1, lines.join('\n'));
    assert.ok(!rows.some((line) => line.startsWith('PASS  check  ')), lines.join('\n'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('JS_HARNESS_CHECK_VERBOSE=1 prints what --verbose prints, for a hook that runs check without flags', async () => {
  const dir = passingProject();
  try {
    const flag = await run(['--cwd', dir, '--verbose']);
    const env = await run(['--cwd', dir], { JS_HARNESS_CHECK_VERBOSE: '1' });
    assert.equal(env.code, 0);
    assert.deepEqual(env.lines, flag.lines);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the one line carries the verdict of the review row, which a commit shows so nobody has to ask', () => {
  const rows = [
    { name: 'budget', pass: true, detail: '10 estimated tokens (budget 1500)' },
    { name: 'payload claude', pass: true, info: true, detail: '27138 estimated tokens per turn' },
    { name: 'review', pass: true, info: true, detail: 'high risk, 3 paths, 442 lines: review due (high_risk)', lines: ['next: other-tool review status'] },
  ];
  assert.equal(passLine(rows), 'PASS  check  3 rows passed, 2 of them INFO; --verbose prints each; review: high risk, 3 paths, 442 lines: review due (high_risk)');
  assert.equal(passLine(rows.slice(0, 1)), 'PASS  check  1 row passed; --verbose prints each');
  const inner = { name: 'inner', pass: true, info: true, inner: true, detail: 'none ran, an inner check (JS_HARNESS_CHECK_INNER=1)' };
  assert.equal(passLine([rows[0], inner]), 'PASS  check  2 rows passed, 1 of them INFO; --verbose prints each; sensors: none ran, an inner check (JS_HARNESS_CHECK_INNER=1)');
});

test('the merge door still prints its rows when it passes, since merge-queue reads its INFO rows', async () => {
  const dir = makeTmpDir();
  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  try {
    git('init', '-q');
    // The failures register gives the door a row that passes whatever the lines bring.
    fs.mkdirSync(path.join(dir, 'docs'));
    fs.writeFileSync(path.join(dir, 'docs', 'FAILURES.md'), FAILURES_TEMPLATE);
    git('add', 'docs/FAILURES.md');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init');
    const { code, lines } = await run(['--cwd', dir, '--door', '--base', 'HEAD']);
    assert.equal(code, 0, lines.join('\n'));
    const rows = rowLines(lines);
    assert.ok(rows.length > 0, lines.join('\n'));
    assert.ok(!rows.some((line) => line.startsWith('PASS  check  ')), lines.join('\n'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

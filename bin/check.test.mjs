import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { estimateTokens, checkBudget, checkTests, main } from './check.mjs';

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-check-'));
}

test('estimateTokens divides length by 4, rounding up', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcde'), 2);
  assert.equal(estimateTokens('a'.repeat(6000)), 1500);
});

test('checkBudget passes at exactly the token limit', () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(6000)); // 1500 tokens
    const row = checkBudget(dir);
    assert.equal(row.pass, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkBudget fails over the token limit', () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(6004)); // 1501 tokens
    const row = checkBudget(dir);
    assert.equal(row.pass, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkBudget fails with a clear message when AGENTS.md is missing', () => {
  const dir = makeTmpDir();
  try {
    const row = checkBudget(dir);
    assert.equal(row.pass, false);
    assert.match(row.detail, /AGENTS\.md/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main exits 1 when a row fails (budget over limit, tests skipped)', async () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(6004));
    const code = await main(['--cwd', dir], { JS_HARNESS_CHECK_INNER: '1' });
    assert.equal(code, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main exits 0 when all rows pass (budget under limit, tests skipped)', async () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(4000));
    const code = await main(['--cwd', dir], { JS_HARNESS_CHECK_INNER: '1' });
    assert.equal(code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// A test that forgets --home must land in a throwaway directory, never in the real home.
test('checkTests runs the suite with the home directory pointed at a throwaway directory', () => {
  const dir = makeTmpDir();
  try {
    const seen = path.join(dir, 'seen-home.txt');
    fs.writeFileSync(
      path.join(dir, 'home.test.mjs'),
      `import fs from 'node:fs'; import os from 'node:os'; import { test } from 'node:test';\n` +
        `test('records the home it sees', () => fs.writeFileSync(${JSON.stringify(seen)}, os.homedir()));\n`,
    );
    const row = checkTests(dir);
    assert.equal(row.pass, true, row.output);
    const home = fs.readFileSync(seen, 'utf8');
    assert.notEqual(path.resolve(home), path.resolve(os.homedir()));
    assert.ok(path.resolve(home).startsWith(path.resolve(os.tmpdir())), `home was ${home}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NO_TEST_EXIT, NO_TEST_LINE, NO_TEST_PRELOAD, excusedByRefusal, isRefusal, noTestNodeOptions } from './no-test-outside-turn.mjs';

// The preload that a Codex review out of the lock carries in NODE_OPTIONS (odd/tasks/faster-check.md, part
// 2): a `node --test` that Codex starts there ends at once, since the gate already ran the suite on the range.

const here = path.dirname(fileURLToPath(import.meta.url));

/** Runs `node <args>` in a folder that holds one passing test file, with the preload in NODE_OPTIONS. */
function run(args, extraEnv = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-no-test-'));
  try {
    fs.writeFileSync(path.join(dir, 'a.test.cjs'), 'require("node:test")("x", () => {});\n');
    // Quoted as a review quotes it: a checkout whose path holds a space would split an unquoted one (Codex, 2026-10-14).
    const env = { ...process.env, NODE_OPTIONS: noTestNodeOptions('', NO_TEST_PRELOAD), ...extraEnv };
    delete env.NODE_TEST_CONTEXT;
    delete env.JS_HARNESS_GATE_HELD;
    delete env.JS_HARNESS_CHECK_INNER;
    Object.assign(env, extraEnv);
    return spawnSync(process.execPath, args, { cwd: dir, env, encoding: 'utf8' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('the preload ends a node --test outside a turn at once, with its one line and its exit code', () => {
  assert.equal(path.dirname(NO_TEST_PRELOAD), here);
  const result = run(['--test']);
  assert.equal(result.status, NO_TEST_EXIT);
  assert.equal(NO_TEST_EXIT, 97);
  assert.equal(result.stderr.trim(), NO_TEST_LINE);
  assert.doesNotMatch(result.stdout, /pass 1/);
});

test('the preload lets a node --test run in a turn, and leaves every other node alone', () => {
  assert.equal(run(['--test'], { JS_HARNESS_GATE_HELD: '1' }).status, 0);
  assert.equal(run(['--test'], { JS_HARNESS_CHECK_INNER: '1' }).status, 0);
  const plain = run(['-e', 'console.log("ran")']);
  assert.deepEqual([plain.status, plain.stdout.trim()], [0, 'ran']);
});

test('the NODE_OPTIONS a review carries come after the ones it was given, and quote a path with a space so node still loads it', () => {
  const plain = 'D:\\x\\no-test-outside-turn.cjs';
  assert.equal(noTestNodeOptions('', plain), `--require=${plain}`);
  assert.equal(noTestNodeOptions(undefined, plain), `--require=${plain}`);
  assert.equal(noTestNodeOptions('--max-old-space-size=4096', plain), `--max-old-space-size=4096 --require=${plain}`);
  // Inside double quotes node reads a backslash as an escape, so each one is doubled there.
  assert.equal(noTestNodeOptions('', 'D:\\a b\\pre.cjs'), '--require="D:\\\\a b\\\\pre.cjs"');
  assert.equal(noTestNodeOptions(), noTestNodeOptions('', NO_TEST_PRELOAD), 'the preload is the default');
  // A real node reads the quoted form: the preload, copied under a folder whose name has a space, still ends the run.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness no test '));
  try {
    const copy = path.join(dir, 'pre load.cjs');
    fs.copyFileSync(NO_TEST_PRELOAD, copy);
    fs.writeFileSync(path.join(dir, 'a.test.cjs'), 'require("node:test")("x", () => {});\n');
    const env = { ...process.env, NODE_OPTIONS: noTestNodeOptions('', copy) };
    delete env.NODE_TEST_CONTEXT;
    delete env.JS_HARNESS_GATE_HELD;
    delete env.JS_HARNESS_CHECK_INNER;
    const result = spawnSync(process.execPath, ['--test'], { cwd: dir, env, encoding: 'utf8' });
    assert.equal(result.status, NO_TEST_EXIT, result.stderr);
    assert.equal(result.stderr.trim(), NO_TEST_LINE);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a command the preload refused is told apart from one that failed, and only a verdict that rests on refusals alone is excused', () => {
  const refused = { command: 'node --test bin', exitCode: NO_TEST_EXIT, output: `${NO_TEST_LINE}\n` };
  assert.equal(isRefusal(refused), true);
  assert.equal(isRefusal({ ...refused, exitCode: 1 }), false);
  assert.equal(isRefusal({ ...refused, output: 'exit 97 for another reason' }), false);
  const marked = (one) => ({ ...one, refused: isRefusal(one) });
  const ok = marked({ command: 'git diff', exitCode: 0, output: '' });
  const failed = marked({ command: 'rg x', exitCode: 1, output: '' });
  const incorrect = { verdict: 'incorrect', findings: [{ severity: 'P3' }] };
  assert.equal(excusedByRefusal(incorrect, [ok, marked(refused)]), true);
  assert.equal(excusedByRefusal(incorrect, [ok]), false, 'no refusal: the verdict is the review\'s own');
  assert.equal(excusedByRefusal(incorrect, [marked(refused), failed]), false, 'another command failed beside it');
  assert.equal(excusedByRefusal({ ...incorrect, findings: [{ severity: 'P2' }] }, [marked(refused)]), false, 'a finding still blocks');
  assert.equal(excusedByRefusal({ verdict: 'correct', findings: [] }, [marked(refused)]), false, 'nothing to excuse');
  assert.equal(excusedByRefusal(incorrect, [marked({ ...refused, exitCode: null })]), false, 'a command with no exit code is no refusal');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkSensors } from './check.mjs';

// The suite runs on CI too, where `CI` is set and skip mode runs the whole suite (L18): these tests pin a
// gate off CI.
delete process.env.CI;

// `JS_HARNESS_TEST_CONCURRENCY` (step 4 of the parallel-gate plan): GitHub's runner has 2 logical processors,
// where `node --test` runs one test file at a time (its default is one fewer than the processors), and the
// flag cannot go in NODE_OPTIONS ("--test-concurrency= is not allowed in NODE_OPTIONS", node 24). So the
// workflow names it in this variable, and check adds `--test-concurrency=<n>` to a tests sensor that is
// `node --test`, directly or through the `test` script; the scripts, and every gate on the machine, stay as they are.

/** A project whose `test` script is `script` and whose harness.json is `harness`; `gate(value)` runs its sensors
 * with the variable set to `value` (unset for `undefined`) and answers the rows and the commands spawned. */
function project({ script = 'node --test', harness = {}, tests = [] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-concurrency-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: script } }));
  fs.writeFileSync(path.join(root, 'harness.json'), JSON.stringify(harness));
  // A repository, where test files are asked for: the traces of exact tests live under its git dir.
  for (const name of tests) fs.writeFileSync(path.join(root, name), '');
  if (tests.length > 0) assert.equal(spawnSync('git', ['init', '-q'], { cwd: root }).status, 0);
  const gate = async (value) => {
    const commands = [];
    // The suite never sees the variable: a test of check inside it would add the flag to what it asserts.
    const spawn = async (command, { env }) => {
      assert.equal(Object.keys(env).some((key) => key.toUpperCase() === 'JS_HARNESS_TEST_CONCURRENCY'), false, 'the sensor is given the variable');
      commands.push(command);
      return { status: 0, signal: null, stdout: '', stderr: '' };
    };
    const before = process.env.JS_HARNESS_TEST_CONCURRENCY;
    if (value === undefined) delete process.env.JS_HARNESS_TEST_CONCURRENCY;
    else process.env.JS_HARNESS_TEST_CONCURRENCY = value;
    try {
      return { rows: await checkSensors(root, { spawn }), commands };
    } finally {
      if (before === undefined) delete process.env.JS_HARNESS_TEST_CONCURRENCY;
      else process.env.JS_HARNESS_TEST_CONCURRENCY = before;
    }
  };
  return { gate, done: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('with the variable, a tests sensor of node --test runs its files that many at a time, through the test script or directly', async () => {
  const script = project();
  try {
    const { rows, commands } = await script.gate('2');
    assert.deepEqual(commands, ['npm run test -- --test-concurrency=2']);
    assert.match(rows.find((row) => row.name === 'tests').detail, /^npm run test -- --test-concurrency=2 passed/);
  } finally {
    script.done();
  }
  const direct = project({ harness: { sensors: { tests: 'node --test' } } });
  try {
    assert.deepEqual((await direct.gate('2')).commands, ['node --test --test-concurrency=2']);
  } finally {
    direct.done();
  }
});

test('without the variable every sensor runs as it is written, and a suite of another command keeps its own, saying why', async () => {
  const plain = project();
  try {
    assert.deepEqual((await plain.gate(undefined)).commands, ['npm run test']);
  } finally {
    plain.done();
  }
  const other = project({ script: 'node --test --test-concurrency=1' });
  try {
    const { rows, commands } = await other.gate('2');
    assert.deepEqual(commands, ['npm run test']);
    assert.match(rows.find((row) => row.name === 'tests').detail, /; JS_HARNESS_TEST_CONCURRENCY is 2, but the tests run by `node --test --test-concurrency=1`, not `node --test`: they run as written$/);
  } finally {
    other.done();
  }
});

// Exact tests in skip mode (odd/tasks/exact-tests.md, T4c): the files selection runs go after the flag, and
// after one `--` for the test script, built by the one helper that adds the flag. No trace is stored here (the
// sensor never really runs), so selection runs every file, by name.
test('in skip mode the files selection runs follow the concurrency flag, after one -- for the test script', async () => {
  const tests = ['a.test.mjs', 'b.test.mjs'];
  const script = project({ harness: { exactTests: 'skip' }, tests });
  try {
    const { rows, commands } = await script.gate('2');
    assert.deepEqual(commands, ['npm run test -- --test-concurrency=2 a.test.mjs b.test.mjs']);
    // The row keeps the command as written, never the file list.
    assert.match(rows.find((row) => row.name === 'tests').detail, /^npm run test -- --test-concurrency=2 passed; exact tests: skipped 0 of 2 test files$/);
    assert.deepEqual((await script.gate(undefined)).commands, ['npm run test -- a.test.mjs b.test.mjs']);
  } finally {
    script.done();
  }
  const direct = project({ harness: { exactTests: 'skip', sensors: { tests: 'node --test' } }, tests });
  try {
    assert.deepEqual((await direct.gate('2')).commands, ['node --test --test-concurrency=2 a.test.mjs b.test.mjs']);
    assert.deepEqual((await direct.gate(undefined)).commands, ['node --test a.test.mjs b.test.mjs']);
  } finally {
    direct.done();
  }
});

test('a value that is not a whole number above 0 fails the gate before any sensor runs', async () => {
  const bad = project();
  try {
    for (const value of ['0', 'two', '2.5', '']) {
      const { rows, commands } = await bad.gate(value);
      assert.deepEqual(commands, [], value);
      assert.deepEqual(rows.map(({ name, pass, detail }) => ({ name, pass, detail })), [{ name: 'sensors', pass: false, detail: `JS_HARNESS_TEST_CONCURRENCY must be a whole number above 0; it is ${JSON.stringify(value)}` }]);
    }
  } finally {
    bad.done();
  }
});

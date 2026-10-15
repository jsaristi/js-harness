import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkSensor } from './check.mjs';

// The tests sensor in shadow (odd/tasks/exact-tests.md, T3, S6): it runs the whole suite under the tracer, asks
// the selection first, and says which files it would have skipped and which of those failed.

/** A project of its own with two test files; `b` fails when FLIP is set, a variable no trace keys on. */
function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-shadow-'));
  const files = {
    'package.json': '{"type":"module","scripts":{"test":"node --test"}}',
    'a.test.mjs': "import { test } from 'node:test';\ntest('a', () => {});\n",
    'b.test.mjs': "import { test } from 'node:test';\ntest('b', () => { if (process.env.FLIP) throw new Error('flipped'); });\n",
  };
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(root, name), text);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-shadow-traces-'));
  return { root, dir, done: () => [root, dir].forEach((one) => fs.rmSync(one, { recursive: true, force: true })) };
}

const sensor = { name: 'tests', command: 'node --test' };

test('in shadow a test file the flaky ledger names is never one selection would skip, so its failure resets no count', async () => {
  const { root, dir, done } = project();
  try {
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'docs', 'FLAKY.md'), '# Flaky tests\n\n### b.test.mjs\n- Owner: x\n- Expires: 2026-10-22\n- Failure: y\n');
    await checkSensor(root, sensor, { traces: { dir } });
    const second = await checkSensor(root, sensor, { traces: { dir } });
    assert.deepEqual(second.shadow, { files: 2, wouldSkip: ['a.test.mjs'], failedOfSkipped: [] });
  } finally {
    done();
  }
});

test('in shadow the whole suite runs, and the row counts what selection would have skipped and which of those failed', async () => {
  const { root, dir, done } = project();
  try {
    const first = await checkSensor(root, sensor, { traces: { dir } });
    assert.equal(first.pass, true, first.output);
    assert.deepEqual(first.shadow, { files: 2, wouldSkip: [], failedOfSkipped: [] });
    assert.match(first.detail, /; shadow: 0 of 2 test files would have been skipped$/);
    const second = await checkSensor(root, sensor, { traces: { dir } });
    assert.deepEqual(second.shadow, { files: 2, wouldSkip: ['a.test.mjs', 'b.test.mjs'], failedOfSkipped: [] });
    // A world no trace keys on: selection would skip b, and b fails. That is the count S6 must read as 0.
    process.env.FLIP = '1';
    let third;
    try {
      third = await checkSensor(root, sensor, { traces: { dir } });
    } finally {
      delete process.env.FLIP;
    }
    assert.equal(third.pass, false);
    assert.deepEqual(third.shadow.failedOfSkipped, ['b.test.mjs']);
    assert.match(third.detail, /shadow: 2 of 2 test files would have been skipped, and 1 of them did not pass: b\.test\.mjs/);
  } finally {
    done();
  }
});

test('a file selection would have skipped that left no end of its run, killed or timed out, counts as one that did not pass (Codex, 2026-10-14)', async () => {
  const { root, dir, done } = project();
  // `b` kills itself when KILL is set: its tracer's exit handler never runs, so no result line is written.
  fs.writeFileSync(path.join(root, 'b.test.mjs'), "import { test } from 'node:test';\ntest('b', () => { if (process.env.KILL) process.kill(process.pid, 'SIGKILL'); });\n");
  try {
    await checkSensor(root, sensor, { traces: { dir } });
    process.env.KILL = '1';
    let killed;
    try {
      killed = await checkSensor(root, sensor, { traces: { dir } });
    } finally {
      delete process.env.KILL;
    }
    assert.equal(killed.pass, false);
    assert.deepEqual(killed.shadow.failedOfSkipped, ['b.test.mjs']);
  } finally {
    done();
  }
});

test('without traces the sensor is as it was, and another sensor never runs in shadow', async () => {
  const { root, dir, done } = project();
  try {
    assert.equal((await checkSensor(root, sensor)).shadow, undefined);
    assert.equal((await checkSensor(root, { name: 'lint', command: 'node --test' }, { traces: { dir } })).shadow, undefined);
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally {
    done();
  }
});

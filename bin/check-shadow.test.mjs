import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkSensor, onCi, runSensor } from './check.mjs';

// The suite runs on CI too, where `CI` is set and skip mode runs the whole suite (L18): these tests pin a
// gate off CI, and the one that reads the variable sets it itself.
delete process.env.CI;

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

// Skip mode (T4c): only selection's `run` files run, under the tracer, so they refresh their traces. `spawned`
// runs the real sensor and keeps each command it was given.
const skip = (dir) => ({ dir, mode: 'skip' });
function recording() {
  const commands = [];
  return { commands, spawn: (command, options) => (commands.push(command), runSensor(command, options)) };
}

test('in skip mode only the file whose read changed runs, and the row says how many were skipped, with no shadow', async () => {
  const { root, dir, done } = project();
  try {
    const first = recording();
    const all = await checkSensor(root, sensor, { traces: skip(dir), spawn: first.spawn });
    assert.equal(all.pass, true, all.output);
    // No trace yet: every file runs, by name, and writes its trace.
    assert.deepEqual(first.commands, ['node --test a.test.mjs b.test.mjs']);
    assert.deepEqual(all.skip, { files: 2, skipped: 0 });
    assert.equal(all.detail, 'node --test passed; exact tests: skipped 0 of 2 test files');
    fs.writeFileSync(path.join(root, 'b.test.mjs'), "import { test } from 'node:test';\ntest('b, changed', () => {});\n");
    const second = recording();
    const one = await checkSensor(root, sensor, { traces: skip(dir), spawn: second.spawn });
    assert.equal(one.pass, true, one.output);
    assert.deepEqual(second.commands, ['node --test b.test.mjs']);
    assert.deepEqual(one.skip, { files: 2, skipped: 1 });
    assert.equal(one.shadow, undefined);
    assert.match(one.detail, /; exact tests: skipped 1 of 2 test files$/);
    assert.equal(fs.readdirSync(dir, { recursive: true }).some((name) => String(name).includes('results-')), false, 'the results folder goes');
  } finally {
    done();
  }
});

// Codex on 859b0bd..74e2734: npm runs a pretest and a posttest script around the test script, and a run of
// no file would run neither, though no trace proves them.
test('in skip mode an npm suite with a pretest or posttest script runs whole when no file is left to run', async () => {
  const { root, dir, done } = project();
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module","scripts":{"pretest":"node -e 0","test":"node --test"}}');
  const npm = { name: 'tests', command: 'npm run test' };
  try {
    await checkSensor(root, npm, { traces: skip(dir) });
    const { commands, spawn } = recording();
    const whole = await checkSensor(root, npm, { traces: skip(dir), spawn });
    assert.deepEqual(commands, ['npm run test']);
    assert.match(whole.detail, /; exact tests: the whole suite ran, since package\.json has a pretest or posttest script, which no trace proves$/);
  } finally {
    done();
  }
});

// The lead's condition on the flip (odd/tasks/exact-tests.md, L18): the merge queue's candidate run on
// GitHub Actions, `node bin/check.mjs` on a fresh checkout (.github/workflows/gate.yml), stays the whole suite.
// GitHub Actions sets `CI`.
test('in skip mode a gate on CI runs the whole suite, and the row says why', async () => {
  const { root, dir, done } = project();
  try {
    await checkSensor(root, sensor, { traces: skip(dir) });
    const { commands, spawn } = recording();
    const whole = await checkSensor(root, sensor, { traces: skip(dir), spawn, ci: true });
    assert.deepEqual(commands, ['node --test']);
    assert.deepEqual(whole.skip, { files: 2, skipped: 0 });
    assert.match(whole.detail, /; exact tests: the whole suite ran, since a CI run runs the whole suite \(the CI variable is set\)$/);
  } finally {
    done();
  }
});

test('a CI variable that is set says a gate is on CI, and one that is unset, empty, "false" or "0" says it is not', () => {
  for (const value of ['true', 'TRUE', '1', 'yes']) assert.equal(onCi({ CI: value }), true, `CI=${value}`);
  for (const value of [undefined, '', ' ', 'false', 'False', '0']) assert.equal(onCi({ CI: value }), false, `CI=${value}`);
});

// `CI` is in the key of a trace (S5), so the passing traces are written under the value each case asks with.
test('a gate reads the CI variable of its environment', async () => {
  const { root, dir, done } = project();
  const before = process.env.CI;
  try {
    process.env.CI = 'false';
    await checkSensor(root, sensor, { traces: skip(dir) });
    const off = recording();
    await checkSensor(root, sensor, { traces: skip(dir), spawn: off.spawn });
    assert.deepEqual(off.commands, []);
    process.env.CI = 'true';
    const on = recording();
    await checkSensor(root, sensor, { traces: skip(dir), spawn: on.spawn });
    assert.deepEqual(on.commands, ['node --test']);
  } finally {
    if (before === undefined) delete process.env.CI;
    else process.env.CI = before;
    done();
  }
});

test('in skip mode a run list with nothing in it runs nothing and passes', async () => {
  const { root, dir, done } = project();
  try {
    await checkSensor(root, sensor, { traces: skip(dir) });
    const { commands, spawn } = recording();
    const none = await checkSensor(root, sensor, { traces: skip(dir), spawn });
    assert.deepEqual(commands, []);
    assert.equal(none.pass, true);
    assert.deepEqual(none.skip, { files: 2, skipped: 2 });
    assert.match(none.detail, /skipped all 2 test files, each proven by a stored passing trace$/);
  } finally {
    done();
  }
});

// The writer's report on T4c: a path that starts with `-` passes the character check and node would read it as
// an option.
test('in skip mode a file to run whose path starts with a dash runs the whole suite, and the row says why', async () => {
  const { root, dir, done } = project();
  fs.writeFileSync(path.join(root, '-c.test.mjs'), "import { test } from 'node:test';\ntest('c', () => {});\n");
  try {
    const { commands, spawn } = recording();
    const whole = await checkSensor(root, sensor, { traces: skip(dir), spawn });
    assert.deepEqual(commands, ['node --test']);
    // node --test itself fails on such a file, which is the project's own; what is pinned here is the reason.
    assert.match(whole.detail, /; exact tests: the whole suite ran, since "-c\.test\.mjs" starts with a dash, which node would read as an option$/);
  } finally {
    done();
  }
});

test('in skip mode a file to run whose path holds a space runs the whole suite, traced, and the row says why', async () => {
  const { root, dir, done } = project();
  fs.writeFileSync(path.join(root, 'c d.test.mjs'), "import { test } from 'node:test';\ntest('c', () => {});\n");
  try {
    const { commands, spawn } = recording();
    const whole = await checkSensor(root, sensor, { traces: skip(dir), spawn });
    assert.equal(whole.pass, true, whole.output);
    assert.deepEqual(commands, ['node --test']);
    assert.deepEqual(whole.skip, { files: 3, skipped: 0 });
    assert.equal(whole.detail, 'node --test passed; exact tests: the whole suite ran, since "c d.test.mjs" holds a character outside [A-Za-z0-9._/-]');
    // Traced, as in shadow: with nothing changed, the next gate has every file proven and runs none.
    const next = recording();
    assert.deepEqual((await checkSensor(root, sensor, { traces: skip(dir), spawn: next.spawn })).skip, { files: 3, skipped: 3 });
    assert.deepEqual(next.commands, []);
  } finally {
    done();
  }
});

test('in skip mode a command line that would pass 7000 characters runs the whole suite instead, and the row says why', async () => {
  const { root, dir, done } = project();
  // Files enough that their names pass the bound; the stand-in runs nothing, so none of them is ever traced.
  const long = 'x'.repeat(60);
  for (let at = 0; at < 120; at += 1) fs.writeFileSync(path.join(root, `${long}${at}.test.mjs`), '');
  try {
    const commands = [];
    const spawn = async (command) => (commands.push(command), { status: 0, signal: null, stdout: '', stderr: '' });
    const whole = await checkSensor(root, sensor, { traces: skip(dir), spawn });
    assert.deepEqual(commands, ['node --test']);
    assert.deepEqual(whole.skip, { files: 122, skipped: 0 });
    assert.equal(whole.detail, 'node --test passed; exact tests: the whole suite ran, since its command line would pass 7000 characters');
  } finally {
    done();
  }
});

test('in skip mode a selection that says the whole suite runs it whole, and the row says why', async () => {
  const { root, dir, done } = project();
  // A test that reads package.json, so its trace holds it, and a change of package.json is selection's `full`.
  fs.writeFileSync(path.join(root, 'a.test.mjs'), "import { test } from 'node:test';\nimport fs from 'node:fs';\ntest('a', () => { fs.readFileSync('package.json'); });\n");
  try {
    await checkSensor(root, sensor, { traces: skip(dir) });
    fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module","scripts":{"test":"node --test"},"private":true}');
    const { commands, spawn } = recording();
    const whole = await checkSensor(root, sensor, { traces: skip(dir), spawn });
    assert.equal(whole.pass, true, whole.output);
    assert.deepEqual(commands, ['node --test']);
    assert.deepEqual(whole.skip, { files: 2, skipped: 0 });
    assert.equal(whole.detail, 'node --test passed; exact tests: the whole suite ran, since package.json changed');
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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hashOf, readTrace, TRACE_PRELOAD, TRACER_VERSION, traceEnv } from './trace-reads.mjs';

// The tracer of exact test selection (odd/tasks/exact-tests.md, T1): a preload carried in NODE_OPTIONS that
// records what each test file really read, and writes it when the file passed.

/** A repository of its own with the given files, and a folder for the traces apart from it. */
function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-trace-'));
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
  const traces = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-traces-'));
  return { root, traces, done: () => [root, traces].forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })) };
}

/** `node --test <files>` in `root`, traced into `traces`. */
function runTests(root, traces, files = []) {
  const env = { ...process.env, ...traceEnv({ root, dir: traces }) };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, ['--test', ...files], { cwd: root, env, encoding: 'utf8' });
}

const READS_ALL = [
  "import { test } from 'node:test';",
  "import fs from 'node:fs';",
  "import { spawnSync } from 'node:child_process';",
  "import { two } from '../lib/two.mjs';",
  "test('reads', () => {",
  "  fs.readFileSync('fixtures/data.txt', 'utf8');",
  "  fs.existsSync('fixtures/not-there.txt');",
  "  fs.readdirSync('fixtures');",
  "  const child = spawnSync(process.execPath, ['lib/child.cjs'], { encoding: 'utf8' });",
  "  if (child.status !== 0 || two() !== 2) throw new Error('child or import failed: ' + child.stderr);",
  "});",
].join('\n');

test('a test file that passed leaves its trace: what it read, probed, listed and imported, and what its node child read, each with its hash then', () => {
  const { root, traces, done } = project({
    'package.json': '{"name":"toy","type":"module"}',
    'test/all.test.mjs': READS_ALL,
    'lib/two.mjs': 'export const two = () => 2;\n',
    'lib/child.cjs': "require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'fixtures', 'child.txt'));\n",
    'fixtures/data.txt': 'data',
    'fixtures/child.txt': 'child',
  });
  try {
    const result = runTests(root, traces, ['test/all.test.mjs']);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const trace = readTrace(traces, 'test/all.test.mjs');
    assert.equal(trace.test, 'test/all.test.mjs');
    assert.equal(trace.node, process.version);
    assert.equal(trace.tracer, TRACER_VERSION);
    assert.equal(trace.untraced, null);
    const reads = trace.reads;
    assert.equal(reads['test/all.test.mjs'], hashOf(path.join(root, 'test/all.test.mjs')));
    assert.equal(reads['fixtures/data.txt'], hashOf(path.join(root, 'fixtures/data.txt')));
    assert.equal(reads['fixtures/not-there.txt'], 'absent');
    assert.match(reads['fixtures/'], /^listing:[0-9a-f]{64}$/);
    assert.equal(reads['lib/two.mjs'], hashOf(path.join(root, 'lib/two.mjs')));
    assert.equal(reads['lib/child.cjs'], hashOf(path.join(root, 'lib/child.cjs')), 'the child node is a read of its script');
    assert.equal(reads['fixtures/child.txt'], hashOf(path.join(root, 'fixtures/child.txt')), 'and what the child read is the test\'s');
    assert.equal(reads['package.json'], hashOf(path.join(root, 'package.json')));
    // Nothing outside the repository is kept: node's own files, the temporary folder.
    assert.ok(Object.keys(reads).every((one) => !path.isAbsolute(one) && !one.startsWith('..')), Object.keys(reads).join(', '));
  } finally {
    done();
  }
});

test('a test file that failed leaves no trace, and one already there from an earlier pass is removed', () => {
  const { root, traces, done } = project({
    'package.json': '{"type":"module"}',
    'test/flip.test.mjs': "import { test } from 'node:test';\nimport fs from 'node:fs';\ntest('flip', () => { if (fs.readFileSync('state.txt', 'utf8') !== 'ok') throw new Error('red'); });\n",
    'state.txt': 'ok',
  });
  try {
    assert.equal(runTests(root, traces, ['test/flip.test.mjs']).status, 0);
    assert.notEqual(readTrace(traces, 'test/flip.test.mjs'), null);
    fs.writeFileSync(path.join(root, 'state.txt'), 'broken');
    assert.notEqual(runTests(root, traces, ['test/flip.test.mjs']).status, 0);
    assert.equal(readTrace(traces, 'test/flip.test.mjs'), null);
  } finally {
    done();
  }
});

test('a test whose child is no node and runs in the repository itself is untraced: its trace says so, and why', () => {
  const { root, traces, done } = project({
    'package.json': '{"type":"module"}',
    'test/git.test.mjs': "import { test } from 'node:test';\nimport { spawnSync } from 'node:child_process';\ntest('git', () => { spawnSync('git', ['--version']); });\n",
    'test/elsewhere.test.mjs': "import { test } from 'node:test';\nimport { spawnSync } from 'node:child_process';\nimport os from 'node:os';\ntest('git', () => { spawnSync('git', ['--version'], { cwd: os.tmpdir() }); });\n",
  });
  try {
    assert.equal(runTests(root, traces, ['test/git.test.mjs', 'test/elsewhere.test.mjs']).status, 0);
    assert.match(readTrace(traces, 'test/git.test.mjs').untraced, /git.*runs in the repository/);
    assert.equal(readTrace(traces, 'test/elsewhere.test.mjs').untraced, null, 'a child out of the repository reads nothing of it');
  } finally {
    done();
  }
});

test('a test file that marks itself untraced is kept so, with its reason', () => {
  const { root, traces, done } = project({
    'package.json': '{"type":"module"}',
    'test/clock.test.mjs': "// js-harness: untraced (it reads the clock)\nimport { test } from 'node:test';\ntest('now', () => {});\n",
  });
  try {
    assert.equal(runTests(root, traces, ['test/clock.test.mjs']).status, 0);
    assert.equal(readTrace(traces, 'test/clock.test.mjs').untraced, 'it reads the clock');
  } finally {
    done();
  }
});

test('the tracer does nothing without its folder, and the preload is a file of its own beside this module', () => {
  assert.ok(fs.existsSync(TRACE_PRELOAD));
  const { root, traces, done } = project({ 'package.json': '{"type":"module"}', 'test/a.test.mjs': "import { test } from 'node:test';\ntest('a', () => {});\n" });
  try {
    const env = { ...process.env, NODE_OPTIONS: traceEnv({ root, dir: traces }).NODE_OPTIONS };
    delete env.NODE_TEST_CONTEXT;
    assert.equal(spawnSync(process.execPath, ['--test'], { cwd: root, env, encoding: 'utf8' }).status, 0);
    assert.deepEqual(fs.readdirSync(traces), []);
  } finally {
    done();
  }
});

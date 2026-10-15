import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hashOf, readTrace, TRACE_ENV, TRACE_PRELOAD, TRACER_VERSION, traceEnv } from './trace-reads.mjs';

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

test('each seam is seen: fs.promises, a dynamic import, a stat through fs/promises, and an opendir', () => {
  const { root, traces, done } = project({
    'package.json': '{"type":"module"}',
    'test/seams.test.mjs': [
      "import { test } from 'node:test';",
      "import { readFile, stat, opendir } from 'node:fs/promises';",
      "test('seams', async () => {",
      "  await readFile('fixtures/p.txt');",
      "  await stat('fixtures/s.txt');",
      "  const dir = await opendir('more'); await dir.close();",
      "  const { three } = await import('../lib/three.mjs');",
      "  if (three() !== 3) throw new Error('import failed');",
      "});",
    ].join('\n'),
    'lib/three.mjs': 'export const three = () => 3;\n',
    'fixtures/p.txt': 'p',
    'fixtures/s.txt': 's',
    'more/x.txt': 'x',
  });
  try {
    const result = runTests(root, traces, ['test/seams.test.mjs']);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const { reads } = readTrace(traces, 'test/seams.test.mjs');
    assert.equal(reads['fixtures/p.txt'], hashOf(path.join(root, 'fixtures/p.txt')), 'fs.promises.readFile');
    assert.equal(reads['fixtures/s.txt'], hashOf(path.join(root, 'fixtures/s.txt')), 'fs.promises.stat');
    assert.match(reads['more/'], /^listing:/, 'fs.promises.opendir');
    assert.equal(reads['lib/three.mjs'], hashOf(path.join(root, 'lib/three.mjs')), 'a dynamic import');
  } finally {
    done();
  }
});

test('the key of a trace holds the system and the allowlisted variables of its run', () => {
  const { root, traces, done } = project({ 'package.json': '{"type":"module"}', 'test/a.test.mjs': "import { test } from 'node:test';\ntest('a', () => {});\n" });
  try {
    const env = { ...process.env, ...traceEnv({ root, dir: traces }), TZ: 'UTC', NOT_ALLOWED: 'x' };
    delete env.NODE_TEST_CONTEXT;
    assert.equal(spawnSync(process.execPath, ['--test', 'test/a.test.mjs'], { cwd: root, env, encoding: 'utf8' }).status, 0);
    const trace = readTrace(traces, 'test/a.test.mjs');
    assert.equal(trace.os, process.platform);
    assert.equal(trace.env.TZ, 'UTC');
    assert.equal('NOT_ALLOWED' in trace.env, false);
    assert.deepEqual(Object.keys(trace.env).sort(), [...TRACE_ENV].sort());
  } finally {
    done();
  }
});

test('a test that reads the home outside the temporary folder, or opens a network connection, is untraced', () => {
  const { root, traces, done } = project({
    'package.json': '{"type":"module"}',
    'test/home.test.mjs': "import { test } from 'node:test';\nimport fs from 'node:fs';\nimport os from 'node:os';\nimport path from 'node:path';\ntest('home', () => { fs.existsSync(path.join(os.homedir(), 'settings.json')); });\n",
    'test/net.test.mjs': [
      "import { test } from 'node:test';",
      "import net from 'node:net';",
      "test('net', async () => {",
      "  const server = net.createServer((socket) => socket.end()).listen(0, '127.0.0.1');",
      "  await new Promise((resolve) => server.once('listening', resolve));",
      "  await new Promise((resolve, reject) => net.connect(server.address().port, '127.0.0.1').on('close', resolve).on('error', reject));",
      "  server.close();",
      "});",
    ].join('\n'),
  });
  // A home of its own, and a temporary folder beside it, not around it: on Windows the real one is under the home.
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-home-'));
  const home = path.join(base, 'home');
  const temp = path.join(base, 'temp');
  fs.mkdirSync(home);
  fs.mkdirSync(temp);
  try {
    const env = { ...process.env, ...traceEnv({ root, dir: traces }), HOME: home, USERPROFILE: home, TMPDIR: temp, TEMP: temp, TMP: temp };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ['--test', 'test/home.test.mjs', 'test/net.test.mjs'], { cwd: root, env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(readTrace(traces, 'test/home.test.mjs').untraced ?? '', /reads the home/);
    assert.match(readTrace(traces, 'test/net.test.mjs').untraced ?? '', /network/);
  } finally {
    done();
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('with a results file, every test file adds how it ended, failed or passed, for the shadow count (S6)', () => {
  const { root, traces, done } = project({
    'package.json': '{"type":"module"}',
    'test/ok.test.mjs': "import { test } from 'node:test';\ntest('ok', () => {});\n",
    'test/red.test.mjs': "import { test } from 'node:test';\ntest('red', () => { throw new Error('red'); });\n",
  });
  const results = path.join(traces, 'results.jsonl');
  try {
    const env = { ...process.env, ...traceEnv({ root, dir: traces, results }) };
    delete env.NODE_TEST_CONTEXT;
    assert.notEqual(spawnSync(process.execPath, ['--test', 'test/ok.test.mjs', 'test/red.test.mjs'], { cwd: root, env, encoding: 'utf8' }).status, 0);
    const ended = fs.readFileSync(results, 'utf8').trim().split('\n').map((line) => JSON.parse(line)).sort((a, b) => a.test.localeCompare(b.test));
    assert.deepEqual(ended.map(({ test: file, code }) => [file, code === 0]), [['test/ok.test.mjs', true], ['test/red.test.mjs', false]]);
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

// Under the tracer a test sees the environment it would see without it: a test that copies process.env for a
// child, or compares the env a child got, was measured to break otherwise (the first gate in shadow, 18 tests).
const SEES_NOTHING = [
  "import { test } from 'node:test';",
  "import { spawnSync } from 'node:child_process';",
  "const ours = (env) => Object.keys(env).filter((key) => key.startsWith('JS_HARNESS_TRACE_'));",
  "test('clean', () => {",
  "  if (ours(process.env).length > 0) throw new Error('the test sees ' + ours(process.env));",
  "  if (process.env.NODE_OPTIONS !== '--max-old-space-size=300') throw new Error('NODE_OPTIONS is ' + process.env.NODE_OPTIONS);",
  "  const env = { PATH: process.env.PATH, NODE_OPTIONS: '', ...(process.env.SystemRoot && { SystemRoot: process.env.SystemRoot }) };",
  "  const child = spawnSync(process.execPath, ['lib/env.cjs'], { encoding: 'utf8', env });",
  "  if (child.stdout.trim() !== '{\"keys\":[],\"options\":\"\"}') throw new Error('the child sees ' + child.stdout + child.stderr);",
  "  const bare = spawnSync(process.execPath, ['lib/env.cjs'], { encoding: 'utf8' });",
  "  if (bare.stdout.trim() !== '{\"keys\":[],\"options\":\"--max-old-space-size=300\"}') throw new Error('a child of the inherited env sees ' + bare.stdout + bare.stderr);",
  "});",
].join('\n');

test('a traced test file and its node children see none of the tracer: no variable of its own, and NODE_OPTIONS as it was, yet the child is traced', () => {
  const { root, traces, done } = project({
    'package.json': '{"type":"module"}',
    'test/env.test.mjs': SEES_NOTHING,
    'lib/env.cjs': "require('node:fs').readFileSync(require('node:path').join(__dirname, 'seen.txt'));\nconsole.log(JSON.stringify({ keys: Object.keys(process.env).filter((key) => key.startsWith('JS_HARNESS_TRACE_')), options: process.env.NODE_OPTIONS ?? null }));\n",
    'lib/seen.txt': 'seen',
  });
  try {
    const env = { ...process.env, ...traceEnv({ root, dir: traces, existing: '--max-old-space-size=300' }) };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ['--test', 'test/env.test.mjs'], { cwd: root, env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const trace = readTrace(traces, 'test/env.test.mjs');
    assert.ok(trace.reads['lib/seen.txt'], JSON.stringify(trace.reads));
  } finally {
    done();
  }
});

// Every call shape of child_process keeps its meaning under the tracer, and each node child it starts is traced:
// with the tracer's variables out of process.env, a child that got no env of the tracer's would be unseen.
const EVERY_SHAPE = [
  "import { test } from 'node:test';",
  "import assert from 'node:assert/strict';",
  "import cp from 'node:child_process';",
  "import { promisify } from 'node:util';",
  "const node = process.execPath;",
  "test('shapes', async () => {",
  "  await new Promise((resolve, reject) => cp.execFile(node, ['lib/one.cjs'], (error, out) => (error ? reject(error) : resolve(assert.equal(out.trim(), 'one')))));",
  "  const { stdout, stderr } = await promisify(cp.execFile)(node, ['lib/two.cjs']);",
  "  assert.equal(stdout.trim(), 'two');",
  "  assert.equal(stderr, '');",
  "  const shell = await promisify(cp.exec)('\"' + node + '\" lib/three.cjs');",
  "  assert.equal(shell.stdout.trim(), 'three');",
  "  await new Promise((resolve) => cp.spawn(node, ['lib/four.cjs']).on('close', resolve));",
  "});",
].join('\n');

test('every call shape of child_process keeps its meaning, promisify included, and each node child is traced', () => {
  const child = (name) => `require('node:fs').readFileSync(require('node:path').join(__dirname, '${name}.txt'));\nconsole.log('${name}');\n`;
  const { root, traces, done } = project({
    'package.json': '{"type":"module"}',
    'test/shapes.test.mjs': EVERY_SHAPE,
    ...Object.fromEntries(['one', 'two', 'three', 'four'].flatMap((name) => [[`lib/${name}.cjs`, child(name)], [`lib/${name}.txt`, name]])),
  });
  try {
    const result = runTests(root, traces, ['test/shapes.test.mjs']);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const { reads } = readTrace(traces, 'test/shapes.test.mjs');
    for (const name of ['one', 'two', 'three', 'four']) assert.ok(reads[`lib/${name}.txt`], `${name}: ${JSON.stringify(Object.keys(reads))}`);
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

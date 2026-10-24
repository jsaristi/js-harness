import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import nodeModule from 'node:module';
import { hashOf, readTraces, TRACE_ENV, TRACE_PRELOAD, TRACER_VERSION, traceEnv } from './trace-reads.mjs';

const { KEPT_TRACES, pruneTraces, writeTrace } = nodeModule.createRequire(import.meta.url)('./trace-reads.cjs');
/** The newest stored trace of `test` in `dir`, or `null` when there is none. */
const readTrace = (dir, test) => readTraces(dir, test)[0] ?? null;

/** Whether this node has `module.registerHooks`, by which the tracer sees imports (Node 22.15 and later). */
const HOOKS = typeof nodeModule.registerHooks === 'function';

/** The reason a trace is untraced, as `reason` says where this node has module hooks; without them the tracer
 * marks every test untraced for that first, and later reasons do not replace it (T3c, Codex 2026-10-14).
 * `null` asserts a traced test. */
function assertUntraced(trace, reason, message) {
  if (!HOOKS) return assert.match(trace?.untraced ?? '', /has no module\.registerHooks/, message);
  if (reason === null) return assert.equal(trace?.untraced, null, message);
  return typeof reason === 'string' ? assert.equal(trace?.untraced, reason, message) : assert.match(trace?.untraced ?? '', reason, message);
}

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
    // A node of the engines field (>=24) without module hooks marks every test untraced, on purpose (Codex, 2026-10-14).
    assertUntraced(trace, null);
    const reads = trace.reads;
    assert.equal(reads['test/all.test.mjs'], hashOf(path.join(root, 'test/all.test.mjs')));
    assert.equal(reads['fixtures/data.txt'], hashOf(path.join(root, 'fixtures/data.txt')));
    assert.equal(reads['fixtures/not-there.txt'], 'absent');
    assert.match(reads['fixtures/'], /^listing:[0-9a-f]{64}$/);
    if (HOOKS) assert.equal(reads['lib/two.mjs'], hashOf(path.join(root, 'lib/two.mjs')));
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
    if (HOOKS) assert.equal(reads['lib/three.mjs'], hashOf(path.join(root, 'lib/three.mjs')), 'a dynamic import');
  } finally {
    done();
  }
});

test('a file read through fs.openAsBlob is a read of the trace, and its blob still holds the content (C-shared-11)', () => {
  const { root, traces, done } = project({
    'package.json': '{"type":"module"}',
    'test/blob.test.mjs': [
      "import { test } from 'node:test';",
      "import fs from 'node:fs';",
      "test('blob', async () => {",
      "  const blob = await fs.openAsBlob('fixtures/blob.txt');",
      "  if ((await blob.text()) !== 'blob') throw new Error('the blob holds the file');",
      "});",
    ].join('\n'),
    'fixtures/blob.txt': 'blob',
  });
  try {
    const result = runTests(root, traces, ['test/blob.test.mjs']);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const { reads } = readTrace(traces, 'test/blob.test.mjs');
    assert.equal(reads['fixtures/blob.txt'], hashOf(path.join(root, 'fixtures/blob.txt')), 'fs.openAsBlob');
  } finally {
    done();
  }
});

// Reads no trace can follow make a test untraced, so it always runs (Codex, 2026-10-14, four P2): a home file
// named by a URL, a recursive listing (its listing hash holds the first level only), an import that did not
// resolve (a module that appears later changes the test), and a shell string that does more than start node.
const UNFOLLOWED = {
  'test/home-url.test.mjs': "import { test } from 'node:test';\nimport fs from 'node:fs';\nimport os from 'node:os';\nimport path from 'node:path';\nimport { pathToFileURL } from 'node:url';\ntest('home', () => { fs.existsSync(pathToFileURL(path.join(os.homedir(), 'settings.json'))); });\n",
  'test/recursive.test.mjs': "import { test } from 'node:test';\nimport fs from 'node:fs';\ntest('deep', () => { fs.readdirSync('fixtures', { recursive: true }); });\n",
  'test/optional.test.mjs': "import { test } from 'node:test';\ntest('optional', async () => { await import('./not-there.mjs').catch(() => null); });\n",
  'test/compound.test.mjs': "import { test } from 'node:test';\nimport os from 'node:os';\nimport { execSync } from 'node:child_process';\ntest('compound', () => { execSync('node -e 0 && node -e 0', { cwd: os.tmpdir() }); });\n",
};

test('a home file named by a URL, a recursive listing, an import that did not resolve, or a compound shell string marks a test untraced', () => {
  const { root, traces, done } = project({ 'package.json': '{"type":"module"}', 'fixtures/deep/x.txt': 'x', ...UNFOLLOWED });
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-home-'));
  const home = path.join(base, 'home');
  const temp = path.join(base, 'temp');
  fs.mkdirSync(home);
  fs.mkdirSync(temp);
  try {
    const env = { ...process.env, ...traceEnv({ root, dir: traces }), HOME: home, USERPROFILE: home, TMPDIR: temp, TEMP: temp, TMP: temp };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ['--test', ...Object.keys(UNFOLLOWED)], { cwd: root, env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assertUntraced(readTrace(traces, 'test/home-url.test.mjs'), /reads the home/);
    assertUntraced(readTrace(traces, 'test/recursive.test.mjs'), /recursive/);
    assertUntraced(readTrace(traces, 'test/optional.test.mjs'), /did not resolve: \.\/not-there\.mjs/);
    assertUntraced(readTrace(traces, 'test/compound.test.mjs'), /shell/);
  } finally {
    done();
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('a repository with no package.json records it as absent, so one that appears changes the trace', () => {
  const { root, traces, done } = project({ 'test/a.test.mjs': "import { test } from 'node:test';\ntest('a', () => {});\n" });
  try {
    assert.equal(runTests(root, traces, ['test/a.test.mjs']).status, 0);
    assert.equal(readTrace(traces, 'test/a.test.mjs').reads['package.json'], 'absent');
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
    assertUntraced(readTrace(traces, 'test/home.test.mjs'), /reads the home/);
    assertUntraced(readTrace(traces, 'test/net.test.mjs'), /network/);
  } finally {
    done();
    fs.rmSync(base, { recursive: true, force: true });
  }
});

// A file of its own for each test file, not lines appended to one: at the gate of 19:56 (2026-10-14, in WSL2)
// a test file that passed had no end in the shared file; appends of processes at once through /mnt are the
// likely cause (inferred, not measured), and a file each leaves nothing to interleave.
test('with a results folder, every test file writes how it ended, failed or passed, in a file of its own, for the shadow count (S6)', () => {
  const { root, traces, done } = project({
    'package.json': '{"type":"module"}',
    'test/ok.test.mjs': "import { test } from 'node:test';\ntest('ok', () => {});\n",
    'test/red.test.mjs': "import { test } from 'node:test';\ntest('red', () => { throw new Error('red'); });\n",
  });
  const results = path.join(traces, 'results');
  try {
    const env = { ...process.env, ...traceEnv({ root, dir: traces, results }) };
    delete env.NODE_TEST_CONTEXT;
    assert.notEqual(spawnSync(process.execPath, ['--test', 'test/ok.test.mjs', 'test/red.test.mjs'], { cwd: root, env, encoding: 'utf8' }).status, 0);
    const files = fs.readdirSync(results);
    assert.equal(files.length, 2, files.join(', '));
    const ended = files.map((name) => JSON.parse(fs.readFileSync(path.join(results, name), 'utf8'))).sort((a, b) => a.test.localeCompare(b.test));
    assert.deepEqual(ended.map(({ test: file, code }) => [file, code === 0]), [['test/ok.test.mjs', true], ['test/red.test.mjs', false]]);
    // And how long its process ran, for the throughput review's per-file times (B5).
    for (const one of ended) assert.ok(Number.isFinite(one.seconds) && one.seconds > 0 && one.seconds < 60, JSON.stringify(one));
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
    assertUntraced(readTrace(traces, 'test/git.test.mjs'), /git.*runs in the repository/);
    assertUntraced(readTrace(traces, 'test/elsewhere.test.mjs'), null, 'a child out of the repository reads nothing of it');
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

// The result memory (odd/tasks/result-memory.md, T1b): a pass keeps a trace per content key, so passes with
// other inputs (another worktree, an earlier state) are all kept, newest first; a failure leaves none.
test('passes with different inputs keep a trace each, newest first, and a failure removes every trace of the test', () => {
  const { root, traces, done } = project({
    'package.json': '{"type":"module"}',
    'test/f.test.mjs': "import { test } from 'node:test';\nimport fs from 'node:fs';\ntest('f', () => { if (fs.readFileSync('f.txt', 'utf8') === 'red') throw new Error('red'); });\n",
    'f.txt': 'one',
  });
  try {
    assert.equal(runTests(root, traces, ['test/f.test.mjs']).status, 0);
    fs.writeFileSync(path.join(root, 'f.txt'), 'two');
    assert.equal(runTests(root, traces, ['test/f.test.mjs']).status, 0);
    const kept = readTraces(traces, 'test/f.test.mjs');
    assert.equal(kept.length, 2);
    assert.equal(kept[0].reads['f.txt'], hashOf(path.join(root, 'f.txt')), 'the newest is the last pass');
    assert.deepEqual(readTrace(traces, 'test/f.test.mjs'), kept[0]);
    fs.writeFileSync(path.join(root, 'f.txt'), 'red');
    assert.notEqual(runTests(root, traces, ['test/f.test.mjs']).status, 0);
    assert.deepEqual(readTraces(traces, 'test/f.test.mjs'), []);
  } finally {
    done();
  }
});

test('a pass with the inputs of a stored trace replaces it, and only the newest traces of a test are kept', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-prune-'));
  try {
    const trace = (n) => ({ v: 1, test: 't.test.mjs', tracer: TRACER_VERSION, tracerHash: 'h', node: 'v1', os: 'linux', env: {}, untraced: null, reads: { 'f.txt': `hash-${n}` } });
    writeTrace(dir, trace(0));
    writeTrace(dir, trace(0));
    assert.equal(readTraces(dir, 't.test.mjs').length, 1, 'the same inputs are one trace');
    for (let n = 1; n <= KEPT_TRACES + 2; n += 1) writeTrace(dir, trace(n));
    assert.equal(readTraces(dir, 't.test.mjs').length, KEPT_TRACES);
    // Pruning keeps the newest by when each was written, whatever their names.
    const folder = path.join(dir, encodeURIComponent('t.test.mjs'));
    const names = fs.readdirSync(folder).sort();
    names.forEach((name, at) => fs.utimesSync(path.join(folder, name), new Date(2026, 0, 1, 0, at), new Date(2026, 0, 1, 0, at)));
    pruneTraces(folder, 3);
    assert.deepEqual(fs.readdirSync(folder).sort(), names.slice(-3));
    assert.deepEqual(readTraces(dir, 't.test.mjs').map((one) => one.reads['f.txt']), names.slice(-3).reverse().map((name) => JSON.parse(fs.readFileSync(path.join(folder, name), 'utf8')).reads['f.txt']));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
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

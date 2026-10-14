import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { selectTests, testFilesOf } from './select-tests.mjs';
import { TRACE_PRELOAD, TRACER_VERSION, hashOf, traceEnvOf } from './trace-reads.mjs';

// The selection of exact test selection (odd/tasks/exact-tests.md, T2): which test files a gate runs, from
// the traces of their last passing runs, and the whole suite whenever a trace cannot be trusted.

/** A trace as the tracer writes one, for `test`, with `reads` (path to state) and what else it is given. */
const traceOf = (test, reads, over = {}) => ({ v: 1, test, tracer: TRACER_VERSION, tracerHash: hashOf(TRACE_PRELOAD), node: process.version, os: process.platform, env: traceEnvOf(process.env), untraced: null, reads, ...over });

/** A store of traces, and the states the tree has now, as `selectTests` asks them. */
function select(tests, traces, now) {
  const byTest = new Map(traces.map((one) => [one.test, one]));
  return selectTests({ tests, readTrace: (one) => byTest.get(one) ?? null, stateOf: (key) => now[key] ?? 'absent' });
}

test('a test whose every recorded read is as it was when it passed is skipped; one whose read changed runs, and says which', () => {
  const now = { 'a.test.mjs': 'h-a', 'lib/a.mjs': 'h-1', 'b.test.mjs': 'h-b', 'lib/b.mjs': 'h-2-new', 'fixtures/': 'listing:x', 'gone.txt': 'absent' };
  const traces = [
    traceOf('a.test.mjs', { 'a.test.mjs': 'h-a', 'lib/a.mjs': 'h-1', 'fixtures/': 'listing:x', 'gone.txt': 'absent' }),
    traceOf('b.test.mjs', { 'b.test.mjs': 'h-b', 'lib/b.mjs': 'h-2' }),
  ];
  const chosen = select(['a.test.mjs', 'b.test.mjs'], traces, now);
  assert.deepEqual(chosen.run, ['b.test.mjs']);
  assert.deepEqual(chosen.skipped, ['a.test.mjs']);
  assert.equal(chosen.why.get('b.test.mjs'), 'lib/b.mjs changed');
  assert.equal(chosen.full, null);
});

test('a probed file that appears, a listing that changes, or a read file that is gone, each runs the test', () => {
  const base = { 't.test.mjs': 'h-t' };
  for (const [reads, now, said] of [
    [{ 'maybe.txt': 'absent' }, { 'maybe.txt': 'h-new' }, 'maybe.txt changed'],
    [{ 'fixtures/': 'listing:old' }, { 'fixtures/': 'listing:new' }, 'fixtures/ changed'],
    [{ 'data.txt': 'h-d' }, {}, 'data.txt changed'],
  ]) {
    const chosen = select(['t.test.mjs'], [traceOf('t.test.mjs', { ...base, ...reads })], { ...base, ...now });
    assert.deepEqual(chosen.run, ['t.test.mjs'], said);
    assert.equal(chosen.why.get('t.test.mjs'), said);
  }
});

test('a test with no trace, an untraced one, or one traced by another node or another tracer always runs', () => {
  const now = { 't.test.mjs': 'h' };
  const reads = { 't.test.mjs': 'h' };
  const cases = [
    [[], 'no trace of a passing run'],
    [[traceOf('t.test.mjs', reads, { untraced: 'it reads the clock' })], 'untraced: it reads the clock'],
    [[traceOf('t.test.mjs', reads, { node: 'v0.0.1' })], `traced under node v0.0.1, not ${process.version}`],
    [[traceOf('t.test.mjs', reads, { tracerHash: 'other' })], 'traced by another version of the tracer'],
  ];
  for (const [traces, said] of cases) {
    const chosen = select(['t.test.mjs'], traces, now);
    assert.deepEqual(chosen.run, ['t.test.mjs'], said);
    assert.equal(chosen.why.get('t.test.mjs'), said);
  }
});

test('a test traced on another system, or with another value of an allowlisted variable, runs', () => {
  const now = { 't.test.mjs': 'h' };
  const reads = { 't.test.mjs': 'h' };
  const env = traceEnvOf({ TZ: 'UTC' });
  const traces = (over) => new Map([['t.test.mjs', traceOf('t.test.mjs', reads, { os: 'linux', env, ...over })]]);
  const ask = (over, run = {}) => selectTests({ tests: ['t.test.mjs'], readTrace: (one) => traces(over).get(one) ?? null, stateOf: (key) => now[key] ?? 'absent', os: 'linux', env, ...run });
  assert.deepEqual(ask({}).skipped, ['t.test.mjs']);
  assert.equal(ask({ os: 'win32' }).why.get('t.test.mjs'), 'traced on win32, not linux');
  assert.equal(ask({}, { env: traceEnvOf({ TZ: 'America/Bogota' }) }).why.get('t.test.mjs'), 'traced with TZ=UTC, not TZ=America/Bogota');
});

test('a changed package.json is the whole suite, whatever the traces say', () => {
  const now = { 'a.test.mjs': 'h-a', 'package.json': 'h-new' };
  const traces = [traceOf('a.test.mjs', { 'a.test.mjs': 'h-a', 'package.json': 'h-old' })];
  const chosen = select(['a.test.mjs'], traces, now);
  assert.equal(chosen.full, 'package.json changed');
  assert.deepEqual(chosen.run, ['a.test.mjs']);
  assert.deepEqual(chosen.skipped, []);
});

test('the test files are the ones node --test finds by its default patterns, out of node_modules and .git', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-select-'));
  try {
    const files = ['bin/a.test.mjs', 'bin/b-test.js', 'bin/c_test.cjs', 'test-d.mjs', 'test.js', 'test/e.mjs', 'test/deep/f.cjs', 'bin/lib/plain.mjs', 'node_modules/x/y.test.mjs', '.git/z.test.mjs', 'docs/a.test.md'];
    for (const file of files) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), '');
    }
    assert.deepEqual(testFilesOf(root), ['bin/a.test.mjs', 'bin/b-test.js', 'bin/c_test.cjs', 'test-d.mjs', 'test.js', 'test/deep/f.cjs', 'test/e.mjs']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

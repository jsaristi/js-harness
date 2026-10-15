import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { checkSensor } from './check.mjs';
import { SYNCED_MARK } from './lib/gate-wsl.mjs';
import { TRACER_VERSION, TRACE_PRELOAD, hashOf, traceEnvOf } from './lib/trace-reads.mjs';

const { traceFolder, writeTrace } = createRequire(import.meta.url)('./lib/trace-reads.cjs');

// The tests sensor in shadow in WSL2 (odd/tasks/exact-tests.md, T3b): the suite runs in the mirror under the
// tracer, the traces of that place have a folder of their own, and selection is asked with the node, the
// system and the variables of the mirror, never those of Windows.

const UBUNTU = { distro: 'Ubuntu', node: '/home/a/.local/node/bin' };
const sensor = { name: 'tests', command: 'node --test' };

/** A project with two test files and a folder of traces, and the stand-ins of a gate on Windows that sends the
 * sensor to WSL2: `wslPath` mounts a path and remembers it; `spawn` plays the mirror, reading the runner it is
 * given, and writes, as the tracer in Linux would, a trace of each file under node `v24.9.0` and `ended`, the
 * code each file ended with, a file each, into the results folder the runner names. */
function gate({ ended = {}, reached = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-shadow-wsl-'));
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
  for (const name of ['a.test.mjs', 'b.test.mjs']) fs.writeFileSync(path.join(root, name), "import { test } from 'node:test';\ntest('x', () => {});\n");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-shadow-wsl-traces-'));
  const mounted = new Map();
  const wslPath = (where) => {
    const at = `/mnt/x/${path.resolve(where).replaceAll('\\', '/').replace(/^[A-Za-z]:\//, '').replace(/^\//, '')}`;
    mounted.set(at, path.resolve(where));
    return at;
  };
  const calls = [];
  const spawn = (command) => {
    const runner = /--exec bash "(.*)"$/.exec(command);
    const script = runner ? fs.readFileSync(mounted.get(runner[1]), 'utf8') : null;
    calls.push({ command, script });
    if (!script) return { status: 0, signal: null, stdout: 'on Windows\n', stderr: '' };
    if (!reached) return { status: 1, signal: null, stdout: '', stderr: 'no distribution\n' };
    const traceDir = /JS_HARNESS_TRACE_DIR='([^']*)'/.exec(script)?.[1];
    const results = /JS_HARNESS_TRACE_RESULTS='([^']*)'/.exec(script)?.[1];
    if (traceDir && results) {
      for (const one of ['a.test.mjs', 'b.test.mjs']) {
        const trace = { v: 1, test: one, tracer: TRACER_VERSION, tracerHash: hashOf(TRACE_PRELOAD), node: 'v24.9.0', os: 'linux', env: traceEnvOf({ LANG: 'C.UTF-8' }), untraced: null, reads: {} };
        writeTrace(mounted.get(traceDir), trace);
        fs.mkdirSync(mounted.get(results), { recursive: true });
        fs.writeFileSync(path.join(mounted.get(results), `${one}.json`), JSON.stringify({ test: one, code: ended[one] ?? 0 }));
      }
    }
    const failed = Object.values(ended).some((code) => code !== 0);
    return { status: failed ? 1 : 0, signal: null, stdout: 'suite\n', stderr: `${SYNCED_MARK}900 ms\n` };
  };
  const done = () => [root, dir].forEach((one) => fs.rmSync(one, { recursive: true, force: true }));
  const options = (over = {}) => ({ spawn, platform: 'win32', wsl: UBUNTU, wslPath, traces: { dir }, wslNode: () => 'v24.9.0', ...over });
  return { root, dir, calls, mounted, options, done };
}

test('in WSL2 the runner carries the tracer, its traces go to a folder of that distribution, and selection is asked with the node of the mirror', async () => {
  const { root, dir, calls, mounted, options, done } = gate({ ended: { 'b.test.mjs': 1 } });
  try {
    const first = await checkSensor(root, sensor, options());
    assert.deepEqual(first.shadow, { files: 2, wouldSkip: [], failedOfSkipped: [] });
    assert.match(calls[0].script, /JS_HARNESS_TRACE_DIR='[^']*\/wsl-Ubuntu' /);
    // The tracer is the harness's own, through the mount, whatever project the mirror holds.
    const preload = /NODE_OPTIONS='--require="?([^'"]*)"?'/.exec(calls[0].script)?.[1];
    assert.equal(mounted.get(preload), path.resolve(TRACE_PRELOAD));
    assert.deepEqual(fs.readdirSync(path.join(dir, 'wsl-Ubuntu')).sort(), [traceFolder('a.test.mjs'), traceFolder('b.test.mjs')].sort());
    // The traces are of the mirror's node: the same node there skips both, and b, which failed, is counted.
    const second = await checkSensor(root, sensor, options());
    assert.deepEqual(second.shadow, { files: 2, wouldSkip: ['a.test.mjs', 'b.test.mjs'], failedOfSkipped: ['b.test.mjs'] });
    assert.match(second.detail, /in WSL2 \(Ubuntu\); shadow: 2 of 2 test files would have been skipped, and 1 of them did not pass: b\.test\.mjs$/);
    // After an upgrade of the mirror's node every trace is of the old one: nothing would be skipped.
    const third = await checkSensor(root, sensor, options({ wslNode: () => 'v25.0.0' }));
    assert.deepEqual(third.shadow.wouldSkip, []);
  } finally {
    done();
  }
});

// Skip mode (T4c): the runner's command is the sensor's with the files to run, each a word of POSIX sh inside the
// outer word of `bash -c`; a suite that falls back to Windows runs whole there, since selection asked the WSL2 traces.
const skip = (dir) => ({ dir, mode: 'skip' });

test('in skip mode in WSL2 the runner\'s command carries the files selection runs, and a run of none starts no runner', async () => {
  const { root, dir, calls, options, done } = gate();
  try {
    // The flaky ledger names b: it always runs, and a, proven by its trace, is skipped from the second gate on.
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'docs', 'FLAKY.md'), '# Flaky tests\n\n### b.test.mjs\n- Owner: x\n');
    const first = await checkSensor(root, sensor, options({ traces: skip(dir) }));
    assert.equal(first.pass, true, first.output);
    assert.ok(calls[0].script.includes("bash -c 'node --test '\\''a.test.mjs'\\'' '\\''b.test.mjs'\\'''"), calls[0].script);
    assert.match(calls[0].script, /JS_HARNESS_TRACE_DIR='[^']*\/wsl-Ubuntu' /);
    const second = await checkSensor(root, sensor, options({ traces: skip(dir) }));
    assert.ok(calls[1].script.includes("bash -c 'node --test '\\''b.test.mjs'\\'''"), calls[1].script);
    assert.deepEqual(second.skip, { files: 2, skipped: 1 });
    assert.match(second.detail, /^node --test passed in WSL2 \(Ubuntu, its mirror synced in 0\.9 s\); exact tests: skipped 1 of 2 test files$/);
    assert.equal(second.shadow, undefined);
    fs.rmSync(path.join(root, 'docs'), { recursive: true });
    const third = await checkSensor(root, sensor, options({ traces: skip(dir) }));
    assert.equal(calls.length, 2, 'no runner for a run of none');
    assert.equal(third.pass, true);
    assert.deepEqual(third.skip, { files: 2, skipped: 2 });
    // Proven by the traces of WSL2, the place the tree key names.
    assert.equal(third.ranIn, 'wsl');
  } finally {
    done();
  }
});

test('in skip mode a suite of the mirror that falls back to Windows runs whole there, and the row says why', async () => {
  const { root, dir, calls, options, done } = gate({ reached: false });
  try {
    const row = await checkSensor(root, sensor, options({ traces: skip(dir) }));
    assert.equal(calls.length, 2);
    assert.match(calls[0].script, /'\\''a\.test\.mjs'\\''/);
    assert.equal(calls[1].command, 'node --test');
    assert.equal(row.pass, true);
    assert.deepEqual(row.skip, { files: 2, skipped: 0 });
    assert.match(row.detail, /on Windows: WSL2 did not run it \(no distribution\); exact tests: the whole suite ran, since it ran on Windows, where selection asked the traces of WSL2$/);
  } finally {
    done();
  }
});

test('no shadow where the node of the mirror cannot be asked, or where the suite fell back to Windows untraced', async () => {
  const unasked = gate();
  try {
    const row = await checkSensor(unasked.root, sensor, unasked.options({ wslNode: () => null }));
    assert.equal(row.shadow, undefined);
    assert.equal(/JS_HARNESS_TRACE_/.test(unasked.calls[0].script), false);
  } finally {
    unasked.done();
  }
  const fell = gate({ reached: false });
  try {
    const row = await checkSensor(fell.root, sensor, fell.options());
    assert.match(row.detail, /on Windows: WSL2 did not run it/);
    assert.equal(row.shadow, undefined);
    assert.equal(/shadow/.test(row.detail), false);
  } finally {
    fell.done();
  }
});

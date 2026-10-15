import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runnerScript } from './gate-wsl.mjs';

// The tests sensor in shadow in WSL2 (odd/tasks/exact-tests.md, T3b): the tracer's variables are set inside
// the runner script, in the mirror, where the suite runs.

const base = { source: '/mnt/d/w', mirror: 'w-1234', node: '/home/o/.local/node/bin', command: 'npm run test', held: true, heldVariable: 'JS_HARNESS_GATE_HELD', seconds: 600 };

const trace = { dir: '/mnt/d/w/.git/js-harness/traces/wsl-Ubuntu', results: '/mnt/d/w/.git/js-harness/traces/wsl-Ubuntu/r.jsonl', preload: '/mnt/c/h/bin/lib/trace-reads.cjs' };

test('a runner with a trace sets the tracer on the command line: the mirror as its root, its folder, its results, and the harness\'s preload', () => {
  const script = runnerScript({ ...base, trace });
  assert.match(script, /JS_HARNESS_TRACE_ROOT="\$mirror" /);
  assert.match(script, /JS_HARNESS_TRACE_DIR='\/mnt\/d\/w\/\.git\/js-harness\/traces\/wsl-Ubuntu' /);
  assert.match(script, /JS_HARNESS_TRACE_RESULTS='\/mnt\/d\/w\/\.git\/js-harness\/traces\/wsl-Ubuntu\/r\.jsonl' /);
  // `env -i` leaves no NODE_OPTIONS of the caller to keep: the preload is the whole of it.
  assert.match(script, /NODE_OPTIONS='--require=\/mnt\/c\/h\/bin\/lib\/trace-reads\.cjs' /);
  // On the line of the command, beside the mark of a sensor.
  const line = script.split('\n').find((one) => one.includes('JS_HARNESS_CHECK_INNER=1'));
  assert.ok(line.includes('JS_HARNESS_TRACE_ROOT'), line);
});

test('a preload under a folder with a space is quoted inside NODE_OPTIONS, as node splits it', () => {
  const script = runnerScript({ ...base, trace: { ...trace, preload: '/mnt/c/Program Files/h/trace-reads.cjs' } });
  assert.match(script, /NODE_OPTIONS='--require="\/mnt\/c\/Program Files\/h\/trace-reads\.cjs"' /);
});

test('a runner without a trace sets none of it', () => {
  assert.equal(/JS_HARNESS_TRACE_|trace-reads/.test(runnerScript(base)), false);
});

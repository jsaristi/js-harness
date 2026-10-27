// How the TUI runs a command (odd/tasks/tui-gentle-level.md, S4): a child whose output is piped to the menu,
// stopped with its whole tree on cancel, or one handed the terminal when it asks its own questions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn as realSpawn } from 'node:child_process';
import { runChild, handOff } from './run-child.mjs';

const node = process.execPath;

test('runChild streams stdout and stderr to onOutput and resolves to the exit code, the terminal never inherited', async () => {
  const seen = [];
  const result = await runChild(node, ['-e', 'console.log("out"); console.error("err"); process.exitCode = 3'], {
    onOutput: (text) => seen.push(text),
  });
  assert.deepEqual(result, { code: 3, cancelled: false });
  assert.match(seen.join(''), /out/);
  assert.match(seen.join(''), /err/);
});

test('runChild gives a child no stdin, so a command that would ask finds no terminal and cannot hang the menu', async () => {
  const seen = [];
  await runChild(node, ['-e', 'console.log(String(process.stdin.isTTY))'], { onOutput: (text) => seen.push(text) });
  assert.equal(seen.join('').trim(), 'undefined');
});

test('runChild reports a program it cannot start as an error, with no exit code', async () => {
  const result = await runChild(path.join(os.tmpdir(), 'js-harness-no-such-program'), [], { onOutput: () => {} });
  assert.equal(result.code, null);
  assert.equal(result.cancelled, false);
  assert.match(result.error, /ENOENT/);
});

test('an abort stops the child and what it started, and the result says it was cancelled', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-run-child-'));
  try {
    const marker = path.join(dir, 'grandchild-ran');
    // The child starts a grandchild that writes the marker after 4 s, then waits forever itself; the kill reads
    // the process table first (bin/lib/process-tree.mjs), which takes a moment on Windows.
    const grandchild = `setTimeout(() => require('fs').writeFileSync(${JSON.stringify(marker)}, 'x'), 4000)`;
    const script = `require('child_process').spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: 'ignore' }); console.log('started'); setInterval(() => {}, 1000)`;
    const controller = new AbortController();
    const started = Date.now();
    const result = await runChild(node, ['-e', script], {
      signal: controller.signal,
      onOutput: (text) => {
        if (text.includes('started')) setTimeout(() => controller.abort(), 200);
      },
    });
    assert.equal(result.cancelled, true);
    assert.ok(Date.now() - started < 4000, 'the child stopped before the grandchild would have written');
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, started + 4500 - Date.now())));
    assert.equal(fs.existsSync(marker), false, 'the grandchild was stopped with it');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an abort before the start runs nothing', async () => {
  const controller = new AbortController();
  controller.abort();
  const calls = [];
  const result = await runChild(node, ['-e', ''], { signal: controller.signal, spawn: (...args) => calls.push(args) });
  assert.deepEqual(result, { code: null, cancelled: true });
  assert.deepEqual(calls, []);
});

test('handOff gives the child the terminal itself and resolves to its exit code', async () => {
  let options;
  const fakeSpawn = (command, args, opts) => {
    options = opts;
    // The real spawn with no terminal of its own, so the test's output stays clean.
    return realSpawn(command, args, { stdio: 'ignore' });
  };
  const result = await handOff(node, ['-e', 'process.exitCode = 4'], { spawn: fakeSpawn });
  assert.equal(options.stdio, 'inherit');
  assert.deepEqual(result, { code: 4 });
});

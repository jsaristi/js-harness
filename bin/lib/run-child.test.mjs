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

/** Whether process `pid` is gone, probed (signal 0 sends nothing) for up to `ms`. */
async function goneWithin(pid, ms = 5000) {
  const until = Date.now() + ms;
  for (;;) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
    if (Date.now() > until) return false;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** Runs a child that starts a grandchild that waits forever, with `stdio` for it, and prints its pid; the child
 * itself waits too, or exits at once when `childStays` is false. Aborts once the pid is printed, and, when the
 * child exits at once, only once it is gone. */
async function abortTree(stdio, childStays) {
  const grandchild = 'setInterval(() => {}, 1000)';
  const script = `const g = require('child_process').spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: '${stdio}' }); console.log('started ' + g.pid + ' ' + process.pid);${childStays ? ' setInterval(() => {}, 1000);' : ''}`;
  const controller = new AbortController();
  let pid = null;
  const result = await runChild(node, ['-e', script], {
    signal: controller.signal,
    onOutput: (text) => {
      const found = /started (\d+) (\d+)/.exec(text);
      if (found && pid === null) {
        pid = Number(found[1]);
        if (childStays) controller.abort();
        else goneWithin(Number(found[2])).then(() => controller.abort());
      }
    },
  });
  return { result, pid };
}

test('an abort stops the child and what it started, and the result says it was cancelled', async () => {
  const { result, pid } = await abortTree('ignore', true);
  assert.equal(result.cancelled, true);
  assert.ok(pid > 0);
  assert.equal(await goneWithin(pid), true, 'the grandchild was stopped with it');
});

test('an abort after the child exited still stops what it left holding its output, and the run ends', async () => {
  // The grandchild shares the child's output, so the run stays open after the child exits, until it is stopped.
  const { result, pid } = await abortTree('inherit', false);
  assert.equal(result.cancelled, true);
  assert.equal(await goneWithin(pid), true, 'the survivor was stopped');
});

test('an abort stops a command that was handed the terminal, and its result says it was cancelled', async () => {
  const controller = new AbortController();
  const started = Date.now();
  setTimeout(() => controller.abort(), 300);
  const result = await handOff(node, ['-e', 'setInterval(() => {}, 1000)'], { signal: controller.signal, spawn: (cmd, args, opts) => realSpawn(cmd, args, { ...opts, stdio: 'ignore' }) });
  assert.equal(result.cancelled, true);
  assert.ok(Date.now() - started < 4000);
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

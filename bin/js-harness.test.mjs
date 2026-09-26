import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run as dispatch } from './js-harness.mjs';

const dispatcher = path.join(path.dirname(fileURLToPath(import.meta.url)), 'js-harness.mjs');

function run(args) {
  return spawnSync(process.execPath, [dispatcher, ...args], {
    encoding: 'utf8',
    env: { ...process.env, JS_HARNESS_CHECK_INNER: '1' },
  });
}

test('no args prints usage listing check and exits 0', () => {
  const result = run([]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /check/);
});

test('--help prints usage listing check and exits 0', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /check/);
});

test('unknown command exits 2', () => {
  const result = run(['bogus']);
  assert.equal(result.status, 2);
});

test('--help lists install, sync, uninstall, status, update and upgrade', () => {
  const result = run(['--help']);
  assert.match(result.stdout, /install/);
  assert.match(result.stdout, /sync/);
  assert.match(result.stdout, /uninstall/);
  assert.match(result.stdout, /status/);
  assert.match(result.stdout, /update/);
  assert.match(result.stdout, /upgrade/);
});

test('--help mentions the JS_HARNESS_HOME/SOURCE/PREFIX environment overrides', () => {
  const result = run(['--help']);
  assert.match(result.stdout, /JS_HARNESS_HOME/);
  assert.match(result.stdout, /JS_HARNESS_SOURCE/);
  assert.match(result.stdout, /JS_HARNESS_PREFIX/);
});

test('no args on a real TTY opens the TUI instead of printing help', async () => {
  const calls = [];
  const stdin = { isTTY: true };
  const stdout = { isTTY: true, write: () => {} };
  const tui = async (...args) => {
    calls.push(args);
    return 0;
  };

  const code = await dispatch([], { stdin, stdout, tui });

  assert.equal(code, 0);
  assert.equal(calls.length, 1);
});

test('--help prints usage even on a real TTY', async () => {
  const stdin = { isTTY: true };
  const stdout = { isTTY: true, write: () => {} };
  const tui = async () => {
    throw new Error('must not open the TUI for --help');
  };

  const code = await dispatch(['--help'], { stdin, stdout, tui });
  assert.equal(code, 0);
});

test('install dispatches to a temp home and exits 0', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-dispatch-'));
  try {
    const result = run(['install', '--home', home]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /installed js-harness/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// A global install on macOS/Linux reaches the bin through a symlink; the entry guard must follow it.
test('runs when invoked through a linked directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-link-'));
  const link = path.join(dir, 'bin');
  try {
    fs.symlinkSync(path.dirname(dispatcher), link, 'junction');
    const result = spawnSync(process.execPath, [path.join(link, 'js-harness.mjs'), '--help'], { encoding: 'utf8' });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage: js-harness/);
  } finally {
    // Remove the link itself first so cleanup can never reach through it into bin/.
    if (fs.existsSync(link)) fs.unlinkSync(link);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

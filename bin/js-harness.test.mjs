import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

test('--help lists install, sync and uninstall', () => {
  const result = run(['--help']);
  assert.match(result.stdout, /install/);
  assert.match(result.stdout, /sync/);
  assert.match(result.stdout, /uninstall/);
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

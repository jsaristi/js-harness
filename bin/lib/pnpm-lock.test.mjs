import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PNPM_LOCK_FIX, pnpmLockState } from './pnpm-lock.mjs';

const MINUTE = 60 * 1000;
const NOW = Date.parse('2026-10-16T17:30:00Z');

/** A pnpm home in a fresh temporary folder; `lock(ageMinutes)` leaves the global bin lock folder there, dated that
 * long before `NOW`. */
function pnpmHome() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-pnpm-lock-'));
  const lockPath = path.join(root, 'bin', '.pnpm-global-bin.lock');
  const lock = (ageMinutes) => {
    fs.mkdirSync(lockPath, { recursive: true });
    const at = new Date(NOW - ageMinutes * MINUTE);
    fs.utimesSync(lockPath, at, at);
  };
  return { root, lockPath, lock, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('a global bin lock older than ten minutes is stale, and its line names the folder and since when', () => {
  const home = pnpmHome();
  try {
    home.lock(11);
    const state = pnpmLockState({ env: { PNPM_HOME: home.root }, now: () => NOW });
    assert.deepEqual(state, {
      claude: 'stale',
      codex: 'n/a',
      lines: [`rmdir "${home.lockPath}" (left since ${new Date(NOW - 11 * MINUTE).toISOString()})`],
    });
  } finally {
    home.cleanup();
  }
});

test('a global bin lock of the last ten minutes is ok: an install may be holding it', () => {
  const home = pnpmHome();
  try {
    home.lock(9);
    assert.deepEqual(pnpmLockState({ env: { PNPM_HOME: home.root }, now: () => NOW }), { claude: 'ok', codex: 'n/a', lines: [] });
  } finally {
    home.cleanup();
  }
});

test('no global bin lock is ok', () => {
  const home = pnpmHome();
  try {
    assert.deepEqual(pnpmLockState({ env: { PNPM_HOME: home.root }, now: () => NOW }), { claude: 'ok', codex: 'n/a', lines: [] });
  } finally {
    home.cleanup();
  }
});

test('a machine with no PNPM_HOME has no pnpm to check: n/a', () => {
  assert.deepEqual(pnpmLockState({ env: {}, now: () => NOW }), { claude: 'n/a', codex: 'n/a', lines: [] });
});

test('a lock path that cannot be read is unknown, never a throw', () => {
  const stat = () => {
    throw Object.assign(new Error('operation not permitted'), { code: 'EPERM' });
  };
  assert.deepEqual(pnpmLockState({ env: { PNPM_HOME: 'C:/pnpm' }, now: () => NOW, stat }), { claude: 'unknown', codex: 'n/a', lines: [] });
});

test('the fix says what the lock does to the next install and that rmdir removes only an empty folder', () => {
  assert.match(PNPM_LOCK_FIX, /pnpm add -g/);
  assert.match(PNPM_LOCK_FIX, /five minutes/);
  assert.match(PNPM_LOCK_FIX, /no pnpm/i);
  assert.match(PNPM_LOCK_FIX, /rmdir/);
});

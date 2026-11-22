// Tests of ./leftover-age.mjs: C4.2 of odd/tasks/f8-s8-certification.md (T3), the harness's temp folders, locks and
// processes older than a day, read at one snapshot time and writing nothing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { LEFTOVER_AGE_HOURS, leftoverAge } from './leftover-age.mjs';

const NOW = new Date('2026-11-22T12:00:00.000Z');
const hoursAgo = (hours) => new Date(NOW.getTime() - hours * 3600 * 1000);

function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leftover-age-'));
  const home = path.join(dir, 'home');
  const tmpdir = path.join(dir, 'tmp');
  fs.mkdirSync(path.join(home, '.js-harness'), { recursive: true });
  fs.mkdirSync(tmpdir);
  return { dir, home, tmpdir };
}

function made(target, hours, { folder = true } = {}) {
  if (folder) fs.mkdirSync(target, { recursive: true });
  else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, '');
  }
  fs.utimesSync(target, hoursAgo(hours), hoursAgo(hours));
}

/** Every path under `dir` with its modification time, to prove the check writes nothing. */
function snapshot(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      out.push(`${full} ${fs.lstatSync(full).mtimeMs}`);
      if (entry.isDirectory()) walk(full);
    }
  };
  walk(dir);
  return out.sort();
}

test('leftoverAge finds a 25-hour scratch folder and passes over a fresh one, one off the prefixes and one with a fresh file', () => {
  const { dir, home, tmpdir } = scratch();
  try {
    made(path.join(tmpdir, 'js-harness-merge-queue-old'), 25);
    made(path.join(tmpdir, 'js-harness-fresh'), 23);
    made(path.join(tmpdir, 'someone-elses-folder'), 100);
    made(path.join(tmpdir, 'tmp.recent'), 50);
    made(path.join(tmpdir, 'tmp.recent', 'inner.txt'), 1, { folder: false });
    const before = snapshot(dir);
    const found = leftoverAge({ home, tmpdir, now: () => NOW, listProcesses: () => [] });
    assert.deepEqual(found.folders, [{ path: path.join(tmpdir, 'js-harness-merge-queue-old'), hours: 25 }]);
    assert.equal(found.at, NOW.toISOString());
    assert.equal(found.over, 1);
    assert.deepEqual(snapshot(dir), before, 'the check wrote something');
    assert.equal(fs.existsSync(path.join(home, '.js-harness', 'clean.json')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('leftoverAge finds a stale lock under the harness home, a lock folder or a .lock file, and passes over a fresh one', () => {
  const { dir, home, tmpdir } = scratch();
  try {
    made(path.join(home, '.js-harness', 'gate', 'lock'), 30);
    made(path.join(home, '.js-harness', 'remote', 'a.lock'), 48, { folder: false });
    made(path.join(home, '.js-harness', 'hygiene', 'p', 'lock'), 2, { folder: false });
    const found = leftoverAge({ home, tmpdir, now: () => NOW, listProcesses: () => [] });
    assert.deepEqual(found.locks, [
      { path: path.join(home, '.js-harness', 'gate', 'lock'), hours: 30 },
      { path: path.join(home, '.js-harness', 'remote', 'a.lock'), hours: 48 },
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('leftoverAge finds a lingering process by its start time, and names one whose start it cannot read', () => {
  const { dir, home, tmpdir } = scratch();
  try {
    const processes = [
      { pid: 1, createdAt: hoursAgo(26).getTime(), commandLine: 'node js-harness merge-queue' },
      { pid: 2, createdAt: hoursAgo(3).toISOString(), commandLine: 'node codex-review' },
      { pid: 3, createdAt: null, commandLine: 'node lens-review' },
    ];
    const found = leftoverAge({ home, tmpdir, now: () => NOW, listProcesses: () => processes });
    assert.deepEqual(found.processes, [{ pid: 1, hours: 26, commandLine: 'node js-harness merge-queue' }]);
    assert.deepEqual(found.unread, ['process 3 has no start time: node lens-review']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('leftoverAge reads every age from one snapshot time and names a source it cannot read', () => {
  const { dir, home, tmpdir } = scratch();
  try {
    made(path.join(tmpdir, 'js-harness-edge'), LEFTOVER_AGE_HOURS + 0.5);
    let calls = 0;
    const now = () => {
      calls += 1;
      return calls === 1 ? NOW : new Date(NOW.getTime() + 48 * 3600 * 1000);
    };
    const found = leftoverAge({ home, tmpdir, now, listProcesses: () => { throw new Error('powershell is not there'); } });
    assert.equal(calls, 1);
    assert.equal(found.folders.length, 1);
    assert.deepEqual(found.unread, ['processes: powershell is not there']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

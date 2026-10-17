// The rule of the worktrees a repository can lose with nothing lost (odd/tasks/land-unattended.md, T9 to T11).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { worktreesInMain } from './worktrees.mjs';

// `doctor` counts with these git calls: one that hangs in one worktree must not hold the report (T11).
test('worktreesInMain bounds every git call it makes with a timeout', () => {
  const asked = [];
  const run = (command, args, options) => {
    asked.push({ args, timeout: options.timeout });
    if (args[0] === 'rev-parse') return { status: 0, stdout: 'abc\n' };
    if (args[0] === 'worktree') return { status: 0, stdout: 'worktree /main\nHEAD abc\nbranch refs/heads/main\n\nworktree /w/one\nHEAD abc\nbranch refs/heads/feat/one\n' };
    if (args[0] === 'merge-base') return { status: 0, stdout: '' };
    return { status: 1, stdout: '', stderr: 'no index' };
  };
  assert.deepEqual(worktreesInMain({ cwd: '/main', run }), []);
  assert.ok(asked.length >= 4, JSON.stringify(asked));
  for (const call of asked) assert.ok(Number.isInteger(call.timeout) && call.timeout > 0, JSON.stringify(call));
});

// A git killed at its limit must not leave an index.lock behind: that would break a worktree that was only slow
// (gentle-ai, 2026-10-17, R4).
test('worktreesInMain runs git without optional locks, so a call killed at its limit leaves no index.lock', () => {
  const envs = [];
  const run = (command, args, options) => {
    envs.push(options.env?.GIT_OPTIONAL_LOCKS);
    return { status: 1, stdout: '', stderr: 'no' };
  };
  worktreesInMain({ cwd: '/main', run });
  assert.ok(envs.length > 0);
  assert.deepEqual([...new Set(envs)], ['0']);
});

// The promise the README makes: a worktree whose git hangs is not counted, and the others still are (gentle-ai, R3).
test('worktreesInMain leaves out a worktree whose git call timed out and still counts the others', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'worktrees-'));
  const [one, two] = ['one', 'two'].map((name) => {
    const dir = path.join(home, name);
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'index'), '');
    const old = new Date(Date.now() - 60 * 60_000);
    fs.utimesSync(path.join(dir, 'index'), old, old);
    return dir;
  });
  try {
    const run = (command, args, options) => {
      if (args[0] === 'rev-parse' && args[1] === '--verify') return { status: 0, stdout: 'abc\n' };
      if (args[0] === 'rev-parse' && args[1] === '--git-path') return { status: 0, stdout: 'index\n' };
      if (args[0] === 'rev-parse') return { status: 0, stdout: '/main\n' };
      if (args[0] === 'worktree') {
        return { status: 0, stdout: `worktree /main\nHEAD abc\nbranch refs/heads/main\n\nworktree ${one}\nHEAD abc\nbranch refs/heads/feat/one\n\nworktree ${two}\nHEAD abc\nbranch refs/heads/feat/two\n` };
      }
      if (args[0] === 'merge-base') return { status: 0, stdout: '' };
      if (args[0] === 'status' && options.cwd === two) {
        return { status: null, stdout: '', error: Object.assign(new Error('spawnSync git ETIMEDOUT'), { code: 'ETIMEDOUT' }) };
      }
      if (args[0] === 'status') return { status: 0, stdout: '' };
      return { status: 1, stdout: '', stderr: 'unexpected' };
    };
    assert.deepEqual(worktreesInMain({ cwd: '/main', run }), [{ path: one, branch: 'feat/one' }]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

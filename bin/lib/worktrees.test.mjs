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

// The promise the README makes: a worktree whose git hangs is not counted, and the others still are (gentle-ai, R3).
// And no call takes optional locks: a `git status` killed at its limit must not leave an index.lock that breaks a
// worktree that was only slow (gentle-ai, 2026-10-17, R4); the status calls are the ones that matter.
test('worktreesInMain leaves out a worktree whose git call timed out, still counts the others, and takes no optional lock', () => {
  const locks = [];
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
      locks.push(`${args[0]}=${options.env?.GIT_OPTIONAL_LOCKS}`);
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
    assert.deepEqual(locks.filter((call) => call.startsWith('status=')), ['status=0', 'status=0']);
    assert.deepEqual(locks.filter((call) => !call.endsWith('=0')), []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

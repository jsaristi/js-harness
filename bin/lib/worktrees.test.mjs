// The rule of the worktrees a repository can lose with nothing lost (odd/tasks/land-unattended.md, T9 to T11).
import { test } from 'node:test';
import assert from 'node:assert/strict';
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

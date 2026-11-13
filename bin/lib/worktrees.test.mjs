// The rule of the worktrees a repository can lose with nothing lost (odd/tasks/land-unattended.md, T9 to T11).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HOST_FILES, worktreeCdRefusal, worktreeKept, worktreesInMain } from './worktrees.mjs';

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

// The promise the README makes: a worktree whose git hangs is not counted, and the others still are (a review, R3).
// And no call takes optional locks: a `git status` killed at its limit must not leave an index.lock that breaks a
// worktree that was only slow (a review, 2026-10-17, R4); the status calls are the ones that matter.
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

// odd/tasks/sessions-close-themselves.md: the rule for one worktree, with why it is kept. claude writes its settings
// copy into every worktree it makes; only a caller that names it has it left out, and nothing else ignored is.
test('worktreeKept says why a worktree stays, and leaves out only the host files it is given', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'worktrees-'));
  fs.writeFileSync(path.join(home, 'index'), '');
  const old = new Date(Date.now() - 60 * 60_000);
  fs.utimesSync(path.join(home, 'index'), old, old);
  const tree = { path: home, head: 'abc', branch: 'feat/one', locked: false, prunable: false };
  const git = ({ status = '', inBase = true } = {}) => (dir, ...args) => {
    if (args[0] === 'merge-base') return { ok: inBase, out: '' };
    if (args[0] === 'rev-parse') return { ok: true, out: 'index\n' };
    if (args[0] === 'status') return { ok: true, out: status };
    return { ok: false, out: '' };
  };
  const kept = (given, options = {}) => worktreeKept({ ...tree, ...given.tree }, { cwd: '/main', base: 'abc', baseName: 'origin/main', gitIn: git(given), ...options });
  try {
    assert.equal(kept({}), null);
    assert.equal(kept({ tree: { branch: null } }), 'it is on no branch');
    assert.equal(kept({ tree: { locked: true } }), 'it is locked');
    // The lock says who holds it, and only a lock the caller calls its own keeps nothing.
    const held = { locked: true, lockReason: 'claude session one (pid 7)' };
    assert.equal(kept({ tree: held }), 'it is locked: claude session one (pid 7)');
    assert.equal(kept({ tree: held }, { ownLock: (given) => given.lockReason.endsWith('(pid 7)') }), null);
    assert.equal(kept({ tree: held }, { ownLock: () => false }), 'it is locked: claude session one (pid 7)');
    assert.equal(kept({ inBase: false }), 'its head is not in origin/main');
    const settings = '!! .claude/settings.local.json\n';
    assert.equal(kept({ status: settings }), 'it holds what no branch brings back: !! .claude/settings.local.json');
    assert.equal(kept({ status: settings }, { hostFiles: HOST_FILES }), null);
    assert.equal(kept({ status: `${settings}!! evals/runs/\n?? a\n?? b\n?? c\n` }, { hostFiles: HOST_FILES }), 'it holds what no branch brings back: !! evals/runs/, ?? a, ?? b and 1 more');
    // A folder git reports whole is left out only while the host's file is all it holds.
    assert.equal(kept({ status: '!! .claude/\n' }, { hostFiles: HOST_FILES }), 'it holds what no branch brings back: !! .claude/');
    fs.mkdirSync(path.join(home, '.claude'));
    fs.writeFileSync(path.join(home, '.claude', 'settings.local.json'), '{}');
    assert.equal(kept({ status: '!! .claude/\n' }, { hostFiles: HOST_FILES }), null);
    assert.equal(kept({ status: '!! .claude/\n' }), 'it holds what no branch brings back: !! .claude/');
    fs.mkdirSync(path.join(home, '.claude', 'notes'));
    fs.writeFileSync(path.join(home, '.claude', 'notes', 'mine.md'), 'x');
    assert.equal(kept({ status: '!! .claude/\n' }, { hostFiles: HOST_FILES }), 'it holds what no branch brings back: !! .claude/');
    fs.utimesSync(path.join(home, 'index'), new Date(), new Date());
    assert.match(kept({}), /^its index changed 0 minutes ago, under the 10 a removal waits for$/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// ---- a cd into another session's worktree (odd/tasks/audit-cement.md, spec 2) ------------------------------------

test('a cd, pushd or Set-Location into another linked worktree is refused, naming git show and git -C', () => {
  const trees = () => ({ linked: ['D:/repo/.claude/worktrees/mine', 'D:/repo/.claude/worktrees/other', 'D:/repo-worktrees/feat'], here: 'D:/repo/.claude/worktrees/mine' });
  for (const command of [
    'cd D:/repo/.claude/worktrees/other',
    'cd "D:\\repo\\.claude\\worktrees\\other\\bin" && git status',
    'cd /d/repo/.claude/worktrees/other',
    'git status; cd ../other',
    'pushd D:/repo-worktrees/feat',
    'Set-Location -Path D:/REPO/.claude/worktrees/OTHER',
    'cd -P D:/repo-worktrees/feat/bin/lib',
  ]) {
    assert.match(worktreeCdRefusal(command, { cwd: 'D:/repo/.claude/worktrees/mine', worktrees: trees }) ?? '', /js-harness guard: .*another session's worktree.*git show.*git -C/s, command);
  }
});

test('a cd within the own worktree, to the main checkout or elsewhere passes, and git is asked only for a cd', () => {
  let asked = 0;
  const trees = () => {
    asked += 1;
    return { linked: ['D:/repo/.claude/worktrees/mine', 'D:/repo/.claude/worktrees/other'], here: 'D:/repo/.claude/worktrees/mine' };
  };
  const cwd = 'D:/repo/.claude/worktrees/mine';
  assert.equal(worktreeCdRefusal('git status && npm test', { cwd, worktrees: trees }), null);
  assert.equal(worktreeCdRefusal('echo "cd D:/repo/.claude/worktrees/other"', { cwd, worktrees: trees }), null);
  assert.equal(asked, 0);
  for (const command of ['cd bin/lib', 'cd D:/repo/.claude/worktrees/mine/docs', 'cd D:/repo', 'cd ~', 'cd -', 'cd', 'cd D:/repo/.claude/worktrees/other-not']) {
    assert.equal(worktreeCdRefusal(command, { cwd, worktrees: trees }), null, command);
  }
  // A git that cannot list the worktrees refuses nothing.
  assert.equal(worktreeCdRefusal('cd D:/repo/.claude/worktrees/other', { cwd, worktrees: () => null }), null);
});

test('from the main checkout, a cd into any linked worktree is refused', () => {
  const trees = () => ({ linked: ['D:/repo/.claude/worktrees/other'], here: 'D:/repo' });
  assert.match(worktreeCdRefusal('cd .claude/worktrees/other', { cwd: 'D:/repo', worktrees: trees }) ?? '', /another session's worktree/);
});

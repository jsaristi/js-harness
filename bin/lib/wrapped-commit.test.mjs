// The hint for a commit wrapped in `js-harness gate --` (odd/tasks/commit-gates-first.md, S4 and T3): which command
// lines wrap a commit or a merge, and what the hint says in a project whose commit gates go to GitHub and in one
// whose do not.
import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { CI_GATE_ENV, CI_WORKFLOW } from './ci-gate.mjs';
import { wrappedCommit, wrappedCommitHint } from './wrapped-commit.mjs';

test('a git commit or merge wrapped in js-harness gate -- is found, in any wrapped command, past git\'s own options', () => {
  const cases = [
    ['js-harness gate -- git commit -m x', { verb: 'commit', dir: null }],
    ['node bin/js-harness.mjs gate -- git commit -am "fix it"', { verb: 'commit', dir: null }],
    ['js-harness gate -- "npm test && git commit -m x"', { verb: 'commit', dir: null }],
    ['js-harness gate -- git -C D:/w -c core.pager=cat --no-pager commit -m x', { verb: 'commit', dir: 'D:/w' }],
    ['js-harness gate --no-wait -- git merge --no-ff feat/x', { verb: 'merge', dir: null }],
    ['cd D:/w && js-harness gate -- git.exe commit -m x', { verb: 'commit', dir: null }],
    // Through a shell's -c (Codex, 2026-10-17), as the test-run warning reads one.
    ['js-harness gate -- sh -c "git commit -m x"', { verb: 'commit', dir: null }],
    ['js-harness gate -- bash -lc "npm test && git -C D:/w commit -m x"', { verb: 'commit', dir: 'D:/w' }],
    // The gate's own --cwd is where the commit runs (Codex, 2026-10-17); git's -C is read from there.
    ['js-harness gate --cwd D:/other -- git commit -m x', { verb: 'commit', dir: 'D:/other' }],
    ['js-harness gate --cwd D:/other -- git -C sub commit -m x', { verb: 'commit', dir: path.join('D:/other', 'sub') }],
  ];
  for (const [command, found] of cases) assert.deepEqual(wrappedCommit(command), found, command);
});

test('a test run, a commit outside the wrapper, a commit that runs no gate and a merge that makes no commit get nothing', () => {
  for (const command of [
    'js-harness gate -- node --test bin/a.test.mjs bin/b.test.mjs',
    'js-harness gate -- npm test',
    'js-harness gate -- npm run check',
    'js-harness gate -- npm test && git commit -m x',
    'git commit -m x',
    'js-harness gate -- git commit --no-verify -m x',
    'js-harness gate -- git commit -n -m x',
    'js-harness gate -- git commit -anm x',
    'js-harness gate -- git merge --no-verify feat/x',
    'js-harness gate -- git merge --ff-only feat/x',
    'js-harness gate -- git merge --no-commit feat/x',
    'js-harness gate -- git merge --squash feat/x',
    'js-harness gate -- git merge --abort',
    'js-harness gate -- git log --grep commit',
    'js-harness gate -- echo git commit',
    'js-harness gate -- sh -c "git commit --no-verify -m x"',
    'js-harness gate -- sh script.sh git commit',
    'js-harness gate',
  ]) {
    assert.equal(wrappedCommit(command), null, command);
  }
});

test('-n is read as --no-verify only for a commit, and only before an option that takes the rest of its word', () => {
  assert.deepEqual(wrappedCommit('js-harness gate -- git commit -mnext'), { verb: 'commit', dir: null });
  // `git merge -n` is --no-stat: the merge commit still runs its hook.
  assert.deepEqual(wrappedCommit('js-harness gate -- git merge -n feat/x'), { verb: 'merge', dir: null });
});

// Folders resolved here, so `-C ../project` reads the same on Windows and on the Linux machines of CI.
const ROOT = path.resolve('project');
const OTHER = path.resolve('other');
const hint = (command, { env = {}, workflow = true, cwd = ROOT } = {}) => wrappedCommitHint(command, {
  cwd,
  env,
  projectRoot: (dir) => dir,
  exists: (file) => workflow && file === path.join(ROOT, CI_WORKFLOW),
});

test('in a project whose commit gates go to GitHub, the hint says the wrapped commit ran here and could not go there', () => {
  const said = hint('js-harness gate -- git commit -m x');
  assert.equal(said, 'js-harness guard: this `git commit` ran inside `js-harness gate --`, so its gate held the machine\'s '
    + 'lock and ran its tests here; it could not go to GitHub\'s machines, where a commit\'s gate goes first in a project '
    + `that holds ${CI_WORKFLOW}. Commit with a plain \`git commit\`: its hook waits for its turn by itself. A test run of `
    + 'your own still goes through `js-harness gate --`.');
  assert.match(hint('js-harness gate -- git merge feat/x'), /^js-harness guard: this `git merge` ran inside/);
  assert.match(hint('js-harness gate -- git merge feat/x'), /Merge with a plain `git merge`: its hook waits/);
});

test('without the workflow, with the switch off or on a CI machine, the hint says only that the hook waits by itself', () => {
  const plain = 'js-harness guard: this `git commit` ran inside `js-harness gate --`, so its gate held the machine\'s lock '
    + 'for the whole run. Commit with a plain `git commit`: its hook waits for its turn by itself. A test run of your '
    + 'own still goes through `js-harness gate --`.';
  assert.equal(hint('js-harness gate -- git commit -m x', { workflow: false }), plain);
  assert.equal(hint('js-harness gate -- git commit -m x', { env: { [CI_GATE_ENV]: '0' } }), plain);
  assert.equal(hint('js-harness gate -- git commit -m x', { env: { CI: 'true' } }), plain);
  assert.notEqual(hint('js-harness gate -- git commit -m x', { env: { CI: 'false' } }), plain);
});

test('the project is the one git -C names, read from the folder the command runs in', () => {
  assert.equal(hint('js-harness gate -- git -C elsewhere commit -m x', { cwd: OTHER }), hint('js-harness gate -- git commit -m x', { workflow: false }));
  assert.equal(hint('js-harness gate -- git -C ../project commit -m x', { cwd: OTHER }), hint('js-harness gate -- git commit -m x'));
  // The gate's --cwd moves the commit: to the project from elsewhere, and away from it.
  assert.equal(hint('js-harness gate --cwd ../project -- git commit -m x', { cwd: OTHER }), hint('js-harness gate -- git commit -m x'));
  assert.equal(hint('js-harness gate --cwd ../other -- git commit -m x'), hint('js-harness gate -- git commit -m x', { workflow: false }));
});

test('a command that wraps no commit gets no hint', () => {
  assert.equal(hint('js-harness gate -- npm test'), null);
  assert.equal(hint('git commit -m x'), null);
});

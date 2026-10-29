import assert from 'node:assert/strict';
import test from 'node:test';
import { branchMatches, headBefore, momentAt, pullRequestsOf, readRef } from './report-git.mjs';

/** A `run` that answers git by its arguments joined with spaces, from `answers`; anything else exits 128. */
const fakeGit = (answers) => (command, args) => {
  assert.equal(command, 'git');
  const key = args.join(' ');
  return Object.hasOwn(answers, key) ? { status: 0, stdout: answers[key], stderr: '' } : { status: 128, stdout: '', stderr: `fatal: no ${key}` };
};

const ROADMAP = `# R

## Checklist

### F1 Skeleton
- [x] a
- [ ] b

## F8 plan

### S0 Base
- **State:** done (\`odd/tasks/s0.md\`).

### S11 Complements
- **State:** in progress, worktree \`f8-s11\`, branch \`s11-doc\`.
`;

test('the default branch is origin/HEAD\'s, else main, as report and progress read it', () => {
  const run = fakeGit({ 'for-each-ref --format=%(refname)%00%(symref) refs/remotes/origin/HEAD refs/heads/main': 'refs/heads/main\0\n' });
  assert.deepEqual(readRef(run, '.'), { ref: 'refs/heads/main', name: 'main' });
  assert.ok(readRef(fakeGit({}), '.').error);
});

test('the commit of the default branch at a time is read on its first-parent line', () => {
  const run = fakeGit({ 'rev-list --first-parent -1 --before=2026-10-28T12:11:00.000Z refs/heads/main --': 'abc\n' });
  assert.equal(headBefore(run, '.', 'refs/heads/main', Date.parse('2026-10-28T12:11:00Z')), 'abc');
  assert.equal(headBefore(fakeGit({}), '.', 'refs/heads/main', 0), null);
});

test('a moment is the map, the plans and the task counts of the documents its steps name, quoted names found as documents', () => {
  const run = fakeGit({
    'show c1:docs/ROADMAP.md': ROADMAP,
    'ls-tree --name-only c1 -- odd/tasks/': 'odd/tasks/s0.md\nodd/tasks/s11-doc.md\n',
    'show c1:odd/tasks/s0.md': '## Tasks\n- [x] T1 (kind: build) a\n- [ ] T2 (kind: build) b\n',
    'show c1:odd/tasks/s11-doc.md': '## Tasks\n- [x] T1 (kind: build) a\n',
  });
  const moment = momentAt(run, '.', 'c1');
  assert.deepEqual({ done: moment.map.done, total: moment.map.total }, { done: 1, total: 2 });
  assert.deepEqual(moment.plans[0].steps.map((step) => step.documents), [['odd/tasks/s0.md'], ['odd/tasks/s11-doc.md']]);
  assert.deepEqual(moment.tasks, { 'odd/tasks/s0.md': { done: 1, total: 2 }, 'odd/tasks/s11-doc.md': { done: 1, total: 1 } });
});

test('a commit that holds no roadmap is a moment with no map, said with why', () => {
  const moment = momentAt(fakeGit({}), '.', 'c1');
  assert.ok(moment.unavailable);
});

test('the pull requests merged in a window are grouped by number, at their last merge, with every merge\'s commits', () => {
  const sep = '\u001f';
  const run = fakeGit({
    'log --first-parent --merges --format=%H%x1f%cI%x1f%s --since=2026-10-28T12:00:00.000Z refs/heads/main --':
      [`m3${sep}2026-10-28T15:00:00Z${sep}Merge pull request #7 from owner/feat-x`, `m2${sep}2026-10-28T14:00:00Z${sep}Merge branch 'main' into y`, `m1${sep}2026-10-28T13:00:00Z${sep}Merge pull request #7 from feat-x`].join('\n'),
    'log --no-merges --format=%H m3^1..m3^2 --': 'c3\n',
    'log --no-merges --format=%H m2^1..m2^2 --': 'c2\n',
    'log --no-merges --format=%H m1^1..m1^2 --': 'c1\nc0\n',
  });
  const prs = pullRequestsOf(run, '.', 'refs/heads/main', { from: Date.parse('2026-10-28T12:00:00Z'), to: Date.parse('2026-10-28T16:00:00Z') });
  assert.deepEqual(prs.map(({ number, branch, at, commits }) => ({ number, branch, at, commits })), [
    { number: null, branch: null, at: '2026-10-28T14:00:00.000Z', commits: ['c2'] },
    { number: 7, branch: 'feat-x', at: '2026-10-28T15:00:00.000Z', commits: ['c1', 'c0', 'c3'] },
  ]);
  assert.equal(prs[1].firstAt, '2026-10-28T13:00:00.000Z');
});

test('a branch matches its name, or its name after an owner, and nothing that only ends the same', () => {
  assert.equal(branchMatches('fix/board', 'fix/board'), true);
  assert.equal(branchMatches('owner/fix/board', 'fix/board'), true);
  assert.equal(branchMatches('fix/myboard', 'board'), false);
  assert.equal(branchMatches(null, 'x'), false);
});

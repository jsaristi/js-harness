import assert from 'node:assert/strict';
import test from 'node:test';
import { QUEUE_TRAILER, conflictSaid, mergeMessage, pullRequestProblems } from './pull-request.mjs';

const pr = (over = {}) => ({ number: 7, state: 'OPEN', isDraft: false, mergeable: 'MERGEABLE', baseRefName: 'main', body: 'Risk: none.', ...over });

test('an open, mergeable pull request on main has no problem of its own', () => {
  assert.deepEqual(pullRequestProblems(pr(), 'main'), []);
});

test('the base check names the default branch the queue reads, not main, when the project\'s default is another branch', () => {
  assert.deepEqual(pullRequestProblems(pr({ baseRefName: 'trunk' }), 'trunk'), []);
  assert.deepEqual(pullRequestProblems(pr(), 'trunk'), ['PR 7 targets main, not trunk.']);
});

test('each check of the pull request itself says which, in order', () => {
  for (const [over, said] of [
    [{ state: 'CLOSED' }, 'PR 7 is CLOSED, not open.'],
    [{ isDraft: true }, 'PR 7 is a draft.'],
    [{ mergeable: 'UNKNOWN' }, 'PR 7 is not mergeable (UNKNOWN).'],
    [{ mergeable: 'CONFLICTING' }, 'PR 7 is not mergeable (CONFLICTING): merge main into its branch and push it, since it conflicts with main itself.'],
    [{ baseRefName: 'dev' }, 'PR 7 targets dev, not main.'],
  ]) {
    assert.deepEqual(pullRequestProblems(pr(over), 'main'), [said], JSON.stringify(over));
  }
  assert.deepEqual(pullRequestProblems(pr({ state: 'MERGED', isDraft: true, baseRefName: 'dev' }), 'main'), ['PR 7 is MERGED, not open.', 'PR 7 is a draft.', 'PR 7 targets dev, not main.']);
});

test('a conflict with main names its fix: merge the branch it targets into the branch of the pull request, never for a mergeable GitHub has not computed (codex-spend, spec 3)', () => {
  assert.deepEqual(pullRequestProblems(pr({ mergeable: 'CONFLICTING', headRefName: 'feat/x' }), 'main'), ['PR 7 is not mergeable (CONFLICTING): merge main into its branch feat/x and push it, since it conflicts with main itself.']);
  assert.deepEqual(pullRequestProblems(pr({ mergeable: 'CONFLICTING', headRefName: 'feat/x' }), 'trunk'), ['PR 7 is not mergeable (CONFLICTING) with main, the branch it targets.', 'PR 7 targets main, not trunk.'], 'GitHub computes the conflict against the branch the pull request targets, which is not the one to merge in when the queue refuses that base (Codex, c3385fc0)');
  assert.deepEqual(pullRequestProblems(pr({ mergeable: 'UNKNOWN', headRefName: 'feat/x' }), 'main'), ['PR 7 is not mergeable (UNKNOWN).']);
  assert.equal(conflictSaid({ base: 'trunk', branch: 'feat/x', files: ['a.txt', 'b.txt'] }), 'merge trunk into its branch feat/x and push it, since it conflicts with trunk itself in a.txt, b.txt.');
  assert.equal(conflictSaid({ base: 'main' }), 'merge main into its branch and push it, since it conflicts with main itself.');
});

test('a conflict with an earlier pull request of the batch says it waits for that land, naming it, and no fix of its branch', () => {
  assert.equal(conflictSaid({ base: 'main', branch: 'feat/c', files: ['a.txt'], earlier: [1] }), 'it waits for the land of PR 1, which it conflicts with in a.txt.');
  assert.equal(conflictSaid({ base: 'main', branch: 'feat/c', files: ['a.txt'], earlier: [1, 2] }), 'it waits for the land of the earlier pull request it conflicts with, one of PR 1, PR 2 in a.txt.');
});

test('a body that names no review is no problem: the reviews are read from their records (F8 S11, L11)', () => {
  for (const body of ['No checks here.', null]) assert.deepEqual(pullRequestProblems(pr({ body }), 'main'), []);
});

test('the queue\'s merge message is GitHub\'s subject for a merged pull request, then the trailer that says the queue made it', () => {
  assert.equal(mergeMessage({ number: 807, headRefName: 'audit-u2-stop-hook' }), 'Merge pull request #807 from audit-u2-stop-hook\n\nMerged-by: js-harness merge-queue');
  assert.deepEqual(QUEUE_TRAILER, { key: 'Merged-by', value: 'js-harness merge-queue' });
});

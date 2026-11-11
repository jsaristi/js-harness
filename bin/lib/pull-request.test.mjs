import assert from 'node:assert/strict';
import test from 'node:test';
import { QUEUE_TRAILER, mergeMessage, pullRequestProblems } from './pull-request.mjs';

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
    [{ mergeable: 'CONFLICTING' }, 'PR 7 is not mergeable (CONFLICTING).'],
    [{ baseRefName: 'dev' }, 'PR 7 targets dev, not main.'],
  ]) {
    assert.deepEqual(pullRequestProblems(pr(over), 'main'), [said], JSON.stringify(over));
  }
  assert.deepEqual(pullRequestProblems(pr({ state: 'MERGED', isDraft: true, baseRefName: 'dev' }), 'main'), ['PR 7 is MERGED, not open.', 'PR 7 is a draft.', 'PR 7 targets dev, not main.']);
});

test('a body that names no review is no problem: the reviews are read from their records (F8 S11, L11)', () => {
  for (const body of ['No checks here.', null]) assert.deepEqual(pullRequestProblems(pr({ body }), 'main'), []);
});

test('the queue\'s merge message is GitHub\'s subject for a merged pull request, then the trailer that says the queue made it', () => {
  assert.equal(mergeMessage({ number: 807, headRefName: 'audit-u2-stop-hook' }), 'Merge pull request #807 from audit-u2-stop-hook\n\nMerged-by: js-harness merge-queue');
  assert.deepEqual(QUEUE_TRAILER, { key: 'Merged-by', value: 'js-harness merge-queue' });
});

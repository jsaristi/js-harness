import assert from 'node:assert/strict';
import test from 'node:test';
import { pullRequestProblems } from './pull-request.mjs';

const pr = (over = {}) => ({ number: 7, state: 'OPEN', isDraft: false, mergeable: 'MERGEABLE', baseRefName: 'main', body: 'Checks: gentle-ai assessment passive.', ...over });

test('an open, mergeable pull request on main with a gentle-ai line has no problem of its own', () => {
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
    [{ body: 'No checks here.' }, 'PR 7: its body has no gentle-ai line.'],
    [{ body: null }, 'PR 7: its body has no gentle-ai line.'],
  ]) {
    assert.deepEqual(pullRequestProblems(pr(over), 'main'), [said], JSON.stringify(over));
  }
  assert.deepEqual(pullRequestProblems(pr({ state: 'MERGED', isDraft: true, baseRefName: 'dev' }), 'main'), ['PR 7 is MERGED, not open.', 'PR 7 is a draft.', 'PR 7 targets dev, not main.']);
});

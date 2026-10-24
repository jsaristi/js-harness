import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultBranchOf } from './default-branch.mjs';

// A fake `answer(command, args)` that answers the calls named in `known` and refuses the rest; `asked` keeps them.
function fakeAnswer(known) {
  const asked = [];
  const answer = (command, args) => {
    const line = [command, ...args].join(' ');
    asked.push(line);
    return known[line] ?? { ok: false, out: '', err: 'unexpected' };
  };
  return { answer, asked };
}

const SYMBOLIC = 'git symbolic-ref --quiet refs/remotes/origin/HEAD';
const GH_VIEW = 'gh repo view --json defaultBranchRef -q .defaultBranchRef.name';

test('the default branch is the one origin/HEAD names, and gh is not asked', () => {
  const { answer, asked } = fakeAnswer({ [SYMBOLIC]: { ok: true, out: 'refs/remotes/origin/trunk\n', err: '' } });
  assert.deepEqual(defaultBranchOf(answer), { name: 'trunk', from: 'origin/HEAD' });
  assert.deepEqual(asked, [SYMBOLIC]);
});

test('with origin/HEAD unset, gh repo view names the default branch', () => {
  const { answer, asked } = fakeAnswer({ [GH_VIEW]: { ok: true, out: 'trunk\n', err: '' } });
  assert.deepEqual(defaultBranchOf(answer), { name: 'trunk', from: 'gh repo view' });
  assert.deepEqual(asked, [SYMBOLIC, GH_VIEW]);
});

test('when neither origin/HEAD nor gh names one, there is no default branch, and the reason names both commands', () => {
  const { answer } = fakeAnswer({});
  const found = defaultBranchOf(answer);
  assert.equal(found.name, null);
  assert.match(found.why, /git symbolic-ref refs\/remotes\/origin\/HEAD/);
  assert.match(found.why, /gh repo view --json defaultBranchRef/);
});

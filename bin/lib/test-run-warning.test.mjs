import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testRunFiles, testRunWarning } from './test-run-warning.mjs';

// The warning `js-harness guard --hook` gives for a whole test run started beside a gate
// (odd/tasks/test-run-warning.md). The look at the lock is a stand-in here: no test reads this machine's.

const HOLDER = { token: '1-a', pid: 1, cwd: 'D:\\js-harness-worktrees\\other' };
const held = () => HOLDER;
const free = () => null;
const warned = (what) => `node --test of ${what} starts outside a turn while the gate of D:\\js-harness-worktrees\\other holds the machine's gate lock: both share the cores and miss their bounds; run it with js-harness gate -- <command>, or one file at a time`;

test('testRunFiles counts the files of a node --test run as a command of its own, and is null for any other command', () => {
  assert.equal(testRunFiles('node --test'), 0);
  assert.equal(testRunFiles('node --test bin/a.test.mjs'), 1);
  assert.equal(testRunFiles('node --test bin/a.test.mjs bin/b.test.mjs'), 2);
  assert.equal(testRunFiles('node --test --test-name-pattern "two words" --test-reporter=tap bin/a.test.mjs'), 1);
  assert.equal(testRunFiles('cd D:/x && "C:\\Program Files\\nodejs\\node.exe" --test a.mjs b.mjs c.mjs'), 3);
  assert.equal(testRunFiles('npm test'), null);
  assert.equal(testRunFiles('echo node --test a b'), null);
  assert.equal(testRunFiles('node bin/check.mjs'), null);
});

test('testRunWarning warns for node --test of several files or of all while the lock is held outside a turn', () => {
  assert.equal(testRunWarning('node --test bin/a.test.mjs bin/b.test.mjs', { env: {}, holder: held }), warned('2 test files'));
  assert.equal(testRunWarning('node --test', { env: {}, holder: held }), warned('every test file'));
  assert.match(testRunWarning('node --test a b', { env: {}, holder: () => ({ token: null, pid: null }) }), /while another gate holds/);
});

test('testRunWarning says nothing for one file, a free lock, a run under js-harness gate, inside a turn, or another command', () => {
  for (const [command, env, holder] of [
    ['node --test bin/a.test.mjs', {}, held],
    ['node --test a b', {}, free],
    ['js-harness gate -- node --test a b', {}, held],
    ['node bin/js-harness.mjs gate --wait 240 -- node --test a b', {}, held],
    ['node --test a b', { JS_HARNESS_GATE_HELD: '1' }, held],
    ['node --test a b', { JS_HARNESS_CHECK_INNER: '1' }, held],
    ['git status', {}, held],
  ]) {
    assert.equal(testRunWarning(command, { env, holder }), null, command);
  }
  // The lock is not looked at for a command that needs no look.
  assert.equal(testRunWarning('git status', { env: {}, holder: () => assert.fail('the lock was looked at') }), null);
});

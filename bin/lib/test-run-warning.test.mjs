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

// Codex, 2026-10-14: a glob is many files, a quoted | or ; ends no command, and only the run that js-harness gate
// wraps is in a turn.
test('testRunWarning sees a run inside wsl.exe and sh -c, and a file named by a variable, which may expand to none (JH 8, 2026-10-14)', () => {
  // The command of the slip, as the Bash tool was given it: the variable was empty, and the whole suite ran.
  const slip = 'wsl.exe -d Ubuntu -- sh -c "cd /mnt/d/js-harness-worktrees/exact-tests && for f in bin/lib/a.test.mjs bin/lib/b.test.mjs; do /home/o/.local/node/bin/node --test --test-reporter=tap \\$f 2>&1 | grep -E pass | head -5; done"';
  assert.equal(testRunFiles(slip), Infinity);
  assert.equal(testRunWarning(slip, { env: {}, holder: held }), warned('several test files'));
  assert.equal(testRunFiles('wsl.exe -d Ubuntu -- /home/o/node --test a.mjs b.mjs'), 2);
  assert.equal(testRunFiles('wsl -- node --test'), 0);
  assert.equal(testRunFiles("bash -c 'node --test a.mjs b.mjs'"), 2);
  assert.equal(testRunFiles('sh -c "node --test a.mjs"'), 1);
  assert.equal(testRunFiles('node --test "$FILE"'), Infinity);
  assert.equal(testRunFiles('if true; then node --test a.mjs b.mjs; fi'), 2);
  // A redirection is no file.
  assert.equal(testRunFiles('node --test a.mjs 2>&1'), 1);
  assert.equal(testRunFiles('node --test a.mjs > out.txt'), 1);
  // Codex, 2026-10-14: a descriptor redirection ends no command; `-c` is read among the shell's options only,
  // and within a cluster of them.
  assert.equal(testRunFiles('node --test 2>&1 a.mjs'), 1);
  assert.equal(testRunFiles("bash script.sh -c 'node --test a.mjs b.mjs'"), null);
  assert.equal(testRunFiles("bash -- script.sh -c 'node --test a.mjs b.mjs'"), null);
  assert.equal(testRunFiles("bash -cl 'node --test a.mjs b.mjs'"), 2);
  assert.equal(testRunFiles("bash -e -c 'node --test a.mjs b.mjs'"), 2);
  // A script is not read, and a shell that runs no test is no run.
  assert.equal(testRunFiles('wsl.exe -d Ubuntu -- sh /mnt/c/x/wsl-one-test.sh /mnt/d/w bin/a.test.mjs'), null);
  assert.equal(testRunFiles('wsl.exe -d Ubuntu -- sh -c "ls"'), null);
});

test('testRunWarning counts a glob as several files, reads quotes whole, and exempts only the run under js-harness gate', () => {
  assert.equal(testRunWarning('node --test bin/lib/*.test.mjs', { env: {}, holder: held }), warned('several test files'));
  assert.equal(testRunWarning('node --test --test-name-pattern="foo|bar" a.mjs', { env: {}, holder: held }), null);
  assert.equal(testRunWarning("node --test --test-name-pattern 'a; b' a.mjs", { env: {}, holder: held }), null);
  assert.equal(testRunWarning('js-harness gate -- echo done; node --test a.mjs b.mjs', { env: {}, holder: held }), warned('2 test files'));
  assert.equal(testRunWarning('node --test --test-name-pattern="js-harness gate" a.mjs b.mjs', { env: {}, holder: held }), warned('2 test files'));
  assert.equal(testRunWarning('js-harness gate -- "node --test a.mjs b.mjs"', { env: {}, holder: held }), null);
  assert.equal(testRunWarning('js-harness gate --wait 240 -- node --test a.mjs b.mjs && echo ok', { env: {}, holder: held }), null);
});

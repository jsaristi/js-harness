import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GATE_COMMAND_MAX, gateRecord } from './gate-log.mjs';
import { markBatch } from './batch-mark.mjs';
import { HEAVY_FILE_SECONDS, testRunFiles, testRunWarning, timedSeconds } from './test-run-warning.mjs';

// The warning `js-harness guard --hook` gives for a whole test run started beside a gate
// (odd/tasks/test-run-warning.md). The look at the lock is a stand-in here: no test reads this machine's.

const HOLDER = { token: '1-a', pid: 1, cwd: 'D:\\js-harness-worktrees\\other' };
const held = () => HOLDER;
const free = () => null;
// No test reads this machine's gate log either: a file the log never timed is one no gate ran alone.
const untimed = () => undefined;
const warned = (what) => `node --test of ${what} starts outside a turn while the gate of D:\\js-harness-worktrees\\other holds the machine's gate lock: both share the cores and miss their bounds; run it with js-harness gate -- <command>, or one file at a time`;
// A folder whose package.json has these scripts, for a command that resolves an npm script there.
const scratchProject = (scripts) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-npm-test-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts }));
  return dir;
};

test('testRunFiles counts the files of a node --test run as a command of its own, and is null for any other command', () => {
  assert.equal(testRunFiles('node --test'), 0);
  assert.equal(testRunFiles('node --test bin/a.test.mjs'), 1);
  assert.equal(testRunFiles('node --test bin/a.test.mjs bin/b.test.mjs'), 2);
  assert.equal(testRunFiles('node --test --test-name-pattern "two words" --test-reporter=tap bin/a.test.mjs'), 1);
  assert.equal(testRunFiles('cd D:/x && "C:\\Program Files\\nodejs\\node.exe" --test a.mjs b.mjs c.mjs'), 3);
  assert.equal(testRunFiles('echo node --test a b'), null);
  assert.equal(testRunFiles('node bin/check.mjs'), null);
});

// C-b-23: `npm test` runs the `test` script of the folder, as the sensors resolve it (bin/check.mjs, testsCommand).
test('npm test runs the test script of its folder: the whole suite, or the files after --; npm run check is no run', () => {
  const project = scratchProject({ test: 'node --test', check: 'node bin/check.mjs' });
  try {
    assert.equal(testRunFiles('npm test', project), 0);
    assert.equal(testRunFiles('npm run test', project), 0);
    assert.equal(testRunFiles('npm test -- a.mjs b.mjs', project), 2);
    assert.equal(testRunFiles('npm run check', project), null);
    assert.equal(testRunFiles('npm install', project), null);
    assert.equal(testRunWarning('npm test', { env: {}, holder: held, fileSeconds: untimed, cwd: project }), warned('every test file'));
    assert.equal(testRunWarning('npm run check', { env: {}, holder: held, fileSeconds: untimed, cwd: project }), null);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
  const noTest = scratchProject({ lint: 'node lint.mjs' });
  try {
    assert.equal(testRunFiles('npm test', noTest), null);
  } finally {
    fs.rmSync(noTest, { recursive: true, force: true });
  }
});

// Codex on the guard slice: npm hands the script its positional words as well as those after `--`, answers to its
// aliases of `test`, and `--prefix` picks the package whose script runs.
test('npm test reads the words npm hands its script, its aliases, and the package --prefix picks', () => {
  const project = scratchProject({ test: 'node --test' });
  const other = scratchProject({ test: 'node --test' });
  const noTest = scratchProject({ lint: 'node lint.mjs' });
  try {
    assert.equal(testRunFiles('npm test a.mjs', project), 1);
    assert.equal(testRunFiles('npm test --silent a.mjs -- b.mjs', project), 2);
    assert.equal(testRunFiles('npm t', project), 0);
    assert.equal(testRunFiles('npm run-script test -- a.mjs b.mjs', project), 2);
    assert.equal(testRunFiles('npm test --prefix other', noTest), null);
    assert.equal(testRunFiles(`npm test --prefix ${other}`, noTest), 0);
    assert.equal(testRunFiles(`npm --prefix=${other} test a.mjs`, noTest), 1);
    assert.equal(testRunFiles(`npm --prefix ${noTest} test`, project), null);
    // The value of an option of npm's own is npm's, not a word it hands the script (gentle-ai on the guard slice).
    assert.equal(testRunFiles('npm test --loglevel silent', project), 0);
    assert.equal(testRunFiles('npm --loglevel silent test a.mjs', project), 1);
    assert.equal(testRunFiles('npm test --omit dev --node-options --max-old-space-size=99', project), 0);
    assert.equal(testRunFiles('npm test -- --tag x a.mjs', project), 2, 'after -- every word is the script\'s, and node reads --tag as its own');
    // npm's workspaces (one named, every one, the root beside them) are not resolved here: such a run is taken for
    // every test file, so no suite of a workspace passes beside a held gate (Codex, five rounds on the guard slice).
    for (const command of ['npm test -w pkg', 'npm test --workspace=pkg a.mjs', 'npm test -w', 'npm test --workspaces', 'npm test -ws', 'npm test -w pkg --include-workspace-root']) {
      assert.equal(testRunFiles(command, noTest), 0, command);
    }
  } finally {
    for (const dir of [project, other, noTest]) fs.rmSync(dir, { recursive: true, force: true });
  }
});

// A file of a script `--prefix` names is that folder's, and the gate log is asked of it from the command's own folder.
test('npm test times a file of its script from the folder the command runs in', () => {
  const root = scratchProject({ test: 'node --test' });
  fs.mkdirSync(path.join(root, 'slow'));
  fs.writeFileSync(path.join(root, 'slow', 'package.json'), JSON.stringify({ scripts: { test: 'node --test slow.test.mjs' } }));
  try {
    const asked = [];
    const fileSeconds = (file) => {
      asked.push(file);
      return 600;
    };
    const said = testRunWarning('npm test --prefix slow', { env: {}, holder: held, fileSeconds, cwd: root });
    assert.deepEqual(asked, ['slow/slow.test.mjs']);
    assert.match(said, /^node --test of slow\/slow\.test\.mjs, which the gate log timed at 600 s,/);
    asked.length = 0;
    testRunWarning('npm test a.test.mjs', { env: {}, holder: held, fileSeconds, cwd: root });
    assert.deepEqual(asked, ['a.test.mjs']);
    assert.equal(testRunWarning('npm test -w slow', { env: {}, holder: held, fileSeconds, cwd: root }), warned('every test file'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// C-b-22: the words before the program (`NAME=value`, `env` and its options) are no part of the run.
test('a node --test behind environment words is still a run: NAME=value and env with its options are read past', () => {
  for (const command of ['FOO=1 node --test', 'env FOO=1 node --test', 'env -i node --test', 'env -u FOO node --test', 'FOO=1 env BAR=2 node --test', 'env -- FOO=1 node --test', 'sh -c "FOO=1 node --test"']) {
    assert.equal(testRunFiles(command), 0, command);
  }
  assert.equal(testRunFiles('env FOO=1 node --test a.mjs b.mjs'), 2);
  assert.equal(testRunWarning('env FOO=1 node --test a.mjs b.mjs', { env: {}, holder: held, fileSeconds: untimed }), warned('2 test files'));
  assert.equal(testRunFiles('env FOO=1 js-harness gate -- node --test a.mjs b.mjs'), null);
  assert.equal(testRunFiles('env FOO=1 ls a.mjs b.mjs'), null);
});

test('testRunWarning warns for node --test of several files or of all while the lock is held outside a turn', () => {
  assert.equal(testRunWarning('node --test bin/a.test.mjs bin/b.test.mjs', { env: {}, holder: held, fileSeconds: untimed }), warned('2 test files'));
  assert.equal(testRunWarning('node --test', { env: {}, holder: held, fileSeconds: untimed }), warned('every test file'));
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
    assert.equal(testRunWarning(command, { env, holder, fileSeconds: untimed }), null, command);
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
  assert.equal(testRunWarning(slip, { env: {}, holder: held, fileSeconds: untimed }), warned('several test files'));
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
  assert.equal(testRunWarning('node --test bin/lib/*.test.mjs', { env: {}, holder: held, fileSeconds: untimed }), warned('several test files'));
  assert.equal(testRunWarning('node --test --test-name-pattern="foo|bar" a.mjs', { env: {}, holder: held, fileSeconds: untimed }), null);
  assert.equal(testRunWarning("node --test --test-name-pattern 'a; b' a.mjs", { env: {}, holder: held, fileSeconds: untimed }), null);
  assert.equal(testRunWarning('js-harness gate -- echo done; node --test a.mjs b.mjs', { env: {}, holder: held, fileSeconds: untimed }), warned('2 test files'));
  assert.equal(testRunWarning('node --test --test-name-pattern="js-harness gate" a.mjs b.mjs', { env: {}, holder: held, fileSeconds: untimed }), warned('2 test files'));
  assert.equal(testRunWarning('js-harness gate -- "node --test a.mjs b.mjs"', { env: {}, holder: held, fileSeconds: untimed }), null);
  assert.equal(testRunWarning('js-harness gate --wait 240 -- node --test a.mjs b.mjs && echo ok', { env: {}, holder: held, fileSeconds: untimed }), null);
});


// first-version T6a: a heavy run beside a gate is refused whatever its size. Two single files of 65 to 200 s ran
// beside gates past the protocol line, and one made a gate fail (docs/FAILURES.md, heavy-run-beside-gate).

const at = (seconds) => `node --test of bin/slow.test.mjs, which the gate log timed at ${seconds} s, starts outside a turn while the gate of D:\\js-harness-worktrees\\other holds the machine's gate lock: both share the cores and miss their bounds; run it with js-harness gate -- <command>, which waits its turn`;

test('one test file the gate log times over a minute counts as several: refused while the lock is held', () => {
  const asked = [];
  const timed = (file) => {
    asked.push(file);
    return file === 'bin/slow.test.mjs' ? HEAVY_FILE_SECONDS + 30 : undefined;
  };
  assert.equal(testRunWarning('node --test bin/slow.test.mjs', { env: {}, holder: held, fileSeconds: timed }), at(HEAVY_FILE_SECONDS + 30));
  // Named as the gate log names it: from the folder the command runs in, with forward slashes.
  assert.equal(testRunWarning('node --test .\\bin\\slow.test.mjs', { env: {}, holder: held, fileSeconds: timed }), at(HEAVY_FILE_SECONDS + 30));
  assert.deepEqual(asked, ['bin/slow.test.mjs', 'bin/slow.test.mjs']);
});

test('one test file stays free when the gate log timed it at a minute or less, never timed it, or the lock is free', () => {
  for (const seconds of [HEAVY_FILE_SECONDS, 12.5, undefined]) {
    assert.equal(testRunWarning('node --test bin/slow.test.mjs', { env: {}, holder: held, fileSeconds: () => seconds }), null, String(seconds));
  }
  // The gate log is read only once the lock is held, and not inside a turn.
  assert.equal(testRunWarning('node --test bin/slow.test.mjs', { env: {}, holder: free, fileSeconds: () => assert.fail('the gate log was read') }), null);
  assert.equal(testRunWarning('node --test bin/slow.test.mjs', { env: { JS_HARNESS_GATE_HELD: '1' }, holder: held, fileSeconds: () => assert.fail('the gate log was read') }), null);
});

test('timedSeconds takes the longest run of a file that a gate ran alone, and nothing from a gate of several files', () => {
  const gate = (id, command, seconds, cwd = 'D:\\js-harness-worktrees\\one') => [
    { v: 1, event: 'start', id, at: '2026-10-16T10:00:00.000Z', cwd, command, pid: 1, lock: 'took', waitedSeconds: 0, waitedFor: [] },
    { v: 1, event: 'end', id, at: '2026-10-16T10:05:00.000Z', seconds, result: 'exit 0' },
  ];
  const events = [
    ...gate('a', 'gate -- node --test bin/slow.test.mjs', 70),
    ...gate('b', 'gate --wait 240 -- node --test bin/slow.test.mjs', 95.5, 'D:\\js-harness-worktrees\\two'),
    ...gate('c', 'gate -- node --test bin/slow.test.mjs bin/other.test.mjs', 400),
    ...gate('d', 'check', 900),
    ...gate('e', 'gate -- "node --test bin/quick.test.mjs"', 8),
    { v: 1, event: 'start', id: 'f', at: '2026-10-16T11:00:00.000Z', cwd: 'D:\\w', command: 'gate -- node --test bin/slow.test.mjs', pid: 1, lock: 'took', waitedSeconds: 0, waitedFor: [] },
  ];
  assert.equal(timedSeconds(events, 'bin/slow.test.mjs'), 95.5);
  assert.equal(timedSeconds(events, 'bin/quick.test.mjs'), 8);
  assert.equal(timedSeconds(events, 'bin/other.test.mjs'), undefined);
  assert.equal(timedSeconds([], 'bin/slow.test.mjs'), undefined);
  // A command the log cut at its length may have lost every file after the first: it times none.
  const prefix = 'gate -- node --test ';
  const file = `${'d/'.repeat(GATE_COMMAND_MAX)}`.slice(0, GATE_COMMAND_MAX - prefix.length - 'a.mjs'.length) + 'a.mjs';
  assert.equal(`${prefix}${file}`.length, GATE_COMMAND_MAX);
  assert.equal(timedSeconds(gate('g', `${prefix}${file}`, 500), file), undefined);
  assert.equal(timedSeconds(gate('h', `${prefix}${file.slice(2)}`, 500), file.slice(2)), 500);
});

test('testRunWarning reads the gate log of its home by default: a file a gate ran alone for over a minute is refused', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-heavy-file-'));
  try {
    // Two checkouts of one repository (a worktree's .git is a file naming the common folder), and another project.
    const main = path.join(home, 'repo');
    const tree = path.join(home, 'tree');
    const other = path.join(home, 'other');
    fs.mkdirSync(path.join(main, '.git', 'worktrees', 'tree'), { recursive: true });
    fs.mkdirSync(tree);
    fs.writeFileSync(path.join(tree, '.git'), `gitdir: ${path.join(main, '.git', 'worktrees', 'tree')}\n`);
    fs.mkdirSync(path.join(other, '.git'), { recursive: true });
    let clock = Date.parse('2026-10-16T10:00:00.000Z');
    const record = gateRecord({ home, cwd: main, command: 'gate -- node --test bin/slow.test.mjs', now: () => clock });
    record.start({ lock: 'took', waitedMs: 0, waitedFor: [] });
    clock += (HEAVY_FILE_SECONDS + 30) * 1000;
    record.end({ result: 'exit 0' });
    assert.equal(testRunWarning('node --test bin/slow.test.mjs', { env: {}, home, cwd: tree, holder: held }), at(HEAVY_FILE_SECONDS + 30));
    assert.equal(testRunWarning('node --test bin/quick.test.mjs', { env: {}, home, cwd: tree, holder: held }), null);
    // Codex, 2026-10-16: the gate log is the machine's, so a file of the same name in another project is not timed.
    assert.equal(testRunWarning('node --test bin/slow.test.mjs', { env: {}, home, cwd: other, holder: held }), null);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('an eval batch shows itself to the guard as a gate holder does: several files, or a heavy one, are refused beside it', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-batch-guard-'));
  try {
    assert.equal(testRunWarning('node --test a.mjs b.mjs', { env: {}, home }), null);
    const release = markBatch(home, { cwd: 'D:\\js-harness-worktrees\\evals', command: 'node evals/suite.mjs --name screen' });
    try {
      assert.equal(testRunWarning('node --test a.mjs b.mjs', { env: {}, home }), "node --test of 2 test files starts outside a turn while the eval batch of D:\\js-harness-worktrees\\evals runs: both share the cores and miss their bounds; wait for the batch to end, or run one file at a time");
      assert.equal(testRunWarning('node --test a.mjs', { env: {}, home }), null);
    } finally {
      release();
    }
    assert.equal(testRunWarning('node --test a.mjs b.mjs', { env: {}, home }), null);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// board-read-loads-gate (docs/FAILURES.md): a read of the board is heavy enough to slow a gate.
test('a board read waits for another gate: js-harness sessions is refused while the lock is held, free otherwise', () => {
  const board = `js-harness sessions reads the board outside a turn while the gate of D:\\js-harness-worktrees\\other holds the machine's gate lock: a board read slows that gate; wait for it to end, or run it with js-harness gate -- <command>`;
  for (const command of ['js-harness sessions', 'js-harness sessions --watch', 'js-harness sessions --json', 'node bin/js-harness.mjs sessions', 'cd x && js-harness sessions --watch --interval 60']) {
    assert.equal(testRunWarning(command, { env: {}, holder: held, cwd: process.cwd() }), board, command);
  }
  // A read of one entry is no board read.
  for (const command of ['js-harness sessions --opening "Audit"', 'js-harness sessions --quote x', 'js-harness sessions --address "Audit"', 'js-harness sessions --next-number', 'js-harness status']) {
    assert.equal(testRunWarning(command, { env: {}, holder: held, cwd: process.cwd() }), null, command);
  }
  // With no lock held, and for the gate's own turn, the board is free.
  assert.equal(testRunWarning('js-harness sessions', { env: {}, holder: () => null, cwd: process.cwd() }), null);
  assert.equal(testRunWarning('js-harness sessions', { env: { JS_HARNESS_GATE_HELD: '1' }, holder: held, cwd: process.cwd() }), null);
  assert.equal(testRunWarning('js-harness gate -- js-harness sessions', { env: {}, holder: held, cwd: process.cwd() }), null);
});

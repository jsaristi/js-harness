import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { WAIT_EVERY_SECONDS, WAIT_FOR_MINUTES, waitMain } from './wait.mjs';
import { NOTICE_SCHEMA, recordPath } from './lib/channel.mjs';
import { projectSlug } from './lib/sessions.mjs';

// Every seam is fake: the clock, the sleep, git, gh and the channel record. No test runs git or gh, sleeps, or
// reads or writes a file; the project and the harness home are paths that are only named.
const T0 = Date.parse('2026-10-14T12:00:00.000Z');
const CWD = path.resolve('wait-test-project');
const HOME = path.resolve('wait-test-home');
const RECORD = recordPath(HOME, projectSlug(CWD));
const ORQ = { role: 'orchestrator', number: null };
const WORK = (number) => ({ role: 'work', number });

const start = (phrase, minutes = WAIT_FOR_MINUTES) => `js-harness wait: waits for ${phrase}; ends when it holds, or after ${minutes} minutes; stop it with TaskStop when it is no longer needed`;
const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
const failedRun = (stderr) => ({ status: 1, stdout: '', stderr });
const missing = () => ({ error: Object.assign(new Error('spawnSync gh ENOENT'), { code: 'ENOENT' }), status: null, stdout: '', stderr: '' });
const args = (...extra) => ['--cwd', CWD, '--home', HOME, ...extra];

/** Answers one after another, the last one again once they run out. */
const inOrder = (...answers) => {
  let next = 0;
  return () => answers[Math.min(next++, answers.length - 1)];
};

/** One line of the record, as `notify` writes a notice: `at` is a time in milliseconds. */
function noticeLine({ at, to, kind = 'note', text = 'a note', title = 'JH 5 · canal entre sesiones' }) {
  const notice = {
    schema: NOTICE_SCHEMA,
    at: new Date(at).toISOString(),
    from: { host: 'claude-code', id: 'aaaaaaaa-1111-4111-8111-111111111111', source: 'environment', title, permissionMode: 'bypassPermissions', context: null },
    to,
    kind,
    text,
    cwd: CWD,
    worktree: CWD,
    branch: 'feat/wait-command',
  };
  return `${JSON.stringify(notice)}\n`;
}

/** The fake world of one run. `answer(command, args, state)` is what git and gh return. `onSleep(state)` runs after
 * each sleep, so that a test can write the record while the wait waits. `record` is the channel's text, or `null`
 * for no file; `readError` is what reading the record fails with, when given. */
function world({ answer = () => ok(), onSleep = () => {}, record = null, readError = null } = {}) {
  const state = { clock: T0, sleeps: [], calls: [], timeouts: [], outAtCall: [], out: [], err: [], record };
  const deps = {
    cwd: CWD,
    now: () => state.clock,
    sleep: async (ms) => {
      state.sleeps.push(ms);
      state.clock += ms;
      onSleep(state);
    },
    stdout: (line) => state.out.push(line),
    stderr: (line) => state.err.push(line),
    homedir: () => path.resolve('wait-test-unused-home'),
    run: (command, commandArgs, options = {}) => {
      if (command === 'git' && commandArgs[0] === 'rev-parse') return ok('.git\n');
      state.calls.push([command, ...commandArgs].join(' '));
      state.timeouts.push(options.timeout);
      state.outAtCall.push(state.out.length);
      return answer(command, commandArgs, state);
    },
    readFile: (file) => {
      if (file === RECORD && readError !== null) throw readError;
      if (file === RECORD && state.record !== null) return state.record;
      throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
    },
  };
  return { state, deps };
}

test('--pr: a merged pull request holds at once, and the start line says what it waits for and when it ends', async () => {
  const { state, deps } = world({ answer: () => ok('MERGED\n') });
  assert.equal(await waitMain(args('--pr', '136'), {}, deps), 0);
  assert.deepEqual(state.calls, ['gh pr view 136 --json state -q .state']);
  assert.deepEqual(state.sleeps, []);
  assert.deepEqual(state.err, []);
  assert.deepEqual(state.out.slice(0, 1), [start('the merge of pull request 136')]);
  assert.equal(state.out.length, 2);
  assert.match(state.out[1], /^js-harness wait: the merge of pull request 136 holds \(\d\d:\d\d\)$/);
});

test('--pr: the wait checks at once, then every --every seconds, and ends on the third check', async () => {
  const answers = inOrder(ok('OPEN\n'), ok('OPEN\n'), ok('MERGED\n'));
  const { state, deps } = world({ answer: answers });
  assert.equal(await waitMain(args('--pr', '136', '--every', '90'), {}, deps), 0);
  assert.equal(state.calls.length, 3);
  assert.deepEqual(state.sleeps, [90000, 90000]);
  assert.deepEqual(state.outAtCall, [1, 1, 1], 'the start line is printed before the first check');
});

test('--pr: a pull request closed without merging ends the wait with exit 1, and says so', async () => {
  const { state, deps } = world({ answer: () => ok('CLOSED\n') });
  assert.equal(await waitMain(args('--pr', '136'), {}, deps), 1);
  assert.equal(state.calls.length, 1);
  assert.deepEqual(state.sleeps, []);
  assert.match(state.out[1], /^js-harness wait: pull request 136 was closed without merging \(\d\d:\d\d\); the wait ends$/);
});

test('the time runs out after --for minutes, with a last check at the deadline', async () => {
  const { state, deps } = world({ answer: () => ok('OPEN\n') });
  assert.equal(await waitMain(args('--pr', '136', '--every', '30', '--for', '1'), {}, deps), 1);
  assert.equal(state.calls.length, 3);
  assert.deepEqual(state.sleeps, [30000, 30000]);
  assert.equal(state.out[0], start('the merge of pull request 136', 1));
  assert.match(state.out.at(-1), /^js-harness wait: the merge of pull request 136 did not hold after 1 minutes; the time ran out \(\d\d:\d\d\)$/);
  assert.deepEqual(state.err, []);
});

test('each check is bounded by the time the wait has left, and by two minutes at most', async () => {
  const { state, deps } = world({ answer: () => ok('OPEN\n') });
  assert.equal(await waitMain(args('--pr', '136', '--every', '45', '--for', '1'), {}, deps), 1);
  assert.deepEqual(state.timeouts, [60000, 15000, 1000], 'the last check, at the deadline, still gets one second');

  const long = world({ answer: () => ok() });
  assert.equal(await waitMain(args('--main-has', 'abc1234', '--for', '480'), {}, long.deps), 0);
  assert.deepEqual(long.state.timeouts, [120000, 120000], 'the fetch and the ancestor check get two minutes each');
});

test('a check that cannot run is said once on stderr, is retried at the next tick, and does not end the wait', async () => {
  const answers = inOrder(failedRun('could not resolve host: github.com\n'), failedRun('could not resolve host: github.com\n'), ok('MERGED\n'));
  const { state, deps } = world({ answer: answers });
  assert.equal(await waitMain(args('--pr', '136'), {}, deps), 0);
  assert.equal(state.calls.length, 3);
  assert.deepEqual(state.sleeps, [WAIT_EVERY_SECONDS * 1000, WAIT_EVERY_SECONDS * 1000]);
  assert.deepEqual(state.err, ['js-harness wait: a check did not run (could not resolve host: github.com); it is retried at the next tick']);
});

test('a missing gh is said in words on stderr, and the wait goes on', async () => {
  const { state, deps } = world({ answer: inOrder(missing(), ok('MERGED\n')) });
  assert.equal(await waitMain(args('--pr', '136'), {}, deps), 0);
  assert.deepEqual(state.err, ['js-harness wait: a check did not run (gh is not installed or not on PATH); it is retried at the next tick']);
});

test('--main-has: fetches origin, then holds once the commit is an ancestor of origin/main', async () => {
  const mergeBase = inOrder(ok(), ok(), ok());
  const statuses = inOrder({ status: 1, stdout: '', stderr: '' }, { status: 1, stdout: '', stderr: '' }, { status: 0, stdout: '', stderr: '' });
  const { state, deps } = world({
    answer: (command, commandArgs) => (commandArgs[0] === 'fetch' ? mergeBase() : statuses()),
  });
  assert.equal(await waitMain(args('--main-has', 'abc1234'), {}, deps), 0);
  const fetch = 'git fetch -q origin';
  const check = 'git merge-base --is-ancestor abc1234 origin/main';
  assert.deepEqual(state.calls, [fetch, check, fetch, check, fetch, check]);
  assert.deepEqual(state.sleeps, [WAIT_EVERY_SECONDS * 1000, WAIT_EVERY_SECONDS * 1000]);
  assert.equal(state.out[0], start('commit abc1234 on origin/main'));
  assert.match(state.out[1], /^js-harness wait: commit abc1234 on origin\/main holds \(\d\d:\d\d\)$/);
});

test('--main-has: a fetch that fails is said once on stderr and retried, and the commit is looked for only after a fetch that works', async () => {
  const fetches = inOrder(failedRun('fatal: could not read from remote repository.\n'), ok());
  const { state, deps } = world({
    answer: (command, commandArgs) => (commandArgs[0] === 'fetch' ? fetches() : ok()),
  });
  assert.equal(await waitMain(args('--main-has', 'abc1234'), {}, deps), 0);
  assert.deepEqual(state.calls, ['git fetch -q origin', 'git fetch -q origin', 'git merge-base --is-ancestor abc1234 origin/main']);
  assert.deepEqual(state.err, ['js-harness wait: a check did not run (git fetch origin: fatal: could not read from remote repository.); it is retried at the next tick']);
});

test('--main-file: holds once origin/main has the text in that file, and says which file and text', async () => {
  const shown = inOrder(ok('the old text\n'), ok('the old text and the new text\n'));
  const { state, deps } = world({
    answer: (command, commandArgs) => (commandArgs[0] === 'fetch' ? ok() : shown()),
  });
  assert.equal(await waitMain(args('--main-file', 'docs/a.md', '--contains', 'new text'), {}, deps), 0);
  assert.deepEqual(state.calls, ['git fetch -q origin', 'git show origin/main:docs/a.md', 'git fetch -q origin', 'git show origin/main:docs/a.md']);
  assert.equal(state.out[0], start('the text "new text" in docs/a.md on origin/main'));
  assert.match(state.out[1], /^js-harness wait: the text "new text" in docs\/a.md on origin\/main holds \(\d\d:\d\d\)$/);
});

test('--notice-to: a notice written before the wait, or to another role, does not count; the one addressed to the role ends it, with its kind, sender and text', async () => {
  const { state, deps } = world({
    record: noticeLine({ at: T0 - 60000, to: ORQ, text: 'una vieja' }),
    onSleep: (now) => {
      if (now.sleeps.length === 1) now.record += noticeLine({ at: now.clock, to: WORK(4), text: 'para la cuatro' });
      if (now.sleeps.length === 2) now.record += noticeLine({ at: now.clock, to: ORQ, kind: 'answer', text: 'sí, sigue', title: 'JH 5 · canal entre sesiones' });
    },
  });
  assert.equal(await waitMain(args('--notice-to', 'orchestrator'), {}, deps), 0);
  assert.deepEqual(state.calls, []);
  assert.deepEqual(state.sleeps, [WAIT_EVERY_SECONDS * 1000, WAIT_EVERY_SECONDS * 1000]);
  assert.equal(state.out[0], start('a notice to orchestrator'));
  assert.match(state.out[1], /^js-harness wait: a notice to orchestrator holds \(\d\d:\d\d\)$/);
  assert.equal(state.out[2], 'answer from JH 5 · canal entre sesiones: sí, sigue');
  assert.equal(state.out.length, 3);
});

test('--notice-to: ORQ names the orchestrator, and a number names a work session', async () => {
  const record = noticeLine({ at: T0 + 1000, to: ORQ, text: 'hola' }) + noticeLine({ at: T0 + 1000, to: WORK(3), text: 'tres' });
  const toOrchestrator = world({ record });
  assert.equal(await waitMain(args('--notice-to', 'ORQ'), {}, toOrchestrator.deps), 0);
  assert.match(toOrchestrator.state.out[1], /^js-harness wait: a notice to orchestrator holds \(\d\d:\d\d\)$/);
  assert.equal(toOrchestrator.state.out[2], 'note from JH 5 · canal entre sesiones: hola');
  const toThree = world({ record });
  assert.equal(await waitMain(args('--notice-to', '3'), {}, toThree.deps), 0);
  assert.equal(toThree.state.out[2], 'note from JH 5 · canal entre sesiones: tres');
});

test('--notice-to: a record that cannot be read is said on stderr and retried, never taken for no notices', async () => {
  const readError = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
  const { state, deps } = world({ readError });
  assert.equal(await waitMain(args('--notice-to', 'orchestrator', '--for', '1'), {}, deps), 1);
  assert.deepEqual(state.sleeps, [60000]);
  assert.equal(state.err.length, 1);
  assert.match(state.err[0], /could not be read \(EACCES\)/);
  assert.match(state.out.at(-1), /did not hold after 1 minutes; the time ran out/);
});

test('usage errors exit 2 with the usage, and nothing is checked', async () => {
  const cases = [
    [],
    ['--pr', '136', '--main-has', 'abc1234'],
    ['--notice-to', 'orchestrator', '--pr', '136'],
    ['--contains', 'x'],
    ['--main-file', 'docs/a.md'],
    ['--main-file', 'docs/a.md', '--contains', 'x', '--pr', '1'],
    ['--pr', '0'],
    ['--pr', 'abc'],
    ['--main-has', '-x'],
    ['--notice-to', 'bogus'],
    ['--pr', '1', '--every', '0'],
    ['--pr', '1', '--for', 'soon'],
    ['--pr', '1', '--bogus', 'x'],
    ['--pr'],
    ['--pr', '1', '--pr', '2'],
  ];
  for (const extra of cases) {
    const label = JSON.stringify(extra);
    const { state, deps } = world({ answer: () => { throw new Error(`checked, for ${label}`); } });
    assert.equal(await waitMain(args(...extra), {}, deps), 2, label);
    assert.deepEqual(state.calls, [], label);
    assert.deepEqual(state.out, [], label);
    assert.match(state.err.join('\n'), /^js-harness wait: .+\n\nUsage: js-harness wait \(--pr <number> \| --main-has <commit>/, label);
  }
});

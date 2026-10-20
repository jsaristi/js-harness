import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WAIT_EVERY_SECONDS, WAIT_FOR_MINUTES, waitMain } from './wait.mjs';
import { NOTICE_SCHEMA, recordPath } from './lib/channel.mjs';
import { projectSlug } from './lib/sessions.mjs';
import { permitsDir } from './permit.mjs';

// Every seam is fake: the clock, the sleep, git, gh and the channel record. No test runs git or gh or sleeps. The
// project and the harness home are paths that are only named, except the lease tests, which write a lease in a
// scratch folder under os.tmpdir() that they remove.
const T0 = Date.parse('2026-10-14T12:00:00.000Z');
const CWD = path.resolve('wait-test-project');
const HOME = path.resolve('wait-test-home');
const ORQ = { role: 'orchestrator', number: null };
const WORK = (number) => ({ role: 'work', number });

const start = (phrase, minutes = WAIT_FOR_MINUTES) => `js-harness wait: waits for ${phrase}; ends when it holds, or after ${minutes} minutes; stop it with TaskStop when it is no longer needed`;
const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
const failedRun = (stderr) => ({ status: 1, stdout: '', stderr });
const missing = () => ({ error: Object.assign(new Error('spawnSync gh ENOENT'), { code: 'ENOENT' }), status: null, stdout: '', stderr: '' });
const args = (...extra) => ['--cwd', CWD, '--home', HOME, ...extra];

// The waiting session, as the host names it to its commands: its id in CLAUDE_CODE_SESSION_ID, and its transcript in
// the sessions folder of the project under CLAUDE_CONFIG_DIR, where `notify` reads a sender.
const SELF_ID = 'bbbbbbbb-2222-4222-8222-222222222222';
const CLAUDE_HOME = path.resolve('wait-test-claude');
const PROJECT_DIR = path.join(CLAUDE_HOME, 'projects', projectSlug(CWD));
const SELF_ENV = { CLAUDE_CODE_SESSION_ID: SELF_ID, CLAUDE_CONFIG_DIR: CLAUDE_HOME };
const SESSION_26 = { title: 'JH 26 · canal y compactación' };
// A path as the wait to arm again shows it: in single quotes when a shell would read it otherwise (a backslash, on
// Windows), as it is elsewhere.
const shown = (word) => (/^[\w./:@%+=,-]+$/.test(word) ? word : `'${word}'`);
const watching = (phrase, number, minutes = WAIT_FOR_MINUTES) => `js-harness wait: waits for ${phrase}; ends when it holds, on a notice to ${number}, or after ${minutes} minutes; stop it with TaskStop when it is no longer needed`;

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
function world({ answer = () => ok(), onSleep = () => {}, record = null, readError = null, transcript = null, home = HOME } = {}) {
  const recordFile = recordPath(home, projectSlug(CWD));
  const state ={ clock: T0, sleeps: [], calls: [], timeouts: [], outAtCall: [], out: [], err: [], record };
  // The waiting session's own transcript, where `senderOf` reads its title: `{ title }`, a title it was given, or
  // `{ title: null }`, a transcript with none (a phone session's).
  const transcriptFile = path.join(PROJECT_DIR, `${SELF_ID}.jsonl`);
  const transcriptText = transcript === null ? null
    : `${JSON.stringify(transcript.title === null ? { type: 'user', message: { role: 'user', content: 'hola' }, sessionId: SELF_ID } : { type: 'custom-title', customTitle: transcript.title, sessionId: SELF_ID })}\n`;
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
      if (file === recordFile && readError !== null) throw readError;
      if (file === recordFile && state.record !== null) return state.record;
      if (file === transcriptFile && transcriptText !== null) return transcriptText;
      throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
    },
    readdir: (dir) => {
      if (dir === PROJECT_DIR && transcriptText !== null) return [`${SELF_ID}.jsonl`];
      throw Object.assign(new Error(`ENOENT: ${dir}`), { code: 'ENOENT' });
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

// odd/tasks/session-channel.md, T20b (`wait-blind-to-notices`): every wait also ends on a notice to the waiting
// session's own number, with an exit of its own, and says how to arm the same wait again.
test("every wait also ends on a notice to the waiting session's own number, with exit 3, its notice and the wait to arm again", async () => {
  const { state, deps } = world({
    transcript: SESSION_26,
    answer: () => ok('OPEN\n'),
    record: noticeLine({ at: T0 - 60000, to: WORK(26), text: 'una vieja' }),
    onSleep: (now) => {
      if (now.sleeps.length === 1) now.record += noticeLine({ at: now.clock, to: WORK(4), text: 'para la cuatro' });
      if (now.sleeps.length === 2) now.record += noticeLine({ at: now.clock, to: WORK(26), text: 'Lead: next for JH 26', title: 'JH ORQ · js-harness' });
    },
  });
  assert.equal(await waitMain(args('--pr', '284', '--for', '60'), SELF_ENV, deps), 3);
  assert.equal(state.out[0], watching('the merge of pull request 284', 26, 60));
  assert.deepEqual(state.calls, ['git worktree list --porcelain', 'gh pr view 284 --json state -q .state', 'gh pr view 284 --json state -q .state'], 'the notice is looked for before the pull request, which is not asked again');
  assert.match(state.out[1], /^js-harness wait: a notice to 26 came before the merge of pull request 284 held \(\d\d:\d\d\); the wait ends$/);
  assert.equal(state.out[2], 'note from JH ORQ · js-harness: Lead: next for JH 26');
  assert.equal(state.out[3], `js-harness wait: to wait again, run: js-harness wait --cwd ${shown(CWD)} --home ${shown(HOME)} --pr 284 --for 60`);
  assert.equal(state.out.length, 4);
  assert.deepEqual(state.err, []);
});

test('the wait to arm again quotes an argument a shell would split', async () => {
  const { state, deps } = world({
    transcript: SESSION_26,
    answer: (command, commandArgs) => (commandArgs[0] === 'fetch' ? ok() : ok('the old text\n')),
    record: noticeLine({ at: T0 + 1000, to: WORK(26), text: 'hola' }),
  });
  assert.equal(await waitMain(['--main-file', 'docs/a.md', '--contains', "it's new", '--cwd', CWD, '--home', HOME], SELF_ENV, deps), 3);
  assert.equal(state.out.at(-1), `js-harness wait: to wait again, run: js-harness wait --main-file docs/a.md --contains 'it'\\''s new' --cwd ${shown(CWD)} --home ${shown(HOME)}`);
});

test("the condition holds while no notice is addressed to the session's number, and the wait ends as before, exit 0", async () => {
  const { state, deps } = world({
    transcript: SESSION_26,
    answer: inOrder(ok('OPEN\n'), ok('MERGED\n')),
    record: noticeLine({ at: T0 + 1000, to: WORK(4), text: 'para la cuatro' }) + noticeLine({ at: T0 + 1000, to: ORQ, text: 'al lead' }),
  });
  assert.equal(await waitMain(args('--pr', '284'), SELF_ENV, deps), 0);
  assert.equal(state.out[0], watching('the merge of pull request 284', 26));
  assert.match(state.out[1], /^js-harness wait: the merge of pull request 284 holds \(\d\d:\d\d\)$/);
  assert.equal(state.out.length, 2);
});

test('a session with no number keeps the wait it had: no id, a transcript with no title, or a title that names no work session', async () => {
  const notice = noticeLine({ at: T0 + 1000, to: WORK(26), text: 'hola' });
  for (const [label, env, transcript] of [
    ['no session id', {}, SESSION_26],
    ['no title in the transcript', SELF_ENV, { title: null }],
    ['the orchestrator', SELF_ENV, { title: 'JH ORQ · js-harness (350k)' }],
    ['a title of no agreed shape', SELF_ENV, { title: 'canal y compactación' }],
  ]) {
    const { state, deps } = world({ transcript, record: notice, answer: inOrder(ok('OPEN\n'), ok('MERGED\n')) });
    assert.equal(await waitMain(args('--pr', '284'), env, deps), 0, label);
    assert.equal(state.out[0], start('the merge of pull request 284'), label);
    assert.deepEqual(state.err, [], label);
  }
});

test('a wait for a notice to the session itself is not watched twice, and ends with exit 0', async () => {
  const { state, deps } = world({ transcript: SESSION_26, record: noticeLine({ at: T0 + 1000, to: WORK(26), text: 'hola' }) });
  assert.equal(await waitMain(args('--notice-to', '26'), SELF_ENV, deps), 0);
  assert.equal(state.out[0], start('a notice to 26'));
  assert.match(state.out[1], /^js-harness wait: a notice to 26 holds \(\d\d:\d\d\)$/);
});

test("a wait for the orchestrator's notices, run by a work session, also ends on a notice to its own number", async () => {
  const { state, deps } = world({ transcript: SESSION_26, record: noticeLine({ at: T0 + 1000, to: WORK(26), text: 'hola' }) });
  assert.equal(await waitMain(args('--notice-to', 'orchestrator'), SELF_ENV, deps), 3);
  assert.equal(state.out[0], watching('a notice to orchestrator', 26));
});

test('a project with no channel record sees no error from the notice watch', async () => {
  const { state, deps } = world({ transcript: SESSION_26, answer: inOrder(ok('OPEN\n'), ok('MERGED\n')) });
  assert.equal(await waitMain(args('--pr', '284'), SELF_ENV, deps), 0);
  assert.deepEqual(state.err, []);
});

test('a record the notice watch cannot read is said once on stderr, and the condition is still checked', async () => {
  const readError = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
  const { state, deps } = world({ transcript: SESSION_26, readError, answer: inOrder(ok('OPEN\n'), ok('OPEN\n'), ok('MERGED\n')) });
  assert.equal(await waitMain(args('--pr', '284'), SELF_ENV, deps), 0);
  assert.equal(state.calls.length, 3);
  assert.equal(state.err.length, 1);
  assert.match(state.err[0], /^js-harness wait: the notices to 26 are not watched now: the channel's record .+ could not be read \(EACCES\); it is read again at the next tick$/);
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

// Lease renewal (odd/tasks/harness-review.md, T3, S5a): a notice wait for the orchestrator renews the relay lease its
// session holds, on every tick. The lease lives in a scratch home under os.tmpdir(); the clock is the fake one.
const LEASE_SCHEMA = 'js-harness.permit/v1';
const MIN = 60000;
const OTHER_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const renewing = (phrase, minutes = WAIT_FOR_MINUTES) => `js-harness wait: waits for ${phrase}; ends when it holds, or after ${minutes} minutes; renews the relay lease while it waits; stop it with TaskStop when it is no longer needed`;

function leaseHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-wait-lease-'));
  return { dir, home: path.join(dir, 'home') };
}

/** The lease file of CWD's project under `home`. */
const leaseFileOf = (home) => path.join(permitsDir(home, projectSlug(CWD)), 'lease.json');

/** Writes a lease of `session` until `until` (ms) under `home`; `null` as the session writes none. */
function writeLease(home, session, until) {
  const file = leaseFileOf(home);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ schema: LEASE_SCHEMA, session, until: new Date(until).toISOString() })}\n`, 'utf8');
  return file;
}

const readOrNull = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
const ORQ_ARGS = (home, ...extra) => ['--cwd', CWD, '--home', home, '--notice-to', 'orchestrator', ...extra];

test('--notice-to orchestrator renews the lease its session holds on each tick, so the lease outlasts the wait', async () => {
  const { dir, home } = leaseHome();
  try {
    const file = writeLease(home, SELF_ID, T0 + 40 * MIN);
    const { state, deps } = world({ home });
    assert.equal(await waitMain(ORQ_ARGS(home, '--every', '1200', '--for', '60'), SELF_ENV, deps), 1);
    // Checks at 0, 20, 40 and 60 minutes; the last renewal is at the deadline: 60 + 40 minutes.
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).until, new Date(T0 + 100 * MIN).toISOString());
    assert.equal(state.out[0], renewing('a notice to orchestrator', 60));
    assert.deepEqual(state.err, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the renewed lease lasts the interval plus 5 minutes when that is longer than 40 minutes', async () => {
  const { dir, home } = leaseHome();
  try {
    const file = writeLease(home, SELF_ID, T0 + 40 * MIN);
    const { deps } = world({ home });
    assert.equal(await waitMain(ORQ_ARGS(home, '--every', '3600', '--for', '120'), SELF_ENV, deps), 1);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).until, new Date(T0 + (120 + 65) * MIN).toISOString());
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the lease is never taken, created or changed when another session holds it, when it is expired, when there is none, or with no session id', async () => {
  const cases = [
    ['another session holds it', SELF_ENV, (home) => writeLease(home, OTHER_ID, T0 + 40 * MIN)],
    ['it is expired', SELF_ENV, (home) => writeLease(home, SELF_ID, T0 - MIN)],
    ['there is no lease', SELF_ENV, () => {}],
    ['no session id is given', { CLAUDE_CONFIG_DIR: CLAUDE_HOME }, (home) => writeLease(home, SELF_ID, T0 + 40 * MIN)],
  ];
  for (const [label, env, prepare] of cases) {
    const { dir, home } = leaseHome();
    try {
      prepare(home);
      const file = leaseFileOf(home);
      const before = readOrNull(file);
      const { state, deps } = world({ home });
      assert.equal(await waitMain(ORQ_ARGS(home, '--every', '1200', '--for', '60'), env, deps), 1, label);
      assert.equal(state.out[0], start('a notice to orchestrator', 60), label);
      assert.deepEqual(state.err, [], label);
      assert.equal(readOrNull(file), before, label);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('waits on another condition never touch the lease, even one their session holds', async () => {
  const cases = [
    ['--pr', '136'],
    ['--main-has', 'abc1234'],
    ['--main-file', 'docs/a.md', '--contains', 'text'],
    ['--notice-to', '3'],
  ];
  for (const extra of cases) {
    const label = JSON.stringify(extra);
    const { dir, home } = leaseHome();
    try {
      const file = writeLease(home, SELF_ID, T0 + 40 * MIN);
      const before = fs.readFileSync(file, 'utf8');
      const { deps } = world({ home, answer: (command) => (command === 'gh' ? ok('MERGED\n') : ok('the text')) });
      await waitMain(['--cwd', CWD, '--home', home, ...extra, '--for', '1'], SELF_ENV, deps);
      assert.equal(fs.readFileSync(file, 'utf8'), before, label);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('a failure to renew the lease is said once on stderr, the wait goes on, and its opening line does not claim a renewal', async () => {
  const { dir, home } = leaseHome();
  try {
    const { state, deps } = world({ home });
    const renew = () => {
      throw Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
    };
    assert.equal(await waitMain(ORQ_ARGS(home, '--every', '1200', '--for', '60'), SELF_ENV, { ...deps, renew }), 1);
    assert.deepEqual(state.err, ['js-harness wait: the relay lease is not renewed (EPERM: operation not permitted); it is tried again at the next tick']);
    assert.equal(state.out[0], start('a notice to orchestrator', 60));
    assert.match(state.out.at(-1), /did not hold after 60 minutes; the time ran out/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a notice wait by a session with no lease ends as before: the same lines, exit 0, and no lease written', async () => {
  const { dir, home } = leaseHome();
  try {
    const { state, deps } = world({ home, record: noticeLine({ at: T0 + 1000, to: ORQ, text: 'hola' }) });
    assert.equal(await waitMain(ORQ_ARGS(home), SELF_ENV, deps), 0);
    assert.equal(state.out[0], start('a notice to orchestrator'));
    assert.match(state.out[1], /^js-harness wait: a notice to orchestrator holds \(\d\d:\d\d\)$/);
    assert.equal(state.out[2], 'note from JH 5 · canal entre sesiones: hola');
    assert.equal(state.out.length, 3);
    assert.equal(readOrNull(leaseFileOf(home)), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { notifyMain, readyProblems } from './notify.mjs';
import { sessionsMain } from './sessions.mjs';
import { channelDir, findOpenings, openingFileName, openingsDir, readNotices, recordPath, reliefPath, reliefStamp } from './lib/channel.mjs';
import { projectSlug } from './lib/sessions.mjs';

// Every test has a machine of its own in the temp folder: a harness home, a Claude home with synthetic
// transcripts and the names of a checkout and a worktree (`git` is a fake). Nothing reads or writes the
// real home, this machine's sessions or its repository.

const NOW = Date.parse('2026-01-01T12:00:00.000Z');
const before = (seconds) => new Date(NOW - seconds * 1000);
const SENDER = 'aaaaaaaa-1111-4111-8111-111111111111';
const ORCHESTRATOR = 'bbbbbbbb-2222-4222-8222-222222222222';
const SENDER_TITLE = 'JH 5 · canal entre sesiones';
const ORCHESTRATOR_TITLE = 'JH ORQ · proj';

const ok = (stdout) => ({ status: 0, stdout, stderr: '' });
const slashes = (somePath) => somePath.split(path.sep).join('/');
const notARepository = () => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository (or any of the parent directories): .git\n' });

function makeMachine() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-notify-'));
  const root = path.join(dir, 'proj');
  const machine = { dir, root, worktree: path.join(dir, 'proj-worktrees', 'channel'), home: path.join(dir, 'user-home'), claudeHome: path.join(dir, 'claude-home'), slug: projectSlug(root) };
  machine.projectDir = path.join(machine.claudeHome, 'projects', machine.slug);
  machine.record = recordPath(machine.home, machine.slug);
  fs.mkdirSync(machine.projectDir, { recursive: true });
  return machine;
}

function withMachine(body) {
  return async () => {
    const machine = makeMachine();
    try {
      await body(machine);
    } finally {
      fs.rmSync(machine.dir, { recursive: true, force: true });
    }
  };
}

/** A session of the project titled `title`, whose last entry is `seconds` before NOW. */
function writeSession(machine, id, title, { seconds = 60, permissionMode = 'bypassPermissions', usage = null } = {}) {
  const at = before(seconds).toISOString();
  const entries = [
    { type: 'custom-title', customTitle: title, sessionId: id },
    { type: 'user', timestamp: at, cwd: machine.root, gitBranch: 'main', isSidechain: false, permissionMode, origin: { kind: 'human' }, message: { role: 'user', content: 'made up' } },
    { type: 'assistant', timestamp: at, cwd: machine.root, gitBranch: 'main', isSidechain: false, message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: 'made up' }], ...(usage === null ? {} : { usage }) } },
  ];
  const file = path.join(machine.projectDir, `${id}.jsonl`);
  fs.writeFileSync(file, entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n', 'utf8');
  fs.utimesSync(file, before(seconds), before(seconds));
}

/** A fake `git` for a checkout at `machine.root` with worktrees linked to it: every folder it is asked
 * about is the top of a worktree on `branch`. */
function fakeGit(machine, { branch = 'feat/session-record' } = {}) {
  const calls = [];
  const run = (command, args, { cwd } = {}) => {
    calls.push({ command, args, cwd });
    if (command !== 'git') return { error: Object.assign(new Error(`spawnSync ${command} ENOENT`), { code: 'ENOENT' }) };
    if (args[0] === 'rev-parse' && args.includes('--git-common-dir')) return ok(`${slashes(machine.root)}/.git\n`);
    if (args[0] === 'rev-parse' && args.includes('--show-toplevel')) return ok(`${slashes(cwd)}\n`);
    if (args[0] === 'branch') return ok(`${branch}\n`);
    return { status: 1, stdout: '', stderr: `fake git: no answer for ${args.join(' ')}\n` };
  };
  return { run, calls };
}

/** Runs `notify` on the machine, from its worktree, as the session SENDER unless `deps.env` says otherwise. */
async function runNotify(machine, argv, deps = {}) {
  const out = [];
  const err = [];
  // The homes come first: what follows a `--` in `argv` is text, whatever it looks like.
  const code = await notifyMain(['--home', machine.home, '--claude-home', machine.claudeHome, ...argv], {
    cwd: machine.worktree,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    env: { CLAUDE_CODE_SESSION_ID: SENDER },
    now: () => NOW,
    // Both homes are given by flag. The board still asks for the user's home before it knows it will not
    // use it, so this is a folder that must stay as it is: not there.
    homedir: () => path.join(machine.dir, 'os-home'),
    run: fakeGit(machine).run,
    // The land's checks of a ready notice ask gh and git of a real pull request: a test that holds them gives its own.
    landChecks: async () => [],
    // The check of a closed notice's summary reads git: a test that holds it gives its own.
    closeChecks: async () => [],
    ...deps,
  });
  return { code, out, err };
}

/** `sessions --address` on the same machine, asked by the same session. */
async function runAddress(machine, role, { self = SENDER, run = fakeGit(machine).run } = {}) {
  const out = [];
  const err = [];
  const code = await sessionsMain(['--address', role, '--claude-home', machine.claudeHome, '--self', self], { cwd: machine.worktree, stdout: (line) => out.push(line), stderr: (line) => err.push(line), env: {}, now: () => NOW, run });
  return { code, out, err };
}

const recorded = (machine) => readNotices(machine.home, machine.slug);

/** The stamp of a time as the confirmation writes it: the hour and minute on this process's clock, then the ISO time. */
const localStamp = (iso) => {
  const at = new Date(iso);
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')} local (${iso})`;
};

// --- usage ---

const LONG = 'x'.repeat(501);
const USAGE_ERRORS = [
  [],
  ['probe'],
  ['--to', 'orchestrator', 'probe'],
  ['--kind', 'note', 'probe'],
  ['--to', 'orchestrator', '--kind', 'note'],
  ['--to', 'orchestrator', '--kind', 'note', 'one', 'two'],
  ['--to', 'orchestrator', '--kind', 'note', 'probe', '--bogus'],
  ['--to', 'orchestrator', '--kind', 'note', 'probe', '--json'],
  ['--to'], ['--to', 'boss', '--kind', 'note', 'probe'], ['--to', 'JH 5', '--kind', 'note', 'probe'], ['--to', '--kind', 'note', 'probe'],
  ['--to', 'orchestrator', '--kind'], ['--to', 'orchestrator', '--kind', 'shout', 'probe'], ['--to', 'orchestrator', '--kind', 'Note', 'probe'],
  ['--to', 'orchestrator', '--kind', 'note', ''], ['--to', 'orchestrator', '--kind', 'note', '   '], ['--to', 'orchestrator', '--kind', 'note', 'two\nlines'], ['--to', 'orchestrator', '--kind', 'note', LONG],
  // An answer says where his words are read, and no other kind does.
  ['--to', '5', '--kind', 'answer', 'A'], ['--to', '5', '--kind', 'answer', 'A', '--transcript', '1d16beeb'], ['--to', '5', '--kind', 'answer', 'A', '--line', '406'],
  ['--to', '5', '--kind', 'answer', 'A', '--transcript', '1d16beeb', '--line', '0'], ['--to', '5', '--kind', 'answer', 'A', '--transcript', '1d16beeb', '--line', '4.5'],
  ['--to', '5', '--kind', 'answer', 'A', '--transcript', '1d16beeb', '--line', 'last'], ['--to', '5', '--kind', 'answer', 'A', '--transcript', '1d16beeb', '--line'],
  ['--to', '5', '--kind', 'note', 'A', '--transcript', '1d16beeb', '--line', '406'], ['--to', '5', '--kind', 'closed', 'A', '--line', '406'],
  // One thing at a time: a notice, a relief line or an opening.
  ['--relief'], ['--relief', ''], ['--relief', '  '], ['--relief', 'two\nlines'], ['--relief', 'x'.repeat(6001)],
  ['--relief', 'a line', '--to', 'orchestrator'], ['--relief', 'a line', '--kind', 'note'], ['--relief', 'a line', 'and a text'], ['--relief', 'a line', '--opening', 'JH 5 · x'],
  ['--opening'], ['--opening', ''], ['--opening', 'two\nlines'], ['--opening', 'x'.repeat(121)], ['--opening', 'JH 5 · x', 'a text'], ['--opening', 'JH 5 · x', '--to', '5'],
  ['--to', 'orchestrator', '--kind', 'note', 'probe', '--self'], ['--to', 'orchestrator', '--kind', 'note', 'probe', '--self', 'abc'],
  ['--to', 'orchestrator', '--kind', 'note', 'probe', '--cwd'], ['--relief', 'a line', '--transcript', 'x'],
  // A text that begins with -- is an argument it does not know, unless it comes after --.
  ['--to', '5', '--kind', 'note', '--watch is slow'], ['--relief', '--watch is slow'], ['--opening', '--draft'],
  // After -- everything is text, and it is still one text: the one a notice, a relief line or a title needs.
  ['--to', '5', '--kind', 'note', '--'], ['--to', '5', '--kind', 'note', '--', 'one', 'two'], ['--to', '5', '--kind', 'note', 'probe', '--', '--more'],
  ['--to', '5', '--', '--text', '--kind', 'note'], ['--relief', '--'], ['--relief', '--', 'one', 'two'], ['--relief', 'a line', '--', '--more'],
  ['--opening', '--'], ['--opening', '--', '--draft', '--to', '5'], ['--to', '--', '5', '--kind', 'note', 'probe'],
  // A text given before the flag is not the value of a lone -- that nothing follows: the flag has no value.
  ['a line', '--relief', '--'], ['JH 5 · x', '--opening', '--'], ['a line', '--relief', '--', 'and the line'],
  // A question takes its fields from standard input, and a number of a question is digits from 1.
  ['--to', 'orchestrator', '--kind', 'question', 'a text on the command line'], ['--to', 'orchestrator', '--kind', 'question', '--question', '1'],
  ['--to', 'orchestrator', '--kind', 'note', 'probe', '--question', '1'], ['--to', 'orchestrator', '--kind', 'withdrawn', 'why'],
  ['--to', 'orchestrator', '--kind', 'answer', '--question', '2', 'A'], ['--to', 'orchestrator', '--kind', 'answer', 'A', '--transcript', '1d16beeb', '--line', '4', '--question', '0'],
  ['--to', 'orchestrator', '--kind', 'answer', 'A', '--transcript', '1d16beeb', '--line', '4', '--question', 'one'], ['--relief', 'a line', '--question', '1'],
  // A ready notice names its pull request with --pr, digits from 1, and no other kind takes one.
  ['--to', 'orchestrator', '--kind', 'ready', 'T3 is ready'], ['--to', 'orchestrator', '--kind', 'ready', '--pr', '0', 'T3 is ready'],
  ['--to', 'orchestrator', '--kind', 'ready', '--pr', '#344', 'T3 is ready'], ['--to', 'orchestrator', '--kind', 'ready', '--pr', '34.4', 'T3 is ready'],
  ['--to', 'orchestrator', '--kind', 'ready', '--pr'], ['--to', 'orchestrator', '--kind', 'note', '--pr', '344', 'probe'], ['--relief', 'a line', '--pr', '344'],
  // A closed notice names its summary with --summary, a file of docs/sessions/, and no other kind takes one.
  ['--to', 'orchestrator', '--kind', 'closed', 'delivered'], ['--to', 'orchestrator', '--kind', 'closed', '--summary'],
  ['--to', 'orchestrator', '--kind', 'closed', '--summary', 'README.md', 'delivered'], ['--to', 'orchestrator', '--kind', 'note', '--summary', 'docs/sessions/a.md', 'probe'],
  ['--relief', 'a line', '--summary', 'docs/sessions/a.md'],
];

const usageName = (argv) => JSON.stringify(argv).replace(/x{20,}/g, (run) => `<${run.length} x>`);

test('every usage case of notify has its own test name', () => {
  const names = USAGE_ERRORS.map(usageName);
  assert.deepEqual(names.filter((name, index) => names.indexOf(name) !== index), []);
});

for (const argv of USAGE_ERRORS) {
  test(`notifyMain exits 2 with its usage on stderr and writes nothing for ${usageName(argv)}`, withMachine(async (machine) => {
    const neverRun = () => assert.fail('a usage error must not run anything');
    const { code, out, err } = await runNotify(machine, argv, { run: neverRun, sessions: neverRun, readStdin: () => 'the text of an opening' });
    assert.equal(code, 2);
    assert.deepEqual(out, []);
    assert.match(err.join('\n'), /Usage: js-harness notify/);
    assert.equal(fs.existsSync(machine.home), false, 'nothing is written under the home');
  }));
}

test('the usage names the six kinds, what an answer takes and every bound', async () => {
  const err = [];
  assert.equal(await notifyMain([], { stdout: () => {}, stderr: (line) => err.push(line) }), 2);
  const usage = err.join('\n');
  assert.match(usage, /--to orchestrator\|<number> --kind <kind>/);
  assert.match(usage, /opened, waiting, closed, note, answer, relieved/);
  assert.match(usage, /--transcript <file or session id> --line <n>/);
  assert.match(usage, /500\s+characters/);
  assert.match(usage, /6000\s+characters/);
  assert.match(usage, /120\s+characters/);
  assert.match(usage, /100000\s+characters/);
  assert.match(usage, /never the user's word/);
  assert.match(usage, /prints the session's first message as a block to copy/);
  assert.match(usage, /begins with -- goes after a lone --: -- "--a text", --relief -- "--a line", --opening -- "--a title"/);
});

// --- a text that begins with -- ---

test('after a lone -- a notice takes a text that begins with --, and without it the refusal says how', withMachine(async (machine) => {
  const refused = await runNotify(machine, ['--to', '5', '--kind', 'note', '--watch is slow']);
  assert.equal(refused.code, 2);
  assert.match(refused.err.join('\n'), /^unknown argument: --watch is slow \(a text that begins with -- goes after a lone --\)/);
  assert.equal(fs.existsSync(machine.record), false);

  const { code } = await runNotify(machine, ['--to', '5', '--kind', 'note', '--', '--watch is slow']);
  assert.equal(code, 0);
  // The flags may come in any order before it, and a text that is exactly -- is one too.
  assert.equal((await runNotify(machine, ['--kind', 'answer', '--line', '7', '--to', '5', '--transcript', '1d16beeb', '--', '--no-wait'])).code, 0);
  assert.equal((await runNotify(machine, ['--to', '5', '--kind', 'note', '--', '--'])).code, 0);
  assert.deepEqual(recorded(machine).notices.map((one) => [one.kind, one.text]), [['note', '--watch is slow'], ['answer', '--no-wait'], ['note', '--']]);
}));

test('--relief and --opening take what follows a lone -- as their line and their title', withMachine(async (machine) => {
  const relief = await runNotify(machine, ['--relief', '--', '--watch is slow on this machine']);
  assert.deepEqual([relief.code, relief.err], [0, []]);
  assert.equal(fs.readFileSync(reliefPath(machine.home, machine.slug), 'utf8'), `${reliefStamp(NOW)} --watch is slow on this machine\n`);

  const opening = await runNotify(machine, ['--opening', '--', '--draft · una prueba'], { readStdin: () => OPENING });
  assert.equal(opening.code, 0);
  assert.deepEqual(findOpenings(machine.home, machine.slug, '--draft · una prueba').openings.map((one) => one.text), [OPENING]);
}));

// Found by the review of T1: a text before the flag was taken for the value the lone -- did not give.
test('a lone -- with nothing after it gives --relief and --opening no value, whatever text came before the flag', withMachine(async (machine) => {
  const neverRun = () => assert.fail('a usage error must not run anything');
  for (const [argv, flag] of [[['a line', '--relief', '--'], '--relief'], [['JH 5 · x', '--opening', '--'], '--opening']]) {
    const { code, out, err } = await runNotify(machine, argv, { run: neverRun, sessions: neverRun, readStdin: () => OPENING });
    assert.deepEqual([code, out], [2, []], flag);
    assert.equal(err.join('\n').split('\n')[0], `${flag} requires a value`);
  }
  assert.equal(fs.existsSync(machine.home), false, 'nothing is written under the home');
}));

// --- a notice ---

test('notify appends one line to the project\'s record with the clock, the sender, the role, the kind, the text and where it ran, then prints the address', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE, { permissionMode: 'auto' });
  writeSession(machine, ORCHESTRATOR, ORCHESTRATOR_TITLE);
  const { code, out, err } = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'opened', 'session channel, T1']);
  assert.deepEqual([code, err], [0, []]);
  const text = fs.readFileSync(machine.record, 'utf8');
  assert.equal(text.endsWith('\n'), true);
  assert.deepEqual(text.trimEnd().split('\n').map((line) => JSON.parse(line)), [
    {
      schema: 'js-harness.channel-notice/v1',
      at: '2026-01-01T12:00:00.000Z',
      from: { host: 'claude-code', id: SENDER, source: 'environment', title: SENDER_TITLE, permissionMode: 'auto', context: null },
      to: { role: 'orchestrator', number: null },
      kind: 'opened',
      text: 'session channel, T1',
      cwd: machine.worktree,
      worktree: machine.worktree,
      branch: 'feat/session-record',
    },
  ]);
  assert.deepEqual(out, [
    `js-harness notify: recorded opened for the orchestrator at ${localStamp('2026-01-01T12:00:00.000Z')} from "${SENDER_TITLE}" in ${machine.record}`,
    `address of the orchestrator: ${ORCHESTRATOR_TITLE}`,
  ]);
}));

test('the record is the project\'s, whichever worktree the notice is sent from, and each notice has the time the clock gave', withMachine(async (machine) => {
  await runNotify(machine, ['--to', '5', '--kind', 'note', 'from a worktree']);
  await runNotify(machine, ['--to', '5', '--kind', 'note', 'from the checkout'], { cwd: machine.root, now: () => NOW + 90000 });
  await runNotify(machine, ['--to', '5', '--kind', 'note', 'from a folder given', '--cwd', path.join(machine.worktree, 'bin')], { cwd: machine.dir, now: () => NOW + 180000 });
  const { notices, skipped } = recorded(machine);
  assert.equal(skipped, 0);
  assert.deepEqual(notices.map((one) => [one.at, one.cwd, one.worktree]), [
    ['2026-01-01T12:00:00.000Z', machine.worktree, machine.worktree],
    ['2026-01-01T12:01:30.000Z', machine.root, machine.root],
    ['2026-01-01T12:03:00.000Z', path.join(machine.worktree, 'bin'), path.join(machine.worktree, 'bin')],
  ]);
  assert.deepEqual(fs.readdirSync(channelDir(machine.home)), [`${machine.slug}.jsonl`]);
}));

test('the time is never the caller\'s: there is no flag for it', withMachine(async (machine) => {
  for (const flag of ['--at', '--time', '--date']) {
    const { code } = await runNotify(machine, ['--to', '5', '--kind', 'note', 'probe', flag, '2020-01-01T00:00:00.000Z']);
    assert.equal(code, 2, flag);
  }
  assert.equal(fs.existsSync(machine.record), false);
}));

test('outside a repository the folder is the project, and the notice records no worktree and no branch', withMachine(async (machine) => {
  const { code, out } = await runNotify(machine, ['--to', '5', '--kind', 'waiting', 'on his answer'], { cwd: machine.root, run: notARepository });
  assert.equal(code, 0);
  const [notice] = recorded(machine).notices;
  assert.deepEqual([notice.cwd, notice.worktree, notice.branch], [machine.root, null, null]);
  assert.match(out[0], /recorded waiting for work session 5 /);
}));

test('a failure to read the worktree or the branch records null and never fails the notice', withMachine(async (machine) => {
  const { run } = fakeGit(machine);
  const onlyTheProject = (command, args, options) => (args.includes('--git-common-dir') ? run(command, args, options) : (() => { throw new Error('made up'); })());
  const { code } = await runNotify(machine, ['--to', '5', '--kind', 'note', 'probe'], { run: onlyTheProject });
  assert.equal(code, 0);
  const [notice] = recorded(machine).notices;
  assert.deepEqual([notice.cwd, notice.worktree, notice.branch], [machine.worktree, null, null]);
}));

test('an answer is recorded with the transcript and the line his words are read at', withMachine(async (machine) => {
  const { code } = await runNotify(machine, ['--to', '5', '--kind', 'answer', '--transcript', '1d16beeb', '--line', '406', 'Entonces la A']);
  assert.equal(code, 0);
  const [notice] = recorded(machine).notices;
  assert.deepEqual([notice.kind, notice.text, notice.transcript, notice.line], ['answer', 'Entonces la A', '1d16beeb', 406]);
}));

test('a ready notice is recorded with the number of its pull request, and the confirmation names it', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  const { code, out } = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'ready', '--pr', '344', 'T20b: every wait ends on a notice to its own number']);
  assert.equal(code, 0);
  const [notice] = recorded(machine).notices;
  assert.deepEqual([notice.kind, notice.pr, notice.text], ['ready', 344, 'T20b: every wait ends on a notice to its own number']);
  assert.match(out[0], /^js-harness notify: recorded ready for pull request 344 for the orchestrator at /);
}));

test('a ready notice the land would leave out is refused with the land\'s reasons, and nothing is recorded', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  const asked = [];
  const landChecks = async (pr, cwd) => {
    asked.push([pr, cwd]);
    return ['PR 360: its body has no gentle-ai line.'];
  };
  const { code, out, err } = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'ready', '--pr', '360', 'T1 is ready'], { landChecks });
  assert.equal(code, 1);
  assert.deepEqual(asked, [[360, machine.worktree]]);
  assert.deepEqual(out, []);
  assert.match(err.join('\n'), /pull request 360 is not ready to land: PR 360: its body has no gentle-ai line\. Not recorded\./);
  assert.deepEqual(recorded(machine).notices, []);
}));

// A session that finishes hands the lead its summary (odd/tasks/session-close.md, T2).
test('a closed notice is recorded with its summary once the summary is checked, from the worktree it is sent from', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  const asked = [];
  const closeChecks = async (file, cwd) => {
    asked.push([file, cwd]);
    return [];
  };
  const { code, out } = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'closed', '--summary', 'docs/sessions/2026-01-01-jh-5.md', 'T1-T3 delivered'], { closeChecks });
  assert.equal(code, 0);
  assert.deepEqual(asked, [['docs/sessions/2026-01-01-jh-5.md', machine.worktree]]);
  const [notice] = recorded(machine).notices;
  assert.deepEqual([notice.kind, notice.summary, notice.text], ['closed', 'docs/sessions/2026-01-01-jh-5.md', 'T1-T3 delivered']);
  assert.match(out[0], /^js-harness notify: recorded closed for the orchestrator at /);
}));

test('a closed notice whose summary is not ready is refused with the reasons, and nothing is recorded', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  const closeChecks = async () => ['docs/sessions/2026-01-01-jh-5.md is not pushed: neither origin/main nor origin/feat/x holds it; commit it and push.'];
  const { code, out, err } = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'closed', '--summary', 'docs/sessions/2026-01-01-jh-5.md', 'T1-T3 delivered'], { closeChecks });
  assert.equal(code, 1);
  assert.deepEqual(out, []);
  assert.match(err.join('\n'), /the summary is not ready: docs\/sessions\/2026-01-01-jh-5\.md is not pushed: neither origin\/main nor origin\/feat\/x holds it; commit it and push\. Not recorded\./);
  assert.deepEqual(recorded(machine).notices, []);
}));

test('a notice of another kind runs no summary checks', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  const closeChecks = async () => assert.fail('a note is no closed notice');
  const { code } = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'note', 'probe'], { closeChecks });
  assert.equal(code, 0);
}));

test('a notice of another kind runs no land checks', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  const landChecks = async () => assert.fail('a note is no ready notice');
  const { code } = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'note', 'probe'], { landChecks });
  assert.equal(code, 0);
}));

/** A `run` that answers gh with the pull request `view` and git with origin/main's id, and keeps what it was asked. */
function landRun(view, { ghStatus = 0, fetchStatus = 0 } = {}) {
  const calls = [];
  const run = (command, args, options) => {
    calls.push([command, ...args, options?.cwd]);
    if (command === 'gh') return { status: ghStatus, stdout: ghStatus === 0 ? JSON.stringify(view) : '', stderr: ghStatus === 0 ? '' : 'no such pull request' };
    if (args[0] === 'fetch') return { status: fetchStatus, stdout: '', stderr: fetchStatus === 0 ? '' : 'no network' };
    if (args[0] === 'rev-parse') return { status: 0, stdout: 'main0sha\n', stderr: '' };
    return { status: 1, stdout: '', stderr: 'unexpected' };
  };
  return { run, calls };
}

const READY_VIEW = { number: 360, state: 'OPEN', isDraft: false, mergeable: 'MERGEABLE', baseRefName: 'main', body: 'gentle-ai: approved\nRisk: none', headRefOid: 'head0sha' };

test('readyProblems asks the land\'s reviewEvidence about the head against fetched origin/main, and passes what passes', async () => {
  const { run, calls } = landRun(READY_VIEW);
  const seen = [];
  const evidence = (cwd, main, head) => {
    seen.push([cwd, main, head]);
    return { pass: true, detail: 'covered' };
  };
  assert.deepEqual(await readyProblems(360, 'D:/wt', { run, evidence }), []);
  assert.deepEqual(seen, [['D:/wt', 'main0sha', 'head0sha']]);
  assert.deepEqual(calls[0].slice(0, 4), ['gh', 'pr', 'view', '360']);
  assert.ok(calls.some((call) => call[1] === 'fetch'));
});

test('readyProblems gives pullRequestProblems\' words, and reads UNKNOWN mergeable as the land does', async () => {
  const evidence = () => ({ pass: true, detail: 'covered' });
  assert.deepEqual(await readyProblems(360, 'D:/wt', { run: landRun({ ...READY_VIEW, body: 'Risk: none' }).run, evidence }), ['PR 360: its body has no gentle-ai line.']);
  assert.deepEqual(await readyProblems(360, 'D:/wt', { run: landRun({ ...READY_VIEW, mergeable: 'UNKNOWN' }).run, evidence }), []);
  assert.deepEqual(await readyProblems(360, 'D:/wt', { run: landRun({ ...READY_VIEW, mergeable: 'CONFLICTING' }).run, evidence }), ['PR 360 is not mergeable (CONFLICTING).']);
});

test('readyProblems gives reviewEvidence\'s detail when the reviews do not cover the head', async () => {
  const evidence = () => ({ pass: false, detail: 'commit abc1234 has no gentle-ai line on its branch' });
  assert.deepEqual(await readyProblems(360, 'D:/wt', { run: landRun(READY_VIEW).run, evidence }), ['PR 360: commit abc1234 has no gentle-ai line on its branch.']);
});

test('readyProblems says so when gh or the fetch does not answer', async () => {
  const evidence = () => assert.fail('nothing to ask before the pull request is read');
  assert.match((await readyProblems(360, 'D:/wt', { run: landRun(READY_VIEW, { ghStatus: 1 }).run, evidence }))[0], /could not read pull request 360 with gh \(no such pull request\)/);
  assert.match((await readyProblems(360, 'D:/wt', { run: landRun(READY_VIEW, { fetchStatus: 1 }).run, evidence }))[0], /could not fetch origin \(no network\)/);
});

test('the usage says what a ready notice takes', async () => {
  const err = [];
  assert.equal(await notifyMain([], { stdout: () => {}, stderr: (line) => err.push(line) }), 2);
  assert.match(err.join('\n'), /A ready notice says a pull request is ready to land, and names it with --pr <n>/);
  assert.match(err.join('\n'), /refused, with the land's reasons,\s+while the land would leave that pull request out/);
});

// --- who sends ---

test('--self names the sender in place of the host\'s id, and is the one the address does not count', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  writeSession(machine, ORCHESTRATOR, ORCHESTRATOR_TITLE);
  // The orchestrator writes to its own role: no other session holds it.
  const { code, out } = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'relieved', 'JH ORQ nueva has the role', '--self', 'bbbbbbbb']);
  assert.equal(code, 0);
  assert.deepEqual(recorded(machine).notices[0].from, { host: 'claude-code', id: ORCHESTRATOR, source: 'flag', title: ORCHESTRATOR_TITLE, permissionMode: 'bypassPermissions', context: null });
  const address = await runAddress(machine, 'orchestrator', { self: 'bbbbbbbb' });
  assert.equal(address.code, 1);
  assert.equal(out[1], `address of the orchestrator: no single one now (sessions --address exit 1): ${address.err[0].replace('js-harness sessions: ', '')}`);
}));

test('a session the host does not name still records its notice, as a sender that is not known, and is told so', withMachine(async (machine) => {
  writeSession(machine, ORCHESTRATOR, ORCHESTRATOR_TITLE);
  const { code, out, err } = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'closed', '--summary', 'docs/sessions/2026-01-01-jh-5.md', 'delivered; nothing more goes to this session'], { env: { CODEX_HOME: 'C:\\codex' } });
  assert.equal(code, 0);
  assert.deepEqual(recorded(machine).notices[0].from, { host: 'unknown', id: null, source: null, title: null, permissionMode: null, context: null });
  assert.match(out[0], /recorded closed for the orchestrator at \d\d:\d\d local \(\S+\) from a sender the host does not name in /);
  assert.equal(out[1], `address of the orchestrator: ${ORCHESTRATOR_TITLE}`);
  assert.deepEqual(err, ['js-harness notify: the sender is not known: the host gave no session id (CLAUDE_CODE_SESSION_ID is not set) and --self names none']);
}));

test('a sender whose transcript gives no title is named by the start of its id', withMachine(async (machine) => {
  const { out } = await runNotify(machine, ['--to', '5', '--kind', 'note', 'probe']);
  assert.match(out[0], / from session aaaaaaaa in /);
}));

test('the confirmation stamps the hour on the local clock and the share of its context the sender holds, read from its transcript', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE, { usage: { input_tokens: 150000, cache_read_input_tokens: 50000, cache_creation_input_tokens: 0, output_tokens: 300 } });
  const { code, out } = await runNotify(machine, ['--to', '5', '--kind', 'note', 'probe']);
  assert.equal(code, 0);
  assert.equal(out[0], `js-harness notify: recorded note for work session 5 at ${localStamp('2026-01-01T12:00:00.000Z')} from "${SENDER_TITLE}", holding 40% of its context in ${machine.record}`);
  assert.deepEqual(recorded(machine).notices[0].from.context, { tokens: 200000, percent: 40 });
}));

test('a sender whose context is not known gets no share in the confirmation, and its notice records none', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  const { code, out } = await runNotify(machine, ['--to', '5', '--kind', 'note', 'probe']);
  assert.equal(code, 0);
  assert.equal(out[0], `js-harness notify: recorded note for work session 5 at ${localStamp('2026-01-01T12:00:00.000Z')} from "${SENDER_TITLE}" in ${machine.record}`);
  assert.equal(recorded(machine).notices[0].from.context, null);
}));

/** A session as the phone opens one: its transcript carries no title, only what was typed to it. */
function writeUntitled(machine, id, { seconds = 60 } = {}) {
  const at = before(seconds).toISOString();
  const entries = [
    { type: 'user', timestamp: at, cwd: machine.root, gitBranch: 'main', isSidechain: false, permissionMode: 'auto', origin: { kind: 'human' }, message: { role: 'user', content: 'made up' } },
    { type: 'assistant', timestamp: at, cwd: machine.root, gitBranch: 'main', isSidechain: false, message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: 'made up' }] } },
  ];
  const file = path.join(machine.projectDir, `${id}.jsonl`);
  fs.writeFileSync(file, entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n', 'utf8');
  fs.utimesSync(file, before(seconds), before(seconds));
}

// The transcript of a session opened from the phone carries no title: the opening it read says which it is.
test('a sender whose transcript carries no title takes the title of the opening it read, and a title in its transcript wins', withMachine(async (machine) => {
  writeSession(machine, ORCHESTRATOR, ORCHESTRATOR_TITLE);
  writeUntitled(machine, SENDER);
  assert.equal((await runNotify(machine, ['--opening', SENDER_TITLE], { readStdin: () => OPENING, env: { CLAUDE_CODE_SESSION_ID: ORCHESTRATOR } })).code, 0);
  const reads = (env) => sessionsMain(['--opening', 'JH 5', '--claude-home', machine.claudeHome], { cwd: machine.worktree, stdout: () => {}, stderr: () => {}, env: { JS_HARNESS_HOME: machine.home, ...env }, now: () => NOW, run: fakeGit(machine).run });
  const first = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'opened', 'before it read its opening']);
  assert.match(first.out[0], / from session aaaaaaaa in /);
  assert.equal(await reads({ CLAUDE_CODE_SESSION_ID: SENDER }), 0);
  const second = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'waiting', 'on his answer']);
  assert.deepEqual([second.code, second.err], [0, []]);
  assert.match(second.out[0], new RegExp(` from "${SENDER_TITLE}" in `));
  assert.deepEqual(recorded(machine).notices.map((one) => [one.from.id, one.from.title, one.from.permissionMode]), [[SENDER, null, 'auto'], [SENDER, SENDER_TITLE, 'auto']]);
  // The reading of another session gives this one nothing.
  const other = await runNotify(machine, ['--to', '5', '--kind', 'note', 'probe'], { env: { CLAUDE_CODE_SESSION_ID: ORCHESTRATOR } });
  assert.match(other.out[0], new RegExp(` from "${ORCHESTRATOR_TITLE}" in `));
  // Renamed in the app on a desktop, its transcript has a title, and that is the one.
  writeSession(machine, SENDER, 'JH 5 · renombrada');
  await runNotify(machine, ['--to', 'orchestrator', '--kind', 'note', 'probe']);
  assert.equal(recorded(machine).notices.at(-1).from.title, 'JH 5 · renombrada');
}));

// Review of ce8bdf7, finding 6: with the record unreadable the notice was written with no title and no word of why.
test('a notice from a session with no title in its transcript is written when the record cannot be read, and one line says the title is not known', withMachine(async (machine) => {
  writeSession(machine, ORCHESTRATOR, ORCHESTRATOR_TITLE);
  writeUntitled(machine, SENDER);
  await runNotify(machine, ['--opening', SENDER_TITLE], { readStdin: () => OPENING, env: { CLAUDE_CODE_SESSION_ID: ORCHESTRATOR } });
  assert.equal(await sessionsMain(['--opening', 'JH 5', '--claude-home', machine.claudeHome], { cwd: machine.worktree, stdout: () => {}, stderr: () => {}, env: { JS_HARNESS_HOME: machine.home, CLAUDE_CODE_SESSION_ID: SENDER }, now: () => NOW, run: fakeGit(machine).run }), 0);
  const record = recorded(machine).path;
  // The record as the board's test has it: busy, as when another session is writing it.
  const busy = (absolute) => {
    if (absolute === record) throw Object.assign(new Error('busy'), { code: 'EBUSY' });
    return fs.readFileSync(absolute, 'utf8');
  };
  const notKnown = `js-harness notify: the title of the sender is not known: its transcript carries none, and the channel's record ${record} could not be read (EBUSY) to look for the opening it read`;
  const sent = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'note', 'probe'], { readFile: busy });
  assert.equal(sent.code, 0);
  assert.deepEqual(sent.err.filter((line) => line.startsWith('js-harness notify: ')), [notKnown]);
  assert.match(sent.out[0], / from session aaaaaaaa in /);
  assert.deepEqual(recorded(machine).notices.map((one) => [one.text, one.from.id, one.from.title]), [['probe', SENDER, null]]);
  // An opening it stores then is stored the same way, and says the same.
  const stored = await runNotify(machine, ['--opening', 'JH 8 · otra'], { readStdin: () => OPENING, readFile: busy });
  assert.deepEqual([stored.code, stored.err.filter((line) => line.includes('title of the sender'))], [0, [notKnown]]);
  // With the record readable there is nothing to say, nor for a sender whose transcript has its title.
  const read = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'note', 'again']);
  assert.deepEqual([read.err, recorded(machine).notices.at(-1).from.title], [[], SENDER_TITLE]);
  const titled = await runNotify(machine, ['--to', '5', '--kind', 'note', 'probe'], { readFile: busy, env: { CLAUDE_CODE_SESSION_ID: ORCHESTRATOR } });
  assert.deepEqual(titled.err.filter((line) => line.includes('title of the sender')), []);
}));

test('the address is asked of the record notify writes: under --home, a session known only by the opening it read is the address of its role', withMachine(async (machine) => {
  writeSession(machine, ORCHESTRATOR, ORCHESTRATOR_TITLE);
  writeUntitled(machine, SENDER);
  await runNotify(machine, ['--opening', SENDER_TITLE], { readStdin: () => OPENING, env: { CLAUDE_CODE_SESSION_ID: ORCHESTRATOR } });
  assert.equal(await sessionsMain(['--opening', 'JH 5', '--claude-home', machine.claudeHome], { cwd: machine.worktree, stdout: () => {}, stderr: () => {}, env: { JS_HARNESS_HOME: machine.home, CLAUDE_CODE_SESSION_ID: SENDER }, now: () => NOW, run: fakeGit(machine).run }), 0);
  const { code, out } = await runNotify(machine, ['--to', '5', '--kind', 'note', 'the gate is free'], { env: { CLAUDE_CODE_SESSION_ID: ORCHESTRATOR } });
  assert.equal(code, 0);
  assert.equal(out[1], `address of work session 5: ${SENDER_TITLE}`);
}));

// --- the address ---

test('the address notify prints is the answer of sessions --address, and the notice is recorded with exit 0 whatever that answer is', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  const strip = (line) => line.replace('js-harness sessions: ', '');
  const send = async (role) => {
    const sent = await runNotify(machine, ['--to', role, '--kind', 'note', 'probe']);
    return { sent, address: await runAddress(machine, role) };
  };

  // None holds the role.
  const none = await send('orchestrator');
  assert.deepEqual([none.sent.code, none.address.code], [0, 1]);
  assert.deepEqual(none.sent.out.slice(1), [`address of the orchestrator: no single one now (sessions --address exit 1): ${strip(none.address.err[0])}`]);

  // One does.
  writeSession(machine, ORCHESTRATOR, ORCHESTRATOR_TITLE);
  const one = await send('ORQ');
  assert.deepEqual([one.sent.code, one.address.code, one.address.out], [0, 0, [ORCHESTRATOR_TITLE]]);
  assert.deepEqual(one.sent.out.slice(1), [`address of the orchestrator: ${ORCHESTRATOR_TITLE}`]);

  // Two do: a message to the role has no single address.
  writeSession(machine, 'cccccccc-3333-4333-8333-333333333333', 'JH ORQ · otra', { seconds: 30 });
  const two = await send('orchestrator');
  assert.deepEqual([two.sent.code, two.address.code], [0, 2]);
  assert.deepEqual(two.sent.out.slice(1), [`address of the orchestrator: no single one now (sessions --address exit 2): "JH ORQ · otra"; "${ORCHESTRATOR_TITLE}"; ${strip(two.address.err[0])}`]);

  // A work session, by its number.
  const work = await send('5');
  assert.equal(work.address.code, 1, 'the one that asks is not counted');
  assert.match(work.sent.out[1], /^address of work session 5: no single one now \(sessions --address exit 1\): no session carries the title of work session 5 /);

  assert.equal(recorded(machine).notices.length, 4);
}));

test('a project with no sessions folder has no address, and the notice is recorded all the same', withMachine(async (machine) => {
  fs.rmSync(machine.projectDir, { recursive: true });
  const { code, out } = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'note', 'probe']);
  assert.equal(code, 0);
  assert.match(out[1], /^address of the orchestrator: no single one now \(sessions --address exit 1\): no sessions folder for /);
  assert.equal(recorded(machine).notices.length, 1);
}));

test('what sessions --address says beside a title is said by notify too, on stderr', withMachine(async (machine) => {
  // Two transcripts under one title, the asker's among them: the transcripts cannot tell a restart from a twin.
  writeSession(machine, SENDER, ORCHESTRATOR_TITLE);
  writeSession(machine, ORCHESTRATOR, ORCHESTRATOR_TITLE);
  const { code, out, err } = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'note', 'probe']);
  const address = await runAddress(machine, 'orchestrator');
  assert.deepEqual([code, out[1]], [0, `address of the orchestrator: ${ORCHESTRATOR_TITLE}`]);
  assert.equal(address.err.length, 1);
  assert.deepEqual(err, address.err);
}));

test('an address that cannot be asked for is said in one line, after the notice is recorded', withMachine(async (machine) => {
  const sessions = () => {
    throw new Error('made up');
  };
  const { code, out } = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'note', 'probe'], { sessions });
  assert.equal(code, 0);
  assert.equal(out[1], 'address of the orchestrator: not known: sessions --address could not be asked (made up)');
  assert.equal(recorded(machine).notices.length, 1);
}));

test('notify hands sessions --address the role, the folder, the Claude home and the sender it was given', withMachine(async (machine) => {
  const asked = [];
  const sessions = async (argv, deps) => {
    asked.push({ argv, cwd: deps.cwd, env: deps.env });
    deps.stdout('JH 7 · made up');
    return 0;
  };
  const env = { CLAUDE_CODE_SESSION_ID: SENDER };
  await runNotify(machine, ['--to', '7', '--kind', 'note', 'probe', '--self', 'bbbbbbbb', '--cwd', machine.root], { sessions, env });
  await runNotify(machine, ['--to', 'ORQ', '--kind', 'note', 'probe'], { sessions, env });
  // The harness home goes with the environment: the board has no flag for it, and it reads the record
  // notify has just written, where a session opened from the phone has its title.
  const withHome = { ...env, JS_HARNESS_HOME: machine.home };
  assert.deepEqual(asked, [
    { argv: ['--address', '7', '--cwd', machine.root, '--claude-home', machine.claudeHome, '--self', 'bbbbbbbb'], cwd: machine.worktree, env: withHome },
    { argv: ['--address', 'ORQ', '--cwd', machine.worktree, '--claude-home', machine.claudeHome], cwd: machine.worktree, env: withHome },
  ]);
}));

// --- where it writes ---

test('without --home the record is under JS_HARNESS_HOME, or under the home folder; an empty JS_HARNESS_HOME is no home', withMachine(async (machine) => {
  const other = path.join(machine.dir, 'other-home');
  const send = (env, homedir) => {
    const out = [];
    return notifyMain(['--to', '5', '--kind', 'note', 'probe', '--claude-home', machine.claudeHome], { cwd: machine.worktree, stdout: (line) => out.push(line), stderr: () => {}, env, now: () => NOW, homedir, run: fakeGit(machine).run });
  };
  assert.equal(await send({ JS_HARNESS_HOME: other }, () => assert.fail('the environment names the home')), 0);
  assert.equal(readNotices(other, machine.slug).notices.length, 1);
  assert.equal(await send({ JS_HARNESS_HOME: '' }, () => machine.home), 0);
  assert.equal(await send({}, () => machine.home), 0);
  assert.equal(recorded(machine).notices.length, 2);
}));

test('without --claude-home the sender\'s transcript is read under CLAUDE_CONFIG_DIR, or under .claude in the home folder', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  const send = (env, homedir) => notifyMain(['--to', '5', '--kind', 'note', 'probe', '--home', machine.home], { cwd: machine.worktree, stdout: () => {}, stderr: () => {}, env: { CLAUDE_CODE_SESSION_ID: SENDER, ...env }, now: () => NOW, homedir, run: fakeGit(machine).run });
  assert.equal(await send({ CLAUDE_CONFIG_DIR: machine.claudeHome }, () => path.join(machine.dir, 'os-home')), 0);
  fs.renameSync(machine.claudeHome, path.join(machine.dir, '.claude'));
  assert.equal(await send({}, () => machine.dir), 0);
  assert.deepEqual(recorded(machine).notices.map((one) => one.from.title), [SENDER_TITLE, SENDER_TITLE]);
}));

test('a record that cannot be written is exit 1 with the file and the reason, and no address is asked for', withMachine(async (machine) => {
  // A file where the harness folder would be: nothing can be created under it.
  fs.mkdirSync(machine.home, { recursive: true });
  fs.writeFileSync(path.join(machine.home, '.js-harness'), 'in the way', 'utf8');
  const { code, out, err } = await runNotify(machine, ['--to', '5', '--kind', 'note', 'probe'], { sessions: () => assert.fail('nothing was recorded') });
  assert.equal(code, 1);
  assert.deepEqual(out, []);
  assert.equal(err.length, 1);
  assert.ok(err[0].startsWith(`js-harness notify: could not write ${machine.record} (E`), err[0]);
}));

// --- the relief file ---

test('--relief appends one line stamped with the clock to the orchestrator\'s relief file, which the board then shows', withMachine(async (machine) => {
  const file = reliefPath(machine.home, machine.slug);
  const first = await runNotify(machine, ['--relief', 'JH 5 opened: session channel, T1']);
  assert.deepEqual([first.code, first.err], [0, []]);
  assert.deepEqual(first.out, [`js-harness notify: appended to the relief file ${file}: ${reliefStamp(NOW)} JH 5 opened: session channel, T1`]);
  const second = await runNotify(machine, ['--relief', 'merged pull request 58'], { now: () => NOW + 3600000 });
  assert.equal(second.code, 0);
  assert.deepEqual(fs.readFileSync(file, 'utf8').split('\n'), [`${reliefStamp(NOW)} JH 5 opened: session channel, T1`, `${reliefStamp(NOW + 3600000)} merged pull request 58`, '']);
  assert.equal(fs.existsSync(channelDir(machine.home)), false, 'a relief line is no notice');

  // The board reads the same file under the same home.
  const out = [];
  const code = await sessionsMain(['--json', '--claude-home', machine.claudeHome], { cwd: machine.worktree, stdout: (line) => out.push(line), stderr: () => {}, env: { JS_HARNESS_HOME: machine.home }, now: () => NOW, run: fakeGit(machine).run, listProcesses: () => [] });
  assert.equal(code, 0);
  const { relief } = JSON.parse(out.join('\n'));
  assert.deepEqual([relief.path, relief.lineCount, relief.lines.at(-1)], [file, 2, `${reliefStamp(NOW + 3600000)} merged pull request 58`]);
}));

test('a long relief line is printed clipped and written whole', withMachine(async (machine) => {
  const line = `long ${'x'.repeat(3000)}`;
  const { code, out } = await runNotify(machine, ['--relief', line]);
  assert.equal(code, 0);
  const file = reliefPath(machine.home, machine.slug);
  assert.deepEqual(out, [`js-harness notify: appended to the relief file ${file}: ${`${reliefStamp(NOW)} ${line}`.slice(0, 300)}… (3005 characters)`]);
  assert.equal(fs.readFileSync(file, 'utf8'), `${reliefStamp(NOW)} ${line}\n`);
}));

// --- the openings ---

const OPENING = 'Sos JH 5.\nLeé odd/tasks/session-channel.md y seguí su "Next step".\n';

test('--opening stores the text of standard input under the title, and the same title again replaces it and says so', withMachine(async (machine) => {
  writeSession(machine, SENDER, ORCHESTRATOR_TITLE);
  const file = path.join(openingsDir(machine.home, machine.slug), openingFileName(SENDER_TITLE));
  const first = await runNotify(machine, ['--opening', SENDER_TITLE], { readStdin: () => Buffer.from(OPENING, 'utf8') });
  assert.deepEqual([first.code, first.err], [0, []]);
  assert.deepEqual(first.out, [`js-harness notify: opening for "${SENDER_TITLE}" written in ${file} (2 lines, ${OPENING.length} characters)`, ...firstMessageBlock(SENDER_TITLE)]);
  assert.deepEqual(findOpenings(machine.home, machine.slug, 'JH 5').openings, [
    { path: file, title: SENDER_TITLE, at: '2026-01-01T12:00:00.000Z', from: { host: 'claude-code', id: SENDER, source: 'environment', title: ORCHESTRATOR_TITLE, permissionMode: 'bypassPermissions', context: null }, text: OPENING },
  ]);

  const second = await runNotify(machine, ['--opening', SENDER_TITLE], { readStdin: () => 'One line.', now: () => NOW + 60000 });
  assert.equal(second.code, 0);
  assert.deepEqual(second.out, [`js-harness notify: opening for "${SENDER_TITLE}" replaced in ${file} (1 line, 9 characters)`, ...firstMessageBlock(SENDER_TITLE)]);
  assert.deepEqual(findOpenings(machine.home, machine.slug, SENDER_TITLE).openings.map((one) => [one.at, one.text]), [['2026-01-01T12:01:00.000Z', 'One line.']]);
  assert.equal(fs.existsSync(machine.record), false, 'an opening is no notice');
}));

test('an opening whose title is not a session\'s is stored, and notify says it is found by its whole title only', withMachine(async (machine) => {
  const { code, err } = await runNotify(machine, ['--opening', 'notas sueltas'], { readStdin: () => OPENING });
  assert.equal(code, 0);
  assert.deepEqual(err, ['js-harness notify: "notas sueltas" is not of the shape <code> <role> · <what it does>: the opening is found by its whole title, not by a code and a role']);
  assert.equal(findOpenings(machine.home, machine.slug, 'notas sueltas').openings.length, 1);
}));

test('--opening refuses a terminal, an empty text and bytes that are not UTF-8, with its usage, and writes nothing', withMachine(async (machine) => {
  const neverRun = () => assert.fail('a usage error must not run anything');
  const cases = [
    [{ stdinIsTTY: true, readStdin: () => assert.fail('a terminal is not read') }, /standard input is a terminal/],
    [{ readStdin: () => Buffer.alloc(0) }, /the text of an opening is empty/],
    [{ readStdin: () => ' \r\n ' }, /the text of an opening is empty/],
    [{ readStdin: () => Buffer.from([0x53, 0x6f, 0x73, 0xe9, 0x21]) }, /not UTF-8/],
    [{ readStdin: () => 'x'.repeat(100001) }, /100001 characters, 100000 at most/],
    // Windows answers a read of a closed standard input with this error: it is an empty text.
    [{ readStdin: () => { throw Object.assign(new Error('EOF: end of file, read'), { code: 'EOF' }); } }, /the text of an opening is empty/],
  ];
  for (const [deps, pattern] of cases) {
    const { code, out, err } = await runNotify(machine, ['--opening', SENDER_TITLE], { run: neverRun, sessions: neverRun, ...deps });
    assert.equal(code, 2, String(pattern));
    assert.deepEqual(out, []);
    assert.match(err.join('\n'), pattern);
    assert.match(err.join('\n'), /Usage: js-harness notify/);
  }
  assert.equal(fs.existsSync(machine.home), false);
}));

test('standard input that cannot be read is exit 1 with the reason', withMachine(async (machine) => {
  const readStdin = () => {
    throw Object.assign(new Error('EISDIR: illegal operation on a directory, read'), { code: 'EISDIR' });
  };
  const { code, err } = await runNotify(machine, ['--opening', SENDER_TITLE], { readStdin });
  assert.equal(code, 1);
  assert.deepEqual(err, ['js-harness notify: could not read the opening from standard input (EISDIR)']);
}));

// The first message of a new session is printed as a block of its own, ready to copy: the user pastes it as
// the first message, so it names the session and says where its opening is read.
// The command in it is between single quotes, which neither PowerShell nor a POSIX shell expands inside.
function firstMessageBlock(title) {
  const quoted = JSON.stringify(title);
  return [
    `The first message of the session ${quoted}, to send in it as it is:`,
    '```',
    `You are the session ${quoted}. Read your opening with js-harness sessions --opening '${title}' and follow it.`,
    '```',
  ];
}

// Codex on 51d869d: a title shells read each its own way (a `$`, a double quote, two leading dashes) got a
// command that asks for another title, or that the parser refuses. Such a title gets the request in words.
test('the first message of a session whose title shells read differently asks in words, and gives no command', withMachine(async (machine) => {
  // A `$` is no such mark: between single quotes neither PowerShell nor a POSIX shell expands it.
  const dollar = await runNotify(machine, ['--opening', 'JH 6 · $HOME'], { readStdin: () => OPENING });
  assert.deepEqual(dollar.out.slice(1), firstMessageBlock('JH 6 · $HOME'));
  for (const title of ['JH 6 "la primera"', '--a title']) {
    const args = title.startsWith('--') ? ['--opening', '--', title] : ['--opening', title];
    const { code, out } = await runNotify(machine, args, { readStdin: () => OPENING });
    assert.equal(code, 0, title);
    assert.deepEqual(out.slice(1), [
      `The first message of the session ${JSON.stringify(title)}, to send in it as it is:`,
      '```',
      `You are the session ${JSON.stringify(title)}. Read your opening with js-harness sessions --opening, giving it your title as one argument, after a lone -- when it begins with --, and follow it.`,
      '```',
    ], title);
  }
}));

test('a stored opening prints, after its line, the first message of the session as a block to copy', withMachine(async (machine) => {
  const title = 'JH 6 · la primera';
  const file = path.join(openingsDir(machine.home, machine.slug), openingFileName(title));
  const { code, out } = await runNotify(machine, ['--opening', title], { readStdin: () => OPENING });
  assert.equal(code, 0);
  assert.deepEqual(out, [`js-harness notify: opening for "${title}" written in ${file} (2 lines, ${OPENING.length} characters)`, ...firstMessageBlock(title)]);
}));

test('a replaced opening prints the first message of the session as a block to copy too', withMachine(async (machine) => {
  const title = 'JH 6 · la primera';
  const file = path.join(openingsDir(machine.home, machine.slug), openingFileName(title));
  await runNotify(machine, ['--opening', title], { readStdin: () => OPENING });
  const { code, out } = await runNotify(machine, ['--opening', title], { readStdin: () => 'One line.', now: () => NOW + 60000 });
  assert.equal(code, 0);
  assert.deepEqual(out, [`js-harness notify: opening for "${title}" replaced in ${file} (1 line, 9 characters)`, ...firstMessageBlock(title)]);
}));

test('an opening that cannot be written prints no block', withMachine(async (machine) => {
  // A file where the harness home should be: the opening cannot be written under it.
  fs.writeFileSync(machine.home, 'not a folder', 'utf8');
  const { code, out, err } = await runNotify(machine, ['--opening', 'JH 6 · la primera'], { readStdin: () => OPENING });
  assert.equal(code, 1);
  assert.deepEqual(out, []);
  assert.equal(err.length, 1);
}));

// --- questions, and their answers and withdrawals ---

const QUESTION = 'Which branch do we merge first?';
const QUESTION_ID = '11111111-2222-4333-8444-555555555555';
const SECOND_ID = '22222222-2222-4222-8222-222222222222';
const QUESTION_JSON = JSON.stringify({ text: QUESTION, options: [{ label: 'main', description: 'the default branch' }, { label: 'feat', description: 'keeps the branch' }], waits: 'T3' });
const QUESTION_AT = '2026-01-01T12:00:00.000Z';
const TRANSCRIPT = 'dddddddd-4444-4444-8444-444444444444';
const TRANSCRIPT_ID = TRANSCRIPT.slice(0, 8);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The time `seconds` after NOW, as a transcript or a record writes it. */
const later = (seconds) => new Date(NOW + seconds * 1000).toISOString();
const transcriptFile = (machine) => path.join(machine.projectDir, `${TRANSCRIPT}.jsonl`);

/** Asks the orchestrator the question of QUESTION_JSON from the session SENDER, over `deps`. */
const askQuestion = (machine, deps = {}) =>
  runNotify(machine, ['--to', 'orchestrator', '--kind', 'question'], { stdinIsTTY: false, readStdin: () => QUESTION_JSON, newId: () => QUESTION_ID, ...deps });

/** Answers question `number` (the first by default) with `text`, read at `line` of the transcript `transcript`. */
const answerTo = (machine, { number = 1, transcript = TRANSCRIPT_ID, line = 2, text = 'Entonces la A', ...deps } = {}) =>
  runNotify(machine, ['--to', 'orchestrator', '--kind', 'answer', '--question', String(number), '--transcript', transcript, '--line', String(line), text], deps);

/** The record as it is, or `null` when there is none: a refused notice must leave it as it was. */
const recordText = (machine) => (fs.existsSync(machine.record) ? fs.readFileSync(machine.record, 'utf8') : null);

/** Writes the transcript of the project named `id`, one entry a line. */
function writeTranscript(machine, id, entries) {
  fs.writeFileSync(path.join(machine.projectDir, `${id}.jsonl`), entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n', 'utf8');
}

/** A reply of the session, `seconds` after NOW: not his words. */
const replied = (seconds) => ({ type: 'assistant', timestamp: later(seconds), isSidechain: false, message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: 'made up' }] } });
/** A line he typed in the chat, `seconds` after NOW. */
const typed = (content, seconds) => ({ type: 'user', timestamp: later(seconds), isSidechain: false, permissionMode: 'auto', origin: { kind: 'human' }, message: { role: 'user', content } });
/** The session asks him `question` with the question tool, `seconds` after NOW. */
const asks = (question, seconds) => ({ type: 'assistant', timestamp: later(seconds), isSidechain: false, message: { role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'toolu_question', name: 'AskUserQuestion', input: { questions: [{ question, header: 'Rama', multiSelect: false, options: [{ label: 'main', description: 'made up' }, { label: 'feat', description: 'made up' }] }] } }] } });
/** His answer `answer` to that question with the question tool, `seconds` after NOW. */
const answering = (question, answer, seconds) => ({ type: 'user', timestamp: later(seconds), isSidechain: false, toolUseResult: { answers: { [question]: answer } }, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_question', content: 'ok' }] } });

const busyRecord = (machine) => (absolute) => {
  if (absolute === machine.record) throw Object.assign(new Error('busy'), { code: 'EBUSY' });
  return fs.readFileSync(absolute, 'utf8');
};

test('a question takes its fields from standard input, not from the command line, and a refused one runs nothing and writes nothing', withMachine(async (machine) => {
  const neverRun = () => assert.fail('a refused question must not run anything');
  const onTheLine = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'question', 'Which branch?'], { run: neverRun, sessions: neverRun, stdinIsTTY: false, readStdin: () => assert.fail('the text on the command line is refused before standard input is read') });
  assert.equal(onTheLine.code, 2);
  assert.deepEqual(onTheLine.out, []);
  assert.equal(onTheLine.err.length, 1);
  assert.match(onTheLine.err[0], /^a question takes its fields from standard input, not from the command line\n\nUsage: js-harness notify/);
  // A question goes to the orchestrator: its draft is checked before anything runs.
  const toASession = await runNotify(machine, ['--to', '5', '--kind', 'question'], { run: neverRun, sessions: neverRun, stdinIsTTY: false, readStdin: () => QUESTION_JSON });
  assert.deepEqual([toASession.code, toASession.out], [2, []]);
  assert.match(toASession.err[0], /Usage: js-harness notify/);
  assert.equal(fs.existsSync(machine.home), false, 'nothing is written under the home');
}));

test('a question reads its fields from standard input as UTF-8, and refuses a terminal, bytes that are not UTF-8 and a standard input that cannot be read', withMachine(async (machine) => {
  const terminal = await askQuestion(machine, { stdinIsTTY: true, readStdin: () => assert.fail('a terminal is not read') });
  assert.equal(terminal.code, 2);
  assert.match(terminal.err[0], /standard input is a terminal/);
  const notUtf8 = await askQuestion(machine, { readStdin: () => Buffer.from([0x7b, 0xe9, 0x7d]) });
  assert.equal(notUtf8.code, 2);
  assert.match(notUtf8.err[0], /the text on standard input is not UTF-8/);
  const empty = await askQuestion(machine, { readStdin: () => { throw Object.assign(new Error('EOF: end of file, read'), { code: 'EOF' }); } });
  assert.deepEqual([empty.code, empty.out], [2, []]);
  assert.match(empty.err[0], /Usage: js-harness notify/);
  assert.equal(fs.existsSync(machine.home), false, 'nothing is written under the home');

  const accented = JSON.stringify({ text: '¿Qué rama mergeamos primero?', options: [], waits: 'T3' });
  assert.equal((await askQuestion(machine, { readStdin: () => Buffer.from(accented, 'utf8') })).code, 0);
  assert.equal(recorded(machine).notices[0].text, '¿Qué rama mergeamos primero?');

  const unreadable = await askQuestion(machine, { readStdin: () => { throw Object.assign(new Error('EISDIR: illegal operation on a directory, read'), { code: 'EISDIR' }); } });
  assert.equal(unreadable.code, 1);
  assert.deepEqual(unreadable.err, ['js-harness notify: could not read the question from standard input (EISDIR)']);
  assert.equal(recorded(machine).notices.length, 1, 'only the first question is recorded');
}));

test('a question takes its id from the seam, and is stored with its options and what waits on it', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  const { code, err } = await askQuestion(machine);
  assert.deepEqual([code, err], [0, []]);
  const notice = recorded(machine).notices[0];
  assert.deepEqual(notice, {
    schema: 'js-harness.channel-notice/v1',
    at: QUESTION_AT,
    from: { host: 'claude-code', id: SENDER, source: 'environment', title: SENDER_TITLE, permissionMode: 'bypassPermissions', context: null },
    to: { role: 'orchestrator', number: null },
    kind: 'question',
    text: QUESTION,
    cwd: machine.worktree,
    worktree: machine.worktree,
    branch: 'feat/session-record',
    id: QUESTION_ID,
    options: [{ label: 'main', description: 'the default branch' }, { label: 'feat', description: 'keeps the branch' }],
    waits: 'T3',
  });
  assert.deepEqual(Object.keys(notice).slice(-3), ['id', 'options', 'waits']);
}));

test('without the seam a question takes a random id of its own, and two questions never share one', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  const ask = () => runNotify(machine, ['--to', 'orchestrator', '--kind', 'question'], { stdinIsTTY: false, readStdin: () => QUESTION_JSON });
  assert.equal((await ask()).code, 0);
  assert.equal((await ask()).code, 0);
  const [first, second] = recorded(machine).notices.map((one) => one.id);
  assert.match(first, UUID);
  assert.match(second, UUID);
  assert.notEqual(first, second);
}));

test('a recorded question is printed with its number and its prefix, and the line after the address rings the one orchestrator', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  writeSession(machine, ORCHESTRATOR, ORCHESTRATOR_TITLE);
  const first = await askQuestion(machine);
  assert.deepEqual([first.code, first.err], [0, []]);
  assert.deepEqual(first.out, [
    `js-harness notify: recorded question 1 for the orchestrator at ${localStamp(QUESTION_AT)} from "${SENDER_TITLE}" in ${machine.record}`,
    'prefix: "Pregunta 1: "',
    `address of the orchestrator: ${ORCHESTRATOR_TITLE}`,
    `question 1 is recorded for ${ORCHESTRATOR_TITLE} to show to the user: ring it with the number, and go on with what does not wait on it`,
  ]);
  const second = await askQuestion(machine, { newId: () => SECOND_ID });
  assert.equal(second.out[0], `js-harness notify: recorded question 2 for the orchestrator at ${localStamp(QUESTION_AT)} from "${SENDER_TITLE}" in ${machine.record}`);
  assert.equal(second.out[1], 'prefix: "Pregunta 2: "');
  assert.deepEqual(recorded(machine).notices.map((one) => one.id), [QUESTION_ID, SECOND_ID]);
}));

test('a question the orchestrator records itself is told how to ask him, by when he last wrote, alone or beside another of its title', withMachine(async (machine) => {
  // `sessions --address` does not count the session that asks, so an orchestrator alone has no address to
  // ring: it is known by its own title, and told when to call the tool, which holds it until he answers.
  // The sender wrote a minute ago, so he is there: the question tool is called now.
  const HOLDS = (number) => `you hold that role: the user wrote here 1m ago: put it to them now with the question tool. Its text is headed by "Pregunta ${number}: "; until it is asked the question waits as this notice`;
  writeSession(machine, SENDER, ORCHESTRATOR_TITLE);
  const alone = await askQuestion(machine);
  assert.equal(alone.code, 0);
  assert.match(alone.out[2], /^address of the orchestrator: no single one now /);
  assert.equal(alone.out[3], HOLDS(1));
  assert.equal(alone.out.length, 4);
  writeSession(machine, ORCHESTRATOR, ORCHESTRATOR_TITLE);
  const beside = await askQuestion(machine, { newId: () => SECOND_ID });
  assert.equal(beside.code, 0);
  assert.equal(beside.out[2], `address of the orchestrator: ${ORCHESTRATOR_TITLE}`);
  assert.equal(beside.out[3], HOLDS(2));
  assert.deepEqual(beside.err, (await runAddress(machine, 'orchestrator')).err);
}));

const ANSWER_LINE = 'Then record the user\'s answer: js-harness notify --to orchestrator --kind answer --question 1 --transcript <session id> --line <n> "<the user\'s answer in one line>"';

test('a question with no orchestrator is to be asked by the sender itself, and the line says how to record his answer', withMachine(async (machine) => {
  // He wrote a minute ago, so the sender asks him now, with the question tool.
  writeSession(machine, SENDER, SENDER_TITLE);
  const { code, out, err } = await askQuestion(machine);
  assert.equal(code, 0);
  assert.deepEqual(err, []);
  assert.match(out[2], /^address of the orchestrator: no single one now \(sessions --address exit 1\): /);
  assert.equal(out[3], `no orchestrator to show it: ask the user yourself: the user wrote here 1m ago: put it to them now with the question tool. Its text is headed by "Pregunta 1: ". ${ANSWER_LINE}`);
  assert.equal(out.length, 4);
}));

test('a question with no orchestrator, when he wrote longer ago, is to be asked in the reply to his next message, and not with the tool now', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE, { seconds: 3600 });
  const { code, out, err } = await askQuestion(machine);
  assert.equal(code, 0);
  assert.deepEqual(err, []);
  assert.equal(out[3], `no orchestrator to show it: ask the user yourself: the user last wrote here 1h 00m ago: the question tool would hold this session until the user answers, so call it in the reply to the user's next message; until then a reply says in one line that 1 question waits and about what, and never writes the options out as text. Its text is headed by "Pregunta 1: ". ${ANSWER_LINE}`);
  assert.equal(out.length, 4);
}));

test('a question with no orchestrator, when the sender\'s transcript holds no words of his, says that when he last wrote is not known', withMachine(async (machine) => {
  // A transcript with its title and a reply of the session, and no entry of his: no time to go by.
  writeTranscript(machine, SENDER, [{ type: 'custom-title', customTitle: SENDER_TITLE, sessionId: SENDER }, replied(-60)]);
  const { code, out, err } = await askQuestion(machine);
  assert.equal(code, 0);
  assert.deepEqual(err, []);
  assert.equal(out[3], `no orchestrator to show it: ask the user yourself: when the user last wrote here is not known: call the question tool in the reply to a message of the user's; until then a reply says in one line that 1 question waits and about what, and never writes the options out as text. Its text is headed by "Pregunta 1: ". ${ANSWER_LINE}`);
  assert.equal(out.length, 4);
}));

test('a question whose number cannot be read back is recorded all the same, with the number not known and the reason on stderr', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  writeSession(machine, ORCHESTRATOR, ORCHESTRATOR_TITLE);
  const { code, out, err } = await askQuestion(machine, { readFile: busyRecord(machine) });
  assert.equal(code, 0);
  assert.equal(out[0], `js-harness notify: recorded question (number not known) for the orchestrator at ${localStamp(QUESTION_AT)} from "${SENDER_TITLE}" in ${machine.record}`);
  assert.equal(out.some((line) => line.startsWith('prefix: ')), false);
  assert.deepEqual(err.filter((line) => line.startsWith('js-harness notify: ')), [`js-harness notify: the number of the question is not known: the channel's record ${machine.record} could not be read back (EBUSY): its number is read with js-harness sessions`]);
  assert.deepEqual(recorded(machine).notices.map((one) => one.id), [QUESTION_ID]);
}));

test('a question number is digits from 1, and only an answer or a withdrawal takes one', withMachine(async (machine) => {
  const neverRun = () => assert.fail('a refused number must not run anything');
  for (const value of ['0', 'x', '1.5', '-1']) {
    const { code, out, err } = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'answer', '--question', value, '--transcript', TRANSCRIPT_ID, '--line', '2', 'Entonces la A'], { run: neverRun, sessions: neverRun });
    assert.deepEqual([code, out], [2, []], value);
    assert.match(err[0], /^--question takes the number of a question, from 1\n\nUsage: js-harness notify/, value);
  }
  const onANote = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'note', '--question', '1', 'probe'], { run: neverRun, sessions: neverRun });
  assert.equal(onANote.code, 2);
  assert.match(onANote.err[0], /an answer or a withdrawal takes --question/);
  assert.equal(fs.existsSync(machine.home), false, 'nothing is written under the home');
}));

test('an answer to a question is refused, and nothing is written, when the record cannot be read', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  assert.equal((await askQuestion(machine)).code, 0);
  writeTranscript(machine, TRANSCRIPT, [replied(30), typed('Entonces la A', 60)]);
  const unchanged = recordText(machine);
  const { code, out, err } = await answerTo(machine, { readFile: busyRecord(machine) });
  assert.deepEqual([code, out], [1, []]);
  assert.deepEqual(err, [`js-harness notify: not recorded: the channel's record ${machine.record} could not be read (EBUSY)`]);
  assert.equal(recordText(machine), unchanged);
}));

test('an answer to a question the record does not hold is refused, and says how many questions it holds', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  writeTranscript(machine, TRANSCRIPT, [replied(30), typed('Entonces la A', 60)]);
  const none = await answerTo(machine);
  assert.deepEqual([none.code, none.out], [1, []]);
  assert.deepEqual(none.err, ['js-harness notify: not recorded: the record holds no question 1 (it holds 0 questions)']);
  assert.equal(recordText(machine), null);
  assert.equal((await askQuestion(machine)).code, 0);
  const second = await answerTo(machine, { number: 2 });
  assert.deepEqual(second.err, ['js-harness notify: not recorded: the record holds no question 2 (it holds 1 question)']);
  assert.equal(recorded(machine).notices.length, 1);
}));

test('an answer to a question that is answered already is refused, and says where its answer is read', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  assert.equal((await askQuestion(machine)).code, 0);
  writeTranscript(machine, TRANSCRIPT, [replied(30), typed('Entonces la A', 60), typed('mejor la B', 90)]);
  assert.equal((await answerTo(machine)).code, 0);
  const unchanged = recordText(machine);
  const again = await answerTo(machine, { line: 3, text: 'mejor la B' });
  assert.deepEqual([again.code, again.out], [1, []]);
  assert.deepEqual(again.err, [`js-harness notify: not recorded: question 1 is closed: answered at ${TRANSCRIPT_ID}:2`]);
  assert.equal(recordText(machine), unchanged);
}));

test('an answer whose transcript is outside the sessions folder, is named by a short id, or is one of several transcripts is refused', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  assert.equal((await askQuestion(machine)).code, 0);
  const unchanged = recordText(machine);
  const outside = path.join(machine.dir, 'elsewhere.jsonl');
  const refusals = [
    [outside, `js-harness notify: not recorded: ${outside} is not a transcript of this project: a file outside its sessions folder is none`],
    ['1d16', 'js-harness notify: not recorded: 1d16 is too short to name a session: a session id takes its first eight characters or more'],
  ];
  for (const [transcript, message] of refusals) {
    const { code, out, err } = await answerTo(machine, { transcript });
    assert.deepEqual([code, out, err], [1, [], [message]], transcript);
  }
  writeTranscript(machine, TRANSCRIPT, [replied(30), typed('Entonces la A', 60)]);
  writeTranscript(machine, 'dddddddd-5555-4555-8555-555555555555', [replied(30), typed('Entonces la A', 60)]);
  const several = await answerTo(machine);
  assert.deepEqual([several.code, several.out, several.err], [1, [], ['js-harness notify: not recorded: 2 transcripts start with dddddddd: give more of the session id']]);
  assert.equal(recordText(machine), unchanged);
}));

test('an answer is recorded unverified, and said so, when no transcript starts with its id or its file cannot be read', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  assert.equal((await askQuestion(machine)).code, 0);
  const none = await answerTo(machine, { transcript: 'ffffffff' });
  assert.equal(none.code, 0);
  assert.equal(none.out[0], `js-harness notify: recorded answer to question 1 for the orchestrator at ${localStamp(QUESTION_AT)} from "${SENDER_TITLE}" in ${machine.record}`);
  assert.deepEqual(none.err, ["js-harness notify: the answer to question 1 is recorded UNVERIFIED: no transcript starts with ffffffff: it is the sender's claim until the line is read"]);
  // A second question, since a question holds one claim: a file of the sessions folder that is not there.
  assert.equal((await askQuestion(machine, { newId: () => SECOND_ID })).code, 0);
  const missing = path.join(machine.projectDir, 'eeeeeeee-6666-4666-8666-666666666666.jsonl');
  const unread = await answerTo(machine, { number: 2, transcript: missing });
  assert.deepEqual([unread.code, unread.err], [0, [`js-harness notify: the answer to question 2 is recorded UNVERIFIED: the transcript ${missing} could not be read (ENOENT): it is the sender's claim until the line is read`]]);
  const [first, second] = recorded(machine).notices.filter((one) => one.kind === 'answer');
  assert.deepEqual([first.question, first.verified, first.copy, first.transcript, first.line], [1, false, null, 'ffffffff', 2]);
  assert.deepEqual([second.question, second.verified, second.copy, second.transcript], [2, false, null, missing]);
}));

test('an answer no transcript confirmed shuts out a second claim and a withdrawal, and lets in his answer read at its line', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  assert.equal((await askQuestion(machine)).code, 0);
  assert.equal((await answerTo(machine, { transcript: 'ffffffff' })).code, 0);
  const claimed = recordText(machine);
  const CLOSED = 'js-harness notify: not recorded: question 1 is closed: answered at ffffffff:2, unverified: only an answer read at its line replaces it';
  const again = await answerTo(machine, { transcript: 'eeeeeeee' });
  assert.deepEqual([again.code, again.out, again.err], [1, [], [CLOSED]]);
  const withdrawn = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'withdrawn', '--question', '1', 'no longer needed']);
  assert.deepEqual([withdrawn.code, withdrawn.out, withdrawn.err], [1, [], [CLOSED]]);
  assert.equal(recordText(machine), claimed, 'neither is written');
  // His words, typed after the question was recorded, at a line that is read.
  writeTranscript(machine, TRANSCRIPT, [replied(30), typed('Entonces la A', 60)]);
  const read = await answerTo(machine);
  assert.deepEqual([read.code, read.err], [0, []]);
  const answers = recorded(machine).notices.filter((one) => one.kind === 'answer');
  assert.deepEqual(answers.map((one) => [one.verified, one.transcript]), [[false, 'ffffffff'], [true, TRANSCRIPT_ID]]);
  // From then on it is closed by the answer that was read, and nothing replaces that.
  const after = await answerTo(machine, { line: 2, text: 'otra vez' });
  assert.deepEqual([after.code, after.err], [1, [`js-harness notify: not recorded: question 1 is closed: answered at ${TRANSCRIPT_ID}:2`]]);
}));

test('an answer typed in the chat after its question is verified, and its words are kept with it', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  assert.equal((await askQuestion(machine)).code, 0);
  writeTranscript(machine, TRANSCRIPT, [replied(30), typed('Entonces la A', 60)]);
  const { code, out, err } = await answerTo(machine);
  assert.deepEqual([code, err], [0, []]);
  assert.deepEqual(out.slice(0, 2), [
    `js-harness notify: recorded answer to question 1 for the orchestrator at ${localStamp(QUESTION_AT)} from "${SENDER_TITLE}" in ${machine.record}`,
    'the user\'s answer, typed in the chat: Entonces la A',
  ]);
  const answer = recorded(machine).notices.at(-1);
  assert.deepEqual([answer.kind, answer.question, answer.verified, answer.transcript, answer.line], ['answer', 1, true, TRANSCRIPT_ID, 2]);
  assert.deepEqual(answer.copy, { tool: null, answers: [{ question: QUESTION, options: [], answer: 'Entonces la A', how: 'typed in the chat' }] });
}));

test('an answer typed in the chat is refused when it was sent before its question, when it holds only pasted text, or when it is not his words', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  assert.equal((await askQuestion(machine)).code, 0);
  const unchanged = recordText(machine);
  const file = transcriptFile(machine);
  const refusals = [
    [[replied(30), typed('Entonces la A', -60)], `js-harness notify: not recorded: line 2 of ${file} was sent before question 1 was recorded`],
    [[replied(30), typed('<pasted_content id="p1">una lista larga</pasted_content id="p1">', 60)], `js-harness notify: not recorded: line 2 of ${file} holds only pasted text: not the user's words typed in the chat`],
  ];
  for (const [entries, message] of refusals) {
    writeTranscript(machine, TRANSCRIPT, entries);
    const { code, out, err } = await answerTo(machine);
    assert.deepEqual([code, out, err], [1, [], [message]]);
  }
  writeTranscript(machine, TRANSCRIPT, [replied(30), replied(60)]);
  const notHis = await answerTo(machine);
  assert.deepEqual([notHis.code, notHis.out, notHis.err.length], [1, [], 1]);
  assert.ok(notHis.err[0].startsWith(`js-harness notify: not recorded: line 2 of ${file} is `) && notHis.err[0].endsWith(': not the user\'s answer'), notHis.err[0]);
  assert.equal(recordText(machine), unchanged);
}));

test('an answer to a question-tool call is verified when the call was asked after its question, and answers it only by its prefix', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  assert.equal((await askQuestion(machine)).code, 0);
  const prefixed = 'Pregunta 1: Which branch do we merge first?';
  writeTranscript(machine, TRANSCRIPT, [asks(prefixed, 30), answering(prefixed, 'main', 60)]);
  const verified = await answerTo(machine);
  assert.deepEqual([verified.code, verified.err], [0, []]);
  assert.equal(verified.out[1], 'the user\'s answer, tapped: main');
  assert.deepEqual(recorded(machine).notices.at(-1).copy, { tool: 'AskUserQuestion', answers: [{ question: prefixed, options: ['main', 'feat'], answer: 'main', how: 'tapped' }] });

  // A second question, whose calls are refused: asked before it was recorded, or asking another question.
  assert.equal((await askQuestion(machine, { newId: () => SECOND_ID })).code, 0);
  const unchanged = recordText(machine);
  const second = 'Pregunta 2: Which branch do we merge first?';
  writeTranscript(machine, TRANSCRIPT, [asks(second, -60), answering(second, 'main', 30)]);
  const earlier = await answerTo(machine, { number: 2 });
  assert.deepEqual([earlier.code, earlier.out], [1, []]);
  assert.deepEqual(earlier.err, [`js-harness notify: not recorded: the call that line 2 answers was asked at ${later(-60)}, before question 2 was recorded at ${QUESTION_AT}: it answers another question`]);
  writeTranscript(machine, TRANSCRIPT, [asks('Which branch do we merge first?', 30), answering('Which branch do we merge first?', 'main', 60)]);
  const otherQuestion = await answerTo(machine, { number: 2 });
  assert.deepEqual([otherQuestion.code, otherQuestion.out], [1, []]);
  assert.deepEqual(otherQuestion.err, ['js-harness notify: not recorded: no question of that call starts with "Pregunta 2: ": it answers another question']);
  assert.equal(recordText(machine), unchanged);
}));

test('a withdrawal names its question and closes it, and an answer to a withdrawn question is refused with the reason', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  assert.equal((await askQuestion(machine)).code, 0);
  const withdrawal = ['--to', 'orchestrator', '--kind', 'withdrawn', '--question', '1', 'the orchestrator no longer needs it'];
  const done = await runNotify(machine, withdrawal);
  assert.deepEqual([done.code, done.err], [0, []]);
  assert.equal(done.out[0], `js-harness notify: recorded withdrawn question 1 for the orchestrator at ${localStamp(QUESTION_AT)} from "${SENDER_TITLE}" in ${machine.record}`);
  const notice = recorded(machine).notices.at(-1);
  assert.deepEqual(Object.keys(notice), ['schema', 'at', 'from', 'to', 'kind', 'text', 'cwd', 'worktree', 'branch', 'question']);
  assert.deepEqual([notice.kind, notice.question, notice.text], ['withdrawn', 1, 'the orchestrator no longer needs it']);

  const unchanged = recordText(machine);
  const none = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'withdrawn', '--question', '5', 'probe']);
  assert.deepEqual([none.code, none.err], [1, ['js-harness notify: not recorded: the record holds no question 5 (it holds 1 question)']]);
  const again = await runNotify(machine, withdrawal);
  assert.deepEqual([again.code, again.err], [1, ['js-harness notify: not recorded: question 1 is closed: withdrawn: the orchestrator no longer needs it']]);
  const answer = await answerTo(machine);
  assert.deepEqual([answer.code, answer.err], [1, ['js-harness notify: not recorded: question 1 is closed: withdrawn: the orchestrator no longer needs it']]);
  const unreadable = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'withdrawn', '--question', '1', 'probe'], { readFile: busyRecord(machine) });
  assert.deepEqual([unreadable.code, unreadable.err], [1, [`js-harness notify: not recorded: the channel's record ${machine.record} could not be read (EBUSY)`]]);
  assert.equal(recordText(machine), unchanged);
}));

test('an answer without --question is written as it was before: the same keys, and no question, verification or copy', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  const { code, out, err } = await runNotify(machine, ['--to', '5', '--kind', 'answer', '--transcript', '1d16beeb', '--line', '406', 'Entonces la A']);
  assert.deepEqual([code, err], [0, []]);
  assert.equal(out[0], `js-harness notify: recorded answer for work session 5 at ${localStamp(QUESTION_AT)} from "${SENDER_TITLE}" in ${machine.record}`);
  assert.deepEqual(out.filter((line) => line.startsWith('the user\'s answer') || line.startsWith('prefix')), []);
  const [line, ...rest] = fs.readFileSync(machine.record, 'utf8').split('\n');
  assert.deepEqual(rest, ['']);
  assert.deepEqual(Object.keys(JSON.parse(line)), ['schema', 'at', 'from', 'to', 'kind', 'text', 'cwd', 'worktree', 'branch', 'transcript', 'line']);
  assert.deepEqual(JSON.parse(line), {
    schema: 'js-harness.channel-notice/v1',
    at: QUESTION_AT,
    from: { host: 'claude-code', id: SENDER, source: 'environment', title: SENDER_TITLE, permissionMode: 'bypassPermissions', context: null },
    to: { role: 'work', number: 5 },
    kind: 'answer',
    text: 'Entonces la A',
    cwd: machine.worktree,
    worktree: machine.worktree,
    branch: 'feat/session-record',
    transcript: '1d16beeb',
    line: 406,
  });
}));

test('the usage says what a question takes, what --question names, and that a verified answer is one read at its line', async () => {
  const err = [];
  assert.equal(await notifyMain([], { stdout: () => {}, stderr: (line) => err.push(line) }), 2);
  const usage = err.join('\n');
  assert.match(usage, /--kind question/);
  assert.match(usage, /fields are one JSON object on standard input/);
  assert.match(usage, /\{"text":"Which branch\?","options":\[\{"label":"main","description":"the default branch"\}\],"waits":"T3"\}/);
  assert.match(usage, /--question <n>/);
  assert.match(usage, /verified answer\s+is one read at its line of the transcript/);
});

// T4 of odd/tasks/wake-and-flag.md (S4): the hour a notice's text stamps as its sending is held to the clock the notice
// is stamped with, as the guard holds a message's. 73 of the 74 lead notices that opened "HH:MM JH ORQ: ..." were more
// than a minute off the local clock (2026-10-15 to 10-17).
const hhmm = (ms) => `${String(new Date(ms).getHours()).padStart(2, '0')}:${String(new Date(ms).getMinutes()).padStart(2, '0')}`;

test('a notice whose text stamps an hour more than a minute off the clock is refused, with the right hour, and not recorded', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  const wrong = hhmm(NOW + 13 * 60 * 1000);
  const { code, out, err } = await runNotify(machine, ['--to', '5', '--kind', 'note', `${wrong} JH ORQ: PR 300 landed.`]);
  assert.equal(code, 1);
  assert.deepEqual(out, []);
  assert.match(err.join('\n'), new RegExp(`the text stamps ${wrong}, and the clock says ${hhmm(NOW)}`));
  assert.match(err.join('\n'), /or no hour/);
  assert.deepEqual(recorded(machine).notices, [], 'nothing is written');
}));

test('a stamp within a minute, an hour that is an event and a text with no hour are recorded as before', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  for (const text of [
    `${hhmm(NOW)} JH ORQ: PR 300 landed.`,
    `${hhmm(NOW - 60 * 1000)} HIS ORDER: go on.`,
    `JH 5 · canal entre sesiones: compacted at ${hhmm(NOW - 5 * 60 * 1000)}, resumes T2`,
    'Lead: PR 300 landed at 03:10.',
    'No hour here.',
  ]) {
    const { code } = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'note', text]);
    assert.equal(code, 0, text);
  }
  assert.equal(recorded(machine).notices.length, 5);
}));

test('an answer quotes his words, so an hour that opens them is not held to the clock', withMachine(async (machine) => {
  const words = `${hhmm(NOW + 13 * 60 * 1000)} JH 5 arranca`;
  const { code } = await runNotify(machine, ['--to', '5', '--kind', 'answer', '--transcript', '1d16beeb', '--line', '406', words]);
  assert.equal(code, 0);
  assert.equal(recorded(machine).notices[0].text, words);
}));

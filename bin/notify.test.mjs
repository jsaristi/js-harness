import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { notifyMain } from './notify.mjs';
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
function writeSession(machine, id, title, { seconds = 60, permissionMode = 'bypassPermissions' } = {}) {
  const at = before(seconds).toISOString();
  const entries = [
    { type: 'custom-title', customTitle: title, sessionId: id },
    { type: 'user', timestamp: at, cwd: machine.root, gitBranch: 'main', isSidechain: false, permissionMode, origin: { kind: 'human' }, message: { role: 'user', content: 'made up' } },
    { type: 'assistant', timestamp: at, cwd: machine.root, gitBranch: 'main', isSidechain: false, message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: 'made up' }] } },
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
      from: { host: 'claude-code', id: SENDER, source: 'environment', title: SENDER_TITLE, permissionMode: 'auto' },
      to: { role: 'orchestrator', number: null },
      kind: 'opened',
      text: 'session channel, T1',
      cwd: machine.worktree,
      worktree: machine.worktree,
      branch: 'feat/session-record',
    },
  ]);
  assert.deepEqual(out, [
    `js-harness notify: recorded opened for the orchestrator at 2026-01-01T12:00:00.000Z from "${SENDER_TITLE}" in ${machine.record}`,
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

// --- who sends ---

test('--self names the sender in place of the host\'s id, and is the one the address does not count', withMachine(async (machine) => {
  writeSession(machine, SENDER, SENDER_TITLE);
  writeSession(machine, ORCHESTRATOR, ORCHESTRATOR_TITLE);
  // The orchestrator writes to its own role: no other session holds it.
  const { code, out } = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'relieved', 'JH ORQ nueva has the role', '--self', 'bbbbbbbb']);
  assert.equal(code, 0);
  assert.deepEqual(recorded(machine).notices[0].from, { host: 'claude-code', id: ORCHESTRATOR, source: 'flag', title: ORCHESTRATOR_TITLE, permissionMode: 'bypassPermissions' });
  const address = await runAddress(machine, 'orchestrator', { self: 'bbbbbbbb' });
  assert.equal(address.code, 1);
  assert.equal(out[1], `address of the orchestrator: no single one now (sessions --address exit 1): ${address.err[0].replace('js-harness sessions: ', '')}`);
}));

test('a session the host does not name still records its notice, as a sender that is not known, and is told so', withMachine(async (machine) => {
  writeSession(machine, ORCHESTRATOR, ORCHESTRATOR_TITLE);
  const { code, out, err } = await runNotify(machine, ['--to', 'orchestrator', '--kind', 'closed', 'delivered; nothing more goes to this session'], { env: { CODEX_HOME: 'C:\\codex' } });
  assert.equal(code, 0);
  assert.deepEqual(recorded(machine).notices[0].from, { host: 'unknown', id: null, source: null, title: null, permissionMode: null });
  assert.match(out[0], /recorded closed for the orchestrator at \S+ from a sender the host does not name in /);
  assert.equal(out[1], `address of the orchestrator: ${ORCHESTRATOR_TITLE}`);
  assert.deepEqual(err, ['js-harness notify: the sender is not known: the host gave no session id (CLAUDE_CODE_SESSION_ID is not set) and --self names none']);
}));

test('a sender whose transcript gives no title is named by the start of its id', withMachine(async (machine) => {
  const { out } = await runNotify(machine, ['--to', '5', '--kind', 'note', 'probe']);
  assert.match(out[0], / from session aaaaaaaa in /);
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
  assert.deepEqual(first.out, [`js-harness notify: opening for "${SENDER_TITLE}" written in ${file} (2 lines, ${OPENING.length} characters)`]);
  assert.deepEqual(findOpenings(machine.home, machine.slug, 'JH 5').openings, [
    { path: file, title: SENDER_TITLE, at: '2026-01-01T12:00:00.000Z', from: { host: 'claude-code', id: SENDER, source: 'environment', title: ORCHESTRATOR_TITLE, permissionMode: 'bypassPermissions' }, text: OPENING },
  ]);

  const second = await runNotify(machine, ['--opening', SENDER_TITLE], { readStdin: () => 'One line.', now: () => NOW + 60000 });
  assert.equal(second.code, 0);
  assert.deepEqual(second.out, [`js-harness notify: opening for "${SENDER_TITLE}" replaced in ${file} (1 line, 9 characters)`]);
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

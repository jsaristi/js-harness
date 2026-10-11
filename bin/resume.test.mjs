import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resumeMain, transcriptTitle } from './resume.mjs';
import { appendNotice, appendReading, newNotice, newReading, openingFileName, openingsDir, writeOpening } from './lib/channel.mjs';
import { projectSlug, sessionFacts } from './lib/sessions.mjs';

// Every test below has a machine of its own under a temp folder: a project with one linked worktree
// (folders only; `git` is a fake that answers for them), a Claude home with the project's sessions folder
// and a harness home with the channel's record. Nothing reads this machine's sessions or its home, and
// the one test that starts a process hands it a home of its own and a time limit.

const SESSION = 'aaaaaaaa-1111-4111-8111-111111111111';
const TITLE = 'JH 5 · the channel';
const AT = '2026-01-01T10:00:00.000Z';
const NOW = Date.parse('2026-01-01T12:00:00.000Z');
const writtenAt = (file, minutes) => fs.utimesSync(file, new Date(NOW - minutes * 60000), new Date(NOW - minutes * 60000));
const FIRST = 'js-harness resume: this session was just compacted. What follows is read from files; the summary of the compaction is not the record.';
const READ = 'Read "Next step" in that document, and "State for a resume" if it has one, and trust them over the summary. Then repeat to the user any question that is still open.';

function makeMachine() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-resume-')));
  const root = path.join(dir, 'proj');
  const machine = { dir, root, worktree: path.join(dir, 'proj-worktrees', 'channel'), claudeHome: path.join(dir, 'claude-home'), home: path.join(dir, 'user-home'), slug: projectSlug(root) };
  machine.projectDir = path.join(machine.claudeHome, 'projects', machine.slug);
  for (const folder of [machine.projectDir, machine.home, path.join(root, 'odd', 'tasks'), path.join(machine.worktree, 'odd', 'tasks')]) fs.mkdirSync(folder, { recursive: true });
  for (const tree of [root, machine.worktree]) fs.writeFileSync(path.join(tree, 'harness.json'), '{"version":"0.1.0"}\n');
  fs.writeFileSync(path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md'), '# Session channel\n\n- [ ] T6 The resume hook\n\n## Next step\nT6.\n');
  writtenAt(path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md'), 12);
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

const isUnder = (folder, inner) => path.relative(folder, inner) === '' || (!path.relative(folder, inner).startsWith('..') && !path.isAbsolute(path.relative(folder, inner)));

/** A `git` that answers for the machine's two checkouts: `main` at its root, `feat/channel` at the
 * worktree, whose branch changed the feature documents in `plans`. `branches` gives another branch to a
 * checkout, `failing` the commands (their first word that is not a flag) that fail, and `more` adds
 * worktrees, `{ path, branch }`, to the ones git lists. */
function fakeGit(machine, { plans = ['odd/tasks/session-channel.md'], branches = {}, failing = [], more = [] } = {}) {
  const trees = [...more, { path: machine.worktree, branch: branches.worktree ?? 'feat/channel' }, { path: machine.root, branch: branches.root ?? 'main' }];
  const calls = [];
  const run = (command, args, { cwd } = {}) => {
    calls.push(`${command} ${args.join(' ')}`);
    const said = (stdout) => ({ status: 0, stdout, stderr: '' });
    const tree = trees.find((item) => isUnder(item.path, cwd));
    const what = args.filter((arg) => !arg.startsWith('-'))[0];
    if (command !== 'git' || !tree || failing.includes(what)) return { status: 128, stdout: '', stderr: 'fatal: made up' };
    if (what === 'rev-parse') return said(args.includes('--git-common-dir') ? `${path.join(machine.root, '.git')}\n` : `${tree.path}\n`);
    if (what === 'branch') return said(`${tree.branch}\n`);
    if (what === 'diff') return said(tree.path === machine.worktree ? plans.map((name) => `${name}\0`).join('') : '');
    if (what === 'ls-files') return said('');
    if (what === 'worktree') return said(trees.slice().reverse().map((item) => `worktree ${item.path}\nHEAD 1111111111111111111111111111111111111111\nbranch refs/heads/${item.branch}\n`).join('\n'));
    return { status: 1, stdout: '', stderr: `not faked: ${args.join(' ')}` };
  };
  return { run, calls };
}

const hookInput = (machine, more = {}) => JSON.stringify({ session_id: SESSION, transcript_path: path.join(machine.projectDir, `${SESSION}.jsonl`), cwd: machine.root, hook_event_name: 'SessionStart', source: 'compact', ...more });

/** Runs the hook on `machine` with `input` on its standard input: `{ code, lines, stderr, calls }`. */
async function runHook(machine, input, { git = fakeGit(machine), argv = ['--hook'], ...deps } = {}) {
  const out = [];
  const err = [];
  const code = await resumeMain(argv, {
    cwd: machine.dir,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    env: { CLAUDE_CONFIG_DIR: machine.claudeHome, JS_HARNESS_HOME: machine.home },
    homedir: () => machine.home,
    run: git.run,
    readStdin: () => input,
    stdinIsTTY: false,
    now: () => NOW,
    ...deps,
  });
  return { code, lines: out.join('\n').split('\n').filter((line, index, all) => !(all.length === 1 && line === '')), stderr: err.join('\n'), calls: git.calls };
}

const titled = (machine, title = TITLE) => fs.writeFileSync(path.join(machine.projectDir, `${SESSION}.jsonl`), `${JSON.stringify({ type: 'custom-title', customTitle: title, sessionId: SESSION })}\n`);
const from = { host: 'claude-code', id: SESSION, source: 'environment', title: TITLE, permissionMode: 'auto' };
const notified = (machine, more = {}) => appendNotice(machine.home, machine.slug, newNotice({ at: AT, from, to: 'orchestrator', kind: 'opened', text: 'the channel', cwd: machine.worktree, worktree: machine.worktree, branch: 'feat/channel', ...more }));
const opened = (machine, title = TITLE) => writeOpening(machine.home, machine.slug, { title, text: 'Build the channel.\n', at: AT, from });

/** Every file under `folder` with its size and the time of its last write: what a command that writes
 * nothing leaves as it was. */
function snapshot(folder) {
  const seen = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, name);
      const stat = fs.statSync(file);
      if (stat.isDirectory()) walk(file);
      else seen.push(`${file} ${stat.size} ${stat.mtimeMs}`);
    }
  };
  walk(folder);
  return seen;
}

test('after a compaction the hook prints the session\'s title, its opening, its feature document and what to read, and writes nothing', withMachine(async (machine) => {
  titled(machine);
  notified(machine);
  const opening = opened(machine).path;
  const before = snapshot(machine.dir);
  const { code, lines, stderr } = await runHook(machine, hookInput(machine, { session_title: TITLE }));
  assert.deepEqual([code, stderr], [0, '']);
  assert.deepEqual(lines, [
    FIRST,
    `Session: "${TITLE}" (the title the host gave the hook)`,
    `Opening: ${opening}  (print it: js-harness sessions --opening "${TITLE}")`,
    `Feature document: ${path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')}  (branch feat/channel, in the worktree this session's last notice was written from)`,
    READ,
  ]);
  assert.equal(opening, path.join(openingsDir(machine.home, machine.slug), openingFileName(TITLE)));
  assert.deepEqual(snapshot(machine.dir), before, 'a hook that reads: no file written, none touched');
}));

test('the title comes from the hook\'s input, then the transcript, then the opening the session read; with none it says so', withMachine(async (machine) => {
  notified(machine);
  const session = async (more) => (await runHook(machine, hookInput(machine, more))).lines[1];
  // A session opened from the phone: no title in its transcript, and the record says which opening it read.
  assert.equal(await session(), `Session: title not known (the host gave the hook none, its transcript ${SESSION.slice(0, 8)} gives none and the channel's record has no opening read by it)`);
  appendReading(machine.home, machine.slug, newReading({ at: AT, reader: { host: 'claude-code', id: SESSION, source: 'environment' }, title: 'JH 5 · read' }));
  assert.equal(await session(), 'Session: "JH 5 · read" (the title of the opening it read, by the channel\'s record)');
  titled(machine, 'JH 5 · in the transcript');
  assert.equal(await session(), 'Session: "JH 5 · in the transcript" (the title its transcript carries)');
  assert.equal(await session({ session_title: 'JH 5 · from the host' }), 'Session: "JH 5 · from the host" (the title the host gave the hook)');
  // A title that is not one is no title: blank, or not a string.
  assert.equal(await session({ session_title: '  ' }), 'Session: "JH 5 · in the transcript" (the title its transcript carries)');
  assert.equal(await session({ session_title: 7 }), 'Session: "JH 5 · in the transcript" (the title its transcript carries)');
}));

test('the title a transcript carries is the last one it was given, as the board reads it', () => {
  const text = [{ type: 'custom-title', customTitle: 'first', sessionId: SESSION }, { type: 'user', message: { role: 'user', content: 'it says "custom-title" and is none' } }, { type: 'custom-title', customTitle: 'JH 5 · last', sessionId: SESSION }].map((entry) => JSON.stringify(entry)).join('\n');
  assert.equal(transcriptTitle(`${text}\n{"type":"custom-title","customTi`), 'JH 5 · last');
  assert.equal(transcriptTitle(`${text}\n`), sessionFacts(`${text}\n`).title);
  assert.equal(transcriptTitle('{"type":"user"}\n'), null);
});

test('with no opening stored for the title, or no title, the hook says where the openings are', withMachine(async (machine) => {
  notified(machine);
  const dir = openingsDir(machine.home, machine.slug);
  assert.equal((await runHook(machine, hookInput(machine, { session_title: TITLE }))).lines[2], `Opening: none stored for that title (the openings of this project are in ${dir})`);
  assert.equal((await runHook(machine, hookInput(machine))).lines[2], `Opening: not known without a title (the openings of this project are in ${dir}; js-harness sessions --opening "<title>" prints one)`);
  // A title with a quote in it is given to the command as the shell takes it.
  const odd = 'JH 5 · the "channel"';
  const stored = opened(machine, odd).path;
  assert.equal((await runHook(machine, hookInput(machine, { session_title: odd }))).lines[2], `Opening: ${stored}  (print it: js-harness sessions --opening "JH 5 · the \\"channel\\"")`);
}));

test('the feature document is not known without a notice that names a worktree, and then the hook lists where they are', withMachine(async (machine) => {
  // The folders, the one a document was written in last first: a session writes its state there before it is compacted.
  const where = ['Feature documents are in these folders, the one written last first:', `  ${path.join(machine.worktree, 'odd', 'tasks')}  (branch feat/channel, last written 12m ago)`, `  ${path.join(machine.root, 'odd', 'tasks')}  (branch main, no document)`];
  const find = 'Find there the document of the feature this session was working on, read its "Next step", and "State for a resume" if it has one, and trust them over the summary. Then repeat to the user any question that is still open.';
  const tail = async (git) => (await runHook(machine, hookInput(machine, { session_title: TITLE }), { git })).lines.slice(3);
  assert.deepEqual(await tail(), ['Feature document: not known (no notice of this session in the channel\'s record names a worktree)', ...where, find]);
  // A notice of another session, and one written outside a worktree, say nothing of this one's.
  notified(machine, { from: { ...from, id: 'bbbbbbbb-2222-4222-8222-222222222222', title: 'JH 6 · other' } });
  notified(machine, { worktree: null, branch: null });
  assert.equal((await tail())[0], 'Feature document: not known (no notice of this session in the channel\'s record names a worktree)');
  // Its notice names the worktree: the documents its branch changed, one or several, or none.
  notified(machine);
  assert.equal((await tail())[0], `Feature document: ${path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')}  (branch feat/channel, in the worktree this session's last notice was written from)`);
  fs.writeFileSync(path.join(machine.worktree, 'odd', 'tasks', 'rule-hierarchy.md'), '# Rule hierarchy\n');
  assert.deepEqual(await tail(fakeGit(machine, { plans: ['odd/tasks/session-channel.md', 'odd/tasks/rule-hierarchy.md'] })), [
    'Feature documents: the branch feat/channel changed 2, in the worktree this session\'s last notice was written from; this session works on one of them',
    `  ${path.join(machine.worktree, 'odd', 'tasks', 'rule-hierarchy.md')}`,
    `  ${path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')}`,
    'Read "Next step" in the one this session was working on, and "State for a resume" if it has one, and trust them over the summary. Then repeat to the user any question that is still open.',
  ]);
  assert.equal((await tail(fakeGit(machine, { plans: [] })))[0], `Feature document: not known (the branch feat/channel of ${machine.worktree} changed no feature document)`);
  // The worktree has another branch checked out now: its documents are not this session's.
  assert.equal((await tail(fakeGit(machine, { branches: { worktree: 'feat/other' } })))[0], `Feature document: not known (${machine.worktree} is on feat/other now; this session's last notice was written there on feat/channel)`);
  // A notice of the session's title, from a transcript the app has since replaced, is its notice too.
  const restarted = await runHook(machine, hookInput(machine, { session_id: 'cccccccc-3333-4333-8333-333333333333', session_title: TITLE }));
  assert.equal(restarted.lines[3], `Feature document: ${path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')}  (branch feat/channel, in the worktree this session's last notice was written from)`);
  // And with neither its id nor its title in the record, the notices of the others are not its own.
  assert.equal((await runHook(machine, hookInput(machine, { session_id: 'cccccccc-3333-4333-8333-333333333333' }))).lines[3], 'Feature document: not known (no notice of this session in the channel\'s record names a worktree)');
}));

test('what git cannot say is not known, and the hook still prints the rest', withMachine(async (machine) => {
  notified(machine);
  const { code, lines, stderr } = await runHook(machine, hookInput(machine, { session_title: TITLE }), { git: fakeGit(machine, { failing: ['diff', 'worktree'] }) });
  assert.deepEqual([code, stderr], [0, '']);
  assert.deepEqual(lines.slice(3, 6), ['Feature document: not known (git diff: fatal: made up)', 'Feature documents are in these folders, the one written last first:', `  ${path.join(machine.root, 'odd', 'tasks')}  (no document)`]);
}));

test('with many worktrees the hook lists the six folders written last, and counts the rest', withMachine(async (machine) => {
  // Eight more worktrees, each with a document written an hour further back than the one before.
  const more = Array.from({ length: 8 }, (_, index) => ({ path: path.join(machine.dir, 'proj-worktrees', `w${index}`), branch: `feat/w${index}` }));
  for (const [index, tree] of more.entries()) {
    fs.mkdirSync(path.join(tree.path, 'odd', 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(tree.path, 'odd', 'tasks', 'plan.md'), '# Plan\n');
    fs.writeFileSync(path.join(tree.path, 'odd', 'tasks', 'notes.txt'), 'not a feature document');
    writtenAt(path.join(tree.path, 'odd', 'tasks', 'plan.md'), 60 * (index + 1));
  }
  writtenAt(path.join(more[7].path, 'odd', 'tasks', 'plan.md'), 60 * 72);
  const { lines } = await runHook(machine, hookInput(machine, { session_title: TITLE }), { git: fakeGit(machine, { more }) });
  assert.deepEqual(lines.slice(4, 12), [
    'Feature documents are in these folders, the one written last first:',
    `  ${path.join(machine.worktree, 'odd', 'tasks')}  (branch feat/channel, last written 12m ago)`,
    `  ${path.join(more[0].path, 'odd', 'tasks')}  (branch feat/w0, last written 1h ago)`,
    `  ${path.join(more[1].path, 'odd', 'tasks')}  (branch feat/w1, last written 2h ago)`,
    `  ${path.join(more[2].path, 'odd', 'tasks')}  (branch feat/w2, last written 3h ago)`,
    `  ${path.join(more[3].path, 'odd', 'tasks')}  (branch feat/w3, last written 4h ago)`,
    `  ${path.join(more[4].path, 'odd', 'tasks')}  (branch feat/w4, last written 5h ago)`,
    '  and 4 more worktrees (git worktree list names them), the last of them written 6h ago',
  ]);
  assert.equal(lines.length, 13, 'the line that says what to read comes after them');
}));

test('the hook prints nothing in a project that did not opt in, and looks at nothing of it', withMachine(async (machine) => {
  titled(machine);
  notified(machine);
  fs.rmSync(path.join(machine.root, 'harness.json'));
  const read = [];
  const readFile = (file) => {
    read.push(file);
    return fs.readFileSync(file, 'utf8');
  };
  const { code, lines, stderr, calls } = await runHook(machine, hookInput(machine, { session_title: TITLE }), { readFile });
  assert.deepEqual([code, lines, stderr], [0, [], '']);
  assert.deepEqual([calls, read], [['git rev-parse --show-toplevel'], []], 'one question to git, to find the project, and no file read');
  // The worktree of an opted-in project has the file at its own root: a session opened there is in.
  assert.equal((await runHook(machine, hookInput(machine, { cwd: path.join(machine.worktree, 'odd'), session_title: TITLE }))).lines[0], FIRST);
  // Outside any repository the folder itself is the project.
  const bare = path.join(machine.dir, 'elsewhere');
  fs.mkdirSync(bare);
  assert.deepEqual((await runHook(machine, hookInput(machine, { cwd: bare }))).lines, []);
}));

test('the hook speaks only after a compaction: any other start of a session, and anything that is not its input, prints nothing', withMachine(async (machine) => {
  titled(machine);
  for (const source of ['startup', 'resume', 'clear', 'fork', undefined, 7]) {
    assert.deepEqual((await runHook(machine, hookInput(machine, { source }))).lines, [], String(source));
  }
  for (const input of ['', 'not json', '[]', 'null', '"compact"', '{"source":"compact"', `\uFEFF${hookInput(machine, { source: 'startup' })}`]) {
    const { code, lines, stderr } = await runHook(machine, input);
    assert.deepEqual([code, lines, stderr], [0, [], ''], input);
  }
  // A byte order mark before the input (a pipe of Windows PowerShell adds one) is not part of it.
  assert.equal((await runHook(machine, `\uFEFF${hookInput(machine)}`)).lines[0], FIRST);
  // A terminal is no hook input: nothing is read from it, so the command never waits for a key.
  const neverRead = () => {
    throw new Error('standard input must not be read from a terminal');
  };
  assert.deepEqual((await runHook(machine, '', { stdinIsTTY: true, readStdin: neverRead })).lines, []);
}));

test('the hook never fails a session: whatever throws, it prints nothing and exits 0', withMachine(async (machine) => {
  titled(machine);
  notified(machine);
  const boom = () => {
    throw new Error('made up');
  };
  for (const deps of [{ readStdin: boom }, { run: boom }, { readFile: boom }, { readdir: boom }, { homedir: boom, env: {} }]) {
    const { code, stderr } = await runHook(machine, hookInput(machine, { session_title: TITLE }), deps);
    assert.deepEqual([code, stderr], [0, ''], Object.keys(deps).join());
  }
  // What it could not finish it does not half print.
  const half = await runHook(machine, hookInput(machine, { session_title: TITLE }), { run: (command, args, options) => (args.includes('worktree') || args.includes('diff') ? boom() : fakeGit(machine).run(command, args, options)) });
  assert.deepEqual([half.code, half.lines], [0, []]);
  // A session id that could name a file outside the sessions folder names no transcript.
  const read = [];
  const readFile = (file) => {
    read.push(file);
    return fs.readFileSync(file, 'utf8');
  };
  const odd = await runHook(machine, hookInput(machine, { session_id: '..\\..\\secrets' }), { readFile });
  assert.equal(odd.lines[1], 'Session: title not known (the host gave the hook none and no session id a transcript could be found by)');
  assert.deepEqual(read.filter((file) => file.includes('secrets')), []);
  // Extra arguments do not turn the hook into something that can fail.
  assert.deepEqual((await runHook(machine, hookInput(machine), { argv: ['--hook', '--bogus'] })).code, 0);
}));

test('resume without --hook is a usage error: exit 2, with the usage on stderr and nothing read', async () => {
  for (const argv of [[], ['--bogus'], ['hook']]) {
    const err = [];
    const neverRun = () => {
      throw new Error('a usage error must not run or read anything');
    };
    const code = await resumeMain(argv, { stdout: neverRun, stderr: (line) => err.push(line), run: neverRun, readStdin: neverRun, stdinIsTTY: false });
    assert.equal(code, 2, argv.join(' '));
    assert.match(err.join('\n'), /^Usage: js-harness resume --hook/m);
  }
});

// Through the dispatcher, as a host runs it: a process, the hook's input on its standard input, a home
// of its own, and a time limit. The project is a real repository so `git` is the machine's.
test('js-harness resume --hook, run as a process: it reads standard input, prints for an opted-in project and nothing for another', withMachine(async (machine) => {
  const dispatcher = path.join(path.dirname(fileURLToPath(import.meta.url)), 'js-harness.mjs');
  // No variable of a `git` that runs these tests (a commit hook exports GIT_DIR) reaches the one of the test.
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key) && !/^CLAUDE_/i.test(key)));
  const env = { ...inherited, JS_HARNESS_HOME: machine.home, CLAUDE_CONFIG_DIR: machine.claudeHome };
  const git = spawnSync('git', ['init', '--quiet', machine.root], { encoding: 'utf8', env, timeout: 30000 });
  assert.equal(git.status, 0, git.stderr);
  const hook = (input, cwd = machine.root) => spawnSync(process.execPath, [dispatcher, 'resume', '--hook'], { cwd, input, encoding: 'utf8', env, timeout: 60000 });
  const run = hook(hookInput(machine, { session_title: TITLE }));
  assert.deepEqual([run.status, run.stderr], [0, '']);
  const lines = run.stdout.split(/\r?\n/);
  assert.deepEqual(lines.slice(0, 2), [FIRST, `Session: "${TITLE}" (the title the host gave the hook)`]);
  assert.match(lines[3], /^Feature document: not known \(/);
  // The folder the host names decides, not the one the process starts in.
  fs.rmSync(path.join(machine.root, 'harness.json'));
  const silent = hook(hookInput(machine, { session_title: TITLE }), machine.worktree);
  assert.deepEqual([silent.status, silent.stdout, silent.stderr], [0, '', '']);
  const help = spawnSync(process.execPath, [dispatcher, '--help'], { encoding: 'utf8', env, timeout: 60000 });
  assert.match(help.stdout, /^ {2}resume\s+.*after a compaction.*--hook/m);
}));

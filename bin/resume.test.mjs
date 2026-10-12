import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resumeMain, transcriptTitle } from './resume.mjs';
import { OPENING_SCHEMA, appendNotice, appendReading, newNotice, newReading, openingFileName, openingsDir, writeOpening } from './lib/channel.mjs';
import { statePath } from './lib/pause.mjs';
import { DEFAULT_CONTEXT_COMPACTION_PERCENT, DEFAULT_CONTEXT_PAUSE_PERCENT, DEFAULT_CONTEXT_WINDOW, percentOf, projectSlug, sessionFacts, shareOf } from './lib/sessions.mjs';

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
    `Opening: ${opening}  (print it: js-harness sessions --opening '${TITLE}')`,
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

test('a title is looked up as it was given, with the blanks it holds; only what is printed is made one line', withMachine(async (machine) => {
  // Two blanks in a row are part of a title: the opening is stored under them, and a notice carries them.
  const wide = 'JH 5 · the  channel';
  const stored = opened(machine, wide).path;
  // The notice is of a transcript the app has since replaced, so only its title says whose it is.
  notified(machine, { from: { ...from, id: 'bbbbbbbb-2222-4222-8222-222222222222', title: wide } });
  const said = (how) => [
    FIRST,
    `Session: "JH 5 · the channel" (${how})`,
    `Opening: ${stored}  (print it: js-harness sessions --opening 'JH 5 · the  channel')`,
    `Feature document: ${path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')}  (branch feat/channel, in the worktree this session's last notice was written from)`,
    READ,
  ];
  assert.deepEqual((await runHook(machine, hookInput(machine, { session_title: wide }))).lines, said('the title the host gave the hook'));
  titled(machine, wide);
  assert.deepEqual((await runHook(machine, hookInput(machine))).lines, said('the title its transcript carries'));
  // A line break in a title is printed as a blank, so the title stays on its line; no opening has that title.
  const broken = (await runHook(machine, hookInput(machine, { session_title: 'JH 5 · the\nchannel' }))).lines;
  assert.deepEqual(broken.slice(1, 3), ['Session: "JH 5 · the channel" (the title the host gave the hook)', `Opening: none stored for that title (the openings of this project are in ${openingsDir(machine.home, machine.slug)})`]);
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
}));

test('the command that prints the opening is written only for a title every shell reads alike, in single quotes; for another the hook says how to ask', withMachine(async (machine) => {
  const line = async (title) => {
    const stored = opened(machine, title).path;
    const said = (await runHook(machine, hookInput(machine, { session_title: title }))).lines[2];
    assert.ok(said.startsWith(`Opening: ${stored}  (`), said);
    return said.slice(`Opening: ${stored}  `.length);
  };
  // Inside single quotes PowerShell and a POSIX shell both leave every character as it is, a `$` too.
  assert.equal(await line(TITLE), `(print it: js-harness sessions --opening '${TITLE}')`);
  assert.equal(await line('JH 5 · costs $HOME, (a): b/c #1 + d_e-f.'), '(print it: js-harness sessions --opening \'JH 5 · costs $HOME, (a): b/c #1 + d_e-f.\')');
  // The blanks around a title are not part of it, for the command as for the opening.
  assert.equal(await line(`  ${TITLE} `), `(print it: js-harness sessions --opening '${TITLE}')`);
  // A quote of either kind has no spelling the two shells share, and neither has what a batch file reads
  // (`%`, `&`) or a title a flag could be taken for: no command is written, and the words say how to ask.
  const words = '(no command is written for it: its title holds marks that shells read each its own way. To print it, give js-harness sessions --opening that title, as the file holds it, as one argument, after a lone -- when it begins with --)';
  for (const title of ['JH 5 · the "channel"', 'JH 5 · it\'s the channel', 'JH 5 · the `channel`', 'JH 5 · 100%PATH%', 'JH 5 · a&b', 'JH 5 · a\\', 'JH 5 · the ’channel’', '--JH 5 · the channel']) {
    assert.equal(await line(title), words, title);
  }
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
  // A folder among the rest that could not be listed is counted as not looked at: "none with a document"
  // and "the last of them" are said of the ones that were.
  const refusing = (refused) => (asked) => {
    if (refused(asked)) throw Object.assign(new Error('made up'), { code: 'EACCES' });
    return fs.readdirSync(asked);
  };
  const rest = async (refused) => (await runHook(machine, hookInput(machine, { session_title: TITLE }), { git: fakeGit(machine, { more }), readdir: refusing(refused) })).lines[11];
  assert.equal(await rest((asked) => asked === path.join(more[6].path, 'odd', 'tasks')), '  and 4 more worktrees (git worktree list names them), the last of them written 6h ago, 1 of them not looked at');
  assert.equal(await rest((asked) => asked.endsWith(path.join('odd', 'tasks'))), '  and 4 more worktrees (git worktree list names them), 4 of them not looked at');
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
  // Without its input, git or a home the hook cannot tell the project or where its record is: it says
  // nothing. A disk that cannot be read leaves it something to say, which is the test after this one.
  for (const deps of [{ readStdin: boom }, { run: boom }, { homedir: boom, env: {} }]) {
    const { code, lines, stderr } = await runHook(machine, hookInput(machine, { session_title: TITLE }), deps);
    assert.deepEqual([code, lines, stderr], [0, [], ''], Object.keys(deps).join());
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

test('when the disk cannot be read the hook prints what it still knows, and says what it could not look at', withMachine(async (machine) => {
  titled(machine);
  notified(machine);
  const boom = () => {
    throw new Error('made up');
  };
  const dir = openingsDir(machine.home, machine.slug);
  const document = `Feature document: ${path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')}  (branch feat/channel, in the worktree this session's last notice was written from)`;
  const printed = async (more, deps) => {
    const { code, lines, stderr } = await runHook(machine, hookInput(machine, more), deps);
    assert.deepEqual([code, stderr], [0, '']);
    return lines;
  };

  // No file can be read: the record is one of them, so the feature document is not known, and the folders
  // are still listed, by what the folders themselves say.
  const unread = [
    'Feature document: not known (the channel\'s record could not be read (made up))',
    'Feature documents are in these folders, the one written last first:',
    `  ${path.join(machine.worktree, 'odd', 'tasks')}  (branch feat/channel, last written 12m ago)`,
    `  ${path.join(machine.root, 'odd', 'tasks')}  (branch main, no document)`,
    'Find there the document of the feature this session was working on, read its "Next step", and "State for a resume" if it has one, and trust them over the summary. Then repeat to the user any question that is still open.',
  ];
  assert.deepEqual(await printed({ session_title: TITLE }, { readFile: boom }), [FIRST, `Session: "${TITLE}" (the title the host gave the hook)`, `Opening: none stored for that title (the openings of this project are in ${dir})`, ...unread]);
  // With no title from the host either, the transcript and the record are all that could give one, and
  // neither can be read: the hook says that of the record, and does not go silent.
  assert.deepEqual(await printed({}, { readFile: boom }), [
    FIRST,
    `Session: title not known (the host gave the hook none, its transcript ${SESSION.slice(0, 8)} gives none and the channel's record could not be read (made up))`,
    `Opening: not known without a title (the openings of this project are in ${dir}; js-harness sessions --opening "<title>" prints one)`,
    ...unread,
  ]);

  // No folder can be listed: an opening is stored, and the hook says it could not look, not that there is none.
  opened(machine);
  const unlisted = `Opening: could not look in ${dir} (made up)`;
  assert.deepEqual(await printed({ session_title: TITLE }, { readdir: boom }), [FIRST, `Session: "${TITLE}" (the title the host gave the hook)`, unlisted, document, READ]);
  assert.deepEqual(await printed({}, { readdir: boom }), [FIRST, `Session: "${TITLE}" (the title its transcript carries)`, unlisted, document, READ]);
  // No file can be read, and now the folder holds one: it may be the opening asked for, so "none stored" is not said.
  assert.deepEqual(await printed({ session_title: TITLE }, { readFile: boom }), [FIRST, `Session: "${TITLE}" (the title the host gave the hook)`, `Opening: not known whether one is stored for that title (1 file of ${dir} could not be read as an opening)`, ...unread]);
}));

test('an opening file that cannot be read is said as not read: "none stored" is said only of a folder read whole', withMachine(async (machine) => {
  notified(machine);
  const dir = openingsDir(machine.home, machine.slug);
  const stored = opened(machine).path;
  const opening = async (deps) => {
    const { code, lines, stderr } = await runHook(machine, hookInput(machine, { session_title: TITLE }), deps);
    assert.deepEqual([code, stderr], [0, '']);
    return lines[2];
  };
  // The one file of the folder cannot be read, and it is the opening asked for: `sessions --opening` says
  // "not known" of it, and so does the hook.
  const denied = (file) => {
    if (file === stored) throw Object.assign(new Error('made up'), { code: 'EACCES' });
    return fs.readFileSync(file, 'utf8');
  };
  assert.equal(await opening({ readFile: denied }), `Opening: not known whether one is stored for that title (1 file of ${dir} could not be read as an opening)`);
  // A torn file beside the opening that is found may be a second one of that title: it is said as not counted.
  fs.writeFileSync(path.join(dir, 'torn.json'), '{"schema":');
  assert.equal(await opening(), `Opening: ${stored}  (print it: js-harness sessions --opening '${TITLE}'; 1 file of ${dir} could not be read as an opening and is not counted)`);
  fs.writeFileSync(path.join(dir, 'other-schema.json'), '{"schema":"made-up/v9","title":"JH 5 · the channel","text":"x"}');
  assert.equal(await opening(), `Opening: ${stored}  (print it: js-harness sessions --opening '${TITLE}'; 2 files of ${dir} could not be read as an opening and are not counted)`);
  assert.equal(await opening({ readFile: denied }), `Opening: not known whether one is stored for that title (3 files of ${dir} could not be read as an opening)`);
  // A file that is not `.json` is no opening and is not counted as one that could not be read.
  fs.rmSync(stored);
  fs.rmSync(path.join(dir, 'torn.json'));
  fs.rmSync(path.join(dir, 'other-schema.json'));
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'not an opening');
  assert.equal(await opening(), `Opening: none stored for that title (the openings of this project are in ${dir})`);
}));

test('a folder of feature documents that could not be listed is said as not looked at, not as one with no document', withMachine(async (machine) => {
  // No notice of the session: the feature document is not known, and the folders are what the hook lists.
  const more = [{ path: path.join(machine.dir, 'proj-worktrees', 'closed'), branch: 'feat/closed' }];
  fs.mkdirSync(path.join(more[0].path, 'odd', 'tasks'), { recursive: true });
  const folder = { worktree: path.join(machine.worktree, 'odd', 'tasks'), root: path.join(machine.root, 'odd', 'tasks'), closed: path.join(more[0].path, 'odd', 'tasks') };
  const folders = async (deps) => {
    const { code, lines, stderr } = await runHook(machine, hookInput(machine, { session_title: TITLE }), { git: fakeGit(machine, { more }), ...deps });
    assert.deepEqual([code, stderr], [0, '']);
    return lines.slice(4, -1);
  };
  const head = 'Feature documents are in these folders, the one written last first:';
  const refusing = (refused, code) => (asked) => {
    if (refused.includes(asked)) throw Object.assign(new Error('made up'), code ? { code } : {});
    return fs.readdirSync(asked);
  };
  // A folder that could not be listed may hold the document: it comes before the ones known to hold none.
  assert.deepEqual(await folders({ readdir: refusing([folder.closed], 'EACCES') }), [
    head,
    `  ${folder.worktree}  (branch feat/channel, last written 12m ago)`,
    `  ${folder.closed}  (branch feat/closed, could not be listed (EACCES))`,
    `  ${folder.root}  (branch main, no document)`,
  ]);
  // None could be listed: none is said to hold no document, and they stay in the order git gave.
  assert.deepEqual(await folders({ readdir: refusing([folder.worktree, folder.root, folder.closed]) }), [
    head,
    `  ${folder.root}  (branch main, could not be listed (made up))`,
    `  ${folder.worktree}  (branch feat/channel, could not be listed (made up))`,
    `  ${folder.closed}  (branch feat/closed, could not be listed (made up))`,
  ]);
  // A document whose time cannot be read: the folder was listed, and what it says of the document was not seen.
  const stat = (file) => {
    if (file.endsWith('session-channel.md')) throw Object.assign(new Error('made up'), { code: 'EPERM' });
    return fs.statSync(file);
  };
  assert.equal((await folders({ stat }))[1], `  ${folder.worktree}  (branch feat/channel, the time of a document in it could not be read (EPERM))`);
  // A worktree with no `odd/tasks` was looked at: it holds no document.
  fs.rmSync(folder.closed, { recursive: true });
  assert.deepEqual(await folders(), [head, `  ${folder.worktree}  (branch feat/channel, last written 12m ago)`, `  ${folder.root}  (branch main, no document)`, `  ${folder.closed}  (branch feat/closed, no document)`]);
}));

test('a title that names several openings gets their titles and no command: sessions --opening refuses such a title', withMachine(async (machine) => {
  notified(machine);
  const dir = openingsDir(machine.home, machine.slug);
  // The purpose was reworded between two openings of the session `JH 5`; `JH 6` is another session.
  const first = opened(machine).path;
  const second = writeOpening(machine.home, machine.slug, { title: 'JH 5 · the channel, reworded', text: 'Build it.\n', at: '2026-01-01T11:00:00.000Z', from }).path;
  writeOpening(machine.home, machine.slug, { title: 'JH 6 · other', text: 'Another.\n', at: AT, from });
  const document = `Feature document: ${path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')}  (branch feat/channel, in the worktree this session's last notice was written from)`;
  const several = (count, more = '') => `Opening: ${count} openings are named by that title, the latest first: ask for one by its whole title (js-harness sessions --opening "<whole title>" prints it${more})`;
  const { code, lines, stderr } = await runHook(machine, hookInput(machine, { session_title: 'JH 5' }));
  assert.deepEqual([code, stderr], [0, '']);
  assert.deepEqual(lines, [FIRST, 'Session: "JH 5" (the title the host gave the hook)', several(2), `  "JH 5 · the channel, reworded"  (${second})`, `  "JH 5 · the channel"  (${first})`, document, READ]);
  // The command for `JH 5` would exit 2, so none is written.
  assert.deepEqual(lines.filter((line) => line.includes('print it:') || line.includes('--opening \'')), []);
  // A file that could not be read may be a third: it is said as not counted, as for one opening.
  fs.writeFileSync(path.join(dir, 'torn.json'), '{"schema":');
  assert.equal((await runHook(machine, hookInput(machine, { session_title: 'JH 5' }))).lines[2], several(2, `; 1 file of ${dir} could not be read as an opening and is not counted`));
  fs.rmSync(path.join(dir, 'torn.json'));
  // A whole title names one opening, and nothing changes for it.
  assert.deepEqual((await runHook(machine, hookInput(machine, { session_title: TITLE }))).lines, [FIRST, `Session: "${TITLE}" (the title the host gave the hook)`, `Opening: ${first}  (print it: js-harness sessions --opening '${TITLE}')`, document, READ]);
  // And the code and the role that name one opening are a title a command is written for.
  assert.equal((await runHook(machine, hookInput(machine, { session_title: 'JH 6' }))).lines[2], `Opening: ${path.join(dir, openingFileName('JH 6 · other'))}  (print it: js-harness sessions --opening 'JH 6')`);
}));

test('the titles of several openings are listed as the files hold them: a second blank in one of them is kept', withMachine(async (machine) => {
  notified(machine);
  // The two titles differ only by a second blank: each is an opening of its own, and the list must tell them apart.
  const single = opened(machine).path;
  const double = writeOpening(machine.home, machine.slug, { title: 'JH 5 · the  channel', text: 'Build it.\n', at: '2026-01-01T11:00:00.000Z', from }).path;
  const document = `Feature document: ${path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')}  (branch feat/channel, in the worktree this session's last notice was written from)`;
  const several = `Opening: 2 openings are named by that title, the latest first: ask for one by its whole title (js-harness sessions --opening "<whole title>" prints it)`;
  const { code, lines, stderr } = await runHook(machine, hookInput(machine, { session_title: 'JH 5' }));
  assert.deepEqual([code, stderr], [0, '']);
  assert.deepEqual(lines, [FIRST, 'Session: "JH 5" (the title the host gave the hook)', several, `  "JH 5 · the  channel"  (${double})`, `  "JH 5 · the channel"  (${single})`, document, READ]);
}));

test('a title the list prints stays on its line: a quote, a line break and a line separator are escaped as the file holds them', withMachine(async (machine) => {
  notified(machine);
  const dir = openingsDir(machine.home, machine.slug);
  const quoted = writeOpening(machine.home, machine.slug, { title: 'JH 5 · the "odd" channel', text: 'Build it.\n', at: '2026-01-01T11:00:00.000Z', from }).path;
  const single = opened(machine).path;
  const document = `Feature document: ${path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')}  (branch feat/channel, in the worktree this session's last notice was written from)`;
  const several = `Opening: 2 openings are named by that title, the latest first: ask for one by its whole title (js-harness sessions --opening "<whole title>" prints it)`;
  const { lines } = await runHook(machine, hookInput(machine, { session_title: 'JH 5' }));
  assert.deepEqual(lines, [FIRST, 'Session: "JH 5" (the title the host gave the hook)', several, `  "JH 5 · the \\"odd\\" channel"  (${quoted})`, `  "JH 5 · the channel"  (${single})`, document, READ]);
  // A hand-written file may hold what writeOpening refuses: a line break and a line separator. Two files with that title are found by the whole title and listed on one line each.
  const torn = 'JH 5 · the\nchannel\u2028end';
  const handWritten = (name, at) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, `${JSON.stringify({ schema: OPENING_SCHEMA, title: torn, at, from, text: 'Written by hand.\n' })}\n`, 'utf8');
    return file;
  };
  const newer = handWritten('hand-newer.json', '2026-01-01T12:00:00.000Z');
  const older = handWritten('hand-older.json', '2026-01-01T11:30:00.000Z');
  const listed = await runHook(machine, hookInput(machine, { session_title: torn }));
  assert.deepEqual(listed.lines, [FIRST, 'Session: "JH 5 · the channel end" (the title the host gave the hook)', several, `  "JH 5 · the\\nchannel\\u2028end"  (${newer})`, `  "JH 5 · the\\nchannel\\u2028end"  (${older})`, document, READ]);
}));

test('a notice written on no branch, and a worktree git names no branch for, tell no feature document', withMachine(async (machine) => {
  notified(machine);
  const reason = async (git) => (await runHook(machine, hookInput(machine, { session_title: TITLE }), { git })).lines[3];
  assert.equal(await reason(fakeGit(machine, { failing: ['branch'] })), `Feature document: not known (git does not say which branch ${machine.worktree} is on now)`);
  // The last notice decides: one written on a detached HEAD names a worktree and no branch.
  notified(machine, { branch: null });
  assert.equal(await reason(), `Feature document: not known (this session's last notice was written in ${machine.worktree} on no branch)`);
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

// The context pause, through `--pause`: the command a `PostToolUse` hook runs after each tool call. The transcripts
// are made up, their figures come from the constants of `./lib/sessions.mjs`, and the state goes to the machine's
// harness home, so nothing reaches the real one. The pause point of the default compaction is the share of the
// window the host compacts at, scaled to the pause's share: a reply of exactly that many tokens is past it.
const PAUSED = shareOf(DEFAULT_CONTEXT_WINDOW, DEFAULT_CONTEXT_PAUSE_PERCENT);
const UNDER = PAUSED - 1;
const SECOND = 'bbbbbbbb-2222-4222-8222-222222222222';
const THIRD = 'cccccccc-3333-4333-8333-333333333333';
const FOURTH = 'dddddddd-4444-4444-8444-444444444444';
const FIFTH = 'eeeeeeee-5555-4555-8555-555555555555';
const SIXTH = 'ffffffff-6666-4666-8666-666666666666';

/** The hook input of a `PostToolUse` call in `machine` by session `id`, whose transcript ends in a reply of `tokens`. */
function pauseInput(machine, tokens, { id = SESSION, ...more } = {}) {
  const transcript = path.join(machine.projectDir, `${id}.jsonl`);
  fs.writeFileSync(transcript, `${JSON.stringify({ type: 'assistant', message: { model: 'made-up-model', role: 'assistant', usage: { input_tokens: tokens } } })}\n`);
  return JSON.stringify({ session_id: id, transcript_path: transcript, cwd: machine.root, hook_event_name: 'PostToolUse', ...more });
}

/** Runs the pause command on `machine` with `input` on its standard input: `{ code, lines, stderr, calls }`. */
async function runPause(machine, input, { git = fakeGit(machine), ...deps } = {}) {
  const out = [];
  const err = [];
  const code = await resumeMain(['--pause'], {
    cwd: machine.dir,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    env: { JS_HARNESS_HOME: machine.home },
    homedir: () => machine.home,
    run: git.run,
    readStdin: () => input,
    stdinIsTTY: false,
    ...deps,
  });
  return { code, lines: out, stderr: err.join('\n'), calls: git.calls };
}

test('past the pause the command prints one JSON line with the notice, and nothing again while the stretch lasts', withMachine(async (machine) => {
  const input = pauseInput(machine, PAUSED);
  const first = await runPause(machine, input);
  assert.deepEqual([first.code, first.stderr, first.lines.length], [0, '', 1]);
  const said = JSON.parse(first.lines[0]);
  assert.deepEqual(Object.keys(said), ['hookSpecificOutput']);
  assert.equal(said.hookSpecificOutput.hookEventName, 'PostToolUse');
  assert.match(said.hookSpecificOutput.additionalContext, new RegExp(`^js-harness: this session holds ${percentOf(PAUSED, DEFAULT_CONTEXT_WINDOW)}% of its context window, and the host compacts it at about ${DEFAULT_CONTEXT_COMPACTION_PERCENT}%: `));
  assert.ok(fs.existsSync(statePath(machine.home, SESSION)), 'the state remembers that the session was told');
  assert.deepEqual(await runPause(machine, input), { code: 0, lines: [], stderr: '', calls: [] }, 'the second call of the stretch says nothing');
  assert.deepEqual(first.calls, [], 'no git is asked: the project is found by its harness.json alone');
}));

test('under the pause the command prints nothing, exits 0 and writes no state', withMachine(async (machine) => {
  const { code, lines, stderr, calls } = await runPause(machine, pauseInput(machine, UNDER));
  assert.deepEqual([code, lines, stderr, calls], [0, [], '', []]);
  assert.equal(fs.existsSync(path.join(machine.home, '.js-harness', 'channel', 'pause')), false, 'no file under the channel\'s pause folder');
  assert.equal(fs.existsSync(path.join(machine.home, 'tmp')), false, 'and none in the temp folder of the home');
}));

test('a sub-agent\'s call prints nothing and leaves the notice to the session\'s own call', withMachine(async (machine) => {
  assert.deepEqual((await runPause(machine, pauseInput(machine, PAUSED, { agent_id: 'made-up-agent' }))).lines, []);
  assert.equal(fs.existsSync(path.join(machine.home, '.js-harness', 'channel', 'pause')), false, 'a sub-agent writes no state either');
  // An empty agent id is no sub-agent's: the call is the session's own.
  assert.equal((await runPause(machine, pauseInput(machine, PAUSED, { agent_id: '' }))).lines.length, 1);
}));

test('a call with no harness.json above it prints nothing; a call under a checkout walks up to its harness.json, and git is never asked', withMachine(async (machine) => {
  const outside = path.join(machine.dir, 'elsewhere');
  fs.mkdirSync(outside);
  assert.deepEqual(await runPause(machine, pauseInput(machine, PAUSED, { cwd: outside })), { code: 0, lines: [], stderr: '', calls: [] });
  assert.equal(fs.existsSync(path.join(machine.home, '.js-harness')), false);
  const inside = await runPause(machine, pauseInput(machine, PAUSED, { id: SECOND, cwd: path.join(machine.worktree, 'odd', 'tasks') }));
  assert.deepEqual([inside.code, inside.lines.length, inside.calls], [0, 1, []]);
}));

test('input that is not an object, or names no transcript or session the command can use, prints nothing, exits 0 and writes nothing', withMachine(async (machine) => {
  const past = JSON.parse(pauseInput(machine, PAUSED));
  const inputs = [
    '',
    'not json',
    '"PostToolUse"',
    '[]',
    'null',
    '{"session_id":"',
    JSON.stringify({ ...past, transcript_path: '' }),
    JSON.stringify({ ...past, transcript_path: 7 }),
    JSON.stringify({ ...past, transcript_path: path.join(machine.projectDir, 'missing.jsonl') }),
    JSON.stringify({ ...past, session_id: '../../escape' }),
    JSON.stringify({ ...past, session_id: 'short' }),
    JSON.stringify({ ...past, session_id: undefined }),
  ];
  for (const input of inputs) {
    const { code, lines, stderr } = await runPause(machine, input);
    assert.deepEqual([code, lines, stderr], [0, [], ''], input);
  }
  assert.equal(fs.existsSync(path.join(machine.home, '.js-harness')), false);
  // A terminal is no hook input: nothing is read from it, so the command never waits for a key.
  let read = false;
  const terminal = await runPause(machine, pauseInput(machine, PAUSED), { stdinIsTTY: true, readStdin: () => {
    read = true;
    return pauseInput(machine, PAUSED);
  } });
  assert.deepEqual([terminal.code, terminal.lines, read], [0, [], false]);
}));

test('the notice names the event of its input, and a byte order mark before the input is not part of it', withMachine(async (machine) => {
  const eventOf = async (id, more) => {
    const { code, lines, stderr } = await runPause(machine, pauseInput(machine, PAUSED, { id, ...more }));
    assert.deepEqual([code, stderr, lines.length], [0, '', 1]);
    return JSON.parse(lines[0]).hookSpecificOutput.hookEventName;
  };
  assert.equal(await eventOf(SECOND, { hook_event_name: 'Stop' }), 'Stop');
  // A blank or missing event name is the tool call's own: the `PostToolUse` entry that runs this command.
  assert.equal(await eventOf(THIRD, { hook_event_name: '' }), 'PostToolUse');
  assert.equal(await eventOf(FOURTH, { hook_event_name: undefined }), 'PostToolUse');
  // A pipe of Windows PowerShell puts a byte order mark before what it sends.
  const { lines } = await runPause(machine, `﻿${pauseInput(machine, PAUSED, { id: FIFTH })}`);
  assert.equal(lines.length, 1);
}));

test('--pause with --hook or with any other argument is a usage error: exit 2, with the usage on stderr and nothing read', async () => {
  for (const argv of [['--pause', '--hook'], ['--hook', '--pause'], ['--pause', 'extra']]) {
    const err = [];
    const neverRun = () => {
      throw new Error('a usage error must not run or read anything');
    };
    const code = await resumeMain(argv, { stdout: neverRun, stderr: (line) => err.push(line), run: neverRun, readStdin: neverRun, stdinIsTTY: false });
    assert.equal(code, 2, argv.join(' '));
    assert.match(err.join('\n'), /^Usage: js-harness resume --pause/m);
  }
});

// Through the dispatcher, as the `PostToolUse` entry runs it: a process, the hook's input on its standard input and
// a home of its own in `JS_HARNESS_HOME`.
test('js-harness resume --pause, run as a process: past the pause its standard output is the one JSON line, and the exit is 0', withMachine(async (machine) => {
  const dispatcher = path.join(path.dirname(fileURLToPath(import.meta.url)), 'js-harness.mjs');
  const env = { ...process.env, JS_HARNESS_HOME: machine.home };
  const run = spawnSync(process.execPath, [dispatcher, 'resume', '--pause'], { cwd: machine.root, input: pauseInput(machine, PAUSED, { id: SIXTH }), encoding: 'utf8', env, timeout: 60000 });
  assert.deepEqual([run.status, run.stderr], [0, '']);
  assert.equal(run.stdout.trim().split(/\r?\n/).length, 1);
  assert.equal(JSON.parse(run.stdout).hookSpecificOutput.hookEventName, 'PostToolUse');
}));

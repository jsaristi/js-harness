import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseStatus, resumeMain, transcriptTitle } from './resume.mjs';
import { OPENING_SCHEMA, appendNotice, appendReading, newNotice, newReading, openingFileName, openingsDir, recordPath, reliefPath, writeOpening } from './lib/channel.mjs';
import { HOST_COMPACTION_RESERVE, pauseNotice, statePath } from './lib/pause.mjs';
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
const CLEARED = 'js-harness resume: this session was just cleared: the host started it again with a new transcript. What follows is read from files; the conversation before the clear is not in it.';
const READ = 'Read "Next step" in that document, and "State for a resume" if it has one, and trust them over the summary. Then repeat to the user any question that is still open.';
const PARTS_TRUST = 'Trust them over the summary. Then repeat to the user any question that is still open.';
// The parts of the machine's default feature document (`makeMachine`), as the hook names them (odd/tasks/resume-open-task.md, S6).
const PARTS = ['Read these parts of it (6 lines in all), not the whole file:', '  "Next step": lines 5-6 (2 lines)', '  the task T6: line 3 (1 line)', PARTS_TRUST];

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
function fakeGit(machine, { plans = ['odd/tasks/session-channel.md'], branches = {}, failing = [], more = [], uncommitted = false, commitTime = '2026-01-01T09:00:00+00:00', status = null, fileStatus = ' M odd/tasks/session-channel.md\n' } = {}) {
  const trees = [...more, { path: machine.worktree, branch: branches.worktree ?? 'feat/channel' }, { path: machine.root, branch: branches.root ?? 'main' }];
  const calls = [];
  const run = (command, args, { cwd } = {}) => {
    calls.push(`${command} ${args.join(' ')}`);
    const said = (stdout) => ({ status: 0, stdout, stderr: '' });
    const tree = trees.find((item) => isUnder(item.path, cwd));
    // The subcommand is the first word that is not a flag, and the folder of `git -C <folder>` is not one.
    const what = args.filter((arg, index) => !arg.startsWith('-') && args[index - 1] !== '-C')[0];
    if (command !== 'git' || !tree || failing.includes(what)) return { status: 128, stdout: '', stderr: 'fatal: made up' };
    if (what === 'rev-parse') return said(args.includes('--git-common-dir') ? `${path.join(machine.root, '.git')}\n` : `${tree.path}\n`);
    if (what === 'branch') return said(`${tree.branch}\n`);
    if (what === 'diff') return said(tree.path === machine.worktree ? plans.map((name) => `${name}\0`).join('') : '');
    if (what === 'ls-files') return said('');
    // The last commit of the file named after `--`, and the status of the worktree, which is clean unless `status` gives its text.
    if (what === 'log') return said(uncommitted ? '' : `1111111\t${commitTime}\n`);
    // The status of one file, asked with `--` before its path: changed, unless `fileStatus` is given empty.
    if (what === 'status' && args.includes('--')) return said(fileStatus);
    if (what === 'status') return said(status ?? `# branch.oid ${'1'.repeat(40)}\0# branch.head ${tree.branch}\0`);
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
    // The desktop app's record of the session, which a start reads for a clear: none here unless a test gives one.
    readApp: () => new Map(),
    ...deps,
  });
  return { code, lines: out.join('\n').split('\n').filter((line, index, all) => !(all.length === 1 && line === '')), stderr: err.join('\n'), calls: git.calls };
}

// A session's transcript as the host writes it: its title, then one reply of the session, so the stretch before a compaction has a reply in it.
const titled = (machine, title = TITLE) => fs.writeFileSync(path.join(machine.projectDir, `${SESSION}.jsonl`), [{ type: 'custom-title', customTitle: title, sessionId: SESSION }, answered(1, 'Done.')].map((entry) => `${JSON.stringify(entry)}\n`).join(''));
const from = { host: 'claude-code', id: SESSION, source: 'environment', title: TITLE, permissionMode: 'auto' };
const notified = (machine, more = {}) => appendNotice(machine.home, machine.slug, newNotice({ at: AT, from, to: 'orchestrator', kind: 'opened', text: 'the channel', cwd: machine.worktree, worktree: machine.worktree, branch: 'feat/channel', ...more }));
const opened = (machine, title = TITLE) => writeOpening(machine.home, machine.slug, { title, text: 'Build the channel.\n', at: AT, from });

/** The session's transcript: its title, then `entries`, one JSON line each. */
const transcriptWith = (machine, entries) => fs.writeFileSync(path.join(machine.projectDir, `${SESSION}.jsonl`), [{ type: 'custom-title', customTitle: TITLE, sessionId: SESSION }, ...entries].map((entry) => `${JSON.stringify(entry)}\n`).join(''));
/** A reply of the session at `at` that edits each of `files`, as the transcript records the calls. */
const editedAt = (at, ...files) => ({ type: 'assistant', timestamp: at, message: { model: 'made-up-model', role: 'assistant', content: files.map((file) => ({ type: 'tool_use', name: 'Edit', input: { file_path: file } })) } });
const RELIEF_READ = 'Read its last lines before anything else: it is the orchestrator\'s state, and no feature document is. Trust it over the summary. Then repeat to the user any question that is still open.';

// The lines of the stretch before the compaction. A transcript made here puts the title on line 1, and each entry after it on the next line.
const indented = (...lines) => lines.map((line) => `  ${line}`);
const K = (tokens) => `${Math.round(tokens / 1000)}k`;
const HELD = shareOf(DEFAULT_CONTEXT_WINDOW, DEFAULT_CONTEXT_COMPACTION_PERCENT);
const minute = (m) => `2026-01-01T10:${String(m).padStart(2, '0')}:00.000Z`;
const asked = (m, text) => ({ type: 'user', timestamp: minute(m), origin: { kind: 'human' }, message: { role: 'user', content: text } });
const answered = (m, text, usage) => ({ type: 'assistant', timestamp: minute(m), message: { model: 'made-up-model', role: 'assistant', stop_reason: 'end_turn', ...(usage === undefined ? {} : { usage }), content: [{ type: 'text', text }] } });
const toolOnly = (m) => ({ type: 'assistant', timestamp: minute(m), message: { model: 'made-up-model', role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'toolu_made', name: 'Bash', input: { command: 'made up' } }] } });
const boundary = (m, trigger, tokens = HELD) => ({ type: 'system', subtype: 'compact_boundary', timestamp: minute(m), compactMetadata: { trigger, preTokens: tokens, postTokens: 15000 } });
const hostBoundary = (m, tokens = HELD) => boundary(m, 'auto', tokens);
const askedBoundary = (m, tokens = HELD) => boundary(m, 'manual', tokens);
const messageOf = (m, name) => ({ type: 'user', timestamp: minute(m), isMeta: true, origin: { kind: 'peer', from: 'uds:made-up', fromSession: 'local_sender-1', fromMode: 'bypass', name, msg_id: `msg-${m}`, body: 'made up' }, message: { role: 'user', content: 'Another session sent this: made up' } });
const headOf = (machine) => `Before this compaction, read from ${path.join(machine.projectDir, `${SESSION}.jsonl`)}:`;
const NO_BOUNDARY = 'Compaction: its boundary is not in the transcript yet, which is how one made by the host looks when this hook runs (the host writes it after)';
const NOT_TOLD = 'The pause: not known whether this session was told (it keeps no state of the pause\'s notice: that entry may not be installed).';
const NO_USER = 'The user wrote nothing in this stretch.';
const NONE_REPLY = 'This session\'s last reply with text: none in this stretch.';
const HOST = 'The host compacted this session by itself: say so in your next reply to the user, first, with what was and was not written before it.';
// The hook writes the hour of the compaction from the clock it runs at (odd/tasks/wake-and-flag.md, T4): 7 of 60 such
// notices typed it in UTC when the line left it to the session.
const COMPACTED_AT = `${String(new Date(NOW).getHours()).padStart(2, '0')}:${String(new Date(NOW).getMinutes()).padStart(2, '0')}`;
const NOTIFY = `Then tell the orchestrator (the session that leads this project's sessions, where one does: the js-harness-orchestrator skill says how) in one line that this session was compacted and what it resumes:  js-harness notify --to orchestrator --kind note "<this session's title>: compacted at ${COMPACTED_AT}, resumes <what>"  (it answers with the orchestrator's title, or that there is none).`;
const USER_LINE = (count, lines) => `The user wrote at ${count} lines of it, the last at ${lines}: read each with  js-harness sessions --quote ${SESSION} <line>`;
const REPLY_LINE = (line, at, text) => `This session's last reply with text is line ${line} (${at}); it ended: "${text}"`;
// The feature document of `titled` and `notified`, and the state line the hook says of it: written 12 minutes before the test's now, committed at 09:00.
const DOCUMENT_OF = (machine) => path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md');
const STATE_OF = (machine) => `State: ${DOCUMENT_OF(machine)} was last written at 2026-01-01T11:48:00.000Z (12m ago) and last committed at 2026-01-01T09:00:00.000Z (1111111).`;
// The worktree line of `titled` and `notified`: the machine's worktree is clean, on its branch.
const CLEAN_OF = (machine) => `Worktree ${machine.worktree}: branch feat/channel, head 1111111, nothing changed and not committed.`;
// What a transcript of `titled` says of its stretch: no boundary, the user wrote nothing, and the one reply is on line 2.
const TITLED_BLOCK = (machine) => [headOf(machine), ...indented(`${NO_BOUNDARY}; the transcript records none before it.`, NOT_TOLD, STATE_OF(machine), CLEAN_OF(machine), NO_USER, REPLY_LINE(2, minute(1), 'Done.'), HOST)];

// The questions of the channel's record. Its notices are written at minute 0, before every call of the transcripts below
// (minute 1 and later), and the test's clock reads two hours after them, so each question is "recorded 2h ago".
const ORQ = 'JH ORQ · the channel';
const BY_OTHER = { host: 'claude-code', id: 'bbbbbbbb-2222-4222-8222-222222222222', source: 'environment', title: null, permissionMode: 'auto' };
const OPTIONS_OF_QUESTION = [{ label: 'Yes (Recommended)', description: 'made up' }, { label: 'No', description: 'made up' }];
const DISMISSED = '[User dismissed — do not proceed, wait for next instruction]';
const RECORD_PATH = (machine) => recordPath(machine.home, machine.slug);
/** A question put to him, written by `from` (the session's own unless `more` says otherwise), with no call or answer yet. */
const askQuestion = (machine, text, more = {}) => appendNotice(machine.home, machine.slug, newNotice({ at: minute(0), from, to: 'orchestrator', kind: 'question', text, id: `id ${text}`, options: OPTIONS_OF_QUESTION, waits: 'the board', ...more }));
/** The withdrawal of question `question`, with its reason. */
const withdraw = (machine, question, reason) => appendNotice(machine.home, machine.slug, newNotice({ at: minute(0), from, to: 'orchestrator', kind: 'withdrawn', text: reason, question }));
/** His answer to question `question`, read at `line` of the session's transcript: verified, with its copy, unless `verified` is false. */
const answerTo = (machine, question, { line, answer = 'Yes (Recommended)', verified = true, text = answer }) => appendNotice(machine.home, machine.slug, newNotice({ at: minute(0), from, to: 'orchestrator', kind: 'answer', text, transcript: SESSION, line, question, verified, copy: verified ? { tool: 'AskUserQuestion', answers: [{ question: 'made up', options: ['Yes (Recommended)', 'No'], answer, how: 'tapped' }] } : null }));
/** A call of the question tool at minute `m` that asks `question`, as the transcript writes it. */
const askedAt = (m, id, question) => ({ type: 'assistant', timestamp: minute(m), message: { model: 'made-up-model', role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name: 'AskUserQuestion', input: { questions: [{ question, header: 'Made up', multiSelect: false, options: OPTIONS_OF_QUESTION }] } }] } });
/** Its result at minute `m`: his `answer`, or none at all when `answer` is undefined (no answer of his). */
const resultAt = (m, id, question, answer) => ({ type: 'user', timestamp: minute(m), ...(answer === undefined ? {} : { toolUseResult: { answers: { [question]: answer } } }), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'made up' }] } });
/** How to ask him when no entry of his is read in the transcript, for `waits` questions: the rule's sentence for a time that is not known. */
const UNKNOWN_WHEN = (count) => `when the user last wrote here is not known: call the question tool in the reply to a message of the user's; until then a reply says in one line that ${count === 1 ? '1 question waits' : `${count} questions wait`} and about what, and never writes the options out as text`;
/** The same rule for a time that is known: `ago` is how long before the test's clock his newest words were. */
const KNOWN_WHEN = (ago, count) => `the user last wrote here ${ago} ago: the question tool would hold this session until the user answers, so call it in the reply to the user's next message; until then a reply says in one line that ${count === 1 ? '1 question waits' : `${count} questions wait`} and about what, and never writes the options out as text`;
/** The lines the questions step prints: from the first that starts with "Questions" to the line after them, which is the
 * deadline's, the notify line, or the end. `null` when the hook printed none. */
function questionLinesOf(lines) {
  const start = lines.findIndex((line) => line.startsWith('Questions'));
  if (start === -1) return null;
  const rest = lines.slice(start);
  const end = rest.findIndex((line) => line.startsWith('Not read before') || line === NOTIFY);
  return end === -1 ? rest : rest.slice(0, end);
}

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
    ...PARTS,
    ...TITLED_BLOCK(machine),
    NOTIFY,
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
  const said = (how, tail) => [
    FIRST,
    `Session: "JH 5 · the channel" (${how})`,
    `Opening: ${stored}  (print it: js-harness sessions --opening 'JH 5 · the  channel')`,
    `Feature document: ${path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')}  (branch feat/channel, in the worktree this session's last notice was written from)`,
    ...PARTS,
    ...tail,
  ];
  assert.deepEqual((await runHook(machine, hookInput(machine, { session_title: wide }))).lines, said('the title the host gave the hook', [NOTIFY]));
  titled(machine, wide);
  assert.deepEqual((await runHook(machine, hookInput(machine))).lines, said('the title its transcript carries', [...TITLED_BLOCK(machine), NOTIFY]));
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
  const tail = async (git) => (await runHook(machine, hookInput(machine, { session_title: TITLE }), { git })).lines.slice(3, -1);
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
  // The worktree has another branch checked out now: its documents are the ones it has now, and the line says both branches.
  assert.equal((await tail(fakeGit(machine, { branches: { worktree: 'feat/other' } })))[0], `Feature document: ${path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')}  (branch feat/other, in the worktree this session's last notice was written from, which is on feat/other now, and this session's last notice was written there on feat/channel)`);
  // A notice of the session's title, from a transcript the app has since replaced, is its notice too.
  const restarted = await runHook(machine, hookInput(machine, { session_id: 'cccccccc-3333-4333-8333-333333333333', session_title: TITLE }));
  assert.equal(restarted.lines[3], `Feature document: ${path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')}  (branch feat/channel, in the worktree this session's last notice was written from)`);
  // And with neither its id nor its title in the record, the notices of the others are not its own.
  assert.equal((await runHook(machine, hookInput(machine, { session_id: 'cccccccc-3333-4333-8333-333333333333' }))).lines[3], 'Feature document: not known (no notice of this session in the channel\'s record names a worktree)');
}));

test('the feature document is the last one the session wrote, by its transcript, whatever branch its notice names', withMachine(async (machine) => {
  const tasks = path.join(machine.worktree, 'odd', 'tasks');
  const rule = path.join(tasks, 'rule-hierarchy.md');
  fs.writeFileSync(rule, '# Rule hierarchy\n');
  const forward = path.join(tasks, 'session-channel.md').replaceAll('\\', '/');
  const feature = async (more = {}, deps = {}) => (await runHook(machine, hookInput(machine, { session_title: TITLE, ...more }), deps)).lines.slice(3, 4 + PARTS.length);
  const reading = [`Feature document: ${forward}  (branch feat/channel, the last feature document this session wrote, by its transcript)`, ...PARTS];
  // The notice was written on another branch of the worktree, and no transcript says otherwise: the transcript decides.
  notified(machine, { branch: 'feat/old' });
  // The latest of the documents the session wrote that is still there: a removed one and the notes it wrote do not count.
  transcriptWith(machine, [
    editedAt('2026-01-01T10:00:00.000Z', rule),
    editedAt('2026-01-01T10:10:00.000Z', forward),
    editedAt('2026-01-01T10:20:00.000Z', path.join(tasks, 'removed.md')),
    editedAt('2026-01-01T10:30:00.000Z', path.join(machine.root, 'README.md'), path.join(tasks, 'notes.txt')),
  ]);
  assert.deepEqual(await feature(), reading);
  // A transcript that names no document still there gives nothing: the notice decides, as before.
  notified(machine);
  transcriptWith(machine, [editedAt('2026-01-01T10:20:00.000Z', path.join(tasks, 'removed.md'))]);
  const fromNotice = [`Feature document: ${path.join(tasks, 'session-channel.md')}  (branch feat/channel, in the worktree this session's last notice was written from)`, ...PARTS];
  assert.deepEqual(await feature(), fromNotice);
  // A transcript that cannot be read gives nothing here, and the hook goes on.
  transcriptWith(machine, [editedAt('2026-01-01T10:10:00.000Z', forward)]);
  assert.deepEqual(await feature({ transcript_path: path.join(machine.claudeHome, 'projects', 'other-project', `${SESSION}.jsonl`) }), fromNotice);
  // The branch of the document's worktree is not known when git does not say it.
  assert.deepEqual(await feature({}, { git: fakeGit(machine, { failing: ['branch'] }) }), [`Feature document: ${forward}  (branch not known, the last feature document this session wrote, by its transcript)`, ...PARTS]);
}));

test('an orchestrator\'s state is its relief file: the hook names it with its lines and when it was written, and no feature document', withMachine(async (machine) => {
  const orq = 'JH ORQ · the channel';
  notified(machine);
  const file = reliefPath(machine.home, machine.slug);
  const head = [FIRST, `Session: "${orq}" (the title the host gave the hook)`, `Opening: none stored for that title (the openings of this project are in ${openingsDir(machine.home, machine.slug)})`];
  // Missing: the line says so, with the reason, and no feature document takes its place.
  assert.deepEqual((await runHook(machine, hookInput(machine, { session_title: orq }))).lines, [...head, `Relief file: ${file}  (missing: ENOENT)`, RELIEF_READ]);
  // Written: its lines are counted and its text is not printed.
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '- 10:00 a line of the relief\n\n- 10:05 another one\n- 10:06 a third\n');
  writtenAt(file, 30);
  const written = await runHook(machine, hookInput(machine, { session_title: orq }));
  assert.deepEqual(written.lines, [...head, `Relief file: ${file}  (3 lines, last written 30m ago)`, RELIEF_READ]);
  assert.equal(written.lines.some((line) => line.includes('a line of the relief')), false);
  // Not read: the line says so, with the reason the read gave.
  const denied = (asked) => {
    if (asked === file) throw Object.assign(new Error('made up'), { code: 'EACCES' });
    return fs.readFileSync(asked, 'utf8');
  };
  assert.equal((await runHook(machine, hookInput(machine, { session_title: orq }), { readFile: denied })).lines[3], `Relief file: ${file}  (not read: EACCES)`);
  // A work session of the same project keeps its feature document: the relief file is the orchestrator's alone.
  assert.equal((await runHook(machine, hookInput(machine, { session_title: TITLE }))).lines[3], `Feature document: ${path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')}  (branch feat/channel, in the worktree this session's last notice was written from)`);
}));

test('a sub-agent\'s start of a session prints nothing: the hook speaks to the session, and an empty agent id is the session\'s own', withMachine(async (machine) => {
  titled(machine);
  notified(machine);
  const sub = await runHook(machine, hookInput(machine, { session_title: TITLE, agent_id: 'made-up-agent' }));
  assert.deepEqual([sub.code, sub.lines, sub.stderr, sub.calls], [0, [], '', []]);
  assert.equal((await runHook(machine, hookInput(machine, { session_title: TITLE, agent_id: '' }))).lines[0], FIRST);
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
  assert.equal(lines[12].startsWith('Find there the document of the feature'), true, 'the line that says what to read comes after them');
  assert.equal(lines.at(-1), NOTIFY, 'and the notify line is the last one');
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

test('the hook speaks after a compaction or a clear, and not after a resume, a fork or an input of another kind: those print nothing', withMachine(async (machine) => {
  titled(machine);
  for (const source of ['resume', 'fork', undefined, 7]) {
    assert.deepEqual((await runHook(machine, hookInput(machine, { source }))).lines, [], String(source));
  }
  // An input that is not read at all is said on standard error: the test after the next one.
  for (const input of [`\uFEFF${hookInput(machine, { source: 'startup' })}`]) {
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

test('after a clear the hook prints the cleared line, the title, the opening and the feature document, and no line of the compaction', withMachine(async (machine) => {
  titled(machine);
  notified(machine);
  const opening = opened(machine).path;
  const { code, lines, stderr } = await runHook(machine, hookInput(machine, { source: 'clear', session_title: TITLE }));
  assert.deepEqual([code, stderr], [0, '']);
  assert.deepEqual(lines, [
    CLEARED,
    `Session: "${TITLE}" (the title the host gave the hook)`,
    `Opening: ${opening}  (print it: js-harness sessions --opening '${TITLE}')`,
    `Feature document: ${path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')}  (branch feat/channel, in the worktree this session's last notice was written from)`,
    ...PARTS,
  ]);
  assert.doesNotMatch(lines.join('\n'), /compact|notify --to|the pause|Before this/, 'a clear has no compaction, no stretch before it and no notice to the orchestrator of one');
}));

test('a start is read as a clear only when the app\'s record of the session names the session it was cleared from; then it speaks the cleared line', withMachine(async (machine) => {
  titled(machine);
  notified(machine);
  const prior = 'bbbbbbbb-2222-4222-8222-222222222222';
  const asClear = await runHook(machine, hookInput(machine, { source: 'clear', session_title: TITLE }));
  const cleared = await runHook(machine, hookInput(machine, { source: 'startup', session_title: TITLE }), { readApp: () => new Map([[SESSION, { priorCliSessionIds: [prior] }]]) });
  assert.equal(cleared.lines[0], CLEARED);
  assert.deepEqual(cleared.lines, asClear.lines, 'the same lines as a clear');
  // A record with no prior id, a record of another session, and no record at all: each starts as the host says, silently.
  const silent = [
    () => new Map([[SESSION, { priorCliSessionIds: [] }]]),
    () => new Map([['cccccccc-3333-4333-8333-333333333333', { priorCliSessionIds: [prior] }]]),
    () => new Map(),
  ];
  for (const readApp of silent) {
    assert.deepEqual((await runHook(machine, hookInput(machine, { source: 'startup' }), { readApp })).lines, []);
  }
  // The record is read for a start only: a compaction or a resume does not look at the app.
  let looked = 0;
  const readApp = () => {
    looked += 1;
    return new Map();
  };
  await runHook(machine, hookInput(machine, { source: 'compact' }), { readApp });
  await runHook(machine, hookInput(machine, { source: 'resume' }), { readApp });
  assert.equal(looked, 0);
}));

test('a sub-agent\'s clear, or its start after a clear, prints nothing: the hook speaks to the session', withMachine(async (machine) => {
  titled(machine);
  const readApp = () => new Map([[SESSION, { priorCliSessionIds: ['bbbbbbbb-2222-4222-8222-222222222222'] }]]);
  for (const source of ['clear', 'startup']) {
    assert.deepEqual((await runHook(machine, hookInput(machine, { source, agent_id: 'a1' }), { readApp })).lines, [], source);
    assert.equal((await runHook(machine, hookInput(machine, { source, agent_id: '' }), { readApp })).lines[0], CLEARED, `${source}: an empty agent id is the session's own`);
  }
}));

// A clear's title is the app's when neither the hook input nor the new transcript gives one: the app's record is the one
// it already reads for a start, so the opening of the session is still found.
test('a clear whose hook input and transcript give no title is titled by the title the desktop app records for the session', withMachine(async (machine) => {
  notified(machine);
  const opening = opened(machine).path;
  fs.writeFileSync(path.join(machine.projectDir, `${SESSION}.jsonl`), `${JSON.stringify(answered(1, 'Done.'))}\n`);
  const FROM = 'the title the desktop app records for the session';
  const app = () => new Map([[SESSION, { title: TITLE, priorCliSessionIds: ['bbbbbbbb-2222-4222-8222-222222222222'] }]]);
  for (const source of ['clear', 'startup']) {
    const { code, lines, stderr } = await runHook(machine, hookInput(machine, { source }), { readApp: app });
    assert.deepEqual([code, stderr], [0, ''], source);
    assert.deepEqual(lines.slice(0, 3), [
      CLEARED,
      `Session: "${TITLE}" (${FROM})`,
      `Opening: ${opening}  (print it: js-harness sessions --opening '${TITLE}')`,
    ], source);
  }
  // A compaction does not read the app's record: its title is still the one the transcript and the hook give, which is none.
  const compacted = await runHook(machine, hookInput(machine, { source: 'compact' }), { readApp: app });
  assert.match(compacted.lines[1], /^Session: title not known/);
  assert.doesNotMatch(compacted.lines.join('\n'), new RegExp(FROM.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}));

test('in hook mode an input that was not read is said on standard error, and nothing is printed; a pause run says nothing', withMachine(async (machine) => {
  titled(machine);
  const said = (why) => `js-harness resume --hook: the host's JSON was expected on standard input and none was read (${why}); nothing was looked at.`;
  const cases = [
    ['', 'standard input is empty'],
    [' \n', 'standard input is empty'],
    ['﻿', 'standard input is empty'],
    ['not json', 'standard input is not JSON'],
    ['{"source":"compact"', 'standard input is not JSON'],
    ['[]', 'standard input is not a JSON object'],
    ['null', 'standard input is not a JSON object'],
    ['"compact"', 'standard input is not a JSON object'],
  ];
  for (const [input, why] of cases) {
    const { code, lines, stderr } = await runHook(machine, input);
    assert.deepEqual([code, lines, stderr], [0, [], said(why)], JSON.stringify(input));
  }
  // A terminal is not read at all, which is what a person at a shell gets: it is said the same way.
  const terminal = await runHook(machine, '', { stdinIsTTY: true, readStdin: () => { throw new Error('standard input must not be read from a terminal'); } });
  assert.deepEqual([terminal.code, terminal.lines, terminal.stderr], [0, [], said('standard input is a terminal')]);
  // A read that throws is not an input that was not read: it stays silent, as any other failure does.
  assert.deepEqual((await runHook(machine, hookInput(machine), { readStdin: () => { throw new Error('made up'); } })).stderr, '');
  // The pause run is the host's and says nothing on standard error.
  for (const input of ['', 'not json', '[]']) assert.equal((await runPause(machine, input)).stderr, '', JSON.stringify(input));
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
  const odd = await runHook(machine, hookInput(machine, { session_id: '..\\..\\secrets', transcript_path: '' }), { readFile });
  assert.equal(odd.lines[1], 'Session: title not known (the host gave the hook none and no session id a transcript could be found by)');
  assert.deepEqual(read.filter((file) => file.includes('secrets')), []);
  // An extra argument is refused before anything is read (T1 of odd/tasks/commands-and-doctor.md): the
  // entry `install` writes carries `--hook` alone.
  const extra = await runHook(machine, hookInput(machine), { argv: ['--hook', '--bogus'] });
  assert.deepEqual([extra.code, extra.lines], [2, []]);
  assert.match(extra.stderr, /^unknown argument: --bogus\n/);
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
    `Questions: not read (the channel's record ${RECORD_PATH(machine)} could not be read: made up)`,
  ];
  assert.deepEqual(await printed({ session_title: TITLE }, { readFile: boom }), [FIRST, `Session: "${TITLE}" (the title the host gave the hook)`, `Opening: none stored for that title (the openings of this project are in ${dir})`, ...unread, NOTIFY]);
  // With no title from the host either, the transcript and the record are all that could give one, and
  // neither can be read: the hook says that of the record, and does not go silent.
  assert.deepEqual(await printed({}, { readFile: boom }), [
    FIRST,
    `Session: title not known (the host gave the hook none, its transcript ${SESSION.slice(0, 8)} gives none and the channel's record could not be read (made up))`,
    `Opening: not known without a title (the openings of this project are in ${dir}; js-harness sessions --opening "<title>" prints one)`,
    ...unread,
    NOTIFY,
  ]);

  // No folder can be listed: an opening is stored, and the hook says it could not look, not that there is none.
  opened(machine);
  const unlisted = `Opening: could not look in ${dir} (made up)`;
  assert.deepEqual(await printed({ session_title: TITLE }, { readdir: boom }), [FIRST, `Session: "${TITLE}" (the title the host gave the hook)`, unlisted, document, ...PARTS, ...TITLED_BLOCK(machine), NOTIFY]);
  assert.deepEqual(await printed({}, { readdir: boom }), [FIRST, `Session: "${TITLE}" (the title its transcript carries)`, unlisted, document, ...PARTS, ...TITLED_BLOCK(machine), NOTIFY]);
  // No file can be read, and now the folder holds one: it may be the opening asked for, so "none stored" is not said.
  assert.deepEqual(await printed({ session_title: TITLE }, { readFile: boom }), [FIRST, `Session: "${TITLE}" (the title the host gave the hook)`, `Opening: not known whether one is stored for that title (1 file of ${dir} could not be read as an opening)`, ...unread, NOTIFY]);
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
    return lines.slice(4, -2);
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
  const several = (count, more = '') => `Opening: ${count} openings are named by that title, the latest first: ask for one by its whole title (give js-harness sessions --opening one title below, between single quotes, and it prints it${more})`;
  const { code, lines, stderr } = await runHook(machine, hookInput(machine, { session_title: 'JH 5' }));
  assert.deepEqual([code, stderr], [0, '']);
  assert.deepEqual(lines, [FIRST, 'Session: "JH 5" (the title the host gave the hook)', several(2), `  "JH 5 · the channel, reworded"  (${second})`, `  "JH 5 · the channel"  (${first})`, document, ...PARTS, NOTIFY]);
  // The command for `JH 5` would exit 2, so none is written.
  assert.deepEqual(lines.filter((line) => line.includes('print it:') || line.includes('--opening \'')), []);
  // A file that could not be read may be a third: it is said as not counted, as for one opening.
  fs.writeFileSync(path.join(dir, 'torn.json'), '{"schema":');
  assert.equal((await runHook(machine, hookInput(machine, { session_title: 'JH 5' }))).lines[2], several(2, `; 1 file of ${dir} could not be read as an opening and is not counted`));
  fs.rmSync(path.join(dir, 'torn.json'));
  // A whole title names one opening, and nothing changes for it.
  assert.deepEqual((await runHook(machine, hookInput(machine, { session_title: TITLE }))).lines, [FIRST, `Session: "${TITLE}" (the title the host gave the hook)`, `Opening: ${first}  (print it: js-harness sessions --opening '${TITLE}')`, document, ...PARTS, NOTIFY]);
  // And the code and the role that name one opening are a title a command is written for.
  assert.equal((await runHook(machine, hookInput(machine, { session_title: 'JH 6' }))).lines[2], `Opening: ${path.join(dir, openingFileName('JH 6 · other'))}  (print it: js-harness sessions --opening 'JH 6')`);
}));

test('the titles of several openings are listed as the files hold them: a second blank in one of them is kept', withMachine(async (machine) => {
  notified(machine);
  // The two titles differ only by a second blank: each is an opening of its own, and the list must tell them apart.
  const single = opened(machine).path;
  const double = writeOpening(machine.home, machine.slug, { title: 'JH 5 · the  channel', text: 'Build it.\n', at: '2026-01-01T11:00:00.000Z', from }).path;
  const document = `Feature document: ${path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')}  (branch feat/channel, in the worktree this session's last notice was written from)`;
  const several = `Opening: 2 openings are named by that title, the latest first: ask for one by its whole title (give js-harness sessions --opening one title below, between single quotes, and it prints it)`;
  const { code, lines, stderr } = await runHook(machine, hookInput(machine, { session_title: 'JH 5' }));
  assert.deepEqual([code, stderr], [0, '']);
  assert.deepEqual(lines, [FIRST, 'Session: "JH 5" (the title the host gave the hook)', several, `  "JH 5 · the  channel"  (${double})`, `  "JH 5 · the channel"  (${single})`, document, ...PARTS, NOTIFY]);
}));

test('a title the list prints stays on its line: a quote, a line break and a line separator are escaped as the file holds them', withMachine(async (machine) => {
  notified(machine);
  const dir = openingsDir(machine.home, machine.slug);
  const quoted = writeOpening(machine.home, machine.slug, { title: 'JH 5 · the "odd" channel', text: 'Build it.\n', at: '2026-01-01T11:00:00.000Z', from }).path;
  const single = opened(machine).path;
  const document = `Feature document: ${path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')}  (branch feat/channel, in the worktree this session's last notice was written from)`;
  const several = `Opening: 2 openings are named by that title, the latest first: ask for one by its whole title (give js-harness sessions --opening one title below, between single quotes, and it prints it)`;
  const { lines } = await runHook(machine, hookInput(machine, { session_title: 'JH 5' }));
  assert.deepEqual(lines, [FIRST, 'Session: "JH 5" (the title the host gave the hook)', several, `  "JH 5 · the \\"odd\\" channel"  (${quoted})`, `  "JH 5 · the channel"  (${single})`, document, ...PARTS, NOTIFY]);
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
  assert.deepEqual(listed.lines, [FIRST, 'Session: "JH 5 · the channel end" (the title the host gave the hook)', several, `  "JH 5 · the\\nchannel\\u2028end"  (${newer})`, `  "JH 5 · the\\nchannel\\u2028end"  (${older})`, document, ...PARTS, NOTIFY]);
}));

test('a notice written on no branch, and a worktree git names no branch for, tell no feature document', withMachine(async (machine) => {
  notified(machine);
  const reason = async (git) => (await runHook(machine, hookInput(machine, { session_title: TITLE }), { git })).lines[3];
  assert.equal(await reason(fakeGit(machine, { failing: ['branch'] })), `Feature document: not known (git does not say which branch ${machine.worktree} is on now)`);
  // The last notice decides: one written on a detached HEAD names a worktree and no branch.
  notified(machine, { branch: null });
  assert.equal(await reason(), `Feature document: not known (this session's last notice was written in ${machine.worktree} on no branch)`);
}));

test('a compaction the user asked for, with no reply after it, is said so with its time, its tokens and its line; no host line', withMachine(async (machine) => {
  notified(machine);
  transcriptWith(machine, [asked(1, 'the stretch'), answered(2, 'the answer'), askedBoundary(3)]);
  const { lines } = await runHook(machine, hookInput(machine, { session_title: TITLE }));
  assert.deepEqual(lines.slice(lines.indexOf(headOf(machine))), [
    headOf(machine),
    ...indented(`Compaction: asked for by the user at ${minute(3)}, holding ${K(HELD)} tokens (line 4).`, NOT_TOLD, STATE_OF(machine), CLEAN_OF(machine), USER_LINE(1, '2'), REPLY_LINE(3, minute(2), 'the answer')),
    NOTIFY,
  ]);
}));

test('a compaction the host wrote, with a reply of the session after it, is not written yet: the line names the one before it, and the host line is said', withMachine(async (machine) => {
  notified(machine);
  transcriptWith(machine, [asked(1, 'before the host compacted'), hostBoundary(2), answered(3, 'the stretch answer')]);
  assert.deepEqual((await runHook(machine, hookInput(machine, { session_title: TITLE }))).lines.slice(4 + PARTS.length), [
    headOf(machine),
    ...indented(`${NO_BOUNDARY}; the one before it was at ${minute(2)}.`, NOT_TOLD, STATE_OF(machine), CLEAN_OF(machine), NO_USER, REPLY_LINE(4, minute(3), 'the stretch answer'), HOST),
    NOTIFY,
  ]);
}));

test('with no boundary in the transcript, the compaction line says that it records none before it', withMachine(async (machine) => {
  notified(machine);
  transcriptWith(machine, [asked(1, 'the question'), answered(2, 'the answer')]);
  assert.deepEqual((await runHook(machine, hookInput(machine, { session_title: TITLE }))).lines.slice(4 + PARTS.length), [
    headOf(machine),
    ...indented(`${NO_BOUNDARY}; the transcript records none before it.`, NOT_TOLD, STATE_OF(machine), CLEAN_OF(machine), USER_LINE(1, '2'), REPLY_LINE(3, minute(2), 'the answer'), HOST),
    NOTIFY,
  ]);
}));

test('a file the host continued holds a copy of the boundary and none of the stretch: its line says so in place of the stretch lines', withMachine(async (machine) => {
  notified(machine);
  transcriptWith(machine, [hostBoundary(1)]);
  assert.deepEqual((await runHook(machine, hookInput(machine, { session_title: TITLE }))).lines.slice(4 + PARTS.length), [
    headOf(machine),
    ...indented(`Compaction: made by the host at ${minute(1)}, holding ${K(HELD)} tokens (line 2).`, NOT_TOLD, STATE_OF(machine), CLEAN_OF(machine), 'The stretch of work before this compaction is not in this transcript: the host continued the session in a new file, and no other session\'s file is read.', HOST),
    NOTIFY,
  ]);
}));

test('the pause line says that the session was told the pause in the stretch, that it was told after it, or that it is not known', withMachine(async (machine) => {
  notified(machine);
  const transcript = path.join(machine.projectDir, `${SESSION}.jsonl`);
  const home = machine.home;
  // The reply of the session is past the pause, and the state of the pause is written by its own function, as the hook does.
  const told = (m) => pauseNotice({ transcript, sessionId: SESSION, home, now: () => Date.parse(minute(m)), tmpdir: path.join(home, 'tmp') });
  const pauseOf = async () => (await runHook(machine, hookInput(machine, { session_title: TITLE }))).lines.find((line) => line.startsWith('  The pause:'));
  transcriptWith(machine, [answered(2, 'past the pause', { input_tokens: PAUSED }), askedBoundary(4)]);
  assert.equal(await pauseOf(), `  ${NOT_TOLD}`, 'no state of the pause yet');
  assert.notEqual(told(2), null, 'the session is told at minute 2, inside the stretch');
  assert.equal(await pauseOf(), `  The pause: this session was told it had passed the context pause at ${minute(2)}, holding ${K(PAUSED)} tokens.`);
  fs.rmSync(statePath(home, SESSION));
  told(6);
  assert.equal(await pauseOf(), '  The pause: this session was not told it had passed the context pause in this stretch.', 'told after the boundary, so outside the stretch');
}));

test('the lines of the user and of other sessions give their count, the last eight in order, and the names of the sessions with their counts', withMachine(async (machine) => {
  notified(machine);
  // Lines 2 to 11 are ten prompts of the user, line 12 a reply, lines 13 to 21 nine messages of other sessions, line 22 the compaction.
  const names = ['JH ORQ · proj', 'JH 1 · made up', 'JH ORQ · proj', null, 'JH ORQ · proj', 'JH 1 · made up', 'JH ORQ · proj', 'JH 1 · made up', 'JH ORQ · proj'];
  transcriptWith(machine, [
    ...Array.from({ length: 10 }, (_, index) => asked(index + 1, `prompt ${index + 1}`)),
    answered(11, 'Answered.'),
    ...names.map((name, index) => messageOf(12 + index, name)),
    askedBoundary(21),
  ]);
  const { lines } = await runHook(machine, hookInput(machine, { session_title: TITLE }));
  assert.deepEqual(lines.slice(lines.indexOf(headOf(machine))), [
    headOf(machine),
    ...indented(
      `Compaction: asked for by the user at ${minute(21)}, holding ${K(HELD)} tokens (line 22).`,
      NOT_TOLD,
      STATE_OF(machine),
      CLEAN_OF(machine),
      USER_LINE(10, '4, 5, 6, 7, 8, 9, 10, 11'),
      `Other sessions wrote at 9 lines, the last at 14, 15, 16, 17, 18, 19, 20, 21 (from "JH ORQ · proj" ×5, "JH 1 · made up" ×3, no name ×1): the same command says whose each is.`,
      REPLY_LINE(12, minute(11), 'Answered.'),
    ),
    NOTIFY,
  ]);
}));

test('the last reply is said by its last 300 characters, with a leading ellipsis when it was longer; a reply of tool calls alone is none', withMachine(async (machine) => {
  notified(machine);
  const long = Array.from({ length: 120 }, (_, index) => `w${index}`).join(' ');
  transcriptWith(machine, [answered(1, long), askedBoundary(2)]);
  assert.deepEqual((await runHook(machine, hookInput(machine, { session_title: TITLE }))).lines.slice(4 + PARTS.length), [
    headOf(machine),
    ...indented(`Compaction: asked for by the user at ${minute(2)}, holding ${K(HELD)} tokens (line 3).`, NOT_TOLD, STATE_OF(machine), CLEAN_OF(machine), NO_USER, REPLY_LINE(2, minute(1), `…${long.slice(-300).trim()}`)),
    NOTIFY,
  ]);
  transcriptWith(machine, [asked(1, 'the question'), toolOnly(2), askedBoundary(3)]);
  assert.deepEqual((await runHook(machine, hookInput(machine, { session_title: TITLE }))).lines.slice(4 + PARTS.length), [
    headOf(machine),
    ...indented(`Compaction: asked for by the user at ${minute(3)}, holding ${K(HELD)} tokens (line 4).`, NOT_TOLD, STATE_OF(machine), CLEAN_OF(machine), USER_LINE(1, '2'), NONE_REPLY),
    NOTIFY,
  ]);
}));

test('the notify line ends the output of any session but the orchestrator, and a session whose title is not known gets it too', withMachine(async (machine) => {
  notified(machine);
  transcriptWith(machine, [answered(1, 'Done.')]);
  const orchestrator = (await runHook(machine, hookInput(machine, { session_title: 'JH ORQ · the channel' }))).lines;
  assert.equal(orchestrator.includes(headOf(machine)), true, 'the orchestrator is told what its transcript holds too');
  assert.notEqual(orchestrator.at(-1), NOTIFY);
  assert.equal((await runHook(machine, hookInput(machine, { session_title: TITLE }))).lines.at(-1), NOTIFY);
  fs.writeFileSync(path.join(machine.projectDir, `${SESSION}.jsonl`), `${JSON.stringify(answered(1, 'Done.'))}\n`);
  const untitled = (await runHook(machine, hookInput(machine))).lines;
  assert.match(untitled[1], /^Session: title not known/);
  assert.equal(untitled.at(-1), NOTIFY);
}));

test('past the hook\'s own deadline once its transcript is read, the stretch, the feature document, the folders, the pause and the reply are not read: the line names them, the lines before are printed, and no git is started', withMachine(async (machine) => {
  // A notice of the session names its worktree: the feature document would be found there by four calls of git.
  notified(machine);
  const transcript = path.join(machine.projectDir, `${SESSION}.jsonl`);
  transcriptWith(machine, [asked(1, 'the stretch'), answered(2, 'the answer'), askedBoundary(3)]);
  const clock = { passed: false };
  const readFile = (file) => {
    const text = fs.readFileSync(file, 'utf8');
    if (file === transcript) clock.passed = true;
    return text;
  };
  const { code, lines, stderr, calls } = await runHook(machine, hookInput(machine, { session_title: TITLE }), { readFile, now: () => (clock.passed ? NOW + 10000 : NOW) });
  assert.deepEqual([code, stderr], [0, '']);
  assert.deepEqual(lines, [
    FIRST,
    `Session: "${TITLE}" (the title the host gave the hook)`,
    `Opening: none stored for that title (the openings of this project are in ${openingsDir(machine.home, machine.slug)})`,
    'Feature document: not known (this hook\'s own deadline passed before it was looked for)',
    'Not read before this hook\'s own deadline (9 s): the stretch of work before this compaction, the feature document, the feature document folders, the pause\'s notice, the work in flight and the machine\'s gate, this session\'s last reply, the questions.',
    NOTIFY,
  ]);
  // Each git call is allowed two seconds, and the host gives the hook fifteen in all: none is started past the deadline.
  assert.deepEqual(calls.filter((call) => / (branch|diff|ls-files|worktree|log|status) /.test(`${call} `)), []);
}));

test('the deadline that passes inside the search for the feature document stops it: the git calls left are not started, and the line says so', withMachine(async (machine) => {
  notified(machine);
  transcriptWith(machine, [asked(1, 'the stretch'), answered(2, 'the answer'), askedBoundary(3)]);
  const git = fakeGit(machine);
  const clock = { passed: false };
  const run = (command, args, options) => {
    if (args[0] === 'branch') clock.passed = true;
    return git.run(command, args, options);
  };
  const { code, lines, stderr, calls } = await runHook(machine, hookInput(machine, { session_title: TITLE }), { git: { run, calls: git.calls }, now: () => (clock.passed ? NOW + 10000 : NOW) });
  assert.deepEqual([code, stderr], [0, '']);
  assert.deepEqual(lines.slice(3), [
    'Feature document: not known (this hook\'s own deadline passed while it was looked for)',
    headOf(machine),
    ...indented(`Compaction: asked for by the user at ${minute(3)}, holding ${K(HELD)} tokens (line 4).`, USER_LINE(1, '2')),
    'Not read before this hook\'s own deadline (9 s): the feature document, the feature document folders, the pause\'s notice, the work in flight and the machine\'s gate, this session\'s last reply, the questions.',
    NOTIFY,
  ]);
  assert.deepEqual(calls.filter((call) => / (diff|ls-files|worktree|log|status) /.test(`${call} `)), []);
}));

test('past the deadline after the stretch is read, its lines are printed, and the pause and the reply are named as not read', withMachine(async (machine) => {
  notified(machine);
  transcriptWith(machine, [asked(1, 'the stretch'), answered(2, 'the answer'), askedBoundary(3)]);
  const git = fakeGit(machine);
  const clock = { passed: false };
  // It passes in the last git call of the search for the feature document, which was started in time.
  const run = (command, args, options) => {
    if (args.includes('ls-files')) clock.passed = true;
    return git.run(command, args, options);
  };
  const { code, lines, stderr } = await runHook(machine, hookInput(machine, { session_title: TITLE }), { git: { run, calls: git.calls }, now: () => (clock.passed ? NOW + 10000 : NOW) });
  assert.deepEqual([code, stderr], [0, '']);
  assert.deepEqual(lines.slice(3), [
    `Feature document: ${path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')}  (branch feat/channel, in the worktree this session's last notice was written from)`,
    ...PARTS,
    headOf(machine),
    ...indented(`Compaction: asked for by the user at ${minute(3)}, holding ${K(HELD)} tokens (line 4).`, USER_LINE(1, '2')),
    'Not read before this hook\'s own deadline (9 s): the pause\'s notice, when the state was last written and committed, the worktree\'s changes, the work in flight and the machine\'s gate, this session\'s last reply, the questions.',
    NOTIFY,
  ]);
}));

test('a step that throws is said as not read in its place, and the rest of the hook prints', withMachine(async (machine) => {
  notified(machine);
  const transcript = path.join(machine.projectDir, `${SESSION}.jsonl`);
  // A transcript the hook is handed as something other than text: `compactionStretch` throws on it.
  const readFile = (file) => (file === transcript ? 5 : fs.readFileSync(file, 'utf8'));
  const { code, lines, stderr } = await runHook(machine, hookInput(machine, { session_title: TITLE }), { readFile });
  assert.deepEqual([code, stderr], [0, '']);
  const at = lines.indexOf(headOf(machine));
  assert.notEqual(at, -1, 'the head is said: the transcript was read');
  assert.match(lines[at + 1], /^ {2}The stretch of work before this compaction: not read \(.+\)$/);
  assert.deepEqual(lines.slice(0, at), [FIRST, `Session: "${TITLE}" (the title the host gave the hook)`, `Opening: none stored for that title (the openings of this project are in ${openingsDir(machine.home, machine.slug)})`, `Feature document: ${path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')}  (branch feat/channel, in the worktree this session's last notice was written from)`, ...PARTS]);
  assert.deepEqual(lines.slice(at + 2), [NOTIFY]);
}));

// The hook reads the transcript the input names only when it is the session's own file under the projects folder of the
// Claude home, in any project's folder: a session opened in another folder is filed under another project. Any other
// path is not read, and the session's own file is read instead.
/** A transcript at `file` whose one reply edits `edited`, written as the host writes one; returns `file`. */
function transcriptAt(file, edited) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, [{ type: 'custom-title', customTitle: TITLE, sessionId: SESSION }, editedAt('2026-01-01T10:10:00.000Z', edited)].map((entry) => `${JSON.stringify(entry)}\n`).join(''));
  return file;
}
/** A `readFile` that records the files it reads, so a test can say which transcript the hook read. */
const recording = (read) => (file) => {
  read.push(file);
  return fs.readFileSync(file, 'utf8');
};

test('a transcript the input names under another project folder of the same Claude home is read', withMachine(async (machine) => {
  notified(machine);
  const edited = path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md').replaceAll('\\', '/');
  const other = transcriptAt(path.join(machine.claudeHome, 'projects', 'other-project', `${SESSION}.jsonl`), edited);
  const read = [];
  const { lines } = await runHook(machine, hookInput(machine, { session_title: TITLE, transcript_path: other }), { readFile: recording(read) });
  assert.ok(read.includes(other), 'the other folder\'s transcript is read');
  assert.ok(lines.includes(`Feature document: ${edited}  (branch feat/channel, the last feature document this session wrote, by its transcript)`));
}));

test('for a transcript filed under another project the block writes no quote command: sessions --quote reads only this project\'s folder, and would answer for another file or for none', withMachine(async (machine) => {
  notified(machine);
  const other = path.join(machine.claudeHome, 'projects', 'other-project', `${SESSION}.jsonl`);
  fs.mkdirSync(path.dirname(other), { recursive: true });
  fs.writeFileSync(other, [{ type: 'custom-title', customTitle: TITLE, sessionId: SESSION }, asked(1, 'the stretch'), messageOf(2, 'JH ORQ · made up'), answered(3, 'the answer')].map((entry) => `${JSON.stringify(entry)}\n`).join(''));
  const { lines } = await runHook(machine, hookInput(machine, { session_title: TITLE, transcript_path: other }));
  assert.ok(lines.includes(`Before this compaction, read from ${other}:`));
  assert.ok(lines.includes(`  The user wrote at 1 lines of it, the last at 2: no command reads them, since js-harness sessions --quote reads only the transcripts of ${machine.projectDir} and this one is filed under another project; read them in the file itself.`), lines.join('\n'));
  assert.ok(lines.includes('  Other sessions wrote at 1 lines, the last at 3 (from "JH ORQ · made up" ×1).'), lines.join('\n'));
  assert.equal(lines.some((line) => line.includes('--quote ' + SESSION)), false);
}));

test('a transcript the input names outside the Claude home, or in its projects folder under another session\'s name, or in a look-alike folder, is not read', withMachine(async (machine) => {
  notified(machine);
  const edited = path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md').replaceAll('\\', '/');
  const own = path.join(machine.projectDir, `${SESSION}.jsonl`);
  // The session's own file is read, and has no edit: the reading is the notice's.
  transcriptWith(machine, []);
  const outside = transcriptAt(path.join(machine.dir, 'elsewhere', `${SESSION}.jsonl`), edited);
  const otherSession = transcriptAt(path.join(machine.projectDir, 'bbbbbbbb-2222-4222-8222-222222222222.jsonl'), edited);
  // `projects-backup` starts with the name of the projects folder, but it is not inside it: the separator makes the difference.
  const lookAlike = transcriptAt(path.join(machine.claudeHome, 'projects-backup', machine.slug, `${SESSION}.jsonl`), edited);
  for (const named of [outside, otherSession, lookAlike]) {
    const read = [];
    const { lines } = await runHook(machine, hookInput(machine, { session_title: TITLE, transcript_path: named }), { readFile: recording(read) });
    assert.equal(read.includes(named), false, named);
    assert.ok(read.includes(own), `the session's own file is read instead, for ${named}`);
    assert.ok(lines.includes(`Feature document: ${path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')}  (branch feat/channel, in the worktree this session's last notice was written from)`), named);
  }
}));

test('a transcript the input names by a path that leaves the projects folder through `..` is not read', withMachine(async (machine) => {
  notified(machine);
  const edited = path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md').replaceAll('\\', '/');
  transcriptWith(machine, []);
  const outside = transcriptAt(path.join(machine.claudeHome, 'elsewhere', `${SESSION}.jsonl`), edited);
  // The string is given as the host would give it: the `..` segments are not normalized away before the hook sees them.
  const raw = `${machine.projectDir}${path.sep}..${path.sep}..${path.sep}elsewhere${path.sep}${SESSION}.jsonl`;
  const read = [];
  const { lines } = await runHook(machine, hookInput(machine, { session_title: TITLE, transcript_path: raw }), { readFile: recording(read) });
  assert.equal(read.includes(outside), false, 'the file the path resolves to is not read');
  assert.equal(read.includes(raw), false, 'nor is the path as it was given');
  assert.ok(lines.includes(`Feature document: ${path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')}  (branch feat/channel, in the worktree this session's last notice was written from)`));
}));

test('on win32 a path into the Claude home is compared without case: the folder named in capitals is the same folder', { skip: process.platform !== 'win32' }, withMachine(async (machine) => {
  notified(machine);
  const edited = path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md').replaceAll('\\', '/');
  const capitals = path.join(machine.claudeHome.toUpperCase(), 'projects', machine.slug, `${SESSION}.jsonl`);
  transcriptAt(path.join(machine.projectDir, `${SESSION}.jsonl`), edited);
  const read = [];
  const { lines } = await runHook(machine, hookInput(machine, { session_title: TITLE, transcript_path: capitals }), { readFile: recording(read) });
  assert.ok(read.includes(capitals), 'the transcript named in capitals is read');
  assert.ok(lines.includes(`Feature document: ${edited}  (branch feat/channel, the last feature document this session wrote, by its transcript)`));
}));

test('a transcript the hook cannot read is no stretch: its lines are left out, and the rest prints', withMachine(async (machine) => {
  notified(machine);
  const { code, lines, stderr } = await runHook(machine, hookInput(machine, { session_title: TITLE, transcript_path: machine.projectDir }));
  assert.deepEqual([code, stderr], [0, '']);
  assert.deepEqual(lines, [
    FIRST,
    `Session: "${TITLE}" (the title the host gave the hook)`,
    `Opening: none stored for that title (the openings of this project are in ${openingsDir(machine.home, machine.slug)})`,
    `Feature document: ${path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')}  (branch feat/channel, in the worktree this session's last notice was written from)`,
    ...PARTS,
    NOTIFY,
  ]);
}));

test('a harness home that cannot be read leaves the pause unknown, and the rest of the stretch prints', withMachine(async (machine) => {
  transcriptWith(machine, [editedAt(minute(1), path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md')), askedBoundary(2)]);
  const notHome = path.join(machine.dir, 'not-a-folder');
  fs.writeFileSync(notHome, 'made up');
  const env = { CLAUDE_CONFIG_DIR: machine.claudeHome, JS_HARNESS_HOME: notHome };
  const { code, lines, stderr } = await runHook(machine, hookInput(machine, { session_title: TITLE }), { env });
  assert.deepEqual([code, stderr], [0, '']);
  assert.ok(lines.includes(`  ${NOT_TOLD}`));
  assert.ok(lines.includes(`  Compaction: asked for by the user at ${minute(2)}, holding ${K(HELD)} tokens (line 3).`));
  assert.equal(lines.at(-1), NOTIFY);
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

test('the usage says a hook exits 0, or 2 for a usage error, which is what resumeMain returns', async () => {
  const err = [];
  const neverRun = () => {
    throw new Error('a usage error must not run or read anything');
  };
  const code = await resumeMain(['bogus'], { stdout: neverRun, stderr: (line) => err.push(line), run: neverRun, readStdin: neverRun, stdinIsTTY: false });
  assert.equal(code, 2);
  const usage = err.join('\n');
  assert.doesNotMatch(usage, /always exits 0/);
  assert.equal(usage.match(/exits 0, or 2 for a usage error/g)?.length, 2);
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
test('the status of a worktree gives its branch and its head; a detached head is no branch, and the first commit is not one yet', () => {
  const head = '2'.repeat(40);
  assert.deepEqual(parseStatus(`# branch.oid ${head}\0# branch.head main\0`), { branch: 'main', head, paths: [] });
  assert.equal(parseStatus(`# branch.oid ${head}\0# branch.head (detached)\0`).branch, 'no branch (detached)');
  assert.equal(parseStatus('# branch.oid (initial)\0# branch.head main\0').head, '(initial)');
});

test('a changed, a renamed, an unmerged and an untracked file are each one path, the old name of a rename is not, and a path may hold blanks', () => {
  const changed = `1 .M N... 100644 100644 100644 ${'3'.repeat(40)} ${'4'.repeat(40)} odd/tasks/my notes.md\0`;
  const renamed = `2 R. N... 100644 100644 100644 ${'5'.repeat(40)} ${'6'.repeat(40)} R100 odd/tasks/new name.md\0odd/tasks/old name.md\0`;
  const unmerged = `u UU N... 100644 100644 100644 100644 ${'7'.repeat(40)} ${'8'.repeat(40)} ${'9'.repeat(40)} odd/tasks/clash.md\0`;
  const untracked = '? odd/tasks/fresh file.md\0';
  const status = parseStatus(`# branch.oid ${'1'.repeat(40)}\0# branch.head main\0${changed}${renamed}${unmerged}${untracked}`);
  assert.deepEqual(status.paths, ['odd/tasks/my notes.md', 'odd/tasks/new name.md', 'odd/tasks/clash.md', 'odd/tasks/fresh file.md']);
});

test('the block says when the feature document was last written and last committed, after the pause and before the lines of who wrote', withMachine(async (machine) => {
  titled(machine);
  notified(machine);
  const document = path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md');
  const { lines } = await runHook(machine, hookInput(machine, { session_title: TITLE }));
  const pause = lines.indexOf(`  ${NOT_TOLD}`);
  assert.equal(lines[pause + 1], `  State: ${document} was last written at 2026-01-01T11:48:00.000Z (12m ago) and last committed at 2026-01-01T09:00:00.000Z (1111111).`);
}));

test('the block says what git says of the worktree of the feature document: its branch, its head and what is not committed, read without the index lock', withMachine(async (machine) => {
  titled(machine);
  notified(machine);
  const git = fakeGit(machine);
  const { lines, calls } = await runHook(machine, hookInput(machine, { session_title: TITLE }), { git });
  assert.equal(lines[lines.indexOf(`  ${STATE_OF(machine)}`) + 1], `  Worktree ${machine.worktree}: branch feat/channel, head 1111111, nothing changed and not committed.`);
  // The two calls that are new are the only ones that read a worktree's state: each takes no optional lock.
  const reads = calls.filter((call) => / (status|log) /.test(call));
  assert.equal(reads.length, 2, reads.join('\n'));
  assert.ok(reads.every((call) => call.startsWith('git --no-optional-locks -C ')), reads.join('\n'));
}));

test('the worktree line counts what is not committed and names its first five paths; a detached head is said so', withMachine(async (machine) => {
  titled(machine);
  notified(machine);
  const untracked = [1, 2, 3, 4, 5, 6].map((n) => `? odd/tasks/n${n}.md\0`).join('');
  const status = `# branch.oid ${'2'.repeat(40)}\0# branch.head (detached)\0${untracked}`;
  const worktree = (await runHook(machine, hookInput(machine, { session_title: TITLE }), { git: fakeGit(machine, { status }) })).lines.find((line) => line.startsWith('  Worktree '));
  assert.equal(worktree, `  Worktree ${machine.worktree}: branch no branch (detached), head 2222222, 6 files changed and not committed (odd/tasks/n1.md, odd/tasks/n2.md, odd/tasks/n3.md, odd/tasks/n4.md, odd/tasks/n5.md, …).`);
}));

test('a git that cannot say the state of the worktree is said as not read, with why: a failure, or a time limit', withMachine(async (machine) => {
  titled(machine);
  notified(machine);
  const worktree = async (git) => (await runHook(machine, hookInput(machine, { session_title: TITLE }), { git })).lines.find((line) => line.startsWith('  Worktree '));
  assert.equal(await worktree(fakeGit(machine, { failing: ['status'] })), `  Worktree ${machine.worktree}: its changes are not read (fatal: made up).`);
  const timedOut = fakeGit(machine);
  const run = (command, args, options) => (args.includes('status') ? { error: Object.assign(new Error('spawnSync git ETIMEDOUT'), { code: 'ETIMEDOUT' }), status: null, stdout: '', stderr: '' } : timedOut.run(command, args, options));
  assert.equal(await worktree({ run, calls: timedOut.calls }), `  Worktree ${machine.worktree}: its changes are not read (ETIMEDOUT).`);
}));

test('the state line says what the pause\'s notice of the stretch says of the times: written and committed after it, written before it, or in no commit, or no commit read', withMachine(async (machine) => {
  notified(machine);
  const transcript = path.join(machine.projectDir, `${SESSION}.jsonl`);
  transcriptWith(machine, [answered(2, 'past the pause', { input_tokens: PAUSED }), askedBoundary(4)]);
  // The notice is written at minute 2 of the stretch, as the pause writes it; the document was written 12 minutes before now.
  assert.notEqual(pauseNotice({ transcript, sessionId: SESSION, home: machine.home, now: () => Date.parse(minute(2)), tmpdir: path.join(machine.home, 'tmp') }), null);
  const document = DOCUMENT_OF(machine);
  const stateOf = async (git) => (await runHook(machine, hookInput(machine, { session_title: TITLE }), { git })).lines.find((line) => line.startsWith('  State: '));
  const written = `  State: ${document} was last written at 2026-01-01T11:48:00.000Z (12m ago)`;
  // Committed before the notice, and written after it: what is written is not committed.
  assert.equal(await stateOf(fakeGit(machine)), `${written} and last committed at 2026-01-01T09:00:00.000Z (1111111). It was written after the pause's notice and that is not committed.`);
  // Its time is after the notice and git says it holds what its commit holds (a checkout or a restore gives a file a new
  // time): the state is the commit's, from before the notice, and nothing is "not committed".
  assert.equal(await stateOf(fakeGit(machine, { fileStatus: '' })), `${written} and last committed at 2026-01-01T09:00:00.000Z (1111111). It holds what that commit holds, from before the pause's notice of ${minute(2)}: what it holds may be older than the work, so say so in your next reply to the user.`);
  // A git that cannot say whether the file differs from its commit: not known, and never "not committed".
  assert.equal(await stateOf(fakeGit(machine, { failing: ['status'] })), `${written} and last committed at 2026-01-01T09:00:00.000Z (1111111). It was written after the pause's notice, and whether that is committed is not read.`);
  // Committed after the notice too.
  assert.equal(await stateOf(fakeGit(machine, { commitTime: '2026-01-01T10:30:00+00:00' })), `${written} and last committed at 2026-01-01T10:30:00.000Z (1111111). Both are after the pause's notice.`);
  // In no commit yet, and no commit that git can say of.
  assert.equal(await stateOf(fakeGit(machine, { uncommitted: true })), `${written} and is in no commit yet. It was written after the pause's notice and that is not committed.`);
  assert.equal(await stateOf(fakeGit(machine, { failing: ['log'] })), `${written} and its commit is not read (fatal: made up). It was written after the pause's notice, and whether that is committed is not read.`);
  // Written before the notice: what it holds may be older than the work, and the reply is told so.
  writtenAt(document, 180);
  assert.equal(await stateOf(fakeGit(machine)), `  State: ${document} was last written at 2026-01-01T09:00:00.000Z (3h ago) and last committed at 2026-01-01T09:00:00.000Z (1111111). It was last written before the pause's notice of ${minute(2)}: what it holds may be older than the work, so say so in your next reply to the user.`);
}));

test('the state line gives the commit\'s time as ISO in UTC, whatever offset git gave it with; a time that does not parse is printed as git gave it', withMachine(async (machine) => {
  notified(machine);
  const transcript = path.join(machine.projectDir, `${SESSION}.jsonl`);
  transcriptWith(machine, [answered(2, 'past the pause', { input_tokens: PAUSED }), askedBoundary(4)]);
  assert.notEqual(pauseNotice({ transcript, sessionId: SESSION, home: machine.home, now: () => Date.parse(minute(2)), tmpdir: path.join(machine.home, 'tmp') }), null);
  const document = DOCUMENT_OF(machine);
  const stateOf = async (git) => (await runHook(machine, hookInput(machine, { session_title: TITLE }), { git })).lines.find((line) => line.startsWith('  State: '));
  const written = `  State: ${document} was last written at 2026-01-01T11:48:00.000Z (12m ago)`;
  // Five hours behind UTC, committed at 10:30 UTC: the same instant as the one a UTC offset would give, and after the notice.
  assert.equal(await stateOf(fakeGit(machine, { commitTime: '2026-01-01T05:30:00-05:00' })), `${written} and last committed at 2026-01-01T10:30:00.000Z (1111111). Both are after the pause's notice.`);
  // A time git gave that does not parse is printed as it was given, and nothing is taken from it.
  assert.equal(await stateOf(fakeGit(machine, { commitTime: 'made up' })), `${written} and last committed at made up (1111111). It was written after the pause's notice, and whether that is committed is not read.`);
}));

test('an orchestrator\'s state line is its relief file\'s: when it was written, and no commit, since a relief file is in no repository', withMachine(async (machine) => {
  titled(machine);
  const file = reliefPath(machine.home, machine.slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '- 10:00 a line of the relief\n');
  writtenAt(file, 30);
  const { lines } = await runHook(machine, hookInput(machine, { session_title: 'JH ORQ · the channel' }));
  assert.equal(lines.includes(`  State: ${file} was last written at 2026-01-01T11:30:00.000Z (30m ago).`), true, lines.join('\n'));
  assert.equal(lines.some((line) => line.startsWith('  Worktree ')), false, 'no worktree: the relief file has none');
}));

test('the block names the pieces of work the transcript leaves in flight when the session was compacted: a sub-agent and a background command with no end', withMachine(async (machine) => {
  notified(machine);
  transcriptWith(machine, [
    { type: 'assistant', timestamp: minute(1), message: { model: 'made-up-model', role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'toolu_agent', name: 'Agent', input: { description: 'Review the hook', subagent_type: 'general-purpose' } }] } },
    { type: 'assistant', timestamp: minute(2), message: { model: 'made-up-model', role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'toolu_bash', name: 'Bash', input: { command: 'npm test', description: 'Run the tests', run_in_background: true } }] } },
    askedBoundary(3),
  ]);
  const { lines } = await runHook(machine, hookInput(machine, { session_title: TITLE }));
  assert.deepEqual(lines.filter((line) => line.startsWith('  In flight')), ['  In flight when it was compacted, by the transcript: 2 (Agent (no id yet) (general-purpose) "Review the hook", Bash (no id yet) "Run the tests").']);
  // A timer left running after what it waited for resolved (his correction, 2026-10-14): each piece is judged now.
  const after = lines.findIndex((line) => line.startsWith('  In flight'));
  assert.equal(lines[after + 1], '  Each says in its description what it is for and what ends it. Stop now (TaskStop) one whose condition resolved another way, or that says neither; write what stays running, and who stops it, to this session\'s state.');
}));

test('the block says when a turn at the machine\'s gate is held from the worktree of the feature document, or waits from it; a gate of another folder says nothing', withMachine(async (machine) => {
  titled(machine);
  notified(machine);
  const gate = path.join(machine.home, '.js-harness', 'gate');
  const gateLines = async () => (await runHook(machine, hookInput(machine, { session_title: TITLE }))).lines.filter((line) => line.startsWith('  A turn at'));
  // The gate's lock is a folder with its holder's file in it: its `cwd` is the folder the gate checks.
  fs.mkdirSync(path.join(gate, 'lock'), { recursive: true });
  fs.writeFileSync(path.join(gate, 'lock', 'holder-4242-abcdef.json'), JSON.stringify({ cwd: machine.worktree, startedAt: '2026-01-01T11:50:00.000Z', pid: 4242 }));
  assert.deepEqual(await gateLines(), ['  A turn at the machine\'s gate is held from this worktree (since 2026-01-01T11:50:00.000Z): it may be this session\'s.']);
  fs.writeFileSync(path.join(gate, 'lock', 'holder-4242-abcdef.json'), JSON.stringify({ cwd: machine.root, startedAt: '2026-01-01T11:50:00.000Z', pid: 4242 }));
  assert.deepEqual(await gateLines(), [], 'held from the main checkout: not from this worktree');
  fs.rmSync(path.join(gate, 'lock'), { recursive: true });
  // A gate that waits is a folder of its own with its file in it, and its `cwd` is where it was started.
  fs.mkdirSync(path.join(gate, 'wait-4343-beef'), { recursive: true });
  fs.writeFileSync(path.join(gate, 'wait-4343-beef', 'holder-4343-beef.json'), JSON.stringify({ cwd: machine.worktree, waitingSince: '2026-01-01T11:55:00.000Z' }));
  assert.deepEqual(await gateLines(), ['  A turn at the machine\'s gate waits from this worktree.']);
}));

test('with no feature document the hook knows, or with several, the block says no state and no worktree of it', withMachine(async (machine) => {
  titled(machine);
  const stateLines = async (deps) => (await runHook(machine, hookInput(machine, { session_title: TITLE }), deps)).lines.filter((line) => /^ {2}(State: |Worktree )/.test(line));
  // No notice names a worktree: no document, so no line of one.
  assert.deepEqual(await stateLines(), []);
  notified(machine);
  assert.equal((await stateLines()).length, 2);
  // Two documents changed on the branch: this session works on one of them, and nothing is said of either.
  fs.writeFileSync(path.join(machine.worktree, 'odd', 'tasks', 'rule-hierarchy.md'), '# Rule hierarchy\n');
  assert.deepEqual(await stateLines({ git: fakeGit(machine, { plans: ['odd/tasks/session-channel.md', 'odd/tasks/rule-hierarchy.md'] }) }), []);
}));

test('a gate that cannot be read is no line and no failure: the block prints the rest', withMachine(async (machine) => {
  titled(machine);
  notified(machine);
  const broken = { holder: () => { throw Object.assign(new Error('made up'), { code: 'EIO' }); }, waiters: () => { throw Object.assign(new Error('made up'), { code: 'EIO' }); } };
  const { code, lines, stderr } = await runHook(machine, hookInput(machine, { session_title: TITLE }), { gate: broken });
  assert.deepEqual([code, stderr], [0, '']);
  assert.equal(lines.some((line) => line.startsWith('  A turn at') || line.includes('not read')), false);
  assert.ok(lines.includes(`  ${STATE_OF(machine)}`), 'the rest of the block is printed');
  assert.equal(lines.at(-1), NOTIFY);
}));

test('the three steps after the pause are each checked against the deadline before they start: a step that started is printed, one that did not is named', withMachine(async (machine) => {
  titled(machine);
  notified(machine);
  const later = (passedAt) => {
    const git = fakeGit(machine);
    const clock = { passed: false };
    const run = (command, args, options) => {
      if (args.includes(passedAt)) clock.passed = true;
      return git.run(command, args, options);
    };
    return runHook(machine, hookInput(machine, { session_title: TITLE }), { git: { run, calls: git.calls }, now: () => (clock.passed ? NOW + 10000 : NOW) });
  };
  // The deadline passes in the state's own `git log`: the state line is read, and the worktree, the flight and the reply are named.
  const atLog = (await later('log')).lines;
  assert.ok(atLog.includes(`  ${STATE_OF(machine)}`));
  assert.equal(atLog.at(-2), 'Not read before this hook\'s own deadline (9 s): the worktree\'s changes, the work in flight and the machine\'s gate, this session\'s last reply, the questions.');
  // It passes in the worktree's `git status`: the worktree line is read, and the flight and the reply are named.
  const atStatus = (await later('status')).lines;
  assert.ok(atStatus.includes(`  ${CLEAN_OF(machine)}`));
  assert.equal(atStatus.at(-2), 'Not read before this hook\'s own deadline (9 s): the work in flight and the machine\'s gate, this session\'s last reply, the questions.');
}));

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

// The window the host is configured with moves the pause (odd/tasks/session-channel.md, T6b): read from the
// environment, the project's settings or the user's, under the home the hook writes to.
const CONFIGURED = 350000;
const CONFIGURED_POINT = CONFIGURED - HOST_COMPACTION_RESERVE;
const CONFIGURED_PAUSED = Math.round((CONFIGURED_POINT * DEFAULT_CONTEXT_PAUSE_PERCENT) / DEFAULT_CONTEXT_COMPACTION_PERCENT) + 1000;

/** Writes `settings` as JSON into `file`, making its folder. */
function writeSettings(file, settings) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings));
}

test('a window the user settings configure tells the session at that window\'s pause, under the default one', withMachine(async (machine) => {
  assert.ok(CONFIGURED_PAUSED < PAUSED, 'the context is under the pause of the default window');
  const input = pauseInput(machine, CONFIGURED_PAUSED);
  assert.deepEqual((await runPause(machine, input)).lines, [], 'with nothing configured the default pause holds');
  writeSettings(path.join(machine.home, '.claude', 'settings.json'), { autoCompactWindow: CONFIGURED });
  const told = await runPause(machine, input);
  assert.equal(told.lines.length, 1);
  assert.match(JSON.parse(told.lines[0]).hookSpecificOutput.additionalContext, new RegExp(`^js-harness: this session holds ${percentOf(CONFIGURED_PAUSED, CONFIGURED)}% of its context window, and the host compacts it at about ${percentOf(CONFIGURED_POINT, CONFIGURED)}%: `));
}));

test('a window the project\'s local settings or the environment configure moves the pause too', withMachine(async (machine) => {
  writeSettings(path.join(machine.root, '.claude', 'settings.local.json'), { autoCompactWindow: CONFIGURED });
  assert.equal((await runPause(machine, pauseInput(machine, CONFIGURED_PAUSED))).lines.length, 1);
  const other = await runPause(machine, pauseInput(machine, CONFIGURED_PAUSED, { id: SECOND }), { env: { JS_HARNESS_HOME: machine.home, CLAUDE_CODE_AUTO_COMPACT_WINDOW: String(CONFIGURED) } });
  assert.equal(other.lines.length, 1);
  fs.rmSync(path.join(machine.root, '.claude'), { recursive: true });
  assert.equal((await runPause(machine, pauseInput(machine, CONFIGURED_PAUSED, { id: THIRD }), { env: { JS_HARNESS_HOME: machine.home, CLAUDE_CODE_AUTO_COMPACT_WINDOW: String(CONFIGURED) } })).lines.length, 1, 'the environment alone');
}));

// The channel's inbox rides on the same hook: a note to this session reaches it after its next tool call, once.
/** `pauseInput`, with the session titled `title` at the end of its transcript. */
function titledPauseInput(machine, tokens, title) {
  const input = pauseInput(machine, tokens);
  const { transcript_path: transcript } = JSON.parse(input);
  fs.appendFileSync(transcript, `${JSON.stringify({ type: 'custom-title', customTitle: title, sessionId: SESSION })}\n`);
  return input;
}

const noteTo = (machine, to, text) => appendNotice(machine.home, projectSlug(machine.root), newNotice({
  at: new Date(Date.now() - 60000).toISOString(), from: { host: 'claude', id: SECOND, title: 'JH ORQ · proj' }, to, kind: 'note', text,
}));

test('a note to this session in the channel is said once by the hook, under the pause too', withMachine(async (machine) => {
  noteTo(machine, '5', 'take the inbox next');
  noteTo(machine, '7', 'not for this session');
  const input = titledPauseInput(machine, UNDER, 'JH 5 · canal entre sesiones');
  const first = await runPause(machine, input);
  assert.deepEqual([first.code, first.stderr, first.lines.length], [0, '', 1]);
  const said = JSON.parse(first.lines[0]).hookSpecificOutput;
  assert.equal(said.hookEventName, 'PostToolUse');
  assert.match(said.additionalContext, /^js-harness: 1 notice for this session in the channel since it last looked/);
  assert.match(said.additionalContext, /note from "JH ORQ · proj": take the inbox next$/);
  assert.ok(!said.additionalContext.includes('not for this session'));
  assert.deepEqual((await runPause(machine, input)).lines, [], 'said once');
}));

// D5 of odd/tasks/memory-hygiene.md: a memory hygiene pass that is due is said on this hook, which a model reads (a
// SessionStart systemMessage reaches only the person), once a day for the project, whichever session calls first.
test('a memory hygiene pass that is due is said once a day by the hook', withMachine(async (machine) => {
  const memory = path.join(machine.home, '.claude', 'projects', projectSlug(machine.root), 'memory');
  fs.mkdirSync(memory, { recursive: true });
  fs.writeFileSync(path.join(memory, 'MEMORY.md'), `- [A](a.md) — ${'x'.repeat(200)}\n`);
  fs.writeFileSync(path.join(memory, 'a.md'), '---\nmetadata:\n  type: user\n---\n\nfact\n');
  const input = pauseInput(machine, UNDER);
  const first = await runPause(machine, input);
  assert.equal(first.lines.length, 1);
  const context = JSON.parse(first.lines[0]).hookSpecificOutput.additionalContext;
  assert.match(context, /^js-harness: a memory hygiene pass is due for this project \(no-pass, line-chars\)/);
  assert.match(context, /js-harness memory status/);
  assert.deepEqual((await runPause(machine, input)).lines, [], 'said once that day');
}));

// C-c-3 of odd/tasks/launch-audit/c.md: with CLAUDE_CONFIG_DIR set, the host's memory is under that folder, and the notice
// must find it there; the pass is dated by the hook's own clock, as the pause's notice is.
test('the memory hygiene notice finds the folder under CLAUDE_CONFIG_DIR when the host sets it', withMachine(async (machine) => {
  const memory = path.join(machine.projectDir, 'memory');
  fs.mkdirSync(memory, { recursive: true });
  fs.writeFileSync(path.join(memory, 'MEMORY.md'), `- [A](a.md) — ${'x'.repeat(200)}\n`);
  fs.writeFileSync(path.join(memory, 'a.md'), '---\nmetadata:\n  type: user\n---\n\nfact\n');
  const env = { JS_HARNESS_HOME: machine.home, CLAUDE_CONFIG_DIR: machine.claudeHome };
  const input = pauseInput(machine, UNDER);
  const context = JSON.parse((await runPause(machine, input, { env })).lines[0]).hookSpecificOutput.additionalContext;
  assert.match(context, /^js-harness: a memory hygiene pass is due for this project \(no-pass, line-chars\)/);
}));

test('the memory hygiene notice dates a pass told an hour before the hook\'s clock as told that day, not by the machine\'s clock', withMachine(async (machine) => {
  const memory = path.join(machine.home, '.claude', 'projects', machine.slug, 'memory');
  fs.mkdirSync(memory, { recursive: true });
  fs.writeFileSync(path.join(memory, 'MEMORY.md'), `- [A](a.md) — ${'x'.repeat(200)}\n`);
  fs.writeFileSync(path.join(memory, 'a.md'), '---\nmetadata:\n  type: user\n---\n\nfact\n');
  const told = path.join(machine.home, '.js-harness', 'memory-hygiene', machine.slug, 'told');
  fs.mkdirSync(path.dirname(told), { recursive: true });
  fs.writeFileSync(told, `${new Date(NOW - 60 * 60 * 1000).toISOString()}\n`);
  assert.deepEqual((await runPause(machine, pauseInput(machine, UNDER), { now: () => NOW })).lines, [], 'told an hour before the hook\'s clock: not due again');
  // The positive twin, in the same setup: the same pass told a day and more before the clock is due again, and is said.
  fs.writeFileSync(told, `${new Date(NOW - 25 * 60 * 60 * 1000).toISOString()}\n`);
  const said = await runPause(machine, pauseInput(machine, UNDER), { now: () => NOW });
  assert.equal(said.lines.length, 1, 'told a day and more before the clock: due again, and said');
  assert.match(JSON.parse(said.lines[0]).hookSpecificOutput.additionalContext, /^js-harness: a memory hygiene pass is due for this project \(no-pass, line-chars\)/);
}));

test('past the pause with a note waiting, the hook says both in one line: the pause first, then the note', withMachine(async (machine) => {
  noteTo(machine, '5', 'both at once');
  const first = await runPause(machine, titledPauseInput(machine, PAUSED, 'JH 5 · canal entre sesiones'));
  assert.equal(first.lines.length, 1);
  const context = JSON.parse(first.lines[0]).hookSpecificOutput.additionalContext;
  assert.match(context, /^js-harness: this session holds /);
  assert.match(context, /\n\njs-harness: 1 notice for this session in the channel[^]*both at once$/);
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

// The web notice (odd/tasks/web-fetch-fallback.md, T2): the tool's answer as Claude Code hands it to a PostToolUse
// hook, the shape its transcripts keep as `toolUseResult` (measured on 2026-10-15).
const NPM = 'https://www.npmjs.com/package/react';
const webFetchOf = (code, codeText, url = NPM) => ({
  tool_name: 'WebFetch',
  tool_input: { url, prompt: 'Return the latest version shown.' },
  tool_response: { bytes: 0, code, codeText, result: `The server returned HTTP ${code} ${codeText}.`, durationMs: 616, url },
});
const WEB_NOTICE = (code, codeText, url = NPM) =>
  `js-harness: WebFetch got HTTP ${code} ${codeText} from ${url}, the answer a site gives AI traffic. Next rung: js-harness fetch '${url}' reads it through r.jina.ai (a public page only: it sends no cookie and no key); if that says blocked, open it in the built-in browser and read it with get_page_text.`;
const webContext = (lines) => (lines.length === 1 ? JSON.parse(lines[0]).hookSpecificOutput.additionalContext : lines);

test('a WebFetch the site refused as AI traffic gets the notice of the next rung, once per call, under the pause', withMachine(async (machine) => {
  const blocked = await runPause(machine, pauseInput(machine, UNDER, webFetchOf(403, 'Forbidden')));
  assert.deepEqual([blocked.code, blocked.stderr, blocked.calls], [0, '', []]);
  assert.equal(blocked.lines.length, 1);
  assert.equal(JSON.parse(blocked.lines[0]).hookSpecificOutput.hookEventName, 'PostToolUse');
  assert.equal(webContext(blocked.lines), WEB_NOTICE(403, 'Forbidden'));
  // Each refused call is told: the next page is another rung's work.
  assert.equal(webContext((await runPause(machine, pauseInput(machine, UNDER, webFetchOf(403, 'Forbidden')))).lines), WEB_NOTICE(403, 'Forbidden'));
  for (const [code, text] of [[402, 'Payment Required'], [429, 'Too Many Requests'], [503, 'Service Unavailable']]) {
    assert.equal(webContext((await runPause(machine, pauseInput(machine, UNDER, webFetchOf(code, text)))).lines), WEB_NOTICE(code, text), String(code));
  }
}));

test('the suggested command quotes the URL, so a shell keeps its & and its spaces; a quote in it is percent-encoded', withMachine(async (machine) => {
  const url = "https://example.com/search?q=a&page=2&who=o'brien";
  const said = webContext((await runPause(machine, pauseInput(machine, UNDER, webFetchOf(403, 'Forbidden', url)))).lines);
  assert.ok(said.includes("Next rung: js-harness fetch 'https://example.com/search?q=a&page=2&who=o%27brien' reads it"), said);
}));

test('a WebFetch that read its page, one the site says is not there, a redirect and another tool get no web notice', withMachine(async (machine) => {
  for (const [code, text] of [[200, 'OK'], [404, 'Not Found'], [301, 'Moved Permanently'], [401, 'Unauthorized']]) {
    assert.deepEqual((await runPause(machine, pauseInput(machine, UNDER, webFetchOf(code, text)))).lines, [], String(code));
  }
  const bash = { ...webFetchOf(403, 'Forbidden'), tool_name: 'Bash' };
  assert.deepEqual((await runPause(machine, pauseInput(machine, UNDER, bash))).lines, []);
  const noResponse = { ...webFetchOf(403, 'Forbidden'), tool_response: 'The server returned HTTP 403 Forbidden.' };
  assert.deepEqual((await runPause(machine, pauseInput(machine, UNDER, noResponse))).lines, []);
}));

test('a sub-agent\'s refused WebFetch is told the next rung too, and a call with no harness.json above it is not', withMachine(async (machine) => {
  const sub = await runPause(machine, pauseInput(machine, PAUSED, { agent_id: 'made-up-agent', ...webFetchOf(403, 'Forbidden') }));
  assert.equal(webContext(sub.lines), WEB_NOTICE(403, 'Forbidden'), 'the web notice alone: the pause stays the session\'s own');
  const outside = path.join(machine.dir, 'elsewhere');
  fs.mkdirSync(outside);
  assert.deepEqual((await runPause(machine, pauseInput(machine, UNDER, { cwd: outside, ...webFetchOf(403, 'Forbidden') }))).lines, []);
}));

// T4 of odd/tasks/web-fetch-fallback.md: a WebFetch that fails as a tool error reaches no PostToolUse hook, only the
// `PostToolUseFailure` entry `install` writes on WebFetch, which runs the same command. Its input carries `error`
// and `is_interrupt` in place of `tool_response` (Claude Code's hooks reference, read on 2026-10-16); the error is
// the one measured on reddit.com and stackoverflow.com.
const REDDIT = 'https://www.reddit.com/r/ClaudeAI/';
const webFailureOf = (url = REDDIT, error = 'Claude Code is unable to fetch from www.reddit.com', more = {}) => ({
  hook_event_name: 'PostToolUseFailure',
  tool_name: 'WebFetch',
  tool_input: { url, prompt: 'Summarize the posts.' },
  tool_use_id: 'toolu_made_up',
  error,
  is_interrupt: false,
  ...more,
});
const FAILURE_NOTICE = (url = REDDIT, error = 'Claude Code is unable to fetch from www.reddit.com') =>
  `js-harness: WebFetch failed on ${url} (${error}). Next rung: js-harness fetch '${url}' reads it through r.jina.ai (a public page only: it sends no cookie and no key); if that says blocked, open it in the built-in browser and read it with get_page_text.`;

test('a WebFetch that failed as a tool error gets the notice of the next rung, answered under PostToolUseFailure', withMachine(async (machine) => {
  const failed = await runPause(machine, pauseInput(machine, UNDER, webFailureOf()));
  assert.deepEqual([failed.code, failed.stderr, failed.calls, failed.lines.length], [0, '', [], 1]);
  assert.equal(JSON.parse(failed.lines[0]).hookSpecificOutput.hookEventName, 'PostToolUseFailure');
  assert.equal(webContext(failed.lines), FAILURE_NOTICE());
  // A sub-agent's failed call is told too, as a refused one is.
  const sub = await runPause(machine, pauseInput(machine, PAUSED, { agent_id: 'made-up-agent', ...webFailureOf() }));
  assert.equal(webContext(sub.lines), FAILURE_NOTICE());
}));

test('the failure notice takes the first line of the error, cut at 200 characters, and quotes the URL for a shell', withMachine(async (machine) => {
  const url = "https://example.com/a?b=1&c=o'brien";
  const long = `${'x'.repeat(250)}\nsecond line`;
  const said = webContext((await runPause(machine, pauseInput(machine, UNDER, webFailureOf(url, long)))).lines);
  assert.ok(said.startsWith(`js-harness: WebFetch failed on ${url} (${'x'.repeat(199)}…). Next rung: js-harness fetch 'https://example.com/a?b=1&c=o%27brien' reads it`), said);
}));

test('the cut counts characters, not UTF-16 units, so it never splits one in two (gentle-ai review, R3-001)', withMachine(async (machine) => {
  // 198 letters, then an emoji (two UTF-16 units) as character 199: a cut by units would keep half of it.
  const error = `${'x'.repeat(198)}😀${'y'.repeat(10)}`;
  const said = webContext((await runPause(machine, pauseInput(machine, UNDER, webFailureOf(REDDIT, error)))).lines);
  assert.ok(said.includes(`(${'x'.repeat(198)}😀…)`), said);
  assert.equal(said.isWellFormed(), true);
}));

test('an interrupted WebFetch, another tool\'s failure and a failure with no URL or no error get no web notice', withMachine(async (machine) => {
  const cases = [
    webFailureOf(REDDIT, 'Claude Code is unable to fetch from www.reddit.com', { is_interrupt: true }),
    { ...webFailureOf(), tool_name: 'Bash', tool_input: { command: 'curl https://www.reddit.com/' } },
    { ...webFailureOf(), tool_input: { prompt: 'no url' } },
    { ...webFailureOf(), error: '' },
    { ...webFailureOf(), error: 7 },
  ];
  for (const input of cases) {
    assert.deepEqual((await runPause(machine, pauseInput(machine, UNDER, input))).lines, [], JSON.stringify(input));
  }
}));

test('past the pause a refused WebFetch gets both notices in one line, the web notice first', withMachine(async (machine) => {
  const both = webContext((await runPause(machine, pauseInput(machine, PAUSED, webFetchOf(402, 'Payment Required', 'https://x.com/AnthropicAI')))).lines);
  assert.ok(both.startsWith(`${WEB_NOTICE(402, 'Payment Required', 'https://x.com/AnthropicAI')}\n\njs-harness: this session holds `), both);
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

test('a record that holds no question prints no line of questions, for an orchestrator and for a work session', withMachine(async (machine) => {
  titled(machine);
  notified(machine);
  assert.equal(questionLinesOf((await runHook(machine, hookInput(machine))).lines), null);
  assert.equal(questionLinesOf((await runHook(machine, hookInput(machine, { session_title: ORQ }))).lines), null);
}));

test('a record that could not be read is said in one line, with its path and the reason, for an orchestrator and for a work session', withMachine(async (machine) => {
  titled(machine);
  const file = RECORD_PATH(machine);
  const denied = (asked) => {
    if (asked === file) throw Object.assign(new Error('made up'), { code: 'EACCES' });
    return fs.readFileSync(asked, 'utf8');
  };
  const said = [`Questions: not read (the channel's record ${file} could not be read: EACCES)`];
  assert.deepEqual(questionLinesOf((await runHook(machine, hookInput(machine), { readFile: denied })).lines), said);
  assert.deepEqual(questionLinesOf((await runHook(machine, hookInput(machine, { session_title: ORQ }), { readFile: denied })).lines), said);
}));

test('an orchestrator is given every question no notice closed, each with what its transcript holds of it: no call, pending, closed, unanswered and answered', withMachine(async (machine) => {
  askQuestion(machine, 'Which branch?', { from: BY_OTHER });
  askQuestion(machine, 'Merge now?');
  askQuestion(machine, 'Ship it?');
  askQuestion(machine, 'Closed by an answer?');
  askQuestion(machine, 'Withdrawn?');
  askQuestion(machine, 'Dismissed?');
  askQuestion(machine, 'Unanswered?');
  answerTo(machine, 4, { line: 9 });
  withdraw(machine, 5, 'no longer needed');
  transcriptWith(machine, [
    askedAt(1, 'toolu_1', 'Pregunta 1: Which branch?'),
    askedAt(2, 'toolu_2', 'Pregunta 2: Merge now?'),
    resultAt(3, 'toolu_2', 'Pregunta 2: Merge now?', 'Yes (Recommended)'),
    askedAt(4, 'toolu_6', 'Pregunta 6: Dismissed?'),
    resultAt(5, 'toolu_6', 'Pregunta 6: Dismissed?', DISMISSED),
    askedAt(6, 'toolu_7', 'Pregunta 7: Unanswered?'),
    resultAt(7, 'toolu_7', 'Pregunta 7: Unanswered?', undefined),
  ]);
  const { lines } = await runHook(machine, hookInput(machine, { session_title: ORQ }));
  // Closed by a notice (4 and 5) they are not listed; the five open ones are, oldest number first, and the answer's line is the result's.
  // His newest words here are the answer he tapped at line 4 (minute 3, an hour and 57 minutes before the clock), and the five that wait are said.
  assert.deepEqual(questionLinesOf(lines), [
    'Questions with no answer in the record (5 of 7 recorded), with what this transcript holds of each:',
    '  Pregunta 1  recorded 2h ago by session bbbbbbbb  waits: the board  Which branch?',
    '    asked at line 2 of this transcript, with no answer in it: it may be on the user\'s screen; look (js-harness sessions) before asking again',
    '  Pregunta 2  recorded 2h ago by "JH 5 · the channel"  waits: the board  Merge now?',
    `    the user ANSWERED it at line 4 of this transcript: do not ask it again. Read it: js-harness sessions --quote ${SESSION} 4  Then record it: js-harness notify --to 5 --kind answer --question 2 --transcript ${SESSION} --line 4 "<the user's answer in one line>"`,
    '  Pregunta 3  recorded 2h ago by "JH 5 · the channel"  waits: the board  Ship it?',
    `    not asked in this transcript: look first (js-harness sessions), since another session may have asked it and had the user's answer; if it is open there: ${KNOWN_WHEN('1h 57m', 5)}. Its text is headed by "Pregunta 3: "`,
    '  Pregunta 6  recorded 2h ago by "JH 5 · the channel"  waits: the board  Dismissed?',
    `    the user closed it without answering (asked at line 5): ask it again: ${KNOWN_WHEN('1h 57m', 5)}`,
    '  Pregunta 7  recorded 2h ago by "JH 5 · the channel"  waits: the board  Unanswered?',
    `    asked at line 7, and its result is no answer of the user's: ask it again: ${KNOWN_WHEN('1h 57m', 5)}`,
    'The board lists the questions of every session: js-harness sessions',
  ]);
}));

test('an orchestrator told that a question has no call here is sent to look on the board first, since another session may have had his answer', withMachine(async (machine) => {
  askQuestion(machine, 'Asked elsewhere?', { from: BY_OTHER });
  // His words at minute 1 (an hour and 59 minutes before the clock) are the last of this transcript; the question has no call in it.
  transcriptWith(machine, [asked(1, 'the stretch')]);
  const { lines } = await runHook(machine, hookInput(machine, { session_title: ORQ }));
  assert.deepEqual(questionLinesOf(lines), [
    'Questions with no answer in the record (1 of 1 recorded), with what this transcript holds of each:',
    '  Pregunta 1  recorded 2h ago by session bbbbbbbb  waits: the board  Asked elsewhere?',
    `    not asked in this transcript: look first (js-harness sessions), since another session may have asked it and had the user's answer; if it is open there: ${KNOWN_WHEN('1h 59m', 1)}. Its text is headed by "Pregunta 1: "`,
    'The board lists the questions of every session: js-harness sessions',
  ]);
}));

test('an orchestrator is told an answer in a transcript outside this project\'s sessions folder is recorded from its line as unverified, with no quote command', withMachine(async (machine) => {
  askQuestion(machine, 'Which branch?');
  // A transcript of the same session filed under another project: `sessions --quote` cannot read it from this project's folder.
  const other = path.join(machine.claudeHome, 'projects', 'other-project', `${SESSION}.jsonl`);
  fs.mkdirSync(path.dirname(other), { recursive: true });
  fs.writeFileSync(other, [{ type: 'custom-title', customTitle: TITLE, sessionId: SESSION }, askedAt(1, 'toolu_1', 'Pregunta 1: Which branch?'), resultAt(2, 'toolu_1', 'Pregunta 1: Which branch?', 'Yes (Recommended)')].map((entry) => `${JSON.stringify(entry)}\n`).join(''));
  const { lines } = await runHook(machine, hookInput(machine, { session_title: ORQ, transcript_path: other }));
  // The answer is the result at line 3: the title is line 1 and the call at line 2.
  assert.deepEqual(questionLinesOf(lines), [
    'Questions with no answer in the record (1 of 1 recorded), with what this transcript holds of each:',
    '  Pregunta 1  recorded 2h ago by "JH 5 · the channel"  waits: the board  Which branch?',
    `    the user ANSWERED it at line 3 of this transcript: do not ask it again. This transcript is not in this project's sessions folder, so the harness cannot read that line: record it as the sender's claim with js-harness notify --to 5 --kind answer --question 1 --transcript outside-the-project-folder --line 3 "<the user's answer in one line>", which keeps it unverified`,
    'The board lists the questions of every session: js-harness sessions',
  ]);
  assert.equal(lines.some((line) => line.includes(`--quote ${SESSION}`)), false, lines.join('\n'));
  // The name of the transcript is no session id, so `notify` never checks the answer against a local transcript of this session.
  assert.equal(lines.some((line) => line.includes(`--transcript ${SESSION}`)), false, lines.join('\n'));
}));

test('a work session is given the questions it recorded itself: its open ones with what its transcript holds, its last closed ones in one line each, and no others', withMachine(async (machine) => {
  titled(machine);
  askQuestion(machine, 'Own?');
  askQuestion(machine, 'Not mine?', { from: BY_OTHER });
  askQuestion(machine, 'Closed by a verified answer?');
  askQuestion(machine, 'Closed by a claim?');
  askQuestion(machine, 'Withdrawn?');
  answerTo(machine, 3, { line: 9, answer: 'No' });
  answerTo(machine, 4, { line: 10, verified: false, text: 'Yes, made up' });
  withdraw(machine, 5, 'no longer needed');
  const { lines } = await runHook(machine, hookInput(machine));
  assert.deepEqual(questionLinesOf(lines), [
    'Questions this session recorded (4):',
    '  Pregunta 1  recorded 2h ago by "JH 5 · the channel"  waits: the board  Own?',
    '    recorded, no answer yet: the orchestrator shows it to the user; go on with what does not wait on it (js-harness sessions lists it)',
    `  Pregunta 3  ANSWERED, read at ${SESSION}:9: No`,
    `  Pregunta 4  answered by the claim of "JH 5 · the channel", NOT VERIFIED (${SESSION}:10): Yes, made up`,
    '  Pregunta 5  withdrawn by "JH 5 · the channel": no longer needed',
    'The board lists the questions of every session: js-harness sessions',
  ]);
}));

test('a work session is given none of the questions another session recorded, and an orchestrator is given them', withMachine(async (machine) => {
  titled(machine);
  askQuestion(machine, 'Not mine?', { from: BY_OTHER });
  assert.equal(questionLinesOf((await runHook(machine, hookInput(machine))).lines), null);
  assert.deepEqual(questionLinesOf((await runHook(machine, hookInput(machine, { session_title: ORQ }))).lines), [
    'Questions with no answer in the record (1 of 1 recorded), with what this transcript holds of each:',
    '  Pregunta 1  recorded 2h ago by session bbbbbbbb  waits: the board  Not mine?',
    `    not asked in this transcript: look first (js-harness sessions), since another session may have asked it and had the user's answer; if it is open there: ${UNKNOWN_WHEN(1)}. Its text is headed by "Pregunta 1: "`,
    'The board lists the questions of every session: js-harness sessions',
  ]);
}));

test('a work session\'s closed questions are its last five by number, and the earlier ones are a count with the record\'s path', withMachine(async (machine) => {
  titled(machine);
  for (let number = 1; number <= 7; number++) askQuestion(machine, `Question ${number}?`);
  for (let number = 1; number <= 7; number++) withdraw(machine, number, `reason ${number}`);
  const { lines } = await runHook(machine, hookInput(machine));
  assert.deepEqual(questionLinesOf(lines), [
    'Questions this session recorded (7):',
    ...[3, 4, 5, 6, 7].map((number) => `  Pregunta ${number}  withdrawn by "JH 5 · the channel": reason ${number}`),
    `  2 earlier ones are in the record: ${RECORD_PATH(machine)}`,
    'The board lists the questions of every session: js-harness sessions',
  ]);
}));

test('with no transcript read, a question with no call is not said to be unasked: the hook says to look before asking', withMachine(async (machine) => {
  titled(machine);
  askQuestion(machine, 'Asked already?', { from: BY_OTHER });
  // The sessions folder cannot be read; the record, under the harness home, can.
  const busy = (file) => {
    if (path.resolve(file).startsWith(path.resolve(machine.projectDir))) throw Object.assign(new Error('busy'), { code: 'EBUSY' });
    return fs.readFileSync(file, 'utf8');
  };
  const { lines } = await runHook(machine, hookInput(machine, { session_title: ORQ }), { readFile: busy });
  assert.deepEqual(questionLinesOf(lines), [
    'Questions with no answer in the record (1 of 1 recorded), with what this transcript holds of each:',
    '  Pregunta 1  recorded 2h ago by session bbbbbbbb  waits: the board  Asked already?',
    '    this session\'s transcript was not read, so it is not known whether it was asked or answered here: look (js-harness sessions) before asking',
    'The board lists the questions of every session: js-harness sessions',
  ]);
}));

test('an orchestrator whose record has no question open is told how many questions it holds, in one line', withMachine(async (machine) => {
  titled(machine);
  askQuestion(machine, 'Done?');
  askQuestion(machine, 'Also done?');
  withdraw(machine, 1, 'no longer needed');
  answerTo(machine, 2, { line: 4 });
  assert.deepEqual(questionLinesOf((await runHook(machine, hookInput(machine, { session_title: ORQ }))).lines), ['Questions: the record holds 2, none open.']);
}));

test('past the hook\'s own deadline no line of the questions is printed, and they are named among the lines not read', withMachine(async (machine) => {
  titled(machine);
  askQuestion(machine, 'Own?');
  // The first read is the start of the hook; every read after it is past the nine seconds of its deadline.
  let reads = 0;
  const late = await runHook(machine, hookInput(machine), { now: () => (reads++ === 0 ? NOW : NOW + 9000) });
  assert.equal(questionLinesOf(late.lines), null, late.lines.join('\n'));
  assert.equal(late.lines.at(-2).endsWith(', the questions.'), true, late.lines.join('\n'));
  // In time, the same record is given its four lines.
  assert.equal(questionLinesOf((await runHook(machine, hookInput(machine))).lines).length, 4);
}));

test('after the feature document the hook names the mode its next open task calls for, for the session to tell the person', withMachine(async (machine) => {
  const doc = path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md');
  fs.writeFileSync(doc, '# Session channel\n\n- [x] T5 (kind: design) Done\n- [ ] T6 (kind: build) The resume hook\n\n## Next step\nT6.\n');
  notified(machine);
  const modeOf = async (more = {}) => (await runHook(machine, hookInput(machine, { session_title: TITLE, ...more }))).lines.filter((line) => line.startsWith('Mode of the next open task'));
  // A project that declares no rules: the line says so.
  assert.deepEqual(await modeOf(), ['Mode of the next open task: T6 (kind: build): no effort or model declared in this project. Tell the person: only they set the session\'s effort.']);
  // A project whose rules are this copy's: the effort and the models.
  fs.mkdirSync(path.join(machine.worktree, 'bin', 'lib'), { recursive: true });
  fs.copyFileSync(new URL('./lib/rules-data.mjs', import.meta.url), path.join(machine.worktree, 'bin', 'lib', 'rules-data.mjs'));
  assert.deepEqual(await modeOf(), ['Mode of the next open task: T6 (kind: build): session high; writers haiku, readers opus; every sub-agent at high. Tell the person: only they set the session\'s effort.']);
  // On Codex the models of the table are Claude's: the kind only.
  const codex = path.join(machine.home, '.codex', 'sessions', `${SESSION}.jsonl`);
  assert.deepEqual(await modeOf({ transcript_path: codex }), ['Mode of the next open task: T6 (kind: build); effort and models are not declared for Codex']);
  // No open task, or a next open task that names no kind: no line.
  fs.writeFileSync(doc, '# Session channel\n\n- [x] T6 (kind: build) The resume hook\n');
  assert.deepEqual(await modeOf(), []);
  fs.writeFileSync(doc, '# Session channel\n\n- [ ] T6 The resume hook\n- [ ] T7 (kind: build) Later\n');
  assert.deepEqual(await modeOf(), []);
}));

test('the hook names the parts of the one feature document, the task its Next step names first, and the mode of that task', withMachine(async (machine) => {
  const doc = path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md');
  // Shaped like odd/tasks/session-channel.md at 64933f6: its first unchecked task, T2, is stale.
  fs.writeFileSync(doc, [
    '# Session channel', '',
    '## Specs', '- S1. The hook names parts.', '',
    '## Tasks', '- [ ] T2 (kind: design) Stale (S1)', '- [ ] T6b (kind: build) The resume hook (S1)', '',
    '## Progress', '- 2026-01-01, T6b. Started.', '',
    '## Next step', 'T6b first, then T2.', '',
  ].join('\n'));
  notified(machine);
  const { lines } = await runHook(machine, hookInput(machine, { session_title: TITLE }));
  const at = lines.findIndex((line) => line.startsWith('Feature document: '));
  assert.deepEqual(lines.slice(at + 1, at + 8), [
    'Read these parts of it (14 lines in all), not the whole file:',
    '  "Next step": lines 13-14 (2 lines)',
    '  the task T6b: line 8 (1 line)',
    '  its spec S1: line 4 (1 line)',
    '  its last log entry: line 11 (1 line)',
    PARTS_TRUST,
    'Mode of the next open task: T6b (kind: build): no effort or model declared in this project. Tell the person: only they set the session\'s effort.',
  ], lines.join('\n'));
}));

test('a feature document that gives no part keeps today\'s line, and one that cannot be read does too', withMachine(async (machine) => {
  const doc = path.join(machine.worktree, 'odd', 'tasks', 'session-channel.md');
  fs.writeFileSync(doc, '# Session channel\n\nNotes, and no task.\n');
  notified(machine);
  const after = async (deps) => {
    const { lines } = await runHook(machine, hookInput(machine, { session_title: TITLE }), deps);
    return lines[lines.findIndex((line) => line.startsWith('Feature document: ')) + 1];
  };
  assert.equal(await after(), READ);
  const unreadable = (file) => {
    if (String(file) === doc) throw Object.assign(new Error('EACCES: denied'), { code: 'EACCES' });
    return fs.readFileSync(file, 'utf8');
  };
  assert.equal(await after({ readFile: unreadable }), READ);
}));

test('every tool call in a harness project records the gentle-ai reviews live in its store, a sub-agent\'s too, and says nothing of it', withMachine(async (machine) => {
  const v2 = path.join(machine.root, '.git', 'gentle-ai', 'review-transactions', 'v2');
  fs.mkdirSync(path.join(v2, 'review-aaa'), { recursive: true });
  fs.writeFileSync(path.join(v2, 'LOCK'), '');
  const starts = path.join(machine.home, '.js-harness', 'throughput', machine.slug, 'review-starts.jsonl');
  const sub = await runPause(machine, JSON.stringify({ session_id: SESSION, agent_id: 'agent-1', cwd: machine.root, hook_event_name: 'PostToolUse' }));
  assert.deepEqual([sub.code, sub.lines], [0, []]);
  assert.deepEqual(fs.readFileSync(starts, 'utf8').trim().split('\n').map((line) => JSON.parse(line).lineage), ['review-aaa']);
  // A store that cannot be read leaves the session's own notices as they are.
  const denied = { ...fs, readdirSync: () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); } };
  const own = await runPause(machine, pauseInput(machine, PAUSED), { fileSystem: denied });
  assert.equal(own.code, 0);
  assert.equal(own.lines.length, 1);
  // A folder with no harness.json above it is not a harness project: nothing is recorded for it.
  const outside = path.join(machine.dir, 'other');
  fs.mkdirSync(path.join(outside, '.git', 'gentle-ai', 'review-transactions', 'v2', 'review-bbb'), { recursive: true });
  await runPause(machine, JSON.stringify({ session_id: SESSION, agent_id: 'agent-1', cwd: outside, hook_event_name: 'PostToolUse' }));
  assert.equal(fs.existsSync(path.join(machine.home, '.js-harness', 'throughput', projectSlug(outside))), false);
}));

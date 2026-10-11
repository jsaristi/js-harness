import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as channel from './channel.mjs';

// Every test writes under a home of its own in the temp folder: nothing here reads or writes the real
// home, and the transcripts are synthetic.

const SLUG = 'C--proj';
const AT = '2026-01-01T12:00:00.000Z';
const FROM = { host: 'claude-code', id: 'aaaaaaaa-1111-4111-8111-111111111111', source: 'environment', title: 'JH 5 · canal entre sesiones', permissionMode: 'auto' };

function withHome(body) {
  return async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-channel-'));
    try {
      await body(home);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  };
}

const note = (fields = {}) => channel.newNotice({ at: AT, from: FROM, to: 'orchestrator', kind: 'note', text: 'the gate passed', ...fields });
const refused = (fields, pattern) => assert.throws(() => note(fields), (err) => err instanceof channel.ChannelInputError && pattern.test(err.message), JSON.stringify(fields));

// --- where the channel lives ---

test('everything the channel writes is in one folder under the home, beside the relief file', () => {
  const home = path.join('C:', 'home');
  assert.equal(channel.channelDir(home), path.join(home, '.js-harness', 'channel'));
  assert.equal(channel.recordPath(home, SLUG), path.join(home, '.js-harness', 'channel', 'C--proj.jsonl'));
  assert.equal(channel.openingsDir(home, SLUG), path.join(home, '.js-harness', 'channel', 'openings', 'C--proj'));
  assert.equal(channel.reliefPath(home, SLUG), path.join(home, '.js-harness', 'relief', 'C--proj.md'));
});

// --- a notice ---

test('a notice is a schema, the time, the sender, the role it is for, the kind, the text and where it was run from', () => {
  const made = note({ to: 'ORQ', kind: 'opened', text: 'session channel, T1', cwd: 'C:\\proj-worktrees\\channel', worktree: 'C:\\proj-worktrees\\channel', branch: 'feat/session-record' });
  assert.deepEqual(made, {
    schema: 'js-harness.channel-notice/v1',
    at: AT,
    from: FROM,
    to: { role: 'orchestrator', number: null },
    kind: 'opened',
    text: 'session channel, T1',
    cwd: 'C:\\proj-worktrees\\channel',
    worktree: 'C:\\proj-worktrees\\channel',
    branch: 'feat/session-record',
  });
  assert.deepEqual(note({ to: '5' }).to, { role: 'work', number: 5 });
  // Where it was run from is null when it could not be read, never left out.
  assert.deepEqual([note().cwd, note().worktree, note().branch], [null, null, null]);
});

test('the kinds are six, and no other is one', () => {
  assert.deepEqual(channel.NOTICE_KINDS, ['opened', 'waiting', 'closed', 'note', 'answer', 'relieved']);
  for (const kind of channel.NOTICE_KINDS.filter((one) => one !== 'answer')) assert.equal(note({ kind }).kind, kind);
  for (const kind of ['done', 'Note', '', undefined, 'constructor']) refused({ kind }, /--kind takes one of opened, waiting, closed, note, answer, relieved/);
});

test('a notice is for a role: the orchestrator or the number of a work session', () => {
  for (const to of ['boss', 'JH 5', '', '5.5', undefined]) refused({ to }, /--to takes a role/);
});

test('the text is one line: not empty, no line break, 500 characters at most', () => {
  assert.equal(channel.NOTICE_TEXT_MAX, 500);
  assert.equal(note({ text: 'x'.repeat(500) }).text.length, 500);
  assert.equal(note({ text: '  padded  ' }).text, 'padded', 'the blanks around it are not part of it');
  refused({ text: '' }, /empty/);
  refused({ text: '   ' }, /empty/);
  refused({ text: undefined }, /empty/);
  for (const text of ['two\nlines', 'two\r\nlines', 'old\rmac', 'next\u0085line', 'line\u2028separator', 'paragraph\u2029separator']) refused({ text }, /one line/);
  refused({ text: 'x'.repeat(501) }, /501 characters.*500 at most/);
});

test('an answer carries the transcript and the line his words are read at, and no other kind takes them', () => {
  const answer = note({ kind: 'answer', text: 'A, as automatic as possible', transcript: '1d16beeb', line: 406 });
  assert.deepEqual([answer.transcript, answer.line], ['1d16beeb', 406]);
  assert.deepEqual(Object.keys(answer).slice(-2), ['transcript', 'line']);
  refused({ kind: 'answer' }, /answer.*--transcript.*--line/);
  refused({ kind: 'answer', transcript: '1d16beeb' }, /answer.*--transcript.*--line/);
  refused({ kind: 'answer', line: 406 }, /answer.*--transcript.*--line/);
  for (const line of [0, -1, 1.5, '406', Number.MAX_SAFE_INTEGER + 1]) refused({ kind: 'answer', transcript: '1d16beeb', line }, /--line takes the number of a line/);
  for (const transcript of ['', '  ', 'two\nlines']) refused({ kind: 'answer', transcript, line: 1 }, /--transcript/);
  refused({ kind: 'note', transcript: '1d16beeb', line: 406 }, /only an answer takes --transcript and --line/);
  refused({ kind: 'closed', line: 406 }, /only an answer takes --transcript and --line/);
  assert.equal('transcript' in note(), false);
});

// --- the record ---

test('appendNotice writes one JSON line per notice, creating the folder, and readNotices gives them back in order', withHome((home) => {
  const first = note();
  const second = note({ to: '5', kind: 'waiting', text: 'on his answer about the cap' });
  const file = channel.appendNotice(home, SLUG, first);
  assert.equal(file, channel.recordPath(home, SLUG));
  channel.appendNotice(home, SLUG, second);
  const text = fs.readFileSync(file, 'utf8');
  assert.deepEqual(text.split('\n'), [JSON.stringify(first), JSON.stringify(second), '']);
  assert.deepEqual(channel.readNotices(home, SLUG), { path: file, notices: [first, second], skipped: 0 });
}));

test('a project with no record yet has no notices, and that is not an error', withHome((home) => {
  assert.deepEqual(channel.readNotices(home, SLUG), { path: channel.recordPath(home, SLUG), notices: [], skipped: 0 });
}));

test('readNotices counts and skips a torn line and a line that is not a notice, and keeps the rest', withHome((home) => {
  const file = channel.recordPath(home, SLUG);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const good = note();
  const lines = [
    JSON.stringify(good),
    '{"schema":"js-harness.channel-notice/v1","at":"2026-01-01T12:0', // torn
    '',
    'null',
    '[1,2]',
    '"a string"',
    JSON.stringify({ schema: 'js-harness.codex-review/v1', at: AT }), // another file's record
    JSON.stringify({ ...good, kind: 'shouted' }),
    JSON.stringify({ ...good, text: 42 }),
    JSON.stringify({ ...good, to: 'everyone' }),
    JSON.stringify({ ...good, at: 'yesterday' }),
    JSON.stringify(note({ kind: 'closed', text: 'delivered' })),
  ];
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  const read = channel.readNotices(home, SLUG);
  assert.deepEqual(read.notices.map((one) => one.kind), ['note', 'closed']);
  assert.equal(read.skipped, 9);
}));

test('a record that is there and cannot be read is unavailable with the reason, never an empty record', withHome((home) => {
  const readFile = () => {
    throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
  };
  assert.deepEqual(channel.readNotices(home, SLUG, { readFile }), { path: channel.recordPath(home, SLUG), unavailable: 'EACCES', notices: [], skipped: 0 });
}));

test('a tail left without its line break does not swallow the notice appended after it', withHome((home) => {
  const file = channel.recordPath(home, SLUG);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{"schema":"js-harness.channel-notice/v1","at":', 'utf8');
  channel.appendNotice(home, SLUG, note());
  const read = channel.readNotices(home, SLUG);
  assert.deepEqual([read.notices.length, read.skipped], [1, 1]);
}));

// Two sessions write at the same moment. What the writer relies on: the file is opened for appending and
// each notice is one write of one whole line, a few hundred bytes, which the system puts at the end of
// the file as a whole. What can be tested is that it holds here: several processes that start together
// and write as fast as they can leave nothing but whole lines, every one of them, each writer's in order.
const WRITER = `
import path from 'node:path';
import { appendNotice, newNotice } from${JSON.stringify(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'channel.mjs')).href)};
// Under \`node -e\` the arguments start at the second place, not the third. A writer that read them one
// place off took the start time for its count and wrote without end: so it checks what it was given.
const [home, slug, writer, count, startAt] = process.argv.slice(1);
if (!path.isAbsolute(home) || !(Number(count) <= 1000) || !(Number(startAt) - Date.now() < 60000)) throw new Error('writer: bad arguments ' + JSON.stringify(process.argv.slice(1)));
while (Date.now() < Number(startAt)) {}
for (let i = 0; i < Number(count); i++) {
  appendNotice(home, slug, newNotice({ at: new Date().toISOString(), from: { host: 'unknown', id: null, source: null, title: null, permissionMode: null }, to: writer, kind: 'note', text: String(i) + ' ' + 'x'.repeat(400) }));
}
`;

test('notices appended by several processes at the same moment are all there, each one whole', { timeout: 60000 }, withHome(async (home) => {
  // Few and short on purpose: each append opens the file twice, and on a machine that runs a gate beside
  // this test 240 of them took 17 s. A hundred show the same thing.
  const writers = 4;
  const each = 25;
  const startAt = Date.now() + 1500;
  const exits = await Promise.all(
    Array.from({ length: writers }, (_, index) =>
      new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['--input-type=module', '-e', WRITER, home, SLUG, String(index + 1), String(each), String(startAt)], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 45000 });
        let stderr = '';
        child.stderr.on('data', (chunk) => (stderr += chunk));
        child.on('error', reject);
        child.on('close', (code) => resolve({ code, stderr }));
      }),
    ),
  );
  assert.deepEqual(exits, Array.from({ length: writers }, () => ({ code: 0, stderr: '' })));
  const read = channel.readNotices(home, SLUG);
  assert.deepEqual([read.notices.length, read.skipped], [writers * each, 0]);
  for (let writer = 1; writer <= writers; writer++) {
    const sequence = read.notices.filter((one) => one.to.number === writer).map((one) => Number(one.text.split(' ')[0]));
    assert.deepEqual(sequence, Array.from({ length: each }, (_, i) => i), `writer ${writer}`);
  }
  assert.equal(fs.readFileSync(channel.recordPath(home, SLUG), 'utf8').endsWith('\n'), true);
}));

// --- the relief file ---

test('a relief line is stamped with the local date and time of the clock, and says the command wrote it', () => {
  const ms = Date.parse('2026-10-11T11:15:42.000Z');
  const local = new Date(ms);
  const two = (number) => String(number).padStart(2, '0');
  const expected = `${local.getFullYear()}-${two(local.getMonth() + 1)}-${two(local.getDate())} ${two(local.getHours())}:${two(local.getMinutes())} local (notify).`;
  assert.equal(channel.reliefStamp(ms), expected);
  assert.match(channel.reliefStamp(ms), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} local \(notify\)\.$/);
});

test('appendRelief adds one stamped line to the relief file, creating it and its folder, after whatever it holds', withHome((home) => {
  const ms = Date.parse('2026-10-11T11:15:42.000Z');
  const first = channel.appendRelief(home, SLUG, '  JH 5 opened: session channel  ', ms);
  assert.deepEqual(first, { path: channel.reliefPath(home, SLUG), line: `${channel.reliefStamp(ms)} JH 5 opened: session channel` });
  assert.equal(fs.readFileSync(first.path, 'utf8'), `${first.line}\n`);
  // A file somebody wrote by hand, whose last line has no line break: the new line starts on its own.
  fs.writeFileSync(first.path, '2026-10-09 decision (made up): one orchestrator', 'utf8');
  const second = channel.appendRelief(home, SLUG, 'merged pull request 58', ms + 60000);
  assert.deepEqual(fs.readFileSync(first.path, 'utf8').split('\n'), ['2026-10-09 decision (made up): one orchestrator', second.line, '']);
}));

test('a relief line is one line too, of 6000 characters at most, and nothing is written for one that is not', withHome((home) => {
  assert.equal(channel.RELIEF_LINE_MAX, 6000);
  for (const [line, pattern] of [['', /empty/], [' \t ', /empty/], ['two\nlines', /one line/], ['x'.repeat(6001), /6001 characters.*6000 at most/]]) {
    assert.throws(() => channel.appendRelief(home, SLUG, line, 0), (err) => err instanceof channel.ChannelInputError && pattern.test(err.message), JSON.stringify(line.slice(0, 20)));
  }
  assert.equal(fs.existsSync(channel.reliefPath(home, SLUG)), false);
  assert.equal(channel.appendRelief(home, SLUG, 'x'.repeat(6000), 0).line.length, channel.reliefStamp(0).length + 1 + 6000);
}));

// --- the openings ---

const TITLE = 'JH 5 · canal entre sesiones';

test('the file of an opening has a name every system takes, whatever the title holds', () => {
  const name = channel.openingFileName(TITLE);
  assert.match(name, /^jh-5-canal-entre-sesiones-[0-9a-f]{12}\.json$/);
  const awkward = ['CON', 'nul', 'a/b\\c:d*e?f"g<h>i|j', 'ends with a dot.', ' ', '···', 'JH 7 · revisión de diseño ñandú', 'x'.repeat(300), 'aux.txt'];
  for (const title of awkward) {
    const made = channel.openingFileName(title);
    assert.match(made, /^([a-z0-9]+-)*[0-9a-f]{12}\.json$/, title);
    assert.ok(made.length <= 80, `${title.slice(0, 20)}: ${made.length}`);
  }
  assert.match(channel.openingFileName('JH 7 · revisión de diseño ñandú'), /^jh-7-revision-de-diseno-nandu-/);
  // Titles that differ only by case, or by an accent, are two openings on a disk that ignores case.
  const names = ['JH 5 · canal', 'JH 5 · Canal', 'JH 5 · canál'].map((title) => channel.openingFileName(title).toLowerCase());
  assert.equal(new Set(names).size, 3);
  // One title is one file however its accents were typed: composed, or a letter and a combining mark.
  assert.equal(channel.openingFileName('JH 7 · revisión'), channel.openingFileName('JH 7 · revisio\u0301n'));
});

test('writeOpening stores the text under the title, and writing the same title again replaces it and says so', withHome((home) => {
  const first = channel.writeOpening(home, SLUG, { title: TITLE, text: 'Sos JH 5.\nLeé odd/tasks/session-channel.md.\n', at: AT, from: FROM });
  assert.deepEqual(first, { path: path.join(channel.openingsDir(home, SLUG), channel.openingFileName(TITLE)), replaced: false });
  assert.deepEqual(JSON.parse(fs.readFileSync(first.path, 'utf8')), { schema: 'js-harness.channel-opening/v1', title: TITLE, at: AT, from: FROM, text: 'Sos JH 5.\nLeé odd/tasks/session-channel.md.\n' });
  const later = '2026-01-01T13:00:00.000Z';
  const second = channel.writeOpening(home, SLUG, { title: `  ${TITLE}  `, text: 'Second text.', at: later, from: FROM });
  assert.deepEqual(second, { path: first.path, replaced: true });
  assert.deepEqual(fs.readdirSync(channel.openingsDir(home, SLUG)), [channel.openingFileName(TITLE)]);
  assert.equal(JSON.parse(fs.readFileSync(first.path, 'utf8')).text, 'Second text.');
}));

test('the text of an opening loses its byte order mark and its carriage returns, and nothing else', withHome((home) => {
  const { path: file } = channel.writeOpening(home, SLUG, { title: TITLE, text: '\uFEFFuno\r\n  dos\r\n', at: AT, from: FROM });
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).text, 'uno\n  dos\n');
}));

test('an opening needs a one-line title and a text, of 120 and 100000 characters at most, and nothing is written without them', withHome((home) => {
  assert.deepEqual([channel.OPENING_TITLE_MAX, channel.OPENING_TEXT_MAX], [120, 100000]);
  const write = (fields) => () => channel.writeOpening(home, SLUG, { title: TITLE, text: 'text', at: AT, from: FROM, ...fields });
  const cases = [
    [{ title: '' }, /title.*empty/],
    [{ title: 'two\nlines' }, /title.*one line/],
    [{ title: 'x'.repeat(121) }, /title.*121 characters.*120 at most/],
    [{ text: '' }, /text.*empty/],
    [{ text: ' \r\n\t ' }, /text.*empty/],
    [{ text: 'x'.repeat(100001) }, /text.*100001 characters.*100000 at most/],
  ];
  for (const [fields, pattern] of cases) assert.throws(write(fields), (err) => err instanceof channel.ChannelInputError && pattern.test(err.message), JSON.stringify(Object.keys(fields)));
  assert.equal(fs.existsSync(channel.channelDir(home)), false);
}));

test('findOpenings finds an opening by its exact title and by its code and role, the latest first', withHome((home) => {
  const write = (title, at, text = `opening of ${title}`) => channel.writeOpening(home, SLUG, { title, text, at, from: FROM });
  write(TITLE, '2026-01-01T10:00:00.000Z');
  write('JH 5 · canal, segunda vuelta', '2026-01-01T11:00:00.000Z');
  write('JH 6 · reglas', '2026-01-01T09:00:00.000Z');
  write('JH ORQ · js-harness', '2026-01-01T08:00:00.000Z');
  write('XY 5 · otro proyecto', '2026-01-01T12:00:00.000Z');
  write('notas sueltas', '2026-01-01T12:30:00.000Z');
  const titles = (wanted) => channel.findOpenings(home, SLUG, wanted).openings.map((one) => one.title);

  assert.deepEqual(titles(TITLE), [TITLE]);
  assert.deepEqual(titles('JH 5'), ['JH 5 · canal, segunda vuelta', TITLE]);
  assert.deepEqual(titles('JH 6'), ['JH 6 · reglas']);
  assert.deepEqual(titles('JH ORQ'), ['JH ORQ · js-harness']);
  assert.deepEqual(titles('notas sueltas'), ['notas sueltas']);
  assert.deepEqual(titles('  JH 5  '), ['JH 5 · canal, segunda vuelta', TITLE]);
  // Neither half of a title, nor another project's code, nor a title that only starts the same.
  for (const wanted of ['JH 9', 'JH', '5', 'jh 5', 'JH 5 · canal', 'JH 5 ·', 'ZZ ORQ', '']) assert.deepEqual(titles(wanted), [], wanted);

  const [found] = channel.findOpenings(home, SLUG, 'JH 6').openings;
  assert.deepEqual(found, { path: path.join(channel.openingsDir(home, SLUG), channel.openingFileName('JH 6 · reglas')), title: 'JH 6 · reglas', at: '2026-01-01T09:00:00.000Z', from: FROM, text: 'opening of JH 6 · reglas' });
  // Another project's openings are another folder.
  assert.deepEqual(channel.findOpenings(home, 'C--other', 'JH 5'), { dir: channel.openingsDir(home, 'C--other'), openings: [], unreadable: 0 });
}));

test('findOpenings counts a file it cannot read as an opening and goes on, and says when the folder itself cannot be listed', withHome((home) => {
  channel.writeOpening(home, SLUG, { title: TITLE, text: 'text', at: AT, from: FROM });
  const dir = channel.openingsDir(home, SLUG);
  fs.writeFileSync(path.join(dir, 'torn-000000000000.json'), '{"schema":"js-harness.channel-opening/v1","title":"JH 5 · c', 'utf8');
  fs.writeFileSync(path.join(dir, 'foreign-000000000000.json'), JSON.stringify({ title: 'JH 5 · no schema', text: 'x' }), 'utf8');
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'not an opening, and not counted', 'utf8');
  const found = channel.findOpenings(home, SLUG, 'JH 5');
  assert.deepEqual([found.openings.map((one) => one.title), found.unreadable], [[TITLE], 2]);

  const readdir = () => {
    throw Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
  };
  assert.deepEqual(channel.findOpenings(home, SLUG, 'JH 5', { readdir }), { dir, openings: [], unreadable: 0, unavailable: 'EPERM' });
}));

// --- where a notice is run from ---

const ok = (stdout) => ({ status: 0, stdout, stderr: '' });
const notARepository = () => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository (or any of the parent directories): .git\n' });

test('placeOf reads the worktree and the branch of the folder from git, in two calls', () => {
  const calls = [];
  const run = (command, args, options) => {
    calls.push({ command, args, cwd: options.cwd });
    return args[0] === 'rev-parse' ? ok('C:/proj-worktrees/channel\n') : ok('feat/session-record\n');
  };
  assert.deepEqual(channel.placeOf(run, 'C:\\proj-worktrees\\channel\\bin'), { worktree: path.resolve('C:/proj-worktrees/channel'), branch: 'feat/session-record' });
  assert.deepEqual(calls, [
    { command: 'git', args: ['rev-parse', '--show-toplevel'], cwd: 'C:\\proj-worktrees\\channel\\bin' },
    { command: 'git', args: ['branch', '--show-current'], cwd: 'C:\\proj-worktrees\\channel\\bin' },
  ]);
});

test('placeOf gives null for what git does not say, and never throws', () => {
  assert.deepEqual(channel.placeOf(notARepository, 'C:\\tmp'), { worktree: null, branch: null });
  // A detached HEAD is a worktree with no branch.
  assert.deepEqual(channel.placeOf((command, args) => (args[0] === 'rev-parse' ? ok('C:/proj\n') : ok('\n')), 'C:\\proj'), { worktree: path.resolve('C:/proj'), branch: null });
  assert.deepEqual(channel.placeOf(() => ({ error: Object.assign(new Error('spawnSync git ENOENT'), { code: 'ENOENT' }) }), 'C:\\proj'), { worktree: null, branch: null });
  const thrower = () => {
    throw new Error('made up');
  };
  assert.deepEqual(channel.placeOf(thrower, 'C:\\proj'), { worktree: null, branch: null });
});

// --- who sends ---

const SESSION = 'aaaaaaaa-1111-4111-8111-111111111111';
const OTHER = 'aaaaaaaa-2222-4222-8222-222222222222';
const transcript = (...entries) => entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n';
const titled = (title, permissionMode = 'bypassPermissions') =>
  transcript({ type: 'custom-title', customTitle: title }, { type: 'user', timestamp: AT, permissionMode, origin: { kind: 'human' }, message: { role: 'user', content: 'made up' } });

/** A sessions folder of a project as `senderOf` reads it: `files` is `{ <name>: <text> }`. */
const folder = (files) => ({
  projectDir: 'C:\\claude\\projects\\C--proj',
  readdir: () => Object.keys(files),
  readFile: (file) => files[path.basename(file)],
});

test('the sender is the session the host names in the environment, with the title and permission mode its transcript gives', () => {
  const where = folder({ [`${SESSION}.jsonl`]: titled('JH 5 · canal entre sesiones', 'auto'), [`${OTHER}.jsonl`]: titled('JH ORQ · js-harness') });
  assert.deepEqual(channel.senderOf({ env: { CLAUDE_CODE_SESSION_ID: SESSION }, ...where }), { host: 'claude-code', id: SESSION, source: 'environment', title: 'JH 5 · canal entre sesiones', permissionMode: 'auto' });
});

test('--self names the sender instead, by its id or the start of it, and the record says the id came from the flag', () => {
  const where = folder({ [`${SESSION}.jsonl`]: titled('JH 5 · canal entre sesiones'), 'bbbbbbbb-2222-4222-8222-222222222222.jsonl': titled('JH ORQ · js-harness') });
  const whole = channel.senderOf({ self: SESSION, env: { CLAUDE_CODE_SESSION_ID: 'bbbbbbbb-2222-4222-8222-222222222222' }, ...where });
  assert.deepEqual(whole, { host: 'claude-code', id: SESSION, source: 'flag', title: 'JH 5 · canal entre sesiones', permissionMode: 'bypassPermissions' });
  assert.deepEqual(channel.senderOf({ self: 'aaaaaaaa', env: {}, ...where }), whole, 'the start of an id is completed from the transcript it names');
});

test('a sender with no transcript to read keeps its id and has no title; a start that names two transcripts names neither', () => {
  const none = { title: null, permissionMode: null };
  assert.deepEqual(channel.senderOf({ env: { CLAUDE_CODE_SESSION_ID: SESSION }, ...folder({}) }), { host: 'claude-code', id: SESSION, source: 'environment', ...none });
  // An id typed with --self that no transcript carries is only a claim: no host is named for it.
  assert.deepEqual(channel.senderOf({ self: 'cccccccc', env: {}, ...folder({}) }), { host: 'unknown', id: 'cccccccc', source: 'flag', ...none });
  const two = folder({ [`${SESSION}.jsonl`]: titled('one'), [`${OTHER}.jsonl`]: titled('two') });
  assert.deepEqual(channel.senderOf({ self: 'aaaaaaaa', env: {}, ...two }), { host: 'unknown', id: 'aaaaaaaa', source: 'flag', ...none });
  const missing = { projectDir: 'C:\\nowhere', readdir: () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); }, readFile: () => '' };
  assert.deepEqual(channel.senderOf({ env: { CLAUDE_CODE_SESSION_ID: SESSION }, ...missing }), { host: 'claude-code', id: SESSION, source: 'environment', ...none });
  const unreadable = { ...folder({ [`${SESSION}.jsonl`]: '' }), readFile: () => { throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' }); } };
  assert.deepEqual(channel.senderOf({ env: { CLAUDE_CODE_SESSION_ID: SESSION }, ...unreadable }), { host: 'claude-code', id: SESSION, source: 'environment', ...none });
});

test('only a title the session was given is one: the start of its first prompt names nobody', () => {
  const untitled = transcript({ type: 'user', timestamp: AT, permissionMode: 'auto', origin: { kind: 'human' }, message: { role: 'user', content: 'build the channel' } });
  assert.deepEqual(channel.senderOf({ env: { CLAUDE_CODE_SESSION_ID: SESSION }, ...folder({ [`${SESSION}.jsonl`]: untitled }) }), { host: 'claude-code', id: SESSION, source: 'environment', title: null, permissionMode: 'auto' });
});

test('with no id from the host and none given the sender is not known, and the host is not guessed', () => {
  const unknown = { host: 'unknown', id: null, source: null, title: null, permissionMode: null };
  const neverRead = { projectDir: 'C:\\nowhere', readdir: () => assert.fail('nothing to look for'), readFile: () => assert.fail('nothing to read') };
  assert.deepEqual(channel.senderOf({ env: {}, ...neverRead }), unknown);
  assert.deepEqual(channel.senderOf({ env: { CLAUDE_CODE_SESSION_ID: '' }, ...neverRead }), unknown);
  // No variable with Codex in its name is known to hold a session id, so none is read as one.
  assert.deepEqual(channel.senderOf({ env: { CODEX_HOME: 'C:\\codex', CODEX_SANDBOX_NETWORK_DISABLED: '1' }, ...neverRead }), unknown);
});

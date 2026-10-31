import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { replyMain } from './reply.mjs';
import { openingsDir, recordPath } from './lib/channel.mjs';
import { CURSOR_SCHEMA, liveCursorPath } from './lib/live-rows.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';
import { SUMMARY_MARKER } from './lib/stale-board.mjs';
import { RECORD_SCHEMA, stretchFile } from './lib/stretch.mjs';
import { SHOWN_SCHEMA, SUMMARY_SUBJECT, shownFile } from './lib/template-record.mjs';

// `js-harness reply --hook`, the Stop hook of C1 (odd/tasks/rule-hierarchy.md, T2). The files it reads are
// handed in, so no test touches a real project: `files` maps a path to its text, and a path it does not hold
// reads as missing.
const PROJECT = path.resolve('/work/project');
const SPANISH = { states: { working: 'Sigo solo', decision: 'Necesito tu decisión', question: 'Te pregunto', cut: 'Corte', finished: 'Terminado' }, labels: { what: 'Qué es', where: 'Dónde', effect: 'Qué pasa' } };
const ON = { [path.join(PROJECT, 'harness.json')]: JSON.stringify({ documents: ['docs/'], reply: SPANISH }) };

async function hook(payload, { files = ON, argv = ['--hook'], raw, deps = {} } = {}) {
  const out = [];
  const err = [];
  const read = [];
  const code = await replyMain(argv, {
    readStdin: () => raw ?? JSON.stringify(payload),
    readFile: (file) => {
      read.push(file);
      if (Object.hasOwn(files, file)) return files[file];
      throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
    },
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
    ...deps,
  });
  return { code, out: out.join(''), err: err.join(''), read };
}

const stopPayload = (message, extra = {}) => ({ hook_event_name: 'Stop', cwd: PROJECT, stop_hook_active: false, last_assistant_message: message, background_tasks: [], ...extra });
const PASS = '{}\n';

test('anything but --hook prints the usage and exits 2', async () => {
  for (const argv of [[], ['--stop'], ['--hook', 'extra'], ['check']]) {
    const result = await hook(null, { argv });
    assert.equal(result.code, 2, JSON.stringify(argv));
    assert.match(result.err, /Usage: js-harness reply --hook/);
    assert.equal(result.out, '');
  }
  const help = await hook(null, { argv: ['--help'] });
  assert.equal(help.code, 0);
  assert.match(help.out, /Usage: js-harness reply --hook/);
});

test('a refused argument is named: unknown argument: <token>, then the usage', async () => {
  for (const [argv, token] of [[['--stop'], '--stop'], [['--hook', 'extra'], 'extra'], [['--hook', '--hook'], '--hook'], [['check'], 'check']]) {
    const result = await hook(null, { argv });
    assert.equal(result.code, 2, JSON.stringify(argv));
    assert.match(result.err, new RegExp(`^js-harness reply: unknown argument: ${token}\\n\\nUsage: js-harness reply --hook`), JSON.stringify(argv));
  }
  const bare = await hook(null, { argv: [] });
  assert.equal(bare.code, 2);
  assert.match(bare.err, /^Usage: js-harness reply --hook/);
});

test('a reply that ends with no state is turned back with the hooks contract\'s block and its reason', async () => {
  const result = await hook(stopPayload('Merged pull request 12.'));
  assert.equal(result.code, 0);
  const answer = JSON.parse(result.out);
  assert.equal(answer.decision, 'block');
  assert.match(answer.reason, /no state/);
  assert.match(answer.reason, /Sigo solo/);
});

test('a reply that closes with its state lets the session stop: the answer is an empty JSON object, which both hosts read as go on', async () => {
  const result = await hook(stopPayload('Hecho.\n\n**Sigo solo** — espero el gate.'));
  assert.deepEqual([result.code, result.out, result.err], [0, PASS, '']);
});

test('a stop the hooks already turned back is let through without reading the project, so it cannot loop', async () => {
  const result = await hook(stopPayload('No state here.', { stop_hook_active: true }));
  assert.deepEqual([result.code, result.out, result.read], [0, PASS, []]);
});

test('it acts only where a harness.json above the folder holds a reply key', async () => {
  assert.equal((await hook(stopPayload('No state here.'), { files: {} })).out, PASS, 'no harness.json at all');
  const without = { [path.join(PROJECT, 'harness.json')]: JSON.stringify({ documents: ['docs/'] }) };
  assert.equal((await hook(stopPayload('No state here.'), { files: without })).out, PASS, 'a harness.json with no reply key');
  const deeper = await hook(stopPayload('No state here.', { cwd: path.join(PROJECT, 'bin', 'lib') }));
  assert.equal(JSON.parse(deeper.out).decision, 'block', 'the nearest harness.json above a subfolder');
  const nearest = { ...ON, [path.join(PROJECT, 'bin', 'harness.json')]: JSON.stringify({}) };
  assert.equal((await hook(stopPayload('No state here.', { cwd: path.join(PROJECT, 'bin') }), { files: nearest })).out, PASS, 'the nearest one decides, even with no key');
});

test('only running background tasks count against a decision', async () => {
  const decision = 'Hecho.\n\nNecesito tu decisión: el orquestador te la pregunta.';
  const running = await hook(stopPayload(decision, { background_tasks: [{ id: 'a', status: 'running' }, { id: 'b', status: 'completed' }] }));
  assert.match(JSON.parse(running.out).reason, /1 background task\b/);
  const done = await hook(stopPayload(decision, { background_tasks: [{ id: 'b', status: 'completed' }] }));
  assert.equal(done.out, PASS);
  assert.equal((await hook(stopPayload(decision, { background_tasks: undefined }))).out, PASS, 'Codex sends no background_tasks');
});

test('whatever it cannot read lets the session stop, and a reply key it cannot read is said on standard error', async () => {
  assert.deepEqual([(await hook(null, { raw: 'not json' })).out, (await hook(null, { raw: 'not json' })).code], [PASS, 0]);
  assert.equal((await hook(stopPayload(null))).out, PASS, 'Codex may send last_assistant_message null');
  const broken = await hook(stopPayload('x'), { files: { [path.join(PROJECT, 'harness.json')]: '{ broken' } });
  assert.equal(broken.out, PASS);
  assert.match(broken.err, /harness\.json is not JSON .*; the reply check did not run/, 'a broken harness.json is said, not skipped in silence');
  const bad = await hook(stopPayload('x'), { files: { [path.join(PROJECT, 'harness.json')]: JSON.stringify({ reply: 'yes' }) } });
  assert.equal(bad.out, PASS);
  assert.match(bad.err, /harness\.json "reply"/);
});

// The wake check of A(a) (odd/tasks/wake-and-flag.md, T2, S2): a work session that ends its turn holding work the
// orchestrator handed it, with nothing in the background to wake it, is told once. Its records are handed in: the
// session's transcript, the project's record of notices and its openings, under a home of the test's own.
const HOME = path.resolve('/home/me');
const TRANSCRIPT = path.resolve('/claude/projects/p/s1.jsonl');
const noGit = () => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository' });
const SLUG = projectSlug(mainCheckout(noGit, PROJECT));
const RECORD = recordPath(HOME, SLUG);
const OPENINGS = openingsDir(HOME, SLUG);
const LEAD = { host: 'claude-code', id: 'lead', title: 'JH ORQ · js-harness (350k)' };
const SELF = { host: 'claude-code', id: 's1', title: 'JH 26 · canal' };
const notice = (at, from, to, kind, text = 'x') => JSON.stringify({ schema: 'js-harness.channel-notice/v1', at, from, to, kind, text });
const handed = (at, kind = 'note') => notice(at, LEAD, { role: 'work', number: 26 }, kind, 'Lead: build T2.');
const own = (at, kind) => notice(at, SELF, { role: 'orchestrator' }, kind);
const line = (value) => JSON.stringify(value);
const titled = (title, at = '2026-10-17T01:00:00.000Z') => line({ type: 'custom-title', customTitle: title, sessionId: 's1', timestamp: at });
const started = line({ type: 'user', timestamp: '2026-10-17T01:00:00.000Z', message: { role: 'user', content: 'go' } });
const warned = (at) => line({ type: 'attachment', timestamp: at, attachment: { type: 'hook_blocking_error', hookName: 'Stop', hookEvent: 'Stop', blockingError: { blockingError: 'js-harness reply: you hold work the orchestrator handed you; nothing will wake this session.' } } });
const launched = (at) => line({ type: 'assistant', timestamp: at, message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'js-harness wait --notice-to 26', run_in_background: true } }] } });
const CLOSED = 'Hecho.\n\nSigo solo: espero el próximo aviso.';

async function wakeHook({ payload = {}, transcript = [started, titled('JH 26 · canal')], record = [handed('2026-10-17T01:30:00.000Z')], openings = {}, files: extra = {} } = {}) {
  const files = {
    ...ON,
    [TRANSCRIPT]: transcript.join('\n') + '\n',
    [RECORD]: record.join('\n') + '\n',
    ...Object.fromEntries(Object.entries(openings).map(([name, value]) => [path.join(OPENINGS, name), JSON.stringify(value)])),
    ...extra,
  };
  const out = [];
  const err = [];
  const code = await replyMain(['--hook'], {
    readStdin: () => JSON.stringify(stopPayload(CLOSED, { session_id: 's1', transcript_path: TRANSCRIPT, session_crons: [], ...payload })),
    readFile: (file) => {
      // A path given `undefined` is there and cannot be read.
      if (Object.hasOwn(files, file) && files[file] === undefined) throw Object.assign(new Error(`EACCES: ${file}`), { code: 'EACCES' });
      if (Object.hasOwn(files, file)) return files[file];
      throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
    },
    readdir: (dir) => {
      const names = Object.keys(files).filter((file) => path.dirname(file) === dir).map((file) => path.basename(file));
      if (names.length === 0) throw Object.assign(new Error(`ENOENT: ${dir}`), { code: 'ENOENT' });
      return names;
    },
    run: noGit,
    env: { JS_HARNESS_HOME: HOME },
    homedir: () => path.resolve('/elsewhere'),
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
  });
  return { code, out: out.join(''), err: err.join(''), answer: JSON.parse(out.join('')) };
}

const WARNING = /nothing will wake this session/;

test('a work session that ends its turn holding handed work with nothing in the background is turned back once, with what to arm', async () => {
  const result = await wakeHook();
  assert.equal(result.code, 0);
  assert.equal(result.answer.decision, 'block');
  assert.match(result.answer.reason, WARNING);
  assert.match(result.answer.reason, /js-harness wait --notice-to 26/);
  assert.match(result.answer.reason, /--kind closed --summary <file>/);
  assert.match(result.answer.reason, /js-harness summary template/);
  assert.doesNotMatch(result.answer.reason, /--kind waiting/, 'a waiting notice still needs a wait: it is never offered as the way out');
  assert.equal(result.err, '');
});

test('anything running in the background, or a cron of the session, wakes it: no warning', async () => {
  const running = await wakeHook({ payload: { background_tasks: [{ id: 'g', type: 'shell', status: 'running', command: 'js-harness gate -- npm test' }] } });
  assert.deepEqual(running.answer, {});
  const cron = await wakeHook({ payload: { session_crons: [{ id: 'c1' }] } });
  assert.deepEqual(cron.answer, {});
  const ended = await wakeHook({ payload: { background_tasks: [{ id: 'w', type: 'shell', status: 'completed', command: 'js-harness wait --pr 3' }] } });
  assert.match(ended.answer.reason, WARNING, 'a wait that has ended wakes nobody');
});

test('work given back with closed or relieved is not held; a waiting notice still holds it', async () => {
  for (const kind of ['closed', 'relieved']) {
    const back = await wakeHook({ record: [handed('2026-10-17T01:30:00.000Z'), own('2026-10-17T01:40:00.000Z', kind)] });
    assert.deepEqual(back.answer, {}, kind);
  }
  const waiting = await wakeHook({ record: [handed('2026-10-17T01:30:00.000Z'), own('2026-10-17T01:40:00.000Z', 'waiting')] });
  assert.match(waiting.answer.reason, WARNING);
  const handedAgain = await wakeHook({ record: [handed('2026-10-17T01:30:00.000Z'), own('2026-10-17T01:40:00.000Z', 'closed'), handed('2026-10-17T01:50:00.000Z')] });
  assert.match(handedAgain.answer.reason, WARNING, 'work handed after the close is held again');
});

test('a close the session itself sent gives the work back even with no title on it; another session\'s untitled close does not', async () => {
  // JH 30 ran in a .claude/worktrees worktree, and its closed notice carried a null title (channel record, 2026-10-20).
  const untitled = (id) => notice('2026-10-17T01:40:00.000Z', { host: 'claude-code', id, title: null }, { role: 'orchestrator' }, 'closed');
  const ownClose = await wakeHook({ record: [handed('2026-10-17T01:30:00.000Z'), untitled('s1')] });
  assert.deepEqual(ownClose.answer, {});
  const peerClose = await wakeHook({ record: [handed('2026-10-17T01:30:00.000Z'), untitled('p')] });
  assert.match(peerClose.answer.reason, WARNING, 'a close by another id names no work of this session');
});

test('an opening hands work too, and a handing older than the session is another session of that number', async () => {
  const opening = { schema: 'js-harness.channel-opening/v1', title: 'JH 26 · canal', at: '2026-10-17T01:10:00.000Z', from: LEAD, text: 'Build T2.' };
  const opened = await wakeHook({ record: [], openings: { 'jh-26.json': opening } });
  assert.match(opened.answer.reason, WARNING);
  assert.match(opened.answer.reason, /your opening/);
  const old = await wakeHook({ record: [handed('2026-10-15T01:30:00.000Z')] });
  assert.deepEqual(old.answer, {}, 'a number is reused: a handing before the transcript began is not this session\'s');
  const peer = await wakeHook({ record: [notice('2026-10-17T01:30:00.000Z', { host: 'claude-code', id: 'p', title: 'JH 7 · otra' }, { role: 'work', number: 26 }, 'note')] });
  assert.deepEqual(peer.answer, {}, 'only the orchestrator hands work');
});

test('it warns once a handing: an earlier warning after it is enough, until a background task is launched again', async () => {
  const once = await wakeHook({ transcript: [started, titled('JH 26 · canal'), warned('2026-10-17T01:35:00.000Z')] });
  assert.deepEqual(once.answer, {});
  const relaunched = await wakeHook({ transcript: [started, titled('JH 26 · canal'), warned('2026-10-17T01:35:00.000Z'), launched('2026-10-17T01:36:00.000Z')] });
  assert.match(relaunched.answer.reason, WARNING, 'a wait armed after the warning and since ended: warned again');
  const before = await wakeHook({ transcript: [started, titled('JH 26 · canal'), launched('2026-10-17T01:20:00.000Z'), warned('2026-10-17T01:35:00.000Z')] });
  assert.deepEqual(before.answer, {}, 'a launch before the warning does not count');
  const newer = await wakeHook({ transcript: [started, titled('JH 26 · canal'), warned('2026-10-17T01:20:00.000Z')] });
  assert.match(newer.answer.reason, WARNING, 'a handing after the warning is new work');
  const quoted = await wakeHook({ transcript: [started, titled('JH 26 · canal'), line({ type: 'assistant', timestamp: '2026-10-17T01:35:00.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'nothing will wake this session' }] } })] });
  assert.match(quoted.answer.reason, WARNING, 'only the hook\'s own block counts as the warning, not the words quoted');
});

test('only a work session is warned: the orchestrator, another title and an untitled session that read no opening are not', async () => {
  for (const title of ['JH ORQ · js-harness (350k)', 'Fix the README']) {
    const other = await wakeHook({ transcript: [started, titled(title)] });
    assert.deepEqual(other.answer, {}, title);
  }
  const untitled = await wakeHook({ transcript: [started] });
  assert.deepEqual(untitled.answer, {});
  const reading = JSON.stringify({ schema: 'js-harness.channel-reading/v1', at: '2026-10-17T01:05:00.000Z', reader: { host: 'claude-code', id: 's1', source: 'environment' }, title: 'JH 26 · canal' });
  const phone = await wakeHook({ transcript: [started], record: [reading, handed('2026-10-17T01:30:00.000Z')] });
  assert.match(phone.answer.reason, WARNING, 'a session opened from the phone has no title in its transcript: the opening it read names it');
});

test('a decision or a question close, a stop already turned back and Codex are not warned', async () => {
  const decision = await wakeHook({ payload: { last_assistant_message: 'Hecho.\n\nNecesito tu decisión: el orquestador te la pregunta.' } });
  assert.deepEqual(decision.answer, {});
  const question = await wakeHook({ payload: { last_assistant_message: 'Hecho.\n\nTe pregunto: ¿el proyecto es una biblioteca?' } });
  assert.deepEqual(question.answer, {}, 'his written answer is what wakes the session');
  const again = await wakeHook({ payload: { stop_hook_active: true } });
  assert.deepEqual(again.answer, {});
  const codex = await wakeHook({ payload: { background_tasks: undefined, session_crons: undefined } });
  assert.deepEqual(codex.answer, {}, 'Codex sends no background tasks, so it cannot say nothing runs');
  const off = await wakeHook({ files: { [path.join(PROJECT, 'harness.json')]: JSON.stringify({ documents: ['docs/'] }) } });
  assert.deepEqual(off.answer, {}, 'a project with no reply key');
});

test('a close that is also refused gets one block holding both reasons, the warning still found once', async () => {
  const both = await wakeHook({ payload: { last_assistant_message: 'Merged.' } });
  assert.match(both.answer.reason, /no state/);
  assert.match(both.answer.reason, WARNING);
  const after = await wakeHook({ payload: { last_assistant_message: 'Merged.' }, transcript: [started, titled('JH 26 · canal'), line({ type: 'attachment', timestamp: '2026-10-17T01:35:00.000Z', attachment: { type: 'hook_blocking_error', hookEvent: 'Stop', blockingError: { blockingError: `js-harness reply: the reply has no state line.\n\n${'js-harness reply: you hold work; nothing will wake this session.'}` } } })] });
  assert.doesNotMatch(after.answer.reason, WARNING, 'the earlier joined block holds the warning: not again');
});

test('a record it cannot read is said on standard error and lets the session stop', async () => {
  const broken = await wakeHook({ files: { [TRANSCRIPT]: undefined } });
  assert.deepEqual(broken.answer, {});
  assert.match(broken.err, /js-harness reply: .*the wake check did not run/);
});

test('the opening a session read is its work though it was stored before the session began; an older one it never read is not', async () => {
  const opening = { schema: 'js-harness.channel-opening/v1', title: 'JH 26 · canal', at: '2026-10-17T00:50:00.000Z', from: LEAD, text: 'Build T2.' };
  const reading = JSON.stringify({ schema: 'js-harness.channel-reading/v1', at: '2026-10-17T01:02:00.000Z', reader: { host: 'claude-code', id: 's1', source: 'environment' }, title: 'JH 26 · canal' });
  const read = await wakeHook({ record: [reading], openings: { 'jh-26.json': opening } });
  assert.match(read.answer.reason, WARNING);
  assert.match(read.answer.reason, /your opening/);
  const unread = await wakeHook({ record: [], openings: { 'jh-26.json': opening } });
  assert.deepEqual(unread.answer, {}, 'an opening from before the session that it never read is another session\'s');
});

test('a call the host moved to the background when it outlived its timeout counts as a launch after the warning', async () => {
  const moved = line({ type: 'user', timestamp: '2026-10-17T01:36:00.000Z', toolUseResult: { stdout: '', backgroundTaskId: 'b7' }, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't9', content: 'moved to the background' }] } });
  const result = await wakeHook({ transcript: [started, titled('JH 26 · canal'), warned('2026-10-17T01:35:00.000Z'), moved] });
  assert.match(result.answer.reason, WARNING);
});

// The stale-board check (odd/tasks/visual-pages.md, spec 3, T4): the lead of a project with a live board is told once
// that rows wait; bin/lib/stale-board.test.mjs holds its cases, this its place in the hook.
const BOARD_CURSOR = { [liveCursorPath(HOME, SLUG)]: JSON.stringify({ schema: CURSOR_SCHEMA, url: 'https://claude.ai/artifact/board', upto: 0, sent: [] }) };
const STALE = /rows of the channel record wait for the live board/;

test('the lead ending its turn while the live board\'s rows wait is turned back with how to send them', async () => {
  const lead = await wakeHook({ payload: { session_id: 'lead' }, record: [handed('2026-10-17T01:30:00.000Z')], files: BOARD_CURSOR, transcript: [started] });
  assert.equal(lead.answer.decision, 'block');
  assert.match(lead.answer.reason, STALE);
  assert.match(lead.answer.reason, /js-harness sessions live --out <dir>/);
  assert.equal(lead.err, '');
  const noBoard = await wakeHook({ payload: { session_id: 'lead' }, record: [handed('2026-10-17T01:30:00.000Z')], transcript: [started] });
  assert.deepEqual(noBoard.answer, {}, 'a project with no board is never told');
});

// The summary's warning (odd/tasks/board-summary-stale.md): told only where harness.json turns the template gate on.
test('the lead whose board/summary content is older than the waiting notices is told so only where templates are on', async () => {
  const shown = { [shownFile(HOME, SLUG)]: `${JSON.stringify({ schema: SHOWN_SCHEMA, at: '2026-10-17T01:00:00.000Z', session: 'lead', tool: 'ArtifactData', call: 'c1', template: null, subject: SUMMARY_SUBJECT, decision: 'shown', sha256: null, reason: 'fields: ["now","status"]' })}\n` };
  const stop = (harness) => wakeHook({ payload: { session_id: 'lead' }, record: [handed('2026-10-17T01:30:00.000Z')], files: { ...BOARD_CURSOR, ...shown, [path.join(PROJECT, 'harness.json')]: JSON.stringify(harness) }, transcript: [started] });
  const harness = JSON.parse(ON[path.join(PROJECT, 'harness.json')]);
  const on = await stop({ ...harness, templates: true });
  assert.ok(on.answer.reason.includes(SUMMARY_MARKER), on.answer.reason);
  assert.equal(on.err, '');
  const off = await stop(harness);
  assert.match(off.answer.reason, STALE);
  assert.equal(off.answer.reason.includes(SUMMARY_MARKER), false, 'templates off: the record no write refreshes is not read');
  // A shown record that is there and cannot be read: the rows' warning still reaches the lead, the failure stderr.
  const harnessOn = JSON.stringify({ ...harness, templates: true });
  const locked = await wakeHook({ payload: { session_id: 'lead' }, record: [handed('2026-10-17T01:30:00.000Z')], files: { ...BOARD_CURSOR, [shownFile(HOME, SLUG)]: undefined, [path.join(PROJECT, 'harness.json')]: harnessOn }, transcript: [started] });
  assert.match(locked.answer.reason, STALE);
  assert.match(locked.err, /the template gate's shown record .*EACCES.*the summary check did not run/);
});

// The return check (odd/tasks/lead-duty-checks.md, spec 2): the lead's reply to his message after a long absence links
// the status page; bin/lib/return-report.test.mjs holds its cases, this its place in the hook.
const RETURNED = /he came back after/;
const his = (at) => line({ type: 'user', timestamp: at, origin: { kind: 'human' }, message: { role: 'user', content: 'hola' } });

test('the lead answering his return after a long absence without the status page is turned back with what to run', async () => {
  const away = [his('2026-10-16T18:00:00.000Z'), his('2026-10-17T01:00:00.000Z')];
  const lead = await wakeHook({ payload: { session_id: 'lead' }, record: [handed('2026-10-17T01:30:00.000Z')], transcript: away });
  assert.equal(lead.answer.decision, 'block');
  assert.match(lead.answer.reason, RETURNED);
  assert.match(lead.answer.reason, /js-harness report --mark --html <file> --notes <file>/);
  assert.equal(lead.err, '');
  const soon = await wakeHook({ payload: { session_id: 'lead' }, record: [handed('2026-10-17T01:30:00.000Z')], transcript: [his('2026-10-17T00:30:00.000Z'), his('2026-10-17T01:00:00.000Z')] });
  assert.deepEqual(soon.answer, {}, 'a short gap is no return');
  const work = await wakeHook({ transcript: [titled('JH 26 · canal'), ...away], record: [] });
  assert.deepEqual(work.answer, {}, 'a work session is never told');
});

// The departure check (odd/tasks/departure-stretch.md): his word of leaving with no stretch open, and of coming back
// with the stretch of his absence open; bin/lib/away-stretch.test.mjs holds its cases, this its place in the hook.
const LEAVING = /he said he is leaving/;
const BACK = /he said he is back/;
const told = (at, text) => line({ type: 'user', timestamp: at, origin: { kind: 'human' }, message: { role: 'user', content: text } });
const STRETCHES = stretchFile(HOME, SLUG);
const stretchOpened = (at) => JSON.stringify({ schema: RECORD_SCHEMA, event: 'open', id: at, at, plan: { hours: 4 } });

test('the lead whose user says he leaves with no stretch open, or is back with it open, is turned back at every stop', async () => {
  const leaving = [told('2026-10-17T01:00:00.000Z', 'te dejo solo 3 horas ahora nos vemos')];
  const lead = await wakeHook({ payload: { session_id: 'lead' }, transcript: leaving });
  assert.equal(lead.answer.decision, 'block');
  assert.match(lead.answer.reason, LEAVING);
  assert.ok(lead.answer.reason.includes('js-harness stretch open --plan <file> --html <file>'));
  assert.equal(lead.err, '');
  const opened = await wakeHook({ payload: { session_id: 'lead' }, transcript: leaving, files: { [STRETCHES]: `${stretchOpened('2026-10-17T01:01:00.000Z')}\n` } });
  assert.deepEqual(opened.answer, {}, 'a stretch is open');
  const back = [...leaving, told('2026-10-17T03:50:00.000Z', 'ya llegue')];
  const returned = await wakeHook({ payload: { session_id: 'lead' }, transcript: back, files: { [STRETCHES]: `${stretchOpened('2026-10-17T01:01:00.000Z')}\n` } });
  assert.match(returned.answer.reason, BACK);
  assert.ok(returned.answer.reason.includes('js-harness stretch close --html <file>'));
  const work = await wakeHook({ transcript: [titled('JH 26 · canal'), ...leaving], record: [] });
  assert.doesNotMatch(work.answer.reason ?? '', LEAVING, 'a work session is never told');
  const unreadable = await wakeHook({ payload: { session_id: 'lead' }, transcript: leaving, files: { [STRETCHES]: undefined } });
  assert.deepEqual(unreadable.answer, {});
  assert.match(unreadable.err, /the stretch record .*EACCES.*the departure check did not run/);
});

/** A lead's stop in the folder `project`, where the wake, live-board and return checks each ask where the project is
 * and read the record: the hook's answer, its standard error, how many times git was asked and each file read. */
async function sharedStop(project) {
  const slug = projectSlug(project);
  const record = recordPath(HOME, slug);
  const files = {
    [path.join(project, 'harness.json')]: ON[path.join(PROJECT, 'harness.json')],
    [liveCursorPath(HOME, slug)]: BOARD_CURSOR[liveCursorPath(HOME, SLUG)],
    [TRANSCRIPT]: `${[his('2026-10-16T18:00:00.000Z'), his('2026-10-17T01:00:00.000Z')].join('\n')}\n`,
    [record]: `${handed('2026-10-17T01:30:00.000Z')}\n`,
  };
  const reads = new Map();
  let gits = 0;
  const out = [];
  const err = [];
  await replyMain(['--hook'], {
    readStdin: () => JSON.stringify(stopPayload(CLOSED, { cwd: project, session_id: 'lead', transcript_path: TRANSCRIPT, session_crons: [] })),
    readFile: (file) => {
      reads.set(file, (reads.get(file) ?? 0) + 1);
      if (Object.hasOwn(files, file)) return files[file];
      throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
    },
    readdir: (dir) => {
      throw Object.assign(new Error(`ENOENT: ${dir}`), { code: 'ENOENT' });
    },
    run: (...args) => {
      gits += 1;
      return noGit(...args);
    },
    env: { JS_HARNESS_HOME: HOME },
    homedir: () => path.resolve('/elsewhere'),
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
  });
  return { reason: JSON.parse(out.join('')).reason, err: err.join(''), gits, reads: (file) => reads.get(file) ?? 0, record };
}

test('the checks of one stop ask git once where the project is, and read each file once (odd/tasks/reply-hook-latency.md)', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reply-shared-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  // Git is asked even where a `.git` folder seems to say: one that git does not take (here an empty one) names another
  // project than git would, and the project picks the record each check reads.
  const project = path.join(dir, 'main');
  fs.mkdirSync(path.join(project, '.git'), { recursive: true });
  const stop = await sharedStop(project);
  assert.match(stop.reason, STALE);
  assert.match(stop.reason, RETURNED);
  assert.equal(stop.err, '');
  assert.equal(stop.gits, 1, 'one git answer for the three checks that ask where the project is');
  assert.equal(stop.reads(stop.record), 1);
  assert.equal(stop.reads(TRANSCRIPT), 1);
});

test('a work session holding handed work in a project whose board is stale gets the wake warning alone', async () => {
  const result = await wakeHook({ files: BOARD_CURSOR });
  assert.match(result.answer.reason, WARNING);
  assert.doesNotMatch(result.answer.reason, STALE);
});

// The command blocks of a reply (S1 of odd/tasks/f8-lead-rigor.md), on excerpts of the lead's transcript 0f71b2c6 of
// 2026-10-30, trimmed to the fields the check reads.
const SESSION_LOG = path.join(PROJECT, 'session.jsonl');
const toolCall = (id, command) => JSON.stringify({ type: 'assistant', isSidechain: false, message: { content: [{ type: 'tool_use', id, name: 'Bash', input: { command } }] } });
const toolResult = (id, error) => JSON.stringify({
  type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: error, content: error ? 'Exit code 1' : 'ok' }] },
  toolUseResult: error ? 'Error: Exit code 1' : { stdout: 'ok', stderr: '', interrupted: false },
});
// Lines 32882 to 32895, the lead's own runs of the deletion, which the guard refused; and a run that succeeded.
const RUNS = [
  toolCall('toolu_rm', 'cd /d/js-harness-worktrees && rm -rf -- ./* ./.[!.]*'), toolResult('toolu_rm', true),
  toolCall('toolu_doc', 'js-harness doctor --offline'), toolResult('toolu_doc', false),
].join('\n');
// Line 32954: the reply that handed him the deletion.
const RM_REPLY = 'Bórrala tú con este comando:\n\n```bash\nrm -rf /d/js-harness-worktrees\n```\n\nSigo solo. Me despierta el aviso de JH 102.';
// Line 30024: the reply that handed him Codex, trimmed to its blocks and its close.
const CODEX_REPLY = 'Para comprobarlo, ejecuta:\n\n```bash\npnpm config get minimumReleaseAgeExclude\n```\n\nPara arreglarlo:\n\n'
  + '```bash\ncd D:\\js-harness; codex\n```\n\nTe pregunto: ¿me pegas lo que te mostró Codex al abrirlo en `D:\\`?';

async function commandHook(message, { platform, parse = () => ({ errors: [] }), transcript = RUNS } = {}) {
  const files = { ...ON, [SESSION_LOG]: transcript };
  const parsed = [];
  const result = await hook(stopPayload(message, { transcript_path: SESSION_LOG }), {
    files,
    deps: { platform, parse: (texts, options) => { parsed.push({ texts, options }); return parse(texts, options); } },
  });
  return { ...result, answer: JSON.parse(result.out), parsed, transcriptReads: result.read.filter((file) => file === SESSION_LOG).length };
}

test('today\'s mistakes: a reply handing him a block the session never ran with success is turned back, on win32 and on linux', async () => {
  for (const platform of ['win32', 'linux']) {
    const rm = await commandHook(RM_REPLY, { platform });
    assert.equal(rm.answer.decision, 'block', platform);
    assert.match(rm.answer.reason, /the block that starts "rm -rf \/d\/js-harness-worktrees"/, platform);
    assert.match(rm.answer.reason, /tell him in plain words not to run/, platform);
    assert.match(rm.answer.reason, platform === 'win32' ? /tagged bash, which is not his shell/ : /no run of this session that succeeded holds `rm -rf \/d\/js-harness-worktrees`/, platform);
    const codex = await commandHook(CODEX_REPLY, { platform });
    assert.equal(codex.answer.decision, 'block', platform);
    assert.match(codex.answer.reason, /"pnpm config get minimumReleaseAgeExclude"/, platform);
    assert.match(codex.answer.reason, /"cd D:\\js-harness; codex"/, platform);
    assert.equal(codex.err, '', platform);
  }
});

test('a block for his shell of a run that succeeded, and evidence of a run whatever its exit, let the session stop', async () => {
  const handed = 'Corre:\n\n```powershell\njs-harness doctor --offline\n```\n\nSigo solo. Me despierta el aviso de JH 102.';
  const win = await commandHook(handed, { platform: 'win32' });
  assert.deepEqual(win.answer, {});
  assert.deepEqual(win.parsed.map(({ texts }) => texts), [['js-harness doctor --offline']], 'on win32 the parser reads it too');
  assert.ok(win.parsed[0].options.timeout > 0 && win.parsed[0].options.timeout <= 4000, 'the parser gets the time left of one deadline');
  assert.ok(win.transcriptReads <= 1, 'the transcript is read once, the wake check included');
  const linux = await commandHook(handed.replace('powershell', 'bash'), { platform: 'linux' });
  assert.deepEqual([linux.answer, linux.parsed], [{}, []]);
  const evidence = 'Lo que corrí, y falló:\n\n```bash ran\nrm -rf -- ./* ./.[!.]*\n```\n\nSigo solo. Me despierta el aviso de JH 102.';
  for (const platform of ['win32', 'linux']) assert.deepEqual((await commandHook(evidence, { platform })).answer, {}, platform);
});

test('a reply with no command block never reads the transcript for it, and a parser that cannot run refuses the block', async () => {
  const plain = await commandHook('Hecho.\n\n```js\nrm(1);\n```\n\nSigo solo. Me despierta el aviso de JH 102.', { platform: 'win32' });
  assert.deepEqual([plain.answer, plain.parsed], [{}, []]);
  const own = 'Esto es tuyo, con tu sesión:\n\n```powershell own\ncodex login\n```\n\nSigo solo. Me despierta el aviso de JH 102.';
  const failed = await commandHook(own, { platform: 'win32', parse: () => ({ failed: 'no PowerShell answered in time' }) });
  assert.match(failed.answer.reason, /its parser could not check it \(no PowerShell answered in time\)/);
  const rejected = await commandHook(own.replace('codex login', 'rm -rf /d/x'), { platform: 'win32', parse: () => ({ errors: [['rm has no parameter -rf']] }) });
  assert.match(rejected.answer.reason, /rm has no parameter -rf/);
});

test('the command check runs after the wake and board checks, so its deadline holds their time too', async () => {
  const events = [];
  const handed = 'Corre:\n\n```powershell\njs-harness doctor --offline\n```\n\nSigo solo. Me despierta el aviso de JH 102.';
  const result = await hook(stopPayload(handed, { transcript_path: SESSION_LOG }), {
    files: { ...ON, [SESSION_LOG]: RUNS },
    deps: { platform: 'win32', now: () => { events.push('now'); return 0; }, parse: () => { events.push('parse'); return { errors: [['js-harness has no parameter -x']] }; } },
  });
  assert.ok(events.includes('parse'));
  assert.equal(events.indexOf('now', events.indexOf('parse')), -1, `no check reads the clock after the parser: ${events.join(' ')}`);
  const { decision, reason } = JSON.parse(result.out);
  assert.equal(decision, 'block', 'its refusal still reaches the answer');
  assert.match(reason, /^js-harness reply: this reply hands him command blocks .*js-harness has no parameter -x/s);
});

test('a close that is refused and a block that is refused go back in one block', async () => {
  const both = await commandHook(RM_REPLY.replace('\n\nSigo solo. Me despierta el aviso de JH 102.', ''), { platform: 'win32' });
  assert.match(both.answer.reason, /no state line/);
  assert.match(both.answer.reason, /tagged bash/);
});

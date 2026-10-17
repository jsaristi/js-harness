import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { replyMain } from './reply.mjs';
import { openingsDir, recordPath } from './lib/channel.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';

// `js-harness reply --hook`, the Stop hook of C1 (odd/tasks/rule-hierarchy.md, T2). The files it reads are
// handed in, so no test touches a real project: `files` maps a path to its text, and a path it does not hold
// reads as missing.
const PROJECT = path.resolve('/work/project');
const SPANISH = { states: { working: 'Sigo solo', decision: 'Necesito tu decisión', cut: 'Corte', finished: 'Terminado' }, labels: { what: 'Qué es', where: 'Dónde', effect: 'Qué pasa' } };
const ON = { [path.join(PROJECT, 'harness.json')]: JSON.stringify({ documents: ['docs/'], reply: SPANISH }) };

async function hook(payload, { files = ON, argv = ['--hook'], raw } = {}) {
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
  assert.match(result.answer.reason, /--kind closed/);
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

test('a decision close, a stop already turned back and Codex are not warned', async () => {
  const decision = await wakeHook({ payload: { last_assistant_message: 'Hecho.\n\nNecesito tu decisión: el orquestador te la pregunta.' } });
  assert.deepEqual(decision.answer, {});
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

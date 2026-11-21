import { test } from 'node:test';
import assert from 'node:assert/strict';
import { absencesOf, activityOf, dedupeByUuid, endedBy, manifestOf } from './away-hours.mjs';

// workshop/lib/away-hours.mjs (odd/tasks/away-work.md): his absences from his message times, and each session's
// working and waiting hours inside one, from inline transcript entries; nothing is read from the machine.

const at = (hhmm) => `2026-11-19T${hhmm}:00.000Z`;
const reply = (hhmm, text = 'done', tools = []) => ({ type: 'assistant', timestamp: at(hhmm), message: { role: 'assistant', content: [{ type: 'text', text }, ...tools.map((t, i) => ({ type: 'tool_use', id: t.id ?? `t${hhmm}${i || ''}`, name: t.name, input: t.input ?? {} }))] } });
// A call's result names its call: `result('10:40', 't10:00')` answers the call made at 10:00.
const result = (hhmm, id) => ({ type: 'user', timestamp: at(hhmm), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } });
const attach = (hhmm) => ({ type: 'attachment', timestamp: at(hhmm), attachment: { type: 'progress' } });
const span = (a, b, more = {}) => ({ from: Date.parse(at(a)), to: Date.parse(at(b)), idleMs: 10 * 60_000, ...more });
// Every fixture's hours add up to its span: nothing is counted twice or dropped.
const spans = (a) => Math.round((a.workingHours + a.waitingHours + a.launchHours) * 100) / 100;
const typed = (hhmm, text = 'hola') => ({ type: 'user', origin: { kind: 'human' }, timestamp: at(hhmm), message: { role: 'user', content: text } });
const peer = (hhmm) => ({ type: 'user', timestamp: at(hhmm), message: { role: 'user', content: 'Another Claude session sent a message:\n<cross-session-message from-session="local_x">go</cross-session-message>' } });

test('an absence is a gap between his messages longer than the limit, and the last one stays open up to now', () => {
  const times = [at('10:00'), at('10:30'), at('13:00'), at('13:10')];
  assert.deepEqual(absencesOf(times, { minMs: 2 * 3600_000, now: Date.parse(at('16:00')) }), [
    { from: at('10:30'), to: at('13:00'), open: false },
    { from: at('13:10'), to: at('16:00'), open: true },
  ]);
  assert.deepEqual(absencesOf(times, { minMs: 2 * 3600_000, now: Date.parse(at('14:00')) }), [{ from: at('10:30'), to: at('13:00'), open: false }]);
});

test('a short gap is work, a long one is a wait, and a pending tool call is work unless the call itself waits', () => {
  const entries = [
    reply('10:00', 'start', [{ name: 'Bash', input: { command: 'npm run check' } }]),
    result('10:40', 't10:00'), // 40 min under a running tool: work
    reply('10:45'), // 5 min: work
    peer('11:45'), // 60 min idle after a closing reply: a wait, ended by another session
    reply('11:50', 'waiting', [{ name: 'Bash', input: { command: 'js-harness wait --pr 930' } }]),
    result('12:50', 't11:50'), // 60 min under a call that waits: a wait
    reply('12:55'),
  ];
  const a = activityOf(entries, { from: Date.parse(at('10:00')), to: Date.parse(at('14:00')), idleMs: 10 * 60_000 });
  assert.equal(a.workingHours, 0.92); // 40 + 5 + 5 + 5 minutes
  assert.equal(a.waitingHours, 3.08); // 60 + 60 + 65 minutes (12:55 to the end)
  assert.deepEqual(a.waits.map((w) => [w.from, w.to, w.endedBy]), [
    [at('10:45'), at('11:45'), 'a message of another session'],
    [at('11:50'), at('12:50'), 'its own wait call: Bash js-harness wait --pr 930'],
    [at('12:55'), at('14:00'), 'nothing before the end'],
  ]);
  assert.equal(a.waits[0].lastReply, 'done');
});

test('the span is cut to the window, a session idle all of it waits all of it, and one not begun counts nothing', () => {
  const entries = [reply('09:00'), typed('09:30'), reply('09:31')];
  const a = activityOf(entries, { from: Date.parse(at('09:20')), to: Date.parse(at('09:50')), idleMs: 10 * 60_000 });
  assert.equal(a.workingHours, 0.02); // 09:30 to 09:31
  assert.equal(a.waitingHours, 0.48); // 09:20 to 09:30 cut, and 09:31 to 09:50
  const idle = activityOf([reply('08:00')], { from: Date.parse(at('09:20')), to: Date.parse(at('09:40')), idleMs: 10 * 60_000 });
  assert.deepEqual([idle.workingHours, idle.waitingHours, idle.waits.length], [0, 0.33, 1]);
  const none = activityOf([reply('15:00')], { from: Date.parse(at('09:20')), to: Date.parse(at('09:40')), idleMs: 10 * 60_000 });
  assert.deepEqual([none.workingHours, none.waitingHours, none.waits.length], [0, 0, 0]);
  // A gap of 30 minutes cut by the window's end after 5 is still a wait: it is judged whole.
  const cut = activityOf([reply('09:00'), typed('09:30')], { from: Date.parse(at('09:00')), to: Date.parse(at('09:05')), idleMs: 10 * 60_000 });
  assert.deepEqual([cut.workingHours, cut.waitingHours], [0, 0.08]);
});

test('what ended a wait is read from the entry that ended it', () => {
  assert.equal(endedBy(typed('10:00')), 'his words');
  assert.equal(endedBy(peer('10:00')), 'a message of another session');
  assert.equal(endedBy({ type: 'user', timestamp: at('10:00'), message: { content: '<task-notification>x</task-notification>' } }), 'an event of the app or a task');
  assert.equal(endedBy(undefined), 'nothing before the end');
});

test('main reads the project and sibling worktree folders of a temp Claude home, a named window, and the silent apart', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { main } = await import('./away-hours.mjs');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-away-hours-'));
  const root = path.join(home, 'repo');
  const slug = path.resolve(root).replace(/[^A-Za-z0-9]/g, '-');
  const write = (folder, id, entries) => {
    fs.mkdirSync(path.join(home, 'projects', folder), { recursive: true });
    fs.writeFileSync(path.join(home, 'projects', folder, `${id}.jsonl`), entries.map((e) => JSON.stringify(e)).join('\n'));
  };
  write(slug, 'aaaaaaaa-1', [{ type: 'custom-title', customTitle: 'JH 1 · lead' }, typed('09:00'), reply('09:05'), typed('13:00')]);
  write(`${slug}-worktrees-x`, 'bbbbbbbb-2', [{ type: 'custom-title', customTitle: 'JH 2 · work' }, reply('10:00', 'go', [{ name: 'Bash' }]), result('10:30', 't10:00'), reply('10:31')]);
  write(`${slug}--claude-worktrees-y`, 'cccccccc-3', [{ type: 'custom-title', customTitle: 'JH 3 · idle' }, reply('08:00')]);
  write('other-project', 'dddddddd-4', [typed('11:00')]);
  write(`${slug}-site`, 'eeeeeeee-5', [typed('11:00')]); // a sibling project, not a worktree: its message is not his absence's
  // A gate of JH 2 that queued 10 minutes for the lock before it started at 10:20, the shape `appendGateEvent` writes.
  fs.mkdirSync(path.join(home, '.js-harness', 'gate-log'), { recursive: true });
  fs.writeFileSync(path.join(home, '.js-harness', 'gate-log', 'log.jsonl'), `${JSON.stringify({ v: 1, event: 'start', id: 'g1', at: at('10:20'), cwd: root, command: 'check', pid: 1, session: 'bbbbbbbb-2', lock: 'ci', waitedSeconds: 600, waitedFor: [] })}\n`);
  const lines = [];
  try {
    assert.equal(main(['--since', at('00:00'), '--now', at('14:00'), '--root', root], { claudeHome: home, harnessHome: home, print: (line) => lines.push(line) }), 0);
    assert.match(lines[1], /^absence 2026-11-19T09:00:00.000Z -> 2026-11-19T13:00:00.000Z: 4 h, idle 10 min, his messages inside 0$/);
    assert.match(lines.join('\n'), /bbbbbbbb JH 2 · work: working 0.35 h, waiting 2.65 h \(gate lock 0.17 h\)/);
    assert.match(lines.join('\n'), /^inputs: 4 files \(3 transcripts, 1 of the gate log\), digest [0-9a-f]{16}$/m);
    lines.length = 0;
    // Archived at 10:31, JH 2 waits no longer after it.
    main(['--since', at('00:00'), '--now', at('14:00'), '--root', root, '--archive', 'bbbbbbbb=' + at('10:31')], { claudeHome: home, harnessHome: home, print: (line) => lines.push(line) });
    assert.match(lines.join('\n'), /bbbbbbbb JH 2 · work: working 0.35 h, waiting 0.17 h/);
    assert.throws(() => main(['--since', at('00:00'), '--archive', 'bbbbbbbb'], { claudeHome: home }), /--archive is <session>=<iso>/);
    assert.throws(() => main(['--since', at('00:00'), '--root', root, '--archive', '=' + at('10:00')], { claudeHome: home, harnessHome: home }), /--archive is <session>=<iso>/);
    assert.throws(() => main(['--since', at('00:00'), '--root', root, '--archive', 'zz=' + at('10:00')], { claudeHome: home, harnessHome: home }), /--archive zz names 0 sessions, not one/);
    assert.match(lines.join('\n'), /no entry inside .*: 1: cccccccc JH 3 · idle/);
    lines.length = 0;
    main(['--since', at('00:00'), '--root', root, '--from', at('10:00'), '--to', at('11:00')], { claudeHome: home, harnessHome: home, print: (line) => lines.push(line) });
    assert.match(lines[1], /^window .*: 1 h/);
    assert.throws(() => main(['--since', at('00:00'), '--from', at('10:00')], { claudeHome: home }), /go together/);
    assert.throws(() => main(['--bogus'], { claudeHome: home }), /unknown argument: --bogus/);
    assert.throws(() => main(['--since', 'yesterday'], { claudeHome: home }), /--since is a time/);
    assert.throws(() => main(['--since', at('00:00'), '--idle', 'ten'], { claudeHome: home }), /--idle is a number/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a call is work only until its own result: a spanning call stays work across other entries, a missing result does not', () => {
  // The Bash call of 10:00 runs to its result at 11:00; a progress entry at 10:20 does not end it.
  const spanning = activityOf([reply('10:00', 'go', [{ name: 'Bash' }]), attach('10:20'), result('11:00', 't10:00'), reply('11:01')], span('10:00', '11:01'));
  assert.deepEqual([spanning.workingHours, spanning.waitingHours, spanning.launchHours], [1.02, 0, 0]);
  // A call whose result never comes, and a result of another call, do not make the gap work.
  const missing = activityOf([reply('10:00', 'go', [{ name: 'Bash' }]), result('11:00', 'other'), reply('11:01')], span('10:00', '11:01'));
  assert.deepEqual([missing.workingHours, missing.waitingHours], [0.02, 1]);
  assert.equal(spans(missing), 1.02);
});

test('an app start pending is launch latency, overlapping starts count once, and another call under it is work', () => {
  const start = (id) => ({ name: 'mcp__ccd_session__start_session', id });
  const entries = [
    reply('21:00', 'start two', [start('s1')]),
    reply('21:10', 'and one more', [start('s2')]), // overlaps s1 from 21:10 to 22:00
    result('22:00', 's1'),
    result('22:30', 's2'),
    reply('22:31'),
  ];
  const a = activityOf(entries, span('21:00', '22:31'));
  assert.deepEqual([a.workingHours, a.waitingHours, a.launchHours], [0.02, 0, 1.5]);
  assert.equal(spans(a), 1.52);
  const mixed = activityOf([reply('21:00', 'x', [start('s1'), { name: 'Bash', id: 'b1' }]), result('21:30', 'b1'), result('22:00', 's1'), reply('22:01')], span('21:00', '22:01'));
  assert.deepEqual([mixed.workingHours, mixed.launchHours], [0.52, 0.5]);
});

test('an archive ends the session there, and a gate that queued for the lock waits under its call', () => {
  const entries = [reply('10:00', 'go', [{ name: 'Bash' }]), result('10:30', 't10:00'), reply('10:31')];
  const archived = activityOf(entries, span('10:00', '12:00', { archivedAt: Date.parse(at('11:00')) }));
  assert.deepEqual([archived.workingHours, archived.waitingHours], [0.52, 0.48]); // not to 12:00
  assert.equal(activityOf(entries, span('10:00', '12:00', { archivedAt: Date.parse(at('09:00')) })).inside, 0);
  // The gate started under the call at 10:00 and waited 20 minutes for the lock before its sensors ran.
  const locked = activityOf(entries, span('10:00', '10:31', { lockWaits: [[Date.parse(at('10:00')), Date.parse(at('10:20'))]] }));
  assert.deepEqual([locked.workingHours, locked.waitingHours, locked.lockHours], [0.18, 0.33, 0.33]);
  assert.deepEqual([locked.waits[0].from, locked.waits[0].to, locked.waits[0].endedBy], [at('10:00'), at('10:20'), "the machine's gate lock"]);
  assert.ok(Math.abs(spans(locked) - 0.52) < 0.02); // 31 minutes, each part rounded
});

test('copied history counts once, in the transcript that began first, and the manifest pins each input', () => {
  const e = (uuid, hhmm) => ({ ...typed(hhmm), uuid });
  const sessions = dedupeByUuid([
    { id: 'copy', entries: [e('u1', '09:00'), e('u2', '09:05'), e('u9', '11:00')] },
    { id: 'orig', entries: [e('u0', '08:00'), e('u1', '09:00'), e('u2', '09:05')] },
  ]);
  assert.deepEqual(sessions.map((s) => [s.id, s.entries.map((x) => x.uuid), s.copied]), [['copy', ['u9'], 2], ['orig', ['u0', 'u1', 'u2'], 0]]);
  const m = manifestOf([{ file: 'a.jsonl', text: 'x\n' }, { file: 'b.jsonl', text: 'y\n' }]);
  assert.equal(m.files.length, 2);
  assert.match(m.files[0].sha256, /^[0-9a-f]{64}$/);
  assert.equal(m.digest, manifestOf([{ file: 'a.jsonl', text: 'x\n' }, { file: 'b.jsonl', text: 'y\n' }]).digest);
  assert.notEqual(m.digest, manifestOf([{ file: 'a.jsonl', text: 'z\n' }, { file: 'b.jsonl', text: 'y\n' }]).digest);
});

// A temp Claude home with one project folder per `folders` key, each `{ id: entries }`, for `main`'s own tests.
async function withHome(folders, body) {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { main } = await import('./away-hours.mjs');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-away-hours-'));
  const root = path.join(home, 'repo');
  const slug = path.resolve(root).replace(/[^A-Za-z0-9]/g, '-');
  const write = (folder, id, entries) => {
    fs.mkdirSync(path.join(home, 'projects', folder), { recursive: true });
    fs.writeFileSync(path.join(home, 'projects', folder, `${id}.jsonl`), entries.map((e) => JSON.stringify(e)).join('\n'));
  };
  for (const [suffix, sessions] of Object.entries(folders)) for (const [id, entries] of Object.entries(sessions)) write(slug + suffix, id, entries);
  const lines = [];
  const run = (argv, options = {}) => main(argv, { claudeHome: home, harnessHome: home, print: (line) => lines.push(line), ...options });
  try {
    await body({ run, lines, root, home, slug, write, path });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test('a session whose call runs across the whole window is a row with its work, not dropped', async () => {
  await withHome({ '': { 'aaaaaaaa-1': [{ type: 'custom-title', customTitle: 'JH 1 · gate' }, reply('09:50', 'go', [{ name: 'Bash' }]), result('11:10', 't09:50'), reply('11:11')] } }, async ({ run, lines, root }) => {
    run(['--since', at('00:00'), '--root', root, '--from', at('10:00'), '--to', at('11:00')]);
    assert.match(lines.join('\n'), /aaaaaaaa JH 1 · gate: working 1 h, waiting 0 h/);
    assert.match(lines.join('\n'), /total of the 1 sessions with an entry or a running call inside: working 1 h/);
  });
});

test('the folders read are the checkout, the worktrees git lists wherever they are, and the worktree folders by name', async () => {
  const session = (title) => [{ type: 'custom-title', customTitle: title }, typed('10:00'), reply('10:05')];
  await withHome({ '': { 'aaaaaaaa-1': session('JH 1 · lead') }, '--claude-worktrees-y': { 'bbbbbbbb-2': session('JH 2 · app tree') }, '-worktrees-x': { 'cccccccc-3': session('JH 3 · sibling tree') }, '--site': { 'dddddddd-4': session('JH 4 · other repo') } }, async ({ run, lines, root, home, write, path }) => {
    const elsewhere = path.join(home, 'elsewhere', 'tree');
    write(path.resolve(elsewhere).replace(/[^A-Za-z0-9]/g, '-'), 'eeeeeeee-5', session('JH 5 · listed tree'));
    const git = (command, args) => (args[0] === 'worktree' ? { status: 0, stdout: `worktree ${root}\0HEAD 1\0\0worktree ${elsewhere}\0HEAD 2\0\0` } : { status: 1, stdout: '' });
    run(['--since', at('00:00'), '--root', root, '--from', at('10:00'), '--to', at('11:00')], { run: git });
    const out = lines.join('\n');
    for (const id of ['aaaaaaaa', 'bbbbbbbb', 'cccccccc', 'eeeeeeee']) assert.match(out, new RegExp(`${id} JH`));
    assert.doesNotMatch(out, /dddddddd/);
  });
});

test('a shell call waits when one of its steps runs the wait, not when its text only names it', () => {
  const under = (command) => activityOf([reply('10:00', 'go', [{ name: 'Bash', input: { command } }]), result('11:00', 't10:00'), reply('11:01')], span('10:00', '11:01'));
  assert.deepEqual([under("echo 'js-harness wait'").workingHours, under("echo 'js-harness wait'").waitingHours], [1.02, 0]);
  assert.equal(under('node bin/js-harness.mjs wait --pr 930').waitingHours, 1);
  assert.equal(under('cd D:/x && js-harness wait --notice-to 3').waitingHours, 1);
  assert.equal(under('sleep 600').waitingHours, 1);
});

test('a queued message timed only on its attachment ends a wait like any entry', () => {
  const queued = { type: 'attachment', attachment: { type: 'queued_command', origin: { kind: 'human' }, humanTurn: true, prompt: 'hola', timestamp: at('11:00') } };
  const a = activityOf([reply('10:00'), queued, reply('11:01')], span('10:00', '11:01'));
  assert.deepEqual(a.waits.map((w) => [w.from, w.to, w.endedBy]), [[at('10:00'), at('11:00'), 'his words']]);
});

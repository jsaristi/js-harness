import { test } from 'node:test';
import assert from 'node:assert/strict';
import { absencesOf, activityOf, endedBy } from './away-hours.mjs';

// workshop/lib/away-hours.mjs (odd/tasks/away-work.md): his absences from his message times, and each session's
// working and waiting hours inside one, from inline transcript entries; nothing is read from the machine.

const at = (hhmm) => `2026-11-19T${hhmm}:00.000Z`;
const reply = (hhmm, text = 'done', tools = []) => ({ type: 'assistant', timestamp: at(hhmm), message: { role: 'assistant', content: [{ type: 'text', text }, ...tools.map((t) => ({ type: 'tool_use', id: `t${hhmm}`, name: t.name, input: t.input ?? {} }))] } });
const result = (hhmm) => ({ type: 'user', timestamp: at(hhmm), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }] } });
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
    result('10:40'), // 40 min under a running tool: work
    reply('10:45'), // 5 min: work
    peer('11:45'), // 60 min idle after a closing reply: a wait, ended by another session
    reply('11:50', 'waiting', [{ name: 'Bash', input: { command: 'js-harness wait --pr 930' } }]),
    result('12:50'), // 60 min under a call that waits: a wait
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
  write(`${slug}-worktrees-x`, 'bbbbbbbb-2', [{ type: 'custom-title', customTitle: 'JH 2 · work' }, reply('10:00', 'go', [{ name: 'Bash' }]), result('10:30'), reply('10:31')]);
  write(`${slug}--claude-worktrees-y`, 'cccccccc-3', [{ type: 'custom-title', customTitle: 'JH 3 · idle' }, reply('08:00')]);
  write('other-project', 'dddddddd-4', [typed('11:00')]);
  write(`${slug}-site`, 'eeeeeeee-5', [typed('11:00')]); // a sibling project, not a worktree: its message is not his absence's
  const lines = [];
  try {
    assert.equal(main(['--since', at('00:00'), '--now', at('14:00'), '--root', root], { claudeHome: home, print: (line) => lines.push(line) }), 0);
    assert.match(lines[0], /^absence 2026-11-19T09:00:00.000Z -> 2026-11-19T13:00:00.000Z: 4 h, idle 10 min, his messages inside 0$/);
    assert.match(lines.join('\n'), /bbbbbbbb JH 2 · work: working 0.52 h, waiting 2.48 h/);
    assert.match(lines.join('\n'), /no entry inside .*: 1: cccccccc JH 3 · idle/);
    lines.length = 0;
    main(['--since', at('00:00'), '--root', root, '--from', at('10:00'), '--to', at('11:00')], { claudeHome: home, print: (line) => lines.push(line) });
    assert.match(lines[0], /^window .*: 1 h/);
    assert.throws(() => main(['--since', at('00:00'), '--from', at('10:00')], { claudeHome: home }), /go together/);
    assert.throws(() => main(['--bogus'], { claudeHome: home }), /unknown argument: --bogus/);
    assert.throws(() => main(['--since', 'yesterday'], { claudeHome: home }), /--since is a time/);
    assert.throws(() => main(['--since', at('00:00'), '--idle', 'ten'], { claudeHome: home }), /--idle is a number/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

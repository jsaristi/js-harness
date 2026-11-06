import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BACKGROUND_SCHEMA, LOCK_WAIT_MS, RM_TRIES, backgroundChanges, backgroundOf, idOfStart, readRecord, recordFileOf, resumedChain, startArgs, undoSession, worktreeHolding, worktreeOf } from './background.mjs';

test('idOfStart reads the id claude --bg prints, and the attach hint when the first line is missing', () => {
  assert.equal(idOfStart('backgrounded · 0db8bc5e · jh-bg-probe-1\n  claude agents             list sessions\n'), '0db8bc5e');
  assert.equal(idOfStart('started\n  claude attach c779ed44    open in this terminal\n'), 'c779ed44');
  assert.equal(idOfStart('Workspace not trusted.'), null);
});

// odd/tasks/stop-keeps-worktree.md: what sessions stop refuses to hand to claude rm.
test('worktreeHolding names what a worktree holds besides .git, and counts one it cannot read as holding files', () => {
  const entry = { root: path.join(os.tmpdir(), 'proj'), worktree: 'thing' };
  const worktree = path.join(entry.root, '.claude', 'worktrees', 'thing');
  const reading = (names) => (folder) => {
    assert.equal(folder, worktree);
    return names;
  };
  const failing = (code) => () => {
    throw Object.assign(new Error(code), { code });
  };
  assert.equal(worktreeHolding({ root: entry.root }), null, 'no worktree');
  assert.equal(worktreeHolding(entry, { readdir: failing('ENOENT') }), null, 'not there');
  assert.equal(worktreeHolding(entry, { readdir: reading(['.git']) }), null, 'only .git');
  assert.equal(worktreeHolding(entry, { readdir: reading([]) }), null, 'empty');
  assert.deepEqual(worktreeHolding(entry, { readdir: reading(['.git', 'src', 'a.js']) }), { worktree, holds: 'a.js, src' });
  assert.deepEqual(worktreeHolding(entry, { readdir: reading(['e', 'd', 'c', 'b', 'a']) }), { worktree, holds: 'a, b, c and 2 more' });
  assert.deepEqual(worktreeHolding(entry, { readdir: failing('EPERM') }), { worktree, holds: 'it could not be read: EPERM' });
});

test('startArgs puts --add-dir first, so -n ends its list of folders, and the prompt last', () => {
  assert.deepEqual(startArgs({ title: 'T', briefs: 'B', prompt: 'P', remoteControl: false }), ['--bg', '--add-dir', 'B', '-n', 'T', 'P']);
});

test('readRecord holds the sessions started and not removed, and counts the lines it cannot read', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-bg-record-'));
  try {
    assert.deepEqual(readRecord(home), { none: true, sessions: [], started: [], resumedAs: new Map() });
    fs.mkdirSync(path.dirname(recordFileOf(home)), { recursive: true });
    const line = (entry) => JSON.stringify({ schema: BACKGROUND_SCHEMA, ...entry });
    fs.writeFileSync(recordFileOf(home), [
      line({ event: 'started', id: 'aaaa1111', title: 'A' }),
      line({ event: 'started', id: 'bbbb2222', title: 'B' }),
      '{not json',
      JSON.stringify({ event: 'started', id: 'cccc3333' }),
      line({ event: 'removed', id: 'aaaa1111' }),
      '',
    ].join('\n'));
    const record = readRecord(home);
    assert.deepEqual(record.sessions.map((entry) => entry.id), ['bbbb2222']);
    // Every start is kept apart from what is open: a removed session's title still holds its number.
    assert.deepEqual(record.started.map((entry) => entry.id), ['aaaa1111', 'bbbb2222']);
    assert.equal(record.skipped, 2);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// Codex P1 on 79e3430..318f952: a job a resume replaced shares its worktree and brief with the new one, so it is not
// undone or resumed by itself.
test('readRecord names the sessions a recorded resume replaced, and resumedChain the jobs each one resumed', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-bg-record-'));
  try {
    assert.deepEqual(readRecord(home).resumedAs, new Map());
    fs.mkdirSync(path.dirname(recordFileOf(home)), { recursive: true });
    const line = (entry) => JSON.stringify({ schema: BACKGROUND_SCHEMA, event: 'started', ...entry });
    fs.writeFileSync(recordFileOf(home), [
      line({ id: 'aaaa1111', title: 'A' }),
      line({ id: 'bbbb2222', title: 'A', resumedFrom: 'aaaa1111' }),
      line({ id: 'cccc3333', title: 'A', resumedFrom: 'bbbb2222' }),
      line({ id: 'dddd4444', title: 'D' }),
      line({ id: 'eeee5555', title: 'D', resumedFrom: 'dddd4444' }),
      JSON.stringify({ schema: BACKGROUND_SCHEMA, event: 'removed', id: 'eeee5555' }),
    ].join('\n'));
    const record = readRecord(home);
    assert.deepEqual([...record.resumedAs].map(([id, entry]) => [id, entry.id]), [['aaaa1111', 'bbbb2222'], ['bbbb2222', 'cccc3333']]);
    const last = record.sessions.find((entry) => entry.id === 'cccc3333');
    assert.deepEqual(resumedChain(record.started, last).map((entry) => entry.id), ['bbbb2222', 'aaaa1111']);
    assert.deepEqual(resumedChain(record.started, record.sessions.find((entry) => entry.id === 'dddd4444')), []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// Codex P2 on 79e3430..318f952: a main checkout may bear the worktree's name; it is not the worktree.
test('worktreeOf takes the recorded folder only when it is not the main checkout', () => {
  const root = path.resolve('/work/thing');
  assert.equal(worktreeOf({ root, worktree: 'thing', worktreePath: root }), path.join(root, '.claude', 'worktrees', 'thing'));
  const elsewhere = path.resolve('/work/thing-worktrees/thing');
  assert.equal(worktreeOf({ root, worktree: 'thing', worktreePath: elsewhere }), elsewhere);
  assert.equal(worktreeOf({ root, worktree: null, worktreePath: root }), null);
});

test('backgroundOf keeps the background sessions in the project\'s folders, Windows paths compared without case', () => {
  const agents = [
    { id: 'aaaa1111', kind: 'background', cwd: 'D:\\JS-Harness\\.claude\\worktrees\\x', name: 'In', status: 'idle', state: 'done', startedAt: 0 },
    { id: 'bbbb2222', kind: 'background', cwd: 'D:\\js-harness-other', name: 'Beside', status: 'busy' },
    { kind: 'interactive', cwd: 'D:\\js-harness', name: 'Interactive', status: 'busy' },
  ];
  const items = backgroundOf(agents, { roots: ['D:\\js-harness'], recorded: [{ id: 'dddd4444', title: 'Lost', cwd: 'D:\\js-harness', at: '2026-10-24T00:00:00.000Z' }], platform: 'win32' });
  assert.deepEqual(items.map((item) => [item.id, item.recorded, item.listed]), [['aaaa1111', false, true], ['dddd4444', true, false]]);
});

test('backgroundChanges names a session that waits now, and compares nothing when a look could not list', () => {
  const look = (status) => ({ available: true, items: [{ id: 'aaaa1111', title: 'A', status, waitingFor: 'permission prompt' }] });
  assert.deepEqual(backgroundChanges(look('busy'), look('waiting')), ['background session aaaa1111 · A waits for permission prompt']);
  assert.deepEqual(backgroundChanges(look('waiting'), look('waiting')), []);
  assert.deepEqual(backgroundChanges({ available: false, reason: 'x' }, look('waiting')), []);
});

// What claude rm said on 2026-10-31 to the lead (its transcript 0f71b2c6, 05:58Z): first the lock, while the job's
// process was still ending after claude stop, then, with that process gone, files of the worktree still held.
const LOCKED = (id, pid) => `kept ${id} — its worktree is still at “D:/js-harness/.claude/worktrees/thing”\n  A Claude Code lock on the worktree names a process that is still running (pid ${pid}).\n  exit that session, or run 'git worktree unlock' on the worktree if the process is unrelated, then run 'claude rm ${id}' again`;
const BUSY = (id) => `  Worktree not removed. Claude Code couldn't remove it (“some of its files could not be deleted: EBUSY; a program may have them open, so try removing it again”). The session stays until the directory is gone.\n  close anything using the directory or fix its permissions, then retry: claude rm ${id} --force-remove-worktree f98bcff49ef0a4f1807575c96fccc98e`;

/** A home with an empty record, a clock that only `pause` moves, and a claude whose rm answers from `answers` in turn. */
function undoWorld(answers) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-undo-'));
  let clock = Date.parse('2026-11-02T10:00:00Z');
  const calls = [];
  const paused = [];
  const run = (args) => {
    calls.push(args);
    if (args[0] === 'stop') return { status: 0, stdout: `stopped ${args[1]}`, stderr: '' };
    const said = answers.length > 1 ? answers.shift() : answers[0];
    return said === null ? { status: 0, stdout: `removed ${args[1]}`, stderr: '' } : { status: 1, stdout: said, stderr: '' };
  };
  const options = { home, run, now: () => clock, pause: (ms) => { paused.push(ms); clock += ms; } };
  return { home, calls, paused, options };
}

const entry = { id: '4a9694ea', title: 'JH 114 · commits', cwd: 'D:\js-harness' };

test('undoSession waits for the process claude\'s lock names, then removes the session', (t) => {
  const world = undoWorld([LOCKED('4a9694ea', 48324), null]);
  t.after(() => fs.rmSync(world.home, { recursive: true, force: true }));
  let looks = 0;
  const done = undoSession(entry, { ...world.options, alive: (pid) => pid === 48324 && (looks += 1) < 3 });
  assert.equal(done.outcome, 'removed');
  assert.deepEqual(world.calls, [['stop', '4a9694ea'], ['rm', '4a9694ea'], ['rm', '4a9694ea']]);
  assert.equal(looks, 3, 'it looked until the process was gone');
  assert.equal(readRecord(world.home).sessions.length, 0);
});

test('undoSession keeps the session when the lock\'s process outlives the wait, and says which', (t) => {
  const world = undoWorld([LOCKED('4a9694ea', 48324)]);
  t.after(() => fs.rmSync(world.home, { recursive: true, force: true }));
  const done = undoSession(entry, { ...world.options, alive: () => true });
  assert.equal(done.outcome, 'kept');
  assert.match(done.why, /pid 48324, still ran 60 s after claude stop/);
  assert.deepEqual(world.calls, [['stop', '4a9694ea'], ['rm', '4a9694ea']]);
  assert.ok(world.paused.reduce((sum, ms) => sum + ms, 0) >= LOCK_WAIT_MS, 'it waited the whole bound');
});

test('undoSession tries claude rm again while claude says the worktree\'s files are busy, up to its tries', (t) => {
  const freed = undoWorld([BUSY('4a9694ea'), BUSY('4a9694ea'), null]);
  t.after(() => fs.rmSync(freed.home, { recursive: true, force: true }));
  assert.equal(undoSession(entry, { ...freed.options, alive: () => false }).outcome, 'removed');
  assert.equal(freed.calls.filter((call) => call[0] === 'rm').length, 3);
  const held = undoWorld([BUSY('4a9694ea')]);
  t.after(() => fs.rmSync(held.home, { recursive: true, force: true }));
  const done = undoSession(entry, { ...held.options, alive: () => false });
  assert.equal(done.outcome, 'kept');
  assert.match(done.why, /EBUSY/);
  assert.equal(held.calls.filter((call) => call[0] === 'rm').length, RM_TRIES);
});

test('undoSession tries nothing again when claude refuses for another reason', (t) => {
  const world = undoWorld(['Worktree has 2 unpushed commits: pass --discard-unpushed abc@wt1 to discard them']);
  t.after(() => fs.rmSync(world.home, { recursive: true, force: true }));
  const done = undoSession(entry, { ...world.options, alive: () => true });
  assert.equal(done.outcome, 'kept');
  assert.deepEqual(world.calls, [['stop', '4a9694ea'], ['rm', '4a9694ea']]);
  assert.deepEqual(world.paused, []);
});

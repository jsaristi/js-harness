import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BACKGROUND_SCHEMA, backgroundChanges, backgroundOf, idOfStart, readRecord, recordFileOf, resumedChain, startArgs, worktreeOf } from './background.mjs';

test('idOfStart reads the id claude --bg prints, and the attach hint when the first line is missing', () => {
  assert.equal(idOfStart('backgrounded · 0db8bc5e · jh-bg-probe-1\n  claude agents             list sessions\n'), '0db8bc5e');
  assert.equal(idOfStart('started\n  claude attach c779ed44    open in this terminal\n'), 'c779ed44');
  assert.equal(idOfStart('Workspace not trusted.'), null);
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

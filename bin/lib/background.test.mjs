import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BACKGROUND_SCHEMA, backgroundChanges, backgroundOf, idOfStart, readRecord, recordFileOf, startArgs } from './background.mjs';

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
    assert.deepEqual(readRecord(home), { none: true, sessions: [] });
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
    assert.equal(record.skipped, 2);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { statusLineOf, statusLineFile, writeStatusLine, LINE_LIMIT } from './status-line.mjs';

const RED = '\u001b[31m';
const RESET = '\u001b[0m';
const board = (parts = {}) => ({
  sessions: [{ state: 'working' }, { state: 'working' }, { state: 'waiting' }],
  questions: { open: [] },
  pullRequests: { available: true, items: [{ number: 726 }] },
  gateLock: { available: true, holder: null, waiters: [] },
  ...parts,
});

test('statusLineOf says the board in one Spanish line: questions, sessions working and waiting, pull requests, the gate', () => {
  assert.equal(statusLineOf(board()), '0 preguntas · 2 trabajando · 1 esperando · 1 PR · gate libre');
  assert.equal(statusLineOf(board({ gateLock: { available: true, holder: { pid: 4 }, waiters: [{}, {}] } })), '0 preguntas · 2 trabajando · 1 esperando · 1 PR · gate ocupado, 2 en cola');
});

test('statusLineOf paints the questions red when one waits for him, and says what it could not read', () => {
  assert.equal(statusLineOf(board({ questions: { open: [{}] } })), `${RED}1 pregunta${RESET} · 2 trabajando · 1 esperando · 1 PR · gate libre`);
  const unread = statusLineOf({ sessions: [], questions: {}, pullRequests: { available: false }, gateLock: { available: false } });
  assert.equal(unread, '? preguntas · 0 trabajando · 0 esperando · ? PR · gate ?');
});

test('statusLineOf never passes the host limit of 200 characters', () => {
  const many = board({ sessions: Array.from({ length: 5000 }, () => ({ state: 'working' })) });
  assert.ok(statusLineOf(many).length <= LINE_LIMIT);
  assert.equal(LINE_LIMIT, 200);
});

test('writeStatusLine writes the line and its time under the harness home whole, through a file it renames', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'status-line-'));
  try {
    const file = writeStatusLine({ home, line: 'una línea', now: Date.parse('2026-10-31T03:00:00Z') });
    assert.equal(file, statusLineFile(home));
    assert.equal(file, path.join(home, '.js-harness', 'status-line', 'line.txt'));
    assert.equal(fs.readFileSync(file, 'utf8'), '2026-10-31T03:00:00.000Z\nuna línea\n');
    assert.deepEqual(fs.readdirSync(path.dirname(file)), ['line.txt'], 'no temporary file is left');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('writeStatusLine tries the rename again while a reader holds the file, and leaves no temporary file when it never can', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'status-line-'));
  const held = (times) => {
    let left = times;
    return { ...fs, renameSync: (from, to) => {
      if (left > 0) {
        left -= 1;
        throw Object.assign(new Error('EPERM: operation not permitted, rename'), { code: 'EPERM' });
      }
      fs.renameSync(from, to);
    } };
  };
  try {
    writeStatusLine({ home, line: 'tras dos intentos', now: Date.parse('2026-10-31T03:00:00Z'), fileSystem: held(2) });
    assert.equal(fs.readFileSync(statusLineFile(home), 'utf8'), '2026-10-31T03:00:00.000Z\ntras dos intentos\n');
    assert.throws(() => writeStatusLine({ home, line: 'nunca', now: Date.now(), fileSystem: held(Infinity) }), /EPERM/);
    assert.deepEqual(fs.readdirSync(path.dirname(statusLineFile(home))), ['line.txt'], 'the staged file is removed');
    assert.equal(fs.readFileSync(statusLineFile(home), 'utf8'), '2026-10-31T03:00:00.000Z\ntras dos intentos\n');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

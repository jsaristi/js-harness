// Tests for readRecords, the reader of session records for `js-harness rules applied`.
// Each test builds its records in a temporary folder with fs.utimesSync set times; the folders
// are removed when the file's tests end.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readRecords } from './rules-applied-read.mjs';

const HOUR = 3_600_000;
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 12, 12); // 2026-10-12 12:00 UTC
const LAUNCH_KEYS = ['agentType', 'alias', 'at', 'effort', 'entrypoint', 'file', 'model', 'version'];
const SESSION_KEYS = ['at', 'effort', 'entrypoint', 'file', 'model', 'version'];

const folders = [];
after(() => {
  for (const dir of folders) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * Makes a temporary project folder holding `files`, each `{ path, text, mtime }`: a path under the
 * folder, its text, and its modification time in milliseconds. Gives the folder's path.
 */
function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-applied-'));
  folders.push(dir);
  for (const f of files) {
    const abs = path.join(dir, f.path);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, f.text);
    fs.utimesSync(abs, f.mtime / 1000, f.mtime / 1000);
  }
  return dir;
}

/** One assistant line, with the keys of `patch` replacing the default ones. */
function assistant(patch = {}) {
  return JSON.stringify({
    type: 'assistant',
    version: '2.1.0',
    entrypoint: 'cli',
    effort: 'high',
    timestamp: '2026-09-10T09:00:00.000Z',
    message: { model: 'claude-haiku-5-5' },
    ...patch,
  }) + '\n';
}

/** One user line. */
function user(text = 'hello') {
  return JSON.stringify({ type: 'user', message: { role: 'user', content: text } }) + '\n';
}

/** `lines` user lines of about 1 KB each, to push what follows past the first 64 KB. */
function padding(lines) {
  return Array.from({ length: lines }, () => user('p'.repeat(1000))).join('');
}

test('a folder that does not exist gives exists false and everything empty', () => {
  const missing = path.join(os.tmpdir(), `rules-applied-missing-${process.pid}-${Date.now()}`);
  assert.deepEqual(readRecords(missing, { now: NOW }), {
    exists: false,
    launches: [],
    sessions: [],
    unreadable: [],
    files: { launches: 0, sessions: 0 },
    capped: false,
  });
});

test('a launch with a meta file gives every key, with the meta alias and agentType, the answer effort, and the file in forward slashes', () => {
  const dir = project([
    { path: 'proj-a/subagents/agent-1.jsonl', text: assistant(), mtime: NOW - HOUR },
    {
      path: 'proj-a/subagents/agent-1.meta.json',
      text: JSON.stringify({ model: 'haiku', effort: 'low', agentType: 'Explore' }),
      mtime: NOW - HOUR,
    },
  ]);
  const got = readRecords(dir, { now: NOW });
  assert.equal(got.exists, true);
  assert.deepEqual(got.launches, [{
    alias: 'haiku',
    model: 'claude-haiku-5-5',
    effort: 'high',
    agentType: 'Explore',
    entrypoint: 'cli',
    version: '2.1.0',
    at: '2026-09-10T09:00:00.000Z',
    file: 'proj-a/subagents/agent-1.jsonl',
  }]);
  assert.deepEqual(got.unreadable, []);
});

test('a launch with no meta file, or a meta file that is not JSON, gives three nulls and no unreadable', () => {
  const noMeta = project([
    { path: 'proj-a/subagents/agent-1.jsonl', text: assistant({ effort: undefined }), mtime: NOW - HOUR },
  ]);
  const badMeta = project([
    { path: 'proj-b/subagents/agent-2.jsonl', text: assistant({ effort: undefined }), mtime: NOW - HOUR },
    { path: 'proj-b/subagents/agent-2.meta.json', text: '{not json', mtime: NOW - HOUR },
  ]);
  for (const dir of [noMeta, badMeta]) {
    const got = readRecords(dir, { now: NOW });
    assert.equal(got.launches.length, 1);
    assert.equal(got.launches[0].alias, null);
    assert.equal(got.launches[0].agentType, null);
    assert.equal(got.launches[0].effort, null);
    assert.deepEqual(got.unreadable, []);
  }
});

test('a launch whose meta has no effort takes the entry effort', () => {
  const dir = project([
    { path: 'proj-a/subagents/agent-1.jsonl', text: assistant({ effort: 'high' }), mtime: NOW - HOUR },
    { path: 'proj-a/subagents/agent-1.meta.json', text: JSON.stringify({ model: 'haiku' }), mtime: NOW - HOUR },
  ]);
  const [item] = readRecords(dir, { now: NOW }).launches;
  assert.equal(item.effort, 'high');
  assert.equal(item.alias, 'haiku');
});

test('a launch whose meta asks for high and whose answer says medium gives medium', () => {
  const dir = project([
    { path: 'proj-a/subagents/agent-1.jsonl', text: assistant({ effort: 'medium' }), mtime: NOW - HOUR },
    { path: 'proj-a/subagents/agent-1.meta.json', text: JSON.stringify({ effort: 'high' }), mtime: NOW - HOUR },
  ]);
  const [item] = readRecords(dir, { now: NOW }).launches;
  assert.equal(item.effort, 'medium');
});

test('a launch whose meta asks for high and whose answer has no effort gives null', () => {
  const dir = project([
    { path: 'proj-a/subagents/agent-1.jsonl', text: assistant({ effort: undefined }), mtime: NOW - HOUR },
    { path: 'proj-a/subagents/agent-1.meta.json', text: JSON.stringify({ effort: 'high' }), mtime: NOW - HOUR },
  ]);
  const [item] = readRecords(dir, { now: NOW }).launches;
  assert.equal(item.effort, null);
});

test('a meta whose model is a number gives alias null', () => {
  const dir = project([
    { path: 'proj-a/subagents/agent-1.jsonl', text: assistant(), mtime: NOW - HOUR },
    { path: 'proj-a/subagents/agent-1.meta.json', text: JSON.stringify({ model: 7 }), mtime: NOW - HOUR },
  ]);
  const [item] = readRecords(dir, { now: NOW }).launches;
  assert.equal(item.alias, null);
});

test('the first assistant entry is taken, and lines before it that are not assistant entries are passed over', () => {
  const dir = project([
    {
      path: 'proj-a/subagents/agent-1.jsonl',
      text: user() + 'this line is not json\n\n'
        + assistant({ message: { model: 'first' }, effort: 'low' })
        + assistant({ message: { model: 'second' } }),
      mtime: NOW - HOUR,
    },
  ]);
  const got = readRecords(dir, { now: NOW });
  assert.equal(got.launches.length, 1);
  assert.equal(got.launches[0].model, 'first');
  assert.equal(got.launches[0].effort, 'low');
});

test('a launch whose first assistant entry starts after 64 KB is still found', () => {
  const text = padding(80) + assistant({ message: { model: 'late' } });
  assert.ok(Buffer.byteLength(text) > 64 * 1024);
  const dir = project([{ path: 'proj-a/subagents/agent-1.jsonl', text, mtime: NOW - HOUR }]);
  const got = readRecords(dir, { now: NOW });
  assert.equal(got.launches.length, 1);
  assert.equal(got.launches[0].model, 'late');
  assert.deepEqual(got.unreadable, []);
});

test('a launch with no assistant entry is unreadable with the launch reason', () => {
  const dir = project([{ path: 'proj-a/subagents/agent-1.jsonl', text: user() + user(), mtime: NOW - HOUR }]);
  const got = readRecords(dir, { now: NOW });
  assert.deepEqual(got.launches, []);
  assert.deepEqual(got.unreadable, [
    { file: 'proj-a/subagents/agent-1.jsonl', reason: 'no assistant entry in the first 1 MB' },
  ]);
  assert.deepEqual(got.files, { launches: 1, sessions: 0 });
});

test('a transcript with \\r\\n line ends reads the same as one with \\n', () => {
  const lf = user() + assistant({ message: { model: 'same' } }) + user();
  const crlf = lf.replace(/\n/g, '\r\n');
  const got = [lf, crlf].map((text) => readRecords(project([
    { path: 'proj-a/subagents/agent-1.jsonl', text, mtime: NOW - HOUR },
  ]), { now: NOW }).launches);
  assert.deepEqual(got[1], got[0]);
  assert.equal(got[1][0].model, 'same');
});

test('a launch modified ten days before now is not picked; one modified today is picked with its timestamp as it is', () => {
  const dir = project([
    { path: 'proj-old/subagents/agent-old.jsonl', text: assistant(), mtime: NOW - 10 * DAY },
    {
      path: 'proj-new/subagents/agent-new.jsonl',
      text: assistant({ timestamp: '2026-09-10T09:00:00.000Z' }),
      mtime: NOW - HOUR,
    },
  ]);
  const got = readRecords(dir, { now: NOW });
  assert.deepEqual(got.launches.map((item) => item.file), ['proj-new/subagents/agent-new.jsonl']);
  assert.equal(got.launches[0].at, '2026-09-10T09:00:00.000Z');
  assert.equal(got.files.launches, 1);
});

test('a session gives the LAST assistant entry, not the first', () => {
  const dir = project([
    {
      path: 'sess-1.jsonl',
      text: assistant({ message: { model: 'first' } }) + user() + assistant({ message: { model: 'last' } }) + user(),
      mtime: NOW - HOUR,
    },
  ]);
  assert.deepEqual(readRecords(dir, { now: NOW }).sessions, [{
    model: 'last',
    effort: 'high',
    entrypoint: 'cli',
    version: '2.1.0',
    at: '2026-09-10T09:00:00.000Z',
    file: 'sess-1.jsonl',
  }]);
});

test('a session whose last assistant entry is followed by more than 64 KB of other lines is still found', () => {
  const text = assistant({ message: { model: 'found' } }) + padding(100);
  assert.ok(Buffer.byteLength(text) > 64 * 1024);
  const dir = project([{ path: 'sess-1.jsonl', text, mtime: NOW - HOUR }]);
  const got = readRecords(dir, { now: NOW });
  assert.equal(got.sessions.length, 1);
  assert.equal(got.sessions[0].model, 'found');
});

test('a session with no assistant entry is unreadable with the session reason', () => {
  const dir = project([{ path: 'sess-2.jsonl', text: user() + user(), mtime: NOW - HOUR }]);
  const got = readRecords(dir, { now: NOW });
  assert.deepEqual(got.sessions, []);
  assert.deepEqual(got.unreadable, [{ file: 'sess-2.jsonl', reason: 'no assistant entry in the last 1 MB' }]);
});

test('a session under 64 KB whose only line is the assistant entry is found, so its first line is not dropped', () => {
  const dir = project([
    { path: 'sess-3.jsonl', text: assistant({ message: { model: 'only' } }).trimEnd(), mtime: NOW - HOUR },
  ]);
  const got = readRecords(dir, { now: NOW });
  assert.equal(got.sessions.length, 1);
  assert.equal(got.sessions[0].model, 'only');
  assert.deepEqual(got.unreadable, []);
});

test('maxFiles 1 with two recent launches keeps the newer one and reports capped', () => {
  const dir = project([
    { path: 'proj-a/subagents/agent-old.jsonl', text: assistant({ message: { model: 'old' } }), mtime: NOW - 2 * HOUR },
    { path: 'proj-a/subagents/agent-new.jsonl', text: assistant({ message: { model: 'new' } }), mtime: NOW - HOUR },
  ]);
  const got = readRecords(dir, { now: NOW, maxFiles: 1 });
  assert.deepEqual(got.launches.map((item) => item.file), ['proj-a/subagents/agent-new.jsonl']);
  assert.equal(got.capped, true);
  assert.equal(got.files.launches, 1);
});

test('launches come newest first, and two of the same time by path', () => {
  const dir = project([
    { path: 'a/subagents/agent-1.jsonl', text: assistant(), mtime: NOW - 3 * HOUR },
    { path: 'b/subagents/agent-2.jsonl', text: assistant(), mtime: NOW - HOUR },
    { path: 'c/subagents/agent-3.jsonl', text: assistant(), mtime: NOW - 2 * HOUR },
    { path: 'd/subagents/agent-4.jsonl', text: assistant(), mtime: NOW - HOUR },
    { path: 'e/subagents/agent-5.jsonl', text: assistant(), mtime: NOW - HOUR },
  ]);
  assert.deepEqual(readRecords(dir, { now: NOW }).launches.map((item) => item.file), [
    'b/subagents/agent-2.jsonl',
    'd/subagents/agent-4.jsonl',
    'e/subagents/agent-5.jsonl',
    'c/subagents/agent-3.jsonl',
    'a/subagents/agent-1.jsonl',
  ]);
});

test('sessions come newest first', () => {
  const dir = project([
    { path: 'x.jsonl', text: assistant(), mtime: NOW - 3 * HOUR },
    { path: 'y.jsonl', text: assistant(), mtime: NOW - HOUR },
    { path: 'z.jsonl', text: assistant(), mtime: NOW - 2 * HOUR },
  ]);
  assert.deepEqual(readRecords(dir, { now: NOW }).sessions.map((item) => item.file), [
    'y.jsonl',
    'z.jsonl',
    'x.jsonl',
  ]);
});

test('a folder named like a session with no subagents folder, and a non-jsonl file in the folder, are neither an error nor an item', () => {
  const dir = project([
    { path: 'sess-1/notes.txt', text: 'not a transcript', mtime: NOW - HOUR },
    { path: 'readme.txt', text: assistant(), mtime: NOW - HOUR },
  ]);
  assert.deepEqual(readRecords(dir, { now: NOW }), {
    exists: true,
    launches: [],
    sessions: [],
    unreadable: [],
    files: { launches: 0, sessions: 0 },
    capped: false,
  });
});

test('an item holds only its keys, never the message content or the cwd of the entry', () => {
  const entry = {
    cwd: '/private/project',
    message: { model: 'claude-haiku-5-5', content: [{ type: 'text', text: 'do not keep this' }] },
  };
  const dir = project([
    { path: 'proj-a/subagents/agent-1.jsonl', text: assistant(entry), mtime: NOW - HOUR },
    { path: 'sess-1.jsonl', text: assistant(entry), mtime: NOW - HOUR },
  ]);
  const got = readRecords(dir, { now: NOW });
  assert.deepEqual(Object.keys(got.launches[0]).sort(), LAUNCH_KEYS);
  assert.deepEqual(Object.keys(got.sessions[0]).sort(), SESSION_KEYS);
  const dump = JSON.stringify(got);
  assert.ok(!dump.includes('do not keep this'));
  assert.ok(!dump.includes('/private/project'));
});

test('a session whose last line is a synthetic answer after a real one gives the real one', () => {
  const dir = project([
    {
      path: 'sess-1.jsonl',
      text: assistant({ message: { model: 'real' } }) + user() + assistant({ message: { model: '<synthetic>' } }),
      mtime: NOW - HOUR,
    },
  ]);
  const got = readRecords(dir, { now: NOW });
  assert.equal(got.sessions.length, 1);
  assert.equal(got.sessions[0].model, 'real');
});

test('a launch whose first answer is synthetic and whose second is real gives the real one', () => {
  const dir = project([
    {
      path: 'proj-a/subagents/agent-1.jsonl',
      text: assistant({ message: { model: '<synthetic>' } }) + assistant({ message: { model: 'real' } }),
      mtime: NOW - HOUR,
    },
  ]);
  const got = readRecords(dir, { now: NOW });
  assert.equal(got.launches.length, 1);
  assert.equal(got.launches[0].model, 'real');
  assert.deepEqual(got.unreadable, []);
});

test('a session of synthetic answers only gives an item whose model is <synthetic>, and no unreadable', () => {
  const dir = project([
    {
      path: 'sess-1.jsonl',
      text: assistant({ message: { model: '<synthetic>' } }) + user() + assistant({ message: { model: '<synthetic>' } }),
      mtime: NOW - HOUR,
    },
  ]);
  const got = readRecords(dir, { now: NOW });
  assert.equal(got.sessions.length, 1);
  assert.equal(got.sessions[0].model, '<synthetic>');
  assert.deepEqual(got.unreadable, []);
});

test('a session whose real answer is more than 64 KB before a synthetic last line gives the real one', () => {
  const text = assistant({ message: { model: 'real' } }) + padding(100) + assistant({ message: { model: '<synthetic>' } });
  assert.ok(Buffer.byteLength(text) > 64 * 1024);
  const dir = project([{ path: 'sess-1.jsonl', text, mtime: NOW - HOUR }]);
  const got = readRecords(dir, { now: NOW });
  assert.equal(got.sessions.length, 1);
  assert.equal(got.sessions[0].model, 'real');
});

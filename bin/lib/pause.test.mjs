import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pauseNotice, readEnd, statePath } from './pause.mjs';
import { DEFAULT_CONTEXT_COMPACTION_PERCENT, DEFAULT_CONTEXT_PAUSE_PERCENT, DEFAULT_CONTEXT_WINDOW, percentOf, shareOf } from './sessions.mjs';

// Every test writes under a home of its own in the temp folder and reads synthetic transcripts: nothing
// here reads or writes the real home. The figures are computed from the exported constants, never written.

const SESSION = 'aaaaaaaa-1111-4111-8111-111111111111';
const NOW = Date.parse('2026-01-01T12:00:00.000Z');
const COMPACTION = shareOf(DEFAULT_CONTEXT_WINDOW, DEFAULT_CONTEXT_COMPACTION_PERCENT);
const WINDOW = (COMPACTION * 100) / DEFAULT_CONTEXT_COMPACTION_PERCENT;
const pauseAt = (compaction) => Math.round((compaction * DEFAULT_CONTEXT_PAUSE_PERCENT) / DEFAULT_CONTEXT_COMPACTION_PERCENT);
const PAUSE = pauseAt(COMPACTION);
const UNDER = PAUSE - 1000;
const OVER = PAUSE + 1000;
const SAID = (count) => count.toLocaleString('en-US');

function inHome(body) {
  return () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'jh-pause-'));
    try {
      body(home);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  };
}

const reply = (input, usage = {}) => ({ type: 'assistant', message: { model: 'claude-test', usage: { input_tokens: input, ...usage } } });
const boundary = (preTokens, trigger = 'auto') => ({ type: 'system', subtype: 'compact_boundary', compactMetadata: { trigger, preTokens, postTokens: 1000 } });

function write(home, name, entries) {
  const file = path.join(home, name);
  fs.writeFileSync(file, `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`);
  return file;
}

/** The real file system, with every call that writes listed in `writes`, so a test can count them. */
function watchedFs() {
  const writes = [];
  const watch = (name) => (...args) => {
    writes.push(name);
    return fs[name](...args);
  };
  return { writes, fileSystem: { ...fs, mkdirSync: watch('mkdirSync'), writeFileSync: watch('writeFileSync'), renameSync: watch('renameSync') } };
}

const stateOf = (home) => JSON.parse(fs.readFileSync(statePath(home, SESSION), 'utf8'));

// --- readEnd: the end of the transcript ---

test('readEnd: the last reply with usage wins, and side chains, synthetic and usage-less entries after it are skipped', inHome((home) => {
  const file = write(home, 't.jsonl', [
    reply(100, { cache_read_input_tokens: 10, cache_creation_input_tokens: 5 }),
    reply(200),
    { ...reply(9999), isSidechain: true },
    { type: 'assistant', message: { model: '<synthetic>', usage: { input_tokens: 8888 } } },
    { type: 'assistant', message: { model: 'claude-test' } },
  ]);
  assert.deepEqual(readEnd(file), { tokens: 200, compaction: null });
}));

test('readEnd: a reply whose count is zero is skipped for the one before it, and the cache reads are counted', inHome((home) => {
  const file = write(home, 't.jsonl', [reply(100, { cache_read_input_tokens: 10, cache_creation_input_tokens: 5 }), reply(0)]);
  assert.deepEqual(readEnd(file), { tokens: 115, compaction: null });
}));

test('readEnd: a transcript with no reply with usage at its end reads as null', inHome((home) => {
  const file = write(home, 't.jsonl', [{ type: 'user', text: 'hello' }, { ...reply(9999), isSidechain: true }]);
  assert.equal(readEnd(file), null);
}));

test('readEnd: the first line of a piece that was cut is skipped', inHome((home) => {
  const file = path.join(home, 'cut.jsonl');
  const cut = JSON.stringify({ type: 'user', text: 'x'.repeat(500) });
  const last = JSON.stringify(reply(300));
  fs.writeFileSync(file, `${cut}\n${last}\n`);
  assert.deepEqual(readEnd(file, { bytes: Buffer.byteLength(last) + 20 }), { tokens: 300, compaction: null });
}));

test('readEnd: a file larger than the bytes asked is read at its end only, never whole', inHome((home) => {
  const file = write(home, 'big.jsonl', [...Array.from({ length: 200 }, (_, index) => ({ type: 'user', text: `${'p'.repeat(200)}${index}` })), reply(400)]);
  let asked = 0;
  const counting = { ...fs, readSync: (fd, buffer, offset, length, position) => {
    asked += length;
    return fs.readSync(fd, buffer, offset, length, position);
  } };
  assert.deepEqual(readEnd(file, { bytes: 4096, fileSystem: counting }), { tokens: 400, compaction: null });
  assert.ok(fs.statSync(file).size > 4096);
  assert.ok(asked > 0 && asked <= 4096, `asked ${asked} bytes`);
}));

test('readEnd: a missing file reads as null', inHome((home) => {
  assert.equal(readEnd(path.join(home, 'missing.jsonl')), null);
}));

test('readEnd: the last automatic boundary gives its preTokens, and a manual boundary does not', inHome((home) => {
  const file = write(home, 'b.jsonl', [boundary(1), reply(100), boundary(300000), reply(150), boundary(999, 'manual')]);
  assert.deepEqual(readEnd(file), { tokens: 150, compaction: 300000 });
  const manual = write(home, 'm.jsonl', [reply(100), boundary(999, 'manual')]);
  assert.deepEqual(readEnd(manual), { tokens: 100, compaction: null });
}));

// --- statePath ---

test('statePath: one file per session, under the pause folder of the channel', () => {
  assert.equal(statePath('/h', SESSION), path.join('/h', '.js-harness', 'channel', 'pause', `${SESSION}.json`));
});

test('statePath: a session id that is not of the shape of a session id throws a TypeError', () => {
  for (const bad of ['', 'short', '../../escape1', 'has space 1', undefined]) {
    assert.throws(() => statePath('/h', bad), TypeError, String(bad));
  }
});

// --- pauseNotice ---

test('under the pause nothing is said, nothing is written and no state file is made', inHome((home) => {
  const transcript = write(home, 't.jsonl', [reply(UNDER)]);
  const { writes, fileSystem } = watchedFs();
  assert.equal(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, fileSystem }), null);
  assert.deepEqual(writes, []);
  assert.equal(fs.existsSync(statePath(home, SESSION)), false);
}));

test('the crossing: the first call at the pause says the share, the room and the text; the second says nothing; the state keeps the time', inHome((home) => {
  const transcript = write(home, 't.jsonl', [reply(OVER)]);
  const notice = pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW });
  assert.equal(notice.tokens, OVER);
  assert.equal(notice.share, percentOf(OVER, WINDOW));
  assert.equal(notice.compactionShare, DEFAULT_CONTEXT_COMPACTION_PERCENT);
  assert.equal(notice.room, COMPACTION - OVER);
  assert.ok(notice.text.includes(`holds ${notice.share}% of its context window`), notice.text);
  assert.ok(notice.text.includes(`compacts it at about ${DEFAULT_CONTEXT_COMPACTION_PERCENT}%`), notice.text);
  assert.ok(notice.text.includes(`about ${SAID(notice.room)} tokens are left`), notice.text);
  assert.equal(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW }), null);
  assert.equal(stateOf(home).armed, false);
  assert.deepEqual(stateOf(home).told, [{ at: new Date(NOW).toISOString(), tokens: OVER }]);
}));

test('a new stretch: under the pause after a crossing the state re-arms and keeps what it told, and the next crossing tells again', inHome((home) => {
  const transcript = write(home, 't.jsonl', [reply(OVER)]);
  assert.ok(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW }));
  write(home, 't.jsonl', [reply(UNDER)]);
  assert.equal(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW }), null);
  assert.equal(stateOf(home).armed, true);
  assert.equal(stateOf(home).told.length, 1);
  write(home, 't.jsonl', [reply(OVER)]);
  assert.ok(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW }));
  assert.equal(stateOf(home).told.length, 2);
}));

// --- the session's own point ---

test('a session whose own compaction is lower is told below the default pause', inHome((home) => {
  const LOW = COMPACTION - 50000;
  const below = pauseAt(LOW) + 1000;
  assert.ok(below < PAUSE, 'the context is under the default pause');
  const transcript = write(home, 't.jsonl', [boundary(LOW), reply(below)]);
  const notice = pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW });
  assert.ok(notice, 'the session tells at its own pause');
  assert.equal(notice.room, LOW - below);
}));

test('a session whose own compaction is higher is not told at the default pause, and its new point is written', inHome((home) => {
  const HIGH = COMPACTION + 20000;
  const above = PAUSE + 1000;
  assert.ok(above < pauseAt(HIGH), 'the context is under the session\'s own pause');
  const transcript = write(home, 't.jsonl', [boundary(HIGH), reply(above)]);
  assert.equal(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW }), null);
  assert.equal(stateOf(home).compaction, HIGH);
  assert.equal(stateOf(home).armed, true);
}));

test('the session\'s own point is remembered when a later end no longer holds the boundary', inHome((home) => {
  const LOW = COMPACTION - 50000;
  const transcript = write(home, 't.jsonl', [boundary(LOW), reply(pauseAt(LOW) + 1000)]);
  assert.ok(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW }));
  assert.equal(stateOf(home).compaction, LOW);
  write(home, 't.jsonl', [reply(pauseAt(LOW) - 1000)]);
  assert.equal(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW }), null);
  write(home, 't.jsonl', [reply(pauseAt(LOW) + 1000)]);
  assert.ok(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW }));
  assert.equal(stateOf(home).told.length, 2);
}));

// --- failures ---

test('an unreadable transcript is no notice, and nothing is written', inHome((home) => {
  const { writes, fileSystem } = watchedFs();
  assert.equal(pauseNotice({ transcript: path.join(home, 'missing.jsonl'), sessionId: SESSION, home, now: () => NOW, fileSystem }), null);
  assert.deepEqual(writes, []);
}));

test('a state file that is not JSON reads as armed and empty, so the crossing tells', inHome((home) => {
  fs.mkdirSync(path.dirname(statePath(home, SESSION)), { recursive: true });
  fs.writeFileSync(statePath(home, SESSION), 'not json {');
  const transcript = write(home, 't.jsonl', [reply(OVER)]);
  assert.ok(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW }));
  assert.equal(stateOf(home).told.length, 1);
}));

test('a home that cannot be written still gives the notice at the crossing, and never throws under the pause', inHome((home) => {
  const notAFolder = path.join(home, 'not-a-folder');
  fs.writeFileSync(notAFolder, 'a file, not a folder');
  const transcript = write(home, 't.jsonl', [reply(OVER)]);
  assert.ok(pauseNotice({ transcript, sessionId: SESSION, home: notAFolder, now: () => NOW }));
  assert.equal(pauseNotice({ transcript: write(home, 'u.jsonl', [reply(UNDER)]), sessionId: SESSION, home: notAFolder, now: () => NOW }), null);
}));

test('a bad session id is a TypeError from pauseNotice too, before the transcript is read', inHome((home) => {
  assert.throws(() => pauseNotice({ transcript: path.join(home, 'missing.jsonl'), sessionId: '../x', home, now: () => NOW }), TypeError);
}));

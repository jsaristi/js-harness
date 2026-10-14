import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pauseNotice, readEnd, statePath, toldBetween } from './pause.mjs';
import { DEFAULT_CONTEXT_COMPACTION_PERCENT, DEFAULT_CONTEXT_LAST_PERCENT, DEFAULT_CONTEXT_PAUSE_PERCENT, DEFAULT_CONTEXT_WINDOW, percentOf, shareOf } from './sessions.mjs';

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
const TINY = shareOf(DEFAULT_CONTEXT_WINDOW, 1);

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

/** The real file system, with every write under `dir` refused once `lock()` is called: a home that became unwritable. */
function lockableFs(dir) {
  let locked = false;
  const refuse = (name) => (...args) => {
    if (locked && String(args[0]).startsWith(dir)) throw new Error(`${name} is refused`);
    return fs[name](...args);
  };
  return {
    lock: () => { locked = true; },
    fileSystem: { ...fs, mkdirSync: refuse('mkdirSync'), writeFileSync: refuse('writeFileSync'), renameSync: refuse('renameSync') },
  };
}

const stateOf = (home) => JSON.parse(fs.readFileSync(statePath(home, SESSION), 'utf8'));

/** Writes a state into one place as it is held there: `file` is the path of the place. */
function putState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state));
}

/** The temp files a folder holds, which a failed write must not leave: none when the folder does not exist. */
const tmpFilesIn = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith('.tmp')) : []);

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

test('readEnd: a reply followed by one line larger than the bytes asked is found, from a longer end', inHome((home) => {
  const file = write(home, 'long.jsonl', [reply(300), { type: 'user', text: 'x'.repeat(5000) }]);
  assert.deepEqual(readEnd(file, { bytes: 1024 }), { tokens: 300, compaction: null });
}));

test('readEnd: a file with no reply at all reads as null, and no more bytes than the most asked', inHome((home) => {
  const file = write(home, 'none.jsonl', Array.from({ length: 2000 }, (_, index) => ({ type: 'user', text: `line ${index} ${'q'.repeat(100)}` })));
  let asked = 0;
  const counting = { ...fs, readSync: (fd, buffer, offset, length, position) => {
    asked += length;
    return fs.readSync(fd, buffer, offset, length, position);
  } };
  assert.equal(readEnd(file, { bytes: 1024, maxBytes: 8192, fileSystem: counting }), null);
  assert.ok(fs.statSync(file).size > 8192);
  assert.equal(asked, 8192, `asked ${asked} bytes`);
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
  assert.equal(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp'), fileSystem }), null);
  assert.deepEqual(writes, []);
  assert.equal(fs.existsSync(statePath(home, SESSION)), false);
}));

test('the crossing: the first call at the pause says the share, the room and the text; the second says nothing; the state keeps the time', inHome((home) => {
  const transcript = write(home, 't.jsonl', [reply(OVER)]);
  const notice = pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp') });
  assert.equal(notice.tokens, OVER);
  assert.equal(notice.share, percentOf(OVER, WINDOW));
  assert.equal(notice.compactionShare, DEFAULT_CONTEXT_COMPACTION_PERCENT);
  assert.equal(notice.room, COMPACTION - OVER);
  assert.ok(notice.text.includes(`holds ${notice.share}% of its context window`), notice.text);
  assert.ok(notice.text.includes(`compacts it at about ${DEFAULT_CONTEXT_COMPACTION_PERCENT}%`), notice.text);
  assert.ok(notice.text.includes(`about ${SAID(notice.room)} tokens are left`), notice.text);
  assert.doesNotMatch(notice.text, /two blocks of a cut|\b(he|his|him)\b/);
  assert.equal(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp') }), null);
  assert.equal(stateOf(home).armed, false);
  assert.deepEqual(stateOf(home).told, [{ at: new Date(NOW).toISOString(), tokens: OVER }]);
}));

// The cut is handed to the user only while they are present: a session that stops for a /compact nobody sends
// waits for hours, and the host compacts a session inside a turn anyway.
const typed = (at, text = 'go on') => ({ type: 'user', origin: { kind: 'human' }, message: { role: 'user', content: text }, timestamp: new Date(at).toISOString() });
const GIVE = 'give them, in your next reply, what they send to compact this session and the prompt that resumes it after';
const KEEP = 'do not stop and give them nothing to send: the host compacts this session inside a turn';

test('the crossing while the user wrote here minutes ago: the notice hands them the cut', inHome((home) => {
  const transcript = write(home, 't.jsonl', [typed(NOW - 5 * 60000), reply(OVER)]);
  const notice = pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp') });
  assert.ok(notice.text.includes(`the user wrote here 5m ago: ${GIVE}`), notice.text);
  assert.ok(!notice.text.includes(KEEP), notice.text);
}));

test('the crossing while the user is away, or never wrote in the end that is read: no cut, and the session goes on', inHome((home) => {
  for (const entries of [[typed(NOW - 2 * 3600000), reply(OVER)], [reply(OVER)]]) {
    const transcript = write(home, 't.jsonl', entries);
    fs.rmSync(path.join(home, '.js-harness'), { recursive: true, force: true });
    const notice = pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp') });
    assert.ok(notice.text.includes(KEEP), notice.text);
    assert.ok(!notice.text.includes(GIVE), notice.text);
    assert.ok(notice.text.includes('go on with the task'), notice.text);
  }
}));

// From the pause on, the state is kept current after every step and the session stores the prompt that resumes it,
// so a compaction by the host, in the middle of a task, resumes from minutes-old state; a last notice comes just
// before the host compacts.
const LAST = Math.round((COMPACTION * DEFAULT_CONTEXT_LAST_PERCENT) / DEFAULT_CONTEXT_COMPACTION_PERCENT);
const OPENING = 'js-harness notify --opening "<this session\'s title>"';

test('the pause notice says to keep the state current after every step, and to store the prompt that resumes the session', inHome((home) => {
  const transcript = write(home, 't.jsonl', [reply(OVER)]);
  const notice = pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp') });
  assert.equal(notice.stage, 'pause');
  assert.ok(notice.text.includes('write it after every step you finish, not once, and commit it with your next commit'), notice.text);
  assert.ok(notice.text.includes(`Store the prompt that resumes you with ${OPENING}`), notice.text);
}));

test('the last notice: past the last point after the pause, once, says the compaction is near and to start nothing new', inHome((home) => {
  assert.ok(DEFAULT_CONTEXT_PAUSE_PERCENT < DEFAULT_CONTEXT_LAST_PERCENT && DEFAULT_CONTEXT_LAST_PERCENT < DEFAULT_CONTEXT_COMPACTION_PERCENT);
  assert.equal(DEFAULT_CONTEXT_COMPACTION_PERCENT - DEFAULT_CONTEXT_LAST_PERCENT, 3, 'three points of room: one large tool result eats two');
  const options = { sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp') };
  assert.equal(pauseNotice({ ...options, transcript: write(home, 't.jsonl', [reply(OVER)]) }).stage, 'pause');
  const last = pauseNotice({ ...options, transcript: write(home, 't.jsonl', [reply(LAST + 500)]) });
  assert.equal(last.stage, 'last');
  assert.ok(last.text.includes(`about ${SAID(COMPACTION - (LAST + 500))} tokens are left`), last.text);
  assert.ok(last.text.includes('The host compacts this session in a moment: write your state and store your resume prompt now, before anything else'), last.text);
  assert.ok(last.text.includes('before anything else, then go on with the task: the compaction comes with your next requests, and never by waiting for it'), last.text);
  assert.ok(!last.text.includes('start nothing new'), 'a session told to start nothing new can stop short of the compaction');
  assert.ok(last.text.includes(OPENING), last.text);
  assert.equal(pauseNotice({ ...options, transcript: write(home, 't.jsonl', [reply(LAST + 900)]) }), null, 'said once');
}));

test('a jump from under the pause past the last point gives the last notice alone, and under the pause both re-arm', inHome((home) => {
  const options = { sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp') };
  const jump = pauseNotice({ ...options, transcript: write(home, 't.jsonl', [reply(LAST + 500)]) });
  assert.equal(jump.stage, 'last');
  assert.equal(pauseNotice({ ...options, transcript: write(home, 't.jsonl', [reply(LAST + 600)]) }), null);
  assert.equal(pauseNotice({ ...options, transcript: write(home, 't.jsonl', [reply(UNDER)]) }), null);
  assert.equal(pauseNotice({ ...options, transcript: write(home, 't.jsonl', [reply(OVER)]) }).stage, 'pause');
  assert.equal(pauseNotice({ ...options, transcript: write(home, 't.jsonl', [reply(LAST + 500)]) }).stage, 'last');
}));

test('a new stretch: under the pause after a crossing the state re-arms and keeps what it told, and the next crossing tells again', inHome((home) => {
  const transcript = write(home, 't.jsonl', [reply(OVER)]);
  assert.ok(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp') }));
  write(home, 't.jsonl', [reply(UNDER)]);
  assert.equal(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp') }), null);
  assert.equal(stateOf(home).armed, true);
  assert.equal(stateOf(home).told.length, 1);
  write(home, 't.jsonl', [reply(OVER)]);
  assert.ok(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp') }));
  assert.equal(stateOf(home).told.length, 2);
}));

// --- the session's own point ---

test('a session whose own compaction is lower is told below the default pause', inHome((home) => {
  const LOW = COMPACTION - 50000;
  const below = pauseAt(LOW) + 1000;
  assert.ok(below < PAUSE, 'the context is under the default pause');
  const transcript = write(home, 't.jsonl', [boundary(LOW), reply(below)]);
  const notice = pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp') });
  assert.ok(notice, 'the session tells at its own pause');
  assert.equal(notice.room, LOW - below);
}));

test('a session whose own compaction is higher is not told at the default pause, and its new point is written', inHome((home) => {
  const HIGH = COMPACTION + 20000;
  const above = PAUSE + 1000;
  assert.ok(above < pauseAt(HIGH), 'the context is under the session\'s own pause');
  const transcript = write(home, 't.jsonl', [boundary(HIGH), reply(above)]);
  assert.equal(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp') }), null);
  assert.equal(stateOf(home).compaction, HIGH);
  assert.equal(stateOf(home).armed, true);
}));

test('the session\'s own point is remembered when a later end no longer holds the boundary', inHome((home) => {
  const LOW = COMPACTION - 50000;
  const transcript = write(home, 't.jsonl', [boundary(LOW), reply(pauseAt(LOW) + 1000)]);
  assert.ok(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp') }));
  assert.equal(stateOf(home).compaction, LOW);
  write(home, 't.jsonl', [reply(pauseAt(LOW) - 1000)]);
  assert.equal(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp') }), null);
  write(home, 't.jsonl', [reply(pauseAt(LOW) + 1000)]);
  assert.ok(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp') }));
  assert.equal(stateOf(home).told.length, 2);
}));

// --- failures ---

test('an unreadable transcript is no notice, and nothing is written', inHome((home) => {
  const { writes, fileSystem } = watchedFs();
  assert.equal(pauseNotice({ transcript: path.join(home, 'missing.jsonl'), sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp'), fileSystem }), null);
  assert.deepEqual(writes, []);
}));

test('a state file that is not JSON reads as armed and empty, so the crossing tells', inHome((home) => {
  fs.mkdirSync(path.dirname(statePath(home, SESSION)), { recursive: true });
  fs.writeFileSync(statePath(home, SESSION), 'not json {');
  const transcript = write(home, 't.jsonl', [reply(OVER)]);
  assert.ok(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp') }));
  assert.equal(stateOf(home).told.length, 1);
}));

test('a home that cannot be written still gives the notice at the crossing, and never throws under the pause', inHome((home) => {
  const notAFolder = path.join(home, 'not-a-folder');
  fs.writeFileSync(notAFolder, 'a file, not a folder');
  const transcript = write(home, 't.jsonl', [reply(OVER)]);
  assert.ok(pauseNotice({ transcript, sessionId: SESSION, home: notAFolder, now: () => NOW, tmpdir: path.join(home, 'tmp') }));
  assert.equal(pauseNotice({ transcript: write(home, 'u.jsonl', [reply(UNDER)]), sessionId: SESSION, home: notAFolder, now: () => NOW, tmpdir: path.join(home, 'tmp') }), null);
}));

test('a home that cannot be written keeps the state in the temp folder: told once, and the next call under the disarm says nothing', inHome((home) => {
  const notAFolder = path.join(home, 'not-a-folder');
  fs.writeFileSync(notAFolder, 'a file, not a folder');
  const tmpdir = path.join(home, 'tmp');
  fs.mkdirSync(tmpdir);
  const transcript = write(home, 't.jsonl', [reply(OVER)]);
  const options = { transcript, sessionId: SESSION, home: notAFolder, now: () => NOW, tmpdir };
  assert.ok(pauseNotice(options));
  assert.equal(pauseNotice(options), null);
  assert.equal(JSON.parse(fs.readFileSync(path.join(tmpdir, `js-harness-pause-${SESSION}.json`), 'utf8')).armed, false);
}));

test('a home and a temp folder that cannot be written: no notice on any call, and nothing thrown', inHome((home) => {
  const notAFolder = path.join(home, 'not-a-folder');
  fs.writeFileSync(notAFolder, 'a file, not a folder');
  const notATemp = path.join(home, 'not-a-temp-folder');
  fs.writeFileSync(notATemp, 'a file, not a folder');
  const transcript = write(home, 't.jsonl', [reply(OVER)]);
  const options = { transcript, sessionId: SESSION, home: notAFolder, now: () => NOW, tmpdir: notATemp };
  for (let call = 1; call <= 3; call += 1) {
    assert.equal(pauseNotice(options), null, `call ${call}`);
  }
}));

test('a rename that fails leaves no temp file behind, in the state folder or in the temp folder', inHome((home) => {
  const tmpdir = path.join(home, 'tmp');
  fs.mkdirSync(tmpdir);
  const fileSystem = { ...fs, renameSync: () => { throw new Error('the rename is refused'); } };
  const transcript = write(home, 't.jsonl', [reply(OVER)]);
  assert.equal(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, tmpdir, fileSystem }), null);
  assert.deepEqual(tmpFilesIn(path.dirname(statePath(home, SESSION))), []);
  assert.deepEqual(tmpFilesIn(tmpdir), []);
}));

test('a compaction point of the transcript that is zero, negative or tiny is as if absent, and an earlier boundary holds', inHome((home) => {
  for (const point of [0, -TINY, TINY]) {
    const transcript = write(home, 't.jsonl', [boundary(point), reply(UNDER)]);
    assert.equal(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp') }), null, `point ${point}`);
  }
  const LOW = COMPACTION - 50000;
  const earlier = write(home, 'e.jsonl', [boundary(LOW), boundary(0), reply(pauseAt(LOW) + 1000)]);
  assert.deepEqual(readEnd(earlier), { tokens: pauseAt(LOW) + 1000, compaction: LOW });
}));

test('a compaction point of the state that is zero, negative or tiny is as if absent', inHome((home) => {
  for (const point of [0, -TINY, TINY]) {
    fs.mkdirSync(path.dirname(statePath(home, SESSION)), { recursive: true });
    fs.writeFileSync(statePath(home, SESSION), JSON.stringify({ compaction: point, armed: true, told: [] }));
    const transcript = write(home, 't.jsonl', [reply(UNDER)]);
    assert.equal(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp') }), null, `point ${point}`);
  }
}));

test('the pause point itself is told', inHome((home) => {
  const transcript = write(home, 't.jsonl', [reply(PAUSE)]);
  assert.ok(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp') }));
}));

test('one token under the pause point is not told, and no state is written', inHome((home) => {
  const transcript = write(home, 't.jsonl', [reply(PAUSE - 1)]);
  assert.equal(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp') }), null);
  assert.equal(fs.existsSync(statePath(home, SESSION)), false);
}));

test('a compaction point that is not a whole number gives a whole room, and the text groups it as tokens', inHome((home) => {
  const point = COMPACTION + 0.123456;
  const transcript = write(home, 't.jsonl', [boundary(point), reply(OVER)]);
  const notice = pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW, tmpdir: path.join(home, 'tmp') });
  const room = Math.round(point - OVER);
  assert.equal(notice.room, room);
  assert.ok(notice.text.includes(`about ${SAID(room)} tokens are left`), notice.text);
}));

test('a bad session id is a TypeError from pauseNotice too, before the transcript is read', inHome((home) => {
  assert.throws(() => pauseNotice({ transcript: path.join(home, 'missing.jsonl'), sessionId: '../x', home, now: () => NOW }), TypeError);
}));

// --- the newer of the two places ---

test('the newer place wins: a home that became unwritable after it was armed does not tell the session again', inHome((home) => {
  const tmpdir = path.join(home, 'tmp');
  fs.mkdirSync(tmpdir);
  // The lock covers the folder the home's state is written in, as `statePath` names it, so the writes of the home are the ones refused.
  const guard = lockableFs(path.dirname(statePath(home, SESSION)));
  const tempFile = path.join(tmpdir, `js-harness-pause-${SESSION}.json`);
  const options = (at) => ({ transcript, sessionId: SESSION, home, now: () => at, tmpdir, fileSystem: guard.fileSystem });
  // the first call is under the pause and writes the compaction point it was seen to have, armed, into the home
  const transcript = write(home, 't.jsonl', [boundary(COMPACTION), reply(UNDER)]);
  assert.equal(pauseNotice(options(NOW)), null);
  assert.equal(stateOf(home).armed, true);
  guard.lock();
  write(home, 't.jsonl', [boundary(COMPACTION), reply(OVER)]);
  assert.ok(pauseNotice(options(NOW + 1000)), 'the crossing tells, and its disarmed state can only be kept in the temp folder');
  assert.equal(stateOf(home).armed, true, 'the home still holds its armed state: the crossing took no write there');
  assert.equal(JSON.parse(fs.readFileSync(tempFile, 'utf8')).armed, false, 'the temp folder holds the disarmed state of the crossing');
  assert.equal(pauseNotice(options(NOW + 2000)), null, 'the next call reads the temp folder, which is newer, and says nothing');
}));

test('a state with no stamp takes the time its file was written: an older one is passed over for the stamped state in the temp folder', inHome((home) => {
  const tmpdir = path.join(home, 'tmp');
  const homeFile = statePath(home, SESSION);
  putState(homeFile, { compaction: null, armed: true, told: [] });
  // the home's file was written a minute before the stamp of the temp folder's state, so that state is the newer one
  fs.utimesSync(homeFile, new Date(NOW - 60000), new Date(NOW - 60000));
  putState(path.join(tmpdir, `js-harness-pause-${SESSION}.json`), { compaction: null, armed: false, told: [], written: new Date(NOW).toISOString() });
  const transcript = write(home, 't.jsonl', [reply(OVER)]);
  assert.equal(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW + 1000, tmpdir }), null);
}));

test('a state with no stamp written after the stamp of the temp folder\'s state is the newer one, and is read', inHome((home) => {
  const tmpdir = path.join(home, 'tmp');
  const homeFile = statePath(home, SESSION);
  putState(homeFile, { compaction: null, armed: true, told: [] });
  fs.utimesSync(homeFile, new Date(NOW + 60000), new Date(NOW + 60000));
  putState(path.join(tmpdir, `js-harness-pause-${SESSION}.json`), { compaction: null, armed: false, told: [], written: new Date(NOW).toISOString() });
  const transcript = write(home, 't.jsonl', [reply(OVER)]);
  assert.ok(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW + 120000, tmpdir }), 'the home state is the newer one and is armed, so the crossing tells');
}));

test('a state with no stamp whose file cannot be statted ranks oldest, and nothing throws', inHome((home) => {
  const tmpdir = path.join(home, 'tmp');
  const tempFile = path.join(tmpdir, `js-harness-pause-${SESSION}.json`);
  putState(statePath(home, SESSION), { compaction: null, armed: true, told: [] });
  putState(tempFile, { compaction: null, armed: false, told: [], written: new Date(NOW).toISOString() });
  const fileSystem = { ...fs, statSync: () => { throw new Error('stat is refused'); } };
  const transcript = write(home, 't.jsonl', [reply(OVER)]);
  assert.equal(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW + 1000, tmpdir, fileSystem }), null, 'the stamped state in the temp folder speaks for the session');
  // With no state in the temp folder, the unstamped state is still read: an unreadable time only ranks it oldest.
  fs.rmSync(tempFile);
  assert.ok(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW + 1000, tmpdir, fileSystem }));
}));

test('equal stamps: the home\'s state is read, the first place winning the tie', inHome((home) => {
  const tmpdir = path.join(home, 'tmp');
  const written = new Date(NOW).toISOString();
  putState(statePath(home, SESSION), { compaction: null, armed: true, told: [], written });
  putState(path.join(tmpdir, `js-harness-pause-${SESSION}.json`), { compaction: null, armed: false, told: [], written });
  const transcript = write(home, 't.jsonl', [reply(OVER)]);
  assert.ok(pauseNotice({ transcript, sessionId: SESSION, home, now: () => NOW + 1000, tmpdir }));
}));

// --- toldBetween: was the session told in a stretch ---

const at = (minutes) => new Date(NOW + minutes * 60 * 1000).toISOString();
const told = (minutes, tokens) => ({ at: at(minutes), tokens });

test('toldBetween: no state in either place is not known, and nothing is written', inHome((home) => {
  const { writes, fileSystem } = watchedFs();
  assert.deepEqual(toldBetween({ home, sessionId: SESSION, tmpdir: path.join(home, 'tmp'), fileSystem }), { known: false, at: null, tokens: null });
  assert.deepEqual(writes, []);
}));

test('toldBetween: with three entries, the bounds take the middle one, and an entry exactly at a bound is outside', inHome((home) => {
  const tmpdir = path.join(home, 'tmp');
  putState(statePath(home, SESSION), { compaction: null, armed: false, told: [told(1, PAUSE + 1000), told(2, PAUSE + 2000), told(3, PAUSE + 3000)] });
  const { writes, fileSystem } = watchedFs();
  assert.deepEqual(toldBetween({ home, sessionId: SESSION, after: at(1), before: at(3), tmpdir, fileSystem }), { known: true, at: at(2), tokens: PAUSE + 2000 });
  assert.deepEqual(writes, []);
}));

test('toldBetween: open bounds take the last entry, and an entry whose at is not a string is passed over', inHome((home) => {
  const tmpdir = path.join(home, 'tmp');
  putState(statePath(home, SESSION), { compaction: null, armed: false, told: [told(1, PAUSE + 1000), told(2, PAUSE + 2000), { at: 5, tokens: 1 }] });
  assert.deepEqual(toldBetween({ home, sessionId: SESSION, tmpdir }), { known: true, at: at(2), tokens: PAUSE + 2000 });
  assert.deepEqual(toldBetween({ home, sessionId: SESSION, after: at(1), tmpdir }), { known: true, at: at(2), tokens: PAUSE + 2000 });
  assert.deepEqual(toldBetween({ home, sessionId: SESSION, before: at(1), tmpdir }), { known: true, at: null, tokens: null });
}));

test('toldBetween: a stretch with no entry in it is known, with null at and tokens', inHome((home) => {
  const tmpdir = path.join(home, 'tmp');
  putState(statePath(home, SESSION), { compaction: null, armed: false, told: [told(1, PAUSE + 1000)] });
  assert.deepEqual(toldBetween({ home, sessionId: SESSION, after: at(5), before: at(9), tmpdir }), { known: true, at: null, tokens: null });
}));

test('toldBetween: a session id that is not of the shape of one, or a home that cannot be read, is not known and does not throw', inHome((home) => {
  const tmpdir = path.join(home, 'tmp');
  const notAFolder = path.join(home, 'not-a-folder');
  fs.writeFileSync(notAFolder, 'a file, not a folder');
  assert.deepEqual(toldBetween({ home, sessionId: '../x', tmpdir }), { known: false, at: null, tokens: null });
  assert.deepEqual(toldBetween({ home: notAFolder, sessionId: SESSION, tmpdir }), { known: false, at: null, tokens: null });
  assert.deepEqual(toldBetween({ sessionId: SESSION, tmpdir }), { known: false, at: null, tokens: null });
}));

test('toldBetween: a told that is not an array holds no entry, and the state is still known', inHome((home) => {
  putState(statePath(home, SESSION), { compaction: null, armed: false, told: 'not a list' });
  assert.deepEqual(toldBetween({ home, sessionId: SESSION, tmpdir: path.join(home, 'tmp') }), { known: true, at: null, tokens: null });
}));

test('toldBetween: it reads the newer place, so a stamped state in the temp folder beats an older home', inHome((home) => {
  const tmpdir = path.join(home, 'tmp');
  putState(statePath(home, SESSION), { compaction: null, armed: false, told: [told(1, PAUSE + 1000)], written: at(1) });
  putState(path.join(tmpdir, `js-harness-pause-${SESSION}.json`), { compaction: null, armed: false, told: [told(2, PAUSE + 2000)], written: at(2) });
  assert.deepEqual(toldBetween({ home, sessionId: SESSION, tmpdir }), { known: true, at: at(2), tokens: PAUSE + 2000 });
}));

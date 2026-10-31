import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  GATE_COMMAND_MAX,
  GATE_LOG_ENV,
  appendGateBusiest,
  appendGateEvent,
  appendGateFailure,
  appendGateTestTimes,
  formatGates,
  gateLogDir,
  gateLogSwitchedOff,
  gateRecord,
  gatesOf,
  isTreeKey,
  provenBy,
  readGateBusiest,
  readGateFailures,
  readGateLog,
  readGateProof,
  readGateTestTimes,
} from './gate-log.mjs';

// The gate log: JSON lines, two per gate, in a folder of its own under the home. Every test here has a
// temporary home; what `check` and `js-harness gate` write into the log is tested in check.test.mjs and
// gate.test.mjs.

function withHome(run) {
  return async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-gate-log-'));
    try {
      await run(home);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  };
}

const AT = '2026-10-11T07:33:28.000Z';
const start = (id, more = {}) => ({ v: 1, event: 'start', id, at: AT, cwd: 'C:\\work\\one', command: 'check', pid: 100, lock: 'own', waitedSeconds: 0, waitedFor: [], ...more });
const end = (id, more = {}) => ({ v: 1, event: 'end', id, at: AT, seconds: 12.5, result: 'pass', sensors: [{ name: 'tests', seconds: 12.4, pass: true, timedOut: false }], ...more });
const refused = (id, more = {}) => ({ v: 1, event: 'refused', id, at: AT, cwd: 'C:\\work\\one', command: 'check', pid: 100, reason: 'held', waitedSeconds: 0, waitedFor: [], ...more });
const stopped = (id, more = {}) => ({ v: 1, event: 'stopped', id, at: AT, cwd: 'C:\\work\\one', command: 'check', pid: 100, rows: ['budget'], ...more });

const files = (home) => fs.readdirSync(gateLogDir(home)).sort();
const linesOf = (home, name = 'log.jsonl') => fs.readFileSync(path.join(gateLogDir(home), name), 'utf8').split('\n');

test('gateLogDir is a folder of its own under the harness home, beside the lock\'s and not in it', () => {
  assert.equal(gateLogDir('C:\\home'), path.join('C:\\home', '.js-harness', 'gate-log'));
});

test('only off switches the log off', () => {
  assert.equal(GATE_LOG_ENV, 'JS_HARNESS_GATE_LOG');
  assert.equal(gateLogSwitchedOff({ JS_HARNESS_GATE_LOG: 'off' }), true);
  for (const value of [undefined, '', '0', 'on', 'OFF']) assert.equal(gateLogSwitchedOff({ JS_HARNESS_GATE_LOG: value }), false, String(value));
});

test('appendGateEvent makes the folder itself and appends one JSON line per event, read back in the order written', withHome(async (home) => {
  assert.deepEqual(readGateLog(home), { dir: gateLogDir(home), events: [], skipped: 0 });
  const events = [start('a'), end('a'), refused('b')];
  for (const event of events) assert.deepEqual(appendGateEvent(home, event), { ok: true });
  assert.deepEqual(files(home), ['log.jsonl']);
  assert.deepEqual(linesOf(home), [...events.map((event) => JSON.stringify(event)), '']);
  assert.deepEqual(readGateLog(home), { dir: gateLogDir(home), events, skipped: 0 });
}));

test('a log past its bound is renamed to log.1.jsonl by the gate about to append, over an older one, so the folder holds two files at most', withHome(async (home) => {
  const line = (id) => JSON.stringify(start(id)).length + 1;
  // Room for two lines and not for three: the bound is passed by the third, and the fourth rotates.
  const maxBytes = line('g1') * 2 + 1;
  const append = (id) => appendGateEvent(home, start(id), { maxBytes });
  for (const id of ['g1', 'g2', 'g3']) assert.deepEqual(append(id), { ok: true });
  assert.deepEqual(files(home), ['log.jsonl']);
  assert.deepEqual(append('g4'), { ok: true });
  assert.deepEqual(files(home), ['log.1.jsonl', 'log.jsonl']);
  assert.deepEqual(linesOf(home, 'log.1.jsonl').length, 4);
  assert.deepEqual(linesOf(home), [JSON.stringify(start('g4')), '']);
  // Both files are read, the older first.
  assert.deepEqual(readGateLog(home).events.map(({ id }) => id), ['g1', 'g2', 'g3', 'g4']);

  // The next rotation replaces the older file: its gates are gone, and no third file is made.
  for (const id of ['g5', 'g6', 'g7']) append(id);
  assert.deepEqual(files(home), ['log.1.jsonl', 'log.jsonl']);
  assert.deepEqual(readGateLog(home).events.map(({ id }) => id), ['g4', 'g5', 'g6', 'g7']);
}));

test('a rename the system refuses is skipped, the line still lands, and the next append tries again', withHome(async (home) => {
  const maxBytes = 10;
  let refusals = 2;
  const renames = [];
  const fileSystem = {
    ...fs,
    renameSync: (from, to) => {
      renames.push([path.basename(from), path.basename(to)]);
      if (refusals > 0) {
        refusals -= 1;
        throw Object.assign(new Error(`EBUSY: resource busy or locked, rename '${from}' -> '${to}'`), { code: 'EBUSY' });
      }
      fs.renameSync(from, to);
    },
  };
  const append = (id) => appendGateEvent(home, start(id), { maxBytes, fileSystem });
  assert.deepEqual(append('g1'), { ok: true });
  // Past the bound from here on: two refused renames, each with its line in the file all the same.
  assert.deepEqual(append('g2'), { ok: true });
  assert.deepEqual(append('g3'), { ok: true });
  assert.deepEqual(files(home), ['log.jsonl']);
  assert.deepEqual(readGateLog(home).events.map(({ id }) => id), ['g1', 'g2', 'g3']);
  assert.deepEqual(append('g4'), { ok: true });
  assert.deepEqual(renames, [['log.jsonl', 'log.1.jsonl'], ['log.jsonl', 'log.1.jsonl'], ['log.jsonl', 'log.1.jsonl']]);
  assert.deepEqual(linesOf(home, 'log.1.jsonl').length, 4);
  assert.deepEqual(readGateLog(home).events.map(({ id }) => id), ['g1', 'g2', 'g3', 'g4']);
}));

test('a log that cannot be written is an error in one sentence, never a throw', withHome(async (home) => {
  // The folder's path is taken by a file.
  fs.mkdirSync(path.join(home, '.js-harness'));
  fs.writeFileSync(gateLogDir(home), 'not a folder');
  const said = appendGateEvent(home, start('a'));
  assert.deepEqual(Object.keys(said), ['error']);
  assert.match(said.error, /^E[A-Z]+: [^\n]+$/);
  assert.equal(fs.readFileSync(gateLogDir(home), 'utf8'), 'not a folder');
  // A home that is a file holds no folder at all.
  assert.match(appendGateEvent(path.join(gateLogDir(home)), start('a')).error, /^E[A-Z]+: /);
  // And what cannot be read is an empty log.
  assert.deepEqual(readGateLog(home).events, []);
}));

test('readGateLog skips what is no event of this log: a torn line, text, JSON of another shape or version', withHome(async (home) => {
  appendGateEvent(home, start('a'));
  // An event that is no text is no kind of event at all. One that is a text this version does not know is
  // another matter, and has a test of its own below.
  const garbage = ['not json', '{"v":1,"event":"start","id":"torn', '[]', 'null', JSON.stringify({ ...start('b'), v: 2 }), JSON.stringify({ ...end('b'), event: 7 }), JSON.stringify({ ...start('c'), id: 7 }), JSON.stringify({ ...start('d'), at: 'yesterday' })];
  fs.appendFileSync(path.join(gateLogDir(home), 'log.jsonl'), `${garbage.join('\n')}\n\n   \n`);
  appendGateEvent(home, end('a'));
  assert.deepEqual(readGateLog(home), { dir: gateLogDir(home), events: [start('a'), end('a')], skipped: garbage.length });
}));

// Gates of several versions of the harness write the one file of a machine: a project that pins an older
// harness reads what a newer one wrote. A kind of event it does not know is not a damaged line, and a count
// of "unreadable lines" that grows with every gate of the newer version would say that the log is broken.
test('readGateLog leaves out in silence a line with a sound head whose kind this version does not know, and still counts what is damaged', withHome(async (home) => {
  appendGateEvent(home, start('a'));
  const unknown = [
    { v: 1, event: 'paused', id: 'a', at: AT, seconds: 3.2, reason: 'no sensor declared' },
    // Its body is its version's own business: nothing here takes it apart.
    { v: 1, event: 'paused', id: 'b', at: AT, cwd: { toString: null }, waitedFor: [null], load: 'busy', seconds: 'three' },
    { v: 1, event: '', id: 'c', at: AT },
    { v: 1, event: 'START', id: 'd', at: AT },
  ];
  for (const line of unknown) fs.appendFileSync(path.join(gateLogDir(home), 'log.jsonl'), `${JSON.stringify(line)}\n`);
  appendGateEvent(home, end('a'));
  const quiet = readGateLog(home);
  assert.deepEqual(quiet, { dir: gateLogDir(home), events: [start('a'), end('a')], skipped: 0 });
  assert.deepEqual(gatesOf(quiet.events), [{ start: start('a'), end: end('a') }]);
  assert.equal(formatGates(gatesOf(quiet.events)).length, 1);

  // What is still counted: a torn line, a head that is wrong (of an unknown kind as of a known one), an
  // event that is no text, and a known kind with a body that is not one.
  const damaged = [
    '{"v":1,"event":"paused","id":"torn',
    JSON.stringify({ v: 2, event: 'paused', id: 'e', at: AT }),
    JSON.stringify({ v: 1, event: 'paused', id: 7, at: AT }),
    JSON.stringify({ v: 1, event: 'paused', id: 'f', at: 'yesterday' }),
    JSON.stringify({ v: 1, event: 'paused', id: 'g' }),
    JSON.stringify({ v: 1, event: null, id: 'h', at: AT }),
    JSON.stringify({ v: 1, event: ['start'], id: 'i', at: AT }),
    JSON.stringify({ v: 1, id: 'j', at: AT }),
    JSON.stringify(end('k', { seconds: 'three' })),
  ];
  fs.appendFileSync(path.join(gateLogDir(home), 'log.jsonl'), `${damaged.join('\n')}\n`);
  assert.deepEqual(readGateLog(home), { dir: gateLogDir(home), events: [start('a'), end('a')], skipped: damaged.length });
}));

// A gate that stopped before its sensors writes one line of a kind of its own (`stopped`). This version
// knows the kind, so the body of such a line is asked as any other's: its rows are printed.
test('readGateLog reads the line of a gate that stopped before its sensors, and leaves out and counts one whose rows or folder are not what a gate writes there', withHome(async (home) => {
  const odd = { toString: null };
  const sound = [stopped('a'), stopped('b', { rows: ['budget', 'contracts'] }), stopped('c', { rows: [] }), { v: 1, event: 'stopped', id: 'd', at: AT }];
  const malformed = [stopped('e', { rows: 'budget' }), stopped('f', { rows: [null] }), stopped('g', { rows: ['budget', odd] }), stopped('h', { rows: null }), stopped('i', { rows: [7] }), stopped('j', { cwd: odd })];
  for (const line of [...sound.slice(0, 2), ...malformed, ...sound.slice(2)]) appendGateEvent(home, line);
  const read = readGateLog(home);
  assert.deepEqual(read, { dir: gateLogDir(home), events: sound, skipped: malformed.length });
  // And what is read can be said, a line for each.
  assert.equal(formatGates(gatesOf(read.events)).length, 4);
}));

// A ticket that puts a session's next check first (./gate-first.mjs) leaves lines of four kinds of its own,
// whose id is the ticket's: they are read as events, and are no gate.
test('readGateLog reads the lines of a ticket, which are no gate, and a gate that went first by one is marked so among the gates another waited for', withHome(async (home) => {
  const ticket = { session: 's', reason: 'unblocks the others', until: AT };
  const lines = [
    { v: 1, event: 'first-issued', id: '0a0a0a0a', at: AT, ...ticket, by: 'orq' },
    { v: 1, event: 'first-claimed', id: '0a0a0a0a', at: AT, ...ticket, cwd: 'C:\\work\\one', pid: 100, passed: [{ cwd: 'C:\\work\\two', pid: 7 }] },
    { v: 1, event: 'first-expired', id: '0b0b0b0b', at: AT, ...ticket },
    { v: 1, event: 'first-cancelled', id: '0c0c0c0c', at: AT, ...ticket },
  ];
  for (const line of [start('a'), ...lines, end('a'), { ...lines[0], id: '0d0d0d0d', by: null }]) appendGateEvent(home, line);
  const read = readGateLog(home);
  assert.deepEqual([read.events, read.skipped], [[start('a'), ...lines, end('a')], 1]);
  assert.deepEqual(gatesOf(read.events), [{ start: start('a'), end: end('a') }]);
  const passer = { cwd: 'D:\\js-harness', pid: 4321, command: 'check', first: true };
  assert.deepEqual(formatGates([{ start: start('b', { waitedSeconds: 12, waitedFor: [passer] }) }]), [`${when(AT)}  no end (killed, or still running)  waited 12 s for D:\\js-harness (first by a ticket)  C:\\work\\one`]);
}));

// Found in review (Codex), 2026-10-11: a write that was cut short leaves a tail with no line break, and the
// next event was appended to that tail. The reader then left both out as one bad line, and where the event
// that was lost was a start, its end went with it: a gate that ran well was not in the log, and nothing said so.
test('appendGateEvent starts its line on a fresh one after a tail that has no line break, in one append, and never rewrites the file', withHome(async (home) => {
  const file = path.join(gateLogDir(home), 'log.jsonl');
  const appended = [];
  const fileSystem = {
    ...fs,
    appendFileSync: (target, text, ...rest) => {
      appended.push(text);
      return fs.appendFileSync(target, text, ...rest);
    },
    writeFileSync: () => {
      throw new Error('the log is appended to, never written again');
    },
  };
  const append = (event) => appendGateEvent(home, event, { fileSystem });

  assert.deepEqual(append(start('a')), { ok: true });
  // What a write that was cut short leaves: half a line, and no line break after it.
  const torn = '{"v":1,"event":"end","id":"a","at":"2026';
  fs.appendFileSync(file, torn);
  assert.deepEqual(append(start('b')), { ok: true });
  assert.deepEqual(append(end('b')), { ok: true });

  assert.deepEqual(linesOf(home), [JSON.stringify(start('a')), torn, JSON.stringify(start('b')), JSON.stringify(end('b')), '']);
  // One append for each event, the line break that ends the tail in the same write as the line.
  assert.deepEqual(appended, [`${JSON.stringify(start('a'))}\n`, `\n${JSON.stringify(start('b'))}\n`, `${JSON.stringify(end('b'))}\n`]);
  const read = readGateLog(home);
  assert.deepEqual([read.events, read.skipped], [[start('a'), start('b'), end('b')], 1]);
  assert.deepEqual(gatesOf(read.events), [{ start: start('a') }, { start: start('b'), end: end('b') }]);

  // A file that is there and empty has no tail, and a tail that cannot be looked at is appended to as it is:
  // the line lands, which is worth more than where it lands.
  fs.writeFileSync(file, '');
  assert.deepEqual(append(start('c')), { ok: true });
  assert.deepEqual(linesOf(home), [JSON.stringify(start('c')), '']);
  fs.appendFileSync(file, torn);
  const blind = { ...fs, openSync: () => { throw Object.assign(new Error('EBUSY: resource busy or locked, open'), { code: 'EBUSY' }); } };
  assert.deepEqual(appendGateEvent(home, start('d'), { fileSystem: blind }), { ok: true });
  assert.deepEqual(linesOf(home), [JSON.stringify(start('c')), `${torn}${JSON.stringify(start('d'))}`, '']);
}));

// Found in the same review: the reader asked what kind of thing a list or a load is, and not what is in the
// fields a line is printed from. `{"cwd":{"toString":null}}` is an object no text can be made of, so
// `formatGates` threw (`Cannot convert object to primitive value`), and with it every `gate log`.
test('readGateLog leaves out and counts a line with a field that is printed or counted with and is not what a gate writes there', withHome(async (home) => {
  const odd = { toString: null };
  const load = { busy: 1.4, processors: 8, sampleMs: 1000 };
  const busiest = { name: 'node', script: 'tsserver.js', pid: 41012, cpuSeconds: 1.1 };
  const gate = { cwd: 'C:\\work\\two', pid: 7, command: 'check' };
  appendGateEvent(home, start('a'));
  appendGateEvent(home, start('z'));
  const malformed = [
    start('b', { cwd: odd }),
    start('c', { lock: odd }),
    start('d', { waitedFor: [gate, { ...gate, cwd: odd }] }),
    start('e', { waitedFor: [{ cwd: null, pid: odd, command: null }] }),
    start('f', { load: { ...load, busy: odd } }),
    start('g', { load: { ...load, processors: odd } }),
    start('h', { load: { notRead: odd, sampleMs: 1000 } }),
    start('i', { load: { ...load, busiest: [busiest, { ...busiest, name: odd }] } }),
    start('j', { load: { ...load, busiest: [{ ...busiest, script: odd }] } }),
    end('z', { result: odd }),
    refused('k', { reason: odd }),
    refused('l', { cwd: odd }),
    refused('m', { waitedFor: [{ ...gate, cwd: odd }] }),
    refused('n', { waitedFor: [{ ...gate, pid: odd }] }),
    // And what is a value of another kind, which would only read oddly.
    start('o', { cwd: 7 }),
    start('p', { cwd: null }),
    start('q', { lock: null }),
    start('r', { waitedFor: [{ ...gate, pid: '7' }] }),
    start('s', { load: { ...load, busiest: [{ ...busiest, name: null }] } }),
    end('z', { result: 0 }),
    refused('t', { reason: null }),
  ];
  for (const [index, line] of malformed.entries()) {
    fs.appendFileSync(path.join(gateLogDir(home), 'log.jsonl'), `${JSON.stringify(line)}\n`);
    assert.equal(readGateLog(home).skipped, index + 1, `${line.event} ${line.id}`);
  }
  // What the writer writes as `null`, and what a gate does not have, is still no fault.
  const sound = [
    start('u', { waitedFor: [{ cwd: null, pid: null, command: null }, {}], load: { ...load, busiest: [{ ...busiest, script: null }, {}] } }),
    { v: 1, event: 'start', id: 'v', at: AT },
    { v: 1, event: 'refused', id: 'w', at: AT },
    end('a'),
  ];
  for (const event of sound) appendGateEvent(home, event);

  const read = readGateLog(home);
  assert.deepEqual(read, { dir: gateLogDir(home), events: [start('a'), start('z'), ...sound], skipped: malformed.length });
  // No line that is read makes the formatter throw: a line for each gate.
  assert.equal(formatGates(gatesOf(read.events)).length, 5);
}));

// Found in review, 2026-10-11: the head of a line was all the reader looked at, and `formatGates` takes the
// body apart. One line with a `null` where a gate it waited for should be made every `gate log` throw.
test('readGateLog skips a line with the head of an event and a body that is not one, so that no reader meets it', withHome(async (home) => {
  appendGateEvent(home, start('a'));
  const load = { busy: 1.4, processors: 8, sampleMs: 1000 };
  const malformed = [
    start('b', { waitedFor: [null] }),
    start('c', { waitedFor: [{ cwd: 'C:\\work\\two', pid: 7, command: 'check' }, 'C:\\work\\three'] }),
    start('d', { waitedFor: 'C:\\work\\two' }),
    start('e', { waitedFor: null }),
    start('f', { waitedSeconds: '12' }),
    start('g', { load: 'busy' }),
    start('h', { load: null }),
    start('i', { load: [load] }),
    start('j', { load: { ...load, busiest: [null] } }),
    start('k', { load: { ...load, busiest: 'node' } }),
    end('l', { seconds: '12.5' }),
    end('m', { seconds: null }),
    end('n', { sensors: [null] }),
    end('o', { sensors: 'tests' }),
    refused('p', { waitedFor: [null] }),
    refused('q', { waitedSeconds: null }),
  ];
  for (const line of malformed) fs.appendFileSync(path.join(gateLogDir(home), 'log.jsonl'), `${JSON.stringify(line)}\n`);
  // What a gate does not have is no fault: a start with no load, an end with no sensors, a gate it waited
  // for of which nothing could be read, a load that could not be read and one with nobody named in it.
  const sparse = [
    start('r', { waitedFor: [{ cwd: null, pid: null, command: null }], load: { notRead: 'os.cpus() gave no processor', sampleMs: 1000 } }),
    { v: 1, event: 'end', id: 'r', at: AT, seconds: 0, result: 'exit 3' },
    start('s', { load: { ...load, busiest: [] } }),
    end('a'),
  ];
  for (const event of sparse) appendGateEvent(home, event);

  const read = readGateLog(home);
  assert.deepEqual(read, { dir: gateLogDir(home), events: [start('a'), ...sparse], skipped: malformed.length });
  // And what the reader hands on is what the formatter can say, a line for each gate.
  assert.equal(formatGates(gatesOf(read.events)).length, 3);
}));

// A reader may look while a gate rotates: it reads the newer file first, so the worst it sees is the same
// lines in both files, which it keeps once. Read the other way round it would miss them.
test('readGateLog keeps once an event that both files hold', withHome(async (home) => {
  appendGateEvent(home, start('a'));
  appendGateEvent(home, end('a'));
  fs.copyFileSync(path.join(gateLogDir(home), 'log.jsonl'), path.join(gateLogDir(home), 'log.1.jsonl'));
  appendGateEvent(home, start('b'));
  assert.deepEqual(readGateLog(home).events, [start('a'), end('a'), start('b')]);
}));

// Gates that run without the lock append side by side, each line in one write.
const WRITER = `
import { appendGateEvent } from ${JSON.stringify(new URL('./gate-log.mjs', import.meta.url).href)};
const [home, writer, count] = process.argv.slice(1);
for (let n = 0; n < Number(count); n++) {
  const said = appendGateEvent(home, { v: 1, event: 'start', id: writer + '-' + n, at: new Date().toISOString(), cwd: 'x'.repeat(200), command: 'check', pid: process.pid, lock: 'none', waitedSeconds: 0, waitedFor: [] });
  if (said.error) throw new Error(said.error);
}
`;

test('several processes that append at once lose no line and tear none', withHome(async (home) => {
  const writers = 4;
  const each = 40;
  const exits = await Promise.all(Array.from({ length: writers }, (_, writer) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', WRITER, home, `w${writer}`, String(each)], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stderr }));
  })));
  assert.deepEqual(exits, Array.from({ length: writers }, () => ({ status: 0, stderr: '' })));
  const { events, skipped } = readGateLog(home);
  assert.equal(skipped, 0);
  assert.equal(new Set(events.map(({ id }) => id)).size, writers * each);
}));

test('gatesOf pairs a start with its end by id, keeps a start that has none, a refusal on its own, and drops an end whose start is gone', () => {
  const events = [start('a'), start('b', { cwd: 'C:\\work\\two' }), refused('r'), end('b'), end('gone'), start('c'), end('a', { result: 'fail' })];
  assert.deepEqual(gatesOf(events), [
    { start: start('a'), end: end('a', { result: 'fail' }) },
    { start: start('b', { cwd: 'C:\\work\\two' }), end: end('b') },
    { refused: refused('r') },
    { start: start('c') },
  ]);
  assert.deepEqual(gatesOf([]), []);
});

// A gate that stopped ran nothing, so it has no start to be the end of: it is a gate of its own, as a
// refusal is, whatever id its line has.
test('gatesOf keeps a gate that stopped before its sensors on its own, in its place, and takes it for the end of no start', () => {
  const events = [start('a'), stopped('s'), stopped('a', { rows: ['contracts'] }), end('s'), end('a'), refused('r'), start('b')];
  assert.deepEqual(gatesOf(events), [
    { start: start('a'), end: end('a') },
    { stopped: stopped('s') },
    { stopped: stopped('a', { rows: ['contracts'] }) },
    { refused: refused('r') },
    { start: start('b') },
  ]);
});

/** `iso` as the formatter says it: the local month, day and time. */
function when(iso) {
  const at = new Date(iso);
  const two = (number) => String(number).padStart(2, '0');
  return `${two(at.getMonth() + 1)}-${two(at.getDate())} ${two(at.getHours())}:${two(at.getMinutes())}:${two(at.getSeconds())}`;
}

test('formatGates says one gate a line: when, seconds, result, lock, load, whom it waited for, folder', () => {
  const load = { busy: 1.42, processors: 8, share: 0.1775, sampleMs: 1000 };
  const busiest = [{ name: 'node', script: 'tsserver.js', pid: 41012, cpuSeconds: 1.1 }, { name: 'MsMpEng', script: null, pid: 5736, cpuSeconds: 1 }];
  const other = { cwd: 'D:\\js-harness', pid: 4321, command: 'check' };
  const unknown = { cwd: null, pid: 77, command: null };
  const gates = [
    { start: start('a', { load }), end: end('a', { seconds: 1074.6 }) },
    { start: start('b', { load: { ...load, busiest }, waitedSeconds: 268.4, waitedFor: [other] }), end: end('b', { result: 'timeout', seconds: 1200 }) },
    { start: start('c', { lock: 'parent', command: 'gate -- node --test', load: { notRead: 'os.cpus() gave no processor', sampleMs: 1000 } }), end: { v: 1, event: 'end', id: 'c', at: AT, seconds: 0.4, result: 'exit 3' } },
    { start: start('d', { lock: 'none', waitedSeconds: 61, waitedFor: [unknown, { ...unknown, pid: null }] }) },
    { refused: refused('e', { waitedFor: [other] }) },
    { refused: refused('f', { reason: 'timeout', waitedSeconds: 30, waitedFor: [other] }) },
    // A commit's gate whose tests ran on GitHub (../check.mjs, `testsOnCi`): never read as a run under the lock.
    { start: start('g', { lock: 'ci' }), end: end('g', { seconds: 144.2, sensors: [{ name: 'tests', seconds: 144, pass: true, ranIn: 'ci' }] }) },
  ];
  const at = when(AT);
  assert.deepEqual(formatGates(gates), [
    `${at}  1075 s  pass  load 1.4 of 8  C:\\work\\one`,
    `${at}  1200 s  timeout  load 1.4 of 8 (node tsserver.js, MsMpEng)  waited 268 s for D:\\js-harness  C:\\work\\one`,
    `${at}  0 s  exit 3  in its parent's turn  load not read  C:\\work\\one`,
    `${at}  no end (killed, or still running)  without the lock  waited 61 s for another gate (pid 77), another gate  C:\\work\\one`,
    `${at}  refused (held)  waited 0 s for D:\\js-harness  C:\\work\\one`,
    `${at}  refused (timeout)  waited 30 s for D:\\js-harness  C:\\work\\one`,
    `${at}  144 s  pass  on GitHub's machines  C:\\work\\one`,
  ]);
  assert.deepEqual(formatGates([]), []);
});

// Never as a gate that ran (`pass`), was refused, or has no end (`killed, or still running`).
test('formatGates says a gate that stopped before its sensors as what it was: when, that it stopped and for which rows, and its folder', () => {
  const at = when(AT);
  const gates = [
    { stopped: stopped('a') },
    { stopped: stopped('b', { rows: ['budget', 'contracts'], cwd: 'C:\\work\\two' }) },
    { stopped: stopped('c', { rows: [] }) },
    { stopped: { v: 1, event: 'stopped', id: 'd', at: AT } },
  ];
  assert.deepEqual(formatGates(gates), [
    `${at}  stopped before its sensors (budget)  C:\\work\\one`,
    `${at}  stopped before its sensors (budget, contracts)  C:\\work\\two`,
    `${at}  stopped before its sensors  C:\\work\\one`,
    `${at}  stopped before its sensors`,
  ]);
});

/** A stand-in for the writer that keeps what it was handed, and a clock that moves by hand. */
function captured(answer = () => ({ ok: true })) {
  const events = [];
  let at = Date.parse(AT);
  let ids = 0;
  const deps = {
    append: (home, event) => {
      events.push({ home, event });
      return answer(event);
    },
    now: () => at,
    id: () => `id-${(ids += 1)}`,
  };
  return { events, deps, pass: (ms) => { at += ms; } };
}

test('gateRecord writes the start and the end of one gate under one id, with what the gate hands it', () => {
  const { events, deps, pass } = captured();
  const load = { busy: 0.4, processors: 8, share: 0.05, sampleMs: 1000 };
  const waitedFor = [{ cwd: 'C:\\work\\other', pid: 4321, command: 'check' }];
  const record = gateRecord({ home: 'C:\\home', cwd: 'C:\\work\\one', command: 'check', pid: 100, ...deps });
  record.start({ lock: 'own', waitedMs: 6040, waitedFor, load });
  pass(12_460);
  const sensors = [{ name: 'tests', seconds: 12.4, pass: true, timedOut: false }];
  record.end({ result: 'pass', sensors });
  assert.deepEqual(events, [
    { home: 'C:\\home', event: { v: 1, event: 'start', id: 'id-1', at: AT, cwd: 'C:\\work\\one', command: 'check', pid: 100, lock: 'own', waitedSeconds: 6, waitedFor, load } },
    { home: 'C:\\home', event: { v: 1, event: 'end', id: 'id-1', at: '2026-10-11T07:33:40.460Z', seconds: 12.5, result: 'pass', sensors } },
  ]);
  assert.equal(record.failure(), undefined);
});

test('gateRecord writes the session that ran the gate when it is given one, so a reader can tell whose it was', () => {
  const { events, deps } = captured();
  const record = gateRecord({ home: 'h', cwd: 'c', command: 'check', pid: 100, session: '9a1b2c3d-0000-0000-0000-000000000000', ...deps });
  record.start({ lock: 'own', waitedMs: 0, waitedFor: [] });
  record.refused({ reason: 'timeout', waitedMs: 0, waitedFor: [] });
  assert.equal(events[0].event.session, '9a1b2c3d-0000-0000-0000-000000000000');
  assert.equal(events[1].event.session, '9a1b2c3d-0000-0000-0000-000000000000');
  // With none (a gate run from a terminal, or a host that gives no id) the line has no such field.
  const { events: bare, deps: bareDeps } = captured();
  for (const session of [undefined, null, '']) gateRecord({ home: 'h', cwd: 'c', command: 'check', pid: 100, session, ...bareDeps }).start({ lock: 'own', waitedMs: 0, waitedFor: [] });
  assert.ok(bare.every(({ event }) => !('session' in event)));
});

test('gateRecord leaves out a load that was not sampled and the sensors of a gate that has none, cuts the command, and writes a refusal as one line', () => {
  const { events, deps } = captured();
  const long = `gate -- node -e ${'x'.repeat(300)}`;
  const record = gateRecord({ home: 'h', cwd: 'c', command: long, pid: 100, ...deps });
  record.start({ lock: 'none', waitedMs: 0, waitedFor: [] });
  record.end({ result: 'exit 3' });
  assert.deepEqual(Object.keys(events[0].event), ['v', 'event', 'id', 'at', 'cwd', 'command', 'pid', 'lock', 'waitedSeconds', 'waitedFor']);
  assert.ok(long.length > GATE_COMMAND_MAX, 'the command is longer than the bound');
  assert.equal(events[0].event.command, long.slice(0, GATE_COMMAND_MAX));
  assert.deepEqual(events[1].event, { v: 1, event: 'end', id: 'id-1', at: AT, seconds: 0, result: 'exit 3' });

  const other = gateRecord({ home: 'h', cwd: 'c', command: long, pid: 100, ...deps });
  const waitedFor = [{ cwd: 'C:\\work\\other', pid: 4321, command: 'check' }];
  other.refused({ reason: 'timeout', waitedMs: 30_000, waitedFor });
  // No end for a gate that never started.
  other.end({ result: 'pass' });
  assert.equal(events.length, 3);
  assert.deepEqual(events[2].event, { v: 1, event: 'refused', id: 'id-2', at: AT, cwd: 'c', command: long.slice(0, GATE_COMMAND_MAX), pid: 100, reason: 'timeout', waitedSeconds: 30, waitedFor });
});

// The lock keeps the command of its holder whole (`gate-lock.mjs`), and a gate hands on what the lock told
// it. Found in review, 2026-10-11: only the gate's own command was cut, so the secret of another gate's
// `gate --` line reached the log through the gate that waited for it, in a line of any length.
test('gateRecord cuts the command of each gate it waited for as it cuts its own, in a start and in a refusal, and leaves the list it was handed alone', () => {
  const { events, deps } = captured();
  const long = `gate -- node deploy.mjs --token ${'s'.repeat(300)}`;
  const waitedFor = [{ cwd: 'C:\\work\\other', pid: 4321, command: long }, { cwd: null, pid: null, command: null }, { cwd: 'C:\\work\\third', pid: 4322, command: 'check' }];
  const handed = structuredClone(waitedFor);
  const cut = [{ ...waitedFor[0], command: long.slice(0, GATE_COMMAND_MAX) }, waitedFor[1], waitedFor[2]];

  gateRecord({ home: 'h', cwd: 'c', command: 'check', pid: 100, ...deps }).start({ lock: 'own', waitedMs: 0, waitedFor });
  gateRecord({ home: 'h', cwd: 'c', command: 'check', pid: 100, ...deps }).refused({ reason: 'timeout', waitedMs: 0, waitedFor });
  assert.deepEqual(events.map(({ event }) => [event.event, event.waitedFor]), [['start', cut], ['refused', cut]]);
  assert.equal(JSON.stringify(events[0].event).includes('s'.repeat(GATE_COMMAND_MAX)), false, 'what came after the bound is in the line');
  assert.deepEqual(waitedFor, handed);
});

test('gateRecord writes no member of the gates it waited for that the reader would refuse: what it writes is read back, start, refusal and end', withHome(async (home) => {
  const holder = { cwd: 'C:\\work\\other', pid: 4321, command: 'check' };
  // What is no gate at all, as a caller that went wrong might hand it. The reader leaves out a whole line
  // for one such member, and a start that is left out takes its end with it.
  const waitedFor = [holder, null, 'a gate', 7, ['C:\\work\\third'], undefined];
  const record = gateRecord({ home, cwd: 'C:\\work\\one', command: 'check' });
  record.start({ lock: 'own', waitedMs: 0, waitedFor });
  record.end({ result: 'pass', sensors: [] });
  gateRecord({ home, cwd: 'C:\\work\\two', command: 'check' }).refused({ reason: 'timeout', waitedMs: 0, waitedFor });

  const read = readGateLog(home);
  assert.equal(read.skipped, 0);
  assert.deepEqual(read.events.map(({ event, waitedFor: waited }) => [event, waited]), [['start', [holder]], ['end', undefined], ['refused', [holder]]]);
  const [gate] = gatesOf(read.events);
  assert.equal(gate.end.id, gate.start.id);
}));

// The reader asks what the folder and the pid of such a gate are, since they are printed (2026-10-11). So the
// writer leaves out a member the reader would refuse for those as well: one member must not cost a gate its line.
test('gateRecord writes no gate it waited for whose folder or pid the reader would refuse, and what it writes is read back', withHome(async (home) => {
  const holder = { cwd: 'C:\\work\\other', pid: 4321, command: 'check' };
  const unknown = { cwd: null, pid: null, command: null };
  const waitedFor = [holder, { ...holder, cwd: 7 }, { ...holder, pid: '4321' }, { ...unknown, cwd: { toString: null } }, unknown];
  const record = gateRecord({ home, cwd: 'C:\\work\\one', command: 'check' });
  record.start({ lock: 'own', waitedMs: 0, waitedFor });
  record.end({ result: 'pass', sensors: [] });
  gateRecord({ home, cwd: 'C:\\work\\two', command: 'check' }).refused({ reason: 'timeout', waitedMs: 0, waitedFor });

  const read = readGateLog(home);
  assert.equal(read.skipped, 0);
  assert.deepEqual(read.events.map(({ event, waitedFor: waited }) => [event, waited]), [['start', [holder, unknown]], ['end', undefined], ['refused', [holder, unknown]]]);
  assert.equal(formatGates(gatesOf(read.events)).length, 2);
}));

// Left by the review of the slice before (a review, 2026-10-11): the reader refuses a start whose load
// holds a figure that is no finite number or a busiest name that is no text, and the writer wrote the load
// as it was handed it. The sampler hands neither today; a start that is refused takes its gate's end with it.
test('gateRecord writes no part of a load that the reader would refuse and keeps the rest of it, so the gate is read back with its end', withHome(async (home) => {
  const odd = { toString: null };
  const node = { name: 'node', script: 'tsserver.js', pid: 41012, cpuSeconds: 1.1 };
  const loads = [
    { busy: NaN, processors: 8, share: 0.1, sampleMs: 1000 },
    { busy: 1.4, processors: Infinity, sampleMs: 1000 },
    { busy: '1.4', processors: odd, sampleMs: 1000 },
    { notRead: odd, sampleMs: 1000 },
    { busy: 1.4, processors: 8, busiest: [node, { ...node, name: odd }, { ...node, name: 7 }, { ...node, script: odd }, null, 'node', { ...node, script: null }] },
    { busy: 1.4, processors: 8, busiest: 'node' },
    // What is no load at all is left out whole, as a load that was not sampled is.
    'busy',
    [1.4, 8],
    7,
  ];
  const handed = structuredClone(loads);
  for (const [index, load] of loads.entries()) {
    const record = gateRecord({ home, cwd: `C:\\work\\${index}`, command: 'check' });
    record.start({ lock: 'own', waitedMs: 0, waitedFor: [], load });
    record.end({ result: 'pass', sensors: [] });
    assert.equal(record.failure(), undefined);
  }
  assert.deepEqual(loads, handed, 'the load a gate handed over was changed');
  const read = readGateLog(home);
  assert.equal(read.skipped, 0);
  const gates = gatesOf(read.events);
  assert.deepEqual(gates.map(({ start: began, end: ended }) => [ended?.id === began.id, began.load]), [
    [true, { processors: 8, share: 0.1, sampleMs: 1000 }],
    [true, { busy: 1.4, sampleMs: 1000 }],
    [true, { sampleMs: 1000 }],
    [true, { sampleMs: 1000 }],
    [true, { busy: 1.4, processors: 8, busiest: [node, { ...node, script: null }] }],
    [true, { busy: 1.4, processors: 8 }],
    [true, undefined],
    [true, undefined],
    [true, undefined],
  ]);
  // What is left of each can be said: a load with a figure missing is one that was not read.
  assert.deepEqual(formatGates(gates).map((line) => line.split('  ')[3]), [
    'load not read', 'load not read', 'load not read', 'load not read', 'load 1.4 of 8 (node tsserver.js, node)', 'load 1.4 of 8', 'C:\\work\\6', 'C:\\work\\7', 'C:\\work\\8',
  ]);
}));

test('gateRecord writes a gate that stopped before its sensors as one line with the rows that stopped it, and no end after it', () => {
  const { events, deps } = captured();
  const record = gateRecord({ home: 'C:\\home', cwd: 'C:\\work\\one', command: 'check', pid: 100, ...deps });
  record.stopped({ rows: ['budget', 'contracts'] });
  // A gate that never started has no end.
  record.end({ result: 'pass' });
  assert.deepEqual(events, [{ home: 'C:\\home', event: { v: 1, event: 'stopped', id: 'id-1', at: AT, cwd: 'C:\\work\\one', command: 'check', pid: 100, rows: ['budget', 'contracts'] } }]);
  assert.equal(record.failure(), undefined);

  const said = [];
  const failed = gateRecord({ home: 'h', cwd: 'c', command: 'check', ...captured(() => ({ error: 'EBUSY: resource busy or locked' })).deps, onFailure: (why) => said.push(why) });
  failed.stopped({ rows: ['budget'] });
  assert.equal(failed.failure(), 'could not be written (EBUSY: resource busy or locked), so this stop is not in it');
  assert.deepEqual(said, [failed.failure()]);
});

test('gateRecord writes no row of a gate that stopped that the reader would refuse, and what it writes is read back', withHome(async (home) => {
  gateRecord({ home, cwd: 'C:\\work\\one', command: 'check' }).stopped({ rows: ['budget', null, 7, { toString: null }, 'contracts'] });
  gateRecord({ home, cwd: 'C:\\work\\two', command: 'check' }).stopped({ rows: 'budget' });
  gateRecord({ home, cwd: 'C:\\work\\three', command: 'check' }).stopped({});
  const read = readGateLog(home);
  assert.equal(read.skipped, 0);
  assert.deepEqual(read.events.map(({ event, cwd, rows }) => [event, cwd, rows]), [
    ['stopped', 'C:\\work\\one', ['budget', 'contracts']],
    ['stopped', 'C:\\work\\two', []],
    ['stopped', 'C:\\work\\three', []],
  ]);
  assert.equal(formatGates(gatesOf(read.events)).length, 3);
}));

test('gateRecord never throws to its gate: a write that fails is kept as one sentence, said once, and a gate whose start is not in the log writes no end', () => {
  const cannot = { error: "ENOTDIR: not a directory, mkdir 'somewhere'" };
  const failed = captured(() => cannot);
  const said = [];
  const record = gateRecord({ home: 'h', cwd: 'c', command: 'check', ...failed.deps, onFailure: (why) => said.push(why) });
  record.start({ lock: 'own', waitedMs: 0, waitedFor: [] });
  record.end({ result: 'pass', sensors: [] });
  assert.equal(failed.events.length, 1);
  const startLost = "could not be written (ENOTDIR: not a directory, mkdir 'somewhere'), so this gate is not in it";
  assert.equal(record.failure(), startLost);
  assert.deepEqual(said, [startLost]);

  // The start landed and the end did not.
  const later = captured((event) => (event.event === 'end' ? cannot : { ok: true }));
  const ended = gateRecord({ home: 'h', cwd: 'c', command: 'check', ...later.deps });
  ended.start({ lock: 'own', waitedMs: 0, waitedFor: [] });
  assert.equal(ended.failure(), undefined);
  ended.end({ result: 'pass', sensors: [] });
  assert.equal(ended.failure(), "could not be written (ENOTDIR: not a directory, mkdir 'somewhere'), so the end of this gate is not in it");

  const refusal = gateRecord({ home: 'h', cwd: 'c', command: 'check', ...captured(() => cannot).deps });
  refusal.refused({ reason: 'held', waitedMs: 0, waitedFor: [] });
  assert.equal(refusal.failure(), "could not be written (ENOTDIR: not a directory, mkdir 'somewhere'), so this refusal is not in it");

  // A writer that throws, which the one of this module never does, is the same case.
  const threw = gateRecord({ home: 'h', cwd: 'c', command: 'check', append: () => { throw new Error('the writer blew up'); } });
  threw.start({ lock: 'own', waitedMs: 0, waitedFor: [] });
  assert.equal(threw.failure(), 'could not be written (the writer blew up), so this gate is not in it');
});

test('gateRecord with the writer of this module writes a real file, with an id of its own for each gate', withHome(async (home) => {
  for (const cwd of ['C:\\work\\one', 'C:\\work\\two']) {
    const record = gateRecord({ home, cwd, command: 'check' });
    record.start({ lock: 'own', waitedMs: 0, waitedFor: [] });
    record.end({ result: 'pass', sensors: [] });
  }
  const gates = gatesOf(readGateLog(home).events);
  assert.deepEqual(gates.map(({ start: began, end: ended }) => [began.cwd, began.pid, ended.id === began.id, ended.result]), [['C:\\work\\one', process.pid, true, 'pass'], ['C:\\work\\two', process.pid, true, 'pass']]);
  assert.notEqual(gates[0].start.id, gates[1].start.id);
  assert.match(gates[0].start.id, /^[0-9a-f-]{36}$/);
  assert.equal(new Date(gates[0].start.at).toISOString(), gates[0].start.at);
}));

// --- the key of a tree: on the end of a gate that proved it, and in the line of a gate that ran no sensor ---

const KEY = 'c'.repeat(64);
// The key of the files a tree's gates ran on (`filesKey` of ./gate-tree.mjs).
const FILES = 'f'.repeat(64);
const same = (id, more = {}) => ({ v: 1, event: 'same', id, at: AT, cwd: 'C:\\work\\two', command: 'check', pid: 101, code: KEY, by: 'g1', ...more });

test('provenBy: the proof of a tree is the last end that passed and holds its key, with the folder of its start where the log still has it', () => {
  const events = [start('g1'), end('g1', { code: KEY, files: FILES }), start('g2', { cwd: 'C:\\work\\two' }), end('g2', { code: KEY, files: FILES, at: '2026-10-11T08:00:00.000Z' }), end('g3', { code: KEY, files: FILES, at: '2026-10-11T09:00:00.000Z' })];
  assert.deepEqual(provenBy(events.slice(0, 4), KEY, FILES), { id: 'g2', at: '2026-10-11T08:00:00.000Z', cwd: 'C:\\work\\two' });
  // The start of the last one was rotated away: the proof stands, and names no folder.
  assert.deepEqual(provenBy(events, KEY, FILES), { id: 'g3', at: '2026-10-11T09:00:00.000Z', cwd: null });
});

// JH 109, 2026-10-30 (odd/tasks/gate-narrow-pass.md, L2): the tests of a commit failed on CI, a pass of the same files
// in the WSL mirror, where the failing test skips itself, then proved the tree, and the next commit ran nothing.
test('provenBy: a pass is no proof where a gate of the same files failed under another key than the pass, or failed after it', () => {
  // The key of the same files on Windows, or in another WSL2 distribution or under another node (`treeKey`).
  const OTHER = 'b'.repeat(64);
  const onCi = (id, more = {}) => end(id, { result: 'fail', files: FILES, sensors: [{ name: 'tests', seconds: 200, pass: false, ranIn: 'ci' }], ...more });
  const inWsl = (id, more = {}) => end(id, { code: KEY, files: FILES, tried: KEY, sensors: [{ name: 'tests', seconds: 150, pass: true, timedOut: false, ranIn: 'wsl', skip: { files: 312, skipped: 214 } }], ...more });
  const here = (id, more = {}) => end(id, { files: FILES, tried: KEY, ...more });
  const refused = [
    // The incident: red on CI, which runs under no key, then green in the mirror.
    [onCi('g1'), inWsl('g2')],
    // Red in the mirror after green there: the pass is not the last word of its own key.
    [inWsl('g1'), inWsl('g2', { result: 'fail', code: undefined })],
    // Red on CI after green in the mirror.
    [inWsl('g1'), onCi('g2')],
    // A timeout and an error are failures too.
    [onCi('g1', { result: 'timeout' }), inWsl('g2')],
    [inWsl('g1'), here('g2', { result: 'error', sensors: [] })],
    // Red on Windows, or in another distribution of WSL2 (Codex P2 on 41bfc83c: both said `ranIn: 'wsl'`), then
    // green here: a pass under one key says nothing of another, whatever `ranIn` says.
    [here('g1', { result: 'fail', tried: OTHER }), inWsl('g2')],
    [inWsl('g1', { result: 'fail', code: undefined, tried: OTHER }), inWsl('g2')],
    // A failure that says no key it ran under.
    [here('g1', { result: 'fail', tried: undefined }), here('g2', { code: KEY })],
  ];
  for (const events of refused) assert.equal(provenBy(events, KEY, FILES), null, JSON.stringify(events));
  const proven = [
    // Red, then green under the same key: the pass ran where the failure did.
    [here('g1', { result: 'fail', sensors: [{ name: 'tests', seconds: 3, pass: false }] }), here('g2', { code: KEY })],
    [inWsl('g1', { result: 'fail', code: undefined }), inWsl('g2')],
    [here('g1', { result: 'error', sensors: [] }), here('g2', { code: KEY })],
    // A failure of other files, and one written with no files key (an older line), stand against nothing.
    [onCi('g1', { files: 'e'.repeat(64) }), inWsl('g2')],
    [onCi('g1', { files: undefined }), inWsl('g2')],
    // The end of a `gate --` turn is no gate of these sensors.
    [end('g1', { result: 'exit 1', files: FILES, sensors: undefined }), inWsl('g2')],
  ];
  for (const events of proven) assert.equal(provenBy(events, KEY, FILES)?.id, 'g2', JSON.stringify(events));
});

test('provenBy: nothing but a passed end with that very key is a proof', () => {
  const other = 'd'.repeat(64);
  const none = [
    [],
    [start('g1'), end('g1')],
    [start('g1'), end('g1', { code: other })],
    [start('g1'), end('g1', { code: KEY, result: 'fail' })],
    [start('g1'), end('g1', { code: KEY, result: 'timeout' })],
    [start('g1'), end('g1', { code: KEY, result: 'exit 0' })],
    [same('g2')],
    [start('g1', { code: KEY })],
    [stopped('g1', { code: KEY })],
    // A pass whose end names no files (written before PR 721, when no failure named its files either), or other
    // files: no failure before it could be told against it (JH 112, odd/tasks/gate-push-holes.md, L5).
    [start('g1'), end('g1', { code: KEY })],
    [start('g1'), end('g1', { code: KEY, files: 'e'.repeat(64) })],
  ];
  for (const events of none) assert.equal(provenBy(events, KEY, FILES), null, JSON.stringify(events));
  const proof = [start('g1'), end('g1', { code: KEY, files: FILES })];
  for (const key of [undefined, null, '', 'c'.repeat(63), 'C'.repeat(64), 7]) assert.equal(provenBy(proof, key, FILES), null, String(key));
  // A gate that cannot say which files it guards has no proof either: every doubt runs the sensors.
  for (const files of [undefined, null, '', 'f'.repeat(63), 7]) assert.equal(provenBy(proof, KEY, files), null, String(files));
  assert.equal(provenBy(undefined, KEY, FILES), null);
  assert.equal(isTreeKey(KEY), true);
});

test('gateRecord writes the key of the tree on the end of a gate that gives one, and nothing where what it is given is no key', () => {
  const written = [];
  const record = () => gateRecord({ home: 'h', cwd: 'C:\\work\\one', command: 'check', append: (home, event) => { written.push(event); return { ok: true }; }, now: () => Date.parse(AT), id: () => 'g1' });
  const ended = (code) => {
    written.length = 0;
    const gate = record();
    gate.start({ lock: 'own', waitedMs: 0, waitedFor: [] });
    gate.end({ result: 'pass', sensors: [], code, files: code, tried: code });
    return written.at(-1);
  };
  assert.deepEqual([ended(KEY).code, ended(KEY).files, ended(KEY).tried], [KEY, KEY, KEY]);
  for (const code of [undefined, null, '', 'not a key', 12]) assert.deepEqual(['code' in ended(code), 'files' in ended(code), 'tried' in ended(code)], [false, false, false], String(code));
});

// --- the failures a proof reads, kept beside the log past its rotation (JH 112, odd/tasks/gate-push-holes.md, L5) ---

test('gateRecord writes the end of a gate whose sensors did not all pass and that names its files to the failures too, the same line, and no other end', () => {
  const log = [];
  const failed = [];
  const said = [];
  const ended = (end, appendFailure = (home, line) => { failed.push(line); return { ok: true }; }) => {
    const gate = gateRecord({ home: 'h', cwd: 'C:\\work\\one', command: 'check', append: (home, event) => { log.push(event); return { ok: true }; }, appendFailure, now: () => Date.parse(AT), id: () => 'g1', onFailure: (why) => said.push(why) });
    gate.start({ lock: 'own', waitedMs: 0, waitedFor: [] });
    gate.end(end);
  };
  const sensors = [{ name: 'tests', seconds: 3, pass: false }];
  ended({ result: 'fail', sensors, files: FILES, tried: KEY });
  ended({ result: 'timeout', sensors, files: FILES });
  assert.deepEqual(failed, [log[1], log[3]]);
  // A pass, a failure that names no files, and the end of a `gate --` turn, which has no sensors: none of them.
  ended({ result: 'pass', sensors: [], code: KEY, files: FILES, tried: KEY });
  ended({ result: 'fail', sensors });
  ended({ result: 'exit 1', files: FILES });
  assert.equal(failed.length, 2);
  // A failure that could not be kept there is said, as a line of the log that could not be written is.
  ended({ result: 'fail', sensors, files: FILES }, () => ({ error: 'EACCES' }));
  assert.deepEqual(said, ['could not be written (EACCES), so the failure the proof of a tree reads is not in it']);
});

test('appendGateFailure keeps failures in failed.jsonl beside the log, rotated as the log is, and readGateFailures reads them oldest first, each once', withHome(async (home) => {
  const fail = (id, more = {}) => end(id, { result: 'fail', files: FILES, tried: KEY, ...more });
  for (const id of ['a', 'b', 'c']) assert.deepEqual(appendGateFailure(home, fail(id), { maxBytes: 100 }), { ok: true });
  assert.deepEqual(files(home), ['failed.1.jsonl', 'failed.jsonl']);
  assert.deepEqual(readGateFailures(home), [fail('b'), fail('c')]);
  // Torn, foreign and misshapen lines are left out, and so are a line kept twice, a pass and a line of no end.
  fs.appendFileSync(path.join(gateLogDir(home), 'failed.jsonl'), `${['{"v":1,"id":"torn', 'not json', JSON.stringify(fail('d', { v: 2 })), JSON.stringify(fail('e', { seconds: 'slow' })), JSON.stringify(fail('b')), JSON.stringify(end('f', { code: KEY, files: FILES })), JSON.stringify(start('g'))].join('\n')}\n`);
  assert.deepEqual(readGateFailures(home).map(({ id }) => id), ['b', 'c']);
  // The log knows nothing of them, and a home with no file has none.
  assert.deepEqual(readGateLog(home).events, []);
  assert.deepEqual(readGateFailures(path.join(home, 'none')), []);
  // A file that is there and cannot be read: no answer, which a proof takes as none.
  const failing = (code) => ({ ...fs, readFileSync: () => { throw Object.assign(new Error(code), { code }); } });
  assert.equal(readGateFailures(home, { fileSystem: failing('EACCES') }), null);
  assert.deepEqual(readGateFailures(home, { fileSystem: failing('ENOENT') }), []);
}));

test('readGateProof reads the failures the log no longer holds before the log, so a failure rotated away still stands against a pass after it', withHome(async (home) => {
  const onCi = end('g1', { result: 'fail', files: FILES, sensors: [{ name: 'tests', seconds: 200, pass: false, ranIn: 'ci' }] });
  for (const event of [start('g1'), onCi]) appendGateEvent(home, event);
  appendGateFailure(home, onCi);
  // The log's rotation, as it lands at last: the failure is no longer in either of its files.
  for (const name of ['log.jsonl', 'log.1.jsonl']) fs.rmSync(path.join(gateLogDir(home), name), { force: true });
  for (const event of [start('g2'), end('g2', { code: KEY, files: FILES, tried: KEY })]) appendGateEvent(home, event);
  assert.equal(provenBy(readGateLog(home).events, KEY, FILES)?.id, 'g2', 'the log alone has forgotten the failure');
  assert.deepEqual(readGateProof(home).map(({ event, id }) => `${event} ${id}`), ['end g1', 'start g2', 'end g2']);
  assert.equal(provenBy(readGateProof(home), KEY, FILES), null);
  // A failure the log still holds is read once, where the log has it: a pass after it under its own key proves.
  fs.rmSync(gateLogDir(home), { recursive: true });
  const here = end('g3', { result: 'fail', files: FILES, tried: KEY });
  appendGateEvent(home, here);
  appendGateFailure(home, here);
  appendGateEvent(home, end('g4', { code: KEY, files: FILES, tried: KEY }));
  assert.deepEqual(readGateProof(home), readGateLog(home).events);
  assert.equal(provenBy(readGateProof(home), KEY, FILES)?.id, 'g4');
  // Failures that cannot be read: no events, so no proof.
  const failing = { ...fs, readFileSync: (file, ...rest) => (String(file).includes('failed') ? (() => { throw Object.assign(new Error('EACCES'), { code: 'EACCES' }); })() : fs.readFileSync(file, ...rest)) };
  assert.equal(readGateProof(home, { fileSystem: failing }), null);
}));

test('gateRecord writes a gate that ran no sensor as one line of the kind same, with the key and the gate that proved it, and nothing when either is missing', withHome(async (home) => {
  const gate = gateRecord({ home, cwd: 'C:\\work\\two', command: 'check', pid: 101, id: () => 'g2' });
  gate.same({ code: KEY });
  gate.same({ by: 'g1' });
  gate.same({ code: 'no key', by: 'g1' });
  assert.deepEqual(readGateLog(home).events, []);
  gate.same({ code: KEY, by: 'g1' });
  const { events, skipped } = readGateLog(home);
  assert.equal(skipped, 0);
  assert.deepEqual(events.map(({ event, id, cwd, code, by }) => ({ event, id, cwd, code, by })), [{ event: 'same', id: 'g2', cwd: 'C:\\work\\two', code: KEY, by: 'g1' }]);
  assert.equal(gate.failure(), undefined);
}));

test('a gate that ran no sensor is a gate of its own in the list, and its line says so and names the gate that proved its tree', () => {
  const gates = gatesOf([start('g1'), end('g1', { code: KEY }), same('g2', { by: '0123456789abcdef' })]);
  assert.deepEqual(gates.map((gate) => Object.keys(gate)), [['start', 'end'], ['same']]);
  const [, line] = formatGates(gates);
  assert.match(line, /^\d\d-\d\d \d\d:\d\d:\d\d {2}no sensor ran: the same tree passed in gate 01234567 {2}C:\\work\\two$/);
  // An end is the end of its start alone: a line of the new kind that shares an id ends nothing.
  assert.deepEqual(gatesOf([start('g1'), same('g1')]).map((gate) => Object.keys(gate)), [['start'], ['same']]);
});

test('a line whose key is not one is no event: an end with it is left out and counted, as any other fault of a body is', withHome(async (home) => {
  for (const event of [start('g1'), end('g1', { code: 'short' }), same('g2', { code: 5 }), same('g3', { by: null }), same('g4')]) appendGateEvent(home, event);
  const { events, skipped } = readGateLog(home);
  assert.deepEqual(events.map(({ event, id }) => [event, id]), [['start', 'g1'], ['same', 'g4']]);
  assert.equal(skipped, 3);
}));

// --- who spent the processor over a gate's run: a file of its own beside the log ---
// odd/tasks/gate-wait.md, T19. The log's own lines do not change: no reader of them meets a new field.

const RUN = [
  { pid: 5736, name: 'MsMpEng', cpuSeconds: 412.3 },
  { pid: 1204, name: 'svchost', cpuSeconds: 380 },
  { pid: 9120, name: 'node', script: 'check.mjs', cpuSeconds: 2100.4 },
  { pid: 77, name: 'PcaSvc', cpuSeconds: 50 },
];
const busiestLine = (id, more = {}) => ({ v: 1, id, at: AT, seconds: 700.2, busiest: RUN, ...more });

test('appendGateBusiest writes one JSON line per gate in busiest.jsonl beside the log, and readGateBusiest reads them back by the gate\'s id', withHome(async (home) => {
  assert.deepEqual(appendGateBusiest(home, busiestLine('g1')), { ok: true });
  assert.deepEqual(appendGateBusiest(home, busiestLine('g2', { busiest: RUN.slice(0, 1) })), { ok: true });
  assert.deepEqual(files(home), ['busiest.jsonl']);
  assert.deepEqual(linesOf(home, 'busiest.jsonl').map((line) => (line ? JSON.parse(line).id : line)), ['g1', 'g2', '']);
  const read = readGateBusiest(home);
  assert.deepEqual([...read.keys()], ['g1', 'g2']);
  assert.deepEqual(read.get('g1'), busiestLine('g1'));
  // A home with no file has nobody.
  assert.deepEqual(readGateBusiest(path.join(home, 'none')).size, 0);
}));

test('readGateBusiest skips a line that is torn, not JSON, of another version or of another shape, and keeps the rest', withHome(async (home) => {
  appendGateBusiest(home, busiestLine('g1'));
  const bad = [
    '{"v":1,"id":"torn',
    'not json',
    JSON.stringify(busiestLine('g2', { v: 2 })),
    JSON.stringify(busiestLine('g3', { id: 7 })),
    JSON.stringify(busiestLine('g4', { at: 'yesterday' })),
    JSON.stringify(busiestLine('g5', { busiest: 'MsMpEng' })),
    JSON.stringify(busiestLine('g6', { busiest: [{ name: 'MsMpEng', cpuSeconds: 'a lot' }] })),
    JSON.stringify(busiestLine('g7', { busiest: [{ name: { toString: null }, cpuSeconds: 1 }] })),
    JSON.stringify(busiestLine('g8', { seconds: null })),
    JSON.stringify(busiestLine('g9', { busiest: [{ name: 'node', script: 5, cpuSeconds: 1 }] })),
    '[]',
    'null',
  ];
  fs.appendFileSync(path.join(gateLogDir(home), 'busiest.jsonl'), `${bad.join('\n')}\n`);
  appendGateBusiest(home, busiestLine('g10'));
  assert.deepEqual([...readGateBusiest(home).keys()], ['g1', 'g10']);
}));

test('busiest.jsonl past its bound is renamed to busiest.1.jsonl, both are read, the newer line of a gate first', withHome(async (home) => {
  for (const id of ['a', 'b', 'c']) appendGateBusiest(home, busiestLine(id), { maxBytes: 100 });
  assert.deepEqual(files(home), ['busiest.1.jsonl', 'busiest.jsonl']);
  assert.deepEqual([...readGateBusiest(home).keys()].sort(), ['b', 'c']);
  // The log of the gates is not touched by it.
  assert.deepEqual(readGateLog(home).events, []);
}));

test('appendGateBusiest never throws: a home that cannot be written is an error in one sentence', withHome(async (home) => {
  const notAFolder = path.join(home, 'file');
  fs.writeFileSync(notAFolder, '');
  assert.match(appendGateBusiest(notAFolder, busiestLine('g1')).error, /^E[A-Z]+: /);
  assert.deepEqual(readGateBusiest(notAFolder).size, 0);
}));

test('gateRecord says its id, and keeps who spent the processor over a gate that started, keyed by that id', () => {
  const { events, deps, pass } = captured();
  const kept = [];
  const appendBusiest = (home, line) => {
    kept.push({ home, line });
    return { ok: true };
  };
  const record = gateRecord({ home: 'C:\\home', cwd: 'C:\\work\\one', command: 'check', pid: 100, ...deps, appendBusiest });
  assert.equal(record.id, 'id-1');
  assert.equal(record.started(), false);
  // Before its start a gate keeps nobody: there is no line of the log to key it by.
  record.busiest({ seconds: 1, busiest: RUN });
  assert.deepEqual(kept, []);
  record.start({ lock: 'own', waitedMs: 0, waitedFor: [] });
  assert.equal(record.started(), true);
  pass(700_200);
  record.end({ result: 'pass', sensors: [] });
  // What the reader would refuse is left out, a script of `null` is not written, and fields no reader looks at are dropped.
  record.busiest({ seconds: 700.2, busiest: [...RUN.map((one) => ({ ...one, script: one.script ?? null })), { name: 5, cpuSeconds: 1 }, null, { name: 'x', cpuSeconds: NaN }] });
  assert.deepEqual(kept, [{ home: 'C:\\home', line: { v: 1, id: 'id-1', at: '2026-10-11T07:45:08.200Z', seconds: 700.2, busiest: RUN } }]);
  assert.deepEqual(events.map(({ event }) => event.event), ['start', 'end']);
  // Nobody found is nothing written, and so is what is no list.
  for (const nobody of [[], undefined, 'x']) record.busiest({ seconds: 1, busiest: nobody });
  assert.equal(kept.length, 1);
  assert.equal(record.failure(), undefined);
});

test('gateRecord says once that who spent the processor could not be kept, and never throws', () => {
  const said = [];
  const record = gateRecord({ home: 'h', cwd: 'c', command: 'check', ...captured().deps, appendBusiest: () => ({ error: 'EACCES: permission denied' }), onFailure: (why) => said.push(why) });
  record.start({ lock: 'own', waitedMs: 0, waitedFor: [] });
  record.busiest({ seconds: 1, busiest: RUN });
  assert.deepEqual(said, ['could not be written (EACCES: permission denied), so who spent the processor over this gate is not in it']);
  const threw = gateRecord({ home: 'h', cwd: 'c', command: 'check', ...captured().deps, appendBusiest: () => { throw new Error('blew up'); } });
  threw.start({ lock: 'own', waitedMs: 0, waitedFor: [] });
  threw.busiest({ seconds: 1, busiest: RUN });
  assert.equal(threw.failure(), 'could not be written (blew up), so who spent the processor over this gate is not in it');
});

test('formatGates ends the line of a gate that has who spent the processor with the three heaviest, in whole seconds, and leaves every other line as it was', () => {
  const gates = [{ start: start('a'), end: end('a', { seconds: 700.2 }) }, { start: start('b'), end: end('b') }, { refused: refused('c') }, { start: start('d') }];
  const busiest = new Map([['a', busiestLine('a')], ['c', busiestLine('c')], ['d', busiestLine('d', { busiest: RUN.slice(3) })]]);
  const at = when(AT);
  assert.deepEqual(formatGates(gates, busiest), [
    `${at}  700 s  pass  C:\\work\\one  busiest: MsMpEng 412 s, svchost 380 s, node (check.mjs) 2,100 s`,
    `${at}  13 s  pass  C:\\work\\one`,
    `${at}  refused (held)  waited 0 s  C:\\work\\one`,
    `${at}  no end (killed, or still running)  C:\\work\\one  busiest: PcaSvc 50 s`,
  ]);
  // Without the file's lines, every gate prints as it did.
  assert.deepEqual(formatGates(gates), formatGates(gates, new Map()));
  assert.deepEqual(formatGates(gates).slice(0, 2), [`${at}  700 s  pass  C:\\work\\one`, `${at}  13 s  pass  C:\\work\\one`]);
});

test('a ci-fallback line under a gate\'s id is read, and pairs, prints and proves nothing of its own', withHome(async (home) => {
  const code = 'a'.repeat(64);
  const fallback = { v: 1, event: 'ci-fallback', id: 'g1', at: AT, seconds: 185, reason: 'no run started' };
  for (const event of [fallback, start('g1'), end('g1', { code, files: FILES })]) appendGateEvent(home, event);
  const { events, skipped } = readGateLog(home);
  assert.equal(skipped, 0);
  assert.deepEqual(events.map((event) => event.event), ['ci-fallback', 'start', 'end']);
  // One gate, its start and its end: the fallback before them is neither.
  const gates = gatesOf(events);
  assert.equal(gates.length, 1);
  assert.deepEqual(Object.keys(gates[0]).sort(), ['end', 'start']);
  assert.equal(formatGates(gates).length, 1);
  assert.equal(provenBy(events, code, FILES).id, 'g1');
  // Alone, with its gate rotated away, it is no gate at all.
  assert.deepEqual(gatesOf([fallback]), []);
}));

const timesLine = (id, more = {}) => ({ v: 1, id, at: AT, files: [{ test: 'bin/a.test.mjs', seconds: 2.5 }, { test: 'bin/b.test.mjs', seconds: 0.4 }], ...more });

test('appendGateTestTimes writes one line per gate in test-times.jsonl beside the log, rotated as busiest.jsonl is, and readGateTestTimes reads them by id', withHome(async (home) => {
  for (const id of ['a', 'b', 'c']) assert.deepEqual(appendGateTestTimes(home, timesLine(id), { maxBytes: 100 }), { ok: true });
  assert.deepEqual(files(home), ['test-times.1.jsonl', 'test-times.jsonl']);
  const read = readGateTestTimes(home);
  assert.deepEqual([...read.keys()].sort(), ['b', 'c']);
  assert.deepEqual(read.get('c'), timesLine('c'));
  // Torn, foreign and misshapen lines are left out; a home with no file has none.
  fs.appendFileSync(path.join(gateLogDir(home), 'test-times.jsonl'), `${['{"v":1,"id":"torn', 'not json', JSON.stringify(timesLine('d', { v: 2 })), JSON.stringify(timesLine('e', { files: [{ test: 'x', seconds: 'slow' }] })), JSON.stringify(timesLine('f', { files: 'x' }))].join('\n')}\n`);
  assert.deepEqual([...readGateTestTimes(home).keys()].sort(), ['b', 'c']);
  assert.equal(readGateTestTimes(path.join(home, 'none')).size, 0);
  assert.deepEqual(readGateLog(home).events, []);
}));

test('gateRecord keeps the test times of a gate that started, under its id, and only the files it can read back', () => {
  const { deps } = captured();
  const kept = [];
  const appendTestTimes = (home, line) => {
    kept.push(line);
    return { ok: true };
  };
  const record = gateRecord({ home: 'C:\\home', cwd: 'C:\\work\\one', command: 'check', pid: 100, ...deps, appendTestTimes });
  record.testTimes([{ test: 'bin/a.test.mjs', seconds: 1 }]);
  assert.deepEqual(kept, [], 'before its start a gate has no id in the log to key them by');
  record.start({ lock: 'own', waitedMs: 0, waitedFor: [] });
  record.testTimes([{ test: 'bin/a.test.mjs', seconds: 1.25 }, { test: 7, seconds: 1 }, { test: 'bin/b.test.mjs', seconds: null }]);
  record.testTimes([]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].id, record.id);
  assert.deepEqual(kept[0].files, [{ test: 'bin/a.test.mjs', seconds: 1.25 }]);
});

test('readGateTestTimes says why a times file that is there cannot be read, and reads none from one that is not there', withHome(async (home) => {
  const failing = (code) => ({ ...fs, readFileSync: () => { throw Object.assign(new Error(code), { code }); } });
  assert.throws(() => readGateTestTimes(home, { fileSystem: failing('EACCES') }), /EACCES/);
  assert.equal(readGateTestTimes(home, { fileSystem: failing('ENOENT') }).size, 0);
}));

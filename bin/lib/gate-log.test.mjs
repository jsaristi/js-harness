import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  GATE_COMMAND_MAX,
  GATE_LOG_ENV,
  GATE_LOG_MAX_BYTES,
  appendGateEvent,
  formatGates,
  gateLogDir,
  gateLogSwitchedOff,
  gateRecord,
  gatesOf,
  readGateLog,
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

const files = (home) => fs.readdirSync(gateLogDir(home)).sort();
const linesOf = (home, name = 'log.jsonl') => fs.readFileSync(path.join(gateLogDir(home), name), 'utf8').split('\n');

test('gateLogDir is a folder of its own under the harness home, beside the lock\'s and not in it', () => {
  assert.equal(gateLogDir('C:\\home'), path.join('C:\\home', '.js-harness', 'gate-log'));
  assert.equal(GATE_LOG_MAX_BYTES, 512 * 1024);
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
  const garbage = ['not json', '{"v":1,"event":"start","id":"torn', '[]', 'null', JSON.stringify({ ...start('b'), v: 2 }), JSON.stringify({ ...end('b'), event: 'ended' }), JSON.stringify({ ...start('c'), id: 7 }), JSON.stringify({ ...start('d'), at: 'yesterday' })];
  fs.appendFileSync(path.join(gateLogDir(home), 'log.jsonl'), `${garbage.join('\n')}\n\n   \n`);
  appendGateEvent(home, end('a'));
  assert.deepEqual(readGateLog(home), { dir: gateLogDir(home), events: [start('a'), end('a')], skipped: garbage.length });
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
  ];
  const at = when(AT);
  assert.deepEqual(formatGates(gates), [
    `${at}  1075 s  pass  load 1.4 of 8  C:\\work\\one`,
    `${at}  1200 s  timeout  load 1.4 of 8 (node tsserver.js, MsMpEng)  waited 268 s for D:\\js-harness  C:\\work\\one`,
    `${at}  0 s  exit 3  in its parent's turn  load not read  C:\\work\\one`,
    `${at}  no end (killed, or still running)  without the lock  waited 61 s for another gate (pid 77), another gate  C:\\work\\one`,
    `${at}  refused (held)  waited 0 s for D:\\js-harness  C:\\work\\one`,
    `${at}  refused (timeout)  waited 30 s for D:\\js-harness  C:\\work\\one`,
  ]);
  assert.deepEqual(formatGates([]), []);
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

test('gateRecord leaves out a load that was not sampled and the sensors of a gate that has none, cuts the command, and writes a refusal as one line', () => {
  const { events, deps } = captured();
  const long = `gate -- node -e ${'x'.repeat(300)}`;
  const record = gateRecord({ home: 'h', cwd: 'c', command: long, pid: 100, ...deps });
  record.start({ lock: 'none', waitedMs: 0, waitedFor: [] });
  record.end({ result: 'exit 3' });
  assert.deepEqual(Object.keys(events[0].event), ['v', 'event', 'id', 'at', 'cwd', 'command', 'pid', 'lock', 'waitedSeconds', 'waitedFor']);
  assert.equal(GATE_COMMAND_MAX, 120);
  assert.equal(events[0].event.command, long.slice(0, 120));
  assert.deepEqual(events[1].event, { v: 1, event: 'end', id: 'id-1', at: AT, seconds: 0, result: 'exit 3' });

  const other = gateRecord({ home: 'h', cwd: 'c', command: long, pid: 100, ...deps });
  const waitedFor = [{ cwd: 'C:\\work\\other', pid: 4321, command: 'check' }];
  other.refused({ reason: 'timeout', waitedMs: 30_000, waitedFor });
  // No end for a gate that never started.
  other.end({ result: 'pass' });
  assert.equal(events.length, 3);
  assert.deepEqual(events[2].event, { v: 1, event: 'refused', id: 'id-2', at: AT, cwd: 'c', command: long.slice(0, 120), pid: 100, reason: 'timeout', waitedSeconds: 30, waitedFor });
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

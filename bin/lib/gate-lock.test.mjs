import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { gateDir, gateLockDir, readGateHolder, readGateWaiters, takeGateLock } from './gate-lock.mjs';

const STALE_MS = 60_000;
const POLL_MS = 2_000;

function makeTmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-gate-lock-home-'));
}

/** A clock the test moves. It starts at the real time, on a whole second, so the times the file system
 * stamps by itself (a folder just made) read as "now" on it; `sleep` moves it and waits for nothing. */
function fakeClock() {
  let at = Math.floor(Date.now() / 1000) * 1000;
  const clock = {
    /** What the test does while a gate sleeps: beat a lock, release one. */
    onSleep: undefined,
    now: () => at,
    advance: (ms) => {
      at += ms;
    },
    sleep: async (ms) => {
      at += ms;
      await clock.onSleep?.();
    },
  };
  return clock;
}

/** `takeGateLock` on `clock`, with no timer of its own: a test beats by hand. */
function take(home, clock, options = {}) {
  return takeGateLock({
    home,
    cwd: 'C:\\work\\one',
    command: 'check',
    now: clock.now,
    sleep: clock.sleep,
    staleMs: STALE_MS,
    pollMs: POLL_MS,
    beatMs: 0,
    ...options,
  });
}

function withHome(run) {
  return async () => {
    const home = makeTmpHome();
    try {
      await run(home);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  };
}

/** `fs` with `before(name, args)` run ahead of every call: a test steps in between two file operations
 * of a gate, or makes one of them fail. */
function tapped(before) {
  return new Proxy(fs, {
    get: (target, name) => (typeof target[name] === 'function' ? (...args) => (before(name, args), target[name](...args)) : target[name]),
  });
}

const failing = (code) => Object.assign(new Error(`${code}: made up by the test`), { code });
const holderFiles = (home) => (fs.existsSync(gateLockDir(home)) ? fs.readdirSync(gateLockDir(home)) : []);
const waitFolders = (home) => (fs.existsSync(gateDir(home)) ? fs.readdirSync(gateDir(home)) : []).filter((name) => name.startsWith('wait-'));

/** Lets everything that is ready to run do so: a gate that was just woken runs its turn to its next sleep. */
const settled = () => new Promise((resolve) => setImmediate(resolve));

/** A gate of another process, as far as one process can play one: a real take on `clock` whose `sleep`
 * ends only when the test says, so the gate stands still at its poll while the test's own gate runs.
 * `turn()` wakes it for one turn of its loop. `lock` is what its take came to, once it has: the lock in
 * hand, or a refusal; `error` what it rejected with. A gate that is never woken again is a gate that died
 * where it stood: nothing touches its folder any more.
 *
 * Its folder is stamped by the file system, with the real time, so a test that needs to the millisecond
 * when such a gate reads as dead plays it with `inLine` instead, which stamps what it is told. */
function parked(home, clock, options = {}) {
  const asleep = [];
  const gate = {
    lock: undefined,
    error: undefined,
    turn: async () => {
      asleep.shift()?.();
      await settled();
    },
  };
  take(home, clock, { ...options, sleep: () => new Promise((resolve) => asleep.push(resolve)) }).then(
    (lock) => {
      gate.lock = lock;
    },
    (err) => {
      gate.error = err;
    },
  );
  return gate;
}

/** The folder of a gate in the line, written by hand: what a gate of another process, or of another
 * version, keeps there. `says` is its file, an object or the text itself, and `touched` when the folder
 * and the file were last touched. `touch(at)` touches both again, as a gate that is alive does. */
function inLine(home, token, says, touched) {
  const folder = path.join(gateDir(home), `wait-${token}`);
  const file = path.join(folder, `holder-${token}.json`);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(file, typeof says === 'string' ? says : `${JSON.stringify(says)}\n`);
  const touch = (at) => {
    fs.utimesSync(file, at, at);
    fs.utimesSync(folder, at, at);
  };
  touch(touched);
  return { folder, file, touch };
}

/** The token `inLine` is given for the gate of `pid`. */
const tokenOf = (pid) => `${pid}-aaaaaaaaaaaa`;
/** What the file of a gate said before the lock was a line: the gate of `pid`, which waits since `since`. */
const saysNoLine = (pid, since) => ({ token: tokenOf(pid), pid, cwd: `C:\\work\\${pid}`, command: 'check', startedAt: new Date(since).toISOString(), waitingSince: new Date(since).toISOString() });
/** What the file of a gate that keeps the line says: the same, with the mark of the line and its session. */
const saysLine = (pid, since) => ({ ...saysNoLine(pid, since), line: 1, session: null });
/** That gate as a caller of the lock is told of it: what `readGateWaiters` gives for it. */
const waiterOf = (pid, since) => ({ token: tokenOf(pid), pid, cwd: `C:\\work\\${pid}`, command: 'check', waitingSince: new Date(since).toISOString(), session: null });

test('everything the lock writes is under <home>/.js-harness/gate, and the lock is its folder `lock`', () => {
  assert.equal(gateDir('/h'), path.join('/h', '.js-harness', 'gate'));
  assert.equal(gateLockDir('/h'), path.join('/h', '.js-harness', 'gate', 'lock'));
});

test('readGateHolder is null when no gate holds the lock', withHome((home) => {
  assert.equal(readGateHolder(home), null);
}));

test('a gate takes a free lock at once and the holder can be read', withHome(async (home) => {
  const clock = fakeClock();
  const lock = await take(home, clock, { pid: 4321, cwd: 'C:\\work\\one', command: 'check --cwd one' });
  assert.equal(lock.refused, undefined);
  assert.equal(lock.waitedMs, 0);
  const holder = readGateHolder(home, { now: clock.now, staleMs: STALE_MS });
  assert.equal(holder.pid, 4321);
  assert.equal(holder.cwd, 'C:\\work\\one');
  assert.equal(holder.command, 'check --cwd one');
  assert.equal(holder.startedAt, new Date(clock.now()).toISOString());
  assert.equal(holder.beatAt, clock.now());
  assert.equal(holder.stale, false);
  lock.release();
}));

test('taking the lock creates <home>/.js-harness when it does not exist yet', withHome(async (home) => {
  assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);
  const lock = await take(home, fakeClock());
  assert.equal(fs.existsSync(gateLockDir(home)), true);
  lock.release();
}));

test('release leaves nothing behind and the lock can be taken again', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock);
  first.release();
  assert.equal(fs.existsSync(gateLockDir(home)), false);
  assert.equal(readGateHolder(home), null);
  const second = await take(home, clock);
  assert.equal(second.refused, undefined);
  second.release();
}));

test('release twice is harmless', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock);
  first.release();
  const second = await take(home, clock, { pid: 2 });
  first.release();
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 2);
  second.release();
}));

test('with wait off, a second gate is refused at once and told who holds the lock', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11, cwd: 'C:\\work\\one' });
  const second = await take(home, clock, { pid: 22, cwd: 'C:\\work\\two', wait: false });
  assert.equal(second.refused, 'held');
  assert.equal(second.holder.pid, 11);
  assert.equal(second.holder.cwd, 'C:\\work\\one');
  assert.equal(second.release, undefined);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 11);
  first.release();
}));

test('a second gate waits for the first, is told once whom it waits for, and then takes the lock', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11, cwd: 'C:\\work\\one' });
  let sleeps = 0;
  clock.onSleep = () => {
    sleeps += 1;
    first.beat();
    if (sleeps === 3) first.release();
  };
  const told = [];
  const second = await take(home, clock, { pid: 22, cwd: 'C:\\work\\two', onWait: (holder) => told.push(holder) });
  assert.equal(second.refused, undefined);
  assert.equal(second.waitedMs, 3 * POLL_MS);
  assert.equal(told.length, 1);
  assert.equal(told[0].pid, 11);
  assert.equal(told[0].cwd, 'C:\\work\\one');
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 22);
  second.release();
}));

// The gate that takes the lock next is one that stood in the line before the gate that is told. When this
// test was written that gate arrived last and took a free lock from under the one that waited, which is
// what the line ends (2026-10-11): arriving last, it now stands back.
test('a waiting gate is told again when the gate it waits for changes', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  const third = parked(home, clock, { pid: 33 });
  clock.advance(1000);
  let sleeps = 0;
  clock.onSleep = async () => {
    sleeps += 1;
    if (sleeps === 1) {
      first.release();
      await third.turn();
    }
    if (sleeps === 3) third.lock.release();
  };
  const told = [];
  const second = await take(home, clock, { pid: 22, onWait: (holder) => told.push(holder.pid) });
  assert.deepEqual(told, [11, 33]);
  second.release();
}));

// Each notice said what was left of the bound, which then counted from the arrival (found in review,
// 2026-10-10). Since 2026-10-11 the bound counts from the last time the lock changed hands, so what is
// left with a new holder is the whole of it, and that is what this test now pins. The second holder stood
// in the line before the gate that is told, as in the test above.
test('a waiting gate is told, with each gate it waits for, the whole of its bound again: it counts from the last time the lock changed hands', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  const third = parked(home, clock, { pid: 33 });
  clock.advance(1000);
  let sleeps = 0;
  clock.onSleep = async () => {
    sleeps += 1;
    first.beat();
    if (sleeps === 3) {
      first.release();
      await third.turn();
    }
    if (sleeps === 5) third.lock.release();
  };
  const told = [];
  const second = await take(home, clock, { pid: 22, waitMs: 60_000, onWait: (holder, leftMs) => told.push([holder.pid, leftMs]) });
  assert.deepEqual(told, [[11, 60_000], [33, 60_000]]);
  assert.equal(second.waitedMs, 5 * POLL_MS);
  second.release();
}));

test('a waiting gate whose launcher is gone leaves the line at its next look and takes nothing; the holder keeps the lock', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  clock.onSleep = () => first.beat();
  let looks = 0;
  const second = await take(home, clock, { pid: 22, stillWanted: () => (looks += 1) < 3 });
  assert.equal(second.refused, 'launcher gone');
  assert.equal(looks, 3, 'asked at every look, and left at the first that said no');
  assert.equal(second.holder, null);
  assert.equal(typeof second.waitedMs, 'number');
  assert.deepEqual(waitFolders(home), [], 'its place in the line is given up');
  assert.equal(first.lost(), false);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 11);
  first.release();
  // At the head of the line, with the lock free, a gate whose launcher is gone takes nothing either.
  const alone = await take(home, clock, { pid: 33, stillWanted: () => false });
  assert.equal(alone.refused, 'launcher gone');
  assert.equal(readGateHolder(home, { now: clock.now }), null);
  assert.deepEqual(waitFolders(home), []);
  // And one whose launcher lives takes the lock as before.
  const live = await take(home, clock, { pid: 44, stillWanted: () => true });
  assert.equal(live.refused, undefined);
  live.release();
}));

test('the wait is bounded: past it the gate is refused and the holder keeps the lock', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  clock.onSleep = () => first.beat();
  const second = await take(home, clock, { pid: 22, waitMs: 60_000 });
  assert.equal(second.refused, 'timeout');
  assert.equal(second.holder.pid, 11);
  assert.equal(second.waitedMs, 60_000);
  // No gate of an older version was beside it at any look.
  assert.equal(second.besideOlder, false);
  assert.equal(first.lost(), false);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 11);
  first.release();
}));

test('a holder that keeps beating is never taken over, however long it runs', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  clock.onSleep = () => first.beat();
  const second = await take(home, clock, { pid: 22, waitMs: 3 * STALE_MS });
  assert.equal(second.refused, 'timeout');
  assert.equal(first.lost(), false);
  first.release();
}));

test('the lock of a gate that died is taken over once it has not beaten for the stale time', withHome(async (home) => {
  const clock = fakeClock();
  const dead = await take(home, clock, { pid: 11 });
  const second = await take(home, clock, { pid: 22 });
  assert.equal(second.refused, undefined);
  assert.ok(second.waitedMs > STALE_MS, `waited ${second.waitedMs} ms`);
  assert.ok(second.waitedMs <= STALE_MS + 2 * POLL_MS, `waited ${second.waitedMs} ms`);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 22);
  // The first one was only frozen, and comes back: it knows the lock is no longer its own, and its
  // release must not take the lock away from the gate that holds it now.
  assert.equal(dead.lost(), true);
  dead.beat();
  dead.release();
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 22);
  assert.equal(second.lost(), false);
  second.release();
}));

test('with wait off, the lock of a gate that died is still taken over', withHome(async (home) => {
  const clock = fakeClock();
  await take(home, clock, { pid: 11 });
  clock.advance(STALE_MS + 1000);
  const second = await take(home, clock, { pid: 22, wait: false, onWait: () => assert.fail('a gate that does not wait is not told it waits') });
  assert.equal(second.refused, undefined);
  assert.equal(second.waitedMs, POLL_MS);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 22);
  second.release();
}));

test('a lock that can be neither taken nor read is an error after a few tries, not an endless wait', withHome(async (home) => {
  // The rename is refused and there is no lock folder, so no holder to wait for: what a folder that
  // cannot be written answers.
  let renames = 0;
  const io = tapped((name) => {
    if (name !== 'renameSync') return;
    renames += 1;
    throw failing('EPERM');
  });
  const clock = fakeClock();
  const startedAt = clock.now();
  await assert.rejects(take(home, clock, { fileSystem: io }), { code: 'EPERM' });
  assert.ok(renames > 1, 'it tried again');
  assert.ok(clock.now() - startedAt < POLL_MS, `gave up after ${clock.now() - startedAt} ms`);
  assert.equal(fs.existsSync(gateDir(home)), false, 'neither its own folder nor the folder `gate` is left');
}));

test('a file where the lock folder goes holds nothing: the lock is taken or the take is an error, never a wait', withHome(async (home) => {
  // Windows lets the rename replace the file; elsewhere it is refused and nothing can be read in it.
  fs.mkdirSync(gateDir(home), { recursive: true });
  fs.writeFileSync(gateLockDir(home), 'in the way');
  const clock = fakeClock();
  const startedAt = clock.now();
  const lock = await take(home, clock).catch((err) => err);
  assert.ok(typeof lock.release === 'function' || ['EEXIST', 'ENOTDIR', 'EISDIR', 'EPERM'].includes(lock.code), String(lock));
  assert.ok(clock.now() - startedAt < POLL_MS, `took ${clock.now() - startedAt} ms`);
  lock.release?.();
}));

test('a lock is not taken over on one stale reading: a holder that beats before the next one keeps it', withHome(async (home) => {
  // A machine that slept wakes with every beat hours old; the holder's own timer fires within one poll.
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  clock.advance(8 * 60 * 60_000);
  clock.onSleep = () => first.beat();
  const second = await take(home, clock, { pid: 22, waitMs: 5 * POLL_MS });
  assert.equal(second.refused, 'timeout');
  assert.equal(first.lost(), false);
  first.release();
}));

test('two gates that find the same dead holder do not both take the lock', withHome(async (home) => {
  const clock = fakeClock();
  await take(home, clock, { pid: 11 });
  clock.advance(STALE_MS + POLL_MS);
  // Each sleep hands the turn to the other, so the two take every step of the takeover interleaved.
  const sleep = async (ms) => {
    clock.advance(ms / 2);
    await new Promise((resolve) => setImmediate(resolve));
  };
  const [a, b] = await Promise.all([
    take(home, clock, { pid: 22, sleep, waitMs: 6 * POLL_MS }),
    take(home, clock, { pid: 33, sleep, waitMs: 6 * POLL_MS }),
  ]);
  const winners = [a, b].filter((lock) => !lock.refused);
  assert.equal(winners.length, 1, `refusals: ${a.refused}, ${b.refused}`);
  const loser = a.refused ? a : b;
  assert.equal(loser.refused, 'timeout');
  assert.equal(readGateHolder(home, { now: clock.now }).pid, a.refused ? 33 : 22);
  assert.equal(winners[0].lost(), false);
  winners[0].release();
}));

// The tests above run in one process, where every step of a take ends before another gate's begins.
// These are the proof between real processes: each writes when it goes in and when it comes out.
const RACER = `
import fs from 'node:fs';
import { takeGateLock } from ${JSON.stringify(pathToFileURL(path.join(import.meta.dirname, 'gate-lock.mjs')).href)};
const [home, log, options] = process.argv.slice(1);
const { rounds, staleMs, pollMs, dies } = JSON.parse(options);
for (let round = 0; round < rounds; round++) {
  const lock = await takeGateLock({ home, cwd: String(process.pid), command: 'race', staleMs, pollMs, beatMs: 50 });
  if (lock.refused) throw new Error('refused: ' + lock.refused);
  fs.appendFileSync(log, 'in ' + process.pid + '\\n');
  await new Promise((resolve) => setTimeout(resolve, 25));
  fs.appendFileSync(log, 'out ' + process.pid + '\\n');
  if (dies) process.exit(0);
  lock.release();
}
`;

/** One process that takes the lock `rounds` times; resolves to its exit status and what it said. */
function racer(home, log, options) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', RACER, home, log, JSON.stringify(options)], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('exit', (status) => resolve({ status, stderr }));
  });
}

/** Every "in" of the log is followed by the "out" of the same process: no two were inside together. */
function assertNeverTogether(log, takes) {
  const lines = log.trim().split('\n');
  assert.equal(lines.length, takes * 2, lines.join(' | '));
  for (let i = 0; i < lines.length; i += 2) {
    const [, pid] = lines[i].split(' ');
    assert.equal(lines[i], `in ${pid}`, `line ${i + 1} of ${lines.join(' | ')}`);
    assert.equal(lines[i + 1], `out ${pid}`, `line ${i + 2} of ${lines.join(' | ')}`);
  }
}

test('processes that race for the lock of a dead holder, and then for each other\'s, are never inside together', withHome(async (home) => {
  fs.mkdirSync(gateLockDir(home), { recursive: true });
  const dead = path.join(gateLockDir(home), 'holder-dead.json');
  fs.writeFileSync(dead, JSON.stringify({ token: 'dead', pid: 1, cwd: 'gone', command: 'check', startedAt: new Date(0).toISOString() }));
  const old = new Date(Date.now() - 60 * 60_000);
  fs.utimesSync(dead, old, old);
  const log = path.join(home, 'race.log');
  const results = await Promise.all(Array.from({ length: 5 }, () => racer(home, log, { rounds: 3, staleMs: 5000, pollMs: 15, dies: false })));
  for (const { status, stderr } of results) assert.equal(status, 0, stderr);
  assertNeverTogether(fs.readFileSync(log, 'utf8'), 5 * 3);
  assert.equal(fs.existsSync(gateLockDir(home)), false);
}));

test('the lock folder never exists without its holder\'s file while a gate takes the lock', withHome(async (home) => {
  // A first version made the folder and then wrote the file. In between the folder was empty and its
  // maker's, and a gate late to a takeover removed it and made its own: both held the lock.
  // What is seen is kept and judged after the take: thrown from in here, it would be caught by the
  // steps of a take that catch everything (the sweep, the removal of its own folder).
  let taking = true;
  let calls = 0;
  const emptyBefore = [];
  const io = tapped((name) => {
    calls += 1;
    if (taking && fs.existsSync(gateLockDir(home)) && fs.readdirSync(gateLockDir(home)).length === 0) emptyBefore.push(name);
  });
  const lock = await take(home, fakeClock(), { fileSystem: io });
  taking = false;
  assert.deepEqual(emptyBefore, [], `the lock folder was empty in the middle of a take, before ${emptyBefore.join(', ')}`);
  assert.ok(calls > 0, 'the take went through the file system it was given');
  assert.equal(holderFiles(home).length, 1);
  lock.release();
}));

test('a gate that comes late to a takeover does not remove the lock of the gate that already took it', withHome(async (home) => {
  const clock = fakeClock();
  await take(home, clock, { pid: 11 });
  clock.advance(STALE_MS + 1000);
  let took = false;
  const io = tapped((name, [target]) => {
    // The late gate has read the dead holder stale twice and is about to remove its file. In that
    // instant another gate removes it and takes the lock.
    if (name !== 'rmSync' || took || !String(target).includes('holder-11-')) return;
    took = true;
    fs.rmSync(target);
    fs.rmdirSync(gateLockDir(home));
    // That gate is played on the disk: its folder, renamed to the lock, which is the one step of a take.
    // It was a real take started here, in this instant, until the lock became a line (2026-10-11): a gate
    // that arrives now stands back for the late one, which arrived before it, and takes nothing in this
    // instant. A gate that was ahead of the late one can still do exactly this, and so can a gate of a
    // version before the line, and neither can be made to run its steps from inside this one.
    const winner = inLine(home, tokenOf(22), saysLine(22, clock.now()), new Date(clock.now()));
    fs.renameSync(winner.folder, gateLockDir(home));
  });
  const late = await take(home, clock, { pid: 33, fileSystem: io, waitMs: 5 * POLL_MS });
  assert.equal(took, true);
  assert.equal(late.refused, 'timeout');
  assert.equal(late.holder.pid, 22);
  // The lock of the gate that took it is as that gate left it: its file, and no other. This was asked of
  // the lock in hand of the real take (`lost()` false), and is asked of the disk now.
  assert.deepEqual(holderFiles(home), [`holder-${tokenOf(22)}.json`]);
  assert.equal(readGateHolder(home, { now: clock.now }).token, tokenOf(22));
}));

test('an empty lock folder is nobody\'s: it is cleared and the lock is taken at once', withHome(async (home) => {
  // What a release or a takeover leaves between its two steps, or for good when it dies there.
  fs.mkdirSync(gateLockDir(home), { recursive: true });
  const lock = await take(home, fakeClock(), { pid: 22, wait: false });
  assert.equal(lock.refused, undefined);
  assert.equal(lock.waitedMs, 0);
  assert.equal(holderFiles(home).length, 1);
  lock.release();
}));

/** `io`: `fs` whose `name` fails with `code` the first `times` it is asked for the file of the holder
 * with `pid`. `failed()` says how many times it did. */
function busyFor(pid, name, code, times = Infinity) {
  let failed = 0;
  const io = tapped((called, [target]) => {
    if (called !== name || !String(target).includes(`holder-${pid}-`) || failed >= times) return;
    failed += 1;
    throw failing(code);
  });
  return { io, failed: () => failed };
}

test('a holder file that is busy as it is read is a holder since when is not known, one that is gone is none, and neither throws', withHome(async (home) => {
  const clock = fakeClock();
  const lock = await take(home, clock, { pid: 11 });
  const [name] = holderFiles(home);
  // Long past the stale time: a beat that could not be read is not an old beat.
  clock.advance(10 * STALE_MS);
  const holder = readGateHolder(home, { now: clock.now, staleMs: STALE_MS, fileSystem: busyFor(11, 'statSync', 'EPERM').io });
  assert.equal(holder.token, name.slice('holder-'.length, -'.json'.length));
  assert.equal(holder.beatAt, null);
  assert.equal(holder.stale, false);
  assert.equal(readGateHolder(home, { now: clock.now, fileSystem: busyFor(11, 'statSync', 'ENOENT').io }), null);
  assert.equal(readGateHolder(home, { now: clock.now, staleMs: STALE_MS }).stale, true);
  lock.release();
}));

test('a holder whose file is busy holds the lock: a gate waits for it and takes the lock only once it is released', withHome(async (home) => {
  // Busy for more looks than a take makes of a lock nobody holds before it gives up. Read as an empty
  // lock, such a holder made the take an error, and a caller that goes on without the lock ran beside it.
  // The looks are a second apart, so the fifty of them fit in the stale time, which is how long a holder
  // that cannot be read is waited for.
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  const [firstFile] = holderFiles(home);
  const busy = busyFor(11, 'statSync', 'EBUSY', 50);
  const inTheLock = new Set();
  let sleeps = 0;
  clock.onSleep = () => {
    sleeps += 1;
    inTheLock.add(holderFiles(home).join());
    first.beat();
    if (sleeps === 53) first.release();
  };
  const told = [];
  const second = await take(home, clock, { pid: 22, pollMs: 1000, fileSystem: busy.io, onWait: (holder) => told.push(holder) });
  assert.equal(second.refused, undefined);
  assert.equal(busy.failed(), 50);
  assert.equal(second.waitedMs, 53 * 1000);
  assert.deepEqual([...inTheLock], [firstFile], 'only the first gate held the lock until it released it');
  // Told of it while its beat could not be read, and again once it could.
  assert.deepEqual(told.map((holder) => [holder.pid, holder.beatAt === null]), [[11, true], [11, false]]);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 22);
  second.release();
}));

test('a holder whose file stays busy refuses a gate that does not wait at once, and is never taken over', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  const busy = busyFor(11, 'statSync', 'EACCES');
  const atOnce = await take(home, clock, { pid: 22, wait: false, fileSystem: busy.io });
  assert.equal(atOnce.refused, 'held');
  assert.equal(atOnce.waitedMs, 0);
  assert.equal(atOnce.holder.beatAt, null);
  assert.equal(atOnce.holder.stale, false);
  // Nor is it taken over, however old the beat that cannot be read may be.
  clock.advance(2 * STALE_MS);
  // A wait that read nothing of it from end to end is an error, not a gate that timed out (below).
  await assert.rejects(take(home, clock, { pid: 33, waitMs: 5 * POLL_MS, fileSystem: busy.io }), { code: 'GATE_LOCK_UNREADABLE' });
  assert.equal(first.lost(), false);
  assert.deepEqual(waitFolders(home), []);
  first.release();
}));

// Found in review, 2026-10-10: the end of the wait was judged first, so with a wait no longer than the stale
// time (`check --wait 1` or less) a lock of which nothing could be read still ended as a gate that timed
// out, a red row that blamed another gate.
test('an unreadable lock is judged before the end of the wait: nothing read of it for a whole wait no longer than the stale time is the error, not a timeout', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  for (const waitMs of [STALE_MS, STALE_MS / 2, POLL_MS]) {
    const began = clock.now();
    const busy = busyFor(11, 'statSync', 'EACCES');
    await assert.rejects(take(home, clock, { pid: 22, waitMs, fileSystem: busy.io }), {
      code: 'GATE_LOCK_UNREADABLE',
      message: `the gate lock at ${gateLockDir(home)} could be neither taken nor read: its holder's file could not be looked at since ${new Date(began).toISOString()} (EACCES)`,
    }, `a wait of ${waitMs} ms`);
    assert.equal(clock.now() - began, waitMs, 'at the end of its wait, not before');
    first.beat();
  }
  // With no wait at all it is still a refusal, at once: one look says nothing of how long.
  assert.equal((await take(home, clock, { pid: 22, wait: false, fileSystem: busyFor(11, 'statSync', 'EACCES').io })).refused, 'held');
  assert.deepEqual(waitFolders(home), []);
  first.release();
}));

// Found in review, 2026-10-10: with a wait of zero the wait is over at the first look, and that one look,
// when it read nothing, was already the error. `check` cannot ask for a zero wait; a caller of this can.
test('a wait that is over at the first look, which could read nothing, is given one more look a poll later, and that look is the verdict', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  clock.onSleep = () => first.beat();
  const zero = (io) => take(home, clock, { pid: 22, waitMs: 0, fileSystem: io });

  // Read at the second look: a gate that was seen, so the wait times out, and names it.
  let busy = busyFor(11, 'statSync', 'EBUSY', 1);
  const seen = await zero(busy.io);
  assert.deepEqual([seen.refused, seen.holder.pid, seen.waitedMs, busy.failed()], ['timeout', 11, POLL_MS, 1]);

  // Still nothing read at the second look: the error, after that one poll and no more.
  let began = clock.now();
  busy = busyFor(11, 'statSync', 'EACCES');
  await assert.rejects(zero(busy.io), {
    code: 'GATE_LOCK_UNREADABLE',
    message: `the gate lock at ${gateLockDir(home)} could be neither taken nor read: its holder's file could not be looked at since ${new Date(began).toISOString()} (EACCES)`,
  });
  assert.deepEqual([clock.now() - began, busy.failed()], [POLL_MS, 2]);

  // A holder the first look reads is refused at once, as before: one look that saw a gate is a verdict.
  began = clock.now();
  const atOnce = await zero(fs);
  assert.deepEqual([atOnce.refused, atOnce.holder.pid, clock.now() - began], ['timeout', 11, 0]);

  // Free by the second look: the lock is taken.
  clock.onSleep = () => first.release();
  const taken = await zero(busyFor(11, 'statSync', 'EBUSY', 1).io);
  assert.deepEqual([taken.refused, taken.waitedMs, readGateHolder(home, { now: clock.now }).pid], [undefined, POLL_MS, 22]);
  taken.release();
  assert.deepEqual(waitFolders(home), []);
}));

test('a holder that was read once and cannot be at the end of a short wait is a gate that was seen: the wait times out', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  clock.onSleep = () => first.beat();
  let looks = 0;
  const io = tapped((name, [target]) => {
    if (name !== 'statSync' || !String(target).includes('holder-11-')) return;
    looks += 1;
    if (looks > 1) throw failing('EBUSY');
  });
  const second = await take(home, clock, { pid: 22, waitMs: 5 * POLL_MS, fileSystem: io });
  assert.equal(second.refused, 'timeout');
  assert.equal(second.waitedMs, 5 * POLL_MS);
  assert.equal(second.holder.pid, 11);
  first.release();
}));

// Found in review, 2026-10-10: a holder unreadable at the first look was announced as waited for "60 s at
// most", and when it became readable the wait went on to the whole bound with no new notice.
test('a waiting gate is told again when the holder it could not read becomes readable, and when it stops being so, with what is left by then', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  // Unreadable at the looks 1 to 3 and 7 to 8, readable at the others.
  let looks = 0;
  const io = tapped((name, [target]) => {
    if (name !== 'statSync' || !String(target).includes('holder-11-')) return;
    looks += 1;
    if (looks <= 3 || looks === 7 || looks === 8) throw failing('EBUSY');
  });
  let sleeps = 0;
  clock.onSleep = () => {
    sleeps += 1;
    first.beat();
    if (sleeps === 9) first.release();
  };
  const told = [];
  const waitMs = 10 * 60_000;
  const second = await take(home, clock, { pid: 22, waitMs, fileSystem: io, onWait: (holder, leftMs) => told.push([holder.pid, holder.beatAt === null, leftMs]) });
  assert.equal(second.refused, undefined);
  assert.deepEqual(told, [
    [11, true, STALE_MS],
    [11, false, waitMs - 3 * POLL_MS],
    [11, true, STALE_MS],
    [11, false, waitMs - 8 * POLL_MS],
  ]);
  second.release();
}));

// Found in review, 2026-10-10: a holder that could never be read kept each gate waiting to the end of its
// wait, an hour, and then refused it: a red gate that blamed another gate when none was there.
test('a holder whose file stays unreadable for the stale time is no gate to wait an hour for: the take is an error that says since when', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  const [firstFile] = holderFiles(home);
  const began = clock.now();
  const busy = busyFor(11, 'statSync', 'EACCES');
  const told = [];
  const taking = take(home, clock, { pid: 22, waitMs: 60 * 60_000, fileSystem: busy.io, onWait: (holder, leftMs) => told.push([holder.beatAt, leftMs]) });
  await assert.rejects(taking, {
    code: 'GATE_LOCK_UNREADABLE',
    message: `the gate lock at ${gateLockDir(home)} could be neither taken nor read: its holder's file could not be looked at since ${new Date(began).toISOString()} (EACCES)`,
  });
  assert.equal(clock.now() - began, STALE_MS, 'waited for like a gate for the stale time, a poll at a time');
  // Told at once that this one is waited for a minute at most, not for the hour of the wait.
  assert.deepEqual(told, [[null, STALE_MS]]);
  // Not taken over: nothing said its gate had died.
  assert.equal(first.lost(), false);
  assert.deepEqual(holderFiles(home), [firstFile]);
  assert.deepEqual(waitFolders(home), []);
  first.release();
}));

test('the stale time of a holder that cannot be read is counted from the first such look in a row: one that reads its beat starts it again', withHome(async (home) => {
  // Unreadable for forty seconds, read once, unreadable for forty more: eighty in all, never sixty in a row.
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  let looks = 0;
  const io = tapped((name, [target]) => {
    if (name !== 'statSync' || !String(target).includes('holder-11-')) return;
    looks += 1;
    if (looks !== 21 && looks <= 41) throw failing('EBUSY');
  });
  let sleeps = 0;
  clock.onSleep = () => {
    sleeps += 1;
    first.beat();
    if (sleeps === 45) first.release();
  };
  const second = await take(home, clock, { pid: 22, fileSystem: io });
  assert.equal(second.refused, undefined);
  assert.equal(second.waitedMs, 45 * POLL_MS);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 22);
  second.release();
}));

test('a dead holder whose file cannot be removed yet is looked at again, not an error', withHome(async (home) => {
  const clock = fakeClock();
  await take(home, clock, { pid: 11 });
  clock.advance(STALE_MS + 1000);
  // Busy for longer than the tries of one removal, so the take must come back to it.
  const busy = busyFor(11, 'rmSync', 'EBUSY', 8);
  const second = await take(home, clock, { pid: 22, fileSystem: busy.io });
  assert.equal(second.refused, undefined);
  assert.equal(busy.failed(), 8);
  assert.ok(second.waitedMs > 2 * POLL_MS, `waited ${second.waitedMs} ms`);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 22);
  second.release();
}));

// A takeover tries the removal once. Tried again in the same look, it removed a file on the strength of
// two stale readings made before the first try: found in review, 2026-10-10.
test('a takeover tries the removal of a dead holder\'s file once: a busy answer goes back to the wait', withHome(async (home) => {
  const clock = fakeClock();
  await take(home, clock, { pid: 11 });
  clock.advance(STALE_MS + 1000);
  const busy = busyFor(11, 'rmSync', 'EBUSY', 2);
  const second = await take(home, clock, { pid: 22, wait: false, fileSystem: busy.io });
  assert.equal(second.refused, undefined);
  assert.equal(busy.failed(), 2);
  // Two stale readings a poll apart before each try: one poll, then two more for each busy answer.
  assert.equal(second.waitedMs, 5 * POLL_MS);
  second.release();
}));

test('a takeover does not remove a holder\'s file whose beat moved: a busy answer may be the holder coming back', withHome(async (home) => {
  // Read stale twice, and then the removal answers busy: likely the holder itself, touching its file as
  // it comes back to life. The next try removed a file that had beaten a moment before, and two gates ran.
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  clock.advance(STALE_MS + 1000);
  let busy = 0;
  const io = tapped((name, [target]) => {
    if (name !== 'rmSync' || busy > 0 || !String(target).includes('holder-11-')) return;
    busy += 1;
    first.beat();
    throw failing('EBUSY');
  });
  const second = await take(home, clock, { pid: 22, fileSystem: io, waitMs: 5 * POLL_MS });
  assert.equal(busy, 1);
  assert.equal(second.refused, 'timeout');
  assert.equal(second.holder.pid, 11);
  assert.equal(first.lost(), false);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 11);
  first.release();
}));

/** `io`: `fs` whose listing of the lock folder fails with `code` the first `times` it is asked for.
 * `failed()` says how many times it did. */
function unlistable(home, code, times = Infinity) {
  let failed = 0;
  const io = tapped((called, [target]) => {
    if (called !== 'readdirSync' || target !== gateLockDir(home) || failed >= times) return;
    failed += 1;
    throw failing(code);
  });
  return { io, failed: () => failed };
}

/** The holder that is read when the lock folder is there and nothing in it can be. Its session is not
 * known either, which a holder has said since the gate's file names it (2026-10-11). */
const NOBODY_KNOWN = { token: null, pid: null, cwd: null, command: null, session: null, startedAt: null, beatAt: null, stale: false };

test('a lock folder that is there and cannot be listed is a lock held by a gate of whom nothing is known, not a free one', withHome(async (home) => {
  const clock = fakeClock();
  const lock = await take(home, clock, { pid: 11 });
  // Long past the stale time: a gate that could not be seen is not a gate that died.
  clock.advance(10 * STALE_MS);
  for (const code of ['EPERM', 'EACCES', 'EBUSY']) {
    assert.deepEqual(readGateHolder(home, { now: clock.now, staleMs: STALE_MS, fileSystem: unlistable(home, code).io }), NOBODY_KNOWN, code);
  }
  assert.equal(readGateHolder(home, { now: clock.now, fileSystem: unlistable(home, 'ENOENT').io }), null);
  lock.release();
}));

test('a gate waits for a lock folder that stays busy past its blind tries, and takes the lock only once it is released', withHome(async (home) => {
  // Busy for more looks than a take makes of a lock nobody holds before it gives up. Read as no folder,
  // it made the take an error, and a caller that goes on without the lock ran beside the gate inside.
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  const [firstFile] = holderFiles(home);
  const busy = unlistable(home, 'EPERM', 50);
  const inTheLock = new Set();
  let sleeps = 0;
  clock.onSleep = () => {
    sleeps += 1;
    inTheLock.add(holderFiles(home).join());
    first.beat();
    if (sleeps === 52) first.release();
  };
  const told = [];
  const second = await take(home, clock, { pid: 22, fileSystem: busy.io, onWait: (holder) => told.push(holder) });
  assert.equal(second.refused, undefined);
  assert.equal(busy.failed(), 50);
  assert.deepEqual([...inTheLock], [firstFile], 'only the first gate held the lock until it released it');
  // Told of a gate nobody can name once the blind tries are spent, and of the first one once it can be read.
  assert.deepEqual(told.map((holder) => holder.pid), [null, 11]);
  assert.deepEqual(told[0], NOBODY_KNOWN);
  // 40 blind tries 25 ms apart, and from then on a look every poll, not 40 more tries before each.
  assert.equal(second.waitedMs, 39 * 25 + 13 * POLL_MS);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 22);
  second.release();
}));

test('a lock folder that stays busy refuses a gate that does not wait once its blind tries are spent, and is never taken over', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  const [firstFile] = holderFiles(home);
  const busy = unlistable(home, 'EBUSY');
  const atOnce = await take(home, clock, { pid: 22, wait: false, fileSystem: busy.io });
  assert.equal(atOnce.refused, 'held');
  assert.deepEqual(atOnce.holder, NOBODY_KNOWN);
  assert.ok(atOnce.waitedMs < POLL_MS, `waited ${atOnce.waitedMs} ms`);
  // Nor is it taken over, however long nothing in it can be read.
  clock.advance(2 * STALE_MS);
  // A wait shorter than the stale time that listed nothing from end to end is the error, at its end.
  const began = clock.now();
  await assert.rejects(take(home, clock, { pid: 33, waitMs: 5 * POLL_MS, fileSystem: busy.io }), { code: 'GATE_LOCK_UNREADABLE' });
  assert.ok(clock.now() - began >= 5 * POLL_MS && clock.now() - began < 6 * POLL_MS, `waited ${clock.now() - began} ms`);
  assert.equal(first.lost(), false);
  assert.deepEqual(holderFiles(home), [firstFile]);
  assert.deepEqual(waitFolders(home), []);
  first.release();
}));

// The other side of the same finding: no access to the lock folder is not a gate, and no gate ends it.
test('a lock folder that can never be listed is an error once the stale time has passed since the first look, not a wait to the end', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  const [firstFile] = holderFiles(home);
  const began = clock.now();
  const told = [];
  const taking = take(home, clock, { pid: 22, waitMs: 60 * 60_000, fileSystem: unlistable(home, 'EACCES').io, onWait: (holder, leftMs) => told.push([holder, leftMs]) });
  await assert.rejects(taking, {
    code: 'GATE_LOCK_UNREADABLE',
    message: `the gate lock at ${gateLockDir(home)} could be neither taken nor read: its folder could not be listed since ${new Date(began).toISOString()} (EACCES)`,
  });
  // The second of blind tries is part of the stale time, and the polls after it are the rest.
  assert.equal(clock.now() - began, 39 * 25 + 30 * POLL_MS);
  assert.deepEqual(told, [[NOBODY_KNOWN, STALE_MS - 39 * 25]]);
  assert.equal(first.lost(), false);
  assert.deepEqual(holderFiles(home), [firstFile]);
  assert.deepEqual(waitFolders(home), []);
  first.release();
}));

test('a gate whose file cannot be looked at has not lost its lock; one whose file is gone has', withHome(async (home) => {
  // `existsSync` answers "not there" for a file it could not look at, and a gate was told its lock had
  // been taken away when it had not.
  let busy = false;
  const io = new Proxy(fs, {
    get: (target, name) => {
      if (busy && name === 'existsSync') return () => false;
      if (busy && name === 'statSync') return () => { throw failing('EPERM'); };
      return target[name];
    },
  });
  const lock = await take(home, fakeClock(), { pid: 11, fileSystem: io });
  busy = true;
  assert.equal(lock.lost(), false);
  busy = false;
  assert.equal(lock.lost(), false);
  fs.rmSync(path.join(gateLockDir(home), holderFiles(home)[0]));
  assert.equal(lock.lost(), true);
  lock.release();
}));

// `rmSync` takes `maxRetries` and `retryDelay` and does not wait with them: on Node 24.15 and Windows 10
// a file another process held open for 150 ms answered EPERM within a millisecond, with `recursive` and
// without (run 2026-10-10). So a release tries again by itself, and this proves that it does.
test('release removes its holder\'s file when the file is busy for a moment, and leaves no lock behind', withHome(async (home) => {
  const busy = busyFor(11, 'rmSync', 'EPERM', 2);
  const lock = await take(home, fakeClock(), { pid: 11, fileSystem: busy.io });
  lock.release();
  assert.equal(fs.existsSync(gateLockDir(home)), false, 'the lock folder is gone');
  assert.equal(busy.failed(), 2);
}));

// --- nothing left on disk: the folder `gate` goes with the last gate ---
// A release left `<home>/.js-harness/gate` behind, empty, after every gate, against the rule that whatever
// the harness writes outside the repository can be undone exactly.

test('release removes the folder `gate` itself when nothing else is in it', withHome(async (home) => {
  const lock = await take(home, fakeClock());
  lock.release();
  assert.equal(fs.existsSync(gateDir(home)), false);
  // And the lock is taken again from nothing.
  const again = await take(home, fakeClock());
  assert.equal(again.refused, undefined);
  again.release();
  assert.equal(fs.existsSync(gateDir(home)), false);
}));

test('release leaves the folder `gate` to a gate that waits in it, and the last one to leave removes it', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  let left;
  clock.onSleep = () => {
    first.release();
    left = fs.readdirSync(gateDir(home));
  };
  const second = await take(home, clock, { pid: 22 });
  assert.equal(second.refused, undefined);
  assert.equal(left.length, 1, 'the folder of the gate that waits');
  assert.match(left[0], /^wait-22-/);
  second.release();
  assert.equal(fs.existsSync(gateDir(home)), false);
}));

test('a release never fails for a folder `gate` it cannot remove: one that got a gate in line as it was being removed, or one that is busy', withHome(async (home) => {
  // A gate stages its folder between the release's removal of the lock and its removal of `gate`.
  const staged = path.join(gateDir(home), 'wait-22-abc');
  let asked = 0;
  const racing = tapped((name, [target]) => {
    if (name !== 'rmdirSync' || target !== gateDir(home)) return;
    asked += 1;
    fs.mkdirSync(staged);
  });
  const first = await take(home, fakeClock(), { pid: 11, fileSystem: racing });
  first.release();
  assert.equal(asked, 1, 'the release tried to remove the folder `gate`');
  assert.equal(fs.existsSync(gateLockDir(home)), false, 'the lock is released');
  assert.equal(fs.existsSync(staged), true, 'the folder of the gate in line is still there');
  fs.rmSync(gateDir(home), { recursive: true });

  for (const code of ['EPERM', 'EBUSY', 'EACCES', 'EIO']) {
    const busy = tapped((name, [target]) => {
      if (name === 'rmdirSync' && target === gateDir(home)) throw failing(code);
    });
    const lock = await take(home, fakeClock(), { pid: 11, fileSystem: busy });
    lock.release();
    assert.equal(fs.existsSync(gateLockDir(home)), false, code);
    assert.equal(fs.existsSync(gateDir(home)), true, code);
  }
}));

test('a gate that stages its folder while the folder `gate` is being removed still takes the lock', withHome(async (home) => {
  // The release comes before the stage's `mkdir`, which makes `gate` again; between its `mkdir` and the
  // write of its file, where `gate` is not empty and stays; and as a `mkdir` that Windows refuses for an
  // instant because the folder is still on its way out.
  const steps = [
    { at: 'mkdirSync', refuse: false },
    { at: 'writeFileSync', refuse: false },
    { at: 'mkdirSync', refuse: true },
  ];
  for (const { at, refuse } of steps) {
    const clock = fakeClock();
    const first = await take(home, clock, { pid: 11 });
    let stepped = false;
    const io = tapped((name) => {
      if (name !== at || stepped) return;
      stepped = true;
      first.release();
      if (refuse) throw failing('EPERM');
    });
    const told = [];
    const second = await take(home, clock, { pid: 22, fileSystem: io, onWait: (holder) => told.push(holder.pid) });
    assert.equal(second.refused, undefined, at);
    assert.equal(stepped, true, at);
    assert.deepEqual(told, [], `${at}: it waited for nobody`);
    assert.equal(readGateHolder(home, { now: clock.now }).pid, 22, at);
    second.release();
    assert.equal(fs.existsSync(gateDir(home)), false, at);
  }
}));

test('a gate that is refused or gives up leaves the folder `gate` to the gate that holds the lock, which removes it', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  clock.onSleep = () => first.beat();
  assert.equal((await take(home, clock, { pid: 22, wait: false })).refused, 'held');
  assert.equal((await take(home, clock, { pid: 33, waitMs: 3 * POLL_MS })).refused, 'timeout');
  assert.deepEqual(fs.readdirSync(gateDir(home)), ['lock']);
  first.release();
  assert.equal(fs.existsSync(gateDir(home)), false);
}));

test('a gate leaves no folder of its own behind, whether it takes the lock, is refused or gives up', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  assert.deepEqual(waitFolders(home), []);
  clock.onSleep = () => first.beat();
  assert.equal((await take(home, clock, { pid: 22, wait: false })).refused, 'held');
  assert.deepEqual(waitFolders(home), []);
  assert.equal((await take(home, clock, { pid: 33, waitMs: 3 * POLL_MS })).refused, 'timeout');
  assert.deepEqual(waitFolders(home), []);
  first.release();
}));

test('the folder of a gate that died while it waited is swept by the next gate that takes the lock', withHome(async (home) => {
  const clock = fakeClock();
  const old = new Date(clock.now() - 10 * STALE_MS);
  // The one that is alive is a gate of a version before the line (its file reads, and has no mark of the
  // line), beside which a gate takes a free lock at once, as this test has it do. Its file was named
  // `holder-x.json` and said `{}`: the folder of a gate whose file is not there, of whom the line cannot
  // know when it arrived, and behind which a gate now stands back until that folder is a dead gate's too.
  for (const [token, at] of [['dead', old], ['alive', new Date(clock.now())]]) {
    const folder = path.join(gateDir(home), `wait-${token}`);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, `holder-${token}.json`), '{}');
    fs.utimesSync(path.join(folder, `holder-${token}.json`), at, at);
    fs.utimesSync(folder, at, at);
  }
  const lock = await take(home, clock);
  assert.deepEqual(waitFolders(home), ['wait-alive']);
  lock.release();
}));

test('an entry the sweep cannot read does not keep the dead waiter listed after it', withHome(async (home) => {
  // A file where a waiter's folder would be cannot be listed, as a waiter that left since the listing
  // cannot. Listings are sorted here, so it comes before the dead waiter on every file system.
  const clock = fakeClock();
  const old = new Date(clock.now() - 10 * STALE_MS);
  const dead = path.join(gateDir(home), 'wait-dead');
  fs.mkdirSync(dead, { recursive: true });
  fs.writeFileSync(path.join(dead, 'holder-x.json'), '{}');
  fs.utimesSync(path.join(dead, 'holder-x.json'), old, old);
  fs.utimesSync(dead, old, old);
  fs.writeFileSync(path.join(gateDir(home), 'wait-a-file'), 'not a folder');
  const sorted = new Proxy(fs, {
    get: (target, name) => (name === 'readdirSync' ? (...args) => target.readdirSync(...args).sort() : target[name]),
  });
  const lock = await take(home, clock, { fileSystem: sorted });
  assert.deepEqual(waitFolders(home), ['wait-a-file']);
  lock.release();
}));

// --- who waits: what the session board reads beside the holder ---

test('a gate that waits is read as a waiter, with its folder and since when; the gate that holds the lock is none', withHome(async (home) => {
  const clock = fakeClock();
  const read = () => readGateWaiters(home, { now: clock.now, staleMs: STALE_MS });
  assert.deepEqual(read(), [], 'no gate folder yet');
  const first = await take(home, clock, { pid: 11 });
  assert.deepEqual(read(), []);
  const began = new Date(clock.now()).toISOString();
  const seen = [];
  let sleeps = 0;
  clock.onSleep = () => {
    sleeps += 1;
    first.beat();
    seen.push(read());
    if (sleeps === 3) first.release();
  };
  const second = await take(home, clock, { pid: 22, cwd: 'C:\\work\\two', command: 'check' });
  assert.equal(seen.length, 3);
  for (const waiters of seen) {
    assert.equal(waiters.length, 1);
    const [{ token, ...said }] = waiters;
    assert.match(token, /^22-[0-9a-f]{12}$/);
    // Since its wait began, at every poll: not since the poll that staged its folder last. Its session is
    // read with the rest since the gate's file names it (2026-10-11): none was given to this gate.
    assert.deepEqual(said, { pid: 22, cwd: 'C:\\work\\two', command: 'check', waitingSince: began, session: null });
  }
  assert.deepEqual(read(), [], 'it holds the lock now');
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 22);
  second.release();
}));

test('readGateWaiters gives the longest wait first, leaves out a waiter that died, and knows a pid by its folder\'s name when its file cannot be read', withHome((home) => {
  const clock = fakeClock();
  const ago = (seconds) => new Date(clock.now() - seconds * 1000);
  const waiter = (token, content, touched) => {
    const folder = path.join(gateDir(home), `wait-${token}`);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, `holder-${token}.json`), content);
    fs.utimesSync(path.join(folder, `holder-${token}.json`), touched, touched);
    fs.utimesSync(folder, touched, touched);
  };
  const says = (pid, seconds) => JSON.stringify({ pid, cwd: `C:\\work\\${pid}`, command: 'check', waitingSince: ago(seconds).toISOString() });
  waiter('31-aaaaaaaaaaaa', says(31, 30), ago(1));
  waiter('32-bbbbbbbbbbbb', says(32, 300), ago(2));
  // A waiter writes its file again at every poll: read in that instant, the file is empty.
  waiter('33-cccccccccccc', '', ago(0));
  waiter('34-dddddddddddd', says(34, 900), ago(STALE_MS / 1000 + 1));
  waiter('garbage', '{ not json', ago(0));
  fs.writeFileSync(path.join(gateDir(home), 'wait-a-file'), 'not a folder');
  const waiters = readGateWaiters(home, { now: clock.now, staleMs: STALE_MS });
  const brief = ({ token, pid, cwd, waitingSince }) => [token, pid, cwd, waitingSince];
  assert.deepEqual(waiters.slice(0, 2).map(brief), [
    ['32-bbbbbbbbbbbb', 32, 'C:\\work\\32', ago(300).toISOString()],
    ['31-aaaaaaaaaaaa', 31, 'C:\\work\\31', ago(30).toISOString()],
  ]);
  // After them, in the order of the listing, the two whose wait has no known start.
  assert.deepEqual(waiters.slice(2).map(brief).sort(), [['33-cccccccccccc', 33, null, null], ['garbage', null, null, null]]);

  // A gate folder that is there and cannot be listed is not "nobody waits".
  const noAccess = tapped((name, [target]) => {
    if (name === 'readdirSync' && target === gateDir(home)) throw failing('EACCES');
  });
  assert.throws(() => readGateWaiters(home, { fileSystem: noAccess }), { code: 'EACCES' });
}));

test('a holder whose file cannot be read is still known by the pid in its name', withHome(async (home) => {
  const clock = fakeClock();
  const lock = await take(home, clock, { pid: 11 });
  const unread = tapped((name, [target]) => {
    if (name === 'readFileSync' && String(target).includes('holder-11-')) throw failing('EBUSY');
  });
  const holder = readGateHolder(home, { now: clock.now, staleMs: STALE_MS, fileSystem: unread });
  assert.deepEqual([holder.pid, holder.cwd, holder.startedAt, holder.stale], [11, null, null, false]);
  lock.release();
}));

test('a gate whose own folder was swept as it took the lock makes it again and takes the lock', withHome(async (home) => {
  // It slept the whole stale time between two looks, and another gate took it for dead.
  let swept = false;
  const io = tapped((name, [from]) => {
    if (name !== 'renameSync' || swept) return;
    swept = true;
    fs.rmSync(from, { recursive: true });
  });
  const clock = fakeClock();
  const lock = await take(home, clock, { pid: 22, fileSystem: io });
  assert.equal(lock.refused, undefined);
  assert.equal(swept, true);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 22);
  assert.deepEqual(waitFolders(home), []);
  lock.release();
}));

// Each racer dies holding the lock, so every take but the first is a takeover: two race for the first
// one, and the last takes the second alone. It proves that every death is recovered and by one gate at a
// time; it is not what catches the first version's gap, which it passed three runs of three with five
// processes looking every millisecond (a window that narrow is not hit that way). The test of the empty
// folder above is.
//
// It runs on the real clock, so its numbers are margins against a loaded machine. A racer is inside for
// 25 ms and never beats: one that stalls there for longer than the stale time is taken over alive, and
// the test is red with the lock doing what it should. Four seconds is that margin, which each of the two
// takeovers waits out; so three processes and not five, and a look every 50 ms, which loads nothing.
test('processes that each die holding the lock are taken over one at a time', withHome(async (home) => {
  const log = path.join(home, 'race.log');
  const results = await Promise.all(Array.from({ length: 3 }, () => racer(home, log, { rounds: 1, staleMs: 4000, pollMs: 50, dies: true })));
  for (const { status, stderr } of results) assert.equal(status, 0, stderr);
  assertNeverTogether(fs.readFileSync(log, 'utf8'), 3);
}));

test('a holder file that cannot be read still holds while it is fresh, and is taken over once stale', withHome(async (home) => {
  const clock = fakeClock();
  fs.mkdirSync(gateLockDir(home), { recursive: true });
  const file = path.join(gateLockDir(home), 'holder-garbage.json');
  fs.writeFileSync(file, '{ not json');
  const fresh = new Date(clock.now());
  fs.utimesSync(file, fresh, fresh);
  const refused = await take(home, clock, { pid: 22, wait: false });
  assert.equal(refused.refused, 'held');
  assert.equal(refused.holder.pid, null);
  const second = await take(home, clock, { pid: 22 });
  assert.equal(second.refused, undefined);
  assert.ok(second.waitedMs > STALE_MS);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 22);
  second.release();
}));

test('readGateHolder says a holder is stale once its beat is older than the stale time', withHome(async (home) => {
  const clock = fakeClock();
  const lock = await take(home, clock, { pid: 11 });
  clock.advance(STALE_MS);
  assert.equal(readGateHolder(home, { now: clock.now, staleMs: STALE_MS }).stale, false);
  clock.advance(1000);
  assert.equal(readGateHolder(home, { now: clock.now, staleMs: STALE_MS }).stale, true);
  lock.beat();
  const holder = readGateHolder(home, { now: clock.now, staleMs: STALE_MS });
  assert.equal(holder.stale, false);
  assert.equal(holder.beatAt, clock.now());
  lock.release();
}));

test('a lock beats by itself while it is held and stops when released', withHome(async (home) => {
  // The one test on the real clock: it proves the timer is wired, not how long a beat is.
  const lock = await takeGateLock({ home, cwd: 'C:\\work\\one', command: 'check', beatMs: 20 });
  const file = path.join(gateLockDir(home), fs.readdirSync(gateLockDir(home))[0]);
  const old = new Date(Date.now() - 30_000);
  fs.utimesSync(file, old, old);
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.ok(fs.statSync(file).mtimeMs > old.getTime() + 20_000, 'the holder file was beaten');
  lock.release();
  assert.equal(fs.existsSync(gateLockDir(home)), false);
}));

// --- the line: a gate takes the lock in the order it arrived ---
// Found on 2026-10-11: a commit waited an hour and gave up while gates that arrived twenty and thirty
// minutes after it ran. Every gate that waited tried the rename at each poll, so the lock went to whichever
// looked first after a release, and a gate that had just arrived tried it before it looked at who waited.
// Now a gate tries the rename only when no live gate that arrived before it waits. Only the rename grants
// the lock, as before: the line decides who may try it, and a fault in the line costs order, never the one
// holder, and never a take that fails.

test('a gate that arrives while an older one waits does not take the lock when it is free: the older one takes it, and the newer one after it', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  const older = parked(home, clock, { pid: 22 });
  clock.advance(1000);
  // The holder ends while the older gate is between two polls: the lock is free, and the gate that looks
  // first is the one that arrives now.
  first.release();
  const held = [];
  let sleeps = 0;
  clock.onSleep = async () => {
    sleeps += 1;
    held.push(readGateHolder(home, { now: clock.now })?.pid ?? null);
    await older.turn();
    older.lock?.beat();
    if (sleeps === 3) older.lock.release();
  };
  const told = [];
  const onWait = (holder, leftMs, line) => told.push([holder?.pid ?? null, line?.ahead, line?.head?.pid ?? null]);
  const newer = await take(home, clock, { pid: 33, onWait });
  assert.equal(newer.refused, undefined);
  // Free at its first look, and left to the gate ahead; then that gate's for two polls.
  assert.deepEqual(held, [null, 22, 22]);
  assert.equal(newer.waitedMs, 3 * POLL_MS);
  // Told what is true of each: first of a gate that waits, in no holder's place, then of the same gate as
  // the holder it has become.
  assert.deepEqual(told, [[null, 1, 22], [22, 1, null]]);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 33);
  newer.release();
  assert.equal(fs.existsSync(gateDir(home)), false);
}));

test('two gates that stand in the line since the same instant do not both take a free lock, nor both stand back: the one whose token sorts first takes it, and the other at its first look after the release', withHome(async (home) => {
  // In one process a take runs to its first sleep before another begins. So the second gate is started from
  // inside the first, between the staging of its folder and its look at the line: both stand in the line,
  // since the same millisecond, before either has looked.
  for (const [early, late] of [[22, 33], [33, 22]]) {
    const clock = fakeClock();
    let other;
    const io = tapped((name, [target]) => {
      if (name !== 'readdirSync' || target !== gateDir(home) || other) return;
      other = parked(home, clock, { pid: late });
    });
    const held = [];
    clock.onSleep = async () => {
      await settled();
      held.push(readGateHolder(home, { now: clock.now })?.pid ?? null);
      other.lock?.release();
    };
    const mine = await take(home, clock, { pid: early, fileSystem: io });
    await settled();
    assert.equal(mine.refused, undefined, `${early} then ${late}`);
    if (early === 22) {
      // It took the lock at once, and the other stood back although it was the first of the two to look.
      assert.deepEqual([mine.waitedMs, held, other.lock], [0, [], undefined]);
      mine.release();
      await other.turn();
      assert.ok(other.lock && !other.lock.refused, 'the other took it at its first look after the release');
      assert.equal(readGateHolder(home, { now: clock.now }).pid, 33);
      other.lock.release();
    } else {
      // The other took the lock inside this one's look at the line, and this one waited a poll for it.
      assert.deepEqual([mine.waitedMs, held], [POLL_MS, [22]]);
      assert.equal(readGateHolder(home, { now: clock.now }).pid, 33);
      mine.release();
    }
    assert.equal(fs.existsSync(gateDir(home)), false, `${early} then ${late}`);
  }
}));

test('a gate ahead in the line that died is passed once nothing has touched its folder for the stale time, and not before', withHome(async (home) => {
  const clock = fakeClock();
  // It arrived a second ago, touched its folder then and never again.
  inLine(home, tokenOf(22), saysLine(22, clock.now() - 1000), new Date(clock.now() - 1000));
  const held = [];
  clock.onSleep = () => held.push(readGateHolder(home, { now: clock.now }));
  const told = [];
  const second = await take(home, clock, { pid: 33, onWait: (holder, leftMs, line) => told.push([holder, line?.ahead, line?.head?.pid]) });
  assert.equal(second.refused, undefined);
  // At the first look that finds the folder older than the stale time, which is the longest a free lock
  // waits for a dead gate.
  assert.equal(second.waitedMs, STALE_MS);
  assert.deepEqual(held, Array(STALE_MS / POLL_MS).fill(null), 'nobody held the lock while it stood behind the dead gate');
  // Told once whom it stands behind: a gate that waits, in no holder's place.
  assert.deepEqual(told, [[null, 1, 22]]);
  // The dead gate's folder is swept by the take, as before.
  assert.deepEqual(waitFolders(home), []);
  second.release();
}));

test('a line that cannot be read never makes a take fail, and never lets a second gate in: a gate folder that cannot be listed', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  const older = parked(home, clock, { pid: 22 });
  clock.advance(1000);
  let asked = 0;
  const noList = tapped((name, [target]) => {
    if (name !== 'readdirSync' || target !== gateDir(home)) return;
    asked += 1;
    throw failing('EACCES');
  });
  const inTheLock = [];
  let sleeps = 0;
  clock.onSleep = () => {
    sleeps += 1;
    inTheLock.push(holderFiles(home).length);
    first.beat();
    if (sleeps === 3) first.release();
  };
  const blind = await take(home, clock, { pid: 33, fileSystem: noList });
  assert.equal(blind.refused, undefined);
  assert.ok(asked > 3, `it asked for the line at each look: ${asked} times`);
  // It waited for the holder, as a gate did before there was a line, and took the lock only once it was
  // released. The order is what is lost here, to the gate that stood in the line: never the one holder.
  assert.deepEqual(inTheLock, [1, 1, 1]);
  assert.equal(blind.waitedMs, 3 * POLL_MS);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 33);
  assert.equal(older.lock, undefined);
  blind.release();
}));

// Found in review, 2026-10-11: the touch a gate gives its own file as it shows itself in the line stands
// in the same `try` as the reading of the line, so a touch that fails is a look with nobody ahead as well,
// and only the folder that cannot be listed was tested.
test('a line that cannot be read never makes a take fail, and never lets a second gate in: a gate whose touch of its own file answers busy', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  const older = parked(home, clock, { pid: 22 });
  clock.advance(1000);
  // Busy at the instant of the touch that opens a look, once the file is there: the gate then writes the
  // file again, as a gate at the head does, and that write and the touch that follows it go through. Were
  // they busy too, the look would end before the rename, with the answer a gate had for it before the line.
  let written = false;
  const calls = { busy: 0, renames: 0 };
  const io = tapped((name, [target]) => {
    if (!String(target).includes('wait-33-')) return;
    if (name === 'renameSync') calls.renames += 1;
    if (name === 'writeFileSync') written = true;
    if (name !== 'utimesSync' || !fs.existsSync(target)) return;
    if (written) {
      written = false;
      return;
    }
    calls.busy += 1;
    throw failing('EPERM');
  });
  const inTheLock = [];
  let sleeps = 0;
  clock.onSleep = () => {
    sleeps += 1;
    inTheLock.push(holderFiles(home).length);
    first.beat();
    if (sleeps === 3) first.release();
  };
  const told = [];
  const blind = await take(home, clock, { pid: 33, fileSystem: io, onWait: (holder, leftMs, line) => told.push([holder?.pid, line?.ahead, line?.head?.pid ?? null]) });
  assert.equal(blind.refused, undefined);
  // Its first look made the file and read the line: the holder and the gate that waits ahead. Every look
  // after that one could not touch the file, read nobody ahead, and tried the rename.
  assert.deepEqual(told, [[11, 2, 22]]);
  assert.deepEqual(calls, { busy: 3, renames: 3 });
  // The rename is what refused it while the lock was held, as before the line, and what let it in once the
  // lock was released: ahead of the gate that stood in the line, which lost its place and nothing else.
  assert.deepEqual(inTheLock, [1, 1, 1]);
  assert.equal(blind.waitedMs, 3 * POLL_MS);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 33);
  await older.turn();
  assert.equal(older.lock, undefined, 'the gate it passed waits for it, and is not in the lock with it');
  blind.release();
  await older.turn();
  assert.ok(older.lock && !older.lock.refused, 'the gate it passed takes the lock once it is released');
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 22);
  older.lock.release();
  assert.equal(fs.existsSync(gateDir(home)), false);
}));

test('a gate in the line whose file cannot be read counts as ahead, since nobody knows when it arrived, for the stale time and no longer: the take never fails for it', withHome(async (home) => {
  const clock = fakeClock();
  // Alive, by its folder, which is touched at every poll. Its file never reads.
  const other = inLine(home, tokenOf(22), saysLine(22, clock.now() - 1000), new Date(clock.now()));
  const unread = tapped((name, [target]) => {
    if (name === 'readFileSync' && String(target).includes('holder-22-')) throw failing('EBUSY');
  });
  clock.onSleep = () => other.touch(new Date(clock.now()));
  const told = [];
  const second = await take(home, clock, { pid: 33, fileSystem: unread, onWait: (holder, leftMs, line) => told.push([holder, line?.ahead, line?.head]) });
  assert.equal(second.refused, undefined);
  // Behind it while it may be a gate whose file is being written. A file that has said nothing for as long
  // as a dead gate is given is no gate that keeps the line, and beside one a gate takes a free lock.
  assert.equal(second.waitedMs, STALE_MS);
  // Named by what its folder's name says, and by nothing a file said.
  assert.deepEqual(told, [[null, 1, { token: tokenOf(22), pid: 22, cwd: null, command: null, waitingSince: null, session: null }]]);
  second.release();
}));

test('a gate whose own folder goes away while it waits makes it again at its next look, and its take does not fail', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  const stood = [];
  let sleeps = 0;
  clock.onSleep = () => {
    sleeps += 1;
    first.beat();
    // Swept as a dead gate's by another gate, at every poll.
    const [mine] = waitFolders(home);
    stood.push(mine !== undefined);
    if (mine) fs.rmSync(path.join(gateDir(home), mine), { recursive: true });
    if (sleeps === 3) first.release();
  };
  const second = await take(home, clock, { pid: 22 });
  assert.equal(second.refused, undefined);
  assert.deepEqual(stood, [true, true, true]);
  assert.equal(second.waitedMs, 3 * POLL_MS);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 22);
  second.release();
}));

test('beside a gate of an older version, which keeps no line, a gate behaves as it did before the line: it takes a free lock at once', withHome(async (home) => {
  const clock = fakeClock();
  const since = clock.now() - 60_000;
  // What a gate wrote before the line: no mark. It tries the rename at every poll, and would pass a gate
  // that stood back for it each time.
  const old = inLine(home, tokenOf(22), saysNoLine(22, since), new Date(clock.now()));
  const beside = await take(home, clock, { pid: 33, wait: false });
  assert.deepEqual([beside.refused, beside.waitedMs], [undefined, 0]);
  beside.release();
  // Beside one of each as well: the gate that keeps the line is ahead, and the older one stands back for
  // neither.
  inLine(home, tokenOf(21), saysLine(21, since), new Date(clock.now()));
  const mixed = await take(home, clock, { pid: 33, wait: false });
  assert.deepEqual([mixed.refused, mixed.waitedMs], [undefined, 0]);
  mixed.release();
  // Without the older one, the gate that keeps the line is a gate ahead.
  fs.rmSync(old.folder, { recursive: true });
  const behind = await take(home, clock, { pid: 33, wait: false });
  assert.deepEqual([behind.refused, behind.line?.head?.pid], ['ahead', 21]);
}));

test('with wait off, a gate ahead in the line is a refusal that says it waits, in no holder\'s place; a dead one refuses for the stale time and is then passed', withHome(async (home) => {
  const clock = fakeClock();
  const since = clock.now() - 5000;
  inLine(home, tokenOf(22), saysLine(22, since), new Date(clock.now()));
  const refused = await take(home, clock, { pid: 33, wait: false, onWait: () => assert.fail('a gate that does not wait is not told it waits') });
  assert.deepEqual([refused.refused, refused.holder, refused.waitedMs, refused.release], ['ahead', null, 0, undefined]);
  assert.deepEqual(refused.line, { ahead: 1, head: waiterOf(22, since) });
  // Taking the lock would have passed it: nobody holds the lock, and the refused gate left nothing of its own.
  assert.equal(readGateHolder(home, { now: clock.now }), null);
  assert.deepEqual(waitFolders(home), [`wait-${tokenOf(22)}`]);

  // It died there: still a gate ahead until nothing has touched its folder for the stale time. Looked at a
  // second before that time and a second after it, as the gate that died in the line is above. A first
  // version looked at the stale time itself, to the millisecond, and rested on the time of a file coming
  // back from the file system as whole as it was given, which not every file system does (found in
  // review, 2026-10-11).
  clock.advance(STALE_MS - 1000);
  assert.equal((await take(home, clock, { pid: 33, wait: false })).refused, 'ahead');
  clock.advance(2000);
  const passed = await take(home, clock, { pid: 33, wait: false });
  assert.deepEqual([passed.refused, passed.waitedMs], [undefined, 0]);
  passed.release();
}));

test('with wait off and the lock held, the refusal names the holder, and counts the gates that wait ahead with it', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  inLine(home, tokenOf(22), saysLine(22, clock.now() - 5000), new Date(clock.now()));
  const refused = await take(home, clock, { pid: 33, wait: false });
  assert.deepEqual([refused.refused, refused.holder.pid, refused.line?.ahead, refused.line?.head?.pid], ['held', 11, 2, 22]);
  first.release();
}));

// Found in review, 2026-10-11: a gate that was ahead in the line renamed its folder to `lock` between the look
// at the line and the look at the lock. Its token was then both ahead and the holder's, so it was counted
// twice and named as the head of a line it no longer waited in.
test('a gate ahead that becomes the holder between the look at the line and the look at the lock is counted once, and is no head of the line', withHome(async (home) => {
  const clock = fakeClock();
  const since = clock.now();
  const ahead = inLine(home, tokenOf(11), saysLine(11, since), new Date(since));
  clock.advance(1000);
  // The rename is made just before the lock folder is listed: after the line was read, before the lock is.
  let renamed = false;
  const io = tapped((name, args) => {
    if (name === 'readdirSync' && args[0] === gateLockDir(home) && !renamed) {
      renamed = true;
      fs.renameSync(ahead.folder, gateLockDir(home));
    }
  });
  const told = [];
  // The gate of pid 11 is then the holder, and it releases at the first poll, so the gate of pid 22 takes the lock.
  clock.onSleep = () => fs.rmSync(gateLockDir(home), { recursive: true, force: true });
  const second = await take(home, clock, { pid: 22, fileSystem: io, onWait: (holder, leftMs, line) => told.push({ token: holder.token, line }) });
  assert.equal(second.refused, undefined);
  assert.equal(told.length, 1);
  assert.equal(told[0].token, tokenOf(11));
  assert.deepEqual(told[0].line, { ahead: 1, head: null });
  second.release();
}));

// --- the bound of a wait: how long the lock may stay in the same hands ---
// Found on 2026-10-11: with gates of about fourteen minutes, a gate with four ahead reached its hour while
// the line moved, was refused and came back at the end of the line. Two commits lost an hour each that way.
// The bound is there to give up on a lock that does not move, and a line that moves is not that.

test('the bound of a wait counts from the last time the lock changed hands: a line that moves never refuses the gate at the back, however long its whole wait', withHome(async (home) => {
  const clock = fakeClock();
  const waitMs = 5 * POLL_MS;
  let holder = await take(home, clock, { pid: 11 });
  // Three gates in the line before this one, since the same instant: their tokens give the order.
  const line = [21, 22, 23].map((pid) => parked(home, clock, { pid }));
  let sleeps = 0;
  clock.onSleep = async () => {
    sleeps += 1;
    holder.beat();
    // Each gate holds the lock for three polls, under the bound of five, and the next takes it at once.
    if (sleeps % 3 !== 0) return;
    holder.release();
    const next = line.shift();
    if (!next) return;
    await next.turn();
    holder = next.lock;
  };
  const told = [];
  const back = await take(home, clock, { pid: 33, waitMs, onWait: (gate, leftMs, ahead) => told.push([gate?.pid, leftMs, ahead?.ahead]) });
  assert.equal(back.refused, undefined);
  // Four gates of three polls each: more than twice the bound, in all.
  assert.equal(back.waitedMs, 12 * POLL_MS);
  // With each holder the whole bound again, and one gate fewer ahead.
  assert.deepEqual(told, [[11, waitMs, 4], [21, waitMs, 3], [22, waitMs, 2], [23, waitMs, 1]]);
  back.release();
}));

// Found in review, 2026-10-11: beside a live gate of an older version no line is kept, and every gate tries
// the rename at every poll, as before the line. The bound still started again at each change of hands
// there, so a gate that lost every race never gave up, where it gave up `waitMs` after its arrival before
// the line. A change of hands that is read at a look with such a gate beside this one no longer moves the
// anchor of the bound.

/** The gate at the back of the test above, with a gate of an older version beside it: alive, in no line,
 * and never the one that gets the lock. The lock goes from the gate of pid 11 to those of 21, 22 and 23,
 * each for three polls, under the bound of five, and each takes it in the instant it is released, so the
 * gate at the back loses every race it is in. The older gate leaves at the poll `oldLeavesAt`, or never.
 * Resolves to what the take of the gate at the back came to (`back`), what it was told as `[pid of the
 * holder, what is left, gates ahead]` (`told`), its bound (`waitMs`), and `release`, which releases the
 * lock of whichever of the others holds it at the end. */
async function atTheBackBesideAnOlderGate(home, oldLeavesAt = Infinity) {
  const clock = fakeClock();
  const waitMs = 5 * POLL_MS;
  let holder = await take(home, clock, { pid: 11 });
  const old = inLine(home, tokenOf(20), saysNoLine(20, clock.now() - 1000), new Date(clock.now()));
  const line = [21, 22, 23].map((pid) => parked(home, clock, { pid }));
  let sleeps = 0;
  clock.onSleep = async () => {
    sleeps += 1;
    holder.beat();
    if (sleeps < oldLeavesAt) old.touch(new Date(clock.now()));
    else fs.rmSync(old.folder, { recursive: true, force: true });
    if (sleeps % 3 !== 0) return;
    holder.release();
    const next = line.shift();
    if (!next) return;
    await next.turn();
    holder = next.lock;
  };
  const told = [];
  const back = await take(home, clock, { pid: 33, waitMs, onWait: (gate, leftMs, ahead) => told.push([gate?.pid, leftMs, ahead?.ahead]) });
  return { back, told, waitMs, release: () => holder.release() };
}

test('beside a live gate of an older version, where no line is kept and every gate races for the lock, the bound of a wait counts as it did before the line: holders that each change within the bound still refuse a gate that loses every race, once the bound has passed since its arrival', withHome(async (home) => {
  const { back, told, waitMs, release } = await atTheBackBesideAnOlderGate(home);
  // The gate of pid 21 took the lock three polls in, and that started no count again: the wait ended a
  // bound after the arrival, behind a holder that had held the lock for two polls.
  assert.deepEqual([back.refused, back.holder?.pid, back.stillMs, back.waitedMs], ['timeout', 21, waitMs, waitMs]);
  // Told, with the second holder, what was left by then and not the whole bound again; and of no line.
  assert.deepEqual(told, [[11, waitMs, 1], [21, waitMs - 3 * POLL_MS, 1]]);
  assert.deepEqual(back.line, { ahead: 1, head: null });
  // The refusal says so: beside the older gate the count did not restart with each holder, so it is not a
  // wait that ended without the lock changing hands.
  assert.equal(back.besideOlder, true);
  release();
}));

test('beside a live gate of an older version, and then not: the change of hands that starts the count again clears the flag, so a refusal for a holder that then stays is an ordinary one', withHome(async (home) => {
  // The older gate stands beside the take for the first looks and leaves at the poll `leaves`. At that same
  // poll the lock goes to the gate of pid 21, and the first look that keeps the line reads it: that change
  // starts the count again and clears the flag. The holder never changes after that, so the wait ends a
  // bound after the change of hands, which is not the arrival, and the refusal is worded as an ordinary one.
  const clock = fakeClock();
  const waitMs = 5 * POLL_MS;
  const leaves = 3;
  let holder = await take(home, clock, { pid: 11 });
  const old = inLine(home, tokenOf(20), saysNoLine(20, clock.now() - 1000), new Date(clock.now()));
  const next = parked(home, clock, { pid: 21 });
  let sleeps = 0;
  clock.onSleep = async () => {
    sleeps += 1;
    holder.beat();
    if (sleeps < leaves) {
      old.touch(new Date(clock.now()));
    } else if (sleeps === leaves) {
      fs.rmSync(old.folder, { recursive: true, force: true });
      holder.release();
      await next.turn();
      holder = next.lock;
    }
  };
  const back = await take(home, clock, { pid: 33, waitMs });
  // The change is read at the look after the third poll, and the bound counts from that look: the refusal
  // comes `waitMs` after it, so the whole wait is the `leaves` polls before it plus the bound.
  assert.deepEqual([back.refused, back.holder?.pid, back.besideOlder, back.stillMs, back.waitedMs], ['timeout', 21, false, waitMs, leaves * POLL_MS + waitMs]);
  holder.release();
}));

test('the bound is anchored to the last change of hands read while the line was kept: one read beside a gate of an older version stays out of it once that gate has left, and one read after it left starts the count again', withHome(async (home) => {
  // The older gate leaves a poll after the lock went to the gate of pid 21. The change it stood beside is
  // not counted late, at the first look that keeps the line again: the wait still ends a bound after the
  // arrival, and by then behind the two gates that were in the line before this one.
  const after = await atTheBackBesideAnOlderGate(home, 4);
  assert.deepEqual([after.back.refused, after.back.holder?.pid, after.back.stillMs, after.back.waitedMs], ['timeout', 21, after.waitMs, after.waitMs]);
  assert.deepEqual([after.back.line?.ahead, after.back.line?.head?.pid], [3, 22]);
  // The flag is still on here, and that is right. The change of hands the older gate stood beside (the look
  // at poll 3) moved no anchor, and the count ran from the arrival, which a look beside that gate was part of.
  // The older gate left after that, and no look since then moved the anchor, so nothing cleared the flag.
  assert.equal(after.back.besideOlder, true);
  after.release();
  fs.rmSync(gateDir(home), { recursive: true, force: true });

  // It leaves a poll before the lock changes hands for the first time. Every change is then read by a gate
  // that keeps the line, and each starts the count again, as in the test above: four gates of three polls
  // refuse nobody. Only the first line it was told was said beside the older gate, of no line.
  const before = await atTheBackBesideAnOlderGate(home, 2);
  assert.equal(before.back.refused, undefined);
  assert.equal(before.back.waitedMs, 12 * POLL_MS);
  assert.deepEqual(before.told, [[11, before.waitMs, 1], [21, before.waitMs, 3], [22, before.waitMs, 2], [23, before.waitMs, 1]]);
  before.back.release();
}));

test('a holder that does not end is given up on once it has held the lock for the bound, and the refusal says both how long the lock did not move and how long the whole wait was', withHome(async (home) => {
  const clock = fakeClock();
  const waitMs = 5 * POLL_MS;
  const first = await take(home, clock, { pid: 11 });
  const stuck = parked(home, clock, { pid: 21 });
  let sleeps = 0;
  clock.onSleep = async () => {
    sleeps += 1;
    first.beat();
    stuck.lock?.beat();
    if (sleeps !== 3) return;
    first.release();
    await stuck.turn();
  };
  const back = await take(home, clock, { pid: 33, waitMs });
  assert.deepEqual([back.refused, back.holder.pid, back.stillMs, back.waitedMs], ['timeout', 21, waitMs, 3 * POLL_MS + waitMs]);
  assert.deepEqual(back.line, { ahead: 1, head: null });
  assert.equal(stuck.lock.lost(), false);
  assert.deepEqual(waitFolders(home), []);
  stuck.lock.release();

  // And a holder that was there from the arrival, as before: the two times are the same.
  const alone = await take(home, clock, { pid: 11 });
  clock.onSleep = () => alone.beat();
  const late = await take(home, clock, { pid: 33, waitMs });
  assert.deepEqual([late.refused, late.holder.pid, late.stillMs, late.waitedMs], ['timeout', 11, waitMs, waitMs]);
  alone.release();
}));

test('a free lock with a gate ahead that never takes it still ends the wait at its bound, as a refusal that names the gate that waits, and never as an error', withHome(async (home) => {
  const clock = fakeClock();
  const waitMs = 5 * POLL_MS;
  const ahead = inLine(home, tokenOf(22), saysLine(22, clock.now() - 1000), new Date(clock.now()));
  // Alive, by its folder, and it never takes the lock.
  clock.onSleep = () => ahead.touch(new Date(clock.now()));
  const told = [];
  const back = await take(home, clock, { pid: 33, waitMs, onWait: (holder, leftMs, line) => told.push([holder, leftMs, line?.head?.pid]) });
  assert.deepEqual([back.refused, back.holder, back.stillMs, back.waitedMs], ['timeout', null, waitMs, waitMs]);
  assert.deepEqual([back.line.ahead, back.line.head.pid], [1, 22]);
  assert.deepEqual(told, [[null, waitMs, 22]]);
  assert.equal(readGateHolder(home, { now: clock.now }), null);
  assert.deepEqual(waitFolders(home), [`wait-${tokenOf(22)}`]);
  // A wait of zero is over at its first look, in the same way.
  const zero = await take(home, clock, { pid: 33, waitMs: 0 });
  assert.deepEqual([zero.refused, zero.holder, zero.waitedMs], ['timeout', null, 0]);
}));

// --- what a gate keeps in the line, and what it tells ---

test('a gate that is not at the head of the line touches its file at every poll and does not write it again, and reads the file of a gate ahead once', withHome(async (home) => {
  // A file that is written again at every poll reads empty to whoever looks in that instant, and the line
  // is read from those files. The head still writes its own before each try, since it must say "started
  // now" at the instant its folder becomes the lock.
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  const ahead = inLine(home, tokenOf(22), saysLine(22, clock.now() - 1000), new Date(clock.now()));
  const calls = { written: 0, read: 0 };
  const io = tapped((name, [target]) => {
    if (name === 'writeFileSync' && String(target).includes('holder-33-')) calls.written += 1;
    if (name === 'readFileSync' && String(target).includes('holder-22-')) calls.read += 1;
  });
  const seen = [];
  clock.onSleep = () => {
    first.beat();
    ahead.touch(new Date(clock.now()));
    seen.push(readGateWaiters(home, { now: clock.now, staleMs: STALE_MS }).map(({ pid }) => pid));
  };
  const polls = 40;
  const back = await take(home, clock, { pid: 33, waitMs: polls * POLL_MS, fileSystem: io });
  assert.equal(back.refused, 'timeout');
  assert.deepEqual(calls, { written: 1, read: 1 });
  // Read as a gate that waits at every poll all the same, well past the stale time: touched, it is alive.
  assert.deepEqual(seen, Array(polls).fill([22, 33]));
  first.release();
}));

test('a waiting gate is told again when the gate it waits for changes, and not because a gate ahead of it left the line', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  const ahead = inLine(home, tokenOf(22), saysLine(22, clock.now() - 1000), new Date(clock.now()));
  let sleeps = 0;
  clock.onSleep = () => {
    sleeps += 1;
    first.beat();
    // The gate ahead gives up and leaves at the second poll.
    if (sleeps === 2) fs.rmSync(ahead.folder, { recursive: true });
  };
  const told = [];
  const back = await take(home, clock, { pid: 33, waitMs: 4 * POLL_MS, onWait: (holder, leftMs, line) => told.push([holder?.pid, line?.ahead]) });
  assert.deepEqual(told, [[11, 2]]);
  assert.deepEqual([back.refused, back.holder.pid, back.line], ['timeout', 11, { ahead: 1, head: null }]);
  first.release();
}));

test('a gate writes in its file the session it was started by, with the mark of the line, and both readers return it: null where it was given none', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11, session: 'session-one' });
  const [name] = holderFiles(home);
  const at = new Date(clock.now()).toISOString();
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(gateLockDir(home), name), 'utf8')), {
    token: name.slice('holder-'.length, -'.json'.length),
    pid: 11,
    cwd: 'C:\\work\\one',
    command: 'check',
    startedAt: at,
    waitingSince: at,
    line: 1,
    session: 'session-one',
  });
  assert.equal(readGateHolder(home, { now: clock.now }).session, 'session-one');
  const named = parked(home, clock, { pid: 22, session: 'session-two' });
  const unnamed = parked(home, clock, { pid: 23 });
  const waiters = readGateWaiters(home, { now: clock.now, staleMs: STALE_MS });
  assert.deepEqual(waiters.map(({ pid, session }) => `${pid} ${session}`).sort(), ['22 session-two', '23 null']);
  // And each says it as the holder it becomes, in its turn.
  first.release();
  await named.turn();
  assert.equal(readGateHolder(home, { now: clock.now }).session, 'session-two');
  named.lock.release();
  await unnamed.turn();
  const last = readGateHolder(home, { now: clock.now });
  assert.deepEqual([last.pid, last.session], [23, null]);
  unnamed.lock.release();
}));

test('a gate that claimed a ticket says so in its file from its first write, with the ticket\'s reason, and both readers return it; a gate without one says nothing of it', withHome(async (home) => {
  const clock = fakeClock();
  const holder = await take(home, clock, { pid: 11 });
  const ticketed = parked(home, clock, { pid: 22, first: { id: '0a0a0a0a', reason: 'unblocks the others' } });
  const [folder] = waitFolders(home);
  const file = path.join(gateDir(home), folder, `holder-${folder.slice('wait-'.length)}.json`);
  assert.deepEqual([JSON.parse(fs.readFileSync(file, 'utf8')).first, JSON.parse(fs.readFileSync(file, 'utf8')).firstReason], ['0a0a0a0a', 'unblocks the others']);
  const [waiter] = readGateWaiters(home, { now: clock.now, staleMs: STALE_MS });
  assert.deepEqual([waiter.pid, waiter.first, waiter.firstReason], [22, '0a0a0a0a', 'unblocks the others']);
  assert.equal('first' in readGateHolder(home, { now: clock.now }), false);
  holder.release();
  await ticketed.turn();
  const now = readGateHolder(home, { now: clock.now });
  assert.deepEqual([now.pid, now.first, now.firstReason], [22, '0a0a0a0a', 'unblocks the others']);
  ticketed.lock.release();
}));

test('a gate with a ticket goes before every gate that waits, whenever it arrived; the holder is never cut, and the gates it passed keep their order', withHome(async (home) => {
  const clock = fakeClock();
  const holder = await take(home, clock, { pid: 11 });
  const older = parked(home, clock, { pid: 22 });
  clock.advance(1000);
  const old2 = parked(home, clock, { pid: 23 });
  clock.advance(1000);
  const held = [];
  let sleeps = 0;
  clock.onSleep = async () => {
    sleeps += 1;
    held.push(readGateHolder(home, { now: clock.now })?.pid ?? null);
    await older.turn();
    await old2.turn();
    if (sleeps === 2) holder.release();
  };
  const told = [];
  const onWait = (waitedFor, leftMs, line) => told.push([waitedFor?.pid ?? null, line?.ahead]);
  const ticketed = await take(home, clock, { pid: 33, onWait, first: { id: '0a0a0a0a', reason: 'unblocks the others' } });
  assert.equal(ticketed.refused, undefined);
  // It waited for the holder to finish, with only the holder ahead of it, and took the lock at its first
  // look after the release; neither gate that arrived before it took it meanwhile.
  assert.deepEqual(told, [[11, 1]]);
  assert.deepEqual(held, [11, 11]);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 33);
  assert.deepEqual([older.lock, old2.lock], [undefined, undefined]);
  clock.onSleep = undefined;
  ticketed.release();
  await old2.turn();
  await older.turn();
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 22, 'the older of the two it passed is next');
  older.lock.release();
  await old2.turn();
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 23);
  old2.lock.release();
}));

test('two gates with a ticket go by their arrival between themselves, both before a gate without one', withHome(async (home) => {
  const clock = fakeClock();
  const holder = await take(home, clock, { pid: 11 });
  const plain = parked(home, clock, { pid: 22 });
  clock.advance(1000);
  const firstOne = parked(home, clock, { pid: 33, first: { id: '0a0a0a0a', reason: 'one' } });
  clock.advance(1000);
  const secondOne = parked(home, clock, { pid: 44, first: { id: '0b0b0b0b', reason: 'two' } });
  holder.release();
  for (const gate of [plain, secondOne, firstOne]) await gate.turn();
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 33);
  assert.deepEqual([plain.lock, secondOne.lock], [undefined, undefined]);
  firstOne.lock.release();
  for (const gate of [plain, secondOne]) await gate.turn();
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 44);
  assert.equal(plain.lock, undefined);
  secondOne.lock.release();
  await plain.turn();
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 22);
  plain.lock.release();
}));

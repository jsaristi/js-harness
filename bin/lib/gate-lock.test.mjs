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

test('a waiting gate is told again when the gate it waits for changes', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  let third;
  let sleeps = 0;
  clock.onSleep = async () => {
    sleeps += 1;
    if (sleeps === 1) {
      first.release();
      third = await take(home, clock, { pid: 33, sleep: async () => {} });
    }
    if (sleeps === 3) third.release();
  };
  const told = [];
  const second = await take(home, clock, { pid: 22, onWait: (holder) => told.push(holder.pid) });
  assert.deepEqual(told, [11, 33]);
  second.release();
}));

test('a waiting gate is told, with each gate it waits for, what is left of its wait by then', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  let third;
  let sleeps = 0;
  clock.onSleep = async () => {
    sleeps += 1;
    first.beat();
    if (sleeps === 3) {
      first.release();
      third = await take(home, clock, { pid: 33, sleep: async () => {} });
    }
    if (sleeps === 5) third.release();
  };
  const told = [];
  const second = await take(home, clock, { pid: 22, waitMs: 60_000, onWait: (holder, leftMs) => told.push([holder.pid, leftMs]) });
  assert.deepEqual(told, [[11, 60_000], [33, 60_000 - 3 * POLL_MS]]);
  second.release();
}));

test('the wait is bounded: past it the gate is refused and the holder keeps the lock', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  clock.onSleep = () => first.beat();
  const second = await take(home, clock, { pid: 22, waitMs: 60_000 });
  assert.equal(second.refused, 'timeout');
  assert.equal(second.holder.pid, 11);
  assert.equal(second.waitedMs, 60_000);
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
  let winner;
  const io = tapped((name, [target]) => {
    // The late gate has read the dead holder stale twice and is about to remove its file. In that
    // instant another gate removes it and takes the lock.
    if (name !== 'rmSync' || winner || !String(target).includes('holder-11-')) return;
    fs.rmSync(target);
    fs.rmdirSync(gateLockDir(home));
    winner = take(home, clock, { pid: 22 });
  });
  const late = await take(home, clock, { pid: 33, fileSystem: io, waitMs: 5 * POLL_MS });
  const first = await winner;
  assert.equal(first.refused, undefined);
  assert.equal(late.refused, 'timeout');
  assert.equal(late.holder.pid, 22);
  assert.equal(first.lost(), false);
  assert.equal(holderFiles(home).length, 1);
  first.release();
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

/** The holder that is read when the lock folder is there and nothing in it can be. */
const NOBODY_KNOWN = { token: null, pid: null, cwd: null, command: null, startedAt: null, beatAt: null, stale: false };

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
  for (const [name, at] of [['wait-dead', old], ['wait-alive', new Date(clock.now())]]) {
    const folder = path.join(gateDir(home), name);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'holder-x.json'), '{}');
    fs.utimesSync(path.join(folder, 'holder-x.json'), at, at);
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
    // Since its wait began, at every poll: not since the poll that staged its folder last.
    assert.deepEqual(said, { pid: 22, cwd: 'C:\\work\\two', command: 'check', waitingSince: began });
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

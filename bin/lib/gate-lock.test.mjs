import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { gateLockDir, readGateHolder, takeGateLock } from './gate-lock.mjs';

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

test('gateLockDir points at <home>/.js-harness/gate.lock', () => {
  assert.equal(gateLockDir('/h'), path.join('/h', '.js-harness', 'gate.lock'));
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

test('the wait is bounded: past it the gate is refused and the holder keeps the lock', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  clock.onSleep = () => first.beat();
  const second = await take(home, clock, { pid: 22, waitMs: 10 * 60_000 });
  assert.equal(second.refused, 'timeout');
  assert.equal(second.holder.pid, 11);
  assert.equal(second.waitedMs, 10 * 60_000);
  assert.equal(first.lost(), false);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 11);
  first.release();
}));

test('a holder that keeps beating is never taken over, however long it runs', withHome(async (home) => {
  const clock = fakeClock();
  const first = await take(home, clock, { pid: 11 });
  clock.onSleep = () => first.beat();
  const second = await take(home, clock, { pid: 22, waitMs: 20 * STALE_MS });
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

test('a lock folder that can be neither made nor read is an error after a few tries, not an endless wait', withHome(async (home) => {
  // A file where the folder goes: it cannot be made, and there is no holder in it to wait for.
  fs.mkdirSync(path.dirname(gateLockDir(home)), { recursive: true });
  fs.writeFileSync(gateLockDir(home), 'in the way');
  const clock = fakeClock();
  const startedAt = clock.now();
  await assert.rejects(take(home, clock), { code: 'EEXIST' });
  assert.ok(clock.now() - startedAt < POLL_MS, `gave up after ${clock.now() - startedAt} ms`);
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

// The tests above run in one process, where every step of a takeover ends before another gate's begins.
// This one is the proof between real processes: five of them start on a dead holder's lock and then
// pass it around, each writing when it goes in and when it comes out.
const RACER = `
import fs from 'node:fs';
import { takeGateLock } from ${JSON.stringify(pathToFileURL(path.join(import.meta.dirname, 'gate-lock.mjs')).href)};
const [home, log] = process.argv.slice(1);
for (let round = 0; round < 3; round++) {
  const lock = await takeGateLock({ home, cwd: String(process.pid), command: 'race', staleMs: 5000, pollMs: 15, beatMs: 50 });
  if (lock.refused) throw new Error('refused: ' + lock.refused);
  fs.appendFileSync(log, 'in ' + process.pid + '\\n');
  await new Promise((resolve) => setTimeout(resolve, 25));
  fs.appendFileSync(log, 'out ' + process.pid + '\\n');
  lock.release();
}
`;

test('processes that race for the lock of a dead holder, and then for each other\'s, are never inside together', withHome(async (home) => {
  fs.mkdirSync(gateLockDir(home), { recursive: true });
  const dead = path.join(gateLockDir(home), 'holder-dead.json');
  fs.writeFileSync(dead, JSON.stringify({ token: 'dead', pid: 1, cwd: 'gone', command: 'check', startedAt: new Date(0).toISOString() }));
  const old = new Date(Date.now() - 60 * 60_000);
  fs.utimesSync(dead, old, old);
  const log = path.join(home, 'race.log');
  const racers = Array.from({ length: 5 }, () => new Promise((resolve) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', RACER, home, log], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('exit', (status) => resolve({ status, stderr }));
  }));
  for (const { status, stderr } of await Promise.all(racers)) assert.equal(status, 0, stderr);
  const lines = fs.readFileSync(log, 'utf8').trim().split('\n');
  assert.equal(lines.length, 5 * 3 * 2);
  for (let i = 0; i < lines.length; i += 2) {
    const [, pid] = lines[i].split(' ');
    assert.equal(lines[i], `in ${pid}`, `line ${i + 1} of ${lines.join(' | ')}`);
    assert.equal(lines[i + 1], `out ${pid}`, `line ${i + 2} of ${lines.join(' | ')}`);
  }
  assert.equal(fs.existsSync(gateLockDir(home)), false);
}));

test('an empty lock folder just made by another gate is waited for, not removed', withHome(async (home) => {
  const clock = fakeClock();
  fs.mkdirSync(gateLockDir(home), { recursive: true });
  const second = await take(home, clock, { pid: 22, wait: false });
  assert.equal(second.refused, 'held');
  assert.equal(second.holder.pid, null);
  assert.equal(fs.existsSync(gateLockDir(home)), true);
}));

test('an empty lock folder left by a gate that died while taking it is cleared', withHome(async (home) => {
  const clock = fakeClock();
  fs.mkdirSync(gateLockDir(home), { recursive: true });
  const old = new Date(clock.now() - 10 * STALE_MS);
  fs.utimesSync(gateLockDir(home), old, old);
  const second = await take(home, clock, { pid: 22 });
  assert.equal(second.refused, undefined);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 22);
  second.release();
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

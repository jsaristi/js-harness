import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { gateDir, gateLockDir, readGateHolder, takeGateLock } from './gate-lock.mjs';

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
const waitFolders = (home) => fs.readdirSync(gateDir(home)).filter((name) => name.startsWith('wait-'));

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
  assert.deepEqual(fs.readdirSync(gateDir(home)), []);
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
  let taking = true;
  let calls = 0;
  const io = tapped(() => {
    calls += 1;
    if (taking && fs.existsSync(gateLockDir(home))) assert.notDeepEqual(fs.readdirSync(gateLockDir(home)), [], 'the lock folder was empty in the middle of a take');
  });
  const lock = await take(home, fakeClock(), { fileSystem: io });
  taking = false;
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

test('a holder file that is going away as it is read is not there, and reading the holder does not throw', withHome(async (home) => {
  const clock = fakeClock();
  const lock = await take(home, clock, { pid: 11 });
  const io = tapped((name) => {
    if (name === 'statSync') throw failing('EPERM');
  });
  assert.equal(readGateHolder(home, { now: clock.now, fileSystem: io }), null);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 11);
  lock.release();
}));

test('a dead holder whose file cannot be removed yet is looked at again, not an error', withHome(async (home) => {
  const clock = fakeClock();
  await take(home, clock, { pid: 11 });
  clock.advance(STALE_MS + 1000);
  let busy = 0;
  const io = tapped((name, [target]) => {
    if (name === 'rmSync' && String(target).includes('holder-11-') && busy < 3) {
      busy += 1;
      throw failing('EBUSY');
    }
  });
  const second = await take(home, clock, { pid: 22, fileSystem: io });
  assert.equal(second.refused, undefined);
  assert.equal(busy, 3);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 22);
  second.release();
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

// Each racer dies holding the lock, so every take but the first is a takeover that the others race for,
// looking as fast as they can. It proves that every death is recovered and by one gate at a time; it is
// not what catches the first version's gap, which it passed three runs of three (five processes do not
// hit a window that narrow). The test of the empty folder above is.
test('processes that each die holding the lock are taken over one at a time', withHome(async (home) => {
  const log = path.join(home, 'race.log');
  const results = await Promise.all(Array.from({ length: 5 }, () => racer(home, log, { rounds: 1, staleMs: 1500, pollMs: 1, dies: true })));
  for (const { status, stderr } of results) assert.equal(status, 0, stderr);
  assertNeverTogether(fs.readFileSync(log, 'utf8'), 5);
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

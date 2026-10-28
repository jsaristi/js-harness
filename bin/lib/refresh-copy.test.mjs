// `merge-queue --land --refresh-copy` (T4, S5b): the installed copy follows main after a land, through the upgrade
// path's installer. Every effect goes through an injected spawn, clock, sleep and gate lock, and every file lives in
// a folder of this test's own, so nothing here installs anything or touches the real home or pnpm folders.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { heldInChild, heldInProcess, pruneStalePnpm, refreshCopy } from './refresh-copy.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const PREV = 'fedcba9876543210fedcba9876543210fedcba98';
const MAIN_VERSION = '1.0.0';
const NOW = Date.UTC(2026, 9, 18, 2, 35);
const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
/** Every folder a test makes under the system temp folder, removed when the file ends. */
const made = [];
after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});
const tempDir = (prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(dir);
  return dir;
};

/** A machine for one refresh: a pnpm home with the shim `js-harness` names its copy by (`prev`, when given), a Claude
 * settings file and a js-harness home. `add -g <spec>` writes the copy of the spec's sha and answers `MAIN_VERSION`
 * when `deliver` is true, else leaves the shim as it was; `answers` replaces what `js-harness --version` says. */
function machine({ prev = null, deliver = true, answers = null, pathAnswers = null, addStatus = 0 } = {}) {
  const top = tempDir('js-harness-refresh-');
  const pnpmHome = path.join(top, 'pnpm');
  const binDir = path.join(pnpmHome, 'bin');
  const home = path.join(top, 'home');
  const settings = path.join(top, 'claude', 'settings.json');
  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(path.dirname(settings), { recursive: true });
  fs.writeFileSync(settings, '{"hooks":{}}\n');
  const calls = [];
  const sleeps = [];
  const state = { version: '0.9.0', lockAsked: 0 };
  const writeCopy = (sha) => {
    const folder = path.join(pnpmHome, 'global', 'v11', 'h-1');
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'package.json'), JSON.stringify({ dependencies: { 'js-harness': `github:jsaristi/js-harness#${sha}` } }));
    fs.mkdirSync(path.join(folder, 'node_modules', 'js-harness', 'bin'), { recursive: true });
    fs.writeFileSync(path.join(folder, 'node_modules', 'js-harness', 'bin', 'js-harness.mjs'), '');
    fs.writeFileSync(path.join(binDir, 'js-harness'), 'exec "$basedir/../global/v11/h-1/node_modules/js-harness/bin/js-harness.mjs"\n');
  };
  if (prev) writeCopy(prev);
  const spawn = (cmd, args) => {
    calls.push([cmd, ...args].join(' '));
    if (cmd === 'pnpm' && args[0] === 'bin') return ok(`${binDir}\n`);
    if (cmd === 'pnpm' && args[0] === 'add') {
      if (addStatus === 0 && deliver) {
        writeCopy(args[2].split('#')[1]);
        state.version = MAIN_VERSION;
      }
      return { status: addStatus, stdout: '', stderr: addStatus === 0 ? '' : 'ERR_PNPM_X\n' };
    }
    if (cmd === 'ps') return ok('');
    // The copy the shim names, run by its own path: it answers what was installed (or `answers`).
    if (cmd === process.execPath && /js-harness\.mjs$/.test(args[0] ?? '')) {
      calls.push(['js-harness', ...args.slice(1)].join(' '));
      return args[1] === '--version' ? ok(`${answers ?? state.version}\n`) : ok('');
    }
    // A `js-harness` the PATH finds: the same copy, unless `pathAnswers` makes it another one.
    if (cmd === 'js-harness' && args[0] === '--version') return ok(`${pathAnswers ?? answers ?? state.version}\n`);
    if (cmd === 'js-harness') return ok('');
    return { status: 1, stdout: '', stderr: `unexpected ${cmd}` };
  };
  return { top, pnpmHome, binDir, home, settings, calls, sleeps, spawn, state };
}

/** The gate lock a test runs with: free, or refused with the reason `refused` names. */
function lockOf({ refused = null, asked = [] } = {}) {
  return async () => {
    asked.push(true);
    return refused ? { refused, waitedMs: 0 } : { release() {}, lost: () => false, waitedMs: 0 };
  };
}

function refresh(m, over = {}) {
  const out = [];
  const err = [];
  const promise = refreshCopy({
    landed: true,
    sha: SHA,
    version: MAIN_VERSION,
    home: m.home,
    settings: m.settings,
    cwd: m.top,
    env: {},
    platform: 'linux',
    spawn: m.spawn,
    sleep: async (ms) => m.sleeps.push(ms),
    now: () => NOW,
    takeGateLock: lockOf(),
    runHeld: heldInProcess,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    ...over,
  });
  return promise.then((code) => ({ code, out: out.join('\n'), err: err.join('\n') }));
}

test('refreshCopy refreshes nothing and says so when nothing landed', async () => {
  const m = machine({ prev: PREV });
  const asked = [];
  const run = await refresh(m, { landed: false, takeGateLock: lockOf({ asked }) });
  assert.equal(run.code, 0);
  assert.match(run.out, /^Nothing landed: the installed copy was not refreshed\.$/m);
  assert.deepEqual(m.calls, [], 'no package manager and no install ran');
  assert.deepEqual(asked, [], 'the gate lock was not even asked for');
});

test('refreshCopy installs main by its sha with pnpm add -g, then runs js-harness install and doctor, in that order', async () => {
  const m = machine({ prev: PREV });
  const run = await refresh(m);
  assert.equal(run.code, 0, run.err);
  const steps = m.calls.filter((line) => /^(pnpm add -g|js-harness install$|js-harness doctor$)/.test(line));
  assert.deepEqual(steps, [`pnpm add -g github:jsaristi/js-harness#${SHA}`, 'js-harness install', 'js-harness doctor']);
  assert.match(run.out, /settings before: [0-9a-f]{16} \(copy /);
  assert.match(run.out, /settings after: [0-9a-f]{16}/);
});

test('refreshCopy verifies the installed copy by its version and by the sha its shim names, and says both', async () => {
  const m = machine({ prev: PREV });
  const run = await refresh(m);
  assert.equal(run.code, 0, run.err);
  assert.match(run.out, new RegExp(`the installed copy answers ${MAIN_VERSION} and names ${SHA}`));
});

test('refreshCopy fails loudly, after three tries, when the installed copy answers another version than main', async () => {
  const m = machine({ prev: PREV, answers: '0.9.0' });
  const run = await refresh(m);
  assert.equal(run.code, 6, run.out);
  assert.match(run.err, new RegExp(`answers 0\\.9\\.0, not ${MAIN_VERSION}`));
  assert.equal(m.calls.filter((line) => line.startsWith('pnpm add -g')).length, 3);
  assert.deepEqual(m.sleeps, [20_000, 20_000], 'a pause between the tries, none after the last');
  assert.ok(!m.calls.includes('js-harness install'), 'nothing is installed on a copy that is not verified');
});

test('refreshCopy fails loudly when the shim does not name main\'s sha, even though the version is right', async () => {
  const m = machine({ prev: PREV, deliver: false, answers: MAIN_VERSION });
  const run = await refresh(m);
  assert.equal(run.code, 6, run.out);
  assert.match(run.err, new RegExp(`does not name ${SHA}`));
  assert.doesNotMatch(run.err, /answers/);
});

test('refreshCopy keeps the newest five settings backups and says how many it kept', async () => {
  const m = machine({ prev: PREV });
  const dir = path.join(m.home, '.js-harness', 'refresh-backups');
  fs.mkdirSync(dir, { recursive: true });
  for (let day = 1; day <= 6; day += 1) fs.writeFileSync(path.join(dir, `settings-202601${String(day).padStart(2, '0')}T000000Z.json`), '{}');
  const run = await refresh(m);
  assert.equal(run.code, 0, run.err);
  assert.deepEqual(fs.readdirSync(dir).sort(), [
    'settings-20260103T000000Z.json',
    'settings-20260104T000000Z.json',
    'settings-20260105T000000Z.json',
    'settings-20260106T000000Z.json',
    'settings-20261018T023500Z.json',
  ]);
  assert.match(run.out, /kept the newest 5 settings backups in /);
});

test('refreshCopy prints the undo: the previous sha, the settings copy, and how to uninstall', async () => {
  const m = machine({ prev: PREV });
  const run = await refresh(m);
  assert.equal(run.code, 0, run.err);
  const backup = path.join(m.home, '.js-harness', 'refresh-backups', 'settings-20261018T023500Z.json');
  assert.match(run.out, /^undo: js-harness uninstall --global, then pnpm add -g github:jsaristi\/js-harness#fedcba9876543210fedcba9876543210fedcba98, then js-harness install; the settings before are in /m);
  assert.ok(run.out.includes(backup), 'the settings copy the undo restores is named');
  assert.equal(fs.readFileSync(backup, 'utf8'), '{"hooks":{}}\n');
});

// harness-review L58: after `upgrade` the copy is the one of a release tag, which names no sha; the undo names the tag.
test('refreshCopy names the release tag of a copy upgrade installed, in its undo and as the copy before', async () => {
  const m = machine({ prev: 'v0.9.0' });
  const run = await refresh(m);
  assert.equal(run.code, 0, run.err);
  assert.match(run.out, /the copy named v0\.9\.0 before/);
  assert.match(run.out, /^undo: js-harness uninstall --global, then pnpm add -g github:jsaristi\/js-harness#v0\.9\.0, then js-harness install;/m);
});

test('refreshCopy does nothing when the gate lock is not obtained: no install, exit 75', async () => {
  const m = machine({ prev: PREV });
  const run = await refresh(m, { takeGateLock: lockOf({ refused: 'launcher gone' }) });
  assert.equal(run.code, 75, run.out);
  assert.match(run.err, /the gate lock was not obtained/);
  assert.match(run.err, /nothing was refreshed/);
  assert.deepEqual(m.calls, [], 'no package manager ran');
  assert.ok(!fs.existsSync(path.join(m.home, '.js-harness', 'refresh-backups')), 'no settings backup was written');
});

test('pruneStalePnpm removes unused install folders and old bin backups as prune-pnpm.sh does, keeps used and young ones, and names a shim whose target is missing', () => {
  const top = tempDir('js-harness-prune-');
  const home = path.join(top, 'pnpm');
  const bin = path.join(home, 'bin');
  const v11 = path.join(home, 'global', 'v11');
  const used = 'a1b2c3-0123456789abcdef-0';
  const stale = 'ffee00-fedcba9876543210-1';
  const young = 'ffee11-1111111111111111-2';
  const old = new Date(NOW - 60 * 60_000);
  for (const name of [used, stale, young]) fs.mkdirSync(path.join(v11, name, 'node_modules', 'js-harness', 'bin'), { recursive: true });
  fs.writeFileSync(path.join(v11, used, 'node_modules', 'js-harness', 'bin', 'js-harness.mjs'), '');
  fs.mkdirSync(path.join(bin, '.pnpm-bin-backup-1'), { recursive: true });
  fs.utimesSync(path.join(bin, '.pnpm-bin-backup-1'), old, old);
  fs.utimesSync(path.join(v11, stale), old, old);
  fs.writeFileSync(path.join(bin, 'js-harness'), `exec "$basedir/../global/v11/${used}/node_modules/js-harness/bin/js-harness.mjs"\n`);
  fs.writeFileSync(path.join(bin, 'js-harness.cmd'), `@"%~dp0\\..\\global\\v11\\${used}\\node_modules\\js-harness\\bin\\js-harness.mjs" %*\n`);
  fs.writeFileSync(path.join(bin, 'gone.cmd'), '@"%~dp0\\..\\global\\v11\\0000aa-0000000000000000-9\\node_modules\\gone\\bin\\gone.mjs" %*\n');
  const result = pruneStalePnpm({ binDir: bin, now: () => NOW, isPnpmRunning: () => false });
  assert.deepEqual(fs.readdirSync(v11).sort(), [used, young].sort(), 'the stale folder went, the used and the young ones stayed');
  assert.ok(!fs.existsSync(path.join(bin, '.pnpm-bin-backup-1')), 'an old bin backup went');
  assert.ok(fs.existsSync(path.join(bin, 'js-harness.cmd')), 'a shim stays');
  assert.equal(result.removed, 1);
  assert.equal(result.backups, 1);
  assert.equal(result.kept, 2);
  assert.deepEqual(result.broken, ['gone']);
});

// C-b-32 (odd/tasks/launch-audit/triage.md): pnpm writes the POSIX shim as a sh script with no extension and forward
// slashes, beside the .cmd with backslashes. The prune named a broken shim only in the .cmd form, so on Linux and macOS it never did.
test('pruneStalePnpm names a POSIX shim whose target is missing, and not one whose target is there (C-b-32)', () => {
  const top = tempDir('js-harness-prune-posix-');
  const home = path.join(top, 'pnpm');
  const bin = path.join(home, 'bin');
  const used = 'a1b2c3-0123456789abcdef-0';
  fs.mkdirSync(path.join(home, 'global', 'v11', used, 'node_modules', 'js-harness', 'bin'), { recursive: true });
  fs.writeFileSync(path.join(home, 'global', 'v11', used, 'node_modules', 'js-harness', 'bin', 'js-harness.mjs'), '');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'js-harness'), `#!/bin/sh\nbasedir=$(dirname "$0")\nexec node "$basedir/../global/v11/${used}/node_modules/js-harness/bin/js-harness.mjs" "$@"\n`);
  fs.writeFileSync(path.join(bin, 'gone'), '#!/bin/sh\nbasedir=$(dirname "$0")\nexec node "$basedir/../global/v11/0000aa-0000000000000000-9/node_modules/gone/bin/gone.mjs" "$@"\n');
  const result = pruneStalePnpm({ binDir: bin, now: () => NOW, isPnpmRunning: () => false });
  assert.deepEqual(result.broken, ['gone']);
  assert.ok(fs.existsSync(path.join(bin, 'gone')), 'a broken shim is named, not removed');
});

// Blocker 2 (the verifier): pnpm on Windows writes a .cmd and an extensionless shim beside it. A broken pair is named once.
test('pruneStalePnpm names a broken shim once when its .cmd and its POSIX shim both miss their target (blocker 2)', () => {
  const top = tempDir('js-harness-prune-pair-');
  const bin = path.join(top, 'pnpm', 'bin');
  fs.mkdirSync(bin, { recursive: true });
  const target = 'global/v11/0000aa-0000000000000000-9/node_modules/gone/bin/gone.mjs';
  fs.writeFileSync(path.join(bin, 'gone.cmd'), `@"%~dp0\\..\\${target.replace(/\//g, '\\')}" %*\n`);
  fs.writeFileSync(path.join(bin, 'gone'), `#!/bin/sh\nexec node "$basedir/../${target}" "$@"\n`);
  const result = pruneStalePnpm({ binDir: bin, now: () => NOW, isPnpmRunning: () => false });
  assert.deepEqual(result.broken, ['gone']);
});

test('pruneStalePnpm removes nothing while a pnpm process runs, or when the process list cannot be read', () => {
  const top = tempDir('js-harness-prune-busy-');
  const bin = path.join(top, 'pnpm', 'bin');
  const stale = path.join(top, 'pnpm', 'global', 'v11', 'ffee00-fedcba9876543210-1');
  fs.mkdirSync(path.join(bin), { recursive: true });
  fs.mkdirSync(stale, { recursive: true });
  const old = new Date(NOW - 60 * 60_000);
  fs.utimesSync(stale, old, old);
  for (const busy of [true, null]) {
    const result = pruneStalePnpm({ binDir: bin, now: () => NOW, isPnpmRunning: () => busy });
    assert.ok(result.skipped, 'the prune says it was skipped');
    assert.ok(fs.existsSync(stale), 'the folder stays');
  }
});

// Codex on 93de70b..2e6f86b, P2: the copy was verified by the `js-harness` the PATH finds while the shim's sha was read
// from pnpm's copy, and install ran the PATH one: an older copy first on the PATH passed both checks and wrote the hooks.
test('refreshCopy verifies and runs the copy the shim names, by its path, not the one the PATH finds', async () => {
  const m = machine({ prev: PREV, pathAnswers: MAIN_VERSION, answers: '0.9.0' });
  const run = await refresh(m);
  assert.equal(run.code, 6, run.out);
  assert.match(run.err, new RegExp(`answers 0\\.9\\.0, not ${MAIN_VERSION}`));
  const good = machine({ prev: PREV });
  const ran = [];
  const spawn = (cmd, args, opts) => {
    ran.push([cmd, ...args]);
    return good.spawn(cmd, args, opts);
  };
  assert.equal((await refresh(good, { spawn })).code, 0);
  const entry = path.join(good.pnpmHome, 'global', 'v11', 'h-1', 'node_modules', 'js-harness', 'bin', 'js-harness.mjs');
  for (const step of ['install', 'doctor']) {
    assert.ok(ran.some((one) => one[0] === process.execPath && one[1] === entry && one[2] === step), `${step} runs the verified copy`);
    assert.ok(!ran.some((one) => one[0] === 'js-harness' && one[1] === step), `${step} does not run the PATH one`);
  }
});

// Codex on 93de70b..2e6f86b, P2: the settings backed up were the OS home's while install wrote those of JS_HARNESS_HOME.
test('refreshCopy backs up the settings of the harness home it is given', async () => {
  const m = machine({ prev: PREV });
  const own = path.join(m.home, '.claude', 'settings.json');
  fs.mkdirSync(path.dirname(own), { recursive: true });
  fs.writeFileSync(own, '{"own":true}\n');
  const run = await refresh(m, { settings: undefined });
  assert.equal(run.code, 0, run.err);
  const dir = path.join(m.home, '.js-harness', 'refresh-backups');
  const [copy] = fs.readdirSync(dir);
  assert.equal(fs.readFileSync(path.join(dir, copy), 'utf8'), '{"own":true}\n');
});

// Codex on 93de70b..2e6f86b, P2: the install ran by spawnSync in the process that holds the gate lock, so the lock could
// not beat for as long as pnpm took and a waiting gate could take it as a dead one's.
test('heldInChild runs the held part in another process, so this one goes on running its timers, and gives its exit and lines', async () => {
  const dir = tempDir('js-harness-held-');
  const entry = path.join(dir, 'held.mjs');
  // Blocks its own event loop for 400 ms, as a synchronous install does, then says a line on each stream.
  fs.writeFileSync(entry, "const end = Date.now() + 400; while (Date.now() < end) {}\nconsole.log('out line');\nconsole.error('err line');\nprocess.exit(6);\n");
  let ticks = 0;
  const timer = setInterval(() => { ticks += 1; }, 50);
  const out = [];
  const err = [];
  const code = await heldInChild({ sha: SHA, version: MAIN_VERSION, home: dir, settings: path.join(dir, 's.json'), env: process.env, platform: process.platform, stdout: (line) => out.push(line), stderr: (line) => err.push(line) }, { entry });
  clearInterval(timer);
  assert.equal(code, 6);
  assert.ok(ticks >= 4, `the timers of this process ran ${ticks} times while the child blocked`);
  assert.deepEqual(out, ['out line']);
  assert.deepEqual(err, ['err line']);
});

// A review (fb9f66ace187f6fe), R4-doctor-exit-ignored: a doctor that failed was printed and the refresh exited 0.
test('refreshCopy fails when js-harness doctor exits non-zero after the install', async () => {
  const m = machine({ prev: PREV });
  const spawn = (cmd, args, opts) => (cmd === process.execPath && args[1] === 'doctor' ? { status: 1, stdout: '', stderr: '' } : m.spawn(cmd, args, opts));
  const run = await refresh(m, { spawn });
  assert.equal(run.code, 6, run.out);
  assert.match(run.err, /js-harness doctor exited 1/);
});

// A review (fb9f66ace187f6fe), R4-prune-dangling-link-throws: a link of the store whose target was gone threw out
// of the prune, after the copy was installed.
test('pruneStalePnpm leaves a link whose target is gone and goes on', () => {
  const top = tempDir('js-harness-prune-link-');
  const bin = path.join(top, 'pnpm', 'bin');
  const v11 = path.join(top, 'pnpm', 'global', 'v11');
  const stale = 'ffee00-fedcba9876543210-1';
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(path.join(v11, stale), { recursive: true });
  const old = new Date(NOW - 60 * 60_000);
  fs.utimesSync(path.join(v11, stale), old, old);
  const dangling = path.join(v11, 'js-harness');
  const fsys = {
    ...fs,
    readdirSync: (dir, ...rest) => (dir === v11 ? [...fs.readdirSync(dir, ...rest), 'js-harness'] : fs.readdirSync(dir, ...rest)),
    lstatSync: (entry, ...rest) => (entry === dangling ? { isSymbolicLink: () => true, isDirectory: () => false, mtimeMs: 0 } : fs.lstatSync(entry, ...rest)),
    realpathSync: (entry, ...rest) => {
      if (entry === dangling) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      return fs.realpathSync(entry, ...rest);
    },
  };
  const result = pruneStalePnpm({ binDir: bin, now: () => NOW, isPnpmRunning: () => false, fsys });
  assert.equal(result.removed, 1);
});

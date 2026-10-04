import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn as spawnChild } from 'node:child_process';
import { cleanServerEnv, nextDelay, resolveClaude, serverArgs, supervise } from './remote.mjs';
import { createReaper } from './process-tree.testkit.mjs';

// ---- cleanServerEnv: what the server must not inherit ----------------------------------------------------------------

test('cleanServerEnv drops every CLAUDE* variable, in any case, and ANTHROPIC_BASE_URL, and keeps the rest', () => {
  const env = {
    PATH: 'C:\\bin',
    HOME: '/home/x',
    USERPROFILE: 'C:\\Users\\x',
    APPDATA: 'C:\\Users\\x\\AppData\\Roaming',
    CLAUDECODE: '1',
    CLAUDE_CODE_SESSION_ID: 'abc',
    CLAUDE_CODE_ORGANIZATION_UUID: 'org',
    claude_x: 'lower',
    ANTHROPIC_BASE_URL: 'http://proxy',
    anthropic_base_url: 'http://proxy',
    ANTHROPIC_API_KEY_HINT: 'kept',
    MY_CLAUDE: 'kept, the name does not start with CLAUDE',
  };
  assert.deepEqual(cleanServerEnv(env), {
    PATH: 'C:\\bin',
    HOME: '/home/x',
    USERPROFILE: 'C:\\Users\\x',
    APPDATA: 'C:\\Users\\x\\AppData\\Roaming',
    ANTHROPIC_API_KEY_HINT: 'kept',
    MY_CLAUDE: 'kept, the name does not start with CLAUDE',
  });
  assert.equal(env.CLAUDECODE, '1', 'the input is not changed');
});

// ---- serverArgs ------------------------------------------------------------------------------------------------------

test('serverArgs names the server and runs sessions in the project folder unless told otherwise', () => {
  assert.deepEqual(serverArgs({ name: 'js-harness' }), ['remote-control', '--name', 'js-harness', '--spawn', 'same-dir']);
  assert.deepEqual(serverArgs({ name: 'p', spawnMode: 'worktree' }), ['remote-control', '--name', 'p', '--spawn', 'worktree']);
  assert.deepEqual(serverArgs({ name: 'p', spawnMode: 'session', permissionMode: 'acceptEdits' }), ['remote-control', '--name', 'p', '--spawn', 'session', '--permission-mode', 'acceptEdits']);
});

test('serverArgs refuses an empty name and an unknown spawn mode', () => {
  for (const name of ['', '   ', undefined, null]) assert.throws(() => serverArgs({ name }), /name/, String(name));
  assert.throws(() => serverArgs({ name: 'p', spawnMode: 'elsewhere' }), /spawn mode.*same-dir, worktree, session/);
});

// ---- resolveClaude: found on PATH, never by running anything --------------------------------------------------------

const existing = (...files) => (file) => files.includes(file);

test('on Windows resolveClaude takes claude.exe before claude.cmd in each directory, in PATH order', () => {
  const env = { Path: 'C:\\a;"C:\\b";;C:\\c' };
  assert.deepEqual(resolveClaude({ env, platform: 'win32', exists: existing('C:\\b\\claude.cmd', 'C:\\b\\claude.exe', 'C:\\c\\claude.exe') }), { path: 'C:\\b\\claude.exe', shell: false });
  assert.deepEqual(resolveClaude({ env, platform: 'win32', exists: existing('C:\\b\\claude.cmd', 'C:\\c\\claude.exe') }), { path: 'C:\\b\\claude.cmd', shell: true }, 'an earlier directory wins over a better extension');
  assert.deepEqual(resolveClaude({ env: { PATH: 'C:\\a' }, platform: 'win32', exists: existing('C:\\a\\claude.exe') }), { path: 'C:\\a\\claude.exe', shell: false }, 'PATH in capitals too');
});

test('elsewhere resolveClaude looks for a plain claude on a colon-separated PATH', () => {
  const env = { PATH: '/usr/bin:/home/x/.local/bin' };
  assert.deepEqual(resolveClaude({ env, platform: 'linux', exists: existing('/home/x/.local/bin/claude', '/home/x/.local/bin/claude.exe') }), { path: '/home/x/.local/bin/claude', shell: false });
  assert.equal(resolveClaude({ env, platform: 'linux', exists: existing('/usr/bin/claude.exe') }), null);
});

test('resolveClaude returns null when no directory holds it, or there is no PATH', () => {
  assert.equal(resolveClaude({ env: { Path: 'C:\\a;C:\\b' }, platform: 'win32', exists: () => false }), null);
  assert.equal(resolveClaude({ env: {}, platform: 'win32', exists: () => true }), null);
});

// ---- nextDelay: capped exponential backoff ---------------------------------------------------------------------------

test('nextDelay starts at the minimum, doubles on each quick exit up to the cap, and resets after a healthy run', () => {
  assert.equal(nextDelay(undefined, 100), 5000, 'the first restart');
  assert.equal(nextDelay(5000, 100), 10000);
  assert.equal(nextDelay(20000, 100), 40000);
  assert.equal(nextDelay(40000, 100), 60000, 'capped');
  assert.equal(nextDelay(60000, 100), 60000);
  assert.equal(nextDelay(60000, 300000), 5000, 'a server that ran five minutes was healthy');
  assert.equal(nextDelay(60000, 299999), 60000);
  assert.equal(nextDelay(1, 10, { minMs: 2, maxMs: 7, healthyMs: 50 }), 2, 'never below the minimum');
  assert.equal(nextDelay(4, 10, { minMs: 2, maxMs: 7, healthyMs: 50 }), 7);
  assert.equal(nextDelay(7, 50, { minMs: 2, maxMs: 7, healthyMs: 50 }), 2);
});

// ---- supervise, against real child processes ------------------------------------------------------------------------

const reaper = createReaper();
test.after(() => reaper.sweep());

const tmpDirs = [];
test.after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});
function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-remote-'));
  tmpDirs.push(dir);
  return dir;
}

const waitUntil = async (predicate, ms = 8000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return predicate();
};
const isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
};
const readLog = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
const count = (text, pattern) => (text.match(new RegExp(pattern, 'g')) ?? []).length;

/** A fake `claude remote-control`: prints `Connected`, what it inherited and its arguments, then exits 1. */
const QUICK_FAKE = [
  "console.log('Connected');",
  "console.log('session=' + (process.env.CLAUDE_CODE_SESSION_ID ?? 'none') + ' base=' + (process.env.ANTHROPIC_BASE_URL ?? 'none'));",
  "console.log('args=' + JSON.stringify(process.argv.slice(2)));",
  "console.error('to stderr');",
  'process.exitCode = 1;',
].join('\n');

/** A fake that stays up after `Connected`, with a grandchild whose pid it prints. */
const LASTING_FAKE = [
  "const { spawn } = require('node:child_process');",
  "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true });",
  "console.log('grandchild=' + child.pid);",
  "console.log('Connected');",
  'setInterval(() => {}, 1000);',
].join('\n');

function fakeServer(dir, code) {
  const file = path.join(dir, 'fake-claude.cjs');
  fs.writeFileSync(file, code);
  return file;
}

/** The real `spawn`, with each child handed to the teardown and kept for the test. */
function trackedSpawn() {
  const children = [];
  const spawn = (...args) => {
    const child = reaper.child(spawnChild(...args));
    children.push(child);
    return child;
  };
  return { spawn, children };
}

const leakyEnv = () => ({ ...process.env, CLAUDE_CODE_SESSION_ID: 'leaked-session', ANTHROPIC_BASE_URL: 'http://leaked', CLAUDECODE: '1' });

test('supervise logs the server\'s output, starts it in a clean environment, and restarts it after each exit with the backoff', async () => {
  const dir = tempDir();
  const logPath = path.join(dir, 'remote.log');
  const controller = new AbortController();
  const delays = [];
  const sleep = async (ms) => {
    delays.push(ms);
    if (delays.length === 2) controller.abort();
  };
  const { spawn, children } = trackedSpawn();
  await supervise({
    claude: { path: process.execPath, shell: false },
    args: [fakeServer(dir, QUICK_FAKE)],
    cwd: dir,
    env: cleanServerEnv(leakyEnv()),
    logPath,
    spawn,
    sleep,
    signal: controller.signal,
  });
  const log = readLog(logPath);
  assert.equal(children.length, 2, 'started, exited, started again, and stopped during the second wait');
  assert.equal(count(log, 'Connected'), 2, log);
  assert.equal(count(log, 'to stderr'), 2, 'stderr goes to the log too');
  assert.match(log, /session=none base=none/, 'nothing of the parent session reached the server');
  assert.doesNotMatch(log, /leaked/);
  assert.equal(count(log, /\[js-harness remote\] server exited \(code 1\) after \S+; restarting in 5s/.source), 1, log);
  assert.equal(count(log, /\[js-harness remote\] server exited \(code 1\) after \S+; restarting in 10s/.source), 1, log);
  assert.deepEqual(delays, [5000, 10000]);
  assert.ok(children.every((child) => child.exitCode === 1));
});

test('supervise hands an injected backoff to the delay', async () => {
  const dir = tempDir();
  const controller = new AbortController();
  const delays = [];
  await supervise({
    claude: { path: process.execPath, shell: false },
    args: [fakeServer(dir, QUICK_FAKE)],
    cwd: dir,
    env: cleanServerEnv(process.env),
    logPath: path.join(dir, 'remote.log'),
    spawn: trackedSpawn().spawn,
    sleep: async (ms) => {
      delays.push(ms);
      if (delays.length === 3) controller.abort();
    },
    backoff: { minMs: 10, maxMs: 30, healthyMs: 60000 },
    signal: controller.signal,
  });
  assert.deepEqual(delays, [10, 20, 30]);
});

test('supervise runs the server in the project folder', async () => {
  const dir = tempDir();
  const project = path.join(dir, 'project');
  fs.mkdirSync(project);
  const logPath = path.join(dir, 'remote.log');
  const controller = new AbortController();
  await supervise({
    claude: { path: process.execPath, shell: false },
    args: ['-e', 'console.log("cwd=" + process.cwd())'],
    cwd: project,
    env: cleanServerEnv(process.env),
    logPath,
    spawn: trackedSpawn().spawn,
    sleep: async () => controller.abort(),
    signal: controller.signal,
  });
  assert.ok(readLog(logPath).includes(`cwd=${project}`), readLog(logPath));
});

test('aborting the signal while the server runs kills it and what it started, and does not restart it', async () => {
  const dir = tempDir();
  const logPath = path.join(dir, 'remote.log');
  const controller = new AbortController();
  const since = Date.now();
  const { spawn, children } = trackedSpawn();
  let slept = false;
  const running = supervise({
    claude: { path: process.execPath, shell: false },
    args: [fakeServer(dir, LASTING_FAKE)],
    cwd: dir,
    env: cleanServerEnv(process.env),
    logPath,
    spawn,
    sleep: async () => { slept = true; },
    signal: controller.signal,
  });
  assert.ok(await waitUntil(() => /Connected/.test(readLog(logPath))), 'the server came up');
  const grandchild = Number(/grandchild=(\d+)/.exec(readLog(logPath))[1]);
  reaper.pids([grandchild], { since });
  controller.abort();
  await running;
  assert.equal(children.length, 1, 'no restart');
  assert.equal(slept, false, 'no wait for a restart either');
  assert.ok(children[0].exitCode !== null || children[0].signalCode !== null, 'the server exited');
  assert.ok(await waitUntil(() => !isAlive(grandchild)), 'its child did not survive it');
  assert.match(readLog(logPath), /\[js-harness remote\] stopped/);
  assert.doesNotMatch(readLog(logPath), /restarting/);
});

test('a kill that fails on abort is logged and thrown, not waited on forever', async () => {
  const dir = tempDir();
  const logPath = path.join(dir, 'remote.log');
  const controller = new AbortController();
  const { spawn, children } = trackedSpawn();
  const running = supervise({
    claude: { path: process.execPath, shell: false },
    args: ['-e', 'console.log("Connected"); setInterval(() => {}, 1000)'],
    cwd: dir,
    env: cleanServerEnv(process.env),
    logPath,
    spawn,
    kill: () => { throw new Error('still running after the kill: pid 1234'); },
    signal: controller.signal,
  });
  assert.ok(await waitUntil(() => /Connected/.test(readLog(logPath))));
  controller.abort();
  await assert.rejects(running, /still running after the kill/);
  assert.match(readLog(logPath), /\[js-harness remote\] could not stop the server: still running after the kill/);
  assert.equal(children.length, 1, 'and no restart');
  children[0].kill('SIGKILL'); // through its handle, like the teardown
});

test('a signal aborted before the start runs nothing', async () => {
  const controller = new AbortController();
  controller.abort();
  const dir = tempDir();
  await supervise({
    claude: { path: process.execPath, shell: false },
    args: ['-e', ''],
    cwd: dir,
    env: {},
    logPath: path.join(dir, 'remote.log'),
    spawn: () => assert.fail('nothing may be started'),
    sleep: () => assert.fail('nothing to wait for'),
    signal: controller.signal,
  });
});

test('the default wait between restarts ends as soon as the signal aborts', { timeout: 8000 }, async () => {
  const dir = tempDir();
  const logPath = path.join(dir, 'remote.log');
  const controller = new AbortController();
  const { spawn, children } = trackedSpawn();
  const running = supervise({
    claude: { path: process.execPath, shell: false },
    args: [fakeServer(dir, QUICK_FAKE)],
    cwd: dir,
    env: cleanServerEnv(process.env),
    logPath,
    spawn,
    backoff: { minMs: 60000 },
    signal: controller.signal,
  });
  assert.ok(await waitUntil(() => /restarting in 60s/.test(readLog(logPath))), 'the server exited and the wait began');
  controller.abort();
  await running;
  assert.equal(children.length, 1);
});

test('a server that cannot start is logged and retried with the same backoff, never in a tight loop', async () => {
  const dir = tempDir();
  const logPath = path.join(dir, 'remote.log');
  const controller = new AbortController();
  const delays = [];
  await supervise({
    claude: { path: path.join(dir, 'missing', 'claude.exe'), shell: false },
    args: serverArgs({ name: 'p' }),
    cwd: dir,
    env: cleanServerEnv(process.env),
    logPath,
    spawn: trackedSpawn().spawn,
    sleep: async (ms) => {
      delays.push(ms);
      if (delays.length === 3) controller.abort();
    },
    signal: controller.signal,
  });
  assert.deepEqual(delays, [5000, 10000, 20000]);
  const log = readLog(logPath);
  assert.equal(count(log, /\[js-harness remote\] server could not start \(.*ENOENT.*\); retrying in \d+s/.source), 3, log);
});

test('a spawn that throws is logged and retried too', async () => {
  const dir = tempDir();
  const logPath = path.join(dir, 'remote.log');
  const controller = new AbortController();
  const delays = [];
  await supervise({
    claude: { path: 'claude', shell: false },
    args: [],
    cwd: dir,
    env: {},
    logPath,
    spawn: () => { throw new Error('spawn EINVAL'); },
    sleep: async (ms) => {
      delays.push(ms);
      if (delays.length === 2) controller.abort();
    },
    signal: controller.signal,
  });
  assert.deepEqual(delays, [5000, 10000]);
  assert.equal(count(readLog(logPath), 'could not start \\(spawn EINVAL\\)'), 2);
});

test('a .cmd shim is started through the shell as one command line, with its arguments intact', { skip: process.platform === 'win32' ? false : 'Windows shims only' }, async () => {
  const dir = tempDir();
  const fake = fakeServer(dir, QUICK_FAKE);
  const shim = path.join(dir, 'claude.cmd');
  fs.writeFileSync(shim, `@"${process.execPath}" "${fake}" %*\r\n`);
  const logPath = path.join(dir, 'remote.log');
  const controller = new AbortController();
  await supervise({
    claude: { path: shim, shell: true },
    args: serverArgs({ name: 'my project' }),
    cwd: dir,
    env: cleanServerEnv(leakyEnv()),
    logPath,
    spawn: trackedSpawn().spawn,
    sleep: async () => controller.abort(),
    signal: controller.signal,
  });
  const log = readLog(logPath);
  assert.ok(log.includes('args=["remote-control","--name","my project","--spawn","same-dir"]'), log);
  assert.match(log, /session=none base=none/);
});

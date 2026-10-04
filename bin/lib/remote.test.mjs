import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn as spawnChild, spawnSync as spawnChildSync } from 'node:child_process';
import { cleanServerEnv, loginLauncher, nextDelay, readPersistentEnv, resolveClaude, serverArgs, supervise } from './remote.mjs';
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

// ---- cleanServerEnv: what the user set persistently stays -----------------------------------------------------------

/** What a desktop session hands the server: the user's own variables, one of them overwritten, and its own. */
const sessionEnv = () => ({
  PATH: 'C:\\bin',
  CLAUDE_CONFIG_DIR: 'D:\\claude-config',
  CLAUDE_CODE_GIT_BASH_PATH: 'C:\\overwritten-by-the-session\\bash.exe',
  Claude_Code_Tmpdir: 'C:\\inherited-tmp',
  ANTHROPIC_BASE_URL: 'http://injected-by-the-session',
  CLAUDE_CODE_SESSION_ID: 'abc',
  CLAUDECODE: '1',
});

test('cleanServerEnv keeps a name it would strip when it is set persistently: the registry\'s value for a plain string, the inherited one otherwise', () => {
  const env = sessionEnv();
  let reads = 0;
  const readPersistent = () => {
    reads += 1;
    return new Map([
      ['CLAUDE_CONFIG_DIR', undefined], // only known to be set (an expandable string): the inherited value stays
      ['CLAUDE_CODE_GIT_BASH_PATH', 'C:\\Program Files\\Git\\bin\\bash.exe'],
      ['CLAUDE_CODE_TMPDIR', 'C:\\persistent-tmp'], // names match in any case, as on Windows
      ['ANTHROPIC_BASE_URL', 'http://the-users-own-proxy'],
      ['CLAUDE_NOT_INHERITED', 'only in the registry'],
      ['PATH', 'C:\\registry'],
    ]);
  };
  assert.deepEqual(cleanServerEnv(env, { readPersistent }), {
    PATH: 'C:\\bin',
    CLAUDE_CONFIG_DIR: 'D:\\claude-config',
    CLAUDE_CODE_GIT_BASH_PATH: 'C:\\Program Files\\Git\\bin\\bash.exe',
    Claude_Code_Tmpdir: 'C:\\persistent-tmp',
    ANTHROPIC_BASE_URL: 'http://the-users-own-proxy',
  });
  assert.equal(reads, 1, 'the registry is read once');
  assert.deepEqual(env, sessionEnv(), 'the input is not changed');
});

test('cleanServerEnv strips them all, and says so once, when the registry cannot be read', () => {
  const warnings = [];
  const readPersistent = () => { throw new Error('reg query HKCU\\Environment failed (exit 1)'); };
  assert.deepEqual(cleanServerEnv(sessionEnv(), { readPersistent, warn: (text) => warnings.push(text) }), { PATH: 'C:\\bin' });
  assert.equal(warnings.length, 1, warnings.join('\n'));
  assert.match(warnings[0], /registry/);
  assert.ok(warnings[0].includes('reg query HKCU\\Environment failed (exit 1)'), warnings[0]);
});

test('cleanServerEnv reads no registry when nothing would be stripped, nor unless it is handed a reader', () => {
  const readPersistent = () => assert.fail('nothing to keep, so nothing to read');
  assert.deepEqual(cleanServerEnv({ PATH: 'C:\\bin', MY_CLAUDE: 'kept' }, { readPersistent }), { PATH: 'C:\\bin', MY_CLAUDE: 'kept' });
  assert.deepEqual(cleanServerEnv(sessionEnv()), { PATH: 'C:\\bin' }, 'without a reader every one is stripped');
});

// ---- readPersistentEnv: the Windows registry, through an injected reg.exe -------------------------------------------

const USER_KEY = 'HKCU\\Environment';
const MACHINE_KEY = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment';

/** What `reg query` prints for each key (captured from this machine's format, the values invented). */
const REG_OUTPUT = {
  [MACHINE_KEY]: [
    '',
    'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment',
    '    ComSpec    REG_EXPAND_SZ    %SystemRoot%\\system32\\cmd.exe',
    '    CLAUDE_CODE_GIT_BASH_PATH    REG_SZ    C:\\machine\\bash.exe',
    '    CLAUDE_CONFIG_DIR    REG_SZ    D:\\machine-config',
    '    ANTHROPIC_BASE_URL    REG_SZ    http://machine-proxy',
    '',
  ].join('\r\n'),
  [USER_KEY]: [
    '',
    'HKEY_CURRENT_USER\\Environment',
    '    CLAUDE_CODE_GIT_BASH_PATH    REG_SZ    C:\\Program Files\\Git\\bin\\bash.exe',
    '    Claude_Config_Dir    REG_EXPAND_SZ    %USERPROFILE%\\.claude-work',
    '    CLAUDE_ACCENT    REG_SZ    C:\\Users\\Sebasti\u00a0n\\claude',
    '    CLAUDE_NUMBER    REG_DWORD    0x1',
    '',
    'HKEY_CURRENT_USER\\Environment\\Subkey',
    '',
  ].join('\r\n'),
};

function fakeReg(outputs = REG_OUTPUT) {
  const calls = [];
  const spawnSync = (command, args, options) => {
    calls.push({ command, args, options });
    const stdout = outputs[args[1]];
    return stdout === undefined ? { status: 1, stdout: '', stderr: 'ERROR: The system was unable to find the specified registry key or value.\r\n' } : { status: 0, stdout, stderr: '' };
  };
  return { spawnSync, calls };
}

test('readPersistentEnv lists what the user and machine keys set, the user\'s winning, with a value only where it can be trusted', () => {
  const { spawnSync, calls } = fakeReg();
  const persistent = readPersistentEnv({ platform: 'win32', env: { SystemRoot: 'C:\\Windows' }, spawnSync });
  assert.deepEqual([...persistent].sort(([a], [b]) => a.localeCompare(b)), [
    ['ANTHROPIC_BASE_URL', 'http://machine-proxy'],
    ['CLAUDE_ACCENT', undefined], // beyond ASCII: reg.exe wrote it in a code page this cannot know
    ['CLAUDE_CODE_GIT_BASH_PATH', 'C:\\Program Files\\Git\\bin\\bash.exe'], // the user's, over the machine's
    ['CLAUDE_CONFIG_DIR', undefined], // the user's expandable string, over the machine's plain one
    ['COMSPEC', undefined],
  ]);
  assert.deepEqual(calls.map(({ args }) => args).sort(), [['query', MACHINE_KEY], ['query', USER_KEY]].sort());
  for (const { command, options } of calls) {
    assert.equal(command, 'C:\\Windows\\System32\\reg.exe', 'by its full path: a reg.exe in the project folder is never the one run');
    assert.equal(options.windowsHide, true);
  }
});

test('readPersistentEnv throws when either key cannot be read: half an answer would strip what the user set', () => {
  for (const missing of [USER_KEY, MACHINE_KEY]) {
    const outputs = { ...REG_OUTPUT, [missing]: undefined };
    assert.throws(() => readPersistentEnv({ platform: 'win32', env: {}, spawnSync: fakeReg(outputs).spawnSync }), /reg query .*Environment failed \(exit 1\).*unable to find/s, missing);
  }
  const broken = () => ({ error: new Error('spawnSync reg.exe ENOENT'), status: null, stdout: '', stderr: '' });
  assert.throws(() => readPersistentEnv({ platform: 'win32', env: {}, spawnSync: broken }), /could not run: spawnSync reg\.exe ENOENT/);
});

test('off Windows nothing is set persistently, and nothing is run to find out', () => {
  const persistent = readPersistentEnv({ platform: 'linux', spawnSync: () => assert.fail('no registry to read') });
  assert.equal(persistent.size, 0);
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
    args: ['-e', 'console.log("cwd=" + require("node:fs").realpathSync(process.cwd()))'],
    cwd: project,
    env: cleanServerEnv(process.env),
    logPath,
    spawn: trackedSpawn().spawn,
    sleep: async () => controller.abort(),
    signal: controller.signal,
  });
  // Real paths on both sides: a temp folder is reached through a link on some platforms (`/var` on macOS), and
  // the server's own cwd is then spelled differently from the path it was given.
  assert.ok(readLog(logPath).includes(`cwd=${fs.realpathSync(project)}`), readLog(logPath));
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

/** A fake that proves it ran even when its output goes nowhere: a line in the file its first argument names. */
const MARKING_FAKE = [
  "require('node:fs').appendFileSync(process.argv[2], 'ran\\n');",
  "console.log('Connected');",
  'process.exitCode = 1;',
].join('\n');

/** Two ways a log cannot be opened or appended to, each with what makes it usable again. */
const BLOCKED_LOGS = {
  'the log path is a directory': (dir) => {
    const logPath = path.join(dir, 'remote.log');
    fs.mkdirSync(logPath);
    return { logPath, unblock: () => fs.rmdirSync(logPath) };
  },
  'the folder of the log is a file': (dir) => {
    const folder = path.join(dir, 'logs');
    fs.writeFileSync(folder, '');
    return { logPath: path.join(folder, 'remote.log'), unblock: () => fs.rmSync(folder) };
  },
};

for (const [what, block] of Object.entries(BLOCKED_LOGS)) {
  test(`a log that cannot be written never ends the supervisor (${what}): the server runs, the backoff holds, and the next write is tried`, async () => {
    const dir = tempDir();
    const marker = path.join(dir, 'ran.txt');
    const { logPath, unblock } = block(dir);
    const controller = new AbortController();
    const delays = [];
    await supervise({
      claude: { path: process.execPath, shell: false },
      args: [fakeServer(dir, MARKING_FAKE), marker],
      cwd: dir,
      env: cleanServerEnv(process.env),
      logPath,
      spawn: trackedSpawn().spawn,
      sleep: async (ms) => {
        delays.push(ms);
        if (delays.length === 1) unblock();
        if (delays.length === 2) controller.abort();
      },
      signal: controller.signal,
    });
    assert.equal(count(readLog(marker), 'ran'), 2, 'the server ran with nowhere to log, and was restarted');
    assert.deepEqual(delays, [5000, 10000], 'the restarts keep the backoff');
    const log = readLog(logPath);
    assert.equal(count(log, 'Connected'), 1, `only the second run found a log to write to: ${log}`);
    assert.equal(count(log, /\[js-harness remote\] server exited \(code 1\) after \S+; restarting in 10s/.source), 1, log);
    assert.match(log, /\[js-harness remote\] stopped/);
  });
}

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

// ---- the login launcher: a batch file that starts the server again ---------------------------------------------------

const LAUNCHER = { node: 'C:\\Program Files\\nodejs\\node.exe', script: 'D:\\js-harness\\bin\\remote.mjs', root: 'D:\\work\\proj', name: 'proj' };
/** The lines of a launcher, which all end in CRLF: the last one is the command. */
const launcherLines = (text) => {
  assert.ok(text.endsWith('\r\n'), 'the file ends with a line ending');
  const lines = text.slice(0, -2).split('\r\n');
  assert.ok(lines.every((line) => !line.includes('\n') && !line.includes('\r')), 'every line ends in CRLF, which is what cmd.exe reads reliably');
  return lines;
};

test('loginLauncher is a batch file whose one command starts the same server, and says what it is', () => {
  const lines = launcherLines(loginLauncher(LAUNCHER));
  assert.equal(lines[0], '@echo off');
  assert.match(lines[1], /^rem .*js-harness remote stop --at-login/, 'whoever finds it in the Startup folder is told how it is removed');
  assert.equal(lines.at(-1), '"C:\\Program Files\\nodejs\\node.exe" D:\\js-harness\\bin\\remote.mjs start --cwd D:\\work\\proj --name proj');
  assert.equal(lines.length, 3, 'nothing else: no code page line for a file that is all ASCII');
  assert.doesNotMatch(lines.at(-1), /--at-login/, 'the launcher starts the server, it does not write itself again');
  assert.equal(loginLauncher(LAUNCHER), loginLauncher({ ...LAUNCHER }), 'the same options give the same bytes');
});

test('loginLauncher passes the options the server was started with, quoted where cmd.exe needs it', () => {
  const text = loginLauncher({ ...LAUNCHER, root: 'D:\\my work\\proj', name: 'my phone', permissionMode: 'acceptEdits', spawnMode: 'worktree', home: 'D:\\other home' });
  assert.equal(
    launcherLines(text).at(-1),
    '"C:\\Program Files\\nodejs\\node.exe" D:\\js-harness\\bin\\remote.mjs start --cwd "D:\\my work\\proj" --name "my phone" --permission-mode acceptEdits --spawn worktree --home "D:\\other home"',
  );
});

test('loginLauncher quotes the executable even when its path has nothing to quote: cmd.exe splits a bare command at , ; and =', () => {
  const lines = launcherLines(loginLauncher({ ...LAUNCHER, node: 'C:\\tools,x=1\\node.exe' }));
  assert.ok(lines.at(-1).startsWith('"C:\\tools,x=1\\node.exe" '), lines.at(-1));
});

test('loginLauncher switches the console to UTF-8 only when the command holds a letter beyond ASCII', () => {
  const lines = launcherLines(loginLauncher({ ...LAUNCHER, root: 'D:\\año\\proj' }));
  assert.deepEqual(lines.slice(2), ['chcp 65001 >nul', '"C:\\Program Files\\nodejs\\node.exe" D:\\js-harness\\bin\\remote.mjs start --cwd "D:\\año\\proj" --name proj']);
  assert.doesNotMatch(loginLauncher(LAUNCHER), /chcp/);
});

test('loginLauncher refuses, naming it, any value that holds what cmd.exe acts on in a batch file', () => {
  const fields = { node: /node executable/, script: /install of js-harness/, root: /project folder/, name: /server name/, home: /home/, permissionMode: /permission mode/, spawnMode: /spawn mode/ };
  for (const [field, label] of Object.entries(fields)) {
    for (const bad of ['&', '|', '<', '>', '^', '%', '"', '!', '\n', '\u0007', '\u007f']) {
      const value = `C:\\a${bad}b`;
      assert.throws(() => loginLauncher({ ...LAUNCHER, [field]: value }), (err) => {
        assert.match(err.message, label, `${field} with ${JSON.stringify(bad)}`);
        assert.ok(err.message.includes(JSON.stringify(value)), err.message);
        assert.match(err.message, /cmd\.exe/);
        return true;
      });
    }
  }
});

test('a generated launcher run by a real cmd.exe hands the script its arguments intact, through a space and a letter beyond ASCII', { skip: process.platform === 'win32' ? false : 'cmd.exe only', timeout: 120000 }, (t) => {
  const dir = path.join(tempDir(), 'lanzador ñ');
  const root = path.join(dir, 'mi proyecto ñandú');
  fs.mkdirSync(root, { recursive: true });
  // Not the real `remote start`: a script that writes down what it was called with, next to itself.
  const fake = path.join(dir, 'fake remote ñ.mjs');
  fs.writeFileSync(fake, "import fs from 'node:fs';\nfs.writeFileSync(new URL('./args.json', import.meta.url), JSON.stringify(process.argv.slice(2)));\n");
  const received = path.join(dir, 'args.json');
  const launcher = path.join(dir, 'js-harness-remote-test.cmd');
  const text = loginLauncher({ node: process.execPath, script: fake, root, name: 'café del móvil', permissionMode: 'acceptEdits', home: path.join(dir, 'otra casa') });
  // The console a launcher gets at login has the machine's OEM code page (850 in Spanish, 437 in English), not
  // UTF-8: each run below starts in a console of its own (`windowsHide`), asks for 850, and prints the code page
  // it then has, because the switch does not take everywhere (a machine set to UTF-8 system-wide, a console
  // where `chcp` fails). `under850` says whether the launcher really ran under 850.
  const runAskingFor850 = (content) => {
    fs.writeFileSync(launcher, content);
    fs.rmSync(received, { force: true });
    const result = spawnChildSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `"chcp 850 >nul & chcp & "${launcher}""`], { encoding: 'latin1', windowsHide: true, windowsVerbatimArguments: true, timeout: 60000 });
    const under850 = /\b850\b/.test(String(result.stdout).split(/\r?\n/)[0]);
    return { result, under850, args: fs.existsSync(received) ? JSON.parse(fs.readFileSync(received, 'utf8')) : null };
  };

  // Whatever the console's code page turned out to be, the arguments arrive as they were given.
  const run = runAskingFor850(text);
  assert.equal(run.result.status, 0, run.result.stderr);
  assert.deepEqual(run.args, ['start', '--cwd', root, '--name', 'café del móvil', '--permission-mode', 'acceptEdits', '--home', path.join(dir, 'otra casa')]);
  assert.match(text, /^chcp 65001 >nul\r\n/m);

  // Why the file has that line, measured on 2026-10-04 under code pages 850, 437 and 1252: without it cmd.exe
  // reads the UTF-8 bytes in the console's code page, and the path it then runs does not exist. That is a fact
  // about cmd.exe under 850, so it is asserted only where this run's console really was 850.
  const without = runAskingFor850(text.replace('chcp 65001 >nul\r\n', ''));
  if (run.under850 && without.under850) {
    assert.notEqual(without.result.status, 0, 'the same file without the code page line does not find the script');
    assert.equal(without.args, null);
  } else {
    t.diagnostic('the console did not switch to code page 850 here, so the need for the chcp line was not re-measured');
  }
});

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn as spawnChild, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { failingTests, estimateTokens, checkBudget, checkContracts, checkPayload, discoverSensors, discoverDocuments, discoverDocumentSensors, discoverSameTree, DOCUMENT_SENSOR_TIMEOUT_MS, checkSensor, checkSensors, checkReview, runSensor, takeGateTurn, main } from './check.mjs';
import { SENSOR_TIMEOUT_MS, TOKEN_BUDGET } from './check.mjs';
import { killTree } from './lib/process-tree.mjs';
import { projectSlug } from './lib/sessions.mjs';
import { gateDir, gateLockDir, readGateHolder, takeGateLock } from './lib/gate-lock.mjs';
import { appendGateEvent, gateLogDir, gatesOf, readGateLog } from './lib/gate-log.mjs';
import { treeKey } from './lib/gate-tree.mjs';
import { LEFT_MARK, SYNCED_MARK, TIMED_OUT_MARK } from './lib/gate-wsl.mjs';

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-check-'));
}

test('estimateTokens divides length by 4, rounding up', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcde'), 2);
  assert.equal(estimateTokens('a'.repeat(6000)), 1500);
});

test('checkBudget passes at exactly the token limit', () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(TOKEN_BUDGET * 4)); // the budget, exactly
    const row = checkBudget(dir);
    assert.equal(row.pass, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkBudget fails over the token limit', () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat((TOKEN_BUDGET + 1) * 4)); // one token over it
    const row = checkBudget(dir);
    assert.equal(row.pass, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkBudget fails with a clear message when AGENTS.md is missing', () => {
  const dir = makeTmpDir();
  try {
    const row = checkBudget(dir);
    assert.equal(row.pass, false);
    assert.match(row.detail, /AGENTS\.md/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main exits 1 when a row fails (budget over limit, tests skipped)', async () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat((TOKEN_BUDGET + 1) * 4));
    const code = await main(['--cwd', dir], { JS_HARNESS_CHECK_INNER: '1' });
    assert.equal(code, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main exits 0 when all rows pass (budget under limit, tests skipped)', async () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(4000));
    const code = await main(['--cwd', dir], { JS_HARNESS_CHECK_INNER: '1' });
    assert.equal(code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- sensors: a project's own tests, lint and typecheck, declared in harness.json or package.json ---

const writeJson = (dir, file, value) => fs.writeFileSync(path.join(dir, file), JSON.stringify(value));
/** A command that exits with `status`, quoted so it runs the same under cmd.exe and sh. */
const exits = (status, extra = '') => `node -e "${extra}process.exit(${status})"`;

test('discoverSensors reads harness.json sensors in order and wins over package.json', () => {
  const dir = makeTmpDir();
  try {
    writeJson(dir, 'package.json', { scripts: { test: 'node --test' } });
    writeJson(dir, 'harness.json', { sensors: { lint: 'ruff check .', tests: 'pytest' } });
    assert.deepEqual(discoverSensors(dir), {
      sensors: [{ name: 'lint', command: 'ruff check .' }, { name: 'tests', command: 'pytest' }],
      source: 'harness.json',
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('discoverSensors ignores a harness.json without a sensors key', () => {
  const dir = makeTmpDir();
  try {
    writeJson(dir, 'harness.json', { pins: {} });
    writeJson(dir, 'package.json', { scripts: { lint: 'eslint .' } });
    assert.equal(discoverSensors(dir).source, 'package.json');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('discoverSensors reports a sensors value of the wrong shape instead of skipping it', () => {
  const dir = makeTmpDir();
  try {
    for (const sensors of [['pytest'], 'pytest', null, { tests: '' }, { tests: 3 }, { tests: '   ' }]) {
      writeJson(dir, 'harness.json', { sensors });
      const found = discoverSensors(dir);
      assert.match(found.error, /harness\.json/, JSON.stringify(sensors));
      assert.deepEqual(found.sensors, [], JSON.stringify(sensors));
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('discoverSensors reports a harness.json that is not an object instead of falling back', () => {
  const dir = makeTmpDir();
  try {
    writeJson(dir, 'package.json', { scripts: { lint: 'eslint .' } });
    for (const value of [[{ sensors: { tests: 'pytest' } }], 'pytest', null, 3]) {
      writeJson(dir, 'harness.json', value);
      const found = discoverSensors(dir);
      assert.match(found.error ?? '', /harness\.json/, JSON.stringify(value));
      assert.deepEqual(found.sensors, [], JSON.stringify(value));
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// An explicit empty map is a deliberate opt-out, so it neither falls back to package.json nor
// passes silently: the INFO row names the file that declared it.
test('discoverSensors takes an empty harness.json sensors map as declaring none, and check says where', async () => {
  const dir = makeTmpDir();
  try {
    writeJson(dir, 'harness.json', { sensors: {} });
    writeJson(dir, 'package.json', { scripts: { test: 'vitest run' } });
    assert.deepEqual(discoverSensors(dir), { sensors: [], source: 'harness.json' });
    const [row] = await checkSensors(dir);
    assert.equal(row.info, true);
    assert.match(row.detail, /harness\.json declares no sensors/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('discoverSensors reports harness.json that is not valid JSON', () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'harness.json'), '{ nope');
    assert.match(discoverSensors(dir).error, /harness\.json/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('discoverSensors turns package.json test, lint and typecheck scripts into npm run sensors', () => {
  const dir = makeTmpDir();
  try {
    writeJson(dir, 'package.json', { scripts: { typecheck: 'tsc --noEmit', build: 'tsc', lint: 'eslint .', test: 'vitest run' } });
    assert.deepEqual(discoverSensors(dir), {
      sensors: [
        { name: 'tests', command: 'npm run test' },
        { name: 'lint', command: 'npm run lint' },
        { name: 'typecheck', command: 'npm run typecheck' },
      ],
      source: 'package.json',
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("discoverSensors treats npm's placeholder test script and empty scripts as absent", () => {
  const dir = makeTmpDir();
  try {
    writeJson(dir, 'package.json', {
      scripts: { test: 'echo "Error: no test specified" && exit 1', lint: '', typecheck: 7 },
    });
    assert.deepEqual(discoverSensors(dir), { sensors: [], source: 'package.json' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('discoverSensors keeps a real script that merely mentions the placeholder text', () => {
  const dir = makeTmpDir();
  try {
    writeJson(dir, 'package.json', {
      scripts: { test: 'node --test --test-name-pattern="no test specified"', lint: 'echo "Error: no test specified" && exit 1' },
    });
    assert.deepEqual(discoverSensors(dir).sensors.map((s) => s.name), ['tests', 'lint']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('discoverSensors reports package.json that is not valid JSON', () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), '{ nope');
    assert.match(discoverSensors(dir).error, /package\.json/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('discoverSensors finds nothing when neither file exists', () => {
  const dir = makeTmpDir();
  try {
    assert.deepEqual(discoverSensors(dir), { sensors: [], source: null });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkSensor passes when the command exits 0', async () => {
  const dir = makeTmpDir();
  try {
    const command = exits(0);
    // `seconds` and `timedOut` are for the gate log, and nothing of a row that is printed.
    const { seconds, ...row } = await checkSensor(dir, { name: 'lint', command });
    assert.deepEqual(row, { name: 'lint', pass: true, detail: `${command} passed`, output: '', timedOut: false });
    // Kept to a tenth of a second, so a command that ends within 50 ms took 0 s: a number, and no fault.
    // That a time is measured at all is proven below, on a command that is made to take 120 ms.
    assert.ok(Number.isFinite(seconds) && seconds >= 0 && seconds < 600, String(seconds));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkSensor says how long the command took, in seconds, and whether its time ran out', async () => {
  const sensor = { name: 'tests', command: 'x' };
  const waits = (ms, result) => async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return result;
  };
  const passed = await checkSensor(os.tmpdir(), sensor, { spawn: waits(120, { status: 0, stdout: '', stderr: '' }) });
  assert.deepEqual([passed.pass, passed.timedOut], [true, false]);
  // To a tenth of a second, as the log keeps it; a timer may fire a few milliseconds early.
  assert.ok(passed.seconds >= 0.1 && passed.seconds < 60, String(passed.seconds));
  assert.equal(passed.seconds, Math.round(passed.seconds * 10) / 10);
  const late = await checkSensor(os.tmpdir(), sensor, { spawn: () => ({ status: null, signal: null, stdout: '', stderr: '', error: Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }) }) });
  assert.deepEqual([late.pass, late.timedOut], [false, true]);
  // A command that failed, could not run or was killed did not time out.
  for (const result of [{ status: 3 }, { status: null, error: new Error('spawn ENOENT') }, { status: null, signal: 'SIGTERM' }]) {
    const row = await checkSensor(os.tmpdir(), sensor, { spawn: () => ({ stdout: '', stderr: '', ...result }) });
    assert.deepEqual([row.pass, row.timedOut], [false, false], JSON.stringify(result));
  }
});

test("checkSensor fails with the exit status and keeps the command's output", async () => {
  const dir = makeTmpDir();
  try {
    const command = exits(3, "console.log('boom-out');console.error('boom-err');");
    const row = await checkSensor(dir, { name: 'tests', command });
    assert.equal(row.name, 'tests');
    assert.equal(row.pass, false);
    assert.equal(row.detail, `${command} exited 3`);
    assert.match(row.output, /boom-out/);
    assert.match(row.output, /boom-err/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkSensor fails with the spawn error when the command cannot run', async () => {
  const spawn = () => ({ error: new Error('spawn ENOENT'), status: null });
  const row = await checkSensor(os.tmpdir(), { name: 'tests', command: 'whatever' }, { spawn });
  assert.equal(row.pass, false);
  assert.match(row.detail, /spawn ENOENT/);
});

test('checkSensor keeps what the command printed before a spawn error such as ENOBUFS', async () => {
  const spawn = () => ({ error: new Error('spawnSync ENOBUFS'), status: null, stdout: 'partial-out', stderr: 'partial-err' });
  const row = await checkSensor(os.tmpdir(), { name: 'tests', command: 'noisy' }, { spawn });
  assert.equal(row.pass, false);
  assert.match(row.output, /partial-out/);
  assert.match(row.output, /partial-err/);
});

// Windows dedupes environment keys case-insensitively and keeps the uppercase one, so an inherited
// NPM_CONFIG_CACHE would win over the lowercase override; npm also reads either case.
test('checkSensor drops inherited case variants of the variables it overrides', async () => {
  const saved = { ...process.env };
  let env;
  const spawn = (_command, options) => {
    env = options.env;
    return { status: 0, stdout: '', stderr: '' };
  };
  try {
    process.env.NPM_CONFIG_CACHE = 'real-cache';
    process.env.Home = 'real-home';
    await checkSensor(os.tmpdir(), { name: 'tests', command: 'x' }, { spawn });
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
  for (const name of ['npm_config_cache', 'HOME']) {
    const keys = Object.keys(env).filter((key) => key.toLowerCase() === name.toLowerCase());
    assert.deepEqual(keys, [name], `${name} keys: ${keys}`);
  }
  assert.ok(env.npm_config_cache.startsWith(env.HOME));
});

// A gate once left `Microsoft/Windows/PowerShell/ModuleAnalysisCache` in the working tree it checked. With
// the profile moved to an empty home, Windows PowerShell finds no local application data folder under it
// and writes its cache of analysed modules to a path from the folder it runs in.
test('checkSensor on Windows points the module analysis cache of PowerShell into the throwaway home, whatever case the inherited variable has, and sets no such variable on another system', async () => {
  const saved = { ...process.env };
  const envs = {};
  const during = {};
  try {
    // Any spelling this process was given goes first: where names are case-sensitive it would stay beside the
    // one set here as a second variable, and the sensor, rightly, would be handed both.
    for (const key of Object.keys(process.env)) if (key.toLowerCase() === 'psmoduleanalysiscachepath') delete process.env[key];
    process.env.PSMODULEANALYSISCACHEPATH = 'C:\\real\\cache';
    for (const platform of ['win32', 'linux', 'darwin']) {
      const spawn = (_command, options) => {
        envs[platform] = options.env;
        during[platform] = fs.existsSync(options.env.HOME);
        return { status: 0, stdout: '', stderr: '' };
      };
      await checkSensor(os.tmpdir(), { name: 'tests', command: 'x' }, { spawn, platform });
    }
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
  const cacheKeys = (env) => Object.keys(env).filter((key) => key.toLowerCase() === 'psmoduleanalysiscachepath');
  assert.deepEqual(cacheKeys(envs.win32), ['PSModuleAnalysisCachePath']);
  const cache = envs.win32.PSModuleAnalysisCachePath;
  // A file of the home itself: the home is there while the sensor runs, and the file goes with it.
  assert.equal(path.dirname(cache), envs.win32.HOME);
  assert.deepEqual([during.win32, fs.existsSync(envs.win32.HOME)], [true, false]);
  // Elsewhere PowerShell keeps that cache under the home, which is the throwaway one already: the variable
  // this process was given is the caller's own and goes through as it is.
  for (const platform of ['linux', 'darwin']) assert.deepEqual(cacheKeys(envs[platform]).map((key) => envs[platform][key]), ['C:\\real\\cache'], platform);
});

// A hook's git exports the variables that bind every git command to its repository; a sensor that
// inherits them runs its own `git init` or `git add` against that repository instead of its fixture.
test('checkSensor drops the variables that bind git to one repository, and keeps the others', async () => {
  const saved = { ...process.env };
  let env;
  const spawn = (_command, options) => {
    env = options.env;
    return { status: 0, stdout: '', stderr: '' };
  };
  try {
    process.env.GIT_DIR = 'real/.git/worktrees/feature';
    process.env.GIT_INDEX_FILE = 'real/.git/worktrees/feature/index';
    process.env.Git_Work_Tree = 'real';
    process.env.GIT_COMMON_DIR = 'real/.git';
    process.env.GIT_AUTHOR_NAME = 'Someone';
    await checkSensor(os.tmpdir(), { name: 'tests', command: 'x' }, { spawn });
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
  const bound = Object.keys(env).filter((key) => /^git_(dir|index_file|work_tree|common_dir)$/i.test(key));
  assert.deepEqual(bound, []);
  assert.equal(env.GIT_AUTHOR_NAME, 'Someone');
});

let gitConfigDir;
after(() => {
  if (gitConfigDir) fs.rmSync(gitConfigDir, { recursive: true, force: true });
});

/** The environment of a git that builds a fixture: none of git's own variables, so it never acts on the
 * repository a hook exported, and none of the host's configuration (a `core.hooksPath`, a signing key). */
function gitEnv() {
  if (!gitConfigDir) {
    gitConfigDir = makeTmpDir();
    fs.writeFileSync(path.join(gitConfigDir, 'empty.gitconfig'), '');
  }
  const inherited = Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key));
  return { ...Object.fromEntries(inherited), GIT_CONFIG_GLOBAL: path.join(gitConfigDir, 'empty.gitconfig'), GIT_CONFIG_NOSYSTEM: '1' };
}

/** Runs git in `cwd` as `gitEnv` says, and answers what it printed. */
function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, env: gitEnv(), encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}

// The list is git's own; a git that grows a variable must fail here, not in someone's repository.
test('checkSensor covers every variable git itself calls repository-local', async () => {
  let env;
  const spawn = (_command, options) => {
    env = options.env;
    return { status: 0, stdout: '', stderr: '' };
  };
  const names = git(os.tmpdir(), 'rev-parse', '--local-env-vars').split(/\r?\n/).filter(Boolean);
  assert.ok(names.includes('GIT_DIR'), `git answered: ${names}`);
  const saved = { ...process.env };
  try {
    for (const name of names) process.env[name] = 'leaked';
    await checkSensor(os.tmpdir(), { name: 'tests', command: 'x' }, { spawn });
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
  assert.deepEqual(names.filter((name) => name in env), []);
});

// What happened on 2026-10-04: a commit in a linked worktree hands its hook that worktree's GIT_DIR,
// and a test's `git init` in a temp directory then re-initialised the shared repository as bare.
test('checkSensor keeps a sensor that runs git init from touching the repository the hook exported', async () => {
  const dir = makeTmpDir();
  const saved = { ...process.env };
  try {
    const decoy = path.join(dir, 'decoy');
    fs.mkdirSync(decoy);
    git(decoy, 'init', '--quiet');
    git(decoy, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '--quiet', '--allow-empty', '-m', 'root');
    git(decoy, 'worktree', 'add', '--quiet', path.join(dir, 'linked'));
    const config = path.join(decoy, '.git', 'config');
    const before = fs.readFileSync(config);
    process.env.GIT_DIR = path.join(decoy, '.git', 'worktrees', 'linked');
    process.env.GIT_INDEX_FILE = path.join(decoy, '.git', 'worktrees', 'linked', 'index');
    const row = await checkSensor(dir, { name: 'tests', command: 'git init --quiet fresh' });
    assert.equal(row.pass, true, row.output);
    assert.deepEqual(fs.readFileSync(config), before, fs.readFileSync(config, 'utf8'));
    assert.equal(fs.existsSync(path.join(dir, 'fresh', '.git')), true, 'the sensor initialised its own repository');
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Ten minutes refused three commits in a row on 2026-10-04: this repository's own suite needs about
// eight on a quiet machine and went past ten with two of eight cores taken by other programs.
test('checkSensor gives every sensor a 20 minute timeout by default', async () => {
  let options;
  const spawn = (_command, opts) => {
    options = opts;
    return { status: 0, stdout: '', stderr: '' };
  };
  await checkSensor(os.tmpdir(), { name: 'tests', command: 'x' }, { spawn });
  assert.equal(options.timeout, SENSOR_TIMEOUT_MS);
});

/** Whether a process with this pid is alive; polled up to 5 s so the OS has time to reap it. */
async function goneWithin(pid, ms = 5000) {
  const deadline = Date.now() + ms;
  for (;;) {
    try {
      process.kill(pid, 0);
    } catch (err) {
      return err.code === 'ESRCH';
    }
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// A watch-mode script or a linter waiting on stdin must not hold the pre-commit gate forever, and
// killing only the shell would leave the real command running after every commit.
test('checkSensor stops a command that never exits, with its whole process tree, and says it timed out', async () => {
  const dir = makeTmpDir();
  try {
    const pidFile = path.join(dir, 'grandchild.pid');
    // The grandchild writes its pid and sleeps; the parent waits for that file, then sleeps too.
    const grandchild = `require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setTimeout(() => {}, 120000);`;
    fs.writeFileSync(path.join(dir, 'hang.js'), [
      "const { spawn } = require('child_process');",
      "const fs = require('fs');",
      `spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: 'inherit' });`,
      `while (!fs.existsSync(${JSON.stringify(pidFile)})) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);`,
      'setTimeout(() => {}, 120000);',
    ].join('\n'));
    const command = 'node hang.js';
    const started = Date.now();
    const row = await checkSensor(dir, { name: 'tests', command }, { sensorTimeout: 3000 });
    assert.ok(Date.now() - started < 60000, `took ${Date.now() - started} ms`);
    assert.equal(row.pass, false);
    assert.equal(row.detail, `${command} timed out after 3 s`);
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    assert.ok(await goneWithin(pid), `grandchild ${pid} is still running`);
    fs.rmSync(dir, { recursive: true, force: true });
    assert.equal(fs.existsSync(dir), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// A test server or worker a script left running holds the pipes after the shell is gone; the sensor
// is judged by the shell's own exit status, but the leftover must not outlive the run.
test('checkSensor kills a background process the command left behind, and still passes', async () => {
  const dir = makeTmpDir();
  try {
    const pidFile = path.join(dir, 'survivor.pid');
    fs.writeFileSync(path.join(dir, 'child.js'), `require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setTimeout(() => {}, 120000);`);
    // The shell exits 0 at once; the survivor is its own child and inherits the output pipes.
    const command = process.platform === 'win32' ? 'start /b node child.js' : 'node child.js &';
    const started = Date.now();
    const row = await checkSensor(dir, { name: 'tests', command });
    assert.ok(Date.now() - started < 60000, `took ${Date.now() - started} ms`);
    assert.equal(row.pass, true, row.output);
    assert.equal(row.detail, `${command} passed`);
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    assert.ok(await goneWithin(pid), `survivor ${pid} is still running`);
    fs.rmSync(dir, { recursive: true, force: true });
    assert.equal(fs.existsSync(dir), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// On Windows a survivor can hold the throwaway home as its cwd; that must not throw out of check.
test('checkSensor does not throw when the throwaway home cannot be removed', async () => {
  const realRmSync = fs.rmSync;
  fs.rmSync = (target, ...rest) => {
    if (path.basename(String(target)).startsWith('js-harness-test-home-')) throw Object.assign(new Error('EPERM'), { code: 'EPERM' });
    return realRmSync(target, ...rest);
  };
  try {
    const row = await checkSensor(os.tmpdir(), { name: 'tests', command: 'x' }, { spawn: () => ({ status: 0, stdout: '', stderr: '' }) });
    assert.equal(row.pass, true);
  } finally {
    fs.rmSync = realRmSync;
  }
});

// A kill that could not be done (no PowerShell, a CIM failure) must not turn a passing command red, and must not
// be invisible either.
test('checkSensor says when what a command left running could not be stopped, without changing its verdict', async () => {
  const spawn = () => ({ status: 0, stdout: '', stderr: '', sweepError: 'the process snapshot failed (exit 1): CIM is down' });
  const row = await checkSensor(os.tmpdir(), { name: 'tests', command: 'x' }, { spawn });
  assert.equal(row.pass, true);
  assert.equal(row.detail, 'x passed; could not stop what it left running: the process snapshot failed (exit 1): CIM is down');
  const failing = await checkSensor(os.tmpdir(), { name: 'tests', command: 'x' }, { spawn: () => ({ status: 2, stdout: '', stderr: '', sweepError: 'boom' }) });
  assert.equal(failing.pass, false);
  assert.equal(failing.detail, 'x exited 2; could not stop what it left running: boom');
});

test('runSensor reports a kill that throws inside its timer as sweepError, and still resolves', async () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'hang.js'), 'setTimeout(() => {}, 120000);');
    const failingKill = (child, lifetime) => {
      try {
        killTree(child, lifetime); // the real kill first, so the test leaves nothing running
      } catch {
        // the scripted failure below is the one under test
      }
      throw new Error('still running after the kill: pid 4242');
    };
    const result = await runSensor('node hang.js', { cwd: dir, timeout: 3000, killTree: failingKill });
    assert.equal(result.error.code, 'ETIMEDOUT');
    assert.equal(result.sweepError, 'still running after the kill: pid 4242');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkSensor keeps what the command printed before it timed out', async () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'chatty.js'), "console.log('before-timeout'); setTimeout(() => {}, 120000);");
    const command = 'node chatty.js';
    const row = await checkSensor(dir, { name: 'tests', command }, { sensorTimeout: 3000 });
    assert.equal(row.pass, false);
    assert.match(row.detail, /timed out after 3 s/);
    assert.match(row.output, /before-timeout/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkSensor names the signal when the command is killed by one', async () => {
  const spawn = () => ({ status: null, signal: 'SIGTERM', stdout: 'out', stderr: '' });
  const row = await checkSensor(os.tmpdir(), { name: 'tests', command: 'slow' }, { spawn });
  assert.equal(row.pass, false);
  assert.equal(row.detail, 'slow was killed by SIGTERM');
  assert.match(row.output, /out/);
});

// A test that forgets --home must land in a throwaway directory, never in the real home.
test('checkSensor runs the command with the home directory pointed at a throwaway directory', async () => {
  const dir = makeTmpDir();
  try {
    const seen = path.join(dir, 'seen-home.txt').replace(/\\/g, '/');
    const record =
      "require('os').homedir() + '|' + process.env.JS_HARNESS_CHECK_INNER + '|' + process.env.NODE_TEST_CONTEXT + '|' + process.env.npm_config_cache";
    const command = `node -e "require('fs').writeFileSync('${seen}', ${record})"`;
    const row = await checkSensor(dir, { name: 'tests', command });
    assert.equal(row.pass, true, row.output);
    const [home, inner, context, npmCache] = fs.readFileSync(seen, 'utf8').split('|');
    // npm keeps its cache and logs under %LOCALAPPDATA% on Windows, outside HOME: `npm run` must too.
    assert.ok(path.resolve(npmCache).startsWith(path.resolve(home)), `npm cache was ${npmCache}`);
    assert.notEqual(path.resolve(home), path.resolve(os.homedir()));
    assert.ok(path.resolve(home).startsWith(path.resolve(os.tmpdir())), `home was ${home}`);
    assert.equal(fs.existsSync(home), false, 'the throwaway home is removed afterwards');
    assert.equal(inner, '1');
    assert.equal(context, 'undefined');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkSensors turns a discovery error into one FAIL row named sensors', async () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'harness.json'), '{ nope');
    const rows = await checkSensors(dir);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'sensors');
    assert.equal(rows[0].pass, false);
    assert.match(rows[0].detail, /harness\.json/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkSensors says so when no sensor is declared, naming both ways to declare one', async () => {
  const dir = makeTmpDir();
  try {
    const rows = await checkSensors(dir);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'sensors');
    assert.equal(rows[0].info, true);
    assert.equal(rows[0].pass, true);
    assert.match(rows[0].detail, /no sensors/i);
    assert.match(rows[0].detail, /package\.json/);
    assert.match(rows[0].detail, /harness\.json/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkSensors runs one row per sensor', async () => {
  const dir = makeTmpDir();
  try {
    writeJson(dir, 'harness.json', { sensors: { tests: exits(0), lint: exits(1) } });
    const rows = await checkSensors(dir);
    assert.deepEqual(rows.map((row) => [row.name, row.pass]), [['tests', true], ['lint', false]]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** A project dir whose sensors are `sensors` and whose AGENTS.md is within budget. */
function sensorProject(sensors) {
  const dir = makeTmpDir();
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(400));
  writeJson(dir, 'harness.json', { sensors });
  return dir;
}

test('main runs the sensors and exits 1 when one fails', async () => {
  const dir = sensorProject({ tests: exits(0), lint: exits(5) });
  try {
    const { code, output } = await runCheck(['--cwd', dir], { JS_HARNESS_HOME: dir });
    assert.equal(code, 1);
    assert.match(output, /^PASS {2}tests /m);
    assert.match(output, /^FAIL {2}lint /m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main exits 0 when every sensor passes', async () => {
  const dir = sensorProject({ tests: exits(0), lint: exits(0) });
  try {
    const { code, output } = await runCheck(['--cwd', dir], { JS_HARNESS_HOME: dir });
    assert.equal(code, 0, output);
    assert.match(output, /^PASS {2}tests /m);
    assert.match(output, /^PASS {2}lint /m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main runs no sensor when it is itself the inner run, or a push', async () => {
  const dir = sensorProject({ tests: exits(9) });
  try {
    const inner = await runCheck(['--cwd', dir], { JS_HARNESS_CHECK_INNER: '1', JS_HARNESS_HOME: dir });
    assert.equal(inner.code, 0);
    assert.doesNotMatch(inner.output, /tests/);
    const push = await runCheck(['--push', '--cwd', dir], { JS_HARNESS_HOME: dir });
    assert.doesNotMatch(push.output, /^(PASS|FAIL) {2}tests /m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// The real thing end to end: package.json scripts run through npm, so node_modules/.bin is on the path.
test('main runs package.json test and lint scripts through npm, and fails when either does', async () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(400));
    const project = (lintStatus, testStatus) =>
      writeJson(dir, 'package.json', {
        name: 'fixture',
        version: '1.0.0',
        scripts: { test: exits(testStatus), lint: exits(lintStatus) },
      });
    const run = () => runCheck(['--cwd', dir], { JS_HARNESS_HOME: dir });

    project(0, 0);
    let result = await run();
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /^PASS {2}tests {2}npm run test passed/m);
    assert.match(result.output, /^PASS {2}lint {2}npm run lint passed/m);

    project(1, 0);
    result = await run();
    assert.equal(result.code, 1);
    assert.match(result.output, /^PASS {2}tests /m);
    assert.match(result.output, /^FAIL {2}lint {2}npm run lint exited 1/m);

    project(0, 2);
    result = await run();
    assert.equal(result.code, 1);
    assert.match(result.output, /^FAIL {2}tests {2}npm run test exited 2/m);
    assert.match(result.output, /^PASS {2}lint /m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// The payload rows report what loads on every turn but never fail: no commit here can shrink a
// file another tool manages.
test('checkPayload reports each host with its sources, a missing one and its hooks', () => {
  const dir = makeTmpDir();
  const home = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(400)); // 100 tokens
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'a'.repeat(8000)); // 2000 tokens
    fs.writeFileSync(
      path.join(home, '.claude', 'settings.json'),
      JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'probe-hook' }] }] } }),
    );
    const [claude, codex] = checkPayload(dir, home);
    assert.equal(claude.name, 'payload claude');
    assert.equal(claude.info, true);
    assert.equal(claude.pass, true);
    assert.match(claude.detail, /2100 estimated tokens/);
    assert.ok(claude.lines.some((line) => /global CLAUDE\.md +2000/.test(line)));
    assert.ok(claude.lines.some((line) => /memory index +not found/.test(line)));
    assert.ok(claude.lines.some((line) => /UserPromptSubmit +probe-hook/.test(line)));
    assert.equal(codex.name, 'payload codex');
    assert.match(codex.detail, /100 estimated tokens/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('checkPayload prefixes a plugin hook with its plugin id and leaves a settings hook as it was', () => {
  const dir = makeTmpDir();
  const home = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(400));
    const installPath = path.join(home, '.claude', 'plugins', 'cache', 'engram');
    fs.mkdirSync(path.join(installPath, 'hooks'), { recursive: true });
    fs.writeFileSync(
      path.join(home, '.claude', 'settings.json'),
      JSON.stringify({
        enabledPlugins: { 'engram@engram': true },
        hooks: { UserPromptSubmit: [{ hooks: [{ command: 'probe-hook' }] }] },
      }),
    );
    fs.writeFileSync(
      path.join(home, '.claude', 'plugins', 'installed_plugins.json'),
      JSON.stringify({ plugins: { 'engram@engram': [{ installPath }] } }),
    );
    fs.writeFileSync(
      path.join(installPath, 'hooks', 'hooks.json'),
      JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ command: 'session-start.sh' }] }] } }),
    );
    const [claude] = checkPayload(dir, home);
    assert.ok(claude.lines.includes('hook UserPromptSubmit probe-hook'));
    assert.ok(claude.lines.includes('hook SessionStart     engram@engram: session-start.sh'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('main passes with a large machine payload when AGENTS.md is within budget', async () => {
  const dir = makeTmpDir();
  const home = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(4000));
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'a'.repeat(400000));
    const code = await main(['--cwd', dir, '--home', home], { JS_HARNESS_CHECK_INNER: '1' });
    assert.equal(code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- home precedence: --home flag, then env.JS_HARNESS_HOME, then os.homedir() (matches doctor.mjs) ---

/** Stands in for gentle-ai being absent, so a test that reaches the review row never spawns the real one. */
const gentleAiNotFound = () => ({
  status: null,
  stdout: '',
  stderr: '',
  error: Object.assign(new Error('spawnSync gentle-ai ENOENT'), { code: 'ENOENT' }),
});

/** What the sampler of `runCheck` reads: a machine with under one of its eight logical processors busy. */
const QUIET_LOAD = { busy: 0.4, processors: 8, share: 0.05, sampleMs: 1000 };
const QUIET_LOAD_ROW = 'INFO  load  0.4 of 8 logical processors busy before the sensors (5%, 1 s sample)';

/** Runs `main`, capturing everything it printed via console.log/console.error and the exit code.
 *
 * A gate takes the machine's gate lock in its home. A run that names none (`--home`, or
 * `JS_HARNESS_HOME` in `env`) is given a throwaway one, so a test can neither wait for a real gate of
 * this machine nor hold one up, whether this file is run by a gate or by hand.
 *
 * A gate samples the machine's load for a second before its sensors. A run that hands it no sampler
 * (`deps.sampleLoad`) is given one that answers `QUIET_LOAD` at once, so no test waits for a sample or
 * reads this machine, but the one that asks for the real sampler by name.
 *
 * On a loaded machine a gate looks for the processes that load it, which starts PowerShell on Windows. A
 * run that hands it no look (`deps.busiest`) is given one that finds nobody at once, so no test starts a
 * process for it, whatever its sampler says. */
async function runCheck(argv, env, deps = { gentleAi: gentleAiNotFound }) {
  let output = '';
  let errOutput = '';
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (line) => {
    output += `${line}\n`;
  };
  console.error = (line) => {
    errOutput += `${line}\n`;
  };
  const ownHome = argv.includes('--home') || env.JS_HARNESS_HOME !== undefined ? null : makeTmpDir();
  try {
    const code = await main(argv, ownHome ? { ...env, JS_HARNESS_HOME: ownHome } : env, { sampleLoad: async () => QUIET_LOAD, busiest: async () => [], ...deps });
    return { code, output, errOutput };
  } finally {
    console.log = originalLog;
    console.error = originalError;
    if (ownHome) fs.rmSync(ownHome, { recursive: true, force: true });
  }
}

test('main resolves home from env.JS_HARNESS_HOME when --home is absent', async () => {
  const dir = makeTmpDir();
  const home = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(400));
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'a'.repeat(40)); // 10 tokens

    const { code, output } = await runCheck(['--cwd', dir], { JS_HARNESS_CHECK_INNER: '1', JS_HARNESS_HOME: home });

    assert.equal(code, 0);
    assert.match(output, /global CLAUDE\.md +10/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('main prefers --home over env.JS_HARNESS_HOME when both are given', async () => {
  const dir = makeTmpDir();
  const flagHome = makeTmpDir();
  const envHome = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(400));
    fs.mkdirSync(path.join(flagHome, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(flagHome, '.claude', 'CLAUDE.md'), 'a'.repeat(40)); // 10 tokens
    fs.mkdirSync(path.join(envHome, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(envHome, '.claude', 'CLAUDE.md'), 'a'.repeat(80)); // 20 tokens

    const { code, output } = await runCheck(['--cwd', dir, '--home', flagHome], {
      JS_HARNESS_CHECK_INNER: '1',
      JS_HARNESS_HOME: envHome,
    });

    assert.equal(code, 0);
    assert.match(output, /global CLAUDE\.md +10/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(flagHome, { recursive: true, force: true });
    fs.rmSync(envHome, { recursive: true, force: true });
  }
});

// --- a flag missing its value, or immediately followed by another flag, is a usage error ---

test('main errors with usage on stderr and exits 2 when --cwd is the last argument', async () => {
  const { code, errOutput } = await runCheck(['--cwd'], { JS_HARNESS_CHECK_INNER: '1' });
  assert.equal(code, 2);
  assert.match(errOutput, /Usage: js-harness check/);
});

test('main errors with usage on stderr and exits 2 when --home is immediately followed by another flag', async () => {
  const { code, errOutput } = await runCheck(['--home', '--cwd', '/tmp'], { JS_HARNESS_CHECK_INNER: '1' });
  assert.equal(code, 2);
  assert.match(errOutput, /Usage: js-harness check/);
});

test('main runs no row when args are invalid', async () => {
  const { output } = await runCheck(['--home'], { JS_HARNESS_CHECK_INNER: '1' });
  assert.equal(output, '');
});

// --- the contracts row: static only, so the gate stays fast and never recurses into a done-when ---

const CONTRACT = [
  '# A feature', '', '## Goal', 'Ship it.', '', '## Why', 'Evidence.', '', '## Done when',
  '- `npm run check` exits 0', '', '## In scope / Out of scope', '- In: bin/', '', '## Constraints',
  '- None — because none', '', '## Effort', 'high', '', '## Ask me before', 'Spend.', '',
].join('\n');

/** `CONTRACT` with a `## Done when` that is prose only, so it fails validation. */
const BAD_CONTRACT = CONTRACT.replace('`npm run check` exits 0', 'It works');

function writeTask(dir, name, content) {
  fs.mkdirSync(path.join(dir, 'odd', 'tasks'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'odd', 'tasks', name), content);
}

test('checkContracts passes and says so when there are no contracts', () => {
  const dir = makeTmpDir();
  try {
    assert.deepEqual(checkContracts(dir), { name: 'contracts', pass: true, detail: 'no contracts under odd/tasks' });
    writeTask(dir, 'old.md', '# Old\n\n## Tasks\n- [x] T1\n'); // history, not a contract
    assert.equal(checkContracts(dir).detail, 'no contracts under odd/tasks');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkContracts passes and lists the contracts it checked', () => {
  const dir = makeTmpDir();
  try {
    writeTask(dir, 'a.md', CONTRACT);
    writeTask(dir, 'b.md', CONTRACT);
    const row = checkContracts(dir);
    assert.equal(row.pass, true);
    assert.match(row.detail, /2 contracts checked/);
    assert.deepEqual(row.lines, ['odd/tasks/a.md', 'odd/tasks/b.md']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkContracts fails naming each failing contract and its reasons', () => {
  const dir = makeTmpDir();
  try {
    writeTask(dir, 'good.md', CONTRACT);
    writeTask(dir, 'bad.md', BAD_CONTRACT.replace('high', 'low'));
    const row = checkContracts(dir);
    assert.equal(row.pass, false);
    assert.match(row.detail, /1 of 2 contracts fail/);
    assert.ok(row.lines.includes('odd/tasks/bad.md'), row.lines.join('\n'));
    assert.ok(row.lines.some((line) => /has no command/.test(line)), row.lines.join('\n'));
    assert.ok(row.lines.some((line) => /Effort/.test(line)), row.lines.join('\n'));
    assert.ok(!row.lines.some((line) => line.includes('good.md')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkContracts never runs a done-when command', () => {
  const dir = makeTmpDir();
  try {
    const marker = path.join(dir, 'ran.txt').replace(/\\/g, '/');
    const command = `node -e "require('fs').writeFileSync('${marker}', 'x')"`;
    writeTask(dir, 'a.md', CONTRACT.replace('`npm run check`', `\`${command}\``));
    assert.equal(checkContracts(dir).pass, true);
    assert.equal(fs.existsSync(marker), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main runs the contracts row, and a failing contract makes it exit 1', async () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(400));
    writeTask(dir, 'bad.md', BAD_CONTRACT);
    const { code, output } = await runCheck(['--cwd', dir], { JS_HARNESS_CHECK_INNER: '1', JS_HARNESS_HOME: dir });
    assert.equal(code, 1);
    assert.match(output, /^FAIL {2}contracts /m);
    assert.match(output, /odd\/tasks\/bad\.md/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main --push does not run the contracts row', async () => {
  const dir = makeTmpDir();
  try {
    writeTask(dir, 'bad.md', BAD_CONTRACT);
    const { output } = await runCheck(['--push', '--cwd', dir], { JS_HARNESS_CHECK_INNER: '1' });
    assert.doesNotMatch(output, /contracts/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- rules row: a project's own rules, when it keeps a list (./lib/project-rules.mjs) ---

test('main runs the rules row first, when a project keeps its own rules, and a rule that no longer holds makes it exit 1', async () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), `- Never deploy by hand.\n${'a'.repeat(400)}`);
    fs.mkdirSync(path.join(dir, 'docs'));
    const rule = { id: 'no-direct-deploy', subject: 'a deploy goes through the pipeline', since: '2026-10-14', path: 'AGENTS.md', phrases: ['Never deploy by hand'] };
    fs.writeFileSync(path.join(dir, 'docs', 'rules.json'), JSON.stringify({ format: 1, rules: [rule] }));
    const env = { JS_HARNESS_CHECK_INNER: '1', JS_HARNESS_HOME: dir };
    const namesOf = (output) => output.split('\n').filter((line) => /^(PASS|FAIL|INFO) {2}/.test(line)).map((row) => row.split('  ')[1]);

    const held = await runCheck(['--cwd', dir], env);
    assert.equal(held.code, 0);
    assert.deepEqual(namesOf(held.output).slice(0, 2), ['rules', 'budget']);
    assert.match(held.output, /^PASS {2}rules {2}1 rule of the project holds \(docs\/rules\.json\)$/m);

    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(400));
    const refused = await runCheck(['--cwd', dir], env);
    assert.equal(refused.code, 1);
    assert.match(refused.output, /^FAIL {2}rules {2}1 finding in docs\/rules\.json$/m);
    assert.match(refused.output, /^ {6}rule "no-direct-deploy": AGENTS\.md no longer holds the phrase "Never deploy by hand"$/m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main has no rules row in a project that keeps no list of its own, nor in the harness repository', async () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(400));
    const env = { JS_HARNESS_CHECK_INNER: '1', JS_HARNESS_HOME: dir };
    assert.doesNotMatch((await runCheck(['--cwd', dir], env)).output, /^(PASS|FAIL) {2}rules /m);
    fs.mkdirSync(path.join(dir, 'bin', 'lib'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'bin', 'lib', 'rules-data.mjs'), 'export const RULES = [];\n');
    fs.mkdirSync(path.join(dir, 'docs'));
    fs.writeFileSync(path.join(dir, 'docs', 'rules.json'), '{ not json');
    assert.doesNotMatch((await runCheck(['--cwd', dir], env)).output, /^(PASS|FAIL) {2}rules /m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a project list that cannot be read fails the rules row and stops nothing else from printing', async () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(400));
    fs.mkdirSync(path.join(dir, 'docs'));
    fs.writeFileSync(path.join(dir, 'docs', 'rules.json'), '﻿{ not json');
    const { code, output } = await runCheck(['--cwd', dir], { JS_HARNESS_CHECK_INNER: '1', JS_HARNESS_HOME: dir });
    assert.equal(code, 1);
    assert.match(output, /^FAIL {2}rules {2}1 finding in docs\/rules\.json$/m);
    assert.match(output, /^PASS {2}budget /m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- flaky row: the quarantine ledger, when the project keeps one (./lib/flaky.mjs) ---

test('main runs the flaky row with the static rows when the project keeps docs/FLAKY.md, and a malformed ledger makes it exit 1', async () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(400));
    fs.mkdirSync(path.join(dir, 'docs'));
    fs.mkdirSync(path.join(dir, 'bin'));
    fs.writeFileSync(path.join(dir, 'bin', 'a.test.mjs'), '');
    const env = { JS_HARNESS_CHECK_INNER: '1', JS_HARNESS_HOME: dir };
    fs.writeFileSync(path.join(dir, 'docs', 'FLAKY.md'), '### bin/a.test.mjs\n- Owner: JH 10\n- Expires: 2099-01-01\n- Failure: some-failure\n');
    const read = await runCheck(['--cwd', dir], env);
    assert.equal(read.code, 0);
    assert.match(read.output, /^PASS {2}flaky {2}docs\/FLAKY\.md quarantines 1 test file, 1 of them current; /m);

    fs.writeFileSync(path.join(dir, 'docs', 'FLAKY.md'), '### bin/a.test.mjs\n- Owner: JH 10\n');
    const refused = await runCheck(['--cwd', dir], env);
    assert.equal(refused.code, 1);
    assert.match(refused.output, /^FAIL {2}flaky {2}docs\/FLAKY\.md is not read: 2 faults to repair in that file$/m);
    assert.match(refused.output, /^ {6}bin\/a\.test\.mjs: no "- Expires:" line$/m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- failures row: the register of failures, when the project keeps one (./failures.mjs) ---

test('main runs the failures row first, before budget, when the project keeps a register, prints the entries that are not settled, and a register it cannot read makes it exit 1', async () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(400));
    fs.mkdirSync(path.join(dir, 'docs'));
    const register = (...fields) =>
      ['## Classes', '- `machine` — load', '', '## Entries', '', '### gate-at-its-bound', 'A gate reached its bound.', ...fields, ''].join('\n');
    const seen = (day) => `- Seen: ${day} — relief file, line 224 — a gate at its bound`;
    const env = { JS_HARNESS_CHECK_INNER: '1', JS_HARNESS_HOME: dir };
    const namesOf = (output) => output.split('\n').filter((line) => /^(PASS|FAIL|INFO) {2}/.test(line)).map((row) => row.split('  ')[1]);

    fs.writeFileSync(path.join(dir, 'docs', 'FAILURES.md'), register('- Class: machine', seen('2026-10-10'), seen('2026-10-11')));
    const read = await runCheck(['--cwd', dir], env);
    assert.equal(read.code, 0);
    assert.deepEqual(namesOf(read.output).slice(0, 3), ['failures', 'budget', 'contracts']);
    assert.match(read.output, /^PASS {2}failures {2}1 failure, 2 sightings, 1 seen more than once, 1 not settled; /m);
    assert.match(read.output, /^ {6}gate-at-its-bound {2}repeated {2}first seen 2026-10-10$/m);

    fs.writeFileSync(path.join(dir, 'docs', 'FAILURES.md'), register(seen('2026-10-10')));
    const refused = await runCheck(['--cwd', dir], env);
    assert.equal(refused.code, 1);
    assert.match(refused.output, /^FAIL {2}failures {2}docs\/FAILURES\.md is not read: 1 fault to repair in that file$/m);
    assert.match(refused.output, /^ {6}entry "gate-at-its-bound": has no class: /m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- review row: whether the pending change is due a gentle-ai review, informational and fail-open ---

const MODE_ON = JSON.stringify({
  schema: 'gentle-ai.review-mode/v1',
  operation: 'status',
  scope: 'both',
  status: { schema: 'gentle-ai.rdd-mode-status/v1', global: 'on', clone_local: '', effective: 'on', source: 'global' },
});
const MODE_OFF = MODE_ON.replace('"effective":"on"', '"effective":"off"').replace('"source":"global"', '"source":"clone_local"');
const assessment = (over = {}) =>
  JSON.stringify({
    schema: 'gentle-ai.review-assessment/v1',
    risk: 'medium',
    reasons: [{ code: 'executable_change', path: 'bin/check.mjs' }],
    changed_paths: 3,
    changed_lines: 442,
    candidate: { kind: 'current-changes', consumed: false },
    review_due: true,
    review_due_reason: 'slice_budget_reached',
    ...over,
  });
const ok = (stdout) => ({ status: 0, stdout, stderr: '' });
const spawnFailure = (code, message) => ({ status: null, stdout: '', stderr: '', error: Object.assign(new Error(message), { code }) });

/** A stand-in for `spawnSync` that answers `gentle-ai review mode status` and `... assess` and records calls. */
function fakeGentleAi({ mode = ok(MODE_ON), assess = ok(assessment()) } = {}) {
  const calls = [];
  const spawn = (program, args, options) => {
    calls.push({ program, args, options });
    return args.includes('assess') ? assess : mode;
  };
  return Object.assign(spawn, { calls });
}
const assessCalls = (spawn) => spawn.calls.filter((call) => call.args.includes('assess'));

test('checkReview runs mode status then assess as gentle-ai, without a shell, in cwd', () => {
  const spawn = fakeGentleAi();
  checkReview('/proj', { spawn, timeout: 1234 });
  assert.equal(spawn.calls.length, 2);
  assert.deepEqual(spawn.calls[0].args, ['review', 'mode', 'status', '--cwd', '/proj', '--json']);
  assert.deepEqual(spawn.calls[1].args, ['review', 'assess', '--cwd', '/proj', '--json']);
  for (const call of spawn.calls) {
    assert.equal(call.program, 'gentle-ai');
    assert.equal(call.options.encoding, 'utf8');
    assert.equal(call.options.timeout, 1234);
    assert.ok(!call.options.shell);
  }
});

test('checkReview says gentle-ai was not found, and assesses nothing', () => {
  const spawn = fakeGentleAi({ mode: spawnFailure('ENOENT', 'spawnSync gentle-ai ENOENT') });
  const row = checkReview('/proj', { spawn });
  assert.deepEqual([row.name, row.pass, row.info], ['review', true, true]);
  assert.match(row.detail, /gentle-ai was not found/);
  assert.match(row.detail, /not assessed/);
  assert.equal(assessCalls(spawn).length, 0);
});

// Fail-open covers a schema-tagged envelope of the wrong shape too: it must neither throw nor print
// `undefined` as if it were an assessment.
test('checkReview skips reasons that are not objects, or have no string code, instead of throwing', () => {
  const spawn = fakeGentleAi({ assess: ok(assessment({ reasons: [null, 'x', { path: 'a.mjs' }, { code: 7 }, { code: 'executable_change', path: 'a.mjs' }] })) });
  const row = checkReview('/proj', { spawn });
  assert.equal(row.pass, true);
  assert.deepEqual(row.lines.filter((line) => !line.startsWith('next:')), ['executable_change a.mjs']);
});

// gentle-ai also answers `changed_paths: 0`, high and due when it cannot build the candidate at all;
// only its explicit "no pending changes" reason means a clean tree.
test('checkReview reports an unassessable candidate as a failure, not as a clean tree', () => {
  const unassessable = assessment({
    risk: 'high',
    changed_paths: 0,
    changed_lines: 0,
    review_due_reason: 'high_risk',
    reasons: [{ code: 'unassessable', detail: 'open .git/index: Access is denied.' }],
  });
  const row = checkReview('/proj', { spawn: fakeGentleAi({ assess: { status: 1, stdout: unassessable, stderr: 'Error: denied' } }) });
  assert.equal(row.pass, true);
  assert.doesNotMatch(row.detail, /no pending change/);
  assert.match(row.detail, /could not assess/);
  assert.ok(row.lines.includes('unassessable open .git/index: Access is denied.'), row.lines.join('\n'));
});

test('checkReview reports an assessment missing its fields as having no assessment', () => {
  for (const over of [{ risk: undefined }, { changed_lines: '442' }, { review_due: 'yes' }, { review_due_reason: 3 }]) {
    const row = checkReview('/proj', { spawn: fakeGentleAi({ assess: ok(assessment(over)) }) });
    assert.equal(row.pass, true);
    assert.match(row.detail, /gave no assessment \(unexpected shape\)/, JSON.stringify(over));
  }
});

test('checkReview reports RDD off with its source and does not run assess', () => {
  const spawn = fakeGentleAi({ mode: ok(MODE_OFF) });
  const row = checkReview('/proj', { spawn });
  assert.deepEqual([row.name, row.pass, row.info], ['review', true, true]);
  assert.match(row.detail, /RDD is off \(clone_local\)/);
  assert.match(row.detail, /no review was assessed/);
  assert.equal(assessCalls(spawn).length, 0);
});

test('checkReview still assesses when the mode is unknown (non-zero exit, bad JSON or a timeout)', () => {
  const unknown = [
    { status: 1, stdout: '', stderr: 'boom' },
    ok('not json'),
    ok(JSON.stringify({ status: { effective: 'maybe' } })),
    spawnFailure('ETIMEDOUT', 'spawnSync gentle-ai ETIMEDOUT'),
  ];
  for (const mode of unknown) {
    const spawn = fakeGentleAi({ mode });
    const row = checkReview('/proj', { spawn });
    assert.equal(assessCalls(spawn).length, 1);
    assert.match(row.detail, /review due \(slice_budget_reached\)/);
  }
});

test('checkReview reports no pending change instead of the clean tree high risk', () => {
  const clean = assessment({
    risk: 'high',
    reasons: [{ code: 'unassessable', detail: 'the review assess candidate has no pending changes' }],
    changed_paths: 0,
    changed_lines: 0,
    review_due: true,
    review_due_reason: 'high_risk',
  });
  // gentle-ai exits non-zero on a clean tree but still prints the JSON.
  const row = checkReview('/proj', { spawn: fakeGentleAi({ assess: { status: 1, stdout: clean, stderr: 'Error: no pending changes' } }) });
  assert.deepEqual([row.name, row.pass, row.info], ['review', true, true]);
  assert.match(row.detail, /no pending change to assess/);
  assert.doesNotMatch(row.detail, /high|due/);
  assert.equal(row.lines, undefined);
});

test('checkReview says a due review is due, with its risk, size and reason', () => {
  const row = checkReview('/proj', { spawn: fakeGentleAi() });
  assert.equal(row.detail, 'medium risk, 3 paths, 442 lines: review due (slice_budget_reached)');
  assert.equal(row.pass, true);
  assert.equal(row.info, true);
});

test('checkReview says a review is not due, and uses the singular for one path', () => {
  const assess = ok(assessment({ changed_paths: 1, changed_lines: 1, review_due: false, review_due_reason: 'under_budget' }));
  const row = checkReview('/proj', { spawn: fakeGentleAi({ assess }) });
  assert.equal(row.detail, 'medium risk, 1 path, 1 line: review not due (under_budget)');
  assert.equal(row.lines.some((line) => line.startsWith('next:')), false);
});

test('checkReview lists each reason, and the next command only when a review is due', () => {
  const reasons = [
    { code: 'executable_change', path: 'bin/check.mjs' },
    { code: 'unassessable', detail: 'could not read a file' },
  ];
  const next_transition = { command: 'gentle-ai review status --cwd /proj --base-ref abc' };
  const due = checkReview('/proj', { spawn: fakeGentleAi({ assess: ok(assessment({ reasons, next_transition })) }) });
  assert.deepEqual(due.lines, [
    'executable_change bin/check.mjs',
    'unassessable could not read a file',
    'next: gentle-ai review status --cwd /proj --base-ref abc',
  ]);
  const notDue = checkReview('/proj', {
    spawn: fakeGentleAi({ assess: ok(assessment({ reasons, next_transition, review_due: false, review_due_reason: 'under_budget' })) }),
  });
  assert.deepEqual(notDue.lines, ['executable_change bin/check.mjs', 'unassessable could not read a file']);
  const noCommand = checkReview('/proj', { spawn: fakeGentleAi({ assess: ok(assessment({ reasons, next_transition: {} })) }) });
  assert.equal(noCommand.lines.some((line) => line.startsWith('next:')), false);
});

test('checkReview gives no assessment when assess prints nothing usable, and stays INFO and passing', () => {
  const timeout = spawnFailure('ETIMEDOUT', 'spawnSync gentle-ai ETIMEDOUT');
  const cases = [
    { status: 2, stdout: '', stderr: 'Error: something broke' },
    ok('not json'),
    ok(JSON.stringify({ schema: 'something-else/v1', risk: 'high' })),
    ok('null'),
    timeout,
    spawnFailure('EPERM', 'spawn EPERM'),
  ];
  for (const assess of cases) {
    const row = checkReview('/proj', { spawn: fakeGentleAi({ assess }) });
    assert.deepEqual([row.name, row.pass, row.info], ['review', true, true]);
    assert.match(row.detail, /^gentle-ai review assess gave no assessment \(.+\)$/);
  }
  const row = checkReview('/proj', { spawn: fakeGentleAi({ assess: timeout }) });
  assert.match(row.detail, /timed out/);
});

test('checkReview tolerates a spawn that throws', () => {
  const row = checkReview('/proj', {
    spawn: () => {
      throw new Error('kaboom');
    },
  });
  assert.deepEqual([row.name, row.pass, row.info], ['review', true, true]);
  assert.match(row.detail, /no assessment/);
});

test('main prints the review row as INFO and still exits 0 when assess says high and due', async () => {
  const dir = sensorProject({ tests: exits(0) });
  try {
    const high = assessment({ risk: 'high', review_due_reason: 'high_risk', next_transition: { command: 'gentle-ai review status --cwd x' } });
    const gentleAi = fakeGentleAi({ assess: { status: 1, stdout: high, stderr: 'Error: due' } });
    const { code, output } = await runCheck(['--cwd', dir], { JS_HARNESS_HOME: dir }, { gentleAi });
    assert.equal(code, 0, output);
    assert.match(output, /^INFO {2}review {2}high risk, 3 paths, 442 lines: review due \(high_risk\)/m);
    assert.match(output, /next: gentle-ai review status --cwd x/);
    assert.deepEqual(gentleAi.calls[0].args.slice(-3), ['--cwd', dir, '--json']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main runs the review row after the sensor rows', async () => {
  const dir = sensorProject({ tests: exits(0) });
  try {
    const { output } = await runCheck(['--cwd', dir], { JS_HARNESS_HOME: dir }, { gentleAi: fakeGentleAi() });
    const at = (text) => output.indexOf(text);
    assert.ok(at('PASS  tests') !== -1 && at('PASS  tests') < at('INFO  review'), output);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// The row itself is tested against real repositories in check-codex-reviews.test.mjs; here, where it sits.
test('main prints the codex-review row last, as information, and runs its git through deps.git', async () => {
  const dir = sensorProject({ tests: exits(0) });
  try {
    const asked = [];
    const git = (cmd, args) => {
      asked.push(`${cmd} ${args.join(' ')}`);
      return { status: 128, stdout: '', stderr: 'fatal: not a git repository' };
    };
    const { code, output } = await runCheck(['--cwd', dir], { JS_HARNESS_HOME: dir }, { gentleAi: fakeGentleAi(), git });
    assert.equal(code, 0, output);
    const rows = output.split('\n').filter((line) => /^(PASS|FAIL|INFO) {2}/.test(line));
    assert.match(rows.at(-2), /^INFO {2}review /);
    assert.match(rows.at(-1), /^INFO {2}codex-review {2}cannot tell how much code waits for a Codex review: /);
    // The questions of this row, and before them the one a gate asks of its working tree before its sensors,
    // and the names of its files, which the switches of harness.json "functions" are resolved from.
    assert.ok(asked.some((line) => line.startsWith('git rev-parse ')) && asked.every((line) => /^git (rev-parse|--no-optional-locks status|ls-files) /.test(line)), asked.join('\n'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main exits 0 with a review row when gentle-ai is missing', async () => {
  const dir = sensorProject({ tests: exits(0) });
  try {
    const { code, output } = await runCheck(['--cwd', dir], { JS_HARNESS_HOME: dir });
    assert.equal(code, 0, output);
    assert.match(output, /^INFO {2}review {2}gentle-ai was not found/m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main runs no review row when it is the inner run, or a push', async () => {
  const dir = sensorProject({ tests: exits(0) });
  try {
    const gentleAi = fakeGentleAi();
    const inner = await runCheck(['--cwd', dir], { JS_HARNESS_CHECK_INNER: '1', JS_HARNESS_HOME: dir }, { gentleAi });
    // Anchored to the row's name: the inner run does print the `codex-review` row, which asks gentle-ai nothing.
    assert.doesNotMatch(inner.output, /^(PASS|FAIL|INFO) {2}review /m);
    assert.match(inner.output, /^INFO {2}codex-review /m);
    const push = await runCheck(['--push', '--cwd', dir], { JS_HARNESS_HOME: dir }, { gentleAi });
    assert.doesNotMatch(push.output, /^(PASS|FAIL|INFO) {2}review /m);
    assert.equal(gentleAi.calls.length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- the machine's gate lock: taken around the sensors, in the home the check resolves ---
// The lock itself is tested in lib/gate-lock.test.mjs; here, what `check` does with it. Every gate of
// these tests has a temporary home, so none can take the lock of this machine's real gates.

/** What a sensor that passed answers, for a `deps.spawn` that runs none. */
const sensorRan = () => ({ status: 0, signal: null, stdout: '', stderr: '' });
const notARepository = () => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository' });
/** The `deps` of a gate whose sensors are stand-ins and which starts neither gentle-ai nor git. */
const gateDeps = (over = {}) => ({ gentleAi: gentleAiNotFound, git: notARepository, spawn: sensorRan, ...over });

/** A stand-in for `takeGateLock` that takes the lock at once and keeps what it was asked. */
function lockTakenAtOnce() {
  const take = async (options) => {
    take.asked.push(options);
    return { release: () => { take.released += 1; }, beat: () => {}, lost: () => false, waitedMs: 0 };
  };
  take.asked = [];
  take.released = 0;
  return take;
}

/** A clock a test moves, and the real lock on it: `sleep` moves the clock and waits for nothing. */
function gateClock() {
  let at = Math.floor(Date.now() / 1000) * 1000;
  const clock = {
    /** What the test does while a gate sleeps: beat a lock, release one. */
    onSleep: undefined,
    now: () => at,
    sleep: async (ms) => {
      at += ms;
      await clock.onSleep?.();
    },
    take: (options) => takeGateLock({ ...options, now: clock.now, sleep: clock.sleep, beatMs: 0 }),
  };
  return clock;
}

/** A sensor project, a home for its gate, and their removal. */
async function withGate(sensors, run) {
  const dir = sensorProject(sensors);
  const home = makeTmpDir();
  try {
    await run(dir, home);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
}

const rowsOf = (output) => output.split('\n').filter((line) => /^(PASS|FAIL|INFO) {2}/.test(line));
const gateRows = (output) => rowsOf(output).filter((line) => /^\w+ {2}gate {2}/.test(line));
const loadRows = (output) => rowsOf(output).filter((line) => /^\w+ {2}load {2}/.test(line));

test('main holds the gate lock while the sensors run and releases it after them', () => withGate({ tests: 'run-tests', lint: 'run-lint' }, async (dir, home) => {
  const during = [];
  const spawn = () => {
    during.push(readGateHolder(home));
    return sensorRan();
  };
  const { code, output, errOutput } = await runCheck(['--cwd', dir, '--home', home], {}, gateDeps({ spawn }));
  assert.equal(code, 0, output);
  assert.equal(during.length, 2);
  for (const holder of during) {
    assert.deepEqual([holder?.pid, holder?.cwd, holder?.command, holder?.stale], [process.pid, path.resolve(dir), 'check', false]);
  }
  assert.equal(readGateHolder(home), null);
  assert.equal(fs.existsSync(gateLockDir(home)), false);
  assert.equal(fs.existsSync(gateDir(home)), false, 'a gate leaves no folder of the lock behind');
  // Taken at once, the common case: the report says nothing of the lock, as before there was one.
  assert.deepEqual(gateRows(output), []);
  assert.equal(errOutput, '');
}));

test('main releases the gate lock when a sensor fails, and when one throws', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const argv = ['--cwd', dir, '--home', home];
  const failed = await runCheck(argv, {}, gateDeps({ spawn: () => ({ ...sensorRan(), status: 3 }) }));
  assert.equal(failed.code, 1);
  assert.match(failed.output, /^FAIL {2}tests {2}run-tests exited 3$/m);
  assert.equal(readGateHolder(home), null);

  let during;
  const spawn = () => {
    during = readGateHolder(home);
    throw new Error('the sensor blew up');
  };
  await assert.rejects(runCheck(argv, {}, gateDeps({ spawn })), /the sensor blew up/);
  assert.equal(during?.pid, process.pid);
  assert.equal(readGateHolder(home), null);
  assert.equal(fs.existsSync(gateLockDir(home)), false);
}));

test('main takes the gate lock in its home for an hour at most, and --wait and --no-wait change how it waits', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const take = lockTakenAtOnce();
  const run = (...flags) => runCheck(['--cwd', dir, '--home', home, ...flags], {}, gateDeps({ takeGateLock: take }));
  assert.equal((await run()).code, 0);
  assert.equal((await run('--wait', '2.5')).code, 0);
  assert.equal((await run('--no-wait')).code, 0);
  const asked = take.asked.map(({ home: where, cwd, command, wait, waitMs }) => ({ home: where, cwd, command, wait, waitMs }));
  const gate = { home, cwd: path.resolve(dir), command: 'check' };
  assert.deepEqual(asked, [
    { ...gate, wait: true, waitMs: 60 * 60_000 },
    { ...gate, wait: true, waitMs: 150_000 },
    { ...gate, wait: false, waitMs: 60 * 60_000 },
  ]);
  assert.equal(take.released, 3);
}));

test('main takes no gate lock with no sensor to run, as the inner run, or on a push', async () => {
  const take = lockTakenAtOnce();
  const deps = { gentleAi: gentleAiNotFound, git: notARepository, takeGateLock: take };
  const home = makeTmpDir();
  const projects = { none: makeTmpDir(), optedOut: sensorProject({}), broken: makeTmpDir(), sensors: sensorProject({ tests: exits(9) }) };
  try {
    fs.writeFileSync(path.join(projects.broken, 'harness.json'), '{ nope');
    for (const dir of [projects.none, projects.optedOut, projects.broken]) {
      const { output } = await runCheck(['--cwd', dir, '--home', home], {}, deps);
      assert.match(output, /^(INFO|FAIL) {2}sensors /m);
      assert.deepEqual(gateRows(output), []);
    }
    const inner = await runCheck(['--cwd', projects.sensors, '--home', home], { JS_HARNESS_CHECK_INNER: '1' }, deps);
    const push = await runCheck(['--push', '--cwd', projects.sensors, '--home', home], {}, deps);
    assert.deepEqual([...gateRows(inner.output), ...gateRows(push.output)], []);
    assert.equal(take.asked.length, 0);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'nothing of the lock was written');

    // The same stand-in is asked once there is a sensor to run, so the silence above is not its own.
    await runCheck(['--cwd', projects.sensors, '--home', home], {}, { ...deps, spawn: sensorRan });
    assert.equal(take.asked.length, 1);
  } finally {
    for (const dir of [home, ...Object.values(projects)]) fs.rmSync(dir, { recursive: true, force: true });
  }
});

// The mark of a held lock (`JS_HARNESS_GATE_HELD=1`): whoever holds the lock gives it to what it runs, so a
// gate started inside that turn (`js-harness gate -- npm run check`) does not wait for the lock its own
// parent holds, which it did for the whole of its wait before there was a mark.
test('main started with the mark of a held gate lock takes no lock and runs its sensors at once, beside the gate that holds the lock in its home', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const argv = ['--cwd', dir, '--home', home];
  const outer = await takeGateLock({ home, cwd: 'C:\\work\\outer', command: 'gate -- npm run check', pid: 4321, beatMs: 0 });
  try {
    let asked = 0;
    const take = async () => {
      asked += 1;
      throw new Error('not to be asked');
    };
    const ran = [];
    const spawn = (command, options) => {
      ran.push({ command, held: options.env.JS_HARNESS_GATE_HELD, inner: options.env.JS_HARNESS_CHECK_INNER, holder: readGateHolder(home)?.pid });
      return sensorRan();
    };
    // `--no-wait` would fail the gate at once against the held lock, were the lock asked for.
    const { code, output, errOutput } = await runCheck([...argv, '--no-wait'], { JS_HARNESS_GATE_HELD: '1' }, gateDeps({ spawn, takeGateLock: take }));
    assert.equal(code, 0, output);
    // Its sensors run, since nobody runs them for it, and they are told of the held lock in their turn.
    assert.deepEqual(ran, [{ command: 'run-tests', held: '1', inner: '1', holder: 4321 }]);
    assert.equal(asked, 0);
    assert.equal(errOutput, '');
    assert.deepEqual(gateRows(output), [
      "INFO  gate  the sensors ran in the turn of the process that started this gate, which holds the machine's gate lock (JS_HARNESS_GATE_HELD=1), so this gate took none",
    ]);
    // Not the inner run of old: every row of a gate is there.
    assert.deepEqual(rowsOf(output).map((row) => row.split('  ')[1]), ['budget', 'contracts', 'payload claude', 'payload codex', 'fixed load', 'gate', 'load', 'tests', 'review', 'codex-review']);
    assert.deepEqual(fs.readdirSync(gateDir(home)), ['lock'], 'it stood in no line');
    assert.equal(readGateHolder(home).pid, 4321);
  } finally {
    outer.release();
  }
  // Only `1` is the mark: anything else is a gate like any other.
  const take = lockTakenAtOnce();
  for (const value of ['', '0', 'true']) await runCheck(argv, { JS_HARNESS_GATE_HELD: value }, gateDeps({ takeGateLock: take }));
  assert.equal(take.asked.length, 3);
}));

test('main gives its sensors the mark of a held gate lock while it holds the lock, and to no sensor it runs without it', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const marks = [];
  const spawn = (command, options) => {
    marks.push(Object.entries(options.env).filter(([key]) => key.toLowerCase() === 'js_harness_gate_held').map(([, value]) => value));
    return sensorRan();
  };
  const argv = ['--cwd', dir, '--home', home];
  const refuses = async () => {
    throw Object.assign(new Error("EPERM: operation not permitted, mkdir 'somewhere'"), { code: 'EPERM' });
  };
  // This process may carry the mark itself, as when a gate runs this file: a sensor inherits its
  // environment, and must not inherit the mark of a lock that the gate which runs it does not hold.
  const had = process.env.JS_HARNESS_GATE_HELD;
  process.env.JS_HARNESS_GATE_HELD = '1';
  try {
    await runCheck(argv, {}, gateDeps({ spawn }));
    await runCheck(argv, {}, gateDeps({ spawn, takeGateLock: refuses }));
    // A caller that is no gate takes no lock, and holds none.
    await checkSensors(dir, { spawn });
    await checkSensor(dir, { name: 'tests', command: 'run-tests' }, { spawn });
  } finally {
    if (had === undefined) delete process.env.JS_HARNESS_GATE_HELD;
    else process.env.JS_HARNESS_GATE_HELD = had;
  }
  assert.deepEqual(marks, [['1'], [], [], []]);
}));

test('main --no-wait fails the gate row against a held lock, runs no sensor and prints the other rows', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const other = await takeGateLock({ home, cwd: 'C:\\work\\other', command: 'check', pid: 4321, beatMs: 0 });
  try {
    const { startedAt } = readGateHolder(home);
    let ran = 0;
    const spawn = () => {
      ran += 1;
      return sensorRan();
    };
    const { code, output, errOutput } = await runCheck(['--cwd', dir, '--home', home, '--no-wait'], {}, gateDeps({ spawn }));
    assert.equal(code, 1);
    assert.equal(ran, 0);
    assert.deepEqual(gateRows(output), [
      `FAIL  gate  no sensor ran: the gate of C:\\work\\other (pid 4321, started ${startedAt}) holds the machine's gate lock, and --no-wait was given`,
    ]);
    assert.deepEqual(rowsOf(output).map((row) => row.split('  ')[1]), ['budget', 'contracts', 'payload claude', 'payload codex', 'fixed load', 'gate', 'review', 'codex-review']);
    // A gate that does not wait says nothing of a wait.
    assert.equal(errOutput, '');
    assert.equal(readGateHolder(home).pid, 4321);
  } finally {
    other.release();
  }
}));

test('main waits for the gate that holds the lock, says once on stderr whose it is, and reports the time it waited', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const clock = gateClock();
  const other = await clock.take({ home, cwd: 'C:\\work\\other', command: 'check', pid: 4321 });
  const { startedAt } = readGateHolder(home, { now: clock.now });
  let sleeps = 0;
  clock.onSleep = () => {
    sleeps += 1;
    other.beat();
    if (sleeps === 3) other.release();
  };
  const timeouts = [];
  const spawn = (command, { timeout }) => {
    timeouts.push(timeout);
    return sensorRan();
  };
  const { code, output, errOutput } = await runCheck(['--cwd', dir, '--home', home], {}, gateDeps({ takeGateLock: clock.take, spawn }));
  assert.equal(code, 0, output);
  assert.equal(errOutput, `check: waiting for the gate of C:\\work\\other (pid 4321, started ${startedAt}) to finish, for 60 minutes at most\n`);
  assert.deepEqual(gateRows(output), ["INFO  gate  waited 6 s for the machine's gate lock before the sensors ran"]);
  // The lock was another gate's until a moment ago, so the load read now is the tail of that gate.
  assert.deepEqual(loadRows(output), [`${QUIET_LOAD_ROW}, right after another gate`]);
  const names = rowsOf(output).map((row) => row.split('  ')[1]);
  assert.deepEqual(names.slice(names.indexOf('gate'), names.indexOf('tests') + 1), ['gate', 'load', 'tests'], output);
  // The wait is not the sensor's time: its own bound starts when it does, whole.
  assert.deepEqual(timeouts, [SENSOR_TIMEOUT_MS]);
  assert.equal(readGateHolder(home, { now: clock.now }), null);
}));

test('main gives up when its wait is over: a FAIL gate row, no sensor run, and the holder keeps the lock', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const clock = gateClock();
  const other = await clock.take({ home, cwd: 'C:\\work\\other', command: 'check', pid: 4321 });
  const { startedAt } = readGateHolder(home, { now: clock.now });
  clock.onSleep = () => other.beat();
  let ran = 0;
  const spawn = () => {
    ran += 1;
    return sensorRan();
  };
  const { code, output, errOutput } = await runCheck(['--cwd', dir, '--home', home, '--wait', '0.5'], {}, gateDeps({ takeGateLock: clock.take, spawn }));
  assert.equal(code, 1);
  assert.equal(ran, 0);
  const holder = `the gate of C:\\work\\other (pid 4321, started ${startedAt})`;
  assert.equal(errOutput, `check: waiting for ${holder} to finish, for 0.5 minutes at most\n`);
  // What `--wait` means is said as it is since 2026-10-11: how long the lock may go without changing hands,
  // which for a holder that was there from the arrival is the whole of the wait, as before.
  assert.deepEqual(gateRows(output), [
    `FAIL  gate  no sensor ran: ${holder} still held the machine's gate lock after 30 s (--wait gives up after 0.5 minutes without the lock changing hands)`,
  ]);
  assert.equal(other.lost(), false);
  assert.equal(readGateHolder(home, { now: clock.now }).pid, 4321);
  other.release();
}));

test('main calls a holder of whom nothing is known another gate, and says when the one it waits for has gone silent', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const nobody = { token: null, pid: null, cwd: null, command: null, startedAt: null, beatAt: null, stale: false };
  const silent = { ...nobody, token: 'gone', pid: 77, beatAt: 1, stale: true };
  const take = async ({ onWait }) => {
    onWait(nobody);
    onWait(silent);
    return { refused: 'timeout', holder: nobody, waitedMs: 90_000 };
  };
  const { code, output, errOutput } = await runCheck(['--cwd', dir, '--home', home, '--wait', '1'], {}, gateDeps({ takeGateLock: take }));
  assert.equal(code, 1);
  assert.deepEqual(errOutput.split('\n'), [
    'check: waiting for another gate to finish, for 1 minute at most',
    'check: waiting for another gate (pid 77) to finish, for 1 minute at most; it has been silent for over a minute, and its lock is taken over if it stays so',
    '',
  ]);
  // The words of the bound are those of what `--wait` means since 2026-10-11 (the test above).
  assert.deepEqual(gateRows(output), ["FAIL  gate  no sensor ran: another gate still held the machine's gate lock after 1 min 30 s (--wait gives up after 1 minute without the lock changing hands)"]);
}));

test('main runs the sensors without the gate lock when it cannot be taken at all, and says so in a row', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  let ran = 0;
  const spawn = () => {
    ran += 1;
    return sensorRan();
  };
  const refuses = async () => {
    throw Object.assign(new Error("EPERM: operation not permitted, mkdir 'somewhere'"), { code: 'EPERM' });
  };
  const stood = await runCheck(['--cwd', dir, '--home', home], {}, gateDeps({ takeGateLock: refuses, spawn }));
  assert.equal(stood.code, 0, stood.output);
  assert.equal(ran, 1);
  assert.deepEqual(gateRows(stood.output), [
    "INFO  gate  the sensors ran without the machine's gate lock, which could not be taken (EPERM: operation not permitted, mkdir 'somewhere'), so another gate may have run at the same time",
  ]);

  // And with the real lock: a home that is a file can hold no lock folder. Its tries are not slept through.
  const notAFolder = path.join(home, 'a-file');
  fs.writeFileSync(notAFolder, '');
  const unslept = (options) => takeGateLock({ ...options, sleep: async () => {} });
  const real = await runCheck(['--cwd', dir, '--home', notAFolder], {}, gateDeps({ takeGateLock: unslept, spawn }));
  assert.equal(real.code, 0, real.output);
  assert.equal(ran, 2);
  assert.match(gateRows(real.output).join('\n'), /^INFO {2}gate {2}the sensors ran without the machine's gate lock, which could not be taken \(E[A-Z]+: .*\), so another gate may have run at the same time$/);
}));

test('main says in a row when the gate lock was lost while the sensors ran, and still releases it', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  let released = 0;
  const take = async () => ({ release: () => { released += 1; }, beat: () => {}, lost: () => released === 0, waitedMs: 0 });
  const { code, output } = await runCheck(['--cwd', dir, '--home', home], {}, gateDeps({ takeGateLock: take }));
  assert.equal(code, 0, output);
  assert.equal(released, 1);
  assert.deepEqual(gateRows(output), [
    "INFO  gate  the machine's gate lock was lost while the sensors ran: this gate was silent for over a minute and another took its lock, so two gates may have run at once",
  ]);
  const names = rowsOf(output).map((row) => row.split('  ')[1]);
  assert.equal(names.indexOf('tests') + 1, names.indexOf('gate'), output);
}));

// Found in review, 2026-10-10: nothing showed the holder beating while a sensor runs, which is the whole of
// the exclusion in a real gate (fifteen minutes held against a stale time of one): every test had a short
// sensor, a stand-in lock or a clock it moved. Here a real sensor, the real lock and the real clock, with
// times short enough that the sensor outlasts the stale time three times over.
// The stale time is well over a second (found in the next review: 400 ms was within reach of one stall of
// a loaded machine, which would read as a gate that stopped beating), and it is 26 beats long.
const SHORT_TIMES = { beatMs: 50, staleMs: 1300, pollMs: 40 };
/** A sensor that passes after `ms`. */
const outlasting = (ms) => `node -e "setTimeout(Object, ${ms})"`;

test('a gate keeps beating while its sensor outlasts the stale time, so no other gate is let in', () => withGate({ tests: outlasting(3 * SHORT_TIMES.staleMs) }, async (dir, home) => {
  let started = false;
  let ended = false;
  const spawn = async (command, options) => {
    started = true;
    try {
      return await runSensor(command, options);
    } finally {
      ended = true;
    }
  };
  const take = (options) => takeGateLock({ ...options, ...SHORT_TIMES });
  const checking = runCheck(['--cwd', dir, '--home', home], {}, gateDeps({ spawn, takeGateLock: take }));
  // Awaited below; until then a failure of the gate is not an unhandled one.
  checking.catch(() => {});
  await until(() => started, 'the sensor to start');
  const tries = [];
  while (!ended) {
    const other = await takeGateLock({ home, cwd: 'C:\\work\\other', command: 'check', pid: 4321, wait: false, ...SHORT_TIMES });
    other.release?.();
    // A try that ended after the sensor did met a lock the gate was free to release.
    if (!ended) tries.push({ at: Date.now(), refused: other.refused, holder: other.holder?.pid });
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const { code, output } = await checking;
  assert.equal(code, 0, output);
  assert.deepEqual(tries.filter((tried) => tried.refused !== 'held' || tried.holder !== process.pid), [], 'every other gate was refused while the sensor ran');
  // No try at all is a sensor that ended before the first one did, which proves nothing.
  const refusedFor = tries.length > 0 ? tries.at(-1).at - tries[0].at : 0;
  assert.ok(refusedFor > 2 * SHORT_TIMES.staleMs, `refused over ${refusedFor} ms, ${tries.length} times`);
  // Taken at once and never lost: the report says nothing of the lock.
  assert.deepEqual(gateRows(output), []);
  assert.equal(readGateHolder(home), null);
}));

// The same gate with no beat, so the test above is not green for another reason: once its holder's file is
// a stale time old, a gate that waits takes the lock from under the sensor, and the report says so.
test('a gate that does not beat loses its lock while its sensor runs, and its report says so', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  // A stale time of its own, short: this gate never beats, so no stall can make it lose the lock sooner
  // than it is meant to, and the wait for it is all this test costs.
  const times = { ...SHORT_TIMES, staleMs: 400 };
  let took;
  const spawn = async () => {
    const other = await takeGateLock({ home, cwd: 'C:\\work\\other', command: 'check', pid: 4321, waitMs: 30_000, ...times });
    took = other.refused === undefined;
    other.release?.();
    return sensorRan();
  };
  const take = (options) => takeGateLock({ ...options, ...times, beatMs: 0 });
  const { code, output } = await runCheck(['--cwd', dir, '--home', home], {}, gateDeps({ spawn, takeGateLock: take }));
  assert.equal(code, 0, output);
  assert.equal(took, true);
  assert.match(gateRows(output).join('\n'), /^INFO {2}gate {2}the machine's gate lock was lost while the sensors ran: /);
}));

// Found in review, 2026-10-10: no access to the lock folder made every gate wait its whole hour and then
// go red, blaming a gate that was not there. It is waited for like a gate for the stale time, and then it
// is a lock that cannot be taken: the sensors run without it and a row says why.
test('main does not wait an hour for a lock of which nothing can be read: after a minute it runs the sensors without it and says why', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const clock = gateClock();
  const other = await clock.take({ home, cwd: 'C:\\work\\other', command: 'check', pid: 4321 });
  const began = new Date(clock.now()).toISOString();
  const noAccess = new Proxy(fs, {
    get: (target, name) => {
      if (name !== 'readdirSync') return target[name];
      return (folder, ...rest) => {
        if (folder === gateLockDir(home)) throw Object.assign(new Error('EACCES: permission denied, scandir'), { code: 'EACCES' });
        return target.readdirSync(folder, ...rest);
      };
    },
  });
  let ran = 0;
  const spawn = () => {
    ran += 1;
    return sensorRan();
  };
  const take = (options) => clock.take({ ...options, fileSystem: noAccess });
  const { code, output, errOutput } = await runCheck(['--cwd', dir, '--home', home], {}, gateDeps({ takeGateLock: take, spawn }));
  assert.equal(code, 0, output);
  assert.equal(ran, 1);
  // Said as the wait begins, with the minute it is given and not the hour of the wait.
  assert.equal(errOutput, 'check: waiting for another gate to finish, for 59 s at most\n');
  assert.deepEqual(gateRows(output), [
    `INFO  gate  the sensors ran without the machine's gate lock, which could not be taken (the gate lock at ${gateLockDir(home)} could be neither taken nor read: its folder could not be listed since ${began} (EACCES)), so another gate may have run at the same time`,
  ]);
  assert.ok(clock.now() - Date.parse(began) < 62_000, 'a minute, not the hour of the wait');
  other.release();
}));

// Found in the next review, 2026-10-10: with a wait of a minute or less the end of the wait came first, and
// the same lock of which nothing could be read ended as the red row of a gate that timed out.
test('main with a wait shorter than a minute still runs the sensors without a lock of which nothing can be read, instead of failing as if a gate held it', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const clock = gateClock();
  const other = await clock.take({ home, cwd: 'C:\\work\\other', command: 'check', pid: 4321 });
  const began = new Date(clock.now()).toISOString();
  const noAccess = new Proxy(fs, {
    get: (target, name) => {
      if (name !== 'readdirSync') return target[name];
      return (folder, ...rest) => {
        if (folder === gateLockDir(home)) throw Object.assign(new Error('EACCES: permission denied, scandir'), { code: 'EACCES' });
        return target.readdirSync(folder, ...rest);
      };
    },
  });
  let ran = 0;
  const spawn = () => {
    ran += 1;
    return sensorRan();
  };
  const take = (options) => clock.take({ ...options, fileSystem: noAccess });
  const { code, output, errOutput } = await runCheck(['--cwd', dir, '--home', home, '--wait', '0.5'], {}, gateDeps({ takeGateLock: take, spawn }));
  assert.equal(code, 0, output);
  assert.equal(ran, 1);
  assert.equal(errOutput, 'check: waiting for another gate to finish, for 0.5 minutes at most\n');
  assert.deepEqual(gateRows(output), [
    `INFO  gate  the sensors ran without the machine's gate lock, which could not be taken (the gate lock at ${gateLockDir(home)} could be neither taken nor read: its folder could not be listed since ${began} (EACCES)), so another gate may have run at the same time`,
  ]);
  other.release();
}));

// Found in review, 2026-10-10: each line said the whole bound, with most of it spent by the second, so each
// came to say what was left: "for 54 s at most" with the second gate here. Since 2026-10-11 the bound counts
// from the last time the lock changed hands, and with a new holder what is left is the whole of it: that is
// what a line says now, and what this test pins. The second gate is one that stood in the line before this
// one. When the test was written it arrived last and took a free lock from under the gate that waited, which
// is what the line ends; so the first line now also counts it among the gates ahead.
test('main says the whole of its bound again with each gate it waits for, and how many gates are ahead of it when the holder is not the only one', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const clock = gateClock();
  const first = await clock.take({ home, cwd: 'C:\\work\\one', command: 'check', pid: 11 });
  // The gate of another process, in the line before this one: it stands still at its poll until the test
  // wakes it, a second before this gate arrives.
  const asleep = [];
  let next;
  takeGateLock({ home, cwd: 'C:\\work\\two', command: 'check', pid: 22, now: clock.now, sleep: () => new Promise((resolve) => asleep.push(resolve)), beatMs: 0 }).then((lock) => {
    next = lock;
  });
  await clock.sleep(1000);
  let sleeps = 0;
  clock.onSleep = async () => {
    sleeps += 1;
    first.beat();
    if (sleeps === 3) {
      first.release();
      asleep.shift()();
      await new Promise((resolve) => setImmediate(resolve));
    }
    if (sleeps === 5) next.release();
  };
  const { code, output, errOutput } = await runCheck(['--cwd', dir, '--home', home, '--wait', '1'], {}, gateDeps({ takeGateLock: clock.take }));
  assert.equal(code, 0, output);
  const said = errOutput.split('\n');
  assert.match(said[0], /^check: waiting for the gate of C:\\work\\one \(pid 11, started [^)]+\) to finish, for 1 minute at most; 2 gates are ahead of this one, that one included$/);
  assert.match(said[1], /^check: waiting for the gate of C:\\work\\two \(pid 22, started [^)]+\) to finish, for 1 minute at most$/);
  assert.deepEqual(said.slice(2), ['']);
  assert.deepEqual(gateRows(output), ["INFO  gate  waited 10 s for the machine's gate lock before the sensors ran"]);
}));

test('main errors with usage on stderr, exits 2 and runs no row for a --wait it cannot take', async () => {
  const refusals = [
    [['--wait'], '--wait requires a value'],
    [['--wait', '--no-wait'], '--wait requires a value'],
    [['--wait', 'soon'], '--wait takes a number of minutes above zero, not "soon"'],
    [['--wait', '0'], '--wait takes a number of minutes above zero, not "0"'],
    [['--wait', '-5'], '--wait takes a number of minutes above zero, not "-5"'],
    [['--wait', '1e3'], '--wait takes a number of minutes above zero, not "1e3"'],
    [['--wait', '5', '--no-wait'], '--wait and --no-wait cannot be given together'],
  ];
  for (const [argv, said] of refusals) {
    const { code, output, errOutput } = await runCheck(argv, { JS_HARNESS_CHECK_INNER: '1' });
    assert.equal(code, 2, argv.join(' '));
    assert.equal(output, '', argv.join(' '));
    assert.equal(errOutput.split('\n')[0], said);
    assert.match(errOutput, /Usage: js-harness check .*\[--wait <minutes> \| --no-wait\]/);
    // And what the two flags mean, since a bound that counts from the last change of hands is not what
    // "--wait <minutes>" says by itself.
    assert.match(errOutput, /\n {7}--wait <minutes>: how long the machine's gate lock may go without changing hands before this gate gives up on it \(60 when not given\); --no-wait: refuse at once instead of waiting\n$/);
  }
});

test('a gate under test that names no home is given a throwaway one, so it cannot wait for a real gate of this machine', () => withGate({ tests: 'run-tests' }, async (dir) => {
  const take = lockTakenAtOnce();
  const { code } = await runCheck(['--cwd', dir], {}, gateDeps({ takeGateLock: take }));
  assert.equal(code, 0);
  const [{ home }] = take.asked;
  assert.notEqual(path.resolve(home), path.resolve(os.homedir()));
  assert.ok(path.resolve(home).startsWith(path.resolve(os.tmpdir())), `home was ${home}`);
  assert.equal(fs.existsSync(home), false, 'the throwaway home is removed afterwards');
}));

// The real thing between two real processes: `node bin/check.mjs` twice, on two folders that share one
// home. A sensor writes when it goes in, holds until the test lets it go, and writes when it comes out.
//
// The test waits a minute for each of two things before it lets the sensors go (`until`), so a sensor
// gives up only after five: well past both. With the same minute for the sensor as for the test, the first
// sensor of a slow machine would come out by itself as the test's own wait ran out, and the test would
// fail on the log, not on what it had waited for (found in review, 2026-10-10). A sensor that a failed
// run leaves behind ends when the test removes the home its log is in, not at its give-up.
const UNTIL_MS = 60_000;
const SENSOR_GIVES_UP_MS = 5 * UNTIL_MS;
const SENSOR = `
const fs = require('fs');
const [log, go, name] = process.argv.slice(2);
fs.appendFileSync(log, 'in ' + name + '\\n');
const giveUpAt = Date.now() + ${SENSOR_GIVES_UP_MS};
const timer = setInterval(() => {
  if (!fs.existsSync(go) && fs.existsSync(log) && Date.now() < giveUpAt) return;
  clearInterval(timer);
  fs.appendFileSync(log, 'out ' + name + '\\n');
}, 20);
`;

/** Resolves once `condition()` holds, looking every 20 ms; rejects, naming `what`, after `ms`. */
async function until(condition, what, ms = UNTIL_MS) {
  const giveUpAt = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > giveUpAt) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** One `node <check> --cwd <dir> --home <home>`: `stderr()` is what it has said so far, `done` how it ended. */
function startCheck(check, dir, home, env) {
  const child = spawnChild(process.execPath, [check, '--cwd', dir, '--home', home], { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const said = { stdout: '', stderr: '' };
  for (const stream of ['stdout', 'stderr']) {
    child[stream].setEncoding('utf8');
    child[stream].on('data', (chunk) => {
      said[stream] += chunk;
    });
  }
  const done = new Promise((resolve) => {
    child.on('close', (status) => resolve({ status, ...said }));
  });
  return { child, done, stderr: () => said.stderr };
}

test('two check processes that share a home run their sensors one after the other, and the second says whose gate it waits for', async () => {
  const home = makeTmpDir();
  const slashes = (file) => file.replace(/\\/g, '/');
  const log = slashes(path.join(home, 'sensors.log'));
  const go = slashes(path.join(home, 'go'));
  const readLog = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '');
  const [one, two] = ['one', 'two'].map((name) => {
    // The sensor names node by its path, since these gates are given a PATH with no program on it.
    const dir = sensorProject({ tests: `"${process.execPath}" sensor.cjs "${log}" "${go}" ${name}` });
    fs.writeFileSync(path.join(dir, 'sensor.cjs'), SENSOR);
    return dir;
  });
  // The mark of a gate that runs this file would make these two inner checks, which run no sensor, and
  // the mark of its held lock would make them gates that take none. No gentle-ai and no git either: an
  // empty PATH leaves both rows saying they found none. And no sample of the load, which no stand-in
  // reaches in a process of its own: a second each, of a machine this suite itself keeps busy. The switch
  // of the gate log is dropped: a gate that runs this file with its log off would keep these two from
  // writing the log this test reads.
  const noPrograms = path.join(home, 'no-programs');
  fs.mkdirSync(noPrograms);
  const dropped = ['js_harness_check_inner', 'js_harness_gate_held', 'js_harness_gate_log', 'node_test_context', 'path'];
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !dropped.includes(key.toLowerCase()))), PATH: noPrograms, JS_HARNESS_GATE_LOAD: 'off' };
  // They run a copy of `bin/` in a temporary folder. Started from this checkout's own `bin/check.mjs`,
  // they would read on the session board as two gates of this worktree at once, at every run of the suite
  // (`watchedGates` in lib/sessions.mjs leaves out a gate whose folder is no worktree of the project).
  const checkout = makeTmpDir();
  fs.cpSync(path.dirname(fileURLToPath(import.meta.url)), path.join(checkout, 'bin'), { recursive: true, filter: (source) => !source.endsWith('.test.mjs') });
  const check = path.join(checkout, 'bin', 'check.mjs');
  const started = [];
  try {
    const first = startCheck(check, one, home, env);
    started.push(first);
    await until(() => readLog() === 'in one\n', 'the first gate to start its sensor');
    const second = startCheck(check, two, home, env);
    started.push(second);
    await until(() => second.stderr().includes('at most') || readLog() !== 'in one\n', 'the second gate to say it waits');
    assert.equal(readLog(), 'in one\n', 'the second gate started its sensor while the first ran its own');
    fs.writeFileSync(go, '');
    const [a, b] = await Promise.all([first.done, second.done]);

    assert.equal(a.status, 0, `${a.stdout}${a.stderr}`);
    assert.equal(b.status, 0, `${b.stdout}${b.stderr}`);
    assert.equal(readLog(), 'in one\nout one\nin two\nout two\n');
    assert.equal(a.stderr, '');
    assert.deepEqual(gateRows(a.stdout), []);
    // The switch reached both processes: neither sampled the load, the one that waited included.
    assert.deepEqual([loadRows(a.stdout.replace(/\r\n/g, '\n')), loadRows(b.stdout.replace(/\r\n/g, '\n'))], [[], []]);
    const said = b.stderr.replace(/\r\n/g, '\n');
    assert.ok(said.startsWith(`check: waiting for the gate of ${path.resolve(one)} (pid ${first.child.pid}, started `), said);
    // The whole bound, or what is left of it on a machine so slow that a second of it was spent by then.
    assert.match(said, /\) to finish, for (60 minutes|59 min \d+ s) at most\n$/);
    assert.match(gateRows(b.stdout.replace(/\r\n/g, '\n')).join('\n'), /^INFO {2}gate {2}waited \d+ s for the machine's gate lock before the sensors ran$/);
    assert.match(b.stdout, /^INFO {2}review {2}gentle-ai was not found/m);
    assert.equal(fs.existsSync(gateLockDir(home)), false);

    // The log of the home they share says the same of the two, each in its own two lines of the real
    // file: who ran, who waited for whom, and that the first had ended when the second began.
    const { events, skipped } = readGateLog(home);
    assert.deepEqual([events.length, skipped], [4, 0]);
    const [ran, waited] = gatesOf(events);
    assert.deepEqual([ran, waited].map(({ start, end }) => [start.cwd, start.pid, start.command, start.lock, end.result, end.sensors.map(({ name, pass, timedOut }) => ({ name, pass, timedOut }))]), [
      [path.resolve(one), first.child.pid, 'check', 'own', 'pass', [{ name: 'tests', pass: true, timedOut: false }]],
      [path.resolve(two), second.child.pid, 'check', 'own', 'pass', [{ name: 'tests', pass: true, timedOut: false }]],
    ]);
    assert.deepEqual([ran.start.waitedFor, waited.start.waitedFor], [[], [{ cwd: path.resolve(one), pid: first.child.pid, command: 'check' }]]);
    assert.ok(waited.start.waitedSeconds > 0, JSON.stringify(waited.start));
    assert.ok(ran.end.at <= waited.start.at, `${ran.end.at} ${waited.start.at}`);
    // No load in either start: these processes were started with the sample switched off.
    assert.deepEqual([ran.start.load, waited.start.load], [undefined, undefined]);
  } finally {
    // Lets a sensor that is still holding go, should the test have failed before it did.
    fs.writeFileSync(go, '');
    for (const { child } of started) child.kill();
    for (const dir of [one, two, home, checkout]) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // a sensor of a failed run may still hold it for a moment
      }
    }
  }
});

// --- documents: a commit whose every staged path is a declared document runs no sensor ---
// Half of this repository's commits change documents only, and each paid a whole run of the tests that it
// could not turn red. A project declares its documents in harness.json `documents`; without the key
// nothing changes, and the static rows (budget, contracts) run either way.

test('discoverDocuments reads harness.json documents, and a project without the key declares none', () => {
  const dir = makeTmpDir();
  try {
    assert.deepEqual(discoverDocuments(dir), { documents: [], source: null });
    writeJson(dir, 'harness.json', { sensors: { tests: 'pytest' } });
    assert.deepEqual(discoverDocuments(dir), { documents: [], source: null });
    const documents = ['docs/', 'odd/tasks/', 'README.md', 'notes/2026 plan.md', '.github/'];
    writeJson(dir, 'harness.json', { documents });
    assert.deepEqual(discoverDocuments(dir), { documents, source: 'harness.json' });
    writeJson(dir, 'harness.json', { documents: [] });
    assert.deepEqual(discoverDocuments(dir), { documents: [], source: 'harness.json' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('discoverDocuments reports a documents value of the wrong shape, and each path it does not take, instead of skipping it', () => {
  const dir = makeTmpDir();
  const refused = [
    ['it is not an array', 'docs/', { docs: true }, null],
    ['is not a non-empty string', [3], [''], [['docs/']], [null]],
    ['is an absolute path', ['/'], ['/docs/'], ['C:/docs/'], ['c:docs/']],
    ['is written with a backslash', ['docs\\'], ['docs\\guide.md'], ['C:\\docs']],
    ['has an empty, "." or ".." segment', ['.'], ['./'], ['./docs/'], ['docs/./guide.md'], ['..'], ['../docs/'], ['docs/../src/'], ['docs//guide.md'], ['docs//']],
    ['is a pattern, and none is taken', ['*'], ['docs/*.md'], ['**/']],
    // One entry that is not taken among others that are: the whole declaration is refused.
    ['is a pattern, and none is taken', ['docs/', '*.md', 'odd/tasks/']],
  ];
  try {
    for (const [why, ...values] of refused) {
      for (const documents of values) {
        writeJson(dir, 'harness.json', { documents, sensors: { tests: 'pytest' } });
        const found = discoverDocuments(dir);
        assert.match(found.error ?? '', /^harness\.json "documents" must be an array of paths /, JSON.stringify(documents));
        assert.ok(found.error.endsWith(why), `${JSON.stringify(documents)}: ${found.error}`);
        assert.deepEqual([found.documents, found.source], [[], null], JSON.stringify(documents));
      }
    }
    // The entry is named as JSON, so what a file holds reaches the report escaped.
    writeJson(dir, 'harness.json', { documents: ['docs/', 'a\u001b[2J*'] });
    assert.ok(discoverDocuments(dir).error.includes('; "a\\u001b[2J*" is a pattern'), discoverDocuments(dir).error);

    fs.writeFileSync(path.join(dir, 'harness.json'), '{ nope');
    assert.match(discoverDocuments(dir).error, /harness\.json is not valid JSON/);
    writeJson(dir, 'harness.json', [{ documents: ['docs/'] }]);
    assert.equal(discoverDocuments(dir).error, 'harness.json must be a JSON object');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// A harness.json may hold `documents` and nothing else: the sensors stay the scripts of package.json, in
// the shape `discoverSensors` always answered.
test('discoverSensors is as it was beside a documents key: package.json still declares the sensors', () => {
  const dir = makeTmpDir();
  try {
    writeJson(dir, 'harness.json', { documents: ['docs/', 'odd/tasks/'] });
    writeJson(dir, 'package.json', { scripts: { test: 'node --test' } });
    assert.deepEqual(discoverSensors(dir), { sensors: [{ name: 'tests', command: 'npm run test' }], source: 'package.json' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** A stand-in for the git a gate asks what is staged: `paths` staged, in a folder that is `prefix` below
 * the top of its repository. It keeps what it was asked. */
function stagedGit(paths, prefix = '') {
  const spawn = (program, args) => {
    spawn.asked.push(`${program} ${args.join(' ')}`);
    return ok(args[0] === 'rev-parse' ? `${prefix}\n` : paths.map((file) => `${file}\0`).join(''));
  };
  spawn.asked = [];
  return spawn;
}

/** A stand-in for `runSensor` that passes and counts the sensors it was asked to run. */
function countedSensors() {
  const spawn = () => {
    spawn.ran += 1;
    return sensorRan();
  };
  spawn.ran = 0;
  return spawn;
}

test('checkSensors turns a documents value it does not take into one FAIL row named sensors, runs no sensor and asks git nothing', async () => {
  const dir = makeTmpDir();
  try {
    // With sensors, with a declared absence of them, and with none declared anywhere.
    for (const sensors of [{ tests: 'run-tests' }, {}, undefined]) {
      writeJson(dir, 'harness.json', { documents: ['docs/*'], ...(sensors && { sensors }) });
      const spawn = countedSensors();
      const git = stagedGit(['docs/guide.md']);
      const rows = await checkSensors(dir, { spawn, git });
      assert.deepEqual(rows.map((row) => [row.name, row.pass, row.info]), [['sensors', false, undefined]], JSON.stringify(sensors));
      assert.match(rows[0].detail, /^harness\.json "documents" must be .*; "docs\/\*" is a pattern, and none is taken$/);
      assert.deepEqual([spawn.ran, git.asked], [0, []]);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkSensors asks git what is staged only where documents are declared and there is a sensor to skip', async () => {
  const dir = makeTmpDir();
  try {
    const asked = async (harness) => {
      writeJson(dir, 'harness.json', harness);
      const git = stagedGit(['docs/guide.md']);
      await checkSensors(dir, { spawn: countedSensors(), git });
      return git.asked;
    };
    assert.deepEqual(await asked({ sensors: { tests: 'run-tests' } }), []);
    assert.deepEqual(await asked({ sensors: { tests: 'run-tests' }, documents: [] }), []);
    assert.deepEqual(await asked({ sensors: {}, documents: ['docs/'] }), []);
    // Renames off, so a file moved out of the documents or into them is listed on both sides; paths from
    // the top of the repository whatever `diff.relative` says, and ended by a NUL, so none is quoted.
    assert.deepEqual(await asked({ sensors: { tests: 'run-tests' }, documents: ['docs/'] }), [
      'git rev-parse --show-prefix',
      'git diff --cached --name-only --no-renames --no-relative --ignore-submodules=none -z',
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkSensors runs the sensors when git cannot say what is staged, and adds no row for it', async () => {
  const dir = makeTmpDir();
  try {
    writeJson(dir, 'harness.json', { sensors: { tests: 'run-tests' }, documents: ['docs/'] });
    const enoent = () => Object.assign(new Error('spawnSync git ENOENT'), { code: 'ENOENT' });
    const gits = {
      'no repository': notARepository,
      'no git': () => ({ status: null, stdout: '', stderr: '', error: enoent() }),
      'a git that throws': () => {
        throw enoent();
      },
      'no answer': () => undefined,
      'a listing that fails': (_program, args) => (args[0] === 'rev-parse' ? ok('\n') : { status: 129, stdout: 'docs/guide.md\0', stderr: 'usage: git diff' }),
      'nothing staged': stagedGit([]),
      // Documents are named from the top of the repository, and this gate checks a folder below it.
      'a folder below the top': stagedGit(['docs/guide.md'], 'packages/app/'),
    };
    for (const [name, git] of Object.entries(gits)) {
      const spawn = countedSensors();
      const rows = await checkSensors(dir, { spawn, git });
      assert.deepEqual(rows.map((row) => [row.name, row.pass]), [['tests', true]], name);
      assert.equal(spawn.ran, 1, name);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkSensors takes a staged path as a document only when an entry names it whole, or a folder above it', async () => {
  const dir = makeTmpDir();
  try {
    writeJson(dir, 'harness.json', { sensors: { tests: 'run-tests', lint: 'run-lint' }, documents: ['docs/', 'notes.md', 'odd/tasks/'] });
    const ran = async (...paths) => {
      const spawn = countedSensors();
      const rows = await checkSensors(dir, { spawn, git: stagedGit(paths) });
      assert.equal(rows.length, spawn.ran === 0 ? 1 : 2, JSON.stringify(rows));
      return spawn.ran;
    };
    for (const document of ['docs/guide.md', 'docs/deep/er/x.png', 'notes.md', 'odd/tasks/gate-lock.md', 'docs/ notes.md']) {
      assert.equal(await ran(document), 0, document);
    }
    const others = [
      'docs', 'docs-internal/x.md', 'docsx', 'Docs/guide.md', 'src/docs/guide.md', ' docs/guide.md',
      'notes.md.bak', 'notes.md/x', 'old/notes.md', 'odd/tasks.md', 'odd/task/x.md', 'harness.json', 'AGENTS.md',
    ];
    for (const other of others) {
      assert.equal(await ran(other), 2, JSON.stringify(other));
      assert.equal(await ran('docs/guide.md', other, 'notes.md'), 2, `${JSON.stringify(other)} among documents`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkSensors says in one INFO row which sensors did not run and for which staged documents, the first ten of many', async () => {
  const dir = makeTmpDir();
  try {
    writeJson(dir, 'harness.json', { sensors: { tests: 'run-tests', lint: 'run-lint' }, documents: ['docs/'] });
    const row = async (paths) => {
      const rows = await checkSensors(dir, { spawn: countedSensors(), git: stagedGit(paths) });
      assert.equal(rows.length, 1);
      return rows[0];
    };
    assert.deepEqual(await row(['docs/guide.md']), {
      name: 'sensors',
      pass: true,
      info: true,
      detail: 'no sensor ran (tests, lint): the one staged path is a document declared in harness.json "documents"',
      lines: ['docs/guide.md'],
    });
    const many = Array.from({ length: 13 }, (_, at) => `docs/${String(at + 1).padStart(2, '0')}.md`);
    const said = await row(many);
    assert.equal(said.detail, 'no sensor ran (tests, lint): all 13 staged paths are documents declared in harness.json "documents"');
    assert.deepEqual(said.lines, [...many.slice(0, 10), 'and 3 more']);
    assert.deepEqual((await row(many.slice(0, 11))).lines, [...many.slice(0, 10), 'and 1 more']);
    assert.deepEqual((await row(many.slice(0, 10))).lines, many.slice(0, 10));
    // A name that would break the report's lines, or drive the terminal, is shown as JSON.
    assert.deepEqual((await row(['docs/a\nFAIL  tests  x', 'docs/b\u001b[2J.md', 'docs/ñ ok.md'])).lines, ['"docs/a\\nFAIL  tests  x"', '"docs/b\\u001b[2J.md"', 'docs/ñ ok.md']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a gate that runs no sensor for staged documents takes no gate lock, with the mark of a held one or without, and the inner run is as it was', async () => {
  const dir = sensorProject({ tests: 'run-tests' });
  const home = makeTmpDir();
  try {
    writeJson(dir, 'harness.json', { sensors: { tests: 'run-tests' }, documents: ['docs/'] });
    const take = lockTakenAtOnce();
    const spawn = countedSensors();
    const run = (env, git = stagedGit(['docs/guide.md'])) => runCheck(['--cwd', dir, '--home', home], env, gateDeps({ spawn, git, takeGateLock: take }));
    for (const env of [{}, { JS_HARNESS_GATE_HELD: '1' }]) {
      const { code, output } = await run(env);
      assert.equal(code, 0, output);
      assert.match(output, /^INFO {2}sensors {2}no sensor ran \(tests\): the one staged path is a document declared in harness\.json "documents"\n {6}docs\/guide\.md$/m);
      assert.deepEqual(gateRows(output), []);
      assert.doesNotMatch(output, /^\w+ {2}tests /m);
    }
    assert.deepEqual([spawn.ran, take.asked.length], [0, 0]);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'nothing of the lock was written');

    // A gate's sensor runs the inner check, which never ran a sensor and so has none to skip.
    const git = stagedGit(['docs/guide.md']);
    const inner = await run({ JS_HARNESS_CHECK_INNER: '1' }, git);
    assert.doesNotMatch(inner.output, /^\w+ {2}(sensors|tests) /m);
    assert.deepEqual(git.asked.filter((line) => line.startsWith('git diff ')), []);

    // The same stand-ins run the sensor once a path that is no document is staged.
    const code = await run({}, stagedGit(['docs/guide.md', 'src/app.js']));
    assert.match(code.output, /^PASS {2}tests /m);
    assert.deepEqual([spawn.ran, take.asked.length], [1, 1]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- the sensors of documents: what a commit of documents alone still runs ---
// A commit of documents runs none of the project's sensors, and a document may be what a check reads: a
// rule kept in one, a text a test holds to a figure. `harness.json` `documentSensors` are the checks of
// seconds that run there, with no gate lock taken.

/** A stand-in for `runSensor` that records each command it was asked to run, the time it was given and
 * whether it was given the mark of a held lock, and answers what `results` says for that command, a pass
 * when it says nothing. */
function recordedSensors(results = {}) {
  const spawn = (command, { timeout, env }) => {
    spawn.ran.push([command, timeout, env.JS_HARNESS_GATE_HELD ?? null]);
    return results[command] ?? sensorRan();
  };
  spawn.ran = [];
  return spawn;
}

const DOCUMENT_SENSORS_SHAPE = 'harness.json "documentSensors" must be an object of names to non-empty command strings';

test("a commit of documents alone runs the sensors of documents, in their order and with a bound of two minutes, and none of the project's sensors", async () => {
  const dir = makeTmpDir();
  try {
    writeJson(dir, 'harness.json', { sensors: { tests: 'run-tests', lint: 'run-lint' }, documents: ['docs/'], documentSensors: { rules: 'check-rules', texts: 'check-texts' } });
    const spawn = recordedSensors();
    const rows = await checkSensors(dir, { spawn, git: stagedGit(['docs/guide.md', 'docs/b.md']) });
    assert.equal(DOCUMENT_SENSOR_TIMEOUT_MS, 120_000);
    assert.deepEqual(spawn.ran, [['check-rules', 120_000, null], ['check-texts', 120_000, null]]);
    assert.deepEqual(rows.map(({ name, pass, info }) => [name, pass, info === true]), [['sensors', true, true], ['rules', true, false], ['texts', true, false]]);
    assert.equal(rows[0].detail, 'the sensors did not run (tests, lint): all 2 staged paths are documents declared in harness.json "documents"; its "documentSensors" ran in their place (rules, texts), with no gate lock taken');
    assert.deepEqual(rows[0].lines, ['docs/guide.md', 'docs/b.md']);
    assert.equal(rows[1].detail, 'check-rules passed');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Codex, 2026-10-14: with nothing staged there is no commit to guard, and a check run by hand on a branch
// whose commits differ from the trunk in documents alone must still run its sensors over the code edits it
// has not staged. The other side is asked only of an index that holds a change.
test('a check with nothing staged runs the sensors even where the branch differs from the trunk in documents alone', async () => {
  const dir = makeTmpDir();
  try {
    writeJson(dir, 'harness.json', { sensors: { tests: 'run-tests' }, documents: ['docs/'] });
    const git = (program, args) => {
      git.asked.push(args.join(' '));
      if (args[0] === 'rev-parse') return ok(args.includes('--show-prefix') ? '\n' : 'abc123\n');
      // Nothing staged against its own branch; against the trunk, documents alone.
      return ok(args.at(-1) === '-z' ? '' : 'docs/guide.md\0');
    };
    git.asked = [];
    const spawn = recordedSensors();
    await checkSensors(dir, { spawn, git });
    assert.deepEqual(spawn.ran.map(([command]) => command), ['run-tests']);
    assert.ok(!git.asked.some((asked) => asked.startsWith('diff') && asked.endsWith('origin/HEAD')), JSON.stringify(git.asked));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a commit that holds anything that is no document runs the project's sensors and none of the sensors of documents", async () => {
  const dir = makeTmpDir();
  try {
    writeJson(dir, 'harness.json', { sensors: { tests: 'run-tests' }, documents: ['docs/'], documentSensors: { rules: 'check-rules' } });
    const spawn = recordedSensors();
    const rows = await checkSensors(dir, { spawn, git: stagedGit(['docs/guide.md', 'src/app.js']) });
    assert.deepEqual(spawn.ran.map(([command]) => command), ['run-tests']);
    assert.deepEqual(rows.map((row) => row.name), ['tests']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a sensor of documents that fails fails the commit and says what it printed, the one after it still runs, and no gate lock or gate log is written', async () => {
  const dir = sensorProject({ tests: 'run-tests' });
  const home = makeTmpDir();
  try {
    writeJson(dir, 'harness.json', { sensors: { tests: 'run-tests' }, documents: ['docs/'], documentSensors: { rules: 'check-rules', texts: 'check-texts' } });
    const take = lockTakenAtOnce();
    const spawn = recordedSensors({ 'check-rules': { status: 3, signal: null, stdout: 'rule 7 is broken\n', stderr: '' } });
    const run = (env) => runCheck(['--cwd', dir, '--home', home], env, gateDeps({ spawn, git: stagedGit(['docs/guide.md']), takeGateLock: take }));
    const { code, output } = await run({});
    assert.equal(code, 1, output);
    assert.match(output, /^INFO {2}sensors {2}the sensors did not run \(tests\): the one staged path is a document declared in harness\.json "documents"; its "documentSensors" ran in their place \(rules, texts\), with no gate lock taken\n {6}docs\/guide\.md$/m);
    assert.match(output, /^FAIL {2}rules {2}check-rules exited 3$/m);
    assert.match(output, /^PASS {2}texts {2}check-texts passed$/m);
    assert.match(output, /\nrule 7 is broken\n/);
    assert.deepEqual(gateRows(output), []);
    assert.doesNotMatch(output, /^\w+ {2}(tests|load) /m);
    // A gate started in a turn of the lock says so to the sensors of documents as to any sensor; another never does.
    await run({ JS_HARNESS_GATE_HELD: '1' });
    assert.deepEqual(spawn.ran, [['check-rules', 120_000, null], ['check-texts', 120_000, null], ['check-rules', 120_000, '1'], ['check-texts', 120_000, '1']]);
    assert.equal(take.asked.length, 0);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'nothing of the lock or of the gate log was written');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a gate whose static row failed still runs the sensors of documents: there is no wait and no suite for the stop to save', async () => {
  const dir = makeTmpDir();
  const home = makeTmpDir();
  try {
    writeJson(dir, 'harness.json', { sensors: { tests: 'run-tests' }, documents: ['docs/'], documentSensors: { rules: 'check-rules' } });
    const take = lockTakenAtOnce();
    const spawn = recordedSensors();
    const lock = { home, wait: true, waitMinutes: 1, session: null, stoppedBy: ['budget'] };
    const rows = await checkSensors(dir, { spawn, git: stagedGit(['docs/guide.md']), takeGateLock: take }, lock);
    assert.deepEqual(rows.map((row) => row.name), ['sensors', 'rules']);
    assert.deepEqual([spawn.ran.length, take.asked.length], [1, 0]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a sensor of documents whose time ran out fails and says where a longer check belongs, and a shorter time of the caller is kept', async () => {
  const dir = makeTmpDir();
  try {
    writeJson(dir, 'harness.json', { sensors: { tests: 'run-tests' }, documents: ['docs/'], documentSensors: { rules: 'check-rules' } });
    const given = [];
    const spawn = (command, { timeout }) => {
      given.push(timeout);
      return { error: Object.assign(new Error('spawnSync ETIMEDOUT'), { code: 'ETIMEDOUT' }), status: null, signal: 'SIGTERM', stdout: '', stderr: '' };
    };
    const ran = (sensorTimeout) => checkSensors(dir, { spawn, git: stagedGit(['docs/guide.md']), ...(sensorTimeout && { sensorTimeout }) });
    const [, row] = await ran();
    assert.deepEqual([row.name, row.pass, row.timedOut], ['rules', false, true]);
    assert.equal(row.detail, 'check-rules timed out after 120 s; a sensor of documents runs with no gate lock taken, so it is a check of seconds: a longer one belongs in "sensors"');
    await ran(500);
    await ran(10 * 60 * 1000);
    assert.deepEqual(given, [120_000, 500, 120_000]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a declaration of sensors of documents that cannot be taken fails the gate and runs nothing; an empty one declares none', async () => {
  const dir = makeTmpDir();
  try {
    const neverRun = 'harness.json declares "documentSensors" and no "documents", so no commit would ever run them';
    const faulty = [
      [{ documents: ['docs/'], documentSensors: ['check-rules'] }, DOCUMENT_SENSORS_SHAPE],
      [{ documents: ['docs/'], documentSensors: { rules: '' } }, DOCUMENT_SENSORS_SHAPE],
      [{ documents: ['docs/'], documentSensors: { rules: 3 } }, DOCUMENT_SENSORS_SHAPE],
      [{ documents: ['docs/'], documentSensors: null }, DOCUMENT_SENSORS_SHAPE],
      [{ documentSensors: { rules: 'check-rules' } }, neverRun],
      [{ documents: [], documentSensors: { rules: 'check-rules' } }, neverRun],
    ];
    for (const [harness, said] of faulty) {
      writeJson(dir, 'harness.json', { sensors: { tests: 'run-tests' }, ...harness });
      const spawn = countedSensors();
      assert.deepEqual(await checkSensors(dir, { spawn, git: stagedGit(['src/app.js']) }), [{ name: 'sensors', pass: false, detail: said }], JSON.stringify(harness));
      assert.equal(spawn.ran, 0);
      assert.deepEqual(discoverDocumentSensors(dir, harness.documents ?? []), { sensors: [], error: said });
    }
    // An empty map declares none: the commit of documents is the one row it always was.
    writeJson(dir, 'harness.json', { sensors: { tests: 'run-tests' }, documents: ['docs/'], documentSensors: {} });
    const spawn = countedSensors();
    const rows = await checkSensors(dir, { spawn, git: stagedGit(['docs/guide.md']) });
    assert.deepEqual(rows.map((row) => row.detail), ['no sensor ran (tests): the one staged path is a document declared in harness.json "documents"']);
    assert.equal(spawn.ran, 0);
    assert.deepEqual(discoverDocumentSensors(dir, ['docs/']), { sensors: [] });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a project that declares no sensor runs its sensors of documents at a commit of documents, and nothing at any other', async () => {
  const dir = makeTmpDir();
  try {
    writeJson(dir, 'harness.json', { sensors: {}, documents: ['docs/'], documentSensors: { rules: 'check-rules' } });
    const spawn = recordedSensors();
    const documents = await checkSensors(dir, { spawn, git: stagedGit(['docs/guide.md']) });
    assert.deepEqual(documents.map((row) => row.name), ['sensors', 'rules']);
    assert.equal(documents[0].detail, 'the one staged path is a document declared in harness.json "documents": its "documentSensors" ran (rules), with no gate lock taken');
    const other = await checkSensors(dir, { spawn, git: stagedGit(['src/app.js']) });
    assert.deepEqual(other, [{ name: 'sensors', pass: true, info: true, detail: 'harness.json declares no sensors, so none ran' }]);
    assert.deepEqual(spawn.ran.map(([command]) => command), ['check-rules']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("this repository's sensors of documents name the two test files that read its documents, and the rules check", () => {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const { sensors, error } = discoverDocumentSensors(root, discoverDocuments(root).documents);
  assert.equal(error, undefined);
  const commands = sensors.map((sensor) => sensor.command).join('\n');
  // Found on 2026-10-12 by a search of every test file for a read of `docs/` or `odd/tasks/` of the
  // repository itself: these two, and the rules a document declares.
  for (const file of ['bin/rules.test.mjs', 'bin/sessions.test.mjs']) {
    assert.ok(commands.includes(file), `${file} is run by no sensor of documents`);
    assert.ok(fs.existsSync(path.join(root, file)), `${file} is not there`);
  }
  assert.match(commands, /js-harness\.mjs rules check/);
});

// --- an argument check does not know ---

test('check refuses an argument it does not know: exit 2 with the usage, no row computed and no gate started', async () => {
  const dir = sensorProject({ tests: 'run-tests' });
  const home = makeTmpDir();
  try {
    const spawn = countedSensors();
    const take = lockTakenAtOnce();
    const run = (argv) => runCheck(argv, {}, gateDeps({ spawn, takeGateLock: take }));
    const unknown = [
      [['--help'], '--help'],
      [['-h'], '-h'],
      [['help'], 'help'],
      [['--pus'], '--pus'],
      [['--cwd', dir, '--home', home, '--verbose'], '--verbose'],
      [['--push', 'origin'], 'origin'],
      [['--no-wait', '--cwd', dir, 'now'], 'now'],
    ];
    for (const [argv, token] of unknown) {
      const { code, output, errOutput } = await run(argv);
      assert.equal(code, 2, argv.join(' '));
      assert.ok(errOutput.startsWith(`unknown argument: ${token}\n\nUsage: js-harness check`), errOutput);
      assert.equal(output, '');
    }
    assert.deepEqual([spawn.ran, take.asked.length], [0, 0]);
    // Every flag it knows is taken as it was, a value that looks like nothing it knows included.
    const known = await run(['--cwd', dir, '--home', home, '--remote', 'upstream', '--head', 'help', '--wait', '5']);
    assert.notEqual(known.code, 2, known.errOutput);
    assert.match(known.output, /^PASS {2}tests /m);
    assert.deepEqual([spawn.ran, take.asked.length], [1, 1]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- the load a gate starts under: one sample before the first sensor, said in a row named `load` ---
// The sample itself is tested in lib/machine-load.test.mjs; here, when a gate takes one and what it says
// of it. Every sampler is a stand-in that answers at once, but for the last test of this part.

const LOADED = { busy: 2.16, processors: 8, share: 0.27, sampleMs: 1000 };
const LOAD_ROW = 'INFO  load  2.2 of 8 logical processors busy before the sensors (27%, 1 s sample)';

/** A lock that cannot be taken at all: the gate runs its sensors without it. */
const lockRefuses = async () => {
  throw Object.assign(new Error("EPERM: operation not permitted, mkdir 'somewhere'"), { code: 'EPERM' });
};

/** The three ways a gate comes to its sensors: what it is started with, the lock it is handed, the row
 * named `gate` its report has before them, and who holds the lock of its home meanwhile. */
const LOCK_STATES = [
  { state: 'its own lock', env: {}, deps: {}, gate: [], holder: process.pid },
  { state: 'the turn of the process that started it', env: { JS_HARNESS_GATE_HELD: '1' }, deps: {}, gate: ['gate'], holder: undefined },
  { state: 'no lock, since none could be taken', env: {}, deps: { takeGateLock: lockRefuses }, gate: ['gate'], holder: undefined },
];

/** A sampler that answers `load` at once and a runner of sensors that passes: each writes into `events`
 * when it was called, the sampler with the holder of the lock in `home` at that moment. */
function sampledGate(home, load = LOADED) {
  const events = [];
  const sampleLoad = async () => {
    events.push(['sample', readGateHolder(home)?.pid]);
    return load;
  };
  const spawn = (command) => {
    events.push(command);
    return sensorRan();
  };
  return { events, sampleLoad, spawn };
}

test('a gate samples the load once, before its first sensor and inside its turn, and says it in one INFO row named load, in each of the three states of the lock', () => withGate({ tests: 'run-tests', lint: 'run-lint' }, async (dir, home) => {
  for (const { state, env, deps, gate, holder } of LOCK_STATES) {
    const { events, sampleLoad, spawn } = sampledGate(home);
    const { code, output } = await runCheck(['--cwd', dir, '--home', home], env, gateDeps({ spawn, sampleLoad, ...deps }));
    assert.equal(code, 0, `${state}: ${output}`);
    assert.deepEqual(events, [['sample', holder], 'run-tests', 'run-lint'], state);
    assert.deepEqual(loadRows(output), [LOAD_ROW], state);
    const names = rowsOf(output).map((row) => row.split('  ')[1]);
    assert.deepEqual(names, ['budget', 'contracts', 'payload claude', 'payload codex', 'fixed load', ...gate, 'load', 'tests', 'lint', 'review', 'codex-review'], state);
  }
}));

test('the load row decides nothing: a red sensor stays red beside it, and a load that could not be read, or a sampler that throws, is said in the row of a gate that still runs', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const argv = ['--cwd', dir, '--home', home];
  const red = await runCheck(argv, {}, gateDeps({ spawn: () => ({ ...sensorRan(), status: 3 }), sampleLoad: async () => LOADED }));
  assert.equal(red.code, 1);
  assert.deepEqual(loadRows(red.output), [LOAD_ROW]);
  assert.match(red.output, /^FAIL {2}tests {2}run-tests exited 3$/m);

  const notRead = async () => ({ notRead: 'os.cpus() gave no processor', sampleMs: 1000 });
  const threw = async () => {
    throw new Error('the sampler blew up');
  };
  for (const [sampleLoad, row] of [[notRead, 'INFO  load  not read: os.cpus() gave no processor'], [threw, 'INFO  load  not read: the sampler blew up']]) {
    const spawn = countedSensors();
    const { code, output } = await runCheck(argv, {}, gateDeps({ spawn, sampleLoad }));
    assert.deepEqual([code, spawn.ran, loadRows(output)], [0, 1, [row]], output);
    assert.equal(readGateHolder(home), null);
  }
}));

test('no load is sampled and no load row printed where no gate runs a sensor: a caller that is no gate, the inner run, a push, no sensor declared, a commit of documents alone', async () => {
  const dir = sensorProject({ tests: 'run-tests' });
  const none = sensorProject({});
  const home = makeTmpDir();
  try {
    let sampled = 0;
    const sampleLoad = async () => {
      sampled += 1;
      return LOADED;
    };
    // A caller that is no gate hands `checkSensors` no lock: its sensors run, and nothing is sampled.
    const rows = await checkSensors(dir, { spawn: sensorRan, sampleLoad });
    assert.deepEqual(rows.map((row) => row.name), ['tests']);

    const deps = { gentleAi: gentleAiNotFound, git: notARepository, takeGateLock: lockTakenAtOnce(), sampleLoad };
    const argv = ['--cwd', dir, '--home', home];
    const silent = {
      inner: await runCheck(argv, { JS_HARNESS_CHECK_INNER: '1' }, deps),
      push: await runCheck(['--push', ...argv], {}, deps),
      'no sensor': await runCheck(['--cwd', none, '--home', home], {}, deps),
    };
    writeJson(dir, 'harness.json', { sensors: { tests: 'run-tests' }, documents: ['docs/'] });
    for (const env of [{}, { JS_HARNESS_GATE_HELD: '1' }]) {
      silent[`documents alone ${JSON.stringify(env)}`] = await runCheck(argv, env, { ...deps, git: stagedGit(['docs/guide.md']) });
    }
    for (const [what, { output }] of Object.entries(silent)) assert.deepEqual(loadRows(output), [], `${what}: ${output}`);
    assert.equal(sampled, 0);

    // The same stand-ins sample once a sensor runs, so the silence above is not their own.
    const gate = await runCheck(argv, {}, { ...deps, spawn: sensorRan, git: stagedGit(['docs/guide.md', 'src/app.js']) });
    assert.deepEqual([loadRows(gate.output), sampled], [[LOAD_ROW], 1]);
  } finally {
    for (const folder of [dir, none, home]) fs.rmSync(folder, { recursive: true, force: true });
  }
});

// The switch is for the gates a seam cannot reach: the ones a test starts as processes of their own.
test('JS_HARNESS_GATE_LOAD=off takes no sample and prints no load row in any state of the lock, and only off is the switch', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const argv = ['--cwd', dir, '--home', home];
  for (const { state, env, deps } of LOCK_STATES) {
    const { events, sampleLoad, spawn } = sampledGate(home);
    const { code, output } = await runCheck(argv, { ...env, JS_HARNESS_GATE_LOAD: 'off' }, gateDeps({ spawn, sampleLoad, ...deps }));
    assert.equal(code, 0, `${state}: ${output}`);
    assert.deepEqual([events, loadRows(output)], [['run-tests'], []], state);
  }
  for (const value of ['', '0', 'on', 'OFF']) {
    const { events, sampleLoad, spawn } = sampledGate(home);
    const { output } = await runCheck(argv, { JS_HARNESS_GATE_LOAD: value }, gateDeps({ spawn, sampleLoad }));
    assert.deepEqual([events, loadRows(output)], [[['sample', process.pid], 'run-tests'], [LOAD_ROW]], JSON.stringify(value));
  }
}));

// A gate that waited has the lock within two seconds of the gate before it, which still runs the rows it
// prints after its sensors: what is read then is not the machine's own load, and the row says so.
test('a gate that waited a second or more for the lock says that its load was read right after another gate', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const row = async (waitedMs, load = LOADED) => {
    const take = async () => ({ release: () => {}, beat: () => {}, lost: () => false, waitedMs });
    const { code, output } = await runCheck(['--cwd', dir, '--home', home], {}, gateDeps({ takeGateLock: take, sampleLoad: async () => load }));
    assert.equal(code, 0, output);
    return loadRows(output);
  };
  assert.deepEqual(await row(1000), [`${LOAD_ROW}, right after another gate`]);
  assert.deepEqual(await row(6 * 60_000), [`${LOAD_ROW}, right after another gate`]);
  // A lock taken at once took a few milliseconds, and nobody ran before this gate.
  assert.deepEqual(await row(999), [LOAD_ROW]);
  assert.deepEqual(await row(0), [LOAD_ROW]);
  // A load that was not read has no figure to say that of.
  assert.deepEqual(await row(6000, { notRead: 'os.cpus() gave no processor', sampleMs: 1000 }), ['INFO  load  not read: os.cpus() gave no processor']);
}));

// --- what loads a loaded machine: the busiest processes, each in a line under the load row ---
// The look itself is tested in lib/machine-busiest.test.mjs; here, when a gate looks and where it says
// what was found. Every look is a stand-in that answers at once.

const BUSIEST = [
  { name: 'node', script: 'tsserver.js', pid: 12044, cpuSeconds: 3.2 },
  { name: 'chrome', script: null, pid: 9000, cpuSeconds: 1.6 },
  { name: 'Memory Compression', script: null, pid: 3064, cpuSeconds: 0.9 },
];
const BUSIEST_LINES = [
  '      3.2 s of CPU in 2 s  node tsserver.js (pid 12044)',
  '      1.6 s of CPU in 2 s  chrome (pid 9000)',
  '      0.9 s of CPU in 2 s  Memory Compression (pid 3064)',
];
const TESTS_ROW = 'PASS  tests  run-tests passed';

/** The load row of `output` and the `count` lines after it. */
function fromLoadRow(output, count) {
  const lines = output.split('\n');
  const at = lines.findIndex((line) => /^\w+ {2}load {2}/.test(line));
  return lines.slice(at, at + 1 + count);
}

test('a gate on a loaded machine names what loads it in lines under the load row: looked for once, after the sample and before the first sensor, in each state of the lock', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  for (const { state, env, deps, holder } of LOCK_STATES) {
    const { events, sampleLoad, spawn } = sampledGate(home);
    const busiest = async () => {
      events.push(['look', readGateHolder(home)?.pid]);
      return BUSIEST;
    };
    const { code, output } = await runCheck(['--cwd', dir, '--home', home], env, gateDeps({ spawn, sampleLoad, busiest, ...deps }));
    assert.equal(code, 0, `${state}: ${output}`);
    assert.deepEqual(events, [['sample', holder], ['look', holder], 'run-tests'], state);
    assert.deepEqual(fromLoadRow(output, 4), [LOAD_ROW, ...BUSIEST_LINES, TESTS_ROW], state);
    assert.deepEqual(loadRows(output), [LOAD_ROW], state);
  }
  // A gate that waited for another names them as well: they may be the tail of that gate, as the row says.
  const take = async () => ({ release: () => {}, beat: () => {}, lost: () => false, waitedMs: 5000 });
  const waited = await runCheck(['--cwd', dir, '--home', home], {}, gateDeps({ takeGateLock: take, sampleLoad: async () => LOADED, busiest: async () => BUSIEST.slice(0, 1) }));
  assert.deepEqual(fromLoadRow(waited.output, 2), [`${LOAD_ROW}, right after another gate`, BUSIEST_LINES[0], TESTS_ROW]);
}));

test('a look that finds nobody, gives no list or throws leaves the load row as it was, and the gate runs on', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const threw = async () => {
    throw new Error('the look blew up');
  };
  for (const busiest of [async () => [], async () => undefined, threw]) {
    const spawn = countedSensors();
    const { code, output } = await runCheck(['--cwd', dir, '--home', home], {}, gateDeps({ spawn, sampleLoad: async () => LOADED, busiest }));
    assert.deepEqual([code, spawn.ran], [0, 1], output);
    assert.deepEqual(fromLoadRow(output, 1), [LOAD_ROW, TESTS_ROW]);
    assert.equal(readGateHolder(home), null);
  }
}));

test('nothing is looked for on a machine below one busy logical processor, for a load that was not read, with JS_HARNESS_GATE_LOAD=off, or where no gate runs a sensor', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  let looked = 0;
  const busiest = async () => {
    looked += 1;
    return BUSIEST;
  };
  const argv = ['--cwd', dir, '--home', home];
  const row = async (sampleLoad, env = {}, flags = []) => fromLoadRow((await runCheck([...flags, ...argv], env, gateDeps({ sampleLoad, busiest }))).output, 1);
  const loaded = async () => LOADED;
  assert.deepEqual(await row(async () => QUIET_LOAD), [QUIET_LOAD_ROW, TESTS_ROW]);
  assert.deepEqual(await row(async () => ({ ...LOADED, busy: 0.99 })), ['INFO  load  1.0 of 8 logical processors busy before the sensors (27%, 1 s sample)', TESTS_ROW]);
  assert.deepEqual(await row(async () => ({ notRead: 'os.cpus() gave no processor', sampleMs: 1000 })), ['INFO  load  not read: os.cpus() gave no processor', TESTS_ROW]);
  // A sampler that gives no figure at all is a load that was not read, and the gate runs on.
  assert.deepEqual(await row(async () => undefined), ['INFO  load  not read: the sampler gave no figure', TESTS_ROW]);
  assert.deepEqual(await row(async () => ({ processors: 8 })), ['INFO  load  not read: the sampler gave no figure', TESTS_ROW]);
  for (const [env, flags] of [[{ JS_HARNESS_GATE_LOAD: 'off' }, []], [{ JS_HARNESS_GATE_LOAD: 'off', JS_HARNESS_GATE_HELD: '1' }, []], [{ JS_HARNESS_CHECK_INNER: '1' }, []], [{}, ['--push']]]) {
    assert.deepEqual(loadRows((await runCheck([...flags, ...argv], env, gateDeps({ sampleLoad: loaded, busiest }))).output), [], JSON.stringify([env, flags]));
  }
  assert.equal(looked, 0);
  // The same stand-ins look once the machine is loaded, so the silence above is not their own.
  assert.deepEqual(await row(loaded), [LOAD_ROW, BUSIEST_LINES[0]]);
  assert.equal(looked, 1);
}));

/** What the load row of a gate that read this machine may say, on any machine: a figure, with what a gate
 * that waited adds to it, or why the load could not be read. */
const REAL_LOAD_ROW = /^INFO {2}load {2}(?:(\d+\.\d) of (\d+) logical processors? busy before the sensors \((\d+)%, 1 s sample\)(?:, right after another gate)?|not read: \S.*)$/;

// The one real sample of the suite: every other gate of the tests is handed a sampler that answers at
// once, or is started with the switch off.
test('a gate that is handed no sampler reads this machine for one second and says what it read', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const startedAt = Date.now();
  // Naming `sampleLoad` with no value takes away the sampler `runCheck` hands every other gate. The look
  // for the busiest processes stays the stand-in of `runCheck`: nothing is started here, loaded or not.
  const { code, output } = await runCheck(['--cwd', dir, '--home', home], {}, gateDeps({ sampleLoad: undefined }));
  const took = Date.now() - startedAt;
  assert.equal(code, 0, output);
  const said = loadRows(output);
  assert.equal(said.length, 1, output);
  // On a host where `os.cpus()` counts nothing the row says so, and a lock that took a second to take adds
  // its words to the figure: both are a real sample, said once.
  const read = REAL_LOAD_ROW.exec(said[0]);
  assert.ok(read, said[0]);
  if (read[1] !== undefined) {
    const [busy, processors, percent] = read.slice(1).map(Number);
    assert.equal(processors, os.cpus().length);
    assert.ok(busy >= 0 && busy <= processors, said[0]);
    assert.ok(percent >= 0 && percent <= 100, said[0]);
  }
  // The second of the sample was waited for, whatever was read in it.
  assert.ok(took >= 900, `a gate that sampled for a second took ${took} ms`);

  // What this test takes for the row of a real sample, and what it does not.
  for (const row of [LOAD_ROW, `${LOAD_ROW}, right after another gate`, 'INFO  load  0.0 of 1 logical processor busy before the sensors (0%, 1 s sample)', 'INFO  load  not read: the two readings of os.cpus() do not differ']) {
    assert.match(row, REAL_LOAD_ROW);
  }
  for (const row of ['INFO  load  not read: ', 'INFO  load  ', `${LOAD_ROW} and more`, 'INFO  load  NaN of 8 logical processors busy before the sensors (NaN%, 1 s sample)', LOAD_ROW.replace('1 s sample', '0 s sample')]) {
    assert.doesNotMatch(row, REAL_LOAD_ROW);
  }
}));

// --- the gate log: a start and an end for every gate, a line for a gate that was refused its turn ---
// The file itself is tested in lib/gate-log.test.mjs; here, when a gate writes and what. Most gates of this
// part are handed a writer that keeps the events and writes no file (`deps.gateLog`); the ones that are not
// write the log of their temporary home.

/** A stand-in for the writer of the gate log, in `deps`, which is what a gate is handed: it keeps the
 * `events` it is handed and the home of each in `homes`, and answers what `during` does, which is called
 * as each event comes, or that the line was written. */
function capturedLog(during = () => {}) {
  const log = { events: [], homes: [] };
  const append = (home, event) => {
    log.homes.push(home);
    log.events.push(event);
    return during(event) ?? { ok: true };
  };
  return { ...log, deps: { gateLog: { append } } };
}

const OTHER_GATE = { cwd: 'C:\\work\\other', pid: 4321, command: 'check' };
const isIsoTime = (text) => typeof text === 'string' && new Date(text).toISOString() === text;
/** The names of the fields of each event, for a test of what a line holds and what it leaves out. */
const fieldsOf = (events) => events.map((event) => Object.keys(event).join(' '));
const START_FIELDS = 'v event id at cwd command pid lock waitedSeconds waitedFor';

/** Runs `take` as `takeGateTurn` is run by `check`, and leaves out what it says on stderr. */
async function turnWith(take, { wait = true, waitMinutes = 1 } = {}) {
  const originalError = console.error;
  console.error = () => {};
  try {
    return await takeGateTurn({ name: 'check', home: 'C:\\home', cwd: 'C:\\work\\mine', command: 'check', wait, waitMinutes }, take);
  } finally {
    console.error = originalError;
  }
}

test('takeGateTurn says whom the gate waited for and for how long, in every outcome, and names a gate once however often the lock tells of it', async () => {
  const holder = (token, more = {}) => ({ token, pid: 4321, cwd: 'C:\\work\\other', command: 'check', startedAt: '2026-10-11T07:00:00.000Z', beatAt: 1, stale: false, ...more });
  const one = holder('4321-aa');
  const two = holder('77-bb', { pid: 77, cwd: 'C:\\work\\two', command: 'gate -- node --test' });
  const nobody = { token: null, pid: null, cwd: null, command: null, startedAt: null, beatAt: null, stale: false };
  const lock = { release: () => {}, beat: () => {}, lost: () => false, waitedMs: 6000 };

  // The lock tells of a gate again when its beat stops being readable, and when it reads again.
  const taken = await turnWith(async ({ onWait }) => {
    for (const told of [one, { ...one, beatAt: null }, one, two, nobody, nobody]) onWait(told, 60_000);
    return lock;
  });
  assert.deepEqual(Object.keys(taken), ['lock', 'waitedMs', 'waitedFor']);
  assert.equal(taken.lock, lock);
  assert.deepEqual([taken.waitedMs, taken.waitedFor], [6000, [OTHER_GATE, { cwd: 'C:\\work\\two', pid: 77, command: 'gate -- node --test' }, { cwd: null, pid: null, command: null }]]);
  assert.deepEqual(await turnWith(async () => ({ ...lock, waitedMs: 3 })), { lock: { ...lock, waitedMs: 3 }, waitedMs: 3, waitedFor: [] });

  // Its wait ran out: the gate that still held the lock is one it was told of.
  const late = await turnWith(async ({ onWait }) => {
    onWait(one, 60_000);
    return { refused: 'timeout', holder: one, waitedMs: 60_000 };
  });
  assert.deepEqual([late.reason, late.waitedMs, late.waitedFor], ['timeout', 60_000, [OTHER_GATE]]);
  assert.match(late.refused, /still held the machine's gate lock after 1 min 0 s/);
  // Told not to wait, it is told of nobody: the gate it was refused for is the one that holds the lock.
  const held = await turnWith(async () => ({ refused: 'held', holder: one, waitedMs: 0 }), { wait: false });
  assert.deepEqual([held.reason, held.waitedMs, held.waitedFor], ['held', 0, [OTHER_GATE]]);
  assert.match(held.refused, /--no-wait was given$/);

  // No lock could be taken, after a wait for a gate of which nothing more was read.
  const without = await turnWith(async ({ onWait }) => {
    onWait(two, 60_000);
    throw new Error('nothing of it could be read');
  });
  assert.match(without.without, /^the machine's gate lock, which could not be taken \(nothing of it could be read\)$/);
  assert.deepEqual(without.waitedFor, [{ cwd: 'C:\\work\\two', pid: 77, command: 'gate -- node --test' }]);
  assert.ok(Number.isFinite(without.waitedMs) && without.waitedMs >= 0 && without.waitedMs < 60_000, String(without.waitedMs));
});

// Found in review (Codex), 2026-10-11: a holder's file that is busy at the first look (Windows) is told of by
// its token alone, and again with its folder and command once it reads. One entry for each token kept the
// first telling, so `check` and `gate` wrote an unknown gate in their log although they had learnt whose it was.
test('takeGateTurn adds to a gate it already met what the lock reads of it later, in the one entry of its token, and never unlearns it', async () => {
  const lock = { release: () => {}, beat: () => {}, lost: () => false, waitedMs: 6000 };
  const read = { token: '4321-aa', pid: 4321, cwd: 'C:\\work\\other', command: 'check', startedAt: '2026-10-11T07:00:00.000Z', beatAt: 1, stale: false };
  // Its file is busy: the token is in its name, the pid in its token, and nothing else is read.
  const busy = { ...read, cwd: null, command: null, startedAt: null, beatAt: null };
  const two = { ...read, token: '77-bb', pid: 77, cwd: 'C:\\work\\two', command: 'gate -- node --test' };

  const taken = await turnWith(async ({ onWait }) => {
    for (const told of [busy, two, read, busy]) onWait(told, 60_000);
    return lock;
  });
  // In the order they were first met, the first of them with what was read of it afterwards.
  assert.deepEqual(taken.waitedFor, [OTHER_GATE, { cwd: 'C:\\work\\two', pid: 77, command: 'gate -- node --test' }]);

  // A field at a time, as a file that is half written reads; and the gate a refusal names is added to as well.
  const late = await turnWith(async ({ onWait }) => {
    for (const told of [busy, { ...busy, cwd: read.cwd }]) onWait(told, 60_000);
    return { refused: 'timeout', holder: read, waitedMs: 60_000 };
  });
  assert.deepEqual(late.waitedFor, [OTHER_GATE]);
  // A pid the first look did not have (a file that is not ours, named by no pid) is learnt the same way.
  const named = await turnWith(async ({ onWait }) => {
    for (const told of [{ ...busy, pid: null }, read]) onWait(told, 60_000);
    return lock;
  });
  assert.deepEqual(named.waitedFor, [OTHER_GATE]);
});

// Left for this slice by the review of the gate log (gentle-ai, 2026-10-11): every holder that gave no token
// went into the one entry of "no token", so what was read of one was said of another, and two of them were
// counted as one gate.
test('takeGateTurn keeps holders that gave no token apart by what was read of them: each is there once, and nothing read of one is said of another', async () => {
  const lock = { release: () => {}, beat: () => {}, lost: () => false, waitedMs: 6000 };
  const unnamed = (pid, cwd) => ({ token: null, pid, cwd, command: 'check', startedAt: null, beatAt: null, stale: false });
  const nobody = { token: null, pid: null, cwd: null, command: null, startedAt: null, beatAt: null, stale: false };
  const { waitedFor } = await turnWith(async ({ onWait }) => {
    for (const told of [unnamed(5, 'C:\\work\\a'), nobody, unnamed(6, null), unnamed(5, 'C:\\work\\a'), nobody]) onWait(told, 60_000);
    return lock;
  });
  assert.deepEqual(waitedFor, [{ cwd: 'C:\\work\\a', pid: 5, command: 'check' }, { cwd: null, pid: null, command: null }, { cwd: null, pid: 6, command: 'check' }]);
});

// --- the line: what a gate says of a gate that waits ahead of it, which holds nothing ---
// The lock tells of the holder when there is one, and of the line: how many gates are before this one and
// which waits first (`takeGateLock`). A gate that only waits is never said to hold the lock, on stderr, in a
// refusal or in the log.

/** Runs `take` as `takeGateTurn` is run by `check`: what it came to, and what it said on stderr. */
async function turnSaid(take, { wait = true, waitMinutes = 1 } = {}) {
  const said = [];
  const originalError = console.error;
  console.error = (line) => said.push(String(line));
  try {
    const turn = await takeGateTurn({ name: 'check', home: 'C:\\home', cwd: 'C:\\work\\mine', command: 'check', wait, waitMinutes }, take);
    return { turn, said };
  } finally {
    console.error = originalError;
  }
}

test('takeGateTurn says of each gate what is true of it: one that holds the lock is waited for to finish, one that waits ahead is stood behind, and a refusal says which of the two it was', async () => {
  const holder = { token: '4321-aa', pid: 4321, cwd: 'C:\\work\\other', command: 'check', session: null, startedAt: '2026-10-11T07:00:00.000Z', beatAt: 1, stale: false };
  const waiter = { token: '77-bb', pid: 77, cwd: 'C:\\work\\two', command: 'gate -- node --test', waitingSince: '2026-10-11T06:59:00.000Z', session: null };
  const unread = { token: '78-cc', pid: null, cwd: null, command: null, waitingSince: null, session: null };
  const lock = { release: () => {}, beat: () => {}, lost: () => false, waitedMs: 6000 };
  const HOLDER = 'the gate of C:\\work\\other (pid 4321, started 2026-10-11T07:00:00.000Z)';
  const WAITER = 'the gate of C:\\work\\two (pid 77, waiting since 2026-10-11T06:59:00.000Z)';
  const BEHIND = "which waits for its turn at the machine's gate lock";
  const BOUND = '(--wait gives up after 1 minute without the lock changing hands)';

  const taken = await turnSaid(async ({ onWait }) => {
    onWait(holder, 60_000, { ahead: 3, head: waiter });
    onWait(null, 46_000, { ahead: 2, head: waiter });
    onWait(null, 60_000, { ahead: 1, head: waiter });
    onWait(null, 60_000, { ahead: 1, head: unread });
    return lock;
  });
  assert.deepEqual(taken.said, [
    `check: waiting for ${HOLDER} to finish, for 1 minute at most; 3 gates are ahead of this one, that one included`,
    `check: waiting behind ${WAITER}, ${BEHIND}, for 46 s at most; 2 gates are ahead of this one, that one included`,
    `check: waiting behind ${WAITER}, ${BEHIND}, for 1 minute at most`,
    `check: waiting behind another gate, ${BEHIND}, for 1 minute at most`,
  ]);
  // Only the gate that held the lock is one this gate waited for, which is what its log keeps.
  assert.deepEqual(taken.turn.waitedFor, [OTHER_GATE]);

  const refusals = [
    [{ refused: 'held', holder, line: { ahead: 2, head: waiter }, waitedMs: 0, stillMs: 0 }, `${HOLDER} holds the machine's gate lock, and --no-wait was given`],
    [
      { refused: 'ahead', holder: null, line: { ahead: 1, head: waiter }, waitedMs: 0, stillMs: 0 },
      `${WAITER} waits ahead of this one for the machine's gate lock, which no gate holds, and --no-wait was given; a gate that died as it waited is passed a minute after its last sign of life`,
    ],
    [{ refused: 'timeout', holder, line: { ahead: 1, head: null }, waitedMs: 60_000, stillMs: 60_000 }, `${HOLDER} still held the machine's gate lock after 1 min 0 s ${BOUND}`],
    [
      { refused: 'timeout', holder, line: { ahead: 1, head: null }, waitedMs: 900_000, stillMs: 60_000 },
      `${HOLDER} still held the machine's gate lock 1 min 0 s after it took it, and this gate had waited 15 min 0 s in all ${BOUND}`,
    ],
    [
      { refused: 'timeout', holder: null, line: { ahead: 1, head: waiter }, waitedMs: 900_000, stillMs: 60_000 },
      `${WAITER} waited ahead of this one and did not take the machine's gate lock, which no gate held: the lock had not changed hands for 1 min 0 s, and this gate had waited 15 min 0 s in all ${BOUND}`,
    ],
  ];
  for (const [answer, sentence] of refusals) {
    const { turn, said } = await turnSaid(async () => answer, { wait: answer.refused === 'timeout' });
    assert.deepEqual([turn.refused, turn.reason, turn.waitedMs, said], [sentence, answer.refused, answer.waitedMs, []]);
    // The gate a refusal names is one this gate waited for when it held the lock, and none when it only waited.
    assert.deepEqual(turn.waitedFor, answer.holder ? [OTHER_GATE] : [], sentence);
  }
});

// Found in review, 2026-10-11: a wait that ran out beside a gate of an older version (which keeps no line) was
// worded as one that ended "without the lock changing hands", which is not what the bound counted there.
test('takeGateTurn words a timeout beside a gate of an older version without "without the lock changing hands", and says that older gate waited beside it', async () => {
  const HOLDER = 'the gate of C:\\work\\other (pid 4321, started 2026-10-11T07:00:00.000Z)';
  const holder = { token: '4321-aa', pid: 4321, cwd: 'C:\\work\\other', command: 'check', session: null, startedAt: '2026-10-11T07:00:00.000Z', beatAt: 1, stale: false };
  const answer = { refused: 'timeout', holder, line: { ahead: 1, head: null }, waitedMs: 3_700_000, stillMs: 3_700_000, besideOlder: true };
  const { turn, said } = await turnSaid(async () => answer);
  assert.equal(
    turn.refused,
    `${HOLDER} holds the machine's gate lock now; this gate had waited 61 min 40 s in all, and a gate of an older version of js-harness waited beside it, which keeps no line, so the bound counted from its arrival or from the last change of hands read while the line was kept (--wait gives up after 1 minute)`,
  );
  assert.match(turn.refused, /older version/);
  assert.doesNotMatch(turn.refused, /without the lock changing hands/);
  assert.deepEqual([turn.reason, said], ['timeout', []]);

  // The other arm of the same sentence: the lock is free, and the gate ahead that was to take it is the one
  // named, as a gate that waits and holds nothing. The older gate is still said to have waited beside it.
  const WAITER = 'the gate of C:\\work\\two (pid 77, waiting since 2026-10-11T06:59:00.000Z)';
  const waiter = { token: '77-bb', pid: 77, cwd: 'C:\\work\\two', command: 'gate -- node --test', waitingSince: '2026-10-11T06:59:00.000Z', session: null };
  const free = await turnSaid(async () => ({ refused: 'timeout', holder: null, line: { ahead: 1, head: waiter }, waitedMs: 3_700_000, stillMs: 3_700_000, besideOlder: true }));
  assert.equal(
    free.turn.refused,
    `${WAITER} waits ahead of this one for the machine's gate lock, which no gate holds; this gate had waited 61 min 40 s in all, and a gate of an older version of js-harness waited beside it, which keeps no line, so the bound counted from its arrival or from the last change of hands read while the line was kept (--wait gives up after 1 minute)`,
  );
  assert.match(free.turn.refused, /a gate of an older version of js-harness waited beside it/);
  assert.doesNotMatch(free.turn.refused, /without the lock changing hands/);
  assert.deepEqual([free.turn.reason, free.said], ['timeout', []]);
});

test('main stands behind a gate that arrived before it when the lock is free, says that this gate waits and holds nothing, and keeps it in its log as a gate it waited for from the moment it held the lock', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const clock = gateClock();
  const first = await clock.take({ home, ...OTHER_GATE });
  // The gate of another process, in the line since before this one: it stands still at its poll until the
  // test wakes it.
  const asleep = [];
  let two;
  takeGateLock({ home, cwd: 'C:\\work\\two', command: 'gate -- node --test', pid: 22, now: clock.now, sleep: () => new Promise((resolve) => asleep.push(resolve)), beatMs: 0 }).then((lock) => {
    two = lock;
  });
  const since = new Date(clock.now()).toISOString();
  await clock.sleep(1000);
  // The holder ends between two polls of the gate that waits: the lock is free when this gate arrives.
  first.release();
  let sleeps = 0;
  const held = [];
  clock.onSleep = async () => {
    sleeps += 1;
    held.push(readGateHolder(home, { now: clock.now })?.pid ?? null);
    if (sleeps === 1) {
      asleep.shift()();
      await new Promise((resolve) => setImmediate(resolve));
    }
    if (sleeps === 3) two.release();
  };
  const log = capturedLog();
  const { code, output, errOutput } = await runCheck(['--cwd', dir, '--home', home], {}, gateDeps({ takeGateLock: clock.take, ...log.deps }));
  assert.equal(code, 0, output);
  // Free at its first look, and left to the gate ahead.
  assert.deepEqual(held, [null, 22, 22]);
  const said = errOutput.split('\n');
  assert.equal(said[0], `check: waiting behind the gate of C:\\work\\two (pid 22, waiting since ${since}), which waits for its turn at the machine's gate lock, for 60 minutes at most`);
  assert.match(said[1], /^check: waiting for the gate of C:\\work\\two \(pid 22, started [^)]+\) to finish, for 60 minutes at most$/);
  assert.deepEqual(said.slice(2), ['']);
  assert.deepEqual(gateRows(output), ["INFO  gate  waited 6 s for the machine's gate lock before the sensors ran"]);
  assert.deepEqual([log.events[0].event, log.events[0].waitedFor], ['start', [{ cwd: 'C:\\work\\two', pid: 22, command: 'gate -- node --test' }]]);
}));

test('main --no-wait is refused for a gate that waits ahead of it when the lock is free, in words that say it waits and holds nothing, and its log names no gate it waited for', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  // The folder of a gate in the line, as a gate that keeps the line writes it, touched a moment ago.
  const since = new Date(Date.now() - 5000).toISOString();
  const folder = path.join(gateDir(home), 'wait-22-aaaaaaaaaaaa');
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'holder-22-aaaaaaaaaaaa.json'), `${JSON.stringify({ token: '22-aaaaaaaaaaaa', pid: 22, cwd: 'C:\\work\\two', command: 'check', startedAt: since, waitingSince: since, line: 1, session: null })}\n`);
  let ran = 0;
  const spawn = () => {
    ran += 1;
    return sensorRan();
  };
  const log = capturedLog();
  const { code, output, errOutput } = await runCheck(['--cwd', dir, '--home', home, '--no-wait'], {}, gateDeps({ spawn, ...log.deps }));
  assert.equal(code, 1);
  assert.equal(ran, 0);
  assert.deepEqual(gateRows(output), [
    `FAIL  gate  no sensor ran: the gate of C:\\work\\two (pid 22, waiting since ${since}) waits ahead of this one for the machine's gate lock, which no gate holds, and --no-wait was given; a gate that died as it waited is passed a minute after its last sign of life`,
  ]);
  assert.equal(errOutput, '');
  assert.deepEqual(log.events.map(({ event, reason, waitedFor }) => ({ event, reason, waitedFor })), [{ event: 'refused', reason: 'ahead', waitedFor: [] }]);
  // It took nothing, and left nothing of its own in the line.
  assert.equal(readGateHolder(home), null);
  assert.deepEqual(fs.readdirSync(gateDir(home)), ['wait-22-aaaaaaaaaaaa']);
}));

// Found in review, 2026-10-11: the reason `ahead` came with the line, and the test above reads it from a
// stand-in for the writer of the log. Nothing showed that the line the real writer makes of it is one the
// real reader takes: a reader that knew only `held` and `timeout` would count every such refusal among the
// lines it could not read.
test('a gate refused with --no-wait behind a gate that waits ahead is in the real gate log of its home as one refusal whose reason is ahead: its reader takes the line and counts none unreadable', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const since = new Date(Date.now() - 5000).toISOString();
  const folder = path.join(gateDir(home), 'wait-22-aaaaaaaaaaaa');
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'holder-22-aaaaaaaaaaaa.json'), `${JSON.stringify({ token: '22-aaaaaaaaaaaa', pid: 22, cwd: 'C:\\work\\two', command: 'check', startedAt: since, waitingSince: since, line: 1, session: null })}\n`);
  // Handed no writer, the gate writes the log of its home, as it does outside a test.
  const { code, output } = await runCheck(['--cwd', dir, '--home', home, '--no-wait'], {}, gateDeps());
  assert.equal(code, 1);
  assert.match(gateRows(output).join('\n'), /^FAIL {2}gate {2}no sensor ran: .* waits ahead of this one for the machine's gate lock/);
  assert.doesNotMatch(output, /gate log/);
  assert.deepEqual(fs.readdirSync(gateLogDir(home)), ['log.jsonl']);
  const { events, skipped } = readGateLog(home);
  assert.deepEqual([events.length, skipped], [1, 0]);
  assert.deepEqual(
    gatesOf(events).map(({ start, refused }) => [start, refused?.event, refused?.reason, refused?.cwd, refused?.command, refused?.pid, refused?.waitedFor]),
    [[undefined, 'refused', 'ahead', path.resolve(dir), 'check', process.pid, []]],
  );
}));

test('main tells the lock which session started the gate, from the environment it was given, and none where the host says none', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const take = lockTakenAtOnce();
  const argv = ['--cwd', dir, '--home', home];
  for (const env of [{ CLAUDE_CODE_SESSION_ID: 'a-session' }, {}, { CLAUDE_CODE_SESSION_ID: '' }]) await runCheck(argv, env, gateDeps({ takeGateLock: take }));
  assert.deepEqual(take.asked.map(({ session }) => session), ['a-session', null, null]);
  // And the real lock writes it in the gate's file, where the session board reads it.
  let during;
  const spawn = () => {
    during = readGateHolder(home);
    return sensorRan();
  };
  await runCheck(argv, { CLAUDE_CODE_SESSION_ID: 'a-session' }, gateDeps({ spawn }));
  assert.deepEqual([during?.pid, during?.session], [process.pid, 'a-session']);
}));

const LOCK_NAMES = ['own', 'parent', 'none'];

test('a gate writes its start after the sample and before its first sensor, and its end after the last, in each of the three states of the lock', () => withGate({ tests: 'run-tests', lint: 'run-lint' }, async (dir, home) => {
  for (const [at, { state, env, deps, holder }] of LOCK_STATES.entries()) {
    const { events: order, sampleLoad, spawn } = sampledGate(home);
    const log = capturedLog((event) => void order.push([event.event, readGateHolder(home)?.pid]));
    const { code, output } = await runCheck(['--cwd', dir, '--home', home], env, gateDeps({ spawn, sampleLoad, ...deps, ...log.deps }));
    assert.equal(code, 0, `${state}: ${output}`);
    // The end is written with the lock still in hand, where the gate has one.
    assert.deepEqual(order, [['sample', holder], ['start', holder], 'run-tests', 'run-lint', ['end', holder]], state);
    assert.deepEqual(log.homes, [home, home], state);
    const [start, end] = log.events;
    assert.deepEqual(fieldsOf(log.events), [`${START_FIELDS} load`, 'v event id at seconds result sensors'], state);
    assert.deepEqual({ ...start, id: '', at: '', waitedSeconds: Math.floor(start.waitedSeconds) }, { v: 1, event: 'start', id: '', at: '', cwd: path.resolve(dir), command: 'check', pid: process.pid, lock: LOCK_NAMES[at], waitedSeconds: 0, waitedFor: [], load: LOADED }, state);
    assert.deepEqual([end.v, end.event, end.id, end.result], [1, 'end', start.id, 'pass'], state);
    assert.match(start.id, /^[0-9a-f-]{36}$/);
    assert.ok(isIsoTime(start.at) && isIsoTime(end.at) && start.at <= end.at, `${start.at} ${end.at}`);
    assert.ok(end.seconds >= 0 && end.seconds < 60, String(end.seconds));
    assert.deepEqual(end.sensors.map(({ seconds, ...sensor }) => [sensor, Number.isFinite(seconds)]), [[{ name: 'tests', pass: true, timedOut: false }, true], [{ name: 'lint', pass: true, timedOut: false }, true]], state);
    // The report is as it was: the log adds no row to a gate it could write.
    assert.doesNotMatch(output, /gate log/);
  }
  assert.equal(fs.existsSync(gateLogDir(home)), false, 'a gate that is handed a writer writes no file');
}));

test('a gate whose sample of the load is switched off writes a start with no load in it', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const log = capturedLog();
  await runCheck(['--cwd', dir, '--home', home], { JS_HARNESS_GATE_LOAD: 'off' }, gateDeps(log.deps));
  assert.deepEqual(fieldsOf(log.events), [START_FIELDS, 'v event id at seconds result sensors']);
  // A load that could not be read is in the log as it was read.
  const unread = capturedLog();
  await runCheck(['--cwd', dir, '--home', home], {}, gateDeps({ ...unread.deps, sampleLoad: async () => ({ notRead: 'os.cpus() gave no processor', sampleMs: 1000 }) }));
  assert.deepEqual(unread.events[0].load, { notRead: 'os.cpus() gave no processor', sampleMs: 1000 });
}));

test('a gate that waited for another writes in its start whose gate that was and for how long', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const clock = gateClock();
  const other = await clock.take({ home, ...OTHER_GATE });
  let sleeps = 0;
  clock.onSleep = () => {
    sleeps += 1;
    other.beat();
    if (sleeps === 3) other.release();
  };
  const log = capturedLog();
  const { code, output } = await runCheck(['--cwd', dir, '--home', home], {}, gateDeps({ takeGateLock: clock.take, ...log.deps }));
  assert.equal(code, 0, output);
  const [start] = log.events;
  assert.deepEqual([start.lock, start.waitedSeconds, start.waitedFor], ['own', 6, [OTHER_GATE]]);
}));

test('a gate ends in the log on every way out of its sensors: one that fails, one whose time runs out, and an error thrown', () => withGate({ tests: 'run-tests', lint: 'run-lint' }, async (dir, home) => {
  const argv = ['--cwd', dir, '--home', home];
  const ending = (spawn) => {
    const log = capturedLog();
    return { log, run: runCheck(argv, {}, gateDeps({ spawn, ...log.deps })) };
  };
  const sensorsOf = (end) => end.sensors.map(({ name, pass, timedOut }) => ({ name, pass, timedOut }));

  const failed = ending((command) => ({ ...sensorRan(), status: command === 'run-lint' ? 3 : 0 }));
  assert.equal((await failed.run).code, 1);
  assert.deepEqual([failed.log.events[1].result, sensorsOf(failed.log.events[1])], ['fail', [{ name: 'tests', pass: true, timedOut: false }, { name: 'lint', pass: false, timedOut: false }]]);

  // A timeout is said before a failure: it is what explains a slow gate.
  const outOfTime = { status: null, signal: null, stdout: '', stderr: '', error: Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }) };
  const late = ending((command) => (command === 'run-tests' ? outOfTime : { ...sensorRan(), status: 3 }));
  assert.equal((await late.run).code, 1);
  assert.deepEqual([late.log.events[1].result, sensorsOf(late.log.events[1])], ['timeout', [{ name: 'tests', pass: false, timedOut: true }, { name: 'lint', pass: false, timedOut: false }]]);

  // An error thrown out of a sensor still ends its gate, with the sensors that had run, and leaves no lock.
  const threw = ending((command) => {
    if (command === 'run-lint') throw new Error('the sensor blew up');
    return sensorRan();
  });
  await assert.rejects(threw.run, /the sensor blew up/);
  assert.deepEqual(threw.log.events.map(({ event }) => event), ['start', 'end']);
  assert.deepEqual([threw.log.events[1].id, threw.log.events[1].result, sensorsOf(threw.log.events[1])], [threw.log.events[0].id, 'error', [{ name: 'tests', pass: true, timedOut: false }]]);
  assert.equal(readGateHolder(home), null);
}));

test('a gate that was refused its turn writes one line and no start: told not to wait, and when its wait ran out', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const refusal = { v: 1, event: 'refused', id: '', at: '', cwd: path.resolve(dir), command: 'check', pid: process.pid };
  const other = await takeGateLock({ home, ...OTHER_GATE, beatMs: 0 });
  try {
    const log = capturedLog();
    const { code, output } = await runCheck(['--cwd', dir, '--home', home, '--no-wait'], {}, gateDeps(log.deps));
    assert.equal(code, 1);
    // Refused at the first look, which on the real clock took some milliseconds.
    assert.deepEqual(log.events.map((event) => ({ ...event, id: '', at: '', waitedSeconds: Math.floor(event.waitedSeconds) })), [{ ...refusal, reason: 'held', waitedSeconds: 0, waitedFor: [OTHER_GATE] }]);
    assert.ok(isIsoTime(log.events[0].at));
    assert.deepEqual(log.homes, [home]);
    assert.doesNotMatch(output, /gate log/);
  } finally {
    other.release();
  }

  const clock = gateClock();
  const holder = await clock.take({ home, ...OTHER_GATE });
  clock.onSleep = () => holder.beat();
  const log = capturedLog();
  const { code } = await runCheck(['--cwd', dir, '--home', home, '--wait', '0.5'], {}, gateDeps({ takeGateLock: clock.take, ...log.deps }));
  assert.equal(code, 1);
  assert.deepEqual(log.events.map((event) => ({ ...event, id: '', at: '' })), [{ ...refusal, reason: 'timeout', waitedSeconds: 30, waitedFor: [OTHER_GATE] }]);
  holder.release();
}));

test('nothing is written to the gate log where no gate runs a sensor: a caller that is no gate, the inner run, a push, no sensor declared, a commit of documents alone', async () => {
  const dir = sensorProject({ tests: 'run-tests' });
  const none = sensorProject({});
  const home = makeTmpDir();
  try {
    const log = capturedLog();
    await checkSensors(dir, { spawn: sensorRan, ...log.deps });
    const deps = { gentleAi: gentleAiNotFound, git: notARepository, takeGateLock: lockTakenAtOnce(), ...log.deps };
    const argv = ['--cwd', dir, '--home', home];
    await runCheck(argv, { JS_HARNESS_CHECK_INNER: '1' }, deps);
    await runCheck(argv, { JS_HARNESS_CHECK_INNER: '1', JS_HARNESS_GATE_HELD: '1' }, deps);
    await runCheck(['--push', ...argv], {}, deps);
    await runCheck(['--cwd', none, '--home', home], {}, deps);
    writeJson(dir, 'harness.json', { sensors: { tests: 'run-tests' }, documents: ['docs/'] });
    for (const env of [{}, { JS_HARNESS_GATE_HELD: '1' }]) await runCheck(argv, env, { ...deps, git: stagedGit(['docs/guide.md']) });
    assert.deepEqual(log.events, []);

    // And with the writer of the real log, which these gates are not handed: no folder is made for it.
    const { gateLog, ...real } = deps;
    await runCheck(argv, { JS_HARNESS_CHECK_INNER: '1' }, real);
    await runCheck(['--push', ...argv], {}, real);
    await runCheck(argv, {}, { ...real, git: stagedGit(['docs/guide.md']) });
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);

    // The same stand-ins write once a sensor runs, so the silence above is not their own.
    await runCheck(argv, {}, { ...deps, spawn: sensorRan, git: stagedGit(['docs/guide.md', 'src/app.js']) });
    assert.deepEqual(log.events.map(({ event }) => event), ['start', 'end']);
  } finally {
    for (const folder of [dir, none, home]) fs.rmSync(folder, { recursive: true, force: true });
  }
});

// The switch is for a gate that must leave no file in its home.
test('JS_HARNESS_GATE_LOG=off writes nothing and says nothing in any state of the lock, nor for a gate that is refused, and only off is the switch', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const argv = ['--cwd', dir, '--home', home];
  const off = { JS_HARNESS_GATE_LOG: 'off' };
  const log = capturedLog();
  for (const { state, env, deps } of LOCK_STATES) {
    const { code, output } = await runCheck(argv, { ...env, ...off }, gateDeps({ ...deps, ...log.deps }));
    assert.equal(code, 0, `${state}: ${output}`);
    assert.doesNotMatch(output, /gate log/);
  }
  const other = await takeGateLock({ home, ...OTHER_GATE, beatMs: 0 });
  try {
    assert.equal((await runCheck([...argv, '--no-wait'], off, gateDeps(log.deps))).code, 1);
  } finally {
    other.release();
  }
  assert.deepEqual(log.events, []);
  // With the real writer the home is left as a gate left it before there was a log.
  await runCheck(argv, off, gateDeps());
  assert.deepEqual(fs.readdirSync(path.join(home, '.js-harness')), []);

  for (const value of ['', '0', 'on', 'OFF']) await runCheck(argv, { JS_HARNESS_GATE_LOG: value }, gateDeps(log.deps));
  assert.deepEqual(log.events.map(({ event }) => event), ['start', 'end', 'start', 'end', 'start', 'end', 'start', 'end']);
}));

test('a gate that is handed no writer writes the log of its home: two lines a gate, in a folder beside the lock\'s, which is gone', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const argv = ['--cwd', dir, '--home', home];
  assert.equal((await runCheck(argv, {}, gateDeps())).code, 0);
  assert.equal((await runCheck(argv, { JS_HARNESS_GATE_HELD: '1' }, gateDeps({ spawn: () => ({ ...sensorRan(), status: 3 }) }))).code, 1);
  assert.deepEqual(fs.readdirSync(path.join(home, '.js-harness')), ['gate-log']);
  assert.deepEqual(fs.readdirSync(gateLogDir(home)), ['log.jsonl']);
  const { events, skipped } = readGateLog(home);
  assert.deepEqual([events.length, skipped], [4, 0]);
  assert.deepEqual(gatesOf(events).map(({ start, end }) => [start.cwd, start.lock, start.load, end.id === start.id, end.result]), [
    [path.resolve(dir), 'own', QUIET_LOAD, true, 'pass'],
    [path.resolve(dir), 'parent', QUIET_LOAD, true, 'fail'],
  ]);
}));

// Never in the way: the lock guards the machine's time and the log only tells of it.
test('a gate log that cannot be written is said in one INFO row named gate log, and the gate and its exit code are as they were', () => withGate({ tests: 'run-tests', lint: 'run-lint' }, async (dir, home) => {
  // The folder's path is taken by a file.
  fs.mkdirSync(path.join(home, '.js-harness'));
  fs.writeFileSync(gateLogDir(home), 'not a folder');
  const argv = ['--cwd', dir, '--home', home];
  const logRows = (output) => rowsOf(output).filter((row) => /^\w+ {2}gate log {2}/.test(row));
  const NOT_WRITTEN = /^INFO {2}gate log {2}could not be written \(E[A-Z]+: [^\n]*\), so this gate is not in it$/;
  for (const [status, exit] of [[0, 0], [3, 1]]) {
    const spawn = countedSensors();
    const { code, output } = await runCheck(argv, {}, gateDeps({ spawn: () => ({ ...spawn(), status }) }));
    // One row for the gate, not one for each of its two lines.
    assert.deepEqual([code, spawn.ran, logRows(output).length], [exit, 2, 1], output);
    assert.match(logRows(output)[0], NOT_WRITTEN);
    assert.deepEqual(rowsOf(output).map((row) => row.split('  ')[1]), ['budget', 'contracts', 'payload claude', 'payload codex', 'fixed load', 'load', 'tests', 'lint', 'gate log', 'review', 'codex-review']);
    // The same gate with the log switched off: every other row is the same.
    const off = await runCheck(argv, { JS_HARNESS_GATE_LOG: 'off' }, gateDeps({ spawn: () => ({ ...sensorRan(), status }) }));
    assert.deepEqual([off.code, rowsOf(off.output)], [exit, rowsOf(output).filter((row) => !logRows(output).includes(row))]);
  }
  assert.equal(readGateHolder(home), null);

  // A refusal that could not be written is said the same way, beside the row that fails the gate.
  const other = await takeGateLock({ home, ...OTHER_GATE, beatMs: 0 });
  try {
    const { code, output } = await runCheck([...argv, '--no-wait'], {}, gateDeps());
    assert.equal(code, 1);
    assert.deepEqual(rowsOf(output).map((row) => row.split('  ')[1]), ['budget', 'contracts', 'payload claude', 'payload codex', 'fixed load', 'gate', 'gate log', 'review', 'codex-review']);
    assert.match(logRows(output)[0], /^INFO {2}gate log {2}could not be written \(E[A-Z]+: [^\n]*\), so this refusal is not in it$/);
  } finally {
    other.release();
  }

  // An end that could not be written, after a start that could: the row says which.
  const lost = capturedLog((event) => (event.event === 'end' ? { error: 'EBUSY: resource busy or locked' } : undefined));
  const { code, output } = await runCheck(argv, {}, gateDeps(lost.deps));
  assert.deepEqual([code, logRows(output)], [0, ['INFO  gate log  could not be written (EBUSY: resource busy or locked), so the end of this gate is not in it']]);
  assert.equal(fs.readFileSync(gateLogDir(home), 'utf8'), 'not a folder');
}));

// --- the stop: a gate whose static row already fails runs nothing after it ---
// A row known in a second (the budget, a contract) was printed after the sensors, so a failure that could
// not pass cost the wait for the lock and the whole run of the sensors before anyone read it. The order
// changes when a failure is known, never what a commit proves: such a gate was red before, and is red now.

/** Puts the AGENTS.md of `dir` over its budget: the static row a test fails by itself. */
const overBudget = (dir) => fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat((TOKEN_BUDGET + 1) * 4));
const BUDGET_FAILS = `FAIL  budget  ${TOKEN_BUDGET + 1} estimated tokens (budget ${TOKEN_BUDGET})`;
const STATIC_ROWS = ['budget', 'contracts', 'payload claude', 'payload codex', 'fixed load'];
const namesOf = (output) => rowsOf(output).map((row) => row.split('  ')[1]);

const LOCK_NOT_TAKEN = "the machine's gate lock was not taken";
const LOCK_LEFT_TO_PARENT = "the machine's gate lock was left to the process that started this gate, which holds it (JS_HARNESS_GATE_HELD=1)";
/** The one row of a gate that stopped before its sensors because `rows` failed. */
const stoppedRow = (rows, lock = LOCK_NOT_TAKEN) =>
  `FAIL  gate  no sensor ran: this gate stopped before its sensors, since ${rows.length === 1 ? `the row ${rows[0]} fails` : `the rows ${rows.join(', ')} fail`}, so no test ran and nothing here says that the tests pass; ${lock}`;

/** Stand-ins for all a gate does after its static rows, each counting how it was asked: the lock, which
 * cannot be taken, so that a gate which asks for it runs its sensors without it and does not wait; the
 * sample of the load; the sensors; git; gentle-ai. */
function afterStaticRows(over = {}) {
  const asked = { lock: 0, load: 0, sensors: 0, git: [], gentleAi: 0 };
  const deps = {
    takeGateLock: async () => {
      asked.lock += 1;
      throw new Error('not to be asked');
    },
    sampleLoad: async () => {
      asked.load += 1;
      return LOADED;
    },
    spawn: () => {
      asked.sensors += 1;
      return sensorRan();
    },
    git: (program, args) => {
      asked.git.push(`${program} ${args.join(' ')}`);
      return notARepository();
    },
    gentleAi: () => {
      asked.gentleAi += 1;
      return gentleAiNotFound();
    },
    ...over,
  };
  return { asked, deps };
}
const NOTHING_ASKED = { lock: 0, load: 0, sensors: 0, git: [], gentleAi: 0 };

test('a gate whose static row fails stops before its sensors: it asks for no lock, samples no load, runs no sensor, asks neither git nor gentle-ai, and one FAIL row named gate says so, after which no row comes', () => withGate({ tests: 'run-tests', lint: 'run-lint' }, async (dir, home) => {
  const argv = ['--cwd', dir, '--home', home];
  overBudget(dir);
  const log = capturedLog();
  const { asked, deps } = afterStaticRows(log.deps);
  const { code, output, errOutput } = await runCheck(argv, {}, deps);
  assert.equal(code, 1, output);
  assert.deepEqual(asked, NOTHING_ASKED);
  assert.equal(errOutput, '');
  assert.equal(rowsOf(output)[0], BUDGET_FAILS);
  assert.deepEqual(gateRows(output), [stoppedRow(['budget'])]);
  // No `load`, no sensor, no `review` and no `codex-review`: the row of the stop is the last one.
  assert.deepEqual(namesOf(output), [...STATIC_ROWS, 'gate']);
  assert.doesNotMatch(output, /^PASS {2}(tests|lint) /m);
  assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'nothing of the lock was written');

  // The same stand-ins are all asked once the budget passes, so the silence above is not their own; and a
  // gate whose static rows pass is the gate it was: the same rows, in the same order, with the same exit.
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(400));
  const passing = await runCheck(argv, {}, deps);
  assert.equal(passing.code, 0, passing.output);
  assert.deepEqual({ ...asked, git: asked.git.length > 0 }, { lock: 1, load: 1, sensors: 2, git: true, gentleAi: 1 });
  assert.deepEqual(namesOf(passing.output), [...STATIC_ROWS, 'gate', 'load', 'tests', 'lint', 'review', 'codex-review']);
  assert.match(gateRows(passing.output)[0], /^INFO {2}gate {2}the sensors ran without the machine's gate lock, /);
}));

// No row is named in the rule: whatever row failed before the sensors stops them, so a row added to the
// static ones stops the gate by being there. The rows that only inform (`payload`) stop nothing.
test('the gate that stops names every row that failed, whichever they are, and a red sensor alone is no stop', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const argv = ['--cwd', dir, '--home', home];
  const stopped = async () => {
    const { asked, deps } = afterStaticRows(capturedLog().deps);
    const { code, output } = await runCheck(argv, {}, deps);
    assert.deepEqual([code, asked], [1, NOTHING_ASKED], output);
    assert.deepEqual(namesOf(output), [...STATIC_ROWS, 'gate']);
    return gateRows(output);
  };
  writeTask(dir, 'bad.md', BAD_CONTRACT);
  assert.deepEqual(await stopped(), [stoppedRow(['contracts'])]);
  overBudget(dir);
  assert.deepEqual(await stopped(), [stoppedRow(['budget', 'contracts'])]);
  fs.rmSync(path.join(dir, 'odd'), { recursive: true });
  assert.deepEqual(await stopped(), [stoppedRow(['budget'])]);

  // A sensor that fails is a row of its own, after which the rows that inform still come.
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(400));
  const red = await runCheck(argv, {}, gateDeps({ spawn: () => ({ ...sensorRan(), status: 3 }), ...capturedLog().deps }));
  assert.equal(red.code, 1);
  assert.deepEqual([namesOf(red.output), gateRows(red.output)], [[...STATIC_ROWS, 'load', 'tests', 'review', 'codex-review'], []]);
}));

// A row that states a rule of the project is the first of the static rows, so it is the first row of a
// stopped gate and the first one the stop names. The register here has an entry with no class.
test('a register of failures that is not read stops the gate before its sensors, and its row comes first in the report and in what the stop names', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  fs.mkdirSync(path.join(dir, 'docs'));
  const register = ['## Classes', '- `machine` — load', '', '## Entries', '', '### gate-at-its-bound', 'A gate reached its bound.', '- Seen: 2026-10-10 — relief file, line 224 — a gate at its bound', ''];
  fs.writeFileSync(path.join(dir, 'docs', 'FAILURES.md'), register.join('\n'));
  const run = async () => {
    const { asked, deps } = afterStaticRows(capturedLog().deps);
    const { code, output } = await runCheck(['--cwd', dir, '--home', home], {}, deps);
    assert.deepEqual([code, asked], [1, NOTHING_ASKED], output);
    assert.deepEqual(namesOf(output), ['failures', ...STATIC_ROWS, 'gate']);
    return gateRows(output);
  };
  assert.deepEqual(await run(), [stoppedRow(['failures'])]);
  overBudget(dir);
  assert.deepEqual(await run(), [stoppedRow(['failures', 'budget'])]);
}));

test('a gate that stops makes no folder under its home where the lock is free, waits for no gate that holds it, and leaves it to the process that started it', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const argv = ['--cwd', dir, '--home', home];
  overBudget(dir);

  // Free, and with the real lock: it is not taken, and the folder a lock is made in never was.
  const spawn = countedSensors();
  const free = await runCheck(argv, {}, gateDeps({ spawn, ...capturedLog().deps }));
  assert.deepEqual([free.code, spawn.ran, gateRows(free.output)], [1, 0, [stoppedRow(['budget'])]]);
  assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'the home was written to');

  // Held by another gate, and no `--no-wait`: a gate that asked for the lock would wait an hour for it.
  const other = await takeGateLock({ home, ...OTHER_GATE, beatMs: 0 });
  try {
    const { asked, deps } = afterStaticRows(capturedLog().deps);
    const held = await runCheck(argv, {}, deps);
    assert.deepEqual([held.code, asked, held.errOutput], [1, NOTHING_ASKED, '']);
    assert.deepEqual(gateRows(held.output), [stoppedRow(['budget'])]);
    assert.deepEqual(fs.readdirSync(gateDir(home)), ['lock'], 'it stood in no line');
    assert.equal(readGateHolder(home).pid, 4321);
    assert.equal(other.lost(), false);

    // Held by the process that started this gate (`js-harness gate -- npm run check`): that process waited
    // its turn before this check computed anything, so the stop saves the sensors there, not the wait.
    const inTurn = afterStaticRows(capturedLog().deps);
    const parent = await runCheck(argv, { JS_HARNESS_GATE_HELD: '1' }, inTurn.deps);
    assert.deepEqual([parent.code, inTurn.asked, parent.errOutput], [1, NOTHING_ASKED, '']);
    // One row of the lock, which does not say that the sensors ran in that turn: none did.
    assert.deepEqual(gateRows(parent.output), [stoppedRow(['budget'], LOCK_LEFT_TO_PARENT)]);
    assert.deepEqual(namesOf(parent.output), [...STATIC_ROWS, 'gate']);
    assert.equal(readGateHolder(home).pid, 4321);
  } finally {
    other.release();
  }
}));

test('a push and the inner check are as they were beside a failing static row: neither stops, and neither says that it did', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const argv = ['--cwd', dir, '--home', home];
  overBudget(dir);
  // The inner check runs no sensor, so it has none to stop before: its budget row fails it, and the row
  // of the Codex debt, which reads commits and never the working tree, is still its last.
  const inner = afterStaticRows();
  const within = await runCheck(argv, { JS_HARNESS_CHECK_INNER: '1' }, inner.deps);
  assert.equal(within.code, 1);
  assert.deepEqual(namesOf(within.output), [...STATIC_ROWS, 'codex-review']);
  assert.equal(rowsOf(within.output)[0], BUDGET_FAILS);
  assert.deepEqual({ ...inner.asked, git: inner.asked.git.length > 0 }, { ...NOTHING_ASKED, git: true });

  // A push computes no static row at all: its one row is the one it always had.
  const pushed = afterStaticRows();
  const push = await runCheck(['--push', ...argv], {}, pushed.deps);
  assert.deepEqual(namesOf(push.output), ['codex-review']);
  // A push asks git through `deps.spawn` (`checkCodexReviews`), which this stand-in counts with the sensors,
  // so what is asserted of it is what a push never asks for: the lock, the load, gentle-ai.
  assert.deepEqual([pushed.asked.lock, pushed.asked.load, pushed.asked.gentleAi], [0, 0, 0]);
  assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);
}));

// Decided after the declarations are read: a faulty one is named in the same run as the failing budget, and
// where no sensor would have run there is nothing to stop, nothing to count and nothing new to say.
test('a failing static row stops nothing where no sensor would have run: a faulty declaration, no sensor declared and a commit of documents alone end as they did, and the same commit with a code file in it stops', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const argv = ['--cwd', dir, '--home', home];
  overBudget(dir);
  const log = capturedLog();
  const unstopped = async (harness, sensors, git) => {
    if (typeof harness === 'string') fs.writeFileSync(path.join(dir, 'harness.json'), harness);
    else writeJson(dir, 'harness.json', harness);
    const { asked, deps } = afterStaticRows({ ...log.deps, ...(git && { git }) });
    const { code, output } = await runCheck(argv, {}, deps);
    assert.equal(code, 1, output);
    assert.deepEqual([asked.lock, asked.load, asked.sensors], [0, 0, 0], output);
    assert.deepEqual(namesOf(output), [...STATIC_ROWS, 'sensors', 'review', 'codex-review'], output);
    assert.deepEqual([gateRows(output), rowsOf(output)[0]], [[], BUDGET_FAILS]);
    assert.match(rowsOf(output)[STATIC_ROWS.length], sensors);
  };
  await unstopped('{ nope', /^FAIL {2}sensors {2}harness\.json is not valid JSON: /);
  await unstopped({ sensors: { tests: 'run-tests' }, documents: ['docs/*'] }, /^FAIL {2}sensors {2}harness\.json "documents" must be /);
  await unstopped({ sensors: {} }, /^INFO {2}sensors {2}harness\.json declares no sensors, so none ran$/);
  const documents = { sensors: { tests: 'run-tests' }, documents: ['docs/'] };
  await unstopped(documents, /^INFO {2}sensors {2}no sensor ran \(tests\): the one staged path is a document /, stagedGit(['docs/guide.md']));
  assert.deepEqual(log.events, []);

  // With a code file staged beside the document the sensors would have run: that gate stops, having asked
  // git what is staged and nothing after it.
  const git = stagedGit(['docs/guide.md', 'src/app.js']);
  const { asked, deps } = afterStaticRows({ ...log.deps, git });
  const { code, output } = await runCheck(argv, {}, deps);
  assert.deepEqual([code, { ...asked, git: git.asked }], [1, { ...NOTHING_ASKED, git: ['git rev-parse --show-prefix', 'git diff --cached --name-only --no-renames --no-relative --ignore-submodules=none -z', ...['origin/HEAD', 'origin/main', 'origin/master', 'MERGE_HEAD'].map((ref) => `git rev-parse --verify --quiet ${ref}^{commit}`)] }]);
  assert.deepEqual([namesOf(output), gateRows(output)], [[...STATIC_ROWS, 'gate'], [stoppedRow(['budget'])]]);
  assert.deepEqual(log.events.map(({ event }) => event), ['stopped']);
}));

// A start without an end reads as a gate that was killed, and a refusal as a gate that found the lock held.
// A gate that stopped is neither: one line of its own kind, with the rows that stopped it.
test('a gate that stops writes one line of the kind stopped in the gate log, with the rows that stopped it and no start, whether the lock is free or its parent\'s', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  overBudget(dir);
  writeTask(dir, 'bad.md', BAD_CONTRACT);
  for (const env of [{}, { JS_HARNESS_GATE_HELD: '1' }]) {
    const log = capturedLog();
    const { code, output } = await runCheck(['--cwd', dir, '--home', home], env, afterStaticRows(log.deps).deps);
    assert.equal(code, 1, output);
    assert.deepEqual(log.homes, [home]);
    assert.deepEqual(log.events.map((event) => ({ ...event, id: '', at: '' })), [{ v: 1, event: 'stopped', id: '', at: '', cwd: path.resolve(dir), command: 'check', pid: process.pid, rows: ['budget', 'contracts'] }]);
    assert.match(log.events[0].id, /^[0-9a-f-]{36}$/);
    assert.ok(isIsoTime(log.events[0].at));
    assert.doesNotMatch(output, /gate log/);
  }
}));

test('the line of a gate that stopped honors the switches of the log, is read back from the real file as a gate that stopped, and one that cannot be written is said in the gate log row and changes nothing else', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const argv = ['--cwd', dir, '--home', home];
  overBudget(dir);
  // Switched off, or a gate with no home to write in: nothing is written, and the gate stops all the same.
  const log = capturedLog();
  const off = await runCheck(argv, { JS_HARNESS_GATE_LOG: 'off' }, afterStaticRows(log.deps).deps);
  assert.deepEqual([off.code, gateRows(off.output)], [1, [stoppedRow(['budget'])]]);
  const noHome = await checkSensors(dir, afterStaticRows(log.deps).deps, { wait: true, waitMinutes: 60, stoppedBy: ['budget'] });
  assert.deepEqual(noHome.map((row) => [row.name, row.pass, row.info]), [['gate', false, undefined]]);
  assert.deepEqual(log.events, []);
  assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);
  // A caller that is no gate hands no rows, and one that hands none that failed runs its sensors.
  const spawn = countedSensors();
  await checkSensors(dir, { spawn });
  await checkSensors(dir, { spawn, takeGateLock: lockTakenAtOnce(), git: notARepository }, { home, wait: true, waitMinutes: 60, load: false, log: false, stoppedBy: [] });
  assert.equal(spawn.ran, 2);

  // With the writer of the real log: one line, in the folder of the log alone, read back as what it was.
  const real = await runCheck(argv, {}, afterStaticRows().deps);
  assert.equal(real.code, 1);
  assert.doesNotMatch(real.output, /gate log/);
  assert.deepEqual(fs.readdirSync(path.join(home, '.js-harness')), ['gate-log'], 'it took no lock');
  const { events, skipped } = readGateLog(home);
  assert.deepEqual([events.map(({ event, cwd, rows }) => [event, cwd, rows]), skipped], [[['stopped', path.resolve(dir), ['budget']]], 0]);
  assert.deepEqual(gatesOf(events), [{ stopped: events[0] }]);

  // The folder's path is taken by a file: the row says what is missing from the log, and the gate is red
  // for its budget as it was, with the row of the stop before it.
  fs.rmSync(path.join(home, '.js-harness'), { recursive: true });
  fs.mkdirSync(path.join(home, '.js-harness'));
  fs.writeFileSync(gateLogDir(home), 'not a folder');
  const unwritten = await runCheck(argv, {}, afterStaticRows().deps);
  assert.equal(unwritten.code, 1);
  assert.deepEqual(namesOf(unwritten.output), [...STATIC_ROWS, 'gate', 'gate log']);
  assert.match(rowsOf(unwritten.output).at(-1), /^INFO {2}gate log {2}could not be written \(E[A-Z]+: [^\n]*\), so this stop is not in it$/);
  assert.deepEqual(gateRows(unwritten.output), [stoppedRow(['budget'])]);
  assert.equal(fs.readFileSync(gateLogDir(home), 'utf8'), 'not a folder');
}));

// --- what the sensors leave in the working tree: the untracked paths that appeared while they ran ---
// A test that writes into the tree it is run in leaves a file nobody asked for, and the commit that follows
// finds it untracked with nothing to say where it came from. The gate lists the untracked paths before and
// after its sensors and names the ones that appeared; a gate that names none is the proof that none did.

const TREE_ASKED = 'git --no-optional-locks status --porcelain -z --untracked-files=all';
/** One question about the working tree of `dir`, as `treeGit` keeps it: bounded at twenty seconds, since it
 * is asked inside the gate's turn and a git that hangs would hold the lock, and bound to no index. */
const treeAsked = (dir) => ({ line: TREE_ASKED, cwd: dir, timeout: 20_000, bound: [] });

/** A stand-in for the git a gate asks about its working tree: each of `listings` is what one `git status`
 * answers, the entries of `--porcelain -z` or a function that answers in their place. It keeps how it was
 * asked, and calls `during` each time; any other question is answered as outside a repository. */
function treeGit(listings, during = () => {}) {
  const left = [...listings];
  const spawn = (program, args, options) => {
    if (!args.includes('status')) return notARepository();
    spawn.asked.push({ line: `${program} ${args.join(' ')}`, cwd: options.cwd, timeout: options.timeout, bound: Object.keys(options.env ?? process.env).filter((key) => /^git_(dir|index_file|work_tree|common_dir|prefix)$/i.test(key)) });
    during();
    const listing = left.shift();
    return typeof listing === 'function' ? listing() : ok((listing ?? []).map((entry) => `${entry}\0`).join(''));
  };
  spawn.asked = [];
  return spawn;
}

const treeRows = (output) => rowsOf(output).filter((line) => /^\w+ {2}tree {2}/.test(line));
/** The `tree` row of a report with the lines under it, as printed. */
function treeRow(output) {
  const lines = output.split('\n');
  const at = lines.findIndex((line) => /^\w+ {2}tree {2}/.test(line));
  if (at === -1) return [];
  const under = lines.slice(at + 1);
  const end = under.findIndex((line) => !line.startsWith('      '));
  return [lines[at], ...under.slice(0, end === -1 ? under.length : end).map((line) => line.trim())];
}

const CACHE = 'Microsoft/Windows/PowerShell/ModuleAnalysisCache';
const WAS_THERE = ['?? notes.txt', ' M bin/check.mjs', 'A  bin/new.mjs'];

test('a gate lists the untracked paths of its working tree before its first sensor and after its last, inside its turn, and names the ones that appeared in one INFO row named tree, in each of the three states of the lock', () => withGate({ tests: 'run-tests', lint: 'run-lint' }, async (dir, home) => {
  for (const { state, env, deps, gate, holder } of LOCK_STATES) {
    const { events, sampleLoad, spawn } = sampledGate(home);
    const log = capturedLog((event) => void events.push(event.event));
    const git = treeGit([WAS_THERE, [...WAS_THERE, `?? ${CACHE}`, '?? out put.txt']], () => events.push(['tree', readGateHolder(home)?.pid]));
    const { code, output } = await runCheck(['--cwd', dir, '--home', home], env, gateDeps({ spawn, sampleLoad, git, ...deps, ...log.deps }));
    assert.equal(code, 0, `${state}: ${output}`);
    // Before the start of the gate is written and after its end, so the seconds of the log are the sensors'.
    assert.deepEqual(events, [['sample', holder], ['tree', holder], 'start', 'run-tests', 'run-lint', 'end', ['tree', holder]], state);
    assert.deepEqual(git.asked, [treeAsked(dir), treeAsked(dir)], state);
    assert.deepEqual(treeRow(output), ['INFO  tree  2 untracked paths appeared in the working tree while the sensors ran (a test may have written them)', CACHE, 'out put.txt'], state);
    assert.deepEqual(namesOf(output), [...STATIC_ROWS, ...gate, 'load', 'tests', 'lint', 'tree', 'review', 'codex-review'], state);
  }
}));

test('the tree row names no path that was untracked before the sensors, takes the old name of a rename for no path, shows the first ten of many and a name with a control character as JSON, and fails nothing', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const argv = ['--cwd', dir, '--home', home];
  const said = async (before, after, spawn = sensorRan) => {
    const { code, output } = await runCheck(argv, {}, gateDeps({ spawn, git: treeGit([before, after]) }));
    return { code, row: treeRow(output) };
  };
  const one = 'INFO  tree  1 untracked path appeared in the working tree while the sensors ran (a test may have written it)';
  assert.deepEqual(await said(['?? notes.txt'], ['?? notes.txt', '?? left.txt']), { code: 0, row: [one, 'left.txt'] });
  // A path that went away is no news of this row, and one that was modified or staged is not untracked.
  assert.deepEqual(await said(['?? notes.txt', '?? gone.txt'], ['?? notes.txt', ' M bin/check.mjs', 'A  bin/new.mjs', 'D  old.txt']), { code: 0, row: [] });
  // A rename is two entries, the second the name it had, with no status before it: `?? was.txt` is the
  // whole of an old name here, and names no untracked path.
  assert.deepEqual(await said([], ['R  now.txt', '?? was.txt', 'C  copy.txt', '?? source.txt', '?? left.txt']), { code: 0, row: [one, 'left.txt'] });
  const many = Array.from({ length: 13 }, (_, at) => `tmp/${String(at + 1).padStart(2, '0')}.log`);
  const thirteen = await said([], many.map((file) => `?? ${file}`));
  assert.deepEqual(thirteen.row, ['INFO  tree  13 untracked paths appeared in the working tree while the sensors ran (a test may have written them)', ...many.slice(0, 10), 'and 3 more']);
  assert.deepEqual((await said([], ['?? a\nFAIL  tests  x', '?? ñ ok.txt'])).row.slice(1), ['"a\\nFAIL  tests  x"', 'ñ ok.txt']);
  // Beside a sensor that fails the row is there all the same, and the gate is red for the sensor alone.
  const red = await said([], ['?? left.txt'], () => ({ ...sensorRan(), status: 3 }));
  assert.deepEqual(red, { code: 1, row: [one, 'left.txt'] });
}));

test('no tree row, and no failure, when nothing appeared, when the folder is no git work tree, or when git could not be asked either time', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const argv = ['--cwd', dir, '--home', home];
  const enoent = () => Object.assign(new Error('spawnSync git ENOENT'), { code: 'ENOENT' });
  const fails = {
    'no work tree': notARepository,
    'no git': () => ({ status: null, stdout: '', stderr: '', error: enoent() }),
    'a git that throws': () => {
      throw enoent();
    },
    // What `spawnSync` answers for a git it ended at its timeout.
    'a git that does not return': () => ({ status: null, signal: 'SIGTERM', stdout: '', stderr: '', error: Object.assign(new Error('spawnSync git ETIMEDOUT'), { code: 'ETIMEDOUT' }) }),
    'no answer': () => undefined,
    'an answer that is no text': () => ({ status: 0, stdout: null, stderr: '' }),
  };
  const appeared = ['?? left.txt'];
  const cases = { 'nothing appeared': [[appeared, appeared], 2] };
  for (const [name, fail] of Object.entries(fails)) {
    // Not asked again after the sensors where it did not answer before them: there is nothing to compare.
    cases[`${name}, before the sensors`] = [[fail, appeared], 1];
    cases[`${name}, after them`] = [[[], fail], 2];
  }
  for (const [name, [listings, times]] of Object.entries(cases)) {
    const spawn = countedSensors();
    const git = treeGit(listings);
    const { code, output } = await runCheck(argv, {}, gateDeps({ spawn, git }));
    assert.deepEqual([code, spawn.ran, treeRows(output), git.asked.length], [0, 1, [], times], `${name}: ${output}`);
    assert.deepEqual(namesOf(output), [...STATIC_ROWS, 'load', 'tests', 'review', 'codex-review'], name);
  }
}));

// A gate started by a hook inherits the variables that bind git to the hook's repository and to the index
// of the commit. The tree is the one of the folder the gate checks, where its sensors run with none of those
// variables: asked with them, a `check --cwd <another project>` would hold that project's files against the
// index of the hook's repository.
test('a gate asks git about its working tree with none of the variables that bind git to a repository, and takes none of the locks git can do without', () => withGate({ tests: 'run-tests' }, async (dir, home) => {
  const git = treeGit([[], ['?? left.txt']]);
  const { code, output } = await withEnv({ GIT_DIR: path.join(home, 'other', '.git'), GIT_INDEX_FILE: path.join(home, 'other', '.git', 'index.lock'), Git_Work_Tree: home, GIT_PREFIX: 'docs/' }, () =>
    runCheck(['--cwd', dir, '--home', home], {}, gateDeps({ git })));
  assert.equal(code, 0, output);
  assert.deepEqual(git.asked, [treeAsked(dir), treeAsked(dir)]);
  assert.equal(treeRows(output).length, 1);
}));

test('nothing is asked about the working tree where no gate runs a sensor: a caller that is no gate, the inner run, a push, no sensor declared, a commit of documents alone, a gate that stopped', async () => {
  const dir = sensorProject({ tests: 'run-tests' });
  const none = sensorProject({});
  const home = makeTmpDir();
  try {
    /** A git that answers what is staged as `staged` does, and counts the questions about the tree. */
    const counting = (staged = notARepository) => {
      const git = (program, args, options) => {
        if (!args.includes('status')) return staged(program, args, options);
        git.tree += 1;
        return ok('?? left.txt\0');
      };
      git.tree = 0;
      return git;
    };
    const git = counting();
    const rows = await checkSensors(dir, { spawn: sensorRan, git });
    assert.deepEqual(rows.map((row) => row.name), ['tests']);

    const deps = { gentleAi: gentleAiNotFound, takeGateLock: lockTakenAtOnce(), spawn: sensorRan, ...capturedLog().deps };
    const argv = ['--cwd', dir, '--home', home];
    const silent = {
      inner: await runCheck(argv, { JS_HARNESS_CHECK_INNER: '1' }, { ...deps, git }),
      push: await runCheck(['--push', ...argv], {}, { ...deps, git }),
      'no sensor': await runCheck(['--cwd', none, '--home', home], {}, { ...deps, git }),
    };
    writeJson(dir, 'harness.json', { sensors: { tests: 'run-tests' }, documents: ['docs/'] });
    const documents = counting(stagedGit(['docs/guide.md']));
    silent['documents alone'] = await runCheck(argv, {}, { ...deps, git: documents });
    overBudget(dir);
    const code = counting(stagedGit(['src/app.js']));
    silent.stopped = await runCheck(argv, {}, { ...deps, git: code });
    for (const [what, { output }] of Object.entries(silent)) assert.deepEqual(treeRows(output), [], `${what}: ${output}`);
    assert.deepEqual([git.tree, documents.tree, code.tree], [0, 0, 0]);

    // The same stand-in is asked twice once that gate runs its sensor, so the silence above is not its own.
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(400));
    const gate = await runCheck(argv, {}, { ...deps, git: code });
    assert.deepEqual([gate.code, code.tree, treeRows(gate.output)], [0, 2, []], gate.output);
  } finally {
    for (const folder of [dir, none, home]) fs.rmSync(folder, { recursive: true, force: true });
  }
});

// From here on, real git in real repositories: what `git diff --cached` lists is the fact the rule stands on.

/** A sensor that fails: a gate that ran it is red with a `tests` row, one that ran none is green without. */
const FAILING_SENSOR = { tests: exits(7) };

function writeFile(root, file, text = 'two\n') {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
}

const commitAs = ['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '--quiet'];

let documentsBase;
after(() => {
  if (documentsBase) fs.rmSync(documentsBase, { recursive: true, force: true });
});

/** A repository of one commit whose `docs/` and `notes.md` are declared documents and whose one sensor
 * fails. Built once and copied for each test, as the fixtures of codex-review.test.mjs are. */
function documentsRepo() {
  if (!documentsBase) {
    documentsBase = makeTmpDir();
    writeFile(documentsBase, 'AGENTS.md', 'a'.repeat(400));
    writeJson(documentsBase, 'harness.json', { sensors: FAILING_SENSOR, documents: ['docs/', 'notes.md'] });
    for (const file of ['docs/guide.md', 'docs/old.md', 'notes.md', 'docs-internal/x.md', 'src/app.js']) writeFile(documentsBase, file, 'one\n');
    git(documentsBase, 'init', '--quiet');
    git(documentsBase, 'add', '.');
    git(documentsBase, ...commitAs, '-m', 'root');
  }
  const repo = makeTmpDir();
  fs.cpSync(documentsBase, repo, { recursive: true });
  return repo;
}

/** The `sensors` row of a report with the lines under it, as printed. */
function sensorsRow(output) {
  const lines = output.split('\n');
  const at = lines.findIndex((line) => /^\w+ {2}sensors {2}/.test(line));
  if (at === -1) return [];
  const under = lines.slice(at + 1);
  const end = under.findIndex((line) => !line.startsWith('      '));
  return [lines[at], ...under.slice(0, end === -1 ? under.length : end).map((line) => line.trim())];
}

/** What the `sensors` row of a gate that ran no sensor for the staged documents `paths` says. */
const noSensorRan = (paths) => [
  `INFO  sensors  no sensor ran (tests): ${paths.length === 1 ? 'the one staged path is a document' : `all ${paths.length} staged paths are documents`} declared in harness.json "documents"`,
  ...paths,
];

/** Runs the gate of `repo` with real git and its real sensor, and says whether the sensor ran: a gate that
 * skipped it is green and names `documents`, one that ran it is red on its `tests` row alone. */
async function gateOfStaged(repo, documents) {
  const { code, output } = await runCheck(['--cwd', repo], {});
  if (documents) {
    assert.equal(code, 0, output);
    assert.deepEqual(sensorsRow(output), noSensorRan(documents));
    assert.doesNotMatch(output, /^\w+ {2}tests /m);
  } else {
    assert.equal(code, 1, output);
    assert.match(output, /^FAIL {2}tests {2}node -e "process\.exit\(7\)" exited 7$/m);
    assert.deepEqual(sensorsRow(output), []);
  }
  assert.deepEqual(rowsOf(output).filter((line) => line.startsWith('FAIL') && !/^FAIL {2}tests /.test(line)), []);
}

const STAGED = [
  {
    name: 'documents alone, changed and new',
    stage: (repo) => {
      for (const file of ['docs/guide.md', 'notes.md', 'docs/deep/new.md']) writeFile(repo, file);
      git(repo, 'add', '.');
    },
    documents: ['docs/deep/new.md', 'docs/guide.md', 'notes.md'],
  },
  {
    name: 'a document and a code file',
    stage: (repo) => {
      for (const file of ['docs/guide.md', 'src/app.js']) writeFile(repo, file);
      git(repo, 'add', '.');
    },
  },
  {
    name: 'a code file alone',
    stage: (repo) => {
      writeFile(repo, 'src/app.js');
      git(repo, 'add', '.');
    },
  },
  // A check run by hand, or a commit of nothing: there is no change to call a change of documents.
  { name: 'nothing, with a document changed in the working tree', stage: (repo) => writeFile(repo, 'docs/guide.md') },
  { name: 'a document renamed out of the documents', stage: (repo) => git(repo, 'mv', 'docs/old.md', 'src/old.md') },
  // Without `--no-renames` git lists a rename by its new path alone, and this one would read as a document.
  { name: 'a code file renamed into the documents', stage: (repo) => git(repo, 'mv', 'src/app.js', 'docs/app.js') },
  { name: 'a document renamed among the documents', stage: (repo) => git(repo, 'mv', 'docs/old.md', 'docs/older.md'), documents: ['docs/old.md', 'docs/older.md'] },
  // The commit holds what is staged; what else changed in the working tree is not part of it.
  {
    name: 'a document, with a code file changed and not staged',
    stage: (repo) => {
      for (const file of ['docs/guide.md', 'src/app.js']) writeFile(repo, file);
      git(repo, 'add', 'docs/guide.md');
    },
    documents: ['docs/guide.md'],
  },
  { name: 'the removal of a document', stage: (repo) => git(repo, 'rm', '--quiet', 'docs/old.md'), documents: ['docs/old.md'] },
  {
    name: 'a path that only starts with the letters of a declared folder',
    stage: (repo) => {
      writeFile(repo, 'docs-internal/x.md');
      git(repo, 'add', '.');
    },
  },
  // A submodule is a path of the commit like any other, whatever git is set to leave out of a diff: with
  // `diff.ignoreSubmodules` git lists neither a submodule that is new nor one moved to another commit.
  {
    name: 'a document and a new submodule that git is set to ignore',
    stage: (repo) => {
      git(repo, 'config', 'diff.ignoreSubmodules', 'all');
      writeFile(repo, 'docs/guide.md');
      git(repo, 'add', 'docs/guide.md');
      git(repo, 'update-index', '--add', '--cacheinfo', `160000,${'1'.repeat(40)},vendor/lib`);
    },
  },
  {
    name: 'a document and a submodule moved to another commit, which git is set to ignore',
    stage: (repo) => {
      git(repo, 'update-index', '--add', '--cacheinfo', `160000,${'1'.repeat(40)},vendor/lib`);
      git(repo, ...commitAs, '-m', 'submodule');
      git(repo, 'config', 'diff.ignoreSubmodules', 'all');
      writeFile(repo, 'docs/guide.md');
      git(repo, 'add', 'docs/guide.md');
      git(repo, 'update-index', '--cacheinfo', `160000,${'2'.repeat(40)},vendor/lib`);
    },
  },
  {
    name: 'Markdown alone in a project that declares no documents',
    stage: (repo) => {
      writeJson(repo, 'harness.json', { sensors: FAILING_SENSOR });
      writeFile(repo, 'docs/guide.md');
      git(repo, 'add', 'docs/guide.md');
    },
  },
];

for (const { name, stage, documents } of STAGED) {
  test(`a gate with ${name} staged ${documents ? 'runs no sensor, and says so' : 'runs its sensors'}`, async () => {
    const repo = documentsRepo();
    try {
      stage(repo);
      await gateOfStaged(repo, documents);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
}

test('a contract broken by a commit of documents alone still fails the gate, which runs no sensor', async () => {
  const repo = documentsRepo();
  try {
    writeJson(repo, 'harness.json', { sensors: FAILING_SENSOR, documents: ['odd/tasks/'] });
    writeTask(repo, 'broken.md', BAD_CONTRACT);
    git(repo, 'add', 'odd/tasks/broken.md');
    const { code, output } = await runCheck(['--cwd', repo], {});
    assert.equal(code, 1, output);
    assert.deepEqual(rowsOf(output).filter((line) => line.startsWith('FAIL')), ['FAIL  contracts  1 of 1 contract fail']);
    assert.match(output, /^ {6}odd\/tasks\/broken\.md$/m);
    assert.deepEqual(sensorsRow(output), noSensorRan(['odd/tasks/broken.md']));
    assert.doesNotMatch(output, /^\w+ {2}tests /m);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// With no commit yet there is no HEAD to compare with, and git lists everything staged as added.
test('a first commit of documents alone runs no sensor, and one that holds harness.json runs them', async () => {
  const repo = makeTmpDir();
  try {
    git(repo, 'init', '--quiet');
    writeFile(repo, 'AGENTS.md', 'a'.repeat(400));
    writeJson(repo, 'harness.json', { sensors: FAILING_SENSOR, documents: ['docs/'] });
    writeFile(repo, 'docs/guide.md');
    git(repo, 'add', 'docs/guide.md');
    await gateOfStaged(repo, ['docs/guide.md']);
    git(repo, 'add', 'harness.json');
    await gateOfStaged(repo, null);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('a gate that checks a folder below the top of its repository runs its sensors, and so does one of a folder that is no repository', async () => {
  const repo = documentsRepo();
  const plain = makeTmpDir();
  try {
    const below = path.join(repo, 'packages', 'app');
    for (const dir of [below, plain]) {
      writeFile(dir, 'AGENTS.md', 'a'.repeat(400));
      writeJson(dir, 'harness.json', { sensors: FAILING_SENSOR, documents: ['docs/'] });
    }
    // Staged at the top of the repository, where `docs/` is not the `docs/` this folder declares.
    writeFile(repo, 'docs/guide.md');
    git(repo, 'add', 'docs/guide.md');
    await gateOfStaged(below, null);
    await gateOfStaged(plain, null);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(plain, { recursive: true, force: true });
  }
});

/** Runs `run` with `vars` added to the environment of this process, which is the one a gate asks git in. */
async function withEnv(vars, run) {
  const saved = { ...process.env };
  try {
    Object.assign(process.env, vars);
    return await run();
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
}

// A gate started inside a hook inherits the variables by which git bound that hook to its repository. With
// them, `check --cwd <another project>` would list what the hook's repository has staged and hold it
// against the other project's documents.
test('a gate started in the environment of another repository runs its sensors: what that one has staged is not its own', async () => {
  const [project, other] = [documentsRepo(), documentsRepo()];
  try {
    writeFile(other, 'docs/guide.md');
    git(other, 'add', 'docs/guide.md');
    const bound = { GIT_DIR: path.join(other, '.git'), GIT_INDEX_FILE: path.join(other, '.git', 'index') };
    // Bound as the hook of a linked worktree is, with nothing staged in the project.
    await withEnv(bound, () => gateOfStaged(project, null));
    // Bound as the hook of `git commit <path>` in a main worktree is, by the index alone, with a code file
    // staged in the project: its commit is not the one of documents that the other index describes.
    writeFile(project, 'src/app.js');
    git(project, 'add', 'src/app.js');
    await withEnv({ GIT_INDEX_FILE: bound.GIT_INDEX_FILE }, () => gateOfStaged(project, null));
    // The same binding is the other repository's own, and its gate runs no sensor for what it has staged.
    await withEnv(bound, () => gateOfStaged(other, ['docs/guide.md']));
  } finally {
    for (const dir of [project, other]) fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkSensors, where the environment binds git to a repository, asks which one its folder is in without that binding, and runs no sensor only where the two are one', async () => {
  const dir = makeTmpDir();
  const elsewhere = makeTmpDir();
  try {
    writeJson(dir, 'harness.json', { sensors: { tests: 'run-tests' }, documents: ['docs/'] });
    const own = path.join(dir, '.git');
    fs.mkdirSync(own);
    const slashes = (file) => file.replace(/\\/g, '/');
    /** A git whose folder is in the repository `own`, and which the inherited environment binds to `inherited`. */
    const boundGit = (inherited, { ownFails = false } = {}) => {
      const spawn = (program, args, options) => {
        const unbound = options.env !== undefined;
        spawn.asked.push(`${unbound ? 'unbound: ' : ''}${program} ${args.join(' ')}`);
        if (unbound) spawn.leaked.push(...Object.keys(options.env).filter((key) => /^git_(dir|index_file|work_tree|common_dir|prefix)$/i.test(key)));
        if (args[0] === 'diff') return ok('docs/guide.md\0');
        if (unbound) return ownFails ? notARepository() : ok(`\n${slashes(own)}\n`);
        return inherited === null ? notARepository() : ok(`${slashes(inherited)}\n`);
      };
      return Object.assign(spawn, { asked: [], leaked: [] });
    };
    const ran = async (vars, git = boundGit(own)) => {
      const spawn = countedSensors();
      await withEnv({ GIT_PREFIX: 'docs/', ...vars }, () => checkSensors(dir, { spawn, git }));
      return spawn.ran;
    };

    // What git hands the hook of a plain commit, of `commit -a` and of a commit in a linked worktree.
    const git = boundGit(own);
    assert.equal(await ran({ GIT_INDEX_FILE: '.git/index' }, git), 0);
    assert.deepEqual(git.asked, [
      'unbound: git rev-parse --show-prefix --absolute-git-dir',
      'git rev-parse --absolute-git-dir',
      'git diff --cached --name-only --no-renames --no-relative --ignore-submodules=none -z',
    ]);
    assert.deepEqual(git.leaked, []);
    assert.equal(await ran({ GIT_INDEX_FILE: path.join(own, 'index.lock') }), 0);
    assert.equal(await ran({ GIT_DIR: own, GIT_INDEX_FILE: slashes(path.join(own, 'index')) }), 0);
    assert.equal(await ran({ GIT_DIR: own }), 0);
    assert.equal(await ran({ GIT_WORK_TREE: dir }), 0);

    // Another repository, an index kept anywhere else, or a git that does not answer: the sensors run.
    assert.equal(await ran({ GIT_DIR: elsewhere }, boundGit(elsewhere)), 1);
    assert.equal(await ran({ GIT_INDEX_FILE: path.join(elsewhere, 'index') }), 1);
    assert.equal(await ran({ GIT_INDEX_FILE: path.join(own, 'gone', 'index') }), 1);
    assert.equal(await ran({ GIT_DIR: own }, boundGit(null)), 1);
    assert.equal(await ran({ GIT_DIR: own }, boundGit(own, { ownFails: true })), 1);

    // No such variable, no such question: `GIT_PREFIX`, which every hook is given, binds nothing.
    const plain = stagedGit(['docs/guide.md']);
    assert.equal(await ran({}, plain), 0);
    assert.deepEqual(plain.asked, ['git rev-parse --show-prefix', 'git diff --cached --name-only --no-renames --no-relative --ignore-submodules=none -z']);
  } finally {
    for (const folder of [dir, elsewhere]) fs.rmSync(folder, { recursive: true, force: true });
  }
});

/** A copy of `documentsRepo` whose commits a real pre-commit hook guards with a real gate, since what a
 * hook is handed is git's to set. The gate is a copy of `bin/`, as for the two processes above, and its one
 * sensor leaves `marker` and passes; that declaration is committed, so a linked worktree has it too.
 * `commit(cwd, ...args)` runs `git commit <args>` there and answers how it ended and what its gate said;
 * `remove()` takes all of it away. */
function hookedRepo() {
  const repo = documentsRepo();
  const home = makeTmpDir();
  const checkout = makeTmpDir();
  const slashes = (file) => file.replace(/\\/g, '/');
  fs.cpSync(path.dirname(fileURLToPath(import.meta.url)), path.join(checkout, 'bin'), { recursive: true, filter: (source) => !source.endsWith('.test.mjs') });
  const marker = slashes(path.join(home, 'sensor-ran'));
  const sensor = `"${process.execPath}" -e "require('fs').writeFileSync('${marker}', '')"`;
  writeJson(repo, 'harness.json', { sensors: { tests: sensor }, documents: ['docs/', 'notes.md'] });
  git(repo, ...commitAs, '-m', 'a sensor that leaves a marker', '--', 'harness.json');
  // The hook leaves on PATH the folder of git and nothing else, so its gate starts no gentle-ai of this
  // machine unless one sits beside git. Nothing here reads the review row, which says either.
  const hooks = path.join(home, 'hooks');
  writeFile(hooks, 'pre-commit', `#!/bin/sh\ngit=$(command -v git)\nPATH="\${git%/*}"\nexec "${slashes(process.execPath)}" "${slashes(path.join(checkout, 'bin', 'check.mjs'))}"\n`);
  fs.chmodSync(path.join(hooks, 'pre-commit'), 0o755);
  git(repo, 'config', 'core.hooksPath', slashes(hooks));
  // The marks of a gate that runs this file would make the hook's gate an inner check, or one that takes no lock.
  // The hook's gate is a process of its own, so the switch keeps it from a second's sample at every commit.
  // The switch of the gate log is dropped instead: a gate that runs this file with its log off would keep
  // the hook's gate from writing the log of the home these tests read.
  const dropped = ['js_harness_check_inner', 'js_harness_gate_held', 'js_harness_gate_log', 'node_test_context'];
  const env = { ...Object.fromEntries(Object.entries(gitEnv()).filter(([key]) => !dropped.includes(key.toLowerCase()))), JS_HARNESS_HOME: home, JS_HARNESS_GATE_LOAD: 'off' };
  const commit = (cwd, ...args) => {
    const result = spawnSync('git', [...commitAs, '-m', 'change', ...args], { cwd, env, encoding: 'utf8' });
    return { status: result.status, said: `${result.stdout}${result.stderr}`.replace(/\r\n/g, '\n') };
  };
  const remove = () => {
    for (const dir of [repo, home, checkout]) fs.rmSync(dir, { recursive: true, force: true });
  };
  return { repo, home, marker, commit, env, remove };
}

/** The paths the last commit of `cwd` holds. */
const lastCommitHolds = (cwd) => git(cwd, 'show', '--name-only', '--format=', 'HEAD').split(/\r?\n/);

// `git commit <path>` and `git commit -a` commit from an index of their own, which git names to the hook in
// GIT_INDEX_FILE: the commit holds that index, not the one `git add` wrote.
test('a commit of one named path is judged by what it holds, not by what else is staged', async () => {
  const { repo, home, marker, commit, remove } = hookedRepo();
  try {
    for (const file of ['docs/guide.md', 'src/app.js']) writeFile(repo, file);
    git(repo, 'add', 'docs/guide.md', 'src/app.js');

    const document = commit(repo, '--', 'docs/guide.md');
    assert.equal(document.status, 0, document.said);
    assert.deepEqual(sensorsRow(document.said), noSensorRan(['docs/guide.md']));
    assert.deepEqual(lastCommitHolds(repo), ['docs/guide.md']);
    assert.equal(fs.existsSync(marker), false, 'the sensor ran for a commit that holds a document alone');
    // No sensor ran, so there was no gate to write of.
    assert.equal(fs.existsSync(gateLogDir(home)), false, 'a commit of documents alone wrote the gate log');

    const code = commit(repo, '--', 'src/app.js');
    assert.equal(code.status, 0, code.said);
    assert.match(code.said, /^PASS {2}tests /m);
    assert.deepEqual(lastCommitHolds(repo), ['src/app.js']);
    assert.equal(fs.existsSync(marker), true, 'the sensor did not run for a commit that holds a code file');
    // And the gate of a real commit, a process of its own, left its two lines in the log of its home.
    assert.doesNotMatch(code.said, /gate log/);
    const [gate, ...more] = gatesOf(readGateLog(home).events);
    assert.deepEqual(more, []);
    assert.deepEqual([fs.realpathSync.native(gate.start.cwd), gate.start.command, gate.start.lock, gate.start.waitedFor], [fs.realpathSync.native(repo), 'check', 'own', []]);
    assert.ok(Number.isInteger(gate.start.pid) && gate.start.pid !== process.pid, String(gate.start.pid));
    assert.deepEqual([gate.end.id, gate.end.result, gate.end.sensors.map(({ name, pass, timedOut }) => ({ name, pass, timedOut }))], [gate.start.id, 'pass', [{ name: 'tests', pass: true, timedOut: false }]]);
  } finally {
    remove();
  }
});

// `git commit --amend` runs the hook while HEAD is still the commit it replaces, so an amend of the message
// alone stages nothing against HEAD; the commit it makes changes against HEAD^ what HEAD did. On 2026-10-15
// such an amend of a commit of documents ran the whole suite and waited for the lock (JH 17).
const amended = [
  'INFO  sensors  no sensor ran (tests): the one path this commit changes against HEAD^ is a document declared in harness.json "documents"',
  'docs/guide.md',
];

test('an amend of the message of a commit of documents runs no sensor: it changes against HEAD^ documents alone', async () => {
  const { repo, home, marker, commit, remove } = hookedRepo();
  try {
    writeFile(repo, 'docs/guide.md');
    git(repo, 'add', 'docs/guide.md');
    const document = commit(repo);
    assert.equal(document.status, 0, document.said);
    assert.equal(fs.existsSync(marker), false, 'the sensor ran for a commit of documents alone');

    const amend = commit(repo, '--amend');
    assert.equal(amend.status, 0, amend.said);
    assert.deepEqual(sensorsRow(amend.said), amended, amend.said);
    assert.equal(fs.existsSync(marker), false, 'the sensor ran for an amend of the message of a commit of documents');
    assert.equal(fs.existsSync(gateLogDir(home)), false, 'an amend of documents alone wrote the gate log');
  } finally {
    remove();
  }
});

test('an amend of the message of a commit that holds code runs the sensors', async () => {
  const { repo, marker, commit, remove } = hookedRepo();
  try {
    writeFile(repo, 'docs/guide.md');
    writeFile(repo, 'src/app.js');
    git(repo, 'add', 'docs/guide.md', 'src/app.js');
    git(repo, ...commitAs, '--no-verify', '-m', 'code and a document');

    const amend = commit(repo, '--amend');
    assert.equal(amend.status, 0, amend.said);
    assert.match(amend.said, /^PASS {2}tests /m);
    assert.equal(fs.existsSync(marker), true, 'no sensor ran for an amend of a commit that holds a code file');
  } finally {
    remove();
  }
});

test('a check run by hand with nothing staged runs the sensors, though HEAD changes documents alone against HEAD^', async () => {
  const { repo, marker, commit, env, remove } = hookedRepo();
  try {
    writeFile(repo, 'docs/guide.md');
    git(repo, 'add', 'docs/guide.md');
    assert.equal(commit(repo).status, 0);
    assert.equal(fs.existsSync(marker), false);

    // No hook, so no GIT_INDEX_FILE: the check guards no commit.
    const byHand = spawnSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), 'check.mjs')], { cwd: repo, env, encoding: 'utf8' });
    const said = `${byHand.stdout}${byHand.stderr}`.replace(/\r\n/g, '\n');
    assert.doesNotMatch(said, /changes against HEAD\^/, said);
    assert.equal(fs.existsSync(marker), true, 'no sensor ran for a check by hand with nothing staged');
  } finally {
    remove();
  }
});

test('an amend of the message of a root commit runs the sensors: there is no HEAD^ to compare with', async () => {
  const { repo, home, marker, env, remove } = hookedRepo();
  const root = makeTmpDir();
  try {
    for (const file of ['harness.json', 'AGENTS.md']) fs.copyFileSync(path.join(repo, file), path.join(root, file));
    writeFile(root, 'docs/guide.md');
    git(root, 'init', '--quiet');
    git(root, 'config', 'core.hooksPath', path.join(home, 'hooks').replace(/\\/g, '/'));
    git(root, 'add', '.');
    git(root, ...commitAs, '--no-verify', '-m', 'root');

    const amend = spawnSync('git', [...commitAs, '--amend', '-m', 'root again'], { cwd: root, env, encoding: 'utf8' });
    const said = `${amend.stdout}${amend.stderr}`.replace(/\r\n/g, '\n');
    assert.equal(amend.status, 0, said);
    assert.doesNotMatch(said, /changes against HEAD\^/, said);
    assert.equal(fs.existsSync(marker), true, 'no sensor ran for an amend of a root commit');
  } finally {
    remove();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// What git 2.54 hands a pre-commit hook besides: in a main worktree `GIT_INDEX_FILE` alone, `.git/index` for
// a plain commit and the whole path of `.git/index.lock` for `-a`; in a linked worktree `GIT_DIR` too, both
// as whole paths under `.git/worktrees/<name>`. Each is the binding of the repository the gate checks.
test('a commit of documents alone runs no sensor however it is made: plain, with -a, and in a linked worktree', async () => {
  const { repo, home, marker, commit, remove } = hookedRepo();
  try {
    const linked = path.join(home, 'linked');
    git(repo, 'worktree', 'add', '--quiet', linked);
    const documentAlone = (cwd, file, ...args) => {
      const { status, said } = commit(cwd, ...args);
      assert.equal(status, 0, said);
      assert.deepEqual(sensorsRow(said), noSensorRan([file]), said);
      assert.deepEqual(lastCommitHolds(cwd), [file]);
    };
    writeFile(repo, 'docs/guide.md');
    git(repo, 'add', 'docs/guide.md');
    documentAlone(repo, 'docs/guide.md');
    writeFile(repo, 'notes.md');
    documentAlone(repo, 'notes.md', '-a');
    writeFile(linked, 'docs/old.md');
    git(linked, 'add', 'docs/old.md');
    documentAlone(linked, 'docs/old.md');
    assert.equal(fs.existsSync(marker), false, 'a sensor ran for a commit of documents alone');

    // The same hook runs the sensor of the linked worktree once its commit holds a code file.
    writeFile(linked, 'src/app.js');
    const code = commit(linked, '-a');
    assert.equal(code.status, 0, code.said);
    assert.match(code.said, /^PASS {2}tests /m);
    assert.equal(fs.existsSync(marker), true, 'the sensor did not run for a commit that holds a code file');
  } finally {
    remove();
  }
});

// --- a tree a gate already passed is not run again, where the project declares it (`"sameTree": "skip"`) ---

/** A repository whose project declares that a tree a gate passed is not run again, committed whole, with a
 * home for its gates. `gate()` is a gate of it with a stand-in for its one sensor, which `sensorRuns()`
 * counts and `sensor.answer` answers for; real git is asked about the tree. */
function sameTreeRepo(declared = { sameTree: 'skip' }) {
  const repo = documentsRepo();
  const home = makeTmpDir();
  writeJson(repo, 'harness.json', { sensors: { tests: 'run-tests' }, ...declared });
  git(repo, 'add', '-A');
  git(repo, ...commitAs, '-m', 'what the project declares');
  let ran = 0;
  const sensor = { answer: sensorRan, during: undefined };
  const spawn = () => {
    ran += 1;
    sensor.during?.();
    return sensor.answer();
  };
  const gate = (env = {}, deps = {}) => runCheck(['--cwd', repo, '--home', home], { JS_HARNESS_GATE_LOAD: 'off', ...env }, { gentleAi: gentleAiNotFound, spawn, ...deps });
  const remove = () => {
    for (const dir of [repo, home]) fs.rmSync(dir, { recursive: true, force: true });
  };
  return { repo, home, gate, sensor, sensorRuns: () => ran, events: () => readGateLog(home).events, remove };
}

const NO_SENSOR_SAME_TREE = /^INFO {2}sensors {2}no sensor ran \(tests\): this tree is the one gate [0-9a-f]{8} passed on \d{4}-\d\d-\d\d \d\d:\d\d in .+, file for file \(harness\.json "sameTree"\)$/;
const TREE_KEY = /^[0-9a-f]{64}$/;

test('a gate of the very tree another gate passed runs no sensor, names that gate and leaves a line of its own; a changed file is a gate that runs them again', async () => {
  const { repo, gate, sensorRuns, events, remove } = sameTreeRepo();
  try {
    const first = await gate();
    assert.equal(first.code, 0, first.output);
    assert.match(first.output, /^PASS {2}tests /m);
    assert.equal(sensorRuns(), 1);
    const [start, end] = events();
    assert.deepEqual([start.event, end.event, end.result], ['start', 'end', 'pass']);
    assert.match(end.code, TREE_KEY);

    const second = await gate();
    assert.equal(second.code, 0, second.output);
    assert.equal(sensorRuns(), 1, 'the sensor ran again on a tree that had passed');
    assert.match(sensorsRow(second.output)[0], NO_SENSOR_SAME_TREE);
    assert.ok(sensorsRow(second.output)[0].includes(`gate ${end.id.slice(0, 8)} passed`), second.output);
    assert.doesNotMatch(second.output, /^\w+ {2}(tests|gate|load) /m);
    const same = events().at(-1);
    assert.deepEqual({ event: same.event, code: same.code, by: same.by, cwd: same.cwd }, { event: 'same', code: end.code, by: end.id, cwd: path.resolve(repo) });
    // The rows around the sensors are those of any gate.
    assert.deepEqual(namesOf(second.output), [...STATIC_ROWS, 'sensors', 'review', 'codex-review']);

    // A code file changed and committed is another tree: every sensor runs, and that tree is proven in its turn.
    writeFile(repo, 'src/app.js', 'three\n');
    git(repo, ...commitAs, '-a', '-m', 'code');
    assert.equal((await gate()).code, 0);
    assert.equal(sensorRuns(), 2);
    assert.notEqual(events().at(-1).code, end.code);
    // And so is a document: the sensors may read it, so it is in the key.
    writeFile(repo, 'docs/guide.md', 'three\n');
    git(repo, ...commitAs, '-a', '-m', 'a document');
    assert.equal((await gate()).code, 0);
    assert.equal(sensorRuns(), 3);
    // A gate that ran no sensor proves nothing itself: three ends hold a key, and three alone.
    assert.equal(events().filter((event) => event.event === 'end' && TREE_KEY.test(event.code ?? '')).length, 3);
  } finally {
    remove();
  }
});

test('a folder that is not the index has no key: with an untracked file, an unstaged change or a file git is told not to look at, every gate runs its sensors and proves nothing', async () => {
  const dirty = [
    (repo) => writeFile(repo, 'scratch.txt'),
    (repo) => writeFile(repo, 'src/app.js', 'edited and not staged\n'),
    (repo) => {
      git(repo, 'update-index', '--skip-worktree', 'src/app.js');
      writeFile(repo, 'src/app.js', 'edited where git does not look\n');
    },
    (repo) => {
      git(repo, 'update-index', '--assume-unchanged', 'src/app.js');
      writeFile(repo, 'src/app.js', 'edited where git assumes nothing changed\n');
    },
  ];
  for (const [at, make] of dirty.entries()) {
    const { repo, gate, sensorRuns, events, remove } = sameTreeRepo();
    try {
      make(repo);
      for (const run of [1, 2]) {
        const { code, output } = await gate();
        assert.equal(code, 0, output);
        assert.equal(sensorRuns(), run, `case ${at}, gate ${run}`);
      }
      assert.deepEqual(events().map((event) => [event.event, 'code' in event]), [['start', false], ['end', false], ['start', false], ['end', false]], `case ${at}`);
    } finally {
      remove();
    }
  }
});

test('a gate whose tests passed only by a quarantine proves no tree, so the next gate runs them again (odd/tasks/flaky-ledger.md)', async () => {
  const quarantined = sameTreeRepo({ sameTree: 'skip', sensors: { tests: 'node --test' } });
  try {
    fs.mkdirSync(path.join(quarantined.repo, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(quarantined.repo, 'bin', 'a.test.mjs'), '');
    fs.mkdirSync(path.join(quarantined.repo, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(quarantined.repo, 'docs', 'FLAKY.md'), '### bin/a.test.mjs\n- Owner: JH 10\n- Expires: 2099-01-01\n- Failure: some-failure\n');
    git(quarantined.repo, 'add', '-A');
    git(quarantined.repo, ...commitAs, '-m', 'a quarantined test file');
    const red = { status: 1, signal: null, stdout: '✖ failing tests:\n\ntest at bin/a.test.mjs:1:1\n✖ one (1ms)\n', stderr: '' };
    let call = 0;
    quarantined.sensor.answer = () => (call++ % 2 === 0 ? red : { status: 0, signal: null, stdout: '', stderr: '' });
    assert.equal((await quarantined.gate()).code, 0);
    assert.equal((await quarantined.gate()).code, 0);
    assert.equal(quarantined.sensorRuns(), 4, 'each gate ran the suite and its rerun');
    assert.deepEqual(quarantined.events().filter((event) => event.event === 'end').map((event) => [event.result, 'code' in event]), [['pass', false], ['pass', false]]);
  } finally {
    quarantined.remove();
  }
});

test('a gate proves no tree when a sensor failed, or when a tracked file changed while the sensors ran', async () => {
  const failing = sameTreeRepo();
  try {
    failing.sensor.answer = () => ({ status: 1, signal: null, stdout: '', stderr: 'no' });
    assert.equal((await failing.gate()).code, 1);
    assert.equal((await failing.gate()).code, 1);
    assert.equal(failing.sensorRuns(), 2, 'a tree that failed was not run again');
    assert.deepEqual(failing.events().map((event) => [event.event, event.result, 'code' in event]), [['start', undefined, false], ['end', 'fail', false], ['start', undefined, false], ['end', 'fail', false]]);
  } finally {
    failing.remove();
  }
  const moving = sameTreeRepo();
  try {
    // The sensor passes, and leaves a tracked file other than it was.
    moving.sensor.during = () => writeFile(moving.repo, 'src/app.js', 'written by a test\n');
    assert.equal((await moving.gate()).code, 0);
    assert.equal('code' in moving.events().at(-1), false, 'the end of a gate whose tree moved holds a key');
    moving.sensor.during = undefined;
    git(moving.repo, 'checkout', '--', 'src/app.js');
    assert.equal((await moving.gate()).code, 0);
    assert.equal(moving.sensorRuns(), 2, 'a tree no gate had proven was not run');
  } finally {
    moving.remove();
  }
});

test('a project that does not declare the rule runs its sensors at every gate and writes no key, and so does a gate whose log is switched off', async () => {
  const silent = sameTreeRepo({});
  try {
    assert.equal((await silent.gate()).code, 0);
    assert.equal((await silent.gate()).code, 0);
    assert.equal(silent.sensorRuns(), 2);
    assert.equal(silent.events().some((event) => 'code' in event || event.event === 'same'), false);
  } finally {
    silent.remove();
  }
  const { gate, sensorRuns, events, remove } = sameTreeRepo();
  try {
    assert.equal((await gate()).code, 0);
    // The proof is there, and a gate that reads no log does not take it.
    for (const run of [2, 3]) {
      assert.equal((await gate({ JS_HARNESS_GATE_LOG: 'off' })).code, 0);
      assert.equal(sensorRuns(), run);
    }
    assert.equal(events().length, 2);
  } finally {
    remove();
  }
});

test('a "sameTree" that is not "skip" is a fault of the declaration: the gate fails in its sensors row and runs nothing', async () => {
  for (const value of [true, false, 'on', 'Skip', '', null, 1, ['skip']]) {
    const { gate, sensorRuns, events, remove } = sameTreeRepo({ sameTree: value });
    try {
      const { code, output } = await gate();
      assert.equal(code, 1, output);
      assert.ok(sensorsRow(output)[0].startsWith(`FAIL  sensors  harness.json "sameTree" must be "skip", the one value it takes; it is ${JSON.stringify(value)}`), output);
      assert.equal(sensorRuns(), 0);
      assert.deepEqual(events(), []);
    } finally {
      remove();
    }
  }
  assert.deepEqual(discoverSameTree(makeTmpDir()), { skip: false });
});

test('a gate that waited for the lock looks for its proof once more: the gate it waited for was of the same tree, so it runs no sensor', async () => {
  const { repo, home, gate, sensorRuns, events, remove } = sameTreeRepo();
  try {
    const asGit = (args) => {
      const result = spawnSync('git', args, { cwd: repo, env: gitEnv(), encoding: 'utf8' });
      return result.status === 0 ? result.stdout : null;
    };
    const key = treeKey(asGit, { sensors: [{ name: 'tests', command: 'run-tests' }] });
    assert.match(key, TREE_KEY);
    // The lock is handed over after a wait, in which another gate of this tree ran its sensors and passed.
    const at = new Date().toISOString();
    const take = async () => {
      appendGateEvent(home, { v: 1, event: 'start', id: 'abcdef0123456789', at, cwd: 'C:\\work\\other', command: 'check', pid: 7, lock: 'own', waitedSeconds: 0, waitedFor: [] });
      appendGateEvent(home, { v: 1, event: 'end', id: 'abcdef0123456789', at, seconds: 3, result: 'pass', sensors: [], code: key });
      return { release: () => {}, beat: () => {}, lost: () => false, waitedMs: 5000 };
    };
    const { code, output } = await gate({}, { takeGateLock: take });
    assert.equal(code, 0, output);
    assert.equal(sensorRuns(), 0, 'the sensor ran on a tree the gate before it had passed');
    assert.match(sensorsRow(output)[0], NO_SENSOR_SAME_TREE);
    assert.ok(sensorsRow(output)[0].includes('gate abcdef01 passed'), output);
    assert.deepEqual(events().map((event) => event.event), ['start', 'end', 'same']);
  } finally {
    remove();
  }
});

// With the real hook: `git commit <path>` hands it an index of its own, and the folder is then not that index.
test('through the real hook: a commit of one named path beside another staged file proves no tree, the commit of a clean folder does, and the same tree committed again runs no sensor', async () => {
  const { repo, home, marker, commit, remove } = hookedRepo();
  try {
    writeJson(repo, 'harness.json', { ...JSON.parse(fs.readFileSync(path.join(repo, 'harness.json'), 'utf8')), sameTree: 'skip' });
    for (const file of ['src/app.js', 'src/other.js']) writeFile(repo, file, 'three\n');
    git(repo, 'add', '-A');
    const ends = () => readGateLog(home).events.filter((event) => event.event === 'end');
    const ranSensor = () => {
      const ran = fs.existsSync(marker);
      fs.rmSync(marker, { force: true });
      return ran;
    };

    // The commit holds harness.json alone; the folder holds two more staged files the commit does not.
    const one = commit(repo, 'harness.json');
    assert.equal(one.status, 0, one.said);
    assert.equal(ranSensor(), true);
    assert.deepEqual(ends().map((event) => [event.result, 'code' in event]), [['pass', false]]);

    // The rest is committed, and nothing is left unstaged or untracked: this gate proves its tree.
    const two = commit(repo);
    assert.equal(two.status, 0, two.said);
    assert.equal(ranSensor(), true);
    assert.match(ends().at(-1).code, TREE_KEY);

    // The same tree again, as an amend of the message alone.
    const again = commit(repo, '--amend');
    assert.equal(again.status, 0, again.said);
    assert.equal(ranSensor(), false, 'a sensor ran for a tree the gate before had passed');
    assert.match(sensorsRow(again.said)[0], NO_SENSOR_SAME_TREE);
    assert.equal(readGateLog(home).events.at(-1).event, 'same');
  } finally {
    remove();
  }
});

// Git runs no pre-commit hook for the commit a merge makes by itself: it runs `pre-merge-commit`, with the
// merged index staged. `.githooks/pre-merge-commit` starts the gate there, so such a merge is a gate as a
// commit is.
test('the hook of a merge starts the same command as the hook of a commit', () => {
  const hooks = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.githooks');
  const command = (hook) => fs.readFileSync(path.join(hooks, hook), 'utf8').split(/\r?\n/).filter((line) => line.startsWith('exec '));
  assert.deepEqual(command('pre-merge-commit'), command('pre-commit'));
  assert.equal(command('pre-commit').length, 1);
});

/** `hookedRepo` with the hook of a merge installed beside the hook of a commit, and the two moves the
 * tests of a merge make. `branch` commits a change of `file` on a branch off the trunk with no gate: only
 * the merge is looked at. `merge` moves the trunk on first, so that the merge is no fast-forward, which
 * makes no commit and runs no hook, and then merges the branch as git does it by itself. */
function mergingRepo() {
  const hooked = hookedRepo();
  const { repo, home, env } = hooked;
  const hooks = path.join(home, 'hooks');
  fs.copyFileSync(path.join(hooks, 'pre-commit'), path.join(hooks, 'pre-merge-commit'));
  fs.chmodSync(path.join(hooks, 'pre-merge-commit'), 0o755);
  const trunk = git(repo, 'rev-parse', '--abbrev-ref', 'HEAD');
  const branch = (name, file) => {
    git(repo, 'checkout', '--quiet', '-b', name, trunk);
    writeFile(repo, file, `written on ${name}\n`);
    git(repo, 'add', file);
    git(repo, ...commitAs, '--no-verify', '-m', name);
    git(repo, 'checkout', '--quiet', trunk);
  };
  const merge = (name) => {
    writeFile(repo, `trunk-${name}.txt`);
    git(repo, 'add', `trunk-${name}.txt`);
    git(repo, ...commitAs, '--no-verify', '-m', `the trunk before ${name}`);
    const result = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'merge', '--no-edit', name], { cwd: repo, env, encoding: 'utf8' });
    return { status: result.status, said: `${result.stdout}${result.stderr}`.replace(/\r\n/g, '\n') };
  };
  return { ...hooked, branch, merge };
}

test('a merge git commits by itself goes through the gate: one that brings documents alone runs no sensor, and one that brings a code file runs them', async () => {
  const { repo, marker, branch, merge, remove } = mergingRepo();
  try {
    branch('documents', 'docs/guide.md');
    branch('code', 'src/app.js');

    const documents = merge('documents');
    assert.equal(documents.status, 0, documents.said);
    assert.deepEqual(sensorsRow(documents.said), noSensorRan(['docs/guide.md']), documents.said);
    assert.equal(fs.existsSync(marker), false, 'a sensor ran for a merge that brings documents alone');
    assert.equal(git(repo, 'rev-list', '--count', '--merges', 'HEAD'), '1');

    const code = merge('code');
    assert.equal(code.status, 0, code.said);
    assert.match(code.said, /^PASS {2}tests /m);
    assert.equal(fs.existsSync(marker), true, 'no sensor ran for a merge that brings a code file');
    assert.equal(git(repo, 'rev-list', '--count', '--merges', 'HEAD'), '2');
  } finally {
    remove();
  }
});

// The merge of the trunk into a branch of documents (odd/tasks/merge-documents-skip.md, S1): what the merge
// holds differs from the side it merges only in declared documents, so no sensor runs, through the hook of a
// merge git commits by itself and through `git commit` after `git merge --no-commit`. On 2026-10-14 such a
// merge held the lock 10 minutes for nothing.
test('a merge of the trunk into a branch of documents runs no sensor when the merge differs from the side it merges only in documents, by itself or committed by hand', async () => {
  const { repo, marker, env, remove } = mergingRepo();
  try {
    const trunk = git(repo, 'rev-parse', '--abbrev-ref', 'HEAD');
    const run = (...args) => {
      const result = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd: repo, env, encoding: 'utf8' });
      return { status: result.status, said: `${result.stdout}${result.stderr}`.replace(/\r\n/g, '\n') };
    };
    const onTrunk = (file) => {
      git(repo, 'checkout', '--quiet', trunk);
      writeFile(repo, file, `written on the trunk\n`);
      git(repo, 'add', file);
      git(repo, ...commitAs, '--no-verify', '-m', `the trunk brings ${file}`);
      git(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    };
    const merged = (side) => [
      `INFO  sensors  no sensor ran (tests): the one path this commit changes against ${side} is a document declared in harness.json "documents"`,
      'docs/guide.md',
    ];

    git(repo, 'checkout', '--quiet', '-b', 'documents', trunk);
    writeFile(repo, 'docs/guide.md', 'written on documents\n');
    git(repo, 'add', 'docs/guide.md');
    git(repo, ...commitAs, '--no-verify', '-m', 'documents');
    onTrunk('src/app.js');
    git(repo, 'checkout', '--quiet', 'documents');
    const byItself = run('merge', '--no-edit', trunk);
    assert.equal(byItself.status, 0, byItself.said);
    // git writes no MERGE_HEAD before the hook of a merge it commits by itself: the trunk is the side known there.
    assert.deepEqual(sensorsRow(byItself.said), merged('origin/main'), byItself.said);
    assert.equal(fs.existsSync(marker), false, 'a sensor ran for a merge that differs from the trunk in documents alone');
    assert.equal(git(repo, 'rev-list', '--count', '--merges', 'HEAD'), '1');

    onTrunk('src/other.js');
    git(repo, 'checkout', '--quiet', 'documents');
    assert.equal(run('merge', '--no-commit', '--no-ff', trunk).status, 0);
    const byHand = run('commit', '--quiet', '--no-edit');
    assert.equal(byHand.status, 0, byHand.said);
    assert.deepEqual(sensorsRow(byHand.said), merged('MERGE_HEAD'), byHand.said);
    assert.equal(fs.existsSync(marker), false, 'a sensor ran for a merge committed by hand that differs from the trunk in documents alone');
    assert.equal(git(repo, 'rev-list', '--count', '--merges', 'HEAD'), '2');

    // A branch that holds code of its own differs from the trunk in more than documents: its merge runs them.
    writeFile(repo, 'src/mine.js', 'written on documents\n');
    git(repo, 'add', 'src/mine.js');
    git(repo, ...commitAs, '--no-verify', '-m', 'code on documents');
    onTrunk('src/third.js');
    git(repo, 'checkout', '--quiet', 'documents');
    const withCode = run('merge', '--no-edit', trunk);
    assert.equal(withCode.status, 0, withCode.said);
    assert.match(withCode.said, /^PASS {2}tests /m);
    assert.equal(fs.existsSync(marker), true, 'no sensor ran for a merge that differs from both sides in code');
  } finally {
    remove();
  }
});

test('a merge whose gate fails is not committed: git merge exits with a failure, the trunk stays where it was and the merge is left unfinished', async () => {
  const { repo, branch, merge, remove } = mergingRepo();
  try {
    // The project's one sensor now fails, on the trunk and so on every branch off it.
    const failing = `"${process.execPath}" -e "process.exit(3)"`;
    writeJson(repo, 'harness.json', { sensors: { tests: failing }, documents: ['docs/', 'notes.md'] });
    git(repo, ...commitAs, '--no-verify', '-m', 'a sensor that fails', '--', 'harness.json');
    branch('code', 'src/app.js');

    const code = merge('code');
    assert.notEqual(code.status, 0, code.said);
    assert.match(code.said, /^FAIL {2}tests /m);
    assert.equal(git(repo, 'rev-list', '--count', '--merges', 'HEAD'), '0', 'the merge was committed though its gate failed');
    assert.equal(git(repo, 'log', '-1', '--format=%s'), 'the trunk before code');
    // What git leaves is a merge to finish or to give up, with what it brings staged: nothing is lost.
    assert.equal(git(repo, 'rev-parse', '--verify', '--quiet', 'MERGE_HEAD'), git(repo, 'rev-parse', 'code'));
    assert.deepEqual(git(repo, 'diff', '--cached', '--name-only').split(/\r?\n/), ['src/app.js']);

    // A merge that brings documents alone runs no sensor, so the failing one does not stop it.
    git(repo, 'merge', '--abort');
    branch('documents', 'docs/guide.md');
    const documents = merge('documents');
    assert.equal(documents.status, 0, documents.said);
    assert.equal(git(repo, 'rev-list', '--count', '--merges', 'HEAD'), '1');
  } finally {
    remove();
  }
});

// The same with nothing standing in: real git lists the tree, a real sensor writes into it.
test('a real gate in a real repository names the files its sensor left in the working tree, and neither one that was untracked before nor one the project ignores', async () => {
  const repo = documentsRepo();
  try {
    const leaves = ['left-by-a-test.txt', 'deep/er/left.txt', 'scratch/ignored.txt'];
    const script = `const fs=require('fs');for(const f of ${JSON.stringify(leaves).replace(/"/g, "'")}){fs.mkdirSync(require('path').dirname(f),{recursive:true});fs.writeFileSync(f,'')}`;
    writeJson(repo, 'harness.json', { sensors: { tests: `"${process.execPath}" -e "${script}"` } });
    writeFile(repo, '.gitignore', 'scratch/\n');
    writeFile(repo, 'was-here.txt');
    const { code, output } = await runCheck(['--cwd', repo], {});
    assert.equal(code, 0, output);
    for (const file of leaves) assert.equal(fs.existsSync(path.join(repo, file)), true, file);
    assert.deepEqual(treeRow(output), ['INFO  tree  2 untracked paths appeared in the working tree while the sensors ran (a test may have written them)', 'deep/er/left.txt', 'left-by-a-test.txt']);
    assert.deepEqual(namesOf(output), [...STATIC_ROWS, 'load', 'tests', 'tree', 'review', 'codex-review']);

    // The next gate of the same tree finds them there before its sensor, and says nothing of them.
    const again = await runCheck(['--cwd', repo], {});
    assert.deepEqual([again.code, treeRows(again.output)], [0, []], again.output);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// --- the sensors of a gate's turn in WSL2, on a Windows machine whose switch file says so (`./lib/gate-wsl.mjs`) ---
// The real distribution never runs here: `deps.spawn` stands in for it, `deps.platform` for Windows, and
// `deps.wslPath` for the drive letters a temporary folder of a POSIX runner has none of.

/** A stand-in for the mount of a path: any absolute path, as WSL would mount it. */
const mountedAt = (where) => `/mnt/x/${where.replaceAll('\\', '/').replace(/^[A-Za-z]:\//, '').replace(/^\//, '')}`;
/** What a sensor answers that reached the mirror, synced in `ms`. */
const reachedMirror = (status, ms = 1200) => ({ status, signal: null, stdout: 'suite\n', stderr: `${SYNCED_MARK}${ms} ms\n` });
/** A `deps.spawn` that answers from `answers` in turn, keeps each command, and reads the runner script at the time of the call. */
function spawnsInTurn(...answers) {
  const spawn = (command, options) => {
    const runner = /--exec bash "(.*)"$/.exec(command);
    spawn.calls.push({ command, cwd: options.cwd, script: runner ? fs.readFileSync(spawn.files.get(runner[1]), 'utf8') : null });
    return answers[spawn.calls.length - 1] ?? sensorRan();
  };
  spawn.calls = [];
  spawn.files = new Map();
  return spawn;
}
/** `deps` of a gate on Windows whose paths the stand-in mount translates; it records each path it mounts, so a test can read the runner by it. */
function wslDeps(spawn, over = {}) {
  const wslPath = (where) => {
    const mounted = mountedAt(where);
    spawn.files.set(mounted, where);
    return mounted;
  };
  return gateDeps({ takeGateLock: lockTakenAtOnce(), spawn, platform: 'win32', wslPath, ...over });
}
const UBUNTU = { distro: 'Ubuntu', node: '/home/a/.local/node/bin' };
/** The project of `dir` says its sensors may run in WSL2 (`harness.json` "sensorsInWsl"). */
function optIn(dir) {
  writeJson(dir, 'harness.json', { ...JSON.parse(fs.readFileSync(path.join(dir, 'harness.json'), 'utf8')), sensorsInWsl: true });
}
/** The machine of `home` runs sensors in Ubuntu, and the project of `dir` lets it. */
function switchOn(dir, home) {
  fs.mkdirSync(path.join(home, '.js-harness'), { recursive: true });
  fs.writeFileSync(path.join(home, '.js-harness', 'gate-wsl.json'), JSON.stringify(UBUNTU));
  optIn(dir);
}

test('a gate on a machine whose switch file names a distribution runs its sensor there, from a mirror of its tree, and says so in its row and in its log', () => withGate({ tests: 'npm run test' }, async (dir, home) => {
  switchOn(dir, home);
  const spawn = spawnsInTurn(reachedMirror(0));
  const { code, output } = await runCheck(['--cwd', dir, '--home', home], {}, wslDeps(spawn));
  assert.equal(code, 0, output);
  assert.equal(spawn.calls.length, 1);
  assert.match(spawn.calls[0].command, /^wsl\.exe -d Ubuntu --exec bash "\/mnt\/x\/.*gate-wsl\.sh"$/);
  const { script } = spawn.calls[0];
  assert.ok(script.includes(`source='${mountedAt(path.resolve(dir))}'`), script);
  assert.match(script, /bash -c 'npm run test'/);
  assert.match(script, /PATH='\/home\/a\/\.local\/node\/bin'/);
  assert.match(script, /JS_HARNESS_GATE_HELD=1 /, 'the gate holds the lock, so its sensor is given the mark');
  assert.match(output, /^PASS {2}tests {2}npm run test passed in WSL2 \(Ubuntu, its mirror synced in 1\.2 s\)$/m);
  const ends = readGateLog(home).events.filter((event) => event.event === 'end');
  assert.deepEqual(ends.map((end) => end.sensors.map(({ name, ranIn }) => ({ name, ranIn }))), [[{ name: 'tests', ranIn: 'wsl' }]]);
}));

test('a sensor that fails in WSL2 fails the gate there, and is not run again on Windows', () => withGate({ tests: 'npm run test' }, async (dir, home) => {
  switchOn(dir, home);
  const spawn = spawnsInTurn(reachedMirror(1));
  const { code, output } = await runCheck(['--cwd', dir, '--home', home], {}, wslDeps(spawn));
  assert.equal(code, 1);
  assert.equal(spawn.calls.length, 1);
  assert.match(output, /^FAIL {2}tests {2}npm run test exited 1 in WSL2 \(Ubuntu\)$/m);
}));

test('a sensor that never reached the mirror runs on Windows, and its row says why', () => withGate({ tests: 'npm run test' }, async (dir, home) => {
  switchOn(dir, home);
  const spawn = spawnsInTurn({ status: 4294967295, signal: null, stdout: 'There is no distribution with the supplied name.\n', stderr: '' }, sensorRan());
  const { code, output } = await runCheck(['--cwd', dir, '--home', home], {}, wslDeps(spawn));
  assert.equal(code, 0, output);
  assert.deepEqual(spawn.calls.map(({ command, cwd }) => [command.startsWith('wsl.exe'), cwd]), [[true, dir], [false, dir]]);
  assert.equal(spawn.calls[1].command, 'npm run test');
  assert.match(output, /^PASS {2}tests {2}npm run test passed on Windows: WSL2 did not run it \(There is no distribution with the supplied name\.\)$/m);
  const [end] = readGateLog(home).events.filter((event) => event.event === 'end');
  assert.equal(end.sensors[0].ranIn, undefined);
}));

test('a tree on no drive letter runs on Windows, and its row says why', () => withGate({ tests: 'npm run test' }, async (dir, home) => {
  switchOn(dir, home);
  const spawn = spawnsInTurn(sensorRan());
  const { code, output } = await runCheck(['--cwd', dir, '--home', home], {}, wslDeps(spawn, { wslPath: () => null }));
  assert.equal(code, 0, output);
  assert.deepEqual(spawn.calls.map(({ command }) => command), ['npm run test']);
  assert.match(output, /^PASS {2}tests {2}npm run test passed on Windows: WSL2 did not run it \(.* is on no drive letter WSL mounts\)$/m);
}));

test('a gate runs on Windows as it always did with no switch file, with the variable set to 0, on a system that is not Windows, or for a project that does not opt in, and the variable says where its temporary files went', async () => {
  const said = { variable: / on Windows \(JS_HARNESS_GATE_WSL=0\), its temporary files under \S/ };
  for (const [label, file, env, platform, opted = true] of [['no file', false, {}, 'win32'], ['variable', true, { JS_HARNESS_GATE_WSL: '0' }, 'win32'], ['linux', true, {}, 'linux'], ['variable, no file', false, { JS_HARNESS_GATE_WSL: '0' }, 'win32'], ['project not opted in', true, {}, 'win32', false]]) {
    await withGate({ tests: 'npm run test' }, async (dir, home) => {
      if (file) {
        fs.mkdirSync(path.join(home, '.js-harness'), { recursive: true });
        fs.writeFileSync(path.join(home, '.js-harness', 'gate-wsl.json'), JSON.stringify(UBUNTU));
      }
      if (opted) optIn(dir);
      const spawn = spawnsInTurn(sensorRan());
      const { code, output } = await runCheck(['--cwd', dir, '--home', home], env, wslDeps(spawn, { platform }));
      assert.equal(code, 0, `${label}: ${output}`);
      assert.deepEqual(spawn.calls.map(({ command }) => command), ['npm run test'], label);
      assert.match(output, said[label] ? new RegExp(`^PASS {2}tests {2}npm run test passed${said[label].source}`, 'm') : /^PASS {2}tests {2}npm run test passed$/m, label);
    });
  }
});

test('a switch file that cannot be taken fails the gate in one row named wsl, before any sensor runs', () => withGate({ tests: 'npm run test' }, async (dir, home) => {
  optIn(dir);
  fs.mkdirSync(path.join(home, '.js-harness'), { recursive: true });
  fs.writeFileSync(path.join(home, '.js-harness', 'gate-wsl.json'), '{ "distro": "Ubuntu" }');
  const spawn = spawnsInTurn(sensorRan());
  const { code, output } = await runCheck(['--cwd', dir, '--home', home], {}, wslDeps(spawn));
  assert.equal(code, 1);
  assert.equal(spawn.calls.length, 0);
  assert.match(output, /^FAIL {2}wsl {2}.*gate-wsl\.json needs "node"/m);
}));

// Found by two readers on 2026-10-14: the key of a tree did not say where its sensors ran, so a pass in WSL2
// proved the tree for the run on Windows that is there to catch what WSL2 cannot, and that run ran nothing.
test('a pass in WSL2 proves a tree for WSL2 alone: the run on Windows of that same tree runs its sensors, and a second run in WSL2 does not', async () => {
  const { repo, home, events, remove } = sameTreeRepo({ sameTree: 'skip', sensorsInWsl: true });
  try {
    fs.mkdirSync(path.join(home, '.js-harness'), { recursive: true });
    fs.writeFileSync(path.join(home, '.js-harness', 'gate-wsl.json'), JSON.stringify(UBUNTU));
    const spawn = spawnsInTurn(reachedMirror(0), sensorRan(), reachedMirror(0));
    const deps = wslDeps(spawn, { git: undefined, takeGateLock: undefined });
    const gate = (env) => runCheck(['--cwd', repo, '--home', home], { JS_HARNESS_GATE_LOAD: 'off', ...env }, deps);
    const inWsl = await gate({});
    assert.equal(inWsl.code, 0, inWsl.output);
    assert.equal(spawn.calls.length, 1);
    const onWindows = await gate({ JS_HARNESS_GATE_WSL: '0' });
    assert.equal(onWindows.code, 0, onWindows.output);
    assert.equal(spawn.calls.length, 2, 'the run on Windows ran no sensor: a pass in WSL2 proved its tree');
    assert.equal(spawn.calls[1].command, 'run-tests');
    const again = await gate({});
    assert.equal(again.code, 0, again.output);
    assert.equal(spawn.calls.length, 2, 'a second run in WSL2 of a tree WSL2 passed ran its sensors again');
    assert.match(sensorsRow(again.output)[0], NO_SENSOR_SAME_TREE);
    const codes = events().filter((event) => event.event === 'end').map((end) => end.code);
    assert.equal(codes.length, 2);
    assert.notEqual(codes[0], codes[1], 'the two places proved one key');
  } finally {
    remove();
  }
});

test('a sensor sent to WSL2 that came back on Windows proves no tree, since its key was of WSL2', async () => {
  const { repo, home, events, remove } = sameTreeRepo({ sameTree: 'skip', sensorsInWsl: true });
  try {
    fs.mkdirSync(path.join(home, '.js-harness'), { recursive: true });
    fs.writeFileSync(path.join(home, '.js-harness', 'gate-wsl.json'), JSON.stringify(UBUNTU));
    const spawn = spawnsInTurn({ status: 1, signal: null, stdout: 'no such distribution\n', stderr: '' }, sensorRan());
    const { code, output } = await runCheck(['--cwd', repo, '--home', home], { JS_HARNESS_GATE_LOAD: 'off' }, wslDeps(spawn, { git: undefined, takeGateLock: undefined }));
    assert.equal(code, 0, output);
    const [end] = events().filter((event) => event.event === 'end');
    assert.equal(end.result, 'pass');
    assert.equal(end.code, undefined);
  } finally {
    remove();
  }
});

test('the files a test left in the WSL2 mirror are named in a tree row, as the ones it leaves in the Windows tree are', () => withGate({ tests: 'npm run test' }, async (dir, home) => {
  switchOn(dir, home);
  const left = { status: 0, signal: null, stdout: 'suite\n', stderr: `${SYNCED_MARK}900 ms\n${LEFT_MARK}scratch/out.txt\n${LEFT_MARK}tmp-dir/\n` };
  const { code, output } = await runCheck(['--cwd', dir, '--home', home], {}, wslDeps(spawnsInTurn(left)));
  assert.equal(code, 0, output);
  assert.match(output, /^INFO {2}tree {2}2 paths appeared in the WSL2 mirror while the sensors ran \(a test may have written them\)$/m);
  assert.match(output, /^ {6}scratch\/out\.txt$/m);
  assert.match(output, /^ {6}tmp-dir\/$/m);
}));

test('a sensorsInWsl that is not true or false fails the gate in one row named sensors', () => withGate({ tests: 'npm run test' }, async (dir, home) => {
  writeJson(dir, 'harness.json', { sensors: { tests: 'npm run test' }, sensorsInWsl: 'yes' });
  const spawn = spawnsInTurn(sensorRan());
  const { code, output } = await runCheck(['--cwd', dir, '--home', home], {}, wslDeps(spawn));
  assert.equal(code, 1);
  assert.equal(spawn.calls.length, 0);
  assert.match(output, /^FAIL {2}sensors {2}harness\.json "sensorsInWsl" must be true or false/m);
}));

// Codex, 2026-10-14, on 3f59bb2..adae7c8: a time that ran out inside the distribution was an ordinary
// failure, and one that ran out before the mirror was synced kept the sensor in WSL2.
test('a sensor whose time ran out inside WSL2 is a timeout in its row and in the gate log, not an ordinary failure', () => withGate({ tests: 'npm run test' }, async (dir, home) => {
  switchOn(dir, home);
  const spawn = spawnsInTurn({ status: 124, signal: null, stdout: '', stderr: `${SYNCED_MARK}800 ms\n${TIMED_OUT_MARK}\n` });
  const { code, output } = await runCheck(['--cwd', dir, '--home', home], {}, wslDeps(spawn));
  assert.equal(code, 1);
  assert.equal(spawn.calls.length, 1);
  assert.match(output, /^FAIL {2}tests {2}npm run test timed out after \d+ s in WSL2 \(Ubuntu\)$/m);
  const [end] = readGateLog(home).events.filter((event) => event.event === 'end');
  assert.equal(end.result, 'timeout');
  assert.deepEqual(end.sensors.map(({ timedOut, ranIn }) => ({ timedOut, ranIn })), [{ timedOut: true, ranIn: 'wsl' }]);
}));

test('a sensor whose time ran out before WSL2 synced its mirror runs on Windows, and its row says why', () => withGate({ tests: 'npm run test' }, async (dir, home) => {
  switchOn(dir, home);
  const spawn = spawnsInTurn({ status: null, signal: null, stdout: '', stderr: '', error: Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }) }, sensorRan());
  const { code, output } = await runCheck(['--cwd', dir, '--home', home], {}, wslDeps(spawn));
  assert.equal(code, 0, output);
  assert.deepEqual(spawn.calls.map(({ command }) => command.startsWith('wsl.exe')), [true, false]);
  assert.match(output, /^PASS {2}tests {2}npm run test passed on Windows: WSL2 did not run it \(its time ran out before the mirror was synced\)$/m);
  const [end] = readGateLog(home).events.filter((event) => event.event === 'end');
  assert.equal(end.sensors[0].ranIn, undefined);
}));

// Codex, 2026-10-14, on adae7c8..f5cbaf4: the mark alone turned a sensor that passed into a timeout.
test('the mark of a time that ran out counts only beside the exit status of timeout, alone on its line', () => withGate({ tests: 'npm run test' }, async (dir, home) => {
  switchOn(dir, home);
  const printed = `${SYNCED_MARK}800 ms\na test printed: ${TIMED_OUT_MARK}\n${TIMED_OUT_MARK}\n`;
  const spawn = spawnsInTurn({ status: 0, signal: null, stdout: '', stderr: printed }, { status: 1, signal: null, stdout: '', stderr: printed });
  const passed = await runCheck(['--cwd', dir, '--home', home], {}, wslDeps(spawn));
  assert.equal(passed.code, 0, passed.output);
  assert.match(passed.output, /^PASS {2}tests {2}npm run test passed in WSL2 /m);
  const failed = await runCheck(['--cwd', dir, '--home', home], {}, wslDeps(spawn));
  assert.equal(failed.code, 1);
  assert.match(failed.output, /^FAIL {2}tests {2}npm run test exited 1 in WSL2 \(Ubuntu\)$/m);
}));

// The names of the tests that failed are kept in the gate's end line (odd/tasks/gate-log-failing-tests.md,
// S1): a WSL2 run's output lives in the mirror and the report, and on 2026-10-14 JH 11 could not get back
// which test had failed once the report was gone.
const SPEC_FAILURE = [
  '✔ one that passes (2.1ms)',
  '✖ the first that fails (12.5ms)',
  'ℹ tests 3',
  'ℹ fail 2',
  '',
  '✖ failing tests:',
  '',
  'test at bin/a.test.mjs:10:1',
  '✖ the first that fails (12.5ms)',
  '  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:',
  '',
  'test at bin/b.test.mjs:4:1',
  '\u001b[31m✖ a second, in another file (3ms)\u001b[39m',
  '  Error: boom',
].join('\n');
const TAP_FAILURE = ['TAP version 13', 'ok 1 - fine', '    not ok 1 - a subtest', 'not ok 2 - the one that fails', '# fail 1'].join('\n');

test('failingTests reads the names of the failing tests in the spec form and, without it, the tap form; none for a pass or other output', () => {
  assert.deepEqual(failingTests(SPEC_FAILURE), ['the first that fails', 'a second, in another file']);
  assert.deepEqual(failingTests(TAP_FAILURE), ['the one that fails']);
  assert.deepEqual(failingTests('ℹ pass 3\nℹ fail 0\n'), []);
  assert.deepEqual(failingTests('npm ERR! missing script: test\n'), []);
  // Twenty at most, each two hundred characters at most, and each once.
  const many = ['✖ failing tests:', ...Array.from({ length: 25 }, (_, i) => `✖ test ${i} ${'x'.repeat(300)} (1ms)`), '✖ test 0 (1ms)'].join('\n');
  const names = failingTests(many);
  assert.equal(names.length, 20);
  assert.ok(names.every((name) => name.length <= 200), JSON.stringify(names.map((name) => name.length)));
});

test('a gate whose sensors fail keeps the names of their failing tests in its end line, and a sensor that passes has none', () => withGate({ tests: 'run-tests', lint: 'run-lint', more: 'run-more' }, async (dir, home) => {
  const outputs = { 'run-tests': { status: 1, stdout: SPEC_FAILURE }, 'run-lint': { status: 1, stdout: '', stderr: TAP_FAILURE }, 'run-more': { status: 0, stdout: 'ℹ pass 1\n' } };
  const spawn = async (command) => ({ signal: null, stderr: '', ...outputs[command] });
  const log = capturedLog();
  const { code, output } = await runCheck(['--cwd', dir, '--home', home], {}, gateDeps({ spawn, ...log.deps }));
  assert.equal(code, 1, output);
  const end = log.events.find((event) => event.event === 'end');
  assert.deepEqual(end.sensors.map(({ name, pass, failing }) => ({ name, pass, failing })), [
    { name: 'tests', pass: false, failing: ['the first that fails', 'a second, in another file'] },
    { name: 'lint', pass: false, failing: ['the one that fails'] },
    { name: 'more', pass: true, failing: undefined },
  ]);
}));

// The sub-agents row of `check --subagents` (odd/tasks/honesty-audit.md, T13). Plain check runs none of it.
const SUBAGENT_NOW = Date.parse('2026-10-14T20:00:00Z'); // 15:00 in Bogota, UTC-5
const BOGOTA_OFFSET = -300;
const recordLine = (entries) => `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`;
const turnAt = (stamp, model) => ({ type: 'assistant', timestamp: stamp, effort: 'high', message: { id: `m-${stamp}`, model, usage: { input_tokens: 10, output_tokens: 1 }, content: [] } });

/** `run` answering git as a main checkout at `dir` with no other worktree, as `recordFolders` asks it. */
function gitOf(dir) {
  return (command, args) => {
    if (args[0] === 'rev-parse') return { status: 0, stdout: `${path.join(dir, '.git')}\n` };
    if (args[0] === 'worktree') return { status: 0, stdout: `worktree ${dir}\nHEAD abc\nbranch refs/heads/main\n\n` };
    return { status: 1, stdout: '' };
  };
}

/** A project of today's sub-agents: a writer on haiku and an explorer on sonnet, the explorer off the reader's
 * rule (opus). `rules` gives the project the harness's rules file, the one the rules are read from; `records`
 * gives it a config folder with the records. */
function subagentProject({ rules = true, records = true } = {}) {
  const dir = makeTmpDir();
  const config = makeTmpDir();
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(400));
  if (rules) {
    fs.mkdirSync(path.join(dir, 'bin', 'lib'), { recursive: true });
    fs.copyFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'lib', 'rules-data.mjs'), path.join(dir, 'bin', 'lib', 'rules-data.mjs'));
  }
  if (records) {
    const folder = path.join(config, 'projects', projectSlug(dir));
    const agents = path.join(folder, 's1', 'subagents');
    fs.mkdirSync(agents, { recursive: true });
    fs.writeFileSync(path.join(folder, 's1.jsonl'), recordLine([turnAt('2026-10-14T14:00:00Z', 'claude-opus-5-5')]));
    const agent = (id, meta, model, stamp) => {
      fs.writeFileSync(path.join(agents, `agent-${id}.jsonl`), recordLine([turnAt(stamp, model)]));
      fs.writeFileSync(path.join(agents, `agent-${id}.meta.json`), JSON.stringify(meta));
    };
    agent('w1', { agentType: 'general-purpose', description: 'Write the change' }, 'claude-haiku-5-5', '2026-10-14T14:02:00Z');
    agent('e1', { agentType: 'Explore', description: 'Map things' }, 'claude-sonnet-5-5', '2026-10-14T14:03:00Z');
  }
  return { dir, config, cleanup: () => { fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(config, { recursive: true, force: true }); } };
}

/** The deps `main` takes for the sub-agents row, with the day and the machine's zone fixed. */
const subagentDeps = (project, extra = {}) => ({ run: gitOf(project.dir), now: () => SUBAGENT_NOW, offsetMinutes: BOGOTA_OFFSET, ...extra });

/** The lines of `output` that open the sub-agents row. */
const subagentRows = (output) => output.split('\n').filter((line) => line.startsWith('INFO  subagents  ') || line.startsWith('PASS  subagents  ') || line.startsWith('FAIL  subagents  '));

test('plain check prints no subagents row and reads no record', async () => {
  const project = subagentProject();
  const gitCalls = [];
  const run = gitOf(project.dir);
  try {
    const { code, output } = await runCheck(['--cwd', project.dir], { JS_HARNESS_CHECK_INNER: '1', CLAUDE_CONFIG_DIR: project.config }, subagentDeps(project, { run: (command, args, options) => { gitCalls.push(args); return run(command, args, options); } }));
    assert.equal(subagentRows(output).length, 0, output);
    assert.equal(gitCalls.filter((args) => args[0] === 'worktree').length, 0, JSON.stringify(gitCalls));
    assert.notEqual(code, 2, output);
  } finally {
    project.cleanup();
  }
});

test('check --subagents prints an INFO subagents row that counts today\'s launches against the rules', async () => {
  const project = subagentProject();
  try {
    const { code, output, errOutput } = await runCheck(['--cwd', project.dir, '--subagents'], { JS_HARNESS_CHECK_INNER: '1', CLAUDE_CONFIG_DIR: project.config }, subagentDeps(project));
    assert.equal(errOutput, '', output);
    const [row] = subagentRows(output);
    assert.ok(row?.startsWith('INFO  subagents  '), output);
    assert.match(row, /2 launches today: 1 on a model off the rules/, output);
    assert.ok(output.split('\n').some((line) => line.includes('claude-sonnet-5-5') && line.includes('subagent-reader-model')), output);
    assert.notEqual(code, 2, output);
  } finally {
    project.cleanup();
  }
});

test('check --subagents says the sub-agent rules are not in force here, and compares nothing', async () => {
  const project = subagentProject({ rules: false });
  try {
    const { output } = await runCheck(['--cwd', project.dir, '--subagents'], { JS_HARNESS_CHECK_INNER: '1', CLAUDE_CONFIG_DIR: project.config }, subagentDeps(project));
    const [row] = subagentRows(output);
    assert.ok(row?.startsWith('INFO  subagents  '), output);
    assert.match(row, /not in force/, output);
    assert.doesNotMatch(row, /launches today/, output);
  } finally {
    project.cleanup();
  }
});

test('check --subagents says no sub-agent launched today when the project has no records folder', async () => {
  const project = subagentProject({ records: false });
  try {
    const { output } = await runCheck(['--cwd', project.dir, '--subagents'], { JS_HARNESS_CHECK_INNER: '1', CLAUDE_CONFIG_DIR: project.config }, subagentDeps(project));
    const [row] = subagentRows(output);
    assert.ok(row?.startsWith('INFO  subagents  '), output);
    assert.match(row, /^INFO  subagents  no sub-agent launched today: no Claude Code records folder/, output);
  } finally {
    project.cleanup();
  }
});

test('check --subagents says what it cannot tell when reading the records throws, and fails nothing', async () => {
  const project = subagentProject();
  try {
    const { output } = await runCheck(['--cwd', project.dir, '--subagents'], { JS_HARNESS_CHECK_INNER: '1' }, subagentDeps(project, { homedir: () => { throw new Error('no home directory here'); } }));
    const [row] = subagentRows(output);
    assert.ok(row?.startsWith('INFO  subagents  '), output);
    assert.match(row, /^INFO  subagents  cannot tell: .*no home directory here/, output);
  } finally {
    project.cleanup();
  }
});


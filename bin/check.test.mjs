import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { estimateTokens, checkBudget, checkContracts, checkPayload, discoverSensors, checkSensor, checkSensors, checkReview, runSensor, main } from './check.mjs';
import { killTree } from './lib/process-tree.mjs';

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
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(6000)); // 1500 tokens
    const row = checkBudget(dir);
    assert.equal(row.pass, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkBudget fails over the token limit', () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(6004)); // 1501 tokens
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
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(6004));
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
    assert.deepEqual(await checkSensor(dir, { name: 'lint', command }), { name: 'lint', pass: true, detail: `${command} passed`, output: '' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
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

test('checkSensor gives every sensor a 10 minute timeout by default', async () => {
  let options;
  const spawn = (_command, opts) => {
    options = opts;
    return { status: 0, stdout: '', stderr: '' };
  };
  await checkSensor(os.tmpdir(), { name: 'tests', command: 'x' }, { spawn });
  assert.equal(options.timeout, 10 * 60 * 1000);
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
      killTree(child, lifetime); // the real kill first, so the test leaves nothing running
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

/** Runs `main`, capturing everything it printed via console.log/console.error and the exit code. */
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
  try {
    const code = await main(argv, env, deps);
    return { code, output, errOutput };
  } finally {
    console.log = originalLog;
    console.error = originalError;
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
    assert.doesNotMatch(inner.output, /review/);
    const push = await runCheck(['--push', '--cwd', dir], { JS_HARNESS_HOME: dir }, { gentleAi });
    assert.doesNotMatch(push.output, /^(PASS|FAIL|INFO) {2}review /m);
    assert.equal(gentleAi.calls.length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { estimateTokens, checkBudget, checkContracts, checkPayload, discoverSensors, checkSensor, checkSensors, main } from './check.mjs';

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
test('discoverSensors takes an empty harness.json sensors map as declaring none, and check says where', () => {
  const dir = makeTmpDir();
  try {
    writeJson(dir, 'harness.json', { sensors: {} });
    writeJson(dir, 'package.json', { scripts: { test: 'vitest run' } });
    assert.deepEqual(discoverSensors(dir), { sensors: [], source: 'harness.json' });
    const [row] = checkSensors(dir);
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

test('checkSensor passes when the command exits 0', () => {
  const dir = makeTmpDir();
  try {
    const command = exits(0);
    assert.deepEqual(checkSensor(dir, { name: 'lint', command }), { name: 'lint', pass: true, detail: `${command} passed`, output: '' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("checkSensor fails with the exit status and keeps the command's output", () => {
  const dir = makeTmpDir();
  try {
    const command = exits(3, "console.log('boom-out');console.error('boom-err');");
    const row = checkSensor(dir, { name: 'tests', command });
    assert.equal(row.name, 'tests');
    assert.equal(row.pass, false);
    assert.equal(row.detail, `${command} exited 3`);
    assert.match(row.output, /boom-out/);
    assert.match(row.output, /boom-err/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkSensor fails with the spawn error when the command cannot run', () => {
  const spawn = () => ({ error: new Error('spawn ENOENT'), status: null });
  const row = checkSensor(os.tmpdir(), { name: 'tests', command: 'whatever' }, { spawn });
  assert.equal(row.pass, false);
  assert.match(row.detail, /spawn ENOENT/);
});

test('checkSensor keeps what the command printed before a spawn error such as ENOBUFS', () => {
  const spawn = () => ({ error: new Error('spawnSync ENOBUFS'), status: null, stdout: 'partial-out', stderr: 'partial-err' });
  const row = checkSensor(os.tmpdir(), { name: 'tests', command: 'noisy' }, { spawn });
  assert.equal(row.pass, false);
  assert.match(row.output, /partial-out/);
  assert.match(row.output, /partial-err/);
});

// Windows dedupes environment keys case-insensitively and keeps the uppercase one, so an inherited
// NPM_CONFIG_CACHE would win over the lowercase override; npm also reads either case.
test('checkSensor drops inherited case variants of the variables it overrides', () => {
  const saved = { ...process.env };
  let env;
  const spawn = (_command, options) => {
    env = options.env;
    return { status: 0, stdout: '', stderr: '' };
  };
  try {
    process.env.NPM_CONFIG_CACHE = 'real-cache';
    process.env.Home = 'real-home';
    checkSensor(os.tmpdir(), { name: 'tests', command: 'x' }, { spawn });
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

test('checkSensor names the signal when the command is killed by one', () => {
  const spawn = () => ({ status: null, signal: 'SIGTERM', stdout: 'out', stderr: '' });
  const row = checkSensor(os.tmpdir(), { name: 'tests', command: 'slow' }, { spawn });
  assert.equal(row.pass, false);
  assert.equal(row.detail, 'slow was killed by SIGTERM');
  assert.match(row.output, /out/);
});

// A test that forgets --home must land in a throwaway directory, never in the real home.
test('checkSensor runs the command with the home directory pointed at a throwaway directory', () => {
  const dir = makeTmpDir();
  try {
    const seen = path.join(dir, 'seen-home.txt').replace(/\\/g, '/');
    const record =
      "require('os').homedir() + '|' + process.env.JS_HARNESS_CHECK_INNER + '|' + process.env.NODE_TEST_CONTEXT + '|' + process.env.npm_config_cache";
    const command = `node -e "require('fs').writeFileSync('${seen}', ${record})"`;
    const row = checkSensor(dir, { name: 'tests', command });
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

test('checkSensors turns a discovery error into one FAIL row named sensors', () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'harness.json'), '{ nope');
    const rows = checkSensors(dir);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'sensors');
    assert.equal(rows[0].pass, false);
    assert.match(rows[0].detail, /harness\.json/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkSensors says so when no sensor is declared, naming both ways to declare one', () => {
  const dir = makeTmpDir();
  try {
    const rows = checkSensors(dir);
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

test('checkSensors runs one row per sensor', () => {
  const dir = makeTmpDir();
  try {
    writeJson(dir, 'harness.json', { sensors: { tests: exits(0), lint: exits(1) } });
    const rows = checkSensors(dir);
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

/** Runs `main`, capturing everything it printed via console.log/console.error and the exit code. */
async function runCheck(argv, env) {
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
    const code = await main(argv, env);
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

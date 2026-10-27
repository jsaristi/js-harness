import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  DELEGATION_MODES, HONESTY_CONFIGS, HONESTY_SENTENCES, SANDBOX_ALLOWLIST, SANDBOX_SWITCHES, SUBAGENT_CONFIGS, SUBAGENT_MODELS, assertWorkRoot, currentConfig,
  defaultWorkRoot, ensureSandboxDirs, honestyConfig, honestyMemory, honestyPin, minimalConfig, minimalWithConfig, minimalWithMcpFile, prepareSandbox, sandboxEnv, sandboxPaths,
  subagentConfig, subagentPin,
} from './configs.mjs';
import { REAL_ENGRAM_PORT } from './ports.mjs';
import { childEnv, loadTask, planTrials, runTrial } from './runner.mjs';
import { withToken } from './suite.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FAKE_AGENT = path.join(here, 'fixtures', 'fake-agent.mjs');
const SAMPLE = path.join(here, 'fixtures', 'tasks', 'sample');
// The transcripts of a real session with one subagent, trimmed (`transcript-usage.test.mjs`).
const PROBE_TRANSCRIPTS = path.join(here, 'fixtures', 'transcripts', 'probe');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-configs-test-'));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));
let counter = 0;
const tmp = (name) => {
  const dir = path.join(scratch, `${name}-${counter++}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

// The allowlist, the path variables and the switches are a security boundary, so the tests hold their own
// copy of each: a name added to the module by accident (a credential, say) fails here instead of passing
// because the test read the same constant.
const EXPECTED_ALLOWLIST = [
  'PATH', 'PATHEXT', 'SystemRoot', 'SystemDrive', 'windir', 'ComSpec', 'ProgramData', 'ProgramFiles', 'ProgramFiles(x86)', 'ProgramW6432',
  'CommonProgramFiles', 'CommonProgramFiles(x86)', 'CommonProgramW6432', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE', 'OS', 'COMPUTERNAME',
  'USERNAME', 'USERDOMAIN', 'LANG', 'LC_ALL', 'TZ', 'TERM', 'SHELL', 'USER', 'LOGNAME', 'CLAUDE_CODE_OAUTH_TOKEN',
];
const PATH_NAMES = [
  'USERPROFILE', 'HOME', 'CLAUDE_CONFIG_DIR', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME',
  'XDG_CACHE_HOME', 'ENGRAM_DATA_DIR', 'JS_HARNESS_HOME', 'npm_config_cache',
];
const WINDOWS_PATH_NAMES = ['HOMEDRIVE', 'HOMEPATH'];
const EXPECTED_SWITCHES = {
  DISABLE_AUTOUPDATER: '1',
  DISABLE_UPDATES: '1',
  CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
  DISABLE_TELEMETRY: '1',
  DISABLE_ERROR_REPORTING: '1',
  CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: '1',
  DO_NOT_TRACK: '1',
  GENTLE_AI_TELEMETRY: '0',
  CODEGRAPH_TELEMETRY: '0',
  ENABLE_CLAUDEAI_MCP_SERVERS: 'false',
};
// Variables a developer's real shell may hold that must never reach a trial.
const SCRUBBED = ['CLAUDE_CODE_CHILD_SESSION', 'CLAUDE_PLUGIN_DATA', 'ANTHROPIC_API_KEY', 'CODEX_COMPANION_TRANSCRIPT_PATH', 'ORCA_X', 'HERDR_X', 'CLAUDECODE'];

const REAL_HOME = path.join(path.parse(scratch).root, 'Users', 'real-person-sentinel');
const HOME = path.join(scratch, 'sandbox-home');
const PORT = 41234;
const sortedKeys = (object) => Object.keys(object).sort();
const nonNull = (overrides) => Object.entries(overrides).filter(([, value]) => value !== null);
const insideHome = (value, home = HOME) => value === home || value.startsWith(home + path.sep);

/** A believable inherited environment: every allowlisted name, the real home in every path variable, the
 * scrubbed names, and the switches set to the opposite of what a trial needs. On Windows the names are
 * written in other cases, which the real environment does too (`Path`). */
function fakeInherited(platform) {
  const env = {};
  for (const name of EXPECTED_ALLOWLIST) env[name] = `value-of-${name}`;
  env.PATH = `${path.join(REAL_HOME, '.local', 'bin')}${path.delimiter}${path.join(path.parse(scratch).root, 'tools')}`;
  if (platform === 'win32') {
    env.Path = env.PATH;
    delete env.PATH;
    env.systemroot = env.SystemRoot;
    delete env.SystemRoot;
  } else {
    env.Path = 'differently-cased-path';
  }
  for (const name of [...PATH_NAMES, ...WINDOWS_PATH_NAMES]) env[name] = path.join(REAL_HOME, name);
  for (const name of SCRUBBED) env[name] = path.join(REAL_HOME, name);
  for (const name of Object.keys(EXPECTED_SWITCHES)) env[name] = 'real-value';
  return env;
}

const PLATFORMS = ['win32', 'linux'];

// ---- sandboxEnv ------------------------------------------------------------------------------------

test('the allowlist is exactly what a process needs to run, plus the one credential that passes through', () => {
  assert.deepEqual([...SANDBOX_ALLOWLIST].sort(), [...EXPECTED_ALLOWLIST].sort());
  assert.ok(SANDBOX_ALLOWLIST.includes('CLAUDE_CODE_OAUTH_TOKEN'));
  assert.ok(!SANDBOX_ALLOWLIST.some((name) => /ANTHROPIC|API_KEY|CLAUDE_PLUGIN|CLAUDE_CODE_CHILD/i.test(name)));
});

for (const platform of PLATFORMS) {
  test(`sandboxEnv (${platform}) removes every inherited variable outside the allowlist and leaves allowlisted ones alone`, () => {
    const inherited = fakeInherited(platform);
    const overrides = sandboxEnv({ home: HOME, engramPort: PORT, inherited, platform });
    for (const name of SCRUBBED) assert.equal(overrides[name], null, `${name} is removed`);
    const allowed = new Set(EXPECTED_ALLOWLIST.map((name) => (platform === 'win32' ? name.toLowerCase() : name)));
    const untouched = Object.keys(inherited).filter((name) => allowed.has(platform === 'win32' ? name.toLowerCase() : name));
    assert.ok(untouched.length >= EXPECTED_ALLOWLIST.length - 1, 'the fake environment holds the allowlist');
    for (const name of untouched) assert.ok(!Object.hasOwn(overrides, name), `${name} is not overridden`);
    if (platform === 'win32') {
      assert.ok(!Object.hasOwn(overrides, 'Path'), 'names compare case-insensitively on Windows');
      assert.ok(!Object.hasOwn(overrides, 'systemroot'));
    } else {
      assert.equal(overrides.Path, null, 'on POSIX `Path` is not `PATH`');
    }
  });

  test(`sandboxEnv (${platform}) points every path variable inside the home and sets each switch to its exact value`, () => {
    const overrides = sandboxEnv({ home: HOME, engramPort: PORT, inherited: {}, platform });
    const pathNames = platform === 'win32' ? [...PATH_NAMES, ...WINDOWS_PATH_NAMES] : PATH_NAMES;
    for (const name of PATH_NAMES) assert.ok(insideHome(overrides[name]), `${name} = ${overrides[name]}`);
    assert.equal(overrides.USERPROFILE, HOME);
    assert.equal(overrides.HOME, HOME);
    assert.equal(overrides.JS_HARNESS_HOME, HOME);
    assert.equal(overrides.CLAUDE_CONFIG_DIR, path.join(HOME, '.claude'));
    assert.equal(overrides.APPDATA, path.join(HOME, 'AppData', 'Roaming'));
    assert.equal(overrides.LOCALAPPDATA, path.join(HOME, 'AppData', 'Local'));
    for (const name of ['TEMP', 'TMP', 'TMPDIR']) assert.equal(overrides[name], path.join(HOME, 'tmp'));
    assert.equal(overrides.ENGRAM_DATA_DIR, path.join(HOME, '.engram'));
    assert.equal(overrides.npm_config_cache, path.join(HOME, 'npm-cache'));
    if (platform === 'win32') {
      assert.equal(`${overrides.HOMEDRIVE}${overrides.HOMEPATH}`, HOME, 'drive and path together name the home');
      assert.ok(!overrides.HOMEDRIVE.endsWith(path.sep));
    } else {
      assert.ok(!Object.hasOwn(overrides, 'HOMEDRIVE') && !Object.hasOwn(overrides, 'HOMEPATH'));
    }
    for (const [name, value] of Object.entries(EXPECTED_SWITCHES)) assert.equal(overrides[name], value, name);
    assert.deepEqual(SANDBOX_SWITCHES, EXPECTED_SWITCHES);
    assert.equal(overrides.ENGRAM_PORT, String(PORT));
    assert.deepEqual(sortedKeys(overrides), [...pathNames, 'ENGRAM_PORT', ...Object.keys(EXPECTED_SWITCHES)].sort(), 'nothing else is set');
  });

  test(`sandboxEnv (${platform}) through childEnv leaves exactly the allowlist, the paths and the switches, none of the real home`, () => {
    const inherited = fakeInherited(platform);
    const overrides = sandboxEnv({ home: HOME, engramPort: PORT, inherited, platform });
    const env = childEnv(overrides, inherited, platform);
    const fold = (name) => (platform === 'win32' ? name.toLowerCase() : name);
    const allowed = new Set(EXPECTED_ALLOWLIST.map(fold));
    const expected = new Set([
      ...Object.keys(inherited).filter((name) => allowed.has(fold(name))).map(fold),
      ...nonNull(overrides).map(([name]) => fold(name)),
    ]);
    assert.deepEqual(Object.keys(env).map(fold).sort(), [...expected].sort());
    for (const name of SCRUBBED) assert.ok(!Object.keys(env).some((key) => fold(key) === fold(name)), `${name} reached the child`);
    for (const [name, value] of Object.entries(env)) {
      if (fold(name) === fold('PATH')) continue;
      assert.ok(!value.includes(REAL_HOME), `${name}=${value} holds the real home`);
    }
    assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN, 'value-of-CLAUDE_CODE_OAUTH_TOKEN', 'the credential passes through');
    assert.equal(env.USERPROFILE, HOME);
    assert.equal(env.HOME, HOME);
  });
}

test('sandboxEnv refuses a home that is not an absolute path, which a child would resolve against its own cwd', () => {
  for (const home of ['rel', path.join('rel', 'home'), '.', './home']) {
    assert.throws(() => sandboxEnv({ home }), /absolute/, home);
  }
  assert.throws(() => sandboxEnv({ home: '' }), /home directory/);
});

test('ensureSandboxDirs creates every directory a path variable points at, and can run twice', () => {
  const home = path.join(tmp('dirs'), 'home');
  const paths = sandboxPaths(home);
  assert.deepEqual(sortedKeys(paths), [...PATH_NAMES].sort());
  ensureSandboxDirs(home);
  ensureSandboxDirs(home);
  for (const [name, dir] of Object.entries(paths)) assert.ok(fs.statSync(dir).isDirectory(), `${name} -> ${dir}`);
});

// ---- the two configs -------------------------------------------------------------------------------

const OPTIONS = { command: process.execPath, model: 'test-model', permissionMode: 'test-mode' };
const sharedArgs = (effort) => ['--print', '--output-format', 'json', '--model', 'test-model', '--effort', effort, '--permission-mode', 'test-mode'];
const MINIMAL_ONLY = ['--setting-sources', '', '--strict-mcp-config', '--disable-slash-commands'];
const BUILDERS = [['minimal', minimalConfig], ['current', currentConfig]];

for (const [name, build] of BUILDERS) {
  test(`${name} is a runner config named ${name} that runs the given binary directly`, () => {
    const config = build(OPTIONS);
    assert.equal(config.name, name);
    assert.equal(config.command, process.execPath);
    assert.equal(typeof config.prepare, 'function');
    assert.ok(!('versionArgs' in config) || config.versionArgs === undefined, 'the default --version probe applies');
  });

  test(`${name} refuses to build without a model, a permission mode or an absolute command`, () => {
    assert.throws(() => build({ command: OPTIONS.command, permissionMode: 'x' }), /model/);
    assert.throws(() => build({ command: OPTIONS.command, model: 'x' }), /permissionMode/);
    assert.throws(() => build({ model: 'x', permissionMode: 'y' }), /command/);
    assert.throws(() => build({ command: 'claude', model: 'x', permissionMode: 'y' }), /absolute/);
    assert.throws(() => build({ command: OPTIONS.command, model: '', permissionMode: 'y' }), /model/);
    assert.throws(() => build(), /command|model/);
  });
}

test('minimal passes the shared flags, then no settings, no MCP and no slash commands, and never --bare', () => {
  const config = minimalConfig(OPTIONS);
  for (const effort of ['medium', 'high']) {
    const args = config.args({ effort, home: HOME });
    assert.deepEqual(args, [...sharedArgs(effort), ...MINIMAL_ONLY]);
    assert.ok(args.includes(''), 'the empty string is its own argv element');
    assert.ok(!args.includes('--bare'));
  }
});

test('a minimal-with arm is the minimal arm under its own name, with the server it puts in passed by --mcp-config from the trial home (G2, C6b)', async () => {
  const seeded = [];
  const config = minimalWithConfig({ ...OPTIONS, name: 'minimal-with-mcp-context7', seed: async (context) => seeded.push(context.home) });
  assert.equal(config.name, 'minimal-with-mcp-context7');
  assert.equal(minimalWithMcpFile(HOME), path.join(HOME, '.claude', 'mcp-with.json'));
  assert.deepEqual(config.args({ effort: 'medium', home: HOME }), [...sharedArgs('medium'), ...MINIMAL_ONLY, '--mcp-config', minimalWithMcpFile(HOME)]);
  assert.deepEqual(config.env({ home: HOME, prepared: { engramPort: PORT } }), minimalConfig(OPTIONS).env({ home: HOME, prepared: { engramPort: PORT } }));
  assert.throws(() => config.args({ effort: 'medium' }), /home/);
  assert.throws(() => minimalWithConfig({ ...OPTIONS, seed: async () => {} }), /name/);
  assert.throws(() => minimalWithConfig({ ...OPTIONS, name: 'minimal-with-mcp-context7' }), /seed/);
});

test('current passes the shared flags and the setting sources a desktop session loads, and --effort is the one flag that varies', () => {
  const config = currentConfig(OPTIONS);
  const desktop = ['--setting-sources', 'user,project,local'];
  assert.deepEqual(config.args({ effort: 'medium', home: HOME }), [...sharedArgs('medium'), ...desktop]);
  assert.deepEqual(config.args({ effort: 'high', home: HOME }), [...sharedArgs('high'), ...desktop]);
  const medium = config.args({ effort: 'medium' });
  const high = config.args({ effort: 'high' });
  assert.deepEqual(medium.filter((arg, index) => arg !== high[index]), ['medium']);
});

test('both configs run under the same sandbox env for the same home', () => {
  const context = { effort: 'medium', home: HOME, workspace: path.join(scratch, 'ws'), prepared: { engramPort: PORT } };
  assert.deepEqual(minimalConfig(OPTIONS).env(context), currentConfig(OPTIONS).env(context));
  assert.deepEqual(minimalConfig(OPTIONS).env(context), sandboxEnv({ home: HOME, engramPort: PORT }));
});

for (const [name, build] of BUILDERS) {
  test(`${name}'s prepare creates the sandbox directories`, async () => {
    const home = path.join(tmp('prepare'), 'home');
    await build(OPTIONS).prepare({ home, workspace: tmp('ws'), effort: 'medium', task: { id: 't' } });
    for (const dir of Object.values(sandboxPaths(home))) assert.ok(fs.statSync(dir).isDirectory(), dir);
  });
}

test('current calls an optional seed with the home and workspace once the directories exist; by default it seeds nothing', async () => {
  const home = path.join(tmp('seed'), 'home');
  const workspace = tmp('ws');
  const calls = [];
  const config = currentConfig({
    ...OPTIONS,
    allocatePort: async () => 41500,
    seed: async (context) => calls.push({ ...context, claudeDirExisted: fs.existsSync(path.join(context.home, '.claude')) }),
  });
  await config.prepare({ home, workspace, effort: 'high', task: { id: 't' } });
  assert.deepEqual(calls, [{ home, workspace, engramPort: 41500, claudeDirExisted: true }]);

  const bare = path.join(tmp('seed'), 'home');
  await currentConfig(OPTIONS).prepare({ home: bare, workspace, effort: 'high', task: { id: 't' } });
  assert.deepEqual(fs.readdirSync(path.join(bare, '.claude')), [], 'nothing was copied in');

  await assert.rejects(
    currentConfig({ ...OPTIONS, seed: () => { throw new Error('seed failed'); } }).prepare({ home: path.join(tmp('seed'), 'home'), workspace }),
    /seed failed/,
  );
});

test('minimal does not take a seed: its home stays bare', async () => {
  const home = path.join(tmp('bare'), 'home');
  const config = minimalConfig({ ...OPTIONS, seed: () => assert.fail('minimal must not seed') });
  await config.prepare({ home, workspace: tmp('ws') });
  assert.deepEqual(fs.readdirSync(path.join(home, '.claude')), []);
});

// ---- the engram port of a trial ------------------------------------------------------------------------------

test('sandboxEnv needs the trial\'s engram port and never falls back to the real one', () => {
  for (const engramPort of [undefined, null, '41234', 0, 80, 70000, 41234.5, REAL_ENGRAM_PORT]) {
    assert.throws(() => sandboxEnv({ home: HOME, engramPort }), /engram port/, String(engramPort));
  }
  assert.throws(() => sandboxEnv({ home: HOME }), /engram port/);
  assert.equal(sandboxEnv({ home: HOME, engramPort: 41234 }).ENGRAM_PORT, '41234', 'a string, as an environment holds it');
});

for (const platform of PLATFORMS) {
  test(`sandboxEnv (${platform}) replaces an inherited ENGRAM_PORT and removes ENGRAM_URL, ENGRAM_SOCKET and the rest of engram's own settings`, () => {
    const inherited = {
      ...fakeInherited(platform),
      ENGRAM_PORT: String(REAL_ENGRAM_PORT),
      ENGRAM_URL: `http://127.0.0.1:${REAL_ENGRAM_PORT}`,
      ENGRAM_SOCKET: '/run/engram.sock',
      ENGRAM_PROJECT: 'real-project',
      ENGRAM_HTTP_TOKEN: 'real-token',
      ENGRAM_CLOUD_TOKEN: 'cloud-token',
      ENGRAM_CLOUD_SERVER: 'https://cloud.example',
    };
    const overrides = sandboxEnv({ home: HOME, engramPort: PORT, inherited, platform });
    assert.equal(overrides.ENGRAM_PORT, String(PORT));
    for (const name of ['ENGRAM_URL', 'ENGRAM_SOCKET', 'ENGRAM_PROJECT', 'ENGRAM_HTTP_TOKEN', 'ENGRAM_CLOUD_TOKEN', 'ENGRAM_CLOUD_SERVER']) assert.equal(overrides[name], null, name);
    const env = childEnv(overrides, inherited, platform);
    assert.equal(env.ENGRAM_PORT, String(PORT));
    assert.deepEqual(Object.keys(env).filter((name) => name.startsWith('ENGRAM_')).sort(), ['ENGRAM_DATA_DIR', 'ENGRAM_PORT']);
  });
}

for (const [name, build] of BUILDERS) {
  test(`${name}'s env without a prepared engram port fails loudly, because a default would be the real server`, () => {
    const config = build(OPTIONS);
    assert.throws(() => config.env({ effort: 'medium', home: HOME }), /engram port/);
    assert.throws(() => config.env({ effort: 'medium', home: HOME, prepared: {} }), /engram port/);
    assert.throws(() => config.env({ effort: 'medium', home: HOME, prepared: { engramPort: REAL_ENGRAM_PORT } }), /7437/);
    assert.equal(config.env({ effort: 'medium', home: HOME, prepared: { engramPort: PORT } }).ENGRAM_PORT, String(PORT));
  });

  test(`${name}'s prepare allocates the trial's engram port and returns it as the prepared state`, async () => {
    const asked = [];
    const home = path.join(tmp('port'), 'home');
    const prepared = await build({ ...OPTIONS, allocatePort: async () => (asked.push('asked'), 42001) }).prepare({ home, workspace: tmp('ws'), effort: 'medium', task: { id: 't' } });
    assert.deepEqual(prepared, { engramPort: 42001 });
    assert.deepEqual(asked, ['asked'], 'one port per trial');
  });

  test(`${name}'s prepare gives two trials two different engram ports, by default`, async () => {
    const first = await build(OPTIONS).prepare({ home: path.join(tmp('port'), 'home'), workspace: tmp('ws') });
    const second = await build(OPTIONS).prepare({ home: path.join(tmp('port'), 'home'), workspace: tmp('ws') });
    assert.notEqual(first.engramPort, second.engramPort);
    for (const { engramPort } of [first, second]) assert.ok(Number.isInteger(engramPort) && engramPort >= 1024 && engramPort !== REAL_ENGRAM_PORT);
  });

  test(`${name}'s prepare refuses a port the allocator should never have given, the real engram port above all`, async () => {
    await assert.rejects(build({ ...OPTIONS, allocatePort: async () => REAL_ENGRAM_PORT }).prepare({ home: path.join(tmp('port'), 'home'), workspace: tmp('ws') }), /7437/);
  });

  test(`${name}'s prepare gives the port back when a step after it fails`, async () => {
    const released = [];
    const config = build({ ...OPTIONS, allocatePort: async () => 42002, releasePort: (port) => released.push(port) });
    // A relative workspace fails the shared preparation, whichever arm it is.
    await assert.rejects(config.prepare({ home: path.join(tmp('port'), 'home'), workspace: 'relative' }), /absolute workspace/);
    assert.deepEqual(released, [42002]);
  });

  test(`${name}'s cleanup kills whatever listens on the trial's engram port and gives the port back`, () => {
    const killed = [];
    const released = [];
    const config = build({ ...OPTIONS, killPort: (port) => (killed.push(port), { killed: [7] }), releasePort: (port) => released.push(port) });
    config.cleanup({ home: HOME, workspace: path.join(scratch, 'ws'), prepared: { engramPort: 42003 } });
    assert.deepEqual(killed, [42003]);
    assert.deepEqual(released, [42003]);
  });

  test(`${name}'s cleanup of a trial that never got a port touches no port at all`, () => {
    const config = build({ ...OPTIONS, killPort: () => assert.fail('no port, nothing to kill'), releasePort: () => assert.fail('nothing to release') });
    config.cleanup({ home: HOME, workspace: path.join(scratch, 'ws'), prepared: undefined });
    config.cleanup({ home: HOME, workspace: path.join(scratch, 'ws'), prepared: {} });
  });

  test(`${name}'s cleanup that cannot kill the listener throws, and the port is released all the same`, () => {
    const released = [];
    const config = build({ ...OPTIONS, killPort: () => { throw new Error('port 42004 still listens'); }, releasePort: (port) => released.push(port) });
    assert.throws(() => config.cleanup({ home: HOME, workspace: path.join(scratch, 'ws'), prepared: { engramPort: 42004 } }), /still listens/);
    assert.deepEqual(released, [42004]);
  });

  test(`${name}'s cleanup defaults to the kill by port, which refuses the real engram port before it looks at anything`, () => {
    const config = build(OPTIONS);
    assert.throws(() => config.cleanup({ home: HOME, workspace: path.join(scratch, 'ws'), prepared: { engramPort: REAL_ENGRAM_PORT } }), /7437/);
  });
}

test('the port the child saw is the port the trial\'s cleanup freed, and a trial never frees another one', async () => {
  const killed = [];
  const { ports, reports } = await runThroughFakeAgent(() => minimalConfig({ ...OPTIONS, killPort: (port) => (killed.push(port), { killed: [] }) }), 2);
  assert.deepEqual(killed, ports);
  assert.deepEqual(reports.map((report) => report.env.ENGRAM_PORT), ports.map(String));
  assert.ok(!killed.includes(REAL_ENGRAM_PORT));
});

// ---- end to end: what the child actually received --------------------------------------------------

/** Sets `vars` in `process.env` for the length of `fn`, then restores what was there. */
async function withEnv(vars, fn) {
  const saved = Object.fromEntries(Object.keys(vars).map((name) => [name, process.env[name]]));
  Object.assign(process.env, vars);
  try {
    return await fn();
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

const TOKEN = 'sekrit-oauth-value-0123456789';
// What a developer's real shell holds: the real home everywhere, a live Claude session, credentials.
const DIRTY_PROCESS_ENV = {
  ...Object.fromEntries(SCRUBBED.map((name) => [name, path.join(REAL_HOME, name)])),
  CLAUDE_CONFIG_DIR: path.join(REAL_HOME, '.claude'),
  ENGRAM_DATA_DIR: path.join(REAL_HOME, '.engram'),
  ENGRAM_PORT: String(REAL_ENGRAM_PORT),
  ENGRAM_URL: `http://127.0.0.1:${REAL_ENGRAM_PORT}`,
  ENGRAM_SOCKET: path.join(REAL_HOME, 'engram.sock'),
  DISABLE_TELEMETRY: '0',
  CLAUDE_CODE_OAUTH_TOKEN: TOKEN,
};

/** Runs `repeats` trials of the sample task with the fake agent standing in for the binary of a config
 * built by `build`, under a process env full of things that must not reach it. Returns what the agent
 * reported for each trial (its env redacted by the fake agent itself), the records and the paths to inspect.
 * `fakeEnv` adds variables the fake agent obeys. */
async function runThroughFakeAgent(build, repeats = 1, fakeEnv = {}) {
  const reportDir = tmp('report');
  const workRoot = tmp('work');
  const runsDir = tmp('runs');
  const homes = [];
  const ports = [];
  const config = build();
  const wrapped = {
    ...config,
    args: (context) => [FAKE_AGENT, ...config.args(context)],
    versionArgs: [FAKE_AGENT, '--version'],
    env: (context) => ({ ...config.env(context), FAKE_AGENT_MODE: 'noop', FAKE_AGENT_REPORT: path.join(reportDir, `${path.basename(context.home)}.json`), ...fakeEnv }),
    prepare: async (context) => {
      homes.push(context.home);
      const prepared = await config.prepare(context);
      ports.push(prepared.engramPort);
      return prepared;
    },
  };
  const reportTexts = [];
  const records = [];
  await withEnv(DIRTY_PROCESS_ENV, async () => {
    for (let repeat = 1; repeat <= repeats; repeat += 1) {
      const outcome = await runTrial({ task: loadTask(SAMPLE), config: wrapped, effort: 'high', repeat, readVersion: () => '1.0.0', workRoot, runsDir });
      assert.equal(outcome.status, 'recorded');
      records.push(outcome.record);
      reportTexts.push(fs.readFileSync(path.join(reportDir, `${path.basename(homes[repeat - 1])}.json`), 'utf8'));
    }
  });
  return { homes, ports, reports: reportTexts.map((text) => JSON.parse(text)), reportTexts, records, runsDir, workRoot };
}

for (const [name, build] of BUILDERS) {
  test(`${name}: the child process receives the sandbox paths and switches, none of the real env, and a different home each trial`, async () => {
    const { homes, ports, reports, workRoot } = await runThroughFakeAgent(() => build(OPTIONS), 2);
    assert.equal(homes.length, 2);
    assert.notEqual(homes[0], homes[1], 'a trial never reuses the previous home');
    assert.notEqual(ports[0], ports[1], 'nor the previous engram port');
    const fold = (key) => (process.platform === 'win32' ? key.toLowerCase() : key);
    // Windows adds LOGONSERVER (a host name) to every process whatever its env block holds, and would add
    // the real HOMEDRIVE and HOMEPATH as well if `sandboxEnv` did not set them, which is why it does.
    const osAdded = process.platform === 'win32' ? ['LOGONSERVER'] : [];
    const allowed = new Set([...EXPECTED_ALLOWLIST, ...PATH_NAMES, 'ENGRAM_PORT', ...(process.platform === 'win32' ? WINDOWS_PATH_NAMES : []), ...Object.keys(EXPECTED_SWITCHES), ...osAdded].map(fold));
    reports.forEach((report, index) => {
      const home = homes[index];
      // This is the predecessor's failure: switches and paths were declared but never reached the child.
      for (const [key, value] of nonNull(sandboxEnv({ home, engramPort: ports[index] }))) {
        if (process.platform !== 'win32' && WINDOWS_PATH_NAMES.includes(key)) continue;
        assert.equal(report.env[key], value, `${key} as the child saw it`);
      }
      assert.equal(report.env.USERPROFILE, home);
      assert.equal(report.env.HOME, home);
      assert.equal(report.env.ENGRAM_PORT, String(ports[index]), 'the engram port the child saw is the trial own');
      for (const key of [...SCRUBBED, 'ENGRAM_URL', 'ENGRAM_SOCKET']) assert.ok(!Object.keys(report.env).some((seen) => fold(seen) === fold(key)), `${key} reached the child`);
      assert.notEqual(report.env.ENGRAM_PORT, String(REAL_ENGRAM_PORT), 'the inherited port is replaced, not passed on');
      const stray = Object.keys(report.env).filter((key) => !allowed.has(fold(key)) && !key.startsWith('FAKE_AGENT_'));
      assert.deepEqual(stray, [], 'only the allowlist, the paths and the switches');
      assert.deepEqual(report.argv, name === 'minimal' ? [...sharedArgs('high'), ...MINIMAL_ONLY] : [...sharedArgs('high'), '--setting-sources', 'user,project,local'], 'the argv as the child saw it');
    });
    for (const home of homes) assert.ok(!fs.existsSync(home), 'the home is removed after the trial');
    assert.deepEqual(fs.readdirSync(workRoot), []);
  });
}

test('an OAuth token in the environment reaches the child but never a report or a raw log', async () => {
  const { reports, reportTexts, runsDir } = await runThroughFakeAgent(() => minimalConfig(OPTIONS));
  assert.equal(reports[0].env.CLAUDE_CODE_OAUTH_TOKEN, '<set>', 'the child did receive it, and the fake agent redacted its value');
  assert.ok(!reportTexts[0].includes(TOKEN), 'the report');
  const logs = fs.readdirSync(runsDir);
  assert.ok(logs.length > 0);
  for (const file of logs) assert.ok(!fs.readFileSync(path.join(runsDir, file), 'utf8').includes(TOKEN), file);
});

// ---- the subagent configs: two arms across three delegation modes -----------------------------------
// The model ids and the mode texts are what the feature measures (`odd/tasks/subagent-model-routing.md`), so
// the tests hold their own copy of each, as they do of the allowlist: a word changed in the module by
// accident fails here instead of quietly changing what both arms were told.

const EXPECTED_SUBAGENT_MODELS = { 'sub-opus': 'claude-opus-5-5', 'sub-haiku': 'claude-haiku-5-5' };
const EXPECTED_MODES = {
  explore: 'Before you change any file, use the Agent tool to delegate the exploration of this repository to one subagent: have it read the code, the docs and the tests that matter for the task and return a brief with file paths. Read for yourself only to check what the brief says. Then write the change yourself.',
  verify: 'Write the change yourself. Do not run the tests yourself: each time you need to know whether the tests pass, use the Agent tool to delegate that to a subagent that runs them and reports each failure with its message. Fix what it reports and delegate again until it reports no failure.',
  write: 'Do not edit any file yourself. Plan the change, then use the Agent tool to delegate the writing to one subagent, with instructions complete enough for it to work alone. Review what it wrote; if something is wrong or missing, delegate the correction to a subagent again.',
};
const EXPECTED_SUBAGENT_NAMES = ['sub-opus-explore', 'sub-opus-verify', 'sub-opus-write', 'sub-haiku-explore', 'sub-haiku-verify', 'sub-haiku-write'];
const SUBAGENT_CASES = Object.entries(EXPECTED_SUBAGENT_MODELS).flatMap(([arm, model]) => Object.entries(EXPECTED_MODES).map(([mode, text]) => ({ name: `${arm}-${mode}`, arm, mode, model, text })));
const SUBAGENT_VARIABLES = ['CLAUDE_CODE_SUBAGENT_MODEL', 'CLAUDE_CODE_SUBAGENT_MODEL_FORCE'];

test('the subagent configs are the two arms across the three delegation modes: six names the runner accepts in a trial key', () => {
  assert.deepEqual(SUBAGENT_MODELS, EXPECTED_SUBAGENT_MODELS);
  assert.deepEqual(DELEGATION_MODES, EXPECTED_MODES);
  assert.deepEqual(Object.keys(SUBAGENT_CONFIGS), EXPECTED_SUBAGENT_NAMES);
  for (const { name, arm, mode, model } of SUBAGENT_CASES) {
    assert.deepEqual(SUBAGENT_CONFIGS[name], { arm, mode, subagentModel: model }, name);
    assert.equal(subagentConfig(name, OPTIONS).name, name);
  }
  const plan = planTrials({ tasks: [{ id: 't' }], configs: EXPECTED_SUBAGENT_NAMES.map((name) => subagentConfig(name, OPTIONS)), efforts: ['medium'], repeats: 1 });
  assert.deepEqual(plan.map((trial) => trial.config.name), EXPECTED_SUBAGENT_NAMES);
});

test('the Haiku arm names its model in full, never the alias, which this Claude Code resolves to an older model', () => {
  for (const model of Object.values(SUBAGENT_MODELS)) assert.match(model, /^claude-(opus|haiku)-\d+-\d+$/);
  assert.equal(SUBAGENT_MODELS['sub-haiku'], 'claude-haiku-5-5');
});

test('what a results document pins of a subagent config is the model it forces and the SHA-256 of the text it appends', () => {
  // The digests of the three texts above, as UTF-8: an edited mode is another digest, so a continued run sees it.
  const digests = {
    explore: '28abb8958029b25217d22496d2b38201f93e02e25e01d20051c1133fcfad882e',
    verify: 'c5e2c9401939afb5247f6b175446a5b1df076e5dd748e18e33597f5ad61378b5',
    write: '25160c8f82fa55c3034b62cff2d9e7cb150265eae98133114625ff7b980d5397',
  };
  for (const { name, mode, model, text } of SUBAGENT_CASES) {
    assert.deepEqual(subagentPin(name), { model, delegationSha256: digests[mode] }, name);
    assert.equal(crypto.createHash('sha256').update(text, 'utf8').digest('hex'), digests[mode], `${mode}: the digest is of the text the config appends`);
  }
  assert.throws(() => subagentPin('minimal'), /is not a subagent config/);
});

test('a subagent config passes the minimal arm\'s flags, then the delegation mode appended to the system prompt, the same text in both arms', () => {
  for (const { name, text } of SUBAGENT_CASES) {
    const config = subagentConfig(name, OPTIONS);
    for (const effort of ['medium', 'high']) {
      assert.deepEqual(config.args({ effort, home: HOME }), [...minimalConfig(OPTIONS).args({ effort, home: HOME }), '--append-system-prompt', text], `${name} at ${effort}`);
    }
  }
  for (const mode of Object.keys(EXPECTED_MODES)) {
    assert.deepEqual(subagentConfig(`sub-opus-${mode}`, OPTIONS).args({ effort: 'medium' }), subagentConfig(`sub-haiku-${mode}`, OPTIONS).args({ effort: 'medium' }), `${mode}: the arms differ in no argument`);
  }
  assert.deepEqual(subagentConfig('sub-opus-write', OPTIONS).args({ effort: 'medium' }).slice(0, 13), [...sharedArgs('medium'), ...MINIMAL_ONLY], 'the main model and the effort are the ones given');
});

test('a subagent config runs under the minimal arm\'s sandbox env plus the forced subagent model, and nothing else', () => {
  const context = { effort: 'medium', home: HOME, workspace: path.join(scratch, 'ws'), prepared: { engramPort: PORT } };
  for (const { name, model } of SUBAGENT_CASES) {
    assert.deepEqual(
      subagentConfig(name, OPTIONS).env(context),
      { ...minimalConfig(OPTIONS).env(context), CLAUDE_CODE_SUBAGENT_MODEL: model, CLAUDE_CODE_SUBAGENT_MODEL_FORCE: '1' },
      name,
    );
  }
  // The minimal arm itself never carries them: there the subagent model is whatever the session decides.
  for (const variable of SUBAGENT_VARIABLES) assert.equal(minimalConfig(OPTIONS).env(context)[variable] ?? null, null, variable);
});

for (const platform of PLATFORMS) {
  test(`a subagent config (${platform}) replaces a subagent model inherited from the launching shell, however its name is cased`, () => {
    const inherited = { ...fakeInherited(platform), Claude_Code_Subagent_Model: 'haiku', CLAUDE_CODE_SUBAGENT_MODEL_FORCE: '0' };
    // The config a suite runs, built by the code a suite builds it with: the subagent config's own env, which lays
    // the two variables over the sandbox env of this fake environment, and the suite's token laid over that. Neither
    // overlay is rebuilt here, so one that dropped a variable would fail.
    const context = { home: HOME, prepared: { engramPort: PORT }, inherited, platform };
    const env = childEnv(withToken(subagentConfig('sub-haiku-explore', OPTIONS), TOKEN).env(context), inherited, platform);
    assert.equal(env.CLAUDE_CODE_SUBAGENT_MODEL, 'claude-haiku-5-5');
    assert.equal(env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE, '1');
    assert.ok(!Object.hasOwn(env, 'Claude_Code_Subagent_Model'), 'the inherited spelling is gone');
    assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN, TOKEN, 'the token of the eval, not the one the shell held');
    // The rest is the sandbox of this fake environment as the minimal arm gets it: nothing else was added or lost.
    const { CLAUDE_CODE_SUBAGENT_MODEL: _model, CLAUDE_CODE_SUBAGENT_MODEL_FORCE: _force, CLAUDE_CODE_OAUTH_TOKEN: _token, ...rest } = env;
    const { CLAUDE_CODE_OAUTH_TOKEN: _inherited, ...minimal } = childEnv(minimalConfig(OPTIONS).env(context), inherited, platform);
    assert.deepEqual(rest, minimal);
    // Without the config, the inherited ones are removed like everything else outside the allowlist.
    const bare = childEnv(sandboxEnv({ home: HOME, engramPort: PORT, inherited, platform }), inherited, platform);
    assert.deepEqual(Object.keys(bare).filter((name) => /subagent/i.test(name)), []);
  });
}

test('subagentConfig refuses a name that is not one of the six, and builds on the same requirements as the minimal arm', () => {
  for (const name of ['minimal', 'current', 'sub-opus', 'sub-sonnet-write', 'sub-opus-review', 'toString', undefined]) {
    assert.throws(() => subagentConfig(name, OPTIONS), /is not a subagent config \(one of sub-opus-explore, .*sub-haiku-write\)/, String(name));
  }
  assert.throws(() => subagentConfig('sub-opus-write', { command: OPTIONS.command, permissionMode: 'x' }), /sub-opus-write config: "model"/);
  assert.throws(() => subagentConfig('sub-opus-write', { command: OPTIONS.command, model: 'x' }), /permissionMode/);
  assert.throws(() => subagentConfig('sub-opus-write', { command: 'claude', model: 'x', permissionMode: 'y' }), /absolute/);
  assert.throws(() => subagentConfig('sub-opus-write', OPTIONS).args({}), /no effort/);
});

test('a subagent config has the minimal arm\'s lifecycle: an engram port of its own, a bare home, no seed, and the port freed afterwards', async () => {
  const home = path.join(tmp('sub'), 'home');
  const killed = [];
  const released = [];
  const config = subagentConfig('sub-haiku-write', {
    ...OPTIONS, allocatePort: async () => 42101, killPort: (port) => (killed.push(port), { killed: [] }), releasePort: (port) => released.push(port),
    seed: () => assert.fail('a subagent config must not seed'),
  });
  const prepared = await config.prepare({ home, workspace: tmp('ws'), effort: 'medium', task: { id: 't' } });
  assert.deepEqual(prepared, { engramPort: 42101 });
  for (const dir of Object.values(sandboxPaths(home))) assert.ok(fs.statSync(dir).isDirectory(), dir);
  assert.deepEqual(fs.readdirSync(path.join(home, '.claude')), [], 'nothing was copied in');
  config.cleanup({ home, workspace: path.join(scratch, 'ws'), prepared });
  assert.deepEqual([killed, released], [[42101], [42101]]);
  assert.throws(() => config.env({ effort: 'medium', home: HOME }), /engram port/, 'no default port, as for every arm');
  assert.ok(!('versionArgs' in config) && !('reader' in config), 'probed and read as Claude Code, like the minimal arm');
});

test('a subagent config: the child process receives the two variables and the appended mode on top of exactly what the minimal arm gets', async () => {
  const { homes, ports, reports, workRoot } = await runThroughFakeAgent(() => subagentConfig('sub-haiku-verify', OPTIONS));
  const [report] = reports;
  assert.equal(report.env.CLAUDE_CODE_SUBAGENT_MODEL, 'claude-haiku-5-5');
  assert.equal(report.env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE, '1');
  assert.deepEqual(report.argv, [...sharedArgs('high'), ...MINIMAL_ONLY, '--append-system-prompt', EXPECTED_MODES.verify], 'the mode text arrives whole, as one argument');
  for (const [key, value] of nonNull(sandboxEnv({ home: homes[0], engramPort: ports[0] }))) {
    if (process.platform !== 'win32' && WINDOWS_PATH_NAMES.includes(key)) continue;
    assert.equal(report.env[key], value, `${key} as the child saw it`);
  }
  const fold = (key) => (process.platform === 'win32' ? key.toLowerCase() : key);
  const osAdded = process.platform === 'win32' ? ['LOGONSERVER'] : [];
  const allowed = new Set([...EXPECTED_ALLOWLIST, ...PATH_NAMES, 'ENGRAM_PORT', ...(process.platform === 'win32' ? WINDOWS_PATH_NAMES : []), ...Object.keys(EXPECTED_SWITCHES), ...SUBAGENT_VARIABLES, ...osAdded].map(fold));
  assert.deepEqual(Object.keys(report.env).filter((key) => !allowed.has(fold(key)) && !key.startsWith('FAKE_AGENT_')), [], 'only the allowlist, the paths, the switches and the two variables');
  for (const key of SCRUBBED) assert.ok(!Object.keys(report.env).some((seen) => fold(seen) === fold(key)), `${key} reached the child`);
  assert.ok(!fs.existsSync(homes[0]), 'the home is removed after the trial');
  assert.deepEqual(fs.readdirSync(workRoot), []);
});

// ---- what a subagent trial keeps: the session transcripts and their list cost -----------------------

const filesBelow = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (
  entry.isDirectory() ? filesBelow(path.join(dir, entry.name), base) : [path.relative(base, path.join(dir, entry.name)).split(path.sep).join('/')]
)).sort();

test('a subagent config keeps the transcripts its agent left in the trial home, and records their list cost split by who asked', async () => {
  const { records, runsDir, homes, workRoot } = await runThroughFakeAgent(() => subagentConfig('sub-haiku-write', OPTIONS), 1, { FAKE_AGENT_TRANSCRIPTS: PROBE_TRANSCRIPTS });
  const [record] = records;
  assert.deepEqual(record.transcripts, { files: 3, errors: [] });
  const kept = path.join(runsDir, 'sample__sub-haiku-write__high__1.transcripts');
  assert.deepEqual(filesBelow(kept), filesBelow(PROBE_TRANSCRIPTS), 'the layout below the project directory, in the raw logs of the trial');
  assert.ok(!fs.existsSync(homes[0]), 'copied before the home was removed');
  assert.deepEqual(fs.readdirSync(workRoot), []);

  const { listCost } = record;
  assert.equal(listCost.source, 'transcripts');
  assert.deepEqual(
    [listCost.orchestrator.listCostUsd, listCost.subagents.listCostUsd, listCost.total.listCostUsd],
    [0.3413604, 0.004097825, 0.345458225],
    'the probe session at list price: Opus orchestrating, one Haiku subagent',
  );
  assert.deepEqual(listCost.subagents.agents.map((row) => [row.agentType, row.models, row.requests]), [['general-purpose', ['claude-haiku-5-5'], 1]]);
  // The fake agent's result names models of its own, so the totals differ: a flag in the record, and a record all the same.
  assert.equal(listCost.modelUsageCheck.matches, false);
  assert.deepEqual(JSON.parse(JSON.stringify(record)), record, 'the record is what the results file will hold');
  for (const file of filesBelow(kept)) assert.ok(!fs.readFileSync(path.join(kept, file), 'utf8').includes(TOKEN), file);
});

test('a subagent trial whose agent left no transcript records an estimate from the result, marked as one', async () => {
  const { records, runsDir } = await runThroughFakeAgent(() => subagentConfig('sub-opus-explore', OPTIONS));
  const [{ transcripts, listCost }] = records;
  assert.deepEqual(transcripts, { files: 0, errors: [] });
  assert.deepEqual([listCost.source, listCost.estimated], ['modelUsage', true]);
  // The fake agent's models have no list price: named, and no cost is made up for them.
  assert.deepEqual([listCost.unpricedModels, listCost.total.listCostUsd], [['fake-model', 'fake-helper-model'], null]);
  assert.ok(!fs.existsSync(path.join(runsDir, 'sample__sub-opus-explore__high__1.transcripts')), 'nothing was kept, so nothing was made');
});

for (const [name, build] of BUILDERS) {
  test(`${name} keeps no transcript and records no list cost, whatever its agent left: its record is what it always was`, async () => {
    assert.ok(!('transcripts' in build(OPTIONS)));
    const { records, runsDir } = await runThroughFakeAgent(() => build(OPTIONS), 1, { FAKE_AGENT_TRANSCRIPTS: PROBE_TRANSCRIPTS });
    assert.ok(!('transcripts' in records[0]) && !('listCost' in records[0]));
    assert.deepEqual(fs.readdirSync(runsDir).sort(), [`sample__${name}__high__1.stderr.log`, `sample__${name}__high__1.stdout.log`]);
  });
}

// ---- the shared preparation: a git identity and the fixture as the first commit ---------------------

/** Runs git in `cwd` under the env a trial's agent would get, so what it prints is what the agent would see. */
function gitUnderSandbox(home, cwd, ...args) {
  const result = spawnSync('git', args, { cwd, env: childEnv(sandboxEnv({ home, engramPort: PORT })), encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}

function writeFixtureFiles(workspace) {
  fs.mkdirSync(path.join(workspace, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'a.txt'), 'alpha\n');
  fs.writeFileSync(path.join(workspace, 'sub', 'b.txt'), 'beta\n');
  fs.writeFileSync(path.join(workspace, '.hidden'), 'dot\n');
}

for (const [name, build] of BUILDERS) {
  test(`${name}'s prepare makes the workspace a git repository with the fixture as its one commit, authored by the dummy identity`, async () => {
    const home = path.join(tmp('git'), 'home');
    const workspace = tmp('ws');
    writeFixtureFiles(workspace);
    await build(OPTIONS).prepare({ home, workspace, effort: 'medium', task: { id: 't' } });
    assert.equal(gitUnderSandbox(home, workspace, 'log', '--format=%an|%ae|%cn|%ce|%s'), 'eval|eval@localhost|eval|eval@localhost|fixture', 'exactly one commit');
    assert.deepEqual(gitUnderSandbox(home, workspace, 'ls-tree', '-r', '--name-only', 'HEAD').split('\n').sort(), ['.hidden', 'a.txt', 'sub/b.txt']);
    assert.equal(gitUnderSandbox(home, workspace, 'status', '--porcelain'), '', 'nothing is left uncommitted');
  });

  test(`${name}'s prepare writes the same .gitconfig, with the dummy identity, at the root of the home`, async () => {
    const home = path.join(tmp('gitconfig'), 'home');
    await build(OPTIONS).prepare({ home, workspace: tmp('ws'), effort: 'medium', task: { id: 't' } });
    const config = fs.readFileSync(path.join(home, '.gitconfig'), 'utf8');
    assert.match(config, /name = eval\b/);
    assert.match(config, /email = eval@localhost\b/);
    assert.equal(gitUnderSandbox(home, home, 'config', '--global', '--get', 'user.email'), 'eval@localhost');
  });

  test(`${name}'s prepare commits under the dummy identity whatever git settings the real shell holds`, async () => {
    const realConfig = path.join(tmp('realgit'), 'gitconfig');
    fs.writeFileSync(realConfig, '[user]\n\tname = Real Person\n\temail = real@example.com\n');
    const home = path.join(tmp('hermetic'), 'home');
    const workspace = tmp('ws');
    writeFixtureFiles(workspace);
    await withEnv(
      { GIT_CONFIG_GLOBAL: realConfig, GIT_AUTHOR_NAME: 'Real Author', GIT_AUTHOR_EMAIL: 'author@example.com', GIT_COMMITTER_NAME: 'Real Committer', GIT_COMMITTER_EMAIL: 'committer@example.com', GIT_DIR: path.join(scratch, 'not-a-git-dir') },
      () => build(OPTIONS).prepare({ home, workspace, effort: 'medium', task: { id: 't' } }),
    );
    assert.equal(gitUnderSandbox(home, workspace, 'log', '--format=%an|%ae|%cn|%ce'), 'eval|eval@localhost|eval|eval@localhost');
  });

  test(`${name}'s prepare works on an empty workspace and refuses a missing or relative one`, async () => {
    const home = path.join(tmp('edge'), 'home');
    await build(OPTIONS).prepare({ home, workspace: tmp('ws'), effort: 'medium', task: { id: 't' } });
    await assert.rejects(build(OPTIONS).prepare({ home: path.join(tmp('edge'), 'home'), effort: 'medium', task: { id: 't' } }), /workspace/);
    await assert.rejects(build(OPTIONS).prepare({ home: path.join(tmp('edge'), 'home'), workspace: 'rel', effort: 'medium', task: { id: 't' } }), /absolute workspace/);
  });
}

test('prepare ignores the system git config: one a commit would honour does not touch the fixture commit', () => {
  // GIT_CONFIG_SYSTEM stands in for Git for Windows' own system file (autocrlf, credential helpers, and
  // at worst a signing requirement or a hooks directory). It is outside the allowlist, so the seam passes
  // it to prepareSandbox's git on purpose: with GIT_CONFIG_NOSYSTEM set, git must not read it at all.
  const hooks = tmp('system-hooks');
  fs.writeFileSync(path.join(hooks, 'pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const system = path.join(tmp('system'), 'gitconfig');
  fs.writeFileSync(system, `[commit]\n\tgpgsign = true\n[gpg]\n\tprogram = no-such-gpg-program\n[core]\n\thooksPath = ${hooks.split(path.sep).join('/')}\n`);
  // The second variant tries to lift the switch itself: the caller's env must not be able to.
  for (const env of [{ GIT_CONFIG_SYSTEM: system }, { GIT_CONFIG_SYSTEM: system, GIT_CONFIG_NOSYSTEM: '0' }]) {
    const home = path.join(tmp('nosystem'), 'home');
    const workspace = tmp('ws');
    writeFixtureFiles(workspace);
    prepareSandbox({ home, workspace, env, engramPort: PORT });
    assert.equal(gitUnderSandbox(home, workspace, 'log', '--format=%s'), 'fixture', 'the commit was made');
  }
});

test('the fixture commit starts no git maintenance: nothing of it writes in the workspace once prepare has returned', () => {
  // A commit runs `git maintenance run --auto --detach`, which writes in .git/objects after the commit has
  // ended (measured on git 2.53: 20 of 20 times, 0 of 20 with maintenance.auto=false). A trial that stops in
  // prepare removes its workspace at once, and a writer still in it races that removal: the flaky failure
  // eval-missing-login-workroot-kept (docs/FAILURES.md). GIT_TRACE names every command git starts.
  const trace = path.join(tmp('trace'), 'git-trace.txt');
  const workspace = tmp('ws');
  writeFixtureFiles(workspace);
  prepareSandbox({ home: path.join(tmp('maintenance'), 'home'), workspace, env: { GIT_TRACE: trace }, engramPort: PORT });
  const lines = fs.readFileSync(trace, 'utf8').split(/\r?\n/);
  assert.ok(lines.some((line) => /built-in: git .*commit/.test(line)), 'the trace holds the fixture commit');
  assert.deepEqual(lines.filter((line) => /maintenance|\bgc\b/.test(line)), [], 'no maintenance and no gc is started');
});

test('the agent keeps the system git config: GIT_CONFIG_NOSYSTEM is set for the fixture commit only, never in the sandbox env', () => {
  assert.ok(!SANDBOX_ALLOWLIST.includes('GIT_CONFIG_NOSYSTEM'));
  // What the agent gets is the effective child env, so that is what is asserted: `sandboxEnv` lists an
  // inherited name it removes as a `null` key, so a key check would fail whenever the shell exports the
  // variable, and say nothing about the child either way.
  for (const inherited of [{ PATH: '/bin' }, { PATH: '/bin', GIT_CONFIG_NOSYSTEM: '1' }, { PATH: '/bin', git_config_nosystem: '1' }]) {
    for (const platform of ['win32', 'linux']) {
      const child = childEnv(sandboxEnv({ home: HOME, engramPort: PORT, inherited, platform }), inherited, platform);
      assert.deepEqual(Object.keys(child).filter((name) => name.toLowerCase() === 'git_config_nosystem'), [], `${platform} with ${JSON.stringify(inherited)}`);
    }
  }
  const exported = { PATH: '/bin', GIT_CONFIG_NOSYSTEM: '1' };
  assert.equal(sandboxEnv({ home: HOME, engramPort: PORT, inherited: exported, platform: 'linux' }).GIT_CONFIG_NOSYSTEM, null, 'an inherited one is a removal, which a key check mistakes for a setting');
});

test('both arms get a byte-identical .gitconfig', async () => {
  const configs = [];
  for (const [, build] of BUILDERS) {
    const home = path.join(tmp('same'), 'home');
    await build(OPTIONS).prepare({ home, workspace: tmp('ws'), effort: 'medium', task: { id: 't' } });
    configs.push(fs.readFileSync(path.join(home, '.gitconfig'), 'utf8'));
  }
  assert.equal(configs[0], configs[1]);
});

// ---- the work root -------------------------------------------------------------------------------------------

/** A fake real home inside the scratch directory, for `assertWorkRoot`'s `realHome`. */
const fakeRealHome = () => {
  const home = path.join(tmp('wr-home'), 'person');
  fs.mkdirSync(home, { recursive: true });
  return home;
};
/** An `exists` that only sees what is inside the scratch directory. The scratch directory itself lives
 * under this machine's temp folder, which on Windows is inside the real home, whose `.claude` the real
 * check would (rightly) find above it; so a test that needs a root with clean ancestors cannot use one. */
const existsInScratchOnly = (target) => {
  const relative = path.relative(scratch, target);
  return !relative.startsWith('..') && !path.isAbsolute(relative) && fs.lstatSync(target, { throwIfNoEntry: false }) !== undefined;
};
const cleanRoot = () => path.join(tmp('wr-parent'), 'work');

test('defaultWorkRoot is a sibling of the repository, so no trial workspace has the home or the repo above it', () => {
  const repo = path.join(tmp('wr-repo'), 'js-harness');
  assert.equal(defaultWorkRoot({ repoRoot: repo }), path.join(path.dirname(repo), 'js-harness-evals-work'));
  assert.equal(defaultWorkRoot({ repoRoot: repo + path.sep }), path.join(path.dirname(repo), 'js-harness-evals-work'), 'a trailing separator changes nothing');
  assert.throws(() => defaultWorkRoot({ repoRoot: 'js-harness' }), /absolute/);
  assert.throws(() => defaultWorkRoot({}), /repoRoot/);
});

test('assertWorkRoot accepts an absolute root outside the home whose ancestors hold no project memory, existing or not', () => {
  const realHome = fakeRealHome();
  const root = cleanRoot();
  assert.doesNotThrow(() => assertWorkRoot(root, { realHome, exists: existsInScratchOnly }), 'not created yet');
  fs.mkdirSync(root);
  assert.doesNotThrow(() => assertWorkRoot(root, { realHome, exists: existsInScratchOnly }));
  const sibling = path.join(path.dirname(realHome), `${path.basename(realHome)}2`, 'work');
  assert.doesNotThrow(() => assertWorkRoot(sibling, { realHome, exists: existsInScratchOnly }), 'a name that only starts with the home name is not inside it');
});

test('assertWorkRoot rejects a relative root and a missing real home', () => {
  const realHome = fakeRealHome();
  assert.throws(() => assertWorkRoot('work', { realHome }), /absolute/);
  assert.throws(() => assertWorkRoot(cleanRoot(), { realHome: 'home' }), /absolute/);
  assert.throws(() => assertWorkRoot(cleanRoot(), {}), /realHome/);
});

test('assertWorkRoot rejects the real home itself, anything inside it, and a root that reaches it through a link', () => {
  const realHome = fakeRealHome();
  for (const root of [realHome, path.join(realHome, 'AppData', 'Local', 'Temp'), path.join(realHome, 'new', 'deep')]) {
    assert.throws(() => assertWorkRoot(root, { realHome, exists: existsInScratchOnly }), /inside the real home/, root);
  }
  // A work root that is a junction into the home is inside it for every write that goes through it.
  const junction = path.join(tmp('wr-link'), 'work');
  fs.symlinkSync(realHome, junction, 'junction');
  assert.throws(() => assertWorkRoot(junction, { realHome, exists: existsInScratchOnly }), /inside the real home/);
  assert.throws(() => assertWorkRoot(path.join(junction, 'sub'), { realHome, exists: existsInScratchOnly }), /inside the real home/);
});

for (const name of ['CLAUDE.md', 'CLAUDE.local.md', 'AGENTS.md', '.claude']) {
  test(`assertWorkRoot rejects a root whose ancestor holds ${name}, naming it, because every trial would load it as project memory`, () => {
    const realHome = fakeRealHome();
    const parent = tmp('wr-memory');
    const root = path.join(parent, 'a', 'work');
    fs.mkdirSync(root, { recursive: true });
    const planted = path.join(parent, name);
    if (name === '.claude') fs.mkdirSync(planted);
    else fs.writeFileSync(planted, 'instructions\n');
    assert.throws(() => assertWorkRoot(root, { realHome, exists: existsInScratchOnly }), (error) => error.message.includes(planted) && error.message.includes(name));
    // The root itself counts too, and the nearest one is the one named.
    const inRoot = path.join(root, 'AGENTS.md');
    fs.writeFileSync(inRoot, 'x\n');
    assert.throws(() => assertWorkRoot(root, { realHome, exists: existsInScratchOnly }), (error) => error.message.includes(inRoot) && !error.message.includes(planted));
  });
}

test('assertWorkRoot reads the real file system by default: a planted CLAUDE.md above a root is found without any seam', () => {
  const realHome = fakeRealHome();
  const parent = tmp('wr-real');
  fs.writeFileSync(path.join(parent, 'CLAUDE.md'), 'x\n');
  assert.throws(() => assertWorkRoot(path.join(parent, 'work'), { realHome }), (error) => error.message.includes(path.join(parent, 'CLAUDE.md')));
});

// ---- the honesty configs: the template's text as memory, with and without the line -----------------------

const BASE_SENTENCE = 'A behavior change arrives with the test that proves it, written first. A claim about this project carries its evidence.';
const LINE_SENTENCE = 'Each claim is checked, assumed or not known.';
const BASE_MEMORY = `# Project\n\n## What good looks like\n${BASE_SENTENCE}\n`;
const LINE_MEMORY = `${BASE_MEMORY}${LINE_SENTENCE}\n`;
const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

test('the honesty configs are two arms: the template text as memory, and the same with the line added', () => {
  assert.deepEqual(HONESTY_CONFIGS, { 'honesty-base': { arm: 'base' }, 'honesty-line': { arm: 'line' } });
  assert.deepEqual(HONESTY_SENTENCES, { base: BASE_SENTENCE, line: LINE_SENTENCE });
  for (const name of Object.keys(HONESTY_CONFIGS)) assert.equal(honestyConfig(name, OPTIONS).name, name);
});

test('honestyMemory is the template\'s "What good looks like" text, and only the line arm carries the line', () => {
  assert.equal(honestyMemory('honesty-base'), BASE_MEMORY);
  assert.equal(honestyMemory('honesty-line'), LINE_MEMORY);
  assert.ok(!honestyMemory('honesty-base').includes(LINE_SENTENCE), 'the line is in the line arm alone');
  assert.ok(honestyMemory('honesty-line').includes(LINE_SENTENCE));
  assert.throws(() => honestyMemory('minimal'), /is not an honesty config \(one of honesty-base, honesty-line\)/);
  assert.throws(() => honestyMemory(undefined), /is not an honesty config/);
});

test('honestyPin is the SHA-256 of the memory the arm seeds, and the two arms pin different texts', () => {
  assert.deepEqual(honestyPin('honesty-base'), { memorySha256: sha256(BASE_MEMORY) });
  assert.deepEqual(honestyPin('honesty-line'), { memorySha256: sha256(LINE_MEMORY) });
  assert.notEqual(honestyPin('honesty-base').memorySha256, honestyPin('honesty-line').memorySha256);
  assert.throws(() => honestyPin('sub-opus-write'), /is not an honesty config/);
});

test('the two honesty arms pass the same arguments: the minimal flags with the project settings source loaded', () => {
  for (const effort of ['medium', 'high']) {
    const args = honestyConfig('honesty-base', OPTIONS).args({ effort });
    assert.deepEqual(args, honestyConfig('honesty-line', OPTIONS).args({ effort }), effort);
    assert.deepEqual(args, [...sharedArgs(effort), '--setting-sources', 'project', '--strict-mcp-config', '--disable-slash-commands']);
    assert.ok(!args.includes(''), 'the project source is named, so the empty list of the minimal arm is gone');
  }
});

test('the two honesty arms run under the same sandbox env as the minimal arm', () => {
  const context = { effort: 'medium', home: HOME, workspace: path.join(scratch, 'ws'), prepared: { engramPort: PORT } };
  for (const name of Object.keys(HONESTY_CONFIGS)) assert.deepEqual(honestyConfig(name, OPTIONS).env(context), minimalConfig(OPTIONS).env(context), name);
});

for (const name of ['honesty-base', 'honesty-line']) {
  test(`${name}'s prepare seeds its memory as CLAUDE.md in the workspace, and leaves the home bare`, async () => {
    const home = path.join(tmp('honesty'), 'home');
    const workspace = tmp('ws');
    const released = [];
    const config = honestyConfig(name, { ...OPTIONS, allocatePort: async () => 42301, releasePort: (port) => released.push(port) });
    const prepared = await config.prepare({ home, workspace, effort: 'medium', task: { id: 't' } });
    assert.deepEqual(prepared, { engramPort: 42301 });
    assert.equal(fs.readFileSync(path.join(workspace, 'CLAUDE.md'), 'utf8'), honestyMemory(name));
    assert.deepEqual(released, [], 'the port is kept for the trial');
    assert.deepEqual(fs.readdirSync(path.join(home, '.claude')), [], 'nothing was copied into the home');
  });
}

test('an honesty config keeps the transcripts of its trials, as the subagent configs do', () => {
  for (const name of Object.keys(HONESTY_CONFIGS)) {
    assert.deepEqual(Object.keys(honestyConfig(name, OPTIONS).transcripts), ['keep', 'summarize'], name);
  }
});

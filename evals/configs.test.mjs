import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  SANDBOX_ALLOWLIST, SANDBOX_SWITCHES, assertWorkRoot, currentConfig, defaultWorkRoot, ensureSandboxDirs, minimalConfig, prepareSandbox, sandboxEnv, sandboxPaths,
} from './configs.mjs';
import { childEnv, loadTask, runTrial } from './runner.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FAKE_AGENT = path.join(here, 'fixtures', 'fake-agent.mjs');
const SAMPLE = path.join(here, 'fixtures', 'tasks', 'sample');

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
    const overrides = sandboxEnv({ home: HOME, inherited, platform });
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
    const overrides = sandboxEnv({ home: HOME, inherited: {}, platform });
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
    assert.deepEqual(sortedKeys(overrides), [...pathNames, ...Object.keys(EXPECTED_SWITCHES)].sort(), 'nothing else is set');
  });

  test(`sandboxEnv (${platform}) through childEnv leaves exactly the allowlist, the paths and the switches, none of the real home`, () => {
    const inherited = fakeInherited(platform);
    const overrides = sandboxEnv({ home: HOME, inherited, platform });
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

test('current passes only the shared flags, and --effort is the one flag that varies', () => {
  const config = currentConfig(OPTIONS);
  assert.deepEqual(config.args({ effort: 'medium', home: HOME }), sharedArgs('medium'));
  assert.deepEqual(config.args({ effort: 'high', home: HOME }), sharedArgs('high'));
  const medium = config.args({ effort: 'medium' });
  const high = config.args({ effort: 'high' });
  assert.deepEqual(medium.filter((arg, index) => arg !== high[index]), ['medium']);
});

test('both configs run under the same sandbox env for the same home', () => {
  const context = { effort: 'medium', home: HOME, workspace: path.join(scratch, 'ws') };
  assert.deepEqual(minimalConfig(OPTIONS).env(context), currentConfig(OPTIONS).env(context));
  assert.deepEqual(minimalConfig(OPTIONS).env(context), sandboxEnv({ home: HOME }));
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
    seed: async (context) => calls.push({ ...context, claudeDirExisted: fs.existsSync(path.join(context.home, '.claude')) }),
  });
  await config.prepare({ home, workspace, effort: 'high', task: { id: 't' } });
  assert.deepEqual(calls, [{ home, workspace, claudeDirExisted: true }]);

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
  DISABLE_TELEMETRY: '0',
  CLAUDE_CODE_OAUTH_TOKEN: TOKEN,
};

/** Runs `repeats` trials of the sample task with the fake agent standing in for the binary of a config
 * built by `build`, under a process env full of things that must not reach it. Returns what the agent
 * reported for each trial (its env redacted by the fake agent itself) and the paths to inspect. */
async function runThroughFakeAgent(build, repeats = 1) {
  const reportDir = tmp('report');
  const workRoot = tmp('work');
  const runsDir = tmp('runs');
  const homes = [];
  const config = build();
  const wrapped = {
    ...config,
    args: (context) => [FAKE_AGENT, ...config.args(context)],
    versionArgs: [FAKE_AGENT, '--version'],
    env: (context) => ({ ...config.env(context), FAKE_AGENT_MODE: 'noop', FAKE_AGENT_REPORT: path.join(reportDir, `${path.basename(context.home)}.json`) }),
    prepare: async (context) => {
      homes.push(context.home);
      await config.prepare(context);
    },
  };
  const reportTexts = [];
  await withEnv(DIRTY_PROCESS_ENV, async () => {
    for (let repeat = 1; repeat <= repeats; repeat += 1) {
      const outcome = await runTrial({ task: loadTask(SAMPLE), config: wrapped, effort: 'high', repeat, readVersion: () => '1.0.0', workRoot, runsDir });
      assert.equal(outcome.status, 'recorded');
      reportTexts.push(fs.readFileSync(path.join(reportDir, `${path.basename(homes[repeat - 1])}.json`), 'utf8'));
    }
  });
  return { homes, reports: reportTexts.map((text) => JSON.parse(text)), reportTexts, runsDir, workRoot };
}

for (const [name, build] of BUILDERS) {
  test(`${name}: the child process receives the sandbox paths and switches, none of the real env, and a different home each trial`, async () => {
    const { homes, reports, workRoot } = await runThroughFakeAgent(() => build(OPTIONS), 2);
    assert.equal(homes.length, 2);
    assert.notEqual(homes[0], homes[1], 'a trial never reuses the previous home');
    const fold = (key) => (process.platform === 'win32' ? key.toLowerCase() : key);
    // Windows adds LOGONSERVER (a host name) to every process whatever its env block holds, and would add
    // the real HOMEDRIVE and HOMEPATH as well if `sandboxEnv` did not set them, which is why it does.
    const osAdded = process.platform === 'win32' ? ['LOGONSERVER'] : [];
    const allowed = new Set([...EXPECTED_ALLOWLIST, ...PATH_NAMES, ...(process.platform === 'win32' ? WINDOWS_PATH_NAMES : []), ...Object.keys(EXPECTED_SWITCHES), ...osAdded].map(fold));
    reports.forEach((report, index) => {
      const home = homes[index];
      // This is the predecessor's failure: switches and paths were declared but never reached the child.
      for (const [key, value] of nonNull(sandboxEnv({ home }))) {
        if (process.platform !== 'win32' && WINDOWS_PATH_NAMES.includes(key)) continue;
        assert.equal(report.env[key], value, `${key} as the child saw it`);
      }
      assert.equal(report.env.USERPROFILE, home);
      assert.equal(report.env.HOME, home);
      for (const key of SCRUBBED) assert.ok(!Object.keys(report.env).some((seen) => fold(seen) === fold(key)), `${key} reached the child`);
      const stray = Object.keys(report.env).filter((key) => !allowed.has(fold(key)) && !key.startsWith('FAKE_AGENT_'));
      assert.deepEqual(stray, [], 'only the allowlist, the paths and the switches');
      assert.deepEqual(report.argv, name === 'minimal' ? [...sharedArgs('high'), ...MINIMAL_ONLY] : sharedArgs('high'), 'the argv as the child saw it');
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

// ---- the shared preparation: a git identity and the fixture as the first commit ---------------------

/** Runs git in `cwd` under the env a trial's agent would get, so what it prints is what the agent would see. */
function gitUnderSandbox(home, cwd, ...args) {
  const result = spawnSync('git', args, { cwd, env: childEnv(sandboxEnv({ home })), encoding: 'utf8', windowsHide: true });
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
    prepareSandbox({ home, workspace, env });
    assert.equal(gitUnderSandbox(home, workspace, 'log', '--format=%s'), 'fixture', 'the commit was made');
  }
});

test('the agent keeps the system git config: GIT_CONFIG_NOSYSTEM is set for the fixture commit only, never in the sandbox env', () => {
  assert.ok(!SANDBOX_ALLOWLIST.includes('GIT_CONFIG_NOSYSTEM'));
  // What the agent gets is the effective child env, so that is what is asserted: `sandboxEnv` lists an
  // inherited name it removes as a `null` key, so a key check would fail whenever the shell exports the
  // variable, and say nothing about the child either way.
  for (const inherited of [{ PATH: '/bin' }, { PATH: '/bin', GIT_CONFIG_NOSYSTEM: '1' }, { PATH: '/bin', git_config_nosystem: '1' }]) {
    for (const platform of ['win32', 'linux']) {
      const child = childEnv(sandboxEnv({ home: HOME, inherited, platform }), inherited, platform);
      assert.deepEqual(Object.keys(child).filter((name) => name.toLowerCase() === 'git_config_nosystem'), [], `${platform} with ${JSON.stringify(inherited)}`);
    }
  }
  const exported = { PATH: '/bin', GIT_CONFIG_NOSYSTEM: '1' };
  assert.equal(sandboxEnv({ home: HOME, inherited: exported, platform: 'linux' }).GIT_CONFIG_NOSYSTEM, null, 'an inherited one is a removal, which a key check mistakes for a setting');
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

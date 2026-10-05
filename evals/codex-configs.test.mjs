import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCodexOutput } from './agent-output.mjs';
import { CODEX_ALLOWLIST, CODEX_SWITCHES, assertAgentCommand, codexCurrentConfig, codexMinimalConfig, codexSandboxEnv } from './codex-configs.mjs';
import { buildCodexTemplate, seedFromCodexTemplate } from './codex-home.mjs';
import { SANDBOX_SWITCHES, sandboxEnv } from './configs.mjs';
import { REAL_ENGRAM_PORT } from './ports.mjs';
import { loadTask, runTrial } from './runner.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FAKE_AGENT = path.join(here, 'fixtures', 'fake-agent.mjs');
const SAMPLE = path.join(here, 'fixtures', 'tasks', 'sample');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-codex-configs-test-'));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));
let counter = 0;
const tmp = (name) => {
  const dir = path.join(scratch, `${name}-${counter++}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

// The allowlist, the path variables and the switches are a security boundary, so the tests hold their own
// copy of each (as `configs.test.mjs` does): a name added to the module by accident fails here.
const EXPECTED_ALLOWLIST = [
  'PATH', 'PATHEXT', 'SystemRoot', 'SystemDrive', 'windir', 'ComSpec', 'ProgramData', 'ProgramFiles', 'ProgramFiles(x86)', 'ProgramW6432',
  'CommonProgramFiles', 'CommonProgramFiles(x86)', 'CommonProgramW6432', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE', 'OS', 'COMPUTERNAME',
  'USERNAME', 'USERDOMAIN', 'LANG', 'LC_ALL', 'TZ', 'TERM', 'SHELL', 'USER', 'LOGNAME',
];
const PATH_NAMES = [
  'USERPROFILE', 'HOME', 'CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME',
  'XDG_CACHE_HOME', 'ENGRAM_DATA_DIR', 'JS_HARNESS_HOME', 'npm_config_cache',
];
const WINDOWS_PATH_NAMES = ['HOMEDRIVE', 'HOMEPATH'];
const EXPECTED_SWITCHES = { DO_NOT_TRACK: '1', GENTLE_AI_TELEMETRY: '0', CODEGRAPH_TELEMETRY: '0' };
const CREDENTIAL_NAME = /TOKEN|KEY|SECRET|PASSWORD|AUTH/i;

const REAL_HOME = path.join(path.parse(scratch).root, 'Users', 'real-person-sentinel');
const HOME = path.join(scratch, 'sandbox-home');
const PORT = 41234;
const LOGIN = '{"auth_mode":"chatgpt","tokens":{"id_token":"SENTINEL-DUMMY-LOGIN"}}\n';
// What a developer's real shell may hold: the other host's credential and switches, a Codex session's own
// variables, an API key, and the real home in everything that names one.
const DIRTY = {
  CLAUDE_CODE_OAUTH_TOKEN: 'sekrit-claude-token-0123456789',
  OPENAI_API_KEY: 'sekrit-openai-key-0123456789',
  CODEX_HOME: path.join(REAL_HOME, '.codex'),
  CODEX_THREAD_ID: 'a-live-codex-session',
  CODEX_MANAGED_BY_PNPM: '1',
  ENGRAM_DATA_DIR: path.join(REAL_HOME, '.engram'),
  ENGRAM_PORT: String(REAL_ENGRAM_PORT),
  ENGRAM_URL: `http://127.0.0.1:${REAL_ENGRAM_PORT}`,
  DISABLE_AUTOUPDATER: 'real-value',
  CLAUDE_CODE_DISABLE_AUTO_MEMORY: 'real-value',
};

// ---- the env ---------------------------------------------------------------------------------------

test('the Codex allowlist is the sandbox one without the Claude credential: a Codex login is a file, so no credential rides the env', () => {
  assert.deepEqual(CODEX_ALLOWLIST, EXPECTED_ALLOWLIST);
  assert.deepEqual(CODEX_ALLOWLIST.filter((name) => CREDENTIAL_NAME.test(name)), []);
  assert.deepEqual(CODEX_SWITCHES, EXPECTED_SWITCHES);
});

for (const platform of ['win32', 'linux']) {
  test(`codexSandboxEnv (${platform}) is the sandbox env with CODEX_HOME in the trial home, no credential, and only the switches Codex's stack reads`, () => {
    const inherited = { ...Object.fromEntries(EXPECTED_ALLOWLIST.map((name) => [name, `value-of-${name}`])), ...DIRTY, STRAY: 'x' };
    const env = codexSandboxEnv({ home: HOME, engramPort: PORT, inherited, platform });
    const set = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== null));
    assert.deepEqual(Object.keys(set).sort(), [...PATH_NAMES, 'ENGRAM_PORT', ...(platform === 'win32' ? WINDOWS_PATH_NAMES : []), ...Object.keys(EXPECTED_SWITCHES)].sort());
    assert.equal(set.CODEX_HOME, path.join(HOME, '.codex'));
    assert.equal(set.ENGRAM_PORT, String(PORT));
    for (const [name, value] of Object.entries(EXPECTED_SWITCHES)) assert.equal(set[name], value);
    // Everything else the sandbox env sets is kept as it is: one sandbox, two hosts.
    const claude = sandboxEnv({ home: HOME, engramPort: PORT, inherited, platform });
    for (const name of PATH_NAMES.filter((key) => key !== 'CODEX_HOME')) assert.equal(set[name], claude[name], name);
    // Removed: the other host's credential and switches, a live Codex session's variables, any key.
    for (const name of ['CLAUDE_CODE_OAUTH_TOKEN', 'OPENAI_API_KEY', 'CODEX_THREAD_ID', 'CODEX_MANAGED_BY_PNPM', 'ENGRAM_URL', 'DISABLE_AUTOUPDATER', 'CLAUDE_CODE_DISABLE_AUTO_MEMORY', 'STRAY']) {
      assert.equal(env[name], null, `${name} must be removed`);
    }
    for (const name of Object.keys(SANDBOX_SWITCHES).filter((key) => !(key in EXPECTED_SWITCHES))) assert.ok(!(name in set), `${name} is a switch only Claude Code reads`);
    assert.deepEqual(Object.keys(set).filter((name) => CREDENTIAL_NAME.test(name)), []);
  });
}

test('codexSandboxEnv needs the trial\'s engram port and never falls back to the real one', () => {
  assert.throws(() => codexSandboxEnv({ home: HOME }), /engram port/);
  assert.throws(() => codexSandboxEnv({ home: HOME, engramPort: REAL_ENGRAM_PORT }), /7437/);
  assert.throws(() => codexSandboxEnv({ home: 'relative', engramPort: PORT }), /absolute/);
});

// ---- the command and the argv ----------------------------------------------------------------------

const AUTH_FILE = path.join(tmp('login'), '.codex', 'auth.json');
write(AUTH_FILE, LOGIN);
const OPTIONS = { command: process.execPath, model: 'test-model', authFile: AUTH_FILE };
// The name holds "auth" on purpose: what must never be an argument is the login's own path, not a word.
const WORKSPACE = path.join(scratch, 'an authors workspace');
const shared = (effort, workspace = WORKSPACE) => [
  'exec', '--json', '--ephemeral', '--skip-git-repo-check', '-m', 'test-model', '-c', `model_reasoning_effort="${effort}"`, '--dangerously-bypass-approvals-and-sandbox', '-C', workspace,
];
const MINIMAL_ONLY = ['--ignore-user-config', '--ignore-rules'];
const CURRENT_ONLY = ['--dangerously-bypass-hook-trust'];
// Shims at a path that is absolute on whichever host runs the tests. A drive-letter path is relative on
// POSIX, where the absolute-path check answers first and the shim check under test is never reached.
const SHIMS = ['codex.cmd', 'codex.BAT', 'codex.ps1'].map((name) => path.join(path.parse(process.execPath).root, 'pnpm', 'bin', name));
const BUILDERS = [['minimal', codexMinimalConfig, MINIMAL_ONLY], ['current', codexCurrentConfig, CURRENT_ONLY]];

for (const [name, build, only] of BUILDERS) {
  test(`${name}: the argv is codex exec with the shared flags, then this arm's own, and only the effort and the workspace vary`, () => {
    const config = build(OPTIONS);
    assert.equal(config.name, name);
    assert.equal(config.command, process.execPath);
    assert.equal(config.reader, readCodexOutput, 'the output is read as codex exec --json prints it');
    assert.deepEqual(config.versionArgs, ['--version']);
    for (const effort of ['medium', 'high']) assert.deepEqual(config.args({ effort, workspace: WORKSPACE, home: HOME }), [...shared(effort), ...only]);
    const named = [AUTH_FILE, path.dirname(AUTH_FILE), HOME];
    assert.ok(!config.args({ effort: 'high', workspace: WORKSPACE, home: HOME }).some((arg) => named.some((place) => arg.includes(place))), 'neither the login, its directory nor the home is ever an argument');
  });

  test(`${name}: leading arguments (a launcher script) come before everything, in the version probe too`, () => {
    const config = build({ ...OPTIONS, commandArgs: ['C:\\launcher\\codex.js'] });
    assert.deepEqual(config.args({ effort: 'high', workspace: WORKSPACE }), ['C:\\launcher\\codex.js', ...shared('high'), ...only]);
    assert.deepEqual(config.versionArgs, ['C:\\launcher\\codex.js', '--version']);
  });

  test(`${name} refuses to build without a real command, a model or a login file, and to run without a usable effort`, () => {
    assert.throws(() => build({ model: 'm', authFile: AUTH_FILE }), /command/);
    assert.throws(() => build({ ...OPTIONS, command: 'codex' }), /absolute/);
    assert.throws(() => build({ ...OPTIONS, command: SHIMS[0] }), /shim/);
    assert.throws(() => build({ ...OPTIONS, commandArgs: 'codex.js' }), /commandArgs/);
    assert.throws(() => build({ ...OPTIONS, model: '' }), /model/);
    assert.throws(() => build({ command: process.execPath, model: 'm' }), /authFile/);
    assert.throws(() => build({ ...OPTIONS, authFile: 'auth.json' }), /absolute/);
    assert.throws(() => build(), /command/);
    const config = build(OPTIONS);
    assert.throws(() => config.args({ workspace: WORKSPACE }), /effort/);
    assert.throws(() => config.args({ effort: 'hi"gh', workspace: WORKSPACE }), /effort/, 'the effort goes inside a quoted config value');
    assert.throws(() => config.args({ effort: 'high' }), /workspace/);
  });
}

test('assertAgentCommand takes an absolute path to a binary and refuses a shim, which cannot be spawned without a shell', () => {
  assert.doesNotThrow(() => assertAgentCommand(process.execPath));
  for (const shim of SHIMS) {
    assert.ok(path.isAbsolute(shim), `${shim} would be refused for being relative, before the shim check`);
    assert.throws(() => assertAgentCommand(shim, '--codex'), /--codex .*shim/);
  }
  assert.throws(() => assertAgentCommand('codex', '--codex'), /--codex must be an absolute path/);
  assert.throws(() => assertAgentCommand(undefined, '--codex'), /--codex is required/);
});

test('minimal does not take a seed: its home holds the login and nothing of a setup', async () => {
  let seeded = false;
  const config = codexMinimalConfig({ ...OPTIONS, seed: () => { seeded = true; }, killPort: () => ({ killed: [] }) });
  const home = path.join(tmp('trial'), 'home');
  const workspace = tmp('workspace');
  const prepared = await config.prepare({ home, workspace });
  assert.equal(seeded, false);
  assert.deepEqual(fs.readdirSync(path.join(home, '.codex')), ['auth.json']);
  await config.cleanup({ home, workspace, prepared });
});

// ---- prepare and cleanup: the login ----------------------------------------------------------------

/** Port functions that touch no real port or process, and say what they were asked. */
function fakePorts(port = PORT) {
  const calls = { released: [], killed: [] };
  return { calls, allocatePort: async () => port, releasePort: (value) => calls.released.push(value), killPort: (value) => (calls.killed.push(value), { killed: [] }) };
}

test('the login goes in last: a seed that fails leaves a home that never held it, and gives the port back', async () => {
  const { calls, ...ports } = fakePorts();
  const config = codexCurrentConfig({ ...OPTIONS, ...ports, seed: async () => { throw new Error('seed broke'); } });
  const home = path.join(tmp('trial'), 'home');
  await assert.rejects(config.prepare({ home, workspace: tmp('workspace') }), /seed broke/);
  assert.ok(!fs.existsSync(path.join(home, '.codex', 'auth.json')));
  assert.deepEqual(calls.released, [PORT]);
});

test('a missing login stops the trial before the agent starts, with an error that names `codex login`', async () => {
  const authFile = path.join(tmp('no-login'), '.codex', 'auth.json');
  const { calls, ...ports } = fakePorts();
  const workRoot = tmp('work');
  for (const [, build] of BUILDERS) {
    const config = build({ ...OPTIONS, ...ports, authFile, commandArgs: [FAKE_AGENT] });
    await assert.rejects(runTrial({ task: loadTask(SAMPLE), config, effort: 'high', repeat: 1, readVersion: () => '1.0.0', workRoot, runsDir: tmp('runs') }), /no Codex login at .*run `codex login`/);
  }
  assert.deepEqual(fs.readdirSync(workRoot), [], 'the home and the workspace are removed all the same');
  assert.deepEqual(calls.released, [PORT, PORT], 'and the port is given back');
});

/** A prepared trial of the minimal arm on fake ports: its config, the context `cleanup` takes, where its
 * login is, and what the port functions were asked. `overrides` replaces port functions. */
async function preparedTrial(overrides = {}) {
  const { calls, ...ports } = fakePorts();
  const config = codexMinimalConfig({ ...OPTIONS, ...ports, ...overrides });
  const context = { home: path.join(tmp('trial'), 'home'), workspace: tmp('workspace') };
  context.prepared = await config.prepare(context);
  const login = path.join(context.home, '.codex', 'auth.json');
  assert.equal(fs.readFileSync(login, 'utf8'), LOGIN);
  return { config, context, login, calls };
}

test('cleanup deletes the copy of the login itself, so a home that cannot be removed does not keep a credential', async () => {
  const { config, context, login, calls } = await preparedTrial();
  await config.cleanup(context);
  assert.ok(!fs.existsSync(login), 'the copy is gone');
  assert.ok(fs.existsSync(context.home), 'though the home itself is the runner\'s to remove');
  assert.deepEqual(calls, { released: [PORT], killed: [PORT] });
  assert.equal(fs.readFileSync(AUTH_FILE, 'utf8'), LOGIN, 'and the real login is where it was');
});

test('a port that cannot be cleared fails the cleanup, after the login is deleted and the port given back', async () => {
  const { config, context, login, calls } = await preparedTrial({ killPort: () => { throw new Error('kill failed'); } });
  await assert.rejects(config.cleanup(context), /kill failed/, 'the runner logs a cleanup that fails: it must hear of this one');
  assert.ok(!fs.existsSync(login), 'the copy is gone');
  assert.deepEqual(calls.released, [PORT]);
});

test('a login that cannot be deleted fails the cleanup, and the port is still cleared and given back', async () => {
  const { config, context, login, calls } = await preparedTrial();
  // A directory with something in it where the file was: `rmSync` without `recursive` refuses it.
  fs.rmSync(login);
  fs.mkdirSync(path.join(login, 'held'), { recursive: true });
  await assert.rejects(config.cleanup(context), (err) => err.code === 'ERR_FS_EISDIR' || /directory/i.test(err.message));
  assert.deepEqual(calls, { released: [PORT], killed: [PORT] }, 'the sandbox cleanup ran all the same');
});

// ---- end to end: what the agent actually received --------------------------------------------------

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

/** Every file below `root`, path to its sha256: two equal maps are byte-identical trees. */
function hashTree(root) {
  const tree = new Map();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else tree.set(path.relative(root, full).split(path.sep).join('/'), crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex'));
    }
  };
  walk(root);
  return tree;
}

/** A small fake real home, built here and never the machine's own: a login, a config that names its own
 * `.codex` and an engram server, a hook, one plugin, and state that must stay behind. */
function makeRealHome() {
  const home = path.join(tmp('real'), 'person');
  const codex = path.join(home, '.codex');
  write(path.join(codex, 'auth.json'), LOGIN);
  write(path.join(codex, 'config.toml'), [`model_instructions_file = '${path.join(codex, 'engram-instructions.md')}'`, '', '[mcp_servers.engram]', 'command = "engram"', ''].join('\n'));
  write(path.join(codex, 'engram-instructions.md'), 'memory protocol\n');
  write(path.join(codex, 'AGENTS.md'), '# global instructions\n');
  write(path.join(codex, 'hooks.json'), '{"hooks":{}}\n');
  write(path.join(codex, 'plugins', 'cache', 'mk', 'demo', '1.0.0', 'plugin.json'), '{"name":"demo"}\n');
  write(path.join(codex, 'state_5.sqlite'), 'state\n');
  write(path.join(codex, 'sessions', 'rollout.jsonl'), 'a session\n');
  return home;
}

/** Runs one trial of the sample task with the fake agent standing in for the Codex binary of `config`,
 * under a process env full of things that must not reach it. Returns the trial's outcome, what the agent
 * reported (its env redacted by the fake agent itself), and what `CODEX_HOME` held when it started. */
async function trialWithFakeAgent(config, { mode = 'codex-solve', readFile = 'auth.json' } = {}) {
  const reportFile = path.join(tmp('report'), 'report.json');
  const workRoot = tmp('work');
  const runsDir = tmp('runs');
  const seen = {};
  const wrapped = {
    ...config,
    env: (context) => ({ ...config.env(context), FAKE_AGENT_MODE: mode, FAKE_AGENT_REPORT: reportFile, FAKE_AGENT_READ_FILE: path.join(context.home, '.codex', readFile) }),
    prepare: async (context) => {
      const prepared = await config.prepare(context);
      seen.home = context.home;
      seen.port = prepared.engramPort;
      seen.codexHome = fs.readdirSync(path.join(context.home, '.codex')).sort();
      return prepared;
    },
  };
  const outcome = await withEnv(DIRTY, () => runTrial({ task: loadTask(SAMPLE), config: wrapped, effort: 'high', repeat: 1, workRoot, runsDir }));
  return { outcome, report: JSON.parse(fs.readFileSync(reportFile, 'utf8')), workRoot, runsDir, ...seen };
}

const fold = (key) => (process.platform === 'win32' ? key.toLowerCase() : key);
/** Asserts the env the agent reported is the sandbox's and nothing else: no real home, no credential. */
function assertSandboxed(report, home) {
  assert.equal(report.env.CODEX_HOME, path.join(home, '.codex'), 'CODEX_HOME is inside the trial home');
  assert.equal(report.env.HOME, home);
  assert.equal(report.env.USERPROFILE, home);
  for (const [name, value] of Object.entries(EXPECTED_SWITCHES)) assert.equal(report.env[name], value);
  assert.notEqual(report.env.ENGRAM_PORT, String(REAL_ENGRAM_PORT));
  // Windows adds LOGONSERVER to every process whatever its env block holds (see `configs.test.mjs`).
  const allowed = new Set([...EXPECTED_ALLOWLIST, ...PATH_NAMES, 'ENGRAM_PORT', ...WINDOWS_PATH_NAMES, ...Object.keys(EXPECTED_SWITCHES), 'LOGONSERVER'].map(fold));
  assert.deepEqual(Object.keys(report.env).filter((key) => !allowed.has(fold(key)) && !key.startsWith('FAKE_AGENT_')), [], 'only the allowlist, the paths and the switches');
  assert.deepEqual(Object.keys(report.env).filter((key) => CREDENTIAL_NAME.test(key)), [], 'no credential variable of either host');
  assert.ok(!JSON.stringify(report.env).includes(REAL_HOME), 'nothing names the real home');
}

test('minimal, end to end: the agent runs in a CODEX_HOME of the trial\'s own that holds a copy of the login and nothing else', async () => {
  const realHome = makeRealHome();
  const before = hashTree(realHome);
  const config = codexMinimalConfig({ ...OPTIONS, authFile: path.join(realHome, '.codex', 'auth.json'), commandArgs: [FAKE_AGENT], killPort: () => ({ killed: [] }) });
  const { outcome, report, home, codexHome, workRoot, runsDir } = await trialWithFakeAgent(config);

  assert.equal(outcome.status, 'recorded');
  assert.equal(outcome.record.config, 'minimal');
  assert.equal(outcome.record.score, 1, 'the fake agent solved the task');
  assert.equal(outcome.record.inputTokens, 1000, 'the JSONL of codex exec was read by the Codex reader');
  assert.equal(outcome.record.cliVersion, '9.9.9 (Fake Agent)', 'the version probe ran the same command');
  assert.deepEqual(codexHome, ['auth.json'], 'the minimal home holds only the login');
  assert.equal(report.fileRead, LOGIN, 'and the agent could read it there');
  assert.deepEqual(report.argv, [...shared('high', report.cwd), ...MINIMAL_ONLY], 'the argv as the child saw it, quotes included');
  assert.ok(report.cwd.startsWith(workRoot) && report.cwd !== home);
  assert.equal(report.prompt, loadTask(SAMPLE).prompt, 'the prompt arrives on stdin');
  assertSandboxed(report, home);

  assert.deepEqual(hashTree(realHome), before, 'the real home is byte-identical after the trial');
  assert.deepEqual(fs.readdirSync(workRoot), [], 'the trial home, and the login in it, are gone');
  for (const file of fs.readdirSync(runsDir)) assert.ok(!fs.readFileSync(path.join(runsDir, file), 'utf8').includes('SENTINEL-DUMMY-LOGIN'), `${file} holds the login`);
});

test('current, end to end: the agent runs in a copy of the real setup with its paths, its engram port and its login in the trial home', async () => {
  const realHome = makeRealHome();
  const templateDir = path.join(tmp('template'), 'tpl');
  buildCodexTemplate({ realHome, templateDir });
  const before = { real: hashTree(realHome), template: hashTree(templateDir) };
  const inits = [];
  const runInit = (call) => (inits.push(call), { status: 0, stdout: '', stderr: '' });
  const config = codexCurrentConfig({
    ...OPTIONS, authFile: path.join(realHome, '.codex', 'auth.json'), commandArgs: [FAKE_AGENT], killPort: () => ({ killed: [] }), seed: seedFromCodexTemplate(templateDir, { runInit }),
  });
  const { outcome, report, home, port, codexHome, workRoot } = await trialWithFakeAgent(config, { readFile: 'config.toml' });

  assert.equal(outcome.status, 'recorded');
  assert.equal(outcome.record.config, 'current');
  assert.deepEqual(codexHome, ['AGENTS.md', 'auth.json', 'config.toml', 'engram-instructions.md', 'hooks.json', 'plugins'], 'the copy list and the login; no state, no session');
  assert.deepEqual(report.argv, [...shared('high', report.cwd), ...CURRENT_ONLY]);
  assertSandboxed(report, home);
  // The config the agent read: its own home in the path, its own port and store for engram.
  assert.ok(report.fileRead.includes(`model_instructions_file = '${path.join(home, '.codex', 'engram-instructions.md')}'`), report.fileRead);
  assert.ok(report.fileRead.includes(`ENGRAM_PORT = "${port}"`) && report.env.ENGRAM_PORT === String(port), 'one port, in the env and in the MCP server\'s own');
  assert.ok(report.fileRead.includes(`ENGRAM_DATA_DIR = ${JSON.stringify(path.join(home, '.engram'))}`));
  assert.ok(!report.fileRead.includes(realHome));
  assert.deepEqual(inits.map((call) => call.workspace), [report.cwd], 'js-harness init ran in the workspace, once');
  assert.equal(inits[0].env.CODEX_HOME, path.join(home, '.codex'));

  assert.deepEqual(hashTree(realHome), before.real, 'the real home is byte-identical after the trial');
  assert.deepEqual(hashTree(templateDir), before.template, 'and so is the template: the login never entered it');
  assert.ok(![...before.template.keys()].some((rel) => rel.endsWith('auth.json')));
  assert.deepEqual(fs.readdirSync(workRoot), []);
});

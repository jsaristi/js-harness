import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { codexSandboxEnv } from './codex-configs.mjs';
import { assertWorkRoot } from './configs.mjs';
import { defaultTrees, snapshotTrees } from './isolation-probe.mjs';
import { REAL_ENGRAM_PORT } from './ports.mjs';
import { PROBE_WORD, attributeEngram, codexTrees, formatSummary, inspectEnv, main, probeEnvNames, probePrompt, runCodexIsolationProbe } from './codex-isolation-probe.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FAKE_AGENT = path.join(here, 'fixtures', 'fake-agent.mjs');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-codex-isoprobe-test-'));
after(() => fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
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

const FAKE_NONCE = '0123456789abcdef0123456789abcdef';
const HOUR = 3_600_000;
const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
/** The text of a made-up login whose access token, in the shape of a JWT (`header.payload.signature`), expires
 * `hoursLeft` hours from now. The sentinel is in every token of it: no output of a run may hold it. */
const loginExpiringIn = (hoursLeft) => {
  const accessToken = `${base64url({ alg: 'none' })}.${base64url({ sub: 'SENTINEL-DUMMY-LOGIN', exp: Math.floor((Date.now() + hoursLeft * HOUR) / 1000) })}.SENTINEL-DUMMY-LOGIN-SIGNATURE`;
  return `${JSON.stringify({ auth_mode: 'chatgpt', tokens: { id_token: 'SENTINEL-DUMMY-LOGIN', access_token: accessToken } })}\n`;
};
/** What no output may hold of the login text `login`: the sentinel, and each part of its access token. */
const loginSecrets = (login) => ['SENTINEL-DUMMY-LOGIN', ...JSON.parse(login).tokens.access_token.split('.')];
const SANDBOX_NAME = /js-harness-codex-iso-/;

// ---- a fake machine --------------------------------------------------------------------------------
// No test runs the real Codex or reads the machine's own `~/.codex`, `~/.engram` or `~/.gentle-ai`: the
// "real" home below is built in the scratch directory and every path the probe watches is handed to it.

/** A home holding every tree the probe watches, with a login written `loginAgeHours` ago whose access token
 * has `loginHoursLeft` hours left (or whose text is `login`); the folders LOCALAPPDATA, APPDATA and TEMP would
 * be; a work root that does not exist yet; and the file the fake agent appends a line to each time it runs. */
function fakeMachine({ loginAgeHours = 1, loginHoursLeft = 48, login = loginExpiringIn(loginHoursLeft) } = {}) {
  const base = tmp('machine');
  const realHome = path.join(base, 'person');
  const localAppData = path.join(realHome, 'AppData', 'Local');
  const appData = path.join(realHome, 'AppData', 'Roaming');
  const tempDir = path.join(base, 'temp');
  const codex = path.join(realHome, '.codex');
  const authFile = path.join(codex, 'auth.json');
  write(authFile, login);
  const written = new Date(Date.now() - loginAgeHours * HOUR);
  fs.utimesSync(authFile, written, written);
  write(path.join(codex, 'config.toml'), ['model = "some-model"', '', '[mcp_servers.engram]', 'command = "engram"', ''].join('\n'));
  write(path.join(codex, 'AGENTS.md'), '# global instructions\n');
  write(path.join(codex, 'hooks.json'), '{"hooks":{}}\n');
  write(path.join(codex, 'skills', 'demo', 'SKILL.md'), '# demo\n');
  write(path.join(codex, 'plugins', 'cache', 'mk', 'demo', '1.0.0', 'plugin.json'), '{"name":"demo"}\n');
  write(path.join(codex, 'plugins', '.plugin-appserver', 'codex.exe'), 'a binary of the desktop app');
  write(path.join(codex, 'packages', 'app-server-daemon', 'releases', '1.0.0', 'bin', 'codex.exe'), 'another, of its daemon');
  write(path.join(codex, 'state_5.sqlite'), 'state');
  write(path.join(codex, 'sessions', 'rollout.jsonl'), 'a session\n');
  write(path.join(realHome, '.claude', 'settings.json'), '{}\n');
  write(path.join(realHome, '.engram', 'engram.db'), 'real memories');
  write(path.join(realHome, '.gentle-ai', 'state.json'), '{"rdd_mode":"on"}\n');
  write(path.join(realHome, '.cache', 'codex-runtimes', 'r.bin'), 'runtime');
  write(path.join(localAppData, 'Codex', 'log.txt'), 'log');
  write(path.join(localAppData, 'OpenAI', 'app.log'), 'log');
  write(path.join(localAppData, 'engram', 'bin', 'engram.exe'), 'a binary');
  write(path.join(appData, 'Codex', 'Preferences'), '{}');
  write(path.join(tempDir, 'claude', 'scratch.txt'), 'scratch');
  return { realHome, localAppData, appData, tempDir, authFile, login, workRoot: path.join(base, 'work'), countFile: path.join(base, 'runs.txt'), seenDir: path.join(base, 'seen') };
}

/** `assertWorkRoot` as the probe runs it, searching only the scratch directory for project memory: the
 * scratch directory is under this machine's temp folder, inside the real home, whose own `.claude` the real
 * check rightly finds above it. */
const scratchOnly = (target) => {
  const relative = path.relative(scratch, target);
  return !relative.startsWith('..') && !path.isAbsolute(relative) && fs.lstatSync(target, { throwIfNoEntry: false }) !== undefined;
};
const checkInScratch = (root, { realHome }) => assertWorkRoot(root, { realHome, exists: scratchOnly });
const noInit = async () => ({ status: 0, stdout: '', stderr: '' });

/** The fake agent's own settings, added to the env the config builds: the config's command, arguments,
 * sandbox, `prepare` and `cleanup` stay as a measured trial has them. `acts` is a list or a function of the
 * arm, and `shellEnv` what its shell reports for a variable in place of the truth (`<HOME>` is the trial's
 * home). What each run saw (argv, prompt) goes to `<seenDir>/<arm>.json`. */
const fakeCodex = (machine, { mode = 'codex-probe', acts = '', shellEnv = {} } = {}) => (config, { arm }) => {
  fs.mkdirSync(machine.seenDir, { recursive: true });
  return {
    ...config,
    env: (context) => ({
      ...config.env(context),
      FAKE_AGENT_MODE: mode,
      FAKE_AGENT_PROBE_ACTS: typeof acts === 'function' ? acts(arm) : acts,
      FAKE_AGENT_PROBE_ENV: JSON.stringify(shellEnv),
      FAKE_AGENT_REAL_HOME: machine.realHome,
      FAKE_AGENT_COUNT_FILE: machine.countFile,
      FAKE_AGENT_REPORT: path.join(machine.seenDir, `${arm}.json`),
    }),
  };
};

/** What every run of the probe on a fake machine is handed: the fake agent behind `node`, the machine's
 * paths, and stand-ins for what costs a second each and has its own tests (the sweep by path, the kill by
 * port, the listing of engram processes). */
const overridesFor = (machine, { mode, acts, shellEnv, ...extra } = {}) => ({
  commandArgs: [FAKE_AGENT],
  nonce: FAKE_NONCE,
  realHome: machine.realHome,
  localAppData: machine.localAppData,
  appData: machine.appData,
  tempDir: machine.tempDir,
  workRoot: machine.workRoot,
  checkWorkRoot: checkInScratch,
  runInit: noInit,
  adaptConfig: fakeCodex(machine, { mode, acts, shellEnv }),
  sweep: () => ({ killed: [] }),
  killPort: () => ({ killed: [] }),
  listEngram: () => [],
  ...extra,
});
const probe = (machine, options = {}) => runCodexIsolationProbe({ codex: process.execPath, readVersion: () => '0.0.0 (not probed)', log: () => {}, timeoutMs: 60_000, ...overridesFor(machine, options) });

const runsOf = (machine) => (fs.existsSync(machine.countFile) ? fs.readFileSync(machine.countFile, 'utf8').trim().split('\n') : []);
const seenBy = (machine, arm) => JSON.parse(fs.readFileSync(path.join(machine.seenDir, `${arm}.json`), 'utf8'));
/** Every file below `root` as `path sha256:size`, sorted: two equal lists are byte-identical trees. */
const bytesOf = async (root) => [...(await snapshotTrees([{ name: 'home', root, mode: 'content' }])).trees.home.files].map((entry) => entry.join(' ')).sort();
function capture() {
  const out = { stdout: '', stderr: '' };
  return { out, stdout: { write: (text) => { out.stdout += text; } }, stderr: { write: (text) => { out.stderr += text; } } };
}

// ---- the trees -------------------------------------------------------------------------------------

test('codexTrees is every tree of the Claude probe, then where Codex, its desktop app and engram keep state', () => {
  const machine = fakeMachine();
  const trees = codexTrees(machine);
  const claude = defaultTrees(machine);
  assert.deepEqual(trees.slice(0, claude.length), claude, 'a superset: the Claude trees come first, as they are');
  const local = (name) => path.join(machine.localAppData, name);
  assert.deepEqual(trees.slice(claude.length).map(({ name, root, mode }) => ({ name, root, mode })), [
    { name: '.codex', root: path.join(machine.realHome, '.codex'), mode: 'content' },
    { name: 'AppData/Local/Codex', root: local('Codex'), mode: 'content' },
    { name: 'AppData/Local/OpenAI', root: local('OpenAI'), mode: 'content' },
    { name: 'AppData/Local/engram', root: local('engram'), mode: 'content' },
    { name: 'AppData/Roaming/Codex', root: path.join(machine.appData, 'Codex'), mode: 'content' },
    { name: '.cache', root: path.join(machine.realHome, '.cache'), mode: 'stat' },
    { name: 'AppData/Roaming (top level)', root: machine.appData, mode: 'names' },
    { name: '%TEMP% (top level)', root: machine.tempDir, mode: 'names' },
  ]);
  const codex = trees.find((tree) => tree.name === '.codex');
  assert.deepEqual(codex.statOnly, ['auth.json', 'plugins/.plugin-appserver/codex.exe', 'packages/app-server-daemon/releases/1.0.0/bin/codex.exe'], 'the login, and the desktop app binaries, are never opened');
  assert.deepEqual(codexTrees({ ...machine, statOnlyDirs: [] }).find((tree) => tree.name === '.codex').statOnly, ['auth.json'], 'the login is not the caller\'s to open');
});

test('a snapshot of the trees never opens the login, and still sees it change by its size and date', async () => {
  const machine = fakeMachine();
  const opened = [];
  const openRead = (file, { chunkSize }) => {
    opened.push(path.relative(machine.realHome, file).split(path.sep).join('/'));
    return fs.createReadStream(file, { highWaterMark: chunkSize });
  };
  const needles = [{ label: 'login', values: ['SENTINEL-DUMMY-LOGIN'] }];
  const before = await snapshotTrees(codexTrees(machine), { openRead, needles });
  assert.ok(opened.includes('.codex/config.toml') && opened.includes('AppData/Local/OpenAI/app.log') && opened.includes('AppData/Roaming/Codex/Preferences'));
  assert.deepEqual(opened.filter((file) => /auth\.json|plugin-appserver|app-server-daemon/.test(file)), []);
  assert.match(before.trees['.codex'].files.get('auth.json'), /^stat:\d+:/);
  assert.deepEqual(Object.values(before.trees).flatMap((tree) => tree.hits), [], 'a file that is not read holds no needle');
  assert.equal(before.trees['.cache'].files.get('codex-runtimes/r.bin').startsWith('stat:'), true);
  assert.ok(before.trees['AppData/Roaming (top level)'].files.has('Codex'));
  fs.appendFileSync(machine.authFile, ' ');
  const afterwards = await snapshotTrees(codexTrees(machine), { openRead });
  assert.notEqual(afterwards.trees['.codex'].files.get('auth.json'), before.trees['.codex'].files.get('auth.json'));
});

// ---- the prompt ------------------------------------------------------------------------------------

// The names are part of the boundary the probe checks, so the test holds its own copy: a variable the
// sandbox env stops setting, or starts setting, fails here.
const ENV_NAMES = [
  'USERPROFILE', 'HOME', 'CLAUDE_CONFIG_DIR', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME',
  'ENGRAM_DATA_DIR', 'JS_HARNESS_HOME', 'npm_config_cache', 'CODEX_HOME', 'ENGRAM_PORT', 'HOMEDRIVE', 'HOMEPATH', 'DO_NOT_TRACK', 'GENTLE_AI_TELEMETRY', 'CODEGRAPH_TELEMETRY',
  'ENGRAM_URL', 'ENGRAM_SOCKET',
];

test('the prompt asks for the four steps in plain words: every variable the sandbox sets, the nonce file, the engram tool if there is one, one word', () => {
  assert.deepEqual(probeEnvNames('win32'), ENV_NAMES);
  assert.deepEqual(probeEnvNames('linux'), ENV_NAMES.filter((name) => name !== 'HOMEDRIVE' && name !== 'HOMEPATH'));
  const prompt = probePrompt(FAKE_NONCE);
  assert.ok(prompt.includes(`Names: ${probeEnvNames().join(', ')}\n`));
  assert.ok(prompt.includes('probe-env.txt') && prompt.includes('probe-nonce.txt') && prompt.includes('NAME=value'));
  assert.ok(prompt.includes(`memsave:${FAKE_NONCE}`) && /mem_save/.test(prompt) && /skip this step/.test(prompt));
  assert.ok(prompt.includes(`Reply with exactly: ${PROBE_WORD}`));
  assert.equal(prompt.match(/[0-9a-f]{32}/g).length, 2, 'the nonce, and the needle made of it, and no other');
  assert.ok(prompt.length < 1600, `a real model reads this: ${prompt.length} characters`);
  assert.doesNotMatch(prompt, /[$%`]|\bGet-|\becho\b|\bprintf\b/, 'it says what the files must hold, in no shell\'s syntax');
});

// ---- the environment control -----------------------------------------------------------------------

const PORT = 41234;
/** A sandbox as an arm makes it, whose workspace holds the environment file a shell would have written:
 * what the sandbox set, with `changes` on top (`undefined` leaves the line out, `<HOME>` is the trial's home). */
function envFile(changes = {}) {
  const sandbox = tmp('js-harness-codex-iso-probe-unit');
  const home = path.join(sandbox, 'home');
  const workspace = path.join(sandbox, 'workspace');
  const env = { ...codexSandboxEnv({ home, engramPort: PORT, inherited: {} }), ENGRAM_URL: '', ENGRAM_SOCKET: '', ...changes };
  const lines = Object.entries(env).filter(([, value]) => value !== undefined).map(([name, value]) => `${name}=${String(value).replaceAll('<HOME>', home)}`);
  write(path.join(workspace, 'probe-env.txt'), `${lines.join('\n')}\n`);
  return { sandbox, home, workspace, port: PORT };
}
const up = (...parts) => ['<HOME>', ...parts].join(path.sep);

test('the environment control passes what the sandbox set, in any spelling that is still the same place', () => {
  const exact = inspectEnv(envFile());
  assert.deepEqual(exact.problems, []);
  assert.deepEqual(exact.warnings, []);
  assert.ok(Object.values(exact.checks).every((check) => check === 'same'));
  // Another spelling of the same directories: resolved, they are where the sandbox put them.
  const respelled = inspectEnv(envFile({ HOME: up('.', 'tmp', '..'), CODEX_HOME: `"${up('.codex', 'skills', '..')}${path.sep}"`, TEMP: up('tmp').replaceAll('\\', '/') }));
  assert.deepEqual(respelled.problems, []);
  assert.deepEqual({ HOME: respelled.checks.HOME, CODEX_HOME: respelled.checks.CODEX_HOME, TEMP: respelled.checks.TEMP }, { HOME: 'inside', CODEX_HOME: 'inside', TEMP: 'same' });
  assert.deepEqual(respelled.warnings, ["the agent's shell reports HOME inside the trial's home under another path than the one set", "the agent's shell reports CODEX_HOME inside the trial's home under another path than the one set"]);
  // Elsewhere in the trial's home is still the sandbox: reported, not failed.
  const moved = inspectEnv(envFile({ TEMP: up('scratch') }));
  assert.deepEqual(moved.problems, []);
  assert.equal(moved.checks.TEMP, 'inside');
});

// One row per way the control fails an arm: what the shell reported, and the problem it must name.
const ENV_FAULTS = [
  ['a HOME that names the sandbox and leaves it through ..', { HOME: up('..', '..', '..', 'real-home') }, /^HOME is outside the trial's home$/],
  ['a TEMP in the sandbox but above the home', { TEMP: up('..', 'workspace') }, /^TEMP is outside the trial's home$/],
  ['a relative path, which no place can be told from', { APPDATA: path.join('home', 'AppData', 'Roaming') }, /^APPDATA is outside the trial's home$/],
  ['a required variable the shell does not have', { ENGRAM_DATA_DIR: '' }, /^ENGRAM_DATA_DIR is not set$/],
  ['a required variable with no line at all', { LOCALAPPDATA: undefined }, /^LOCALAPPDATA is not set$/],
  ['a CODEX_HOME in the trial\'s home that is not the trial\'s own', { CODEX_HOME: up('other-codex') }, /^CODEX_HOME is inside the trial's home but is not the trial's own$/],
  ['a CODEX_HOME that is the home itself', { CODEX_HOME: up('.codex', '..') }, /^CODEX_HOME is inside the trial's home but is not the trial's own$/],
  ['no ENGRAM_PORT', { ENGRAM_PORT: undefined }, /^ENGRAM_PORT is not set, not the trial's port 41234$/],
  ['another ENGRAM_PORT', { ENGRAM_PORT: '41235' }, /^ENGRAM_PORT is 41235, not the trial's port 41234$/],
  ['the real engram port', { ENGRAM_PORT: String(REAL_ENGRAM_PORT) }, /^ENGRAM_PORT is 7437, where the real engram server listens, not the trial's port 41234$/],
  ['an ENGRAM_URL', { ENGRAM_URL: 'http://127.0.0.1:7437/secret-path' }, /^ENGRAM_URL is set \(value not shown\)/],
  ['an ENGRAM_SOCKET', { ENGRAM_SOCKET: '/run/engram-secret.sock' }, /^ENGRAM_SOCKET is set \(value not shown\)/],
];
for (const [what, changes, problem] of ENV_FAULTS) {
  test(`the environment control fails an arm on ${what}`, () => {
    const result = inspectEnv(envFile(changes));
    assert.equal(result.problems.length, 1, result.problems.join('\n'));
    assert.match(result.problems[0], problem);
    assert.ok(!/secret/.test(JSON.stringify(result.problems)), 'a URL or a socket is named, never shown');
  });
}

test('the environment control reads a Git Bash spelling of a Windows path as the place it is', { skip: process.platform === 'win32' ? false : 'drive letters are a Windows matter' }, () => {
  const msys = (value) => `/${value[0].toLowerCase()}${value.slice(2).replaceAll('\\', '/')}`;
  const sandbox = envFile();
  const result = inspectEnv(envFile({ HOME: msys(sandbox.home) }));
  assert.match(result.problems.join('\n'), /^HOME is outside the trial's home$/, 'another sandbox\'s home is not this one\'s');
  const own = envFile();
  write(path.join(own.workspace, 'probe-env.txt'), fs.readFileSync(path.join(own.workspace, 'probe-env.txt'), 'utf8').replace(`HOME=${own.home}`, `HOME=${msys(own.home)}`));
  assert.deepEqual(inspectEnv(own).problems, []);
  assert.equal(inspectEnv(own).checks.HOME, 'inside');
});

test('an environment file that is not there is the one problem', () => {
  const sandbox = envFile();
  fs.rmSync(path.join(sandbox.workspace, 'probe-env.txt'));
  assert.deepEqual(inspectEnv(sandbox).problems, ['the agent wrote no probe-env.txt']);
});

// ---- whose engram process it is --------------------------------------------------------------------

test('an engram process that outlives a trial is the trial\'s only on evidence: its port or its sandbox in the command line, or its port still answering', () => {
  const root = path.join(scratch, 'work', 'js-harness-codex-iso-probe-AbC123');
  const before = [{ pid: 11, command: 'engram mcp' }, { pid: 12, command: `engram serve ${PORT}` }];
  const byPort = { pid: 21, command: `C:\\bin\\engram.exe serve --port ${PORT}` };
  const byEnvPort = { pid: 22, command: `engram serve :${PORT}/` };
  // Its sandbox as another tool may spell it: the other separator, doubled inside a quoted argument, and on
  // Windows in another case.
  const spelled = root.split(path.sep).join('//');
  const bySandbox = { pid: 23, command: `engram mcp --data "${process.platform === 'win32' ? spelled.toUpperCase() : spelled}//home//.engram"` };
  const stranger = { pid: 24, command: `engram mcp --tools=agent --port ${PORT}5` };
  const silent = { pid: 25, command: '' };
  const after = [...before, byPort, byEnvPort, bySandbox, stranger, silent];
  const quiet = attributeEngram({ before, after, port: PORT, root, listening: false });
  assert.deepEqual(quiet.survivors, [{ ...byPort, evidence: ['port'] }, { ...byEnvPort, evidence: ['port'] }, { ...bySandbox, evidence: ['sandbox'] }]);
  assert.deepEqual(quiet.unattributed, [stranger, silent], 'a longer number is not the port, and what was running before is nobody\'s');
  // The port still answers: something of the trial is alive, and a new engram process is the first suspect.
  const loud = attributeEngram({ before, after: [...before, byPort, stranger], port: PORT, root, listening: true });
  assert.deepEqual(loud.survivors, [{ ...byPort, evidence: ['port', 'listening'] }, { ...stranger, evidence: ['listening'] }]);
  assert.deepEqual(loud.unattributed, []);
  assert.deepEqual(attributeEngram({ before, after: before, port: PORT, root, listening: true }), { survivors: [], unattributed: [] });
  // A command line is cut for the report, after it was read whole.
  const long = { pid: 30, command: `engram ${'x'.repeat(300)} ${PORT}` };
  assert.deepEqual(attributeEngram({ before, after: [long], port: PORT, root, listening: false }).survivors, [{ pid: 30, command: long.command.slice(0, 200), evidence: ['port'] }]);
});

// ---- the probe end to end, against the fake agent --------------------------------------------------

test('the command runs one trial per arm, minimal first, proves each wrote inside its sandbox and nothing reached the real home, and exits 0', async () => {
  // A login file last written eight days ago: its date decides nothing, the hours its token has left do.
  const machine = fakeMachine({ loginAgeHours: 192 });
  const before = await bytesOf(machine.realHome);
  const out = tmp('out');
  const reportFile = path.join(out, 'nested', 'report.json');
  const rawDir = path.join(out, 'raw');
  const io = capture();
  const argv = ['--codex', process.execPath, '--control-ms', '5', '--timeout-ms', '60000', '--report', reportFile, '--raw-dir', rawDir];
  const code = await main(argv, { ...io, overrides: overridesFor(machine, { acts: (arm) => (arm === 'current' ? 'engram' : '') }) });
  assert.equal(code, 0, io.out.stdout + io.out.stderr);
  const text = fs.readFileSync(reportFile, 'utf8');
  const report = JSON.parse(text);

  assert.deepEqual(report.failures, []);
  assert.equal(report.ok, true);
  assert.deepEqual(report.arms.map((arm) => arm.arm), ['minimal', 'current'], 'the cheaper arm first');
  assert.deepEqual(report.skipped, []);
  assert.equal(report.codexVersion, '9.9.9 (Fake Agent)', 'what `--version` of the same command printed');
  assert.deepEqual(report.config, { model: 'gpt-6.1-sol', effort: 'medium' });
  assert.deepEqual(Object.keys(report.login), ['hoursLeft', 'minHoursLeft', 'ageHours']);
  assert.equal(report.login.minHoursLeft, 12);
  assert.ok(report.login.hoursLeft > 47.5 && report.login.hoursLeft <= 48, `${report.login.hoursLeft}`);
  assert.ok(report.login.ageHours >= 192 && report.login.ageHours < 192.5, `${report.login.ageHours}`);
  assert.ok(io.out.stdout.includes(`; the login's access token had ${report.login.hoursLeft} h left (minimum 12 h)`), 'the summary says what the login had left');
  assert.equal(report.control.ms, 5);
  assert.deepEqual(report.hashing.map((pass) => pass.label), ['before', 'control', 'after:minimal', 'after:current']);
  assert.ok(report.hashing.every((pass) => Number.isInteger(pass.ms) && pass.files > 0), 'how long each pass over the real trees took');
  assert.deepEqual(report.trees.find((tree) => tree.name === '.codex'), { name: '.codex', mode: 'content', statOnly: 3 });
  assert.match(report.notes.join('\n'), /\.codex: auth\.json, .* and 1 more described by size and date, never opened \(the login, and the desktop app's binaries/);
  assert.match(io.out.stdout, /the agent's shell: (\d+) of \1 variables are as the sandbox set them; CODEX_HOME=.*, ENGRAM_PORT=\d+/);
  assert.ok(report.template.files > 0, 'the current arm was seeded from a template of the real .codex');

  for (const arm of report.arms) {
    const label = arm.arm;
    assert.equal(arm.ok, true, label);
    assert.equal(arm.codexVersion, '9.9.9 (Fake Agent)', label);
    assert.equal(arm.exitCode, 0, label);
    assert.equal(arm.timedOut, false);
    assert.deepEqual(arm.agent, {
      parsed: true, failed: false, stop: null, finalMessage: PROBE_WORD, answered: true, threadId: 'found',
      usage: { turns: 1, inputTokens: 2000, cachedInputTokens: 1500, outputTokens: 80, reasoningOutputTokens: 30 },
    }, label);
    assert.equal(arm.events.types['thread.started'], 1);
    assert.equal(arm.events.types['turn.completed'], 1);
    assert.equal(arm.events.items.command_execution, 1);
    assert.equal(arm.events.items.agent_message, 1);
    assert.deepEqual(arm.events.errors, []);
    assert.deepEqual(arm.controls, { agent: { ok: true }, envFile: { ok: true }, nonceFile: { ok: true } }, label);
    assert.equal(arm.env.file, 'present');
    // The names this system's sandbox sets: `HOMEDRIVE` and `HOMEPATH` are Windows' alone, and the first run of
    // this suite on Linux was asked for them. The last two of the list are never set, only removed.
    const set = ENV_NAMES.slice(0, -2).filter((name) => process.platform === 'win32' || (name !== 'HOMEDRIVE' && name !== 'HOMEPATH'));
    for (const name of set) assert.equal(arm.env.checks[name], 'same', `${label}: ${name} is what the sandbox set`);
    assert.ok(arm.env.lines.CODEX_HOME.endsWith(path.join(arm.sandboxToken, 'home', '.codex')), 'CODEX_HOME is the trial\'s own');
    assert.equal(arm.env.lines.ENGRAM_PORT, String(arm.engram.port));
    assert.notEqual(arm.engram.port, REAL_ENGRAM_PORT);
    assert.equal(arm.loginCopy, 'unchanged', label);
    assert.equal(arm.realLogin, 'unchanged', label);
    assert.ok(arm.sandbox.codexHome.created.paths.includes('.codex/version.json'), 'what the agent added to its home, by name');
    assert.ok(!arm.sandbox.codexHome.created.paths.includes('.codex/auth.json'), 'what was put there before the agent ran is not what it gained');
    assert.equal(arm.sandbox.kept, null);
    assert.deepEqual(arm.leak.hits, [], label);
    assert.ok(arm.leak.fresh && arm.leak.baseline, 'with a control window, the diff is split by it');
    assert.deepEqual(arm.leak.diff, {}, 'and nothing in the real trees changed at all');
    assert.equal(arm.engram.listening, false);
    assert.deepEqual(arm.engram.survivors, []);
    assert.match(arm.sandboxToken, SANDBOX_NAME);

    // The agent ran as a measured trial of this arm does: the config's own argv, the prompt on stdin.
    const seen = seenBy(machine, label);
    assert.deepEqual(seen.argv.slice(0, 11), ['exec', '--json', '--ephemeral', '--skip-git-repo-check', '-m', 'gpt-6.1-sol', '-c', 'model_reasoning_effort="medium"', '--dangerously-bypass-approvals-and-sandbox', '-C', seen.cwd]);
    assert.deepEqual(seen.argv.slice(11), label === 'minimal' ? ['--ignore-user-config', '--ignore-rules'] : ['--dangerously-bypass-hook-trust']);
    assert.equal(seen.prompt, probePrompt(FAKE_NONCE));
    assert.equal(path.basename(path.dirname(seen.cwd)), arm.sandboxToken);

    // The raw output is kept, whole, where the caller said.
    assert.deepEqual(arm.raw, { stdout: path.join(rawDir, `${label}.stdout.log`), stderr: path.join(rawDir, `${label}.stderr.log`) });
    const stdout = fs.readFileSync(arm.raw.stdout, 'utf8');
    assert.match(stdout, /"type":"thread\.started"/);
    assert.match(fs.readFileSync(arm.raw.stderr, 'utf8'), /fake codex: a line on stderr/);
    // The thread id is a needle the real trees are scanned for, so it is in no output either.
    const threadId = JSON.parse(stdout.split('\n')[1]).thread_id;
    for (const output of [text, io.out.stdout, io.out.stderr]) assert.ok(!output.includes(threadId), `${label}: the thread id is printed`);
  }

  const [minimal, current] = report.arms;
  assert.deepEqual({ applies: minimal.engram.applies, exercised: minimal.engram.exercised }, { applies: false, exercised: false });
  assert.deepEqual(minimal.warnings, []);
  assert.deepEqual({ applies: current.engram.applies, db: current.engram.db, exercised: current.engram.exercised, memSave: current.engram.memSave }, { applies: true, db: '.engram/engram.db', exercised: true, memSave: true });
  assert.deepEqual(current.events.mcpCalls, ['engram/mem_save']);
  assert.deepEqual(current.warnings, []);
  assert.ok(current.sandbox.top.some((row) => row.path === '.codex/skills'), 'the current arm ran in a copy of the setup');
  assert.ok(!minimal.sandbox.top.some((row) => row.path === '.codex/skills'), 'and the minimal arm in a home with none');

  assert.deepEqual(runsOf(machine), ['codex-probe', 'codex-probe'], 'one agent process per arm');
  assert.deepEqual(await bytesOf(machine.realHome), before, 'the real home is byte-identical');
  assert.ok(!fs.existsSync(machine.workRoot), 'the sandboxes, the template and the work root this run made are gone');

  assert.match(io.out.stdout, /codex isolation probe: PASS/);
  assert.ok(io.out.stdout.includes(reportFile));
  for (const output of [text, io.out.stdout, io.out.stderr]) {
    assert.ok(!output.includes(FAKE_NONCE));
    for (const secret of loginSecrets(machine.login)) assert.ok(!output.includes(secret), 'nothing of the login is in an output but its dates');
  }
  assert.doesNotMatch(io.out.stderr, SANDBOX_NAME, 'progress lines never name the sandbox');
});

test('what a real model, or another session, may do is a warning, never a failure: no engram call, an answer in other words, files in UTF-16, a login copy it rewrote, an engram process of someone else', async () => {
  const machine = fakeMachine();
  const rawDir = path.join(tmp('out'), 'raw');
  // Another live session starts an engram process while the trial runs: new, and nothing says it is the trial's.
  const listings = [[{ pid: 11, command: 'engram mcp' }], [{ pid: 11, command: 'engram mcp' }, { pid: 77, command: 'engram mcp --tools=agent' }]];
  const report = await probe(machine, { arms: ['current'], acts: 'utf16,echo,echo-thread,refresh', rawDir, listEngram: () => listings.shift(), isListening: async () => false });
  const [arm] = report.arms;
  assert.deepEqual(report.failures, []);
  assert.deepEqual(arm.engram.survivors, []);
  assert.deepEqual(arm.engram.unattributed, [{ pid: 77, command: 'engram mcp --tools=agent' }]);
  assert.match(arm.warnings.join('\n'), /an engram process started during the trial that nothing ties to it \(pid 77\)/);
  // The thread id is a needle the real trees are scanned for: wherever Codex repeats it, the report has none.
  const threadId = JSON.parse(fs.readFileSync(arm.raw.stdout, 'utf8').split('\n')[1]).thread_id;
  assert.match(threadId, /^[0-9a-f-]{36}$/);
  assert.ok(fs.readFileSync(arm.raw.stderr, 'utf8').includes(threadId), 'the fake agent did print it on stderr');
  assert.ok(arm.stderrTail.includes('<thread id>'));
  for (const output of [JSON.stringify(report), formatSummary(report)]) assert.ok(!output.includes(threadId) && !output.includes(threadId.toUpperCase()));
  assert.equal(report.ok, true);
  assert.deepEqual(arm.controls, { agent: { ok: true }, envFile: { ok: true }, nonceFile: { ok: true } }, 'the files PowerShell 5.1 writes are read');
  assert.equal(arm.env.checks.CODEX_HOME, 'same');
  assert.deepEqual({ applies: arm.engram.applies, exercised: arm.engram.exercised, memSave: arm.engram.memSave }, { applies: true, exercised: false, memSave: false });
  assert.equal(arm.loginCopy, 'changed');
  assert.equal(arm.realLogin, 'unchanged');
  assert.equal(fs.readFileSync(machine.authFile, 'utf8'), machine.login);
  assert.equal(arm.agent.answered, false);
  assert.equal(arm.agent.finalMessage, `${PROBE_WORD} <nonce> <thread id>`, 'the answer is kept, scrubbed');
  assert.equal(arm.warnings.length, 4, arm.warnings.join('\n'));
  assert.match(arm.warnings.join('\n'), /engram was not exercised/);
  assert.match(arm.warnings.join('\n'), /rewrote its copy of the login.*real login may no longer be valid/);
  assert.match(arm.warnings.join('\n'), /did not answer with the one word/);
  assert.deepEqual(report.warnings, arm.warnings.map((warning) => `current: ${warning}`));
  assert.match(formatSummary(report), /codex isolation probe: PASS[\s\S]*warning: .*engram was not exercised/);
  assert.ok(!JSON.stringify(report).includes(FAKE_NONCE));
});

test('a trial that reaches the real home fails, each hit named by its path and never by what was found, and the next arm is not run', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, { acts: 'leak' });
  assert.equal(report.ok, false);
  assert.deepEqual(report.arms.map((arm) => arm.arm), ['minimal']);
  const [arm] = report.arms;
  assert.deepEqual(arm.leak.hits, [
    { tree: '.engram', path: 'engram.db', found: ['thread id'], via: 'content' },
    { tree: '.gentle-ai', path: `${arm.sandboxToken}.json`, found: ['sandbox'], via: 'name' },
    { tree: '.codex', path: 'history.jsonl', found: ['nonce'], via: 'content' },
  ]);
  assert.deepEqual(arm.controls, { agent: { ok: true }, envFile: { ok: true }, nonceFile: { ok: true } }, 'the trial itself ran as it should');
  assert.equal(arm.failures.length, 3);
  assert.match(arm.failures.join('\n'), /LEAK: the real \.codex has history\.jsonl \(content holds the nonce\)/);
  assert.match(arm.failures.join('\n'), /LEAK: the real \.engram has engram\.db \(content holds the thread id\)/);
  assert.deepEqual(arm.leak.diff['.codex'].added.paths, ['history.jsonl'], 'and the plain diff shows it too');
  assert.deepEqual(report.skipped, [{ arm: 'current', reason: 'the minimal arm failed, and an arm is a real, paid trial: fix what failed, then run this arm' }]);
  assert.deepEqual(runsOf(machine), ['codex-probe'], 'no second agent, and no retry of the first');
  assert.ok(!JSON.stringify(report).includes(FAKE_NONCE));
  assert.match(formatSummary(report), /codex isolation probe: FAIL[\s\S]*HIT \.codex\/history\.jsonl: nonce \(content\)[\s\S]*arm current: not run/);
  assert.ok(!fs.existsSync(machine.workRoot), 'the template built for the arm that never ran is gone too');
});

test('a trial that did not write what it was asked to, or whose shell sees a CODEX_HOME or a HOME outside its sandbox, fails: a clean scan would prove nothing, and the command exits 1', async () => {
  const machine = fakeMachine();
  const out = tmp('out');
  const reportFile = path.join(out, 'report.json');
  const rawDir = path.join(out, 'raw');
  // The raw directory passes the preflight and is gone by the time the session ends (a file is in its place):
  // the session is paid for, so the report must still come, with that said in it.
  const adaptConfig = (config, context) => {
    const adapted = fakeCodex(machine, { acts: 'no-nonce,wrong-home', shellEnv: { HOME: ['<HOME>', '..', '..', '..', 'real-home'].join(path.sep) } })(config, context);
    return { ...adapted, prepare: async (trial) => { fs.rmSync(rawDir, { recursive: true }); fs.writeFileSync(rawDir, ''); return adapted.prepare(trial); } };
  };
  const io = capture();
  const argv = ['--codex', process.execPath, '--arm', 'minimal', '--report', reportFile, '--raw-dir', rawDir, '--keep-sandbox'];
  const code = await main(argv, { ...io, overrides: overridesFor(machine, { adaptConfig, readVersion: () => '0.0.0' }) });
  assert.equal(code, 1, io.out.stderr);
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  const [arm] = report.arms;
  assert.equal(arm.raw, null);
  assert.match(arm.failures[0], /minimal: could not keep the raw output of the agent/);
  arm.failures.shift();
  assert.deepEqual(arm.controls.agent, { ok: true });
  assert.equal(arm.controls.nonceFile.ok, false);
  assert.equal(arm.controls.envFile.ok, false);
  assert.equal(arm.env.checks.CODEX_HOME, 'outside');
  // Its text holds the sandbox's name, and `..` takes it out of the sandbox all the same.
  assert.ok(arm.env.lines.HOME.includes(arm.sandboxToken));
  assert.equal(arm.env.checks.HOME, 'outside');
  assert.equal(arm.env.checks.USERPROFILE, 'same');
  assert.deepEqual(arm.leak.hits, []);
  assert.equal(arm.failures.length, 2, arm.failures.join('\n'));
  assert.match(arm.failures.join('\n'), /positive control "nonceFile" failed/);
  assert.match(arm.failures.join('\n'), /positive control "envFile" failed.*HOME is outside the trial's home; CODEX_HOME is outside the trial's home\./);
  assert.match(io.out.stdout, /codex isolation probe: FAIL/);
  // --keep-sandbox: the sandbox is left for a look, without the login.
  assert.ok(fs.existsSync(path.join(arm.sandbox.kept, 'workspace', 'probe-env.txt')));
  assert.ok(!fs.existsSync(path.join(arm.sandbox.kept, 'home', '.codex', 'auth.json')), 'a kept sandbox holds no credential');
});

test('what a trial leaves behind fails it: a real login that changed, a listener on its engram port, an engram process it started', async () => {
  const machine = fakeMachine();
  const listings = [[{ pid: 11, command: 'engram serve' }], [{ pid: 11, command: 'engram serve' }, { pid: 4242, command: 'engram serve --port 1' }]];
  const report = await probe(machine, { arms: ['minimal'], acts: 'login', isListening: async () => true, listEngram: () => listings.shift() });
  const [arm] = report.arms;
  assert.equal(report.ok, false);
  assert.equal(arm.realLogin, 'changed');
  assert.equal(arm.loginCopy, 'changed', 'the copy no longer equals the real one');
  assert.equal(arm.engram.listening, true);
  assert.deepEqual(arm.engram.survivors, [{ pid: 4242, command: 'engram serve --port 1', evidence: ['listening'] }], 'with its port still answering, a new engram process is taken for the trial\'s');
  assert.deepEqual(arm.engram.unattributed, []);
  assert.equal(arm.failures.length, 3, arm.failures.join('\n'));
  assert.match(arm.failures.join('\n'), /the real Codex login changed during the trial/);
  assert.match(arm.failures.join('\n'), /something still listens on the trial's engram port/);
  assert.match(arm.failures.join('\n'), /engram process the trial started is still running after it \(the trial's engram port still answers\): pid 4242/);
  assert.deepEqual(arm.leak.diff['.codex'].changed.paths, ['auth.json']);
  assert.ok(!JSON.stringify(report).includes('SENTINEL-DUMMY-LOGIN'));
});

test('an agent that fails is reported with what it printed, and is not run again', async () => {
  const machine = fakeMachine();
  const rawDir = path.join(tmp('out'), 'raw');
  const report = await probe(machine, { arms: ['minimal'], mode: 'codex-failed', rawDir });
  const [arm] = report.arms;
  assert.equal(report.ok, false);
  assert.equal(arm.exitCode, 1);
  assert.deepEqual({ parsed: arm.agent.parsed, failed: arm.agent.failed, stop: arm.agent.stop, finalMessage: arm.agent.finalMessage }, { parsed: true, failed: true, stop: null, finalMessage: null });
  assert.deepEqual(arm.agent.usage, { turns: 0, inputTokens: null, cachedInputTokens: null, outputTokens: null, reasoningOutputTokens: null });
  assert.deepEqual(arm.events.errors, [{ type: 'error', message: 'Something else went wrong' }, { type: 'turn.failed', message: 'Something else went wrong' }]);
  assert.deepEqual(arm.events.types, { 'thread.started': 1, 'turn.started': 1, error: 1, 'turn.failed': 1 });
  assert.equal(arm.controls.agent.ok, false);
  assert.match(arm.failures.join('\n'), /positive control "agent" failed.*exit code 1.*a turn failed/);
  assert.equal(arm.env.file, 'missing');
  assert.match(fs.readFileSync(path.join(rawDir, 'minimal.stdout.log'), 'utf8'), /turn\.failed/, 'the raw output of a failed run is the evidence a later task needs');
  assert.deepEqual(runsOf(machine), ['codex-failed']);
  assert.ok(!fs.existsSync(machine.workRoot));
});

test('a trial that cannot be prepared is a failure of its arm: no agent runs, and the sandbox and the template are removed', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, { arms: ['current'], runInit: async () => ({ status: 1, stdout: '', stderr: 'init broke' }) });
  const [arm] = report.arms;
  assert.equal(report.ok, false);
  assert.match(arm.error, /js-harness init failed.*init broke/);
  assert.match(arm.failures.join('\n'), /current: the trial could not run/);
  assert.deepEqual(runsOf(machine), []);
  assert.equal(arm.realLogin, 'unchanged');
  assert.deepEqual(arm.leak.hits, [], 'the real trees are scanned all the same');
  assert.ok(!fs.existsSync(machine.workRoot));
});

test('--version is read in the trial\'s own sandbox, never under the real environment, and a binary that does not answer gets no session', async () => {
  const machine = fakeMachine();
  const envs = [];
  const readVersion = (config, env) => {
    envs.push({ command: config.command, versionArgs: config.versionArgs, codexHome: env.CODEX_HOME, home: env.HOME });
    return null;
  };
  const report = await probe(machine, { arms: ['minimal'], readVersion });
  const [arm] = report.arms;
  // Codex writes into its CODEX_HOME even for `--version`, so the real one must not be the one it sees.
  const home = path.join(machine.workRoot, arm.sandboxToken, 'home');
  assert.deepEqual(envs, [{ command: process.execPath, versionArgs: [FAKE_AGENT, '--version'], codexHome: path.join(home, '.codex'), home }]);
  assert.equal(report.ok, false);
  assert.equal(report.codexVersion, null);
  assert.match(arm.error, /--version printed nothing under the trial's environment/);
  assert.deepEqual(runsOf(machine), [], 'no session was started');
  assert.match(formatSummary(report), /version not read/);
  assert.ok(!fs.existsSync(machine.workRoot));
});

test('a prepare that fails after the login was copied leaves no login behind, not even in a sandbox that is kept', async () => {
  const machine = fakeMachine();
  let copied = false;
  const adaptConfig = (config, context) => {
    const adapted = fakeCodex(machine)(config, context);
    return {
      ...adapted,
      prepare: async (trial) => {
        await adapted.prepare(trial);
        copied = fs.existsSync(path.join(trial.home, '.codex', 'auth.json'));
        throw new Error('the last step of the seed broke');
      },
    };
  };
  const report = await probe(machine, { arms: ['minimal'], keepSandbox: true, adaptConfig });
  const [arm] = report.arms;
  assert.equal(copied, true, 'the login was in the home when the step failed');
  assert.match(arm.error, /the last step of the seed broke/);
  assert.deepEqual(runsOf(machine), []);
  const kept = path.join(machine.workRoot, arm.sandboxToken);
  assert.ok(fs.existsSync(path.join(kept, 'home', '.codex')), 'the sandbox is kept, as asked');
  assert.ok(!fs.existsSync(path.join(kept, 'home', '.codex', 'auth.json')), 'without the credential');
  assert.equal(fs.readFileSync(machine.authFile, 'utf8'), machine.login, 'and the real one is where it was');
});

test('an engram process list that cannot be read leaves "nothing of the trial is left" unproven, which fails the arm', async () => {
  const broken = () => {
    throw new Error('tasklist is not there');
  };
  let calls = 0;
  const brokenLater = () => (calls++ === 0 ? [] : broken());
  for (const listEngram of [broken, brokenLater]) {
    // A binary that does not answer: the arm ends before any session, and the processes are listed all the same.
    const report = await probe(fakeMachine(), { arms: ['minimal'], readVersion: () => null, listEngram });
    const [arm] = report.arms;
    assert.equal(arm.engram.listingError, 'tasklist is not there');
    assert.deepEqual(arm.engram.survivors, []);
    assert.match(arm.failures.join('\n'), /minimal: inconclusive: the engram processes could not be listed \(tasklist is not there\), so "no engram process of the trial is left" is unproven/);
    assert.match(formatSummary(report), /engram processes could not be listed: INCONCLUSIVE/);
  }
});

// ---- a probe that breaks after a session was paid for ----------------------------------------------

test('a probe that breaks after a session still reports what that session showed and exits 3; one that breaks before any session exits 2', async () => {
  const machine = fakeMachine();
  const reportFile = path.join(tmp('out'), 'report.json');
  let passes = 0;
  // The first pass over the real trees works; the one after the minimal arm's session does not.
  const takeSnapshot = (trees, options) => {
    passes += 1;
    if (passes === 2) throw new Error('the disk went away');
    return snapshotTrees(trees, options);
  };
  const io = capture();
  const code = await main(['--codex', process.execPath, '--report', reportFile], { ...io, overrides: overridesFor(machine, { takeSnapshot, readVersion: () => '0.0.0' }) });
  assert.equal(code, 3, io.out.stderr);
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  assert.equal(report.ok, false);
  assert.deepEqual(report.incomplete, ['minimal: the real trees could not be checked after the trial: the disk went away']);
  const [arm] = report.arms;
  assert.deepEqual(arm.controls, { agent: { ok: true }, envFile: { ok: true }, nonceFile: { ok: true } }, 'what the session showed is kept');
  assert.equal(arm.agent.answered, true);
  assert.equal(arm.realLogin, 'unchanged');
  assert.equal(arm.leak, null, 'no scan, so no verdict on a leak');
  assert.equal(arm.failures.length, 1, arm.failures.join('\n'));
  assert.match(arm.failures[0], /minimal: inconclusive: the probe itself broke after the trial began \(the real trees could not be checked after the trial: the disk went away\)/);
  assert.deepEqual(report.skipped.map((entry) => entry.arm), ['current'], 'and no other session is paid for');
  assert.deepEqual(runsOf(machine), ['codex-probe']);
  assert.match(io.out.stdout, /codex isolation probe: INCOMPLETE[\s\S]*arm minimal: FAILED[\s\S]*positive controls: agent ok, envFile ok, nonceFile ok[\s\S]*leak scan of the real trees: not done/);
  assert.ok(io.out.stdout.includes(reportFile));
  assert.match(io.out.stderr, /the Codex isolation probe broke after a session had started, so what it reports is incomplete: minimal: .*the disk went away/);
  assert.doesNotMatch(io.out.stderr, /could not run/);
  assert.ok(!fs.existsSync(machine.workRoot), 'the sandbox and the template are removed all the same');

  // Before any session there is nothing to keep: the run could not start, which is exit 2.
  const early = capture();
  const other = fakeMachine();
  const none = () => {
    throw new Error('no disk at all');
  };
  assert.equal(await main(['--codex', process.execPath, '--report', reportFile], { ...early, overrides: overridesFor(other, { takeSnapshot: none }) }), 2);
  assert.match(early.out.stderr, /the Codex isolation probe could not run: no disk at all/);
  assert.equal(early.out.stdout, '');
  assert.deepEqual(runsOf(other), []);
});

test('a probe that cannot even make the sandbox of a later arm keeps the arm that was paid for, and exits 3', async () => {
  const machine = fakeMachine();
  const reportFile = path.join(tmp('out'), 'report.json');
  let passes = 0;
  // The work root is gone by the time the minimal arm has been checked: the current arm has nowhere to run.
  const takeSnapshot = async (trees, options) => {
    const taken = await snapshotTrees(trees, options);
    passes += 1;
    if (passes === 2) fs.rmSync(machine.workRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    return taken;
  };
  const io = capture();
  const code = await main(['--codex', process.execPath, '--report', reportFile], { ...io, overrides: overridesFor(machine, { takeSnapshot, readVersion: () => '0.0.0' }) });
  assert.equal(code, 3, io.out.stderr);
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  const [minimal, current] = report.arms;
  assert.equal(minimal.ok, true, minimal.failures.join('\n'));
  assert.deepEqual(minimal.leak.hits, []);
  assert.deepEqual({ ok: current.ok, sandboxToken: current.sandboxToken, leak: current.leak }, { ok: false, sandboxToken: null, leak: null });
  assert.match(current.probeError, /ENOENT.*mkdtemp/);
  assert.deepEqual(report.incomplete, [`current: ${current.probeError}`]);
  assert.equal(report.ok, false);
  assert.deepEqual(runsOf(machine), ['codex-probe'], 'the one session that could run');
  assert.match(io.out.stdout, /codex isolation probe: INCOMPLETE[\s\S]*arm minimal: ok[\s\S]*arm current: FAILED, agent exit none[\s\S]*the probe itself broke after a session had started/);
});

test('a report that cannot be written at the end does not cost what the session showed: the summary is printed, the failure is named, and the command exits 3', async () => {
  const machine = fakeMachine();
  const reportFile = path.join(tmp('out'), 'report.json');
  // The path was free when the run was checked; by the end a directory is in its place.
  const adaptConfig = (config, context) => {
    const adapted = fakeCodex(machine)(config, context);
    return { ...adapted, prepare: async (trial) => { fs.mkdirSync(reportFile); return adapted.prepare(trial); } };
  };
  const io = capture();
  const code = await main(['--codex', process.execPath, '--arm', 'minimal', '--report', reportFile], { ...io, overrides: overridesFor(machine, { adaptConfig, readVersion: () => '0.0.0' }) });
  assert.equal(code, 3, io.out.stderr);
  assert.match(io.out.stdout, /codex isolation probe: PASS[\s\S]*arm minimal: ok/);
  assert.ok(!io.out.stdout.includes('full report:'), 'no report is promised');
  assert.match(io.out.stderr, /the report could not be written to .*report\.json \(.+\): the summary on stdout is all that is kept of this run/);
  assert.deepEqual(runsOf(machine), ['codex-probe']);
});

// ---- before anything is created or spent -----------------------------------------------------------

test('a report or a raw directory that cannot be written refuses the run before anything is probed or spent', async () => {
  const machine = fakeMachine();
  const out = tmp('out');
  const blocker = path.join(out, 'a-file');
  fs.writeFileSync(blocker, '');
  let probed = false;
  const readVersion = () => {
    probed = true;
    return '0.0.0';
  };
  const cases = [
    [['--report', path.join(blocker, 'report.json')], /the report cannot be written: its directory .*a-file cannot be made or written \(.+\)/],
    [['--report', out], /the report cannot be written: .*out-\d+ is a directory/],
    [['--report', path.join(out, 'report.json'), '--raw-dir', path.join(blocker, 'raw')], /the raw output directory .*raw cannot be made or written \(.+\)/],
  ];
  for (const [argv, message] of cases) {
    const io = capture();
    const code = await main(['--codex', process.execPath, '--arm', 'minimal', ...argv], { ...io, overrides: overridesFor(machine, { readVersion }) });
    assert.equal(code, 2, argv.join(' '));
    assert.match(io.out.stderr, /the Codex isolation probe could not run: /);
    assert.match(io.out.stderr, message);
    assert.equal(io.out.stdout, '');
  }
  assert.equal(probed, false);
  assert.deepEqual(runsOf(machine), []);
  assert.ok(!fs.existsSync(machine.workRoot));
  assert.deepEqual(fs.readdirSync(out), ['a-file'], 'and the check leaves nothing of its own');
  // A caller of the function is checked the same way as one of the command.
  await assert.rejects(probe(machine, { rawDir: path.join(blocker, 'raw') }), /raw output directory .* cannot be made or written/);
  await assert.rejects(probe(machine, { reportFile: out }), /is a directory/);
  await assert.rejects(probe(machine, { reportFile: 'report.json' }), /the report file must be an absolute path, got "report\.json"/);
});

test('a login whose access token is near its expiry, or has no expiry to read, refuses the run before anything is created, probed or spent', async () => {
  let probed = false;
  const readVersion = () => {
    probed = true;
    return '0.0.0';
  };
  const logInAgain = /run `codex logout`, then `codex login`, then run again/i;
  for (const [label, machine, pattern] of [
    // The token counts whole seconds, so five hours from "now" reads as a hair under five.
    ['near its expiry', fakeMachine({ loginHoursLeft: 5 }), /expires at \d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z, in (5\.0|4\.9) hours: a run starts only while it has at least 12 hours left/],
    ['expired', fakeMachine({ loginHoursLeft: -3 }), /expired at \d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z, 3\.0 hours ago/],
    ['no access token', fakeMachine({ login: '{"auth_mode":"chatgpt","tokens":{"id_token":"SENTINEL-DUMMY-LOGIN"}}\n' }), /holds no access token.*so when it expires cannot be told/],
  ]) {
    await assert.rejects(probe(machine, { readVersion }), (err) => {
      assert.match(err.message, pattern, label);
      assert.match(err.message, logInAgain, `${label}: what to do`);
      const secrets = label === 'no access token' ? ['SENTINEL-DUMMY-LOGIN'] : loginSecrets(machine.login);
      for (const secret of secrets) assert.ok(!err.message.includes(secret), `${label}: nothing of the login is said but its dates`);
      return true;
    });
    assert.equal(probed, false, label);
    assert.ok(!fs.existsSync(machine.workRoot), label);
    assert.deepEqual(runsOf(machine), [], label);
    assert.equal(fs.readFileSync(machine.authFile, 'utf8'), machine.login, `${label}: the login is only read`);
  }
  // The minimum is the caller's: the command passes it on, and says why the run did not start.
  const io = capture();
  assert.equal(await main(['--codex', process.execPath, '--min-login-hours-left', '100'], { ...io, overrides: overridesFor(fakeMachine({ loginHoursLeft: 48 }), { readVersion }) }), 2);
  assert.match(io.out.stderr, /the Codex isolation probe could not run: .*at least 100 hours left/);
  assert.equal(probed, false);
});

test('the run refuses a command that is not a real binary, an arm it does not know, a missing login and a raw directory the scan would read', async () => {
  const machine = fakeMachine();
  const shim = path.join(path.parse(process.execPath).root, 'pnpm', 'codex.cmd');
  await assert.rejects(probe(machine, { codex: shim }), /shim/);
  await assert.rejects(probe(machine, { codex: 'codex' }), /absolute path/);
  await assert.rejects(probe(machine, { arms: ['both'] }), /unknown arm "both"/);
  await assert.rejects(probe(machine, { effort: 'hi"gh' }), /effort/);
  for (const rawDir of [path.join(machine.realHome, '.codex', 'raw'), path.join(machine.localAppData, 'OpenAI', 'deep', 'raw'), path.join(machine.realHome, 'raw'), machine.tempDir]) {
    await assert.rejects(probe(machine, { rawDir }), /raw output directory .* is inside .*scanned/, rawDir);
  }
  await assert.rejects(probe(machine, { rawDir: 'raw' }), /absolute path/);
  fs.rmSync(machine.authFile);
  await assert.rejects(probe(machine), /no Codex login at .*run `codex login`/);
  assert.ok(!fs.existsSync(machine.workRoot));
  assert.deepEqual(runsOf(machine), []);
});

test('the template of the real setup is removed when the run dies half way', async () => {
  const machine = fakeMachine();
  let during = [];
  const wait = async () => {
    during = fs.readdirSync(machine.workRoot);
    throw new Error('the machine went to sleep');
  };
  await assert.rejects(probe(machine, { arms: ['current'], controlMs: 5, wait }), /the machine went to sleep/);
  assert.equal(during.length, 1, 'the template was there when the run died');
  assert.match(during[0], /^js-harness-codex-iso-template-/);
  assert.ok(!fs.existsSync(machine.workRoot), 'and it is gone, with the work root this run made');
});

// ---- the command line ------------------------------------------------------------------------------

test('the command rejects bad arguments with exit 2, a message and the usage, and runs nothing; --help prints the usage', async () => {
  const machine = fakeMachine();
  const cases = [
    [[], /--codex is required/],
    [['--codex', 'codex'], /--codex must be an absolute path/],
    [['--codex', path.join(path.parse(process.execPath).root, 'pnpm', 'codex.cmd')], /--codex .* is a shim/],
    [['--codex', process.execPath, '--arm', 'weird'], /--arm must be/],
    [['--codex', process.execPath, '--control-ms', 'abc'], /non-negative integer/],
    [['--codex', process.execPath, '--min-login-hours-left', '0'], /--min-login-hours-left needs a positive integer/],
    [['--codex', process.execPath, '--effort', 'hi"gh'], /--effort/],
    [['--codex', process.execPath, '--raw-dir', 'raw'], /--raw-dir must be an absolute path/],
    [['--codex', process.execPath, '--timeout-ms'], /needs a value/],
    [['--codex', process.execPath, '--bogus'], /unknown argument "--bogus"/],
  ];
  for (const [argv, message] of cases) {
    const io = capture();
    assert.equal(await main(argv, { ...io, overrides: overridesFor(machine) }), 2, argv.join(' '));
    assert.match(io.out.stderr, message);
    assert.match(io.out.stderr, /usage: node evals\/codex-isolation-probe\.mjs/);
    assert.equal(io.out.stdout, '');
  }
  const io = capture();
  assert.equal(await main(['--help'], { ...io, overrides: overridesFor(machine) }), 0);
  assert.match(io.out.stdout, /usage: node evals\/codex-isolation-probe\.mjs --codex/);
  assert.match(io.out.stdout, /Exit 2: bad usage, or the run could not start: no\s+session was started\. Exit 3: the probe itself broke after a session had started/);
  assert.ok(!fs.existsSync(machine.workRoot));
  assert.deepEqual(runsOf(machine), []);
});

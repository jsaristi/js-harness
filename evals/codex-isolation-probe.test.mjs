import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertWorkRoot } from './configs.mjs';
import { defaultTrees, snapshotTrees } from './isolation-probe.mjs';
import { REAL_ENGRAM_PORT } from './ports.mjs';
import { PROBE_WORD, codexTrees, formatSummary, main, probeEnvNames, probePrompt, runCodexIsolationProbe } from './codex-isolation-probe.mjs';

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
const LOGIN = '{"auth_mode":"chatgpt","tokens":{"id_token":"SENTINEL-DUMMY-LOGIN"}}\n';
const HOUR = 3_600_000;
const SANDBOX_NAME = /js-harness-codex-iso-/;

// ---- a fake machine --------------------------------------------------------------------------------
// No test runs the real Codex or reads the machine's own `~/.codex`, `~/.engram` or `~/.gentle-ai`: the
// "real" home below is built in the scratch directory and every path the probe watches is handed to it.

/** A home holding every tree the probe watches, with a login written `loginAgeHours` ago; the folders
 * LOCALAPPDATA, APPDATA and TEMP would be; a work root that does not exist yet; and the file the fake agent
 * appends a line to each time it runs. */
function fakeMachine({ loginAgeHours = 1 } = {}) {
  const base = tmp('machine');
  const realHome = path.join(base, 'person');
  const localAppData = path.join(realHome, 'AppData', 'Local');
  const appData = path.join(realHome, 'AppData', 'Roaming');
  const tempDir = path.join(base, 'temp');
  const codex = path.join(realHome, '.codex');
  const authFile = path.join(codex, 'auth.json');
  write(authFile, LOGIN);
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
  return { realHome, localAppData, appData, tempDir, authFile, workRoot: path.join(base, 'work'), countFile: path.join(base, 'runs.txt'), seenDir: path.join(base, 'seen') };
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
 * arm. What each run saw (argv, prompt) goes to `<seenDir>/<arm>.json`. */
const fakeCodex = (machine, { mode = 'codex-probe', acts = '' } = {}) => (config, { arm }) => {
  fs.mkdirSync(machine.seenDir, { recursive: true });
  return {
    ...config,
    env: (context) => ({
      ...config.env(context),
      FAKE_AGENT_MODE: mode,
      FAKE_AGENT_PROBE_ACTS: typeof acts === 'function' ? acts(arm) : acts,
      FAKE_AGENT_REAL_HOME: machine.realHome,
      FAKE_AGENT_COUNT_FILE: machine.countFile,
      FAKE_AGENT_REPORT: path.join(machine.seenDir, `${arm}.json`),
    }),
  };
};

/** What every run of the probe on a fake machine is handed: the fake agent behind `node`, the machine's
 * paths, and stand-ins for what costs a second each and has its own tests (the sweep by path, the kill by
 * port, the listing of engram processes). */
const overridesFor = (machine, { mode, acts, ...extra } = {}) => ({
  commandArgs: [FAKE_AGENT],
  nonce: FAKE_NONCE,
  realHome: machine.realHome,
  localAppData: machine.localAppData,
  appData: machine.appData,
  tempDir: machine.tempDir,
  workRoot: machine.workRoot,
  checkWorkRoot: checkInScratch,
  runInit: noInit,
  adaptConfig: fakeCodex(machine, { mode, acts }),
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

// ---- the probe end to end, against the fake agent --------------------------------------------------

test('the command runs one trial per arm, minimal first, proves each wrote inside its sandbox and nothing reached the real home, and exits 0', async () => {
  const machine = fakeMachine();
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
  assert.equal(report.login.maxAgeHours, 186);
  assert.ok(report.login.ageHours > 0.9 && report.login.ageHours < 1.1, `${report.login.ageHours}`);
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
    for (const name of ENV_NAMES.slice(0, -2)) assert.equal(arm.env.checks[name], 'same', `${label}: ${name} is what the sandbox set`);
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
  for (const output of [text, io.out.stdout, io.out.stderr]) assert.ok(!output.includes(FAKE_NONCE) && !output.includes('SENTINEL-DUMMY-LOGIN'));
  assert.doesNotMatch(io.out.stderr, SANDBOX_NAME, 'progress lines never name the sandbox');
});

test('what a real model may do differently is a warning, never a failure: no engram call, an answer in other words, files in UTF-16, a login copy it rewrote', async () => {
  const machine = fakeMachine();
  const report = await probe(machine, { arms: ['current'], acts: 'utf16,echo,refresh' });
  const [arm] = report.arms;
  assert.deepEqual(report.failures, []);
  assert.equal(report.ok, true);
  assert.deepEqual(arm.controls, { agent: { ok: true }, envFile: { ok: true }, nonceFile: { ok: true } }, 'the files PowerShell 5.1 writes are read');
  assert.equal(arm.env.checks.CODEX_HOME, 'same');
  assert.deepEqual({ applies: arm.engram.applies, exercised: arm.engram.exercised, memSave: arm.engram.memSave }, { applies: true, exercised: false, memSave: false });
  assert.equal(arm.loginCopy, 'changed');
  assert.equal(arm.realLogin, 'unchanged');
  assert.equal(fs.readFileSync(machine.authFile, 'utf8'), LOGIN);
  assert.equal(arm.agent.answered, false);
  assert.equal(arm.agent.finalMessage, `${PROBE_WORD} <nonce>`, 'the answer is kept, scrubbed');
  assert.equal(arm.warnings.length, 3, arm.warnings.join('\n'));
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

test('a trial that did not write what it was asked to, or whose shell sees another CODEX_HOME, fails: a clean scan would prove nothing, and the command exits 1', async () => {
  const machine = fakeMachine();
  const out = tmp('out');
  const reportFile = path.join(out, 'report.json');
  // A raw directory that cannot be made (a file is in its place): the session is paid for, so the report
  // must still come, with that said in it.
  const rawDir = path.join(out, 'not-a-directory');
  fs.writeFileSync(rawDir, '');
  const io = capture();
  const argv = ['--codex', process.execPath, '--arm', 'minimal', '--report', reportFile, '--raw-dir', rawDir, '--keep-sandbox'];
  const code = await main(argv, { ...io, overrides: overridesFor(machine, { acts: 'no-nonce,wrong-home', readVersion: () => '0.0.0' }) });
  assert.equal(code, 1);
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  const [arm] = report.arms;
  assert.equal(arm.raw, null);
  assert.match(arm.failures[0], /minimal: could not keep the raw output of the agent/);
  arm.failures.shift();
  assert.deepEqual(arm.controls.agent, { ok: true });
  assert.equal(arm.controls.nonceFile.ok, false);
  assert.equal(arm.controls.envFile.ok, false);
  assert.equal(arm.env.checks.CODEX_HOME, 'outside');
  assert.equal(arm.env.checks.HOME, 'same');
  assert.deepEqual(arm.leak.hits, []);
  assert.equal(arm.failures.length, 2, arm.failures.join('\n'));
  assert.match(arm.failures.join('\n'), /positive control "nonceFile" failed/);
  assert.match(arm.failures.join('\n'), /positive control "envFile" failed.*CODEX_HOME/);
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
  assert.deepEqual(arm.engram.survivors, [{ pid: 4242, command: 'engram serve --port 1' }]);
  assert.equal(arm.failures.length, 3, arm.failures.join('\n'));
  assert.match(arm.failures.join('\n'), /the real Codex login changed during the trial/);
  assert.match(arm.failures.join('\n'), /something still listens on the trial's engram port/);
  assert.match(arm.failures.join('\n'), /engram process that was not running before the trial is still running after it: pid 4242/);
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

// ---- before anything is created or spent -----------------------------------------------------------

test('a login old enough to be refreshed inside a trial refuses the run before anything is created, probed or spent', async () => {
  const machine = fakeMachine({ loginAgeHours: 187 });
  let probed = false;
  const readVersion = () => {
    probed = true;
    return '0.0.0';
  };
  await assert.rejects(probe(machine, { readVersion }), /was last written 187\.0 hours ago, over the 186 hours allowed.*Use the real Codex once/);
  assert.equal(probed, false);
  assert.ok(!fs.existsSync(machine.workRoot));
  assert.deepEqual(runsOf(machine), []);
  // The limit is the caller's: the command passes it on, and says why the run did not start.
  const io = capture();
  assert.equal(await main(['--codex', process.execPath, '--max-login-age-hours', '100'], { ...io, overrides: overridesFor(fakeMachine({ loginAgeHours: 150 }), { readVersion }) }), 2);
  assert.match(io.out.stderr, /the Codex isolation probe could not run: .*over the 100 hours allowed/);
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
    [['--codex', process.execPath, '--max-login-age-hours', '0'], /positive/],
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
  assert.ok(!fs.existsSync(machine.workRoot));
  assert.deepEqual(runsOf(machine), []);
});

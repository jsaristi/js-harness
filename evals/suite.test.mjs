import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { assertWorkRoot, defaultWorkRoot } from './configs.mjs';
import { killByPath, planTrials, resolveAgent, runTrial, trialKey } from './runner.mjs';
import {
  EVAL_MODEL, TOKEN_VARIABLE, USAGE, UsageError, diffRun, formatSummary, parseArgs, readStack, suiteMain, summarizeResults,
} from './suite.mjs';
import { createReaper } from '../bin/lib/process-tree.testkit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.join(here, 'fixtures', 'tasks', 'sample');
const FAKE_AGENT = path.join(here, 'fixtures', 'fake-agent.mjs');

// Every directory a test makes lives under one root that is removed at the end. The processes a test started are
// stopped first, through the shared teardown (`process-tree.testkit.mjs`): never by a bare pid.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-suite-test-'));
const reaper = createReaper();
after(() => {
  reaper.sweep();
  for (let attempt = 0; ; attempt += 1) {
    try {
      fs.rmSync(scratch, { recursive: true, force: true });
      return;
    } catch (err) {
      if (attempt >= 10) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
    }
  }
});
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

// ---- the arguments ------------------------------------------------------------------------------------------------

const CLAUDE = path.join(scratch, 'bin', 'claude.exe');
const TASKS = ['format-v2', 'house-rules', 'lost-updates', 'resolver', 'spec-drift'];
const FULL = {
  '--claude': CLAUDE, '--configs': 'minimal,current', '--efforts': 'medium,high', '--repeats': '3', '--tasks': 'all', '--permission-mode': 'bypassPermissions', '--name': 'ab-run',
};
/** The argv of a full run command, with `changes` on top: a value of `undefined` leaves the flag out. */
const argv = (changes = {}) => Object.entries({ ...FULL, ...changes }).filter(([, value]) => value !== undefined).flatMap(([flag, value]) => [flag, value]);
const parse = (changes) => parseArgs(argv(changes), { taskIds: TASKS });

test('a full command parses into the arms, the efforts, the repeats, the tasks, the mode and the name', () => {
  assert.deepEqual(parse(), {
    mode: 'run', claude: CLAUDE, configs: ['minimal', 'current'], efforts: ['medium', 'high'], repeats: 3, tasks: TASKS, permissionMode: 'bypassPermissions', name: 'ab-run', workRoot: null,
  });
  const screen = parse({ '--configs': 'minimal', '--efforts': 'medium', '--tasks': 'spec-drift,resolver', '--work-root': path.join(scratch, 'work') });
  assert.deepEqual([screen.configs, screen.efforts, screen.tasks, screen.workRoot], [['minimal'], ['medium'], ['spec-drift', 'resolver'], path.join(scratch, 'work')]);
});

test('every argument but --work-root is required, and a missing one is named', () => {
  for (const flag of Object.keys(FULL)) {
    assert.throws(() => parse({ [flag]: undefined }), (error) => error instanceof UsageError && error.message.includes(flag), flag);
  }
  assert.throws(() => parseArgs([], { taskIds: TASKS }), UsageError);
});

test('an unknown flag, a flag without a value, a repeated flag and a stray word are usage errors', () => {
  assert.throws(() => parseArgs([...argv(), '--model', 'x'], { taskIds: TASKS }), /--model/);
  assert.throws(() => parseArgs([...argv(), '--repeats'], { taskIds: TASKS }), /--repeats/);
  assert.throws(() => parseArgs(['--claude', '--configs', 'minimal'], { taskIds: TASKS }), /--claude requires a value/);
  assert.throws(() => parseArgs([...argv(), '--name', 'again'], { taskIds: TASKS }), /--name .*twice/);
  assert.throws(() => parseArgs([...argv(), 'stray'], { taskIds: TASKS }), /stray/);
});

test('the values are checked: arms, efforts, repeats, tasks, permission mode and name', () => {
  const bad = (changes, pattern) => assert.throws(() => parse(changes), (error) => error instanceof UsageError && pattern.test(error.message), JSON.stringify(changes));
  bad({ '--configs': 'minimal,bare' }, /bare/);
  bad({ '--configs': 'minimal,minimal' }, /twice/);
  bad({ '--efforts': 'medium,extreme' }, /extreme/);
  bad({ '--efforts': '' }, /--efforts/);
  for (const repeats of ['0', '-1', '1.5', 'three', '']) bad({ '--repeats': repeats }, /--repeats/);
  bad({ '--tasks': 'spec-drift,nope' }, /nope/);
  bad({ '--tasks': 'all,spec-drift' }, /all/);
  bad({ '--permission-mode': 'yolo' }, /yolo/);
  for (const name of ['', '../escape', 'a/b', 'a\\b', '.hidden', 'with space']) bad({ '--name': name }, /--name/);
  assert.equal(parse({ '--permission-mode': 'acceptEdits' }).permissionMode, 'acceptEdits');
});

test('the permission mode has no default and is one value for both arms', () => {
  assert.throws(() => parse({ '--permission-mode': undefined }), /--permission-mode is required/);
  assert.throws(() => parse({ '--permission-mode': 'plan,default' }), /plan,default/);
});

test('--claude is an absolute path to the binary, never a .cmd shim, and --work-root is absolute', () => {
  for (const claude of ['claude', 'bin/claude', 'C:\\x\\claude.cmd', path.join(scratch, 'claude.BAT'), path.join(scratch, 'claude.ps1')]) {
    assert.throws(() => parse({ '--claude': claude }), (error) => error instanceof UsageError && /--claude/.test(error.message), claude);
  }
  assert.throws(() => parse({ '--work-root': 'relative/work' }), /--work-root/);
});

test('--summary reads a recorded run: it takes --name and nothing else', () => {
  assert.deepEqual(parseArgs(['--summary', '--name', 'screen'], { taskIds: TASKS }), { mode: 'summary', name: 'screen' });
  assert.throws(() => parseArgs(['--summary'], { taskIds: TASKS }), /--name/);
  assert.throws(() => parseArgs(['--summary', ...argv()], { taskIds: TASKS }), /--summary/);
});

// ---- what a run was, and what a resumed run may not change -----------------------------------------------------------

const STACK = { claude: '2.1.284 (Claude Code)', gentleAi: '2.4.0', engram: '2.1.0', engramPlugin: '0.1.5' };
const RUN = { model: EVAL_MODEL, permissionMode: 'bypassPermissions', stack: STACK };

test('a resumed run that differs in a version, the model or the permission mode is named change by change', () => {
  assert.deepEqual(diffRun(RUN, { ...RUN, stack: { ...STACK } }), []);
  assert.deepEqual(diffRun(RUN, { ...RUN, stack: { ...STACK, engramPlugin: '0.1.6' } }), [{ field: 'engram plugin', recorded: '0.1.5', current: '0.1.6' }]);
  assert.deepEqual(diffRun(RUN, { ...RUN, permissionMode: 'acceptEdits', stack: { ...STACK, claude: '2.2.0 (Claude Code)', gentleAi: null } }), [
    { field: 'claude', recorded: '2.1.284 (Claude Code)', current: '2.2.0 (Claude Code)' },
    { field: 'gentle-ai', recorded: '2.4.0', current: null },
    { field: 'permission mode', recorded: 'bypassPermissions', current: 'acceptEdits' },
  ]);
  assert.deepEqual(diffRun({ ...RUN, stack: { ...STACK, engram: null } }, { ...RUN, stack: { ...STACK, engram: null } }), [], 'an unreadable version is the same unreadable version');
  assert.deepEqual(diffRun(RUN, { ...RUN, model: 'claude-other' }), [{ field: 'model', recorded: EVAL_MODEL, current: 'claude-other' }]);
});

/** A fake machine for the stack probes: a home with the plugin record, and a `spawn` that answers `<tool> version`. */
function stackMachine({ plugin = '0.1.5', gentleAi = 'gentle-ai 2.4.0', engram = 'engram v2.1.0' } = {}) {
  const home = tmp('stack-home');
  if (plugin !== null) write(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'engram@engram': [{ scope: 'user', version: plugin }], 'codex@openai-codex': [{ version: '9.9.9' }] } }));
  const calls = [];
  const spawn = (command, args) => {
    calls.push([command, args]);
    const text = { 'gentle-ai': gentleAi, engram }[String(command).split(' ')[0]];
    return text === undefined ? { error: Object.assign(new Error('ENOENT'), { code: 'ENOENT' }) } : text === null ? { status: 1, stdout: '' } : { status: 0, stdout: `${text}\n` };
  };
  return { home, spawn, calls };
}

test('the stack is the CLI, gentle-ai, engram and the engram plugin, each read where it is written down', () => {
  const machine = stackMachine();
  const stack = readStack({ claude: CLAUDE, home: machine.home, spawn: machine.spawn, platform: 'linux', probeClaude: (command) => (command === CLAUDE ? '2.1.284 (Claude Code)' : null) });
  assert.deepEqual(stack, STACK);
  assert.deepEqual(machine.calls.map(([command]) => command), ['gentle-ai', 'engram'], 'no other tool is asked');
});

test('a version that cannot be read is null, never a guess', () => {
  const missing = stackMachine({ plugin: null, gentleAi: null, engram: 'no version here' });
  assert.deepEqual(readStack({ claude: CLAUDE, home: missing.home, spawn: missing.spawn, platform: 'linux', probeClaude: () => null }), { claude: null, gentleAi: null, engram: null, engramPlugin: null });
  const broken = stackMachine();
  write(path.join(broken.home, '.claude', 'plugins', 'installed_plugins.json'), 'not json');
  assert.equal(readStack({ claude: CLAUDE, home: broken.home, spawn: broken.spawn, platform: 'linux', probeClaude: () => null }).engramPlugin, null);
  const noEngram = stackMachine();
  write(path.join(noEngram.home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ plugins: { 'codex@openai-codex': [{ version: '1.0.0' }] } }));
  assert.equal(readStack({ claude: CLAUDE, home: noEngram.home, spawn: noEngram.spawn, platform: 'linux', probeClaude: () => null }).engramPlugin, null);
});

test('the default CLI probe is the binary\'s own first line of --version', () => {
  const machine = stackMachine();
  const stack = readStack({ claude: process.execPath, home: machine.home, spawn: machine.spawn, platform: 'linux' });
  assert.equal(stack.claude, `v${process.versions.node}`);
});

// ---- the headroom summary ---------------------------------------------------------------------------------------

const trial = (task, config, effort, repeat, extra = {}) => ({
  task, config, effort, repeat, score: 0.5, passed: 1, total: 2, inputTokens: 1000, outputTokens: 200, turns: 5, wallMs: 60000, cliVersion: '2.1.284', error: null, startedAt: '2026-10-02T10:00:00.000Z', ...extra,
});
const docOf = (trials, args = {}) => ({ format: 1, name: 'screen', args: { configs: ['minimal'], efforts: ['medium'], tasks: ['a', 'b', 'c', 'd'], ...args }, trials });
const rowOf = (summary, task, config = 'minimal', effort = 'medium') => summary.rows.find((row) => row.task === task && row.config === config && row.effort === effort);

test('per task, config and effort: the trials recorded, the score mean, min and max, and the mean tokens and wall time', () => {
  const summary = summarizeResults(docOf([
    trial('a', 'minimal', 'medium', 1, { score: 0.5, inputTokens: 1000, outputTokens: 200, wallMs: 60000 }),
    trial('a', 'minimal', 'medium', 2, { score: 1, inputTokens: 3000, outputTokens: 400, wallMs: 120000 }),
    trial('a', 'minimal', 'medium', 3, { score: 0, inputTokens: 2000, outputTokens: 300, wallMs: 90000 }),
    trial('a', 'current', 'high', 1, { score: 0.75 }),
  ]));
  assert.deepEqual(rowOf(summary, 'a'), {
    task: 'a', config: 'minimal', effort: 'medium', trials: 3, score: { mean: 0.5, min: 0, max: 1 }, tokens: { mean: 2300, known: 3 }, wallMs: { mean: 90000, known: 3 },
  });
  assert.equal(rowOf(summary, 'a', 'current', 'high').trials, 1);
  assert.equal(summary.rows.length, 2);
});

test('an unknown token count or wall time is left out of its mean and counted, and a group with none is null, never 0', () => {
  const summary = summarizeResults(docOf([
    trial('a', 'minimal', 'medium', 1, { inputTokens: 1000, outputTokens: 1000 }),
    trial('a', 'minimal', 'medium', 2, { inputTokens: null, outputTokens: null, wallMs: null }),
    trial('b', 'minimal', 'medium', 1, { inputTokens: 10, outputTokens: null, wallMs: null }),
  ]));
  const a = rowOf(summary, 'a');
  assert.deepEqual([a.tokens, a.wallMs], [{ mean: 2000, known: 1 }, { mean: 60000, known: 1 }]);
  const b = rowOf(summary, 'b');
  assert.deepEqual([b.tokens, b.wallMs], [{ mean: null, known: 0 }, { mean: null, known: 0 }], 'half a token count is unknown, not 10');
  assert.equal(a.trials, 2, 'the trial with unknown usage is still a recorded trial');
});

test('a task is kept when the minimal config at medium has 3 trials with a mean below 0.8, dropped at 0.8 or above, and incomplete otherwise', () => {
  const scores = (task, list) => list.map((score, index) => trial(task, 'minimal', 'medium', index + 1, { score }));
  const summary = summarizeResults(docOf([
    ...scores('a', [0.5, 0.5, 0.5]),
    ...scores('b', [1, 0.75, 0.85]),
    ...scores('c', [0, 0]),
    // `d` has trials, but none of the minimal config at medium: only that cell is the screen
    trial('d', 'minimal', 'high', 1, { score: 0 }),
    ...[1, 2, 3].map((repeat) => trial('d', 'current', 'medium', repeat, { score: 0 })),
  ], { tasks: ['a', 'b', 'c', 'd', 'e'] }));
  assert.deepEqual(summary.headroom.map(({ task, verdict }) => [task, verdict]), [['a', 'keep'], ['b', 'drop'], ['c', 'incomplete'], ['d', 'incomplete'], ['e', 'incomplete']]);
  assert.ok(Math.abs(summary.headroom[1].mean - 2.6 / 3) < 1e-9);
  assert.deepEqual(summary.headroom[2], { task: 'c', verdict: 'incomplete', trials: 2, mean: 0 }, 'two trials are not enough, whatever they scored');
  assert.deepEqual(summary.headroom[4], { task: 'e', verdict: 'incomplete', trials: 0, mean: null }, 'a task of the run with no trial yet');
  const exactly = summarizeResults(docOf([...[0.8, 0.8, 0.8].map((score, index) => trial('a', 'minimal', 'medium', index + 1, { score }))]));
  assert.equal(exactly.headroom.find((entry) => entry.task === 'a').verdict, 'drop', '0.8 itself is not below 0.8');
});

test('a trial that ended in an error is a recorded trial of the screen: a failure rate is a result', () => {
  const summary = summarizeResults(docOf([1, 2, 3].map((repeat) => trial('a', 'minimal', 'medium', repeat, { score: 0, error: 'timeout' }))));
  assert.equal(summary.headroom.find((entry) => entry.task === 'a').verdict, 'keep');
});

test('the summary is a table of rows and the screen, with unknown written out, and nothing recorded says so', () => {
  const text = formatSummary(summarizeResults(docOf([
    trial('a', 'minimal', 'medium', 1, { score: 0.5 }),
    trial('b', 'minimal', 'medium', 1, { inputTokens: null, outputTokens: null, wallMs: null }),
  ])));
  assert.match(text, /task\s+config\s+effort\s+trials\s+score mean\s+min\s+max\s+tokens\s+wall/);
  assert.match(text, /a\s+minimal\s+medium\s+1\s+0\.50\s+0\.50\s+0\.50\s+1\.2k\s+1m00s/);
  assert.match(text, /b\s+minimal\s+medium\s+1\s+0\.50\s+0\.50\s+0\.50\s+unknown\s+unknown/);
  assert.match(text, /Headroom screen/);
  assert.match(text, /a\s+incomplete \(1 of 3 trials\)/);
  assert.match(formatSummary(summarizeResults(docOf([]))), /no trial recorded/);
});

test('the token variable and the model are what the design names', () => {
  assert.equal(TOKEN_VARIABLE, 'JS_HARNESS_EVAL_OAUTH_TOKEN');
  assert.equal(EVAL_MODEL, 'claude-opus-5-5');
});

// ---- the entry ------------------------------------------------------------------------------------------------------
// Every run below uses a stand-in for `runTrial`: no agent starts, no model is called and nothing is spent. The real
// work-root check, home template and results file are the real ones, on a fake machine in the scratch directory.

const FAKE_TOKEN = 'sk-ant-oat01-FAKE-never-in-a-file-or-a-stream-0123456789';
const ENV = { [TOKEN_VARIABLE]: FAKE_TOKEN };

/** A fake machine: a real home with the config the template copies, two tasks, and the places a run writes. */
function machine() {
  const base = tmp('machine');
  const realHome = path.join(base, 'person');
  write(path.join(realHome, '.claude', 'settings.json'), '{"model":"opus"}\n');
  write(path.join(realHome, '.claude', 'CLAUDE.md'), '# the global rules\n');
  const tasksDir = path.join(base, 'tasks');
  for (const id of ['alpha', 'beta']) fs.cpSync(SAMPLE, path.join(tasksDir, id), { recursive: true });
  const claude = path.join(base, 'bin', 'claude.exe');
  write(claude, 'a stand-in binary');
  return { base, realHome, tasksDir, claude, repoRoot: path.join(base, 'repo'), workRoot: path.join(base, 'work'), resultsDir: path.join(base, 'results'), runsDir: path.join(base, 'runs') };
}

const scratchOnly = (target) => {
  const relative = path.relative(scratch, target);
  return !relative.startsWith('..') && !path.isAbsolute(relative) && fs.lstatSync(target, { throwIfNoEntry: false }) !== undefined;
};

const recordFor = (trial, extra = {}) => ({
  task: trial.task.id, config: trial.config.name, effort: trial.effort, repeat: trial.repeat, score: 0.5, passed: 1, total: 2, inputTokens: 100, outputTokens: 20, turns: 3, wallMs: 1000, cliVersion: '2.1.284', error: null, startedAt: '2026-10-02T12:00:00.000Z', ...extra,
});
const stopped = (reason) => () => ({ status: 'stopped', reason, message: `the ${reason} stop` });

/** A `runTrial` stand-in: records what it was asked, keeps the trials it was handed, and answers
 * `outcome(trial, number)` when that returns something, else a recorded trial. */
function fakeRun(outcome = () => undefined) {
  const run = async (trial) => {
    run.asked.push(trialKey({ task: trial.task.id, config: trial.config.name, effort: trial.effort, repeat: trial.repeat }));
    run.trials.push(trial);
    return (await outcome(trial, run.asked.length)) ?? { status: 'recorded', record: recordFor(trial) };
  };
  run.asked = [];
  run.trials = [];
  return run;
}

function depsFor(m, extra = {}) {
  const io = { out: '', err: '' };
  const proc = Object.assign(new EventEmitter(), { exited: [], exit(code) { this.exited.push(code); } });
  const deps = {
    stdout: { write: (text) => { io.out += text; } },
    stderr: { write: (text) => { io.err += text; } },
    repoRoot: m.repoRoot, tasksDir: m.tasksDir, resultsDir: m.resultsDir, runsDir: m.runsDir, realHome: m.realHome,
    checkWorkRoot: (root, { realHome }) => assertWorkRoot(root, { realHome, exists: scratchOnly }),
    readStack: () => ({ ...STACK }),
    runTrial: fakeRun(),
    fileExists: () => true,
    now: () => new Date('2026-10-02T12:00:00.000Z'),
    process: proc,
    ...extra,
  };
  return { io, deps, proc };
}

/** The argv of a run of the machine's own tasks: 2 tasks x 2 arms x 2 efforts x 1 repeat, 8 trials. */
const runArgv = (m, changes = {}) => argv({
  '--claude': m.claude, '--efforts': 'medium,high', '--repeats': '1', '--name': 'screen', '--work-root': m.workRoot, ...changes,
});
const resultsFile = (m, name = 'screen') => path.join(m.resultsDir, `${name}.json`);
const readDoc = (m, name) => JSON.parse(fs.readFileSync(resultsFile(m, name), 'utf8'));
const keysOf = (records) => records.map((record) => trialKey(record));
const PLAN = planTrials({ tasks: [{ id: 'alpha' }, { id: 'beta' }], configs: [{ name: 'minimal' }, { name: 'current' }], efforts: ['medium', 'high'], repeats: 1 })
  .map(({ task, config, effort, repeat }) => trialKey({ task: task.id, config: config.name, effort, repeat }));
const templatesIn = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => /template/.test(name)) : []);
const nothingCreated = (m) => {
  for (const dir of [m.workRoot, m.resultsDir, m.runsDir]) assert.equal(fs.existsSync(dir), false, `${dir} was not created`);
};

test('a missing or unknown argument prints the usage and exits 2 before anything is created or run', async () => {
  const m = machine();
  for (const changes of [{ '--name': undefined }, { '--configs': 'bare' }, { '--tasks': 'nope' }]) {
    const { io, deps } = depsFor(m);
    assert.equal(await suiteMain(runArgv(m, changes), ENV, deps), 2, JSON.stringify(changes));
    assert.ok(io.err.includes(USAGE), 'the usage is printed');
    assert.equal(io.out, '');
    assert.deepEqual(deps.runTrial.asked, []);
  }
  const { io, deps } = depsFor(m);
  assert.equal(await suiteMain(['--bogus'], ENV, deps), 2);
  assert.match(io.err, /unknown argument --bogus/);
  nothingCreated(m);
});

test('--tasks all with no task to run is a usage error naming the tasks directory, exits 2 and creates nothing', async () => {
  const m = machine();
  const empty = path.join(m.base, 'empty-tasks');
  fs.mkdirSync(empty);
  fs.writeFileSync(path.join(empty, 'README.md'), 'a file is not a task\n');
  for (const tasksDir of [path.join(m.base, 'no-such-tasks'), empty]) {
    const { io, deps } = depsFor(m, { tasksDir });
    assert.equal(await suiteMain(runArgv(m), ENV, deps), 2, tasksDir);
    assert.ok(io.err.includes(tasksDir), 'names the tasks directory');
    assert.ok(io.err.includes(USAGE), 'the usage is printed');
    assert.equal(io.out, '');
    assert.deepEqual(deps.runTrial.asked, []);
  }
  nothingCreated(m);
  assert.throws(() => parseArgs(argv(), { taskIds: [], tasksDir: 'somewhere' }), (error) => error instanceof UsageError && error.message.includes('somewhere'));

  // A recorded run is still summarized when the tasks directory is gone: --summary reads results, not tasks.
  const run = depsFor(m);
  assert.equal(await suiteMain(runArgv(m), ENV, run.deps), 0);
  const summary = depsFor(m, { tasksDir: empty });
  assert.equal(await suiteMain(['--summary', '--name', 'screen'], {}, summary.deps), 0);
});

test('a --claude that is not there is a usage error, before anything is created', async () => {
  const m = machine();
  const { io, deps } = depsFor(m, { fileExists: () => false });
  assert.equal(await suiteMain(runArgv(m), ENV, deps), 2);
  assert.match(io.err, /--claude .* does not exist/);
  nothingCreated(m);
});

test('without the token variable the suite stops before any trial, naming the variable and `claude setup-token`, and never falls back to another one', async () => {
  const m = machine();
  const inherited = { CLAUDE_CODE_OAUTH_TOKEN: 'inherited-oauth', ANTHROPIC_API_KEY: 'inherited-key', ANTHROPIC_AUTH_TOKEN: 'inherited-auth' };
  for (const env of [{}, inherited, { ...inherited, [TOKEN_VARIABLE]: '' }, { ...inherited, [TOKEN_VARIABLE]: '   ' }]) {
    const { io, deps } = depsFor(m);
    assert.equal(await suiteMain(runArgv(m), env, deps), 1, JSON.stringify(Object.keys(env)));
    assert.ok(io.err.includes(TOKEN_VARIABLE), 'names the variable');
    assert.match(io.err, /claude setup-token/);
    assert.ok(!/inherited-/.test(io.err + io.out));
    assert.deepEqual(deps.runTrial.asked, []);
  }
  nothingCreated(m);
});

test('the token reaches a trial only as CLAUDE_CODE_OAUTH_TOKEN in its own env, on both arms, and replaces an inherited one', async () => {
  const m = machine();
  const { deps } = depsFor(m);
  const saved = { token: process.env.CLAUDE_CODE_OAUTH_TOKEN, key: process.env.ANTHROPIC_API_KEY };
  process.env.CLAUDE_CODE_OAUTH_TOKEN = 'inherited-oauth-token';
  process.env.ANTHROPIC_API_KEY = 'inherited-api-key';
  try {
    assert.equal(await suiteMain(runArgv(m), ENV, deps), 0);
    const configs = new Map(deps.runTrial.trials.map((trial) => [trial.config.name, trial.config]));
    assert.deepEqual([...configs.keys()].sort(), ['current', 'minimal']);
    for (const [name, config] of configs) {
      const agent = resolveAgent(config, { effort: 'medium', home: path.join(m.base, 'home'), workspace: path.join(m.base, 'ws'), prepared: { engramPort: 41000 } });
      assert.equal(agent.env.CLAUDE_CODE_OAUTH_TOKEN, FAKE_TOKEN, `${name}: the eval's token, not the inherited one`);
      assert.equal(agent.env.ANTHROPIC_API_KEY, null, `${name}: an inherited API key is removed`);
      assert.equal(agent.command, m.claude);
      assert.ok(agent.args.includes('--permission-mode') && agent.args.includes('bypassPermissions') && agent.args.includes(EVAL_MODEL));
      assert.ok(!agent.args.some((arg) => String(arg).includes(FAKE_TOKEN)), 'never in the argv');
    }
  } finally {
    for (const [name, value] of [['CLAUDE_CODE_OAUTH_TOKEN', saved.token], ['ANTHROPIC_API_KEY', saved.key]]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('the token is in no file and no stream the suite produces, whatever the trials say', async () => {
  const leaky = (trial, number) => {
    if (number === 1) return { status: 'recorded', record: recordFor(trial, { error: `agent said ${FAKE_TOKEN}` }) };
    if (number === 2) return { status: 'stopped', reason: 'auth', message: `login failed for ${FAKE_TOKEN}` };
    return undefined;
  };
  const m = machine();
  const first = depsFor(m, { runTrial: fakeRun(leaky) });
  assert.equal(await suiteMain(runArgv(m), ENV, first.deps), 1);
  const thrown = depsFor(m, { runTrial: fakeRun(() => { throw new Error(`exploded with ${FAKE_TOKEN}`); }) });
  assert.equal(await suiteMain(runArgv(m, { '--name': 'other' }), ENV, thrown.deps), 1);
  const summary = depsFor(m);
  assert.equal(await suiteMain(['--summary', '--name', 'screen'], ENV, summary.deps), 0);

  const streams = [first.io.out, first.io.err, thrown.io.out, thrown.io.err, summary.io.out, summary.io.err].join('\n');
  assert.ok(!streams.includes(FAKE_TOKEN), 'a stream');
  assert.match(first.io.err, /login failed/, 'the stop is still reported');
  assert.match(thrown.io.err, /exploded/);
  const files = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : files.push(path.join(dir, entry.name))));
  walk(m.base);
  assert.ok(files.includes(resultsFile(m)), 'the results file exists, so the scan has something to read');
  for (const file of files) assert.ok(!fs.readFileSync(file, 'latin1').includes(FAKE_TOKEN), file);
});

test('the work root defaults to the one next to the repository and is always checked, the explicit one too', async () => {
  const m = machine();
  const checked = [];
  const spy = (root, options) => { checked.push([root, options.realHome]); };
  const first = depsFor(m, { checkWorkRoot: spy });
  assert.equal(await suiteMain(runArgv(m, { '--work-root': undefined, '--configs': 'minimal' }), ENV, first.deps), 0);
  assert.deepEqual(checked, [[defaultWorkRoot({ repoRoot: m.repoRoot }), m.realHome]]);
  assert.equal(first.deps.runTrial.trials[0].workRoot, defaultWorkRoot({ repoRoot: m.repoRoot }));
  assert.equal(first.deps.runTrial.trials[0].runsDir, path.join(m.runsDir, 'screen'), 'the raw logs of a run are under its name');

  const second = depsFor(m, { checkWorkRoot: spy });
  assert.equal(await suiteMain(runArgv(m, { '--name': 'explicit', '--configs': 'minimal' }), ENV, second.deps), 0);
  assert.deepEqual(checked.at(-1), [m.workRoot, m.realHome]);
  assert.equal(second.deps.runTrial.trials[0].workRoot, m.workRoot);
});

test('two runs that share trials keep their raw logs apart: a run named <name> writes under runs/<name>/ and never over another\'s', async () => {
  const m = machine();
  const logging = (label) => fakeRun((trial) => {
    fs.mkdirSync(trial.runsDir, { recursive: true });
    fs.writeFileSync(path.join(trial.runsDir, 'alpha__minimal__medium__1.stdout.log'), label);
  });
  for (const name of ['screen', 'ab-run']) {
    const { deps } = depsFor(m, { runTrial: logging(name) });
    assert.equal(await suiteMain(runArgv(m, { '--name': name, '--configs': 'minimal', '--efforts': 'medium' }), ENV, deps), 0);
  }
  for (const name of ['screen', 'ab-run']) {
    assert.equal(fs.readFileSync(path.join(m.runsDir, name, 'alpha__minimal__medium__1.stdout.log'), 'utf8'), name, `${name} kept its own log`);
  }
  assert.deepEqual(fs.readdirSync(m.runsDir).sort(), ['ab-run', 'screen'], 'nothing is written to the shared runs directory itself');
});

test('a work root the check refuses stops the suite before anything is created: the real check runs by default', async () => {
  const m = machine();
  const inside = path.join(m.realHome, 'evals-work');
  const { io, deps } = depsFor(m, { checkWorkRoot: undefined });
  assert.equal(await suiteMain(runArgv(m, { '--work-root': inside }), ENV, deps), 1);
  assert.match(io.err, /inside the real home/);
  assert.deepEqual(deps.runTrial.asked, []);
  nothingCreated(m);
  assert.equal(fs.existsSync(inside), false);
});

test('a run records every trial in the results file, in the planned order, with what the current arm was', async () => {
  const m = machine();
  const { io, deps } = depsFor(m);
  assert.equal(await suiteMain(runArgv(m), ENV, deps), 0, io.err);
  const doc = readDoc(m);
  assert.equal(doc.format, 1);
  assert.equal(doc.name, 'screen');
  assert.equal(doc.createdAt, '2026-10-02T12:00:00.000Z');
  assert.equal(doc.permissionMode, 'bypassPermissions');
  assert.equal(doc.model, EVAL_MODEL);
  assert.deepEqual(doc.stack, STACK);
  assert.deepEqual(doc.args, { claude: m.claude, configs: ['minimal', 'current'], efforts: ['medium', 'high'], repeats: 1, tasks: ['alpha', 'beta'], workRoot: m.workRoot });
  assert.deepEqual(keysOf(doc.trials), PLAN);
  assert.deepEqual(deps.runTrial.asked, PLAN);
  assert.deepEqual(fs.readdirSync(m.resultsDir), ['screen.json'], 'no temporary file is left');
  assert.match(io.out, /task\s+config\s+effort\s+trials\s+score mean/, 'the summary is printed after the run');
  assert.match(io.out, /Headroom screen/);
  assert.match(io.err, /alpha\s+minimal\s+medium/, 'each trial is reported as it ends');
});

test('a run cut by a stop keeps what it recorded, and the same command continues with the missing trials only', async () => {
  const m = machine();
  const cut = depsFor(m, { runTrial: fakeRun((trial, number) => (number === 4 ? stopped('cap')() : undefined)) });
  assert.equal(await suiteMain(runArgv(m), ENV, cut.deps), 1);
  assert.match(cut.io.err, /stopped: cap/);
  assert.match(cut.io.err, /run the same command again/);
  assert.deepEqual(keysOf(readDoc(m).trials), PLAN.slice(0, 3), 'what was recorded is kept; the stopped trial records nothing');

  const resumed = depsFor(m);
  assert.equal(await suiteMain(runArgv(m), ENV, resumed.deps), 0, resumed.io.err);
  assert.deepEqual(resumed.deps.runTrial.asked, PLAN.slice(3), 'a recorded trial is never repeated, and the order is the planned one');
  const doc = readDoc(m);
  assert.deepEqual(keysOf(doc.trials), PLAN);
  assert.equal(doc.createdAt, '2026-10-02T12:00:00.000Z');
  assert.deepEqual(doc.stack, STACK);

  const again = depsFor(m);
  assert.equal(await suiteMain(runArgv(m), ENV, again.deps), 0);
  assert.deepEqual(again.deps.runTrial.asked, [], 'a complete run runs nothing');
});

test('a resumed run whose stack or permission mode changed refuses to continue, names what changed, and leaves the file as it was', async () => {
  const m = machine();
  const cut = depsFor(m, { runTrial: fakeRun((trial, number) => (number === 4 ? stopped('cap')() : undefined)) });
  assert.equal(await suiteMain(runArgv(m), ENV, cut.deps), 1);
  const before = fs.readFileSync(resultsFile(m), 'utf8');

  const upgraded = depsFor(m, { readStack: () => ({ ...STACK, engramPlugin: '0.1.6', gentleAi: null }) });
  assert.equal(await suiteMain(runArgv(m), ENV, upgraded.deps), 1);
  assert.match(upgraded.io.err, /engram plugin: 0\.1\.5 -> 0\.1\.6/);
  assert.match(upgraded.io.err, /gentle-ai: 2\.4\.0 -> unknown/);
  assert.match(upgraded.io.err, /--name/, 'it says to use a new name for a new run');
  assert.deepEqual(upgraded.deps.runTrial.asked, []);

  const other = depsFor(m);
  assert.equal(await suiteMain(runArgv(m, { '--permission-mode': 'acceptEdits' }), ENV, other.deps), 1);
  assert.match(other.io.err, /permission mode: bypassPermissions -> acceptEdits/);
  assert.deepEqual(other.deps.runTrial.asked, []);
  assert.equal(fs.readFileSync(resultsFile(m), 'utf8'), before, 'nothing was rewritten');
});

test('a results file that cannot be read is refused untouched, never overwritten', async () => {
  const m = machine();
  for (const content of ['{ this is not json', JSON.stringify({ format: 99, trials: [] }), JSON.stringify([1])]) {
    write(resultsFile(m), content);
    const { io, deps } = depsFor(m);
    assert.equal(await suiteMain(runArgv(m), ENV, deps), 1, content);
    assert.match(io.err, /screen\.json/);
    assert.deepEqual(deps.runTrial.asked, []);
    assert.equal(fs.readFileSync(resultsFile(m), 'utf8'), content);
  }
});

test('--summary prints a recorded run and runs nothing: no token, no work root, no new file', async () => {
  const m = machine();
  const run = depsFor(m);
  assert.equal(await suiteMain(runArgv(m), ENV, run.deps), 0);
  fs.rmSync(m.workRoot, { recursive: true, force: true });
  const { io, deps } = depsFor(m);
  const before = fs.readFileSync(resultsFile(m), 'utf8');
  assert.equal(await suiteMain(['--summary', '--name', 'screen'], {}, deps), 0, io.err);
  assert.match(io.out, /alpha\s+minimal\s+medium\s+1\s+0\.50/);
  assert.match(io.out, /Headroom screen/);
  assert.deepEqual(deps.runTrial.asked, []);
  assert.equal(fs.existsSync(m.workRoot), false);
  assert.equal(fs.readFileSync(resultsFile(m), 'utf8'), before);

  const missing = depsFor(m);
  assert.equal(await suiteMain(['--summary', '--name', 'never-run'], {}, missing.deps), 1);
  assert.match(missing.io.err, /never-run/);
});

// ---- cleanup on every path ---------------------------------------------------------------------------------------

const SCENARIOS = [
  ['a complete run', () => undefined, 0],
  ['a trial that failed', (trial) => ({ status: 'recorded', record: recordFor(trial, { score: 0, error: 'agent-exit-1' }) }), 0],
  ['a cap stop', stopped('cap'), 1],
  ['an auth stop', stopped('auth'), 1],
  ['a spawn stop', stopped('spawn'), 1],
  ['a grader-spawn stop', stopped('grader-spawn'), 1],
  ['a thrown error', () => { throw new Error('the runner exploded'); }, 1],
];

for (const [label, outcome, code] of SCENARIOS) {
  test(`the home template is built once for the current arm and removed after ${label}`, async () => {
    const m = machine();
    const seen = [];
    const { io, deps } = depsFor(m, {
      runTrial: fakeRun((trial, number) => {
        seen.push(templatesIn(m.workRoot).map((name) => fs.existsSync(path.join(m.workRoot, name, 'template', 'template.json'))));
        return number === 1 ? outcome(trial, number) : undefined;
      }),
    });
    assert.equal(await suiteMain(runArgv(m), ENV, deps), code, io.err);
    assert.ok(seen.length > 0 && seen.every((entries) => entries.length === 1 && entries[0] === true), 'while the suite ran there was exactly one template, with its marker');
    assert.deepEqual(templatesIn(m.workRoot), [], 'and afterwards none');
    if (label === 'a thrown error') assert.match(io.err, /the runner exploded/);
  });
}

test('a minimal-only run builds no template at all, and a template that cannot be built stops the suite with nothing left', async () => {
  const m = machine();
  const during = [];
  const { deps } = depsFor(m, { runTrial: fakeRun(() => { during.push(templatesIn(m.workRoot)); }) });
  assert.equal(await suiteMain(runArgv(m, { '--configs': 'minimal' }), ENV, deps), 0);
  assert.ok(during.length > 0 && during.every((entries) => entries.length === 0));

  const broken = machine();
  fs.rmSync(path.join(broken.realHome, '.claude'), { recursive: true });
  const failing = depsFor(broken);
  assert.equal(await suiteMain(runArgv(broken), ENV, failing.deps), 1);
  assert.match(failing.io.err, /no \.claude directory/);
  assert.deepEqual(failing.deps.runTrial.asked, []);
  assert.deepEqual(templatesIn(broken.workRoot), []);
  assert.equal(fs.existsSync(resultsFile(broken)), false, 'a run that never started records nothing');
});

// An interrupt does not end the process at once: the running trial is stopped, and has cleaned up what it made, before
// the template is removed and the process ends with the signal's status. `proc.exit` is a stand-in here that records
// what the machine looked like at that moment.

/** Makes `proc.exit` record `{ code, ...look() }` at the moment it is called, and returns the list of those. */
function recordExits(proc, look) {
  const exits = [];
  proc.exit = (code) => {
    exits.push({ code, ...look() });
    proc.exited.push(code);
  };
  return exits;
}

test('an interrupt aborts the running trial, waits for it, then removes the template and ends the process with the signal\'s status', async () => {
  const m = machine();
  const events = [];
  const { deps, proc } = depsFor(m, {
    runTrial: fakeRun(async (trial, number) => {
      if (number !== 1) return undefined;
      assert.ok(proc.listenerCount('SIGINT') > 0 && proc.listenerCount('SIGTERM') > 0, 'listening while trials run');
      const aborted = new Promise((resolve) => trial.signal.addEventListener('abort', resolve, { once: true }));
      proc.emit('SIGINT', 'SIGINT');
      assert.deepEqual(proc.exited, [], 'the process is not ended by the signal itself');
      await aborted;
      events.push('trial told to stop');
      await new Promise((resolve) => setTimeout(resolve, 50)); // the trial's own cleanup takes time
      events.push(`trial cleaned up, template ${templatesIn(m.workRoot).length === 1 ? 'still' : 'no longer'} there`);
      return { status: 'interrupted' };
    }),
  });
  const exits = recordExits(proc, () => ({ events: [...events], templates: templatesIn(m.workRoot) }));
  assert.equal(await suiteMain(runArgv(m), ENV, deps), 130);
  assert.deepEqual(exits, [{ code: 130, events: ['trial told to stop', 'trial cleaned up, template still there'], templates: [] }]);
  assert.deepEqual(deps.runTrial.asked, [PLAN[0]], 'no trial starts after the interrupt');
  assert.equal(fs.existsSync(resultsFile(m)), false, 'the interrupted trial is not a result');
  assert.equal(proc.listenerCount('SIGINT') + proc.listenerCount('SIGTERM'), 0, 'the listeners are gone after the run');

  const term = depsFor(m, { runTrial: fakeRun(async (trial, number) => { if (number === 1) { term.proc.emit('SIGTERM', 'SIGTERM'); return { status: 'interrupted' }; } return undefined; }) });
  await suiteMain(runArgv(m, { '--name': 'second' }), ENV, term.deps);
  assert.deepEqual(term.proc.exited, [143]);
});

test('an interrupt between trials keeps what was recorded and ends the process with the signal\'s status', async () => {
  const m = machine();
  const { deps, proc } = depsFor(m, { runTrial: fakeRun((trial, number) => { if (number === 2) proc.emit('SIGINT', 'SIGINT'); }) });
  const exits = recordExits(proc, () => ({ templates: templatesIn(m.workRoot) }));
  assert.equal(await suiteMain(runArgv(m), ENV, deps), 130);
  assert.deepEqual(exits, [{ code: 130, templates: [] }]);
  assert.deepEqual(deps.runTrial.asked, PLAN.slice(0, 2), 'the trial that finished after the signal is a result; the next one never starts');
  assert.deepEqual(keysOf(readDoc(m).trials), PLAN.slice(0, 2));
  assert.equal(fs.existsSync(resultsFile(m)), true);
});

test('a second interrupt while the first is still being served removes the template and ends the process at once', async () => {
  const m = machine();
  const { deps, proc } = depsFor(m, {
    runTrial: fakeRun(async () => {
      proc.emit('SIGINT', 'SIGINT');
      proc.emit('SIGINT', 'SIGINT'); // the trial never answers the abort
      await new Promise(() => {});
    }),
  });
  const exits = recordExits(proc, () => ({ templates: templatesIn(m.workRoot) }));
  void suiteMain(runArgv(m), ENV, deps);
  for (let waited = 0; exits.length === 0 && waited < 3000; waited += 20) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(exits, [{ code: 130, templates: [] }]);
});

const isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const waitUntil = async (predicate, ms = 15000) => {
  const deadline = Date.now() + ms;
  while (!predicate() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
  return predicate();
};

test('an interrupt during a real trial against a hanging fake agent leaves nothing of it: no process, no directory, no template, no record, and the exit comes last', async () => {
  const m = machine();
  const events = [];
  const report = path.join(tmp('hang-report'), 'report.json');
  const startedAt = Date.now();
  // The suite's own `runTrial`, with the agent swapped for the fake one (the suite builds the real `claude` argv).
  const hanging = (trial) => runTrial({
    ...trial,
    config: {
      name: trial.config.name,
      command: process.execPath,
      args: [FAKE_AGENT],
      env: { FAKE_AGENT_MODE: 'hang', FAKE_AGENT_REPORT: report },
      prepare: () => ({}),
      cleanup: () => { events.push('cleanup'); },
    },
    readVersion: () => '9.9.9 (Fake Agent)',
    sweep: (roots, options) => { events.push('sweep'); return killByPath(roots, options); },
  });
  const { deps, proc, io } = depsFor(m, { runTrial: hanging });
  let pids = [];
  const exits = recordExits(proc, () => ({
    events: [...events], templates: templatesIn(m.workRoot), entries: fs.readdirSync(m.workRoot), alive: pids.map(isAlive),
  }));
  const pending = suiteMain(runArgv(m), ENV, deps);
  const reported = () => { try { return JSON.parse(fs.readFileSync(report, 'utf8')); } catch { return null; } };
  assert.ok(await waitUntil(() => reported() !== null), `the agent started: ${io.err}`);
  pids = [reported().pid, reported().grandchildPid];
  reaper.pids(pids, { since: startedAt });
  assert.ok(pids.every(isAlive), 'the agent and its grandchild run');
  proc.emit('SIGINT', 'SIGINT');
  assert.equal(await pending, 130);
  assert.deepEqual(exits, [{ code: 130, events: ['sweep', 'cleanup'], templates: [], entries: [], alive: [false, false] }], io.err);
  assert.equal(fs.existsSync(resultsFile(m)), false, 'no record of the trial');
  assert.equal(fs.existsSync(path.join(m.runsDir, 'screen')), false, 'no log of it either');
  assert.ok(await waitUntil(() => pids.every((pid) => !isAlive(pid)), 5000), 'and they stay dead');
});

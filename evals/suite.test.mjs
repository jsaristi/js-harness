import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { readClaudeOutput, readCodexOutput } from './agent-output.mjs';
import { CODEX_TEMPLATE_KIND, DEFAULT_MIN_LOGIN_HOURS_LEFT } from './codex-home.mjs';
import { DELEGATION_MODES, assertWorkRoot, defaultWorkRoot } from './configs.mjs';
import { killByPath, planTrials, resolveAgent, runTrial, trialKey } from './runner.mjs';
import {
  CODEX_EVAL_MODEL, CODEX_PERMISSION_MODE, EVAL_MODEL, TOKEN_VARIABLE, USAGE, UsageError, diffRun, formatSummary, parseArgs, readCodexStack, readStack, suiteMain, summarizeResults,
} from './suite.mjs';
import { reportLines, summarize } from './honesty-report.mjs';
import { createReaper } from '../bin/lib/process-tree.testkit.mjs';
import { readBatch } from '../bin/lib/batch-mark.mjs';

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
  assert.throws(() => parseArgs([...argv(), '--temperature', 'x'], { taskIds: TASKS }), /--temperature/);
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

// Made up for these tests: the commit of the checkout whose `js-harness init` lays out the workspace.
const COMMIT = '0123456789abcdef0123456789abcdef01234567';
const CHECKOUT = path.join('/', 'checkout');
const STACK = { claude: '2.1.284 (Claude Code)', gentleAi: '2.4.0', engram: '2.1.0', engramPlugin: '0.1.5', codegraph: '1.6.2', jsHarness: COMMIT };
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

test('a resumed run on another codegraph or another js-harness commit is named, and a file that recorded neither is too', () => {
  assert.deepEqual(diffRun(RUN, { ...RUN, stack: { ...STACK, codegraph: '1.7.0', jsHarness: `${COMMIT}+dirty` } }), [
    { field: 'codegraph', recorded: '1.6.2', current: '1.7.0' },
    { field: 'js-harness commit', recorded: COMMIT, current: `${COMMIT}+dirty` },
  ]);
  const { codegraph, jsHarness, ...before } = STACK;
  assert.deepEqual(diffRun({ ...RUN, stack: before }, RUN), [
    { field: 'codegraph', recorded: null, current: '1.6.2' },
    { field: 'js-harness commit', recorded: null, current: COMMIT },
  ], 'nothing says what workspace the trials of an older file ran in');
  const codexRun = { agent: 'codex', model: CODEX_EVAL_MODEL, permissionMode: CODEX_PERMISSION_MODE, stack: CODEX_STACK };
  assert.deepEqual(diffRun(codexRun, { ...codexRun, stack: { ...CODEX_STACK, codegraph: null, jsHarness: 'fedcba' } }), [
    { field: 'codegraph', recorded: '1.6.2', current: null },
    { field: 'js-harness commit', recorded: COMMIT, current: 'fedcba' },
  ]);
});

/** A fake machine for the stack probes: a home with the plugin record, and a `spawn` that answers `<tool> version`,
 * and git's questions about the checkout: `commit` for `rev-parse HEAD` (null: git fails) and `changes` for
 * `status` (null: git fails). */
function stackMachine({ plugin = '0.1.5', gentleAi = 'gentle-ai 2.4.0', engram = 'engram v2.1.0', codegraph = '1.6.2', commit = COMMIT, changes = '' } = {}) {
  const home = tmp('stack-home');
  if (plugin !== null) write(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'engram@engram': [{ scope: 'user', version: plugin }], 'codex@openai-codex': [{ version: '9.9.9' }] } }));
  const calls = [];
  const spawn = (command, args) => {
    calls.push([command, args]);
    const name = String(command).split(' ')[0];
    const text = name === 'git' ? (args.includes('rev-parse') ? (commit === null ? null : `${commit}`) : changes) : { 'gentle-ai': gentleAi, engram, codegraph }[name];
    return text === undefined ? { error: Object.assign(new Error('ENOENT'), { code: 'ENOENT' }) } : text === null ? { status: 1, stdout: '' } : { status: 0, stdout: text === '' ? '' : `${text}\n` };
  };
  return { home, spawn, calls };
}

/** The tools a stack probe asked, in order. */
const asked = (machine) => machine.calls.map(([command, args]) => (command === 'git' ? `git ${args.filter((arg) => !arg.startsWith('-') && arg !== CHECKOUT)[0]}` : command));

test('the stack is the CLI, gentle-ai, engram, the engram plugin, codegraph and the js-harness commit, each read where it is written down', () => {
  const machine = stackMachine();
  const stack = readStack({ claude: CLAUDE, home: machine.home, spawn: machine.spawn, platform: 'linux', root: CHECKOUT, probeClaude: (command) => (command === CLAUDE ? '2.1.284 (Claude Code)' : null) });
  assert.deepEqual(stack, STACK);
  assert.deepEqual(asked(machine), ['gentle-ai', 'engram', 'codegraph', 'git rev-parse', 'git status'], 'no other tool is asked');
  const git = machine.calls.filter(([command]) => command === 'git').map(([, args]) => args);
  assert.ok(git.every((args) => args[0] === '-C' && args[1] === CHECKOUT), 'git is asked about the checkout whose init lays out the workspace');
  assert.ok(git[1].includes('--untracked-files=no'), 'a file git does not track is not what init runs');
  assert.ok(git[1].includes(':(exclude)evals/results'), 'the run\'s own results file is not a change to the checkout');
});

test('the js-harness commit says +dirty when a tracked file of the checkout differs from it, and is null when git cannot say', () => {
  const dirty = stackMachine({ changes: ' M bin/init.mjs' });
  assert.equal(readStack({ claude: CLAUDE, home: dirty.home, spawn: dirty.spawn, platform: 'linux', root: CHECKOUT, probeClaude: () => null }).jsHarness, `${COMMIT}+dirty`);
  const noRepo = stackMachine({ commit: null });
  assert.equal(readStack({ claude: CLAUDE, home: noRepo.home, spawn: noRepo.spawn, platform: 'linux', root: CHECKOUT, probeClaude: () => null }).jsHarness, null);
  const noStatus = stackMachine({ changes: null });
  assert.equal(readStack({ claude: CLAUDE, home: noStatus.home, spawn: noStatus.spawn, platform: 'linux', root: CHECKOUT, probeClaude: () => null }).jsHarness, null, 'a commit that cannot be told clean is not recorded as clean');
  const notACommit = stackMachine({ commit: 'HEAD' });
  assert.equal(readStack({ claude: CLAUDE, home: notACommit.home, spawn: notACommit.spawn, platform: 'linux', root: CHECKOUT, probeClaude: () => null }).jsHarness, null);
});

test('by default the js-harness commit is the one of this checkout', () => {
  const machine = stackMachine();
  readStack({ claude: CLAUDE, home: machine.home, spawn: machine.spawn, platform: 'linux', probeClaude: () => null });
  const [, args] = machine.calls.find(([command]) => command === 'git');
  assert.equal(path.resolve(args[1]), path.resolve(fileURLToPath(new URL('..', import.meta.url))));
});

test('a version that cannot be read is null, never a guess', () => {
  const missing = stackMachine({ plugin: null, gentleAi: null, engram: 'no version here', codegraph: null, commit: null });
  assert.deepEqual(readStack({ claude: CLAUDE, home: missing.home, spawn: missing.spawn, platform: 'linux', root: CHECKOUT, probeClaude: () => null }), { claude: null, gentleAi: null, engram: null, engramPlugin: null, codegraph: null, jsHarness: null });
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

test('the summary of a run that is no screen leaves the screen out and says whose the comparison is', () => {
  const summary = summarizeResults(docOf([
    trial('a', 'sub-opus-write', 'medium', 1, { score: 1 }),
    trial('a', 'sub-haiku-write', 'medium', 1, { score: 0.5, inputTokens: null }),
  ], { configs: ['sub-opus-write', 'sub-haiku-write'] }));
  const text = formatSummary(summary, { screen: false });
  assert.match(text, /a\s+sub-opus-write\s+medium\s+1\s+1\.00\s+1\.00\s+1\.00\s+1\.2k\s+1m00s/);
  assert.match(text, /a\s+sub-haiku-write\s+medium\s+1\s+0\.50\s+0\.50\s+0\.50\s+unknown\s+1m00s/);
  // The screen reads the minimal config alone, so it would call every task of this run incomplete.
  assert.doesNotMatch(text, /Headroom|incomplete|minimal/);
  assert.match(text, /^The comparison of the two arms is evals\/subagents-report\.mjs's\.$/m);
  assert.match(formatSummary(summary), /Headroom screen/, 'the screen stays the default');
  assert.equal(formatSummary(summarizeResults(docOf([])), { screen: false }), 'no trial recorded yet\n');
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

  // A terminal that closes sends SIGHUP: the suite owns the trial's signals, so it must stop the agent on this one too.
  const hup = depsFor(m, { runTrial: fakeRun(async (trial, number) => { if (number === 1) { hup.proc.emit('SIGHUP', 'SIGHUP'); return { status: 'interrupted' }; } return undefined; }) });
  await suiteMain(runArgv(m, { '--name': 'third' }), ENV, hup.deps);
  assert.deepEqual(hup.proc.exited, [129]);
  assert.equal(hup.proc.listenerCount('SIGHUP'), 0, 'the listener is gone after the run');
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

// Whether the processes a test recorded with `reaper.pids` still run is asked of the reaper (`look`), which knows each
// by its pid AND its creation time. A number alone cannot say: Windows gives a dead process's pid to the next process
// at once, and the runner starts PowerShell processes right after its kill, so a number that answers may be theirs.
const waitUntil = async (predicate, ms = 15000) => {
  const deadline = Date.now() + ms;
  while (!predicate() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
  return predicate();
};

test('an interrupt during a real trial against a hanging fake agent leaves nothing of it: no process, no directory, no template, no record, and the exit comes last', async (t) => {
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
  // What answered to the two numbers at the exit: the recorded process still running (a failure, which then says what
  // it is) or another process that was given the number (no failure, and written down all the same).
  const answered = [];
  const exits = recordExits(proc, () => {
    const looks = reaper.look(pids);
    answered.push(...looks.filter(({ found }) => found !== null).map(({ found }) => found));
    return { events: [...events], templates: templatesIn(m.workRoot), entries: fs.readdirSync(m.workRoot), alive: looks.map(({ alive }) => alive) };
  });
  const pending = suiteMain(runArgv(m), ENV, deps);
  const reported = () => { try { return JSON.parse(fs.readFileSync(report, 'utf8')); } catch { return null; } };
  assert.ok(await waitUntil(() => reported() !== null), `the agent started: ${io.err}`);
  pids = [reported().pid, reported().grandchildPid];
  reaper.pids(pids, { since: startedAt }); // each pid with its creation time, which is what `look` compares from here on
  assert.ok(reaper.look(pids).every(({ alive }) => alive), 'the agent and its grandchild run');
  proc.emit('SIGINT', 'SIGINT');
  assert.equal(await pending, 130);
  for (const line of answered) t.diagnostic(`at the exit, ${line}`);
  assert.deepEqual(exits, [{ code: 130, events: ['sweep', 'cleanup'], templates: [], entries: [], alive: [false, false] }], [io.err, ...answered].join('\n'));
  assert.equal(fs.existsSync(resultsFile(m)), false, 'no record of the trial');
  assert.equal(fs.existsSync(path.join(m.runsDir, 'screen')), false, 'no log of it either');
  assert.ok(await waitUntil(() => reaper.look(pids).every(({ alive }) => !alive), 5000), 'and they stay dead');
});

// ---- the same suite on the Codex CLI ----------------------------------------------------------------------------------
// As above, nothing here starts a real CLI or calls a model: `--codex` names a stand-in file, the login is a file made
// up for the test in the scratch directory, and the trials are the stand-in `runTrial` or the fake agent.

const CODEX = path.join(scratch, 'bin', 'codex.exe');
const CODEX_FULL = { '--agent': 'codex', '--codex': CODEX, '--configs': 'minimal,current', '--efforts': 'medium,high', '--repeats': '3', '--tasks': 'all', '--name': 'ab-run' };
const flagsOf = (flags) => Object.entries(flags).filter(([, value]) => value !== undefined).flatMap(([flag, value]) => [flag, value]);
const codexArgv = (changes = {}) => flagsOf({ ...CODEX_FULL, ...changes });
const parseCodex = (changes) => parseArgs(codexArgv(changes), { taskIds: TASKS });
const usageError = (pattern) => (error) => error instanceof UsageError && pattern.test(error.message);

test('--agent has one default, claude: a command line without it means what it meant before a second agent existed', () => {
  assert.deepEqual(parseArgs(['--agent', 'claude', ...argv()], { taskIds: TASKS }), parse(), 'naming the default changes nothing');
  assert.equal('agent' in parse(), false, 'and the default is not written into what is parsed');
  assert.deepEqual(parseArgs(['--agent', 'claude', '--summary', '--name', 'screen'], { taskIds: TASKS }), { mode: 'summary', name: 'screen' });
  for (const agent of ['gemini', 'Codex', 'claude,codex']) assert.throws(() => parse({ '--agent': agent }), usageError(/--agent .*claude, codex/), agent);
  assert.throws(() => parseArgs([...argv(), '--codex', CODEX], { taskIds: TASKS }), usageError(/--codex .*--agent codex/), 'the Codex binary is not taken by a Claude run');
});

test('a full --agent codex command parses into the binary, the arms, the efforts, the repeats, the tasks and the name, and has no permission mode', () => {
  assert.deepEqual(parseCodex(), {
    mode: 'run', agent: 'codex', codex: CODEX, configs: ['minimal', 'current'], efforts: ['medium', 'high'], repeats: 3, tasks: TASKS, name: 'ab-run', workRoot: null,
  });
  assert.equal(parseCodex({ '--work-root': path.join(scratch, 'work'), '--efforts': 'high' }).workRoot, path.join(scratch, 'work'));
  for (const flag of Object.keys(CODEX_FULL).filter((name) => name !== '--agent')) {
    assert.throws(() => parseCodex({ [flag]: undefined }), usageError(new RegExp(`${flag} is required`)), flag);
  }
  assert.throws(() => parseCodex({ '--claude': CLAUDE }), usageError(/--claude .*--codex/), 'the other agent\'s binary is refused');
  assert.throws(() => parseCodex({ '--permission-mode': 'bypassPermissions' }), usageError(/--permission-mode .*--dangerously-bypass-approvals-and-sandbox/), 'the Codex arms have one fixed mode');
});

test('--codex is an absolute path to the real binary, never a shim, and a Codex run takes the efforts of the F6 matrix only', () => {
  for (const codex of ['codex', 'bin/codex', 'C:\\x\\codex.cmd', path.join(scratch, 'codex.BAT'), path.join(scratch, 'codex.ps1')]) {
    assert.throws(() => parseCodex({ '--codex': codex }), usageError(/--codex/), codex);
  }
  assert.deepEqual(parseCodex({ '--efforts': 'high,medium' }).efforts, ['high', 'medium']);
  for (const effort of ['low', 'xhigh', 'max', 'minimal']) assert.throws(() => parseCodex({ '--efforts': `medium,${effort}` }), usageError(new RegExp(`${effort}.*medium, high`)), effort);
  assert.deepEqual(parse({ '--efforts': 'low,xhigh,max' }).efforts, ['low', 'xhigh', 'max'], 'the efforts of a Claude run are the ones they were');
});

test('--summary takes --agent too, so a recorded Codex run can be read', () => {
  assert.deepEqual(parseArgs(['--agent', 'codex', '--summary', '--name', 'screen'], { taskIds: TASKS }), { mode: 'summary', agent: 'codex', name: 'screen' });
  assert.throws(() => parseArgs(['--agent', 'codex', '--summary', '--name', 'screen', '--codex', CODEX], { taskIds: TASKS }), usageError(/--summary .*--codex/));
});

const CODEX_STACK = { codex: 'codex-cli 0.159.1', gentleAi: '2.4.0', engram: '2.1.0', codegraph: '1.6.2', jsHarness: COMMIT };
const CODEX_RUN = { agent: 'codex', model: 'gpt-6.1-sol', permissionMode: 'dangerously-bypass-approvals-and-sandbox', stack: CODEX_STACK };

test('a resumed Codex run that differs in the agent, the model or a version is named change by change', () => {
  assert.deepEqual(diffRun(CODEX_RUN, { ...CODEX_RUN, stack: { ...CODEX_STACK } }), []);
  assert.deepEqual(diffRun(CODEX_RUN, { ...CODEX_RUN, model: 'gpt-other', stack: { ...CODEX_STACK, codex: 'codex-cli 0.160.0', engram: null } }), [
    { field: 'codex', recorded: 'codex-cli 0.159.1', current: 'codex-cli 0.160.0' },
    { field: 'engram', recorded: '2.1.0', current: null },
    { field: 'model', recorded: 'gpt-6.1-sol', current: 'gpt-other' },
  ]);
  // A document that names no agent is a Claude run: every one F5 recorded.
  assert.deepEqual(diffRun(RUN, CODEX_RUN).find((change) => change.field === 'agent'), { field: 'agent', recorded: 'claude', current: 'codex' });
  assert.deepEqual(diffRun(CODEX_RUN, RUN).find((change) => change.field === 'agent'), { field: 'agent', recorded: 'codex', current: 'claude' });
  assert.deepEqual(diffRun(RUN, { ...RUN, agent: 'claude' }), [], 'and naming it changes nothing');
});

test('the Codex stack is the CLI asked under a sandbox environment in a throwaway home of the work root, with gentle-ai, engram, codegraph and the js-harness commit as for Claude Code', async () => {
  const tools = stackMachine();
  const workRoot = path.join(tmp('stack-work'), 'not-there-yet');
  const probes = [];
  const released = [];
  const stack = await readCodexStack({
    codex: CODEX, workRoot, spawn: tools.spawn, platform: 'linux', root: CHECKOUT,
    probeCodex: (command, env) => {
      probes.push({ command, env, there: [env.HOME, env.CODEX_HOME, env.TEMP].map((dir) => fs.statSync(dir).isDirectory()), login: fs.existsSync(path.join(env.CODEX_HOME, 'auth.json')) });
      return 'codex-cli 0.159.1';
    },
    allocatePort: async () => 41000, releasePort: (port) => released.push(port),
  });
  assert.deepEqual(stack, CODEX_STACK);
  assert.deepEqual(asked(tools), ['gentle-ai', 'engram', 'codegraph', 'git rev-parse', 'git status'], 'no other tool is asked');
  assert.equal(probes.length, 1);
  const [{ command, env, there, login }] = probes;
  assert.equal(command, CODEX);
  assert.equal(path.dirname(env.HOME), workRoot, 'the home is a directory of the work root, never the real one');
  assert.deepEqual([env.USERPROFILE, env.CODEX_HOME, env.ENGRAM_PORT], [env.HOME, path.join(env.HOME, '.codex'), '41000'], 'the environment a trial gets');
  assert.deepEqual(there, [true, true, true], 'what Codex writes when it is asked its version has somewhere to go');
  assert.equal(login, false, 'and no login is put there for it');
  assert.deepEqual(fs.readdirSync(workRoot), [], 'the throwaway home is removed');
  assert.deepEqual(released, [41000]);
});

test('a Codex version that cannot be read is null, and the throwaway home and its port are given back whatever the probe does', async () => {
  const tools = stackMachine({ gentleAi: null, engram: 'no version here', codegraph: 'no version here', changes: null });
  const workRoot = tmp('stack-work');
  const released = [];
  const ports = { allocatePort: async () => 41001, releasePort: (port) => released.push(port) };
  assert.deepEqual(await readCodexStack({ codex: CODEX, workRoot, spawn: tools.spawn, platform: 'linux', probeCodex: () => null, ...ports }), { codex: null, gentleAi: null, engram: null, codegraph: null, jsHarness: null });
  await assert.rejects(readCodexStack({ codex: CODEX, workRoot, spawn: tools.spawn, platform: 'linux', probeCodex: () => { throw new Error('the probe exploded'); }, ...ports }), /the probe exploded/);
  assert.deepEqual(fs.readdirSync(workRoot), []);
  assert.deepEqual(released, [41001, 41001]);
  // The default probe is the binary's own first line of --version, here node's.
  const real = await readCodexStack({ codex: process.execPath, workRoot, spawn: stackMachine().spawn, platform: 'linux' });
  assert.equal(real.codex, `v${process.versions.node}`);
  assert.deepEqual(fs.readdirSync(workRoot), []);
});

const NOW = new Date('2026-10-02T12:00:00.000Z');
const HOUR = 3_600_000;
// Made up for these tests: no login of anything.
const FAKE_LOGIN = 'FAKE-CODEX-LOGIN-never-in-a-stream-or-a-template-0123456789';
const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
/** A made-up access token in the shape of a JWT, `header.payload.signature`, that expires `hoursLeft` after the
 * clock the suite is given. Its signature is the made-up login, and its payload holds it as another claim. */
const fakeAccessToken = (hoursLeft) => `${base64url({ alg: 'none' })}.${base64url({ sub: FAKE_LOGIN, exp: (NOW.getTime() + hoursLeft * HOUR) / 1000 })}.${FAKE_LOGIN}`;
/** The text of a login file whose access token has `hoursLeft` hours left. */
const fakeLogin = (hoursLeft) => JSON.stringify({ made_up: FAKE_LOGIN, tokens: { access_token: fakeAccessToken(hoursLeft), refresh_token: FAKE_LOGIN } });
/** What no stream may hold of the login text `login`: the made-up login, and each part of its access token. */
const loginSecrets = (login) => [FAKE_LOGIN, ...(JSON.parse(login).tokens?.access_token ?? '').split('.')].filter((text) => text.length >= 8);

/** A fake machine whose real home also holds a Codex setup: a config, global instructions and a login, which is the
 * text `login` (default: one whose access token has two days left by the clock the suite is given; `null`: no login
 * at all), last written `loginAgeHours` before that clock. */
function codexMachine({ login = fakeLogin(48), loginAgeHours = 24, config = 'model = "gpt-6.1-sol"\n' } = {}) {
  const m = machine();
  const codexHome = path.join(m.realHome, '.codex');
  write(path.join(codexHome, 'config.toml'), config);
  write(path.join(codexHome, 'AGENTS.md'), '# the global rules of Codex\n');
  const authFile = path.join(codexHome, 'auth.json');
  if (login !== null) {
    write(authFile, login);
    const written = new Date(NOW.getTime() - loginAgeHours * HOUR);
    fs.utimesSync(authFile, written, written);
  }
  const codex = path.join(m.base, 'bin', 'codex.exe');
  write(codex, 'a stand-in binary');
  return { ...m, codex, authFile };
}

/** The deps of a Codex run on `m`: the Codex stack is a stand-in, and reading Claude Code's is a failure. */
const codexDeps = (m, extra = {}) => depsFor(m, {
  readStack: () => { throw new Error('the stack of Claude Code was read for a Codex run'); },
  readCodexStack: () => ({ ...CODEX_STACK }),
  ...extra,
});
/** The argv of a Codex run of the machine's own tasks: the 8 trials of `PLAN`. */
const codexRunArgv = (m, changes = {}) => codexArgv({ '--codex': m.codex, '--repeats': '1', '--name': 'screen', '--work-root': m.workRoot, ...changes });
const codexResultsFile = (m, name = 'screen') => path.join(m.resultsDir, 'codex', `${name}.json`);
const readCodexDoc = (m, name) => JSON.parse(fs.readFileSync(codexResultsFile(m, name), 'utf8'));

test('a Codex run needs no token and keeps everything in a codex directory of its own: the results, the raw logs and what the run was', async () => {
  const m = codexMachine();
  const asked = [];
  const { io, deps } = codexDeps(m, { readCodexStack: ({ codex, workRoot }) => { asked.push({ codex, workRoot }); return { ...CODEX_STACK }; } });
  const saved = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  process.env.CLAUDE_CODE_OAUTH_TOKEN = 'inherited-oauth-token';
  try {
    assert.equal(await suiteMain(codexRunArgv(m), ENV, deps), 0, io.err);
    assert.deepEqual(fs.readdirSync(m.resultsDir), ['codex'], 'nothing is written beside the results of the Claude runs');
    assert.deepEqual(fs.readdirSync(path.join(m.resultsDir, 'codex')), ['screen.json'], 'no temporary file is left');
    const doc = readCodexDoc(m);
    assert.match(doc.setup?.sha256 ?? '', /^[0-9a-f]{64}$/, 'the setup of the current arm, the fingerprint of its Codex template');
    assert.ok(Object.keys(doc.setup.items).some((item) => item.startsWith('.codex/')), JSON.stringify(doc.setup.items));
    assert.deepEqual({ ...doc, trials: keysOf(doc.trials) }, {
      format: 1, name: 'screen', createdAt: '2026-10-02T12:00:00.000Z', ...CODEX_RUN,
      args: { codex: m.codex, configs: ['minimal', 'current'], efforts: ['medium', 'high'], repeats: 1, tasks: ['alpha', 'beta'], workRoot: m.workRoot },
      trials: PLAN, setup: doc.setup,
    });
    assert.deepEqual(deps.runTrial.asked, PLAN);
    assert.deepEqual(asked, [{ codex: m.codex, workRoot: m.workRoot }], 'the version is asked once, of this binary, in the work root that was checked');
    assert.ok(deps.runTrial.trials.every((trial) => trial.runsDir === path.join(m.runsDir, 'codex', 'screen')), 'the raw logs of a Codex run are under runs/codex/<name>/');
    assert.ok(io.out.includes(`results: ${codexResultsFile(m)}`), 'the summary names the file');
    assert.match(io.out, /Headroom screen/);

    const configs = new Map(deps.runTrial.trials.map((trial) => [trial.config.name, trial.config]));
    assert.deepEqual([...configs.keys()].sort(), ['current', 'minimal']);
    const home = path.join(m.base, 'home');
    const workspace = path.join(m.base, 'ws');
    for (const [name, config] of configs) {
      const agent = resolveAgent(config, { effort: 'high', home, workspace, prepared: { engramPort: 41000 } });
      assert.equal(agent.command, m.codex, name);
      assert.deepEqual(
        agent.args.slice(0, 11),
        ['exec', '--json', '--ephemeral', '--skip-git-repo-check', '-m', CODEX_EVAL_MODEL, '-c', 'model_reasoning_effort="high"', `--${CODEX_PERMISSION_MODE}`, '-C', workspace],
        `${name}: the model, the effort and the one permission mode the results file records`,
      );
      assert.equal(agent.env.CODEX_HOME, path.join(home, '.codex'), `${name}: a CODEX_HOME of the trial's own`);
      assert.equal(agent.env.CLAUDE_CODE_OAUTH_TOKEN, null, `${name}: no token of the other agent, neither the inherited one nor the eval's`);
      assert.equal(config.reader, readCodexOutput, `${name}: read as Codex's output`);
      assert.ok(!JSON.stringify([agent.args, agent.env]).includes(FAKE_TOKEN));
    }
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    else process.env.CLAUDE_CODE_OAUTH_TOKEN = saved;
  }
});

test('a wrong Codex command line prints the usage, which states it, and exits 2 before anything is created', async () => {
  const m = codexMachine();
  for (const [changes, pattern] of [[{ '--permission-mode': 'bypassPermissions' }, /--permission-mode/], [{ '--efforts': 'medium,xhigh' }, /xhigh/], [{ '--codex': undefined }, /--codex is required/]]) {
    const { io, deps } = codexDeps(m);
    assert.equal(await suiteMain(codexRunArgv(m, changes), {}, deps), 2, JSON.stringify(changes));
    assert.match(io.err, pattern);
    assert.ok(io.err.includes(USAGE), 'the usage is printed');
    assert.deepEqual(deps.runTrial.asked, []);
  }
  const missing = codexDeps(m, { fileExists: () => false });
  assert.equal(await suiteMain(codexRunArgv(m), {}, missing.deps), 2);
  assert.match(missing.io.err, /--codex .* does not exist/);
  nothingCreated(m);
  assert.match(USAGE, /node evals\/suite\.mjs --agent codex --codex <path> --configs <minimal,current> --efforts <medium,high> --repeats <n>/);
  assert.match(USAGE, /node evals\/suite\.mjs \[--agent codex\] --summary --name <run name>/);
  assert.match(USAGE, /evals\/results\/codex\/<name>\.json/);
});

test('a Codex login that is missing, near its expiry, expired or without an expiry to read stops the run before anything is read, built or run, and says what to do', async () => {
  const logInAgain = 'run `codex logout`, then `codex login`, then run again';
  for (const [label, login, pattern, todo] of [
    ['missing', null, /there is no Codex login at .*auth\.json/, 'run `codex login` first'],
    ['near its expiry', fakeLogin(DEFAULT_MIN_LOGIN_HOURS_LEFT - 4), /expires at 2026-10-02T20:00:00\.000Z, in 8\.0 hours: a run starts only while it has at least 12 hours left/, logInAgain],
    ['expired', fakeLogin(-5), /expired at 2026-10-02T07:00:00\.000Z, 5\.0 hours ago/, logInAgain],
    ['without an access token', JSON.stringify({ made_up: FAKE_LOGIN }), /holds no access token.*so when it expires cannot be told/, logInAgain],
    ['not JSON', `not json ${FAKE_LOGIN}`, /is not JSON, so when it expires cannot be told/, logInAgain],
  ]) {
    const m = codexMachine({ login });
    const stacks = [];
    const { io, deps } = codexDeps(m, { readCodexStack: () => { stacks.push('read'); return { ...CODEX_STACK }; } });
    assert.equal(await suiteMain(codexRunArgv(m), {}, deps), 2, label);
    assert.match(io.err, pattern, label);
    assert.ok(io.err.toLowerCase().includes(todo), `${label}: what to do`);
    assert.match(io.err, /no trial was started/i, label);
    assert.ok(!io.err.includes(USAGE), `${label}: the command line was right, so the usage is not what to read`);
    assert.equal(io.out, '');
    assert.deepEqual([deps.runTrial.asked, stacks], [[], []], `${label}: nothing was run and no version was asked`);
    nothingCreated(m);
    const secrets = login === null || label === 'not JSON' ? [FAKE_LOGIN] : loginSecrets(login);
    for (const secret of secrets) assert.ok(!(io.err + io.out).includes(secret), `${label}: nothing of the login is printed but its dates`);
  }
  // With the hours left it is used, however old its file is, and the run says what it had left.
  const login = fakeLogin(DEFAULT_MIN_LOGIN_HOURS_LEFT + 1);
  const m = codexMachine({ login, loginAgeHours: 192 });
  const { io, deps } = codexDeps(m);
  assert.equal(await suiteMain(codexRunArgv(m, { '--configs': 'minimal' }), {}, deps), 0, io.err);
  assert.match(io.err, /Codex login: its access token has 13\.0 hours left, until 2026-10-03T01:00:00\.000Z \(a run needs at least 12\)/);
  for (const secret of loginSecrets(login)) assert.ok(!(io.err + io.out).includes(secret), 'nothing of the login is printed but its dates');
  assert.equal(fs.statSync(m.authFile).mtimeMs, NOW.getTime() - 192 * HOUR, 'and the real login is left as it was');
  assert.equal(fs.readFileSync(m.authFile, 'utf8'), login);
  assert.match(USAGE, /A run starts only while that token has at least 12 hours left/);
  assert.match(USAGE, /run `codex logout`, then `codex login`, then run again/);
});

/** The deps of a Codex run on `m` whose stack is read by the real `readCodexStack`, in the work root of the run:
 * only the probe is a stand-in, answering `version()` (which may throw), and so are the two tools and the port. */
const probingDeps = (m, version, extra = {}) => codexDeps(m, {
  readCodexStack: (options) => readCodexStack({
    ...options, spawn: stackMachine().spawn, platform: 'linux', probeCodex: () => version(), allocatePort: async () => 41002, releasePort: () => {},
  }),
  ...extra,
});

test('a Codex run whose Codex version cannot be read is refused, exit 2, before the template, the login copy and any trial: a new run and a resume alike', async () => {
  const m = codexMachine();
  fs.mkdirSync(m.workRoot, { recursive: true });
  const refused = (io, label) => {
    assert.match(io.err, /the version of Codex could not be read/i, label);
    assert.ok(io.err.includes(`${m.codex} --version`), `${label}: it says what was run to read it`);
    assert.match(io.err, /no trial was started/i, label);
    assert.ok(!io.err.includes(USAGE), `${label}: the command line was right, so the usage is not what to read`);
    assert.equal(io.out, '', label);
    assert.deepEqual(fs.readdirSync(m.workRoot), [], `${label}: no template was built, and the home of the probe is gone`);
    assert.equal(fs.existsSync(m.runsDir), false, `${label}: no raw log`);
    assert.ok(!(io.err + io.out).includes(FAKE_LOGIN), `${label}: nothing of the login is printed`);
  };

  const fresh = probingDeps(m, () => null);
  assert.equal(await suiteMain(codexRunArgv(m), {}, fresh.deps), 2, fresh.io.err);
  refused(fresh.io, 'a new run');
  assert.deepEqual(fresh.deps.runTrial.asked, [], 'a new run: nothing was run');
  assert.equal(fs.existsSync(m.resultsDir), false, 'a new run records nothing, so no run exists with an unknown version');

  // The case the refusal exists for: a run recorded with no Codex version, continued where the version cannot be
  // read either. Unknown would equal unknown, and the two halves could be two CLIs.
  const recorded = { format: 1, name: 'screen', createdAt: NOW.toISOString(), ...CODEX_RUN, stack: { ...CODEX_STACK, codex: null }, args: null, trials: [recordFor({ task: { id: 'alpha' }, config: { name: 'minimal' }, effort: 'medium', repeat: 1 })] };
  write(codexResultsFile(m), `${JSON.stringify(recorded, null, 2)}\n`);
  const before = fs.readFileSync(codexResultsFile(m), 'utf8');
  const resumed = probingDeps(m, () => null);
  assert.equal(await suiteMain(codexRunArgv(m), {}, resumed.deps), 2, resumed.io.err);
  refused(resumed.io, 'a resume');
  assert.deepEqual(resumed.deps.runTrial.asked, [], 'a resume: nothing was run');
  assert.equal(fs.readFileSync(codexResultsFile(m), 'utf8'), before, 'a resume: the recorded run is left as it was');

  // With a version that can be read, the same machine runs.
  const readable = probingDeps(m, () => 'codex-cli 0.159.1');
  assert.equal(await suiteMain(codexRunArgv(m, { '--name': 'readable', '--configs': 'minimal' }), {}, readable.deps), 0, readable.io.err);
  assert.deepEqual(readCodexDoc(m, 'readable').stack, CODEX_STACK);
});

test('a Codex run that does not go on removes the work root its version probe made, and never one that was already there', async () => {
  const m = codexMachine();
  // Two levels that are not there: making the work root makes its parent too.
  const parent = path.join(m.base, 'not-there-yet');
  const workRoot = path.join(parent, 'work');
  const argvOf = (changes = {}) => codexRunArgv(m, { '--work-root': workRoot, '--configs': 'minimal', ...changes });

  const unreadable = probingDeps(m, () => null);
  assert.equal(await suiteMain(argvOf(), {}, unreadable.deps), 2, unreadable.io.err);
  assert.equal(fs.existsSync(parent), false, 'a version that cannot be read: what the probe made is removed');

  const exploding = probingDeps(m, () => { throw new Error('the probe exploded'); });
  assert.equal(await suiteMain(argvOf(), {}, exploding.deps), 1);
  assert.match(exploding.io.err, /the suite failed: the probe exploded/);
  assert.equal(fs.existsSync(parent), false, 'a probe that throws: what it made is removed');

  // A run that goes on keeps the work root it made: its trials run there.
  const first = probingDeps(m, () => 'codex-cli 0.159.1', { runTrial: fakeRun((trial, number) => (number === 2 ? stopped('cap')() : undefined)) });
  assert.equal(await suiteMain(argvOf(), {}, first.deps), 1);
  assert.deepEqual(fs.readdirSync(workRoot), [], 'the work root of a run that started is kept, with nothing of the probe in it');

  // The same run, continued on another CLI after its work root was cleared away: refused, and nothing is left.
  fs.rmSync(parent, { recursive: true, force: true });
  const upgraded = probingDeps(m, () => 'codex-cli 0.160.0');
  assert.equal(await suiteMain(argvOf(), {}, upgraded.deps), 1);
  assert.match(upgraded.io.err, /codex: codex-cli 0\.159\.1 -> codex-cli 0\.160\.0/);
  assert.equal(fs.existsSync(parent), false, 'a refused resume: what the probe made is removed');

  // A work root that was there is not this run's to remove, empty or not.
  fs.mkdirSync(workRoot, { recursive: true });
  for (const version of ['codex-cli 0.160.0', null]) {
    const refused = probingDeps(m, () => version);
    assert.notEqual(await suiteMain(argvOf(), {}, refused.deps), 0);
    assert.deepEqual(fs.readdirSync(workRoot), [], `${version}: the work root that existed is still there`);
  }
  // And a parent that was there stays when only the work root was made.
  fs.rmdirSync(workRoot);
  const again = probingDeps(m, () => null);
  assert.equal(await suiteMain(argvOf(), {}, again.deps), 2);
  assert.deepEqual([fs.existsSync(workRoot), fs.existsSync(parent)], [false, true], 'only what was made is removed');
});

/** What the Codex template under `workRoot` looks like right now, one entry per template found. */
const codexTemplates = (workRoot) => templatesIn(workRoot).map((name) => {
  const dir = path.join(workRoot, name, 'template');
  return {
    kind: JSON.parse(fs.readFileSync(path.join(dir, 'template.json'), 'utf8')).kind,
    instructions: fs.existsSync(path.join(dir, 'home', '.codex', 'AGENTS.md')),
    login: fs.existsSync(path.join(dir, 'home', '.codex', 'auth.json')),
  };
});

for (const [label, outcome, code] of [['a complete run', () => undefined, 0], ['a cap stop', stopped('cap'), 1], ['a thrown error', () => { throw new Error('the runner exploded'); }, 1]]) {
  test(`the Codex home template is built once for the current arm, without the login, and removed after ${label}`, async () => {
    const m = codexMachine();
    const seen = [];
    const { io, deps } = codexDeps(m, {
      runTrial: fakeRun((trial, number) => {
        seen.push(codexTemplates(m.workRoot));
        return number === 1 ? outcome(trial, number) : undefined;
      }),
    });
    assert.equal(await suiteMain(codexRunArgv(m), {}, deps), code, io.err);
    assert.ok(seen.length > 0, 'a trial ran');
    for (const templates of seen) assert.deepEqual(templates, [{ kind: CODEX_TEMPLATE_KIND, instructions: true, login: false }], 'exactly one template, of the Codex kind, while the suite ran');
    assert.deepEqual(fs.readdirSync(m.workRoot), [], 'and afterwards nothing of the suite is left in the work root');
  });
}

test('a minimal-only Codex run builds no template, and a Codex setup the template cannot be built from stops the suite with nothing left', async () => {
  const m = codexMachine();
  const during = [];
  const { deps } = codexDeps(m, { runTrial: fakeRun(() => { during.push(templatesIn(m.workRoot)); }) });
  assert.equal(await suiteMain(codexRunArgv(m, { '--configs': 'minimal' }), {}, deps), 0);
  assert.ok(during.length > 0 && during.every((entries) => entries.length === 0));

  // A value that does not end on its line is one the config scan refuses (`codex-home.mjs`).
  const broken = codexMachine({ config: 'notify = [\n  "a-program",\n]\n' });
  const failing = codexDeps(broken);
  assert.equal(await suiteMain(codexRunArgv(broken), {}, failing.deps), 1);
  assert.match(failing.io.err, /the suite failed: .*config\.toml line 1 /);
  assert.deepEqual(failing.deps.runTrial.asked, []);
  assert.deepEqual(templatesIn(broken.workRoot), []);
  assert.equal(fs.existsSync(codexResultsFile(broken)), false, 'a run that never started records nothing');
});

test('a Codex run cut by a stop continues with the missing trials only, and one whose agent, model or stack changed is refused with the file left as it was', async () => {
  const m = codexMachine();
  const cut = codexDeps(m, { runTrial: fakeRun((trial, number) => (number === 4 ? stopped('cap')() : undefined)) });
  assert.equal(await suiteMain(codexRunArgv(m), {}, cut.deps), 1);
  assert.match(cut.io.err, /stopped: cap/);
  assert.deepEqual(keysOf(readCodexDoc(m).trials), PLAN.slice(0, 3));
  const before = fs.readFileSync(codexResultsFile(m), 'utf8');

  const upgraded = codexDeps(m, { readCodexStack: () => ({ ...CODEX_STACK, codex: 'codex-cli 0.160.0', engram: null }) });
  assert.equal(await suiteMain(codexRunArgv(m), {}, upgraded.deps), 1);
  assert.match(upgraded.io.err, /codex: codex-cli 0\.159\.1 -> codex-cli 0\.160\.0/);
  assert.match(upgraded.io.err, /engram: 2\.1\.0 -> unknown/);
  assert.match(upgraded.io.err, /--name/, 'it says to use a new name for a new run');
  assert.deepEqual(upgraded.deps.runTrial.asked, []);
  assert.deepEqual(templatesIn(m.workRoot), [], 'no template was built for a run that is refused');
  assert.equal(fs.readFileSync(codexResultsFile(m), 'utf8'), before, 'nothing was rewritten');

  // A file under a Codex name that another model, or Claude Code, recorded: never continued as a Codex run.
  const recorded = JSON.parse(before);
  write(codexResultsFile(m, 'other-model'), JSON.stringify({ ...recorded, name: 'other-model', model: 'gpt-other' }));
  const otherModel = codexDeps(m);
  assert.equal(await suiteMain(codexRunArgv(m, { '--name': 'other-model' }), {}, otherModel.deps), 1);
  assert.match(otherModel.io.err, /model: gpt-other -> gpt-6\.1-sol/);
  const { agent: _agent, ...unnamed } = recorded;
  write(codexResultsFile(m, 'moved'), JSON.stringify({ ...unnamed, name: 'moved', model: EVAL_MODEL, permissionMode: 'bypassPermissions', stack: STACK }));
  const moved = codexDeps(m);
  assert.equal(await suiteMain(codexRunArgv(m, { '--name': 'moved' }), {}, moved.deps), 1);
  assert.match(moved.io.err, /agent: claude -> codex/);
  assert.deepEqual([otherModel.deps.runTrial.asked, moved.deps.runTrial.asked], [[], []]);

  const resumed = codexDeps(m);
  assert.equal(await suiteMain(codexRunArgv(m), {}, resumed.deps), 0, resumed.io.err);
  assert.deepEqual(resumed.deps.runTrial.asked, PLAN.slice(3), 'a recorded trial is never repeated');
  assert.deepEqual(keysOf(readCodexDoc(m).trials), PLAN);
});

test('--agent codex --summary prints a recorded Codex run and runs nothing, and neither agent\'s summary reads the other\'s runs', async () => {
  const m = codexMachine();
  const run = codexDeps(m);
  assert.equal(await suiteMain(codexRunArgv(m), {}, run.deps), 0);
  const before = fs.readFileSync(codexResultsFile(m), 'utf8');
  // No login is needed to read a results file.
  fs.rmSync(m.authFile);
  const { io, deps } = codexDeps(m, { readCodexStack: () => { throw new Error('a summary asks no version'); } });
  assert.equal(await suiteMain(['--agent', 'codex', '--summary', '--name', 'screen'], {}, deps), 0, io.err);
  assert.match(io.out, /alpha\s+minimal\s+medium\s+1\s+0\.50/);
  assert.deepEqual(deps.runTrial.asked, []);
  assert.equal(fs.readFileSync(codexResultsFile(m), 'utf8'), before);

  const claude = depsFor(m);
  assert.equal(await suiteMain(['--summary', '--name', 'screen'], {}, claude.deps), 1, 'the Claude results hold no run of that name');
  assert.ok(claude.io.err.includes(`no results named screen in ${m.resultsDir}`));
  const missing = codexDeps(m);
  assert.equal(await suiteMain(['--agent', 'codex', '--summary', '--name', 'never-run'], {}, missing.deps), 1);
  assert.ok(missing.io.err.includes(`no results named never-run in ${path.join(m.resultsDir, 'codex')}`));
});

// ---- both agents, read by their own readers ---------------------------------------------------------------------------
// The trials below are real ones (`runTrial` of the runner, the grader included) of the fake agent, read by the reader
// the suite's own config carries: none for Claude Code, which the runner reads as it always has, and Codex's own.

const HOSTS = {
  claude: { machine, deps: depsFor, argv: runArgv, env: ENV, file: resultsFile, raw: (m, name) => path.join(m.runsDir, name) },
  codex: { machine: codexMachine, deps: codexDeps, argv: codexRunArgv, env: {}, file: codexResultsFile, raw: (m, name) => path.join(m.runsDir, 'codex', name) },
};
const ONE_CELL = { '--tasks': 'alpha', '--configs': 'minimal', '--efforts': 'medium' };

/** A `runTrial` that runs the trial for real with the agent swapped for the fake one in mode `modeOf(trial)` (the
 * suite builds the argv of a real CLI), read by `readerFor(trial)`: by default whatever the suite's config carries. */
function fakeAgentRun(modeOf, readerFor = (trial) => trial.config.reader) {
  const run = (trial) => {
    run.asked.push(trialKey({ task: trial.task.id, config: trial.config.name, effort: trial.effort, repeat: trial.repeat }));
    run.readers.push(trial.config.reader);
    return runTrial({
      ...trial,
      config: { name: trial.config.name, command: process.execPath, args: [FAKE_AGENT], env: { FAKE_AGENT_MODE: modeOf(trial) }, reader: readerFor(trial) },
      readVersion: () => '9.9.9 (Fake Agent)',
      sweep: () => ({ killed: [] }),
    });
  };
  run.asked = [];
  run.readers = [];
  return run;
}

const CLAUDE_USAGE = { inputTokens: 60, outputTokens: 5, turns: 3, costUsd: 0.75, subagents: 2 };
const CODEX_USAGE = { inputTokens: 1000, outputTokens: 50, turns: null, costUsd: null, subagents: null };
const NO_USAGE = { inputTokens: null, outputTokens: null, turns: null, costUsd: null, subagents: null };
const READ_AS = {
  claude: {
    reader: undefined,
    recorded: [['solve', 1, null, CLAUDE_USAGE], ['noop', 2 / 3, null, CLAUDE_USAGE], ['agent-error', 2 / 3, 'agent-exit-1', { ...NO_USAGE, turns: 1 }], ['garbage', 2 / 3, 'agent-output-unparsable', NO_USAGE]],
    stops: [['cap', 'cap', /monthly spend limit/], ['auth', 'auth', /Not logged in/]],
  },
  codex: {
    reader: readCodexOutput,
    recorded: [['codex-solve', 1, null, CODEX_USAGE], ['codex-noop', 2 / 3, null, CODEX_USAGE], ['codex-failed', 2 / 3, 'agent-exit-1', NO_USAGE], ['codex-incomplete', 2 / 3, 'agent-error', NO_USAGE]],
    stops: [['codex-cap', 'cap', /hit your usage limit/], ['codex-auth', 'auth', /Not logged in\. Run `codex login` first/]],
  },
};

for (const [agent, host] of Object.entries(HOSTS)) {
  const { reader, recorded, stops } = READ_AS[agent];

  test(`a ${agent} suite reads its trials with its own reader: solved, untouched, failed and unreadable sessions are graded and recorded`, async () => {
    const m = host.machine();
    const { io, deps } = host.deps(m, { runTrial: fakeAgentRun((trial) => recorded[trial.repeat - 1][0]) });
    assert.equal(await suiteMain(host.argv(m, { ...ONE_CELL, '--repeats': String(recorded.length) }), host.env, deps), 0, io.err);
    assert.ok(deps.runTrial.readers.length === recorded.length && deps.runTrial.readers.every((given) => given === reader), 'the reader of the suite\'s own config');
    const doc = JSON.parse(fs.readFileSync(host.file(m), 'utf8'));
    assert.deepEqual(
      doc.trials.map((record) => [record.repeat, record.score, record.error, Object.fromEntries(Object.keys(NO_USAGE).map((name) => [name, record[name]]))]),
      recorded.map(([, score, error, usage], index) => [index + 1, score, error, usage]),
    );
    assert.equal(fs.readdirSync(host.raw(m, 'screen')).filter((name) => name.endsWith('.stdout.log')).length, recorded.length, 'the raw output of every trial is kept under the run\'s name');
  });

  for (const [mode, reason, message] of stops) {
    test(`a ${agent} suite stops at a ${reason} failure its reader recognizes (${mode}) and records nothing`, async () => {
      const m = host.machine();
      const { io, deps } = host.deps(m, { runTrial: fakeAgentRun(() => mode) });
      assert.equal(await suiteMain(host.argv(m, { ...ONE_CELL, '--repeats': '2' }), host.env, deps), 1);
      assert.match(io.err, new RegExp(`the suite stopped: ${reason} `));
      assert.match(io.err, message);
      assert.deepEqual(deps.runTrial.asked, ['alpha|minimal|medium|1'], 'the next trial is not started');
      assert.equal(fs.existsSync(host.file(m)), false);
    });
  }

  test(`a ${agent} suite stops at a trial whose reading the runner refuses, exits 1 and records nothing for it; the raw output is kept and the same command repeats exactly that trial`, async () => {
    const m = host.machine();
    let fixed = false;
    // The reader of the suite's own config, which loses a key of its reading for the second trial until it is fixed.
    const readerFor = (trial) => (run) => {
      const reading = (trial.config.reader ?? readClaudeOutput)(run);
      return trial.repeat === 2 && !fixed ? { stop: reading.stop, failed: reading.failed, usage: reading.usage } : reading;
    };
    const mode = () => recorded[1][0];
    const command = host.argv(m, { ...ONE_CELL, '--repeats': '3' });
    const first = host.deps(m, { runTrial: fakeAgentRun(mode, readerFor) });
    assert.equal(await suiteMain(command, host.env, first.deps), 1);
    assert.match(first.io.err, /the suite stopped: reader \(config minimal: its reader returned a reading of the wrong shape: "parsed" must be true or false, got undefined \(trial alpha, minimal, medium, repeat 2: nothing is recorded for it/);
    assert.match(first.io.err, /1 trials are recorded in .*fix the cause and run the same command again/);
    assert.deepEqual(first.deps.runTrial.asked, ['alpha|minimal|medium|1', 'alpha|minimal|medium|2'], 'the run stops there');
    assert.deepEqual(keysOf(JSON.parse(fs.readFileSync(host.file(m), 'utf8')).trials), ['alpha|minimal|medium|1'], 'no trial is recorded for the reading that was refused');
    assert.match(fs.readFileSync(path.join(host.raw(m, 'screen'), 'alpha__minimal__medium__2.stdout.log'), 'utf8'), /did nothing/, 'what the paid session printed is kept with the raw logs');
    assert.ok(first.io.out.includes(`results: ${host.file(m)}`), 'the summary of what is recorded is still printed');

    fixed = true;
    const second = host.deps(m, { runTrial: fakeAgentRun(mode, readerFor) });
    assert.equal(await suiteMain(command, host.env, second.deps), 0, second.io.err);
    assert.deepEqual(second.deps.runTrial.asked, ['alpha|minimal|medium|2', 'alpha|minimal|medium|3'], 'exactly the refused trial, then the rest');
    assert.deepEqual(keysOf(JSON.parse(fs.readFileSync(host.file(m), 'utf8')).trials), ['alpha|minimal|medium|1', 'alpha|minimal|medium|2', 'alpha|minimal|medium|3']);
  });
}

// ---- the subagent runs ------------------------------------------------------------------------------------------------
// The six subagent configs (`configs.mjs`, `odd/tasks/subagent-model-routing.md`) are Claude Code runs of the minimal
// arm with a forced subagent model and a delegation mode. They keep what they write in a `subagents` directory of
// their own, as the Codex runs do in theirs.

const SUB_MODELS = { 'sub-opus-write': 'claude-opus-5-5', 'sub-haiku-write': 'claude-haiku-5-5' };
const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
/** What a results document pins of each config of the run: the model it forces and the SHA-256 of what it appends
 * to the system prompt. Both configs are in `write` mode, so they pin one text. */
const pinsOf = (models, text = DELEGATION_MODES.write) => Object.fromEntries(Object.entries(models).map(([name, model]) => [name, { model, delegationSha256: sha256(text) }]));
const SUB_PINS = pinsOf(SUB_MODELS);
const shortSha = (text) => `sha256 ${sha256(text).slice(0, 12)}`;
const SUB_NAMES = ['sub-opus-explore', 'sub-opus-verify', 'sub-opus-write', 'sub-haiku-explore', 'sub-haiku-verify', 'sub-haiku-write'];
/** The argv of a subagent run of the machine's own tasks: 2 tasks x 2 arms in `write` mode x medium x 1 repeat, 4 trials. */
const subArgv = (m, changes = {}) => runArgv(m, { '--configs': Object.keys(SUB_MODELS).join(','), '--efforts': 'medium', ...changes });
const subResultsFile = (m, name = 'screen') => path.join(m.resultsDir, 'subagents', `${name}.json`);
const readSubDoc = (m, name) => JSON.parse(fs.readFileSync(subResultsFile(m, name), 'utf8'));
const subPlan = (names) => planTrials({ tasks: [{ id: 'alpha' }, { id: 'beta' }], configs: names.map((name) => ({ name })), efforts: ['medium'], repeats: 1 })
  .map(({ task, config, effort, repeat }) => trialKey({ task: task.id, config: config.name, effort, repeat }));
const SUB_PLAN = subPlan(Object.keys(SUB_MODELS));

test('the six subagent configs are taken by a Claude run and parse like any other config; a Codex run takes none', () => {
  assert.deepEqual(parse({ '--configs': SUB_NAMES.join(','), '--efforts': 'medium' }), {
    mode: 'run', claude: CLAUDE, configs: SUB_NAMES, efforts: ['medium'], repeats: 3, tasks: TASKS, permissionMode: 'bypassPermissions', name: 'ab-run', workRoot: null,
  });
  assert.deepEqual(parse({ '--configs': 'sub-haiku-verify' }).configs, ['sub-haiku-verify']);
  for (const configs of ['sub-sonnet-write', 'sub-opus', 'sub-opus-write,sub-opus-write']) assert.throws(() => parse({ '--configs': configs }), usageError(/--configs/), configs);
  assert.throws(() => parseCodex({ '--configs': 'sub-opus-write' }), usageError(/"sub-opus-write" is not config \(one of minimal, current\)/));
});

test('a run that mixes subagent configs with minimal or current is refused before anything is created, and the refusal says why', async () => {
  for (const configs of ['minimal,sub-opus-write', 'sub-haiku-explore,current', 'sub-opus-write,minimal,current']) {
    assert.throws(() => parse({ '--configs': configs }), usageError(/--configs: sub-\S+ cannot share a run with (minimal|current): .*evals\/results\/subagents\/.*evals\/report\.mjs/), configs);
  }
  const m = machine();
  const { io, deps } = depsFor(m);
  assert.equal(await suiteMain(subArgv(m, { '--configs': 'minimal,sub-opus-write' }), ENV, deps), 2);
  assert.match(io.err, /sub-opus-write cannot share a run with minimal/);
  assert.ok(io.err.includes(USAGE), 'the usage is printed');
  assert.deepEqual(deps.runTrial.asked, []);
  nothingCreated(m);
  assert.match(USAGE, /sub-opus-explore, sub-opus-verify, sub-opus-write, sub-haiku-explore, sub-haiku-verify, sub-haiku-write/);
  assert.match(USAGE, /evals\/results\/subagents\/<name>\.json and evals\/runs\/subagents\/<name>\//);
});

test('a subagent run keeps everything in a subagents directory of its own: the results, the raw logs and what each config forces and tells its subagents', async () => {
  const m = machine();
  const during = [];
  const { io, deps } = depsFor(m, { runTrial: fakeRun(() => { during.push(templatesIn(m.workRoot)); }) });
  assert.equal(await suiteMain(subArgv(m), ENV, deps), 0, io.err);
  assert.deepEqual(fs.readdirSync(m.resultsDir), ['subagents'], 'nothing is written beside the results the report reads');
  assert.deepEqual(fs.readdirSync(path.join(m.resultsDir, 'subagents')), ['screen.json'], 'no temporary file is left');
  const doc = readSubDoc(m);
  assert.deepEqual({ ...doc, trials: keysOf(doc.trials) }, {
    format: 1, name: 'screen', createdAt: '2026-10-02T12:00:00.000Z', ...RUN, subagentConfigs: SUB_PINS,
    args: { claude: m.claude, configs: Object.keys(SUB_MODELS), efforts: ['medium'], repeats: 1, tasks: ['alpha', 'beta'], workRoot: m.workRoot },
    trials: SUB_PLAN,
  });
  assert.deepEqual(deps.runTrial.asked, SUB_PLAN);
  assert.ok(deps.runTrial.trials.every((trial) => trial.runsDir === path.join(m.runsDir, 'subagents', 'screen')), 'the raw logs of a subagent run are under runs/subagents/<name>/');
  assert.ok(io.out.includes(`results: ${subResultsFile(m)}`), 'the summary names the file');
  assert.match(io.out, /alpha\s+sub-opus-write\s+medium\s+1\s+0\.50/);
  assert.doesNotMatch(io.out, /Headroom/, 'no screen of the minimal arm for a run that has none');
  assert.match(io.out, /The comparison of the two arms is evals\/subagents-report\.mjs's\./);
  assert.ok(during.length === SUB_PLAN.length && during.every((entries) => entries.length === 0), 'no home template is built: the configs are minimal-based');

  // A minimal run of the same name on the same machine is another file, beside F5's, and names no subagent model.
  const plain = depsFor(m);
  assert.equal(await suiteMain(runArgv(m, { '--configs': 'minimal', '--efforts': 'medium' }), ENV, plain.deps), 0, plain.io.err);
  assert.deepEqual(fs.readdirSync(m.resultsDir).sort(), ['screen.json', 'subagents']);
  assert.equal('subagentConfigs' in readDoc(m), false);
  assert.match(plain.io.out, /Headroom screen/, 'and its summary is the screen, as ever');
  assert.equal(plain.deps.runTrial.trials[0].runsDir, path.join(m.runsDir, 'screen'));
});

test('a subagent trial is the minimal arm\'s plus the delegation mode and the forced subagent model, which survive the token being added', async () => {
  const m = machine();
  const sub = depsFor(m);
  assert.equal(await suiteMain(subArgv(m), ENV, sub.deps), 0, sub.io.err);
  const minimal = depsFor(m);
  assert.equal(await suiteMain(runArgv(m, { '--configs': 'minimal', '--efforts': 'medium' }), ENV, minimal.deps), 0, minimal.io.err);
  const context = { effort: 'medium', home: path.join(m.base, 'home'), workspace: path.join(m.base, 'ws'), prepared: { engramPort: 41000 } };
  const base = resolveAgent(minimal.deps.runTrial.trials[0].config, context);
  const configs = new Map(sub.deps.runTrial.trials.map((trial) => [trial.config.name, trial.config]));
  assert.deepEqual([...configs.keys()], Object.keys(SUB_MODELS));
  for (const [name, config] of configs) {
    const agent = resolveAgent(config, context);
    assert.equal(agent.command, m.claude, name);
    assert.deepEqual(agent.args, [...base.args, '--append-system-prompt', DELEGATION_MODES.write], `${name}: the minimal arm's argv, then the mode`);
    assert.deepEqual(agent.env, { ...base.env, CLAUDE_CODE_SUBAGENT_MODEL: SUB_MODELS[name], CLAUDE_CODE_SUBAGENT_MODEL_FORCE: '1' }, `${name}: the minimal arm's env, then the two variables`);
    assert.equal(agent.env.CLAUDE_CODE_OAUTH_TOKEN, FAKE_TOKEN, `${name}: the eval's token`);
    assert.equal(config.reader, undefined, `${name}: read as Claude Code's output`);
    assert.deepEqual([typeof config.transcripts?.keep, typeof config.transcripts?.summarize], ['function', 'function'], `${name}: its transcripts are kept, and the token wrapper did not drop that`);
  }
  assert.ok(!('transcripts' in minimal.deps.runTrial.trials[0].config), 'the minimal arm keeps none');
  assert.ok(base.args.includes(EVAL_MODEL) && base.args.includes('bypassPermissions'), 'the main model and the permission mode are the run\'s');
});

const SUB_RUN = { ...RUN, subagentConfigs: SUB_PINS };

test('a resumed subagent run pins the subagent model and the delegation text of each config it recorded: a changed one is named, a config that is new to the run is not a change', () => {
  const recorded = { ...SUB_RUN, trials: [{ config: 'sub-opus-write' }, { config: 'sub-haiku-write' }] };
  assert.deepEqual(diffRun(recorded, SUB_RUN), []);
  assert.deepEqual(diffRun({ ...recorded, subagentConfigs: { ...SUB_PINS, 'sub-haiku-write': { ...SUB_PINS['sub-haiku-write'], model: 'claude-haiku-4-5' } } }, SUB_RUN), [
    { field: 'subagent model of sub-haiku-write', recorded: 'claude-haiku-4-5', current: 'claude-haiku-5-5' },
  ]);
  // The text a config appends to the system prompt is what its trials were told: one word of it changed, and the
  // trials already recorded were told something else.
  assert.deepEqual(diffRun({ ...recorded, subagentConfigs: { ...SUB_PINS, 'sub-haiku-write': { ...SUB_PINS['sub-haiku-write'], delegationSha256: sha256('an earlier text') } } }, SUB_RUN), [
    { field: 'delegation text of sub-haiku-write', recorded: sha256('an earlier text'), current: sha256(DELEGATION_MODES.write) },
  ]);
  assert.deepEqual(diffRun(recorded, { ...SUB_RUN, subagentConfigs: { ...SUB_PINS, ...pinsOf({ 'sub-opus-explore': 'claude-opus-5-5' }, DELEGATION_MODES.explore) } }), [], 'a config added to the run was never recorded');
  assert.deepEqual(diffRun(recorded, { ...SUB_RUN, subagentConfigs: { 'sub-opus-write': SUB_PINS['sub-opus-write'] } }), [], 'a config this command leaves out is not compared');
  // A file that holds trials of a config and no pin for it says nothing of what they ran on: unknown, not equal.
  assert.deepEqual(diffRun({ ...recorded, subagentConfigs: { 'sub-haiku-write': SUB_PINS['sub-haiku-write'] } }, SUB_RUN), [
    { field: 'subagent model of sub-opus-write', recorded: null, current: 'claude-opus-5-5' },
    { field: 'delegation text of sub-opus-write', recorded: null, current: sha256(DELEGATION_MODES.write) },
  ]);
  // So does a pin that names the model alone.
  assert.deepEqual(diffRun({ ...recorded, subagentConfigs: { ...SUB_PINS, 'sub-opus-write': { model: 'claude-opus-5-5' } } }, SUB_RUN), [
    { field: 'delegation text of sub-opus-write', recorded: null, current: sha256(DELEGATION_MODES.write) },
  ]);
  assert.deepEqual(diffRun({ ...recorded, stack: { ...STACK, claude: '2.1.200 (Claude Code)' } }, SUB_RUN), [
    { field: 'claude', recorded: '2.1.200 (Claude Code)', current: STACK.claude },
  ], 'the stack is pinned as for every run');
});

test('a subagent run cut by a stop continues with the missing trials only and may gain a config; one whose subagent model or delegation text changed is refused, naming which, with the file left as it was', async () => {
  const m = machine();
  const cut = depsFor(m, { runTrial: fakeRun((trial, number) => (number === 3 ? stopped('cap')() : undefined)) });
  assert.equal(await suiteMain(subArgv(m), ENV, cut.deps), 1);
  assert.match(cut.io.err, /stopped: cap/);
  assert.deepEqual(keysOf(readSubDoc(m).trials), SUB_PLAN.slice(0, 2));
  const before = fs.readFileSync(subResultsFile(m), 'utf8');

  // The same trials, recorded as having run on another subagent model: never continued as this run.
  const recorded = JSON.parse(before);
  write(subResultsFile(m, 'other-model'), JSON.stringify({ ...recorded, name: 'other-model', subagentConfigs: { ...SUB_PINS, 'sub-haiku-write': { ...SUB_PINS['sub-haiku-write'], model: 'claude-haiku-4-5' } } }));
  const otherModel = depsFor(m);
  assert.equal(await suiteMain(subArgv(m, { '--name': 'other-model' }), ENV, otherModel.deps), 1);
  assert.match(otherModel.io.err, /other-model\.json was recorded with another subagent model, and the model a config forces on its subagents must not change within a run, so it is not continued:/);
  assert.match(otherModel.io.err, /subagent model of sub-haiku-write: claude-haiku-4-5 -> claude-haiku-5-5/);
  assert.match(otherModel.io.err, /--name/, 'it says to use a new name for a new run');
  assert.doesNotMatch(otherModel.io.err, /another stack|versions/, 'the stack is the one recorded, and the refusal does not say otherwise');

  // The same trials, recorded as told another delegation text: an edited mode is another measurement.
  write(subResultsFile(m, 'other-text'), JSON.stringify({ ...recorded, name: 'other-text', subagentConfigs: { ...SUB_PINS, 'sub-haiku-write': { ...SUB_PINS['sub-haiku-write'], delegationSha256: sha256('an earlier text') } } }));
  const otherText = depsFor(m);
  assert.equal(await suiteMain(subArgv(m, { '--name': 'other-text' }), ENV, otherText.deps), 1);
  assert.match(otherText.io.err, /other-text\.json was recorded with another delegation text, and the delegation text of a config must not change within a run, so it is not continued:/);
  assert.ok(otherText.io.err.includes(`  delegation text of sub-haiku-write: ${shortSha('an earlier text')} -> ${shortSha(DELEGATION_MODES.write)}\n`), otherText.io.err);
  assert.doesNotMatch(otherText.io.err, /another stack|subagent model/);

  const { subagentConfigs: _pins, ...unpinned } = recorded;
  write(subResultsFile(m, 'unpinned'), JSON.stringify({ ...unpinned, name: 'unpinned' }));
  const noPin = depsFor(m);
  assert.equal(await suiteMain(subArgv(m, { '--name': 'unpinned' }), ENV, noPin.deps), 1);
  assert.match(noPin.io.err, /was recorded with another subagent model and with another delegation text, and /);
  assert.match(noPin.io.err, /subagent model of sub-opus-write: unknown -> claude-opus-5-5/);
  assert.ok(noPin.io.err.includes(`  delegation text of sub-opus-write: unknown -> ${shortSha(DELEGATION_MODES.write)}\n`), noPin.io.err);

  // A stack that changed is still said to be the stack, alone or beside a pin.
  const upgraded = depsFor(m, { readStack: () => ({ ...STACK, claude: '2.2.0 (Claude Code)' }) });
  assert.equal(await suiteMain(subArgv(m), ENV, upgraded.deps), 1);
  assert.match(upgraded.io.err, /screen\.json was recorded on another stack, and versions must not change within a run, so it is not continued:/);
  const both = depsFor(m, { readStack: () => ({ ...STACK, claude: '2.2.0 (Claude Code)' }) });
  assert.equal(await suiteMain(subArgv(m, { '--name': 'other-text' }), ENV, both.deps), 1);
  assert.match(both.io.err, /was recorded on another stack and with another delegation text, and versions and the delegation text of a config must not change within a run/);
  assert.deepEqual([otherModel, otherText, noPin, upgraded, both].map((run) => run.deps.runTrial.asked), [[], [], [], [], []]);
  assert.equal(fs.readFileSync(subResultsFile(m), 'utf8'), before, 'nothing was rewritten');

  const resumed = depsFor(m);
  assert.equal(await suiteMain(subArgv(m), ENV, resumed.deps), 0, resumed.io.err);
  assert.deepEqual(resumed.deps.runTrial.asked, SUB_PLAN.slice(2), 'a recorded trial is never repeated');
  assert.deepEqual(keysOf(readSubDoc(m).trials), SUB_PLAN);

  // The same run with a config more: only its trials run, and its subagent model joins the recorded ones.
  const wider = depsFor(m);
  assert.equal(await suiteMain(subArgv(m, { '--configs': 'sub-opus-write,sub-haiku-write,sub-haiku-explore' }), ENV, wider.deps), 0, wider.io.err);
  assert.deepEqual(wider.deps.runTrial.asked, ['alpha|sub-haiku-explore|medium|1', 'beta|sub-haiku-explore|medium|1']);
  assert.deepEqual(readSubDoc(m).subagentConfigs, { ...SUB_PINS, ...pinsOf({ 'sub-haiku-explore': 'claude-haiku-5-5' }, DELEGATION_MODES.explore) });
});

test('--subagents selects the recorded subagent run a summary reads, and is taken with --summary alone', () => {
  assert.deepEqual(parseArgs(['--summary', '--subagents', '--name', 'screen'], { taskIds: TASKS }), { mode: 'summary', subagents: true, name: 'screen' });
  assert.deepEqual(parseArgs(['--subagents', '--name', 'screen', '--summary'], { taskIds: TASKS }), { mode: 'summary', subagents: true, name: 'screen' });
  assert.deepEqual(parseArgs(['--summary', '--name', 'screen'], { taskIds: TASKS }), { mode: 'summary', name: 'screen' }, 'not given, it is not there: a summary parses as it always did');
  // A run says which results it writes by the configs it names; a flag that also said so could contradict them.
  assert.throws(() => parseArgs([...argv(), '--subagents'], { taskIds: TASKS }), usageError(/--subagents selects a recorded subagent run and is taken only with --summary/));
  assert.equal('subagents' in parse({ '--configs': 'sub-opus-write' }), false, 'a run parses into no such field');
  assert.throws(() => parseArgs(['--agent', 'codex', '--summary', '--subagents', '--name', 'screen'], { taskIds: TASKS }), usageError(/--subagents is not taken with --agent codex/));
  assert.throws(() => parseArgs([...codexArgv(), '--subagents'], { taskIds: TASKS }), usageError(/--subagents/));
  assert.throws(() => parseArgs(['--summary', '--subagents', 'yes', '--name', 'screen'], { taskIds: TASKS }), usageError(/unexpected argument "yes"/), 'it takes no value');
  assert.match(USAGE, /node evals\/suite\.mjs --summary --subagents --name <run name>/);
  assert.match(USAGE, /--subagents\s+with --summary: read the run from evals\/results\/subagents\//);
});

test('a summary reaches a subagent run only with --subagents, and never falls back from one directory to the other', async () => {
  const m = machine();
  const run = depsFor(m);
  assert.equal(await suiteMain(subArgv(m), ENV, run.deps), 0, run.io.err);
  const before = fs.readFileSync(subResultsFile(m), 'utf8');

  // Without the flag a summary reads what it always read, where there is no run of that name.
  const plain = depsFor(m);
  assert.equal(await suiteMain(['--summary', '--name', 'screen'], {}, plain.deps), 1);
  assert.ok(plain.io.err.includes(`no results named screen in ${m.resultsDir}\n`), plain.io.err);
  assert.equal(plain.io.out, '');

  const sub = depsFor(m);
  assert.equal(await suiteMain(['--summary', '--subagents', '--name', 'screen'], {}, sub.deps), 0, sub.io.err);
  assert.match(sub.io.out, /alpha\s+sub-opus-write\s+medium\s+1\s+0\.50/);
  assert.match(sub.io.out, /beta\s+sub-haiku-write\s+medium\s+1\s+0\.50/);
  assert.doesNotMatch(sub.io.out, /Headroom/);
  assert.match(sub.io.out, /The comparison of the two arms is evals\/subagents-report\.mjs's\./);
  assert.deepEqual(sub.deps.runTrial.asked, []);
  assert.equal(fs.readFileSync(subResultsFile(m), 'utf8'), before);

  // An F5 run of the same name on the same machine: each summary reads its own file, whichever exists.
  const screen = depsFor(m);
  assert.equal(await suiteMain(runArgv(m, { '--configs': 'minimal', '--efforts': 'medium' }), ENV, screen.deps), 0, screen.io.err);
  const f5 = depsFor(m);
  assert.equal(await suiteMain(['--summary', '--name', 'screen'], {}, f5.deps), 0, f5.io.err);
  assert.match(f5.io.out, /alpha\s+minimal\s+medium\s+1\s+0\.50/);
  assert.match(f5.io.out, /Headroom screen/);
  assert.doesNotMatch(f5.io.out, /sub-opus-write|subagents-report/);
  const still = depsFor(m);
  assert.equal(await suiteMain(['--summary', '--subagents', '--name', 'screen'], {}, still.deps), 0, still.io.err);
  assert.equal(still.io.out, sub.io.out);

  // And the other way: a run recorded beside F5's is not found among the subagent runs.
  const only = depsFor(m);
  assert.equal(await suiteMain(runArgv(m, { '--configs': 'minimal', '--efforts': 'medium', '--name': 'f5-only' }), ENV, only.deps), 0, only.io.err);
  const missing = depsFor(m);
  assert.equal(await suiteMain(['--summary', '--subagents', '--name', 'f5-only'], {}, missing.deps), 1);
  assert.ok(missing.io.err.includes(`no results named f5-only in ${path.join(m.resultsDir, 'subagents')}\n`), missing.io.err);

  // --subagents on a run is a usage error, before anything is created.
  const fresh = machine();
  const wrong = depsFor(fresh);
  assert.equal(await suiteMain([...subArgv(fresh), '--subagents'], ENV, wrong.deps), 2);
  assert.match(wrong.io.err, /--subagents selects a recorded subagent run/);
  assert.deepEqual(wrong.deps.runTrial.asked, []);
  nothingCreated(fresh);
});

test('a subagent suite runs a real trial of the fake agent: read as Claude Code\'s output, graded, and its raw output kept under runs/subagents/<name>/', async () => {
  const m = machine();
  const { io, deps } = depsFor(m, { runTrial: fakeAgentRun(() => 'solve') });
  assert.equal(await suiteMain(subArgv(m, { '--tasks': 'alpha', '--configs': 'sub-haiku-verify' }), ENV, deps), 0, io.err);
  assert.deepEqual(deps.runTrial.readers, [undefined]);
  const [record] = readSubDoc(m).trials;
  assert.deepEqual([trialKey(record), record.score, record.error], ['alpha|sub-haiku-verify|medium|1', 1, null]);
  assert.deepEqual(fs.readdirSync(path.join(m.runsDir, 'subagents', 'screen')).filter((name) => name.endsWith('.stdout.log')), ['alpha__sub-haiku-verify__medium__1.stdout.log']);
  assert.equal(fs.existsSync(path.join(m.runsDir, 'screen')), false, 'nothing under the runs of the minimal and current arms');
});

// G5 of `odd/tasks/future-model-protocol.md`: the model a run is measured on is chosen with `--model` and recorded
// with it; without the flag it is the default constant, so a command line that worked before means what it meant.
const NEW_CLAUDE_MODEL = 'claude-fable-5-5';
const NEW_CODEX_MODEL = 'gpt-7-sol';

test('--model is parsed into the run, for either agent, and is absent from what is parsed when it is not given', () => {
  assert.deepEqual(parse({ '--model': NEW_CLAUDE_MODEL }), { ...parse(), model: NEW_CLAUDE_MODEL });
  assert.equal('model' in parse(), false);
  assert.deepEqual(parseCodex({ '--model': NEW_CODEX_MODEL }), { ...parseCodex(), model: NEW_CODEX_MODEL });
  assert.equal('model' in parseCodex(), false);
});

test('--model refuses an alias or a malformed id for Claude Code, an empty or spaced one for Codex, and a summary', () => {
  for (const model of ['opus', 'sonnet', 'claude-opus', 'Claude-Opus-5-5', 'claude-opus-5-5 ', '']) {
    assert.throws(() => parse({ '--model': model }), usageError(/--model/), JSON.stringify(model));
  }
  for (const model of ['', 'gpt 7', ' gpt-7']) assert.throws(() => parseCodex({ '--model': model }), usageError(/--model/), JSON.stringify(model));
  assert.throws(() => parseArgs(['--summary', '--name', 'screen', '--model', NEW_CLAUDE_MODEL], { taskIds: TASKS }), usageError(/--model/));
});

test('a Claude run on --model hands that model to every arm and records it as the run\'s model', async () => {
  const m = machine();
  const { io, deps } = depsFor(m);
  assert.equal(await suiteMain(runArgv(m, { '--model': NEW_CLAUDE_MODEL }), ENV, deps), 0, io.err);
  assert.equal(readDoc(m).model, NEW_CLAUDE_MODEL);
  for (const trial of deps.runTrial.trials) {
    const agent = resolveAgent(trial.config, { effort: 'medium', home: path.join(m.base, 'home'), workspace: path.join(m.base, 'ws'), prepared: { engramPort: 41000 } });
    assert.ok(agent.args.includes(NEW_CLAUDE_MODEL), trial.config.name);
    assert.ok(!agent.args.includes(EVAL_MODEL), `${trial.config.name}: not the default`);
  }
});

test('a Codex run on --model passes it with -m and records it as the run\'s model', async () => {
  const m = codexMachine();
  const { io, deps } = codexDeps(m);
  assert.equal(await suiteMain(codexRunArgv(m, { '--model': NEW_CODEX_MODEL }), ENV, deps), 0, io.err);
  assert.equal(readCodexDoc(m).model, NEW_CODEX_MODEL);
  for (const trial of deps.runTrial.trials) {
    const agent = resolveAgent(trial.config, { effort: 'high', home: path.join(m.base, 'home'), workspace: path.join(m.base, 'ws'), prepared: { engramPort: 41000 } });
    assert.deepEqual(agent.args.slice(4, 6), ['-m', NEW_CODEX_MODEL], trial.config.name);
  }
});

test('a model with no list price is warned about and still runs; the default models are not', async () => {
  const claude = machine();
  const priced = depsFor(claude);
  assert.equal(await suiteMain(runArgv(claude), ENV, priced.deps), 0, priced.io.err);
  assert.doesNotMatch(priced.io.err, /list price/);
  const unpriced = depsFor(claude);
  assert.equal(await suiteMain(runArgv(claude, { '--name': 'fable', '--model': NEW_CLAUDE_MODEL }), ENV, unpriced.deps), 0, unpriced.io.err);
  assert.match(unpriced.io.err, new RegExp(`${NEW_CLAUDE_MODEL} has no list price in evals/prices\.mjs`));

  const codex = codexMachine();
  const codexPriced = codexDeps(codex);
  assert.equal(await suiteMain(codexRunArgv(codex), ENV, codexPriced.deps), 0, codexPriced.io.err);
  assert.doesNotMatch(codexPriced.io.err, /list price/);
  const codexUnpriced = codexDeps(codex);
  assert.equal(await suiteMain(codexRunArgv(codex, { '--name': 'next', '--model': NEW_CODEX_MODEL }), ENV, codexUnpriced.deps), 0, codexUnpriced.io.err);
  assert.match(codexUnpriced.io.err, new RegExp(`${NEW_CODEX_MODEL} has no list price in CODEX_LIST_PRICES`));
});

test('a recorded run is continued only on its own model: another --model, or none for a run on another, is refused and the file is untouched', async () => {
  const m = machine();
  const first = depsFor(m);
  assert.equal(await suiteMain(runArgv(m, { '--configs': 'minimal' }), ENV, first.deps), 0, first.io.err);
  const before = fs.readFileSync(resultsFile(m));
  const other = depsFor(m);
  assert.equal(await suiteMain(runArgv(m, { '--configs': 'minimal', '--model': NEW_CLAUDE_MODEL }), ENV, other.deps), 1);
  assert.match(other.io.err, new RegExp(`model: ${EVAL_MODEL} -> ${NEW_CLAUDE_MODEL}`));
  assert.match(other.io.err, new RegExp(`--model ${EVAL_MODEL}`), 'names the flag that continues it');
  assert.deepEqual(other.deps.runTrial.asked, []);
  assert.deepEqual(fs.readFileSync(resultsFile(m)), before);

  const fable = depsFor(m);
  assert.equal(await suiteMain(runArgv(m, { '--name': 'fable', '--configs': 'minimal', '--model': NEW_CLAUDE_MODEL }), ENV, fable.deps), 0, fable.io.err);
  const recorded = fs.readFileSync(resultsFile(m, 'fable'));
  const bare = depsFor(m);
  assert.equal(await suiteMain(runArgv(m, { '--name': 'fable', '--configs': 'minimal' }), ENV, bare.deps), 1);
  assert.match(bare.io.err, new RegExp(`--model ${NEW_CLAUDE_MODEL}`));
  assert.deepEqual(bare.deps.runTrial.asked, []);
  assert.deepEqual(fs.readFileSync(resultsFile(m, 'fable')), recorded);
});

// G6 of `odd/tasks/future-model-protocol.md`: a run with the current arm records the fingerprint of its home template
// as its setup, and is continued only on the same setup.
test('a run with the current arm records the fingerprint of its home template as its setup; a run without it records none', async () => {
  const m = machine();
  const both = depsFor(m);
  assert.equal(await suiteMain(runArgv(m), ENV, both.deps), 0, both.io.err);
  const { setup } = readDoc(m);
  assert.match(setup.sha256, /^[0-9a-f]{64}$/);
  assert.ok(Object.keys(setup.items).includes('.claude/CLAUDE.md'), JSON.stringify(setup.items));
  const bare = depsFor(m);
  assert.equal(await suiteMain(runArgv(m, { '--name': 'bare', '--configs': 'minimal' }), ENV, bare.deps), 0, bare.io.err);
  assert.equal('setup' in readDoc(m, 'bare'), false);
  const gained = depsFor(m);
  assert.equal(await suiteMain(runArgv(m, { '--name': 'bare', '--configs': 'minimal,current' }), ENV, gained.deps), 0, gained.io.err);
  assert.deepEqual(readDoc(m, 'bare').setup, setup, 'a run that gains the current arm records the setup it gains it on');
});

test('a run is continued on the same setup, and refused on another, naming the part that moved, before any trial and with the file untouched', async () => {
  const m = machine();
  const first = depsFor(m);
  assert.equal(await suiteMain(runArgv(m), ENV, first.deps), 0, first.io.err);
  const same = depsFor(m);
  assert.equal(await suiteMain(runArgv(m, { '--repeats': '2' }), ENV, same.deps), 0, same.io.err);
  assert.ok(same.deps.runTrial.asked.length > 0, 'the same setup continues');

  write(path.join(m.realHome, '.claude', 'CLAUDE.md'), '# the global rules, edited\n');
  const before = fs.readFileSync(resultsFile(m));
  const moved = depsFor(m);
  assert.equal(await suiteMain(runArgv(m, { '--repeats': '3' }), ENV, moved.deps), 1);
  assert.match(moved.io.err, /another setup/);
  assert.match(moved.io.err, /setup \.claude\/CLAUDE\.md/);
  assert.deepEqual(moved.deps.runTrial.asked, []);
  assert.deepEqual(fs.readFileSync(resultsFile(m)), before);
  assert.deepEqual(fs.readdirSync(m.workRoot).filter((name) => name.startsWith('js-harness-suite-template-')), [], 'the template is removed');
});

test('a run recorded with current trials but no setup, before setups were recorded, is not continued: nothing says what it ran on', async () => {
  const m = machine();
  const first = depsFor(m);
  assert.equal(await suiteMain(runArgv(m), ENV, first.deps), 0, first.io.err);
  const { setup, ...old } = readDoc(m);
  write(resultsFile(m), JSON.stringify(old));
  const again = depsFor(m);
  assert.equal(await suiteMain(runArgv(m, { '--repeats': '2' }), ENV, again.deps), 1);
  assert.match(again.io.err, /another setup/);
  assert.match(again.io.err, /unknown ->/);
  assert.deepEqual(again.deps.runTrial.asked, []);
});

// G3 of `odd/tasks/future-model-protocol.md`: `--plan` says what a run would cost, from what was recorded, and starts
// nothing.
test('--plan is a flag of a run, never of a summary', () => {
  assert.deepEqual(parseArgs([...argv(), '--plan'], { taskIds: TASKS }), { ...parse(), plan: true });
  assert.equal('plan' in parse(), false);
  assert.throws(() => parseArgs(['--summary', '--name', 'screen', '--plan'], { taskIds: TASKS }), usageError(/--plan/));
});

test('--plan prints the estimate from the recorded runs and starts nothing: no token, no binary, no trial, no template, no file', async () => {
  const m = machine();
  const first = depsFor(m);
  assert.equal(await suiteMain(runArgv(m, { '--efforts': 'medium' }), ENV, first.deps), 0, first.io.err);
  const results = fs.readdirSync(m.resultsDir).sort();
  const work = fs.readdirSync(m.workRoot).sort();
  fs.rmSync(m.claude);
  const plan = depsFor(m);
  assert.equal(await suiteMain([...runArgv(m, { '--name': 'next', '--efforts': 'medium,high' }), '--plan'], {}, plan.deps), 0, plan.io.err);
  assert.deepEqual(plan.deps.runTrial.asked, []);
  assert.match(plan.io.out, /8 trials planned on claude-opus-5-5, 8 to run/);
  assert.match(plan.io.out, /estimate for 4 of the 8 trials to run: about 0 min of agent time, list cost unknown/);
  assert.match(plan.io.out, /unknown for 4 trials, .*alpha minimal high \(1\)/);
  assert.match(plan.io.out, /usage-cap windows: unknown/);
  assert.match(plan.io.out, /source: screen \(2026-10-02\)/);
  assert.deepEqual(fs.readdirSync(m.resultsDir).sort(), results, 'no results file');
  assert.deepEqual(fs.readdirSync(m.workRoot).sort(), work, 'no template, nothing in the work root');
});

test('--plan of a recorded run counts only the trials left to run', async () => {
  const m = machine();
  const first = depsFor(m);
  assert.equal(await suiteMain(runArgv(m, { '--efforts': 'medium' }), ENV, first.deps), 0, first.io.err);
  const plan = depsFor(m);
  assert.equal(await suiteMain([...runArgv(m, { '--efforts': 'medium', '--repeats': '2' }), '--plan'], {}, plan.deps), 0, plan.io.err);
  assert.match(plan.io.out, /8 trials planned on claude-opus-5-5, 4 to run/);
  assert.match(plan.io.out, /estimate for 4 of the 4 trials to run/);
});

test('--plan of a run recorded on another model says the run would be refused, and plans nothing as done', async () => {
  const m = machine();
  const first = depsFor(m);
  assert.equal(await suiteMain(runArgv(m, { '--configs': 'minimal', '--efforts': 'medium' }), ENV, first.deps), 0, first.io.err);
  const plan = depsFor(m);
  assert.equal(await suiteMain([...runArgv(m, { '--configs': 'minimal', '--efforts': 'medium', '--model': 'claude-fable-5-5' }), '--plan'], {}, plan.deps), 1);
  assert.match(plan.io.err, /recorded on claude-opus-5-5: a run on claude-fable-5-5 would be refused/);
  assert.doesNotMatch(plan.io.out, /0 to run/);
});

// G2 of `odd/tasks/future-model-protocol.md`: the arms of one component on the command line.
test('--configs takes arms of one component beside their base, and refuses an arm without its base or one evals/arms.mjs refuses', () => {
  assert.deepEqual(parse({ '--configs': 'current,current-without-skills' }).configs, ['current', 'current-without-skills']);
  assert.deepEqual(parse({ '--configs': 'minimal,minimal-with-mcp-engram' }).configs, ['minimal', 'minimal-with-mcp-engram']);
  assert.throws(() => parse({ '--configs': 'minimal,current-without-skills' }), usageError(/current-without-skills is compared with current, which the run does not name/));
  assert.throws(() => parse({ '--configs': 'current,current-without-nothing' }), usageError(/--configs: .*nothing is not a component/));
  assert.throws(() => parse({ '--configs': 'minimal,minimal-with-skills' }), usageError(/switch it off/));
  assert.throws(() => parseCodex({ '--configs': 'minimal,minimal-with-mcp-engram' }), usageError(/Codex takes no minimal-with/));
  assert.deepEqual(parseCodex({ '--configs': 'current,current-without-agents-md' }).configs, ['current', 'current-without-agents-md']);
  assert.throws(() => parse({ '--configs': 'current,sub-opus-write,current-without-skills' }), usageError(/cannot share a run/));
  assert.throws(() => parse({ '--configs': 'current,current-without-skills,current-without-skills' }), usageError(/listed twice/));
});

/** A `runTrial` stand-in that prepares each trial's home for real, in the scratch directory, and keeps whether the
 * file `rel` of the home is there, by config. `js-harness init` is a stand-in that answers success. */
function seedingRun(m, rel) {
  const held = {};
  const run = fakeRun(async (trial) => {
    const home = path.join(m.base, 'seeded', `${trial.config.name}-${trial.task.id}-${trial.effort}`);
    const workspace = path.join(home, 'workspace');
    write(path.join(workspace, 'README.md'), 'a workspace\n');
    await trial.config.prepare({ home, workspace });
    held[trial.config.name] = fs.existsSync(path.join(home, ...rel.split('/')));
  });
  return { run, held };
}
const initStandIn = () => ({ status: 0, stdout: '', stderr: '' });

test('an arm of current runs in a home seeded from the same template without its component, and its cut is pinned', async () => {
  const m = machine();
  const { run, held } = seedingRun(m, '.claude/CLAUDE.md');
  const { io, deps } = depsFor(m, { runTrial: run, runInit: initStandIn });
  assert.equal(await suiteMain(runArgv(m, { '--configs': 'current,current-without-claude-md', '--efforts': 'medium' }), ENV, deps), 0, io.err);
  assert.deepEqual(held, { current: true, 'current-without-claude-md': false });
  const configs = new Map(run.trials.map((trial) => [trial.config.name, trial.config]));
  assert.deepEqual(configs.get('current-without-claude-md').args({ effort: 'medium' }), configs.get('current').args({ effort: 'medium' }), 'the arm runs as current does');
  const doc = readDoc(m);
  assert.deepEqual(keysOf(doc.trials).sort(), ['alpha|current-without-claude-md|medium|1', 'alpha|current|medium|1', 'beta|current-without-claude-md|medium|1', 'beta|current|medium|1']);
  const pin = doc.arms?.['current-without-claude-md'];
  assert.deepEqual({ ...pin, sha256: '' }, { base: 'current', components: ['claude-md'], sha256: '' });
  assert.match(pin.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(doc.arms), ['current-without-claude-md']);
});

test('a run without arms records no arms, as before', async () => {
  const m = machine();
  const { io, deps } = depsFor(m);
  assert.equal(await suiteMain(runArgv(m, { '--efforts': 'medium' }), ENV, deps), 0, io.err);
  assert.equal('arms' in readDoc(m), false);
});

test('an arm whose component the home does not hold stops the run before any trial, with no results file and no template left', async () => {
  const m = machine();
  const { io, deps } = depsFor(m, { runInit: initStandIn });
  assert.equal(await suiteMain(runArgv(m, { '--configs': 'current,current-without-agents', '--efforts': 'medium' }), ENV, deps), 1);
  assert.match(io.err, /agents is not in the current arm's home/);
  assert.deepEqual(deps.runTrial.asked, []);
  assert.equal(fs.existsSync(resultsFile(m)), false);
  assert.deepEqual(templatesIn(m.workRoot), []);
});

test('an arm is continued on the same cut, and refused on another or on none, before any trial and with the file untouched', async () => {
  const m = machine();
  const configs = 'current,current-without-claude-md';
  const first = depsFor(m, { runInit: initStandIn });
  assert.equal(await suiteMain(runArgv(m, { '--configs': configs, '--efforts': 'medium' }), ENV, first.deps), 0, first.io.err);
  const same = depsFor(m, { runInit: initStandIn });
  assert.equal(await suiteMain(runArgv(m, { '--configs': configs, '--efforts': 'medium', '--repeats': '2' }), ENV, same.deps), 0, same.io.err);
  assert.equal(same.deps.runTrial.asked.length, 4, 'the same cut continues');

  const doc = readDoc(m);
  const pinned = doc.arms['current-without-claude-md'].sha256;
  for (const [label, arms] of [['another cut', { 'current-without-claude-md': { base: 'current', components: ['claude-md'], sha256: '0'.repeat(64) } }], ['no pin', undefined]]) {
    write(resultsFile(m), JSON.stringify({ ...doc, arms }));
    const before = fs.readFileSync(resultsFile(m));
    const again = depsFor(m, { runInit: initStandIn });
    assert.equal(await suiteMain(runArgv(m, { '--configs': configs, '--efforts': 'medium', '--repeats': '3' }), ENV, again.deps), 1, label);
    assert.match(again.io.err, /another cut of an arm/, label);
    assert.match(again.io.err, new RegExp(`cut of current-without-claude-md: ${arms ? 'sha256 000000000000' : 'unknown'} -> sha256 ${pinned.slice(0, 12)}`), label);
    assert.deepEqual(again.deps.runTrial.asked, [], label);
    assert.deepEqual(fs.readFileSync(resultsFile(m)), before, label);
  }
});

test('a minimal-with arm runs as minimal does with its one server from the template put in, and that server is pinned (G2, C6b)', async () => {
  const m = machine();
  write(path.join(m.realHome, '.claude.json'), JSON.stringify({ mcpServers: { context7: { command: 'c7' }, other: { command: 'o' } } }));
  const { run, held } = seedingRun(m, '.claude/mcp-with.json');
  const { io, deps } = depsFor(m, { runTrial: run });
  assert.equal(await suiteMain(runArgv(m, { '--configs': 'minimal,minimal-with-mcp-context7', '--efforts': 'medium' }), ENV, deps), 0, io.err);
  assert.deepEqual(held, { minimal: false, 'minimal-with-mcp-context7': true });
  const configs = new Map(run.trials.map((trial) => [trial.config.name, trial.config]));
  const home = path.join(m.base, 'a-home');
  assert.deepEqual(configs.get('minimal-with-mcp-context7').args({ effort: 'medium', home }), [...configs.get('minimal').args({ effort: 'medium', home }), '--mcp-config', path.join(home, '.claude', 'mcp-with.json')]);
  const seeded = JSON.parse(fs.readFileSync(path.join(m.base, 'seeded', 'minimal-with-mcp-context7-alpha-medium', '.claude', 'mcp-with.json'), 'utf8'));
  assert.deepEqual(seeded, { mcpServers: { context7: { command: 'c7' } } });
  const doc = readDoc(m);
  const pin = doc.arms?.['minimal-with-mcp-context7'];
  assert.deepEqual({ ...pin, sha256: '' }, { base: 'minimal', components: ['mcp-context7'], sha256: '' });
  assert.match(pin.sha256, /^[0-9a-f]{64}$/);
  assert.equal('setup' in doc, false, 'the setup is the current arm\'s, and this run has none');
  assert.deepEqual(templatesIn(m.workRoot), []);
});

test('a minimal-with arm is pinned by the server it puts in: another server changing continues it, its own changing stops it', async () => {
  const m = machine();
  const servers = (context7) => write(path.join(m.realHome, '.claude.json'), JSON.stringify({ mcpServers: { context7, other: { command: 'o' } } }));
  const argv = (repeats) => runArgv(m, { '--configs': 'minimal,minimal-with-mcp-context7', '--efforts': 'medium', '--repeats': repeats });
  servers({ command: 'c7' });
  const first = depsFor(m);
  assert.equal(await suiteMain(argv('1'), ENV, first.deps), 0, first.io.err);
  const pinned = readDoc(m).arms['minimal-with-mcp-context7'].sha256;

  write(path.join(m.realHome, '.claude.json'), JSON.stringify({ mcpServers: { context7: { command: 'c7' }, other: { command: 'changed' } } }));
  const same = depsFor(m);
  assert.equal(await suiteMain(argv('2'), ENV, same.deps), 0, same.io.err);
  assert.equal(same.deps.runTrial.asked.length, first.deps.runTrial.asked.length, 'a server the arm does not put in is no part of its pin');
  assert.equal(readDoc(m).arms['minimal-with-mcp-context7'].sha256, pinned);

  servers({ command: 'c7', args: ['--other'] });
  const before = fs.readFileSync(resultsFile(m));
  const again = depsFor(m);
  assert.equal(await suiteMain(argv('3'), ENV, again.deps), 1);
  assert.match(again.io.err, new RegExp(`cut of minimal-with-mcp-context7: sha256 ${pinned.slice(0, 12)} -> sha256 [0-9a-f]{12}`));
  assert.deepEqual(again.deps.runTrial.asked, []);
  assert.deepEqual(fs.readFileSync(resultsFile(m)), before);
});

test('a minimal-with arm whose server the home does not hold stops the run before any trial; --plan states an arm\'s trials as unknown', async () => {
  const m = machine();
  const { io, deps } = depsFor(m);
  assert.equal(await suiteMain(runArgv(m, { '--configs': 'minimal,minimal-with-mcp-engram' }), ENV, deps), 1);
  assert.match(io.err, /mcp-engram is not in the current arm's home/);
  assert.deepEqual(deps.runTrial.asked, []);
  assert.equal(fs.existsSync(resultsFile(m)), false);
  assert.deepEqual(templatesIn(m.workRoot), []);
  const plan = depsFor(m);
  assert.equal(await suiteMain([...runArgv(m, { '--configs': 'current,current-without-skills', '--efforts': 'medium' }), '--plan'], {}, plan.deps), 0, plan.io.err);
  assert.match(plan.io.out, /unknown for 4 trials, .*alpha current-without-skills medium \(1\)/);
});

test('a Codex arm runs in a home seeded from the Codex template without its component, and its cut is pinned', async () => {
  const m = codexMachine();
  const { run, held } = seedingRun(m, '.codex/AGENTS.md');
  const { io, deps } = codexDeps(m, { runTrial: run, runInit: initStandIn });
  assert.equal(await suiteMain(codexRunArgv(m, { '--configs': 'current,current-without-agents-md', '--efforts': 'medium' }), ENV, deps), 0, io.err);
  assert.deepEqual(held, { current: true, 'current-without-agents-md': false });
  const configs = new Map(run.trials.map((trial) => [trial.config.name, trial.config]));
  assert.deepEqual(configs.get('current-without-agents-md').args({ effort: 'medium', workspace: m.base }), configs.get('current').args({ effort: 'medium', workspace: m.base }));
  const pin = readCodexDoc(m).arms?.['current-without-agents-md'];
  assert.deepEqual({ ...pin, sha256: '' }, { base: 'current', components: ['agents-md'], sha256: '' });
});

// ---- the honesty runs -------------------------------------------------------------------------------------------------
// The two honesty configs (`configs.mjs`, `odd/tasks/honesty-audit.md`, T10) are Claude Code runs of the minimal arm
// whose trial workspace holds a project memory: the template's text, and in one of them the line under test. They keep
// what they write in an `honesty` directory of their own, which their report (`evals/honesty-report.mjs`) reads.

const HONESTY_NAMES = ['honesty-base', 'honesty-line'];
const HONESTY_MEMORY = '# Project\n\n## What good looks like\nA behavior change arrives with the test that proves it, written first. A claim about this project carries its evidence.\n';
/** What a results document pins of each honesty config: the SHA-256 of the memory text it seeds. The two texts are
 * written out here, so that a changed template or line changes the pin and is not silent. */
const HONESTY_PINS = {
  'honesty-base': { memorySha256: sha256(HONESTY_MEMORY) },
  'honesty-line': { memorySha256: sha256(`${HONESTY_MEMORY}Each claim is checked, assumed or not known.\n`) },
};
const HONESTY_RUN = { ...RUN, honestyConfigs: HONESTY_PINS };
const honestyArgv = (m, changes = {}) => runArgv(m, { '--configs': HONESTY_NAMES.join(','), '--efforts': 'medium', ...changes });
const honestyResultsFile = (m, name = 'screen') => path.join(m.resultsDir, 'honesty', `${name}.json`);
const readHonestyDoc = (m, name) => JSON.parse(fs.readFileSync(honestyResultsFile(m, name), 'utf8'));
/** The plan of a run of the two honesty configs: 2 tasks x 2 configs x medium x 1 repeat, 4 trials. */
const HONESTY_PLAN = subPlan(HONESTY_NAMES);

test('the two honesty configs are taken by a Claude run and parse like any other config; a Codex run takes neither', () => {
  assert.deepEqual(parse({ '--configs': HONESTY_NAMES.join(','), '--efforts': 'medium' }), {
    mode: 'run', claude: CLAUDE, configs: HONESTY_NAMES, efforts: ['medium'], repeats: 3, tasks: TASKS, permissionMode: 'bypassPermissions', name: 'ab-run', workRoot: null,
  });
  assert.deepEqual(parse({ '--configs': 'honesty-line' }).configs, ['honesty-line']);
  for (const configs of ['honesty-both', 'honesty-base,honesty-base']) assert.throws(() => parse({ '--configs': configs }), usageError(/--configs/), configs);
  assert.throws(() => parseCodex({ '--configs': 'honesty-base' }), usageError(/"honesty-base" is not config \(one of minimal, current\)/));
  assert.match(USAGE, /honesty-base, honesty-line/);
});

test('a run that mixes honesty configs with minimal, current or subagent configs is refused before anything is created, and the refusal says why', async () => {
  for (const configs of ['minimal,honesty-base', 'honesty-line,current', 'honesty-base,minimal,honesty-line']) {
    assert.throws(() => parse({ '--configs': configs }), usageError(/--configs: honesty-\S+ cannot share a run with (minimal|current): .*evals\/results\/honesty\/.*evals\/report\.mjs/), configs);
  }
  assert.throws(() => parse({ '--configs': 'sub-opus-write,honesty-base' }), usageError(/--configs: sub-opus-write cannot share a run with honesty-base: .*evals\/results\/subagents\//));
  const m = machine();
  const { io, deps } = depsFor(m);
  assert.equal(await suiteMain(honestyArgv(m, { '--configs': 'minimal,honesty-base' }), ENV, deps), 2);
  assert.match(io.err, /honesty-base cannot share a run with minimal/);
  assert.ok(io.err.includes(USAGE), 'the usage is printed');
  assert.deepEqual(deps.runTrial.asked, []);
  nothingCreated(m);
  assert.match(USAGE, /evals\/results\/honesty\/<name>\.json and evals\/runs\/honesty\//);
});

test('an honesty run keeps everything in an honesty directory of its own, pins the project memory of each config, and is summarized with its own report', async () => {
  const m = machine();
  const during = [];
  const { io, deps } = depsFor(m, { runTrial: fakeRun(() => { during.push(templatesIn(m.workRoot)); }) });
  assert.equal(await suiteMain(honestyArgv(m), ENV, deps), 0, io.err);
  assert.deepEqual(fs.readdirSync(m.resultsDir), ['honesty'], 'nothing is written beside the results the report reads');
  assert.deepEqual(fs.readdirSync(path.join(m.resultsDir, 'honesty')), ['screen.json'], 'no temporary file is left');
  const doc = readHonestyDoc(m);
  assert.deepEqual({ ...doc, trials: keysOf(doc.trials) }, {
    format: 1, name: 'screen', createdAt: '2026-10-02T12:00:00.000Z', ...HONESTY_RUN,
    args: { claude: m.claude, configs: HONESTY_NAMES, efforts: ['medium'], repeats: 1, tasks: ['alpha', 'beta'], workRoot: m.workRoot },
    trials: HONESTY_PLAN,
  });
  assert.deepEqual(deps.runTrial.asked, HONESTY_PLAN);
  assert.ok(deps.runTrial.trials.every((trial) => trial.runsDir === path.join(m.runsDir, 'honesty', 'screen')), 'the raw logs of an honesty run are under runs/honesty/<name>/');
  assert.ok(io.out.includes(`results: ${honestyResultsFile(m)}`), 'the summary names the file');
  assert.doesNotMatch(io.out, /Headroom/, 'no screen of the minimal arm for a run that has none');
  assert.match(io.out, /The comparison of the two arms is evals\/honesty-report\.mjs's\./);
  assert.ok(during.length === HONESTY_PLAN.length && during.every((entries) => entries.length === 0), 'no home template is built: the honesty configs seed their own memory');
  // Each trial is the minimal arm's argv with the project source loaded, under the eval's token.
  const context = { effort: 'medium', home: path.join(m.base, 'home'), workspace: path.join(m.base, 'ws'), prepared: { engramPort: 41000 } };
  for (const trial of deps.runTrial.trials) {
    const agent = resolveAgent(trial.config, context);
    assert.equal(agent.args[agent.args.indexOf('--setting-sources') + 1], 'project', trial.config.name);
    assert.equal(agent.env.CLAUDE_CODE_OAUTH_TOKEN, FAKE_TOKEN, trial.config.name);
  }
});

test('a resumed honesty run pins the project memory of each config it recorded: a changed one is named, and a config new to the run is not a change', () => {
  const recorded = { ...HONESTY_RUN, trials: [{ config: 'honesty-base' }, { config: 'honesty-line' }] };
  assert.deepEqual(diffRun(recorded, HONESTY_RUN), []);
  const earlier = sha256('an earlier memory');
  assert.deepEqual(diffRun({ ...recorded, honestyConfigs: { ...HONESTY_PINS, 'honesty-line': { memorySha256: earlier } } }, HONESTY_RUN), [
    { field: 'project memory of honesty-line', recorded: earlier, current: HONESTY_PINS['honesty-line'].memorySha256 },
  ]);
  // A file that holds trials of a config and no pin of it says nothing of what they were told: unknown, not equal.
  assert.deepEqual(diffRun({ ...recorded, honestyConfigs: { 'honesty-base': HONESTY_PINS['honesty-base'] } }, HONESTY_RUN), [
    { field: 'project memory of honesty-line', recorded: null, current: HONESTY_PINS['honesty-line'].memorySha256 },
  ]);
  assert.deepEqual(diffRun({ ...HONESTY_RUN, honestyConfigs: { 'honesty-base': HONESTY_PINS['honesty-base'] }, trials: [{ config: 'honesty-base' }] }, HONESTY_RUN), [], 'a config new to the run was never recorded');
});

test('an honesty run cut by a stop continues with the missing trials only; one whose project memory changed is refused, naming which, with the file left as it was', async () => {
  const m = machine();
  const cut = depsFor(m, { runTrial: fakeRun((trial, number) => (number === 3 ? stopped('cap')() : undefined)) });
  assert.equal(await suiteMain(honestyArgv(m), ENV, cut.deps), 1);
  assert.match(cut.io.err, /stopped: cap/);
  assert.deepEqual(keysOf(readHonestyDoc(m).trials), HONESTY_PLAN.slice(0, 2));
  const before = fs.readFileSync(honestyResultsFile(m), 'utf8');

  // The same trials, recorded as told another memory: a changed memory is another measurement.
  const earlier = sha256('an earlier memory');
  write(honestyResultsFile(m, 'other-memory'), JSON.stringify({ ...JSON.parse(before), name: 'other-memory', honestyConfigs: { ...HONESTY_PINS, 'honesty-line': { memorySha256: earlier } } }));
  const other = depsFor(m);
  assert.equal(await suiteMain(honestyArgv(m, { '--name': 'other-memory' }), ENV, other.deps), 1);
  assert.match(other.io.err, /other-memory\.json was recorded with another project memory, and the project memory of a config must not change within a run, so it is not continued:/);
  assert.ok(other.io.err.includes(`  project memory of honesty-line: sha256 ${earlier.slice(0, 12)} -> sha256 ${HONESTY_PINS['honesty-line'].memorySha256.slice(0, 12)}\n`), other.io.err);
  assert.doesNotMatch(other.io.err, /another stack|delegation/);
  assert.deepEqual(other.deps.runTrial.asked, []);
  assert.equal(fs.readFileSync(honestyResultsFile(m), 'utf8'), before, 'nothing was rewritten');

  const resumed = depsFor(m);
  assert.equal(await suiteMain(honestyArgv(m), ENV, resumed.deps), 0, resumed.io.err);
  assert.deepEqual(resumed.deps.runTrial.asked, HONESTY_PLAN.slice(2), 'a recorded trial is never repeated');
  assert.deepEqual(keysOf(readHonestyDoc(m).trials), HONESTY_PLAN);
});

test('--honesty selects the recorded honesty run a summary reads, and is taken with --summary alone', () => {
  assert.deepEqual(parseArgs(['--summary', '--honesty', '--name', 'screen'], { taskIds: TASKS }), { mode: 'summary', honesty: true, name: 'screen' });
  assert.deepEqual(parseArgs(['--honesty', '--name', 'screen', '--summary'], { taskIds: TASKS }), { mode: 'summary', honesty: true, name: 'screen' });
  assert.throws(() => parseArgs([...argv(), '--honesty'], { taskIds: TASKS }), usageError(/--honesty selects a recorded honesty run and is taken only with --summary/));
  assert.throws(() => parseArgs(['--agent', 'codex', '--summary', '--honesty', '--name', 'screen'], { taskIds: TASKS }), usageError(/--honesty is not taken with --agent codex/));
  assert.throws(() => parseArgs(['--summary', '--honesty', '--subagents', '--name', 'screen'], { taskIds: TASKS }), usageError(/--honesty and --subagents select two different recorded runs/));
  assert.throws(() => parseArgs(['--summary', '--honesty', 'yes', '--name', 'screen'], { taskIds: TASKS }), usageError(/unexpected argument "yes"/), 'it takes no value');
  assert.throws(() => parseArgs(['--summary', '--honesty', '--configs', 'honesty-base', '--name', 'screen'], { taskIds: TASKS }), usageError(/--summary reads a recorded run/));
  assert.match(USAGE, /node evals\/suite\.mjs --summary --honesty --name <run name>/);
  assert.match(USAGE, /--honesty\s+with --summary: read the run from evals\/results\/honesty\//);
});

test('a summary of an honesty run of two tasks is refused as its report refuses it, rather than pooled into one verdict (Codex, 2026-10-15)', async () => {
  const m = machine();
  const run = depsFor(m);
  assert.equal(await suiteMain(honestyArgv(m), ENV, run.deps), 0, run.io.err);
  const report = depsFor(m);
  assert.equal(await suiteMain(['--summary', '--honesty', '--name', 'screen'], {}, report.deps), 1);
  assert.match(report.io.err, /holds trials of more than one task or effort, and the report reads one question at a time\./);
  assert.equal(report.io.out, '');
});

test('a summary reaches an honesty run only with --honesty, prints the report of its two arms, and runs nothing', async () => {
  const m = machine();
  const run = depsFor(m);
  assert.equal(await suiteMain(honestyArgv(m, { '--tasks': 'alpha' }), ENV, run.deps), 0, run.io.err);
  const before = fs.readFileSync(honestyResultsFile(m), 'utf8');

  // Without the flag a summary reads what it always read, where there is no run of that name.
  const plain = depsFor(m);
  assert.equal(await suiteMain(['--summary', '--name', 'screen'], {}, plain.deps), 1);
  assert.ok(plain.io.err.includes(`no results named screen in ${m.resultsDir}\n`), plain.io.err);
  const sub = depsFor(m);
  assert.equal(await suiteMain(['--summary', '--subagents', '--name', 'screen'], {}, sub.deps), 1);
  assert.ok(sub.io.err.includes(`no results named screen in ${path.join(m.resultsDir, 'subagents')}\n`), sub.io.err);

  const report = depsFor(m);
  assert.equal(await suiteMain(['--summary', '--honesty', '--name', 'screen'], {}, report.deps), 0, report.io.err);
  assert.equal(report.io.out, `${reportLines(summarize(readHonestyDoc(m))).join('\n')}\n`);
  assert.match(report.io.out, /^p-value \d\.\d{4} \(one-sided Fisher exact test/m);
  assert.doesNotMatch(report.io.out, /task\s+config|Headroom/, 'the rows and the screen are not its report');
  assert.deepEqual(report.deps.runTrial.asked, []);
  assert.equal(fs.readFileSync(honestyResultsFile(m), 'utf8'), before, 'nothing was rewritten');
});

// first-version T6a: a batch shows itself to the guard as a gate holder does, so no heavy test run starts beside it.
test('a run leaves the batch mark the guard reads while its trials run, and takes it away when it ends', async () => {
  const m = machine();
  const marks = [];
  const { io, deps } = depsFor(m, { runTrial: fakeRun(() => { marks.push(readBatch(m.realHome)); }) });
  assert.equal(await suiteMain(runArgv(m), ENV, deps), 0, io.err);
  assert.equal(marks.length, PLAN.length);
  for (const mark of marks) {
    assert.equal(mark?.batch, true);
    assert.equal(mark.cwd, m.repoRoot);
    assert.match(mark.command, /^suite .*--name screen/);
  }
  assert.equal(readBatch(m.realHome), null, 'the mark is gone once the run ends');
});

test('a run that stops leaves no batch mark behind', async () => {
  const m = machine();
  const { io, deps } = depsFor(m, { runTrial: fakeRun(stopped('quota')) });
  assert.equal(await suiteMain(runArgv(m), ENV, deps), 1, io.err);
  assert.equal(readBatch(m.realHome), null);
});

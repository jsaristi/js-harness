import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import {
  assertReading, checkFixtureLinks, childEnv, classifyAgentFailure, gradeWorkspace, killByPath, loadTask, parseAgentOutput, parseTap, planTrials, probeVersion, readResults, resolveAgent, runProcess,
  runSuite, runTrial, summarizeUsage, trialKey,
} from './runner.mjs';
import { parseCodexOutput, readClaudeOutput, readCodexOutput } from './agent-output.mjs';
import { trialListCost } from './transcript-usage.mjs';
import { createReaper, sweptLater } from '../bin/lib/process-tree.testkit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FAKE_AGENT = path.join(here, 'fixtures', 'fake-agent.mjs');
const SAMPLE = path.join(here, 'fixtures', 'tasks', 'sample');

// The runs of this file are not about what a process leaves behind, so their sweep is put off: each run is
// recorded and the search the real sweep makes is made once, when the file ends (`sweptLater`). A process a
// run left behind therefore lives until then, and fails the file by name here.
const later = sweptLater(runProcess);
after(() => {
  const left = later.check();
  assert.deepEqual(
    left,
    [],
    `processes outlived the run that started them: ${left.map(({ pid, name }) => `${name} (${pid})`).join(', ')}`,
  );
});

// Every directory a test makes lives under one root that is removed at the end.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-evals-test-'));
// The processes a test started are recorded here and killed first: one that is still running, in a test that
// failed, holds a directory under the scratch root and would make its removal fail too. A child is stopped
// through its handle and a pid known only as a number by its creation time, never by a number alone (see
// `process-tree.testkit.mjs`). Windows lets go of a directory a moment after its holder dies, hence the retries.
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

// ---- pure helpers ---------------------------------------------------------------------------------

const tap = (tests, pass, fail) => `TAP version 13\n1..${tests}\n# tests ${tests}\n# suites 0\n# pass ${pass}\n# fail ${fail}\n# cancelled 0\n`;

test('parseTap reads the summary counts', () => {
  assert.deepEqual(parseTap(tap(3, 2, 1)), { tests: 3, pass: 2, fail: 1 });
});

test('parseTap takes the last summary, so a nested run inside a test cannot win', () => {
  assert.deepEqual(parseTap(`${tap(9, 9, 0)}${tap(2, 1, 1)}`), { tests: 2, pass: 1, fail: 1 });
});

test('parseTap returns null for output with no summary, a zero-test summary or an impossible one', () => {
  assert.equal(parseTap(''), null);
  assert.equal(parseTap('hello'), null);
  assert.equal(parseTap(tap(0, 0, 0)), null);
  assert.equal(parseTap('# tests 2\n# pass 3\n# fail 0\n'), null);
  assert.equal(parseTap('# tests 2\n# pass 1\n'), null);
});

test('parseAgentOutput returns the result object, also from an array of messages', () => {
  const result = { type: 'result', is_error: false, result: 'ok' };
  assert.deepEqual(parseAgentOutput(JSON.stringify(result)), result);
  assert.deepEqual(parseAgentOutput(JSON.stringify([{ type: 'system' }, result])), result);
  assert.deepEqual(parseAgentOutput(`\n${JSON.stringify(result)}\n`), result);
});

test('parseAgentOutput returns null for anything that is not a result object', () => {
  assert.equal(parseAgentOutput(''), null);
  assert.equal(parseAgentOutput('not json'), null);
  assert.equal(parseAgentOutput('42'), null);
  assert.equal(parseAgentOutput(JSON.stringify([{ type: 'system' }])), null);
});

test('summarizeUsage adds the cache tokens to the input and reads the turns', () => {
  const output = { num_turns: 4, usage: { input_tokens: 10, cache_creation_input_tokens: 20, cache_read_input_tokens: 30, output_tokens: 5 } };
  assert.deepEqual(summarizeUsage(output), { inputTokens: 60, outputTokens: 5, turns: 4, usage: output.usage, costUsd: null, modelUsage: null, subagents: null, subagentStats: null });
});

test('summarizeUsage reports unknown, never zero, when the output has no usage', () => {
  const unknown = { inputTokens: null, outputTokens: null, turns: null, usage: null, costUsd: null, modelUsage: null, subagents: null, subagentStats: null };
  assert.deepEqual(summarizeUsage(null), unknown);
  assert.deepEqual(summarizeUsage({ type: 'result' }), unknown);
});

test('summarizeUsage records the whole session: the list cost, the usage of every model and the subagents spawned', () => {
  // `usage` counts the main thread only; `modelUsage` and `total_cost_usd` cover the session, subagents included.
  const modelUsage = {
    'model-a': { inputTokens: 5, outputTokens: 700, cacheReadInputTokens: 900, cacheCreationInputTokens: 40, costUSD: 1.5 },
    'model-b': { inputTokens: 1, outputTokens: 2, cacheReadInputTokens: 3, cacheCreationInputTokens: 4, costUSD: 0.25 },
  };
  const summary = summarizeUsage({ num_turns: 2, usage: { input_tokens: 1, cache_creation_input_tokens: 1, cache_read_input_tokens: 1, output_tokens: 1 }, total_cost_usd: 1.75, modelUsage, subagent_stats: { spawned: 3 } });
  assert.equal(summary.costUsd, 1.75);
  assert.deepEqual(summary.modelUsage, modelUsage);
  assert.equal(summary.subagents, 3);
  assert.equal(summary.outputTokens, 1, 'the main-thread counts are recorded as they were');
});

test('summarizeUsage gives null for a cost, model usage or subagent count that is missing or not of its type', () => {
  for (const output of [
    {},
    { total_cost_usd: '1.5', modelUsage: [], subagent_stats: { spawned: 'two' } },
    { total_cost_usd: Number.NaN, modelUsage: 'none', subagent_stats: 3 },
    { total_cost_usd: null, modelUsage: null, subagent_stats: null },
    { total_cost_usd: -1 },
  ]) {
    const summary = summarizeUsage(output);
    assert.equal(summary.costUsd, null, JSON.stringify(output));
    assert.equal(summary.modelUsage, null, JSON.stringify(output));
    assert.equal(summary.subagents, null, JSON.stringify(output));
  }
  assert.equal(summarizeUsage({ total_cost_usd: 0 }).costUsd, 0, 'a recorded zero is a measurement');
  assert.equal(summarizeUsage({ subagent_stats: { spawned: 0 } }).subagents, 0);
});

test('summarizeUsage keeps the whole subagent_stats as Claude Code printed it, beside the count of the spawned', () => {
  // What Claude Code 2.1.292 printed for a session that spawned one subagent (`odd/tasks/subagent-model-routing.md`, E3).
  const stats = {
    spawned: 1, requested: { background: 0, foreground: 1, unset: 0 }, started_in_background: 0, max_depth: 1, spawned_by_subagents: 0, completed: 1, failed: 0,
    killed: { parent: 0, user: 0, system: 0 }, refused: { depth_limit: 0, concurrency_limit: 0, budget: 0 }, by_type: { 'general-purpose': 1 },
  };
  const summary = summarizeUsage({ subagent_stats: stats });
  assert.deepEqual(summary.subagentStats, stats);
  assert.equal(summary.subagents, 1, 'the count F5 recorded is still there, as it was');
  // As given: an object whose count cannot be read is kept, so what was printed can still be seen.
  assert.deepEqual(summarizeUsage({ subagent_stats: { spawned: 'two', completed: 2 } }).subagentStats, { spawned: 'two', completed: 2 });
  for (const none of [undefined, null, 3, 'none', []]) assert.equal(summarizeUsage({ subagent_stats: none }).subagentStats, null, JSON.stringify(none));
});

test('summarizeUsage gives null, not 0, for a count whose field is missing', () => {
  const partial = summarizeUsage({ num_turns: 2, usage: { input_tokens: 10, cache_read_input_tokens: 30 } });
  assert.equal(partial.inputTokens, null, 'cache_creation_input_tokens is unknown, so the sum is');
  assert.equal(partial.outputTokens, null);
  assert.equal(partial.turns, 2);
  assert.equal(summarizeUsage({ usage: { output_tokens: 7 } }).outputTokens, 7);
});

test('trialKey names the four axes in a stable order', () => {
  assert.equal(trialKey({ task: 't', config: 'c', effort: 'high', repeat: 2 }), 't|c|high|2');
});

test('childEnv layers overrides over the inherited env, removes on null, and always drops NODE_TEST_CONTEXT', () => {
  const inherited = { KEEP: '1', DROP: '2', NODE_TEST_CONTEXT: 'child-v8', Path: 'old' };
  assert.deepEqual(childEnv({ DROP: null, ADD: 3 }, inherited, 'linux'), { KEEP: '1', Path: 'old', ADD: '3' });
  assert.deepEqual(childEnv({}, inherited, 'linux'), { KEEP: '1', DROP: '2', Path: 'old' });
});

test('childEnv treats names as case-insensitive on Windows only', () => {
  assert.deepEqual(childEnv({ PATH: 'new' }, { Path: 'old' }, 'win32'), { PATH: 'new' });
  assert.deepEqual(childEnv({ PATH: 'new' }, { Path: 'old' }, 'linux'), { Path: 'old', PATH: 'new' });
});

// ---- cap and auth classifier ----------------------------------------------------------------------

const errorJson = (result) => JSON.stringify({ type: 'result', is_error: true, result });

test('classifyAgentFailure recognizes the observed auth and spend-cap messages', () => {
  assert.deepEqual(classifyAgentFailure({ stdout: errorJson('Not logged in · Please run /login') }), {
    kind: 'auth',
    message: 'Not logged in · Please run /login',
  });
  assert.equal(classifyAgentFailure({ stdout: errorJson("You've hit your monthly spend limit") }).kind, 'cap');
  assert.equal(classifyAgentFailure({ stdout: errorJson('Claude usage limit reached|1760000000') }).kind, 'cap');
  assert.equal(classifyAgentFailure({ stdout: errorJson('API Error: 429 rate limit exceeded') }).kind, 'cap');
  assert.equal(classifyAgentFailure({ stdout: errorJson('Invalid API key · Fix external API key') }).kind, 'auth');
  assert.equal(classifyAgentFailure({ stdout: errorJson('OAuth token has expired') }).kind, 'auth');
});

test('classifyAgentFailure ignores an error that is neither a cap nor an auth problem', () => {
  assert.equal(classifyAgentFailure({ stdout: errorJson('the model refused') }), null);
});

test('classifyAgentFailure never reads a successful answer that mentions a limit', () => {
  const ok = JSON.stringify({ type: 'result', is_error: false, result: 'I explained the rate limit handling' });
  assert.equal(classifyAgentFailure({ stdout: ok, exitCode: 0 }), null);
});

test('classifyAgentFailure falls back to the raw text only when the agent exited non-zero without JSON', () => {
  assert.equal(classifyAgentFailure({ stdout: '', stderr: 'Error: Not logged in', exitCode: 1 }).kind, 'auth');
  assert.equal(classifyAgentFailure({ stdout: 'You hit your usage limit', stderr: '', exitCode: 1 }).kind, 'cap');
  assert.equal(classifyAgentFailure({ stdout: 'You hit your usage limit', stderr: '', exitCode: 0 }), null);
});

// ---- task loading ---------------------------------------------------------------------------------

/** A task directory under scratch, with `task.json` replaced by `json` when given. */
function makeTask(json) {
  const dir = tmp('task');
  fs.cpSync(SAMPLE, dir, { recursive: true });
  if (json !== undefined) fs.writeFileSync(path.join(dir, 'task.json'), typeof json === 'string' ? json : JSON.stringify(json));
  return dir;
}

test('loadTask reads the prompt verbatim, the grader command, the timeout and the two directories', () => {
  const task = loadTask(SAMPLE);
  assert.equal(task.id, 'sample');
  assert.equal(task.prompt, fs.readFileSync(path.join(SAMPLE, 'task.md'), 'utf8'));
  assert.deepEqual(task.grader, {
    command: 'node',
    args: ['--test', '--test-reporter=tap', '.eval-grader/sample.grade.mjs'],
  });
  assert.equal(task.timeoutMs, 30000);
  assert.equal(task.fixtureDir, path.join(SAMPLE, 'fixture'));
  assert.equal(task.graderDir, path.join(SAMPLE, 'grader'));
});

test('loadTask rejects a malformed task.json with an error that names the file and the field', () => {
  const bad = (json) => () => loadTask(makeTask(json));
  assert.throws(bad('{ nope'), /task\.json.*not valid JSON/);
  assert.throws(bad([]), /task\.json.*must be a JSON object/);
  assert.throws(bad({ timeoutMs: 1000 }), /task\.json.*"grader"/);
  assert.throws(bad({ grader: { command: '' }, timeoutMs: 1000 }), /task\.json.*"grader\.command"/);
  assert.throws(bad({ grader: { command: 'node', args: [1] }, timeoutMs: 1000 }), /task\.json.*"grader\.args"/);
  assert.throws(bad({ grader: { command: 'node' } }), /task\.json.*"timeoutMs"/);
  assert.throws(bad({ grader: { command: 'node' }, timeoutMs: 0 }), /task\.json.*"timeoutMs"/);
  assert.throws(bad({ grader: { command: 'node' }, timeoutMs: '5' }), /task\.json.*"timeoutMs"/);
});

test('loadTask rejects a task directory missing its prompt, fixture or grader', () => {
  for (const part of ['task.md', 'fixture', 'grader', 'task.json']) {
    const dir = makeTask();
    fs.rmSync(path.join(dir, part), { recursive: true });
    assert.throws(() => loadTask(dir), new RegExp(part.replace('.', '\.')), `missing ${part}`);
  }
  const empty = makeTask();
  fs.writeFileSync(path.join(empty, 'task.md'), '  \n');
  assert.throws(() => loadTask(empty), /task\.md.*empty/);
});

// ---- one trial, end to end against the fake agent ---------------------------------------------------

const entriesOf = (dir) => fs.readdirSync(dir);

/** A config whose agent is the fake agent in `mode`. Reports and counts go to files outside the
 * workspace, because the workspace is gone by the time a test reads anything. `extra.envFor(context)`
 * adds variables that depend on the trial (its home, say) to the fixed ones; the rest of `extra` is
 * spread over the config as it is. */
function fakeConfig(mode, env = {}, extra = {}) {
  const { envFor, ...rest } = extra;
  const base = { FAKE_AGENT_MODE: mode, ...env };
  return { name: 'fake', command: process.execPath, args: [FAKE_AGENT], versionArgs: [FAKE_AGENT, '--version'], env: envFor ? (context) => ({ ...base, ...envFor(context) }) : base, ...rest };
}

/** Everything one trial needs except the config; returns the options and the paths to inspect. */
function trialEnv(mode, { env = {}, config, configExtra = {}, task = loadTask(SAMPLE), ...options } = {}) {
  const workRoot = tmp('work');
  const runsDir = path.join(tmp('runs'), 'nested');
  const report = path.join(tmp('report'), 'report.json');
  const countFile = path.join(path.dirname(report), 'count.txt');
  const cfg = config ?? fakeConfig(mode, { FAKE_AGENT_REPORT: report, FAKE_AGENT_COUNT_FILE: countFile, ...env }, configExtra);
  return {
    workRoot, runsDir, report, countFile,
    // The sweep by path costs about a second (a PowerShell start), so trials that are not about it skip it;
    // the tests that are pass `sweep: undefined` to get the real one. Their runs go through `later`, so the
    // survivors of an agent are searched for once, at the end of the file, not after each run.
    options: { task, config: cfg, effort: 'medium', repeat: 1, readVersion: () => '9.9.9 (Fake Agent)', workRoot, runsDir, sweep: () => ({ killed: [] }), runProcess: later.runProcess, ...options },
    readReport: () => JSON.parse(fs.readFileSync(report, 'utf8')),
  };
}

test('a solved trial scores 1 and records tokens, turns, version and identity', async () => {
  const { options } = trialEnv('solve');
  const outcome = await runTrial(options);
  assert.equal(outcome.status, 'recorded');
  const { record } = outcome;
  assert.deepEqual(
    { ...record, wallMs: typeof record.wallMs, startedAt: typeof record.startedAt },
    {
      task: 'sample', config: 'fake', effort: 'medium', repeat: 1,
      score: 1, passed: 3, total: 3,
      inputTokens: 60, outputTokens: 5,
      usage: { input_tokens: 10, cache_creation_input_tokens: 20, cache_read_input_tokens: 30, output_tokens: 5 },
      costUsd: 0.75,
      modelUsage: {
        'fake-model': { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 30, cacheCreationInputTokens: 20, costUSD: 0.5 },
        'fake-helper-model': { inputTokens: 4, outputTokens: 6, cacheReadInputTokens: 8, cacheCreationInputTokens: 2, costUSD: 0.25 },
      },
      subagents: 2,
      subagentStats: { spawned: 2 },
      turns: 3, wallMs: 'number', cliVersion: '9.9.9 (Fake Agent)', error: null, startedAt: 'string',
    },
  );
  assert.ok(record.wallMs >= 0);
  assert.equal(new Date(record.startedAt).toISOString(), record.startedAt);
});

test('runTrial hands its agent run and its grading to the run it is given, and starts no process of its own', async () => {
  const calls = [];
  // The first call is the agent's run and the second the grader's. The agent prints nothing, so its reading is
  // unparsable and the record says so; the grader's TAP summary still scores the trial.
  const runProcess = async (options) => {
    calls.push(options);
    return calls.length === 1
      ? { stdout: '', stderr: '', exitCode: 0, timedOut: false }
      : { stdout: '# tests 2\n# pass 1\n# fail 1\n', stderr: '', exitCode: 1, timedOut: false };
  };
  const { options } = trialEnv('noop', { runProcess });
  const { record } = await runTrial(options);
  assert.equal(calls.length, 2, 'the agent, then the grader, and nothing else');
  assert.equal(calls[0].command, process.execPath);
  assert.deepEqual(calls[0].args, [FAKE_AGENT]);
  assert.equal(calls[1].command, process.execPath);
  assert.deepEqual(calls[1].args, ['--test', '--test-reporter=tap', '.eval-grader/sample.grade.mjs']);
  assert.equal(record.score, 0.5, 'the score is the one of the grader run');
  assert.equal(record.error, 'agent-output-unparsable');
});

test('a result without a cost, model usage or subagent stats is recorded with those fields null', async () => {
  const { options } = trialEnv('no-cost');
  const { record } = await runTrial(options);
  assert.equal(record.error, null);
  assert.equal(record.inputTokens, 60, 'the main-thread usage is still there');
  assert.equal(record.costUsd, null);
  assert.equal(record.modelUsage, null);
  assert.equal(record.subagents, null);
  assert.equal(record.subagentStats, null);
});

test('an untouched fixture scores strictly between 0 and 1', async () => {
  const { options } = trialEnv('noop');
  const { record } = await runTrial(options);
  assert.equal(record.passed, 2);
  assert.equal(record.total, 3);
  assert.equal(record.score, 2 / 3);
  assert.equal(record.error, null);
});

test('the agent runs in a fresh copy of the fixture with the prompt on stdin', async () => {
  const { options, readReport, workRoot } = trialEnv('noop');
  await runTrial(options);
  const report = readReport();
  assert.equal(report.prompt, fs.readFileSync(path.join(SAMPLE, 'task.md'), 'utf8'));
  assert.equal(path.dirname(report.cwd), fs.realpathSync(workRoot));
  assert.deepEqual(report.entries, ['calc.mjs']);
});

test('the hidden grader is not in the workspace while the agent runs', async () => {
  const { options, readReport } = trialEnv('solve');
  const { record } = await runTrial(options);
  const report = readReport();
  assert.equal(report.graderVisible, false);
  assert.ok(!report.entries.includes('.eval-grader'));
  assert.equal(record.score, 1, 'and it was there once the agent had exited, or there would be no score');
});

test('a grader directory the agent left behind is replaced, not merged', async () => {
  // This grader runs every `.grade.mjs` in the directory, so one the agent planted must not survive.
  const dir = makeTask({ grader: { command: 'node', args: ['--test', '--test-reporter=tap', '.eval-grader/*.grade.mjs'] }, timeoutMs: 30000 });
  const planted = path.join(dir, 'fixture', '.eval-grader');
  fs.mkdirSync(planted);
  fs.writeFileSync(path.join(planted, 'planted.grade.mjs'), "import { test } from 'node:test'; test('planted', () => {});\n");
  const { options } = trialEnv('noop', { task: loadTask(dir) });
  const { record } = await runTrial(options);
  assert.equal(record.total, 3, 'only the three real tests ran');
  assert.equal(record.passed, 2);
});

test('the agent env is merged over the inherited one; null removes a variable; node test context is dropped', async () => {
  process.env.EVALS_TEST_INHERITED = 'yes';
  process.env.EVALS_TEST_KEPT = 'kept';
  try {
    const args = [];
    const argsFor = (ctx) => {
      args.push(ctx);
      return [FAKE_AGENT, '--effort', ctx.effort];
    };
    const { options, readReport } = trialEnv('noop', { env: { EVALS_TEST_INHERITED: null, EVALS_TEST_SET: 'set' }, configExtra: { args: argsFor } });
    await runTrial({ ...options, effort: 'high' });
    const seen = readReport();
    assert.deepEqual(seen.argv, ['--effort', 'high']);
    assert.equal(seen.testContext, null, 'a nested `node --test` would otherwise act as a child and print v8 frames');
    assert.equal(seen.inherited, null);
    assert.equal(seen.kept, 'kept');
    assert.equal(seen.set, 'set');
    assert.equal(args[0].effort, 'high');
    assert.equal(args[0].task.id, 'sample');
  } finally {
    delete process.env.EVALS_TEST_INHERITED;
    delete process.env.EVALS_TEST_KEPT;
  }
});

test('the agent output is saved under a name derived from the trial key', async () => {
  const { options, runsDir } = trialEnv('solve');
  await runTrial({ ...options, effort: 'high', repeat: 2 });
  assert.deepEqual(entriesOf(runsDir).sort(), ['sample__fake__high__2.stderr.log', 'sample__fake__high__2.stdout.log']);
  const stdout = fs.readFileSync(path.join(runsDir, 'sample__fake__high__2.stdout.log'), 'utf8');
  assert.equal(JSON.parse(stdout).result, 'done');
});

test('the workspace is removed after a graded trial', async () => {
  const { options, workRoot } = trialEnv('solve');
  await runTrial(options);
  assert.deepEqual(entriesOf(workRoot), []);
});

// ---- failure paths ----------------------------------------------------------------------------------

const isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const waitUntil = async (predicate, ms = 3000) => {
  const deadline = Date.now() + ms;
  while (!predicate() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
  return predicate();
};

/** The sample task with a different grader command, so a grader failure can be made on purpose. */
const taskWithGrader = (args) => loadTask(makeTask({ grader: { command: 'node', args }, timeoutMs: 30000 }));

test('a timeout kills the whole process tree, is recorded as timeout, and the workspace is still graded', async () => {
  const task = { ...loadTask(SAMPLE), timeoutMs: 2500 };
  const { options, readReport, workRoot } = trialEnv('hang', { task });
  const { record } = await runTrial(options);
  assert.equal(record.error, 'timeout');
  assert.equal(record.score, 2 / 3, 'graded despite the timeout');
  assert.ok(record.wallMs >= 2400, `waited for the timeout (${record.wallMs} ms)`);
  assert.equal(record.inputTokens, null, 'a killed agent printed no usage');
  const { grandchildPid } = readReport();
  assert.ok(await waitUntil(() => !isAlive(grandchildPid)), `grandchild ${grandchildPid} still runs`);
  assert.deepEqual(entriesOf(workRoot), []);
});

test('an agent that exits non-zero is graded and recorded with its exit code', async () => {
  const { options, runsDir } = trialEnv('exit');
  const { record } = await runTrial(options);
  assert.equal(record.error, 'agent-exit-3');
  assert.equal(record.score, 2 / 3);
  assert.match(fs.readFileSync(path.join(runsDir, 'sample__fake__medium__1.stderr.log'), 'utf8'), /boom/);
});

test('an agent error that is neither cap nor auth is recorded, not a reason to stop', async () => {
  const { options } = trialEnv('agent-error');
  const outcome = await runTrial(options);
  assert.equal(outcome.status, 'recorded');
  assert.equal(outcome.record.error, 'agent-exit-1');
  assert.equal(outcome.record.score, 2 / 3);
});

test('output that is not a result object is recorded as unparsable, with unknown tokens', async () => {
  const { options } = trialEnv('garbage');
  const { record } = await runTrial(options);
  assert.equal(record.error, 'agent-output-unparsable');
  assert.equal(record.inputTokens, null);
  assert.equal(record.turns, null);
  assert.equal(record.usage, null);
  assert.equal(record.costUsd, null);
  assert.equal(record.modelUsage, null);
  assert.equal(record.subagents, null);
  assert.equal(record.score, 2 / 3);
});

test('an agent command that cannot be spawned stops the trial without a record and cleans up', async () => {
  const config = fakeConfig('noop', {}, { command: path.join(scratch, 'no-such-agent') });
  const { options, workRoot } = trialEnv('noop', { config });
  const outcome = await runTrial(options);
  assert.equal(outcome.status, 'stopped');
  assert.equal(outcome.reason, 'spawn');
  assert.match(outcome.message, /ENOENT/);
  assert.deepEqual(entriesOf(workRoot), []);
});

test('a grader whose output has no TAP summary scores 0 with grader-unparsable, never 1 or NaN', async () => {
  for (const script of ['console.log("all good")', 'console.log("# tests 0\n# pass 0\n# fail 0")', 'process.exit(0)']) {
    const { options, workRoot } = trialEnv('solve', { task: taskWithGrader(['-e', script]) });
    const { record } = await runTrial(options);
    assert.equal(record.score, 0, script);
    assert.equal(record.error, 'grader-unparsable', script);
    assert.equal(record.passed, null);
    assert.equal(record.total, null);
    assert.deepEqual(entriesOf(workRoot), []);
  }
});

test('a grader that never ends costs one trial: grader-timeout, score 0, workspace removed', async () => {
  const { options, workRoot } = trialEnv('solve', { task: taskWithGrader(['-e', 'setInterval(() => {}, 1000)']), graderTimeoutMs: 800 });
  const { record } = await runTrial(options);
  assert.equal(record.error, 'grader-timeout');
  assert.equal(record.score, 0);
  assert.deepEqual(entriesOf(workRoot), []);
});

test('gradeWorkspace runs the grader in the workspace through the run it is given, and scores from its TAP summary', async () => {
  const calls = [];
  const runProcess = async (options) => {
    calls.push(options);
    return { stdout: '# tests 4\n# pass 3\n# fail 1\n', stderr: '', exitCode: 1, timedOut: false };
  };
  const workspace = tmp('graded');
  const task = loadTask(SAMPLE);
  const result = await gradeWorkspace(task, workspace, { runProcess });
  assert.equal(calls.length, 1, 'one grader run, and no other process');
  assert.equal(calls[0].command, process.execPath);
  assert.deepEqual(calls[0].args, task.grader.args);
  assert.equal(calls[0].cwd, workspace);
  assert.deepEqual(result, { score: 0.75, passed: 3, total: 4, error: null });
});

test('the workspace is removed even when the trial throws', async () => {
  const task = { ...loadTask(SAMPLE), fixtureDir: path.join(scratch, 'no-such-fixture') };
  const { options, workRoot } = trialEnv('noop', { task });
  await assert.rejects(runTrial(options));
  assert.deepEqual(entriesOf(workRoot), []);
});

test('a cleanup failure is logged, not thrown, and does not lose the record', async () => {
  const { options } = trialEnv('solve');
  const logged = [];
  const realRmSync = fs.rmSync;
  fs.rmSync = (target, opts) => {
    if (String(target).includes(`${path.sep}eval-`) && !String(target).endsWith('.eval-grader')) throw new Error('EBUSY: simulated');
    return realRmSync(target, opts);
  };
  let outcome;
  try {
    outcome = await runTrial({ ...options, log: (message) => logged.push(message) });
  } finally {
    fs.rmSync = realRmSync;
  }
  assert.equal(outcome.record.score, 1);
  assert.match(logged[0], /could not remove workspace .*EBUSY: simulated/);
});

// ---- stop on cap or auth ----------------------------------------------------------------------------

for (const [mode, reason, message] of [
  ['cap', 'cap', "You've hit your monthly spend limit"],
  ['auth', 'auth', 'Not logged in · Please run /login'],
]) {
  test(`a ${reason} error stops the trial without a record and cleans the workspace`, async () => {
    const { options, workRoot, runsDir } = trialEnv(mode);
    const outcome = await runTrial(options);
    assert.deepEqual(outcome, { status: 'stopped', reason, message });
    assert.deepEqual(entriesOf(workRoot), []);
    assert.ok(fs.existsSync(path.join(runsDir, 'sample__fake__medium__1.stdout.log')), 'the raw output is kept for diagnosis');
  });
}

// ---- an interrupted trial --------------------------------------------------------------------------

test('an interrupt of a running trial stops the agent and its tree, cleans up as on every other way out, and records nothing', async () => {
  const events = [];
  const controller = new AbortController();
  const startedAt = Date.now();
  const { options, readReport, workRoot, runsDir } = trialEnv('hang', {
    configExtra: { prepare: () => ({}), cleanup: () => { events.push('cleanup'); } },
    sweep: () => { events.push('sweep'); return { killed: [] }; },
    signal: controller.signal,
  });
  const pending = runTrial(options);
  const reported = () => { try { return readReport(); } catch { return null; } };
  assert.ok(await waitUntil(() => reported() !== null, 15000), 'the agent started');
  const { pid, grandchildPid } = reported();
  reaper.pids([pid, grandchildPid], { since: startedAt });
  controller.abort();
  assert.deepEqual(await pending, { status: 'interrupted' });
  assert.ok(await waitUntil(() => !isAlive(pid) && !isAlive(grandchildPid), 10000), 'neither the agent nor its grandchild runs');
  assert.deepEqual(events, ['sweep', 'cleanup'], 'the sweep by path and the config cleanup ran, in the order of every other way out');
  assert.deepEqual(entriesOf(workRoot), [], 'the workspace and the home are gone');
  assert.equal(fs.existsSync(runsDir), false, 'an interrupted trial is not a result, and keeps no log of one');
});

test('a trial interrupted before the agent starts starts none: nothing is made when the signal is already aborted, and what prepare made is cleaned up when it came during it', async () => {
  const events = [];
  const configExtra = { prepare: () => { events.push('prepare'); return {}; }, cleanup: () => { events.push('cleanup'); } };
  const before = trialEnv('hang', { configExtra, signal: AbortSignal.abort() });
  assert.deepEqual(await runTrial(before.options), { status: 'interrupted' });
  assert.deepEqual(events, [], 'not even prepared');
  assert.deepEqual(entriesOf(before.workRoot), []);

  const controller = new AbortController();
  const during = trialEnv('hang', { configExtra: { ...configExtra, prepare: () => { events.push('prepare'); controller.abort(); return {}; } }, signal: controller.signal });
  assert.deepEqual(await runTrial(during.options), { status: 'interrupted' });
  assert.deepEqual(events, ['prepare', 'cleanup']);
  assert.equal(fs.existsSync(during.countFile), false, 'no agent ran');
  assert.deepEqual(entriesOf(during.workRoot), []);
});

// ---- suites: order, results file, resume, stop ------------------------------------------------------

test('planTrials orders by repeat first, so a suite stopped early still covers every cell once', () => {
  const axes = { tasks: [{ id: 'a' }, { id: 'b' }], configs: [{ name: 'x' }, { name: 'y' }], efforts: ['medium', 'high'], repeats: 2 };
  const plan = planTrials(axes);
  const keyOf = (trial) => trialKey({ ...trial, task: trial.task.id, config: trial.config.name });
  assert.equal(plan.length, 16);
  assert.deepEqual(plan.slice(0, 5).map(keyOf), ['a|x|medium|1', 'a|x|high|1', 'a|y|medium|1', 'a|y|high|1', 'b|x|medium|1']);
  assert.equal(keyOf(plan[8]), 'a|x|medium|2');
  assert.deepEqual(plan, planTrials(axes));
});

test('readResults skips blank and corrupt lines, so a torn last line only costs a re-run', () => {
  const file = path.join(tmp('results'), 'r.jsonl');
  assert.deepEqual(readResults(file), [], 'a missing file is an empty history');
  fs.writeFileSync(file, `${JSON.stringify({ task: 'a' })}\n\n{"task": "b"\n[1]\n${JSON.stringify({ task: 'c' })}\n`);
  assert.deepEqual(readResults(file), [{ task: 'a' }, { task: 'c' }]);
});

const recordOf = (trial) => ({ task: trial.task.id, config: trial.config.name, effort: trial.effort, repeat: trial.repeat, score: 1 });

/** A `runTrial` stand-in that records the trials it was asked for, and calls `beforeOutcome(trial)` (a
 * test that cares about the version probe passes `versionOf`) first. */
function stubTrial(log, outcomeFor = () => null, beforeOutcome = () => {}) {
  return async (trial) => {
    log.push(trialKey(recordOf(trial)));
    await beforeOutcome(trial);
    return outcomeFor(trial) ?? { status: 'recorded', record: recordOf(trial) };
  };
}

const suiteOptions = (extra = {}) => ({
  tasks: [{ id: 'a' }],
  configs: [{ name: 'x', command: 'x' }],
  efforts: ['medium'],
  repeats: 2,
  resultsPath: path.join(tmp('results'), 'nested', 'results.jsonl'),
  readVersion: () => '1.0.0',
  ...extra,
});

test('runSuite appends one JSON line per trial as it finishes and reports the counts', async () => {
  const asked = [];
  const options = suiteOptions({ runTrial: stubTrial(asked) });
  const result = await runSuite(options);
  assert.deepEqual(result, { status: 'complete', completed: 2, skipped: 0 });
  assert.deepEqual(asked, ['a|x|medium|1', 'a|x|medium|2']);
  assert.deepEqual(readResults(options.resultsPath).map(trialKey), ['a|x|medium|1', 'a|x|medium|2']);
});

test('runSuite skips every trial already in the results file', async () => {
  const options = suiteOptions();
  await runSuite({ ...options, runTrial: stubTrial([]) });
  const asked = [];
  const result = await runSuite({ ...options, repeats: 3, runTrial: stubTrial(asked) });
  assert.deepEqual(asked, ['a|x|medium|3']);
  assert.deepEqual(result, { status: 'complete', completed: 1, skipped: 2 });
});

test('runSuite reads what is recorded from a store and hands it each record as it is graded, so a results file of another shape can be resumed', async () => {
  const kept = [{ task: 'a', config: 'x', effort: 'medium', repeat: 1, score: 0.5 }];
  const store = { read: () => kept.map((record) => ({ ...record })), append: (record) => kept.push(record) };
  const asked = [];
  const { resultsPath, ...options } = suiteOptions({ store, runTrial: stubTrial(asked) });
  const result = await runSuite(options);
  assert.deepEqual(asked, ['a|x|medium|2'], 'the recorded trial is skipped');
  assert.deepEqual(result, { status: 'complete', completed: 1, skipped: 1 });
  assert.deepEqual(kept.map(trialKey), ['a|x|medium|1', 'a|x|medium|2']);
  assert.equal(fs.existsSync(resultsPath), false, 'with a store there is no results file of the runner\'s own');
});

/** What the real `runTrial` does with the `readVersion` it is handed: ask for the CLI version under the
 * env its config resolves to for this trial. A test stub that needs a version calls this. */
const versionOf = (trial) => trial.readVersion(trial.config, resolveAgent(trial.config, { effort: trial.effort, task: trial.task }).env);

test('runSuite hands each trial a cached version probe: one probe per agent command', async () => {
  const seen = [];
  const probed = [];
  const options = suiteOptions({
    configs: [{ name: 'x', command: 'claude' }, { name: 'y', command: 'claude' }],
    readVersion: (config) => {
      probed.push(config.name);
      return '2.0.0';
    },
    runTrial: async (trial) => {
      seen.push(await versionOf(trial));
      return { status: 'recorded', record: recordOf(trial) };
    },
  });
  await runSuite(options);
  assert.deepEqual(seen, ['2.0.0', '2.0.0', '2.0.0', '2.0.0']);
  assert.deepEqual(probed, ['x'], 'one probe for the one command');
});

test('runSuite does not probe the CLI when there is nothing left to run', async () => {
  const options = suiteOptions();
  await runSuite({ ...options, runTrial: stubTrial([]) });
  let probes = 0;
  const result = await runSuite({ ...options, readVersion: () => (probes += 1), runTrial: stubTrial([]) });
  assert.equal(probes, 0);
  assert.deepEqual(result, { status: 'complete', completed: 0, skipped: 2 });
});

test('runSuite stops at the first cap or auth stop: nothing more is run and nothing is recorded for it', async () => {
  for (const reason of ['cap', 'auth']) {
    const asked = [];
    const options = suiteOptions({
      repeats: 4,
      runTrial: stubTrial(asked, (trial) => (trial.repeat === 3 ? { status: 'stopped', reason, message: `msg ${reason}` } : null)),
    });
    const result = await runSuite(options);
    assert.deepEqual(result, { status: 'stopped', reason, message: `msg ${reason}`, completed: 2 });
    assert.deepEqual(asked, ['a|x|medium|1', 'a|x|medium|2', 'a|x|medium|3']);
    assert.deepEqual(readResults(options.resultsPath).map((record) => record.repeat), [1, 2]);
  }
});

test('runSuite stops at an interrupt: the trial that comes back interrupted is not recorded, and no trial starts after it', async () => {
  const asked = [];
  const controller = new AbortController();
  const seen = [];
  const options = suiteOptions({
    repeats: 4,
    signal: controller.signal,
    runTrial: stubTrial(asked, (trial) => (trial.repeat === 3 ? { status: 'interrupted' } : null), (trial) => { seen.push(trial.signal === controller.signal); }),
  });
  const result = await runSuite(options);
  assert.deepEqual(result, { status: 'interrupted', completed: 2 });
  assert.deepEqual(asked, ['a|x|medium|1', 'a|x|medium|2', 'a|x|medium|3']);
  assert.deepEqual(readResults(options.resultsPath).map((record) => record.repeat), [1, 2]);
  assert.ok(seen.every(Boolean), 'each trial is handed the signal, so it can be stopped');
});

test('runSuite checks the signal between trials: a trial that finished is recorded, and none starts once the signal is aborted', async () => {
  const asked = [];
  const controller = new AbortController();
  const options = suiteOptions({
    repeats: 4,
    signal: controller.signal,
    runTrial: stubTrial(asked, () => null, (trial) => { if (trial.repeat === 2) controller.abort(); }),
  });
  assert.deepEqual(await runSuite(options), { status: 'interrupted', completed: 2 });
  assert.deepEqual(asked, ['a|x|medium|1', 'a|x|medium|2'], 'the trial that completed is a result; the next one never starts');
  assert.deepEqual(readResults(options.resultsPath).map((record) => record.repeat), [1, 2]);

  const never = [];
  const refused = suiteOptions({ signal: AbortSignal.abort(), runTrial: stubTrial(never) });
  assert.deepEqual(await runSuite(refused), { status: 'interrupted', completed: 0 });
  assert.deepEqual(never, []);
});

test('running a suite twice against the fake agent spawns no agent for a recorded trial', async () => {
  const countFile = path.join(tmp('count'), 'count.txt');
  const workRoot = tmp('work');
  const options = {
    tasks: [loadTask(SAMPLE)],
    configs: [fakeConfig('solve', { FAKE_AGENT_COUNT_FILE: countFile }), { ...fakeConfig('noop', { FAKE_AGENT_COUNT_FILE: countFile }), name: 'fake-noop' }],
    efforts: ['medium', 'high'],
    repeats: 2,
    resultsPath: path.join(tmp('results'), 'results.jsonl'),
    runsDir: tmp('runs'),
    workRoot,
  };
  const runs = () => fs.readFileSync(countFile, 'utf8').trim().split('\n').length;

  assert.deepEqual(await runSuite(options), { status: 'complete', completed: 8, skipped: 0 });
  assert.equal(runs(), 8);

  const records = readResults(options.resultsPath);
  assert.equal(records.length, 8);
  assert.ok(records.every((record) => record.cliVersion === '9.9.9 (Fake Agent)'), 'the version comes from the agent itself');
  assert.deepEqual(records.filter((record) => record.config === 'fake').map((record) => record.score), [1, 1, 1, 1]);
  assert.deepEqual(records.filter((record) => record.config === 'fake-noop').map((record) => record.score), [2 / 3, 2 / 3, 2 / 3, 2 / 3]);

  assert.deepEqual(await runSuite(options), { status: 'complete', completed: 0, skipped: 8 });
  assert.equal(runs(), 8, 'no agent was spawned again');
  assert.deepEqual(entriesOf(workRoot), []);
});

test('a suite against a fake agent that hits the cap stops and leaves the results file without it', async () => {
  const workRoot = tmp('work');
  const options = {
    tasks: [loadTask(SAMPLE)],
    configs: [fakeConfig('cap')],
    efforts: ['medium'],
    repeats: 3,
    resultsPath: path.join(tmp('results'), 'results.jsonl'),
    runsDir: tmp('runs'),
    workRoot,
  };
  const result = await runSuite(options);
  assert.deepEqual(result, { status: 'stopped', reason: 'cap', message: "You've hit your monthly spend limit", completed: 0 });
  assert.deepEqual(readResults(options.resultsPath), []);
  assert.deepEqual(entriesOf(workRoot), []);
});

test('a suite whose agent cannot be spawned stops with reason spawn and records nothing', async () => {
  const options = {
    tasks: [loadTask(SAMPLE)],
    configs: [fakeConfig('noop', {}, { command: path.join(scratch, 'no-such-agent') })],
    efforts: ['medium'],
    repeats: 2,
    resultsPath: path.join(tmp('results'), 'results.jsonl'),
    runsDir: tmp('runs'),
    workRoot: tmp('work'),
    readVersion: () => null,
  };
  const result = await runSuite(options);
  assert.equal(result.status, 'stopped');
  assert.equal(result.reason, 'spawn');
  assert.match(result.message, /ENOENT/);
  assert.equal(result.completed, 0);
  assert.deepEqual(readResults(options.resultsPath), []);
});

test('a results file that ends in a torn line still keeps the next record readable', async () => {
  const options = suiteOptions({ repeats: 1 });
  fs.mkdirSync(path.dirname(options.resultsPath), { recursive: true });
  fs.writeFileSync(options.resultsPath, JSON.stringify({ task: 'old', config: 'x', effort: 'medium', repeat: 1 }) + '\n{"task": "a", "conf');
  const result = await runSuite({ ...options, runTrial: stubTrial([]) });
  assert.deepEqual(result, { status: 'complete', completed: 1, skipped: 0 });
  assert.deepEqual(readResults(options.resultsPath).map(trialKey), ['old|x|medium|1', 'a|x|medium|1']);
  const resumed = await runSuite({ ...options, runTrial: stubTrial([]) });
  assert.deepEqual(resumed, { status: 'complete', completed: 0, skipped: 1 }, 'the recorded trial is not run again');
});

test('planTrials rejects names that would make a trial key or a log file name ambiguous', () => {
  const axes = { tasks: [{ id: 'a' }], configs: [{ name: 'x' }], efforts: ['medium'], repeats: 1 };
  for (const bad of ['', 'a b', 'a|b', 'a/b', 'a\\b', 'a:b', 'é', '_a', 'a_', 'a__b']) {
    assert.throws(() => planTrials({ ...axes, tasks: [{ id: bad }] }), /task id/, 'task ' + JSON.stringify(bad));
    assert.throws(() => planTrials({ ...axes, configs: [{ name: bad }] }), /config name/, 'config ' + JSON.stringify(bad));
    assert.throws(() => planTrials({ ...axes, efforts: [bad] }), /effort/, 'effort ' + JSON.stringify(bad));
  }
  assert.doesNotThrow(() => planTrials({ ...axes, tasks: [{ id: 'long-horizon_2.v1' }], configs: [{ name: 'minimal' }] }));
});

test('runSuite rejects a bad name before running or recording anything', async () => {
  const asked = [];
  const options = suiteOptions({ configs: [{ name: 'bad name', command: 'x' }], runTrial: stubTrial(asked) });
  await assert.rejects(runSuite(options), /config name/);
  assert.deepEqual(asked, []);
  assert.deepEqual(readResults(options.resultsPath), []);
});

// ---- process tree and timer -------------------------------------------------------------------------

test('a descendant that keeps the pipes open after the root exits is killed, not left into grading', async () => {
  const report = path.join(tmp('report'), 'report.json');
  const run = await runProcess({
    command: process.execPath,
    args: [FAKE_AGENT],
    env: childEnv({ FAKE_AGENT_MODE: 'orphan', FAKE_AGENT_REPORT: report }),
    cwd: tmp('cwd'),
    input: 'hi',
    timeoutMs: 30000,
    graceMs: 300,
  });
  assert.equal(run.exitCode, 0);
  assert.equal(run.timedOut, false);
  assert.equal(JSON.parse(run.stdout).result, 'orphaned');
  const { grandchildPid } = JSON.parse(fs.readFileSync(report, 'utf8'));
  assert.ok(await waitUntil(() => !isAlive(grandchildPid)), 'grandchild ' + grandchildPid + ' still runs');
});

test('the timeout timer is cleared when the child exits, so a survivor holding the pipes is not a timeout', async () => {
  const child = Object.assign(new EventEmitter(), { pid: 4242, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });
  const kills = [];
  const pending = runProcess({
    command: 'agent',
    input: 'prompt',
    timeoutMs: 50,
    graceMs: 250,
    spawn: () => child,
    kill: () => kills.push('tree'),
    killSurvivors: () => kills.push('survivors'),
  });
  setTimeout(() => child.emit('exit', 0, null), 10); // in time; 'close' never comes, as if a descendant held the pipes
  const run = await pending;
  assert.equal(run.timedOut, false);
  assert.equal(run.exitCode, 0);
  assert.deepEqual(kills, ['survivors'], 'the exited root is cleaned up as a survivor hunt, not killed as a tree');
});

// ---- second review round ----------------------------------------------------------------------------

// Shape verified read-only in the installed CLI (claude.exe 2.1.284): an error result has no `result`
// field; `errors` is an array of strings carrying the same text as stderr.
const errorsJson = (errors, extra = {}) => JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true, errors, ...extra });

test('classifyAgentFailure reads the errors array of an error result, strings or objects with a message', () => {
  assert.deepEqual(classifyAgentFailure({ stdout: errorsJson(["You've hit your monthly spend limit"]), exitCode: 1 }), {
    kind: 'cap',
    message: "You've hit your monthly spend limit",
  });
  assert.equal(classifyAgentFailure({ stdout: errorsJson(['Not logged in · Please run /login']) }).kind, 'auth');
  assert.equal(classifyAgentFailure({ stdout: errorsJson([{ message: 'Invalid API key' }]) }).kind, 'auth');
  assert.equal(classifyAgentFailure({ stdout: errorsJson(['something odd', { message: 'Claude usage limit reached' }, 42, null]) }).kind, 'cap');
  assert.equal(classifyAgentFailure({ stdout: errorsJson([], { result: 'Not logged in' }) }).kind, 'auth', 'result is still read');
});

test('classifyAgentFailure ignores errors it cannot read and errors on a successful result', () => {
  assert.equal(classifyAgentFailure({ stdout: errorsJson(['the model refused']) }), null);
  assert.equal(classifyAgentFailure({ stdout: errorsJson('rate limit') }), null, 'a bare string is not the documented shape');
  assert.equal(classifyAgentFailure({ stdout: errorsJson([{ code: 7 }]) }), null);
  const ok = JSON.stringify({ type: 'result', is_error: false, errors: ['rate limit'] });
  assert.equal(classifyAgentFailure({ stdout: ok, exitCode: 0 }), null);
});

test('classifyAgentFailure never reads raw text of a run that was killed by the timeout or had no exit code', () => {
  const text = { stdout: '', stderr: 'API Error: rate limit exceeded' };
  assert.equal(classifyAgentFailure({ ...text, exitCode: 1 }).kind, 'cap');
  assert.equal(classifyAgentFailure({ ...text, exitCode: 1, timedOut: true }), null);
  assert.equal(classifyAgentFailure({ ...text, exitCode: null }), null);
});

for (const [mode, reason, message] of [
  ['cap-errors', 'cap', "You've hit your monthly spend limit"],
  ['auth-errors', 'auth', 'Not logged in · Please run /login'],
]) {
  test(`a ${reason} message in the errors array stops the trial without a record`, async () => {
    const { options, workRoot } = trialEnv(mode);
    assert.deepEqual(await runTrial(options), { status: 'stopped', reason, message });
    assert.deepEqual(entriesOf(workRoot), []);
  });
}

test('a hung agent that logged cap-like text before the kill is a timeout record, not a cap stop', async () => {
  const task = { ...loadTask(SAMPLE), timeoutMs: 2500 };
  const { options, workRoot } = trialEnv('hang-noisy', { task });
  const outcome = await runTrial(options);
  assert.equal(outcome.status, 'recorded');
  assert.equal(outcome.record.error, 'timeout');
  assert.equal(outcome.record.score, 2 / 3);
  assert.deepEqual(entriesOf(workRoot), []);
});

test('an agent that reports an error but exits 0 is recorded as agent-error and graded', async () => {
  const { options } = trialEnv('soft-error');
  const outcome = await runTrial(options);
  assert.equal(outcome.status, 'recorded');
  assert.equal(outcome.record.error, 'agent-error');
  assert.equal(outcome.record.score, 2 / 3);
});

test('a descendant that ignores the pipes and outlives a normally exiting root is killed before the run resolves', async () => {
  const report = path.join(tmp('report'), 'report.json');
  const run = await runProcess({
    command: process.execPath,
    args: [FAKE_AGENT],
    env: childEnv({ FAKE_AGENT_MODE: 'detached-quiet', FAKE_AGENT_REPORT: report }),
    cwd: tmp('cwd'),
    input: 'hi',
    timeoutMs: 30000,
  });
  assert.equal(run.exitCode, 0);
  assert.equal(JSON.parse(run.stdout).result, 'left one behind');
  const { grandchildPid } = JSON.parse(fs.readFileSync(report, 'utf8'));
  assert.ok(await waitUntil(() => !isAlive(grandchildPid)), `grandchild ${grandchildPid} still runs`);
});

test('every close path sweeps the survivors exactly once, also when the pipes close at once', async () => {
  const child = Object.assign(new EventEmitter(), { pid: 4242, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });
  const kills = [];
  const pending = runProcess({ command: 'agent', input: 'prompt', timeoutMs: 1000, spawn: () => child, kill: () => kills.push('tree'), killSurvivors: () => kills.push('survivors') });
  setTimeout(() => {
    child.emit('exit', 0, null);
    child.emit('close', 0, null);
  }, 10);
  const run = await pending;
  assert.equal(run.exitCode, 0);
  assert.deepEqual(kills, ['survivors']);
});

// A parent pid does not name a process on Windows: what a kill may take is proven from when the child started and
// exited, so runProcess has to measure both and hand them over.
test('the kill gets when the child was spawned, and the sweep also when it exited', async () => {
  const child = Object.assign(new EventEmitter(), { pid: 4242, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });
  const seen = [];
  const before = Date.now();
  const pending = runProcess({
    command: 'agent',
    input: 'prompt',
    timeoutMs: 40,
    graceMs: 20,
    spawn: () => child,
    kill: (target, lifetime) => seen.push(['tree', target === child, lifetime]),
    killSurvivors: (target, lifetime) => seen.push(['survivors', target === child, lifetime]),
  });
  await pending;
  const after = Date.now();
  assert.deepEqual(seen.map(([kind]) => kind), ['tree', 'survivors'], 'a timeout kills the tree, and the end sweeps once');
  const [tree, survivors] = seen;
  assert.ok(tree[1] && survivors[1]);
  assert.ok(tree[2].startedAt >= before && tree[2].startedAt <= after);
  assert.equal('exitedAt' in tree[2], false, 'it was still running when it was killed');
  assert.equal(survivors[2].startedAt, tree[2].startedAt);
  assert.equal('exitedAt' in survivors[2], false, 'it never exited here');

  const exiting = Object.assign(new EventEmitter(), { pid: 4243, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });
  const lifetimes = [];
  const run = runProcess({ command: 'agent', input: 'prompt', timeoutMs: 1000, spawn: () => exiting, kill: () => assert.fail('no tree kill'), killSurvivors: (target, lifetime) => lifetimes.push(lifetime) });
  const exitedBefore = Date.now();
  exiting.emit('exit', 0, null);
  exiting.emit('close', 0, null);
  await run;
  assert.equal(lifetimes.length, 1);
  assert.ok(lifetimes[0].exitedAt >= exitedBefore && lifetimes[0].exitedAt >= lifetimes[0].startedAt);
});

test('a kill that could not be done is reported on the result and never thrown out of the run', async () => {
  const child = Object.assign(new EventEmitter(), { pid: 4242, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });
  const pending = runProcess({
    command: 'agent', input: 'prompt', timeoutMs: 1000, spawn: () => child,
    kill: () => assert.fail('no tree kill'),
    killSurvivors: () => { throw new Error('the process snapshot failed (exit 1): CIM is down'); },
  });
  setTimeout(() => { child.emit('exit', 0, null); child.emit('close', 0, null); }, 10);
  const run = await pending;
  assert.equal(run.exitCode, 0);
  assert.equal(run.sweepError, 'the process snapshot failed (exit 1): CIM is down');
});

// ---- an interrupt: the owner of the signal aborts, and the run is stopped before the process ends ----------------------------

const stubChild = (pid = 4242) => Object.assign(new EventEmitter(), { pid, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });

test('an abort kills the child\'s tree once, sweeps what it left, and resolves as aborted, not as a timeout', async () => {
  const child = stubChild();
  const calls = [];
  const controller = new AbortController();
  const pending = runProcess({
    command: 'agent', input: 'prompt', timeoutMs: 60000, graceMs: 30, spawn: () => child, signal: controller.signal,
    kill: () => calls.push('tree'), killSurvivors: () => calls.push('survivors'),
  });
  controller.abort();
  const run = await pending;
  assert.deepEqual(calls, ['tree', 'survivors']);
  assert.equal(run.aborted, true);
  assert.equal(run.timedOut, false);
  controller.abort(new Error('again'));
  assert.deepEqual(calls, ['tree', 'survivors'], 'nothing happens after the run ended');
});

test('an abort that comes after the child exited kills no tree, and a signal that is already aborted spawns nothing', async () => {
  const child = stubChild();
  const calls = [];
  const controller = new AbortController();
  const pending = runProcess({ command: 'agent', input: 'prompt', timeoutMs: 60000, spawn: () => child, signal: controller.signal, kill: () => calls.push('tree'), killSurvivors: () => calls.push('survivors') });
  child.emit('exit', 0, null);
  child.emit('close', 0, null);
  controller.abort();
  const run = await pending;
  assert.deepEqual(calls, ['survivors']);
  assert.equal(run.aborted ?? false, false, 'it finished before the abort');

  const refused = await runProcess({ command: 'agent', timeoutMs: 1000, signal: AbortSignal.abort(), spawn: () => assert.fail('nothing is started for an interrupted suite') });
  assert.equal(refused.aborted, true);
  assert.equal(refused.spawnError, undefined);
});

test('a caller that passes a signal owns the interrupt: no forwarding is installed, and one that does not keeps the POSIX forwarding', { skip: process.platform === 'win32' ? 'the forwarding is POSIX only' : false }, async () => {
  const count = () => process.listenerCount('SIGINT') + process.listenerCount('SIGTERM') + process.listenerCount('SIGHUP');
  const baseline = count();
  const owned = stubChild();
  const controller = new AbortController();
  const pendingOwned = runProcess({ command: 'agent', timeoutMs: 1000, graceMs: 10, spawn: () => owned, signal: controller.signal, kill: () => {}, killSurvivors: () => {} });
  assert.equal(count(), baseline, 'a re-raised signal would end the process before the trial\'s cleanup');
  controller.abort();
  await pendingOwned;

  const forwarded = stubChild();
  const pendingForwarded = runProcess({ command: 'agent', timeoutMs: 1000, graceMs: 10, spawn: () => forwarded, kill: () => {}, killSurvivors: () => {} });
  assert.equal(count(), baseline + 3, 'the forwarding other callers rely on is unchanged');
  forwarded.emit('exit', 0, null);
  forwarded.emit('close', 0, null);
  await pendingForwarded;
  assert.equal(count(), baseline);
});

// ---- third review round -----------------------------------------------------------------------------

test('a grader command that cannot be spawned stops the trial without a record and cleans up', async () => {
  const task = loadTask(makeTask({ grader: { command: path.join(scratch, 'no-such-grader'), args: [] }, timeoutMs: 30000 }));
  const { options, workRoot } = trialEnv('solve', { task });
  const outcome = await runTrial(options);
  assert.equal(outcome.status, 'stopped');
  assert.equal(outcome.reason, 'grader-spawn');
  assert.match(outcome.message, /ENOENT/);
  assert.deepEqual(entriesOf(workRoot), []);
});

test('a suite whose grader cannot be spawned stops with reason grader-spawn and appends nothing', async () => {
  const task = loadTask(makeTask({ grader: { command: path.join(scratch, 'no-such-grader'), args: [] }, timeoutMs: 30000 }));
  const options = {
    tasks: [task],
    configs: [fakeConfig('solve')],
    runTrial: (trial) => runTrial({ ...trial, runProcess: later.runProcess }),
    efforts: ['medium'],
    repeats: 2,
    resultsPath: path.join(tmp('results'), 'results.jsonl'),
    runsDir: tmp('runs'),
    workRoot: tmp('work'),
  };
  const result = await runSuite(options);
  assert.equal(result.status, 'stopped');
  assert.equal(result.reason, 'grader-spawn');
  assert.equal(result.completed, 0);
  assert.deepEqual(readResults(options.resultsPath), []);
  assert.ok(!fs.existsSync(options.resultsPath), 'not even an empty results file: a resume must run the trial again');
});

test('planTrials rejects a repeated task id, config name or effort, which would share a trial key and a log stem', () => {
  const axes = { tasks: [{ id: 'a' }, { id: 'b' }], configs: [{ name: 'x' }, { name: 'y' }], efforts: ['medium', 'high'], repeats: 1 };
  assert.doesNotThrow(() => planTrials(axes));
  assert.throws(() => planTrials({ ...axes, tasks: [{ id: 'a' }, { id: 'b' }, { id: 'a' }] }), /duplicate task id "a"/);
  assert.throws(() => planTrials({ ...axes, configs: [{ name: 'x' }, { name: 'x' }] }), /duplicate config name "x"/);
  assert.throws(() => planTrials({ ...axes, efforts: ['high', 'medium', 'high'] }), /duplicate effort "high"/);
});

test('runSuite rejects a duplicated config name before running or recording anything', async () => {
  const asked = [];
  const options = suiteOptions({ configs: [{ name: 'x', command: 'one' }, { name: 'x', command: 'two' }], runTrial: stubTrial(asked) });
  await assert.rejects(runSuite(options), /duplicate config name "x"/);
  assert.deepEqual(asked, []);
  assert.deepEqual(readResults(options.resultsPath), []);
});

// ---- fixture links ----------------------------------------------------------------------------------

/** A task directory whose fixture holds a directory junction to `target`: the one link a Windows
 * account can always create, and always absolute. `makeTask` copies the sample first, so the junction
 * is added to a fixture that otherwise loads. */
function taskWithJunction(target) {
  const dir = makeTask();
  fs.symlinkSync(target, path.join(dir, 'fixture', 'shared'), 'junction');
  return dir;
}

test('loadTask rejects a fixture that holds a link, naming the task and the link', () => {
  const dir = taskWithJunction(tmp('outside'));
  assert.throws(() => loadTask(dir), (err) => /task task-\d+: fixture link shared is not allowed/.test(err.message));
});

test('a link whose target is inside the fixture is rejected too', () => {
  const dir = makeTask();
  const fixture = path.join(dir, 'fixture');
  fs.mkdirSync(path.join(fixture, 'src'));
  fs.symlinkSync(path.join(fixture, 'src'), path.join(fixture, 'alias'), 'junction');
  assert.throws(() => checkFixtureLinks('t', fixture), /fixture link alias is not allowed/);
});

test('checkFixtureLinks finds a link below the fixture root, not only at it', () => {
  const dir = makeTask();
  fs.mkdirSync(path.join(dir, 'fixture', 'src', 'deep'), { recursive: true });
  fs.symlinkSync(tmp('outside'), path.join(dir, 'fixture', 'src', 'deep', 'shared'), 'junction');
  assert.throws(() => checkFixtureLinks('t', path.join(dir, 'fixture')), (err) => err.message.includes(path.join('src', 'deep', 'shared')));
});

test('a fixture without links passes the check', () => {
  assert.doesNotThrow(() => checkFixtureLinks('sample', path.join(SAMPLE, 'fixture')));
  assert.doesNotThrow(() => loadTask(SAMPLE));
});

test('a trial refuses a fixture link even when the task was not built by loadTask, and leaves the shared directory alone', async () => {
  const shared = tmp('shared');
  fs.writeFileSync(path.join(shared, 'data.txt'), 'original');
  const dir = taskWithJunction(shared);
  const task = { ...loadTask(SAMPLE), fixtureDir: path.join(dir, 'fixture') };
  const { options, workRoot } = trialEnv('noop', { task });
  await assert.rejects(runTrial(options), /fixture link shared/);
  assert.deepEqual(entriesOf(workRoot), [], 'the half-made workspace is removed');
  assert.ok(!fs.existsSync(options.runsDir), 'no agent ran, so no raw output was written');
  assert.equal(fs.readFileSync(path.join(shared, 'data.txt'), 'utf8'), 'original');
});

// ---- version probe ----------------------------------------------------------------------------------

test('probeVersion runs the CLI under the env it is given, not the bare inherited one', () => {
  const config = fakeConfig('noop');
  assert.equal(probeVersion(config), '9.9.9 (Fake Agent)');
  assert.equal(probeVersion(config, { FAKE_AGENT_VERSION: '1.2.3 (Elsewhere)' }), '1.2.3 (Elsewhere)');
});

test('runSuite probes the version under each trial env, once per distinct command and env', async () => {
  const probes = [];
  const seen = [];
  const options = suiteOptions({
    configs: [
      { name: 'x', command: 'claude', env: { HOME_DIR: '/home/a' } },
      { name: 'y', command: 'claude', env: { HOME_DIR: '/home/a' } },
      { name: 'z', command: 'claude', env: () => ({ HOME_DIR: '/home/b' }) },
    ],
    efforts: ['medium', 'high'],
    repeats: 1,
    readVersion: (config, env) => {
      probes.push(`${config.name}:${env.HOME_DIR}`);
      return `v-${env.HOME_DIR}`;
    },
    runTrial: async (trial) => {
      seen.push(`${trial.config.name}=${await versionOf(trial)}`);
      return { status: 'recorded', record: recordOf(trial) };
    },
  });
  await runSuite(options);
  assert.deepEqual(probes, ['x:/home/a', 'z:/home/b'], 'x and y share command and env, so one probe; z has another env, so its own');
  assert.deepEqual(seen, ['x=v-/home/a', 'x=v-/home/a', 'y=v-/home/a', 'y=v-/home/a', 'z=v-/home/b', 'z=v-/home/b']);
});

test('runSuite probes again when the same command resolves to a different env per effort', async () => {
  const probes = [];
  const options = suiteOptions({
    configs: [{ name: 'x', command: 'claude', env: ({ effort }) => ({ STATE_DIR: `/state/${effort}` }) }],
    efforts: ['medium', 'high'],
    repeats: 2,
    readVersion: (config, env) => {
      probes.push(env.STATE_DIR);
      return '1.0.0';
    },
    runTrial: stubTrial([], undefined, versionOf),
  });
  await runSuite(options);
  assert.deepEqual(probes, ['/state/medium', '/state/high']);
});

test('runSuite shares one probe between envs that differ only in key order', async () => {
  const probes = [];
  const options = suiteOptions({
    configs: [
      { name: 'x', command: 'claude', env: { A: '1', B: '2' } },
      { name: 'y', command: 'claude', env: { B: '2', A: '1' } },
    ],
    repeats: 1,
    readVersion: (config, env) => probes.push(env),
    runTrial: stubTrial([], undefined, versionOf),
  });
  await runSuite(options);
  assert.equal(probes.length, 1);
});

// ---- per-trial home ---------------------------------------------------------------------------------

// A config with `prepare` gets a home directory of its own for every trial. The fake agent reads
// `FAKE_AGENT_READ_FILE` into its report, which is how a test sees from inside the agent what prepare did.
const homeEnv = ({ home }) => ({ FAKE_AGENT_READ_FILE: path.join(home, 'marker.txt'), HOME_DIR: home });
const writeMarker = ({ home }) => fs.writeFileSync(path.join(home, 'marker.txt'), 'prepared');

test('prepare gets a fresh home next to the workspace, with the fixture already copied, and the agent sees what it wrote', async () => {
  const calls = [];
  const prepare = async (context) => {
    calls.push({ ...context, workspaceEntries: fs.readdirSync(context.workspace), homeIsDir: fs.statSync(context.home).isDirectory() });
    writeMarker(context);
  };
  const { options, readReport, workRoot } = trialEnv('noop', { configExtra: { prepare, envFor: homeEnv } });
  await runTrial({ ...options, effort: 'high' });
  assert.equal(calls.length, 1);
  const [{ home, workspace, effort, task, workspaceEntries, homeIsDir }] = calls;
  assert.equal(effort, 'high');
  assert.equal(task.id, 'sample');
  assert.equal(path.dirname(home), workRoot);
  assert.ok(path.basename(home).startsWith('eval-home-'), home);
  assert.equal(path.dirname(workspace), workRoot);
  assert.notEqual(home, workspace);
  assert.ok(homeIsDir);
  assert.deepEqual(workspaceEntries, ['calc.mjs'], 'prepare runs after the fixture copy');
  assert.equal(readReport().fileRead, 'prepared', 'prepare finished before the agent started');
});

test('args and env resolve with the trial home and workspace; home is undefined for a config without prepare', async () => {
  const contexts = { args: [], env: [] };
  const hooks = {
    args: (context) => {
      contexts.args.push(context);
      return [FAKE_AGENT];
    },
    envFor: (context) => {
      contexts.env.push(context);
      return {};
    },
  };
  let prepared;
  await runTrial(trialEnv('noop', { configExtra: { ...hooks, prepare: ({ home }) => (prepared = home) } }).options);
  await runTrial(trialEnv('noop', { configExtra: hooks }).options);

  assert.equal(contexts.args.length, 2);
  for (const context of [...contexts.args, ...contexts.env]) {
    assert.deepEqual(Object.keys(context).sort(), ['effort', 'home', 'prepared', 'task', 'workspace']);
    assert.equal(context.effort, 'medium');
    assert.equal(context.task.id, 'sample');
    assert.equal(typeof context.workspace, 'string');
  }
  assert.equal(contexts.args[0].home, prepared);
  assert.equal(contexts.env[0].home, prepared, 'env sees the same home as args');
  assert.equal(contexts.env[0].workspace, contexts.args[0].workspace);
  assert.equal(contexts.args[1].home, undefined);
  assert.equal(contexts.env[1].home, undefined);
});

test('two trials of one config get two different homes', async () => {
  const homes = [];
  const { options } = trialEnv('noop', { configExtra: { prepare: ({ home }) => homes.push(home) } });
  await runTrial(options);
  await runTrial(options);
  assert.equal(homes.length, 2);
  assert.notEqual(homes[0], homes[1]);
});

test('a config without prepare gets no home directory', async () => {
  const seen = [];
  const { options, workRoot } = trialEnv('noop', { configExtra: { envFor: () => (seen.push(fs.readdirSync(workRoot)), {}) } });
  await runTrial(options);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].length, 1, 'only the workspace exists while the agent is about to run');
  assert.ok(!seen[0][0].startsWith('eval-home-'));
});

for (const [label, mode, status] of [['a recorded', 'solve', 'recorded'], ['a stopped', 'cap', 'stopped']]) {
  test(`the home is removed after ${label} trial, with the workspace`, async () => {
    let home;
    const { options, workRoot } = trialEnv(mode, { configExtra: { prepare: (context) => ((home = context.home), writeMarker(context)) } });
    const outcome = await runTrial(options);
    assert.equal(outcome.status, status);
    assert.ok(home);
    assert.ok(!fs.existsSync(home));
    assert.deepEqual(entriesOf(workRoot), []);
  });
}

test('a prepare that throws rejects the trial, records nothing and removes both directories', async () => {
  const { options, workRoot, runsDir, countFile } = trialEnv('solve', {
    configExtra: {
      prepare: ({ home }) => {
        fs.writeFileSync(path.join(home, 'half-made'), 'x');
        throw new Error('seed failed');
      },
    },
  });
  await assert.rejects(runTrial(options), /seed failed/);
  assert.deepEqual(entriesOf(workRoot), []);
  assert.ok(!fs.existsSync(runsDir), 'the agent never ran, so no raw output was written');
  assert.ok(!fs.existsSync(countFile));
});

test('a failure to remove the home is logged, not thrown, and does not lose the record', async () => {
  const { options } = trialEnv('solve', { configExtra: { prepare: writeMarker } });
  const logged = [];
  const realRmSync = fs.rmSync;
  fs.rmSync = (target, opts) => {
    if (String(target).includes(`${path.sep}eval-home-`)) throw new Error('EBUSY: simulated');
    return realRmSync(target, opts);
  };
  let outcome;
  try {
    outcome = await runTrial({ ...options, log: (message) => logged.push(message) });
  } finally {
    fs.rmSync = realRmSync;
  }
  assert.equal(outcome.record.score, 1);
  assert.equal(logged.length, 1);
  assert.match(logged[0], /could not remove home .*EBUSY: simulated/);
});

test('the version is probed under the trial env, after prepare and before the agent runs', async () => {
  const probes = [];
  let preparedHome;
  const { options, countFile } = trialEnv('noop', {
    configExtra: { prepare: (context) => ((preparedHome = context.home), writeMarker(context)), envFor: homeEnv },
    readVersion: (config, env) => {
      probes.push({ config: config.name, env, prepared: fs.existsSync(path.join(env.HOME_DIR, 'marker.txt')), agentRan: fs.existsSync(countFile) });
      return '4.5.6';
    },
  });
  const { record } = await runTrial(options);
  assert.equal(probes.length, 1);
  assert.equal(probes[0].config, 'fake');
  assert.equal(probes[0].env.HOME_DIR, preparedHome, 'the probe got the overrides the agent runs under, home included');
  assert.equal(probes[0].env.FAKE_AGENT_MODE, 'noop');
  assert.equal(probes[0].prepared, true);
  assert.equal(probes[0].agentRan, false);
  assert.equal(record.cliVersion, '4.5.6');
});

test('wallMs measures the agent run only, not prepare or the version probe', async () => {
  // A fake monotonic clock that only the setup steps advance: if wallMs were measured from the start of
  // the trial, it would hold their 3000 ms; measured around the agent run alone it holds none. No real
  // time is compared, so a slow host cannot flake it.
  let ticks = 0;
  const clock = () => ticks;
  const now = () => new Date(Date.UTC(2026, 0, 1) + ticks);
  const { options } = trialEnv('solve', {
    configExtra: { prepare: () => { ticks += 1500; } },
    readVersion: () => {
      ticks += 1500;
      return '1.0.0';
    },
    now,
    clock,
  });
  const { record } = await runTrial(options);
  assert.equal(record.wallMs, 0, 'the 3000 ms of setup are outside wallMs');
  assert.equal(record.startedAt, '2026-01-01T00:00:00.000Z', 'startedAt is still the start of the trial');
});

test('a pinned now() still gives a real wallMs: the timestamp source and the stopwatch are separate', async () => {
  // `now` is injected to make startedAt deterministic. Measuring the agent run with it too collapsed
  // wallMs to 0 for any pinned clock, so the duration comes from a monotonic `clock` that defaults to
  // performance.now(). The only claim is that the agent's run took time (a real child process always
  // does); there is no upper bound, so a slow host cannot flake it.
  const pinned = new Date(Date.UTC(2026, 0, 1));
  const { options } = trialEnv('solve', { now: () => pinned });
  const { record } = await runTrial(options);
  assert.ok(record.wallMs > 0, `wallMs ${record.wallMs}`);
  assert.equal(record.startedAt, '2026-01-01T00:00:00.000Z');
});

test('a relative workRoot still gives an absolute home and workspace, so nothing the agent resolves against its cwd lands in the graded tree', async () => {
  // The agent runs with the workspace as cwd: a relative home would be resolved against the workspace
  // there, but against the runner's cwd by `prepare`, so the two would name different places. The root
  // is made under the cwd (a relative path to a temp dir on another drive is absolute on Windows).
  const relativeRoot = `eval-relroot-${process.pid}-${counter++}`;
  const seen = [];
  try {
    const { options, readReport } = trialEnv('noop', {
      configExtra: { prepare: (context) => (seen.push(context), writeMarker(context)), envFor: homeEnv },
      workRoot: relativeRoot,
    });
    const { record } = await runTrial(options);
    assert.equal(record.error, null);
    assert.ok(path.isAbsolute(seen[0].home), `home ${seen[0].home}`);
    assert.ok(path.isAbsolute(seen[0].workspace), `workspace ${seen[0].workspace}`);
    const report = readReport();
    assert.ok(path.isAbsolute(report.env.HOME_DIR), 'the env the agent received names an absolute home');
    assert.equal(report.fileRead, 'prepared', 'the agent, run from the workspace, finds the home prepare filled');
    assert.deepEqual(report.entries, ['calc.mjs'], 'nothing of the home is in the graded tree');
    assert.deepEqual(fs.readdirSync(relativeRoot), [], 'both directories are removed');
  } finally {
    fs.rmSync(relativeRoot, { recursive: true, force: true });
  }
});

test('a suite probes a config with a per-trial home once per trial, since its env is never the same twice', async () => {
  const probed = [];
  const options = {
    tasks: [loadTask(SAMPLE)],
    configs: [fakeConfig('solve', {}, { prepare: writeMarker, envFor: homeEnv })],
    runTrial: (trial) => runTrial({ ...trial, runProcess: later.runProcess }),
    efforts: ['medium'],
    repeats: 2,
    resultsPath: path.join(tmp('results'), 'results.jsonl'),
    runsDir: tmp('runs'),
    workRoot: tmp('work'),
    readVersion: (config, env) => {
      probed.push(env.HOME_DIR);
      return '1.0.0';
    },
  };
  assert.deepEqual(await runSuite(options), { status: 'complete', completed: 2, skipped: 0 });
  assert.equal(probed.length, 2);
  assert.notEqual(probed[0], probed[1]);
  assert.deepEqual(readResults(options.resultsPath).map((record) => record.cliVersion), ['1.0.0', '1.0.0']);
  assert.deepEqual(entriesOf(options.workRoot), []);
});

// ---- agent resolved once per trial ------------------------------------------------------------------

test('a trial resolves its agent config once, so the version probe and the agent run under the same env', async () => {
  let resolved = 0;
  const probed = [];
  // An env function that selects something fresh on every call, such as a newly made home: if the probe
  // and the agent each resolved the config, they would see different values, and the probe would name the
  // version of an install the agent never ran.
  const envFor = () => ({ TRIAL_NONCE: `nonce-${(resolved += 1)}` });
  const { options, readReport } = trialEnv('noop', {
    configExtra: { envFor },
    readVersion: (config, env) => {
      probed.push(env.TRIAL_NONCE);
      return '1.0.0';
    },
  });
  await runTrial(options);
  assert.equal(resolved, 1, 'the env function ran once for the trial');
  assert.deepEqual(probed, ['nonce-1']);
  assert.equal(readReport().env.TRIAL_NONCE, 'nonce-1', 'the agent received the env the probe saw');
});

test('runSuite does not share a version probe between an env without a variable and one that removes it', async () => {
  // `childEnv` treats an `undefined` override as "remove the inherited variable", so `{}` and
  // `{ HOME: undefined }` give different child envs; JSON.stringify drops `undefined`, which would give
  // them one cache key and hand the second config the first one's version without a probe.
  const probes = [];
  const options = suiteOptions({
    configs: [
      { name: 'x', command: 'claude', env: {} },
      { name: 'y', command: 'claude', env: { HOME: undefined } },
      { name: 'z', command: 'claude', env: { HOME: null } },
    ],
    repeats: 1,
    readVersion: (config, env) => {
      probes.push(config.name);
      return '1.0.0';
    },
    runTrial: stubTrial([], undefined, versionOf),
  });
  await runSuite(options);
  assert.deepEqual(probes, ['x', 'y'], 'y removes HOME, so it is probed; null and undefined both remove, so z shares y');
});

// ---- sweeping a trial's processes by path -----------------------------------------------------------------

const WINDOWS_ONLY = process.platform === 'win32' ? false : 'killByPath sweeps on Windows only; on POSIX it is a documented no-op';
const SWEEPER = path.join(here, 'fixtures', 'sweep-by-path.mjs');

// Every process a test starts is recorded with `reaper` and killed when the file ends, pass or fail, so a
// failing test cannot leave a sleeper behind.

/** A detached sleeper whose command line ends with `args`; returns its pid. */
function sleeper(...args) {
  const child = reaper.child(spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', '--', ...args], { detached: true, stdio: 'ignore', windowsHide: true }));
  child.unref();
  return child.pid;
}

test('killByPath kills a process whose command line holds the root, whichever way the separators are written or the case', { skip: WINDOWS_ONLY }, async () => {
  const root = path.join(tmp('Has Spaces'), 'eval-AbCd12');
  const forward = root.split(path.sep).join('/');
  const targets = [sleeper(root), sleeper(`${forward}/sub/file.txt`), sleeper(root.toUpperCase())];
  const bystander = sleeper(path.join(tmp('elsewhere'), 'eval-ZzZz99'));
  const { killed } = killByPath([root]);
  assert.deepEqual([...killed].sort(), [...targets].sort());
  assert.ok(await waitUntil(() => targets.every((pid) => !isAlive(pid))), 'the targets are dead');
  assert.ok(isAlive(bystander), 'a process of another path is left alone');

  const other = path.join(tmp('Other Spaces'), 'eval-QqQq11');
  const backslashed = sleeper(other);
  killByPath([other.split(path.sep).join('/')]);
  assert.ok(await waitUntil(() => !isAlive(backslashed)), 'a root written with forward slashes matches a backslashed command line');
});

test('killByPath with a root nothing runs under kills nothing', { skip: WINDOWS_ONLY }, async () => {
  const bystanders = [sleeper(path.join(tmp('a'), 'eval-one')), sleeper(path.join(tmp('b'), 'eval-two'))];
  const { killed } = killByPath([path.join(tmp('unrelated'), 'eval-nobody')]);
  assert.deepEqual(killed, []);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.ok(bystanders.every(isAlive));
});

test('killByPath matches the root literally: regex metacharacters in it are ordinary characters', { skip: WINDOWS_ONLY }, async () => {
  const dir = tmp('meta');
  const root = path.join(dir, "w+(a).z'q[1]*");
  // As a regular expression `w+(a).z'q[1]*` would match the first of these (`w+` is two w, `.` is any
  // character, `[1]*` is nothing), and as a wildcard `...q[1]*` would match the second (`[1]` is the digit 1).
  const regexDecoy = sleeper(path.join(dir, "wwa-z'q"));
  const wildcardDecoy = sleeper(path.join(dir, "w+(a).z'q1-and-more"));
  const target = sleeper(root);
  const { killed } = killByPath([root]);
  assert.deepEqual(killed, [target]);
  assert.ok(await waitUntil(() => !isAlive(target)));
  assert.ok(isAlive(regexDecoy), 'the path a regex would also have matched survives');
  assert.ok(isAlive(wildcardDecoy), 'the path a wildcard would also have matched survives');
});

test('killByPath requires a boundary after the root: a sibling whose name extends it is spared, a path below it or the root in quotes or between spaces is not', { skip: WINDOWS_ONLY }, async () => {
  const root = path.join(tmp('bound'), 'eval-trial-1');
  const siblings = [sleeper(`${root}0`), sleeper(`${root}-retry`), sleeper(`${root}.bak`), sleeper(`${root}é`)];
  const targets = [
    sleeper(root), // the end of the command line
    sleeper(path.join(root, 'workspace', 'f.txt')), // a path separator
    sleeper(root.split(path.sep).join('/') + '/x'), // the other separator
    sleeper(`'${root}'`), // a quote
    sleeper(`--path=${root}`, 'next-argument'), // whitespace
    sleeper(`${root}0`, root), // a sibling first, the root itself later in the same line
  ];
  const { killed } = killByPath([root]);
  assert.deepEqual([...killed].sort((a, b) => a - b), [...targets].sort((a, b) => a - b));
  assert.ok(await waitUntil(() => targets.every((pid) => !isAlive(pid))), 'the root\'s own processes are gone');
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.ok(siblings.every(isAlive), 'trial-10 is not trial-1');
});

test('killByPath ends a match on a delimiter only: a root inside a list or a key/value argument is matched, and anything that can continue a Windows directory name is not', { skip: WINDOWS_ONLY }, async () => {
  const root = path.join(tmp('punct'), 'eval-trial-1');
  const targets = [`${root};x`, `${root},x`, `${root}=x`, `${root})`, `(${root})`].map((argument) => sleeper(argument));
  // Each of these is a legal name on Windows that merely starts with the root: killing it would be killing a bystander.
  const siblings = ['0', '+backup', '(copy)', '[2]', '.bak', '_old', '-old', 'Z', '@x', '~1', '!', '#', '%', '&', '{x}'].map((suffix) => sleeper(`${root}${suffix}`));
  const { killed } = killByPath([root]);
  assert.deepEqual([...killed].sort((a, b) => a - b), [...targets].sort((a, b) => a - b));
  assert.ok(await waitUntil(() => targets.every((pid) => !isAlive(pid))));
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.ok(siblings.every(isAlive), 'a character that can continue a name does not end the root');
});

test('the sweep script ends a root on the end of the line, a separator, a quote, whitespace or one of ; , = ) and nothing else', () => {
  let script;
  const sync = (command, args) => {
    script = Buffer.from(args[args.indexOf('-EncodedCommand') + 1], 'base64').toString('utf16le');
    return { status: 0, stdout: '', stderr: '' };
  };
  killByPath([path.join(tmp('delimiters'), 'eval-d')], { platform: 'win32', spawnSync: sync });
  assert.match(script, /\$delimiters = \[char\[\]\]@\(\[char\]92, \[char\]47, \[char\]34, \[char\]39, \[char\]59, \[char\]44, \[char\]61, \[char\]41\)/, '\\ / " \' ; , = )');
  assert.match(script, /IsWhiteSpace\(\$next\)/);
  assert.doesNotMatch(script, /IsLetterOrDigit/, 'a name is not defined by its own characters, a boundary by its delimiters');
});

test('killByPath given a root with a trailing separator still matches the processes that name it without one', { skip: WINDOWS_ONLY }, async () => {
  const root = path.join(tmp('trailing'), 'eval-trail-1');
  const target = sleeper(root);
  const sibling = sleeper(`${root}0`);
  const { killed } = killByPath([root + path.sep]);
  assert.deepEqual(killed, [target]);
  assert.ok(await waitUntil(() => !isAlive(target)));
  assert.ok(isAlive(sibling));
});

test('killByPath kills each match with its tree: a child whose own command line names nothing goes with it', { skip: WINDOWS_ONLY }, async () => {
  const root = path.join(tmp('tree'), 'eval-TrEe01');
  const pidFile = path.join(tmp('tree-pid'), 'child.txt');
  const parentCode = [
    "const { spawn } = require('node:child_process');",
    "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore', windowsHide: true });",
    "require('node:fs').writeFileSync(process.argv[1], String(child.pid));",
    'setInterval(() => {}, 1000);',
  ].join('\n');
  const startedAt = Date.now();
  const parent = reaper.child(spawn(process.execPath, ['-e', parentCode, '--', pidFile, root], { detached: true, stdio: 'ignore', windowsHide: true }));
  parent.unref();
  assert.ok(await waitUntil(() => fs.existsSync(pidFile) && fs.readFileSync(pidFile, 'utf8') !== ''), 'the parent started its child');
  const child = Number(fs.readFileSync(pidFile, 'utf8'));
  reaper.pids([child], { since: startedAt });
  assert.ok(isAlive(child));
  const { killed } = killByPath([root]);
  assert.deepEqual(killed, [parent.pid], 'only the parent names the root');
  assert.ok(await waitUntil(() => !isAlive(parent.pid) && !isAlive(child)), 'the child died with it');
});

test('killByPath succeeds when a match is already gone because an earlier match\'s tree kill took it', { skip: WINDOWS_ONLY }, async () => {
  // Parents that start a detached child whose command line names the root too: the sweep matches both, and
  // killing the parent with its tree kills the child before the sweep gets to it. Four pairs, because the
  // order the process list comes in decides whether the parent or the child is reached first.
  const root = path.join(tmp('gone'), 'eval-GoNe01');
  const parentCode = [
    "const { spawn } = require('node:child_process');",
    "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', '--', process.argv[1]], { detached: true, stdio: 'ignore', windowsHide: true });",
    "require('node:fs').writeFileSync(process.argv[2], String(child.pid));",
    'setInterval(() => {}, 1000);',
  ].join('\n');
  const startedAt = Date.now();
  const pairs = [0, 1, 2, 3].map((index) => {
    const pidFile = path.join(tmp('gone-pid'), `child-${index}.txt`);
    const parent = reaper.child(spawn(process.execPath, ['-e', parentCode, '--', root, pidFile], { detached: true, stdio: 'ignore', windowsHide: true }));
    parent.unref();
    return { parent: parent.pid, pidFile };
  });
  assert.ok(await waitUntil(() => pairs.every(({ pidFile }) => fs.existsSync(pidFile) && fs.readFileSync(pidFile, 'utf8') !== '')), 'every parent started its child');
  const children = reaper.pids(pairs.map(({ pidFile }) => Number(fs.readFileSync(pidFile, 'utf8'))), { since: startedAt });
  const everyone = [...pairs.map(({ parent }) => parent), ...children];
  const { killed } = killByPath([root]);
  assert.deepEqual([...killed].sort((a, b) => a - b), [...everyone].sort((a, b) => a - b), 'every process that named the root is reported');
  assert.ok(await waitUntil(() => everyone.every((pid) => !isAlive(pid))), 'all of them are gone');
});

test('the sweep script is quiet: no progress stream, and a failure reaches the caller as plain text', () => {
  let script;
  const sync = (command, args) => {
    script = Buffer.from(args[args.indexOf('-EncodedCommand') + 1], 'base64').toString('utf16le');
    return { status: 1, stdout: '', stderr: 'The CIM provider failed' };
  };
  assert.throws(() => killByPath([path.join(tmp('quiet'), 'eval-q')], { platform: 'win32', spawnSync: sync }), /The CIM provider failed/);
  assert.match(script, /\$ProgressPreference = 'SilentlyContinue'/);
  assert.match(script, /\[Console\]::Error\.WriteLine/);
  assert.ok(!/\*> \$null|2>&1 \| Out-Null/.test(script), 'no native-command redirection that turns a stderr line into a terminating error');
});

test('the sweep script only finds: it kills nothing, and no tree', () => {
  let script;
  const sync = (command, args) => {
    script = Buffer.from(args[args.indexOf('-EncodedCommand') + 1], 'base64').toString('utf16le');
    return { status: 0, stdout: '', stderr: '' };
  };
  killByPath([path.join(tmp('finds'), 'eval-f')], { platform: 'win32', spawnSync: sync });
  assert.ok(!/taskkill|Stop-Process|\.Kill\(/.test(script), 'the kill is process-tree.mjs\'s, after a selection by pid and creation time');
  assert.match(script, /Format-ProcessRow/);
});

test('killByPath spares the process it runs in and that process\'s ancestors, even when their command lines hold the root', { skip: WINDOWS_ONLY }, async () => {
  const root = path.join(tmp('self'), 'eval-SeLf01');
  const target = sleeper(root);
  const run = spawnSync(process.execPath, [SWEEPER, root], { encoding: 'utf8', windowsHide: true, timeout: 60000 });
  assert.equal(run.status, 0, run.stderr);
  const { killed } = JSON.parse(run.stdout);
  assert.deepEqual(killed, [target], 'only the sleeper; not the sweeper process that holds the root in its own arguments');
  assert.ok(await waitUntil(() => !isAlive(target)));
});

/** What the sweep script prints for a snapshot of `rows` (`[pid, ppid, createdAt]`), `spared` pids and `matched` pids. */
const sweepOutput = (rows, matched, spared = []) => [
  ...rows.map(([pid, ppid, created]) => `${pid}\t${ppid}\t${created ?? ''}\tx.exe`),
  ...spared.map((pid) => `S\t${pid}`),
  ...matched.map((pid) => `M\t${pid}`),
].join('\r\n') + '\r\n';

/** A `spawnSync` that answers the sweep with `first`, every kill with `kill` (a string, or a function of the targets), and keeps the calls. */
function sweepSync(first, kill = '') {
  const calls = [];
  const sync = (command, args, options) => {
    calls.push({ command, args, options });
    if (calls.length === 1) return { status: 0, stdout: first, stderr: '' };
    const targets = options.env.JS_HARNESS_KILL_TARGETS.split('\n');
    return { status: 0, stdout: typeof kill === 'function' ? kill(targets) : kill, stderr: '' };
  };
  sync.calls = calls;
  return sync;
}
const killedAll = (targets) => targets.map((target) => `K\t${target.split('@')[0]}`).join('\r\n');

test('killByPath hands the roots to PowerShell through the environment, not the command line, and kills the matches\' trees as the snapshot proves them', () => {
  const rows = [[4242, 1, 5000], [4243, 4242, 5100], [77, 1, 6000], [88, 4242, 10], [99, 1, 5200]];
  const sync = sweepSync(sweepOutput(rows, [4242, 77]), killedAll);
  const roots = [path.join(tmp('stub'), 'eval-St0b01'), path.join(tmp('stub'), 'eval Space')];
  const { killed } = killByPath(roots, { platform: 'win32', spawnSync: sync });
  assert.deepEqual(killed, [4242, 77]);
  assert.equal(sync.calls.length, 2, 'the sweep, then one kill');
  const [sweep, kill] = sync.calls;
  assert.equal(sweep.command, 'powershell');
  assert.ok(sweep.args.includes('-NoProfile'));
  assert.ok(roots.every((root) => !sweep.args.join(' ').includes(root)), 'no root is spliced into the script');
  assert.deepEqual(sweep.options.env.JS_HARNESS_KILL_ROOTS.split('\n'), roots);
  assert.deepEqual(kill.options.env.JS_HARNESS_KILL_TARGETS.split('\n').sort(), ['4242@5000', '4243@5100', '77@6000'], 'pid 88 records pid 4242 but predates it; pid 99 matched nothing');
  assert.throws(() => killByPath(roots, { platform: 'win32', spawnSync: () => ({ status: 1, stdout: '', stderr: 'boom' }) }), /sweep.*failed.*boom/);
  assert.throws(() => killByPath(roots, { platform: 'win32', spawnSync: () => ({ error: new Error('no powershell') }) }), /no powershell/);
});

test('killByPath with no match starts no kill, and spares what the script spared together with everything below it', () => {
  const root = [path.join(tmp('spare'), 'eval-Sp4re1')];
  const none = sweepSync(sweepOutput([[10, 1, 100]], []));
  assert.deepEqual(killByPath(root, { platform: 'win32', spawnSync: none }), { killed: [] });
  assert.equal(none.calls.length, 1);

  // 11 is the sweeper itself (or an ancestor of it), below a match: it and what hangs below it must stay.
  const rows = [[10, 1, 100], [11, 10, 110], [12, 11, 120], [13, 10, 130]];
  const some = sweepSync(sweepOutput(rows, [10], [11]), killedAll);
  killByPath(root, { platform: 'win32', spawnSync: some });
  assert.deepEqual(some.calls[1].options.env.JS_HARNESS_KILL_TARGETS.split('\n').sort(), ['10@100', '13@130']);
});

test('killByPath names a match it could not kill for want of a creation time, and one still running after the kill', () => {
  const root = [path.join(tmp('unproven'), 'eval-Un9r00')];
  const rows = [[10, 1, 100], [30, 1, null]];
  const sync = sweepSync(sweepOutput(rows, [10, 30]), killedAll);
  assert.throws(() => killByPath(root, { platform: 'win32', spawnSync: sync }), /not killed.*unknown.*30/);
  assert.deepEqual(sync.calls[1].options.env.JS_HARNESS_KILL_TARGETS, '10@100', 'the one that was proven is still killed');
  assert.throws(() => killByPath(root, { platform: 'win32', spawnSync: sweepSync(sweepOutput([[10, 1, 100]], [10]), 'R\t10\r\n') }), /still running after the kill: 10/);
  assert.throws(() => killByPath(root, { platform: 'win32', spawnSync: sweepSync('M\t10\r\n') }), /listed none/, 'matches without a snapshot are a failed lookup');
});

test('killByPath refuses a root that could match more than one trial: empty, relative or a filesystem root', () => {
  const never = () => assert.fail('PowerShell must not be started');
  for (const bad of ['', '   ', 'relative/dir', path.parse(scratch).root, 42, null]) {
    assert.throws(() => killByPath([bad], { platform: 'win32', spawnSync: never }), /root/, String(bad));
  }
  assert.throws(() => killByPath('not-an-array', { platform: 'win32', spawnSync: never }), /array/);
  assert.deepEqual(killByPath([], { platform: 'win32', spawnSync: never }), { killed: [] });
});

test('killByPath refuses a root that is not strictly inside `within`: only directories a runner made are ever swept', () => {
  const never = () => assert.fail('PowerShell must not be started');
  const within = tmp('trial-work');
  assert.throws(() => killByPath([within], { platform: 'win32', spawnSync: never, within }), /inside/);
  assert.throws(() => killByPath([path.dirname(within)], { platform: 'win32', spawnSync: never, within }), /inside/);
  assert.throws(() => killByPath([`${within}-sibling`], { platform: 'win32', spawnSync: never, within }), /inside/);
  assert.throws(() => killByPath([within + path.sep], { platform: 'win32', spawnSync: never, within }), /inside/, 'the same directory with a trailing separator');
  assert.throws(() => killByPath([path.join(within, 'ok'), tmp('somewhere-else')], { platform: 'win32', spawnSync: never, within }), /inside/);
  const sync = () => ({ status: 0, stdout: '', stderr: '' });
  assert.deepEqual(killByPath([path.join(within, 'eval-ok')], { platform: 'win32', spawnSync: sync, within }), { killed: [] });
});

test('killByPath refuses the work root itself however its case is spelled, which Windows treats as the same directory', { skip: WINDOWS_ONLY }, () => {
  const never = () => assert.fail('PowerShell must not be started');
  const within = tmp('Trial-Work-Case');
  for (const spelling of [within.toUpperCase(), within.toLowerCase(), within.split(path.sep).join('/')]) {
    assert.throws(() => killByPath([spelling], { platform: 'win32', spawnSync: never, within }), /inside/, spelling);
  }
  const sync = () => ({ status: 0, stdout: '', stderr: '' });
  assert.deepEqual(killByPath([path.join(within.toUpperCase(), 'eval-ok')], { platform: 'win32', spawnSync: sync, within }), { killed: [] }, 'a directory below it is fine in any case');
});

test('on POSIX killByPath does nothing, and says so: process groups already cover a trial there', () => {
  const never = () => assert.fail('nothing is spawned on POSIX');
  const result = killByPath([path.join(tmp('posix'), 'eval-x')], { platform: 'linux', spawnSync: never });
  assert.deepEqual(result.killed, []);
  assert.match(result.skipped, /POSIX/);
});

/** Reports from a trial that left a holder, and kills the holder afterwards if the test failed to. */
async function orphanTrial(env, configExtra = {}) {
  const startedAt = Date.now(); // the holder cannot have started before this
  const logs = [];
  const trial = trialEnv('orphan-by-path', { env, configExtra, sweep: undefined, log: (message) => logs.push(message) });
  const holder = () => {
    try {
      return trial.readReport().grandchildPid;
    } catch {
      return undefined;
    }
  };
  // The holder is a number read from the report, so it is killed only if it still runs and started in this trial.
  return { ...trial, logs, holder, reap: () => holder() !== undefined && isAlive(holder()) && reaper.reap([holder()], { since: startedAt }) };
}

test('a descendant whose parent already exited, and whose command line names the workspace, is killed so the workspace can be removed', { skip: WINDOWS_ONLY }, async () => {
  const trial = await orphanTrial({});
  try {
    const outcome = await runTrial(trial.options);
    assert.equal(outcome.status, 'recorded');
    assert.ok(trial.holder() > 0, 'the agent left a holder');
    assert.ok(await waitUntil(() => !isAlive(trial.holder())), `the holder ${trial.holder()} is still running`);
    assert.deepEqual(trial.logs, [], 'nothing could not be removed');
    assert.deepEqual(entriesOf(trial.workRoot), []);
  } finally {
    trial.reap();
  }
});

test('a descendant that names only the trial home is killed too, and both directories are removed', { skip: WINDOWS_ONLY }, async () => {
  const trial = await orphanTrial({ FAKE_AGENT_ORPHAN_ARG: 'home' }, { prepare: async () => {}, envFor: ({ home }) => ({ FAKE_AGENT_HOME_ARG: home }) });
  try {
    await runTrial(trial.options);
    assert.ok(await waitUntil(() => !isAlive(trial.holder())), `the holder ${trial.holder()} is still running`);
    assert.deepEqual(trial.logs, []);
    assert.deepEqual(entriesOf(trial.workRoot), []);
  } finally {
    trial.reap();
  }
});

// ---- what prepare returns, and cleanup ---------------------------------------------------------------------------

test('what prepare returns reaches args and env as `prepared`, and is undefined for a config without prepare', async () => {
  const seen = { args: [], env: [] };
  const hooks = {
    args: (context) => (seen.args.push(context.prepared), [FAKE_AGENT]),
    envFor: (context) => (seen.env.push(context.prepared), {}),
  };
  await runTrial(trialEnv('noop', { configExtra: { ...hooks, prepare: () => ({ engramPort: 42001 }) } }).options);
  await runTrial(trialEnv('noop', { configExtra: hooks }).options);
  assert.deepEqual(seen.args, [{ engramPort: 42001 }, undefined]);
  assert.deepEqual(seen.env, [{ engramPort: 42001 }, undefined]);
});

for (const [label, mode, status] of [['a solved', 'solve', 'recorded'], ['a capped', 'cap', 'stopped'], ['a failed', 'exit', 'recorded'], ['a hung', 'hang', 'recorded']]) {
  test(`cleanup runs once after ${label} trial with the prepared state, and before the directories are removed`, async () => {
    const calls = [];
    const task = mode === 'hang' ? { ...loadTask(SAMPLE), timeoutMs: 1500 } : loadTask(SAMPLE);
    const { options, workRoot } = trialEnv(mode, {
      task,
      configExtra: {
        prepare: (context) => (writeMarker(context), { engramPort: 42002 }),
        cleanup: (context) => calls.push({ ...context, homeThere: fs.existsSync(context.home), workspaceThere: fs.existsSync(context.workspace) }),
      },
    });
    const outcome = await runTrial(options);
    assert.equal(outcome.status, status);
    assert.equal(calls.length, 1);
    assert.deepEqual(Object.keys(calls[0]).sort(), ['home', 'homeThere', 'prepared', 'workspace', 'workspaceThere']);
    assert.deepEqual(calls[0].prepared, { engramPort: 42002 });
    assert.deepEqual([calls[0].homeThere, calls[0].workspaceThere], [true, true], 'the directories are still there');
    assert.deepEqual(entriesOf(workRoot), [], 'and removed afterwards');
  });
}

test('cleanup runs after the sweep by path, so a listener the sweep could not reach is still killed last', async () => {
  const order = [];
  const { options } = trialEnv('noop', {
    sweep: () => (order.push('sweep'), { killed: [] }),
    configExtra: { prepare: () => ({}), cleanup: () => order.push('cleanup') },
  });
  await runTrial(options);
  assert.deepEqual(order, ['sweep', 'cleanup']);
});

test('cleanup does not run when prepare threw, nor for a config that has none', async () => {
  const calls = [];
  const cleanup = () => calls.push('cleanup');
  await assert.rejects(runTrial(trialEnv('noop', { configExtra: { prepare: () => { throw new Error('prepare failed'); }, cleanup } }).options), /prepare failed/);
  await runTrial(trialEnv('noop', { configExtra: { cleanup } }).options);
  await runTrial(trialEnv('noop').options);
  assert.deepEqual(calls, [], 'with no prepare there is nothing to clean up');
});

test('a cleanup that throws is logged, does not lose the record and does not stop the directories being removed', async () => {
  const logs = [];
  const { options, workRoot } = trialEnv('solve', {
    log: (message) => logs.push(message),
    configExtra: { prepare: writeMarker, cleanup: () => { throw new Error('port 42003 still listens'); } },
  });
  const outcome = await runTrial(options);
  assert.equal(outcome.record.score, 1);
  assert.ok(logs.some((message) => /cleanup/.test(message) && /port 42003 still listens/.test(message)), logs.join('\n'));
  assert.deepEqual(entriesOf(workRoot), []);
});

test('a cleanup that returns a promise is waited for before the directories go', async () => {
  let finished = false;
  const { options } = trialEnv('noop', {
    configExtra: {
      prepare: writeMarker,
      cleanup: async ({ home }) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        finished = fs.existsSync(home);
      },
    },
  });
  await runTrial(options);
  assert.equal(finished, true);
});

test('runTrial sweeps the trial home and workspace, and only those, before it removes them, even when the trial throws', async () => {
  const calls = [];
  const sweep = (roots, options) => {
    calls.push({ roots, options, existed: roots.map((root) => fs.existsSync(root)) });
    return { killed: [] };
  };
  const { options, workRoot } = trialEnv('noop', { sweep, configExtra: { prepare: async () => { throw new Error('prepare failed'); } } });
  await assert.rejects(runTrial(options), /prepare failed/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].roots.length, 2, 'the home and the workspace');
  assert.ok(calls[0].roots.every((root) => path.dirname(root) === path.resolve(workRoot)), 'direct children of the work root');
  assert.deepEqual(calls[0].existed, [true, true], 'swept before removal');
  assert.equal(calls[0].options.within, path.resolve(workRoot), 'and confined to the work root');
  assert.deepEqual(entriesOf(workRoot), []);

  const plain = trialEnv('noop', { sweep });
  calls.length = 0;
  await runTrial(plain.options);
  assert.equal(calls[0].roots.length, 1, 'a config without prepare has no home to sweep');
});

test('a sweep that fails is logged and does not stop the directories being removed', async () => {
  const logs = [];
  const { options, workRoot } = trialEnv('noop', { sweep: () => { throw new Error('powershell is not here'); }, log: (message) => logs.push(message) });
  const outcome = await runTrial(options);
  assert.equal(outcome.status, 'recorded');
  assert.ok(logs.some((message) => /sweep/.test(message) && /powershell is not here/.test(message)), logs.join('\n'));
  assert.deepEqual(entriesOf(workRoot), []);
});

test('a workspace that still will not delete after the sweep is logged, not thrown, and the trial is still recorded', { skip: WINDOWS_ONLY }, async () => {
  const logs = [];
  const { options, workRoot } = trialEnv('noop', {
    configExtra: {
      prepare: async ({ workspace }) => {
        const child = reaper.child(spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { cwd: workspace, detached: true, stdio: 'ignore', windowsHide: true }));
        child.unref();
      },
    },
    sweep: () => ({ killed: [] }), // finds nothing, so the holder stays
    log: (message) => logs.push(message),
  });
  const outcome = await runTrial(options);
  assert.equal(outcome.status, 'recorded');
  assert.ok(logs.some((message) => /could not remove workspace/.test(message)), logs.join('\n'));
  assert.ok(entriesOf(workRoot).some((name) => !name.startsWith('eval-home-')), 'the workspace is what is left');
});

test('a workspace that will not delete is swept again and its removal retried', { skip: WINDOWS_ONLY }, async () => {
  const holders = [];
  const calls = [];
  const { options, workRoot } = trialEnv('noop', {
    configExtra: {
      prepare: async ({ workspace }) => {
        // A process whose cwd is the workspace: on Windows the directory cannot be removed while it runs.
        const child = reaper.child(spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { cwd: workspace, detached: true, stdio: 'ignore', windowsHide: true }));
        child.unref();
        holders.push(child);
      },
    },
    sweep: () => {
      calls.push(calls.length);
      // The first sweep finds nothing (the holder's command line names no trial directory); the second is the retry.
      if (calls.length === 2) {
        holders[0].kill('SIGKILL'); // through its handle
        // A real sweep returns once its kill has: wait for the holder to be gone, as that does.
        for (const until = Date.now() + 3000; isAlive(holders[0].pid) && Date.now() < until;);
      }
      return { killed: [] };
    },
  });
  const logs = [];
  await runTrial({ ...options, log: (message) => logs.push(message) });
  assert.deepEqual(calls, [0, 1], 'one sweep before the removal, one before the retry');
  // A directory removed while a dying process still has its handle is listed for a moment longer.
  assert.ok(await waitUntil(() => entriesOf(workRoot).length === 0), `the retry removed it, but  is still there`);
  assert.deepEqual(logs, []);
});

// ---- the reader a config carries -------------------------------------------------------------------

/** A reader that returns `reading` whatever the run, and keeps the runs it was handed in `seen`. */
function stubReader(reading) {
  const seen = [];
  const usage = { inputTokens: null, outputTokens: null, turns: null, usage: null, costUsd: null, modelUsage: null, subagents: null };
  return { seen, reader: (run) => (seen.push(run), { stop: null, parsed: true, failed: false, usage, ...reading }) };
}

test('a trial reads its agent\'s output through the reader its config carries, and records the usage that reader gives', async () => {
  const usage = { inputTokens: 7, outputTokens: 3, turns: null, usage: [{ any: 'shape' }], costUsd: null, modelUsage: null, subagents: null, cachedInputTokens: 2 };
  const { seen, reader } = stubReader({ usage });
  const { options } = trialEnv('noop', { configExtra: { reader } });
  const { record } = await runTrial(options);
  assert.equal(seen.length, 1, 'the run is read once');
  assert.equal(JSON.parse(seen[0].stdout).result, 'did nothing', 'the reader gets what the agent printed');
  assert.equal(seen[0].exitCode, 0);
  assert.equal(seen[0].timedOut, false);
  for (const [name, value] of Object.entries(usage)) assert.deepEqual(record[name], value, name);
  assert.equal(record.error, null);
  assert.equal(record.score, 2 / 3);
});

test('what the reader says decides the trial: a stop records nothing, unparsed and failed are recorded errors', async () => {
  const stopped = trialEnv('noop', { configExtra: { reader: stubReader({ stop: { kind: 'cap', message: 'out of quota' } }).reader } });
  assert.deepEqual(await runTrial(stopped.options), { status: 'stopped', reason: 'cap', message: 'out of quota' });
  assert.deepEqual(entriesOf(stopped.workRoot), []);

  const unparsed = await runTrial(trialEnv('noop', { configExtra: { reader: stubReader({ parsed: false }).reader } }).options);
  assert.equal(unparsed.record.error, 'agent-output-unparsable');
  const failed = await runTrial(trialEnv('noop', { configExtra: { reader: stubReader({ failed: true }).reader } }).options);
  assert.equal(failed.record.error, 'agent-error');
  assert.equal(failed.record.score, 2 / 3, 'and it is still graded');
  // What the process did comes before what it printed, as for Claude Code.
  const exited = await runTrial(trialEnv('exit', { configExtra: { reader: stubReader({ failed: true }).reader } }).options);
  assert.equal(exited.record.error, 'agent-exit-3');
});

test('a config whose reader is not a function is refused before anything is made or run', async () => {
  const { options, workRoot, countFile } = trialEnv('noop', { configExtra: { reader: 'codex' } });
  await assert.rejects(runTrial(options), /config fake: "reader" must be a function/);
  assert.deepEqual(entriesOf(workRoot), []);
  assert.equal(fs.existsSync(countFile), false, 'no agent ran');
});

const NO_USAGE = { inputTokens: null, outputTokens: null, turns: null, usage: null, costUsd: null, modelUsage: null, subagents: null };
const READING = { stop: null, parsed: true, failed: false, usage: NO_USAGE };

test('assertReading takes a reading of the documented shape, with whatever more its usage counts', () => {
  assert.equal(assertReading(READING, 'fake'), READING, 'and hands it back');
  const stop = { kind: 'cap', message: '' };
  const usage = { ...NO_USAGE, inputTokens: 0, outputTokens: 3.5, usage: [{ any: 'shape' }], modelUsage: { m: {} }, cachedInputTokens: 2, anything: 'else' };
  assert.doesNotThrow(() => assertReading({ stop, parsed: false, failed: true, usage }, 'fake'));
  // What each reader of this repository returns, for output it can read and for output it cannot.
  const claude = JSON.stringify({ type: 'result', is_error: false, result: 'ok', num_turns: 2, usage: { input_tokens: 1, output_tokens: 1 }, total_cost_usd: 0.1 });
  const codex = [{ type: 'thread.started', thread_id: 't' }, { type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 1 } }].map((event) => JSON.stringify(event)).join('\n');
  for (const stdout of [claude, codex, 'this is not json']) {
    const run = { stdout, stderr: '', exitCode: 0, timedOut: false };
    assert.doesNotThrow(() => assertReading(readCodexOutput(run), 'codex'));
    assert.doesNotThrow(() => assertReading(readClaudeOutput(run), 'claude'));
  }
});

test('assertReading refuses a reading of the wrong shape, naming the key that is missing or mistyped', () => {
  const without = (object, key) => Object.fromEntries(Object.entries(object).filter(([name]) => name !== key));
  const cases = [
    [null, 'its reader returned no reading: an object is expected, got null'],
    [undefined, 'its reader returned no reading: an object is expected, got undefined'],
    ['cap', 'its reader returned no reading: an object is expected, got "cap"'],
    [[], 'its reader returned no reading: an object is expected, got []'],
    [without(READING, 'stop'), 'its reader returned a reading of the wrong shape: "stop" must be null or an object with a kind and a message, got undefined'],
    [{ ...READING, stop: 'cap' }, 'its reader returned a reading of the wrong shape: "stop" must be null or an object with a kind and a message, got "cap"'],
    [{ ...READING, stop: { kind: '', message: 'out' } }, 'its reader returned a reading of the wrong shape: "stop.kind" must be a non-empty string, got ""'],
    [{ ...READING, stop: { kind: 'cap' } }, 'its reader returned a reading of the wrong shape: "stop.message" must be a string, got undefined'],
    [without(READING, 'parsed'), 'its reader returned a reading of the wrong shape: "parsed" must be true or false, got undefined'],
    [{ ...READING, failed: 'no' }, 'its reader returned a reading of the wrong shape: "failed" must be true or false, got "no"'],
    [{ ...READING, usage: null }, 'its reader returned a reading of the wrong shape: "usage" must be an object, got null'],
    [{ ...READING, usage: [] }, 'its reader returned a reading of the wrong shape: "usage" must be an object, got []'],
    [{ ...READING, usage: without(NO_USAGE, 'turns') }, 'its reader returned a reading of the wrong shape: "usage.turns" is missing'],
    [{ ...READING, usage: without(NO_USAGE, 'modelUsage') }, 'its reader returned a reading of the wrong shape: "usage.modelUsage" is missing'],
    [{ ...READING, usage: { ...NO_USAGE, inputTokens: '7' } }, 'its reader returned a reading of the wrong shape: "usage.inputTokens" must be a number or null, got "7"'],
    [{ ...READING, usage: { ...NO_USAGE, costUsd: Number.NaN } }, 'its reader returned a reading of the wrong shape: "usage.costUsd" must be a number or null, got NaN'],
    // The first one found is the one named.
    [{ stop: null, usage: {} }, 'its reader returned a reading of the wrong shape: "parsed" must be true or false, got undefined'],
  ];
  for (const [reading, message] of cases) assert.throws(() => assertReading(reading, 'fake'), (err) => err.message === `config fake: ${message}`, message);
});

test('assertReading lets no key of the usage take the place of a field the runner fills itself', () => {
  // Every field of a record that does not come from the usage: a usage key of the same name would replace
  // a graded field, or be replaced by one, and either way the record would not say what was measured.
  // The last two are filled for a config that keeps its transcripts, and refused for every config all the same.
  for (const key of ['task', 'config', 'effort', 'repeat', 'score', 'passed', 'total', 'wallMs', 'cliVersion', 'error', 'startedAt', 'transcripts', 'listCost']) {
    assert.throws(
      () => assertReading({ ...READING, usage: { ...NO_USAGE, [key]: null } }, 'fake'),
      (err) => err.message === `config fake: its reader returned a reading of the wrong shape: "usage.${key}" is a field of the record the runner fills itself, and a usage count must not replace it`,
      key,
    );
  }
});

test('a trial whose reader returns the wrong shape, or a usage that would replace a graded field, is refused: the raw output is kept and nothing is recorded', async () => {
  const shapeless = trialEnv('noop', { configExtra: { reader: () => ({ stop: null, failed: false, usage: NO_USAGE }) } });
  await assert.rejects(runTrial(shapeless.options), /config fake: its reader returned a reading of the wrong shape: "parsed" must be true or false, got undefined/);
  assert.match(fs.readFileSync(path.join(shapeless.runsDir, 'sample__fake__medium__1.stdout.log'), 'utf8'), /did nothing/, 'what the agent printed is kept: the run was paid for');
  assert.deepEqual(entriesOf(shapeless.workRoot), [], 'and the trial is cleaned up');

  // Spread into the record as it was, this usage would have turned a 2/3 into a perfect score.
  const greedy = trialEnv('noop', { configExtra: { reader: stubReader({ usage: { ...NO_USAGE, score: 1, passed: 3 } }).reader } });
  await assert.rejects(runTrial(greedy.options), /config fake: its reader returned a reading of the wrong shape: "usage\.score" is a field of the record the runner fills itself/);
  assert.deepEqual(entriesOf(greedy.workRoot), []);
});

// ---- the transcripts a config keeps ------------------------------------------------------------------
// A config may carry `transcripts`: `keep`, which copies its agent's session files into the raw logs before the
// trial home is removed, and `summarize`, which says what the record holds of them. The runner knows neither
// where those files are nor what they mean, so the tests give it stand-ins for both; the real ones are Claude
// Code's (`transcript-usage.mjs`), proven through a subagent config in `configs.test.mjs`.

const PROBE_TRANSCRIPTS = path.join(here, 'fixtures', 'transcripts', 'probe');
const STEM = 'sample__fake__medium__1';
/** The env of a fake agent that leaves transcripts in its trial home, as Claude Code does in its config directory. */
const leavesTranscripts = ({ home }) => ({ CLAUDE_CONFIG_DIR: path.join(home, '.claude'), FAKE_AGENT_TRANSCRIPTS: PROBE_TRANSCRIPTS });
const projectsOf = (home) => path.join(home, '.claude', 'projects');

/** A `transcripts` that keeps what it was called with: `keep` and `summarize` answer as given. */
function stubTranscripts({ keep = () => ({ files: 1, errors: [] }), summarize = () => ({ source: 'stub' }) } = {}) {
  const calls = { keep: [], summarize: [] };
  return {
    calls,
    transcripts: {
      keep: (context) => {
        calls.keep.push({ ...context, agentWrote: fs.existsSync(projectsOf(context.home)), destThere: fs.existsSync(context.dest) });
        return keep(context);
      },
      summarize: (context) => (calls.summarize.push(context), summarize(context)),
    },
  };
}
const keepingTrial = (mode, stub, options = {}) => trialEnv(mode, { ...options, configExtra: { prepare: () => ({ port: 1 }), envFor: leavesTranscripts, transcripts: stub.transcripts, ...options.configExtra } });

test('a config that keeps its transcripts has them copied once the agent has exited and before the home is removed, and the record holds what was kept and its summary', async () => {
  const stub = stubTranscripts({
    keep: ({ home, dest }) => {
      const [project] = fs.readdirSync(projectsOf(home));
      fs.cpSync(path.join(projectsOf(home), project), dest, { recursive: true });
      return { files: 3, errors: [] };
    },
    summarize: ({ dir }) => ({ source: 'stub', sessions: fs.readdirSync(dir).filter((name) => name.endsWith('.jsonl')) }),
  });
  const { options, runsDir, workRoot } = keepingTrial('solve', stub);
  const { record } = await runTrial(options);
  const dest = path.join(runsDir, `${STEM}.transcripts`);

  assert.equal(stub.calls.keep.length, 1);
  const [{ agentWrote, destThere, ...context }] = stub.calls.keep;
  assert.deepEqual(Object.keys(context).sort(), ['dest', 'home', 'prepared', 'workspace']);
  assert.deepEqual([context.dest, context.prepared, path.dirname(context.home)], [dest, { port: 1 }, workRoot]);
  assert.equal(agentWrote, true, 'the agent had run, and its home was still there');
  assert.equal(destThere, false);
  assert.deepEqual(stub.calls.summarize.map(({ dir, usage }) => [dir, usage.inputTokens, usage.modelUsage['fake-model'].outputTokens]), [[dest, 60, 5]], 'the summary gets the kept copy and the usage of the reading');

  assert.deepEqual(record.transcripts, { files: 3, errors: [] });
  assert.deepEqual(record.listCost, { source: 'stub', sessions: ['d2ddbeb2-f715-40b3-93d0-fd9218c7f2ce.jsonl'] });
  assert.deepEqual(Object.keys(record).slice(-3), ['startedAt', 'transcripts', 'listCost'], 'after the fields every record has, in their order');
  assert.equal(record.score, 1);
  assert.deepEqual(entriesOf(runsDir).sort(), [`${STEM}.stderr.log`, `${STEM}.stdout.log`, `${STEM}.transcripts`], 'beside the raw output, under the same stem');
  assert.ok(fs.existsSync(path.join(dest, 'd2ddbeb2-f715-40b3-93d0-fd9218c7f2ce', 'subagents', 'agent-ab860aba0e9ba7266.meta.json')));
  assert.deepEqual(entriesOf(workRoot), [], 'the home and the workspace are removed all the same');
});

test('a config that does not ask keeps nothing, whatever its agent left in its home', async () => {
  const { options, runsDir } = trialEnv('solve', { configExtra: { prepare: () => ({}), envFor: leavesTranscripts } });
  const { record } = await runTrial(options);
  assert.ok(!('transcripts' in record) && !('listCost' in record));
  assert.deepEqual(entriesOf(runsDir).sort(), [`${STEM}.stderr.log`, `${STEM}.stdout.log`]);
});

test('transcripts that cannot be kept are logged and recorded, and never fail or lose the trial', async () => {
  const cases = [
    [() => { throw Object.assign(new Error('EBUSY: resource busy or locked, scandir \'C:\\somewhere\''), { code: 'EBUSY' }); }, ['EBUSY'], /could not keep the transcripts of sample, fake, medium, repeat 1: EBUSY: resource busy/],
    [() => { throw new Error('no such home'); }, ['no such home'], /could not keep the transcripts .*no such home/],
    // What the keeper itself could not copy: recorded as it says, and logged too.
    [() => ({ files: 2, errors: ['a/b.jsonl: EPERM'] }), ['a/b.jsonl: EPERM'], /transcripts of sample, fake, medium, repeat 1: a\/b\.jsonl: EPERM/],
    [() => undefined, ['its keep returned no { files, errors }'], /returned no \{ files, errors \}/],
  ];
  for (const [keep, errors, logged] of cases) {
    const logs = [];
    const stub = stubTranscripts({ keep });
    const { options, workRoot } = keepingTrial('solve', stub, { log: (message) => logs.push(message) });
    const outcome = await runTrial(options);
    assert.equal(outcome.status, 'recorded');
    assert.equal(outcome.record.score, 1, 'the trial is graded and recorded as ever');
    assert.deepEqual(outcome.record.transcripts.errors, errors);
    assert.equal(outcome.record.transcripts.files, errors[0] === 'a/b.jsonl: EPERM' ? 2 : 0);
    assert.ok(logs.some((message) => logged.test(message)), logs.join('\n'));
    assert.equal(stub.calls.summarize.length, 1, 'what was kept, even nothing, is still summarized');
    assert.deepEqual(outcome.record.listCost, { source: 'stub' });
    assert.deepEqual(entriesOf(workRoot), []);
  }
});

test('a summary that throws is logged and recorded, and leaves the list cost unknown, not the trial', async () => {
  const logs = [];
  const stub = stubTranscripts({ summarize: () => { throw new TypeError('cannot read a transcript'); } });
  const { options } = keepingTrial('noop', stub, { log: (message) => logs.push(message) });
  const { record } = await runTrial(options);
  assert.equal(record.score, 2 / 3);
  assert.equal(record.listCost, null);
  assert.deepEqual(record.transcripts, { files: 1, errors: ['summary: cannot read a transcript'] });
  assert.ok(logs.some((message) => /could not summarize the transcripts of sample, fake, medium, repeat 1: cannot read a transcript/.test(message)), logs.join('\n'));
});

test('what an earlier attempt at the same trial kept is removed first, so a repeated trial never holds two sessions', async () => {
  const stub = stubTranscripts({ keep: () => ({ files: 0, errors: [] }) });
  const { options, runsDir } = keepingTrial('noop', stub);
  const stale = path.join(runsDir, `${STEM}.transcripts`, 'an-earlier-session.jsonl');
  fs.mkdirSync(path.dirname(stale), { recursive: true });
  fs.writeFileSync(stale, '{}\n');
  const { record } = await runTrial(options);
  assert.equal(stub.calls.keep[0].destThere, false, 'gone before anything is kept');
  assert.equal(fs.existsSync(stale), false, 'and gone for good when this attempt kept nothing');
  assert.deepEqual(record.transcripts, { files: 0, errors: [] });
});

test('an earlier attempt\'s transcripts that cannot be removed are never summarized as this trial\'s: nothing is kept, the record says why and the cost is an estimate', async () => {
  const logs = [];
  // The real summary, so the record holds what a subagent config would record (`configs.mjs`, `SUBAGENT_TRANSCRIPTS`).
  const stub = stubTranscripts({ summarize: ({ dir, usage }) => trialListCost({ dir, modelUsage: usage.modelUsage }) });
  const { options, runsDir } = keepingTrial('noop', stub, { log: (message) => logs.push(message) });
  const dest = path.join(runsDir, `${STEM}.transcripts`);
  // What the earlier attempt kept: a real session, with requests and a cost of its own.
  fs.cpSync(PROBE_TRANSCRIPTS, dest, { recursive: true });
  const realRm = fs.rmSync;
  // What Windows answers while something still holds the directory. Only that removal fails: the trial's own
  // directories are removed as ever.
  fs.rmSync = (target, ...rest) => {
    if (path.resolve(String(target)) === dest) throw Object.assign(new Error(`EBUSY: resource busy or locked, rmdir '${dest}'`), { code: 'EBUSY' });
    return realRm(target, ...rest);
  };
  let record;
  try {
    ({ record } = await runTrial(options));
  } finally {
    fs.rmSync = realRm;
  }
  assert.equal(record.listCost.source, 'modelUsage', 'an estimate from what this trial printed, never the earlier session\'s cost');
  assert.deepEqual(stub.calls.summarize.map(({ dir }) => dir), [null], 'the summary is given no directory, so it cannot read the earlier session');
  assert.equal(stub.calls.keep.length, 0, 'nothing is copied in beside another session');
  assert.deepEqual(record.transcripts, { files: 0, errors: ['earlier attempt not removed: EBUSY'] }, 'by its code alone: the message holds a path of this machine');
  assert.equal(record.score, 2 / 3, 'the trial is graded and recorded as ever');
  assert.ok(logs.some((message) => /could not keep the transcripts of sample, fake, medium, repeat 1: what an earlier attempt kept could not be removed \(EBUSY: resource busy/.test(message)), logs.join('\n'));
  assert.ok(fs.existsSync(path.join(dest, 'd2ddbeb2-f715-40b3-93d0-fd9218c7f2ce.jsonl')), 'what could not be removed is left as it was');
});

test('a trial that stops, or whose reading is refused, keeps its transcripts with the raw output and summarizes nothing', async () => {
  const capped = stubTranscripts();
  const stopped = await runTrial(keepingTrial('cap', capped).options);
  assert.equal(stopped.status, 'stopped');
  assert.deepEqual([capped.calls.keep.length, capped.calls.summarize.length], [1, 0]);

  const refused = stubTranscripts();
  await assert.rejects(runTrial(keepingTrial('noop', refused, { configExtra: { reader: () => ({ stop: null }) } }).options), /reading of the wrong shape/);
  assert.deepEqual([refused.calls.keep.length, refused.calls.summarize.length], [1, 0], 'kept before the reading, like the raw output');
});

test('keep and summarize may be asynchronous: both are waited for', async () => {
  const later = (value) => new Promise((resolve) => { setTimeout(() => resolve(value), 20); });
  const stub = stubTranscripts({ keep: () => later({ files: 4, errors: [] }), summarize: () => later({ source: 'later' }) });
  const { record } = await runTrial(keepingTrial('noop', stub).options);
  assert.deepEqual([record.transcripts, record.listCost], [{ files: 4, errors: [] }, { source: 'later' }]);
});

test('a config whose transcripts is not a keep and a summarize is refused before anything is made or run', async () => {
  for (const transcripts of [true, 'claude', {}, { keep: () => ({ files: 0, errors: [] }) }, { keep: 'copy', summarize: () => null }]) {
    const { options, workRoot, countFile } = trialEnv('noop', { configExtra: { transcripts } });
    await assert.rejects(runTrial(options), /config fake: "transcripts" must be an object with a keep and a summarize function/, JSON.stringify(transcripts));
    assert.deepEqual(entriesOf(workRoot), []);
    assert.equal(fs.existsSync(countFile), false, 'no agent ran');
  }
});

// ---- a Codex-shaped agent, end to end ----------------------------------------------------------------

/** A trial of the fake agent in one of its Codex modes, read by Codex's reader: the output side of what a
 * Codex config will be. */
const codexTrial = (mode, options = {}) => trialEnv(mode, { ...options, configExtra: { reader: readCodexOutput, ...options.configExtra } });
const CODEX_USAGE = { input_tokens: 1000, cached_input_tokens: 800, output_tokens: 50, reasoning_output_tokens: 20 };

test('a solved Codex trial scores 1 and records its tokens, the cached input counted once, with no cost', async () => {
  const { options, runsDir } = codexTrial('codex-solve');
  const outcome = await runTrial(options);
  assert.equal(outcome.status, 'recorded');
  const { record } = outcome;
  assert.deepEqual(
    { ...record, wallMs: typeof record.wallMs, startedAt: typeof record.startedAt },
    {
      task: 'sample', config: 'fake', effort: 'medium', repeat: 1,
      score: 1, passed: 3, total: 3,
      inputTokens: 1000, outputTokens: 50, turns: null,
      usage: [CODEX_USAGE],
      costUsd: null, modelUsage: null, subagents: null,
      // The fake agent's usage is the documented one, without the cache-write count the real CLI adds.
      cachedInputTokens: 800, cacheWriteInputTokens: null, reasoningOutputTokens: 20,
      wallMs: 'number', cliVersion: '9.9.9 (Fake Agent)', error: null, startedAt: 'string',
    },
  );
  const stdout = fs.readFileSync(path.join(runsDir, 'sample__fake__medium__1.stdout.log'), 'utf8');
  assert.equal(parseCodexOutput(stdout).result, 'done', 'the raw event stream is kept, and its last agent message is the answer');
});

test('the reader, not the runner, says what output means: the same Codex run is unparsable to a config without one', async () => {
  const read = await runTrial(codexTrial('codex-noop').options);
  assert.equal(read.record.error, null);
  assert.equal(read.record.inputTokens, 1000);
  assert.equal(read.record.score, 2 / 3);
  const unread = await runTrial(trialEnv('codex-noop').options);
  assert.equal(unread.record.error, 'agent-output-unparsable');
  assert.equal(unread.record.inputTokens, null);
});

for (const [mode, reason, message] of [
  ['codex-cap', 'cap', "You've hit your usage limit. Try again later."],
  ['codex-auth', 'auth', 'Error: Not logged in. Run `codex login` first.'],
]) {
  test(`a Codex ${reason} failure stops the trial without a record and cleans the workspace`, async () => {
    const { options, workRoot, runsDir } = codexTrial(mode);
    assert.deepEqual(await runTrial(options), { status: 'stopped', reason, message });
    assert.deepEqual(entriesOf(workRoot), []);
    assert.ok(fs.existsSync(path.join(runsDir, 'sample__fake__medium__1.stdout.log')), 'the raw output is kept for diagnosis');
  });
}

test('a Codex turn that fails for another reason is graded and recorded with its error, its tokens unknown', async () => {
  const outcome = await runTrial(codexTrial('codex-failed').options);
  assert.equal(outcome.status, 'recorded');
  assert.equal(outcome.record.error, 'agent-exit-1');
  assert.equal(outcome.record.score, 2 / 3);
  assert.equal(outcome.record.inputTokens, null, 'a failed turn reports no usage');
  assert.equal(outcome.record.usage, null);
});

test('a Codex run that exits 0 without completing a turn is recorded as agent-error and graded', async () => {
  const { options, runsDir } = codexTrial('codex-incomplete');
  const outcome = await runTrial(options);
  assert.equal(outcome.status, 'recorded');
  assert.equal(outcome.record.error, 'agent-error');
  assert.equal(outcome.record.score, 2 / 3);
  const printed = parseCodexOutput(fs.readFileSync(path.join(runsDir, 'sample__fake__medium__1.stdout.log'), 'utf8'));
  assert.deepEqual({ threadId: printed.threadId, turns: printed.turns, turnFailed: printed.turnFailed }, { threadId: 'fake-thread', turns: [], turnFailed: false }, 'a started thread, and no turn that ended');
});

test('a suite against a Codex-shaped agent that hits the cap stops and leaves the results file without it', async () => {
  const workRoot = tmp('work');
  const options = {
    tasks: [loadTask(SAMPLE)],
    configs: [fakeConfig('codex-cap', {}, { reader: readCodexOutput })],
    runTrial: (trial) => runTrial({ ...trial, runProcess: later.runProcess }),
    efforts: ['medium'],
    repeats: 3,
    resultsPath: path.join(tmp('results'), 'results.jsonl'),
    runsDir: tmp('runs'),
    workRoot,
  };
  const result = await runSuite(options);
  assert.deepEqual(result, { status: 'stopped', reason: 'cap', message: "You've hit your usage limit. Try again later.", completed: 0 });
  assert.deepEqual(readResults(options.resultsPath), []);
  assert.deepEqual(entriesOf(workRoot), []);
});

// ---- a reading the runner refuses, in a suite -------------------------------------------------------

/** A suite of the fake agent over the sample task, whose trials skip the sweep by path (about a second
 * each, and nothing here is about it). `reader` reads every trial. */
function readerSuite(reader, { mode = 'noop', repeats = 2, extra = {} } = {}) {
  const workRoot = tmp('work');
  const runsDir = tmp('runs');
  const countFile = path.join(tmp('count'), 'count.txt');
  const options = {
    tasks: [loadTask(SAMPLE)],
    configs: [fakeConfig(mode, { FAKE_AGENT_COUNT_FILE: countFile }, { reader, ...extra })],
    efforts: ['medium'],
    repeats,
    resultsPath: path.join(tmp('results'), 'results.jsonl'),
    runsDir,
    workRoot,
    runTrial: (trial) => runTrial({ ...trial, sweep: () => ({ killed: [] }), runProcess: later.runProcess }),
  };
  const agentRuns = () => (fs.existsSync(countFile) ? fs.readFileSync(countFile, 'utf8').trim().split('\n').length : 0);
  return { options, workRoot, runsDir, agentRuns };
}

for (const [label, good] of [['Claude Code', readClaudeOutput], ['Codex', readCodexOutput]]) {
  test(`a suite read by ${label}'s reader stops at a trial whose reading is refused: no record for it, its raw output kept, and a resume repeats exactly that trial`, async () => {
    // The reader is broken for the second trial only: the first is a recorded trial that must not run again.
    let reads = 0;
    let fixed = false;
    const reader = (run) => {
      reads += 1;
      const reading = good(run);
      return reads === 2 && !fixed ? { stop: reading.stop, failed: reading.failed, usage: reading.usage } : reading;
    };
    const { options, workRoot, runsDir, agentRuns } = readerSuite(reader, { mode: label === 'Codex' ? 'codex-noop' : 'noop', repeats: 3 });
    const result = await runSuite(options);
    assert.deepEqual(
      result,
      {
        status: 'stopped',
        reason: 'reader',
        message: 'config fake: its reader returned a reading of the wrong shape: "parsed" must be true or false, got undefined (trial sample, fake, medium, repeat 2: nothing is recorded for it, and what the agent printed is kept with the raw logs)',
        completed: 1,
      },
    );
    assert.deepEqual(readResults(options.resultsPath).map(trialKey), ['sample|fake|medium|1'], 'the trial that was read is recorded, the refused one is not');
    assert.match(fs.readFileSync(path.join(runsDir, 'sample__fake__medium__2.stdout.log'), 'utf8'), /did nothing/, 'what the paid session printed is kept');
    assert.deepEqual(entriesOf(workRoot), [], 'and the trial is cleaned up');
    assert.equal(agentRuns(), 2, 'the suite stopped there: the third trial did not run');

    fixed = true;
    assert.deepEqual(await runSuite(options), { status: 'complete', completed: 2, skipped: 1 });
    assert.deepEqual(readResults(options.resultsPath).map(trialKey), ['sample|fake|medium|1', 'sample|fake|medium|2', 'sample|fake|medium|3']);
    assert.equal(agentRuns(), 4, 'the refused trial ran again, the recorded one did not');
  });
}

test('only a refused reading is such a stop: a trial that throws anything else still rejects the suite', async () => {
  const thrown = readerSuite(readClaudeOutput);
  await assert.rejects(runSuite({ ...thrown.options, runTrial: async () => { throw new Error('the trial exploded'); } }), /the trial exploded/);
  // A config that carries something that is no reader is a defect of the config, found before any agent runs.
  const unreadable = readerSuite('codex');
  await assert.rejects(runSuite(unreadable.options), /config fake: "reader" must be a function/);
  assert.equal(unreadable.agentRuns(), 0);
});

test('a Claude Code result with subagents and per-model usage is a reading the runner takes, with every count of the session', () => {
  // The shape of a real result whose session spawned subagents on a helper model: `usage` is the main thread's,
  // while the cost, `modelUsage` and `subagent_stats` cover the whole session.
  const modelUsage = {
    'claude-opus-5-5': { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 30, cacheCreationInputTokens: 20, costUSD: 0.5 },
    'claude-haiku-5': { inputTokens: 4, outputTokens: 6, cacheReadInputTokens: 8, cacheCreationInputTokens: 2, costUSD: 0.25 },
  };
  const usage = { input_tokens: 10, cache_creation_input_tokens: 20, cache_read_input_tokens: 30, output_tokens: 5 };
  const stdout = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'done', num_turns: 7, usage, total_cost_usd: 0.75, modelUsage, subagent_stats: { spawned: 2 } });
  const reading = assertReading(readClaudeOutput({ stdout, stderr: '', exitCode: 0, timedOut: false }), 'claude');
  assert.deepEqual(reading, {
    stop: null, parsed: true, failed: false,
    usage: { inputTokens: 60, outputTokens: 5, turns: 7, usage, costUsd: 0.75, modelUsage, subagents: 2, subagentStats: { spawned: 2 } },
  });
  // The same session as an array of messages, which newer CLIs print: the result is its last `result` element.
  const listed = JSON.stringify([{ type: 'system', subtype: 'init' }, JSON.parse(stdout)]);
  assert.deepEqual(assertReading(readClaudeOutput({ stdout: listed, stderr: '', exitCode: 0, timedOut: false }), 'claude'), reading);
});

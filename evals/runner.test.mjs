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
  checkFixtureLinks, childEnv, classifyAgentFailure, killByPath, loadTask, parseAgentOutput, parseTap, planTrials, probeVersion, readResults, resolveAgent, runProcess,
  runSuite, runTrial, summarizeUsage, trialKey,
} from './runner.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FAKE_AGENT = path.join(here, 'fixtures', 'fake-agent.mjs');
const SAMPLE = path.join(here, 'fixtures', 'tasks', 'sample');

// Every directory a test makes lives under one root that is removed at the end.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-evals-test-'));
// The processes a test started (`strays`, below) are killed first: one that is still running, in a test that
// failed, holds a directory under the scratch root and would make its removal fail too. Windows lets go of a
// directory a moment after its holder dies, hence the retries.
after(() => {
  for (const pid of strays) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
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
  assert.deepEqual(summarizeUsage(output), { inputTokens: 60, outputTokens: 5, turns: 4, usage: output.usage });
});

test('summarizeUsage reports unknown, never zero, when the output has no usage', () => {
  assert.deepEqual(summarizeUsage(null), { inputTokens: null, outputTokens: null, turns: null, usage: null });
  assert.deepEqual(summarizeUsage({ type: 'result' }), { inputTokens: null, outputTokens: null, turns: null, usage: null });
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
    // the tests that are pass `sweep: undefined` to get the real one.
    options: { task, config: cfg, effort: 'medium', repeat: 1, readVersion: () => '9.9.9 (Fake Agent)', workRoot, runsDir, sweep: () => ({ killed: [] }), ...options },
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
      turns: 3, wallMs: 'number', cliVersion: '9.9.9 (Fake Agent)', error: null, startedAt: 'string',
    },
  );
  assert.ok(record.wallMs >= 0);
  assert.equal(new Date(record.startedAt).toISOString(), record.startedAt);
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
    assert.deepEqual(Object.keys(context).sort(), ['effort', 'home', 'task', 'workspace']);
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

// Every process a test starts is recorded and killed when the file ends, pass or fail, so a failing test
// cannot leave a sleeper behind.
const strays = new Set(); // killed by the hook at the top of this file
const killStray = (pid) => {
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // already gone
  }
};

/** A detached sleeper whose command line ends with `args`; returns its pid. */
function sleeper(...args) {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', '--', ...args], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  strays.add(child.pid);
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
  const parent = spawn(process.execPath, ['-e', parentCode, '--', pidFile, root], { detached: true, stdio: 'ignore', windowsHide: true });
  parent.unref();
  strays.add(parent.pid);
  assert.ok(await waitUntil(() => fs.existsSync(pidFile) && fs.readFileSync(pidFile, 'utf8') !== ''), 'the parent started its child');
  const child = Number(fs.readFileSync(pidFile, 'utf8'));
  strays.add(child);
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
  const pairs = [0, 1, 2, 3].map((index) => {
    const pidFile = path.join(tmp('gone-pid'), `child-${index}.txt`);
    const parent = spawn(process.execPath, ['-e', parentCode, '--', root, pidFile], { detached: true, stdio: 'ignore', windowsHide: true });
    parent.unref();
    strays.add(parent.pid);
    return { parent: parent.pid, pidFile };
  });
  assert.ok(await waitUntil(() => pairs.every(({ pidFile }) => fs.existsSync(pidFile) && fs.readFileSync(pidFile, 'utf8') !== '')), 'every parent started its child');
  const children = pairs.map(({ pidFile }) => Number(fs.readFileSync(pidFile, 'utf8')));
  children.forEach((pid) => strays.add(pid));
  const everyone = [...pairs.map(({ parent }) => parent), ...children];
  const { killed } = killByPath([root]);
  assert.deepEqual([...killed].sort((a, b) => a - b), [...everyone].sort((a, b) => a - b), 'every process that named the root is reported');
  assert.ok(await waitUntil(() => everyone.every((pid) => !isAlive(pid))), 'all of them are gone');
});

test('the sweep script is quiet: no progress stream, and a failure reaches the caller as plain text', () => {
  let script;
  const sync = (command, args) => {
    script = Buffer.from(args[args.indexOf('-EncodedCommand') + 1], 'base64').toString('utf16le');
    return { status: 1, stdout: '', stderr: 'still running after the kill: 12' };
  };
  assert.throws(() => killByPath([path.join(tmp('quiet'), 'eval-q')], { platform: 'win32', spawnSync: sync }), /still running after the kill: 12/);
  assert.match(script, /\$ProgressPreference = 'SilentlyContinue'/);
  assert.match(script, /\[Console\]::Error\.WriteLine/);
  assert.ok(!/\*> \$null|2>&1 \| Out-Null/.test(script), 'no native-command redirection that turns a stderr line into a terminating error');
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

test('killByPath hands the roots to PowerShell through the environment, not the command line, and reports the pids it printed', () => {
  const calls = [];
  const sync = (command, args, options) => {
    calls.push({ command, args, options });
    return { status: 0, stdout: '4242\r\n77\r\n', stderr: '' };
  };
  const roots = [path.join(tmp('stub'), 'eval-St0b01'), path.join(tmp('stub'), 'eval Space')];
  const { killed } = killByPath(roots, { platform: 'win32', spawnSync: sync });
  assert.deepEqual(killed, [4242, 77]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'powershell');
  assert.ok(calls[0].args.includes('-NoProfile'));
  assert.ok(roots.every((root) => !calls[0].args.join(' ').includes(root)), 'no root is spliced into the script');
  assert.deepEqual(calls[0].options.env.JS_HARNESS_KILL_ROOTS.split('\n'), roots);
  assert.throws(() => killByPath(roots, { platform: 'win32', spawnSync: () => ({ status: 1, stdout: '', stderr: 'boom' }) }), /sweep.*failed.*boom/);
  assert.throws(() => killByPath(roots, { platform: 'win32', spawnSync: () => ({ error: new Error('no powershell') }) }), /no powershell/);
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
  const logs = [];
  const trial = trialEnv('orphan-by-path', { env, configExtra, sweep: undefined, log: (message) => logs.push(message) });
  const holder = () => {
    try {
      return trial.readReport().grandchildPid;
    } catch {
      return undefined;
    }
  };
  return { ...trial, logs, holder, reap: () => holder() !== undefined && killStray(holder()) };
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
        const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { cwd: workspace, detached: true, stdio: 'ignore', windowsHide: true });
        child.unref();
        strays.add(child.pid);
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
        const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { cwd: workspace, detached: true, stdio: 'ignore', windowsHide: true });
        child.unref();
        strays.add(child.pid);
        holders.push(child.pid);
      },
    },
    sweep: () => {
      calls.push(calls.length);
      // The first sweep finds nothing (the holder's command line names no trial directory); the second is the retry.
      if (calls.length === 2) {
        killStray(holders[0]);
        // A real sweep returns once `taskkill` has: wait for the holder to be gone, as that does.
        for (const until = Date.now() + 3000; isAlive(holders[0]) && Date.now() < until;);
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

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  childEnv, classifyAgentFailure, loadTask, parseAgentOutput, parseTap, planTrials, readResults, runSuite, runTrial, summarizeUsage, trialKey,
} from './runner.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FAKE_AGENT = path.join(here, 'fixtures', 'fake-agent.mjs');
const SAMPLE = path.join(here, 'fixtures', 'tasks', 'sample');

// Every directory a test makes lives under one root that is removed at the end.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-evals-test-'));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));
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
 * workspace, because the workspace is gone by the time a test reads anything. */
function fakeConfig(mode, env = {}, extra = {}) {
  return { name: 'fake', command: process.execPath, args: [FAKE_AGENT], versionArgs: [FAKE_AGENT, '--version'], env: { FAKE_AGENT_MODE: mode, ...env }, ...extra };
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
    options: { task, config: cfg, effort: 'medium', repeat: 1, cliVersion: '9.9.9 (Fake Agent)', workRoot, runsDir, ...options },
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

test('an agent command that cannot be spawned is recorded and graded', async () => {
  const config = fakeConfig('noop', {}, { command: path.join(scratch, 'no-such-agent') });
  const { options, workRoot } = trialEnv('noop', { config });
  const { record } = await runTrial(options);
  assert.equal(record.error, 'agent-spawn-failed');
  assert.equal(record.score, 2 / 3);
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

/** A `runTrial` stand-in that records the trials it was asked for. */
function stubTrial(log, outcomeFor = () => null) {
  return async (trial) => {
    log.push(trialKey(recordOf(trial)));
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

test('runSuite hands each trial the CLI version, probed once per agent command', async () => {
  const seen = [];
  const probed = [];
  const options = suiteOptions({
    configs: [{ name: 'x', command: 'claude' }, { name: 'y', command: 'claude' }],
    readVersion: (config) => {
      probed.push(config.name);
      return '2.0.0';
    },
    runTrial: async (trial) => {
      seen.push(trial.cliVersion);
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

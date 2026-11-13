// The long-session eval's driver with a fake agent: every turn is a call of the injected `runProcess`, so nothing
// here starts Claude Code or spends anything.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scriptOf } from './script.mjs';
import { driveBatch, driveRun, estimateRun, planBatch, runMain } from './run.mjs';

function scratch(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'long-session-run-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** A config of the runner's shape, with no sandbox: its home is the one the driver made. */
const fakeConfig = (name = 'current') => ({
  name,
  command: process.execPath,
  args: ({ effort }) => ['--print', '--effort', effort],
  env: ({ home }) => ({ HOME: home }),
  prepare: async ({ home }) => ({ home }),
  cleanup: () => undefined,
});

/** An agent that answers each turn with a result costing `cost(turn)`, and writes a transcript line into the home's
 * projects folder as Claude Code would. `act({ cwd, turn })` does whatever else the test needs. */
function fakeAgent({ cost = () => 0.5, sessionOf = () => 'sess-1', act = () => {}, stdout, compacts = true } = {}) {
  const calls = [];
  const runProcess = async (call) => {
    calls.push(call);
    const turn = calls.length;
    const projects = path.join(call.env.HOME, '.claude', 'projects', 'p');
    fs.mkdirSync(projects, { recursive: true });
    fs.appendFileSync(path.join(projects, 'sess-1.jsonl'), `${JSON.stringify({ type: 'user', message: { content: call.input } })}\n`);
    if (call.input === '/compact' && compacts) fs.appendFileSync(path.join(projects, 'sess-1.jsonl'), `${JSON.stringify({ type: 'system', subtype: 'compact_boundary', compactMetadata: { trigger: 'manual' } })}\n`);
    act({ cwd: call.cwd, turn });
    return { stdout: stdout ?? JSON.stringify({ type: 'result', subtype: 'success', is_error: false, session_id: sessionOf(turn), total_cost_usd: cost(turn), num_turns: 3, result: 'Listo.' }), stderr: '', exitCode: 0 };
  };
  return { calls, runProcess };
}

const base = (t, over = {}) => ({
  config: fakeConfig(),
  turns: scriptOf(30),
  effort: 'high',
  workRoot: scratch(t),
  runsDir: scratch(t),
  runId: 'current-1',
  capUsd: 100,
  costReading: 'per-turn',
  sweep: () => {},
  log: () => {},
  // Every condition of the script met: the feature files are there from the start.
  ...over,
});

const featureFiles = ({ cwd }) => {
  for (const file of ['src/done.mjs', 'src/stats.mjs']) fs.writeFileSync(path.join(cwd, file), '');
};

test('every turn is the script\'s text on stdin, and every turn after the first resumes the first turn\'s session', async (t) => {
  let fixture = false;
  const agent = fakeAgent({ act: ({ cwd, turn }) => {
    if (turn === 1) fixture = fs.existsSync(path.join(cwd, 'scripts', 'release.mjs'));
    featureFiles({ cwd });
  } });
  const record = await driveRun({ ...base(t), runProcess: agent.runProcess });
  assert.equal(agent.calls.length, 30);
  assert.deepEqual(agent.calls.map((call) => call.input), scriptOf(30).map((turn) => turn.text));
  assert.deepEqual(agent.calls[0].args, ['--print', '--effort', 'high', '--max-budget-usd', '100.00']);
  agent.calls.slice(1).forEach((call, index) => assert.deepEqual(call.args, ['--print', '--effort', 'high', '--max-budget-usd', (100 - 0.5 * (index + 1)).toFixed(2), '--resume', 'sess-1']));
  assert.ok(fixture, 'the workspace holds the fixture');
  assert.equal(record.reached, 30);
  assert.equal(record.stop, null);
  assert.equal(record.sessionId, 'sess-1');
  assert.equal(record.spendUsd, 15);
  assert.equal(record.releaseMarker, false);
  assert.equal(fs.existsSync(agent.calls[0].cwd), false, 'the workspace is removed');
});

test('the transcripts are kept beside the raw output, and a release marker is recorded', async (t) => {
  const agent = fakeAgent({ act: ({ cwd, turn }) => {
    featureFiles({ cwd });
    if (turn === 12) fs.writeFileSync(path.join(cwd, '.release.log'), 'released');
  } });
  const options = base(t);
  const record = await driveRun({ ...options, runProcess: agent.runProcess });
  assert.equal(record.releaseMarker, true);
  assert.ok(fs.readdirSync(record.transcripts).some((name) => name.endsWith('.jsonl')));
  assert.ok(fs.existsSync(path.join(options.runsDir, 'current-1', 'turn-01.stdout.log')));
});

test('a condition never met ends the run at the turn before it', async (t) => {
  const agent = fakeAgent();
  const record = await driveRun({ ...base(t), runProcess: agent.runProcess });
  const waiting = scriptOf(30).find((turn) => turn.when !== undefined);
  assert.equal(agent.calls.length, waiting.n - 1);
  assert.equal(record.reached, waiting.n - 1);
  assert.deepEqual(record.stop, { reason: 'condition', turn: waiting.n, message: `${waiting.when.file} does not exist` });
});

test('the dollar cap stops a run before the next turn once its spend reaches the cap, per-turn or cumulative', async (t) => {
  const perTurn = fakeAgent({ cost: () => 1, act: featureFiles });
  const one = await driveRun({ ...base(t), capUsd: 2.5, runProcess: perTurn.runProcess });
  assert.equal(perTurn.calls.length, 3);
  assert.equal(one.reached, 3);
  assert.equal(one.spendUsd, 3);
  assert.equal(one.stop.reason, 'cap');
  const cumulative = fakeAgent({ cost: (turn) => turn, act: featureFiles });
  const two = await driveRun({ ...base(t), capUsd: 2.5, costReading: 'cumulative', runProcess: cumulative.runProcess });
  assert.equal(two.reached, 3);
  assert.equal(two.spendUsd, 3);
});

test('a run refuses without its cost reading or with a cap that is not a positive number', async (t) => {
  const agent = fakeAgent();
  await assert.rejects(driveRun({ ...base(t), costReading: undefined, runProcess: agent.runProcess }), /per-turn or cumulative/);
  await assert.rejects(driveRun({ ...base(t), capUsd: 0, runProcess: agent.runProcess }), /cap/);
  assert.equal(agent.calls.length, 0);
});

test('an agent whose output is no result, or which answers in another session, ends the run', async (t) => {
  const broken = await driveRun({ ...base(t), runProcess: fakeAgent({ stdout: 'Not logged in' }).runProcess });
  assert.equal(broken.reached, 0);
  assert.equal(broken.stop.reason, 'agent');
  const forked = await driveRun({ ...base(t), runProcess: fakeAgent({ sessionOf: (turn) => (turn < 3 ? 'sess-1' : 'sess-2'), act: featureFiles }).runProcess });
  assert.equal(forked.reached, 2);
  assert.equal(forked.stop.reason, 'session');
});

test('a /compact that leaves no boundary ends the run as invalid, and the batch with it', async (t) => {
  const agent = fakeAgent({ act: featureFiles, compacts: false });
  const record = await driveRun({ ...base(t), runProcess: agent.runProcess });
  assert.equal(record.reached, 25);
  assert.equal(record.stop.reason, 'compaction');
  const configs = [fakeConfig('current'), fakeConfig('minimal-commands')];
  const batch = await driveBatch({ ...base(t), configs, runs: 2, runCapUsd: 100, batchCapUsd: 100, runProcess: fakeAgent({ act: featureFiles, compacts: false }).runProcess });
  assert.equal(batch.records.length, 1);
  assert.equal(batch.stop.reason, 'compaction');
});

test('the cost model, on the S6 load at Opus 5.5\'s list prices, gives the feature document\'s figures', () => {
  const price = { cacheWrite1h: 8, cacheRead: 0.2, output: 20 };
  const final = { fixed: 22000, requests: 8.5, output: 3200 };
  const at = (turns, growth, cacheMiss = false) => Math.round(estimateRun({ load: final, turns, growth, compactAt: 25, price, cacheMiss }) * 100) / 100;
  assert.deepEqual([at(30, 0), at(30, 3000), at(30, 6000)], [3.27, 5.47, 7.68]);
  assert.deepEqual([at(40, 0), at(40, 3000), at(40, 6000)], [4.37, 7.35, 10.33]);
  assert.deepEqual([at(30, 3000, true), at(40, 3000, true)], [10.58, 14.21]);
});

test('a batch runs each arm once a round, and stops before the next run once the batch reaches its cap', async (t) => {
  const order = [];
  const agent = fakeAgent({ cost: () => 0.1, act: featureFiles });
  const runProcess = async (call) => {
    if (!call.args.includes('--resume')) order.push(call.env.ARM);
    return agent.runProcess(call);
  };
  const configs = ['current', 'minimal-commands'].map((name) => ({ ...fakeConfig(name), env: ({ home }) => ({ HOME: home, ARM: name }) }));
  const options = base(t);
  const batch = await driveBatch({ ...options, configs, runs: 3, runCapUsd: 100, batchCapUsd: 7, runProcess });
  assert.deepEqual(order, ['current', 'minimal-commands', 'current']);
  assert.deepEqual(batch.records.map((record) => record.id), ['current-1', 'minimal-commands-1', 'current-2']);
  assert.equal(batch.stop.reason, 'cap');
});

test('planBatch prices a batch from the recorded rows, says which figures are estimates, and spends nothing', () => {
  const doc = {
    model: 'claude-opus-5-5',
    createdAt: '2031-01-01T00:00:00Z',
    trials: [
      { config: 'current', effort: 'high', turns: 8, outputTokens: 3000, usage: { cache_creation_input_tokens: 20000 }, costUsd: 0.3, error: null },
      { config: 'current', effort: 'high', turns: 9, outputTokens: 3400, usage: { cache_creation_input_tokens: 24000 }, costUsd: 0.3, error: null },
    ],
  };
  const plan = planBatch({ docs: [{ name: 'f8-s6-incidents', doc }], arms: ['current', 'minimal-commands'], runs: 5, turns: 30, effort: 'high', model: 'claude-opus-5-5' });
  const current = plan.arms.find((arm) => arm.arm === 'current');
  assert.equal(current.basis, 'f8-s6-incidents');
  assert.deepEqual(current.load, { fixed: 22000, requests: 8.5, output: 3200 });
  assert.ok(current.perRun.low < current.perRun.mid && current.perRun.mid < current.perRun.high);
  const minimal = plan.arms.find((arm) => arm.arm === 'minimal-commands');
  assert.equal(minimal.perRun, null, 'no row, no figure');
  assert.match(plan.lines.join('\n'), /estimate/);
  assert.match(plan.lines.join('\n'), /minimal-commands: unknown/);
  assert.equal(plan.total, null, 'an unknown arm leaves the total unknown');
  assert.ok(current.perRunCacheMiss > current.perRun.mid, 'a missed cache costs more');
  assert.ok(plan.smoke.mid > current.perRun.mid, 'the smoke runs at the desktop\'s heavier load');
});

test('runMain --plan prints the plan and starts nothing; a run without the eval token refuses before anything', async (t) => {
  const out = [];
  const io = { stdout: { write: (text) => out.push(text) }, stderr: { write: (text) => out.push(text) } };
  const resultsDir = scratch(t);
  const code = await runMain(['--arms', 'current', '--runs', '5', '--turns', '30', '--plan'], {}, { ...io, resultsDir, runProcess: () => assert.fail('nothing runs') });
  assert.equal(code, 0);
  assert.match(out.join(''), /30 turns/);
  out.length = 0;
  const refused = await runMain(['--arms', 'current', '--runs', '5', '--turns', '30', '--name', 'x', '--claude', process.execPath, '--cost-reading', 'per-turn', '--run-cap', '8', '--batch-cap', '40'], {}, { ...io, resultsDir, runProcess: () => assert.fail('nothing runs') });
  assert.equal(refused, 1);
  assert.match(out.join(''), /JS_HARNESS_EVAL_OAUTH_TOKEN/);
  const usage = await runMain(['--arms', 'gentle', '--plan'], {}, { ...io, resultsDir });
  assert.equal(usage, 2);
});

test('a turn the agent reports as an error, or whose cost is unknown, ends the run as invalid and stops the batch', async (t) => {
  const errored = await driveRun({ ...base(t), runProcess: fakeAgent({ act: featureFiles, stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: true, session_id: 'sess-1', total_cost_usd: 0.2, result: 'API Error: 401' }) }).runProcess });
  assert.equal(errored.reached, 0);
  assert.equal(errored.stop.reason, 'agent');
  assert.equal(errored.spendUsd, 0.2, 'the cost of the failed turn is kept');
  const unpriced = await driveRun({ ...base(t), runProcess: fakeAgent({ act: featureFiles, cost: (turn) => (turn < 2 ? 0.5 : undefined) }).runProcess });
  assert.equal(unpriced.reached, 1);
  assert.equal(unpriced.stop.reason, 'cost');
  const { runProcess } = fakeAgent({ act: featureFiles, cost: () => undefined });
  const batch = await driveBatch({ ...base(t), configs: [fakeConfig('current'), fakeConfig('minimal-commands')], runs: 2, runCapUsd: 5, batchCapUsd: 20, runProcess });
  assert.equal(batch.records.length, 1);
  assert.equal(batch.stop.reason, 'cost');
});

test('runMain refuses an arm named twice', async () => {
  let err = '';
  const code = await runMain(['--arms', 'current,current', '--runs', '1', '--turns', '30', '--plan'], {}, { stdout: { write: () => {} }, stderr: { write: (text) => { err += text; } }, runProcess: () => assert.fail('nothing runs') });
  assert.equal(code, 2);
  assert.match(err, /twice/);
});

test('a turn that answers in another session still has its cost counted', async (t) => {
  const forked = await driveRun({ ...base(t), runProcess: fakeAgent({ sessionOf: (turn) => (turn < 2 ? 'sess-1' : 'sess-2'), cost: () => 0.5, act: featureFiles }).runProcess });
  assert.equal(forked.stop.reason, 'session');
  assert.equal(forked.spendUsd, 1);
});

test('a turn that runs out of the run\'s budget stops the run as cap, and the batch goes on', async (t) => {
  const out = (turn) => JSON.stringify({ type: 'result', subtype: turn === 2 ? 'error_max_budget_usd' : 'success', is_error: turn === 2, session_id: 'sess-1', total_cost_usd: 0.5 });
  let calls = 0;
  const runProcess = async (call) => {
    calls += 1;
    const turn = ((calls - 1) % 2) + 1;
    fs.mkdirSync(path.join(call.env.HOME, '.claude', 'projects', 'p'), { recursive: true });
    featureFiles({ cwd: call.cwd });
    return { stdout: out(turn), stderr: '', exitCode: turn === 2 ? 1 : 0 };
  };
  const batch = await driveBatch({ ...base(t), configs: [fakeConfig('current'), fakeConfig('minimal-commands')], runs: 1, runCapUsd: 5, batchCapUsd: 20, runProcess });
  assert.equal(batch.records.length, 2);
  assert.equal(batch.records[0].stop.reason, 'cap');
  assert.equal(batch.stop, null);
});

/** Two arms whose turns take `delay(arm, turn)` milliseconds, recording which arms have a turn in flight at once. */
function concurrentAgent({ delay = () => 1, cost = () => 0.1, stopArm } = {}) {
  const active = [];
  const overlaps = [];
  const budgets = [];
  const turnOf = new Map();
  const runProcess = async (call) => {
    const arm = call.env.ARM;
    const session = `sess-${path.basename(call.env.HOME)}`;
    const turn = (turnOf.get(call.env.HOME) ?? 0) + 1;
    turnOf.set(call.env.HOME, turn);
    if (turn === 1) budgets.push({ arm, budget: Number(call.args[call.args.indexOf('--max-budget-usd') + 1]), inFlight: active.length });
    active.push(arm);
    overlaps.push([...active]);
    featureFiles({ cwd: call.cwd });
    const projects = path.join(call.env.HOME, '.claude', 'projects', 'p');
    fs.mkdirSync(projects, { recursive: true });
    if (call.input === '/compact') fs.appendFileSync(path.join(projects, `${session}.jsonl`), `${JSON.stringify({ type: 'system', subtype: 'compact_boundary', compactMetadata: { trigger: 'manual' } })}\n`);
    await new Promise((resolve) => setTimeout(resolve, delay(arm, turn)));
    active.splice(active.indexOf(arm), 1);
    const failed = stopArm === arm && turn === 2;
    return { stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: failed, session_id: session, total_cost_usd: cost(turn), num_turns: 1, result: 'Listo.' }), stderr: '', exitCode: 0 };
  };
  return { runProcess, overlaps, budgets };
}

const twoArms = () => ['current', 'minimal-commands'].map((name) => ({ ...fakeConfig(name), env: ({ home }) => ({ HOME: home, ARM: name }) }));

test('with --jobs 2 the two arms run side by side, never two runs of one arm, and the records keep the run order', async (t) => {
  // minimal-commands is ten times faster, so it would start its next run beside its own if nothing held it.
  const agent = concurrentAgent({ delay: (arm) => (arm === 'current' ? 5 : 0) });
  const batch = await driveBatch({ ...base(t), configs: twoArms(), runs: 2, jobs: 2, runCapUsd: 10, batchCapUsd: 100, costReading: 'cumulative', runProcess: agent.runProcess });
  assert.ok(agent.overlaps.some((arms) => arms.length === 2), 'the two arms never ran at once');
  assert.ok(agent.overlaps.every((arms) => new Set(arms).size === arms.length), 'two runs of one arm ran at once');
  assert.deepEqual(batch.records.map((record) => record.id), ['current-1', 'minimal-commands-1', 'current-2', 'minimal-commands-2']);
  assert.equal(batch.stop, null);
});

test('with --jobs the caps in flight never sum past the batch cap: a run starts with what is left after the others reserve theirs', async (t) => {
  const agent = concurrentAgent();
  const batch = await driveBatch({ ...base(t), configs: twoArms(), runs: 1, jobs: 2, runCapUsd: 10, batchCapUsd: 15, costReading: 'cumulative', runProcess: agent.runProcess });
  assert.deepEqual(agent.budgets.map(({ arm, budget }) => [arm, budget]), [['current', 10], ['minimal-commands', 5]]);
  assert.equal(batch.records.length, 2);
  // A run cap as large as the batch's leaves nothing to reserve for a second run: it waits, as one job would.
  const whole = concurrentAgent();
  await driveBatch({ ...base(t), configs: twoArms(), runs: 1, jobs: 2, runCapUsd: 15, batchCapUsd: 15, costReading: 'cumulative', runProcess: whole.runProcess });
  assert.deepEqual(whole.budgets.map(({ inFlight }) => inFlight), [0, 0]);
});

test('with --jobs a run that stops for the eval\'s own reason starts nothing more, and the run in flight is kept', async (t) => {
  const agent = concurrentAgent({ stopArm: 'minimal-commands', delay: (arm) => (arm === 'current' ? 3 : 1) });
  const batch = await driveBatch({ ...base(t), configs: twoArms(), runs: 3, jobs: 2, runCapUsd: 10, batchCapUsd: 100, costReading: 'cumulative', runProcess: agent.runProcess });
  assert.equal(batch.stop.reason, 'agent');
  assert.deepEqual(batch.records.map((record) => record.id), ['current-1', 'minimal-commands-1']);
  assert.equal(batch.records[0].reached, 30);
});

test('runMain refuses --jobs that is not a whole number from 1', async () => {
  for (const jobs of ['0', '1.5', 'two']) {
    let err = '';
    const code = await runMain(['--arms', 'current', '--runs', '1', '--turns', '30', '--jobs', jobs, '--plan'], {}, { stderr: { write: (text) => { err += text; } }, stdout: { write: () => {} } });
    assert.equal(code, 2);
    assert.match(err, /--jobs takes a whole number from 1/);
  }
});

test('with --jobs no run of the next round starts before every run of the round before has finished', async (t) => {
  const events = [];
  const agent = concurrentAgent({ delay: (arm) => (arm === 'current' ? 4 : 0) });
  const runProcess = async (call) => {
    if (!call.args.includes('--resume')) events.push(`start ${call.env.ARM}`);
    return agent.runProcess(call);
  };
  await driveBatch({ ...base(t), configs: twoArms(), runs: 2, jobs: 2, runCapUsd: 10, batchCapUsd: 100, costReading: 'cumulative', runProcess, onRecord: (record) => events.push(`end ${record.id}`) });
  const secondRound = events.findIndex((event, index) => event.startsWith('start') && events.slice(0, index).filter((e) => e.startsWith('start')).length === 2);
  assert.ok(events.slice(0, secondRound).includes('end current-1') && events.slice(0, secondRound).includes('end minimal-commands-1'), events.join(', '));
});

test('with --jobs a run is in flight until its record is stored, and a run that throws waits for the others before the batch throws', async (t) => {
  const stored = [];
  const slowStore = async (record) => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    stored.push(record.id);
  };
  const agent = concurrentAgent();
  const batch = await driveBatch({ ...base(t), configs: twoArms(), runs: 1, jobs: 2, runCapUsd: 10, batchCapUsd: 100, costReading: 'cumulative', runProcess: agent.runProcess, onRecord: slowStore });
  assert.deepEqual(stored.sort(), ['current-1', 'minimal-commands-1']);
  assert.equal(batch.records.length, 2);
  const turns = new Map();
  const throwing = concurrentAgent({ delay: (arm) => (arm === 'current' ? 2 : 0) });
  const runProcess = async (call) => {
    turns.set(call.env.ARM, (turns.get(call.env.ARM) ?? 0) + 1);
    if (call.env.ARM === 'minimal-commands' && turns.get(call.env.ARM) === 3) throw new Error('the runner broke');
    return throwing.runProcess(call);
  };
  await assert.rejects(driveBatch({ ...base(t), configs: twoArms(), runs: 2, jobs: 2, runCapUsd: 10, batchCapUsd: 100, costReading: 'cumulative', runProcess }), /the runner broke/);
  assert.equal(turns.get('current'), 30, 'the run in flight was left running when the batch threw');
});

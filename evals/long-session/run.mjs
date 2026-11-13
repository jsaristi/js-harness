// The long-session eval's driver (`odd/tasks/f8-long-session-eval.md`): one sandboxed session per run, its turns the
// script's (`script.mjs`), each turn a real Claude Code process resuming the first turn's session, so the whole run is
// one session with the arm's own flags. It reuses the suite's sandbox and arms (`evals/configs.mjs`, the seeded home
// and its credentials guard in `evals/home.mjs`) and the runner's process handling (`evals/runner.mjs`), but not
// `runTrial`, which takes one prompt and removes the home when it returns.
//
// Spend is bounded twice: each turn's process gets `--max-budget-usd` set to what is left of the run's cap, and the
// driver stops a run before the next turn, and a batch before the next run, once its spend reaches its cap. A turn can
// still overshoot what was left (the CLI reference says so of the flag), by at most that turn.
//
// `--plan` prices a batch from the recorded rows before anything is spent (`planBatch`), and starts nothing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { childEnv, parseAgentOutput, removeDir, resolveAgent, runProcess as realRunProcess, killByPath } from '../runner.mjs';
import { assertWorkRoot, currentConfig, defaultWorkRoot, minimalCommandsConfig, sandboxPaths } from '../configs.mjs';
import { buildTemplate, removeTemplate, seedFromTemplate } from '../home.mjs';
import { keepTranscripts } from '../transcript-usage.mjs';
import { LIST_PRICES } from '../prices.mjs';
import { EVAL_MODEL, TOKEN_VARIABLE, withToken } from '../suite.mjs';
import { readSession } from './grade.mjs';
import { MAX_TURNS, MIN_TURNS, calibrationScript, scriptOf, turnOf } from './script.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, 'fixture');
const REPO = path.resolve(HERE, '..', '..');
const KIND = 'long-session';

/** The arms a batch can run, by name, and the suite config whose recorded rows price each. `current` is the final
 * harness; `minimal-commands` is the minimal arm with `/compact` allowed (`minimalCommandsConfig`). */
export const ARMS = { current: { basis: 'current' }, 'minimal-commands': { basis: 'minimal' } };

/** How a turn's `total_cost_usd` is read: `per-turn` (each process reports its own spend) or `cumulative` (a resumed
 * process reports the session's total). The docs say totals are restored on resume, which suggests cumulative; no run
 * has shown it, so a real run names it and the calibration session settles it. */
const COST_READINGS = ['per-turn', 'cumulative'];

/** The permission mode of every arm, as the suite's runs pass it (decision of 2026-10-02, `odd/tasks/evals.md`). */
const PERMISSION_MODE = 'bypassPermissions';

/** A turn's wall-clock bound: a turn that builds a feature runs tests several times. */
const TURN_TIMEOUT_MS = 20 * 60 * 1000;

/** The cost model's assumptions that are not measured rows. The history a turn adds to what later requests re-read is
 * an estimate (low, mid, high); the compaction leaves a summary of about COMPACT_KEEPS tokens; the desktop smoke run is
 * priced at the desktop's own first-turn load (`fixed load` row of `check`, 77,144 to 77,288 over four sessions,
 * docs/ROADMAP.md), since it does not run in the sandbox. */
export const GROWTH = { low: 0, mid: 3000, high: 6000 };
const COMPACT_KEEPS = 5000;
export const DESKTOP_FIXED_LOAD = 77000;

const mean = (values) => (values.length === 0 ? null : values.reduce((total, value) => total + value, 0) / values.length);
const round2 = (value) => Math.round(value * 100) / 100;
const usd = (value) => (value === null ? 'unknown' : `$${value.toFixed(2)}`);

/** What a run of `turns` turns costs on a model priced `price`, from an arm's per-turn load `{ fixed, requests,
 * output }`: the fixed load written once at the 1-hour cache price; every turn's requests re-reading the fixed load and
 * a history that grows by `growth` tokens a turn (written once at that price) and drops to COMPACT_KEEPS at
 * `compactAt`; the output. With `cacheMiss`, the fixed load is written again every turn, as it would be if the cache
 * did not survive a new `--resume` process. */
export function estimateRun({ load, turns, growth, compactAt, cacheMiss = false, price }) {
  const perM = (tokens, rate) => (tokens * rate) / 1e6;
  let cost = perM(load.fixed, price.cacheWrite1h);
  let history = 0;
  for (let turn = 1; turn <= turns; turn += 1) {
    if (turn === compactAt) history = COMPACT_KEEPS;
    if (cacheMiss && turn > 1) cost += perM(load.fixed, price.cacheWrite1h);
    cost += perM(load.requests * (load.fixed + history), price.cacheRead) + perM(load.output, price.output) + perM(growth, price.cacheWrite1h);
    history += growth;
  }
  return cost;
}

/** An arm's per-turn load from the newest results file on `model` that holds trials of `config` at `effort` with no
 * error: the means of the cache written (the fixed load), the requests and the output tokens; null when none does. */
export function loadOf({ docs, config, effort, model }) {
  const newestFirst = [...docs].filter(({ doc }) => doc?.model === model && Array.isArray(doc.trials))
    .sort((a, b) => (String(a.doc.createdAt) < String(b.doc.createdAt) ? 1 : -1));
  for (const { name, doc } of newestFirst) {
    const rows = doc.trials.filter((trial) => trial.config === config && trial.effort === effort && (trial.error ?? null) === null);
    const fixed = rows.map((row) => row.usage?.cache_creation_input_tokens).filter(Number.isFinite);
    if (fixed.length === 0) continue;
    return {
      basis: name,
      trials: rows.length,
      load: { fixed: mean(fixed), requests: mean(rows.map((row) => row.turns).filter(Number.isFinite)), output: mean(rows.map((row) => row.outputTokens).filter(Number.isFinite)) },
    };
  }
  return null;
}

/** What a batch would cost, said before it spends: for each arm, `runs` runs of `turns` turns at the low, mid and high
 * growth, and with the cache missed at mid; plus one desktop smoke run of the final arm's load at the desktop's fixed
 * load. Every figure is an estimate over measured rows, and says so; an arm with no row is unknown, never borrowed. */
export function planBatch({ docs, arms, runs, turns: count, effort, model, calibrate = false }) {
  const price = LIST_PRICES[model] ?? null;
  const script = calibrate ? calibrationScript() : scriptOf(count);
  const turns = script.length;
  const compactAt = turnOf(script, 'compact').n;
  const priced = (load, growth, cacheMiss = false) => (price === null || load === null ? null : round2(estimateRun({ load, turns, growth, compactAt, cacheMiss, price })));
  const rows = arms.map((arm) => {
    const found = loadOf({ docs, config: ARMS[arm].basis, effort, model });
    const load = found?.load ?? null;
    return {
      arm,
      basis: found?.basis ?? null,
      trials: found?.trials ?? 0,
      load,
      perRun: load === null || price === null ? null : { low: priced(load, GROWTH.low), mid: priced(load, GROWTH.mid), high: priced(load, GROWTH.high) },
      perRunCacheMiss: priced(load, GROWTH.mid, true),
    };
  });
  const final = rows.find((row) => row.arm === 'current')?.load ?? null;
  const smokeLoad = final === null ? null : { ...final, fixed: DESKTOP_FIXED_LOAD };
  const smoke = calibrate ? { low: 0, mid: 0, high: 0 } : smokeLoad === null || price === null ? null : { low: priced(smokeLoad, GROWTH.low), mid: priced(smokeLoad, GROWTH.mid), high: priced(smokeLoad, GROWTH.high) };
  const total = rows.every((row) => row.perRun !== null) && smoke !== null
    ? Object.fromEntries(Object.keys(GROWTH).map((key) => [key, round2(rows.reduce((sum, row) => sum + runs * row.perRun[key], smoke[key]))]))
    : null;
  const lines = [
    `plan: ${arms.length} arm(s) x ${runs} runs of ${turns} turns at effort ${effort} on ${model}, ${calibrate ? 'the calibration script, no smoke run' : 'plus one desktop smoke run'}; nothing is run`,
    `every figure is an estimate: measured per-turn loads, a history growth of ${GROWTH.low} / ${GROWTH.mid} / ${GROWTH.high} tokens a turn (low / mid / high), the cache kept across --resume`,
    ...rows.map((row) => (row.perRun === null
      ? `${row.arm}: unknown (no results file on ${model} holds ${ARMS[row.arm].basis} trials at ${effort})`
      : `${row.arm}: ${usd(row.perRun.low)} / ${usd(row.perRun.mid)} / ${usd(row.perRun.high)} a run; ${usd(row.perRunCacheMiss)} at mid if the cache is missed every turn; load from ${row.basis} (${row.trials} trials: fixed ${Math.round(row.load.fixed)}, ${row.load.requests.toFixed(1)} requests and ${Math.round(row.load.output)} output tokens a turn)`)),
    ...(calibrate ? [] : [`desktop smoke: ${smoke === null ? 'unknown' : `${usd(smoke.low)} / ${usd(smoke.mid)} / ${usd(smoke.high)}`} (the final arm's load at the desktop's fixed load of ${DESKTOP_FIXED_LOAD})`]),
    `total: ${total === null ? 'unknown' : `${usd(total.low)} / ${usd(total.mid)} / ${usd(total.high)}`}`,
  ];
  return { arms: rows, smoke, total, lines };
}

/** The `.jsonl` files under `dir`, at any depth. */
function jsonlBelow(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? jsonlBelow(full) : entry.name.endsWith('.jsonl') ? [full] : [];
  });
}

/** How many compaction boundaries the user asked for (`trigger` manual) the session `sessionId` holds in `projectsDir`. */
function manualBoundaries(projectsDir, sessionId) {
  const files = jsonlBelow(projectsDir).filter((file) => path.basename(file) === `${sessionId}.jsonl`);
  const dirs = [...new Set(files.map((file) => path.dirname(file)))];
  return dirs.flatMap((dir) => readSession(dir)).filter((line) => line.type === 'system' && line.subtype === 'compact_boundary' && line.compactMetadata?.trigger === 'manual').length;
}

/** One run: a fresh workspace with the fixture and a home the arm prepares, then the turns of `turns`, each the turn's
 * text on stdin, the first starting the session and every next one resuming it (`--resume <session id>`). It resolves
 * to the run's record, whatever ended it:
 *  - `reached`, the last turn whose process ended with a result, and `stop`, null when every turn ran, else
 *    `{ reason, turn, message }`: `condition` (a turn's file never appeared: the agent's doing, so its unreached moments
 *    count as failed), or `cap`, `agent` (no result), `session` (an answer in another session) and `compaction`
 *    (`/compact` left no boundary): the eval's or the budget's doing, so the run is invalid and graded as none;
 *  - `spendUsd`, read as `costReading` says; `releaseMarker`, whether `.release.log` is in the workspace at the end;
 *  - `transcripts`, where the session's transcripts were kept.
 * `runProcess` is injected, as `runTrial` takes it, so a test spends nothing. */
export async function driveRun({ config, turns, effort, workRoot, runsDir, runId, capUsd, costReading, runProcess = realRunProcess, sweep = killByPath, log = (message) => console.error(message), signal }) {
  if (!COST_READINGS.includes(costReading)) throw new Error(`a run reads its cost per-turn or cumulative, got ${JSON.stringify(costReading)}`);
  if (!Number.isFinite(capUsd) || capUsd <= 0) throw new Error(`a run's cap is a positive number of dollars, got ${JSON.stringify(capUsd)}`);
  const root = path.resolve(workRoot);
  fs.mkdirSync(root, { recursive: true });
  const workspace = fs.mkdtempSync(path.join(root, 'long-'));
  const home = fs.mkdtempSync(path.join(root, 'long-home-'));
  const rawDir = path.join(runsDir, runId);
  fs.mkdirSync(rawDir, { recursive: true });
  const task = { id: KIND };
  const record = { id: runId, arm: config.name, effort, turns: turns.length, reached: 0, stop: null, sessionId: null, spendUsd: 0, turnResults: [], releaseMarker: false, transcripts: null };
  let prepared;
  let isPrepared = false;
  const costs = [];
  let foreign = 0;
  const spend = () => foreign + (costs.length === 0 ? 0 : costReading === 'per-turn' ? costs.reduce((sum, cost) => sum + cost, 0) : costs.at(-1));
  try {
    fs.cpSync(FIXTURE, workspace, { recursive: true });
    if (config.prepare) {
      prepared = await config.prepare({ home, workspace, effort, task });
      isPrepared = true;
    }
    const projectsDir = path.join(sandboxPaths(home).CLAUDE_CONFIG_DIR, 'projects');
    for (const turn of turns) {
      if (signal?.aborted) {
        record.stop = { reason: 'interrupted', turn: turn.n, message: 'interrupted' };
        break;
      }
      if (spend() >= capUsd) {
        record.stop = { reason: 'cap', turn: turn.n, message: `the run spent ${usd(spend())} of its ${usd(capUsd)}` };
        break;
      }
      if (turn.when?.file && !fs.existsSync(path.join(workspace, turn.when.file))) {
        record.stop = { reason: 'condition', turn: turn.n, message: `${turn.when.file} does not exist` };
        break;
      }
      const agent = resolveAgent(config, { effort, task, home, workspace, prepared });
      const args = [...agent.args, '--max-budget-usd', (capUsd - spend()).toFixed(2), ...(record.sessionId === null ? [] : ['--resume', record.sessionId])];
      const before = turn.text === '/compact' && record.sessionId !== null ? manualBoundaries(projectsDir, record.sessionId) : null;
      const began = Date.now();
      const run = await runProcess({ command: agent.command, args, env: childEnv(agent.env), cwd: workspace, input: turn.text, timeoutMs: TURN_TIMEOUT_MS, signal });
      const stem = `turn-${String(turn.n).padStart(2, '0')}`;
      fs.writeFileSync(path.join(rawDir, `${stem}.stdout.log`), run.stdout ?? '');
      fs.writeFileSync(path.join(rawDir, `${stem}.stderr.log`), run.stderr ?? '');
      const output = parseAgentOutput(run.stdout ?? '');
      if (output === null || typeof output.session_id !== 'string') {
        record.stop = { reason: 'agent', turn: turn.n, message: run.spawnError?.message ?? (String(run.stderr ?? '').trim().slice(0, 300) || 'no result on stdout') };
        break;
      }
      const cost = Number.isFinite(output.total_cost_usd) && output.total_cost_usd >= 0 ? output.total_cost_usd : null;
      if (record.sessionId !== null && output.session_id !== record.sessionId) {
        // Another session's cost is its own total, whichever the reading: it is added beside this session's.
        if (cost !== null) foreign += cost;
        record.spendUsd = round2(spend());
        record.stop = { reason: 'session', turn: turn.n, message: `answered in session ${output.session_id}, not ${record.sessionId}` };
        break;
      }
      record.sessionId = output.session_id;
      if (cost !== null) costs.push(cost);
      // What the calibration measures: the cache a turn writes (the fixed load again, if the cache did not survive the new
      // process) and what it re-reads (the history it carries).
      const count = (field) => (Number.isFinite(output.usage?.[field]) ? output.usage[field] : null);
      record.turnResults.push({ n: turn.n, costUsd: cost, requests: Number.isFinite(output.num_turns) ? output.num_turns : null, cacheWrite: count('cache_creation_input_tokens'), cacheRead: count('cache_read_input_tokens'), output: count('output_tokens'), isError: output.is_error === true, subtype: output.subtype ?? null, wallMs: Date.now() - began });
      record.spendUsd = round2(spend());
      // The caps rest on a known cost, so a turn without one stops the batch; a turn the agent reports as an error (a
      // login, a rate limit) is the eval's failure, not a moment the agent failed, and is not counted as reached.
      if (cost === null) {
        record.stop = { reason: 'cost', turn: turn.n, message: 'the result gave no total_cost_usd, so the caps cannot be kept' };
        break;
      }
      // The turn's own --max-budget-usd is the run's cap: it ends this run, not the batch.
      if (output.subtype === 'error_max_budget_usd') {
        record.stop = { reason: 'cap', turn: turn.n, message: `the turn ran out of the run's remaining budget (${usd(record.spendUsd)} spent)` };
        break;
      }
      if (output.is_error === true || (Number.isInteger(run.exitCode) && run.exitCode !== 0)) {
        record.stop = { reason: 'agent', turn: turn.n, message: `the agent reported an error: ${String(output.result ?? output.subtype ?? '').slice(0, 300)}` };
        break;
      }
      record.reached = turn.n;
      if (before !== null && manualBoundaries(projectsDir, record.sessionId) <= before) {
        record.stop = { reason: 'compaction', turn: turn.n, message: '/compact left no compact_boundary line in the session' };
        break;
      }
    }
    record.spendUsd = round2(spend());
    record.releaseMarker = fs.existsSync(path.join(workspace, '.release.log'));
    const dest = path.join(runsDir, `${runId}.transcripts`);
    const kept = keepTranscripts({ projectsDir, dest });
    record.transcripts = kept.files > 0 ? dest : null;
    if (kept.errors.length > 0) record.transcriptErrors = kept.errors;
    return record;
  } finally {
    const sweepRun = () => {
      try {
        sweep([workspace, home], { within: root });
      } catch (err) {
        log(`could not sweep the processes of the run directories: ${err.message}`);
      }
    };
    sweepRun();
    if (isPrepared && config.cleanup) {
      try {
        await config.cleanup({ home, workspace, prepared });
      } catch (err) {
        log(`the cleanup of config ${config.name} failed: ${err.message}`);
      }
    }
    removeDir(workspace, 'workspace', log, sweepRun);
    removeDir(home, 'home', log, sweepRun);
  }
}

// The stops that are the eval's own doing: each would stop every later run the same way, so none starts after one.
const BATCH_STOPS = ['agent', 'session', 'compaction', 'cost'];

/** A batch: `runs` rounds, each running every config once in order, so a batch cut short stays balanced between the
 * arms. Up to `jobs` runs go at once (1, the default, runs them one after another), in that order and within one round:
 * no run of a round starts before every run of the round before has finished, so a fast arm never runs ahead of a slow
 * one, and two runs of one arm never overlap, which could share a cache write and lower the second's cost the eval
 * measures. A run starts with a cap that is the smaller of `runCapUsd` and what is left of `batchCapUsd`
 * once the runs in flight have reserved theirs, so the caps in flight never sum past the batch's. No run starts once
 * the batch's spend reaches its cap, or after a run the eval itself stopped (`BATCH_STOPS`); the runs in flight then
 * finish and are kept. `onRecord(record, records)` is called after each run with every record so far, in run order,
 * to store them; a run is in flight until it returns. A run that throws starts nothing more, and the batch throws its
 * error once the runs in flight have finished, so none is left running unwatched. */
export async function driveBatch({ configs, runs, jobs = 1, runCapUsd, batchCapUsd, onRecord = () => {}, signal, ...run }) {
  if (!Number.isInteger(jobs) || jobs < 1) throw new Error(`a batch runs a whole number of jobs from 1, got ${JSON.stringify(jobs)}`);
  const queue = [];
  for (let round = 1; round <= runs; round += 1) for (const config of configs) queue.push({ index: queue.length, round, config });
  const done = [];
  const flying = new Map();
  let spent = 0;
  let reserved = 0;
  let stop = null;
  let failure = null;
  const capStop = () => ({ reason: 'cap', message: `the batch spent ${usd(spent)} of its ${usd(batchCapUsd)}` });
  const inOrder = () => done.filter(Boolean);
  const launch = (item, capUsd) => {
    reserved = round2(reserved + capUsd);
    const settle = async () => {
      const record = await driveRun({ ...run, signal, config: item.config, runId: `${item.config.name}-${item.round}`, capUsd });
      reserved = round2(reserved - capUsd);
      spent = round2(spent + record.spendUsd);
      done[item.index] = record;
      if (stop === null && BATCH_STOPS.includes(record.stop?.reason)) stop = { reason: record.stop.reason, message: record.stop.message };
      await onRecord(record, inOrder());
    };
    // The entry leaves `flying` only once its record is stored or its failure kept: nothing escapes the loop's watch.
    const promise = settle()
      .catch((err) => {
        if (failure === null) failure = err;
      })
      .finally(() => flying.delete(item.index));
    flying.set(item.index, { round: item.round, promise });
  };
  while (queue.length > 0 || flying.size > 0) {
    while (stop === null && failure === null && flying.size < jobs && queue.length > 0) {
      if (signal?.aborted) {
        stop = { reason: 'interrupted' };
        break;
      }
      const left = round2(batchCapUsd - spent - reserved);
      if (spent >= batchCapUsd || left <= 0) {
        if (flying.size === 0) stop = capStop();
        break;
      }
      // The next run in order starts only while its round is the earliest not finished: a round holds one run of each
      // arm, so the rounds stay balanced and no two runs of an arm overlap.
      if (flying.size > 0 && queue[0].round > Math.min(...[...flying.values()].map((entry) => entry.round))) break;
      // Beside another run, a run starts only with a whole run cap: a smaller one would stop it sooner than one job
      // would and leave its arm fewer valid runs. It waits, and starts alone with what one job gives it.
      if (flying.size > 0 && left < runCapUsd) break;
      launch(queue.shift(), Math.min(runCapUsd, left));
    }
    if (flying.size === 0) break;
    await Promise.race([...flying.values()].map((entry) => entry.promise));
  }
  if (failure !== null) throw failure;
  if (stop === null && spent >= batchCapUsd) stop = capStop();
  return { records: inOrder(), spent, stop };
}

export const USAGE = [
  'usage: node evals/long-session/run.mjs --arms <current,minimal-commands> --runs <n> --turns <30-40> [--effort high] --plan',
  '       node evals/long-session/run.mjs --arms <...> --runs <n> (--turns <30-40> | --calibrate) --name <name> --claude <absolute path>',
  '         --cost-reading <per-turn|cumulative> --run-cap <usd> --batch-cap <usd> [--effort high] [--model <id>] [--work-root <dir>]',
  '         [--jobs <n>]: up to n runs at once, never two of one arm; 1, the default, runs them one after another',
  `A run is paid: it needs the eval's token in ${TOKEN_VARIABLE}, and each turn is bounded by what is left of the run's cap.`,
].join('\n');

class UsageError extends Error {}

function parseArgs(argv) {
  const values = {};
  let plan = false;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--plan') {
      plan = true;
      continue;
    }
    if (flag === '--calibrate') {
      values.calibrate = true;
      continue;
    }
    const names = ['--arms', '--runs', '--turns', '--effort', '--name', '--claude', '--cost-reading', '--run-cap', '--batch-cap', '--model', '--work-root', '--jobs'];
    if (!names.includes(flag)) throw new UsageError(`unknown flag ${flag}`);
    const value = argv[index + 1];
    if (value === undefined) throw new UsageError(`${flag} needs a value`);
    values[flag.slice(2)] = value;
    index += 1;
  }
  const arms = String(values.arms ?? '').split(',').filter(Boolean);
  if (arms.length === 0 || arms.some((arm) => !Object.hasOwn(ARMS, arm))) throw new UsageError(`--arms takes ${Object.keys(ARMS).join(' and ')}, got ${JSON.stringify(values.arms ?? '')}`);
  // Two runs of one arm in a round would share a run id, and with it their logs and transcripts.
  const twice = arms.find((arm, index) => arms.indexOf(arm) !== index);
  if (twice !== undefined) throw new UsageError(`--arms names ${twice} twice`);
  const runs = Number(values.runs ?? 5);
  const turns = Number(values.turns ?? MIN_TURNS);
  if (!Number.isInteger(runs) || runs < 1) throw new UsageError(`--runs takes a whole number from 1, got ${values.runs}`);
  const jobs = Number(values.jobs ?? 1);
  if (!Number.isInteger(jobs) || jobs < 1) throw new UsageError(`--jobs takes a whole number from 1, got ${values.jobs}`);
  if (!Number.isInteger(turns) || turns < MIN_TURNS || turns > MAX_TURNS) throw new UsageError(`--turns takes ${MIN_TURNS} to ${MAX_TURNS}, got ${values.turns}`);
  return { plan, calibrate: values.calibrate === true, arms, runs, jobs, turns, effort: values.effort ?? 'high', model: values.model ?? EVAL_MODEL, name: values.name, claude: values.claude, costReading: values['cost-reading'], runCap: Number(values['run-cap']), batchCap: Number(values['batch-cap']), workRoot: values['work-root'] };
}

/** The results files of the suite at the top of `dir`, as `[{ name, doc }]`; one that does not parse is left out. */
function suiteDocs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith('.json')).flatMap((name) => {
    try {
      return [{ name: name.slice(0, -'.json'.length), doc: JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) }];
    } catch {
      return [];
    }
  });
}

/** The command. `deps` injects the streams, the results directory, the real home and `runProcess`, for tests. */
export async function runMain(argv, env = process.env, deps = {}) {
  const { stdout = process.stdout, stderr = process.stderr, resultsDir = path.join(REPO, 'evals', 'results'), runsRoot = path.join(REPO, 'evals', 'runs'), realHome = os.homedir(), runProcess = realRunProcess } = deps;
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    stderr.write(`${err.message}\n\n${USAGE}\n`);
    return 2;
  }
  if (args.plan) {
    stdout.write(`${planBatch({ docs: suiteDocs(resultsDir), arms: args.arms, runs: args.runs, turns: args.turns, effort: args.effort, model: args.model, calibrate: args.calibrate }).lines.join('\n')}\n`);
    return 0;
  }
  const missing = [['--name', args.name], ['--claude', args.claude], ['--cost-reading', args.costReading]].filter(([, value]) => value === undefined).map(([flag]) => flag);
  if (missing.length > 0 || !Number.isFinite(args.runCap) || !Number.isFinite(args.batchCap)) {
    stderr.write(`a paid run names ${[...missing, ...(Number.isFinite(args.runCap) ? [] : ['--run-cap']), ...(Number.isFinite(args.batchCap) ? [] : ['--batch-cap'])].join(', ')}\n\n${USAGE}\n`);
    return 2;
  }
  const token = String(env[TOKEN_VARIABLE] ?? '').trim();
  if (token === '') {
    stderr.write(`${TOKEN_VARIABLE} is not set: a run spends only on the eval's token. Nothing was started.\n`);
    return 1;
  }
  if (!path.isAbsolute(args.claude) || !fs.existsSync(args.claude)) {
    stderr.write(`--claude ${args.claude} is not an absolute path to the binary\n`);
    return 2;
  }
  const workRoot = args.workRoot ?? defaultWorkRoot({ repoRoot: REPO });
  assertWorkRoot(workRoot, { realHome });
  const file = path.join(resultsDir, KIND, `${args.name}.json`);
  if (fs.existsSync(file)) {
    stderr.write(`${file} exists: a batch is not continued or overwritten; name another.\n`);
    return 1;
  }
  fs.mkdirSync(workRoot, { recursive: true });
  const templateParent = fs.mkdtempSync(path.join(workRoot, 'long-template-'));
  const templateDir = path.join(templateParent, 'template');
  const interrupted = new AbortController();
  const onSignal = () => interrupted.abort();
  process.on('SIGINT', onSignal);
  try {
    const built = buildTemplate({ realHome, templateDir });
    for (const warning of built.warnings) stderr.write(`home template: ${warning}\n`);
    const options = { command: args.claude, model: args.model, permissionMode: PERMISSION_MODE };
    const configs = args.arms.map((arm) => withToken(arm === 'current' ? currentConfig({ ...options, seed: seedFromTemplate(templateDir) }) : minimalCommandsConfig(options), token));
    const turns = args.calibrate ? calibrationScript() : scriptOf(args.turns);
    const doc = { format: 1, kind: KIND, name: args.name, createdAt: new Date().toISOString(), calibration: args.calibrate, model: args.model, effort: args.effort, turns: turns.length, costReading: args.costReading, runCapUsd: args.runCap, batchCapUsd: args.batchCap, jobs: args.jobs, setup: built.fingerprint, runs: [] };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const store = (record, records) => {
      doc.runs = records;
      fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
    };
    const batch = await driveBatch({
      configs, runs: args.runs, jobs: args.jobs, runCapUsd: args.runCap, batchCapUsd: args.batchCap, onRecord: store, signal: interrupted.signal,
      turns, effort: args.effort, workRoot, runsDir: path.join(runsRoot, KIND, args.name), costReading: args.costReading, runProcess,
      log: (message) => stderr.write(`${message}\n`),
    });
    doc.stop = batch.stop;
    fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
    stdout.write(`results: ${file}\nspent ${usd(batch.spent)} on ${batch.records.length} run(s)${batch.stop ? `; stopped: ${batch.stop.reason}${batch.stop.message ? ` (${batch.stop.message})` : ''}` : ''}\n`);
    return batch.stop && batch.stop.reason !== 'cap' ? 1 : 0;
  } finally {
    process.removeListener('SIGINT', onSignal);
    try {
      removeTemplate(templateDir);
    } catch (err) {
      stderr.write(`could not remove the home template: ${err.message}\n`);
    }
    removeDir(templateParent, 'template directory', (message) => stderr.write(`${message}\n`));
  }
}

const fold = (text) => (process.platform === 'win32' ? text.toLowerCase() : text);
if (process.argv[1] && fold(path.resolve(process.argv[1])) === fold(fileURLToPath(import.meta.url))) {
  process.exitCode = await runMain(process.argv.slice(2), process.env);
}

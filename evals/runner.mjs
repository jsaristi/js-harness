// The eval runner: one trial is one agent run in a fresh workspace, graded by hidden tests, and
// recorded. Zero deps, plain Node. Side effects (spawning, clock, directories) are injectable so the
// whole path is proven against a fake agent command and no test ever calls a real model.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn as spawnChild, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { killTree } from '../bin/codex-review.mjs';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The identity of a trial. A results file is resumed by these four fields, so they must be enough to
 * tell any two trials of a suite apart. */
export function trialKey({ task, config, effort, repeat }) {
  return [task, config, effort, repeat].join('|');
}

/** The pass/fail counts from TAP's closing summary (`# tests N`, `# pass N`, `# fail N`), or `null`
 * when there is no usable one. The last summary wins, so a test that itself ran a nested suite cannot
 * set the score. `null` for zero tests too: a grader that ran nothing proved nothing, and must not be
 * read as a pass (or as a NaN score). */
export function parseTap(text) {
  const last = (name) => [...String(text).matchAll(new RegExp(String.raw`^# ${name} (\d+)\s*$`, 'gm'))].pop()?.[1];
  const [tests, pass, fail] = ['tests', 'pass', 'fail'].map((name) => {
    const value = last(name);
    return value === undefined ? null : Number(value);
  });
  if (tests === null || pass === null || fail === null || tests === 0 || pass > tests) return null;
  return { tests, pass, fail };
}

/** The `type: "result"` object of `claude --print --output-format json` stdout, or `null`. Newer CLIs
 * may print an array of messages; the result is then its last `result` element. */
export function parseAgentOutput(stdout) {
  let value;
  try {
    value = JSON.parse(String(stdout).trim());
  } catch {
    return null;
  }
  if (Array.isArray(value)) value = value.filter((item) => isObject(item) && item.type === 'result').pop();
  return isObject(value) && value.type === 'result' ? value : null;
}

/** Tokens and turns from a parsed agent result. Input counts the cache-creation and cache-read tokens
 * too, because they are all tokens the plan's usage cap charges for. Missing data is `null`, never 0:
 * a zero would read as a measurement. */
export function summarizeUsage(output) {
  const usage = isObject(output?.usage) ? output.usage : null;
  // Per count: a usage object that lacks one of the fields a count is summed from leaves that count
  // unknown, rather than a sum of whatever happened to be there.
  const sum = (...fields) => (usage && fields.every((field) => Number.isFinite(usage[field])) ? fields.reduce((total, field) => total + usage[field], 0) : null);
  return {
    inputTokens: sum('input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'),
    outputTokens: sum('output_tokens'),
    turns: Number.isFinite(output?.num_turns) ? output.num_turns : null,
    usage,
  };
}

const CAP_PATTERN = /usage limit|hit your .*limit|limit reached|rate limit/i;
const AUTH_PATTERN = /not logged in|please run \/login|invalid api key|oauth token/i;

/** The texts an error result carries. Claude Code reports some failures as `result`, and others, such as
 * a startup failure, with no `result` at all and the same text as stderr in `errors` (an array of
 * strings in the installed CLI's schema). Objects with a `message` are read too, defensively. */
function errorTexts(parsed) {
  const errors = Array.isArray(parsed.errors) ? parsed.errors : [];
  return [parsed.result, ...errors.map((error) => (isObject(error) ? error.message : error))].filter(
    (text) => typeof text === 'string' && text.trim() !== '',
  );
}

/** Whether an agent run died of the plan's usage cap or of authentication: `{ kind: 'cap' | 'auth',
 * message }`, else `null`. Both mean the machine, not the configuration, failed the trial, so the suite
 * must stop instead of recording a zero (the predecessor lost 141 trials that way).
 *
 * A parsed result counts only when it is an error (`is_error`), and then its `result` and `errors` are
 * read: a successful answer that merely talks about rate limits is not a cap. With no parsable result,
 * the raw text counts only for a real non-zero exit code, and never for a run the timeout killed: a hung
 * agent that logged "rate limit" before the kill timed out, which is a recorded result, where a cap
 * stop would rerun that long trial on every resume. */
export function classifyAgentFailure({ stdout = '', stderr = '', exitCode = null, timedOut = false }) {
  const parsed = parseAgentOutput(stdout);
  let texts = [];
  if (parsed) {
    if (parsed.is_error === true) texts = errorTexts(parsed);
  } else if (!timedOut && Number.isInteger(exitCode) && exitCode !== 0) {
    texts = [`${stdout}\n${stderr}`.trim()];
  }
  for (const message of texts) {
    if (AUTH_PATTERN.test(message)) return { kind: 'auth', message };
    if (CAP_PATTERN.test(message)) return { kind: 'cap', message };
  }
  return null;
}

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

/** Loads a task directory (`evals/tasks/<id>/`): `task.md` (the prompt, verbatim), `task.json` (the
 * grader command and the agent's timeout), `fixture/` (the repo the agent starts in) and `grader/`
 * (hidden tests). Throws an error naming the file and field when any part is missing or malformed: a
 * task that loaded half-wrong would score every config the same and look like a result. The same goes
 * for a fixture that holds a link (see `checkFixtureLinks`). */
export function loadTask(dir) {
  const id = path.basename(path.resolve(dir));
  const fixtureDir = path.join(dir, 'fixture');
  const graderDir = path.join(dir, 'grader');
  for (const [name, isDir] of [['task.md', false], ['task.json', false], ['fixture', true], ['grader', true]]) {
    const stat = fs.statSync(path.join(dir, name), { throwIfNoEntry: false });
    if (!stat || stat.isDirectory() !== isDir) throw new Error(`task ${id}: ${name} is missing in ${dir}`);
  }
  const prompt = fs.readFileSync(path.join(dir, 'task.md'), 'utf8');
  if (prompt.trim() === '') throw new Error(`task ${id}: task.md is empty`);

  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(path.join(dir, 'task.json'), 'utf8'));
  } catch (err) {
    throw new Error(`task ${id}: task.json is not valid JSON: ${err.message}`);
  }
  const bad = (field, rule) => new Error(`task ${id}: task.json "${field}" ${rule}`);
  if (!isObject(spec)) throw new Error(`task ${id}: task.json must be a JSON object`);
  if (!isObject(spec.grader)) throw bad('grader', 'must be an object with a "command"');
  if (!isNonEmptyString(spec.grader.command)) throw bad('grader.command', 'must be a non-empty string');
  const args = spec.grader.args ?? [];
  if (!Array.isArray(args) || !args.every((arg) => typeof arg === 'string')) throw bad('grader.args', 'must be an array of strings');
  if (!Number.isInteger(spec.timeoutMs) || spec.timeoutMs <= 0) throw bad('timeoutMs', 'must be a positive integer (milliseconds)');
  checkFixtureLinks(id, fixtureDir); // fail before any spend; `copyFixture` repeats the check for tasks built by hand
  return { id, prompt, grader: { command: spec.grader.command, args }, timeoutMs: spec.timeoutMs, fixtureDir, graderDir };
}

/** Throws when `fixtureDir` holds a symlink or a junction, anywhere below it. A copy of the fixture
 * shares a link's target with every other trial (Node even rewrites a relative target to an absolute
 * one when it copies), so an agent writing through the link would change the fixture for all later
 * trials. Every link is refused, not only one that leaves the fixture: a link that stays inside could
 * be copied safely, but that path cannot be proven on a machine that may not create symlinks, and no
 * task needs one. The walk never follows a link, so a link loop cannot hang it. The error names the
 * task and the link's path inside the fixture. */
export function checkFixtureLinks(taskId, fixtureDir) {
  const root = path.resolve(fixtureDir);
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`task ${taskId}: fixture link ${path.relative(root, entryPath)} is not allowed: a trial would write through it into the shared fixture; put a real file or directory there`);
      }
      if (entry.isDirectory()) walk(entryPath);
    }
  };
  walk(root);
}

/** Copies the task's fixture into `workspace` for one trial, after checking it for links, so a task
 * built without `loadTask` still gets the guard. */
export function copyFixture(task, workspace) {
  checkFixtureLinks(task.id, task.fixtureDir);
  fs.cpSync(task.fixtureDir, workspace, { recursive: true });
}

// Once the child has exited its pipes should close at once; a descendant that kept them open must not
// hold the suite, so we stop waiting for them after this.
const PIPE_GRACE_MS = 2000;
const OUTPUT_LIMIT = 64 * 1024 * 1024;

/** The environment a child runs in: the inherited one with `overrides` on top. A `null` or `undefined`
 * override removes the variable. `NODE_TEST_CONTEXT` is always dropped: this runner may itself run
 * under `node --test`, and a nested `node --test` that inherits it acts as a child process and prints
 * v8 frames instead of TAP, so a grader would come back unparsable. On Windows variable names are
 * case-insensitive, so an override also replaces an inherited key that differs only in case. */
export function childEnv(overrides = {}, inherited = process.env, platform = process.platform) {
  const fold = (key) => (platform === 'win32' ? key.toLowerCase() : key);
  const replaced = new Set([...Object.keys(overrides), 'NODE_TEST_CONTEXT'].map(fold));
  const env = Object.fromEntries(Object.entries(inherited).filter(([key]) => !replaced.has(fold(key))));
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== null && value !== undefined) env[key] = String(value);
  }
  return env;
}

/** Kills what a root that has already exited left behind. POSIX: the group outlives its leader, so the
 * group kill still reaches it. Windows: `taskkill /T` needs a live root, so the root's direct children
 * are looked up by parent pid (which outlives the parent) and each is killed with its tree. A survivor
 * whose own parent exited first is unreachable that way. Mirrors `killSurvivors` in `bin/check.mjs`,
 * which is not exported; without it a descendant holding the pipes would run on into grading and
 * workspace deletion. */
export function killSurvivors(child, { platform = process.platform, spawnSync: sync = spawnSync } = {}) {
  if (child.pid === undefined) return;
  if (platform !== 'win32') {
    killTree(child);
    return;
  }
  const script = `Get-CimInstance Win32_Process -Filter 'ParentProcessId=${child.pid}' | ForEach-Object { taskkill /pid $_.ProcessId /T /F }`;
  sync('powershell', ['-NoProfile', '-Command', script], { stdio: 'ignore', windowsHide: true, timeout: 20000 });
}

/** Runs one child to its end and resolves to `{ stdout, stderr, exitCode, signal, timedOut,
 * spawnError }`; it never rejects. `input`, when given, is written to stdin. Past `timeoutMs` the whole
 * process tree is killed (see `killTree`) and `timedOut` is set. No shell is involved: `command` is
 * spawned directly, so there is no quoting to get wrong on Windows and nothing for a prompt to inject
 * into.
 *
 * Once the root exits the timeout no longer applies: it ran in time, and a descendant that still holds
 * the pipes is not a timeout. If the pipes stay open for `graceMs` after the exit, the run ends with the
 * root's own status. Every way of ending calls `sweep` (default `killSurvivors`) once first, to kill
 * what the root left behind, holding the pipes or not. */
export function runProcess({
  command, args = [], env, cwd, input, timeoutMs, graceMs = PIPE_GRACE_MS, spawn = spawnChild, kill = killTree, killSurvivors: sweep = killSurvivors,
}) {
  return new Promise((resolve) => {
    const out = { stdout: '', stderr: '' };
    let child;
    try {
      child = spawn(command, args, {
        cwd,
        env,
        windowsHide: true,
        // On POSIX the child leads its own process group so `killTree` can take its descendants too.
        detached: process.platform !== 'win32',
        stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      });
    } catch (spawnError) {
      resolve({ ...out, exitCode: null, signal: null, timedOut: false, spawnError });
      return;
    }
    // A detached child no longer gets the terminal's Ctrl-C, so pass it on, or an interrupted suite
    // would leave agents running (and spending) in the background.
    const signals = process.platform === 'win32' ? [] : ['SIGINT', 'SIGTERM', 'SIGHUP'];
    const forward = (signal) => {
      kill(child);
      for (const name of signals) process.removeListener(name, forward);
      process.kill(process.pid, signal);
    };
    for (const name of signals) process.once(name, forward);

    let exit = { exitCode: null, signal: null };
    let timedOut = false;
    let spawnError;
    let done = false;
    let timer;
    let grace;
    const finish = () => {
      if (done) return;
      done = true;
      for (const name of signals) process.removeListener(name, forward);
      clearTimeout(timer);
      clearTimeout(grace);
      // Whatever the root left running (stdio ignored or redirected, so no pipe kept the run open) must
      // not outlive the run into grading and workspace deletion.
      sweep(child);
      child.stdout.destroy();
      child.stderr.destroy();
      resolve({ ...out, ...exit, timedOut, ...(spawnError && { spawnError }) });
    };
    for (const stream of ['stdout', 'stderr']) {
      child[stream].setEncoding('utf8');
      child[stream].on('data', (chunk) => {
        if (out[stream].length < OUTPUT_LIMIT) out[stream] += chunk;
      });
    }
    child.on('error', (error) => {
      spawnError = error;
      finish();
    });
    child.on('exit', (exitCode, signal) => {
      exit = { exitCode, signal };
      clearTimeout(timer);
      clearTimeout(grace);
      grace = setTimeout(finish, graceMs);
    });
    child.on('close', finish);
    if (input !== undefined) {
      // The agent may exit without reading its prompt; that is its result, not a crash of ours.
      child.stdin.on('error', () => {});
      child.stdin.end(input);
    }
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        kill(child);
        grace = setTimeout(finish, graceMs);
      }, timeoutMs);
    }
  });
}

/** The `{ command, args, env }` to spawn for `config`. `args` and `env` may be plain values or
 * functions of `{ effort, task }`, so one configuration can vary by effort without being rebuilt by
 * hand for every cell of the suite. */
export function resolveAgent(config, context) {
  const pick = (value) => (typeof value === 'function' ? value(context) : value);
  return { command: config.command, args: pick(config.args) ?? [], env: pick(config.env) ?? {} };
}

// The grader is a separate process with its own bound: a hidden test that hangs must cost one trial,
// not the suite.
const GRADER_TIMEOUT_MS = 2 * 60 * 1000;

/** Copies the hidden grader into the workspace and runs it there; resolves to `{ score, passed, total,
 * error }`, or to `{ spawnError }` when the grader command could not be started at all. The copy
 * replaces `.eval-grader/` outright, so nothing the agent left under that name can stand in for the
 * real grader. The score is `pass / tests` of the grader's TAP summary. Output that does not parse, or
 * reports no tests, scores 0 with `grader-unparsable`: a silent 1 or a NaN would both read as a result.
 * A grader that cannot be spawned is not a score either: it is the grader's configuration that is
 * broken, so every trial would score 0 and, once recorded, be skipped on resume for good; the caller
 * stops the suite instead. `node` runs as this process's own `node`, so the grader does not depend on
 * PATH and runs on the same version as the runner.
 *
 * TAP is asked for by the task's own `args` (`--test-reporter=tap`), not added here: the runner then
 * knows nothing about the grader beyond "prints a TAP summary", so a task may use any command. */
export async function gradeWorkspace(task, workspace, { timeoutMs = GRADER_TIMEOUT_MS } = {}) {
  const graderDir = path.join(workspace, '.eval-grader');
  fs.rmSync(graderDir, { recursive: true, force: true });
  fs.cpSync(task.graderDir, graderDir, { recursive: true });
  const { command, args } = task.grader;
  const run = await runProcess({
    command: command === 'node' ? process.execPath : command,
    args,
    env: childEnv(),
    cwd: workspace,
    timeoutMs,
  });
  const fail = (error) => ({ score: 0, passed: null, total: null, error });
  if (run.spawnError) return { spawnError: run.spawnError };
  if (run.timedOut) return fail('grader-timeout');
  const tap = parseTap(run.stdout);
  if (!tap) return fail('grader-unparsable');
  return { score: tap.pass / tap.tests, passed: tap.pass, total: tap.tests, error: null };
}

/** The short error string for an agent run that did not finish cleanly, else `null`. */
function agentError(run, output) {
  if (run.timedOut) return 'timeout';
  if (run.exitCode !== 0) return `agent-exit-${run.exitCode ?? run.signal}`;
  if (!output) return 'agent-output-unparsable';
  return output.is_error === true ? 'agent-error' : null;
}

/** The file stem for a trial's raw agent output. */
const rawStem = ({ task, config, effort, repeat }) => [task, config, effort, repeat].join('__').replace(/[^A-Za-z0-9._-]/g, '_');

const DEFAULT_RUNS_DIR = fileURLToPath(new URL('./runs/', import.meta.url));

/** Runs one trial and resolves to `{ status: 'recorded', record }`, or `{ status: 'stopped', reason,
 * message }` when the agent died of the usage cap or of authentication (`reason` `cap` or `auth`), or
 * the agent (`spawn`) or the hidden grader (`grader-spawn`) never started. A stopped trial records
 * nothing: a zero there would measure the machine, not the configuration.
 *
 * The agent runs in a fresh copy of the fixture under `workRoot`; the hidden grader is copied in only
 * after it exits. The workspace is removed on every path, in a `finally`. An agent that fails for any
 * other reason (timeout, non-zero exit, unreadable output) is still graded and recorded with its
 * error, because its workspace may hold work worth scoring and a failure rate is itself a result. */
export async function runTrial({
  task,
  config,
  effort,
  repeat,
  cliVersion = null,
  workRoot = os.tmpdir(),
  runsDir = DEFAULT_RUNS_DIR,
  graderTimeoutMs,
  now = () => new Date(),
  log = (message) => console.error(message),
}) {
  const startedAt = now().toISOString();
  fs.mkdirSync(workRoot, { recursive: true });
  const workspace = fs.mkdtempSync(path.join(workRoot, 'eval-'));
  try {
    copyFixture(task, workspace);
    const agent = resolveAgent(config, { effort, task });
    const began = Date.now();
    const run = await runProcess({
      ...agent,
      env: childEnv(agent.env),
      cwd: workspace,
      input: task.prompt,
      timeoutMs: task.timeoutMs,
    });
    const wallMs = Date.now() - began;

    const stem = rawStem({ task: task.id, config: config.name, effort, repeat });
    fs.mkdirSync(runsDir, { recursive: true });
    fs.writeFileSync(path.join(runsDir, `${stem}.stdout.log`), run.stdout);
    fs.writeFileSync(path.join(runsDir, `${stem}.stderr.log`), run.stderr);

    // The agent never started (missing binary, a Windows .cmd shim): every trial of this configuration
    // would fail the same way, and a recorded one would score the untouched fixture and, on resume, be
    // skipped for good. Stop like a cap instead.
    if (run.spawnError) return { status: 'stopped', reason: 'spawn', message: run.spawnError.message };
    const stop = classifyAgentFailure(run);
    if (stop) return { status: 'stopped', reason: stop.kind, message: stop.message };

    const output = parseAgentOutput(run.stdout);
    const { error: graderError, spawnError: graderSpawnError, ...scored } = await gradeWorkspace(task, workspace, { timeoutMs: graderTimeoutMs });
    // Same reasoning as the agent's spawn failure above, for the hidden grader: stop, record nothing.
    if (graderSpawnError) return { status: 'stopped', reason: 'grader-spawn', message: graderSpawnError.message };
    return {
      status: 'recorded',
      record: {
        task: task.id,
        config: config.name,
        effort,
        repeat,
        ...scored,
        ...summarizeUsage(output),
        wallMs,
        cliVersion,
        error: agentError(run, output) ?? graderError,
        startedAt,
      },
    };
  } finally {
    try {
      fs.rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch (err) {
      // A record is worth more than a tidy disk, but a leak must not go unnoticed.
      log(`could not remove workspace ${workspace}: ${err.message}`);
    }
  }
}

// Names end up in the trial key and in raw log file names. Only these characters are allowed, and an
// underscore only between two of them, so `__` (the log stem separator) never occurs inside a name and
// two different trials can never share a key or a stem.
const NAME_PATTERN = /^[A-Za-z0-9.-]+(_[A-Za-z0-9.-]+)*$/;

function assertName(kind, value) {
  if (typeof value !== 'string' || !NAME_PATTERN.test(value)) {
    throw new Error(`${kind} ${JSON.stringify(value)} is not usable in a trial key: use letters, digits, ".", "-" and a single "_" between them`);
  }
}

/** Throws when `values` holds the same value twice: two trials would then share a trial key and a log
 * stem, so one would be skipped on resume and the other's raw output overwritten. */
function assertUnique(kind, values) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`duplicate ${kind} ${JSON.stringify(value)}: two trials would share a trial key`);
    seen.add(value);
  }
}

/** Every trial of a suite, in the order they run. Repeats are the outermost loop: a suite cut short
 * by the usage cap then holds one full pass over every task, configuration and effort before a second
 * repeat of any, which keeps a partial A/B comparison balanced instead of complete for one arm only.
 * Repeats count from 1. Throws before any trial when a task id, configuration name or effort is not
 * safe in a trial key, or when one of them appears twice. */
export function planTrials({ tasks, configs, efforts, repeats }) {
  for (const task of tasks) assertName('task id', task.id);
  for (const config of configs) assertName('config name', config.name);
  for (const effort of efforts) assertName('effort', effort);
  assertUnique('task id', tasks.map((task) => task.id));
  assertUnique('config name', configs.map((config) => config.name));
  assertUnique('effort', efforts);
  const plan = [];
  for (let repeat = 1; repeat <= repeats; repeat += 1) {
    for (const task of tasks) {
      for (const config of configs) {
        for (const effort of efforts) plan.push({ task, config, effort, repeat });
      }
    }
  }
  return plan;
}

/** The trial records in a JSON Lines results file. A missing file is an empty history; a blank or
 * corrupt line (a write torn by a crash) is skipped, so that trial simply runs again. */
export function readResults(resultsPath) {
  if (!fs.existsSync(resultsPath)) return [];
  const records = [];
  for (const line of fs.readFileSync(resultsPath, 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    try {
      const record = JSON.parse(line);
      if (isObject(record)) records.push(record);
    } catch {
      // torn line: ignored
    }
  }
  return records;
}

/** Appends `record` as one JSON line. If the file does not end in a newline (a write torn by a crash),
 * a newline goes first, so the fragment stays an isolated invalid line that `readResults` skips, instead
 * of the new record being glued onto it and lost. The fragment is kept, not truncated away: nothing is
 * rewritten, so there is no second way to lose data. */
function appendRecord(resultsPath, record) {
  fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  let prefix = '';
  if (fs.existsSync(resultsPath) && fs.statSync(resultsPath).size > 0) {
    const fd = fs.openSync(resultsPath, 'r');
    try {
      const last = Buffer.alloc(1);
      fs.readSync(fd, last, 0, 1, fs.fstatSync(fd).size - 1);
      if (last[0] !== 0x0a) prefix = '\n';
    } finally {
      fs.closeSync(fd);
    }
  }
  fs.appendFileSync(resultsPath, `${prefix}${JSON.stringify(record)}\n`);
}

/** The first line of `<agent command> --version` (or `config.versionArgs`), else `null`. Recorded per
 * trial because a CLI update changes what a score means. `env` is the trial's own env overrides (what
 * `resolveAgent` yields): the probe must see what the agent will see, or it would run the real CLI
 * against the real home directory a configuration redirects, and name the wrong install when the env
 * selects another one. */
export function probeVersion(config, env = {}) {
  const result = spawnSync(config.command, config.versionArgs ?? ['--version'], {
    encoding: 'utf8',
    env: childEnv(env),
    timeout: 30000,
    windowsHide: true,
  });
  const line = result.error || result.status !== 0 ? '' : result.stdout.trim().split('\n')[0].trim();
  return line || null;
}

/** Runs every trial of the suite that the results file does not already hold, appending each record
 * as soon as it is graded, so an interruption loses at most the trial in flight. Resolves to
 * `{ status: 'complete', completed, skipped }`, or `{ status: 'stopped', reason, message, completed }`
 * at the first usage-cap, authentication, agent-spawn or grader-spawn stop, with nothing recorded for
 * that trial.
 *
 * A trial is skipped when its `(task, config, effort, repeat)` key is in the file; resuming is just
 * running the same call again. `readVersion(config, env)` and `runTrial` are injectable for tests;
 * `env` is the env overrides the trial's agent runs under. */
export async function runSuite({
  tasks,
  configs,
  efforts,
  repeats,
  resultsPath,
  runsDir,
  workRoot,
  graderTimeoutMs,
  readVersion = probeVersion,
  runTrial: run = runTrial,
  log,
}) {
  const done = new Set(readResults(resultsPath).map(trialKey));
  const versions = new Map();
  const versionOf = (config, context) => {
    // One probe per distinct agent command, version arguments and env, and none when every trial is
    // already recorded. The env is the trial's own, so two configs that redirect the same CLI to
    // different installs or homes are probed separately; its keys are sorted so order cannot split a key.
    const { env } = resolveAgent(config, context);
    const sorted = Object.fromEntries(Object.entries(env).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    const key = JSON.stringify([config.command, config.versionArgs ?? null, sorted]);
    if (!versions.has(key)) versions.set(key, readVersion(config, env));
    return versions.get(key);
  };

  let completed = 0;
  let skipped = 0;
  for (const { task, config, effort, repeat } of planTrials({ tasks, configs, efforts, repeats })) {
    if (done.has(trialKey({ task: task.id, config: config.name, effort, repeat }))) {
      skipped += 1;
      continue;
    }
    const outcome = await run({ task, config, effort, repeat, cliVersion: versionOf(config, { effort, task }), workRoot, runsDir, graderTimeoutMs, log });
    if (outcome.status === 'stopped') {
      return { status: 'stopped', reason: outcome.reason, message: outcome.message, completed };
    }
    appendRecord(resultsPath, outcome.record);
    completed += 1;
  }
  return { status: 'complete', completed, skipped };
}

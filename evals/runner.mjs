// The eval runner: one trial is one agent run in a fresh workspace, graded by hidden tests, and
// recorded. Zero deps, plain Node. Side effects (spawning, clock, directories) are injectable so the
// whole path is proven against a fake agent command and no test ever calls a real model.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn as spawnChild, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { killTree } from '../bin/codex-review.mjs';
import { isWithin } from './paths.mjs';

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

/** Kills what a root that has already exited left behind (by `ParentProcessId`; `killByPath` is the sweep for a survivor whose own parent is gone too). POSIX: the group outlives its leader, so the
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

// The PowerShell of `killByPath`. It reads the roots from the environment (newline-separated, a name no path
// can hold) and never has one spliced into its text, so a path with a quote, a `$` or a backtick cannot
// change what it does. Every match is literal: `String.IndexOf` with `OrdinalIgnoreCase`, not `-match`
// (a regex) and not `-like` (wildcards, where `[` is special): a trial directory may well hold `+`, `(`
// or `[`. Each root is searched in both separator spellings, because a tool may print the same path with
// either. A match must end on a boundary: the end of the command line, a path separator, a quote or
// whitespace; otherwise a sibling whose name extends the root (`trial-10` against `trial-1`) would be killed
// with its tree. Every occurrence in a line is tried, since a sibling may come before the root itself. The process the script runs in and every ancestor of it are spared, whatever their command lines
// hold: a runner started with the workspace in its arguments must not sweep itself.
//
// All matches are taken from ONE snapshot of the process list, so killing one match with its tree (`/T`) can
// take another match with it, and `taskkill` then reports that process as not found. That is success, not
// an error: a process that is not there is what was wanted. So `taskkill`'s exit code is never consulted
// (and it runs under `cmd`, where a stderr line is not turned into a PowerShell error); what decides is a
// check, after the kills, that every matched process has exited. The pids of the matches are printed, one
// per line, only then. A failure is one line of plain text on stderr and exit 1; progress output is off,
// because under `-EncodedCommand` it would arrive as CLIXML.
const SWEEP_SCRIPT = String.raw`
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
function Test-Running($id) {
  try { return -not [System.Diagnostics.Process]::GetProcessById([int]$id).HasExited } catch { return $false }
}
$boundary = [char[]]@([char]92, [char]47, [char]34, [char]39)
function Test-Mentions($line, $needle) {
  $from = 0
  while ($from -le $line.Length - $needle.Length) {
    $at = $line.IndexOf($needle, $from, [StringComparison]::OrdinalIgnoreCase)
    if ($at -lt 0) { return $false }
    $end = $at + $needle.Length
    if ($end -ge $line.Length) { return $true }
    $next = $line[$end]
    if ($boundary -contains $next -or [char]::IsWhiteSpace($next)) { return $true }
    $from = $at + 1
  }
  return $false
}
try {
  $roots = @($env:JS_HARNESS_KILL_ROOTS -split '\n' | Where-Object { $_ -ne '' })
  $needles = @()
  foreach ($root in $roots) {
    $root = $root.TrimEnd([char]92, [char]47)
    if ($root -eq '') { continue }
    $needles += $root
    $needles += $root.Replace('\', '/')
    $needles += $root.Replace('/', '\')
  }
  $needles = @($needles | Select-Object -Unique)
  $all = @(Get-CimInstance Win32_Process)
  $spared = @{}
  $id = [uint32]$PID
  while ($id -and -not $spared.ContainsKey($id)) {
    $spared[$id] = $true
    $parent = $all | Where-Object { $_.ProcessId -eq $id } | Select-Object -First 1
    $id = if ($parent) { [uint32]$parent.ParentProcessId } else { [uint32]0 }
  }
  $matched = @()
  foreach ($process in $all) {
    if ($spared.ContainsKey([uint32]$process.ProcessId)) { continue }
    $line = $process.CommandLine
    if (-not $line) { continue }
    foreach ($needle in $needles) {
      if (Test-Mentions $line $needle) {
        $matched += [uint32]$process.ProcessId
        break
      }
    }
  }
  foreach ($id in $matched) {
    if (Test-Running $id) { cmd.exe /c "taskkill /pid $id /T /F >nul 2>&1" | Out-Null }
  }
  $deadline = (Get-Date).AddSeconds(5)
  do {
    $running = @($matched | Where-Object { Test-Running $_ })
    if ($running.Count -eq 0) { break }
    Start-Sleep -Milliseconds 100
  } while ((Get-Date) -lt $deadline)
  if ($running.Count -gt 0) { throw ('still running after the kill: ' + ($running -join ', ')) }
  $matched
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
`;

/** Kills every process whose command line contains any of `roots`, each with its tree, and returns `{ killed }`,
 * the pids it matched. `roots` are absolute trial directories, unique per trial (a home, a workspace), which
 * is what makes a plain substring a safe test.
 *
 * It exists because `killSurvivors` walks DOWN from the agent by parent pid, and a descendant whose parent
 * exited first has a parent pid that belongs to nobody: unreachable that way. An MCP server a seeded home
 * starts (codegraph, `serve --mcp --path <workspace>`) is such a process, and while it runs it holds the
 * directory, so the trial's cleanup fails with EPERM. The process knows its trial by the path in its own
 * command line, so that is what is searched.
 *
 * Because a wrong root would kill unrelated processes, a root must be a non-empty absolute path below the
 * filesystem root, and when `within` is given strictly inside it (the runner passes its work root: only
 * directories it made are ever swept). Windows only, through PowerShell and CIM (see `SWEEP_SCRIPT`). On
 * POSIX it is a no-op, returning `skipped` and its reason: a trial's process group is killed on close, which
 * covers its descendants there, and an unproven `ps` parser that kills by substring is worse than none.
 * `platform` and `spawnSync` are injectable. Throws when the sweep itself could not run or failed. */
export function killByPath(roots, { platform = process.platform, spawnSync: sync = spawnSync, within } = {}) {
  if (!Array.isArray(roots)) throw new Error('killByPath needs an array of roots');
  for (const root of roots) {
    if (typeof root !== 'string' || !path.isAbsolute(root) || path.parse(root).root === root || /[\r\n]/.test(root)) {
      throw new Error(`killByPath root ${JSON.stringify(root)} must be an absolute path below the filesystem root: anything shorter could match processes that are not the trial's`);
    }
    // Equal is decided by `path.relative`, which is case-insensitive on Windows: `C:\Work` and `c:\work` are one
    // directory there, and a `===` on the resolved strings would let the whole work root through.
    if (within !== undefined && (path.relative(path.resolve(within), path.resolve(root)) === '' || !isWithin(path.resolve(within), path.resolve(root)))) {
      throw new Error(`killByPath root ${root} is not inside ${within}: only directories the runner made are ever swept`);
    }
  }
  if (roots.length === 0) return { killed: [] };
  if (platform !== 'win32') return { killed: [], skipped: 'POSIX: a trial\'s process group is killed on close, and the sweep by path is only implemented for Windows' };
  const encoded = Buffer.from(SWEEP_SCRIPT, 'utf16le').toString('base64');
  const result = sync('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
    env: { ...process.env, JS_HARNESS_KILL_ROOTS: roots.join('\n') },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
  });
  if (result.error) throw new Error(`the sweep by path could not run: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`the sweep by path failed (exit ${result.status}): ${String(result.stderr).trim()}`);
  return { killed: String(result.stdout).split(/\r?\n/).map((line) => line.trim()).filter((line) => /^\d+$/.test(line)).map(Number) };
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
 * functions of `{ effort, task, home, workspace, prepared }`, so one configuration can vary by effort, and
 * point every writer at the trial's own home, without being rebuilt by hand for every cell of the suite.
 * `home` and `prepared` (what `prepare` returned: a trial's port, say) are `undefined` for a config without
 * `prepare`. */
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

/** Removes a directory the trial made. A leak is logged, never thrown: the record is worth more than a
 * tidy disk, but a leak must not go unnoticed. When the removal fails, `sweepAgain()` runs (a process that
 * holds the directory may only have started since the first sweep, or have been slow to die) and the
 * removal is tried once more. */
export function removeDir(dir, label, log, sweepAgain) {
  const remove = () => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  try {
    remove();
  } catch {
    sweepAgain?.();
    // Windows lets go of a directory a moment after the process that held it is gone (measured: an EPERM
    // within a millisecond of the kill, success 200 ms later), so the retry is spread over about a second.
    let failure;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        remove();
        failure = undefined;
        break;
      } catch (err) {
        failure = err;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
      }
    }
    if (failure) log(`could not remove ${label} ${dir}: ${failure.message}`);
  }
}

/** Runs one trial and resolves to `{ status: 'recorded', record }`, or `{ status: 'stopped', reason,
 * message }` when the agent died of the usage cap or of authentication (`reason` `cap` or `auth`), or
 * the agent (`spawn`) or the hidden grader (`grader-spawn`) never started. A stopped trial records
 * nothing: a zero there would measure the machine, not the configuration.
 *
 * The agent runs in a fresh copy of the fixture under `workRoot`; the hidden grader is copied in only
 * after it exits. A config that defines `prepare` also gets a home directory of its own, a sibling of
 * the workspace and fresh for every trial, because anything an earlier trial left in a shared one (a
 * transcript, a memory) would leak its answer into the next. `prepare({ home, workspace, effort, task })`
 * runs after the fixture copy; one that throws rejects the trial. What it returns is the trial's `prepared`
 * state, handed to `args` and `env` and to the config's optional `cleanup({ home, workspace, prepared })`,
 * which runs on every path once `prepare` has finished (after the sweep by path, before the directories go)
 * for whatever the sweep cannot reach: a server the agent started on a port of the trial's own. A cleanup
 * that throws is logged, never thrown. Both directories are removed on every path, in a `finally`. An agent that fails for any other reason (timeout, non-zero exit, unreadable
 * output) is still graded and recorded with its error, because its workspace may hold work worth
 * scoring and a failure rate is itself a result.
 *
 * `readVersion(config, env)` is asked for the CLI version under the env overrides the agent will run
 * with: they now depend on the home, so the probe cannot run before the trial exists. It runs after
 * `prepare` and before the agent, outside `wallMs`.
 *
 * Two injectable clocks, because they answer different questions: `now()` is the wall-clock timestamp of
 * `startedAt`, and `clock()` is a monotonic stopwatch (milliseconds, default `performance.now()`) for
 * `wallMs`. A test that pins `now` to make a timestamp deterministic would otherwise also pin the
 * duration to 0, and a system clock step during an agent run would corrupt it. */
export async function runTrial({
  task,
  config,
  effort,
  repeat,
  readVersion = probeVersion,
  workRoot = os.tmpdir(),
  runsDir = DEFAULT_RUNS_DIR,
  graderTimeoutMs,
  now = () => new Date(),
  clock = () => performance.now(),
  sweep = killByPath,
  log = (message) => console.error(message),
}) {
  const startedAt = now().toISOString();
  // Absolute, whatever the caller passed: the agent runs with the workspace as its cwd, so a relative home
  // would mean one place to `prepare` (the runner's cwd) and another to the agent (inside the graded tree).
  const root = path.resolve(workRoot);
  fs.mkdirSync(root, { recursive: true });
  const workspace = fs.mkdtempSync(path.join(root, 'eval-'));
  let home;
  let prepared;
  let isPrepared = false;
  try {
    copyFixture(task, workspace);
    if (config.prepare) {
      home = fs.mkdtempSync(path.join(root, 'eval-home-'));
      prepared = await config.prepare({ home, workspace, effort, task });
      isPrepared = true;
    }
    const agent = resolveAgent(config, { effort, task, home, workspace, prepared });
    const cliVersion = await readVersion(config, agent.env);
    const began = clock();
    const run = await runProcess({
      ...agent,
      env: childEnv(agent.env),
      cwd: workspace,
      input: task.prompt,
      timeoutMs: task.timeoutMs,
    });
    const wallMs = Math.round(clock() - began);

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
    // Before anything is removed: a process the agent left behind, whose parent is gone, holds these
    // directories (the codegraph MCP server of a seeded home does) and `killSurvivors` cannot reach it. Only
    // the directories this call made are swept, confined to the work root. A failed sweep is logged, and the
    // removal is still tried.
    const sweepTrial = () => {
      try {
        sweep([workspace, ...(home ? [home] : [])], { within: root });
      } catch (err) {
        log(`could not sweep the processes of the trial directories: ${err.message}`);
      }
    };
    sweepTrial();
    if (isPrepared && config.cleanup) {
      try {
        await config.cleanup({ home, workspace, prepared });
      } catch (err) {
        log(`the cleanup of config ${config.name} failed: ${err.message}`);
      }
    }
    removeDir(workspace, 'workspace', log, sweepTrial);
    if (home) removeDir(home, 'home', log, sweepTrial);
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
 * `env` is the env overrides the trial's agent runs under. Each trial is handed a cached `readVersion`
 * and calls it itself once its env is known (see `runTrial`); this function only owns the cache. */
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
  const cachedVersion = (config, env) => {
    // One probe per distinct agent command, version arguments and env, and none when every trial is
    // already recorded (a trial asks only once it runs). The env is the trial's own, so two configs that
    // redirect the same CLI to different installs or homes are probed separately; its keys are sorted
    // so order cannot split a key. A removal (`null` or `undefined`, which `childEnv` treats alike) is
    // written as `null`, because JSON drops an `undefined` property and `{}` would then share a key with
    // `{ HOME: undefined }`, which runs under a different env. A config with a per-trial home never
    // repeats an env, so it is probed once per trial, which is intended: each probe runs under the home
    // the agent will get.
    const normalized = Object.entries(env).map(([name, value]) => [name, value == null ? null : String(value)]);
    const sorted = Object.fromEntries(normalized.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
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
    const outcome = await run({ task, config, effort, repeat, readVersion: cachedVersion, workRoot, runsDir, graderTimeoutMs, log });
    if (outcome.status === 'stopped') {
      return { status: 'stopped', reason: outcome.reason, message: outcome.message, completed };
    }
    appendRecord(resultsPath, outcome.record);
    completed += 1;
  }
  return { status: 'complete', completed, skipped };
}

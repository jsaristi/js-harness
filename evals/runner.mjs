// The eval runner: one trial is one agent run in a fresh workspace, graded by hidden tests, and
// recorded. Zero deps, plain Node. Side effects (spawning, clock, directories) are injectable so the
// whole path is proven against a fake agent command and no test ever calls a real model.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn as spawnChild, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  POWERSHELL_ROW_FUNCTION, killProcesses, killSurvivors, killTree, parseSnapshot, selectTrees, settleGroup,
} from '../bin/lib/process-tree.mjs';
import { isWithin } from './paths.mjs';
import { readClaudeOutput } from './agent-output.mjs';

// What an agent printed is read by the reader its config carries (see `readerOf`); this file knows no CLI's
// output format, only which reader a config without one gets. These three are Claude Code's, kept under the
// names they had while they lived here, for the callers that import them from the runner.
export { classifyAgentFailure, parseAgentOutput, summarizeUsage } from './agent-output.mjs';

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

/** The names of the top-level tests a TAP output reports as failed, in order: its unindented `not ok <n> - <name>`
 * lines, a directive after ` # ` left off. A nested assertion is indented and is not a test of its own here. */
export function failedTestsOf(text) {
  return [...String(text).replace(/\r/g, '').matchAll(/^not ok \d+ - (.*?)(?:\s+#\s.*)?$/gm)].map((match) => match[1]);
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
  // `recordFailed`: the trial keeps the names of the grader's failed tests (`failedTestsOf`), for a report that reads
  // which questions failed and not only how many. Absent on every task that does not ask, so their records keep their
  // shape.
  if (spec.recordFailed !== undefined && typeof spec.recordFailed !== 'boolean') throw bad('recordFailed', 'must be true or false');
  return {
    id, prompt, grader: { command: spec.grader.command, args }, timeoutMs: spec.timeoutMs, fixtureDir, graderDir,
    ...(spec.recordFailed === true && { recordFailed: true }),
  };
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

// The PowerShell of `killByPath`: it finds the matches and kills nothing. It reads the roots from the environment
// (newline-separated, a name no path can hold) and never has one spliced into its text, so a path with a quote,
// a `$` or a backtick cannot change what it does. Every match is literal: `String.IndexOf` with
// `OrdinalIgnoreCase`, not `-match` (a regex) and not `-like` (wildcards, where `[` is special): a trial
// directory may well hold `+`, `(` or `[`. Each root is searched in both separator spellings, because a tool
// may print the same path with either. A match must end on a delimiter: the end of the command line, a path
// separator (`\` or `/`), a quote (`"` or `'`), whitespace, or one of the `;`, `,`, `=` and `)` of a list or
// key/value argument. Anything else continues the name and does not match: on Windows `+`, `(`, `[`, `{`, `@`,
// `~`, `!`, `#`, `%` and `&` all can, so `trial-1+backup` is not `trial-1`, any more than `trial-10` is. A wrong
// kill (an unrelated process and its tree) is worse than a missed survivor, which the removal of the directory
// reports, so the set is closed and short; the last four are the ones an earlier review asked for. Every
// occurrence in a line is tried, since a sibling may come before the root itself. The process the script runs in
// and every ancestor of it are spared, whatever their command lines hold: a runner started with the workspace in
// its arguments must not sweep itself.
//
// What it prints comes from ONE snapshot of the process list: a row per process (see `Format-ProcessRow` in
// `bin/lib/process-tree.mjs`: pid, parent pid, creation time, name), then `S<TAB>pid` for each spared process
// and `M<TAB>pid` for each match. `killByPath` then selects each match's tree from those rows by pid AND
// creation time (a parent pid alone names the wrong process once Windows reuses it) and kills it. A failure
// is one line of plain text on stderr and exit 1; progress output is off, because under `-EncodedCommand` it
// would arrive as CLIXML.
const SWEEP_SCRIPT = String.raw`
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
${POWERSHELL_ROW_FUNCTION}
$delimiters = [char[]]@([char]92, [char]47, [char]34, [char]39, [char]59, [char]44, [char]61, [char]41)
function Test-Mentions($line, $needle) {
  $from = 0
  while ($from -le $line.Length - $needle.Length) {
    $at = $line.IndexOf($needle, $from, [StringComparison]::OrdinalIgnoreCase)
    if ($at -lt 0) { return $false }
    $end = $at + $needle.Length
    if ($end -ge $line.Length) { return $true }
    $next = $line[$end]
    if ([char]::IsWhiteSpace($next) -or $delimiters -contains $next) { return $true }
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
  foreach ($process in $all) { Format-ProcessRow $process }
  foreach ($id in $spared.Keys) { 'S' + [char]9 + $id }
  foreach ($process in $all) {
    if ($spared.ContainsKey([uint32]$process.ProcessId)) { continue }
    $line = $process.CommandLine
    if (-not $line) { continue }
    foreach ($needle in $needles) {
      if (Test-Mentions $line $needle) {
        'M' + [char]9 + $process.ProcessId
        break
      }
    }
  }
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
`;

/** Kills every process whose command line contains any of `roots`, each with its tree, and returns `{ killed }`,
 * the pids it matched. `roots` are absolute trial directories, unique per trial (a home, a workspace), which
 * is what makes a plain substring a safe test. The tree of a match is what `bin/lib/process-tree.mjs` proves
 * descends from it (by pid and creation time), each process killed on its own: never `taskkill /T`, which walks
 * parent pids that Windows reuses. Throws when a match is still running after the kill, or could not be killed
 * because its creation time is unknown.
 *
 * It exists because `killSurvivors` walks DOWN from the agent through its descendants, and a descendant whose
 * parent exited first is not one of them: unreachable that way. An MCP server a seeded home
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
  const stdout = String(result.stdout);
  const marked = (mark) => [...stdout.matchAll(new RegExp(String.raw`^${mark}\t(\d+)\s*$`, 'gm'))].map((match) => Number(match[1]));
  const matched = marked('M');
  if (matched.length === 0) return { killed: [] };
  // The rows are the one snapshot the matches were taken from; an empty one is a failed lookup, not an empty machine.
  const snapshot = parseSnapshot(stdout);
  if (snapshot.length === 0) throw new Error('the sweep by path matched processes but listed none: it cannot select what to kill');
  const createdAt = new Map(snapshot.map((entry) => [entry.pid, entry.createdAt]));
  const targets = selectTrees(snapshot, matched, { spared: marked('S') }).map((pid) => ({ pid, createdAt: createdAt.get(pid) }));
  const { running } = killProcesses(targets, { spawnSync: sync });
  // A match whose creation time Windows did not give is never killed (no evidence, no kill), and that is said.
  const selected = new Set(targets.map((target) => target.pid));
  const unproven = matched.filter((pid) => !selected.has(pid));
  if (running.length > 0) throw new Error(`still running after the kill: ${running.join(', ')}`);
  if (unproven.length > 0) throw new Error(`matched but not killed, because their creation time is unknown: ${unproven.join(', ')}`);
  return { killed: matched };
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
 * what the root left behind, holding the pipes or not.
 *
 * `signal`, an `AbortSignal`, is for a caller that owns the interrupt: when it aborts the tree is killed as for a
 * timeout and the run ends with `aborted: true` (a signal that is already aborted starts nothing). Such a caller
 * gets no signal forwarding below, because that kills the tree and then re-raises the signal on this process, which
 * ends it before the caller's own cleanup; the caller aborts, waits for the result and cleans up, then exits. */
export function runProcess({
  command, args = [], env, cwd, input, timeoutMs, graceMs = PIPE_GRACE_MS, spawn = spawnChild, kill = killTree, killSurvivors: sweep = killSurvivors, signal, settle,
}) {
  // What the sweep killed is waited for before the run ends (`settleGroup`). A caller that swaps the sweep killed
  // no real group, so by default it has nothing to wait for.
  const settling = settle ?? (sweep === killSurvivors ? settleGroup : async () => []);
  return new Promise((resolve) => {
    const out = { stdout: '', stderr: '' };
    if (signal?.aborted) {
      resolve({ ...out, exitCode: null, signal: null, timedOut: false, aborted: true });
      return;
    }
    let child;
    const startedAt = Date.now(); // before the spawn: the child cannot have been created earlier
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
    const signals = process.platform === 'win32' || signal ? [] : ['SIGINT', 'SIGTERM', 'SIGHUP'];
    let exitedAt;
    let sweepError;
    // What is killed is proven by `bin/lib/process-tree.mjs` from when the child started and exited. A kill that
    // could not be done is reported on the result, never thrown out of a timer or an event handler.
    const stop = (action) => {
      try {
        action(child, { startedAt, ...(exitedAt !== undefined && { exitedAt }) });
      } catch (error) {
        sweepError ??= error;
      }
    };
    const forward = (signal) => {
      stop(kill);
      for (const name of signals) process.removeListener(name, forward);
      process.kill(process.pid, signal);
    };
    for (const name of signals) process.once(name, forward);

    let exit = { exitCode: null, signal: null };
    let timedOut = false;
    let aborted = false;
    let spawnError;
    let done = false;
    let timer;
    let grace;
    const abort = () => {
      aborted = true;
      clearTimeout(timer);
      stop(kill);
      clearTimeout(grace);
      grace = setTimeout(finish, graceMs);
    };
    const finish = () => {
      if (done) return;
      done = true;
      for (const name of signals) process.removeListener(name, forward);
      signal?.removeEventListener('abort', abort);
      clearTimeout(timer);
      clearTimeout(grace);
      // Whatever the root left running (stdio ignored or redirected, so no pipe kept the run open) must
      // not outlive the run into grading and workspace deletion.
      stop(sweep);
      child.stdout.destroy();
      child.stderr.destroy();
      // A group sent SIGKILL can still run for a moment under load; the run ends once it is gone, or says what was
      // still running at the bound, as a Windows kill does (`killProcesses`).
      Promise.resolve()
        .then(() => settling(child))
        .then((left) => {
          if (left.length > 0) sweepError ??= new Error(`still running after the kill: pid ${left.join(', ')}`);
        }, (error) => {
          sweepError ??= error;
        })
        .then(() => resolve({ ...out, ...exit, timedOut, ...(aborted && { aborted }), ...(spawnError && { spawnError }), ...(sweepError && { sweepError: sweepError.message }) }));
    };
    signal?.addEventListener('abort', abort, { once: true });
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
      exitedAt = Date.now();
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
        stop(kill);
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
 * error }`, to `{ spawnError }` when the grader command could not be started at all, or to `{ aborted: true }` when
 * `signal` aborted while it ran (the grader's tree is killed, and nothing is scored). The copy
 * replaces `.eval-grader/` outright, so nothing the agent left under that name can stand in for the
 * real grader. The score is `pass / tests` of the grader's TAP summary. Output that does not parse, or
 * reports no tests, scores 0 with `grader-unparsable`: a silent 1 or a NaN would both read as a result.
 * A grader that cannot be spawned is not a score either: it is the grader's configuration that is
 * broken, so every trial would score 0 and, once recorded, be skipped on resume for good; the caller
 * stops the suite instead. `node` runs as this process's own `node`, so the grader does not depend on
 * PATH and runs on the same version as the runner.
 *
 * TAP is asked for by the task's own `args` (`--test-reporter=tap`), not added here: the runner then
 * knows nothing about the grader beyond "prints a TAP summary", so a task may use any command.
 *
 * The run is a parameter (`runProcess`, by default the real one) so that a caller can hand in another; nothing
 * that ships does, and the tests of what a grader leaves behind hand in one that records it. */
export async function gradeWorkspace(task, workspace, {
  timeoutMs = GRADER_TIMEOUT_MS, signal, runProcess: start = runProcess,
} = {}) {
  const graderDir = path.join(workspace, '.eval-grader');
  fs.rmSync(graderDir, { recursive: true, force: true });
  fs.cpSync(task.graderDir, graderDir, { recursive: true });
  const { command, args } = task.grader;
  const run = await start({
    command: command === 'node' ? process.execPath : command,
    args,
    env: childEnv(),
    cwd: workspace,
    timeoutMs,
    signal,
  });
  const fail = (error) => ({ score: 0, passed: null, total: null, error });
  if (run.aborted) return { aborted: true };
  if (run.spawnError) return { spawnError: run.spawnError };
  if (run.timedOut) return fail('grader-timeout');
  const tap = parseTap(run.stdout);
  if (!tap) return fail('grader-unparsable');
  return {
    score: tap.pass / tap.tests, passed: tap.pass, total: tap.tests, error: null,
    ...(task.recordFailed && { failed: failedTestsOf(run.stdout) }),
  };
}

/** The reader of `config`'s agent output: `config.reader`, a function of the finished run that says what it
 * printed means (`agent-output.mjs` documents the reading). A config that carries none is read as Claude
 * Code's `--print --output-format json`, which is what every config was before a second CLI was measured,
 * so those configs and their recorded numbers stand as they are. A `reader` that is not a function throws:
 * falling back to the default would read one CLI's output with another's rules, and every trial would be
 * recorded as unparsable. */
function readerOf(config) {
  const reader = config.reader ?? readClaudeOutput;
  if (typeof reader !== 'function') throw new Error(`config ${config.name}: "reader" must be a function of the agent run, got ${JSON.stringify(reader)}`);
  return reader;
}

/** What a config that keeps its agent's session transcripts carries as `transcripts`, or `null` for a config that
 * keeps none, which is every config that does not ask. The transcripts are in the trial home, which is removed when
 * the trial ends, and they hold what the agent's printed result does not (which request a subagent made, on which
 * model); so a config whose measurement needs them says how to keep them and what to record of them:
 *
 *   keep({ home, workspace, prepared, dest })   copies the session's files into `dest`, a directory of the trial's raw
 *                                               logs, and returns `{ files, errors }`: how many it copied, and a line
 *                                               for each it could not.
 *   summarize({ dir, usage })                   what the record holds of the kept copy in `dir`, as its `listCost`:
 *                                               raw logs are not committed, so a report reads the record alone.
 *                                               `usage` is the reading's. `dir` is `null` when no directory holds
 *                                               this trial's own copy (`keepTranscripts`): there is nothing to read.
 *
 * Both may be asynchronous. The runner knows neither where a CLI keeps its transcripts nor what they mean: that is
 * the config's, as the reading of the output is its reader's. A `transcripts` of another shape throws, before
 * anything is made: found after the agent ran, it would have cost a session whose transcripts are gone. */
function transcriptsOf(config) {
  const keeper = config.transcripts ?? null;
  if (keeper !== null && (!isObject(keeper) || typeof keeper.keep !== 'function' || typeof keeper.summarize !== 'function')) {
    throw new Error(`config ${config.name}: "transcripts" must be an object with a keep and a summarize function, got ${JSON.stringify(keeper)}`);
  }
  return keeper;
}

/** Has `keeper` copy the trial's transcripts into `context.dest` and returns `{ kept, dir }`: `kept`, the
 * `{ files, errors }` of the record, and `dir`, the directory a summary may read as this trial's, `context.dest` or
 * `null`. It never throws: whatever went wrong is logged and is a line of `errors`, because a trial that was paid for
 * is worth more than its transcripts. A failure of the file system is recorded by its code alone (the message holds a
 * path of this machine, and the record is committed); the log has it whole.
 *
 * What an earlier attempt at the same trial kept is removed first, as its raw output is overwritten: a trial that
 * stopped and is run again is another session, and two sessions in one directory would be summed as one. When it
 * cannot be removed (Windows answers EBUSY or EPERM while something holds a file there, and the removal is retried
 * for a second or so first) the directory is still the earlier session's, whole or in part. So nothing is copied
 * into it and `dir` is `null`: the summary then has no transcript to read and says what it can without one, where
 * reading that directory would record another session's cost as this trial's. The transcripts of this attempt are
 * lost with its home, which is the price of never recording a cost that is not the trial's own. */
async function keepTranscripts(keeper, context, { trial, log }) {
  const kept = { files: 0, errors: [] };
  const failed = (detail, recorded = detail) => {
    log(`could not keep the transcripts of ${trial}: ${detail}`);
    kept.errors.push(recorded);
  };
  try {
    fs.rmSync(context.dest, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch (err) {
    failed(`what an earlier attempt kept could not be removed (${err.message})`, `earlier attempt not removed: ${err.code ?? err.message}`);
    return { kept, dir: null };
  }
  try {
    const result = await keeper.keep(context);
    if (!isObject(result) || !Number.isInteger(result.files) || !Array.isArray(result.errors)) throw new Error('its keep returned no { files, errors }');
    kept.files = result.files;
    for (const error of result.errors) failed(String(error));
  } catch (err) {
    failed(err.message, err.code ?? err.message);
  }
  return { kept, dir: context.dest };
}

/** The counts every reading's `usage` carries (`agent-output.mjs`), and whether each is a number: the other two
 * are the agent's own objects, kept as given. */
const USAGE_KEYS = { inputTokens: true, outputTokens: true, turns: true, usage: false, costUsd: true, modelUsage: false, subagents: true };
/** The fields of a record that do not come from the usage: the trial's identity, what the grader scored, what the
 * runner measured, and the two a config that keeps its transcripts adds (`transcriptsOf`). */
const RECORD_FIELDS = ['task', 'config', 'effort', 'repeat', 'score', 'passed', 'total', 'wallMs', 'cliVersion', 'error', 'startedAt', 'transcripts', 'listCost'];

/** What `assertReading` throws. A class of its own because a suite treats it apart from every other error
 * (`runSuite`): it is the one failure known to come after a paid session and to be the reader's own. */
export class ReadingError extends Error {}

/** Throws a `ReadingError` unless `reading`, what the reader of config `configName` returned, has the shape `agent-output.mjs`
 * documents; returns it. The message names the first key that is missing or mistyped. Why it is checked: a
 * reading is used as it comes, so a reader that forgot `parsed` would have every trial recorded as
 * unparsable, and one that returned no `stop` would never stop a suite on the cap, both without a word.
 *
 * No key of `usage` may be a field the runner fills itself, because `usage` is spread into the record: a
 * count named `score` would replace what the grader scored, and one named `error` would be replaced. That is
 * an error and not a silent win for the graded field, so that the record keeps the order and the fields it
 * has always had and a reader that collides is fixed where it is written. */
export function assertReading(reading, configName) {
  const show = (value) => (value === undefined || Number.isNaN(value) ? String(value) : JSON.stringify(value));
  if (!isObject(reading)) throw new ReadingError(`config ${configName}: its reader returned no reading: an object is expected, got ${show(reading)}`);
  const refuse = (problem) => {
    throw new ReadingError(`config ${configName}: its reader returned a reading of the wrong shape: ${problem}`);
  };
  const { stop, usage } = reading;
  if (stop !== null) {
    if (!isObject(stop)) refuse(`"stop" must be null or an object with a kind and a message, got ${show(stop)}`);
    if (typeof stop.kind !== 'string' || stop.kind === '') refuse(`"stop.kind" must be a non-empty string, got ${show(stop.kind)}`);
    if (typeof stop.message !== 'string') refuse(`"stop.message" must be a string, got ${show(stop.message)}`);
  }
  for (const name of ['parsed', 'failed']) if (typeof reading[name] !== 'boolean') refuse(`"${name}" must be true or false, got ${show(reading[name])}`);
  if (!isObject(usage)) refuse(`"usage" must be an object, got ${show(usage)}`);
  for (const [name, isCount] of Object.entries(USAGE_KEYS)) {
    if (usage[name] === undefined) refuse(`"usage.${name}" is missing`);
    if (isCount && usage[name] !== null && !Number.isFinite(usage[name])) refuse(`"usage.${name}" must be a number or null, got ${show(usage[name])}`);
  }
  for (const name of RECORD_FIELDS) if (name in usage) refuse(`"usage.${name}" is a field of the record the runner fills itself, and a usage count must not replace it`);
  return reading;
}

/** The short error string for an agent run that did not finish cleanly, else `null`. What the process did
 * (the timeout, its exit code) comes before what its reader made of the output (`reading`). */
function agentError(run, reading) {
  if (run.timedOut) return 'timeout';
  if (run.exitCode !== 0) return `agent-exit-${run.exitCode ?? run.signal}`;
  if (!reading.parsed) return 'agent-output-unparsable';
  return reading.failed ? 'agent-error' : null;
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
 * nothing: a zero there would measure the machine, not the configuration. `{ status: 'interrupted' }` is what a
 * trial returns when `signal`, an `AbortSignal` the caller raises on an interrupt, aborted before it ended: the
 * agent's tree (or the grader's) is killed, nothing is recorded (the raw logs of an agent that had already ended
 * when the grader was interrupted stay, as evidence), and every cleanup below has run by the
 * time it resolves, so the caller may remove what it owns and end the process.
 *
 * What the agent printed is read once, by the config's reader (`readerOf`): whether the run was such a stop,
 * the usage counts of the record, and whether the agent's own output is an error. A reading of the wrong
 * shape rejects the trial with a `ReadingError` (`assertReading`), after the raw output was kept; a suite
 * turns that rejection into a stop of its own (`runSuite`).
 *
 * A config that carries `transcripts` (`transcriptsOf`) has its agent's session transcripts copied into the raw
 * logs, as `<stem>.transcripts/`, once the agent has exited and before its home is removed. They are kept beside the
 * raw output and for the same reason, so a trial that then stops or whose reading is refused keeps them too. A
 * recorded trial of such a config holds two fields more, after the ones every record has: `transcripts`, the
 * `{ files, errors }` of the copy, and `listCost`, what the config's `summarize` made of it, or `null` when that
 * threw. Neither can fail or lose the trial. A config without `transcripts` keeps nothing and its record has neither
 * field.
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
 * `runProcess(options)` (by default the real one) runs the agent and then the grading of its trial: a caller can
 * hand in another, to record what those runs leave behind, and nothing that ships does.
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
  runProcess: start = runProcess,
  signal,
  log = (message) => console.error(message),
}) {
  // Nothing is made for a suite that is already being interrupted.
  if (signal?.aborted) return { status: 'interrupted' };
  // Before anything is made or spent: a config that cannot be read would cost a whole agent run to find out.
  const read = readerOf(config);
  const keeper = transcriptsOf(config);
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
    // An interrupt that came during `prepare` or the probe: those cannot be stopped half way, so the agent is
    // simply not started, and the `finally` below removes what was made.
    if (signal?.aborted) return { status: 'interrupted' };
    const agent = resolveAgent(config, { effort, task, home, workspace, prepared });
    const cliVersion = await readVersion(config, agent.env);
    if (signal?.aborted) return { status: 'interrupted' };
    const began = clock();
    const run = await start({
      ...agent,
      env: childEnv(agent.env),
      cwd: workspace,
      input: task.prompt,
      timeoutMs: task.timeoutMs,
      signal,
    });
    const wallMs = Math.round(clock() - began);
    if (run.sweepError) log(`could not stop what the agent left running: ${run.sweepError}`);
    // Interrupted: not a result, so no log and no record. The `finally` still sweeps and removes everything.
    if (run.aborted || signal?.aborted) return { status: 'interrupted' };

    const stem = rawStem({ task: task.id, config: config.name, effort, repeat });
    fs.mkdirSync(runsDir, { recursive: true });
    fs.writeFileSync(path.join(runsDir, `${stem}.stdout.log`), run.stdout);
    fs.writeFileSync(path.join(runsDir, `${stem}.stderr.log`), run.stderr);

    // The agent never started (missing binary, a Windows .cmd shim): every trial of this configuration
    // would fail the same way, and a recorded one would score the untouched fixture and, on resume, be
    // skipped for good. Stop like a cap instead.
    if (run.spawnError) return { status: 'stopped', reason: 'spawn', message: run.spawnError.message };
    // Before the reading, like the raw output above: whatever becomes of the trial, the home is gone when it returns.
    const trial = `${task.id}, ${config.name}, ${effort}, repeat ${repeat}`;
    const { kept, dir: transcriptsDir } = keeper
      ? await keepTranscripts(keeper, { home, workspace, prepared, dest: path.join(runsDir, `${stem}.transcripts`) }, { trial, log })
      : { kept: null, dir: null };
    // Checked before it is used, and after the raw output was written: a reading of the wrong shape rejects the
    // trial, and what the agent printed is still there to be read again once the reader is fixed.
    const reading = assertReading(read(run), config.name);
    if (reading.stop) return { status: 'stopped', reason: reading.stop.kind, message: reading.stop.message };

    const { error: graderError, spawnError: graderSpawnError, aborted: graderAborted, ...scored } = await gradeWorkspace(task, workspace, { timeoutMs: graderTimeoutMs, signal, runProcess: start });
    if (graderAborted) return { status: 'interrupted' };
    // Same reasoning as the agent's spawn failure above, for the hidden grader: stop, record nothing.
    if (graderSpawnError) return { status: 'stopped', reason: 'grader-spawn', message: graderSpawnError.message };
    let listCost = null;
    if (keeper) {
      try {
        listCost = await keeper.summarize({ dir: transcriptsDir, usage: reading.usage });
      } catch (err) {
        log(`could not summarize the transcripts of ${trial}: ${err.message}`);
        kept.errors.push(`summary: ${err.code ?? err.message}`);
      }
    }
    return {
      status: 'recorded',
      record: {
        task: task.id,
        config: config.name,
        effort,
        repeat,
        ...scored,
        ...reading.usage,
        wallMs,
        cliVersion,
        error: agentError(run, reading) ?? graderError,
        startedAt,
        ...(keeper && { transcripts: kept, listCost }),
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

/** The JSON Lines file at `resultsPath` as a store: what a suite reads to know what is recorded, and appends
 * to as each trial is graded. */
const fileStore = (resultsPath) => ({ read: () => readResults(resultsPath), append: (record) => appendRecord(resultsPath, record) });

/** Runs every trial of the suite that the results file does not already hold, appending each record
 * as soon as it is graded, so an interruption loses at most the trial in flight. Resolves to
 * `{ status: 'complete', completed, skipped }`, or `{ status: 'stopped', reason, message, completed }`
 * at the first usage-cap, authentication, agent-spawn or grader-spawn stop, with nothing recorded for
 * that trial. A trial whose reading is refused (`ReadingError`) is such a stop too, with `reason` `reader`:
 * until the output of a session that was paid for can be read it is a defect of the reader, not a
 * measurement, so no record is written (one would be skipped on resume for good), the raw output stays where
 * `runTrial` wrote it, and running the same call again, once the reader is fixed, repeats exactly that trial.
 * Anything else a trial throws still rejects the suite. `signal` (an `AbortSignal`) is the interrupt: it is handed to every trial, and once it aborts no
 * trial starts and the suite resolves to `{ status: 'interrupted', completed }`, after the running trial has
 * stopped and cleaned up; that trial records nothing.
 *
 * A trial is skipped when its `(task, config, effort, repeat)` key is in the file; resuming is just
 * running the same call again. Where the records live is the `store`, `{ read() -> records, append(record) }`:
 * by default the JSON Lines file at `resultsPath`, and a caller that keeps its results in another shape (a
 * suite entry that also records what the run was) passes its own. `readVersion(config, env)` and `runTrial` are injectable for tests;
 * `env` is the env overrides the trial's agent runs under. Each trial is handed a cached `readVersion`
 * and calls it itself once its env is known (see `runTrial`); this function only owns the cache. */
export async function runSuite({
  tasks,
  configs,
  efforts,
  repeats,
  resultsPath,
  store = fileStore(resultsPath),
  runsDir,
  workRoot,
  graderTimeoutMs,
  readVersion = probeVersion,
  runTrial: run = runTrial,
  signal,
  log,
}) {
  const done = new Set(store.read().map(trialKey));
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
    if (signal?.aborted) return { status: 'interrupted', completed };
    let outcome;
    try {
      outcome = await run({ task, config, effort, repeat, readVersion: cachedVersion, workRoot, runsDir, graderTimeoutMs, signal, log });
    } catch (err) {
      if (!(err instanceof ReadingError)) throw err;
      // The message names the trial, because nothing else will: its record is the one thing that is not written.
      const message = `${err.message} (trial ${task.id}, ${config.name}, ${effort}, repeat ${repeat}: nothing is recorded for it, and what the agent printed is kept with the raw logs)`;
      return { status: 'stopped', reason: 'reader', message, completed };
    }
    if (outcome.status === 'interrupted') return { status: 'interrupted', completed };
    if (outcome.status === 'stopped') {
      return { status: 'stopped', reason: outcome.reason, message: outcome.message, completed };
    }
    store.append(outcome.record);
    completed += 1;
  }
  return { status: 'complete', completed, skipped };
}

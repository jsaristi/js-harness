#!/usr/bin/env node
// The one gate a pre-commit hook and CI both run. Zero deps, plain Node.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn as spawnChild, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { estimateTokens, measurePayload } from './lib/payload.mjs';
import { discoverContracts, validateEntries } from './contract.mjs';
import { numstatFiles, reviewParts } from './lib/codex-review-parts.mjs';
import { MAX_PARTS_WITHOUT_FLAG, partsBound } from './lib/codex-review-plan.mjs';
import { gitOut, MARKS_UNREAD, NOT_A_REVIEW, notReviews, rangeStart, reviewCoverage, reviewStart } from './lib/codex-review-coverage.mjs';
import { codexReviewsPath } from './lib/codex-reviews.mjs';
import { leftOutOf, reviewScope } from './lib/codex-review-scope.mjs';
import { killSurvivors, killTree } from './lib/process-tree.mjs';
import { GATE_WAIT_MS, takeGateLock } from './lib/gate-lock.mjs';

export { estimateTokens };

const TOKEN_BUDGET = 1500;

/** PASS/FAIL row for AGENTS.md's token budget, rooted at `cwd`. */
export function checkBudget(cwd) {
  const agentsPath = path.join(cwd, 'AGENTS.md');
  if (!fs.existsSync(agentsPath)) {
    return { name: 'budget', pass: false, detail: 'AGENTS.md not found' };
  }
  const text = fs.readFileSync(agentsPath, 'utf8');
  const tokens = estimateTokens(text);
  const pass = tokens <= TOKEN_BUDGET;
  const detail = `${tokens} estimated tokens (budget ${TOKEN_BUDGET})`;
  return { name: 'budget', pass, detail };
}

/** The `contracts` row: every contract under `odd/tasks/` must pass `js-harness contract check`.
 * Static only: it never runs a done-when command, which may be `npm run check` itself. */
export function checkContracts(cwd) {
  const name = 'contracts';
  const results = validateEntries(discoverContracts(cwd));
  if (results.length === 0) return { name, pass: true, detail: 'no contracts under odd/tasks' };
  const plural = (n) => `${n} contract${n === 1 ? '' : 's'}`;
  const failed = results.filter((result) => !result.ok);
  if (failed.length === 0) {
    return { name, pass: true, detail: `${plural(results.length)} checked`, lines: results.map((result) => result.label) };
  }
  const lines = failed.flatMap(({ label, errors }) => [label, ...errors.map((reason) => `  ${reason}`)]);
  return { name, pass: false, detail: `${failed.length} of ${plural(results.length)} fail`, lines };
}

/** Shortens `filePath` to start with `~` when it lies under `home`, so rows stay readable. */
function tildePath(filePath, home) {
  if (!filePath) return 'built-in or plugin';
  const relative = path.relative(home, filePath);
  return relative.startsWith('..') || path.isAbsolute(relative) ? filePath : path.join('~', relative);
}

/** One INFO row per host with every file that loads on each turn and the hooks whose stdout
 * reaches the model. Informational: the budget row alone decides pass or fail. */
export function checkPayload(cwd, home) {
  return measurePayload({ home, cwd }).hosts.map((host) => {
    const sources = host.sources.map((s) => {
      const tokens = s.tokens === null ? 'not found' : String(s.tokens);
      return `${s.name.padEnd(18)} ${tokens.padStart(9)}  ${tildePath(s.path, home)}`;
    });
    // A plugin's hook names the plugin it comes from; a settings hook keeps its row as it was.
    const hooks = host.hooks.map((h) => `hook ${h.event.padEnd(16)} ${h.plugin ? `${h.plugin}: ` : ''}${h.command}`);
    const detail = `${host.total} estimated tokens per turn from files (tools and hook output not counted)`;
    return { name: `payload ${host.host}`, pass: true, info: true, detail, lines: [...sources, ...hooks] };
  });
}

// A sensor that never exits (a watch-mode script, a linter waiting on stdin) would hold the pre-commit
// gate forever, so the wait is bounded. Twenty minutes, not ten: this repository's own suite takes about
// eight on a quiet machine and passed ten once other programs held two of eight cores, which refused
// commits whose tests were green.
const SENSOR_TIMEOUT_MS = 20 * 60 * 1000;

// The variables that bind a git command to one repository, as `git rev-parse --local-env-vars` lists
// them. Git exports some to a hook: from a linked worktree, `GIT_DIR` and an absolute `GIT_INDEX_FILE`.
const GIT_LOCAL_ENV = [
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CONFIG',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_COUNT',
  'GIT_OBJECT_DIRECTORY',
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_GRAFT_FILE',
  'GIT_INDEX_FILE',
  'GIT_NO_REPLACE_OBJECTS',
  'GIT_REPLACE_REF_BASE',
  'GIT_PREFIX',
  'GIT_SHALLOW_FILE',
  'GIT_COMMON_DIR',
];

// Those of them that say which repository a git command acts on and which index it reads. A pre-commit
// hook is always given `GIT_INDEX_FILE`, and in a linked worktree `GIT_DIR`; see `stagedDocuments`.
const GIT_BINDING_ENV = ['GIT_DIR', 'GIT_INDEX_FILE', 'GIT_WORK_TREE'];

const NPM_PLACEHOLDER_TEST ='echo "Error: no test specified" && exit 1';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isCommand = (value) => typeof value === 'string' && value.trim() !== '';

/** Reads and parses `<cwd>/<file>`: `{ value }`, `{ error }` naming the file when it is not JSON, or
 * `null` when it does not exist. */
function readJson(cwd, file) {
  const filePath = path.join(cwd, file);
  if (!fs.existsSync(filePath)) return null;
  try {
    return { value: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  } catch (err) {
    return { error: `${file} is not valid JSON: ${err.message}` };
  }
}

/** `harness.json` of `cwd` as `{ declared }`, the object it holds, or `undefined` where there is no such
 * file; `{ error }` when it is not JSON or holds no object. */
function readHarness(cwd) {
  const harness = readJson(cwd, 'harness.json');
  if (harness?.error) return { error: harness.error };
  if (harness && !isObject(harness.value)) return { error: 'harness.json must be a JSON object' };
  return { declared: harness?.value };
}

/** The project's sensors: named commands that must exit 0. `harness.json` `sensors` wins, which serves
 * any language; else the `test`, `lint` and `typecheck` scripts of `package.json`, run through npm so
 * `node_modules/.bin` is on the path. A file that is unreadable or of the wrong shape is an `error`,
 * never a silent skip: a gate that quietly ran nothing would look green. */
export function discoverSensors(cwd) {
  const none = { sensors: [], source: null };
  const { declared, error } = readHarness(cwd);
  if (error) return { ...none, error };
  if (declared && 'sensors' in declared) {
    // An empty map is a deliberate opt-out: it declares no sensor and does not fall back to package.json.
    const { sensors } = declared;
    if (!isObject(sensors) || !Object.values(sensors).every(isCommand)) {
      return { ...none, error: 'harness.json "sensors" must be an object of names to non-empty command strings' };
    }
    return { sensors: Object.entries(sensors).map(([name, command]) => ({ name, command })), source: 'harness.json' };
  }

  const pkg = readJson(cwd, 'package.json');
  if (pkg?.error) return { ...none, error: pkg.error };
  if (!pkg) return none;
  const scripts = pkg.value?.scripts;
  const scriptOf = (script) => (scripts && typeof scripts === 'object' ? scripts[script] : undefined);
  const sensors = [['tests', 'test'], ['lint', 'lint'], ['typecheck', 'typecheck']]
    // `npm init` writes this exact test script, which only fails; it is no test.
    .filter(([, script]) => isCommand(scriptOf(script)) && !(script === 'test' && scriptOf(script) === NPM_PLACEHOLDER_TEST))
    .map(([name, script]) => ({ name, command: `npm run ${script}` }));
  return { sensors, source: 'package.json' };
}

const DOCUMENTS_SHAPE = 'harness.json "documents" must be an array of paths from the top of the repository, with forward slashes and a final "/" for a folder';

/** What keeps `entry` out of the `documents` of harness.json, as the end of a sentence about it, or
 * `null` when it is taken. */
function documentFault(entry) {
  if (typeof entry !== 'string' || entry === '') return 'is not a non-empty string';
  if (entry.includes('\\')) return 'is written with a backslash';
  if (entry.includes('*')) return 'is a pattern, and none is taken';
  if (entry.startsWith('/') || /^[A-Za-z]:/.test(entry)) return 'is an absolute path';
  // One final `/` is the mark of a folder. What is left must be whole segments, so that no entry is
  // the repository itself (`.`, `./`) or leaves it (`..`).
  const segments = entry.replace(/\/$/, '').split('/');
  return segments.some((segment) => ['', '.', '..'].includes(segment)) ? 'has an empty, "." or ".." segment' : null;
}

/** The paths the project declares as documents, for the one rule that reads them: a commit that holds
 * documents alone runs no sensor (`stagedDocuments`). They are `harness.json` `documents`, an array of
 * paths from the top of the repository with forward slashes: an entry that ends in `/` is a folder and
 * covers every path under it, any other is one file by its whole path. No pattern is taken, and no path
 * that could name the repository itself or leave it.
 *
 * Declared, never assumed: a project without the key declares none and runs its sensors at every commit
 * as it always did, since in another project a document is the product. A value of the wrong shape is
 * an `error`, as for the sensors, and never a list quietly read as empty or as everything. */
export function discoverDocuments(cwd) {
  const none = { documents: [], source: null };
  const { declared, error } = readHarness(cwd);
  if (error) return { ...none, error };
  if (!declared || !('documents' in declared)) return none;
  const { documents } = declared;
  if (!Array.isArray(documents)) return { ...none, error: `${DOCUMENTS_SHAPE}; it is not an array` };
  for (const entry of documents) {
    const fault = documentFault(entry);
    // The entry as JSON: what the file holds reaches the report escaped.
    if (fault) return { ...none, error: `${DOCUMENTS_SHAPE}; ${JSON.stringify(entry)} ${fault}` };
  }
  return { documents, source: 'harness.json' };
}

/** Whether `one` and `other` are the same folder, however each is spelled (a link on the way, a short
 * Windows name, another case). `false` when either is not there or cannot be looked at. */
function sameFolder(one, other) {
  try {
    return fs.realpathSync.native(one) === fs.realpathSync.native(other);
  } catch {
    return false;
  }
}

/** The paths of the staged change, which is what the commit a gate guards will hold, when every one of
 * them is among `documents` (`discoverDocuments`). `null` when one is not, when nothing is staged (a
 * check run by hand guards no commit), and whenever git does not say: no git, no repository, a command
 * that fails. `null` is "run the sensors", so every doubt ends in a gate that runs what it always ran.
 *
 * What is staged is listed in the environment this process was given. A hook is given `GIT_INDEX_FILE`
 * by `git commit <path>` and `git commit -a`, which commit from an index of their own: that index is the
 * commit, not the one `git add` wrote. (A sensor is given none of those variables: `checkSensor`.)
 *
 * That environment is trusted only as the binding of the repository this gate checks. The variables of
 * a hook bind every git command under it to the hook's repository, wherever it runs: a `check --cwd
 * <another project>` started there would list what the hook's repository has staged and hold it
 * against the other project's documents. So where the environment holds one of `GIT_BINDING_ENV`, git
 * is first asked which repository `cwd` is in with none of the repository variables, and then which one
 * the environment binds it to: `null` unless both answer the same git folder and the index named, if
 * one is, lies in that folder, where git keeps its own (`index`, `index.lock`, `next-index-<pid>.lock`;
 * for a linked worktree, under `worktrees/<name>`, which is its git folder). An environment with none
 * of those variables is asked nothing more.
 *
 * Renames are off, so a file moved into the documents or out of them is listed at both its paths. The
 * names are ended by a NUL and read as they come, since a path may begin with a space. `documents` are
 * named from the top of the repository, so a gate that checks a folder below it skips nothing; under a
 * binding that is asked without it, since git takes the folder a `GIT_DIR` command runs in for the top.
 * With no commit yet git compares the index with nothing, and lists all that is staged.
 * `spawn` stands in for `spawnSync`. */
function stagedDocuments(cwd, documents, spawn = spawnSync) {
  const git = (args, env) => {
    try {
      const result = spawn('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...(env && { env }) });
      return result && !result.error && result.status === 0 ? result.stdout : null;
    } catch {
      return null; // no git on PATH
    }
  };
  /** The lines of what `git rev-parse <args>` answers, one for each thing asked; none when it fails. */
  const asked = (args, env) => git(['rev-parse', ...args], env)?.split(/\r?\n/) ?? [];
  // On Windows a variable is the same in any case, and this process may hold it in another than git's.
  const bound = Object.keys(process.env).some((key) => GIT_BINDING_ENV.includes(key.toUpperCase()));
  const unbound = bound ? Object.fromEntries(Object.entries(process.env).filter(([key]) => !GIT_LOCAL_ENV.includes(key.toUpperCase()))) : undefined;
  const [prefix, own] = asked(['--show-prefix', ...(bound ? ['--absolute-git-dir'] : [])], unbound);
  if (prefix !== '') return null;
  if (bound) {
    const [inherited] = asked(['--absolute-git-dir']);
    if (!sameFolder(own, inherited)) return null;
    // A path that is not whole is one from the folder git runs in, which is `cwd`, the top.
    const index = process.env.GIT_INDEX_FILE;
    if (index !== undefined && !sameFolder(path.dirname(path.resolve(cwd, index)), own)) return null;
  }
  const paths = git(['diff', '--cached', '--name-only', '--no-renames', '--no-relative', '-z'])?.split('\0').filter(Boolean) ?? [];
  const isDocument = (file) => documents.some((entry) => (entry.endsWith('/') ? file.startsWith(entry) : file === entry));
  return paths.length > 0 && paths.every(isDocument) ? paths : null;
}

// How many staged documents the row of a gate that ran no sensor names; the rest are counted.
const DOCUMENTS_NAMED = 10;

/** The one row of a gate that ran no sensor because the commit holds documents alone: which `sensors`
 * did not run, and for which staged `paths`. A name with a control character in it is shown as JSON:
 * it comes from the repository, and a line break in it would read as another row of the report. */
function documentsRow(sensors, paths) {
  const staged = paths.length === 1 ? 'the one staged path is a document' : `all ${paths.length} staged paths are documents`;
  const named = paths.slice(0, DOCUMENTS_NAMED).map((file) => (/\p{Cc}/u.test(file) ? JSON.stringify(file) : file));
  const more = paths.length - named.length;
  return {
    name: 'sensors',
    pass: true,
    info: true,
    detail: `no sensor ran (${sensors.map((sensor) => sensor.name).join(', ')}): ${staged} declared in harness.json "documents"`,
    lines: [...named, ...(more > 0 ? [`and ${more} more`] : [])],
  };
}

// Once the shell has exited, the pipes should close at once; a grandchild that kept them open (a
// daemon a script left behind) must not hold the gate, so we stop waiting for them after this.
const PIPE_GRACE_MS = 2000;
const SENSOR_OUTPUT_LIMIT = 64 * 1024 * 1024;

/** Runs `command` through the shell and resolves to a `spawnSync`-shaped `{ status, signal, stdout,
 * stderr, error? }`. Past `timeout` ms it kills the whole process tree and reports `error.code ===
 * 'ETIMEDOUT'`. Whatever still holds the pipes after the shell exited is killed too; the result keeps the
 * shell's own status. Output beyond 64 MiB per stream is dropped, so a noisy command is never ENOBUFS.
 *
 * `spawnSync`'s own timeout would kill only the shell, and the real command (`node` behind `cmd.exe`, `npm`
 * behind `sh`) would keep running after every commit. What is killed is found by `bin/lib/process-tree.mjs`,
 * which on Windows needs to know when the shell started and exited (a pid alone does not name its children).
 * A kill that could not be done is reported as `sweepError` on the result, never thrown out of a timer.
 * `killTree` and `killSurvivors` are injectable.
 *
 * With `inherit` the command is given this process's own input and output instead of pipes, so what it
 * prints reaches the caller as it prints it and `stdout` and `stderr` come back empty: that is for
 * `js-harness gate`, which runs a command for whoever started it and reports nothing itself. A `timeout`
 * of 0 is no time bound. */
export function runSensor(command, { cwd, env, timeout, inherit = false, killTree: tree = killTree, killSurvivors: survivors = killSurvivors }) {
  return new Promise((resolve) => {
    const out = { stdout: '', stderr: '' };
    let child;
    const startedAt = Date.now(); // before the spawn: the shell cannot have been created earlier
    try {
      child = spawnChild(command, { cwd, env, shell: true, windowsHide: true, detached: process.platform !== 'win32', stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      resolve({ status: null, signal: null, ...out, error });
      return;
    }
    let exitedAt;
    let sweepError;
    const stop = (kill) => {
      try {
        kill(child, { startedAt, ...(exitedAt !== undefined && { exitedAt }) });
      } catch (error) {
        sweepError ??= error;
      }
    };
    // On POSIX the sensor leads its own process group, so a Ctrl-C at the terminal no longer reaches
    // it: pass the signal on by killing the group, then let it end check as it would have.
    const signals = process.platform === 'win32' ? [] : ['SIGINT', 'SIGTERM', 'SIGHUP'];
    const forward = (signal) => {
      stop(tree);
      for (const name of signals) process.removeListener(name, forward);
      process.kill(process.pid, signal);
    };
    for (const name of signals) process.once(name, forward);
    let timedOut = false;
    let exit = { status: null, signal: null };
    let done = false;
    let timer;
    let grace;
    const finish = (extra) => {
      if (done) return;
      done = true;
      for (const name of signals) process.removeListener(name, forward);
      clearTimeout(timer);
      clearTimeout(grace);
      child.stdout?.destroy();
      child.stderr?.destroy();
      const error = extra ?? (timedOut ? Object.assign(new Error(`timed out after ${timeout} ms`), { code: 'ETIMEDOUT' }) : undefined);
      resolve({ ...exit, ...out, ...(error && { error }), ...(sweepError && { sweepError: sweepError.message }) });
    };
    // No pipe to read when the command writes to this process's own output.
    for (const stream of inherit ? [] : ['stdout', 'stderr']) {
      child[stream].setEncoding('utf8');
      child[stream].on('data', (chunk) => {
        if (out[stream].length < SENSOR_OUTPUT_LIMIT) out[stream] += chunk;
      });
    }
    child.on('error', (error) => finish(error));
    child.on('exit', (status, signal) => {
      exit = { status, signal };
      exitedAt = Date.now();
      clearTimeout(timer);
      clearTimeout(grace);
      // Pipes still open this long after the shell exited: a descendant holds them. Kill it, or a test
      // server the script started would run on after every commit.
      grace = setTimeout(() => {
        stop(survivors);
        finish();
      }, PIPE_GRACE_MS);
    });
    child.on('close', () => finish());
    if (timeout > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        stop(tree);
        // The shell may already be gone with a survivor holding the pipes; do not wait on them for long.
        grace = setTimeout(() => finish(), PIPE_GRACE_MS);
      }, timeout);
    }
  });
}

/** The mark of a held gate lock: a process that holds the machine's gate lock (`./lib/gate-lock.mjs`)
 * gives `JS_HARNESS_GATE_HELD=1` to what it runs, `check` to its sensors and `js-harness gate` to its
 * command. A `check` or a `js-harness gate` that starts with the mark takes no lock and runs at once
 * what it has to run: its parent holds the lock, and waiting for it would be waiting for itself, which
 * is what `js-harness gate -- npm run check` did, for the whole of its wait, before there was a mark.
 *
 * It is not `JS_HARNESS_CHECK_INNER`, which says "a gate's sensor runs you, so run no sensor": a `check`
 * that has only this mark runs its sensors, since nobody runs them for it.
 *
 * The mark is safe to trust because a child of a holder runs inside its turn: the holder waits for what
 * it started and beats while it does, so the lock is held for as long as that child runs, and what the
 * child starts is part of the one heavy run the turn was taken for. It is given only with the lock in
 * hand, never by a gate that runs without it (a lock that could not be taken).
 *
 * What it cannot protect against: a mark set by hand, which turns the lock off for that process and all
 * it starts; a process that outlives the holder that started it (left in the background, detached),
 * which keeps the mark after the turn is over; and a holder that lost its lock to another gate for
 * having been silent a whole minute, whose children still carry it. `check` says in a row that it ran
 * under the mark, and `gate` in a line on stderr, so a mark that should not have been there shows. */
export const GATE_HELD_ENV = 'JS_HARNESS_GATE_HELD';

/** Runs one sensor's command in `cwd` through the shell and reports pass/fail. `spawn` may return a
 * plain result or a promise of one, so a test can stub it with either. `gateHeld` says that the gate
 * which runs this sensor does so inside a turn at the machine's gate lock, its own or the one of the
 * process that started it: the sensor is then given the mark of a held lock (`GATE_HELD_ENV`), and
 * otherwise never has it, whatever this process was given. */
export async function checkSensor(cwd, sensor, { spawn = runSensor, sensorTimeout = SENSOR_TIMEOUT_MS, gateHeld = false } = {}) {
  // The command runs against a throwaway home, so a test that forgets `--home` cannot write into
  // the real one — that happened once, and a rule in prose would not have stopped it.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-test-home-'));
  // npm keeps its cache and logs under %LOCALAPPDATA% on Windows, not under HOME, so `npm run` is
  // pointed into the throwaway home as well.
  const overrides = { JS_HARNESS_CHECK_INNER: '1', HOME: home, USERPROFILE: home, npm_config_cache: path.join(home, '.npm-cache'), ...(gateHeld && { [GATE_HELD_ENV]: '1' }) };
  // NODE_TEST_CONTEXT is set when check itself runs under `node --test`; the nested runner would act
  // as a child and skip files. Every case variant of an override goes too: Windows keeps the
  // uppercase one of two keys that differ only in case, and npm reads either.
  // Git's repository variables go as well: with the `GIT_DIR` a hook exports, a sensor's own `git init`
  // in a temp directory acts on the repository being committed to, and once left it bare.
  // The mark of a held lock goes whenever it is not given above: the one this process carries is its
  // parent's word, and a gate that runs its sensors without the lock must not pass it on.
  const replaced = new Set([...Object.keys(overrides), GATE_HELD_ENV, 'NODE_TEST_CONTEXT', ...GIT_LOCAL_ENV].map((key) => key.toLowerCase()));
  const inherited = Object.entries(process.env).filter(([key]) => !replaced.has(key.toLowerCase()));
  const env = { ...Object.fromEntries(inherited), ...overrides };
  let result;
  try {
    result = await spawn(sensor.command, { cwd, env, timeout: sensorTimeout });
  } finally {
    // Best effort: on Windows a survivor can still hold the home as its cwd, and that must not fail check.
    try {
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // left behind in the temp directory
    }
  }
  const { name, command } = sensor;
  const pass = !result.error && result.status === 0;
  let detail = `${command} passed`;
  if (result.error?.code === 'ETIMEDOUT') detail = `${command} timed out after ${sensorTimeout / 1000} s`;
  else if (result.error) detail = `${command} could not run: ${result.error.message}`;
  else if (result.status === null && result.signal) detail = `${command} was killed by ${result.signal}`;
  else if (!pass) detail = `${command} exited ${result.status}`;
  // The verdict is the command's own; a leftover that could not be stopped is said, not hidden, and does not fail it.
  if (result.sweepError) detail += `; could not stop what it left running: ${result.sweepError}`;
  // Keep the runner's own report, even what it printed before a spawn error such as ENOBUFS, so a
  // red row says which test failed, not just that one did.
  return { name, pass, detail, output: pass ? '' : `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/** `ms` as a person reads a wait: `45 s`, `3 min 12 s`. */
function duration(ms) {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

/** The bound of a wait as `--wait` takes it: `1 minute`, `2.5 minutes`. */
const minutes = (count) => `${count} minute${count === 1 ? '' : 's'}`;

/** The gate a holder of the lock is, for a message: the folder it checks, with its pid and start time
 * where its file says them. A holder of whom nothing is known (a file that could not be read, a lock
 * folder that could not be listed) is "another gate". */
function gateOf(holder) {
  const said = [holder.pid !== null && `pid ${holder.pid}`, holder.startedAt !== null && `started ${holder.startedAt}`].filter(Boolean);
  return `${holder.cwd === null ? 'another gate' : `the gate of ${holder.cwd}`}${said.length ? ` (${said.join(', ')})` : ''}`;
}

// A lock taken at once took a few milliseconds, and the report of a gate that waited for nobody says
// nothing of the lock. A wait this long is said: it is a poll for another gate, or a takeover.
const GATE_WAIT_SAID_MS = 1000;

/** One turn at the machine's gate lock (`./lib/gate-lock.mjs`), taken the way a gate takes it, for
 * whoever runs under it: `check` around its sensors, `js-harness gate` around a command. `name` is who
 * says the wait, `command` what the holder's file says it runs, in the folder `cwd`.
 *
 * Whoever finds the lock held waits for it, and says on stderr, as the wait begins and for each gate it
 * then waits for, whose gate that is and for how long at most from then on, which is what is left of the
 * bound and not the whole of it: the caller is a commit running in the background, and a silent wait
 * reads as a hang.
 *
 * Resolves to `{ lock }` once the lock is held (`takeGateLock`), for the caller to release. Resolves to
 * `{ refused }` when nothing may run: the lock is held and `wait` is off, or the wait went past
 * `waitMinutes`; `refused` is the sentence that says which, and names the holder. Resolves to
 * `{ without }` when the lock cannot be taken at all (the home cannot be written, or a lock is there of
 * which nothing could be read for a minute, which is no gate to wait an hour for): `without` names the
 * lock and why, and the caller runs without it and says so, since the lock guards the machine's time
 * and not what is run.
 * `take` stands in for `takeGateLock`, so a test stands in for the lock or runs the real one on its own
 * clock. */
export async function takeGateTurn({ name, home, cwd, command, wait, waitMinutes }, take = takeGateLock) {
  const waitMs = waitMinutes * 60_000;
  const onWait = (holder, leftMs = waitMs) => {
    // What is left of the bound when this gate is first waited for: the whole of it, as `--wait` takes
    // it, while under a second is spent, which is the wait's first line.
    const left = waitMs - leftMs < GATE_WAIT_SAID_MS ? minutes(waitMinutes) : duration(leftMs);
    // A holder that already reads stale is waited for a poll or two, not for the whole bound.
    const silent = holder.stale ? '; it has been silent for over a minute, and its lock is taken over if it stays so' : '';
    console.error(`${name}: waiting for ${gateOf(holder)} to finish, for ${left} at most${silent}`);
  };
  let lock;
  try {
    lock = await take({ home, cwd: path.resolve(cwd), command, wait, waitMs, onWait });
  } catch (err) {
    return { without: `the machine's gate lock, which could not be taken (${err instanceof Error ? err.message : String(err)})` };
  }
  if (lock.refused === 'held') return { refused: `${gateOf(lock.holder)} holds the machine's gate lock, and --no-wait was given` };
  if (lock.refused) {
    return { refused: `${gateOf(lock.holder)} still held the machine's gate lock after ${duration(lock.waitedMs)} (--wait bounds the wait at ${minutes(waitMinutes)})` };
  }
  return { lock };
}

/** Runs `run`, the sensors of the gate that checks `cwd`, while this gate holds the machine's gate lock
 * (two gates at once make both miss their time bound with every test green), and resolves to their
 * rows, with a row named `gate` for whatever the lock did that a reader must know. Taken at once, which
 * is the common case, it adds none.
 *
 * The lock is taken as `takeGateTurn` says. The time a gate waited for it is an INFO row. It counts
 * against no sensor's timeout, which starts when the sensor does. With `wait` off, or past
 * `waitMinutes`, the row is a FAIL that names the holder and `run` is not called: a gate that ran
 * nothing must not look green.
 *
 * A lock that cannot be taken at all does not turn a gate red, since the lock guards the machine's time
 * and not the project's code: `run` is called without it and an INFO row says so and why. So does a
 * lock lost while the sensors ran, which happens only to a gate that was silent for the whole stale
 * time (a machine that slept).
 *
 * The lock is released on every way out of `run`, a throw included. A gate that is killed (a Ctrl-C, a
 * closed terminal) leaves its holder's file, which beats no more: the next gate reads it stale a minute
 * after its last beat and takes it over, having said whose gate it waits for. No signal is handled here
 * to release it sooner: a handler would have to end the process itself, and `check` would no longer end
 * on a Ctrl-C the way it does today.
 *
 * `run(true)` is called with the lock in hand, and the sensors are then given the mark of a held lock
 * (`GATE_HELD_ENV`); `run(false)` without it.
 * `takeGateLock` is injectable, as in `takeGateTurn`. */
async function underGateLock(cwd, { home, wait, waitMinutes }, { takeGateLock: take = takeGateLock }, run) {
  const turn = await takeGateTurn({ name: 'check', home, cwd, command: 'check', wait, waitMinutes }, take);
  if (turn.without) return [gateRow(`the sensors ran without ${turn.without}, so another gate may have run at the same time`), ...(await run(false))];
  if (turn.refused) return [gateRow(`no sensor ran: ${turn.refused}`, false)];
  const { lock } = turn;
  const rows = lock.waitedMs >= GATE_WAIT_SAID_MS ? [gateRow(`waited ${duration(lock.waitedMs)} for the machine's gate lock before the sensors ran`)] : [];
  let lost = false;
  try {
    rows.push(...(await run(true)));
  } finally {
    // Asked before the release, after which a gate has no lock to have lost.
    lost = lock.lost();
    lock.release();
  }
  if (lost) rows.push(gateRow("the machine's gate lock was lost while the sensors ran: this gate was silent for over a minute and another took its lock, so two gates may have run at once"));
  return rows;
}

/** A row named `gate`: what the machine's gate lock did that a reader of the report must know. It informs
 * and fails nothing, but for a gate that ran no sensor (`pass` false). */
const gateRow = (detail, pass = true) => ({ name: 'gate', pass, ...(pass && { info: true }), detail });

/** One row per sensor, run one after another; a broken declaration, of the sensors or of the documents,
 * is one FAIL row and no sensor at all is one INFO row.
 *
 * A commit that holds documents alone runs no sensor: where the project declares its documents
 * (`discoverDocuments`) and every staged path is one of them (`stagedDocuments`), the one row is an INFO
 * that says which sensors did not run and for which paths, and no lock is taken, there being nothing to
 * run under it. `deps.git` stands in for the `spawnSync` that asks git what is staged.
 *
 * With `lock` (`{ home, wait, waitMinutes }`, which is what a gate passes) the sensors
 * run under the machine's gate lock in that home, and only when there is a sensor to run: see
 * `underGateLock`, which may add a row named `gate`. With `{ held: true }` for `lock`, which is what a
 * gate passes when it was started with the mark of a held lock (`GATE_HELD_ENV`), no lock is taken: the
 * sensors run at once in the turn of the process that started this gate, are given the mark as well,
 * and a row named `gate` says so. Without `lock` they run as they are, which is for a caller that is no
 * gate. */
export async function checkSensors(cwd, deps = {}, lock) {
  const { sensors, source, error } = discoverSensors(cwd);
  if (error) return [{ name: 'sensors', pass: false, detail: error }];
  // Read before anything runs or is skipped: a declaration that cannot be taken fails the gate even
  // where there is no sensor for it to skip.
  const declared = discoverDocuments(cwd);
  if (declared.error) return [{ name: 'sensors', pass: false, detail: declared.error }];
  if (sensors.length === 0) {
    const detail = source === 'harness.json'
      ? 'harness.json declares no sensors, so none ran'
      : 'no sensors declared: add test, lint or typecheck scripts to package.json, or a "sensors" object to harness.json';
    return [{ name: 'sensors', pass: true, info: true, detail }];
  }
  // Git is asked only by a project that declares documents: without them nothing here changed.
  const staged = declared.documents.length > 0 ? stagedDocuments(cwd, declared.documents, deps.git) : null;
  if (staged) return [documentsRow(sensors, staged)];
  const run = async (gateHeld = false) => {
    const rows = [];
    for (const sensor of sensors) rows.push(await checkSensor(cwd, sensor, { ...deps, gateHeld }));
    return rows;
  };
  if (!lock) return run();
  if (lock.held) {
    const inTurn = `the sensors ran in the turn of the process that started this gate, which holds the machine's gate lock (${GATE_HELD_ENV}=1), so this gate took none`;
    return [gateRow(inTurn), ...(await run(true))];
  }
  return underGateLock(cwd, lock, deps, run);
}

/** One `gentle-ai <args>` run as `{ status, stdout, stderr, error? }`; a spawn that throws is an `error`. */
function runGentleAi(spawn, args, timeout) {
  try {
    return spawn('gentle-ai', args, { encoding: 'utf8', timeout, maxBuffer: 16 * 1024 * 1024 }) ?? { error: new Error('no result') };
  } catch (error) {
    return { error };
  }
}

/** Parses `text` as a JSON object, else `null`. */
function jsonObject(text) {
  try {
    const value = JSON.parse(text);
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

/** Why a gentle-ai run gave nothing usable, in a few words. */
function whyNoAssessment(result, timeout) {
  if (result.error?.code === 'ETIMEDOUT') return `timed out after ${Math.round(timeout / 1000)}s`;
  if (result.error) return result.error.message;
  const said = String(result.stderr ?? '').trim().split('\n')[0];
  const exit = result.status === null ? `killed by ${result.signal ?? 'a signal'}` : `exit ${result.status}`;
  return said ? `${exit}: ${said}` : `${exit}, no assessment on stdout`;
}

/** The `review` row: whether the pending change is due a gentle-ai review by risk, so the answer shows
 * at every commit instead of depending on anyone remembering to ask. Informational and fail-open: gentle-ai
 * owns review and RDD is the user's switch, so a missing, failing or slow gentle-ai never turns a commit red.
 * Only an explicit `off` skips the assessment; an unreadable mode counts as on, the switch's default. */
export function checkReview(cwd, { spawn = spawnSync, timeout = 20000 } = {}) {
  const row = (detail, lines) => ({ name: 'review', pass: true, info: true, detail, ...(lines?.length ? { lines } : {}) });
  const notFound = () => row('gentle-ai was not found, so review by risk was not assessed');
  const isMissing = (result) => result.error?.code === 'ENOENT';

  const mode = runGentleAi(spawn, ['review', 'mode', 'status', '--cwd', cwd, '--json'], timeout);
  if (isMissing(mode)) return notFound();
  const status = mode.error || mode.status !== 0 ? null : jsonObject(mode.stdout)?.status;
  if (isObject(status) && status.effective === 'off') {
    return row(`RDD is off (${status.source ?? 'unknown source'}), so no review was assessed`);
  }

  // Parsed whatever the exit code: on a clean tree gentle-ai exits non-zero and still prints the JSON.
  const result = runGentleAi(spawn, ['review', 'assess', '--cwd', cwd, '--json'], timeout);
  if (isMissing(result)) return notFound();
  const assessed = result.error ? null : jsonObject(result.stdout);
  if (assessed?.schema !== 'gentle-ai.review-assessment/v1') {
    const reason = assessed ? 'unexpected schema' : whyNoAssessment(result, timeout);
    return row(`gentle-ai review assess gave no assessment (${reason})`);
  }
  const { risk, changed_paths: paths, changed_lines: changed, review_due: due, review_due_reason: dueReason } = assessed;
  const wellFormed = typeof risk === 'string' && Number.isInteger(paths) && Number.isInteger(changed) &&
    typeof due === 'boolean' && typeof dueReason === 'string';
  if (!wellFormed) return row('gentle-ai review assess gave no assessment (unexpected shape)');
  const reasons = (Array.isArray(assessed.reasons) ? assessed.reasons : []).filter((reason) => isObject(reason) && typeof reason.code === 'string');
  const lines = reasons.map((reason) => `${reason.code} ${reason.path ?? reason.detail ?? ''}`.trim());
  if (paths === 0) {
    // gentle-ai answers high and due both for a clean tree and for a candidate it could not build;
    // only its explicit "no pending changes" reason is the clean tree, which is no finding.
    const clean = reasons.some((reason) => reason.code === 'unassessable' && /no pending changes/.test(String(reason.detail)));
    return clean ? row('no pending change to assess') : row('gentle-ai could not assess the pending change', lines);
  }

  const count = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;
  const detail = `${risk} risk, ${count(paths, 'path')}, ${count(changed, 'line')}: review ${due ? 'due' : 'not due'} (${dueReason})`;
  const next = assessed.next_transition?.command;
  if (due && typeof next === 'string') lines.push(`next: ${next}`);
  return row(detail, lines);
}

/** The branch a push is measured against: what `refs/remotes/<remote>/HEAD` points at, else
 * `<remote>/main`, else `<remote>/master`; `null` when none of them resolves to a commit. Only the
 * remote's own refs count, never a local branch: pushing `main` itself would otherwise be measured
 * against the very commits being pushed and pass with nothing to review. */
function defaultBranch(spawn, cwd, remote) {
  const resolves = (ref) => gitOut(spawn, cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  const pointed = gitOut(spawn, cwd, ['symbolic-ref', '--quiet', `refs/remotes/${remote}/HEAD`]);
  const candidates = [pointed, `refs/remotes/${remote}/main`, `refs/remotes/${remote}/master`].filter(Boolean);
  const ref = candidates.find((candidate) => resolves(candidate));
  return ref ? { ref, label: ref.replace(/^refs\/remotes\//, '') } : null;
}

/** What the Codex review records say of the code commits between the default branch of `remote` and
 * `head`, for the two rows that read it: the `--push` row, which fails on a commit no record covers, and
 * the row of the plain check, which says how large the review of those commits is.
 *
 * `{ unknown }` when it cannot be told: the `detail` and `lines` of the `--push` row and, where those words
 * speak of a push, the `why` of the plain one. Otherwise the commit `tip` that `head` names, the default
 * branch as the ref `baseRef` and its label `base`, and what the records say of `base..tip`, as
 * `reviewCoverage` gives it: the `codeCommits` (newest first), the `covers`, the `uncovered` code commits,
 * with the `note` that counts the records that were left out.
 *
 * Which commits are code and which records cover them is not decided here. It is the one definition this
 * check shares with `js-harness codex-review` (`./lib/codex-review-coverage.mjs`), which reads it for the
 * range it is asked to review: what this refuses to push is what that command reviews. */
function codexReviewCoverage(cwd, head, { spawn, remote }) {
  const unknown = (detail, lines, why) => ({ unknown: { detail, ...(lines ? { lines } : {}), ...(why ? { why } : {}) } });
  const tip = gitOut(spawn, cwd, ['rev-parse', '--verify', '--quiet', `${head}^{commit}`]);
  if (!tip) {
    return gitOut(spawn, cwd, ['rev-parse', '--git-dir']) === null
      ? unknown(`${cwd} is not a git repository`, undefined, 'this is not a git repository')
      : unknown(`cannot resolve --head ${head} to a commit`, undefined, `${head} does not name a commit`);
  }
  // Git hands a hook the URL, not a name, when the push names a URL: no ref of it can exist.
  const remotes = gitOut(spawn, cwd, ['remote'])?.split('\n').map((line) => line.trim()) ?? [];
  if (!remotes.includes(remote)) {
    return unknown(`${remote} is not a configured remote, so there is no default branch to compare against`, [
      'push through a configured remote: git remote add <name> <url>, then git push <name> ...',
      'or name one that exists: js-harness check --push --remote <name>',
    ]);
  }
  const branch = defaultBranch(spawn, cwd, remote);
  if (!branch) {
    return unknown(
      `no default branch of ${remote} to compare against (refs/remotes/${remote}/HEAD, ${remote}/main or ${remote}/master), so there is no range to check`,
      [`set it with: git remote set-head ${remote} --auto`],
    );
  }
  const { ref: baseRef, label: base } = branch;

  const coverage = reviewCoverage(cwd, { from: baseRef, tip, spawn });
  if (coverage.unknown === MARKS_UNREAD) {
    return unknown(`cannot read which files of ${base}..${head} a Codex review leaves out (\`git check-attr --source\` failed; it needs git 2.40 or later)`);
  }
  if (coverage.unknown) return unknown(`cannot list the commits in ${base}..${head}`);
  const { codeCommits, covers, uncovered, invalid, ignored } = coverage;
  const noteParts = [
    invalid ? `${invalid} invalid record${invalid === 1 ? '' : 's'} ignored` : '',
    ignored ? `${ignored} record${ignored === 1 ? '' : 's'} ignored (base or head not found)` : '',
  ].filter(Boolean);
  const note = noteParts.length ? `; ${noteParts.join('; ')}` : '';
  return { tip, baseRef, base, codeCommits, covers, uncovered, note };
}

/** What both rows say of a coverage that leaves no code commit uncovered, before its `note`. */
function coveredDetail({ codeCommits, base }) {
  return codeCommits.length
    ? `${codeCommits.length} code commit${codeCommits.length === 1 ? '' : 's'} since ${base}, all covered by a Codex review record`
    : `no code commits since ${base}`;
}

/** The `--push` row: every commit between the remote's default branch and `head` that changes a file
 * a review reads (not a document, not a path the project marks; a merge by the files somebody wrote
 * in it, so one that only brings two sides together needs none: `reviewCoverage`)
 * must lie in a range some `codex-review` record covers (any
 * outcome: an `unavailable` record is an explicit skip, and a `nothing-to-review` one a range that held
 * nothing for a review to look at, such as a change and its revert; both are listed). Plain `check` never
 * runs it, because a slice under gentle-ai's review budget is committed before it is reviewed: what it
 * runs is `checkCodexReviewDebt`, which reads the same records and fails nothing. */
export function checkCodexReviews(cwd, head = 'HEAD', { spawn = spawnSync, remote = 'origin' } = {}) {
  const name = 'codex-review';
  const fail = (detail, lines) => ({ name, pass: false, detail, ...(lines ? { lines } : {}) });
  const state = codexReviewCoverage(cwd, head, { spawn, remote });
  if (state.unknown) return fail(state.unknown.detail, state.unknown.lines);
  const { base, codeCommits, covers, uncovered, note } = state;
  if (uncovered.length) {
    // `git log` lists newest first, so the oldest uncovered commit is the last one.
    const oldest = uncovered[uncovered.length - 1];
    // A root commit has no `<id>^` to use as a base; a range from the unrelated default branch does
    // reach it, and `--unavailable` records a skip instead of a review. The command "makes the record",
    // not "the review": over a range with nothing to review it records that, and starts no review.
    // A merge is no root commit: its `<id>^` is the first of its parents, and the range from there holds
    // the merge and all it changed against that parent, what was written in it included.
    const hint = oldest.isRoot
      ? `${oldest.shortId} is a root commit, so ${oldest.shortId}^ does not exist; a range from the default branch reaches it: js-harness codex-review --base ${base} (add --unavailable <reason> to record a skip instead)`
      : `make the record with: js-harness codex-review --base ${oldest.shortId}^`;
    const lines = [...uncovered.map((commit) => `${commit.shortId} ${commit.subject}`), hint];
    return fail(`${uncovered.length} of ${codeCommits.length} code commit${codeCommits.length === 1 ? '' : 's'} since ${base} have no Codex review record (${codexReviewsPath(cwd, { spawn }) ?? 'no record file'})${note}`, lines);
  }

  // The records that cover a code commit here and are no review of Codex's, each as a line that says which
  // it is and why: an explicit skip, or a range that held nothing to review. The detail counts the commits
  // as covered by a record, which they are; these lines are what keeps that from reading as "reviewed".
  const lines = notReviews(state).map((rec) => `${NOT_A_REVIEW[rec.outcome]} ${rec.base.slice(0, 7)}..${rec.head.slice(0, 7)}: ${rec.reason ?? 'no reason given'}`);
  return { name, pass: true, detail: `${coveredDetail(state)}${note}`, ...(lines.length ? { lines } : {}) };
}

/** `count` things with thousands separated and `noun` in the singular for one: `1 part`, `1,050 changed lines`. */
const counted = (count, noun) => `${String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ${noun}${count === 1 ? '' : 's'}`;

/** How large the review of `from..tip` is today, sized as `js-harness codex-review` sizes a range: how many
 * `parts` it is reviewed in at the default bound of a part, and the `changedLines` and `files` they hold,
 * which are those of the files a review reads; `leftOut` is how many files of the range it leaves out, by
 * the marks of the commit `tip`, as that command reads them. `null` when git cannot say. Renames are off,
 * as in that command. */
function reviewSize(spawn, cwd, from, tip) {
  // The output ends with the NUL that ends its last record, which is no whitespace: `gitOut` trims nothing of it.
  // `--no-relative`, as for the commits (`reviewCoverage`): every file of the range, named from the top.
  const numstat = from === null ? null : gitOut(spawn, cwd, ['diff', '--numstat', '-z', '--no-renames', '--no-relative', from, tip]);
  if (numstat === null) return null;
  try {
    const files = numstatFiles(numstat);
    const why = leftOutOf(files.map((file) => file.path), { cwd, source: tip, spawn });
    if (why === null) return null;
    const { read, leftOut } = reviewScope(files, why);
    return { parts: reviewParts(read).length, files: read.length, changedLines: read.reduce((sum, file) => sum + file.changedLines, 0), leftOut: leftOut.files };
  } catch {
    return null;
  }
}

/** The `codex-review` row of the plain check: how much code waits for a Codex review, said at every commit.
 * A branch once reached 28 parts of review because no slice was reviewed when it closed and nothing said the
 * debt was growing (odd/tasks/codex-review-cost.md); the `--push` row says it when the push is refused, and
 * by then the review is as large as it will get.
 *
 * Informational: it reads what the `--push` row reads (`codexReviewCoverage`, from the remote's default
 * branch to `HEAD`) and fails nothing, a state it cannot tell included. For the code commits no record
 * covers it says how many they are and how large the review that covers them is today: the review
 * `js-harness codex-review` would run, which starts where the records end (`reviewStart`, the one rule the
 * two share) and leaves out the files a review leaves out; and it names the command that prints the plan of
 * that review and starts nothing.
 *
 * It fails nothing by throwing either. Every git call under it answers `null` where it fails and the
 * records are read by a reader that passes over what it cannot read, but the plain check ran none of this
 * before the row existed: whatever still throws is said as what the row cannot tell, with what failed, and
 * the check goes on as it would have. The `--push` row has no such guard, and a throw under it stays loud. */
export function checkCodexReviewDebt(cwd, { spawn = spawnSync, remote = 'origin' } = {}) {
  const row = (detail, lines) => ({ name: 'codex-review', pass: true, info: true, detail, ...(lines?.length ? { lines } : {}) });
  const cannotTell = (why) => row(`cannot tell how much code waits for a Codex review: ${why}`);
  try {
    return codexReviewDebt(cwd, { spawn, remote }, { row, cannotTell });
  } catch (err) {
    return cannotTell(`reading the commits, their Codex review records or the size of their review failed (${err instanceof Error ? err.message : String(err)})`);
  }
}

/** What `checkCodexReviewDebt` says, made with its `row` and its `cannotTell`, and free to throw. */
function codexReviewDebt(cwd, { spawn, remote }, { row, cannotTell }) {
  const state = codexReviewCoverage(cwd, 'HEAD', { spawn, remote });
  // A fresh clone, a project with no remote, a folder that is no repository: this runs in all of them.
  if (state.unknown) return cannotTell(state.unknown.why ?? state.unknown.detail);
  const { tip, baseRef, base, codeCommits, uncovered, note } = state;
  if (uncovered.length === 0) {
    // Covered by a record is not reviewed: a skip and a range with nothing to review cover too. How many
    // such records there are is said; which they are is the push check's listing, not repeated at every commit.
    const others = notReviews(state).length;
    const said = others ? ` (${others} of the records that cover them ${others === 1 ? 'is' : 'are'} a skip or a range with nothing to review: js-harness check --push lists them)` : '';
    return row(`${coveredDetail(state)}${said}${note}`);
  }
  // The review that is sized is the one `js-harness codex-review` would run: it starts where that command
  // starts it (`reviewStart`), from the commit the range of the default branch starts at, which is `null`
  // where the two histories share none. That is the parent of the oldest uncovered commit, named as
  // `<id>^`, when a review can start there; where it cannot (a root commit has no `<id>^`, for one) the
  // push check names the default branch as the base that reaches every commit, and so does this.
  // Where git did not say which commit the range starts at, no start is known and none is sized: taken
  // for two histories that share none, a later start would be held to no commit (`rangeStart`).
  const range = rangeStart(cwd, { base: baseRef, tip, spawn });
  const { start, before } = range.unknown ? { start: null, before: null } : reviewStart(uncovered, { cwd, from: range.from, tip, spawn });
  const baseArg = before === null ? base : `${before.shortId}^`;
  const size = reviewSize(spawn, cwd, start, tip);
  // More parts than a run starts by itself: the review is already one that has to be asked for by its count.
  const over = size !== null && size.parts > MAX_PARTS_WITHOUT_FLAG;
  let sized = `how large the review of ${baseArg}..HEAD is today could not be told`;
  if (size?.parts === 0) sized = `the review of ${baseArg}..HEAD has no part today, since the range changes no file ${size.leftOut > 0 ? 'a review reads ' : ''}as a whole`;
  else if (size) {
    sized =
      `the review of ${baseArg}..HEAD is ${counted(size.parts, 'part')} today, ${counted(size.changedLines, 'changed line')} in ${counted(size.files, 'file')}` +
      (over ? `, already more parts than ${partsBound({ maxParts: MAX_PARTS_WITHOUT_FLAG, maxPartsGiven: false })}` : '');
  }
  return row(`no Codex review record for ${uncovered.length} of ${counted(codeCommits.length, 'code commit')} since ${base}: ${sized}${note}`, [
    ...(over ? ['the cheaper way is to review now: every commit added to this range makes its review larger'] : []),
    `what it would cost, with nothing spent: js-harness codex-review --base ${baseArg} --plan`,
  ]);
}

const USAGE =
  'Usage: js-harness check [--cwd <path>] [--home <path>] [--remote <name>] [--wait <minutes> | --no-wait] | js-harness check --push [--head <rev>] [--remote <name>] [--cwd <path>]';

// A flag with no value (end of argv, or immediately followed by another `--flag`) is a usage
// error, not a silently-swallowed token that later crashes `path.join` with `undefined`.
class CheckArgError extends Error {}

function requireValue(argv, i, flag) {
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) throw new CheckArgError(`${flag} requires a value`);
  return value;
}

/** How `argv` says to wait for the machine's gate lock, as `{ noWait, waitMinutes }`, for `check` and for
 * `js-harness gate`, which take the same two flags: `--wait <minutes>` bounds the wait (an hour when it
 * is not given; a fraction is taken, `0.5` for thirty seconds) and `--no-wait` refuses instead of
 * waiting. Throws `CheckArgError` when `--wait` is given without a value or with one that is not a number
 * of minutes above zero, and when it comes with `--no-wait`, which says the opposite. */
export function parseGateWait(argv) {
  const at = argv.indexOf('--wait');
  const wait = at !== -1 ? requireValue(argv, at, '--wait') : undefined;
  const noWait = argv.includes('--no-wait');
  if (wait !== undefined && !(/^\d+(\.\d+)?$/.test(wait) && Number(wait) > 0)) {
    throw new CheckArgError(`--wait takes a number of minutes above zero, not "${wait}"`);
  }
  if (wait !== undefined && noWait) throw new CheckArgError('--wait and --no-wait cannot be given together');
  return { noWait, waitMinutes: wait === undefined ? GATE_WAIT_MS / 60_000 : Number(wait) };
}

/** Parses `argv`, matching `doctor.mjs`'s precedence: `--home` flag, then `env.JS_HARNESS_HOME`,
 * then `os.homedir()`. Throws `CheckArgError` when `--cwd`/`--home`/`--head`/`--remote`/`--wait` is given
 * without a value, and for a `--wait` it cannot take (`parseGateWait`). */
function parseArgs(argv, env) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? requireValue(argv, i, flag) : undefined;
  };
  // Read first, as it always was: a `--wait` that cannot be taken is said before any other flag's fault.
  const { noWait, waitMinutes } = parseGateWait(argv);
  return {
    cwd: get('--cwd') ?? process.cwd(),
    home: get('--home') ?? env.JS_HARNESS_HOME ?? os.homedir(),
    push: argv.includes('--push'),
    head: get('--head') ?? 'HEAD',
    remote: get('--remote') ?? 'origin',
    noWait,
    waitMinutes,
  };
}

function formatRow(row) {
  const status = row.info ? 'INFO' : row.pass ? 'PASS' : 'FAIL';
  const lines = (row.lines ?? []).map((line) => `
      ${line}`).join('');
  return `${status}  ${row.name}  ${row.detail}${lines}`;
}

/** Runs all check rows and prints them; returns the process exit code. Exits 2, printing usage to
 * stderr and running no row, when a flag that takes a value is given without one or `--wait` is given
 * a value it cannot take (`parseArgs`). */
export async function main(argv = process.argv.slice(2), env = process.env, deps = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv, env);
  } catch (err) {
    console.error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const { cwd, home, push, head, remote, noWait, waitMinutes } = parsed;
  // A push runs only the Codex review row. The budget, payload and sensor rows read the working tree,
  // not the commit being pushed, and the pre-commit gate already ran them on every commit.
  const rows = push
    ? [checkCodexReviews(cwd, head, { ...deps, remote })]
    : [checkBudget(cwd), checkContracts(cwd), ...checkPayload(cwd, home)];

  // Guard against recursion: a sensor's suite may run check again (this repo's tests call `main`),
  // and that inner check must not spawn the sensors that are running it.
  // The sensors run under the machine's gate lock, taken in `home`, so two gates never run theirs
  // together. The inner check and a push run no sensor and so take no lock: the inner one could only
  // wait for the gate that runs it. Nor does a gate started by a process that holds the lock, which
  // says so with the mark of a held lock (`GATE_HELD_ENV`): it runs its sensors in that turn.
  // The gate of a commit that holds declared documents alone runs no sensor, and takes no lock either
  // (`checkSensors`); the rows above ran all the same, so a contract it breaks still fails it.
  if (!push && env.JS_HARNESS_CHECK_INNER !== '1') {
    const lock = env[GATE_HELD_ENV] === '1' ? { held: true } : { home, wait: !noWait, waitMinutes };
    rows.push(...(await checkSensors(cwd, deps, lock)));
    // `deps.gentleAi` stands in for `spawnSync` here only, so a test can fake gentle-ai without touching the sensors.
    rows.push(checkReview(cwd, { spawn: deps.gentleAi }));
  }
  // How much code waits for a Codex review, said at every commit and failing none: the row that fails is the
  // push's. It reads commits and records, never the working tree, so the inner run prints it as well.
  // `deps.git` stands in for `spawnSync` here and where a gate asks git what is staged (`checkSensors`),
  // since `deps.spawn` is what runs a sensor.
  if (!push) rows.push(checkCodexReviewDebt(cwd, { spawn: deps.git, remote }));

  for (const row of rows) {
    console.log(formatRow(row));
  }
  for (const row of rows) {
    if (row.output) console.log(`\n${row.output}`);
  }

  return rows.every((row) => row.pass) ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code));
}

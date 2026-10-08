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
import { codexReviewsPath, isValidCodexReview, NOTHING_TO_REVIEW, readCodexReviews } from './lib/codex-reviews.mjs';
import { leftOutOf, reviewScope } from './lib/codex-review-scope.mjs';
import { killSurvivors, killTree } from './lib/process-tree.mjs';

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

/** The project's sensors: named commands that must exit 0. `harness.json` `sensors` wins, which serves
 * any language; else the `test`, `lint` and `typecheck` scripts of `package.json`, run through npm so
 * `node_modules/.bin` is on the path. A file that is unreadable or of the wrong shape is an `error`,
 * never a silent skip: a gate that quietly ran nothing would look green. */
export function discoverSensors(cwd) {
  const none = { sensors: [], source: null };
  const harness = readJson(cwd, 'harness.json');
  if (harness?.error) return { ...none, error: harness.error };
  const declared = harness?.value;
  if (harness && !isObject(declared)) return { ...none, error: 'harness.json must be a JSON object' };
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
 * `killTree` and `killSurvivors` are injectable. */
export function runSensor(command, { cwd, env, timeout, killTree: tree = killTree, killSurvivors: survivors = killSurvivors }) {
  return new Promise((resolve) => {
    const out = { stdout: '', stderr: '' };
    let child;
    const startedAt = Date.now(); // before the spawn: the shell cannot have been created earlier
    try {
      child = spawnChild(command, { cwd, env, shell: true, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
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
      child.stdout.destroy();
      child.stderr.destroy();
      const error = extra ?? (timedOut ? Object.assign(new Error(`timed out after ${timeout} ms`), { code: 'ETIMEDOUT' }) : undefined);
      resolve({ ...exit, ...out, ...(error && { error }), ...(sweepError && { sweepError: sweepError.message }) });
    };
    for (const stream of ['stdout', 'stderr']) {
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

/** Runs one sensor's command in `cwd` through the shell and reports pass/fail. `spawn` may return a
 * plain result or a promise of one, so a test can stub it with either. */
export async function checkSensor(cwd, sensor, { spawn = runSensor, sensorTimeout = SENSOR_TIMEOUT_MS } = {}) {
  // The command runs against a throwaway home, so a test that forgets `--home` cannot write into
  // the real one — that happened once, and a rule in prose would not have stopped it.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-test-home-'));
  // npm keeps its cache and logs under %LOCALAPPDATA% on Windows, not under HOME, so `npm run` is
  // pointed into the throwaway home as well.
  const overrides = { JS_HARNESS_CHECK_INNER: '1', HOME: home, USERPROFILE: home, npm_config_cache: path.join(home, '.npm-cache') };
  // NODE_TEST_CONTEXT is set when check itself runs under `node --test`; the nested runner would act
  // as a child and skip files. Every case variant of an override goes too: Windows keeps the
  // uppercase one of two keys that differ only in case, and npm reads either.
  // Git's repository variables go as well: with the `GIT_DIR` a hook exports, a sensor's own `git init`
  // in a temp directory acts on the repository being committed to, and once left it bare.
  const replaced = new Set([...Object.keys(overrides), 'NODE_TEST_CONTEXT', ...GIT_LOCAL_ENV].map((key) => key.toLowerCase()));
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

/** One row per sensor, run one after another; a broken declaration is one FAIL row and no sensor at all
 * is one INFO row. */
export async function checkSensors(cwd, deps) {
  const { sensors, source, error } = discoverSensors(cwd);
  if (error) return [{ name: 'sensors', pass: false, detail: error }];
  if (sensors.length === 0) {
    const detail = source === 'harness.json'
      ? 'harness.json declares no sensors, so none ran'
      : 'no sensors declared: add test, lint or typecheck scripts to package.json, or a "sensors" object to harness.json';
    return [{ name: 'sensors', pass: true, info: true, detail }];
  }
  const rows = [];
  for (const sensor of sensors) rows.push(await checkSensor(cwd, sensor, deps));
  return rows;
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

/** Trimmed stdout of a successful `git <args>` run in `cwd`, else `null`. `input`, when given, is what
 * git reads on its standard input. */
function gitOut(spawn, cwd, args, input) {
  try {
    const result = spawn('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...(input !== undefined && { input }) });
    if (result && !result.error && result.status === 0) return result.stdout.trim();
  } catch {
    // No git on PATH: the caller reports the repository or revision as unresolvable.
  }
  return null;
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

/** Whether git exits 0 for `git <args>` in `cwd` (for the yes/no commands such as
 * `merge-base --is-ancestor`, where a non-zero exit is an answer, not a failure). */
function gitYes(spawn, cwd, args) {
  try {
    const result = spawn('git', args, { cwd, encoding: 'utf8' });
    return Boolean(result) && !result.error && result.status === 0;
  } catch {
    return false;
  }
}

/** The commits a valid `rec` covers, or `null` when its ids are not commits this repository knows. */
function coveredBy(spawn, cwd, rec) {
  const listed = gitOut(spawn, cwd, ['rev-list', `${rec.base}..${rec.head}`]);
  return listed === null ? null : new Set(listed.split('\n').filter(Boolean));
}

/** Which of `heads` (full commit ids) lie past `tip`, as `merge-base --is-ancestor <tip> <head>` says it:
 * the commits `tip` is an ancestor of, itself among them.
 *
 * One git process answers for them all, because the heads are those of every record ever written and this
 * runs at every commit: `rev-list --ancestry-path ^<tip> <heads>` lists the commits on a path from `tip` to
 * any of them, which holds a head past the tip and no other head. `--ignore-missing` passes over an id this
 * repository does not know, and the ids go on standard input, which no count of records makes too long for
 * a command line. Should git refuse that, each head is asked about on its own. */
function headsPastTip(spawn, cwd, tip, heads) {
  if (heads.length === 0) return new Set();
  const onPath = gitOut(spawn, cwd, ['rev-list', '--ancestry-path', '--ignore-missing', `^${tip}`, '--stdin'], `${heads.join('\n')}\n`);
  if (onPath === null) return new Set(heads.filter((head) => gitYes(spawn, cwd, ['merge-base', '--is-ancestor', tip, head])));
  const listed = new Set(onPath.split('\n'));
  return new Set(heads.filter((head) => head === tip || listed.has(head)));
}

/** What the Codex review records say of the code commits between the default branch of `remote` and
 * `head`, for the two rows that read it: the `--push` row, which fails on a commit no record covers, and
 * the row of the plain check, which says how large the review of those commits is.
 *
 * `{ unknown }` when it cannot be told: the `detail` and `lines` of the `--push` row and, where those words
 * speak of a push, the `why` of the plain one. Otherwise the commit `tip` that `head` names, the default
 * branch as the ref `baseRef` and its label `base`, the `codeCommits` of `base..tip` (newest first: every
 * non-merge commit that changes a file a review reads), the `covers` (each valid record that reaches
 * the range, with the commits it covers), the `uncovered` code commits, and the `note` that counts the
 * records that were left out.
 *
 * A file a review reads is one `js-harness codex-review` does not leave out, by the one definition the two
 * share (`./lib/codex-review-scope.mjs`): not a document, and not a path the project marks with
 * `-codex-review`. What is marked is read from the commit `tip`, for the paths of every commit under it in
 * one git process: the commit that is checked, never the tree or the index, which at a commit hold the
 * change being made. */
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

  // Every commit of the range, merges included: a record whose head is one is worth expanding.
  const inRange = gitOut(spawn, cwd, ['rev-list', `${baseRef}..${tip}`]);
  if (inRange === null) return unknown(`cannot list the commits in ${base}..${head}`);
  const rangeIds = new Set(inRange.split('\n').filter(Boolean));

  // `%x01` starts each commit; its `<id>\t<short id>\t<parents>\t<subject>` line (four fields, the
  // subject last so a tab inside it survives) is followed by the names of the files it changes. With `-z`
  // every name is written as it is and ends with a NUL, as the line of the commit does, with a newline
  // between that NUL and the first name. Without it git writes a name that holds a quote, a backslash, a
  // control character or a letter outside ASCII in quotes and escapes (a Markdown file then ends in
  // `.md"`), and that is not a path its attributes can be asked for.
  const log = gitOut(spawn, cwd, ['log', '-z', '--no-merges', '--name-only', '--format=%x01%H\t%h\t%P\t%s', `${baseRef}..${tip}`]);
  if (log === null) return unknown(`cannot list the commits in ${base}..${head}`);
  const commits = log
    .split('\x01')
    .filter(Boolean)
    .map((chunk) => {
      const [first, ...names] = chunk.split('\0');
      const [id, shortId, parents, ...subject] = first.split('\t');
      const files = names.map((name, at) => (at === 0 ? name.replace(/^\n/, '') : name)).filter(Boolean);
      return { id, shortId, isRoot: !parents, subject: subject.join('\t'), files };
    });
  const leftOut = leftOutOf(commits.flatMap((commit) => commit.files), { cwd, source: tip, spawn });
  if (leftOut === null) {
    return unknown(`cannot read which files of ${base}..${head} a Codex review leaves out (\`git check-attr --source\` failed; it needs git 2.40 or later)`);
  }
  const codeCommits = commits.filter((commit) => commit.files.some((file) => !leftOut.has(file)));

  const records = readCodexReviews(cwd, { spawn });
  const valid = records.filter(isValidCodexReview);
  const invalid = records.length - valid.length;
  // A record can cover part of the range only when its head is in it, or lies past the pushed tip
  // (a review of base..D still covers C when C is what is pushed). Any other record is unrelated,
  // and expanding it would cost one git process per record ever written.
  // A record of nothing to review is the exception to the second case: its range changes no file only
  // as a whole (a commit and its revert), so a tip short of its head pushes a patch nobody reviewed.
  const outside = (rec) => !rangeIds.has(rec.head);
  const mayLiePast = valid.filter((rec) => outside(rec) && rec.outcome !== NOTHING_TO_REVIEW);
  const pastTip = headsPastTip(spawn, cwd, tip, [...new Set(mayLiePast.map((rec) => rec.head))]);
  const covers = [];
  let ignored = 0;
  for (const rec of valid) {
    if (outside(rec) && (rec.outcome === NOTHING_TO_REVIEW || !pastTip.has(rec.head))) continue;
    const covered = coveredBy(spawn, cwd, rec);
    if (covered) covers.push({ rec, covered });
    else ignored += 1;
  }
  const noteParts = [
    invalid ? `${invalid} invalid record${invalid === 1 ? '' : 's'} ignored` : '',
    ignored ? `${ignored} record${ignored === 1 ? '' : 's'} ignored (base or head not found)` : '',
  ].filter(Boolean);
  const note = noteParts.length ? `; ${noteParts.join('; ')}` : '';

  const uncovered = codeCommits.filter((commit) => !covers.some(({ covered }) => covered.has(commit.id)));
  return { tip, baseRef, base, codeCommits, covers, uncovered, note };
}

// The outcomes of a record that is no review of Codex's, each with what a row calls it.
const NOT_A_REVIEW = { unavailable: 'unavailable', [NOTHING_TO_REVIEW]: 'nothing to review' };

/** The records of a coverage (`codexReviewCoverage`) that cover a code commit and are no review of Codex's. */
function notReviews({ covers, codeCommits }) {
  return covers
    .filter(({ rec, covered }) => Object.hasOwn(NOT_A_REVIEW, rec.outcome) && codeCommits.some((commit) => covered.has(commit.id)))
    .map(({ rec }) => rec);
}

/** What both rows say of a coverage that leaves no code commit uncovered, before its `note`. */
function coveredDetail({ codeCommits, base }) {
  return codeCommits.length
    ? `${codeCommits.length} code commit${codeCommits.length === 1 ? '' : 's'} since ${base}, all covered by a Codex review record`
    : `no code commits since ${base}`;
}

/** The `--push` row: every non-merge commit between the remote's default branch and `head` that
 * changes a file a review reads (not a document, not a path the project marks: `codexReviewCoverage`)
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
  const numstat = from === null ? null : gitOut(spawn, cwd, ['diff', '--numstat', '-z', '--no-renames', from, tip]);
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
 * covers it says how many they are and how large the review that covers them is today, which is that of the
 * range from the parent of the oldest one to `HEAD`, the range `js-harness codex-review --base <oldest>^`
 * reviews, without the files that review leaves out; and it names the command that prints the plan of that
 * review and starts nothing.
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
  // `git log` lists newest first, so the oldest uncovered commit is the last one. A root commit has no
  // `<id>^`: the push check names the default branch as the base that reaches it, and so does this.
  const oldest = uncovered[uncovered.length - 1];
  const baseArg = oldest.isRoot ? base : `${oldest.shortId}^`;
  const from = oldest.isRoot ? gitOut(spawn, cwd, ['merge-base', baseRef, tip]) : `${oldest.id}^`;
  const size = reviewSize(spawn, cwd, from, tip);
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
  'Usage: js-harness check [--cwd <path>] [--home <path>] [--remote <name>] | js-harness check --push [--head <rev>] [--remote <name>] [--cwd <path>]';

// A flag with no value (end of argv, or immediately followed by another `--flag`) is a usage
// error, not a silently-swallowed token that later crashes `path.join` with `undefined`.
class CheckArgError extends Error {}

function requireValue(argv, i, flag) {
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) throw new CheckArgError(`${flag} requires a value`);
  return value;
}

/** Parses `argv`, matching `doctor.mjs`'s precedence: `--home` flag, then `env.JS_HARNESS_HOME`,
 * then `os.homedir()`. Throws `CheckArgError` when `--cwd`/`--home`/`--head`/`--remote` is given without a value. */
function parseArgs(argv, env) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? requireValue(argv, i, flag) : undefined;
  };
  return {
    cwd: get('--cwd') ?? process.cwd(),
    home: get('--home') ?? env.JS_HARNESS_HOME ?? os.homedir(),
    push: argv.includes('--push'),
    head: get('--head') ?? 'HEAD',
    remote: get('--remote') ?? 'origin',
  };
}

function formatRow(row) {
  const status = row.info ? 'INFO' : row.pass ? 'PASS' : 'FAIL';
  const lines = (row.lines ?? []).map((line) => `
      ${line}`).join('');
  return `${status}  ${row.name}  ${row.detail}${lines}`;
}

/** Runs all check rows and prints them; returns the process exit code. Exits 2, printing usage to
 * stderr and running no row, when `--cwd`/`--home`/`--head`/`--remote` is given without a value. */
export async function main(argv = process.argv.slice(2), env = process.env, deps = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv, env);
  } catch (err) {
    console.error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const { cwd, home, push, head, remote } = parsed;
  // A push runs only the Codex review row. The budget, payload and sensor rows read the working tree,
  // not the commit being pushed, and the pre-commit gate already ran them on every commit.
  const rows = push
    ? [checkCodexReviews(cwd, head, { ...deps, remote })]
    : [checkBudget(cwd), checkContracts(cwd), ...checkPayload(cwd, home)];

  // Guard against recursion: a sensor's suite may run check again (this repo's tests call `main`),
  // and that inner check must not spawn the sensors that are running it.
  if (!push && env.JS_HARNESS_CHECK_INNER !== '1') {
    rows.push(...(await checkSensors(cwd, deps)));
    // `deps.gentleAi` stands in for `spawnSync` here only, so a test can fake gentle-ai without touching the sensors.
    rows.push(checkReview(cwd, { spawn: deps.gentleAi }));
  }
  // How much code waits for a Codex review, said at every commit and failing none: the row that fails is the
  // push's. It reads commits and records, never the working tree, so the inner run prints it as well.
  // `deps.git` stands in for `spawnSync` here only, since `deps.spawn` is what runs a sensor.
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

#!/usr/bin/env node
// The one gate a pre-commit hook and CI both run. Zero deps, plain Node.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { estimateTokens, measurePayload } from './lib/payload.mjs';
import { discoverContracts, validateEntries } from './contract.mjs';
import { codexReviewsPath, isValidCodexReview, readCodexReviews } from './lib/codex-reviews.mjs';

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
    const hooks = host.hooks.map((h) => `hook ${h.event.padEnd(16)} ${h.command}`);
    const detail = `${host.total} estimated tokens per turn from files (tools and hook output not counted)`;
    return { name: `payload ${host.host}`, pass: true, info: true, detail, lines: [...sources, ...hooks] };
  });
}

const NPM_PLACEHOLDER_TEST = 'echo "Error: no test specified" && exit 1';

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

/** Runs one sensor's command in `cwd` through the shell and reports pass/fail. */
export function checkSensor(cwd, sensor, { spawn = spawnSync } = {}) {
  // The command runs against a throwaway home, so a test that forgets `--home` cannot write into
  // the real one — that happened once, and a rule in prose would not have stopped it.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-test-home-'));
  // npm keeps its cache and logs under %LOCALAPPDATA% on Windows, not under HOME, so `npm run` is
  // pointed into the throwaway home as well.
  const overrides = { JS_HARNESS_CHECK_INNER: '1', HOME: home, USERPROFILE: home, npm_config_cache: path.join(home, '.npm-cache') };
  // NODE_TEST_CONTEXT is set when check itself runs under `node --test`; the nested runner would act
  // as a child and skip files. Every case variant of an override goes too: Windows keeps the
  // uppercase one of two keys that differ only in case, and npm reads either.
  const replaced = new Set([...Object.keys(overrides), 'NODE_TEST_CONTEXT'].map((key) => key.toLowerCase()));
  const inherited = Object.entries(process.env).filter(([key]) => !replaced.has(key.toLowerCase()));
  const env = { ...Object.fromEntries(inherited), ...overrides };
  let result;
  try {
    result = spawn(sensor.command, { cwd, env, encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
  const { name, command } = sensor;
  const pass = !result.error && result.status === 0;
  let detail = `${command} passed`;
  if (result.error) detail = `${command} could not run: ${result.error.message}`;
  else if (result.status === null && result.signal) detail = `${command} was killed by ${result.signal}`;
  else if (!pass) detail = `${command} exited ${result.status}`;
  // Keep the runner's own report, even what it printed before a spawn error such as ENOBUFS, so a
  // red row says which test failed, not just that one did.
  return { name, pass, detail, output: pass ? '' : `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/** One row per sensor; a broken declaration is one FAIL row and no sensor at all is one INFO row. */
export function checkSensors(cwd, deps) {
  const { sensors, source, error } = discoverSensors(cwd);
  if (error) return [{ name: 'sensors', pass: false, detail: error }];
  if (sensors.length === 0) {
    const detail = source === 'harness.json'
      ? 'harness.json declares no sensors, so none ran'
      : 'no sensors declared: add test, lint or typecheck scripts to package.json, or a "sensors" object to harness.json';
    return [{ name: 'sensors', pass: true, info: true, detail }];
  }
  return sensors.map((sensor) => checkSensor(cwd, sensor, deps));
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
  const reasons = (Array.isArray(assessed.reasons) ? assessed.reasons : []).filter(isObject);
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

/** Trimmed stdout of a successful `git <args>` run in `cwd`, else `null`. */
function gitOut(spawn, cwd, args) {
  try {
    const result = spawn('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
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

/** The `--push` row: every non-merge commit between the remote's default branch and `head` that
 * changes a file other than Markdown must lie in a range some `codex-review` record covers (either
 * outcome: an `unavailable` record is an explicit, listed skip). Plain `check` never runs it, because
 * a slice under gentle-ai's review budget is committed before it is reviewed. */
export function checkCodexReviews(cwd, head = 'HEAD', { spawn = spawnSync, remote = 'origin' } = {}) {
  const name = 'codex-review';
  const fail = (detail, lines) => ({ name, pass: false, detail, ...(lines ? { lines } : {}) });
  const tip = gitOut(spawn, cwd, ['rev-parse', '--verify', '--quiet', `${head}^{commit}`]);
  if (!tip) {
    return fail(gitOut(spawn, cwd, ['rev-parse', '--git-dir']) === null ? `${cwd} is not a git repository` : `cannot resolve --head ${head} to a commit`);
  }
  // Git hands a hook the URL, not a name, when the push names a URL: no ref of it can exist.
  const remotes = gitOut(spawn, cwd, ['remote'])?.split('\n').map((line) => line.trim()) ?? [];
  if (!remotes.includes(remote)) {
    return fail(`${remote} is not a configured remote, so there is no default branch to compare against`, [
      'push through a configured remote: git remote add <name> <url>, then git push <name> ...',
      'or name one that exists: js-harness check --push --remote <name>',
    ]);
  }
  const branch = defaultBranch(spawn, cwd, remote);
  if (!branch) {
    return fail(
      `no default branch of ${remote} to compare against (refs/remotes/${remote}/HEAD, ${remote}/main or ${remote}/master), so there is no range to check`,
      [`set it with: git remote set-head ${remote} --auto`],
    );
  }
  const { ref: baseRef, label: base } = branch;

  // Every commit of the range, merges included: a record whose head is one is worth expanding.
  const inRange = gitOut(spawn, cwd, ['rev-list', `${baseRef}..${tip}`]);
  if (inRange === null) return fail(`cannot list the commits in ${base}..${head}`);
  const rangeIds = new Set(inRange.split('\n').filter(Boolean));

  // `%x01` starts each commit; its `<id>\t<short id>\t<parents>\t<subject>` line (four fields, the
  // subject last so a tab inside it survives) is followed by the names of the files it changes.
  const log = gitOut(spawn, cwd, ['-c', 'core.quotePath=false', 'log', '--no-merges', '--name-only', '--format=%x01%H\t%h\t%P\t%s', `${baseRef}..${tip}`]);
  if (log === null) return fail(`cannot list the commits in ${base}..${head}`);
  const codeCommits = log
    .split('\x01')
    .filter(Boolean)
    .map((chunk) => {
      const [first, ...files] = chunk.split('\n');
      const [id, shortId, parents, ...subject] = first.split('\t');
      return { id, shortId, isRoot: !parents, subject: subject.join('\t'), files: files.map((f) => f.trim()).filter(Boolean) };
    })
    // git C-quotes a path holding a quote, a backslash or a control character (`core.quotePath=false`
    // only stops it quoting non-ASCII), wrapping it in `"`: a Markdown file may end in `.md"`.
    .filter((commit) => commit.files.some((file) => !/\.md"?$/i.test(file)));

  const records = readCodexReviews(cwd, { spawn });
  const covers = [];
  let ignored = 0;
  let invalid = 0;
  for (const rec of records) {
    if (!isValidCodexReview(rec)) {
      invalid += 1;
      continue;
    }
    // A record can cover part of the range only when its head is in it, or lies past the pushed tip
    // (a review of base..D still covers C when C is what is pushed). Any other record is unrelated,
    // and expanding it would cost one git process per record ever written.
    if (!rangeIds.has(rec.head) && !gitYes(spawn, cwd, ['merge-base', '--is-ancestor', tip, rec.head])) continue;
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
  if (uncovered.length) {
    // `git log` lists newest first, so the oldest uncovered commit is the last one.
    const oldest = uncovered[uncovered.length - 1];
    // A root commit has no `<id>^` to use as a base; a range from the unrelated default branch does
    // reach it, and `--unavailable` records a skip instead of a review.
    const hint = oldest.isRoot
      ? `${oldest.shortId} is a root commit, so ${oldest.shortId}^ does not exist; a range from the default branch reaches it: js-harness codex-review --base ${base} (add --unavailable <reason> to record a skip instead)`
      : `record the review with: js-harness codex-review --base ${oldest.shortId}^`;
    const lines = [...uncovered.map((commit) => `${commit.shortId} ${commit.subject}`), hint];
    return fail(`${uncovered.length} of ${codeCommits.length} code commit${codeCommits.length === 1 ? '' : 's'} since ${base} have no Codex review record (${codexReviewsPath(cwd, { spawn }) ?? 'no record file'})${note}`, lines);
  }

  const skips = covers
    .filter(({ rec, covered }) => rec.outcome === 'unavailable' && codeCommits.some((commit) => covered.has(commit.id)))
    .map(({ rec }) => `unavailable ${rec.base.slice(0, 7)}..${rec.head.slice(0, 7)}: ${rec.reason ?? 'no reason given'}`);
  const detail = codeCommits.length
    ? `${codeCommits.length} code commit${codeCommits.length === 1 ? '' : 's'} since ${base}, all covered by a Codex review record${note}`
    : `no code commits since ${base}${note}`;
  return { name, pass: true, detail, ...(skips.length ? { lines: skips } : {}) };
}

const USAGE =
  'Usage: js-harness check [--cwd <path>] [--home <path>] | js-harness check --push [--head <rev>] [--remote <name>] [--cwd <path>]';

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
    rows.push(...checkSensors(cwd, deps));
    // `deps.gentleAi` stands in for `spawnSync` here only, so a test can fake gentle-ai without touching the sensors.
    rows.push(checkReview(cwd, { spawn: deps.gentleAi }));
  }

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

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

/** Runs `node --test` in `cwd` as a child process and reports pass/fail. */
export function checkTests(cwd) {
  // The suite runs against a throwaway home, so a test that forgets `--home` cannot write into
  // the real one — that happened once, and a rule in prose would not have stopped it.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-test-home-'));
  const env = { ...process.env, JS_HARNESS_CHECK_INNER: '1', HOME: home, USERPROFILE: home };
  // Set when check itself runs under `node --test`; the nested runner would act as a child and skip files.
  delete env.NODE_TEST_CONTEXT;
  let result;
  try {
    result = spawnSync(process.execPath, ['--test'], { cwd, env, encoding: 'utf8' });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
  const pass = result.status === 0;
  const detail = pass ? 'node --test passed' : `node --test exited ${result.status}`;
  // Keep the runner's own report so a red row says which test failed, not just that one did.
  return { name: 'tests', pass, detail, output: pass ? '' : `${result.stdout}${result.stderr}` };
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
  // A push runs only the Codex review row. The budget, payload and test rows read the working tree,
  // not the commit being pushed, and the pre-commit gate already ran them on every commit.
  const rows = push
    ? [checkCodexReviews(cwd, head, { ...deps, remote })]
    : [checkBudget(cwd), checkContracts(cwd), ...checkPayload(cwd, home)];

  // Guard against recursion: the inner `node --test` this spawns must not spawn its own.
  if (!push && env.JS_HARNESS_CHECK_INNER !== '1') {
    rows.push(checkTests(cwd));
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

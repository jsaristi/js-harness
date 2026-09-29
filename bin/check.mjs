#!/usr/bin/env node
// The one gate a pre-commit hook and CI both run. Zero deps, plain Node.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { estimateTokens, measurePayload } from './lib/payload.mjs';
import { codexReviewsPath, readCodexReviews } from './lib/codex-reviews.mjs';

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

/** The branch a push is measured against: what `origin/HEAD` points at, else `main`, else
 * `master`; `null` when none of them resolves to a commit. */
function defaultBranch(spawn, cwd) {
  const resolves = (rev) => gitOut(spawn, cwd, ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`]);
  const origin = gitOut(spawn, cwd, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']);
  const candidates = [origin?.replace(/^refs\/remotes\//, ''), 'main', 'master'].filter(Boolean);
  return candidates.find((rev) => resolves(rev)) ?? null;
}

const FULL_ID = /^[0-9a-f]{40,64}$/;

/** The commits `rec` covers, or `null` when its ids are not commit ids this repository knows. An id
 * is matched against a strict pattern first, so a hand-edited record cannot smuggle in an option. */
function coveredBy(spawn, cwd, rec) {
  if (!FULL_ID.test(rec.base ?? '') || !FULL_ID.test(rec.head ?? '')) return null;
  const listed = gitOut(spawn, cwd, ['rev-list', `${rec.base}..${rec.head}`]);
  return listed === null ? null : new Set(listed.split('\n').filter(Boolean));
}

/** The `--push` row: every non-merge commit between the default branch and `head` that changes a
 * file other than Markdown must lie in a range some `codex-review` record covers (either outcome:
 * an `unavailable` record is an explicit, listed skip). Plain `check` never runs it, because a slice
 * under gentle-ai's review budget is committed before it is reviewed. */
export function checkCodexReviews(cwd, head = 'HEAD', { spawn = spawnSync } = {}) {
  const name = 'codex-review';
  const fail = (detail, lines) => ({ name, pass: false, detail, ...(lines ? { lines } : {}) });
  const tip = gitOut(spawn, cwd, ['rev-parse', '--verify', '--quiet', `${head}^{commit}`]);
  if (!tip) {
    return fail(gitOut(spawn, cwd, ['rev-parse', '--git-dir']) === null ? `${cwd} is not a git repository` : `cannot resolve --head ${head} to a commit`);
  }
  const base = defaultBranch(spawn, cwd);
  if (!base) return fail('no default branch found (origin/HEAD, main or master), so there is no range to check');

  // `%x01` starts each commit; the file names follow its `<short id>\t<subject>` line.
  const log = gitOut(spawn, cwd, ['-c', 'core.quotePath=false', 'log', '--no-merges', '--name-only', '--format=%x01%H\t%h\t%s', `${base}..${tip}`]);
  if (log === null) return fail(`cannot list the commits in ${base}..${head}`);
  const codeCommits = log
    .split('\x01')
    .filter(Boolean)
    .map((chunk) => {
      const [first, ...files] = chunk.split('\n');
      const [id, shortId, ...subject] = first.split('\t');
      return { id, shortId, subject: subject.join('\t'), files: files.map((f) => f.trim()).filter(Boolean) };
    })
    .filter((commit) => commit.files.some((file) => !/\.md"?$/i.test(file)));

  const records = readCodexReviews(cwd, { spawn });
  const covers = [];
  let ignored = 0;
  for (const rec of records) {
    const covered = coveredBy(spawn, cwd, rec);
    if (covered) covers.push({ rec, covered });
    else ignored += 1;
  }
  const note = ignored ? `; ${ignored} record${ignored === 1 ? '' : 's'} ignored (base or head not found)` : '';

  const uncovered = codeCommits.filter((commit) => !covers.some(({ covered }) => covered.has(commit.id)));
  if (uncovered.length) {
    const oldest = uncovered[uncovered.length - 1];
    const lines = [
      ...uncovered.map((commit) => `${commit.shortId} ${commit.subject}`),
      `record the review with: js-harness codex-review --base ${oldest.shortId}^`,
    ];
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

const USAGE = 'Usage: js-harness check [--cwd <path>] [--home <path>] [--push [--head <rev>]]';

// A flag with no value (end of argv, or immediately followed by another `--flag`) is a usage
// error, not a silently-swallowed token that later crashes `path.join` with `undefined`.
class CheckArgError extends Error {}

function requireValue(argv, i, flag) {
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) throw new CheckArgError(`${flag} requires a value`);
  return value;
}

/** Parses `argv`, matching `doctor.mjs`'s precedence: `--home` flag, then `env.JS_HARNESS_HOME`,
 * then `os.homedir()`. Throws `CheckArgError` when `--cwd`/`--home`/`--head` is given without a value. */
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
  };
}

function formatRow(row) {
  const status = row.info ? 'INFO' : row.pass ? 'PASS' : 'FAIL';
  const lines = (row.lines ?? []).map((line) => `
      ${line}`).join('');
  return `${status}  ${row.name}  ${row.detail}${lines}`;
}

/** Runs all check rows and prints them; returns the process exit code. Exits 2, printing usage to
 * stderr and running no row, when `--cwd`/`--home`/`--head` is given without a value. */
export async function main(argv = process.argv.slice(2), env = process.env, deps = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv, env);
  } catch (err) {
    console.error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const { cwd, home, push, head } = parsed;
  const rows = [checkBudget(cwd), ...checkPayload(cwd, home)];
  // Only a push is held to the Codex review record; the pre-commit gate stays as it was.
  if (push) rows.push(checkCodexReviews(cwd, head, deps));

  // Guard against recursion: the inner `node --test` this spawns must not spawn its own.
  if (env.JS_HARNESS_CHECK_INNER !== '1') {
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

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendCodexReviewRun, codexReviewRunsPath, readCodexReviewRuns, CODEX_REVIEW_RUN_SCHEMA } from './codex-review-runs.mjs';
import { appendCodexReview, codexReviewsPath, isValidCodexReview, readCodexReviews, CODEX_REVIEW_SCHEMA } from './codex-reviews.mjs';

// Real git in every test, isolated from the host's config like codex-reviews.test.mjs does.
let configDir;
const made = [];
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-codex-review-runs-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
after(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function tmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(dir);
  return dir;
}

function makeRepo() {
  const root = tmp('js-harness-codex-review-runs-');
  git(root, 'init');
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  fs.writeFileSync(path.join(root, 'f.txt'), 'x', 'utf8');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'init');
  return root;
}

const run = {
  schema: CODEX_REVIEW_RUN_SCHEMA,
  id: '00000000-0000-4000-8000-000000000001',
  startedAt: '2026-10-06T00:00:00.000Z',
  durationMs: 107000,
  base: 'a'.repeat(40),
  from: 'a'.repeat(40),
  head: 'b'.repeat(40),
  outcome: 'reviewed',
  cli: '0.160.0',
  model: null,
  effort: null,
  usage: { inputTokens: 297479, cachedInputTokens: 240640, outputTokens: 2396, reasoningOutputTokens: 703 },
  turns: 1,
  items: { agent_message: 1, command_execution: 6 },
  commands: { total: 6, failed: 0 },
  coverage: { seen: 2, total: 2 },
};

test('the schema of a run line is its own, apart from the review record\'s', () => {
  assert.equal(CODEX_REVIEW_RUN_SCHEMA, 'js-harness.codex-review-run/v1');
  assert.notEqual(CODEX_REVIEW_RUN_SCHEMA, CODEX_REVIEW_SCHEMA);
});

test('the run log lives in the git common dir beside the review record, so no file joins the working tree', () => {
  const root = makeRepo();
  const file = codexReviewRunsPath(root);
  assert.equal(path.basename(file), 'codex-review-runs.jsonl');
  assert.equal(path.dirname(file), path.dirname(codexReviewsPath(root)));
  assert.equal(fs.realpathSync(path.dirname(path.dirname(file))), fs.realpathSync(path.join(root, '.git')));
  appendCodexReviewRun(root, run);
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('outside a git repository there is no run log path', () => {
  assert.equal(codexReviewRunsPath(tmp('js-harness-codex-review-runs-nongit-')), null);
});

test('append creates the js-harness dir, writes one JSON line per run in order, and returns the path it wrote', () => {
  const root = makeRepo();
  const file = appendCodexReviewRun(root, run);
  assert.equal(file, codexReviewRunsPath(root));
  const failed = { ...run, id: '00000000-0000-4000-8000-000000000002', outcome: 'failed', reason: 'it exited 1' };
  appendCodexReviewRun(root, failed);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[2], '');
  assert.deepEqual(JSON.parse(lines[0]), run);
  assert.deepEqual(Object.keys(JSON.parse(lines[0])), Object.keys(run), 'the fields keep the order they were given in');
  assert.deepEqual(readCodexReviewRuns(root), [run, failed]);
});

test('an append after an unterminated last line starts on a new line, so the new run survives', () => {
  const root = makeRepo();
  const file = appendCodexReviewRun(root, run);
  fs.appendFileSync(file, '{"schema":"js-harness.codex-review-run/v1","id":"dead', 'utf8');
  const later = { ...run, id: '00000000-0000-4000-8000-000000000003' };
  appendCodexReviewRun(root, later);
  assert.deepEqual(readCodexReviewRuns(root), [run, later]);
  assert.equal(fs.readFileSync(file, 'utf8').endsWith('\n'), true);
});

test('append outside a git repository throws instead of writing somewhere else', () => {
  assert.throws(() => appendCodexReviewRun(tmp('js-harness-codex-review-runs-nongit-'), run), /git/i);
});

test('reading with no file yet, or outside a git repository, gives an empty list', () => {
  assert.deepEqual(readCodexReviewRuns(makeRepo()), []);
  assert.deepEqual(readCodexReviewRuns(tmp('js-harness-codex-review-runs-nongit-')), []);
});

test('the reader skips blank and malformed lines without throwing', () => {
  const root = makeRepo();
  const file = appendCodexReviewRun(root, run);
  fs.appendFileSync(file, '\n   \nnot json\n{"truncated":\n"a string"\n[1]\nnull\n', 'utf8');
  appendCodexReviewRun(root, { ...run, id: '00000000-0000-4000-8000-000000000004' });
  assert.deepEqual(readCodexReviewRuns(root).map((line) => line.id), [run.id, '00000000-0000-4000-8000-000000000004']);
});

test("a linked worktree shares the clone's one run log", () => {
  const root = makeRepo();
  const worktree = path.join(tmp('js-harness-codex-review-runs-wt-'), 'wt');
  git(root, 'worktree', 'add', worktree, '-b', 'other');
  appendCodexReviewRun(root, run);
  // Compare real paths: Windows may spell the same temp dir with a short or a long name.
  const dirOf = (r) => fs.realpathSync(path.dirname(codexReviewRunsPath(r)));
  assert.equal(dirOf(worktree), dirOf(root));
  assert.deepEqual(readCodexReviewRuns(worktree), [run]);
});

test('a run line is never evidence of a review: it is not a valid record, and the record file does not hold it', () => {
  const root = makeRepo();
  appendCodexReviewRun(root, run);
  assert.equal(isValidCodexReview(run), false);
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
  assert.deepEqual(readCodexReviews(root), []);
});

test('deleting the one file undoes the run log and leaves the review record alone', () => {
  const root = makeRepo();
  const review = { schema: CODEX_REVIEW_SCHEMA, base: run.base, head: run.head, reviewedAt: '2026-10-06T00:01:47.000Z', outcome: 'reviewed', run: run.id };
  appendCodexReview(root, review);
  fs.rmSync(appendCodexReviewRun(root, run));
  assert.deepEqual(readCodexReviewRuns(root), []);
  assert.deepEqual(readCodexReviews(root), [review]);
  assert.equal(isValidCodexReview(review), true, 'a record that names its run is still a valid record');
});

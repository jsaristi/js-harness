import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { reviewCoverage } from './codex-review-coverage.mjs';
import { appendCodexReview, CODEX_REVIEW_SCHEMA } from './codex-reviews.mjs';
import { appendCodexReviewRun, CODEX_REVIEW_RUN_SCHEMA } from './codex-review-runs.mjs';
import { mergeTurn } from './codex-review-turns.mjs';

// Real git in every test, isolated from the host's config: where a review of a range holding a merge of
// the default branch below HEAD is cut into turns (odd/tasks/merge-below-head.md, S1).
let configDir;
const made = [];
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-turns-gitconfig-'));
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

function commit(root, file, content, message) {
  fs.writeFileSync(path.join(root, file), content, 'utf8');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', message);
  return git(root, 'rev-parse', 'HEAD');
}

function record(root, base, head, extra = {}) {
  appendCodexReview(root, { schema: CODEX_REVIEW_SCHEMA, base, head, reviewedAt: '2026-10-16T00:00:00.000Z', outcome: 'reviewed', ...extra });
}

/** A branch `feat` off `first`: c1, then M, a merge of `trunk` (where `origin/main` points) with a line
 * of `m.js` resolved by hand, then c2. `before` runs on the branch before c1 is made. */
function branchWithMerge({ before: setUp = () => {}, alsoWritten = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-turns-'));
  made.push(root);
  git(root, 'init', '-q');
  git(root, 'symbolic-ref', 'HEAD', 'refs/heads/trunk');
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  const first = commit(root, 'm.js', 'base\n', 'init');
  git(root, 'checkout', '-q', '-b', 'feat');
  setUp(root);
  const c1 = commit(root, 'm.js', 'mine\n', 'feat: mine');
  git(root, 'checkout', '-q', 'trunk');
  const side = commit(root, 'm.js', 'main moves\n', 'feat: main moves');
  git(root, 'remote', 'add', 'origin', 'https://example.invalid/js-harness-test.git');
  git(root, 'update-ref', 'refs/remotes/origin/main', side);
  git(root, 'checkout', '-q', 'feat');
  spawnSync('git', ['merge', '--no-ff', '--no-commit', 'trunk'], { cwd: root, encoding: 'utf8' });
  fs.writeFileSync(path.join(root, 'm.js'), 'both\n', 'utf8');
  for (const [file, content] of Object.entries(alsoWritten)) fs.writeFileSync(path.join(root, file), content, 'utf8');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'merge trunk');
  const merge = git(root, 'rev-parse', 'HEAD');
  const c2 = commit(root, 'n.js', 'after\n', 'feat: after the merge');
  return { root, first, c1, side, merge, c2 };
}

// From the commit of the default branch the merge brought, as `codex-review --base origin/main` takes it: the
// commits of that branch have their records where they were made, and are in no range from it.
const turnOf = (root, from, tip) => mergeTurn(root, { given: from, tip, uncovered: reviewCoverage(root, { from, tip }).uncovered });

test('a merge of the default branch below HEAD, after commits that each have a record, is where the review is cut', () => {
  const { root, first, c1, side, merge, c2 } = branchWithMerge();
  record(root, first, c1);
  const turn = turnOf(root, side, c2);
  assert.deepEqual(turn && { merge: turn.merge, from: turn.from, side: turn.side, branch: turn.branch, auto: /^[0-9a-f]{40}$/.test(turn.auto) }, { merge, from: c1, side, branch: 'origin/main', auto: true });
});

test('a merge at HEAD is no cut: the review of a merge at HEAD reads it already', () => {
  const { root, first, c1, side, merge } = branchWithMerge();
  record(root, first, c1);
  assert.equal(turnOf(root, side, merge), null);
});

test('a merge with a commit before it that no record covers is no cut: that commit would be reviewed below HEAD', () => {
  const { root, side, c2 } = branchWithMerge();
  assert.equal(turnOf(root, side, c2), null);
});

test('a merge whose first parent ends a review that owes a correction is no cut: the next review is its recheck', () => {
  const { root, first, c1, side, c2 } = branchWithMerge();
  record(root, first, c1, { run: 'r1' });
  const finding = { file: 'm.js', start: 1, end: 1, severity: 'P1', title: 'The line is lost.', body: 'It is.', confidence: 0.9 };
  appendCodexReviewRun(root, { schema: CODEX_REVIEW_RUN_SCHEMA, id: 'r1', outcome: 'reviewed', answer: { findings: [finding], verdict: 'incorrect' } });
  assert.equal(turnOf(root, side, c2), null);
  // The same review, correct and with nothing found, owes nothing: the merge is cut again.
  const clean = branchWithMerge();
  record(clean.root, clean.first, clean.c1, { run: 'r1' });
  appendCodexReviewRun(clean.root, { schema: CODEX_REVIEW_RUN_SCHEMA, id: 'r1', outcome: 'reviewed', answer: { findings: [], verdict: 'correct' } });
  assert.equal(turnOf(clean.root, clean.side, clean.c2)?.merge, clean.merge);
});

test('a merge whose written file is marked at the merge and not at HEAD is no cut: its lines would be in neither turn', () => {
  const marked = (root) => commit(root, '.gitattributes', 'w.js -codex-review\n', 'chore: mark w.js');
  const { root, first, c1, side, c2 } = branchWithMerge({ before: marked, alsoWritten: { 'w.js': 'written in the merge\n' } });
  record(root, first, c1);
  // At c2 the mark is still there: alike at the merge and at HEAD, so the cut stands.
  assert.notEqual(turnOf(root, side, c2), null);
  const unmarked = commit(root, '.gitattributes', '', 'chore: unmark w.js');
  assert.equal(turnOf(root, side, unmarked), null);
});

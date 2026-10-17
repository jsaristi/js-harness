import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { reviewCoverage } from './codex-review-coverage.mjs';
import { leftOutSaid } from './codex-review-scope.mjs';
import { appendCodexReview, CODEX_REVIEW_SCHEMA } from './codex-reviews.mjs';
import { appendCodexReviewRun, CODEX_REVIEW_RUN_SCHEMA } from './codex-review-runs.mjs';
import { addTurnWorktree, mergeTurn, PART_AS_CHANGED_LINES, plansAsOne, removeTurnWorktree, sweepTurnWorktrees, TURN_WORKTREE_MAX_AGE_MS, turnsCheaper } from './codex-review-turns.mjs';

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
 * of `m.js` resolved by hand, then c2. `before` runs on the branch before c1 is made, `afterMine` after it. */
function branchWithMerge({ before: setUp = () => {}, afterMine = () => {}, alsoWritten = {} } = {}) {
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
  afterMine(root);
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

test('a merge after a document commit that follows a review owing a correction is no cut: the recheck reads past documents, as a run does (verifier B1)', () => {
  const docs = (root) => commit(root, 'notes.md', 'a note\n', 'docs: a note');
  const { root, first, c1, side, c2 } = branchWithMerge({ afterMine: docs });
  record(root, first, c1, { run: 'r1' });
  const finding = { file: 'm.js', start: 1, end: 1, severity: 'P1', title: 'The line is lost.', body: 'It is.', confidence: 0.9 };
  appendCodexReviewRun(root, { schema: CODEX_REVIEW_RUN_SCHEMA, id: 'r1', outcome: 'reviewed', answer: { findings: [finding], verdict: 'incorrect' } });
  assert.equal(turnOf(root, side, c2), null);
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

test('two turns are taken only when they cost less than the one review left today, a part counted as 100 changed lines (S9)', () => {
  // Today 1 part of 304 lines (404); the turns 1 part of 4 and 1 of 2 (206): cut.
  assert.equal(turnsCheaper({ parts: 1, changedLines: 304 }, [{ parts: 1, changedLines: 4 }, { parts: 1, changedLines: 2 }]), true);
  // Today 1 part of 4 lines (104): the second session costs more than every line it saves.
  assert.equal(turnsCheaper({ parts: 1, changedLines: 4 }, [{ parts: 1, changedLines: 4 }, { parts: 1, changedLines: 2 }]), false);
  // A tie is no cut: the run stays one review.
  assert.equal(turnsCheaper({ parts: 1, changedLines: PART_AS_CHANGED_LINES }, [{ parts: 1, changedLines: 0 }, { parts: 1, changedLines: 0 }]), false);
});

test('the plans of two turns are held to the bound of parts and the allowance as one plan: the parts, lines and estimates add up', () => {
  const plan = (range, parts, inputTokens, maxParts = 3) => ({ range, parts: parts.map((changedLines, at) => ({ index: at + 1, of: parts.length, files: 1, changedLines })), files: parts.length, changedLines: parts.reduce((a, b) => a + b, 0), inputTokens, inputTokensHigh: inputTokens === null ? null : inputTokens * 2, maxParts, over: false, leftOut: null });
  const one = plansAsOne([plan('aaaaaaa..bbbbbbb', [4, 5], 100), plan('bbbbbbb..ccccccc', [2, 1], 50)]);
  assert.deepEqual(
    { range: one.range, parts: one.parts.map((part) => `${part.index}/${part.of}:${part.changedLines}`), files: one.files, changedLines: one.changedLines, inputTokens: one.inputTokens, high: one.inputTokensHigh, over: one.over },
    { range: 'aaaaaaa..ccccccc', parts: ['1/4:4', '2/4:5', '3/4:2', '4/4:1'], files: 4, changedLines: 12, inputTokens: 150, high: 300, over: true },
  );
  assert.equal(plansAsOne([plan('a..b', [1], 100), plan('b..c', [1], null)]).inputTokens, null, 'no estimate when a turn has none');
  // What both turns leave out adds up by kind, in the shape `leftOutSaid` reads (Codex, part 2).
  const leaving = (documents, marked) => ({ ...plan('a..b', [1], 100), leftOut: { files: documents + marked, changedLines: 10 * (documents + marked), documents: { files: documents, changedLines: 10 * documents }, marked: { files: marked, changedLines: 10 * marked } } });
  const both = plansAsOne([leaving(1, 0), leaving(2, 1)]);
  assert.deepEqual(both.leftOut, { files: 4, changedLines: 40, documents: { files: 3, changedLines: 30 }, marked: { files: 1, changedLines: 10 } });
  assert.notEqual(leftOutSaid(both.leftOut), 'nothing');
});

test('a turn worktree whose run is gone is removed by the next run, and one whose run is going is left to it (S7)', () => {
  const { root, merge } = branchWithMerge();
  const commonGitDir = path.join(root, '.git');
  const gone = addTurnWorktree(root, merge, { commonGitDir, pid: 111, now: () => 1 });
  const going = addTurnWorktree(root, merge, { commonGitDir, pid: 222, now: () => 2 });
  assert.ok(fs.existsSync(path.join(gone, 'm.js')) && fs.existsSync(path.join(going, 'm.js')), 'both were made, at the merge');
  sweepTurnWorktrees(root, { commonGitDir, running: (pid) => pid === 222, now: () => 3 });
  assert.deepEqual([fs.existsSync(gone), fs.existsSync(going)], [false, true]);
  // A folder that cannot be removed throws nothing: the removal runs in a `finally` (gentle-ai, R3/R4).
  assert.doesNotThrow(() => removeTurnWorktree(root, going, { rm: () => { throw new Error('EBUSY'); } }));
  removeTurnWorktree(root, going);
  assert.equal(fs.existsSync(going), false);
  // git holds no worktree of either: only the checkout itself is listed.
  assert.equal(git(root, 'worktree', 'list', '--porcelain').split('\n').filter((line) => line.startsWith('worktree ')).length, 1);
});

test('a turn worktree older than a turn can last is removed though a process of its pid runs: the pid was reused (gentle-ai R4, PR 338)', () => {
  const { root, merge } = branchWithMerge();
  const commonGitDir = path.join(root, '.git');
  const made = 1_000_000;
  const old = addTurnWorktree(root, merge, { commonGitDir, pid: 333, now: () => made });
  const young = addTurnWorktree(root, merge, { commonGitDir, pid: 444, now: () => made + TURN_WORKTREE_MAX_AGE_MS });
  sweepTurnWorktrees(root, { commonGitDir, running: () => true, now: () => made + TURN_WORKTREE_MAX_AGE_MS + 1 });
  assert.deepEqual([fs.existsSync(old), fs.existsSync(young)], [false, true]);
  removeTurnWorktree(root, young);
});

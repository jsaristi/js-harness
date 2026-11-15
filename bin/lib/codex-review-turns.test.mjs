import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { reviewCoverage } from './codex-review-coverage.mjs';
import { leftOutSaid } from './codex-review-scope.mjs';
import { appendCodexReview, CODEX_REVIEW_SCHEMA } from './codex-reviews.mjs';
import { appendCodexReviewRun, CODEX_REVIEW_RUN_SCHEMA, readCodexReviewRuns } from './codex-review-runs.mjs';
import { addTurnWorktree, afterTurn, gapBelowMerge, inTurnWorktree, mergeTurn,PART_AS_CHANGED_LINES, plansAsOne, recheckAt, removeTurnWorktree, snapshotOfHead, sweepTurnWorktrees, TURN_WORKTREE_MAX_AGE_MS, turnsCheaper } from './codex-review-turns.mjs';

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
function branchWithMerge({ before: setUp = () => {}, afterMine = () => {}, alsoWritten = {}, stacked = false } = {}) {
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
  // `stacked`: the merge takes a stacked base off the default branch, with a commit of its own, not the branch.
  let own = null;
  if (stacked) {
    git(root, 'checkout', '-q', '-b', 'stack');
    own = commit(root, 's.js', 'stacked\n', 'feat: the stacked base');
  }
  git(root, 'checkout', '-q', 'feat');
  spawnSync('git', ['merge', '--no-ff', '--no-commit', stacked ? 'stack' : 'trunk'], { cwd: root, encoding: 'utf8' });
  fs.writeFileSync(path.join(root, 'm.js'), 'both\n', 'utf8');
  for (const [file, content] of Object.entries(alsoWritten)) fs.writeFileSync(path.join(root, file), content, 'utf8');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'merge trunk');
  const merge = git(root, 'rev-parse', 'HEAD');
  const c2 = commit(root, 'n.js', 'after\n', 'feat: after the merge');
  return { root, first, c1, side, own, merge, c2 };
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

test('a merge of a stacked base below HEAD is cut when each commit of its own has a record, and not when one has none (gate-first T7)', () => {
  const { root, first, c1, side, own, merge, c2 } = branchWithMerge({ stacked: true });
  record(root, first, c1);
  assert.equal(turnOf(root, side, c2), null);
  record(root, side, own);
  const turn = turnOf(root, side, c2);
  assert.deepEqual(turn && { merge: turn.merge, from: turn.from, side: turn.side, stacked: turn.stacked }, { merge, from: c1, side: own, stacked: true });
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

test('a correction owed below a merge: a merge whose first parent ends a review that owes a correction is cut, and says so: the commits after it are the recheck, which the merge\'s review never is (codex-spend L21)', () => {
  const { root, first, c1, side, merge, c2 } = branchWithMerge();
  record(root, first, c1, { run: 'r1' });
  const finding = { file: 'm.js', start: 1, end: 1, severity: 'P1', title: 'The line is lost.', body: 'It is.', confidence: 0.9 };
  appendCodexReviewRun(root, { schema: CODEX_REVIEW_RUN_SCHEMA, id: 'r1', outcome: 'reviewed', answer: { findings: [finding], verdict: 'incorrect' } });
  const owed = turnOf(root, side, c2);
  assert.deepEqual(owed && [owed.merge, owed.from, owed.owes], [merge, c1, c1]);
  // The same review, correct and with nothing found, owes nothing: the merge is cut, and owes nothing.
  const clean = branchWithMerge();
  record(clean.root, clean.first, clean.c1, { run: 'r1' });
  appendCodexReviewRun(clean.root, { schema: CODEX_REVIEW_RUN_SCHEMA, id: 'r1', outcome: 'reviewed', answer: { findings: [], verdict: 'correct' } });
  const cut = turnOf(clean.root, clean.side, clean.c2);
  assert.deepEqual(cut && [cut.merge, cut.owes], [clean.merge, undefined]);
  // Rechecked already, from a head that holds the recheck: refused, so no cut, and the range is taken as it is.
  record(root, c1, c2, { run: 'r2', recheckOf: c1 });
  appendCodexReviewRun(root, { schema: CODEX_REVIEW_RUN_SCHEMA, id: 'r2', outcome: 'reviewed', recheck: { of: c1, findings: 1, fixed: 1, notFixed: 0, followUps: 0, blocking: 0, unmarked: 0 } });
  assert.equal(mergeTurn(root, { given: side, tip: c2, uncovered: [{ ...reviewCoverage(root, { from: side, tip: merge }).uncovered[0] }] }), null);
});

test('a correction owed below a merge: a merge after a document commit that follows a review owing a correction names that review: the recheck reads past documents, as a run does (verifier B1)', () => {
  const docs = (root) => commit(root, 'notes.md', 'a note\n', 'docs: a note');
  const { root, first, c1, side, c2 } = branchWithMerge({ afterMine: docs });
  record(root, first, c1, { run: 'r1' });
  const finding = { file: 'm.js', start: 1, end: 1, severity: 'P1', title: 'The line is lost.', body: 'It is.', confidence: 0.9 };
  appendCodexReviewRun(root, { schema: CODEX_REVIEW_RUN_SCHEMA, id: 'r1', outcome: 'reviewed', answer: { findings: [finding], verdict: 'incorrect' } });
  assert.equal(turnOf(root, side, c2)?.owes, c1);
});

test('a correction owed below a merge: the line it is read along is the first-parent line, in the one rev-list git is asked, so the commits a merge brought in never push the review that owes out of it (codex-spend L24, V1)', () => {
  const { root, first, c1, merge, c2 } = branchWithMerge();
  record(root, first, c1, { run: 'r1' });
  const finding = { file: 'm.js', start: 1, end: 1, severity: 'P1', title: 'The line is lost.', body: 'It is.', confidence: 0.9 };
  appendCodexReviewRun(root, { schema: CODEX_REVIEW_RUN_SCHEMA, id: 'r1', outcome: 'reviewed', answer: { findings: [finding], verdict: 'incorrect' } });
  record(root, c1, merge, { run: 'r2', diff: 'remerge' });
  appendCodexReviewRun(root, { schema: CODEX_REVIEW_RUN_SCHEMA, id: 'r2', outcome: 'reviewed', answer: { findings: [], verdict: 'correct' } });
  const asked = [];
  const spawn = (command, args, opts) => {
    if (command === 'git') asked.push(args);
    return spawnSync(command, args, opts);
  };
  const state = recheckAt(root, { from: merge, tip: c2, runs: readCodexReviewRuns(root), spawn });
  assert.deepEqual(state && [state.kind, state.of, state.at], ['recheck', c1, c1]);
  assert.deepEqual(asked.filter((args) => args[0] === 'rev-list'), [['rev-list', '--first-parent', '--parents', '--max-count=500', merge]]);
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

// --- the gap below a merge of the default branch at HEAD (odd/tasks/codex-spend.md, spec 2) ---

/** A branch `feat` off `first`: c1, then a commit for each `[file, content]` of `gap`, then M, a merge of `trunk`
 * (where `origin/main` points) at HEAD. With `written` the two sides changed `m.js` and the merge resolves it by
 * hand, with `alsoWritten` beside it; without, main changed `t.js` alone and the merge writes no line.
 * `afterFirstGap` runs on the branch after the first commit of the gap. */
function branchWithGap({ gap = [['g.js', 'gap\n']], written = true, alsoWritten = {}, afterFirstGap = () => {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-turns-'));
  made.push(root);
  git(root, 'init', '-q');
  git(root, 'symbolic-ref', 'HEAD', 'refs/heads/trunk');
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  const first = commit(root, 'm.js', 'base\n', 'init');
  git(root, 'checkout', '-q', '-b', 'feat');
  const c1 = commit(root, 'm.js', 'mine\n', 'feat: mine');
  const gaps = gap.map(([file, content], at) => {
    const made = commit(root, file, content, `feat: gap ${at + 1}`);
    if (at === 0) afterFirstGap(root);
    return made;
  });
  git(root, 'checkout', '-q', 'trunk');
  const side = written ? commit(root, 'm.js', 'main moves\n', 'feat: main moves') : commit(root, 't.js', 'main moves\n', 'feat: main moves');
  git(root, 'remote', 'add', 'origin', 'https://example.invalid/js-harness-test.git');
  git(root, 'update-ref', 'refs/remotes/origin/main', side);
  git(root, 'checkout', '-q', 'feat');
  spawnSync('git', ['merge', '--no-ff', '--no-commit', 'trunk'], { cwd: root, encoding: 'utf8' });
  if (written) fs.writeFileSync(path.join(root, 'm.js'), 'both\n', 'utf8');
  for (const [file, content] of Object.entries(alsoWritten)) fs.writeFileSync(path.join(root, file), content, 'utf8');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'merge trunk');
  return { root, first, c1, gaps, side, merge: git(root, 'rev-parse', 'HEAD') };
}

// From the commit of the default branch the merge brought, as `codex-review --base origin/main` takes it.
const gapOf = (root, from, tip) => gapBelowMerge(root, { given: from, tip, uncovered: reviewCoverage(root, { from, tip }).uncovered });

test('gap below a merge: the commits no record covers below a merge of the default branch at HEAD are a turn of their own, from the parent of the oldest to the newest, then the merge by what was written in it', () => {
  const { root, first, c1, gaps, side, merge } = branchWithGap({ gap: [['g.js', 'gap\n'], ['h.js', 'more\n']] });
  record(root, first, c1);
  const cut = gapOf(root, side, merge);
  assert.ok(cut !== null, 'a gap');
  assert.deepEqual({ gap: cut.gap, at: cut.at, from: cut.from, first: cut.ranges.map((range) => [range.from, range.to]) }, { gap: true, at: gaps[1], from: c1, first: [[c1, gaps[1]], [gaps[1], merge]] });
  // The merge is read by what was written in it: against the automatic merge of its parents, never against main.
  const [, atMerge] = cut.ranges;
  assert.deepEqual({ side: atMerge.read.side, branch: atMerge.read.branch, auto: /^[0-9a-f]{40}$/.test(atMerge.read.auto) }, { side, branch: 'origin/main', auto: true });
  assert.equal(cut.ranges[0].read, null);
});

test('gap below a merge: a merge at HEAD that writes no line needs no turn, and the gap is the one turn', () => {
  const { root, first, c1, gaps, side, merge } = branchWithGap({ written: false });
  record(root, first, c1);
  const cut = gapOf(root, side, merge);
  assert.deepEqual(cut && cut.ranges.map((range) => [range.from, range.to, range.read]), [[c1, gaps[0], null]]);
  // One that merges a commit the default branch does not hold is no merge of main: the range is taken as today.
  git(root, 'update-ref', 'refs/remotes/origin/main', first);
  assert.equal(gapOf(root, side, merge), null);
});

test('gap below a merge: after the turn of the gap, its valid record of nothing to review goes on to the merge with no run line; a review with none, or a record of nothing to review with no reason, is still refused', () => {
  const { root, first, c1, merge } = branchWithMerge();
  const turns = { gap: true, from: first, at: c1, head: merge, ranges: [{}, {}] };
  appendCodexReview(root, { schema: CODEX_REVIEW_SCHEMA, base: first, head: c1, reviewedAt: '2026-10-16T00:00:00.000Z', outcome: 'nothing-to-review', reason: 'the range changes no file' });
  assert.deepEqual(afterTurn(root, turns), { stopped: false });
  appendCodexReview(root, { schema: CODEX_REVIEW_SCHEMA, base: first, head: c1, reviewedAt: '2026-10-16T00:00:00.000Z', outcome: 'nothing-to-review' });
  assert.match(afterTurn(root, turns).refused ?? '', /is not in the run log/);
  record(root, first, c1, { run: 'r1' });
  assert.match(afterTurn(root, turns).refused ?? '', /is not in the run log/);
});

test('gap below a merge: no gap where HEAD is no merge, covered or not, where nothing is uncovered below HEAD, or where its merge is not read by what was written in it', () => {
  const plain = branchWithGap();
  record(plain.root, plain.first, plain.c1);
  // A document commit above the merge: HEAD no record needs is no merge, and the range is taken as today.
  const notes = commit(plain.root, 'notes.md', 'a note\n', 'docs: a note');
  assert.equal(gapOf(plain.root, plain.side, notes), null);
  // A code commit above it, which is uncovered itself.
  const after = commit(plain.root, 'n.js', 'after\n', 'feat: after');
  assert.equal(gapOf(plain.root, plain.side, after), null);
  // The merge alone uncovered: `mergeStart` reads it, and there is no gap.
  const alone = branchWithGap({ gap: [] });
  record(alone.root, alone.first, alone.c1);
  assert.equal(gapOf(alone.root, alone.side, alone.merge), null);
  // A merge of a branch the default branch does not hold, that writes lines, is read as today.
  const other = branchWithGap();
  record(other.root, other.first, other.c1);
  git(other.root, 'update-ref', 'refs/remotes/origin/main', other.first);
  assert.equal(gapOf(other.root, other.side, other.merge), null);
});

test('gap below a merge: no gap where an uncovered commit lies off the first-parent line, a root, or a merge inside the gap', () => {
  // From `first`, main's own commit is in the range with no record: off the first-parent line of HEAD.
  const off = branchWithGap();
  record(off.root, off.first, off.c1);
  assert.equal(gapOf(off.root, off.first, off.merge), null);
  // A merge of another branch inside the gap.
  const inside = branchWithGap();
  record(inside.root, inside.first, inside.c1);
  const uncovered = reviewCoverage(inside.root, { from: inside.side, tip: inside.merge }).uncovered;
  const asMerge = uncovered.map((one) => (one.id === inside.gaps[0] ? { ...one, parentCount: 2 } : one));
  assert.equal(gapBelowMerge(inside.root, { given: inside.side, tip: inside.merge, uncovered: asMerge }), null);
  const asRoot = uncovered.map((one) => (one.id === inside.gaps[0] ? { ...one, parentCount: 0, isRoot: true, parent: null } : one));
  assert.equal(gapBelowMerge(inside.root, { given: inside.side, tip: inside.merge, uncovered: asRoot }), null);
  // And with the commits it holds, the gap stands: the list was what refused it.
  assert.notEqual(gapBelowMerge(inside.root, { given: inside.side, tip: inside.merge, uncovered }), null);
  // A merge between two commits of the gap that needs no record itself (it brings a note alone) is still in the
  // range of the gap's turn, and refuses it.
  const notesMerged = (root) => {
    git(root, 'checkout', '-q', '-b', 'notes');
    commit(root, 'notes.md', 'a note\n', 'docs: a note');
    git(root, 'checkout', '-q', 'feat');
    git(root, 'merge', '-q', '--no-ff', '-m', 'merge notes', 'notes');
  };
  const between = branchWithGap({ gap: [['g.js', 'gap\n'], ['h.js', 'more\n']], afterFirstGap: notesMerged });
  record(between.root, between.first, between.c1);
  assert.deepEqual(reviewCoverage(between.root, { from: between.side, tip: between.merge }).uncovered.map((one) => one.id).sort(), [between.merge, ...between.gaps].sort(), 'the merge of the note is no code commit');
  assert.equal(gapOf(between.root, between.side, between.merge), null);
});

test('gap below a merge: a HEAD of three parents that writes no line is no merge of the default branch to cut a gap below, though its second parent is a commit of it (codex-spend L21, F7)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-turns-'));
  made.push(root);
  git(root, 'init', '-q');
  git(root, 'symbolic-ref', 'HEAD', 'refs/heads/trunk');
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  const first = commit(root, 'm.js', 'base\n', 'init');
  // Main merged two branches, each with a commit of its own.
  const own = ['p', 'q'].map((name) => {
    git(root, 'checkout', '-q', '-b', name, first);
    return commit(root, `${name}.js`, `${name}\n`, `feat: ${name}`);
  });
  git(root, 'checkout', '-q', 'trunk');
  git(root, 'merge', '-q', '--no-ff', '-m', 'merge p and q', 'p', 'q');
  const main = git(root, 'rev-parse', 'HEAD');
  git(root, 'remote', 'add', 'origin', 'https://example.invalid/js-harness-test.git');
  git(root, 'update-ref', 'refs/remotes/origin/main', main);
  git(root, 'checkout', '-q', '-b', 'feat', first);
  const c1 = commit(root, 'm.js', 'mine\n', 'feat: mine');
  commit(root, 'g.js', 'gap\n', 'feat: gap');
  git(root, 'merge', '-q', '--no-ff', '-m', 'merge p and q', 'p', 'q');
  const octopus = git(root, 'rev-parse', 'HEAD');
  assert.equal(git(root, 'rev-list', '--parents', '-n', '1', octopus).split(' ').length, 4);
  assert.ok(own.every((id) => git(root, 'rev-list', '--parents', '-n', '1', octopus).includes(id)));
  record(root, first, c1);
  // From main: the gap alone is uncovered, the HEAD is no code commit, and its second parent is a commit of main.
  assert.deepEqual(reviewCoverage(root, { from: main, tip: octopus }).uncovered.map((one) => one.subject), ['feat: gap']);
  assert.equal(gapOf(root, main, octopus), null);
});

test('gap below a merge: a file of the gap marked at its newest commit and not at HEAD is no gap, since the turn would leave it out and the push reads it', () => {
  const marked = branchWithGap({ gap: [['.gitattributes', 'g.js -codex-review\n'], ['g.js', 'gap\n']], alsoWritten: { '.gitattributes': '' } });
  record(marked.root, marked.first, marked.c1);
  assert.equal(gapOf(marked.root, marked.side, marked.merge), null);
  // Marked alike at both, the gap stands.
  const alike = branchWithGap({ gap: [['.gitattributes', 'g.js -codex-review\n'], ['k.js', 'gap\n']] });
  record(alike.root, alike.first, alike.c1);
  assert.notEqual(gapOf(alike.root, alike.side, alike.merge), null);
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
  // A folder that cannot be removed throws nothing: the removal runs in a `finally` (a review, R3/R4).
  const spawnNoRemove = (command, args, opts) => (args[0] === 'worktree' && args[1] === 'remove' ? { status: 128, stdout: '', stderr: 'fatal: no' } : spawnSync(command, args, opts));
  assert.doesNotThrow(() => removeTurnWorktree(root, going, { commonGitDir, spawn: spawnNoRemove, rm: () => { throw new Error('EBUSY'); } }));
  removeTurnWorktree(root, going, { commonGitDir });
  assert.equal(fs.existsSync(going), false);
  // git holds no worktree of either: only the checkout itself is listed.
  assert.equal(git(root, 'worktree', 'list', '--porcelain').split('\n').filter((line) => line.startsWith('worktree ')).length, 1);
});

test('a turn worktree older than a turn can last is removed though a process of its pid runs: the pid was reused (a review R4, PR 338)', () => {
  const { root, merge } = branchWithMerge();
  const commonGitDir = path.join(root, '.git');
  const made = 1_000_000;
  const old = addTurnWorktree(root, merge, { commonGitDir, pid: 333, now: () => made });
  const young = addTurnWorktree(root, merge, { commonGitDir, pid: 444, now: () => made + TURN_WORKTREE_MAX_AGE_MS });
  sweepTurnWorktrees(root, { commonGitDir, running: () => true, now: () => made + TURN_WORKTREE_MAX_AGE_MS + 1 });
  assert.deepEqual([fs.existsSync(old), fs.existsSync(young)], [false, true]);
  removeTurnWorktree(root, young, { commonGitDir });
});

// --- the snapshot of the head a review reads (odd/tasks/codex-spend.md, spec 1) ---

/** A folder outside every repository with one file in it, which no removal or sweep may touch. */
function outsideWithSentinel() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-turns-outside-'));
  made.push(dir);
  fs.writeFileSync(path.join(dir, 'sentinel.txt'), 'keep me\n', 'utf8');
  return dir;
}

/** Makes `link` point at the folder `target` as `type` (`junction` or `dir`), or says why this OS cannot. */
function linkTo(target, link, type) {
  try {
    fs.symlinkSync(target, link, type);
    return null;
  } catch (err) {
    return `${type} links cannot be made here (${err.code})`;
  }
}

// The link types a test tries: a junction needs no privilege on Windows; a directory symlink may need one.
const LINK_TYPES = ['junction', 'dir'];

test('reads a snapshot of the head: the snapshot is a worktree of its own name beside a turn of the same run, and the sweep finds it once its run is gone', () => {
  const { root, merge, c2 } = branchWithMerge();
  const commonGitDir = path.join(root, '.git');
  // The same pid and the same time, as a run that makes its snapshot and then the worktree of a turn.
  const snapshot = addTurnWorktree(root, c2, { commonGitDir, pid: 555, now: () => 7, kind: 'head' });
  const turn = addTurnWorktree(root, merge, { commonGitDir, pid: 555, now: () => 7 });
  assert.ok(snapshot !== null && turn !== null && snapshot !== turn, `${snapshot} and ${turn}`);
  assert.match(path.basename(snapshot), /^review-head-555-7$/);
  assert.equal(git(snapshot, 'rev-parse', 'HEAD'), c2);
  sweepTurnWorktrees(root, { commonGitDir, running: () => true, now: () => 8 });
  assert.deepEqual([fs.existsSync(snapshot), fs.existsSync(turn)], [true, true], 'a run still going keeps both');
  sweepTurnWorktrees(root, { commonGitDir, running: () => false, now: () => 8 });
  assert.deepEqual([fs.existsSync(snapshot), fs.existsSync(turn)], [false, false]);
});

test('reads a snapshot of the head: a removal says what it left, and says nothing when the folder is gone', () => {
  const { root, c2 } = branchWithMerge();
  const commonGitDir = path.join(root, '.git');
  const place = addTurnWorktree(root, c2, { commonGitDir, kind: 'head' });
  const spawnNoRemove = (command, args, opts) => (args[0] === 'worktree' && args[1] === 'remove' ? { status: 128, stdout: '', stderr: 'fatal: no' } : spawnSync(command, args, opts));
  const left = removeTurnWorktree(root, place, { commonGitDir, spawn: spawnNoRemove, rm: () => { throw new Error('EBUSY: resource busy'); } });
  assert.match(String(left), /EBUSY/);
  assert.equal(fs.existsSync(place), true);
  assert.equal(removeTurnWorktree(root, place, { commonGitDir }), null);
  assert.equal(fs.existsSync(place), false);
  // Without the folder it may delete in, nothing is deleted.
  const again = addTurnWorktree(root, c2, { commonGitDir, kind: 'head' });
  assert.match(String(removeTurnWorktree(root, again, {})), /git directory/);
  assert.equal(fs.existsSync(again), true);
  removeTurnWorktree(root, again, { commonGitDir });
});

for (const type of LINK_TYPES) {
  test(`reads a snapshot of the head: a file behind a ${type} link inside a snapshot survives its removal and the sweep`, (t) => {
    const { root, c2 } = branchWithMerge();
    const commonGitDir = path.join(root, '.git');
    const outside = outsideWithSentinel();
    const removed = addTurnWorktree(root, c2, { commonGitDir, pid: 666, now: () => 1, kind: 'head' });
    const swept = addTurnWorktree(root, c2, { commonGitDir, pid: 777, now: () => 2, kind: 'head' });
    const cannot = linkTo(outside, path.join(removed, 'link'), type);
    if (cannot !== null) {
      removeTurnWorktree(root, removed, { commonGitDir });
      removeTurnWorktree(root, swept, { commonGitDir });
      t.skip(cannot);
      return;
    }
    fs.mkdirSync(path.join(swept, 'deep'));
    assert.equal(linkTo(outside, path.join(swept, 'deep', 'link'), type), null);
    assert.equal(removeTurnWorktree(root, removed, { commonGitDir }), null);
    sweepTurnWorktrees(root, { commonGitDir, running: () => false, now: () => 3 });
    assert.deepEqual([fs.existsSync(removed), fs.existsSync(swept)], [false, false]);
    assert.equal(fs.readFileSync(path.join(outside, 'sentinel.txt'), 'utf8'), 'keep me\n');
  });

  test(`reads a snapshot of the head: a snapshot name that is a ${type} link out of the area, or an area that is one, is refused by removal and the sweep`, (t) => {
    const { root } = branchWithMerge();
    const commonGitDir = path.join(root, '.git');
    // In the area, a name the sweep matches that leads out of it.
    const outside = outsideWithSentinel();
    const area = path.join(commonGitDir, 'js-harness');
    fs.mkdirSync(area, { recursive: true });
    const named = path.join(area, 'review-head-888-1');
    const cannot = linkTo(outside, named, type);
    if (cannot !== null) {
      t.skip(cannot);
      return;
    }
    assert.match(String(removeTurnWorktree(root, named, { commonGitDir })), /outside|link/);
    sweepTurnWorktrees(root, { commonGitDir, running: () => false, now: () => 2 });
    assert.equal(fs.readFileSync(path.join(outside, 'sentinel.txt'), 'utf8'), 'keep me\n');
    fs.unlinkSync(named);
    // Above it: the area itself a link to a folder that holds what looks like a stale snapshot.
    const elsewhere = outsideWithSentinel();
    fs.mkdirSync(path.join(elsewhere, 'review-head-999-1'));
    fs.writeFileSync(path.join(elsewhere, 'review-head-999-1', 'sentinel.txt'), 'keep me\n', 'utf8');
    fs.rmSync(area, { recursive: true, force: true });
    assert.equal(linkTo(elsewhere, area, type), null);
    assert.match(String(removeTurnWorktree(root, path.join(area, 'review-head-999-1'), { commonGitDir })), /outside|link/);
    sweepTurnWorktrees(root, { commonGitDir, running: () => false, now: () => 2 });
    assert.deepEqual([fs.existsSync(path.join(elsewhere, 'sentinel.txt')), fs.existsSync(path.join(elsewhere, 'review-head-999-1', 'sentinel.txt'))], [true, true]);
    fs.unlinkSync(area);
  });
}

test('reads a snapshot of the head: a folder is a turn worktree only where it is one of the area, by name', () => {
  const { root, c2 } = branchWithMerge();
  const commonGitDir = path.join(root, '.git');
  const place = addTurnWorktree(root, c2, { commonGitDir, kind: 'head' });
  const turn = addTurnWorktree(root, c2, { commonGitDir, now: () => 5 });
  assert.deepEqual([inTurnWorktree(place, commonGitDir), inTurnWorktree(turn, commonGitDir), inTurnWorktree(root, commonGitDir), inTurnWorktree(place, null)], [true, true, false, false]);
  removeTurnWorktree(root, place, { commonGitDir });
  removeTurnWorktree(root, turn, { commonGitDir });
});

test('reads a snapshot of the head: a gate turn\'s test command gives in the snapshot what it gives in the live folder', () => {
  const { root } = branchWithMerge();
  const commonGitDir = path.join(root, '.git');
  fs.writeFileSync(path.join(root, 'package.json'), `${JSON.stringify({ name: 'fixture', type: 'module' })}\n`, 'utf8');
  fs.writeFileSync(path.join(root, 'm.test.mjs'), [
    "import { test } from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import fs from 'node:fs';",
    "test('m.js holds what the merge wrote', () => assert.equal(fs.readFileSync(new URL('./m.js', import.meta.url), 'utf8').trim(), 'both'));",
    "test('n.js holds what came after', () => assert.equal(fs.readFileSync(new URL('./n.js', import.meta.url), 'utf8').trim(), 'after'));",
    '',
  ].join('\n'), 'utf8');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'test: a fixture test');
  const head = git(root, 'rev-parse', 'HEAD');
  // In a turn of the gate lock with nothing installed, the run reads a snapshot: the tests run there.
  const read = snapshotOfHead(root, head, { commonGitDir, gateHeld: true });
  assert.equal(read.snapshot, true, JSON.stringify(read));
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const outcome = (cwd) => {
    const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'm.test.mjs'], { cwd, encoding: 'utf8', env });
    return { status: result.status, summary: result.stdout.split('\n').filter((line) => /^# (tests|pass|fail) /.test(line)) };
  };
  const live = outcome(root);
  assert.deepEqual(live, { status: 0, summary: ['# tests 2', '# pass 2', '# fail 0'] });
  assert.deepEqual(outcome(read.place), live);
  assert.equal(removeTurnWorktree(root, read.place, { commonGitDir }), null);
});

test('reads a snapshot of the head: a snapshot that is not the head clean as soon as it is made is removed and refuses the run before Codex starts', () => {
  const { root, c2 } = branchWithMerge();
  const commonGitDir = path.join(root, '.git');
  // As a checkout filter or an end-of-line rule leaves a fresh checkout: a tracked file reads as changed there.
  const dirtyThere = (command, args, opts) => (args[0] === 'status' && /review-head-/.test(String(opts?.cwd)) ? { status: 0, stdout: ' M m.js\n', stderr: '' } : spawnSync(command, args, opts));
  const warned = [];
  const read = snapshotOfHead(root, c2, { commonGitDir, spawn: dirtyThere, warn: (line) => warned.push(line) });
  assert.match(String(read?.refused), /^The snapshot of [0-9a-f]{7} that Codex would read is not the head clean as soon as it is made \(its tracked files differ from its HEAD\)/);
  assert.deepEqual(warned, []);
  assert.deepEqual(fs.readdirSync(path.join(commonGitDir, 'js-harness')).filter((name) => name.startsWith('review-')), [], 'the snapshot is gone');
  // A snapshot whose tracked files git cannot say is refused the same way.
  const silent = (command, args, opts) => (args[0] === 'status' && /review-head-/.test(String(opts?.cwd)) ? { status: 128, stdout: '', stderr: 'fatal: no' } : spawnSync(command, args, opts));
  assert.match(String(snapshotOfHead(root, c2, { commonGitDir, spawn: silent })?.refused), /could not be read/);
});

test('reads a snapshot of the head: removal refuses a path that is not absolute, and the sweep says what it left, which a run warns of', () => {
  const { root, c2 } = branchWithMerge();
  const commonGitDir = path.join(root, '.git');
  const place = addTurnWorktree(root, c2, { commonGitDir, pid: 888, now: () => 1, kind: 'head' });
  // git would resolve a relative path against `root` and fs against this process's folder: neither is taken.
  assert.match(String(removeTurnWorktree(root, path.join('.git', 'js-harness', path.basename(place)), { commonGitDir })), /is not an absolute path/);
  assert.match(String(removeTurnWorktree(root, place, { commonGitDir: '.git' })), /not both absolute paths/);
  assert.equal(fs.existsSync(place), true);
  removeTurnWorktree(root, place, { commonGitDir });
  // A junction named as a snapshot is never followed: the sweep leaves it and says so.
  const outside = outsideWithSentinel();
  const cannot = linkTo(outside, path.join(commonGitDir, 'js-harness', 'review-head-1-1'), 'junction');
  if (cannot !== null) return;
  const left = sweepTurnWorktrees(root, { commonGitDir, running: () => false, now: () => 2 });
  assert.equal(left.length, 1, JSON.stringify(left));
  assert.match(left[0], /is a link, which is never followed/);
  const warned = [];
  const read = snapshotOfHead(root, c2, { commonGitDir, warn: (line) => warned.push(line) });
  assert.equal(read.snapshot, true);
  assert.equal(warned.length, 1, JSON.stringify(warned));
  assert.match(warned[0], /^Warning: the sweep of the review worktrees left one: .*is a link/);
  assert.equal(fs.existsSync(path.join(outside, 'sentinel.txt')), true);
  removeTurnWorktree(root, read.place, { commonGitDir });
  fs.unlinkSync(path.join(commonGitDir, 'js-harness', 'review-head-1-1'));
});

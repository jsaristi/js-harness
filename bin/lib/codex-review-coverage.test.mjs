import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { COMMITS_UNREAD, MARKS_UNREAD, notReviews, rangeStart, reviewCoverage, reviewStart } from './codex-review-coverage.mjs';
import { appendCodexReview, CODEX_REVIEW_SCHEMA, NOTHING_TO_REVIEW } from './codex-reviews.mjs';

// Real git in every test, isolated from the host's config. What `check` says of the records over the range
// of a push is in `bin/check-codex-reviews.test.mjs`, which is the net of the definition itself; here are
// the range a caller names, and where the review of what is left starts.
let configDir;
const made = [];
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-coverage-gitconfig-'));
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

/** Commits one file change and returns the new commit's full id. */
function commit(root, file, content, message) {
  fs.writeFileSync(path.join(root, file), content, 'utf8');
  git(root, 'add', '.');
  git(root, 'commit', '-m', message);
  return git(root, 'rev-parse', 'HEAD');
}

/** A repository with one commit, `first`, on `main`. No remote: a range here is the one a caller names. */
function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-coverage-'));
  made.push(root);
  git(root, 'init');
  git(root, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  return { root, first: commit(root, 'a.js', 'one', 'init') };
}

function record(root, base, head, extra = {}) {
  appendCodexReview(root, { schema: CODEX_REVIEW_SCHEMA, base, head, reviewedAt: '2026-10-08T00:00:00.000Z', outcome: 'reviewed', ...extra });
}

/** A `spawn` that runs git for real and keeps, in `started`, the git command of each process it starts. */
function countingSpawn() {
  const started = [];
  const spawn = (cmd, args, opts) => {
    started.push(args.find((arg) => !arg.startsWith('-') && !arg.includes('=')));
    return spawnSync(cmd, args, opts);
  };
  return { spawn, started };
}

const ids = (commits) => commits.map((commit) => commit.id);

/** A branch of four commits after `first`: code, a document, code, code. */
function fourCommits() {
  const { root, first } = makeRepo();
  const one = commit(root, 'b.js', 'two', 'feat: two');
  const doc = commit(root, 'notes.md', 'words', 'docs: notes');
  const two = commit(root, 'c.js', 'three', 'feat: three');
  const three = commit(root, 'd.js', 'four', 'feat: four');
  return { root, first, one, doc, two, three };
}

// --- the coverage of a range a caller names ---

test('the coverage is that of the range it is given: its code commits, newest first, each with its parent, and the ones no record covers', () => {
  const { root, first, one, doc, two, three } = fourCommits();
  const whole = reviewCoverage(root, { from: first, tip: three });
  assert.deepEqual(ids(whole.codeCommits), [three, two, one], 'the commit of a document is none of them');
  assert.deepEqual(ids(whole.uncovered), [three, two, one]);
  assert.deepEqual(whole.codeCommits.map((commit) => commit.parent), [two, doc, first]);
  assert.deepEqual([whole.covers, whole.invalid, whole.ignored], [[], 0, 0]);
  // A record of the first two commits, a record that is no evidence, and one of commits that are gone.
  record(root, first, doc);
  appendCodexReview(root, { base: first, head: three });
  record(root, 'e'.repeat(40), three);
  const partly = reviewCoverage(root, { from: first, tip: three });
  assert.deepEqual(ids(partly.uncovered), [three, two]);
  assert.deepEqual([partly.covers.length, partly.invalid, partly.ignored], [1, 1, 1]);
  // From a commit inside the branch, and up to one short of its head: the range is the caller's to name.
  assert.deepEqual(ids(reviewCoverage(root, { from: doc, tip: two }).codeCommits), [two]);
  assert.deepEqual(ids(reviewCoverage(root, { from: one, tip: doc }).codeCommits), []);
  // A range with no commit holds none, and nothing is uncovered in it.
  const empty = reviewCoverage(root, { from: three, tip: three });
  assert.deepEqual([empty.codeCommits, empty.uncovered], [[], []]);
});

test('a root commit of the range has no parent', () => {
  const { root, first } = makeRepo();
  git(root, 'checkout', '--orphan', 'unrelated');
  const alone = commit(root, 'z.js', 'unrelated', 'feat: a root commit');
  const { codeCommits } = reviewCoverage(root, { from: first, tip: alone });
  assert.deepEqual(codeCommits.map((commit) => [commit.id, commit.parent, commit.isRoot]), [[alone, null, true]]);
});

test('the records that cover a code commit and are no review are told apart from the reviews', () => {
  const { root, first, one, doc, two, three } = fourCommits();
  record(root, first, one);
  record(root, one, two, { outcome: 'unavailable', reason: 'model rejected' });
  record(root, two, three, { outcome: NOTHING_TO_REVIEW, reason: 'the range changes no file' });
  // A skip of the commit of the document alone covers no code commit, and is not counted.
  record(root, one, doc, { outcome: 'unavailable', reason: 'nothing but words' });
  const coverage = reviewCoverage(root, { from: first, tip: three });
  assert.deepEqual(coverage.uncovered, []);
  assert.deepEqual(notReviews(coverage).map((rec) => [rec.outcome, rec.head]), [['unavailable', two], [NOTHING_TO_REVIEW, three]]);
});

test('a coverage that cannot be told says what could not be read, and never reads as nothing uncovered', () => {
  const { root, first, three } = fourCommits();
  assert.deepEqual(reviewCoverage(root, { from: 'no-such-rev', tip: three }), { unknown: COMMITS_UNREAD });
  const noLog = (cmd, args, opts) => (args[0] === 'log' ? { status: 128, stdout: '', stderr: 'fatal' } : spawnSync(cmd, args, opts));
  assert.deepEqual(reviewCoverage(root, { from: first, tip: three, spawn: noLog }), { unknown: COMMITS_UNREAD });
  const oldGit = (cmd, args, opts) => (args[0] === 'check-attr' ? { status: 129, stdout: '', stderr: 'error: unknown option `source\'' } : spawnSync(cmd, args, opts));
  assert.deepEqual(reviewCoverage(root, { from: first, tip: three, spawn: oldGit }), { unknown: MARKS_UNREAD });
});

// --- where the review of what is left starts ---

/** The commits `revs` name, as a coverage holds them, as far as `reviewStart` reads them. */
const commitsOf = (root, ...revs) => revs.map((rev) => ({ id: git(root, 'rev-parse', rev), parent: git(root, 'rev-parse', `${rev}^`) }));

test('the review starts at the parent of the oldest commit no record covers, which is where the records end', () => {
  const { root, first, one, doc, two, three } = fourCommits();
  record(root, first, one);
  const { uncovered } = reviewCoverage(root, { from: first, tip: three });
  assert.deepEqual(ids(uncovered), [three, two]);
  const { start, before: oldest } = reviewStart(uncovered, { cwd: root, from: first, tip: three });
  // The parent of the oldest code commit, and not the head of the record: the document between them is no
  // code commit, and no review is owed of it.
  assert.equal(start, doc);
  assert.equal(oldest.id, two);
});

test('a range whose first commit is the oldest uncovered one starts where it was given, and git is asked nothing', () => {
  const { root, first, three } = fourCommits();
  const { uncovered } = reviewCoverage(root, { from: first, tip: three });
  const { spawn, started } = countingSpawn();
  const { start, before: oldest } = reviewStart(uncovered, { cwd: root, from: first, tip: three, spawn });
  assert.equal(start, first);
  assert.equal(oldest.id, uncovered.at(-1).id, 'it is the parent of that commit all the same');
  assert.deepEqual(started, []);
});

test('with nothing uncovered there is nothing to start before: the range as it was given', () => {
  const { root, first, three } = fourCommits();
  assert.deepEqual(reviewStart([], { cwd: root, from: first, tip: three }), { start: first, before: null });
});

test('a root commit has no parent to start at: the range as it was given', () => {
  const { root, first } = makeRepo();
  git(root, 'checkout', '--orphan', 'unrelated');
  const alone = commit(root, 'z.js', 'unrelated', 'feat: a root commit');
  commit(root, 'y.js', 'more', 'feat: on the root');
  const tip = git(root, 'rev-parse', 'HEAD');
  const { uncovered } = reviewCoverage(root, { from: first, tip });
  assert.equal(uncovered.at(-1).id, alone);
  assert.deepEqual(reviewStart(uncovered, { cwd: root, from: first, tip }), { start: first, before: null });
  // The two histories share no commit: there is none to start at, and none is made up.
  assert.deepEqual(reviewStart(uncovered, { cwd: root, from: null, tip }), { start: null, before: null });
  // Past the root there is a parent, and with no commit to hold it to, the review starts there.
  assert.equal(reviewStart(uncovered.slice(0, 1), { cwd: root, from: null, tip }).start, alone);
});

test('a parent the range does not start at or before is no start: a branch that forked earlier and was merged in', () => {
  const { root, first } = makeRepo();
  const from = commit(root, 'b.js', 'two', 'feat: two');
  const mine = commit(root, 'c.js', 'three', 'feat: three');
  git(root, 'checkout', '--quiet', '-b', 'side', first);
  const side = commit(root, 's.js', 'side', 'feat: side work, forked before the range starts');
  git(root, 'checkout', '--quiet', 'main');
  git(root, 'merge', '--no-ff', '-m', 'merge side', 'side');
  const tip = git(root, 'rev-parse', 'HEAD');
  record(root, from, mine);
  const { uncovered } = reviewCoverage(root, { from, tip });
  assert.deepEqual(ids(uncovered), [side]);
  // From the parent of `side` the review would read `b.js`, which the range never held.
  assert.deepEqual(reviewStart(uncovered, { cwd: root, from, tip }), { start: from, before: null });
});

test('a start that would leave an uncovered commit out is no start, whatever order the commits came in', () => {
  const { root, first, doc, two, three } = fourCommits();
  // Said to be the oldest, the last commit has the other one among its ancestors: from its parent, that
  // one would be in no review.
  const [older, newer] = commitsOf(root, two, three);
  assert.deepEqual(reviewStart([older, newer], { cwd: root, from: first, tip: three }), { start: first, before: null });
  // In the order git lists them, the same two start at the parent of the older one, which is not the commit
  // the range starts at: the two answers differ in where they start as in what they start before.
  assert.deepEqual(reviewStart([newer, older], { cwd: root, from: first, tip: three }), { start: doc, before: older });
});

test('a range starts at the commit its two ends share, at none when git says they share none, and git not saying is neither', () => {
  const { root, first, one, three } = fourCommits();
  assert.deepEqual(rangeStart(root, { base: one, tip: three }), { from: one });
  git(root, 'checkout', '--orphan', 'unrelated');
  const alone = commit(root, 'z.js', 'unrelated', 'feat: a root commit');
  assert.deepEqual(rangeStart(root, { base: first, tip: alone }), { from: null });
  // A revision git does not know, a git that fails, one that was stopped, one that could not be started:
  // each is a question left unanswered, and none of them the answer that there is no such commit.
  const unknown = { unknown: true };
  assert.deepEqual(rangeStart(root, { base: 'no-such-rev', tip: alone }), unknown);
  const answering = (result) => () => result;
  for (const result of [
    { status: 128, stdout: '', stderr: 'fatal: unable to read tree' },
    { status: 1, stdout: '', stderr: '', error: new Error('spawnSync git ETIMEDOUT') },
    { status: null, signal: 'SIGKILL', stdout: '', stderr: '' },
    { status: 0, stdout: '\n', stderr: '' },
    null,
  ]) {
    assert.deepEqual(rangeStart(root, { base: first, tip: alone, spawn: answering(result) }), unknown, JSON.stringify(result));
  }
  const throwing = () => {
    throw new Error('spawnSync git ENOENT');
  };
  assert.deepEqual(rangeStart(root, { base: first, tip: alone, spawn: throwing }), unknown);
});

test('an answer git does not give is not a yes: the range as it was given', () => {
  const { root, first, one, three } = fourCommits();
  record(root, first, one);
  const { uncovered } = reviewCoverage(root, { from: first, tip: three });
  const asGiven = { start: first, before: null };
  const failing = (command) => (cmd, args, opts) => (args[0] === command ? { status: 128, stdout: '', stderr: 'fatal' } : spawnSync(cmd, args, opts));
  assert.deepEqual(reviewStart(uncovered, { cwd: root, from: first, tip: three, spawn: failing('merge-base') }), asGiven);
  assert.deepEqual(reviewStart(uncovered, { cwd: root, from: first, tip: three, spawn: failing('rev-list') }), asGiven);
  const throwing = () => {
    throw new Error('spawnSync git ENOENT');
  };
  assert.deepEqual(reviewStart(uncovered, { cwd: root, from: first, tip: three, spawn: throwing }), asGiven);
  // And with git answering, two processes say that the start is safe.
  const { spawn, started } = countingSpawn();
  assert.notEqual(reviewStart(uncovered, { cwd: root, from: first, tip: three, spawn }).start, first);
  assert.deepEqual(started, ['merge-base', 'rev-list']);
});

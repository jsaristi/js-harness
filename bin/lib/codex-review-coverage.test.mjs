import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { baseLeftOut, COMMITS_UNREAD, MARKS_UNREAD, notReviews, rangeStart, reviewCoverage, reviewStart } from './codex-review-coverage.mjs';
import { appendCodexReview, CODEX_REVIEW_SCHEMA, NOTHING_TO_REVIEW } from './codex-reviews.mjs';
import { repoTemplate } from './git-fixture.testkit.mjs';

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

/** The repository every test starts from, built once and copied (`git-fixture.testkit.mjs`); it answers `first`. */
const firstCommit = repoTemplate((root) => {
  git(root, 'init');
  git(root, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  return commit(root, 'a.js', 'one', 'init');
});

/** A repository with one commit, `first`, on `main`. No remote: a range here is the one a caller names. */
function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-coverage-'));
  made.push(root);
  return { root, first: firstCommit(root) };
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

// --- a merge: a commit of the range by the files somebody wrote in it ---

/** One commit of `file` on a new branch `name`, off the commit that is checked out on `main`, which stays
 * checked out: the commit's full id. */
function sideCommit(root, name, file, content) {
  git(root, 'checkout', '--quiet', '-b', name);
  const id = commit(root, file, content, `feat: ${name}`);
  git(root, 'checkout', '--quiet', 'main');
  return id;
}

/** Merges the branch `side`, or the several a space separates, into the one that is checked out, as a merge
 * commit that also holds `edits`, a map of file name to content, and returns its full id. Where the two
 * sides conflict git stops by itself and exits 1: the edits are then the resolution, made by hand. */
function merge(root, side, edits = {}) {
  spawnSync('git', ['merge', '--no-ff', '--no-commit', ...side.split(' ')], { cwd: root, encoding: 'utf8' });
  for (const [file, content] of Object.entries(edits)) fs.writeFileSync(path.join(root, file), content, 'utf8');
  git(root, 'add', '.');
  git(root, 'commit', '-m', `merge ${side}`);
  return git(root, 'rev-parse', 'HEAD');
}

test('a merge somebody wrote in is a commit of the range, and a code commit when a review reads what was written; a clean merge is none', () => {
  const { root, first } = makeRepo();
  // Clean: each side has a file of its own, and the merge adds nothing to them.
  const side = sideCommit(root, 'side', 's.js', 'side');
  const mine = commit(root, 'm.js', 'mine', 'feat: mine');
  const clean = merge(root, 'side');
  // A conflict in `a.js`, resolved by hand as neither side had it.
  const theirs = sideCommit(root, 'theirs', 'a.js', 'theirs');
  const ours = commit(root, 'a.js', 'ours', 'feat: ours');
  const resolved = merge(root, 'theirs', { 'a.js': 'neither' });
  // An edit made in the merge, of a document alone: a file the merge changes, and none a review reads.
  const words = sideCommit(root, 'words', 'w.js', 'words');
  const documented = merge(root, 'words', { 'notes.md': 'words' });

  const coverage = reviewCoverage(root, { from: first, tip: documented });
  assert.equal(coverage.unknown, undefined, 'the entries of the merges are read');
  const code = new Map(coverage.codeCommits.map((commit) => [commit.id, commit]));
  assert.deepEqual([...code.keys()].sort(), [side, mine, theirs, ours, resolved, words].sort(), `neither ${clean} nor ${documented}`);
  // Its files are those somebody wrote in it, and its parent the first of two: it is no root commit.
  const { parent, isRoot, parentCount, files } = code.get(resolved);
  assert.deepEqual([parent, isRoot, parentCount, files], [ours, false, 2, ['a.js']]);
  assert.equal(code.get(ours).parentCount, 1);
  // Covered as any commit is: by a record whose range holds it.
  assert.ok(ids(coverage.uncovered).includes(resolved));
  record(root, ours, resolved);
  const after = ids(reviewCoverage(root, { from: first, tip: documented }).uncovered);
  assert.deepEqual([after.includes(resolved), after.includes(theirs), after.includes(ours)], [false, false, true]);
});

/** Thirty lines, with those of `changed` (a map of line number to text) in place of their own: two sides
 * that each change one, far apart, are merged by git with no conflict. */
const thirtyLines = (changed = {}) => Array.from({ length: 30 }, (_, at) => changed[at] ?? `line ${at}`).join('\n');

/** A file both sides changed, far apart, and the merge of `sides` into the side that is checked out, which
 * nobody wrote a line of: `{ root, ours, merged }`, the range `ours..merged` being that merge and its sides. */
function mergedByGit(sides) {
  const { root } = makeRepo();
  commit(root, 'shared.js', thirtyLines(), 'feat: a file of thirty lines');
  sideCommit(root, 'side', 'shared.js', thirtyLines({ 2: 'theirs' }));
  if (sides.includes('other')) sideCommit(root, 'other', 'o.js', 'other');
  const ours = commit(root, 'shared.js', thirtyLines({ 27: 'ours' }), 'feat: ours');
  return { root, ours, merged: merge(root, sides) };
}

test('a file both sides changed and git merged by itself is no file of the merge: nobody wrote it, and git is asked which of its files somebody did', () => {
  const { root, ours, merged } = mergedByGit('side');
  const filesOfMerge = (spawn) => reviewCoverage(root, { from: ours, tip: merged, spawn }).codeCommits.find((commit) => commit.id === merged)?.files;
  // The merge leaves the file as neither parent has it, so git lists it; merging the two parents again
  // gives the same file, so nobody wrote it, and the merge is no code commit: one more git process says so.
  const { spawn, started } = countingSpawn();
  assert.equal(filesOfMerge(spawn), undefined);
  assert.deepEqual(started.filter((command) => command === 'show'), ['show']);
  // An answer that is not the merge and the names of its files, whole: unknown is written by hand.
  const answering = (result) => (cmd, args, opts) => (args[0] === 'show' ? result : spawnSync(cmd, args, opts));
  const answers = {
    'git fails, as one that does not know the option': { status: 128, stdout: '', stderr: 'fatal: unrecognized argument: --remerge-diff' },
    'a warning where the names are': { status: 0, stdout: `${merged}\0diff: warning: Skipping remerge-diff for octopus merges.\n`, stderr: '' },
    'the answer of another commit': { status: 0, stdout: `${ours}\0`, stderr: '' },
    'a first name with no newline before it': { status: 0, stdout: `${merged}\0shared.js\0`, stderr: '' },
    'nothing at all': { status: 0, stdout: '', stderr: '' },
  };
  for (const [which, result] of Object.entries(answers)) assert.deepEqual(filesOfMerge(answering(result)), ['shared.js'], which);
  // And a name the answer adds is no file of the merge: merging again also differs where the merge dropped
  // the work of a side, which leaves the file as a parent has it and no line for a review to read.
  assert.deepEqual(filesOfMerge(answering({ status: 0, stdout: `${merged}\0\ndropped.js\0shared.js\0`, stderr: '' })), ['shared.js']);
});

test('a merge of more than two parents is not asked about: git merges none of them again, so the files it lists stand', () => {
  const { root, ours, merged } = mergedByGit('side other');
  const { spawn, started } = countingSpawn();
  const { codeCommits } = reviewCoverage(root, { from: ours, tip: merged, spawn });
  assert.deepEqual(codeCommits.find((commit) => commit.id === merged)?.files, ['shared.js']);
  assert.ok(!started.includes('show'), started.join(' '));
});

test('the entry of a merge is read as git writes it, and in no other shape: a list that is not every commit of the range is no list', () => {
  const { root, first } = makeRepo();
  sideCommit(root, 'side', 's.js', 'side');
  const merged = merge(root, 'side', { 'a.js': 'edited in the merge' });
  // What git answers is kept, and answered again with one thing changed.
  let log;
  const keeping = (cmd, args, opts) => {
    const result = spawnSync(cmd, args, opts);
    if (args[0] === 'log') log = result.stdout;
    return result;
  };
  const read = reviewCoverage(root, { from: first, tip: merged, spawn: keeping });
  assert.deepEqual(read.codeCommits?.find((commit) => commit.id === merged)?.files, ['a.js']);
  // An empty field after the line of the merge, where another commit has none, and no newline before its
  // first name, where another commit has one.
  const line = log.split('\0')[1];
  const entry = `\0${line}\0\0a.js\0`;
  assert.ok(log.startsWith(entry), JSON.stringify(log));
  const rest = log.slice(entry.length);
  assert.match(rest, /^\0[0-9a-f]{40}\t[^\0]*\0\ns\.js\0$/, 'the commit of the side, as any other commit is written');
  const answering = (stdout) => (cmd, args, opts) => (args[0] === 'log' ? { status: 0, stdout, stderr: '' } : spawnSync(cmd, args, opts));
  const shapes = {
    'the names of a merge after a newline, as those of another commit are': `\0${line}\0\na.js\0${rest}`,
    // What `git log` writes of a merge whose files it was not asked for: the line alone. The empty field
    // that starts the next commit then stands where the one after the line of a merge does, and the line of
    // that commit where a name does. Nothing in the text says so: the count of the commits does.
    'a merge with nothing after its line, and then a commit': `\0${line}\0${rest}`,
    'a merge with nothing after its line, and nothing else': `\0${line}\0`,
  };
  for (const [which, stdout] of Object.entries(shapes)) {
    assert.deepEqual(reviewCoverage(root, { from: first, tip: merged, spawn: answering(stdout) }), { unknown: COMMITS_UNREAD }, which);
  }
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

test('a caller that knows where the repository is hands it on: the coverage is the same, and git is asked neither where the top is nor where the git folder is', () => {
  const { root, first, doc, three } = fourCommits();
  record(root, first, doc);
  const asked = countingSpawn();
  const whole = reviewCoverage(root, { from: first, tip: three, spawn: asked.spawn });
  assert.equal(whole.covers.length, 1);
  assert.equal(asked.started.filter((command) => command === 'rev-parse').length, 2, 'where the top is, and where the git folder is');
  const where = { top: root, commonGitDir: path.join(root, '.git') };
  const told = countingSpawn();
  assert.deepEqual(reviewCoverage(root, { from: first, tip: three, spawn: told.spawn, where }), whole);
  // Every other question is put as before, in its order.
  assert.deepEqual(told.started, asked.started.filter((command) => command !== 'rev-parse'));
  // A caller that says there is no git folder has no record read, and is asked about by nobody.
  const none = countingSpawn();
  const unrecorded = reviewCoverage(root, { from: first, tip: three, spawn: none.spawn, where: { top: root, commonGitDir: null } });
  assert.deepEqual([unrecorded.covers, ids(unrecorded.uncovered)], [[], ids(whole.codeCommits)]);
  assert.equal(none.started.includes('rev-parse'), false);
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

test('a merge that is the oldest commit no record covers is started before as any commit is: at its first parent, under the checks of every start', () => {
  const { root, first } = makeRepo();
  const zero = commit(root, 'b.js', 'two', 'feat: two');
  const one = commit(root, 'c.js', 'three', 'feat: three');
  const side = sideCommit(root, 'side', 's.js', 'side');
  const merged = merge(root, 'side', { 'c.js': 'three, edited in the merge' });
  const tip = commit(root, 'd.js', 'four', 'feat: four');
  record(root, first, zero);
  record(root, one, side);
  // Not the oldest, the merge is a commit like any other: the review starts at the parent of the oldest
  // one, which the merge lies after.
  const three = reviewCoverage(root, { from: first, tip }).uncovered;
  assert.deepEqual(ids(three), [tip, merged, one]);
  const later = reviewStart(three, { cwd: root, from: first, tip });
  assert.deepEqual([later.start, later.before.id], [zero, one]);
  // The oldest, it has two commits before it, and the review starts at the first: the patch from there
  // holds all the merge changed against it, the edit made in the merge among it.
  record(root, zero, one);
  const two = reviewCoverage(root, { from: first, tip }).uncovered;
  assert.deepEqual(ids(two), [tip, merged]);
  const atFirstParent = reviewStart(two, { cwd: root, from: first, tip });
  assert.deepEqual([atFirstParent.start, atFirstParent.before.id], [one, merged]);
  // Held to the checks of every start: a range that starts at its other parent never held the first one,
  // and is taken as it was given.
  assert.deepEqual(reviewStart(two, { cwd: root, from: side, tip }), { start: side, before: null });
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

// --- the base of a review, when the commit it starts at is one of the branch that no record covers ---

/** The remote `origin` with its `main` at `tip`, a commit of `root`. Nothing else is fetched: a default
 * branch needs no network, only the ref that names it. */
function remoteMainAt(root, tip) {
  git(root, 'remote', 'add', 'origin', 'https://example.invalid/js-harness-test.git');
  git(root, 'update-ref', 'refs/remotes/origin/main', tip);
}

test('the base of a review that is a code commit of the branch, with no record, is that commit: its id, short id and subject', () => {
  const { root, first } = makeRepo();
  remoteMainAt(root, first);
  git(root, 'checkout', '--quiet', '-b', 'feat');
  const one = commit(root, 'b.js', 'two', 'feat: two');
  assert.deepEqual(baseLeftOut(root, { from: one }), { id: one, shortId: git(root, 'rev-parse', '--short', one), subject: 'feat: two' });
});

/** A merge of `side` into the branch checked out in `root`, with an edit written in it so it is a code commit. */
function mergeWithEdit(root, side) {
  spawnSync('git', ['merge', '--no-ff', '--no-commit', '--quiet', side], { cwd: root });
  fs.writeFileSync(path.join(root, 'b.js'), `written in the merge of ${side}\n`, 'utf8');
  git(root, 'add', 'b.js');
  git(root, 'commit', '--quiet', '-m', `merge ${side}`);
  return git(root, 'rev-parse', 'HEAD');
}

test('the base of a review that is a merge of the default branch says so, `merged` naming that branch; a merge of another branch does not (merge-review-covers-main)', () => {
  const { root, first } = makeRepo();
  git(root, 'checkout', '--quiet', '-b', 'trunk');
  const moved = commit(root, 'm.js', 'main moves', 'feat: main moves');
  remoteMainAt(root, moved);
  git(root, 'checkout', '--quiet', '-b', 'other', first);
  commit(root, 'o.js', 'other', 'feat: other');
  git(root, 'checkout', '--quiet', '-b', 'feat', first);
  commit(root, 'b.js', 'two', 'feat: two');
  const ofMain = mergeWithEdit(root, 'trunk');
  assert.equal(baseLeftOut(root, { from: ofMain })?.merged, 'origin/main');
  const ofOther = mergeWithEdit(root, 'other');
  const left = baseLeftOut(root, { from: ofOther });
  assert.equal(left?.id, ofOther);
  assert.equal('merged' in left, false);
});

test('the base of a review that is the tip of the default branch is no base left out, though it is a code commit with no record', () => {
  const { root } = makeRepo();
  const tip = commit(root, 'b.js', 'two', 'feat: two');
  remoteMainAt(root, tip);
  assert.equal(baseLeftOut(root, { from: tip }), null);
});

test('the base of a review that a record covers is no base left out', () => {
  const { root, first } = makeRepo();
  remoteMainAt(root, first);
  git(root, 'checkout', '--quiet', '-b', 'feat');
  const one = commit(root, 'b.js', 'two', 'feat: two');
  record(root, first, one);
  assert.equal(baseLeftOut(root, { from: one }), null);
});

test('the base of a review that a record covers, from a later commit of the branch, is no base left out', () => {
  const { root, first } = makeRepo();
  remoteMainAt(root, first);
  git(root, 'checkout', '--quiet', '-b', 'feat');
  const one = commit(root, 'b.js', 'two', 'feat: two');
  const two = commit(root, 'c.js', 'three', 'feat: three');
  record(root, first, two);
  assert.equal(baseLeftOut(root, { from: one }), null);
});

test('the base of a review that a record of nothing to review covers from a later commit is no base left out once the head of the review is given', () => {
  const { root, first } = makeRepo();
  remoteMainAt(root, first);
  git(root, 'checkout', '--quiet', '-b', 'feat');
  const one = commit(root, 'b.js', 'two', 'feat: two');
  // The commit and its revert: the range changes no file, and its record covers only a range that holds its head.
  fs.rmSync(path.join(root, 'b.js'));
  git(root, 'add', '-A');
  git(root, 'commit', '-m', 'revert: two');
  const two = git(root, 'rev-parse', 'HEAD');
  record(root, first, two, { outcome: NOTHING_TO_REVIEW, reason: 'the range changes no file' });
  const three = commit(root, 'c.js', 'three', 'feat: three');
  // Read up to the base alone, that record is not one of the range, and the base reads as left out.
  assert.equal(baseLeftOut(root, { from: one })?.id, one);
  // Read up to the head of the review, where the push check reads it, a record covers it.
  assert.equal(baseLeftOut(root, { from: one, tip: three }), null);
});

test('the base of a review that no record covers is left out at the head of the review too', () => {
  const { root, first } = makeRepo();
  remoteMainAt(root, first);
  git(root, 'checkout', '--quiet', '-b', 'feat');
  const one = commit(root, 'b.js', 'two', 'feat: two');
  const two = commit(root, 'c.js', 'three', 'feat: three');
  assert.equal(baseLeftOut(root, { from: one, tip: two })?.id, one);
  assert.equal(baseLeftOut(root, { from: one, tip: one })?.id, one);
});

test('the base of a review that changes only a Markdown file is no base left out', () => {
  const { root, first } = makeRepo();
  remoteMainAt(root, first);
  git(root, 'checkout', '--quiet', '-b', 'feat');
  const doc = commit(root, 'notes.md', 'words', 'docs: notes');
  assert.equal(baseLeftOut(root, { from: doc }), null);
});

test('a repository with no remote has no default branch, so there is no base left out', () => {
  const { root } = makeRepo();
  git(root, 'checkout', '--quiet', '-b', 'feat');
  const one = commit(root, 'b.js', 'two', 'feat: two');
  assert.equal(baseLeftOut(root, { from: one }), null);
});

test('the base of a review that is a root commit of an unrelated history is no base left out', () => {
  const { root, first } = makeRepo();
  remoteMainAt(root, first);
  git(root, 'checkout', '--quiet', '--orphan', 'unrelated');
  const alone = commit(root, 'z.js', 'unrelated', 'feat: a root commit');
  assert.equal(baseLeftOut(root, { from: alone }), null);
});

test('a spawn that fails every merge-base call gives no base left out, and throws nothing', () => {
  const { root, first } = makeRepo();
  remoteMainAt(root, first);
  git(root, 'checkout', '--quiet', '-b', 'feat');
  const one = commit(root, 'b.js', 'two', 'feat: two');
  const failing = (cmd, args, opts) => (args[0] === 'merge-base' ? { status: 128, stdout: '', stderr: 'fatal' } : spawnSync(cmd, args, opts));
  const throwing = (cmd, args, opts) => {
    if (args[0] === 'merge-base') throw new Error('spawnSync git ENOENT');
    return spawnSync(cmd, args, opts);
  };
  assert.equal(baseLeftOut(root, { from: one, spawn: failing }), null);
  assert.equal(baseLeftOut(root, { from: one, spawn: throwing }), null);
});

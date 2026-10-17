import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkCodexReviewDebt, checkCodexReviews, main } from './check.mjs';
import { PART_MAX_CHANGED_LINES } from './lib/codex-review-parts.mjs';
import { autoMaintenanceOff, withoutAutoMaintenance } from './lib/git-fixture.testkit.mjs';
import { MAX_PARTS_WITHOUT_FLAG } from './lib/codex-review-plan.mjs';
import * as reviewRecords from './lib/codex-reviews.mjs';
import { CODEX_REVIEW_SCHEMA, NOTHING_TO_REVIEW } from './lib/codex-reviews.mjs';
import { appendCodexReviewRun, CODEX_REVIEW_RUN_SCHEMA } from './lib/codex-review-runs.mjs';
import { priorLine } from './lib/codex-review-recheck.mjs';
import { gitDirs } from './lib/project.mjs';

// Real git in every test, isolated from the host's config like project.test.mjs does.
let configDir;
const made = [];
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-check-push-gitconfig-'));
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

/** Commits one file change and returns the new commit's full id. */
function commit(root, file, content, message) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content, 'utf8');
  git(root, 'add', '.');
  git(root, 'commit', '-m', message);
  return git(root, 'rev-parse', 'HEAD');
}

// A test writes the records its check is to read (`record`), and the writer asked git where the git folder
// is each time, one process for an answer that does not change while the repository is there. So the answer
// is kept here, by the root of the repository, and handed to the writer as its `where` (`jsonLinesPath`). A
// memo by root is safe in this file and nowhere in the product: every repository here is a folder of its
// own, made once and removed when the file ends. It is the tests' own shortcut: the rows under test ask git
// themselves, through the `spawn` they are handed, and a test that counts or fails a question counts it there.
const gitFolders = new Map();

/** What the tests' writer of records is told of the repository at `root`: its git folder, as `gitDirs`
 * answers it, asked the first time. An answer git did not give is not kept, and nothing is then said: the
 * writer asks git itself, as it did. */
function whereOf(root) {
  if (!gitFolders.has(root)) {
    const { commonGitDir } = gitDirs(root);
    if (commonGitDir === null) return {};
    gitFolders.set(root, { commonGitDir });
  }
  return gitFolders.get(root);
}

/** The writer of records, under the name the product gives it, told where the git folder is. */
const appendCodexReview = (root, rec) => reviewRecords.appendCodexReview(root, rec, { where: whereOf(root) });

// Building a repository takes nine git processes, a commit among them, and nearly every test starts from
// one of the same few. So each distinct one is built once in a run of this file, and a test is handed a
// copy of it: a folder of its own, which it may commit in, record in and remove, with the same objects and
// so the same commit ids, and with whatever records the one it was copied from holds in its git folder.
const built = new Map();

/** A repository of the caller's own: a copy of the one `build` makes, which is made once for `key` and is
 * never handed out itself. `build` answers `{ root, ... }`, and the rest of it goes with every copy. The
 * index of a copy holds the dates of the files it was copied from, so the tree reads as clean to what
 * compares the files themselves, as `git status`, `git add` and `git commit` do, and not to `git diff-files`.
 *
 * A copy keeps its git folder where the one it was copied from keeps its own, so git is asked where that
 * is once, of the one that was built, and never of a copy (`whereOf`). */
function copyOf(key, build) {
  if (!built.has(key)) {
    const template = withoutAutoMaintenance(build);
    autoMaintenanceOff(template.root);
    // The sample hooks `git init` leaves are a third of what there is to copy, and nothing reads them.
    fs.rmSync(path.join(template.root, '.git', 'hooks'), { recursive: true, force: true });
    built.set(key, template);
  }
  const { root: template, ...ids } = built.get(key);
  const root = tmp('js-harness-check-push-');
  fs.cpSync(template, root, { recursive: true });
  // Only a git folder inside the repository went with the copy: one that lies elsewhere is asked for.
  const asked = whereOf(template).commonGitDir;
  const gitFolder = asked === undefined ? null : path.relative(template, asked);
  if (gitFolder !== null && !gitFolder.startsWith('..') && !path.isAbsolute(gitFolder)) gitFolders.set(root, { commonGitDir: path.resolve(root, gitFolder) });
  return { root, ...ids };
}

// A commit starts `git maintenance run --auto --detach` (git 2.47 and later), which outlives it holding a lock in
// `.git/objects`; a copy made then can find the lock gone (rules-row-template-copy-enoent in docs/FAILURES.md).
test('a commit in a copy of the repository the tests copy starts no detached git maintenance', () => {
  const { root } = makeRepo();
  const run = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '--allow-empty', '-m', 'traced'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GIT_TRACE: '1' },
  });
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stderr, /maintenance run/);
});

/** A repo on `main` with one code commit, which `origin/<remoteBranch>` also points at: what the
 * check compares a push to is the remote's branch, never the local one. `remoteBranch = null`
 * leaves the repo with no remote refs at all. */
function makeRepo(remoteBranch = 'main') {
  return copyOf(`a repo whose remote branch is ${remoteBranch}`, () => buildRepo(remoteBranch));
}

/** Builds that repository, which is what `makeRepo` hands out copies of. */
function buildRepo(remoteBranch) {
  const root = tmp('js-harness-check-push-');
  git(root, 'init');
  git(root, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  git(root, 'remote', 'add', 'origin', 'https://example.invalid/js-harness-test.git');
  const base = commit(root, 'a.js', 'one', 'init');
  if (remoteBranch) git(root, 'update-ref', `refs/remotes/origin/${remoteBranch}`, base);
  return { root, base };
}

function feature(root) {
  git(root, 'checkout', '-b', 'feature');
}

function record(root, base, head, extra = {}) {
  appendCodexReview(root, {
    schema: CODEX_REVIEW_SCHEMA,
    base,
    head,
    reviewedAt: '2026-09-29T00:00:00.000Z',
    outcome: 'reviewed',
    ...extra,
  });
}

const short = (root, rev) => git(root, 'rev-parse', '--short', rev);

test('every code commit inside a recorded range passes, and the detail counts them', () => {
  const { root, base } = makeRepo();
  feature(root);
  commit(root, 'b.js', 'two', 'feat: two');
  const head = commit(root, 'c.js', 'three', 'feat: three');
  record(root, base, head);
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.name, 'codex-review');
  assert.equal(row.pass, true);
  assert.match(row.detail, /2 code commits since origin.main, all covered by a Codex review record/);
});

test('an uncovered code commit fails, naming it and the command that records it', () => {
  const { root, base } = makeRepo();
  feature(root);
  const first = commit(root, 'b.js', 'two', 'feat: two');
  const second = commit(root, 'c.js', 'three', 'feat: three, never reviewed');
  record(root, base, first);
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, false);
  assert.match(row.detail, /1 of 2 code commits since origin.main/);
  assert.match(row.detail, /codex-reviews\.jsonl/);
  const lines = row.lines.join('\n');
  assert.ok(lines.includes(`${short(root, second)} feat: three, never reviewed`), lines);
  assert.ok(!lines.includes(`${short(root, first)} feat: two`), lines);
  assert.ok(lines.includes(`js-harness codex-review --base ${short(root, second)}^`), lines);
});

/** Writes one line of the Codex run log, which a record names by its `id`, told where the git folder is. */
const run = (root, line) => appendCodexReviewRun(root, { schema: CODEX_REVIEW_RUN_SCHEMA, outcome: 'reviewed', ...line }, { where: whereOf(root) });

const finding = { file: 'bin/b.js', start: 3, end: 5, severity: 'P2', title: 'The guard reads the wrong field', body: 'It reads `a` where it means `b`.', confidence: 0.8 };

/** A feature commit reviewed by a record whose run line found `answer`: the repository, its base and head. */
function reviewedWith(answer) {
  const { root, base } = makeRepo();
  feature(root);
  const head = commit(root, 'b.js', 'two', 'feat: two');
  run(root, { id: 'run-1', answer });
  record(root, base, head, { run: 'run-1' });
  return { root, base, head };
}

test('a head whose last review owes a correction is refused, naming its open findings and the recheck', () => {
  const { root, head } = reviewedWith({ verdict: 'incorrect', findings: [finding] });
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, false, row.detail);
  assert.match(row.detail, new RegExp(`review that ended at ${short(root, head)} owes a correction: 1 finding open`));
  const lines = row.lines.join('\n');
  assert.ok(lines.includes(priorLine(finding)), lines);
  assert.ok(lines.includes(`js-harness codex-review --base ${short(root, head)}`), lines);
});

test('a skip ending at a later document commit does not clear the correction the review owes', () => {
  const { root, base, head } = reviewedWith({ verdict: 'incorrect', findings: [finding] });
  const doc = commit(root, 'docs/NOTES.md', 'notes', 'docs: notes');
  record(root, base, doc, { outcome: 'unavailable', reason: 'codex was down' });
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, false, row.detail);
  assert.match(row.detail, new RegExp(`review that ended at ${short(root, head)} owes a correction: 1 finding open`));
});

test('a correction its recheck found fixed passes', () => {
  const { root, head } = reviewedWith({ verdict: 'incorrect', findings: [finding] });
  const fix = commit(root, 'b.js', 'two, fixed', 'fix: read the right field');
  run(root, { id: 'run-2', answer: { verdict: 'correct', findings: [] }, recheck: { of: head, findings: 1, fixed: 1, notFixed: 0, followUps: 0, blocking: 0, unmarked: 0 } });
  record(root, head, fix, { run: 'run-2', recheckOf: head });
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, true, row.detail);
  assert.match(row.detail, /2 code commits since origin.main, all covered by a Codex review record/);
});

test('a recheck that left a finding not fixed passes, with a warning that names the findings and leaves their waiver to the user', () => {
  const { root, head } = reviewedWith({ verdict: 'incorrect', findings: [finding] });
  const fix = commit(root, 'b.js', 'two, half fixed', 'fix: read the right field, once');
  const left = { ...finding, title: '[not fixed] 1 The guard reads the wrong field' };
  run(root, { id: 'run-2', answer: { verdict: 'incorrect', findings: [left] }, recheck: { of: head, findings: 1, fixed: 0, notFixed: 1, followUps: 0, blocking: 0, unmarked: 0 } });
  record(root, head, fix, { run: 'run-2', recheckOf: head });
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, true, row.detail);
  assert.match(row.detail, /2 code commits since origin.main, all covered by a Codex review record/);
  const lines = row.lines.join('\n');
  assert.match(lines, new RegExp(`warning: the Codex recheck that ended at ${short(root, fix)} left 1 finding open`));
  assert.ok(lines.includes(priorLine(left)), lines);
  assert.match(lines, /the user decides whether they are waived/);
  // A skip records no correction: it is not offered.
  assert.ok(!lines.includes('--unavailable'), lines);
});

test('a recheck whose counts were not kept passes with the warning too', () => {
  const { root, head } = reviewedWith({ verdict: 'incorrect', findings: [finding] });
  const fix = commit(root, 'b.js', 'two, half fixed', 'fix: read the right field, once');
  run(root, { id: 'run-2', answer: { verdict: 'incorrect', findings: [finding] } });
  record(root, head, fix, { run: 'run-2', recheckOf: head });
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, true, row.detail);
  assert.match(row.lines.join('\n'), /warning: the Codex recheck that ended at .* left findings open \(its counts were not kept\)/);
});

test('a review that found nothing, or a branch with no run log, passes as before', () => {
  const { root } = reviewedWith({ verdict: 'correct', findings: [] });
  assert.equal(checkCodexReviews(root, 'HEAD').pass, true);
  const { root: bare, base } = makeRepo();
  feature(bare);
  const head = commit(bare, 'b.js', 'two', 'feat: two');
  record(bare, base, head, { run: 'run-1' });
  const row = checkCodexReviews(bare, 'HEAD');
  assert.equal(row.pass, true, row.detail);
  assert.match(row.detail, /1 code commit since origin.main, all covered by a Codex review record/);
});

test('with several uncovered commits the fix starts from the oldest', () => {
  const { root } = makeRepo();
  feature(root);
  const first = commit(root, 'b.js', 'two', 'feat: two');
  const second = commit(root, 'c.js', 'three', 'feat: three');
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, false);
  const lines = row.lines.join('\n');
  assert.ok(lines.includes(short(root, first)) && lines.includes(short(root, second)), lines);
  assert.ok(lines.includes(`js-harness codex-review --base ${short(root, first)}^`), lines);
});

test('a commit that changes only Markdown needs no review, in any letter case', () => {
  const { root } = makeRepo();
  feature(root);
  commit(root, 'docs/notes.md', 'words', 'docs: notes');
  commit(root, 'README.MD', 'words', 'docs: readme');
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, true);
  assert.match(row.detail, /no code commits since origin.main/);
});

test('a commit that changes Markdown and code still needs a review', () => {
  const { root } = makeRepo();
  feature(root);
  fs.writeFileSync(path.join(root, 'notes.md'), 'words', 'utf8');
  const mixed = commit(root, 'd.js', 'code', 'feat: code and docs');
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, false);
  assert.ok(row.lines.join('\n').includes(short(root, mixed)));
});

test('a merge commit needs no review of its own', () => {
  const { root, base } = makeRepo();
  feature(root);
  const own = commit(root, 'b.js', 'two', 'feat: two');
  git(root, 'checkout', 'main');
  commit(root, 'other.js', 'elsewhere', 'feat: elsewhere on main');
  // A fetch: origin/main now reaches the commit that is about to be merged in.
  git(root, 'update-ref', 'refs/remotes/origin/main', 'main');
  git(root, 'checkout', 'feature');
  git(root, 'merge', '--no-ff', '-m', 'merge main into feature', 'main');
  record(root, base, own);
  const row = checkCodexReviews(root, 'HEAD');
  // The merged-in commit is excluded because the current origin/main reaches it, and the merge
  // commit itself is skipped: only `own` needed a review, and the record covers it.
  assert.equal(row.pass, true, `${row.detail}\n${(row.lines ?? []).join('\n')}`);
  assert.match(row.detail, /1 code commit since origin\/main/);
});

// Failure 15 (docs/FAILURES.md, assessment-counts-main; T2 of odd/tasks/commands-and-doctor.md): after
// `main` was merged in, the hint named the commit before the oldest uncovered one, the `main` the branch
// left, so its range read again all `main` gained since (41 parts where 6 were due, 2026-10-09).
test('after main is merged in, the push row hints the base the plain row sizes, never the main the branch left', () => {
  const { root } = makeRepo();
  feature(root);
  const own = commit(root, 'b.js', 'two', 'feat: two');
  git(root, 'checkout', 'main');
  commit(root, 'other.js', 'elsewhere', 'feat: elsewhere on main');
  git(root, 'update-ref', 'refs/remotes/origin/main', 'main');
  git(root, 'checkout', 'feature');
  git(root, 'merge', '--no-ff', '-m', 'merge main into feature', 'main');
  commit(root, 'c.js', 'three', 'feat: three');
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, false, row.detail);
  const hint = row.lines.at(-1);
  assert.notEqual(hint, `make the record with: js-harness codex-review --base ${short(root, own)}^`);
  // The plain row's base is the one whose review it sized: both rows name one review.
  const debt = checkCodexReviewDebt(root);
  assert.equal(hint, debt.lines.find((line) => line.startsWith('make the record with: ')), debt.lines.join('\n'));
});

test('after main is merged in with the commits before it covered, the hint starts at the merge commit', () => {
  const { root, base } = makeRepo();
  feature(root);
  const own = commit(root, 'b.js', 'two', 'feat: two');
  record(root, base, own);
  git(root, 'checkout', 'main');
  commit(root, 'other.js', 'elsewhere', 'feat: elsewhere on main');
  git(root, 'update-ref', 'refs/remotes/origin/main', 'main');
  git(root, 'checkout', 'feature');
  git(root, 'merge', '--no-ff', '-m', 'merge main into feature', 'main');
  const merge = git(root, 'rev-parse', 'HEAD');
  const after = commit(root, 'c.js', 'three', 'feat: three');
  const row = checkCodexReviews(root, 'HEAD');
  // `<after>^` is the merge commit: the range from there holds only what came after it.
  assert.equal(git(root, 'rev-parse', `${after}^`), merge);
  assert.equal(row.lines.at(-1), `make the record with: js-harness codex-review --base ${short(root, after)}^`);
});

test('a merge commit somebody wrote code in needs a record, as the commit it is', () => {
  const { root, base } = makeRepo();
  feature(root);
  const own = commit(root, 'b.js', 'two', 'feat: two');
  git(root, 'checkout', '-b', 'side');
  const side = commit(root, 's.js', 'side', 'feat: side work');
  git(root, 'checkout', 'feature');
  // The finding this is the test of: an edit made in the merge is in the patch of no other commit, so with
  // a record for every other commit it was pushed with no review having read it.
  git(root, 'merge', '--no-ff', '--no-commit', 'side');
  const merged = commit(root, 'b.js', 'two, edited in the merge', 'merge side, with an edit of its own');
  record(root, base, side);
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, false, row.detail);
  assert.match(row.detail, /^1 of 3 code commits since origin\/main have no Codex review record/);
  // It has parents, so it is no root commit, and `<id>^` is the first of them: the range from there holds it.
  const from = `${short(root, merged)}^`;
  assert.deepEqual(row.lines, [`${short(root, merged)} merge side, with an edit of its own`, `make the record with: js-harness codex-review --base ${from}`]);
  // The plain row counts it and names the same base: the review starts at that parent and reads the edit
  // alone, since `side` is a stacked base whose own commits have their record (odd/tasks/gate-first.md, T7).
  const debt = checkCodexReviewDebt(root);
  assert.equal(debt.detail, `no Codex review record for 1 of 3 code commits since origin/main: the review of ${from}..HEAD is 1 part today, 2 changed lines in 1 file`);
  assert.deepEqual(debt.lines, [
    `${short(root, merged)} merge side, with an edit of its own`,
    `make the record with: js-harness codex-review --base ${from}`,
    `what it would cost, with nothing spent: js-harness codex-review --base ${from} --plan`,
  ]);
  // The record that command makes from that base covers it, as it covers any commit.
  record(root, own, merged);
  const covered = checkCodexReviews(root, 'HEAD');
  assert.equal(covered.pass, true, `${covered.detail}\n${(covered.lines ?? []).join('\n')}`);
  assert.equal(covered.detail, '3 code commits since origin/main, all covered by a Codex review record');
});

test('a merge in which git merged a file both sides changed, and nobody wrote a line, needs no record', () => {
  const { root } = makeRepo();
  const text = (changed = {}) => Array.from({ length: 30 }, (_, at) => changed[at] ?? `line ${at}`).join('\n');
  const base = commit(root, 'shared.js', text(), 'feat: a file of thirty lines');
  feature(root);
  const own = commit(root, 'shared.js', text({ 2: 'mine' }), 'feat: mine');
  git(root, 'checkout', 'main');
  commit(root, 'shared.js', text({ 27: 'elsewhere' }), 'feat: elsewhere on main, in the same file');
  git(root, 'update-ref', 'refs/remotes/origin/main', 'main');
  git(root, 'checkout', 'feature');
  // The default branch merged into a branch whose every commit is reviewed: the merge leaves the file as
  // neither side has it, and a record asked of it would be a second review of the whole branch.
  git(root, 'merge', '--no-ff', '-m', 'merge main into feature', 'main');
  record(root, base, own);
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, true, `${row.detail}\n${(row.lines ?? []).join('\n')}`);
  assert.equal(row.detail, '1 code commit since origin/main, all covered by a Codex review record');
});

// --- what a review leaves out: documents, and what the project marks (`./lib/codex-review-scope.mjs`) ---

/** `makeRepo`, with a `.gitattributes` of `marks` that the default branch of the remote already holds, so
 * that the commit of the marks is none of the branch's own. */
function makeMarkedRepo(marks = 'evals/results/** -codex-review\n') {
  return copyOf(`a repo that marks ${marks}`, () => {
    const { root } = makeRepo();
    const base = commit(root, '.gitattributes', marks, 'chore: say what a review leaves out');
    git(root, 'update-ref', 'refs/remotes/origin/main', base);
    feature(root);
    return { root, base };
  });
}

/** Commits `content` at `file` through the index alone and returns the commit's full id: a name the file
 * system of this machine may refuse (a quote, on Windows) is still one a repository can hold. The working
 * tree is left without the file, so no `commit` follows it in a test. `core.protectNTFS` is off for the one
 * command that would refuse the name on Windows. */
function commitInIndex(root, file, content, message) {
  const hashed = spawnSync('git', ['hash-object', '-w', '--stdin'], { cwd: root, input: content, encoding: 'utf8' });
  assert.equal(hashed.status, 0, hashed.stderr);
  git(root, '-c', 'core.protectNTFS=false', 'update-index', '--add', '--cacheinfo', `100644,${hashed.stdout.trim()},${file}`);
  git(root, 'commit', '-m', message);
  return git(root, 'rev-parse', 'HEAD');
}

test('a commit that changes only what a review leaves out needs no record, and one that changes code beside it still does', () => {
  const { root } = makeMarkedRepo();
  commit(root, 'evals/results/a.json', '{}', 'chore: the results of an eval');
  fs.writeFileSync(path.join(root, 'notes.md'), 'words', 'utf8');
  commit(root, 'evals/results/deep/b.json', '{}', 'chore: more results, and a note');
  commit(root, 'docs/notes.md', 'words', 'docs: notes');
  const { spawn, started } = countingSpawn();
  const row = checkCodexReviews(root, 'HEAD', { spawn });
  assert.equal(row.pass, true, row.detail);
  assert.equal(row.detail, 'no code commits since origin/main');
  // What is marked is asked of git once, for the paths of every commit together.
  assert.equal(started.filter((command) => command === 'check-attr').length, 1, started.join(' '));
  assert.equal(checkCodexReviewDebt(root).detail, 'no code commits since origin/main');
  // A file outside the marked folder, in the same commit as results and a document: that commit is code.
  fs.writeFileSync(path.join(root, 'evals/results/c.json'), '{}', 'utf8');
  fs.writeFileSync(path.join(root, 'more.md'), 'words', 'utf8');
  const mixed = commit(root, 'evals/run.mjs', 'code', 'feat: an eval, its results and a note');
  const failing = checkCodexReviews(root, 'HEAD');
  assert.equal(failing.pass, false);
  assert.match(failing.detail, /^1 of 1 code commit since origin\/main have no Codex review record/);
  assert.ok(failing.lines[0].startsWith(short(root, mixed)), failing.lines.join('\n'));
  assert.match(checkCodexReviewDebt(root).detail, /^no Codex review record for 1 of 1 code commit since origin\/main/);
});

test('what the project marks is read from the commit that is checked, for every commit under it: not from the working tree, nor from the index', () => {
  const { root } = makeRepo();
  feature(root);
  const data = commit(root, 'data/a.json', '{}', 'chore: data, before anything marks it');
  commit(root, '.gitattributes', 'data/** -codex-review\n.gitattributes -codex-review\n', 'chore: mark the data, and this file');
  // Checked at the commit that marks them, both commits change only what a review leaves out.
  assert.equal(checkCodexReviews(root, 'HEAD').detail, 'no code commits since origin/main');
  // Checked at the commit before, nothing is marked yet, whatever the tree that is checked out says.
  const earlier = checkCodexReviews(root, data);
  assert.equal(earlier.pass, false);
  assert.match(earlier.detail, /^1 of 1 code commit since origin\/main have no Codex review record/);
  // Marks nobody committed say nothing of a commit: taken away in the tree and then in the index, they
  // still hold for HEAD, and `check` runs before every commit over a tree that is being edited.
  fs.writeFileSync(path.join(root, '.gitattributes'), '', 'utf8');
  assert.equal(checkCodexReviews(root, 'HEAD').detail, 'no code commits since origin/main');
  assert.equal(checkCodexReviewDebt(root).detail, 'no code commits since origin/main');
  git(root, 'add', '.gitattributes');
  assert.equal(checkCodexReviews(root, 'HEAD').detail, 'no code commits since origin/main');
});

test('a document or a marked file is left out whatever its name holds: a quote, a space, a letter outside ASCII', () => {
  // git writes such a name in quotes and escapes unless it is asked for the names as they are.
  const { root } = makeMarkedRepo('*.json -codex-review\n');
  commitInIndex(root, 'docs/say "hi".md', 'words', 'docs: a quote in a name');
  commitInIndex(root, 'data/caf\u00e9 "au lait".json', '{}', 'chore: data with a quote in its name');
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, true, row.detail);
  assert.equal(row.detail, 'no code commits since origin/main');
  // And code with such a name is code.
  const code = commitInIndex(root, 'src/say "hi".md.js', 'code', 'feat: code with a quote in its name');
  const failing = checkCodexReviews(root, 'HEAD');
  assert.match(failing.detail, /^1 of 1 code commit since origin\/main have no Codex review record/);
  assert.ok(failing.lines[0].startsWith(short(root, code)), failing.lines.join('\n'));
});

test('when git cannot say what the project marks, the push check fails and says so, and the plain row says what it cannot tell', () => {
  const { root } = makeRepo();
  feature(root);
  const head = commit(root, 'b.js', 'two', 'feat: two');
  const old = { status: 129, stdout: '', stderr: 'error: unknown option `source\'' };
  const spawn = (cmd, args, opts) => (args[0] === 'check-attr' ? old : spawnSync(cmd, args, opts));
  const row = checkCodexReviews(root, 'HEAD', { spawn });
  assert.equal(row.pass, false);
  assert.equal(row.detail, 'cannot read which files of origin/main..HEAD a Codex review leaves out (`git check-attr --source` failed; it needs git 2.40 or later)');
  const plain = checkCodexReviewDebt(root, { spawn });
  assert.ok(isInformation(plain), JSON.stringify(plain));
  assert.equal(plain.detail, `cannot tell how much code waits for a Codex review: ${row.detail}`);
  // Once the commits are counted, a size git cannot give is said as any other.
  let asked = 0;
  const later = (cmd, args, opts) => (args[0] === 'check-attr' && (asked += 1) > 1 ? old : spawnSync(cmd, args, opts));
  assert.equal(
    checkCodexReviewDebt(root, { spawn: later }).detail,
    `no Codex review record for 1 of 1 code commit since origin/main: how large the review of ${short(root, head)}^..HEAD is today could not be told`,
  );
});

test('the plain row sizes the review without what it leaves out, so it says what a review would read', () => {
  const { root } = makeMarkedRepo();
  fs.mkdirSync(path.join(root, 'evals', 'results'), { recursive: true });
  fs.writeFileSync(path.join(root, 'evals', 'results', 'a.json'), lines(900), 'utf8');
  fs.writeFileSync(path.join(root, 'notes.md'), lines(50), 'utf8');
  const oldest = commit(root, 'b.js', lines(4), 'feat: code, with the results of its eval and a note');
  commit(root, 'c.js', lines(3), 'feat: more code');
  const { spawn, started } = countingSpawn();
  const row = checkCodexReviewDebt(root, { spawn });
  assert.ok(isInformation(row), JSON.stringify(row));
  // 957 changed lines in four files, of which a review reads seven in two: one part, not three.
  assert.equal(row.detail, `no Codex review record for 2 of 2 code commits since origin/main: the review of ${short(root, oldest)}^..HEAD is 1 part today, 7 changed lines in 2 files`);
  assert.equal(started.filter((command) => command === 'check-attr').length, 2, 'once for the commits and once for the size');
  // A range that changes, as a whole, only what a review leaves out has no part, and the row says which it is.
  git(root, 'rm', '--quiet', 'b.js', 'c.js');
  git(root, 'commit', '-m', 'revert: the code goes, the results and the note stay');
  assert.equal(
    checkCodexReviewDebt(root).detail,
    `no Codex review record for 3 of 3 code commits since origin/main: the review of ${short(root, oldest)}^..HEAD has no part today, since the range changes no file a review reads as a whole`,
  );
});

test('both rows say from a folder below the top of the repository what they say from the top: what is marked, which commits are code, and the size', () => {
  const { root } = makeMarkedRepo();
  commit(root, 'evals/results/a.json', lines(900), 'chore: the results of an eval');
  const oldest = commit(root, 'src/b.js', lines(4), 'feat: code');
  commit(root, 'src/deep/c.js', lines(3), 'feat: more code, in a folder below');
  fs.writeFileSync(path.join(root, 'evals', 'results', 'b.json'), lines(600), 'utf8');
  commit(root, 'tools/d.js', lines(2), 'feat: code elsewhere, with more results');
  const told = (cwd) => {
    const push = checkCodexReviews(cwd, 'HEAD');
    return [push.detail.replace(/ \(.*codex-reviews\.jsonl\)$/, ''), push.lines.slice(0, -1), checkCodexReviewDebt(cwd).detail];
  };
  const fromTop = told(root);
  assert.equal(fromTop[0], '3 of 3 code commits since origin/main have no Codex review record');
  assert.equal(fromTop[2], `no Codex review record for 3 of 3 code commits since origin/main: the review of ${short(root, oldest)}^..HEAD is 1 part today, 9 changed lines in 3 files`);
  // git reads the path it is asked the marks of from the folder it runs in: asked there about a path
  // written from the top, it answers for another path, and a marked file counts as code.
  for (const below of ['evals', path.join('src', 'deep')]) assert.deepEqual(told(path.join(root, below)), fromTop, below);
  // And a repository whose configuration makes git list paths from the folder it runs in, leaving out what
  // lies outside it (`diff.relative`), still has its commits and its files counted whole.
  git(root, 'config', 'diff.relative', 'true');
  for (const below of ['evals', path.join('src', 'deep')]) assert.deepEqual(told(path.join(root, below)), fromTop, `${below}, with diff.relative`);
  assert.deepEqual(told(root), fromTop, 'the top, with diff.relative');
});

test('a commit that moves a file a review reads to a path the project marks is a code commit: the file that went is one it changes', () => {
  // `js-harness codex-review` reads a range with renames off, so the file that went is removed whole and is
  // reviewed. With git's detection of renames the commit would list the new path alone, which is marked.
  const { root } = makeRepo();
  commit(root, 'src/app.js', lines(20), 'feat: code');
  const base = commit(root, '.gitattributes', 'evals/results/** -codex-review\n', 'chore: say what a review leaves out');
  git(root, 'update-ref', 'refs/remotes/origin/main', base);
  feature(root);
  fs.mkdirSync(path.join(root, 'evals', 'results'), { recursive: true });
  git(root, 'mv', 'src/app.js', 'evals/results/app.js');
  git(root, 'commit', '-m', 'refactor: move the code among the results');
  const moved = git(root, 'rev-parse', 'HEAD');
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, false, row.detail);
  assert.match(row.detail, /^1 of 1 code commit since origin\/main have no Codex review record/);
  assert.ok(row.lines[0].startsWith(short(root, moved)), row.lines.join('\n'));
  // The plain row counts the same commit, and sizes the review that command would make of it.
  assert.equal(
    checkCodexReviewDebt(root).detail,
    `no Codex review record for 1 of 1 code commit since origin/main: the review of ${short(root, moved)}^..HEAD is 1 part today, 20 changed lines in 1 file`,
  );
});

/** Commits `content` at each of `names` through the index alone, as `commitInIndex` does, and returns the
 * commit's full id. The names go to git on its standard input, each ended by a NUL, so one may hold what no
 * command line carries whole: a tab, a newline, a control character. */
function commitNamesInIndex(root, names, content, message) {
  const hashed = spawnSync('git', ['hash-object', '-w', '--stdin'], { cwd: root, input: content, encoding: 'utf8' });
  assert.equal(hashed.status, 0, hashed.stderr);
  const added = spawnSync('git', ['-c', 'core.protectNTFS=false', 'update-index', '-z', '--add', '--index-info'], {
    cwd: root,
    encoding: 'utf8',
    input: names.map((name) => `100644 ${hashed.stdout.trim()}\t${name}\0`).join(''),
  });
  assert.equal(added.status, 0, added.stderr);
  git(root, 'commit', '-m', message);
  return git(root, 'rev-parse', 'HEAD');
}

test('a file name is read whole whatever it holds, and none is taken for the line of a commit', () => {
  // The finding this is the test of: a commit whose only file is `\u0001code.js` listed no file, and the
  // push check passed with "no code commits".
  const { root } = makeRepo();
  feature(root);
  const code = commitNamesInIndex(root, ['\u0001code.js'], 'code', 'feat: code in a file whose name starts with a control character');
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, false, row.detail);
  assert.match(row.detail, /^1 of 1 code commit since origin\/main have no Codex review record/);
  assert.deepEqual(row.lines.slice(0, -1), [`${short(root, code)} feat: code in a file whose name starts with a control character`]);
  assert.match(checkCodexReviewDebt(root).detail, /^no Codex review record for 1 of 1 code commit since origin\/main: the review of [0-9a-f]+\^\.\.HEAD is 1 part today, 1 changed line in 1 file$/);
});

test('names that read as the line of a commit, or begin with a newline, are names: the commits and their files are counted as they are', () => {
  const { root } = makeMarkedRepo('*.json -codex-review\n');
  // What git writes for a commit, as a name: after a document, and after a marked file that begins with the
  // newline git writes before the first name of a commit.
  const asACommit = (subject) => `${'c'.repeat(40)}\tccccccc\t\t${subject}`;
  const documents = commitNamesInIndex(
    root,
    ['\nnotes.md', `${asACommit('docs: forged')}.md`, `\u0001${asACommit('docs: forged, the old way')}.md`, 'zz/data.json'],
    'words',
    'docs: names that read as commits',
  );
  const none = checkCodexReviews(root, 'HEAD');
  assert.equal(none.pass, true, `${none.detail}\n${(none.lines ?? []).join('\n')}`);
  assert.equal(none.detail, 'no code commits since origin/main');
  // The same names as code: one commit, with a subject of its own, and not one for each name.
  const code = commitNamesInIndex(root, ['\nstarts with a newline.js', asACommit('feat: forged'), 'ends with a space '], 'code', 'feat: code under such names');
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, false, row.detail);
  assert.match(row.detail, /^1 of 1 code commit since origin\/main have no Codex review record/);
  assert.deepEqual(row.lines.slice(0, -1), [`${short(root, code)} feat: code under such names`]);
  assert.equal(
    checkCodexReviewDebt(root).detail,
    `no Codex review record for 1 of 1 code commit since origin/main: the review of ${short(root, code)}^..HEAD is 1 part today, 3 changed lines in 3 files`,
  );
  // A commit that changes no file, between the two, is a commit with no name after its line.
  git(root, 'commit', '--allow-empty', '-m', 'chore: nothing');
  assert.match(checkCodexReviews(root, 'HEAD').detail, /^1 of 1 code commit since origin\/main have no Codex review record/);
  assert.equal(checkCodexReviews(root, documents).detail, 'no code commits since origin/main');
});

test('an answer of git that is not the commits and their files, as they were asked for, is not read as far as it goes', () => {
  const { root } = makeRepo();
  feature(root);
  const head = commit(root, 'b.js', 'two', 'feat: two');
  const line = `${head}\t${head.slice(0, 7)}\t${'a'.repeat(40)}\tfeat: two`;
  const answers = {
    'text before the first commit': `warning: something\n\0${line}\0\nb.js\0`,
    'a line that is no commit where one starts': `\0${head.slice(0, 12)}\tfeat: two\0\nb.js\0`,
    'a first name with no newline before it': `\0${line}\0b.js\0`,
    'an answer cut inside a name': `\0${line}\0\nb.j`,
    'an answer cut after the mark of a commit': `\0${line}\0\nb.js\0\0`,
  };
  for (const [which, stdout] of Object.entries(answers)) {
    const spawn = (cmd, args, opts) => (args[0] === 'log' ? { status: 0, stdout, stderr: '' } : spawnSync(cmd, args, opts));
    const row = checkCodexReviews(root, 'HEAD', { spawn });
    assert.equal(row.pass, false, which);
    assert.equal(row.detail, 'cannot list the commits in origin/main..HEAD', which);
    assert.equal(checkCodexReviewDebt(root, { spawn }).detail, `cannot tell how much code waits for a Codex review: ${row.detail}`, which);
  }
  // And the same answer, whole, is read.
  const whole = (cmd, args, opts) => (args[0] === 'log' ? { status: 0, stdout: `\0${line}\0\nb.js\0`, stderr: '' } : spawnSync(cmd, args, opts));
  assert.match(checkCodexReviews(root, 'HEAD', { spawn: whole }).detail, /^1 of 1 code commit since origin\/main have no Codex review record/);
});

/** Makes the commit at HEAD a signed one, and returns its new full id: the same commit with a `gpgsig`
 * header, written as an object, since signing for real needs a key. The signature is no signature, and git
 * hands it to the program that checks one all the same. */
function signHead(root) {
  const [headers, ...message] = git(root, 'cat-file', 'commit', 'HEAD').split('\n\n');
  const signature = ['-----BEGIN PGP SIGNATURE-----', '', 'bm90IGEgc2lnbmF0dXJl', '-----END PGP SIGNATURE-----'].join('\n ');
  const hashed = spawnSync('git', ['hash-object', '-t', 'commit', '-w', '--stdin'], { cwd: root, encoding: 'utf8', input: `${headers}\ngpgsig ${signature}\n\n${message.join('\n\n')}\n` });
  assert.equal(hashed.status, 0, hashed.stderr);
  git(root, 'update-ref', 'HEAD', hashed.stdout.trim());
  return hashed.stdout.trim();
}

test('a signed commit is listed as any other in a repository that shows signatures: what git says of one is not in the list', () => {
  // The finding this is the test of. With `log.showSignature` git writes what the program that checks a
  // signature said, before the line of the commit: the list was then of another shape, and the push check
  // failed a branch whose every commit had a record.
  const { root, base } = makeRepo();
  feature(root);
  commit(root, 'b.js', 'two', 'feat: two');
  const signed = signHead(root);
  // A program of the test's own in place of gpg, so that no key ring of the machine is read or made: git
  // shows what it writes on its standard error, as it does for gpg. Git starts it through its own shell,
  // on Windows too.
  const checker = path.join(tmp('js-harness-check-push-gpg-'), 'not-gpg');
  fs.writeFileSync(checker, '#!/bin/sh\necho "not-gpg: nothing was verified" >&2\nexit 1\n', { mode: 0o755 });
  git(root, 'config', 'gpg.program', checker.replace(/\\/g, '/'));
  git(root, 'config', 'log.showSignature', 'true');
  // The reproduction is real: asked as any command asks, git puts that text before the commit.
  assert.match(git(root, 'log', '--format=%H', `${base}..HEAD`), /^not-gpg: nothing was verified\n[0-9a-f]{40}$/);
  const uncovered = checkCodexReviews(root, 'HEAD');
  assert.match(uncovered.detail, /^1 of 1 code commit since origin\/main have no Codex review record/);
  assert.match(checkCodexReviewDebt(root).detail, /^no Codex review record for 1 of 1 code commit since origin\/main/);
  record(root, base, signed);
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, true, row.detail);
  assert.equal(row.detail, '1 code commit since origin/main, all covered by a Codex review record');
});

test('an unavailable record covers its range and shows up as a line, still passing', () => {
  const { root, base } = makeRepo();
  feature(root);
  const head = commit(root, 'b.js', 'two', 'feat: two');
  record(root, base, head, { outcome: 'unavailable', reason: 'model rejected' });
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, true);
  assert.deepEqual(row.lines, [`unavailable ${base.slice(0, 7)}..${head.slice(0, 7)}: model rejected`]);
});

test('an unavailable record that covers none of these commits is not listed', () => {
  const { root, base } = makeRepo();
  feature(root);
  const first = commit(root, 'b.js', 'two', 'feat: two');
  commit(root, 'c.js', 'three', 'feat: three');
  record(root, first, git(root, 'rev-parse', 'HEAD'));
  record(root, base, base, { outcome: 'unavailable', reason: 'empty range' });
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, false);
  assert.ok(!row.lines.some((line) => line.startsWith('unavailable')));
});

test('a record whose base no longer resolves is ignored and counted', () => {
  const { root, base } = makeRepo();
  feature(root);
  const head = commit(root, 'b.js', 'two', 'feat: two');
  record(root, base, head);
  record(root, 'f'.repeat(40), head);
  record(root, '--upload-pack=x', head);
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, true);
  assert.match(row.detail, /1 record ignored \(base or head not found\)/);
  assert.match(row.detail, /1 invalid record ignored/);
});

test('ignoring a record can leave a commit uncovered', () => {
  const { root } = makeRepo();
  feature(root);
  const head = commit(root, 'b.js', 'two', 'feat: two');
  record(root, 'f'.repeat(40), head);
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, false);
  assert.match(row.detail, /1 record ignored/);
});

test('a record whose head is outside the checked range is not expanded at all', () => {
  const { root, base } = makeRepo();
  feature(root);
  const head = commit(root, 'b.js', 'two', 'feat: two');
  record(root, base, head);
  record(root, base, base);
  record(root, 'e'.repeat(40), 'd'.repeat(40));
  const expanded = [];
  const spawn = (cmd, args, opts) => {
    if (args[0] === 'rev-list') expanded.push(args[1]);
    return spawnSync(cmd, args, opts);
  };
  const row = checkCodexReviews(root, 'HEAD', { spawn });
  assert.equal(row.pass, true);
  assert.ok(expanded.includes(`${base}..${head}`), 'the record whose head is in the range is expanded');
  assert.ok(!expanded.includes(`${base}..${base}`), 'a head on the default branch is skipped');
  assert.ok(!expanded.some((range) => range.startsWith('e'.repeat(40))), 'an unknown head is skipped');
});

test('a record whose head lies past the pushed tip still covers the commits of its range it contains', () => {
  const { root, base } = makeRepo();
  feature(root);
  const first = commit(root, 'b.js', 'two', 'feat: two');
  const second = commit(root, 'c.js', 'three', 'feat: three');
  assert.equal(checkCodexReviews(root, first).pass, false);
  record(root, base, second);
  const row = checkCodexReviews(root, first);
  assert.equal(row.pass, true, `${row.detail}`);
  assert.match(row.detail, /1 code commit since origin.main/);
});

test('a record of nothing to review covers its commits only when what is pushed holds its head', () => {
  const { root, base } = makeRepo();
  feature(root);
  const change = commit(root, 'b.js', 'two', 'feat: two');
  git(root, 'revert', '--no-edit', 'HEAD');
  const revert = git(root, 'rev-parse', 'HEAD');
  record(root, base, revert, { outcome: NOTHING_TO_REVIEW, reason: 'the range changes no file' });
  const both = checkCodexReviews(root, revert);
  assert.equal(both.pass, true, `the change and its revert are pushed together: ${both.detail}`);
  // The range changes no file only as a whole: the change alone is a patch nobody reviewed.
  const alone = checkCodexReviews(root, change);
  assert.equal(alone.pass, false, 'the change pushed without its revert is not covered');
  assert.match(alone.detail, /1 of 1 code commit/);
});

// What a review left out, as its record holds it (`reviewScope`): so many documents and so many marked files.
const leftOutOf = (documents, marked) => ({
  files: documents + marked,
  changedLines: documents + marked,
  documents: { files: documents, changedLines: documents },
  marked: { files: marked, changedLines: marked },
});

test('a review that left out files the project marks covers its commits only when what is pushed holds its head', () => {
  // The finding this is the test of. The marks are those of the head of the reviewed range, and a commit
  // of the range can be the one that adds them: at the commit before it the file is code, and nobody read it.
  const { root, base } = makeRepo();
  feature(root);
  const app = commit(root, 'src/app.js', 'code', 'feat: the application');
  const marks = commit(root, '.gitattributes', 'src/** -codex-review\n', 'chore: mark the application as left out');
  record(root, base, marks, { leftOut: leftOutOf(0, 1) });
  const both = checkCodexReviews(root, marks);
  assert.equal(both.pass, true, `pushed up to the head of the record: ${both.detail}`);
  assert.equal(both.detail, '1 code commit since origin/main, all covered by a Codex review record');
  const alone = checkCodexReviews(root, app);
  assert.equal(alone.pass, false, 'the application pushed without the commit that marks it is not covered');
  assert.match(alone.detail, /^1 of 1 code commit since origin\/main have no Codex review record/);
  assert.ok(alone.lines[0].startsWith(short(root, app)), alone.lines.join('\n'));
  // The plain row reads the same records.
  git(root, 'checkout', '--quiet', '--detach', app);
  assert.match(checkCodexReviewDebt(root).detail, /^no Codex review record for 1 of 1 code commit since origin\/main/);
  // And a commit past the head of the record is pushed with that head, so the record covers as any other.
  git(root, 'checkout', '--quiet', 'feature');
  commit(root, 'README.md', 'words', 'docs: a note');
  assert.equal(checkCodexReviews(root, 'HEAD').pass, true);
});

test('a review that left out documents alone still covers an earlier tip: no commit can make a Markdown file code', () => {
  const { root, base } = makeRepo();
  feature(root);
  const first = commit(root, 'b.js', 'two', 'feat: two');
  fs.writeFileSync(path.join(root, 'notes.md'), 'words', 'utf8');
  const second = commit(root, 'c.js', 'three', 'feat: three, with a note');
  record(root, base, second, { leftOut: leftOutOf(1, 0) });
  const row = checkCodexReviews(root, first);
  assert.equal(row.pass, true, row.detail);
  assert.equal(row.detail, '1 code commit since origin/main, all covered by a Codex review record');
});

// A record from before it said how many of the files it left out were marked, and ones a hand has been at.
const UNTOLD_LEFT_OUT = {
  'the two counts alone, as the first records of it were written': { files: 1, changedLines: 2 },
  'a count of marked files that is no count': { ...leftOutOf(1, 0), marked: { files: '0', changedLines: 0 } },
  'no count of files among the marked': { ...leftOutOf(1, 0), marked: {} },
  'something that is no count at all': 'two documents',
  'nothing where the counts would be': null,
};

for (const [shape, leftOut] of Object.entries(UNTOLD_LEFT_OUT)) {
  test(`a review whose record does not say that it left no marked file out (${shape}) covers as one that did: only pushed whole`, () => {
    const { root, base } = makeRepo();
    feature(root);
    const first = commit(root, 'b.js', 'two', 'feat: two');
    const second = commit(root, 'c.js', 'three', 'feat: three');
    record(root, base, second, { leftOut });
    assert.equal(checkCodexReviews(root, second).pass, true, 'pushed up to its head');
    const earlier = checkCodexReviews(root, first);
    assert.equal(earlier.pass, false, 'pushed short of its head');
    // It is a valid record all the same, and is not counted among the invalid ones.
    assert.match(earlier.detail, /^1 of 1 code commit since origin\/main have no Codex review record \([^)]*\)$/);
  });
}

test('a record on an unrelated branch is still not expanded, even when checking an older head', () => {
  const { root, base } = makeRepo();
  feature(root);
  const first = commit(root, 'b.js', 'two', 'feat: two');
  git(root, 'checkout', '-b', 'side', base);
  const side = commit(root, 's.js', 'side', 'feat: side work');
  record(root, base, side);
  const expanded = [];
  const spawn = (cmd, args, opts) => {
    if (args[0] === 'rev-list') expanded.push(args[1]);
    return spawnSync(cmd, args, opts);
  };
  const row = checkCodexReviews(root, first, { spawn });
  assert.equal(row.pass, false);
  assert.ok(!expanded.includes(`${base}..${side}`), expanded.join('\n'));
});

/** A `spawn` that runs git for real and keeps, in `started`, the git command of each process it starts. */
function countingSpawn() {
  const started = [];
  const spawn = (cmd, args, opts) => {
    started.push(args.find((arg) => !arg.startsWith('-') && !arg.includes('=')));
    return spawnSync(cmd, args, opts);
  };
  return { spawn, started };
}

/** A branch of two code commits with a record whose head lies past `first`, the commit that is checked,
 * and `unrelated` more records of history the default branch already holds. */
function repoWithUnrelatedRecords(unrelated) {
  return copyOf(`a branch with ${unrelated} unrelated records`, () => {
    const { root, base } = makeRepo();
    const older = commit(root, 'old.js', 'old', 'feat: merged long ago');
    git(root, 'update-ref', 'refs/remotes/origin/main', older);
    feature(root);
    const first = commit(root, 'b.js', 'two', 'feat: two');
    const second = commit(root, 'c.js', 'three', 'feat: three');
    record(root, older, second);
    for (let i = 0; i < unrelated; i += 1) record(root, base, older);
    return { root, first };
  });
}

test('the records whose head is outside the range cost one git process together, not one each', () => {
  // Every review ever made leaves a record, and most are of history the default branch already holds.
  const processes = (unrelated) => {
    const { root, first } = repoWithUnrelatedRecords(unrelated);
    const { spawn, started } = countingSpawn();
    const row = checkCodexReviews(root, first, { spawn });
    assert.equal(row.pass, true, row.detail);
    assert.ok(!started.includes('merge-base'), started.join(' '));
    return started.length;
  };
  assert.equal(processes(12), processes(1));
});

test('a record whose head this repository no longer knows is passed over in that one process, for both rows', () => {
  // A branch that was deleted and pruned leaves such records behind: valid, and of a commit that is gone.
  const { root, first } = repoWithUnrelatedRecords(1);
  record(root, git(root, 'rev-parse', 'origin/main'), 'c'.repeat(40));
  const push = countingSpawn();
  const row = checkCodexReviews(root, first, { spawn: push.spawn });
  assert.equal(row.pass, true, row.detail);
  assert.ok(!push.started.includes('merge-base'), push.started.join(' '));
  const plain = countingSpawn();
  assert.match(checkCodexReviewDebt(root, { spawn: plain.spawn }).detail, /^2 code commits since origin\/main, all covered/);
  assert.ok(!plain.started.includes('merge-base'), plain.started.join(' '));
});

test('when git cannot say which heads lie past the tip all at once, each is asked about on its own', () => {
  const { root, first } = repoWithUnrelatedRecords(2);
  const asked = [];
  const spawn = (cmd, args, opts) => {
    if (args.includes('--ancestry-path')) return { status: 129, stdout: '', stderr: 'usage: git rev-list' };
    if (args[0] === 'merge-base') asked.push(args[args.length - 1]);
    return spawnSync(cmd, args, opts);
  };
  const row = checkCodexReviews(root, first, { spawn });
  assert.equal(row.pass, true, row.detail);
  assert.equal(asked.length, 2, 'one question for each distinct head outside the range');
});

// --- only a valid record is evidence ---

const INVALID_SHAPES = {
  'a wrong schema': (r) => ({ ...r, schema: 'js-harness.codex-review/v2' }),
  'no schema': ({ schema, ...r }) => r,
  'a short base id': (r) => ({ ...r, base: r.base.slice(0, 12) }),
  'a non-hex head id': (r) => ({ ...r, head: 'g'.repeat(40) }),
  'a non-string base': (r) => ({ ...r, base: 42 }),
  'a non-string reviewedAt': (r) => ({ ...r, reviewedAt: 1790000000 }),
  'an unknown outcome': (r) => ({ ...r, outcome: 'approved' }),
  'no outcome': ({ outcome, ...r }) => r,
  'unavailable without a reason': (r) => ({ ...r, outcome: 'unavailable' }),
  'unavailable with a blank reason': (r) => ({ ...r, outcome: 'unavailable', reason: '   ' }),
  'unavailable with a non-string reason': (r) => ({ ...r, outcome: 'unavailable', reason: 7 }),
};

for (const [shape, invalidate] of Object.entries(INVALID_SHAPES)) {
  test(`a record with ${shape} is not evidence, and the detail counts it`, () => {
    const { root, base } = makeRepo();
    feature(root);
    const head = commit(root, 'b.js', 'two', 'feat: two');
    const good = { schema: CODEX_REVIEW_SCHEMA, base, head, reviewedAt: '2026-09-29T00:00:00.000Z', outcome: 'reviewed' };
    appendCodexReview(root, invalidate(good));
    const row = checkCodexReviews(root, 'HEAD');
    assert.equal(row.pass, false, row.detail);
    assert.match(row.detail, /1 invalid record ignored/);
  });
}

test('a valid record still counts next to invalid ones', () => {
  const { root, base } = makeRepo();
  feature(root);
  const head = commit(root, 'b.js', 'two', 'feat: two');
  appendCodexReview(root, { base, head });
  record(root, base, head);
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, true);
  assert.match(row.detail, /1 invalid record ignored/);
});

test('a remote that is not configured, such as the URL git passes to a hook, gets a hint that works', () => {
  const { root } = makeRepo();
  feature(root);
  commit(root, 'b.js', 'two', 'feat: two');
  const url = 'https://example.invalid/somewhere.git';
  const row = checkCodexReviews(root, 'HEAD', { remote: url });
  assert.equal(row.pass, false);
  assert.match(row.detail, /not a configured remote/);
  const lines = row.lines.join('\n');
  assert.match(lines, /git remote add <name> <url>/);
  assert.doesNotMatch(lines, /set-head/);
});

test('a configured remote with no default branch still names set-head', () => {
  const { root } = makeRepo(null);
  const row = checkCodexReviews(root, 'HEAD');
  assert.ok(row.lines.some((line) => line.includes('git remote set-head origin --auto')));
});

test('a repository with no refs of the remote fails, naming the command that sets its default branch', () => {
  const { root } = makeRepo(null);
  feature(root);
  commit(root, 'b.js', 'two', 'feat: two');
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, false);
  assert.match(row.detail, /no default branch of origin/i);
  assert.ok(row.lines.some((line) => line.includes('git remote set-head origin --auto')), row.lines.join('\n'));
});

// S10: the first push of a project to an empty repository passes and says so: what went unread, and the
// command that reviews it, which plans its cost first. Only where the remote holds no branch at all.

/** A repository whose `origin` is a bare repository on disk, with no refs of it fetched; `branch` pushed
 * there first when given, so the remote holds it. */
function makeFirstPushRepo(branch = null) {
  const remote = tmp('js-harness-check-empty-remote-');
  git(remote, 'init', '--bare');
  const { root, base } = makeRepo(null);
  git(root, 'remote', 'set-url', 'origin', remote);
  if (branch) {
    git(root, 'push', '-q', 'origin', `HEAD:refs/heads/${branch}`);
    // A push writes the remote-tracking ref of what it pushed: drop it, as a clone that never fetched holds none.
    git(root, 'update-ref', '-d', `refs/remotes/origin/${branch}`);
  }
  return { root, base };
}

test('the first push to an empty repository passes, says what went unread and the command that reviews it', () => {
  const { root, base } = makeFirstPushRepo();
  commit(root, 'b.js', 'two\nthree\n', 'feat: two');
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, true, row.detail);
  assert.match(row.detail, /origin holds no branch yet, so this first push passes with no Codex review/);
  const lines = row.lines.join('\n');
  assert.match(lines, /2 commits went unread by Codex: 3 changed lines in 2 files/);
  assert.match(lines, new RegExp(`js-harness codex-review --base ${base.slice(0, 7)} --plan`));
  assert.match(lines, new RegExp(`${base.slice(0, 7)} itself, the first commit, is in no range`));
});

test('a remote that holds a branch not fetched here is no first push: the row still fails', () => {
  const { root } = makeFirstPushRepo('main');
  feature(root);
  commit(root, 'b.js', 'two', 'feat: two');
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, false);
  assert.match(row.detail, /no default branch of origin/i);
});

test('a local main is never the base: with no origin refs it still fails', () => {
  const { root } = makeRepo(null);
  git(root, 'branch', 'master');
  feature(root);
  commit(root, 'b.js', 'two', 'feat: two');
  assert.equal(checkCodexReviews(root, 'HEAD').pass, false);
});

test('origin/master is the default branch when there is no origin/main', () => {
  const { root, base } = makeRepo('master');
  feature(root);
  const head = commit(root, 'b.js', 'two', 'feat: two');
  record(root, base, head);
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, true);
  assert.match(row.detail, /since origin\/master/);
});

test('origin/HEAD names the default branch before origin/main does', () => {
  const { root, base } = makeRepo();
  const ahead = commit(root, 'b.js', 'two', 'feat: two');
  git(root, 'update-ref', 'refs/remotes/origin/main', ahead);
  git(root, 'update-ref', 'refs/remotes/origin/develop', base);
  git(root, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/develop');
  const row = checkCodexReviews(root, 'HEAD');
  assert.match(row.detail, /since origin\/develop/);
  assert.equal(row.pass, false);
  assert.ok(row.lines.join('\n').includes(short(root, ahead)));
});

test('a local main ahead of origin/main with no origin/HEAD reports the unreviewed commits', () => {
  // The push case that used to pass: main itself is being pushed, so a local main as the base
  // left nothing to check.
  const { root } = makeRepo();
  const first = commit(root, 'b.js', 'two', 'feat: two, on main');
  const second = commit(root, 'c.js', 'three', 'feat: three, on main');
  const row = checkCodexReviews(root, 'main');
  assert.equal(row.pass, false);
  const lines = row.lines.join('\n');
  assert.ok(lines.includes(short(root, first)) && lines.includes(short(root, second)), lines);
});

test('--remote picks another remote', () => {
  const { root, base } = makeRepo(null);
  git(root, 'remote', 'add', 'upstream', 'https://example.invalid/upstream.git');
  git(root, 'update-ref', 'refs/remotes/upstream/main', base);
  feature(root);
  commit(root, 'b.js', 'two', 'feat: two');
  assert.equal(checkCodexReviews(root, 'HEAD').pass, false);
  const row = checkCodexReviews(root, 'HEAD', { remote: 'upstream' });
  assert.match(row.detail, /since upstream\/main/);
  assert.match(row.detail, /1 of 1/);
});

test('a root commit gets no ^ hint, and the hint that would reach it is named', () => {
  const { root, base } = makeRepo();
  git(root, 'checkout', '--orphan', 'unrelated');
  const rootCommit = commit(root, 'z.js', 'unrelated history', 'feat: a root commit');
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, false);
  const lines = row.lines.join('\n');
  assert.ok(lines.includes(short(root, rootCommit)), lines);
  assert.ok(!lines.includes(`--base ${short(root, rootCommit)}^`), lines);
  assert.match(lines, /root commit/);
  assert.match(lines, /--unavailable <reason>/);
  // What the hint says is true: a range from the unrelated default branch does reach the root.
  record(root, base, rootCommit);
  assert.equal(checkCodexReviews(root, 'HEAD').pass, true);
});

test('a root commit lists its files whatever `log.showRoot` the repository sets: it is a code commit like another', () => {
  // With `log.showRoot` off git lists no file for a commit that has no parent, and a commit that lists no
  // file needs no record.
  const { root } = makeRepo();
  git(root, 'checkout', '--orphan', 'unrelated');
  const rootCommit = commit(root, 'z.js', 'unrelated history', 'feat: a root commit');
  git(root, 'config', 'log.showRoot', 'false');
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, false, row.detail);
  assert.match(row.detail, /^1 of 1 code commit since origin\/main have no Codex review record/);
  assert.ok(row.lines[0].startsWith(short(root, rootCommit)), row.lines.join('\n'));
  assert.match(checkCodexReviewDebt(root).detail, /^no Codex review record for 1 of 1 code commit since origin\/main/);
});

test('--head checks that commit instead of HEAD', () => {
  const { root, base } = makeRepo();
  feature(root);
  const first = commit(root, 'b.js', 'two', 'feat: two');
  commit(root, 'c.js', 'three', 'feat: three');
  record(root, base, first);
  assert.equal(checkCodexReviews(root, first).pass, true);
  assert.equal(checkCodexReviews(root, 'HEAD').pass, false);
});

test('an unresolvable head fails instead of passing on an empty range', () => {
  const { root } = makeRepo();
  const row = checkCodexReviews(root, 'no-such-rev');
  assert.equal(row.pass, false);
  assert.match(row.detail, /no-such-rev/);
});

test('outside a git repository the row fails', () => {
  const row = checkCodexReviews(tmp('js-harness-check-push-nongit-'), 'HEAD');
  assert.equal(row.pass, false);
  assert.match(row.detail, /git repository/i);
});

// --- the plain check: how much code waits for a Codex review, as information ---

/** `count` lines of text, each its own line of a file. */
const lines = (count) => 'line\n'.repeat(count);

/** Commits several files at once, `files` being `{ <path>: <content> }`, and returns the commit's full id. */
function commitFiles(root, files, message) {
  const [[last, content], ...rest] = Object.entries(files).reverse();
  for (const [file, text] of rest) fs.writeFileSync(path.join(root, file), text, 'utf8');
  return commit(root, last, content, message);
}

const isInformation = (row) => row.name === 'codex-review' && row.pass === true && row.info === true;

test('the plain row counts the code commits with no record and sizes the review that would cover them', () => {
  const { root, base } = makeRepo();
  feature(root);
  const reviewed = commit(root, 'b.js', lines(4), 'feat: two');
  record(root, base, reviewed);
  const oldest = commit(root, 'c.js', lines(3), 'feat: three, not reviewed');
  const newest = commit(root, 'd.js', lines(5), 'feat: four, not reviewed');
  const row = checkCodexReviewDebt(root);
  assert.ok(isInformation(row), JSON.stringify(row));
  assert.match(row.detail, /no Codex review record for 2 of 3 code commits since origin\/main/);
  // The review that would cover them is of the range from the parent of the oldest one to HEAD, as
  // `js-harness codex-review --base <oldest>^` would size it today.
  assert.ok(row.detail.includes(`the review of ${short(root, oldest)}^..HEAD is 1 part today, 8 changed lines in 2 files`), row.detail);
  assert.deepEqual(row.lines, [
    `${short(root, newest)} feat: four, not reviewed`,
    `${short(root, oldest)} feat: three, not reviewed`,
    `make the record with: js-harness codex-review --base ${short(root, oldest)}^`,
    `what it would cost, with nothing spent: js-harness codex-review --base ${short(root, oldest)}^ --plan`,
  ]);
});

test('the plain row names each code commit no record covers, as the push check does, and the command that records them', () => {
  const { root } = makeRepo();
  feature(root);
  const first = commit(root, 'b.js', 'two', 'feat: two');
  const second = commit(root, 'c.js', 'three', 'feat: three, never reviewed');
  const row = checkCodexReviewDebt(root);
  assert.ok(isInformation(row), JSON.stringify(row));
  assert.match(row.detail, /^no Codex review record for 2 of 2 code commits since origin\/main/);
  const said = row.lines.join('\n');
  assert.ok(row.lines.includes(`${short(root, first)} feat: two`), said);
  assert.ok(row.lines.includes(`${short(root, second)} feat: three, never reviewed`), said);
  // The record starts at the parent of the oldest of them.
  assert.ok(row.lines.includes(`make the record with: js-harness codex-review --base ${short(root, first)}^`), said);
});

test('with a record that covers one of them, the plain row names only the commit no record covers', () => {
  const { root, base } = makeRepo();
  feature(root);
  const first = commit(root, 'b.js', 'two', 'feat: two');
  const second = commit(root, 'c.js', 'three', 'feat: three, never reviewed');
  record(root, base, first);
  const row = checkCodexReviewDebt(root);
  assert.ok(isInformation(row), JSON.stringify(row));
  assert.match(row.detail, /^no Codex review record for 1 of 2 code commits since origin\/main/);
  const said = row.lines.join('\n');
  assert.ok(row.lines.includes(`${short(root, second)} feat: three, never reviewed`), said);
  assert.ok(!row.lines.some((line) => line.startsWith(short(root, first))), said);
  assert.ok(row.lines.includes(`make the record with: js-harness codex-review --base ${short(root, second)}^`), said);
});

test('with every code commit covered, the plain row is what it was and names no commit', () => {
  const { root, base } = makeRepo();
  feature(root);
  commit(root, 'b.js', 'two', 'feat: two');
  const head = commit(root, 'c.js', 'three', 'feat: three');
  record(root, base, head);
  const row = checkCodexReviewDebt(root);
  assert.ok(isInformation(row), JSON.stringify(row));
  assert.equal(row.detail, '2 code commits since origin/main, all covered by a Codex review record');
  assert.equal(row.lines, undefined);
});

test('the plain row sizes a review in thousands of changed lines and in parts', () => {
  const { root } = makeRepo();
  feature(root);
  const oldest = commitFiles(root, { 'b.js': lines(300), 'c.js': lines(300), 'd.js': lines(450) }, 'feat: three files');
  const row = checkCodexReviewDebt(root);
  assert.ok(isInformation(row), JSON.stringify(row));
  assert.ok(row.detail.includes(`the review of ${short(root, oldest)}^..HEAD is 3 parts today, 1,050 changed lines in 3 files`), row.detail);
  assert.doesNotMatch(row.detail, /max-parts/);
  assert.deepEqual(row.lines, [
    `${short(root, oldest)} feat: three files`,
    `make the record with: js-harness codex-review --base ${short(root, oldest)}^`,
    `what it would cost, with nothing spent: js-harness codex-review --base ${short(root, oldest)}^ --plan`,
  ]);
});

test('the plain row names a base that exists for a root commit, as the push check does', () => {
  const { root } = makeRepo();
  git(root, 'checkout', '--orphan', 'unrelated');
  const rootCommit = commit(root, 'z.js', 'unrelated history', 'feat: a root commit');
  const row = checkCodexReviewDebt(root);
  assert.ok(isInformation(row), JSON.stringify(row));
  // The two histories share no commit to size a review from, and `js-harness codex-review` refuses such a
  // range: the row counts the commit and says the size could not be told, instead of sizing a review that
  // cannot be run.
  assert.equal(row.detail, 'no Codex review record for 1 of 1 code commit since origin/main: how large the review of origin/main..HEAD is today could not be told');
  const said = [row.detail, ...row.lines].join('\n');
  // The commit is named, and no line names its `^`, which does not exist: both commands start from the
  // default branch.
  assert.ok(row.lines.includes(`${short(root, rootCommit)} feat: a root commit`), said);
  assert.ok(!said.includes(`${short(root, rootCommit)}^`), said);
  assert.ok(row.lines.includes('make the record with: js-harness codex-review --base origin/main'), said);
  assert.ok(said.includes('js-harness codex-review --base origin/main --plan'), said);
});

/** A default branch that moved on by one commit of 40 lines, and a branch off it that merged in work which
 * forked before it moved: a record covers the branch's own commit, and none the commit of that work. */
function repoWithWorkForkedEarlier() {
  return copyOf('work that forked before the default branch moved', () => {
    const { root, base } = makeRepo();
    const moved = commit(root, 'main.js', lines(40), 'feat: on the default branch');
    git(root, 'update-ref', 'refs/remotes/origin/main', moved);
    feature(root);
    const mine = commit(root, 'b.js', lines(4), 'feat: two');
    record(root, moved, mine);
    git(root, 'checkout', '--quiet', '-b', 'side', base);
    commit(root, 's.js', lines(3), 'feat: side work, forked before the default branch moved');
    git(root, 'checkout', '--quiet', 'feature');
    git(root, 'merge', '--no-ff', '-m', 'merge side', 'side');
    return { root };
  }).root;
}

test('the plain row sizes the review from where `js-harness codex-review` would start it, which is not always the parent of the oldest commit', () => {
  const root = repoWithWorkForkedEarlier();
  const row = checkCodexReviewDebt(root);
  assert.ok(isInformation(row), JSON.stringify(row));
  // From the parent of the side commit the review would read the 40 lines the default branch already
  // holds. That command starts such a review at the default branch, and so does the size said here.
  assert.equal(row.detail, 'no Codex review record for 1 of 2 code commits since origin/main: the review of origin/main..HEAD is 1 part today, 7 changed lines in 2 files');
  // The command that makes the record is given the base the size was read from: the row names one review.
  assert.deepEqual(row.lines, [
    `${short(root, 'side')} feat: side work, forked before the default branch moved`,
    'make the record with: js-harness codex-review --base origin/main',
    'what it would cost, with nothing spent: js-harness codex-review --base origin/main --plan',
  ]);
});

test('the plain row sizes no review when git does not say where the range starts: a `merge-base` that failed is not two histories that share no commit', () => {
  const root = repoWithWorkForkedEarlier();
  // Only the question of where the range starts goes unanswered: every other git process answers, the
  // `rev-list` that says a later start reaches every uncovered commit among them.
  const spawn = (cmd, args, opts) =>
    args[0] === 'merge-base' && args[1] !== '--is-ancestor' ? { status: 128, stdout: '', stderr: 'fatal: unable to read tree' } : spawnSync(cmd, args, opts);
  const row = checkCodexReviewDebt(root, { spawn });
  assert.ok(isInformation(row), JSON.stringify(row));
  // Taken for no shared history, that failure would leave the start held to no commit: the review would be
  // sized from the parent of the side commit, 47 changed lines in 3 files, 40 of them the default branch's.
  assert.equal(row.detail, 'no Codex review record for 1 of 2 code commits since origin/main: how large the review of origin/main..HEAD is today could not be told');
  assert.deepEqual(row.lines, [
    `${short(root, 'side')} feat: side work, forked before the default branch moved`,
    'make the record with: js-harness codex-review --base origin/main',
    'what it would cost, with nothing spent: js-harness codex-review --base origin/main --plan',
  ]);
});

/** A branch whose one code commit, never reviewed, changes `count` files that are each a part of their own. */
function repoOfParts(count) {
  const { root } = makeRepo();
  feature(root);
  const files = Object.fromEntries(Array.from({ length: count }, (_, at) => [`part-${at}.js`, lines(PART_MAX_CHANGED_LINES + 1)]));
  return { root, oldest: commitFiles(root, files, 'feat: a branch nobody reviewed slice by slice') };
}

test('the plain row says a review is already more parts than a run starts, and that reviewing now is cheaper', () => {
  const { root, oldest } = repoOfParts(MAX_PARTS_WITHOUT_FLAG + 1);
  const row = checkCodexReviewDebt(root);
  assert.ok(isInformation(row), JSON.stringify(row));
  assert.ok(row.detail.includes(`is ${MAX_PARTS_WITHOUT_FLAG + 1} parts today`), row.detail);
  assert.ok(row.detail.endsWith(`already more parts than the ${MAX_PARTS_WITHOUT_FLAG} a run starts without \`--max-parts\``), row.detail);
  assert.deepEqual(row.lines, [
    `${short(root, oldest)} feat: a branch nobody reviewed slice by slice`,
    `make the record with: js-harness codex-review --base ${short(root, oldest)}^`,
    'the cheaper way is to review now: every commit added to this range makes its review larger',
    `what it would cost, with nothing spent: js-harness codex-review --base ${short(root, oldest)}^ --plan`,
  ]);
});

test('the plain row says nothing of --max-parts for a review of as many parts as a run starts', () => {
  const { root } = repoOfParts(MAX_PARTS_WITHOUT_FLAG);
  const row = checkCodexReviewDebt(root);
  assert.ok(isInformation(row), JSON.stringify(row));
  assert.ok(row.detail.includes(`is ${MAX_PARTS_WITHOUT_FLAG} parts today`), row.detail);
  assert.doesNotMatch([row.detail, ...row.lines].join('\n'), /max-parts|cheaper/);
});

test('the plain row says of a range that changes no file as a whole that its review has no part', () => {
  const { root } = makeRepo();
  feature(root);
  const change = commit(root, 'b.js', 'two', 'feat: two');
  git(root, 'revert', '--no-edit', 'HEAD');
  const row = checkCodexReviewDebt(root);
  assert.ok(isInformation(row), JSON.stringify(row));
  assert.equal(
    row.detail,
    `no Codex review record for 2 of 2 code commits since origin/main: the review of ${short(root, change)}^..HEAD has no part today, since the range changes no file as a whole`,
  );
});

test('the plain row says in one short detail that every code commit is covered', () => {
  const { root, base } = makeRepo();
  feature(root);
  commit(root, 'b.js', 'two', 'feat: two');
  const head = commit(root, 'c.js', 'three', 'feat: three');
  record(root, base, head);
  assert.deepEqual(checkCodexReviewDebt(root), {
    name: 'codex-review',
    pass: true,
    info: true,
    detail: '2 code commits since origin/main, all covered by a Codex review record',
  });
});

test('the plain row says there is no code commit when the branch holds none', () => {
  const { root } = makeRepo();
  feature(root);
  commit(root, 'docs/notes.md', 'words', 'docs: notes');
  const row = checkCodexReviewDebt(root);
  assert.ok(isInformation(row), JSON.stringify(row));
  assert.equal(row.detail, 'no code commits since origin/main');
  assert.equal(row.lines, undefined);
});

test('the plain row counts the records that are no review and leaves their listing to the push check', () => {
  const { root, base } = makeRepo();
  feature(root);
  const first = commit(root, 'b.js', 'two', 'feat: two');
  record(root, base, first, { outcome: 'unavailable', reason: 'model rejected' });
  const change = commit(root, 'c.js', 'three', 'feat: three');
  git(root, 'revert', '--no-edit', 'HEAD');
  record(root, first, git(root, 'rev-parse', 'HEAD'), { outcome: NOTHING_TO_REVIEW, reason: 'the range changes no file' });
  appendCodexReview(root, { base: first, head: change });
  const row = checkCodexReviewDebt(root);
  assert.ok(isInformation(row), JSON.stringify(row));
  assert.equal(
    row.detail,
    '3 code commits since origin/main, all covered by a Codex review record ' +
      '(2 of the records that cover them are a skip or a range with nothing to review: js-harness check --push lists them); 1 invalid record ignored',
  );
  assert.equal(row.lines, undefined, 'the listing is the push check\'s');
  // The push check, over the same records, is the one that lists them.
  assert.equal(checkCodexReviews(root, 'HEAD').lines.length, 2);
});

// A fresh clone, a project with no remote, a folder that is no repository: the plain check runs in all of
// them at every commit, and what it cannot tell must never turn it red.
const CANNOT_TELL = {
  'a repository with no refs of the remote': {
    make: () => {
      const { root } = makeRepo(null);
      feature(root);
      commit(root, 'b.js', 'two', 'feat: two');
      return [root];
    },
    why: 'no default branch of origin to compare against (refs/remotes/origin/HEAD, origin/main or origin/master), so there is no range to check',
  },
  'a repository with no remote of that name': {
    make: () => {
      const root = tmp('js-harness-check-plain-');
      git(root, 'init');
      git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
      git(root, 'config', 'user.name', 'js-harness test');
      commit(root, 'a.js', 'one', 'init');
      return [root];
    },
    why: 'origin is not a configured remote, so there is no default branch to compare against',
  },
  'a repository with no commit yet': {
    make: () => {
      const root = tmp('js-harness-check-plain-');
      git(root, 'init');
      // A program not yet committed: with none, the review is off here and the row says that first (S7).
      fs.writeFileSync(path.join(root, 'a.js'), 'one', 'utf8');
      return [root];
    },
    why: 'HEAD does not name a commit',
  },
  'a folder that is no git repository': {
    make: () => [tmp('js-harness-check-plain-nongit-')],
    why: 'this is not a git repository',
  },
  'a git that cannot be started': {
    make: () => [
      makeRepo().root,
      {
        spawn: () => {
          throw new Error('spawnSync git ENOENT');
        },
      },
    ],
    why: 'this is not a git repository',
  },
};

for (const [state, { make, why }] of Object.entries(CANNOT_TELL)) {
  test(`in ${state} the plain row says it cannot tell and why, and fails nothing`, () => {
    assert.deepEqual(checkCodexReviewDebt(...make()), {
      name: 'codex-review',
      pass: true,
      info: true,
      detail: `cannot tell how much code waits for a Codex review: ${why}`,
    });
  });
}

test('the plain row says the size could not be told when git cannot size the range, and still counts the commits', () => {
  const { root } = makeRepo();
  feature(root);
  const head = commit(root, 'b.js', 'two', 'feat: two');
  const spawn = (cmd, args, opts) => (args[0] === 'diff' ? { status: 128, stdout: '', stderr: 'fatal' } : spawnSync(cmd, args, opts));
  const row = checkCodexReviewDebt(root, { spawn });
  assert.ok(isInformation(row), JSON.stringify(row));
  assert.equal(
    row.detail,
    `no Codex review record for 1 of 1 code commit since origin/main: how large the review of ${short(root, head)}^..HEAD is today could not be told`,
  );
  assert.deepEqual(row.lines, [
    `${short(root, head)} feat: two`,
    `make the record with: js-harness codex-review --base ${short(root, head)}^`,
    `what it would cost, with nothing spent: js-harness codex-review --base ${short(root, head)}^ --plan`,
  ]);
});

test('the plain row is measured against the remote it is given', () => {
  const { root, base } = makeRepo(null);
  git(root, 'remote', 'add', 'upstream', 'https://example.invalid/upstream.git');
  git(root, 'update-ref', 'refs/remotes/upstream/main', base);
  feature(root);
  commit(root, 'b.js', 'two', 'feat: two');
  assert.match(checkCodexReviewDebt(root).detail, /^cannot tell/);
  assert.match(checkCodexReviewDebt(root, { remote: 'upstream' }).detail, /^no Codex review record for 1 of 1 code commit since upstream\/main/);
});

test('the plain row starts a handful of git processes, however many records there are', () => {
  const processes = (unrelated) => {
    const { root } = repoWithUnrelatedRecords(unrelated);
    const { spawn, started } = countingSpawn();
    const row = checkCodexReviewDebt(root, { spawn });
    assert.match(row.detail, /^2 code commits since origin\/main, all covered/);
    return started.length;
  };
  const few = processes(1);
  assert.equal(processes(12), few);
  assert.ok(few <= 12, `${few} git processes`);
});

// --- main: the failing row appears only with --push, the informational one only without ---

async function runCheck(argv, deps = {}) {
  let output = '';
  let errOutput = '';
  const [log, error] = [console.log, console.error];
  console.log = (line) => {
    output += `${line}\n`;
  };
  console.error = (line) => {
    errOutput += `${line}\n`;
  };
  try {
    const code = await main(argv, { JS_HARNESS_CHECK_INNER: '1' }, deps);
    return { code, output, errOutput };
  } finally {
    console.log = log;
    console.error = error;
  }
}

/** A project, with its `AGENTS.md`, whose one code commit, `head`, no review record covers; `home` is a
 * state dir of the caller's own. */
function projectWithUnreviewedCommit() {
  const project = copyOf('a project with an unreviewed commit', () => {
    const { root } = makeRepo();
    fs.writeFileSync(path.join(root, 'AGENTS.md'), 'short', 'utf8');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'docs: agents');
    git(root, 'update-ref', 'refs/remotes/origin/main', 'main');
    feature(root);
    const head = commit(root, 'b.js', 'two', 'feat: two');
    return { root, head };
  });
  return { ...project, home: tmp('js-harness-check-push-home-') };
}

test('plain check prints the codex-review row as information and exits 0 on an uncovered commit', async () => {
  const { root, head, home } = projectWithUnreviewedCommit();
  const { code, output } = await runCheck(['--cwd', root, '--home', home]);
  assert.equal(code, 0, output);
  assert.match(output, /^INFO {2}codex-review {2}no Codex review record for 1 of 1 code commit since origin\/main: the review of /m);
  assert.ok(output.includes(`\n      what it would cost, with nothing spent: js-harness codex-review --base ${short(root, head)}^ --plan`), output);
  // The row that fails is the push check's: here the same commit is information.
  assert.doesNotMatch(output, /^(PASS|FAIL) {2}codex-review/m);
  assert.equal(output.split('\n').filter((l) => /^(PASS|FAIL|INFO) {2}codex-review /.test(l)).length, 1, output);
});

test('plain check exits 0 where the row cannot tell: a project with no remote, a folder that is no repository', async () => {
  const noRemote = tmp('js-harness-check-plain-');
  git(noRemote, 'init');
  const noRepository = tmp('js-harness-check-plain-nongit-');
  // A program in each, not committed: with none, the review is off there and the row says that first (S7).
  for (const root of [noRemote, noRepository]) {
    fs.writeFileSync(path.join(root, 'AGENTS.md'), 'short', 'utf8');
    fs.writeFileSync(path.join(root, 'a.js'), 'one', 'utf8');
    const { code, output } = await runCheck(['--cwd', root, '--home', tmp('js-harness-check-push-home-')]);
    assert.equal(code, 0, output);
    assert.match(output, /^INFO {2}codex-review {2}cannot tell how much code waits for a Codex review: /m);
  }
});

test('plain check --remote measures the row against that remote', async () => {
  const { root, home } = projectWithUnreviewedCommit();
  git(root, 'remote', 'add', 'mirror', 'https://example.invalid/mirror.git');
  git(root, 'update-ref', 'refs/remotes/mirror/main', 'HEAD');
  const { code, output } = await runCheck(['--remote', 'mirror', '--cwd', root, '--home', home]);
  assert.equal(code, 0, output);
  assert.match(output, /^INFO {2}codex-review {2}no code commits since mirror\/main$/m);
});

// --- the plain row fails nothing, whatever fails under it ---

const recordsFile = (root) => path.join(root, '.git', 'js-harness', 'codex-reviews.jsonl');

/** A project whose one code commit a review record covers: the row has a record to read and a range to expand. */
function projectWithReviewedCommit() {
  const project = projectWithUnreviewedCommit();
  record(project.root, git(project.root, 'rev-parse', `${project.head}^`), project.head);
  return project;
}

/** The detail of the plain row of `root`, having checked that it is information and that `main` prints it
 * and exits 0. `makeGit`, when given, makes the `spawn` the row runs git through, a new one for each run. */
async function informationOf(root, home, makeGit) {
  const row = checkCodexReviewDebt(root, makeGit ? { spawn: makeGit() } : {});
  assert.ok(isInformation(row), JSON.stringify(row));
  const { code, output } = await runCheck(['--cwd', root, '--home', home], makeGit ? { git: makeGit() } : {});
  assert.equal(code, 0, output);
  assert.ok(output.includes(`\nINFO  codex-review  ${row.detail}\n`), output);
  return row.detail;
}

test('a records file that cannot be read is no record to the plain row, which stays information', async () => {
  const { root, home } = projectWithReviewedCommit();
  assert.match(await informationOf(root, home), /^1 code commit since origin\/main, all covered/);
  // A folder where the file should be: reading it fails, and the reader of the records answers with none.
  fs.rmSync(recordsFile(root));
  fs.mkdirSync(recordsFile(root));
  assert.match(await informationOf(root, home), /^no Codex review record for 1 of 1 code commit since origin\/main: the review of /);
});

test('a records file that cannot be parsed is no record to the plain row, which stays information', async () => {
  const { root, home } = projectWithReviewedCommit();
  fs.writeFileSync(recordsFile(root), '{"schema": "js-harness.codex-review/v1", "base": \n\u0000 not JSON at all', 'utf8');
  assert.match(await informationOf(root, home), /^no Codex review record for 1 of 1 code commit since origin\/main: the review of /);
});

test('a git that throws once the records have been read leaves the plain row information', async () => {
  const { root, home } = projectWithReviewedCommit();
  // `--git-common-dir` is the last thing the reader of the records asks git: every process after it throws.
  const makeGit = () => {
    let read = false;
    return (cmd, args, opts) => {
      if (read) throw new Error('spawnSync git EAGAIN');
      read = args.includes('--git-common-dir');
      return spawnSync(cmd, args, opts);
    };
  };
  // The record could not be expanded and the range could not be sized, and the row says both. Nor could git
  // say where a review of the commit may start, so the range named is the one that reaches every commit.
  assert.equal(
    await informationOf(root, home, makeGit),
    'no Codex review record for 1 of 1 code commit since origin/main: how large the review of origin/main..HEAD is today could not be told; 1 record ignored (base or head not found)',
  );
});

/** A `spawn` that runs git for real and answers the question the reader of the records asks with bytes
 * where text was asked for, which that reader throws on. */
const gitThatBreaksTheRecords = () => (cmd, args, opts) =>
  args.includes('--git-common-dir') ? { status: 0, stdout: Buffer.from('.git\n'), stderr: '' } : spawnSync(cmd, args, opts);

test('a throw from under the plain row is what it cannot tell, with what failed, and main exits as it would have', async () => {
  const { root, home } = projectWithReviewedCommit();
  assert.equal(
    await informationOf(root, home, gitThatBreaksTheRecords),
    'cannot tell how much code waits for a Codex review: reading the commits, their Codex review records or the size of their review failed (result.stdout.trim is not a function)',
  );
});

test('the same throw under the push check is not swallowed: check --push fails loudly', async () => {
  const { root, home } = projectWithReviewedCommit();
  assert.throws(() => checkCodexReviews(root, 'HEAD', { spawn: gitThatBreaksTheRecords() }), /result\.stdout\.trim is not a function/);
  await assert.rejects(runCheck(['--push', '--cwd', root, '--home', home], { spawn: gitThatBreaksTheRecords() }), /result\.stdout\.trim is not a function/);
});

test('check --push runs only the codex-review row and fails on an uncovered commit', async () => {
  const { root, head, home } = projectWithUnreviewedCommit();
  const { code, output } = await runCheck(['--push', '--cwd', root, '--home', home]);
  assert.equal(code, 1);
  assert.match(output, /FAIL {2}codex-review/);
  assert.ok(output.includes(`js-harness codex-review --base ${short(root, head)}^`), output);
  // The budget, payload and test rows read the working tree, not the pushed commit.
  assert.doesNotMatch(output, /budget|payload|tests/);
  assert.equal(output.split('\n').filter((l) => /^(PASS|FAIL|INFO) /.test(l)).length, 1, output);
});

test('check --push needs no AGENTS.md: the budget row does not run', async () => {
  const { root, head, home } = projectWithUnreviewedCommit();
  record(root, git(root, 'rev-parse', `${head}^`), head);
  git(root, 'rm', '-q', 'AGENTS.md');
  git(root, 'commit', '-m', 'docs: drop agents');
  const { code, output } = await runCheck(['--push', '--head', head, '--cwd', root, '--home', home]);
  assert.equal(code, 0, output);
});

test('check --push --remote names the remote the range starts from', async () => {
  const { root, home } = projectWithUnreviewedCommit();
  git(root, 'remote', 'add', 'mirror', 'https://example.invalid/mirror.git');
  git(root, 'update-ref', 'refs/remotes/mirror/main', 'main');
  const { output } = await runCheck(['--push', '--remote', 'mirror', '--cwd', root, '--home', home]);
  assert.match(output, /since mirror\/main/);
});

test('check --push --head checks the given commit and passes once it is covered', async () => {
  const { root, head, home } = projectWithUnreviewedCommit();
  record(root, git(root, 'rev-parse', `${head}^`), head);
  commit(root, 'c.js', 'later', 'feat: later, not being pushed');
  const { code, output } = await runCheck(['--push', '--head', head, '--cwd', root, '--home', home]);
  assert.equal(code, 0, output);
  assert.match(output, /PASS {2}codex-review/);
});

test('--head or --remote with no value exits 2 with usage and runs no row', async () => {
  for (const argv of [['--push', '--head'], ['--head', '--push'], ['--head'], ['--push', '--remote'], ['--remote', '--push']]) {
    const { code, output, errOutput } = await runCheck(argv);
    assert.equal(code, 2, argv.join(' '));
    assert.match(errOutput, /Usage: js-harness check .*--push/);
    assert.equal(output, '');
  }
});

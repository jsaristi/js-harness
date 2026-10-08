import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkCodexReviewDebt, checkCodexReviews, main } from './check.mjs';
import { PART_MAX_CHANGED_LINES } from './lib/codex-review-parts.mjs';
import { MAX_PARTS_WITHOUT_FLAG } from './lib/codex-review-plan.mjs';
import { appendCodexReview, CODEX_REVIEW_SCHEMA, NOTHING_TO_REVIEW } from './lib/codex-reviews.mjs';

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

/** A repo on `main` with one code commit, which `origin/<remoteBranch>` also points at: what the
 * check compares a push to is the remote's branch, never the local one. `remoteBranch = null`
 * leaves the repo with no remote refs at all. */
function makeRepo(remoteBranch = 'main') {
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

// --- what a review leaves out: documents, and what the project marks (`./lib/codex-review-scope.mjs`) ---

/** `makeRepo`, with a `.gitattributes` of `marks` that the default branch of the remote already holds, so
 * that the commit of the marks is none of the branch's own. */
function makeMarkedRepo(marks = 'evals/results/** -codex-review\n') {
  const { root } = makeRepo();
  const base = commit(root, '.gitattributes', marks, 'chore: say what a review leaves out');
  git(root, 'update-ref', 'refs/remotes/origin/main', base);
  feature(root);
  return { root, base };
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
  const { root, base } = makeRepo();
  const older = commit(root, 'old.js', 'old', 'feat: merged long ago');
  git(root, 'update-ref', 'refs/remotes/origin/main', older);
  feature(root);
  const first = commit(root, 'b.js', 'two', 'feat: two');
  const second = commit(root, 'c.js', 'three', 'feat: three');
  record(root, older, second);
  for (let i = 0; i < unrelated; i += 1) record(root, base, older);
  return { root, first };
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
  commit(root, 'd.js', lines(5), 'feat: four, not reviewed');
  const row = checkCodexReviewDebt(root);
  assert.ok(isInformation(row), JSON.stringify(row));
  assert.match(row.detail, /no Codex review record for 2 of 3 code commits since origin\/main/);
  // The review that would cover them is of the range from the parent of the oldest one to HEAD, as
  // `js-harness codex-review --base <oldest>^` would size it today.
  assert.ok(row.detail.includes(`the review of ${short(root, oldest)}^..HEAD is 1 part today, 8 changed lines in 2 files`), row.detail);
  assert.deepEqual(row.lines, [`what it would cost, with nothing spent: js-harness codex-review --base ${short(root, oldest)}^ --plan`]);
});

test('the plain row sizes a review in thousands of changed lines and in parts', () => {
  const { root } = makeRepo();
  feature(root);
  const oldest = commitFiles(root, { 'b.js': lines(300), 'c.js': lines(300), 'd.js': lines(450) }, 'feat: three files');
  const row = checkCodexReviewDebt(root);
  assert.ok(isInformation(row), JSON.stringify(row));
  assert.ok(row.detail.includes(`the review of ${short(root, oldest)}^..HEAD is 3 parts today, 1,050 changed lines in 3 files`), row.detail);
  assert.doesNotMatch(row.detail, /max-parts/);
  assert.equal(row.lines.length, 1);
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
  assert.ok(!said.includes(`${short(root, rootCommit)}^`), said);
  assert.ok(said.includes('js-harness codex-review --base origin/main --plan'), said);
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
  assert.equal(row.lines.length, 1);
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

function projectWithUnreviewedCommit() {
  const { root } = makeRepo();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), 'short', 'utf8');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'docs: agents');
  git(root, 'update-ref', 'refs/remotes/origin/main', 'main');
  feature(root);
  const head = commit(root, 'b.js', 'two', 'feat: two');
  return { root, head, home: tmp('js-harness-check-push-home-') };
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
  for (const root of [noRemote, noRepository]) {
    fs.writeFileSync(path.join(root, 'AGENTS.md'), 'short', 'utf8');
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
  const { root, head, home } = projectWithReviewedCommit();
  // `--git-common-dir` is the last thing the reader of the records asks git: every process after it throws.
  const makeGit = () => {
    let read = false;
    return (cmd, args, opts) => {
      if (read) throw new Error('spawnSync git EAGAIN');
      read = args.includes('--git-common-dir');
      return spawnSync(cmd, args, opts);
    };
  };
  // The record could not be expanded and the range could not be sized, and the row says both.
  assert.equal(
    await informationOf(root, home, makeGit),
    `no Codex review record for 1 of 1 code commit since origin/main: how large the review of ${short(root, head)}^..HEAD is today could not be told; 1 record ignored (base or head not found)`,
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

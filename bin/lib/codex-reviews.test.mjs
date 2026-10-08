import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendCodexReview, codexReviewsPath, isValidCodexReview, leftMarkedFilesOut, NOTHING_TO_REVIEW, readCodexReviews, CODEX_REVIEW_SCHEMA } from './codex-reviews.mjs';

// Real git in every test, isolated from the host's config like project.test.mjs does.
let configDir;
const made = [];
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-codex-reviews-gitconfig-'));
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
  const root = tmp('js-harness-codex-reviews-');
  git(root, 'init');
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  fs.writeFileSync(path.join(root, 'f.txt'), 'x', 'utf8');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'init');
  return root;
}

const record = {
  schema: CODEX_REVIEW_SCHEMA,
  base: 'a'.repeat(40),
  head: 'b'.repeat(40),
  reviewedAt: '2026-09-29T00:00:00.000Z',
  outcome: 'reviewed',
};

test('the record lives in the git common dir, so no file joins the working tree', () => {
  const root = makeRepo();
  const file = codexReviewsPath(root);
  assert.equal(fs.realpathSync(path.dirname(path.dirname(file))), fs.realpathSync(path.join(root, '.git')));
  assert.equal(path.basename(file), 'codex-reviews.jsonl');
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('outside a git repository there is no record path', () => {
  assert.equal(codexReviewsPath(tmp('js-harness-codex-reviews-nongit-')), null);
});

test('append creates the js-harness dir and writes one JSON line per record, in order', () => {
  const root = makeRepo();
  const file = appendCodexReview(root, record);
  appendCodexReview(root, { ...record, outcome: 'unavailable', reason: 'model rejected' });
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[2], '');
  assert.deepEqual(JSON.parse(lines[0]), record);
  assert.deepEqual(Object.keys(JSON.parse(lines[1])), ['schema', 'base', 'head', 'reviewedAt', 'outcome', 'reason']);
});

test('append returns the path it wrote and the reader returns the records back', () => {
  const root = makeRepo();
  const file = appendCodexReview(root, record);
  assert.equal(file, codexReviewsPath(root));
  assert.deepEqual(readCodexReviews(root), [record]);
});

test('an append after an unterminated last line starts on a new line, so the new record survives', () => {
  const root = makeRepo();
  const file = appendCodexReview(root, record);
  fs.appendFileSync(file, '{"schema":"js-harness.codex-review/v1","base":"dead', 'utf8');
  const later = { ...record, head: 'c'.repeat(40) };
  appendCodexReview(root, later);
  assert.deepEqual(readCodexReviews(root), [record, later]);
  assert.equal(fs.readFileSync(file, 'utf8').endsWith('\n'), true);
});

test('an append to a well-formed file adds no blank line', () => {
  const root = makeRepo();
  const file = appendCodexReview(root, record);
  appendCodexReview(root, record);
  assert.equal(fs.readFileSync(file, 'utf8').split('\n').filter((l) => !l.trim()).length, 1);
});

test('append outside a git repository throws instead of writing somewhere else', () => {
  assert.throws(() => appendCodexReview(tmp('js-harness-codex-reviews-nongit-'), record), /git/i);
});

test('reading with no file yet gives an empty list', () => {
  assert.deepEqual(readCodexReviews(makeRepo()), []);
});

test('reading outside a git repository gives an empty list', () => {
  assert.deepEqual(readCodexReviews(tmp('js-harness-codex-reviews-nongit-')), []);
});

test('the reader skips blank and malformed lines without throwing', () => {
  const root = makeRepo();
  const file = appendCodexReview(root, record);
  fs.appendFileSync(file, '\n   \nnot json\n{"truncated":\n"a string"\n[1]\nnull\n', 'utf8');
  appendCodexReview(root, { ...record, head: 'c'.repeat(40) });
  const records = readCodexReviews(root);
  assert.deepEqual(records.map((r) => r.head), ['b'.repeat(40), 'c'.repeat(40)]);
});

test("a linked worktree shares the clone's one record file", () => {
  const root = makeRepo();
  const worktree = path.join(tmp('js-harness-codex-reviews-wt-'), 'wt');
  git(root, 'worktree', 'add', worktree, '-b', 'other');
  appendCodexReview(root, record);
  // Compare real paths: Windows may spell the same temp dir with a short or a long name.
  const dirOf = (r) => fs.realpathSync(path.dirname(codexReviewsPath(r)));
  assert.equal(dirOf(worktree), dirOf(root));
  assert.deepEqual(readCodexReviews(worktree), [record]);
});

test('a well-formed reviewed or unavailable record is valid', () => {
  assert.equal(isValidCodexReview(record), true);
  assert.equal(isValidCodexReview({ ...record, base: 'a'.repeat(64), head: 'b'.repeat(64) }), true);
  assert.equal(isValidCodexReview({ ...record, outcome: 'unavailable', reason: 'model rejected' }), true);
});

test('a range with nothing to review has an outcome of its own, which is neither a review nor a skip, and its record is valid with the reason', () => {
  assert.equal(NOTHING_TO_REVIEW, 'nothing-to-review');
  assert.notEqual(NOTHING_TO_REVIEW, 'reviewed');
  assert.notEqual(NOTHING_TO_REVIEW, 'unavailable');
  assert.equal(isValidCodexReview({ ...record, outcome: NOTHING_TO_REVIEW, reason: 'the range changes no file' }), true);
  // Like a skip, it has to say why no review stands behind it.
  for (const reason of [undefined, '', '  ', 3]) {
    assert.equal(isValidCodexReview({ ...record, outcome: NOTHING_TO_REVIEW, reason }), false, JSON.stringify(reason));
  }
});

test('a record says whether its review left out a file the project marks, and one that does not say is read as one that did', () => {
  const counts = (documents, marked) => ({
    files: documents + marked,
    changedLines: 10 * (documents + marked),
    documents: { files: documents, changedLines: 10 * documents },
    marked: { files: marked, changedLines: 10 * marked },
  });
  // Nothing left out, and documents alone: what no later commit can turn into code.
  assert.equal(leftMarkedFilesOut(record), false);
  assert.equal(leftMarkedFilesOut({ ...record, leftOut: counts(3, 0) }), false);
  // A marked file among them, with or without documents, under any outcome that can hold the count.
  assert.equal(leftMarkedFilesOut({ ...record, leftOut: counts(0, 1) }), true);
  assert.equal(leftMarkedFilesOut({ ...record, leftOut: counts(3, 2) }), true);
  assert.equal(leftMarkedFilesOut({ ...record, outcome: NOTHING_TO_REVIEW, reason: 'the range changes no file a review reads', leftOut: counts(0, 2) }), true);
  // A record written before the count of the marked files was kept apart holds the two totals alone: it
  // cannot say that none was marked, so it is not read as saying so. Nor is anything else that is no such count.
  for (const untold of [{ files: 2, changedLines: 6 }, { ...counts(1, 0), marked: {} }, { ...counts(1, 0), marked: { files: '0' } }, { ...counts(1, 0), marked: { files: -0.5 } }, { ...counts(1, 0), marked: null }, 'two', 0, null, []]) {
    assert.equal(leftMarkedFilesOut({ ...record, leftOut: untold }), true, JSON.stringify(untold));
  }
  // None of it makes a record more or less valid than it was: the count is what a check reads of a valid record.
  for (const leftOut of [counts(3, 0), counts(0, 1), { files: 2, changedLines: 6 }, 'two', null]) {
    assert.equal(isValidCodexReview({ ...record, leftOut }), true, JSON.stringify(leftOut));
  }
});

test('every way a record can be malformed makes it invalid', () => {
  const { schema, ...noSchema } = record;
  const { outcome, ...noOutcome } = record;
  for (const bad of [
    null,
    'text',
    [record],
    {},
    noSchema,
    { ...record, schema: 'other/v1' },
    { ...record, base: 'a'.repeat(39) },
    { ...record, base: 'A'.repeat(40) },
    { ...record, head: 'b'.repeat(65) },
    { ...record, head: undefined },
    { ...record, reviewedAt: 12 },
    noOutcome,
    { ...record, outcome: 'approved' },
    { ...record, outcome: 'unavailable' },
    { ...record, outcome: 'unavailable', reason: '  ' },
    { ...record, outcome: 'unavailable', reason: 3 },
  ]) {
    assert.equal(isValidCodexReview(bad), false, JSON.stringify(bad));
  }
});

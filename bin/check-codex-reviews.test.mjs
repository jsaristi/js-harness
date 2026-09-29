import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkCodexReviews, main } from './check.mjs';
import { appendCodexReview, CODEX_REVIEW_SCHEMA } from './lib/codex-reviews.mjs';

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

/** A repo on `main` with one code commit; `main` is the default branch the check compares to. */
function makeRepo(branch = 'main') {
  const root = tmp('js-harness-check-push-');
  git(root, 'init');
  git(root, 'symbolic-ref', 'HEAD', `refs/heads/${branch}`);
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  const base = commit(root, 'a.js', 'one', 'init');
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
  assert.match(row.detail, /2 code commits since main, all covered by a Codex review record/);
});

test('an uncovered code commit fails, naming it and the command that records it', () => {
  const { root, base } = makeRepo();
  feature(root);
  const first = commit(root, 'b.js', 'two', 'feat: two');
  const second = commit(root, 'c.js', 'three', 'feat: three, never reviewed');
  record(root, base, first);
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, false);
  assert.match(row.detail, /1 of 2 code commits since main/);
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
  assert.match(row.detail, /no code commits since main/);
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
  git(root, 'checkout', 'feature');
  git(root, 'merge', '--no-ff', '-m', 'merge main into feature', 'main');
  record(root, base, own);
  const row = checkCodexReviews(root, 'HEAD');
  // Against the *old* main the merged-in commit is not in the range; the merge commit is ignored.
  assert.equal(row.pass, true, `${row.detail}\n${(row.lines ?? []).join('\n')}`);
  assert.match(row.detail, /1 code commit since main/);
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

test('records whose base or head no longer resolve are ignored, and counted', () => {
  const { root, base } = makeRepo();
  feature(root);
  const head = commit(root, 'b.js', 'two', 'feat: two');
  record(root, base, head);
  record(root, 'f'.repeat(40), head);
  record(root, base, 'e'.repeat(40));
  record(root, '--upload-pack=x', head);
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, true);
  assert.match(row.detail, /3 records ignored/);
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

test('a repository with no main, master or origin/HEAD fails saying so', () => {
  const { root } = makeRepo('trunk');
  feature(root);
  commit(root, 'b.js', 'two', 'feat: two');
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, false);
  assert.match(row.detail, /default branch/i);
});

test('master is the default branch when there is no main', () => {
  const { root, base } = makeRepo('master');
  feature(root);
  const head = commit(root, 'b.js', 'two', 'feat: two');
  record(root, base, head);
  const row = checkCodexReviews(root, 'HEAD');
  assert.equal(row.pass, true);
  assert.match(row.detail, /since master/);
});

test('origin/HEAD names the default branch before a local main does', () => {
  const { root, base } = makeRepo();
  const behind = commit(root, 'b.js', 'two', 'feat: two, on main');
  git(root, 'update-ref', 'refs/remotes/origin/main', base);
  git(root, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');
  const row = checkCodexReviews(root, 'HEAD');
  assert.match(row.detail, /since origin\/main/);
  assert.equal(row.pass, false);
  assert.ok(row.lines.join('\n').includes(short(root, behind)));
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

// --- main: the row appears only with --push ---

async function runCheck(argv) {
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
    const code = await main(argv, { JS_HARNESS_CHECK_INNER: '1' });
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
  feature(root);
  const head = commit(root, 'b.js', 'two', 'feat: two');
  return { root, head, home: tmp('js-harness-check-push-home-') };
}

test('plain check runs and prints no codex-review row', async () => {
  const { root, home } = projectWithUnreviewedCommit();
  const { code, output } = await runCheck(['--cwd', root, '--home', home]);
  assert.equal(code, 0);
  assert.doesNotMatch(output, /codex-review/);
});

test('check --push adds the codex-review row and fails on an uncovered commit', async () => {
  const { root, head, home } = projectWithUnreviewedCommit();
  const { code, output } = await runCheck(['--push', '--cwd', root, '--home', home]);
  assert.equal(code, 1);
  assert.match(output, /FAIL {2}codex-review/);
  assert.ok(output.includes(`js-harness codex-review --base ${short(root, head)}^`), output);
});

test('check --push --head checks the given commit and passes once it is covered', async () => {
  const { root, head, home } = projectWithUnreviewedCommit();
  record(root, git(root, 'rev-parse', `${head}^`), head);
  commit(root, 'c.js', 'later', 'feat: later, not being pushed');
  const { code, output } = await runCheck(['--push', '--head', head, '--cwd', root, '--home', home]);
  assert.equal(code, 0, output);
  assert.match(output, /PASS {2}codex-review/);
});

test('--head or --push --head with no value exits 2 with usage and runs no row', async () => {
  for (const argv of [['--push', '--head'], ['--head', '--push'], ['--head']]) {
    const { code, output, errOutput } = await runCheck(argv);
    assert.equal(code, 2, argv.join(' '));
    assert.match(errOutput, /Usage: js-harness check .*--push/);
    assert.equal(output, '');
  }
});

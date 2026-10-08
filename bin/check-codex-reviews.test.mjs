import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkCodexReviews, main } from './check.mjs';
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
  git(root, 'update-ref', 'refs/remotes/origin/main', 'main');
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

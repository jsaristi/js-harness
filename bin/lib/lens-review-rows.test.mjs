import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkLensReviews } from './lens-review-rows.mjs';
import { lensCandidate } from './lens-candidate.mjs';
import { appendLensReview, LENS_REVIEW_SCHEMA } from './lens-reviews.mjs';
import { withSubjectHash } from './codex-reviews.mjs';
import { withoutAutoMaintenance } from './git-fixture.testkit.mjs';

// The project turns the lens review on in the first commit, so every code commit after it asks for a lens record.
const LENS_ON = '{ "functions": { "lensReview": "on" } }\n';

let dir;
const git = (...args) => {
  const ran = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  assert.equal(ran.status, 0, `git ${args.join(' ')}: ${ran.stderr}`);
  return ran.stdout.trim();
};
const commit = (file, text, message) => {
  fs.writeFileSync(path.join(dir, file), text);
  git('add', '-A');
  git('commit', '-q', '-m', message);
  return git('rev-parse', 'HEAD');
};
/** A lens record of `base..head` as `lens-review` writes it, with `over` in place of its fields. */
const record = (base, head, over = {}) => {
  const { subjectHash } = lensCandidate(dir, { base, head });
  appendLensReview(dir, { schema: LENS_REVIEW_SCHEMA, base, head, subjectHash, reviewedAt: new Date().toISOString(), outcome: 'reviewed', results: [{ lens: 'risk', outcome: 'complete', findings: [] }], ...over });
};
const row = () => checkLensReviews(dir, 'HEAD');

let base;
let head;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lens-rows-'));
  withoutAutoMaintenance(() => {
    git('init', '-q', '--initial-branch=main');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 'T');
    fs.writeFileSync(path.join(dir, 'harness.json'), LENS_ON);
    base = commit('a.mjs', 'export const a = 1;\n', 'first');
    git('remote', 'add', 'origin', 'https://example.invalid/r.git');
    git('update-ref', 'refs/remotes/origin/main', base);
    git('checkout', '-q', '-b', 'feature');
    head = commit('a.mjs', 'export const a = 2;\n', 'feat: two');
  });
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

test('a code commit with no lens record is refused, with the command that makes one', () => {
  const said = row();
  assert.equal(said.pass, false);
  assert.match(said.detail, /1 of 1 code commit since origin\/main have no complete Claude lens record/);
  assert.match(said.lines.join('\n'), /feat: two[\s\S]*js-harness lens-review --base \w+\^ --lenses/);
});

test('a complete record of the range covers it; an amend after it leaves the range uncovered again', () => {
  record(base, head);
  assert.equal(row().pass, true);
  withoutAutoMaintenance(() => git('commit', '-q', '--amend', '-m', 'feat: two, reworded'));
  const after = row();
  assert.equal(after.pass, false);
  assert.match(after.lines[0], /feat: two, reworded/);
});

test('a record whose range no longer hashes to its subject hash covers nothing, and is said', () => {
  record(base, head, { subjectHash: 'f'.repeat(64) });
  const said = row();
  assert.equal(said.pass, false);
  assert.match(said.detail, /1 record whose range no longer hashes as reviewed/);
});

test('an incomplete run covers nothing; a skip covers and is listed with its reason', () => {
  record(base, head, { outcome: 'incomplete', results: [{ lens: 'risk', outcome: 'incomplete' }] });
  assert.equal(row().pass, false);
  record(base, head, { outcome: 'unavailable', reason: 'the plan is out of turns', results: undefined });
  const said = row();
  assert.equal(said.pass, true);
  assert.deepEqual(said.lines, [`unavailable ${base.slice(0, 7)}..${head.slice(0, 7)}: the plan is out of turns`]);
});

test('a skip a complete review later covers is no longer listed', () => {
  record(base, head, { outcome: 'unavailable', reason: 'the plan is out of turns', results: undefined });
  record(base, head);
  const said = row();
  assert.equal(said.pass, true);
  assert.equal(said.lines, undefined);
});

test('the first push to a remote that holds no branch passes, as the Codex row lets it', () => {
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'lens-rows-bare-'));
  try {
    spawnSync('git', ['init', '-q', '--bare', bare]);
    git('remote', 'set-url', 'origin', bare);
    git('update-ref', '-d', 'refs/remotes/origin/main');
    const said = row();
    assert.equal(said.pass, true);
    assert.match(said.detail, /origin holds no branch yet/);
  } finally {
    fs.rmSync(bare, { recursive: true, force: true });
  }
});

test('a Codex record gains the subject hash of its range, the same identity a lens record carries', () => {
  const rec = withSubjectHash(dir, { base, head, outcome: 'reviewed' });
  assert.equal(rec.subjectHash, lensCandidate(dir, { base, head }).subjectHash);
  assert.equal(withSubjectHash(dir, { base: 'f'.repeat(40), head }).subjectHash, undefined);
});

// L9: a commit is asked by the switch its own tree holds, so the commits of a branch made before the lens review was
// turned on are never asked, wherever that branch lands, and a project that never turns it on is never asked.
test('a code commit asks for a lens record only where its own tree turns the lens review on', () => {
  withoutAutoMaintenance(() => {
    git('reset', '-q', '--hard', base);
    fs.writeFileSync(path.join(dir, 'harness.json'), '{}\n');
    commit('a.mjs', 'export const a = 3;\n', 'feat: three, the lens review off');
  });
  const off = row();
  assert.equal(off.pass, true);
  assert.match(off.detail, /^no code commits since origin\/main that ask for a lens record$/);
  withoutAutoMaintenance(() => {
    fs.writeFileSync(path.join(dir, 'harness.json'), LENS_ON);
    commit('a.mjs', 'export const a = 4;\n', 'feat: four, the lens review on');
  });
  const on = row();
  assert.equal(on.pass, false);
  assert.deepEqual([on.detail.split(' since ')[0], on.lines[0].replace(/^\w+ /, '')], ['1 of 1 code commit', 'feat: four, the lens review on']);
});

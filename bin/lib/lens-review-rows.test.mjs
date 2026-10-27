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

// Every commit of these repositories is after this cut-over, so each code commit asks for a lens record.
const EARLY = '2000-01-01T00:00:00Z';

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
const row = (cutover = EARLY) => checkLensReviews(dir, 'HEAD', { cutover });

let base;
let head;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lens-rows-'));
  withoutAutoMaintenance(() => {
    git('init', '-q', '--initial-branch=main');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 'T');
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

test('a Codex record gains the subject hash of its range, the same identity a lens record carries', () => {
  const rec = withSubjectHash(dir, { base, head, outcome: 'reviewed' });
  assert.equal(rec.subjectHash, lensCandidate(dir, { base, head }).subjectHash);
  assert.equal(withSubjectHash(dir, { base: 'f'.repeat(40), head }).subjectHash, undefined);
});

test('code commits committed before the cut-over ask for no record', () => {
  const said = row('2999-01-01T00:00:00Z');
  assert.equal(said.pass, true);
  assert.match(said.detail, /no code commits since origin\/main that ask for a lens record/);
});

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { reviewEvidence } from './merge-queue-reviews.mjs';
import { checkCodexReviews } from './codex-review-rows.mjs';
import { lensCandidate } from './lens-candidate.mjs';
import { appendLensReview, LENS_REVIEW_SCHEMA, startLensRun } from './lens-reviews.mjs';

// The door's reading of a pull request's reviews, against a clone of a bare origin made here, with the Codex and lens
// reviews on in main's harness.json and records written as the two commands write them. The queue's own runs of it,
// through `merge-queue --dry-run`, are in bin/merge-queue.test.mjs.

const git = (cwd, ...args) => {
  const done = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(done.status, 0, `git ${args.join(' ')}: ${done.stderr}`);
  return done.stdout.trim();
};

/** A clone whose main holds f.txt, seven lines, and turns the lens review on and the Codex review as `codexReview` says,
 * with a branch of the code commit `c` (c.txt, and the first line of f.txt) and, past it, the code commit `d`.
 * `{ root, main, c, d, record }`: `record(base, head)` writes a Codex and a lens review of `base..head`. */
function makeRepo({ codexReview = 'on' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mq-reviews-'));
  after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const origin = path.join(dir, 'origin.git');
  const root = path.join(dir, 'work');
  git(dir, 'init', '--quiet', '--bare', '--initial-branch=main', origin);
  git(dir, 'clone', '--quiet', origin, root);
  for (const [key, value] of [['user.name', 'Test'], ['user.email', 'test@example.invalid'], ['maintenance.auto', 'false'], ['commit.gpgSign', 'false']]) git(root, 'config', key, value);
  const commit = (file, text, message) => {
    fs.writeFileSync(path.join(root, file), text, 'utf8');
    git(root, 'add', file);
    git(root, 'commit', '--quiet', '-m', message);
    return git(root, 'rev-parse', 'HEAD');
  };
  commit('f.txt', '1\n2\n3\n4\n5\n6\n7\n', 'main holds f.txt');
  const main = commit('harness.json', `${JSON.stringify({ functions: { codexReview, lensReview: 'on' } })}\n`, 'main sets the reviews');
  git(root, 'push', '--quiet', 'origin', 'HEAD:main');
  git(root, 'remote', 'set-head', 'origin', 'main');
  fs.writeFileSync(path.join(root, 'f.txt'), 'one\n2\n3\n4\n5\n6\n7\n', 'utf8');
  git(root, 'add', 'f.txt');
  const c = commit('c.txt', 'c\n', 'feat: c');
  const d = commit('d.txt', 'd\n', 'feat: d');
  git(root, 'checkout', '--quiet', '--detach', main);
  const record = (base, head) => {
    const reviewedAt = '2026-10-29T12:00:00.000Z';
    fs.mkdirSync(path.join(root, '.git', 'js-harness'), { recursive: true });
    const rec = { schema: 'js-harness.codex-review/v1', base, head, reviewedAt, outcome: 'reviewed' };
    fs.appendFileSync(path.join(root, '.git', 'js-harness', 'codex-reviews.jsonl'), `${JSON.stringify(rec)}\n`, 'utf8');
    const { subjectHash } = lensCandidate(root, { base, head });
    const results = [{ lens: 'risk', outcome: 'complete', findings: [] }];
    appendLensReview(root, { schema: LENS_REVIEW_SCHEMA, base, head, subjectHash, run: startLensRun(root, { base, head, subjectHash }), reviewedAt, outcome: 'reviewed', results });
  };
  return { root, main, c, d, record };
}

test('a record whose head lies past the pull request covers its head alone and not merged: the door refuses it, as the push of the merge does', () => {
  const { root, main, c, d, record } = makeRepo();
  record(main, d);
  assert.equal(checkCodexReviews(root, c).pass, true, 'at the head itself, d lies past the tip and the record covers c');
  const said = reviewEvidence(root, main, c);
  assert.equal(said.pass, false);
  assert.match(said.detail, /^1 of 1 code commit since origin\/main have no Codex review record/);
});

test('a record of the pull request\'s own range passes the door, with the record named for its commit', () => {
  const { root, main, c, record } = makeRepo();
  record(main, c);
  const said = reviewEvidence(root, main, c);
  assert.equal(said.pass, true, said.detail);
  assert.deepEqual(said.lines, [`${c.slice(0, 7)} feat: c: Codex ${main.slice(0, 7)}..${c.slice(0, 7)} reviewed 2026-10-29`]);
});

test('with the Codex review off, the lines name the pull request\'s commits, never the merge the door makes (JH 83\'s verifier)', () => {
  const { root, main, c, record } = makeRepo({ codexReview: 'off' });
  // main moves on the last line of f.txt, which c changed the first line of: a clean merge that changes f.txt on both sides.
  fs.writeFileSync(path.join(root, 'f.txt'), '1\n2\n3\n4\n5\n6\nseven\n', 'utf8');
  git(root, 'add', 'f.txt');
  git(root, 'commit', '--quiet', '-m', 'main edits line 7');
  git(root, 'push', '--quiet', 'origin', 'HEAD:main');
  const moved = git(root, 'rev-parse', 'HEAD');
  record(main, c);
  const said = reviewEvidence(root, moved, c);
  assert.equal(said.pass, true, said.detail);
  assert.deepEqual(said.lines, [`${c.slice(0, 7)} feat: c: the Codex review is off`]);
});

test('read onto the candidate so far, the lines name the commits the pull request adds to it, and the tip it makes is handed on', () => {
  // d's branch is stacked on c: with c already in the candidate, d adds d alone.
  const { root, main, c, d, record } = makeRepo();
  record(main, c);
  record(c, d);
  const first = reviewEvidence(root, main, c);
  assert.equal(first.pass, true, first.detail);
  assert.match(first.tip, /^[0-9a-f]{40,64}$/);
  const said = reviewEvidence(root, main, d, first.tip);
  assert.equal(said.pass, true, said.detail);
  assert.deepEqual(said.lines, [`${d.slice(0, 7)} feat: d: Codex ${c.slice(0, 7)}..${d.slice(0, 7)} reviewed 2026-10-29`]);
  assert.equal(git(root, 'rev-parse', `${said.tip}^1`), first.tip, 'd is merged onto the candidate so far, not onto main');
});

test('a pull request that conflicts with the candidate so far names the files, as the candidate does', () => {
  const { root, main, c, record } = makeRepo();
  record(main, c);
  fs.writeFileSync(path.join(root, 'c.txt'), 'a sibling writes c.txt too\n', 'utf8');
  git(root, 'add', 'c.txt');
  git(root, 'commit', '--quiet', '-m', 'a sibling');
  const sibling = git(root, 'rev-parse', 'HEAD');
  const said = reviewEvidence(root, main, c, sibling);
  assert.equal(said.pass, false);
  assert.deepEqual(said.conflicted, ['c.txt']);
});

test('a pull request that conflicts with main is refused, naming the files, and no review is read', () => {
  const { root, main, c, record } = makeRepo();
  record(main, c);
  fs.writeFileSync(path.join(root, 'c.txt'), 'main has its own c\n', 'utf8');
  git(root, 'add', 'c.txt');
  git(root, 'commit', '--quiet', '-m', 'main writes c.txt too');
  const moved = git(root, 'rev-parse', 'HEAD');
  assert.deepEqual(reviewEvidence(root, moved, c), {
    pass: false,
    conflicted: ['c.txt'],
    detail: 'it does not merge onto main without a conflict (in c.txt), so its reviews cannot be read as the push of main reads them',
  });
  assert.notEqual(main, moved);
});

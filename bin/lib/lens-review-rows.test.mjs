import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkLensReviews, checkReviewDebt, lensDoor, owedSkipLines } from './lens-review-rows.mjs';
import { lensCandidate } from './lens-candidate.mjs';
import { appendLensReview, LENS_REVIEW_SCHEMA } from './lens-reviews.mjs';
import { appendCodexReview, CODEX_REVIEW_SCHEMA, withSubjectHash } from './codex-reviews.mjs';
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

const debt = () => checkReviewDebt(dir);
const codexRecord = (over) => appendCodexReview(dir, { schema: CODEX_REVIEW_SCHEMA, base, head, reviewedAt: new Date().toISOString(), ...over });

test('the review row informs: a code commit with no lens record is named with the command, and nothing fails', () => {
  const said = debt();
  assert.deepEqual([said.name, said.pass, said.info], ['review', true, true]);
  assert.match(said.detail, /^no Claude lens record for 1 of 1 code commit since origin\/main$/);
  assert.match(said.lines.join('\n'), /feat: two[\s\S]*js-harness lens-review --base \w+\^ --lenses/);
  assert.doesNotMatch(JSON.stringify(said), /gentle-ai/);
});

test('the review row lists the skips of both reviews that still owe one, and drops each once a review pays it', () => {
  record(base, head, { outcome: 'unavailable', reason: 'out of turns', results: undefined });
  codexRecord({ outcome: 'unavailable', reason: 'codex is down' });
  const said = debt();
  assert.equal(said.detail, 'every one of 1 code commit since origin/main has a Claude lens record; 2 skips still owe a review');
  const range = `${base.slice(0, 7)}..${head.slice(0, 7)}`;
  assert.deepEqual(said.lines, [`lens: unavailable ${range}: out of turns`, `codex: unavailable ${range}: codex is down`]);
  record(base, head);
  codexRecord({ outcome: 'reviewed' });
  assert.deepEqual([debt().detail, debt().lines], ['every one of 1 code commit since origin/main has a Claude lens record', undefined]);
});

test('with the Codex review off, the lenses are the one review: their debt is still said, and no push is refused for it (S9)', () => {
  withoutAutoMaintenance(() => commit('harness.json', '{ "functions": { "codexReview": "off", "lensReview": "on" } }\n', 'chore: codex review off'));
  assert.equal(debt().detail, 'no Claude lens record for 2 of 2 code commits since origin/main; the Codex review is off here, so the lenses are the one review, and no push is refused for it');
  assert.equal(row().pass, true);
});

test('the review row says when it cannot tell, and fails nothing', () => {
  git('remote', 'remove', 'origin');
  const said = debt();
  assert.equal(said.pass, true);
  assert.match(said.detail, /^cannot tell what waits for a review: no default branch of origin/);
});

// gentle-ai's suggestion on PR 613: the gentle-ai row had this test, and the debt row keeps its promise.
test('the review row says when git cannot even be spawned, and fails nothing', () => {
  const said = checkReviewDebt(dir, { spawn: () => { throw new Error('spawn failed'); } });
  assert.deepEqual([said.name, said.pass, said.info], ['review', true, true]);
  assert.match(said.detail, /^cannot tell what waits for a review: /);
});

test('the skips doctor lists are those the review row lists, and none where it cannot tell', () => {
  assert.deepEqual(owedSkipLines(dir), []);
  record(base, head, { outcome: 'unavailable', reason: 'out of turns', results: undefined });
  assert.deepEqual(owedSkipLines(dir), debt().lines.filter((line) => line.startsWith('lens: ')));
  git('remote', 'remove', 'origin');
  assert.equal(owedSkipLines(dir), null);
});

test('the merge door refuses a lens skip until a review pays it, and a range with no lens record', () => {
  assert.match(lensDoor(dir, 'HEAD').detail, /^lens review: 1 of 1 code commit since origin\/main have no complete Claude lens record/);
  record(base, head, { outcome: 'unavailable', reason: 'out of turns', results: undefined });
  assert.match(lensDoor(dir, 'HEAD').detail, /^it holds a lens review skip, which owes a review before it lands: unavailable /);
  record(base, head);
  assert.equal(lensDoor(dir, 'HEAD'), null);
});

// L11: the push lets the lens debt through where the Codex review is off; the merge path does not (S7).
test('the merge door asks for the lens review with the Codex review off: that exemption is the push row\'s alone', () => {
  const tip = withoutAutoMaintenance(() => commit('harness.json', '{ "functions": { "codexReview": "off", "lensReview": "on" } }\n', 'chore: codex review off'));
  assert.equal(row().pass, true);
  assert.match(lensDoor(dir, 'HEAD').detail, /^lens review: 2 of 2 code commits since origin\/main have no complete Claude lens record/);
  record(base, tip, { outcome: 'unavailable', reason: 'out of turns', results: undefined });
  assert.match(lensDoor(dir, 'HEAD').detail, /^it holds a lens review skip, which owes a review before it lands: unavailable /);
  record(base, tip);
  assert.equal(lensDoor(dir, 'HEAD'), null);
});

// Question 104 (odd/tasks/f8-s11-complements.md, L14): where the Codex review is off, the lens review stays on at the door.
test('the merge door asks for the lens review where the Codex review is off, even with the lens review switched off', () => {
  const tip = withoutAutoMaintenance(() => commit('harness.json', '{ "functions": { "codexReview": "off", "lensReview": "off" } }\n', 'chore: both reviews off'));
  assert.equal(row().pass, true);
  assert.match(lensDoor(dir, 'HEAD').detail, /^lens review: 2 of 2 code commits since origin\/main have no complete Claude lens record/);
  record(base, tip);
  assert.equal(lensDoor(dir, 'HEAD'), null);
});

test('the merge door asks for no lens record where the Codex review is on and the lens review off', () => {
  withoutAutoMaintenance(() => {
    git('reset', '-q', '--hard', base);
    commit('harness.json', '{ "functions": { "codexReview": "on", "lensReview": "off" } }\n', 'chore: the Codex review alone');
  });
  assert.equal(lensDoor(dir, 'HEAD'), null);
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

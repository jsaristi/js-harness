import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkLensReviews, checkReviewDebt, lensDoor, owedSkipLines } from './lens-review-rows.mjs';
import { commandStep, firstStep } from './next-step.mjs';
import { lensCandidate } from './lens-candidate.mjs';
import { appendLensReview, endLensRun, LENS_REVIEW_SCHEMA, startLensRun } from './lens-reviews.mjs';
import { appendCodexReview, CODEX_REVIEW_SCHEMA, withSubjectHash } from './codex-reviews.mjs';
import { withoutAutoMaintenance } from './git-fixture.testkit.mjs';
import { withRunLine } from './codex-records.testkit.mjs';

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
/** A lens record of `base..head` as `lens-review` writes it, its run line first, with `over` in place of its fields;
 * returns its run id. */
const record = (base, head, over = {}) => {
  const subjectHash = over.subjectHash ?? lensCandidate(dir, { base, head }).subjectHash;
  const run = startLensRun(dir, { base, head, subjectHash });
  appendLensReview(dir, { schema: LENS_REVIEW_SCHEMA, base, head, subjectHash, run, reviewedAt: new Date().toISOString(), outcome: 'reviewed', results: [{ lens: 'risk', outcome: 'complete', findings: [] }], ...over });
  return run;
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

test('a code commit with no lens record is refused, with the command that makes one, bound to the head it was computed at', () => {
  const said = row();
  assert.equal(said.pass, false);
  assert.match(said.detail, /1 of 1 code commit since origin\/main have no complete Claude lens record/);
  assert.match(said.lines.join('\n'), /feat: two/);
  assert.ok(!said.lines.join('\n').includes('make the record with'), said.lines.join('\n'));
  assert.deepEqual(said.next, commandStep(`js-harness lens-review --base ${head.slice(0, 7)}^ --at ${head.slice(0, 12)} --lenses <lens,...> --reason "<what it touched and how>"`));
});

test('a lens row that cannot read the default branch names the step that sets it, and the merge door refuses with its next step', () => {
  git('remote', 'remove', 'origin');
  git('remote', 'add', 'origin', 'https://example.invalid/r.git');
  const said = row();
  assert.equal(said.pass, false);
  assert.equal(said.next.kind, 'step');
  assert.equal(said.next.text, 'set the default branch of origin: git remote set-head origin --auto');
  assert.equal(lensDoor(dir, 'HEAD').next.kind, 'step');
});

test('the merge door names the lens review of its range as the review that pays it, bound to the range base', () => {
  const door = lensDoor(dir, 'HEAD');
  assert.equal(door.pass, false);
  assert.deepEqual(door.review, { tool: 'lens-review', base: `${head.slice(0, 7)}^` });
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

test('a record written while the lenses read renames off still covers its range, by that reading\'s hash', () => {
  // Before odd/tasks/lens-counts-renames.md every record's hash was of its range read renames off; a range that renames
  // a file now hashes otherwise, and those records, Codex's among them, still prove its patch did not change.
  const lines = Array.from({ length: 50 }, (_, at) => `export const line${at} = ${at};\n`).join('');
  let added;
  let moved;
  withoutAutoMaintenance(() => {
    added = commit('b.mjs', lines, 'feat: b');
    fs.rmSync(path.join(dir, 'b.mjs'));
    fs.mkdirSync(path.join(dir, 'lib'));
    moved = commit(path.join('lib', 'b.mjs'), lines.replace('line7 = 7', 'line7 = 70'), 'refactor: b moves');
  });
  const before = lensCandidate(dir, { base: added, head: moved, renames: '--no-renames' }).subjectHash;
  assert.notEqual(before, lensCandidate(dir, { base: added, head: moved }).subjectHash, 'the range reads otherwise with renames');
  record(base, added);
  record(added, moved, { subjectHash: before });
  assert.equal(row().pass, true, row().detail);
  // A hash that neither reading gives still covers nothing.
  record(added, moved, { subjectHash: 'f'.repeat(64) });
  assert.match(row().detail, /1 record whose range no longer hashes as reviewed/);
  assert.equal(row().pass, true, row().detail);
});

// The lead on L71 D (PR 896): a record an older js-harness writes after the first run with a result line is refused,
// and the push says that is why, not that the run was incomplete or named by no line.
test('V2: a record whose run has no result line, written after the first that has one, is said as an older writer did it', () => {
  const { subjectHash } = lensCandidate(dir, { base, head });
  const now = record(base, head);
  endLensRun(dir, { id: now, base, head, subjectHash, outcome: 'reviewed', results: [{ lens: 'risk', outcome: 'complete', findings: [] }] });
  assert.equal(row().pass, true, row().detail);
  const later = commit('c.mjs', 'export const c = 1;\n', 'feat: c');
  record(head, later);
  const said = row();
  assert.equal(said.pass, false, said.detail);
  assert.match(said.detail, /1 record of a run with no result line, written after the first run that has one, as an older js-harness writes it/);
});

// L84 of odd/tasks/review-gate.md (T3 of odd/tasks/again-subrange.md): the older-writer note counted the whole log, so
// after the cut it named a record of another branch that has nothing to do with the range checked.
test('the older-writer note names only records of the range checked, not one of another branch', () => {
  const { subjectHash } = lensCandidate(dir, { base, head });
  const now = record(base, head);
  endLensRun(dir, { id: now, base, head, subjectHash, outcome: 'reviewed', results: [{ lens: 'risk', outcome: 'complete', findings: [] }] });
  git('checkout', '-q', '-b', 'other', base);
  const elsewhere = commit('d.mjs', 'export const d = 1;\n', 'feat: d elsewhere');
  record(base, elsewhere);
  git('checkout', '-q', 'feature');
  const said = row();
  assert.equal(said.pass, true, said.detail);
  assert.doesNotMatch(said.detail, /as an older js-harness writes it/);
  assert.doesNotMatch(said.detail, /no evidence/);
});

// Row 3 of docs/proposals/gentle-ai-reverse-engineering.md, section 13.3: provenance is what refuses a well-shaped forged
// record, one a session appended by hand, since it names no run line `lens-review` wrote first.
test('a well-shaped record that names no run line lens-review wrote is refused by the push, and said', () => {
  const { subjectHash } = lensCandidate(dir, { base, head });
  const forged = { schema: LENS_REVIEW_SCHEMA, base, head, subjectHash, reviewedAt: new Date().toISOString(), outcome: 'reviewed', results: [{ lens: 'risk', outcome: 'complete', findings: [] }] };
  appendLensReview(dir, forged);
  appendLensReview(dir, { ...forged, run: 'f'.repeat(36) });
  const said = row();
  assert.equal(said.pass, false);
  assert.match(said.detail, /2 records that are no evidence \(an incomplete run, or a record no run line of lens-review names, among them\) ignored/);
  record(base, head);
  assert.equal(row().pass, true);
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
const codexRecord = (over) => appendCodexReview(dir, withRunLine(dir, { schema: CODEX_REVIEW_SCHEMA, base, head, reviewedAt: new Date().toISOString(), ...over }));

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
  assert.equal(debt().detail, 'no Claude lens record for 2 of 2 code commits since origin/main; the Codex review is off here, so the lenses are the one review, and no push is refused for a missing record, only for a correction owed');
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

test('on a branch that turns the Codex review off midway, the door asks the lens record of the off commits alone', () => {
  const off = withoutAutoMaintenance(() => {
    git('reset', '-q', '--hard', base);
    fs.writeFileSync(path.join(dir, 'harness.json'), '{ "functions": { "codexReview": "on", "lensReview": "off" } }\n');
    commit('a.mjs', 'export const a = 3;\n', 'feat: three, the Codex review alone');
    fs.writeFileSync(path.join(dir, 'harness.json'), '{ "functions": { "codexReview": "off", "lensReview": "off" } }\n');
    return commit('a.mjs', 'export const a = 4;\n', 'feat: four, the Codex review off');
  });
  assert.match(lensDoor(dir, 'HEAD').detail, /^lens review: 1 of 1 code commit since origin\/main have no complete Claude lens record/);
  record(base, off);
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

// B2-2 of the full audit of 2026-11-14: "lens findings never block". A BLOCKER or CRITICAL finding of an admitted lens
// review is owed until an admitted recheck of that run, by that lens, marks it fixed, as a Codex correction is owed.
const finding = (severity, claim = 'the gate passes unreviewed code') => ({ location: 'a.mjs:1', severity, claim, evidence_class: 'deterministic', causal_disposition: 'introduced', proof_refs: ['a test'] });
const found = (lens, findings) => ({ results: [{ lens, outcome: 'complete', findings }] });

test('B2-2: a CRITICAL lens finding refuses the push, the door and is said by the review row, with the recheck as the step', () => {
  record(base, head, found('risk', [finding('CRITICAL')]));
  const said = row();
  assert.equal(said.pass, false);
  assert.match(said.detail, /the lens review that ended at [0-9a-f]{7} owes a correction: 1 BLOCKER or CRITICAL finding open, not rechecked/);
  assert.match(said.lines.join('\n'), /risk CRITICAL a\.mjs:1 the gate passes unreviewed code/);
  assert.deepEqual(said.next, firstStep('fix the open findings above in code and commit the fix'));
  const door = lensDoor(dir, 'HEAD');
  assert.equal(door.pass, false);
  assert.match(door.detail, /^lens review: the lens review that ended at [0-9a-f]{7} owes a correction/);
  assert.deepEqual(door.review, { tool: 'lens-review', base: head.slice(0, 7) });
  const debt = checkReviewDebt(dir);
  assert.equal(debt.pass, true);
  assert.match(debt.detail, /owes a correction/);
});

test('B2-2: WARNING and SUGGESTION findings owe nothing', () => {
  record(base, head, found('risk', [finding('WARNING'), finding('SUGGESTION')]));
  assert.equal(row().pass, true);
  assert.equal(lensDoor(dir, 'HEAD'), null);
});

test('B2-2: a fresh review over the fix, after a document, does not pay the correction; a recheck of that run does', () => {
  const run = record(base, head, found('risk', [finding('WARNING', 'a smaller edge'), finding('BLOCKER')]));
  commit('notes.md', 'the fix is next\n', 'docs: plan the fix');
  const fix = commit('a.mjs', 'export const a = 3;\n', 'fix: the blocker');
  record(git('rev-parse', `${fix}^`), fix);
  const fresh = row();
  assert.equal(fresh.pass, false, 'a review that is no recheck of that run leaves the finding owed');
  assert.match(fresh.detail, /owes a correction: 1 BLOCKER or CRITICAL finding open/);
  assert.deepEqual(fresh.next, commandStep(`js-harness lens-review --base ${head.slice(0, 7)} --at ${fix.slice(0, 12)} --lenses <lens,...> --reason "<what it touched and how>"`), 'the recheck runs from the head that owes, past the document');
  record(head, fix, { recheckOf: run, ...found('risk', []) });
  assert.equal(row().pass, true);
  assert.equal(lensDoor(dir, 'HEAD'), null);
});

test('B2-2: a recheck that leaves the finding open passes with a warning that names it', () => {
  const run = record(base, head, found('risk', [finding('CRITICAL')]));
  const fix = commit('a.mjs', 'export const a = 3;\n', 'fix: try');
  record(head, fix, { recheckOf: run, ...found('risk', [finding('CRITICAL', '[not fixed] 1 still passes')]) });
  const said = row();
  assert.equal(said.pass, true);
  assert.match(said.lines.join('\n'), /warning: the lens recheck that ended at [0-9a-f]{7} left 1 BLOCKER or CRITICAL or blocking finding open/);
  assert.equal(lensDoor(dir, 'HEAD'), null);
});

test('B2-2: a recheck by another lens, or one no run line names, pays nothing', () => {
  const run = record(base, head, found('risk', [finding('CRITICAL')]));
  const fix = commit('a.mjs', 'export const a = 3;\n', 'fix: the critical');
  record(head, fix, { recheckOf: run, ...found('reliability', []) });
  assert.equal(row().pass, false, 'a recheck that did not pick risk pays nothing for it');
  const { subjectHash } = lensCandidate(dir, { base: head, head: fix });
  appendLensReview(dir, { schema: LENS_REVIEW_SCHEMA, base: head, head: fix, subjectHash, run: 'e'.repeat(36), reviewedAt: new Date().toISOString(), outcome: 'reviewed', recheckOf: run, ...found('risk', []) });
  assert.equal(row().pass, false, 'a forged recheck pays nothing');
});

// Codex and the lenses on S6: each lens of a record is read alone.
test('B2-2: in a recheck, a lens that rechecks nothing reviews afresh, and its CRITICAL is owed', () => {
  const run = record(base, head, found('risk', [finding('CRITICAL')]));
  const fix = commit('a.mjs', 'export const a = 3;\n', 'fix: the critical');
  record(head, fix, { recheckOf: run, rechecked: { risk: [run] }, results: [{ lens: 'risk', outcome: 'complete', findings: [] }, { lens: 'reliability', outcome: 'complete', findings: [finding('CRITICAL', 'a new hole')] }] });
  const said = row();
  assert.equal(said.pass, false);
  assert.match(said.lines.join('\n'), /reliability CRITICAL a\.mjs:1 a new hole/);
});

test('B2-2: a recheck of WARNINGs that finds a CRITICAL owes it', () => {
  const run = record(base, head, found('risk', [finding('WARNING', 'an edge')]));
  const fix = commit('a.mjs', 'export const a = 3;\n', 'fix: the edge');
  record(head, fix, { recheckOf: run, rechecked: { risk: [run] }, ...found('risk', [finding('CRITICAL', '[blocks] a regression')]) });
  assert.equal(row().pass, false);
});

test('B2-2: two reviews that end at one head are both paid by the one recheck that names both runs', () => {
  const first = record(base, head, found('risk', [finding('CRITICAL')]));
  const second = record(base, head, { results: [{ lens: 'risk', outcome: 'complete', findings: [finding('BLOCKER', 'another')] }, { lens: 'reliability', outcome: 'complete', findings: [finding('CRITICAL', 'a third')] }] });
  const fix = commit('a.mjs', 'export const a = 3;\n', 'fix: all three');
  record(head, fix, { recheckOf: second, rechecked: { risk: [first] }, ...found('risk', []) });
  assert.equal(row().pass, false, 'the second run is owed while no recheck names it');
  record(head, fix, { recheckOf: second, rechecked: { risk: [first, second], reliability: [second] }, results: [{ lens: 'risk', outcome: 'complete', findings: [] }, { lens: 'reliability', outcome: 'complete', findings: [] }] });
  assert.equal(row().pass, true);
});

test('B2-2: a recheck that fixes the finding but marks a new one blocking passes with a warning that names it', () => {
  const run = record(base, head, found('risk', [finding('CRITICAL')]));
  const fix = commit('a.mjs', 'export const a = 3;\n', 'fix: the critical');
  record(head, fix, { recheckOf: run, rechecked: { risk: [run] }, ...found('risk', [finding('WARNING', '[blocks] the fix exposes a token')]) });
  const said = row();
  assert.equal(said.pass, true);
  assert.match(said.lines.join('\n'), /left 1 BLOCKER or CRITICAL or blocking finding open/);
  assert.match(said.lines.join('\n'), /risk WARNING a\.mjs:1 \[blocks\] the fix exposes a token/);
});

// F3 (the opus verifier on PR 896; the lead, L34 of odd/tasks/review-gate.md): turning the Codex review off at the tip
// asks no lens record of what is uncovered, as before, but does not drop a correction a lens review already owes,
// as the door does not; `lens-review` records the recheck with the review off.
const CODEX_OFF = '{ "functions": { "codexReview": "off", "lensReview": "on" } }\n';

test('F3: turning the Codex review off at the tip keeps the lens correction owed until a recheck pays it', () => {
  const run = record(base, head, found('risk', [finding('CRITICAL')]));
  let off;
  withoutAutoMaintenance(() => {
    fs.writeFileSync(path.join(dir, 'harness.json'), CODEX_OFF);
    off = commit('a.mjs', 'export const a = 3;\n', 'fix: the finding, with the Codex review off');
  });
  const said = row();
  assert.equal(said.pass, false, said.detail);
  assert.match(said.detail, /the lens review that ended at [0-9a-f]{7} owes a correction: 1 BLOCKER or CRITICAL finding open, not rechecked/);
  record(head, off, { recheckOf: run, rechecked: { risk: [run] }, ...found('risk', []) });
  const paid = row();
  assert.equal(paid.pass, true, paid.detail);
  assert.equal(paid.detail, 'the review is off at the pushed commit, so no lens record is asked for');
});

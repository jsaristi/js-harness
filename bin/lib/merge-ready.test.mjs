import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeReadiness, testedMerge } from './merge-ready.mjs';

const HEAD = 'h'.repeat(40).replace(/h/g, 'a');
const MAIN = 'b'.repeat(40);
const OLD = 'c'.repeat(40);

const pr = (over = {}) => ({ number: 7, state: 'OPEN', isDraft: false, mergeable: 'MERGEABLE', baseRefName: 'main', body: 'Checks: gentle-ai assessment passive.', headRefOid: HEAD, ...over });
const facts = (over = {}) => ({
  pr: pr(),
  main: MAIN,
  run: { id: 42, status: 'completed', conclusion: 'success' },
  tested: { head: HEAD, base: MAIN },
  baseIsAncestor: true,
  changedSinceBase: [],
  mergeTreeClean: true,
  pullMergeParent: MAIN,
  ...over,
});

test('a pull request that conflicts with main names the files and says how to keep the merge of main clean (S7)', () => {
  const no = mergeReadiness(facts({ pr: pr({ mergeable: 'CONFLICTING' }), conflicts: ['bin/check.mjs', 'README.md'] }));
  assert.equal(no.code, 1);
  assert.deepEqual(no.said, [
    'PR 7 is not mergeable (CONFLICTING).',
    `PR 7 conflicts with main bbbbbbb in bin/check.mjs, README.md. Before merging main into its branch, move the branch's own change out of those lines in a small commit of its own, with its own small Codex review, so that the merge is clean; a conflict resolved in the merge is reviewed by its diff with the automatic merge.`,
  ]);
  // Unknown or none: only the line it said before.
  for (const conflicts of [null, []]) {
    assert.deepEqual(mergeReadiness(facts({ pr: pr({ mergeable: 'CONFLICTING' }), conflicts })).said, ['PR 7 is not mergeable (CONFLICTING).']);
  }
});

test('the tested merge is read from the checkout log line, by full ids', () => {
  const log = `check\tRun actions/checkout\t2026-10-14T07:08:13Z HEAD is now at eb6a57e Merge ${HEAD} into ${MAIN}\n`;
  assert.deepEqual(testedMerge(log), { head: HEAD, base: MAIN });
  assert.equal(testedMerge('no such line'), null);
});

test('a pull request whose run is green against the main it lands on is ready, exit 0', () => {
  const ready = mergeReadiness(facts());
  assert.equal(ready.code, 0);
  assert.match(ready.said.at(-1), /^PR 7 is ready: run 42 is green on head aaaaaaa against main bbbbbbb\.$/);
});

test('each check of the pull request itself fails with exit 1 and says which', () => {
  for (const [over, why] of [
    [{ state: 'CLOSED' }, /is CLOSED, not open/],
    [{ isDraft: true }, /is a draft/],
    [{ mergeable: 'CONFLICTING' }, /is not mergeable \(CONFLICTING\)/],
    [{ baseRefName: 'dev' }, /targets dev, not main/],
    [{ body: 'No checks here.' }, /body has no gentle-ai line/],
  ]) {
    const no = mergeReadiness(facts({ pr: pr(over) }));
    assert.equal(no.code, 1, JSON.stringify(over));
    assert.match(no.said.join('\n'), why);
  }
});

test('no run for the head, a run not finished, or a red one, is exit 4', () => {
  assert.equal(mergeReadiness(facts({ run: null })).code, 4);
  assert.match(mergeReadiness(facts({ run: null })).said.join('\n'), /no run for head aaaaaaa/);
  assert.equal(mergeReadiness(facts({ run: { id: 42, status: 'in_progress', conclusion: null } })).code, 4);
  assert.equal(mergeReadiness(facts({ run: { id: 42, status: 'completed', conclusion: 'failure' } })).code, 4);
  // A run that tested another head is not the run of this one.
  assert.equal(mergeReadiness(facts({ tested: { head: OLD, base: MAIN } })).code, 4);
  // A log with no tested merge says so, and is no green.
  assert.equal(mergeReadiness(facts({ tested: null })).code, 1);
});

test('a tested base behind main only by documents is ready; behind it by code or AGENTS.md is stale, exit 3', () => {
  const docs = mergeReadiness(facts({ tested: { head: HEAD, base: OLD }, changedSinceBase: ['docs/ROADMAP.md', 'odd/tasks/x.md'] }));
  assert.equal(docs.code, 0);
  assert.ok(docs.said.some((line) => /behind main only by documents/.test(line)), docs.said.join('\n'));
  for (const changed of [['bin/check.mjs'], ['docs/a.md', 'AGENTS.md'], ['skills/x/AGENTS.md']]) {
    const stale = mergeReadiness(facts({ tested: { head: HEAD, base: OLD }, changedSinceBase: changed }));
    assert.equal(stale.code, 3, changed.join(' '));
  }
  assert.equal(mergeReadiness(facts({ tested: { head: HEAD, base: OLD }, baseIsAncestor: false })).code, 3);
  // Behind by documents, but in conflict with main: not ready, and not stale either.
  assert.equal(mergeReadiness(facts({ tested: { head: HEAD, base: OLD }, changedSinceBase: ['docs/a.md'], mergeTreeClean: false })).code, 1);
});

test('a stale pull request says to reopen it only once GitHub has recomputed its merge against main', () => {
  const stale = (pullMergeParent) => mergeReadiness(facts({ tested: { head: HEAD, base: OLD }, changedSinceBase: ['bin/x.mjs'], pullMergeParent })).said.join('\n');
  assert.match(stale(MAIN), /close and reopen PR 7 for a fresh run/);
  assert.match(stale(OLD), /refs\/pull\/7\/merge still has cccccc. as its first parent, not main bbbbbbb: wait before reopening/);
  assert.match(stale(null), /could not read refs\/pull\/7\/merge: wait before reopening/);
});

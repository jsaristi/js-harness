# review-gate: one honest review gate

## State
JH 207, branch feat/review-gate, based on main once 883 landed (Q288). Done: ce9eb0a6 (this document), c07285b1 S1/Y1 (Codex correct 0.86, lenses 0), ffe89f69 S2/B1-2 (Codex correct 0.86, 69,655 input tokens; lens reliability WARNING: no test of throughNoReview past one skip, L9). Next: unit tests of recheckAnchor in codex-review-recheck.test.mjs for a chain of two no-review records, a skip then nothing-to-review, documents between them, and a record whose base is older than the nearest review; commit; then S3 B1-1, S4 B2-1, S5 (go, L10: first the old-vs-new push row on every open branch), S6 B2-2, S7 G-2, push, draft PR to main, verifier. Keep js-harness wait --notice-to 207 running.
C:\Users\Oficina\.js-harness\background\briefs\2026-11-15T12-20-39-311Z-c126f3fd.md. Orientation done; plan draft and
advisor answer taken (see Log L2). Next: read verify5 (Temp scratchpad path on line 4 of the lead's
jh199-verify5-883.md), `git show worktree-full-audit:odd/tasks/full-audit.md`, his words (`js-harness sessions --quote`
69918425 line 13084); notify the lead of the counts (L3); then write the contract, depth pass, specs, tasks here before
any source write. Slices: S1 Y1 (correctionOwed reads recheckAt(tip) when no reviewed record covers the newest code
commit; afterTurn's nothing-to-review gap branch asks recheckAt; tests on real `check --push` for C1f, C1e, C1d);
S2 B1-2 (recheckAnchor reads through non-review records, or refuse --unavailable when owed: decide in the depth pass);
S3 B1-1 (marks re-asked at rec.head); S4 B2-1 (Codex asked per commit tree when off at tip); S5 C-3+B2-12 (run-line
admission, waits on the lead: 78 records); S6 B2-2 (lens CRITICAL/BLOCKER block, admitted records only); S7 G-2.

## Goal
The review gate (`check --push`, the merge door, `check`) passes only code a reviewer read, by one evidence rule the
Codex and lens records share.

## Why
The full audit of 2026-11-14 found the gate passes code no reviewer read, or a forged record (B1-1, B1-2, B2-1, B2-2,
C-3 + B2-12, G-2), and JH 199's verifier found Y1, which holds PR 883 for the owner.

## Done when
- `npm run check` exits 0
- Each finding (Y1, B1-1, B1-2, B2-1, B2-2, C-3 + B2-12, G-2) is closed by a test that failed on 08653f93, or answered here with why not
- Codex and the lenses reviewed each code slice; one opus verifier passed clean on the whole

## In scope / Out of scope
- In: bin/lib/codex-review-*.mjs, codex-reviews.mjs, lens-review*.mjs, merge-queue-reviews.mjs, check.mjs, their tests
- Out: odd/tasks/codex-spend.md (JH 199's), the guard's denylist rewrite (C-38), B1-3..B1-24

## Constraints
- A fix that refuses records already in codex-reviews.jsonl or lens-reviews.jsonl stops for the lead with the count — the owner's call
- PRs are drafts stacked on feat/codex-spend-t2 — 883 is held for the owner

## Ask me before
Refusing existing records (S5's 78); anything that changes who decides a waiver.

## Depth pass
- 1. Method: an access-control reviewer's: one invariant per finding, written as a test against the real entry
  (`check --push`, the run, the merge door), red on the base before any fix, and the smallest change that makes the
  gate read the debt the way the run reads it (`recheckAt`, the one definition `codex-review-coverage.mjs:1-10` asks
  for). Searched first: `recheckAt`, `recheckThrough`, `correctionOwed`, `afterTurn`, `admittedLensReviews`; each fix
  amends one of them, none adds a module.
- 2. Raw material: the audit's readers, `full-audit/B1.md` (B1-1 at `bin/lib/codex-review-coverage.mjs:269-287`, B1-2 at
  `bin/lib/codex-review-rows.mjs:103-109`), `B2.md` (B2-1 at `bin/lib/codex-review-rows.mjs:180-184`, B2-2, B2-12 at
  `bin/lib/codex-reviews.mjs:117-125`), `C.md` (C-3), `G.md` (G-2 at `bin/check.mjs:1801-1807`), `verifier.md`; JH 199's
  verifier, `jh199-verify5-883.md` and `verify5/out-C1d.txt`:20-30 (C1e and C1f: run exit 0, row passes,
  `recheckAt(HEAD)` owes); commit 13367429 (`afterTurn`'s nothing-to-review branch); the real records,
  `<git common dir>/js-harness/codex-reviews.jsonl` (1,456 lines) and `lens-reviews.jsonl` (596), counted in L2; his
  answer, transcript 69918425-3b43-430f-9f50-62b6422422ce line 13084.
- 3. The bar:
  spec 1: `node --test --test-name-pattern="^Y1" bin/check-codex-reviews.test.mjs bin/codex-review.test.mjs`: 4 of 7 fail on 08653f93 and 3 of 4 on main 7de0b95 (L3); 7 of 7 pass after S1
  spec 2: `node --test --test-name-pattern="^B1-2" bin/check-codex-reviews.test.mjs bin/codex-review.test.mjs`: 3 of 4 fail with S1 applied (L5); 4 of 4 pass after S2
  spec 3: left out because B1-1 waits for S3's test
  spec 4: left out because B2-1 waits for S4's test
  spec 5: left out because C-3 + B2-12 refuse 78 real records and wait for the owner (L4)
  spec 6: left out because B2-2 waits for S6's test
  spec 7: left out because G-2 waits for S7's test
  spec 8: `node --test bin/codex-review.test.mjs bin/codex-review.second.test.mjs bin/check-codex-reviews.test.mjs bin/lib/codex-review-turns.test.mjs bin/lib/codex-review-recheck.test.mjs`: JH 199's probes (V1, V2, W1, X1) pass before and after each slice
- 4. Refutation: whether the gate already refuses Y1 somewhere else, so the finding would not hold: the real
  `check --push` on C1f, `node --test --test-name-pattern="^Y1" bin/check-codex-reviews.test.mjs` on 08653f93: exit 1
  with 3 of 4 failing (the push passes); and the default run exits 0 (C1f and C1e, 2 of 2).
  Verdict: supports
- 5. Request: close each finding of the review gate with a test that failed on 08653f93 or an answer here, by one rule
  shared by the run, the push row and the door: a record that is no review (a skip, a range with nothing to review)
  pays no correction and covers no code a reviewer did not read; S5's run-line admission waits for the owner because
  it refuses 78 real records.
  Adds: none

## Specs
1. Y1: "a review owing a correction, followed by a commit and its revert, records nothing-to-review, and the push row
   passes while `recheckAt(HEAD)` still says the finding is owed" (the brief); and `afterTurn`'s nothing-to-review
   branch for a one-turn merge. Cover the real `check --push`.
2. B1-2: "an `--unavailable` skip erases an owed correction".
3. B1-1: "removing a `-codex-review` mark leaves unreviewed code covered".
4. B2-1: "commits before a `codexReview: false` commit are asked by no review".
5. C-3 + B2-12: "a forged Codex record is accepted by `check --push`".
6. B2-2: "lens findings never block".
7. G-2: "`check`'s quiet line hides the Codex debt; make it show both debts".

## Tasks
- [x] T1 (kind: design) depth pass, specs and the slice plan, written here
- [x] T2 (kind: build) S1, c07285b1, spec 1: correctionOwed reads `recheckAt(tip)` when only no-review records cover the newest code commit; afterTurn and the plain run fail on a nothing-to-review record over a debt
- [ ] T3 (kind: build) S2, spec 2: the debt read through a skip over code (recheckAnchor walks no-review records)
- [ ] T4 (kind: build) S3, spec 3: marks asked again at the record's head
- [ ] T5 (kind: build) S4, spec 4: Codex asked at each commit's own switch when the tip has it off
- [ ] T6 (kind: build) S5, spec 5: go (L10); old-vs-new push row per open branch first
- [ ] T7 (kind: build) S6, spec 6: lens BLOCKER/CRITICAL owed until a lens recheck, admitted records only
- [ ] T8 (kind: build) S7, spec 7: the quiet line shows both debts
- [ ] T9 (kind: verify) one opus verifier on the whole

## Log
- L1 2026-11-15, his request: question 287, answered 02:51 local, "Puerta de revisión (Recomendada)" (quote to be read
  with js-harness sessions --quote).
- L2 2026-11-15, counts (read-only, scripts in job tmp): Codex records 1,456: 1,353 reviewed naming a matching run line,
  25 unavailable, 78 reviewed with no run (2026-09-29..10-09): 74 heads on origin/main, 2 on feat/codex-parity, 2 on no
  branch. No Codex nothing-to-review record exists. Of 25 skips, 14 sit on a second recheck (warning), 0 on a first
  recheck: reading debt through skips newly refuses 0. Lens: 4 reviewed records hold CRITICAL; 2 not rechecks; the
  one off main, d57e5651, is on no branch. JH 199's probes are tests already (codex-review.test.mjs:4186-4496).
  Advisor: split Y1 from B1-2; S4 would also make coverage depend on the run log (owner's call); confirm by old-vs-new
  push row on every unmerged tip once predicates exist.
- L3 2026-11-15, S1's tests red first: on 08653f93, `node --test --test-name-pattern="^Y1" bin/check-codex-reviews.test.mjs`
  failed 3 of 4 (the row and `check --push` pass over the debt; the owed-nothing control passes), and in
  bin/codex-review.test.mjs C1e gave `[0, 0]` for `[1, 0]` and C1f exit 0 for 1; `afterTurn` on the base returned no
  refusal (actual ''). On main 7de0b95 (`git archive 7de0b95 bin` in a mktemp folder, this branch's test file): the same
  3 of 4 fail. After the fix: 7 of 7 pass.
- L4 2026-11-15T12:38Z, the lead (note, 07:38 local): S5 parked until the owner returns (~10:58 local); Y1 and B1-2,
  0 refused, go; the contracts row's refusal of a depth pass on a stacked branch: never --no-verify, keep this
  document in the worktree, and if a code commit is refused for it, stop and report the row's exact output.
- L5 2026-11-15, S2 (B1-2), on top of S1 uncommitted: `node --test --test-name-pattern="^B1-2" bin/check-codex-reviews.test.mjs`
  failed 2 of 3 (the skip-over-code row and `check --push`; the owed-nothing control passes), and the run-level test
  failed at "the skip pays nothing" (the row passed). Fix: recheckAnchor reads the line from the nearest review
  through records that are no review (`throughNoReview`), so the push row (through S1's recheckAt(tip)) and the next
  run (a recheck of the findings) read the same debt. After: 4 of 4. Chosen over refusing `--unavailable` when a
  correction is owed (B1.md's other option): that one would leave the 25 real skips and any hand-written one free to
  erase a debt, while reading through holds for records already written; it newly refuses 0 (L2).
- L6 2026-11-15T12:47Z, the lead (note, 07:47 local): the contracts judge reads trunk..HEAD whole, so no commit order
  fixes it, and a fix to it would be refused the same way; no bypass. Save S1 as a patch in the lead's notes folder,
  keep it staged, no more source writes; finish the depth pass and slice plan, then wait. Unblocking is the owner's
  (~10:58 local): if 883 lands, rebase on main and commit. S2 had been written before this note was read; it is saved
  beside S1 and no source was written after.
- L7 2026-11-15, the five suites on S1+S2 (codex-review x2, check-codex-reviews, turns, recheck): 568 tests, 562 pass,
  1 fail, 5 skipped. The fail is S2's: codex-review-recheck.test.mjs:288 pins one git question where nothing owes,
  and `throughNoReview` asks `changedBetween(nearest, from)` a second time. Fix on unblock: return false before any
  git question when no record that is no review lies on the line, and start the walk past the check
  `recheckAnchor` already made. JH 199's V1/V2/W1/X1 pass. On S1 alone the run had 1 fail, the file-split self-check,
  from S2's test added mid-run (rerun alone: 2 of 2 pass).
- L8 2026-11-15, 883 landed (Q288, 10:22 local); this branch now measures from main. S1 committed as c07285b1 after
  a first gate refusal: codex-review.mjs may not grow past its 2258 lines (conventions), so the run's check moved to
  `nothingPaidExit` in codex-review-turns.mjs. Codex on ce9eb0a..c07285b: correct, 0.86, 180,394 input tokens; lenses
  risk and reliability: 0 findings each. S2 committed with L7's fix: codex-review-recheck.test.mjs 30 of 30, the Y1
  and B1-2 tests 11 of 11.
- L9 2026-11-15, S2's reviews: Codex on c07285b..ffe89f6: correct, 0.86, 69,655 input tokens; lenses: risk 0, reliability 1 WARNING (codex-review-recheck.mjs:125-142, the multi-step walk, the greedy oldest base and the limit filter have no test past one skip on the reviewed head). Taken: tests of those shapes come next.
- L10 2026-11-15T17:40Z, his answer to question 293 (lead transcript 69918425-3b43-430f-9f50-62b6422422ce line 17348, read with sessions --quote): "Exigirla a todos (Recomendada)". S5 is a go: every Codex record must name its run line, the 78 included. The lead's condition: before building, run the old-vs-new push row branch by branch, and stop if an open branch loses its review.

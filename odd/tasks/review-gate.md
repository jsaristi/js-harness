# review-gate: one honest review gate

## State
JH 207, branch feat/review-gate (worktree D:/js-harness-worktrees/review-gate), pushed at e455d9f8, draft PR 896 to main. S1-S7 and their fixes reviewed by Codex and the lenses (L9-L29). The opus verifier (T9) found three (L30), so NOT ready: next, in order, tests first for each, red on e455d9f8: F1 (admittedCodexReviews admits a record only where the last line of its last run has outcome reviewed; count the honest records it would refuse first, stop for the lead if any), F2 (correctionOwed at codex-review-rows.mjs:130 and recheckAt in codex-review-turns.mjs:82,350 and codex-review.mjs:1262 read the admitted Codex records only), F3 asked of the lead (a correction owed when the tip turns a review off: keep owing or not; the lens push row returns at lens-review-rows.mjs:277 before correctionRefusal). Every codex-review after its --plan (L28). Then Codex and lenses on the fix, push, the verifier again on the fix, notify ready.
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
  spec 3: `node --test --test-name-pattern="^B1-1" bin/check-codex-reviews.test.mjs`: red at 863bf569 (L15) and on 89e082af for the moved file (L17); green after S3
  spec 4: `node --test --test-name-pattern="^B2-1" bin/check-functions.test.mjs bin/lib/merge-queue-reviews.test.mjs`: red before S4 (L15; the door test against a61d8627^'s rows, L27); green after
  spec 5: `node --test --test-name-pattern="^C-3" bin/lib/codex-review-coverage.test.mjs`: 3 of 3 pass, 2 red before the S5 fix (L22); the S5 suites of L20 green; the 78 refused by his answer (L10, L16)
  spec 6: `node --test --test-name-pattern="^B2-2" bin/lib/lens-review-rows.test.mjs bin/lens-review.test.mjs`: red before S6 and its fix (L24, L26); green after
  spec 7: `node --test --test-name-pattern="^G-2" bin/check-quiet.test.mjs`: red before S7 (L25); green after
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
- [x] T3 (kind: build) S2, ffe89f69 and 764d366f, spec 2: the debt read through a skip over code (recheckAnchor walks no-review records)
- [x] T4 (kind: build) S3, 89e082af, spec 3: marks asked again at the record's head
- [x] T5 (kind: build) S4, a61d8627 (fixes 641706ee), spec 4: Codex asked at each commit's own switch when the tip has it off
- [x] T6 (kind: build) S5, 5fd3e493 (fixes after L22), spec 5: go (L10); old-vs-new push row per open branch first
- [x] T7 (kind: build) S6, spec 6: lens BLOCKER/CRITICAL owed until a lens recheck, admitted records only
- [x] T8 (kind: build) S7, spec 7: the quiet line shows both debts
- [ ] T9 (kind: verify) one opus verifier on the whole: first pass found F1-F3 (L30)

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
- L11 2026-11-15, the lens WARNING of L9 answered: two tests in codex-review-recheck.test.mjs (chains of skips and ranges with nothing to review, documents between them, the oldest base taken first, and a record whose base is older than the reviewed head). The last one failed before the fix (`recheckAnchor` returned E, not B: the `<= limit` filter dropped a skip over the reviewed head, so `--base` below it erased the correction, B1-2 by another door); the filter is gone and the walk ends once it reaches or passes the reviewed head. recheck 32 of 32. Count: 1 of 25 no-review records spans a reviewed head (unavailable 5cccfc4..29b1b6b, on main since 2026-10-16), and no range starts at 29b1b6b, so no open branch is newly refused.
- L12 2026-11-15, L11 committed as 764d366f (gate passed). Codex on 104d987..764d366: correct, 0.94, 70,184 input tokens, no findings; lenses reliability and risk: 0 findings each. S5's pre-build check (L10) runs as a read-only script in the job tmp (oldnew.mjs): for each open branch, reviewCoverage from origin/main with today's records against only the reviewed records a run line of the log names (same id, head and base, unclaimed before).
- L13 2026-11-15, S5's pre-build check (oldnew.mjs, read-only): of 68 open branch tips (local and origin, not in origin/main), 1 loses a covered code commit under run-line admission: feat/codex-parity, 2 of 5 (5f772ede, ef0e71f1), whose two Codex records (2026-10-05, 9c9ed8e..ef0e71f and ef0e71f..5f772ed) name no run line. The branch is local only (no origin head), last commit 4d647296 on 2026-10-24. Admitted: 1,361 of 1,439 reviewed records. A first pass read 19 branches as losing; that was the script comparing record objects across two reads, fixed by keying records on base, head, run and time. Per L10 S5 stops here for the lead; S3, S4, S6 and S7 go on meanwhile.
- L14 2026-11-15T18:54Z, the lead (note, 13:54 local): S5 holds for the owner; feat/codex-parity is not dead (its commits are not on main), so what it costs that branch is his question, asked after the land; keep that case ready as a test of the expected refusal; leave the branch alone; go on with S3, S4, S6, S7.
- L15 2026-11-15, S3 (B1-1) and S4 (B2-1), tests first. B1-1: `node --test --test-name-pattern="^B1-1" bin/check-codex-reviews.test.mjs` red at 863bf569 (the row passed, "3 code commits ... all covered"; codex-review-coverage.mjs is unchanged since 08653f93), green after `reviewCoverage` asks the marks again at the head of a record that left marked files out and drops a commit whose file is code at the tip but marked there. B2-1: `node --test --test-name-pattern="^B2-1" bin/check-functions.test.mjs` red (the off row passed), green after `madeWithReviewOn` in codex-review-rows.mjs asks a record of the uncovered code commits whose own tree has the review on, as the lens door reads its switch; with no remote the off row passes as before. Counts: of 68 open branches one is off at its tip (origin/memory-summary) and still passes; no branch is newly refused by S4. S3: the old coverage (863bf569) against the new over 69 open branches: 0 lose a covered commit.
- L16 2026-11-15T19:20Z, his answer to question 299 (lead transcript 69918425-3b43-430f-9f50-62b6422422ce line 18336, read with sessions --quote): "Seguir con S5 (Recomendada)". S5 is built with run-line admission for every record; the feat/codex-parity case (5f772ede, ef0e71f1) is kept as a test of the expected refusal and the branch is left untouched. Main is now 5f22aa6 (the lead, 14:20 local).
- L17 2026-11-15, Codex on 863bf56..a61d862 (S3 and S4 together): incorrect, 0.96, 195,644 input tokens, two P2, both taken. (1) S4's refusal bound its step to the tip, where `codex-review` records nothing with the review off: now bound to the newest commit made with it on (`check out <it>`); the B2-1 test asserts it, red before. (2) S3 dropped a commit whose file of code was moved into a marked path, which the review reads whole: what a record left out is now read from its range with `rangeFiles` and `reviewScope` at its head (`leftByReview`); a new B1-1 test, red on 89e082af, green now. Suites: check-functions, check-codex-reviews, lens-review-rows, coverage, lens-review: 215 of 215.
- L18 2026-11-15, Codex recheck of a61d862..641706e: correct, 0.94, 172,077 input tokens, 2 of 2 fixed; lenses reliability and risk over 863bf56..641706e: 0 findings each.
- L19 2026-11-15, S5 built. The lead's go (16:46 local): memory freed, main cf5bd6f merged in first (e828ba19, the S5 work set aside in a tagged stash and applied back by its id), suites one file at a time. `admittedCodexReviews` (codex-review-coverage.mjs) is `reviewCoverage`'s default read: a review counts where every run it names has a line, a line of the last one says the record's range (base or from, and head), and no earlier record claimed that run over that range; a skip as it is; a range with nothing to review only where `git diff base head` changes no file a review reads. First rule (the last line of a run must say the range, the run claimed alone) failed fixtures that write the record before its answer line, and two records on one run; the rule now claims run and range together, as the lens rule keys its runs by range, and is no weaker against a hand-written record, which needs a run line of its own either way. Fixtures: bin/lib/codex-records.testkit.mjs (`withRunLine`, `giveRange`, `recordLine`) in 8 test files. Tests changed in meaning: "a branch with no run log passes as before" now refuses (S5's point); "never where the run log holds none" dropped, no case since S5. Results: check-codex-reviews 126/126, codex-review 223/224 then the changed test green, gate 80/80, merge-queue 128/128.
- L20 2026-11-15, S5's suites all green, one file at a time: check-codex-reviews 126, codex-review 224, gate 80, merge-queue 128, merge-queue-reviews 8, lens-review-rows 23, coverage 31 (one test changed in meaning: a range with nothing to review over a code commit is refused by git, S5's point), turns 27 (a review with no run line now written bare). Old-vs-new with the real code (HEAD's coverage against the tree, s3count.mjs): of 67 open branches only feat/codex-parity loses 5f772ede and ef0e71f1, as the owner was told (Q299); feat/review-gate keeps all. The lead's restart order (17:34 local): S5 to a commit, push once its review is paid, state written, closed.
- L21 2026-11-15, the first commit of S5 was refused by the gate on GitHub: 3 tests of codex-review.test.mjs that run there and not here (onlyRun counts the run log's lines) saw the testkit's lines; those lines now say `testkit: true` and that file's reader leaves them out. Locally codex-review.test.mjs 223 pass, 0 fail. The lead (17:58 local): the owner restarts the machine; S5 to a local commit, no push, no Codex; state written; then 'JH 207 closed at <commit>'.
- L22 2026-11-16, JH 207 reopened after the restart; main b3a73245 merged (604bdc74, guard and session-title only). S5's reviews: Codex on e828ba1..5fd3e49: incorrect, 0.96, 364,731 input tokens (300,288 cached), one P2: a range with nothing to review was checked with a two-point diff, so a record whose base had moved past the fork point (codex-review reads from the merge base) was refused. Lenses reliability and risk: risk 0; reliability 1 WARNING: admission asked git of every nothing-to-review record ever written. Both taken, tests first (codex-review-coverage.test.mjs, "C-3: ..." x2, red before): the diff is `base...head`, and `reviewCoverage` asks admission only of such a record whose head the range holds (one outside covers nothing anyway, `onlyWhole`). Coverage 33 of 33.
- L23 2026-11-16, S6 (B2-2) design, with the advisor: lens findings live in the record (`results[].findings`), a lens `recheckOf` is a run id, and a recheck's counts are only printed, so the gate recomputes them with `classifyRecheck` per lens; Codex's `recheckState` is not reused. Every admitted reviewed lens record in the covers that is no recheck owes its BLOCKER/CRITICAL findings until an admitted reviewed record whose `recheckOf` is its run, with that lens picked, marks them fixed; a recheck that leaves them open warns and passes (the Codex precedent of 2026-10-15). The debt sits in `lensCoverage`'s state, so the push row, the door and `check` read it, and its step names `lens-review --base <owing head>` ahead of any uncovered commit (a document commit before the fix would otherwise make the run a fresh review). `lens-review`'s own lookup of the earlier record reads admitted records only. Old-vs-new over open branches before the commit; any branch newly refused stops for the lead.
- L24 2026-11-16, S5 fix reviewed: Codex recheck 604bdc7..49b9138: correct, 0.97, 94,180 input tokens, 1 of 1 fixed. Lenses: risk 0; reliability 1 WARNING (no test that a forged nothing-to-review record with its head past the tip covers nothing): taken, a C-3 test in codex-review-coverage.test.mjs, green (the code already drops it, `outside && onlyWhole`). S6 (B2-2) built, tests first: five in lens-review-rows.test.mjs (4 of 5 red before: CRITICAL refuses push, door and says it in `review`; WARNING owes nothing; a fresh review past a document does not pay, the recheck of that run does; a recheck that leaves it open warns; a recheck by another lens or with no run line pays nothing) and one in lens-review.test.mjs (red before: a hand-written record at the base makes no recheck). `lensCorrections` in lens-review-rows.mjs, in `lensCoverage`'s state; `lens-review` reads the earlier record through `admittedLensReviews`. Suites: lens-review-rows 28/28, lens-review 24/24, coverage 33/33 before the third C-3 test, which passes alone (3 of 3 C-3). Old-vs-new (s6count.mjs, read-only, the real records): 586 admitted lens records, 3 of them reviewed with a BLOCKER or CRITICAL and no recheck; of 47 open branch tips none is newly refused.
- L25 2026-11-16, S7 (G-2), test first: "G-2: the one line carries the Codex review debt beside the lens one" in check-quiet.test.mjs, red before; `passLine` now adds `; codex-review: <its detail>` after the lens `review`. One test changed in meaning: the one-line PASS of a folder with no repository now carries "codex-review: cannot tell ..." before its sensors part. Searched for readers of the PASS line outside tests: none (README.md:131 updated to name both rows). check-quiet 7/7. First commit refused by conventions-structure (check.mjs, over 1,000 lines, may not grow): the change is now net zero lines.
- L26 2026-11-16, S6's reviews. Codex on 49b9138..7030550: incorrect, 0.98, 178,966 input tokens, three findings, all taken: (P1) a recheck record was exempt whole, though a lens with nothing earlier reviewed afresh; (P2) two reviews ending at one head could not both be paid, `lens-review` rechecked the last alone; (P2) a new `[blocks]` finding of a recheck was dropped. Lenses: reliability 1 WARNING (an incomplete answer paid the debt; moot, since a record with an incomplete lens is no evidence and is in no coverage, yet the paying answer is now asked to be complete), risk 1 WARNING (a recheck of WARNINGs that finds a CRITICAL owed nothing: the P1 by another door). The fix reads each lens alone: a lens is a round of correction only when what it rechecked held a BLOCKER or CRITICAL; else its own BLOCKER and CRITICAL findings are owed until a recheck by that lens names its run. `lens-review` now rechecks, per lens, the findings of every admitted record of that lens at the base, oldest first, and writes `rechecked: {lens: [runs]}` beside `recheckOf` (an optional field; records written before it are read through `recheckOf`). Tests first: four in lens-review-rows.test.mjs and one in lens-review.test.mjs, red before (the last checked against HEAD's lens-review.mjs). Suites: lens-review-rows 32/32, lens-review 25/25. Old-vs-new again: 0 of 46 open tips newly refused.
- L27 2026-11-16, the two open answers. B2-1 at the merge door: `reviewEvidence` (merge-queue-reviews.mjs) reads the Codex review through `checkCodexReviews`, which S4 made ask each code commit by its own tree's switch, so the door refuses as the push does; the `off` read at the tip only words the informing lines. Proved by "B2-1: the door refuses a pull request that turns the Codex review off after a code commit made with it on" (merge-queue-reviews.test.mjs): red with a61d8627^'s codex-review-rows.mjs, green now. The guard-bypass half of C-3: a session that writes a record and a run line both is not refused by the records (lens-reviews.mjs and codex-review-coverage.mjs say so); what stands in its way is `guard` refusing a file tool or a shell write to those files (`reviewRecordOf`), and its denylist rewrite is C-38, out of scope here. After S5 a forged record needs a forged run line of the same run and range as well, so the hole is narrower, not closed. Review order: S7 (1dded110) sits between S6 and its fix, so a review from 7030550 would read it as a recheck's follow-up; S7 is reviewed alone from a temporary detached worktree at 1dded110, and the fix from 1dded110.
- L28 2026-11-16, a mistake, told in five parts. What happened: S7 was reviewed alone from 7030550, the head of S6's review with three findings; codex-review read that range as their first recheck (its base at that head), recorded 0 of 3 fixed (60,983 input tokens), and the lenses the same of their WARNING, so the fix 8f04c126 is now reviewed from 1dded110 as the second recheck, the last of three reviews: anything it leaves open goes to the escalation (`openAfterRecheck`). The S7 code itself was read (Codex named nothing in it; readability 0). The fix now: the second recheck runs after this commit; checked when it returns. What stops it: I ran that review without its --plan, which says when a range is a recheck; every codex-review runs after its --plan (docs/FAILURES.md, review-slice-read-as-recheck). Where: this session, from now. Proof: each later codex-review line of this session follows a --plan. The fix review first failed on a dirty tree (this commit's files), which is why it waits for this commit. The temporary worktree D:/js-harness-worktrees/review-gate-s7 is removed.
- L29 2026-11-16, S6's fix reviewed. Codex on 1dded11..0fffa12, the second recheck, the last of three reviews: correct, 0.9, 87,769 input tokens, 3 of 3 fixed. Lenses reliability and risk: 0 findings each (reliability's earlier WARNING rechecked fixed). Spent on Codex this session: 364,731 + 94,180 + 178,966 + 60,983 + 87,769 = 786,629 input tokens over five runs.
- L30 2026-11-16, the opus verifier on e455d9f8 (T9), read-only, probes outside the repo: findings. F1 CRITICAL, run: a run line of a run that did not review (failed, timed-out, not-inspected) carries base, from and head (codex-review.mjs:1904-1912), and `admittedCodexReviews` never asks its outcome (codex-review-coverage.mjs:344), so a hand-written reviewed record naming it passes `check --push`; C-3 is not closed. F2 CRITICAL, run: `correctionOwed` reads every Codex record unfiltered (codex-review-rows.mjs:130) into `recheckState`, so a bare record at the owing head, with no run line, makes the debt read as a review, and a bare `recheckOf` record turns it into a warning; `recheckAt` in the run reads them the same way (codex-review-turns.mjs:82, :350; codex-review.mjs:1262); line 130 predates this branch, but the goal is one evidence rule. F3 WARNING, run: a commit that turns the Codex review off at the tip drops an owed correction (codex-review-rows.mjs:211-217), and the lens push row returns before `correctionRefusal` (lens-review-rows.mjs:277); the lens door does not. Clean by reading: parts served from an earlier run keep their range; a record whose runs hold a null is refused; the lens side.

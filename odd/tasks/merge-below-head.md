# A merge of main below HEAD is reviewed by what was written in it

Locator: `odd/tasks/merge-below-head.md` · Engram mirror: `odd/merge-below-head/tasks` · Branch:
`feat/merge-below-head` · Delivery: `ask-on-risk` · Runner: `node --test` · First version: T6d of
`odd/tasks/first-version.md`, closing `merge-review-covers-main` in `docs/FAILURES.md`. Version 2,
after two readers (Log).

## Goal

`js-harness codex-review` reviews a merge of the default branch that somebody wrote in, and that has
commits after it, by the lines written in it, as it already does for such a merge at HEAD.

## Why

His answer of 2026-10-16 (question tool in the lead's chat, `e152c9d8-53bc-4366-8fa5-526b1576bcb6` line
15496, 21:41:25Z, quoted by `js-harness sessions --quote`): asked "¿Revisamos solo las líneas que se
escribieron en el merge?", he tapped "Solo lo escrito (Recomendada)". Today only a merge at HEAD is read
that way (`mergeStart`, `bin/lib/codex-review-coverage.mjs:431`). Below HEAD the run reviews the net diff
from the merge's first parent, which holds everything `main` brought: 1,724 lines for nine resolved,
1,405 lines and about 1,030,000 input tokens for one, and a planned 1,974 lines for 18 written (FAILURES,
`merge-review-covers-main`). The third sighting is this feature's case exactly: a merge below HEAD whose
commits before it had their records, so the push row's hint was `--base <merge>^`. The workaround, a
detached worktree at the merge, works because there the merge is HEAD; the command now takes that step.

## Done when

- `node --test bin/codex-review.test.mjs` exits 0
- `node --test bin/lib/codex-review-coverage.test.mjs` exits 0
- `node --test bin/check-codex-reviews.test.mjs` exits 0
- `npm run check` exits 0
- `node bin/js-harness.mjs failures check --settled` names no `merge-review-covers-main`
- In a scratch repository, a branch `c1 M c2` (c1 with its record, M a merge of `main` with one
  resolved line, c2 a commit after it), `codex-review --plan --base <before c1>` plans two turns, the
  merge's of the resolved file alone; a run with Codex faked writes two records, `c1..M` with
  `diff: 'remerge'` and `M..c2`; the debt row sizes the same as the plan; no worktree is left.

## In scope / Out of scope

- In: `bin/codex-review.mjs`, `bin/lib/codex-review-coverage.mjs`, `bin/check.mjs` (the debt row's
  size), the worktree helper shared with `bin/merge-queue.mjs`, their tests, the README section of
  `codex-review`, `docs/SPEC.md`'s Codex review row, `docs/FAILURES.md`, T6d in
  `odd/tasks/first-version.md`.
- Out, each reviewed as today (the net diff of the range), and said in the plan:
  - a merge whose commits before it are not all covered (the three-turn case): reviewing them below HEAD
    brings findings that cannot be rechecked (readers' B1), and no sighting had it;
  - a second qualifying merge after the cut one: one cut per run, the oldest;
  - a merge whose written files are marked differently at the merge and at HEAD (reader A's B2);
  - merges of anything but the default branch, and octopus merges.
- Out: what a record covers (`coveredBy`, `reviewCoverage`), the prompt's text and versions, the
  recheck rules.

## Constraints

- Never weaker — because his answer narrows only what a merge's review reads: every other code commit
  is reviewed as before, with the files of HEAD around it, and what `main` brought keeps the review it
  had where it was made (`mergeStart`'s rule that the second parent is on the default branch).
- No cost at a commit that owes nothing — because the debt row runs at every commit: it sizes the turns
  with no worktree, and asks nothing new of a range with no uncovered merge of `main` below HEAD.
- Nothing left behind — because AGENTS.md says what the harness writes outside the change is undone
  exactly: the turn's worktree is under the common git dir, removed when the turn ends, and one left by a
  killed run is removed by the next.

## Ask me before

Nothing: his answer decided what is reviewed. A turn costs a checkout (about 3 s to add and 1 s to
remove here, reader B) and a Codex session's fixed input (about 49,000 tokens a part), against what
`main` brought.

## Specs

- S1 (L1) A range is cut into two turns when its oldest uncovered code commit is a merge M below HEAD
  that `mergeStart` reads as a merge at HEAD when asked of M instead of HEAD (two parents, the second on
  the default branch, every code commit before it covered, no record of M, code by what was written in
  it, an automatic merge git can write), and also: no record covering M's first parent owes a correction
  (`owesCorrection`), and the files written in M are left out alike by the marks at M and at HEAD. The
  turns: M, reviewed from its first parent by what was written in it; then `M..HEAD`, reviewed as
  today. Any other range is reviewed as today.
- S2 `mergeStart` takes the merge to ask of (`tip`, HEAD by default): the cut asks it of M, from the
  parent, so the plan and the debt row see the turn before anything is reviewed.
- S3 The turn at M runs in process (`codexReviewMain` with `--cwd <worktree at M>`, the deps it was
  given) and must take the merge path: a turn at M that `mergeStart` does not read as a merge at HEAD
  refuses (exit 1, nothing launched) instead of reviewing what `main` brought. The parent passes it
  resolved values only: `--base` as M's first parent's full id, `--home` absolute, the intent already
  read instead of `--doc`, no `--cwd` of its own.
- S4 No turns under `--again` (it reviews the range as given), `--unavailable` (a skip names the range
  as given), or `--plan` of a range that is not cut.
- S5 Both turns are planned before either launches: the parts bound (`--max-parts`) and the allowance
  apply to their sum, and a refusal of either (bound, switch off, recheck) launches nothing. `--plan`
  prints both under a line each ("turn 1 of 2, the merge <M7>: what was written in it" / "turn 2 of 2,
  <M7>..<HEAD7>") and one estimate of their sum. The debt row sizes the same two turns from the same
  function, and the row and the plan give the same size.
- S6 The turn at HEAD runs only when the turn at M ended with a record that owes no correction; when it
  owes one, the run stops after it and says that the commits after the merge are reviewed once the
  correction is made. Before the turn at HEAD the tree is checked unchanged again, and the run log is
  read again.
- S7 The worktree is `<common git dir>/js-harness/review-turn-<pid>-<time>`, added with `git worktree
  add --detach`, removed with `git worktree remove --force` when the turn ends, success or not, by the
  helper `bin/merge-queue.mjs` uses (extracted, so both make and remove them alike). A run first removes
  every `review-turn-` worktree whose process is gone, and prunes.
- S8 `baseLeftOutSaid`'s merged line (a run from `--base <M>`) names `--base <M>^`, which now reviews it
  in two turns; the FAILURES control names the test of S1.
- S9 (Log, T3 finding) A range is cut only when the two turns cost less than the one review the run
  would be without the cut: each counted as its parts times 100 changed lines plus its changed lines
  (a part's fixed input, about 49,000 tokens, over about 482 a changed line), a tie being no cut. A
  constant, not this machine's estimator, so the plan and the debt row decide alike on every machine.
  `--plan` of a cut range ends with what the turns come to in all and what the one review would be.

## Design

**Why the turn at M is a run of the command itself.** Everything that makes a review of a merge right
already exists and is tested at HEAD: `mergeStart`'s conditions, the automatic tree, the merge prompt,
the record with `diff: 'remerge'`, the marks of the head. Below HEAD a review needs one more thing,
that Codex reads the files of that commit: it runs with its working directory at the checked-out tree
and is told to read around the diff. A detached worktree at M gives both with no new path through the
review body, which ties `head` to HEAD in a dozen places (the map in the Log). It runs in process
because the tests fake Codex through injected deps, which a child process cannot take (reader B's B2).

**Why only that cut.** Each case left out costs soundness or a new rule. Commits before M with no record
would be reviewed below HEAD, and a finding there is fixed by a commit after M, past a merge review
that is never a recheck (`bin/codex-review.mjs:1450`): it could not be rechecked (reader A's B1). A
record before M that owes a correction would see its recheck land on M's record. Marks that differ
between M and HEAD would leave lines of a file out of both turns while the push counts them (reader A's
B2). The case that is cut is the third sighting, and the one the push row's hint leads to.

**The findings.** A turn at M that owes a correction stops the run before the turn at HEAD: the next run
is then from M's record, a recheck of its findings over the commits after it, as a review at HEAD that
owes a correction is today.

**What is left as it is.** Coverage: each turn's record is `base..head` like any record. The push row's
hint, `--base <oldest uncovered>^`, is now right for this case. `onlyWhole` and the rules for records
past the tip.

**The cost.** Two Codex sessions instead of one: about 49,000 fixed input tokens more, a win once `main`
brought more than about 200 lines. The debt row asks, beyond today, only when the oldest uncovered
commit is a merge of two parents below HEAD: what `mergeStart` asks (one `merge-tree --write-tree`
among them), and the marks at M of its written files.

## Tasks

- [x] T1 (kind: design) This design, read by two readers who did not write it; route: inline, readers
  delegated (Opus). Version 1 21f065e, version 2 this one.
- [x] T2 (kind: build) S1, S2, S5 (sizes): the cut, `mergeStart` asked of a merge below HEAD, the sizes
  of the turns for `--plan` and the debt row; route: inline. 19935ab.
- [x] T3 (kind: build) S3-S9: the run in turns, the worktree helper, the stop on a correction, the
  merged line, the cost rule; route: inline. The T3 commit (Log).
- [x] T4 (kind: verify) The "Done when" scratch repository; an independent verifier (risk item 2, the
  push guard's coverage), gentle-ai escalated, Codex.

## Log

- L1, 2026-10-16, the lead's notice to 27 (the lead's claim, read in the channel; his answer behind it
  checked with `sessions --quote`, above): "his answer to T6d (question tool, lead chat): 'Solo lo escrito
  (Recomendada)': a hand-resolved merge of main is reviewed only on the lines written in the merge; what
  main brings keeps its own review. Build first-version T6d (merge-review-covers-main,
  codex-review-coverage.mjs:207-215): design with two readers (push guard, high risk), test first, settle
  the FAILURES entry. Tell me the PR."
- 2026-10-16, the map (an Opus explorer, read-only), worktree line numbers: `codexReviewMain` fixes the
  head to HEAD (`bin/codex-review.mjs:1206`); `startingAt` (1318) calls `mergeStart` only for HEAD; a merge
  is reviewed by `rangeDiff` from the automatic tree (1458, coverage 390) with the merge prompt (988) and
  recorded with `diff: 'remerge'` (2067), which nothing reads; Codex runs with its cwd at the checkout
  (1696); `baseLeftOutSaid`'s merged line (1031-1034) shows only for `--base <merge>`, and `--base
  <merge>^` silently reviews everything `main` brought; `codexReviewDebt` (check 2279-2285) calls
  `mergeStart` with the tip alone; the test "the row and the plan size the same review" is at 5639; the
  fixture `makeResolvedMergeRepo` at 5358.
- 2026-10-16, version 1 (21f065e, three turns per merge, each below HEAD a child process) read by two
  Opus readers. What changed in version 2:
  - Reader A, B1: a review that says incorrect exits 0 with a `reviewed` record, so "stop at the first
    turn that does not exit 0" never stopped on a finding; findings of a turn below the merge could not
    be rechecked, and a turn after a merge with findings became a recheck of new work. Version 2 cuts
    only where every commit before M is covered and none owes a correction, and stops after M when M
    owes one (S1, S6).
  - Reader A, B2: marks read at a turn's commit and at HEAD can differ, so a file's lines fell out of
    every diff while the push counted them. Version 2 cuts only when M's written files are marked alike
    at M and at HEAD (S1).
  - Reader B, B1: `mergeStart` needs every commit before M covered, so the plan could not see a three-turn
    run; version 2 has no such run, and asks `mergeStart` of M from the parent (S2).
  - Reader B, B2: a child process cannot take the tests' injected deps; the turn runs in process (S3).
  - Both, options: `--again` skips `mergeStart`; `--doc`, a relative `--base` or `--home`, and `--cwd`
    resolve wrongly in the worktree; `--unavailable` must not cut. Version 2 resolves them in the parent
    and has no turns under `--again` or `--unavailable` (S3, S4).
  - Both, bounds: the parts bound and the allowance were per turn; version 2 applies them to the sum and
    plans both turns before either launches (S5); the tree check and the run log are read again before
    the turn at HEAD (S6).
  - Reader B, G4: the merge queue already makes and removes worktrees under the common git dir
    (`bin/merge-queue.mjs:336-376`); version 2 shares that helper (S7). S6 of version 1 named `--base <M>`
    inside the range; version 2's S8 names `--base <M>^`.
  - Reader B measured a turn's checkout: 627 tracked files, about 3 s to add and 1 s to remove, no
    post-checkout hook, LFS or submodule; a worktree under `.git` resolves its own top and the shared
    common dir (reader A, tested).
- 2026-10-16, T2 (S1): `mergeTurn` in `bin/lib/codex-review-turns.mjs` (19935ab); RED was the missing module, GREEN 5 of 5. Deviation to record: S7's helper is new in `bin/lib`; the merge queue keeps its own worktree code (changing it is outside this change's risk).

- 2026-10-16, T3 (S3-S9), JH 27. The finding below settled as S9, inline: a technical rule inside the
  frozen scope, since his answer decided what is reviewed and this decides only when a second session
  pays. RED: the two-turn plan test printed one plan of 304 lines from `main`; GREEN after the cut. Built:
  `cutInTurns` in `startingAt` (the coverage `leftByRecords` read, now returned), `firstTurn` (the bound on
  both turns, the worktree, the in-process turn with `mergeTurnOnly` and `turnIntent`, the stop on an
  owed correction, the tree checked again), `turnsLines` and `plansAsOne` for `--plan`, the debt row's
  sum, and the merged line naming `--base <M>^`. Deviations: the plan of the turn at M is made in the
  parent from `rangeGroups` at M, with no recursion and no worktree, since a plan reads git alone; the
  parts bound and refusal tests were written after their code, and pin it (they would have launched the
  merge's turn without the check). A finding while testing S8: from `--base <M>^` the range holds main's
  commits too, so the cut needs them covered by their own records, as they are in this repo where PRs
  land as merges; the fixture gives main's commit its record. Not built: a test that the run log is read
  again before turn 2 (it is reset in code), and a refusal of the turn at HEAD for a switch that is off
  at M.

- 2026-10-16, T4, the independent verifier (Opus, high, read-only; scratch under the system temp dir).
  S1 partial, S7 partial (the helper is not shared with the merge queue, as the Log already says), the rest
  pass; no way found for a code commit to be covered with no turn's diff showing its lines. Blocker B1:
  `mergeTurn` asked `recheckState` at the first parent itself, not past document commits as `recheckFor`
  does through `recheckAnchor`, so a docs commit between a review that owes a correction and the merge let
  the cut drop the recheck the baseline ran. Fixed: `mergeTurn` anchors as a run does; RED then GREEN in
  `bin/lib/codex-review-turns.test.mjs` ("after a document commit"). Advisories left: a turn whose run line
  failed to reach the log reads as owing nothing (as any review does today); the worktree is made before the
  turn finds Codex missing; a switch off at M says "wrote no record" without why.

- 2026-10-16, the merge of `origin/main` (f0c235e). Main had closed T6d as "overtaken by `723af7c`, no design
  left" (first-version L22); `723af7c` is in this branch's base and names the worktree to run by hand, and
  this feature runs that turn itself, as his answer "Solo lo escrito" asks. The task line keeps both.

- 2026-10-16, the Codex review of 9ecfc6e..f0c235e, two P2 findings, both fixed test first. (1) A merge that
  has the review off was still cut into a turn of its own, which records nothing, so the run failed with
  "wrote no record" where one review would have run: `cutInTurns` and the debt row now read the switch at
  the merge and keep one review (this also settles the verifier's last advisory). (2) `plansAsOne` added
  the kinds of `leftOut`, which are counts of their own, as numbers: it now adds them by field.

- 2026-10-17, JH 21, on the lead's triage of open work: T4 checked off. Pull request 338 merged as 45fcad2b,
  with the verifier above, gentle-ai review-4f9d361eb6afc479 (high, item 2) and Codex's recheck in its body.
  The scratch repository of "Done when" is the fixture of `bin/codex-review.test.mjs`, "a merge of main below
  HEAD, after commits that each have a record, is planned in two turns…" and "a merge of main below HEAD is
  reviewed in two turns…: a record each, and no worktree is left". `failures check --settled` names no
  `merge-review-covers-main` (0 lines, 2026-10-17).

## Next step

**State for a resume (2026-10-16, JH 27, near 88% of context):** B1 fixed in d81494c (gate green). The gentle-ai review of 64933f6..d81494c, lineage review-4f9d361eb6afc479, lenses risk/resilience/reliability, is APPROVED and acknowledged (authority burned). It left 6 informational advisories: R3-first-turn-before-second-turn-refusals, R3-rmsync-throws-in-finally, R3-run-log-read-without-where, R3-untested-turn-failure-paths, R4-pid-reuse-stale-worktree, R4-unguarded-worktree-rm. The rmSync guard (removeTurnWorktree never throws, with a test) is written and NOT committed yet; the other five go as follow-ups in the PR body. Next: commit the rm guard (gate), `git merge origin/main` (merge-tree says it is clean), `js-harness codex-review --base origin/main`, then push, open the PR with its gentle-ai line ("gentle-ai: approved, review-4f9d361eb6afc479, high via item 2"), notify the lead "JH 27: PR <n> ready to land (T6d merge-below-head)" with the S9 finding, and re-arm `js-harness wait --notice-to 27 --every 60`.

**State, 2026-10-16, JH 27:** T1-T3 done, T4's verifier done and B1 fixed. Next: T4, the "Done when" scratch repository, the gate (the two
`--no-verify` commits 5bf351e and 6397e5a go through it with the T3 commit), an independent verifier (risk
item 2), gentle-ai assess with `--escalate-item 2` (run `granted`), Codex, merge-tree against origin/main,
push, the PR with its gentle-ai line, and the notice to the lead with the S9 finding.

**Finding while writing T3's first test (2026-10-16, JH 27), settled as S9:** from `--base origin/main` the range starts at the main commit the merge brought (`merge-base`), so today's net diff already holds no line `main` brought; in `makeResolvedMergeRepo` plus a commit after, today plans 4 changed lines in one part, and two turns plan 6 + 2 lines in two sessions (one more fixed cost, about 49,000 input tokens, reader B). The cut pays only when today's diff is larger: from `--base <M>^` (the push row's hint, `<oldest uncovered>^`), or when the branch's covered work since the merged main is large. Proposed S9: cut only when the two turns cost less than the review that is left by today's rule, compared by the estimator of the run log when it has measured parts (fixed cost per extra session plus per changed line), else by changed lines with one session's fixed cost taken as 100 changed lines (49,000 / 482, reader B's fit); the test above then needs a fixture whose covered branch work is larger than the turns, and a second test that a small one is not cut. The red test is in `bin/codex-review.test.mjs` (second half: run it as `node --test --test-name-pattern="planned in two turns" bin/codex-review.second.test.mjs`).

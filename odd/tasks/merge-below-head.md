# A merge of main below HEAD is reviewed by what was written in it

Locator: `odd/tasks/merge-below-head.md` · Engram mirror: `odd/merge-below-head/tasks` · Branch:
`feat/merge-below-head` · Delivery: `ask-on-risk` · Runner: `node --test` · First version: T6d of
`odd/tasks/first-version.md`, closing `merge-review-covers-main` in `docs/FAILURES.md`.

## Goal

`js-harness codex-review` reviews a merge of the default branch that somebody wrote in by the lines
written in it, wherever it sits in the range, and not only at HEAD.

## Why

His answer of 2026-10-16 (question tool in the lead's chat, `e152c9d8-53bc-4366-8fa5-526b1576bcb6` line
15496, 21:41:25Z, quoted by `js-harness sessions --quote`): asked "¿Revisamos solo las líneas que se
escribieron en el merge?", he tapped "Solo lo escrito (Recomendada)". Today only a merge at HEAD is read
that way (`mergeStart`, `bin/lib/codex-review-coverage.mjs:431`). Below HEAD the run reviews the net diff
of the range, which holds everything `main` brought: 1,724 lines for nine resolved, 1,405 lines and about
1,030,000 input tokens for one, and a planned 1,974 lines for 18 written (FAILURES,
`merge-review-covers-main`). The workaround, a detached worktree at the merge, works because there the
merge is HEAD; this feature makes the command take that step itself.

## Done when

- `node --test bin/codex-review.test.mjs` exits 0
- `node --test bin/lib/codex-review-coverage.test.mjs` exits 0
- `node --test bin/check-codex-reviews.test.mjs` exits 0
- `npm run check` exits 0
- `node bin/js-harness.mjs failures check --settled` names no `merge-review-covers-main`
- In a scratch repository, a branch `c1 M c2` (M a merge of `main` with one resolved line) planned
  with `codex-review --plan --base <before c1>` plans three turns, the merge's of the resolved file
  alone, and the debt row sizes the same.

## In scope / Out of scope

- In: `bin/codex-review.mjs`, `bin/lib/codex-review-coverage.mjs`, `bin/check.mjs` (the debt row's
  size), their tests, the README section of `codex-review`, `docs/FAILURES.md`, `docs/SPEC.md`'s row of
  the Codex review, T6d in `odd/tasks/first-version.md`.
- Out: what a record covers and how coverage reads it (`coveredBy`, `reviewCoverage`): records of turns
  are ordinary records. The prompt's text and versions. Merges of anything but the default branch, and
  octopus merges: they are reviewed as today, by the range's diff.

## Constraints

- Never weaker — because his answer narrows what a merge's review reads, and nothing else: every code
  commit of the range is still reviewed, each with the files of its own tree to read around it; what
  `main` brought keeps the review it had where it was made (`mergeStart`'s rule that the second parent
  is on the default branch).
- No cost at a commit that owes nothing — because the debt row runs at every commit: it sizes the turns
  with no worktree, and a range with no merge of `main` below HEAD pays nothing new.
- Nothing left behind — because AGENTS.md says what the harness writes outside the change is undone
  exactly: a turn's worktree is under the common git dir, removed when its turn ends, and one left by a
  killed run is removed by the next.

## Ask me before

Nothing: his answer decided what is reviewed; the cost of a turn is a checkout, measured in the Log.

## Specs

- S1 (L1) Where the uncovered commits of a range hold a merge M below HEAD that `mergeStart` would read
  as a merge at HEAD (two parents, the second on the default branch, code by what was written in it, no
  record of it, an automatic merge git can write), the review runs in turns that end, oldest first, at
  M's first parent when commits before M are uncovered, at M, and at HEAD. Each merge of the range that
  qualifies cuts the same way.
- S2 A turn below HEAD is the same command, `codex-review --base <the given base>` with the options it
  was given, run by the parent's own script in a detached worktree at the turn's end, so its marks, its
  prompt and the files Codex reads are those of that commit; it writes its own record. At M the run is
  read as a merge at HEAD (`mergeStart`), so its review is of the lines written in M.
- S3 The turns stop at the first that does not exit 0, and the command exits with its status; the records
  written by the turns before it stand. A turn with nothing uncovered when it comes is skipped.
- S4 `--plan` plans every turn, each said under a line naming it ("turn 2 of 3, the merge <M7>"), and the
  estimate sums them. The debt row of `check` sizes the same turns, from the same function, with no
  worktree; the row and the plan give the same size (the rule of `bin/codex-review.test.mjs`'s "the row
  and the plan size the same review").
- S5 A turn's worktree is `<common git dir>/js-harness/turns/<pid>-<n>`, added with `git worktree add
  --detach`, removed with `git worktree remove --force` when its turn ends, success or not; a run first
  removes every worktree under that folder whose process is gone, and prunes.
- S6 The line that sends the user to a worktree at the merge (`baseLeftOutSaid`, `merged`) is replaced:
  a run from `--base <M>` is cut into turns like any other, and the FAILURES control names the new test.

## Design

**Why turns run the command itself.** Everything that makes a review of a merge right already exists
and is tested at HEAD: `mergeStart`'s conditions, the automatic tree, the merge prompt, the record with
`diff: 'remerge'`, the marks of the head. A review below HEAD needs one more thing, that Codex reads the
files of that commit: it runs with its working directory at the checked-out tree and is told to read
around the diff. A detached worktree at the turn's end gives both with no new path through the review
body (1440-2080), which ties `head` to HEAD in a dozen places (the map in the Log). The parent's own
script runs in it, not the worktree's copy: that copy is of an older commit.

**Why a turn ends at M's first parent.** `mergeStart` covers a merge only when every code commit before
it has a record (`given !== first` at `bin/lib/codex-review-coverage.mjs:438`), so the commits before M
are reviewed first, at their own tip, as they would have been before the merge.

**What is left as it is.** Coverage: a turn's record is `base..head` like any record, and the push check
reads it so. The push row's hint: `--base <oldest uncovered>^` stays right, since the command now cuts
the range it names. A recheck: a correction is a commit at HEAD, and the next run is from its record as
today.

**The cost.** A turn below HEAD costs one `git worktree add` and one remove (a checkout of this
repository; measured in T4), against a review of everything `main` brought. The debt row asks, beyond
today, only when an uncovered merge is in the range: one `rev-list --parents` of the range's first-parent
merges, and per qualifying merge what `mergeStart` already asks.

## Tasks

- [ ] T1 (kind: design) This design, read by two readers who did not write it; route: inline, readers
  delegated (Opus).
- [ ] T2 (kind: build) S1, S4: the turns of a range, one function in `codex-review-coverage.mjs` used by
  the command, `--plan` and the debt row; route: inline.
- [ ] T3 (kind: build) S2, S3, S5, S6: the run in turns, their worktrees, the merged line replaced; route:
  inline.
- [ ] T4 (kind: verify) The "Done when" scratch repository; a turn's checkout timed; an independent
  verifier (risk item 2, the push guard's coverage), gentle-ai escalated, Codex.

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

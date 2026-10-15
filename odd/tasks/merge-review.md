The Codex review of a merge of main that resolved a conflict reads only what was written in the merge.
Branch: feat/merge-review. Delivery: ask-on-risk. Tests: `node --test` (the gate runs them in WSL2).

## Goal
`js-harness codex-review` of a range that is exactly one merge of main reviews the merge's remerge-diff
(the resolution of its conflicts and any edit made in it), not everything main brought into the branch.

## Why
After a merge of main that resolved a conflict, the push check counts the merge as a code commit by the
files written in it (`writtenInMerge`, bin/lib/codex-review-coverage.mjs), and hints
`codex-review --base <merge>^`. That review reads `git diff <merge>^1 <merge>`: every change of main since
the fork, code main already had reviewed. Pull request 124 paid 175,025 input tokens for it.

## Done when
- `node --test bin/codex-review.test.mjs bin/codex-review.second.test.mjs bin/lib/codex-review-prompt.test.mjs bin/check.test.mjs` exits 0
- `npm run check` exits 0
- `js-harness codex-review --plan --base <merge>^` at a merge of main that resolved one file names that file alone

## In scope / Out of scope
- In: bin/codex-review.mjs, bin/lib/codex-review-prompt.mjs, bin/lib/codex-review-*.mjs helpers, bin/check.mjs `reviewSize`, their tests, this document.
- Out: the coverage rule of a record (`coveredBy`), because the guard of S3 makes it hold as it is; a range with commits after the merge, which is reviewed whole as today (see the Log, L3).

## Constraints
- Every place that computes the reviewed diff changes together (`rangeGroups`, the expected patch, `planParts`, the prompt's `scope()`, `check.mjs` `reviewSize`) — because the plan, the evidence rule and the push check's debt row must agree on one diff.
- Codex's own `--base` mode cannot read a remerge-diff — so a merge review uses this command's own prompt, as a range with left-out files already does.

## Effort
high

## Ask me before
- Nothing beyond the repository's rules: no spend outside the Codex allowance.

## Specs
- S1. The orchestrator's order (cross-session message, 2026-10-14): "Next after T3: a resolved merge's Codex review covers the conflicted hunks only, not the whole branch again (124 paid 175,025 tokens for that). Put it in your queue, test first."
- S2. Merge mode (`mergeStart`, bin/lib/codex-review-coverage.mjs) holds when all of these hold: `HEAD` has exactly two parents, its second parent is an ancestor of origin's default branch, every code commit from the start of the range to its first parent has a record, and neither `--again` nor `--every-file` is given. Then the review starts at the first parent, whatever `--base` gave (origin/main, or `<merge>^`), and the diff it reads, sizes and checks is `git show --remerge-diff --format= --no-renames <HEAD>` (with pathspecs per part); the prompt is this command's own and names that command (`js-harness.codex-review-merge-prompt/v1`); a line says so before the plan; the run line and the record carry `diff: "remerge"`; and it is no recheck (see L5).
- S3. The guard on the second parent is what keeps `coveredBy` honest: a record of `M^1..M` covers every commit reachable only from `M^2`, which are commits of the default branch only when `M^2` is its ancestor. A merge of anything else is reviewed whole, as today.
- S4. A merge of main that the push check does not count as a code commit (clean, or a conflict resolved by taking one side whole) takes no merge mode: the records cover the range and no Codex run starts, as before (B1, L9).
- S5. The push check's debt row sizes the merge as the review will (`reviewSize`), so the row and `--plan` agree.
- S6. The help of `codex-review` and its header say what a merge review reads.
- S7. The orchestrator's rule from JH 5 (cross-session message, 2026-10-14): "before merging main into a branch, `git merge-tree --write-tree HEAD origin/main`; on a conflict, move the branch's own change in a small commit (its own small Codex review) so the merge itself is clean, instead of resolving in the merge ... Make it a check the tool says before a merge of main (merge-ready or the pre-push), next to your conflict-hunk review, which stays the fix when moving is not possible." With S2 in place a resolved merge costs its remerge-diff (L7: about 24,000 input tokens for JH 12's case), so the check is advice printed where a merge of main is about to happen, not a refusal.

## Tasks
- [x] T1 (S2, S4): the diff of a merge range, through `rangeGroups`, `planParts`, the expected patch, the prompt and the record. Route: inline. RED: the three tests of `makeResolvedMergeRepo` (bin/codex-review.test.mjs) failed on the missing export, then on the plan reading 2 files; GREEN 3 of 3.
- [x] T2 (S5): `check.mjs` `checkCodexReviewDebt` and `reviewSize` size a merge range the same way. Route: inline. RED: the third case of "the row of the plain check and the plan of the command size the same review" failed; GREEN.
- [ ] T4 (S7): before a merge of main, say whether it would conflict and how to keep the merge clean. Route: inline. Queued after the merge queue.
- [x] T3 (S6): the usage of `codex-review` and the headers of `mergeStart` and the prompt. Route: inline. The pinned usage line of the test moved with it.

## Log
- L1. 2026-10-14, the order: S1, verbatim.
- L2. 2026-10-14 15:02, the premise checked on git 2.54.0.windows.1 in a scratch repository: a merge of main resolving a conflict in `m.txt`, while main also changed `s.txt` and added `n.txt`. `git show -z --remerge-diff --format= --no-renames --numstat HEAD` gives `1 5 m.txt` alone; `git diff --numstat HEAD^1 HEAD` gives all three files. Pathspecs and `--submodule=short` are accepted; the patch carries a `remerge CONFLICT (content)` line after `diff --git` and the conflict markers as removed lines.
- L3. 2026-10-14, out of scope for now: a range whose merge is followed by more commits. Its review stays whole; the way to pay only the resolution is to review right at the merge, before the next commit.
- L4. 2026-10-14, the real cause, found by the first RED: a branch asks its review from origin/main, whose merge-base with the merge is the merged parent, and `reviewStart` cannot move the start to the first parent, because that parent is no ancestor of it (bin/lib/codex-review-coverage.mjs, `reviewStart`). So the review read the whole branch against main again, which is what the order says 124 paid for. S2 was rewritten from "`from` is `HEAD^1`" to `mergeStart`: the start moves to the first parent when the records cover every code commit before it.
- L5. 2026-10-14, a decision: the review of a merge is no recheck. A recheck asks about findings made of another diff; the findings of the review that ended at the first parent stay where they are.
- L11. 2026-10-14, the first real merge review failed its evidence rule: at 0d4182d Codex used 163,048 input tokens and "its successful commands showed 17 of 38 changed lines of the files under review of 04630e0..HEAD; nothing was recorded"; the missing lines are the removed conflict markers (`-<<<<<<< 04630e0 ...`, `-=======`) of all four files (scratchpad mrv-at-merge.log). So Codex's commands did not print the remerge-diff as `rangeDiff` does: either it ran another diff, or its git differs (no `--remerge-diff`, or another configuration). Next, before any retry: read which commands Codex ran (the run log line of that attempt, or `--keep-home` rollouts), then make the prompt's command and `patchKeys`' expectations agree, test first. Not retried: each attempt costs about 160,000 tokens. Push of 159 waits. Known so far: Codex's first command was `git --literal-pathspecs ...` (the part's command, exit 0); ruled out: a conflict style or abbreviation of this machine's configuration (`git config --show-origin --get-regexp "merge\.|diff\.|core\.abbrev"` sets neither). Still to compare: that command's output in the lean session (its rollout, `--keep-home`) with `rangeDiff`'s.
- L10. 2026-10-14, the re-review after B1 (c2ac5ea): asked from origin/main at the tip, the plan was the whole branch again, 294 lines, about 220,000 tokens (inside the allowance of 352,800): the merge 0d4182d is no longer the tip (L3's case), so merge mode does not apply and `reviewStart` cannot move past it. Reviewed instead in two steps: the merge at its own commit, in a temporary worktree at 0d4182d (plan: "0d4182d is a merge of 3b9e681 ... 1 part, 47 changed lines in 4 files", about 35,000), then the fix from there. L3's case is worth a task: start after a merge of main that a record covers. Next: push 159 when both reviews are recorded, tell the orchestrator.
- L9. 2026-10-14, B1 fixed test first: `mergeStart` requires the merge to be an uncovered code commit ("a merge that took one side whole is no code commit and starts no review", RED then GREEN; merge tests 10 of 10). S4 rewritten to match. Next: commit, `codex-review --base origin/main --plan` (the pre-push re-review of 0d4182d and the fix) against the allowance before any spend, then the review, push 159, tell the orchestrator. If the plan asks a full re-review over the allowance, stop and tell the orchestrator.
- L8. 2026-10-14, state for a resume. PR 159 conflicted with main (7 hunks, after PR 154); merged main here rather than rebasing, since a rebase changes every sha and the records would cover none of them (a full review again), while this merge is reviewed by its remerge-diff with this branch's code. The merge was resolved by a writer (both sides kept; tests 57, 22 and 205 pass) and committed by the parent. The independent verifier (on 04630e0) found one blocker, B1: `mergeStart` (bin/lib/codex-review-coverage.mjs, near the `atMerge` check) does not require the merge to be an uncovered code commit, so a conflict resolved by taking one side whole (not a code commit for the push check, yet a non-empty remerge-diff) starts a paid review the baseline did not; fix: return null unless `atMerge.uncovered.some((c) => c.id === head)`, with its RED test, and revisit S4's wording. Advisories: A2 the nothing-to-review record of a merge lacks `diff: "remerge"`; A3 the log line at bin/codex-review.mjs ~1835 gives the wrong reason for own prompt on a merge; A4 `check --remote` versus codex-review's fixed `origin`; S6 the file header of bin/codex-review.mjs does not mention merge mode. Next: B1 fix, then `codex-review --base origin/main` (the merge and the fix, small), push, tell the orchestrator.
- L7. 2026-10-14, the measure the design must beat, from the orchestrator: JH 12 merged main into feat/commands-and-doctor to clear a one-line conflict in bin/check.mjs (fbad613, sides joined); the pre-push then asked for a review of the whole branch again, "5 parts, 1,405 lines, about 1,030,000 Codex input tokens, for one line". Measured with this branch, read-only (`node bin/js-harness.mjs codex-review --base origin/main --plan --cwd D:/js-harness-worktrees/commands-and-doctor`, at fbad613; that worktree's `git status --short` empty after): "fbad613 is a merge of c0364f8, a commit of origin/main: its review reads what was written in the merge", "1 part, 6 changed lines in 1 file", "about 24,000 input tokens". The orchestrator also proposed records keyed per commit; not needed for this case, since the commits already reviewed keep their records and `mergeStart` starts after them.
- L6. 2026-10-14, a slip of this session, in the open: `node bin/js-harness.mjs codex-review --help` was run without reading whether the command has that flag (it has none: `rg -n "help" bin/codex-review.mjs` finds only Codex's own `--help`). It ran nothing, because a heredoc had broken a quote in the same file and node stopped at the syntax error; the file was fixed with Edit and checked with `node --check`.

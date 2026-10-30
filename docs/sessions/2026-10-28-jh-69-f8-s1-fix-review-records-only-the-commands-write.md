# JH 69 · F8 S1 fix: review records only the commands write

## Goal
The S1 defect task, row 3 of section 13.3 of `docs/proposals/gentle-ai-reverse-engineering.md`: the review records
under the git common dir could be written or forged by the model. Opened by the lead with `js-harness sessions start`
from the brief `~/.js-harness/background/briefs/2026-10-28T10-57-47-502Z-f61d759c.md`.

## The user's words
None: the session was started by the lead, and its only prompt points to the brief ("Your brief is in
C:\Users\Oficina\.js-harness\background\briefs\2026-10-28T10-57-47-502Z-f61d759c.md: read it whole before anything
else, and do the work it gives you."). The brief's pass line: "a guard test denies an Edit to a record path, and a
hand-written lens record without its run line is refused by check --push."

## Delivered
- PR 630 (`f8-s1-records`, 17 commits from e7bc4215 to 472d919b): ready, told with `notify --kind ready --pr 630`.
- Prevention: `bin/lib/guard.mjs` refuses a file tool and a shell write to `lens-reviews.jsonl`,
  `lens-review-runs.jsonl`, `codex-reviews.jsonl` and `codex-review-runs.jsonl`; tests in `bin/lib/guard.test.mjs`
  and `bin/guard.test.mjs`.
- Provenance: `lens-review` writes a run line first; `admittedLensReviews` (`bin/lib/lens-reviews.mjs`) admits only a
  record that names one. Pass line in `bin/lib/lens-review-rows.test.mjs`.
- T7 in `odd/tasks/f8-s1-reviews.md`, closed, every round in L16.

## Decisions
- This session: findings a review called safe-side refusals stay refused (a joined path naming a record; `.git/js-harness`
  under any prefix); a whole `.git` by absolute path, a path in a shell variable, a script on stdin and a `cd` into the
  folder are not followed. Recorded in L16 and in PR 630's bad news.
- The lead (brief): independent verifier for high-risk item 2; review consent pre-granted (CLAUDE.md).

## Failures and lessons
- The worktree was edited while Codex reviewed `9e167848..d153e61e`; Codex recorded nothing and ran again (about 80k
  input tokens lost). Found by its refusal to record. Since then nothing is edited while Codex runs. The
  `docs/FAILURES.md` line is left to the lead, outside this surface.
- d6c504a7 read a gentle-ai warning about a comment as one about the code and narrowed the guard to the unsafe side
  (`rm -rf D:/r/.git/js-harness/` passed). Found by both Claude lenses; fixed in d81ca0f2 with 16 cases checked
  red against the previous guard. Lesson: a warning about a comment's mismatch is fixed on the safe side.
- A `capture-result` call with an added `--contract` flag failed (`not_started`, nothing written); rerun with only the
  tokens the status gave.

## Left
- A release with this change, installed by the lead; then every in-flight branch reruns `lens-review` over its range.
- PR 630's land, by the queue.

## Cost
- Time: 10:57Z (brief) to 14:51Z (ready notice); context at 29% after one compaction by the host.
- Reviews: gentle-ai 15 rounds (each approved and acknowledged), Codex 13 records on this branch plus one lost run,
  Claude lens runs 15 (risk and reliability), one independent verifier. Gate: each of 17 commits through the
  pre-commit gate, one pre-push `check --push`.

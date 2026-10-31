# JH 121 · refresh: refuse while an open question asks to apply what it would install; and the lead's two misses of 2026-10-31

## Goal
Two checks for two mistakes of the lead on 2026-10-31, each with a `- Seen:` line in `docs/FAILURES.md`: the refresh
of the installed copy refuses while an open question asks to apply what it would install, and the lead's compaction
resume lists the work sessions waiting on it. Opened from the lead's brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-10-31T07-48-31-030Z-fbafab31.md`.

## The user's words
His answer to question 141, read with `js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f 40996`:
"Dejarlo así (Recomendada)", tapped 2026-10-31T07:41:03Z. The rest of the request is the lead's brief.

## Delivered
- PR 736 (open, ready notice 08:41Z), branch `worktree-refresh-open-apply`:
  - `3fde3ae2` slice A: the optional `applies: {pr}` field on question notices (`bin/lib/channel.mjs`), the refusal
    with exit 77 (`bin/lib/refresh-consent.mjs`, `bin/lib/refresh-copy.mjs`, `bin/lib/merge-queue-refresh.mjs`,
    `bin/merge-queue.mjs`, `bin/lib/merge-queue-refresh-now.mjs`).
  - `35a47cc7` slice B: `waitingLinesOf` (`bin/lib/resume-record.mjs`) in the orchestrator's resume (`bin/resume.mjs`).
  - `3d02efbf` docs: `refresh-applied-unanswered` and `compaction-dropped-waiting` in `docs/FAILURES.md`, both
    `controlled` (`js-harness failures <id>`).
  - `b5cff02` fixes from Codex and the verifier.
- `odd/tasks/refresh-open-apply.md`, the feature document, Log L1 to L9.

## Decisions
- This session decided, recorded in L3: the field is `"applies": {"pr": <n>}`. Main holds the PR when its head or
  merge commit is an ancestor. A look that cannot tell refuses. The exit is 77 (EX_NOPERM). The check runs before the
  wait and again under the gate lock. There is no component form.
- This session decided, recorded in L6 and L9: "newest notice" is taken as the brief wrote it, of any kind, which is
  not the board's last state.
- This session decided, recorded in L9: an answer no transcript confirmed does not release the refresh.

## Failures and lessons
- Codex found that the consent look failed open in a shallow history and took any `cat-file` failure for a missing
  commit (git exits 128 for both). It also found the waiting lines hard-coded "JH". Both were fixed and rechecked
  by Codex as fixed (L8).
- I wrote "the board's reading" without checking `recordOfRows`; the verifier disproved it (L9) and the claim was
  corrected.
- A Codex run wrote no record because I edited the feature document while it read the worktree. It was run once
  more after a commit, and recorded.

## Left
- A verified "No" closes a question, and the refresh then installs what he declined. Reading the answer needs the
  question to name its yes option, a design change beyond spec 1. It is for the lead to schedule (L9).
- The merge of PR 736 is the lead's land.

## Cost
- First notice: ready at 08:41Z. Context: 63% at the ready notice, after reaching 88% before the host's compaction
  point.
- Codex: 3 runs (349,918 input tokens for 2 parts; one recheck that wrote no record because of my edit; one recorded
  recheck).
- Claude lenses: 2 runs of 4 lenses, 0 findings.
- An independent verifier: 133,227 tokens.
- Gate runs: one pre-commit gate per commit, 6, all PASS.

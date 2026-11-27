# JH 298 · roadmap State lines and owed checks

File: docs/sessions/2026-11-23-jh-298-roadmap-state-lines-and-owed-checks.md.

## Goal
A held work session of the lead JH ORQ (local_41e31b68), run from brief-298-roadmap-owed.md in the lead's notes folder: roadmap State lines behind their documents, the owed checks ready-head-not-pushed and stop-removed-live-worktree, and failures with no control. The lead then added the host-watch review 6.28899.6 and the two merge-queue holds.

## The user's words
None. The owner typed nothing to this session; every order came from the lead through cross-session messages and notices.

## Delivered
- PR 975, roadmap State lines for S7 and S8: merged.
- PR 976, stop-removed-live-worktree's Control line: merged (9cd786f0).
- PR 979, Control lines for decided-without-advisor and double-quotes-ran-backticks: merged (86c782e9).
- PR 981, docs/host-updates/claude-desktop-6.28899.6.md: merged.
- PR 990, draft, merge-queue holds (odd/tasks/merge-queue.md, S11, S12, T6, T7):
  - cb551ee7, the plan;
  - 4b9fd455, the `his` task kind holds a land, and `--reopen <n>` waits for refs/pull/<n>/merge^1 to equal origin's main; the code lives in bin/lib/merge-queue-holds.mjs;
  - 055cfcda, the fix of the resilience lens finding;
  - 269818b3, tests pinning the verifier's planted bugs.
- ready-head-not-pushed was not built here: PR 956 already covers it.

## Decisions
- One commit for T6 and T7, where the lead asked for two: both edit bin/merge-queue.mjs and its test, and splitting hunks needs an interactive add. This session decided it; the reason is in 4b9fd455's body.
- The new logic goes in a new bin/lib module, not a refactor of merge-queue.mjs. This session did it and the lead confirmed it in a message on 2026-11-22.
- Codex was recorded unavailable for cb551ee..269818b: the lead held it at its 70% weekly stop until 2026-11-23 23:45.

## Failures and lessons
- The first commit was refused on GitHub's machines: merge-queue.mjs reached 1060 lines (bin/conventions-structure.test.mjs), and scripts/rehearsal.mjs did not fill the new template text. Fixed by the module split and by updating the rehearsal fill.
- Node scripts with escapes ate backslashes three times (the `--reopen` regex `^[1-9]d*$`, and two test lines). Each was found by a test or a red run; the fix was to edit with the Edit tool. This is the register's script-ate-backslashes, seen again.
- The independent verifier planted three bugs that no S11 or S12 test caught. 269818b3 pins two of them, checked by planting them again (1 and 3 tests failed). The third cannot happen, because git updates origin/main anyway.
- One Bash call joined two steps with `;` where the rule is `&&` (the lens-review call of 4b9fd455).

## Left
- The Control lines in docs/FAILURES.md for land-took-pending-pr and reopen-tested-old-base were owed by this session. Another session put them into draft PR 992 and logged that as L18 (dd476d43, on PR 990's branch). PR 992 lands after PR 990.
- The notify-side half of land-took-pending-pr belongs to PR 956's file: the lead.
- The verifier's low items, listed in PR 990's body: a fork head is left out as his-step, a FETCH_HEAD race, and `--reopen` has no usage description.
- A Codex review of PR 990, after 2026-11-23 23:45: the lead.

## Cost
- About 38M tokens of the 40M line, measured from transcript 3f176b82; the verifier sub-agent spent 0.1M more.
- First notice 2026-11-22 16:46 local; last 2026-11-22 ~17:50. An 8-hour wait for notices to 298 ended at 01:35 with none.
- The host compacted the session once, at about 16:57.
- Reviews: Claude lenses 3 runs on 4b9fd455, 1 on 055cfcda, 1 on 269818b3, plus readability on PR 981. Codex: 0, recorded unavailable.
- Gate runs on GitHub's machines: 4 commits, the first red.

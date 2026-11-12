# JH 190 · the debts the model switch left

## Goal
Pay five small debts the move of the model home (PR 843) left, one work unit each, in one pull request. The opening
was the lead's brief `~/.js-harness/background/briefs/2026-11-12T07-36-44-400Z-040fd471.md`.

## The user's words
None in this session: the lead started it with `sessions start` while he was away until about 10:11 local; the five
items are the lead's brief, gathered from JH 172, JH 188 and the lead's own relief file (line 2611).

## Delivered
- PR 847, ready (`notify --kind ready --pr 847`, 05:19 local), branch `worktree-switch-debts`, ten commits from
  041ad34b to 553a08ef:
  - 041ad34b: the Codex review tests hold for any value of Codex's home. Claim checked first: at `high`,
    `bin/codex-review.test.mjs:1542` and `:3082` and `bin/lib/rules-bindings.test.mjs:88` failed (spec output kept in
    the job's scratch). Sweep through `js-harness gate` over the 20 test files reading Codex's home, review-effort at
    low/medium/high/xhigh/max and review-model at gpt-fixture-1, gpt-6-astra, gpt-fixture-astra: medium passes whole;
    every other value fails only `bin/rules.test.mjs:818` (docs/RULES.md not rendered) and, for the model, the two
    legacy lists of `bin/conventions-model-home.test.mjs`, which a real switch writes.
  - 5d85c447, f3bf5c69: the alias `sonnet`. The lens finding was at `bin/lib/guard.test.mjs:88`, not
    `bin/guard.test.mjs:88` as the brief said (lens-reviews.jsonl line 497); both files fixed.
  - b047db30, f2f8249b, 553a08ef: doctor's host-update row, the unreadable-record row and the heartbeat's usage name
    `node workshop/js-harness-workshop.mjs <command>`; a workshop test pins each named command to its dispatcher.
  - fae66811, d802dbb5: `sessions live` with no sessions folder and no recorded `sessions start` session exits 1.
  - df3462ac: `docs/FAILURES.md` entries `start-took-host-model` and `live-board-read-off-project`, both controlled
    (`node bin/js-harness.mjs failures`).

## Decisions
- This session: Codex's model half of the home was swept too (the brief named only the effort) and fixed in unit 1,
  since gpt-6-astra as the home failed four tests of the same kind.
- This session: the binding test of `rules-bindings.test.mjs` no longer counts a property's name; a test of its
  matcher holds what it still finds.
- This session: the four code units were reviewed as one slice (216 lines, under the 400 of a slice), since
  `codex-review` reviews to HEAD only.

## Failures and lessons
- The first pinning test spread `USAGE`, a joined string, into characters, so the loop's usage was not read; the
  reliability lens found it. Reading it whole found two more stale names (`js-harness throughput snapshot`, and prose).
- A rewording to satisfy that test changed a usage line's meaning; the readability lens blocked it; restored in
  553a08ef.
- Codex P2: the first `sessions live` check refused a project whose sessions all ran in worktrees; fixed in d802dbb5.

## Left
- The workshop's own usage texts and `docs/workshop.md` still write `js-harness host-watch` and `js-harness
  windows-daily` (the audit's core-03-16). Not held by anyone.
- The plan-keys suggestion of the readability lens is answered, not changed: `bin/codex-review.test.mjs:4824` pins them.
- The lead lands PR 847.

## Cost
- Time: opened 02:37 local, ready 05:19 local.
- Context: 81 % at the ready notice.
- Reviews: Codex 3 runs (fcdf728..df3462a, df3462a..f3bf5c6, f3bf5c6..553a08e); Claude lenses 5 runs (reliability
  and readability twice, readability once).
- Gates: 10 sweep gates of about 5 minutes each, and one commit gate a commit (tests on GitHub's machines at the push).

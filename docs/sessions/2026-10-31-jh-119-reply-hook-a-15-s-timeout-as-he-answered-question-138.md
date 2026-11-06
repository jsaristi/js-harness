# JH 119 · reply hook: a 15 s timeout, as he answered question 138

File: docs/sessions/2026-10-31-jh-119-reply-hook-a-15-s-timeout-as-he-answered-question-138.md.

## Goal
Make `install` write the reply Stop hook (`js-harness reply --hook || exit 0`) with a 15 s timeout instead of 5 s,
only that entry, as he answered question 138. Opened by the lead's brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-10-31T06-23-14-249Z-33f1ddcd.md`; the question and its measures
are JH 116's (`odd/tasks/reply-hook-latency.md`, `## Measure`, T5).

## The user's words
"Sí, 15 s", tapped 2026-10-31T06:22:32Z to question 138 (`js-harness sessions --quote
0f71b2c6-cbce-43ca-a031-276a4b2c381f 40819`). The message that opened this session only points to the brief.

## Delivered
- Pull request 733 (https://github.com/jsaristi/js-harness/pull/733), open, ready notice recorded
  2026-10-31T06:52:59Z:
  - `af847c22`: `replyHookEntry` at 15 s (`bin/lib/hook-entries.mjs`); the declaration test at 15 and an upgrade test
    (an install with the 5 s entry, then today's: one entry at 15 s, recorded once, gone after uninstall) in
    `bin/lib/manifest.test.mjs`; the budget of `bin/reply-budget.test.mjs` fixed at 2500 ms and held at most half the
    timeout; the 0.97.0 Codex reply entry in `bin/lib/earlier-codex.testkit.mjs` frozen at 5 s;
  - `1ffe7d02`: the verifier's fixes (the `COMMANDS_DEADLINE_MS` comment in `bin/lib/reply-commands.mjs`, a 205-character
    comment line rewrapped);
  - `754990c5` and this summary: `odd/tasks/reply-hook-timeout.md`, contract, spec, Log L1–L8, reviews.
- Tests (Windows): `bin/lib/manifest.test.mjs`, `bin/install.test.mjs`, `bin/codex-hook-trust.test.mjs`,
  `bin/lib/spec.test.mjs`, `scripts/practice-lib.test.mjs`, `scripts/reply-hook-time.test.mjs` exit 0;
  `bin/reply-budget.test.mjs` 4 of 4 (lead p90 696 ms, work p90 658 ms, budget 2500 ms).

## Decisions
- His (question 138): 15 s for the reply hook only.
- This session: the work budget stays 2500 ms rather than following the timeout to 7500 ms, since the 10 s added are
  room for a stop's load, not for the hook's work (L3).
- This session: no migration code; install already replaces an older form of its own entry (`isOlderOwnEntry`,
  `bin/lib/manifest.mjs:464`), held by a test for this entry (L2).
- This session: the 4000 ms command-check deadline kept, its comment reworded (L7).
- gentle-ai's Stop hook offered each commit as a candidate; each is one work unit, so its review ran with the
  `granted` invocation, as `CLAUDE.md` says.

## Failures and lessons
- The first commit's gate failed on CI: the new comment in `bin/lib/hook-entries.mjs` named gentle-ai, which
  `bin/lib/gentle-ai-absence.test.mjs` allows only in listed files. The failure was read before the second run; the
  comment was reworded. The check worked as meant: nothing reached a push.
- My search for readers of the 5 s had no "5 seconds" pattern and missed one comment; the independent verifier found
  it (L7). The fix: the comment, and the verifier's searches named in L7.
- The upgrade test passed on the old code too (both sides 5 s): it holds the replacement, not the change; the
  declaration test is the one that went red first (L4).

## Left
- Merge of PR 733: the lead's land.
- His settings get 15 s through the lead's refresh after the land (`js-harness merge-queue --land --refresh-copy`,
  which runs `js-harness install`), never a hand edit: a hand edit to 15 s first makes `install` record the entry as
  his, and `uninstall` would leave it (the verifier's finding 1). Check: in `~/.claude/settings.json`, `hooks.Stop`
  holds the entry `js-harness reply --hook || exit 0` once, with `timeout` 15. Undo: install the copy of main before
  the merge, then `js-harness install`, which puts the 5 s form back in place.
- The in-situ count of cancelled reply hooks after the refresh: `node scripts/reply-hook-time.mjs in-situ <transcript>`.

## Cost
- Time: brief at 2026-10-31T06:23Z; ready notice at 06:52:59Z.
- Context at the ready notice: 37% of the window (the notify's own reading).
- Reviews: Codex 2 runs (69,543 and 32,217 input tokens), both correct; Claude lenses 2 runs (risk, resilience,
  reliability; readability), 0 findings; gentle-ai 2 reviews (lens reliability), approved; one independent verifier
  (121,989 tokens).
- Gates: 3 pre-commit gates on code (one failed on CI, fixed), 2 on documents, 1 pre-push.

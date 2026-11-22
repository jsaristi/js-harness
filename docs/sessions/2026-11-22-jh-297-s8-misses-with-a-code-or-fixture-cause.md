# JH 297 · S8 misses with a code or fixture cause

## Goal
List S8's misses by cause, then fix those whose cause is code or a fixture, one per commit, test first. Opening:
`brief-297-s8-misses.md` in the lead's notes folder (local_41e31b68), then the lead's queue messages.

## The user's words
None: the session was started and driven by the orchestrator (JH ORQ · orquestador F8); the owner wrote nothing to it.

## Delivered
- PR 973, draft, open: `odd/tasks/f8-s8-designs/misses.md`, every S8 row with its cause, file and open fix.
- PR 977, draft, open: `evals/tasks/incident-02-review-consent/fixture/CONTRIBUTING.md` pre-grant covers the
  review's cost; test in `evals/tasks.test.mjs`.
- PR 978, draft, open: `scripts/release-proof-lib.mjs` `upgradeProblem` passes upgrade's no-terminal stack exit when
  the harness moved; `node scripts/release-proof.mjs --repo .` passed 12 of 12 steps.
- PR 985, draft, open (branch `claude/jh297-quiet-tests`, head `fe502f0f` before this file): `bin/lib/quiet.mjs`
  counts a `node --test` run as work; Control line under `### quiet-misses-background-work` in `docs/FAILURES.md`.
- Notes in the lead's folder: `codex-day-order-2026-11-23.md`, `forty-minute-run-2026-11-22.md`,
  `pr972-skipped-files.md`, `host-review-6.28899.6-es.html` (published by the lead).

## Decisions
- No Codex run before 2026-11-23 23:45: the lead's; skips recorded with `codex-review --unavailable` on 977, 978, 985.
- `test-skipped-here-never-run` moved to JH 299: the lead's.
- Spend line raised from 20M to 40M: the lead's.

## Failures and lessons
- The host-review page counted 252 rows; the review has 281 (my parser missed rows). The lead corrected the page;
  no `- Seen:` line yet, the lead assigns it.
- A Control line was reported lost because a `\'` escape kept the test title from appearing literally; the title now
  uses double quotes.
- Release proof with a `/d/...` path is not local and failed at check-from on v0.97.0's hooks; only `--repo .` is a
  local proof (commented on PR 978).
- PR 985's lens reviews found separate-word flag values and an incomplete flag list; fixed test first, the last range
  had 0 findings.

## Left
- Grader misses (C1.2, C1.3, C1.5, C2.4): held by PR 930.
- Long-session Codex login: the lead's decision (credentials).
- C3.2's one-off failing test: cause unknown, green 7 days.
- Release proof's non-local check-from fault: its files are held by PR 978.
- Cases 01 and 05: cause unknown, no S8 transcript found.
- Codex reviews of 977, 978, 985: debt until a review pays it.

## Cost
Spend 33.8M tokens (own transcript, summed), context 30% at close after one host compaction at 17:07. Reviews:
Claude lenses on 977, 978, 985; no Codex run; no paid run. Gate: the pre-commit `check` on each commit.

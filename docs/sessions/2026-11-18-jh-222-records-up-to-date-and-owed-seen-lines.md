# JH 222 · records up to date and owed Seen lines

## Goal
Item `staledocs` of the plan of 2026-11-18 (version 4; version 3 item a adds the owed `- Seen:` lines): bring stale
boxes and state lines up to date, each with its evidence, `drop-circleci` first, then write the Seen lines owed in
`docs/FAILURES.md`. Documents only. Goal `boxes`: `js-harness progress | findstr /L /C:"[x] drop-circleci"`.

## The user's words
Question 340, "Sí, las 8", in JH PLAN's transcript `f5c3ee4d`, as the starting brief relays it; this session did not
read that line itself.

## Delivered
- `47dd2db6` docs(failures): 22 Seen lines. New entries `main-push-timed-out` (control: the test "the push of main
  waits for a pre-push hook that takes minutes", PR 904), `quiet-misses-background-work` (10 sightings, relief file
  lines 3049-3055 and 3078-3080), `spend-past-approved` (3), `stretch-goal-met-at-open` (1); added to
  `told-him-unverified` (4), `hours-guessed` (1, so it reads seen again), `old-rule-beside-new` (JH PLAN's, 1) and
  `question-tool-holds-asker` (the hung `start_session`, from the lead's note of 2026-11-18T19:29Z).
- `2e3e44bb` docs(tasks): ticked with PR and merge commit: drop-circleci T3 (PR 611), review-gate T10 (PR 898),
  reply-hook-timeout T3 (PR 733), senior-orchestrator T5 (PR 876) and T6 (PR 893), workshop-product-split T8 (PR 772),
  f8-s0-baseline T8 (PR 599), f8-s7-topology T1 (PR 794); State or Next step updated in senior-orchestrator,
  review-gate, reply-hook-timeout, f8-s7-topology and f8-s1-reviews.
- `83f532e8` docs(roadmap): ten lines replaced, none added (Install and update S1 ticked, PR 780; S3, S12, S4b and
  pair 9, the repository watch, S9, S8).
- Each PR read MERGED in one `gh api graphql` call; review records read in `.git/js-harness/` by a read-only reader.
- Checks on the head: `js-harness failures check` exit 0; `js-harness rules check` exit 0;
  `node --test bin/conventions-*.test.mjs bin/failures.test.mjs bin/lib/failures.test.mjs` 152 of 152;
  `js-harness progress` prints `[x] drop-circleci 4/4 100%`.

## Decisions
- This session: a sighting is dated by the local day of the relief line, as the register's older lines are; one Seen
  line per occurrence of the false quiet, as the register says; "the lead's own" only on the lead's own mistakes.
- This session: a verify box stays open where its records do not cover every commit.

## Failures and lessons
- The five-part brief the plan said the lead would give was not in this session's brief; asked in a note at
  2026-11-18T19:28Z, the lead answered with the hung start and the "more than 8 h" figure.
- `bin/contract.test.mjs` "run stops a command at its timeout with its whole process tree" failed once (68 s) in a
  run beside other work; it reads no document this change touches. Not rerun.

## Left
- Open boxes, each named with why: claude-md-block T3 (fix commit `cabbacbc` had no verifier pass), senior-orchestrator
  T2 (no record of the probe), T3 (no verifier over `a258b450`), T4; the roadmap's S3 fixed load over five sessions (no
  record measures it).
- Fork labels: the relief file names only "fork labels correction" (lines 3111, 3143); what the labels said wrong is
  not recorded, so no Seen line was written for it beyond the "more than 8 h" figure.
- Not done: JH 218's sighting of `documents-commit-skips-suite` (channel, 2026-11-18T17:22Z): its commit and failed
  convention were not read.

## Cost
First notice 2026-11-18T19:28Z. One read-only reader (about 150k tokens). No Codex or lens review: no code commit.
No gate run beyond the pre-commit checks.

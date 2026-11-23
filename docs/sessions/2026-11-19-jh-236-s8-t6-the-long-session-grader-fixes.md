# JH 236 · S8 T6, the long-session grader fixes

File: docs/sessions/2026-11-19-jh-236-s8-t6-the-long-session-grader-fixes.md.

## Goal
Task T6 of `odd/tasks/f8-s8-certification.md`, of kind build, with tests first: three fixes to
`evals/long-session/grade.mjs`. The brief was JH ORQ's `brief-s8-t6-grader.md`, in the lead's notes folder.

## The user's words
Question 361, "Sí, en ese orden (Recomendada)" (JH PLAN's transcript `f5c3ee4d`, line 6239), and question 363, "Sí,
calificarla" (line 6439), both quoted from the brief through the lead.

## Delivered
- Draft PR jsaristi/js-harness#930, branch `claude/s8-t6-grader-fixes-613de1`, open; JH 237 now holds it. Its commits:
  - `dce5027b`: a share from fewer than 5 valid runs cannot certify (`MIN_RUNS`).
  - `b3a1a510`: Spanish is judged only on the replies after tool output.
  - `2ce266fc` and `26a651d9`: tdd is judged per feature with the feature's own test, and the turn window is gone.
  - `aeeefb6e`: T6 is ticked and log line L6 is written.
- Checks: `node --test evals/long-session/grade.test.mjs` passes 46 of 46, and `npm run check` exits 0.

## Decisions
- This session dropped the tdd turn window, a change beyond the three named fixes (PR body, L6). The reason: S8's
  current-1 wrote `src/done.mjs` at turn 5 and `src/stats.mjs` at turn 10, read from its kept transcript.
- This session chose not to guess whether tool output was English (L6). The reason: on the S8 transcripts a word list
  picked the same turns, except 1 to 3 per run.
- The lead stopped the session over its spend and handed the open items to JH 237 (its messages).

## Failures and lessons
- Fix 2 was not test-first: `gradeTdd` was edited before its new tests, which were then shown to fail against the old
  `grade.mjs`. The PR body and L6 still say "test first"; JH 237 holds the correction.
- The fixes were not run on real command shapes until the end. A dry run on the ten kept runs then showed a possible
  false miss on glob test runs (current-2).

## Left
JH 237 holds what `jh236-t6-ready.md` in the lead's notes folder lists:
- the glob test run (`node --test tests/*.spec.mjs`);
- the "test first" wording in the PR body and in L6;
- the Codex review, after the reset of 2026-11-23 23:45.

Follow-ups, not in the PR:
- `gradeCompact` has the same blind spot for a feature built early.
- A Bash call that writes a source file and then exits non-zero counts as no write.
- `regradeSample` counts the "no reply followed tool output" verdict as a judged agreement.
- `ownTests` does not read the text of a MultiEdit.

## Cost
- Claude: 12,735,945 cache-read tokens, against the brief's estimate of 3M to 6M and its stop line of 9M. Summed from
  this session's transcript usage, each message counted once; the lens runs are not included.
- Context: over 100% at the end, compacted by the host.
- Reviews: 4 lens runs (7 lenses, about 63k input tokens in all) found 3 findings, all fixed and rechecked. Codex: 0
  runs, its review recorded as unavailable.
- Gate runs: the pre-commit `check` on 5 commits, plus 1 run of `npm run check`.

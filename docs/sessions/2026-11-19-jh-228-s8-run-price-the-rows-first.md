# JH 228 · S8 run: price the rows first

## Goal
T8 of `odd/tasks/f8-s8-certification.md` (item `s8-run`): name the candidate, price every row of `## Measures` with
its `--plan`, run them only on the owner's yes, and write `## Result` with every measure not built reported as not
built. Later, by question 363, grade the long-session run once.

## The user's words
- Question 350, "Sí, correr S8 con tope $12 y $74 (Recomendada)" (transcript `f5c3ee4d`, line 3893), through the lead.
- Question 363, "Sí, calificarla (Recomendada)" (transcript `f5c3ee4d`, line 6439, read with
  `js-harness sessions --quote f5c3ee4d 6439`), through the lead.

## Delivered
- PR 924, merged (`5ae4021a`): T8's runs on candidate `0c28d083`, `## Result`, results under `evals/results/`.
- PR 925, merged (`092c40db`): the long-session grading, `evals/results/long-session/f8-s8-long.grade.json`,
  commits `9bf91d04`, `1b63a613`, `654c6289`.
- Result: S8 does not pass. Coverage 13 of 17, pass rate 5 of 13; C1.1 14 of 20 against 17; long session 11 of 25
  moments (44%) on both setups against 90%.

## Decisions
- The owner: the spend and its caps (question 350), one grading (question 363).
- The lead: refresh the installed copy to `0c28d083` before the runs; batch cap $60 (what was left of $74).
- This session: the long batch's commit in a sidecar, `f8-s8-long.commit.json` (`run.mjs` records none); grade on a
  docs branch from `5ae4021a`, the grader unchanged from `0c28d083` (`git diff --stat 0c28d083 5ae4021a -- evals/`).

## Failures and lessons
- The first `## Result` read run b's incident-01 and C4.1 wrongly; the advisor's review caught both and `19f24ace`
  corrected them.
- C2.4's first tally (135 of 147) summed "not reached … 27 of 30" lines as replies; the advisor caught it,
  `1b63a613` corrected it to 81 of 87. Lesson: count from the field that names the measure, not a loose regex.
- The grading's Codex and Sonnet token counts are not recorded (`grade.mjs:713-731` keeps only the answer; Codex
  runs `--ephemeral`), so the 0.9M promise at question 363 could not be checked: a gap in `grade.mjs`, not fixed here
  (nothing under `bin/` or `evals/*.mjs` was in this session's files).
- `release-proof --to <sha>` is a usage error; `--to` takes a tag. `js-harness upgrade` exits 1 non-interactively when
  a stack tool has a newer release.

## Left
- C5.1 by hand, R3 (the lead's), T2 to T7; the grader's token record (T6's area). A second grading after T6 is not
  approved.

## Cost
- Paid runs $45.38 of $74 (list cost); grading: Codex meter weekly 49% to 50%, five-hour 0% to 7%; Sonnet cost not
  recorded.
- From 2026-11-18 about 23:50Z to 2026-11-19 about 17:40Z; context about 37% at the end.
- Reviews: none (documents only, no code commits); gate: `npm run check` in each pre-commit hook, passed.

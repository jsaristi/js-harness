# JH 235 · S8 T5 and T7, the two designs

File: docs/sessions/2026-11-19-jh-235-s8-t5-and-t7-the-two-designs.md.

## Goal
Write S8's two designs, T5 (R1's behavioural run) and T7 (the audits), documents only, each through one double
read, for the owner's decision. The opening read was the lead's brief `brief-jh235-s8-t5-t7.md` (lead notes folder).

## The user's words
Question 361, "Sí, en ese orden (Recomendada)" (JH PLAN's transcript `f5c3ee4d`, line 6239), per the brief: build
S8's T2 to T7, with T5 and T7 first. Then question 368, "Sí, R1 solo mide (Recomendada)" (`f5c3ee4d`, line 6815), and
question 369, "Sí, piloto tras el reinicio (Recomendada)" (`f5c3ee4d`, line 6881). The lead verified both by quote.

## Delivered
- PR 926, merged as `cd67d75a`. It holds `odd/tasks/f8-s8-designs/t5-behavioural-run.md` and `t7-audits.md`, one
  pointer line each in T5 and T7 of `odd/tasks/f8-s8-certification.md`, the answer to 368, and one
  `spend-past-approved` sighting in `docs/FAILURES.md`, which the lead asked for.
- PR 929, ready: the answer to 369 in `t7-audits.md` (commit `3d45d034`), and this summary.

## Decisions
- The owner, 368: R1 at S8 is the current-arm run of the existing cases; the paired proofs go to S5c-b. This
  approves the design only.
- The owner, 369: T7 is approved, with one pilot audit after the 2026-11-23 reset; its spend is asked first.
- The lead: one double read only, and no confirming read, since a second read would pass the 60% weekly stop.
- This session: it took all 32 findings of read `b9b33782` (`double-review take`, recorded).

## Failures and lessons
- The first price of the read was wrong. It used old records and the stale `double-review read --plan` figure
  (0.9M), while the last five `gpt-6.2-sol` reads in `.git/js-harness/double-reviews.jsonl` cost 2.9M to 6.8M.
  The advisor caught it before the notice was sent. The read measured 3.68M. Lesson: price from
  `readers[].usage` in the records, not from `--plan`.
- The first T5 draft put S5c-b's proofs inside S8, against the owner's deferral (`docs/ROADMAP.md:703-705`). Both
  readers found it.
- The background wait died once (exit 127) when the installed copy was refreshed. The wait armed next ended normally, on merge-queue's note that `--refresh-copy` had stopped it. Both were re-armed.

## Left
- T7's pilot audit: after 2026-11-23 23:45, with its spend asked first. The lead holds it.
- R1's line (T5, item 5), T7's baseline and candidate, and the spread of the Codex runs: all the owner's.
- Building T2, T3, T4 and T6 belongs to other sessions.
- `double-review read --plan` still prints 0.9M of Codex, while the last five reads cost 2.9M to 6.8M: a code fix, for the lead to assign.
- The S8 document still prints 454 of 543 at `odd/tasks/f8-s8-certification.md:85` and `:145`, while `rules coverage --json` gives 542 on `5ae4021a` (Claude finding 15, taken in T5 only): JH 228 holds that file.

## Cost
- Time: the first notice at 10:51 local, the last at about 12:40.
- Context: 63% at the end (`get_usage`).
- Reviews: one double read, Codex 3,675,112 input tokens (weekly meter 50% to 52%) and Claude 2,670,988. No Claude
  lenses and no Codex code review, since there was no code.
- Claude, this session: not metered in tokens. `get_usage` gives plan shares only: weekly all models 78% and context 63% at the end.
- Gates: `npm run check` ran 4 times in full, plus the pre-commit gate on each commit, all exit 0.

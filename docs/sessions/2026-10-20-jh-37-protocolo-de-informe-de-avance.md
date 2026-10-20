# JH 37 · protocolo de informe de avance

File: docs/sessions/2026-10-20-jh-37-protocolo-de-informe-de-avance.md.

## Goal
Put a status-report protocol into the harness, so the lead answers "cómo vamos" with a detailed report of everything since the last report, built from a tested command. Opened by the lead's brief (L1 of odd/tasks/status-report.md); no stored opening.

## The user's words
"dime todo lo que hemos hecho y que tan implementado esta y que nos falta, debe haber un protocolo asi que cuando te diga como vamos o que tanto hemos hecho etc tu contestes la informacion desde la ultima vez bien detallado no solo como me respondiste de que vamos bien, dime que me propones" (transcript 908805db-d0b9-4c2f-a9e6-f828b6bf1e41, line 8945, 2026-10-20T19:46:30Z; S1 of the feature document).

## Delivered
- PR 479 (`feat/status-report`), ready: `js-harness report [--since <time>] [--mark]`, which prints Landed, Sessions, Questions and Map since the cut. `--mark` records a report line, holding the default branch's head, in the channel record. The orchestrator skill gains `## The status report`, with six sections.
- Commits: fde1b6c6 (the command), f1a11c68 (the skill protocol), 483d528f (gentle-ai advisories), 13d66520 (Codex findings), plus the docs commits 0bf3ea79 and 0bf20d28.
- odd/tasks/status-report.md: specs S1-S6, tasks T1-T5 all done, log L1-L6.

## Decisions
- This session made a new command `report` rather than `progress --since`. That leaves `progress` untouched (L2).
- This session made the report's time a channel line that is not a notice, so it wakes nobody and `uninstall` removes it. Only `--mark` moves the cut (Constraints of the feature document).
- This session took all eight gentle-ai advisories (L3) and both Codex P2 findings (L5).

## Failures and lessons
- The RED of the subfolder test (`git ls-tree --full-tree`) was not observed, because another session's gate held the test lock. Codex had reproduced the defect from `bin/`, and the test passes after the fix (L5).
- Codex refuses to review with uncommitted changes, so the doc note was committed before `codex-review`.
- The README example of `report` is a plain run, never `--mark`. A `--mark` against the real home would move the lead's cut.

## Left
- Landing PR 479: the lead's.
- The board's wording for skipped channel lines ("neither a notice nor a reading") does not mention report lines: a small follow-up.
- Declaring the protocol as a rule (`js-harness rules change`): the lead's call.

## Cost
- Time: the first commit is at 20:08Z (fde1b6c6) and the ready notice at 20:40:09Z.
- Context: the host compacted the session at 15:41 local, after the ready notice (63% at that notice).
- gentle-ai: one review, lineage review-1d50db51e4e7c3db, with lenses risk, readability and reliability, approved and acknowledged. Two later assessments were medium and not due (under_budget).
- Codex: one review in 3 parts and one recheck, verdict correct (0.99).
- Gate: green on every commit (pre-commit hook, tests on GitHub's machines).

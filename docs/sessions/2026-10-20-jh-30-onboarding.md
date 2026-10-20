# JH 30 · onboarding

## Goal
Build js-harness onboard v3 as designed in `odd/tasks/onboarding.md`. The lead (local_bd0ae465) set the conditions:
- work on its own branch, with tests;
- one gentle-ai review per work unit, plus a Codex review;
- the lead lands the PRs through the merge queue;
- package.json stays untouched while release 0.96.0 is cut.

## The user's words
- The design request is S1 of `odd/tasks/onboarding.md`: "una funcionalidad de onboarding para que cuando instalemos el harnes en un proyecto hagamos todo el pre plan y el plan ya con la ia para ejecutar un roadmap completo y bien estructurado del proyecto".
- The reframing is S3, his answer to Pregunta 25 (transcript 908805db), quoted whole in that document. It opens: "La idea no es que sea un proyecto de prueba, la idea es que se hable con la Ia de que se va a tratar el proyecto".
- In this session he asked for an uninstall with one entry per kind: "el uninstall deberia tener submenus con los diferentes tipos de desintalacion".

## Delivered
- PR 466 (slice 1: `onboard check`, `hash`, `template`), merged on 2026-10-19 at 16:49:08Z.
- PR 468 (slice 2: bare `onboard`, its stages and resume, `init`'s closing line), merged.
- PR 471 (uninstall kinds, built by side session JH 33 at his request), merged as bc76bc46.
- ccb592b7 on `feat/onboarding-plan-advisor`, pushed with no PR. It records S3, checks T3 and opens T6 (design v4).

## Decisions
- Uninstall offers its kinds both ways: a TUI submenu and CLI subcommands. Today's bare `uninstall` and its flags stay as they are. He chose this with the question tool, and JH 33's feature document records it.
- The onboarding becomes a plan orchestrator that adapts to the developer's level. His decision; S3 records it.
- Design v4 goes to a fresh session at high effort, not to this one. This session's decision; L9 records it.

## Failures and lessons
Each failure below is listed with how it was found and what changed.

**Corrupted git paths.** A `trim()` on `git status --porcelain` output cut the first character of a path.
- Found by: gentle-ai's review, as CRITICAL.
- Fix: 12aa07ce reads only the end of the output (`trimEnd`), with a test.

**Approval of a missing file.** A checked task whose file was gone asked for approval of `sha256:null`.
- Found by: gentle-ai's review.
- Fix: ef60d123.

**Remote branch hidden.** A remote onboarding branch was hidden behind a local branch that lacks the document.
- Found by: Codex, as a P2.
- Fix: 04163529.

**Merge queue left PR 466 out.** No gentle-ai line named 5bc31869.
- Found by: the merge queue.
- Fix: 6e99edaf adds one line per code commit, kept as practice since.

**Heredocs ate backslashes, twice.**
- Found by: the files that were written.
- Change: Edit and Write are used for such text.

**Two progress reports were not true.**
- One said PRs 466 and 468 were open when both had merged. It was corrected after `gh pr view`.
- Several said "sigo con T4" while T4 did not move. That was corrected in a later reply.

## Left
- T6, design v4 from S3, with two readers. The lead holds it, to give to a fresh session at high effort.
- T4, the real onboarding, which waits on T6.
- T5, the ROADMAP ticks.
- The scratch project `%TEMP%\tmp.B03yRgQ1Xy` can be deleted.

## Cost
Session JH 30, 2026-10-19, with one compaction by the host.
- gentle-ai: one review for each of slices 1 and 2. Slice 2 needed one correction.
- Codex: one review for each slice, plus re-reviews of the fixes.
- Gate: one run for each commit.

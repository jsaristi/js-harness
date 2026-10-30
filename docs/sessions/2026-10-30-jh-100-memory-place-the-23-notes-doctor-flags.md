# JH 100 · memory: place the 23 notes doctor flags

## Goal
Place each of the 23 notes doctor's `memory-rules` row flagged (feedback and project notes of the project's Claude Code
memory folder) where its rule lives, and delete the ones he approves, so memory holds no rule. Opened by the lead's
brief `~/.js-harness/background/briefs/2026-10-30T14-31-27-443Z-f17a9da5.md`.

## The user's words
Question 117, answered in the lead's chat: "Sí, las 22 y el tipo (Recomendada)", tapped at 2026-10-30T14:57:26Z
(`js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f 31693`).

## Delivered
- `odd/tasks/memory-notes.md`: each note classed with its home and evidence; the quotations of the notes to delete
  moved into "Moved out of memory" (13 quotations of 7 notes were in no home `memory verify` reads before).
- `docs/FAILURES.md`: a `- Seen: 2026-10-27` line in `hand-made-output` and a `- Seen: 2026-10-20` line in
  `told-him-unverified`; `docs/ROADMAP.md`: his 2026-10-14 scope words in the row "First version's scope".
- Commit e3926468 (pre-commit gate passed), PR 700.
- Memory pass 20261030T150050643Z, verified: the 17 pointer notes and their MEMORY.md lines deleted,
  reinstall-checklist.md retyped `project` to `reference`; `js-harness backup run` taken first.

## Decisions
- reinstall-checklist.md is a fact note by design (orchestrator skill, "Before a reinstall", step 2); the check that
  reads the note's type is right, so no code change (this session's, odd/tasks/memory-notes.md L3).
- The 5 placed notes are deleted only after PR 700 lands, since until then the branch is their only other home (the
  lead's condition, its message after question 117; odd/tasks/memory-notes.md L5).
- One optional rule offered for the lead to ask, in Spanish: corrections before new capabilities in the queue
  (odd/tasks/memory-notes.md, "What he would type").

## Failures and lessons
- restart-announce-caps.md was deleted with the 17 although its 2026-10-20 quotation is in no home on main
  (`rule:restart-announce` quotes his words of 2026-10-24): `memory verify` ran from this branch, whose feature document
  holds it. Its copies until PR 700 lands are that document, the backup and the pass's snapshot. The check missed it
  because a branch's homes count as homes; the lead's condition caught only the 5 the document named as placed.
- `js-harness rules` lists 69 rules, not the brief's 70.

## Left
- After PR 700 lands: delete board-rows-through-notify, conflict-merge-costs-review, corrections-before-date,
  hidden-load-slows-gates and one-sample-is-not-a-diagnosis with their MEMORY.md lines (`memory plan`, delete,
  `memory verify --approved`), after which doctor's `memory-rules` row reads `ok`. JH 100 holds it.
- The optional rule for corrections-before-date: the lead's to ask or drop.

## Cost
First notice 14:45Z (question 117), ready notice after this commit. Two pre-commit gate runs; no Codex or lens review
(docs only); one `backup run`. Context: not read with `get_usage` (the tool is not in this session); the guard's record
read 49 percent at the first close.

# JH 32 · el guard exige el JH + número

File: docs/sessions/2026-10-20-jh-32-el-guard-exige-el-jh-numero.md.

## Goal
Make the guard refuse a `start_session` whose title is not `<code> <n> · <purpose>`, naming the next free number,
where the rule `session-title` is declared. Started by JH ORQ (local_bd0ae465) with Sebastián's report in its brief;
the work ran from `odd/tasks/session-title.md`.

## The user's words
"Hay un error en las sesiones de trabajo y es que no le estas colocando el JH + numero no entiendo por que antes si
y ahora no si esta explicito en el harness? que esta fallando y como se debe solucionar?" (transcript 908805db, line
4992). His answer to question 24: "Osea en este caso se llama JH de JS Harnes pero la idea es que tenga el
udentificador del proyecto" (transcript 908805db, line 6036). Both are S1 and S5 of the feature document.

## Delivered
- jsaristi/js-harness#470, merged: the rule `session-title`, declared and then reworded by `rules change` on
  `rule/session-title` (73f78044, 57a6aebd).
- jsaristi/js-harness#469, merged: `bin/lib/session-title-guard.mjs`, `nextSessionNumber`, `projectCode`,
  `sessions --next-number`, `codeOfName` in `init`, this repository's harness.json `"code": "JH"`, help, README,
  SPEC and skill (8f43aebb..46ea2705).
- Feature document `odd/tasks/session-title.md` (S1-S5, T1-T3, L1-L11); `odd/tasks/session-title-rule.md`.

## Decisions
- The rule lives in its own rule/ PR: the merge door refuses rules-data.mjs from another branch (the lead).
- `<code>` is the project's identifier in harness.json "code": Sebastián (question 24), designed by the lead.
- A missing or unreadable code refuses every title; a code is capitals and digits a title reads back; the code is
  read from the main checkout: this session (L10, L11).

## Failures and lessons
- The rebase onto the rule branch renamed every commit, so the Codex records and gentle-ai evidence lines no longer
  covered them; Codex ran again and found a P2 (torn record lines dropped), fixed in 2074cfac.
- A test's fake reader failed on Linux (`D:/project` is relative there), found by the CI gate.
- The gate called the T3 guard change "not due"; it was raised through item 2 and reviewed alone in a detached
  worktree.

## Left
Onboarding asking for the code (`bin/lib/onboard.mjs`, JH 30's area): unassigned.

## Cost
First notice 2026-10-19T17:15Z, last 2026-10-20T02:18Z; context near 88% at the end, after one compaction. gentle-ai:
two high reviews approved (review-0955e6a5595ae4c8, review-a5b452117b863509). Codex: eight recorded runs. Gates: one
per commit, with two failures fixed.

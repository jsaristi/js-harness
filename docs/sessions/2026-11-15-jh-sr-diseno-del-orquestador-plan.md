# JH SR · diseño del Orquestador Plan

File: docs/sessions/2026-11-15-jh-sr-diseno-del-orquestador-plan.md.

## Goal
Design, without building, the "Orquestador Plan" layer he asked for: a session above the lead that plans what he
says and hands the plan to the lead. One feature document with its double reviews, the Spanish page and the
questions for him. The task came from the lead (JH ORQ · orquestador F8) by message; the opening is stored under
this session's title (`js-harness sessions --opening "JH SR · diseño del Orquestador Plan"`).

## The user's words
All typed, read with `js-harness sessions --quote 699d7c29-54c4-460e-a5e8-700b114eb251 <line>`; whole quotes in
`odd/tasks/plan-orchestrator.md`, Specs 1 to 8.
- 969 (2026-11-16T00:54Z): "... debemos tener el Senior pero tener un orquestador mas con el que yo me comunique ..."
- 992 (00:57Z): "... una capa por encima que sea el Orquestador Plan ..."
- 1206 (02:01Z): "Listo comencemoslo aplicar de una vez dime que tenemos que hacer"
- 1389 (02:22Z): "El orquestador plan debe tener Remote control osea este y el Plan"
- 1598 (03:02Z): "Me avisas cuando el orquestador plan este funcionando para comenzarlo a probar"
- 519 and 402 of the same transcript, and 69918425 line 20757, as Specs 4 to 6.
He typed one line in this session, after the design was delivered (Log L14 of the feature document): "probemos asi
a ver como nos va con el uso y si vemos si es excesivo se lo quitamos a los enjambres" (2026-11-16T06:27Z).

## Delivered
- `odd/tasks/plan-orchestrator.md`, version 3, with Log L1 to L13; `odd/tasks/plan-orchestrator-evidence/measures.md`.
  Draft PR 894 on `claude/dreamy-nash-50fa03`, documents only, open.
  Commits: 11f1d907, 8288102e (merge of `docs/fanout-tree`), 5b02f348, 346763bd, d8cc88a6, 515ccfe3, b8125c57,
  13ee4d96, and the commit that adds this file.
- `odd/tasks/fanout-tree.md`: Log L8, his line 992 (5b02f348).
- The page for him: https://claude.ai/artifact/1ppv1NAxbrfv3THX96Gt7b, private to him.
- Questions 307, 308, 309 and 310, recorded for the lead to put to him.
- `js-harness contract check odd/tasks/plan-orchestrator.md`: PASS. `npm run check`: PASS at commit 13ee4d96 (21 rows).

## Decisions
- His, typed: Remote Control on both orchestrators (line 1389, Spec 7); to be told when the Plan works (line 1598,
  Spec 8).
- His, open: where his questions reach him (307); who opens the work sessions (308); the Plan's model (309); the
  reading of "enjambres de sesiones" (310).
- The lead's: line 1598 becomes a spec with its done condition (its message, Log L12).
- This session's: the Plan is the onboarding's plan orchestrator made lasting; the plan is the stretch plan with a
  version; one clock that extends `bin/lib/stall.mjs`; the build is one chain, T3 first (the document's Tasks). The
  third review's findings are not corrected: `rule:double-review` allows three reviews (Log L11).

## Failures and lessons
- The third and last double review still finds real failures in version 3: Claude 16, Codex 5, four of them high
  (Log L11). The design is not finished.
- Version 1 called its verdict "refutes" from the wrong test, misread PR 883 and quoted a false binding figure;
  version 2 took its measure from `js-harness progress --baseline`, which counts every feature document's tasks
  and not the roadmap alone. Both were found by the readers, not by this session (Log L9, L10).
- His line 1598 was typed six minutes before version 3 was committed and this session did not search his later
  lines before the third read (Log L12). Before a read, search his lines typed since the last one.
- The page was written from version 2 while the second read ran, and had to be brought to version 3 by a second
  writer run of 154,275 tokens. A page is written after the last read, not beside it.
- Each read's Claude reader cost about 3.0 to 3.6 M tokens against the 1.1 M the command states.

## Left
- The 21 open findings of L11: the lead decides whether a session on a fresh context corrects them.
- Landing PR 894, then the notice of Spec 8 at phase 0's step 1 (T10): the lead.
- His four answers, each with its transcript line in the document's Log (T9): the lead.
- T3 (the clock) can start in its own session; T5, T4, T6, T7 follow in a chain: the lead assigns them.
- Three stale lines in the document, known and listed in Log L13.

## Cost
- Time: first notice under this title 2026-11-16T02:11Z (21:11 local); the host compacted the session once, at
  22:23 local; context at the end about 50% after that compaction.
- Three double reviews of the document: Claude about 3.3 M, 3.6 M and 3.0 M tokens; Codex about 0.65 M, 0.71 M and
  0.67 M. No code, so no Codex review and no Claude lenses.
- Two opus writer sub-agents for the page (the second: 154,275 tokens), one opus reader for the cost.
- Pre-commit gate runs: one per commit.

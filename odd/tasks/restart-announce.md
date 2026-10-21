# Restart announce

The lead pauses every session before it tells the owner to restart or update. Branch `rule/restart-announce`,
pull request 485; test runner `node --test`.

## Goal
Before the owner restarts or updates, the lead pauses every session at a safe point and only then says so in capitals.

## Why
His words of 2026-10-20 (the lead's transcript 908805db, lines 10294 and 10399) asked for the notice in capitals, with
everything paused first to give him time, and asked that it be in the harness, not only in a memory note.

## Done when
- `node --test bin/lib/manifest.test.mjs` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- The orchestrator skill's "The restart" holds the pause first and "YA PUEDES REINICIAR Y ACTUALIZAR!!!" after it.

## In scope / Out of scope
- In: the orchestrator skill (`bin/lib/manifest.mjs`), its test, the rule's declaration, source and list, the roadmap.
- Out: a sensor — the moment a restart is due and the words of the lead's reply are seen by no command.

## Constraints
- Every line of the skill is read on every turn — because the lead loads it each session.

## Ask me before
Nothing: the rule is his, and its reading is his to correct.

## Tasks
- [x] T1 (kind: build) "The restart" in the orchestrator skill, test first (f2980224); Codex's P2 fixed (75babe3e)
- [x] T2 (kind: build) `rule:restart-announce` declared with `js-harness rules change` (0b8a16da)

## Log
- L1 (2026-10-20) "Recuerdame avisarme cuando tenga que reiniciar y por favor escribemelo en mayusculas para pdoer saber
  algo asi: YA PUEDES REINICIAR Y ACTUALIZAR!!! y pausas todo para darme tiempo a hacerlo" — and: "por favor agregame lo
  de avisarme asi al harnes".
- L2 (2026-10-20) Double review of the skill text by two read-only readers; their findings folded into f2980224.
- L3 (2026-10-20) gentle-ai: f2980224..75babe3e assessed medium, review_due false (under_budget, 74 lines); no review due, none started.
- L4 (2026-10-20) Codex: e22ef3f..0b8a16d one P2 (the lead's own board row always reads working), fixed in 75babe3e;
  recheck 0b8a16d..75babe3 correct. Both recorded.

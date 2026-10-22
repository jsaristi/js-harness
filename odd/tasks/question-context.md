# question-context

Branch `rule/question-context`, from main. One pull request. Runner: `node --test`.

## Goal
Every question to the user opens with what it is for: the work it serves and what its answer changes.

## Why
He runs several works at once and answers from his phone. He took Pregunta 44, an onboarding question from the static-site trial, for the backup work, and answered it by asking what it was for.

## Done when
- `node --test bin/lib/manifest.test.mjs` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- The orchestrator skill's "Questions to the user" and the work session's line that records a question both say it.

## In scope / Out of scope
- In: `bin/lib/manifest.mjs` and its test, the rule's declaration (`bin/lib/rules-data.mjs`, `docs/RULES.md`, `docs/rule-sources.json`).
- Out: a sensor that checks a question's text — a question's purpose is prose the lead writes, and no command can tell whether it is clear.

## Constraints
- The rule is declared with `js-harness rules change` — because only one rule change may be open at a time, and the declaration binds its phrases to the file.

## Ask me before
Nothing: he asked for it in his own words.

## Specs
- S1. His words (session 908805db, line 18198): "Siempre que me hagas un pregunta Dime para que es para yo tener contexto de que responder y poder responder bien, ademas metelo al protocolo del harnes como creas que debe ir".

## Tasks
- [x] T1 (kind: build) S1: the two skill lines and their test, in 51b3a272; the rule declared in 2c712217. Route: inline.

## Log
- L1. 2026-10-22, his request, quoted in S1.
- L2. 2026-10-22, the slice 51b3a272..2c712217 rebased onto main f1f9e17 (unpublished, so the merges of main fell out). gentle-ai: medium, not due (under_budget); the slice is this pull request.
- L3. 2026-10-22, Codex on f1f9e17..2c71221 (69,980 input tokens): "the patch is correct (confidence 0.96)", no findings, recorded.

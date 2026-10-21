# Report table

The lead's status report shows each section that holds items as a table. Branch `rule/report-table`; test runner
`node --test`.

## Goal
When the owner asks what was done, the lead answers with tables, one row an item, never a list or a paragraph.

## Why
His words of 2026-10-21 (the lead's transcript 908805db, line 13882) asked for a table whenever he asks what was done,
and asked that it be a protocol in the harness.

## Done when
- `node --test bin/lib/manifest.test.mjs` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- The orchestrator skill's "The status report" answers "what you have done" and asks for each section as a table.

## In scope / Out of scope
- In: the orchestrator skill (`bin/lib/manifest.mjs`), its test, the rule's declaration, source and list, the roadmap.
- Out: a sensor — the shape of the lead's reply is chat text no command sees before it is sent.

## Constraints
- Every line of the skill is read on every turn — because the lead loads it each session.

## Ask me before
Nothing: the rule is his, and its reading is his to correct.

## Tasks
- [x] T1 (kind: build) inline: the table line in "The status report", test first: RED 1 failing, GREEN 183 pass (6ac59189)
- [x] T2 (kind: build) inline: `rule:report-table` declared with `js-harness rules change` (366cfb6f)

## Log
- L1 (2026-10-21) "Muéstrame siempre una tabla . Hazme 'hazlo como protocolo dentro del arnés . Cuando me muestres
  siempre que te pida qué has hecho".
- L2 (2026-10-21) gentle-ai: 545f5ab..366cfb6f assessed medium, review_due false (under_budget); no review due, none
  started.
- L3 (2026-10-21) Codex: 545f5ab..366cfb6 correct (confidence 0.97), no findings; recorded.

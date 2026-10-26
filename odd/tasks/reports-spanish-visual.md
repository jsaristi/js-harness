# reports-spanish-visual

Branch `rule/reports-spanish-visual`, from main (fcc137b). One pull request. Runner: `node --test`.

## Goal
Declare the user's rule that what they read to understand or decide reaches them in Spanish as a graphic, didactic page, and write it where sessions read it when they hand work over.

## Why
His words of 2026-10-26 (session 4b935d4a-cbb8-47fe-a059-22a7c5bae931, line 2645; the brief said 2643, which is the queue entry of the same message): "Siempre damela en español y que sea grafica y didactica osea que pueda entender visualmente". He wrote it right after the lead sent him the 773-line English `docs/proposals/harness-diet.md`.

## Done when
- `npm run check` exits 0
- `js-harness rules reports-spanish-visual` prints the rule with his words
- `node --test bin/lib/protocols-skill.test.mjs` exits 0, with the new handoff line asserted

## In scope / Out of scope
- In: the declaration (`bin/lib/rules-data.mjs`, `docs/rule-sources.json`, `docs/RULES.md`), one line in section 6 of `bin/lib/protocols-skill.mjs`, its test.
- Out: the orchestrator skill, which names no delivery format today; PRs 593 and 594.

## Constraints
- The protocols skill ships to every user and speaks of "the user", so its line says "their language"; the declaration's subject says Spanish.

## Ask me before
Nothing: a rule of his, briefed by the lead.

## Tasks
- [x] T1 (kind: build) declare the rule and write its phrase in the handoff protocol, in 0610ee74. Route: inline.

## Log
- L1. 2026-10-26, the brief: cement that anything he reads to understand or decide reaches him in Spanish and as a graphic, didactic page, never a raw English markdown file; repo artifacts stay English and the source.
- L2. 2026-10-26, the test written first and seen failing (`actual: false`); then 15 of 15 pass in `bin/lib/protocols-skill.test.mjs`; `npm run check` passed. gentle-ai on 0610ee74: medium, not due (under_budget, 36 lines); the slice is this pull request. Codex on fcc137b..0610ee7 (64,787 input tokens): "the patch is correct (confidence 0.93)", no findings, recorded. Memory pointer `reports-spanish-visual.md` names `rule:reports-spanish-visual`.

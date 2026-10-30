# rule-live-board

Branch `rule/live-board`, from main (58f540e, with PR 598 landed). One pull request. Runner: `node --test`.

## Goal
Declare the user's rule that the harness never works as a black box: work sessions write each event as a notice, the lead sends the record to the live board, and every reply of the lead points to it.

## Why
His words of 2026-10-27 to the lead (session e41d1e8d-8264-45a4-b16c-f9279f7b6076, lines 4186, 4325 and 4409), each checked with `js-harness sessions --quote`. The rule first rode in PR 598 (f0744431) and was reverted there (18d5f3c1): the merge door takes a change to `bin/lib/rules-data.mjs` only from a `rule/` branch, and Codex found the skill text would tell the lead to run `js-harness sessions live` before main had it. PR 598 landed the command first; this branch brings the rule after it.

## Done when
- `npm run check` exits 0
- `js-harness rules live-board` prints the rule with his words
- `node --test bin/lib/manifest.test.mjs` exits 0, with the new skill lines asserted

## In scope / Out of scope
- In: the declaration (`bin/lib/rules-data.mjs`, `docs/rule-sources.json`, `docs/RULES.md`), made with `js-harness rules change live-board`; the two skill lines in `bin/lib/manifest.mjs` and their test, the same text as f0744431.
- Out: the scheduled push, the heartbeat hook and Spanish notices, which stay proposed until he says yes (odd/tasks/live-board.md).

## Constraints
- The declaration is byte for byte the one f0744431 added to `bin/lib/rules-data.mjs`; only its source now carries all four checked quotes.

## Ask me before
Nothing: a rule of his, briefed by the lead.

## Tasks
- [x] T1 (kind: build) declare the rule and write its lines in the skills, in 7a2a9dd8. Route: inline.

## Log
- L1. 2026-10-27, the lead's order: "After I merge 598, recreate rule/live-board from the new main with `rules change`: same declaration, the four checked quotes, and the manifest text. Then the gate, Codex and the PR."
- L2. 2026-10-27, `js-harness rules change live-board` (dry run first) wrote the declaration, its source and RULES.md; the manifest text and its test are f0744431's, applied after. Compared with f0744431, the lines added to `bin/lib/rules-data.mjs`, `docs/RULES.md`, `bin/lib/manifest.mjs` and `bin/lib/manifest.test.mjs` are the same; `docs/rule-sources.json` adds the two quotes f0744431 lacked (line 4186's first and line 4409). `node --test bin/lib/manifest.test.mjs`: 192 of 192; `npm run check` passed. gentle-ai on 7a2a9dd8: medium, not due (under_budget, 69 lines); the slice is this pull request.
- L3. 2026-10-27, Codex on 58f540e..7a2a9dd: the patch is correct (0.94), "the referenced command and notice kinds already exist", no findings, recorded (125,034 input tokens, 27 s).
- gentle-ai on `7a2a9dd8`: medium, not due (under_budget); Codex covers it in its record of 58f540e..7a2a9dd.
- L4. 2026-10-27, closed: PR 600 landed, main 58f540e to 4d85fa3, green here and on CircleCI; the relief line confirms rule:live-board.

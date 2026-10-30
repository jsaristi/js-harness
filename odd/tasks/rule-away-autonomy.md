# rule-away-autonomy

Branch `rule/away-autonomy`, from main (f21f305). One pull request. Runner: `node --test`.

## Goal
Declare the user's rule that once he says he leaves the lead alone or will be away, the lead asks nothing and seeks no permission until he is back, and retire the rule ask-before-away, whose ask before he leaves was that permission.

## Why
His words of 2026-10-27 to the lead (session 0f71b2c6-cbce-43ca-a031-276a4b2c381f, line 1478), checked with `js-harness sessions --quote`: "no me pidas permiso y que voy a estar ausente si te digo que te dejo solo debes tener la mayor autonomia". He wrote it in answer to the lead's reply at line 1406, which closed with what waited for him: tests of his, an approval of the board's push every 15 minutes, and a spend for S1's measurements above a few dollars.

## Done when
- `npm run check` exits 0
- `js-harness rules away-autonomy` prints the rule with his words
- `js-harness rules ask-before-away` prints it retired, with away-autonomy as its successor
- `node --test bin/lib/manifest.test.mjs` exits 0, with the new skill lines asserted and the retired one asserted gone

## In scope / Out of scope
- In: the declarations (`bin/lib/rules-data.mjs`, `docs/rule-sources.json`, `docs/RULES.md`), made with `js-harness rules change`; the orchestrator skill's text in `bin/lib/manifest.mjs` and its test.
- Out: the code that still prints "ask now" or "repeat an open question" with no away state: `askingRule` in `bin/lib/sessions.mjs` (15 minutes after his last message) and `bin/resume.mjs` lines 405, 408 and 448. The skill text now says that this rule comes before them while he is away; making the code read an away state is a later change. Also out: CLAUDE.md, whose "Working with Sebastián" has no away text (searched for `away`, `leave`, `ausent`); the memory notes that name the rule ask-before-away (outside the repository, the lead's to repoint); the charter at the head of the lead's relief file.

## Constraints
- His words name no limit and widen none: what his standing rules keep his is named by its homes (the project's CLAUDE.md or AGENTS.md, the charter, the permit relay), never copied as a shorter list.

## Ask me before
Nothing: he is away and said not to ask him; a rule of his, briefed by the lead.

## Tasks
- [x] T1 (kind: build) declare away-autonomy and write its skill text, in 56efa3f8. Route: inline.
- [x] T2 (kind: build) retire ask-before-away and remove its line, in 238ee185. Route: inline.

## Log
- L1. 2026-10-27, the lead's brief for JH 63: apply his words of line 1478 with `js-harness rules change`, checking the rule ask-before-away, `rule:lead-charter` and any skill text that makes the lead ask or seek permission while he is away; the lead's reading to check against his words, writing only what they support.
- L2. 2026-10-27, the reading checked against his words. They support: ask nothing and seek no permission from the reply where he says he leaves until he is back; spend a planned step needs (the reply he answered held a spend for his yes). They name no limit, so the limits are not his words of today: they are what his standing rules already keep his, named by their homes, and they wait with no question, which is what his words do support. The trigger takes "or will be away": he linked the two ("no me pidas permiso [ya] que voy a estar ausente"), and his words of 2026-10-11 named both.
- L3. 2026-10-27, double review (rule:double-review, as D5 scopes it: a change of the charter, reported). Reader A (attacks the claims), two blockers: the draft's list of what stays his (credential, security settings, an irreversible act outside the project) was shorter than the permit relay's (`bin/lib/manifest.mjs`, the card line) and the charter's, and the reading's "not widened" was false; should-fix: quote the reply of line 1406 for the spend, make the card line defer, keep the aim of his 2026-10-11 ask (what only he can give is said as a fact), widen the trigger to "will be away", say that a work session's question of his is held and never answered for him; nit: the test pin. Reader B (what is missing), two blockers: the test at `bin/lib/manifest.test.mjs` pinned the retired line, and the line "never answer a question for the user" needed the held-question clause; should-fix: the card texts route to the question tool "that turn", a step outside the charter while he is away was neither allowed nor held, the away state was not written to the relief file, the code's "ask now" (askingRule, resume) has no away state, the plan's limits on spend. Taken in: all, except the code of askingRule and resume, out of scope above, which the skill text now ranks below this rule. Not guaranteed: the sessions the lead opens while he is away run in his default permission mode (`js-harness sessions start` takes none), which this rule does not change.
- L4. 2026-10-27, gate. The first commit failed on CI once: `bin/conventions-structure.test.mjs` found `bin/lib/manifest.mjs` at 2160 lines over its ceiling of 2159; a blank line went in T1 and came back in T2, so the module stays at 2159. Both commits then passed `npm run check` (16 rows).
- gentle-ai on `56efa3f8` and `238ee185`: medium, not due (under_budget, 54 and 41 lines); Codex covers both in its record of f21f305..238ee18.
- L5. 2026-10-27, Codex on f21f305..238ee18: the patch is correct (0.88), no findings, recorded (75,528 input tokens, 29 s).

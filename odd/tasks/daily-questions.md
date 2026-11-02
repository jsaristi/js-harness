# JH 130 · The daily list: reversible questions decided by their recommended option

Locator: `odd/tasks/daily-questions.md` · Branch: `rule/daily-questions` · Delivery: one pull request, the rule
change and the smallest mechanism it needs · Test runner: `node --test`

## Goal
A reversible question (one a commit undoes, that spends nothing, publishes nothing and touches nothing of his) is
decided by its recommended option, recorded, and reaches him on one list a day where he can change any; every other
question of his is still asked one at a time.

## Why
He answered question 156 of the re-plan's E3 with "Sí, lista diaria" (L1): about 8 questions a day reach him and each
holds its work until he answers (the question's own premise). The analysis's E4 names the risk this carries, a
decision of his hidden by fewer questions, and its way back, the daily list where he reverses any default; so the
list is part of the change, not a report beside it.

## Done when
- `js-harness contract check odd/tasks/daily-questions.md` exits 0
- `js-harness rules check` exits 0
- `js-harness rules questions-one-place` exits 0
- `js-harness rules coverage --strict` exits 0
- `node --test bin/notify.test.mjs bin/lib/sessions.test.mjs` exits 0
- the first daily list reaches him through the lead, and the Log records how many questions it held and how many he
  changed

## In scope / Out of scope
- In: this document; `rule:questions-one-place` and its text in the orchestrator skill (`bin/lib/manifest.mjs`); the
  question record of `js-harness notify` and the board's `Open questions` section (`bin/lib/sessions.mjs`), for the
  decided-by-default record and the daily list; their tests; the rule's controls in
  `bin/lib/rules-coverage-data.mjs`; `CLAUDE.md`'s "Asking him" line, if the rule's new text needs it.
- Out: `bin/lib/protocols-skill.mjs` section 1 and `rule:double-review`, which JH 126 is changing in worktree
  harness-alignment (the brief); a line of section 1 that this rule needs changed waits for JH 126's pull requests
  to land, and this branch rebases on main then. `rule:owner-decisions` keeps its list: a reversible question is
  still his, put to him on a list instead of one at a time (L3).

## Constraints
- A rule of his changes only with words he typed (`bin/lib/rules-change.mjs:233` refuses a tapped answer), and "Sí,
  lista diaria" was tapped — so the rule commit waits for his typed words, or for question 150's "a tap counts as
  his" if he decides it first (L2). Nothing else here waits for it.
- His roadmap decisions, spend, publishing and anything irreversible stay asked one at a time — his own option text.
- One gate at a time (`js-harness gate`) — because JH 126 runs beside this session.
- The plan passes `rule:double-review` before code; its Codex read spends his weekly limit, read on
  `js-harness codex-meter` first and said with its cost.

## Ask me before
His typed acceptance of the daily list (through the lead, never asked here); any reading of "reversible" wider than
his option text; anything that changes `rule:owner-decisions`.

## Depth pass
- 1. Method: decision triage as a delegating manager runs it (the one-way and two-way door split): a decision that
  can be walked back is taken by the default the delegate recommends and reported in a batch the owner reviews,
  where any can be reversed; a one-way door goes to the owner before it is taken. Its standard: the class is decided
  by a test written before the case (what undoes it), not by the delegate's judgment of importance, and the batch
  is complete, so nothing decided is invisible. The smallest change that meets it: one line in the rule where
  questions are asked, a field on the question record that says what undoes it, and one list the lead already
  reads. The search of `rule:reuse-first`: `js-harness rules` (`questions-one-place`, `question-context`,
  `owner-decisions`; no rule decides a question by default); `js-harness notify --kind question` records every
  question with its options (`bin/notify.mjs:305`); the board's `Open questions` section and its `to ask:` line
  (`bin/lib/sessions.mjs`, tests at `bin/lib/sessions.test.mjs:3755`); `js-harness template ask <n>` builds the
  question tool's card (`bin/template.mjs:338`); `rule:growth-limit`'s Later list is a place for work that waits,
  not for decisions taken, so it is not reused.
- 2. Raw material: the four answers, `js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f 50902`
  (2026-11-02T09:15:22Z, tapped "Sí, lista diaria"; the question's text, the lead's, quoted in L1); the channel's
  question record, `C:\Users\Oficina\.js-harness\channel\D--js-harness.jsonl`, 157 questions, by day 2 to 31
  (2026-10-22 to 11-02); the refusal of a tap, `bin/lib/rules-change.mjs:233`; the precedent of a tapped answer
  sent back for typed words, `odd/tasks/double-review-alignment.md`, L9; the analysis's E3 and E4 rows,
  `odd/tasks/replan-analysis.md` on `origin/worktree-replan-analysis`.
- 3. The bar: excellent here means no decision of his is taken without his seeing it within a day; the class is
  read from what undoes the change, written on the question, not judged after; a default he changes is undone by
  the session that took it; and his words are the rule's source.
  spec 1: `js-harness rules questions-one-place`: exits 0; the daily list is none, new behaviour.
  spec 2: `node --test bin/notify.test.mjs`: passes today; a question recorded as reversible and closed by its
  recommended option is none, new behaviour.
  spec 3: `node --test bin/lib/sessions.test.mjs`: passes today; the daily list on the board is none, new behaviour.
  spec 4: left out because his change to a listed default is an answer, which `notify --kind answer` already records.
- 4. Refutation: if almost no question were reversible, the list would save him nothing and the request would not
  hold. The 41 questions recorded from 2026-10-30 to 11-01 were read by their first 170 characters (a node one-liner
  over the channel record in this session, `kind: question` and `at` in that span, its count 41) and classed by the option text's test: 6 reversible by a
  commit with no spend, publishing or anything of his (the engram plugin's `doctor` row, PR 702; the TUI fixes, PR
  596; the Codex daemon's `doctor` row; the status line under 3P; which orchestrator duties get a check; JH 122's
  third check), 35 not (his rules and roadmap, his machine, settings and sidebar, his projects, GitHub, deletions,
  spend). So about 1 in 7, 2 a day over those three days; a classification by this session, an estimate. It holds,
  with a small gain; the larger share of what he answers stays asked by his own option text.
  Verdict: supports
- 5. Request: record his daily list in `rule:questions-one-place` from his typed words: a question whose answer a
  commit undoes, that spends nothing, publishes nothing and touches nothing of his (his machine, settings, projects,
  accounts, rules or roadmap decisions), is recorded with what undoes it, decided by its recommended option at once,
  and put to him on one list a day through the lead, where any can be changed and is then undone; every other
  question goes on as today, one at a time. Build the smallest record and list for it on `notify` and the board.
  Expect about 1 in 7 questions to move to the list.
  Adds: none

## Specs
1. Reversible questions are decided by the recommended option and listed to him once a day, where he can change any
   (L1, his tapped option "Sí, lista diaria" to: "Recomiendo que las preguntas reversibles (las que se deshacen con un
   commit y no gastan, no publican ni tocan algo tuyo) se decidan con la opción recomendada y te lleguen en una lista
   una vez al día, donde puedes cambiar cualquiera").
2. A question decided by default is recorded with what undoes it, so the list is complete and a change of his can be
   undone (L1, "donde puedes cambiar cualquiera").
3. The list reaches him once a day through the lead, beside the open questions (L1, "en una lista una vez al día").
4. Irreversible questions, spend, publishing and his roadmap decisions are still asked one at a time (L1, "Las
   irreversibles, el gasto, publicar y tus decisiones de la hoja de ruta se te siguen preguntando una a la vez, como
   hoy").

## Tasks
- [ ] T1 (kind: design) The record and the list: the question field that names what undoes it, the close by default,
  the board's daily list and the lead's line that sends it (specs 2, 3). Route: inline. Commit: this document.
- [ ] T2 (kind: verify) The double review of T1's plan (`rule:double-review`), its cost said first. Route: two blind
  readers.
- [ ] T3 (kind: build) The record and the list, tests first (specs 2, 3). Route: inline.
- [ ] T4 (kind: build) `js-harness rules change questions-one-place` from his typed words (specs 1, 4). Route:
  inline; waits for his words (L2).

## Log
- L1 2026-11-02 — his request, tapped: "Sí, lista diaria" (the lead's transcript `0f71b2c6`, line 50902,
  2026-11-02T09:15:22Z, read with `js-harness sessions --quote`), to the lead's question 156: "Para js-harness
  (reajuste de F8, análisis de JH 128): hoy te llegan unas 8 preguntas al día, y cada una frena su trabajo hasta que
  respondes. Recomiendo que las preguntas reversibles (las que se deshacen con un commit y no gastan, no publican ni
  tocan algo tuyo) se decidan con la opción recomendada y te lleguen en una lista una vez al día, donde puedes cambiar
  cualquiera. Las irreversibles, el gasto, publicar y tus decisiones de la hoja de ruta se te siguen preguntando una
  a la vez, como hoy. Un sí cambia la regla de las preguntas con tus palabras. Un no deja todo como hoy: cada
  pregunta se te hace a ti." Options shown: "Sí, lista diaria" | "No, pregúntame todo".
- L2 2026-11-02 — decision: the rule commit waits. `rule:questions-one-place` is his (`owner: sebastian`), and
  `quotationOf` refuses a tapped answer (`bin/lib/rules-change.mjs:233`); the same case went back to him for typed
  words in `odd/tasks/double-review-alignment.md`, L9. The lead was told at 09:19Z (`notify --kind waiting`); the
  design and its tests go on, since they read no rule.
- L3 2026-11-02 — decision: `rule:owner-decisions` keeps its list. The question says the reversible ones are still
  his to change ("donde puedes cambiar cualquiera"), so what changes is how they are put to him, which is
  `rule:questions-one-place`'s; section 1 of the protocols skill ("One decision a question, one question at a
  time") is JH 126's file today, and a line there waits for its pull requests to land.
- L4 2026-11-02 — the double review of T1 waits for his typed words, since they may reshape the rule it serves; its
  Codex read is not spent before then.

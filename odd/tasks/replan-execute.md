# JH 129 · Carry out the re-plan: adjust F8, the growth limit first

Locator: `odd/tasks/replan-execute.md` · Branch: `rule/growth-limit` (started as `worktree-replan-execute`) ·
Delivery: one pull request, the roadmap's record, the rule and its control (L8) · Test runner: `node --test`

## Goal
The re-plan he adopted on 2026-11-01 is in force: the roadmap records it, his growth limit is a rule with a command
that says whether the week is red, and the outside outcome and S2 are routed to the lead with what each needs.

## Why
JH 128's analysis (`odd/tasks/replan-analysis.md`, section E) found the plan grows faster than it closes and that the
harness has built nothing outside itself; it recommended adjusting F8, not restarting. He adopted it (L1). The two
limits tried before held nothing because nothing measured them (the analysis, A2), so this one is computed by a
command, not judged by a session.

## Done when
- `js-harness contract check odd/tasks/replan-execute.md` exits 0
- `js-harness rules check` exits 0
- `js-harness rules growth-limit` exits 0
- `node --test bin/lib/progress-pace.test.mjs bin/progress.test.mjs` exits 0
- `js-harness rules coverage --strict` exits 0
- on 2026-11-08 the last line of `js-harness progress --pace` is read and written in the Log: the result of the
  analysis's E2 step 1 ("closed at or above added" over the next seven days), whatever it says; a week still red on
  the rule's review day, 2026-11-15, goes back to him with the counts

## In scope / Out of scope
- In: `docs/ROADMAP.md`; this document; `bin/lib/progress-pace.mjs`, `bin/progress.mjs` and their tests for the
  week's line; the lead's routing line in `bin/lib/manifest.mjs`; the rule's declaration, source and controls
  through `js-harness rules change` and `bin/lib/rules-coverage-data.mjs`.
- Out: question 150 and every rule JH 126 holds (the brief); his projects, until he names one (the brief, item 3);
  S2's removals, which need every writer quiesced while JH 126 runs, and his answer at each removal; the changes of
  the analysis's E3 that touch a decision of his (L2), each his.

## Constraints
- His words are quoted as written and only what he was asked is recorded as his — because a decision of his changes
  only with his words (`rule:owner-decisions`), and the lead's question named F8 kept and the growth limit alone.
- One gate at a time (`js-harness gate`) — because JH 126 runs beside this session.
- Codex's weekly limit is read (`js-harness codex-meter`) before each run and its cost said; his reset credit is
  never spent without his word — the brief.

## Ask me before
His choice of the project and the feature for the outside outcome (through the lead, never asked here); S2's start
and each of its removals; any reading of the limit wider than what the lead asked him (L2).

## Depth pass
- 1. Method: scope control as a delivery lead runs it on a plan whose arrivals outrun its departures (Kanban's
  "stop starting, start finishing", Little's law): measure arrivals against departures over a fixed window, make the
  state visible where work is started, give an expedite class (a break of what shipped) a way past the limit, and
  keep what waits on one list instead of losing it. The smallest change that meets it: one rule in prose where large
  work starts, and one line of an existing command that computes the state. The search of `rule:reuse-first`:
  `js-harness rules` (73 rules; no rule limits growth; the roadmap's Decided row "First version's scope" holds his
  "No, sigue entrando", `docs/ROADMAP.md:75`); `progress --pace` already counts closed and added a day
  (`bin/lib/progress-pace.mjs:175`, `paceOf`), so the week's state is a sum and a comparison on it, not a new command;
  section 9 of the protocols skill (`bin/lib/protocols-skill.mjs`) is where a session reads before large work.
- 2. Raw material: his answer, typed, `js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f 48080`
  (2026-11-01T18:44:12Z); the lead's question before it, the same transcript, line 48066 ("¿adoptas el ajuste, es
  decir, seguir con F8 y poner el límite al crecimiento?", with "Mientras la semana esté en rojo, no entraría trabajo
  nuevo, salvo arreglos y pasos de F8"); the page he read, https://claude.ai/artifact/1EPj6FTbsB6C6n9aAT5iyJ, step 1
  ("Un sí cubre registrar la regla con tus palabras escritas y que el líder detenga lo nuevo mientras la semana esté
  en rojo. No frena arreglos de lo que ya funciona ni los pasos de F8. Un no deja todo como hoy."); the analysis's C2
  and E2 (`odd/tasks/replan-analysis.md`); `js-harness progress --pace` today; how a source of his words is checked,
  `bin/lib/rules-change.mjs:227-276` (typed, not tapped, not pasted, timed; a `reading` and where he `accepted` it).
- 3. The bar: excellent here means his decision recorded in his words and no wider than he was asked; the limit's
  state printed by a command so no session judges it; a rule that a session meets where it starts large work; and
  what he still decides named, not decided.
  spec 1: `js-harness progress`: exits 0 today; the record itself is none, new behaviour, proven by its two readers.
  spec 2: `js-harness rules growth-limit`: none, new behaviour (no such rule today).
  spec 3: `node --test bin/lib/progress-pace.test.mjs`: none, new behaviour (no week line today; a red and a green
  week are tested).
  spec 4: left out because it is a proposal to the lead, proven by its notice on the channel.
  spec 5: left out because S2 is its own F8 step with its own document; this feature routes it.
- 4. Refutation: if his words were not enough for `rules change`, the line would be a tap, a paste, or hold no time.
  `js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f 48080` prints "sent by the user" with its time and
  no answered option, so `quotationOf` takes it; a confirmation of the question before it is a source the register
  already holds (`codex-review-floor`, "Sí, quedan los tres números y el piso", whose reading cites the question it
  confirms). If the limit were not needed now, the last seven days would be green: `js-harness progress --pace`
  gives, 2026-10-26 to 11-01, closed 315 and added 353, so the week is red the day the rule lands.
  Verdict: supports
- 5. Request: record in the roadmap, with his words, that F8 stays the spine, that his growth limit replaces "No,
  sigue entrando", and that the outside outcome is part of the plan with its project and feature still his; record
  the limit as a rule of his, sourced from line 48080 read as a yes to the lead's question at line 48066, with the
  page's wording of what a yes covers; have `progress --pace` print the week's state; route the outside outcome and
  S2 to the lead. It changes none of his other decisions.
  Adds: none

## Specs
1. The roadmap records the adjustment: F8 kept, the growth limit, the outside outcome, quoting line 48080 (the brief,
   item 1; his words: "Listo entonces continuemos y reactives todo para hacer le plan").
2. The growth limit is a rule of his, recorded by `js-harness rules change` from his typed words (the analysis, E2
   step 1; the lead's question: "seguir con F8 y poner el límite al crecimiento").
3. A command says whether the week is red, so the limit is computed (the analysis, C2: "a week whose
   `progress --pace` shows more added than closed stops new work").
4. The outside outcome is proposed to the lead with the project and why; nothing in his projects starts without his
   choice (the brief, item 3).
5. S2 is routed as planned (the analysis, E2 step 3).

## Tasks
- [x] T1 (kind: docs) The roadmap's record of the adjustment, and this document (spec 1). Route: inline. Commit:
  234f0f75, then the answers to the review.
- [x] T2 (kind: verify) The double review of the rule's text and the record (`rule:double-review`): two blind
  read-only readers (spec 2). Route: two Claude sub-agents. Result: L6.
- [x] T3 (kind: build) The week's line in `progress --pace`, its tests first (spec 3). Route: inline. Commit:
  2b182296.
- [x] T4 (kind: build) The rule, by `rules change`, a value rule of this repository, and the lead's routing line
  (spec 2). Route: inline. Commit: 2b182296.
- [x] T5 (kind: docs) The outside outcome and S2 proposed to the lead (specs 4, 5). Route: inline, `notify`: question 151 and the note of 2026-11-01T19:30:33Z.

## The rule, as recorded

`rule:growth-limit`, his (`owner: sebastian`), of scope `repository`, review day 2026-11-15; read it whole with
`js-harness rules growth-limit`. Its value is the exemption in the lead's words, "a fix or a step of F8" ("salvo
arreglos y pasos de F8"); its subject says the rest: while the week is red the lead opens no new work here but that,
writes the rest in the roadmap's Later list with its source, and his own word that something goes now opens it.

Where it acts:
- `js-harness progress --pace` ends on the week's line: the last seven whole days, today left out, red when their
  open steps grew. It counts each file's open steps after each commit less those before, so a reworded step, a moved
  document or one landed finished grows nothing (L6). Where the rule holds, the red line names the value. Seven is a
  week, not a tunable: a constant, `WEEK_DAYS`, beside `PACE_DAYS`. A window of under eight days prints no week.
- The lead's routing, in the orchestrator skill (`bin/lib/manifest.mjs`, "When the user asks for something"): where
  the rule holds, read that line before opening new work; while red, open only what it names, write the rest in
  Later and tell him it waits unless he says it goes now; a session already open goes on with its own tasks.
- Its controls (`bin/lib/rules-coverage-data.mjs`): the week's test with a planted break, and the lead's line.

His words, its reading and where he accepted it are in `docs/rule-sources.json`. Counting open steps rather than
"más agregados que cerrados" is this session's precision, said in the reading as his to correct.

Today's line (`node bin/js-harness.mjs progress --pace`, 2026-11-01): "Last 7 days 2026-10-25 to 2026-10-31: closed
315  reopened 0  added 352  removed 19; the open steps grew by 19: red, new work waits but a fix or a step of F8
(rule:growth-limit)".

## Log
- L1 2026-11-01 13:44 local — his answer, typed (the lead's transcript `0f71b2c6`, line 48080, read with
  `js-harness sessions --quote`): "Listo entonces continuemos y reactives todo para hacer le plan". It answers the
  lead's question at line 48066: "Te pregunto, después de leer la página: ¿adoptas el ajuste, es decir, seguir con F8
  y poner el límite al crecimiento?"
- L2 2026-11-01 — what his yes covers, read by this session: the lead's question named F8 kept and the growth limit,
  and its message described the limit ("Mientras la semana esté en rojo, no entraría trabajo nuevo, salvo arreglos y
  pasos de F8"); the page's step 1 said what a yes covers and what a no means. The brief adds the outside outcome as
  part of the adjustment; its project and feature are his. The C2 changes the question did not name (1.0.0 and
  #4036, S5c-b, the daily list, a tap counting) are not recorded as his here; the "Later" list he reads once a week
  (C2) was not on the page, so the rule keeps only a place where what waits is written.
- L3 2026-11-01 — his words are enough for `rules change`: line 48080 is typed, timed and no tap
  (`bin/lib/rules-change.mjs:227-245`), and a typed confirmation of the question before it has a precedent in the
  register (`codex-review-floor`). No question to the lead is needed.
- L4 2026-11-01 — JH 128's branch (a179007a, documents only, no pull request) merged into this one, so the roadmap's
  record points at an analysis that lands with it.
- L5 2026-11-01 13:57 local — question 151 recorded for the lead: which project for the outside outcome,
  abogadaclaudiajimenez (recommended: it has code, `astro build` and `astro check`, and a list in `docs/roadmap.md`),
  plataforma-preproyecto (documents of onboarding only, no commit since 2026-10-22), or not yet. Its text says a merge
  to abogadaclaudiajimenez's `main` deploys the site, so the merge stays his. Its roadmap is stale: items 3 and 6 are
  done in the code (`src/styles/global.css:117-129`, `src/pages/404.astro`), so the feature's options are read from
  the code, not the list.
- L6 2026-11-01 — the double review (`rule:double-review`), two blind Claude readers on 234f0f75. The claims reader,
  4 of 10 (122k tokens), each answered: (1) added against closed is mostly bookkeeping: a step born checked counts
  both, a reworded roadmap step without an ID counts one removed and one added (12 times that week), F8's planning
  and each document's last open task add: fixed, the week counts each file's open steps before and after each
  commit, with tests for a rewording, a move and a document landed finished; (2) the text was wider than his words
  on F8 and narrower on fixes, three exemption texts: fixed, the value is his "a fix or a step of F8" and the roadmap
  cites the rule; (3) section 9 of the protocols skill ships to every project and is read after the lead opens a
  session: fixed, a value rule of scope `repository` and a line in the lead's routing; a refusal in `sessions start`
  was not built, since `start_session` opens sessions outside it (`rule:sessions-open-in-sidebar`); (4) the outcome
  read as adopted while E3's rows were not: answered in Next, his yes covers the adjustment where it changes no
  recorded decision of his; the project is his, question 151; (5) the precedent is weaker, his words name nothing:
  said in the reading, with the count's precision as his to correct; (6) the contract missed E2's measure: added for
  2026-11-08; (7) today's partial day could flip the line: the week leaves today out. The missing-things reader,
  5 of 10 (101k tokens), each answered: (1) nobody acts where work enters: the lead's routing line, and the week's
  line every `progress --pace`; a heartbeat line was not built, the routing line is read when work enters; (2) three
  exemption texts: one, the rule's value; (3) no measure of success: the 2026-11-08 reading, the review day
  2026-11-15 and a red week then goes back to him; (4) the outcome blocked by the exemption: it is an F8 step in
  "F8 plan"; (5) work in flight and his requests: a session already open goes on with its own tasks, and his word
  opens anything; (6) two Later lists: one, the existing list in Next, renamed; (7) E3's rows without an owner: the
  lead asks each after question 151, listed in Next, "Releases before 1.0.0" added; (8) "reactives todo" unread: L7;
  (9) the placeholder, the prose done-when and the citing task: fixed. Rejected: none. Not done: a `contracts`
  refusal of a new feature document while red, since an exemption would need a field every document declares, and
  the measure on 2026-11-08 says first whether the line is enough.
- L7 2026-11-01 — "reactives todo para hacer le plan" read as: start the sessions again to carry out the plan; the
  lead started this session from it. It opens nothing the limit holds, since carrying out F8 and its adjustment is
  the exemption.
- L8 2026-11-01 — one pull request instead of a docs PR first: the record cites `rule:growth-limit`, and `rules
  check` refuses a text naming an undeclared rule (its first commit did, and was fixed), so the record and the rule
  land together; the branch became `rule/growth-limit`, which `rules change` requires.
- L9 2026-11-01 — result against the depth pass: item 4 predicted the words suffice and the week is red; measured,
  `rules change` took line 48080 and the week is red by 19 open steps. Item 1's home, section 9, did not hold (L6).
- L10 2026-11-01 14:55 local — read before the feature question: `D:\plataforma-preproyecto` holds four files
  (`git ls-files`: `AGENTS.md`, `docs/FAILURES.md`, `harness.json`, `odd/tasks/onboarding.md`), one branch,
  `onboarding`, no `main` and no remote (`git branch -a`, `git remote -v`). Its onboarding has no pre-plan or
  roadmap (O2 to O6 open) and stopped at L14 on a question to him: whether the business exists already. So the
  question 151 promised, options from the project's roadmap, has no roadmap to draw from, and a pull request needs a
  remote first; the outside step's first unit there is to finish that onboarding, which starts with his answer.

## Next step
- State 2026-11-01 14:35 local: pull request #743 open and ready on `rule/growth-limit` (234f0f75, 2b182296,
  dad80c75, 28c0a708); Codex and the lenses cover every code commit; the gentle-ai slice review was not run.
- Question 151 answered: plataforma-preproyecto (2026-11-01T19:12:54Z, the lead's transcript `0f71b2c6`, line
  48234), recorded in the roadmap. Next, for the lead: the feature there, his choice, after its onboarding (L10); S2
  after JH 126 lands; the E3 rows one at a time; the week's line read on 2026-11-08; the rule reviewed on 2026-11-15.
- PR 743 landed (main 8d7a8ec); its last commit, 90ccf1b0, missed the land and travels as PR 744.

# JH 230 · alignment audit against the directives of 2026-11-18

Locator: `odd/tasks/alignment-audit.md` · Branch: `claude/alignment-audit-388faa` (worktree
`D:/js-harness/.claude/worktrees/alignment-audit-388faa`, cut from main `04b7ac53`) · Delivery: one documents-only
pull request, landed by the lead (JH ORQ) · Brief: miniplan 3 of JH PLAN, 2026-11-18 (side-session notes of JH ORQ,
`miniplan-003-alignment-audit.md`), amended the same evening after his "Listo quiero que lo alineemos todo" (L2).

## State
PR 921 is a draft (the lead's order), so no land takes it; it is un-drafted once his D-block decisions are in. The
cards go to him one at a time: this session records each as a question, the lead sends its number to JH PLAN, which
asks him, and the next is recorded only once the last is answered. Decided: D-b1 (question 364, L16), D-b2 (question
365, L18), D-c2 (question 367, L21; 366 withdrawn), D-c1 and with it D-a4 (question 370, L23), D-a7 (question 371, L24), D-a1 (question 372, L26; his typed line f5c3ee4d:7721 is the quote). Every card is answered.
No double review has run. Next: PR 921 stays a draft and the double
review does not run until the lead says so after the Codex weekly reset of 2026-11-23 23:45 local (Codex runs only
under 50% weekly until then, miniplan-009 Budget lines 31-33; the meter read 51%); then the read, then un-draft (L25). Slice C's `rules change` of senior-model waits for JH 234, for
`rule/plan-pre-prompt` (one open rule change at a time) and for the reset; nothing runs now.
The audit and the build plan are written; nothing is built.

## Goal
Every place of the harness that still contradicts the four directives of 2026-11-18 is named with its `path:line`,
and one build plan, in slices, aligns all of it.

## Why
He asked, in JH PLAN's chat, whether the whole harness is aligned with today's directives, because he thinks what
was done so far are patches (L1); then he ordered the whole change set built (L2). A list of places alone would
add more patches; the plan below removes and merges first (`AGENTS.md`: a stronger model needs a smaller harness).

## Done when
- `js-harness contract check odd/tasks/alignment-audit.md` exits 0
- `npm run check` exits 0
- The table below names, for each directive, every contradicting, half-saying or repeated place with `path:line`,
  and each item of miniplan 3's step 3 is marked verified, refuted or partly, with its evidence.
- A documents-only pull request is open and `js-harness notify --to orchestrator --kind ready --pr <n>` is sent.

## In scope / Out of scope
- In: this document only.
- Out: every source, rule and text: the audit changes nothing (miniplan 3, "Do not"). What JH 227
  (`rule/plan-pre-prompt`) and JH 229 (`rule/never-carry`) are building is named as in flight, not redone.

## Constraints
- Read-only on the harness — because miniplan 3 says the document is the only file written.
- Branch heads audited: main `04b7ac53`, `rule/plan-pre-prompt` `78896f7b` (the readers read `13ef86a1`; the one
  commit after it adds 10 Log lines only, `git diff --stat 13ef86a1 78896f7b`), `rule/never-carry` `b1a22448`.
  Rechecked before the pull request: `rule/plan-pre-prompt` is at `6c5dd963` (L22, the double review; `d164a8c0`
  rests the Plan's start on question 354; `2af13c1b` puts every question in the Plan's chat, L23) and
  `rule/never-carry` at `c3ef06fa`. Rows marked 227 below say where those commits already change them.
  Line numbers are on main unless a row says otherwise.

## Ask me before
Nothing from this session. His lines go, in one block (section "His to decide"), to the lead, which records them
and sends them to JH PLAN, which asks him in its chat (question 355).

## Depth pass
- 1. Method: a conformance audit against a written standard, in the way a standards body audits a codebase:
  each requirement traced to every place that implements or contradicts it, each finding with its location and
  its evidence kind (code, record, reproduced now), absence claims naming the search. The smallest change that
  meets it is the one that removes duplicates and contradictions before it adds any check.
- 2. Raw material: `CLAUDE.md:47`, `bin/lib/guard.mjs:174`, `bin/lib/stall.mjs:21`,
  `bin/lib/codex-review-allowance.mjs:104`; his words, transcript `f5c3ee4d` lines 4245 and 4329 (`js-harness sessions --quote`), and the
  directives' lines quoted in miniplans 1 and 2; the texts that steer sessions, `CLAUDE.md`, `AGENTS.md`,
  `bin/lib/protocols-skill.mjs`, `bin/lib/manifest.mjs`, `bin/lib/rules-data.mjs`; the checks, `bin/lib/reply.mjs`,
  `bin/lib/guard.mjs`, `bin/guard.mjs`, `bin/lib/stall.mjs`; the commands `stretch`, `notify`, `sessions`,
  `wait`, `template`, `codex-review`, `merge-queue`; `odd/tasks/plan-orchestrator.md` on main and on JH 227's branch;
  JH PLAN's record `plan-2026-11-18-away.state.md` (side-session notes of JH PLAN).
- 3. The bar:
  spec 1: `git grep -n "carries what he sends" main -- CLAUDE.md`: one hit, `CLAUDE.md:47` (not aligned today).
  spec 2: `git grep -c miniplan main -- bin/lib/manifest.mjs bin/lib/protocols-skill.mjs CLAUDE.md AGENTS.md`: no hit, exit 1 (no text that installs into a session names the Plan's role).
- 4. Refutation: the cheapest test that the harness is already aligned is spec 1 and spec 2 above, run now on main
  `04b7ac53`: the cut still "carries what he sends" and no installed text names a miniplan. Neither branch in
  flight touches `CLAUDE.md`, `AGENTS.md`, `protocols-skill.mjs` or `manifest.mjs`
  (`git diff --stat main...rule/plan-pre-prompt`, `git diff --stat main...rule/never-carry`).
  Verdict: supports
- 5. Request: one document with the table, the step 3 items marked, and one build plan in slices, cheapest and most
  removing first, slices with disjoint files marked as able to run side by side, and his lines in one block.
  Adds: none

## Specs
1. "quisiera saber si ahora con estas nuevas directivas ya todo el harness esta alineado a esto por que creo que lo
   que hemos hecho son parches" (L1): the table of every place that is not aligned.
2. "Listo quiero que lo alineemos todo" (L2): the build plan, all of it, with only his lines kept apart.

## The four directives
- D1. The Plan (Fable) is the lead's pre-prompt: one short miniplan per request, fixed shape; it runs nothing
  (miniplan 1; questions 347, 348, 353).
- D2. A session never makes him carry information between sessions (miniplan 2, the rule `sessions-send-themselves` (JH 229's, not yet declared on main)
  as JH 229 names it).
- D3. Nobody asks him whether to open a session a miniplan orders; one approval covers a whole piece of work
  ("No quiero que me pidas permiso para iniciar cada linea").
- D4. Fable is spent on judgment only: no relaying, no checking, no long chats.

Settled after the readers ran, by two questions the lead put after JH 227's double review (L6) found that both
points rested on taps against his typed lines:
- Question 354, "El Plan, con mi visto bueno (Recomendada)" (`f5c3ee4d` line 4422, tapped): the sessions a
  miniplan orders are started by JH PLAN on his yes in its chat and handed to the lead. This is the one exception to
  "runs nothing" in D1 and in miniplan 3.
- Question 355, "En el chat del Plan (Recomendada)" (`f5c3ee4d` line 4488, tapped): his questions during execution
  reach him in JH PLAN's chat. The lead records them and sends them; the Plan asks them and sends the lead his
  answers. JH PLAN's chat is the one place he works in; the Plan still runs and checks nothing. This reverses
  miniplan 1, step 4, which moved those questions to the lead's chat, and narrows D4's "no relaying": the Plan
  carries his questions and answers, nothing else.

## The table
States: **contradicts**, **half-says** (says part, or leaves the wrong reading open), **twice** (the same rule in
two homes), **aligned**. In flight: **227** = changed on `rule/plan-pre-prompt` (read at `78896f7b`, rechecked at `6c5dd963`); **229** = changed on
`rule/never-carry@b1a22448`; **229-planned** = in that branch's task document but not yet committed; **none**.
The change column names the slice of the build plan.

| # | Place | Today | State | In flight | Change (slice) |
|---|---|---|---|---|---|
| D2 | `CLAUDE.md:46-48` | a cut "carries what he sends in one code block ... where it goes" | contradicts | none | Remove the paragraph's cut rules from `CLAUDE.md`, keep protocol 2 as the one home, naming the rule `sessions-send-themselves` (JH 229's, not yet declared on main) (B) |
| D2 | `CLAUDE.md:43-48` against `bin/lib/protocols-skill.mjs:49-53` | the closing states and the cut written in both | twice | none | Same edit: `CLAUDE.md` names protocol 2 (B) |
| D2 | `bin/lib/protocols-skill.mjs:49` | "Cut: what the user sends to open the next session" | half-says (the next session may exist) | 229-planned (T2, "its phrases in the skill") | "a cut: only a chat no session can open, or a command on his machine" (B) |
| D2 | `bin/lib/protocols-skill.mjs:50` | "Text the user copies sits in one code block" | half-says | 229-planned | Same edit (B) |
| D2 | `bin/lib/manifest.mjs:157` | the opening prompt "which the user copies as it is" | contradicts where `start_session` exists | none | Remove the copy; the starting session passes it as the brief (B) |
| D2 | `bin/lib/manifest.mjs:165` | "the user says it there in their own words, or here, and you carry it" | half-says (him saying it there comes first) | none | After question 355 he types only in the Plan's chat: "the Plan sends it here, and you carry it" (B) |
| D2 | `bin/lib/manifest.mjs:175,179` | "4. a prompt they hold became stale"; "whether to send that session's own prompt" | contradicts (he holds and sends prompts) | none | Remove item 4; line 179: send it yourself or drop it (B) |
| D2 | `bin/notify.mjs:9` | "It never sends a message" | half-says (nothing says the send is still owed) | 229-planned (T2, "the two ways a session sends") | One line in the skill: a notice is never the delivery of something that waits on it (B) |
| D2 | `bin/lib/reply.mjs` on 229 (comment at `:215`) | refuses a close that hands him text for an existing session | aligned, but the rule `sessions-send-themselves` (JH 229's, not yet declared on main) is not in `bin/lib/rules-data.mjs` on that branch | 229 (check), 229-planned (rule) | JH 229's T2 declares it (B) |
| D2 | `bin/lib/sessions.mjs:2896-2898` (`cutRule`) | the pause notice gives him nothing to send | aligned | none | none |
| D1, D2 | 227 `odd/tasks/plan-orchestrator-evidence/plan-opening.md:25` against 229's refusal text | the hand-over to the lead is "one `js-harness notify`"; 229 says a notice alone wakes nobody | contradicts (the two branches disagree) | 227, 229 | The hand-over goes by a direct message, the notice only records it (A) |
| D1 | `odd/tasks/plan-orchestrator.md:97` (main), `:107` on 227 | the order "is the stretch plan (`js-harness stretch open --plan`" | contradicts | 227 keeps it | Remove; the miniplan is the order (D-b decides it, then slice D) |
| D1, D4 | 227 `odd/tasks/plan-orchestrator.md:238-243`, `:406` (T4) | "A request's plan is a stretch plan ... An amendment, and `closes`, are the Plan's" | contradicts (the Plan runs nothing) | 227; its "Superseded" list (`:354-356`) keeps T4 | Drop T4 from the Plan; see slice D for `stretch` (A) |
| D1, D4 | 227 `odd/tasks/plan-orchestrator.md:263` (T3) | "The Plan keeps `wait` on that condition with no time limit" | contradicts (the Plan follows nothing) | 227 | Drop T3 from the Plan; the lead waits (A) |
| D4 | 227 `odd/tasks/plan-orchestrator.md:325` | "the audit is the Plan reading `js-harness sessions` and `stretch status`" | contradicts (no checking on Fable) | 227 | Remove (A) |
| D1 | 227 `odd/tasks/plan-orchestrator.md:375` (C2) | a start names "its miniplan ... or the plan file of the open stretch" | half-says | 227, his open decision 2 in JH 227's note | Left to his answer to JH 227's question; slice D removes the second branch once `stretch` retires |
| D1 | 227 `plan-opening.md:7,23` | the Plan asks him "here, in one sitting, before the hand-over" | half-says: aligned for the questions before the hand-over, but question 355 puts every question of the execution there too | 227 | Say that the Plan's chat holds all his questions, the lead's included (A) |
| D1 | 227 `plan-opening.md:15` | "`His to decide` ... the lead asks it in its own chat" | contradicts question 355 | 227 | The lead records the question and sends it; the Plan asks it (A) |
| D1 | 227 `rules-data.mjs` (`questions-one-place` subject, 13ef86a1) | "every other question, in the orchestrator's chat" | contradicts question 355 | 227 | Leaves 227's branch (the lead's order): the change, quoting his typed line 1362 with the tap of 4488 accepted, goes to slice H with `manifest.mjs:134,140` |
| D1 | `bin/lib/manifest.mjs:134,140` | the questions reach him "in one place: the orchestrator's chat"; the lead asks them | contradicts question 355 | none | Stays out of 227's branch; written as a limit of today until slice H (the lead records a question for the orchestrator, then sends it to the Plan by direct message), and reworded with slice H |
| D1 | `bin/lib/channel.mjs:136` | "a question goes to the orchestrator, who asks the user: --to orchestrator" | contradicts question 355 | none | A question is recorded for the Plan, and the lead's direct message delivers it (H) |
| D1 | 227 `plan-opening.md:25` | the Plan starts the sessions a miniplan orders, on his go, and hands them over | open: question 354 is a tap, and his typed lines 3064 and 3459 point to the lead opening (read 8d32c0e7 on 227, Claude 2) | 227 | Decided by question 354 (tapped, line 4422), among the rule's accepted answers; no typed line settles it (L10); the rewording is the senior session "JH SR · plan-pre-prompt words"'s (question 357) |
| D1 | 227 `plan-opening.md:29` and the `plan-pre-prompt` subject | the Plan "is sent no notices"; the lead sends it "once, 'miniplan N done'" | half-says after question 355: the lead now sends it every question of the execution | 227 | Say the questions come by direct message, never as a notice to follow (A) |
| D1 | `bin/lib/manifest.mjs:120` | "Two kinds of session. A work session ... The orchestrator" | half-says (no Plan role in the installed skill) | none (227 writes the role in `odd/` only) | One line naming the Plan, pointing to the rule `plan-pre-prompt` (JH 227's, not yet on main) (C) |
| D1 | `docs/ROADMAP.md` | no line names the Plan, a miniplan or the pre-prompt (searched `Plan\b`, `miniplan`, `pre-prompt`, `JH PLAN`) | half-says | none | One roadmap row (C) |
| D1 | `bin/lib/template-registry.mjs:5-35` | only the `question` template; no miniplan shape on main or 227 | half-says | 227 designs it as C1 (`contract template miniplan`, T14), not built | Build C1 as designed (E) |
| D1 | `bin/stretch.mjs:46-50`, `bin/lib/stretch.mjs:89-90` | the plan is `{ hours, slots, goals, items, waits }`, hours and slots required | contradicts (built for the big plan) | none | Slice D |
| D3 | `bin/lib/manifest.mjs:231` | the first lead "ask[s] before each step" until a charter is approved | contradicts | none | "ask once for the charter; its approval covers each step it names" (C) |
| D3 | `bin/lib/manifest.mjs:155` | "act inside it, and ask before anything it does not name" | half-says (a session a miniplan orders but the charter does not name gets asked) | none | "a miniplan he approved counts as named" (C) |
| D3 | `CLAUDE.md:37`, `bin/lib/protocols-skill.mjs:40` | "One decision a question" | half-says (never says one approval covers a whole piece of work) | none (only 227 `plan-opening.md:25` says it, for the Plan) | One clause in protocol 1; `CLAUDE.md` names it (C) |
| D3 | `bin/lib/manifest.mjs:157` (tail), `bin/lib/rules-data.mjs:774`, `docs/RULES.md:225` | `start_session` on a turn he did not type "leaves a card the user must tap" | twice; a host limit that acts as one approval per session | none | Keep the rule (`sessions-open-in-sidebar`) as the one home; the skill names it and says the ordered starts are made on his next typed turn, all in that turn (C) |
| D3 | `bin/lib/codex-review-allowance.mjs:104` | "a review over its allowance is asked of the owner of these rules before it runs" | contradicts (one question per review) | none | Slice F |
| D3 | `bin/lib/rules-data.mjs:117,143` (floor 300,000, rate 1,200, since 2026-10-11) | below one part's fitted cost today (about 540,000 a part plus 2,561 a line, `codex-review --plan`) | contradicts (every plan reads "over") | none | Slice F |
| D3 | `bin/lib/protocols-skill.mjs:37` | "spend outside the plan" is his | half-says (no text says a miniplan's Budget is the plan) | none | Slice F |
| D3 | `bin/lib/manifest.mjs:213` | "spend what a planned step needs, up to the plan's limits" only while he is away | half-says | none | Slice F: holds always |
| D3, D4 | `bin/lib/guard.mjs:174`, `:137-138` | a start naming no model passes; the starter's model is not held since PR 913 | contradicts (`rule:session-model` is unenforced; from the Plan the start runs on Fable) | none (`fix/starter-model-check` has no commits; `odd/tasks/starter-model-check.md:10-11` records it open) | Slice E |
| D1, D3 | `bin/guard.mjs:198`, `bin/lib/session-title-guard.mjs:94`, `bin/sessions-background.mjs:177` | "a senior is started by the lead (the orchestrator ...)"; the guard refused the Plan's start of a senior session (the lead's report, L12) | contradicts question 354 (the Plan starts what a miniplan orders); with the app's typed-turn lock it costs him one message in the lead's chat for every senior | none | Card D-a7; slice E carries whichever way he settles it |
| D3 | `bin/guard.mjs:193-231` | the `start_session` branch never asks whether a person typed the turn; nothing bounds a card's hold | contradicts in effect (`docs/FAILURES.md:1546-1550`: a hold of about 8 h) | none (reserve item `start-guard` exists only in JH PLAN's record and `FAILURES.md`) | Slice E |
| D2 | `bin/lib/stall.mjs:21,81-84` | `waiting` counts as work given back; an unanswered question exempts the session from STALLED | contradicts (a blocked session's question reaches him only through an awake lead) | none (JH 221's T2 is a design: `odd/tasks/consistent-orders.md:179`) | Slice G |
| D2, D3 | the host's next-step box (`wrap_up` ask); no text or check of the harness names it (`git grep -n -e wrap_up -e wrap-up -- bin CLAUDE.md`: no hit) | the lead's ask "¿Abro ya las 8 sesiones de la primera tanda?" (about 12:3x local) stayed drawn under its latest reply after JH 219 to 226 opened at 14:15, because later wrap_ups carried no ask; he read it at 21:21 as a new question (the lead's report of his screen, not checked in code) | contradicts in effect (a stale approval question per piece of work stays in front of him) | none | A closing whose earlier ask is overtaken says so: the next wrap_up carries the recap that withdraws it, or the skill says to close with a fresh ask or none; written in the skill with the closing rules (C) |
| D4 | `bin/lib/rules-data.mjs:665-667` (`senior-model`) | the senior gets "tasks needing more intelligence or complexity" | half-says (tasks, not judgment) | none | Reword to judgment (C, his words) |
| D3 | `bin/lib/merge-queue-refresh.mjs:1-5,22`, `bin/merge-queue.mjs:82-90` | the refresh waits by itself for sessions between runs (30 minutes, exit 75) and tells each one | aligned | none | none |
| D2, D4 | `bin/sessions-background.mjs:533-560`, `bin/lib/background-close.mjs:268-273` | `sessions stop --finished` closes "every finished session of the project that loses nothing"; it reads only the record of background sessions (`readRecord(home)`), so it sees only sessions `sessions start` began | gap: the sessions the app starts (`start_session`) are never closed by anything; on 2026-11-19 he typed "recuerda cerrar la sesiones cuando estas terminen ya que tenemos casi 16 abiertas" (f5c3ee4d:5712, 05:43Z), and the lead archived nine by hand (merged PR, clean worktree, head in main) after `stop --finished` closed none (the lead, L14) | JH 234 ("finished sessions are always archived") | Decided by his line f5c3ee4d:5748 (`2026-11-19T05:50Z`), "ok por favor SIEMPRE CIERRALAS Y CEMENTA Y CORRIJE ESE ERROR POR QUE SIEMPRE FALLA A LA HORA DE CERRAR LAS SESIONES QUE YA TERMINARON"; built by JH 234, so no slice here (L15) |

## Miniplan 3, step 3: each claim checked
1. **`stretch` is built for the big plan; nothing says what becomes of it or how a miniplan is bound and
   measured — verified (code).** `bin/lib/stretch.mjs:89-90` requires `hours` and `slots`; 227's "Superseded"
   list (`odd/tasks/plan-orchestrator.md:354-356` on 227) takes the stretch plan from the Plan but keeps T4's
   `stretch amend` for the Plan (`:240-243`); no text on main or either branch says what becomes of `stretch`. A
   miniplan's "Budget" heading has no record or figure behind it; C1 is "designed, not built" (`:364` on 227).
2. **A cut "carries what he sends" and a cut to another session's chat follows from it — verified (code).**
   `CLAUDE.md:47`; neither branch touches `CLAUDE.md`; JH 229's refusal holds it in the check, but the text that
   every session loads still says it.
3. **A work session that stops for his decision writes a note and waits; nothing brought JH 224's to him for
   about five hours; JH 221's design covers the lead's idle close only and is not built — verified (code and
   record).** Code: `bin/lib/stall.mjs:21,81-84` as in the table; the path to him is only an awake lead
   (`bin/loop.mjs:745-757`, `bin/wait.mjs:36-41`, `bin/lib/manifest.mjs:140,162`). Record: JH 224's note
   `jh224-onboard-q-stop.md` was written at 14:38 local (19:38Z, file time); his answer, question 351, is at
   transcript `f5c3ee4d` line 4083, recorded by JH PLAN at 00:3xZ (`plan-2026-11-18-away.state.md:382`), at
   2026-11-19T00:15:41Z (`sessions --quote`), so 4 h 37 min: the brief's four and a half hours holds. JH 221's T2 is unchecked (`odd/tasks/consistent-orders.md:179`) and its summary
   says "no code" (`docs/sessions/2026-11-18-jh-221-consistent-orders-t2-design.md:5`).
4. **A `start_session` on a turn nobody typed can still wait for hours — verified (code and record).**
   `bin/guard.mjs:193-231` has no such check and nothing bounds the card; `docs/FAILURES.md:1546-1550` records a
   lead turn held from 07:51Z to about 15:50Z. `grep -rn start-guard docs odd bin` finds only that `FAILURES.md`
   line; `git log --all --grep=start-guard` finds nothing. Not checked: whether the permit relay's wait
   (`WAIT_MS`, 570 s) applies to a start card.
5. **Since PR 913 a start that names no model inherits the starter's, from the Plan that is Fable; only the
   starter's memory names `rule:session-model` — verified for the code, partly for the text (code).**
   `bin/lib/guard.mjs:174` returns no refusal for an undefined model; `:137-138` holds only the starter's level.
   `sessionStartHome` is called only from `bin/sessions-background.mjs:236,429`. Not only memory: 227
   `plan-opening.md:25` names `rule:session-model` in prose, which no check holds.
6. **`codex-review --plan` underestimates five to eight times; with the allowance nearly every review becomes a
   spend question, one per session — the first half refuted as the usual case, the second verified (reproduced
   now and code).** `js-harness codex-review --plan --again --base 6ee022c6`, run now, prints that on the last 10
   recorded reviews "its estimate came to between 0.13 and 3.7 times what each took, 2.12 at the median": the plan
   mostly overestimates; the worst of the ten took about 7.7 times its estimate. PR 918 did not change the
   estimator: the last commits to `bin/lib/codex-review*.mjs` are re-read fixes (`aff96f32`, `ecab5d10`, `1941ed45`),
   so the briefs' 4.7 to 8 times are single cases on the same fit, not the rule. Single cases do run far over a
   figure planned some other way (JH 221: 4.2M against 0.9M planned, `plan-2026-11-18-away.state.md`, 20:12Z
   entry). The questions come from the allowance: its floor 300,000 is below one part's fitted cost (about
   540,000), so every plan reads "over", and `bin/lib/codex-review-allowance.mjs:104` sends each one to him. Both
   figures in the briefs are right: the allowance is the larger of 300,000 and 1,200 a changed line
   (`codex-review-allowance.mjs:80`), so 0.49M is a plan of about 408 lines. No text gives one approval for several
   reviews (searched "one approval covers", "whole piece", "batch approval", "inside the plan" in `bin/`,
   `docs/ROADMAP.md`, `odd/tasks/codex-spend.md`).
7. **A copy refresh needs every session between runs; the lead batches lands by hand — partly.** The wait is
   automatic and enforced (`bin/lib/merge-queue-refresh.mjs`, `QUIET_WAIT_MINUTES = 30`, exit 75;
   `bin/merge-queue.mjs:82-90` tells each session). The queue batches every ready pull request into one candidate
   (`bin/merge-queue.mjs:1-3,43-46`); only the lead starts it, by typing `js-harness merge-queue --land
   --refresh-copy` (`bin/lib/manifest.mjs:158`). Not a contradiction of any directive; no slice.
8. **An open stretch copies its plan, so nothing can be added — verified (code).** `bin/stretch.mjs:480` writes
   the parsed plan into the open record; the verbs are open, bind, closes, status, close, explain, show
   (`bin/stretch.mjs:98`); `stretch amend` does not exist (227, `odd/tasks/plan-orchestrator.md:324`).
   **`sessions --next-number` printed a taken number — verified (code and record).** It reads the notices, the
   openings and the background record, not the app's session records (`bin/lib/channel.mjs:631-662`); the title
   guard checks the shape only (`bin/lib/session-title-guard.mjs:33-34`); JH PLAN recorded "JH 219" printed after
   JH 219 existed (`plan-2026-11-18-away.state.md:246`); run once now it printed `JH 229` in about 12 s, while
   JH 229 exists. **`js-harness sessions` did not answer in 120 s — verified (reproduced now).** `timeout 130
   js-harness sessions` was killed at 134 s, exit 124, with no output; it reads 141 transcripts (a 1.6 GB folder)
   plus git, a process list and `gh` (`bin/sessions.mjs:404-433,665`). Which part is slow is not known.

## The build plan
Searched before proposing (none adds a command, rule or document where one exists): `js-harness rules` (ids
`questions-one-place`, `owner-decisions`, `sessions-open-in-sidebar`, `session-model`, `senior-model`,
`codex-review-floor`, `codex-review-rate`), `odd/tasks/plan-orchestrator.md` (C1 to C3), `odd/tasks/never-carry.md`,
`odd/tasks/consistent-orders.md` (JH 221's T2), `odd/tasks/starter-model-check.md`, `odd/tasks/codex-spend.md`,
`odd/tasks/merge-queue-dry-run.md`.

Order: in flight first, then the text that removes and merges, then the code. Costs are estimates: lines are
changed lines; Codex is the `--plan` fit printed today (about 540,000 a part plus 2,561 a line), before the
allowance question of slice F is answered. Every code slice also gets the Claude lenses.

| Slice | What | Files | Test or check | Removes / merges | Cost (estimate) | Runs beside |
|---|---|---|---|---|---|---|
| A | Amend JH 227 before it lands (the lead has sent JH 227 this list): the hand-over by direct message; drop T3, T4 and line 325 from the Plan; the Plan is sent questions by direct message, never a notice to follow. Not in A: the miniplan as the order (D-b1, slice D); `questions-one-place` and `manifest.mjs:134,140` (slice H) | `odd/tasks/plan-orchestrator.md`, `odd/tasks/plan-orchestrator-evidence/plan-opening.md` | `npm run check` | removes the Plan's wait and audit work | about 20 lines on 227's branch; no new Codex part if folded into 227's pending review | B |
| B | Amend JH 229 before it lands: its T2 declares the rule `sessions-send-themselves` (JH 229's, not yet declared on main) and, in the same slice, removes the closing paragraph `CLAUDE.md:41-50` down to its pointer to protocol 2 and its last sentence (reports open with a summary and close with a recap, which protocol 2 does not hold); every other clause there is a copy of `protocols-skill.mjs:49-53` ("for which session: he runs several" and "two blocks out of order cost a session" are protocol 2's "for which session" and "numbered in the order they are sent"), so the removal changes no protocol. What changes protocol 2 is narrowing its "Cut" (`:49`) to a chat no session can open or a command on his machine: a protocol change, covered by his typed lines 3771 and 3672 (section "His to decide"), `manifest.mjs:157` copy, `:165` "there", `:175` item 4, `:179`; one line that a notice is never the delivery; and, from read 8d32c0e7 (Codex 8), the lead's side of line 3771 is a prerequisite of the Plan-only operation: both roles deliver confirmed information themselves, with a record the other reads when a message cannot be delivered, tested both ways | `CLAUDE.md`, `bin/lib/protocols-skill.mjs`, `bin/lib/manifest.mjs`, registry files (already in 229's scope except `CLAUDE.md`) | `node --test bin/lib/reply.test.mjs`, `js-harness rules check`, the 229 verifier | removes about 10 lines of prose; merges three homes of the cut into one | about 40 lines on 229's branch; folded into 229's pending review | A (A touches `manifest.mjs:134` only; agree the hunk through the lead) |
| C | The approval and role texts, after A and B land: one approval covers a piece of work (protocol 1, `CLAUDE.md:37` names it), `manifest.mjs:155,231`, the start card named once (`:157` tail points to `sessions-open-in-sidebar`; after question 354 the ordered starts are made in the Plan's chat on his yes, and the lead's own starts fall on a card, which slice E bounds), the Plan's line at `:120`, `senior-model` reworded to judgment, one ROADMAP row | `bin/lib/protocols-skill.mjs`, `bin/lib/manifest.mjs`, `CLAUDE.md`, `bin/lib/rules-data.mjs` and its generated files, `docs/ROADMAP.md` | `js-harness rules check`, `npm run check` | merges the card text into its rule; removes the per-step asking | about 40 lines, one `rule/` branch; Codex about 640,000 | D, E, G, H |
| D | Retire `stretch` for new work once plan v4's stretch closes: the miniplan is the unit, bound by C2's start check (slice E) and measured by the land records (`feat/codex-spend-t5`, Codex input per landed pull request: landed as PR 923, `196c555d` in main, L20); what `stretch` measures today and would be lost: hours against slots and items closed against the plan (`bin/lib/stretch.mjs:89-90`); `manifest.mjs:239` ties it to his absences, which the miniplan's Budget must then carry | `bin/stretch.mjs`, `bin/lib/stretch.mjs` and their tests (2,168 lines in the four files, `wc -l`); 45 non-test files under `bin/` name "stretch" (`git grep -l stretch -- bin`), each read before it is cut; `bin/js-harness.mjs`; the skill lines; C2's stretch branch | `npm run check`, `js-harness doctor`; high risk 3 (a command others use is removed): an independent verifier | removes a command and its plan shape | at least the 2,168 lines, more from the 45 files; Codex about 1M to 2M for the removal's diff (estimate, the deletions count as changed lines); decided by question 364 (D-b1, A) | E, G, H (C's skill lines first, or D after C) |
| E | The start guard, one slice in `guard.mjs`'s `start_session` branch: a start naming no model is refused (`odd/tasks/starter-model-check.md`); C3, a start from JH PLAN names its miniplan file (227's design); C2, a start the lead makes for a new request names its miniplan (227's design, its refuse-or-warn being his, D-b); a start card's hold bounded (the reserve item `start-guard`): design first, its mechanism and cost not known, since the guard cannot see whether a person typed the turn; C1 the miniplan shape as `contract template miniplan` with `check` validating it | `bin/guard.mjs`, `bin/lib/guard.mjs`, `bin/lib/session-title-guard.mjs`, `bin/lib/template-registry.mjs`, their tests ; and, from JH 227's read 8d32c0e7, pile (c): C2 and C3 bind each start to its project, its caller, an approved revision of the miniplan and one item of it, and say what a stretch fallback is before it is on (Codex 4); C2's refusal on an unreadable app record is named as a reversal of today's fail-open, tested with a failing reader (Claude 15); the starts the owner's go covers are listed before the hand-over, so a covered follow-up waits for a typed Plan turn and reuses that go (Codex 3); the hand-over reserves its numbers and slots first, records each started session with its item before the next, and a failed or partial hand-over says which sessions started (Codex 5, Claude 10); each brief names the miniplan and the Do steps that session owns (Claude 10) | new tests first, one each for: an omitted brief, a stale revision, an unrelated plan, an unreadable record, a partial start; replay over the project's starts; an independent verifier (high risk 2, guard) | merges three designed checks into one slice | about 200 lines for the four known checks, plus the card bound once designed; Codex about 1.05M (2.1M high) | C, D, G, H |
| F | Review spend per piece of work: a miniplan's Budget states its Codex spend, a review inside it is not asked, one question only when the piece passes it; floor and rate measured again on the review model (`rule:review-model`) (`bin/lib/lead-protocols.mjs:39` already orders it at a model switch) | `bin/lib/codex-review-allowance.mjs:104`, `bin/lib/rules-data.mjs:117,143`, `bin/lib/protocols-skill.mjs:37`, `bin/lib/manifest.mjs:213` | `node --test bin/lib/codex-review-allowance.test.mjs`, `js-harness rules check` | removes one question per review | about 60 lines; Codex about 690,000 (asked once under this slice's own rule only after it lands); his decision D-c | after C (shares `protocols-skill.mjs`, `manifest.mjs`) |
| G | A blocked session's question reaches him without an awake lead: build JH 221's T2 as designed (`odd/tasks/consistent-orders.md:179`), and a `waiting` note whose question stays unanswered shows on the heartbeat; after question 355 the question goes on to the Plan's chat; and the absence detector reads the Plan's chat, the lead's as the fallback, since he types only there (read 8d32c0e7, Codex 6), tested with Plan activity, an explicit leave and return, a relief and an unreadable transcript | `bin/lib/stall.mjs`, the AWAY detector (`js-harness loop heartbeat`, `bin/loop.mjs`), the one file JH 221's T2 design names (`odd/tasks/consistent-orders.md`, L13), and its test; disjoint from H's `channel.mjs`, `notify.mjs`, `sessions.mjs` | its tests first; high risk 4 (async ordering), an independent verifier | merges into JH 221's existing design | about 120 lines; Codex about 850,000 | C, D, E, H |
| H | The lead's tools and the questions' route: `questions-one-place` changed through `rules change`, quoting line 1362 with 4488 accepted, and `manifest.mjs:134,140,249` with it (the lead's order); from read 8d32c0e7: one durable id and one asking role a question, the Plan records the verified answer (`notify --kind answer --question <n> --transcript <the Plan's session> --line <n>`) before its direct message, so the board closes it (Claude 5, Codex 2); a proposal that needs `rule:double-review` reaches the Plan with its read id or its recorded exemption, or it is not shown (Codex 7); the rules fingerprint and the rule-change notice read a rule's subject too, so a change of destination reaches the installed copies (Codex 9, `bin/lib/rules.mjs:480-481,522-540`); the Plan's opening is one versioned source loaded by `sync` and the resume path, a local opening kept through sync and uninstall (Codex 10); a question is recorded for the Plan, not only `--to orchestrator` (`bin/lib/channel.mjs:136`, question 355; questions 349 to 352 reached him in the Plan's chat by a record and a direct message, so this only stops the Plan's questions landing on the lead's board, L22 Claude 5); `sessions --next-number` also reads the app's session records; the bare board answers inside its budget (profile first, one run) | `bin/lib/channel.mjs`, `bin/notify.mjs`, `bin/sessions.mjs`, `bin/lib/rules.mjs`, the registry files, `bin/lib/manifest.mjs:134,140,249`, the opening's home, their tests | a test with a question to the Plan and one with a started session that sent no notice; one timed run under 30 s | none | about 250 lines; Codex about 1.18M (2.4M high); high risk 3 (a skill and the rules fingerprint others consume), an independent verifier | C, D, E, G |

JH 234 builds the closing of finished sessions now on `bin/check.mjs`, `bin/doctor.mjs`,
`bin/lib/lens-review-rows.mjs`, `bin/lib/codex-review-rows.mjs` and `bin/lib/rules-data.mjs`; no slice here edits
those files while JH 234 is open, so C's and F's lines in `rules-data.mjs` start only after JH 234 lands (L15).

Order of the build (L21): after the Codex weekly reset of 2026-11-23 23:45 local, JH 233's test arms run first (his
question 359, tapped, f5c3ee4d:6312: "empezando justo después del reinicio"), then S8, then this plan's slices (S8
before the slices is the Plan's order, told to him, not answered: JH PLAN proposed it before his answer to 367, the
lead's report, L22; JH PLAN settles it with him); the slices spend within question 367's ceiling and
never past 60% of one week.

Total, estimated: about 550 changed lines of code and text, at least 2,168 removed in D, and about 5.5M Codex input
tokens across C to H (about 11M at the tool's high figure, 2.05 times) at today's fit, for one Codex round a slice
only (A and B ride the reviews 227 and 229 already owe). Not in that figure: recheck rounds (JH 224 needed three
reviews; at three rounds, about 16M), the independent verifiers of D, E and G (Claude), and the design reads
(`rule:double-review`) the designs of D, E, F and G each need before their build, which on JH 227's last read
(8d32c0e7) cost 2.17M Claude and 6.17M Codex each, so about 25M Codex for four. Two estimators, two errors: `codex-review --plan`,
fitted on review runs, came out at 2.12 times what the last 10 reviews took (an overestimate, L4); the figure a
double-review read states is not that fit, and JH 227's came in at 5.5 times it (0.9M stated, 5.0M measured, L22
on 227). So a design read is planned at its last measured cost, not its stated one. At the allowance as it stands
every slice is a spend question; F is why that stops.

## His to decide (one sitting in JH PLAN's chat; the lead records each and sends it; `rule:owner-decisions`)
Only a clause that no typed line of his covers becomes a card, and its subject goes to him word for word. A tap, or an
"Other" left empty, is recorded as his choice and moves no rule (read 8d32c0e7 on 227, Claude 1 to 3). Every line
below is in `f5c3ee4d`, checked with `js-harness sessions --quote`.

Covered by typed lines, so decided, no card (each rule quotes its lines; the taps 353 to 355 go among the accepted).
Each line was read against the message it answered (L10):
- Who opens the sessions a miniplan orders: the Plan, on his go, handing them to the lead. Decided by question 354,
  "El Plan, con mi visto bueno (Recomendada)" (line 4422, 2026-11-19T01:12Z, tapped), which came after 343 and 3064
  and answers exactly this. A tap is a valid decision; it goes among the rule's accepted answers, not as its quote.
  No typed line settles it (L10), so it is not asked again; question 357 (line 5187) sent the rule's rewording to the
  senior session "JH SR · plan-pre-prompt words", which takes L10 as input.
- One approval covers the sessions of a piece of work (`owner-decisions`, one clause in protocol 1): "a session that
  a miniplan or a charter he approved names is started without asking him again". Line 2642, "No quiero que me pidas
  permiso para iniciar cada linea", typed while the Plan was opening the seven sessions of a wave he approved; line
  3064, typed against a reply that left the lead asking him before it opened. Both say who is not asked, not who
  opens.
- His questions reach him in the Plan's chat (`questions-one-place`, now in slice H with `manifest.mjs:134,140`).
  Line 1362, "todas las preguntas del orquestador ya no la vamos a hacer en el orquestador sino aca en el plan".
- The Plan writes a miniplan, not the big plan, and the lead executes (`plan-pre-prompt`). Line 3509, his written
  answer to question 347: "no quiero que fable haga el super mega plan sino que haga un miniplan ... el arranca sin
  plan".
- `sessions-send-themselves` (JH 229) and protocol 2's "Cut" narrowed to a chat no session can open or a command on
  his machine. Line 3771, "SIEMPRE PERO SIEMPRE MANDA LA INFORMACION, NO ME HAGAS PASAR INFORMACION SI YA TE LA HE
  CONFIRMADO AQUI ... NI EN EL ORQUESTADOR NI CONTIGO"; line 3672, "Listo ahora hazlo no me pidas que lo haga tu
  tienes comunicacion".

Cards (no typed line covers them, or they are his by kind: removing what he uses, spend):
- **D-a1, `senior-model` to judgment only: decided A, question 372** ("Sí, solo juicio (Recomendada)", tapped,
  f5c3ee4d:7060, `2026-11-19T18:15:45Z`, recorded verified by JH PLAN; L26). His typed line, the quote slice C's `rules change` takes: "A la senior
  solo juicio, el código lo hace Opus." (f5c3ee4d:7721, `2026-11-19T21:12:27Z`, sent by him, read with `sessions
  --quote`); the tap of 372 goes among the accepted answers. Line 3459 ("ser mucho mas eficientes con el poder de fable pero sin
  tener que utilizarlo todo") was typed about the Plan's use of Fable, not about a senior session, so it does not
  cover this subject. Subject, word for word: "the model a senior session runs on, titled <code> SR · <purpose>, sent the
  judgment a task needs: a design, a depth pass, a decision". The title stays as the rule in force has it (L13).
  The opener clause ("which the lead opens with start_session") leaves whichever option he takes: question 371
  decided who starts a senior, and its home is the start check (slice E). An owner's rule changes only with his typed
  words (`bin/lib/rules-change.mjs:239` refuses a tap), so the card asks him to write his yes in "Other"; a tap alone
  leaves slice C one typed line short. The edit is in `bin/lib/rules-data.mjs:666`, JH 234's file, so
  slice C waits for JH 234. Options: A, yes (recommended: Fable on judgment); B, as today.
- **D-a7, who starts a senior session a miniplan orders: decided A, question 371** ("Sí, el Plan la arranca
  (Recomendada)", tapped, f5c3ee4d:6995, `2026-11-19T18:08:34Z`, recorded verified by JH PLAN; L24). Question 354 says the Plan starts what a miniplan orders;
  the guard says "a senior is started by the lead" (`bin/lib/session-title-guard.mjs:94`) and refused the Plan's
  start of one. No typed line settles it. Subject, word for word: "a senior session a miniplan orders is started by
  the Plan on his go, like every other session the miniplan orders". Options: A, yes: the guard admits the Plan's
  start of a senior named in the miniplan it hands over (slice E); B, seniors stay the lead's to start, and each one
  costs him one typed line in the lead's chat (the app's typed-turn lock, the lead's report, L12); his words in
  "Other". Recommended A (this session's call, told to the lead): it follows question 354. A's cost to him is not
  measured: nothing when his go is a typed line in the Plan's chat, otherwise a tap on the start card.
- **D-a4, review spend inside a miniplan: decided A by D-c1, question 370** ("Sí, el presupuesto cubre (Recomendada)", tapped, f5c3ee4d:6934, `2026-11-19T18:01:19Z`, recorded verified by
  JH PLAN; L23). Subject, word for word: "a review inside the Codex spend its miniplan's
  Budget states is not asked; a piece of work that passes it is asked once". Options: A, yes, as written
  (recommended: one approval a piece of work); B, every review over the allowance is asked, as today; his words in
  "Other".
- **D-b1, retiring `stretch`: decided A, question 364** ("Sí, retirarlo (Recomendada)", tapped, f5c3ee4d:6550,
  `2026-11-19T16:07:32Z`, recorded verified by JH PLAN; L16). Subject: "`js-harness stretch` is retired for new work once plan v4's stretch closes;
  a miniplan is the unit of work, bound by the lead's start check and measured by the land records". Options: A, yes
  (recommended: it removes a command built for the big plan he no longer wants; until v4 closes, C2 counts the open
  stretch's plan, and on today's record only JH 217 would have been refused); B, keep it and build `stretch amend`,
  and C2 counts a miniplan or the open stretch's plan; C, keep it for multi-day absences only, and C2 counts a
  miniplan, or the stretch's plan while one is open.
- **D-b2, C2 refuses or warns: decided A, question 365** ("Rechaza (Recomendada)", tapped, f5c3ee4d:6616,
  `2026-11-19T16:26:00Z`, recorded verified by JH PLAN; L18). Subject: "a start the lead makes for a new request that names no miniplan is
  refused". Options: A, refuses (recommended: his "el arranca sin plan", line 3509); B, warns.
- **D-c1, the policy of review spend: decided A, question 370** ("Sí, el presupuesto cubre (Recomendada)", tapped, f5c3ee4d:6934, `2026-11-19T18:01:19Z`, recorded verified by
  JH PLAN; L23). The same choice as D-a4 put as the harness's policy, asked as one card that
  decides both (L17): A, a miniplan's Budget states its Codex spend and his go covers its reviews, with the floor and
  rate measured again as slice F does (recommended; this was C, "both", which F already is); B, a question per
  review, with only the floor and rate raised to today's measure.
- **D-c2, this plan's spend, as one figure: decided A, question 367** ("Sí, un tope para todo (Recomendada)", tapped,
  f5c3ee4d:6765, `2026-11-19T17:06:54Z`, recorded verified by JH PLAN; L21). About 5.5M Codex input for one round of C to H (11M at the high
  figure), about 16M with up to three rounds, and about 25M more for four design reads at the last read's measured cost
  (JH 227's read 8d32c0e7: 2.17M Claude, 6.17M Codex each), and 6.17M for this document's own double review: about
  47M Codex central, about 64M at the high figure (three rounds at 11M a round), which the card puts as the ceiling;
  about 11M Claude for the five reads, the verifiers of D, E and G not costed. In the Codex week (an estimate: 1
  weekly point is about 0.75M, from JH 235's read priced at 2.9M to 7M for 4 to 9 points), 47M is about 63 points and
  64M about 85, more than a whole week under his 60% stop (question 346), so C to H spans two or three weekly windows;
  the stop holds each week, and the ceiling is spent across windows, never past 60% in one. A yes is his answer, given once, to
  each review of C to H inside the ceiling; the rule that asks each review over its allowance
  (`bin/lib/codex-review-allowance.mjs:104`) changes only with D-c1 and slice F. Options: A, approve it as the ceiling
  for the whole build, each slice told what it used (recommended); B, slice by slice, at least one question a slice.
- Pending elsewhere, not repeated here: C1's tenth heading and 227's own Codex spend.

## Tasks
- [x] T1 (kind: verify) four opus readers over the surfaces of miniplan 3 step 1; one row of each spot-checked in
  code (`manifest.mjs:231`, `guard.mjs:174`, `rules-data.mjs:774`, `codex-review-allowance.mjs:104`,
  `manifest.mjs:213`, `stall.mjs:21`, `stretch.mjs:480`); route sub-agents
- [x] T2 (kind: design) the table, step 3 marked, the build plan, his block; route inline
- [ ] T3 (kind: docs) the pull request, its reviews, the ready notice; route inline

## Log
- L1 (JH PLAN, `f5c3ee4d` line 4245, 2026-11-19T00:38Z): "quisiera saber si ahora con estas nuevas directivas ya
  todo el harness esta alineado a esto por que creo que lo que hemos hecho son parches"
- L2 (JH PLAN, `f5c3ee4d` line 4329, 2026-11-19T00:55Z): "Listo quiero que lo alineemos todo". JH PLAN relayed it by
  direct message and amended miniplan 3's "Already decided": the change set is built, all of it; only his lines by
  `rule:owner-decisions` are put to him, in one sitting.
- L3 (JH 230): two readers marked the Plan's one sitting of questions before the hand-over and its hand-over starts
  (227 `plan-opening.md:7,23,25`) as contradicting D1; refuted against miniplan 1, step 4 and "The hand-over start",
  which order both. Superseded in part by L6: the starts stay aligned (question 354); the questions are now all in
  the Plan's chat (question 355).
- L4 (JH 230): the briefs' "underestimates five to eight times" is refuted as the usual case by `codex-review --plan
  --again` (median 2.12, an overestimate); the spend questions come from the allowance's floor, below one part's
  fitted cost.
- L5 (JH 230): JH 224's wait was 4 h 37 min (19:38Z note, answer at 00:15:41Z, line 4083), as the brief said.
- L6 (the lead's direct messages, 2026-11-19): JH 227's double review (Log L22 on `rule/plan-pre-prompt@3e86b9f6`)
  found that who starts a miniplan's sessions and where his questions reach him rested on taps against his typed
  lines; the lead asked again. Question 354, `f5c3ee4d` line 4422, 2026-11-19T01:12Z, tapped: "El Plan, con mi visto
  bueno (Recomendada)". Question 355, line 4488, 2026-11-19T01:14Z, tapped: "En el chat del Plan (Recomendada)".
  Both read with `js-harness sessions --quote`. The table and slices A, G and H rest on them; the lead noted the
  limit `bin/lib/channel.mjs:136`, read and confirmed.
- L7 (the lead, JH ORQ, by direct message on PR 921): slice A cannot quote the tap 4488 (`rules change` refuses it), so 1362 is quoted and 4488 accepted; the order as the miniplan is D-b, out of A; `manifest.mjs:134,140` stays out of 227 until slice H; B's removal in `CLAUDE.md` is copies only, and protocol 2's narrowed "Cut" is his (D-a5); one card a rule; `senior-model` no longer names the lead as opener (question 354); `sessions-send-themselves` was never put to him (D-a5); D-b's options say what counts for C2, and refuse-or-warn is its own card (D-b2); D-c split into the policy and this plan's spend, the spend naming what it leaves out; the 2.12 of L4 and the 5.5 times of JH 227's read are two estimators. The double review (`rule:double-review`) runs after these fixes, priced first.
- L8 (the lead, by direct message, after JH 227's confirming read 8d32c0e7 failed; text `jh227-read-8d32c0e7.txt` in the
  shared notes): the go for this document's double review is withdrawn until the lead's next go. Each D-a card now
  names a typed line covering its whole subject: D-a1 rests on line 3459, D-a2 on 2642 and 3064 and is narrowed to
  sessions, D-a4 has no typed line and asks for one, D-a5 on 3771 and 3672 with the start clause left out, D-a6 is
  new (who opens a miniplan's sessions: 354 is a tap against typed lines 3064 and 3459), and D-a3 is withdrawn.
- L9 (the lead, by direct message): `questions-one-place` and `manifest.mjs:134,140` leave JH 227's branch for slice H, and
  slice A shrinks to match; pile (c) of read 8d32c0e7 is this plan's: Claude 5 and Codex 2, 7, 9, 10 in slice H;
  Claude 10 and 15 and Codex 3, 4, 5 in slice E; Codex 6 in slice G; Codex 8 in slice B (JH 229's, the lead's side of
  line 3771). His typed lines 1853, 1362, 3509 and 3064, checked here with `sessions --quote`, cover who opens a
  miniplan's sessions and where his questions reach him, so only uncovered clauses stay cards: D-a4, D-b1, D-b2,
  D-c1, D-c2.
- L10 (the lead, by direct message, after JH 227's third read 51d264a0: line 1853 belongs to version 3's wave): each
  typed line read against the assistant message it answered (a script over `f5c3ee4d`, the nearest earlier reply).
  Holds: 2642 (one approval, not one per session; the Plan was opening a wave), 1362 (questions in the Plan's chat),
  3509 (the miniplan; in it he also says "yo hablo con Opus que es el orquestador", the state then, which 1362 and
  355 later move), 3771 and 3672 (send it yourself, never make him carry it). Does not hold for who opens a
  miniplan's sessions: 1853 (version 3's wave, question 340), 3064 and 3459 (the lead opens), 3672 (send, not start);
  so that is card D-a6 again, with no recommendation. 3459 is about the Plan's Fable, not a senior session, so
  `senior-model` is card D-a1 again. No read ran; none was stopped.
- L11 (the lead, by direct message): who opens a miniplan's sessions is decided by question 354 (line 4422, tapped), which
  came after 343 and 3064; a tap is a decision and goes among a rule's accepted answers, so it is not asked again, and
  question 357 (line 5187) sent the rule's rewording to JH 231. D-a1's subject titles a senior session with its number
  from `sessions --next-number`, since a notice to an unnumbered title reaches nobody. Cards now: D-a1, D-a4, D-b1,
  D-b2, D-c1, D-c2 (D-a7 added in L12). No card goes to him and no read runs until the lead says so.
- L12 (the lead, by direct message): the guard refused the Plan's start of a senior session, "a senior is started by
  the lead" (`bin/lib/session-title-guard.mjs:94`, `bin/guard.mjs:198`), against question 354; with the app's
  typed-turn lock that costs him one message in the lead's chat for every senior. Recorded as a contradiction for his
  one sitting, card D-a7, not decided by a typed line.
- L13 (the lead, by direct message, correcting its own note of L11): `rule:senior-model` titles a senior "<code> SR ·
  <purpose>", the rule in force, so D-a1 keeps that title, not a number; the senior session question 357 sent the
  rewording to is "JH SR · plan-pre-prompt words", not JH 231. D-a7 stands.
- L14 (the lead, by direct message): his order typed in the Plan's chat (f5c3ee4d:5712), "recuerda cerrar la sesiones
  cuando estas terminen ya que tenemos casi 16 abiertas". Nothing archives a finished session the app started; the
  lead archived nine by hand. Checked in code: `stopFinished` calls `closeFinishedIn`, which reads only the record of
  background sessions (`bin/lib/background-close.mjs:271-273`), so `stop --finished` closes only what `sessions
  start` began. Recorded as a gap, row and card D-c3, not decided.
- L15 (the lead, by direct message): D-c3 is decided by his line typed in the Plan's chat, f5c3ee4d:5748
  (`2026-11-19T05:50:21Z`, checked in the transcript), "ok por favor SIEMPRE CIERRALAS Y CEMENTA Y CORRIJE ESE ERROR
  POR QUE SIEMPRE FALLA A LA HORA DE CERRAR LAS SESIONES QUE YA TERMINARON". JH 234 ("finished sessions are always
  archived") builds it. The card leaves; the row says decided and built by JH 234; no slice edits its files while it
  is open. Documents only, no read.
- L16 (question 364, D-b1): he answered "Sí, retirarlo (Recomendada)", tapped in JH PLAN's chat, f5c3ee4d:6550
  (`2026-11-19T16:07:32Z`, read with `sessions --quote`); JH PLAN recorded the answer, verified. So `stretch` is retired
  for new work once plan v4's stretch closes, and until then C2 counts the open stretch's plan. Slice D is decided and
  still waits for `feat/codex-spend-t5`. The cards are now asked one at a time through the lead, the order from the one
  that blocks most.
- L17 (the lead, by direct message): after 365 the order is D-c2, D-c1, D-a7, D-a1. D-c1's card says it covers D-a4,
  and D-a4 is marked decided by its answer (one choice, one tap); D-a1 is worded after `rules-data.mjs:665-667` is
  read, since D-a7 decides who starts a senior. Each card is recorded only once the lead says the last is answered.
- L18 (question 365, D-b2): he answered "Rechaza (Recomendada)", tapped in JH PLAN's chat, f5c3ee4d:6616
  (`2026-11-19T16:26:00Z`, read with `sessions --quote`); JH PLAN recorded it, verified. C2 refuses a start the lead
  makes for a new request that names no miniplan (slice E). PR 923 (`feat/codex-spend-t5`), which slice D waits on, is
  landing (the lead). D-c2 is asked as question 366, its ceiling put at the high figure.
- L19 (the lead, by direct message): question 366 left out how the ceiling sits against the weekly window and his 60%
  stop (question 346, whose option says the lead stops and tells him at 60% weekly, f5c3ee4d:3359). Withdrawn ("weekly
  share missing") and asked again as question 367: about 63 points central and 85 high at an estimated 0.75M a point
  (JH 235's read, 2.9M to 7M for 4 to 9 points), two or three weekly windows, never past 60% in one; the meter read
  51% weekly, resetting 2026-11-23 23:45 local. The lead had not sent 366 to JH PLAN.
- L20 (the lead, by direct message): PR 923 (`feat/codex-spend-t5`) is in main (`196c555d`, main at `c2e3ccd0`,
  checked with `git log origin/main`), so question 364's condition, that slice D starts nothing before it lands, now
  holds. Main merged into this branch.
- L21 (question 367, D-c2): he answered "Sí, un tope para todo (Recomendada)", tapped in JH PLAN's chat,
  f5c3ee4d:6765 (`2026-11-19T17:06:54Z`, read with `sessions --quote`); JH PLAN recorded it, verified. The ceiling is
  about 64M Codex (47M central) and 11M Claude for C to H, spent across weekly windows, never past 60% in one. The lead
  reports his order: after the 2026-11-23 reset, JH 233's test arms, then S8, then these slices. His line for that
  order: JH 233 first is his question 359 (f5c3ee4d:6312, tapped), which starts it right after the reset; S8 before
  the slices stands on the lead's word, not found in the answers or the questions of 361 (6239), 368 (6815) or 359. D-c1 is asked as question 370, its card covering D-a4; its option C (both) was
  folded into A, which slice F already builds as both (this session's call, told to the lead). A review with no
  miniplan Budget stays on the allowance, re-measured.
- L22 (the lead, by direct message): "S8 before the slices" is JH PLAN's proposal, told to him before his answer to
  367, not a typed answer of his; written as the Plan's order, told to him, not answered. This session's search of
  JH PLAN's replies in f5c3ee4d from line 6440 to 6765 did not find the message (a script matching S8 with 233), so
  the source is the lead's report. The lead asked JH PLAN to settle it with him. 370 is with him.
- L23 (question 370, D-c1 and D-a4): he answered "Sí, el presupuesto cubre (Recomendada)", tapped in JH PLAN's chat,
  f5c3ee4d:6934 (`2026-11-19T18:01:19Z`, read with `sessions --quote`); JH PLAN recorded it, verified. A miniplan's
  Budget covers its reviews and one question comes only when the work passes it; a review with no miniplan Budget
  stays on the allowance, re-measured (slice F, after JH 234 and C). D-a4 is decided by the same answer. D-a7 is
  asked as question 371, recommended A as this session's call, its cost to him written as not measured; then D-a1.
- L24 (question 371, D-a7): he answered "Sí, el Plan la arranca (Recomendada)", tapped in JH PLAN's chat,
  f5c3ee4d:6995 (`2026-11-19T18:08:34Z`, read with `sessions --quote`); JH PLAN recorded it, verified. Scope as he
  took it (the lead): slice E's start check lets the Plan start a senior named in a miniplan he approved, nothing
  outside one; until slice E lands with its reviews the guard stands as it is. D-a1, the last card, is worded against
  `rules-data.mjs:665-667` without its opener clause, asked as question 372, his yes asked in writing (an owner's rule).
- L25 (the lead, by direct message): PR 921 stays a draft and the double review does not run now: the meter is over
  50% weekly, and Codex runs only under 50% until the reset of 2026-11-23 23:45 local (miniplan-009 Budget lines
  31-33). After 372 is answered: write it in, push, keep the notice wait; after the reset the lead says to run the
  read, then the PR leaves draft.
- L26 (question 372, D-a1): he answered "Sí, solo juicio (Recomendada)", tapped in JH PLAN's chat, f5c3ee4d:7060
  (`2026-11-19T18:15:45Z`, read with `sessions --quote`); JH PLAN recorded it, verified. Decided; the tap goes among
  senior-model's accepted answers, and its `rules change` in slice C waits for his typed line, which JH PLAN is asking
  him for (the lead sends it here). Every card of the D block is answered. PR 921 stays a draft; the read runs after
  the reset, on the lead's word. His typed line came later, f5c3ee4d:7721 (`2026-11-19T21:12:27Z`, sent by him):
  "A la senior solo juicio, el código lo hace Opus.", the quote; slice C's change waits for JH 234, for
  `rule/plan-pre-prompt` and for the reset (the lead).

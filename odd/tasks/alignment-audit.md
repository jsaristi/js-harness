# JH 230 · alignment audit against the directives of 2026-11-18

Locator: `odd/tasks/alignment-audit.md` · Branch: `claude/alignment-audit-388faa` (worktree
`D:/js-harness/.claude/worktrees/alignment-audit-388faa`, cut from main `04b7ac53`) · Delivery: one documents-only
pull request, landed by the lead (JH ORQ) · Brief: miniplan 3 of JH PLAN, 2026-11-18 (side-session notes of JH ORQ,
`miniplan-003-alignment-audit.md`), amended the same evening after his "Listo quiero que lo alineemos todo" (L2).

## State
The audit and the build plan are written; nothing is built. Next: the lead reads it, sends the in-flight
amendments to JH 227 and JH 229 (slices A and B), and records the one block of his decisions and sends it to JH PLAN, which asks him in one sitting (question 355).

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
| D1 | `odd/tasks/plan-orchestrator.md:97` (main), `:107` on 227 | the order "is the stretch plan (`js-harness stretch open --plan`" | contradicts | 227 keeps it | Remove; the miniplan is the order (A) |
| D1, D4 | 227 `odd/tasks/plan-orchestrator.md:238-243`, `:406` (T4) | "A request's plan is a stretch plan ... An amendment, and `closes`, are the Plan's" | contradicts (the Plan runs nothing) | 227; its "Superseded" list (`:354-356`) keeps T4 | Drop T4 from the Plan; see slice D for `stretch` (A) |
| D1, D4 | 227 `odd/tasks/plan-orchestrator.md:263` (T3) | "The Plan keeps `wait` on that condition with no time limit" | contradicts (the Plan follows nothing) | 227 | Drop T3 from the Plan; the lead waits (A) |
| D4 | 227 `odd/tasks/plan-orchestrator.md:325` | "the audit is the Plan reading `js-harness sessions` and `stretch status`" | contradicts (no checking on Fable) | 227 | Remove (A) |
| D1 | 227 `odd/tasks/plan-orchestrator.md:375` (C2) | a start names "its miniplan ... or the plan file of the open stretch" | half-says | 227, his open decision 2 in JH 227's note | Left to his answer to JH 227's question; slice D removes the second branch once `stretch` retires |
| D1 | 227 `plan-opening.md:7,23` | the Plan asks him "here, in one sitting, before the hand-over" | half-says: aligned for the questions before the hand-over, but question 355 puts every question of the execution there too | 227 | Say that the Plan's chat holds all his questions, the lead's included (A) |
| D1 | 227 `plan-opening.md:15` | "`His to decide` ... the lead asks it in its own chat" | contradicts question 355 | 227 | The lead records the question and sends it; the Plan asks it (A) |
| D1 | 227 `rules-data.mjs` (`questions-one-place` subject, 13ef86a1) | "every other question, in the orchestrator's chat" | contradicts question 355 | 227 | The subject changes again through `rules change`, quoting line 4488 (A) |
| D1 | `bin/lib/manifest.mjs:134,140` | the questions reach him "in one place: the orchestrator's chat"; the lead asks them | contradicts question 355 | none | The lead sends a question to the Plan; the Plan asks (A, with the rule) |
| D1 | `bin/lib/channel.mjs:136` | "a question goes to the orchestrator, who asks the user: --to orchestrator" | contradicts question 355 | none | A question is recorded for the Plan, and the lead's direct message delivers it (H) |
| D1 | 227 `plan-opening.md:25` | the Plan starts the sessions a miniplan orders, on his go, and hands them over | aligned: miniplan 1, "The hand-over start", and question 354 | 227 | none (two readers marked it a contradiction; refuted by question 354) |
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
| D3 | `bin/guard.mjs:193-231` | the `start_session` branch never asks whether a person typed the turn; nothing bounds a card's hold | contradicts in effect (`docs/FAILURES.md:1546-1550`: a hold of about 8 h) | none (reserve item `start-guard` exists only in JH PLAN's record and `FAILURES.md`) | Slice E |
| D2 | `bin/lib/stall.mjs:21,81-84` | `waiting` counts as work given back; an unanswered question exempts the session from STALLED | contradicts (a blocked session's question reaches him only through an awake lead) | none (JH 221's T2 is a design: `odd/tasks/consistent-orders.md:179`) | Slice G |
| D4 | `bin/lib/rules-data.mjs:665-667` (`senior-model`) | the senior gets "tasks needing more intelligence or complexity" | half-says (tasks, not judgment) | none | Reword to judgment (C, his words) |
| D3 | `bin/lib/merge-queue-refresh.mjs:1-5,22`, `bin/merge-queue.mjs:82-90` | the refresh waits by itself for sessions between runs (30 minutes, exit 75) and tells each one | aligned | none | none |

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
| A | Amend JH 227 before it lands: the hand-over by direct message; drop T3, T4 and line 325 from the Plan; the order is the miniplan, not the stretch plan (`:97/:107`); questions 354 and 355 written in: the Plan's chat holds all his questions (`plan-opening.md:7,15,23`), `questions-one-place` changed again through `rules change` quoting line 4488, and `manifest.mjs:134,140` reworded with it (the lead records a question and sends it to the Plan by direct message) | `odd/tasks/plan-orchestrator.md`, `odd/tasks/plan-orchestrator-evidence/plan-opening.md`, the registry files, `bin/lib/manifest.mjs:134,140` | `js-harness rules check`, `npm run check` | removes the Plan's stretch, wait and audit work and the split of his questions between two chats; merges the questions phrase with its rule | about 45 lines on 227's branch; no new Codex part if folded into 227's pending review | B |
| B | Amend JH 229 before it lands: its T2 declares the rule `sessions-send-themselves` (JH 229's, not yet declared on main) and, in the same slice, removes the cut rules from `CLAUDE.md:43-48` (one home: protocol 2), `manifest.mjs:157` copy, `:165` "there", `:175` item 4, `:179`; one line that a notice is never the delivery | `CLAUDE.md`, `bin/lib/protocols-skill.mjs`, `bin/lib/manifest.mjs`, registry files (already in 229's scope except `CLAUDE.md`) | `node --test bin/lib/reply.test.mjs`, `js-harness rules check`, the 229 verifier | removes about 10 lines of prose; merges three homes of the cut into one | about 40 lines on 229's branch; folded into 229's pending review | A (A touches `manifest.mjs:134` only; agree the hunk through the lead) |
| C | The approval and role texts, after A and B land: one approval covers a piece of work (protocol 1, `CLAUDE.md:37` names it), `manifest.mjs:155,231`, the start card named once (`:157` tail points to `sessions-open-in-sidebar`; after question 354 the ordered starts are made in the Plan's chat on his yes, and the lead's own starts fall on a card, which slice E bounds), the Plan's line at `:120`, `senior-model` reworded to judgment, one ROADMAP row | `bin/lib/protocols-skill.mjs`, `bin/lib/manifest.mjs`, `CLAUDE.md`, `bin/lib/rules-data.mjs` and its generated files, `docs/ROADMAP.md` | `js-harness rules check`, `npm run check` | merges the card text into its rule; removes the per-step asking | about 40 lines, one `rule/` branch; Codex about 640,000 | D, E, G, H |
| D | Retire `stretch` for new work once plan v4's stretch closes: the miniplan is the unit, bound by C2's start check (slice E) and measured by the land records (`feat/codex-spend-t5`, Codex input per landed pull request: not landed, its review held, so D waits for it); what `stretch` measures today and would be lost: hours against slots and items closed against the plan (`bin/lib/stretch.mjs:89-90`); `manifest.mjs:239` ties it to his absences, which the miniplan's Budget must then carry | `bin/stretch.mjs`, `bin/lib/stretch.mjs` and their tests (2,168 lines in the four files, `wc -l`); 45 non-test files under `bin/` name "stretch" (`git grep -l stretch -- bin`), each read before it is cut; `bin/js-harness.mjs`; the skill lines; C2's stretch branch | `npm run check`, `js-harness doctor`; high risk 3 (a command others use is removed): an independent verifier | removes a command and its plan shape | at least the 2,168 lines, more from the 45 files; Codex about 1M to 2M for the removal's diff (estimate, the deletions count as changed lines); his decision D-b | E, G, H (C's skill lines first, or D after C) |
| E | The start guard, one slice in `guard.mjs`'s `start_session` branch: a start naming no model is refused (`odd/tasks/starter-model-check.md`); C3, a start from JH PLAN names its miniplan file (227's design); C2, a start the lead makes for a new request names its miniplan (227's design, its refuse-or-warn being his, D-b); a start card's hold bounded (the reserve item `start-guard`): design first, its mechanism and cost not known, since the guard cannot see whether a person typed the turn; C1 the miniplan shape as `contract template miniplan` with `check` validating it | `bin/guard.mjs`, `bin/lib/guard.mjs`, `bin/lib/session-title-guard.mjs`, `bin/lib/template-registry.mjs`, their tests | new tests first; replay over the project's starts; an independent verifier (high risk 2, guard) | merges three designed checks into one slice | about 200 lines for the four known checks, plus the card bound once designed; Codex about 1.05M (2.1M high) | C, D, G, H |
| F | Review spend per piece of work: a miniplan's Budget states its Codex spend, a review inside it is not asked, one question only when the piece passes it; floor and rate measured again on the review model (`rule:review-model`) (`bin/lib/lead-protocols.mjs:39` already orders it at a model switch) | `bin/lib/codex-review-allowance.mjs:104`, `bin/lib/rules-data.mjs:117,143`, `bin/lib/protocols-skill.mjs:37`, `bin/lib/manifest.mjs:213` | `node --test bin/lib/codex-review-allowance.test.mjs`, `js-harness rules check` | removes one question per review | about 60 lines; Codex about 690,000 (asked once under this slice's own rule only after it lands); his decision D-c | after C (shares `protocols-skill.mjs`, `manifest.mjs`) |
| G | A blocked session's question reaches him without an awake lead: build JH 221's T2 as designed (`odd/tasks/consistent-orders.md:179`), and a `waiting` note whose question stays unanswered shows on the heartbeat; after question 355 the question goes on to the Plan's chat | `bin/lib/stall.mjs`, the one file JH 221's T2 design names (`odd/tasks/consistent-orders.md`, L13), and its test; disjoint from H's `channel.mjs`, `notify.mjs`, `sessions.mjs` | its tests first; high risk 4 (async ordering), an independent verifier | merges into JH 221's existing design | about 120 lines; Codex about 850,000 | C, D, E, H |
| H | The lead's tools: a question is recorded for the Plan, not only `--to orchestrator` (`bin/lib/channel.mjs:136`, question 355; questions 349 to 352 reached him in the Plan's chat by a record and a direct message, so this only stops the Plan's questions landing on the lead's board, L22 Claude 5); `sessions --next-number` also reads the app's session records; the bare board answers inside its budget (profile first, one run) | `bin/lib/channel.mjs`, `bin/notify.mjs`, `bin/sessions.mjs`, their tests | a test with a question to the Plan and one with a started session that sent no notice; one timed run under 30 s | none | about 80 lines; Codex about 745,000 | C, D, E, G |

Total, estimated: about 550 changed lines of code and text, at least 2,168 removed in D, and about 5.5M Codex input
tokens across C to H (about 11M at the tool's high figure, 2.05 times) at today's fit (A and B ride the reviews 227 and 229 already owe). At the allowance as it
stands every slice would be a spend question; F is why that stops, so F's own review is the one asked.

## His to decide (one sitting in JH PLAN's chat, after question 355: the lead records each and sends it; `rule:owner-decisions`)
- **D-a, the words of the rules this plan changes.** Proposed now, each to quote his typed lines, not taps alone
  (L22): `f5c3ee4d` line 1362 ("todas las preguntas del orquestador ... aca en el plan", under question 355) and line
  3672 ("Listo ahora hazlo no me pidas que lo haga tu tienes comunicacion", under question 354).
  - `senior-model`, subject: "the model a senior session runs on, titled <code> SR · <purpose>, which the lead opens
    with start_session and sends the judgment a task needs: a design, a depth pass, a decision".
  - `owner-decisions`, one clause added to protocol 1: "one approval covers a whole piece of work: a miniplan or a
    charter he approved names its sessions, its reviews and its spend, and none of them is asked again".
  - `sessions-open-in-sidebar`, subject unchanged; the skill names it instead of restating the card.
  - Slice F's allowance: "a review inside the Codex spend its miniplan's Budget states is not asked; a piece of
    work that passes it is asked once".
  Options: A, these words (recommended: one sitting, his typed lines quoted); B, he writes other words in "Other".
- **D-b, retiring `stretch`, and with it JH 227's open question whether the open stretch's plan file counts as a
  plan for C2** (slice D: removing something he uses; one question, not two). Options: A, retire it for new work once
  plan v4's stretch closes, and C2 accepts a miniplan only (recommended: it removes a command built for the big plan
  he no longer wants; until then the open stretch's plan counts, so today's starts are not refused); B, keep it and build `stretch amend` so a miniplan's work
  joins an open stretch (adds a verb and keeps the hours and slots); C, keep it untouched for multi-day absences
  only.
- **D-c, review spend** (slice F and the reviews of C to H). Options: A, a miniplan's Budget states the Codex spend
  and his go on the miniplan covers its reviews; one question only when a piece passes it (recommended: one
  approval a piece of work, D3); B, keep a question per review and only raise the floor and rate to today's
  measure; C, both. Also: the spend of this plan's reviews, about 5.5M input tokens estimated (5.5M to 11M), as one
  figure.
- Pending elsewhere, not repeated here: JH 227's open points (C2 refuse or warn; C1's tenth heading; its branch's Codex spend). Answered and built on here: questions 351, 353, 354, 355.

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

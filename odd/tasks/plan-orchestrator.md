# plan-orchestrator — a Plan orchestrator above the lead (JH SR, design only)

## State
Design only, no code. Version 2: the first double review (read 2a17bbe1, 24 findings, all taken, Log L9) changed
the verdict to supports, replaced three clocks with one, and found a host limit on who can open a session
(question 2). Branch `claude/dreamy-nash-50fa03`, worktree `rule-lead-effort-split-aac740`. Next, in order: the
confirming read of this version (review 2 of 3 at most; the first cost 3.29M Claude and 0.65M Codex tokens, one
try), its findings answered; the Spanish page for him (an Artifact, by a writer sub-agent on opus, from this
document, no plan name on it); push and a draft docs PR; the four questions recorded with
`notify --to orchestrator --kind question` in the order of "Ask me before"; `notify --kind ready --pr <n>`, then
`closed`. Reports go only by `js-harness notify --to orchestrator`. The measures and their scripts:
`odd/tasks/plan-orchestrator-evidence/measures.md`.

## Goal
He tells a Plan orchestrator what he wants; it writes the plan as a file the harness records with its author; the
lead executes that plan and cannot change it; and a command, not the lead's word, says where the execution left the
plan in what a record can show.

## Why
His words (Specs 1 to 3): the work is not organized or planned as it should be; he wants a layer above the lead
that plans what he says and hands it planned, the lead launching the sessions and these their swarms, Fable
organizing up front and not executing. The record agrees (Depth pass item 4): of the 67 steps open in the plan on
2026-11-09, 8 are closed a week later, while 201 steps entered the plan in that week and 170 of those closed. The
work is done; it is not the plan's work.

## Done when
- `js-harness contract check odd/tasks/plan-orchestrator.md` exits 0
- `npm run check` exits 0
- each double review's read id and every finding's answer are in the Log
- `odd/tasks/fanout-tree.md` holds his line 992 in its Log (T2), in one file with one history

## In scope / Out of scope
- In: this document and its evidence folder; the Log line of `odd/tasks/fanout-tree.md`; the Spanish page; a draft
  docs PR.
- Out: every file under `bin/` (design only). At the build, the board (`js-harness sessions`) says who holds what
  that day; today: JH 211, building T7 and T8 of `odd/tasks/senior-orchestrator.md` (`bin/lib/sessions.mjs`
  `TITLE_SHAPE`, `bin/guard.mjs`, `bin/lib/guard.mjs`, `bin/lib/lead-protocols.mjs`, `bin/lib/manifest.mjs`,
  `bin/lib/session-title-guard.mjs`, the home reporters, `bin/loop.mjs`); JH 208 (`stretch*`, `advisor-gate*`,
  `reply*`, `subagent-check`) and JH 209 (`sessions.mjs` readers), as `fanout-tree.md` lists them; the build of
  `fanout-tree.md` itself, which lists `bin/notify.mjs`. The four Delegation lines of `fanout-tree.md` (45 to 48)
  and his three pending answers on 46 to 48.
- Out, kept apart from the Specs: the lead's six proposals (Log L3), which he did not type. Line 1206 is his reply
  to the question that closed them, read here as a yes; that reading is this session's and his to correct.

## Constraints
- A rule of his changes only with words he typed (`rules change`, a quotation with its date); a tapped answer is
  recorded as "Tapped, not quoted" and carries no rule change. What each rule needs: `rule:remote-control-yes`
  (its subject, `bin/lib/rules-data.mjs:475`, and the step in `bin/lib/host-update.mjs:194-205`) and the source
  reading of `rule:sessions-open-in-sidebar` have their source, Spec 7. `rule:questions-one-place` (its subject,
  `bin/lib/rules-data.mjs:454`, and the skill's lines, `bin/lib/manifest.mjs:134-143`) and `rule:lead-charter`
  (its text, `bin/lib/manifest.mjs:155`: to whom the lead reports and whom it asks) have none: question 1 asks for
  his line.
- The host opens a session with `start_session` only on a turn he typed; on a turn a notice or a session's message
  started, it leaves a card he must tap (`bin/lib/manifest.mjs:157`). No background session, ever (Spec 5), so the
  other way is gone once T7 lands — because of this, whoever opens the sessions does it on his typed line or on
  his tap (question 2).
- No session nested (Spec 6): the Plan is a visible app session, detached.
- One more session in the chain is one more place to hold work: every hop this design adds is a file or a recorded
  notice a command can time — because the plan's failure on record is work that waits or enters unseen.
- The orchestrator skill text (`bin/lib/manifest.mjs:112-258`) ships to every project: the Plan part reads "where a
  Plan orchestrator holds its role" and a project without one reads as today. New rules are scoped `repository`.
- Guard, title and skill changes are high risk (items 2 and 3): tests first, an independent verifier after.
- Fable is the scarce meter: nothing here adds a Fable call that a command can replace.

## Ask me before
Four questions, one at a time, in this order, recorded after the confirming read; the lead puts them to him.
Phase 0 is not asked: it is the answer to his "dime que tenemos que hacer" (Spec 3), and only question 2 changes
one of its steps.
1. Where his questions reach him: only in the Plan's chat (the lead stops asking him), or in both. A yes to "only
   the Plan" changes two rules and needs one typed line.
2. Who opens the work sessions, given the host's limit: the lead, on one line he types in the lead's chat or on a
   card he taps there (his design as he said it; recommended), or the Plan, in the same turn he approves the plan,
   the lead then supervising them (one step fewer; the Plan executes a little).
3. The Plan's model and level: Fable 5.2 at high (his "el modelo que organiza todo de entrada"; the level is this
   session's reading). Its cost is an estimate that phase 0 measures (The design, "Cost").
4. "enjambres de sesiones": sub-agents inside each session (what `fanout-tree.md` designs), or sessions that open
   sessions (a second level, under his cap of 6 and his "nunca anides las sesiones").

## Depth pass
- 1. Method: separating planning from execution is the control-plane split of an operations team: a planner writes
  a work order with its acceptance test, a dispatcher runs it, and an auditor measures the run from the records,
  never from the dispatcher's report. Its standard: the order is a versioned file with a checkable shape; the
  dispatcher may not change it; a deviation is a clock or a comparison on a record. The smallest change that meets
  it reuses what exists (searched: `js-harness rules`, codegraph, the skills, `odd/tasks/`): the role is the
  onboarding's "plan orchestrator" made lasting (`odd/tasks/onboarding.md:138-139`, `bin/lib/onboard.mjs:832`); the
  order is the stretch plan (`js-harness stretch open --plan`: goals that are commands, items one session each,
  lanes, forks pre-decided) with the roadmap; the title role follows `SR` (`odd/tasks/senior-orchestrator.md`); the
  clock extends the stall clock (`bin/lib/stall.mjs`, `rule:session-stall`, read by the heartbeat and by
  `js-harness wait`); plan adherence is `js-harness progress --baseline`. No new command, one new module at most.
- 2. Raw material (window of the counts: the 7 days ending 2026-11-16T02:20Z, local time UTC-05:00; scripts and
  outputs in `odd/tasks/plan-orchestrator-evidence/measures.md`):
  - His words: `js-harness sessions --quote 699d7c29-54c4-460e-a5e8-700b114eb251 <969|992|1153|1206|1389|519|402>`;
    `--quote 69918425-3b43-430f-9f50-62b6422422ce 20757`.
  - The plan against the work: `js-harness progress --baseline 2026-11-09` and `progress --pace --days 7`, run
    2026-11-15: 67 steps open then, 8 of them closed (12%), 59 still open; 201 steps added since, 170 of them
    closed; open steps 67 then, 90 now; no step reopened.
  - The title parser knows three roles: `bin/lib/sessions.mjs:1248`; `roleOfTitle('JH PLAN · x')` is `null` (run
    2026-11-15). `roleNamed` takes only the orchestrator or a number (`bin/lib/sessions.mjs:1297`); a question is
    refused for any other address (`bin/lib/channel.mjs:131`). One live lead is not enforced, only warned
    (`bin/lib/sessions.mjs:3096`); `set_session_title` is not judged by the guard (`bin/lib/hook-entries.mjs:82`).
  - The channel record (`latency.mjs`): 93 ready notices, 88 naming a PR, 87 merged; ready to merge, median 10
    minutes, 21 over 60. Of those 21, 15 were ready between 22:00 and 07:00 local and 9 had a question open; 14 are
    one cluster, PRs 795 to 812. So the lead lands fast, and the tail is mostly night and open questions; which of
    it was his absence or a red gate is not classified.
  - Questions: 75 recorded, 70 answered with both stamps. Record to shown: median 0 minutes, 12 over 60 (9 of them
    by day), 5,562 minutes in all, not classified (work running, him away, the lead busy), so not "the lead's
    hold". Shown to answered: median 2 minutes, 3 over 60, 809 minutes in all.
  - PR 883 (`replay.mjs`, and the channel record lines 3109 to 3115): ready 06:36 local; left out of a land as a
    draft; its verifier failed at 07:09; the lead's note at 07:12, "hold it for the owner"; question 288 recorded
    10:08, shown 14 minutes later, answered 10:22; merged 10:26. The old lead's page calls the 176 minutes (07:12
    to 10:08) the funnel; `rule:away-autonomy` told the lead to hold a block for him while he was away. Both are
    true: the hold followed a rule, and nothing showed it to anyone while it lasted. It is one case, not a trend.
  - The stall clock blames the wrong side: a `ready` notice does not give handed work back
    (`bin/lib/stall.mjs:21`), so a session whose PR waits on the lead reads STALLED after 60 minutes (a reader's
    finding; T3 checks it with a fixture before building on it).
  - Stretches (`stretches.jsonl` under `.js-harness/throughput/D--js-harness`): 16 opened and 16 closed; 45 items,
    30 naming their session at the opening, 7 binds, so 37 of 45 at most. One stretch can be open at a time
    (`bin/stretch.mjs:68`); `bind` takes a replacement session from anyone (`bin/stretch.mjs:502-518`).
  - Sub-agent launches (`fanout-tree.md`, Depth pass item 2): 1 pair of 23 launched together across four sessions.
  - Fable (the app tool `get_usage`, read 2026-11-15 by the cost reader, not by this session): weekly Fable 14%,
    all models 34%, reset 2026-11-20T14:00Z. Since the reset of 2026-11-13T14:00Z: 252 advisor calls, 47.7M input
    tokens never cached and 2.5M output, about 189k input a call; Fable as a working model 30.2M cache read, 3.6M
    cache write, 0.83M output. No command of the harness reads this meter (`bin/codex-meter.mjs` reads Codex's).
    An advisor comes from `advisorModel` in his `~/.claude/settings.json`, which the harness checks and never
    writes (`bin/lib/home-doctor.mjs:36-42`); a sub-agent inherits it (`odd/tasks/advisor-home.md:118-121`): 65 of
    109 sub-agents since the reset consulted it.
- 3. The bar:
  spec 1: `node --test bin/lib/sessions.test.mjs`: none, new behaviour (`roleOfTitle('JH PLAN · x')` is null today)
  spec 2: `js-harness progress --baseline 2026-11-09`: 8 of 67 steps open then are closed (12%), 201 added; the target is set at T8 from the first two weeks under a Plan
  spec 3: `js-harness contract check odd/tasks/plan-orchestrator.md`: phase 0 needs no code; what it cannot do is listed in "Phase 0"
  spec 4: left out because JH 211 builds it as T8 of `odd/tasks/senior-orchestrator.md`; this design only reads its result
  spec 5: `node --test bin/guard.test.mjs`: none, new behaviour (the Plan opens visible; a PLAN start by `sessions start` is refused once T7 lands)
  spec 6: `node --test bin/guard.test.mjs`: none, new behaviour (a Plan start is held to one live Plan, its own worktree, then detached)
  spec 7: `node --test bin/lib/host-update.test.mjs`: none, new behaviour (the host-update step names the orchestrator session alone today, `bin/lib/host-update.mjs:194-205`)
- 4. Refutation: his complaint is the planning (Spec 2), so the request fails if the plan already drives the work.
  Run 2026-11-15: `js-harness progress --baseline 2026-11-09`. Result: 8 of the 67 steps open that day are closed
  (12%), and 201 steps entered the plan since. The plan does not drive the work, so the request holds. A second
  test, which the first version of this pass ran alone and read too far: does a plan file already exist? It does
  (16 stretches opened), so the remedy is not a file; it is who writes the plan, that the lead cannot change it, and
  that work entering outside it is seen. The measure comes from the roadmap's checklist: a step reworded without
  its id counts as removed and added, so the 201 is an upper bound of new work.
  Verdict: supports
- 5. Request: "Put a Plan orchestrator above the lead. He tells it what he wants; it writes the plan as a file the
  harness records with its author and version (what runs, in which session, what runs at the same time, what is
  decided ahead); the lead executes it and cannot change it; one clock on the records says when work handed to the
  lead waits, and one figure says how much of the plan was done against how much entered outside it. Remote Control
  on both orchestrators. Start today by hand with what needs no code."
  Adds: none

## Specs
1. "No me esta gustando nuestra forma de trabajar, yo creo que debemos tener el Senior  pero tener un orquestador
   mas con el que yo me comunique y le diga las cosas y este es el que haga el plan y las instrucciones al
   orquestador principal que va a ser por decir este por que siento que tu no estas haciendo las cosas como deberian
   ser" (2026-11-16T00:54Z, 699d7c29 line 969)
2. "no organizas o planificas como deberias yo creo que vamos a necesitar una capa por encima que sea el Orquestador
   Plan y las cosas que le diga a el el las planifica pero te manda la informacion a ti ya planificado y ya tu
   lanzas las sesiones y estas lanzan los enjambres de sesiones y asi yo creo que podriamos trabajar con una calidad
   altisima sin utilizar siempre fable por que es como el modelo que organiza todo de entrada pero no el que ejecuta
   las cosas y el Senior es para cosas muy especificas e igualmente todas las sesiones y sub agentes tienen su
   advisor Fable}" (2026-11-16T00:57Z, line 992)
3. "Listo comencemoslo aplicar de una vez dime que tenemos que hacer" (2026-11-16T02:01Z, line 1206)
4. "ademas la sesion orquestadora siempre debe estar en alto y es algo que el harness pueda revisar y cuadrar por
   ejemplo en este momento estamos en medio" (2026-11-16T00:17Z, line 519)
5. "ok recuerda que no se puede abrir ninguna sesion en segundo plano" (2026-11-16T00:10Z, line 402)
6. "vuelve a abrir el JH SR y nunca anides la sesiones ademas de que ya ninguna va con remote control solo el
   Orquestador" (2026-11-15T22:16Z, 69918425 line 20757)
7. "El orquestador plan debe tener Remote control osea este y el Plan" (2026-11-16T02:22Z, 699d7c29 line 1389)

## The design
- **The role.** A session titled `<code> PLAN · <purpose>`, role `plan`: the onboarding's plan orchestrator, which
  today ends when the roadmap is approved, made lasting. One live Plan. It owns no feature and reads no code: what
  needs code read goes into the plan as an item (a design item for a work session, or one routed to the senior).
  Its own readers, when it needs a fact, are opus sub-agents launched together.
- **Who opens the Plan, and its relief.** In phase 0 he does, from the app. After the build the lead starts it as
  it starts the senior (`start_session` with a wait-only brief, the session tools set its model and level, then
  `detach_session`), the guard holding the start. A relief follows the lead's own handover
  (`bin/lib/manifest.mjs:223-230`): the outgoing Plan starts `<code> PLAN nueva · …`, a title that holds no role, so
  one live Plan stays true; it writes its relief file; it renames itself `PLAN relevada`, and the new one takes the
  title. Tests: a second Plan refused, a relief that completes, a successor that fails to start, and no moment with
  two holders.
- **The senior keeps one sender, the lead** (`senior-orchestrator.md` D10, lead-only in the guard). The Plan asks
  for senior work as a plan item routed `senior`; the lead sends it.
- **The plan is a versioned file** (proposal 1). Order and decisions: `docs/ROADMAP.md`, by docs PRs, as today. The
  plan in force is the open stretch. `stretch open` records the plan's hash and the session that opened it. A
  second request while one runs is an amendment, `stretch amend --plan <file>` (new, an option of the existing
  command): it adds items, goals or forks as the next version, with its author, and never closes the measurement
  of the first. Only the Plan opens or amends (the lead, where no Plan holds its role). The lead binds sessions to
  items, which is execution; a bind over a bound item is recorded as a reassignment. An item gains `surfaces` (the
  files it may touch), `together` (the items it runs beside) and `route` (`inline`, `readers <n>`, `writers` with
  their surfaces, `senior`); `stretch open` and `amend` refuse two items declared together whose surfaces overlap.
- **What a record can show, and what it cannot.** Held: the plan's author and version; an item's surfaces against
  the files its PR changed, said in its ready notice; the clock below; adherence. Audit only, never presented as
  held: the route a session really took and the order it worked in.
- **One clock: work handed to the lead** (proposal 3). `bin/lib/stall.mjs` already times work handed to a session.
  It gains the other side: a `ready` notice until its land or a question naming it is shown, a `waiting` notice
  until a notice or a message of the lead to that session, a question until it is shown. Past a new threshold, `lead-stall`
  (to be declared as a rule with a flag, as `rule:session-stall` is; 30 minutes proposed, fixed only after T3 replays it on
  the record) the heartbeat and `js-harness wait` print the line, at every hour, saying whether a stretch of his
  absence is open (`rule:away-autonomy`), so a hold that follows a rule is seen and not blamed. The Plan keeps
  `wait` on that condition with no time limit while a stretch is open: no token is spent until the line appears.
  A ready notice also stops counting against the session that sent it. Dropped, with the reason: a clock on items
  with no session (30 of 45 items named their session at the opening; no forgotten item is on record) and one on
  lanes; T8 measures both before anything is built for them.
- **One figure: adherence.** `progress --baseline <the plan's opening day>` at each stretch's close, in its return:
  the share of the steps open then that closed, and the steps that entered since. Today: 12%, 201 entered.
- **Where he talks** (proposal 2, amended by Spec 7). Remote Control on both orchestrators and on no other
  session; the host-update step turns it back on in both. He tells the Plan what he wants and approves the plan
  there. Where his questions reach him is question 1; if only in the Plan, a question is recorded once, addressed
  to the session that holds his chat, with no relay through the lead, and the Plan answers what is inside the plan
  and asks him only what `rule:owner-decisions` lists.
- **Who opens the work sessions** (question 2). The host opens a session only on a turn he typed. As he designed
  it: he approves the plan in the Plan's chat, the Plan gives him one line, he sends it in the lead's chat, and the
  lead opens that wave's sessions in that turn; a later wave needs his next line or a card he taps. Not checked:
  whether a turn that follows his typed turn can open one more; phase 0 shows it.
- **What runs at the same time** (proposal 4). The plan's `together` and `surfaces` are the declared units
  `fanout-tree.md` spec 3 waits for. Sub-agent swarms inside a session stay that document's, under his three
  pending answers; the reading of "enjambres de sesiones" is question 4.
- **Double review** (proposal 5, already `rule:double-review`). A plan put to him passes it, by the rule's own
  exemptions and no other. Estimate: 3 to 5 such plans a week; a read is about 1% of Codex's weekly limit, and this
  document's first read cost 3.29M Claude tokens against the 1.1M the command states.
- **The advisor.** Every session and sub-agent already has the Fable advisor from his settings, so that part of
  Spec 2 holds today (nothing "pending" was found: searched `advisor` and `sub-agent` in `odd/tasks/advisor-*.md`,
  `bin/lib/lead-protocols.mjs` and the rules). The Plan on Fable would be advised by Fable itself, so it is exempt
  from the advisor gate, and its second opinion is the double review. The gate knows a senior only by the
  background command's record (`bin/advisor-gate.mjs:199-220`, `:307`), which a visible session never writes: T5
  gives the gate the app's session records as its source, with tests for a visible PLAN and SR and for a work
  session titled like them.
- **Cost, a guess until phase 0 measures it.** Weights assumed, the API's price ratios (input 1, cache read 0.1,
  cache write 2, output 5); how the weekly meter weighs a cache read is not known. Since the reset: Fable working,
  30.2M x 0.1 + 3.6M x 2 + 0.83M x 5 = 14.4M; the advisor, 47.7M + 2.5M x 5 = 60.2M; together 74.6M for 14%, so
  1% is about 5.3M, and the advisor is 81% of it. A Plan that reads no code, assumed a third of the Fable lead of
  2026-11-11 (40M cache read, 2M cache write, 0.15M output a day): 4 + 4 + 0.75 = 8.8M a day, about 1.7% a day,
  12% a week. One that works as that lead did (113M cache read a day): about 22M a day, 4% a day, 29% a week. Today's
  pace is about 39% a week. Phase 0 reads `get_usage` before the Plan's first day and after its third.
- **Reach.** This repository first: the new rules are scoped `repository`; the skill's Plan part is conditional.

## Phase 0, today, no code
What he does, in order (Spec 3):
1. The lead lands this document's docs PR, so the Plan can read it on main, and stores the Plan's opening with
   `js-harness notify --opening`.
2. He opens a session in the app on Fable 5.2 at high (question 3: another level is his to pick there), names it
   `JH PLAN · planes`, turns Remote Control on in it (Spec 7) and sends it the opening's first message.
3. He tells it what he wants. It writes the plan (a stretch plan, and a roadmap PR where the order changes), passes
   the double review and shows him the page.
4. He approves. The Plan gives him one line; he sends it in the lead's chat; the lead opens the sessions.
What it cannot do until the build: `notify --to plan` throws, so sessions report to the lead and the lead forwards
by message; his questions stay in the lead's chat (`rule:questions-one-place`) until his typed line changes it; the
board and `rules applied` list the Plan off the home, read as a work session on Fable; the advisor gate is not
exempt, about 189k Fable tokens for each gated act; `stretch amend` does not exist, so a second request waits for
the open stretch to close or goes in as roadmap steps; no clock runs, so the audit is the Plan reading
`js-harness sessions`, `stretch status` and `progress --baseline` when he asks.

## Tasks
Order: T3 can start at once in its own session (X) and collides with nobody but `bin/loop.mjs`, which waits for
JH 211's T8; T4 follows in X once JH 208 releases `stretch*`. T5 to T7 are one session (Y), in order, after JH 211's
T7 and T8 land and JH 209 releases `bin/lib/sessions.mjs`. X and Y run together, their surfaces disjoint but
`bin/notify.mjs`: T4 lands its part first. Inside each, round one reads with opus readers launched together; a
writer sub-agent only where two units have disjoint surfaces.
- [ ] T1 (kind: design) (1, 2, 3) This document, its double reviews, the page, the questions. Route: inline, JH SR.
- [x] T2 (kind: docs) (2) `odd/tasks/fanout-tree.md`: `docs/fanout-tree` merged into this branch (8288102e) and its
  Log line L8, his line 992 and the reopened reading of "sub sesiones" (5b02f348). Route: inline, JH SR.
- [ ] T3 (kind: build) (2) The lead's side of the stall clock: `bin/lib/stall.mjs` and its test, the new rule `lead-stall`
  with its flag, read by `bin/wait.mjs` (a condition with no time limit) and, after JH 211's T8, by `bin/loop.mjs`.
  Fixture first, replayed on the 7-day record: PR 883 is printed with "a stretch of his absence is open", the
  cluster 795 to 812 as one event. Session X, branch `rule/lead-stall`. High risk 4 (a wait that never ends): a
  verifier.
- [ ] T4 (kind: build) (2) The plan file: hash and author at `stretch open`, `stretch amend`, the reassignment
  record, `surfaces`, `together` and `route`, the overlap refusal, adherence in the return, the surfaces line of a
  ready notice (`bin/notify.mjs`). Session X, after T3 and after JH 208 releases `stretch*`. Surfaces:
  `bin/lib/stretch.mjs`, `bin/stretch.mjs`, `bin/notify.mjs`, their tests. Negative fixtures: a plan amended by a
  session that is not the Plan, a reassignment, an edit outside an item's surfaces, two overlapping requests.
- [ ] T5 (kind: build) (1, 5, 6) The role: `PLAN` in `TITLE_SHAPE`, `roleOfTitle` and `roleNamed`, an inbox
  address, `rule:session-title`'s text; `plan-model` and `plan-effort` in a home of their own, held by role in the
  reporters; the guarded start and the relief; the gate's source of a title. Session Y, branch `rule/plan-role`.
  High risk 2 and 3: a verifier. Surfaces: `bin/lib/sessions.mjs`, `bin/lib/session-title-guard.mjs`,
  `bin/lib/inbox.mjs`, `bin/lib/channel.mjs`, `bin/lib/model-shape.mjs`, `bin/lib/model-home.mjs`,
  `bin/lib/rules-data.mjs`, `bin/lib/rules-coverage-data.mjs`, `bin/guard.mjs`, `bin/lib/guard.mjs`,
  `bin/advisor-gate.mjs`, the five reporters, their tests.
- [ ] T6 (kind: build) (1, 7) His desk: Remote Control on both orchestrators (`bin/lib/host-update.mjs`,
  `rule:remote-control-yes` and `rule:sessions-open-in-sidebar` by `rules change`, source line 1389); and, only on
  his typed line (question 1), a question addressed to the session that holds his chat (`bin/lib/channel.mjs:131`,
  `bin/notify.mjs`) with `rule:questions-one-place` and `rule:lead-charter`. One commit a rule. Session Y, after
  T5. High risk 3: a verifier.
- [ ] T7 (kind: docs) (1, 2) The texts: "The plan orchestrator" in `bin/lib/lead-protocols.mjs` and the Plan's part
  of the orchestrator skill (`bin/lib/manifest.mjs`), conditional on a Plan holding its role. Session Y, after T6.
  High risk 3: a verifier.
- [ ] T8 (kind: verify) (1, 2, 3) After phase 0's third day: weekly Fable against the guess; whether a wave after
  the first opened without his line. After the build, the lead starts the first guarded Plan and one real request
  goes through plan, lead, sessions and clock. Fourteen days later, from the records: adherence against 12%, the
  lead-stall lines, the share of items naming a session (30 of 45 at the opening), the launched-together count (1
  pair of 23). Route: the lead.
- [ ] T9 (kind: docs) (1) His answer to each of the four questions in this Log with its transcript line, on a docs
  branch. Route: the lead, or the Plan once phase 0 runs.

## Log
- L1 2026-11-16, his words: Specs 1 to 7, each read with `sessions --quote` by this session.
- L2 2026-11-16, the lead's task (message to JH SR): design only; ground it in `sessions.mjs:1248`, `fanout-tree`,
  `senior-orchestrator` D2 and D8, the four rules, the PR 883 finding; report by `notify`; ask him nothing.
- L3 The lead's six proposals (699d7c29 line 1171), not his words: the plan as a file; one place to talk, the Plan;
  the Plan reviews the lead from the board and the records; the plan says what runs in parallel; the plan passes
  the double review; the Plan reads no code. The lead closed them with a question, what he would change or add
  before JH SR writes the design; his next typed line is 1206, and line 1389 amends proposal 2 alone. Read here as
  a yes to 1 and 3 to 6; "The design" narrows 6 to one sender for the senior.
- L4 Four opus readers launched together, read-only: the role's plumbing; the channel, the questions and the audit
  sources; his conversation and the old lead's plan page; the advisor's source and Fable's cost. One thing of each
  checked here before use: `roleOfTitle('JH PLAN · x')` null; `onboarding.md:138-139` and `:269-272`; his lines by
  `--quote`; the latency figures by this session's own scripts. Not checked: the readers' token sums by model, the
  `get_usage` reading (this session did not call it), the file lists of JH 211's T7 and T8.
- L5 A reading left open on purpose: the lead read his "enjambres de sesiones" as sub-agents (line 1043) and he did
  not confirm it; `fanout-tree.md` reads his earlier "sub sesiones" the same way. Question 4.
- L6 The advisor before writing: replay PR 883 against the metric; classify the tails before quoting them; count
  the stretches. All three were run.
- L7 The usage tool names his plan otherwise than this project's notes do; the page gives no plan name.
- L8 2026-11-16T02:22Z, his decision, typed (Spec 7), carried by the lead and read here with `--quote`: Remote
  Control on both orchestrators. What stays open is where his questions reach him (question 1).
- L9 Double review 1, read 2a17bbe1 (`rule:double-review`; cost said first, 1.1M Claude and 0.9M Codex stated;
  measured 3,287,320 Claude and 654,140 Codex tokens): Claude 16 findings, Codex 8, all 24 taken. A mistake of the
  first version, told: it called the verdict "refutes" from a test of the wrong thing (whether a plan file exists,
  and the lead's own list of its failures), misread PR 883 (a draft with a failed verifier, held under
  `rule:away-autonomy`; question 288 shown 14 minutes after its record, not at once; 06:36 is inside the night
  band), and quoted "bound less than once in two stretches" from bind events alone (30 of 45 items name their
  session at the opening). Fixed here and checked by rerunning each count; what stops it: the measures and their
  scripts are committed beside this document, so a reader reruns them.
  - Claude 1 (line 1389 missing): Spec 7, the Goal and the Request no longer say "one session" or "alone".
  - Claude 2 (PR 883 misread): Depth pass item 2 rewritten; the clock runs at every hour and names an open absence.
  - Claude 3 and Codex 7 (binding figure false), shared: recounted from the openings; the item clock is dropped.
  - Claude 4 (the refutation tested the wrong thing): restated against the plan itself, `progress --baseline`.
  - Claude 5 (line 1206 answers the lead's question): L3 and "Out of scope" say so, as a reading.
  - Claude 6 (the gate's exemption misses a visible session): T5 names the gate's new source and its tests.
  - Claude 7 (clocks that exist): the clock extends `stall.mjs`; its threshold is a declared rule.
  - Claude 8 (Spec 3 dropped): Phase 0 is a list of his steps, not a question.
  - Claude 9 (the read copy was superseded): this version is read again whole; T2 is ticked.
  - Claude 10 (a Done-when with no owner): his answers moved to T9, the lead's.
  - Claude 11 and Codex 8 (cost arithmetic), shared: "Cost" shows each sum and one figure a call; the guess is
    measured in phase 0.
  - Claude 12 (which text of each rule): Constraints name the text and the line of each.
  - Claude 13 (four Delegation lines, three answers): corrected in "Out of scope".
  - Claude 14 and Codex 8 (scripts in a scratchpad, window unstated), shared: the evidence folder; the window is
    stated with its zone.
  - Claude 15 (`wait` ends at 480 minutes): the clock's condition has no time limit while a stretch is open (T3).
  - Claude 16 (collisions with JH 209 and fanout-tree's build): "Out of scope" and Tasks name them and the board.
  - Codex 1 (the lead cannot open a session on a turn he did not type): checked at `bin/lib/manifest.mjs:157`; a
    Constraint, a design paragraph and question 2.
  - Codex 2 (the checks do not prove the plan was followed): the Goal promises only what a record shows; version,
    author and surfaces are held, route and order are named audit-only.
  - Codex 3 (the item clock's predicate): the clock is dropped, measured at T8 first.
  - Codex 4 (relief against one live Plan): the lead's handover titles, with tests.
  - Codex 5 (a one-item exemption he did not grant): removed; the rule's own exemptions stand.
  - Codex 6 (one open stretch, two requests): `stretch amend`.

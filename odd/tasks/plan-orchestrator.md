# plan-orchestrator — a Plan orchestrator above the lead (JH SR, design only)

## State
Design only, no code. Written: the contract, the depth pass (verdict: refutes the role alone), the specs, the tasks
and the Log. Branch `claude/dreamy-nash-50fa03`, worktree `rule-lead-effort-split-aac740`. Next, in order: commit
(done when this line is on the branch); `js-harness double-review read odd/tasks/plan-orchestrator.md` (cost said
first: about 1.1M Claude and 0.9M Codex tokens, about 1% of Codex's weekly limit; one try), `double-review take` for
each reader, every finding answered in the Log; merge `docs/fanout-tree` in and add its Log line (T2); the Spanish
page for him (an Artifact, by a writer sub-agent on opus, from this document); push, draft docs PR; the five
questions recorded with `notify --to orchestrator --kind question`, in the order of "Ask me before"; then
`notify --kind ready --pr <n>` and `closed`. Reports go only by `js-harness notify --to orchestrator`. Scripts of
the measures: this session's scratchpad, `latency.mjs` and `replay.mjs` (Depth pass item 2 gives their results).

## Goal
He talks to one session, the Plan orchestrator, which turns what he says into a plan file the lead executes, and the
harness, not the lead's word, says whether the execution follows the plan.

## Why
His words (Specs 1 to 3): he is not happy with how the work is organized and planned; he wants a layer above the lead
that plans what he says and hands it planned, the lead launching the sessions and these their swarms, Fable
organizing up front and not executing. The records add what the layer must hold to be worth its cost (Depth pass
item 4): the plan-as-a-file tool exists and was used 16 times in 7 days, so a new role that only writes better prose
changes nothing; what no command sees today is a lead that holds work without asking (PR 883) and a plan item
nobody started.

## Done when
- `js-harness contract check odd/tasks/plan-orchestrator.md` exits 0
- `npm run check` exits 0
- the double review's read id and each finding's answer are in the Log
- his answer to each question of "Ask me before" is in the Log with its transcript line
- `odd/tasks/fanout-tree.md` holds his line 992 in its Log (T2), in one file with one history

## In scope / Out of scope
- In: this document; the Log line of `odd/tasks/fanout-tree.md`; the Spanish page; a draft docs PR.
- Out: every file under `bin/` (design only). JH 211's surfaces while it builds T7 and T8 of
  `odd/tasks/senior-orchestrator.md`: `bin/lib/sessions.mjs` (`TITLE_SHAPE`), `bin/guard.mjs`, `bin/lib/guard.mjs`,
  `bin/lib/lead-protocols.mjs`, `bin/lib/manifest.mjs`, `bin/lib/session-title-guard.mjs`, the home reporters.
  JH 208's (`stretch*`, `advisor-gate*`, `reply*`, `subagent-check`, as `fanout-tree.md` lists them; the board says
  who holds what on the day of the build). The three Delegation lines of `fanout-tree.md` (his answers 46, 47, 48).
- Out, kept apart on purpose: the lead's six proposals (Log L3). He did not answer them; line 1206 is a general
  go-ahead. Each is weighed in "The design" and none is a spec.

## Constraints
- Four rules are his and change only with words he typed (`rules change`, a quotation with its date): a tapped
  answer is recorded as "Tapped, not quoted" and does not carry a rule change. `rule:remote-control-yes` and
  `rule:sessions-open-in-sidebar` have their source already, Spec 7. `rule:questions-one-place` and
  `rule:lead-charter` do not, so question 2 asks for a line in his own words — because both say "the
  orchestrator" today.
- No background session, ever (Spec 5), and none nested (Spec 6): the Plan is a visible, detached app session.
- One more session in the chain is one more place to hold work: every hop this design adds is a file or a recorded
  notice a command can time, never a relay a session must remember — because the funnel on record was a session
  holding, not a machine (Depth pass item 2).
- The orchestrator skill text (`bin/lib/manifest.mjs:112-258`) ships to every project: the Plan part reads "where a
  Plan orchestrator holds its role" and a project without one reads as today. The rules are scoped `repository`
  first, as `remote-control-yes` is.
- Guard, title and skill changes are high risk (items 2 and 3): tests first, an independent verifier after.
- Fable is the scarce meter: nothing here may add a Fable call that a command can replace.

## Ask me before
Five questions, one at a time, in this order; the first two unblock phase 0. Each is recorded with
`notify --to orchestrator --kind question` after the double review, and the lead puts it to him.
1. The verdict (Depth pass item 4): build the three checks with the role, the checks first (recommended), or the
   role alone, or drop the layer.
2. Where his questions reach him: only in the Plan's chat (the lead stops asking him), or in both. Remote Control is
   settled by Spec 7, on both orchestrators. A yes changes two rules and needs one typed line.
3. The Plan's model and level: Fable 5.2 at high (his "el modelo que organiza todo de entrada"; the level is this
   session's reading). Its cost is an estimate (The design, "Cost").
4. "enjambres de sesiones": sub-agents inside each session (what `fanout-tree.md` designs), or sessions that open
   sessions (a second level, under his cap of 6 and his "nunca anides las sesiones").
5. Phase 0 today by hand, with what it cannot do yet, or wait for the build.

## Depth pass
- 1. Method: separating planning from execution is the control-plane split of an operations team: a planner writes
  a work order with its acceptance test, a dispatcher runs it, and an auditor measures the run from the records,
  never from the dispatcher's report. Its standard: the order is a file with a checkable shape; the dispatcher may
  not change it; a deviation is detected by a clock on a record, with a threshold. The smallest change that meets
  it reuses what exists (searched: `js-harness rules`, codegraph, the skills, `odd/tasks/`): the role is the
  onboarding's "plan orchestrator" made lasting (`odd/tasks/onboarding.md:138-139`, `bin/lib/onboard.mjs:832`); the
  order is the stretch plan (`js-harness stretch open --plan`: goals that are commands, items one session each,
  lanes, forks pre-decided) with the roadmap; the title role follows `SR` (`odd/tasks/senior-orchestrator.md`); the
  audit is one module read by `js-harness wait`. No new command.
- 2. Raw material:
  - His words: `js-harness sessions --quote 699d7c29-54c4-460e-a5e8-700b114eb251 <969|992|1153|1206|519|402>`;
    `--quote 69918425-3b43-430f-9f50-62b6422422ce 20757` and `7262`.
  - The title parser knows three roles: `bin/lib/sessions.mjs:1248`; `roleOfTitle('JH PLAN · x')` is `null` (run
    2026-11-15). `roleNamed` takes only the orchestrator or a number (`bin/lib/sessions.mjs:1297`); a question is
    refused for any other address (`bin/lib/channel.mjs:131`). One live lead is not enforced, only warned
    (`bin/lib/sessions.mjs:3096`); `set_session_title` is not judged by the guard (`bin/lib/hook-entries.mjs:82`).
  - The channel record, 7 days to 2026-11-15 (`C:\Users\Oficina\.js-harness\channel\D--js-harness.jsonl`, script
    `latency.mjs`): 93 ready notices, 88 naming a PR, 87 merged; ready to merge, median 10 minutes, 21 over 60. Of
    those 21, 15 were ready between 22:00 and 07:00 local and 9 had a question open; 14 are one cluster, PRs 795 to
    812, 2026-11-08 to 11-10. Not classified further: which were his absence, which a red gate.
  - Questions, same window: 75 recorded, 70 answered with both stamps. Record to shown: median 0 minutes, 12 over
    60 (9 of them by day), 5,562 minutes in all. Shown to answered: median 2 minutes, 3 over 60, 809 minutes in
    all. The 5,562 are not classified (work running, him away, the lead busy): they are not "the lead's hold".
  - PR 883 replayed (`replay.mjs`): ready 06:36 local, the lead's note "hold it for the owner" 07:12, question 288
    recorded 10:08, merged 10:26. Question 288 was shown at once, so record-to-shown reads 0 for it: the 176
    minutes (07:12 to 10:08) sit before the record. Only a clock from the ready notice to the first of a land or a
    question shown catches it.
  - Stretches (`C:\Users\Oficina\.js-harness\throughput\D--js-harness\stretches.jsonl`): 16 opened and 16 closed
    in the 7 days, 7 binds. The plan file is used; an item's session is named less than once in two stretches.
  - Sub-agent launches (`fanout-tree.md`, Depth pass item 2): 1 pair of 23 launched together across four sessions.
  - Fable (app tool `get_usage`, read 2026-11-15 by the cost reader): weekly Fable 14%, all models 34%, reset
    2026-11-20T14:00Z. Since the reset of 2026-11-13T14:00Z: 252 advisor calls, 47.7M input tokens never cached,
    about 189k a call; Fable as a working model 30.2M cache read. No command of the harness reads this meter
    (`bin/codex-meter.mjs` reads Codex's only). An advisor comes from `advisorModel` in his
    `~/.claude/settings.json`, which the harness checks and never writes (`bin/lib/home-doctor.mjs:36-42`); a
    sub-agent inherits it (`odd/tasks/advisor-home.md:118-121`): 65 of 109 sub-agents since the reset consulted it.
  - The day's failures as the lead told them (699d7c29 line 987): an hour at medium, Remote Control off, a title
    without its "·", a quotation with the wrong line, the reminder about background sessions. After line 1206 he
    asked what there is to do and got no list (lines 1206 to 1343).
- 3. The bar:
  spec 1: `node --test bin/lib/sessions.test.mjs`: none, new behaviour (`roleOfTitle('JH PLAN · x')` is null today)
  spec 2: `node --test bin/lib/plan-audit.test.mjs`: none, new behaviour (no command times a ready notice or finds an item with no session; replayed by hand, PR 883 is caught at 06:36 plus the threshold)
  spec 3: `js-harness contract check odd/tasks/plan-orchestrator.md`: phase 0 needs no code; what it cannot do is listed in "Phase 0"
  spec 4: left out because JH 211 builds it as T8 of `odd/tasks/senior-orchestrator.md`; this design only reads its result
  spec 5: `node --test bin/guard.test.mjs`: none, new behaviour (a PLAN start by `sessions start` is refused once T7 lands; the Plan opens visible)
  spec 6: `node --test bin/guard.test.mjs`: none, new behaviour (a Plan start is held to one live Plan, its own worktree, then detached)
  spec 7: `node --test bin/lib/host-update.test.mjs`: none, new behaviour (the host-update step names the orchestrator session alone today, `bin/lib/host-update.mjs:197-205`)
- 4. Refutation: the request fails if a plan written as a file already exists and is used, and the failures on
  record are ones a planner above the lead would not see. Run 2026-11-15: `node replay.mjs` (this session's
  scratchpad). Result: 16 stretches opened in 7 days, so the file exists and is used; 4 of the 5 failures of line
  987 are execution (level, Remote Control, title, quotation), which a planner does not catch and a check does; the
  lead lands at a median of 10 minutes and shows a question at a median of 0; PR 883's 176 minutes are invisible to
  every clock that exists. What the record does support: sessions seldom split work (1 pair of 23), items are bound
  less than once in two stretches, and nobody sees a lead that waits. So the role alone, as prose, would change
  nothing measured; the role with a plan file the checks read, and three clocks on the records, would.
  Verdict: refutes
  answered: question 1 of "Ask me before" (recorded after the double review; its number goes in the Log)
- 5. Request: "Put a Plan orchestrator above the lead: he talks to it alone; it writes each plan as a file the
  harness checks (what runs, in which session, what runs at the same time, what is decided ahead), the lead executes
  it and may not change it, and three clocks on the records tell the Plan when the lead holds work, leaves an item
  without a session or runs fewer lanes than planned. The checks are built with the role, first. Start today by hand
  with what needs no code."
  Adds: the three clocks, built before the role (question 1)

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
- **Who opens it.** In phase 0 he does, from the app. After the build the lead starts it as it starts the senior
  (`start_session` with a wait-only brief, then the session tools set its model and level, then `detach_session`),
  and an outgoing Plan starts its relief the same way; the guard holds the start. The Plan starts no work session.
- **The senior keeps one sender, the lead** (`senior-orchestrator.md` D10, lead-only in the guard). The Plan asks
  for senior work as a plan item routed `senior`; the lead sends it. This answers proposal 6 without a second
  sender.
- **The plan is a file** (proposal 1, taken). Order and decisions: `docs/ROADMAP.md`, by docs PRs, as today. A
  request's plan: the stretch plan JSON, which `stretch open` already checks, gaining per item `surfaces` (the
  files it may touch), `together` (the items it runs beside) and `route` (`inline`, `readers <n>`, `writers` with
  their surfaces, `senior`); `stretch open` refuses two items declared together whose surfaces overlap. The forks
  are the decisions taken ahead. The lead executes the plan and may not change it or its order
  (`rule:owner-decisions`): it proposes a change to the Plan by a notice. A small request is one item, not a chat.
- **One place to talk** (proposal 2, his to decide, question 2). A question is recorded once and addressed to the
  session that holds his chat: the Plan where one is live, the lead where none is. No relay through the lead. The
  lead's own doubts go to the Plan the same way, and the Plan answers what is inside the plan and asks him only
  what `rule:owner-decisions` lists. Remote Control is on in both orchestrators, the Plan and the lead, and in no
  other session (Spec 7, which replaces "solo el Orquestador" of Spec 6): the host-update step turns it back on in
  both, and `rule:remote-control-yes` and `rule:sessions-open-in-sidebar` change with line 1389 as their source.
- **Three clocks, read from the records by a command** (proposal 3, taken and made concrete). `ready-age`: a ready
  notice with neither a land nor a question shown, past a threshold by day. `waiting-age`: a waiting notice or a
  question from a session, with no act of the lead toward it, past a threshold. `item-unbound`: a stretch item
  with no session, and fewer live lanes than the plan's, past a threshold after the plan opened. One module
  (`bin/lib/plan-audit.mjs`) read by `js-harness wait`, which the Plan keeps running in the background: it spends
  no token while the run follows the plan and wakes the Plan with the deviation's line when it does not. Thresholds
  are constants, proposed 30 minutes, replayed on the 7-day record before they are fixed (T3).
- **What runs at the same time** (proposal 4, taken). The plan's `together` and `surfaces` are the declared units
  `fanout-tree.md` spec 3 waits for: its record held none because nobody declared any. Sub-agent swarms inside a
  session stay that document's, under his three pending answers; the reading of "enjambres de sesiones" is
  question 4.
- **Double review** (proposal 5, already the rule). A plan put to him passes `rule:double-review`. Estimate: 3 to
  5 such plans a week, so 3% to 5% of Codex's weekly limit and 6M to 10M tokens; a one-item request proposes
  nothing new to him and passes none.
- **The advisor.** Every session and sub-agent already has the Fable advisor from his settings (Spec 2 holds
  today; nothing "pending" was found: searched `advisor`, `sub-agent` in `odd/tasks/advisor-*.md`,
  `bin/lib/lead-protocols.mjs` and the rules). The Plan on Fable would be advised by Fable itself: it is exempt from
  the advisor gate as the senior is (`bin/advisor-gate.mjs:307`), and its second opinion is the double review.
- **Cost, an estimate.** Calibration assumed: 14% of the weekly Fable limit for about 75M weighted tokens since
  the reset, so 1% for about 5M; how the meter weighs a cache read is not known. Today's pace is about 39% a week,
  four fifths of it advisor input. A Plan that reads no code: about 14% a week more; one that works like a lead:
  about 29%. The meter is read with `get_usage` at each plan and written in the plan's opening; a floor like
  Codex's is not designed here.
- **Reach.** This repository first: the new rules are scoped `repository`; the skill's Plan part is conditional.

## Phase 0, today, no code
He opens a session in the app on Fable 5.2 at high and names it `JH PLAN · planes`; the title guard judges only
`start_session`, so a title typed by hand passes. It works from this document. What works today: his chat with it;
the plan as a stretch plan and a roadmap PR; the plan handed to the lead by `SendMessage` to its `local_…` id with
the file's path. What does not, until the build: `notify --to plan` throws, so sessions keep reporting to the lead
and the lead forwards by message; his questions stay in the lead's chat (`rule:questions-one-place`) unless his typed
line changes it first; Remote Control he turns on in the Plan himself (Spec 7), since the host-update step still
names the lead alone; `rules applied`
and the board list the Plan off the home (it is read as a work session on Fable); the advisor gate is not exempt,
about 214k Fable tokens for each gated act; no clock runs, so the audit is the Plan reading `js-harness sessions`
and `stretch status` on his request. It is his choice (question 5).

## Tasks
Order: T1 and T2 now; T3 can start at once and collides with nobody; T4 waits for JH 208 to release `stretch*`;
T5 to T7 wait for JH 211's T7 and T8 to land, then run in one session, in order (same files). T3 and T4 are one
session (X), T5 to T7 another (Y): X and Y run together, their surfaces disjoint. Inside each, round one reads with
opus readers launched together; a writer sub-agent only where two units have disjoint surfaces.
- [ ] T1 (kind: design) (1, 2, 3) This document, its double review, the page, the questions. Route: inline, JH SR.
- [ ] T2 (kind: docs) (2) `odd/tasks/fanout-tree.md`: merge `docs/fanout-tree` into this branch and add one Log
  line, his line 992 and the reopened reading of "sub sesiones". Route: inline, JH SR.
- [ ] T3 (kind: build) (2) The three clocks: `bin/lib/plan-audit.mjs` and its test, read by `bin/wait.mjs`;
  fixture first, replayed on the 7-day record (PR 883 caught; the night cluster 795 to 812 not counted as the
  lead's). Session X, branch `feat/plan-audit`. Surfaces: the new module, its test, `bin/wait.mjs`, its test.
- [ ] T4 (kind: build) (2) The plan file: `surfaces`, `together` and `route` in the stretch plan, checked by
  `stretch open`. Session X, after T3 and after JH 208 releases `stretch*`. Surfaces: `bin/lib/stretch.mjs`,
  `bin/stretch.mjs`, their tests.
- [ ] T5 (kind: build) (1, 5, 6) The role: `PLAN` in `TITLE_SHAPE`, `roleOfTitle` and `roleNamed`, an inbox
  address, `rule:session-title`'s text; `plan-model` and `plan-effort` in a home of their own, held by role in the
  reporters; the guarded start (the lead or an outgoing Plan, one live, own worktree, wait-only brief), the gate's
  exemption. Session Y, branch `rule/plan-role`, after JH 211's T7 and T8 land. High risk 2 and 3: an independent
  verifier. Surfaces: `bin/lib/sessions.mjs`, `bin/lib/session-title-guard.mjs`, `bin/lib/inbox.mjs`,
  `bin/lib/channel.mjs`, `bin/lib/model-shape.mjs`, `bin/lib/model-home.mjs`, `bin/lib/rules-data.mjs`,
  `bin/lib/rules-coverage-data.mjs`, `bin/guard.mjs`, `bin/lib/guard.mjs`, `bin/advisor-gate.mjs`, the five
  reporters, their tests.
- [ ] T6 (kind: build) (1, 7) His desk: Remote Control on both orchestrators (`bin/lib/host-update.mjs`,
  `rule:remote-control-yes` and `rule:sessions-open-in-sidebar` by `rules change`, source line 1389); and, only on
  his typed line (question 2), a question addressed to the session that holds his chat (`bin/lib/channel.mjs:131`,
  `bin/notify.mjs`) with `rule:questions-one-place` and `rule:lead-charter`. One commit a rule. Session Y, after T5. High risk 3: a verifier.
- [ ] T7 (kind: docs) (1, 2) The texts: "The plan orchestrator" in `bin/lib/lead-protocols.mjs` and the Plan's part
  of the orchestrator skill (`bin/lib/manifest.mjs`), conditional on a Plan holding its role. Session Y, after T6
  and after JH 211 releases both files. High risk 3: a verifier.
- [ ] T8 (kind: verify) (1, 2, 3) The lead starts the first guarded Plan; one real request goes through plan, lead,
  sessions and audit. Seven days later, from the records: ready-age and waiting-age against Depth pass item 2, the
  share of stretch items bound, the launched-together count, weekly Fable against the estimate. Route: the lead.

## Log
- L1 2026-11-16, his words: Specs 1 to 6, each read with `sessions --quote` by this session.
- L2 2026-11-16, the lead's task (message to JH SR): design only; ground it in `sessions.mjs:1248`, `fanout-tree`,
  `senior-orchestrator` D2 and D8, the four rules, the PR 883 finding; report by `notify`; ask him nothing.
- L3 The lead's six proposals (699d7c29 line 1171), not his words: the plan as a file; one place to talk, the Plan;
  the Plan reviews the lead from the board and the records; the plan says what runs in parallel; the plan passes
  the double review; the Plan reads no code. He did not answer them. "The design" takes 1, 3, 4 and 5, leaves 2 to
  his answer and narrows 6 (one sender for the senior).
- L4 Four opus readers launched together, read-only: the role's plumbing; the channel, the questions and the audit
  sources; his conversation and the old lead's plan page; the advisor's source and Fable's cost. One thing of each
  checked here before use: `roleOfTitle('JH PLAN · x')` null; `onboarding.md:138-139` and `:269-272`; his lines by
  `--quote`; the latency figures by this session's own scripts. Not checked: the readers' token sums by model, the
  `get_usage` reading (this session did not call it), the file lists of JH 211's T7 and T8.
- L5 A reading left open on purpose: the lead read his "enjambres de sesiones" as sub-agents (line 1043) and he did
  not confirm it; `fanout-tree.md` reads his earlier "sub sesiones" the same way. Question 4.
- L6 The advisor before writing: replay PR 883 against the metric; classify the tails before quoting them; count
  the stretches. All three run; they moved the verdict from supports to refutes and the clocks ahead of the role.
- L8 2026-11-16T02:22Z, his decision, typed (Spec 7), carried by the lead and read here with `--quote`: Remote
  Control on both orchestrators. It settles half of question 2 as first written; what stays open is where his
  questions reach him. Written while the double review read the earlier copy: the confirming read covers it.
- L7 The usage tool names his plan otherwise than this project's notes do; the page gives no plan name.

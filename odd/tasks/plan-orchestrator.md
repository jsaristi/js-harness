# plan-orchestrator — a Plan orchestrator above the lead (JH SR, design only)

## State
Design only, no code. Version 3, read three times (reads 2a17bbe1, 5eed176c, b88ea402): the first two reads' 48
findings are taken (L9, L10); the third's 21 are open in L11 and told to him as problems on the page
(https://claude.ai/artifact/1ppv1NAxbrfv3THX96Gt7b), with no fourth round. Everything from L12 on was added after
the last read and no reader has read it: Spec 8 (L12), his line on the advisor and the swarms (L14), his four
answers (L15, L16: the lead opens the work sessions; Fable 5.2 at high; sub-agents inside each session; his
questions only in the Plan, by a tap and, on 2026-11-17, by his typed line, L19), T11 and Spec 9. On 2026-11-16 he typed yes to
starting phase 0 with those problems said (L17, question 315), so PR 894 (branch `claude/dreamy-nash-50fa03`,
worktree `rule-lead-effort-split-aac740`) goes ready and the lead lands it. Left: the lead stores the Plan's
opening and tells him (phase 0's step 1, T10); T6's question part, which now waits for JH 212 and T11 and no
longer for his typed line (L19); T11, how the lead knows he is away;
T12, how each role reaches its session (Spec 9), JH SR's; a session for T3. The measures:
`odd/tasks/plan-orchestrator-evidence/measures.md`.

## Goal
He tells a Plan orchestrator what he wants; it writes the plan as a file the harness records with its version; the
lead executes that plan; and a command, not the lead's word, says where the execution left the plan in what a
record can show.

## Why
His words (Specs 1 to 3): the work is not organized or planned as it should be; he wants a layer above the lead
that plans what he says and hands it planned, the lead launching the sessions and these their swarms, Fable
organizing up front and not executing. The record shows the same from one side (Depth pass item 4): the roadmap,
which is the project's plan, had 15 open steps on 2026-11-09 and has the same 15 open a week later, with 7 more,
while the feature documents closed 178 task steps in those days. Work is done; the project's plan does not move.

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
  `bin/lib/session-title-guard.mjs`, the home reporters, `bin/loop.mjs`, `rules change`); JH 208 (`stretch*`,
  `advisor-gate*`, `reply*`, `subagent-check`) and JH 209 (`sessions.mjs` readers, two rules), as `fanout-tree.md`
  lists them; the build of `fanout-tree.md` itself, which lists `bin/notify.mjs`. The four Delegation lines that
  `fanout-tree.md` drafts (`bin/lib/rules-block.mjs:45-48`) and his three pending answers on lines 46 to 48.
- Out, kept apart from the Specs: the lead's six proposals (Log L3), which he did not type.

## Constraints
- A rule of his changes only with words he typed (`rules change`, a quotation with its date); a tapped answer is
  recorded as "Tapped, not quoted" and carries no rule change. `rule:remote-control-yes` (its subject,
  `bin/lib/rules-data.mjs:475`, and the step in `bin/lib/host-update.mjs:194-205`) and the source reading of
  `rule:sessions-open-in-sidebar` have their source, Spec 7. Three have none and wait for his line (question 1):
  `rule:questions-one-place` (its subject, `bin/lib/rules-data.mjs:454`, and the skill's lines,
  `bin/lib/manifest.mjs:134-143`, which also say a work session asks him nothing while an orchestrator holds its
  role); `rule:lead-charter` (the charter of what the lead does alone and what it asks him, whose text is at
  `bin/lib/manifest.mjs:155`); `rule:away-autonomy` (it has the lead show the stretch's departure and return).
- The host opens a session with `start_session` only on a turn he typed; on a turn a notice or a session's message
  started, it leaves a card he must tap (`bin/lib/manifest.mjs:157`). No background session, ever (Spec 5), so the
  other way is gone once T7 lands — because of this, a session opens on his typed line or on his tap, whoever
  starts it (question 2).
- No session nested (Spec 6): the Plan is a visible app session, detached.
- A role is a title, and a session can rename itself: the guard does not judge `set_session_title`
  (`bin/lib/hook-entries.mjs:82`; `senior-orchestrator.md` D13 records it open). Until T5 closes that, "only the
  Plan" anywhere in this design is recorded, not held — because an identity a session asserts for itself proves
  nothing.
- One more session in the chain is one more place to hold work: a hop this design adds is a file or a recorded
  notice a command can time, and where it is not, the design says so.
- The orchestrator skill text (`bin/lib/manifest.mjs:112-258`) ships to every project: the Plan part reads "where a
  Plan orchestrator holds its role" and a project without one reads as today. New rules are scoped `repository`.
- Guard, title and skill changes are high risk (items 2 and 3): tests first, an independent verifier after.
- Fable is the scarce meter: nothing here adds a Fable call that a command can replace.

## Ask me before
Four questions, one at a time, in this order, recorded after the last read; the lead puts them to him. Phase 0 is
not asked: it is the answer to his "dime que tenemos que hacer" (Spec 3); questions 2 and 3 each change one of its
steps, and until question 1 is answered it runs under today's rules.
1. Where his questions reach him: only in the Plan's chat (the lead stops asking him, and the departure and return
   of a stretch move to the Plan), or in both. A yes to "only the Plan" changes three rules and needs one typed
   line. Answered 2026-11-16, tapped: A, only the Plan; the typed line is owed before any rule changes (L16).
2. Who opens the work sessions. The Plan always hands the plan to the lead itself, as he said. What the host
   needs from him is one gesture where the sessions open: (A) the lead opens them, and he taps a card for each in
   the lead's chat or types one line there (his design as he said it; recommended), or (B) the Plan opens them in
   the turn he approves the plan and the lead supervises them (no second chat to visit; the Plan executes a
   little). Answered 2026-11-16, tapped: A, the lead opens them (L15).
3. The Plan's model: Fable 5.2 (his "el modelo que organiza todo de entrada"). Its level is high by Spec 4, which
   says the orchestrating session; if he means only the lead there, the level is his to say. The cost is a guess
   that phase 0 measures (The design, "Cost"). Answered 2026-11-16, tapped: Fable 5.2 at high (L16).
4. "enjambres de sesiones": sub-agents inside each session (what `fanout-tree.md` designs), or sessions that open
   sessions (a second level, under his cap of 6 and his "nunca anides la sesiones").
   Answered 2026-11-16, tapped: A, sub-agents inside each session (L16).

## Depth pass
- 1. Method: separating planning from execution is the control-plane split of an operations team: a planner writes
  a work order with its acceptance test, a dispatcher runs it, and an auditor measures the run from the records,
  never from the dispatcher's report. Its standard: the order is a versioned file with a checkable shape; the
  dispatcher does not rewrite it; a deviation is a clock or a comparison on a record. The smallest change that
  meets it reuses what exists (searched: `js-harness rules`, codegraph, the skills, `odd/tasks/`): the role is the
  onboarding's "plan orchestrator" made lasting (`odd/tasks/onboarding.md:139-140`, `bin/lib/onboard.mjs:832`); the
  order is the stretch plan (`js-harness stretch open --plan`: goals that are commands, items one session each,
  lanes, forks pre-decided) with the roadmap; the title role follows `SR` (`odd/tasks/senior-orchestrator.md`); the
  clock extends the stall clock (`bin/lib/stall.mjs`, `rule:session-stall`, read by the heartbeat and by
  `js-harness wait`). No new command, one new module at most.
- 2. Raw material. The counts of the channel and of the stretches cover 2026-11-09T02:20Z to 2026-11-16T02:20Z
  (local time UTC-05:00), with `origin/main` at b3a73245; the scripts take both ends and their outputs are in
  `odd/tasks/plan-orchestrator-evidence/measures.md`.
  - His words: `js-harness sessions --quote 699d7c29-54c4-460e-a5e8-700b114eb251 <969|992|1153|1206|1389|519|402>`;
    `--quote 69918425-3b43-430f-9f50-62b6422422ce 20757`.
  - The roadmap alone (`git show cb539ba8:docs/ROADMAP.md` against `origin/main`, counting its checkboxes): 15 open
    and 100 done on 2026-11-09; 22 open and 100 done now; the 15 open then are all open now, matched by their first
    60 characters. `js-harness progress --pace --days 7`: 178 task steps closed and 201 added in the same days, but
    that command counts the roadmap and every feature document together, so those are mostly the tasks sessions
    write in their own documents and then close.
  - The title parser knows three roles: `bin/lib/sessions.mjs:1248`; `roleOfTitle('JH PLAN · x')` is `null` (run
    2026-11-15). `roleNamed` takes only the orchestrator or a number (`bin/lib/sessions.mjs:1297`); a question is
    refused for any other address (`bin/lib/channel.mjs:131`). One live lead is not enforced, only warned
    (`bin/lib/sessions.mjs:3096`).
  - The channel record (`latency.mjs`): 88 PRs with a ready notice, 87 merged; ready to merge, median 10 minutes,
    21 over 60. Of those 21, 15 became ready between 22:00 and 07:00 local, but several of those waited through the
    next day (PRs 809 to 811, ready before dawn, merged after 21:00); 14 of the 21 are one cluster, PRs 795 to 812.
    Not classified: how much of each wait was his absence, a red gate or an open question.
  - Questions (`questions.mjs`): 75 recorded, 70 answered with both stamps. Record to shown: median 0 minutes, 12
    over 60, 5,562 minutes in all, not classified, so not "the lead's hold". Shown to answered: median 2 minutes,
    809 minutes in all. The shown stamp exists only on a verified answer (`bin/lib/channel.mjs:127-128`).
  - PR 883 (`replay.mjs`): ready 06:36 local; left out of a land as a draft; its verifier failed at 07:09; the
    lead's note at 07:12, "hold it for the owner"; question 288 recorded 10:08, shown 14 minutes later, answered
    10:22; merged 10:26. The old lead's page calls the 176 minutes (07:12 to 10:08) the funnel;
    `rule:away-autonomy` told the lead to hold a block for him while he was away. Both are true: the hold followed
    a rule, and nothing showed it to anyone while it lasted. One case, not a trend.
  - The stall clock blames the wrong side: a `ready` notice does not give handed work back
    (`bin/lib/stall.mjs:21`), so a session whose PR waits on the lead reads STALLED after 60 minutes (a reader's
    finding; T3 checks it with a fixture first).
  - Stretches: 16 opened and 16 closed; 45 items, 30 naming their session at the opening, 7 binds. What became of
    the items never bound is not measured. One stretch can be open at a time (`bin/stretch.mjs:68`), and the lead
    opens one before he leaves (`rule:away-autonomy`); `bind` and `closes` take a change from anyone
    (`bin/stretch.mjs:502-518`, `:551`).
  - Sub-agent launches (`fanout-tree.md`, Depth pass item 2): 1 pair of 23 launched together across four sessions.
  - Fable (the app tool `get_usage`, read 2026-11-15 by the cost reader, not by this session): weekly Fable 14%,
    all models 34%, reset 2026-11-20T14:00Z. Since the reset of 2026-11-13T14:00Z: 252 advisor calls, 47.7M input
    tokens never cached and 2.5M output, about 189k input a call; Fable as a working model 30.2M cache read, 3.6M
    cache write, 0.83M output. No command of the harness reads this meter. An advisor comes from `advisorModel` in
    his `~/.claude/settings.json`, which the harness checks and never writes (`bin/lib/home-doctor.mjs:36-42`); a
    sub-agent inherits it (`odd/tasks/advisor-home.md:118-121`). The advisor gate already lets a session whose own
    model is Fable through (`bin/advisor-gate.mjs:325`, tested).
- 3. The bar:
  spec 1: `node --test bin/lib/sessions.test.mjs`: none, new behaviour (`roleOfTitle('JH PLAN · x')` is null today)
  spec 2: `git show origin/main:docs/ROADMAP.md`: 0 of the 15 roadmap steps open on 2026-11-09 are closed; the target, fixed now: under a Plan, at least half of the steps a plan names close inside that plan, counted from the stretch's own record
  spec 3: `js-harness contract check odd/tasks/plan-orchestrator.md`: phase 0 needs no code; what it cannot do is listed in "Phase 0"
  spec 4: left out because JH 211 builds it as T8 of `odd/tasks/senior-orchestrator.md`; this design reads it as the source of the Plan's level
  spec 5: `node --test bin/guard.test.mjs`: none, new behaviour (the Plan opens visible; a PLAN start by `sessions start` is refused once T7 lands)
  spec 6: `node --test bin/guard.test.mjs`: none, new behaviour (a Plan start is held to one live Plan, its own worktree, then detached)
  spec 7: `node --test bin/lib/host-update.test.mjs`: none, new behaviour (the host-update step names the orchestrator session alone today, `bin/lib/host-update.mjs:194-205`)
  spec 8: `js-harness sessions`: none, new behaviour (no session holds a Plan title today; done when a Plan is working and the lead has told him, by a push notification and a line in its chat, that he can try it and how)
  spec 9: `js-harness sessions --opening "JH SR · diseño del Orquestador Plan"`: none, new behaviour (a stored opening is what hands a session its role today; what else carries a role is the search of T12; done when the lead, the Plan and the senior each hold a role of their own that outlives the opening, through a compaction and a new session)
- 4. Refutation: his complaint is the planning (Spec 2), so the request fails if the project's plan is being worked
  through. Run 2026-11-15: the roadmap's checkboxes at cb539ba8, its last commit before 2026-11-09, against
  `origin/main`. Result: 0 of the 15 steps open then are closed, 7 were added, and the done count stayed at 100,
  while the feature documents closed 178 task steps. So the request holds as far as this shows: work is planned
  inside each feature and nothing moves the project's plan. What it does not show: that a planner would move it;
  some of the 15 wait for him, and how many is not counted.
  Verdict: supports
- 5. Request: "Put a Plan orchestrator above the lead. He tells it what he wants; it writes the plan as a file the
  harness records with its version (what runs, in which session, what runs at the same time, what is decided
  ahead) and hands it to the lead; the lead executes it; one clock on the records says when work handed to the lead
  waits, and the stretch's own record says how much of the plan closed and what merged outside it. Remote Control on
  both orchestrators. Start today by hand with what needs no code."
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
8. "Me avisas cuando el orquestador plan este funcionando para comenzarlo a probar" (2026-11-16T03:02Z, 699d7c29
   line 1598)
9. "cada sesion por ejemplo Orquestador, Orquestador Plan y Senior deben saber cual es su rol y su funcion osea
   cada uno debe no solo tener un prompt inicial sino un rol especifico que haga que funcione mejor"
   (2026-11-16T18:58Z, 699d7c29 line 5054: the second half of his typed answer to question 315, whole in L17)
The times are UTC; in his local time Specs 1 to 8 fall on 2026-11-15, between 17:16 and 22:02, and Spec 9 on
2026-11-16 at 13:58.

## The design
- **The role.** A session titled `<code> PLAN · <purpose>`, role `plan`: the onboarding's plan orchestrator, which
  today ends when the roadmap is approved, made lasting. One live Plan. It owns no feature and reads no code: what
  needs code read goes into the plan as an item (a design item for a work session, or one routed to the senior).
  Its own readers, when it needs a fact, are opus sub-agents launched together.
- **Who opens the Plan, and its relief.** In phase 0 he does, from the app. After the build the lead starts it as
  it starts the senior (`start_session` with a wait-only brief, the session tools set its model and level, then
  `detach_session`), the guard holding the start. A relief follows the lead's handover
  (`bin/lib/manifest.mjs:223-230`): the outgoing Plan starts `<code> PLAN nueva · …`, a title that holds no role,
  writes its relief file, and the two rename. T5 puts `set_session_title` under the guard: a rename to or from a
  role title is refused unless a recorded relief names both sessions. Tests: a second Plan refused, a rename with
  no relief refused, a relief that completes, a successor that fails to start. Not held, said as it is for the
  senior (`senior-orchestrator.md` D13): two starts in one message both pass before either record exists.
- **The senior keeps one sender, the lead** (`senior-orchestrator.md` D10). The Plan asks for senior work as a plan
  item routed `senior`; the lead sends it.
- **The plan is a versioned file** (proposal 1). Order and decisions: `docs/ROADMAP.md`, by docs PRs, as today. A
  request's plan is a stretch plan; `stretch open` records its hash and the session that ran it, read from the
  caller's own record and never from a flag. While it runs, a change is `stretch amend --plan <file>` (new, an
  option of the existing command): the next version, which may add an item, cancel one with its reason or replace
  one, ids stable and the first commitments kept in the record, so the measurement never restarts. An amendment,
  and `closes`, are the Plan's where a Plan opened the stretch; `bind`, naming an item's session, is the lead's,
  and a bind over a bound item is recorded as a reassignment. An item gains `surfaces` (the files it may touch),
  `together` (the items it runs beside) and `route` (`inline`, `readers <n>`, `writers` with their surfaces,
  `senior`); `open` and `amend` refuse two items declared together whose surfaces overlap.
- **His absence is not the open stretch.** Under a lasting Plan a stretch is open most of the time, so it can no
  longer mean that he is away, and `rule:away-autonomy`'s departure is the Plan's to show once question 1 moves it.
  The plan file gains an `away` field (from, until) that the Plan writes when he says he leaves; the clock reads
  that field and nothing else for his absence.
- **What a record can show, and what it cannot.** Recorded now and held once T5 guards the rename: the plan's
  version and who opened or amended it. Held: an item's surfaces against the files its PR changed, computed by
  `notify` from `git diff --name-only <base>...<head>` at the ready notice, bound to that head and the plan's
  version, and computed again at the land. Audit only, never presented as held: the route a session really took
  and the order it worked in.
- **One clock: work handed to the lead** (proposal 3). `bin/lib/stall.mjs` times work handed to a session; it
  gains the other side, in three states read from records only. Waiting on the lead: from a `ready` notice until
  its PR merges, and from a `waiting` notice until a notice the lead addresses to that session. Waiting on him:
  from a question recorded that names the PR or the session until its answer or its withdrawal, after which the
  work waits on the lead again. Resolved. Past a new threshold, `lead-stall` (to be declared as a rule with a
  flag, as `rule:session-stall` is; 30 minutes proposed, fixed only after T3 replays it on the record), the
  heartbeat and `js-harness wait` print the line at any hour, night included, with the plan's `away` field beside
  it, so a hold that follows a rule is seen and not blamed. The Plan keeps `wait` on that condition with no time
  limit while a stretch is open: no token is spent until the line appears. A ready notice also stops counting
  against the session that sent it. Not timed, because no record holds it: how long a question sat before it was
  shown to him, and a message the lead sent a session without a notice. Dropped: a clock on items with no session
  and one on lanes; neither has a case measured, and T8 measures both first.
- **One figure: the plan's own.** At `stretch close`, from the stretch's record: the share of the plan's items that
  closed, what each amendment added or cancelled, and the PRs merged in its span that belong to no item. Target:
  half of the items a plan names close inside it. The baseline is the 16 closed stretches, measured in T4 before
  the figure is shown to him.
- **Where he talks** (proposal 2, amended by Spec 7). Remote Control on both orchestrators and on no other
  session; the host-update step turns it back on in both. He tells the Plan what he wants and approves the plan
  there. Where his questions reach him is question 1; if only in the Plan, a question is recorded once, addressed
  to the session that holds his chat, with no relay through the lead, and the Plan answers what is inside the plan
  and asks him only what `rule:owner-decisions` lists. His answer is A, tapped (L16): only the Plan, once his typed
  line changes the three rules; until then phase 0's limit stands. A carries L11's open high finding (Claude 2):
  the lead's `AWAY:` line reads when he last wrote to the lead, so with his conversation in the Plan the lead no
  longer knows when he is away. This design does not say yet how that is solved: T11.
- **The hand-off and the start** (question 2). The Plan sends the lead the plan's path itself, by a message, every
  time. The host then opens a session only on his gesture: with A, each session the lead starts is a card he taps
  in the lead's chat, or he types one line there and the lead opens that wave in that turn; with B, the Plan opens
  them in the turn he approves. Not checked: whether a turn that follows his typed turn can open one more session;
  phase 0 shows it. His answer is A (L15): B is dropped and the Plan opens no work session.
- **What runs at the same time** (proposal 4). The plan's `together` and `surfaces` are the declared units
  `fanout-tree.md` spec 3 waits for. Sub-agent swarms inside a session stay that document's, under his three
  pending answers; the reading of "enjambres de sesiones" is question 4, answered A (L16): sub-agents inside each
  session, no second level of sessions.
- **Double review** (proposal 5, already `rule:double-review`). A plan put to him passes it, by the rule's own
  exemptions and no other. Estimate: 3 to 5 such plans a week; a read is about 1% of Codex's weekly limit, and each
  of this document's two reads cost about 3.4M Claude tokens against the 1.1M the command states.
- **The advisor.** Every session and sub-agent has the Fable advisor from his settings, the Plan too, so that part
  of Spec 2 holds today and this design changes none of it (nothing "pending" was found: searched `advisor` and
  `sub-agent` in `odd/tasks/advisor-*.md`, `bin/lib/lead-protocols.mjs` and the rules). The gate that forces a
  consultation before certain acts already lets a session on Fable through, so it will not force the Plan; whether
  he wants it forced on the Plan is his to say, and nothing is built either way.
- **Cost, a guess until phase 0 measures it.** Weights assumed, the API's price ratios (input 1, cache read 0.1,
  cache write 2, output 5); how the weekly meter weighs a cache read is not known. Since the reset: Fable working,
  30.2M x 0.1 + 3.6M x 2 + 0.83M x 5 = 14.4M; the advisor, 47.7M + 2.5M x 5 = 60.2M; together 74.6M for 14%, so
  1% is about 5.3M, and the advisor is 81% of it. A Plan that reads no code, assumed at 40M cache read, 2M cache
  write and 0.15M output a day (about a third of the Fable lead of 2026-11-11, which read 113M a day): 4 + 4 +
  0.75 = 8.8M a day, about 1.7% a day, 12% a week, without its double reviews or any advisor call it chooses to
  make. A Plan that works as that lead did: about 22M a day by the cost reader's sum, which this session cannot
  rebuild (its cache-write term is missing), so 4% a day and 29% a week are that reader's figure. Today's pace is
  about 39% a week. Phase 0 measures the Plan itself, by summing its own transcript's usage after its third day,
  and reads `get_usage` before and after.
- **Reach.** This repository first: the new rules are scoped `repository`; the skill's Plan part is conditional.

## Phase 0, today, no code
In order (Spec 3):
1. The lead lands this document's docs PR, so the Plan can read it on main, and stores the Plan's opening with
   `js-harness notify --opening`. Then it tells him, by a push notification and a line in its chat, that the Plan
   is ready for him to open and try, with steps 2 to 4 as what he does (Spec 8).
2. He opens a session in the app on Fable 5.2 at high (question 3, answered: L16), names it `JH PLAN · planes`,
   turns Remote Control on in it (Spec 7) and sends it the opening's first message.
3. He tells it what he wants. It writes the plan (a stretch plan, and a roadmap PR where the order changes), passes
   the double review and shows him the page.
4. He approves. The Plan sends the plan's path to the lead; the lead's sessions open on his tap or his line there
   (question 2, answered A: L15).
What it cannot do until the build. `notify --to plan` throws, so sessions report to the lead and the lead forwards
by message. `rule:questions-one-place` stays in force: he talks to the Plan because he opens that chat and types
there (Spec 1), but a decision asked of him is still recorded and put to him by the lead until his typed line
changes the rule. The board and `rules applied` list the Plan off the home, read as a work session on Fable.
`stretch amend` does not exist, so a second request waits for the open stretch to close or goes in as roadmap
steps. The Plan's title is one anybody can type. No clock runs: the audit is the Plan reading `js-harness
sessions` and `stretch status` when he asks.

## Tasks
Order, and what runs beside what. T3 starts at once in its own session (X), beside JH 211. The rest is a chain, not
two lanes: `bin/lib/rules-data.mjs`, `bin/lib/channel.mjs` and `bin/notify.mjs` are shared by T3 to T6 and by
JH 209, JH 211 and fanout-tree's build, so one task lands before the next starts: T3, then T5 (after JH 211's T7 and
T8 land and JH 209 releases `bin/lib/sessions.mjs`), then T4 (after JH 208 releases `stretch*`), then T6, then T7.
What is parallel is inside each task: round one reads with opus readers launched together, and its verifier runs
while the next task's design is read. The board is checked before each task starts.
- [x] T1 (kind: design) (1, 2, 3, 8) This document, its double reviews, the page, the questions (L13). Route:
  inline, JH SR.
- [x] T2 (kind: docs) (2) `odd/tasks/fanout-tree.md`: `docs/fanout-tree` merged into this branch (8288102e) and its
  Log line L8, his line 992 and the reopened reading of "sub sesiones" (5b02f348). Route: inline, JH SR.
- [ ] T3 (kind: build) (2) The lead's side of the stall clock, its three states and the `away` field's reader:
  `bin/lib/stall.mjs` and its test, the new rule `lead-stall` with its flag (`bin/lib/rules-data.mjs`, one `rules
  change` at a time with the other holders), read by `bin/wait.mjs` (a condition with no time limit) and, after
  JH 211's T8, by `bin/loop.mjs`. Fixture first, replayed on the 7-day record: PR 883 printed with his absence;
  the cluster 795 to 812 as one event; an answered question followed by a PR that never merges still counts.
  Session X, branch `rule/lead-stall`. High risk 4 (a wait that never ends): a verifier.
- [ ] T4 (kind: build) (2) The plan file: hash and caller at `stretch open`; `stretch amend` with add, cancel and
  replace; who may amend and `closes`; the reassignment record; `surfaces`, `together`, `route`, `away`; the
  overlap refusal; the plan's figure at the close, its baseline from the 16 closed stretches first; the surfaces
  check at the ready notice and at the land (`bin/notify.mjs`, `bin/lib/channel.mjs`, the merge door). After T5.
  Negative fixtures: an amendment by a session that is not the Plan, a reassignment, a file outside an item's
  surfaces pushed after the ready notice, two overlapping requests, a cancelled item.
- [ ] T5 (kind: build) (1, 5, 6) The role: `PLAN` in `TITLE_SHAPE`, `roleOfTitle` and `roleNamed`, an inbox
  address, `rule:session-title`'s text; `plan-model` and `plan-effort` in a home of their own, held by role in the
  reporters; the guarded start, the relief and the rename under the guard. Branch `rule/plan-role`. High risk 2 and
  3: a verifier. Surfaces: `bin/lib/sessions.mjs`, `bin/lib/session-title-guard.mjs`, `bin/lib/hook-entries.mjs`,
  `bin/lib/inbox.mjs`, `bin/lib/channel.mjs`, `bin/lib/model-shape.mjs`, `bin/lib/model-home.mjs`,
  `bin/lib/rules-data.mjs`, `bin/lib/rules-coverage-data.mjs`, `bin/guard.mjs`, `bin/lib/guard.mjs`, the five
  reporters, their tests. The role opens no work session: the lead does (question 2, answered A, L15).
  Its model and level are his answer to question 3: Fable 5.2 at high (L16).
- [ ] T6 (kind: build) (1, 7) His desk: Remote Control on both orchestrators (`bin/lib/host-update.mjs`,
  `rule:remote-control-yes` and `rule:sessions-open-in-sidebar` by `rules change`, source line 1389); and, only on
  his typed line (question 1), a question addressed to the session that holds his chat (`bin/lib/channel.mjs:131`,
  `bin/notify.mjs`) with `rule:questions-one-place`, `rule:lead-charter` and `rule:away-autonomy`. One commit a
  rule. After T4. High risk 3: a verifier. Question 1 is answered A by a tap (L16) and by his typed line of
  2026-11-17 (L19). The question part still waits for T11, and for JH 212's change of `rule:questions-one-place`
  to land first: T6 is rebased on it (the lead's word, L19).
- [ ] T7 (kind: docs) (1, 2) The texts: "The plan orchestrator" in `bin/lib/lead-protocols.mjs` and the Plan's part
  of the orchestrator skill (`bin/lib/manifest.mjs`), conditional on a Plan holding its role. After T6. High risk
  3: a verifier.
- [ ] T8 (kind: verify) (1, 2, 3) After phase 0's third day: the Plan's own tokens against the guess; whether a
  later wave opened without his gesture. After the build, the lead starts the first guarded Plan and one real
  request goes through plan, lead, sessions and clock. Fourteen days later, from the records: the plan's figure
  against its target, the roadmap's open steps against 0 of 15, the lead-stall lines, what became of items with no
  session, the launched-together count (1 pair of 23). Route: the lead.
- [ ] T10 (kind: verify) (8) The notice he asked for, twice, each a push notification and a line in the lead's chat
  that says what works, what does not yet and how he tries it: when phase 0's step 1 is done, and when the built
  Plan has passed T8's one real request. Proof: the line in the lead's transcript, read with `sessions --quote`,
  written in this Log. Route: the lead.
- [x] T9 (kind: docs) (1) His answer to each of the four questions in this Log with its transcript line, on a docs
  branch. Route: the lead, or the Plan once phase 0 runs. Done by JH SR at the lead's word: question 2 in L15,
  questions 3, 4 and 1 in L16. His typed line for question 1 is not part of this task: T6 waits for it.
- [ ] T11 (kind: design) (1) Under his answer A to question 1 (L16), solve L11's high finding Claude 2: how the lead
  knows he is away once his conversation is in the Plan. Today `bin/lib/lead-away.mjs:67` and
  `bin/lib/return-report.mjs:336` read his last message to the lead, and the skill (`bin/lib/manifest.mjs:148`)
  has the lead open a stretch on that `AWAY:` line; in phase 0 it fires while he is present in the Plan, and once a
  stretch is open most of the time it never fires. The reader's proposed fix (a line in phase 0's limits; the two
  files in a task's surfaces, absence read from the chat that holds him) is not taken here: it is a design change
  and needs its read, and this document has used its three. Before T6's question part. Route: not assigned.
- [ ] T12 (kind: design) (9) How each role (the lead, the Plan, the senior) reaches its session beyond the opening,
  so that it survives a compaction and a new session. First the search of `rule:reuse-first`, named: the
  orchestrator skill, the agent types under `.claude/agents/`, the output styles, the opening store, the
  SessionStart resume. Then a proposal with its double review, its cost said first, before anything is built.
  Phase 0 does not wait for it: the Plan's phase 0 opening carries an explicit role section. Route: JH SR, at the
  lead's word (L17).

## Log
- L1 2026-11-15 local, his words: Specs 1 to 7, each read with `sessions --quote` by this session.
- L2 The lead's task (message to JH SR): design only; ground it in `sessions.mjs:1248`, `fanout-tree`,
  `senior-orchestrator` D2 and D8, the four rules, the PR 883 finding; report by `notify`; ask him nothing.
- L3 The lead's six proposals (699d7c29 line 1171), not his words: the plan as a file; one place to talk, the Plan;
  the Plan reviews the lead from the board and the records; the plan says what runs in parallel; the plan passes
  the double review; the Plan reads no code. He had asked for them (line 1153, "Pero que te parece mi diseño o como
  lo podemos mejorar?"); the lead closed them asking what he would change or add before JH SR writes the design;
  his next typed line is 1206, and line 1389 amends proposal 2 alone. Read here as a yes to 1 and 3 to 6, a reading
  that is this session's and his to correct; "The design" narrows 6 to one sender for the senior.
- L4 Four opus readers launched together, read-only: the role's plumbing; the channel, the questions and the audit
  sources; his conversation and the old lead's plan page; the advisor's source and Fable's cost. One thing of each
  checked here before use: `roleOfTitle('JH PLAN · x')` null; `onboarding.md:139-140` and `:269-272`; his lines by
  `--quote`; the latency figures by this session's own scripts. Not checked: the readers' token sums by model, the
  `get_usage` reading (this session did not call it), the file lists of JH 211's T7 and T8.
- L5 A reading left open on purpose: the lead read his "enjambres de sesiones" as sub-agents (line 1043) and he did
  not confirm it; `fanout-tree.md` reads his earlier "sub sesiones" the same way. Question 4.
- L6 The advisor before writing: replay PR 883 against the metric; classify the tails before quoting them; count
  the stretches. All three were run.
- L7 The usage tool names his plan otherwise than this project's notes do; the page gives no plan name.
- L8 His decision, typed (Spec 7), carried by the lead and read here with `--quote`: Remote Control on both
  orchestrators. What stays open is where his questions reach him (question 1).
- L9 Double review 1, read 2a17bbe1 (cost said first, 1.1M Claude and 0.9M Codex stated; measured 3,287,320 and
  654,140 tokens): Claude 16 findings, Codex 8, all 24 taken. A mistake of the first version, told: it called the
  verdict "refutes" from a test of the wrong thing, misread PR 883 (a draft with a failed verifier, held under
  `rule:away-autonomy`; question 288 shown 14 minutes after its record; 06:36 is inside the night band), and
  quoted "bound less than once in two stretches" from bind events alone. What each changed: Claude 1, Spec 7;
  Claude 2, PR 883 retold; Claude 3 and Codex 7 (shared), the binding figure recounted; Claude 4, the refutation
  restated; Claude 5, line 1206 as a reply; Claude 6, the gate (superseded by L10); Claude 7, the clock extends
  `stall.mjs` with a declared threshold; Claude 8, phase 0 as steps; Claude 9, a full second read; Claude 10, his
  answers moved to T9; Claude 11 and Codex 8 (shared), the cost sums; Claude 12, the text of each rule; Claude 13,
  the Delegation lines; Claude 14, the evidence folder; Claude 15, a wait with no time limit; Claude 16, the other
  holders; Codex 1, the host's limit and question 2; Codex 2, the Goal promises only what a record shows; Codex 3,
  the item clock dropped; Codex 4, the relief; Codex 5, no exemption by item count; Codex 6, `stretch amend`.
- L10 Double review 2, read 5eed176c, of version 2 (measured 3,563,534 Claude and 706,302 Codex tokens): Claude 16
  findings, Codex 8, all 24 taken. The second mistake, told in the same five parts: version 2 took its verdict
  from `progress --baseline`, which counts every feature document's tasks with the roadmap, so "201 entered" was
  mostly planned work (Claude 1 and Codex 1, shared); fixed by counting the roadmap alone, checked by the two `git
  show` counts; what stops it: each figure names the population it counts, and the scripts take both ends of
  their window; proof later: `measures.md` reproduces the document's figures at the stated end. What each changed:
  Claude 2, his absence is a field of the plan, not the open stretch, and `rule:away-autonomy` joins question 1;
  Claude 3 and Codex 2 and 3 (shared), a title is not an identity: the rename goes under the guard in T5, the
  caller is read from its record, and until then authorship is recorded, not held; Claude 4, the Plan hands the
  plan to the lead itself and question 2 is only his gesture; Claude 5 and Codex 5 (shared), the clock's three
  states on records alone, and what it cannot time; Claude 6, the tasks are a chain and say which files are
  shared; Claude 7, phase 0 keeps `rule:questions-one-place` and questions 2 and 3 change its steps; Claude 8 and
  Codex 6 (shared), no exemption is designed: the gate already lets a Fable session through, and forcing it is his
  to say; Claude 9, a target fixed now and the figure taken from the stretch's record; Claude 10 and Codex 8
  (shared), the scripts take the window's two ends and the outputs match the text; Claude 11, "mostly night"
  removed; Claude 12, the cost sums and what cannot be rebuilt; Claude 13, the unbound items are "not measured";
  Claude 14, the level comes from Spec 4; Claude 15, four citations; Claude 16 and Codex 4 (shared), surfaces
  computed from git and again at the land; Codex 7, an amendment cancels and replaces.
- L11 Double review 3, the last (`rule:double-review`), read b88ea402 of version 3 (2,952,411 Claude and 670,852
  Codex tokens): Claude 16 findings, Codex 5. It still finds real failures, so by the rule they go to him as
  problems and are not fixed in a fourth round; version 3 stands as read, and none of the 21 is corrected here. The
  full text of each is in the review's record (`double-reviews.jsonl` under the git common dir, read b88ea402).
  High: (Claude 1) the verdict's "0 of 15 roadmap steps closed" is itself disputed as a measure of the plan;
  (Claude 2) moving his conversation to the Plan breaks the lead's absence detector, which no task names;
  (Claude 3) a line he typed after Spec 7 is missing, "Me avisas cuando el orquestador plan este funcionando para
  comenzarlo a probar"; (Codex 1) the lead can still close a stretch the Plan opened. Medium: the measures do not
  reproduce at the stated END (Claude 4, Codex 5); the clock's states are not all readable from the records and
  lack transitions for a closed or reopened PR and for a question nobody has shown him (Claude 5, Codex 3 and 4);
  T3 is ordered before the `away` record it reads exists (Claude 6); the cost guess leaves out the advisor calls
  of the Plan's own sub-agents (Claude 7); the plan's figure is not defined tightly and its bar measures another
  population (Claude 8, Codex 2); T4 is high risk with no verifier and too large for one task (Claude 9). Low:
  `lead-stall`'s scope; a wrong line for the skill text; in phase 0 Remote Control goes off at each app restart;
  Spec 7's Remote Control part should not wait behind T4; proposal 2's question half read unevenly; Spec 4
  stretched to the Plan; small inaccuracies (Claude 10 to 16).
- L12 The line Claude 3 of L11 names, read: `js-harness sessions --quote 699d7c29-54c4-460e-a5e8-700b114eb251
  1598`, typed 2026-11-15 22:02 local, "Me avisas cuando el orquestador plan este funcionando para comenzarlo a
  probar". He typed it in the lead's chat six minutes before version 3 was committed (22:08); this session did not
  search his later lines before the third read, so the version the readers read lacks it. At the lead's word
  (its message of 22:27 local) it is now Spec 8, with its bar line, a sentence in phase 0's step 1 and T10: the
  done condition is a Plan working and him told, by a push notification and a line in the lead's chat, so he can
  try it. These lines were added after the third read and no reader has read them; nothing else of L11 is
  corrected.
- L13 T1 closed, 2026-11-15 local. The page (`rule:reports-spanish-visual`), written by an opus writer from
  version 3 and checked by this session at phone width in both themes: https://claude.ai/artifact/1ppv1NAxbrfv3THX96Gt7b,
  private to him, marked a free page for the template gate because no template command holds a design. The four
  questions of "Ask me before" are recorded as 307, 308, 309 and 310. Two things in them are not in the text the
  readers read and no reader has read them: question 307 says that "both" also changes `rule:questions-one-place`
  and needs his typed line, since that rule's subject is one place, the orchestrator's chat
  (`js-harness rules questions-one-place`), and that until he answers the lead asks him everything, as phase 0
  says; question 310 says a second level of sessions would sit inside his cap of 6, open detached, and need his
  gesture for each. The page's decision 1 says the same. Known and left as read, not corrected: "Double review" in
  The design still says two reads at about 3.4M each (three ran: L9, L10, L11); phase 0's step 2 says "high
  (question 3)" while question 3 asks the model and takes the level from Spec 4; T3 names a "session X" no one
  has opened.
- L14 His words, typed in JH SR's own chat on 2026-11-16 at 01:27 local (06:27Z; line 1812 of transcript
  285fc2c7-d588-4b0c-bef5-ded03fe6b04c, read from the file under
  `~/.claude/projects/D--js-harness--claude-worktrees-rule-lead-effort-split-aac740`, since `sessions --quote` does
  not reach a worktree's transcripts): "probemos asi a ver como nos va con el uso y si vemos si es excesivo se lo
  quitamos a los enjambres". It answers JH SR's view of the workflow, which he had asked for (699d7c29 line 2900):
  that view said the advisor is most of the Fable spend by the cost reader's figures and that a swarm multiplies
  it. Read here, his to correct: the workflow is tried with the advisor on every session and sub-agent, as Spec 2
  says; the usage is watched; if it is excessive, the advisor comes off the swarms' sub-agents. Not read into it:
  his approval of the page, an answer to questions 307 to 310, or JH SR's proposed order (phase 0 by hand and the
  clock alone before T4 to T7), which "asi" may or may not cover. Open, with no owner yet: what "excessive" is (he
  gave no figure); who reads the meter and when (T8 reads `get_usage` after phase 0's third day, and no command
  reads it); whether the advisor can come off sub-agents alone, since it comes from `advisorModel` in his settings
  and a sub-agent inherits it (`odd/tasks/advisor-home.md:118-121`), not checked. The reading to compare against,
  from the app's usage tool at 01:00 local on 2026-11-16: Fable 17% of the week, all models 38%, reset
  2026-11-20T14:00Z. Nothing of the design changes with this line, and no reader has read it.
- L15 His answer to question 2, recorded as 308, on 2026-11-16 at 01:47 local (06:47Z): `js-harness sessions
  --quote 699d7c29-54c4-460e-a5e8-700b114eb251 3167`, an answer to the lead's question tool, which showed A as the
  recommended option: "A: las abre el orquestador (Recomendada)". Tapped, not quoted, so it carries no rule change,
  and A needs none: the lead opens the work sessions, each on his tap of a card in the lead's chat or on a line he
  types there, and the Plan opens none. The question said what a yes covers: how the design is written and phase
  0's step 4, not the build. The channel holds it as a verified answer (kind `answer`, question 308, line 3167).
  Entered at the lead's word in "Ask me before" 2, "The hand-off and the start", phase 0's step 4, T5 and T9;
  those lines were added after the last read and no reader has read them. Still not checked: whether a turn that
  follows his typed turn can open one more session. Questions 309, 310 and 307 are open.
- L16 His answers to questions 3, 4 and 1, each a tap on a card of the lead's question tool, read with `js-harness
  sessions --quote 699d7c29-54c4-460e-a5e8-700b114eb251 <line>`, and held by the channel as verified answers. All
  three are "Tapped, not quoted". Question 3 (309), line 3217, 2026-11-16 at 02:27 local (07:27Z): "Fable 5.2 en
  alto", so the Plan runs on Fable 5.2 at high, in phase 0 and in T5. Question 4 (310), line 3239, 02:48 local
  (07:48Z): "A: sub-agentes dentro de cada sesión", so no session opens sessions and `fanout-tree.md`'s reading
  stands (its Log L9). Question 1 (307), line 3256, 03:08 local (08:08Z): "A: solo en el Plan". A changes three
  rules of his (`rule:questions-one-place`, `rule:lead-charter`, `rule:away-autonomy`) and a tap changes none: his
  typed line is still owed, the lead is asking for it, and until it is quoted here phase 0 runs under today's rules
  and T6's question part does not start. The question told him why it carried no recommendation: with A the lead
  stops knowing when he is away, L11's high finding Claude 2, read again here from the review's record
  (`double-reviews.jsonl`, read b88ea402) and its three citations checked at their lines. He chose A knowing it, so
  the design now owes the answer: T11, a design change that needs its read. Entered at the lead's word in "Ask me
  before" 1, 3 and 4, "Where he talks", "What runs at the same time", phase 0's step 2, T5, T6, T9 (closed) and
  T11 (new); none of these lines has been read by a reader. Not answered by any of the four: his approval of the
  page, and his line of L14 on the advisor.
- L17 His words, typed on 2026-11-16 at 13:58 local (18:58Z) as his answer to question 315 in the lead's chat
  (`js-harness sessions --quote 699d7c29-54c4-460e-a5e8-700b114eb251 5054`; the channel holds it as a verified
  answer): "Si rranca  la fase 0 pero no solo eso, se me olvido decirte que cada sesion por ejemplo Orquestador,
  Orquestador Plan y Senior deben saber cual es su rol y su funcion osea cada uno debe no solo tener un prompt
  inicial sino un rol especifico que haga que funcione mejor". The question asked his approval of the design so
  that he can talk to the Plan today, and told him what is not guaranteed: three reads used, the third's 21
  problems open and listed on the page, T11 unsolved, his four answers entered after the last read and read by
  nobody, the page older than them. It said a yes covers landing PR 894, storing the Plan's opening and telling
  him, after which he opens `JH PLAN · planes` on Fable 5.2 at high with Remote Control and pastes that message;
  and that it does not cover building anything (T3 to T7), the cost of T11's read, or a change of his rules: until
  he types question 1's line, the lead keeps asking him the decisions. So the first half starts phase 0 and takes
  PR 894 out of draft; it is not a yes to the 21 findings being solved. The second half is new and is Spec 9, with
  its bar line and T12, at the lead's word (its message to JH SR): a role of its own for each of the lead, the
  Plan and the senior, not only an opening prompt. Phase 0 does not wait for T12: JH SR writes the Plan's phase 0
  opening with an explicit role section and the lead stores it. Spec 9, its bar line and T12 were added after the
  last read and no reader has read them.
- L18 2026-11-16, from `odd/tasks/session-roles.md` (T12's design, its Log L5): the two documents touch the same
  lines. That design's T2 turns the roles of `bin/lib/sessions.mjs` into one exported list and ships the Plan's
  card in `bin/lib/role-cards.mjs`, found by a match of the title alone. So T5 here, when it makes `PLAN` a role,
  adds it to that list and finds its card there, and whichever of the two lands second carries the other's
  change; T7 here renders the Plan's role sentences from the card's constant and writes no second copy. Added
  after the last read of this document and read by no reader.
- L19 His typed line for question 1 (307), the one L16 said was owed. The lead asked it again as question 322,
  saying that `rule:questions-one-place` rests on his words of 2026-10-13 and that a tap does not change it. He
  tapped "A: solo en el Plan (escríbelo)" (lead transcript 699d7c29-54c4-460e-a5e8-700b114eb251, line 7705,
  2026-11-17T06:38:44Z) and then typed, read with `js-harness sessions --quote
  699d7c29-54c4-460e-a5e8-700b114eb251 7720` ("sent by the user", 2026-11-17T06:38:53Z, 01:38 local): "Solo en
  el Plan". What the question said a yes covers: only where his questions reach him, changed on a `rule/`
  branch with his phrase and its date; it changes who decides nothing and authorizes no spend; and until the
  Plan's session is open his questions keep reaching him in the lead's chat. So T6's question part no longer
  waits for his words. It is not built yet, at the lead's word (by message, 2026-11-17): JH 212 changes
  `rule:questions-one-place` first, so that every question comes with options, and T6 is rebased on it after it
  lands; T11 is still open and still comes before T6's question part. Entered after the last read of this
  document and read by no reader.

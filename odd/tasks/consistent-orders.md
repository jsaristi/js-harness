# consistent-orders — orders that hold over a long run (JH 208)

## State
S1 built (1a4ec235) and hardened (a compaction breaks the stretch by its own mark, L8). The plan's double review ran
(L8): what goes now (S1, S5) covers 1 of the 6 uncaught rows of the inventory; the lead's own consult (S2) and the
sub-agents (S4) wait, so his "también sesiones y sub-agentes" is not yet met, and the lead is told so. Next: S5 tests
first; S2 replanned as a design, on a blocked-state signal (readStalled treats `waiting` as work given back, so it
cannot be the signal as it is: L8, codex 3).

## Goal
An order the harness gives a session, a work session or a sub-agent (first: consult the advisor when blocked) is held
by a check at the act, so it is not done early in a run and skipped later.

## Why
His words (Log L1-L3): the lead "barely consulted the senior", work barely advanced, and the same happens to sessions
and sub-agents: "haces las cosas pero a la final te las saltas". Today's record (Depth pass, item 2): the hooks that refuse caught
every skip they saw; a hook that only records (SubagentStop) did not; orders written nowhere (a consult before
answering a block, while a session waits) were missed with nothing to say so; one prose order (Key Learnings) held.

## Done when
- `node --test bin/advisor-gate.test.mjs` exits 0, with S1's cases failing on main first
- `node --test bin/stretch.test.mjs` exits 0, with S5's cases failing on main first
- `npm run check` exits 0
- S2: a replanned design the lead approves (no build in this feature until then)
- Codex and the Claude lenses reviewed each code slice; one independent verifier (opus) passed clean before ready

## In scope / Out of scope
- In: `bin/advisor-gate.mjs` and its test, `bin/lib/advisor-gate.mjs`; `bin/stretch.mjs` / its lib and tests (S5); a `rule/` branch
  for S5's rule; this document; this feature's own entry in `docs/ROADMAP.md`.
- Out: JH 207's surfaces (codex-review*, check-codex-reviews, lens rows, check's quiet line); other entries of
  `docs/ROADMAP.md`; a block of rules loaded every turn (reverses F2's context diet: his call, Depth pass item 5).
- Out, his decisions (the brief): whether a compaction keeps the consult; whether the senior's own sub-agents are
  exempt; what happens when the advisor tool is unavailable. Each check below reuses the gate's existing behaviour
  for these (a compaction's summary breaks the stretch, `breakOf` at `bin/advisor-gate.mjs:107-117`; the senior is
  exempt, `:246`; an outage or no advisor tool lets the act through, `:264-269`). S1 reuses all three. The lead ruled
  (L7) that S2 reuses `breakOf` too.

## Constraints
- A Stop hook turns a stop back once (`stop_hook_active`, `bin/reply.mjs:229,267`) — the host's contract, so a lead
  that ignores the warning stops anyway; the PreToolUse refusal (S1) holds every time.
- Fail open — the gate's rule (`bin/advisor-gate.mjs:9-10`): an unreadable record lets the act through, recorded.
- The reply hook's time budget (odd/tasks/reply-hook-latency.md) — S2 reads the tail as stop-wake does.

## Ask me before
- S4 (a sub-agent's end refused), the senior's sub-agents' exemption: the lead takes them to him.
- The gentle-ai block every turn: the lead ruled no (L7, his line 62099); the double review (L8, claude 7) holds it is
  his call, since his newer line 15682 asks to copy gentle-ai's form; the lead decides whether to ask him.

## Depth pass

- 1. Method: the discipline is control engineering applied to agent harnesses: an order that matters is enforced at
  the act it governs (a poka-yoke), not remembered. Its best practitioner here is gentle-ai's own design as this repo
  reverse-engineered it: "What must be right is decided by code, and the model is handed the next step as data"
  (docs/proposals/gentle-ai-reverse-engineering.md:764), with prose kept consistent by tests (:778) and "a strong
  model carries the rest, and that costs context" (:789). The smallest change that meets it: add the missing acts to
  the gates that already exist (the advisor gate, the reply Stop hook), whose refusals already carry the next step;
  no new mechanism and no per-turn text. Searched first (`rule:reuse-first`): `gatedAct` (bin/advisor-gate.mjs:61-81)
  gates question, land, session, plan, done, never `waiting`; `wakeWarning` (bin/lib/stop-wake.mjs) is the neighbour
  Stop check that reads the channel; `stretch open` (bin/stretch.mjs) holds a departure plan with `waits`, never
  pre-decided forks.

- 2. Raw material:
  - His words: lead transcript 69918425 line 15446 (2026-11-15T15:22:46Z, queued), line 15682 (15:34:29Z, his answer
    to question 289, channel line 3137), line 16074 (15:54:55Z, question 290: yes); and on gentle-ai, transcript
    0f71b2c6 line 14832 (2026-10-29), line 14968 (2026-10-29), line 62099 (2026-11-04: "no es copiarla lo de
    gentle-ai"). All quoted in the Log.
  - gentle-ai's block: D:\harness-backups\claude-config-20260808-143521\CLAUDE.md:56-229 (the `sdd-orchestrator`
    block, about 8k tokens every turn then, 30.7k by 2026-10-26 per docs/proposals/gentle-ai-reverse-engineering.md:166-177);
    its role line :63 ("You are a COORDINATOR, not an executor"); its gatekeeper,
    skills/_shared/sdd-orchestrator-workflow.md:124-142 (every phase result validated before the next, re-run
    "exactly once", then stop); its result envelope, skills/_shared/sdd-phase-common.md:71-82.
  - Today's record: the gate's decisions, ~/.js-harness/advisor-gate/decisions.jsonl (131 since 05:00Z, lines 303-433: 5 flagged,
    lines 341, 378, 384, 424, 430; sub-agent ends 25 covered, 2 flagged (384, and 430, JH 208's own explorer), 66 with
    no transcript (46 recorded unchecked with ENOENT before T7, 20 no-transcript)); the channel, ~/.js-harness/channel/D--js-harness.jsonl
    lines 3101, 3121, 3123, 3128 (the four `waiting` notices); the transcripts of the lead (69918425), JH 207
    (a628cf6f, lines 344, 502, 947, 1217), JH 206 (b5306f38, lines 1340, 1693), JH 199 (32c68504), JH 204 (c7fcec48).
  - The inventory, each order skipped today, who skipped it, whether it was written for that session and what acts on it:

    | who | order | written where | skipped (record) | acts on it today | caught |
    |---|---|---|---|---|---|
    | lead | consult before a deciding act | the gate | question 07:48Z, transcript line 13011 | advisor-gate (refuse) | yes |
    | lead | consult before answering a block (a new order, not a skipped one) | nowhere (a `note` is not gated) | note to JH 206 10:50Z, last consult 09:40Z | nothing | no |
    | lead | consult while a session waits on it (a new order, not a skipped one) | nowhere | JH 207 waiting 12:46Z → next consult 15:02Z; idle 13:08-14:49Z | nothing | no |
    | lead | closing state line; no decision while work runs | CLAUDE.md, reply hook | transcript lines 12913, 14706, 15334 | bin/reply.mjs | yes |
    | JH 207 | consult when blocked | host's advisor tool text only | waiting 12:46Z (line 947), 14:53Z (line 1217) | nothing | no |
    | JH 207 | depth pass before code; keep the wait armed | rule, stop-wake | S1 commit 12:45Z; wait killed | contracts row, stop-wake | yes |
    | JH 206 | consult when blocked | host's text only | waiting 10:46Z (line 1693), consult 10:25Z | nothing (but R covered it) | n/a |
    | JH 206 | chained steps; state line; local times | rules, guard, reply hook | lines 1662, 893, 2376 | guard, reply hook | yes |
    | JH 199 | verifier before ready | its brief | ready 11:36Z "NO verifier pass (my call)" | nothing; the lead set the PR to draft by hand | no |
    | JH 199, JH 204 | consult before deciding acts | the gate, for its acts only | 79 and 122 tool calls of commits and verifier launches unconsulted | nothing (not gated acts) | no |
    | JH 199 | consult before `closed` | the gate | 15:38Z, decisions line 424 | advisor-gate | yes |
    | sub-agent of JH 206 | consult before a question | the gate | decisions line 378 | advisor-gate (refuse) | yes |
    | sub-agent of JH 206 | consult before returning | the gate, record only | decisions line 384 | `--stop`, recorded, never refused | no |
    | sub-agents | Key Learnings close | CLAUDE.md | none skipped (19 of 19 read) | nothing | n/a |

    Not checked: tests first and decisions written to the feature document (no record was read for them). The
    consult-on-block order was written for a session only in this brief (`grep -l "every time you are blocked"` over
    the four briefs of 2026-11-15, JH 201, JH 203, JH 207 and JH 208: this one; JH 206's and JH 199's briefs are not
    in that day's folder), so JH 206 and JH 207 skipped no harness order, only the host's advisor
    text ("When stuck"). The lead's 10:51 notes add: the Stop hook was the only thing that caught a skip today; the
    context hook read 99-120% while the host said 65% and drove about 4 state-save rounds; a wait must always run yet
    the reply hook refuses a decision while background work runs; `stretch` counts only failed gates as lost time
    (it counts recorded failures, gates, lands and Codex reviews, and no idle or answer wait: 0.16 h shown against about 3 h idle). Those four are follow-ups (Tasks), not this feature.
  - gentle-ai against js-harness:

    | gentle-ai | js-harness today | missing |
    |---|---|---|
    | code decides, the next step handed as data (review transaction) | hooks that refuse with the next command: guard, advisor gate, reply hook, template gate | the acts no gate holds: `waiting`, a lead idle while a session waits, a sub-agent's end |
    | gatekeeper: every result checked, one re-run, then stop | SubagentStop records, never refuses | a refusal of an unconsulted sub-agent end (S4, his call) |
    | prose maintained as code (goldens, ratchets) | `rules check`, conventions tests, `rules coverage --strict` (PASS today) | nothing for this feature |
    | a large block loaded every turn (coordinator role, triggers, self-check) | about 4.3k tokens a turn after F2 | his call: copying it reverses F2's diet |
    | result envelope with status and risks | the Key Learnings close only | a later slice if a sub-agent check needs it |

    `js-harness rules coverage --strict`: PASS. `Read by: none` holds for 35 of 82 rules, but it names who reads a
    rule's value, not what enforces it: `reply-five-states` reads "none" and `bin/reply.mjs` holds it on every stop.

- 3. The bar:
  spec 1: `node --test bin/advisor-gate.test.mjs`: none, new behaviour (`notify --kind waiting` with no consult in its stretch is refused)
  spec 2: `node --test bin/lib/stop-consult.test.mjs`: none, new behaviour (the lead's idle close is turned back while a live session's newest notice to it is `waiting` and no consult came after it; replayed today: 3 of 62 ends)
  spec 3: left out because with S1 in place a work session's `waiting` cannot be sent unconsulted, and on today's record S3 catches nothing S1 does not (JH 207's closes at 12:49Z and 14:53Z follow the two notices S1 refuses); folded into S1, with two limits the double review found (L8): policy R lets an earlier unrelated consult cover a new block, and a refused session can send a `note` or end its turn instead, which S1 does not hold; S2's replan carries that case
  spec 4: left out because a sub-agent end refused changes what his yes to question 282 left apart (bin/advisor-gate.mjs:8-9) and the exemption of the senior's sub-agents is his; the records show 2 flagged of 27 readable ends today and 66 of 93 with no transcript, so the lead takes it to him with that figure
  spec 5: `node --test bin/stretch.test.mjs`: none, new behaviour (a stretch plan carries 2-4 forks with a proposed answer, shown at open; a plan with 1 or 5 forks is refused; a plan with none opens as today; what open prints says the forks grant no spend and no publishing)
  Excellent here means: each check refuses the case it was built for on today's record, and nothing else; its
  refusal names the next act (consult, then retry); it reuses the gate's stretch, exemption and fail-open.

- 4. Refutation: the cheapest test that could show the checks would not have caught today's skips is to replay them
  on today's record.
  - S1, the gate on `waiting` under policy R, replayed with the gate's own `readStretch` cut at each notify call
    (`node C:/Users/Oficina/.claude/jobs/b8e90a0a/tmp/replay.mjs <JH 207 transcript> <JH 206 transcript>`): of the 4
    `waiting` notices, 2 refused (JH 207 12:46Z and 14:53Z: calls 0, broken at 60 tool calls) and 2 covered (JH 207
    12:34Z by its 12:26Z consult; JH 206 10:46Z by its 10:25Z consult). It forces a consult before the two notices
    that preceded JH 207's 2 h 40 min wait; whether that consult would have unblocked it stays the brief's assumption.
    No sub-agent has ever sent `waiting` (`node C:/Users/Oficina/.claude/jobs/b8e90a0a/tmp/subs.mjs`: 0 of 973
    sub-agent transcripts), so S1 builds nothing for sub-agents.
  - S2, the lead's close, replayed with its real predicate at each of the lead's 62 turn ends since 05:00Z (channel
    state at that moment, gate stretch on the transcript cut there:
    `node C:/Users/Oficina/.claude/jobs/b8e90a0a/tmp/replay-lead.mjs`). Predicate A, no lead consult after the
    notice: 3 turned back (10:51Z, 12:38Z, 12:48Z), 3 consults forced. It misses the 13:08Z close before the
    1 h 40 min idle: JH 207 had sent a later notice that was not `waiting`. Predicate B, no consult after it inside
    the lead's stretch: 19 turned back, most of them from 8 stale `waiting` notices of sessions long gone (JH 101,
    JH 137, JH 138, JH 160, JH 166, JH 193, JH SR). With those dropped, every end with a live `waiting` shows a
    stretch call, so B also comes to 3: the count does not separate them. Chosen: A, because it is question 289's
    own wording. "Live" is open: the lead's transcript predates those 8 notices, so stop-wake's transcript-start bound
    would not drop them; `bin/lib/sessions-running.mjs` (`readRunning`) is the candidate. The replay did not filter
    for idle closes, so 3 is an upper bound. The 13:08Z miss: JH 207 was still blocked and sent `note`s at 12:48Z,
    12:53Z and 13:06Z (channel lines 3125-3127), so "newest notice is `waiting`" misses a blocked session that then
    sends a note; the lead rules whether that matters.
  - Its limits, measured: it acts at a close, never while the lead sits idle (at 14:49Z the lead was woken by
    JH 199, not by JH 207's notice), and once per close (the host's contract).
  Verdict: supports

- 5. Request: hold the orders the record shows skipped to a check at their act, reusing the advisor gate and the reply
  Stop hook as gentle-ai held its own (code decides, the next step is handed as data), and copy none of its per-turn
  block. S1: the advisor gate holds `notify --kind waiting` to a consult in its stretch (work sessions; it also
  covers S3). S2: the reply Stop hook turns back the lead's idle close while a live session's newest notice to it is
  `waiting` and no lead consult came after that notice. S4, a sub-agent's unconsulted end refused, goes to him through
  the lead: without it this plan builds nothing for sub-agents. S5: the departure plan of `stretch open` carries 2-4
  forks with the lead's proposed answer; his one approval is recorded as his answer to the question that shows them
  (the channel, as every answer is); "nothing outside them" is held by the lead's protocol and the rule, not by a
  check (open: a check would need to read acts against forks). Cemented as a rule on a `rule/` branch. Each with tests
  that fail on main, its two reviews, and one verifier before ready.
  Adds: departure pre-decisions in the stretch plan, S5 (question 290)

## Specs
1. "Consult it too every time you are blocked, before you send a `waiting` notice" (the brief's Gate), held for work sessions (sub-agents never send `waiting`: 0 of 973): the gate refuses `notify --kind waiting` with no consult in its stretch.
2. "el hook de cierre me rechaza el 'Sigo solo' mientras el último aviso de una sesión sea 'waiting' dirigido a mí y no haya una consulta al advisor después" (question 289, which he answered yes and wider).
3. "lo mismo le debe estar pasando a las sesiones" (line 15682): a work session's idle close while its own newest notice is `waiting` and no consult covers it.
4. "y a los sub agentes" (line 15682): a sub-agent that stops on a block is checked as a session is (the lead's reading); refusing its end is his call.
5. "al abrir un tramo, el plan lleva 2 a 4 casos con mi respuesta propuesta ... los apruebas o corriges de una vez y durante tu ausencia actúo según ellos. Es un cambio de protocolo; no autoriza nada fuera de esos casos, ni gasto, ni publicar" (question 290, yes).

## Tasks
- [x] T1 (kind: build) S1, spec 1 (two cases failed on main, 26 of 26 pass after): `waiting` a gated act in `gatedAct`; tests first in bin/advisor-gate.test.mjs; route inline; commit `feat(advisor-gate): hold a waiting notice to a consult`
- [ ] T2 (kind: design) S2, spec 2: replan on a blocked-state signal that survives a later `note` (the waiting, note, idle case first), with liveness and resolution rules, without changing readStalled's contract; define the idle close; the lead approves before a build
- [ ] T3 (kind: build) S3, spec 3: left out, folded into S1 (Depth pass item 3)
- [ ] T4 (kind: design) S4, spec 4: the lead asks him; build nothing until then
- [ ] T5 (kind: build) S5, spec 5: `forks` in the stretch plan, shown at open; rule via `rules change` on a `rule/` branch; route inline; commit `feat(stretch): pre-decided forks in the departure plan`
- [ ] T6 (kind: verify) one independent verifier (opus) over T1 and T5
- [ ] F1 follow-up, owner: the lead — JH 199's ready without its verifier: a ready notice could require a verifier record (not built here)
- [ ] F2 follow-up, owner: the lead — the context hook's 99-120% against the host's 65%
- [ ] F3 follow-up, owner: the lead — the clash between an armed wait and the decision close
- [ ] F4 follow-up, owner: the lead — `stretch` lost time counts only failed gates
- [ ] F5 follow-up, owner: the lead — the lead's unconsulted `note` answering a block (10:50Z): a `note` to a waiting session is not gated; S2 forces the consult at the next close, not before the note
- [ ] F6 follow-up, owner: the lead — JH 199's and JH 204's long stretches of commits and verifier launches with no consult: those acts are not gated by his yes to question 282; widening the gated acts is his call
- [ ] F7 follow-up, owner: the lead — 8 stale `waiting` notices from sessions long gone stay newest in the channel

## Log
- L1 (2026-11-15, lead transcript 69918425 line 15446, 15:22:46Z, queued) his words: "veo que casi no consultaste al senior y ademas casi no avanzamos debe haber una forma de mitigar esto"
- L2 (2026-11-15, line 15682, 15:34:29Z, his answer to question 289, channel line 3137) his words: "Pero lo mismo le debe estar pasando a las sesiones y a los sub agentes por favor corrige completamente esto, no puedes seguir cometiendo errores por eso que deje de confiar en Opus 5.5 por que no estas logrando el objetivo o haces las cosas pero a la final te las saltas, eres muy bueno para trabajar mucho tiempo seguido pero pierdes la forma de recibir ordenes, por eso te decia que copiaras las forma que tenia gentle-ai de ser siempre consistente"
- L3 (question 289 as asked, channel line 3136) "Sí: el hook de cierre me rechaza el 'Sigo solo' mientras el último aviso de una sesión sea 'waiting' dirigido a mí y no haya una consulta al advisor después; lo construye una sesión, con tests primero. Es un cambio de protocolo. No autoriza la mitigación 2 (decidir por adelantado al irte), que te pregunto aparte." His answer, L2, is yes and wider.
- L4 (2026-11-15, line 16074, 15:54:55Z) his answer to question 290: "Sí, por adelantado (Recomendada)", to "al abrir un tramo, el plan lleva 2 a 4 casos con mi respuesta propuesta (por ejemplo: 'si el verificador encuentra un fallo que ya está en main, aterrizo'); los apruebas o corriges de una vez y durante tu ausencia actúo según ellos. Es un cambio de protocolo; no autoriza nada fuera de esos casos, ni gasto, ni publicar." The lead's note of 10:55 local puts it in this feature: inside `stretch open`'s plan, no new command, cemented as a rule.
- L5 his earlier words on gentle-ai, transcript 0f71b2c6: line 14832 (2026-10-29T02:51Z) "hay que hacer plantillas de todo y estandarizar todo ... osea como lo hace gentle-ai que funciona tambien en todo"; line 14968 (02:55Z) "el arnes lo que hace es que genera consistencia ... podemos hacerlo para que funcione SI o SI como debe"; line 62099 (2026-11-04T02:06Z) "Recuerda que no es copiarla lo de gentle-ai, para eso se hizo una revision completa y profunda de como ibamos a cuadrar y a utilizar el arnes completo". Read together with L2: copy the form (checks at the act), not the doctrine; whether to bring back a per-turn block is his.
- L6 (2026-11-15) depth pass written; verdict supports; sent to the lead, no source before its answer.
- L7 (2026-11-15 11:15 local, the lead's note) S1 and S5 go. S2 not yet: its predicate misses 13:08Z; plan it on the
  stall signal (odd/tasks/stalled-sessions.md, `readStalled` in bin/lib/stall.mjs:200) if that is the signal to
  amend. Compaction: reuse `breakOf` (bin/advisor-gate.mjs:107-117), which fails safe. No per-turn block (his line
  62099). S4 is his question later. The plan's double review costs about 1.1M Claude and 0.9M Codex tokens, about 1%
  of Codex's weekly limit (weekly at 76% now), said to the lead before it runs.
- L8 (2026-11-15) the plan's double review, read f4cdfb86: Claude 10 findings, Codex 6. Taken: claude 1, 2, 4, 5, 6,
  8, 10 and in part 3, 7, 9; codex 1-6. Done: the document follows L7 (S2 is a design, its test out of Done when); the
  State says what goes covers 1 of the 6 uncaught rows; the Why and the figures corrected (5 flagged; 66 of 93 ends
  with no transcript); spec 5 carries "ni gasto, ni publicar" and its fork-count cases; S1's limits written (policy R
  per stretch, not per block; a refused session may send a note); `breakOf` matches `isCompactSummary` by its own
  mark, with a test that failed on main for an isMeta summary. Not taken: replaying S1 over every earlier day (claude
  9; today's record is the bar, earlier days a sample the verifier may add); the gentle-ai block stays the lead's
  ruling, its question to him the lead's to send (claude 7).

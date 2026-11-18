# consistent-orders — orders that hold over a long run (JH 208)

## State
PR 886 landed (19:08Z). S4 is PR 887 on main at baf82737: reviewed clean by Codex and the lenses at each fix, the
verifier PASS on its recheck (L21); ready goes to the lead. S2's design is restated whole in L22 (2026-11-18, JH 221),
checked against main at b044dbf7, and goes through its double review there; it waits for the lead's approval and his
three rulings (L22, "The lead decides"); nothing of it is built. S6's design (L14) waits for its double review and the
lead. S5's rule is unblocked.

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
  spec 2: `node --test bin/lib/stop-consult.test.mjs`: none, new behaviour (the lead's idle close is turned back while a live session's newest notice to it is `waiting` and no consult came after it; replayed today: 3 of 62 ends; replanned on a block that survives a later `note` by the lead's ruling, L7, and restated in L22, which supersedes this predicate)
  spec 3: left out because with S1 in place a work session's `waiting` cannot be sent unconsulted, and on today's record S3 catches nothing S1 does not (JH 207's closes at 12:49Z and 14:53Z follow the two notices S1 refuses); folded into S1, with two limits the double review found (L8): policy R lets an earlier unrelated consult cover a new block, and a refused session can send a `note` or end its turn instead, which S1 does not hold; S2's replan carries that case
  spec 4: left out because a sub-agent end refused changes what his yes to question 282 left apart (bin/advisor-gate.mjs:8-9) and the exemption of the senior's sub-agents is his; the records show 2 flagged of 27 readable ends today and 66 of 93 with no transcript, so the lead takes it to him with that figure
  spec 5: `node --test bin/stretch.test.mjs`: none, new behaviour (a stretch plan carries 2-4 forks with a proposed answer, shown at open; a plan with 1 or 5 forks is refused; a plan with none opens as today; what open prints says the forks grant no spend and no publishing)
  spec 6: left out because its check is designed in T7 and the lead approves its shape before a build: `rule:reports-spanish-visual` reads "Read by: none" today, and what makes a reply a report a hook can tell is the open question
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
  `waiting` and no lead consult came after that notice (the request as first written; L22 holds the replanned design). S4, a sub-agent's unconsulted end refused, goes to him through
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
6. "siempre dame informes en artefactos visuales bien explicados con colores y de forma dinamica o didactica en vez de escribirme en el chat ... como si yo no supiera absolutamente nada, recuerda que esto no es solo una solucion para mi sino para una persona que no tiene conocimiento de nada" (lead transcript 69918425 line 16680): `rule:reports-spanish-visual` widened to always, for any user, and held by a check.

## Tasks
- [x] T1 (kind: build) S1, spec 1 (two cases failed on main, 26 of 26 pass after): `waiting` a gated act in `gatedAct`; tests first in bin/advisor-gate.test.mjs; route inline; commit `feat(advisor-gate): hold a waiting notice to a consult`
- [ ] T2 (kind: design) S2, spec 2: replan on a blocked-state signal that survives a later `note` (the waiting, note, idle case first), with liveness and resolution rules, without changing readStalled's contract; define the idle close; the lead approves before a build (designed: L13, restated whole in L22 with its double review; the lead's approval and rulings pending)
- [ ] T3 (kind: build) S3, spec 3: left out, folded into S1 (Depth pass item 3)
- [x] T4 (kind: build) S4, spec 4: his yes (L12); turn back an unconsulted sub-agent end once; tests first; commit `feat(advisor-gate): turn back an unconsulted sub-agent end once`
- [x] T5 (kind: build) S5, spec 5 (code built, two tests failed on main, 67 of 67 pass; the rule's `rule/` branch after this pull request lands): `forks` in the stretch plan, shown at open; rule via `rules change` on a `rule/` branch; route inline; commit `feat(stretch): pre-decided forks in the departure plan`
- [ ] T7 (kind: design) S6, spec 6: amend `rule:reports-spanish-visual` with his quote (`rules change` on a `rule/` branch) and design the check that acts on it (a candidate: the reply hook turns back a report close with no Artifact published in the turn); the lead approves before a build
- [x] T6 (kind: verify) one independent verifier (opus) over T1 and T5: PASS (L10)
- [ ] F1 follow-up, owner: the lead — JH 199's ready without its verifier: a ready notice could require a verifier record (not built here)
- [ ] F2 follow-up, owner: the lead — the context hook's 99-120% against the host's 65%
- [ ] F3 follow-up, owner: the lead — the clash between an armed wait and the decision close
- [ ] F4 follow-up, owner: the lead — `stretch` lost time counts only failed gates
- [ ] F5 follow-up, owner: the lead — the lead's unconsulted `note` answering a block (10:50Z): a `note` to a waiting session is not gated; S2 forces the consult at the next close, not before the note
- [ ] F6 follow-up, owner: the lead — JH 199's and JH 204's long stretches of commits and verifier launches with no consult: those acts are not gated by his yes to question 282; widening the gated acts is his call
- [ ] F8 follow-up, owner: the lead — the gate's report will count `waiting` notices sent before S1 was installed as acts with no decision (bin/advisor-gate.mjs, the reconciliation)
- [ ] F9 follow-up, owner: the lead — inherited false refusals: an `echo`, a shell comment or an unquoted heredoc commit body that names a gated notify reads as that act (JH 206's T8, odd/tasks/advisor-use.md); also a non-js-harness tool chained after a notice whose own `--kind` is a gated word (L11)
- [ ] F10 follow-up, owner: the lead — README and the gate's usage text describe the stretch without the compaction break
- [ ] F11 follow-up, owner: the lead — `notify --kind ready --pr` refuses while the pull request's head is not the sender's HEAD
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
- L9 (2026-11-15 11:36 local, the lead's note) his new order, line 16680 (16:36:08Z): reports always as visual,
  didactic artifacts instead of chat text, explained as for someone who knows nothing, for any user of the harness.
  Planned as S6 (T7, design first).
- L10 (2026-11-15) the independent verifier (opus) over S1 and S5: PASS, 115 of 115 tests, `npm run check` green.
  Fixed (2d9d8f0d, Codex and the risk and reliability lenses clean): `kindsOf` reads every `--kind`, so a chained
  or repeated-flag notice is gated for every kind; `forks: []` reads as none. Left as follow-ups: F8 and F9. Not
  checked by it: the host's real compaction entry (the fixture follows transcript 69918425's isCompactSummary lines).
- L11 (2026-11-15) the verifier again, on 2d9d8f0d: PASS, 60 of 60 tests; only `clean` and `template new` take another
  `--kind`, with no gated value; one new low false refusal (another tool's `--kind ready` chained after a notice), F9.
- L12 (2026-11-15, lead transcript 69918425) his answers: question 294, line 17415 (18:02:43Z), "Devolverlo una vez
  (Recomendada)" to "ese final se devuelva una sola vez, para que el sub-agente consulte y luego termine; si el registro
  no se puede leer, pasa sin bloquear ... No cubre bloquear más de una vez ni tocar otras órdenes"; question 295, line
  17459 (18:03:39Z), "Sí, también consultan (Recomendada)": only the senior session and Fable-model sub-agents stay
  exempt. For S6, line 17216 (the lead's note): "la idea es seguir haciendo todas las cosas así".
- L13 (2026-11-15) S2's design, replanned (T2). Measured first: at the 13:08Z close the lead had already answered
  JH 207's 12:46:11Z `waiting` with a note (12:47:47Z, channel line 3124), and JH 207, still blocked, sent three
  notes (lines 3125-3127). So no rule on the kinds of notices alone catches 13:08Z, the lead's answer included.
  - Signal, a new pure function beside `readStalled`, whose contract does not change: a work session is blocked from
    its newest `waiting` to the orchestrator until it sends `ready`, `closed`, `relieved` or `question` (a question
    moves the block to the owner), or its branch gets a commit after the notice (`branchCommitAt`, bin/lib/stall.mjs).
    Neither its own later `note` nor the lead's answer clears it: the blocked session's next act does.
  - Liveness: a block is live while the session has not given its work back, its background job was not removed
    (`removed` in background/sessions.jsonl) and its newest own notice is under a bound the lead sets (proposed 6 h,
    a constant). Probe at 13:08Z (`node C:/Users/Oficina/.claude/jobs/b8e90a0a/tmp/blocked.mjs`): of the 5 stale
    unresolved `waiting` notices, 2 sent `ready` later (JH 58, JH 142), 2 had their job removed (JH 101, JH 134) and
    1 is 39 h old with no job record (JH 193); all 5 are out under these rules.
  - The check, at the lead's idle close: a lead stop whose reply closes in the `working` state ("Sigo solo"), with
    or without a wait running in the background (13:08Z had one), is turned back once while a live session is
    blocked and the lead has no advisor call with a result after that session's newest notice. Each note of a blocked
    session asks a new consult, so a block cannot sit behind one early consult. The second stop goes through
    (`stop_hook_active`); an unreadable record or transcript lets the close through, said on standard error.
  - Where: `bin/lib/stop-consult.mjs`, called from bin/reply.mjs beside the wake check, reading the record and the
    transcript through the stop's shared `io`; the consult is read with the advisor gate's parsing, exported.
  - Limits: it acts at a close, never while the lead sits idle; a blocked session that commits something unrelated
    clears its block. To measure at the build: the full replay of the lead's 62 ends with this predicate, 13:08Z
    turned back expected.
  - The lead decides: the 6 h bound, and whether a `question` clears the block.
- L14 (2026-11-15) S6's design (T7). `rule:reports-spanish-visual` (bin/lib/protocols-skill.mjs:106) already sends what
  the user reads to understand or decide as a visual, didactic page. His orders add three things: always ("siempre
  dame informes en artefactos visuales", line 16680), for someone who knows nothing ("como si yo no supiera
  absolutamente nada"), for any user of the harness, not only him ("no es solo una solucion para mi sino para una
  persona que no tiene conocimiento de nada"), and to keep doing it ("la idea es seguir haciendo todas las cosas
  así", line 17216).
  - The rule change (`js-harness rules change reports-spanish-visual`, a `rule/` branch, his quotes with their
    date): every report reaches the user as that page; it assumes no prior knowledge (each term said in everyday words
    at its first use, a diagram for each mechanism, what a decision covers and does not); it is written for any user
    of the harness, so no page leans on what one owner already knows.
  - The check: the reply Stop hook turns back once a reply that closes in `decision`, `cut` or `finished` with a
    body over a bound in lines (proposed 25) when the turn made no Artifact publish or open since the user's last
    message; it fails open. Sessions that only report through `notify` are held already: a close carries its summary,
    whose page `js-harness report feature` makes.
  - The lead decides: the line bound, and whether a `working` close with a long report is held too.
- L15 (2026-11-15) a mistake, told in five parts. What happened: my first `ready --pr 886` went out while the PR's
  branch held 039902d9; the verified 2d9d8f0d sat on the local `worktree-consistent-orders`, pushed only inside the
  later `feat/consistent-orders-s4`; the lead caught it (13:31 local). The fix now, checked: fast-forward, no force,
  039902d9..8402785b (`gh pr view 886 --json headRefOid`: 8402785b), ready re-sent at 13:35 local. What stops it
  recurring: a check before a line, F11 (`notify --kind ready --pr` refuses while the PR's head is not HEAD). Where
  and when: notify's ready path, the lead's to assign. The proof: `js-harness failures` lists ready-head-not-pushed
  with no second `- Seen:` line. The advisor, before the re-send, also found two S4 gaps the reviews missed: a
  turned-back sub-agent might end with "consulted, done" and lose its result for the caller (the reason now asks for
  the whole result again), and once rested only on `stop_hook_active`, which no record shows the host sending true
  (357 of 357 ends recorded false; it is now also read from the gate's own turn-back record); both pinned by tests
  that failed first.
- L16 (2026-11-15) the independent verifier (opus) over 87b1c568: PASS with four findings. A, medium: the turned-back
  sub-agent's result is lost to its caller; B, low: a payload with no `stop_hook_active` is blocked every stop
  (bounded by the host's cap of 8); C, low: two comments still said never blocked; D, low: the report counted a
  turned-back end twice. A, B and C were already fixed in the tree from the advisor's read (L15); D fixed with a test
  that failed first. Its proof: the commit's tests run on 551f48e4, 26 pass and 2 fail, the two new ones; the
  host's hooks reference confirms `{ decision: 'block', reason }` for SubagentStop and lists `stop_hook_active`.
- L17 (2026-11-15) S2's replay with L13's predicate over the lead's 73 turn ends since 05:00Z
  (`node C:/Users/Oficina/.claude/jobs/b8e90a0a/tmp/replay-s2.mjs`): 9 turned back, all 9 idle closes (of 70):
  10:51Z (JH 206), 12:38Z, 12:48Z, 12:50Z, 12:56Z and 13:08:52Z (JH 207, which is caught), 16:35Z, 16:37Z and
  16:50Z (JH 208's own 16:18Z `waiting`, and JH 207's at 16:47Z). An upper bound: the branches of JH 207 and JH 208
  were not on origin, so the commit rule was not applied to them; the build reads the worktree, which would clear
  JH 208's three if it committed after 16:18Z. A new consult for each note of a blocked session costs 3 of the 9
  (12:50Z, 12:56Z, 13:08Z).
- L18 (2026-11-15) S4's review rounds. 87b1c568: Codex clean (0.93), the lenses 0. 53b2038d (the advisor's and the
  verifier's fixes): Codex and the reliability and readability lenses found the report still counted an end let
  through by the log twice, and dropped one another hook turned back first; fixed in 64883e5f (`afterTurnBack` from
  the gate's own log). Its review: Codex (blocking) and readability, old repeat records no longer dropped; fixed in
  89b4948b (every new end record carries `afterTurnBack`; one without the key at a second stop stays a repeat).
  Codex's recheck: 1 of 1 fixed. Answered, not fixed: the lenses' recheck says records written by 64883e5f's code
  (the key only when true) would be misread. None exists: the hook runs the installed js-harness from main
  (`~/.claude/settings.json` line 218, `js-harness advisor-gate --stop`), and the real log holds 0 records with
  `afterTurnBack` or `turnedBack` and 0 with `"secondStop":true` (`grep -c` on decisions.jsonl); 64883e5f never ships.
- L19 (2026-11-15) the advisor, before S4's ready: since 53b2038d once was per sub-agent id, not per end: a sub-agent
  turned back once let every later end through uncounted, and his words are "ese final" (a sub-agent resumed with
  SendMessage keeps its id). Fixed: a stop is a repeat only when that sub-agent's newest recorded end is the
  turn-back; a test (a later unconsulted end of the same id is turned back again) failed first. L17's figure,
  checked against local branches: JH 208 committed from 16:25:54Z after its 16:11:19Z `waiting`
  (`git log worktree-consistent-orders`), and JH 207 from 15:32Z after its 14:53:30Z one (`git log feat/review-gate`),
  so 16:35Z, 16:37Z and 16:50Z drop: S2 turns back 6 of the lead's 70 idle closes, 13:08:52Z among them, 3 of them
  from a blocked session's later notes.
- L20 (2026-11-15) the independent verifier (opus) on 9fce032c, the head after L19: PASS, 32 of 32, with probes of
  14 stop sequences; no loop or wrong block in normal operation. Fixed with tests that failed first: (1) a decision
  log the gate cannot write (or, not missing, cannot read) blocked every stop of one end when the host omits the flag,
  so the end now goes through, his words for a record that cannot be read; (2) a log line that is no object threw
  before any record, so it is skipped; (4) the test file's header. Left, a stated limit: (3) an end a second hook
  turns back after the gate's repeat can count one extra flag in `report` (another hook's block, then a third stop).
- L21 (2026-11-15) 3ac9ad53: Codex clean (0.94); the lenses: nothing pinned an unreadable but appendable log, and a
  failed append on a turn-back still said the decision stands; fixed in baf82737 (a `readLogTail` seam, tests that
  failed first). baf82737: Codex clean (0.97), the lenses 0 and 3 of 3 earlier findings fixed. The verifier's recheck
  on baf82737: PASS, 36 of 36, 18 probes; fail-closed none. Limits it states: a turn-back more than 1 MB back (about
  17 days at the log's rate) with no host flag lets one end be blocked twice, never more; the report can count a
  repeat twice when the turn-back record cannot be read at the repeat, or when only the host's flag let it through.
  S4's reach on the real record (`decisions.jsonl`, 379 sub-agent ends): 38 flagged, so turned back once under S4;
  69 covered; 229 unchecked and 43 with no transcript, which S4 lets through as before. Per-end cost on this session's
  two verifiers: 0, each of their 5 stops was covered. Not checked: the host's live behaviour after a turn-back; the
  proof after the land is the first `turnedBack` record followed by `covered` for the same agent.
- L22 (2026-11-18, JH 221, item `orders-t2` of the stretch opened 2026-11-18T17:03:58Z) S2's design restated whole,
  checked against main at b044dbf7. Where it differs from L13 it supersedes it; L13, L17 and L19 stay as the record of
  how it was reached. It departs from question 289's words ("mientras el último aviso de una sesión sea 'waiting'") by
  the lead's ruling in L7: a block survives the blocked session's later `note`, so the 13:08Z close is caught.
  - Who is blocked. A session known by its notices' `from.id`, not by title (the record holds two sessions titled
    `JH SR` and two with no title), whose title reads as a work session or the senior (`roleOfTitle`,
    bin/lib/sessions.mjs:1254-1261). Its block starts at its newest `waiting` addressed to the orchestrator
    (`to.role` is `orchestrator`). The lead's own notices and those of a session of no role (the Plan) are no block.
  - What clears it: that session's own later `ready`, `closed` or `relieved`; its `question`, which moves the block to
    the owner (proposed); or a commit of its worktree after the `waiting`, the worktree named by its newest notice
    that carries one (as `stalledSessions` reads it, bin/lib/stall.mjs:131), asked of `branchCommitAt` (:164). The
    senior works in the main checkout, so no commit clears its block. Nothing another sends clears it: not the lead's
    `note` or `answer`, not a `withdrawn`. A cleared block does not come back when the owner answers or withdraws that
    question: only a new `waiting` opens one. `opened` is the orchestrator's and clears nothing.
  - Live: a block counts while its session's newest own notice is younger than a bound, a constant (proposed 6 h,
    the lead's). L13's second rule, a job `removed` in `background/sessions.jsonl`, is dropped: that record's newest
    line is 2026-11-15T23:06:21Z, and the sessions started since through the app leave no job there, so it would never
    fire for them. Probe at about 2026-11-18T19:22Z over the whole channel (`jh221-blocked-now.mjs` in the stretch's shared
    notes folder, `side-session-notes/local_f536332a-81c1-489b-9669-68384563ffe9`; L13's and L17's scripts went with
    job b8e90a0a's folder): 16 blocks the clearing notices leave open, none of them within 6 h (the youngest, JH 213 at
    27.3 h and the Plan's design senior at 35.7 h); the commit rule was not applied in that probe.
  - Readers unchanged: `readStalled` keeps its contract and its `GIVEN_BACK`, which reads a `waiting` as work given
    back (bin/lib/stall.mjs:21); the block is a new pure function, `blockedSessions`, in `bin/lib/stop-consult.mjs`.
  - The idle close: a stop of the lead (its transcript's title reads `orchestrator`) whose reply closes in the
    `working` state (`closingState`, bin/lib/reply.mjs:149, in the project's labels: "Sigo solo"), with or without
    work in its background (13:08Z had a wait running). A close in `decision`, `question`, `cut` or `finished` passes.
  - Covered: the lead made an advisor call with a result after the block's newest own notice, so each later note of
    a blocked session asks a new consult, and no break of the lead's stretch lies between that call and the close
    (`breakOf`, bin/advisor-gate.mjs:116, by the lead's ruling in L7: a compaction or his message after the consult
    voids it). `readStretch` (:136) returns counts, not times (:195); the build adds the time of the stretch's newest
    answered call as a new field of its result, the existing fields unchanged. A consult older than the 4 MB tail it
    reads is not seen and reads as none: the close is turned back once, never more.
  - Once. The check runs only where the wake check runs, in the branch of bin/reply.mjs that a stop the host marks
    `stop_hook_active` does not take (:264, :290); and, since L15 found that flag not always seen, by its own record
    as the wake check keeps one (`transcriptMarks`, bin/lib/stop-wake.mjs:87): its refusal carries a marker of its
    own, and a turn-back already in the transcript after the block's newest notice lets the next close through.
  - Cost, cheapest first: the role from the transcript's title (a work session's stop reads nothing more), then the
    state, then the channel through the stop's shared parse (`io.readNotices`, bin/reply.mjs:107), then the bound, then
    git for each block still open (one `branchCommitAt`, bounded by its 10 s timeout, bin/lib/stall.mjs:159), and the
    transcript's tail last. Its time within the reply hook's budget is measured at the build with
    `scripts/reply-hook-time.mjs`; not measured here.
  - Fail open: a channel, a transcript or a git that cannot be read lets the close through, said on standard error, as
    `wakeOf` does (bin/reply.mjs:155).
  - The refusal names each blocked session, its newest notice's local time, and the next act: consult the advisor on
    that block, then answer the session or close again.
  - Tests first, at the build (`bin/lib/stop-consult.test.mjs`): `waiting`, its `note`, an idle close, turned back
    (the 13:08Z case); a consult after the newest note covers it and one before it does not; a compaction between the
    consult and the close voids it; `ready`, `closed`, `relieved` and `question` clear it, the lead's `note` and
    `answer` do not; a block past the bound is out; a commit after the `waiting` clears it; the close after a turn-back
    passes by the marker; a close in `decision` passes; a work session's close is not checked; an unreadable channel
    passes with its reason on standard error. Measured at the build: the replay of the lead's 70 idle closes of
    2026-11-15 written anew, 6 turned back expected with 13:08:52Z among them (L19).
  - Limits: it acts at a close, never while the lead sits idle; once a close; a blocked session that commits something
    unrelated clears its block; a session blocked longer than the bound is never counted, however live.
  - The lead decides: the bound (6 h proposed); whether a `question` clears the block; whether the senior's `waiting`
    counts as a block (proposed yes, since the lead's consult is the same act whoever waits).

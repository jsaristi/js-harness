# JH 176 · the heartbeat tells the lead when he has been away two hours with no stretch

Locator: `odd/tasks/departure-control.md` · Branch: `worktree-departure-control` · Delivery: one pull request to main ·
Test runner: `node --test`

## Goal
The lead's heartbeat (`js-harness loop heartbeat`) ends with one `AWAY:` line when the user's newest message to the lead
is older than the return check's absence (`ABSENCE_MS`) and no stretch covers the time since, once an absence, so the
lead is told at the start of the absence and not at the return.

## Why
`stretch-not-opened` is the failure seen most, and its control (JH 123, `returnStretchWarning`) acts at his return,
after the time away it is about: 16 of its 21 sightings came after that control (the Fable 5.2 audit's M9, the
triage's unit 12). He chose a control that acts when he leaves (question 5, option 1, spec 1). The process that is
alive while he is away, reads the lead's transcript each tick and wakes the lead by ending is the heartbeat.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/departure-control.md` exits 0
- `node --test bin/lib/return-report.test.mjs bin/lib/person-times.test.mjs bin/loop-bodies.test.mjs bin/loop.test.mjs` exits 0
- `node --test bin/reply.test.mjs bin/lib/manifest.test.mjs bin/rules-coverage.test.mjs` exits 0
- the new cases of `bin/lib/return-report.test.mjs` and `bin/loop-bodies.test.mjs` failed before the code existed and
  pass after it, both runs quoted in `## Log`
- `node bin/js-harness.mjs failures check` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- an independent verifier replayed the built code over the lead's real transcripts and its count is in `## Log`
- the pull request is opened, named in `## Log`, with Codex and the Claude lenses recorded over its code

## In scope / Out of scope
- In: `bin/lib/return-report.mjs` and its test (the absence in course and the one cover test, beside the return's);
  `bin/lib/person-times.mjs` and its test (the lines a tick keeps); `bin/loop.mjs` and `bin/loop-bodies.test.mjs` (the
  `AWAY:` line, its mark, the usage); `bin/lib/manifest.mjs` (the lead's sentence on the heartbeat's lines) with
  `bin/lib/rules-coverage-data.mjs` if its refresh asks; `docs/SPEC.md` if `spec` asks; `docs/FAILURES.md` (the
  sighting of 2026-11-10 and the control); this document; `docs/sessions/`.
- Out, each with its reason:
  - what counts as an absence (`ABSENCE_MS`, whose words count, `lastReturn`): his answer does not cover it (spec 1).
  - the reply hook's return checks (`returnReportWarning`, `returnStretchWarning`, `bin/reply.mjs`): they stay the
    backstop as they are; JH 165 holds `bin/reply.mjs`.
  - a declared suspension that would satisfy the check (the sighting of 2026-11-07): it changes what counts.
  - an absence the question tool holds the lead through (9 of 23, L3): no process can tell a held session; it goes to
    the lead as a notice, his call.
  - `stretch open --draft` (JH 123's next task, `odd/tasks/departure-stretch.md` L18): a feature of its own.

## Constraints
- The absence is read with the return check's own measure and readers (`ABSENCE_MS`, `personTimesOf`, the stretch
  record's `eventsOf`) — because two definitions would let the tick call covered what the return calls a miss.
- His words are never read, only their times — because a detector fitted to his messages has no known error rate
  (`odd/tasks/departure-stretch.md`, L11).
- The line is told once an absence, across relaunches of the loop — because the lead relaunches the heartbeat each
  time it ends, and a line told again each time would be skipped as noise (the cut's mark, F8 S7, is the model).
- The heartbeat writes one mark file under its loop records and nothing else — because what the harness writes
  outside the repository must be undone by deleting one folder (`AGENTS.md`).
- High risk, item 6 in part (the triage): no test shows the host waking the lead when the loop ends, nor the lead
  opening the stretch — so an independent verifier replays the built code over the real records.

## Ask me before
Nothing here is his beyond question 5, which his words of 2026-11-11 answer (spec 2). A decision that is his goes to
the lead with `js-harness notify --to orchestrator`.

## Depth pass
- 1. Method: operations watchdogs. An absence is watched by the age of the last sign of life, by a process that runs
  out of band from the party that is absent or busy; the alert uses the same definition as the after-the-fact check,
  fires once an incident (its key is the incident's start), names the fix, and says what it could not reach. The
  smallest change that meets it: the lead's heartbeat already runs out of band, already reads the lead's transcript
  from where it last read each tick (the cut, `bin/loop.mjs:536-550`), and its end already wakes the lead; the
  absence's measure and the cover test already exist (`bin/lib/return-report.mjs:34`, `:55`, `:219`). So one more line
  that ends the heartbeat, read with the return check's functions; no new command, option, module or rule. Searched
  first: codegraph (`heartbeat tick`, `quiet --wait`, `notify`); `grep -rn stretch-not-opened bin docs odd`;
  `js-harness rules away-autonomy`; the help of `stretch`, `loop`, `quiet`, `wait` and `notify`. The carriers found:
  `quiet --wait` (the lead starts it only for a machine going quiet, and it already refuses with no stretch);
  `wait --notice-to orchestrator` (one condition, a notice); the reply hook (acts only at a stop of the lead: 5 of the
  23 absences below had one); the heartbeat (the lead's duty loop: `STALL`, `STALLED`, `CUT`, `DUE` already end it).
- 2. Raw material:
  - `docs/FAILURES.md:1812-1902`: the entry, its 21 `Seen:` lines and its control of 2026-10-31.
  - `bin/lib/return-report.mjs:199-224`: the control, which reads the records at a stop after his return.
  - The lead's transcripts `0f71b2c6-cbce-43ca-a031-276a4b2c381f` and `ea85ec35-82e1-4aa9-abe3-98bd153a50b0`, and
    `~/.js-harness/throughput/D--js-harness/stretches.jsonl` (62 events), replayed read-only (item 4).
  - `ea85ec35`, lines 4515 to 4518: question 255 asked at 2026-11-10T23:08:41Z, answered at 2026-11-11T02:17:03Z, and
    no entry of the lead between them; line 4458: a task's end queued while question 253 was on screen and delivered
    one second after its answer. The question tool holds the session, and the host queues a wake until it returns.
  - `bin/lib/sessions.mjs:2860-2874` (`askingRule`): the harness already says the question tool holds the session.
  - `odd/tasks/departure-stretch.md`, L10 and L11: why the first control reads no words and acts at the return.
- 3. The bar:
  spec 1: `node --test bin/loop-bodies.test.mjs`: none, new behaviour (the heartbeat ends with `AWAY:` when his last
  message is older than `ABSENCE_MS` and no stretch covers the time since; once an absence, a relaunch names it and
  goes on; with a stretch open, or his message recent, nothing)
  spec 2: left out because it is the source of spec 1's answer, not a behaviour
  spec 3: `node --test bin/lib/return-report.test.mjs`: 23 pass today, none of them at the start of an absence; the
  new cases show the lead told at the start of an absence, by the same cover test the return uses
  spec 4: `node bin/js-harness.mjs failures check`: PASS today with the control of 2026-10-31; the control names the
  new test too
  spec 5: left out because the search is item 1's and the verifier's count goes to the Log
- 4. Refutation: if no control could reach the lead when an absence starts, the request would not hold. Replayed now,
  read-only, with this branch's `personTimesIn`, `ABSENCE_MS` and `eventsOf` over the two transcripts since
  2026-10-31T12:00Z (`node replay.mjs`, the job's scratch; its table is L3): 31 absences, 8 a stretch covered, 23 not.
  Of the 23, when the gap crossed two hours the lead was awake in 9 (entries of its own before his return, a stop in
  5 of them), idle in 5 (its turn ended, no entry until his return) and held by the question tool until his return
  in 9. So a line that wakes the lead reaches 9 for certain and up to 14 of 23 (61%) where a heartbeat is alive and
  the machine on; 9 of 23 (39%), and 4 of the last 5, no control can reach while a question holds the lead.
  Verdict: supports
- 5. Request: build the control he chose in question 5 where it can act: each tick of the lead's heartbeat reads when
  he last wrote to the lead, by the return check's rule, and when that is longer ago than `ABSENCE_MS` and no stretch
  covers the time since, by the return check's cover test, it ends with one `AWAY:` line that gives the hour he last
  wrote, names `js-harness stretch open --plan <file> --html <file>` and says since when the question tool has held
  the session when it has; told once an absence, kept in a mark beside the cut's, so a relaunch names it and goes on.
  The reply hook's return check stays as the backstop, unchanged. What counts as an absence does not change. The 9
  absences a question held are named to the lead as a finding with a recommended option; nothing is built for them.
  Adds: none

## Specs
1. Question 5 of the triage (`docs/proposals/2026-11-10-audit-triage.md`, "Questions for him"), as written:
   "**Pregunta 5 (unidad 12: la falla que más se repite).** La falla más vista, no abrir un tramo cuando te vas, tiene
   un control que solo actúa cuando vuelves: se vio 16 veces después de que se puso. ¿Qué hacemos?" Its option 1, the
   one taken: "**Un control que actúe al irte (Recomendada).** Cuando la sesión sabe que te fuiste y no hay tramo
   abierto, lo dice en ese momento a la sesión líder, en vez de esperar tu regreso. Un sí cubre diseñarlo y
   construirlo con su prueba. No cubre cambiar qué cuenta como ausencia."
2. His words that answer it, typed in the lead's chat (transcript `ea85ec35-82e1-4aa9-abe3-98bd153a50b0`, read with
   `js-harness sessions --quote`): line 6905, 2026-11-11T05:30:20Z (00:30 local, UTC-05:00): "contesta TODAS las
   preguntas con recomendado TODAS y avanza los mas posible eres completamente autonomo"; line 6716,
   2026-11-11T05:26:36Z: "une lo que quede listo y tienes autorizacion para poder avanzar en todo y escoger siempre la
   opcion recomendada, no preguntes, avanza y se completamente autonomo."
3. The triage's unit 12: "**What:** `stretch-not-opened` is turned back at his return, after the time away it is
   about; 16 of its 21 sightings came after its control. A control that acts when he leaves, not when he returns."
   "**Done when:** a test in `bin/lib/return-report.test.mjs` or its successor shows the stretch opened, or the lead
   told, at the start of an absence; the entry's next sighting window passes without a new `Seen:` line."
4. The triage's unit 12: "**Closes:** M9, and what remains of M5 as it bears on the registers." The control's line in
   `docs/FAILURES.md` names a test that exists under the title it quotes.
5. The lead's brief: "Amend what exists before adding." "an independent verifier on the high-risk part". "Search
   before you add (codegraph, `js-harness rules`, the skills) and say in the commit what you searched. Tests first."

## Tasks
- [x] T1 (kind: design) spec 1, 2, 3: this document, its depth pass and the replay. Route: inline. Commit: `docs(tasks): departure-control, the depth pass`
- [x] T2 (kind: build) spec 1, 3: the absence in course and the one cover test in `bin/lib/return-report.mjs`, the lines a tick keeps in `bin/lib/person-times.mjs`, tests first. Route: inline. Commit: with T3
- [x] T3 (kind: build) spec 1, 3: the heartbeat's `AWAY:` line and its mark, tests first; usage, the lead's sentence, SPEC. Route: inline. Commit: `feat(loop): the heartbeat tells the lead when he has been away two hours with no stretch`
- [x] T4 (kind: docs) spec 4: the sighting of 2026-11-10 and the control in `docs/FAILURES.md`. Route: inline. Commit: with T3
- [x] T7 (kind: build) spec 4, L10: a held absence is recorded apart, under the existing entry `question-tool-holds-asker`, and the two texts that ask for the sighting name it, tests first. Route: inline. Commit: with T3
- [ ] T5 (kind: verify) spec 5: Codex and the lenses on the slice, the independent verifier's replay, the pull request, the ready notice. Route: inline, one verifier sub-agent
- [ ] T6 (kind: docs) the summary under `docs/sessions/` and the closed notice. Route: inline

## Log
- L1 (2026-11-11, the lead's brief `C:\Users\Oficina\.js-harness\background\briefs\2026-11-11T05-33-39-385Z-b14f7618.md`):
  "You own one feature: the most repeated failure gets a control that acts when he leaves (the triage's work unit
  12)." "The decision: Question 5 of the triage, recommended option 1". "It happened again on 2026-11-10: he was away
  18:08 to 21:17 local with question 255 on his screen and no stretch was opened (the Stop hook said so only at his
  return)." "Amend what exists before adding."
- L2 (2026-11-11, his words checked): both lines of spec 2 read with `js-harness sessions --quote ea85ec35-... 6905`
  and `... 6716`; each is "sent by the user". The triage was read from `origin/docs/audit-triage` and the audit from
  `origin/claude/fable-5-2-audit-531f8e` (neither is on main yet).
- L3 (2026-11-11, the replay, item 4; local time, UTC-05:00; "+2h" is his last message plus `ABSENCE_MS`). The 23
  absences no stretch covered, by what the lead's transcript holds between +2h and his return:
  - held by the question tool until his return, 9: 11-01 21:35 to 11-02 04:01; 11-02 12:59 to 15:01; 11-04 09:01 to
    11:43; 11-05 13:25 to 18:12; 11-05 19:35 to 11-06 00:36; 11-08 18:20 to 20:54; 11-09 07:59 to 19:58; 11-09 20:00
    to 22:31; 11-10 18:08 to 21:17.
  - idle, no entry of the lead until his return, 5: 11-03 06:17 to 09:59; 11-04 16:31 to 19:58; 11-05 11:05 to 13:25;
    11-06 14:14 to 16:49; 11-10 11:36 to 17:03.
  - awake, 9, with the lead's first entry after +2h: 10-31 15:04 to 11-01 00:44 (first entry 00:36, 7.5 h after +2h);
    11-01 00:56 to 13:03 (03:19); 11-03 10:43 to 15:24 (14:58); 11-03 16:55 to 20:25 (19:05); 11-04 20:05 to 11-05
    06:38 (22:21); 11-05 07:38 to 10:46 (10:27); 11-06 00:36 to 08:41 (08:01); 11-06 21:49 to 11-07 07:25 (01:33);
    11-07 11:25 to 11-08 17:16 (11-08 16:13, the PC suspended). A stop of the lead in 5 of the 9.
  - a stretch covered 8 more. The absence of 11-09 07:59 is in both transcripts and counted once.
  Not known: whether a heartbeat was alive in the 5 idle ones, and whether the machine was on (the sightings say it
  slept or was off in at least 11-03 06:17 and 11-06 14:14). "Held" is read from the transcript alone: a question
  call with no result before +2h whose answer is his return.
- L4 (2026-11-11, design). The heartbeat, not the reply hook, carries the control: the hook acts only at a stop of the
  lead, and only 5 of the 23 absences had one after +2h, hours late in 3 of them; the heartbeat's end is itself the
  wake. The line is told at the first tick that sees the gap past `ABSENCE_MS`, and at the start of a relaunch, as the
  cut is. The cover test is the return's, moved to one function both use: a stretch open at any time since his last
  message covers, so the tick predicts what the return check will ask. Held is said in the line, not acted on: the
  host delivers the loop's end when the question returns, and the lead then writes the sighting with it.

- L5 (2026-11-11, T1): committed as `8ff0b26a` (gate PASS, 20 rows). The lead was sent the held finding as a note
  at 00:53 local, with the recommended option (record a held absence apart, as its own failure with its own unit).
  This session is JH 176; `js-harness wait --notice-to 176` runs in its background (task `baj8tokm3`, ends on a notice
  to 176 or after 8 hours; this session stops it at its close).
- L6 (2026-11-11, T2): red first, `node --test bin/lib/return-report.test.mjs`: "SyntaxError: The requested module
  './return-report.mjs' does not provide an export named 'AWAY_MARKER'". Built in `bin/lib/return-report.mjs`:
  `stretchRecordsIn` and `stretchesOf` exported, `covers` (the one cover test, which `returnStretchWarning` now
  calls), `departureWatch()` (`add(text)` a piece of the transcript, `read(stretches, now)` the absence in course as
  `{ before, away, heldSince }`), `departureLine(found)` and `AWAY_MARKER`; `personLinesIn` in
  `bin/lib/person-times.mjs`. Green: `node --test bin/lib/return-report.test.mjs bin/lib/person-times.test.mjs`, 33
  of 33 (7 new).
- L7 (2026-11-11, T3): red first, `node --test bin/loop-bodies.test.mjs`: 5 of 30 fail, the five new heartbeat cases
  (the AWAY line at the first tick past two hours; told at once at a start and named by a relaunch; nothing while a
  stretch covers, an unreadable record said once; the held line; told with a STALL of the same tick), 25 pass.

- L8 (2026-11-11, T3, uncommitted): the heartbeat built in `bin/loop.mjs` (the watch fed by the tail the cut reads,
  `awayAt`, `tellAway`, the mark `loops/<project>/away/<session>.json` holding `{ told, at, heldSince }`, the AWAY
  line put before whatever ends the same tick, the first line and the usage); green, `node --test
  bin/loop-bodies.test.mjs bin/loop.test.mjs bin/lib/return-report.test.mjs bin/lib/person-times.test.mjs
  bin/reply.test.mjs` 116 of 116. The new messages name "the user", as shipped text does. Texts: the lead's sentence
  in `bin/lib/manifest.mjs` (line 147), the dispatcher's summary in `bin/js-harness.mjs`, a paragraph in `README.md`;
  `rules coverage` PASS with no refresh, `rules check` PASS (78 rules). T4: the sighting of 2026-11-10 and the control
  in `docs/FAILURES.md` (the old control moved to a `- Was:` line); `failures check` exits 0, the entry reads
  "controlled (22 sightings)".
- L9 (2026-11-11, design, the lead's rule): only the lead is told. A work session that ran a heartbeat would be told of
  an absence that is not its to plan, so the line is given only where `isLeadSession` says the session is the lead,
  the return check's rule, read from the notices once an absence. Its tests are written (the five AWAY cases carry a
  lead's notice; a sixth shows a work session and a session with no notice told nothing).
- L10 (2026-11-11 01:13 local, the lead's note to 176, read from the wait's output): "your recommended option is
  taken, by his words of 00:30 (transcript ea85ec35, line 6905: every question with the recommended option). Record a
  held absence as its own failure, apart from stretch-not-opened, in docs/FAILURES.md in your pull request, with the 9
  of 23 and where the replay is. Its own unit (how a question stops holding the lead) is NOT yours: write its brief to
  a file outside the repo and send me the path in one notice; I start it. Go on with the AWAY line." The reading that
  line 6905 covers a question the triage did not put to him is the lead's, and his to correct when he reads the pull
  request; the brief had said such a decision is not covered. Taken as the lead's instruction: a held absence is recorded apart,
  its control owed to its own unit: how a question stops holding the lead.
  So that the two entries stay apart after this pull request, the two texts that ask for the sighting name the right
  entry: the AWAY line's held form, and the return's stretch warning, which names the held entry when his return
  is the answer to a question asked before the absence started (a new T7, the reply hook's text path: high risk,
  the verifier reads it).
- L11 (2026-11-11, the lead gate, Next step (a)): built in `bin/loop.mjs` (`isLead(before)` over `readNotices`, cached
  by the absence's start; notices that cannot be read are said once, as an unreadable stretch record is); green,
  `node --test bin/loop-bodies.test.mjs`, the six AWAY cases pass.
- L12 (2026-11-11, T7): red first, `node --test bin/lib/return-report.test.mjs`: 2 of 31 fail (the held line names
  its own entry; a return that answers a question asked before the absence started names it too). Built:
  `HELD_FAILURE`, `heldThrough(text, before, back)` (his entry at `back` is an answer, by `quoteEntry`, to a question
  asked at or before `before + ABSENCE_MS`), the held form of `returnStretchWarning` and of `departureLine`. Green:
  `node --test bin/lib/return-report.test.mjs bin/reply.test.mjs bin/loop-bodies.test.mjs`, 94 of 94.
- L13 (2026-11-11, the search of `rule:reuse-first` on the register, late): `docs/FAILURES.md` already held
  `question-tool-holds-asker` (one sighting, 2026-10-13: a question asked while he was away held the lead seven hours;
  control: the protocol's sentence that the tool is called at once only when he wrote a short while ago, since
  2026-10-14). It is the same failure, so no second entry: `HELD_FAILURE` names it, its text gained the case of a
  question left on his screen when he leaves, and the 9 held absences of L3 are its `- Seen:` lines. Its state is now
  "seen again", which is true: 9 sightings after its control. What settles it is the question unit's, not this
  document's. `node bin/js-harness.mjs failures check` exits 0 (141 failures, 9 not settled, one more than before);
  `node --test bin/lib/return-report.test.mjs`, 31 of 31 after the rename.
- L14 (2026-11-11, a red run that was the machine): `bin/loop.test.mjs` "a real loop: run in the background, status
  sees it alive, stop leaves no process of it" failed once after 101 s ("the record appears: false") while another
  session's gate held the cores (`node bin/js-harness.mjs loop status` took 4.4 s, the board over 120 s). It passed in
  the 116-test run of L8, before the lead gate; not run again here, the gate runs it on GitHub's machines. From
  01:27 local the guard refuses `node --test` of two files while a gate holds the machine's lock, so each file is run
  alone.
- L15 (2026-11-11, a limit of the control, checked): nothing obliges the lead to keep a heartbeat alive. `js-harness
  loop status` read "no loop is recorded for this project" during this work, so the AWAY line reaches a lead only
  while its heartbeat runs, or at the heartbeat's next start. Not known: whether one was alive in the 5 idle absences
  of L3. Told to the lead with the ready notice; a heartbeat kept by the host is not this unit's.
- L16 (2026-11-11 01:29 local): the host compacted this session by itself; the resume was read from this document.

## Next step
Done: the lead gate, T7, the 9 sightings under `question-tool-holds-asker` (L11 to L13). In order: (d) the brief of
the question unit to a file outside the repository and its path to the lead in one notice; (e) commit T2, T3, T4 and
T7 (the gate), Codex, the lenses, the verifier's replay with the built code, push, the pull request, the ready
notice, the summary, the closed notice. The wait for notices runs as task `bpelqu9mm` (`js-harness wait --notice-to
176`, ends on a notice to 176 or after 8 hours; this session stops it at its close).

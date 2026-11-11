# JH 183 · a question stops holding the lead while he is away: the design

Locator: `odd/tasks/question-holds-lead.md` · Branch: `worktree-question-holds-lead` · Delivery: one documents-only
pull request to main · Test runner: none, design only

## Goal
One proposal, double-reviewed, that says how a question put to him stops holding the lead while he is away, what a
yes covers and what it changes in `rule:questions-one-place`.

## Why
`question-tool-holds-asker` has 9 sightings and a control that is a sentence. The replay shows the sentence kept in
94 of 108 questions and the lead still held 45.2 hours in eleven days, so the fix is a design decision of his, not a
tighter sentence.

## Done when
- `js-harness contract check odd/tasks/question-holds-lead.md` exits 0
- `test -f docs/proposals/2026-11-11-question-stops-holding-lead.md` exits 0
- the proposal's double review is recorded and every finding answered (`js-harness double-review take`)
- the pull request is open, documents only, and the lead has one ready notice that names the recommended decision

## In scope / Out of scope
- In: this document, `docs/proposals/2026-11-11-question-stops-holding-lead.md`, its scripts as text in
  `docs/proposals/2026-11-11-question-stops-holding-lead-replay.md`, `docs/sessions/`.
- Out: any source write and any rule change (the lead's addition to the brief: design only); recording a question
  for him (he is away, and the lead puts it to him); the build, which is a unit of its own after his answer.

## Constraints
- `rule:questions-one-place` is his — because a rule of the owner's changes only with the owner's words, the proposal
  quotes his words and changes nothing by itself.
- One heavy command at a time, one sub-agent at a time, and a command the host stops is not retried alone — because
  the host stopped sessions and this session's wait for low memory on 2026-11-11.
- Every figure comes from a command named beside it, run over the records — because JH 176's first count came from a
  scratch script nobody checked by hand (`odd/tasks/departure-control.md`, L20).

## Ask me before
Nothing is asked by this session: the one decision goes to the lead in the ready notice, and the lead puts it to him.

## Depth pass
- 1. Method: the design of a dispatcher that needs a person's decision, as incident response and message queues do
  it. The request for a decision is a durable item in a queue; telling the person is a separate act that does not
  block; the dispatcher never waits inside a call whose length a person sets. Where a blocking call is the only way
  to show the request, the standard remedies are three: a bound on the call, a worker that holds it in the
  dispatcher's place, or showing it only when the person says they are ready. The smallest change that meets it here:
  the record of questions, the board's `to ask:` list, `template ask <n>` and the question gate already exist
  (`bin/lib/template-gate.mjs`, the orchestrator skill, "Questions to the user"), so the design moves one thing, the
  moment the tool is called. Searched first: codegraph (`askingRule PERSON_PRESENT_MS template-gate AskUserQuestion`,
  `heldIn heldAtStart departureWatch`); `js-harness rules questions-one-place`, `person-present`, `double-review`;
  the skills `js-harness-orchestrator` and `js-harness-protocols`; `docs/proposals/claude-app-native-sessions.md`
  (rows 5 and 6, the next-step box); `grep -rn "AskUserQuestion\|askUserQuestionTimeout" docs`.
- 2. Raw material:
  - `docs/FAILURES.md:1359-1391`: the entry, its 9 sightings and its control, a protocol sentence.
  - The lead's transcripts `0f71b2c6-cbce-43ca-a031-276a4b2c381f` and `ea85ec35-82e1-4aa9-abe3-98bd153a50b0`, the
    stretch record `~/.js-harness/throughput/D--js-harness/stretches.jsonl` and the channel record
    `~/.js-harness/channel/D--js-harness.jsonl`, replayed read-only (L2).
  - `bin/lib/sessions.mjs:775` (`PERSON_PRESENT_MS`) and `:2866` (`askingRule`): the rule is advice a command prints.
  - `bin/lib/template-gate.mjs`: the PreToolUse gate on the question tool checks the card, not whether he is there.
  - The host's documentation, code.claude.com/docs/en: `tools-reference.md` ("Question auto-continue timeout"),
    `settings-reference.md` (`askUserQuestionTimeout`), `hooks.md`, `sub-agents.md`, `agent-view.md`,
    `remote-control.md` (L3).
  - His words: transcript `65318fd5-80e7-4bb8-92b5-06737140185b`, lines 8439, 8528, 12735 and 13110;
    `0f71b2c6`, lines 21816, 51586 and 56095; `ea85ec35`, line 3779 (L4).
- 3. The bar:
  spec 1: `js-harness failures question-tool-holds-asker`: "seen again", 9 sightings, its control a sentence; the
  proposal names the check and the two tests the build writes
  spec 2: `test -f docs/proposals/2026-11-11-question-stops-holding-lead.md`: none, new
  spec 3: `node C:/Users/Oficina/.claude/jobs/2afa9b7b/tmp/replay.mjs <worktree>`: 25 questions were asked under two
  minutes after an answer of his to another, 4 of them waited over 15 minutes and 2 over two hours; the design shows
  none of them without a new message of his
- 4. Refutation: the request would not hold if a question rarely held the lead, or if the rule that exists, well
  kept, already stopped it. Run now: `node C:/Users/Oficina/.claude/jobs/2afa9b7b/tmp/replay.mjs <worktree>` gives
  108 questions shown, 27 that waited over 15 minutes and held the lead 40.2 of 45.2 hours, and the rule kept in 21
  of those 27. A second test, for the design itself: `node C:/Users/Oficina/.claude/jobs/2afa9b7b/tmp/last-word.mjs
  <worktree>` finds that none of the 8 holds over two hours followed a message of his asking for a question, and that
  the 2 questions that did follow one, by the whole-message pattern, waited 19 minutes and 1. Both scripts are kept
  as text in `docs/proposals/2026-11-11-question-stops-holding-lead-replay.md`.
  Verdict: supports
- 5. Request: write the proposal for how a question stops holding the lead, from what the records and the host's
  documentation show: the question tool is called only in the reply to a message of his that asks for a question,
  one question a request, held by a check in the question gate; until then the question waits in the record, on the
  board and in one line of each reply, and the lead goes on. Say what a yes covers, what it does not, what it changes
  in `rule:questions-one-place` and in `rule:person-present`, the other options and why they are not recommended,
  and what stays unguaranteed. Pass it through the double review, open one documents-only pull request and send the
  lead one ready notice with the recommended decision. Build nothing and change no rule.
  Adds: none

## Specs
1. The brief, "Done when": "the entry `question-tool-holds-asker` has a control that is a check, named by a test
   that exists; a test shows the lead taking a turn while a question of its own waits for him; the entry's next
   sighting window passes with no new `- Seen:` line."
2. The lead's addition to the brief: "This unit is DESIGN ONLY: no source write, no rule change. It ends in one
   documents-only pull request with the proposal (docs/proposals/), double-reviewed (`rule:double-review`), that says
   in plain words what a yes covers and what it changes in `rule:questions-one-place`, which is his rule and moves
   only with his own sentence."
3. The brief: "The second question of a row is the case to design for, not the first."

## Tasks
- [x] T1 (kind: design) spec 1, 2, 3: this document with its depth pass and the replay. Route: inline. Commit: with T2
- [x] T2 (kind: design) spec 1, 2, 3: the proposal, `docs/proposals/2026-11-11-question-stops-holding-lead.md`. Route: inline. Commit: `docs(proposals): how a question stops holding the lead`
- [x] T3 (kind: verify) spec 2: the double review (a Claude reader and a Codex reader, blind), every finding answered. Route: `js-harness double-review read`. Three reads ran; the third still found real failures, so the design is not settled (L14)
- [x] T4 (kind: docs) spec 2: the pull request, the ready notice, the summary under `docs/sessions/`, the closed notice. Route: inline. Commit: `docs(proposals): how a question stops holding the lead, not settled by three reads`; pull request 829

## Log
- L1 (2026-11-11 06:45 local, the lead's brief
  `C:\Users\Oficina\.js-harness\background\briefs\2026-11-11T11-45-06-808Z-8dd7fe78.md`): "You own one feature: a
  question put to him stops holding the lead while he is away." Its last paragraph, the lead's: design only, one
  documents-only pull request, no question recorded for him, one ready notice.
- L2 (the replay, run by this session; `node replay.mjs <worktree> --json` and the three scripts beside it, kept as
  text in `docs/proposals/2026-11-11-question-stops-holding-lead-replay.md`; read-only, with this branch's `quoteEntry`, `questionCallsOf`, `ABSENCE_MS`, `stretchRecordsIn`;
  the lead's transcripts 0f71b2c6 and ea85ec35 and the real stretch record; local 2026-10-31 07:00 to 2026-11-11
  00:00, UTC-05:00). It gives JH 176's figures again: 31 absences over two hours, 8 a stretch covered, 23 not, 8 of
  the 23 held by a question, 4 of the last 5. Seconds from his last word to the question that held: 49, 42, 704,
  2236, 138, 411, 1812, 30. New, over every question call of the lead's own thread:
  - 114 calls; the question gate refused 6 before they were shown; 108 shown; 106 answered, 1 ended after 10
    minutes by a message he typed while the card was open, 1 ended after 466 minutes by the
    session's shutdown (2026-11-09 08:06 to 15:51, while he was away; `0f71b2c6`, line 76939, found by the Claude
    reader and read again here).
  - Waited at most 1 minute 32, 2 minutes 44, 5 minutes 60, 10 minutes 72, 15 minutes 81, 30 minutes 92, 60 minutes
    98, 120 minutes 100, of 108.
  - The tool held the lead 45.2 hours in all: 40.2 of them in the 27 calls that waited over 15 minutes, 29.1 in the
    8 that waited over two hours.
  - `rule:person-present` was kept in 94 of 108 (his last word under 15 minutes before). Of those 94, 21 waited over
    15 minutes, 7 over an hour, 6 over two hours. Of the 14 asked past the rule, 6 waited over 15 minutes.
  - The same rule as a gate, at other values (`replay.mjs`, its last lines): at 1 minute it
    refuses 76 of 108 and still lets through 8 waits over 15 minutes, 3 of them over two hours; at 2 minutes 55 and
    10 (3); at 5 minutes 35 and 15 (4); at 15 minutes 14 and 21 (6). Asked under one minute after his word, 8 of 32
    waited over 15 minutes, the rate of all 108 (27).
  - 25 were asked under two minutes after an answer of his to another question (the second of a row): 4 waited over
    15 minutes, 2 over two hours. 28 were asked under two minutes after a typed message: 6 waited over 15 minutes.
  - A bound on the wait: at 5 minutes 48 of 108 would have returned unanswered (46 he answered later) and the hold
    would be 5.5 hours; at 10 minutes 36 (35) and 9.0 hours; at 15 minutes 27 (26) and 11.8 hours.
  - Options: 90 calls with two, 22 with three, 2 with four; one call asked more than one question. Of the 27 long
    waits, 25 had two options.
  - Notices to the orchestrator recorded in the channel while one of the 27 long waits lasted: 33 (17 note, 9 ready,
    2 question, 2 waiting, 2 closed, 1 opened), in 12 of the 27 (`words.mjs`); the 9 ready notices name 8 pull
    requests. Queued by the host while one of the 27 stayed open: 12 ends of tasks and 1 message of a session, none
    of which ended it; the one call a queued entry ended was ended by a message he typed (`queued.mjs`).
  - His last entry before each of the 8 holds over two hours (`last-word.mjs`): an answer to another question in 6,
    a typed message about something else in 2; none asked for a question. Two questions followed a message of
    his that is a request and nothing else ("listo hazme las preguntas", "Listo dame las preguntas como siempre"):
    they waited 19 minutes and 1. A third message opens with a request and goes on ("hazme las preguntas en serio
    ...", its question waited 8 minutes); the whole-message pattern leaves it out (L10).
  Checked by hand in one case: the hold of 2026-11-10 18:08 is the brief's (30 seconds after his answer, answered at
  21:17), and `docs/FAILURES.md:1382` says the same.
- L3 (the host's documentation, read by one claude-code-guide sub-agent in two turns; its quotes come through
  WebFetch's summary, so each exact string is read on the live page before anything is built on it):
  - `askUserQuestionTimeout`, a user setting, default `"never"`, values `"60s"`, `"5m"`, `"10m"`: the dialog closes
    on its own and "tells Claude you may be away from your keyboard".
  - "The timer never starts for a question Claude asks in a background session, in screen reader mode, or while the
    session is connected to Remote Control. Those questions wait until you answer them." The lead runs with Remote
    Control on, since he answers from the phone.
  - A PreToolUse hook can answer a question with `permissionDecision: "allow"` and `updatedInput.answers`, framed
    for `-p` runs; a hook's own timeout does not end the call.
  - Nothing documented closes or answers an open question from outside the session, except a person in the
    terminal's agent view. A message from another session "can't approve anything".
  - A sub-agent cannot ask: the sub-agents page removes `AskUserQuestion` from a sub-agent's tools "even when
    listed", foreground or background.
  - Not found in any page: `wrap_up` or any next-step box with buttons; a notification for a waiting question; what
    is delivered to a session while a question waits.
- L4 (his earlier words on the subject, searched in the lead's transcripts 65318fd5, 0f71b2c6 and ea85ec35 with
  `node C:/Users/Oficina/.claude/jobs/2afa9b7b/tmp/words.mjs <worktree>`, his typed entries that hold "pregunt" and
  one of a list of words on how and where, and `last-word.mjs`; each read with `js-harness sessions --quote`, all
  "sent by the user"; UTC as the command prints it):
  - 65318fd5:8439, 2026-10-13T00:56:32Z: "Siempre hazme las preguntas asi por favor osea asi siempre debe ser el
    protocolo sobre todo para que no se me pase ninguna, por favor metela al harnes"
  - 65318fd5:8528, 2026-10-13T00:58:49Z: "Otra es que siempre necesito que las preguntas en las haga el orquestador,
    no la sesion para poder centralizar todo en una sola parte."
  - 0f71b2c6:21816, 2026-10-29T13:57:26Z: "siempre colocame las preguntas aca y cuando hayan preguntas viejas que no
    he respondido, colocamelas en el tablero como todo o tareas para yo podertelas pedir por que me queda muy dificil
    adivinar o estar pendiente de todas las sesiones"
  - 0f71b2c6:51586, 2026-11-02T10:08:46Z: "hazme las preguntas en serio por que es que me las haces cuando estoy
    ausente y es imposible para mi responderte"
  - 0f71b2c6:56095, 2026-11-02T22:15:52Z: "siempre hazme todas las preguntas de boton"
  - ea85ec35:3779, 2026-11-10T16:33:18Z: "Listo dame las preguntas como siempre"
  The search reads typed entries only, in the three lead transcripts; a word of his in a work session, or one that
  holds neither "pregunt" nor a word of the list, is not found by it.
- L5 (2026-11-11, a stop and a resume): the host stopped this session's `js-harness wait --notice-to 183` for low
  memory; as the brief says, the lead got one waiting notice (11:13 local) and this session stopped, its state
  written here uncommitted. The new lead (session f0959bbd) sent the resume by message: bring main in (fast-forward
  to `51932dba`), start the wait again, go on. Sub-agents from here run at medium, his decision of today as the lead
  gave it (question 260).
- L6 (2026-11-11, the design decision, this session's): the recommended option is that the question waits and is
  shown when he asks for it. Why, in one line each: a presence rule at any value does not tell a short wait from a
  long one (L2); the host's bound does not run under Remote Control and a sub-agent cannot ask (L3); a session other
  than the lead holding the tool is against his lines 8528 and 21816; a card with no buttons is against line 56095;
  his line 51586 names the failure himself, and line 21816 already asks for old questions on the board "para yo
  podertelas pedir". The proposal holds the whole of it.

- L7 (2026-11-11, the double review, read `33e22402-7e4b-4acb-8cfb-5656f00c0528`; one run of
  `js-harness double-review read` over the proposal and this document, both readers started at once by the command):
  the Claude reader 12 findings (1,279,532 tokens), the Codex reader 6 (429,839 tokens). All 18 taken; Claude's 2 and
  8 are Codex's 1 and 4. What they changed is the proposal's last section. The ones that moved the design:
  - A message he types ends an open card (`0f71b2c6`, lines 49241 and 49250), which the first text denied. Measured
    after it (`queued.mjs`): a session's message did not, in one case, nor 12 ends of tasks; so "a message from
    outside ends the card" is option I, rejected on what is known.
  - The check had no end: it now ends with the reply and at five minutes, takes one question a call bound to the
    request, is used up on admission and fails closed; the replay tests the request's form and age only (`last-word.mjs`).
  - The recommendation is a seven-day trial behind a project switch, with three measures and the switch as the way
    back, and it says that it changes his "siempre hazme las preguntas".
  - A fork is not an ordinary sub-agent and may keep the question tool (Codex, from `sub-agents.md`; not read on the
    live page here): option F, tried with him before any code, with the next-step box.
  - The figures could not be run from the repository: the four scripts are now a document beside the proposal.
  - Option J (a merge keeper while the lead is held) was missing; it is the lead's to run and needs no decision.
- L8 (2026-11-11, the depth pass against the review): item 5's request stands, with the trial and the two probes
  inside the proposal it asks for. The scratch paths named in items 3 and 4 are the same scripts the replay document
  holds.

- L9 (2026-11-11, the confirming read, `1d820f3b-930d-4d94-bbe4-65d655182d35`; its output is task
  `br790axqm`'s file): the Claude reader 14 findings, the Codex reader 7. Not yet recorded with `double-review take`.
  The plan for each, to be applied to the proposal before the third and last read:
  - C1 take: his recorded decision "Sí, lista diaria" (`docs/ROADMAP.md:903-907`, 2026-11-02) is missing from his
    words; it cuts the number of cards and is stuck for the same reason (typed words). Add it and its effect on A's cost.
  - C2, X3 take: the trial must be the switch alone. No rule change, no skill rewrite in the trial: the gate's
    refusal and `askingRule`'s sentence read the switch; the rule change comes after the trial, on his typed sentence.
  - C3 take: a tapped answer changes no rule (`bin/lib/rules-change.mjs:233`); option A's text says a tap starts the
    probes and the trial, and that keeping it needs a sentence he types.
  - C4 take: a request can expire while the lead works (a foreground command lasts up to ten minutes); an expired
    request costs a repeat and the trial counts them.
  - C5, X1 take: the request is the whole message, a bounded grammar (the forms, a number, "listo", "como siempre",
    "por favor"); anything else opens nothing. His second real request would not match: 2 of 3. Change `last-word.mjs`
    to that grammar and run it again.
  - C6, X6 take: a card he asked for and left open through an absence stays a sighting of the same entry, tagged
    "requested"; A is a partial control and the brief's last condition can fail on it: said plainly. Add a test
    through the hook's entry beside the replay.
  - C7 take: say what A buys and what it does not: in 9 of the 15 uncovered absences with no question the lead did
    nothing either (`odd/tasks/departure-control.md`, L19); A lets the heartbeat's `AWAY:` line reach the lead in the
    held ones. No pull request's delay was computed.
  - C8 take: option C's text is "as today, with the merge keeper"; the lead may start J now.
  - C9, X5 take: thresholds before the build; 45.2 h over 10.7 days is 4.2 h a day; the recorded-to-answered measure
    has no script yet, the build's first step writes it; the questions he never asks for are a measure.
  - C10 rebut: one request, one question stays, on the brief's spec 3 and the two holds over two hours that were
    second-of-row (2026-11-02 13:00, 2026-11-10 18:08); its cost, 21 of 25 answered promptly, is said.
  - C11 take: fail closed only once the switch was read as on. C12 take: list the grader's copy
    (`evals/tasks/rule-away-autonomy/grader/reply.mjs:121`), `docs/RULES.md`, `CLAUDE.md`'s "never while work runs".
  - C13 take: the probes also try a stop and a send from another session against a test card, and record what a
    fork costs and whether it stops the lead's waits. C14 take: the small corrections.
  - X2 take: his line `0f71b2c6:73524` (2026-11-07) asks that a waiting item be mentioned once in chat and kept on
    the board; the design's "every later reply repeats" goes. To verify with `--quote` first.
  - X4 take: the request is used up durably before the tool is allowed; a failed write refuses. X7 take: the
    table's conclusion said per value.

- L10 (2026-11-11, the context pause at 86%): done since L9: his two lines checked
  (`docs/ROADMAP.md:903-907`, "Sí, lista diaria"; `0f71b2c6:73524`, 2026-11-07T14:31:58Z, "solo quiero que lo
  menciones una vez en el chat y me lo coloques como urgente", sent by the user); `last-word.mjs` now matches his
  whole message as a request and gives 2 requests in the window, which waited 19 and 1 minutes (his second real one,
  with trailing words, no longer matches); `words.mjs` counts only ready notices that name a pull request; the
  replay document is rebuilt from them. NOT done: the proposal still has its text of before L9 (it says 3 requests,
  1, 8 and 19 minutes, and a prefix match); nothing is committed; no `double-review take` for read `1d820f3b`.

- L11 (2026-11-11, at 87% of the context): part 1 of L9 is in the proposal (`fix1.mjs` of the scratch,
  every replacement applied): C1, C2 in the trial's paragraph, C3, C4, C5, C6, C9, C11, X1, X2, X4, X6 and the 2
  requests of L10.

- L12 (2026-11-11): part 2 of L9 is in the proposal too (`fix2.mjs`, every replacement applied). Left
  of item 1 below: only this document's L2 (2 requests; "ended by a message he typed") and a read of the proposal
  for sentences the two scripts left rough (its presence-gate conclusion reads awkwardly).

- L13 (2026-11-11, written at 13:04 local by the file's time): both takes of read `1d820f3b` are recorded (item 2 below is done). The third and
  last read runs as background task `bv2bgj57o` (item 3; its output file is under this session's tasks folder and
  names the read id). When it returns: a real failure it still finds goes to the lead as a problem in a `waiting`
  notice, with no fourth read; otherwise item 4.

- L14 (2026-11-11 13:20 local, after a compaction the host made at 13:15; the third and last read, read
  `eb1f6974-f4de-4a18-ab92-db0e2789e568`): the Claude reader 14 findings (1,586,353 tokens), the Codex reader 8
  (809,899 tokens). All 22 accepted, none rebutted; Claude's 1, 2, 4 and 5 are Codex's 1 and 4, 6, 8 and 3. Four are
  marked high: the trial changes his rule in practice on a tapped button and nothing ends it; its measures cannot
  show that the option buys anything; the question written for him stated as fact what nobody has seen. So the third
  read still finds real failures, and by `rule:double-review` there is no fourth: the design reaches him as a
  problem, through the lead. `rule:escalation-model` names the model this session already runs on, so nothing
  passes to a stronger one; what is left is his decision.
  - Corrected, being of fact: the request count (2, in the three documents); what the 45.2 hours contain; what a
    merge keeper could have landed; a sentence that misread its table; the option counts over 114 calls; the replay
    document's description of `last-word.mjs` and two of its labels; L2 and L7 here.
  - Not corrected, being of design: the eight items of the proposal's "What the third read left open", each with
    the fix its reader gave. Item 5 of the depth pass above still says "one line of each reply": his line
    `0f71b2c6:73524`, read whole with `--quote`, asks for one mention in chat and the top of the board.
  - The proposal's question with options A, B and C is withdrawn. Its place is taken by one question on how to go
    on: ten minutes of host probes with him and one redesign with one more read (recommended; that read is past the
    three of his rule, so it takes his word), or leave it as it is with the merge keeper, which the lead may start
    with no decision of his.
  - This session's reading of why three reads did not settle it: each correction added a mechanism and each
    mechanism its own failures, over three host facts nobody has seen and a change to a rule of his.

- L15 (2026-11-11 13:25 local, a correction): the clock times L9 to L14 first carried (13:10 to 13:50) were this
  session's guesses, not read from a clock, and ran ahead of it: the host's records put the pause notice at 13:02,
  L13's write at 13:04 and the compaction at 13:15, and the `ready` notice for pull request 829 was recorded at
  13:23. They are removed above; a time in this log is read from a command's output or left out.

## Next step
The design is not settled and this unit ends here: one documents-only pull request with the three documents, one
`ready` notice to the lead that says so first and carries the question of the proposal's last section but one, the
summary under `docs/sessions/`, `closed`. Nothing is built and no rule is changed. What follows is the lead's and
his: the question "The question for him" of the proposal. Whoever takes option 1 starts from the proposal's "What
the third read left open" and from the probes, not from the design text as written.
The wait for notices runs as task `bjbw8afcq` (`js-harness wait --notice-to 183`; this session stops it at its
close).

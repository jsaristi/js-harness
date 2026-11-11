# JH 183 · a question stops holding the lead while he is away: the design

## Goal
Design, with no source write and no rule change, how a question put to him stops holding the lead while he is away
(the failure `question-tool-holds-asker`, `docs/FAILURES.md`), and end in one documents-only pull request with a
double-reviewed proposal and the decision recommended to him. The opening it read is the lead's brief,
`C:\Users\Oficina\.js-harness\background\briefs\2026-11-11T11-45-06-808Z-8dd7fe78.md`, quoted in
`odd/tasks/question-holds-lead.md`, L1 and Specs.

## The user's words
The lead opened this work, not a message of his. His words on the subject, each read with
`js-harness sessions --quote` and "sent by the user" (the search and its limits: `odd/tasks/question-holds-lead.md`,
L4):

- `0f71b2c6`, line 51586, 2026-11-02: "hazme las preguntas en serio por que es que me las haces cuando estoy ausente
  y es imposible para mi responderte"
- `65318fd5`, line 8528, 2026-10-12: "Otra es que siempre necesito que las preguntas en las haga el orquestador, no
  la sesion para poder centralizar todo en una sola parte."
- `0f71b2c6`, line 56095, 2026-11-02: "siempre hazme todas las preguntas de boton"
- `0f71b2c6`, line 73524, 2026-11-07: "solo quiero que lo menciones una vez en el chat y me lo coloques como
  urgente. prioritario u opciones con un buen color al inicio del tablero"

## Delivered
- Pull request 829, documents only, from the branch `worktree-question-holds-lead`: ready (the notice recorded at
  13:23 local), not merged. It holds:
  - `docs/proposals/2026-11-11-question-stops-holding-lead.md`: the measurements, the host's facts, his words, ten
    options, the design the readers were given, what the third read left open, and the question for him. Its status
    line says it: not settled.
  - `docs/proposals/2026-11-11-question-stops-holding-lead-replay.md`: the four read-only scripts behind every
    figure, as text, with how to run them.
  - `odd/tasks/question-holds-lead.md`: the contract, the depth pass, the specs and the log L1 to L14
    (`js-harness contract check odd/tasks/question-holds-lead.md`: PASS).
  - this summary.
- What the replay measured, local 2026-10-31 07:00 to 2026-11-11 00:00, over the lead's transcripts `0f71b2c6` and
  `ea85ec35` (`replay.mjs`): 114 question calls, 108 shown, 27 that waited over 15 minutes and 8 over two hours; the
  tool held the lead 45.2 hours, 40.2 of them in the 27; `rule:person-present` was kept in 94 of the 108 and 21 of
  those 94 still waited over 15 minutes. As a gate at 1, 2, 5 and 15 minutes it refuses 76, 55, 35 and 14 questions
  and still lets through 8, 10, 15 and 21 long waits.
- What the host gives (one claude-code-guide sub-agent; its quotes pass through a summarizing fetch and were not read
  on the live pages): the host's bound on a question never starts under Remote Control; nothing documented closes an
  open question from outside; an ordinary sub-agent cannot ask. In the transcripts, an open card ended only on a
  message he typed (`0f71b2c6`, lines 49241 and 49250) or the session's shutdown (line 76939).
- Nothing built, no rule changed, no question recorded for him.

## Decisions
- This session's: the design given to the readers is option A (the question waits, its card appears in the reply to
  a message of his that asks for it), as a seven-day trial behind a project switch after ten minutes of host probes
  with him (`odd/tasks/question-holds-lead.md`, L6 and L7).
- This session's, after the third read: that design is not put to him as a choice. The question for him is how to
  go on: the probes first and one redesign with one more read (recommended), or leave it as it is with a merge
  keeper (`odd/tasks/question-holds-lead.md`, L14; the proposal's "The question for him").
- The lead's: design only, one documents-only pull request, no question recorded while he is away, one heavy command
  at a time (the brief's last paragraph); sub-agents at medium from the resume on (L5).
- His: none was asked of him in this unit. The question waits for the lead to put it to him.

## Failures and lessons
- **Three double reviews did not settle the design.** Read `33e22402`: 12 and 6 findings, all taken. Read
  `1d820f3b`: 14 and 7, 20 taken and one rebutted. Read `eb1f6974`: 14 and 8, all accepted, four marked high: the
  trial changed his rule in practice on a tapped button with no end date, its measures could not show that the
  option buys anything, and the question written for him stated as fact what nobody has seen work. The fix now: the
  facts are corrected, the eight open items of design are written in the proposal with the fix each reader gave, and
  the design goes to him as a problem, as `rule:double-review` says. Not checked: no read confirms the corrections
  of fact made after the third. What would stop it recurring is this session's reading, not a check: the design
  rested on three host facts nobody had seen and on a change to a rule of his, and each correction added a
  mechanism with failures of its own; a design of this kind starts with the probes and with his typed sentence, not
  after them. Where that enters is the lead's and his to say.
- **One figure lived in three texts.** After the request pattern became his whole message, "3 requests" stayed in
  the proposal's summary and unknowns, the replay's head and this feature's log beside "2" in the table; the third
  read found it. Fixed in the three documents; the count is 2 by `last-word.mjs`.
- **`words.mjs` counted no notices** because a notice's `to` is an object, not a string; found before the first
  read's answer and by the Codex reader. Fixed in the script; 33 notices, 9 of kind `ready`.
- **The host stopped this session's wait for low memory** (11:13 local). As the brief says, the lead got one waiting
  notice and the session stopped until the new lead's message (L5).
- **Clock times in the log were guessed.** L9 to L14 of the feature document carried hours this session estimated,
  up to half an hour ahead of the clock; the `ready` notice's own stamp (13:23 local) showed it. Fixed in a second
  commit (L15): a time in a log is read from a command's output or left out.
- **The host compacted this session at 13:15 local**, between the launch of the third read and its return. The state
  was written in the feature document before it (L13) and the resume read it from there.

## Left
- The question for him, for the lead to record and put to him at his return: the proposal's "The question for him".
- The merge keeper (a loop that runs `js-harness merge-queue --land` while the lead is held): the lead's to start,
  with no decision of his.
- If he takes the probes: the redesign from "What the third read left open", by whoever the lead gives it to.
- Not made: the page in his language for this proposal (`rule:reports-spanish-visual`). With the design not settled
  there is no proposal to decide on; the question's text is in his language.
- The failure `question-tool-holds-asker` stays open, its control a sentence.

## Cost
- Time: opened 06:45 local (the brief's stamp), stopped by the host at 11:13, resumed by the lead's message, closed
  the same afternoon; the `closed` notice carries the time and the context share.
- Context: one compaction by the host, at 13:15 local, after the pause notice at 300k tokens.
- Reviews: three double reads of documents, 3,568,865 tokens of the Claude reader (1,279,532, 702,980 and 1,586,353)
  and 2,037,218 of the Codex reader (429,839, 797,480 and 809,899). No Codex code review and no lenses: no code.
- Sub-agents: one claude-code-guide reader of the host's documentation, in two turns.
- Gate runs: two, one a commit. The second commit corrects the log's clock times and names the pull request.

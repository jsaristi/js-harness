# How a question stops holding the lead while he is away: a proposal, 2026-11-11

A design, by JH 183, for the failure `question-tool-holds-asker` (`docs/FAILURES.md`, 9 sightings, state "seen
again"). Nothing was built, no rule was changed and nothing was spent beyond one read of the host's documentation by
a sub-agent and the double review of this text. Its feature document is `odd/tasks/question-holds-lead.md`; the
scripts behind every figure are in `docs/proposals/2026-11-11-question-stops-holding-lead-replay.md`, each figure's
script named there.

**Status: not settled.** This design passed three double reviews, the most `rule:double-review` allows, and the
third still found real failures in it. So it does not reach him as a choice between its options: it reaches him as
a problem, through the lead, with what the third read left open ("What the third read left open", below) and one
question on how to go on ("The question for him"). The measurements and the host's facts stand, with the corrections
the readers brought. The recommended design from "The recommended design (A)" on is the text the third read saw,
kept so its findings can be followed; it is not to be built as written.

Times are local, UTC-05:00. The window measured is 2026-10-31 07:00 to 2026-11-11 00:00, the lead's transcripts
`0f71b2c6` and `ea85ec35`. "Held" means the lead's turn was suspended inside the question tool: it could take no
turn, and the host gave it nothing until the tool returned.

## Summary

Bad news first.

- **Three reads did not settle the design.** The third found, among 22 findings, that the seven-day trial would
  change in practice how his rule works on a tapped button and with no end date, that its measures cannot show
  whether a free lead does anything more, and that the question written for him stated as fact things nobody has
  seen work. They are listed below with the fix each reader gave. The trial as written here is not put to him.
- **The rule that exists does not work, kept or not.** `rule:person-present` says to call the question tool at once
  only when he wrote under 15 minutes ago. It was kept in 94 of the 108 questions shown, and 21 of those 94 still
  waited over 15 minutes, 6 of them over two hours. Under 15 minutes, how recently he wrote does not separate a
  short wait from a long one: asked under one minute after his word, 8 of 32 questions waited over 15 minutes, the
  rate of all of them (27 of 108). Past 15 minutes the rate is higher, 6 of 14, on few cases.
- **Nothing found in the host frees the lead as it runs today.** The host's own bound on a question
  (`askUserQuestionTimeout`, 10 minutes at most) never starts while a session is connected to Remote Control, which
  the lead needs so he can answer from the phone. An open question ended in two ways in this window: a message he
  typed himself while the card was open, once, and the shutdown of the session, once. One message from another
  session and 12 ends of background tasks were queued while a question stayed open, and none ended it.
- **What it costs.** In those eleven days the tool held the lead 45.2 hours, about four hours a day; 40.2 of them in
  the 27 questions that waited over 15 minutes, which is the part a design can remove: the other 5.0 are the minutes
  he takes to answer a card he is looking at. Whether the machine was on through each hold is not known
  (`odd/tasks/departure-control.md` says it slept or was off in at least two), and 7.8 of the hours are one hold the
  app's shutdown ended. While those 27 waited, 33 notices were recorded for a lead that could not read them, 9 of them
  `ready` notices that name 8 pull requests. In 8 absences of over two hours the lead did nothing at all.
- **What freeing the lead buys, and what it does not.** In 9 of the 15 other absences that no stretch covered the
  lead was free and did nothing either (`odd/tasks/departure-control.md`, L19). What a free lead gains is that the
  heartbeat's `AWAY:` line (pull request 820) can reach it, and that it reads its notices. How much sooner any pull
  request would have landed was not computed.
- **The design the reads were given is a trial, and it changes one of his habits.** The question waits, and its buttons appear
  when he asks for it. Today he says "siempre hazme las preguntas"; with this, the lead tells him a question waits
  and he asks for it. It keeps the lead's chat, the buttons and the one place. It costs him a step more a question,
  about ten a day, and it may delay answers he gives today within minutes. So it is proposed for seven days, behind
  a switch, with three measures and one command to go back.
- **Two things the host may allow would be better, and are not known.** A fork of the lead that asks in its place,
  and the desktop's next-step box, could each keep the card appearing by itself and free the lead. Neither is
  documented to work here and neither was seen on his phone. The build starts by trying both with him, ten minutes;
  if one works it replaces the trial, since it changes nothing for him.
- **What stays unguaranteed.** He can ask for a question and take his time with the card open: the two questions
  that followed a request of his, by the check as proposed, waited 19 minutes and 1 minute. Two cases do not size
  what remains. The push to his phone that tells him a question waits is the model's act, and nothing proves it was
  delivered.

## What was measured

The scripts read the transcripts, the stretch record and the channel record with this repository's own readers
(`quoteEntry`, `questionCallsOf`, `ABSENCE_MS`). The replay gives JH 176's figures again: 31 absences over two
hours, 23 that no stretch covered, 8 of those with the lead held by a question, 4 of the last 5.

| What | Figure | Script |
|---|---|---|
| Question calls of the lead; refused by the gate before showing; shown | 114; 6; 108 | `replay.mjs` |
| Answered; ended by a message he typed; ended by the session's shutdown | 106; 1; 1 | `replay.mjs`, `queued.mjs` |
| Returned within 2, 5, 15 minutes (answered within 15: 80) | 44, 60, 81 of 108 | `replay.mjs` |
| Waited over 15 minutes; over two hours | 27; 8 | `replay.mjs` |
| Time the tool held the lead; in the 27; in the 8 | 45.2 h; 40.2 h; 29.1 h | `replay.mjs` |
| Kept `rule:person-present`; of those, waited over 15 minutes; over two hours | 94; 21; 6 | `replay.mjs` |
| Asked under two minutes after his answer to another question; of those over 15 minutes; over two hours | 25; 4; 2 | `replay.mjs` |
| Notices to the lead while one of the 27 waited; of kind `ready`; pull requests those name | 33; 9; 8 | `words.mjs` |
| Queued by the host while one of the 27 stayed open: ends of tasks; messages of a session | 12; 1 | `queued.mjs` |
| Of the 114 calls, those with two options; three; four | 90; 22; 2 | `replay.mjs` |
| Questions asked under five minutes after a message of his that is a request; their waits | 2; 19 minutes and 1 | `last-word.mjs` |

His last entry before each of the 8 holds over two hours was an answer to another question in 6 and a typed message
about something else in 2 ("en cuanto tendremos el gentle-ai migrado?", 42 seconds before a question that then
waited 161 minutes). In none had he asked for a question.

A presence rule made into a gate would have done this, at each value (`replay.mjs`):

| His last word must be under | Questions refused, of 108 | Waits over 15 minutes still let through | Of them over two hours |
|---|---|---|---|
| 1 minute | 76 | 8 | 3 |
| 2 minutes | 55 | 10 | 3 |
| 5 minutes | 35 | 15 | 4 |
| 15 minutes (today's value) | 14 | 21 | 6 |

Of the 108 questions, 81 were back within fifteen minutes. At one minute the rule refuses 76 of the 108, so most of
what it refuses he would have answered soon; at five it refuses 35. At every value it still lets holds of over two
hours through.

## What the host gives

Read in the host's documentation (code.claude.com/docs/en) by a claude-code-guide sub-agent, and in part by the
Codex reader of this proposal. The sub-agent's quotes pass through a summarizing fetch, so each string is read on
the live page before anything is built on it.

- `askUserQuestionTimeout` (`settings-reference.md`, `tools-reference.md`): `"60s"`, `"5m"`, `"10m"` or `"never"`,
  the default. When it fires the dialog closes and "tells Claude you may be away from your keyboard".
- "The timer never starts for a question Claude asks in a background session, in screen reader mode, or while the
  session is connected to Remote Control. Those questions wait until you answer them." (`tools-reference.md`)
- A hook can answer a question only before it shows (`hooks.md`, `updatedInput.answers`); a hook's timeout does not
  end the call. No page gives a command or a hook that closes a question on his screen.
- What the transcripts show beside the pages. A message he typed while a card was open ended the call in under a
  second, with the host's note "[User did not answer this question — they sent a message instead. Treat that message
  as their response; do not re-ask.]" (`0f71b2c6`, lines 49241 and 49250, 2026-11-01). The session's shutdown ended
  another (`0f71b2c6`, line 76939: `"toolDenialKind":"user-rejected"`, `"interruptedByShutdown":true`). A message of
  another session queued during a hold did not end it, in the one case there is.
- An ordinary sub-agent cannot ask: `AskUserQuestion` is removed from its tools "even when listed"
  (`sub-agents.md`). The same page says a fork skips those filters and gets the main conversation's tools. Where a
  fork's card would appear, and whether the session that forked stays free meanwhile, no page says.
- The phone's push (`remote-control.md`, "Mobile push notifications") tells a push for something that needs him from
  one Claude sends on its own, with separate settings. Whether he gets one today for a waiting question is not known.
- Not in any page: the desktop's next-step box (`wrap_up`), and what is delivered to a session while a question
  waits. That the host queues a background task's end behind an open question is read in the transcripts
  (`queued.mjs`; JH 176 read it at `ea85ec35`, lines 4458 and 4515 to 4518).

## His words on the subject

Each read with `js-harness sessions --quote`; all "sent by the user". The search and its limits are in the feature
document, L4.

- `65318fd5`, line 8439, 2026-10-12: "Siempre hazme las preguntas asi por favor osea asi siempre debe ser el
  protocolo sobre todo para que no se me pase ninguna, por favor metela al harnes"
- `65318fd5`, line 8528, 2026-10-12: "Otra es que siempre necesito que las preguntas en las haga el orquestador, no
  la sesion para poder centralizar todo en una sola parte."
- `65318fd5`, lines 12735 and 13110, 2026-10-13: the two quotes `rule:questions-one-place` carries
  (`js-harness rules questions-one-place`).
- `0f71b2c6`, line 21816, 2026-10-29: "siempre colocame las preguntas aca y cuando hayan preguntas viejas que no he
  respondido, colocamelas en el tablero como todo o tareas para yo podertelas pedir por que me queda muy dificil
  adivinar o estar pendiente de todas las sesiones"
- `0f71b2c6`, line 51586, 2026-11-02: "hazme las preguntas en serio por que es que me las haces cuando estoy ausente
  y es imposible para mi responderte"
- `0f71b2c6`, line 56095, 2026-11-02: "siempre hazme todas las preguntas de boton"
- `ea85ec35`, line 3779, 2026-11-10: "Listo dame las preguntas como siempre"

Two more, found by the readers. A decision of his that waits to become a rule: reversible questions decided by the
recommended option and listed to him once a day ("Sí, lista diaria", 2026-11-02, `docs/ROADMAP.md:903-907`; it
waits for words he types). It would cut the cards well below today's ten a day, and with them the hold and A's
cost; it is not built, so the figures here are without it. And `0f71b2c6`, line 73524, 2026-11-07: "solo quiero que
lo menciones una vez en el chat y me lo coloques como urgente": the lead names each waiting question once in chat
and keeps it on the board, not in every reply.

This session's reading, his to correct. A question reaches him in the lead's chat and nowhere else, with buttons;
none may be lost; and one put on his screen while he is away is, in his words, impossible to answer. His words also
say the lead puts the questions to him ("siempre hazme", "colocame las preguntas aca"), and ask for the board and
"para yo podertelas pedir" only for old ones he has not answered. Option A below makes every question one he asks
for. That goes past what he has said, and it is the part of A that needs his own sentence.

## The options

"Frees the lead" means the lead can take a turn while the question waits, which is what the brief asks to be shown.

| Option | In the lead's chat | Buttons | Appears by itself | Frees the lead | What it needs | Verdict |
|---|---|---|---|---|---|---|
| A. The question waits; its card appears when he asks for it | yes | yes | no | yes, until he asks; then for as long as he takes | a check in the question gate, text changes | **recommended, as a trial** |
| B. A second session, only for questions, holds the tool | no: a second place | yes | yes, there | always | a standing session, a relay of each answer, a new phrase in his rule | the alternative |
| C. The desktop's next-step box (`wrap_up`): a card that ends the turn | yes | one or two | yes | always | a tool no page documents, never seen on his phone; the gate and the reply hook taught it | probe first |
| F. A fork of the lead asks in its place | not known | yes | yes | not known | a fork that carries the lead's whole context for each question | probe first |
| D. A tighter presence rule, as a gate | yes | yes | yes | no | nothing | rejected: the table above |
| E. The host's bound | yes | yes | yes | after 10 minutes | Remote Control off on the lead | rejected: he could not answer from the phone |
| G. The question is written out, he answers in text | yes | no | yes | always | nothing | rejected: against line 56095 |
| H. Buttons on the board page | no: the board | yes | yes | always | the page writing answers, a new way to prove an answer is his | rejected: a second place, and an answer outside any transcript |
| I. A message from outside ends the card after some minutes | yes | yes | yes | after those minutes | something that ends an open card | rejected on what is known: only his own typed message did; a session's message did not, in one case |
| J. Keep the card; a loop lands what is ready while the lead is held | yes | yes | yes | no | a merge keeper (`js-harness loop run`, which the skill names) | not enough alone: see below |

**J, beside the others.** A loop that runs `js-harness merge-queue --land` needs no turn of the lead, so it could
have landed, with the lead held, those of the 8 pull requests the 9 `ready` notices name that were fit to land then.
Which of them were (mergeable, their reviews recorded, no conflict: what `bin/merge-queue.mjs` asks) was not
reconstructed. It does not open a session, send a session its next step, open a
stretch, answer a card of the permit relay or read the 24 other notices: those need the lead. It is worth having
with any option, A included, for the minutes he takes with a card open. It is the lead's to run today, and needs
no decision of his.

## The recommended design (A), as a seven-day trial

**What he sees.** The lead no longer puts a card on his screen by itself. When a question is recorded for him:

1. The lead's reply says so in one line: which question, what it is about, and the word that brings it. It says it once
   (his line 73524); the board keeps it in its open questions and in what is his.
2. The lead sends one push to his phone for each recorded question, with the same line. This is the model's act
   through the host's push tool: nothing proves it reached the phone, so the reply's line and the board are what the
   design relies on. Its first use is checked with him (the trial's first step).
3. He sends a short message when he wants to answer. The forms proposed are the ones he already writes: "hazme la
   pregunta 255" (it exists today), "hazme las preguntas", "dame las preguntas", and two short ones for the phone,
   "pregunta" for the oldest one waiting and "siguiente" for the next. The words are his to change.
4. The card appears in the reply to that message, as it is today: the same text, the same buttons, the recommended
   option first.
5. One request, one question. After his answer the lead does not show the next one; its reply says how many still
   wait, and "siguiente" brings the next. This is the second question of a row: 2 of the 8 long holds were a question
   shown under a minute after his answer to another.

**What it costs him, said whole.** Today 44 of 108 questions were back within two minutes and 81 within fifteen,
with no act of his but the answer. With A each takes four steps: see the line or the push, send the word, wait for
the lead's reply (his message is queued while the lead is mid-turn), tap. How much later the answers come, and what
that does to the sessions that wait on them, is not estimated here; it is the trial's second measure.

**What the lead does.** It records the question first, as today, says the line, and goes on with what does not wait
on the answer. Nothing of its turn is suspended, so the ends of its background work, the notices of the sessions and
the heartbeat's lines reach it as they come. Its reply closes in the working state while work runs and in the
decision state when only his answer is missing, each with the line that names the question and the word; the reply
hook's text for a decision, "the question itself goes through the question tool", changes with it. While he is away
nothing changes: `rule:away-autonomy` already says nothing is asked.

**The check.** The question gate (`bin/lib/template-gate.mjs` and `bin/template.mjs`, the PreToolUse hook on the
question tool) already refuses a card that is not a recorded question as its template makes it. Where the switch
below is on, it admits a call only when all of this holds, each read from the session's transcript and the record:

- his newest entry, by its time and not by its place in the file, is a typed message that is a request and nothing
  else: a form, a number, an opening "listo", and "como siempre" or "por favor" at its end. "Hazme las preguntas
  cuando vuelva" opens nothing; neither would his own "hazme las preguntas en serio por que ..." of 2026-11-02, which
  costs him a repeat. Whose entry it is stays `quoteEntry`'s one rule. The forms are data
  in code, as the question word is (`bin/lib/sessions.mjs:1655-1657`); the gate reads no
  other word of his and guesses nothing from free text;
- that message is under five minutes old, and the session has not ended a reply since it: a request answered late,
  or one made when nothing waited, opens nothing later;
- no question call was admitted since that message, the call being judged not counted: one request, one question;
- the call asks exactly one question, and it is the one the request names, or the oldest waiting for "pregunta" and
  the next for "siguiente".

Once the switch was read as on, it fails closed: when the transcript or the record cannot be read, or the use of
the request cannot be written, the call is refused and the reason said, where today's gate admits
(`bin/template.mjs:258-295`). A configuration that cannot be read keeps today's path, since the switch is in it. The
request is used up by a durable write before the tool is allowed. A request can run out while the lead works (a
foreground command lasts up to ten minutes): that costs him a repeat, and the trial counts them. A refusal says what to do: end the reply with
the line that names the question and the word. A wrong refusal stops no work: the question waits, recorded. A
message of his the list misses costs him one repeat, and the reply that follows says the exact word. A call denied
or closed is asked again only on a new request.

**What it would have done.** By that predicate (a typed request under five minutes before, `last-word.mjs`), none of
the 8 holds over two hours followed a request of his, and neither did 26 of the 27 waits over 15 minutes: none of
those cards would have been on his screen when it was. Two did follow a request: "listo hazme las preguntas", 69 seconds
before, waited 19 minutes, and "Listo dame las preguntas como siempre" waited one. The replay tests the request's
form and age only: not the reply ended since, the one question a request, nor its number.

**The trial.** A switch of the project (`js-harness functions`, beside `pushUnasked`) turns the new refusal on; it
is off by default and off in every other project, so nothing changes for a project that did not ask for it. In
js-harness it is on for seven days. At their end the session that built it reports, by the replay run again:

1. the hours a day the question tool held the lead (4.2 in this window: 45.2 hours in 10.7 days);
2. the median time from a question recorded to its answer, against the same window before;
3. the questions shown after a request that then waited over 15 minutes, and the longest.

The trial is the switch and nothing else: the gate's refusal and the sentence `askingRule` prints read it, and
no rule, skill text or control of the failure changes while it runs. Going back is the switch turned off, one
commit. Proposed before the build, his to set: A stays when the lead was held under one hour a day, no question
waited unasked over a day, and the answers do not come later than he accepts. The measure from recorded to answered
has no script yet; the build writes it first, with this window as its baseline. Keeping A afterwards is the rule
change below, and that takes a sentence he types: a tapped button changes no rule of his
(`bin/lib/rules-change.mjs:233`).

**What a yes covers.**

- First, ten minutes with him, before any code: one push to his phone, a fork of the lead asking a test question (F),
  a test card of the next-step box (C), and a stop and a message from another session against an open test card
  (I), with what he sees on the desktop and on the phone written down, what a fork of the lead's context costs and
  whether it stops the lead's waits (the skill says a forked session does, `bin/lib/manifest.mjs:236`). If F or C
  shows the card in the lead's chat with its buttons, leaves the lead free and his tap is read as his word, the
  build stops there and the lead brings him that result: it would free the lead with no change for him.
- Then the build of A, one feature, tests first: the gate's refusal and its tests in
  `bin/lib/template-gate.test.mjs` and through the hook's entry (`bin/template.test.mjs`), among them the one the
  failure's control will name ("a question call that is not the reply to his request for it is refused"), a request
  that is old, a reply ended since, a second call on one request, a wrong number, two questions in a call, and each
  record that cannot be read; the switch.
- After the trial, and only on a sentence he types that keeps A: the three items below.
- The texts that order the tool at once, each changed to the line and the request (also the grader's copy of the
  reply hook, `evals/tasks/rule-away-autonomy/grader/reply.mjs`, `docs/RULES.md`, and `CLAUDE.md`'s "never while work
  runs", since a card he asked for is shown while the lead's work runs): `askingRule`
  (`bin/lib/sessions.mjs:2866`, printed by `bin/notify.mjs:596`, `bin/resume.mjs:804` and the board's `to ask:` line,
  `bin/lib/sessions.mjs:3316`), and in the orchestrator skill (`bin/lib/manifest.mjs`) the paragraph on the question
  tool, a session held on a card (:139), a card of the permit relay (:140), a new lead's charter (:230), the
  reinstall's items (:245) and a work session with no orchestrator (:255). A permit card keeps its own wait and
  reaches his window after it, as today. A sitting of several items takes one request an item, in the trial.
  The questions of an onboarding (`bin/lib/onboard.mjs`) stay as they are: the switch is off in a project being
  onboarded.
- The rule change, through `js-harness rules change` on a `rule/` branch: `rule:person-present` (the project's, 15
  minutes) is retired with its successor `question-on-request`, owner sebastian, sourced on his sentence of approval:
  "A question is put to the user with the question tool only in the reply to a message of the user's that asks for
  it, one question a request; until then it waits in the record, on the board and in one line of each reply." Its
  binding in `bin/lib/rules-coverage-data.mjs:41` moves with it.
- In `docs/FAILURES.md`, the entry's control becomes a check, and the sentence it has today moves to a `- Was:` line.
- The proof the brief asks for, "the lead taking a turn while a question of its own waits", is not a fixture: it is
  the replay run over the lead's real transcript after the trial's first days, counting the questions recorded and
  not shown while the lead's own entries go on.

**What counts as a sighting afterwards.** A question on his screen that he did not ask for and that holds the lead
through an absence is a `- Seen:` line of `question-tool-holds-asker`: the check failed. A question he asked for and
left open through an absence is a sighting too, of the same entry, marked "requested". So A is a partial control, and the
brief's last condition, a window with no new sighting, can fail on what A leaves.

**What it changes in `rule:questions-one-place`.** Its two registered phrases stay: "Every question of the project
reaches the user in one place" and "Ask the user nothing while an orchestrator holds its role". The place (the
lead's chat), the tool and its buttons, and the record before the question stay. What changes is who starts the
card: the lead today, he with A. That is a change to how he said he wants them ("siempre hazme las preguntas"), so
his sentence is added to the rule's source with its date and line, and the reading of the rule says it.

**What a yes does not cover.** A second session for questions (B). Several questions on one card. Reading his
messages for anything but the request forms. Any change to what is asked, how many options a card has or who
decides what. Keeping A after the seven days.

**Risk.** High, by `AGENTS.md`: it changes a guard (item 2) and the contract by which every session asks (item 3).
So the build gets an independent verifier, who replays the built gate over the 108 real calls of this window and
their transcripts. A gate that admits wrongly is today's behaviour.

**Size.** An estimate, not measured: one work session, three slices (the gate, its tests and the switch; the texts;
the rule change), under 600 changed lines.

## The alternative (B): a session only for questions

A small session, always the same one, holds the question tool; the lead records the question and rings it; it shows
the card, and when he answers it records the answer and rings the lead. The lead is never held, not even while he
thinks with a card open, and the card appears by itself, so it removes what A leaves and costs him no extra step.
Its price:

- A second place. He would talk to the lead in one chat and answer questions in another. His lines 8528 and 21816
  ask for one place because watching several sessions is hard for him. The first phrase of
  `rule:questions-one-place` would change.
- A standing session more on a machine where the host stopped sessions for low memory twice last night and a
  command of this session today. What a session costs in memory was not measured here.
- A hop for each answer, a session that fills its context with cards and must be renewed, and his typed replies to
  a question arriving at a session that knows nothing of the work.

## Leaving it as it is

The lead keeps being held about four hours a day on this window's average, and the entry keeps gaining sightings:
8 in eleven days. The heartbeat's `AWAY:` line cannot reach a held lead (`odd/tasks/departure-control.md`, L4). With
a merge keeper (J), which the lead may start today with no decision of his, what is ready lands meanwhile: this is
what "as it is" means in the question below.

## Not checked, and not known

- Whether a fork of the lead can ask, where its card appears and whether the lead stays free (F); the desktop's
  next-step box on his phone, and how a tap on its button is written in the transcript (C). Both are the first step
  of a yes.
- Whether the host's timer runs in a desktop session with Remote Control off: not tested, and not needed.
- Whether the host's suggested prompt on the phone would offer "siguiente" or "pregunta" after a reply that ends
  with it. If it does, a request is one tap; if not, one typed word.
- Whether he gets a phone push today for a waiting question, and whether the lead's own push arrives.
- How long he takes once he has asked for a question: two cases by the check as proposed, 19 minutes and 1.
- Whether any message but one he types ends an open card: one case of a session's message, which did not.
- The sub-agent's quotes of the host's pages were not read on the live pages by this session.

## What the third read left open

The third read (`eb1f6974`) brought 14 findings from the Claude reader and 8 from the Codex reader. All 22 are
accepted as real; none is rebutted. Those of fact are corrected in this text and its two companions: the request
count (2, by the whole-message pattern, everywhere), what the 45.2 hours contain, what a merge keeper could have
landed, one sentence that misread its own table, the option counts being over 114 calls, two labels of the replay.
Those of design are not corrected here, because a correction needs a confirming read and `rule:double-review` leaves
none. Each is listed with the fix its reader gave.

1. **The trial changes his rule in practice on a tapped button, and nothing ends it** (Claude 1, Codex 1 and 4;
   high). With the switch on, the gate refuses every card he did not ask for, which suspends his "siempre hazme las
   preguntas" and `rule:person-present` for a week while their text says the opposite; `rules change` refuses a
   tapped answer as a source, and the comparable "Sí, lista diaria" still waits for typed words. The switch has no
   end date. Fix: the trial starts on a sentence he types, recorded as a dated exception in the sources of both
   rules; the switch carries an end time the gate reads, after which it reads as off with nobody acting, with a test
   for a switch past its date; the board shows when it ends; the report has an owner other than the session that
   built it.
2. **The trial cannot show that A buys anything** (Claude 2, Codex 6; high). The hours held fall by construction,
   since the tool is called less. Nothing counts what the freed lead did, and in 9 of 15 uncovered absences a free
   lead did nothing. The three thresholds are not the three measures; the time from recorded to answered has no
   baseline; a median over answered questions can improve while unanswered ones pile up; "lista diaria", built in
   the same week, would confound it. Fix: outcome measures defined before the build, each with its baseline over
   this window from a script: in his gaps of over 15 minutes with a question pending, the share where the lead took
   a turn; the time from each `ready` notice to its land; the median and the 90th percentile from recorded to
   answered; his extra messages a question (requests, repeats, requests that ran out); the questions unasked over a
   day, with their ages. A number for each, which he sets.
3. **The question written for him stated as fact what nobody has seen** (Claude 3; high). It said the lead goes on
   working and that a notice reaches his phone; it left out that a free lead did nothing in 9 of 15 absences, that
   the request must be his whole message in a fixed form, that "hazme las preguntas" brings one card, and that
   "lista diaria" would cut the cards; its letters clashed with the option table's. That question is withdrawn; the
   one below replaces it.
4. **Said once, or in every reply** (Claude 5, Codex 3). The design says both. His message of 2026-11-07
   (`0f71b2c6`, line 73524) reads whole: "solo quiero que lo menciones una vez en el chat y me lo coloques como
   urgente. prioritario u opciones con un buen color al inicio del tablero para yo saber y no gastemos tokens
   innecesarios insistiendo tanto". Fix: each question named once in chat when it is recorded, then only on the
   board, first and with its level; the successor rule's sentence and the refusal's text say the same.
5. **The request check** (Claude 6, 9 and 10; Codex 2 and 5). The pattern misses how he writes ("siguiente
   pregunta", "pregunta?", "hazme las preguntas pendientes") and the trial does not count its misses. What the
   plural forms bring is not defined. One request, one question charges him 21 extra messages to prevent 4 long
   waits, 2 of them over two hours, and the second of a row is the least risky class (4 of 25 over 15 minutes,
   against 6 of 28 after a typed message and 27 of 108 overall). The five minutes run from the time the host queued
   his message, while it is the lead that delays. A request made with nothing waiting can admit a question recorded
   later in the same reply. Two calls of the hook can both read a request as unused. Fixes: a target for every
   form; the pattern tested against every typed message of his that holds "pregunt"; the misses as a measure; the
   choice between one a request and a run that stops at the first card left unanswered, his to make; the age
   counted from when the message reached the model, or dropped; the question must have been waiting when he asked;
   one atomic claim a request, with tests for two calls at once and for a restart.
6. **The probes and the options** (Claude 7). The probe of a card ended from outside has no rule for what follows
   if it works. A watchdog that ends an unanswered card after some minutes (a host mod's timer,
   `docs/proposals/claude-app-native-sessions.md:94` and `:220-225`) is not in the table. The next-step box is
   recorded there as checked on Windows (`:80`), for one or two buttons, where 24 of the 114 calls have three or
   four, and a session started with `sessions start` has none (`:416-418`). A fork stops the lead's background work
   (`bin/lib/manifest.mjs:236`). Fix: the watchdog as an option, and for each probe the outcome that changes the
   design.
7. **During the trial the gate and the lead's instructions pull opposite ways** (Claude 8). The skill, the reply
   hook, `CLAUDE.md` and `docs/RULES.md:342` would still order the tool at once while the gate refuses it; the
   gate's present refusal (`bin/lib/template-gate.mjs:82`) and the board's "hazme la pregunta N"
   (`bin/sessions-live.mjs:104`) are not in the list of texts; a card of the permit relay, which waits 9.5 minutes,
   would often end in the other session's window. Fix: the switch selects the texts too.
8. **The proof and the size** (Claude 12 and 13). The brief asks for a test of the lead taking a turn while a
   question waits: a second test through the hook's entry (an unrequested ask is refused and the next call of
   another tool is admitted), with the replay as field evidence, not as the proof. The size is estimated again for
   what the trial holds, with the lists of switches a new one touches.

**Why three reads did not settle it: this session's reading.** Each correction added a mechanism (a trial, a switch,
a pattern for his words, a life for a request), and each mechanism brought its own failures. Under them the design
rests on three facts of the host nobody has seen (whether a push reaches his phone, whether a fork of the lead can
ask, whether an open card can be ended from outside) and on changing a rule of his. Ten minutes with him settle the
three facts with no code. If a fork or the next-step box shows the card in the lead's chat, or a watchdog can end a
card left open, the design that follows changes nothing in how a question reaches him, so it changes no rule of
his, and most of the eight items above fall away with the mechanisms they are about.

## The question for him

The earlier question, with options A, B and C, is withdrawn (item 3 above). `rule:double-review` says that a third
read that still finds a real failure reaches him as a problem. For the lead to record and put to him, in his
language, as one question. Option 1 includes a read past the three his rule allows, so a sentence he types is the
safe form of a yes to it. Its text:

> **Para js-harness (JH 183, cómo una pregunta deja de frenar al líder).** El diseño no quedó listo. Pasó las tres
> lecturas dobles que permite tu regla y la tercera todavía le encontró fallas reales. Las tres principales: la
> prueba de siete días cambiaba en la práctica tu "siempre hazme las preguntas" con un botón y sin fecha de fin; sus
> medidas no mostraban si el líder libre hace algo más; y el texto que te iba a preguntar daba por hecho cosas que
> nadie ha visto funcionar, como el aviso al teléfono. Lo medido sí se sostiene: cuando el líder te pregunta con
> botones se queda parado hasta que respondes; en once días fueron 45 horas, 40 de ellas en 27 preguntas que
> esperaron más de quince minutos. ¿Cómo seguimos?

- **1. Diez minutos de pruebas contigo y después rehacer el diseño una vez (Recomendada).** Un sí cubre: diez
  minutos tuyos frente al PC y con el teléfono para ver cuatro cosas del host que nadie ha visto: si te llega un
  aviso al teléfono, si una copia del líder puede hacerte la pregunta sin que el líder se pare, si la caja de
  siguiente paso sirve en tu teléfono y si una tarjeta abierta se puede cerrar desde afuera. Con eso se rehace el
  diseño una sola vez, con las 22 observaciones de la tercera lectura, y pasa una lectura doble más, que cuesta lo
  que la tercera: unos 2,4 millones de tokens entre Claude y Codex. Esa lectura es una más de las tres de tu regla;
  por eso te la pregunto. No cubre construir nada, cambiar ninguna regla ni encender ninguna prueba: eso vuelve a ti
  con el diseño nuevo. Si alguna de esas pruebas sale bien, el diseño nuevo puede no cambiar nada para ti: las
  preguntas te seguirían apareciendo solas.
- **2. Dejarlo como está por ahora.** No se diseña más. Las preguntas te siguen apareciendo solas y el líder sigue
  parado mientras no respondes. El líder puede poner desde hoy un proceso aparte que une los pull requests que
  estén listos mientras tanto; eso no necesita decisión tuya. Lo demás (abrir sesiones, abrir el tramo, leer
  avisos) sigue esperando tu respuesta. La falla queda abierta y este documento queda como registro de lo medido.

## What the readers changed

One blind read by a Claude reader and a Codex reader on one frozen copy (`js-harness double-review read`, read
`33e22402`): 12 and 6 findings, all taken, two of them found by both.

- Both: the check as first written had no end. A request stayed good for hours, and the replay measured another
  predicate. The check now ends with the reply and at five minutes, and the replay runs that predicate.
- Both: the figures could not be run again from the repository, and "9 pull requests" was 9 notices that name 8.
  The scripts are now in a document beside this one, each figure names its script, and the count is corrected.
- The Claude reader: a message he types ends an open card, which the first text denied; option I and the two ways a
  call ended are from that. The recommendation rested on three cases with no way back: it is now a seven-day trial
  behind a switch, with three measures. A stretches his "siempre hazme las preguntas": the summary, the reading and
  the question now say so. The texts and sessions the gate reaches were not all listed: they are. The proof and what
  counts as a sighting after A are defined. Option J (a loop that lands while the lead is held) was missing. The
  rule's successor has its id, owner and sentence. Smaller ones: the shutdown that ended the question of 2026-11-09,
  two line citations, two labels.
- The Codex reader: one question a call, bound to the request's number and used up on admission; the gate fails
  closed where today's admits; the push is not relied on and is tried with him first; a fork is not an ordinary
  sub-agent and may ask, which is now option F and a first step.

A second read on the corrected text (read `1d820f3b`): 14 and 7 findings, 20 taken and one rebutted. It found a
decision of his this text had missed ("Sí, lista diaria") and his line asking that a waiting item be said once; that
the trial was not reversible as written, so it is now the switch alone and the rule change comes after it, on a
sentence he types; that a request matched by its opening words let "hazme las preguntas cuando vuelva" through, so
the request is now his whole message, and the measure is 2 requests, not 3; that a card he asked for and left open
is a sighting like any other; that what freeing the lead buys was not said; and that leaving it as it is comes with
the merge keeper. Rebutted: letting "hazme las preguntas" open a run of cards. The brief asks to design for the
second question of a row, and the two holds of over two hours that began under a minute after his answer to another
question are that case; its cost, a word for each of the 21 of 25 he answered promptly, is said above.

A third read on that text (read `eb1f6974`): 14 and 8 findings, all accepted. It corrected the facts named at the
head of "What the third read left open", and it is why this design is not put to him as a choice: its eight open
items are there, with the fix each reader gave. Under `rule:double-review` there is no fourth read without his
word.

What stays unguaranteed is the list under "Not checked, and not known", and everything the third read left open.

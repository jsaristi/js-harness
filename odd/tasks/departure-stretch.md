# JH 123 · guard --stop: a departure with no stretch open is turned back

Locator: `odd/tasks/departure-stretch.md` · Engram mirror: `odd/departure-stretch/tasks` · Branch: `worktree-departure-stretch`
Delivery: one pull request to main · Test runner: `node --test`

## Goal
When his newest word to the lead says he leaves or will be away and no stretch is open, the lead's stop is turned
back naming `js-harness stretch open --plan <file> --html <file>`; when it says he is back and the stretch of his
absence is still open, the stop is turned back until it is closed with `js-harness stretch close --html <file>`.

## Why
`rule:away-autonomy` asks for a stretch before he leaves and its return when he is back, and only prose carried it.
He left twice on 2026-10-31 (03:23:57Z and 07:41:17Z) and the lead opened none, so on his return the status report
said "ningún tramo desde el corte" and he got no estimate against actual and no route map: "el como vamos le faltan
varias cosas como el mapa de donde vamos, tambien de lo que estimabamos avanzar y lo que realmente avanzamos". A
check at the stop makes the duty act after every compaction, when the skill reaches the lead cut.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/departure-stretch.md` exits 0
- `node --test bin/lib/away-stretch.test.mjs bin/lib/person-times.test.mjs bin/reply.test.mjs bin/stretch.test.mjs bin/lib/stretch.test.mjs` exits 0
- the four planted cases of spec 3 in `bin/lib/away-stretch.test.mjs` failed before the check existed and pass after
  it, both runs quoted in `## Log`
- the false positives over the lead's real transcript are counted, with a sample and the cost per stop, in `## Log`
- the Stop hook's budget tests (`bin/reply-budget.test.mjs`) pass on Windows and in WSL, both quoted in `## Log`
- `node bin/js-harness.mjs failures check` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- the pull request is merged into main, named in `## Log`, with Codex and the Claude lenses recorded over its code

## In scope / Out of scope
- In: `bin/lib/away-stretch.mjs` (new) and its test, `bin/lib/person-times.mjs` (his words beside his times),
  `bin/lib/stretch.mjs` and `bin/stretch.mjs` (the record's reader moves to the light module), `bin/reply.mjs` and its
  test (the wiring), `bin/lib/manifest.mjs` (the hook's line), `docs/FAILURES.md`, `odd/tasks/lead-duty-checks.md`
  (row 45), `docs/sessions/`.
- Out: `~/.claude`, `~/.codex`, credentials, gentle-ai config; the stretch's own pages and measures.

## Constraints
- His messages are read by `quoteOf`'s one rule (`quoteEntry` through `bin/lib/person-times.mjs`), never a second
  copy — because two copies of whose words an entry is would drift.
- The open stretch is told by the one reader `js-harness stretch status` uses — because a second reading of the
  record could call open what `status` calls closed.
- The hook stays inside its budget (JH 116's tests, 15 s timeout) — because a timed-out hook skips every check of
  the stop.
- A Stop hook guard is Task Size high risk (items 2 and 6): Codex and the Claude lenses on every code slice and an
  independent verifier after the change's own checks.

## Ask me before
Nothing here is his: the brief carries his decision ("Sí, ábrela"). A finding that needs one goes to the lead with
`js-harness notify --to orchestrator --kind waiting`.

## Specs
1. His decision, the lead's wrap-up box, 2026-10-31 ~11:45Z, after line 42109 of the lead's transcript
   `0f71b2c6-cbce-43ca-a031-276a4b2c381f`: "Sí, ábrela", to the proposal to build the check that turns the lead back
   when he leaves and no stretch is open. His complaint before it: "el como vamos le faltan varias cosas como el mapa
   de donde vamos, tambien de lo que estimabamos avanzar y lo que realmente avanzamos osea faltan varias cosas".
2. The brief: "The check, at the lead's stop (orchestrator session only): when his latest own message says he leaves
   or will be away (Spanish and English; build the cases from the two lines above and other departures in the lead's
   transcript, e.g. "te dejo solo 3 horas", "te respondo las preguntas despues") and `stretch status` finds none open,
   the reply is turned back naming `js-harness stretch open --plan <file> --html <file>`. Its pair: when he says he is
   back ("ya llegue", "ya regrese") and a stretch is open, the reply is turned back until it is closed
   (`stretch close --html`)."
3. The brief: "Cover at least: departure with no stretch (turned back), departure with one open (passes), a message
   that is not a departure (passes), a return with an open stretch (turned back)."
4. The brief: "Count false positives over the lead's real transcript (how many of its replies would be turned back,
   with a sample) and say the cost per stop. The Stop hook's budget (JH 116's budget tests, 15 s timeout) must stay
   green; those two tests have flaked under load in WSL once (PR 736's first land), so measure on Windows too and say
   both."
5. The brief: "Add the `- Seen:` line for this mistake to `docs/FAILURES.md` in five parts (what happened, the fix,
   what stops it recurring, where it enters, the command that proves it has not come back), and mark the duty's
   control in `odd/tasks/lead-duty-checks.md`."
6. The brief: "Ready notice with --pr per slice; summary under docs/sessions/. Done when the change is on main
   through a PR that passed its reviews, `npm run check` passes and the duty row names its control."

## Tasks
- [ ] T1 (kind: build) spec 2, 3: the check, tests first, the planted cases red then green — commits: pending
- [ ] T2 (kind: verify) spec 4: false positives over the real transcript and the hook's budget on both systems — commits: this document's
- [ ] T3 (kind: docs) spec 5: the `- Seen:` line and row 45 of the duties — commits: pending
- [ ] T4 (kind: verify) spec 6: Codex, the lenses, an independent verifier, the PR and its ready notice — PR pending
- [ ] T5 (kind: docs) spec 6: the summary under `docs/sessions/` and the closed notice — pending

## Log
- L1 (2026-10-31, the lead's brief JH 123,
  `C:\Users\Oficina\.js-harness\background\briefs\2026-10-31T11-38-41-752Z-e68fabfa.md`): "JH 123 · guard --stop: a
  departure with no stretch open is turned back", with the steps quoted in the specs.
- L2 (2026-10-31, where it goes, searched first): `bin/guard.mjs --stop` reads only the context share
  (`stopRefusalOf`) and holds no lead test; the lead's stop checks live in the reply hook, `bin/reply.mjs`, beside
  the return check (`bin/lib/return-report.mjs`, JH 115), which already reads his messages (`personTimesIn`) and who
  the lead is (`isLeadSession`). So the check is a module beside it, wired the same way, not a second reader in
  `guard --stop`. Nothing records away or back today: `grep -n -i stretch bin/lib/guard.mjs bin/lib/sessions.mjs`
  finds no departure check, and the relief file's "away" line is prose the lead writes. The open stretch is
  `openStretch` of `bin/stretch.mjs` (the last `open` with no `close` of its id); importing `bin/stretch.mjs` costs
  the hook 131 ms more than the return check's modules, `bin/lib/stretch.mjs` 7 ms (one run each), so the record's
  reader moves to `bin/lib/stretch.mjs` and `bin/stretch.mjs` uses it from there.
- L3 (2026-10-31, his departures and returns in the four largest lead transcripts, 318 messages): departures —
  "voy a dejarte entre 1 a 2 horas solo", "voy a ausentarme una horas mas aproximadamente entre 4 a 8 horas",
  "te dejo solo 3 horas ahora nos vemos", "Te voy a dejar unas horas aproximadamente 4 horas solo, te respondo las
  preguntas despues", "continua solo unas 3 horas", "Listo, entonces continua unas 10 horas solo por que me voy a
  acostar a dormir", "me voy a ir a dormir unas horas", "Voy a descansar unas horas", "Sigue solo voy a dormir",
  "ok listo ahora si quedas solo", "Ok entonces me ire a bañar y ya regreso por favor avanza"; returns — "ya llegue",
  "Listo ya llegue", "Listo ya regrese", "ya regrese". Near misses that are no departure: "si te digo que me voy a
  ausentar 8 horas, que me vas a mostrar?", "cuando vuelva y te diga que ya volvi", "contando con que yo te dejo solo
  y tu trabajas autonomamente", "por favor sigue trabajando osea no pares, solo para si es una decision", "ya
  regreso" (he will be right back, not back).
- L4 (2026-10-31, design): his newest message that says he leaves or is back decides, not only his newest message:
  after "te voy a dejar solo unas horas" he wrote "listo entonces quedas solo..." and after "ya llegue" he goes on
  writing. A departure holds until a return, or until a message of his comes after a gap longer than the return
  check's `ABSENCE_MS` (he came back without saying it, as on 2026-10-30 at 13:17Z); then nothing is asked. The
  return asks to close only the stretch opened before he said he was back: a stretch opened for planned work while
  he is here is no absence's. It turns back every stop until the stretch is opened or closed (the brief's "until it
  is closed"); the host's `stop_hook_active` lets the next stop of the same turn through, so it never loops.
- L5 (2026-10-31, T1 evidence): red before the module, `node --test bin/lib/away-stretch.test.mjs` failed with
  `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...\bin\lib\away-stretch.mjs'`; green after, 15 of 15, the four
  planted cases first. `node --test bin/reply.test.mjs bin/lib/person-times.test.mjs bin/lib/return-report.test.mjs`
  50 of 50, with the hook's case (a departure, one with a stretch open, a return with it open, a work session, a
  stretch record that cannot be read). `bin/lib/manifest.test.mjs bin/stretch.test.mjs bin/lib/stretch.test.mjs` 278
  of 278 after the record's reader moved (`RECORD_SCHEMA`, `stretchFile`, `eventsOf`, `openEvent` in
  `bin/lib/stretch.mjs`; `bin/stretch.mjs` re-exports the first two). His words come from `personMessagesIn`
  (`bin/lib/person-times.mjs`), `quoteOf`'s rule with the text kept; `personTimesIn` is now its times, and the parse
  of a stop is kept for the same text, so the return and departure checks parse his words once.
- L6 (2026-10-31, T2, false positives, replayed read-only over the lead's real transcripts at each stop the host
  recorded, `stop_hook_summary`, against the real stretch record as it stood at that stop): 0f71b2c6 (2026-10-27 to
  2026-10-31, 174 of his messages, 542 stops): 242 stops would have been turned back, from 11 departures; 908805db
  (2026-10-19 to 2026-10-26, 194 messages, 603 stops): 300 stops, from 9 departures; 77a27016 (2026-10-06 to
  2026-10-09, 340 stops): none. Each of the 20 messages read whole: every one is a real departure, so no false
  positive by message. Sample: "Listo entonces desde ya te dejo solo" (2026-10-30 18:54Z, 43 stops: a third miss, no
  stretch until his return at 01:33Z), "continua solo unas 3 horas" (2026-10-29 10:36Z, 31 stops, the record's gap of
  `stretch-not-opened`'s first sighting), "voy a dejarte entre 1 a 2 horas solo" (17 stops) and "voy a ausentarme ..."
  (16 stops), the brief's two; three of 908805db's begin with the host's `<system-reminder>` blocks and end with his
  words ("listo quedas trabajando solo voy a dormir"). Debatable, one: "Ok entonces me ire a bañar y ya regreso por
  favor avanza" (2026-10-31 01:54Z, 9 stops), a short absence the rule's words still cover. The stops before
  2026-10-29 (118 of 0f71b2c6's, all of 908805db's) came before `js-harness stretch` existed, so they count what the
  rule asks today, not what the lead could do then. The count is of stops in the old run; with the check, the first
  turn-back opens the stretch, so the expected cost is about one turned-back stop a departure. Returns: none turned
  back, since every stretch opened was closed at his return. Not measured: departures in words outside the patterns
  (the search for them was the keyword `grep` of L3, so a departure in other words is not known); "si te dejo solo,
  ..." at a clause's start is read as a departure, since "si" there cannot be told from "sí" without an accent.
- L7 (2026-10-31, T2, the cost per stop, one run each, Windows): on the real lead transcript (60 MB) the module loads
  in 21 to 29 ms; the check alone, parsing his words and reading the record, 120 to 137 ms; after the return check,
  which leaves the parse of his words, 6 to 9 ms. `bin/reply-budget.test.mjs`, its lead fixture now with a stretch
  record of 801 events and the stretch of his absence open, so the check reads his words and the whole record and
  warns: lead's stop p90 620 ms (runs 617 597 604 648 606 620 607 595 606 620), work session's p90 561 ms, budget
  2500 ms. WSL: the worktree guard refuses `wsl` here, as it did for PR 736 (`odd/tasks/refresh-open-apply.md`, L10);
  this project's gate sends a commit's tests to GitHub's Linux machines (`.github/workflows/gate.yml`), so the other
  system measured is Linux there, not WSL: run 41198906620, lead's stop p90 741 ms (runs 705 708 699 717 722 741 742
  725 734 738), work session's p90 656 ms, budget 2500 ms. Not measured: WSL itself.
- L7b (2026-10-31): that first commit's gate failed on three tests of `bin/rules-coverage.test.mjs`, all one finding:
  "skill: 1 owed span edited in place since the register was written", the reply hook's line of
  `bin/lib/manifest.mjs` this change adds a sentence to. Read, then fixed as the finding says:
  `node bin/js-harness.mjs rules coverage --refresh` ("1 stale line settled", one hash in
  `bin/lib/rules-coverage-data.mjs`); `node --test bin/rules-coverage.test.mjs` 8 of 8. Every other test passed.
- L8 (2026-10-31, T3): `stretch-not-opened` holds two more sightings, the five parts in the 2026-10-31 one, and its
  control is now the check (`node bin/js-harness.mjs failures check`: PASS, 131 failures, 306 sightings). Row 45 of
  `odd/tasks/lead-duty-checks.md` names it. Not changed: `bin/lib/rules-coverage-data.mjs` keeps `away-autonomy` at
  the level `line`; raising it to `check` needs a break `rules check` runs, a follow-up for the lead.

## Next step
T4: commit T1 to T3, then gentle-ai's review of the code commit, Codex and the lenses, the independent verifier, and
`npm run check`.

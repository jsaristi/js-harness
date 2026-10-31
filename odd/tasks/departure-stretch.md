# JH 123 · quiet --wait and reply --hook: an absence with no stretch is turned back

Locator: `odd/tasks/departure-stretch.md` · Engram mirror: `odd/departure-stretch/tasks` · Branch: `worktree-departure-stretch`
Delivery: one pull request to main · Test runner: `node --test`

## Goal
The wait the lead runs while he is away, `js-harness quiet --wait`, refuses with no stretch open unless
`--no-stretch <reason>` says why; and the lead's stop (`js-harness reply --hook`) is turned back once a return after
an absence no stretch covered, or whose stretch is still open, naming `stretch close` or the `stretch-not-opened`
sighting. Neither reads his words.

## Why
`rule:away-autonomy` asks for a stretch before he leaves and its return when he is back, and only prose carried it.
He left twice on 2026-10-31 (03:23:57Z and 07:41:17Z) and the lead opened none, though it saw both departures and
started `quiet --wait` each time (L10), so on his return the status report said "ningún tramo desde el corte" and he
got no estimate against actual and no route map: "el como vamos le faltan varias cosas como el mapa de donde vamos,
tambien de lo que estimabamos avanzar y lo que realmente avanzamos". The wait is the one step every departure
already takes; the return is the one moment every absence ends with.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/departure-stretch.md` exits 0
- `node --test bin/quiet.test.mjs bin/lib/return-report.test.mjs bin/reply.test.mjs bin/stretch.test.mjs bin/lib/stretch.test.mjs` exits 0
- `node --test bin/report.test.mjs bin/lib/report-status.test.mjs bin/lib/report.test.mjs bin/lib/channel.test.mjs` exits 0
- the new cases of `bin/quiet.test.mjs` and `bin/lib/return-report.test.mjs` failed before the code existed and pass
  after it, both runs quoted in `## Log`
- the cost per stop is measured and the Stop hook's budget tests (`bin/reply-budget.test.mjs`) pass on Windows and on
  a second system, both quoted in `## Log`
- `node bin/js-harness.mjs failures check` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- the pull request is merged into main, named in `## Log`, with Codex and the Claude lenses recorded over its code

## In scope / Out of scope
- In: `bin/quiet.mjs` and its test (1a), `bin/lib/return-report.mjs` and its test (1b), `bin/lib/stretch.mjs` and
  `bin/stretch.mjs` (the record's reader moves to the light module), `bin/reply.mjs` and its tests (the wiring),
  `bin/lib/report-status.mjs`, `bin/report.mjs` and their tests (spec 8's map), `bin/lib/manifest.mjs` (the hook's
  line), `bin/lib/rules-coverage-data.mjs` (its refresh), `docs/FAILURES.md`, `odd/tasks/lead-duty-checks.md` (row 45),
  `docs/sessions/`; the removal of `818b1eeb`'s detector (`bin/lib/away-stretch.mjs`, `bin/lib/person-times.mjs`).
- Out: `~/.claude`, `~/.codex`, credentials, gentle-ai config; the stretch's own pages and measures; spec 10's draft
  plan, the next task if it does not fit.

## Constraints
- His words are not read: the wait and the return need no departure in them — because a detector fitted to the
  messages it was measured on has no known error rate (L11).
- The record is parsed by the one parser `js-harness stretch status` uses (`eventsOf`, and `openEvent` for the open
  one, in `bin/lib/stretch.mjs`) — because a second parse could call open what `status` calls closed. The return
  check pairs each open with its close by id over the same events, since an absence may lie before the last open.
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
7. The lead, 2026-10-31 ~12:20Z, the readers' findings it checked (L10), which replace specs 2 and 3's detection:
   "a. PRIMARY signal, deterministic: `js-harness quiet --wait` (run only while he is away: manifest duty, row 32 of
   lead-duty-checks) refuses while `stretch status` exits 1, unless `--no-stretch <reason>`."
8. The lead, the same message: "b. Wording-free backstop: extend `bin/lib/return-report.mjs` (its 2 h gap,
   `ABSENCE_MS`) so a return after a gap with no stretch, or with one still open, is turned back ONCE per return, as
   its sibling checks are, and records a sighting under the existing class `stretch-not-opened`
   (docs/FAILURES.md:1629), whose control moves from protocol to check." The hook writes no repo file, so the
   sighting is asked of the lead by the warning, which names the class.
9. The lead, the same message: "2. His complaint was the report, not my nagging: ... Add `planSections` of the plans
   (before/now) to the status report's map section, and give each proposal in the report notes an estimate that the
   next report compares with what happened. List each item of his complaint in Specs with its source, and say what a
   late-opened stretch cannot show (the departure forecast)." His complaint (spec 1's source), item by item:
   - "el mapa de donde vamos": the plan's steps as a chain, before and now, which only stretch and phase pages drew
     (`bin/lib/stretch-render.mjs:213`, `bin/lib/report-phase.mjs:65`); this task draws it on the status report.
   - "lo que estimabamos avanzar": the forecast a stretch makes at its opening (`stretch open`, the plan's estimate
     and the map at that commit). A stretch opened late cannot show it: the forecast is made when it opens, so the
     work done before has none. The proposals' estimates in the report's notes are the second estimate.
   - "lo que realmente avanzamos": the stretch's hours and goals at its return, and the next report setting each
     proposal's estimate beside what landed since.
   - "osea faltan varias cosas": no more items named; nothing else is read into it.
10. The lead, the same message: "3. Make the duty cheap, since its cost is why it was skipped: `stretch open --draft`
    (or the nearest existing way: search first) that builds a plan from the open sessions, the queue and the
    roadmap for the lead to edit. If that is too large for this feature, write it as the next task, not built here."
11. The lead, the same message: "4. Fix your document's title: the check lives in `reply --hook` (bin/reply.mjs), not
    `guard --stop`. 5. JH 124 also touches `bin/lib/rules-coverage-data.mjs` and the manifest: you land first; tell
    me when you are ready."

## Tasks
- [x] T1 (kind: build) spec 2, 3: the free-text check, tests first — commits: `818b1eeb`; dropped by spec 7 (L11)
- [x] T2 (kind: verify) spec 4: false positives over the real transcript and the hook's budget on both systems — commits: this document's
- [x] T3 (kind: docs) spec 5, 8: the `- Seen:` lines, the control and row 45 of the duties, for 1a and 1b — commits: `4d5e7605`
- [x] T6 (kind: build) spec 7: `quiet --wait` refuses with no stretch open, tests first — commits: `4d5e7605`
- [x] T7 (kind: build) spec 8: the return's stretch warning, tests first, budget measured — commits: `4d5e7605`
- [ ] T8 (kind: build) spec 9: the step chain on the status report's map, tests first — commits: pending
- [ ] T9 (kind: build) spec 9: each proposal's estimate, compared by the next report — commits: pending
- [x] T10 (kind: docs) spec 10: the search for a draft plan; not built, written as the next task (L18) — commits: this document's
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

- L9 (2026-10-31, ~12:10Z): T1 to T3 committed as `818b1eeb` (the gate's second run passed). gentle-ai's review of
  `6bee9e5b..818b1eeb` started, its consent run as `granted` (lineage `review-0808781f6b772e62`, state reviewing, four
  lenses, the lens contexts emitted to the job's scratch); no reviewer launched yet. Then the lead (JH ORQ, by
  message): "he asked for a deep second review of your brief; two blind read-only readers are attacking it now. Keep
  reading and designing, but push nothing and open no PR until I send you their findings (they may change the signal
  or the approach)." So the paid reviews (gentle-ai's four lenses, Codex, the four Claude lenses, the verifier) wait
  for those findings too: run now, a change of approach would pay them twice.

- L10 (2026-10-31, ~12:20Z, the readers' findings, reader A and reader B, two blind read-only readers of the brief,
  checked and sent by the lead): (1) the root cause is not detection: the lead saw both departures and wrote them
  (relief file line 2050, "LEAD 03:25Z ... He leaves for 1-2 h ... quiet --wait started", and line 2068, "LEAD 07:43Z
  ... HE LEAVES 4-8 h"; checked here, both read) and skipped `stretch open` because it needs a hand-written JSON plan.
  (1a) Primary signal: `js-harness quiet --wait`, run only while he is away (row 32 of the duties), refuses while
  `stretch status` exits 1, unless `--no-stretch <reason>`; it costs no stop time. (1b) Wording-free backstop: the
  return check (`bin/lib/return-report.mjs`, its 2 h gap) turns back once a return after a gap with no stretch, or
  with one still open, and `stretch-not-opened`'s control moves from protocol to check. (1c) The free-text detector
  of `818b1eeb`: reader A, "18 patterns fitted to the same 20 messages", and its replay "would turn back 242 and 300
  stops when every stop is checked"; dropped unless a labelled holdout it was not fitted to shows both error rates.
  (2) His complaint was the report: the step chain is drawn only on stretch pages (`bin/lib/stretch-render.mjs:213`,
  `planSections`); `bin/lib/report-status.mjs` has none; add `planSections` (before and now) to the status report's
  map, and give each proposal in the report's notes an estimate the next report compares with what happened. (3) Make
  the duty cheap: `stretch open --draft` (or the nearest existing way) building a plan from the open sessions, the
  queue and the roadmap; if too large, the next task. (4) The title: the check lives in `reply --hook`. (5) JH 124
  also touches `bin/lib/rules-coverage-data.mjs` and the manifest; this branch lands first and tells the lead when
  ready. Then the reviews on the new slices only.
- L11 (2026-10-31, the detector): dropped. No holdout exists that it was not fitted to: the patterns were written from
  the same 20 messages the replay counted (L3, L6), so its error rates are not known, and 1a and 1b catch both of
  today's misses without reading his words. The reader move of the stretch record (`bin/lib/stretch.mjs`) stays: the
  backstop and `quiet` read the open stretch by it.

- L12 (2026-10-31, state at the context pause, 86 %): uncommitted on top of `818b1eeb`: the detector removed
  (`git rm` of `bin/lib/away-stretch*.mjs`, `bin/lib/person-times*.mjs` restored from `6bee9e5b`); 1b built test
  first in `bin/lib/return-report.mjs` (`returnStretchWarning`, `NO_STRETCH_MARKER`, `OPEN_STRETCH_MARKER`; red:
  "does not provide an export named 'NO_STRETCH_MARKER'", green 23 of 23), wired in `bin/reply.mjs`
  (`returnStretchOf`), its hook case in `bin/reply.test.mjs` and the budget's marker in `bin/reply-budget.test.mjs`
  (neither run yet). Still to do: the manifest's sentence (line 63) rewritten for 1b and `rules coverage --refresh`;
  1a in `bin/quiet.mjs` (`--wait` refuses with no open stretch, `--no-stretch <reason>`; read with `openEvent` and
  `stretchFile` of `bin/lib/stretch.mjs`, project by `mainCheckout(run, cwd)`), tests first in `bin/quiet.test.mjs`
  (helpers `withWorld`, `quiet(world, argv)`, home `world.home`); then the title, Specs and Tasks for L10, the
  FAILURES control naming the return test, then 2 (`planSections` in `bin/lib/report-status.mjs`) and 3 as the next
  task.

- L13 (2026-10-31, 88 %): 1a's tests written in `bin/quiet.test.mjs` (the world seeds an open stretch at
  `world.stretches`; three new tests: refusal exit 4 with no stretch or a closed one, `--no-stretch <reason>` waits
  and prints "no stretch open: <reason>", an unreadable record refuses saying "stretch record ... cannot be read");
  red: 3 of 21 fail, the 18 old ones pass.

- L14 (2026-10-31): 1a built in `bin/quiet.mjs` (`--no-stretch`, exit 4, USAGE lines); `node --test
  bin/quiet.test.mjs bin/lib/return-report.test.mjs bin/reply.test.mjs` 75 of 75. Uncommitted.

- L15 (2026-10-31): the manifest's reply-hook sentence now says 1b; `rules coverage --refresh` settled one line;
  `bin/rules-coverage.test.mjs bin/lib/manifest.test.mjs` 222 of 222. `bin/reply-budget.test.mjs` on Windows with
  1b warning: lead p90 905 ms (905 953 803 785 762 757 752 751 796 854), work p90 775 ms, budget 2500, 4 of 4.

- L16 (2026-10-31, ~14:20Z): the host compacted this session at about 12:25Z, after L15 and the Next step were
  written; nothing of 1a or 1b was committed before it. The notice wait (`js-harness wait --notice-to 123`) was
  stopped by the host for low memory and is not restarted. The title, the goal, the scope and specs 7 to 11 now say
  the readers' approach, quoting the lead's message as written; the sighting of 2026-10-31 and the control of
  `stretch-not-opened` in `docs/FAILURES.md` and row 45 name 1a and 1b. The hook writes no repo file, so 1b asks the
  lead for the sighting rather than writing it (spec 8). `failures check` PASS (131 failures, 306 sightings),
  `contract check` PASS, `rules check` PASS (71 rules).

- L17 (2026-10-31, T3, T6, T7): committed as `4d5e7605`, the gate passed ("PASS check 17 rows passed").
- L18 (2026-10-31, T8, T9, T10): T8, the step chain: red, "section 4 draws each plan step by step ..." 1 of 11
  failed; green 11 of 11. `renderStatus` takes `steps` (`comparePlans` at the cut and now, or `{ unavailable }`) and
  draws `planSections` after the migration's share, before the stretch; `bin/report.mjs` reads both moments with
  `momentAt` only for `--html`, since it shows every task document a step names. The command's case (the F8 page's
  S0 `igual`, S13 `avanzó`) was written after the wiring and not seen red. T9, the estimates: red 3 of 94 (`newReport`
  keeps proposals, `cutOf` carries them, section 6), green 94 of 94; a proposal's `estimate` is optional, a blank one
  refused, one left out shown "sin estimación"; `--mark` records each proposal's step and estimate in its report
  line, an optional field the record's readers ignore (`isReport` checks only `schema` and `at`); the next page sets
  them, under "Lo que propuse el ...", beside what landed since, and whether each was done is his to read from both:
  no record says it. The command's case, 18 of 18, also after the wiring. Not changed: item 6 of the manifest's
  report ("each step with its why") is a rule's text (`bin/lib/rules-data.mjs:646`), so asking the lead there for
  the estimate is a `rules change` for the lead. T10, searched: `stretch`'s options (`--plan`, `--html`, `--goals`,
  `--json`, ...) hold no draft, `grep -rln draft bin` finds no plan builder, and `parsePlan` needs goals with
  commands and items with hours, which no record holds. Not built: the next task, for the lead to place —
  `stretch open --draft <file>` writing a plan to edit from the open sessions (`claude agents --json --all`), the
  queue (the background record) and the roadmap's next step not done, its goals the open pull requests' `gh pr
  checks`.

- L19 (2026-10-31, T4): T8 and T9 committed as `8be755d2` (gate PASS). Codex's review of `6bee9e5..8be755d`, 2
  parts, 311,437 input tokens in 76 s, recorded: part 1 correct (0.87); part 2, P2 at `bin/report.mjs:188`, "When
  `momentAt` cannot list or read a task document ... `--mark --html` records this incomplete report and exits
  successfully, advancing the next report's cut past facts this page never showed." Accepted: the steps are now read
  before the failure decision and count in it. Red first, "--mark --html with plan steps git cannot read says so and
  records nothing" (actual 0, expected 1); green, `bin/report.test.mjs bin/lib/report-status.test.mjs` 31 of 31.
  gentle-ai's start for `8be755d2` reached its consent envelope (lineage `review-015c4548afc4f7fc`); not granted,
  since this fix moves the head its target names.

## Next step
Commit the P2 fix through the gate; then the reviews of `6bee9e5b..HEAD` (gentle-ai's contract run, then
`js-harness codex-review --base 6bee9e5b` and `js-harness lens-review --base 6bee9e5b`, then the verifier), push, PR,
the ready notice and the lead told; the summary under `docs/sessions/`.

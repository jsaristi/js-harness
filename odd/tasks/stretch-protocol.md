# stretch-protocol

Branch `feat/stretch`, from main (79e34308), then `rule/away-autonomy-stretch` stacked on it for the rule
change. Runner: `node --test`. Session JH 71.

## Goal
A stretch of work (his absence or any other) opens with a plan the harness measures: what will run, the hours it
should take, whether it fills the time, and goals that are commands; the live board follows it while it runs; and it
closes with the goals checked and the time each piece of work took and lost against its estimate, read from the
records, so the next estimate is corrected by what the last ones missed.

## Why
His words of 2026-10-28 to the lead (session 0f71b2c6-cbce-43ca-a031-276a4b2c381f, lines 8017, 8139, 8213, 8264,
8296), quoted under Specs and checked with `js-harness sessions --quote`. His answer to question 103 (line 8326,
"Próximo cupo") opened it as a feature of its own beside F8. Today an absence starts with a plan written by hand and
ends with a report written by hand: nothing checks the goals, nothing measures the time against the estimate, and
the next estimate learns nothing.

## Done when
- `npm run check` exits 0
- `node --test bin/stretch.test.mjs bin/lib/stretch.test.mjs bin/lib/stretch-render.test.mjs bin/sessions-live.test.mjs` exits 0
- `node bin/js-harness.mjs stretch --help` exits 0
- `node bin/js-harness.mjs rules away-autonomy --json` prints his words of 2026-10-28 among its quotes (on the rule branch)
- A stretch opened, checked and closed on this machine over a real stretch, its departure and return renders shown

## In scope / Out of scope
- In: `bin/stretch.mjs`, `bin/lib/stretch*.mjs`, the dispatcher and command index, `bin/sessions-live.mjs` and
  `docs/live-board.html` (the open stretch on the board), `bin/throughput.mjs` and `bin/lib/throughput*.mjs` only to
  reuse their readers, the rule change through `js-harness rules change away-autonomy` (`bin/lib/manifest.mjs`,
  `bin/lib/rules-data.mjs`, `docs/RULES.md`, `docs/rule-sources.json`), their tests, this document, one ROADMAP line.
- Out: JH 68's files (F8 S11, the `bin/` stack and install) and JH 69's; the orchestrator's own notes; any new
  recorder: the stretch reads the records that exist and says what they do not hold.

## Constraints
- A goal is a command that exits 0, as a task contract's done-when is: no goal is graded by the session that ran it.
- Failure time is read from the records (the gate log, the Codex runs, the land record), never estimated; what no
  record holds is named as not measured.
- The renders come from the command's JSON, so the departure and the return show the same numbers the record keeps.
- Zero dependencies; the stretch record lives under the throughput folder, which `uninstall` keeps and names.

## Ask me before
Nothing beyond the standing rules: the design passes two blind readers before it reaches him (rule:double-review),
and his words already decide the feature.

## Specs
1. Before he leaves, say what will run, the approximate hours, and whether the queued work fills his absence: "me
   digas antes de irme que es todo lo que s eva a hacer cuantas horas aproximadamente se va a utilizar y me dices
   cuanto tiempo vas a aestar trabajando o queda de trabajo para ver si las horas que me voy van a estar todas ya en
   cola de trabajo" (line 8017).
2. Show it always as a visual in the chat: "Me lo puedes mostrar un con artefacto dentro del chat bien visual
   siempre" (line 8139).
3. State the goals for that time, and on "ya volví" check them in the chat: "me digas la meta que se va a tener para
   dentro de las 8 horas para que cuando vuelva y te diga que ya volvi y me muestres lo que hemos avanzado, me
   muestres un artefacto en el chat donde me checkes lo que se hizo y lo que no y miramos si se cumplieron las metas"
   (line 8213).
4. Show the time taken and what failed as bars, spent and lost, against the estimates: "muestrame asi como la
   visualizacion de salida el tiempo que se demoro y lo que fallo y el tiempo en barra de cuanto se gasto y fallo asi
   como me mostraste la primera visualizacion e incluso en comparativa con los tiempos estimados" (line 8264).
5. Make it a harness protocol that measures the workflow in real time: "quiero que volvamos esto un protocolo del
   arnes y que nos sirva para ir miediendo en tiempo real nuestro flujo de trabajo" (line 8296).

## Design

### The command
`js-harness stretch`, one command with four verbs, each with `--json`, and `--html <file>` on the three that render.

- `open --plan <file>`: the lead writes the plan as JSON and the command checks it, records it and prints the
  departure. The plan: `hours` (the stretch's length), `slots` (work sessions at once), `goals` (each `{ id, text,
  command }`), `items` (each `{ id, title, kind, hours: [low, high], session? }`, `kind` one of the task contract's
  kinds: design, build, verify, docs; `session` the session's label, such as `JH 71`, once it has one), and `waits`
  (what only he can give, said as fact). Refused, exit 1, while another stretch of the project is open, and for a
  plan that does not hold that shape (exit 2).
- `bind <item> <session>`: names the session a queued item got once it started (the lead numbers a session when it
  opens it, so a queued item has none at departure).
- `status`: the open stretch now. Runs each goal's command (as `contract run` does, through a shell in the project
  root, with `rule:contract-run-timeout`) and records the result; measures each item so far.
- `close`: the same as `status`, then records the stretch closed with each item's estimate, real time and lost time,
  and prints the return. Exit 0 whether or not the goals were met: the record and the render say which.

### The departure (spec 1)
Each item's estimate is shown twice: as written and as corrected by the history of its kind (below). The items are
laid in `slots` lanes in the plan's order, each item to the lane that frees first, by its low and its high corrected
estimate. The work fills the stretch when no lane runs out before `hours` by the low estimate; otherwise the
departure says how many session-hours sit idle before he returns, and from which hour. The total queued, the return
time (local and UTC), the goals and the waits complete it.

### Measuring (specs 4 and 5)
A session is found by its label at the head of a title: the background start record
(`<home>/.js-harness/background/sessions.jsonl`, event `started`) and the notices of the channel record whose
`from.title` begins with it. An item runs from the later of the stretch's opening and the session's first record to
the session's `closed` notice, or to now while it has none. Its real time is that span. Its lost time is what the
records hold as failed inside that span, attributed to the session by its session ids (the notices' `from.id`, the
background record's `sessionId`) or by the worktree its notices name:

- a gate whose end is not a pass (`fail`, `exit` not 0) in the gate log: its seconds;
- the stretch, not an item, carries the failed lands (`exit` not 0 in `lands.jsonl`) and the Codex runs whose
  outcome is `failed`, since neither record names a session.

What no record holds (a rewrite after a review, a wait for an answer, a session stuck without a notice) is not
measured, and the return says so in one line instead of guessing it.

### What the next estimate learns (the history)
`close` stores each finished item as `{ kind, estimate: [low, high], realHours, lostHours }`. An item not finished
at close is stored as unfinished and teaches nothing. The correction of a kind is the median of real over the
estimate's middle among its last 10 finished items, used from 3 of them on; with fewer the estimate stands as
written and the departure says there is no history yet.

### The record
One JSON line an event in `<home>/.js-harness/throughput/<project>/stretches.jsonl`: `open` (the plan, the
corrections used), `bind`, `check` (each goal's result and the time), `close` (the items measured). Append only. It
sits beside the throughput days, so `uninstall` keeps it and names it with them.

### The renders (specs 2, 3 and 4)
`--html <file>` writes the view of the JSON as one self-contained HTML fragment in Spanish, the shape of the lead's
renders he liked (`antes_de_irte_8_horas`, `ejemplo_ya_volvi_metas`, `ejemplo_ya_volvi_tiempos`): the departure as
lanes on an hour scale with the return marked; the return as the goals each met or not with its command's result,
then per item an estimate bar against a real bar whose lost part is red, on one scale, with the totals and the
failures listed. The lead shows that file in the chat as it is; it never draws the numbers by hand.

### The live board (spec 5)
`sessions live --out` puts the open stretch into `board-checked.json`, which the board merges into `board/summary`:
the elapsed and remaining hours, the goals met at the last check, each item's state and real against estimated hours.
It reads the record and runs no goal command; the lead runs `stretch status` on its heartbeat before it. The page
(`docs/live-board.html`) shows that block while a stretch is open.

### The rule
`rule:away-autonomy` gains his two additions through `js-harness rules change away-autonomy` on
`rule/away-autonomy-stretch`, quoting his words of 2026-10-28: before he leaves, the departure render with its goals
in that reply; when he says he is back, `stretch close` and the return render before anything else. The stretch
itself is not limited to an absence: the skill text names it for any stretch.

## Tasks
- [ ] T1 (kind: design) this document, read by two blind readers, one Claude and one Codex (rule:double-review). Route: inline, readers delegated.
- [ ] T2 (kind: build) the measure and the history, pure: lanes, corrections, item spans and lost time (`bin/lib/stretch.mjs`), test first. Spec 1, 4, 5. Route: inline.
- [ ] T3 (kind: build) the command and its record: `open`, `bind`, `status`, `close`, the dispatcher and index (`bin/stretch.mjs`). Spec 1, 3, 5. Route: inline.
- [ ] T4 (kind: build) the renders (`bin/lib/stretch-render.mjs`). Spec 2, 3, 4. Route: inline.
- [ ] T5 (kind: build) the open stretch on the live board (`bin/sessions-live.mjs`, `docs/live-board.html`). Spec 5. Route: inline.
- [ ] T6 (kind: build) the rule change, on `rule/away-autonomy-stretch`. Spec 1, 3. Route: inline.
- [ ] T7 (kind: verify) a real stretch opened, checked and closed on this machine; reviews (Codex and the Claude lenses) on each slice. Route: inline.

## Log
- L1. 2026-10-28, the lead's brief for JH 71: his decision in question 103 ("Próximo cupo", line 8326), his words
  over four messages, the lead's design (build on throughput and its records; a goal is a command that exits 0; each
  closed stretch stores estimate and real by kind and the next estimates use it; failure time measured from the
  records; any stretch, not only absences; the live board shows the open stretch; the renders come from the command's
  JSON), and the change to rule:away-autonomy.
- L2. 2026-10-28, his words read with `js-harness sessions --quote` at lines 8017, 8119, 8139, 8213, 8239, 8264,
  8296 and 8326; the brief's list of four messages left out 8139 ("bien visual siempre") and 8264 (the bars), both
  quoted under Specs. The lead's three renders were read from the transcript (lines 8160, 8244, 8269).
- L3. 2026-10-28, searched before adding: `throughput` (day table, snapshots; its readers of the gate log, lands and
  Codex runs are reused), `report --mark` (facts since the last report, no estimates), `progress --pace` (tasks
  closed a day, no hours), `sessions live` (the board's rows and `board/summary`), `contract run` (runs commands that
  exit 0: its runner is reused for goals). None holds a plan, an estimate or a goal for a stretch.

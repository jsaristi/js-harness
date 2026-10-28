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
- `node bin/js-harness.mjs rules away-autonomy` prints his words of 2026-10-28 among its quotes (on the rule branch)
- A stretch opened, checked and closed on this machine over a real stretch, its departure and return renders shown (by hand)

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
  command }`), `items` (each `{ id, title, kind, hours: [low, high], session?, waitsFor? }`), and `waits` (what only
  he can give, said as fact). An item is one session's work: `kind` is one of the task contract's kinds (design,
  build, verify, docs) for what that session mostly does; `hours` is the work left at the opening, so a session
  already running is planned by what remains; `session` is its label, such as `JH 71`, once it has one, and no two
  items name the same session; `waitsFor` names what of his it cannot start without. Refused, exit 1, while another
  stretch of the project is open (`close` ends any stretch, a forgotten one too), and exit 2 for a plan that does
  not hold that shape.
- `bind <item> <session>`: names the session a queued item got once it started (the lead numbers a session when it
  opens it, so a queued item has none at departure). Refused for a session another item holds.
- `status`: the open stretch now, measured from the records; with `--goals` it also runs each goal's command (as
  `contract run` does, through a shell in the main checkout, one at a time, with `rule:contract-run-timeout`) and
  records the result. A goal is a cheap read (git, `gh`), never a gate: the gate takes the lock the work sessions
  need.
- `close`: runs the goals, measures, records the stretch closed with each item's estimate, real time and lost time,
  and prints the return. Exit 0 whether or not the goals were met: the record and the render say which.

### The departure (spec 1)
Each item's estimate is shown twice: as written and as corrected by the history (below). The items are laid in
`slots` lanes in the plan's order, each to the lane that frees first by the middle of its corrected estimate; that
one layout is drawn by both its low and its high ends. An item that waits for him takes no lane: it cannot run while
he is away, and the departure lists it under what waits for him. The work fills the stretch when no lane runs out
before `hours` by the low estimate; otherwise the departure says how many session-hours sit idle before he returns,
and from which hour. The total queued, the return time (local and UTC), the goals and the waits complete it.

### Measuring (specs 4 and 5)
A session is found by its label at the head of a title, a longer number being another session (`JH 7` is not
`JH 71`): the background start record (`<home>/.js-harness/background/sessions.jsonl`, event `started`, and its
`removed`) and the notices of the channel record whose `from.title` begins with it. Its worktrees are the `cwd` of
its notices other than the main checkout; the background record's `worktreePath` is the main checkout and is not
read. An item runs from the later of the stretch's opening and the session's first record (marked `clipped` when the
session started before) to:

- its first `closed` notice after that (`finished`); a session that closes and goes on is done at its first;
- else its `removed` line in the background record (`stopped`);
- else, when its last record (a notice, its start, a gate of its own) is older than `rule:session-stall`, that record
  (`silent`): nothing says it worked after it, and silence is never counted as work;
- else now (`running`).

Its real time is that span. Its lost time is what the gate log holds as failed (an end that is not `pass` or
`exit 0`) and overlaps the span, the part inside it, attributed by the gate's `session` id or by a worktree of the
session. A gate run under another's lock (`lock: parent`, the check inside a `gate --`) is folded into the one around
it: its failing tests are named there and its time counts once; two failures at once count once. A gate in a
merge-queue folder is the lead's land and never an item's. The stretch, not an item, carries the lands that did not
exit 0 (`lands.jsonl`, whose `session` is the lead's), the failed gates of its lands (a land that bisects and lands
passes over them) and the Codex runs whose outcome is `failed` (their `session` is a mode, not a session id), each
cut to the stretch.

What the records do not hold is named in the return as not measured, apart from what is unavailable (a record that
cannot be read, said with why): a rewrite after a review, a wait for his answer, a session working without a record.

### What the next estimate learns (the history)
`close` stores each item as `{ kind, estimate: [low, high], realHours, lostHours, state, clipped }`, the estimate as
written. An item teaches when it was measured whole (not `clipped`) and either finished or still running already
past its high estimate, which is then a floor of its real time: leaving every unfinished item out would keep the
overruns out and read low. The correction is the median of real over the estimate's middle among the last 10 items
that teach: the kind's own from 3 of them, else all kinds together from 3, else none, said as no history yet.

### The record
One JSON line an event in `<home>/.js-harness/throughput/<project>/stretches.jsonl`: `open` (the plan, the
corrections used), `bind`, `check` (each goal's result and the time), `close` (the items measured). Append only. It
sits beside the throughput days, so `uninstall` keeps it and names it with them.

### The renders (specs 2, 3 and 4)
`--html <file>` writes the view of the JSON as one self-contained HTML fragment in Spanish, the shape of the lead's
renders he liked (`antes_de_irte_8_horas`, `ejemplo_ya_volvi_metas`, `ejemplo_ya_volvi_tiempos`): the departure as
lanes on an hour scale with the return marked; the return as the goals each met or not with its command's result,
then per item an estimate bar against a real bar whose lost part is red, on one scale, with the totals and the
failures listed, and the not-measured line. The lead never draws the numbers by hand: in the desktop app it passes
the file's HTML whole to the in-chat visual tool (`show_widget`, where it drew the three renders he liked); where the
host has none (a Claude Code terminal), it publishes the file as an Artifact and gives the link. `status --html`
renders the open stretch the same way, for "cómo vamos".

### The live board (spec 5)
`sessions live --out` puts the open stretch into `board-checked.json`, which the board merges into `board/summary`:
the elapsed and remaining hours, each item's state and real against estimated hours as of that run, and the goals
met with the time of their last check, a separate time, since goals run only on `status --goals` and `close`. It
reads the record and runs no goal command. The page (`docs/live-board.html`) shows that block while a stretch is
open.

### The rule
`rule:away-autonomy` gains his two additions through `js-harness rules change away-autonomy` on
`rule/away-autonomy-stretch`, quoting his words of 2026-10-28: before he leaves, the departure render with its goals
in that reply; when he says he is back, `stretch close` and the return render before anything else. The stretch
itself is not limited to an absence: the skill text names it for any stretch.

## Tasks
- [x] T1 (kind: design) this document, read by two blind readers, one Claude and one Codex (rule:double-review), in 12e954b6 and the revision after them. Route: inline, readers delegated.
- [x] T2 (kind: build) the measure and the history, pure: lanes, corrections, item spans and lost time (`bin/lib/stretch.mjs`), test first, in 838c9fe1 and the commit after the readers. Spec 1, 4, 5. Route: inline.
- [x] T3 (kind: build) the command and its record: `open`, `bind`, `status`, `close`, the dispatcher and index (`bin/stretch.mjs`), in b1d9f90a. Spec 1, 3, 5. Route: inline.
- [x] T4 (kind: build) the renders (`bin/lib/stretch-render.mjs`), in b1d9f90a. Spec 2, 3, 4. Route: inline.
- [x] T5 (kind: build) the open stretch on the live board (`bin/sessions-live.mjs`, `docs/live-board.html`). Spec 5. Route: inline.
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
- L4. 2026-10-28, double review of the design (rule:double-review), two blind readers given the document and the
  records, not the author's view. Claude, 6/10: blockers, a failure counted twice (the gate log writes a `gate --` and
  the check under its lock, `lock: parent` with no `session`: 146 such starts in the log, checked) and an item's time
  being its whole session's while one session runs several kinds; should-fix, which `closed` notice ends an item (JH
  21 sent six), a dead session running on forever, a correction biased low (clipped items, unfinished overruns left
  out, three a kind rarely reached), running work laid as whole, lands do carry the lead's `session`, merge-queue
  gates unplaced, goals on every heartbeat (a check is 424 s and takes the lock), the root goals run in; nits, the
  label boundary, `worktreePath` is the main checkout, one layout or two, spec 2's delivery unnamed, the last
  done-when line not a command. Codex, 4/10: blockers, silence counted as work, attribution (`landFacts` and
  `gateFacts` drop `session` and `cwd`), loss counted several times, "fills" counting work that waits for him;
  should-fix, the estimate's meaning (work left), failures crossing the stretch's edges, delivery into the chat,
  goal checks' cost, separate freshness times, "not measured" too sweeping. Taken in, all: an item is one session's
  work and two items cannot name one session; the first `closed` after the start ends it, a `removed` line stops it,
  a session with no record past `rule:session-stall` is silent and measured to its last record; nested gates fold
  into the one around them, failures are cut to the span and unioned, land gates and failed lands go to the stretch,
  the gate log read directly (not `gateFacts`) to keep `session` and `cwd`; `waitsFor` keeps an item out of the
  lanes; hours are the work left; history skips clipped items, keeps unfinished overruns as floors, and falls back to
  all kinds together; goals run only on `status --goals` and `close`, as cheap reads in the main checkout, with their
  own check time on the board; delivery named (the in-chat visual tool, else an Artifact); the last done-when line
  marked by hand. Not taken: one global correction instead of by kind (the brief and his request name kinds; the
  fallback covers the thin start); measuring tasks by the commits that close them (more machinery than one session
  per item, which is how this project already runs: one feature a session).

## Next step
State at 2026-10-28 ~16:00Z (JH 71, worktree `D:\js-harness\.claude\worktrees\stretch`, branch `feat/stretch`):
- Done and committed: T1 (12e954b6), T2 (838c9fe1, 765baf9a). T3+T4 staged with docs/SPEC.md "The stretch" entry;
  its commit (message in the job tmp `msg-t3.txt`) was running the gate; check `git log` for
  `feat(stretch): the stretch command, its record and its renders`. If absent, `git commit` again after reading why.
- A real-data dry run: a scratch home with copies of the real records
  (`C:\Users\Oficina\.claude\jobs\3d51cd18\tmp\home1`) measured JH 69/70/68 from 11:55Z coherently.
- T5 next: export `boardStretch({ home, root, slug, now, fileSystem, run })` from `bin/stretch.mjs` (null or a compact
  block: elapsed, goals met with checkedAt, items state/real/corrected, lostHours); `sessions live --out` writes it as
  `stretch` (null when none, so the merge clears it) into `board-checked.json`; update the two deepEquals in
  `bin/sessions-live.test.mjs` (lines ~162 and ~173); `docs/live-board.html` gets a hidden `stretch-box` section
  rendered with `el()`/textContent only.
- T6: `rules change away-autonomy` takes the change as JSON on stdin (`odd/tasks/rule-hierarchy.md` line ~1501,
  `bin/lib/rules-change-run.mjs` changeRule); branch `rule/away-autonomy-stretch` stacked on feat/stretch; quote his
  words of lines 8017, 8139, 8213, 8264 (date 2026-10-28, session 0f71b2c6...). Run `--dry-run` first.
- T7: reviews (`js-harness codex-review --base 79e34308`, `js-harness lens-review --base 79e34308 --lenses <..> --reason
  <..>`), push, PR, `js-harness notify --to orchestrator --kind ready --pr <n>`; keep a declared `js-harness wait`.
- Update ~16:20Z: T3+T4 in b1d9f90a, T5 in 4e6dbdd7. Next: the slice's reviews over 79e34308..4e6dbdd7 (Codex:
  one run, its allowance about 1,200 input tokens a changed line, ~1,000 lines; the Claude lenses: one run of the
  pertinent lenses), their output written to the job tmp (`review-codex.log`, `review-lens.log`), findings taken in;
  then T6 on `rule/away-autonomy-stretch`; then push, PR, notify ready.

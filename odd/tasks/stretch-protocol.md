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

6. Make the departure page say plainly what will advance: "El antes de irte no se ve muy claro en realidad que es lo
   que va a avanzar por favor arreglalo o mejoralo en mi ausencia por que no se entiende" (session
   69918425-3b43-430f-9f50-62b6422422ce, line 7461, 2026-11-14). Done when a cold reader given only the page can say
   what will advance, and that matches the plan; the departure, status and return pages stay consistent; the stretch
   record's format, the measures and the learned estimates do not change.
7. Make a plan section's block (the F8 plan) readable on the return and the departure: "El regreso del tramo donde
   dice F8 plan no lo entiendo bien tiene que organizarlo mejor para que lo pueda entender" (session
   69918425-3b43-430f-9f50-62b6422422ce, line 9989, 2026-11-14). In plain Spanish the block says what the plan is
   (and how its count relates to its phase's in the map), what its steps are, and which steps moved in the stretch
   (forecast on the departure, measured on the return). Done when a cold reader given only the page text of each
   page can say those three things and they match the roadmap; the step count holds every step the roadmap gives a
   state; the stretch record's format, the measures and the learned estimates do not change.
8. Show the stretch's tasks beside the plan's advance, for a stretch and for a longer horizon such as a day: "Excelente
   se ve mucho mejor, osea una cosa es lo que se va a hacer en este tramo y otra cuando te diga por ejemplo que vamos a
   hacer todo el dia y la idea es que me muestre lo de las tareas del tramo como lo que se va a avanzar en el plan"
   (session 69918425-3b43-430f-9f50-62b6422422ce, line 10936, 2026-11-14). "Se ve mucho mejor" is the lead's
   hand-made page https://claude.ai/artifact/EUJsxQcNpLEoqgut5sqmpz: each item's feature tasks as a bar (done before,
   done in the stretch, open). Its own slice and PR, after spec 7's lands; how an item names its feature document
   (an optional plan field, proposed `doc: "odd/tasks/<feature>.md"`) is designed there.
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
- [x] T5 (kind: build) the open stretch on the live board (`bin/sessions-live.mjs`, `docs/live-board.html`). Spec 5. In 4e6dbdd7. Route: inline.
- [x] T6 (kind: build) the rule change, on `rule/away-autonomy-stretch`, in 865ec2e7 (PR 634, stacked on PR 633). Spec 1, 3. Route: inline.
- [ ] T7 (kind: verify) a real stretch opened, checked and closed on this machine; reviews (Codex and the Claude lenses) on each slice. Route: inline.
- [x] T8 (kind: build) the departure, status and return pages made plain (spec 6), on `feat/stretch-departure-clear` from main a20aa337, JH 196. Route: inline. Commits 7550f4ad, 2c29560c (L9).
- [x] T9 (kind: build) the plan block made readable (spec 7), on `feat/stretch-plan-block` from main 0c6c245f, JH 201, test first: the roadmap reader counts a step whose state is dated (`**State (2026-11-11):**`); a phase's left item numbered "2." is summarised by its first sentence, not "2."; the forecast section says what a plan is, its steps grouped by state, and which moved; the step-by-step section shows the steps that changed and groups the rest. Route: inline. Commits 4222ff27, 0c35bded, a6906471 (L11).

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
- L5. 2026-10-28, the slice's reviews. Codex over 12e954b..4fbaa93 (5 parts, 865,957 input tokens): parts 1, 3 and 5
  correct; parts 2 and 4 seven P2 findings, all taken in, test first, in b651463a: background starts and land gates
  kept to the project's root (the background record and the gate log are the machine's); a gate naming another
  session is that session's even in a shared worktree; a gate is a record until it ends; an unreadable Codex runs
  record is said unavailable (the default reader read it as none); a cut last line is ended before an append.
  Codex's recheck of 4fbaa93..b651463 (99,089 input tokens): correct, 0.94, 7 of 7 fixed. The Claude lenses
  (reliability, resilience, readability) over 79e3430..b651463, after the lead refreshed the installed copy to main
  19f2d80: complete, 0 findings, about 142,000 input tokens. Code commits approved by Codex and the lenses: 838c9fe1,
  765baf9a, b1d9f90a, 4e6dbdd7, b651463a. No gentle-ai review ran on this slice.

- L6. 2026-10-28, the rule change. `rules change away-autonomy` refused a branch behind origin/main, so origin/main
  (two commits, `docs/FAILURES.md` only, merge-tree clean) was merged into feat/stretch in 17308fd7 and the rule
  branch made from it. The first commit of the rule failed the gate: `bin/lib/manifest.mjs` grew past its ceiling of
  1,793 lines with three new bullets; the same text went inside the rule's bullet, which is the same moment (the
  reply before he leaves), and the file kept its ceiling. 865ec2e7 reviewed: Codex over 17308fd..865ec2e correct
  (0.88), no findings; the Claude lenses (readability, risk) 0 findings. PR 633 (this feature), PR 634 (the rule,
  based on feat/stretch, retargeted to main once 633 lands).
- L7. 2026-10-28, gentle-ai: `gentle-ai review assess --committed-only` from the branch point rated the feature
  (18 paths, 1,733 lines) medium, under_budget, not due, so gentle-ai was not asked to review. The code commits
  838c9fe1, 765baf9a, b1d9f90a, 4e6dbdd7 and b651463a, gentle-ai not due, are approved by Codex and the lenses (L5).
- L8. 2026-10-28, the rule branch: `gentle-ai review assess --committed-only` from the merge it starts at rated it
  (6 paths, 76 lines) medium, under_budget, not due; 865ec2e7, gentle-ai not due, is approved by Codex and the lenses (L6).
- L9. 2026-11-14, JH 196, T8 (spec 6). The advisor, before code, found the design's first section empty on the real
  plan of that day (named 0, no rows): it would have read as "nothing advances". So each item leads by its title, which
  says what it delivers, and a plan naming no row says once that the shares do not move. `outcome` is no plan field
  (grep of bin/stretch.mjs), so none was added: the record's format is out of scope. Built in 7550f4ad: what will
  advance first; coverage as a sentence with its arithmetic and its condition (idle by the low estimate); hours as
  "X h (estimado Y h, ajustado ×f por lo que tardaron los trabajos de K)" or "sin ajustar: hay menos de 3 trabajos
  medidos" (HISTORY_MIN); the phase table, shared with status and return, only the phases that move, forecast or
  measured, past tense once closed and measured. Phase names stay in English, as the roadmap writes them, said above
  the table: translating them would make the page disagree with the roadmap it counts. Codex (0.93) found a shared
  row's when said as each item's and a "no phase changed" with the map unread; the lenses found the plural for one
  session, unrounded session-hours, "JH 19" taken as named by "JH 196: …", and a stale test name. A cold reader (Opus,
  read-only, only the page text of the real plan and of a copy closing S8) said what advances, item by item, and the
  rows that move and when, matching the plans; four phrases it found unclear were reworded. All fixed in 2c29560c;
  rechecked: Codex 0.98, 2 of 2 fixed; lenses 0 findings, 4 of 4 fixed. Open, the lead's call, out of this scope: the
  cold reader said only JH 196's title says what he gets back ("aterrizado e instalado"); the other three name work,
  not a result, so defect 6 (no item says what he will have) is closed only where the plan's title says it. Closing it
  needs titles written as outcomes or a plan field, and the plan's format is outside spec 6. The English phase names
  stay too (above). The titles also use internal names (T1, pregunta 285). On HEAD: 137 convention and stretch tests
  pass (`js-harness gate --`); the departure from HEAD and the real closed stretch's return (a copy of the throughput
  folder in a scratch home) read consistently. Not fixed, minor: a kind's factor of exactly 1 prints "ajustado ×1".
- L10. 2026-11-14, JH 201, spec 7, the lead's brief (his words read with `js-harness sessions --quote
  69918425-3b43-430f-9f50-62b6422422ce 9989`). The return of stretch 2026-11-14T23:16:33.945Z re-rendered from main
  0c6c245f and read as text, and a departure from a scratch plan closing S8 in a scratch home. What he read: the
  forecast's "F8 plan 68 % al abrir: 13 de 19 pasos / ~68 % al volver, aunque el trabajo se alargue / 68 % ahora",
  three equal numbers that do not say what the plan is or why it is 68 % while the phase table says "F8 Harness
  reorganization 3/7 · 43 %"; then "F8 plan, paso por paso": a chain of 19 ids, a table of 19 rows of "igual", each
  with its whole State paragraph in English (S5c-a's runs about 2,000 characters). Found: (1) the roadmap reader
  (`planOf`, `bin/lib/report-pages.mjs`) takes only `**State:**`, so S5, S6 and S7, written `**State (2026-11-11):**`,
  are no steps: the plan has 22 steps with a state, not 19, and S5 and S6 are done, S7 built (checked by running
  `planOf` over `docs/ROADMAP.md`: 19 ids, no S5, S6, S7); (2) a phase's left item that starts "2. " is summarised as
  "2." (the first-sentence match stops at the number), so the F8 row shows "2.", "4.", "5.", "6." with the whole
  text folded under each (the "repeated rows" of the brief are that fold read as text); (3) S4a, the desktop plan and
  the outside feature open their State with no known word ("the hook done", "PRs 708 ...", "waits for"), so they
  count as not done; that is the roadmap's wording, shown as it is, not rewritten here.
- L11. 2026-11-14, JH 201, T9 built. The advisor, before code: confirm the dropped steps by running `planOf` (done:
  19 ids, no S5, S6, S7), fix the reader in its own commit test first, keep the block generic (no "F8" literal: the
  plan is tied to the one phase that shares its first word), add the steps to the forecast as a field (the record
  stores no forecast: `forecastMoment` computes it when read, `bin/stretch.mjs`), and cold-read both pages with a
  reader who has only the page text. Built: 4222ff27 (the dated State, test first, red then green); 0c35bded (test
  first: the plan block says what the plan is and its count, how it differs from its phase's 3/7, which steps the
  stretch closes or which changed state, the tiles only when something moves, its steps grouped by state; the
  step-by-step section shows only the steps that changed, each State folded; a left item "2. " summarised by its
  first sentence). `planSections` is shared with `report` (status and phase pages), whose tests were updated to the
  new shape on purpose. Reviews of a036fd0..0c35bde: Codex correct (0.88), no findings, 179,607 input tokens; the
  lenses (readability, reliability) 0 + 2 suggestions, 44,931 input tokens: a phase matched by first word alone
  (now only when exactly one phase shares it) and the "moves" test written twice (now `movesOf`). Cold read 1 (Opus,
  read-only, only `return3.txt`, `departure3.txt` and a departure whose item closes S8): it said what the plan is,
  16 done, 1 in progress, 2 to do, 3 unclear of 22, and what moved (nothing; S8 on the variant), all matching the
  roadmap; it could tell the two shares count different things. Its unclear phrases, fixed in a6906471 with tests
  written after the change (not first): "Fila que cierra" for a plan step (now "Paso que cierra" by its title),
  "por él" and "con este plan" for the stretch, S8 still under "por hacer" with no mark (now "este tramo lo cierra"),
  closing S8 leaving row 5 untouched with no word why (now said: a step closing marks no phase row, the roadmap marks
  it apart), the forecast tile in the future once back ("pronosticado al volver"), "0 de 0 filas" (dropped), and a
  step-by-step section that repeated "ningún paso cambió" (left out on the return when the forecast was read and no
  step changed). Not fixed, outside spec 7: step titles in English with "step 5" inside them (the roadmap's words,
  L9's standing call); the F8 phase row 4 text still lists S2, S4a and S5 as to come while the plan says them done
  (the roadmap's row text); the three steps with no known state word (L10). Pages rendered from a copy of the
  throughput, channel, background and gate-log folders in scratch homes, never his real record.
- L12. 2026-11-14, JH 201, the second round. Codex over 0c35bde..a690647 (173,920 input tokens) found one P2: the
  mark "este tramo lo cierra" promised every named step, even one that ends after the return or waits for him. It
  recorded nothing, because this session edited `docs/FAILURES.md` and this document while the review ran (my
  mistake, `docs/FAILURES.md` codex-review-edited-during-run; from here no edit while a review runs). The lenses over
  the same range: readability 0, its 2 earlier findings rechecked fixed; reliability 1 warning: a plan the roadmap of
  now no longer holds got tiles whose captions read the opening's numbers as now's. A second cold read (Opus, only
  `return5.txt`, `departure5.txt`, `departure-s8b.txt`) again said what the plan is, its 22 steps by state and what
  moved, all matching; of its unclear phrases, "el pronóstico no lo mueve" was reworded; "cierra si va como se
  estimó" said four times for one step (the item, the sentence, the mark, the table) stays, each where a reader may
  start. Both findings fixed test first
  (red, then green) in the next commit: a named step keeps its own when in the mark and the sentence ("Pasos que nombra
  este tramo"), and a plan gone from now says so with no tiles. Not taken, with the reason: "igual que al abrir" beside
  "ningún paso cambió de estado" (one says the count, the other the states); "parte de la fase" without which part
  (the code cannot know which rows a plan details); the English step titles and plan name (the roadmap's words).
- L13. 2026-11-14, JH 201, the third round. Codex over 0c35bde..2b2d539 correct (0.87), no findings, 90,298 input
  tokens; the lenses over a690647..2b2d539: reliability 0, its earlier warning rechecked fixed; readability 2
  suggestions: the mark's fallback left unescaped (answered: on purpose, `stepsByState` escapes every mark, so
  escaping it here would escape it twice; a comment now says so) and a stale test title (renamed), in 728daf57.
  Codex over 2b2d539..728daf5 correct (0.99), 32,818 input tokens; readability over it 0 findings, 2 of 2 fixed.
- L14. 2026-11-14, JH 201, the advisor before the ready. (1) The claim that `progress` under-counted was unproven:
  `progress` does not read `planOf` (grep), so the FAILURES entry and the PR body name only the report's share and the
  forecast; 4222ff27's message keeps the wider claim. (2) Codex's P2 was half fixed: the return and status still said
  "El tramo pronosticaba cerrar ... ahora: abierta"; now "El tramo nombraba" with each step's when and a step's words,
  test first, seen on `stretch status --home <job tmp>/home4` (the S8 stretch open, no goals run). That render also
  showed a phase item "5. ..." with no period summarised as "5.": fixed, test first. (3) "Nothing bound": this session
  ran no `stretch bind` and no merge-queue command; a grep of `bin/` for a PR's bound state found none to check. (4) The
  cold-read pages of L12 were rendered from a6906471; two departure lines were reworded after. The orchestrator relayed
  spec 8 (his words, line 10936); it is its own slice after this PR.

## Next step
NOW (2026-11-14, JH 201, worktree `D:\js-harness\.claude\worktrees\f8-plan-block`, branch `feat/stretch-plan-block`):
UPDATE (L14): items 1, 2 and 4 below are done in commit 066e3895 and the docs commit after it; left: Codex and the
lenses over the last fix commit (no edits while they run), push, re-render the real pages from HEAD and read the
block, `gh pr edit 879` (drop the progress claim), `gh pr checks 879`, the advisor gate, notify ready naming spec 8
(an optional `doc` plan field) as the next slice. Then spec 8 (T10) on a new branch from main once 879 lands.
T9 built and reviewed (L10 to L13), pushed, PR 879 open. The advisor's last consult left, in order: (1) the claim
that `progress` under-counted is unproven (progress does not read `planOf`): fix the PR body (`gh pr edit 879`) and
the FAILURES entry plan-state-dated-dropped; (2) the return/status line "El tramo pronosticaba cerrar: S8 (después
de tu vuelta; ahora: abierta)" keeps the over-promise and map-row words for a step: fix test first in `movedSentence`
(measured branch), render with `stretch status --home <job tmp>/home4 --html <file>` (S8 stretch open there, no
--goals), one small review round, no edits while it runs; (3) check what "bound" means for a PR (grep `unbound` in
bin/check.mjs, bin/merge-queue*) and that 879 is not bound; (4) the control date of codex-review-edited-during-run
from `git log -S "an edit of a tracked file made while Codex reviews"`; L12 to say the cold-read pages came from
a6906471; re-render both real pages from HEAD and read the block; (5) `gh pr checks 879`, then the advisor gate:
advisor alone, one other call, then `js-harness notify --to orchestrator --kind ready --pr 879` alone, leading with
the count correction (13/19 → 16/22) and the open item: S4a's State says done yet counts "sin estado claro".
Keep `js-harness wait --notice-to 201` running in the background. Older state below.
Earlier (2026-11-14, JH 196, worktree `D:\js-harness\.claude\worktrees\advisor-refuse`, branch `feat/stretch-departure-clear`, head pushed): T8 built and
reviewed (L9); PR 875 open and bound (872 unbound). Before ready, the advisor asked: (1) correct the PR body and L9:
the cold reader said only JH 196 says what he gets back, so defect 6 (no item says what he will have) and the English
phase names stay open, the lead's call (titles as outcomes, or a plan field out of scope); put both first in the
ready; (2) CI showed 0 checks: run `js-harness gate -- node --test bin/conventions-*.test.mjs bin/stretch.test.mjs
bin/lib/stretch*.test.mjs` on HEAD; (3) re-render dep-c from HEAD and a return from a copy of the throughput folder in a
scratch home, read the forecast sections. Not blocking: factor 1 prints "ajustado ×1". Then
`js-harness notify --to orchestrator --kind ready --pr 875`. Older state below.
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
- Update ~16:50Z: the slice's reviews are done and taken in (L5, fixes in b651463a). Next: T6 on
  `rule/away-autonomy-stretch` from feat/stretch (manifest text, then `node bin/js-harness.mjs rules change
  away-autonomy --dry-run`, then real, one commit, its two reviews); then push both, PRs, notify ready.
- Update ~17:05Z: T6 done (L6). PR 633 and PR 634 open and notified ready. What stays: T7's real stretch with the
  user (the lead opens one with the command before he next leaves), and the closing notice once the PRs land.

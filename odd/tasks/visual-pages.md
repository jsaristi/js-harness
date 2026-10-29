# visual-pages

Branch `feat/visual-pages`, from main (62315e61). Runner: `node --test`. Session JH 79.

## Goal
The harness shows its moments as pages a command makes from the records: the departure and return of a stretch with
the percent of the planned met, the map by phase and a timeline; the close of a feature; the change of a phase; and
the status report; each page keeps its numbers so the next one compares with it, and the live board can no longer
go stale unnoticed.

## Why
His words of 2026-10-28 to the lead (session 0f71b2c6-cbce-43ca-a031-276a4b2c381f, lines 12054, 12220, 12237,
checked with `js-harness sessions --quote`), quoted under Specs. The two pages he liked that evening
(https://claude.ai/artifact/HuGDpq6jebQTFqjaDEXx4H, https://claude.ai/artifact/NXkguUN8eUjktfwowVnbXB) were drawn
by hand: the lead read the roadmap, the F8 plan, the merges and the notices, and inferred the percent, the before
and after of each step and the timeline. A page drawn by hand is a page no one can check, and the next one cannot
compare with it. The board went stale the same day: 121 rows waited at 23:15Z, the oldest from 01:37Z, because
only the lead's memory sends them.

## Done when
- `npm run check` exits 0
- `node --test bin/lib/pages.test.mjs bin/stretch.test.mjs bin/lib/stretch.test.mjs bin/lib/stretch-moments.test.mjs bin/report.test.mjs bin/lib/report.test.mjs bin/lib/report-pages.test.mjs bin/reply.test.mjs bin/lib/stale-board.test.mjs bin/sessions-live.test.mjs bin/sessions-background.test.mjs` exits 0
- `node bin/js-harness.mjs stretch --help` exits 0
- `node bin/js-harness.mjs report --help` exits 0
- `node bin/js-harness.mjs report phase --json` exits 0
- `node bin/js-harness.mjs rules visual-moments` exits 0 (on the rule branch)
- The four pages made on this machine from the real records and published, by hand

## In scope / Out of scope
- In: `bin/lib/pages.mjs` (new, the shared renderer and the page record), `bin/stretch.mjs`, `bin/lib/stretch*.mjs`,
  `bin/report.mjs`, `bin/lib/report*.mjs`, `bin/reply.mjs` and a new `bin/lib/stale-board.mjs` (the Stop hook's
  check), `bin/sessions-live.mjs`, `bin/sessions-background.mjs`, a new `bin/lib/sessions-running.mjs`,
  `docs/live-board.html` (the running block, which the lead's addition implies), `bin/lib/project.mjs` (init's
  line), their tests, the rule change through `js-harness rules change` (`bin/lib/manifest.mjs`,
  `bin/lib/rules-data.mjs`, `docs/RULES.md`, `docs/rule-sources.json`), this document, one ROADMAP line, a session
  summary.
- Out: credentials, `~/.claude`, `~/.codex`, gentle-ai config; the installed copy (not refreshed); the live board's
  published artifact (the lead republishes the page after the merge); evals; any new recorder of work: the pages
  read the records that exist and say what they do not hold.

## Constraints
- A number on a page comes from the command's JSON; the page is that JSON rendered. Nothing on it is typed by the
  lead, except the sections the records cannot hold, which come from a notes file the page labels as the lead's.
- What no record holds is named on the page as not measured, never inferred.
- Zero dependencies; the page record lives under the throughput folder, which `uninstall` keeps and names.
- `docs/ROADMAP.md`'s checklist is what `progress` counts; the F8 plan's steps are read, never made checkboxes.

## Ask me before
Nothing beyond the standing rules: the design passes two blind readers before code (rule:double-review), and his
words already decide the feature ("te apruebo las ideas que me diste para que los apliques", line 12237).

## Specs
1. The percent of the planned that was met, the map, chronological or by phase, complete and detailed, and a check
   of what advanced: "añadamos esto mas al protocolo, entre todo lo que teniamos que porcentaje se cumplio y ademas
   quiero que me muestres el mapa y como cronologico o de fases bien completo y detallado y me checkees lo que se
   avanzo" (line 12054).
2. The harness shows almost everything this way, to guide the user and keep a record, because what is not measured
   cannot be improved: "quiero que el arnes muestre casi todo asi ya que es mas grafico y es muchisimo mejor para
   guiar tanto al usuario como para que vayamos llevando un registro por que lo que no se mide no se puede mejorar y
   ademas el usuario no queda perdido quiero que protocolicemos todo esto" (line 12220).
3. The board goes stale when the lead moves to another session, and the ideas proposed are approved: "si pero cada
   que el orquestador se pasa a otra sesion al parecer el tablero se elimina y queda desactualizado en la version
   vieja osea no lo vuelve a generar ni actualizar ni absolutamente nada y te apruebo las ideas que me diste para que
   los apliques" (line 12237).
4. The lead's addition of 23:43Z, after he saw "todo está quieto" while JH 78 ran paid evals: `sessions start`
   writes the start row itself, and running work (an eval batch, a gate, a review) shows on the board without a
   notice.

## Design

### What the lead had to infer by hand, which the command computes
Read from the two model pages: the percent of goals met and of queued work done; the work done that no item
planned (+5 sessions); the roadmap's total before and after the absence (95/106 then 95/107); each F8 step's state
at departure and now; the timeline of merges, questions, failures and the return; the PRs a session delivered. Each
is a fact of git (the roadmap at a commit, the merges of main), of the channel record (the notices), of the
background record (the starts) or of the stretch record. What it could not infer and wrote as prose (why G2 was
late, the cost of a pnpm lock) stays the lead's, in the notes file.

### One renderer, one page record (`bin/lib/pages.mjs`)
Pure. It renders a page's JSON into one HTML fragment in Spanish that starts with `<title>`: the Artifact tool wraps
a fragment in a document at publish time, and the desktop's visual tool takes it whole, so one output serves both.
Its parts, shared by every page, follow the model pages: the colour tokens on `:root` with a dark set under
`prefers-color-scheme` and `[data-theme]`; `badNews` (the box that opens a page with what went wrong);
`tiles` (a big number, a meter, a caption); `table` (rows of cells, each escaped); `bars` (an estimate against a
real bar, the lost part red, one scale); `timeline` (time, a dot by kind, a line); `chain` (a plan's steps in order,
each coloured by its state, the ones that changed outlined); `mapTable` (each phase: done/total before, now, and
what is left). Every text from a record is escaped. The stretch's existing renders (`bin/lib/stretch-render.mjs`)
move onto these parts, so a stretch page and a report page look alike.

The page record: `<home>/.js-harness/throughput/<project>/pages.jsonl`, one line a page made with `--record` (the
pages of the moments; a page made to look is not kept): `{ schema: 'js-harness.page/v1', kind, at, head, numbers }`,
`head` the commit of the default branch the page read and `numbers` the page's JSON without its long text (the map
by phase, the plan steps' states, the percents). The next page of the same kind reads the last one: "before" is
that page's numbers, and a page with none before it says so. Append only, and a cut last line is ended first, as
the stretch record does.

### The map and the plan steps, at any commit (`bin/lib/report-pages.mjs`)
`mapAt(commit)`: the roadmap as that commit holds it, through `parseRoadmap` (`bin/lib/progress.mjs`), as phases
`{ title, done, total }` and the total. `planAt(commit)`: each `## <name> plan` section of the same roadmap, its
`### ` headings in order as steps, each with the text of its `- **State:**` bullet and a class read from that
text's first words: `done`, `built` or `applied` is done; `in progress`, `designed` or `started` is moving; `to do`
or `not started` is to do; anything else is unknown and shown as written. Before and after are two commits, so a
step whose class is the same but whose text changed is shown as moved: the record holds that it changed, not how
much. A roadmap with no plan section gives no chain, said in one line.

### Stretch: the percent, the map and the timeline (`stretch status` and `close`)
`measure` gains three blocks, in the JSON and on the page, computed by a new pure module
(`bin/lib/stretch-moments.mjs`) from what `bin/stretch.mjs` reads:

- `met`: four shares, each `{ met, total, percent }`: the goals met at the last check; the items finished; the
  items finished within their corrected high estimate (on time); and `unplanned`, the sessions that sent a notice
  inside the stretch and are no item's session, by label, with their first and last notice. A share over zero items
  is `null`, shown as "nada que medir".
- `map`: the map and the plan steps at the default branch's commit at the opening (`git rev-list -1
  --before=<openedAt> <ref>`) and now, each phase and step with its before and after; the total's before and after,
  and the phases whose count changed. When git cannot read either commit, the block is `{ unavailable }`.
- `timeline`: oldest first, cut to the stretch: the merges of the default branch's first-parent line (PR number and
  subject), the notices `opened`, `ready`, `closed`, `waiting` and `question` (a `note` is the board's, not the
  timeline's), the failures the measure already holds, and the stretch's own events (open, each check, close). Each
  row `{ at, kind, who, text }`, with the kind as the dot.

`close --record` (the moment) also appends the page record. The departure page (`open`) gains the map at the
opening, so "what exists now" is on it.

### The feature's close (`report feature <doc>`)
From the feature document and git:
- promised: its numbered specs, its done-when lines and its tasks (`parseFeature`); delivered: the tasks checked,
  and the done-when commands listed as not run by the page (a done-when may be the gate, which takes the lock: the
  lead runs `contract run` itself);
- its pull requests: the merges of the default branch whose branch is one the document names (`Branch` at its head,
  or `--branch`, repeatable), with time and subject;
- time: real from the first commit on its branches to the last merge; estimated from a stretch item whose session
  is the document's (`Session JH 79` at its head), else said as no estimate recorded;
- reviews: the Codex and lens records whose head is a commit of its pull requests, with their outcome, and the
  gentle-ai lines of its log counted;
- spend: the Codex runs' input tokens over those commits (the records hold them) and the lens runs'; dollars only
  where a record holds them, otherwise not measured;
- failures: the failed gates of its worktrees inside its span, from the gate log, as the stretch measures them;
- the map: before its first merge and after its last.

### The phase's change (`report phase`)
The whole map now against the last `phase` page's numbers (or, with none, against the map at `--since <commit>`):
each phase's share before and now, the phases that closed, the plan steps with their before and after, and what is
next: the roadmap's `## Next` section's first items and the first plan step not done.

### The status report (`report --html <file>`)
The six sections of `rule:status-report` as a page: 1 what landed (the merges, from the record), 2 the sessions (each
one's last notice), 4 the map (with the last report's map as before, read at the commit `--mark` recorded), and 5 the
open questions; 3 (his decisions and what they changed) and 6 (what the lead proposes) are no record's, so they
come from `--notes <file>` (`{ decisions: [{ text, changed }], proposals: [{ step, why }], waits: [text], badNews:
[text] }`) and the page labels them as the lead's; without it each says the records do not hold it. `--json` gives
the same data.

### The stale board (spec 3): the cheapest guard that cannot be skipped
The three ways the brief names, weighed:
- the lead's resume after a compaction names the waiting rows: it runs only on a compaction, never for a new lead
  started on another session, which is the case he reported;
- `wait --notice-to orchestrator` or the heartbeat ends on them: they run only when the lead runs them, and a lead
  that forgot the board forgets these as well;
- the Stop hook refuses a lead reply while rows wait: it runs on every reply of every session where the project
  turned the reply check on, a new or compacted lead included, and the lead cannot leave it out.

Chosen: the Stop hook. Where `bin/reply.mjs` already reads the channel record for the wake check, a session whose
title is the orchestrator's (`roleOfTitle`) is turned back, once a stop (`stop_hook_active`), when rows wait for the
board and the oldest has waited longer than the board's check holds (`CHECK_MINUTES`, 45, in
`bin/sessions-live.mjs`): a fresh notice does not interrupt a reply, a stale board does. The reason names the count,
the oldest row's time and the two commands. Its cost: one read of the record and of the cursor at a lead's stop;
none at a work session's. Not chosen as well, to keep one home: the resume and the heartbeat lines.

### The start row and the running work (spec 4)
- `sessions start` appends an `opened` notice from the new session, by its title and id, once claude has accepted
  it (`started` recorded), with the brief's first line as text; the board shows it as working from that moment.
- `sessions live --out` puts `running` into `board-checked.json`: the gates (`findGates`), the Codex and lens
  reviews and the eval runs among the machine's node processes (`bin/lib/sessions-running.mjs`, by command line:
  `codex-review`, `lens-review`, `evals/runner.mjs`), each `{ kind, since, where }`; `[]` when none, so the merge
  clears an old one. `docs/live-board.html` shows the block. A process listing that fails gives `{ unavailable }`.

### Shipping to every project (spec 2)
The commands are the harness's, so every project that installs it has them. `init`'s `CLAUDE.md` block
(`claudeBlock`, `bin/lib/project.mjs`) gains one line naming the moments and the new rule of the moments (below), so a project's
sessions know when to make a page; `sync` renders it again into an unedited block.

### The rules
On `rule/visual-moments`, through `js-harness rules change`, quoting his words of 2026-10-28:
- `away-autonomy` gains the percent, the map and the timeline at the return;
- a new rule `visual-moments`, in force in every project: at a stretch's departure and return, a feature's close, a
  phase's change and a status report, the lead shows the page the command makes (`stretch`, `report feature`,
  `report phase`, `report --html`) with `--record`, never one drawn by hand; the live board stays the continuous
  view, and a pull request appears inside its feature's page.

## Tasks
- [ ] T1 (kind: design) this document, read by two blind readers (rule:double-review). Spec 1-4. Route: inline, readers delegated.
- [ ] T2 (kind: build) `bin/lib/pages.mjs` and the stretch renders moved onto it. Spec 2. Route: inline.
- [ ] T3 (kind: build) `stretch status`/`close`: met, map, timeline, `--record`. Spec 1. Route: inline.
- [ ] T4 (kind: build) the stale-board guard in the Stop hook. Spec 3. Route: inline.
- [ ] T5 (kind: build) the start row and the running work on the board. Spec 4. Route: inline.
- [ ] T6 (kind: build) `report feature`, `report phase`, `report --html --notes`. Spec 1, 2. Route: inline.
- [ ] T7 (kind: build) init's line. Spec 2. Route: inline.
- [ ] T8 (kind: build) the rule change on `rule/visual-moments`. Spec 1, 2. Route: inline.
- [ ] T9 (kind: verify) the four pages from the real records, published; reviews on each slice. Route: inline.

## Log
- L1. 2026-10-28, the lead's brief for JH 79: his words of lines 12054, 12220 and 12237, the four ideas he approved
  (pages made by a command from the records, keeping their numbers; pages at moments, not per pull request; shipped
  to every project through `init`; the stale board made impossible to miss), the two model pages, and at 23:43Z the
  start row and the running work.
- L2. 2026-10-29, his three lines read with `js-harness sessions --quote` (23:03:40Z, 23:09:30Z, 23:14:33Z).
- L3. 2026-10-29, searched before adding: `stretch` (plan, measure, departure and return renders; no percent, map or
  timeline), `report` (four sections of facts as lines, `--mark` records the head it read), `progress` (the roadmap
  and features by checkbox; the F8 plan's steps are prose, not counted), `sessions live` (rows from notices, the
  board's summary with the open stretch), the Stop hook (`bin/reply.mjs`, the reply check and the wake check, which
  already reads the record), `findGates` (running gates from the process list), `claudeBlock` (init's lines). None
  renders a page from the map or keeps a page's numbers.

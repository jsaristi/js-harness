# visual-pages

Branch `feat/visual-pages`, from main (62315e61). Runner: `node --test`. Session JH 79.

## Goal
The harness shows its moments as pages a command makes from the records: the departure and return of a stretch with
the percent of the planned met, the map by phase and a timeline; the close of a feature; the change of a phase; and
the status report; each page keeps its numbers so the next one compares with it, and a live board left unsent is
named to the lead at its next reply.

## Why
His words of 2026-10-28 to the lead (session 0f71b2c6-cbce-43ca-a031-276a4b2c381f, lines 12054, 12220, 12237,
checked with `js-harness sessions --quote`), quoted under Specs. The two pages he liked that evening
(https://claude.ai/artifact/HuGDpq6jebQTFqjaDEXx4H, https://claude.ai/artifact/NXkguUN8eUjktfwowVnbXB) were drawn
by hand: the lead read the roadmap, the F8 plan, the merges and the notices, and inferred the percent, the before
and after of each step and the timeline. A page drawn by hand is a page no one can check, and the next one cannot
compare with it. The board went stale the same day: by the lead's brief, 121 rows waited at 23:15Z, the oldest from
01:37Z, because only the lead's memory sends them.

## Done when
- `npm run check` exits 0
- `node --test bin/lib/pages.test.mjs bin/stretch.test.mjs bin/lib/stretch.test.mjs bin/lib/stretch-moments.test.mjs bin/lib/stretch-render.test.mjs bin/report.test.mjs bin/lib/report.test.mjs bin/lib/report-pages.test.mjs bin/reply.test.mjs bin/lib/stale-board.test.mjs bin/sessions-live.test.mjs bin/sessions-background.test.mjs bin/lib/sessions-running.test.mjs` exits 0
- `node bin/js-harness.mjs stretch --help` exits 0
- `node bin/js-harness.mjs report --help` exits 0
- `node bin/js-harness.mjs report phase --json` exits 0
- The stretch return, a feature close, the phase page and the status report made on this machine from the real
  records and published (by hand); the stretch from a stretch record written for the absence of 2026-10-28 in a
  scratch home, since no stretch was opened for it, said so on the page

## In scope / Out of scope
- In: `bin/lib/pages.mjs` (new, the pure renderer), `bin/lib/pages-record.mjs` (new, the page record),
  `bin/stretch.mjs`, `bin/lib/stretch*.mjs`, `bin/report.mjs`, `bin/lib/report*.mjs`, `bin/reply.mjs` and a new
  `bin/lib/stale-board.mjs` (the Stop hook's check), `bin/sessions-live.mjs`, `bin/sessions-background.mjs`, a new
  `bin/lib/sessions-running.mjs`, `docs/live-board.html` (the running block, which the lead's addition implies),
  `bin/lib/project.mjs` (init's line), their tests, the rule changes through `js-harness rules change`
  (`bin/lib/manifest.mjs`, `bin/lib/rules-data.mjs`, `docs/RULES.md`, `docs/rule-sources.json`), this document, one
  ROADMAP line, a session summary.
- Out: credentials, `~/.claude`, `~/.codex`, gentle-ai config; the installed copy (not refreshed); the live board's
  published artifact (the lead republishes the page after the merge); evals; any new recorder of work: the pages
  read the records that exist and say what they do not hold.

## Constraints
- A number on a page comes from the command's JSON; the page is that JSON rendered. Nothing on it is typed by the
  lead, except the sections no record holds, which come from a notes file the page labels as the lead's.
- What no record holds is named on the page as not measured, never inferred; an unknown is never shown as a zero.
- A state a document reports and a state a check proves are shown apart: the roadmap's prose is shown as what it says.
- Zero dependencies; the page record lives under the throughput folder, which `uninstall` keeps and names.
- High-risk items (CLAUDE.md, Task Size): the Stop hook runs at every stop of every session where a project turned
  the reply check on, and fails open; `claudeBlock` is text `sync` renders into projects. Both get their tests first
  and the slice's reviews; no other verifier.

## Ask me before
Nothing beyond the standing rules: the design passed two blind readers before code (rule:double-review), and his
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
4. The lead's addition of 23:43Z, decided by the lead after he said the board read "todo está quieto" while JH 78 ran
   paid evals (his words are in the lead's transcript; the brief carries them, not their line): `sessions start`
   writes the start row itself, and running work (an eval batch, a gate, a review) shows on the board without a
   notice.
5. The board opens with the last three things done and how long ago, as a mini context: "en el tablero muestrame al
   inicio las ultimas 3 cosas que se han hecho y hace cuanto tiempo para tener un mini contexto" (transcript
   0f71b2c6, line 13105, 2026-10-29T00:59:10Z, checked with `js-harness sessions --quote`; sent by the lead at 01:03Z).
6. The status list the lead showed him, as colored cards at the board's top: "queria que añadieras ese artefacto asi
   al tablero al inicio antes de \"lo que te toca\"" (transcript 0f71b2c6, line 13589, 2026-10-29T01:28:44Z, checked
   with `js-harness sessions --quote`; "ese artefacto" is the lead's inline status list of 01:05Z, as the lead's
   message of ~01:31Z describes it).
7. Each session's card says who works on what and the approximate time of its task: "colocame en el tablero de quien
   trabaja y en que y el tiempo aproximado de la tarea" (transcript 0f71b2c6, line 14289, 2026-10-29T02:16:52Z,
   checked with `js-harness sessions --quote`; sent by the lead at 02:17Z).

## Design

### What the lead had to infer by hand, which the command computes
Read from the two model pages: the percent of goals met and of queued work done; the sessions that worked outside
the plan; the roadmap's total before and after the absence (95/106 then 95/107); each F8 step's state at departure
and now; the timeline of merges, questions, failures and the return; the pull requests a session delivered. Each
is a fact of git (the roadmap at a commit, the merges of main), of the channel record (the notices), of the
background record (the starts) or of the stretch record. What the lead wrote as prose (why G2 was late, the cost of
a pnpm lock) stays the lead's, in the notes file.

### One renderer (`bin/lib/pages.mjs`) and one page record (`bin/lib/pages-record.mjs`)
`pages.mjs` is pure: a page's parts in, one HTML fragment in Spanish out, starting with `<title>`; the Artifact tool
wraps a fragment in a document at publish time and the desktop's visual tool takes it whole, so one output serves
both. Its colour tokens are scoped to the page's wrapper class (a fragment shown inside a host page must not change
the host's `:root`), with a dark set under `prefers-color-scheme`. It holds only the parts the pages below use, each
added with the first page that needs it: `badNews`, `tiles` (a big number, a meter, a caption; an unknown share is
"sin medir", never 0 %), `table`, `timeline`, `chain` and `pill`, and `pages-sections.mjs` builds the sections the
pages share from them (the shares, the map, a plan, the timeline). Every text from a record is escaped. Times are
shown in UTC with their `Z`, as the records keep them. `stretch-render.mjs` keeps its two renders and its own bars,
and puts them inside a page.

`pages-record.mjs` keeps a page's numbers: `<home>/.js-harness/throughput/<project>/pages.jsonl`, one line a page
made at a moment, `{ schema: 'js-harness.page/v1', kind, subject, at, head, numbers }`: `subject` the stretch id,
the feature document's path or `map`; `head` the commit of the default branch read; `numbers` the page's counts
(the map by phase, the plan steps, the shares). A page whose kind, subject and head equal the last line's is not
appended again. Append only; a cut last line is ended first, as the stretch record does. Where git holds the
"before" (a stretch's opening head, a feature's first merge, a status report's `--mark` head), the page reads git;
the record is the "before" only of the phase page, which has no other.

### The map and the plan steps, at a commit (`bin/lib/report-git.mjs`, `bin/lib/report-pages.mjs`)
`momentAt(commit)` (report-git) reads the roadmap that commit holds: its map through `mapOf` (phases `{ title, done,
total, open }` and the total) and its plans through `planOf` (report-pages, pure): each `## <name> plan` section,
its `### ` headings in order as steps, each with:
- `said`: its `- **State:**` text as written, with `reported`, a word read from its first words (`done`, `built`,
  `in progress`, `designed`, `to do`, else `other`), shown as "dice la hoja de ruta", never as proof;
- `documents`: the feature documents the step's text names (`odd/tasks/<x>.md`), each with its task checkboxes
  done/total at that commit, which is the state the roadmap itself says to read ("a step's state is read in its
  feature document"); a step that names none shows only `said`.
Before and after are two commits: a step whose document gained done tasks, or whose reported state went forward,
advanced; one whose state went back went back ("retrocedió"); one whose prose alone changed is "texto cambiado"; the
map's phases compare by title. A before git cannot read (the commit, its listing or a document) is said with why and
every step and phase is "sin medir", never "nuevo". A roadmap with no plan section gives no chain.

### Stretch: the shares, the map and the timeline
`stretch status` and `close` (not the live board's `boardStretch`, which must stay cheap) add three blocks, computed
by a pure module (`bin/lib/stretch-moments.mjs`) from what `bin/stretch.mjs` reads. `open` now records `head`, the
default branch's commit at the opening; a stretch opened before this records none, and its head is reconstructed
with `git rev-list --first-parent -1 --before=<openedAt> <ref>` (the ref `report` uses, `paceRef`), labelled as
reconstructed.

- `goals` and `work`, each share `{ met, of, unknown }` (the page computes the percent), its denominator said:
  - goals met: of all goals, those met at the last check; a goal never checked is `unknown`, not unmet;
  - goals met in time: of the goals met, those whose first check that found them met is at or before `returnAt`;
    a met goal with no check before `returnAt` is `unknown`, so a stretch whose goals ran only at `close` after the
    return reads "sin medir", and the rule asks for `status --goals` before the return when the lead is awake;
  - work done: of the items that do not wait for the user, those `finished`; the others listed by state;
  - outside the plan: a count, not a share: the work sessions (`roleOfTitle` gives a number) whose first notice
    falls inside the stretch and that are no item's session, each with its first and last notice; notices with no
    title counted apart; the lead's own notices are not work.
  A share over nothing is `null`, shown as "nada que medir".
- `map` and `plans`: `momentAt` at the opening head and at the default branch now, compared.
- `timeline`: oldest first, cut to the stretch: each pull request merged on the default branch's first-parent line
  (grouped by number, at its last merge), the notices `opened`, `ready`, `closed`, `waiting`, `question` and
  `answer`, the failures the measure already holds, and the stretch's events (open, each goal check, close).

`close` appends the page record; `open` shows the map at the opening, so the departure says what exists now.

### The feature's close (`report feature <doc>`)
From the feature document and git:
- promised and delivered: the numbered items under `## Specs` and the commands under `## Done when` (`doneWhen`,
  `bin/lib/contract.mjs`), read by section; its tasks done/total (`tasksOf`); the done-when commands listed as not
  run by the page (one may be the gate, which takes the lock: `contract run` is the lead's);
- its pull requests: the merges of the default branch's first-parent line whose source branch, with an owner prefix
  removed, is one the document names (`Branch \`x\`` at its head) or `--branch`, or named by `--pr <n>`, both
  repeatable; grouped by number; each one's commits the union of `M^1..M^2` over its merges, as hashes. A history
  whose merges name no pull request gives `{ unknown }` with why;
- time: real from the oldest of those commits to the last merge; estimated from a closed or open stretch item whose
  session is the document's (`Session JH <n>` at its head), else "sin estimado registrado";
- reviews: coverage, the Codex reviews (`codex-reviews.jsonl`) and lens reviews (`lens-reviews.jsonl`) whose head is
  one of those commits, by outcome; attempts, the Codex runs (`codex-review-runs.jsonl`) by run id; a review of a
  rebased head is not found and the page says so; the gentle-ai lines of the log counted;
- spend: the Codex runs' `usage.inputTokens` and `cachedInputTokens` apart, a run with no usage counted as unknown;
  the lens results' `costUsd` and tokens; evals and the session's own tokens "sin medir";
- failures: the failed gates of its worktrees inside its span, as the stretch measures them;
- the map: at the first merge's first parent and at the last merge.
`--record` appends the page record (subject: the document's path).

### The phase's change (`report phase`)
The whole map at the default branch now against the last `phase` page of the record (or `--since <commit>`; with
neither, the page says it has no before): each phase's share before and now, the phases that closed, the plan steps
with before and after as above, and what is next: the first plan step whose reported state is not done, and the
open phases with what is left. `--record` appends it.

### The status report (`report --html <file> [--notes <file>]`)
The six sections of `rule:status-report` as a page: 1 what landed (the pull requests, grouped), 2 the sessions (each
one's last notice), 4 the map, with the map at the head the last `--mark` recorded as before, and 5 the open
questions; 3 (his decisions and what they changed) and 6 (what the lead proposes) are no record's, so they come
from `--notes` (`{ badNews: [text], decisions: [{ text, changed }], waits: [{ what, why }], proposals: [{ step, why
}] }`), each labelled "del orquestador"; with no notes each says that no record holds it. `--json` gives the data.

### The stale board (spec 3): a reminder at the lead's next reply
What happened, checked: the cursor (`<home>/.js-harness/channel/live/D--js-harness.json`) still names the board of
the brief (`.../LAMAVwx92GosturPiuKbTD`), so the board was not replaced; its rows went unsent, which is what the
user saw as a board "eliminado" and old. The three places the brief names, weighed:
- the resume after a compaction runs only after a compaction, never for a new lead in another session, his case;
- `wait --notice-to orchestrator` and the heartbeat run only when the lead runs them, and a lead that forgot the
  board forgets them too;
- the Stop hook runs at every reply of every session of a project with the reply check on, a new or compacted lead
  included; a reply is already shown when it runs, so it is a reminder that turns the lead back for one more turn,
  not a prevention; and it fails open (a record it cannot read lets the stop through).
Chosen: the Stop hook, as its own check (`bin/lib/stale-board.mjs`), beside the reply and wake checks:
- it acts only where the project has a board: the cursor file exists and holds a `url`; with none, nothing;
- the lead is the session whose newest notice in the channel record, by `from.id` equal to the payload's
  `session_id`, has a title of the orchestrator's role: `roleOfTitle` gives `orchestrator`, or the title's first
  word after the code is `ORQ` (a handover title such as `JH ORQ nueva · ...`); a session that sent no notice is
  not taken for the lead;
- it fires when rows wait (`pendingRows` with the cursor) and the oldest waited longer than the board's check holds
  (`CHECK_MINUTES`, 45, exported from `bin/sessions-live.mjs`), so a fresh notice does not interrupt a reply;
- it skips a reply that closes on a decision or a question (the user must read it first) and a payload with no
  `background_tasks` (Codex, which cannot send `ArtifactData`);
- it warns once a pending set: its reason carries a marker and the oldest row's id, and a transcript that already
  holds that marker with that id is not warned again; a newer oldest row (the lead sent some) warns again;
- its reason names the count, the oldest row's time, the board's link and the two commands to send them.
Its cost: at each stop where the reply check is on, one read of the cursor (a missing file ends it) and of the
channel record; the lead's transcript is searched only when the lead is about to be warned. The resume and the
heartbeat are left as they are, to keep one home.

### The start row and the running work (spec 4)
- `sessions start` appends an `opened` notice once claude accepted the session (`started` recorded), `from` the new
  session's title and `sessionId` (else its job id), stamped with the time before it launched claude and with the
  text "started by sessions start: <title>". The board takes a session's latest row by time (`docs/live-board.html`,
  line 260), so a notice the child sends later is the newer one; the child's own `opened` still comes, as its
  first fact of its own. `sessions` reads a session's state in the record's order, so the row is written only while
  the record holds no notice of that session; its `worktree` is the absolute path, as `placeOf` records one. A start
  whose notice cannot be appended says so on standard error and keeps the start.
- `sessions live --out` puts `running` into `board-checked.json`: `{ at, until, items }`, sampled at that check and
  held until the next (`until`), each item `{ kind, pid, since, where }`: the gates as `findGates` reads them from
  the listing (a gate running and one waiting for the lock are not told apart; `where` its worktree where the command
  line names one), and among the machine's node processes the Codex and lens
  reviews (`bin/codex-review.mjs`, `bin/lens-review.mjs`, or the dispatcher's `codex-review`/`lens-review`) and the
  eval batches (`evals/suite.mjs`), matched by argument as `findGates` matches a gate, so a test file of the same
  name is none (`bin/lib/sessions-running.mjs`). `since` is the process's start, unknown where the listing gives
  none. A listing that fails gives `{ unavailable }`. `docs/live-board.html` shows it as "en curso a las HH:MM".

### The last three things done (spec 5)
`docs/live-board.html` opens, above everything else, with the three newest rows of its `events` collection whose
kind says something was done (`closed`, a session's work finished; `ready`, a pull request ready), newest first,
each with its session, its text cut to one line, and how long ago it was, counted by the page from the row's time
against the viewer's clock and recounted at each repaint, every 30 seconds ("hace 12 min", "hace 3 h"). The rows
are the board's own, so no command changes; with none, the block says "Nada terminado todavía en el tablero". Merges are not rows of the
board (they live in git), so a pull request shows here by its `ready`, not by its merge; the stale-board check is
what keeps these rows current.

### The status list (spec 6)
Above "Lo último que se hizo", "Cómo va": one card an item of `board/summary.status`, the shape
`[{ state: 'done' | 'working' | 'waiting', titulo, texto }]` the lead fills on each wake (a title such as
"Hecho · PR 629 integrado", one plain sentence): an outline icon drawn inline (Tabler's circle-check, loader and
hourglass shapes), the title in bold, the sentence under it; green for done, amber for working, blue for waiting
(the page's `ok`, `wait` and `run` tokens), and a muted legend "Verde: hecho · Ámbar: en curso · Azul: esperando".
An item of another state or with no title is left out (`statusItems`); with none, the block hides.

### The time of each session's task (spec 7)
Each card of a session still at work ("Quién trabaja y en qué") keeps its last notice, which says what it is on, and
adds one line, "Lleva 1 h 20 min en esto · estimado 1,5–2 h" (`taskTimeText`): how long it has been on its task,
counted from its newest `opened` row on the board, else from its oldest row the board holds, said as such; and the
task's estimate, from `board/summary.estimates` (`[{ session: 'JH 79', horas: [low, high] }]`, the lead's, filled
on each wake), else from the open stretch item whose `session` is the card's (its corrected hours), else "sin
estimado". A session is named by its code and number, so "JH 7" is not "JH 79". An estimate that is not two numbers
is none; no number is made up.

### Shipping to every project (spec 2)
The commands are the harness's, so every project that installs it has them. `init`'s `CLAUDE.md` block
(`claudeBlock`, `bin/lib/project.mjs`) gains one line naming the moments and the pages, so a project's sessions
know when to make one; `sync` renders it again into an unedited block.

### The rules
No new rule: the moments amend the two that already hold them (AGENTS.md: amend before adding), on
`rule/visual-moments`, through `js-harness rules change`, quoting his words of 2026-10-28:
- `reports-spanish-visual`: at a stretch's departure and return, a feature's close, a phase's change and a status
  report, the page is the one the command makes from the records (`stretch`, `report feature`, `report phase`,
  `report --html`), never drawn by hand; the live board stays the continuous view, and a pull request appears
  inside its feature's page;
- `away-autonomy`: the return shows the shares of the planned met, the map before and after and the timeline, and
  before the return the lead checks the goals (`stretch status --goals`) so their time is known.

### Slices
Chained pull requests, each with its reviews: A the renderer, the record and the stretch's moments; B the stale
board, the start row and the running work; C the report's pages and init's line; D the rule change, stacked.
Slice A came to 1,666 changed lines, so it went up as three stacked pull requests, each on its parent's branch: #643
the design (`feat/visual-pages-design`), #644 the renderer (`feat/visual-pages-renderer`), #645 the stretch and the
review fixes (`feat/visual-pages`). None is under 400: the design's second commit rewrites the first, the renderer
is one commit, and the fixes touch both the renderer and the stretch. Slice B, 721 lines, stacks on #645 as two:
the stale-board guard, T4 (`feat/visual-pages-b`, 9b36b5b5), and the board's start row, running work, last things
done and status cards, T5, T5b and T5c (`feat/visual-pages-board`).

## Tasks
- [x] T1 (kind: design) this document, read by two blind readers (rule:double-review), in ee595c7c and the revision after them. Spec 1-4. Route: inline, readers delegated.
- [x] T2 (kind: build) `bin/lib/pages.mjs`, `bin/lib/pages-record.mjs`, the map and plan at a commit. Spec 1, 2. Route: inline. 35c8d1fd and the review fixes.
- [x] T3 (kind: build) `stretch status`/`close`: met, map, timeline; `open` records its head. Spec 1. Route: inline. 8a412b79 and the review fixes.
- [x] T4 (kind: build) the stale-board check in the Stop hook. Spec 3. Route: inline. Slice B.
- [x] T5 (kind: build) the start row and the running work on the board. Spec 4. Route: inline. Slice B.
- [x] T5b (kind: build) the last three things done, each with how long ago, at the top of the live board. Spec 5. Route: inline. Slice B.
- [x] T5c (kind: build) the lead's status list as colored cards at the top of the live board. Spec 6. Route: inline. Slice B.
- [x] T5d (kind: build) each session card's time on its task and its estimate. Spec 7. Route: inline. Slice B.
- [ ] T5e (kind: build) follow-up of Codex's open P2 (L10): `recordOfRows` (`bin/lib/sessions.mjs`) keeps a session's
  status and place by record order, so a session's notice appended between `sessions start`'s read of the record and
  its append of the start row is behind that row; the fix is to keep the newer by `at` (ties by record order). Outside
  this brief's surface for `bin/lib/sessions.mjs`; the lead's decision of 02:33Z: a follow-up after this feature, not
  in slice B (it changes how shared board code orders status), and named in the slice B PR as the one Codex finding
  left open. Spec 4. Route: inline.
- [ ] T5f (kind: build) follow-up, a defect found landing #644 (L16), outside this brief's surface: the merge queue
  (`bin/merge-queue.mjs:318`) passes `reviewCoverage` the pull request's head as the tip, so a record whose head lies
  past it covers; the pre-push check (`bin/lib/codex-review-rows.mjs:58`) passes main's merge, which that record's
  head is not past. The first pull request of a stack, landed alone after a review over the stack, passes the queue
  and is refused at push. The fix is one tip for both. Cost about 25 minutes on 2026-10-29. Route: inline.
- [ ] T6 (kind: build) `report feature`, `report phase`, `report --html --notes`. Spec 1, 2. Route: inline.
- [ ] T7 (kind: build) init's line. Spec 2. Route: inline.
- [ ] T8 (kind: build) the rule changes on `rule/visual-moments`. Spec 1, 2. Route: inline.
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
  board's summary with the open stretch), the Stop hook (`bin/reply.mjs`, the reply and wake checks), `findGates`
  (running gates from the process list), `claudeBlock` (init's lines), and the rules `reports-spanish-visual`,
  `status-report`, `live-board` and `away-autonomy`. None renders a page from the map or keeps a page's numbers.
- L4. 2026-10-29, double review of the design (rule:double-review), two blind readers given the document and the
  records. Claude, 5.5/10: blockers, eval batches start from `evals/suite.mjs` (`runner.mjs` is a library) and a
  substring match takes test files; the guard would fire in a project with no board (no cursor gives the last 24
  hours of rows); the roadmap's `State` lines lag the merges (S1 records fix and S11 read "in progress" with their
  pull requests merged) and the roadmap says a step's state is in its feature document; no stretch record exists, so
  the return page cannot come from one; "on time" is the goals', not the items'. Should-fix: the hook's cost was
  misstated (the wake check returns early; the role needs a title); the guard nags (once a stop), cannot help a
  Codex lead, and misses a handover title (`ORQ nueva`); the "eliminado" half not investigated; "before" by kind
  mixes features and duplicates git; the opening commit needs `--first-parent`; pull requests have two merges each
  (#642, #638, #637); lens spend is in `lens-reviews.jsonl` results, not the runs; "+5" is a count; the moments would
  cost every board check; the start row's provenance and duplicate; the running block is a snapshot; `## Next` is
  stale; a new rule where two exist; high-risk items and slices unnamed; a done-when that fails off the rule branch.
  Codex, 5/10: blockers, a reported state is not a proven one (S3 "built" lacks its fixed-load check); shares need
  denominators and unknowns apart from failures; the guard is a post-reply reminder that fails open, not a guarantee;
  the running block is sampled only at a check. Should-fix: freeze the opening head; page identity by subject and
  precedence over `--mark`; "outside the plan" is activity, by stable identity, without the lead; the start row's
  ordering against the child's notices; the lead's recognition and the warning's suppression; pull requests by
  normalized branch, hashes and explicit selection; review coverage apart from attempts, unknown usage counted;
  `parseFeature` holds no specs or done-when; POSIX listings have no start time; build no framework first; prose
  changed is not progress. Taken in, all, as the design above now says; the board was checked not replaced (the
  cursor names the brief's board). Not taken: reading a step's state only from merges of a named branch (steps name
  documents more reliably than branches; the document counts are the roadmap's own rule).

- L5. 2026-10-29, slice A reviewed over 62315e61..8a412b79. Codex (4 parts, 688,206 input tokens): four P2, taken
  in: the bad-news box shared the class of a failure dot; a fence holding a shorter marker broke the plan reader (now
  `tokenize`); a feature document git failed to read passed for one not there; an unreadable opening read as an
  empty plan, every step new. Claude lenses (3, about 266k input tokens): one warning, taken in: a step whose state
  went back read as advanced. gentle-ai (medium; resilience, readability, reliability; lineage
  review-e0f80354d78ba720): approved with warnings, all taken in or the same as above, plus `headBefore` telling a
  git failure from no commit, the design names that drifted (`mapAt`, `planAt`, `percent`, `bars`), the Spanish of
  the empty share and of the lead's failures, and a test of the return page's bad news. Not taken: a test of a failed
  page-record write (its append is the stretch record's, tested there). The `review-*` agent types ran no tool here
  (0 tool uses, three times); the lenses ran as general agents on opus.
- L6. 2026-10-29, spec 5 from the lead (his line 13105): the last three things done at the board's top, in slice B.
- L7. 2026-10-29, spec 6 from the lead (his line 13589): the status list as colored cards at the board's top, in
  slice B (T5c). The session was compacted by the host at ~01:33Z and resumed from this document. Codex on
  54747bc..2bd3bc7: correct (0.96), no findings (65,799 input tokens). Slice A went up as the stacked chain #643,
  #644, #645 (Slices above); #643 announced ready.
- L8. 2026-10-29, slice B reviewed over 2bd3bc7..b70ac68. Claude lenses (risk, resilience, reliability): 0 findings,
  128,262 input tokens. Codex: the first run stopped on "Selected model is at capacity" (82,682 input tokens, no
  record); run once more, 2 parts, 587,101 input tokens (472,320 cached): two P2 in the start row, taken in: its
  `worktree` was the name given, not the absolute path readers hand to git; and, since `sessions` reads a session's
  state in the record's order, a row appended after the session's own notice would replace its newer state (now
  written only while the record holds no notice of that session). gentle-ai (medium; reliability; lineage
  review-7c6f3a36e3078389): approved, two warnings and a suggestion, all taken in: the running line past its `until`
  read as live with a growing "desde hace"; the test did not prove the start row is stamped before claude ran (the
  fake now records when it ran); the warning's send steps did not name the Spanish fields of a row.
- L9. 2026-10-29, spec 7 from the lead (his line 14289, checked): each card's time on its task and its estimate, in
  slice B (T5d), on `feat/visual-pages-board`; the estimate's lead field is `board/summary.estimates`.
- L10. 2026-10-29, the fixes and T5d reviewed over b70ac68..ca23a62. Claude lenses (reliability, resilience): 0
  findings, 27,690 input tokens. Codex recheck (67,973 input tokens): the worktree P2 fixed; the order P2 not fixed,
  since a session's notice appended between the read of the record and the append still lands behind the start row.
  The window is now the read and the append alone (the place is read before); the session takes seconds to boot and
  write, so the case is narrow but real. Its fix (T5e) is in `recordOfRows`, outside this brief's surface: asked of
  the lead, not done here unless the lead says so.
- L11. 2026-10-29 02:33Z, the lead: T5e stays a follow-up, out of slice B; 1c039be0's narrowing is enough for this
  slice. #643 landed (main 837cedd); #644 retargeted to main. The lens on 1c039be0 found nothing (8,813 input tokens).
- L12. 2026-10-29, Codex over 67e6230..1f61e01 (`--again`, 167,443 input tokens): one P2, taken in: an estimate of
  `[null, null]`, `''` or `false` read as 0 hours through `Number`, a made-up "estimado 0 h"; only two numbers are an
  estimate now, and the stretch's hours or "sin estimado" follow.
- L13. 2026-10-29, gentle-ai over b70ac68d..ca23a627 (reliability, lineage review-3aafcdd1541ce20e): approved and
  acknowledged, three warnings and a suggestion: the start-row race (T5e, the lead's follow-up); the blank estimate
  read as 0 (fixed in c6d97b82); the start row with no worktree and its branch untested, and an estimate named by the
  code alone ("JH") matching every session, both taken in the commit after c6d97b82.

- L14. 2026-10-29, spec 8 from him (transcript 0f71b2c6, line 14721, 02:46:58Z, checked with `js-harness sessions
  --quote`): "me mostraste las coasas diferente a como habiamos planeado, no entiendo por que nuestros protocolos no
  quedan estandarizados? sera que menos protocolo y siempre generamos un eval o un template para que siempre muestre
  las cosas como quiero? y que asi se estandarice y no muestre algo diferente cada vez. dime como lo tengo que pedir
  por que siempre equivocas y siento es que yo no te pido las cosas paras que el arnes funcione como debe". The lead
  had redrawn the departure by hand, inline, with no map. The lead asks (to place in a slice): 1) each moment's
  command writes the whole page and records its hash in the page record, and a check (Stop hook `bin/reply.mjs` or
  the reply-state check) refuses a reply at a moment unless the page shown or published is that file unchanged;
  2) the departure (`stretch open`) carries the map by phase and the timeline at the opening; 3) the plan's item
  titles go in as written, the help saying the lead writes them in Spanish. Not yet answered to the lead: proposed
  slice C (with T6), as T10.
- L15. 2026-10-29, gentle-ai over ca23a627..71d626c5 (reliability, lineage review-8ed9074b0701c90f): approved and
  acknowledged, three suggestions, none taken: a three-number or string estimate now reads as none (the stretch
  writes `corrected` by arithmetic, so numbers, `bin/lib/stretch.mjs:126`); the place is read on every start
  (`placeOf` catches every failure and returns null, `bin/lib/channel.mjs:652-663`); the branch 'main' depends on
  the fixture (it runs `git init -b main`, `bin/sessions-background.test.mjs:90`).
- L16. 2026-10-29 03:00Z, the lead: landing #644 alone was refused at push, 35c8d1fd with no record, though the queue
  counted it ready. Read in the code: its commit was reviewed inside Codex `c8ee437..8a412b7` and the lenses'
  `62315e6..8a412b7`, and the two count against different tips (T5f). The lead chose the free path: #645 retargeted
  to main with head 2bd3bc72, carrying #644's commit; #644 closes as included when #645 lands; T5f an open follow-up.

## Next step
State at 2026-10-29 ~02:55Z (JH 79, worktree `D:\js-harness\.claude\worktrees\visual-pages`, branch
`feat/visual-pages-board` at 71d626c5, on `feat/visual-pages-b` (9b36b5b5), on `feat/visual-pages`):
- Slice A: #643 landed (main 837cedd); #644 on main, #645 on #644, landing in order by the queue.
- Slice B reviews: Codex rechecks done (67e6230..1f61e01 one P2 fixed; 1f61e01..71d626c correct 0.99); lenses all 0
  findings; gentle-ai lineage review-8ed9074b0701c90f (ca23a627..71d626c5) approved and acknowledged (L15). Slice B
  is fully reviewed.
- Then: push `feat/visual-pages-b` and `feat/visual-pages-board`; PRs stacked on #645 (bodies name T5e as the one
  Codex finding left open, the lead's decision; `board/summary.status` and `estimates` shapes); notify ready.
- Then answer the lead on spec 8 (T10 in slice C), slice C (T6, T7, T10), slice D (T8), T9.

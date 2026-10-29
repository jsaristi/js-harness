# templates

Branch `feat/templates`, from main (837cedd1). Runner: `node --test`. Session JH 80.

## Goal
Every output that reaches him again and again is a template of five parts (a sample he approved, a command that
renders it from the records, a golden test, a gate on the path to him and a test that the gate refuses a hand-made
one), a command scaffolds a new one from his `Plantilla:` line, and `js-harness template check` fails on any
registered template that lacks a part.

## Why
On 2026-10-29 at 02:44Z the lead showed a stretch's departure redrawn by hand, inline, with no map, against
`odd/tasks/visual-pages.md` ("never drawn by hand"). The rule lived only in prose and nothing refused the hand-made
page. The same had happened on 2026-10-27 with the live board: hand-written rows gave the lead two keys and the
board two orchestrators (the memory note `board-rows-through-notify`). His five lines that night (Specs) ask for
the cure: fewer protocols, outputs standardized by templates and proven, and a template of the process itself.
`docs/proposals/gentle-ai-reverse-engineering.md`, 13.1, says how gentle-ai holds what must be right: code decides it
and hands the model the next step as data, and the text is pinned like code; a strong model carries the rest,
unproven. `AGENTS.md` already says "When something can be checked by a command, it belongs in `bin/`, not in
prose", but the outputs he sees were never put under that rule one by one, and there is no repeatable way to add
one.

## Done when
- `npm run check` exits 0
- `node --test bin/template.test.mjs bin/lib/template-registry.test.mjs bin/lib/template-gate.test.mjs bin/lib/template-board-rows.test.mjs` exits 0
- `node bin/js-harness.mjs template check` exits 0
- `node bin/js-harness.mjs template --help` exits 0
- A test plants a registered template with one part missing and `template check` exits 1 naming that part
- A test feeds the board-rows gate a hand-written row (the 2026-10-27 case: a second key for the lead) and the gate
  refuses it, naming the command that makes the rows
- `docs/sessions/` holds this session's summary and `docs/ROADMAP.md` one line for it

## In scope / Out of scope
- In: this document; new `bin/template.mjs`, `bin/lib/template*.mjs` and their tests; `templates/` (the samples and
  their input records); one ROADMAP line; the session summary; the rule change through `js-harness rules change` on
  `rule/templates`.
- In, once the lead extends the edit surface (Ask me before): one dispatcher line and its help line in
  `bin/js-harness.mjs`; the gate's hook entry in `bin/lib/hook-entries.mjs` and the matcher install registers; the
  escape entry in `docs/FAILURES.md`; `"templates": true` in this repository's `harness.json`.
- Out: JH 79's pages and commands (`bin/lib/pages*.mjs`, `stretch`, `report`, `bin/lib/stale-board.mjs`): this
  feature lists them and gives them a gate, it does not rebuild them; `package.json` (not needed, see Design);
  credentials, `~/.claude`, `~/.codex`; the installed copy; evals.

## Constraints
- A template holds the form; judgment (what to recommend, which option is first) is not a template's and is
  measured by evals with a pass line, never called guaranteed.
- Replies stay free inside; only their close is gated (`rule:reply-five-states`, the Stop hook).
- The gate refuses only on positive evidence that an output did not come from its command; a record it cannot read
  lets the call through and is recorded as unchecked. It stops an accident (a lead that forgot the command), not a
  deliberate bypass: a model that fakes the records or marks a moment's page free is out of its reach, as
  gentle-ai's threat model leaves out the same-user actor (13.2, "The review").
- Zero dependencies. The two records live under the harness home, which `uninstall` keeps and names, as the page
  record of `odd/tasks/visual-pages.md` does.
- High-risk items (CLAUDE.md, Task Size): the gate's hook entry is a `PreToolUse` hook install writes for every
  session of the machine (delivery, guard). It acts only where a project's `harness.json` turns it on, fails open,
  and gets its tests first, the slice's reviews and one independent verifier.

## Ask me before
His words decide the feature (Specs 5: "hagamos una plantilla de esto"); the design passes two blind readers
before code (`rule:double-review`). Through the lead, before T4: the edit-surface extension above, since the brief
lists only the new files.

## Specs
1. "me mostraste las coasas diferente a como habiamos planeado, no entiendo por que nuestros protocolos no quedan
   estandarizados? sera que menos protocolo y siempre generamos un eval o un template para que siempre muestre las
   cosas como quiero? y que asi se estandarice y no muestre algo diferente cada vez. dime como lo tengo que pedir por
   que siempre equivocas y siento es que yo no te pido las cosas paras que el arnes funcione como debe" (line 14721,
   2026-10-29T02:46:58Z).
2. "siento entonces que he hecho todo mal y hay que hacer plantillas de todo y estandarizar todo por que asi como
   estamos haciendo las cosas no estan funcionando y la verdad ya tengo mucho desgaste y esa tambien es una de las
   razones por la cuales el anterior arnes no funcionaba, dime en realidad como es que tiene que quedar todo para que
   cada una de las cosas quede estandarizado y se cumpla como debe, osea como lo hace gentle-ai que funciona tambien
   en todo, dime tambien como lo debemos hacer nosotros por que entonces yo te estoy diciendo las cosas mal y no con
   las palabras ni las cosas que son." (line 14832, 2026-10-29T02:51:42Z).
3. "es que entiendo que los modelos al ser probabilisticos, siempre van a hacer las cosas de una manera distinta y el
   arnes lo que hace es que genera consistencia, como a partir de lo que me dices y lo que hemos investigado de como
   funcionan las otras cosas, podemos hacerlo para que funcione SI o SI como debe." (line 14968,
   2026-10-29T02:55:49Z).
4. "listo pero para que funcione y el limite honesto, entonces dime exactamente como se tiene que hacer todo pero que
   realmente funcione y que se pruebe" (line 15080, 2026-10-29T02:59:40Z).
5. "ok listo entonces hagamos una plantilla de esto para que cuando vayamos a hacer este proceso siempre lo tengamos a
   la mano y podamos generar las demas plantillas de todo." (line 15262, 2026-10-29T03:03:29Z).

All in the lead's transcript `0f71b2c6-cbce-43ca-a031-276a4b2c381f`, read with `js-harness sessions --quote`.

## Design

### Searched before adding (AGENTS.md, `rule:reuse-first`)
- `js-harness contract template`, `summary template`, `onboard template`: print a skeleton the model fills. None
  renders from records, none is gated on the way to him; they keep their name, and `template` here is a different
  thing (an output he sees), so the help says so in one line.
- `bin/lib/pages.mjs` and `pages-record.mjs` (JH 79, branch `feat/visual-pages`, slice A built): the renderer and
  the numbers of the moments' pages. They record numbers, not the hash of what was shown, and nothing gates a
  publish. Reused as the renderers of those templates; not rebuilt.
- `bin/conventions-*.test.mjs`: tests that hold every file of a kind to a shape, with a legacy list that only
  shrinks. `template check` takes their form (a test runs it over the repository), not their scope.
- `rules check`: holds each rule to its source and phrases. A template is not a rule; the rule that says how a
  template is made is amended (below).
- `report` (facts as lines, `--mark`), `stretch` (plan, measure, departure and return renders): renderers of their
  moments, with no gate.
- The hooks install writes (`bin/lib/hook-entries.mjs`): `guard`'s `PreToolUse` matcher (line 81) names `Agent`,
  `Bash`, the file tools and the session tools, and no `Artifact`, `ArtifactData` or `AskUserQuestion`; the `Stop`
  hooks are `guard --stop`, `reply --hook` and `backup --hook`. So today nothing on the path to him can refuse a
  page, a board row or a question that did not come from its command.
- `bin/lib/live-rows.mjs`: `rowOf(notice)` (line 25) is pure and gives the same row for the same notice on every
  run, so a gate can recompute a board row from the channel record.

### The five parts, and two kinds of template
Each recurring output that reaches him is a template with five parts:
1. a sample he approved, a file under `templates/<id>/`;
2. the command that renders it from the records;
3. a golden test of the command against the sample, run by `node --test`, so by every gate;
4. a gate on the path to him that refuses what did not come from the command;
5. a test that feeds the gate a hand-made one and proves it refuses it.

A template is one of two kinds, named in its registry entry:
- `rendered`: a command makes the whole output (a page, the board's rows). The golden test renders the sample's
  input records (`templates/<id>/records.json`) and compares with the sample byte for byte. The gate admits only an
  output the command made: a page whose sha256 the command recorded, or a row it can recompute from the record.
- `shape`: the model writes it inside a reply, and only its form is held (the reply's close, the cut's block). Part
  2 is the grammar the gate reads (`bin/lib/reply.mjs`, `closingState`); the golden test proves the approved sample
  parses as its state; the gate is the `Stop` hook, which turns the stop back once.
His line 14721 asks for "un eval o un template": what a template cannot hold, the judgment inside an output, is an
eval's (Constraints).

### The registry (`bin/lib/template-registry.json`)
One entry a template, read by the gate at run time, so it ships with `bin/` (the samples and tests do not):
`{ id, kind, plantilla: { what, when, looks, where }, render, renderer, golden, gate: { at, admit }, refusal, since,
source }`. `plantilla` is his line's four fields: what he wants to see, when it appears, how it looks (the sample's
path) and where it reaches him. `render` is the command line; `renderer` the module; `golden` and `refusal` the test
titles, `template:<id> golden` and `template:<id> refuses a hand-made one`; `gate.at` one of `artifact`,
`artifact-data`, `ask`, `stop`, `command:<name>`; `gate.admit` the export of the template's module the gate calls;
`source` his words that approved the sample (transcript and line). Only a template with all five parts is
registered; an output still missing one stays a row of the inventory below, not an entry.

### `js-harness template` (`bin/template.mjs`, `bin/lib/template*.mjs`)
- `template new <id> --what <text> --when <text> --where <place> --sample <file> [--kind rendered|shape]`: the
  template of templates (spec 5). It refuses with exit 2 and names only the first missing field, so the lead asks
  him for that one alone. It writes `templates/<id>/sample.<ext>` (a copy of the file he approved) and an empty
  `records.json`; `bin/lib/template-<id>.mjs`, the renderer with its header comment (what it is for, his
  `Plantilla:` line, the sample's path) and `render`, `admit` exports that throw "not built yet"; and
  `bin/lib/template-<id>.test.mjs` with the golden and the refusal tests, which fail until the renderer and the gate
  are written, so the commit that adds them is test-first by construction; and its registry entry. It writes over
  nothing that exists.
- `template check`: for each entry, the sample, the records, the module and its two exports, and the test file with
  both titles exist, the module's header names the sample, and `gate.at` is a known gate; and no two entries share
  an id. Exit 1 names each template and the part it lacks. It reads files only and runs nothing.
- `template list`: the registry as rows, with `--json`.
- `template gate --hook`: the `PreToolUse` hook (part 4, shared by every template): reads the payload, finds the
  template that claims the call by `gate.at` and calls its `admit`; a call no template claims passes. Acts only where
  the nearest `harness.json` holds `"templates": true`, as `reply` acts only where it holds `reply`.
- `template shown [--days <n>]`: the escape row (Proof below).
`template check` runs on every commit because `bin/template.test.mjs` holds the test "this repository's registry
passes template check": the pre-commit hook and CI run `bin/check.mjs` (`.githooks/pre-commit`,
`.github/workflows/gate.yml:42`), whose tests sensor runs `node --test`, so `package.json` needs no change.

### The two records
- Rendered, `<home>/.js-harness/templates/<project>/rendered.jsonl`: `{ schema: 'js-harness.rendered/v1', template,
  sha256, at, head, path }`, appended by `recordRendered` (`bin/lib/template-record.mjs`), which a `rendered`
  template's command calls when it writes its output.
- Shown, `shown.jsonl` beside it: `{ schema: 'js-harness.shown/v1', at, session, tool, template | null, decision:
  admitted | refused | free | unchecked, sha256, reason }`, appended by the gate on every call it judges.
Append only; a cut last line is ended first, as the stretch record does.

### The gates on the path to him
- `artifact` (`PreToolUse` on `Artifact`, action publish): a page whose sha256 is a line of the rendered record is
  admitted as its template; a page that carries `<meta name="js-harness-page" content="free: <reason>">` with a
  reason of at least 20 characters is admitted as free and recorded (research, a design, an inventory: what no
  record holds); any other page is refused, and the reason names the commands of the registered page templates and
  the free mark. The desktop's visual tool, where a page is shown inline, gets the same check once its tool name is
  read from a real payload.
- `artifact-data` (`PreToolUse` on `ArtifactData`): a write to the board's `events` collection (the url of the
  cursor `sessions live` keeps) is admitted when every row, without its `sesion` and `texto` fields (the lead's
  Spanish words, free by `rule:live-board`), equals `rowOf` of a notice of the channel record; a row with no such
  notice is refused, naming `js-harness sessions live --out <dir>`.
- `ask` (`PreToolUse` on `AskUserQuestion`): a question whose text opens with `Pregunta <n>: ` and equals record
  `n`'s text is admitted; one with no record is refused, naming `js-harness notify --kind question`
  (`rule:questions-one-place`: recorded before it is asked).
- `stop`: the existing `reply --hook`; no new hook.
- `command:<name>`: a command that refuses its input already (`notify --kind closed` refuses an empty summary).
Each refusal ends with the exact command to run, as 13.3 row 1 asks. Whether Claude Code runs a `PreToolUse` hook
before `Artifact`, `ArtifactData` and `AskUserQuestion` is an assumption [i]; T4 checks it first with a scratch hook
that logs the payload, and a tool that runs no hook gets its check at the `Stop` hook instead (a reminder, not a
refusal), said in the inventory.

### The inventory (b)
Parts: S sample, R renderer, G golden test, Q gate, F refusal test. A refusal's cost is one retry; tokens are an
estimate [e] of the retry's tool calls, the context re-read is cached. Colour on his page: green has all five, amber
has some, red is prose only.

| Output | Made today by | Parts | Gate on the path to him | A refusal costs | Smallest fix |
|---|---|---|---|---|---|
| The live board, its rows and colored status list | `sessions live --out` (`rowOf`); the lead adds `sesion`, `texto` and sends with `ArtifactData`; the page is `docs/live-board.html` | S (the page), R, G (`live-rows.test`) | none: hand rows went through on 2026-10-27 | re-run `sessions live --out`, send the file: ~2k [e] | **The proof (T5):** sample and golden of a batch, the `artifact-data` gate, its refusal test |
| A stretch's departure and return | `stretch open/close --html`; JH 79 adds the shares, the map and the timeline | R, G | none: the 02:44Z hand redraw went through | run the command, publish its file: ~3k [e] | JH 79's pages call `recordRendered`; the `artifact` gate; the sample is the first page he approves |
| The status report | `report` gives facts as lines and the lead writes the sections; JH 79 adds `report --html --notes` | R (part) | none | ~3k [e] | as above, once JH 79's T6 lands |
| A feature's close | by hand today; JH 79's `report feature` (T6, to build) | none yet | none | ~3k [e] | as above |
| A phase's change | by hand today; JH 79's `report phase` (T6) | none yet | none | ~3k [e] | as above |
| A question to him | `notify --kind question` records it and its number; the lead asks with `AskUserQuestion` | S (the fields), R (the number, the header) | none on the tool | record it, ask again: ~1.5k [e] | the `ask` gate and its refusal test |
| The reply's closing line | the model, in the labels of `harness.json` `reply` | S (his labels, 2026-10-07), R (`closingState`), G, Q (`reply --hook`), F (`reply.test`) | the `Stop` hook, once a stop | the close written again: ~0.5k [e] | register it as a `shape` template: entries only |
| The cut block | the model; the opening it carries from `notify --opening` | S, R (`cutRefusal`), Q (`Stop`), F | the `Stop` hook | ~0.5k [e] | register as `shape` |
| A mistake report | the model, in the five parts of `rule:mistake-report` | none | none; `failures check` holds the register's lines, not the report | — | stays prose: it lives inside a reply and its content is judgment; its `Seen:` line is held by `failures check`, and an eval case measures the five parts |
| A stretch recap ("what was spent") | the model | none | none | — | folds into the stretch's return page (JH 79), which carries the spend the records hold |
| A session's opening prompt | `startPrompt` and `LEAD_OPENING_PROMPT` (constants in code); the brief by the lead | R (the line); the brief none | none on the brief | — | the line stays code; the brief gets `brief check` at `sessions start` as its own feature (to the lead) |
| A session summary | `summary template`, filled by the session | S, R (skeleton) | `notify --kind closed` refuses an empty section | fill it, notify again: ~1k [e] | none needed now |
| A free page (research, a design, this inventory) | the model, by `rule:reports-spanish-visual` | none | the `artifact` gate admits it only marked free with its reason | add the mark: ~0.3k [e] | stays free: its content is no record's; `template shown` lists every free page |
| The lead's ordinary replies | the model | — | only the close (row above) | — | stay prose by design (Constraints) |

### The rule (c)
`rule:rules-live-in-the-harness` holds that a rule he gives is cemented where something acts on it. It is amended,
on `rule/templates` through `js-harness rules change rules-live-in-the-harness`, quoting his lines 14721 and 15262
with their date, 2026-10-29: an output he sees again and again is cemented as a template of five parts; he asks for
one in one line, `Plantilla: qué quiero ver · cuándo aparece · cómo se ve (la muestra que apruebo) · dónde me llega`;
the lead turns it into `template new` and asks for a missing field alone; an escape becomes a `docs/FAILURES.md`
`Seen:` line and a new refusal test. Chosen over `reports-spanish-visual`, which JH 79 amends on
`rule/visual-moments` at the same time (two changes of one rule would conflict), and because a template is about
any output, not only a page.

### How we prove it is followed (d)
- `template check`, in every gate through `bin/template.test.mjs`: when it holds it prints `templates: <n>
  registered, every part present` and exits 0; a missing part fails the commit.
- `template shown --days 7`: per template, rendered, admitted, refused and unchecked counts; every free page with its
  reason; and every moment a record holds with no admitted output of its template (a stretch closed with no return
  page shown, a question recorded and never asked through the gate). When it holds it prints `no escapes in <n>
  days`. The heartbeat's row for it is the lead's, after this feature.
- Every escape it lists, or he reports, is a `Seen:` line of the register entry `hand-made-output` and a refusal test
  of the template it escaped; `js-harness failures` counts them, so a recurrence shows as a new `Seen:` line.

### Slices
Docs first: this document, alone, as a docs-only pull request. Then, after it lands: A, `template new`, the
registry, `template check` and `list`, each test first (T3); B, the gate, the records and the board rows end to end
(T4, T5), with the surface the lead extends. Each slice through Codex and the Claude lenses before its pull request.

## Tasks
- [ ] T1 (kind: design) this document, the inventory page for him, and two blind readers (rule:double-review). Spec 1-5. Route: inline, readers delegated.
- [ ] T2 (kind: docs) the docs-only pull request and its ready notice. Spec 5. Route: inline.
- [ ] T3 (kind: build) `template new`, the registry, `template check` and `list`, tests first. Spec 5. Route: inline.
- [ ] T4 (kind: build) the hook probe, then `template gate --hook`, the two records and `template shown`. Spec 3, 4. Route: inline.
- [ ] T5 (kind: build) the board rows as the first template, end to end, with the escape entry. Spec 1, 4. Route: inline.
- [ ] T6 (kind: build) the rule change on `rule/templates`. Spec 1, 5. Route: inline.
- [ ] T7 (kind: docs) the session summary and the ROADMAP line. Route: inline.

## Log
- L1. 2026-10-29, the lead's brief for JH 80 (its five lines of his, the recipe it gave him at line 15080, the
  task). His five lines read with `js-harness sessions --quote` (Specs).
- L2. 2026-10-29, searched before adding, as Design says: no command renders an output he sees and refuses one not
  from it; no hook matches `Artifact`, `ArtifactData` or `AskUserQuestion`. JH 79's branch (`feat/visual-pages-b`,
  read at 03:15Z) builds the pages and a stale-board reminder, not a hash gate, so the gate here serves its pages
  too; told to the lead.
- L3. 2026-10-29, the board rows chosen as the proof (the brief's first choice): JH 79 covers the board's freshness
  (stale-board, start row, running block, last three done), not whether a row came from the record.

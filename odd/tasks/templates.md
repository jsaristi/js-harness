# templates

Branch `feat/templates`, from main (837cedd1). Runner: `node --test`. Session JH 80.

## Goal
A repeatable way to make an output he sees a template of five parts (a sample he approved, a command that renders
it from the records, a golden test, a gate on the path to him, a test that the gate refuses a hand-made one): a
scaffold from his `Plantilla:` line, a registry that `js-harness template check` holds on every commit, one gate
that every template uses, an inventory that gives every recurring output its route, and one output converted end to
end as the proof.

## Why
On 2026-10-29 at 02:44Z the lead showed a stretch's departure redrawn by hand, inline, with no map, against
`odd/tasks/visual-pages.md` ("never drawn by hand"): it passed its HTML to the desktop's visual tool
(`mcp__visualize__show_widget`, the lead's transcript line 14687), and nothing refused it. The same had happened on
2026-10-27 with the live board: hand-written rows gave the lead two keys and the board two orchestrators (the memory
note `board-rows-through-notify`). His five lines that night (Specs) ask for the cure: fewer protocols, outputs
standardized by templates and proven, and a template of the process itself.
`docs/proposals/gentle-ai-reverse-engineering.md`, 13.1, says how gentle-ai holds what must be right: code decides it
and hands the model the next step as data, and the text is pinned like code; a strong model carries the rest,
unproven. `AGENTS.md` already says "When something can be checked by a command, it belongs in `bin/`, not in
prose", but the outputs he sees were never put under that rule one by one, and there is no repeatable way to add
one.

## Done when
- `npm run check` exits 0
- `node --test bin/template.test.mjs bin/lib/template-registry.test.mjs bin/lib/template-gate.test.mjs bin/lib/template-record.test.mjs bin/lib/template-board-rows.test.mjs` exits 0
- `node bin/js-harness.mjs template check` exits 0
- `node bin/js-harness.mjs template --help` exits 0
- Tests plant registered templates that are broken and `template check` exits 1 naming the fault: a part missing, a
  draft entry, a scaffold body still throwing, a skipped golden or refusal test, a sample whose bytes no longer
  match the digest he approved, a surface no installed hook reaches
- A test feeds the board gate a hand-written row (the 2026-10-27 case: a second key for the lead) and the gate
  refuses it naming `js-harness sessions live --out`; a test feeds it a real batch from `sessions live --out` and the
  gate admits it
- A test feeds the page gate the 02:44Z case (a page with the renderer's signature and no recorded hash, by
  `show_widget` and by `Artifact`) and the gate refuses it, and refuses it marked free
- `docs/sessions/` holds this session's summary and `docs/ROADMAP.md` one line for it

## In scope / Out of scope
- In: this document; new `bin/template.mjs`, `bin/lib/template*.mjs` and their tests; `templates/` (the samples and
  their input records); one ROADMAP line; the session summary; the rule change through `js-harness rules change` on
  `rule/templates`.
- In, by the lead's extension of 2026-10-29 (L4): one dispatcher line and its help line in `bin/js-harness.mjs`; the
  gate's hook entries in `bin/lib/hook-entries.mjs`; one entry in `docs/FAILURES.md`; `"templates": true` in this
  repository's `harness.json`.
- In, if the lead extends the surface again (asked in the ready notice): the files that must move with a hook entry,
  `bin/lib/manifest.mjs` (its registration), `bin/lib/manifest.test.mjs` and `scripts/practice-lib.mjs`
  (`HARNESS_HOOKS`), which hold the matcher text (`bin/lib/hook-entries.mjs:76-77`); and one `templates` row in
  `bin/doctor.mjs` (Proof).
- Out: JH 79's pages and commands (`bin/lib/pages*.mjs`, `stretch`, `report`, `bin/lib/stale-board.mjs`) and the
  board's look (JH 79's slice B, "colored status", the lead's plan at line 14663): this feature gives them the gate
  and the record, it does not rebuild them; `package.json` (not needed, see Design); credentials, `~/.claude`,
  `~/.codex`; the installed copy; eval runs (the cases are defined, not run).

## Constraints
- A template holds the form; judgment (what to recommend, which option is first) is not a template's and is
  measured by evals with a pass line, never called guaranteed.
- Replies stay free inside; only their close is gated (`rule:reply-five-states`, the Stop hook).
- A call the gate claims is refused unless it carries its proof (a recorded hash, rows the record recomputes, a
  recorded question); a record it cannot read lets the call through and is recorded as unchecked, and an unchecked
  call keeps `template shown` from saying "no escapes". It stops a model's mistake, including a wrong "free" on a
  moment's page (below), not a deliberate bypass: a model that fakes the records is out of its reach, as gentle-ai's
  threat model leaves out the same-user actor (13.2, "The review").
- The gate is Claude Code's: the tools it watches (`Artifact`, `ArtifactData`, `AskUserQuestion`,
  `mcp__visualize__show_widget`) exist only there. Codex works here as a reviewer (ROADMAP, Principle 5) and shows
  him nothing, so it has no gate; a project that leads from Codex is out of scope.
- Zero dependencies. The records live in the throughput folder under the harness home, which `uninstall` never
  removes (`throughputResult`, `bin/lib/manifest.mjs`), beside JH 79's page record.
- High-risk items (CLAUDE.md, Task Size): the gate's hook entries are a `PreToolUse` and a `PostToolUse` hook install
  writes for every session of the machine (delivery, guard). They act only where a project's `harness.json` turns
  the gate on, fail open, and get their tests first, the slice's reviews and one independent verifier.

## Ask me before
His words decide the feature (Specs 5: "hagamos una plantilla de esto"); the design passes two blind readers
before code (`rule:double-review`). The edit surface beyond the brief's new files is the lead's to extend (L4, and
the second ask above).

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
  publish (`git grep "sha256\|createHash" origin/feat/visual-pages-b`: nothing). Reused as the renderers of those
  templates; not rebuilt.
- `bin/conventions-*.test.mjs`: tests that hold every file of a kind to a shape, with a legacy list that only
  shrinks. `template check` takes their form (a test runs it over the repository), not their scope.
- `rules check`: holds each rule to its source and phrases. A template is not a rule; the rule that says how a
  template is made is amended (below).
- `report` (facts as lines, `--mark`), `stretch` (plan, measure, departure and return renders): renderers of their
  moments, with no gate.
- The hooks install writes (`bin/lib/hook-entries.mjs`): `guard`'s `PreToolUse` matcher (line 81) names `Agent`,
  `Bash`, the file tools and two desktop MCP tools (`mcp__ccd_session__start_session`,
  `mcp__terminal__run_in_terminal`), and no `Artifact`, `ArtifactData`, `AskUserQuestion` or
  `mcp__visualize__show_widget`; the `Stop` hooks are `guard --stop`, `reply --hook` and `backup --hook`. So today
  nothing on the path to him can refuse a page, a board row or a question that did not come from its command, and a
  `PreToolUse` hook does reach a desktop MCP tool.
- `bin/lib/live-rows.mjs`: the rows `sessions live --out` writes come from `pendingRows` (line 56), which adds each
  notice's index in the record (`seq`) and suffixes `-2`, `-3` to a repeated id, over `rowOf` (line 25), which is
  pure. So a gate can recompute a batch from the channel record, by `seq`.

### The five parts, and two kinds of template
Each recurring output that reaches him is a template with five parts:
1. a sample he approved, a file under `templates/<id>/`, pinned by its sha256 and his words (the registry);
2. the command that renders it from the records;
3. a golden test of the command against the sample, run by `node --test`, so by every gate;
4. a gate on the path to him that refuses what did not come from the command;
5. a test that feeds the gate a hand-made one and proves it refuses it.

A template is one of two kinds, named in its registry entry:
- `rendered`: a command makes the whole output (a page, the board's rows). The golden test renders the sample's
  input records (`templates/<id>/records.json`) and compares with the sample byte for byte.
- `shape`: the model writes it inside a reply, and only its form is held (the reply's close, the cut's block). Part
  2 is the grammar the gate reads (`closingState`, `replyRefusal`, `bin/lib/reply.mjs`); the golden test proves the
  approved sample parses as its state; the gate is the `Stop` hook, which turns the stop back once, after the reply
  is shown. Registering one takes its entry and its test file; `cutRefusal` stays private, reached through
  `replyRefusal`.
His line 14721 asks for "un eval o un template": what a template cannot hold, the judgment inside an output, is an
eval's (The evals, below).

### The registry (`bin/lib/template-registry.mjs`)
A frozen array the gate reads at run time, so it ships with `bin/` (the samples and tests do not). An entry:
`{ id, kind, surface, plantilla: { what, when, looks, where }, sample: { path, sha256, source }, render, module,
exports: { render, admit }, tests: { golden, refusal }, signature, draft }`.
- `plantilla` is his line's four fields: what he wants to see, when it appears, how it looks (the sample), where it
  reaches him. `sample.source` is his words that approved it (transcript and line); `sample.sha256` pins its bytes,
  so a new sample needs a new digest and new words in the same commit, visible in its diff.
- `surface` is the one gate that holds it: `page` (a page shown by `Artifact` or `show_widget`), `board`, `ask`,
  `stop`, or `command:<name>`. A surface's check is written once, in `bin/lib/template-gate.mjs`; every `page`
  template shares the page check, so two templates never compete for one call.
- `signature`: the mark only its renderer writes, a `data-js-harness-template="<id>"` attribute on the page's root,
  which the page gate reads (below).
- `tests`: the titles `template:<id> golden` and `template:<id> refuses a hand-made one`.
- `draft`: true from `template new` until the commit that completes it.

### `js-harness template` (`bin/template.mjs`)
- `template new <id> --what <text> --when <text> --where <place> --sample <file> --source <transcript>:<line>
  [--kind rendered|shape] [--surface <surface>]`: the template of templates (spec 5). It refuses with exit 2 and
  names only the first missing field, so the lead asks him for that one alone. It writes `templates/<id>/sample.<ext>`
  (a copy of the file he approved) and an empty `records.json`; `bin/lib/template-<id>.mjs`, the renderer with its
  header comment (what it is for, his `Plantilla:` line, the sample's path) and `render` and `admit` exports whose
  body throws `template <id>: not built yet`; `bin/lib/template-<id>.test.mjs` with the two tests, which fail until
  the renderer and the gate are written; and its entry with `draft: true`. It writes over nothing that exists.
- `template check`: exit 1 names each template and its fault; it reads files only and runs nothing. For each entry:
  it is not a draft; its sample exists and its bytes match `sample.sha256`; its records, module and test file exist;
  the module exports the named functions and holds no `not built yet`; the test file holds both titles, not under
  `skip` or `todo`; its surface is one the installed hooks reach (the matcher of `bin/lib/hook-entries.mjs` names the
  surface's tools); no two entries share an id or a signature. What it cannot see, a golden test that passes for the
  wrong reason, is the reviews' to catch, and the gate's own tests feed it real command output.
- `template list`: the registry as rows, with `--json`.
- `template gate --hook` (`PreToolUse`) and `template gate --shown` (`PostToolUse`): the one gate, on the tools of
  every surface but `stop`. It acts only where the nearest `harness.json` holds `"templates": true`, as `reply` acts
  only where it holds `reply`.
- `template shown [--days <n>] [--json]`: the escape list (Proof).
`template check` runs on every commit because `bin/template.test.mjs` holds the test "this repository's registry
passes template check": the pre-commit hook and CI run `bin/check.mjs` (`.githooks/pre-commit`,
`.github/workflows/gate.yml:42`), whose tests sensor runs `node --test`, so `package.json` needs no change. With
`"exactTests": "skip"` (this repository's `harness.json`) the test runs when a file it reads changes, and the tracer
records the existence checks and folder listings it makes (`bin/lib/trace-reads.cjs:236-237`).

### The records
Both under `<home>/.js-harness/throughput/<slug>/`, `slug` the project's as the page record and the channel name it
(`D--js-harness` here), so `uninstall` keeps them with the throughput folder. Append only: one `appendFileSync` of
the whole line, its newline included, after a line left without its newline is ended, as the channel record does
(`bin/lib/channel.mjs:291`); a reader skips a line that does not parse, so a cut last line is never read as a
record. A test runs two writers of 200 lines each at once and reads 400 whole lines.
- `templates-rendered.jsonl`: `{ schema: 'js-harness.rendered/v1', template, subject, sha256, bytes, at, head, path
  }`. The contract JH 79's page commands build against (the lead, L4), in `bin/lib/template-record.mjs`:
  - `renderedFile(home, slug)`: the path, in the shape of `pagesFile`;
  - `recordRendered(file, { template, subject, path, at, head }, fileSystem = fs)`: reads the bytes of `path` as they
    are on disk once the command has written them, appends one line with their sha256 (and the sha256 of the same
    text with `\r\n` as `\n` and trailing spaces cut, `normal`, which the `show_widget` check uses), and returns it. A
    file it cannot read or a line it cannot write throws: the command says so and its page stays unpublishable,
    never published unrecorded.
  - `template` is the page template's id (`stretch-departure`, `stretch-status`, `stretch-return`, `feature-close`,
    `phase-change`, `status-report`); `subject` the moment's id as the page record names it (the stretch's id, the
    feature document's path, `map`); `head` the default branch's commit the page read.
- `templates-shown.jsonl`: `{ schema: 'js-harness.shown/v1', at, session, tool, template, subject, decision, sha256,
  reason }`, `decision` one of `refused`, `admitted`, `free`, `unchecked` written by `--hook` before the call, and
  `shown` written by `--shown` after a call that succeeded, carrying what `--hook` decided. Only `shown` says he saw
  it. A line the gate cannot append is said on standard error and the decision stands; `template shown` then cannot
  read it, and says how many calls its counts may miss (the host's transcript holds every call).

### The gates on the path to him
Each refusal ends with the exact command to run, as 13.3 row 1 asks.
- `page` (`Artifact` publish with a page, and `mcp__visualize__show_widget`). The page is the published file's bytes,
  or the widget's code. Admitted as its template when its sha256 (for a widget, its `normal` hash) is on a line of the
  rendered record no older than `RENDERED_FRESH_HOURS` (6): an old page republished as a new moment's is refused.
  Admitted as free when it carries `<meta name="js-harness-page" content="free: <why, 20 characters or more>">` and
  neither of two proofs of a moment holds: it carries a registered template's signature (the 02:44Z widget kept the
  renderer's classes), or a moment of a page template is open, a stretch opened or closed in the stretch record with
  no `shown` page of its template and subject since. A model that wrongly marks a moment's page free is refused by
  either proof; one that strips the signature while a moment is closed and recorded is not, and the escape list names
  it. Anything else is refused with:
  `js-harness template gate: this page came from no template command (sha256 <first 12 hex> is not in <rendered
  file>). Make it with its command and publish that file unchanged: <one line a page template: its id and its render
  command>. If no record holds what it shows, mark it free: <meta name="js-harness-page" content="free: <why, 20
  characters or more>">.` A moment's page goes by `Artifact` with the file the command wrote, never retyped into a
  widget; a widget is admitted only when its code is that file's text (`normal` hash), so the refusal of a retyped
  widget names the `Artifact` route. An `Artifact` call with no page (an asset upload, a create from a type, a read,
  a list) is not the gate's; a `files` update is checked page by page.
- `board` (`ArtifactData` `set`, `update` or `batch`, by `file_path` or inline `data`, to the url the cursor of
  `sessions live` keeps): a write to `events` is admitted when every row, without `sesion` and `texto`, equals the
  row of the same `seq` that `pendingRows(notices, null, epoch)` gives for the channel record now; a row with no
  `seq`, or another row there, is refused naming `js-harness sessions live --out <dir>`. A write to `board/summary`
  is admitted when its command fields (the check time, until when, resting, the open stretch) equal the
  `board-checked.json` that `sessions live` wrote last; its words ("what you say now") stay the lead's. On the board
  he reads `sesion` and `texto`, which stay free: the gate holds who, when, what kind and which state, not the
  wording.
- `ask` (`AskUserQuestion`): admitted when the question opens with `Pregunta <n>: `, record `n` is a question not yet
  answered or withdrawn, and its text and option labels equal the record's; refused otherwise, naming `js-harness
  notify --kind question` (`rule:questions-one-place`: recorded before it is asked).
- `stop`: the existing `reply --hook`; no new hook.
- `command:<name>`: a command that refuses its input already (`notify --kind closed` refuses an empty summary).
Whether Claude Code runs a hook before `Artifact`, `ArtifactData` and `AskUserQuestion` is an assumption [i] (it does
for desktop MCP tools, by the matcher above); T4 checks each with a scratch hook that logs the payload before
anything is built on it. A tool that runs no hook gets its check at the `Stop` hook instead, a reminder after the
fact, and the inventory says so.

### The inventory (b)
Parts: S a sample he approved, R a command that renders it, G a golden test against the sample, Q a gate on the path
to him, F a test that the gate refuses a hand-made one. A refusal's cost is one retry; its tokens are an estimate [e]
of the retry's tool calls (the context read again is cached). His page colours them as the brief does: green has
all five; amber is a template (a sample or a command) still missing the gate or a test; red is prose only. None is
green today.

| Output | Made today by | Parts | Gate on the path to him | A refusal costs | Smallest fix |
|---|---|---|---|---|---|
| The board's rows and its coloured status list | `sessions live --out` (`pendingRows`); the lead adds `sesion`, `texto` and sends with `ArtifactData` | R | none: hand rows went through on 2026-10-27 | `sessions live --out` again, send the file: ~2k [e] | **The proof (T5)**: a sample batch he approves, its golden, the `board` gate and its refusal test; the look is JH 79's |
| The board's summary (`board/summary`) | the `ArtifactData` update `sessions live` prints, with the lead's words | R (its command fields) | none | ~1k [e] | in T5: its command fields under the `board` gate |
| The board page itself (`docs/live-board.html`) | republished by the lead after a merge | R (the file) | none | ~1k [e] | a `page` template whose command is the file; sample approved by the lead on his delegation, not by him (`live-board.md`, L9), so he approves it first |
| A stretch's departure, status and return | `stretch open/status/close --html`; JH 79 adds shares, map and timeline | R | none: the 02:44Z widget went through | the command, then `Artifact` with its file: ~3k [e] | JH 79's commands call `recordRendered` and write the signature; the `page` gate; the sample is the first page he approves |
| The status report | `report` gives facts as lines and the lead writes the sections; JH 79 adds `report --html --notes` | R (part) | none | ~3k [e] | as above, once JH 79's T6 lands |
| A feature's close | by hand today; JH 79's `report feature` (T6) | none yet | none | ~3k [e] | as above |
| A phase's change | by hand today; JH 79's `report phase` (T6) | none yet | none | ~3k [e] | as above |
| A question to him | `notify --kind question` records it and its number; the lead asks with `AskUserQuestion` | R (the number and header) | none on the tool | record it, ask again: ~1.5k [e] | the `ask` gate and its refusal test; a sample he approves |
| A permission card relayed to him | `permit` (the `PermissionRequest` hook, `bin/lib/hook-entries.mjs:89-95`) | R | the host's card itself | — | a `shape` template once he names how it looks; today the host draws it |
| The reply's closing line | the model, in the labels of `harness.json` `reply` | S (his labels, 2026-10-07), Q (`reply --hook`), F (`reply.test`) | the `Stop` hook, once a stop, after it is shown | the close written again: ~0.5k [e] | register as `shape`: its entry and a test file with the golden |
| The cut block | the model; the opening it carries from `notify --opening` | S, Q (`Stop`), F | the `Stop` hook | ~0.5k [e] | register as `shape` |
| The pause notice near the context limit | `cutRule` (`bin/lib/sessions.mjs`) gives its text | R | none | — | a `shape` template on the reply that carries it, after the two above |
| The push notification when the machine goes quiet | the lead, by `bin/lib/manifest.mjs:160` | none | none | — | stays prose: its words are one line; a `command:` template if he asks for a fixed form |
| The desktop's wrap-up recap | the model, at the desktop's prompt | none | none | — | stays prose: the host asks for it and shows it; its facts come from the stretch's return page |
| A mistake report | the model, in the five parts of `rule:mistake-report` | none | none; `failures check` holds the register's lines, not the report | — | stays prose: it lives in a reply and is judgment; its `Seen:` line is held by `failures check`, the five parts by an eval (below) |
| A throughput review | `js-harness throughput`, `reviewed` records it | R (the measures) | none | — | stays prose: each candidate is judgment; the record is the command's |
| A stretch recap ("what was spent") | the model | none | none | — | folds into the stretch's return page, which carries the spend the records hold |
| A session's opening prompt | `startPrompt`, `LEAD_OPENING_PROMPT` (code); the brief by the lead | R (the line) | none on the brief | — | the line stays code; a `brief check` at `sessions start` is its own feature (to the lead) |
| A session summary | `summary template`, filled by the session | R (skeleton) | `notify --kind closed` refuses an empty section | fill it, notify again: ~1k [e] | none needed now |
| A free page (research, a design, this inventory) | the model, by `rule:reports-spanish-visual` | none | the `page` gate admits it only marked free, with no moment open and no template's signature | add the mark: ~0.3k [e] | stays free: no record holds its content; `template shown` lists each one with its reason |
| The lead's ordinary replies | the model | — | only the close (above) | — | stay prose by design (Constraints) |

### The evals (judgment, defined here, run by F5)
Two cases, written to `evals/` by the F5 owner and run only when F5 spends:
- a mistake report: given a planted failure, the reply holds the five parts of `rule:mistake-report`, each named;
  pass line 9 of 10 runs;
- a question: given a decision with a recommended option, the question puts it first with "(Recomendada)", says what
  a yes covers and what it does not, and asks one thing; pass line 9 of 10 runs.
Neither is called guaranteed; the pass line is what is claimed.

### The rule (c)
`rule:rules-live-in-the-harness` holds that a rule he gives is cemented where something acts on it. It is amended,
on `rule/templates` through `js-harness rules change rules-live-in-the-harness`, quoting his lines 14721 and 15262
with their date, 2026-10-29. Its subject gains: an output he sees again and again is cemented the same way, as a
template of five parts. Its text gains:
- he asks for one in one line, `Plantilla: qué quiero ver · cuándo aparece · cómo se ve (la muestra que apruebo) ·
  dónde me llega`;
- the lead turns it into `template new` and asks for a missing field alone;
- an escape becomes a `docs/FAILURES.md` `Seen:` line and a new refusal test.
Chosen over `reports-spanish-visual`, which JH 79 amends on `rule/visual-moments` at the same time (two changes of
one rule would conflict), and because a template holds any output, a board row or a question as much as a page; a
template is where an output rule is cemented, which is that rule's subject.

### How we prove it is followed (d)
- On every commit: `template check`, through `bin/template.test.mjs`. When it holds it prints `templates: <n>
  registered, every part present` and exits 0; a fault fails the commit.
- On the machine: a `templates` row of `doctor` (the second surface ask), reading `template shown --days 7`. Per
  template it gives rendered, admitted, shown, refused and unchecked counts; every free page with its reason; and
  every escape: a moment a record holds with no `shown` output of its template (a stretch closed with no return page
  shown, a question recorded and never asked through the gate), and a `shown` page whose rendered line names no
  moment. When it holds it prints `templates: no escapes in 7 days` and is green; an escape is amber and named; an
  unchecked call or a record it cannot read makes it `unknown`, never green. Until the row lands, `template shown`
  is the same report, exit 0 when it holds, 1 on an escape, 3 when it cannot tell.
- Every escape is a `Seen:` line of the register entry `hand-made-output` and a refusal test of the template it
  escaped; `js-harness failures` counts them, so a recurrence shows as a new `Seen:` line.

### Slices
Docs first: this document, alone, as a docs-only pull request. Then, after it lands: A, `template new`, the
registry, `template check` and `list`, each test first (T3); B, the hook probe, the gate, the records and `template
shown` (T4); C, the board end to end with the escape entry (T5); D, the rule change, stacked (T6). Each slice through
Codex and the Claude lenses before its pull request.

## Tasks
- [x] T1 (kind: design) this document, the inventory page for him, and two blind readers (rule:double-review). Spec 1-5. Route: inline, readers delegated. 3d6d5dcf, db5f7409 and the revision after them (L5).
- [ ] T2 (kind: docs) the docs-only pull request and its ready notice. Spec 5. Route: inline.
- [ ] T3 (kind: build) `template new`, the registry, `template check` and `list`, tests first. Spec 5. Route: inline.
- [ ] T4 (kind: build) the hook probe, then `template gate --hook` and `--shown`, the records and `template shown`. Spec 3, 4. Route: inline.
- [ ] T5 (kind: build) the board rows and summary as the first template, end to end, with the escape entry. Spec 1, 4. Route: inline.
- [ ] T6 (kind: build) the rule change on `rule/templates`. Spec 1, 5. Route: inline.
- [ ] T7 (kind: docs) the session summary and the ROADMAP line. Route: inline.

## Log
- L1. 2026-10-29, the lead's brief for JH 80 (its five lines of his, the recipe it gave him at line 15080, the
  task). His five lines read with `js-harness sessions --quote` (Specs).
- L2. 2026-10-29, searched before adding, as Design says: no command renders an output he sees and refuses one not
  from it; no hook matches `Artifact`, `ArtifactData`, `AskUserQuestion` or `mcp__visualize__show_widget`. JH 79's
  branch (`feat/visual-pages-b`, read at 03:15Z) builds the pages and a stale-board reminder and no hash gate.
- L3. 2026-10-29, the board rows chosen as the proof (the brief's first choice), read as whether a row came from the
  record: JH 79's slice B holds the board's look ("colored status", the lead's plan at line 14663) and its freshness
  (stale-board, start row, running block, last three done), not the rows' provenance. If the lead reads the brief's
  "colored status list" as JH 79's, the proof moves to the questions (`ask`), the next row with a record to check.
- L4. 2026-10-29 ~03:25Z, the lead's message to JH 80: (1) there is one gate and JH 80 owns it; JH 79 had planned its
  own hash gate for the moments' pages (its slice C, T10, from his line 14721) and is told not to build a second; its
  page commands call `recordRendered`, one line each, so this design names its signature, where the record lives and
  the refusal message (The records, The gates). (2) The edit surface is extended for the build: one dispatcher
  line in `bin/js-harness.mjs`, the gate entry in `bin/lib/hook-entries.mjs`, one entry in `docs/FAILURES.md`,
  `templates: true` in `harness.json`.
- L5. 2026-10-29, double review of the design (rule:double-review), two blind readers given the document, the brief
  and the code. Claude, 5/10: blockers, the 02:44Z page went by `mcp__visualize__show_widget` (line 14687), which the
  gates left out; the batch rows carry `seq` and suffixed ids from `pendingRows`, so a bare `rowOf` check refuses
  every real batch (checked: `bin/lib/live-rows.mjs:56-70`); the `recordRendered` contract missing (it was in
  db5f7409, after the copy the reader read). Should-fix: the constraint said "positive evidence" while the page gate
  refuses on absence; the free mark let the 02:44Z page through though it kept the renderer's classes; a widget's
  bytes are retyped; `shape` templates need a test file, not entries only; the inventory gave golden tests and a
  sample he did not approve; outputs missing (`board/summary`, the push notification, the desktop's recap); the
  board's words are free; (d) asked for a `check` or `doctor` row; the surface misses the files that hold the
  matcher; the Goal promised more than it built; `Artifact` and `ArtifactData` variants; stale pages admitted. Nits:
  the amber colour; selection under `exactTests`; the colored status in JH 79's slice B; the `ask` gate's options and
  answered questions; the rule's subject. Codex, 5/10: blockers, the same `seq` mismatch (confirmed by a probe); the
  inline tool and Codex as a host; the free mark against a model's mistake; admitted is not shown, and nothing names
  the moment; `template check` passes broken but complete templates. Should-fix: outputs missing (`board/summary`,
  the pause notice, throughput reviews, permission cards); the doctor row deferred; unreadable or unwritable records
  and "no escapes"; concurrent appends; uninstall's retention unowned; the evals undefined; drafts against "only
  complete templates", and several templates on one gate; the sample not bound to its approval. Nit: the amber
  colour. Taken in, all, as the design above now says: the board check by `seq`; the widget gated; the free mark
  refused on a signature or an open moment; `PostToolUse` writes `shown` and the rendered line names its moment;
  `template check` refuses drafts, throwing bodies, skipped tests, a changed sample and an unhooked surface; the
  records moved into the throughput folder so `uninstall` keeps them unchanged; the evals defined; one check a
  surface; the colours as the brief gives them, none green today. The record's path changed from the one sent to the
  lead at 03:20Z, and the lead is told.

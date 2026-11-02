# JH 132 · The audit pack: js-harness readable by an outside auditor starting cold

Locator: `odd/tasks/audit-pack.md` · Engram mirror: `odd/audit-pack/tasks` · Branch: `worktree-audit-pack`
(worktree `audit-pack`) · Delivery: small pull requests to main, one a task group · Test runner: `node --test`

## Goal
A model that has never seen js-harness can audit it whole, in slices that each fit one context, starting from one
entry document that says what the project is, which document is live and which is history, in what order to read
it all and at what measured cost, where the why of each capability is (its rules, its failures, its feature
documents) and what each record the harness writes holds, with every one of those texts held true by a command.

## Why
He wants the strongest model to audit the whole project in extreme depth, saying what is right, wrong, improvable,
redundant, blocking or unnecessary, and asked whether the documentation holds a detailed map of how it works, the
why of each thing and the plan with its criteria (L1). The map exists (`docs/SPEC.md`), but the corpus does not fit
one context, nothing routes a cold reader to it, the why is spread over four kinds of record, the record formats
live only in code, and some texts are stale (Depth pass, item 2). He approved building this pack first (L2).

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/audit-pack.md` exits 0
- `node --test bin/docs.test.mjs bin/lib/docs-plan.test.mjs bin/lib/docs-index.test.mjs bin/lib/docs-records.test.mjs` exits 0
- `node bin/js-harness.mjs docs plan` exits 0, every slice under its budget and every file of the corpus in a slice
- `node bin/js-harness.mjs docs index` exits 0
- `npm run check` exits 0, its `docs` row passing
- each pull request is merged into main, named in `## Log`, with Codex and the Claude lenses recorded over its code

## In scope / Out of scope
- In: a new entry document `docs/README.md`; a new command `js-harness docs` (`bin/docs.mjs`,
  `bin/lib/docs-*.mjs`, the dispatcher `bin/js-harness.mjs`, `README.md`'s reference); a `docs` row of `check`
  (`bin/check.mjs`); a new record-formats document `docs/RECORDS.md`; one capability in `docs/SPEC.md` and the
  stale texts of `## Stale texts`; one line in `AGENTS.md`; `docs/ROADMAP.md`; this document.
- Out: the files of JH 126 (worktree `harness-alignment`: the review flow, `bin/codex-review*`, `bin/lens-review*`,
  `bin/lib/lens-*`, `bin/lib/double-review-*`, `bin/lib/protocols-skill.mjs`, `bin/lib/project.mjs`, the
  `CLAUDE.md` lines its `## Older texts` names) and of JH 131 (worktree `defect-trio`: `bin/reply-budget.test.mjs`,
  `bin/lib/background.mjs`, `bin/lib/merge-queue-refresh.mjs`, `bin/merge-queue.mjs`, `docs/FAILURES.md`); running
  the audit itself; any eval spend.

## Constraints
- Read `js-harness codex-meter` before each Codex run and say its cost first — because Codex had about 13% of its
  weekly limit left when this started (12% at 10:50Z, `js-harness codex-meter`) and the floor JH 126 builds stops it at 2% (`odd/tasks/double-review-alignment.md`, L18).
- No stored copy of a generated text: the reading plan and the cross index are computed from the records each time
  they are printed — because a stored copy rots between regenerations, and the request is that it cannot rot.
- Token figures are `estimateTokens` (`bin/lib/payload.mjs:10`, characters over four), said as an estimate — because
  that is the measure every other row of `check` uses, and no tokenizer ships with a zero-dependency package.
- `AGENTS.md` stays within `rule:agents-budget`, measured by `check`, never assumed.

## Ask me before
Nothing planned is his: the pack was approved (L2), it spends no money, and the reviews are not his to decide. A
refuting verdict, a change of the plan's order or a step that touches his decisions would be asked through the lead
(`js-harness notify --to orchestrator --kind waiting`).

## Depth pass
- 1. Method: the discipline is technical documentation for audit, as an engineering lead prepares a codebase for an
  external due-diligence review or a standards body publishes a specification with its rationale: one landing page
  that orients and routes (Diátaxis's reference and explanation kept apart), a status for every document (normative,
  informative, superseded, with what supersedes it), a reading order sized to the reviewer's capacity, a traceability
  matrix from each requirement to its rationale, decisions and defects, and a data dictionary of every persistent
  record. Their standard: nothing the reviewer must read is reachable only by searching; nothing in the pack can
  drift from what it describes without a check failing. The smallest change that meets it: one landing page
  (`docs/README.md`, the place a repository host shows for the folder) with the index written by hand and two
  generated views printed by one command, `js-harness docs plan` and `docs index`, computed from the files that
  already hold the data (`docs/SPEC.md` and its Today lines, `docs/RULES.md`, `docs/FAILURES.md`, the source tree),
  so no new annotation is asked of any document; one data dictionary, `docs/RECORDS.md`, its paths held to the code
  by a test; and one `check` row that fails when a document is missing from the index, a slice outgrows its budget,
  a link of the index does not resolve or a record path drifts. The search of `rule:reuse-first`: GUIDE is the
  user's guide (`docs/GUIDE.md:1-12`) and SPEC's head says it never describes how the repository is today
  (`docs/SPEC.md:3-7`), so neither can hold a docs status list or a reading order; `README.md` is the command
  reference at 39,550 tokens; no command measures documents for reading (`check`'s `payload` and `fixed load` rows
  measure what loads every turn, `bin/lib/payload.mjs`, `bin/lib/fixed-load.mjs`); `rules render` and `failures`
  each read one record and join none; `spec.mjs` already parses SPEC (`parseSpec`, `bin/lib/spec.mjs:31`) and
  `failures.mjs` FAILURES (`parseRegister`, `bin/lib/failures.mjs:220`), so the new code parses nothing twice.
- 2. Raw material: his request, the lead's transcript `0f71b2c6`, line 51906, and his yes, line 52046 (both read
  with `js-harness sessions --quote` or the transcript itself); the read-only reader's verdict the lead relayed,
  line 51996; the files, measured on main `47d96a3` with `estimateTokens`: the 14 core documents (`README.md`,
  `AGENTS.md`, `CLAUDE.md`, `docs/*.md`) 218,416 tokens, the 267 source files of `bin/` without tests 1,113,037, the
  277 test files 1,746,856, `odd/` 1,379,330, `evals/` 864,863, `docs/sessions/` 105,575; `parseSpec` over
  `docs/SPEC.md`: 75 capabilities, not the 85 the reader and question 162 said (`grep -c '^\*\*Problem:\*\*'` agrees),
  whose Today lines claim 173 of the 267 source files (907,201 tokens) and leave 94 (205,836); a prototype join run
  here: 60 capabilities name a feature document, 42 reach a rule whose Home or Read-by file is in their Today line
  (homes carrying more than 8 rules left out: `bin/lib/manifest.mjs` 18, `bin/lib/protocols-skill.mjs` 9), 42 reach a
  failure entry whose control file is in their Today or Proof line, 19 reach all three; no capability names a rule
  by `rule:<id>`; only 3 of 74 rules declare a `failure`; `docs/SPEC.md:75` says "13 Claude entries, 5 Codex
  entries" where `entryComponents` (`bin/lib/manifest.mjs`) holds 15, all Claude, none for Codex; `HOME_FILES`
  (`bin/lib/spec.mjs:21`) holds 2 paths and says why run-time names are not listed; 21 distinct names joined under
  `.js-harness` in the source (`grep -rhoE "'\.js-harness', '[a-z0-9.-]+'" bin`), and 6 folders under his
  `~/.js-harness` that no such literal names (`lead/`, `pace/`, `spec-notes/`, `research/`, `patches/`, `backups/`);
  `AGENTS.md:4` and `README.md:4` "gentle-ai owns the workflow, task documents and TDD" against F8's S11, done
  2026-10-28 (`docs/ROADMAP.md:159`: "`bin/` and `evals/` stop depending on gentle-ai"); `docs/ROADMAP.md:1005`
  "`docs/SPEC.md` is written last" while `check`'s `spec` row has held it at every commit since; `AGENTS.md` never
  names SPEC (`grep -n SPEC AGENTS.md`: 0), `docs/GUIDE.md:6` does; `docs/sweep-2026-10-11.md` and `docs/todo.md`
  linked from no landing page.
- 3. The bar:
  spec 1: `node --test bin/lib/docs-index.test.mjs`: every Markdown file under `docs/` (outside `docs/sessions/`,
  which is listed as one folder) and every folder of `docs/` has a row of the index in `docs/README.md` with a status
  of live, frozen, historical or closed and, where not live, what supersedes it; `README.md` and `AGENTS.md` name it;
  today no index: 0 of 11 files, 0 of 5 folders.
  spec 2: `node bin/js-harness.mjs docs plan`: the slices of a cold read, each under `SLICE_BUDGET` estimated
  tokens, every core document and every source file of `bin/` in exactly one, the source in SPEC's order of
  capabilities, a file no Today line claims placed with the first capability whose files import it, the rest in a
  last slice; each slice printed with its files and its measured cost; today none, new behaviour (the core documents
  and the source together, 1,331,453 tokens, do not fit a 1M window).
  spec 3: `node bin/js-harness.mjs docs index`: for each capability, its feature documents (with the section its
  text quotes), its rules and its failure entries, each link with the file that made it; then the rules, failure
  entries and feature documents no capability reaches; `--json`; today the prototype's 60, 42, 42 and 19 of 75.
  spec 4: `node --test bin/lib/docs-records.test.mjs`: `docs/RECORDS.md` gives each record the harness writes under
  the home, in the clone's git folder and in the project, with its fields, its writer and its readers, and the test
  fails when a name the source joins under `.js-harness` is missing from it or a path it lists is in no source file
  and not marked as written by hand; today 2 of 21 home names written in a document (`HOME_FILES`), 0 with fields.
  spec 5: `grep -nE "13 Claude entries|5 Codex entries|gentle-ai owns|is written last" AGENTS.md README.md docs`: no
  stale line left outside `docs/proposals/` and `docs/sessions/`, the hook count named from its source instead of
  written as a number; today 4 lines (`AGENTS.md:4`, `README.md:4`, `docs/ROADMAP.md:1005`, `docs/SPEC.md:75`).
  spec 6: `npm run check`: a `docs` row that fails on a document missing from the index, a slice over budget, a link
  of the index that does not resolve, or a record path that drifts, with a planted break of each in its test; none,
  new behaviour.
- 4. Refutation: the cheapest tests that could show the request does not hold, run on `47d96a3`: (a) the corpus
  fits one context, so no reading plan is needed: core documents and source measure 1,331,453 estimated tokens,
  above a 1M window before any test, log or feature document; it does not fit. (b) a landing page already routes a
  cold reader: `README.md:12` routes to the user guide, `AGENTS.md` names no SPEC, no file lists the documents'
  status; none does. (c) the why cannot be joined without annotating every document by hand, which would make the
  index as rot-prone as prose: the prototype joined 60, 42 and 42 of 75 capabilities from keys that already exist,
  so a generated index carries most links, and its gaps (19 of 75 complete) are themselves audit findings, printed
  as such rather than hidden.
  Verdict: supports
- 5. Request: "Make js-harness ready for an outside model to audit cold: one entry document, `docs/README.md`, that
  says what the project is and gives every document its status and successor; a command that prints a reading plan
  in slices that each fit one context, with costs it measures, the source in the order of SPEC's 75 capabilities;
  a command that prints, for each capability, its feature documents, rules and failure entries, and what no
  capability reaches; a document of every record the harness writes, its fields, writer and readers, held to the
  code's paths by a test; the four stale texts fixed, the hook count named from its source rather than checked as a
  number; and one `check` row so none of it can drift. As small pull requests, each through Codex and the Claude
  lenses."
  Adds: none

## Specs
1. Entry document. "un mapa detallado y despecifico de como funciona y al detalle d epor que de cada cosa incluso
   con el plan donde explica todo con criterio" (L1): `docs/README.md`, what the project is in a few lines with
   pointers (never a copy of SPEC's bet), the index of every document with its status and successor, how to run the
   reading plan and the cross index, and where an audit's findings would go.
2. Reading plan. "le voy a hacer una auditoria y revision al detalle" (L1): `js-harness docs plan`, slices under
   `SLICE_BUDGET`, computed each time.
3. Cross index. "al detalle d epor que de cada cosa" (L1): `js-harness docs index`, computed each time.
4. Record formats. "como funciona" (L1): `docs/RECORDS.md`, its paths held by a test.
5. Stale texts. "si todo esta bien o esta mal" (L1): `## Stale texts` fixed.
6. The `docs` row of `check`, which holds 1 to 4.

## Stale texts
Found by the search of item 2; each changes in T2.
1. `docs/SPEC.md:75`: "13 Claude entries, 5 Codex entries". Becomes "the Claude hook entries of `entryComponents`,
   none for Codex, which only reviews": the number has one home, the code, so no check of a copy is needed.
2. `AGENTS.md:4` and `:26`, `README.md:4`: gentle-ai "owns" the workflow and the ODD document. Become what is true
   since S11: the format is gentle-ai's ODD document, js-harness carries the workflow, and gentle-ai leaves at S2.
3. `docs/ROADMAP.md:1005`: "`docs/SPEC.md` is written last". Kept as his decision, with what happened since: written,
   and held at every commit by `check`'s `spec` row.
4. `docs/GUIDE.md:79`: `doctor` lists gentle-ai "today". Checked against `doctor`'s rows in T2; changed only if
   false.

## Tasks
- [ ] T1 (kind: docs) this document, its depth pass, committed before any code; the plan's double review
  (`js-harness double-review read`), every finding answered (spec 1 to 6)
- [ ] T2 (kind: docs) the stale texts; pull request 1 (spec 5)
- [ ] T3 (kind: build) `js-harness docs plan`, test first, and `docs/README.md` with its index and the row's index
  part; pull request 2 (specs 1, 2, 6)
- [ ] T4 (kind: build) `js-harness docs index`, test first, and the row's link part; pull request 3 (specs 3, 6)
- [ ] T5 (kind: build) `docs/RECORDS.md` and its test, and the row's record part; pull request 4 (specs 4, 6)
- [ ] T6 (kind: verify) the close: the bar measured again, the Log's result against items 3 and 4, the report to the
  lead (`js-harness notify --to orchestrator --kind closed`)

## Log
- L1 2026-11-02T10:26:53Z, his request (the lead's transcript `0f71b2c6`, line 51906): "Necesito por favor que me
  digas si toda la documentacion de este proyecto esta hecha con un mapa detallado y despecifico de como funciona y
  al detalle d epor que de cada cosa incluso con el plan donde explica todo con criterio, la idea de esto es que con
  el modelo nuevo de Fable 5.5 que es el modelo mas poderoso e inteligente de todos y ademas mas actualizado, le voy
  a hacer una auditoria y revision al detalle para que nos diga si todo esta bien o esta mal o que se puede mejorar
  y si lo que estamos haciendo es redundante o bloqueante o innecesario, mejor dicho se va a hacer una critica a
  profundidad extrema."
- L2 2026-11-02T10:39:43Z, his answer to question 162 (line 52046), tapped: "Sí, armar el paquete". The question said
  85 capabilities; `parseSpec` counts 75 (Depth pass, item 2). It also said the pack is no F8 step, so
  `rule:growth-limit` left it to him; his yes opens it.
- L3 2026-11-02, this session (JH 132), brief `2026-11-02T10-40-21-430Z-fadf3110`: the worktree fast-forwarded to
  main `47d96a3`; the brief's claims checked one by one in item 2 (the 85 corrected, the hook count corrected to 15
  and 0, the rest confirmed).

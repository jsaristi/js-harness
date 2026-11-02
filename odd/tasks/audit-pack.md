# JH 132 · The audit pack: js-harness readable by an outside auditor starting cold

Locator: `odd/tasks/audit-pack.md` · Engram mirror: `odd/audit-pack/tasks` · Branch: `worktree-audit-pack`
(worktree `audit-pack`) · Delivery: small pull requests to main, one a task group · Test runner: `node --test`

## Goal
A model that has never seen js-harness can audit it whole, in slices that each fit one context, starting from one
entry document that says what the project is, which document is live and which is history, in what order to read
it all and at what measured cost, where the why of each capability is (its rules, its failures, its feature
documents) and what each record the harness writes holds. A command holds the structure of those texts true (the
index against the folder, the plan against the tracked files, the links and the record paths against the source);
the truth of their prose is what the audit itself reads.

## Why
He wants the strongest model to audit the whole project in extreme depth, saying what is right, wrong, improvable,
redundant, blocking or unnecessary, and asked whether the documentation holds a detailed map of how it works, the
why of each thing and the plan with its criteria (L1). The map exists (`docs/SPEC.md`), but the corpus does not fit
one context, nothing routes a cold reader to it, the why is spread over four kinds of record, SPEC's table says
where each record lives but its fields live only in code, and some texts are stale (Depth pass, item 2). He approved building this pack first (L2).

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/audit-pack.md` exits 0
- `node --test bin/docs.test.mjs bin/lib/docs-plan.test.mjs bin/lib/docs-entry.test.mjs bin/lib/docs-cross.test.mjs bin/lib/docs-records.test.mjs` exits 0
- `node bin/js-harness.mjs docs plan` exits 0, every slice under its budget (no file alone over it) and every file
  `git ls-files` lists in exactly one slice
- `node bin/js-harness.mjs docs index` exits 0
- `git grep -nE "13 Claude entries|5 Codex entries|gentle-ai owns|hooks for Claude Code and Codex|gentle-ai install" -- AGENTS.md README.md docs ':!docs/proposals' ':!docs/sessions'` prints nothing (spec 5)
- `npm run check` exits 0, its `docs` row passing
- each pull request is merged into main, named in `## Log`, with Codex and the Claude lenses recorded over its code

## In scope / Out of scope
- In: a new entry document `docs/README.md`; a new command `js-harness docs` with `plan`, `index` and `check`
  (`bin/docs.mjs`, `isHarnessRepository` exported from `bin/lib/spec.mjs`,
  `bin/lib/docs-*.mjs`, the dispatcher `bin/js-harness.mjs`, `README.md`'s reference); a `docs` row of `check`
  (`bin/check.mjs`); SPEC's "Where state lives" table completed and a fields document `docs/RECORDS.md` keyed by
  its record names; one capability in `docs/SPEC.md` and the stale texts of `## Stale texts`, `docs/GUIDE.md`'s
  command table among them; one line in `AGENTS.md`; `docs/ROADMAP.md`; this document.
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
  that orients and routes (Diátaxis's reference and explanation kept apart), a status for every document (live,
  frozen, historical or closed, with what supersedes it), a reading order sized to the reviewer's capacity, a traceability
  matrix from each requirement to its rationale, decisions and defects, and a data dictionary of every persistent
  record. Their standard: nothing the reviewer must read is reachable only by searching; nothing in the pack can
  drift from what it describes without a check failing. The smallest change that meets it: one landing page
  (`docs/README.md`, the place a repository host shows for the folder) with the index written by hand and two
  generated views printed by one command, `js-harness docs plan` and `docs index`, computed from the files that
  already hold the data (`docs/SPEC.md` and its Today lines, `docs/RULES.md`, `docs/FAILURES.md`, the source tree),
  so no new annotation is asked of any document; SPEC's "Where state lives" table (`docs/SPEC.md:184`), which
  already maps each record to its writer and readers, completed and held to the source by a test, with one data
  dictionary of fields, `docs/RECORDS.md`, keyed by that table's record names; and one `check` row that fails when
  a document is missing from the index, a file outgrows a slice, a link of the index does not resolve or a record
  path drifts. The search of `rule:reuse-first`: GUIDE is the user's guide (`docs/GUIDE.md:1-12`) and SPEC is the
  map whose head keeps rationale and today apart (`docs/SPEC.md:3-7`, `:62`), so neither holds a docs status list
  or a reading order; the pre-launch audit (`odd/tasks/launch-audit.md`, closed, sign-off L29) built a per-file
  inventory, `odd/tasks/launch-audit/inventory.tsv`, with classes by kind of file (live, history, generated, fixture,
  internal, compatibility) and reading areas by import reach, held by `scripts/inventory.mjs --check`; it is a
  stored copy and has rotted (580 findings on this branch, its last row on 2026-10-24), and `scripts/` is not
  shipped, so `bin/` cannot import it; the plan computes the same placement each time and `docs/README.md` names it
  historical, superseded by `docs plan`, with its ledger and refuter files as the precedent for where an audit's
  findings go; `README.md` is the command
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
  by `rule:<id>`; only 3 of 74 rules declare a `failure`; 27 of 74 rules are homed in the two files left out, and
  `bin/check.mjs`, Read-by file of 4 rules, is on 14 Today lines; `docs/SPEC.md:75` says "13 Claude entries, 5 Codex
  entries" where `entryComponents` (`bin/lib/manifest.mjs`) holds 15, all Claude, none for Codex; `HOME_FILES`
  (`bin/lib/spec.mjs:21`) holds 2 paths and says why run-time names are not listed; 21 distinct names joined under
  `.js-harness` in the source outside tests (`grep -rhoE "'\.js-harness', '[a-z0-9.-]+'" --exclude='*.test.mjs'
  bin`; 25 with the tests), plus `codex-review-homes`, held in a constant (`bin/lib/codex-review-home.mjs:65`) that
  no such grep sees; SPEC's table (`docs/SPEC.md:184-216`) names 17 of those 21 with writers and readers, the six
  review records of the git folder, and two line anchors that have drifted (`bin/lib/refresh-copy.mjs:287`, the name
  now at `:332`; `bin/lib/project.mjs:1063`, a comment); every tracked file (`git ls-files` on `8a07203`, 1,432 on
  `47d96a3` by `git ls-tree -r --name-only 47d96a3 | wc -l`): 1,433, none binary, 5,766,060 estimated tokens, of which
  `scripts/` 186,406, `docs/` subfolders but sessions 102,108, the root's files 47,341; `AGENTS.md` 972 estimated
  tokens against its budget of 1,500 (`check`'s `budget` row on `8a07203`), and 6 folders under his
  `~/.js-harness` that no such literal names (`lead/`, `pace/`, `spec-notes/`, `research/`, `patches/`, `backups/`);
  `AGENTS.md:4` and `README.md:4` "gentle-ai owns the workflow, task documents and TDD" against F8's S11, done
  2026-10-28 (`docs/ROADMAP.md:159`: "`bin/` and `evals/` stop depending on gentle-ai"); `docs/ROADMAP.md:1005`
  "`docs/SPEC.md` is written last" while `check`'s `spec` row has held it at every commit since; `AGENTS.md` never
  names SPEC (`grep -n SPEC AGENTS.md`: 0), `docs/GUIDE.md:6` does; `docs/sweep-2026-10-11.md` and `docs/todo.md`
  linked from no landing page.
- 3. The bar:
  spec 1: `node --test bin/lib/docs-entry.test.mjs`: every file directly under `docs/` (Markdown, HTML and JSON) and
  every folder of `docs/` has a row of the index in `docs/README.md` with one status of four, each defined there
  (live: in force and kept true; frozen: kept as written, never edited; historical: true when written, superseded,
  naming what supersedes it; closed: work that ended, naming where its result lives); a folder's row is the status
  of its files, and a file deeper in it may have its own row, which overrides it (as `docs/host-updates/README.md`,
  a live format beside the records of single releases); `README.md` and `AGENTS.md` name it; the feature documents
  of `odd/tasks/` get no stored status: `docs plan` prints each one's open or closed state, computed from its task
  boxes as `js-harness progress` counts them; it gives the reading method: a findings ledger the auditor keeps across
  slices, each entry a claim, its evidence (`path:line`), the questions it leaves for another slice and what it
  covered, capped at 50,000 estimated tokens inside the 60% of the window the budget leaves free, and a last pass
  over the ledgers alone that answers what is redundant, blocking or unnecessary; the precedent is the launch
  audit's ledger and refuter files (`odd/tasks/launch-audit/`); today no index: 0 of 13 files, 0 of 5 folders.
  spec 2: `node bin/js-harness.mjs docs plan`: the corpus is every file `git ls-files` lists (1,432 on `47d96a3`,
  1,433 with this document, none binary, 5,766,060 estimated tokens); each lands in exactly one slice, each slice under `SLICE_BUDGET`, 400,000
  estimated tokens (40% of a 1M window: room for the auditor's instructions, reasoning and findings, and for
  `estimateTokens` undercounting code and Spanish by up to 1.5 times; the window of the model he named, "Fable 5.5"
  (L1), is not known here, so 1M is an assumption and `docs/README.md` says to pass `--budget` at 40% of the
  auditor's window), in four tiers printed in order with their cost: core (every file of the root and every file
  directly under `docs/`, of any extension, the orientation documents first, then the source of `bin/` that is not a
  test in SPEC's order of capabilities), tests (`*.test.*js` and `*.testkit.mjs` of `bin/`, by the capability whose
  Proof or Today names them), feature documents (`odd/`, `docs/` subfolders, each feature document of `odd/tasks/`
  with its computed state), and the rest (`evals/`, `scripts/`, `templates/`, and every other folder, `.github/`'s
  CI among them; the root's own configuration files are core). A capability's files stay in one slice unless they
  alone outgrow the budget, then they split by file; a file claimed by two capabilities goes with the first; a
  source file no Today line claims is placed in rounds: each round, in the capabilities' order, each capability takes
  the unplaced modules its files import directly, so a module two imports deep goes to whichever capability reaches
  it in fewer steps, ties to the first; one none reaches closes the tier. One file over the budget is its own slice,
  flagged, never cut, and fails the row at `SLICE_BUDGET` (none today). Every slice after the first opens with
  `docs/README.md`, counted in its budget, which gives the reading method (spec 1). `docs plan` exits 0 with any
  budget; 1 when git cannot list the files or one cannot be read (Codex, T3). Today none, new behaviour; the core tier, re-measured under this definition
  at T3, does not fit a 1M window (1,331,453 tokens for its Markdown and source alone).
  spec 3: `node bin/js-harness.mjs docs index`: for each capability, its explicit links first, from what its own text
  cites (an `odd/tasks/` or `docs/` path with the section it quotes, a `rule:<id>`, a failure id of
  `docs/FAILURES.md`) and from what the records declare (a rule's `failure`); then its inferred candidates, marked as
  such with the file that made each: a rule whose Home or Read-by file is in its Today line, a failure entry whose
  control file is in its Today or Proof line, a file that more than 8 rules share (`bin/lib/manifest.mjs`,
  `bin/lib/protocols-skill.mjs` today) or that more than 8 Today lines claim (`bin/check.mjs`, 14) printed as too
  shared to infer from, never dropped in silence; then the rules, failure entries and feature documents no
  capability reaches, the rules homed in a too-shared file said as such; `--json`. Today's figures, a prototype run
  here without the Today-line cut and not committed: 60 of 75 cite a feature document, 42 reach a rule and 42 a
  failure entry by inference, 19 reach all three, 0 name a rule by id; with the cut, 34 reach a rule (Codex's
  recount in read 9b105375, not rerun here). The bar: T4's first run recorded in the Log, and 20 inferred links read
  by hand; under 14 of 20 right, the inferred links are printed as unverified, apart from the explicit ones.
  spec 4: `node --test bin/lib/docs-records.test.mjs`: SPEC's "Where state lives" table stays the one map of
  records (where, writer, reader), completed: every record the harness writes under the home, in the clone's git
  folder (`<git common dir>/js-harness/`) and in the project, nested records included (as `background/`'s
  `sessions.jsonl` and briefs, `bin/lib/background.mjs:21-24`, and the channel's files, `bin/lib/channel.mjs:80,85`);
  its writers named by file and exported function, never by line. `docs/RECORDS.md` holds only the fields, a section
  per record named as its table row (each variant of a record that holds several, as the channel's notices by kind),
  so no fact has two homes. The detector reads the source outside tests: a name joined under `.js-harness`, the
  second argument of `jsonLinesPath` and `appendJsonLine`, a `--git-path js-harness/` literal, a record file name
  (`*.json`, `*.jsonl`, `*.tsv`, `*.log`, `*.md`, `*.lock`, `*.stopped`, `*.xml`) joined to a path, the functions
  that compose a record's path (as `briefsDirOf`, `bin/sessions-background.mjs:311`, and `openingFileName`,
  `bin/lib/channel.mjs:507`), and the constants that name record files (`HOMES_DIR`,
  `bin/lib/codex-review-home.mjs:65`; `REVIEW_RECORD_FILES`, `bin/lib/guard.mjs:491`), less a short allow-list of
  names that are no records (`SKILL.md`, `bin`, `claude`); a row names a record's family, its folder with each child
  pattern. The test fails when a detected name is in no row's family, when a row's path is in no source file and not
  marked as written by hand, when a writer file no longer holds its name, or when a section of `docs/RECORDS.md`
  names no row or a row has no section, with a planted break of each form (a new home name, a child under a folder
  already in the table, a record moved under the same name, a non-JSON record, a git-folder record, a project
  record). The six home folders no literal names (`lead/`, `pace/`, `spec-notes/`, `research/`, `patches/`,
  `backups/`) are each a row written by hand, or left out with the reason it is not the harness's. Fields are written
  from the writer's code and not checked against it: no schema exists, and making one is another feature; each
  section names the function that builds the record, where an auditor checks it. Today 17 of the 21 home names and
  the 6 review records in SPEC's table, 2 of its anchors drifted, 0 with fields. The bar: the detector's first run,
  recorded in the Log, finds at least the 4 home names SPEC's table lacks (`restored-config`, `restored-bundles`,
  `restore-progress.json`, `status-line`) and the 6 review records; fewer means the detector is wrong.
  spec 5: `grep -rnE "13 Claude entries|5 Codex entries|gentle-ai owns|hooks for Claude Code and Codex|gentle-ai install" --exclude-dir=proposals --exclude-dir=sessions AGENTS.md README.md docs`: no line
  left, each stale text of `## Stale texts` rewritten to what the code does; today 6 lines on `47d96a3`
  (`AGENTS.md:4`, `README.md:4`, `README.md:643`, `docs/GUIDE.md:53`, `docs/GUIDE.md:74`, `docs/SPEC.md:75`); his
  heading at `docs/ROADMAP.md:1005` is kept as he wrote it, the note beneath it saying what happened since.
  spec 6: `npm run check`: a `docs` row, in the harness's own repository alone (`isHarnessRepository`, the test the
  `spec` row uses), since a project's `docs/README.md` holds no such index; it fails where `docs/README.md` is
  missing, on a file or folder of `docs/` missing from the index (the table under `## Index` alone), on a tracked
  file it cannot read (a file deleted from the tree reads as empty), on a file alone over `SLICE_BUDGET`, on an
  explicit link of the index that does not resolve, or on a record that drifts (spec 4), with a planted break of each
  in its test, and only reports the inferred links and what no capability reaches; `js-harness docs check` runs the
  row alone;
  the plan's own placement (every file in one slice, no slice over budget but a lone file) is a self-check of the
  packer, kept because it costs one pass and fails only on a bug of it; none, new behaviour.
- 4. Refutation: the cheapest tests that could show the request does not hold, run on `47d96a3`: (a) the corpus
  fits one context, so no reading plan is needed: core documents and source measure 1,331,453 estimated tokens,
  above a 1M window before any test, log or feature document, and the whole tracked corpus 5,766,060; it does not
  fit. (b) a landing page already routes a
  cold reader: `README.md:10` routes to the user guide (on `47d96a3`), `AGENTS.md` names no SPEC, no file lists the documents'
  status; none does. (c) the why cannot be joined without annotating every document by hand, which would make the
  index as rot-prone as prose: the prototype joined 60, 42 and 42 of 75 capabilities from keys that already exist,
  so a generated index carries most links, and its gaps (19 of 75 complete) are themselves audit findings, printed
  as such rather than hidden.
  Verdict: supports
- 5. Request, the plan's rewrite of L1 and L2 (his words are those two, not this): make js-harness ready for an
  outside model to audit cold: one entry document, `docs/README.md`, that says what the project is and gives every
  document of `docs/` one of four defined statuses and its successor, and the feature documents their computed
  state; a command that prints a reading plan of every tracked file in slices of at most 400,000 estimated tokens,
  in four tiers (core, tests, feature documents, the rest) with costs it measures, the source in the order of
  SPEC's 75 capabilities; a command that prints, for each capability, the feature documents, rules and failure
  entries its text cites, apart from the ones inferred through shared files, and what no capability reaches; SPEC's
  record table completed and a document of each record's fields, held to the source's record names by a test; the
  stale texts fixed, each against the code; and one `check` row so the structure of it cannot drift. As small pull
  requests, each through Codex and the Claude lenses. What came after his yes is the plan's means, not his words:
  the 400,000 budget, the four statuses, the `check` row, 75 capabilities where his question said 85, and the
  reviews, which the project's rules ask of every slice.
  Adds: none

## Specs
1. Entry document. "un mapa detallado y despecifico de como funciona y al detalle d epor que de cada cosa incluso
   con el plan donde explica todo con criterio" (L1): `docs/README.md`, what the project is in a few lines with
   pointers (never a copy of SPEC's bet), the index of every document with its status and successor, how to run the
   reading plan and the cross index, and the reading method: a ledger carried across slices and a last pass over
   it for "si lo que estamos haciendo es redundante o bloqueante o innecesario" (L1).
2. Reading plan. "le voy a hacer una auditoria y revision al detalle" (L1): `js-harness docs plan`, every tracked
   file in four tiers, slices under `SLICE_BUDGET`, computed each time (item 3, spec 2).
3. Cross index. "al detalle d epor que de cada cosa" (L1): `js-harness docs index`, explicit links apart from
   inferred ones, computed each time (item 3, spec 3); what no capability reaches is the first list an auditor
   reads for "innecesario" (L1). His decisions are joined only where a capability cites the
   roadmap: 9 of 75 capability titles appear in `docs/ROADMAP.md` and 5 capabilities cite it, so no key exists to
   join the rest; the decisions reach the auditor through the roadmap's own sections in the core tier and through
   the feature documents, which carry his answers (L6, Claude 7).
4. Record formats. "como funciona" (L1): SPEC's "Where state lives" table completed and `docs/RECORDS.md`, the
   fields of each of its records, both held to the source's record names by a test (item 3, spec 4).
5. Stale texts. "un mapa detallado y despecifico de como funciona" (L1): the map an auditor is handed must say what
   the code does, so `## Stale texts` is fixed before the audit reads it.
6. The `docs` row of `check`, which holds 1 to 4.

## Stale texts
Found by the search of item 2; each changes in T2.
1. `docs/SPEC.md:75`: "13 Claude entries, 5 Codex entries". Becomes "the Claude hook entries of `entryComponents`,
   none for Codex, which only reviews": the number has one home, the code, so no check of a copy is needed.
2. `AGENTS.md:4` and `:26`, `README.md:4`: gentle-ai "owns" the workflow and the ODD document. Become what is true
   since S11: the format is gentle-ai's ODD document, js-harness carries the workflow, and gentle-ai leaves at S2.
   `AGENTS.md` moves to T3 (L4): each new span of it must be declared in `bin/lib/rules-coverage-data.mjs`, a code
   file, and T3 is code that edits `AGENTS.md` anyway.
3. `docs/ROADMAP.md:1005`: "`docs/SPEC.md` is written last". Kept as his decision, with what happened since: written,
   and held at every commit by `check`'s `spec` row.
4. `docs/GUIDE.md:79`: `doctor` lists gentle-ai "today". Checked against `doctor`'s rows in T2; changed only if
   false. False: `js-harness doctor` on this machine prints no gentle-ai row; with `docs/GUIDE.md:9-11` (S11 told
   as future), `:53` and `:74` (`install` writing hooks for Codex, where `entryComponents` holds Claude's alone and
   `bin/lib/manifest.mjs:270` writes nothing under `~/.codex`) and `:83` (`stack install` leaves "gentle-ai's
   installer" to him), changed.
5. Found in T2 by `grep -n gentle README.md`, lines as on `47d96a3`, each checked against the code: the `doctor` sample's gentle-ai row and
   fix (`README.md:638`, `:643`); `stack` leaving gentle-ai's installer to him and context7 optional (`:654`; the
   plan's `manual` is engram's own commands, a login and the prerequisites, `optional` typescript-lsp alone,
   `bin/lib/stack-install.mjs:107-112`); the throughput's `gentle-ai reviews` row (`:787`; no file of `bin/` reads
   one, `bin/lib/gentle-ai-absence.test.mjs`); the merge queue's gentle-ai line in a pull request's body and its
   evidence paragraph (`:1194`, `:1266-1272`; `reviewEvidence` asks for none since S11,
   `bin/lib/merge-queue-reviews.mjs:49`); `notify --kind ready` refusing for that line (`:1571`). Kept, since they
   are true until S2: the guard's gentle-ai review base (`:1826`, `bin/lib/guard.mjs:410`) and what `init` and
   `migrate` say of `.atl/` (`:264`, `:445`, `:455`).
6. Found and left to JH 126 and to him: `CLAUDE.md` still tells a session to name gentle-ai reviews on a feature
   document's line and to run `gentle-ai review start`'s consent envelope ("Running what costs, and review"); its
   lines are his. JH 126's `## Older texts` (`odd/tasks/double-review-alignment.md`) names `CLAUDE.md:24` and `:92`
   but not `:74-91` (Codex 3 of read `279ba83f`), so no task owns them: the lead is told so in T3, and the close
   reports them as an open contradiction until he changes them.
7. `docs/GUIDE.md:157-163`, the command table, omits `migrate`, `stretch`, `template`, `double-review`,
   `status-line`, `host-watch` and `commit-msg` of the dispatcher (Claude 11 of read `279ba83f`); T3 adds them with
   `docs`.

## Tasks
- [x] T1 (kind: docs) this document, its depth pass, committed before any code; the plan's double review
  (`js-harness double-review read`), every finding answered (spec 1 to 6); done: `8a07203`, the reviews L6 to L8
- [x] T2 (kind: docs) the stale texts; pull request 1 (spec 5); done: `41862442`, with `AGENTS.md` in T3 (L4)
- [x] T3 (kind: build) `js-harness docs plan`, test first, and `docs/README.md` with its index and the row's index
  part, `AGENTS.md` and GUIDE's command table; pull request 2 (specs 1, 2, 5, 6; spec 5 measured at its close);
  done: `c51daf56` and its fix `1fb4f34a`, pull request 752
- [ ] T4 (kind: build) `js-harness docs index`, test first, and the row's link part; pull request 3 (specs 3, 6)
- [ ] T4r (kind: verify) Codex reads T4 again whole (`codex-review --base d195f663 --again`), since its recheck of
  `651290fc` left one finding fixed in part, then fixed in `f53617f3` (L11), and a second recheck is not run
- [ ] T5 (kind: build) SPEC's record table completed, `docs/RECORDS.md` and its test, and the row's record part;
  pull request 4 (specs 4, 6)
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
- L4 2026-11-02, T2's first commit was refused by the gate: the `AGENTS.md` rewrite added two spans that directive
  coverage finds declared nowhere (`bin/rules-coverage.test.mjs:53`, gate log `6184a991`); declaring them is a change
  of `bin/lib/rules-coverage-data.mjs`, a code file, so `AGENTS.md` moves to T3, which is code and edits it anyway.
- L5 2026-11-02, T2 started while the plan's double review ran, on files outside this document: the readers read a
  frozen copy of this document, and saw the tree move under the paths it cites (Claude 10). Taken: the item 2 and
  bar figures are cited at `47d96a3`; T2's commit waits for this Log entry and the findings' answers.
- L6 2026-11-02, the plan's double review (`js-harness double-review read`, read `9185dd10`): Claude on
  claude-opus-5-5, 13 findings, 1,270,032 tokens; Codex on gpt-6.1-sol, 7 findings, 1,087,010 tokens, about 1% of
  its weekly limit (88% used before). Answered, each in this document:
  Claude 1 taken in part: GUIDE `:53`, `:74`, `:9-11`, `:79`, `:83` and README's samples are in `## Stale texts` and
  spec 5's command; a check of each prose claim against the code is not taken, since a check a sentence is the
  doctrine this rebuild shrinks (`docs/origin.md`), and the pack's own texts are what spec 6 holds. Claude 2 taken:
  spec 5 is recursive with its exclusions, and the roadmap's heading reads "was to be written last". Claude 3 and
  Codex 1 taken: the corpus is every tracked file, in four tiers (spec 2). Claude 4 and Codex 6 taken: the grep's
  filter, `codex-review-homes`, 1 of 21 and not 2, the git folder and the project in spec 4; a constant exported by
  each writer is not taken, as it would edit about twenty writers, JH 131's `bin/lib/background.mjs` among them, for
  what a test anchored on the writer's line holds as well. Claude 5 and Codex 3 taken: `SLICE_BUDGET` is 400,000
  with its reason; the chars-over-four ratio is not calibrated against a tokenizer, since none runs here without an
  API key, and the margin carries that. Claude 6 and Codex 4 taken: the join rules are spec 3's, explicit links
  apart from inferred ones, the shared files printed and not dropped, the bar set by T4's first run. Claude 7 taken
  in part: a capability's citations of `docs/` paths, the roadmap's among them, are explicit links; the rest is
  rebutted in `## Specs` 3 on a count. Claude 8 taken: the packing rules in spec 2, what the row fails and what it
  only reports in spec 6. Claude 9 taken: every file and folder directly under `docs/`, one vocabulary of four,
  defined in the index. Claude 10 taken (L5). Claude 11 taken: the rewrite names test-first work. Claude 12 taken:
  `README.md:10`. Claude 13 taken: `AGENTS.md` measures 972 of 1,500. Codex 2 taken in part: the git folder, the
  project and each variant of a record are in spec 4, with writer lines checked; checking fields against writer
  contracts is not taken, since no schema exists to check them against (spec 4). Codex 5 taken (with Claude 1).
  Codex 7 taken (with Claude 2). Shared: Claude 1 and Codex 5, 2 and 7, 3 and 1, 4 and 6, 5 and 3, 6 and 4.
- L7 2026-11-02, the plan's confirming review (read `279ba83f`): Claude on claude-opus-5-5, 15 findings, 2,639,531
  tokens; Codex on gpt-6.1-sol, 6 findings, 934,240 tokens, about 1% of its weekly limit. Answered, each in this
  document: Claude 1 taken: SPEC's "Where state lives" (`docs/SPEC.md:184`) is the map of records, completed, and
  `docs/RECORDS.md` holds only fields keyed by its rows (spec 4, item 1, Why). Claude 2 taken in part: the
  launch audit is in item 1's search and `docs/README.md` names its inventory historical, superseded by `docs plan`,
  and its ledger as where findings go; its code is not reused, since `scripts/` does not ship and `bin/` cannot
  import it, and the test classification it holds is the one `docs-plan.mjs` already uses (`*.testkit.mjs` a test);
  its classes say what kind a file is, the four statuses how long a document holds, so they are not mapped; deleting
  the stale inventory is not this pack's, its feature being closed. Claude 3 taken: writers named by file and
  function, never a line, and SPEC's two drifted anchors fixed in T5. Claude 4 and Codex 2 taken: the detector's
  forms, nested and project records, an allow-list, a planted break of each, the counts at T5's first run. Claude 5
  taken: the Today-line fan-out cap and 20 links read by hand for precision; the 27 rules in the two shared homes
  are said as not joinable by inference. Claude 6 taken in part: spec 5's grep is a Done-when line and the Goal says
  a command holds the structure, not the prose; a row of forbidden phrases is not taken, a check a sentence (L6).
  Claude 7 and Codex 4 taken: `odd/tasks/` documents get a computed state in `docs plan`, and a file under a folder
  of `docs/` may have its own row over its folder's (spec 1); not every file of every folder, which would store a
  status for each of about a hundred records of one kind. Claude 8 taken in part: "Fable 5.5" and the unknown window
  are named, 1M stated as an assumption and `--budget` as the way to fit another; the lead is not asked, since the
  plan does not wait on it. Claude 9 taken: item 5 is labelled the plan's rewrite and lists what came after his yes;
  none of it changes the pack he approved. Claude 10 taken: T3 holds spec 5. Claude 11 taken in part: GUIDE's table
  is stale text 7, fixed in T3; a check of it against `COMMANDS` is not taken (GUIDE is prose for him). Claude 12 and
  Codex 5 taken: a file alone over `SLICE_BUDGET` fails the row (none today: `docs plan --json` on this tree flags no
  slice), Done-when says so, and the slice checks are named a self-check. Claude 13 taken: the core tier is defined
  by pattern, testkits are tests, the figure re-measured at T3. Claude 14 taken: every slice after the first opens
  with `docs/README.md`, whose findings convention carries across slices. Claude 15 taken: stale text 5's lines are
  on `47d96a3`. Codex 1 taken in part: the Goal no longer claims fields are held; tests of every writer's
  serialization are not taken, being a test for each of about thirty writers, another feature. Codex 3 taken: stale
  text 6, the lead told in T3, the close reports it open. Codex 6 taken: 1,432 on `47d96a3`, 1,433 on `8a07203`.
  Shared: Claude 6 and Codex 1, 4 and 2, 7 and 4, 12 and 5. Corrections made, so the third and last review runs.

- L8 2026-11-02, the plan's third and last review (read 9b105375): Claude on claude-opus-5-5, 14 findings,
  2,044,240 tokens; Codex on gpt-6.1-sol, 4 findings, 2,186,810 tokens, about 1% of its weekly limit (0% used
  before, `js-harness codex-meter`). It found two real failures in the code written so far, both fixed test first in
  `bin/docs.test.mjs` before this entry: the row would have run in every project with a `docs/README.md` (Claude 1),
  and deleting the entry document switched the row off while an unreadable file counted as empty (Codex 2). Rule
  `rule:double-review` sends a third review's real failures to him as a problem; they are reported to the lead with
  their fixes. Answered, each in this document: Claude 1 taken: the row runs in the harness's own repository alone
  (spec 6); a lockfile is moot there, the package having no dependencies. Claude 2 and 3 taken, already built when
  the frozen copy was read: the oversized file fails the row, a deeper row overrides its folder's. Claude 4 taken: a
  precision bar for spec 3 and a minimum for spec 4's detector. Claude 5 and Codex 3 taken in part: the preamble is
  passed and tested, and `docs/README.md` gives the ledger (claim, evidence, open questions, coverage), its cap and
  the last pass over it; SPEC's architecture in every slice is not taken, the first slice reading it whole and the
  ledger carrying it; a fixture audit to validate the method is running the audit, out of scope. Claude 6 taken in
  part: the budget is the window's fit he asked for ("en slices that each fit one context", the brief), and
  `docs/README.md` says a smaller `--budget` reads deeper at more slices; no run measures depth against budget,
  being an eval spend this pack leaves out. Claude 7 taken: his words for the auditor's verdict map to the ledger's
  last pass and the unreached list, stale texts to "un mapa detallado", and `docs check` is in scope and spec 6.
  Claude 8 taken: the entry index's module is `bin/lib/docs-entry.mjs`, the cross index's `docs-cross.mjs`. Claude 9
  taken: the six folders get a decision in spec 4. Claude 10 taken: the index is the table under `## Index`, tested
  with a second table. Claude 11 taken: the root's configuration is core and the rest is every other folder; the
  import rule is stated as rounds. Claude 12 taken: his heading at `docs/ROADMAP.md:1005` is restored and spec 5's
  pattern no longer matches it. Claude 13 taken in part: the model he named is not in the lineup this session knows
  (Fable 5.1, Opus 5.5), so the lead is asked which one in the close's report, with `--budget` meanwhile. Claude 14
  taken: `## Next step` is one current state. Codex 1 taken: composed paths, non-JSON records, families and their
  planted breaks in spec 4. Codex 2 taken (with Claude 1). Codex 4 taken: 1,432 on `47d96a3`, and the inference
  figures labelled by the rules that made them. Shared: Claude 1 and Codex 2, 5 and 3.
- L9 2026-11-02, T4's first run (`node bin/js-harness.mjs docs index`, on `d195f663` with T4's tree): 76
  capabilities; 64 cite a document, 0 name a rule by id (the four `rule:` ids of SPEC sit outside its capabilities,
  `docs/SPEC.md:104-117` and `:976`), 6 name a failure entry; 34 reach a rule and 41 a failure entry by inference,
  263 inferred links in all. Against the depth pass's figures: 64 against the prototype's 60 (one capability added
  since, and the cut now reads `docs/` paths too), 34 rules as Codex recounted (read 9b105375), 41 failures against 42.
  Too shared: `bin/check.mjs` (4 rules, 15 Today lines), `bin/lib/manifest.mjs` (18 rules),
  `bin/lib/protocols-skill.mjs` (9 rules). Reached by none: 32 rules (24 of them homed in a too-shared file), 48
  failure entries, 104 feature documents. Two explicit links did not resolve, both stale quotes of SPEC, fixed:
  `docs/SPEC.md:819` quoted "The Codex review's allowance" of `odd/tasks/rule-hierarchy.md`, whose section is "The
  plan against its allowance" (`:1279`); `docs/SPEC.md:909` quoted "The specification of the harness" of
  `docs/ROADMAP.md`, which is in `odd/tasks/rule-hierarchy.md:5196`. The hand check (spec 3's bar): every 13th of the
  263 inferred links, 20 in all, each read against its failure entry's or rule's text: right 10 (lock-not-a-queue,
  init-leaves-codegraph-files, throughput-compare-days, edit-during-review, wait-every, context-fills-unnoticed,
  hours-guessed for the notices' record, host-restart-unseen, block-referred-by-hour, control-phrase-min), wrong 10
  (broken-wait-script twice, check-survivor-test-fails, documents-merge-runs-gate and gate-narrow-pass-stood, all
  through `bin/check.test.mjs`; context-cut-by-percentage twice through `bin/sessions.test.mjs`; hours-guessed for a
  session that starts at once; context-pause through `bin/lib/sessions.mjs`; board-read-loads-gate through
  `bin/lib/test-run-warning.test.mjs`). 10 of 20 is under 14, so the inferred links print as unverified
  (`INFERRED_CHECK` in `bin/lib/docs-cross.mjs`), as the plan said. Seen, not built: 7 of the 10 wrong came
  through a test file that many failures' controls name and that the Today-line count does not see, since a test is
  named in Proof (9 of the 10 came through a test file); counting Proof lines in the cut is a change of spec 3, left
  to the audit.
- L10 2026-11-02, T4's reviews over `d195f66..c166e11`. Codex: 2 parts, 417,589 input tokens (estimated 266,000 to
  400,000; allowance 548,400), 3 P2 taken: a quoted section is compared with its white space squashed, so a quote
  reflowed across lines still resolves; `--json` carries `inferredLinks` (the label and the hand check); `index`
  names an unreadable file on stderr. The Claude lenses: reliability 0 findings (41,992 input tokens), readability 1
  warning taken (20,363): the row now fails on any of the three inputs gone, from the structured result and not a
  message's prefix, so deleting `docs/RULES.md` cannot switch the part off. gentle-ai (lineage
  review-720df49713aaec63, reliability lens, the standing consent): approved with 2 warnings and 4 suggestions, none
  blocking, acknowledged. Taken: a failure id inside a path or a `rule:` id is no link (this dropped one false link,
  `board-summary-stale` read inside `odd/tasks/board-summary-stale.md` at `docs/SPEC.md:711`, so 5 capabilities name a
  failure, not 6); a rule's declared failure absent from the register is broken; a retired rule with no successor
  says so. Rebutted: the crash on a tracked file deleted from the tree, since `readCorpus` gives every tracked file a
  text, empty when it cannot be read (`bin/docs.mjs:60`). Left: counting Proof lines in the cut (L9), and a command
  test of the "Too shared" block, which the module's test covers (`SHARED_LIMIT`).
- L11 2026-11-02, the fix `651290fc` reviewed: the reliability lens 0 findings (13,506 input tokens); Codex 81,279
  input tokens (estimated 100,000 to 150,000), 2 of its 3 findings fixed and the third in part: an unreadable input of
  the index itself was reported as its consequence (a register that does not read) and not as the file. Now the
  unreadable files are named first; test first.
- L12 2026-11-02, T4r: Codex read `d195f66..f6d3b35` again whole (291,485 input tokens; estimated 320,000 to 490,000),
  2 P2 taken: a cross-index input deleted from the tree but still tracked read as empty and passed (now "gone from the
  tree", from `readCorpus`'s `gone`); a failure cited beside the register with an id it lacks vanished (now
  `citedFailures`, the parenthesis holding `docs/FAILURES.md`, held to the register). gentle-ai over `c166e11..f6d3b35`
  (lineage review-abdd0fcaada95320) approved, acknowledged; its suggestion (the `.md` and leading-dot edges of
  `holdsWord`) taken in the test. The row half of the "gone" test failed for a reason of the test: `withRepo` in
  `bin/docs.test.mjs` was synchronous, so an async body's directory was removed at its first `await` and the row read
  "docs/README.md is missing"; it now awaits its body, and every call of it is awaited (21 of 21 pass).

## Next step
State at 2026-11-02 ~11:50Z, branch `worktree-audit-pack` (worktree `audit-pack`). The plan's reviews are done
(three, L6 to L8, each recorded with `double-review take`); the lead was told of review 3's two real failures and
of `CLAUDE.md:74-91` (two notes, 11:39Z). T3 is built: `js-harness docs` (`plan`, `check`), `bin/lib/docs-plan.mjs`,
`bin/lib/docs-entry.mjs`, the `docs` row of `check` in the harness's own repository (`isHarnessRepository`,
`bin/lib/spec.mjs`), `docs/README.md`, SPEC's capability "A model starting cold can audit the whole harness",
README's `### js-harness docs`, `AGENTS.md` (S11 and the entry, inside spans edited in place, so
`bin/lib/rules-coverage-data.mjs` stays at 999 lines), GUIDE's command table, his heading at
`docs/ROADMAP.md:1005` restored. Next: commit T3; delivery as two chained pull requests, PR 1 the documents alone
up to `f2ca50f8` (branch `audit-pack-docs`) and PR 2 this branch on it; Codex and the Claude lenses over T3's code
(base: `f2ca50f8`), their cost said first; push both, open both, `js-harness notify --to orchestrator --kind ready
--pr <n>` for each. Then T4 (`docs index`, `bin/lib/docs-cross.mjs`), T5 (SPEC's record table, `docs/RECORDS.md`),
T6 (the close, with the model he means by "Fable 5.5" asked of the lead).
- Update ~12:10Z: T3 committed (`c51daf56`, gate green). Its reviews over `f2ca50f..c51daf5`: the Claude lenses
  (reliability, readability, resilience) 0 findings, about 31,500 input tokens each; Codex, 3 parts, 338,437 input
  tokens, 2 P2 taken and fixed test first: `docs plan` now names an unreadable file and exits 1, and the packer
  asks again whether a group fits after closing the first slice, which brings in the opening. Next: the fix's
  commit, its Codex review (base `c51daf56`), push, the two pull requests.
- Update ~12:15Z: the fix `1fb4f34` reviewed (Codex correct at 0.98, the reliability lens 0 findings). Pushed
  `audit-pack-docs` (at `f2ca50f8`) and this branch; PR 751 (documents, base main) told ready; PR 752 (T3, base
  `audit-pack-docs`) refused by `notify --kind ready` until 751 merges: then `gh pr edit 752 --base main` and
  `js-harness notify --to orchestrator --kind ready --pr 752`. Next: T4, `js-harness docs index` with
  `bin/lib/docs-cross.mjs`, test first, on a branch from this one.
- Update ~13:20Z: the lead (note, 08:20 local): do not wait for 751, which lands with 750 and 753; T4 goes on this
  branch (752's); the lead says when 751 lands, then rebase 752 on main and notify it ready. T4 starts with
  `bin/lib/docs-cross.test.mjs`, written first: explicit links from a capability's text (`odd/`/`docs/` paths,
  `rule:<id>`, failure ids), inferred ones apart, too-shared files (over 8 rules or over 8 Today lines) printed.
- Update ~14:00Z: T4 built, test first (`bin/lib/docs-cross.mjs` and its test, `docs index` and the row's link part
  in `bin/docs.mjs`, README, the help line, SPEC's capability), its first run and hand check in L9, SPEC's two stale
  quotes fixed. Next: T4's commit; Codex and the Claude lenses over it (base `d195f663`), cost said first; push;
  then T5.
- Update ~14:15Z: T4 `c166e115`, fixes `651290fc` and `f53617f3`, task T4r `f6d3b355`, all reviewed (L10 to L12), not
  pushed. Uncommitted: T4r's two fixes (L12) in `bin/docs.mjs`, `bin/lib/docs-cross.mjs` and both tests; the test "an
  input of the cross index deleted from the tree" fails on its row half (the row passes; `docs index` already fails
  right). Next: find why `checkDocs` misses `corpus.gone`, commit, Codex and the reliability lens over the fix (base
  `f6d3b355`), push, mark T4 and T4r done, then T5. PR 752 waits for 751 (the lead notifies).
- Update ~14:25Z: the merge queue left PR 751 out of a land (its note, 09:23 local): "FAIL contracts 1 of 161
  contracts fail". First: find which with `js-harness check` on branch `audit-pack-docs` (`f2ca50f8`); the likely one
  is this document's contract, whose done-when names `bin/docs.test.mjs` and the docs tests that only PR 752 brings.
  Fix on `audit-pack-docs` (documents only), push, tell the lead; then the T4r work above.
- Update ~15:30Z: PR 751 landed on main (`064f5c7`, the lead's note, 10:16 local), so its contracts failure is moot;
  PR 752 lands with 755 (10:18), so this branch is not pushed again. T4r's fixes committed here; T4 to T4r go on a
  new branch from main once 752 is in, then Codex and the reliability lens over the T4r fix (base `f6d3b355`), push,
  the pull request, ready.

# JH 268 · instruction files by folder, part 1

Locator: `odd/tasks/folder-instructions.md` · Engram mirror: `odd/folder-instructions/tasks` · Branch: `claude/heuristic-margulis-a6bae7`
Delivery: one draft pull request to main · Test runner: `node --test`

## State
Done and committed by JH 271 (JH 268 built it and committed nothing): the four folder files, their `check` rows,
their place in `rules check`, the SPEC row and its RECORDS section, the load probe and its measured run (L6), the
depth-pass judge skipping the folder files, the lens rounds (L7). Open: Codex's review, queued (L5); the moves of
lines out of `CLAUDE.md` and `AGENTS.md`, each a `rules change` on a rule/ branch (L4). `progress` no longer lists
`odd/tasks/CLAUDE.md` as a feature (L8); `resume` lists folders, not documents, so it gets no row there.

## Goal
Four folder instruction files that load when a session works in their folder, held by the gate to their size and to
naming rules without repeating them.

## Why
He approved the folder layout of `odd/tasks/activity-folders-trial.md`, section Layout (L1, L2): a folder file reaches
the session that reads or writes in that folder, writer sub-agents included, which the root files do not.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/folder-instructions.md` exits 0
- `node --test bin/check.test.mjs bin/rules.test.mjs evals/folder-load-probe.test.mjs` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- `## Log` holds the probe's command and output: each of the four files loaded on a `Read` of a file in its folder

## In scope / Out of scope
- In: the four files; `bin/lib/claude-md-budget.mjs`, `bin/check.mjs`, `bin/rules.mjs` and their tests; the probe
  `evals/folder-load-probe.mjs`; a row of `docs/SPEC.md` "Where state lives"; this document.
- Out: every line of `CLAUDE.md`, `AGENTS.md` and the skills (L4); part 2, the activity do and do-not in command
  output; the projects built with the harness.

## Constraints
- Each file under 50 lines, naming `rule:<id>` and repeating no rule — the brief and the Layout.
- The load probe never runs in `node --test`: it starts `claude`, so only its pure reader is tested.
- Spend: state at 4.5M cache-read, stop at 6M.

## Ask me before
Nothing: his words L1 and L2 approve the layout; a doubt goes to the lead as a note.

## Depth pass
- 1. Method: on-demand context, as the host documents it (code.claude.com/docs/en/memory.md: a nested `CLAUDE.md`
  loads when a file below its folder is read or written), held by a gate row like `claude-md budget`.
- 2. Raw material: his words L1, L2; the Layout (`odd/tasks/activity-folders-trial.md:201`); the research note
  `research-folder-instructions-2026-11-21.md` sections 1 to 4 (lead notes); `bin/lib/claude-md-budget.mjs:15`;
  `bin/rules.mjs:163` (`textFilesUnder`); `bin/lib/rules-change-run.mjs:170` (rule/ branch only).
- 3. The bar:
  spec 1: `node evals/folder-load-probe.mjs`: none, new behaviour (each file loaded on a `Read` in its folder)
  spec 2: `node --test bin/check.test.mjs`: none, new behaviour (a row per file)
  spec 3: `node --test bin/rules.test.mjs`: today a `rule:` mark in `bin/CLAUDE.md` is not read
  spec 4: left out because the records row is prose the `docs` row of `check` holds
- 4. Refutation: the cheapest test that could show a folder file never loads is the trial's probe 3 and the research
  note's P1 and P5 (a `Read` two levels down loads `bin/CLAUDE.md`): measured there, and re-run here on the real four
  files by spec 1. `rules change` refuses off a rule/ branch (`bin/lib/rules-change-run.mjs:170`), so no line can
  leave the root files in this branch.
  Verdict: supports
- 5. Request: the four files of the Layout, each under 50 lines, naming rules and repeating none; a `check` row each;
  their marks read by `rules check`; their record in the SPEC; a probe proving each loads. The moves of root lines are
  separate `rules change` sessions.
  Adds: none

## Specs
1. Each of the four files loads in a session that reads a file in its folder (the brief: "a test that proves each
   loads").
2. "a budget row each in `check`": under 50 lines, at least one `rule:<id>`, no rule's phrase.
3. "their place in `rules check`": a mark of an undeclared or retired rule in any of them fails.
4. "and in `uninstall`": they live in git, so git undoes them; the SPEC's records table says where they are and who
   reads them.

## Tasks
- T1 spec 2, 3: tests, then the rows and the marks (build, commit 1)
- T2 spec 1: the probe, its tested reader, its run (verify, commit 1)
- T3 spec 4: the SPEC row (docs, commit 1)

## Log
- L1 2026-11-21, his words (`js-harness sessions --quote 0cdab702-72bd-48e7-8a8e-0c38d4aca9c9 6027`): "Listo
  apliquemos lo de las carpetas como me dices y con las funcionalidades que me dices y quiero que a la final nos sirve
  verify cuando y como"
- L2 2026-11-21, his words (same transcript, line 6508): "Ok te apruebo y autorizo todos los cambios que  me dices y
  hazlos todos sin cuestion alguna listo?"
- L3 The tests were written before this document, against the order of `CLAUDE.md`; no source line came before them.
- L4 `rules change` runs only on a rule/ branch based on origin/main (`bin/lib/rules-change-run.mjs:170`), one rule a
  commit; so this branch moves no line out of `CLAUDE.md` or `AGENTS.md`, and the folder files point to them instead.
  Each move is its own small session, as the Layout's cost says; the protocols skill keeps its text (brief). The line
  budget is a constant (`FOLDER_INSTRUCTIONS_LINES`) for the same reason: declaring it as a rule is a `rules change`.
- L5 Codex: queued behind JH 267's five reviews (brief), recorded with `--unavailable`.
- L6 Spec 1, measured 2026-11-21 on CLI 2.1.330, claude-haiku-5-5, 4 runs (one a file), fixture under
  `C:\Users\Oficina\jh268-folder-probe` removed after (`ls`: no such file). Command
  `node evals/folder-load-probe.mjs --claude C:/Users/Oficina/.local/bin/claude.exe`, output:
  `LOADED  odd/tasks/CLAUDE.md  exit 0  transcript read  nested_memory: odd/tasks/CLAUDE.md`;
  `LOADED  bin/CLAUDE.md ...  nested_memory: bin/CLAUDE.md`; `LOADED  docs/CLAUDE.md ...  nested_memory: docs/CLAUDE.md`;
  `LOADED  evals/CLAUDE.md ...  nested_memory: evals/CLAUDE.md`; exit 0.
- L7 JH 271, 2026-11-21: JH 268's saved patch and files applied on `claude/heuristic-margulis-a6bae7`; the docs row
  asked for a RECORDS section and a README index row for `docs/CLAUDE.md`, added. Lenses readability and reliability
  over `555e1922..af2cea23` found the budget let 50 lines pass (now 49, `8088289e`), the four paths written by hand in
  three places (now `FOLDER_INSTRUCTIONS`, `8088289e`) and `odd/tasks/CLAUDE.md` cut at a Log heading by `rules check`
  (read whole, `ce2c0511`, its test red before); the last two runs closed with 0 findings. Codex recorded unavailable
  over `63ba29f8..ce2c0511` ("JH 267 holds the meter's room for 384's five reviews"), a debt until a review pays it.
- L8 JH 271: `node bin/js-harness.mjs progress` printed a row `[ ] odd/tasks: feature documents  0/0` for
  `odd/tasks/CLAUDE.md`; `bin/progress.mjs` now leaves `FOLDER_INSTRUCTIONS` out, its test red before. `resume`'s
  `documentFolders` (`bin/resume.mjs:337`) lists folders by last write, so it shows no row for the file.
  `docs/RECORDS.md` said `rules check` reads three folder files; it reads all four whole since `ce2c0511`.

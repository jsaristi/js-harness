# Progress view

Locator: `odd/tasks/progress-view.md` · Engram mirror: `odd/progress-view/tasks` · Branch: `feat/progress-view`

## Objective
`js-harness progress` reads a project's `docs/ROADMAP.md` and `odd/tasks/*.md` and prints every
roadmap phase and every feature with its checked and pending steps, a percentage, and what remains.
`--json` returns the same data, so Claude Desktop and mobile can render it as an inline widget on
request. Progress is counted by a command from checkboxes, never reinterpreted by a model.

## Why
Today "where are we" is answered by a model reading the roadmap and each feature doc, which costs
tokens and drifts. The phases table carries prose states (`Done`, `—`), not steps, so nothing can
count them. Every later phase (F2 onward) should be tracked by this command from its first step.

## Scope
- In: `bin/lib/progress.mjs` (pure markdown → groups of steps), `bin/progress.mjs` (`progress`,
  `progress --json`, `--cwd`), the dispatcher entry and help line, a `## Checklist` section in
  `docs/ROADMAP.md` with checkbox steps per phase, tests and docs.
- Out: a TUI entry (later, if it earns a place); a published page; editing checkboxes from the
  command (it is read-only); Antigravity.

## Constraints
- Zero dependencies; read-only; `--cwd` injectable so tests use fixture folders, never this repo.
- Checkboxes are `- [ ]` / `- [x]` (also `*`/`+` bullets, `X`, any indent); lines inside fenced
  code blocks are not steps.
- A missing roadmap or a missing `odd/tasks/` is not an error; finding neither is exit 1 with a
  one-line message on stderr. Exit 0 otherwise.

## Design
- Roadmap: the steps are the checkboxes under `## Checklist`; each belongs to the nearest preceding
  `### <phase>` heading. A phase with no steps is shown with `0/0`.
- Feature docs: one feature per `odd/tasks/<id>.md`, titled by its first `# ` heading (fallback: the
  file id); every checkbox in the file is a step.
- Text output: a totals line per section, then one line per phase or feature
  (`[x]`/`[ ]`, title, `done/total`, percentage); pending steps are listed under unfinished groups
  only, so finished work stays one line.
- JSON: `{ root, roadmap: { path, done, total, phases: [{ title, done, total, steps: [{ text,
  done }] }] } | null, features: [{ id, title, path, done, total, steps }], done, total }`.
  Percentages are derived by the reader; `total: 0` means no steps, not 100%.

## Acceptance criteria (done when)
- `npm run check` passes; every behavior above has a fixture test written first.
- `js-harness progress` and `--json` run on this repo and show the roadmap phases and the four
  feature docs; the output is recorded here.
- The roadmap phases carry checkbox steps, and the phases table points to the checklist.

## TDD
Mode: strict (source: user global config). Runner: `node --test`.

## Delivery
Strategy: `single-pr`, following `jsaristi/js-harness#1` and `#4` (one PR, each work-unit commit
reviewed). Forecast ~400–500 authored lines. The branch starts on `docs/codex-review` (two
unpushed docs commits), so the PR carries them too.

## Tasks
- [x] T1 `bin/lib/progress.mjs`: parse checkboxes (fences, bullets, indent), group roadmap steps by phase, read a feature doc's title and steps — route: delegated writer (2 non-trivial files with T2)
- [x] T2 `bin/progress.mjs`: read the project, text and `--json` output, `--cwd`, exit codes; dispatcher entry and help — route: delegated writer
- [ ] T3 Add the `## Checklist` to `docs/ROADMAP.md`, run `progress` on this repo, record the output, update the roadmap — route: inline (docs only)

## Progress
- 2026-09-27: document created after reading `bin/js-harness.mjs`, `bin/doctor.mjs` and the
  existing feature docs (all use `- [x] Tn ...` under `## Tasks`).
- 2026-09-27: T1 done, commit `65a121b`. Added `bin/lib/progress.mjs` (`parseSteps`,
  `parseRoadmap`, `parseFeature`, all pure over markdown text, no fs) and
  `bin/lib/progress.test.mjs` (20 inline-fixture cases: fences, bullets, indent, `X`, Checklist
  section boundaries, empty phases, `(unassigned)`, missing title, text trim, CRLF).
  RED (before implementation existed): `node --test bin/lib/progress.test.mjs` failed with
  `Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'D:\js-harness\bin\lib\progress.mjs' imported
  from D:\js-harness\bin\lib\progress.test.mjs'` — 1 failing (the whole file), 0 passing.
  GREEN (after implementation): same command → `tests 20 / pass 20 / fail 0`.
  `npm run check` → `PASS budget 1026 estimated tokens (budget 1500)` / `PASS tests node --test
  passed`.
- 2026-09-27: T2 done, commit `f54aced`. Added `bin/progress.mjs` (`progressMain`: `--cwd`,
  `--json`, reads `docs/ROADMAP.md` and `odd/tasks/*.md` via `bin/lib/progress.mjs`, repo-relative
  forward-slash paths, exit 1 only when neither is found) and `bin/progress.test.mjs` (12 cases:
  usage errors, missing roadmap/`odd/tasks`, sorted features, the documented JSON shape, text
  rendering incl. the em-dash/never-100% rule, and the injected-vs-real default `--cwd`). Wired
  `progress` into `bin/js-harness.mjs`'s `commands` map and `USAGE`, and extended
  `bin/js-harness.test.mjs`'s help test plus a new hermetic dispatch test.
  RED (before implementation existed): `node --test bin/progress.test.mjs` failed with `Error
  [ERR_MODULE_NOT_FOUND]: Cannot find module 'D:\js-harness\bin\progress.mjs' imported from
  D:\js-harness\bin\progress.test.mjs'` — 1 failing (the whole file), 0 passing.
  GREEN (after implementation, one intermediate red for a wrong percentage/spacing expectation in
  a test I wrote — fixed in the test, not the implementation): `node --test
  bin/lib/progress.test.mjs bin/progress.test.mjs bin/js-harness.test.mjs` → `tests 43 / pass 43 /
  fail 0`.
  `npm run check` → `PASS budget 1026 estimated tokens (budget 1500)` / `PASS tests node --test
  passed`.
  `node bin/js-harness.mjs progress --cwd D:/js-harness` → exit 0; roadmap `0/0` (no `## Checklist`
  yet — T3 adds it), features `15/17` `88%` across the four feature docs, one still open
  (`Progress view` `1/3`, this task's own doc, current as of T2).
  `node bin/js-harness.mjs progress --cwd D:/js-harness --json` → exit 0; parses to the documented
  shape (`root`, `roadmap: { path, done, total, phases }`, `features: [{ id, title, path, done,
  total, steps }]`, top-level `done`/`total`).
  Assumptions (not settled by the doc, picked as the simplest option): the `cwd` field in
  `progressMain`'s options is the injectable fallback used only when `--cwd` is absent (so tests
  can avoid depending on the real `process.cwd()`), not a bypass of the flag; the title column
  width is computed per run from the longest phase/feature title (`+2`), rather than a fixed
  constant, since titles vary far more here than doctor's five known tool ids; a blank line
  separates the Roadmap and Features sections (and precedes `Total`) for readability, matching no
  explicit spec line but no explicit spec line forbids it either.

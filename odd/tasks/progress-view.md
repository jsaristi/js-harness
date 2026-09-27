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
- [x] T2b Accepted review follow-ups: close a fence only on the same character and at least the opening length (R3-fence-mismatch, Codex P2); skip non-file `.md` entries and turn read errors into the documented exit codes (R3-unreadable-entry-crash); unknown flags and positionals are usage errors, exit 2 (R3-unknown-args-ignored) — route: delegated writer (2 non-trivial files)
- [x] T3 Add the `## Checklist` to `docs/ROADMAP.md`, run `progress` on this repo, record the output, update the roadmap — route: inline (docs only)
- [x] T4 Accepted final-slice review follow-ups: a symlinked `odd/tasks/*.md` counts when its target is a file (R3-symlinked-feature-dropped, a T2b regression); only ENOENT means absent, every other discovery error on `odd/tasks` or `docs/ROADMAP.md` is reported on stderr (R3-unreadable-tasks-dir-silent, Codex P2); a backtick opener whose info string contains a backtick is not a fence (R3-backtick-info-string) — route: delegated writer (2 non-trivial files)

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
- 2026-09-27: T1–T2 reviewed as one slice from `1d8b048` (the branch point). gentle-ai lineage
  `review-3fdfa5e62f45af47`, risk `medium` (`slice_budget_reached`, 863 lines), one reliability
  lens: approved and acknowledged, with three advisory findings accepted into T2b
  (R3-fence-mismatch, R3-unreadable-entry-crash, R3-unknown-args-ignored). Codex (`gpt-6-sol`,
  `xhigh`) on the same range: P1 "roadmap has no `## Checklist`" is T3; P2 "match fence closers to
  their opening delimiter" duplicates R3-fence-mismatch. The first Codex attempt failed because the
  plugin's shared app-server still held the token from before the ChatGPT Plus login
  (`~/.codex/auth.json` rewritten 16:45, broker started 16:05); stopping the broker let the plugin
  start a fresh one.
- 2026-09-27: T2b done, commit `d8daaee`. Fixed the three accepted findings:
  `bin/lib/progress.mjs`'s fence toggle now records the opener's character and length and only
  treats a line as a closer per CommonMark (same character, at least as long, nothing but
  whitespace after — `matchFence`/`isFenceClose`), instead of toggling on any fence-looking line;
  `bin/progress.mjs`'s `readFeatures` now filters `odd/tasks` entries by `dirent.isFile()` (a
  directory named `x.md` is skipped, not read) and both `readRoadmap`/`readFeatures` route every
  read through `tryReadFile`, which reports `<path>: <code>` on stderr and treats that source as
  skipped instead of throwing, keeping the documented exit codes (0 if anything was read, 1 if
  nothing); `parseArgs` now walks argv token by token instead of probing for known flag names, so
  an unknown flag, `--cwd=value`, or a positional argument is a usage error (exit 2) instead of
  being silently ignored. Added a `readFile` option to `progressMain` (defaults to
  `fs.readFileSync`) so the read-error path could be tested by injection rather than relying on
  OS-specific permission bits.
  RED (new tests added against the unfixed code, before any fix): `node --test
  bin/lib/progress.test.mjs` → 3 of the 3 new fence tests failed (22 pass, 3 fail), e.g. the
  `~~~~` + nested ` ``` ` case returned the fenced checkbox as a real step instead of nothing.
  `node --test bin/progress.test.mjs` → 8 of the 8 new tests failed (12 pass, 8 fail); the
  directory-skip case crashed `progressMain` outright: `Error: EISDIR: illegal operation on a
  directory, read at Object.readFileSync (node:fs:441:20) ... at readFeatures
  (file:///D:/js-harness/bin/progress.mjs:56:16) at progressMain (...:132:20)` — proving
  R3-unreadable-entry-crash was real, not just a theoretical review note.
  GREEN (after the fixes): `node --test bin/lib/progress.test.mjs bin/progress.test.mjs
  bin/js-harness.test.mjs` → `tests 56 / pass 56 / fail 0`.
  `npm run check` → `PASS budget 1026 estimated tokens (budget 1500)` / `PASS tests node --test
  passed`.
  `node bin/js-harness.mjs progress --cwd D:/js-harness` → exit 0 (unchanged from T2; still no
  `## Checklist` in `docs/ROADMAP.md` — T3).
- 2026-09-27: T3 done, commit below this entry. `docs/ROADMAP.md` gains `## Checklist` with one
  `###` per phase (F0 to F7, Install and update, Stack doctor, Progress view, Project init); the
  phases table now points to it and the Progress view row reads "In progress". Real run on this
  repo, `node bin/js-harness.mjs progress` → exit 0: `Roadmap docs/ROADMAP.md 20/43 47%` (F0, F1,
  Install and update, Stack doctor at 100%; Progress view 4/5 with "Reviewed and merged" pending;
  F2 to F7 and Project init at 0%), `Features 17/18 94%`, `Total 37/61 61%`. `--json` → exit 0,
  `37/61`, 12 phases, 4 features. `node --test` → `tests 269 / pass 269 / fail 0`.
  Review state: T2b assessed `medium`, `under_budget` (352 lines from `5117e79`), so the slice
  `5117e79..HEAD` is reviewed once at feature close, before the PR.
- 2026-09-27: slice `5117e79..8bf53a7` (T2b, T3) reviewed. gentle-ai lineage
  `review-17fd24ad8241643d`, reliability lens: approved and acknowledged, three advisory findings
  accepted into T4. Codex (`gpt-6-sol`, `xhigh`): one P2, "report directory-read failures instead
  of treating features as absent", which duplicates R3-unreadable-tasks-dir-silent.
- 2026-09-27: T4 done, commit `this commit`. Fixed the three accepted findings:
  `bin/progress.mjs`'s `readFeatures` no longer filters `odd/tasks` entries on `Dirent.isFile()`
  alone (a T2b regression that silently dropped every symlinked feature doc, since `isFile()`
  reflects the link itself, not its target); a `.md` entry that is a symlink now gets its own
  `stat` of the target, counted when the target is a file, and reported on stderr + skipped when
  the target is missing or otherwise unreadable (R3-symlinked-feature-dropped). Both
  `readRoadmap`'s `stat` on `docs/ROADMAP.md` and `readFeatures`'s `readdir` on `odd/tasks` now
  treat only `ENOENT` as silent absence; any other error (`EACCES`, `ENOTDIR`, ...) is reported on
  stderr as `js-harness progress: <relative path>: <code>` and that source is skipped
  (R3-unreadable-tasks-dir-silent, Codex P2) — and the exit-1 message now reads `nothing could be
  read under <root>` instead of the absence wording whenever a real error, not genuine absence,
  is why nothing came back. `bin/lib/progress.mjs`'s `matchFenceOpen` now refuses a backtick
  opener whose info string itself contains a backtick, so inline code like `` ```inline``` text ``
  is read as ordinary text instead of opening a bogus fence (R3-backtick-info-string); a tilde
  opener is unaffected, since a tilde fence may contain backticks. Added injectable `stat` and
  `readdir` options to `progressMain` (same pattern as T2b's `readFile`), so the discovery-error
  paths could be tested without OS-specific permission bits.
  RED (new tests added against the unfixed code, before any fix): `node --test
  bin/lib/progress.test.mjs` → 2 of 2 new backtick-info-string tests failed (27 pass, 2 fail).
  `node --test bin/progress.test.mjs` → 4 of 4 new discovery-error tests failed (20 pass, 4 fail,
  2 skipped); the 2 skips are the symlink tests, both hitting `EPERM` on `fs.symlinkSync` on this
  machine (no Windows developer mode) — caught and turned into `t.skip('symlinks need privileges
  on this machine')` per the review's own instruction, so they neither passed nor silently
  vanished. Symlink behavior itself (following a valid target, reporting+skipping a dangling one)
  is therefore unverified on this machine; the code path mirrors the already-tested
  `tryReadFile`/stat-error handling used elsewhere in the same file, but that is not the same as
  an observed pass.
  GREEN (after the fixes): `node --test` (full suite, not just the progress files) →
  `tests 279 / pass 277 / fail 0 / skipped 2` (the same 2 symlink skips).
  `npm run check` → `PASS budget 1026 estimated tokens (budget 1500)` / `PASS tests node --test
  passed`.
  `node bin/js-harness.mjs progress` (default `--cwd`, this repo) → exit 0, `Total  38/62  61%`
  (Roadmap `20/43` `47%`, Features `18/19` `95%` — T4's own line in this doc is the one pending
  step now).
- Next: push `feat/progress-view` and open the PR (it carries the two `docs/codex-review`
  commits); a final review of `8bf53a7..HEAD` (T4) before that; merge after Sebastián's
  go-ahead.

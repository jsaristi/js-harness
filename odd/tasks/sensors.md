# Sensors

Locator: `odd/tasks/sensors.md` · Engram mirror: `odd/sensors/tasks` · Branch: `feat/sensors`

## Goal
`js-harness check`, and so every pre-commit it guards, runs a project's own tests and lint or
typecheck, holds its `AGENTS.md` to the budget, and says whether the pending change is due a
gentle-ai review by risk — in any initialized project, not only in this repo.

## Why
Principle 1 of the roadmap: a check that runs costs zero tokens per turn and cannot be forgotten.
Today `check` hardcodes `node --test`, which is this repo's runner and the wrong one for most
projects `init` wires the gate into, so a project's real tests and lint never run at commit time.
And whether a change is due a review is known only if the agent remembers to run
`gentle-ai review assess`; a row in the gate makes the answer appear at every commit.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/sensors.md` exits 0
- `node --test bin/check.test.mjs` exits 0
- `node bin/js-harness.mjs progress` shows the four F4 roadmap steps checked
- In a fixture project whose `package.json` has `test` and `lint` scripts, `check` prints a row
  for each and fails when either exits non-zero

## In scope / Out of scope
- In: `bin/check.mjs` and its tests (sensor rows, the review row), `docs/ROADMAP.md`, the
  `AGENTS.md` line that describes the gate.
- Out: `init` and `harness.json`'s pin logic (sensors are read at check time, so `init` needs no
  change); installing or configuring a linter or gentle-ai (the stack doctor reports tools, it
  never installs them); making a review block a commit (RDD is Sebastián's switch, and a slice
  under the review budget is committed before it is reviewed).

## Constraints
- Zero dependencies and fixture-based tests — because every command must run on any machine with
  no install step (AGENTS.md, "How the repo works").
- Sensor commands run with the home directory pointed at a throwaway directory — because a test
  that forgot `--home` once wrote into the real one (`bin/check.mjs`, `checkTests`), and the gate
  must never be the thing that touches a user's home.
- The review row is informational and fail-open — because gentle-ai owns review; a missing or
  failing `gentle-ai` must not turn a commit red.

## Effort
medium

## Ask me before
Adding a dev dependency (for example TypeScript, to give this repo a typecheck sensor); making
the review row block a commit or a push.

## TDD
Mode: strict (source: user global config). Runner: `node --test`.

## Delivery
Forecast: ~450–550 authored lines (sensor discovery and rows, the review row, tests, docs), just
above the ~400 slice budget. Strategy: `ask-on-risk`; chain strategy `stacked-to-main`, reusing
Sebastián's choice for `odd/tasks/project-init.md` and `odd/tasks/task-contract.md`: each slice is
its own PR against `main`, merged in order. Slices: 1 = T1–T2, 2 = T3–T4.

## Design
- A sensor is a name and a shell command that must exit 0. `check` reads them from `harness.json`
  `sensors` (`{"tests": "pytest", "lint": "ruff check ."}`) when that key exists, which serves any
  language; otherwise from `package.json` scripts `test`, `lint` and `typecheck`, run as
  `npm run <script>` so `node_modules/.bin` is on the path. npm's placeholder test script (`echo
  "Error: no test specified" && exit 1`) counts as no script.
- Each sensor is one `check` row; a red row keeps the command's output, as `tests` does today.
  With no sensor at all, one INFO row says so and names both ways to declare one.
- This repo declares nothing new: its `package.json` `test` script is `node --test`, so its
  `tests` row runs the same suite as before, now through the generic path.
- The review row runs `gentle-ai review assess --cwd <root> --json` on the pending change and
  prints the risk tier and `review_due`; with RDD off, no pending change, or no `gentle-ai`, it
  says so. It is INFO, never FAIL.

## Tasks
- [x] T1 Sensor rows: tests, lint and typecheck from `harness.json` `sensors` or `package.json`
  scripts, each a row, run with a throwaway home (route: delegated writer — `check.mjs` and its
  tests are two non-trivial files)
- [x] T2 Budget: prove with a fixture project that the budget row holds a project's `AGENTS.md`,
  and check off the roadmap step (route: inline, one test)
- [x] T3 Review row: the pending change's gentle-ai risk tier and `review_due`, INFO and fail-open
  (route: delegated writer)
- [ ] T4 Roadmap and `AGENTS.md` updated; F4 closed after review and merge (route: inline)

## Progress
- 2026-09-30: branch `feat/sensors` from `main` at 9e7def8; contract written (e66a77b).
- T1 (922e5e8, delegated writer): `discoverSensors`, `checkSensor`, `checkSensors` replace the
  hardcoded `checkTests`. RED: the new tests failed at import (1 failed, 0 passed); GREEN:
  `node --test bin/check.test.mjs` 38 pass. `npm run check` exits 0 with `PASS tests npm run
  test passed`.
- T1 review: gentle-ai RDD `medium`, `slice_budget_reached` (442 lines, base 9e7def8), one lens
  (`review-reliability`), approved and acknowledged (lineage `review-679b808bf30c6349`, authority
  burned); three non-blocking suggestions. Codex (`9e7def8..922e5e8`, recorded) found three P2s:
  a script merely mentioning npm's placeholder text was dropped, a non-object `harness.json` fell
  back silently, and npm wrote its cache and logs under `%LOCALAPPDATA%`.
- Fixes (89e33dd): exact placeholder match on `test` only; a non-object `harness.json` is an
  error; `npm_config_cache` inside the throwaway home; plus the three gentle-ai suggestions: a
  signal kill names the signal, a spawn error keeps the output, an empty `sensors` map is a named
  opt-out. RED: 6 new tests failed; GREEN: 43 pass. gentle-ai assess: `medium`, `under_budget`
  (110 lines), pending in the slice. Codex (`922e5e8..89e33dd`) found one more P2: an inherited
  uppercase `NPM_CONFIG_CACHE` wins on Windows.
- Fix (c672aeb): every case variant of an overridden variable is dropped. RED: 1 failed; GREEN: 44
  pass; `npm run check` exits 0. Codex (`89e33dd..c672aeb`): no findings. gentle-ai: pending in
  the slice, under budget.
- T2: no code needed. `checkBudget(cwd)` already reads the `AGENTS.md` of whatever root `check`
  runs in (`bin/check.mjs`, `checkBudget`), fixture projects prove it (`bin/check.test.mjs`,
  "checkBudget passes at exactly the token limit" and the two after it, and "main exits 1 when a
  row fails"), and `init` wires `exec js-harness check` into each project's pre-commit
  (`bin/lib/project.mjs`, `PRE_COMMIT_HOOK`), so a project's commit is held to the budget.
- Roadmap: "Tests", "Lint/LSP diagnostics" and "Budget" checked. Lint and typecheck are wired as
  sensors; this repo declares neither (a typecheck would need TypeScript, a dev dependency, which
  is Sebastián's call), and in-session LSP diagnostics come from the `typescript-lsp` plugin that
  `doctor` already reports.

- T3 (61a1490, delegated writer, on `feat/sensors-review` stacked on `feat/sensors` so slice 1
  stays its own branch): `checkReview` runs `gentle-ai review mode status --json` then `review
  assess --json` without a shell and prints an INFO `review` row; `deps.gentleAi` lets tests fake
  it. RED: the new tests failed at import (1 failed); GREEN: 58 pass. Its own pre-commit printed
  `INFO review medium risk, 2 paths, 295 lines: review not due (under_budget)`.
- Slice review: gentle-ai assess from 922e5e8: `medium`, 475 lines, `slice_budget_reached`; one
  lens, approved and acknowledged (lineage `review-b10be8c609142f54`, authority burned); one
  WARNING (a null entry in `reasons` threw out of the fail-open row) and one SUGGESTION (a
  schema-tagged envelope missing fields printed `undefined`), both fixed in 2012aa5 (RED 2 failed,
  GREEN 60). Codex (`c672aeb..2012aa5`) found one P2: gentle-ai answers `changed_paths: 0` also
  when it cannot build the candidate, which the row reported as a clean tree; fixed in 4b53504
  (RED 1 failed, GREEN 61), and Codex (`2012aa5..4b53504`) found nothing more. gentle-ai: the two
  fixes are under budget, pending in the slice (last reviewed boundary 61a1490).
- T4 (inline): `AGENTS.md` says the gate reports whether review is due; the roadmap records the
  Sensors decision, checks "RDD-by-risk wired", and points Next at merging the two slices.
  Closing F4 waits on the merges.
- Whole-branch review (the stop hook's candidate, 9e7def8..838e673, 944 lines): gentle-ai one
  lens, approved and acknowledged (lineage `review-bb058dd562b275b7`, authority burned), so the two
  fixes left under budget are now reviewed too. Two suggestions, carried as follow-ups below.

- Review of `9e7def8..32c8fc4` (the stop hook's next candidate, docs only since the last one):
  approved and acknowledged (lineage `review-7bcf1b01b8e4ca06`), with one WARNING: sensors had
  no timeout, so a hung script (watch mode, a linter waiting on stdin) would hold the pre-commit
  forever. It predates this feature (`checkTests` had none), but sensors now come from any project.
- Slice 1 merged to `main` via `jsaristi/js-harness#17` as 1cd7f64 (2026-09-30, on Sebastián's
  go-ahead); `feat/sensors-review` rebased onto it (`--onto origin/main a7d9a68`), so slice 2's
  commits have new ids (T3 is f605617, its fixes b1bd8d3 and ba986a9).
- Sensor timeout (c5de133, delegated writer, route recorded: two non-trivial files): every sensor
  gets 10 minutes. `spawnSync`'s own timeout killed only the shell and left the real command
  running (RED: the never-exits test's cleanup hit EPERM because the orphaned `node` grandchild
  still held its cwd), so sensors run through an async `runSensor` that kills the tree —
  `taskkill /T /F` on Windows, the process group elsewhere (`detached`), and on POSIX forwards
  SIGINT/SIGTERM/SIGHUP to that group so a Ctrl-C still stops it. GREEN: 64 pass; `npm run check`
  exits 0 (75 s); no orphaned `node` process left after the suite. The POSIX path is untested
  here (this machine is Windows only). gentle-ai assess from d6be17c: `medium`, 222 lines,
  `under_budget`.
- Slice 2 review (`1cd7f64..c7c20a8`): gentle-ai approved and acknowledged (lineage
  `review-f7cbc1d4bdab478f`) with three suggestions; Codex found one P2 that matched one of them:
  a shell that exits while a background descendant holds its pipes left that descendant running
  and reported success. Fixed in 230fd04 (same writer): the survivors are killed on that path (the
  group on POSIX; the shell's direct children, found by `ParentProcessId`, on Windows), the
  throwaway home is removed best-effort, and a review reason without a string `code` is skipped.
  RED: 3 failed; GREEN: 66 pass; `npm run check` exits 0; no fixture process left. Codex
  (`c7c20a8..230fd04`): no findings.

## Follow-ups
- The review row's two gentle-ai calls each get a 20 s timeout, so a hung gentle-ai can add ~40 s
  to a commit; a shared deadline, or a short one for `mode status`, would bound it.
- A clean tree is recognised by gentle-ai's English detail "no pending changes"; if gentle-ai adds
  a stable code for it, match that instead, or pin the phrase in a test against real output.
- The review row spawns `gentle-ai` without a shell, so on Windows a `.cmd` or `.ps1` shim would
  read as "not found"; gentle-ai installs as a Go binary today, so this is latent.
- `contract run` uses `spawnSync` with a timeout too, so a timed-out done-when command leaves its
  grandchildren running the same way; `runSensor` could serve both.
- The sensor runner's POSIX path (process-group kill, signal forwarding) has no test on a POSIX
  machine yet.
- On Windows, a survivor whose own parent exited before the shell is not a direct child of the
  shell, so the `ParentProcessId` lookup after the shell exits does not find it.

## Next
Slice 2 (`feat/sensors-review`, `origin/main..HEAD`) is reviewed by Codex end to end and ready
for push and a PR against `main` on Sebastián's go-ahead. After it merges, mark F4 done in the roadmap and
check off T4.

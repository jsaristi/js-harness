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
- [ ] T1 Sensor rows: tests, lint and typecheck from `harness.json` `sensors` or `package.json`
  scripts, each a row, run with a throwaway home (route: delegated writer — `check.mjs` and its
  tests are two non-trivial files)
- [ ] T2 Budget: prove with a fixture project that the budget row holds a project's `AGENTS.md`,
  and check off the roadmap step (route: inline, one test)
- [ ] T3 Review row: the pending change's gentle-ai risk tier and `review_due`, INFO and fail-open
  (route: delegated writer)
- [ ] T4 Roadmap and `AGENTS.md` updated; F4 closed after review and merge (route: inline)

## Progress
- 2026-09-30: branch `feat/sensors` from `main` at 9e7def8; contract written.

## Next
T1.

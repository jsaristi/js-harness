# The gate log keeps the names of the tests that failed

Locator: `odd/tasks/gate-log-failing-tests.md` · Engram mirror: `odd/gate-log-failing-tests/tasks` ·
Branch: `feat/gate-log-failing-tests` · Delivery: `ask-on-risk` · Runner: `node --test`

## Goal
A gate whose sensor failed says, in its end line of the gate log, which tests failed.

## Why
A WSL2 run's output lives in the mirror and in the report of the gate; on the night of 2026-10-14 JH 11
could not get back which test had failed once that report was gone.

## Done when
- `node --test bin/check.test.mjs` exits 0
- `npm run check` exits 0
- The end line of a gate whose `node --test` sensor failed holds `failing`, the names of its failing tests.

## In scope / Out of scope
- In: `bin/check.mjs` (`failingTests`, the end line), its tests, `docs/ROADMAP.md`.
- Out: `gate log`'s printed lines (unchanged), the report's rows (unchanged).

## Constraints
- A line of the log is one write and has to stay short — so twenty names at most, two hundred characters
  each.

## Effort
high

## Ask me before
Nothing planned: the order is the lead's.

## Specs

- **S1** (the lead, 2026-10-14 14:21): "(a) the gate log keeps the failing test names of a WSL run (JH 11
  could not recover one tonight)". "Test first."
  - Read from the output as `node --test` prints it: the lines under `✖ failing tests:` of the spec
    reporter (the default when the output is no terminal), else the top-level `not ok <n> - <name>` of
    the tap reporter. Kept for every failed sensor, wherever it ran: a Windows run loses its report the
    same way.

## Tasks

| ID | Specs | Route | Status | Evidence |
|----|-------|-------|--------|----------|
| T1 | S1 | inline | done | RED: the export was missing; GREEN: the 2 new tests, and `bin/check.test.mjs` 200/200 |

## Log

- **L1** (2026-10-14): the lead's order, S1, verbatim.

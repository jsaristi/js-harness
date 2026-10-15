A test that fails and then passes when its file is run again is quarantined in a committed ledger, and does not block.
Branch: feat/flaky-ledger. Delivery: ask-on-risk. Tests: `node --test` (the gate runs them in WSL2).

## Goal
When the gate's suite fails, the failed test files are run once more, alone. A file that passes on that
rerun is a flaky one: it goes into a committed quarantine ledger with an owner and an expiry, it still
runs in every gate, and while its entry stands it does not block.

## Why
A gate is one at a time on this machine, with a median wait of 30 minutes for a turn (parallel-gate.md).
A test that fails by timing under load, such as `eval-interrupt-process-alive` in docs/FAILURES.md on
2026-10-15, turns a whole gate red and costs a turn of it, with nothing wrong in the change.

## Done when
- `node --test bin/lib/flaky.test.mjs` exits 0
- `npm run check` exits 0

## In scope / Out of scope
- In: the tests sensor of bin/check.mjs, a new bin/lib/flaky.mjs and its tests, the ledger file, README, this document.
- Out: the GitHub workflow and the CircleCI config; the exact-tests selection (odd/tasks/exact-tests.md), which decides what runs, not what a failure means.

## Constraints
- A failure that does not pass on its rerun still blocks — because only a pass on rerun says the test, not the change, is at fault.
- The ledger is a file in the repository, written by a person or a command and committed — because a quarantine nobody can read in git is a hidden pass.

## Effort
high

## Ask me before
- Nothing beyond the repository's rules.

## Specs
- S1. His answer, tapped (the orchestrator's transcript b878a67f, line 4162, 2026-10-14T21:26:16Z), to the plan of parallel-gate.md: "Sí, en ese orden (Recomendada)".
- S2. Step 5 of that plan, the orchestrator's words (C:\Users\Oficina\.js-harness\research\parallel-gate.md, line 26): "Flaky: rerun only failed files once; a pass on rerun goes into a committed quarantine ledger with owner and expiry; still runs, does not block."
- S3. The orchestrator's order to JH 10 (cross-session message, 2026-10-15): "Tonight's eval-interrupt-process-alive in FAILURES.md is the first case. Feature document with the task contract, test first."

## Tasks
- [ ] T1 (S2): the map of the tests sensor (how the suite runs, how a failed file is named in its output, the exact-tests shadow), by a read-only explorer; then the design written here. Route: delegated, read-only.
- [ ] T2 (S2): rerun the failed files once, test first. Route: inline.
- [ ] T3 (S2, S3): the ledger, its owner and expiry, and a quarantined file that fails and passes on rerun does not block; the first entry. Route: inline.

## Log
- L1. 2026-10-15, the order: S3, verbatim; the plan: S1 and S2. Opened by JH 10 at 79% of its context, so that a compaction resumes from here.

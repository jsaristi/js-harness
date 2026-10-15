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

## Design (T1, from the explorer's map of 2026-10-15)
1. The failed files are read from the spec reporter's output: the `test at <path>:<line>:<col>` lines under
   `✖ failing tests:` (today `failingTests`, bin/check.mjs:737-744, keeps the names and drops these lines).
   A path is normalized to `/` and kept only when it is a test file of the repository (`testFilesOf`,
   bin/lib/select-tests.mjs:66-81). A failure that names no test file, a timeout and a kill are never
   rerun: they block as today.
2. The rerun is one more run of the same sensor, `node --test <files>`, through the same route
   (`checkSensor`, so WSL2 and its mirror when the tests run there), once, untraced, in `checkSensors`
   after a tests row that exited non-zero (bin/check.mjs:1328-1340).
3. The tests row passes only when the rerun exits 0 and every rerun file has a current entry in the
   ledger. Otherwise it fails with the text it has today, which tests pin (bin/check.test.mjs:4609 and the
   rows of point 5 of the map); those fakes print no `test at` line, so they start no rerun.
4. An INFO row `flaky` says what the rerun did: the files, its result, and for a file that passed and has
   no current entry, the entry to add. A file that passes on rerun and is not in the ledger blocks once:
   the ledger is committed by whoever adds the entry, and a gate that wrote it itself would pass on a file
   nobody committed (the second constraint). A decision of this session, said to the orchestrator.
5. The ledger is docs/FLAKY.md, written by hand as docs/FAILURES.md is: one `### <test file>` entry with
   `- Owner:`, `- Expires: <YYYY-MM-DD>` and `- Failure: <id in docs/FAILURES.md>`. A static row `flaky`
   validates it: a malformed entry fails the gate; an expired one is listed and no longer counts, so its
   file blocks again. The first entry: evals/suite.test.mjs, failure `eval-interrupt-process-alive`.

## Tasks
- [x] T1 (S2): the map of the tests sensor (how the suite runs, how a failed file is named in its output, the exact-tests shadow), by a read-only explorer; then the design written here. Route: delegated, read-only. Done: "Design" above.
- [x] T2 (S2): rerun the failed files once, test first. Route: inline. RED: bin/check-flaky.test.mjs (no second spawn); GREEN 2 of 2, with bin/lib/flaky.test.mjs 3 of 3. The rerun is in `checkSensors` and kept on the tests row as `row.rerun = { files, pass, detail }`; the row's text and pass are unchanged (T3 decides them). Commit: the work-unit commit after L2.
- [x] T3 (S2, S3): the ledger, its owner and expiry, and a quarantined file that fails and passes on rerun does not block; the first entry. Route: inline. RED: bin/lib/flaky.test.mjs (missing exports) and bin/check-flaky.test.mjs (2 new cases); GREEN 13 of 13 and 4 of 4. docs/FLAKY.md holds the first entry; README says it. Commit: the work-unit commit after L4.

## Log
- L1. 2026-10-15, the order: S3, verbatim; the plan: S1 and S2. Opened by JH 10 at 79% of its context, so that a compaction resumes from here.
- L2. 2026-10-15, T1 done (Design). T2 begun: `failedTestFiles(output, testFiles)` in bin/lib/flaky.mjs, test first (RED: missing module; GREEN 3 of 3 in bin/lib/flaky.test.mjs), not committed. Next in T2: in `checkSensors` (bin/check.mjs:1328-1340), after a tests row that exited non-zero, take `failedTestFiles(row.output, testFilesOf(root))` and, when there are some, run `{ name: 'tests', command: 'node --test <files>' }` once through `checkSensor`; its test first in a new bin/check-flaky.test.mjs with a fake spawn (as bin/check-test-concurrency.test.mjs does), asserting the second spawn's command and that the existing rows' texts do not change. Then T3: docs/FLAKY.md, its parser and static row, the pass rule, the INFO row. Interrupted for the orchestrator's priority (the first --land of 167 and the GitHub minutes proposal, sent 2026-10-15).
- L3. 2026-10-15, T2 committed: the rerun in `checkSensors`, with bin/check-flaky.test.mjs (2 of 2) and bin/lib/flaky.test.mjs (3 of 3). JH 10 was compacted by the host at 01:24 before the commit; the document held the state. Next: T3.
- L4. 2026-10-15, T3 done. One change to Design 4: the INFO row of the rerun is named `rerun`, not `flaky`, since `flaky` is already the static row of the ledger and two rows of one name would read as one. The lead relayed JH 15's two sightings of the eval failure (2026-10-14 about 15:45, 2026-10-15 about 01:30); both are in docs/FAILURES.md. The entry expires 2026-10-22, because the failure is the product's: the suite exits before the kernel has reaped the killed grandchild. The lead gave JH 10 that fix as the next small PR, after the first `--land` of 167: the sweep waits, bounded, about 2 s, for each killed pid, and says so if one outlives the bound; the test's own wait is unchanged.

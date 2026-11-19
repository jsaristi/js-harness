# merge-queue-dry-run

`js-harness merge-queue --dry-run` refuses a stale copy as `--land` does, and the queue's tests leave no folder in the
temporary folder. Item `mq-dryrun` of the plan of 2026-11-18 (version 4), session JH 226. Branch
`claude/merge-queue-dry-run-f51a20`; runner `node --test`, one file at a time; gate `npm run check`. Delivery: one pull
request; the lead (JH ORQ) reviews and lands it.

## State
T1 to T3 are done (L3, L4); the first reviews and the verifier answered (L5). Next: the reviews of the fix, then the
pull request. Open: the tick of
`docs/ROADMAP.md`'s "Later" line, which JH 222 holds this stretch; it is owed in the ready notice.

## Goal
A dry run from a copy whose `bin/` is not origin/main's stops as a land from it does, and running
`bin/merge-queue.test.mjs` leaves nothing behind in the temporary folder.

## Why
The dry run is how the lead previews a land. On 2026-11-15 (the 882 land) it passed on a stale installed copy while
`--land` refused it, so the preview said yes to a land that could not run. Separately, `makeQueueRepo` and eight other
sites in the queue's test make temporary folders and never remove them: 9,601 were counted on his machine.

## Done when
- `node --test bin/merge-queue.test.mjs` exits 0
- `node --test bin/conventions-arguments.test.mjs bin/conventions-errors.test.mjs` exits 0
- `npm run check` exits 0
- A dry run whose running copy differs from origin/main's `bin/` exits 1 with the differing paths named as the land
  names them (three, then a count), builds no
  worktree and writes no `lands.jsonl`; one whose copy matches (Windows line ends aside) exits 0.
- A run of `bin/merge-queue.test.mjs` with TEMP, TMP and TMPDIR set to an empty folder leaves that folder empty.

## In scope / Out of scope
- In: `bin/merge-queue.mjs` (the guard's condition, its message tail for a dry run, `USAGE`, the header comment),
  `README.md`'s one sentence on `--dry-run` in the merge-queue section, the merge-queue line of `bin/js-harness.mjs`'s
  help,
  `bin/merge-queue.test.mjs` (the new tests, one scratch root for every folder it makes), this document.
- Out: `docs/ROADMAP.md` and `docs/FAILURES.md`, held by JH 222 this stretch; other test files that may leak too
  (reported, not fixed); the folders already in his temporary folder (his, in the plan's `waits`);
  `bin/lib/merge-queue-stale-bin.mjs`, whose comparison is right and is only called from one more place.

## Constraints
- Tests first, seen red before the code — because the merge queue is delivery (`AGENTS.md`, high risk item 5).
- `--land`'s refusal stays byte for byte — because existing tests and the lead read it as it is.
- An independent verifier after the change's own checks — because high risk.
- Nothing in `bin/merge-queue.mjs` or its test is written before `codexspend`'s T3 is on main — because JH 220 changes
  both in this stretch.

## Ask me before
- Nothing beyond the brief: the reviews' door and the land are the lead's.

## Depth pass
- 1. Method: a release engineer's, on a preview that must predict the real run. The standard: a dry run refuses
  everything the real run would refuse before it acts, and says so with the same words, so "dry run passed" means
  "land would start". Smallest change: the existing `staleBin` guard runs for `--dry-run` too, in the same place.
  For the test folders, a test engineer's standard: every fixture a test makes is removed by the suite, pass or fail;
  smallest change: one root folder per test file, made once and removed in `after`, and a helper every site uses.
  Searched first: `grep -rn "dry-run" bin/*.mjs bin/lib/*.mjs README.md` (callers that read the dry run:
  `bin/lib/quiet.mjs:95` and `bin/advisor-gate.mjs:87` treat it as no land, unchanged by an exit code;
  `bin/lib/manifest.mjs:158`, `README.md:1207`, `bin/js-harness.mjs:38` describe it); `bin/lib/*.testkit.mjs` for a
  scratch helper (only `clean.testkit.mjs`'s `fixture(t)`, bound to its own fixture); `bin/conventions-*.test.mjs` for
  the two files (neither is on a legacy list).
- 2. Raw material: `docs/ROADMAP.md:934-935` (the 882 land, 2026-11-15 06:29 local); `bin/merge-queue.mjs:866-875`
  (the guard, `if (args.land)`); `bin/lib/merge-queue-stale-bin.mjs` (`staleBin`); `bin/merge-queue.mjs:765` (a
  `--refresh-copy` alone returns before `queueRun`, so the way out of a stale copy is not guarded);
  `bin/merge-queue.test.mjs:41-48` (`makeQueueRepo`, `mkdtempSync` with no removal) and the eight other `mkdtempSync`
  sites of that file; `bin/lib/git-fixture.testkit.mjs` (the template removes itself on exit, its copies do not);
  the plan's version 3 (d), 9,601 folders measured.
- 3. The bar:
  spec 1: `node --test bin/merge-queue.test.mjs`: today a dry run from a stale copy exits 0 and builds the candidate
  (no test holds it); after, exit 1 with the paths named, nothing built.
  spec 2: `node --test bin/merge-queue.test.mjs`: with TEMP at an empty folder, today one test (`--dry-run builds the candidate ...`) run with TEMP at an empty folder leaves
  `js-harness-merge-queue-9PZSOY` in it; after, the whole file leaves the folder empty, and a test holds that no
  `mkdtempSync` of that file bypasses the root.
- 4. Refutation: could the leak be the git template, which the suite already removes, rather than the copies? Run
  now on `b044dbf7`, TEMP at an empty scratch folder, `node --test --test-name-pattern="^--dry-run builds the
  candidate" bin/merge-queue.test.mjs`: 1 passed, and the folder holds one `js-harness-merge-queue-*` and no
  `js-harness-git-template-*`. So the copies leak and the template does not. For spec 1, `bin/merge-queue.mjs:870`
  is reached only under `args.land`, so a dry run never compares.
  Verdict: supports
- 5. Request: run the stale-copy guard for `--dry-run` as for `--land`, with the land's words and a tail that says a
  dry run predicts that refusal; make every folder `bin/merge-queue.test.mjs` creates live under one root removed
  after the file's tests, with a test that holds it.
  Adds: none

## Specs
1. "`merge-queue --dry-run` passed on a stale installed copy while `--land` refused it; the dry run checks copy
   against origin/main's `bin` too" (the plan's item `mq-dryrun`, from `docs/ROADMAP.md:934-935`).
2. "`makeQueueRepo` in `bin/merge-queue.test.mjs:41` makes a temporary directory it never removes (9,601 measured).
   The item makes the tests clean up after themselves" (the plan's version 3, (d)).

## Tasks
- [x] T1 (kind: docs) this document, before any source write: commit `acb3d9a5`.
- [x] T2 (kind: build) spec 2: the scratch root and its test, seen red; route: tests first, `node --test
  bin/merge-queue.test.mjs`.
- [x] T3 (kind: build) spec 1: the dry-run tests seen red, then the guard, `USAGE` and the header; route: tests first,
  `npm run check`.
- [ ] T4 (kind: verify) Codex and the lenses on the slice, and an independent verifier.

## Log
- L1 The request, as the brief gives it (JH ORQ, 2026-11-18, item `mq-dryrun` of plan version 4, approved by his
  answer "Sí, las 8" to question 340): "`js-harness merge-queue --dry-run` compares the installed copy with `bin` of
  origin/main; and the tests stop filling Temp with folders (`makeQueueRepo`, `bin/merge-queue.test.mjs:41`)."
- L2 2026-11-18: JH 222 holds `docs/ROADMAP.md` and `docs/FAILURES.md` (its notes in the shared folder), so the
  ROADMAP tick is left to the lead, named in the ready notice.
- L3 2026-11-18 18:48Z: T3 of `codexspend` on main (`0c28d083`) and the copy refreshed to it; main merged in
  (`5b273c00`). T2: the test that every `mkdtempSync` of the file is made under `scratchRoot` was red (ten made in
  the temporary folder itself), then green with `scratch(prefix)` and one `after` that removes the root with
  retries. A first whole run with TEMP at the long scratchpad path left the folder empty but failed seven relief
  tests; the same seven pass with the usual TEMP (`js-harness gate -- node --test --test-name-pattern=...`, 8 pass),
  so the cause is that path's length, not the change. The root adds about 20 characters to every fixture path.
- L4 2026-11-18: T3: the dry-run test of a stale copy was red (exit 0 where 1 was wanted) and the one of a matching
  copy with CRLF green; then `if (args.land || args.dryRun)` with a dry run's own tail, the land's words unchanged.
  The whole file with TEMP, TMP and TMPDIR at an empty `%TEMP%jh226`: 136 tests, 136 pass, the folder empty after.
  Not changed: `bin/lib/manifest.mjs:158`, the text written into projects, which says what a dry run shows and stays
  true.
- L5 2026-11-18, the reviews of `5b273c00..a2ef43c5`. The lenses (risk, resilience, readability, reliability): 0
  findings. Codex, three P3: (1) name every differing path in the dry run: answered, not changed: the dry run says the
  land's words so that it predicts the land, and the land names three and a count; "Done when" now says so. (2) The
  root made fixture paths 3 bytes longer, enough for a slug used as a file name to pass 255 bytes under a 211-byte
  TEMP: fixed, the root's prefix is `jhmq-`, so every fixture path is shorter than before the change. (3) The source
  scan passes if the root is never removed: fixed, a test runs one fixture test in a child process with TEMP at an
  empty folder and wants it empty; with the removal turned off it was red, restored green (2 pass). The verifier: pass
  with notes. Its help line note (`bin/js-harness.mjs:38` said only a land stops) is fixed. Its note that a removal
  failing after its retries turns a green run red is answered: it is meant, so a leak shows; the retries cover a short
  hold. Its note that plain `git clone`s in the file keep automatic maintenance on is out of scope: no failure seen.
  The mutation run left one `jhmq-*` folder in TEMP, removed by hand. `D:js-harness-mq-relief.log`, a log this
  session wrote by mistake outside the repository, is left for him to delete: the safety check refused its removal.
- L6 2026-11-18: the first commit of the fix was refused by its check: `bin/js-harness.test.mjs:705` pins the help
  line word for word, and the search of L2 had read the help but not its test. The test now pins the new line
  (6 pass), and the fix landed as `a7d8803f`.

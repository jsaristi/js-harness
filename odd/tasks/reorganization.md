# Reorganization: library code out of the commands, then a structure check

Locator: `odd/tasks/reorganization.md` · Engram mirror: `odd/reorganization/tasks` · Branch: `refactor/library-out-of-commands`
Delivery: slice 2 is three commits (2a, 2b, 2c) in one pull request the lead lands; slice 3 follows in its own.
Test runner: `node --test <one file>`; the commit's gate runs the rest. Plan: `reorg-plan-v2.md` in the lead's shared notes.

## Goal
Library modules stop importing commands for code that is library code: the Codex rows, the gate turn, the failing-test
reader, the package version and the permit relay's times live in `bin/lib`, and the commands re-export them.

## Why
Five of the eight places where a `bin/lib` module imports a command go: `windows-daily` (hourly) and `refresh-copy`
stop loading the 2,803-line gate to read one function (257-313 ms against 41-62 ms), `push-waits` stops loading it for
the Codex rows, and `manifest` stops loading `permit`. `check.mjs` shrinks by about a quarter, and slice 3's structure
check can then hold the line at the three imports left.

## Done when
- `npm run check` exits 0
- `git diff --name-only origin/main...HEAD -- '*.test.mjs'` prints nothing
- the behavior differential of S5 matches before and after, as recorded in the Log
- every commit holds at most 1,200 changed lines under `git show --numstat --no-renames`

## In scope / Out of scope
- In: `bin/check.mjs`, `bin/gate.mjs`, `bin/install.mjs`, `bin/permit.mjs`; the new `bin/lib/codex-review-rows.mjs`,
  `bin/lib/gate-turn.mjs`, `bin/lib/permit-times.mjs`; `bin/lib/flaky.mjs`, `bin/lib/version.mjs`,
  `bin/lib/codex-review-scope.mjs`, `bin/lib/rules-installed.mjs`; the import lines of `bin/lib/push-waits.mjs`,
  `bin/lib/refresh-copy.mjs`, `bin/lib/windows-daily.mjs` and `bin/lib/manifest.mjs`.
- Out: every test file (the re-exports keep their imports); the three library imports of commands left
  (`refresh-copy` of `update`, `spec` of `js-harness`, `windows-daily` of `notify`), which slice 3 lists; any change of
  behavior, text or exit code.

## Constraints
- A moved block keeps its code and doc comments byte for byte — because the proof is that removed lines equal added
  lines, imports aside, and a reword hidden in a move is a change no reader looks for.
- Changed lines are counted with `--no-renames` (`check.mjs` and `codex-review.mjs` count that way), so each commit stays
  under the 1,200-line rule by moving one area at a time.

## Ask me before
Nothing open: the plan's five decisions were settled with the recommended answers (his word of 2026-10-24).

## Specs
- S1 (2a). The lead: "move the Codex rows to bin/lib/codex-review-rows.mjs, and reuse codex-review-scope's `counted`."
  The block from `codexReviewCoverage` to `codexReviewDebt` moves; `counted` is exported from `codex-review-scope.mjs`
  and `check.mjs`'s copy goes. `check.mjs` re-exports `checkCodexReviews`, `codexReviewOffAt` and `checkCodexReviewDebt`;
  `push-waits.mjs` imports from the library module.
- S2 (2b). The lead: "move the gate turn and GATE_NOT_RUN to bin/lib/gate-turn.mjs, and failingTests to
  bin/lib/flaky.mjs." The gate turn is the block from `duration` to `claimOf`, with the `gate` and `gate log` rows it
  writes. `check.mjs` re-exports `takeGateTurn`, `claimOf`, `GATE_WAIT_USAGE`, `GATE_WAIT_SAID_MS` and `failingTests`;
  `gate.mjs` re-exports `GATE_NOT_RUN`. `refresh-copy.mjs` and `windows-daily.mjs` import from the library modules.
- S3 (2c). The lead: "move currentVersion to lib/version.mjs, which also replaces rules-installed.mjs:70; move WAIT_MS
  and LEASE_MINUTES to a lib module." `install.mjs` re-exports `currentVersion`, `permit.mjs` re-exports both times,
  and `manifest.mjs` imports them from `bin/lib/permit-times.mjs`. `rules-installed`'s copy version still reads null
  when the file cannot be read.
- S4. The lead: "The commands re-export the moved names, so no test file changes." Proof: "no test file in the diff,
  and the suite green; the lines removed equal the lines added, imports aside".
- S5. The lead: "a behavior differential on check, gate, merge-queue, windows-daily and --version against a git-archive
  copy of the base". Stdout, stderr and exit code are compared with a scratch home.
- S6. The lead: "one independent Opus verifier, since item 2 (pre-push Codex refusal) and item 4 (gate turn) apply."
  "Watch the 1,200-line commit rule under --no-renames. Its gentle-ai, Codex and ready steps are as usual; I land it."

## Tasks
- [x] T1 (kind: build) inline, S1, S4 — 2a, the Codex rows: 389 lines moved by line range; removed equals added
  but the module's header, `export` on `codexSwitchHere` and `counted`, and `check.mjs`'s copy of `counted` gone.
  `node --test bin/check-codex-reviews.test.mjs` 108 of 108, `bin/lib/push-waits.test.mjs` 18 of 18. Commit: 2a.
- [x] T2 (kind: build) inline, S2, S4 — 2b, the gate turn and `failingTests`: 281 lines from `check.mjs` and 6 from
  `gate.mjs` to `gate-turn.mjs`, 19 to `flaky.mjs`; removed equals added but the header, `export` on the five names
  `check.mjs` still reads, and `gate.mjs`'s re-export. `flaky` 18, `windows-daily` 11, `refresh-copy` 18 and `gate` 80
  tests pass. Commit: 2b.
- [x] T3 (kind: build) inline, S3, S4 — 2c, the version and the permit times: `currentVersion` reads
  `'..', '..', 'package.json'` from its new folder, the one line that had to change; `rules-installed`'s copy version
  calls it inside its try, so an unreadable file is still null, and loses its `fs` and `path` imports. `version` 12,
  `rules-installed` 10, `permit` 18, `install` 110 and `release-tags` 8 tests pass; `--version` prints 0.97.0. Commit: 2c.
- [ ] T4 (kind: verify) S5, S6 — the differential inline; one independent Opus verifier (items 2 and 4).
- [ ] T5 (kind: verify) S6 — gentle-ai per commit, Codex over the slice, the pull request and the ready notice.

## Log
- L1. 2026-10-24, the lead (06:54): "Reorg slice 1 landed (PR 564, main 868f5eca): every JS_HARNESS_HOME read now goes
  through bin/lib/home.mjs. Your next row is reorg slice 2, library code out of the commands. The plan is
  reorg-plan-v2.md in the shared notes, section 2 "Slice 2", with three commits (2a, 2b, 2c): 2a: move the Codex rows to
  bin/lib/codex-review-rows.mjs, and reuse codex-review-scope's `counted`. 2b: move the gate turn and GATE_NOT_RUN to
  bin/lib/gate-turn.mjs, and failingTests to bin/lib/flaky.mjs. 2c: move currentVersion to lib/version.mjs, which also
  replaces rules-installed.mjs:70; move WAIT_MS and LEASE_MINUTES to a lib module. The commands re-export the moved
  names, so no test file changes. Proof: no test file in the diff, and the suite green; the lines removed equal the
  lines added, imports aside; a behavior differential on check, gate, merge-queue, windows-daily and --version against
  a git-archive copy of the base; one independent Opus verifier, since item 2 (pre-push Codex refusal) and item 4 (gate
  turn) apply. Watch the 1,200-line commit rule under --no-renames. Its gentle-ai, Codex and ready steps are as usual;
  I land it. Open odd/tasks/reorganization.md with the task contract first; it holds slices 2 and 3."
- L2. 2026-10-24, measured on 868f5eca: `check.mjs` 2,806 lines. The Codex rows use nothing declared elsewhere in
  `check.mjs`; outside it they are used for `codexSwitchHere` (the review row) and `counted` (the staged-size row). The
  gate turn uses `gateRow` and `gateLogRows`, which move with it, and `counted`; `stoppedRow` stays, since it names
  `GATE_HELD_ENV`. `version.mjs` is a legacy entry of `conventions-pure.test.mjs`, so its header keeps the word "pure"
  and says the second read; that entry's reason ("its one directory listing") is now one short, and is slice 3's to
  reword, since this slice changes no test file.

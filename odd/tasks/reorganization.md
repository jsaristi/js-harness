# Reorganization: library code out of the commands, then a structure check

Locator: `odd/tasks/reorganization.md` · Engram mirror: `odd/reorganization/tasks` · Branches: `refactor/library-out-of-commands` (slice 2, PR 565), `test/structure-check` (slice 3)
Delivery: slice 2 is three commits (2a, 2b, 2c) in one pull request the lead lands; slice 3 follows in its own.
Test runner: `node --test <one file>`; the commit's gate runs the rest. Plan: `reorg-plan-v2.md` in the lead's shared notes.

## Goal
Library modules stop importing commands for code that is library code: the Codex rows, the gate turn, the failing-test
reader, the package version and the permit relay's times live in `bin/lib`, and the commands re-export them. Then a
structure check holds that shape: frozen paths, no new library import of a command, one reader of the harness home, and
no growth of a module over 1,000 lines.

## Why
Five of the eight places where a `bin/lib` module imports a command go: `windows-daily` (hourly) and `refresh-copy`
stop loading the 2,803-line gate to read one function (257-313 ms against 41-62 ms), `push-waits` stops loading it for
the Codex rows, and `manifest` stops loading `permit`. `check.mjs` shrinks by about a quarter, and slice 3's structure
check can then hold the line at the three imports left. From 2026-10-01 to this plan, `sessions.mjs`, `check.mjs` and
`manifest.mjs` took 9,398 added lines against 1,965 removed; nothing stopped it, and nothing stopped a move of a path
a file outside the repository runs.

## Done when
- `npm run check` exits 0
- `git diff --name-only 868f5eca...bf4b2b9a -- '*.test.mjs'` prints nothing (slice 2)
- the behavior differential of S5 matches before and after, as recorded in the Log
- every commit holds at most 1,200 changed lines under `git show --numstat --no-renames`
- `node --test bin/conventions-structure.test.mjs` exits 0, and each of its rules was seen RED once (slice 3, L7)

## In scope / Out of scope
- In: `bin/check.mjs`, `bin/gate.mjs`, `bin/install.mjs`, `bin/permit.mjs`; the new `bin/lib/codex-review-rows.mjs`,
  `bin/lib/gate-turn.mjs`, `bin/lib/permit-times.mjs`; `bin/lib/flaky.mjs`, `bin/lib/version.mjs`,
  `bin/lib/codex-review-scope.mjs`, `bin/lib/rules-installed.mjs`; the import lines of `bin/lib/push-waits.mjs`,
  `bin/lib/refresh-copy.mjs`, `bin/lib/windows-daily.mjs` and `bin/lib/manifest.mjs`.
- Out: every test file (the re-exports keep their imports); the three library imports of commands left
  (`refresh-copy` of `update`, `spec` of `js-harness`, `windows-daily` of `notify`), which slice 3 lists; any change of
  behavior, text or exit code.
- In (slice 3): the new `bin/conventions-structure.test.mjs` and `bin/lib/source.testkit.mjs`;
  `bin/conventions-errors.test.mjs` and `bin/conventions-pure.test.mjs`; `evals/suite.mjs`'s one read of the home.
- Out (slice 3): splitting a module over the limit (the plan's section 3 cuts it; the ceilings shrink them when touched);
  moving the three library imports of commands left; the inventory rewrite, which is its own docs slice after this lands.

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
- S7 (slice 3, rule 1). The lead: "four frozen paths, each with its reader". The plan: "`bin/js-harness.mjs`,
  `bin/remote.mjs`, `bin/wake.mjs` (their `SELF` path is written into launchers and scheduled tasks),
  `bin/lib/rules-data.mjs`". A frozen path that is gone fails; so does one whose line of code that hands it to its
  reader is gone, which frees it.
- S8 (rule 2). The lead: "no bin/lib module imports a command, with the legacy list left after slice 2 and a reason for
  each entry". The legacy entries are `refresh-copy -> update`, `spec -> js-harness` and `windows-daily -> notify`,
  held by the ratchet.
- S9 (rule 3). The lead: "JS_HARNESS_HOME is read only in lib/home.mjs".
- S10 (rule 4). The lead: "size ceilings for modules over 1,000 lines, measured on today's tree and only allowed to go
  down". The plan: "a new module may not pass 1,000".
- S11 (rule 5). The lead: "recursive conventions scans with a lower bound of at least 100 modules". The scans are
  `conventions-errors.test.mjs:60` and `conventions-pure.test.mjs:48`.
- S12. The lead: "Show each rule RED once in a scratch clone, then GREEN. Then run its gentle-ai, Codex and ready
  steps; I land it. After it lands, run `node scripts/inventory.mjs --write` in its own docs slice, so that the
  inventory check exits 0."

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
- [x] T4 (kind: verify) S5, S6 — the differential inline (L3); one independent Opus verifier (items 2 and 4), no
  blocker (L4).
- [x] T6 (kind: build) inline, S1, S2 — 2d, gentle-ai's advisories: `gate-turn.mjs`'s unused import of `counted` goes,
  and the moved comments name their siblings from `bin/lib`. Commit: 2d.
- [x] T5 (kind: verify) S6 — gentle-ai per commit, Codex over the slice (L5), the pull request and the ready notice.
- [x] T7 (kind: build) inline, S7-S11 — `bin/conventions-structure.test.mjs` with the five rules and their unit tests;
  `bin/lib/source.testkit.mjs` holds the recursive scan and the two parses the three convention tests share;
  `evals/suite.mjs` reads the home with `harnessHome`. Each rule RED once in a scratch clone, then GREEN (L7).
- [x] T8 (kind: verify) S12 — gentle-ai on the commit, Codex over the slice (L8), the pull request and the ready notice.
- [x] T9 (kind: docs) S12 — after slice 3 lands: `node scripts/inventory.mjs --write` in its own slice; the check exits 0 (L9).

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
  gate turn uses `gateRow` and `gateLogRows`, which move with it; `stoppedRow` stays, since it names
  `GATE_HELD_ENV`. `version.mjs` is a legacy entry of `conventions-pure.test.mjs`, so its header keeps the word "pure"
  and says the second read; that entry's reason ("its one directory listing") is now one short, and is slice 3's to
  reword, since this slice changes no test file.
- L3. 2026-10-24, S4 and S5 measured on 868f5eca..78b31383 (2a 08d058ba, 2b 295e0e5f, 2c 78b31383): no test file in the
  diff; 906, 650 and 49 changed lines under `--no-renames`; imports aside, 716 lines removed and 732 added, the
  difference being the three module headers, `export` on seven names, `check.mjs`'s copy of `counted`, the one
  `package.json` path and `rules-installed`'s call; `check.mjs` went from 2,806 to 2,110 lines. Each commit's gate
  passed. The differential ran each copy's `bin/js-harness.mjs` from a `git archive` of each revision against this
  worktree, with a scratch `HOME`, `JS_HARNESS_HOME` and `CODEX_HOME`, times and durations taken out: `--version`,
  `check --help`, `check --push` (exit 1 both: the slice has no Codex record yet), `check --push --head HEAD~3`,
  `check --verbose` under `JS_HARNESS_CHECK_INNER=1`, `gate --help`, `gate log --last 3`, `gate --wait x`,
  `merge-queue --help`, `windows-daily --help`, `windows-daily`, `permit list --json` and `doctor --offline` are the
  same; `gate --no-wait -- node -e "process.exit(3)"` exits 3 in both and differs only in the machine's load before
  the command (5.4 against 1.7 busy processors), which is the sample, not the code. `merge-queue --dry-run` was left out:
  it builds candidate worktrees in the shared repository and runs a door check beside the live queue.
- L4. 2026-10-24, S6: the independent Opus verifier (items 2 and 4) found every spec met and no blocker. It compared the
  Codex rows of both revisions in process on 18 inputs (refusals included, same JSON), the source of `takeGateTurn` and
  `claimOf` (same), every export of the nine touched modules (none lost), and every moved identifier's binding (same
  declaration); it ran `check-codex-reviews` 108, `check` 260, `gate` 80, `merge-queue` 118, `lib/manifest` 190,
  `conventions-pure` 2 and `conventions-errors` 5, all passing; `windows-daily` now loads in about 135 ms against 205,
  `refresh-copy` in about 146 against 205. gentle-ai reviewed 868f5eca..78b31383 with lenses risk, readability and
  reliability, consent granted (pre-granted): approved and acknowledged, lineage review-3c7e286e97ece98e. Its four
  advisories: `gate-turn.mjs` imported `counted` and used it nowhere (L2 had said it did: the map that found it read the
  word inside template strings), and seven moved comments named `./lib/<module>` from inside `bin/lib`; both fixed in 2d.
  R3-002 asked that the differential cover the `--no-wait` and `--push` refusals, which L3's does.
- L5. 2026-10-24, the ledger of slice 2:
  - gentle-ai: 08d058ba, 295e0e5f and 78b31383 reviewed as one slice, approved and acknowledged (L4); 32e6d187 assessed medium, review not due (under_budget).
  - Codex reviewed the slice from the base 868f5eca in 4 parts, each correct (0.94 to 0.98), no findings, about 600,000 input tokens; the record is in the machine's review log.
  - Next step: push the branch, open the pull request, send the ready notice; the lead lands it. Slice 3 (the structure check) comes after it lands, in this document.
- L6. 2026-10-24, the lead (07:53): "Reorg slice 2 landed (PR 565, main bf4b2b9). Go on with slice 3, the structure
  check: bin/conventions-structure.test.mjs, as reorg-plan-v2.md section 2 "Slice 3" describes. It has five rules: 1.
  four frozen paths, each with its reader; 2. no bin/lib module imports a command, with the legacy list left after slice
  2 and a reason for each entry; 3. JS_HARNESS_HOME is read only in lib/home.mjs; 4. size ceilings for modules over
  1,000 lines, measured on today's tree and only allowed to go down; 5. recursive conventions scans with a lower bound
  of at least 100 modules. Show each rule RED once in a scratch clone, then GREEN. Then run its gentle-ai, Codex and
  ready steps; I land it. After it lands, run `node scripts/inventory.mjs --write` in its own docs slice, so that the
  inventory check exits 0."
- L7. 2026-10-24, slice 3 measured on bf4b2b9a and decided:
  - The source is every `.mjs` and `.cjs` module under `bin`, `scripts` and `evals`, at any depth, tests aside, and
    without the code an eval or a test hands to the program it checks (`scripts/fixtures`, `evals/fixtures`,
    `evals/tasks`, `evals/review/seeded`): 223 modules; `bin/lib` alone has 134.
  - Fifteen modules are over 1,000 lines, not the plan's ten: `bin` has eleven today, `evals` three and `scripts` one. Their sizes are the ceilings, with `evals/suite.mjs` at 1,130, one
    line more for its import of `harnessHome`. A ceiling must equal its module's size: a module that shrinks fails until
    its ceiling is lowered, so it cannot grow back unseen.
  - The one read of `JS_HARNESS_HOME` outside `home.mjs` was `evals/suite.mjs` (`env.JS_HARNESS_HOME || realHome`), which
    slice 1 left; it now reads `harnessHome({ env, homedir: () => realHome })`, the same folder for an empty, unset or
    absolute value, and a relative one resolved against the working directory, as the plan's section 6 decided.
  - The frozen readers: `package.json`'s `bin` entry; `remote.mjs`'s and `wake.mjs`'s `SELF`, written into the login
    launcher, the watchdog task and the Startup file; `HARNESS_LIST` in `rules-reach.mjs`, which `rules-installed.mjs`
    fetches from GitHub's default branch. `version.mjs`'s legacy reason in `conventions-pure` now names its two reads.
  - RED once each in a `mktemp -d` copy of the tracked tree, then GREEN: moving `bin/wake.mjs` and renaming
    `HARNESS_LIST` (rule 1); `audit.mjs` importing `js-harness.mjs`, and `windows-daily.mjs` dropping its import of
    `notify.mjs`, which the ratchet reports as complying (rule 2); `bin/doctor.mjs` reading `process.env.JS_HARNESS_HOME`
    and `scripts/inventory.mjs` destructuring it (rule 3); `check.mjs` one line over its ceiling, a new 1,001-line
    module in a subfolder, and `merge-queue.mjs` one line under its ceiling (rule 4); a module in `bin/lib/sub/` calling
    `process.exit`, which the base's flat scan passed and the recursive one fails, and a pure claim there (rule 5). The
    three tests pass on the copy before and after; the copy was removed.
- L8. 2026-10-24, the ledger of slice 3 (commit 957b762a, 311 changed lines; its gate passed):
  - gentle-ai: 957b762a assessed medium, review not due (under_budget); the Stop hook offered it, its read-only status was run and nothing started.
  - Codex reviewed bf4b2b9a..957b762a in 1 part: correct (0.9), no findings, 79,788 input tokens; the record is in the machine's review log.
  - Next step: push the branch, open the pull request, send the ready notice; the lead lands it. Then T9, the inventory rewrite, in its own slice.
- L9. 2026-10-24, the lead (08:20): "PR 566 (reorg slice 3) is on main as b32a4e0. Next, the inventory --write docs
  slice: branch from origin/main and run `node scripts/inventory.mjs --write` so that the inventory check exits 0. Take
  only what it writes, and record the gentle-ai and Codex lines on odd/tasks/reorganization.md. Then open the pull
  request and send the ready notice." On b32a4e07 the check exited 1 with 34 missing rows and 1 stale
  (`bin/lib/ratchet.mjs`, now `ratchet.testkit.mjs`); `--write` added the 34 and dropped the 1, 867 rows, and the check
  then exits 0 with 0 findings. Commit 0fc3cb37 holds only `odd/tasks/launch-audit/inventory.tsv`, 35 changed lines.
  - gentle-ai: 0fc3cb37 assessed medium, review not due (under_budget).
  - Codex: nothing to review, since b32a4e07..0fc3cb37 changes no file a review reads; nothing was started or recorded.
  - Next step: push the branch, open the pull request, send the ready notice; the lead lands it. The reorganization's slices are then all on main.

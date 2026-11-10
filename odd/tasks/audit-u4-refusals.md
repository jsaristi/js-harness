## Goal
Five refusals of the harness hold against the way past each had: a quoted whole-suite glob is refused beside a gate,
`--again` cannot buy a fourth Codex review of a change, a "Done when" command cmd.exe cannot run is caught for a
backtick, a `$VAR` and single quotes, a sensor's throwaway home moves `JS_HARNESS_HOME` too, and the Windows-only
tests of `js-harness remote` run in a gate that blocks.

## Why
Work unit 4 of the audit triage (docs/proposals/2026-11-10-audit-triage.md on `docs/audit-triage`, PR 805), closing
M11, M12, M13, M14 and M27 of the Fable 5.2 audit (docs/audits/2026-11-09-fable-5-2-audit.md on
`claude/fable-5-2-audit-531f8e`). Each is a control that acts less than its text says: a heavy run the lock exists to
stop, a spend his rule bounds at three reviews, a goal read "not met" on a value never computed, a gate's tests that
can write his real harness home, and 99 of 119 tests of a Windows-only command that no blocking gate runs.

## Done when
- `node --test bin/lib/test-run-warning.test.mjs bin/lib/codex-review-recheck.test.mjs bin/lib/contract.test.mjs bin/check.test.mjs` exits 0
- `node --test scripts/github-workflows.test.mjs` exits 0
- `npm run check` exits 0
- The GitHub run of `.github/workflows/gate.yml` for a commit of this branch shows `bin/remote.test.mjs` on
  Windows with its tests run and none skipped.

## In scope / Out of scope
- In: bin/lib/test-run-warning.mjs, bin/codex-review.mjs, bin/lib/codex-review-recheck.mjs, bin/lib/contract.mjs,
  bin/check.mjs, .github/workflows/gate.yml, their tests (bin/codex-review.test.mjs and
  scripts/github-workflows.test.mjs among them), README.md's two paragraphs on the Windows gate, this document.
- Out: the other Windows-only tests (process trees, PowerShell, the launcher), which stay with the daily suite; any
  rule's text; a paid runner or a repository setting on GitHub (his); merging (the lead's, after his yes).

## Constraints
- Tests first, red before each fix — because each is a guard (item 2), a CI path (item 5) or a spend's bound.
- M12 is proven by tests that run a fake Codex — because a real run is a Codex spend.
- Tests use scratch homes only — because his real ~/.claude, ~/.codex and harness home are never written.
- The refusal's own route past three reviews stays: when new code no record covers is in the range, the command it
  names (`--again` from the nearest commit that starts a review) still runs — because the 2026-10-19 decision says a
  skip must not leave new code unread (bin/lib/codex-review-recheck.mjs:276-283).

## Ask me before
- Nothing beyond the brief: a decision that is his goes to the lead with `js-harness notify --kind question`.

## Depth pass
- 1. Method: each is a guard, held first to what it lets through and then to what it wrongly stops. The smallest
  change that meets each: M11, a word that Node's or the shell's glob expands counts as several files whether quoted
  or not; M12, the third-review state is read for the heads the `--again` range holds, not only for its base; M13,
  the cmd.exe gap names each form of substitution cmd.exe lacks, inside the same scanner; M14, the sensor's
  environment drops `JS_HARNESS_HOME` as it drops `HOME`'s value, so `harnessHome` falls back to the throwaway
  `homedir()`, which is what the WSL mirror already gives (`env -i`, bin/lib/gate-wsl.mjs:129); M27, one job in the
  workflow every commit's gate already waits for. Searched first: codegraph for `commandsOf`, `filesOf`,
  `recheckFor`, `secondRecheckSaid`, `cmdShellGap`, `checkSensor`; `grep -rn WINDOWS_ONLY bin`; the two workflows.
- 2. Raw material: `bin/lib/test-run-warning.mjs:42-47` (a quoted word never `globbed`) and `:100`;
  `bin/codex-review.mjs:1370` (`--again` returns the given base) and `:1609`;
  `bin/lib/codex-review-recheck.mjs:149-150` (no record at a base behind the head is a review) and `:15` of
  bin/codex-review.mjs ("No flag skips it"); his spec 8, odd/tasks/double-review-alignment.md:229-231 ("maximo hacer
  3 revisiones"); `bin/lib/contract.mjs:161-178`; `bin/check.mjs:1054`, `bin/lib/home.mjs:18-21`;
  `bin/remote.test.mjs:61`, `.github/workflows/gate.yml:23`, `.github/workflows/windows-daily.yml`,
  `bin/lib/ci-gate.mjs:3-7` (every commit's gate goes to GitHub first), odd/tasks/commit-gates-first.md:219-224 (the
  whole suite on Windows held the lock 15-19 hours a day, so it runs daily, off the land's path).
- 3. The bar:
  spec 1: `node --test bin/lib/test-run-warning.test.mjs`: today `node --test "bin/**/*.test.mjs"` counts 1 file and
  passes beside a held lock; Node expands a quoted glob itself (`node --test "bin/lib/{contract,home}.test.mjs"` ran
  52 tests, 44 + 8, at 6ee974dd).
  spec 2: `node --test bin/lib/codex-review-recheck.test.mjs`: none, new behaviour; today `--again --base <base>`
  behind a change three reviews left open reaches Codex (read at :1370 and :149-150; run with a fake Codex in T2).
  spec 3: `node --test bin/lib/contract.test.mjs`: today a backtick, `$VAR` and single quotes pass `cmdShellGap`.
  spec 4: `node --test bin/check.test.mjs`: today a sensor inherits `JS_HARNESS_HOME`.
  spec 5: `node --test scripts/github-workflows.test.mjs`: today it holds one job, and `.github/workflows/gate.yml:23` runs on `ubuntu-24.04` alone, and
  `bin/remote.test.mjs` skips 99 of its 119 tests there (100 lines name `WINDOWS_ONLY`, one its definition).
- 4. Refutation: could a stricter `cmdShellGap` turn existing contracts red on Windows, where `check` validates them
  all? `node scan.mjs .` (a scratch script over `doneWhen` of every odd/tasks contract): 606 commands, 2 hold a quote
  or a dollar, both inside `node -e "..."` code, which stays exempt; 0 gaps today, 0 expected after. Could a Windows
  job not fit the gate's bound? `js-harness gate -- node --test bin/remote.test.mjs` on this machine: 119 pass, 0
  skipped, 38.3 s, against `rule:ci-gate-bound` and a Linux run of 125-164 s (odd/tasks/commit-gates-first.md, L2).
  Could the M12 refusal break the route its own message names? The test at bin/codex-review.test.mjs:7106 runs that
  route; it must stay green.
  Verdict: supports
- 5. Request: as the Goal. For M27 the Windows job in `gate.yml`, not the local Windows run before the WSL mirror:
  every commit's gate goes to GitHub first (`ciGateWanted`, bin/lib/ci-gate.mjs:52-58), so a local run would cover
  only the fallback gates and checks by hand; the repository already runs an exact Windows image on GitHub at no cost
  (windows-daily.yml, a public repository); and one file of 38 s fits a gate where the whole suite of 1,093-1,398 s
  did not, which is why R1 kept the whole suite off the land's path. The job runs that file alone; the rest of the
  Windows-only tests stay daily. Its cost: a second runner per gate run, free on a public repository, and a gate that
  waits for the slower of two jobs (measured on this branch's gate runs, in the Log).
  Adds: none

## Specs
1. "read a quoted whole-suite glob as the whole suite" (the triage, unit 4, through the brief of 2026-11-10).
2. "refuse `--again` where the third-review rule applies, proven by the recheck tests, which spend nothing" (the same).
3. "let `cmdShellGap` see a backtick, `$VAR` and single quotes" (the same).
4. "override `JS_HARNESS_HOME` in the sensors' throwaway home" (the same).
5. "run the Windows-only remote tests in a gate that blocks (a Windows job in `.github/workflows/gate.yml`, or the
   local Windows run before the WSL mirror)" (the same).

## Tasks
- [ ] T1 (kind: build) spec 1: a word a glob expands counts as several files, quoted or not, test first.
- [ ] T2 (kind: build) spec 2: `--again` refused over a change three reviews left open, unless the range holds new
  code and starts at or after the commit the refusal names; recheck tests and a fake-Codex test first.
- [ ] T3 (kind: build) spec 3: `cmdShellGap` names a backtick, a `$VAR` and single quotes, test first.
- [ ] T4 (kind: build) spec 4: the sensor's environment drops `JS_HARNESS_HOME`, test first.
- [ ] T5 (kind: build) spec 5: a Windows job in gate.yml runs `bin/remote.test.mjs`, the workflow test first.
- [ ] T6 (kind: verify) an independent verifier reads T1-T5.

## Next step
State at 2026-11-10T10:40Z, branch worktree-audit-u4-refusals, worktree D:\js-harness\.claude\worktrees\audit-u4-refusals.
Done and reviewed (Codex + lenses on each slice): T1 eb1ecf8a, T3 ee0fd35a + 8ef687f8 (Codex P2 fixed, recheck
correct), T4 cf6a38ed, T2 ea621c72 + 3b2ea1c1, T5 e6b3760b (gate run 42796545026: windows job 48 s, 119 pass, 0
skipped; check job 3 min 55 s). T6 verifier returned. Fix now, tests first, one commit each, then Codex + lenses on
3b2ea1c1..HEAD wait no: on e6b3760b..HEAD:
- V2: `--again --base U1^` with U1 uncovered behind the chain is refused and names `--base U1`, a dead end. Fix in
  bin/codex-review.mjs: the route is the older of `reviewFromBehind(head)` and `reviewStart`'s start of the range
  (coverage computed once); integration test with a fake Codex (R0, U1, U2; review --base U1; two rechecks; then
  `--again --base R0` runs). codex-review.mjs is at its 2258-line ceiling: free lines first.
- DONE in the commit after 99ada2d7: V5 and V6 (tests red then green, 609 commands still 0 gaps). Still owed of V6:
  docs/RECORDS.md:108 names `$( )` alone; add the backtick, `$VAR` and single quotes there (PR 808 shares the file).
- V5: GLOB in bin/lib/test-run-warning.mjs misses extglob `@( +( !(`; `node --test` of a directory runs no test.
- V6: cmdShellGap: a cmd split (`&`, `|` outside cmd quotes) ends the code; `$?`, `$1`, `$@`, `$#` count; `-e"`
  with no space opens code. Left: doubled `""` and `^"` (rare, refuse more). docs/RECORDS.md:108 says `$( )` only
  (PR 808 touches that file).
- V7 DONE (a guard of a future shape: nothing red to show today). Next is V2, then the review of 99ada2d7..HEAD.
- V7: workflow test refuses `continue-on-error` and `if:` in gate.yml.
- Report to the lead, not fixed (scope): V1, repeated `--again` reviews of a change outside a three-review chain, or
  after one recheck, still run (L3 counts only the three-review state; the owner's bound is per change); V3, without
  `--again` a start behind the chain (an older uncovered commit) reviews it a fourth time (not introduced); V4, an
  `--again` base at an unrechecked reviewed head skips the check. The Goal line overclaims: correct it.
- Then: Log L5-L7, tasks ticked, `npm run check`, push, `gh pr create`, `js-harness notify --to orchestrator --kind
  ready --pr <n>` naming shared files (README.md with 801/804, docs/RECORDS.md with 808 if edited).

## Log
- L1 The brief (2026-11-10T09:10Z): "Yours: exactly what the unit lists and its "Done when". It is high risk: item 2
  (guards, and the sandbox of a sensor, M14), item 5 for M27 (CI, `.github/workflows/gate.yml`), and M12 guards a
  spend. So: the depth pass and a feature document with its contract first, tests first and red before each fix, and
  an independent verifier, as the unit says. M12 is proven by the recheck tests, which spend nothing: no paid review
  run to prove it. For M27, choose between a Windows job in the gate workflow and the local Windows run before the
  WSL mirror by what the repo already does, write why, and do not add a paid runner or change a repository setting
  on GitHub: those are his."
- L2 Checked at the source at 6ee974dd before any change: all five true. M11 as spec 1 says (and a brace glob too,
  which this fixes with it); M12 by the lines in item 2, and the refusal's route at
  bin/lib/codex-review-recheck.mjs:301-305 (`--again` from the nearest commit that starts a review) is a designed way
  past for new code, kept; M13 at contract.mjs:173; M14 at check.mjs:1054 and :1064-1066; M27 by the count in spec 5.
- L3 M12, decided here (the brief hands it to this session): `--again` is refused when its range holds the head of a
  change whose three reviews left findings open, and either every code commit of the range has a record (nothing new
  to read: a fourth review alone) or the run starts behind the commit the refusal names. Only the three-review state
  counts: a range over a change rechecked once is a third review at most, within his bound of three.
- L4 M27, decided here by what the repository does (item 5 above): the Windows job, `windows-2025` as the daily run
  pins it, the same bound as the Linux job, running `node --test bin/remote.test.mjs` with the runner's long TEMP.

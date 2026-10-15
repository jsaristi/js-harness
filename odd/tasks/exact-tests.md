# Exact tests per commit, from what each test really read

Locator: `odd/tasks/exact-tests.md` · Engram mirror: `odd/exact-tests/tasks` · Branch: `feat/exact-tests` ·
Delivery: `ask-on-risk` · Runner: `node --test`

## Goal
A commit's gate runs only the test files whose recorded reads changed since they last passed, and the
whole suite whenever that record cannot be trusted, so the gate is shorter and its wait falls with
nothing less tested.

## Why
On 2026-10-14, 46 gates in 109 minutes ran one at a time, each the whole suite: median 137 s, p90 240 s,
and a median wait of 30 minutes for a turn (`C:\Users\Oficina\.js-harness\research\parallel-gate.md`,
"Measured"). Most commits change a few files that few tests read.

## Done when
- `node --test bin/lib/trace-reads.test.mjs` exits 0
- `node --test bin/lib/select-tests.test.mjs` exits 0
- `npm run check` exits 0
- The gate log of the same commit run twice shows the second run's `tests` row naming how many test
  files ran and how many were skipped by their traces, and the gate time and wait before and after are in
  this document's Log.

## In scope / Out of scope
- In: a tracer preload and its store (`bin/lib/trace-reads*`), the selection (`bin/lib/select-tests*`),
  the `tests` sensor of `check` that uses them, their tests, the docs of `check`.
- Out: step 2 (the store shared by the worktrees), steps 4 and 5, and the merge queue (JH 10's): they
  follow in their own tasks. GitHub's run stays the whole suite.

## Constraints
- A test is skipped only on a trace of a passing run whose every read is unchanged — because a skipped
  test that should have run is a defect nobody sees, and the whole suite is always the safe answer.
- Zero dependencies, no install on the machine — because installing a tracer (`strace`) is a machine
  change, which is his.

## Effort
high

## Ask me before
Nothing planned.

## Specs
- **S1** — His ask, typed (orchestrator's transcript `b878a67f`, after 16:07, quoted in
  `parallel-gate.md` line 3): "quiero es que podamos hacer en paralelo y como hacemos para no perder
  funcionalidades y tampoco calidad para que no se rompa nada, si quieres investiga muy bien en internet y
  dame una mejor solucion." His answer, tapped: "Sí, en ese orden (Recomendada)".
- **S2** — Step 1 of the plan he approved (`parallel-gate.md` line 22, the orchestrator's words): "JH 8 -
  Exact test selection per commit: record each test file's real reads when it last passed (imports,
  fixtures, child processes, missing-file probes, directory listings; strace -f in WSL2, or better if
  found), run only tests whose recorded files changed; full suite when a test has no trace, package.json,
  Node version or the tracer changed, or the test is tagged as reading what cannot be traced (network,
  clock, the real git repo, the home). Measure: gate time and wait before and after. Zero Actions minutes."
- **S3** — The lead, 2026-10-14: "Put the plan in your feature document as its specs (his words quoted
  from the file), test first, and measure gate time and wait before and after. If strace in WSL2 is not
  the right tracer, say what is and why."
- **S4** — The order of the queue (the lead): "finish Codex out of the lock and the orphan-gate guard
  first, then step 1", then steps 2, 4 and 5 (`parallel-gate.md` lines 23, 25, 26).
- **S5** — The lead, 2026-10-14, approving the Node preload: "(1) The key of a trace also holds the Node
  version, the OS and an allowlist of env vars, and a test that reads the clock, the network, the home or
  a non-node child's world is marked untraced and always runs."
- **S6** — The same message: "(2) Soundness is proven, not assumed: before selection decides any commit,
  run it in shadow for a stretch (the gate still runs the whole suite, and records which tests selection
  would have skipped); the proof is a count read from the log: zero failing tests that selection would
  have skipped, over at least 30 gates, plus one test per seam (fs.promises, sync fs, a missing-file
  probe, readdir, a dynamic import, a node child). Only then does it skip." The count, by the lead's answer
  (L12): "count only gates where selection would have skipped something (wouldSkip > 0); a gate that skips
  nothing proves nothing."

## The tracer (S3's question)
`strace` is not installed in the WSL2 Ubuntu (`command -v strace` found none, 2026-10-14), and installing
it is his. The tracer instead is a Node preload carried in `NODE_OPTIONS`, as the review out of the lock
carries its own (`bin/lib/no-test-outside-turn.cjs`):
- each test file runs in a process of its own under `node --test`; the preload there knows its test file
  (`process.argv[1]`) and records, as paths relative to the repository root: every file read or opened,
  every path probed and found missing, every directory listed, every module imported or required
  (`module.registerHooks`), and every program spawned, with its argv;
- every node child inherits the preload and the name of the test file, and adds its reads to the same
  trace; a child that is no node (git, sh) is not seen inside, so its argv's paths in the repository are
  recorded as reads, and a test whose such child runs with its cwd in the repository itself is marked
  untraced, which always runs;
- at exit, a test file that passed (exit code 0) writes its trace: each path with the hash of its
  content then (or "absent", or the hash of a listing), the Node version, the tracer's version and the
  hash of `package.json`.
It runs the same on Windows and in WSL2, installs nothing and adds no dependency. It is what step 2 needs
too: the store is keyed by content, so sharing it among worktrees is moving it to the git common dir.

## Tasks

| ID | Specs | Route | Status | Evidence |
|----|-------|-------|--------|----------|
| T1 | S2 | inline | done, `850cc9f` | `bin/lib/trace-reads.{cjs,mjs}`; RED (module missing), GREEN 5/5 on Windows and WSL2 |
| T2 | S2 | inline | done, `850cc9f` | `bin/lib/select-tests.mjs`; RED (module missing), GREEN 5/5 on Windows and WSL2 |
| T2b | S5 | inline | done, `bb3331f` | the key holds `os` and `env` (`TRACE_ENV`: TZ, LANG, LC_ALL, CI, NODE_ENV, FORCE_COLOR, NO_COLOR); a read of the home outside the temporary folder, or a `net` connection, marks a test untraced; the clock is marked by hand (`// js-harness: untraced (...)`), since `node:test` itself uses timers and any detection would mark every test. RED: the import of `TRACE_ENV`, and the selection's case; GREEN 8/8 and 6/6 |
| T2c | S6 | inline | done, `bb3331f` | one test per seam: sync fs, a missing-file probe, readdir and a node child (the first test), fs.promises `readFile`/`stat`/`opendir` and a dynamic import (the seams test). The seams test passed with no change to the tracer: its RED was only the missing import of the file |
| T3 | S2, S6 | inline | T3a done, `d65a527`; T3b and the switch written, committed in the gate turn of this commit | `check`'s `tests` sensor in shadow: it traces, runs the whole suite, and logs what selection would have skipped and which of those failed. T3a: Windows (`bin/check-shadow.test.mjs`, RED then GREEN 2/2). T3b: WSL2 (`bin/lib/gate-wsl-trace.test.mjs` 3/3, `bin/check-shadow-wsl.test.mjs` 2/2, RED then GREEN) and `harness.json` `"exactTests": "shadow"` with the end line's counts (`bin/check-exact-tests.test.mjs`, RED 0/3, GREEN 3/3); this repo's harness.json says it |
| T3c | S6 | inline | done, `bfb64df`; its range recorded as a refused second recheck (L10) | `assertUntraced` in `bin/lib/trace-reads.test.mjs` accepts the hooks fallback for every reason it asserts (the marker of the clock is set before that fallback, so it holds as it is). No RED: this node has the hooks, and a half simulation would not be the node it stands for; GREEN 13/13. | Codex's recheck of `1532bc2..710a0cb` (96,185 input tokens): 7 of 8 fixed; finding 8 not fixed. On a node of the engines field without `module.registerHooks` (22 before 22.15) the tracer marks every test untraced with that reason first, and later reasons use `??=`, so every assertion of a specific `untraced` reason in `bin/lib/trace-reads.test.mjs` (the home, recursive, shell and git ones, lines 137-140 and 250-251 at `710a0cb`) must accept that fallback there. A test-only change; it gets its own review, since a recheck's range is not rechecked |
| T3d | S6 | inline | done, committed after T3c (`bfb64df`) in the gate turn of its own commit, reviewed by Codex from `bfb64df` | L9: the citations test made deterministic (fixed commit dates; no RED: the flake is one run in 27, three runs green) and the shadow's results a folder with a file per test file (RED then GREEN) |
| T4 | S2, S3, S6 | inline | begun (L11): before measured, shadow overhead not visible; S6's count read (L13): 29 of 31 clean, 9 since the last failure; T4a and T4b done (`e0af24e`, L14), T4c delegated; the switch waits for 30 | gate time and wait before and after; the shadow count over 30 gates or more; only then a switch to skip |

## Log
- **L1** (2026-10-14): S1 to S4, verbatim. The lead's order of the queue puts this after Codex out of the
  lock and the orphan-gate guard.
- **L2** (2026-10-14): the tracer chosen and why, above; told to the lead the same hour.
- **L3** (2026-10-14, counted in this tree): 88 test files; 34 spawn `git`, 7 a shell or PowerShell, 1
  reads the repository through `import.meta.url`.
- **L4** (2026-10-14): the modules are `trace-reads` and `select-tests`, not `test-trace`/`test-select`:
  `node --test` with no file takes `test-*.{js,mjs,cjs}` for a test file by its default patterns. The same
  rule makes main's `bin/lib/test-run-warning.mjs` run as an empty test file at every gate (harmless, a
  process; rename it when that file is next touched). A real run of the tracer over `bin/progress.test.mjs`
  recorded its four reads (`bin/lib/progress.mjs`, `bin/progress.mjs`, itself, `package.json`).
- **L5** (2026-10-14, T3b, read from the code and run here): what changed from the plan above.
  - The runner loads the harness's own tracer through `/mnt` (`wslPath(TRACE_PRELOAD)`), not
    `$mirror/bin/lib/trace-reads.cjs`: the mirror holds the project, which in an installed project is not
    js-harness and has no such file; and the file selection hashes (`tracerHash`) is the harness's. Quoted
    inside `NODE_OPTIONS` when its path has a space. `env -i` leaves no caller `NODE_OPTIONS` to keep.
  - Selection in WSL2 asks with that distribution's node (`wslNodeVersion`, `wsl.exe -d <distro> --exec
    <node>/node -v`: `v24.15.0` in 6.5 s from a cold WSL here, once per gate in shadow), `os: 'linux'` and
    the runner's variables (`RUNNER_ENV`, the same object the runner's `env -i` line is built from). A node
    that says no version, or a path WSL does not mount, runs no shadow.
  - A suite sent to the mirror that fell back to Windows ran untraced: its gate has no shadow (counting it
    would add a gate with zero failures that proved nothing).
  - Keys are paths inside the root, so the mirror's keys are the tree's; `.git` and `node_modules`, which
    the mirror leaves out, read as absent there and present in the tree: those tests always run
    (conservative, never unsound).
  - Places: `traces/windows/` and `traces/wsl-<distro>/` under the worktree's git dir
    (`git rev-parse --absolute-git-dir`).
  - `"exactTests": "shadow"` is honoured when the tests sensor runs `node --test` alone (`npm run test`
    resolves to the `test` script); otherwise the row says why it has no shadow. Any other value fails the
    gate: `"skip"` waits for S6's count (T4). The gate log's end line keeps
    `shadow: { files, wouldSkip (a count), failedOfSkipped (names) }` per sensor; S6 reads
    `failedOfSkipped` empty over at least 30 gates.
- **L6** (2026-10-14 19:28, the first gate in shadow, in WSL2): the shadow ran (`0 of 119 test files would
  have been skipped`) and 18 tests failed under the tracer, so nothing was committed. The tracer was not
  invisible: its variables sat in `process.env`, so a test that copied it for a child carried the outer
  `JS_HARNESS_TRACE_FOR` (an inner `node --test` then took itself for a child of another test), and tests
  comparing a child's exact env saw extra keys; and its wrappers of `exec`/`execFile` lost
  `util.promisify.custom`, so `promisify(execFile)` resolved with stdout alone (`scripts/count-git.test.mjs`).
  Fixed test first (`bin/lib/trace-reads.test.mjs`, two tests, RED then GREEN 11/11): the tracer keeps its
  variables to itself and gives NODE_OPTIONS back as it was (a child's, as its parent gave it, carried in
  `JS_HARNESS_TRACE_NODE_OPTIONS`); every call shape gets the tracer's env, a callback after the args
  included (with the variables hidden, a child that only inherited them would go unseen); `exec` and
  `execFile` keep their promise form. The ten files of the 18 then passed under the tracer on Windows,
  each alone, in one gate turn (19:36). This is S6 doing its work: shadow before any skip.
- **L7** (2026-10-14 19:45): T3 committed `1532bc2`, its gate the first in shadow to pass (WSL2, `0 of 119
  test files would have been skipped`). gentle-ai: medium, not due (under_budget). Codex over
  `c98b12d..1532bc2` (833,202 input tokens, allowance 1,521,600): eight P2, no P0 or P1, all fixed in one
  batch, each test first (RED then GREEN): a home file named by a URL or Buffer, a recursive listing, an
  import or require that did not resolve, and a shell string that chains, pipes or redirects each mark a
  test untraced (`bin/lib/trace-reads.test.mjs`, 13/13); `package.json` is always a read, `absent` where
  there is none, so one that appears runs everything; `testFilesOf` finds `.ts`/`.mts`/`.cts` where node
  strips types (`process.features.typescript`; WSL2's node is taken to strip as Windows' does, the same
  version here; selection-tests 7/7); a file selection would have skipped that left no end of its run
  (killed, timed out, an unreadable results file) counts as one that did not pass
  (`bin/check-shadow.test.mjs`, 3/3), and the row says "did not pass"; the tests that see imports hold
  only where `module.registerHooks` exists (Node 22.15+), and assert the untraced fallback elsewhere (no RED
  here: this node has the hooks). The leftover `eval-relroot-40620-194/` was removed: `evals/runner.test.mjs:1422`
  makes it under the cwd and removes it when it ends, so it was a run cut short at 17:11, most likely the one
  stopped at 17:13.
- **L8** (2026-10-14 19:52): the corrections committed `710a0cb`, gate green in WSL2 in shadow. Codex's
  recheck of `1532bc2..710a0cb`: 7 of 8 fixed, finding 8 not fixed (T3c, above). The branch is pushed and
  its pull request opened with `710a0cb` as its last code commit, which the reviews cover; T3c follows.
- **L9** (2026-10-14 19:56): the gate of T3c's commit was the first whose traces were current (the tracer
  unchanged since `710a0cb`): `shadow: 93 of 119 test files would have been skipped, and 2 of them did not
  pass: bin/check-citations.test.mjs, bin/lib/test-run-warning.test.mjs`. S6 doing its work again; nothing
  was committed. Two causes:
  - `bin/check-citations.test.mjs` failed for real, by the clock: it cites a fresh commit's short hash, and
    a citation must hold a digit and a letter (`bin/lib/citations.mjs:11`), which an all-digit hash (about
    one run in 27) is not. It read the clock through git, where no trace can see it; it failed at 19:28 too.
    Fixed by fixing the commit dates of its repositories (three runs green), and recorded in
    `docs/FAILURES.md` as `citations-test-reads-clock` (a test of `main`, exposed here).
  - `bin/lib/test-run-warning.test.mjs` passed (its tests are green in the log) yet had no end in the shared
    results file. Inferred, not measured: appends of test-file processes at once through WSL's `/mnt` lost
    its line. Now each test file writes its result in a file of its own, in a results folder
    (`bin/lib/trace-reads.test.mjs`, RED then GREEN 13/13; `bin/check-shadow*.test.mjs` 3/3 and 2/2).
  - For T4 (a proposal, not yet a spec): a gate whose `wouldSkip` is 0 skips nothing and so proves nothing
    of soundness; S6's 30 gates should be counted among gates that would have skipped some file. Every
    change of the tracer changes `tracerHash`, so the count restarts after it, as it must.
- **L10** (2026-10-14 20:07): T3c and T3d were first committed together (`2b84848`, never pushed), and
  Codex refused the range: from the head of a recheck that left a finding open, a range is a second
  recheck, recorded as a skip, so T3d's new code would have gone unreviewed. Split: T3c alone is
  `bfb64df`, its range `fbff1a2..bfb64df` recorded as `--unavailable "second recheck refused: T3c ..."`;
  T3d is the next commit, reviewed by Codex from `bfb64df`. The lesson, which `bin/lib/codex-review-recheck.mjs`
  already says: commit a recheck's correction alone, and new work after it.
- **L11** (2026-10-14 20:12, T4 begun): the measure before is the one in "Why" (46 gates on 2026-10-14:
  median 137 s, p90 240 s, median wait 30 minutes). The checks of the five gates in shadow this evening
  took 101, 108, 154, 142 and 126 s (`js-harness gate log --last 12`, the "in its parent's turn" lines):
  inside that spread, so the shadow costs no time that five samples can see. The measure after waits for
  selection to skip, which waits for S6's count; how that count is read (only gates whose `wouldSkip` is
  above 0, L9) is asked of the lead, not yet answered. PR 163 holds T1 to T3d, pushed at `c80a76e`.
- **L12** (2026-10-14 20:52, the lead's answer, verbatim): "S6, yes: count only gates where selection
  would have skipped something (wouldSkip > 0); a gate that skips nothing proves nothing." So S6's 30 gates
  are counted among the gate log's end lines whose `shadow.wouldSkip` is above 0, each with
  `failedOfSkipped` empty. PR 163 merged at 19:58 with `fbff1a2`; the three commits after it went in as
  PR 164 (merged 20:19). Next, from the same plan: step 4 (CI `node --test` with `--test-concurrency=2`),
  then step 2 (a result memory shared by the worktrees, keyed per S5).
- **L13** (2026-10-15 02:58, T4 resumed by the lead's order: "the top priority now"): S6's count, read from
  the gate log (`~/.js-harness/gate-log/log.1.jsonl` and `log.jsonl`, every end line whose tests row has a
  shadow; 00:28Z to 07:53Z, all after the result memory shared the traces): 47 gates with a shadow, 31 with
  `wouldSkip` above 0 (a median of 75 percent of the files), 29 of them clean and 2 with a skipped file
  that failed. 00:56Z: `bin/check-citations.test.mjs`, a real clock dependency through git's commit dates
  (fixed by fixed dates, PR 164), and `bin/lib/test-run-warning.test.mjs`, a results line lost by the counter
  itself (fixed by a results file per test). 06:58Z: `evals/suite.test.mjs`, the machine flake
  `eval-interrupt-process-alive` of `docs/FAILURES.md`, in a change that touched no eval. Since the last of
  them, 9 counting gates, all clean. Read literally, S6 is not met (2 of 31 failed); its seam tests exist
  (`bin/lib/trace-reads.test.mjs`). Asked of the lead: count from the last failing gate (21 to go) with the
  skip never applied to a test the flaky ledger (JH 10, step 5) tags, per the result memory's S1 ("tagged
  nondeterministic tests never cached"), or leave known flakes out of the count. Next: the lead's answer.
- **L14** (2026-10-15 03:39, the lead's answer, verbatim): "your reading, adopted. It keeps S6 literal and is
  stricter: 30 consecutive counting gates with no failing skipped test, counted from the last failure (9
  now), and the skip never applies to a test the flaky ledger tags (result-memory S1's rule carried over).
  No known flake is left out of the count. Meanwhile, build T4's switch so it is ready to flip, test first:
  the skip path, the ledger exclusion read from JH 10's ledger [...], and a check row that says the running
  count. The flip itself happens only when the count reaches 30, with the gate-log numbers in the PR body."
  The ledger's format is JH 10's (branch `feat/flaky-ledger`): `docs/FLAKY.md`, one `### <test file>`
  heading per entry; T4 reads the headings alone, expired or not. Done, RED then GREEN each, in `e0af24e`:
  T4b, `selectTests` takes `flaky` and `flakyTestsOf(root)` reads the headings, the shadow passes them, so a
  named file is never a would-skip (`bin/lib/select-tests.test.mjs` 11/11, `bin/check-shadow.test.mjs` 4/4);
  T4a, `s6Count(events)` and the `exact tests` row (`checkExactCount`, informs only;
  `bin/check-exact-tests.test.mjs` 6/6). That commit's own gate: "S6: 16 of 30 gates in a row would have
  skipped a test file and saw none of those fail, since the gate of 2026-10-15 01:58 where
  evals/suite.test.mjs failed". Next: T4c, the skip path behind `"exactTests": "skip"`, harness.json left at
  `"shadow"`, given to a bounded writer (route: delegated, the long-session backstop) with the decisions of
  its brief: a `skip` field on the row and the end line and never `shadow`, the whole suite for `full`, for
  a path outside `[A-Za-z0-9._/-]` or a command over 7000 characters and for a WSL fallback; an empty run
  passes; a passing skip gate still writes the tree key. The flip is a later pull request at 30.
- **L15** (2026-10-15 03:58): T4c written by the writer, RED then GREEN per decision (its report): one
  helper `testsCommandLine` builds the command with the concurrency and the files; `skipPlan` runs the whole
  suite for `full`, a path outside `[A-Za-z0-9._/-]`, a command over 7000 characters, no test file, or a WSL2
  selection that could not be asked; an empty run passes with nothing spawned (in WSL2 it says `ranIn: 'wsl'`,
  so the tree key, whose traces are WSL2's, is still written); a WSL2 fallback runs the whole suite untraced;
  the row and the end line carry `skip: { files, skipped }` and never `shadow`; in skip mode the `exact tests`
  row says the count stopped. Added after its report: a path that starts with a dash runs the whole suite
  (node would read it as an option), RED then GREEN. Files alone: `check-exact-tests` 10/10, `check-shadow`
  10/10, `check-shadow-wsl` 4/4, `check-test-concurrency` 4/4, `gate-wsl-trace` 3/3, `select-tests` 11/11,
  `check.test.mjs` 205/205 (the writer's run). harness.json stays `"shadow"`.
- **L16** (2026-10-15 04:18): Codex `859b0bd..74e2734` (585,739 input tokens, inside 638,400): part 1
  correct, part 2 incorrect, one P2: an npm suite with a pretest or posttest script ran nothing when no file
  was left, so those scripts, which no trace proves, never ran. Corrected alone: that case runs the whole
  suite (`bin/check-shadow.test.mjs`, RED then GREEN 11/11). gentle-ai raised to high (item 5); its bound
  STATUS timed out twice under load. Next: Codex recheck from `74e2734`, one more STATUS, the PR.
- **L17** (2026-10-15, after batch 2): PR 187 conflicted with main in `bin/check.mjs`, against the flaky
  ledger (PR 197): the select-tests import, and the end of a gate, where the ledger's `quarantined` and
  `failing` lines sit next to this branch's `skip` field of `record?.end`. Moving the change away was not
  clean (the record line is adjacent to the ledger's `failing` line, so any edit there conflicts), and
  `codex-review` reviews a merge's resolution alone, so main `eec4ee3` was merged once, on the lead's word,
  in `891187d`: a quarantined pass writes no tree key in skip mode either, and the gate log keeps rerun
  failures and skip counts side by side. Gate green; its `exact tests` row: 50 of 30 since 01:58. Codex
  `56fa14e..891187d` (the resolution, 21 lines, 112,002 input tokens, inside 300,000): correct, 0.95.
  gentle-ai: medium, not due (under budget).
- **L18** (2026-10-15 08:30): PR 187 merged (08:19). The lead, 07:44: "Flip: GO, per S6 ... the count is met
  (50 of 30, zero failing tests selection would have skipped). Open it as its own PR with its gate, gentle-ai
  and Codex, quote the count's read in its body and the doc's Log". And 07:45: "The flip must keep the queue's
  CircleCI candidate run whole (test it), or it waits for A's answer. Say which in the PR." It keeps it whole:
  CircleCI (`.circleci/config.yml`, `node bin/check.mjs` on a fresh checkout of a `queue/` branch) and GitHub
  Actions both set `CI`, and in skip mode a gate where `CI` is set and not `false` or `0` (`onCi`) runs the
  whole suite, traced as in shadow, and the row says so. Test first in `bin/check-shadow.test.mjs`: the first
  form of the two tests failed (RED, 2 of 13), then 14/14; `CI` is one of the variables a trace keys on (S5),
  so the wiring test writes its traces under the value it asks with. The four skip-mode test files delete
  `CI` at their top, since the suite itself runs on CI. Files alone: `check-shadow` 14/14,
  `check-exact-tests` 10/10, `check-test-concurrency` 4/4, `check-shadow-wsl` 4/4. Then the flip,
  `harness.json` `"exactTests": "skip"`, in its own commit.

## Resume here (2026-10-14 17:3x, JH 8)
- Newest (19:25): T3b and the switch are written and green file by file (L5), committed in the gate turn
  of their commit; that commit's own gate is the first to run in shadow in WSL2. Next: push
  `feat/exact-tests` and open its pull request, Codex reviewing the slice from `c98b12d` within the
  allowance, the gentle-ai line in the body; then T4's count from the gate log. The bullets below about
  T3b's plan are history: L5 says what changed.
- Done and committed on `feat/exact-tests`: T1 and T2 (`850cc9f`), T2b and T2c (`bb3331f`); every test
  file of them green on Windows and in WSL2 (run alone, one file each). Not pushed, no pull request, no
  Codex review yet: the slice is reviewed with T3, from `c98b12d`.
- An untracked `eval-relroot-40620-194/` sits at this worktree's root: a test of the suite left it during a
  gate (not this branch's files). Find which test writes `eval-relroot-*` in the repository root and make
  it write under the temporary folder; until then leave the folder out of every `git add`.
- WSL2 runs of one file go through a script that refuses an empty name (2026-10-14: an empty variable in
  `wsl.exe -- sh -c` ran the whole suite outside a turn): `sh <scratchpad>/wsl-one-test.sh <worktree on
  /mnt> <file>`, with `MSYS_NO_PATHCONV=1`, node at `/home/oficina/.local/node/bin/node`.
- T3b, the plan (19:2x): `runnerScript` (`bin/lib/gate-wsl.mjs:99`) gets `trace: { dir, results }` as WSL
  paths and adds, beside `JS_HARNESS_CHECK_INNER=1` on its line 118, `JS_HARNESS_TRACE_ROOT="$mirror"`,
  `JS_HARNESS_TRACE_DIR`, `JS_HARNESS_TRACE_RESULTS` and `NODE_OPTIONS` with
  `--require="$mirror/bin/lib/trace-reads.cjs"` (the same file, synced). The traces of WSL2 go in
  `traces/wsl-<distro>/`, apart from Windows'. Their `node` is WSL2's, so selection there asks that node
  its version once per gate (`wsl.exe -d <distro> -- <node> -v`, about a second), never the Windows
  process (every test would run for a mismatch), and never the newest trace (after an upgrade every trace
  holds the old version and would pass for current: not sound). `wslRoute` passes them; `startShadow` drops its Windows-only guard.
- T3a done, `d65a527`: `checkSensor(..., { traces: { dir } })` runs the tests
  sensor in shadow on Windows (`startShadow`/`endShadow` in `bin/check.mjs`): the whole suite under the
  tracer, the selection asked first, and the row's `shadow` and detail say what it would have skipped and
  which of those failed. `bin/check-shadow.test.mjs`, RED then GREEN 2/2. Next, T3b: the same in WSL2
  (the trace variables inside `runnerScript`), then `checkSensors` passing `traces` when `harness.json`
  says `"exactTests": "shadow"`, the gate log's end line keeping the counts, and this repo's harness.json.
- T3 started (17:45), not committed: the tracer's results file is written and green
  (`traceEnv({ results })`, `JS_HARNESS_TRACE_RESULTS`; RED: the file never appeared; GREEN 9/9 on
  Windows; not yet run in WSL2). Next: `checkSensor` in shadow, test first, then commit T3 in a gate turn.
- T3, read from the code (17:40): the tests sensor runs in `checkSensor` (`bin/check.mjs:691`), whose env
  replaces `HOME`/`USERPROFILE` with a throwaway home under the temporary folder, so in a gate the
  tracer's home rule never fires (a test there cannot read the real home anyway). In WSL2 the command
  goes through `wslRoute` and `runnerScript` (`bin/lib/gate-wsl.mjs`) in the mirror: the trace variables
  are set inside that script, `JS_HARNESS_TRACE_ROOT` the mirror and `JS_HARNESS_TRACE_DIR` the
  worktree's `<git dir>/js-harness/traces/<place>/` through `/mnt`. Shadow needs which test files failed:
  a `JS_HARNESS_TRACE_RESULTS` file each test-file process appends `{ test, code }` to at exit; would-skip
  (asked before the run, under the node version of the place) intersected with a code other than 0 is
  the count S6 reads, in the row's detail and the gate log's end line.
- Next is T3: where the selection plugs in. `check`'s sensors are a project's own commands
  (`discoverSensors`, `bin/check.mjs:159`: `npm run test`). The design: opt-in by `harness.json`
  `"exactTests": "shadow"`, honoured only when the `test` script is exactly `node --test` (S6: shadow
  first). In shadow the `tests` sensor runs the whole suite under `traceEnv`, asks the selection before
  it, and its row and the gate log's end line say which files selection would have skipped and which of
  those failed (from the failing names, `failingTests`). `"exactTests": "skip"` is the switch that later
  runs `node --test <selected files>`, and it is honoured only when the count of S6 holds (T4).
- Before T3: T2b (S5's key: the OS and an env allowlist next to the Node version; reads under the home
  outside the temporary folder, `Date`/timers left aside as a marked case, and `net`/`http` connections
  mark a test untraced) and T2c (S6's seams, one test each).
- The traces live under the worktree's git dir, `js-harness/traces/<place>/`, where `<place>` is
  `windows` or `wsl-<distro>`: a trace from WSL2 proves nothing for Windows, as the tree key says. In WSL2
  the sensor runs in the mirror, so `JS_HARNESS_TRACE_ROOT` is the mirror's path and
  `JS_HARNESS_TRACE_DIR` is the Windows folder through `/mnt/<drive>/`. Selection compares against the
  node version of where the tests run (WSL2's node, not Windows'): read it once per gate.
- Then T4: gate time and wait from `js-harness gate log` before (today's measure, `parallel-gate.md`)
  and after.

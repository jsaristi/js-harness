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
  probe, readdir, a dynamic import, a node child). Only then does it skip."

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
| T4 | S2, S3, S6 | inline | pending | gate time and wait before and after; the shadow count over 30 gates or more; only then a switch to skip |

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

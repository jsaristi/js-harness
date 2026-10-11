# The gate: the load it starts under, a log of every gate, and fewer git processes

Locator: `odd/tasks/gate-log.md` · Engram mirror: `odd/gate-log/tasks` · Branch:
`feat/gate-log`, in the linked worktree `D:\js-harness-worktrees\gate-log`, cut from
`origin/main` at `7ef20b9` · Session: `JH 6 · gate más corto y con registro`, orchestrator
`JH ORQ · js-harness`

State 2026-10-11: opened by the orchestrator's prompt, inside the order Sebastián asked for
(`docs/ROADMAP.md`, "The order he asked for", item 2; `odd/tasks/gate-lock.md`, "Next"). He is
away: what is his is written under "Ask me before" and sent as a notice, and the rest goes on.
The design below was written by this session and read, before anything was built on it, by a
reader that did not write it; Progress says what the reader changed.

## Goal
A gate says how loaded the machine is when it starts, every gate leaves a record of when it
ran and under what, and a `codex-review` run and the two long test files start fewer git
processes, so a slow gate is explained by a file and the usual gate has less work to do.

## Why
- A gate's time depends on things no session sees. On 2026-10-11 one gate timed out at 1,200 s
  and another took 1,069 s, against 832 s for the same tree, beside a video in a browser and a
  language server spinning at about 1.5 logical processors. The process look counts neither,
  and the script that did find them (`load.ps1`) lived in one session's scratchpad
  (`docs/ROADMAP.md:773-780`; `odd/tasks/gate-lock.md:1278-1291`).
- "Which gates ran beside which" is today a session's memory. Three failures of 2026-10-10
  name a gate log as the proof they lacked (`odd/tasks/gate-lock.md:1122-1131`). A gate's time
  is also only known to the session that ran it: the list `885, 728, 872, …` in
  `odd/tasks/gate-lock.md:1294` was kept by hand.
- The gate is as long as its work: some fifty thousand git processes that slow each other down
  on four cores, and arranging the files differently gave nothing (`docs/ROADMAP.md:760-768`).
  What shortens it is fewer of them. Measured on 2026-10-10 in `bin/codex-review.test.mjs`
  alone: 12,591 git processes, 10,008 of them started by the command under test in 546 runs,
  and 6,509 of those a `git rev-parse` (`odd/tasks/gate-lock.md:917-921`). So the larger part
  is what one `codex-review` run asks git, which every real review pays too.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/gate-log.md` exits 0
- `node --test bin/lib/machine-load.test.mjs` exits 0
- `node --test bin/lib/gate-log.test.mjs` exits 0
- `node --test bin/check.test.mjs bin/gate.test.mjs` exits 0
- `node --test bin/lib/manifest.test.mjs` exits 0
- `node --test scripts/count-git.test.mjs` exits 0
- A real gate on this machine prints a `load` row, quoted in Progress
- After his answer on where the log lives: a real gate's two lines in the log, and
  `gate log` reading them, quoted in Progress
- The git processes started by `bin/codex-review.test.mjs` and by
  `bin/check-codex-reviews.test.mjs`, counted by `scripts/count-git.mjs` before and after, are
  recorded in Progress with the profile each cut was chosen from
- `docs/ROADMAP.md` says what a gate now says and records, where the log lives and how it is
  removed, and what the cuts gave; its sentence "A gate that ends leaves nothing on disk"
  (`docs/ROADMAP.md:750`) is reworded

## In scope / Out of scope
- In: `bin/check.mjs`, `bin/gate.mjs`, the help text of `bin/js-harness.mjs`, new
  `bin/lib/machine-load.mjs` and `bin/lib/gate-log.mjs`, a new measuring tool
  `scripts/count-git.mjs`, the two long test files `bin/codex-review.test.mjs` and
  `bin/check-codex-reviews.test.mjs`, the product modules the profile points at
  (`bin/codex-review.mjs`, `bin/lib/codex-reviews.mjs`, `bin/lib/codex-review-runs.mjs`,
  `bin/lib/codex-review-coverage.mjs`, `bin/lib/project.mjs`), the removal of the log by
  `uninstall` (`bin/lib/manifest.mjs`, `bin/install.mjs`: the orchestrator is told before the
  first line there), `scripts/practice-lib.mjs` if its hash of the home must leave the log
  out, their tests, `docs/ROADMAP.md`, this document.
- Out: `bin/sessions.mjs` and `bin/lib/sessions.mjs`, the board, which belongs to
  `JH 5 · canal entre sesiones`: showing the last gates on the board is a later step of theirs
  or of a later slice. `bin/lib/gate-lock.mjs`: the lock is not changed; what the log needs
  from it comes through the callbacks it already has. The gate on GitHub: his to start.
  Waiting for a quiet machine before a gate starts, or refusing under load: a gate says the
  load and runs (the need of a run that wants the machine quiet stays open,
  `odd/tasks/gate-lock.md:1281-1282`). The 1,200 s bound: it stays. `evals/`. `AGENTS.md`: at
  its budget.

## Constraints
- Zero dependencies and every operating system, because `check` ships to any project. The
  load figure therefore comes from Node alone (`os.cpus()`), and anything that needs a system
  command is best effort and silent where the command is missing.
- A gate must not prove less, wait more than a few seconds longer, or fail because of what is
  added here: the `load` row is INFO, and a log that cannot be written is said in a row and
  never fails the gate.
- What a gate leaves in `<home>/.js-harness/gate` stays nothing: fourteen assertions hold that
  folder absent after a gate (`bin/check.test.mjs:1279, 1335, 2065`; `bin/gate.test.mjs:168,
  194, 342, 422, 501, 573, 617`) and `uninstall`'s "in use" rule reads it
  (`bin/lib/manifest.mjs:818-833`). So the log is not in that folder.
- Whatever is written outside the repository is removed exactly by `uninstall`, and a test
  proves it (`AGENTS.md`, "recorded so it can be undone exactly").
- The suite starts gates of its own, some inside the test process and about fourteen as real
  processes (`bin/check.test.mjs:1799, 2434`; `bin/gate.test.mjs:487-604`). None of them
  sleeps for a real sample, starts a system command for it, or writes the real log, except
  the one test that proves the real path.
- Measuring: a count of git processes is the proof of a cut. A whole gate is recorded with
  its `load` row for the record, and is not the proof: the gates of one tree differ by some
  75 s either way on this machine (`odd/tasks/gate-lock.md:1133-1136`).
- Machine shared: the gate takes the lock by itself; a whole test run by hand, and either
  long test file, goes through `node bin/js-harness.mjs gate -- <command>`; a short test file
  alone stays free. Nothing is written in this worktree while its own gate runs: a writer
  works in a worktree of its own then.
- A commit runs in the background; after a failed gate `git config --local core.bare` is read
  in `D:\js-harness` before anything else. A commit that will be reviewed stays under about
  1,200 changed lines, with nothing untracked when the review is assessed.

## Effort
high

## Ask me before
- Where the lasting file of the gate log lives. It is the first thing the gate leaves on disk
  after it ends, outside the repository, so it is his. Recommendation: a folder of its own,
  `<home>/.js-harness/gate-log/`, beside the lock's folder and not in it, holding two files at
  most. Reasons: the lock is the machine's, so its record is too (gates of two projects wait
  for each other and must appear in one file); `home` is resolved as the lock resolves it, so
  a test's throwaway home gets a throwaway log; a folder is removed whole by `uninstall`, the
  way it removes the lock's (`removeGateFolder`), so nothing a rotation leaves behind needs a
  name. The alternatives: inside `gate/` (breaks "a gate leaves nothing" and the "in use"
  rule); in the repository's git folder, where the Codex review records are (nothing outside
  the repository, but one log per project, so a gate that waited for another project's gate
  names a gate the file does not hold).
  Until he answers, S2 is built on the recommendation with tests that use a throwaway home;
  its pull request is not merged, and no gate of this session writes his real home, without
  his answer. S1 and S3 do not depend on it.
- Anything that changes what a commit proves, the 1,200 s bound, or the gate on GitHub.
- Spend outside the plan (the Codex cap for this feature is 3 million input tokens).

## TDD
Mode: strict. Runner: `node --test`, one file at a time while a task is open. Exceptions: T6's
profile and the counts before and after are measurements, recorded here.

## Design

### S1 · The load a gate starts under
- What is measured: how many of the machine's logical processors were busy during one second,
  read from `os.cpus()` twice (`1 - idle delta / total delta`, over all processors). It needs
  no process and no PowerShell and reads the same on every system; `os.loadavg()` is all
  zeros on Windows. Known limits, said in the module: above 64 logical processors Windows
  shows Node one processor group, and inside a container the figures are the host's.
- When: in the one place every gate passes, the `run` closure of `checkSensors`
  (`bin/check.mjs:585-589`), before the first sensor, and only when the call is a gate, that
  is, when it came through one of the three lock states: its own lock (`:540`), the turn of a
  parent that holds it (`:593`), no lock because none could be taken (`:534`). The eleven
  direct calls of `checkSensors` that are no gate take no sample. It costs one second of a run
  of about 800.
- A gate that waited reads the tail of the gate it waited for: that gate releases the lock and
  then still runs its review and Codex rows (`bin/check.mjs:544, 953, 959`), and the waiter
  has the lock within two seconds. So when a gate waited a second or more the row says so
  (`…, right after another gate`), and the figure is not read as the machine's own.
- Where: a new `bin/lib/machine-load.mjs` with a pure `loadBetween(before, after)` and an
  async `sampleLoad({ms, cpus, sleep})`; `check` reaches it through a seam, `deps.sampleLoad`,
  which `runCheck` and `runGate` of the tests default to an instant one. The gates that tests
  start as real processes cannot be reached by a seam, so there is also a switch in the
  environment, `JS_HARNESS_GATE_LOAD=off`: no sample, no row. Their helpers set it; one test
  runs the real path on purpose.
- What is said: one INFO row of its own name, when sensors ran as a gate:
  `INFO  load  2.2 of 8 logical processors busy before the sensors (27%, 1 s sample)`. A new
  row name, because rows named `gate` are asserted exactly in many tests; a `load` row breaks
  one list of row names (`bin/check.test.mjs:1373`). When `os.cpus()` gives nothing or the two
  readings do not differ the row says `load  not read` and why.
- `gate -- <command>` prints nothing of its own today, by design (`bin/gate.mjs:7-10`), and
  its tests hold its stderr to exact lines. It samples the same way and says the load on
  stderr only when the machine is loaded (next point); the figure of every gate goes to the
  log (S2).
- Loaded means one logical processor or more busy (`LOAD_SAID_PROCESSORS = 1`), in processors
  and not in a percentage: 15% is 0.6 of four processors and 4.8 of thirty-two. The language
  server of 2026-10-11 was 1.5.
- On a loaded machine the row also names what loads it (T2), so that no session needs a
  script of its own to find the video or the language server: three processes at most, each
  with its CPU seconds in the sample, its name, the base name of its first argument that is
  not an option (a language server is `node tsserver.js`, not `node`), and its pid. Never the
  whole command line: it can hold a secret, and the row is printed and later logged. They are
  found by reading every process's CPU time twice, two seconds apart: on Windows one
  PowerShell process (`Get-Process`, then `Get-CimInstance Win32_Process` for the three
  found), on Linux `/proc/<pid>/stat` and `/proc/<pid>/cmdline` read from Node with no
  process started; on any other system the row keeps the figure alone. Asynchronous, so the
  lock's beat goes on, and bounded at ten seconds; a missing command, an error or a late
  answer leaves the figure alone. It runs only on a loaded machine, where five seconds are
  cheap against the minutes the load costs. A process the system will not show without
  elevation is simply not named.
- Not said: under `JS_HARNESS_CHECK_INNER`, for a commit of documents alone, for
  `check --push`: no sensor runs, so there is no gate.

### S2 · The gate log
- What: JSON lines, two per gate, so a gate that was killed is still there as a start without
  an end.
  - start, written when the sensors are about to run, after the sample: `{v, event: "start",
    id, at, cwd, command, pid, lock, waitedSeconds, waitedFor: [{cwd, pid, command}], load:
    {busy, processors, sampleMs, busiest}}`. `lock` is `own`, `parent` or `none`: the three
    states of S1, which `run(true)` does not tell apart today.
  - end: `{v, event: "end", id, at, seconds, result, sensors: [{name, seconds, pass,
    timedOut}]}`. `result` is the sensors' alone, `pass`, `fail` or `timeout` (the other rows
    of the report are not the gate); for `gate -- <command>` it is the exit code.
    `checkSensor` returns neither seconds nor `timedOut` today (`bin/check.mjs:443`) and
    gains both.
  - refused, one line and no end: a gate that did not run because the lock was held and it
    was told not to wait, or because its wait ran out (`bin/check.mjs:535`,
    `bin/gate.mjs:166`): `{v, event: "refused", id, at, cwd, command, pid, reason,
    waitedSeconds, waitedFor}`. An hour's wait that ended in nothing is part of what ran
    beside what.
  `command` is cut at 120 characters: a `gate --` line can hold a secret. `waitedFor` and the
  waited time come from `takeGateTurn` (`bin/check.mjs:485-506`), which collects the holders
  the lock hands to `onWait`, one per `holder.token` since the callback repeats
  (`bin/lib/gate-lock.mjs:480-484`); the lock itself is not changed.
- The end line is written in a `finally` on every path that wrote a start
  (`bin/check.mjs:534, 539-545, 593`; `bin/gate.mjs:159, 162, 172, 176`), so a thrown error
  or a timeout still ends its gate; only a killed process leaves a start alone.
- Which gates: every `check` that runs sensors as a gate and every `gate -- <command>`, the
  ones that ran without the lock included: a gate beside another is what the log is for. Not
  under `JS_HARNESS_CHECK_INNER`, `check` or `gate`.
- Where: `gateLogDir(home)`, one function, whose answer is his (see "Ask me before"). The
  writer makes the folder itself: a gate without the lock has made nothing under the home.
- Bounded by rotation, never by rewriting: when `log.jsonl` is past 512 KiB (about 700 gates)
  the gate about to append renames it to `log.1.jsonl`, over the older one, and appends to a
  new file. A rename loses no line of a gate that appends at the same moment, which a rewrite
  would; a rename the system refuses is tried again by the next gate. So the folder holds two
  files at most, about a megabyte, and the last 700 gates at least.
- Never in the way: a log that cannot be written is one INFO row `gate log` saying why, and
  the gate's result is unchanged.
- Read: `js-harness gate log [--last <n>]` prints the last gates from both files, one line
  each: when, seconds, result, load, whom it waited for, folder; a start without an end and a
  refusal are shown as such.
- Removed: `uninstall` removes the folder whole, in both of its paths
  (`bin/lib/manifest.mjs:734-740, 791-799`), and a test proves the home is as before. When a
  gate is alive `uninstall` already keeps `gate/` and says so; the log is kept with it and
  said in the same line, since that gate would write its end line into a folder just removed.
  `scripts/practice-lib.mjs:273-275` leaves the log out of the hash of the home, as it does
  `doctor.json`, if the journey's gates would write it.
- It holds folder paths and process names of this machine and never leaves it.

### S3 · Fewer git processes
- Count first (T6). `scripts/count-git.mjs <test file…>` runs the files under a preload
  (`NODE_OPTIONS=--import`) that wraps the functions of `node:child_process` in every Node
  process of the run and calls `module.syncBuiltinESMExports()`, without which a file that
  imports `spawnSync` by name keeps the original. Each process appends its counts to a
  temporary file; the tool prints the git processes in total, by git sub-command, and by the
  first frame of the caller that is in this repository. What it does not see, said in its
  output: the processes git starts itself (`git maintenance` after a commit, hooks). Tracing
  by git (`GIT_TRACE2_EVENT`) is no alternative here: both files delete every `GIT_*`
  variable (`bin/check-codex-reviews.test.mjs:16-18`). It is a tool in the repository, with a
  test, because the preload that gave T6 of the last slice its numbers was kept outside it
  and is gone (`odd/tasks/gate-lock.md:911-912`). The long files are run through `gate --`.
- Then cut by the profile, largest first, each cut its own task with the count before and
  after. Where the earlier numbers point, for the profile to confirm or correct:
  - The command under test, 80% of the processes of `bin/codex-review.test.mjs` and two
    thirds of those a `git rev-parse`. One `codex-review` run resolves the git folder four
    times through `jsonLinesPath` alone (`bin/lib/codex-reviews.mjs:30`; call path
    `bin/codex-review.mjs:1084, 1062, 1420, 1123`). The run resolves it once, lazily, in a
    closure of its own, and hands it on in the options object those functions already take
    (`commonGitDir`; `reviewCoverage` at `bin/lib/codex-review-coverage.mjs:217` and
    `leftByRecords` pass it through). No signature changes, a null answer is never kept, and
    there is no cache hidden in a module: `check` reaches the same functions
    (`bin/check.mjs:720`), and a memo of the process would outlive a repository in a test.
    Whatever else the profile shows a run asking git twice goes the same way.
  - `bin/check-codex-reviews.test.mjs` builds every repository from nothing: `makeRepo` is
    nine git processes at 55 call sites, about 500 processes. Built once per file run and
    copied (`copyOf`, `bin/codex-review.test.mjs:76-102`), if the profile says the file's
    time is there; the last slice's same premise for the other file was wrong by a factor of
    three (`odd/tasks/gate-lock.md:929-930`).
  - The tests' own questions to git in `bin/codex-review.test.mjs` were 31.5 s of 640
    (`odd/tasks/gate-lock.md:919`). Not planned: every test has a copy of its own, so an
    answer kept per repository is never asked twice, and one kept per commit id needs git to
    know the commit.
- The stop rule: a cut is made when the profile shows it removes a thousand processes or
  more from the two files together. If nothing does, S3 closes with the tool and the profile
  recorded, and says so. The arithmetic before the count: the three items above are about
  2,500 of the suite's fifty thousand, under what one whole gate can show, so the profile has
  to find the larger part, or the honest result is "a few per cent".
- The tests do not change what they prove: only helpers and how often git is asked.
- Judged by the counts. One whole gate before and one after are recorded with their `load`
  rows, for the record.

### Delivery
Three slices in the order `odd/tasks/gate-lock.md` gave ("the gate log, and with it the load
… ; fewer git processes"), each its own pull request to `main`, each reviewed by gentle-ai
and then by Codex: S1 (T1, T2) on `feat/gate-log`; S2 (T3 to T5) on a branch stacked on S1,
its merge waiting for his answer; S3 (T6 to T8) on a branch cut from `main`, since it shares
no file with the other two.

Discarded: reading the load with PowerShell on every gate (seconds and Windows only, for a
number Node gives free); a `gate` row or a `gate:` line for the load on every gate (exact
assertions on both); a threshold in per cent; naming the busiest processes on every gate
(five seconds on a quiet machine, to say nothing); whole command lines of the busiest (a
secret printed and logged); one log line per gate written at the end (a killed gate would
vanish from the record of what ran beside what); trimming the log by rewriting it (an append
in between is lost, and the gate that loses it is the one without the lock); a process-wide
cache of the git folder (see S3); a test that fails when the count of git processes rises (it
would run a long file twice in every gate).

## Tasks
Each closes with its commit and this file saying what is next. Routes are recorded per task in
Progress.

- [x] T1 · `bin/lib/machine-load.mjs` and the `load` row. Tests first: `loadBetween` on
  made-up processor times, an empty list and two equal readings; `check` with an injected
  sampler prints the row once, before the first sensor, in each of the three lock states; no
  row for a direct `checkSensors` call that is no gate, under `JS_HARNESS_CHECK_INNER`, for
  documents alone, with `JS_HARNESS_GATE_LOAD=off`; "right after another gate" when it
  waited; `gate --` silent below the threshold; the real-process helpers set the switch; one
  test runs a real sample.
- [x] T2 · What loads a loaded machine. Tests first: the PowerShell and `/proc` parsers on
  recorded output; the difference of two samples; the first argument that is not an option;
  a missing command, an error and a timeout each leave the figure alone; nothing is started
  below the threshold or with the switch off.
- [x] T3 · `bin/lib/gate-log.mjs`: append, rotate, read both files, the folder made by the
  writer. Tests first.
- [ ] T4 · `check` and `gate` write start, end and refused; `takeGateTurn` returns whom it
  waited for; `checkSensor` returns seconds and `timedOut`; `gate log` reads; help text.
  Tests first, all under a throwaway home.
- [ ] T5 · `uninstall` removes the log's folder in both paths and keeps it with a gate in use
  (orchestrator told before `bin/lib/manifest.mjs` is touched); the practice run's hash;
  `docs/ROADMAP.md`.
- [x] T6 · `scripts/count-git.mjs` with its test, then the profile of the two files, recorded
  here, and the cuts chosen from it by the stop rule. (The tool's second commit, `--frames`
  and the review's findings, is still to make.)
- [x] T7 · The first cut, chosen from the profile: where the repository is, asked once per
  `codex-review` run and handed on. The git folder (`jsonLinesPath`) and the top of the
  repository (`topOf`) in the options objects, and whatever else the run asks git twice
  through `gitOutput` (`bin/codex-review.mjs:279`). Then the count of
  `bin/codex-review.test.mjs` again.
- [x] T8 · The second: in the tests, the git folder handed to the record helpers once per
  repository, and the repositories of `bin/check-codex-reviews.test.mjs` built once and
  copied; then the counts after, one whole gate, and `docs/ROADMAP.md`.

## Progress
- 2026-10-11 · Opened. Worktree and branch made, CodeGraph index of the worktree made. A
  read-only map of the code was taken first (one explorer); what it gave the plan: a lasting
  file inside `gate/` would break fourteen assertions, so the log is beside it; whom a gate
  waited for is known only inside `onWait`; nothing in the repository reads the machine's
  load or counts git processes.
- 2026-10-11 · The design, read by a reader that did not write it (one sub-agent, read-only,
  given the document and the code and none of this session's conclusions). It found three
  things that would have failed as written and eleven to change; all are in the design above.
  - Would have failed: a seam alone does not reach the fourteen gates the tests start as real
    processes, each of which would have slept a second and, under the suite's own load,
    started PowerShell (now a switch in the environment); a `gate:` line on every `gate --`
    breaks the exact assertions on its stderr and its stated design (now only when loaded);
    trimming the log by rewriting loses the lines appended meanwhile, by the very gates
    without the lock the log exists for (now rotation, in a folder of its own).
  - Changed: the sample point is three paths and not one (`bin/check.mjs:534, 540, 593`); a
    gate that waited samples the tail of the gate before it; the threshold in processors;
    the busiest processes named by script and not by whole command line, with `/proc` on
    Linux; the record gains a refused line, three lock states, a cut `command`, and an end in
    a `finally`; `uninstall` removes named things and does not own the folder, so the log
    goes in both of its paths and stays with a gate in use; the order is the one
    `odd/tasks/gate-lock.md` gave, the log before the cuts; the git folder is handed on in
    the options objects, with no signature changed; the preload needs
    `syncBuiltinESMExports()`.
  - Corrected numbers of mine: "232 `git diff` call sites" was the file's test count (27
    sites), "270 record reads" are 153, and "278 runs" are call sites of 546 measured runs.
    The reader's arithmetic, kept in S3 as the stop rule: the three cuts first planned are
    about 2,500 of fifty thousand processes, under what a whole gate can show.

- 2026-10-11 · T1, one writer (route: delegated; three product files and their tests). Test
  first: before any code the new module's test could not load it, 4 of 29 tests of
  `bin/gate.test.mjs` failed and 8 of 128 of `bin/check.test.mjs` (six new, and the two
  assertions on the order of rows that a new row changes). After it: 7, 29, 128 and the 23 of
  `bin/js-harness.test.mjs` pass; this session ran the first two again and read the same.
  - The sample point is one line in the `run` closure of `checkSensors`
    (`bin/check.mjs:604`), taken only when the call came with a lock state; the switch of
    the environment travels in that object (`load: false`), since `checkSensors` does not
    see the environment.
  - Choices the design left open, made by the writer and kept: a `gate` started in the turn
    of a holder samples too, so `gate -- npm run check` reads the load twice, two seconds;
    a `gate` whose load could not be read says nothing (`check` says it in its row); the
    threshold compares the figure as read, so 0.96 is not said though it would print as 1.0;
    two more reasons for "not read" (the number of processors changed between the readings,
    times that went back).
  - Known and left: `scripts/practice-lib.mjs` starts real gates in its journey, which now
    take the real sample, a second each; no test file does (searched every `*.test.mjs` for
    `pre-commit`, `js-harness check` and `check.mjs`).
  - While the writer's tests ran, real samples on this machine read `8.0 of 8 logical
    processors busy (100%)`: the figure sees a test run as it sees a video.

- 2026-10-11 · T1 is commit `84e93a5`. Its gate, the first to say the load: it waited 4 min
  28 s for the gate of `session-channel`, then
  `INFO  load  2.8 of 8 logical processors busy before the sensors (35%, 1 s sample), right
  after another gate`, and passed in about 1,110 s (06:08:14 to 06:26:44), ninety seconds
  under the bound. Most likely this session's own doing: the writer of T6 ran its tests in
  the second worktree during that gate, one of them 852 git processes. Rule kept from here
  on: a writer looks for the gate lock before each test run and waits for it to go.
- 2026-10-11 · gentle-ai reviewed `84e93a5` against `7ef20b9` (medium risk, review due by
  the slice budget; consent pre-granted, the `granted` invocation run): one lens,
  reliability, approved and acknowledged (lineage `review-580fd5ce286a7f5f`), nothing
  blocking. Two findings, both taken into T2: the one test that takes a real sample asserts
  a figure, so it would go red on a host where the load is not read or the lock took a
  second; `readLoad` says it never throws and does for a sampler that resolves to something
  that is no sample.
- 2026-10-11 · Codex, planned and not yet run. `codex-review --base 7ef20b9 --plan` puts T1
  alone at about 730,000 input tokens (2 parts, 583 changed lines; "to 4,000,000" at the
  most a line has cost). The cap of this feature is 3 million, and three slices at that
  rate are about 3.5 million. So Codex reviews a slice once, after its last commit, and not
  each commit: S1 after T2. If the cap is reached before S3, that is his (spend), said then;
  the slices are reviewed in the order they are built.
- 2026-10-11 · T6, first half, one writer (route: delegated; three new files) in a worktree
  of its own, `D:\js-harness-worktrees\gate-git-processes`, branch `feat/gate-git-processes`
  cut from `origin/main`, because the gate of T1 was running here. Test first: the test file
  could not load the preload before it existed; 7 of 7 pass after, read again by this
  session. `scripts/count-git.mjs` and its preload do what S3 says, and more that the first
  run asked for: a child `node` started with an environment of its own is handed the
  counting too, a call Node builds on another is counted once, `util.promisify(execFile)`
  goes through the count, and the report says how many Node processes were started and
  never reported (a killed one never reaches its exit). On Node 24 the `node --test` runner
  itself loads no preload from `NODE_OPTIONS`; its per-file children do. First reading,
  `bin/lib/project.test.mjs`: 852 git processes in 165 s summed, 659 of them a `rev-parse`,
  530 from the test's own line 79.
- 2026-10-11 · `origin/main` moved to `c1b3594` (pull request 58, the session roster),
  checked with `git fetch`. It touches `bin/js-harness.mjs`, which S2 edits for the help
  text: `main` is merged in before S2 is pushed. Nothing of S1 or S3 is in its paths.

- 2026-10-11 · The counting tool is commit `a0bf058` on `feat/gate-git-processes`; its gate
  passed in 991 s (06:30:36 to 06:47:07; that branch has no `load` row yet). gentle-ai
  reviewed it against `7ef20b9` (medium, due by the slice budget): one lens, reliability,
  approved and acknowledged (lineage `review-1e377f38447d1621`), five suggestions, none
  blocking. Taken, with a need of this session's own, by the same writer before the profile
  is run: a call that started no process is counted as one; an anonymous async frame is not
  read; the usage error has no test through the process; and `--frames <n>`, because the
  first frame of this repository in a stack is a helper (`bin/lib/project.mjs:229`) and does
  not say who asked. Left: worker threads, and the temporary file of a tool that is killed.
- 2026-10-11 · A slip of this session, in four parts. What happened: the review above was
  started while another session's gate held the lock; the command looked for the lock,
  printed that one was held, and went on, against the rule kept from the last slice ("no
  review step beside a running gate") and the one this document states for writers. Nothing
  failed that is known: the review passed, and whose gate it was and how long it took was
  not read. The fix now: reviews of this session start through one command that waits while
  the lock's folder exists and only then starts. What stops it recurring: the same wait is
  in that command and not before it, since a look chained before a start is no guard. Where
  it enters the harness: S2's log is what would have shown it (a review is no gate, so the
  lock does not serve it; whether `codex-review` and the review step should take the gate's
  turn is a question for the plan, not built here). Proof it has not come back: every later
  review in this document names the command it was started by.

- 2026-10-11 · T2, one writer (route: delegated), who looked for the gate lock before each
  test run. Test first: the new module's test could not load it, the load test lacked
  `loadLines`, and 2 of 3 new gate tests and 2 of 4 new check tests failed before the code
  (the others are the guards that hold when nothing changes). After it: 11, 17, 32 and 131
  pass.
  - `bin/lib/machine-busiest.mjs` is the look; `readLoad(sample, look)` asks it only for a
    loaded machine and adds `busiest` to the sample; `check` prints the lines under its
    `load` row and `gate` after its line on stderr. A real `gate` beside two spinners, 5.4 s
    in all:
    `gate: 6.6 of 8 logical processors busy before the command (82%, 1 s sample)`,
    `gate:   2.1 s of CPU in 2 s  node spins for the gate.mjs (pid 43512)`, the second
    spinner, and `gate:   2.0 s of CPU in 2 s  MsMpEng (pid 5736)`, the virus scanner.
  - Changed from the design, by measurement: the readings on Windows come from
    `Win32_Process` and not from `Get-Process`. At eight of eight processors busy, which is
    when a gate looks, `Get-Process` took 18.1 s for the look, past its own bound, and
    `Win32_Process` 4.4 s; it also shows the time of processes `Get-Process` shows only to an
    administrator. The difference and the three are worked out in Node, the same code as for
    Linux; PowerShell is told the three pids on its standard input and prints only their
    command lines. It is started by its whole path: a bare name would be looked for in the
    project's folder first.
  - Changed from the design, for what the line says: `2.1 s of CPU in 2 s  node tsserver.js
    (pid 12044)`, since a bare `1.6 s` read as part of the one-second sample.
  - Tighter than the design: the first argument that is not an option can be an option's
    value (`-p <password>`), so it is said only when it reads as a file name, 64 characters
    at most with an extension, and nothing after it is tried. The price: `node ./bin/www`
    reads `node`.
  - Limits, said in the module: a process that started during the look is not counted, so a
    load of many short processes (a test run) names few; the look's own cost can appear as
    `WmiPrvSE`; the Linux path ran against recorded `/proc` text only, on no Linux host.
  - The two findings of the review of T1 are in: `readLoad` turns a sampler's answer that is
    no sample into "not read", and the test of the real sample accepts what any host may
    print while it still proves one row and a real second.

- 2026-10-11 · The tool, second pass, by the same writer (not yet committed): `--frames <n>`
  keys a git process by its first `n` frames in this repository; a call that started no
  process (a missing command, a result without a pid) is no longer counted, one that started
  and failed still is; a frame resumed by `await` is read; the usage error is tested through
  the process. Test first: 4 of 9 failed before, 9 pass after.
- 2026-10-11 · The profile, both runs under the gate lock (`gate -- node
  scripts/count-git.mjs …`), on `origin/main` at `7ef20b9`.
  - The two long files alone (07:04:43 to 07:13:47, 327 tests pass): 11,735 git processes,
    777 s summed; `bin/codex-review.test.mjs` 8,589 and `bin/check-codex-reviews.test.mjs`
    3,146. By sub-command: `rev-parse` 5,491, `diff` 1,642, `check-attr` 883, `rev-list`
    578, `merge-base` 534, `log` 446, `status` 424, `commit` 318, `add` 274.
  - The whole suite, 64 test files (07:14:42 to 07:30:52, 970 s): **15,467 git processes**,
    2,363 s summed, and 1,597 other processes, in 941 Node processes that all reported.
    `rev-parse` is 7,182 of them. By file: the two long ones are 11,735, 76%; then
    `bin/lib/project.test.mjs` 852, `evals/review/compare.test.mjs` 599,
    `bin/lib/codex-review-coverage.test.mjs` 545, `bin/remote.test.mjs` 451; 24 files start
    git at all.
  - So "some fifty thousand git processes" (`docs/ROADMAP.md:767`, repeated in this
    document's Why and stop rule) was three times too many, and the reader's arithmetic
    built on it ("2,500 of fifty thousand") with it. The two files this slice names are
    three quarters of the suite's git, and the cuts below are about a fifth of all of it.
  - Five tests failed under the whole-suite count and pass without it
    (`evals/codex-configs.test.mjs:323, 346` and three like them): they assert the exact
    environment of a child, and the tool adds its own variables to an environment a caller
    writes out. An effect of the instrument, to be said in its report.
  - Where the processes of the two files come from, by the first frames of this repository
    (the product called by the tests through the spawn they hand it,
    `bin/codex-review.test.mjs:233`):
    - where the git folder is, `jsonLinesPath` to `gitDirs` (`bin/lib/project.mjs:229` from
      `bin/lib/codex-reviews.mjs:31`): 1,238 inside runs and 1,147 from the readers and
      writers of records called directly, 2,385 `rev-parse` in the whole suite;
    - where the top is, `topOf` (`bin/lib/codex-review-scope.mjs:75`), once before every
      `check-attr`: 796 `rev-parse`;
    - the run's own questions through `gitOutput` (`bin/codex-review.mjs:279`): `rev-parse`
      1,438, `diff` 1,169, `merge-base` 473, `status` 423;
    - the tests' own fixtures in `bin/check-codex-reviews.test.mjs`: `add`, `commit` and
      `rev-parse` 232 each from the `commit` helper (`:45-47`), a `commit` being the dearest
      process of all, 0.34 s each in that run.
  - Chosen by the stop rule (a thousand processes or more): T7, where the repository is,
    asked once per run, about 700 of the 1,238 and the 796, and what `gitOutput` asks twice;
    T8, the same folder handed on by the tests' helpers (most of the 1,147) and the
    repositories of the second file built once. Together about 2,800 of 15,467. The tests'
    own `git diff` stays out, as planned: 303 calls.

- 2026-10-11 · T2 is commit `9c49587`; its gate passed in 1,075 s (07:33:28 to 07:51:23) and
  is the first to name what loads the machine, which was the very case of the morning:
  `INFO  load  1.4 of 8 logical processors busy before the sensors (18%, 1 s sample)`,
  `1.1 s of CPU in 2 s  node tsserver.js (pid 41012)`, `1.0 s of CPU in 2 s  MsMpEng (pid
  5736)`, `0.7 s of CPU in 2 s  claude (pid 16424)`. The language server is another
  session's: its parent chain ends in `claude.exe` 27012, and this session's is 9672 (read
  with `Get-CimInstance Win32_Process`). Not this session's to stop; said to the
  orchestrator. Three gates of today, all on a machine with other sessions at work: 1,110,
  991 and 1,075 s, against 832 s on the quiet machine of the last slice.
- 2026-10-11 · `origin/main` moved again, to `8654c79` (pull request 59, the channel's
  folder): it changes `bin/lib/manifest.mjs` and `bin/install.mjs`, where `uninstall` now
  removes the channel's folder under `<home>/.js-harness`, whole. S2 is cut after `main` is
  merged in, and its removal of the log's folder follows that one's shape.

- 2026-10-11 · gentle-ai reviewed `9c49587` against `84e93a5`, started under the gate lock
  (`gate -- node rv-run.cjs …`, 07:53 to 08:02 with the wait): one lens, reliability,
  approved and acknowledged (lineage `review-3d908c2c0a715191`), nothing blocking, two
  findings, both fixed inline in the commit after it (three files, test first, the new test
  red before the code): the one real look of the suite asserted that somebody is named, and
  a look names nobody by design when its helper misses its bound, which a machine as busy
  as the suite keeps it can cause, so a best-effort feature could turn a gate red; and
  `readLoad` kept whatever entries a look answered, so one without a numeric time would
  throw in the line that prints it. The `gate` that ran the review said its own load:
  `4.4 of 8 logical processors busy before the command (55%, 1 s sample), right after
  another gate`, then `BackgroundDownload`, and two `claude`.
- 2026-10-11 · T7, one writer (route: delegated; ten files) in the third worktree. Test
  first: four new tests of a run failed on the number of questions (`4 !== 1`, `[5,2]`
  against `[1,0]`), and the new options in the libraries failed before they existed. No
  existing assertion was changed. A run keeps one object in its own closure, `where`, and
  hands it on in the options objects: `top` (the root the run already has, so
  `--show-cdup` is never asked), `commonGitDir` (a lazy getter over `gitDirs`; a null or a
  throw is not kept) and `marks`, what git said the project marks at a commit, which the
  profile had not named: the coverage of the records and the files of the range asked
  `check-attr` about the same paths at the same commit. A caller that passes nothing asks
  as before; `bin/check.mjs` is untouched. The count again, both files under the lock, 331
  tests pass: **11,735 to 9,986** git processes; `bin/codex-review.test.mjs` 8,589 to
  6,840, the other file unchanged at 3,146; `rev-parse` 5,491 to 3,927; `check-attr` 883 to
  632. Nothing to cut in what the run asks through `gitOutput`: no question is repeated but
  `HEAD` under `--base HEAD`. Left, each a decision of its own: the two ends of the range,
  and the top with the git folder, could each be one `rev-parse` (about a thousand more),
  but they are separate questions with their own error messages that the tests' stand-ins
  key on; `check` hands on no `where` (171 `topOf` and its record reads). The change is the
  patch `t7.patch` in the scratchpad, to be applied in the second worktree.

- 2026-10-11 · The fix after T2's review is commit `d1c11f9` (gate 959 s after a wait of 15
  min 22 s; gentle-ai: not due, under the budget, 55 lines, pending in the slice). The tool's
  second commit is `4e1b244` on `feat/gate-git-processes` (gate 1,012 s; not due, under the
  budget). T7 is commit `7201bac` there (gate 1,021 s after a wait of 30 min 34 s; review due
  by the slice budget, against `a0bf058`). The third worktree and its branch are removed: its
  diff was compared with the committed patch first, byte for byte.
- 2026-10-11 · Codex reviewed S1, `287a585..d1c11f9`, under the gate lock (`gate -- node
  bin/js-harness.mjs codex-review --base 7ef20b9`, 09:08 to 09:14): 5 parts, 1,619 changed
  lines, **942,981 input tokens** (693,632 cached) against 1,660,000 planned, recorded in
  `D:\js-harness\.git\js-harness\codex-reviews.jsonl`. Four parts with nothing to act on.
  One finding, P1, and it is right: `scriptOf(['tool', '-p', 'P@ssword.123'], 'tool')`
  returns the password, which a gate would print: a credential with a dot in it cannot be
  told from a file name by its spelling. Decided: a script is named only when its argument
  is an absolute path of a file that exists on this machine; a relative one is never named,
  so `node server.js` reads `node`. With the writer of T2, test first; then its commit, and
  Codex on that commit alone.
- 2026-10-11 · S2 is being written (T3 and T4, one writer, route: delegated) in a fourth
  worktree, `D:\js-harness-worktrees\gate-log-file`, branch `feat/gate-log-file`, cut from
  `9814b2b` with `origin/main` (`8654c79`) merged in (`49d2dd7`). Added to the design for
  it: a switch, `JS_HARNESS_GATE_LOG=off`, with which a gate writes no log, so that no gate
  of this session writes his home before he says where the log lives; every commit of this
  session in that worktree is made with it.
- 2026-10-11 · The Codex cap: 942,981 of 3,000,000 used by S1. S3 is planned at 3 parts and
  S2 at about as much as S1; if what a plan prints would pass the cap, that slice's Codex
  review waits for his word and the skip is not recorded as "unavailable", which it is not.

- 2026-10-11 · The fix of the P1 is commit `e1463c0` on `feat/gate-log` (gate from 09:37 to
  09:57, 1,188 s; load row: 3.6 of 8 logical processors busy; gentle-ai: not due, under the
  budget, 225 lines, pending in the slice with `d1c11f9`). A path of a share is not asked of
  the disk and so never named: the question is a call that does not return until it is
  answered. That gate's time is no clean reading: the writer of T8 ran a count of
  `bin/codex-review.test.mjs` outside the lock for about four minutes beside it (its own
  report), and a language server of this session was spinning (below).
- 2026-10-11 · A slip of this session, in four parts. What happened: the load row of a gate
  named a `node tsserver.js` (pid 7996) as busy, and this session told the orchestrator it
  was not its own without walking the process's parents. The orchestrator said it was, and
  the chain proved it: 7996, 39780, 34212, 9672, the `claude.exe` of this session. The fix
  now: stopped with `taskkill /PID 39780 /T /F`, and the correction sent. What stops it
  recurring: `stop-own-ls.ps1` in the scratchpad stops the TypeScript language servers that
  hang from this session's own `claude.exe`, and no others, before each gate of this
  session; it has stopped a second one since (pid 39836, before the gate of T4), so the
  host starts one again after an edit. Where it enters the harness: a gate that names the
  busiest processes is S1 itself and it worked, since that row is how the server was seen;
  saying whose session a busy process hangs from is a candidate for the next slice of the
  gate (the look already has the parent ids), not built here. The proof that it has not
  come back: the load rows of this session's later gates name no `tsserver`.
- 2026-10-11 · T3 is commit `22bc1cb` on `feat/gate-log-file` (the log's module,
  `bin/lib/gate-log.mjs`, 15 tests; gate from 09:38 to 10:15 with a wait of 19 min 13 s;
  load row: 6.8 of 8 busy, right after another gate; gentle-ai: due by the slice budget,
  to run on T3 and T4 together against `49d2dd7`).
- 2026-10-11 · The first gate of T4's commit failed, and the cause was this session's, in
  four parts. What happened: the commit ran with `JS_HARNESS_GATE_LOG=off`, as every commit
  in that worktree does, and four tests that start real gates in a home of their own handed
  that switch on, so those gates wrote no log for the tests to read
  (`bin/check.test.mjs:1811` and `:3023`, `bin/gate.test.mjs:971` and `:1070`). The writer
  had run them without the switch, where they pass. The fix now: the three places that
  build the environment of such gates drop the switch (`outsideAGate` in
  `bin/gate.test.mjs`, and two in `bin/check.test.mjs`). What stops it recurring: those
  tests no longer depend on the environment of the gate that runs them. Where it enters the
  harness: it is in the tests of this slice. The proof: the four, run with the switch off
  in the environment, pass 4 of 4; and the commit's second gate (result below when it
  ends).
- 2026-10-11 · The lock gives no turns in order of arrival. T4's second commit asked for
  the lock at 10:42 and at 11:19 was still waiting, while T8's commit, which asked at 10:47,
  ran from 11:01 to 11:17, and a gate of another session and a Codex run went before it
  too. A gate's wait is bounded (an hour for a commit), so a gate can run out of patience
  behind gates that came after it. Not fixed here: the lock is not this feature's. It is
  what the gate log's `waitedFor` will show, and a candidate for the lock's next slice.
- 2026-10-11 · T8 is commit `ededffe` on `feat/gate-git-processes` (one writer, route:
  delegated; gate from 11:01 to 11:17, about 943 s, after a wait of 13 min 58 s; no load
  row, since S1 is not in that branch; gentle-ai: not due, under the budget, 236 lines,
  pending in the slice against `7201bac`). The two files: 9,986 git processes to 8,213
  (`bin/codex-review.test.mjs` 6,840 to 6,067, `bin/check-codex-reviews.test.mjs` 3,146 to
  2,146; `rev-parse` 3,927 to 2,952, `commit` 319 to 197, `init` 118 to 31), 331 tests
  passing, no assertion changed; the count is `t8-count-after.json`. From 11,735 that is
  30% fewer. One change of the product, the finding of T7's review: what git said of a
  commit's paths is kept for a run only when the commit is named by a full id
  (`FULL_COMMIT_ID`, `bin/lib/codex-review-scope.mjs`). Left on purpose: sharing that memory
  inside `check` (about 77 processes, against the assertion that the debt row asks
  `check-attr` twice), and folding each test's `git checkout -b` into the copied repository
  (82 processes, about 45 test bodies). gentle-ai approved `a0bf058..7201bac` (T7) before.
  The roadmap is commit `cd574c9` there: the count replaces "some fifty thousand", and what
  the two cuts gave.
- 2026-10-11 · Codex on the fix of the P1, `23d2ba0..e1463c0`, under the lock (11:17 to
  11:18): 1 part, 179,933 input tokens. One finding, P2, and it is right: the question
  "is this a file" is `fs.statSync`, which also does not return for a mapped network drive,
  a link into a share or a network mount whose server is away, and those are whole paths
  like any other; meanwhile the lock's beat cannot run, and after a minute another gate
  takes the lock over. Leaving out the paths of shares did not close it. Decided: no
  synchronous call on a path taken from another process's command line; the question is
  asked without blocking and bounded at about a second, an unanswered one counts as no
  file, and only the three processes printed are asked about. With a writer, test first.
- 2026-10-11 · The Codex cap: **1,122,914** of 3,000,000 input tokens used, all by S1
  (942,981 and 179,933). To come: the P2's commit (about 200,000 by the last one), S3 (4
  parts, 1,063 changed lines by the gate's row of `ededffe`) and S2 (7 parts, 2,153 lines
  by the gate's row of T4, before T5). S1 and S3 fit; S2 does not fit after them, and its
  pull request waits for his answer on the log's place anyway, so S2's Codex review waits
  for his word on the cap. The orchestrator was told.

## Resume here (state at 2026-10-11 11:25, for a session that lost its conversation)
- Three worktrees under `D:\js-harness-worktrees`: `gate-log` (`feat/gate-log`, S1 and this
  document), `gate-log-file` (`feat/gate-log-file`, S2), `gate-git-processes`
  (`feat/gate-git-processes`, S3). Nothing is pushed; no pull request is open. This
  document is current only in `gate-log`; the other two branches hold older copies.
- S1, `feat/gate-log`: `287a585` document, `84e93a5` T1, `9c49587` T2, `9814b2b` document,
  `d1c11f9` fix, `23d2ba0` document, `e1463c0` fix of the P1. gentle-ai approved T1 and T2;
  `d1c11f9` and `e1463c0` are pending in the slice, under the budget. Codex has a record
  for every code commit up to `e1463c0`. In flight: the fix of the P2, with a writer,
  uncommitted in `gate-log` (`bin/lib/machine-busiest.mjs` and its test). Then: the parent's
  spot check, the commit (the gate), gentle-ai on the pending range
  (`rv-run.cjs D:/js-harness-worktrees/gate-log 9c49587 <tag>`), `codex-review --base
  7ef20b9` (it starts where the records end), the roadmap (`docs/ROADMAP.md`, the sentence
  "a gate that says the load on the machine when it starts is for the next slice": it is
  built), `git push -u origin feat/gate-log`, the pull request to `main`, and the notice
  "closed S1" to the orchestrator.
- S3, `feat/gate-git-processes`: `a0bf058` and `4e1b244` the tool, `7201bac` T7, `ededffe`
  T8, `cd574c9` roadmap. gentle-ai approved up to `7201bac`. Then: gentle-ai on T8
  (`rv-run.cjs D:/js-harness-worktrees/gate-git-processes 7201bac <tag>`), Codex on the
  slice (`codex-review --base origin/main --plan` first, to read what it would cost), push
  and pull request. Its pull request and S1's both touch `docs/ROADMAP.md`, in hunks a
  line apart: whoever merges second merges `main` in.
- S2, `feat/gate-log-file`: `22bc1cb` T3. T4 (the wiring, six files) is staged and its
  second commit is waiting for the lock or running (`commit-t4b.log`); if its wait ran out,
  commit again: `JS_HARNESS_GATE_LOG=off git commit -F <scratchpad>/msg-t4.txt`. Then
  gentle-ai on T3 and T4 (`rv-run.cjs D:/js-harness-worktrees/gate-log-file 49d2dd7
  <tag>`), T5 with one writer (`uninstall` removes the log's folder: a function of its own
  beside `removeChannelFolder` in `bin/lib/manifest.mjs` and its one call in each path of
  `uninstall`, kept with a gate in use; the practice run's hash; the roadmap, with the
  sentence "A gate that ends leaves nothing on disk" reworded). The orchestrator was told
  before that file is touched and answered to go ahead: "JH 5" has uncommitted changes in
  the same file, around the hook entries, so the change stays apart from them. Then the
  merge of `feat/gate-log` into it, and its pull request, which is not merged without his
  answer on where the log lives, and whose Codex review waits for his word on the cap.
- Every commit of this session in `gate-log-file` is made with `JS_HARNESS_GATE_LOG=off`,
  and `C:\Users\Oficina\.js-harness\gate-log` must not exist until he answers; look after
  each gate.
- Before each gate of this session: `powershell -NoProfile -ExecutionPolicy Bypass -File
  <scratchpad>/stop-own-ls.ps1`.
- Heavy commands of this session take the gate's turn: a commit by its hook; a review as
  `node bin/js-harness.mjs gate --wait 180 -- node <scratchpad>/rv-run.cjs <repo> <base>
  <tag>`; Codex as `node bin/js-harness.mjs gate --wait 180 -- node bin/js-harness.mjs
  codex-review --base <rev>`. The queue is long today and not in order of arrival: do not
  put a second command of this session in the queue while a commit of it waits.
- Scripts and records, in the scratchpad
  (`C:\Users\Oficina\AppData\Local\Temp\claude\D--js-harness\27a0677f-bc17-4331-a050-5cb169a310fb\scratchpad`):
  `rv-run.cjs` (one gentle-ai review from assess to acknowledge, running only what each
  reply returns, the `granted` invocation included), `stop-own-ls.ps1`, `msg-*.txt` (commit
  messages), `commit-*.log` (the gates' reports), `codex-s1.log` and `codex-s1b.log`,
  `profile1.json` and `profile1.txt`, `profile-all.json`, `t7-count-after.json`,
  `t8-count-after.json`. If the scratchpad is gone, the numbers that matter are in Progress
  and the scripts are short to write again.
- Open and his: where the log's folder lives ("Ask me before"); the Codex cap. Both are in
  the orchestrator's queue for him.

## Next
The fix of the P2 in S1, its commit and reviews, the push and the pull request of S1. The
commit of T4 in S2, its review, then T5. gentle-ai and Codex on S3, its push and pull
request.

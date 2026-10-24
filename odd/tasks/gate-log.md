# The gate: the load it starts under, a log of every gate, and fewer git processes

Locator: `odd/tasks/gate-log.md` · Engram mirror: `odd/gate-log/tasks` · Branch:
`feat/gate-log`, in the linked worktree `D:\js-harness-worktrees\gate-log`, cut from
`origin/main` at `7ef20b9` · Session: `JH 6 · gate más corto y con registro`, orchestrator
`JH ORQ · js-harness`

State 2026-10-11: opened by the orchestrator's prompt, inside the order Sebastián asked for
(`odd/tasks/session-channel.md`, "The order he asked for", item 2; `odd/tasks/gate-lock.md`, "Next").
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
  (`odd/tasks/session-channel.md, "Session channel"`; `odd/tasks/gate-lock.md:1278-1291`).
- "Which gates ran beside which" is today a session's memory. Three failures of 2026-10-10
  name a gate log as the proof they lacked (`odd/tasks/gate-lock.md:1122-1131`). A gate's time
  is also only known to the session that ran it: the list `885, 728, 872, …` in
  `odd/tasks/gate-lock.md:1294` was kept by hand.
- The gate is as long as its work: 15,467 git processes in the whole suite (counted, Progress)
  that slow each other down on four cores, and arranging the files differently gave nothing (`odd/tasks/session-channel.md, "Session channel"`).
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
- A real gate's two lines in the log, and
  `gate log` reading them, quoted in Progress
- The git processes started by `bin/codex-review.test.mjs` and by
  `bin/check-codex-reviews.test.mjs`, counted by `scripts/count-git.mjs` before and after, are
  recorded in Progress with the profile each cut was chosen from
- `docs/ROADMAP.md` says what a gate now says and records, where the log lives and how it is
  removed, and what the cuts gave; its sentence "A gate that ends leaves nothing on disk"
  (`odd/tasks/session-channel.md, "Session channel"`) is reworded

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
- **Answered 2026-10-11 18:33 UTC: the log lives in `<home>/.js-harness/gate-log/`.**
  His words, typed in the orchestrator's chat to the question of keeping the gates' log in a
  folder of its own there, removed whole by `uninstall`: "Sí, en .js-harness/gate-log" (the
  beginning of a longer entry;
  `C:\Users\Oficina\.claude\projects\D--js-harness\7d2ae675-4bf2-4657-aff5-cde2477a4bee.jsonl`,
  line 1360, a user entry whose origin is a human, read by this session before it was
  used). So S2's pull request is merged like the others, when it is green and both reviews
  are recorded. This session's own gates in `gate-log-file` keep `JS_HARNESS_GATE_LOG=off`
  until that merge all the same: the installed command of this machine is older than S2
  and its `uninstall` would not remove the folder yet. The same entry says "te apruebo
  todo lo que me pides", which the orchestrator reads, for what it had proposed to him
  just before, as: a review tool that fails does not stop a session (go on, repeat the
  review in a turn of the lock, tell the orchestrator afterwards; a report outside stays
  his), and the Codex cap as a rate, up to 1,200 input tokens a changed line of a slice by
  `codex-review --plan`, over which a session asks. That reading is the orchestrator's;
  his words are those quoted.
- Anything that changes what a commit proves, the 1,200 s bound, or the gate on GitHub.
- Spend outside the plan: Codex reviews are budgeted by rate, rule `codex-review-rate`. This
  feature's cap of 3 million input tokens was raised by him to 7,000,000 on 2026-10-11 ("Sí, 7
  millones para cada una",
  `C:\Users\Oficina\.claude\projects\D--js-harness\a5471f0a-66fb-4c5b-8495-6e5fb17af777.jsonl`,
  line 1540); its spend is in Progress.

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
- Where: `gateLogDir(home)`, one function: `<home>/.js-harness/gate-log/`. The
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
  recorded, and says so. Counted (Progress): the suite
  starts 15,467 git processes, and the cuts chosen by this rule are about 2,800 of them.
- The tests do not change what they prove: only helpers and how often git is asked.
- Judged by the counts. One whole gate before and one after are recorded with their `load`
  rows, for the record.

### Delivery
Three slices in the order `odd/tasks/gate-lock.md` gave ("the gate log, and with it the load
… ; fewer git processes"), each its own pull request to `main`, each reviewed by gentle-ai
and then by Codex: S1 (T1, T2) on `feat/gate-log`; S2 (T3 to T5) on a branch stacked on S1;
S3 (T6 to T8) on a branch cut from `main`, since it shares
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
- [x] T4 · `check` and `gate` write start, end and refused; `takeGateTurn` returns whom it
  waited for; `checkSensor` returns seconds and `timedOut`; `gate log` reads; help text.
  Tests first, all under a throwaway home.
- [x] T5 · `uninstall` removes the log's folder in both paths and keeps it with a gate in use
  (orchestrator told before `bin/lib/manifest.mjs` is touched); the practice run's hash;
  `docs/ROADMAP.md`.
- [x] T6 · `scripts/count-git.mjs` with its test, then the profile of the two files, recorded
  here, and the cuts chosen from it by the stop rule.
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
  - So "some fifty thousand git processes" (`odd/tasks/session-channel.md, "Session channel"`, repeated in this
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

- 2026-10-11 · T4 is commit `b41b4ab` on `feat/gate-log-file`: its second gate passed (a
  wait of 36 min 5 s, then about 990 s; load row: 2.2 of 8 busy, right after another gate).
  gentle-ai reviewed T3 and T4 together, `49d2dd7..b41b4ab` (1,500 lines, one lens,
  reliability): approved and acknowledged, four findings, none blocking, all four right and
  fixed in the commit of T5.
- 2026-10-11 · The fix of the P2 is commit `921b005` on `feat/gate-log` (one writer, route:
  delegated). The writer changed the design it was handed, with a measurement: a question
  asked through `fs.promises` frees the event loop but not the process, since Node waits
  for the thread that holds the request before it ends, in `process.exit` as well (a
  process ended five seconds after its `exit` event, when a read nobody answered returned).
  So each question to the disk goes to a Node process of its own, which can be killed and
  let go of, with the path in its environment; three at most, a second for all
  (`BUSIEST_ASK_BOUND_MS`). The price, accepted: a Node start per question, 0.3 to 0.46 s
  measured with eight of eight processors busy; a slower machine names programs without
  scripts. Its first gate failed (1,009 s): a test of the writer's stopped a process by its
  number, which a rule test of the repository forbids
  (`bin/lib/process-tree.test.mjs:404`); neither the writer nor the parent's reading ran it.
  Fixed with the shared teardown, and the second gate passed (1,006 s, no wait; load row
  2.2 of 8). Since then a writer's brief names that rule test, and it is run before a
  commit that adds a test: seconds against a gate of seventeen minutes.
- 2026-10-11 · gentle-ai on the pending range of S1, `9c49587..3e09b5d` (895 lines):
  approved and acknowledged; one warning, right: a test cleared its timer and then waited
  for the news of a process's end with nothing left to keep the event loop. Codex on
  `78ee50e..3e09b5d`: 2 parts, 521,833 input tokens; the module correct; one P2 on a test,
  right: stopping the process by its number through the shared teardown, as the fix above
  did, could stop another process, since on Windows that one ends with its parent and the
  number may be reused within the test. Both fixed in commit `b9645f4` (gate 1,012 s, load
  row 2.1 of 8; gentle-ai: not due, 26 lines): the timer runs until the end is seen, and
  nothing signals that process, which sleeps fifteen seconds and holds nothing. Codex on
  `3e09b5d..b9645f4`: correct, 127,746 input tokens. The roadmap of S1 is commit `3e09b5d`.
  **S1 is finished**: every code commit has a Codex record, and gentle-ai approved or
  found nothing due on each.
- 2026-10-11 · T5 is commit `2023f9d` on `feat/gate-log-file` (one writer, route:
  delegated; gate about 949 s after a wait of 7 min 19 s; load row 4.1 of 8, right after
  another gate), with the four findings of the review of T3 and T4 in the same commit:
  the gate tests the whole tree, so two commits one after the other would have paid two
  identical gates. `removeGateLogFolder` in `bin/lib/manifest.mjs`, a function of its own
  between `removeGateFolder` and `removeChannelFolder`, called in both paths of
  `uninstall`; a log kept with a live gate is a field `log` on the same `in-use` entry of
  `gateKept` and one line of the report; an unremovable one is an entry of its own and
  exit 1. The regions the other session holds uncommitted (`manifest.mjs` 144 to 381,
  `install.mjs` 139 to 153) are untouched: the diff starts at 713 and at 350, but for one
  import at line 9. The practice run (`scripts/practice.mjs`, step `global-uninstall`) now
  asserts that a real gate of the installed candidate wrote the log and a real uninstall
  removed it: 10 of 10 steps, real home unchanged. The orchestrator was told before the
  file was touched and answered to go ahead.
  gentle-ai on `b41b4ab..2023f9d` (491 lines): approved and acknowledged, four findings,
  none blocking. Three answered with evidence and no change: the practice step's
  precondition holds, since the journey's environment drops every `JS_HARNESS_*` of the
  caller (`scripts/practice-lib.mjs:113`, tested at `scripts/practice-lib.test.mjs:88`);
  the formatter does not throw on wrongly typed inner fields (49 combinations probed,
  none threw); the test of 120 ms does assert a positive time (`bin/check.test.mjs:249`).
  One right and left for the next code commit of S2: `gateRecord` passes on a member of
  `waitedFor` that is no object, and the reader then drops the whole line; the one caller
  hands objects only.
- 2026-10-11 · gentle-ai on T8, `7201bac..cd574c9`: not due, under the budget (256 lines).
- 2026-10-11 · The Codex spend: **1,772,493** input tokens, all of it S1 (942,981;
  179,933; 521,833; 127,746). S3 and S2 did not fit in what was left of a cap of three
  million by their plans; he raised it to 7,000,000 the same day ("Ask me before"), which
  holds the three by plan: 1,772,493 spent, 1,520,000 planned for S3, at most 2,860,000 for
  S2.

- 2026-10-11 · **S1 is merged**: pull request 60, `feat/gate-log` into `main`, merge commit
  `51a24db` (the orchestrator merged it; `git merge-base --is-ancestor de50a40 origin/main`
  answers yes). From here this document is carried by `feat/gate-log-file`, which merged
  `feat/gate-log`; `feat/gate-git-processes` gets it when it merges `main`.
- 2026-10-11 · Codex on S3, `51a24db..cd574c9`, under the lock (ended 13:15): 5 parts,
  **1,338,355** input tokens (541,283; 205,188; 299,887; 172,718; 119,279) against
  1,520,000 planned. Three parts correct. Two findings, both P2, both on the count tool and
  both about what it may fail to count: a child whose environment clears `NODE_OPTIONS`
  but keeps the run's output variable runs without the preload, and the git processes it
  starts are in no count (`scripts/count-git-preload.mjs:150`); and the reports of nested
  `node --test` runs are subtracted as if they were counted children, so each can hide a
  child that never reported (`scripts/count-git.mjs:123-124`). With one writer, test
  first (route: delegated), who also answers whether the first could have hidden git
  processes in the counts the roadmap states, and counts the two long files again.
- 2026-10-11 · The desktop app restarted at 13:14 and this session's process ended with it;
  the session came back with its conversation. Its two background commands were
  orphaned and neither was started again. Codex on S3 had ended a minute after (its
  record is written). The merge commit of S2 lives on by itself: `git commit` (pid
  47380), its hook and the gate (pid 45832) all survived, waiting for the lock with
  `JS_HARNESS_GATE_LOG=off` in their environment; when its gate passes the commit is made,
  and its report is `commit-merge-s2.log` in the scratchpad. Nothing notifies this
  session of it: look at `git log` of `gate-log-file`.
- 2026-10-11 · Two notes the orchestrator holds for a later slice of the lock, from the
  other work session and from its own looks: the lock could record the id of the session
  that holds it, so `Gates` of `js-harness sessions` names the session; and the lock is
  not a line (at 11:02 a gate that had waited 1 h 04 min was passed by one that began
  later), which this document also recorded from the gate of T4.
- 2026-10-11 · The Codex spend: **3,110,848** of 7,000,000 (S1 1,772,493; S3 1,338,355).
  To come: the fix of S3's two findings (small), and S2 (up to 2,860,000 by plan).

- 2026-10-11 · The merge of `feat/gate-log` into S2 is commit `07725c3`, made by the
  orphaned `git commit` by itself at 13:58: its gate waited 41 min 24 s, 19 minutes short
  of its hour, and passed (load row: 7.2 of 8 busy, right after another gate). Its report
  could not assess the review ("gentle-ai could not assess the pending change"), which a
  merge commit made by an orphan explains or not; assess runs again before the push.
- 2026-10-11 · He said where the log lives, `<home>/.js-harness/gate-log/` ("Ask me
  before"), so nothing of S2 waits for him.
- 2026-10-11 · The fix of S3's two findings is with its commit's gate
  (`scripts/count-git.mjs`, `scripts/count-git-preload.mjs`, its test: 12 of 12). The
  counts stand: the two long files start nothing but git (other 0, reported 2 of 2), and
  counted again with the fix they give the same 8,213, row for row
  (`s3-count-after-p2.json`); no test of the repository clears `NODE_OPTIONS` for a child
  (`rg -n "NODE_OPTIONS" bin evals scripts` finds the tool's own files and one comment).
  The whole suite's 15,467 was not counted again.
- 2026-10-11 · Seen in passing and not this feature's: that gate left an untracked
  `Microsoft/Windows/PowerShell/ModuleAnalysisCache` at the root of `gate-log-file`
  (13:41:10), and the worktree `session-board` holds one since 2026-10-10 05:26. Windows
  PowerShell writes that cache under `LOCALAPPDATA`, and beside its working folder when
  the variable is missing: some test starts PowerShell from the repository's root with a
  reduced environment. Removed from this worktree and handed on as a task of its own
  (which test, and its fix). Until then a commit of this session names its paths: `git
  add -A` would have taken that folder.

- 2026-10-11 · A slip of this session, in four parts. What happened: the commit of S3's
  fix asked for the lock at 13:42 and gave up at 14:42, passed by three gates that came
  later; one was this session's own, the commit of the merge of `main` into S2, started
  in the belief that a merge that changes no file runs no sensor. It does. The rule "no
  second command of this session in the queue while a commit of it waits" was already
  written here, and was broken on an unchecked belief. The fix: S3 was committed in one
  turn taken first (`gate --wait 180 -- sh <script that commits>`), where a commit's hook
  runs its sensors in the turn of the process that started it. What stops it recurring: a
  commit that must not lose its hour is made inside a turn taken with `gate --wait`. Where
  it enters the harness: the lock as a line is in the feature of the session "JH 8". The
  proof: `s3-turn.log` in the scratchpad, turn 14:52, committed 15:07.
- 2026-10-11 · A second slip in the same turn, in four parts. What happened: the merge of
  `main` into S3 was made with `git merge`, which makes its commit without the pre-commit
  hook, so `9250f45` existed with a tree no gate had proven (in S2 the merges were `git
  merge --no-commit` and then `git commit`, which runs it). Not pushed. The fix: a second
  turn ran `node bin/check.mjs` on that tree: `PASS tests` (`s3b-check.log`). What stops it
  recurring: a merge is committed with `git commit` after `--no-commit`, always. Where it
  enters the harness: a `pre-merge-commit` hook that runs the same gate is a candidate
  for the hooks the harness installs (`npm run hooks`), not built here. The proof: the
  check's report, and the pre-push hook, which proves nothing about it: say so.
- 2026-10-11 · A third, smaller: the scripts of those turns decided their next step with
  `rg`, which inside a turn of the lock is not on the path (in this session's shell it is
  a function of the host). The test read as false and Codex was not started in either
  turn, though both reviews had been approved. Nothing was harmed; each cost a wait.
  A script run under `gate --` uses `grep` or node, never `rg`.
- 2026-10-11 · S3 at `9250f45`: `fc9877d` the fix of the count tool (gate passed in the
  turn), `f5f445e` the roadmap with the count alone and no estimate beside it (his
  requirement of the day: no old figure beside a new one), `9250f45` the merge of `main`
  (`f68a752`), proven after. gentle-ai on `7201bac..9250f45` refused to start: the
  candidate, with what the merge brought, is 7,539 lines and passes its context budget
  (`lens_context_budget_exceeded`); the smaller candidate is the slice against `main`,
  `f68a752..9250f45`, queued with Codex on `fc9877d^` after it (`rv-s3d.log`,
  `codex-s3b.log`).
- 2026-10-11 · S2 at `5daf468`: `ac5e865` the merge of `main` (its gate passed), `c9c4599`
  the slice added by the lead, `5daf468` the fix left from the review (a member of
  `waitedFor` that is no object is not written; test first, RED `skipped: 2`, then 18 of
  18; gate passed in a turn of its own). gentle-ai on `2023f9d..5daf468`: approved and
  acknowledged, two findings, both on code of S1 that the merge brought and that is on
  `main`: the only test of the real look passes without asserting when nobody is named,
  and the process that asks the disk inherits `NODE_OPTIONS` with no test of what that
  does. Handed on as a task of their own, not fixed here. Codex on S2, `b016699..5daf468`,
  7 parts, 1,986 lines, started 15:55 under the lock (`codex-s2.log`).
- 2026-10-11 · Taken for the session "JH 8", through the orchestrator, for S2 before its
  format reaches `main`: the reader leaves out in silence, and does not count as
  unreadable, a line with a sound head (`v`, `id`, `at`) whose `event` is a kind this
  version does not know, so that a later version may write a new kind (a gate that
  stopped before its sensors) into the file gates of several versions share. A torn line
  and a malformed body are still counted. It goes in the commit that follows Codex's
  review of S2, with its test. The limit told to that session: an older reader does not
  pair an end of a new kind with its start, so it shows that gate as a start alone.
- 2026-10-11 · `main` is `b016699` (pull requests 61 and 62, documents only); the
  orchestrator says both branches merge clean. Merge it again before each push.
- 2026-10-11 · The context rule is 88% by his words of the day (the orchestrator's
  transcript, line 1745): at 88 the state is written and committed. This session wrote
  this at 84%.

- 2026-10-11 · **S3 is merged**: pull request 63, `main` at `859b9a1` (the orchestrator
  merged it). gentle-ai approved the slice against `main` (`f68a752..9250f45`), two
  findings, none blocking: one answered with evidence (the run's root is `git rev-parse
  --show-toplevel`, `bin/codex-review.mjs:1043`, so it is always the top), one left (an
  out file the count tool cannot read throws). Codex on the fix alone, from a throwaway
  worktree at `fc9877d` since the command reviews up to the head and the head held the
  merge of `main`: 213,803 input tokens, two P2 on the line that says how many Node
  children never reported, both making it say "missing" where nothing is (a child behind
  a shell started by a synchronous call; two launches whose shells got the same pid).
  Left on purpose and said in the pull request; the orchestrator accepted them as not
  blocking, for a task of the gate's next session.
- 2026-10-11 · Codex on S2, `b016699..5daf468`: 7 parts, 1,952,667 input tokens, four P2,
  all right but one part of one: a waited-for gate that stays unnamed when its holder's
  file was busy at first; an event joined to the fragment of a write that was cut short;
  a printable field that cannot be printed making `gate log` throw (not so for a
  sensor's fields, which are never printed); `uninstall` removing the log when the
  lock's folder could not be looked at, which the writer of T5 had raised as a doubt and
  this session had let pass. Fixed with one writer, test first (route: delegated), with
  the reader's silence for a kind of event it does not know, in commit `88165ec` (gate
  passed inside a turn). gentle-ai on `5daf468..88165ec`: approved and acknowledged, two
  findings left for the next slice, which works in the same files: the reader refuses a
  start whose `load` holds a figure that is no finite number or a busiest name that is no
  text, and the writer does not filter `load` as it filters `waitedFor` (the sampler
  hands neither today); and holders with no token share one entry in `takeGateTurn`.
  Codex on `88165ec`: 2 parts, both correct, 423,298 input tokens.
- 2026-10-11 · The Codex spend of the feature: **5,700,616** input tokens of 7,000,000
  (S1 1,772,493; S3 1,552,158; S2 2,375,965).
- 2026-10-11 17:01 · S2 delivered: `origin/main` (`859b9a1`, S3's code) merged at
  `aeb63ea` inside a turn of the lock, the whole gate passed on the merged tree, `check
  --push` passed, the branch was pushed and pull request 64 opened. The home holds no
  `gate-log` folder: every gate of this session ran with the log switched off.

## Resume here (state at 2026-10-11 17:05, for a session that lost its conversation)
- S1 and S3 are merged in `main`. S2 is pull request 64
  (https://github.com/jsaristi/js-harness/pull/64), branch `feat/gate-log-file` pushed at
  `aeb63ea` plus this document: the merge of `origin/main` (`859b9a1`) was committed
  inside a turn and the whole gate passed on it (17:01, `PASS tests`), and `check --push`
  passed (5 code commits, all covered by a Codex record). Nothing is left to build. What
  is left is the lead's: the merge. If a review of the pull request asks for a change,
  it is made here, in a turn (`gate --wait 180 -- sh <script>`). Every command
  of this session in `gate-log-file` runs with `JS_HARNESS_GATE_LOG=off` until S2 is
  merged and the machine's command updated; a commit names its paths; a script run
  inside a turn uses `grep`, never `rg`. The scripts and logs are in the scratchpad
  (`C:\Users\Oficina\AppData\Local\Temp\claude\D--js-harness\27a0677f-bc17-4331-a050-5cb169a310fb\scratchpad`).
- When S2 is merged this feature is finished here; the slice added by the lead (below)
  is the session "JH 8"'s.

## A slice added by the lead, for a new session (2026-10-11)
- What: a gate that stops before its sensors when a static row already fails (`budget`,
  `contracts`, and the rows `failures` and `rules` other sessions are building). Today such
  a row is printed after the sensors (`bin/check.mjs`, the rows after `checkSensors` in
  `main`; the other session read them at lines 964 to 995 of `main`), so a failure that
  was known in a second costs the whole run, seventeen minutes and a turn of the lock,
  before anyone reads it.
- Why now: the row `rules` of the session "JH 7" refuses a retired phrase anywhere in
  force; without the early stop, a stale phrase that reaches `main` by a clean merge costs
  the next committer a whole gate. Behind it, his words of 2026-10-11 in the
  orchestrator's chat (transcript `7d2ae675-4bf2-4657-aff5-cde2477a4bee.jsonl`, lines 1745
  and 1822, read by this session): no old rule beside a new one, a sweep of such errors
  and a protocol against them. The early stop is the orchestrator's derivation from that,
  placed as lead; it is not a sentence of his.
- Who: a new session, after S2 is merged, since S2 changes the same functions of
  `bin/check.mjs`. It does not fit here: this session was at 75% of its context with S3
  and S2 still to close, and said so to the orchestrator.
- What that session must hold on to: the order changes when a failure is known, not what
  a commit proves (a failing static row already fails the gate); the report of a gate
  that stopped says that no sensor ran and which row stopped it, so nobody reads "no FAIL
  tests" as a pass; the lock is not taken, or is given back, before the stop; the gate
  log (S2) writes such a gate as what it was, and not as a start without an end, which
  reads as a killed gate; a row that cannot be computed (not a failure) stops nothing;
  `check --push` and an inner check are unchanged. Test first, with the three states of
  the lock.

## Next
The two reviews of S3, its push and pull request. Codex's findings on S2 and the reader's
change in one commit, Codex on it, its push and pull request.

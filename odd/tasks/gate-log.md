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

- [ ] T1 · `bin/lib/machine-load.mjs` and the `load` row. Tests first: `loadBetween` on
  made-up processor times, an empty list and two equal readings; `check` with an injected
  sampler prints the row once, before the first sensor, in each of the three lock states; no
  row for a direct `checkSensors` call that is no gate, under `JS_HARNESS_CHECK_INNER`, for
  documents alone, with `JS_HARNESS_GATE_LOAD=off`; "right after another gate" when it
  waited; `gate --` silent below the threshold; the real-process helpers set the switch; one
  test runs a real sample.
- [ ] T2 · What loads a loaded machine. Tests first: the PowerShell and `/proc` parsers on
  recorded output; the difference of two samples; the first argument that is not an option;
  a missing command, an error and a timeout each leave the figure alone; nothing is started
  below the threshold or with the switch off.
- [ ] T3 · `bin/lib/gate-log.mjs`: append, rotate, read both files, the folder made by the
  writer. Tests first.
- [ ] T4 · `check` and `gate` write start, end and refused; `takeGateTurn` returns whom it
  waited for; `checkSensor` returns seconds and `timedOut`; `gate log` reads; help text.
  Tests first, all under a throwaway home.
- [ ] T5 · `uninstall` removes the log's folder in both paths and keeps it with a gate in use
  (orchestrator told before `bin/lib/manifest.mjs` is touched); the practice run's hash;
  `docs/ROADMAP.md`.
- [ ] T6 · `scripts/count-git.mjs` with its test, then the profile of the two files, recorded
  here, and the cuts chosen from it by the stop rule.
- [ ] T7 · The first cut the profile names (expected: the git folder, and whatever else a
  `codex-review` run asks git twice, resolved once per run).
- [ ] T8 · The second, if the stop rule lets one through (expected: repositories built once
  in `bin/check-codex-reviews.test.mjs`); then the counts after, one whole gate, and
  `docs/ROADMAP.md`.

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

## Next
T1, test first, by one writer (`bin/lib/machine-load.mjs`, `bin/check.mjs`, `bin/gate.mjs`
and their tests are more than one non-trivial file).

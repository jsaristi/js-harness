# The gate: one at a time on the machine, and a shorter run

Locator: `odd/tasks/gate-lock.md` · Engram mirror: `odd/gate-lock/tasks` · Branch:
`feat/gate-lock`, in the linked worktree `D:\js-harness-worktrees\gate-lock` · Session:
`JH 1 · control de tests`, orchestrator `JH ORQ · js-harness`

State 2026-10-10: plan approved by Sebastián in this session's chat ("Si", to the plan put to
him in plain words, as he asked on 2026-10-09 for every plan before it is built). His yes covers
T1 to T6 and T8; it does not cover T7, the update of the global command, or the merge.

## Goal
`check` itself keeps two gates from ever running together on the machine, and a commit waits
for its gate far less than today, without the gate proving any less.

## Why
The rule "never two gates at once" is kept by hand, and it cannot be kept from outside the
gate: a session reads the process list, sees none, and starts, while another does the same in
the same seconds. Two gates together make both miss the 20-minute bound of a sensor, with every
test green (`odd/tasks/session-board.md`, entry of the gate of pid 30936 beside pid 30180;
`odd/tasks/codex-review-cost.md`, F7). Three sessions each kept a private wait script by
2026-10-09 and one collision still happened (`docs/ROADMAP.md`, "Session channel", point 5).
The roadmap ranks a rule a command enforces above a rule in prose, and names this lock as the
example (`docs/ROADMAP.md`, "Rule hierarchy", level 1). It is also what the other planned
features wait on: sessions work in parallel only once the gate has its lock.

The run is long for two measured reasons, and both are paid on every commit:

- One file sets the floor. `node --test` runs files side by side and the tests of one file one
  after another, so the suite cannot end before its slowest file does.
  `bin/codex-review.test.mjs` takes 12 minutes alone: 230 tests, each building a real
  repository with about nine git processes (`odd/tasks/codex-review-cost.md`, F7; 200 fixture
  call sites counted in the file on 2026-10-10). Whole gates measured 428 to 475 s on a quiet
  machine and 1,040 to 1,117 s on a busy one, against a bound of 1,200 s.
- Half the commits change no code. Of the 410 non-merge commits on `origin/main` since
  2026-09-26, 205 touch only `.md` files (counted with `git log` on 2026-10-10), because this
  repository records every decision in the roadmap and the feature documents. Each of them
  runs the whole suite.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/gate-lock.md` exits 0
- `node --test bin/lib/gate-lock.test.mjs` exits 0
- `node --test bin/check.test.mjs` exits 0
- `node --test bin/sessions.test.mjs bin/lib/sessions.test.mjs` exits 0
- Two `check` commands started together in two worktrees run their sensors one after the
  other, and the second prints whose gate it waits for; shown once on this machine, with the
  output recorded here
- `bin/codex-review.test.mjs` alone, timed before and after T6 on the same quiet machine, with
  both numbers recorded here
- `docs/ROADMAP.md` says what the lock covers, what it does not, and what stays for the later
  slice (the gate on GitHub)

## In scope / Out of scope
- In: `bin/check.mjs`, a new `bin/lib/gate-lock.mjs`, the dispatcher `bin/js-harness.mjs` (one
  new sub-command, T4), `bin/sessions.mjs` and `bin/lib/sessions.mjs` (the Gates section),
  the line about gates in the installed skill text (`bin/lib/manifest.mjs`), the fixture
  helpers of `bin/codex-review.test.mjs`, `harness.json` of this repository (T7), their tests,
  `docs/ROADMAP.md`, this document.
- Out: `evals/`, all of it. Two open branches change it and `feat/subagent-model-routing`
  changes `evals/runner.mjs`; T4 gives eval batches a way to take the lock without a line
  written there. The gate on GitHub and whether `init` writes a workflow: a later slice, not
  decided, both his (the repository is private, so runs cost minutes). The 20-minute bound of
  a sensor: it stays, and the margin under it grows. Splitting `bin/codex-review.test.mjs`
  into several files: thousands of lines moved; only if T6 falls short, and asked first.
  `AGENTS.md`: at its budget, and nothing here needs a line of it.

## Constraints
- Zero dependencies and every operating system: `check` ships to any project. So the lock
  cannot reuse the one lock the repository has (`takeLock`, `bin/remote.mjs`): that one names
  its holder by pid and creation time, read through PowerShell on Windows only, and it never
  waits.
- The gate must not prove less. Every change that makes it run less says so in its output: a
  gate that quietly ran nothing would look green (`discoverSensors`, `bin/check.mjs`).
- The suite starts gates of its own (`bin/check.test.mjs` runs `main` with real sensors). They
  must never wait for the gate that runs them, and a test file run by hand must never wait for
  a real gate.
- What the lock writes outside the repository is one folder, `<home>/.js-harness/gate`; what
  is in it is removed when the gate ends. Deleting it by hand undoes everything; a leftover of
  a gate that died is taken over without anyone's help.
- The lock holds only between gates that have it. This repository's hook runs each worktree's
  own `bin/check.mjs`, so a branch cut before this one merges has no lock until it merges
  `main`; a project that uses the harness gets it when the global command is updated on the
  machine, which is his to ask for. Until both, the rule in prose stays.
- Machine shared, no lock yet: before every commit and every test run of this feature, `Gates`
  in `js-harness sessions` is read, and none is started while another runs.
- A commit runs in the background; after a failed gate `git config --local core.bare` is read
  in `D:\js-harness` before anything else (`odd/tasks/codex-review-lean.md`, Constraints).

## Effort
high

## Ask me before
T7 before it is built, again, with the list of tests found to read documents: it changes what a
commit proves. Splitting `bin/codex-review.test.mjs`, if T6 is not enough. Updating the global
`js-harness` on this machine. Merge of the pull request. Anything about the gate on GitHub.

## TDD
Mode: strict. Runner: `node --test`, one file at a time while a task is open. Exceptions: T5 is
a measurement, and the two-worktree proof of T2 is a run recorded here.

## Design

### The lock
- One lock for the machine, not for the project: `<home>/.js-harness/gate/lock`, with `home`
  resolved as `check` already does (`--home`, then `JS_HARNESS_HOME`, then the user's home).
  Two projects share the cores, so they share the lock.
- A folder that holds one file, `holder-<token>.json` (changed in T1 from the single file of
  the plan); the file holds the pid, the folder being checked, the start time and the command.
  With a single file, taking over a dead gate's lock means removing "the lock file", and a
  gate that looked a moment earlier can remove the file of the gate that has just taken it;
  that is the gap the house lock documents (`bin/remote.mjs:298-300`). With a folder, the dead
  holder's file is removed by its own name, which a live gate's file never has, and the folder
  goes with `rmdir`, which fails while a file is in it.
- Taken in one step (changed in T1b, after review). A gate makes a folder of its own beside
  the lock, `gate/wait-<token>/`, with its file inside, and takes the lock by renaming that
  folder to `lock`, which the file system refuses while `lock` holds a file. So the lock
  folder never exists without its holder's file, and an empty `lock` is nobody's. The first
  version made `lock` with `mkdir` and wrote the file after: in between the folder was empty
  and its maker's, a gate late to a takeover could remove it and make its own, and both held
  the lock. The folders of gates that wait are also how the board will know who waits (T3);
  one left by a gate that died waiting is swept by the next gate that takes the lock.
- Alive by a heartbeat, not by asking the system who a pid is: the holder touches its file
  every 5 s while its sensors run. A file not touched for a minute belongs to a gate that
  died, and the next one takes it over on its second stale reading, 2 s apart (a machine that
  slept wakes with every beat hours old, and a live holder's timer fires first). This works
  the same on every system, costs no PowerShell snapshot (2.1 s each here), and a recycled
  pid cannot fool it. A gate frozen for the whole minute loses the lock and can tell
  (`lost()`); the gap left is a holder that wakes in the instant between a waiter's second
  reading and its removal.
- It covers the sensors only. The budget, contract and payload rows read files and take
  milliseconds; `check --push` runs no sensor and takes no lock; neither does the inner check
  a sensor's suite runs (`JS_HARNESS_CHECK_INNER`).
- A second gate waits, and says so at once on stderr: whose gate it waits for (folder, pid,
  since when). When it gets the lock it runs, and its report carries an INFO row with how long
  it waited. `--no-wait` refuses instead, with a FAIL row that names the holder. The wait is
  bounded (`--wait <minutes>`, default 60): past it the gate fails saying so, never hangs.
  Waiting is the default because the caller is a commit running in the background: a refusal
  would bring back the retry loop each session wrote by hand.
- Gates of the suite: a sensor already runs with a throwaway home, so a gate started by a test
  takes a lock nobody else sees. The test helper passes a temporary `--home` always, so a test
  file run by hand does not wait for a real gate either; a test proves it.

### The board
With gates that wait, the process list shows two `check` commands for one running gate, and
the watch would report "gate started while another runs" for what is now correct. So `Gates`
reads the lock: who runs (with its real folder, which an installed `js-harness check` does not
show today, `bin/lib/sessions.mjs:522`) and who waits. The line of the installed skill that
tells a session to read `Gates` before a commit is reworded to what remains true.

### Anything else heavy: `js-harness gate -- <command>`
The question left to this plan: should the lock also cover eval batches? Yes, and not by code
in `evals/`. A sub-command runs any command under the same lock, waiting like a gate:
`js-harness gate -- node evals/runner.mjs ...`. A full `node --test` by hand goes the same
way. One test file run alone during a task stays free: it is seconds of one core, and making
it queue behind a gate would cost more than it saves. The sessions that run evals adopt the
command in their own branches; nothing of `evals/` changes here.

### A shorter run
1. Measure first (T5): one whole run with the time of every file, recorded here. The two
   causes above are from notes and counts; the numbers the next two tasks are judged by are
   taken then.
2. Fixtures built once (T6). Most tests of `bin/codex-review.test.mjs` build the same few
   repositories. Each distinct one is built once per file run and copied for each test: a copy
   of a few files instead of nine git processes. The tests do not change, only their helpers.
   Timed before and after.
3. A commit that changes only documents runs no sensor (T7), declared, never by default.
   `harness.json` gains a list of paths that are documents for this purpose; when every path of
   the staged change is in it, the sensors are skipped and the report says so in a row (which
   paths, declared where). The static rows still run, so a contract or `AGENTS.md` broken by
   the commit still fails it. Opt-in because in another project a document can be the product;
   this repository opts in for `docs/` and `odd/tasks/`. Before it is built: every test that
   reads a tracked document of this repository is found, and each either stops reading it or
   keeps that path out of the list. This is the one item that changes what a commit proves,
   so it is asked again with that list in hand.

Discarded: the house lock (Windows only, never waits); a lock per project (the cores are the
machine's); refusing by default (see above); a lock by message between sessions (a lock holds
when nobody is listening, `docs/ROADMAP.md`); skipping tests "not affected" by a change (no
map of that exists here, and a wrong one is a silent hole).

## Tasks
Each closes with its commit and this file saying what is next. Route: T1 inline (one new file
and its test); T2, T3, T4, T6, T7 one writer each (two or more non-trivial files); T5 a run.

- [x] T1 · `bin/lib/gate-lock.mjs`: take, heartbeat, release, stale takeover, bounded wait;
      clock injected, real file system in a temporary home; test first.
- [x] T1b · The lock is taken in one step (added 2026-10-10: the review of T1 found that two
      gates late to the same takeover could both hold the lock). Route inline, same two files.
- [x] T1c · What the review of T1b found (added 2026-10-10, five advisory findings): a busy
      holder reads as held, not as empty; the sweep goes on past an entry it cannot read; the
      removal of a holder's file is retried when Windows says busy, shown by a run; the
      invariant test cannot have its assertion swallowed; the test of processes that die is
      not at the mercy of a loaded machine. Route: one writer, same two files.
- [x] T1d · What the Codex review found in the lock (added 2026-10-10, three findings): a
      takeover does not remove a holder's file whose beat moved since it was read stale; a
      lock folder that cannot be listed because it is busy is a lock held, not a free one;
      a gate does not read its lock as lost because its file could not be looked at. Route:
      the writer of T2, first, and in T2's commit (the reason is in Progress).
- [x] T2 · `check` takes it around the sensors: the wait message, `--no-wait`, `--wait`, the
      rows, release on every way out; the suite's own gates do not wait. Proof with two
      worktrees recorded here.
- [x] T2b · What the gentle-ai review of T2 found (added 2026-10-10): a test that the holder
      keeps beating while a sensor outlasts the stale time; a lock that stays unreadable past
      the stale time is an error, so the gate runs without it instead of waiting an hour and
      going red; the wait message says what is left of the bound; the two-process test's
      margins. Route: the writer of T3, first, and in T3's commit.
- [x] T3 · The board reads the lock: `Gates` shows who runs and who waits; the watch stops
      reporting a waiting gate; the skill line reworded.
- [x] T3b · What the two reviews of T3 found, and what the lock leaves on disk (added
      2026-10-10). The board stops guessing a gate's phase from outside: a `check` process
      whose own folder holds the lock's library is a gate that knows the lock, and only the
      lock says whether it runs; the alarm is for a gate that does not know the lock beside
      another gate. With it: the lock read against the clock of that moment, an unreadable
      holder that is nobody's is not "another gate", a holder with no start time renders, the
      wait notice is said again when an unreadable holder becomes readable, an unreadable lock
      is judged before the timeout, the beat test's margins. And nothing left behind: a
      release removes the folder `gate` when it is empty, and `uninstall` removes what a
      killed gate left. Route: the writer of T4, first, and in T4's commit.
- [x] T4 · `js-harness gate -- <command>`.
- [x] T4b · What the reviews of T3b and T4 found (added 2026-10-10; the list is in Progress):
      `gate` passes several arguments through `cmd.exe` unchanged, quotes, `&` and `%`
      included; uninstall tells a gate folder it cannot look at from one that is not there,
      and its parent's cleanup cannot throw away what it found; and the smaller ones. Route:
      one writer, in a commit of its own or with T5, under about 1,200 changed lines.
- [x] T5 · Measure the suite per file; record it here; set the numbers T6 is judged by.
- [x] T6 · Fixtures of `bin/codex-review.test.mjs` built once and copied; timed before and
      after.
- [x] T6b · `bin/codex-review.test.mjs` was still the longest file after T6 (added 2026-10-10).
      Approved by Sebastián the same day, both things: the file run in three shards with no
      code moved, and `gitDirs` asking git once for what it asked twice. Both built
      (`b65ea95`); measured inside a whole run the shards gave nothing, and they are taken
      out again (Progress, "What the shards gave"). `gitDirs` stays.
- [x] T7 · Document-only commits skip the sensors, declared in `harness.json` (asked first;
      approved by Sebastián on 2026-10-10 with the list in hand). Route: one writer.
- [ ] T8 · Close: `docs/ROADMAP.md` (what the lock covers, what waits for the later slice),
      gentle-ai and Codex reviews of each slice with code, pull request. Merge is his.

Cost, said before it is spent: about ten commits, each a gate of 8 to 18 minutes of this
machine until T6 and T7 land; Codex reviews within the 3 million input tokens the charter
allows a feature. No spend outside the plan.

## Progress
- 2026-10-10 · Opened. Read the two roadmap sections, `bin/check.mjs`, the hooks; an explorer
  mapped the board's gate detection, the suite's spawns, the house lock and the prose rules
  (its claims spot-checked at `odd/tasks/codex-review-cost.md:661-675`,
  `odd/tasks/session-board.md:880-888`, `bin/remote.mjs:298-345`). Not checked: which tests
  read tracked documents (T7 does it); per-file times (T5). Failed: nothing.
- 2026-10-10 · Plan put to Sebastián and approved ("Si"). Told the orchestrator by message:
  opened, then waiting for him; both delivered to its inbox.

- 2026-10-10 · The document's commit is `8ef2771`. Its gate took 990 s for one Markdown file,
  alone on the machine: the cost T7 is about, measured.
- 2026-10-10 · T1 done, route inline. `bin/lib/gate-lock.mjs` (237 lines) and its test (364
  lines, 22 tests, 2.3 s). Checked: `node --test bin/lib/gate-lock.test.mjs` exits 0; the test
  of five real processes that race for a dead holder's lock and then for each other's passed 8
  runs out of 8. The tests were written before the library, but the red that was seen is only
  "module not found" (the library moved aside): the gate of `8ef2771` was running while both
  were written, and no test is started beside a gate. In its place the library was broken on
  purpose three ways. Taking over on one stale reading: 2 tests fail. A `mkdir` that is not
  exclusive: the file fails (exit 1; one run of it hung in a loop only that mutant has, and was
  killed). A release that removes the folder with what is in it: the race test failed in one
  run of two, so that mutant is caught by chance, not always. Not checked: any system but
  this Windows machine. Failed: nothing. Changed from the plan: the lock is a folder with one
  file, not a file (Design, "The lock").
- 2026-10-10 · T1 is commit `c623c4c` (gate 1,085 s, green). gentle-ai assessed it medium risk
  and due (651 lines, `slice_budget_reached`), reviewed it with one lens (reliability) under
  the consent he pre-granted, approved it, and the approval was acknowledged (lineage
  `review-0a3b0756ba2e7a2e`, authority burned). Three advisory findings, all true:
  - `R3-takeover-rmdir-fresh-folder` (warning): two gates on their second stale reading of
    the same dead holder could both hold the lock. One removes the dead file and the folder
    and makes the folder again; the other, late, removes that fresh empty folder and makes its
    own; both then write their file. The comment at the top of the file claimed this could not
    happen. It was wrong: it covered a folder removed under a gate, not one made again.
  - `R3-stat-busy-not-tolerated` (warning): reading a holder's file tolerated only "not
    there", and a file Windows is still removing answers "busy".
  - `R3-partial-take-and-unremovable-stale` (suggestion): a take that failed half way left its
    file behind, and a dead holder's file that could not be removed threw out of the wait.
  They became T1b. The Codex review runs once over T1 and T1b together (`--base 8ef2771`),
  not over code already replaced.
- 2026-10-10 · Two mistakes of this session with the very rule this feature replaces, both
  told to the orchestrator. At 02:15 the lock's test file (30 s, about ten short processes) was
  started while the gate of `practice-project` (pid 18872) ran: the line of `Gates` was read
  and the command went on regardless. Then a wait script of this session's own polled the
  board every 48 s for 46 minutes beside two gates and could never have fired: it called `rg`,
  which is a shell function here and does not exist inside `sh script.sh`, so it never read
  "none running". The orchestrator found it by reading the script's output; one gate of
  `session-board` failed at its 20-minute bound in that time (02:40 to 03:00), and whether
  the polling pushed it there is not known. Both are what the plan said of wait scripts, now
  with this session's name on it: the check and the start are two steps, and a private script
  is one more thing that can be wrong.

- 2026-10-10 · T1b done, route inline. The lock is now `<home>/.js-harness/gate/lock`, taken
  by renaming the gate's own folder onto it; `fileSystem` is injectable, so a test steps in
  between two file operations. Checked: `node --test bin/lib/gate-lock.test.mjs` exits 0, 30
  tests, 14.8 s. The red was seen this time: against the first version (`c623c4c`, given only
  the seam the test needs) the test "the lock folder never exists without its holder's file"
  fails three runs of three with "the lock folder was empty in the middle of a take", and
  passes against this one. The three findings each have a test: the late gate at a takeover,
  the holder file that answers "busy" as it is read, the dead holder's file that cannot be
  removed yet. Said plainly: the test of five processes that each die holding the lock passes
  against the first version too (three runs of three), so it does not prove the gap closed;
  the empty-folder test does, by showing the state the gap needs no longer exists. Found on
  the way: on Windows a rename of a folder onto a file replaces the file, so a stray file
  named `lock` holds nothing. Not checked: any system but this Windows machine (on others a
  rename onto an empty folder replaces it, which the design allows and no test here ran).
  Failed: nothing.

- 2026-10-10 · T1b's first commit was refused by the gate on time alone: "npm run test timed
  out after 1200 s", 350 tests passed and none failed when it was stopped (04:22 to 04:42, on
  the orchestrator's turn, with no other gate or test run alive when it started). Not retried:
  the orchestrator gives the next turn. T1b is staged and not committed. The gates of this
  branch took 990 s, then 1,085 s, then more than 1,200 s; the record commit of the
  `session-board` session reached the bound four times the same night (the orchestrator's
  count), and another gate passed in 956 s in between. So the suite no longer fits its bound
  reliably on this machine, which is what T6 is for, and T6 cannot land without commits that
  pass. Seen while looking, cause not established: the temporary folder holds 2,357 folders
  left by test runs (1,417 `js-harness-codex-review-*`), which a run stopped at the bound
  never removes; and the processor reported 991 of 1,190 MHz. The gate left
  `Microsoft/Windows/PowerShell/ModuleAnalysisCache` untracked in this worktree, as the
  orchestrator had warned; removed, not committed.

- 2026-10-10 · T1b is commit `6022066`: gate green in 916 s (05:03:00 to 05:18:16), one try, on
  the orchestrator's turn, with no gate or test run alive when it started. The orchestrator
  reports that Sebastián closed Brave and PC Manager a few minutes before (its check, not
  this session's): the first gate of this branch under 950 s. gentle-ai assessed it medium
  risk and due (559 lines, `slice_budget_reached`), reviewed it with one lens (reliability)
  under the consent he pre-granted, approved it, and the approval was acknowledged (lineage
  `review-fc1d8c6ca9190fe9`, authority burned). Five advisory findings, none blocking:
  - `R3-dies-race-real-clock-margin` (warning): the test of five processes that die holding
    the lock runs on real time with a stale time of 1.5 s and a poll of 1 ms. A racer that
    stalls more than 1.5 s on a loaded machine is taken over alive and the test goes red with
    the lock behaving as designed: a false red in a suite that already misses its bound.
  - `R3-invariant-assert-swallowed` (suggestion): the test that proves the empty folder is
    gone throws from inside the file-system tap, and the sweep, the unstage, the release and
    the read of a holder catch everything, so a violation seen there would pass.
  - `R3-sweep-aborts-on-first-error` (suggestion): one `try` around the whole sweep, so one
    entry that cannot be read keeps every dead waiter after it for ever.
  - `R3-busy-stat-reads-as-empty-lock` (suggestion): a holder whose file answers "busy" is
    read as no holder, the take goes blind for a second and then rejects; with T2's plan to
    run without the lock on a rejection, the failure is two gates at once.
  - `R3-retry-busy-ignored-without-recursive` (suggestion, from the reviewer's memory of the
    Node documentation, not run): `rmSync` may ignore `maxRetries` without `recursive`, so
    the retry on a single file would do nothing. Not established either way here: T1c runs it.
  They became T1c. Changed from the plan, with the reason: the Codex review moves after T1c
  and covers T1, T1b and T1c together (`--base 8ef2771`), so it is not paid to find again
  what this review found. Its plan today, nothing spent: 2 parts, 813 changed lines, about
  780,000 to 2,170,000 input tokens. Said to Sebastián: at that rate the 3 million the
  charter allows a feature will likely not cover Codex reviews of T2 to T6 as well; it is
  put to him with the real spend of this one, before any spend past the plan.
- 2026-10-10 · From the orchestrator, the reading another session made of the log of the gate
  that timed out (its claims, checked by neither): `bin/codex-review.test.mjs` alone used
  1,191 s of the 1,200, with tests still owed; tests inside a file run in series and files
  in parallel, so the bound is in effect a bound on that one file. Every gate started from a
  desktop session between 02:40 and 04:42 reached the bound, and the two of another session
  passed (956 s, 1,042 s); why is not known.

- 2026-10-10 · T1c done, route one writer (two non-trivial files), its work read back and one
  of its commands run again by this session. Done: a holder whose file is there and busy is a
  holder (`beatAt: null`, `stale: false`), waited for inside `waitMs` and refused as `held`
  with `--no-wait`, never an empty lock; the sweep is entry by entry; a removal that answers
  busy is tried again by the library itself (6 tries, 20 ms apart, the thread stopped with
  `Atomics.wait`: about 180 ms at worst) at takeover, at release and at unstage; the
  invariant test records what it sees and asserts after the take; the test of processes that
  die runs 3 processes with a stale time of 4 s and a poll of 50 ms. Checked: `node --test
  bin/lib/gate-lock.test.mjs` exits 0 with 35 tests in 14.0 to 14.4 s, four runs (three the
  writer's, one this session's). The red was seen for six new tests by putting the library
  of `6022066` under them (6 of 35 fail, each for its own reason: the take rejected with
  EPERM, the dead waiter left behind, the removal not tried again). The reworked invariant
  test fails against the first version (three runs of three, "the lock folder was empty in
  the middle of a take") and against a library broken inside the sweep's catch-all, where the
  test as committed passed: the reviewer was right that it could be swallowed. The retry of
  `rmSync`, run here (`rm-retry.mjs`, Node 24.15, Windows 10, a file held open with no
  sharing by a PowerShell child, twice): EPERM within a millisecond for every option,
  `maxRetries` 5 or 50, with `recursive` and without, a file or a folder. So the reviewer's
  recollection was half right, and `RETRY_BUSY` never did anything on this machine. With a
  really busy file (`release-busy.mjs`): the library of `6022066` leaves the lock behind at
  once; this one removes it for holds of 66 and 87 ms and gives up after 179 ms on one of 3 s.
  Not checked: no test of the suite uses a really busy file, only those two scripts; a busy
  answer on the listing of the lock folder itself still goes blind and rejects after about a
  second (outside the finding); any system but this Windows machine; the dies test has no
  red, since the stall it guards against cannot be made on purpose. Failed: nothing. Told as
  it was: the writer ran the PowerShell experiment (no tests) while a gate of another session
  was alive, and wrote the library before it could see the new tests fail, for the same
  reason; the red was then shown with the committed library under the new tests.
  Decided here, for T2 and T3 to build on: `readGateHolder` returns `null` only for a free
  lock; a holder that stays busy is never taken over, so a file that can never be read keeps
  each gate waiting to its `waitMs` and then refuses it (a red gate after the wait, not two
  gates at once); a file Windows is still removing costs a waiter one poll, 2 s.

- 2026-10-10 · T1c is commit `a84780f`: gate green in 828 s (05:57:10 to 06:10:58), one try, on
  the orchestrator's turn. gentle-ai assessed it medium risk and not due (367 lines,
  `under_budget`): it stays pending in the slice, and the next assess runs from `6022066`
  with T2's commit. The Codex review of `8ef2771..a84780f` was started at 06:12 (plan: 2
  parts, 977 changed lines, about 940,000 to 2,530,000 input tokens of the 3 million).

- 2026-10-10 · Codex reviewed `8ef2771..a84780f` in 2 parts (06:11:26 to 06:14:55) and the
  review is recorded (`.git/js-harness/codex-reviews.jsonl`). Spent: 310,314 input tokens
  (215,168 cached) and 6,646 output, against an estimate of 940,000 to 2,530,000: a third of
  the low figure. So the 3 million of a feature are not the limit the estimate made them look,
  and there is no budget question to put to Sebastián now; the spend of each later review is
  recorded here and the question comes back only if the sum nears the 3 million. The test
  file: no finding. The library: "the patch is incorrect", three findings, all true, none
  seen by either gentle-ai review:
  - P1, `bin/lib/gate-lock.mjs:284`: T1c made the removal of a stale holder's file try again
    for up to 180 ms when it answers busy, and a busy answer there is likely the holder
    itself touching its file as it comes back to life. The later tries remove a file whose
    beat has moved, and two gates run. The two stale readings only say what was true before
    the removal began. Fix: one try at a takeover; a busy answer goes back to the wait, where
    the next look reads the beat again (what T1b did, undone by T1c for this one call).
  - P2, `:120-121`: a lock folder whose listing answers busy reads as no folder:
    `readGateHolder` says free, and the take goes blind for a second and rejects. The same
    failure T1c closed for a holder's file, left open for the folder (the writer of T1c had
    said so under "not checked").
  - P2, `:343`: `lost()` asks `existsSync`, which says "not there" for a file it could not
    look at, so a gate would be told its lock was taken away when it was not.
  They became T1d. Route, with the reason: T1d is done by the writer of T2 before T2 and
  rides in T2's commit, not in one of its own. A commit costs a gate of 14 to 17 minutes of
  the whole machine and a place in the orchestrator's queue, three sessions share it
  tonight, and nothing calls the lock until T2 does. The price, said: one commit holds two
  units, the lock's fixes and `check`'s use of it.

- 2026-10-10 · T1d and T2 done, route one writer, its work read back and both test files run
  again by this session. Changed lines: 754 added, 54 removed, in four files and this one.
  T1d, in `bin/lib/gate-lock.mjs`: a takeover makes one try at removing the dead holder's
  file, and a busy answer goes back to the wait, where the beat is read again; a lock folder
  that is there and cannot be listed gets the short blind tries and is then a holder of whom
  nothing is known (every field `null`, `stale: false`), waited for inside `waitMs`, refused
  as `held` without a wait, never taken over, and `readGateHolder` returns it at once, so
  `null` still means a free lock; `lost()` asks `statSync` and only "not there" is lost. A
  home that cannot be written still rejects.
  T2, in `bin/check.mjs`: `checkSensors` runs the sensors under the lock when `main` passes
  it one and there is a sensor; no lock with no sensor, with `--push`, or inside a gate
  (`JS_HARNESS_CHECK_INNER=1`, the mark the sensors already had: no new one was needed).
  `--wait <minutes>` (a decimal above zero, an hour by default) and `--no-wait`, which
  together are a usage error. A gate that waits says on stderr, once for each gate it waits
  for: `check: waiting for the gate of <folder> (pid N, started <time>) to finish, for 60
  minutes at most`, or `another gate` when the holder could not be read. Rows named `gate`:
  none when the lock was taken in under a second; INFO `waited 6 s for the machine's gate
  lock before the sensors ran`; FAIL `no sensor ran: <gate> holds the machine's gate lock,
  and --no-wait was given`; FAIL `... still held the machine's gate lock after 30 s (--wait
  bounds the wait at 0.5 minutes)`; INFO when the lock was lost while the sensors ran; INFO
  when it could not be taken at all and the sensors ran without it. Released in a `finally`.
  Checked: `node --test bin/lib/gate-lock.test.mjs` exits 0, 40 tests, 15.3 to 15.6 s (three
  runs); `node --test bin/check.test.mjs` exits 0, 86 tests, 24.9 to 26.6 s (three runs; 73
  tests in 22.4 s before). The red was seen with the committed files put under the new
  tests: 6 of 40 for the lock, each for its own reason, and 13 of 86 for `check`, where the
  log of the end-to-end test read "in one, in two", the overlap itself. That test starts two
  real `check` processes on two folders with one temporary home and shows their sensors one
  after the other and the second naming the first's folder; it runs a copy of `bin/`, since
  from this worktree's own `bin/check.mjs` the board would count the two as gates of this
  worktree. No test can take the lock in the real home: every start of `check` in `bin/` was
  listed with why (the inner mark, `--push`, no sensor, a temporary home), `runCheck` now
  gives a throwaway home when none is named, and `~/.js-harness/gate` did not exist after
  the runs. Not checked: two real worktrees, which no session can run tonight without two
  whole suites side by side (the first real use is this commit's own gate, alone); a real
  Ctrl-C; a lock folder that is really busy, only injected errors; any system but this
  Windows machine. Failed: nothing.
  Decided, for the tasks after: a killed gate leaves its holder's file, taken over about a
  minute after its last beat, and no signal is handled, since a handler would change how
  `check` ends; a lock folder or a holder's file that can never be read costs each gate its
  whole wait and then a red gate; the holder's `cwd` is the resolved folder and its
  `command` is `check`. For T3: `bin/lib/manifest.mjs:23` describes `check`'s flags in the
  skill text and does not name `--wait` or `--no-wait` yet.

- 2026-10-10 · T1d and T2 are commit `7b67b61`: gate green in 869 s (06:58:05 to 07:12:34), one
  try, on the orchestrator's turn. The first real use of the lock, seen: 26 s into the gate
  `~/.js-harness/gate/lock` held one file, `holder-5764-3c5795afd334.json` (this worktree,
  pid 5764, `check`, started 11:58:05Z); after the gate the lock folder was gone and the
  empty folder `gate` was left. No second gate came, so nothing waited. gentle-ai assessed
  `6022066..7b67b61` medium risk and due (1,185 lines, `slice_budget_reached`), the review
  was started under his consent (lineage `review-7084f49729a6d2eb`, one lens, reliability),
  and its first bound status answered `operation_timeout` ("context deadline exceeded", no
  mutation): the gate of `practice-project` had started at 07:13:23, seconds after this
  one ended, and the review's steps were running beside it. Cause: the machine, not
  gentle-ai. Nothing more was started beside that gate.

- 2026-10-10 · The reviews of `6022066..7b67b61`. The bound status of gentle-ai answered in
  5 s once the other gate had ended (07:25), so the timeout was the machine. gentle-ai
  approved (one lens, reliability; lineage `review-7084f49729a6d2eb`, acknowledged, authority
  burned) with five advisory findings:
  - `R3-beat-during-sensors-unproved` (warning): no test shows the holder beating while a
    sensor runs longer than the stale time; every test uses a short sensor, a stand-in lock
    or a moved clock. True. The gate of `7b67b61` held the lock 869 s and nobody took it,
    which is one run and not a test. Taken: T2b.
  - `R3-unlistable-folder-permanent-wait` (warning): a lock folder that can never be listed
    (permissions, not a gate) makes every gate wait its whole hour and go red, blaming a gate
    that does not exist, against the rule that a lock that cannot be taken does not turn a
    gate red. True, and it is the other side of Codex's finding in T1d. Taken, T2b: a lock
    that cannot be read is waited for like a gate only for the stale time; still unreadable
    after it, with nothing ever read, it is the error "can be neither taken nor read", and
    `check` runs without the lock and says so. The same bound for a holder's file that
    stays busy.
  - `R3-wait-message-overstates-remaining` (suggestion): each wait line says the whole bound.
    Taken: T2b.
  - `R3-e2e-shared-60s-margins` (suggestion): the two-process test gives its sensor and its
    own wait the same 60 s, so on a loaded machine it would fail with a message that is not
    what happened. Taken: T2b.
  - `R3-lost-lock-stays-green` (warning): a lock lost while the sensors ran is an INFO row and
    exit 0. Not taken, decided: the lock guards the machine's time and not the project's
    code, the sensors of that commit passed, and a red gate would send a session to fix code
    that has nothing wrong. The row stays, and a reader of exit codes alone does not see it:
    said.
  Codex reviewed `a84780f..7b67b61` in 3 parts (07:28:32 to 07:31:30; T1c already had its
  record): "the patch is correct" for the three, no finding. Spent: 518,154 input tokens
  (359,168 cached). The feature's Codex spend so far: 828,468 of 3 million. Its first try
  refused at once, nothing spent: the record claims a committed range and this document
  had uncommitted lines; the document was set aside with `git stash` for the three minutes
  of the review and put back, a copy kept in the scratchpad meanwhile.
  From the orchestrator, as a proposal for this feature and not yet placed: every gate
  appends one line to a file (start, end, seconds, worktree, result, whom it waited for),
  so "which gates ran" is a file to read; five gates in a row passed on the machine with the
  browser closed (916, 1,038, 828, 843 s and one of another session). It fits T5 and is put
  to Sebastián there, since it is one more file written outside the repository.

- 2026-10-10 · T2b and T3 done, route one writer, its work read back and the five test files
  run again by this session. Changed: 968 lines added, 74 removed, in ten files and this one.
  T2b. The beat is proved: a test runs a real sensor process for 2 s under the real lock on
  the real clock, with a beat of 25 ms and a stale time of 400 ms, and a second taker is
  refused all the while; it passes against `7b67b61` too, so the beat did fire and T2 had no
  defect there, and its control (a gate that does not beat loses its lock and its report
  says so) shows the test can fail. A lock of which nothing can be read is waited for like
  a gate for the stale time only, counted from the first such look and reset by any look
  that reads a beat, another holder or a free lock; past it `takeGateLock` rejects with the
  code `GATE_LOCK_UNREADABLE` and `check` runs without the lock and says so. The wait
  message says what is left of the bound (`for 54 s at most`). The two-process test's
  sensor gives up after 5 minutes against the test's 60 s.
  T3. `readGateWaiters` in the lock's library (a waiter's file now says since when it
  waits). The board keeps the process list and adds the lock: a `check` process that is the
  holder is one gate, running; one that is a waiter is waiting; one that is neither runs
  without the lock and is shown as before; a holder or waiter with no process in the list
  is shown from the lock. `Gates` reads, for a gate that runs, `pid 4242  <folder>
  running, took the gate lock 2m ago  <command>`; for one that waits, `pid 4250  <folder>
  waiting for the gate of pid 4242, began 1m ago`; for a dead holder, `silent: holds the
  gate lock, its last beat was 5m ago and the next gate takes it over`. The watch says
  `gate started in X (pid 6), waiting for the gate in Y (pid 5)` and nothing when that gate
  then takes the lock; `gate started … while another runs …` only for two gates that
  really run at once; a stale holder is not "another". The skill text: a new line for
  `js-harness check` with `--wait <minutes>` and `--no-wait`; the orchestrator's third
  case becomes "two gates run at once (a gate that waits for its turn is not one of them)";
  a work session's line becomes "Your commit's gate waits by itself while another runs:
  `Gates` in `js-harness sessions` says which runs and which wait. Start no whole test run
  of your own beside a gate."
  Checked: `node --test` of `bin/lib/gate-lock.test.mjs` (47 tests, 17.0 to 17.8 s),
  `bin/check.test.mjs` (90 tests, 28.6 and 28.9 s alone; 56.8 s the one time a gate of
  another session started seconds after the look), `bin/lib/sessions.test.mjs` (123, 0.2 s),
  `bin/sessions.test.mjs` (110, 1.6 s), `bin/lib/manifest.test.mjs` (77, 2.7 s), all exit 0.
  The red was seen with the committed files put under the new tests: 6 of 47 for the lock,
  2 of 90 for `check`, 10 of 123 and 5 of 110 for the board, 2 of 77 for the skill text.
  The real board, run once from this worktree with no gate alive: `Gates` says `none
  running`. No test reads or writes the lock in the real home, and `~/.js-harness/gate` was
  still empty after the runs. Not checked: the board with a real gate that holds the lock
  and a real one that waits (the first chance is this commit's own gate); a real
  permission error or a really busy file, only injected ones; any system but this Windows
  machine. Failed: nothing.
  Decided, and known gaps: with a `--wait` shorter than the stale time an unreadable lock
  still ends as the timeout row; the watch compares processes only, and a gate first seen
  while it writes its report rows, after it released the lock, beside a holder, is still
  reported as "while another runs" (a false alarm that needs that exact moment); the live
  holder counts as "another" whatever project it checks; the pid of a holder or waiter whose
  file cannot be read is the one in its token. The suite grew by about 7 s in files that
  run in parallel with the slow one, so the gate's time should not move: this commit's gate
  says.

- 2026-10-10 · T2b and T3 are commit `b1d650b`: gate green in 760 s (08:21:08 to 08:33:48), one
  try, on the orchestrator's turn; the gates of this branch today: 990, 1,085, over 1,200
  (refused), 916, 828, 869, 760 s. The board with a real holder, read once 32 s into that
  gate (the read took 16 s): `pid 24676  D:/js-harness-worktrees/gate-lock  running, took
  the gate lock 32s ago  C:\nvm4w\nodejs\node.exe D:/js-harness-worktrees/gate-lock/bin/
  check.mjs`. A real gate that waits is still not seen: no second gate with the lock exists
  on the machine until this branch is merged.
  Asked by the orchestrator, checked, and true: `uninstall` does not remove
  `~/.js-harness/gate`. It removes what the manifest records and the doctor cache
  (`bin/lib/manifest.mjs:703-757`), and after each gate the folder `gate` stays, empty. That
  is against the rule that whatever the harness writes outside the repository can be undone
  exactly. Taken: T3b.
- 2026-10-10 · The reviews of `7b67b61..b1d650b`. gentle-ai approved (one lens, reliability;
  lineage `review-c33e4a0f32a18334`, acknowledged, authority burned), five advisory findings;
  Codex reviewed it in 3 parts (08:35:11 to 08:41:09), five findings, all P2, and is
  recorded. Spent by Codex: 1,253,094 input tokens (1,037,056 cached). The feature's Codex
  spend: 2,081,562 of 3 million, with T3b, T4 and T6 still to review: it will not fit. That
  is a spend past the plan and his to decide; it is put to Sebastián before the next Codex
  review, with these numbers.
  What they found, nine distinct things, seven about the board:
  - (gentle-ai, warning) a `check` process listed before it has staged its wait folder is
    neither holder nor waiter, so the watch says "started while another runs" beside the
    live holder, and never corrects it;
  - (Codex) a gate that released the lock and still writes its report is remembered as "past
    its sensors" for one look only, then alarms when another gate starts;
  - (Codex) a holder's file left by a dead gate whose pid a new `check` process got: the new
    gate is shown as the dead one, or not at all;
  - (Codex) a gate that waited and then ran without the lock (unreadable lock) is taken for
    one that finished;
  - (Codex) the lock is read against the time the board began, so a slow board reads a dead
    holder as alive;
  - (gentle-ai) a holder nobody could read counts as "another gate" in the alarm;
  - (gentle-ai) a holder with a beat and no start time renders an undefined age;
  - (Codex, the lock) a holder unreadable at the first look is announced as "60 s at most",
    and when it becomes readable the wait goes on to the whole bound with no new notice;
  - (gentle-ai, the lock) an unreadable lock is judged after the timeout, so with `--wait 1`
    or less it still ends as the red timeout row;
  - (gentle-ai) the real-clock beat test has thin margins for a stalled machine.
  Read together, the first four are one mistake of T3: the board guesses, from the process
  list and the lock, which phase each `check` process is in, and every guess has a moment
  where it is wrong. Decided for T3b: it stops guessing. A `check` process whose own folder
  holds `lib/gate-lock.mjs` beside it is a gate that knows the lock: it runs its sensors only
  as the holder (or says in its own row that it ran without the lock), so the board shows
  it from the lock and never alarms for it, whatever it is doing. A `check` process whose
  folder does not hold that file is a gate that does not know the lock, as every gate of
  an older branch is: it is shown and alarmed as before the lock, beside another such gate
  or beside a live holder. Pids are then matched for nothing that decides anything. Not
  taken, with the reason: the watch cannot see a gate that knows the lock and ran without it
  (Codex's fourth); that happens when the lock's folder cannot be read or written, which is
  when no trace could be left either, and the gate's own row says it.

- 2026-10-10 · T3b and T4 done, route one writer (two passes: the second closed a trap the
  first reported), its work read back and the eight test files run again by this session.
  Changed: 1,363 lines added, 227 removed, in 14 files, two new ones and this one.
  T3b. The board no longer guesses a phase. A `check` process whose script has
  `lib/gate-lock.mjs` beside it knows the lock: it is shown from the lock when it holds or
  waits, as `not in its sensors (before or after them)` otherwise, and never alarmed on the
  strength of the process list. A process whose script is not placed on disk by its command
  line (`npm run check` runs a relative path) knows the lock when the lock names its pid,
  and is taken for a gate without the lock otherwise: decided by the writer and accepted,
  with its gap, that such a gate seen before it staged or after it released, beside a live
  holder, still alarms. A gate that does not know the lock is shown and alarmed as before,
  beside another such gate or a live holder. A pid match only attaches a command line, and
  is refused for a process that started after the holder did. The "past its sensors"
  bookkeeping is gone. Also: the lock is read against the clock of that moment and its ages
  are rendered against that same clock; a holder with no start time renders; an unreadable
  lock is judged before the timeout, and only when nothing was ever read in that take; the
  wait notice is said again when a holder turns readable or unreadable; the beat test's
  stale time is over a second. Nothing left on disk: a release removes the folder `gate`
  when it is empty (three interleavings with a waiter that stages, through the injected file
  system), and `uninstall` removes `<home>/.js-harness/gate` unless a live gate holds or
  waits right then, which it says (`kept <path>: a gate holds the machine's gate lock or
  waits for it right now …`, exit 0; a folder it could not remove is said on stderr, exit
  1). It removes it on a home with no manifest too.
  T4. `js-harness gate [--wait <minutes> | --no-wait] [--home <path>] [--cwd <path>] --
  <command> [args...]` (`bin/gate.mjs`): runs the command through the shell in the caller's
  environment, output streamed, no time bound of its own, exit code the command's; waits
  and says so like `check` (one shared function, `takeGateTurn`); exit 75 with one line
  when nothing ran; runs without the lock, saying so, when it cannot be taken; the holder's
  file says `gate -- <command line>`. The trap the writer found and the second pass closed:
  `js-harness gate -- npm run check` waited for the lock its own parent held, up to the
  whole bound. A process that holds the lock now gives its children `JS_HARNESS_GATE_HELD=1`
  (`check` to its sensors, `gate` to its command, and neither when it runs without the
  lock), and a `check` or `gate` started with it takes no lock and runs at once; `check`
  then prints an INFO row saying it ran in the turn of the process that started it, which
  also makes a mark set by hand visible. `JS_HARNESS_CHECK_INNER` means what it meant. The
  skill text names the command and sends a whole test run of one's own through it.
  Checked, by this session after the writer: `node --test` of `bin/lib/gate-lock.test.mjs`
  (55 tests, 18.0 s), `bin/check.test.mjs` (93, 31.1 s), `bin/gate.test.mjs` (18, 4.5 s),
  `bin/lib/sessions.test.mjs` (131, 0.3 s), `bin/sessions.test.mjs` (115, one skipped: this
  machine may not make symlinks; 1.9 s), `bin/lib/manifest.test.mjs` (82, 3.1 s),
  `bin/install.test.mjs` (55, 7.8 s), `bin/js-harness.test.mjs` (23, 6.9 s): all exit 0.
  The writer saw the red of each group with the committed sources put under the new tests
  (it wrote several before it could run them, a gate of another session being alive): 9 of
  130 and 5 of 114 for the board, 11 of 55 for the lock, 2 of 91 for `check`, 7 of 82 and 3
  of 55 for uninstall, the missing module for `gate`, then 4 of 18 and 2 of 93 for the mark.
  An end-to-end test runs a real `check` under a real `gate` in one temporary home and the
  sensor runs with no wait. No test touches the real home: `~/.js-harness/gate` was the
  same empty folder before and after. Not checked: the board, `uninstall` and `gate`
  against the real machine and home (the first real release that removes the folder is this
  commit's own gate); a real gate that waits; the symlink test; any system but this Windows
  machine. Failed: nothing. Told as it was: once the writer ran three short test files
  after one look at the process list instead of one look each.
  Decided, and limits: only the value `1` is the mark; the mark cannot protect against one
  set by hand, a process that outlives the holder that started it, or a holder that lost
  its lock; `gate` handles no signal, like `check`; a `js-harness gate` process is not in
  the board's process listing, so its line comes from the lock alone.

- 2026-10-10 · T3b and T4 are commit `cc5e9f3`: gate green in 767 s (09:35:25 to 09:48:12), one
  try, on the orchestrator's turn. The first real release that removes the folder: after
  the gate `~/.js-harness` held `backups`, `doctor.json`, `manifest.json`, `relief`,
  `remote`, and no `gate`. The gate's own row: medium risk, 17 paths, 2,250 lines, review
  due. Told to the orchestrator, for a session that waits for it: `js-harness gate` can be
  used today from another folder as `node D:/js-harness-worktrees/gate-lock/bin/js-harness.mjs
  gate -- <command>`; it queues with whatever takes the lock and not with a gate of a
  branch without it.
- 2026-10-10 · A cut of context proposed at 70% was withdrawn: his rule of that day, read in
  this session's memory note and not only in the orchestrator's message, is that a session
  does not cut for the percentage; at 85% it pauses, writes its state here, and finishes or
  asks for the compaction.
- 2026-10-10 · gentle-ai refused to review `b1d650b..cc5e9f3`: `lens_context_budget_exceeded`,
  the candidate's evidence (2,250 lines, 17 paths) does not fit its reviewer's context, and
  no review was created. The cause is this session's own choice, twice recorded above, to
  let a task's commit carry the fixes of the task before it so as to pay one gate: the two
  candidates before (1,185 and 1,095 lines) fitted, this one did not. A review has no way
  to take part of a commit, so `cc5e9f3` is split in two along its tasks, nothing changed:
  first T3b (the lock's fixes, the board, uninstall: 10 files, about 1,160 lines), then T4
  (`check`, `gate`, the dispatcher, this document: about 1,090). The old commit is kept as
  the branch `backup/gate-lock-cc5e9f3` until both halves are reviewed. Checked before the
  split: the first half alone, in a throwaway worktree on top of `b1d650b`, passes the seven
  test files that exist there (gate-lock 55, check 90, sessions 131 and 115 with one
  skipped, manifest 82, install 55, dispatcher 22). Its skill text already names
  `js-harness gate`, which only the second half adds. Cost, said: two more gates of about
  13 minutes. The rule taken from it: a commit that will be reviewed stays under about
  1,200 changed lines, and a batch that would pass it is two commits.

- 2026-10-10 · The first half is commit `3659fb5` (T3b): gate green in 833 s (09:53:13 to
  10:07:06), one try; the folder `gate` was gone again after it. Its gate's review row said
  "gentle-ai could not assess": the second half's two new files were untracked, and an
  untracked file nobody declared makes the assessment refuse (what another session found
  with a stray folder). Staged, they are no longer untracked, and the assessment ran:
  medium, 10 paths, 1,164 lines. gentle-ai reviewed `b1d650b..3659fb5` (one lens,
  reliability; lineage `review-2e44f5727ccbf1c6`) and approved it, acknowledged, with three
  advisory findings, kept for the next task that touches those files and not fixed here:
  - `R3-zero-wait-single-look` (warning, `bin/lib/gate-lock.mjs:456`): with a wait of zero
    one unreadable look is already the "unreadable" error. `check` cannot ask for zero
    (`--wait` is above zero), a caller of the library can.
  - `R3-relative-script-alarm` (warning, `bin/lib/sessions.mjs:790`): the gap already
    recorded, a gate run by a relative path (`npm run check`) seen before it stood in
    line still alarms beside a live holder.
  - `R3-in-use-unread-branch-untested` (suggestion, `bin/install.mjs:355`): uninstall's
    message for a live holder of which nothing could be read has no test.

- 2026-10-10 · The second half is commit `1eafe1a` (T4): gate green in 759 s (10:10:25 to
  10:23:04), one try, on this session's own look at the process list; the folder `gate` was
  gone after it. `git diff backup/gate-lock-cc5e9f3 HEAD` shows this document and nothing
  else, so the split changed no code; the backup branch is deleted. gentle-ai reviewed
  `3659fb5..1eafe1a` (1,141 lines, one lens, reliability; lineage `review-217ff1a8afdac875`)
  and approved it, acknowledged, with four advisory findings, kept for the next task that
  touches `bin/gate.mjs` and not fixed here:
  - `R3-real-gate-cwd-realpath` (warning, `bin/gate.test.mjs:395`): a real-process test
    compares the holder's folder with an unresolved temporary path, which fails where the
    temporary folder is behind a symlink (macOS) with the product right.
  - `R3-gate-mark-silent` (suggestion, `bin/gate.mjs:107`): `gate` started with the mark runs
    without the lock and says nothing, where `check` prints a row; a mark left in a shell
    would switch the lock off for later `gate` runs with no trace.
  - `R3-gate-cmd-quoting-percent` (suggestion, `bin/gate.mjs:30`): arguments re-quoted for
    `cmd.exe` still have their percent signs expanded; no test with one.
  - `R3-gate-duplicate-flags` (suggestion, `bin/gate.mjs:49-58`): a flag given twice is
    neither refused nor pinned.
  Owed: the Codex review of `b1d650b..1eafe1a` (its gate's row: no record covers
  `3659fb5^..HEAD`), which waits for the answer to the budget question below. State at 81%
  of this session's window: T1 to T4 done and committed, both gentle-ai reviews of every
  slice acknowledged, nothing in flight, this entry not yet committed.

- 2026-10-10 · Decided by Sebastián ("Sí, hasta 5 millones"): the Codex budget of this feature
  is 5 million input tokens, not 3. What he was told: 2,081,562 spent; the review owed
  (`b1d650b..1eafe1a`, 7 parts) put at 0.7 to 2 million from its plan and what today's
  reviews cost against theirs; T6's still to come. Past 5 million, his again.

- 2026-10-10 · Codex reviewed `b1d650b..1eafe1a` in 7 parts (14:06:24 to 14:16:01) and the review
  is recorded. The first try spent nothing: 7 parts are more than the 6 a run starts without
  `--max-parts`. Its plan put the review at 2,050,000 to 8,450,000 input tokens, not the 0.7
  to 2 million this session had told Sebastián from its own sum, and he was told so before
  it ran; it ran under a guard of this session's (`codex-guarded.cjs`, which adds up each
  part's tokens and kills the run past 2,700,000) so the 5 million could not be passed.
  Spent: 2,446,573 input tokens (1,998,848 cached). The feature's Codex spend: 4,528,135 of
  5 million; 471,865 are left, which will not pay the review of T4b and T6. That is his to
  decide again, with these numbers, before the next Codex review.
  Four findings, all P2, all true on reading:
  - `bin/gate.mjs:30`: several arguments after `--` are escaped for a C runtime and then
    parsed by `cmd.exe`, where a backslash does not escape a quote and `%VAR%` expands
    inside quotes. Codex ran it: `node -e 'console.log("a&b")'` fails, and an argument
    holding `a"&echo UNEXPECTED&rem "` runs a second command. Until T4b, the safe form is
    the whole command as one argument (`gate -- "node evals/runner.mjs --all"`), which is
    handed to the shell as the caller wrote it. (gentle-ai's `R3-gate-cmd-quoting-percent`
    is the same place.)
  - `bin/gate.test.mjs:395`: the same as gentle-ai's realpath finding.
  - `bin/lib/manifest.mjs:801`: `existsSync` says "not there" for a gate folder it could
    not look at, so uninstall reports nothing to remove and exits 0 with the lock's files
    still there.
  - `bin/lib/manifest.mjs:718`: on a home with no manifest whose `.js-harness` can be
    stat'ed and not listed, the parent's cleanup throws and the caller never gets what
    `removeGateFolder` found.
  T4b takes these four and gentle-ai's of the two halves: the zero-wait single look, the
  untested uninstall message, `gate` silent under the mark, a flag given twice. Not taken:
  the alarm for a gate run by a relative path seen before it stood in line (recorded gap).
  State at 85% of this session's window, by his rule: T1 to T4 done, committed and reviewed
  by both reviewers; nothing in flight; this document's last entries are not committed and
  ride in the next commit. The next task does not fit in what is left before the app's own
  compaction (a task with its commit cost 9 to 13 points today), so the compaction is asked
  for here.

- 2026-10-10 · After the compaction: the Engram mirror (observation 3282) is updated from this
  file. Engram keeps about 50,000 characters of an observation and this document is past 62,000,
  so the mirror holds everything up to Progress, the newest Progress entries that fit and Next;
  the older entries are only here, and the mirror says how many.

- 2026-10-10 · T4b, one writer (route: delegated, eight findings over eight files), test first, a
  failing test seen for each finding that could have one:
  - `gate` and `cmd.exe`. Decided here, since quoting cannot do it: on Windows, among several
    arguments, one that holds a double quote, a percent sign, a carriage return or a line feed
    is refused as a usage error (exit 2, before a lock is taken or anything runs), and the
    message says which argument, what it holds and the way out: the whole command as one
    argument after `--`, written as `cmd.exe` reads it. Why refused and not escaped: escaping
    for `cmd.exe` with carets works for a program and not for a `.cmd` shim such as `npm`,
    which reads its arguments a second time, and telling the two apart means reading the shim;
    a refusal is the same for both and the caller never gets another command than the one it
    wrote. Everything else is still wrapped in double quotes, inside which a space and
    `& | < > ^ ( )` are what they are; a real-process test on Windows pins an argument with
    `&` and spaces. One argument, and `sh`, are as they were.
  - `gate`: a flag given twice is a usage error; started under the mark it says on stderr
    that the command runs in the turn of the process that started it (inside a gate it says
    nothing, as the `check` a sensor runs prints no row of the lock).
  - `bin/gate.test.mjs`: every temporary folder is made through `realpathSync` (no failing
    test on this machine: no symlinked temporary folder here).
  - uninstall: a gate folder that could not be looked at is kept as `unremovable` with the
    error's code and no longer reported as not there (`deps.statFile`); a folder that cannot
    be listed or removed is left by `removeEmptyDirsUpTo` and the result is returned
    (`deps.listDir`). The same hole was in its three other callers (`forgetRecord`, `sync`,
    uninstall with a manifest) and is closed there by the same change. The message for a live
    gate of which nothing could be read has its test, and one more says that uninstall exits
    1 and names the folder it could not look at.
  - the lock: with a wait of zero and a first look that read nothing, it looks once more a
    poll later, and the verdict is the second look's.
  Focused runs, each after a look at the process list (the writer waited twice for another
  session's gate): `bin/gate.test.mjs` 21 of 21, `bin/lib/gate-lock.test.mjs` 56 of 56,
  `bin/lib/manifest.test.mjs` 84 of 84, `bin/install.test.mjs` 56 of 56. 351 lines added
  and 36 removed in the eight files. One line of comment in `bin/check.mjs` follows (it said
  only `check` leaves a trace of the mark).
  Seen and left: the installed skill's line for `js-harness gate` and its usage do not say
  the one-argument rule of Windows (the refusal itself says it); uninstall's stderr line for
  a folder it could not look at still says "could not remove ... it is still there"; a zero
  wait whose first look finds the lock free and whose second cannot read its holder still
  ends as a timeout.

- 2026-10-10 · A standing notice from the orchestrator, checked against Sebastián's own words in
  its chat (transcript `182ad401`, line 1112, 2026-10-10T19:55:22Z: he asks that the
  orchestrator and the sessions work more on their own and stop less): this session no longer
  asks for a gate turn. It looks at the process list itself (no `check.mjs`, no `node --test`,
  no gentle-ai or Codex review alive), starts its gate, one try and no retry at the bound,
  and tells the orchestrator in one line when it ends. Work is chained (commit, reviews,
  findings, next task) with no report between; he is asked only for what is his: spend
  outside the plan, a change on a machine, a product choice, what cannot be undone, a change
  of this plan's scope or order, a new protocol, and for now the merge of code.

- 2026-10-10 · T4b is commit `f1419af`: gate green in 885 s (15:09:07 to 15:23:52), one try, started
  on this session's own look at the process list (a first try started nothing: another
  session's review step, then a test run of an eval trial, were alive; each was waited for).
  The folder `gate` was gone after it. Codex's plan for `1eafe1a..f1419af`: 1 part, 389
  changed lines, 440,000 to 2,700,000 input tokens. With 471,865 left of the 5 million that
  review is not started: the question went to Sebastián through the orchestrator (raise the
  cap to 6.5 million and review T4b and T6 as one range at the end, recommended; or keep 5
  million and record the rest as unavailable), and the work goes on without its answer.

- 2026-10-10 · The map T7 needs, made by a read-only explorer while the gate ran (not yet checked
  line by line by this session): what a commit that changes only Markdown can turn red.
  - No test reads this repository's own documents (`AGENTS.md`, `docs/**`, `odd/tasks/*.md`):
    every test of a reader of them works in a temporary folder or with `--cwd`. Searched:
    every use of `import.meta`, `process.cwd()` and `__dirname` in the 61 `*.test.mjs`, and
    every real command a test starts without `--cwd`.
  - Two rows of `check` read them, both static and a matter of milliseconds: `budget`
    (`AGENTS.md` over 1,500 estimated tokens) and `contracts` (`odd/tasks/*.md`).
  - Tracked Markdown that is a fixture, under `evals/`, is read by tests:
    `evals/tasks.test.mjs` (the task folders; three graders pin a document by its hash),
    `evals/review/seeded.test.mjs` and `evals/review/compare.test.mjs` (the seeded
    repository, its `AGENTS.md` and task document included), `evals/runner.test.mjs` and
    `evals/codex-configs.test.mjs` (`evals/fixtures/tasks/sample/task.md`).
  - Nothing the installer ships comes from a tracked `.md`: the skill texts and the
    `AGENTS.md` of `init` are strings in `bin/lib/manifest.mjs` and `bin/lib/project.mjs`.
  - `check` has no notion of changed files today, and there is no `harness.json`: the one
    sensor is `npm run test`, found in `package.json`. `isDocument` of
    `bin/lib/codex-review-scope.mjs` is the one definition of "document" there is.
  So the rule T7 would need: a commit skips the test sensor when every path it changes is
  Markdown outside `evals/`, and `budget` and `contracts` still run.

- 2026-10-10 · gentle-ai reviewed `1eafe1a..f1419af` (medium, 10 paths, 543 lines, one lens,
  reliability; lineage `review-b1587f8e89d78cb6`) and approved it, acknowledged, with two
  suggestions, both about what the tests do not prove. Taken with T6, whose commit is tests
  too:
  - `R3-empty-dir-cleanup-swallow-partly-unproved`: `removeEmptyDirsUpTo` now leaves a
    folder it cannot list or remove, and only the listing that fails, through uninstall, has
    a test; the removal that fails has none, nor do `sync` and `forgetRecord`, which went
    from throwing to leaving the folder.
  - `R3-real-cmd-test-command-position-unproved`: the one real-process proof of the Windows
    quoting runs `node` with quoted arguments after it; a quoted first argument (a command
    whose path has a space) and a command that is a `.cmd` shim are compared as strings
    only, so what the shell makes of them is not proved.

- 2026-10-10 · T5, a run (route: inline, no source written): the whole suite once, on `f1419af`,
  under `js-harness gate` (it waited for another session's gate by this session's look at
  the process list, then ran alone), with a reporter that prints what each file's process
  says of itself (the `test:summary` event of `node --test`: its file and its duration).
  Command: `node bin/js-harness.mjs gate -- "node --test --test-reporter=<per-file reporter>
  --test-reporter-destination=<file>"`. 15:37:47 to 15:52:58, exit 0: 61 files, 2,842 tests,
  2,832 passed, none failed, 10 skipped. The run took 910.3 s; the files' seconds added up
  are 3,942.4, so they ran about four at a time.

  | Seconds | Tests | File |
  |---:|---:|---|
  | 909.7 | 232 | `bin/codex-review.test.mjs` |
  | 458.4 | 163 | `evals/runner.test.mjs` |
  | 450.9 | 94 | `bin/check-codex-reviews.test.mjs` |
  | 381.7 | 122 | `evals/isolation-probe.test.mjs` |
  | 311.2 | 34 | `evals/task-proof.test.mjs` |
  | 194.6 | 79 | `evals/configs.test.mjs` |
  | 144.0 | 139 | `bin/lib/project.test.mjs` |
  | 140.3 | 79 | `evals/suite.test.mjs` |
  | 127.7 | 111 | `bin/remote.test.mjs` |
  | 105.2 | 17 | `bin/lib/codex-review-coverage.test.mjs` |
  | 98.9 | 36 | `evals/review/compare.test.mjs` |
  | 78.8 | 5 | `evals/tasks.test.mjs` |

  The other 49 files take 65 s or less each, 623 s between them.
  What it says: the run is as long as its longest file. `bin/codex-review.test.mjs` starts
  with the run and ends with it (909.7 of 910.3 s), and every other file is done by the
  middle. So the sensor's time is that file's time, and nothing else shortens it until that
  file is under the second one.
  The numbers T6 is judged by: `bin/codex-review.test.mjs` inside a whole run, 909.7 s
  today; the whole run, 910.3 s today. T6 does its work if that file stops being the
  longest, which puts the run near 460 s, the time of `evals/runner.test.mjs` (a file of
  `evals/`, which this feature does not touch) and of `bin/check-codex-reviews.test.mjs`,
  which builds repositories the same way and is the next one to treat, in a feature after
  this one, if the run is to go under that. The file alone, before and after, is timed by
  T6 itself (`Done when`).

- 2026-10-10 · T6, one writer (route: delegated; the file has 5,229 lines), measured before it
  was changed. The file alone, `node --test bin/codex-review.test.mjs` with a preload kept
  outside the repository that times every process the file starts:
  - Before, 16:21:33 to 16:32:14: 640.3 s, 232 tests, all passed. (A first try, 891.6 s,
    ran beside another session's gate and is not a timing.)
  - After, 16:33:01 to 16:41:11: 489.5 s, 233 tests, all passed (the one more is the test of
    the new helper).
  Where the 640 s went: 12,591 git processes take 625.6 s of them, about 45 ms each on this
  machine. The helpers built 250 repositories, 22 distinct (one of them 183 times), with
  2,000 processes: 139.6 s, 22% of the file. The tests' own git, 31.5 s. And the command
  under test, in 546 runs with real git and only Codex faked: 10,008 processes, 455.3 s,
  71%; `git rev-parse` alone is 6,509 of them, 285.2 s.
  What changed: `makeRepoWith` and `makeSlicedRepo` build each distinct repository once
  and hand every test a copy of its own (`copyOf`), with the same commit ids; the sample
  hooks of `git init` are left out of the copies, being half of what there was to copy. No
  test changed. A copy's index holds the dates of the files it was copied from: `git status`
  and `git commit` read it as clean, `git diff-files` does not, and nothing here uses that.
  So T6 did what it said and fell short of what T5 asked of it: the file is 150 s shorter
  and still the longest of the suite (489.5 s alone against 458 s for the second inside a
  whole run, where this file took 1.4 times its time alone). The design's premise, "most of
  its time is fixtures", came from notes and was wrong by a factor of three. What would get
  it under, none of it done:
  - three shards of the same file with no code moved (two small files that import it with
    a shard number): the gate near the second file's time. It is T6b, asked first.
  - `jsonLinesPath` (`bin/lib/codex-reviews.mjs`) asks git for two folders through `gitDirs`
    and uses one: about 2,070 look-ups, some 86 s of this file by arithmetic, and a faster
    `codex-review` for every user. Product code outside this feature's scope: put to him
    as an option, not done.
  - the tests' own `git diff` kept per repository: 20 s at most.
  With it, the two test gaps of the review of T4b: `removeEmptyDirsUpTo` when the removal
  fails, and `sync` and the two `forget` functions when a folder cannot be listed or
  removed (`deps.listDir` now reaches them; with the catch made to rethrow, four tests
  fail); and on Windows, through the real `gate`, a command at a path with a space and a
  `.cmd` that hands `%*` on, with `&`, `( ) ^ | < >`, a backslash at the end and an empty
  argument: all arrived whole.
  And a bug those tests' author found beside them: on Windows a command whose path holds
  `=` or a comma was not found when given as several arguments, since `cmd.exe` splits a
  bare command word there and nowhere else. The command word is now quoted for those two
  marks; later arguments are as they were (`--wait=5` stays bare). Seen failing first, in
  a unit test and through the real `gate`.
  Focused runs, each after a look at the process list: `bin/codex-review.test.mjs` 233 of
  233 (489.5 s), `bin/lib/manifest.test.mjs` 87 of 87, `bin/gate.test.mjs` 25 of 25. 236
  lines added and 17 removed in five files.

- 2026-10-10 · Three questions are with Sebastián, sent through the orchestrator, which relays his
  words with their line; none of them stops the work:
  1. Codex: raise the cap of 5 million (4,528,135 spent) to 6.5 million and review what is
     left as one range at the end (recommended), or record the rest as unavailable.
  2. T7: build it as designed, with the list in hand (no test reads `docs/` or
     `odd/tasks/`; recommended), or leave it out.
  3. T6b: the three shards (recommended), or close with what T6 gave; and whether the change
     to `jsonLinesPath` belongs here.

- 2026-10-10 · T6 is commit `a1d4360`: gate green in 728 s (16:46:31 to 16:58:39), one try, on this
  session's own look at the process list; the folder `gate` was gone after it. The gates
  before it, with the same suite but for T6, took 885 s (`f1419af`) and 910 s (T5's run): T6
  gave about 160 s inside a whole run, as the file's time alone said it would. gentle-ai
  reviewed `f1419af..a1d4360` (medium, 6 paths, 420 lines, one lens, reliability; lineage
  `review-00cc85c18f73e548`) and approved it with no finding; acknowledged. Codex's plan for
  all that it has not reviewed, `1eafe1a..a1d4360`: 2 parts, 770,000 to 4,400,000 input
  tokens; with 471,865 left it waits for his answer.

- 2026-10-10 · T8 begun with what hangs on none of his three answers (route: inline, one
  document): `docs/ROADMAP.md` says, under the gate in the order he asked for, what the lock
  covers, what it does not, what the shorter run gave and what is asked of him and not
  built; the gate on GitHub stays for a later slice. Its commit's gate is one of the two
  gates of the `Done when` that asks for two `check` commands started together: the other
  is a plain `check` in a second worktree of this branch made for it
  (`js-harness-worktrees/gate-lock-demo`, detached at `a1d4360`, removed afterwards), and
  what the two print goes in the next entry.

- 2026-10-10 · Two gates started together, in two worktrees, ran one after the other (the
  `Done when`), and it is the first time a real gate waited for a real gate. On a clean
  process list, a plain `node bin/check.mjs` in `gate-lock-demo` at 17:01:31 and, five
  seconds later, the commit of the roadmap in `gate-lock`, whose hook runs `check`.
  - The commit's `check` printed at once, on stderr:
    `check: waiting for the gate of D:\js-harness-worktrees\gate-lock-demo (pid 23636,
    started 2026-10-10T22:01:32.815Z) to finish, for 60 minutes at most`
  - 45 s in, the lock's folder held `lock\holder-23636-….json` (`cwd` the demo worktree,
    `command` `check`) and `wait-21784-…\holder-21784-….json` (`cwd` this worktree,
    `waitingSince` 22:01:38).
  - The first gate ended green at 17:16:03 (872 s). The second ran its sensors then and
    ended green at 17:28:07; its report has the row `INFO  gate  waited 14 min 25 s for the
    machine's gate lock before the sensors ran`, and its tests took about 12 minutes, as a
    gate alone does. Two gates side by side on this machine used to take over 1,200 s each
    and fail at the bound.
  The roadmap's commit is `c2485cd` (passive for gentle-ai: 2 paths, 63 lines, no review
  due). The demo worktree is removed and the folder `gate` was gone after both.
  Where the feature stands: T1 to T6 done, each commit reviewed by gentle-ai; Codex has
  reviewed up to `1eafe1a` and `f1419af` and `a1d4360` wait for his answer on the budget
  (plan: 2 parts, 634 changed lines, 770,000 to 4,400,000 input tokens; 471,865 left). The
  pre-push hook refuses the branch until a record covers them, so the push and the pull
  request wait for that answer too. Nothing runs.

- 2026-10-10 · Decided by Sebastián, in the orchestrator's chat, where the three questions of this
  session were put to him with one of the orchestrator's own (transcript `182ad401`, line
  1403, 2026-10-11T01:10:48Z, read there by this session with the question before it, line
  1398): "Sí a las cuatro: Codex a 6,5 millones, fusioná vos el código y dá vos el visto
  bueno de las etapas, los commits de solo documentos no corren las pruebas, y acortá el
  gate con las dos cosas". So:
  - The Codex budget of this feature is 6.5 million input tokens: 1,971,865 are left. What
    he had in front of him: the estimate of 770,000 to 4,400,000 for what waited, which
    6.5 covers at its low and middle and not at its top. Past 6.5, his again.
  - T7 is built as designed: a commit whose every path is under `docs/` or `odd/tasks/`
    runs no test sensor, declared in `harness.json`, off by default in any other project;
    the static rows still run.
  - T6b is built, with both things: the three shards, and the change to `jsonLinesPath`,
    which brings `bin/lib/codex-reviews.mjs` (and `bin/lib/project.mjs`, where `gitDirs`
    lives) into this feature's scope.
  - The lead merges code, this pull request included, once its gate passed, both reviews
    are recorded with nothing blocking and it is clean. Updating the machine's command
    stays his.
  The order taken: Codex reviews `1eafe1a..c2485cd` now, so its findings arrive before the
  next code and a record exists for what is written; then T6b, then T7, each with its
  commit, gate and gentle-ai review; then Codex on those two, if what is left pays its
  plan; then the close.

- 2026-10-10 · Codex reviewed `1eafe1a..c2485cd` in 2 parts (20:13:48 to 20:15:32) and the review
  is recorded: no finding in either part ("the patch is correct", confidence 0.87 and
  0.91). Spent: 662,479 input tokens (537,600 cached), under its plan's low figure of
  770,000; it ran under the guard, set to stop past 1,200,000. The feature's Codex spend:
  5,190,614 of 6.5 million; 1,309,386 are left for T6b and T7.

- 2026-10-10 · A mistake, told by the orchestrator at 20:29: T6b's writer ran tests beside a batch
  of evals of another session (`node evals/suite.mjs`, pid 31300, since 20:12:57, about 95
  minutes), whose result compares durations. What happened: the look this session and its
  writers make before a test names `check.mjs`, `node --test` and the two reviewers, and a
  batch of evals is none of them; the writer's short test files from about 20:17 and a
  three-file run of the `codex-review` tests from 20:27:21 ran beside it. Fixed now: the
  run in flight was left to end, the writer starts no test until that batch ends and waits
  on its process, and the look (this session's scripts and the writer's) finds
  `suite.mjs` as it finds `check.mjs`; the other session is told which runs overlapped,
  with their times, to mark its trials. What it says of the lock: that batch ran outside
  `js-harness gate`, and under it this would still have happened, since one test file run
  alone is left free on purpose. A run that needs the machine quiet, and not only its
  turn, is a need the lock does not serve; noted for the roadmap, not designed here. The
  timing of T6b is taken again after the batch.

- 2026-10-10 · T6b, one writer (route: delegated; four files and two new ones), both things he
  approved:
  - `gitDirs` (`bin/lib/project.mjs`) asks git once: `git rev-parse --git-dir
    --git-common-dir` prints the two folders on two lines, each as its flag prints it
    alone (checked at the top of a repository, below it, and in a linked worktree). Seen
    failing first: three of its tests counted two processes. An answer that is not two
    lines (a path with a line break in it) is asked again one flag at a time. In one run of
    the long test file the command under test started 2,161 processes fewer, all of them
    `rev-parse` (10,008 to 7,847). `jsonLinesPath` itself resolves once per call; one
    `codex-review` run still resolves it from several modules, and passing it through them
    is an option not taken.
  - `bin/codex-review.test.mjs` runs as three shards with no test moved: the file itself
    registers every third test, by its place in the file, and
    `bin/codex-review.shard-2.test.mjs` and `bin/codex-review.shard-3.test.mjs`, two lines
    each, import it with `?shard=2` and `?shard=3` to run the others (a query string, so
    nothing is inherited by the processes the tests start). A test of another shard is not
    handed to the runner at all: 78 + 78 + 77 = 233, each name in one shard, checked from
    the TAP output. No test depended on the one before it. Each run says in one line which
    shard it is and how many of the tests are its own; `JS_HARNESS_TEST_SHARD=all` runs
    them all in one process as before, and any other value of it throws. The cost, known:
    the runner reports the wrapper's line as the place of every test of that file, so a
    failed one is found by its name (its assertion's stack keeps the real line).
  Timings, the machine quiet before and after each: the three shards together,
  22:32:28 to 22:36:41, 252.8 s (252.5, 227.6 and 217.2 s), where the file took 489.5 s
  after T6 and 640.3 s before it; all 233 in one process with the `gitDirs` change alone,
  472.4 s; `bin/check-codex-reviews.test.mjs` alone, 176.1 s (451 s inside a whole run
  before; no number alone from before). Two earlier runs of the shards, 303.7 s and
  536.4 s, ran beside an evals batch and beside another session's gate and are not timings.
  Focused runs: `bin/lib/project.test.mjs` 138 of 143 with the same 5 skipped,
  `bin/lib/codex-reviews.test.mjs` 16 of 16, the three shards 233 of 233,
  `bin/check-codex-reviews.test.mjs` 94 of 94, and five other files that reach `gitDirs`,
  all green. 182 lines added and 7 removed in four files, and the two new ones.
  The writer's own runs beside the evals batch, with their times, went to the orchestrator
  for the session that owns it; after the correction it started nothing until that batch
  had ended.

- 2026-10-10 · T6b is commit `b65ea95`: gate green in 833 s (23:21:37 to 23:35:30), one try, after
  waiting on another session's gate. gentle-ai's row: medium, 8 paths, 342 lines, review
  not due yet (under the slice's budget); it is reviewed with the next commit.

- 2026-10-10 · What the shards gave: nothing inside a whole run, and they are removed. A mistake of
  this session's estimate, in four parts.
  - What happened. T5 showed the run as long as its longest file, and from it this session
    told Sebastián that three shards would bring the gate "near 500 s", saying it was
    arithmetic and not measured. He approved them on that. Built, the three shards alone
    take 253 s where the file took 490 s. But the gate with them took 833 s, and the whole
    suite measured again file by file, alone on the machine under `js-harness gate`
    (23:35:54 to 23:48:21), took 747.2 s: 63 files, 2,855 tests, 2,845 passed, none failed.
    The gates of the commit before, without the shards, took 728 s, 872 s and about 724 s.
    The longest file of that run takes 462.4 s (`bin/check-codex-reviews.test.mjs`), the
    three shards 432.3, 369.6 and 358.8 s (1,161 s between them, where they take 697 s when
    only they run), and the files' seconds added up are 3,959.9, as before the shards
    (3,942.4). So the run is no longer as long as one file, and no shorter: this machine
    has four cores (eight logical, so seven files at a time), and the suite is some fifty
    thousand git processes that slow each other down. The shards moved work from the end
    of the run, where one file ran alone and fast, to its crowded start. The bound is the
    work, not its arrangement.
  - The fix now. The shards are taken out in the commit after `b65ea95`: the file is as it
    was at `c2485cd` and the two small files are gone. `git revert` of that commit brings
    them back, should a machine with more cores make them worth their cost (a wrapper whose
    line the runner reports for every test, and a file that alone runs a third). `gitDirs`
    in one process stays: it is less work, 2,161 processes in that file alone.
  - What stops it happening again. An estimate of a run's time is taken from the same kind
    of run it is about: a whole run for the gate, never one file alone. T5's table was a
    whole run and was read as if the files did not slow each other; the sum of the files'
    seconds against the run's own (four and a third at a time on seven slots) said they
    did.
  - Where it enters the harness. What shortens this gate is fewer processes: T6 took out
    about 150 s that way and `gitDirs` some more. The next ones of that kind, measured and
    not done here: `jsonLinesPath` resolved once per `codex-review` run and handed on
    (three modules), the tests' own `git diff` kept per repository, and the same build-once
    fixtures in `bin/check-codex-reviews.test.mjs`, now the longest file. They belong to a
    next slice, with T7 doing the most for the half of the commits that are documents.

- 2026-10-10 · The gate log, placed: one line per gate in a file (start, end, seconds, worktree,
  result, whom it waited for). The orchestrator before this one proposed it and this
  session wrote it down as a thing to put to Sebastián with T5, and did not put it: it was
  left out of the three questions. Two failures of the day (9 and 16 in the orchestrator's
  count) name that log as their proof, "which gates ran beside which" read from a file and
  not from a session's memory; this session's own overlap with the evals batch is a third.
  Decided with the orchestrator: it is the first task of the next slice of the gate, not
  of this one. It is a file that stays on disk after every gate, which the lock is not, so
  it wants a bound on its size and its removal by `uninstall`, and that it writes a
  lasting file outside the repository is put to Sebastián when that slice is planned.

- 2026-10-11 · The shards are out in commit `0fa99cf`: gate green in 817 s (00:04:13 to 00:17:50),
  one try, after waiting on another session's gate. Without the shards the gates read 728,
  872, 724 and 817 s; with them 833 and 747 s: no difference beyond the noise of this
  machine, some 75 s either way.

- 2026-10-11 · T7, one writer (route: delegated), in a worktree of its own
  (`js-harness-worktrees/gate-lock-t7`, removed afterwards) so that nothing was written
  under a running gate; its patch, two files, was applied here. Test first: of 24 new
  tests 14 failed before the code (the 10 that passed are the cases where the sensors run,
  true by construction), 117 of 117 pass after it.
  - The declaration: `harness.json` may hold `"documents"`, an array of paths from the top
    of the repository with forward slashes; one that ends in `/` is a folder, any other is
    one file; no patterns. A wrong shape (not an array, an absolute path, a backslash, a
    `*`, a `.` or `..` or empty segment, so nobody declares the whole repository) is a
    FAIL row `sensors` and no sensor runs. A project without the key is as before.
  - The rule, in `checkSensors`: `check` asks git for the paths of the staged change
    (`git diff --cached --name-only --no-renames --no-relative -z`, in the environment as
    given, so the index git hands a hook for `git commit <path>` or `-a` is the one read;
    with renames off a file moved into or out of the documents counts on both sides). With
    at least one staged path and every one of them a declared document, no sensor runs, no
    gate lock is taken, and the report says so:
    `INFO  sensors  no sensor ran (tests): all 2 staged paths are documents declared in
    harness.json "documents"`, with the paths under it (ten at most, then a count).
    In every other case the sensors run as before: nothing staged (a `check` by hand), any
    path outside the list, no key, no repository, git missing or failing, a `check` run
    from a folder below the top. The static rows run either way: a contract broken by a
    commit of documents still fails it (tested).
  - This repository opts in: `harness.json` at its top with `docs/` and `odd/tasks/`.
    Decided here, on what the writer found and would not decide: any `harness.json` makes
    `status`, `sync`, `init`, `uninstall` and the TUI read the repository as a project
    with a file and no pin, where today they say "not an initialized project"; all five are
    run by hand and none of them here, where the harness is built and not installed.
    `doctor`, its session-start hook, the board and `check` do not read the pin, and
    `check` still finds the `tests` sensor in `package.json`. The other ways (a pin, which
    would make this repository an installed project; `init` taught to keep the keys of a
    file without a pin; a second place for the declaration in `package.json`) each cost
    more than those five messages. Deleting the file undoes it.
  - Known and left: the gate reads `harness.json` from the working tree, as it does for
    `sensors`, so an unstaged edit of `documents` changes what a commit's gate skips; a
    `git commit --amend` with only documents staged skips, the commit it amends having
    paid its own gate.
  620 lines added and 13 removed in `bin/check.mjs` (126) and `bin/check.test.mjs` (507).

- 2026-10-11 · T7 is commit `74e473c`: gate green in 671 s (00:24:02 to 00:35:14), one try. gentle-ai
  reviewed `c2485cd..74e473c` (T6b, the shards out, T7: medium, 8 paths, 1,032 lines, one
  lens, reliability; lineage `review-0002df5395050d7a`) and approved it, acknowledged, with
  two findings, both fixed in the next commit by T7's writer, test first:
  - `R3-hook-test-assumes-no-gentle-ai-beside-git` (warning): the test through a real hook
    read the review row "gentle-ai was not found", which is false wherever gentle-ai sits
    in git's own folder. It now asserts the rule alone: the row, the marker, what each
    commit holds.
  - `R3-staged-git-inherits-hook-repository-binding` (suggestion, and a real hole): a
    `check --cwd <another project>` started inside a hook read the staged paths of the
    hook's repository, through the `GIT_DIR` and `GIT_INDEX_FILE` git hands a hook, and
    judged them by the other project's documents. Seen failing: project A's sensors
    skipped for repository B's staged document. Now what the environment binds git to is
    trusted only for the gate's own repository: with any of `GIT_DIR`, `GIT_INDEX_FILE`,
    `GIT_WORK_TREE` set, the git folder `cwd` has without them must be the one it has with
    them, and the index named must lie in it; else the sensors run. One more git process
    for a commit of a project that declares documents. Found with it: git sets `GIT_DIR`
    for a hook in a linked worktree, and with it set a folder below the top reads as the
    top, so that guard is now asked without the binding. A commit of documents in a linked
    worktree, which is what every session here works in, is tested through a real hook.
  `bin/check.test.mjs`: 120 of 120. 216 lines added and 37 removed in the two files.

- 2026-10-11 · The two fixes are commit `58fce26`: gate green in 814 s (00:45:42 to 00:59:16), one
  try (gentle-ai's row: medium, 3 paths, 293 lines, not due yet). Codex reviewed
  `c2485cd..58fce26` in 3 parts (00:59:31 to 01:02:59) and the review is recorded. Spent:
  695,746 input tokens (539,648 cached), against a plan of 670,000 to 3,060,000, under the
  guard set to 1,000,000. The feature's Codex spend: 5,886,360 of 6.5 million; 613,640 left.
  Parts 2 and 3: no finding. Part 1, one finding, P2, true on reading:
  - `bin/check.mjs:254`: `git diff --cached --name-only` leaves out a staged change of a
    submodule when git is set to ignore submodules (`diff.ignoreSubmodules`, or `ignore`
    in `.gitmodules`), so a commit of a document and a submodule's new commit reads as
    documents alone and its sensors are skipped. The fix is `--ignore-submodules=none` on
    that call, with a test first: a gitlink staged beside a document, under
    `diff.ignoreSubmodules=all`, and the sensors must run. Not done yet.
  State at 85% of this session's window, by his rule: everything is committed but this
  entry, which goes in a commit of documents alone, the first of this repository to run
  no sensor; nothing runs. What is left does not fit before the app's own compaction, so
  the compaction is asked for here.

## Next
After the compaction, in this order, nothing of it started:
1. The Codex finding above: one writer or inline (two files, `bin/check.mjs` and
   `bin/check.test.mjs`), test first; its commit and gate (code, so the sensors run).
2. Codex on that one commit (`codex-review --base 58fce26`): its plan first; 613,640 are
   left, and if the plan's low figure is over that it is a question of spend, his. Under
   the guard (`codex-run.ps1`, which looks at the process list, sets this document aside
   and puts it back). gentle-ai: `review assess --base-ref 74e473c --committed-only` and
   what it asks for.
3. The close: `git fetch`, `origin/main` merged in (`1d0a732` on 2026-10-11 merged with no
   conflict), one gate run on the result by hand (`node bin/js-harness.mjs gate --
   "npm run check"` or `npm run check` after a look at the process list), since a merge
   runs no pre-commit hook; T8 checked off; this document's last entries in a commit of
   documents alone; push; pull request (its text: what the lock covers and does not, the
   numbers, the shards tried and removed, the two things left for the next slice); the
   closing notice to the orchestrator, which merges. The session channel waits for that
   merge. Updating the machine's `js-harness` command stays his.
For the next slice of the gate, in this order: the gate log; fewer git processes in the
two long test files; the gate on GitHub. A run that needs the machine quiet, and not only
its turn (an evals batch that compares durations), is a need the lock does not serve.
Rules learnt, to keep: a commit that will be reviewed stays under about 1,200 changed
lines; nothing untracked when a review is assessed; a Codex review wants a clean tree
(set this document aside with `git stash`, one stash, popped by the same command); no
review step beside a running gate; a timing is one only with the process list empty
before and after it; the look finds `evals/suite.mjs` too; a gate's time is estimated
from whole runs; a writer works in a worktree of its own while a gate runs here.
The scripts of this session are in its scratchpad (`commit-after.ps1`, `codex-run.ps1`,
`review-open.cjs`, `review-capture.cjs`, `mirror-fit.cjs`); gates since T4b, in seconds:
885, 728, 872, 724, 833, 817, 671, 814.

Standing rule, before any test or commit: no private wait script. One look at the process list for
   `check.mjs`, `node --test` or `evals/suite.mjs`; if one is alive, wait on that process itself and look again,
   and start nothing beside it (the two mistakes above). A gate that reaches the bound is said
   and not retried, and the orchestrator is told in one line when a gate ends.

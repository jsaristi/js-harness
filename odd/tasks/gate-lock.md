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
- [ ] T3 · The board reads the lock: `Gates` shows who runs and who waits; the watch stops
      reporting a waiting gate; the skill line reworded.
- [ ] T4 · `js-harness gate -- <command>`.
- [ ] T5 · Measure the suite per file; record it here; set the numbers T6 is judged by.
- [ ] T6 · Fixtures of `bin/codex-review.test.mjs` built once and copied; timed before and
      after.
- [ ] T7 · Document-only commits skip the sensors, declared in `harness.json` (asked first).
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

## Next
T1d and T2 are written and staged with these records: their one commit goes on the
orchestrator's turn, message `feat(check): run the sensors of one gate at a time on the
machine`. One look at the process list first; a gate that reaches the bound is said and
not retried. It is the first gate that takes the real lock (`~/.js-harness/gate`).

After it: record the commit; `gentle-ai review assess --base-ref 6022066 --committed-only`
(T1c, T1d and T2 together) and what it returns; then the Codex review of the same range,
`js-harness codex-review --base 6022066`, its spend recorded. Then T3.

Standing rule, before any test or commit: no private wait script. One look at the process list for
   `check.mjs` or `node --test`; if one is alive, wait on that process itself and look again,
   and start nothing beside it (the two mistakes above). A gate starts only on the
   orchestrator's turn, and one that reaches the bound is said and not retried.

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
- [ ] T2 · `check` takes it around the sensors: the wait message, `--no-wait`, `--wait`, the
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

## Next
This session cuts its context now, at 72% measured, with T1b staged and not committed. That
is inside a task by the letter of the roadmap's rule (a task ends with its commit), and it is
said to him as such: what is left of T1b is one step, blocked from outside, and everything
it needs is in these files; waiting for it in a full window costs a whole read of it at
every wake.

After the cut, first: commit T1b when the orchestrator gives the turn. The three files are
staged; the commit message is in this session's scratchpad (`msg-t1b.txt`) and, if that is
gone, is the entry "T1b done" above put as `fix(gate-lock): take the lock in one step, so two
gates cannot both hold it`. Before it, one look at the process list for `check.mjs` or
`node --test`, and nothing started if one is alive. If the gate reaches the bound again, say
so and do not retry.

Then, in this order:
1. Record T1b's commit here. Run `gentle-ai review assess --base-ref c623c4c --committed-only`
   on it and follow what it returns; then the Codex review of T1 and T1b together:
   `js-harness codex-review --base 8ef2771` (its plan first, `--plan`).
2. T2, one writer: `check` takes the lock around the sensors. Decided for it: the lock wraps
   the sensors only, and only when there is a sensor to run; a second gate says on stderr
   whose gate it waits for; `--no-wait` and `--wait <minutes>` (default 60); rows named `gate`
   (INFO with the time waited, FAIL when refused or timed out, INFO when the lock was lost
   while it ran); a lock that cannot be taken at all (`takeGateLock` rejects: a home that
   cannot be written) must not turn a gate red: it runs without the lock and says so in a
   row; the sensors' environment gets a mark that a gate holds the lock, so a `check` run
   by the suite takes none, and every test that runs `main` with real sensors passes a
   temporary home (they pass `JS_HARNESS_HOME: dir` today, `bin/check.test.mjs:588-634`); an
   end-to-end test starts two real `check` processes on two folders and shows their sensors
   one after the other.
3. Before any test or commit: no private wait script. Wait on the running gate's process
   itself, read the board once, and start nothing if it shows a gate (the two mistakes above). A lock that cannot be taken at all (a home that cannot be written) must not turn a gate
red: it runs without the lock and says so in a row.

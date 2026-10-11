# The gate: a turn by arrival, a stop before the sensors, and two findings of a gate

Locator: `odd/tasks/gate-turn.md` · Engram mirror: `odd/gate-turn/tasks` · Branch:
`feat/gate-turn`, in the linked worktree `D:\js-harness-worktrees\gate-turn`, cut from `main`
at `b016699` · Session: `JH 8 · turno y corte temprano del gate`, orchestrator
`JH ORQ · js-harness`

State 2026-10-11: opened by the orchestrator's prompt, pasted by Sebastián. His words that
open it are in the orchestrator's relief file, line 254, and in the transcript that line cites
(`130317af-a818-419c-a3de-3a21335db0a8.jsonl`; this session searched it for "Continua que me
voy a ausentar unas horas" and found it). He is away: nothing is asked of him; what is his goes
to the orchestrator in one line. The design below is this session's and is read by a reader
that did not write it before anything is built on it; Progress says what the reader changed.

## Goal
A gate that waits takes its turn in the order it arrived and says which session it belongs to,
a gate whose static rows already fail stops before it waits for the lock or runs a sensor, and
the two things another session's gate tripped on (a test that depends on the machine's load,
a PowerShell cache written into the working tree) are gone.

## Why
- The lock is not a line. On 2026-10-11 a commit waited from 13:42 to 14:42 and ended its wait
  without the turn, while gates that arrived at 14:04 and 14:14 ran (relief file, lines 227,
  250 and 252: three sightings, one hour lost). The cause is in the code: every gate that
  waits tries the rename at each poll, and a gate that has just arrived tries it before it
  looks at who waits (`bin/lib/gate-lock.mjs:397-401`); `waitingSince` only sorts the display
  (`bin/lib/gate-lock.mjs:256-258`). So a wait is not bounded by what was ahead of it.
- A static row that fails is printed after the sensors. `main` collects every row into one
  list and prints nothing until the end (`bin/check.mjs:962-995`), so a budget or a contract
  that was known to fail in a second costs the wait for the lock and about seventeen minutes
  of sensors before anyone reads it. The rows `failures` and `rules` that the session "JH 7"
  builds refuse a stale phrase anywhere in force; without the stop, one that reaches `main` by
  a clean merge costs the next committer a whole gate. The rule-change protocol he approved on
  2026-10-11 names this stop as its prerequisite (relief file, line 253, sections D and E and
  "ORDER"; approved in line 254). The stop itself is the orchestrator's derivation, not a
  sentence of his (`odd/tasks/gate-log.md` on `feat/gate-log-file`, from its line 843).
- A gate of 2026-10-11 failed on one test of 3,281 that its change did not touch
  (`evals/suite.test.mjs:748`, `alive` read `false,true` against `false,false`, with 4.7 of 8
  processors busy), and paid a second gate for it. The same run left an untracked folder
  `Microsoft/Windows/PowerShell/ModuleAnalysisCache` in the working tree (relief file, line
  250). One is still on disk: `D:\js-harness-worktrees\session-board\Microsoft\...`, dated
  2026-10-10.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/gate-turn.md` exits 0
- `node --test bin/lib/gate-lock.test.mjs` exits 0
- `node --test bin/check.test.mjs bin/gate.test.mjs` exits 0
- `node --test bin/lib/gate-log.test.mjs` exits 0
- `node --test evals/runner.test.mjs` exits 0
- A test plants a gate that arrives while an older one waits and the lock is free, and the
  older one takes the lock (the sighting of line 227, as a test)
- A real gate with a failing static row, on this machine, quoted in Progress: it ends in
  seconds, names the row that stopped it, says that no sensor ran, and leaves no lock folder
- A real gate on this machine leaves no `Microsoft` folder in its working tree, quoted in
  Progress
- `docs/ROADMAP.md` says that the lock is a line, what a waiting gate records, and that a
  gate stops before its sensors

## In scope / Out of scope
- In: `bin/lib/gate-lock.mjs` and its test (the line, the session, the bound of a wait);
  `bin/check.mjs`, `bin/gate.mjs`, `bin/lib/gate-log.mjs` and their tests (the stop, its line
  in the gate log, the words a waiting gate prints, the PowerShell cache), only after the
  orchestrator says that `feat/gate-git-processes` and `feat/gate-log-file` are on `main`;
  `evals/runner.mjs` and its test, or `evals/suite.test.mjs`, for the load-dependent test;
  `bin/lib/sessions.mjs` and its test for the session's name beside a waiting gate, only after
  the two branches of "JH 5" that change it are on `main`; `docs/ROADMAP.md`; this document.
- Out: the rows `failures` and `rules` themselves, which are "JH 7"'s: this feature gives
  them the place they stand in. The merge command of section E of the protocol. The gate on
  GitHub: his to start. Waiting for a quiet machine. The 1,200 s bound of a sensor.
  `AGENTS.md`: at its budget, and nothing here needs a line of it. The installed command on
  his machine: updating it is his.

## Constraints
- No code in a file that `feat/gate-git-processes` or `feat/gate-log-file` changes until the
  orchestrator says both are on `main`, because the stop changes the same functions of
  `bin/check.mjs` that the second one rewrites (`git diff --name-only main...<branch>`, read
  2026-10-11: `bin/check.mjs`, `bin/check.test.mjs`, `bin/gate.mjs`, `bin/gate.test.mjs`,
  `bin/install.mjs`, `bin/js-harness.mjs`, `bin/lib/gate-log.mjs`, `bin/lib/manifest.mjs`,
  `scripts/practice*.mjs`, their tests, and the codex-review files of the first). Free today:
  `bin/lib/gate-lock.mjs`, `evals/runner.mjs`. `bin/lib/sessions.mjs` is changed by
  `feat/session-board-channel` and `feat/session-context`; `evals/suite.test.mjs` by
  `feat/codex-parity`.
- Only the rename grants the lock, as today, because that is what makes two holders
  impossible; the line decides who may try it and nothing else. A fault in the line may cost
  order, never exclusion.
- One gate at a time on the machine: a test run of this session goes through the lock, and
  no test, board read or reviewer runs beside a gate.
- Zero dependencies and every operating system, because `check` ships to any project.
- A behavior change arrives with its test, written first.

## Effort
high

## Ask me before
- Nothing of his is open. The installed `js-harness` command takes the line only when it is
  updated on his machine, which is his; the orchestrator is told when a slice that changes it
  is on `main`.

## Design

### 1. The lock is a line

What is on disk already: a gate that waits keeps a folder `gate/wait-<token>` whose file says
`waitingSince`, and touches it at every poll; a folder nothing touched for the stale time is
a dead gate's (`readGateWaiters`). So the line exists and is displayed; nothing obeys it.

The rule added: **a gate tries the rename only when no live gate that arrived before it
waits.**
- Arrival is `waitingSince`, set once when the take begins; ties are broken by the token, so
  two gates compute the same order.
- At each turn of its loop a gate first makes or touches its own folder, so it is seen, and
  then reads the line. With a gate ahead, it does not try the rename: it looks at the lock
  as today (a holder to wait for, a dead holder cleared on its second stale reading) and
  sleeps one poll. With a free lock and a gate ahead it does nothing and sleeps one poll: the
  turn is that gate's, which takes it at its next poll, two seconds away at most.
- A gate that is ahead and dies stops touching its folder and is left out after the stale
  time, sixty seconds, as `readGateWaiters` already leaves it out. That is the longest a free
  lock waits for a dead gate.
- A gate whose file cannot be read at one look keeps the arrival read at an earlier look; one
  never read counts as ahead. A gate that waits and is not at the head only touches its file
  and does not write it again, so the file of a gate ahead is rewritten only by the head.
- With `wait` off, a gate ahead is a refusal, `'held'`, as a holder is: taking the lock would
  pass it. The refusal and `onWait` name the holder when there is one, and otherwise the gate
  at the head of the line, in the holder's shape with `waiting: true`. `onWait` gets a third
  argument, `{ ahead }`, the number of gates before this one, holder included.
- What stays as it is: the rename, the beat, the stale takeover, the unreadable lock, the
  release. Exclusion does not depend on the line: two gates that both think they are first
  (they staged in the same instant, or one could not read the other) both try the rename and
  one of them gets it.

The session: the file of a gate gains `session`, the host's session id
(`CLAUDE_CODE_SESSION_ID`, which the other commands read: `bin/sessions.mjs:314`,
`bin/lib/channel.mjs:345`; read in this session's shell on 2026-10-11, it is set), or `null`
where the host gives none (Codex). `takeGateLock` takes it as an option that defaults to the
environment, as `pid` defaults to the process, so no caller changes. `readGateWaiters` and
`readGateHolder` return it. The board shows the session's title beside each gate in a later
task, when `bin/lib/sessions.mjs` is free; until then the worktree names it, as today.

The bound of a wait: sixty minutes today, counted from arrival. In a line of gates of about
fourteen minutes each (`odd/tasks/gate-lock.md:1294`), the fifth to arrive reaches the bound
while the line moves, and a gate refused for it goes back to the end: the hour lost again, by
another road. So **the bound counts from the last time the line moved** for this gate: the
holder changed, or fewer gates are ahead. A line that does not move for sixty minutes still
refuses. `waitedMs` stays the whole wait. No bound on the whole wait is added: every holder is
bounded by its own sensors.

Old and new gates together: a branch that has not merged this still tries the rename at every
poll and may pass a new gate, which is no worse for the old ones than today and worse for the
new ones until every worktree has merged `main`. The orchestrator is told at the merge.

Rejected: a ticket number in a shared counter file (a second thing to lock); asking the
system whether a waiter's pid is alive (the lock judges life by the beat everywhere, and a pid
is reused); a release that hands the lock to the next gate by name (a dead heir holds
everybody).

### 2. The gate stops before its sensors

`main` of `bin/check.mjs` computes the static rows first (`budget`, `contracts`, `payload`,
and the rows `rules` and `failures` when they exist, those two first in the list), all of
them, since together they cost about a second and one run should name every one that fails.
- When one of them fails, in the sense that already decides the exit code, nothing else
  runs: no wait for the lock, no `load`, no sensor, no `review`, no Codex debt. The rows are
  printed, then one row that is not a pass and not a sensor's failure: the gate stopped, no
  sensor ran, and which rows stopped it. The exit code is 1, as it would have been.
- A row that could not be computed, which is an information row today, stops nothing.
- The lock in its three states: free, it is not taken and no folder is made; held by another
  gate, it is not waited for; held by the parent (`js-harness gate -- npm run check`), it is
  left to the parent.
- `check --push` and an inner check (`JS_HARNESS_CHECK_INNER=1`) are unchanged.
- The gate log of `feat/gate-log-file` knows `start`, `end` and `refused`. A stopped gate
  writes one line of a fourth kind, `stopped`, with the rows that stopped it, and no `start`:
  a start without an end reads as a killed gate. The count of `stopped` lines is the measure
  of what the stop saves.
- What a commit proves does not change: a failing static row failed the gate before, too.

### 3. The two findings

The test that depends on the load (`evals/suite.test.mjs:716-752`): it records whether the
fake agent and its grandchild are alive at the instant `proc.exit` is called, and asserts
`false, false`; a later line gives them five seconds to stay dead. The failure read
`false, true`: the grandchild was still alive at the exit. Ending a process on Windows is
asked for and happens a moment later, longer under load. First, the cause is established
with a test that does not need a loaded machine (a kill that returns before its process is
gone). If the runner goes on to its cleanup and exit without having seen the tree dead, the
fix is the runner's: it waits, with a bound, until what it killed is gone, because "an
interrupt leaves nothing" is the product's promise and the test is right to ask it. Only if
the runner cannot know the grandchild does the test change, to give the exit instant the same
bounded wait as the later line. `evals/runner.mjs` is free; `evals/suite.test.mjs` is changed
by `feat/codex-parity`, so a change there is one line and said to the orchestrator.

The PowerShell cache: the gate runs each sensor with `HOME` and `USERPROFILE` moved to an
empty temporary home (`bin/check.mjs:408-411`). Windows PowerShell then finds no local
application data folder and writes its module analysis cache to a path relative to the
working folder. No single test file leaves the folder; the gate does
(`odd/tasks/evals.md:1296-1299`). The fix is the one `odd/tasks/session-board.md:850-851`
proposed: the sensor's environment sets `PSModuleAnalysisCachePath` to a file inside the
temporary home, removed with it. The test, first: PowerShell started with the sensor's
environment in an empty folder leaves that folder empty (skipped off Windows). The mechanism
is an inference until that test is red.

## Tasks
- [ ] T1 · Design read by a reader that did not write it; what it changed is in Progress.
      Route: one read-only reader.
- [ ] T2 · The line in `bin/lib/gate-lock.mjs`: the rule, the refusal with `wait` off, the
      third argument of `onWait`. Test first, with the sighting of line 227 planted. Route:
      one writer (two files, concurrency).
- [ ] T3 · The session in the file of a gate, returned by the two readers. Route: with T2.
- [ ] T4 · The bound of a wait counts from the last time the line moved. Route: with T2.
- [ ] T5 · The load-dependent test: the cause with a test that needs no load, then the fix.
      Route: one writer, after a read of `evals/runner.mjs:230-340`.
- [ ] T6 · Blocked on the two branches of "JH 6": the stop in `bin/check.mjs`, its `stopped`
      line in the gate log, the three states of the lock. Test first.
- [ ] T7 · Blocked on the same: the words a waiting gate prints name how many are ahead
      (`bin/check.mjs`, `bin/gate.mjs`).
- [ ] T8 · Blocked on the same: `PSModuleAnalysisCachePath` in the sensor's environment.
- [ ] T9 · Blocked on the two branches of "JH 5": the session's title beside each gate that
      waits, on the board.
- [ ] T10 · `docs/ROADMAP.md`; the pointer in "Next" of `odd/tasks/gate-lock.md`.
- [ ] T11 · Close: both reviews of each slice with code, push, pull requests, the closing
      notice.

Slices: S1 is T2 to T4 (one module and its test, free today, useful to every branch as soon
as it is on `main`); S2 is T5; S3 is T6 to T8, after the merges; S4 is T9.

## Progress
- 2026-10-11 · Opened. Read: `AGENTS.md`, the brief, relief lines 227 and 250 to 254, "Next"
  of `odd/tasks/gate-lock.md`, `bin/lib/gate-lock.mjs:20-75` and `:225-514`,
  `evals/suite.test.mjs:625-640` and `:700-752`. A read-only explorer mapped `bin/check.mjs`,
  the lock and the two findings on `main` and on `feat/gate-log-file` (168,928 tokens);
  spot-checked here: the rename before any look at the line (`bin/lib/gate-lock.mjs:397-401`)
  and the test's line 748. `docs/ROADMAP.md` names none of the three pieces (searched for
  "early stop", "order of arrival", "not a line", "ModuleAnalysisCache", "suite.test.mjs": no
  line).

## Next
T1: the reader. Then S1, through the lock for every test run.

# The gate: a turn by arrival, a stop before the sensors, and two findings of a gate

Locator: `odd/tasks/gate-turn.md` · Engram mirror: `odd/gate-turn/tasks` · Branch:
`feat/gate-turn`, in the linked worktree `D:\js-harness-worktrees\gate-turn`, cut from `main`
at `b016699` · Session: `JH 8 · turno y corte temprano del gate`, orchestrator
`JH ORQ · js-harness`

State 2026-10-11: opened by the orchestrator's prompt, pasted by Sebastián. His words that
open it are in the orchestrator's relief file, line 254, and in the transcript that line cites
(`130317af-a818-419c-a3de-3a21335db0a8.jsonl`; this session searched it for "Continua que me
voy a ausentar unas horas" and found it). He is away: nothing is asked of him; what is his goes
to the orchestrator in one line. The design below is this session's, second version: a reader
that did not write it attacked the first (`4623c95`) and looked for what it left out, and
"What the reader changed" says what moved.

## Goal
A gate that waits takes its turn in the order it arrived and says which session it belongs to,
a gate whose static rows already fail stops before it waits for the lock or runs a sensor, and
the two things another session's gate tripped on (a test that fails on a busy machine, a
PowerShell cache written into the working tree) are gone.

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
  processors busy), and paid a second gate for it. The same test failed the same way on
  2026-10-02 (transcript `709faa68-ff23-4ec9-a56c-910448733ff1.jsonl`, then at line 730). The
  run of 2026-10-11 also left an untracked folder
  `Microsoft/Windows/PowerShell/ModuleAnalysisCache` in the working tree (relief file, line
  250). One is still on disk: `D:\js-harness-worktrees\session-board\Microsoft\...`, dated
  2026-10-10.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/gate-turn.md` exits 0
- `node --test bin/lib/gate-lock.test.mjs` exits 0
- `node --test bin/check.test.mjs bin/gate.test.mjs` exits 0
- `node --test bin/lib/gate-log.test.mjs` exits 0
- `node --test evals/suite.test.mjs` exits 0
- Tests of the lock, named in Progress when they pass: a gate that arrives while an older one
  waits and the lock is free does not take it, and the older one does (the sighting of line
  227); a gate ahead that dies is passed after the stale time; a line that cannot be read
  never makes a take reject; a gate that sees a waiter of an older version behaves as today;
  with `wait` off a gate ahead is a refusal that says it waits and does not hold
- A real gate with a failing static row, on this machine, quoted in Progress: it ends in
  seconds, names the row that stopped it, says that no sensor ran, and leaves no lock folder
- The gate says which untracked paths its sensors left in the working tree, and a real gate
  on this machine says none, quoted in Progress
- `docs/ROADMAP.md` says that the lock is a line, what a waiting gate records, and that a
  gate stops before its sensors

## In scope / Out of scope
- In: `bin/lib/gate-lock.mjs`, `bin/check.mjs`, `bin/gate.mjs`, `bin/lib/gate-log.mjs` and
  their tests, and the text of `bin/lib/manifest.mjs` that says how a gate waits, all of them
  only after the orchestrator says that `feat/gate-git-processes` and `feat/gate-log-file`
  are on `main`; `evals/suite.test.mjs`, `evals/runner.mjs`, `bin/lib/process-tree.mjs` and
  their tests for the test that fails on a busy machine; `bin/lib/sessions.mjs` and its test
  for the session's title beside a waiting gate, only after the two branches of "JH 5" that
  change it are on `main`; `docs/ROADMAP.md`; this document.
- Out: the rows `failures` and `rules` themselves, which are "JH 7"'s: this feature gives
  them the place they stand in. The merge command of section E of the protocol. The gate on
  GitHub: his to start. Waiting for a quiet machine. The 1,200 s bound of a sensor. The bound
  of a wait and what `--wait` means (see "Not taken"). `AGENTS.md`: at its budget, and
  nothing here needs a line of it. The installed command on his machine: updating it is his.

## Constraints
- No code in a file that `feat/gate-git-processes` or `feat/gate-log-file` changes until the
  orchestrator says both are on `main`, because the stop changes the same functions of
  `bin/check.mjs` that the second one rewrites (`git diff --name-only main...<branch>`, read
  2026-10-11: `bin/check.mjs`, `bin/check.test.mjs`, `bin/gate.mjs`, `bin/gate.test.mjs`,
  `bin/install.mjs`, `bin/js-harness.mjs`, `bin/lib/gate-log.mjs`, `bin/lib/manifest.mjs`,
  `scripts/practice*.mjs`, their tests, and the codex-review files of the first).
  `bin/lib/gate-lock.mjs` is in neither, and still waits: see "What the reader changed", 1.
- Only the rename grants the lock, as today, because that is what makes two holders
  impossible; the line decides who may try it and nothing else. A fault in the line may cost
  order, never exclusion, and never a rejected take: `check` runs its sensors without the
  lock when a take rejects (`bin/check.mjs:498-502`, `:537`).
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
  two gates compute the same order. This is the order of the turn, a function of its own.
  The order of the display (`readGateWaiters`, which sorts an arrival it cannot read last and
  is pinned by a test) stays as it is; the turn counts such a gate as ahead.
- At each turn of its loop a gate first makes or touches its own folder, so it is seen, and
  then reads the line. A gate that is not at the head only touches its file (and makes it
  again when it is gone); the head writes it again before its rename, since the file must
  say "started now" at the instant the folder becomes the lock. The arrival of another gate
  is read once and remembered by its token; after that its folder is only looked at for its
  last touch, so a file is never read while its owner rewrites it more than once.
- "The lock is free and a gate is ahead" is a branch of its own, placed before the code that
  today handles "no holder" (which spends its blind tries and throws): the gate says whom it
  waits behind, sleeps one poll and looks again. The turn is that gate's, which takes it at
  its next poll, two seconds away at most. The bound of the wait and the refusals apply in
  this branch as in the others.
- With a holder, a gate that is not at the head does what it does today except the rename: it
  waits for the holder, and clears a dead one on its second stale reading, after which the
  head takes the lock.
- **The line never makes a take fail.** Any error while the line is read or the own folder is
  touched (a listing that answers busy, a folder that went away) counts as "nobody ahead" for
  that look: the gate then behaves as it does today.
- A gate that is ahead and dies stops touching its folder and is left out after the stale
  time, sixty seconds. That is the longest a free lock waits for a dead gate.
- Older versions: the file of a gate that keeps the line carries a mark, `line: 1`. A gate
  that sees a live waiter without the mark behaves as today for that look (it tries the
  rename), because a gate of an older version takes no turn and would pass it at every poll.
  On one machine the lock is shared by every project and every worktree, each with the
  version it has, so mixed versions are the usual case and not a passing one.
- With `wait` off, a gate ahead is a refusal, as a holder is: taking the lock would pass it.
  A dead gate ahead therefore refuses a `--no-wait` gate for up to sixty seconds, and the
  refusal says so.
- What a caller is told is true of what it names. `onWait(holder, leftMs, line)` and a
  refusal carry the holder when there is one and `line = { ahead, head }`: how many gates
  are before this one, holder included, and the gate at the head when the lock is free. The
  holder's place is never filled with a gate that only waits. The callers' words change in
  the same slice: "waiting behind the gate of … which waits for its turn, N gates ahead",
  and a refusal that says "waits ahead of this one" and not "holds".
- What stays as it is: the rename, the beat, the stale takeover, the unreadable lock, the
  release, the bound of a wait. Exclusion does not depend on the line: two gates that both
  think they are first both try the rename and one of them gets it.

The session: the file of a gate gains `session`, the host's session id, or `null` where the
host gives none (Codex). `takeGateLock` takes it as an option that defaults to `null`; `check`
and `gate` pass `CLAUDE_CODE_SESSION_ID` from the environment they are given, as
`bin/sessions.mjs:314` and `bin/lib/channel.mjs:345` read it (set in this session's shell,
2026-10-11; that a commit hook inherits it is checked by the first real gate, which writes it
or does not). `readGateWaiters` and `readGateHolder` return it. The board drops fields it does
not know (`bin/lib/sessions.mjs:696`), so the title shows there only with T9; until then the
worktree names the gate, as today.

On disk: nothing new. The same folders, one more field in a file; `uninstall` removes the
gate folder as before (`bin/lib/manifest.mjs:826-841`).

Known and left: a machine that sleeps wakes with every waiter stale, and the first to wake
takes the lock (order lost, never exclusion); a clock set back keeps a dead waiter "live" for
as long as it was set back; a gate that outlives its killed `git commit` keeps its place and
runs for nobody, as it could before.

Not taken:
- The bound of a wait counted from the last time the line moved (the first version's T4). It
  reverses a reviewed decision (`odd/tasks/gate-lock.md:493`; the test at
  `bin/check.test.mjs:1688` pins "for 54 s at most"), changes what `--wait` means in four
  places, and has no bound behind a `js-harness gate -- <command>`, which has none of its
  own (`bin/gate.mjs:168`). The cost of leaving it: with gates of about fourteen minutes, a
  gate with four or more ahead reaches the sixty minutes while the line moves, is refused,
  and comes back at the end. The refusal says how many were ahead. Told to the orchestrator
  as an open need; placed by it back in this feature, in the slice of the line (T3), as a
  design question this session settles with that slice's reader, and his only if it changes
  what a user of the installed gate sees by default. The orchestrator's reading, its own and
  not his words: the bound measures the time since the holder last changed. What that
  reading must answer before it is taken: what `--wait` then means and where that is said
  (`bin/check.mjs:892`, `:904-908`, `bin/lib/manifest.mjs:25`, `docs/ROADMAP.md:726`), which
  is what a user sees; a holder that has no bound of its own (`js-harness gate --`); a gate
  of an older version that passes the line and "changes the holder" each time; and the
  message "for 54 s at most" that a review asked for. Open until T3.
- A ticket number in a shared counter file (a second thing to lock); asking the system
  whether a waiter's pid is alive (the lock judges life by the beat everywhere, and a pid is
  reused); a release that hands the lock to the next gate by name (a dead heir holds
  everybody).

### 2. The gate stops before its sensors

Today `main` builds the rows in this order: the static rows, then the sensors' block (which
first reads the sensors' declaration and whether the commit is documents alone, then takes the
lock, samples the load and runs the sensors), then `review`, then the Codex debt.
- The stop: **when a row computed before the lock is taken has failed, nothing after it
  runs.** No row is named: it is whatever row has `pass === false` at that point, so the rows
  of "JH 7" stop the gate by being added to the static rows, with no word of this feature.
  A row that could not be computed stops the gate only if it is written as a failure, which
  already fails the gate today; an information row stops nothing.
- The sensors' declaration is read before the stop is decided, so a faulty declaration is
  named in the same run as a failing budget, and the stop is counted only when sensors would
  have run: a commit of documents alone runs none today (`bin/check.mjs:601-602`) and saves
  nothing by stopping.
- What is printed: the rows, then one row that says the gate stopped, that no sensor ran, and
  which rows stopped it. The exit code is 1, as it would have been.
- The order of the static rows is this feature's to hold: `rules` and `failures` first when
  they exist, then `budget`, `contracts`, `payload`. The test that pins the order
  (`bin/check.test.mjs:1440`) is changed by whichever of the two features lands second.
- The lock in its three states: free, it is not taken and no folder is made; held by another
  gate, it is not waited for; held by the parent (`js-harness gate -- npm run check`), it is
  left to the parent. In that last case the parent has already waited its turn before the
  inner check computes anything: the stop saves the sensors there, not the wait.
- `check --push` and an inner check (`JS_HARNESS_CHECK_INNER=1`) are unchanged: the stop sits
  inside the branch that runs the sensors' block.
- Skipped on a stop, and nothing depends on them: `review` and the Codex debt are information
  rows about a change that is not going to be committed as it is.
- The gate log of `feat/gate-log-file` accepts three kinds of line and counts any other as
  unreadable (`isEvent`, `bin/lib/gate-log.mjs:103` on that branch). A stopped gate writes
  one line of a fourth kind, `stopped`, with the rows that stopped it, and no `start`. For
  that, the reader of the log must leave out a kind it does not know without calling the
  line unreadable, before the format is on `main` and in the installed command: asked of
  "JH 6" through the orchestrator, and answered yes (its claim, relayed 2026-10-11, to be
  read in its commit when it lands): the reader of its second slice leaves out in silence a
  line with a sound head (`v`, `id`, `at`) whose `event` it does not know, and still counts
  a torn line. Its limit, which this design already meets by writing no `start`: an old
  reader does not pair an end of a new kind with its start. The count of `stopped` lines is
  the measure of what the stop saves.
- Known and left: the static rows read the working tree before a wait that may last an hour,
  and are not read again after it; the sensors read the tree late in the same way today.

### 3. The two findings

The test that fails on a busy machine (`evals/suite.test.mjs:716-752`). It records whether
the fake agent and its grandchild are alive at the instant `proc.exit` is called and asserts
`false, false`. What is known: two sightings (2026-10-02 and 2026-10-11), both `false, true`,
the grandchild both times; the output of both runs shows no error of the sweep. The kill of
the tree already waits five seconds for each process and throws for one still running
(`bin/lib/process-tree.mjs:152-153`, `:263-264`), so the first version's cause ("the runner
does not wait for the kill") is wrong for the tree. Two causes fit what is known, and the
task establishes which before it changes anything:
- the test asks by pid alone (`evals/suite.test.mjs:702-709`) and Windows gives the pid of a
  dead process to a new one at once; the runner starts PowerShell processes after the kill;
- the grandchild is not proved a descendant by the snapshot (its parent exited), is left to
  the sweep by path, and that kill does not wait for the process to be gone.
The first is the test's fault and is fixed there: the look knows a process by its pid and
when it was created, as the reaper beside it does. The second is the product's: the sweep
waits, with a bound, for what it killed. A wait added to the test at the exit instant would
hide either one and is not the fix.

The PowerShell cache. The gate runs each sensor with `HOME` and `USERPROFILE` moved to an
empty temporary home and `LOCALAPPDATA` left alone (`bin/check.mjs:408-411`). The inference:
Windows PowerShell then finds no local application data folder and writes its module analysis
cache to a path relative to the working folder. An earlier attempt to reproduce it with that
environment failed (`odd/tasks/session-board.md:847-849`), and no single test file leaves the
folder (`odd/tasks/evals.md:1294-1297`). So two things, neither resting on the inference:
- the sensor's environment sets `PSModuleAnalysisCachePath` to a file inside the temporary
  home, removed with it; the test is that the environment carries it there. A reproduction
  is tried once (PowerShell kept alive past the moment it writes the cache), and its result
  is recorded whichever it is;
- the gate lists the untracked paths of the working tree before and after its sensors and
  says, in an information row, the ones that appeared. That names whatever a test leaves in
  the tree, this folder or another, and is the proof that it has not come back: a gate that
  says none.

## What the reader changed
One read-only reader, 279,605 tokens, twelve holes and ten omissions; spot-checked here:
`bin/check.test.mjs:1688-1709`, `bin/check.mjs:487-552`, `bin/lib/process-tree.mjs:140-160`.
1. The line cannot be a slice of one free module: a test in `bin/check.test.mjs` runs the
   real lock with a later arrival taking it while a gate waits, and the callers' words would
   say "holds" of a gate that waits. The line, its words and that test go together, after
   the merges of "JH 6".
2. A new throw in the take costs exclusion, since `check` then runs without the lock. Added:
   the line never makes a take fail, and the branch of its own for a free lock.
3. Mixed versions: the mark `line: 1` and today's behaviour beside a gate without it.
4. The bound that moved with the line is not taken (above).
5. The cause stated for the failing test was contradicted by the code; replaced by two
   causes and the evidence so far. "Done when" named the wrong test file.
6. The stop names no row, is decided after the declaration and the documents, and is counted
   only when sensors would have run; the fourth kind of line needs a reader that tolerates
   it.
7. The session is passed by the callers and not read from the environment inside the
   library, whose tests compare a waiter's file whole.
8. The cache: the test planned would probably never have been red; replaced by a test of the
   environment and by the row that lists what the sensors left.
9. Said now: the two orders, nothing new on disk, what a `--no-wait` gate meets, the parent
   that waits before an inner check.

## Tasks
- [x] T1 · Design read by a reader that did not write it. Route: one read-only reader.
      Evidence: "What the reader changed".
- [ ] T2 · The test that fails on a busy machine: which of the two causes, shown by a test
      that needs no load, then the fix where the cause is. Route: one writer. Free today;
      `feat/codex-parity` changes `evals/suite.test.mjs` from its line 844 on, not here.
- [ ] T3 · Blocked on the two branches of "JH 6": the line in `bin/lib/gate-lock.mjs`, the
      mark, the session, the words of `check` and `gate`, the test at
      `bin/check.test.mjs:1688`. Test first. Route: one writer.
- [ ] T4 · Blocked on the same: the stop in `bin/check.mjs`, its line in the gate log, the
      three states of the lock. Test first. Route: one writer.
- [ ] T5 · Blocked on the same: `PSModuleAnalysisCachePath` in the sensor's environment, and
      the row that lists what the sensors left in the tree.
- [ ] T6 · Blocked on the two branches of "JH 5": the session's title beside each gate that
      waits, on the board.
- [ ] T7 · `docs/ROADMAP.md` (the lock's section, near its line 726); the text of
      `bin/lib/manifest.mjs:25-26` and `:98` and the help of `check` and `gate` where they
      describe a wait; the pointer in "Next" of `odd/tasks/gate-lock.md`.
- [ ] T8 · Close: both reviews of each slice with code, push, pull requests, the closing
      notice.

Slices: S1 is T2, now. S2 is T3 and S3 is T4 with T5, after the merges of "JH 6". S4 is T6.

## Progress
- 2026-10-11 · Opened. Read: `AGENTS.md`, the brief, relief lines 227 and 250 to 254, "Next"
  of `odd/tasks/gate-lock.md`, `bin/lib/gate-lock.mjs:20-75` and `:225-514`,
  `evals/suite.test.mjs:625-640` and `:700-752`. A read-only explorer mapped `bin/check.mjs`,
  the lock and the two findings on `main` and on `feat/gate-log-file` (168,928 tokens).
  `docs/ROADMAP.md` names none of the three pieces (searched for "early stop", "order of
  arrival", "not a line", "ModuleAnalysisCache", "suite.test.mjs": no line).
- 2026-10-11 · T1 done: first version committed (`4623c95`), read by the reader, second
  version here. Found while checking the reader: the second sighting of the failing test,
  2026-10-02, and that neither run printed an error of the sweep (the two transcripts, read
  with `rg` for the test's name). `feat/gate-log-file` changes `bin/check.test.mjs` at its
  lines 228 to 240, 1802 to 1838, 2352 and 2677 on, not at 1688.
- 2026-10-11 · From the orchestrator, by message (claims): the line waits for the two merges
  of "JH 6", taken; "JH 6" answered yes on the reader of the gate log; "JH 7" was told where
  its rows stand; the bound of a wait came back to this feature as a question of T3. Two
  facts it gave: he is away until about 18:20, and the plan's five-hour limit resets then,
  so rounds of readers stay few until that hour (read here at 15:48: 64 percent used). T2's
  writer runs. Spent so far on sub-agents: 448,533 tokens (explorer 168,928, reader
  279,605).

## Next
T2, through the lock for every test run. T3 to T5 wait for the orchestrator's word that the
two branches of "JH 6" are on `main`.

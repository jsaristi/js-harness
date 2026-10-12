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
  their tests, and the text of `bin/lib/manifest.mjs` that says how a gate waits (free since
  both branches of "JH 6" reached `main`, 2026-10-11); `evals/suite.test.mjs`, `evals/runner.mjs`, `bin/lib/process-tree.mjs` and
  their tests for the test that fails on a busy machine; `bin/lib/sessions.mjs` and its test
  for the session's title beside a waiting gate, only after the two branches of "JH 5" that
  change it are on `main`; `docs/ROADMAP.md`; this document.
- Out: the rows `failures` and `rules` themselves, which are "JH 7"'s: this feature gives
  them the place they stand in. The merge command of section E of the protocol. The gate on
  GitHub: his to start. Waiting for a quiet machine. The 1,200 s bound of a sensor. A bound
  on the whole of a wait. `AGENTS.md`: at its budget, and
  nothing here needs a line of it. The installed command on his machine: updating it is his.

## Constraints
- The gate's files have no other owner since pull requests 63 and 64 are on `main`
  (`906fc28`, merged here at `cd58923`). Still another session's: `bin/lib/sessions.mjs`
  and `bin/sessions.mjs`, which two unmerged branches of "JH 5" change, and the place in
  `bin/check.mjs` where "JH 7" adds its rows (`feat/failures-register`).
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
- Open, his (judged so by the orchestrator, 2026-10-11): what `--wait` means by default in
  the installed gate. It is built as "minutes without the lock changing hands" (Design, 1,
  "The bound of a wait"), which neither he nor his words chose. The orchestrator puts it to
  him as one question when he returns and does not merge the slice of the line before his
  answer; the pull request of that slice says it plainly, as a default that changed and
  waits for his word. "From arrival" is one line away.
- The installed `js-harness` command takes the line only when it is
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
- A gate whose file has not read for the stale time since it was first seen is taken for a
  gate that keeps no line (added while building, 2026-10-11): without that end, two live
  gates that could not read each other's file would each stand back for the other until
  their bound.
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
  release. Exclusion does not depend on the line: two gates that both
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

The bound of a wait (built as settled on 2026-10-11 by this session, after the orchestrator
sent the question back to this feature; its reading and this one agree, neither is his
words, and the default is his to confirm: see "Ask me before"): **the
bound counts from the last time the lock changed hands**, and no longer from the arrival.
- Why: with gates of about fourteen minutes, a gate with four or more ahead reaches sixty
  minutes while the line moves, is refused and comes back at the end. Two commits lost an
  hour each that way on 2026-10-11 (those of "JH 6" at 13:42 and "JH 7" at 14:55). The bound
  exists to give up on a lock that does not move, and a line that moves is not that.
- What it is: `--wait <minutes>` (sixty when not given) is how long a gate waits **without
  the lock changing hands**. The count starts again when a look reads a holder whose token
  is not the one read before. Nothing else restarts it: not a gate that leaves the line,
  not a free lock. `waitedMs` stays the whole wait.
- A holder that never ends is still given up on after the bound, as today: it does not
  change. That holds behind `js-harness gate -- <command>`, which has no bound of its own.
- A gate of an older version that passes the line changes the holder and restarts the
  count. That is a gate that ran, so the machine moved; beside such a gate this one already
  behaves as today (the mark, above).
- What a wait says: with each holder it names, the whole bound again ("for 60 minutes at
  most"), which is now what is true. The review finding that asked for "for 54 s at most"
  (`odd/tasks/gate-lock.md:493`) asked that a line say what is really left, and the test
  that pins it (`bin/check.test.mjs`, "main says what is left of its wait…") changes with
  the meaning. A refusal says how long the lock did not move and how long the whole wait
  was.
- No bound on the whole wait is added. What a user of the installed gate sees by default
  therefore changes: a commit may wait more than an hour in a line that moves. Told to the
  orchestrator as that, for it to take to him if it judges it his; the anchor of the count
  is one place in the code, so "from arrival" is one line away until the merge.
- The text that says what `--wait` means changes in the same slice: the usage and the
  comment of `parseGateWait` in `bin/check.mjs`, the help of `gate`, the skill's text in
  `bin/lib/manifest.mjs`, `docs/ROADMAP.md`.

Not taken:
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
- [x] T2 · The test that fails on a busy machine: which of the two causes, shown by a test
      that needs no load, then the fix where the cause is. Route: one writer. Free today;
      `feat/codex-parity` changes `evals/suite.test.mjs` from its line 844 on, not here.
      Evidence: Progress, "T2 done".
- [x] T3 · Evidence: Progress, "T3 built". The line in `bin/lib/gate-lock.mjs`, the bound
      from the last change of hands, the
      mark, the session, the words of `check` and `gate`, the test at
      `bin/check.test.mjs:1688`. Test first. Route: one writer.
- [x] T3b · The four findings of gentle-ai on S1 (Progress, 19:23). Route: one writer.
      Evidence: Progress, "T3b built".
- [x] T3c · Evidence: Progress, "T3c written", and its commit. With what Codex finds on
      S1, one narrow writer: the words of a refusal for the
      bound beside a gate of an older version (`refusalSaid`, `bin/check.mjs`) say "still
      held … after the whole wait" and "without the lock changing hands", and there the
      holder did change and the count is from the arrival; the refusal must carry that the
      gate stood beside an older one. And a touch of the own file that fails leaves the
      caller told `ahead` without the gate it did not read (said, no channel added).
- [x] T4 · Evidence: `b567112` on `feat/gate-stop` (Progress, 21:31). The stop in
      `bin/check.mjs`, its line in the gate log, the
      three states of the lock. Test first. Route: one writer.
- [x] T5 · Evidence: `b567112` on `feat/gate-stop`, whose own gate left no folder and
      printed no row `tree`. `PSModuleAnalysisCachePath` in the sensor's environment, and
      the row that lists what the sensors left in the tree.
- [x] T6 · Notice sent to the orchestrator for "JH 5" on 2026-10-11, after `d133965`.
      The session's title beside each gate that waits, on the board. Not built here
      (the orchestrator, 2026-10-11): `bin/lib/sessions.mjs` is "JH 5"'s and its fourth slice
      is open, so what the board needs goes to "JH 5" through the orchestrator once T3 is
      committed: the two readers of the lock return `session`, the host's session id or
      `null`, and nothing else the board reads changes. Done here when that notice is sent.
- [ ] T7 · `docs/ROADMAP.md` (the lock's section, near its line 726); the text of
      `bin/lib/manifest.mjs:25-26` and `:98` and the help of `check` and `gate` where they
      describe a wait; the pointer in "Next" of `odd/tasks/gate-lock.md`.
- [ ] T8 · Close: both reviews of each slice with code, push, pull requests, the closing
      notice.
- [ ] T9 · Placed here by the orchestrator, last in order (2026-10-11): two findings of
      Codex left open on `scripts/count-git.mjs`, which says "missing" where nothing is
      missing (a child started through a shell by a synchronous call; two launches whose
      shell got the same pid). Their text is in pull request 63. Not read yet.

Slices: S1 is T2 with T3 (T2's commit was under the review budget and rides in T3's range).
S2 is T4 with T5. S3 is T6.

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
- 2026-10-11 · From the orchestrator, by message (claims): a fourth sighting, the commit of
  "JH 7" launched at 14:55 waited 60 min 1 s and gave up with no sensor run, after that of
  "JH 6" at 13:42: two hours of waits lost in one day. Until the line exists it orders the
  turns by hand: no full gate of this session before the gate of "JH 5" (waiting since
  15:23) has started, and `--wait 180` on every wait. The commit hook passes no `--wait`
  (`.githooks/pre-commit`), so a commit with code here is run as
  `node bin/js-harness.mjs gate --wait 180 -- git commit …`. Its question for T3: whether
  sixty minutes as the default bound survives the line.
- 2026-10-11 · From the orchestrator (claim): pull request 63, `feat/gate-git-processes`, is
  on `main` as `859b9a1` and this branch merges clean with it. `feat/gate-log-file` is not:
  the hold on `bin/check.mjs` and the gate's files stands. The brief of "JH 6" on that
  branch now starts at line 897 of its `odd/tasks/gate-log.md`. `main` is merged here after
  T2's writer ends, not under it.
- 2026-10-11 · T2 done, route one writer (183,634 tokens), its diff read back here. The
  cause is the test's, the first of the two: it asked whether a process was alive by its
  number alone. The second cause is contradicted by reading: the sweep by path kills through
  the same `killProcesses` as the tree kill, which waits and reports a survivor
  (`evals/runner.mjs:253`, `:257`; `bin/lib/process-tree.mjs:153`); the grandchild's command
  line holds no trial path, so that sweep never matches it
  (`evals/fixtures/fake-agent.mjs:140`); and it is proved a descendant, since in `hang` mode
  the agent lives when the snapshot is taken (`evals/runner.mjs:329-332`). At least two
  PowerShell processes start between the kill and the exit. Why the grandchild both times
  (this session's inference): the runner still holds the agent's process open, so its number
  cannot be given away, while nobody holds the grandchild's. Not observed: the reuse itself;
  one other cause is not excluded by reading (a snapshot row with no creation time is
  skipped, `bin/lib/process-tree.mjs:47`), and the new message would name it.
  Changed: `reaper.look(pids)` in `bin/lib/process-tree.testkit.mjs` counts a pid as alive
  only when it has the creation time recorded for it, and says what answered to the number;
  three tests of it in `bin/lib/process-tree.test.mjs`; `evals/suite.test.mjs` (its lines
  700 to 752) asks the reaper, and a failure at the exit now carries what answered. No
  product change, no wait added at the exit. Red, through the lock: the three tests of the
  look failed 3 of 3 with the look still by number (`[300, true]` against `[300, false]`).
  Green, through the lock with `--wait 180`: 8 of 8, the real interrupt test among them
  (6.4 s). The two runs waited about 20 and 35 minutes for their turn. Left: a recorded
  process that answers at the exit and is gone when the snapshot is taken a second later
  passes, and the test's diagnostic says that it answered.
- 2026-10-11 17:29 · T2 committed: `3a7c9c8`, through the lock (`gate --wait 180 -- git
  commit`), which waited behind three gates from 16:45; the whole gate passed on `main`
  merged at `859b9a1` (`PASS tests`). Its report: review "medium risk, 4 paths, 200 lines:
  review not due (under_budget)", so the commit stays pending in the slice until a later
  one reaches the budget; no Codex review is owed yet.
- 2026-10-11 · From the orchestrator (claims): pull request 64, `feat/gate-log-file`, is on
  `main` as `906fc28`; the hold on the gate's files is lifted and "JH 6" is closed. Merged
  here at `cd58923`, clean. Read in `odd/tasks/gate-log.md` on `main`: the reader's silence
  for a kind it does not know is commit `88165ec` (its line 836 and 867); two findings of
  gentle-ai left for this feature (its lines 869 to 873): the writer of the gate log does
  not filter `load` as it filters `waitedFor`, which goes with T4, and holders with no
  token share one entry in `takeGateTurn`, which goes with T3. Its gates ran with the log
  switched off (`JS_HARNESS_GATE_LOG=off`); the gates of this branch write the log from now
  on, as `main` does. The slices are numbered again under Tasks.
- 2026-10-11 · The bound of a wait is settled (Design, 1): from the last time the lock
  changed hands. Told to the orchestrator in one line, as a change of what the installed
  gate shows by default.
- 2026-10-11 · From the orchestrator (claims): what `--wait` means by default is his, put to
  him by the orchestrator when he returns (see "Ask me before"); `main` is `5af56c1` with
  the third slice of "JH 5" (pull request 65), which rewrote `bin/lib/sessions.mjs`; the
  board is "JH 5"'s, so T6 is a notice and not code here.
- 2026-10-11 · T3 built, route one writer (459,808 tokens), its work read back here
  (`takeGateLock` whole, `gatesAhead`, the changed lines of `bin/check.mjs`). 1,172 lines
  added and 147 removed in ten files: over the "about 1,200 changed lines" a reviewed
  commit keeps to (`odd/tasks/gate-lock.md`, "Rules learnt"), and not split, because the
  lock and the callers' words cannot be green apart (the reader's first hole).
  Built as designed: `gatesAhead` (order by arrival, then token; a file is read once and
  remembered), `showUp` (touch, stage again when gone), the branch for a free lock with a
  gate ahead before the code that throws, one `try` around the line so that any error there
  reads as nobody ahead, the mark `line: 1`, `refused: 'ahead'`, `onWait(holder, leftMs,
  line)` with `holder` `null` for a gate that only waits, the anchor `boundFrom` moved by
  one line in `handsRead`, `session` passed from the environment by `check` and `gate`,
  the words (`refusalSaid`, `takeGateTurn`), the usage and the skill's text for `--wait`,
  and holders without a token kept apart in `takeGateTurn`.
  Two readings the writer made of the design, taken: a file unread for the stale time is a
  gate that keeps no line (Design, 1); the count of the bound starts again when a look
  reads a holder that is not what the look before read, a free lock included, and never at
  the first thing read.
  Assertions of existing tests changed, each for the line or the bound: the two tests of
  `bin/lib/gate-lock.test.mjs` where a later arrival took a free lock (the second holder
  now stands in line first, and the second pins the whole bound); "comes late to a
  takeover", played on disk; the fixtures gain `session: null`; in `bin/check.test.mjs`,
  "main says what is left…" (retitled, "for 54 s at most" became the whole bound plus the
  gates ahead) and the parenthesis "--wait bounds the wait at …" in three tests; the usage
  texts and the skill's "60 minutes at most".
  Red, through the lock taken with the stable copy on `main` (the writer rewrites the lock,
  so it does not take the real one with its own code): the new tests against a snapshot of
  the old code failed, 20 of 71 in the lock's file, 6 of 48 in `gate`'s, 11 of 13 chosen in
  `check`'s. Green: lock 71 of 71, `check` 148 of 148, `gate` 48 of 48, manifest 95 of 95,
  `js-harness` 25 of 25, and four files that read the lock, untouched, 372 passed.
  Not proved: the line between real processes on a real clock beyond the two existing racer
  tests; that a commit hook inherits the session id. Left for T4, which works in that file:
  `bin/lib/gate-log.mjs:293` documents `reason` as `held` or `timeout`, and `ahead` is
  written too.
- 2026-10-11 19:03 · T3 committed: `d133965`, through the lock taken with the stable copy
  (`node D:/js-harness/bin/js-harness.mjs gate --wait 180 -- git commit`), 39 minutes from
  launch behind two gates; the whole gate passed (`PASS tests`). `main` (`5af56c1`) merged
  at `15f06b2`, clean; that merged tree has not had a gate yet. Its report: "review due
  (slice_budget_reached)", medium risk.
- 2026-10-11 · gentle-ai review of the slice S1 started, consent granted without asking as
  `AGENTS.md` says: lineage `review-bc8d2e73453d6b39`, base `main`, committed only, 14
  paths and 1,923 changed lines (this document among them), one lens, `review-reliability`,
  correction budget 200. Its capture runs in a turn of the lock (`gate --wait 180 --
  gentle-ai review capture-result …`); the commands and their outputs are in this session's
  scratchpad (`review-*.json`). Nothing is committed on this branch until it is
  acknowledged, since the candidate is the committed tree.
- 2026-10-11 · The stop is a slice with a branch of its own: `feat/gate-stop`, cut from
  `main` at `5af56c1`, in the worktree `D:\js-harness-worktrees\gate-stop`, so that the
  orchestrator can merge it without waiting for his word on `--wait`, which holds the line
  (the rows of "JH 7" need the stop, not the line). A writer works there on T4 and T5 while
  the review runs here (`odd/tasks/gate-lock.md`, "Rules learnt": a writer works in a
  worktree of its own while a gate runs here). This document stays on `feat/gate-turn`
  alone and records both; the two branches change different functions of `bin/check.mjs`.
  Decided for T4 before the writer began: the stop is decided inside `checkSensors`, after
  the two declarations and the returns for no sensors and for documents alone; its row is
  a failure named so that it cannot read as passing tests; `main` then skips `review` and
  the Codex debt; the gate log gets `record.stopped`. For T5: the variable on Windows only,
  one reproduction tried and reported, and a row `tree` only when a path appeared.
- 2026-10-11 19:23 · gentle-ai approved S1 (`main..15f06b2`, T2 and T3) and the approval is
  acknowledged (authority burned, `review-ack.json` in the scratchpad). The capture waited
  18 minutes for its turn. Four findings, none blocking, all four taken as task T3b before
  Codex reads the range, so that Codex is paid once:
  1. `R3-unbounded-wait-mixed-versions` (warning): beside a live gate of an older version
     the line is off and every gate races for the rename; there the bound still starts
     again at each change of hands, so a gate that loses every race never gives up, where
     it gave up an hour after its arrival before. True. Taken: a change of hands read at a
     look where the gate keeps no line (a gate of an older version is live) does not move
     the anchor, so beside such a gate the bound counts as it did, which is what the
     design already says of that case ("behaves as today").
  2. `R3-ahead-reason-unproved-in-real-log` (warning): the new reason `ahead` reaches the
     gate log only through a stand-in in the tests. Taken: one test with the real writer
     and the real reader.
  3. `R3-own-file-touch-failure-untested` (suggestion): the `try` around the line turns
     any error into "nobody ahead", and only an unlistable folder is tested. Taken: a test
     with a touch of the own file that answers busy.
  4. `R3-exact-stale-boundary-assertion` (suggestion): a test rests on a file time equal to
     the stale time to the millisecond. Taken: a margin, as its neighbours have.
- 2026-10-11 · Seen at the capture's start: 5.6 of 8 processors busy, 1.3 s of CPU in 2 s by
  a `tsserver.js` that is this session's own (pid 57964, its parent chain ends in this
  session's process). It works while a writer of this session edits the long test files
  and was idle when sampled ten minutes later (0.2 s in 4 s). So a session's writers load
  the machine through its language server while another session's gate runs: one more
  case of `odd/tasks/gate-lock.md`, "Rules learnt" (a `tsserver.js` of its own).
- 2026-10-11, before 19:58 · Two working rules from the orchestrator, on his words (relief file, line
  282, read here: "me gusta mucho que apliquemos lo de los ahorros"): a writer sub-agent
  never waits for the gate, it returns its work and this session runs the tests and commits
  through the lock (a sub-agent pays its whole context again after a wait of over five
  minutes); and a writer gets a narrow piece that ends in tens of turns. Applied from now:
  the writer of T4 and T5 was told to return without waiting; T3b's writer had its one run
  already queued and is left to end. The writers of T2, T3 and T3b waited inside their
  sub-agents before this rule (about 20, 30 and 35 minutes a run).
- 2026-10-11, before 19:59 · T3b built, route one writer (214,958 tokens; its one run waited behind
  three gates inside the sub-agent, before the rule above). (1) `gatesAhead` answers `null`
  beside a live gate of an older version, and `handsRead` does not move the anchor at such
  a look; two tests. (2) A test with the real gate log: a refusal with reason `ahead` is
  read back as one event, none skipped; no fix was needed. (3) A test where the touch of
  the own file answers busy: the take does not reject, the lock is not taken while held,
  and the gate takes it at the release; it passed without a change of code. (4) The margin
  of a second either side of the stale time, the one existing assertion changed. Red, in
  the lock's turn: of the five new tests against the committed lock, the two of (1) failed
  and three passed. Green: the three files, 271 of 271. Left: T3c; an older gate that
  takes the lock with no other older gate waiting still starts the count again, as the
  design says; `bin/lib/gate-log.mjs:293`, changed in `feat/gate-stop`.
- 2026-10-11, before 19:58 · From `feat/gate-stop`, the writer of T4 and T5 returned without waiting
  (343,499 tokens), nothing run but its red and the reproduction: 854 lines added and 57
  removed in six files. Red, on a snapshot with the new tests and the old code: 232 tests,
  21 fail, all new. The reproduction, in the lock's turn: with `USERPROFILE` at an empty
  folder, `GetFolderPath("LocalApplicationData")` answers an empty text whatever
  `LOCALAPPDATA` says, and PowerShell wrote `Microsoft/Windows/PowerShell/
  ModuleAnalysisCache` (57,408 bytes) into the empty working folder, about 13 s after the
  analysis; with `PSModuleAnalysisCachePath` set the folder stayed empty and the cache was
  in the home. So the inference of Design, 3 is a fact, and the folder only appears when a
  PowerShell lives that long, which is why no single test file left it. Its diff of
  `bin/check.mjs` read back here. Green is run by this session, queued at 19:58:23.
- 2026-10-11 20:36 · T3b committed: `9b90797`, through the lock (launched 19:59:54, behind
  two gates); the whole gate passed, the first on the tree with `main` `5af56c1` merged.
  Assessed against the reviewed tree (`15f06b2`): medium risk, 4 paths, 310 lines, review
  not due (under budget), so it stays pending in the slice.
- 2026-10-11 20:23 · A sighting of the second finding, in this worktree: that gate left
  `Microsoft/Windows/PowerShell/ModuleAnalysisCache` (15 k, written 20:23, three minutes
  into its tests) untracked here. Its cost, which nobody had seen: the gate's own `review`
  row then read "gentle-ai could not assess the pending change", because an untracked
  path makes the assessment refuse ("untracked files require an explicit declaration"),
  and an assessment that fails counts as high risk. So the folder does not only dirty a
  tree: it hides whether a review is due. Removed by hand; the fix is T5, on
  `feat/gate-stop`.
- 2026-10-11 20:19 · Green of `feat/gate-stop`, run by this session in a turn of the lock
  (queued 19:58:23): 232 tests, 231 pass, one fail, and the fault was the test's. It
  expected a push to ask git through `deps.git`; a push asks through `deps.spawn`
  (`checkCodexReviews`), which the test's stand-in counts with the sensors. The assertion
  now checks what a push never asks for (the lock, the load, gentle-ai); changed inline,
  one file. The commit of the slice is queued behind the lock since 20:21 and runs every
  test again. At the start of that green run 7.1 of 8 processors were busy (the antivirus,
  a `codegraph.js` indexer, a browser).
- 2026-10-11 · A mistake of this session, corrected in this same edit: four entries above
  carried hours it had not read (20:10, 20:35, 20:40, and 19:35 for the notice of T6); the
  real hour when they were written was before 20:00. They now carry the hours read from
  the logs of the runs, or none.
- 2026-10-11 21:14 · Codex on S1, `5af56c1..156ad7e`, in a turn of the lock (launched
  20:37:50, behind two gates): 5 parts, 1,648 changed lines, 1,386,358 input tokens
  (1,104,512 cached), recorded in the repository's `codex-reviews.jsonl`. Three parts
  correct, two findings, both P2 and both right, taken into T3c:
  1. `bin/lib/gate-lock.mjs:676`: a gate ahead that takes the lock between the reading of
     the line and the look at the lock is counted twice, as a gate that waits and as the
     holder, and is named as `line.head`. Exclusion is whole; the count and the words are
     wrong. Fix: leave the holder's token out of the gates that wait before `line` is made.
  2. `bin/lib/process-tree.testkit.mjs:102`: a pid that answers and whose row in the
     snapshot has no creation time is reported dead by `look`, so the interrupt test could
     pass with a survivor. It is the case T2 left "not excluded by reading". Fix: `look`
     throws for an identity it cannot tell.
- 2026-10-11 · From the orchestrator, by message (claims): `main` is `40ccb45` with the
  failures register of "JH 7" (pull request 66), which adds the row `failures` in
  `bin/check.mjs` and one test block; both branches here merge `main` before they are
  delivered, and in `feat/gate-stop` the test that pins the order of the rows is this
  feature's to adjust. A gate of "JH 7" timed out at 1,206 s with no test failed, which it
  reads as the code graph indexing thirty changed files during its tests; a `codegraph.js`
  was also seen busy at the start of this session's green run.
- 2026-10-11 · Models by stage, on his words (the orchestrator's transcript `130317af…`,
  line 2037: "apliquemos lo que investigaste y siempre dime en que modo de esfuerzo debemos
  trabajar", the phrase found there by this session; what it approves is the orchestrator's
  relief line 285): a sub-agent that writes scoped code is launched with model `haiku` and
  effort high; one that explores, reviews or verifies stays on Opus at high; this session
  stays at high. On the first such writer its model id is read once in its transcript; a
  piece it gets wrong twice is written on Opus and told to the orchestrator.
- 2026-10-11, before 21:21 (the hour its commit turn was launched) · T3c written, route one writer on `haiku` (its transcript records
  `claude-haiku-5-5`, read once; 173,765 tokens, three and a half minutes, nothing run, as
  the rule says), its changed code read back here: 92 lines added, 10 removed, six files.
  A: `line` is made from the gates ahead without the holder read at that look. B: `look`
  throws for a recorded pid that answers under a row with no creation time. C: a refusal
  carries `besideOlder`, true when any look of the take saw a live gate of an older
  version, and `refusalSaid` then says who holds the lock now, the whole wait, and that
  the bound counted "from its arrival or from the last change of hands read while the line
  was kept". That last wording is the writer's correction of this session's brief, which
  said "from the arrival" and was wrong for a take that kept the line before the older
  gate appeared. First piece on `haiku`: right at the first try. Its red and green run in
  the turn of its commit (the logs `t3c-red.log` and `t3c-gate.log` in the scratchpad).
- 2026-10-11 21:31 · `feat/gate-stop`: T4 and T5 committed, `b567112`, through the lock; the
  whole gate passed (`PASS tests`). Its turn was asked at 20:21:06 and ended at 21:31:04
  (`stop-gate.log`); it waited until about 21:14 behind four gates,
  two of them this session's and two that arrived after it: a fifth sighting of the lock
  that is no line, and a wait that the sixty minutes would have refused (`--wait 180`).
  Two proofs in that same gate, which ran this branch's own `check`: it printed no row
  `tree`, and `git status --short` in the worktree is empty after it, so no `Microsoft`
  folder was left, where the gate of `feat/gate-turn` an hour before left one. Its report:
  "medium risk, 6 paths, 913 lines: review due (slice_budget_reached)". Not done there
  yet: `main` (`40ccb45`) merged, gentle-ai, Codex, a real gate with a failing static row.
- 2026-10-11, after 21:31 · The pause of the context rule: this session read 84 percent
  before T3c's writer was launched and is near 88 now. The state is this document; what is in flight is the turn of T3c's
  commit (`t3c-turn.sh`, launched 21:21:10 by its log, which leaves `t3c-red.log` and `t3c-gate.log`).
  Much is left (two reviews, the roadmap, two pull requests, T9), so the session is
  compacted and goes on from "Resume here".
- 2026-10-11 22:08, after the compaction (context read at 22 percent) · The state was
  checked against the files, not the summary. T3c's turn, asked at 21:21:10, still waits:
  its log names three gates that took the lock meanwhile (`session-channel` 21:31:04,
  `sweep-code` 21:51:06, `session-channel` 22:07:36); whether they arrived after it is
  not read, since nothing is read beside a running gate. In `feat/gate-stop`, route
  inline (two lines and one test in two files): `main` (`40ccb45`) merged with no
  conflict; `failures` moved to the first place of the static rows, as "Design, 2" holds,
  with the test of pull request 66 that pinned it after `contracts`; a new test that a
  register which is not read stops the gate, alone and beside a failing budget; the
  roadmap's paragraph. Its turn was asked between 22:06 and 22:09 (`stopm-turn.sh`: the
  red of both tests against the old order, the merge commit, the roadmap's commit).
  Here, T7 written and not committed: the roadmap's paragraph of the line and of what
  `--wait` bounds, and the pointer in "Next" of `odd/tasks/gate-lock.md`; the texts of
  the manifest and of the help changed with T3.
- 2026-10-11, after 22:08 · T9 read and designed here, route one writer on `haiku` in a
  worktree of its own (`D:\js-harness-worktrees\count-git`, branch `fix/count-git-launch`
  from `main` `40ccb45`), so that a half-written test file is never in the tree of a gate
  of this branch. The text of the two findings is under "Not checked" of pull request 63.
  Cause, read in `scripts/count-git.mjs` (`missingReports`) and its preload: a report is
  matched to a launch by pid. `execSync` returns the output alone, so its launch records
  no pid, and the `node` behind its shell reports a parent nobody knows; and a Map by pid
  credits two launches whose shells got the same pid to one parent. Design: no pid. Each
  process takes an identity of its own (`crypto.randomUUID`), each launch it counts as
  `node` gets a token, identity and a number, set in `COUNT_GIT_LAUNCH` for the length of
  the call (the functions of `node:child_process` read the environment inside the call)
  and written into an environment the caller wrote out; the child reads it, deletes it
  from its own environment so that nothing it starts by another road inherits it, and
  reports it. A launch is missing when no report carries its token. Not taken: the
  starter's pid inherited through the environment, which credits to a process a `node`
  it did not count (behind `npm`, behind a hook) and so can hide one that never reported.

## Next
The commit of T3c in a turn of the lock (red of its new tests against the old code, then the
whole gate), `main` (`40ccb45`) merged, Codex on the fix alone, a real gate taken with
this branch's own lock, the roadmap, push and the pull request, which says that the default
of `--wait` waits for his word. In `feat/gate-stop`: the commit queued since 20:21, `main`
merged (the order of the static rows with `failures`), gentle-ai and Codex in their turn, a
real gate with a failing static row, the roadmap, push and its pull request. Last: T9.

## Resume here (state at 2026-10-11 21:20, for a session that lost its conversation)
- Two branches, two worktrees: `feat/gate-turn` in `D:\js-harness-worktrees\gate-turn`
  (the line; this document lives here alone) and `feat/gate-stop` in
  `D:\js-harness-worktrees\gate-stop` (the stop, the cache, the row `tree`).
- Every test run and every commit with code goes through the lock taken with the stable
  copy on `main`: `node D:/js-harness/bin/js-harness.mjs gate --wait 180 -- <command>`,
  launched in the background by this session and never by a sub-agent. A commit message is
  a file in the scratchpad (`git commit -F`). Logs of every run are in the scratchpad
  `…\d14eb9a1-e0dd-467c-8dc0-e2c7db2b0a86\scratchpad` (`*-gate.log`, `codex-s1.log`,
  `review-*.json`, `stop-*.log`).
- Before an assessment or a Codex review: the tree clean and nothing untracked; a gate
  leaves `Microsoft/` in the worktree until T5 is merged, and it is removed by hand first.
- What is his and open: the default meaning of `--wait` ("Ask me before"). The
  orchestrator asks him; `feat/gate-turn` is not merged before his answer.
- The review of gentle-ai for a slice: `gentle-ai review assess --cwd . --agent claude-code
  --base-ref <boundary> --committed-only --json`, then the commands it returns, verbatim;
  consent is granted without asking (`AGENTS.md`); the capture runs in a turn of the lock.
  The last reviewed tree of `feat/gate-turn` is `15f06b2`; `9b90797` is under budget. on `main..HEAD` in its turn,
the notice of T6, a real gate with this branch's own lock. In `feat/gate-stop`: the writer's
report, its diff read back, its commit through the lock, its two reviews.

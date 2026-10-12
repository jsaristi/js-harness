# The wait for the gate: a shorter suite, reviews that leave the line, one trial on GitHub

Locator: `odd/tasks/gate-wait.md` · Engram mirror: `odd/gate-wait/tasks` · Branch:
`feat/gate-wait`, in the linked worktree `D:/js-harness-worktrees/gate-wait`, cut from `main`
at `5f011cc` · Session: `JH 8 · turno y corte temprano del gate`, orchestrator
`JH ORQ · js-harness`

State 2026-10-12: opened by this session after `odd/tasks/gate-turn.md` closed its code
(pull request 71 on `main`). He is away for about eight hours from 03:38 (his words, the
orchestrator's transcript `65318fd5-80e7-4bb8-92b5-06737140185b.jsonl`, line 2381, read
here): nothing is asked of him; what is his goes to the orchestrator in one line. The design
below is a first version and no code is written from it until two readers that did not write
it have read it, one to attack it and one to look for what it leaves out.

## Goal
A commit waits less for the machine's gate with no check taken out: the suite is shorter by
what a measurement of it points at, a review no longer holds the gate lock, and one run on
GitHub says whether the gate can also run there and what a month of it would cost.

## Why
- One lock serves every session and it is almost never free. From 19:00 on 2026-10-11 it was
  held 379 of 406 minutes by 19 whole checks, all passed, 15.1 minutes each on average (the
  orchestrator's relief file, line 329). Turns of that night waited 6,076 and 7,060 seconds
  (the gate log, `js-harness gate log`; `odd/tasks/gate-turn.md`, the entries of 02:02 and
  03:23). The line of pull request 71 makes the wait fair; it does not make it shorter.
- His choice, "La opción C" (the same transcript, line 1504; what C is stands in the
  orchestrator's question at line 1493: "la 3, la 2 y el primer paso de la 4"). Before it:
  "hagamos mas rapido la bateria osea la opcion 3" (line 1384) and "quiero mas potencia"
  (line 1441): capacity is added, no check is removed. Not chosen, and nothing of them
  enters: the whole suite once per delivery, fewer sessions.
- Five of this session's thirteen turns of that night were reviews (the orchestrator's count
  in the question he answered). A review is a model that reads; whether it loads the machine
  enough to slow a gate beside it was never measured. The rule that keeps it in a turn is
  text alone: no code reads the lock for it (`bin/codex-review.mjs:646-648` is a message).
- A review in parts keeps no part that passed. On 2026-10-12 a review of three parts fell
  twice in its third, and each new run paid the first two again: 1,719,366 input tokens
  where the rate allowed 1,141,200 (`odd/tasks/gate-turn.md`, the entry of 03:23). The loop
  that asked again was this session's slip; that a second run costs the whole review is the
  harness's.
- Every merge to `main` costs each open branch a merge and a gate of about fifteen minutes,
  since a pull request is read only when its head contains `main`. That night this session
  ran six such gates on three branches (`19d05a9`, `be68d7c`, `8eb7aaa`, `2ce3100`,
  `1cb3904` and the one after it on `fix/count-git-launch`).

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/gate-wait.md` exits 0
- `node --test scripts/count-git.test.mjs` exits 0
- `node --test bin/codex-review.test.mjs` exits 0
- `node --test bin/gate.test.mjs bin/lib/gate-log.test.mjs` exits 0
- Progress holds the table of one whole run of the suite under the lock: for each test file
  its seconds, its Node and git processes and their seconds; and for the machine, the
  processor-seconds of the run by who spent them
- Progress holds the whole run's seconds before and after each cut, both measured inside a
  whole run under the lock, and says plainly when a cut gave nothing
- Progress holds what a review costs the machine, measured, and one gate with a review beside
  it against the same gate alone
- A test, named in Progress when it passes: the second run of a range whose third part
  failed starts one Codex session, not three
- One run of the gate on GitHub, quoted in Progress: each job's result and minutes; and the
  figure of a month of it, sent to the orchestrator as his decision, with nothing paid
- `docs/ROADMAP.md` says what the measurement found, what a review may run beside, and what
  the trial on GitHub answered

## In scope / Out of scope
- In: `scripts/count-git.mjs`, `scripts/count-git-preload.mjs` and their test (after pull
  request 69, which changes them, is on `main`); the test files and helpers the measurement
  points at; `bin/codex-review.mjs`, `bin/lib/codex-review-runs.mjs` and their tests for the
  parts that passed; `bin/gate.mjs`, `bin/lib/gate-log.mjs` and their tests for a command
  that runs beside the gate; the texts that say where a review runs (`docs/ROADMAP.md`, the
  message of `codex-review`); a workflow file on a trial branch that is never merged;
  `docs/ROADMAP.md`; this document.
- Out: taking a check out of the gate, or running fewer of its tests. The whole suite once
  per delivery and fewer sessions: not chosen. A workflow on `main`, a required check, any
  setting of his GitHub account, anything paid: his, after the figure. An exclusion in the
  machine's antivirus or any other change to the machine: his; this feature measures and
  brings the number. Whether a writer may run one test file beside a gate: the
  orchestrator's reading of its relief file, line 295, waits for his answer and is not built.
  The 1,200 s bound of a sensor. `AGENTS.md`: at its budget (1,499 of 1,500).

## Constraints
- One gate at a time on the machine: every test run, commit with code and review of this
  feature goes through the lock until this feature itself has shown, by its measurement,
  that a review may leave it. The measurement breaks the rule once, on purpose, inside this
  session's own turn, where the only gate it can slow is its own.
- A cut is proven inside a whole run under the lock, because a file timed alone lied once:
  three shards took 253 s alone where the file took 490 s, and the gate with them took 833 s
  (`odd/tasks/gate-lock.md:1092-1099`). An estimate is said to be an estimate.
- Codex inside the rate (the larger of 300,000 input tokens and 1,200 a changed line, by
  `codex-review --plan`); no loop of tries; a second run after a fall waits for him, through
  the orchestrator.
- The trial on GitHub runs only once it is written here, with its source, that it is free.
- Zero dependencies and every operating system, because `check` and `gate` ship to any
  project. A behavior change arrives with its test, written first.
- Writers are sub-agents on Haiku 5.5, one narrow piece each; they never run the gate or wait
  for it. This session commits.

## Effort
high

## Ask me before
- Paying for anything on GitHub, putting a workflow on `main`, or making a check required:
  the trial ends in a figure and a question for him, sent through the orchestrator.
- Any change to the machine (an antivirus exclusion, a setting of Windows, a tool installed).
- Building anything the measurement of a review beside a gate does not support: if a review
  slows the gate, the rule of 2026-10-10 stays and he is told the number.

## Design

### What is already known
- The gate runs one sensor, `npm run test`, which is `node --test` over 72 test files, with
  a bound of 1,200 s and no flag of its own (`bin/check.mjs:79`, `:137-158`, `:828`;
  `package.json:15`).
- A whole run is as long as its work, not as its longest file. The files' seconds added up
  were 3,942 and then 3,960 in runs of 910 and 747 s, so about four to five files ran side
  by side on four cores, eight logical (`odd/tasks/gate-lock.md:878-899`, `:1092-1099`).
  Splitting the longest file in three gave nothing inside a whole run and was taken out.
- The whole suite started 15,467 git processes, 2,363 s between them, in 941 Node processes,
  and 1,597 other processes; two files were 76% of the git (`odd/tasks/gate-log.md:503-508`,
  on 2026-10-11). Cuts of about 2,800 of them were made after that count
  (`odd/tasks/gate-log.md:533`, `:571`, `:651`) and the whole suite was not counted again
  (`:784`). The gates of the night of 2026-10-11 still took 829 to 1,061 s.
- So git explains about 2,400 of some 3,950 file-seconds, and the rest has never been looked
  at: 941 starts of Node, the tests' own work, and whatever the machine adds to every
  process that starts. The antivirus (`MsMpEng`) is named in the load sample of gate after
  gate (the gate log), and nobody has measured what it spends while a suite runs.

### Part 1 · A shorter suite (his "3")

**M1, the measurement, before any cut.** One whole run of the suite under the lock, with the
counting tool that exists (`scripts/count-git.mjs` and its preload, which already runs in
every Node process of a run and reports at exit), widened to answer two questions:

1. By test file: its wall seconds (the `test:summary` event of its own process, which the
   run of 2026-10-10 read with a reporter kept outside the repository; it comes into
   `scripts/`), its tests, the Node processes under it with the processor-seconds each
   reports of itself at exit (`process.cpuUsage()`), its git processes and their seconds
   (kept as today), its other processes.
2. By who spent the machine: the busy processor-seconds of the whole run (two readings of
   `os.cpus()`, as `bin/lib/machine-load.mjs` does over one second), split into what the
   Node processes reported, what the long-lived processes spent (a reading of every process's
   processor time before and after, by name, which catches the antivirus, the browsers and
   the sessions, and misses whatever started and ended inside the run), and the remainder,
   which is git and the other short processes.

The tool prints both tables; `--json` carries them. What the tool changes in what it
measures is already written in its header (five tests of `evals/` fail under it, since they
assert the exact environment of a child): the exit code of such a run is not the suite's and
the run is not a gate. It is one turn of the lock, about a quarter of an hour.

**The cut, chosen from the tables and not before.** The rule that chooses: a cut is taken
when the table shows it is worth 5% of the run or more, and it is judged inside a whole run.
What the tables may point at, each with what it would be:
- git in the tests' fixtures (a repository built by five git processes in test after test):
  a repository built once for a file and copied as a folder, which is no process at all. The
  one helper `gitDirs` did that for one file and took it from 640 to 490 s alone
  (`odd/tasks/gate-lock.md:913-915`).
- git in the product under test (what one `codex-review` asks of git, paid by every real
  review too): fewer questions, as the cuts of `odd/tasks/gate-log.md` were.
- the starts of Node (941 of them): tests that start the command where they could call its
  function. Each of those is a judgment on what the test proves, taken one by one.
- the machine's own share (the antivirus): nothing is built. The number goes to him with
  what an exclusion of the tests' temporary folder would be, as his decision.

If no line of the tables is worth 5%, this part ends with the tables and says so.

### Part 2 · A review leaves the line (his "2")

**M2, the measurement, before the rule changes.** Two numbers, both from reviews that are
due anyway, so no review is paid for the measurement alone:
1. What a review spends: the busy processor-seconds of the machine while a review runs
   alone in a turn, against the same length of a quiet machine. Read by the tool of M1 with
   a command in place of the suite (`count-git.mjs` runs tests; the machine's table is made
   a function both use). A review of Codex and one of gentle-ai, each once.
2. A gate with a review beside it: in one turn of this session, the suite and a review
   started together, and the suite's seconds against the same commit's suite alone in
   another turn. One pair does not see a small effect in a spread of 829 to 1,061 s; it
   sees a large one, and number 1 says how large the effect can be at most.

**What is built if M2 holds** (a review spends a small share of one processor, and the gate
beside it stays inside the spread):
- `js-harness gate --beside -- <command>`: runs the command without taking the lock, at a
  priority below normal (`os.setPriority` on the child; on Windows a child of a process
  below normal starts below normal, on the others niceness is inherited), so a gate that
  runs beside it keeps the processor. It writes its own `start` and `end` to the gate log
  with `beside: true`, so the log says what ran beside which gate and with what exit code:
  a review that fails is read as failed in the log, which a review inside a turn's script
  was not on 2026-10-12 (`exit 0` for a turn whose review had fallen).
- The texts: where a review runs (`docs/ROADMAP.md:58`, the message of `codex-review`), and
  the working rule: tests and whole suites keep the lock; a review runs beside.
- What is not built: anything for a writer's test file beside a gate.

If M2 does not hold, nothing of this is built; the numbers go to him.

**A review in parts keeps the parts that passed** (built whatever M2 says). Each part's run
is already a line of `codex-review-runs.jsonl` with its part (`index`, `of`, files, changed
lines), written for a run that failed too (`bin/codex-review.mjs:1451`,
`bin/lib/codex-review-runs.mjs:104-110`); what a part answered lives only in memory
(`bin/codex-review.mjs:1588-1601`). The change: the line of a part that passed also carries
what it answered, and a new run of the same range (the same base and head commits, the same
split) takes from the log each part that passed and asks only the others, saying so in its
output ("part 1 of 3 passed in the run of <when>: not asked again"). `--fresh` asks every
part again. The record of the review names the runs of all its parts, as today. Test first:
the second run of a range whose third part failed starts one Codex session, not three; a
range whose head moved reuses nothing; `--fresh` reuses nothing.

### Part 3 · One trial on GitHub (his "the first step of 4")

**What was read before anything runs, all read-only, 2026-10-12:**
- The repository is private, its owner is the user account `jsaristi`, Actions is enabled
  for it and it has never run a workflow (`gh repo view`, `gh api
  repos/jsaristi/js-harness/actions/permissions`, `…/actions/runs`: 0).
- Included each month for private repositories: 2,000 minutes on GitHub Free, 3,000 on Pro.
  Past them, by the minute: Linux 2-core $0.006, Windows 2-core $0.010. "If your account
  does not have a valid payment method on file, usage is blocked once you use up your
  quota." Source: https://docs.github.com/en/billing/concepts/product-billing/github-actions
  as it read on 2026-10-12. Which plan his account has was not read: the token has no
  `user` scope, and no scope is asked for. Free is the least it can be.
- Used so far in October: one run in his ten private repositories, a Dependabot update with
  0 billable milliseconds (`gh api repos/jsaristi/<name>/actions/runs?created=>=2026-10-01`
  for each, then `…/runs/<id>/timing`). Runs of organizations he belongs to do not count
  against a user's minutes.
- So a trial bounded at 180 minutes leaves at least 1,820 of 2,000 and costs nothing. Not
  read, and said so: whether the page's Windows minute counts as one included minute or two;
  the bound below holds for either.

**The trial.** A branch `trial/gate-on-github`, this feature's head plus one commit that
adds `.github/workflows/gate-trial.yml`:
- `on: push` to that branch alone, so it runs once, when the branch is pushed, and never
  again unless that branch is pushed again; the branch is deleted after the run is read.
- Two jobs, `ubuntu-latest` and `windows-latest`, each `timeout-minutes: 60` (120 minutes of
  runner at most; 180 included minutes if a Windows minute counts double), `permissions:
  contents: read`, no secret, Node 24 as on this machine, actions pinned by commit.
- Each job runs `node bin/check.mjs`, the gate as a commit runs it, and then prints the
  seconds of its sensor.
- What is read from it: whether the gate passes on each system and, where it does not,
  which tests fail and whether they are tests of this machine's own tools (92 tests of
  `bin/remote.test.mjs` skip off Windows already; PowerShell is called by a fixed path in
  `bin/lib/machine-busiest.mjs:330`); and the minutes of each job.
- The figure for him: runs a month (the pushes to pull requests of the last thirty days,
  counted from `gh`) times the minutes of a run, less the included minutes, times the price.
  And what it would buy: each branch its own gate at the same time, and the gate on the
  merge of a pull request with `main`, which today costs every open branch a turn of the
  one lock.
- The workflow never reaches `main` in this feature. Putting it there is his decision, with
  the figure.

### Order and slices
His order: the suite, the reviews, the trial. Each slice is its own pull request to `main`,
as the slices of `gate-turn` were:
- S1 · the measuring tool (T2) and its tables (T3, document only).
- S2 · the cuts the tables point at (T4).
- S3 · a review in parts keeps the parts that passed (T5).
- S4 · a command beside the gate, if M2 holds (T6, T7).
- The trial (T8) writes to this document alone.

Forecast: S1 about 300 changed lines, S3 about 300, S4 about 350; S2 is not known before
T3. Over the delivery budget of about 400 in all, so it is cut in the slices above.

## What the readers changed
(Filled after T1.)

## Tasks
- [ ] T1 · The design read twice by readers that did not write it, one to attack it, one to
      look for what is missing; their findings taken or answered here. Route: two read-only
      sub-agents. No code before it.
- [ ] T2 · The counting tool answers by file and by who spent the machine (Design, M1).
      Route: delegated, one writer, tests first. After pull request 69 is on `main`.
- [ ] T3 · M1: one whole run under the lock; both tables in Progress; the cuts chosen by the
      rule, with the numbers they are judged by. Route: inline, no source written.
- [ ] T4 · The cuts T3 chose, each judged inside a whole run. Route: set per cut in T3.
- [ ] T5 · A review in parts keeps the parts that passed. Route: delegated, one writer,
      tests first.
- [ ] T6 · M2: what a review spends, and one gate with a review beside it. Route: inline.
- [ ] T7 · If M2 holds: `gate --beside`, its line in the log, the texts. Route: delegated.
- [ ] T8 · The trial on GitHub: the workflow on its branch, one run, what it answered, the
      figure sent to the orchestrator. Route: inline, one file.
- [ ] T9 · Close: `docs/ROADMAP.md`, both reviews of each slice with code, pull requests,
      the closing notice.

## Progress
- 2026-10-12 · Opened. The map of the code is a read-only sub-agent's (72 test files, where
  the sensor runs, where a review's parts loop, what the gate log holds, what assumes
  Windows), spot-checked here at `odd/tasks/gate-lock.md:872-916` and `:1086-1102` and at
  `odd/tasks/gate-log.md:496-540`. What GitHub includes and charges, and what his account
  has used, were read by this session (Design, Part 3). From the orchestrator, to enter
  here (its message of about 03:27, a claim of the lead; its sources are lines 339, 340 and
  345 of its relief file, not read here yet): no automatic retry of a review in parts; a
  review keeps the parts that passed; a review that fails inside a turn reads as exit 0 in
  the gate log; every merge to `main` costs each open branch a gate. All four are in the
  design above. A fifth, a writer's test file beside a gate, waits for his answer.

## Next
T1: two readers on this design. Meanwhile pull request 69 (`fix/count-git-launch`) merges,
and `main` is merged in here before T2 touches the counting tool.

## Resume here
- Nothing is built. This document is the first commit of `feat/gate-wait`.
- `odd/tasks/gate-turn.md` on `main` holds the feature before this one and its closing
  state; pull request 69 is its last piece.
- Every test run, commit with code and review goes through the lock: `node
  D:/js-harness/bin/js-harness.mjs gate --wait 180 -- <command>`, in the background, from
  this session and never from a sub-agent. Nothing is edited in a worktree while a turn of
  that worktree is asked or running.
- After a compaction, the first act is one line to the lead: title, hour, context share,
  what is resumed.

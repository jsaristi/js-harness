# The wait for the gate: a shorter suite, reviews that leave the line, one trial on GitHub

Locator: `odd/tasks/gate-wait.md` · Engram mirror: `odd/gate-wait/tasks` · Branch:
`feat/gate-wait`, in the linked worktree `D:/js-harness-worktrees/gate-wait`, cut from `main`
at `5f011cc` · Session: `JH 8 · turno y corte temprano del gate`, orchestrator
`JH ORQ · js-harness`

State 2026-10-12: opened by this session after `odd/tasks/gate-turn.md` closed (pull requests
68 and 71 on `main`, 69 with the orchestrator). He is away for about eight hours from 03:38
(the orchestrator's transcript `65318fd5-80e7-4bb8-92b5-06737140185b.jsonl`, line 2381, an
attachment of kind `queued_command` and human origin, read here): nothing is asked of him;
what is his goes to the orchestrator in one line. The design below is the second version: two
readers that did not write the first (`bfb2009`) read it, one to attack it and one to look
for what it left out and for his earlier words, and "What the readers changed" says what
moved.

## Goal
A commit waits less for the machine's gate with no check taken out: the suite is shorter by
what a measurement of it points at, a review no longer holds the gate lock, and one run on
GitHub says whether the gate can also run there and what a month of it would cost.

## Why
- One lock serves every session and it is almost never free. From 19:00 on 2026-10-11 it was
  held 379 of 406 minutes; 287 of them were 19 whole checks, all passed, 15.1 minutes each
  on average (the orchestrator's relief file, line 329). Turns of that night waited 6,076
  and 7,060 seconds (the gate log; `odd/tasks/gate-turn.md`, the entries of 02:02 and
  03:23). The line of pull request 71 makes the wait fair; it does not make it shorter.
- His choice, "La opción C" (the same transcript, line 1504, a user entry; what C is stands
  in the orchestrator's question at line 1493: "la 3, la 2 y el primer paso de la 4").
  Before it, both attachments of kind `queued_command` and human origin: "hagamos mas rapido
  la bateria osea la opcion 3" (line 1384) and "quiero mas potencia" (line 1441): capacity
  is added, no check is removed. Not chosen, and nothing of them enters: the whole suite
  once per delivery, fewer sessions.
- What each part can give, said before it is built. The whole checks are three quarters of
  the held minutes, so only a shorter suite or a second place to run it moves most of the
  wait. Reviews were five of this session's thirteen turns of that night (the
  orchestrator's count in the question he answered) and at most a quarter of the held
  minutes: taking them out of the line frees that much and no more.
- The rule that keeps a review in a turn is the orchestrator's notice of 2026-10-10 ("While
  any gate runs: no test run and no board read", pasted by him into a session, transcript
  `213bd4ec`, line 587, by the second reader), widened to reviewers after a gate ended with
  under two minutes of margin on its 1,200 s bound. It is text alone: no code reads the lock
  for a review (`bin/codex-review.mjs:646-648` is a message). Whether a review loads the
  machine enough to matter was never measured. What he chose for it: "primero se mide que
  una revisión al lado no vuelva lento el control" (line 1493, the option he took).
- A review in parts keeps no part that passed. On 2026-10-12 a review of three parts fell
  twice in its third, and each new run paid the first two again: 1,719,366 input tokens
  where the rate allowed 1,141,200 (`odd/tasks/gate-turn.md`, the entry of 03:23). The loop
  that asked again was this session's slip; that a second run costs the whole review is the
  harness's.
- Every merge to `main` costs each open branch a merge and a gate of about fifteen minutes,
  since a pull request is read only when its head contains `main`. That night this session
  ran six such gates on three branches (`19d05a9`, `be68d7c`, `8eb7aaa`, `2ce3100`,
  `1cb3904`, `1930679`). Nothing local answers that without his word (Design, "Brought to
  him"); a gate that GitHub runs on a pull request's merge with `main` would.
- His question of 2026-10-12 on findings like these: "todas estas mejoras… van a quedar
  implementadas en el harnes cierto?" (line 2116, by the second reader). So each finding
  here names where it lands in the harness, not only what this session will do.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/gate-wait.md` exits 0
- Progress holds the tables of one whole run of the suite under the lock: by test file, when
  it started and ended, its processes and their seconds; by who spent the machine; what a
  process costs to start; and the same run again after each cut, with the counts beside
- Progress says of each cut what it gave by the counts, and plainly when it gave nothing or
  when the tables pointed at nothing worth cutting
- Progress holds what a review spends, the number it had to stay under, written before it
  was measured, and whether it did
- A test, named in Progress when it passes: the second run of a range whose third part
  failed starts one Codex session, not three, and its review holds the findings of all three
- One run of the suite on GitHub quoted in Progress with each job's result and minutes, or
  the reason it was not run; and the figure of a month of it sent to the orchestrator as his
  decision, with nothing paid
- `docs/ROADMAP.md` says what the measurement found, what may run beside a gate, and what
  the trial on GitHub answered

## In scope / Out of scope
- In: `scripts/count-git.mjs`, `scripts/count-git-preload.mjs` and their test (after pull
  request 69, which changes them, is on `main`); the test files and helpers the measurement
  points at, and the `test` script of `package.json` if the number of files side by side is
  one of them; `bin/codex-review.mjs`, `bin/lib/codex-review-runs.mjs` and their tests; the
  texts that say where a review runs (listed in Design, Part 2); a workflow file on a trial
  branch that is never merged; `docs/ROADMAP.md`; this document.
- Out: taking a check out of the gate, or running fewer of its tests. The whole suite once
  per delivery and fewer sessions: not chosen. A workflow on `main`, a required check, any
  setting of his GitHub account, anything paid: his, after the figure. An exclusion in the
  machine's antivirus or any other change to the machine: his; this feature measures and
  brings the number. A gate that is not run because its tree, or its kind of merge, was
  already tested: his, it ships (Design, "Brought to him"). Whether a writer may run one
  test file beside a gate: the orchestrator's reading of its relief file, line 295, waits
  for his answer. The rule that no test and no board read runs beside a gate: it stands.
  The list of rules of "JH 7" (`odd/tasks/rule-hierarchy.md:850`, its rule 60): theirs; the
  orchestrator is told when the rule changes. The 1,200 s bound of a sensor. `AGENTS.md`: at
  its budget (1,499 of 1,500).

## Constraints
- One gate at a time on the machine: every test run and commit with code of this feature
  goes through the lock, and so does every review until M2 says a review may leave it. M2
  runs one review beside a gate on purpose, the gate being this session's own.
- A cut is proven by counts taken in a whole run under the lock, never by a file timed
  alone and never by one run's seconds against another's: three shards took 253 s alone
  where the file took 490 s and the gate with them took 833 s
  (`odd/tasks/gate-lock.md:1092-1103`), and the gates of one night spread from 829 to 1,110
  seconds. An estimate is said to be an estimate.
- Codex inside the rate (the larger of 300,000 input tokens and 1,200 a changed line, by
  `codex-review --plan`); no loop of tries; a second run after a fall waits for him, through
  the orchestrator. Forecast for the feature, an estimate: five reviews at the floor, about
  1.5 million input tokens before any correction; the orchestrator was asked whether its
  bound of 3 million a feature stands.
- The trial on GitHub runs only once it is written here, with its source, that it is free.
- Zero dependencies and every operating system, because `check` and `codex-review` ship to
  any project. Anything that ships is judged twice: here, and in a project that installed
  the harness (`docs/ROADMAP.md:709-710`). A behavior change arrives with its test, first.
- Writers are sub-agents on Haiku 5.5, one narrow piece each; they never run the gate or wait
  for it. This session commits. Nothing is edited or committed in a worktree while a turn or
  a review of that worktree runs.

## Effort
high

## Ask me before
- Paying for anything on GitHub, putting a workflow on `main`, or making a check required:
  the trial ends in a figure and a question for him, sent through the orchestrator.
- Any change to the machine (an antivirus exclusion, a setting of Windows, a tool installed).
- Letting a review run beside a gate when M2 does not stay under its number: then the rule
  stays and he is told the number.
- Whether the rate of a Codex review counts the runs of the same range that fell: he has
  typed nothing on retries (the second reader searched the 57 transcripts for `reintent`).
  Until he says, they count, and a second run waits for him.
- A gate that is skipped or reused (Design, "Brought to him").

## Design

### What is already known
- The gate runs one sensor, `npm run test`, which is `node --test` over 72 test files, with
  a bound of 1,200 s and no flag of its own (`bin/check.mjs:79`, `:137-158`, `:828`;
  `package.json:15`). A commit of documents alone runs no sensor: his word and built
  (transcript `182ad401`, line 1403; `bin/check.mjs:237-263`).
- The run is as long as its longest file. In the last run read by file (2026-10-11, 867 s)
  `bin/codex-review.test.mjs` took 865.8 s, "which is the run"
  (`odd/tasks/gate-lock.md:1243-1247`): the tests of a file run one after another, files
  run seven at a time on four cores (`:352-353`, `:1101`), and that file takes 490 s when it
  runs alone (`:913-915`). So its time in a gate is its own work plus what the other files
  take from it while they run beside it. Splitting it in three gave nothing inside a whole
  run and was taken out (`:1092-1103`). How many files run side by side was never tried at
  another number: no document of the gate records it.
- The whole suite started 15,467 git processes, 2,363 s between them, in 941 Node processes,
  and 1,597 other processes; two files were 76% of the git (`odd/tasks/gate-log.md:503-508`,
  2026-10-11). The two files then went from 11,735 git processes to 8,213 (`:571`, `:651`),
  and the whole suite was not counted again (`:784`).
- Never measured: what a Node or a git process costs to start on this machine, quiet and
  inside a suite ("0.5 s per git and 1 s per Node", with the quiet figure unknown: relief
  file, line 90); what the antivirus (`MsMpEng`, named in the load sample of gate after
  gate) spends while a suite runs; what the 941 Node processes spend.

### Part 1 · A shorter suite (his "3")

**M1, the measurement, before any cut.** One whole run of the suite under the lock with the
counting tool that exists (`scripts/count-git.mjs` and its preload, which runs in every Node
process of a run and reports at exit), widened. It is not a gate: it runs in the real home,
without the gate's environment, and five tests of `evals/` fail under the tool (its header);
so a run is compared only with another run of the same tool. What it prints, and `--json`
carries:

1. By test file: when its process started and ended, counted from the start of the run (the
   time line that says which files run beside the long one), its tests, and for the
   processes under it: Node processes with the processor-seconds each reports of itself at
   exit (`process.cpuUsage()`) and the wall seconds of each child whatever it is (today only
   git is timed, `scripts/count-git-preload.mjs:141-153`), git by sub-command as today.
2. For the five longest files, the seconds of each test, from the reporter's events, so a
   cut inside a file has something to aim at.
3. The machine over the run: busy processor-seconds from two readings of `os.cpus()`
   (without the `irq` column, which Windows already counts inside `sys`), checked against
   the wall time times the logical processors; of them, what the Node processes reported of
   themselves; what each process that lived through the run spent, by name, from a reading
   of every process's processor time and creation time before and after (this is where the
   antivirus, the browsers and the sessions show); and the rest, printed as **not
   attributed**, with git's summed wall seconds beside it as its upper bound for git. Not
   attributed also holds the runner process, Node processes killed before they exit, and
   shells.
4. What a start costs: before the suite and again in its middle, twenty starts of `git
   --version` and ten of `node -e ""`, timed; and beside them the free memory and the
   number of entries in the temporary folder (`docs/FAILURES.md:637-643`).

**The cuts, chosen from the tables and not before**, largest line first, each taken only
when the table makes it worth a twentieth of the run's processes or of its attributed
processor-seconds, and each judged by a second run of M1: the counts must drop by what the
cut claimed, and the wall time is reported, with the load row beside it, as one reading and
no proof. What the tables may point at:
- Files side by side: if the time line shows the long file slowed by the six beside it, the
  number of files at a time (`node --test --test-concurrency=<n>` in the `test` script) is
  tried at four, one run. It moves no test and removes none.
- git in the tests' fixtures: a repository built once for a file and copied as a folder, no
  process at all, as `gitDirs` did for one file.
- git in the product under test (what one `codex-review` asks of git, which a real review
  pays too): fewer questions, as the cuts of `odd/tasks/gate-log.md` were.
- Starts of Node: tests that start the command where they could call its function, judged
  one by one for what the test proves.
- The machine's own share (the antivirus, a start that costs ten times more inside a suite
  than on a quiet machine): nothing is built; the number goes to him with what an exclusion
  of the tests' temporary folder would be.

### Part 2 · A review leaves the line (his "2")

**Kept parts, built whatever M2 says (T5).** Where it lands in the harness: `codex-review`
itself, so a fall costs one part and a rerun is no longer something to loop on.
- Today each part's run is a line of `codex-review-runs.jsonl` with counts alone
  (`bin/codex-review.mjs:1414`, `:1447-1451`); what the part answered lives in memory
  (`:1588-1601`) and the final review needs all of it: findings, verdict, the rendered
  text, tokens and seconds (`:1606-1620`). A part "passes" when its session ended with a
  review that can be read, findings or not (`:1481`).
- The change: the line of a part that passed also carries what it answered, and a key: a
  hash of the exact prompt sent, the arguments Codex was started with, the base and head
  commits and a format number. A new run computes the key of each part it is about to ask
  and takes from the log the newest line with that key, answer included; it asks the
  others. Anything that changes what is sent (the model, the effort, `--doc`, `--prompt`,
  `--part-lines`, where the range starts, the files left out, a newer prompt) changes the
  key, so nothing is reused across them. A line with no key or no answer, from an older
  version, is asked again.
- What a reused part gives the review: its findings and rendered text as if it had just
  run, and the line of totals says apart what was spent now and what earlier, so the rate
  reads true. The output says "part 1 of 3 passed in the run of <when>: not asked again".
  `--fresh` asks every part again.
- The failure message says what the next run costs ("the next run asks part 3 alone"), in
  place of today's bare "run it again".
- Tests first: the second run of a range whose third part failed starts one session and its
  review holds the findings of all three; a head that moved reuses nothing; another effort
  reuses nothing; `--fresh` reuses nothing; a line of an older shape is asked again; the
  totals keep now and earlier apart.

**The head a review reads is pinned (T6), built whatever M2 says.** `codex-review` resolves
`HEAD` once (`bin/codex-review.mjs:1080`) and checks once that the tree is clean (`:1177`),
then diffs against the word `HEAD` again (`:1201`) and hands Codex a range that ends at the
live `HEAD`. Inside a turn nothing can commit meanwhile; beside a gate, or in any project
without turns, a commit made during the review is reviewed in part and recorded as the old
head. The change: every question after the first uses the commit id read at the start, and
before the record is written `HEAD` and the tree are read again; if either moved, no record
is written and the message says so. Tests first. Two reviews that end together both append
one line to the record of reviews (`bin/lib/codex-reviews.mjs:75`); the test of that file
says whether two appends at once can tear a line, and if they can, the append is made whole.

**M2, the measurement, before the rule changes.** The number is fixed here, before anything
is measured. The smallest margin a logged gate left on its bound is 90 s (1,110 s of 1,200,
`odd/tasks/gate-log.md:543`). A review may run beside a gate if, measured:
1. *It spends little.* The busy processor-seconds of the machine while the review runs alone
   in a turn, less the same length of the quiet machine just before it, divided by the four
   cores: that is the most it can add to a gate beside it, and it must be **under 30 s**,
   a third of that margin. Read with M1's reading of the machine, a command in place of the
   suite. One review of Codex and one of gentle-ai, saying which shape (one lens or four).
2. *It still ends.* One review run beside one gate of this session, the gate being a commit
   of this feature that is due anyway: the review must end with an answer, and its seconds
   are written beside its seconds alone. A review that fell beside a gate is in the
   register twice (gentle-ai, `operation_timeout`, `docs/FAILURES.md:531`); Codex stops at
   thirty minutes (`bin/codex-review.mjs:641`). The gate's own seconds are written too, as
   one reading inside a spread of 829 to 1,110 s and no proof.
Both reviews are ones this feature owes anyway, so M2 pays for no review and no extra gate.

**If M2 holds**, what changes is small, because nothing in the code holds a review in a
turn:
- The texts that say a review runs in a turn of the lock, every one: `docs/ROADMAP.md:58`;
  the message of `codex-review` (`bin/codex-review.mjs:646-648`) and its two tests
  (`bin/codex-review.test.mjs:2653`, `:2724`); the shipped skill (`bin/lib/manifest.mjs:27`,
  `:98`) and the help (`bin/js-harness.mjs:25`); the comments at `bin/gate.mjs:3` and
  `bin/check.mjs:467`; the control of `docs/FAILURES.md:326-344`, which quotes the
  manifest. They come to say: a test run keeps the lock; a review runs beside, in a
  worktree nobody edits or commits in until it ends.
- The priority of a review is lowered only if number 1 comes near its bound: then
  `codex-review` lowers its own priority before it starts Codex (`os.setPriority` on
  itself, which every child inherits on the three systems, with no child to catch), and
  number 2 is measured that way. Otherwise nothing is lowered: a review starved of the
  processor is a review that falls after it was paid.
- Not built: a command that runs anything beside the gate, and a line in the gate log for
  it. The first reader showed both cost more than they give: the run log of `codex-review`
  already holds each review's start, seconds and outcome, a new field on a gate's line is
  read as a gate by every other version of the reader (`bin/lib/gate-log.mjs:295-303`), and
  a review of gentle-ai is several commands, not one.
- The review that reads as `exit 0` when it failed inside a turn's script lands here too: a
  review that runs as its own command has its own exit code. For the turns that remain, the
  roadmap's section on the lock says that a turn is one command, and that a script handed
  to it ends with the code of its first step that failed.

**If M2 does not hold**, the rule stays, the texts stay, and the number goes to him; kept
parts, the pinned head and the sentence about a turn's script are built all the same.

### Part 3 · One trial on GitHub (his "the first step of 4")

**What was read before anything runs, all read-only, 2026-10-12:**
- The repository is private, its owner is the user account `jsaristi`, Actions is enabled
  for it and it has never run a workflow (`gh repo view`; `gh api
  repos/jsaristi/js-harness/actions/permissions`: enabled; `…/actions/runs`: 0).
- Included each month for private repositories: 2,000 minutes on GitHub Free, 3,000 on Pro.
  Past them, by the minute: Linux 2-core $0.006, Windows 2-core $0.010. "If your account
  does not have a valid payment method on file, usage is blocked once you use up your
  quota." Source: https://docs.github.com/en/billing/concepts/product-billing/github-actions
  as it read on 2026-10-12. The plan itself cannot be read (the token has no `user` scope,
  and none is asked for); `docs/ROADMAP.md:681-684` records that branch protection is
  refused to this private repository, which is what Free does. 2,000 is the least it can be.
- Used so far in October: one run in his ten private repositories, a Dependabot update of 0
  billable milliseconds (`gh api "repos/jsaristi/<name>/actions/runs?created=>=2026-10-01"`
  for each, then `…/runs/<id>/timing`).
- The token can push a workflow: its scopes are `gist`, `read:org`, `repo`, `workflow` (`gh
  auth status`). No scope is added.
- So a trial bounded at 270 included minutes (below) leaves at least 1,730 of 2,000 and
  costs nothing. Not read, and said so: whether a Windows minute counts as one included
  minute or two; the bound holds for two.

**The trial.** A branch `trial/gate-on-github`, this feature's head plus one commit that
adds `.github/workflows/gate-trial.yml`:
- `on: push` to that branch alone. It runs when the branch is pushed and at no other time;
  nothing pushes to it again, and "Re-run" in the page is a person's click. The branch is
  left where it is: deleting it is not needed for that.
- Two jobs, `ubuntu-latest` and `windows-latest`, each `timeout-minutes: 90` (180 minutes of
  runner at most; 270 included minutes if a Windows minute counts double), `permissions:
  contents: read`, no secret, Node 24 as on this machine, the two actions pinned by commit,
  `fetch-depth: 0`.
- Each job first runs `node --test` with the reporter of M1, with no bound but the job's:
  the runners have two cores where this machine has eight logical, the files' seconds here
  add up to some 3,950, and the gate's own sensor would be killed at 1,200 s and say
  nothing. Then, whatever that gave, `node bin/check.mjs`, to see the gate itself there.
  The job prints the git settings it ran under (`core.autocrlf`, the identity).
- What is read from it: by system, the tests passed, failed and skipped, the seconds by
  file, and which failures are tests of this machine's own tools (92 tests of
  `bin/remote.test.mjs` skip off Windows already; PowerShell is called by a fixed path in
  `bin/lib/machine-busiest.mjs:330`).
- The file is code. Its commit takes one gate of this machine; its push needs a Codex
  record, which `check --push` asks of every path that is not Markdown
  (`bin/lib/codex-review-scope.mjs:53`); gentle-ai assesses it. A run that fails sends him
  GitHub's own mail: the orchestrator is told before the push, so that it is expected.
- The figure for him, with its unit said: what a gate there costs in minutes, times the
  gates a month it would take over, which are named: the gate of each push to a pull
  request and the gate of its merge with `main` (the six of one night above), not the gate
  of each commit, which stays on this machine. Less the included minutes, times the price.
  And beside the figure, what it would not give: a check cannot be required on this plan,
  and a red run there beside a green gate here needs a rule he has not made, since each
  system skips tests the other runs.
- The workflow never reaches `main` in this feature. Putting it there is his decision.

### Brought to him, not built
Two ways to stop paying twice for one check, found by the second reader. Both ship and both
decide what a gate is, so they are his: (1) a clean merge of `main` whose incoming changes
are documents alone runs no sensor, which extends his rule for commits of documents; none
of this session's six merges of that night was one. (2) A gate whose tree was already
gated is not run again: nothing in the log is keyed by tree today (`bin/lib/gate-log.mjs:352`),
and it would drop the second run that catches a test that fails only sometimes. They go to
the orchestrator with the trial's figure, as one question.

### Order and slices
His order: the suite, the reviews, the trial. The measuring tool waits for pull request 69,
which changes the same two files; until it is on `main`, kept parts go first. Each slice is
its own pull request to `main`:
- S1 · kept parts and the pinned head (T5, T6), about 500 changed lines, two commits.
- S2 · the measuring tool (T2) and its tables (T3, document alone), about 400.
- S3 · the cuts the tables point at (T4): not known before T3.
- S4 · the texts, if M2 holds (T8), about 60.
- The trial (T9): one commit on its own branch, never merged, and this document.

## What the readers changed
The first version is `bfb2009`. Two read-only readers, 2026-10-12; their reports are in this
session's transcript.
- **The attack** (14 findings, six of them holes). Taken: a review beside a gate reads a
  head that can move, so the head is pinned (T6, new). M2 measured a review at normal
  priority and judged it "inside the spread": now its number is fixed before it is
  measured, tied to the smallest margin on the bound, and the review's own end is part of
  it. The key of a kept part was "the same base, head and split", which the log cannot even
  check (it stores a count of files): now a hash of what is sent; and what a part answered
  is said field by field. The trial ran the gate alone, which on two cores would have
  answered "timed out": now the suite runs first with no bound of its own. The workflow is
  code, with a gate, a Codex record and his mail on a failure: said. M1's remainder was
  called git: now "not attributed", with its check. The rule of 5% had no unit and one run
  cannot see it: cuts are judged by counts. `gate --beside` and its line in the log: taken
  out, as over-built. Three commands of "Done when" ran whole test files outside the lock:
  taken out. Two numbers corrected (the cuts made were 3,522 processes, not "about 2,800";
  git's seconds and the files' seconds are of two different days and are no longer
  subtracted). Answered, not taken: "the measuring tool waits for a code merge that is his":
  the orchestrator merges pull requests tonight (68, 70, 71) and has 69.
- **What was missing and his words** (19 findings). Taken: three of the quotes are
  attachments of a queued command, not user entries: said. The rule of 2026-10-10 is the
  orchestrator's notice and its reason is the margin on the bound: said, and it shapes M2.
  Commits of documents are already his word and built: under "already known". His question
  whether every finding lands in the harness: each one now says where. A forecast of Codex
  for the feature: added. The time line by file, the seconds by test in the long files, the
  cost of a start, free memory and the temporary folder: into M1. The number of files side
  by side, never tried: a candidate cut. The texts the first version forgot (the shipped
  skill, the help, two comments, two tests, the register): listed. What the figure for him
  must say (the unit, no required check on this plan, a red run there beside a green one
  here): added. End states the contract could not say (no run on GitHub, nothing worth
  cutting): "Done when" now can. A gate keyed by tree and a merge of documents alone:
  under "Brought to him". Not taken: a census of every turn of the night (three that ended
  `exit 1` and one `exit 5`): it explains the past and moves nothing here.

## Tasks
- [x] T1 · The design read twice by readers that did not write it; their findings taken or
      answered. Evidence: "What the readers changed"; the commit that holds it.
- [ ] T2 · The counting tool answers by file, by test in the long files, by who spent the
      machine, and what a start costs (Design, M1). Route: delegated, one writer a piece,
      tests first. After pull request 69 is on `main`.
- [ ] T3 · M1: one whole run under the lock; the tables in Progress; the cuts chosen, with
      the counts they are judged by. Route: inline, no source written.
- [ ] T4 · The cuts T3 chose, each judged by a second run. Route: set per cut in T3.
- [ ] T5 · A review in parts keeps the parts that passed. Route: delegated, tests first.
- [ ] T6 · The head a review reads is pinned, and two records at once. Route: delegated,
      tests first.
- [ ] T7 · M2: what a review spends against its number, and one review beside one gate.
      Route: inline, with the reviews of S1.
- [ ] T8 · If M2 holds: the texts. Route: delegated, one writer.
- [ ] T9 · The trial on GitHub: the workflow on its branch, one run, what it answered, the
      figure and the two questions sent to the orchestrator. Route: inline, one file.
- [ ] T10 · Close: `docs/ROADMAP.md`, both reviews of each slice with code, pull requests,
      the closing notice.

## Progress
- 2026-10-12 · Opened (`bfb2009`). The map of the code is a read-only sub-agent's (72 test
  files, where the sensor runs, where a review's parts loop, what the gate log holds, what
  assumes Windows), spot-checked here at `odd/tasks/gate-lock.md:872-916` and `:1086-1102`
  and at `odd/tasks/gate-log.md:496-540`. What GitHub includes and charges and what his
  account has used were read by this session (Design, Part 3). From the orchestrator (its
  message, read here before 03:28, a claim of the lead; its sources are lines 339, 340 and 345 of
  its relief file): no automatic retry of a review in parts; a review keeps the parts that
  passed; a review that fails inside a turn reads as exit 0 in the gate log; every merge to
  `main` costs each open branch a gate. All four are in the design. A fifth, a writer's
  test file beside a gate, waits for his answer.
- 2026-10-12 · T1. Two readers, both read-only, launched after 03:50 (by `date`) while this session's
  own gate ran; the second version of the design is this commit. Spot-checked here before
  their findings were taken: `bin/codex-review.mjs:1080`, `:1177` and `:1201` (the head is
  read once and the diff asks for the word `HEAD` again); `bin/lib/codex-review-scope.mjs:53`
  (a document is a Markdown file, so a workflow is code); `bin/check.mjs:237-263` (commits
  of documents). Sub-agents so far: 545,270 tokens (the map 120,428, the readers 197,318
  and 227,524).

## Next
T5 while pull request 69 is not on `main`: the writer's piece is the key and the stored
answer in `bin/lib/codex-review-runs.mjs` with its tests, then the reuse in the loop of
`bin/codex-review.mjs`. When 69 is merged: `main` merged in here, then T2.

## Resume here
- No code is written yet. The branch holds this document alone, two commits.
- `odd/tasks/gate-turn.md` holds the feature before this one; its last entry is on
  `fix/count-git-launch` until pull request 69 merges.
- Every test run and commit with code goes through the lock: `node
  D:/js-harness/bin/js-harness.mjs gate --wait 180 -- <command>`, in the background, from
  this session and never from a sub-agent; a turn is one command, and a script handed to it
  ends with the code of its first step that failed. Nothing is edited in a worktree while a
  turn of that worktree is asked or running.
- No Codex call in a loop, none on a range already paid for; `--plan` first.
- After a compaction, the first act is one line to the lead: title, hour, context share,
  what is resumed.

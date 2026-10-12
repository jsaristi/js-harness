# The wait for the gate: a shorter suite, reviews that leave the line, one trial on GitHub

Locator: `odd/tasks/gate-wait.md` · Engram mirror: `odd/gate-wait/tasks` · Branch:
`feat/gate-wait`, in the linked worktree `D:/js-harness-worktrees/gate-wait`, cut from `main`
at `7411fe6` (first at `5f011cc`; replayed before any push) · Session: `JH 8 · turno y corte temprano del gate`, orchestrator
`JH ORQ · js-harness`

State 2026-10-12: opened by this session after `odd/tasks/gate-turn.md` closed (pull requests
68 and 71 on `main`, 69 with the orchestrator). He is away for about eight hours from 03:38
(the orchestrator's transcript `65318fd5-80e7-4bb8-92b5-06737140185b.jsonl`, line 2381, an
attachment of kind `queued_command` and human origin, read here): nothing is asked of him;
what is his goes to the orchestrator in one line. The design below is the second version: two
readers that did not write the first (`335ce6f`) read it, one to attack it and one to look
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
  1.5 million input tokens before any correction. No total for a feature stands, by the
  orchestrator's answer of 2026-10-12 (its relief file, lines 236 and 305): each review
  inside the rate, and the running total written in Progress.
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

### No repeated control (slice S4, branch `feat/gate-wait-same-tree`, off `main` 3088960)

His decision of 2026-10-12 (the lead's transcript, line 3913, on the list of line 3860): a tree identical to
one that already passed runs no suite again; a clean merge of `main` that brings only documents runs none
either; a merge that brings any code runs the whole suite, so no verification is lost.

What the code is today, read by one reader on `main` and spot-checked at `bin/check.mjs:842-843` and
`:866-884`:

- A gate's sensors read the working tree on disk, never the index: they are started in `cwd` with every git
  binding variable removed (`bin/check.mjs:497-507`). Nothing asks whether the working tree is the index.
- The gate log (`bin/lib/gate-log.mjs:350-399`, `gateRecord`) holds no identity of what a gate tested: its
  `end` line is `seconds`, `result`, `sensors`.
- A commit that stages declared documents alone already runs no sensor (`stagedDocuments`,
  `bin/check.mjs:237-264`), and that holds for a merge of `main` made as `git merge --no-commit` and then
  `git commit`, whose staged paths are read against the first parent. So the second of his three sentences
  is already true of a merge committed through the hook, and this slice builds nothing for it.
- A plain `git merge` runs no `pre-commit` hook (`odd/tasks/gate-log.md:805-813`), so today a merge that
  brings code can be made with no gate at all. Git has a hook for it, `pre-merge-commit`, which this
  repository does not install.
- No notion of "this tree already passed" exists: `rg -n -i "write-tree|tree id|already passed|same tree"
  bin scripts .githooks` finds two sentences about timing and nothing else.

**How "already passed" is proven.** By one line of the gate log, written by a gate that ran every sensor and
passed, which names the same tree as the gate that asks. Nothing else counts: not a gate that ran no sensor,
not a `gate -- <command>` turn (its line ends `exit 0`, never `pass`), not a record written by hand.

1. *The tree of a gate* is a key, 64 hex characters: the SHA-256 of a format number, the listing of the
   index the hook was handed (`git ls-files -s -z`: each entry a mode, an object id, a stage and a path, so
   two listings that are equal hold the same bytes at the same paths), how each file is written in the
   folder (`git ls-files --eol`: the same blob can be on disk with other line ends), the sensors (each
   name and command, in order), and what runs them (`process.version`, `process.platform`,
   `process.arch`). Every path is in it, the declared documents too: this repository's suite reads them
   (`bin/sessions.test.mjs:553`, and `bin/rules.test.mjs:390-394` through `bin/rules.mjs:94-100`), so a key
   that left them out would call two trees the same that the suite answers differently.
2. *The key exists only when the folder is that index.* All of: `git status --porcelain -z
   --untracked-files=all --ignore-submodules=none` shows no unstaged change and no untracked file; no entry
   is marked assume-unchanged or skip-worktree (`git ls-files -v`: a lowercase tag, or `S`), since git
   reports those clean over changed bytes; and `cwd` is the top of the repository. Every one of these
   questions is asked under the binding the hook was given, after the test `stagedDocuments` already makes
   that the binding is of this repository (`bin/check.mjs:249-259`): `git commit <path>` hands the hook a
   temporary index, and a status asked without it reads the other index and calls the folder clean. Where
   git does not answer, or any of it fails, there is no key: the gate runs its sensors as today and its
   line holds none.
3. *A gate that runs its sensors* computes the key before them and again after them, before its `end` line
   is written, and writes it on that line, as `code`, only when both are the same key and the result is
   `pass`. A throw leaves none.
4. *A gate that has a key* looks, after its static rows and the stop they can cause and before it asks for
   the lock or samples the load, for an `end` line with `result: "pass"` and that `code`. With one it runs
   no sensor and takes no lock, so it does not wait in the queue either; its row says that no sensor ran,
   and which gate proved the tree: its id and when it ended, and its folder when its `start` line is still
   in the log. It writes one line of a new kind, `same`, with the key and the id of that gate, so the log
   says which proof stood behind which commit. A gate that waited for the lock looks once more before its
   sensors: the gate it waited for may have been of the same tree. A gate started in its parent's turn
   looks as well. One whose log is switched off (`JS_HARNESS_GATE_LOG=off`) neither looks nor writes.
5. The static rows (failures, budget, contracts, payload) run on every gate as before, and so do the
   `review` row and the Codex debt: only the sensors are not repeated.
6. The rule is on only where the project declares it, `"sameTree": "skip"` in `harness.json`; any other
   value is a fault of the declaration, said in the `sensors` row as a faulty `documents` is. This
   repository declares it. A project that says nothing runs its sensors at every gate, as today.
7. `.githooks/pre-merge-commit` runs the same gate as `pre-commit`, so a merge git commits by itself is a
   gate too. `js-harness init` is not changed here: what it writes in another project is recorded for its
   undo, and one more hook there is a change of its own.

**Why a merge with any code still runs the whole suite.** The key is of the result, not of what a commit
changes, and it holds every path. A merge of `main` that brings one line gives a listing no gate has
passed, so no line of the log names it and every sensor runs: there is no partial run. The one merge that
finds a proof is the one whose result is, byte for byte and path for path, a tree whose suite already ran
on this machine, as when a branch merges the `main` that already holds all of its own work. With the hook
of point 7 this is true of every merge commit, where today a plain `git merge` runs nothing.

**What it does not hold, said so that nobody reads more into a gate that ran no sensor.**

- Files git ignores are in no listing: a suite that reads one can change its answer with the key
  unchanged. Here `node --test` walks `evals/runs/`, ignored, which holds no test file today; a project
  with dependencies has `node_modules`. This is why the rule is declared, not on by default.
- A file changed and changed back while the suite ran: both keys are equal, and the suite read something
  else in between. Sessions share folders, and two looks cannot see it.
- The machine outside the three values of the key: another git, another `PATH` (tests skip without bash or
  the right to make symlinks), a Windows update. The log is rotated at about 700 gates, which bounds how
  old a proof can be, and no more than that.
- A fast-forward, a rebase and a cherry-pick run no hook, before this slice and after it.
- The gate log is a file of the home, and a hook can be skipped with `--no-verify`: this is no guard
  against somebody who wants to cheat it, as the gate itself is not.
- The rule that is already there, a commit of declared documents alone runs no sensor, loses a
  verification in this repository, since its suite reads those documents; it heals at the next commit with
  code. Found by the reader of this design, not changed here, told to the lead.

**How much it gives, said before it is built.** With documents in the key, a gate finds a proof when the
very same tree is gated twice: a commit amended in its message alone, a commit made again after something
other than the gate refused it, `npm run check` by hand on a tree just committed, a merge whose result
`main` already passed. A turn that runs its tests and then commits is not one of them: the commit's gate
is the first gate of that tree. So this takes some gates out of the queue, and does not shorten one.

**Tests, one per rule, each through `checkSensors` or `main`:** the same tree a second time runs no sensor,
names the gate that proved it and writes its `same` line; a document changed in between is another key and
runs them; one code file changed runs every sensor; an unstaged change, an untracked file, a file marked
skip-worktree, each gives no key and runs them; `git commit <path>` with another file staged gives no key;
a file changed while the sensors ran leaves no `code` on the line; a `fail` line proves nothing; another
sensor command is another key; a project that does not declare the rule runs as today, and a wrong value
fails the `sensors` row; a gate that waited finds the proof the gate before it left; git that does not
answer is no key, never a skip; the merge hook runs the gate on `git merge --no-ff`.

**What the reader changed** (one independent reader, 2026-10-12, with git run in a scratch repository):
documents are in the key (they were left out, which lost a verification the suite makes and made the
merge claim false); the status and the listing are asked under the hook's binding; assume-unchanged and
skip-worktree give no key; submodules are never ignored by the status; line ends in the folder are in the
key; the listing is read with `ls-files`, which writes no object, not `write-tree`; the second key is
computed before the `end` line; a gate that runs no sensor leaves a line; the merge hook is added; and
the gain is stated, smaller than the first draft implied.

### Roads to a shorter wait for the gate (compared; nothing built, nothing designed)
Asked by the orchestrator at 14:35 and 14:43 on 2026-10-12, after the trial. Second
version, after two independent readers (their file: `two-roads-review.md` in the
orchestrator's scratchpad; what each changed is under "What the readers changed"). It does
not reach him as it is: it is the ground for one question, which is his.

**What is measured** (each read by me from the log or table named).
- One whole run of the suite: 735.6 s and 830.2 s on his machine for the same tree
  (`m1b`, `m1c`: i5-1035G1, 8 threads, 20 GB, Windows 10 LTSC 19044, 93% busy), so 95 s
  is the noise of a day; 183.7 s on GitHub's Linux runner, 1,258.2 s on its Windows
  runner, 2 processors each. Both of GitHub's ran `npm test` alone, never `check`, and
  both are red (7 and 124); the two local runs are red by 5 under the counting tool, by
  its own variables.
- **GitHub's runs are serial** (`t9-ubuntu.log`: the tests' own times sum to 178 s of
  184 s; `t9-windows.log`: 1,254 s of 1,258 s; Node runs one file at a time on two
  processors). His machine runs about six files at once, and there the tests' own times
  sum to 4,519 s (`m1b-tests.log`). So the same work is 178 s on Linux, 1,254 s on a
  Windows nobody else loads, and 4,519 s on his: Windows costs seven times Linux, and his
  machine pays 3.6 times more again for running it together, beside an antivirus that
  takes 917 to 1,171 processor-seconds a run.
- **The work is process starts** (`m1b-count.json`): 12,041 git processes, 1,517 s
  summed, 0.13 s each; and 1,681 other child processes, 4,668 s summed, 2.8 s each, which
  the earlier entries never named. They are Node: the fake agent of the eval runner,
  nested `node --test` runs, version probes. Three files own 3,278 s of them
  (`evals/task-proof`, `evals/runner`, `evals/isolation-probe`), and the four longest
  files are the wall: `evals/runner` 735 s, `bin/codex-review` 691 s, `evals/task-proof`
  612 s, `evals/isolation-probe` 528 s; the fifth is 267 s.
- What Linux does not run: 132 tests, which sum to 345 s of the 4,519 s on his machine
  (7.6%); `bin/remote.test.mjs` alone is 130 s inside a whole run. A minute or two, not
  seconds.
- The line (`js-harness gate log --last 2000`, nested gates left out, 2026-10-12 up to
  14:50): 53 gates of 300 s or more held the lock 50,925 s of about 53,400, and the
  sessions waited 131,289 s for it, summed (36.5 hours). By reader 1's count, not redone
  by me, 46 of the 53 are suite runs (the rest hold Codex reviews), and 25 came from this
  feature's own worktrees and measurements.

**What he already said.** At 01:48 that day the orchestrator offered five ways (its
transcript `65318fd5`, line 1342); the first was "correr la batería completa una sola vez
por entrega, no en cada guardado", with only the tests of what was touched at each commit,
and it said that this one "cambia cuándo se detecta un error: más tarde". His answer (line
1384, a queued message of his own): "hagamos mas rapido la bateria osea la opcion 3". At
12:26 (line 3913) he said yes to the list that holds the trial, no repeated control, less
work in the suite and the reviews outside the lock; "no verification is lost" is the
orchestrator's wording of that list, not his sentence.

**The one thing every road here turns on.** The wait is the number of whole Windows runs
times their length, one at a time. A road shortens it by making the Windows run cheaper,
or by running it less often. Running it less often is the trade he passed over at 01:48,
whatever runs at the commit in its place. Linux does not escape that: it makes the trade
safer, not different.

**Road 1 · A cheaper run on Windows. No trade, no decision of his.** Fewer process starts
in the four files that are the wall. What is known: the first cut (`fc70dc3`) took git
from 15,467 processes to 12,041, and what it gave in wall cannot be told from the day's
noise; cut 2 (one `rev-parse` for four, about 1,190 processes) is about 20 s by its count
and would change most fakes of `bin/codex-review.test.mjs`. The children that are not git
are the larger half and were never looked at: 847 of them in two eval files. Whether the
eval tests can do with fewer real processes is not read. The antivirus is the other
part: his exclusion did not lower it, and M1d (the tests' temp folder inside the excluded
place, in the line) says whether a temp root of the gate is worth building; node and git
are not excluded as processes (the orchestrator's record, its relief line 398). The
trial bounds this road: a Windows that nothing else loads still needs 1,254 s of work.
So it can take minutes off a run, not make it a different size.

**Road 2 · The trade he passed over, as it was offered: no Linux.** A commit runs the
tests of what it touched; the whole suite runs once a delivery. No machine change, no
spend, nothing leaves the machine. It needs a rule for "what it touched" that he can
trust, which is a design, and it loses at the commit everything the touched tests do not
reach. Named so that the comparison is whole; not proposed.

**Road 3 · The same trade with Linux at the commit.** The whole suite runs on Linux at
each commit with code, the whole Windows suite less often. What is lost at the commit is
then only what Windows does differently: the 132 tests and the system itself (CRLF
checkouts, `.cmd` shims, files held open, hooks under Git for Windows' `sh`). That is a
far smaller loss than road 2's, on a harness whose first host is Windows. Both ways to
get the Linux run need the 7 fixed first (four are faults of tests, one a small defect,
`evals/paths.mjs:6`, two one possible defect, `evals/ports.mjs:168-169`; not sized).
- **3a · Linux on his machine (WSL 2).** His hand and his decision: by Microsoft's page
  as reader 2 quotes it, build 19041 or later, PowerShell as administrator, a restart;
  `wsl.exe -l -q` lists nothing today and there is no docker. Whether the install
  completes on LTSC without the Store is not known. The clone and the temp folder must
  live on the Linux disk (the Windows disk is slow from inside, and its files are CRLF),
  so the gate hands over a tree object written from the working tree. The virtual
  machine takes half of 20 GB by default, and free memory was 5.8 to 7 GB with the
  sessions open (reader 2, from this document and the orchestrator's record): tight. It runs on the same eight threads, so it keeps a lock
  and the wait shrinks to the Linux run's length; it does not go. How long that is on
  his machine cannot be measured before he changes it; 184 s serial on two processors
  is the only fact. No spend, no network. A feature of one host: an installed project
  gets nothing from it unless its machine has it.
- **3b · GitHub's Linux runner.** Three things of his, not two: a workflow file on
  `main` (there is no `.github` there, and "Ask me before" of this document names it);
  that a tree not yet committed is pushed to a ref in his private repository at each
  gate; and spend. The gate's own push meets the pre-push hook, which checks every
  pushed ref for a Codex record whatever its name: a way past it is a way round that
  rule and needs a design. By the gate log, 46 to 53 runs a day, each billed 4 minutes
  (204 s rounded up a job, by GitHub's pricing page as reader 1 quotes it): about 200
  minutes a day, so 2,000 included minutes last 9 to 11 days like this one, and a month
  of them is about 21 to 26 dollars at 0.006 a minute; more if gates freed from the
  lock run more often. Whether it stops or bills at the quota depends on a payment
  method on file, which was not read, as his plan and minutes used were not; the timing
  endpoint's zero is no evidence. The Linux half needs no lock, so those gates run
  together; the Windows half and the Codex reviews still hold the lock, so the wait
  shrinks and does not go (reader 1: 20 pushes that day, about 4.8 hours of lock at one
  Windows run a push). Reader 1 reads 20 jobs at once on the Free plan and about 7 s of
  queue in the trial. What ships is his too: built into `check`, it would push an
  installed project's uncommitted trees and spend its owner's minutes; the roadmap's
  standing plan is GitHub on every pull request, and it leaves "whether `init` also
  writes the workflow" to him.
- **Named, not compared:** a runner of his own on another machine (GitHub does not bill
  its minutes), a rented Linux machine, and Cloudflare, his question of about 12:30,
  which by the orchestrator's unverified reading has no CI product: each is road 3 with the Linux run somewhere else, and each
  needs hardware or spend that is his. The roadmap puts a second machine after the gate
  on GitHub.

**The Windows half stays on his machine.** GitHub's Windows needs 1,254 s of work for a
run and is red by 124 (123 from a temp path with a short name; the suite's fix is a cost
only if Windows ever runs elsewhere); at 21 minutes a run the included minutes pay about
90 runs a month, about 46 if a Windows minute counts double.

**How often, and what a late Windows break costs.** Codex reviews before the push and the
pre-push hook refuses code no record covers, so a Windows break found at the push, or at
the pull request, is found after both reviews: its fix is a new commit that needs a new
record. To pay the reviews once, the Windows run has to come before them, once a slice,
when the slice is ready for review; nothing enforces that point today, and the commits
inside the slice are never proven on Windows one by one. T12's key is no proof for it as
built: it is made from the hook's index and working tree, and a push hands over a commit.

**Mine, for the orchestrator.** Nothing here is ready to build. Road 1 is the only one
that needs nothing from him, and its evidence so far is weak: one cut inside the noise.
Every other road is the trade he passed over at 01:48. So the question that would go to
him is one, and it is whether to reopen that trade now that road 3 loses 7.6% of the
suite's time at the commit and not everything untouched; 3a or 3b is a second question
only after a yes. Before it is asked: M1d's result, and one cheap reading of what the
1,681 children are for, since a road 1 that halves them may be enough without any trade.

### Road 1, first slice: the eval tests take one process snapshot a file, not one a run (designed; not built)
Ordered by the orchestrator at 15:31 on 2026-10-12, inside his option 3 (a faster suite), so
no question goes to him. Second version, after its reader (`road1-design-attack.md` in the
scratchpad; what it changed is under "What the readers changed"). Worktree, empty so far:
`D:\js-harness-worktrees\gate-wait-eval-sweep`, branch `feat/gate-wait-eval-sweep` off
`main` `e60cbda`.

**What is there.** `runProcess` (`evals/runner.mjs:277`) ends every run, on every way out,
with `stop(sweep)` (`:345`), handing it the child and when it started and exited (`:310`);
`sweep` is its `killSurvivors` option, by default the real one (`:278`). On Windows the
real one starts a PowerShell that lists every process of the machine and kills what
descends from that child (`bin/lib/process-tree.mjs:285`, `:259`); elsewhere it is one
kill of a process group and starts nothing (`:287-289`). The four entries the tests go
through call `runProcess` themselves: `gradeWorkspace` (`evals/runner.mjs:411`),
`runTrial` (`:630`, the agent's run at `:673`), `runVisible` and through it `proveTask`
(`evals/task-proof.mjs:66`, `:222`), the probe's arm (`evals/isolation-probe.mjs:1086`).
1,156 children that are not git in those four test files, the same count in four whole
runs; about 490 of them are these snapshots.

**What changes in the code that ships: the process run becomes a parameter of the four
entries, with no behaviour.** Each takes `runProcess`, by default the real one, as
`runSuite` already takes `runTrial` and `runTrial` takes `readVersion` and `sweep`;
`runTrial` hands its own to the grading of its trial, `proveTask` to its five runs. Left
out, everything runs and sweeps exactly as today. No command builds these options from
what a user types (the reader checked `resolveAgent`, `runSuite` and the probe's `main`),
so an installed project sees nothing of this. Handing on `killSurvivors` alone, the first
version's seam, was dropped: that an entry uses what it is handed could then only be shown
by a real process left behind, with new leaking fixtures; with the run itself as the
parameter it is shown by a recorded call that starts nothing, and the same seam is what
the later slices need (graders and fake agents).

**What changes in the tests: the same search, once a file.** A stand-in for the sweep
that hid a leak would be worse than today, and the first version's net could not see one:
`killByPath` matches a process by its command line alone (`evals/runner.mjs:187`), so a
child tied to a trial only by its folder is invisible to it, as the repository's own test
says (`evals/runner.test.mjs:1919-1927`). So the stand-in does the real sweep's search
later: it records what `runProcess` hands it (the pid, the start and the exit, read at
that moment), and the file's `after` takes one snapshot and, for each recorded run,
selects its descendants as the real sweep does (`resolveRoot`, `selectDescendants`:
children created within the run's life that record its pid, so a reused pid falls
outside), kills what it finds through the snapshot's own identities and fails the file,
naming each. **The trade, deliberate:** today a process a run leaves behind is killed at
once and in silence; after the slice, in these three files, it lives until the file ends
and then fails the file by name. The look lives beside the shared teardown, `bin/lib/process-tree.testkit.mjs`,
which is where the repository's rule about pids allows it. On Windows alone: elsewhere
the stand-in is the real sweep, which costs nothing there, and a recorded pid would have
nothing to search.
Its known limit, said and not hidden: a grandchild whose own parent exits between the end
of the run and the end of the file is no longer tied to the run by parentage. The real
sweep has the same limit one moment earlier, and the by-path sweep exists for that case
and is not touched.

**Which tests stay as they are.** Fewer than the first version said. A timeout and an
interrupt are proven by `kill`, the tree kill, which nothing here touches; "a sweep that
fails" and the nine of `killByPath` are the by-path sweep. The post-exit sweep finds
something in two tests alone, both of which call `runProcess` directly
(`evals/runner.test.mjs:799`, `:897`, the fake agent's `orphan` and `detached-quiet`),
and they keep the real one; so does `evals/tasks.test.mjs`, whose graders start programs
of their own, and the direct runs of `evals/task-proof.test.mjs:377` and `:384`. Every
way out of `runProcess` calling its sweep stays proven where it is
(`evals/runner.test.mjs:817`, `:913`, `:928`, `:962`, `:979`, `:996`). Added: one test an
entry that it calls the run it was handed, and the tests of the deferred look itself
(nothing found; a descendant found, killed and named; a pid reused after the run; off
Windows).

**What it may uncover.** Each snapshot also held the test still for a moment before a
folder was copied or removed with no second try (`evals/runner.mjs:413-414`). Without it
a removal may meet a child that is still letting go of its folder. Only a run says; if it
does, that is a finding about the real grader too, to be brought and not papered over.

**Not in this slice, named.** A fifth caller, `evals/codex-isolation-probe.mjs:535`.
`sweepError` is reported by one entry of the four (`evals/runner.mjs:682`). Some 14
by-path sweeps and 7 version probes that tests could already stand in for with no change
of shipping code. And the real trial pays one snapshot a run as well: a cheaper list (one
PowerShell kept alive) would shorten real trials too, changes what ships and how a kill
is proven, and is a candidate after this slice is measured.

**The measure, against the 95 s of noise.** The count is the proof: children that are not
git, by file (`timeLine.otherCount` of the counting tool), on the four files alone, before
and after. It was 501, 346, 210 and 99 in four whole runs whose wall times ranged from
519 s to 830 s for the same file. Expected: about 420 to 440 fewer of the 1,156. With it,
their summed seconds and the named tests' summed time; one whole run at the end, read as
a wall time beside M1b, M1c and M1d.

**Size.** Shipping code: about 30 lines in three files. The testkit's deferred look and
its tests: about 120. The four test files: thirteen places, through one helper in each of
three. About 250 to 350 changed lines, one slice, one pull request, both reviews. Not
high risk by the list: a parameter is added and nothing that exists changes.

## What the readers changed
The first version is `335ce6f`. Two read-only readers, 2026-10-12; their reports are in this
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

**The comparison of the roads, 2026-10-12** (two readers of the orchestrator's, on `7ee36d1`;
their file is `two-roads-review.md` in its scratchpad; each claim I build on was checked
by me against the log or table named in the section).
- Reader 1, the numbers. Taken: the wait "goes" was wrong, since the Windows half and
  Codex keep the lock, so it shrinks; a Windows break found at the push is paid after both
  reviews, as at the pull request, so the section now says the Windows run must come
  before the reviews of a slice and that nothing enforces it; "12 dollars a month" was the
  value of the included minutes, and the figure is 21 to 26 with each job rounded up to a
  minute; T12's key is no proof at a push; the Linux run was serial (checked: 178 s of
  tests in 184 s) and what Linux skips is 345 s of 4,519 s on his machine (checked), so
  "seconds" was wrong; GitHub ran `npm test`, never `check`; the local runs are red by 5
  under the counting tool. Taken as its claim, not redone: 46 suite runs among the 53
  gates, 20 pushes that day, 20 jobs at once, 7 s of queue.
- Reader 2, what was missing. Taken: "Windows at each push" is the trade he passed over at
  01:48 (checked: line 1384 of `65318fd5` is his queued message, "hagamos mas rapido la
  bateria osea la opcion 3", to the five ways of line 1342), so the section is now built
  on that and compares the road that makes the trade with no Linux; GitHub's road needs a
  workflow on `main`, a third thing of his, and meets the pre-push hook; Cloudflare, a
  runner of his own and a rented machine are named; WSL's install, memory and where the
  files live; what an installed project would get; the children that are not git
  (checked in `m1b-count.json`: 1,681 of them, 4,668 s summed, against the reader's 1,662
  and 3,630 s, which I could not find); "no verification is lost" is the orchestrator's
  wording, not his.
- Rejected: nothing of substance. Not taken up: Dev Drive (it needs Windows 11, so it is
  no road here) and GitHub's keeping of a deleted ref's objects (a design question of
  3b, which is not being designed).
- What the revision says that neither reader did: every road but the cheaper Windows run
  is that one trade, so one question would go to him, not a choice among five roads.

**Road 1's first slice, 2026-10-12** (one reader at high, read-only, no test run, 261,389
tokens; its file is `road1-design-attack.md` in the scratchpad).
- Its blocker, checked by me (`evals/runner.mjs:187` and the test at
  `evals/runner.test.mjs:1919-1927`): the net of the first version could not see what the
  stand-in stopped killing, since the by-path sweep matches a command line and a leaked
  child is tied to its trial by its folder alone; and it would have swept the whole temp
  folder for `evals/tasks.test.mjs`. Taken, with what it said would work: the stand-in
  records what `runProcess` hands it and one snapshot at the end of the file searches by
  parentage, as the real sweep does.
- Taken as well: the stand-in is for Windows alone (elsewhere the sweep starts nothing and
  is the only cleanup); the keep-list was wrong, timeouts and interrupts being proven by
  the tree kill and only two tests needing the post-exit sweep; "without it the real one
  is used" could not be shown without a real leak, so the seam is now the process run
  itself, shown by a recorded call; the expectation is 420 to 440 fewer, not 460; the
  settle time a snapshot gave before a removal is named as what a run may uncover; the
  fifth caller and the one entry that reports `sweepError` are named.
- Not taken into this slice: the 14 by-path sweeps and 7 version probes the tests could
  already stand in for (named for the next), and a real-process proof of each entry's
  default (new leaking fixtures for what a default parameter already says).
- Added by me after its reading: the stand-in reads the exit time at the moment it is
  called, so that a run whose exit `runProcess` did not hand over is not searched up to
  the end of the file, where a reused pid's children could fall inside.

## Tasks
- [x] T1 · The design read twice by readers that did not write it; their findings taken or
      answered. Evidence: "What the readers changed"; the commit that holds it.
- [x] T2 · The counting tool answers by file, by test in the long files, by who spent the
      machine, and what a start costs (Design, M1). Route: delegated, one writer a piece,
      tests first. After pull request 69 is on `main`. Evidence: `c844f29` on
      `feat/gate-wait-count`; the machine and the starts are `scripts/measure-run.mjs`.
- [x] T3 · M1: one whole run under the lock; the tables in Progress; the cuts chosen, with
      the counts they are judged by. Route: inline, no source written. Evidence: the entry
      of T3 in Progress.
- [ ] T4 · The cuts T3 chose, each judged by a second run. Route: set per cut in T3.
- [x] T5 · A review in parts keeps the parts that passed. Route: delegated, tests first. Evidence: `1841b96`; the entries of T5 in Progress.
- [x] T5b · The four notes gentle-ai left on T5 (Progress; `8bae23f`). Route: delegated, one writer,
      tests first.
- [x] T6 · The head a review reads is pinned (`3e0b456`), and two records at once (`4ca3c05`: they
      stay whole, nothing to mend). Route: delegated, tests first.
- [x] T6b · The row of a commit names the commits no record covers, as the row of a push
      does (`0dde768`); and (`b165cde`) `codex-review` says so when its base is itself a code commit with no
      record, since a base is outside its range. From "JH 7" through the orchestrator
      (2026-10-12, a claim, to be read in the code before it is built): its row said "no
      Codex review record for 1 of N code commits" for hours without the name, and the
      commit was the branch's first, which it had given as `--base`. Route: delegated,
      tests first, in S1 after T6.
- [x] T6c · The notes gentle-ai left on S1 (Progress; `3b810a4`): a test of the record refused when
      `HEAD` or the tree cannot be read again; a deadline for the writers of the test of
      appends at once and an assertion for a spawn that fails, and its comment says what it
      can and cannot catch; the note on a base left out tested on a skip, not on a plan
      alone. The remote `origin` of that note stays, said as a limit: the command has no
      `--remote`. Route: delegated, one writer, tests first, on `feat/gate-wait`.
- [ ] T7 · M2: what a review spends against its number, and one review beside one gate.
      Route: inline, with the reviews of S1. gentle-ai measured; Codex not yet (Progress).
- [ ] T8 · If M2 holds: the texts. Route: delegated, one writer.
- [ ] T9 · The trial on GitHub: the workflow on its branch, one run, what it answered, the
      figure and the two questions sent to the orchestrator. Route: inline, one file.
- [ ] T11 · The merge hook, first and alone: `.githooks/pre-merge-commit` on
      `feat/gate-merge-hook`, both reviews, its pull request. Route: inline.
- [ ] T12 · The identical-tree proof (Design, "No repeated control"), after the cut of git
      processes and unless he drops it. Route: inline; built, uncommitted.
- [ ] T13 · The quick checks that read documents run on a documents-only commit, if they
      are seconds; the figure to the orchestrator if they are minutes. Route: inline.
- [ ] T14 · Road 1, first slice (Design): the eval tests take one process snapshot a file.
      Route: delegated, two writers with disjoint files launched together (the context
      backstop: the parent was at 70% of its window); the parent reads the diffs, runs the
      lock turn and commits.
- [ ] T10 · Close: `docs/ROADMAP.md`, both reviews of each slice with code, pull requests,
      the closing notice.

## Progress
- 2026-10-12 · Opened (`335ce6f`). The map of the code is a read-only sub-agent's (72 test
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
- 2026-10-12 · Pull request 69 merged (`7411fe6`), so `gate-turn` is closed and the counting
  tool is free. This branch, never pushed and two commits of this document, was replayed on
  that `main` (no merge, no gate).
- 2026-10-12 · T5, two writers on Haiku 5.5, one piece each (route: delegated; 107,642 and
  268,366 tokens): the key and the readers of a kept part in
  `bin/lib/codex-review-runs.mjs`, then the reuse in the loop of `bin/codex-review.mjs`,
  with `--fresh`. Both diffs read here; one line hardened by hand (`partKey(null)`).
  Decided while it was built, and why: a range reviewed in one session keeps nothing (its
  line stays the one it was); a caller that asked for the result of every attempt
  (`onResult`, the comparisons of `evals/`) reuses nothing; nine older tests that run one
  range twice in one repository now say `--fresh`, their assertions untouched.
  One turn of the lock (`t5-turn.log`, taken 04:29:03). RED against the two sources as
  they were: the test file of the run log fails whole, and of the command's tests the five
  that prove the new behaviour fail (the range run again from its last part, the totals,
  a run whose parts were all kept, the kept answer in the line, the error that says what
  is kept); the others of the nineteen are guards that pass before and after. GREEN: the
  run log's 36 pass; of the command's 247, 245 pass and two fail, both faults of the
  tests: the usage sentence asserted in a second place, and a second run that did not name
  the platform the first had, so its key differed, which is the key doing its work. Both
  corrected by hand; nothing was committed in that turn. The next turn ran it all again (`t5b-turn.log`, taken 04:50:23): RED the same five, GREEN 36 of 36 and 247 of 247, and the commit `1841b96`, whose gate passed (`PASS  tests`, 05:11:59). gentle-ai's row: medium risk, 474 lines, review due.

- 2026-10-12 · gentle-ai on T5 (`7411fe6..1841b96`, medium risk, 474 lines, one lens:
  reliability): **approved and acknowledged**, lineage `review-66d7ba384db9da9a`
  (`s1-capture.json`, `s1-ack.json` in the scratchpad). Four notes, none blocking, all
  taken as T5b: (1) the tests that say `--fresh`, another effort and a moved head reuse
  nothing run their second time without the platform their first run named, so the key
  would differ anyway and they do not isolate what they name; (2) no test reaches the run
  log that cannot be read while kept parts are looked up; (3) the error says what passed
  is kept even when the line of a part could not be written; (4) the test of a run whose
  parts were all kept does not assert what it records and shows.
- 2026-10-12 · M2, number 1, for gentle-ai (T7, half): its capture ran alone in a turn
  (`s1-review-turn.log`, taken 05:39:41) under `measure-busy.mjs`, a script of the
  scratchpad that reads `os.cpus()`. A quiet minute first: 129.5 busy processor-seconds,
  2.2 a second, which is the other sessions and the browser. Then the capture, 111.2 s:
  249 busy processor-seconds, **9.1 above the quiet rate, so at most 2.3 s added to a gate
  beside it, against the 30 s it had to stay under**. One lens; a review of four lenses
  was not measured. Codex's number is not measured: its review of T5 is not run (below).
- 2026-10-12 · Codex on T5 waits for him. Its plan is "about 580,000" input tokens (2
  parts, 474 lines) and the rate gives 568,800: 2% over. The orchestrator holds every
  Codex run whose plan is over the rate, in any session, until he answers whether a plan
  within a margin counts as inside (he is back at about 11:40, by the orchestrator). From
  the run log, for that question: the median is about 1,256 input tokens a changed line
  over 117 reviewed parts of up to 400 lines, above the rate's 1,200; the cost a line
  falls with size (1,947 at 78 lines, 312 to 444 at 494). Codex spent on this feature so
  far: 0. Sub-agents so far: 921,278 tokens.
- 2026-10-12 · `main` moved to `47484bd` (pull request 72, the rules list of "JH 7"), clean
  against this branch by the orchestrator's merge-tree; taken with the merge before the
  pull request. Told to the orchestrator, for "JH 7": `bin/lib/codex-review-parts.mjs` and
  `bin/lib/codex-review-plan.mjs` are free of this feature; `bin/lib/gate-lock.mjs` and
  `bin/lib/gate-log.mjs` are not touched by it.
- 2026-10-12 · T5b, one writer on Haiku 5.5 (131,519 tokens), commit `8bae23f`. One turn
  (`t5c-turn.log`, taken 06:09:35): RED, the new test of the error's last sentence fails
  against the command as it was; GREEN, 249 of 249 of the command's tests; the gate passed
  on the commit (`PASS  tests`, 06:26:56). gentle-ai's row: medium risk, 58 lines, review
  not due (under the budget). Of the four notes, one is taken short and said so: no way
  was found to make the reader of the run log throw at that one place, so the new test
  proves that a log that cannot be read is read as empty and every part is asked; the
  `catch` beside it stays without a test. Sub-agents so far: 1,052,797 tokens.
- 2026-10-12 · T6, one writer on Haiku 5.5 (147,113 tokens), commit `3e0b456`. One turn
  (`t6-turn.log`, taken 06:40:12): RED, the three new tests fail against the command as it
  was (a commit made while Codex reviews, an edit made while it reviews, the end of the
  range asked by the commit and never by the word `HEAD`); GREEN, 252 of 252; the gate
  passed on the commit (`PASS  tests`, 06:57:36). gentle-ai's row: medium risk, 95 lines,
  review not due (under the budget). Two things it leaves, said plainly: under the default
  prompt Codex itself diffs against the live `HEAD` inside its session, which the command
  cannot pin, so a commit made meanwhile may be read; the record is still refused. And
  "two records at once" (`bin/lib/codex-reviews.mjs:75`) was not looked at: it stays in T6
  as open. Sub-agents so far: 1,199,910 tokens.
- 2026-10-12 · T6b, its first half, one writer on Haiku 5.5 (157,520 tokens), commit
  `0dde768`. The writer was read before the turn and two things were changed by hand, on
  Opus. It had given the row of a commit the closing line of the row of a push, which names
  `<oldest>^`; where work forked before the default branch moved, the same row sized its
  review from `origin/main`, so it named two bases. The row now lists the commits and gives
  the command that makes the record the base its size was read from. And one new test
  expected the newest commit's `^` where the oldest's is the base: a fault of the test. A
  third file, `bin/codex-review.test.mjs`, read the row's exact lines and was outside the
  writer's files; it was changed by hand. One turn (`t6b-turn.log`, taken 07:13:01): RED,
  four tests of the row fail against the check as it was; GREEN, 97 of 97 of the rows'
  tests and the one test of the command that reads the row; the gate passed on the commit
  (`PASS  tests`, 842 s, 07:29:30). gentle-ai's row: medium risk, 107 lines, review not due
  (under the budget). The row is not bounded: a branch with many such commits prints every
  one at every commit, as the row of a push does. Left as it is, said here. Sub-agents so
  far: 1,357,430 tokens.
- 2026-10-12 · T6, what was left of it, commit `4ca3c05`: a test, written on Opus, that four
  processes which start together and append a hundred records of four thousand bytes each
  leave four hundred whole lines, each process's in its own order. It passed as the code
  is: the append is one write to a file opened for appending, so nothing was made whole
  because nothing tears. No RED: the test describes what holds.
- 2026-10-12 · T6b, its second half, two writers on Haiku 5.5 (123,752 and 141,922 tokens),
  commit `b165cde`. `baseLeftOut` in `bin/lib/codex-review-coverage.mjs` says whether the
  commit a range starts at is a code commit of the branch that no record covers;
  `defaultBranch` moved there from `bin/check.mjs`, since the command asks it now too; and a
  plan, a review and a skip say it in one line before anything else, with the command that
  starts one commit earlier. Said only of a commit of the branch: the usual base, the
  default branch's own commit, is left alone. One thing added by hand: a repository with no
  remote is told by one git question (`for-each-ref`) where finding no default branch took
  three, since every review of the suite's tests asks it.
  One turn for both (`t6c-turn.log`, asked 07:40:48, taken 08:06:35 after two gates of
  other sessions): RED of the library, the file does not load against the library at HEAD
  (`does not provide an export named 'baseLeftOut'`), which is a weak RED and is said as
  one; RED of the command, its two tests that expect the line fail against the command at
  HEAD; GREEN, 19 of 19, 26 of 26, 97 of 97 and 257 of 257 of the four test files; then
  each commit over a tree that held its files alone, the other five set aside and put back:
  `PASS  tests` at 08:33:08 (944 s) and at 08:49:04 (947 s). gentle-ai's rows: 63 lines and
  245 lines, each under the budget; from `1841b96` the slice is 661 lines and its review is
  due (`slice_budget_reached`).
- 2026-10-12 · T2, in a worktree of its own, `D:\js-harness-worktrees\gate-wait-count`,
  branch `feat/gate-wait-count` off `main` at `47484bd`: slice S2 touches only `scripts/`,
  and a second worktree let its writers work while the first one waited 26 minutes for the
  lock. One writer at a time. Three pieces on Haiku 5.5 (159,248, 157,117 and 161,885
  tokens): the time line by test file; the seconds of each top-level test, from a reporter
  of the tool's own (`scripts/count-git-reporter.mjs`); and the machine.
  **A change to the design, taken here:** what the machine spent and what a start costs
  (M1, points 3 and 4) are not in the counting tool. They are one separate script,
  `scripts/measure-run.mjs`, that wraps any command: busy processor-seconds, what each
  process that lived through the run spent, by name, and the starts of git and Node before
  the command and inside it. The same numbers, one writer instead of three, and a tool that
  measures a review or a gate as well as a count. What the Node processes report of
  themselves stays in the counting tool's time line; "not attributed" is worked out in
  Progress from the two.
  Three things changed by hand after reading the writers: a space a writer had dropped in a
  line of the report; the header of the new block, which held the words "by test file" that
  an older test forbids for a run of one file (the first turn failed on it at GREEN, 26 of
  27, exit 6, nothing committed); and the reader of the process table. The writer's, and my
  brief's, was `Get-Process`, which on this machine returns no time for the antivirus
  (`MsMpEng`: empty CPU and StartTime, read 08:00) and took 13 s; `Win32_Process` reads it
  and takes 1 s. Only running the reader on the real machine showed it.
- 2026-10-12 · Two readings on the way, neither a measurement of a suite. At 08:00 the
  antivirus had used 204,630 processor-seconds since the machine started 289,316 s (3.35
  days) before: 71% of one logical processor on average, 8.8% of the eight. And by 08:51
  two `node tsserver.js`, named in the load row of both gates above, were each spending a
  whole logical processor all the time (4.8 s in 5 s): one this session's own (pid 57964,
  7,136 processor-seconds since 2026-10-11 15:52), stopped; the other another session's
  (pid 59656), told to the orchestrator and left alone. This session's had been spinning
  since before the first gate of this feature, so no gate recorded here ran without it;
  M1 is the first run that does.
  Sub-agents so far: 2,101,354 tokens. Codex in this feature: none.
- 2026-10-12 · gentle-ai on S1 after `1841b96` (`788bcbc..833a9b9`, 8 files, 720 lines, one
  lens, reliability; consent pre-granted, the `granted` choice run): **approved** and
  acknowledged (lineage `review-a1061d8e43757870`, authority burned). Its capture ran alone
  in a turn (asked 08:55:02, taken 09:41:46, ended 09:43:59) under `measure-busy.mjs`:
  72.2 s, 47.9 busy processor-seconds above a baseline of 1.7 a second, so **at most 12 s
  added to a gate** against the bound of 30 s written before it (M2, gentle-ai, second
  reading; the first was 2.3 s). Five notes, none blocking, taken as T6c below: the branch
  that refuses a record when `HEAD` or the tree cannot be read again has no test (its one
  warning); the test of appends at once can only catch a tear the scheduler happens to make,
  and says so nowhere; its writers wait for the go file with no deadline and a failed spawn
  is no assertion; the note on a base left out always asks the remote `origin`; and that
  note is tested through `--plan` only.
- 2026-10-12 · **T2 committed, `c844f29`** on `feat/gate-wait-count` (turn `t2-turn.log`,
  asked 08:51:05, taken 09:05:51): RED, 13 of 27 of the tool's tests fail against the tool
  at HEAD; GREEN, 27 of 27 and 14 of 14; `PASS  tests` at 09:20:15 (839 s). gentle-ai's row:
  973 lines, review due.
- 2026-10-12 · **T3, M1: one whole run under the lock**, 09:20:15 to 09:33:19, at `c844f29`,
  77 test files, 3,767 tests (5 fail under the tool, as its header says), the counting tool
  wrapped by the measuring script. Raw tables in the scratchpad: `m1-count.json`,
  `m1-machine.json`, `m1-machine.txt`, `m1-tests.log`.

  *The machine.* Wall 780.6 s. Eight logical processors: 5,524.5 busy processor-seconds of
  6,244.8, **88%**. The machine is processor-bound: that much work over eight processors is
  690 s at best, however the files are arranged.

  | Who spent it | processor-seconds | of busy |
  |---|---|---|
  | The antivirus (`MsMpEng`), one process | 1,077.4 | 19.5% |
  | The sessions (`claude`, 21 processes) | 291.4 | 5.3% |
  | `WmiPrvSE` (2), `System`, `dwm` | 149.9, 113.3, 106.5 | 6.7% |
  | `svchost` (80), long-lived `node` (48), `SearchIndexer`, `chrome` (21), `ChatGPT` (17) | 70.3, 60.0, 49.9, 35.4, 20.8 | 4.3% |
  | Every other process that lived through the run | 43.6 | 0.8% |
  | The tests' Node processes, by their own report (1,005 reported, 87 never did) | 489.2 | 8.9% |
  | **Not attributed**: git (12,041 processes, 1,610 s of summed wall time, its upper bound), the 87 Node processes that never reported, shells, consoles | 3,017 | 54.6% |

  The tool listed the idle process of Windows (pid 0, 743 s) as a row; it is taken out of
  the figures above and of the tool (the fix is in the cut's commit).

  *What a start costs* (median, range): `git --version` 62 ms (57 to 73) on the quiet
  machine, **209 ms** (178 to 274) 300 s into the run; `node -e ""` 95 ms (92 to 100) and
  **320 ms** (248 to 423). Free memory 7,009 MB and 6,472 MB; entries in the temporary
  folder 3,511 and 3,889.

  *By test file, the ten longest* (seconds from the start of the run):

  | Test file | start | end | seconds | tests | Node | their s | git | git s | other | other s |
  |---|---|---|---|---|---|---|---|---|---|---|
  | `bin/codex-review.test.mjs` | 0.2 | 686.0 | 685.8 | 237 | 1 | 59.0 | 6,067 | 641.5 | 0 | 0 |
  | `evals/runner.test.mjs` | 261.0 | 780.3 | 519.3 | 164 | 199 | 39.4 | 0 | 0 | 501 | 666.7 |
  | `evals/isolation-probe.test.mjs` | 204.8 | 635.7 | 430.9 | 122 | 93 | 76.9 | 270 | 61.5 | 210 | 336.9 |
  | `evals/task-proof.test.mjs` | 311.2 | 695.8 | 384.6 | 34 | 223 | 55.4 | 5 | 0.4 | 346 | 1,142.9 |
  | `bin/check-codex-reviews.test.mjs` | 0.2 | 311.1 | 310.9 | 94 | 1 | 18.6 | 2,146 | 298.4 | 0 | 0 |
  | `evals/configs.test.mjs` | 148.4 | 389.9 | 241.5 | 79 | 25 | 10.0 | 123 | 34.9 | 70 | 202.7 |
  | `evals/suite.test.mjs` | 275.6 | 447.1 | 171.5 | 79 | 37 | 14.6 | 0 | 0 | 82 | 174.4 |
  | `bin/remote.test.mjs` | 106.6 | 245.6 | 139.0 | 111 | 4 | 10.0 | 451 | 78.5 | 20 | 94.2 |
  | `bin/lib/project.test.mjs` | 69.1 | 204.7 | 135.6 | 143 | 1 | 9.7 | 852 | 126.2 | 0 | 0 |
  | `bin/check.test.mjs` | 0.2 | 130.8 | 130.6 | 166 | 49 | 18.9 | 260 | 48.1 | 54 | 94.0 |

  All 77 files: 1,005 Node processes, 12,041 git processes (1,610 s), 1,662 other children
  (3,630 s of wall time). git by sub-command: `rev-parse` 4,645 (526 s), `diff` 1,770,
  `check-attr` 670, `rev-list` 660, `init` 640 (145 s), `merge-base` 581, `commit` 556
  (174 s), `status` 504, `add` 501, `log` 494, `config` 289. By caller: one line,
  `bin/codex-review.test.mjs:277`, starts 4,618 of them, 38% (`rev-parse` 1,695, `diff`
  1,136, `merge-base` 427, `check-attr` 414): the git the command under test asks, a review
  after another; then `bin/lib/codex-review-coverage.mjs:19` 1,036,
  `bin/codex-review.test.mjs:45` 752, `bin/check-codex-reviews.test.mjs:32` 570,
  `bin/lib/project.test.mjs:79` 530, `evals/configs.mjs:164` 477 (`init`, `add`, `commit`,
  159 each).

  *Inside the long files*: no one test is the file. `bin/codex-review.test.mjs` is 237
  tests, median 1.8 s, 35 of them over 5 s, the longest 34.6 s; `evals/runner.test.mjs` 164
  tests, the longest 57.1 s; `evals/task-proof.test.mjs` 34 tests, median 9.2 s.

  *The cuts chosen from the tables, largest first.*
  1. **The order the files start in.** The run ends at 780 s and its longest file at 686 s:
     `node --test` sorts the files it is given (tried: given d, c, b, a it runs a, b, c, d),
     seven at a time, so the three long files of `evals/` start 204 to 311 s in and the last
     94 s wait for `evals/runner.test.mjs` alone. `run()` of `node:test` keeps the order it
     is given (tried). A runner that starts the seven longest first: claimed, the run ends
     with its longest file, about 700 s. No count drops; it is judged by the time line of a
     second run. Taken, in flight (below).
  2. **The git a review asks** (`codex-review.test.mjs:277`, 4,618 processes, a third of
     all, 18 a review): the cut is in the command, so a real review pays less too. Not
     started: it needs the callers split two frames deep (`--frames 2`) on that file first.
  3. **Repositories of fixtures built once** (`init` 640, `commit` 556, `add` 501, `config`
     289: 1,986 processes, 16% of git): a folder copied instead. Not started.
  4. **The antivirus, 1,077 processor-seconds of 5,524**: nothing is built. The number goes
     to him with what an exclusion of the tests' temporary folder would be.
  How many files side by side (`--test-concurrency`) is not tried: at 88% busy the
  processors are the limit, not the number of files.
- 2026-10-12 · **T4, the first cut, in flight**: `scripts/run-tests.mjs`, `npm test` through
  it, and `scripts/count-git.mjs --runner`, one writer on Haiku 5.5 (170,219 tokens). Its
  `main` did not work (tried on four trivial files: nothing printed, one event of four
  lost) and was rewritten on Opus in the form tried first in the scratchpad: the events of
  `run()` by their type, the spec reporter through `compose`. Tried again: output whole,
  four events of four, exit 1 with a failing file. Turn asked (`t4-turn.sh`): RED, GREEN,
  the commit with its gate, which is the first whole run through the runner, and M1 again
  through it (`m1b-*.json` in the scratchpad). Sub-agents so far: 2,271,573 tokens.
  Its first turn (taken 10:16:12) failed at GREEN, 27 of 28, exit 6, nothing committed:
  the writer's new test expected `pass 2` of a file with two top-level tests and one
  nested, and the runner rightly says `pass 3`. The test was corrected and the turn asked
  again.
  Its second turn (taken 10:54:10) passed GREEN and **failed at the gate, the first whole
  run through the runner**: 3,781 tests, 3,770 pass, 1 fails, 866 s (`t4-gate-failed-1109.log`
  in the scratchpad), commit refused at 11:09:16. The one failure is a test of the runner
  itself, the one its writer had flagged: it read the order of the files from which test
  wrote its first line first, which is decided by how fast each process boots, and inside
  the loaded suite it came out in another order. It now reads the order from the report,
  which lists the files as the run was handed them (12 of 12, three times running alone).
  Asked a third time. And one reading to keep beside the claim of the cut: that whole run
  through the runner took 866 s, no shorter than the gates before it (839 s, 889 s) with
  other sessions working; only M1 again, with its time line, can say what the order gave.
- 2026-10-12 · **The first cut committed, `fc70dc3`**, on `feat/gate-wait-count` (third
  turn, asked 11:10:47, taken 11:41:53): `PASS  tests` at 11:55:59, the whole suite through
  the runner. **M1 again, through the runner**, 11:55:59 to 12:08:19, 78 test files
  (`m1b-count.json`, `m1b-machine.json`, `m1b-machine.txt`):

  | | M1 | M1 again | |
  |---|---|---|---|
  | Wall | 780.6 s | **735.6 s** | 45 s less, 5.8% |
  | Busy of the eight processors | 88% | 93% | |
  | Where the last file ends | 780.3 (`evals/runner`) | 735.0 (`evals/runner`) | |
  | `bin/codex-review.test.mjs`, start to end | 0.2 to 686.0 | 0.2 to 691.3 | |
  | `evals/runner.test.mjs` | 261.0 to 780.3 | 0.2 to 735.0 | |
  | `evals/isolation-probe.test.mjs` | 204.8 to 635.7 | 0.2 to 527.9 | |
  | `evals/task-proof.test.mjs` | 311.2 to 695.8 | 0.2 to 612.2 | |
  | git processes | 12,041 | 12,041 | none claimed |
  | Start of `git --version` inside | 209 ms | 206 ms | |
  | The antivirus | 1,077.4 s | 917.5 s | |

  What it gave, plainly: the long files all start at once, as claimed, and the run is 45 s
  shorter, about half of the 80 s claimed. The run does not end with its longest file:
  `evals/runner.test.mjs`, which took 519 s when it started late and alone, takes 735 s
  beside the others from the first second. One reading of the wall time, no proof. With the
  processors 93% busy there is no slack left to arrange: from here only less work shortens
  the suite (cuts 2 and 3, and the antivirus, which is his).
- 2026-10-12 · **T6c committed, `3b810a4`**, one writer on Haiku 5.5 (118,070 tokens),
  tests alone: the record refused when `HEAD` cannot be read again after the review; the
  note on a base left out, on a skip; a deadline of 120 s for the writers of the test of
  appends at once, an assertion for a spawn that fails, and what that test can and cannot
  show, said above it. One turn (`t6e-turn.log`, taken 10:16:38): the two new tests pass,
  19 of 19 of the records' tests, `PASS  tests` at 10:31:47 (889 s). No RED: the tests
  describe what the code does; none was proven by breaking the code. gentle-ai's row: 52
  lines, under the budget. Sub-agents so far: 2,389,643 tokens.
- 2026-10-12 · **Codex reviewed S1, once: three findings, all real, fixed in `f04efca`.**
  The turn was taken at 12:31:47 and ended 12:40:05, exit 0 (`s1-codex-turn.log`,
  `s1-codex-out.log`); the desktop app restarted at 12:32:42 (the orchestrator's reading),
  so the turn's notice never came and its log was read instead. Range `5127be1..88e2414`,
  three parts, recorded in `codex-reviews.jsonl`. Found: (P1) a part that passed was kept
  in the run log before the check that follows the review read `HEAD` and the tree again,
  so a run refused for a tracked file edited meanwhile left every part reusable, and the
  next run of the range wrote a record with no session started; (P2) a kept answer was
  taken as valid with its findings and verdict alone, and one without its explanation
  threw when the verdict was printed, after every part had passed; (P2) the note on a base
  left out read the coverage up to the base alone, where a record of nothing to review or
  one that left marked files out, headed at a later commit, does not count, so a covered
  base was called left out. Fixes, in one commit: a part asks `HEAD` and the tracked tree
  after its session, and when they are not the range it is a failed attempt that keeps
  nothing and the parts after it are not started (a check before the session was written
  too and taken out: the review already refuses to start on a tree with a tracked change,
  `bin/codex-review.mjs:1232`, and a test of it failed for that reason); `runKept` asks
  every field the command reads of a kept answer; `baseLeftOut` takes the head of the
  review and asks again there. RED observed for the three (`s1-fix-turn.log`, 13:11:39),
  GREEN 13:17:59, `PASS  tests` at 13:31:33. gentle-ai's row on `f04efca`: 162 lines, under
  the budget. It has no Codex record yet: `88e2414..f04efca`, to plan.
- 2026-10-12 · **What that review cost, as a sample against the estimator.** Plan: 3 parts,
  1,074 changed lines, about 1,210,000 input tokens, against a rate of 1,288,800. Spent:
  1,649,068 input tokens (1,373,440 cached, 83%), 426 s, 32 requests: 36% over the plan
  and 28% over the rate, on a plan that was under it. By part: 287 lines, planned 320,000,
  spent 513,922 in 10 requests; 397 lines, planned 450,000, spent 277,741 in 7; 390 lines,
  planned 440,000, spent 857,405 in 15. Then the run log itself, read with one script and
  no Codex run: in its 196 measured parts, a part's input tokens follow the requests its
  session made (R² 0.94) and not its changed lines (R² 0.06). Requests: median 7, nine in
  ten parts at 11 or fewer, 15 at most. Tokens a changed line: 424, 844, 1,431 and 2,198
  at the quarter, the median, three quarters and nine in ten. So the plan by lines cannot
  see which part will make 15 requests, and a plan under the rate ends over it whenever
  two of three parts do. What the estimator would have to change, not built: put a part at
  what a session of the median number of requests costs, say beside it what one of the
  nine-in-ten number costs, and judge the rate on a figure that holds in three runs of
  four, not in one of two. Told to the orchestrator, who put it in his queue.
- 2026-10-12 · **M2, number 1 for Codex: not measured.** `measure-busy.mjs` took the minute
  before the review as the quiet baseline, and that minute was the tail of another gate:
  124 busy processor-seconds in 60 s against 524 in the 437 s of the review, so the
  difference is negative and says nothing. To measure by process on the next Codex run
  (`scripts/measure-run.mjs` reads what each process spent), no extra run.
- 2026-10-12 · **Cut 2, the count** (`c2-turn.log`, 12:26:16 to 12:31:40, table
  `c2-frames.json`): `bin/codex-review.test.mjs` alone starts 6,067 git processes, 288 s of
  its 323 s. By command: `rev-parse` 2,107, `diff` 1,639, `merge-base` 502, `check-attr`
  474, `status` 430, `rev-list` 376, `log` 316. The test file runs the command 397 times;
  each run asks `rev-parse` about four times (`bin/codex-review.mjs:1124`, `:1129`,
  `bin/lib/project.mjs:230`, and where the git folder is), which one process can answer.
  Not cut yet.
- 2026-10-12 · **T9, the trial: committed, not pushed.** Branch `trial/gate-on-github`,
  worktree `D:\js-harness-worktrees\gate-on-github`, off `main` `3088960`, commit `14a6026`
  (`PASS  tests`, 869 s, 13:11:31): `.github/workflows/trial-gate.yml` runs `npm test` on
  `ubuntu-latest` and `windows-latest`, Node 24, on a push to that branch alone, each job
  bounded at 60 minutes, token read-only. Read before it: the repository is private,
  Actions is enabled, no run ever (`gh api`); GitHub Free includes 2,000 minutes a month
  for private repositories and blocks usage at the quota without a payment method
  (docs.github.com/en/billing/concepts/product-billing/github-actions, read that day). Not
  read: his plan and the minutes used this month, since the token has no `user` scope and
  it is not widened. The orchestrator was told the branch and what it runs at 13:06 and
  answered: push when the gate and the Codex record are done; after the run read
  `gh api repos/jsaristi/js-harness/actions/runs/<id>/timing` for what was billed by
  system; tell it at 45 minutes if a job still runs; no second push without telling it.
  Reviews: gentle-ai due (high risk, a workflow), lens risk, lineage
  `review-87c85e6c3a5374d2`, granted; Codex plan about 71,000. Both in `t9-review-turn.sh`.
- 2026-10-12 · **No repeated control: designed, attacked, built, not committed.** The
  design is in Design ("No repeated control"), with what one independent reader changed.
  The orchestrator's order of 13:09, taken: the merge hook first and alone, then the cut
  of git processes, then the identical-tree proof. So: (a) the hook is branch
  `feat/gate-merge-hook`, worktree `D:\js-harness-worktrees\gate-merge-hook`, off `main`
  `3088960`: `.githooks/pre-merge-commit` and two tests with real git; its turn is
  `hook-turn.sh`. (b) The proof is branch `feat/gate-wait-same-tree`, worktree
  `D:\js-harness-worktrees\gate-wait-same-tree`, uncommitted: `bin/lib/gate-tree.mjs`,
  `bin/lib/gate-log.mjs`, `bin/check.mjs`, `harness.json`, tests in three files; its turn
  `s4-turn.sh` was asked with `nocommit`, which stops after GREEN. It holds a copy of the
  hook and its small test, to take out when the hook is in `main`.
- 2026-10-12 · **A hole older than this feature, told to the orchestrator:** the rule that
  a commit of declared documents alone runs no sensor loses a verification here, since the
  suite reads them (`bin/sessions.test.mjs:553`; `bin/rules.test.mjs:390-394` through
  `bin/rules.mjs:94-100`). Its answer, from his decision of 2026-10-10 (its file, line 164,
  item 3: "the quick document checks still run"): measure alone what reads `docs/` and
  `odd/tasks/`; if it is seconds, a documents-only commit runs it; if minutes, the figure
  is his. Mine to build after the hook (T13).
- 2026-10-12 · **A slip, said to the orchestrator in four parts:** at 13:16:07 I ran
  `js-harness check --help`; `check` knows no such flag and started a gate, which waited
  for the lock; stopped at about 13:18 before it ran anything. Candidate: `check` and
  `gate` refuse a flag they do not know.
- 2026-10-12 · **T9, the trial is pushed and Linux answered.** Reviews of `14a6026` in one
  turn (14:16:40 to 14:17:53, `t9-review-turn.log`): gentle-ai approved and acknowledged
  (lens risk, capture 24.3 s); Codex "correct", 119,953 input tokens (75,392 cached)
  against a plan of 71,000, recorded for `3088960..14a6026`. Pushed at 14:18; run
  38296748258 of "trial-gate" queued 14:18:15. **Linux (job 114969540949): not passed.**
  3,846 tests, 3,707 pass, 7 fail, 132 skipped; the suite took 183.7 s, the job 3 min 24 s,
  on `ubuntu-latest` with 2 logical processors, 8 GB, Node v24.21.0 (the log is
  `t9-ubuntu.log` in the scratchpad, fetched with `gh api --allow-escape-sequences
  repos/jsaristi/js-harness/actions/jobs/<id>/logs`, which answers while the run still
  runs). The seven, by name: "a TOML literal string and a trailing comment are both read";
  "a top-level model_instructions_file key before any table header is used, and TOML
  backslash escapes are unescaped"; "a real listener of a trial port is found by number
  and killed, and a connection is then refused"; "the probe stops what the trial left
  listening on its engram port, by number, and leaves nothing behind"; "a report or a raw
  directory that cannot be written refuses the run before anything is probed or spent";
  "the command runs one trial per arm, minimal first, proves each wrote inside its sandbox
  and nothing reached the real home, and exits 0"; "uninstallProject never follows a
  symlink placed where a written file used to be". A finding, not fixed, no second push.
  What it says: 184 s on two Linux processors against 735.6 s on his eight under Windows,
  so what costs here is Windows starting processes and what scans them, not the tests'
  work. Windows (job 114969540380) was still running at about 14:35 (the hour was not read then; the entry was committed at 14:36:11 by `date`); a background wait prints
  each job's result when the run ends or at 44 minutes. Told to the orchestrator just before that.
  Still owed to it: Windows passed or not and its wall time, and what was billed
  (`gh api repos/jsaristi/js-harness/actions/runs/38296748258/timing`).
- 2026-10-12 · **T11, the merge hook is committed, `97703f9`** on `feat/gate-merge-hook`
  (`hook-turn.log`: RED 14:19:25, the test that reads the hook file fails without it; GREEN
  168 of 168 of `bin/check.test.mjs`; `PASS  tests` 14:32:58). The test with real git
  passes with and without the repository's file, since it installs the hook itself: it
  proves the gate under the merge hook's binding, not the file. gentle-ai due (high risk,
  an executable hook), lenses risk and reliability, started and granted; its two captures
  and Codex (plan 71,000) are `hook-review-turn.sh`, in the line. Then push and pull
  request.
- 2026-10-12 · **T13 measured** (`t13-turn.log`, 14:33:04, on `main`'s sources): `js-harness
  rules check` 0.26 s; `bin/rules.test.mjs` 0.93 s; the context-text test of
  `bin/sessions.test.mjs` 0.45 s; that file whole 3.6 s. Seconds, so by the orchestrator's
  reading of his words of 2026-10-10 a documents-only commit runs them. To build: sensors a
  project declares for a commit of documents alone (`harness.json`, beside `sensors`),
  which the gate runs where it runs no other; this repository declares the three.
- 2026-10-12 · **T12, the identical-tree tests** (`s4-turn.log`, 14:17:58): RED 3 of 3 files
  fail without the sources; GREEN 213 of 214, the one red a fault of its test (the
  stand-in gate's id was no hex, and the row's pattern asks for one), fixed, not run
  again. Uncommitted, as ordered.
- 2026-10-12 · **His word on the antivirus, 13:57** (the orchestrator's transcript, line
  4481, type user, origin human, read by me): "Sí, ya las excluí", to the question whether
  `D:\js-harness` and `D:\js-harness-worktrees` are excluded. Nobody can read the
  exclusions without an administrator. The orchestrator asked one M1 on the tree of the
  second (`fc70dc3`): `m1c-turn.sh`, in the line, prints wall, busy share, git and the
  antivirus beside the second run's (735.6 s; `MsMpEng` 917 s). Report both to it; if the
  antivirus did not move, say so plainly; what remains may be the tests' repositories
  under Temp, which is outside what he excluded.
- 2026-10-12 · **Asked by the orchestrator, to do with the next commit that touches
  `bin/check.mjs`:** `check` and `gate` refuse a flag they do not know, exit 2, with a test
  (the slip of 13:16 was the second of its kind that day).
- 2026-10-12 · **Cut 2, what it would give, before it is built:** one `rev-parse` for the
  four a run of the review command asks would take about 1,190 of the suite's 12,041 git
  processes, near 160 of 5,500 busy processor-seconds, so about 20 s of wall on eight
  processors 93% busy, and it changes the arguments most fakes of
  `bin/codex-review.test.mjs` match. Small against the trial's fact. To say to the
  orchestrator with the trial's Windows half; not built.
- 2026-10-12 · **T9, the trial ended: red on both, and the pair of numbers it was for.**
  Run 38296748258, completed, failure, read at 14:40:25 from its jobs and their logs
  (`t9-ubuntu.log`, `t9-windows.log` in the scratchpad). **Windows** (job 114969540380,
  `windows-latest`, win32 10.0.26100, 2 logical processors, 8 GB, Node v24.21.0): 3,847
  tests, 3,721 pass, 124 fail, 2 skipped; the suite 1,258.2 s, the job 21 min 24 s.
  **Linux** (job 114969540949, 2 logical processors): 3,846 tests, 3,707 pass, 7 fail, 132
  skipped; the suite 183.7 s, the job 3 min 24 s. On machines of one size the suite takes
  6.8 times longer on Windows than on Linux, and his own machine does it in 735.6 s on
  eight threads: it is Windows that is slow for this suite, not his machine. **Billed:**
  `gh api repos/jsaristi/js-harness/actions/runs/38296748258/timing` gives
  `billable.WINDOWS.total_ms` 0 and `billable.UBUNTU.total_ms` 0, `run_duration_ms`
  1,288,000: not settled (inside the included minutes shown as zero, or not posted yet);
  the figure is on his billing page, which the orchestrator asks him to open only if a
  road with spend is proposed. Whether a Windows minute counts double is not settled
  either. No second push. Told to the orchestrator at 14:41 (by `date`, 14:40:25 just
  before). Its asks of 14:35 and 14:43, to answer in this document before any design and
  with nothing built: (1) the 132 skipped and the 7 failed of Linux by cause (a reader is
  on it), and the 124 of Windows by cause, in one sentence: the suite assumes his machine,
  or the harness fails on a clean Windows (the second is a defect for the register); (2)
  two roads side by side, each with what it needs from him and what it leaves unproven:
  the gate on Linux on his own machine (WSL: `wsl.exe` is there with no distribution, no
  docker; turning it on changes his machine, which is his) and the gate on GitHub's Linux
  runner (about 3.4 minutes a run); and said plainly: whether the Windows half can only
  stay on his machine, since GitHub's Windows is slower than his and red, and how often it
  would have to run for a Linux gate to be trusted (each commit, each push, each pull
  request). A design that reaches him gets the double review first: tell the orchestrator
  when the comparison is written and it brings the readers.
- 2026-10-12 · **T9, what a Linux run leaves unproven** (one reader on `t9-ubuntu.log` and
  the sources at `14a6026`, 140,185 tokens; one thing checked by me,
  `bin/remote.test.mjs:54`). **The 132 skipped** are all skipped by design off Windows,
  by `process.platform`, but one that is skipped everywhere; none for a missing program:
  97 in `bin/remote.test.mjs` (`WINDOWS_ONLY`, `:54`), the whole `js-harness remote`
  command; 14 in `evals/runner.test.mjs` (`:1459`), the sweep of trial processes by path;
  5 in `bin/lib/process-tree.test.mjs` (`:561`), the real `killTree` and `killSurvivors`;
  4 in `bin/gate.test.mjs` (`:1136`), the gate's arguments through `cmd.exe`; 3 in
  `evals/isolation-probe.test.mjs` (`:1132`), a held folder and the orphan sweep; 2 in
  `bin/lib/project.test.mjs` (`:1435`, `:1470`), paths that differ by case alone; 6 more
  inline (`bin/tui.test.mjs:965`, `bin/lib/remote.test.mjs:546` and `:1035`,
  `evals/ports.test.mjs:120`, `evals/codex-isolation-probe.test.mjs:255`,
  `evals/home.test.mjs:230`); and `bin/lib/project.test.mjs:1509`, skipped on Windows too.
  In exchange Linux runs the seven symlink tests his machine skips for want of the right
  to make a link. **The 7 that fail:** four are the test's own (two of
  `bin/lib/payload.test.mjs`, `:197` and `:212`, feed a Windows absolute path, which
  `path.isAbsolute` rightly calls relative there; `evals/codex-isolation-probe.test.mjs:301`
  asks for `HOMEDRIVE`, set on Windows alone, `evals/configs.mjs:144`;
  `bin/lib/project.test.mjs:1919` expects a reason that went stale at `ae471e7`, unseen
  because Windows skips that test); two share one possible defect of the harness on Linux
  (`evals/ports.mjs:168-169` names a process by `ps -o comm=`, which answered `MainThread`
  for a Node child, so nothing matches `node`; whether it touches the real `engram` binary
  is not known without running it there); one is a small defect (`exists` of
  `evals/paths.mjs:6` lets `ENOTDIR` through, so a raw directory below a file is refused
  with the system's words and not the command's; the run is still refused). So of seven,
  one confirmed and cosmetic, one possible, four of the tests. Nothing fixed.
- 2026-10-12 · **T9, the 124 of GitHub's Windows: the suite assumes his machine** (one
  reader on `t9-windows.log` and the sources at `14a6026`, 182,720 tokens; checked by me:
  the log names `RUNNER~1`). 123 of the 124 have one cause: the runner's `TEMP` is
  `C:\Users\RUNNER~1\AppData\Local\Temp`, an 8.3 short name, since the user `runneradmin`
  is longer than eight letters. The fixtures build every repository from `os.tmpdir()` and
  keep that spelling; the harness takes its root from `git rev-parse --show-toplevel`,
  which answers the long one; Node's `fs.realpathSync` does not expand a short name (only
  `.native` does), so the tests' comparisons and the ids hashed from a root cannot agree.
  His user `Oficina` has seven letters and no short form, so the suite never met it. By
  group: 62 assert a path equal, short against long; 49 of `bin/remote.test.mjs` seed
  their fixtures under an id hashed from the short root while the command hashes the long
  one; 5 inject a failing file call that matches the short path; 4 are hook or junction
  paths judged outside the long root; 1 end to end; 1 the whole-file line that follows
  from it (its `after` could not remove a temp folder, `EPERM`). The last one is the
  symlink test that also fails on Linux: a stale expectation, run there because the runner
  may make links. No timeout, no git configuration, and the C: and D: split is no cause.
  **One finding in the harness itself, narrow and on the safe side:** `isWithinBase` of
  `bin/lib/project.mjs` folds case and not 8.3 names, so a hooks path or a junction target
  spelled short is judged outside the repository and its hook is not written; an ordinary
  project never meets it, since every root comes from git's long answer. So: not a harness
  that fails on a clean Windows. What a fix of the suite would be, not built: make each
  fixture's root canonical once with `fs.realpathSync.native` before a path from it is
  compared or hashed beside one git reports.
- 2026-10-12 · **M1 a third time, after his word that the folders are excluded: the antivirus did
  not fall.** `m1c-turn.log`, 14:33:16 to 14:47:10, tree `fc70dc3`, the command of the second
  run (tables `m1c-count.json`, `m1c-machine.json`, `m1c-machine.txt`). Wall 830.2 s against
  735.6; busy 6,209 of 6,642 processor-seconds (93%, as before); git 12,041 processes, 1,729 s
  against 1,516; `MsMpEng` 1,171 s against 917. Not a clean pair: `claude` spent 435 s against
  144 (two readers of mine and the other sessions ran beside it), which is part of the longer
  wall. But the antivirus rose with the work instead of falling, so the exclusion does not show
  in what the suite costs: either the paths he typed are not the two folders, or, as likely,
  what is scanned is the tests' repositories, which they make under his Temp folder, outside
  both. Nobody can read the exclusions without an administrator. Five tests fail under the
  counting tool by the tool's own doing (its `COUNT_GIT_*` variables and `NODE_OPTIONS` reach
  children whose environment those tests assert), not in a gate. To tell the orchestrator
  plainly, with the candidate that is the harness's half and not built: a temp root for the
  gate's tests under an excluded place.
- 2026-10-12 · **After a compaction (about 14:50): the line to the orchestrator, and two
  turns in the line.** Read from `date` and `get_usage`: 14:51:34, context 25%. (1) The
  two reviews of `97703f9` (`hook-review-turn.sh`), waiting. (2) **The orchestrator's
  experiment of 14:50, M1d** (`m1d-turn.sh`): the M1 of the second and third runs (tree
  `fc70dc3`, the same command) with `TEMP` and `TMP` of that command alone set to a new
  empty folder, `D:\js-harness-worktrees\.gate-tmp-m1`, inside what he says he excluded;
  the script removes it at the end, prints the three runs side by side (wall, busy, git,
  `MsMpEng`, `claude`) and exits 10 when no fixture landed there 45 s in. Its reading: a
  clear fall of `MsMpEng` from 1,171 s means the tests' repositories under Temp were the
  cost, and a temp root under an excluded place is the harness's half to build; no fall
  means the cost is paid elsewhere (a wrong path, or each process started), and the answer
  is fewer processes and Linux. Tests that fail only for the moved temp root are listed,
  not fixed.
- 2026-10-12 · **The comparison of the two roads is written** (Design, "Two roads to a
  gate on Linux"), nothing built. New facts in it, read by me: the repository is private
  (`gh repo view`); the gate log's line of 2026-10-12 to 14:50 (53 gates of 300 s or more,
  50,925 s; 131,289 s waited, summed); his machine is 8 threads and 20 GB; `wsl.exe` lists
  no distribution. Told to the orchestrator, which brings the readers.
- 2026-10-12 · **T13 built, in the line** (15:02 by `date`): a sixth worktree,
  `D:\js-harness-worktrees\gate-doc-checks`, branch `feat/gate-doc-checks` off `main`
  3088960. The design, as built: `harness.json` `documentSensors`, named commands of the
  shape of `sensors`; a commit of documents alone runs those, a row each after the INFO
  row, two minutes each at most, **with no gate lock and no line in the gate log** (a
  check of seconds beside a running gate costs less than an hour in the line; one that
  needs longer is told it belongs in `sensors`); any other commit runs `sensors` as before
  and none of these; they run even where a static row already failed, since there is no
  wait and no suite for the stop to save; declared with no `documents` they fail the gate.
  This repository declares `node bin/js-harness.mjs rules check` and `node --test
  bin/rules.test.mjs bin/sessions.test.mjs`. Which tests read the repository's own
  documents was searched again by me (`rg` over every `*.test.mjs` of `bin`, `evals` and
  `scripts` for `docs`, `odd/tasks`, `ROADMAP`, `FAILURES` beside a read of the
  repository's root): those two files, `bin/rules.test.mjs:18` (`docs/rule-sources.json`)
  among them; the search could have found any other, since it found these.
  **With it, the orchestrator's ask of 13:20:** `check` refuses an argument it does not
  know, exit 2 with the usage and no row computed; `gate` already did
  (`bin/gate.mjs:109`), so only `check` changed. The roadmap's Sensors row and its
  sentence "no test reads `docs/` or `odd/tasks/`" are corrected in the same commit.
  The turn is `t13b-turn.sh` (`t13-apply.cjs` writes the tests, then the sources; logs
  `t13-red.log`, `t13-green.log`, `t13-commit.log`): RED, GREEN, the two declared commands
  for real and timed, then the commit, whose hook runs the whole gate. Applied dry and
  restored before it was asked: 321 lines added, 22 removed, in four files. Then both
  reviews, its push and its pull request.
- 2026-10-12 · **The comparison is rewritten after the double review** (the orchestrator's
  message of 15:05; its two readers' file read once). The section is now "Roads to a
  shorter wait for the gate". Checked by me before it was built on: his words of 01:48
  (line 1384 of the orchestrator's transcript, a queued message, origin human); the serial
  runs of GitHub (the tests' times summed from `t9-ubuntu.log` and `t9-windows.log`); the
  4,519 s the tests sum to on his machine and the 345 s of what Linux skips
  (`m1b-tests.log`); the 1,681 children that are not git and the files that own them
  (`m1b-count.json`, `timeLine`). What it comes to: the suite's work is process starts,
  seven times dearer on Windows than on Linux and 3.6 times dearer again on his loaded
  machine; and every road but a cheaper Windows run is the trade he passed over at 01:48,
  so one question would go to him. Owed before it is asked: M1d, and a reading of what
  the 1,681 children are for.
- 2026-10-12 · **What the 1,681 children are, from the table alone** (`m1b-count.json`,
  `timeLine`, read at 15:11): 29 test files start a child that is not git; the 21 files
  of `evals/` start 1,395 of them, 4,096 s of the 4,668 s summed, and `bin/` and
  `scripts/` the other 286 (573 s). By file: `evals/runner` 501 (1,044 s),
  `evals/task-proof` 346 (1,823 s), `evals/isolation-probe` 210 (411 s), `evals/tasks` 99
  (268 s), `evals/suite` 82, `evals/configs` 70, `bin/check` 54, `bin/js-harness` 49.
  They are Node processes: the fake agent a trial is run against
  (`evals/fixtures/fake-agent.mjs`, started through `evals/runner.mjs:289`), nested
  `node --test` runs (`evals/task-proof.test.mjs:384`) and version probes. **The eval
  machinery's tests are 878 of the 3,781 tests and 2,696 of the 4,473 seconds the files
  take, summed: six tenths of the suite's time in a quarter of its tests.** With
  `bin/codex-review` (691 s, 6,067 git processes) they are the wall: three of the four
  longest files are `evals/`. Not read: whether those tests need a real process for what
  they prove (a process tree that is killed does; a trial's outcome read back may not).
  That reading is road 1's next step, and it is a reading, not a cut.
- 2026-10-12 · **T11 has both reviews and its pull request, 75** (`hook-review-turn.log`,
  15:22:06 to 15:23:44): gentle-ai approved and acknowledged (two captures, 40.9 s
  together); Codex "the patch is correct", 180,267 input tokens (140,928 cached) against a
  plan of 71,000, recorded for `3088960..97703f9`. Pushed and opened at 15:24:
  https://github.com/jsaristi/js-harness/pull/75. **Two findings of gentle-ai's
  reliability lens, not blocking, left for later:** no test shows that a failing gate
  makes `git merge` exit non-zero and leave no merge commit (the two that exist prove the
  passing paths); and the test with real git installs its own copy of the hook, so the
  shipped file is tied to it only by a comparison of its `exec` line.
- 2026-10-12 · **Road 1 read: which process starts of the eval tests are the proof** (one
  read-only reader at high, no test run, 285,336 tokens, 15:13 to 15:25; its full table is
  `eval-children-reading.md` in the scratchpad; asked by the orchestrator before any
  question reaches him). Its figure: **between about 630 and 840 of the 1,395 starts, and
  about 1,800 to 2,300 of the 4,096 child-seconds, could go without losing a proof, and
  only about 50 of those starts are reachable through a seam that exists today.** Every
  count is inferred from the code, since the counting tool does not say which test
  started which child; two file totals agree with it (346 inferred against 346 measured
  for `evals/task-proof`, 500 against 501 for `evals/runner`). By kind:
  - **The largest kind is not a test's choice: about 490 PowerShell process snapshots.**
    Checked by me: `runProcess` ends every run with `stop(sweep)` (`evals/runner.mjs:345`,
    the default `killSurvivors` at `:278`), which on Windows takes a snapshot of every
    process through PowerShell (`bin/lib/process-tree.mjs:259`, `:191`), whether or not
    the child left anything; and no caller of `runProcess` in `evals/` passes another
    `killSurvivors` (`rg killSurvivors evals/*.mjs` outside the tests: `runner.mjs` alone).
    About 30 of them are the proof (survivor, timeout and interrupt tests); about 460 find
    nothing. By the reader's inference from two tests' times, one costs near 5 s under
    load against 0.3 s for a Node start; `WmiPrvSE` at 148 to 162 processor-seconds in
    both whole runs agrees with it. This is the eval runner's own behaviour in a real
    trial too, where the sweep is the protection, so what a test may skip is a design.
  - The hidden grader and the visible suite (`node --test` through
    `evals/runner.mjs:289`): about 282 starts, mixed; `proveTask` runs five real
    processes and five snapshots at each call, the tests that only check the shape of a
    file included, and exports no smaller piece. The fake agent: about 108, mixed, no
    seam in `runTrial`. The isolation probe's fake Claude: about 95, mostly fixture, no
    seam. Sleepers, holders and grandchildren (about 67), the real tasks' own tests (49)
    and the few probes: proof.
  - What a real process proves, by the reader: stdin, folder and environment as a real
    child received them, a real exit code, a timeout that fires, a tree that dies, a real
    `node --test` in an emptied workspace, a listener on a port. What the fixture tests
    assert in its place: rules on the shape of files, and the runner's own bookkeeping.
  **What it means for road 1:** the gain is real and it is not free. The tests of the
  fixture class take 1,101 s of the 1,937 s the named tests of those four files take, so
  about a quarter of the suite's 4,519 s; but all except some 50 starts sit behind
  `runTrial`, `gradeWorkspace`, `proveTask` and the probe's arm, which start their
  processes themselves: taking them out means seams in the eval machinery's own code,
  which is a design with its reviews, not a cut. And the wall would then be
  `bin/codex-review` (691 s, all git), so the git cuts are needed with it for the run to
  get shorter by much. Not determined: seconds by kind, the eight smaller eval files
  (239 starts, 550 s), and how much of the 12 minutes would go, since files run together.
  The orchestrator's sentence, with reader 1's count: 25 of the day's 53 gates came from
  this feature's own worktrees, so part of today's line is the cost of measuring the
  line.
- 2026-10-12 · **M1d, the fourth whole run: the tests' temp folder inside the place he
  excluded** (`m1d-turn.log`, 15:23:49 to 15:35:38; tree `fc70dc3`, the command of the
  second and third runs with `TEMP` and `TMP` set to
  `D:\js-harness-worktrees\.gate-tmp-m1` for that command alone; 45 s in the folder held
  49 entries, so the fixtures did land there; removed at the end). Side by side, from
  the three tables:

  | run | wall | busy of capacity | `MsMpEng` | `claude` | tests summed | children not git |
  |---|---|---|---|---|---|---|
  | M1b, before the exclusion | 735.6 s | 5,464 of 5,884 (93%) | 917 s | 144 s | 4,519 s | 4,668 s |
  | M1c, after it, Temp outside | 830.2 s | 6,209 of 6,642 (93%) | 1,171 s | 435 s | 5,171 s | 5,422 s |
  | M1d, Temp inside | 705.2 s | 5,152 of 5,641 (91%) | 655 s | 156 s | 4,292 s | 4,583 s |

  Git: 12,041 processes in all three, 1,516 s, 1,729 s and 1,455 s. The same five tests
  fail in the three, by the counting tool's own variables; none fails for the moved temp
  root. **The reading.** The antivirus fell clearly: 655 s against 917 s with the other
  sessions' load about the same (`claude` 156 s against 144 s), 29% less, and against
  1,171 s of the run a busier machine made. So his exclusion works where the files are,
  and the tests' repositories under Temp were part of the cost. **And the wall hardly
  moved:** 705 s against 736 s, 30 s, inside the 95 s two runs of one tree already
  differed by. What is left, 655 processor-seconds, the exclusion of a folder does not
  reach: the antivirus still looks at each of some 13,700 processes as it starts, and the
  programs are not excluded (the orchestrator's advice to him at 12:16, by its own word; not a choice he made). So a temp root of the
  gate under an excluded place is worth about half a minute of twelve on his machine, and
  nothing on a machine with no exclusion; it would be a small thing to build and it is
  not what makes the gate shorter. Fewer process starts is. Beside the measure: the eval
  reader worked until about 15:25 and I pushed a branch and wrote this document in its
  first two minutes; `claude` at 156 s says the load was that of M1b.
- 2026-10-12 · **Asked by the orchestrator at 15:31, in the line as `hook2-turn.sh`:**
  `main` moved to `e60cbda` (pull request 74), so pull request 75 must hold it; and the
  first of gentle-ai's two notes is wanted before the hook is relied on. One turn on
  `feat/gate-merge-hook`: the test "a merge whose gate fails is not committed" (red
  against a hook of a merge that runs no gate, green against the real one;
  `hook2-apply.cjs`), its commit with the whole gate, gentle-ai's assessment and, when no
  review of its own is due and the plan is inside the rate, Codex on that one commit;
  then `git merge origin/main`, which this branch's own merge hook gates with the whole
  suite. Then the push, and the head to the orchestrator. The second note stays: the
  shipped hook takes `node` and gentle-ai from the machine's PATH, so a test that ran it
  would start this machine's own.
  **Its order after that:** road 1 is the next design, inside his option 3 and with no
  question to him: a test whose point is not survival runs without the PowerShell
  snapshot that ends every `runProcess`, threaded through `runTrial`, `gradeWorkspace`,
  `proveTask` and the probe's arm, the real trial unchanged and the tests of survival,
  timeout and interrupt left on the real sweep; one independent reader attacks the design
  before it is built (what proof a test silently loses when its sweep is a stand-in;
  whether the real path stays covered); a measure planned against the 95 s of noise
  (summed child-seconds, or the same tree twice); slices of about 1,200 lines at most,
  both reviews each; its size to the orchestrator before building. Cut 2 of git: not now.

## Next
**His decisions of 2026-10-12, after he came back (each relayed by the orchestrator; his
words read by me in its transcript `65318fd5`, by type and origin, at the lines named):**
- Line 3800, 12:20, "listo la A…": a Codex plan up to 5% over the rate counts as inside
  it. A review runs without asking when `--plan` is at most 1.05 times the larger of
  300,000 input tokens and 1,200 a changed line; over that, or a second run after a fall
  midway, is his; no automatic retry. S1's plan on `fb7cc5c`: 1,074 lines, about 1,210,000
  against 1,288,800, under the rate itself. **Asked at about 12:30**, once, in a turn of
  the lock, measured (`s1-codex-turn.sh`, `s1-codex-turn.log`, `s1-codex-out.log` in the
  scratchpad): read its tail first; if it fell midway, the second run is his.
- Line 3913, 12:26, "Entonces hagamos esto y apliquemoslo de una vez…": his yes to the
  orchestrator's list (its line 3860). What is this feature's, in the order of gain:
  1. **The trial on GitHub now** (T9), inside the minutes his account includes, no spend,
     no setting of his account changed. First fact wanted: does the suite pass there, on
     Windows and on Linux, and how long. Tell the orchestrator before the branch is pushed.
     The monthly figure, GitHub against Cloudflare, goes back to him before anything is
     paid. Cloudflare (his question of about 12:30, not read by me) is a candidate beside
     GitHub and nothing is built for it: the orchestrator's reading, unverified, is
     Containers on the Workers Paid plan, 4 vCPU an instance at most, probably Linux only,
     no CI product (the runner would be ours), near 0.11 dollars a run by processor against
     0.50 on GitHub. Either road needs the trial's fact first.
  2. **No repeated control, now decided** (it was in "Brought to him, not built"): a tree
     identical to one that already passed runs no suite again; a clean merge of `main` that
     brings only documents runs no suite. To build here with its tests and both reviews.
     The design must say exactly how "already passed" is proven (the gate log's record of
     that tree) and that a merge that brings any code still runs the whole suite. His
     list's condition: no verification is lost.
  3. **Less work in the suite**: go on with cut 2 (`c2-turn.sh` was asked: the git callers
     of `bin/codex-review.test.mjs` three frames deep, table `c2-frames.json`).
  5. **The reviews outside the lock's turn** (T8 and more): build it. gentle-ai is measured
     (2.3 s and 12 s against the bound of 30 s); Codex's is measured on its first run, the
     bound stays the one fixed before.
  Not this feature's: the antivirus (his own hand; when he says the exclusion is on, the
  orchestrator asks for an M1 again. A candidate to design, not to build before its turn:
  the tests make their repositories under the user's Temp, outside any exclusion; a temp
  folder of the gate under an excluded place would be the harness's half) and the
  TypeScript language server of the sessions (the orchestrator's).

The order as it stands at 16:00 on 2026-10-12 (the orchestrator's, from its messages of
15:31, 15:47 and 15:56; each is a claim of its own, inside his option 3 and with no
question to him): T13's reviews and pull request; pull request 75 with `main` in it;
road 1's first slice, written now and gated in a lock turn; then S1's Codex record, T8
and the close. Closed, measured: the antivirus road (M1d). Compared and parked, his to
reopen: the Linux roads. Not now: cut 2 of git, the identical-tree proof (T12,
uncommitted).

1. **T13** (`feat/gate-doc-checks`, worktree `gate-doc-checks`). Read `t13b-turn.log`
   (`t13-red.log`, `t13-green.log`, `t13-commit.log`). When it committed: gentle-ai's
   assessment with `--base-ref origin/main --committed-only`, its lifecycle if due, Codex
   inside the rate (`codex-review --base <the commit>^ --plan` first), in a lock turn;
   then merge the current `main` in (a lock turn: the merge brings code, and this branch
   has no merge hook, so make it `--no-commit` and commit, which the pre-commit hook
   gates), push, pull request, and tell the orchestrator, which asked to know when it has
   both reviews.
2. **Pull request 75** (`feat/gate-merge-hook`). Read `hook2-turn.log`: the failing-merge
   test red and green, its commit, gentle-ai's assessment, Codex on that commit, the
   merge of `main` gated by the branch's own merge hook. Exit 10 means a review of
   gentle-ai's is due first; 11, the plan was over the rate or not read; 14, the merged
   tree failed the suite and the merge is left unfinished. When it ended with 0: push,
   and the head to the orchestrator.
3. **Road 1's first slice (T14)** (`feat/gate-wait-eval-sweep`, worktree
   `gate-wait-eval-sweep`, off `main` `e60cbda`). Two writers work in it since 16:00,
   with disjoint files and no test run: one on `evals/runner.mjs`, `evals/task-proof.mjs`,
   `evals/isolation-probe.mjs`, `bin/lib/process-tree.testkit.mjs` and
   `bin/lib/process-tree.test.mjs` (the run as a parameter of the four entries;
   `sweepLater` and `sweptLater`; their tests), the other on `evals/runner.test.mjs`,
   `evals/task-proof.test.mjs` and `evals/isolation-probe.test.mjs` (the deferred sweep
   handed in through each file's helper, the look in `after`, one test an entry). When
   both hand back: read each diff against its surface and the design; then one lock turn:
   RED with the shipping files and the testkit stashed, GREEN with them, the count of
   children that are not git on the four files with the counting tool of
   `feat/gate-wait-count` (before: 501, 346, 210, 99; expected 420 to 440 fewer), the
   commit with its gate. **The orchestrator's three conditions:** the trade for a leak is
   written (Design); if a removal fails because a child still holds a folder
   (`evals/runner.mjs:413-414`), stop and bring it with its count over a few runs, no
   retry and no wait added to make the tests green; if the count is not near the
   expectation, say why before the pull request. Then both reviews, one whole run for the
   report, the pull request.
4. **S1's last commit.** `f04efca` on `feat/gate-wait` needs its Codex record before that
   branch is pushed: `codex-review --plan --base f04efca^`, run inside the rate, measured
   by process (M2, number 1 for Codex).
5. gentle-ai and Codex on `47484bd..fc70dc3` (`feat/gate-wait-count`). T8 (the reviews
   outside the lock's turn; `AGENTS.md:17` and `bin/gate.mjs:3` say `node --test`). T10,
   the close.
6. Left for later, written down: the second note on the merge hook; the 14 by-path sweeps
   and 7 version probes of the eval tests; the fifth caller
   (`evals/codex-isolation-probe.mjs:535`); a cheaper process list for the real trial.

## Resume here
- Read the logs before anything is asked again: a turn started before a restart of the
  desktop app sends no notice. `js-harness gate log --last 6` says which turns ended.
- Seven worktrees under `D:\js-harness-worktrees`. Pushed: `trial/gate-on-github`
  (`14a6026`, never merged) and `feat/gate-merge-hook` (pull request 75). Not pushed:
  `feat/gate-wait` (this document; S1's code ends at `f04efca`), `feat/gate-wait-count`
  (`fc70dc3`: the counting tools and the first cut), `feat/gate-doc-checks` (T13),
  `feat/gate-wait-eval-sweep` (T14, being written), `feat/gate-wait-same-tree` (T12,
  uncommitted, parked).
- The scratchpad is
  `C:\Users\Oficina\AppData\Local\Temp\claude\D--js-harness\d14eb9a1-e0dd-467c-8dc0-e2c7db2b0a86\scratchpad`.
  A script is handed to the gate as a file, never inline: `node
  D:/js-harness/bin/js-harness.mjs gate --wait 240 -- sh <script>`, in the background.
  Turn scripts there: `t13b-turn.sh`, `hook2-turn.sh`, `m1d-turn.sh`. Readers' files:
  `eval-children-reading.md`, `road1-design-attack.md`; the orchestrator's readers' file
  is `two-roads-review.md` in its own scratchpad.
- gentle-ai, for a commit: `gentle-ai review assess --cwd . --agent claude-code --base-ref
  <boundary> --committed-only --json`; when due, its `next_transition.command` with
  `--lenses` and `--lenses-reason` appended; `ga-exec.mjs <json> next_transition.execute
  <out> .` runs the start; the consent envelope's `granted` invocation is a string, run as
  it is; then the bound status, and the captures in a lock turn (`ga-capture-all.mjs`).
- The orchestrator is `JH ORQ · js-harness [ce6e34]`; its transcript is `65318fd5`. Its
  messages are claims: check one thing first. A message he sent while it worked is stored
  there as an attachment of type `queued_command`, not as a user line.
- Spent in this feature: Codex 1,949,288 input tokens (1,649,068 for S1, 119,953 for the
  trial's workflow, 180,267 for the merge hook); sub-agents 2,389,643 tokens before 12:45,
  about 572,000 from then to 14:50, and since then 285,336 (the eval reading), 261,389
  (the design's attack) and the two writers of T14, not yet counted.

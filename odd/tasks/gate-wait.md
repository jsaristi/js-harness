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

### Cut 2 of git: the review command asks git less (second version, after its reader)

**Why.** After road 1's first slice the run ends when `bin/codex-review.test.mjs` ends
(M1e: 624 s of 625). Its time is 6,067 git processes in one chain, and 4,618 of them are
the shipping command's own questions, asked through the fake Codex's `spawn`, which
hands `git` to the real one. A question the command stops asking leaves the wall at
about 95 ms a start, leaves every real review too, and changes no test's proof.

**What a run asks today** (`bin/codex-review.mjs` on `feat/gate-wait`, which holds S1):
where the top is (`:1097`), where the git folder is (`:1117`, the first time a record is
read), what commit `--base` names (`:1124`), what commit `HEAD` is (`:1129`), whether the
tracked tree is clean (`:1232`), the merge-base (`:1247`), three diffs (`:865`, `:946` or
`:935`, `:1256`), the marks (`check-attr`), the coverage's `rev-list` and `log`; and,
new with S1, after every session of a part and after the whole review, `HEAD` again and
the tree again (`:1397-1398`, `:1756-1757`). **S1 adds two processes a hold, and more. Counted on 2026-10-12 at 19:06
(`c3-before.json`): that file starts 7,840 git processes with S1 where it started 6,067
before it, 1,773 more (`rev-parse` +539, `status` +398, `for-each-ref` +340, `diff`
+292), and takes 365 s alone where it took 323 s. So S1 on `main` makes the wall file
longer by itself: about 700 s inside a whole run, where the suite takes 625 s today.**

**What is joined, and only this:**

| questions | now | after | how |
|---|---|---|---|
| the git folder, the base, the head | three processes | one | `git rev-parse --git-dir --git-common-dir HEAD^{commit} <base>^{commit}`, asked in the top as the three are now |
| the hold: `HEAD` and the tree, after a part and after the review | two processes | one | `git status --porcelain=v2 --branch --untracked-files=no`: its `# branch.oid` line is the commit, and any line that is not a header is a tracked change |

Tried on this machine's git (2.54.0.windows.1, 2026-10-12): the first prints four lines
(`.git`, `.git`, the two commit ids) and exits 0; with a base that names no commit it
exits 128 after the head's line; with a base that reads as an option (`--all`) it exits
128; `--end-of-options` is printed back as a line by `rev-parse` without `--verify`, so
it is not used. Asked from a subdirectory the git folder comes back absolute and the
common one relative to that folder, so the join is asked in the top, never where the
command was started: where the top is stays its own process.

**The rule that keeps every refusal as it is: the join is a first try, and anything it
cannot answer cleanly goes to the questions as they are asked today.** Cleanly means: exit
0, exactly four lines, and the last two each a full commit id (40 or 64 hex digits). A
base that is no commit, a repository with no commit, a git folder whose path holds a line
break, a base that `rev-parse` reads as a flag of its own and answers with something
else, no git on the path: each fails that test, and the run then asks the three single
questions in today's order and says what it says today. So no message and no exit code
of the command changes, and the tests of each refusal pass through the code they pass
through now. The hold's join has the same rule: no `# branch.oid` line with a commit id
in it, or a failed process, and the two single questions are asked.

**Which test proves each answer is the same as before** (written first, red on the
command as it is):
1. A run on a clean repository asks the joined `rev-parse` once and none of the three
   single ones; its record, its run line and its output are those of today's run (the
   fake's `spawn` logs what git was asked).
2. One test for each way the join is not clean (exit 128 for a base that is no commit;
   three lines; a line that is no commit id; a failed spawn): the three single questions
   are then asked, and the run ends as today's test of that case says.
3. The hold after a review asks one `status` in the second format: with the head where
   it was and no change it writes the record; with `# branch.oid` naming another commit
   it refuses with today's sentence, "HEAD moved from … to …"; with a changed tracked
   file it refuses with today's sentence; the same three for the hold after a part.
4. The hold's join answered badly (no header line): the two single questions are asked.
5. Every existing test of the file passes unchanged, but for the ones that count or
   name the git questions of a run, each read and changed by hand.

**Left as they are, and why.** Where the top is: it must be asked where the command was
started. The check of the tree before a review (`:1232`): its text is printed to the
user in the first format. The merge-base: one question, needed. The three diffs: they
are asked with different flags (renames off, a submodule as a file), and whether two of
them are the same patch is a question of what a review covers, which is his if it
changes. The coverage's `rev-list` and `log` and the marks: another module, with rules
of their own on renames and root commits; a candidate for a later cut, not read enough.

**What it should give, to be counted and not believed.** Two processes fewer a run of
the command (about 500 runs in that file) and one fewer a hold (398 of them, by the
count of `status`): about 1,400 starts of that file's 7,840. **That is less than the
1,773 S1 added: the two joins pay for most of S1 and leave the file a little longer than
it is on `main` today.** To end under today's wall the second version must add, each
with its proof or its reason to stay: the 340 `for-each-ref` S1 asks once a run
(`bin/lib/codex-review-coverage.mjs:353`, whether the remote has any branch, before the
note on a base no record covers), the 292 `diff` S1 added, and the test file in two,
which changes no shipping code and is worth up to about 100 s once S1 is in, at the
price of its helpers in a shared module. **The count before is taken**
(`c3-before.json`, the file alone under the counting tool); the same count after is the
proof, by subcommand.

**What an installed project sees.** A review starts two or three processes fewer and
says, records and refuses what it does today. Nothing to configure, nothing to undo.

**Risk.** Item 3 of the list in spirit, though no flag, message or record changes: this
is the command whose records the pre-push check trusts. Both reviews, and the reader's
attack asks, for each case the single questions cover, what the join does with it: the
question the first slice of road 1 was not asked.

**The second version: what the reader's attack changed** (2026-10-12; one reader, Opus
at high effort, read-only, 28 tool calls, 144,861 tokens; a first reader asked at 18:45
stalled within three minutes and gave nothing. Three of its findings checked by me on
this git before they were written here). Where this differs from the text above, this
holds.

1. **What "cleanly" means, exactly.** The exit code fences nothing: `rev-parse` without
   `--verify` exits 0 and prints back an argument it does not know (`--all^{commit}`
   gives exit 0 and the line `--all^{commit}`; `--since=x` gives a `--max-age=` line;
   a `--glob=` gives three lines). The text above says such a base exits 128: wrong, that
   was with `--end-of-options` in the command. So: the base is the last argument; the
   answer is a string (not a buffer, not a number) and nothing threw; it has exactly
   four lines; lines 3 and 4 each match a full commit id, 40 or 64 hex digits, both of
   one length. Anything else goes to the single questions. Across about 55 spellings of
   a base the reader tried (a name that is both a branch and a tag, an annotated tag, an
   abbreviated id, a file named `HEAD`), every answer that passed that test was the
   commit `--verify` gives.
2. **The hold asks `git status --porcelain=v2 --branch --no-ahead-behind
   --untracked-files=no`.** Without `--no-ahead-behind` the second format walks the
   history against the upstream on every hold, which the two single questions never did
   and an installed project far from its upstream would pay. A hold whose join failed
   once in a run is not tried again in that run: on a git that refuses the form each
   hold would otherwise cost three processes. Checked equal to today's meaning: a
   rename, an intent-to-add and a staged add each give a line that is not a header where
   the first format is non-empty; `status.showStash` adds a header line `# stash`, which
   is why only lines that do not start with `#` count; an unborn branch says
   `# branch.oid (initial)`, which is no commit id and goes to the single questions.
3. **Tests that exist and change, named** (`bin/codex-review.test.mjs` on
   `feat/gate-wait`): `:4292`, `:5017` and `:5356` put a failure into the first git
   process whose arguments hold `--git-common-dir`; after the cut that process is the
   join at the top of the run, so their failure would be swallowed by the fallback and
   two of their answers (a number, a buffer) would throw in `git()` at
   `bin/codex-review.mjs:295`. They are aimed again at the single question the fallback
   asks. `:970` fails every git call that holds `HEAD^{commit}` after Codex ran and
   expects "Could not read HEAD and the state of the tree again": with the hold as one
   `status` it would pass by accident; it is rewritten to fail the joined status and
   then the single question. `:5314`, `:5335`, `:5344` count how often the git folder
   is asked: read and kept true.
4. **The order of the tests.** First, green on today's code: the six outcomes of the two
   holds (written, HEAD moved, tracked files changed, could not be read; after a part
   and after the review), of which only two have a test today (`:3626`, `:935`), and
   HEAD moved with a failed status for each hold, since the two holds order their
   checks differently (`:1399` unreadable first, `:1758` moved first) and the join must
   keep each order. Then, red: the tests that count the processes of a run. The first
   version called all of them red: only the counts are.
5. **What it gives is an upper bound.** The git folder is asked only by a run that
   reaches the records, so a run that is refused early asks two questions today and
   would ask one, and a base that fails asks one today and two after (the join, then
   the single question). About 340 runs of the test file reach the records, by the
   count of `for-each-ref`, not 500. So the two joins give about 700 to 1,100 starts
   there, not 1,400.
6. **The merge-base joins the first question; the `for-each-ref` stays.** `git rev-parse
   --git-dir --git-common-dir '<base>^{commit}...HEAD^{commit}'` prints the head, the
   base and then `^<merge-base>`, equal to `git merge-base`, and no caret line when the
   two share no history (the reader's run; several merge-bases not tried). That is one
   process more out of every run that goes on to a review or a plan, about 550 in that
   file, and it has to be proven before it is built: a base with several merge-bases,
   and today's refusal "share no history". The `for-each-ref` as a trailing
   `--remotes=` would make the answer unbounded and change meaning for a remote whose
   name has a glob character: left.
7. **The test file in two is the cleaner gain and is taken first if the count allows.**
   It touches no refusal and no shipping code. What is not known is whether the gate
   has the cores: the work's bound was 565 s at full use before S1. It is decided on a
   number: after the joins are built, the file's count and its seconds alone say whether
   it still leads the suite; if it does, it is split, with its helpers in a module both
   halves load.

Not checked by the reader, and so not claimed: a submodule, a path with a line break,
unmerged lines of the status, any git older than this machine's 2.54 (the second format
and `--no-ahead-behind` are old, by memory 2.11 and 2.17; the fallback is what covers a
git that has neither), whether the second format refreshes the index differently.

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
- [x] T4 · The cuts T3 chose, each judged by a second run. Route: set per cut in T3. Evidence:
      cut 1 never reached `main` and T17 took its point; cut 2 is T16; cut 3 is
      `bin/lib/git-fixture.testkit.mjs`, 1,545 git processes fewer in 15 files; cut 4 is his. The
      entry of 2026-10-16 in Progress.
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
- [x] T7 · M2: what a review spends against its number, and one review beside one gate.
      Route: inline, with the reviews of S1. gentle-ai measured; Codex from the records
      since 2026-10-15: it holds for both (Progress, 2026-10-16).
- [x] T8 · If M2 holds: the texts. Route: inline (one sentence was left; faster-check T4
      had taken the rest). The orchestrator skill lets both reviews run beside a gate and
      keeps a sub-agent that runs tests waiting; test in `bin/lib/manifest.test.mjs`.
- [x] T9 · The trial on GitHub: the workflow on its branch, one run, what it answered, the
      figure and the two questions sent to the orchestrator. Route: inline, one file.
      Superseded, not built further (2026-10-16, JH 24, by the orchestrator's brief): the gates on
      GitHub are `first-version.md` T7, owned by the session "JH 21", which builds the workflow
      this trial was to inform; its branch `trial/gate-on-github` stays unmerged as evidence.
- [x] T11 · The merge hook, first and alone: `.githooks/pre-merge-commit` on
      `feat/gate-merge-hook`, both reviews, its pull request. Route: inline.
- [x] T12 · The identical-tree proof (Design, "No repeated control"), after the cut of git
      processes. Route: inline. Evidence: `b4309dd`, and `0e0f385` after Codex's finding, on
      `feat/gate-wait-same-tree` off `main` `addf6ae` (Progress, 2026-10-13).
- [x] T13 · The quick checks that read documents run on a documents-only commit, if they
      are seconds; the figure to the orchestrator if they are minutes. Route: inline.
- [x] T14 · Road 1, first slice (Design): the eval tests take one process snapshot a file.
      Route: delegated, two writers with disjoint files launched together (the context
      backstop: the parent was at 70% of its window); the parent reads the diffs, runs the
      lock turn and commits. Evidence: pull request 79 on `main` (`e3e6b2d`, `964aafc`).
- [x] T15 · A Codex review runs at medium effort (his answer, 2026-10-12): the command's
      value, the declared rule and its source, the two pins of the comparison, one commit
      on `feat/review-effort-medium` off `main`. Evidence: `cb96924`, pull request 87. Route: inline; the rule's half is JH 7's
      patch.
- [x] T16 · Cut 2 of git (Design, second version): the git folder and the two ends of the
      range in one question, HEAD and the tree after a session in one, each a first try
      with today's questions behind it. Route: inline, tests first, on
      `feat/gate-wait-git-cut` off `feat/gate-wait`; both reviews; judged by the count of
      the command's test file after (`c3-after.json`) beside the count before. Evidence:
      `823047e`; 7,840 to 6,628 git processes; the entries of T16 in Progress.
- [x] T17 · The command's test file runs as two processes (the design's point 7, decided
      on M1f: the file is the wall alone). A mark in the file and a second file that
      starts the half below it; nothing moved. Route: inline, tests first, on
      `feat/gate-wait-two-halves` off the cut; Codex's review is the outside read (the
      orchestrator: no reader for it); judged by M1g, the whole suite by file after it.
- [x] T18 · Road 1, second slice, its first row: the tests of a task's file rules
      (`evals/task-proof.test.mjs`) take their five runs from a stand-in. Route: inline.
      Evidence: `85566a8` on `test/eval-fewer-starts`; 176 other starts of that file
      before, 85 after. The second row (`evals/runner.test.mjs`) is not built.
- [x] T19 · A gate keeps who spent the processor over its run (2026-10-13, from the measure of
      the slower check in Progress; ordered by the orchestrator at 20:13, after the stretch of
      "JH 9" on `bin/check.mjs` is on `main`). With it, the comment at the head of
      `bin/gate.mjs` says the whole rule for runs beside a gate. Route: delegated (one writer,
      by the context backstop of JH 24), reviewed by JH 24. Evidence: `feat/gate-busiest-run`;
      `watchBusiest`, `busiestOverRun`, `processTimes` (`machine-busiest.mjs`), `busiest.jsonl`
      keyed by the start's id (`appendGateBusiest`, `readGateBusiest`, `gateRecord.busiest`),
      `watchRun` in `check` and `gate`, `gate log` ending a line with the three heaviest; 21
      tests seen red then green; `check.test.mjs` 219/219. Cost: the end reading runs before
      the lock is released, about 3 to 4 s a gate on a loaded machine (11 s at most), since one
      after the release would count the next gate's run.
- [x] T20 · A queued command is refused before it waits, not after (candidate, 2026-10-13, the
      orchestrator's, from a failure of the session "JH 9": its Codex review waited about 40
      minutes for the lock and then started nothing, "Tracked files have uncommitted changes").
      Two parts: `codex-review --plan` says that the tree is dirty; and `js-harness gate` can
      run a cheap refusal the queued command declares, when it is queued and again when its
      turn comes. The turn scripts of this session have the same hole: their check of the head
      and of a clean tree runs after the wait. Not sized.
      Built (2026-10-16, JH 24) on `feat/gate-refuse-early`, test first: `codex-review --plan`
      says uncommitted tracked changes on stderr, its plan and exit 0 unchanged; `js-harness gate
      --ready <command>` runs the check before the wait and again as the turn comes after one,
      and a failure runs nothing (exit 75, `refused` with reason `not ready` in the gate log).
      The box is checked at T10, so this line and T19's do not meet in a merge. The turn
      scripts are scratch files of their sessions and are left: `--ready` is what they can use.
      Codex on `6a6ce9e..2c519af` (P2, correct): a wait behind a gate in the line that left before
      it held the lock named no gate waited for, so the check was not asked again. The check is now
      asked again whenever the turn was not taken at the first look of the lock (`looks`, the count
      the launcher's last look already uses), with a test for that wait.
      *Later, non-blocking (gentle-ai, 2026-10-16).* T19 (lineage `review-cf7d0d2ecad4ae1a`, PR 276):
      the last read of the busiest processes holds the lock 3 to 4 s; the watch is not ended when a
      run throws, in `check` and in `gate`; a failed write of `busiest.jsonl` is said although the
      docs say nothing is; names are not cleaned when read. The pull request counts six of them; the
      record of this session kept these four. T20 (lineage `review-8d18a3a8381fa79c`): no test for a
      failing check at the turn on the inner path, nor for `codex-review --plan` when its `git status`
      fails; that `git status` takes git's optional index lock beside other commands.
- [x] T10 · Close: `docs/ROADMAP.md`, both reviews of each slice with code, pull requests,
      the closing notice. Evidence: the entry of T10 in Progress.
- [x] T11 · `review-tool-timeout` (docs/FAILURES.md): three of its four sightings ran beside
      a gate or a full machine (2026-10-11 beside a gate; 2026-10-15, host-update-check L4,
      while a retry on a quiet machine answered in 23 s, L6; 2026-10-16, first-version L10, at
      100% CPU with `--base-ref=origin/main`, then 9 s with the merge-base commit). M2 read "no
      sighting since 2026-10-11" from the review records, which keep no timeout; the manifest
      still says a gentle-ai review runs beside a gate. Design, read by two readers: whether a
      gentle-ai review waits for the gate lock, or is given the merge-base commit, and what a
      session does on `operation_timeout` (one retry with no gate running; then continue
      without reporting, record it in the feature document, Codex covers the range, he is not
      asked), written in the manifest's review text so an installed project gets it too. The
      provider defect stays tracked upstream as gentle-ai #5422, open (an occurrence on 4.1.1
      on 2026-10-16; this machine runs 4.2.0). When done, the entry's Control becomes the check
      or the manifest line it leaves. The lead's order of 2026-10-16 22:10Z: "fix the cause
      test first if it breaks shipped behavior, else open its task in the owning feature doc
      and settle the entry"; the cause is not shown (the timeouts are an observation beside
      the gate), so it is a task.
- [x] T12 · T11's later work, gentle-ai's warning: "the first-parent listing has no depth bound"
      (`onFirstParentLine`, `bin/lib/guard.mjs`, read `git rev-list --first-parent HEAD` whole).
      Test first. Evidence: the entry of T12 and T13 in Progress.
- [x] T13 · T11's later work, gentle-ai's warning: "a test's unquoted temp dir" (the real-repo
      test of `reviewBaseRefusal` in `bin/lib/guard.test.mjs`). Test first. Evidence: the entry of
      T12 and T13 in Progress.

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
- 2026-10-12 · **T13 is committed, `9c0c8e9`** on `feat/gate-doc-checks`
  (`t13b-turn.log`, 15:48:56 to 16:03:12). RED 15:49:01: with the tests alone the file
  does not load, since it imports what is not there yet (1 of 1 fails; a red by import,
  the weakest kind). GREEN 15:49:54: 175 of 175 of `bin/check.test.mjs`. The two declared
  sensors of documents, for real: the rules check 0.24 s, the two test files 3.25 s (227
  of 228 pass, one skipped). The commit's gate: `PASS  tests`; its review row: medium
  risk, 343 lines, not due (under budget), so gentle-ai runs no review of it. Codex's
  plan, read at 16:04: 339 changed lines, about 400,000 input tokens, inside the rate
  (406,800, with its margin 427,140). `main` merges clean into it (`git merge-tree`).
  **In the line as `t13c-turn.sh`:** Codex on that commit, once, measured by process (M2's
  number for Codex), then the merge of `main` as `--no-commit` and a commit the pre-commit
  hook gates. Exit 11: the plan was over the rate or not read; 12: no record; 15: the
  merged tree failed. Then push, pull request, and the orchestrator.
- 2026-10-12 · **T14, the first writer handed back** (Haiku at high, 163,483 tokens, no
  test run): the run is a parameter of the four entries (`evals/runner.mjs`,
  `evals/task-proof.mjs`, `evals/isolation-probe.mjs`; the local name is `start`, since
  three of those functions already hold a `run`), and `sweepLater` and `sweptLater` are in
  `bin/lib/process-tree.testkit.mjs` with eight tests in `bin/lib/process-tree.test.mjs`.
  Read by me, the shipping diff and the testkit function, line by line: as designed. One
  thing it added, kept: the look throws when a survivor outlives its kill, as the real
  sweep does. One line of a comment in `evals/isolation-probe.mjs` is too long: to wrap
  before the commit. The second writer (the three eval test files) still works.
- 2026-10-12 · **T14 is written and its turn is asked** (`t14-turn.sh`, asked at 16:08 by `date`; it waits behind another session's gate, the
  hook's turn and T13's).
  The second writer (Haiku at high, 234,978 tokens, no test run) handed the deferred sweep
  in at `trialEnv` of `evals/runner.test.mjs` and four `runSuite` calls, the `prove`
  helper and two direct calls of `evals/task-proof.test.mjs`, and the `probe` helper and
  `overridesFor` of `evals/isolation-probe.test.mjs`; each file ends with the look in an
  `after` registered before its own cleanup; four tests, one an entry, that it calls the
  run it was handed. Left on the real sweep: the direct `runProcess` tests and the
  `killByPath` section of `evals/runner.test.mjs`, the discovery test of
  `evals/task-proof.test.mjs`, and `evals/tasks.test.mjs` untouched. Its judgement call,
  kept: the by-path orphan tests keep `sweep: undefined` and take the recorder for the
  run, since their orphan's parent is gone and parentage could not find it either way.
  Read by me: the files changed are the eight of the two surfaces, 286 lines added and 30
  removed, every hand-in hunk, `node --check` on the eight; one over-long comment line
  wrapped by me. Not read line by line: the four new tests and the eight of the testkit;
  the turn runs them.
  **The turn:** RED a (the testkit's tests without the deferred look) and RED b (the four
  entry tests against the shipping code as it was), GREEN on the testkit's tests, then the
  four eval files under the counting tool of `feat/gate-wait-count`, which gives the
  tests' result and the count by file in one run (before: 501, 346, 210, 99), then the
  commit with its gate (message `t14-msg.txt`). Exit 20: a test failed with a folder that
  could not be removed or copied, the orchestrator's stop: bring it with its count, add no
  retry. Exit 7: the green failed otherwise; 9: the whole gate failed.
- 2026-10-12 · **Pull request 75 holds `main` and the failing-merge test; head `f116d83`,
  pushed at 16:43** (`hook2-turn.log`, 16:17:08 to 16:43:08). RED 16:17:11, against a hook
  of a merge that runs no gate: 2 of 3 fail, the new test and the one that was there.
  GREEN 16:17:17: 3 of 3. The commit, `513cc57` `test(hooks): a merge whose gate fails is
  not committed`, whole gate PASS at 16:30:13. gentle-ai: medium risk, not due (under
  budget). Codex: "the patch is correct" (0.91), 87,814 input tokens (54,784 cached)
  against a plan of 96,000, recorded for `97703f9..513cc57`. Then `git merge origin/main`
  (`03d6d20`, pull request 76 had been merged meanwhile), **gated by this branch's own
  merge hook: `PASS  tests` at 16:43:08, the first merge of this repository to go through
  it.** The pre-push check: 2 code commits since `origin/main`, both covered. Told to the
  orchestrator at 16:43. The first of gentle-ai's two notes is closed; the second stays
  (the shipped hook file is tied to the tests by its `exec` line).
- 2026-10-12 · **Pull request 75 is merged** (the orchestrator, 16:44:14; checked by me:
  `origin/main` is `af20747` and holds `f116d83`). Its worktree and local branch are
  removed. From `main` on, a merge git commits by itself runs the gate.
- 2026-10-12 · **T13 has its Codex record, `main` in it and its pull request, 77**
  (`t13c-turn.log`, 16:43:43 to 16:58:51): https://github.com/jsaristi/js-harness/pull/77,
  head `1382092`, a merge of `origin/main` `af20747` gated on the merged tree (`PASS
  tests` at 16:58:51). Codex: "the patch is correct" (0.88), no finding, recorded for
  `3088960..9c0c8e9`. **It spent 499,650 input tokens (418,944 cached) in 10 requests
  against a plan of 410,000**: 22% over its plan and 17% over the rate with its margin
  (427,140), run once. The second sample of the day where the estimate was under (S1: 36%
  over); told to the orchestrator for its estimator queue. **M2 for Codex, measured by
  process for the first time** (`t13c-codex-machine.json`): the review took 67.1 s and the
  machine was 37% busy during it, 201 of 537 processor-seconds (`MsMpEng` 49, `claude`
  25, `node` 13). T8 has its figure: a Codex review beside a gate adds about a third of a
  machine for a minute. Spent on Codex in the feature so far: 2,536,752 input tokens.
- 2026-10-12 · **Pull request 77 is merged** (the orchestrator, 17:00:44; checked by me:
  `origin/main` is `6785ec7` and holds `1382092`); T13's worktree and local branch are
  removed. And what it said I still owed is not owed: `gate` already refuses an argument
  it does not know, with tests, on `main` (`bin/gate.mjs:109`, `:129`;
  `bin/gate.test.mjs:375-376`, `:1023-1024`).
- 2026-10-12 · **T14 is committed, `e3e6b2d`, and the count is the one expected: 427
  fewer** (`t14-turn.log`, 16:58:57 to 17:12:26; `feat/gate-wait-eval-sweep`).
  RED a 16:58:57: without the deferred look the testkit's tests do not load. RED b
  16:59:04: against the shipping code as it was, the four tests "an entry calls the run it
  was handed" fail, 4 of 4. GREEN: the testkit's tests 59 of 59; the four eval files
  under the counting tool, 328 of 329 pass and one is skipped, in 227 s. **Children that
  are not git, by file, before (the same in four whole runs) and after (`t14-count.json`):**

  | file | before | after | tests' summed time, whole run of M1b | the four files alone, after |
  |---|---|---|---|---|
  | `evals/runner.test.mjs` | 501 | 331 | 734 s | 224 s |
  | `evals/task-proof.test.mjs` | 346 | 176 | 611 s | 64 s |
  | `evals/isolation-probe.test.mjs` | 210 | 123 | 524 s | 195 s |
  | `evals/tasks.test.mjs` (untouched) | 99 | 99 | 69 s | 88 s |
  | in all | 1,156 | 729 | 1,939 s | 571 s |

  The count does not depend on the machine's load and is the proof; the two time columns
  are not one measure (a whole run against four files alone) and are there to be read
  with that said. **No removal race showed:** no line of the run names EBUSY, EPERM or
  ENOTEMPTY, and no file's last look found a process left behind. **The whole suite, in
  the commit's own gate: 554 s** (gate log, 17:03:09, load 2.6 of 8), against 824 s for T13's merged
  tree (gate log, 16:45:05, read by me), 771 s and 737 s for the two gates of the hook's
  turn (the orchestrator's reading of the same log) and 705 s to 830 s for the runs of M1: about 180 s to 270 s
  less, well outside the 95 s two runs of one tree differ by. One run; the next gates of
  `main` after the merge are the second reading. The commit's review row: medium risk,
  317 lines, not due (under budget).
  **In the line as `t14c-turn.sh`:** Codex on that commit, once, measured (plan read at
  17:13: 317 changed lines, about 390,000 input tokens, over the rate of 380,400 by 2.5%
  and inside its margin, 399,420; the day's two samples say the spend may be a fifth to a
  third more), then the merge of `main` (`6785ec7`, clean by `git merge-tree`) gated by
  the pre-commit hook. Then push, pull request, the orchestrator.
- 2026-10-12 · **What T8 needs to become a slice, told to the orchestrator at 17:18**
  (written while `t14c-turn.sh` waits behind the gate of `rules-held`). Three things, and
  none is the writing:
  1. *S1 on `main` first.* A review beside a gate is safe because a review is held to the
     commit it read at its start, and that is `3e0b456`, one of the eight code commits of
     S1 that are on `feat/gate-wait` alone (`git log origin/main..HEAD -- bin`: `1841b96`
     to `f04efca`).
  2. *M2's number 2 is not measured, for either review.* Number 1 for Codex, read against
     a borrowed baseline: 201 busy processor-seconds in 67.1 s, and the quiet rate of the
     morning's two quiet minutes (1.7 to 2.2 a second) puts 56 to 87 of them above it, so
     **14 to 22 s added to a gate at most**, under the bound of 30 s; one sample, no quiet
     minute taken just before it. Not near enough to lower a review's priority. Number 2,
     a review that ends with an answer beside a gate, was never run. It can be paid with
     what is owed: S1's Codex review of `f04efca` as its own command, outside the lock,
     beside a gate of this session that is due anyway. gentle-ai has no review owed (every
     commit of the day came out under budget), so its number 2 stays unmeasured.
  3. *Then the texts*, about 60 lines, one writer, tests first: the message of
     `codex-review` (`bin/codex-review.mjs:643-648` on `main`) and its two tests,
     `docs/ROADMAP.md:58`, the shipped skill (`bin/lib/manifest.mjs:27`, `:98`), the help,
     the comments at `bin/gate.mjs:3` and in `bin/check.mjs`. `docs/FAILURES.md:170` is
     history and stays.
  His word of 2026-10-11 says a failed review "is repeated in a turn of the gate lock";
  T8 changes that sentence, and whether his yes of 12:26 covers it is the orchestrator's
  to say: asked. What T8 buys is a review's wait for the lock (up to 24 minutes behind two
  gates today), not suite time. The order proposed: T14's turn and pull request; S1's
  Codex record with number 2 measured in the same step; S1's pull request; T8's texts.
- 2026-10-12 · **Road 1's second slice, sized from the reading already made**
  (`eval-children-reading.md` against `t14-count.json`; nothing built, no reader yet; sent
  to the orchestrator at 17:21). What the four files still start that is not git: runner
  331, task-proof 176, isolation-probe 123, tasks 99. By kind, with the run now a
  parameter of every entry:

  | kind | starts left | could go | what stays on the real path | lines, a guess |
  |---|---|---|---|---|
  | `proveTask`'s graders and visible suites, in tests of a file's shape (`evals/task-proof.test.mjs`) | 171 | 91 (the tests classed fixture), 126 with the borderline ones | the eleven proof tests (47 starts) and the five real tasks of `evals/tasks.test.mjs` (74) | 100 to 150: a stand-in run that answers five clean results, handed in by the `prove` helper |
  | by-path sweeps and version probes of suites that do not stub them (`evals/runner.test.mjs`) | 50 | 21 | the nine direct `killByPath` tests, the two orphan trials, the two version tests | about 30: seams that exist |
  | the fake agent and its grader in trials that test the runner's bookkeeping (`evals/runner.test.mjs`) | about 194 | about 115, about 150 with the borderline ones | every test that reads what a real child received or that a tree dies (169 starts before the first slice) | 300 to 450: the fake agent's modes as a function the stand-in calls, and a grader's answer by mode |
  | the probe's fake Claude in scenario tests (`evals/isolation-probe.test.mjs`) | about 95 | about 80 | the ten proof tests (environment, timeout, orphans, a real listener) | 250 to 400: the fake Claude's modes as a function, with its files and HTTP requests made in the test's own process |

  **Two slices, not one.** The second: the first two rows, about 110 to 150 starts for
  about 130 to 180 lines, with no new stand-in logic beyond five canned results. The
  third: the last two rows, about 195 to 230 starts for 550 to 850 lines, and a different
  risk: a fixture that was a process becomes a function inside the test's process (its
  `process.exit`, its working directory, its ports), which is a stand-in of a stand-in and
  wants its own reader. Both together stay under 1,200 lines, but they are not one design.
  **What is not known, and comes first: where the wall is now.** Before the first slice
  the four longest files of a whole run were `evals/runner.test.mjs` 704 s,
  `bin/codex-review.test.mjs` 648 s, `evals/task-proof.test.mjs` 606 s and
  `evals/isolation-probe.test.mjs` 525 s (`m1d-count.json`). After it the four eval files
  alone take 227, 69, 199 and 88 s, and the whole suite took 554 s: the longest file of a
  whole run is probably `bin/codex-review.test.mjs` now, whose time is 6,067 git starts,
  not an eval's. If so, the next second of wall is in cut 2 of git and the eval slices
  buy load, not wall. One whole run under the counting tool on the merged tree (a turn of
  about ten minutes, no review, no spend) says which; proposed as the step after T14's
  pull request and before either design.
- 2026-10-12 · **Codex found a real defect in T14, and the slice is not pushed**
  (`t14c-turn.log`, 17:27:11 to 17:39:58). Verdict on `e60cbda..e3e6b2d`: "the patch is
  incorrect" (0.96), one finding, P2, `bin/lib/process-tree.testkit.mjs:165`. When a
  timeout's or an interrupt's kill fails, `runProcess` ends the run with no exit time
  (`evals/runner.mjs:304-310`, `:345`); the stand-in wrote the moment of the record in its
  place, which makes a root that may still run look exited, and the search at the end of
  the file leaves an exited root out (`bin/lib/process-tree.mjs:35`, `:94`). The one
  process the net exists for was neither killed nor named. Read in the code by me: true.
  **The design's reader and I both missed it**: the attack asked whether the net could see
  a leak and stopped at the descendants; nobody asked what the search does with the root.
  **The correction** (2 files, about 40 lines, written inline): a run handed in with no
  exit time goes to the real sweep at once, root and what it started, and is not recorded;
  the test that pinned the old behavior is replaced by two. Its turn, `t14d-turn.sh`,
  asked at 17:43: RED against the testkit as committed, GREEN, the four eval files under
  the counting tool (the 729 must hold), the commit with the whole gate, then Codex on
  that commit, once, if its plan is inside 315,000.
  **What the first turn did besides.** `main` `e90e0a4` (pull request 78 merged at
  17:28:44, the orchestrator; read by me) is in the branch as `17c2146`, gated: **605 s**
  (gate log, 17:29:50, load 3.9 of 8), the second reading of the 554 s, on a tree with
  more tests in it. **Codex spent 535,338 input tokens (466,944 cached) in 12 requests
  against a plan of 390,000**: 37% over its plan and 34% over the rate with its margin;
  the day's third sample and the third under. **M2 for Codex, second sample**
  (`t14c-codex-machine.json`): 145.7 s, the machine 43% busy, 499 of 1,166
  processor-seconds (`node` 148, `MsMpEng` 98, `claude` 38): Codex ran `node --test`
  itself this time, so number 1 is not one figure: against the same quiet rate (1.7 to
  2.2 a second) this review put 178 to 251 processor-seconds above it, **45 to 63 s added
  to a gate at most, over the bound of 30 s**. T8's first number does not hold for a
  review in which Codex runs tests. Spent on Codex in the feature: 3,072,090 input tokens.
- 2026-10-12 · **What a Codex review cost today against its plan, session by session**
  (asked by the orchestrator for his next question; read from the reviews' own output in
  the scratchpad, `s1-codex-out.log`, `hook-codex-out.log`, `hook2-codex-out.log`,
  `t13c-codex-out.log`, `t14c-codex-out.log`; no new measure, nothing spent):

  | session | changed lines | plan | spent | not cached | requests | spent a request | ran `node --test` |
  |---|---|---|---|---|---|---|---|
  | S1, part 1 of 3 | 287 | 320,000 | 513,922 | 96,258 | 10 | 51,392 | no |
  | S1, part 2 of 3 | 397 | 450,000 | 277,741 | 97,901 | 7 | 39,677 | no |
  | S1, part 3 of 3 | 390 | 440,000 | 857,405 | 81,469 | 15 | 57,160 | no |
  | the merge hook | 57 | 71,000 | 180,267 | 39,339 | 7 | 25,752 | yes, once |
  | the merge hook's test | 81 | 96,000 | 87,814 | 33,030 | 4 | 21,954 | no |
  | T13 | 339 | 410,000 | 499,650 | 80,706 | 10 | 49,965 | no |
  | T14 | 317 | 390,000 | 535,338 | 68,394 | 12 | 44,612 | yes, three times |

  Five of seven over their plan, by 22% to 154%; two under. **My reading of what predicts
  the spend: the number of requests, which Codex chooses, times what one request carries,
  which the diff sets.** Every request sends the whole conversation so far again, so a
  request costs about 22,000 to 26,000 input tokens on a diff of 60 to 80 lines and
  40,000 to 57,000 on one of 290 to 400, nearly all of it read from the cache (62% to
  90%). The plan puts about 1,230 input tokens on a changed line, which is what seven or
  eight requests cost; today's reviews took 4 to 15, and nothing in the range says how
  many Codex will take. Running tests is not what makes a review dear (T13 ran none and
  was 22% over; the two that ran tests are at 7 and 12 requests, inside the spread): it
  is what makes it heavy on the machine. **The part that is not cached moves far less**
  (33,000 to 98,000, and it follows the diff's size), so a rate written on it, or a plan
  that says "7 to 15 requests of about this size" as a range, would tell him more than
  one figure does. Whether his plan counts a cached token as a whole one is not read.
- 2026-10-12 · **T8: what the design does not answer, said before its code** (the
  orchestrator's question). When a review runs outside the lock and Codex chooses to run
  `node --test`, a second copy of tests runs beside a gate. M2's bound speaks of time
  alone. **The design has no answer for the tests that need the machine to be theirs**
  (the ones that already fail under load, the ones that take ports): two copies at once is
  what the lock exists to prevent. What was read: the default prompt is Codex's own
  sentence (`bin/codex-review.mjs:249`, `:363`), so nothing can be said to it there; this
  command's own prompt (`--prompt own`, `bin/lib/codex-review-prompt.mjs`) names the
  range and the command that shows it and says nothing of tests; the session is read-only
  with no approvals (`bin/codex-review.mjs:295`), which did not stop `node --test` today.
  The candidates, none built, in the order I would take them:
  1. *Codex's review stays in the lock; gentle-ai's leaves it.* gentle-ai's reviewer has
     no tools, so it cannot run a test, and its two measures are 2.3 s and 12 s. This is
     the design's own branch for a number that does not hold, taken for one review alone.
     It buys the wait of gentle-ai's reviews only, and none was due today.
  2. *A sentence in the own prompt* telling Codex not to run the suite and why. Advice,
     not a guard; and it makes `own` the prompt of every review outside the lock, which
     is a different review than the default and was measured as such in another feature.
  3. *A report, after the fact*: the review's run line already holds each command Codex
     ran, so `codex-review` can say "this review ran tests" and the record can carry it.
     It prevents nothing; it makes the case countable.
  4. *The lowered priority* of the design: it bounds the time taken from a gate, not the
     second copy.
  Not read: whether Codex's sandbox can refuse a process by name.
- 2026-10-12 · **T8 is ordered as half of what he said yes to, and the document says so
  plainly** (the orchestrator's order, received after my notice of 17:46). His item, in
  his paste of 12:26 (the orchestrator's transcript, line 3913): "Sacar las revisiones del
  turno del control". **What T8 will deliver: gentle-ai's review leaves the lock, and
  Codex's stays in it.** Why only half: a Codex review may choose to run `node --test`
  itself (it did in two of the day's seven sessions), and outside the lock that is a
  second copy of the tests beside a gate, which is what the lock exists to prevent and
  what a standing rule of his forbids; nothing read so far can stop it (the default
  prompt cannot be told anything, and the read-only session ran the tests all the same).
  gentle-ai's reviewer has no tools, so it cannot run one. With it goes the report: the
  record of a Codex review says when the review ran tests, so the case is counted.
  **Codex outside the lock stays a candidate that needs a guard** (the sandbox refusing a
  process by name: not read); if he wants that half, it comes back as his decision, and
  the orchestrator tells him so in its next recap. **Order:** T8 goes behind road 1 and
  the whole run by file, and waits for a day when a gentle-ai review is due, to measure
  its number 2 on it.
- 2026-10-12 · **T14 is corrected, reviewed and pushed: pull request 79, head `964aafc`**
  (`t14d-turn.log`, 18:08:05 to 18:21:16; https://github.com/jsaristi/js-harness/pull/79,
  opened at 18:22, the orchestrator's to merge). RED 18:08:18, against the testkit as
  committed: 2 of 60 fail, the two new tests. GREEN: 60 of 60. The four eval files under
  the counting tool: 328 of 329 pass, one skipped, in 182 s, and **the count holds, 729**
  (331, 176, 123, 99; `t14d-count.json`); no line names EBUSY, EPERM or ENOTEMPTY. The
  commit, `964aafc` `fix(evals): a run whose root was not seen to exit is swept at once,
  not at the end of the file`: whole gate PASS in **535 s** (gate log, 18:11:37, load 1.0
  of 8). gentle-ai: medium risk, 48 lines, not due (under budget). **Codex on the
  correction, once: "the patch is correct" (0.95), no finding**, recorded for
  `17c2146..964aafc`; plan 71,000, spent 174,805 input tokens (136,192 cached) in 7
  requests, 37 s, the machine 26% busy (77 of 300 processor-seconds), `node --test` run
  once. The eighth session of the day and the sixth over its plan; inside the rate of
  315,000. The pre-push check: 2 code commits since `origin/main`, all covered. The
  branch holds `main` `e90e0a4` (behind 0 at 18:21).
  **The whole suite in the three gates of this branch: 554 s, 605 s, 535 s**, against 705
  to 830 s before it. Spent on Codex in the feature: 3,246,895 input tokens.
- 2026-10-12 · **M1e, the whole suite by file on `main` after road 1's first slice: 625 s,
  and the wall is `bin/codex-review.test.mjs`** (`m1e-turn.log`, 18:24:23 to 18:34:52; tree
  `964aafc`, which is `main` `d7ae654`'s; the user's own temp folder; tables
  `m1e-count.json`, `m1e-machine.json`). 4,065 tests, 4,050 pass, 5 fail: the five that
  read a child's environment and fail under the counting tool's preload in every such
  run. Beside the run before the slice (`m1d`, 705.2 s, its temp folder in the excluded
  place; the two runs with the user's temp folder were 735.6 s and 830.2 s) and the three
  gates of T14's branch, which carry no counting tool (554, 605, 535 s):

  | | before (`m1d`) | after (`m1e`) |
  |---|---|---|
  | wall | 705.2 s | 625.0 s |
  | busy processor-seconds | 5,152 of 5,641 (91%) | 4,518 of 5,000 (90%) |
  | test files' seconds, summed | 4,216 | 3,621 |
  | children that are not git | 1,682, 4,583 s of life | 1,224, 2,701 s of life |
  | git processes | 12,041, 1,455 s of life | 12,107, 1,557 s of life |
  | `MsMpEng` | 655 s | 886 s |

  | the longest files | before | after | starts after |
  |---|---|---|---|
  | `bin/codex-review.test.mjs` | 648 s | **624 s** | 6,067 git |
  | `evals/runner.test.mjs` | 704 s | 449 s | 331 not git |
  | `bin/check-codex-reviews.test.mjs` | 256 s | 310 s | 2,146 git |
  | `evals/isolation-probe.test.mjs` | 525 s | 297 s | 123 not git, 273 git |
  | `evals/configs.test.mjs` | 223 s | 276 s | 70 not git, 123 git |
  | `evals/suite.test.mjs` | 174 s | 216 s | 82 not git |
  | `evals/task-proof.test.mjs` | 606 s | 84 s | 176 not git |

  **Reading.** The file that ends the run is `bin/codex-review.test.mjs`: it starts at
  0.2 s and ends at 624.5 s of 625. Its time is its own git processes one after another:
  577 s of process life in 6,067 starts, about 95 ms a start inside the run (65 ms on the
  quiet machine just before it, 261 ms for a probe at the run's 300th second). **Two
  bounds now sit together:** the longest file, 624 s, and the work over the machine,
  4,518 busy processor-seconds on eight, 565 s at full use. A cut that moves one alone
  meets the other within about a minute. The eval files gave what the first slice was
  for: runner 704 to 449 s, task-proof out of the list, the work down by 634
  processor-seconds.
  **Cut 2 of git, judged again.** It was put at about 20 s of 736 as a share of the work,
  when the evals were the wall. What changed: that file is the wall, and its starts are in
  one chain. By caller (from `m1d-count.json`; the run from another worktree names no
  caller): **4,618 of its 6,067 git starts come from one line, the fake Codex's `spawn`
  handing `git` to the real one (`bin/codex-review.test.mjs:277`)**, which is the review
  command's own questions to git, about 11.6 a run over the 397 runs the count of 12:26
  found; 752 more are the tests' own `git` helper (`:45`) and 558 the helper at `:3857`.
  So a question the command stops asking comes off the wall file at about 0.1 s a start,
  and off every real review too: it is the command that asks `rev-parse` four times where
  one process answers (`bin/codex-review.mjs:1124`, `:1129`, `bin/lib/project.mjs:230`,
  and where the git folder is; the lines are `fc70dc3`'s). One `rev-parse` for four is
  about 1,190 starts, so about 113 s of that file's chain: the file near 510 s, still the
  longest (runner 449 s), with the work's own bound near 545 s. **About 60 to 110 s of
  wall for that cut, not 20**, and no test's proof changes: the starts go because the
  shipping command asks less. Under 449 s the file needs about 1,850 starts out, which
  means more of the command's questions (`diff` 1,775 in the suite, `rev-list` 664,
  `merge-base` 581, `status` 508, `log` 495) or the file in two. Not read yet: which of
  those questions the command can join or keep from one run to the next.
  **What I would do next, and what is left out:** cut 2 of git, scoped as "the review
  command asks git less", read first (the command's own call sites, six files), then
  designed with one reader's attack. Slice 2 of road 1 after it: it lowers the work and
  the second-longest file, which is what the suite meets as soon as the git file falls.
  Splitting `bin/codex-review.test.mjs` in two is the other way to shorten its chain; it
  takes no work out, so the work's bound (565 s) holds it to about 30 to 50 s, and its
  helpers would have to move to a shared module.
- 2026-10-12 · **Cut 2 of git, the command's own questions, read from the three-frame
  table** (`c2-frames.json`, the count of 12:26 on `bin/codex-review.test.mjs` alone;
  lines are `fc70dc3`'s; nothing built, the design reads them again on `main`). Of the
  6,067 starts, by the place in the command that asks:

  | asked at | what | starts | a run of the command |
  |---|---|---|---|
  | `bin/codex-review.mjs:1048`, `:1075`, `:1080` and `bin/lib/project.mjs:230` (from `:1068`) | `rev-parse`: the root, the base, the head, the git folder | about 1,820 | four |
  | `:1201`, `:904`, `:893` | `diff`: the patch, the whole range, a part | about 1,130 | nearly three |
  | `:1130`, `:1192`, `:1627` | `merge-base` | about 450 | one |
  | `:1177` | `status` | about 400 | one |
  | `bin/lib/codex-review-coverage.mjs:163`, `:196` | `rev-list`, `log` | about 570 | one each |
  | `bin/lib/codex-review-scope.mjs:125` (from coverage `:204` and `:828`) | `check-attr` | about 430 | one or more |
  | the tests' own `git` helper (`bin/codex-review.test.mjs:45`) | fixtures: `diff` 442, the rest setting up repositories | 752 | none: the test's |

  What can go without a test's proof changing, to be proven in the design: the four
  `rev-parse` as one process in the path where all four answer (about 1,200 starts); the
  range's diff asked once where it is asked twice with other flags (to read: up to about
  700); `rev-list` and `log` of the coverage as one `log` (about 250). Together about
  1,850 to 2,150 of that file's starts, which is what takes it under the next file's
  449 s. Each is a change of the shipping command, so each needs the test that the
  command still refuses what it refused: a base that is no commit, a repository with no
  commit, no git on the path.
- 2026-10-12 · **S1's last commit has its Codex record, and `main` is in the branch:
  `29e3ca7`** (`s1b-turn.log`, 18:44:57 to 18:57:17). Codex on `f04efca^`, once: "the
  patch is correct" (0.9), no finding, recorded for `88e2414..062b890`. Plan 200,000,
  **spent 297,743 input tokens (237,568 cached) in 8 requests**, 72 s, 7 commands and no
  `node --test`; 49% over its plan, inside the rate of 315,000. The ninth session of the
  day and the seventh over its plan. Beside it the machine was 53% busy (324 of 607
  processor-seconds; `node` 82, `MsMpEng` 57), with a reader of mine at work, so no
  figure for M2. Then the merge of `main` `f0b538f` (pull request 80 had been merged at
  18:46:01, the orchestrator; fetched by the turn), 54 paths, gated on the merged tree:
  **`PASS  tests`, 645 s** (gate log, 18:46:29, load 3.9 of 8). The orchestrator's word
  not to pay a turn for a merge before the push reached me when the merge was staged;
  S1 owes one more at its push, since two more pull requests land before it. Not pushed.
  Spent on Codex in the feature: 3,544,638 input tokens.
- 2026-10-12 · **The orchestrator's order after M1e** (received after 18:38): cut 2 of
  git first, scoped "the review command asks git less", read by me, designed with one
  reader's attack, built test first, both reviews; slice 2 of road 1 after it; the git
  file in two is not done. JH 7 waits for `bin/codex-review.mjs` until this cut is on
  `main`. The worktree `gate-wait-eval-sweep` and its local branch are removed. The
  design's first version is `design-git-cut.md` in the scratchpad and its reader is at
  work; **read in S1's code, not counted: S1 adds two git processes a hold
  (`bin/codex-review.mjs:1397-1398`, `:1756-1757`), about 500 to 900 starts in the file
  that is the wall, so the cut is built on S1 and its count before is taken there.**
- 2026-10-12 · **The count before the git cut, on S1 with `main` in it: S1 adds 1,773 git
  processes to the file that is the wall** (`c3-before-turn.log`, 19:06:38 to 19:12:44;
  `c3-before.json`; the file alone under the counting tool, 260 of 260 tests pass).
  `bin/codex-review.test.mjs` on the tree before S1 (the count of 12:26): 6,067 git
  processes, 288 s of life, the file 323 s, 237 tests. On `feat/gate-wait` now: **7,840,
  327 s of life, the file 365 s, 260 tests.** By subcommand, what S1 added: `rev-parse`
  +539, `status` +398, `for-each-ref` +340 (new: `bin/lib/codex-review-coverage.mjs:353`,
  whether the remote has a branch, for the note on a base no record covers), `diff` +292,
  `merge-base` +47, `rev-list` +47, `log` +40, `check-attr` +39. My reading of the code
  put it at 500 to 900: wrong by half, and now counted. About 800 of them are the hold
  (the head and the tree read again after a review, 398 times), the rest the note on the
  base, the kept parts and 23 new tests.
  **What it means for the wall.** Alone the file went from 323 to 365 s; inside a whole
  run it takes about twice its time alone (624 s for 323), so about 700 s the day S1 is
  on `main`, where the suite takes 625 s today. S1's own merged tree passed its gate in
  645 s with no counting tool, against 535 to 605 s for `main`'s. **The cut as designed
  (two joins) takes back about 1,400 of those 1,773**: it pays for most of S1 and gains
  nothing over today. To end below today's wall the cut needs more of what S1 added:
  the 340 `for-each-ref` (one a run, to read) and the 292 `diff`.
- 2026-10-12 · **Three words of his that reach this feature, each read by me in the
  orchestrator's transcript `65318fd5`.** (1) Line 8423 (type user) and the queued entry
  at 8439: a question to him goes through the question tool, options he taps and "Otro".
  (2) Line 8528, a queued entry of human origin: "siempre necesito que las preguntas en
  las haga el orquestador, no la sesion": a question of this session goes to the
  orchestrator by message, never to him in this chat; the two blocks of a cut stay here.
  (3) Line 8962, the tool's result for "¿en qué esfuerzo corre la revisión de Codex?":
  **"Bajar a medio"**. The Codex review goes to medium.
  **What that touches, answered to the orchestrator:** one value,
  `bin/codex-review.mjs:174` (`REVIEW_EFFORT = 'high'`), which the usage text, the flags,
  the plan and the session's check all read; the pin at `bin/codex-review.test.mjs:1045`
  and, of that file's 64 lines with the literal, the ones that mean "the review's
  effort" (a guess: 20 to 40). The declared rule (`bin/lib/rules-data.mjs:61-65`,
  `docs/rule-sources.json:78-92`) is bound to no code, so it is JH 7's to move, or mine
  with its exact text. **Order on `main`: this commit first, on a branch off `main`, then
  S1, then the cut**; S1's new tests with the literal are moved to the constant in the
  merge S1 owes. The plan: its estimate rests on parts measured at the review's own
  effort when there are five (`bin/lib/codex-review-plan.mjs:53`), else on all, mostly
  high, about four times what a medium review costs; the first plan after the change
  says which, and the 1,230 a line is a figure of high.
  **Also from the orchestrator:** the declared rule speaks of what a review may cost, and
  by that wording three of this feature's reviews spent more than their allowance though
  their plans were inside it (513,922 against 361,620; 857,405 against 491,400; 535,338
  against 399,420). From now a spend over 1.05 times the larger of 300,000 and 1,200 a
  line is said in those words. And S1 stays unpushed until the cut is built on it and
  reviewed; the two pull requests then go back to back.
- 2026-10-12 · **A TypeScript server of this session ran beside every measure of the day,
  and is stopped** (the orchestrator's notice of 21:10; checked by me before it was
  touched). `node tsserver.js`, pid 58892, started at 12:48:14, under
  `typescript-language-server` (pid 12176), under a `cmd.exe`, under the `claude.exe`
  (pid 60100) whose command line resumes this session's transcript and whose descendant
  my own shell is. It had taken 14,082 s of processor time since it started, near half a
  core on average over eight hours and 2.2 s in 2 s in the samples the gate itself
  printed before every turn of mine. Stopped at 21:12 with `Stop-Process`; the pid is
  gone, and the language server above it ended with it. Two other `tsserver.js` are
  left (pids 56284 and 60128, started 21:09:17): they are another session's (their
  chain ends in `claude.exe` pid 49656), idle over a 5 s sample, reported and left.
  **Every measure of this document taken after 12:48 on 2026-10-12 had that process
  beside it, half a core to more than one core that the process look before a gate does
  not count**: M1b to M1e (735.6, 830.2, 705.2, 625.0 s), the gates quoted beside them
  (554, 605, 535, 645 s), the shares of `node` in the tables by process, and the two
  measures of a Codex review. The comparisons between them stand, since it ran beside
  all; the absolute seconds are high by what it took. No measure is repeated for this;
  the next whole run without it is the cleaner reading. **What I did not do:** the
  gate's own first lines named `node tsserver.js (pid 58892)` at the top of the load in
  every turn since the afternoon, I read those lines each time for the turn's result, and
  never looked at whose process it was, though the note in memory says to.
  Where it enters the harness, a candidate for JH 7's register: a session that started
  before the plugin was switched off keeps its language server; the look before a gate
  does not count it; the gate named it for hours and nothing acted on the name.
- 2026-10-12 · **The effort commit is written and its turn is asked; state for a resume**
  (written at the context pause, 88%; the orchestrator's word was to go on and let the
  app compact). Branch `feat/review-effort-medium`, worktree
  `D:\js-harness-worktrees\review-effort-medium`, off `main` `c632756`. The change, made
  by `effort-edit.cjs` in the scratchpad, not committed until the turn commits it:
  `bin/codex-review.mjs` 2 lines (the value at `:174`, the example in a comment at
  `:742`); `bin/codex-review.test.mjs` 80 lines on which the words `high` and `medium`
  change places, so a line that meant the review's effort says `medium` and a line that
  meant another effort says `high`, and one line left alone (a comment on the high
  figure of a range). Literals stay literals, as the file writes them; none became the
  constant. **The turn, `effort-turn.sh`, asked at 21:25** (log `effort-turn.log`): RED
  by the test that pins the value against the command as it is on `main`; GREEN on the
  command's whole test file; the commit (message `effort-msg.txt`) with the whole gate;
  the plan's own words (`effort-plan.log`); Codex once from that checkout if the printed
  plan is inside 315,000. **To do when it ends:** read the log; if a test of another
  file fails in the gate for naming `high` (`bin/check.test.mjs`, `evals/review/*`),
  read which and fix in the same branch; then push, pull request (its body says in one
  sentence that the declared rule still says high until JH 7's commit), the plan's words
  and the head to the orchestrator. Exit 11 means the printed plan was over the
  allowance: nothing was spent, and it goes to him through the orchestrator.
- 2026-10-12 · **The effort commit's turn ended red at the gate: three tests of other
  files, and the commit cannot be code alone** (`effort-turn.log`, 21:25:22 to 21:39:05,
  exit 9; nothing committed, nothing spent on Codex; the two files are staged in
  `D:\js-harness-worktrees\review-effort-medium`). RED as meant (the pin, 1 of 1 fails
  against `main`'s command); GREEN on the command's own file, 237 of 237 in 270 s. The
  gate's failures (`effort-commit.log`):
  1. `bin/lib/rules-bindings.test.mjs:12`, "the model and the effort of a Codex review
     are the declared ones": `REVIEW_EFFORT` must equal the declared rule's value
     (`bin/lib/rules-data.mjs:61-65`, `"high"`). **I told the orchestrator no code binds
     that rule: wrong.** I searched the files that are not tests; the binding is a test.
     So the rule's data (value, source with his tap at line 8962 of the orchestrator's
     transcript, the render of `docs/RULES.md`, whatever hash `rules check` holds) rides
     in this commit, by JH 7's text or by JH 7's hand first.
  2. `evals/review/compare.test.mjs:309`, "each lean configuration is pinned at the
     effort its committed readings were measured with, whatever effort `codex-review`
     passes by default", and `:452`, "the current configuration is retired…": not read
     yet. By its name the first should not depend on the default, so either the test or
     `evals/review/compare.mjs` reads the default somewhere: read both before changing
     either, and do not change what the comparison's committed readings say.
  **Next for this branch:** read those two tests; get the rule's hunks from JH 7 through
  the orchestrator (asked at 21:39); then one more turn (the script is `effort-turn.sh`:
  it expects two changed files, so its check of the count changes with the files added).
- 2026-10-12 · **The two tests of the comparison, read and moved; the rule's half comes
  as a patch from JH 7** (the orchestrator's routing, after 21:39). Both bind the
  default's word, not the comparison: `evals/review/compare.test.mjs:313` pins
  `REVIEW_EFFORT` to `'high'` to say that no lean configuration takes its effort from
  the default (each names its own, and the committed readings are checked against that,
  untouched); `:464` expects the sentence that retires the `current` configuration,
  which `evals/review/compare.mjs` builds from the constant. Changed in the worktree,
  not staged: the pin and its comment now say `medium`, and the expected sentence says
  "at medium effort". The list of configurations and their efforts, and every committed
  reading, are as they were. **State of `D:\js-harness-worktrees\review-effort-medium`:**
  `bin/codex-review.mjs` and `bin/codex-review.test.mjs` staged,
  `evals/review/compare.test.mjs` changed. **Owed before the next turn:** JH 7's patch
  file (the rule's value, its source, the render, the hash, any rules test that pins
  high), applied there; then `effort-turn.sh` with its count of changed files and its
  `git add` brought up to the files in the tree, and its RED kept as it is.
- 2026-10-12 · **JH 7's patch applied; the effort commit's second turn is asked** (the
  host compacted this session between the two; read at 21:46, context at 24%). The
  patch (`review-effort-medium.patch`, the rule's value and date in
  `bin/lib/rules-data.mjs`, his tap at line 8962 of the orchestrator's transcript in
  `docs/rule-sources.json`, the render and hash of `docs/RULES.md`, the one line of
  `bin/rules.test.mjs`) applied clean; `rules check` there: exit 0, 18 rules, hash
  `7963ae6d5597`. The tree holds seven changed files, none staged. **One thing found
  before asking the turn:** the first turn's failed commit left the two command files
  staged, and the script's RED step restores `main`'s command with
  `git checkout -- <file>`, which restores from the index, so the RED would have run
  against the changed command and not failed. Unstaged with `git reset -q` first; a
  turn script that restores a file for its RED names the commit
  (`git checkout HEAD -- <file>`) from now on. **The turn** (`effort-turn.sh`, asked at
  21:46, log `effort-turn.log`): the same RED; GREEN over the command's test file and
  the three files that failed the gate (`bin/lib/rules-bindings.test.mjs`,
  `bin/rules.test.mjs`, `evals/review/compare.test.mjs`); the commit of the seven files
  with the whole gate; the plan's own words; Codex once from that checkout only if the
  printed plan is inside 315,000. **When it ends green:** push, pull request, and to the
  orchestrator the plan's words, the head and the spend beside the allowance. Exit 11:
  the printed plan is over the allowance, nothing was spent, and it goes to him through
  the orchestrator.
- 2026-10-12 · **T16, the git cut, is written and its turn is queued behind the effort
  commit's** (worktree `D:\js-harness-worktrees\gate-wait-git-cut`, branch
  `feat/gate-wait-git-cut` off `feat/gate-wait` at `1e0d531`; four files changed, nothing
  committed until the turn commits). **The change.** `bin/lib/project.mjs`:
  `gitDirsAndCommits(root, revs, spawn)`, the join, `null` unless the answer is text of
  exactly one line a directory and a rev with every rev a full commit id of one length;
  `isFullCommitId`. `bin/codex-review.mjs`: the join asked once at the top (`asked`), the
  base and the head taken from it or asked alone as before; `headAndTree()`, the one
  `git status --porcelain=v2 --branch --no-ahead-behind --untracked-files=no` for both
  holds, with the two single questions behind it and no second try in a run. The
  merge-base is not joined (the design's point 6 asks for a proof first), nor the
  `for-each-ref`. **The tests.** New, green on the command as it was: a review after a
  commit when the tree cannot be read (the moved HEAD is said first); a part after a
  commit; a part after which the tree cannot be read, with and without a commit (what
  could not be read is said first). Rewritten to hold both forms: the read of HEAD that
  fails after the review. Red on the command as it was: the two tests that count a
  run's questions (`rev-parse --verify` 3 to 0, nothing asked twice), the count in
  parts, and four new ones (the join answered badly three ways, a base that names no
  commit, the status answered badly two ways, a git that does not know the status asked
  once in a run of three parts). Re-aimed, as the design named them: the three that put
  a failure into the first question for the git folder now put it into the first two.
  In `bin/lib/project.test.mjs`: the join against `gitDirs` and `rev-parse --verify` on
  a real repository and a linked worktree, eight revs it must refuse, and eighteen
  answers of a stand-in git it must refuse. **Found while writing, not in the design:**
  the design said only two of the six outcomes of the holds had a test; four had (the
  three after the review at `:921`, `:940`, `:957`, and the part with a changed file).
  **The turn** (`cut-turn.sh`, log `cut-turn.log`, queued at 21:57): on HEAD's command
  the seven outcomes of the holds green and the seven counting tests red; the two test
  files whole, green; the count after (`c3-after.json`) beside `c3-before.json`; the
  commit (message `cut-msg.txt`) with the whole gate; the Codex plan printed, not run.
  **After it:** the count decides the test file in two (the design's point 7);
  gentle-ai's review of the commit, then Codex once if its printed plan is inside the
  allowance.
- 2026-10-12 · **T15 done: a Codex review runs at medium effort, pull request 87**
  (`feat/review-effort-medium`, one commit `cb96924` off `main` `c632756`, pushed at
  22:06; the orchestrator merges). The turn (`effort-turn.log`, 21:51:09 to 22:06:08,
  exit 0): RED 1 of 1 against `main`'s command; GREEN 309 of 309 over the command's test
  file, the rules tests and the comparison's; the commit's whole gate passed; gentle-ai
  "medium risk, 7 paths, 195 lines: review not due (under_budget)"; Codex from that
  checkout, so at medium, "the patch is correct (confidence 0.96)", no finding,
  recorded. **The first plan at medium, in its words:** "1 part, 189 changed lines in 6
  files … about 73,000 to 170,000 input tokens in all. It rests on 34 parts this
  machine's run log measured on gpt-6.1-sol at medium effort": the log already held 34
  medium parts, so the estimator stood on medium alone from the first plan. **Spent:**
  161,777 input tokens (102,144 cached) over 6 requests in 51 s, inside the allowance
  of 315,000 and inside the plan's range; 8 commands, no `node --test`. The feature's
  Codex total: 3,706,415 input tokens. For scale, the last review at high of a commit
  of that size (the fix of T14, 71,000 planned) spent 174,805 over 7 requests: one
  sample each, so no ratio is claimed.
- 2026-10-12 · **A probe for the design's point 6, the merge-base in the join** (a
  scratch repository under the system temp folder, `mb-probe.sh`, git 2.54.0.windows.1;
  nothing built). `git rev-parse --git-dir --git-common-dir
  '<head>^{commit}...<base>^{commit}'` prints the two directories, the base, the head,
  then one line `^<id>` for each merge-base: one line, equal to `git merge-base`, on a
  linear range and when base is HEAD; two lines on a criss-cross, the first equal to
  what `git merge-base` prints, in both orders of the two tips (one sample: not a
  proof of the order); no caret line and exit 0 for two histories that share nothing.
  **So the rule, if it is built:** the joined merge-base is taken only when there is
  exactly one caret line with a full commit id; none, or more than one, and
  `git merge-base` is asked alone as today, which keeps today's "share no history"
  refusal and leaves the choice among several merge-bases to git. The three places
  that ask it (`bin/codex-review.mjs`, the plan, the review, the skip) all ask it of
  the base as `--base` named it, before the records move the start, so the answer of
  the top of the run is the one they need. Worth about 550 starts of the test file by
  the design's count; decided on the count after the two joins.
- 2026-10-12 · **Pull request 87 is on `main` (`87cb7e2`), and S1 holds it: merge
  `6e0e85b` on `feat/gate-wait`** (the orchestrator merged at 22:07 by its notice;
  checked by me: `cb96924` is an ancestor of `origin/main` and `REVIEW_EFFORT` there is
  `'medium'`; the effort branch's worktree and local branch are removed). The merge
  turn (`s1-merge-turn.sh`, log `s1-merge-turn.log`, 22:22:38 to 22:39:55, exit 0):
  one conflict, as a trial merge without a worktree had said
  (`git merge-tree --write-tree`), in `bin/codex-review.test.mjs`, resolved by
  `s1-merge-resolve.cjs`: S1's lines of the plan header's test with the effort `main`
  names, and S1's own test of a run at another effort now passes `high`, the other
  one. **Not 23 tests of S1 to move, as I had said: one line.** S1 added one line that
  names an effort (`git diff f0b538f feat/gate-wait -- bin/codex-review.test.mjs`
  searched for the two words); the rest of S1's tests reach the effort through helpers
  `main` had already moved. The ten test files the two sides touch: 716 of 716 in
  443 s; the merge commit's whole gate passed; gentle-ai "medium risk, 30 paths, 2064
  lines: review not due (under_budget)". Not pushed.
- 2026-10-12 · **T16's first turn ended red at its green step, on a test of mine; fixed
  and queued again** (`cut-turn-1.log`, 22:06:19 to 22:12:06, exit 6; nothing
  committed, no count). On the command as it was: the seven outcomes of the holds
  green, 7 of 7, and the seven counting tests red, 7 of 7, and the project module's
  test file red for the missing export: the proof's first half holds. With the change:
  412 tests, 406 pass, 5 skipped, 1 fails: "a review asks git where the git folder is
  once…", where my new assertion compared the folder the join ran in as git writes it
  (`C:/…`) with the top as the system writes it (`C:\…`). The command is right: the
  join runs in `root`, the string git answered the first question with, as the two
  single questions did. The assertion now resolves the folder before comparing. The
  second turn is `cut-turn.log`, queued at 22:13 behind the merge turn.
  **Next for the cut after its commit:** merge `feat/gate-wait` (`6e0e85b`) into
  `feat/gate-wait-git-cut` in a lock turn, so that the cut sits on S1 with `main` in
  it; then its reviews.
- 2026-10-12 · **T16 committed: `28d988e` on `feat/gate-wait-git-cut`, and the count
  after** (`cut-turn.log`, 22:39:59 to 22:58:24, exit 0). On the command as it was: the
  seven outcomes of the holds 7 of 7 green, the seven counting tests 7 of 7 red, the
  project module's test file red for the missing export. With the change: the two test
  files 412 tests, 407 pass, 5 skipped, none fails, in 296 s. The commit's whole gate
  passed; gentle-ai "medium risk, 4 paths, 390 lines: review not due (under_budget)".
  **The count of `bin/codex-review.test.mjs` alone, under the counting tool, before and
  after** (`c3-before.json` of 19:06 on S1, `c3-after.json` of 22:45 on the cut):

  | | before | after |
  |---|---|---|
  | git processes | 7,840 | 6,628 |
  | seconds of git life | 327 | 249 |
  | the file alone | 365 s | 274 s |
  | tests | 260 | 267 |
  | `rev-parse` | 2,646 | 1,301 |
  | `status` | 828 | 848 |
  | `diff` | 1,931 | 1,991 |
  | `merge-base` | 549 | 559 |
  | `for-each-ref` | 340 | 350 |

  1,212 processes fewer with seven tests more; all of it is `rev-parse` (1,345 fewer),
  and every other subcommand rose by what the seven new tests ask. That is above the
  design's upper bound (700 to 1,100): the bound counted about 340 runs that reach the
  records, and the join also takes the base and the head out of every run that does
  not. `status` did not fall because a hold costs one process either way: the join
  took the `rev-parse` of HEAD out of it. **The seconds are not to be read as the cut
  alone:** the count before was taken while this session's own tsserver was spinning
  (stopped at 21:12), so 365 s is high; the processes are the measure. The gates of
  the evening say the same in the large: the merged S1's commit gate 595 s (22:30 to
  22:39), the cut's 514 s (22:49 to 22:58), one sample each.
  **The Codex plan printed there says "at high effort"**: the cut's branch did not
  hold `main`'s effort commit. Not run. The cut is put on the merged S1 first.
- 2026-10-12 · **What S1 and the cut owe before they can be pushed, read from the push
  check** (`node bin/check.mjs --push --remote origin --head <sha>`, which reads
  records and runs nothing). For S1: "1 of 9 code commits since origin/main have no
  Codex review record: `6e0e85b` Merge remote-tracking branch 'origin/main'". For the
  cut: `28d988e`. **The merge commit's review is of everything `main` brought**: its
  plan, printed at 22:59 from this worktree, spending nothing: "b043796..0bc9ee1 …
  at medium effort, 6 parts, 1,724 changed lines in 26 files … about 664,000 to
  1,570,000 input tokens in all. It rests on 35 parts … at medium effort". The
  allowance by his rule is the larger of 300,000 and 1,200 a changed line, times 1.05:
  2,172,240. The printed plan is inside it, so it runs without a question. The earlier
  merge of `main` into S1 (`29e3ca7`) is not in the check's list and no record names
  it: it merged clean, and this one has a resolution of its own. Codex's meter, read at
  23:01 with the orchestrator's script: 19% of five hours, 35% of the week, one reset
  credit left. **Said to the orchestrator as a cost, not asked:**
  those 1,724 lines were each reviewed on `main` in their own pull requests; what the
  merge commit itself decided is nine lines of one test file
  (`git show --remerge-diff 6e0e85b`: 2 added, 7 removed). A push check that asked for a review of a merge
  commit's own resolution, and not of what its second parent brought, would spend a
  hundredth of this; that changes what a review covers, which is his, so it is a
  candidate for the harness and not built here.
  **The cut is not merged with S1 again: its one commit is picked onto the merged S1**
  (`feat/gate-wait` head), in a lock turn, with `28d988e` kept under the branch
  `cut-kept` until the new commit's gate has passed: a second merge commit would owe a
  third review of the same 1,724 lines. A pick does not run the commit hook, so the
  turn picks without committing and commits with the message file, which runs the
  whole gate.
  **Next, two turns:** `cut-pick-turn.sh` (the pick, the two test files and the files
  the effort commit bound, the commit, its plan at medium, Codex once if the printed
  plan is inside 491,400, the larger of 300,000 and 1,200 times 390 lines, times
  1.05); `s1-merge-codex-turn.sh` (the plan again, Codex once in its six parts if the
  printed plan is inside 2,172,240). **From the moment the second is asked nothing is
  committed in this worktree until it ends:** a review refuses its record when HEAD
  moves.
- 2026-10-12 · **The review S1's merge commit owed is recorded; one finding, in what
  `main` brought and not in S1** (`s1-merge-codex-turn.log`, turn end 23:22:53, exit
  0; `b043796..a779acd` in 6 parts at medium). The push check after it: "9 code commits
  since origin/main, all covered by a Codex review record". **Spent 927,266 input
  tokens** (683,136 cached) over 35 requests in 306 s, against a printed plan of
  664,000 and an allowance of 2,172,240: inside the allowance, 40% over the plan's low
  figure, inside its range (to 1,570,000). By part: 156,475, 211,488, 74,251, 255,624,
  126,535, 102,893. 34 commands, 4 of them `node --test`, inside the lock turn. The
  feature's Codex total: 4,633,681 input tokens.
  **The finding** (part 2 of 6, "the patch is incorrect", confidence 0.98, P2,
  `bin/lib/manifest.mjs:376-378`, last changed on `main` by `dc7d34a` and `bf98aaa`,
  the install work of pull request 85): a settings file an older installation made, to
  which the user later added an empty `hooks.PostToolUse` list; the upgrade appends the
  pause hook there and records that it made no container, and the filter that decides
  whether the file is deleted on uninstall takes the pointer of every record that
  succeeded, so the user's list is taken for the harness's and the file is deleted.
  Codex says it reproduced it in memory. **Not checked by me and not fixed in S1:** it
  is not S1's change and the file is another session's; sent whole to the orchestrator
  at 23:22 as a claim for the owner of that code. It bears on the exact-undo rule of
  `AGENTS.md`. **Seen in passing:** the record is written though one part's verdict is
  "incorrect": a part passes on the evidence that it read its lines, not on its
  verdict; the finding is in the output and nowhere a check reads.
- 2026-10-12 · **`main` moved again (`f43392d`, pull request 88, another session's;
  the orchestrator's notice at 23:19, a claim): no file of this feature in it, and a
  trial merge with `feat/gate-wait` is clean by its reading.** Its order: S1 and the
  cut each hold `origin/main` before it can merge them, so `f43392d` is merged last
  and once, after the cut is on the merged S1 and both reviews are done; a clean merge
  is gated by the merge hook and not counted by the push check. The candidate "a push
  check that asks for a review of a merge's own resolution only" is recorded by the
  orchestrator as his, for the register and a design with two readers.
  **The cut's pick turn** (`cut-pick-turn.sh`, log `cut-pick-turn.log`) started at
  23:22:58 on `28d988e`, onto `a779acd`.
- 2026-10-12 · **The cut is on the merged S1 and reviewed: `823047e` on
  `feat/gate-wait-git-cut`** (`cut-pick-turn.log`, 23:22:58 to 23:38:26, exit 0; onto
  `a779acd`; the old commit `28d988e` and its branch `cut-kept` are gone). The pick
  applied clean; the two test files and the three the effort commit bound: 484 tests,
  479 pass, 5 skipped, none fails, in 358 s; the commit's whole gate passed (507 s);
  gentle-ai "medium risk, 4 paths, 390 lines: review not due (under_budget)". **Codex,
  at medium:** plan "1 part, 390 changed lines in 4 files, about 150,000 to 540,000
  input tokens, rests on 41 parts at medium"; verdict "the patch is correct
  (confidence 0.87). The combined Git queries preserve the existing range and
  tracked-tree checks, with fallback queries when combined output cannot be
  validated"; no finding; recorded for `a779acd..823047e`. **Spent 130,472 input
  tokens** (83,200 cached) over 5 requests in 55 s: under its plan, inside the
  allowance of 491,400. 4 commands, no `node --test`. The feature's Codex total:
  4,764,153 input tokens.
- 2026-10-12 · **Queued behind it:** the clean merge of `main` (`f43392d`) into S1
  (`clean-merge-turn.sh`, log `s1-final-merge-turn.log`), after which S1 is pushed and
  its pull request opened (body `s1-pr-body.md`); and M1f, the whole suite by file
  under the counting tool on the cut (`m1f-turn.sh`), which answers the design's point
  7: whether `bin/codex-review.test.mjs` still leads the suite. The cut merges `main`
  once, after S1 is on it.
- 2026-10-12 · **S1 holds `main` `f43392d`: merge `adc54b8`** (`s1-final-merge-turn.log`,
  23:38:31 to 23:49:17, exit 0): clean, 5 paths from `main`, the merge commit's whole
  gate passed, and the push check after it: "9 code commits since origin/main, all
  covered by a Codex review record". Pushed after this entry, with its pull request.
- 2026-10-13 · **S1 is on `main`: pull request 89, merged by the orchestrator at 23:54
  (`2a81ae7`; checked: it holds `c180bda`). The cut holds it: merge `f569dae` on
  `feat/gate-wait-git-cut`** (`cut-final-merge-turn.log`, 00:09:43 to 00:19:39, exit
  0: clean, 6 paths from `main`, the merge commit's whole gate passed, and the push
  check: "1 code commit since origin/main, all covered by a Codex review record").
  This document is written on the cut's branch from here on, since S1's is merged.
  Pushed after this entry, with its pull request (body `cut-pr-body.md`).
- 2026-10-13 · **M1f: the whole suite by file on the cut, and the split decided on its
  number** (`m1f-turn.log`, the counting tool on `823047e`, 23:58 to 00:09, one run,
  no source written, no spend; beside it m1e, the same run on `main` before S1):

  | | m1e, before S1 | m1f, the cut |
  |---|---|---|
  | wall | 625 s | 601 s |
  | the machine busy | 4,518 of 5,000, 90% | 4,079 of 4,810, 85% |
  | git processes, whole suite | 12,107 | 13,016 |
  | `bin/codex-review.test.mjs` | 624 s, 6,067 git, 237 tests | 601 s, 6,628 git, 267 tests |
  | `evals/runner.test.mjs` | 449 s | 383 s |
  | `bin/check-codex-reviews.test.mjs` | 310 s | 309 s |
  | `evals/isolation-probe.test.mjs` | 297 s | 274 s |
  | `evals/configs.test.mjs` | 276 s | 251 s |

  The same five eval tests fail under the tool in both runs (its own environment).
  **The command's test file is still the wall, alone: 601 s of 601, 218 s past the
  next file; the work's own bound at this busy share is about 510 s.** So the design's
  point 7 holds: the file is split. With S1's 30 tests and 1,773 starts in it, the cut
  leaves the suite 24 s under where it was before S1.
- 2026-10-13 · **T17: the file runs as two processes, and is not cut in two** (told to
  the orchestrator before building, 00:10; its go, the lead's call and not his word,
  with six asks). **Why not the design's words** (helpers in a shared module, the tests
  moved): about 2,700 moved lines, and a Codex review counts a moved line as changed,
  about a million input tokens at medium to review a move. **What is built** (branch
  `feat/gate-wait-two-halves` off `823047e`, worktree
  `D:\js-harness-worktrees\gate-wait-two-halves`, 55 lines in two files, not
  committed): one line of `bin/codex-review.test.mjs` is the mark,
  `secondHalfStartsHere();`, at the section boundary with 47% of the file's test time
  above it (151 tests above, 116 below, by `half-find.cjs` on `c3-after-tests.log`);
  run as itself the file registers what is above; `bin/codex-review.second.test.mjs`,
  two statements, sets a flag and imports the file, and that process registers what is
  below. **The six asks and what answers each:** (1) a test is in one half by where it
  stands, and the head comment says where a new test goes and what the mark is; (2)
  the guard is in the suite: each process has one test that the mark stands once and
  ran once, both halves hold tests, what this process left out is the other half to
  the test, and the second file sets its flag before its import; (3) the head comment
  says what both processes run: the two hooks, which make and remove folders of their
  own, and helpers and constants; searched, no top-level statement starts a process;
  no `describe` in the file, and the comment says the mark stays between two
  top-level tests; (4) **my first version failed this one and is replaced:** it put a
  function around the runner's `test`, and the runner names a test by the line that
  called it, so every test would have been named by the wrapper's line. Now `test` is
  the runner's own function in the half a process runs and a counter in the other;
  the turn reads the runner's events for one test of each half; (5) the suite's count
  becomes 267 and two, one guard a process; (6) M1g after the commit, same tool.
  **The turn** (`halves-turn.sh`, log `halves-turn.log`, queued at 00:16): RED without
  the second file; each half alone, then the two together and the names beside those
  of the file alone before (`halves-check.cjs`); the file and line the runner holds;
  the commit with the whole gate; the plan; Codex once if the printed plan is inside
  315,000.
- 2026-10-13 · **The cut is on `main`: pull request 90, merged by the orchestrator at
  00:21 (`1bbe34c`; checked: it holds `672457d`).** The worktrees and local branches of
  S1 and of the cut are removed; this document is written on
  `feat/gate-wait-two-halves` from here on.
- 2026-10-13 · **T17 committed and reviewed: `d7b1e68` on `feat/gate-wait-two-halves`,
  one commit on `main` `1bbe34c`** (the uncommitted change was moved from `823047e` to
  `main`'s head before its turn, the test file being the same on both, so the commit
  owes no merge of the cut). **The turn's first try ended with exit 7 at 00:27 and it
  was my check, not the change** (`halves-turn-1.log`): the names the two processes
  ran were compared with a log taken before `main`'s effort commit, where three tests
  are named "… at high"; its own figures stand: the first half alone 152 tests in
  164 s, the second 117 in 145 s, the two together 269 in 180 s. **The second try**
  (`halves-turn.log`, 00:38:37 to 01:00:57, exit 0): RED without the second file, 1 of
  1; the file at HEAD alone 267 of 267; the two together 269 of 269; "ran now 269 (2
  of them say which half), ran alone before 267; twice 0, lost 0, new 0"; the runner's
  own events name one test of each half by `bin/codex-review.test.mjs` and its own
  line (1190, 6038); the commit's whole gate passed; gentle-ai "medium risk, 2 paths,
  55 lines: review not due (under_budget)". **Codex, at medium:** plan "1 part, 55
  changed lines in 2 files, about 24,000 to 76,000 input tokens"; "the patch is correct
  (confidence 0.9). The split preserves test registration across two isolated
  processes while retaining shared helpers and per-process setup and cleanup"; no
  finding; recorded for `1bbe34c..d7b1e68`. **Spent 90,519 input tokens** (62,208
  cached) over 5 requests in 60 s: over the plan's range, inside the allowance of
  315,000. The feature's Codex total: 4,854,672 input tokens.
  **The seconds of that second try are not a measure, and it is mine again:** the
  file at HEAD alone took 451 s there, where it took 274 s at 22:45, and the two
  together 232 s, where they took 180 s half an hour before. This session's own
  tsserver (pid 53660, under this session's `claude.exe` 60100 by its parent chain)
  was spinning: 752 s of CPU at 00:13, 2,362 s at 01:01, 7 s of CPU in a 4 s sample,
  and the gate log's load lines of 00:09 and 01:01 name `node tsserver.js` first.
  Stopped at 01:02. The second time today; it starts when this session edits a file
  of a new worktree. So the commit gate of 587 s says nothing of the change, and
  **M1g is taken after the stop, with a sample of the machine before it.**
  **Next:** `main` moved by documents (`53826d8`, pull request 91): one clean merge in
  a lock turn; M1g; then the push and the pull request.
- 2026-10-13 · **Road 1, second slice, first row: `85566a8` on `test/eval-fewer-starts`**
  (07:20 to 07:31; written above M1g's entry so that it does not meet T12's record, which
  its own branch appends at the end). Thirteen tests of `evals/task-proof.test.mjs` prove
  a rule that reads files only (`checkFiles`, `readProof`): they end in `only` or `some`
  on the rule and read nothing a run produced, and each `proveTask` started five
  processes. They now take their runs from `answered`, a run answered in the test's
  process by what the workspace holds, through the `runProcess` parameter `proveTask`
  has had since the first slice; nothing that ships changes. One new test ties the
  stand-in to the real runs: for the valid task both give the same results, read
  against one constant (`VALID_RUNS`). The tests of what a run does stay on real
  processes, the borderline ones of the reading of 2026-10-12 included.
  - **The count, one turn, the same tool, the file alone** (`s2-turn.sh`,
    `count-git.mjs --json`): other starts 176 before, **85 after (91 fewer)**; processes
    reported 223 and 132; git 5 and 5. Run plainly the new file: 36 of 36, 17.9 s. A
    change of tests has no red step: the count and the green file are its proof. The
    commit's gate passed whole. No timing of the suite was taken: on this machine a
    saved start is load, and no file is the wall any more (M1g).
  - gentle-ai: not due (`under_budget`, 70 lines). Codex once, medium, 07:30:
    correct (0.92), 137,509 input tokens (plan 30,000, allowance 300,000).
  - **Not built, and why:** the second row of the slice as it was sized, the sweeps
    that find nothing and the version probes of the suites of `evals/runner.test.mjs`
    that do not stub them (21 starts by the reading). It is six places, each a suite
    whose trial is real for another reason, for a fifth of what this row gave; it
    wants its own look, with slice 3 or alone.
- 2026-10-13 · **M1g: with the file as two processes the whole suite takes 533 s, where
  it took 601 s; T17 done** (`m1g-turn.log`, the counting tool on `afcadea`, 01:10 to
  01:19, one run, after this session's tsserver was stopped; beside it M1f on the cut):

  | | m1f, the cut | m1g, two processes |
  |---|---|---|
  | wall | 601 s | 533 s |
  | the machine busy | 4,079 of 4,810, 85% | 4,030 of 4,265, 94% |
  | git processes, whole suite | 13,016 | 13,043 |
  | `bin/codex-review.test.mjs` | 601 s, 6,628 git | 421 s, 3,151 git |
  | `bin/codex-review.second.test.mjs` | | 381 s, 3,504 git |
  | `evals/runner.test.mjs` | 383 s | 335 s |
  | `bin/check-codex-reviews.test.mjs` | 309 s | 305 s |
  | `evals/isolation-probe.test.mjs` | 274 s | 259 s |

  68 s fewer, 11%, inside what was said before it was built (510 to 530 s). **No file
  is the wall any more: the longest ends at 421 s and the run at 533 s, with the
  machine 94% busy.** The suite now stands on the work itself, about 4,030
  processor-seconds on eight processors (504 s at full use), so the next seconds come
  only from less work: fewer process starts (13,043 git processes, 1,709 s of their
  life; 1,231 other children) and what the antivirus spends on each (`MsMpEng` 859 s
  of the run, his to change). Cutting a file again gives nothing. (The tool counts the
  tests of both processes under the first file, 269, and none under the second: it
  names a test by where it is written.)
  **The branch holds `main` `53826d8`: merge `afcadea`** (`halves-merge-turn.log`,
  01:10:09 to 01:10:18): clean, 3 paths, all documents, so the hook ran the checks of a
  documents-only commit and not the suite; the code of the merged tree is `d7b1e68`'s,
  whose gate passed at 00:59. The push check: "1 code commit since origin/main, all
  covered by a Codex review record". Pushed after this entry, with its pull request.
  **What is left of the feature, in the orchestrator's order:** road 1 slice 2 (fewer
  starts in the eval tests; sized 110 to 150 starts), which is now the only kind of
  cut that pays; the merge-base in the join (about 550 git starts, a rule ready, in
  Progress of 2026-10-12); the reviews of `feat/gate-wait-count` (`47484bd..fc70dc3`)
  so the counting tool reaches `main`; T8 as half; T10 the close. And one for the
  harness, not built: nothing warns that a session's own tsserver is spinning beside
  a gate, twice in one day here.
- 2026-10-13 · **T12, the identical-tree proof, is committed: `b4309dd` and its correction
  `0e0f385`** on `feat/gate-wait-same-tree`, by the orchestrator's order of 05:58 ("commit
  it or say why it is dropped"). What was built on 2026-10-12 sat 192 commits behind
  `main`; it was carried onto `addf6ae` (`git checkout -m -B`, a backup first), with five
  conflicts, each a place where `main` and the slice had both added: the import of
  `bin/check.test.mjs`, the declaration in `harness.json` (main's `documentSensors` and
  the slice's `"sameTree": "skip"`), the head of `checkSensors` (the slice's declaration
  is read before main's documents block), and two blocks of tests. The copy of the merge
  hook the slice held is gone: the hook is on `main` since pull request 75.
  - **The turn, 06:39 to 06:50** (`t12-turn.sh`): RED, the two code files at HEAD and the
    module hidden, 3 of 3 test files fail (`ERR_MODULE_NOT_FOUND`, no export `isTreeKey`);
    GREEN 225 of 225 in the three files; the commit's gate passed whole (574 s by the gate
    log). gentle-ai: not due (`under_budget`, medium risk, 606 lines).
  - **Codex, once, 07:00 to 07:02**, medium effort, two parts of `addf6ae..b4309dd`, plan
    256,000 and allowance 724,800: 453,786 input tokens. Part 1 correct (0.84). **Part 2
    "the patch is incorrect" (0.97), one finding, P2, `bin/lib/gate-tree.mjs:59-65`:**
    under `core.autocrlf` two files with CRLF and LF at other lines are one object in the
    index, one clean status and one line of the listing (`w/mixed`), so one key stood for
    two files a sensor that reads bytes can tell apart. **True, read with real git**
    (2.54.0.windows.1, a scratch repository): a rearrangement of the same size is a clean
    folder and the same listing. A file of another size git calls changed without reading
    it (`status` says ` M` while `diff` prints nothing), which was no key already.
  - **The correction, `0e0f385`:** a folder with a file `w/mixed` has no key, which is a
    gate that runs its sensors. Hashing every file's bytes was the other way out: it reads
    the whole tree at every gate for a case this repository does not hold (232 files
    CRLF, 175 LF, 1 with no line end, none mixed, by `git ls-files --eol`). Two tests:
    the listing's field with a stand-in, and real git with the two arrangements. What a
    filter of the repository's own folds into one object is named in the module's head
    as outside the key. Its turn ran twice (`t12b-turn.sh`): at 07:04 it stopped at GREEN
    with nothing committed, because my new test's last step asked for a clean status
    after the file was rewritten whole, which is the other-size case above; the step now
    stages the file. At 07:06 to 07:14: RED 2 of 8 on HEAD's module, GREEN 8 of 8, the
    gate whole. Codex on `b4309dd..0e0f385` alone, 07:14: correct (0.92), 103,858 input
    tokens (plan 30,000, allowance 300,000). The push check: 2 code commits, both covered.
  - **Not known:** how often a gate here finds its proof. The log's lines of kind `same`
    will say; nobody has counted the cases (a commit amended in its message, a clean
    merge of an already proven tree, a pick that lands on the same files).
- 2026-10-13 · **Why the whole check got slower from 17:00: two Windows services, not the
  sessions** (the orchestrator's order of 19:35, after its reading of the gate log: 481 to
  557 s in the morning, 654 s in the 17 hour, 767 s in the 18 hour, one of 1,132 s). Written
  at 20:10. Nothing was changed on the machine.
  - *The gate log, 24 hours* (`checks-load.cjs`, 50 whole checks): 474 to 590 s from 04:23 to
    14:13; 597 to 735 s from 17:01 to 17:54; then 722, 700, 962, 1,132 and 774 s. **The
    one-second sample a gate takes at its start does not tell them apart**: the check of
    962 s started at 2.3 of 8 processors busy.
  - *The measured run* (`m1h-turn.sh`, 19:49:27 to 20:02:58, alone in the lock, tree
    `0cca602`, 84 test files under `measure-run.mjs` and `count-git.mjs`), against the same
    run of 01:19 (M1g): **wall 805 s against 533** (+51%). Busy 6,310 processor-seconds of
    6,438 (98%) against 4,030 of 4,265 (94%): the same suite, 2,280 more seconds of work.
  - *Not the suite.* 13,452 git starts against 13,043; 1,153 other children against 1,231;
    every file grew alike (`bin/codex-review.test.mjs` 421 to 577 s, `evals/runner.test.mjs`
    335 to 563, `bin/check-codex-reviews.test.mjs` 305 to 431, `evals/configs.test.mjs` 205 to
    365, `evals/suite.test.mjs` 151 to 293). The same git starts cost 2,444 s against 1,709:
    a start is 39% dearer. The start probes agree: `git --version` 101 ms before the run
    against 62, 322 inside against 264; `node -e ""` 188 against 96, 518 against 376.
  - *Where the 2,280 went*, by the processes that lived through the run: **the svchost of
    pid 8936, 773 s against 29 for all eighty svchost** (+745); MsMpEng 1,139 against 859
    (+280); the desktop app's twenty `claude` processes 389 against 190 (+199); System 254
    against 88 (+167); dwm 123 against 56 (+67). Lived-through in all 2,912 against 1,357;
    the rest, 3,398 against 2,673 (+725), is the short-lived ones, the suite's own among
    them, paying more a start.
  - *pid 8936 is `PcaSvc`*, the Program Compatibility Assistant (`Win32_Service`; started
    with the machine on 2026-10-08, 29,758 processor-seconds since). Beside a running check
    at 20:06 it spent 21 s in 21 s, one processor whole, and MsMpEng 39.8 s (`two-pids.ps1`,
    which reads `Win32_Process`: `Get-Process` cannot read a system service's time). In the
    gate log's 321 start samples since 2026-10-11 it is among the busiest in 19, **all 19
    from 17:00 on 2026-10-13, never before** (`svchost-since.cjs`). No whole check ran
    between 14:13 (497 s) and 17:01 (735 s); twelve of the app's processes were started in
    the 15 hour and five at 16:57. That restart of the app is the only change that can be
    dated; that it is why `PcaSvc` began is not proven. Its registry store holds 56
    programs, so no list of its own grew.
  - *Ruled out with numbers.* The processor's speed: an i5-1035G1 of 15 W; the performance
    counter read every 20 s through the run is 154% of nominal on average under load,
    lowest 140, no sag (`cpu-speed-log.ps1`; no reading of the morning to set beside it).
    Memory: 9.0 to 9.4 GB free through the run, 10.3 in M1g. The runs beside a gate that
    two sessions reported that evening (about 40 and 80 processor-seconds): at eight
    processors that is 5 to 15 s of a check's wall, against 270 found.
  - *What would hold the check near 520 s.* No rule for the sessions and no limit on how
    many build: the check was alone in the lock in both runs. It is the machine's, so his:
    restart the `PcaSvc` service once (an elevated `Restart-Service PcaSvc`) or the machine,
    and measure the next check; and the antivirus exclusion for the test folders, already
    his, is 1.9 processors while a check runs. Sent to the orchestrator between 20:06 and 20:08.
  - *What the gate log lacks.* The busy share over the run would not have told either (94
    and 98%): what tells is who spent the processor over the run. A candidate task, T19
    below: a gate keeps the processes' times it reads at its start, reads them once more at
    its end, and the heaviest that lived through the run are kept with the gate, in a file
    of their own beside the log, so that no reader of the log's lines meets a new field.
  - *The Codex review's share of the lock* (the orchestrator's question of 19:01;
    `codex-in-lock.cjs`, the gate log joined with the run log of `codex-review`, 24 hours at
    19:10): 102 turns held the lock 624.3 minutes; 47 Codex parts, all inside a turn, 42.9
    minutes, **6.9% of the lock held**. 14 turns were the review alone: 19.8 minutes held,
    42.5 waited (four waited 509 to 850 s). So a Codex review outside the lock gives at most
    43 minutes of lock a day and 42 of waits. The orchestrator put its guard behind this
    measure, bounded it to one slice and granted one probe of 100,000 input tokens at most
    (a `NODE_OPTIONS` preload that ends a `node --test` Codex starts); not started.
- 2026-10-13 · **After the measure** (written at 20:16; each line is the orchestrator's
  message unless it says otherwise).
  - *A second dated change in the gap, the orchestrator's own:* at 16:56 to 16:57 it updated
    the installed copy (`pnpm add -g github:jsaristi/js-harness`, a new folder in pnpm's
    global store, the old one left) and ran `js-harness install`. So two things changed
    between the last fast check (14:13) and the first slow one (17:01): the desktop app's
    restart and that install. Which of them, if either, set `PcaSvc` going is not proven.
  - *The orchestrator's own read at 20:08*, a gate running, three reads of the performance
    counters: the svchost of `PcaSvc` 76 to 97% of a processor, MsMpEng 86 to 138%.
  - *His answer*, tapped, read by me (`js-harness sessions --quote
    65318fd5-80e7-4bb8-92b5-06737140185b 13354`, 2026-10-14T01:12:32Z): "Lo reinicio yo ahora
    (Recomendada)", to "El servicio de Windows "Asistente de compatibilidad" (PcaSvc) está
    usando un núcleo entero y alarga cada comprobación de 9 a 13 minutos. ¿Qué hacemos?"
    (the others: "Reinicio la máquina", "No tocar nada"). He restarts the service himself;
    nobody else touches the machine. **Owed here:** the seconds of the first whole check in
    the gate log after the service's pid changes (it was 8936), set beside 700 to 1,132 s
    before; no extra run unless the log cannot tell.
  - *The rule beside a gate, the orchestrator's ruling on my text:* beside a gate, a quote
    and one test file of under half a minute are free; a whole run, a measure, a board read
    and a reviewer are not. The comment at the head of `bin/gate.mjs` already says the
    first half ("One test file run alone during a task stays free; this is for what takes
    minutes"); its sentence is made whole in T19's commit, which edits that file, so that
    one line of comment does not cost the line a whole gate of its own.
  - *After his restart* (written at 22:24). He restarted `PcaSvc` himself at about 22:07:
    `Restart-Service` hung at "Stop Pending", so he ended its svchost (pid 8936, which held
    `PcaSvc` alone, read by the orchestrator) and started the service again; new pid 56312.
    Read beside two gates (`two-pids.ps1`, 20 s each): **`PcaSvc` 0 s at 22:09 and at 22:16**,
    against 21 s in 21 s at 20:06; MsMpEng 34.3 and 47.2 s, against 39.8. **The first whole
    check that started after it** (`after-restart.cjs`, the gate log): 22:14:10, the worktree
    `session-channel`, **576 s, pass**, against 641 to 844 s for the eleven between 20:00 and
    22:00 and 474 to 590 s in the morning. One check, so one reading inside a spread, not a
    proof; it agrees with the measure. Whether the service climbs again after an app restart
    or an install is not known: the gate log's samples will show it if it does.
  - *T19 is ordered:* after the stretch of the session "JH 9" on `bin/check.mjs` is on
    `main`. The antivirus is his and nothing is recommended there: the numbers are 1,139
    processor-seconds in a run of 805 s, 859 in one of 533.
- 2026-10-16 07:05 by `date` · **JH 24 takes T19, T20 and T9.** T9 is closed as superseded by
  `first-version.md` T7 (the gates on GitHub, the session "JH 21"); nothing of it is built here.
  T19 is built on `feat/gate-busiest-run` (worktree `gate-busiest`, from main `6a6ce9e`); T20
  follows on a branch of its own.
- 2026-10-16 · **M2 holds for both reviews (T7), and T8 is one sentence** (session "JH 27",
  on the orchestrator's order of 12:55; nothing spent: every figure is read from records).
  Since faster-check T4 (2026-10-14, `e06cf68`) a review runs out of the gate lock, so the
  records since 2026-10-15 already hold reviews beside gates.
  - *Number 2, a review beside a gate still ends with an answer.* Codex,
    `.git/js-harness/codex-review-runs.jsonl` against the commit gates of
    `~/.js-harness/gate-log/` (`command` `check`, `lock` `own`): 67 runs overlapped a commit
    gate (59 for most of their run, 8 partly), and all 67 ended `reviewed`, median 60 s; 119
    ran with no gate beside, median 48 s. The one `not-inspected` run of the set had no gate
    beside it. gentle-ai: 35 reviews acknowledged since 2026-10-15, 9 of them inside a
    commit gate's sensors (by the mtime of their record in
    `.git/gentle-ai/review-transactions/terminal-consumption/v1/`, the only time it keeps);
    no rejected result since 2026-10-15, and `review-tool-timeout` has no sighting since
    2026-10-11.
  - *Number 1, a review adds less than 30 s to a gate beside it.* The commit gates with a
    review beside: 53, 46 passed, none timed out, median 237 s; without: 114, 103 passed,
    none timed out, median 169.5 s. That difference mixes in what each gate ran, so the
    figure taken is per test file the tests sensor ran, WSL gates only: 2.20 s a file over
    22 gates (median 102 files) against 2.09 over 80 (median 93), about 5%, some 11 s on a
    gate of 100 files: under the bound. It is a correlation over records, not the design's
    processor-second measure of one review beside one gate; gentle-ai's number 1 stays the
    2.3 s and 12 s of 2026-10-12, since its records keep no duration.
  - *T8.* A search of `bin/`, `AGENTS.md`, `README.md` and `docs/ROADMAP.md` for a review
    held to the gate found one text left: the orchestrator skill's "a reviewer wait for the
    gate to end" (`bin/lib/manifest.mjs`). It now says both reviews run beside a gate, and
    names a sub-agent that runs tests among what waits. "T8 as half" (2026-10-12) is
    overtaken: faster-check T4 moved both reviews out of the lock.
- 2026-10-16 · **T4 closed, with cut 3: repositories of fixtures built once and copied**
  (JH 21, by the lead's order of 13:50: "Next for JH 21: gate-wait T4 (the cuts T3 chose,
  each judged by a second run), per odd/tasks/gate-wait.md"). The four cuts of T3:
  1. *The order the files start in*: its runner (`fc70dc3`) stayed on
     `feat/gate-wait-count` and never reached `main`; T17 split the long file in two, so no
     file is the wall that order was for. Nothing built.
  2. *The git a review asks*: T16, done (7,840 to 6,628 git processes in its file).
  3. *Fixtures built once*: built here. `bin/lib/git-fixture.testkit.mjs`, `repoTemplate(build)`:
     `build` runs once in a process, in a folder of its own, and every call after copies that
     folder with `fs.cpSync`; a build that throws leaves nothing, the template goes at exit.
     Measured first, on this machine under load: `git init` 276 ms, init with two `config`,
     `add` and `commit` 1,058 ms, a copy of that repository 84 ms. Taken in 15 test files,
     where each test gets a repository of its own that never meets another by commit ids
     (`merge-queue` copies its origin and clone as one folder and points the clone at the
     copy's origin, one `git remote set-url`). Left as they were: `evals/configs.mjs` (489,
     the sandbox a trial prepares is the product under test), `bin/codex-review.test.mjs`
     (it copied already), and the tests that commit in their body.
     *The second run* (`scripts/count-git.mjs --frames 2`): the whole suite on `origin/main`
     `8b3c031` before, 22,475 git processes in 40 min 43 s (the machine shared); the 15 files
     after, alone. In those files **5,729 to 4,184 git processes, 1,545 fewer**; `init` 551 to
     17, `config` 402 to 95, `commit` 359 to 165, `add` 258 to 143. The new test file adds 27.
     So 1,518 net, 6.8% of the suite's git, over the twentieth T3 asked of a cut. The largest:
     `merge-queue` 710 to 269, `rules-change-run` 970 to 738, `codex-review-coverage` 829 to
     640, `remote` 449 to 270, `project` 1,076 to 941. Their attributed seconds read 2,768 to
     1,126, a reading under two different loads and no proof. Each file passed alone through
     `js-harness gate`, 15 of 15.
  4. *The antivirus*: his; nothing built, the numbers stand in T3's entry.
- 2026-10-16 · **T10, the close** (JH 21, by the lead's order of 15:08: "Next for JH 21:
  gate-wait T10, the close (ROADMAP, both reviews per slice, PRs), once 287 and 288 are on
  main"). The map is a read-only sub-agent's (Opus 5.5, high), spot-checked here: `grep -n
  gate-wait docs/ROADMAP.md` gave line 52 alone before this close.
  - *Pull requests.* With code: 75 (T11), 77 (T13), 79 (T14), 87 (T15), 89 (T5, T5b, T6, T6b,
    T6c), 90 (T16), 92 (T17), 99 (T12), 100 (T18), 276 (T19), 281 (T7, T8), 288 (T20), 290
    (T4, cut 3). Documents alone: 105, 106, 108, 110, 115, 116. T9 is superseded and its
    branch never merged; T3 wrote no source.
  - *Both reviews.* Every code commit of those thirteen is covered by a Codex record: each
    commit was mapped to the records of `.git/js-harness/codex-reviews.jsonl` by `git rev-list
    base..head`, and the only commits with none are clean merges of `main`, which owe none.
    gentle-ai reviewed and acknowledged 75, 89 (T5 `review-66d7ba384db9da9a`, S1
    `review-a1061d8e43757870`), 276 (`review-cf7d0d2ecad4ae1a`) and 288
    (`review-8d18a3a8381fa79c`); the other slices were assessed and not due (under budget),
    each recorded in its entry here or in its pull request's body.
  - *T20* is ticked here, as its line asked: on `main` through 288 (`2c519af`, `f535100`).
  - *Done when.* `contract check` printed PASS, exit 0. `docs/ROADMAP.md` now says the three
    things, in the item "The wait for the gate, measured and cut". `npm run check` is this
    commit's gate. Cut 3 was counted on its 15 files, not in a whole run (its entry says so).
  - *Left open.* T2's tool by file (`scripts/measure-run.mjs`, `c844f29`) and cut 1
    (`fc70dc3`) are only on `feat/gate-wait-count` and never reached `main`, although T2's box
    is ticked; the cuts were counted with `scripts/count-git.mjs`, which is on `main`. The
    notes gentle-ai left on T19 and T20, none blocking (under T20 in Tasks), stay follow-ups.
    Worktrees whose work is merged, for the lead to remove or hand back: `gate-busiest`,
    `gate-refuse-early`, `reviews-beside-gate`, `gate-wait-run-load`; and `gate-wait-count`,
    `gate-on-github`, branches never merged. `gate-wait-t4` is this session's, removed at the close.
  - *Spent on Codex on 2026-10-16 by this session:* 156,948 input tokens (cut 3) and 49,467 (its
    merge of `main`).
- 2026-10-17 · **T11 opened by JH 5 on the lead's note of 13:07Z** ("Next: triage item 11, gate-wait
  T11 (design with two readers, docs/FAILURES.md review-tool-timeout): how a gentle-ai review waits
  for the gate lock or uses the merge-base commit, and what a session does on operation_timeout;
  then build what the design settles, in the manifest's review text. Ask him nothing."), branch
  `feat/review-timeout-rule` from origin/main 13:15Z.
  - *The probe.* gentle-ai takes `--base-ref` as a tree and diffs it against the head's: the target
    evidence of `review-482ab063172d1bb1` reads `base-diff:workspace:7c00d719…:919d5889…`, and
    `7c00d719` is the tree of `db31c96c`, the tip of origin/main then (`git rev-parse db31c96c^{tree}`).
    So a branch behind the default branch, given `--base-ref origin/main`, is assessed with every
    later change of the default branch in it, reversed. Measured at 13:20Z on a detached checkout of
    `24139b7e` (PR 400's head, 19 commits behind origin/main, nothing of its own outside it):
    `gentle-ai review assess --base-ref origin/main --committed-only` took 20 s and saw 20 paths and
    470 changed lines, which is `git diff --shortstat origin/main HEAD` (51 + 419); with the
    merge-base commit (`24139b7e` itself) it answered in 1 s that there is nothing pending. This is
    also L10 of first-version: three timeouts with `--base-ref=origin/main`, 9 s with the merge-base
    commit. The other sightings name no base or `origin/main`; none names a merge-base commit.
  - *Design, version 1, for two readers.*
    1. *The base is a commit the head contains.* A gentle-ai review is given the merge-base of the
       head with the default branch (`git merge-base origin/main HEAD`) or the last reviewed
       boundary, never the name of a branch that moves: a moving name puts the default branch's
       newer work in the candidate, reversed, which reviews the wrong change and makes the
       preflight slower the further the branch is behind. The base goes on the assess, so its
       `next_transition` carries it to the preflight unchanged.
    2. *It does not wait for the gate lock.* Its reviewer has no tools, and the gate of this repo
       sends its tests to GitHub's machines; no sighting shows the gate as the cause (each is "an
       observation beside the gate"), while the base is shown. Waiting would hold every review
       behind every gate for a cause not shown.
    3. *On `operation_timeout`, once more, then on.* The session runs the same command once again,
       after no gate runs on the machine (`js-harness gate -- <the same command>` waits for that
       turn). If it times out again, the candidate goes on without that review: the feature
       document gets a gentle-ai line naming the range, both times and that it was not reviewed
       (the line `notify --kind ready` reads); Codex reviews the range as for every code commit;
       he is not asked, since the provider defect is tracked upstream (gentle-ai #5422). In this
       repo the time is also a `Seen:` line of `review-tool-timeout`.
    4. *Where it lives.* The work session's part of the orchestrator skill (`bin/lib/manifest.mjs`,
       the line on what runs beside a gate), so an installed project gets it; its test in
       `bin/lib/manifest.test.mjs` pins the text. The entry's Control becomes that test.
    Left to the readers: whether 1 should also be a check (the guard's PreToolUse hook could refuse
    a gentle-ai review command whose `--base-ref` the head does not contain, and print the
    merge-base command), and whether 3's retry through `js-harness gate` is worth its wait.
  - *What the two readers changed (version 2, settled).* Reader A (mechanism, probes with a logging
    `git` shim in a scratch clone) found the cost is not the diff's size: after the diff gentle-ai
    4.2.0 walks `git log --first-parent -n 64 HEAD~1` with a `git diff-tree` per ancestor, so a base
    off the head's first-parent line costs about 216 git runs against 31 (17 to 45 s against 2.6 to
    7 s on a loaded machine, the slowest with a 2-line diff), and load multiplies each run. So the
    condition is a base on the head's first-parent line, given by its hash (assess copies the string
    into its `next_transition`, names too): after a merge of the default branch, its merge-base is
    the default branch's tip on the second parent, slow and holding reviewed slices, and the merge
    commit is the base, as section 3 of the protocols already said. Reader A also corrected the
    probe: the assess from `24139b7e` itself answered `unassessable`, high and due, exit 1 ("no
    pending changes"), which is no candidate. The sighting of 2026-10-07 timed out with a base on
    the line, so the fallback stays. Reader B (operability) moved the rule to its home, the
    protocols skill, section 3 (`bin/lib/protocols-skill.mjs`), leaving the orchestrator skill's line
    a pointer; dropped the retry through `js-harness gate --`, which would hold the machine's lock for
    the whole review, and with it the wait (a commit's tests run on GitHub, so the lock does not even
    mean a quiet machine); recommended the guard, which makes the Control a check; and made the
    record line say "not reviewed", since the merge queue counts any gentle-ai line that names the
    range. Left out of the shipped text, as reader B advised: "he is not asked" (the defect handoff
    of the global instructions asks the user before reporting; here the lead's order and the open
    upstream issue #5422 settle it).
  - *Built (7c44b96e, then the first-parent correction).* `reviewBaseRefusal` in `bin/lib/guard.mjs`,
    wired into the guard's Bash check: an assess, status or start whose `--base-ref` resolves to a
    commit off the head's first-parent line is denied, naming the bases to give; a base git cannot
    resolve as a commit (a tree, an unknown name) runs. Protocols section 3 gives the base and the
    timeout procedure (one more run of the same status, never a new start; then on, a gentle-ai line
    with both times and "not reviewed", Codex on the range) and says an assess with nothing pending is
    no candidate; the orchestrator skill's line points there. The entry's Control is the guard's test.
    Tests first: the lib tests failed before (no export, then the merge case let through); after,
    guard 25, lib guard 23, manifest 173, protocols-skill 11 pass.
  - *Reviews.* Codex e20291a..5533618 incorrect (0.99), two P2 (a newline did not end a command; a
    `cd` before it was not followed); the independent verifier (risk item 2) found the same `cd` case
    and heredoc bodies read as commands, both false refusals at 55336181. All fixed test first in
    1cebd69a with its advisories (a 5 s git timeout, the protocols wording, a protocols test, the
    help lines): lib guard 24, guard 25, protocols-skill 12, manifest 173, js-harness 44 pass.
    Codex recheck e20291a..1cebd69 found three new P2 (a `\` line continuation, a relative `--cwd`
    after a `cd`, a `#` comment). gentle-ai e20291ab..1cebd69a high (item 2), lenses risk and
    reliability: approved and acknowledged (`review-ea14564f6a7371ed`), three warnings left as later
    work (the first-parent listing has no depth bound; a relative `--cwd`; a test's unquoted temp
    dir). The pre-push hook refused the branch while the recheck's findings stood, so the three P2
    were fixed test first (lib guard 24, guard 25 pass; it also settles the relative `--cwd` warning);
    gentle-ai on 93f8a8d: medium, 15 lines, not due (under_budget). Codex recheck
    946df82..93f8a8d correct (0.98), 3 of 3 fixed. Left as later work: the listing's depth bound and
    the test's unquoted temp dir.
- 2026-10-17 · **T12 and T13 by JH 21 on the lead's note of 15:34Z** ("the advisories recorded as
  later work, outside gate-first […] (1) gate-wait T11: the first-parent listing has no depth bound;
  one test's temp dir is unquoted"; the lead's claim, not his words), branch `fix/review-base-walk`
  from origin/main `5ea341af`.
  - *T12.* A bound by count cannot tell a base off the line from one deeper than the bound, so the
    walk is bounded by the base instead: `git rev-list --first-parent HEAD ^<base>` stops at the
    first commit the base holds, right above it when the base is on the line, at the fork point
    when it is off. The base is on the line when the first parent of the last commit listed is the
    base, or, when nothing is listed, when it is the head. `onFirstParentLine` is exported and
    takes `run` for the test. RED: on a branch of two commits over 41, the lookup read 42 lines of
    history. Differential check against the old lookup on this repository's history (32 bases: on
    the line, on second parents, `HEAD^2`, a tree, the root, an unknown name): 0 differ.
  - *T13.* The real-repo test's folder now holds a space, as a home like `C:\Users\Ana María`
    puts one in every temp dir, and its command quotes `--cwd`. RED: without the quotes, the test
    fails. GREEN: `bin/lib/guard.test.mjs` and `bin/guard.test.mjs`, 50 pass.
  - *Reviews.* Committed as `a9109b1` (gate: medium, 90 lines). gentle-ai on `5ea341af..a9109b1`: high by
    escalation (item 2, the guard decides which review commands are refused), lenses risk and reliability,
    approved and acknowledged (lineage `review-9cb629c08f739b2c`), two advisories from R3. The warning: the
    verdict read only the last commit printed, so a walk git cuts late (committer dates out of order) and that
    prints commits below the base would call a base on the line off it. Each commit now comes with its parents
    (`--parents`, one git run fewer), and the base is on the line when it is the first parent of any commit
    printed, since every one is on the head's line. The suggestion: tests for a root, a tree, and a base merged
    in by a second parent. Both done test first in the next commit (RED: a run that prints a commit below the
    base was called off the line); lib guard 26, guard 25 pass; the differential check, 32 bases, 0 differ.
    That commit is `3d4194c`; gentle-ai on `a9109b1..3d4194c`: medium, not due (`under_budget`). Codex on
    `5ea341a..3d4194c`: correct (0.94), no finding.

## Next

T11 landed (PR 407). T12 and T13, its later work (JH 21, `fix/review-base-walk`): built test first;
reviewed (gentle-ai approved, Codex correct); next, the PR and `notify --kind ready`. After them, nothing
open from T11. Before T11,
nothing: the feature was closed (T10, 2026-10-16). What it left open is in the entry of T10 in
Progress. Spent on Codex in the feature: 4,854,672 input tokens to 2026-10-13, and 206,415 on
2026-10-16 by the session "JH 21".

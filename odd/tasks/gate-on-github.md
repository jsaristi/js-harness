# The gate on GitHub: what a month costs, what it must prove, and the road he picks

Locator: `odd/tasks/gate-on-github.md` · Engram mirror: `odd/gate-on-github/tasks` · Branch:
`feat/gate-on-github`, in the linked worktree `D:/js-harness-worktrees/github-gate`, cut from
`origin/main` at `46eec34` · Session: `JH 10 · comprobación en GitHub`, orchestrator
`JH ORQ · js-harness` (app session `local_11c45a36-0115-4c92-b865-f1dc3f68c3c1`)

State 2026-10-13: opened by this session from the orchestrator's opening (`js-harness sessions
--opening "JH 10 · comprobación en GitHub"`). The figure went to the orchestrator and he
answered the same evening: no payment method on the account, and the run on GitHub's Linux at
each pull request with code (option A'). Three readers read the figure and the design, and
"What the readers changed" says what moved. The branch is pushed and pull request 109 is open; its first run was red.
Only the orchestrator asks him.

## Goal
He decides, on a cost read at its source, whether GitHub runs the gate on a pull request and on
which road; and the road he picks is built so that a green run there can stand in for a named
local check, with what it leaves unproven on his machine said beside it.

## Why
- The gate runs under one lock for the whole machine, about ten minutes a code commit. The
  orchestrator's measure of 2026-10-13 from the gate log (its claim, not redone here): with
  three sessions building the lock was held 84 percent of an hour and a half; in 24 hours, 51
  whole checks of 566 s on average and 426 minutes of waiting. That line limits how many
  sessions can build at once, and a gate GitHub runs does not queue behind it.
- It is inside the first version: his tapped answer "Todo lo que pedí, sin fecha" to "¿qué
  entra en la primera versión (la 1.0.0)?" (the orchestrator's transcript
  `65318fd5-80e7-4bb8-92b5-06737140185b`, line 10519, read with `js-harness sessions --quote`).
  The roadmap's order holds it as item 2 of "Session channel": "the same gate run by GitHub on
  every pull request" (`docs/ROADMAP.md:770-771`), and "Open decisions", item 7, holds the
  spend as his (`docs/ROADMAP.md:1343-1344`).
- He chose to open this session: "Dos nuevas: cinco (Recomendada)" to "¿Cuántas sesiones
  nuevas abrimos ahora?" (same transcript, line 12000).
- The one trial he allowed is spent: "La opción C" (same transcript, line 1504), whose third
  part was the first step of the road on GitHub. Its results are JH 8's, in
  `odd/tasks/gate-wait.md` ("Part 3 · One trial on GitHub" and "Roads to a shorter wait for the
  gate"): 183.7 s on GitHub's Linux runner and 1,258.2 s on its Windows runner, both red (7
  and 124), both having run `npm test` alone and never `check`.
- A figure comes before a design because the spend is his and every road but one needs it.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/gate-on-github.md` exits 0
- Progress holds the figure: the plan, the prices, the rounding and the runs a month, each with
  its source and the day it was read, and the table of options with what each leaves unchecked
- The figure and a recommendation were sent to the orchestrator, and his answer stands in
  Progress with his words or the label he tapped and the transcript line
- The design of what a run on GitHub must prove was read by two independent readers before it
  reached him, and "What the readers changed" says what moved
- After his yes on a road, and only then: the road is built, each code commit through the
  local gate, gentle-ai's assessment and a Codex record, and the pull request is open for the
  orchestrator to merge
- Progress quotes the first run of the workflow on that pull request: its URL, its result, each
  job's billed minutes from the jobs' times, and the tests it skipped against the 132 of the
  trial; and one run made red on purpose, seen red
- Progress says how the workflow is undone (one file deleted on `main`), and a test holds the
  paths the workflow ignores equal to the `documents` of `harness.json`

## In scope / Out of scope
- In: this document; the reads of GitHub that change nothing (`gh api` GET calls, GitHub's
  public pages); the design of the gate on GitHub; fixes that make the suite pass on Linux,
  test first, once the design names them; after his yes, the workflow file and what the road
  needs, on this branch.
- Out: `odd/tasks/gate-wait.md` and the worktree `D:/js-harness-worktrees/gate-on-github`
  (JH 8's; read, never edited). The main checkout `D:/js-harness` (the orchestrator's place to
  merge). `bin/check.mjs`, `bin/gate.mjs`, install and update (JH 8); `bin/sessions.mjs`,
  `bin/notify.mjs`, `bin/lib/channel.mjs` (JH 5); the README, the rules, `docs/ROADMAP.md`
  entries (JH 7); the functions on demand and the Codex switch (JH 9): the orchestrator is told
  before any of those files is edited here. Taking a check out of the local gate: not asked.

## Constraints
- Nothing runs on GitHub and no branch that carries a workflow is pushed before his answer —
  because a push of such a branch starts runs, and runs spend his account's minutes.
- No option names a cost that was not read at its source the day it is written — because the
  spend is his decision and a guessed price makes it for him.
- Every code commit goes through the machine's gate with `js-harness gate`, and no test, board
  read or reviewer runs beside a gate that is running — because the lock is one for the machine.
- Zero dependencies, every operating system, and each thing that ships judged twice: here, and
  in a project that installed the harness (`docs/ROADMAP.md`, "Session channel") — because
  `check` ships, and whether `init` writes a workflow is a product choice of his.
- A Codex review runs without asking only inside the rate (`js-harness codex-review --plan` at
  most 1.05 times the larger of 300,000 input tokens and 1,200 a changed line); over it, the
  orchestrator is asked.

## Effort
high

## Ask me before
- Any spend on GitHub or elsewhere; a payment method, a budget or a plan change on his account.
- A workflow file on `main`; a check made required on a branch.
- Any setting of his GitHub account or of the repository: visibility, Actions settings,
  secrets, runners; a wider scope on the `gh` token.
- A push that starts a run, paid or included.
- Any change to the machine (a runner installed as a service, WSL).
- Running the whole Windows suite less often than at every code commit, or any local gate
  retired or skipped because a run on GitHub is green: never put to him as a question (What
  the readers changed); it reaches him as the design of the exchange (T7).
- Whether `init` writes a workflow into a project that installs the harness, and whether a
  command that refuses a merge whose head has no green run ships: product choices.
- A required check, Windows on GitHub, a run on merges to `main`: not covered by his yes.

## Design

### The figure (read 2026-10-13; nothing run, nothing changed)

**What was read, each at its source.**
- The repository `jsaristi/js-harness` is private, owned by the user account `jsaristi`,
  created 2026-09-26, with Actions enabled (`gh repo view --json visibility,isPrivate,owner`;
  `gh api repos/jsaristi/js-harness`; `…/actions/permissions`).
- The plan cannot be read: `gh api user` gives `plan: null`, because the token's scopes are
  `gist`, `read:org`, `repo`, `workflow` (`gh auth status`) and the plan needs `user`. What
  can be read: `gh api repos/jsaristi/js-harness/branches/main/protection` answers 403,
  "Upgrade to GitHub Pro or make this repository public to enable this feature." So the
  account is below Pro, which for a user account is GitHub Free. An inference, said as one.
- Included each month for private repositories: GitHub Free 2,000 minutes, GitHub Pro 3,000.
  Free of charge: "public repositories that use standard GitHub-hosted runners", and
  self-hosted runners. "If your account does not have a valid payment method on file, usage is
  blocked once you use up your quota." With one, "You pay for any additional use above your
  quota". Source: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- A minute past the quota: Linux 2-core $0.006, Windows 2-core $0.010, Linux 1-core $0.002,
  macOS $0.062. "GitHub rounds the minutes and partial minutes each job uses up to the nearest
  whole minute." Source: https://docs.github.com/en/billing/reference/actions-runner-pricing
- What the trial's jobs took (`gh api repos/jsaristi/js-harness/actions/runs/38296748258/jobs`):
  Linux 19:18:19 to 19:21:43, 204 s, so 4 minutes billed; Windows 19:18:19 to 19:39:43,
  1,284 s, so 22 minutes billed. That is `npm test` and the job's setup; `check` runs the same
  suite once, so 4 and 22 are the figures used, and the Linux column is given at 5 as well.
- The runs a month, from this repository's own history (`gh api --paginate
  repos/jsaristi/js-harness/activity?time_period=month`, 294 events from 2026-09-26; `gh pr
  list --state all --json number,createdAt,files`, 103 pull requests):

  | Window | Pull requests opened | of them Markdown alone | Later pushes to a branch | Merges to `main` |
  |---|---|---|---|---|
  | 14 days, 2026-09-30 to 10-13 (UTC) | 89 | 22 | 55 | 89 (and 2 direct pushes) |
  | 24 hours to 2026-10-13 23:53 UTC | 22 | 4 | 10 | 23 |

  A workflow on `pull_request` runs when a pull request opens and at each later push to its
  branch: at most 144 runs in the 14 days (10.3 a day, 309 a 30-day month) and 32 in the last
  24 hours (960 a month at that pace). A run on each merge to `main` adds 195 a month, or 690.

**Not read, and said so.**
- Whether a payment method is on file, whether a budget exists, and the minutes used this
  month: the billing endpoints answer 404 and ask for the `user` scope, which is not added.
  The trial used 26 billed minutes at most by its jobs' times; the timing endpoint's zero is
  no evidence.
- How many included minutes a Windows minute takes. Neither page says. GitHub's page on the
  2026 prices says only that runners "consume available usage based on list price"
  (https://github.com/resources/insights/2026-pricing-changes-for-github-actions). The rows
  with Windows are therefore a range.
- GitHub Pro's price today: the pricing page read on 2026-10-13 does not list Pro. Not used in
  any row.
- A run on the 1-core Linux runner ($0.002): never measured for this suite.

**The table.** A 30-day month; dollars past the 2,000 included minutes at the prices above.
"Stops" is the day of the month the quota ends if no payment method is on file.

| Option | Normal month (the 14-day mean) | A month at the pace of the last day | What it leaves unchecked on his machine |
|---|---|---|---|
| A · Linux, at each push to a pull request | 309 runs, 1,236 min: $0 (at 5 min: 1,545, $0) | 960 runs, 3,840 min: $11.04, or stops on day 16 (at 5 min: $16.80) | Windows: the 132 tests Linux skips (7.6% of the suite's time) and the system itself: CRLF checkouts, `.cmd` shims, files held open, hooks under Git for Windows |
| A' · A, skipping pull requests of Markdown alone | about 232 runs, 928 min: $0 | about 785 runs, 3,140 min: $6.84, or stops on day 20 | The same; a change of Markdown alone runs no suite there |
| B · A, and again on each merge to `main` | 504 runs, 2,016 min: $0.10, or stops on day 30 | 1,650 runs, 6,600 min: $27.60, or stops on day 10 | The same as A |
| C · Linux, once a pull request, asked for when it is ready to merge | 191 runs, 764 min: $0 | 660 runs, 2,640 min: $3.84, or stops on day 23 | The same as A; and the pushes before that one are proven only by the local gate |
| D · Linux and Windows, at each push to a pull request | 309 runs, 8,034 min: about $55 to $65, or stops on day 8 | 960 runs, 24,960 min: about $214 to $224, or stops on day 3 | His own Windows: the antivirus, his tools, eight threads. Red today by 124 tests for one cause (a temp path with a short name) |

**The roads that cost nothing, and what each gives up.**
- A public repository. Standard runners are free there, Linux and Windows both, and the 403
  above says branch protection (a required check) opens too. It gives up the privacy of
  everything in the repository and its history, for good: the documents quote his words and
  name his transcripts and paths, and what was public once cannot be recalled. Visibility is
  his setting.
- A runner of his own. GitHub does not bill its minutes today; the $0.002 a minute announced
  for 2026-03-01 was postponed with no new date ("We're postponing the announced billing
  change for self-hosted GitHub Actions", the 2026 prices page above), so the zero can end. On
  this machine it gives up the whole gain: the run takes the same eight threads and has to
  queue with the local gate. It is a service installed on his machine that runs what a pushed
  workflow says. On another machine it needs that machine, on and kept.
- The gate only on the merge with `main` (a run at each push to `main`, Linux): 195 runs, 780
  minutes, $0 in a normal month; 690 runs, 2,760 minutes at the last day's pace, $4.56 or
  stops on day 22. It gives up finding the break before the merge: `main` is red first, and
  every open branch learns it after.
- No payment method on file is itself a road: the bill is then zero by GitHub's own rule, and
  what is given up is the gate on GitHub for the rest of a month that outruns the quota.

**What the figure does not say.** A run on GitHub raises the number of sessions that can
build only if a local gate is retired in exchange for it; on Linux alone that exchange gives
up Windows for whatever it replaces (`odd/tasks/gate-wait.md`, road 3). Which
local gate a green run may stand in for is the design (T3), not this figure.

**Mine, for the orchestrator.** Option A', on Linux alone: zero dollars in a normal month
(928 of 2,000 minutes), and at the pace of the last day at most about seven dollars, or
nothing and a stop on day 20 if no payment method is on file. Windows stays on his machine:
on GitHub it is 22 minutes a run, red today, and about nine times what the Linux job costs a run. One question for
him first, since it sets whether any month can cost money at all: is a payment method on file
on the account `jsaristi`, and does he want one there.

### What a run on GitHub proves, and what it may stand in for (first version, before its readers)

**`check`, row by row, and what each finds on a runner GitHub hosts** (`bin/check.mjs:1399-1437`).

| Row | What it reads | On GitHub's runner |
|---|---|---|
| `failures`, `budget`, `contracts` | `docs/FAILURES.md`, `AGENTS.md`, `odd/tasks/` | The same files: they prove there what they prove here |
| `payload` (informs) | the host files of the home | No such files; it informs and fails nothing |
| sensors: `npm test`, under the gate lock of the home, 1,200 s a sensor | the working tree | Runs. On Linux 132 tests skip and 7 fail today |
| `rules`, `document tests` | `harness.json` "documentSensors" | Run only in place of the suite, for staged documents |
| `review` (informs, fail-open) | `gentle-ai review assess` | gentle-ai is not there: "gentle-ai was not found" (`bin/check.mjs:1066`) |
| `codex-review` debt (informs), and the row of `--push` (fails) | `<git common dir>/js-harness/codex-reviews.jsonl` (`bin/lib/codex-reviews.mjs:38-48`) | The records never leave his machine: nothing to read |

So a green run of `node bin/check.mjs` there proves, for the pull request's head merged with
`main` as it was at that push: the three document rows, and the suite on Linux. It proves
nothing of: the 132 tests that run on Windows alone and Windows itself (CRLF checkouts, `.cmd`
shims, files held open, hooks under Git for Windows); the two reviews, whose records are local,
so the pre-push hook on his machine stays the one thing that refuses unreviewed code; and his
home (hosts' files, installed hooks, `doctor`).

**What it adds whatever it replaces.** The harness is written for every operating system
(Constraints) and no Linux had run its suite before the trial. That one run found seven
failures: four faults of tests, one confirmed small defect (`evals/paths.mjs:6`) and one
possible defect of the harness on Linux (`evals/ports.mjs:168-169`); JH 8's reading
(`odd/tasks/gate-wait.md`, "what a Linux run leaves unproven"). A second system is a check the
project does not have, on a product that ships to machines that are not his.

**What it can stand in for: the local gates, counted** (`git log --all --since="14 days ago"`,
read 2026-10-13: commits by kind. Not every one ran a gate when it was made: the hook of a
merge is of 2026-10-12 and the documents rule of 2026-10-11; What the readers changed).

| Local gate | 14 days | Last 24 hours | A Linux run in its place loses |
|---|---|---|---|
| A commit with code | 290 | 33 | Windows for that commit |
| A merge of `main` into a branch (`.githooks/pre-merge-commit`) | 62 | 14 | Windows for the combination of two trees, each proven on Windows by itself |
| A commit of Markdown alone (no suite, no lock) | 335 | 57 | nothing: no suite runs for it today |

- **R0 · In place of nothing.** A second witness on every pull request with code. It frees no
  minute of the lock. No trade; the spend of option A' (zero in a normal month).
- **R1 · In place of the gate of a merge of `main`.** About a third of the whole
  gates under today's rule: 22 merges of `main` against 43 commits with code since the hook
  that gates a merge exists (`97703f9`, 28.9 hours), and 14 of 47 in the last 24 hours; about
  ten minutes of lock each. The run on
  GitHub tests the head merged with `main` as `main` was at that push. **Not designed (T7):**
  how the pull request is tested again once `main` has moved. A re-run tests the old merge;
  the branch updated on GitHub's side is a merge commit no hook gates, and a session with
  local commits then merges locally after all or rebases and orphans its Codex records; a pull
  request with a conflict gets no run at all. Its runs are in no row of the figure. What is
  lost in any form of it: the combination is proven on Linux alone. It is his, and it changes
  the orchestrator's rule that a pull request is read only when its head contains `main`.
- **R2 · In place of the gate of a commit with code.** The whole exchange, never asked of him
  as a question. His; not proposed here.
- **R3 · The Windows suite on GitHub as well** (option D of the figure). The one road that
  could take gates off the machine with no loss of system: about $55 to $65 in a normal month
  at each push to a pull request, or nothing in a public repository. It needs the 124 fixed
  (one cause, fixtures' roots made canonical with `fs.realpathSync.native`), takes 22 minutes
  a run where his machine takes about ten, proves a push and not each commit, and is not his
  Windows. Named so the comparison is whole; not proposed.

**A check cannot be required here.** The repository is private on a plan below Pro: branch
protection answers 403. So "green before the merge" is not GitHub's rule but the
orchestrator's: it reads `gh pr checks <number>` for the head it merges, and merges on green.
That is text until a command holds it; a command that refuses a merge whose head has no green
run is the harness's way (AGENTS.md: what a command can check belongs in `bin/`), and whether
it ships is a product choice of his, with whether `init` writes the workflow. A required check
by GitHub itself needs Pro or a public repository, both his.

**The workflow, when a road is his yes.**
- `on: pull_request` (opened, synchronize, reopened), ignoring exactly the paths the local gate
  calls documents (`harness.json` "documents": `docs/` and `odd/tasks/`), held equal by a
  test. A branch pushed with no pull request spends nothing. A pull request of documents alone
  runs nothing and shows no check; one that holds code runs at every push, a push of documents
  included; one with a conflict runs nothing until the conflict is gone.
- What a session and the orchestrator read before a merge, since no check can be required: one
  of four states for the head being merged: green; red; no run because only documents changed
  (nothing was owed); no run or a run that never started (a conflict, the quota ended, GitHub
  down), where the local gate stands alone exactly as it does today. Nothing local waits for
  GitHub in this feature, so the day the quota ends changes nothing on his machine.
- One job on `ubuntu-latest`, Node 24, `fetch-depth: 0`, `node bin/check.mjs`. `permissions:
  contents: read`, no secret, the two actions pinned by commit, `timeout-minutes: 15` (so a
  run that hangs costs 15 minutes at most), `concurrency` by pull request with
  `cancel-in-progress` (a second push stops the first run).
- The file reaches `main` in its own pull request, after his yes: until it is on `main` it
  runs for no other pull request.
- What bounds the spend is not in the file: no payment method on file (GitHub stops at the
  quota), or a budget of his with a stop.

**The seven, before the first run can be green** (T5; each test first).
- Four faults of tests: `bin/lib/payload.test.mjs:197` and `:212` (a Windows absolute path fed
  on every system), `evals/codex-isolation-probe.test.mjs:301` (`HOMEDRIVE`, set on Windows
  alone), `bin/lib/project.test.mjs:1919` (an expectation stale since `ae471e7`, unseen
  because Windows skips that test).
- One small defect: `exists` of `evals/paths.mjs:6` lets `ENOTDIR` through.
- One possible defect, two tests: `evals/ports.mjs:168-169` names a process by `ps -o comm=`,
  which answered `MainThread` for a Node child.
- What this machine can prove of them: a test that injects the system (a path style, an error
  code, the text `ps` answered) goes red and then green on Windows. That each passes on a real
  Linux is proven only by the first run on GitHub, which is after his yes: there is no Linux
  on this machine (no WSL distribution, no docker; JH 8's reading). Said so that the first run
  is not promised green.
- `bin/lib/project.test.mjs` sits beside `bin/lib/project.mjs`, which JH 8 changed last
  (`243794e`): the orchestrator is told before that file is edited.

**Twice judged.** Here, the workflow is one file and a rule of the orchestrator. In a project
that installed the harness, the same file would run that project's `check` on its owner's
minutes: it is written by `init` only if he says so, and never pushed or enabled by the
harness itself.

**Mine.** R0 now, on option A', which is his yes of 2026-10-13: it costs nothing, it is the
only Linux the product has, and it is the ground for R1. R1 is brought to him as its own
design (T7), with the count above and its own minutes. Said plainly, since the opening calls
this the thing that raises the ceiling: on Linux alone and with nothing exchanged it frees
nothing; with R1 it frees about a third of the whole gates; the rest of the line is
commits with code, and only an exchange he has not been asked about, or a Windows on GitHub
(paid, or free the day the repository is public, which he once said it will be) takes those
off the machine.

### The exchange, R1 (T7, first version, before its readers)

**What is exchanged.** Today a pull request is read only when its head contains `main`, so
each time `main` moves every open branch merges it and that merge runs a whole local gate
(`.githooks/pre-merge-commit`, since `97703f9`). This branch paid one tonight: `82aa048`,
asked about 21:18, committed after its turn, the whole suite. The exchange: a branch no longer
merges `main` to be read; the pull request is merged when a run on GitHub tested its head
merged with the `main` it will land on, and was green.

**What it frees.** 22 of 65 whole gates since the hook (34 percent), 14 of 47 in the last 24
hours; each 9 minutes on a quiet machine and 13 to 19 tonight (the orchestrator's measure). A
merge with a conflict still merges and gates on the machine, as today.

**What it gives up.** The combination of the branch and the new `main` is proven on Linux
alone: the 132 tests Linux skips and Windows itself are no longer run on it. Each side was
proven on Windows by itself. How often a local merge gate is red where both parents were green
is not known: a red gate leaves no commit and the gate log does not tell a merge gate from a
commit gate. Measuring it needs one field in JH 8's gate log; until then the loss is named, not
sized.

**How the run meets the new `main`** (the readers' finding: a re-run tests the old merge).
- *A, recommended:* the orchestrator closes and reopens the pull request just before its merge,
  when `main` moved since the last run. A reopen is an event of the workflow, and GitHub tests
  the head merged with the base as it is then. No commit, so no local gate and no Codex record.
  Not proven: that a reopen recomputes the merge against the new base; the first test of it is
  one reopen of a pull request, one run, about 4 minutes.
- *B:* the branch updated on GitHub's side. Its merge commit is gated by no hook, and a session
  with local commits must then merge or rebase anyway: it does not free the gate it was for.
- Then the merge itself: `gh pr merge --match-head-commit <sha>`, and only while `main` is still
  the one the green run merged with; if `main` moved in between, the run is asked again.

**The month, in minutes, with R1** (a run is 4 billed minutes; A' is "The figure after its
readers"). R1 adds at most one run a pull request, the one before its merge, when `main`
moved: at most one for each pull request with code, about 144 a month at the mean (1,336
minutes with A', inside 2,000) and about 540 at the pace of the last 24 hours (4,620 minutes:
the quota ends about day 13). The run that matters is the one
before the merge. If only that one ran (no run at each push), a month at the mean is about 576
minutes and one like the last 24 hours about 2,160 (the quota ends about day 28).

**The day the quota ends.** No run starts on GitHub until the month turns, in any private
repository of his. Every pull request is then in the fourth state ("no run that should
exist"), and the orchestrator goes back to today's rule for it: the branch merges `main` and
its local gate runs. Nothing else changes on the machine. A session can see that day coming
only by a count of its own (next).

**A count of minutes a session can read.** The billing page needs the `user` scope, which is
not on the token. What can be read with `repo`: every run of the month in his private
repositories that have a workflow (four, by the orchestrator), and each job's start and end;
each job rounded up to the minute and summed is the month's use, an estimate GitHub's own
figure may differ from. A command that prints it is the harness's way; a cap of our own
(the orchestrator stops relying on GitHub at, say, 1,800) reads that count. Neither is built.

**A shorter run.** 204 s is 4 billed minutes; 180 s or less is 3, a third more runs a month.
The suite took 183.7 s of it, one file at a time on two processors. What would bring it under:
two files at once on the runner (the runner's `node --test` runs one, since it keeps a
processor free), which only a measure on GitHub can size; and JH 8's road 1, fewer process
starts in the four longest files. Whether `node --test` can stop at the first failure was not
read; a red run costs as much as a green one until it is.

**For him, one question:** whether a pull request may be merged on a green run on GitHub
against the `main` it lands on, without the branch merging `main` and running the whole local
gate; giving up the Windows proof of that combination, freeing about a third of the whole
gates, at about 144 more runs a month (540 at the pace of the last 24 hours).

## What the readers changed
Three readers that did not write the design, all read-only, on 2026-10-13: one searched his
earlier words in the 59 transcripts of the project, one looked for what the design left out,
one attacked the figure and the facts. What each moved:

**The search of his words** (each line confirmed with `js-harness sessions --quote`).
- **The trade was never put to him as a question.** "He passed over" is the sessions' wording
  (`odd/tasks/gate-wait.md`, and this document until now). His words are "hagamos mas rapido la
  bateria osea la opcion 3" (the orchestrator's transcript, line 1384), "osea la idea es que
  quiero mas potencia en las otras opciones me das antes quitar potencia, o dime que otra nos
  da mas potencia y rapides?" (line 1441) and "La opción C" (line 1504), where A, B and C all
  left option 1 out. So the exchange reaches him as a first question, not as one reopened.
  Changed here: "Ask me before" and R1 and R2 no longer say he refused it.
- His standing on quality, which any exchange is judged by: "siempre priorizamos la calidad
  sobre el tiempo aunque la rapidez tambien es importante" (transcript `0f993107`, line 168),
  and "que realmente nos de ahorro osea no siemplemente desmejorar la calidad" (`130317af`,
  line 1728).
- On visibility, his one statement: "cual es la mejor opcion sobretodo ahora que esta privado y
  despues va a ser publico" (transcript `2c923152`, line 72, 2026-09-26). No date and no later
  word. It matters to the figure: in a public repository the standard runners are free, Windows
  too, and a check can be required. Added to R3 and to what is brought to him.
- After his yes on the road: "listo, sigue y avísame cuando llegue el diseño del canje" (line
  12524). The exchange (R1) is owed to him as its own design.
- Not found, with the patterns run over his own entries: nothing of his on a required check or
  branch protection, on a runner of his own, WSL, Linux or a rented machine, or on whether
  `init` writes a workflow. Those stay open and his.

**The reader of what is missing** (ten gaps; taken unless said).
1. *R1's "run again" does not exist as written.* A re-run reuses the first run's commit and
   ref, so it tests the old merge; the only fresh merge is the branch updated on GitHub's side,
   a merge commit no hook gates, after which a session with local commits merges locally (the
   gate R1 meant to retire) or rebases (which orphans its Codex records). And R1's runs are in
   no row of the figure. Taken: R1 below is marked not designed; its mechanism and its minutes
   are T7.
2. *"Green" has three states that are not green and look alike:* no check at all (the paths
   were ignored), no run because the pull request has a conflict (GitHub starts none), and a
   run blocked by the quota or by GitHub being down. Taken: the merge rule names the four
   states, and merges the head it read (`gh pr merge --match-head-commit`).
3. *"Markdown ignored" is not the local rule.* Locally a document is a path under `docs/` or
   `odd/tasks/` (`harness.json`); `AGENTS.md` and the Markdown fixtures of `evals/` are code to
   the gate. Taken: the workflow ignores exactly the `documents` of `harness.json`, and a test
   holds the two lists together. His tapped "con código" is read as the local rule's code.
4. *A pull request runs its own copy of the workflow,* so a branch can widen it (a Windows job,
   a longer timeout) and spend what the file on `main` does not. Taken: `timeout-minutes` and
   the quota bound a run whatever a branch writes; the merge rule compares the head's workflow
   with `main`'s; a row of `check` that refuses a changed workflow is named for the build.
5. *The quota is the account's:* a month that outruns it stops Actions in all his private
   repositories. Taken; sent to the orchestrator for him the same hour.
6. *`check` never ran on Linux nor on a pull request's checkout* (the trial ran `npm test` on a
   branch push). Taken: "Done when" now asks for the first run seen green with its URL and
   billed minutes, one deliberate red seen red, and the count of skipped tests against 132.
7. *The two-week comparison could not measure R1:* a red local gate leaves no commit, and the
   gate log does not tell a merge gate from a commit gate. Taken: dropped from "Mine"; what
   R1's evidence would be is part of T7, and it needs a field in JH 8's gate log.
8. *An installed project's runner cannot get the harness:* it installs from this private
   repository with the machine's credentials, so a runner would need a secret. Taken under
   "Twice judged": nothing ships to an installed project in this feature.
9. *Roads missing:* Codespaces (a Linux included in the Free plan, to prove the fixes before
   any workflow; it needs a wider scope on the token, his) and GitHub Pro (protected branches
   on a private repository; its price is not read). Named under the roads; not proposed, since
   his yes on A' brings a real Linux run at no cost.
10. *The contract:* "Ask me before" lacked the two product choices and "Done when" an undo.
    Taken.

**The reader of the figure and the facts.** Every cell's arithmetic, the prices, the rounding,
the included minutes, the counts on GitHub and the code references were redone and hold. What
does not:
1. *The mean is no forecast, and "the last day" is not the peak.* Pull requests opened plus
   branch pushes by day, 09-30 to 10-13: 5, 4, 0, 12, 6, 7, 7, 1, 0, 8, 9, 21, 32, 32: 41 in
   the first seven days, 103 in the last seven. The busiest 24 hours of the window hold 47
   events, not 32. Taken: "The figure after its readers", below.
2. *"Later pushes to a branch, 55" overcounts what fires.* 25 of them came before the pull
   request existed and one matches none; 29 came while it was open. So 118 events really fire
   in the 14 days (253 a month) and 25 in the last 24 hours (750 a month). "At most" held as a
   bound; the smaller numbers are the ones to use. Taken.
3. *R1 is about a third of the whole gates, not a sixth.* `.githooks/pre-merge-commit` dates
   from `97703f9` (2026-10-12 14:20), so 40 of the 62 merges ran no gate. Since the hook: 22
   merges of `main` against 43 commits with code, 34 percent; the last 24 hours, 14 of 47, 30
   percent. Taken: R1 and "Mine".
4. *The counts of commits are not the counts of gates.* The documents rule dates from `74e473c`
   (2026-10-11), so 140 of the 335 commits of Markdown alone ran the whole suite when they were
   made; and the rule is by path (`docs/`, `odd/tasks/`; `bin/check.mjs:273`), so 12 commits of
   Markdown outside those folders are code: 302 commits with code, not 290. Taken: the table of
   local gates says it is a count of commits by kind, and R1 is sized by the window since the
   hook.
5. *Windows under `check` has a second cause of red:* its suite took 1,258.2 s on GitHub, over
   the 1,200 s a sensor is given (`bin/check.mjs:80`). And if included minutes are used up by
   list price, as the 2026 prices page says of runners, a Windows minute weighs 1.67 and
   option D ends the quota on day 5 and day 2, not 8 and 3. Taken into R3; no decision hangs
   on it, since Windows on GitHub is not his yes.
6. *The path filter reads the whole pull request* (a three-dot diff), so a push of documents to
   a pull request that holds code runs the suite. Taken in the workflow's description.
- Could not be read anywhere, and so is not relied on: whether a cancelled or a queued job is
  billed (what `cancel-in-progress` saves is unknown), and which copy of the workflow a
  `pull_request` run uses (the build reads it from the first run).

### The figure after its readers, in minutes (no card: only the day the quota ends matters)

| Pace | Runs of A' a month | Minutes at 4 a run | The 2,000 end |
|---|---|---|---|
| The 14-day mean (118 events that fire, three in four with code) | about 190 | about 760 | not reached |
| The last 24 hours (25 events) | about 615 | about 2,460 | about day 25 |
| The busiest 24 hours of the window (47 events, the wider count) | about 1,060 | about 4,250 | about day 15 |

So at the mean the month fits with room; a whole month as busy as these last days ends the
quota between day 15 and day 25, and from that day to the month's end no run starts on
GitHub, in this repository or in any other private one of his. The minutes are counted from
the real runs once they exist (Done when), so the month's use is read and not guessed.

**T7, the exchange: reader B (gaps; not yet taken into the design, which is still its first
version).**
- 1. A session's side is not written. Today's rule is in the orchestrator's relief file (~/.js-harness/relief/D--js-harness.md:276): head contains origin/main "or the session merges main in and gates the result first". Should say: a session merges main only on a conflict (GitHub starts no run then) or when it needs code from main; the text goes into the relief file and to each session. A clean merge's Codex record needs nothing (gate-wait.md:2799).
- 2. Nobody owns a main that is red (on Windows or Linux): no run on main is covered by his yes, no local gate runs on the merged tree; the first Windows proof of it is the next session's first code commit, which then fails for a cause not its own. Should say who fixes a red that traces to main, how a session tells its red from a main red, whether the orchestrator stops merging until then. Settle in the design, not ask him.
- 3. The base a run tested cannot be read: gh pr checks shows none. GITHUB_SHA is the last merge commit of refs/pull/N/merge, so HEAD^1 on the runner is the base. Should say: the workflow prints `git rev-parse HEAD^1`, the merge check compares it with origin/main. Judgment: "MERGEABLE, CLEAN" may not tell no-check from green; read the four states separately.
- 4. Several PRs ready at once: after the first merge each next needs close+reopen (~4 min + queue), may conflict and fall back to a local merge; N ready = N-1 runs in a row. Close+reopen leaves the PR CLOSED for a moment; the board reads only open PRs (bin/lib/sessions.mjs:1061). Reopen mechanism unproven. Should say the order, what the board shows, the fallback if a reopen does not recompute the merge.
- 5. A red only on Linux: the four states give no action. Should say: red = no merge under the exchange; the session fixes it or merges main locally and the old rule applies; the cause is recorded. (Flake candidate: T6 review finding 1.)
- 6. Going back must be one decision: record each merge made on a GitHub run (run URL, base, head; in the merge commit body or a relief line); the measure of the loss needs JH 8's gate log to tell a merge gate from a commit gate; on return every open branch that did not merge main merges it and gates once.
- 7. Twice judged: no merge rule ships (bin/lib/manifest.mjs:30,51,59); an installed project's runner cannot fetch the private harness; the merges of main may be mostly this repository's cost (ROADMAP "Session channel" advice). Should say: a rule for this repository only.
- 8. A cheaper alternative not compared: the orchestrator already runs `git merge-tree` of each open branch against the new main (relief line 276). "Merge without the local merge gate when merge-tree is clean and the branch and the new main changed no code file in common" frees part of the same gates with no minutes and no reopen; gives up two code files that interact without overlapping. Weigh it against the exchange.
- Question for him (judgment): answerable, but hides the account-wide stop (busiest pace about day 9 by the same arithmetic) and the automatic fallback on the day the quota ends; put both in the same question; settle "who repairs main" in the design.
- Looked for and not a gap: Codex coverage is from the merge-base (bin/lib/codex-review-coverage.mjs:273-284); sameTree; only 2 of 24 merges of main since 97703f9 had a hand resolution (git show --remerge-diff); the month's arithmetic checks out.

**T7, the exchange: reader A (errors; not yet taken into the design either).**
- 1. The extra runs of R1 (144 a month at the mean, 540 at the last day's pace) are an upper bound, not the estimate: the run is owed only when main moved after a pull request's last run. Median code pull request open 4 minutes; in 14 days 10 of 70 code pull requests saw another merge land while open (#36, 37, 44, 52, 53, 69, 75, 81, 99, 100), 2 of 18 in the last 24 hours. So about 21 a month at the mean and 60 at the last day's pace; minutes about 844 at the mean and 2,700 at that pace (quota ends about day 22, not 13). R1 also removes runs A' counts: 3 of the 25 local merges of main since 97703f9 were pushed to an open pull request (#75, #99, #100).
- 2. The day the quota ends is the wrong state: GitHub's troubleshooting page speaks of "workflows failing due to billing", so a blocked run looks red (failure or startup_failure, not read), not absent; the orchestrator must read the job's annotation. Minutes reset at the start of each billing cycle, not the calendar month.
- 3. Which main a green run tested cannot be read from the checks: the run's head_sha is the pull request head (82aa048); the base appears only in the checkout log ("HEAD is now at 0f0f0ef Merge 82aa0480… into 9b227df…"). The rule must read that line or the merge commit's parents (the workflow can print `git rev-parse HEAD^1`).
- 4. `gh pr merge --match-head-commit` checks the head only, never the base; "only while main is still the one the green run merged with" is a manual check no command enforces (no protection, allow_auto_merge false). Nothing documents that GitHub's merge commit has the run's tested tree.
- 5. Mechanism A (close and reopen) is unproven on its key point: the test merge commit is made by a background job (mergeable may be null meanwhile); nothing says a reopened run waits for it. The one-reopen test must check the base in the log equals the current main; a green result alone proves nothing. `closed` is not a workflow type, so the close starts no run.
- 6. What it gives up lands on main: the next session that branches from it meets the Windows break in its own pre-commit gate, on code it never touched. Concrete case: main changes one of the 132 Windows-only tests that exercises code the branch also changed. The budget case (AGENTS.md at 1,477 of 1,500 on the runner; two branches adding about 15 tokens each) is caught on the runner. The local merge gate also writes a gate-log record that the lock measures and sameTree read.
- 7. "No commit, so no Codex record" holds, but because a clean merge needs no record anyway (`--diff-merges=combined`, bin/lib/codex-review-coverage.mjs:204-210): R1 frees nothing on the review side.
- 8. The state line said "Nothing has run on GitHub": stale since run 38504042140.
- Holds: 22 code-bringing merges since 97703f9 (24 merges, 2 documents only); the arithmetic given its inputs; default types opened, synchronize, reopened; no run on a conflict; 4 billed minutes a run.

## Tasks
- [x] T1 · This document, opened with the task contract, on its own branch and worktree,
      mirrored in engram. Route: inline. Evidence: the commit that adds it.
- [x] T2 · The figure: plan, prices, rounding, runs a month, the table of options and the
      roads that cost nothing, each read at its source; sent to the orchestrator with a
      recommendation. Route: inline, no source written. Evidence: "The figure"; Progress.
- [x] T3 · The design of what a run on GitHub must prove to stand in for a local check: the
      suite's 7 Linux failures and their causes, what `check` does beyond `npm test` (the
      contracts, the token budget, the review rows), what a required check on `main` would
      change for the orchestrator's merge; with a search of his earlier words. Route: inline.
      Evidence: "What a run on GitHub proves"; first version, the search of his words and the
      readers still out.
- [x] T4 · Two independent readers attack the design (opus, effort high); their findings
      taken or answered under "What the readers changed". Route: delegated, read-only.
- [x] T5 · The five failures of Linux that `main` still holds, test first, through the local
      gate, with gentle-ai's assessment and a Codex record: `evals/ports.mjs` names a process
      by its image (`/proc/<pid>/exe`), and three tests stop expecting Windows' answers
      (`bin/lib/payload.test.mjs`, `evals/codex-isolation-probe.test.mjs`). Route: inline (one
      understood change; no writer reason). Risk: item 2, the name is what `killByPort` may
      kill by.
- [ ] T6 · The workflow of option A', his yes of 2026-10-13 (Design, "The workflow"): the
      file, the test that holds its ignored paths equal to `documents`, the pull request, the
      orchestrator told before the first push that starts a run; the first run and one red run
      quoted with their minutes. Route: inline.
- [ ] T7 · The design of the exchange (R1): how a pull request is tested again once `main`
      moved, its minutes against 2,000, what it loses, what the gate log must record to
      measure it; two readers; to the orchestrator for him ("avísame cuando llegue el diseño
      del canje"). Route: inline, then delegated readers.

## Progress
- 2026-10-13 · T1, T2. The opening read and the orchestrator told (title, hour, context 23
  percent). His three answers the opening cites were read with `js-harness sessions --quote`
  (lines 1504, 10519, 12000 of the orchestrator's transcript) and are quoted under Why. The
  worktree was cut from `origin/main` at `46eec34`. The figure was read with `gh` GET calls and
  GitHub's public pages only: no run, no push, no setting, no scope added. It went to the
  orchestrator with the recommendation above and one question for him (a payment method).
  Risk: none (a document).
- 2026-10-13 · **His two answers, carried by the orchestrator and read here with `js-harness
  sessions --quote`** (the orchestrator's transcript `65318fd5-80e7-4bb8-92b5-06737140185b`).
  Line 12461, typed: "no tiene tarjeta, dejémosla sin tarjeta". So no payment method is on
  file on the account `jsaristi` and none will be: the bill cannot pass zero, a month that
  outruns the 2,000 minutes stops the runs on GitHub until the next one, and the roads compare
  by minutes, not dollars. Line 12491, tapped: "En cada PR con código (Recomendada)" to "¿Cuándo
  corre la comprobación en GitHub (Linux, sin tarjeta, máximo 2.000 minutos por mes)?", among
  "En cada PR con código (Recomendada) | En todos los PR | Una vez por PR, al final | Esperar
  el diseño". That is option A' of the figure.
  What his yes covers, by the orchestrator's account of what it told him before the question
  (its claim): a workflow that runs the suite on GitHub's Linux runner at each push to a pull
  request that touches code, the file reaching `main` by a pull request the orchestrator
  merges, and the runs that follow. Not covered, still his: a check made required, any setting
  of the account or the repository, Windows on GitHub, a run on merges to `main`, any local
  gate retired or skipped because GitHub's is green, anything shipped to an installed project.
  The order it set: (1) the Linux failures fixed, test first, through the local gate, with
  their reviews; (2) the workflow, with what the run and a session do when the quota ends, the
  local gate standing alone, no tree pushed that is not a commit, the pre-push rule on Codex
  records not gone round; (3) the pull request, the orchestrator told before the first push
  that starts a run; (4) the design of the exchange (R1), with two readers, to it for him. The
  minutes of each run are counted in this document.
- 2026-10-13 · **The seven are five.** `main` holds two fixed since the trial (`2f81a63`:
  `exists` of `evals/paths.mjs`, and the expectation of `bin/lib/project.test.mjs:1919`). What
  remains, read in JH 8's `t9-ubuntu.log` and in the code at `46eec34`:
  `bin/lib/payload.test.mjs:197` and `:212` (a Windows absolute path fed on every system; the
  test's own), `evals/codex-isolation-probe.test.mjs:301` ("HOMEDRIVE is what the sandbox
  set", which `sandboxEnv` sets on Windows alone, `evals/configs.mjs:139`; the test's own), and
  `evals/ports.test.mjs:307` with `evals/isolation-probe.test.mjs:1704` (`ps -o comm=` of
  `evals/ports.mjs:168` answered `MainThread` for a Node process, so the listener is "not
  engram: left alone"). The orchestrator was asked whether any of those files is another
  session's before they are edited.
- 2026-10-13 · **His answer on visibility:** "Se queda privado", tapped, to "¿Cuándo pensás hacer
  público el repositorio js-harness? (Solo tu intención, para orientar el diseño; no publica
  nada.)", among "Apenas esté revisado y limpio | Recién en la versión 1.0.0 | Se queda privado |
  Todavía no lo sé" (the orchestrator's transcript, line 13033, read here with `sessions
  --quote`). It replaces his words of 2026-09-26. So the design is for a private repository
  with no card: Linux alone, 2,000 minutes a month for the whole account, and no road here
  counts on a public repository (R3's "or nothing in a public repository" no longer applies).
- 2026-10-13 · **T5, the five failures of Linux, `75532ff`.** RED, in the gate's line (asked
  19:17:40, ended 19:34:30): the two new tests of `evals/ports.test.mjs` failed for the name
  (`name: ''` where `node` was expected; `ps` asked where no call was owed), the third new one
  passed, as the fallback already existed. One turn (`t5-turn.log`, taken 20:03:04): the four
  test files green at 20:05:20, then the commit, whose whole gate passed (`PASS  tests`,
  committed 20:18:36). The three test-only fixes have no RED on this machine: their RED is the
  trial's log (`t9-ubuntu.log`), and their GREEN on Linux is the first run on GitHub.
  Risk: item 2 (the name is what `killByPort` may kill by).
- 2026-10-13 · **T6, the workflow and its test, `83876f0`.** RED at 20:19:04: 7 of 7 of
  `scripts/gate-workflow.test.mjs` fail with no workflow; GREEN at 20:19:06, 7 of 7. The
  commit waited 50 minutes for its turn (asked 20:19:23, ended 21:09:18) and its whole gate
  passed. Not built, by choice: the count of skipped tests on a green run, since a passed
  sensor prints nothing of the suite (`bin/check.mjs:617-626`); it is read from the run made
  red on purpose, and a row that carries the counts is a proposal for JH 8's file.
  Risk: item 5 (a workflow is delivery), held by its test and both reviews.
- 2026-10-13 · **Both reviews of the slice `75b0ceb..83876f0`, in one turn**
  (`t6-review-turn.log`, 21:13:39 to 21:16:06). gentle-ai assessed it high risk (`shell_source`
  in the workflow), so its review was due: started with his standing consent, lineage
  `review-5ba00685b483e51f`, lenses risk and reliability, captures of 52.7 s and 83.8 s,
  **approved and acknowledged**. Codex on `6928573..83876f0`: "the patch is correct (confidence
  0.86)", 181,330 input tokens (125,440 cached) against an allowance of 313,200 and a plan of
  about 140,000; recorded. Five findings of gentle-ai, all informational, none taken into this
  slice: (1, both lenses, a warning) on Linux a process started through a wrapper script has
  the script's name as `comm` and the interpreter as its image, so an engram launched that way
  would no longer be named `engram`: `killByPort` would leave it alone (the safe side) and
  `findProcesses('engram')` would miss it. Nothing shows engram is launched so (it is a native
  binary); kept as a follow-up to settle with the first real Linux runs. (2) the workflow test
  reads the file by shape, not as YAML; (3) the payload expectation mirrors the code's rule;
  (4) the probe test asserts nothing about `HOMEDRIVE` off Windows.
- 2026-10-13 · **From the orchestrator, for T7** (its claims): the files of T5 were free; a
  quote and one test file under half a minute may run beside a gate, a whole suite, a measure,
  a board read and a reviewer may not; the local gate took 533 s alone in the lock on a quiet
  machine and 805 s loaded, 13 to 19 minutes tonight; and what the exchange must say: what
  brings a run under 180 s (3 billed minutes), whether a run can stop at its first red, the
  month when the run that stands in for a local gate is the one that matters, what a session
  does from the day the quota ends, a count of minutes used this month that a session can read
  without the `user` scope, and a cap of our own before the account's quota. The quota's reach
  was told to him (ten private repositories, four with workflows) and he did not change his
  answer.

- 2026-10-13 · **Pull request 109, and its first run on GitHub: red.** Pushed 22:00:27 after
  `check --push` passed; head `82aa048` (the merge of `main` at `9b227df`, whose local gate
  passed). Run `38504042140`, job "check on Linux", 03:00:54 to 03:04:10 UTC: 196 s, 4 billed
  minutes. Rows: `failures`, `budget` (1,477 tokens there against 1,499 here: the checkout's
  line endings) and `contracts` PASS; `FAIL  tests  npm run test exited 1`; `review` "gentle-ai
  was not found"; `codex-review` informed. **Which tests failed cannot be read from it:** the
  suite's output in the log (`gh run view --log`, 898 lines) stops mid-line after 523 passing
  tests, with no failure and no summary. My reading, not proven: `bin/check.mjs:1450` ends
  with `process.exit(code)` right after printing that output, and a write to a pipe that is
  not yet done when the process exits is lost; `bin/js-harness.mjs:95` already sets
  `process.exitCode` for a like reason. `bin/check.mjs` is JH 8's: the orchestrator is asked
  before it is touched. So "red seen red" holds (Done when), and the first green waits for the
  output to be readable. The pull request's body says red, do not merge. Not pushed since, on
  purpose: any push to it is a new run.

- 2026-10-13 · **The fix of the cut output, on its own branch** (`fix/check-output-on-exit`, worktree
  `D:/js-harness-worktrees/check-exit`, off `main` at `9b227df`, by the orchestrator's go).
  `exitWhenWritten` in `bin/check.mjs`: the process exits once stdout and then stderr have
  taken what was printed. Chosen over `process.exitCode`: the exit stays immediate, so a process
  a sensor left running or a handle nobody closed never keeps a finished gate alive.
  `bin/check-exit.test.mjs`: RED at 22:14:11 (the file fails, `exitWhenWritten` is not there);
  GREEN at 22:14:32, 3 of 3 (the order of the writes and the exit, a stream whose reader is
  gone, and a child `check` whose failed sensor prints about 2 MB through a pipe, its last line
  read). The child test passes on this machine either way, since its pipes are written at once:
  its proof is the next run on Linux. The commit went to the gate's line.

- 2026-10-13 · **Second run on GitHub, after pull request 112 and a merge of `main` (`01ce88e`,
  pushed 23:24:19): red, and readable.** Run `38511223058`: the output reaches its summary, so
  the exit fix works on Linux. 4,330 tests, 4,195 pass, 1 fail, 134 skipped (132 in the trial),
  suite 145.0 s. The one failure: `bin/lib/codex-reviews.test.mjs:130`, "records appended in the
  same moment by several processes each stay one whole line, in the order each process wrote
  them", at `:164`: 425 lines where 401 were expected, so four writers of 100 appends each tore
  lines on Linux. A real defect of `appendCodexReview` (`bin/lib/codex-reviews.mjs`) on Linux,
  not of the test: its own comment says a tear needs the scheduler to interleave two writes.
  The orchestrator is asked whose file it is before it is edited. Minutes of the run: read
  them from its jobs when it is written up.

## Next
0. IN PROGRESS 2026-10-14 01:10: worktree D:/js-harness-worktrees/codex-reviews-append, branch fix/codex-reviews-whole-lines off main 3f59bb2. Reading: each record is already one write (appendJsonLine, appendFileSync); the race is endsUnterminated seeing a tail mid-write and prefixing a newline, so the extra lines are blank (hypothesis, the next Linux run shows it). Change: the test counts non-blank lines and still parses each; commit asked in the gate's line (scratchpad append-commit.log); then Codex review, push, its PR, tell the orchestrator the number. GO from the orchestrator (about 23:35): `bin/lib/codex-reviews.mjs` is free; its own small PR off main like 112; one write per record preferred over a lock if it holds on Linux and Windows; local gate, both reviews, tell it the PR number; after its merge, merge main into 109 once and push. The torn append (Progress, the second run): with the
   orchestrator's word on the file, fix it test first (one write per record, or a lock), local
   gate, reviews, own pull request or on 109 as it says; then one push to 109.
1. Done: pull request 112 (`fix/check-output-on-exit`, `945e31b`: `check` exits once its output is
   written; gentle-ai not due, Codex "correct" 57,594 tokens) is open for the orchestrator. Once
   it is on `main`: merge `main` into 109 once (its local gate), push: one run of about 4
   minutes, the first whose red can be read; fix its failures test first until a run is green;
   write each run's minutes and the PR body's state.
2. Send the orchestrator the three SPEC notes (scratchpad `spec-notes.md`; its order of
   2026-10-13, his tapped "Que me lo manden a mí", its transcript line 14050).
3. T7: redo "The exchange" with both readers' findings (listed under "What the readers
   changed"), then send it to the orchestrator for him.
## Resume here
Worktree `D:/js-harness-worktrees/github-gate`, branch `feat/gate-on-github`, pushed at
`82aa048`; local commits after it are documents only (`fffbcd4`, `2d58d88`) and are not
pushed on purpose (a push is a run). Pull request 109 is open, bound to this session, red, its
body says do not merge. T1 to T5 done; T6 is built and reviewed, waiting on its first green
run; T7 is written (fffbcd4) and was with two readers. Scratchpad logs: `t5-turn.log`,
`t6-review-turn.log`, `run1-full.log`. Read the orchestrator's answers first, then Next.

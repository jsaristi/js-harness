# The gate on GitHub: what a month costs, what it must prove, and the road he picks

Locator: `odd/tasks/gate-on-github.md` · Engram mirror: `odd/gate-on-github/tasks` · Branch:
`feat/gate-on-github`, in the linked worktree `D:/js-harness-worktrees/github-gate`, cut from
`origin/main` at `46eec34` · Session: `JH 10 · comprobación en GitHub`, orchestrator
`JH ORQ · js-harness` (app session `local_11c45a36-0115-4c92-b865-f1dc3f68c3c1`)

State 2026-10-13: opened by this session from the orchestrator's opening (`js-harness sessions
--opening "JH 10 · comprobación en GitHub"`). The figure is read and sent to the orchestrator;
nothing has run on GitHub, nothing is pushed, and no design is written yet. Only the
orchestrator asks him.

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
- Running the whole Windows suite less often than at every code commit: the trade he passed
  over on 2026-10-12 (`odd/tasks/gate-wait.md`, "What he already said").

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
build only if a local gate is retired in exchange for it; on Linux alone that exchange is the
trade he passed over on 2026-10-12, made smaller (`odd/tasks/gate-wait.md`, road 3). Which
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
read 2026-10-13: every commit the pre-commit and pre-merge-commit hooks gate with the suite).

| Local gate | 14 days | Last 24 hours | A Linux run in its place loses |
|---|---|---|---|
| A commit with code | 290 | 33 | Windows for that commit: the trade he passed over on 2026-10-12 |
| A merge of `main` into a branch (`.githooks/pre-merge-commit`) | 62 | 14 | Windows for the combination of two trees, each proven on Windows by itself |
| A commit of Markdown alone (no suite, no lock) | 335 | 57 | nothing: no suite runs for it today |

- **R0 · In place of nothing.** A second witness on every pull request with code. It frees no
  minute of the lock. No trade; the spend of option A' (zero in a normal month).
- **R1 · In place of the gate of a merge of `main`.** At most 62 of 352 whole gates in 14 days
  (17.6 percent; 14 of 47 in the last 24 hours), about ten minutes of lock each. A session no
  longer merges `main` into its branch to be read: the run on GitHub tests the head merged
  with `main`, and when `main` moved after it the pull request is run again against the new
  `main` (the branch updated on GitHub's side, or a run asked for by hand: a choice for the
  build). A merge with a conflict is still made and gated on his machine. What is lost: the
  combination is proven on Linux alone. It is his, as a smaller form of the trade; it also
  changes the orchestrator's rule that a pull request is read only when its head contains
  `main`, which is the orchestrator's to change.
- **R2 · In place of the gate of a commit with code.** The trade he passed over, whole. His;
  not proposed here.
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
- `on: pull_request` (opened, synchronize, reopened), with the paths of Markdown ignored: a
  branch pushed with no pull request spends nothing, and neither does a change of documents.
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

**Mine.** R0 now, on option A': it costs nothing in a normal month, it is the only Linux the
product has, and it is the ground for R1. R1 is brought to him as its own question with the
count above, once two weeks of runs say how often GitHub was red where his machine was green
and the reverse. Said plainly, since the opening calls this the thing that raises the ceiling:
on Linux alone and with no trade it frees nothing; with R1 it frees at most about a sixth of
the whole gates; the rest of the line is commits with code, and only the trade he passed over
or a paid or public Windows takes those off the machine.

## What the readers changed
Nothing yet: the readers (T4) have not read the design.

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
- [ ] T4 · Two independent readers attack the design (opus, effort high); their findings
      taken or answered under "What the readers changed". Route: delegated, read-only.
- [ ] T5 · The fixes that make the suite pass on Linux, the ones T3 names, test first, each
      through the local gate. Route: set in T3.
- [ ] T6 · After his yes on a road: build it; gentle-ai's assessment and a Codex record for
      each slice with code; a pull request for the orchestrator. Route: set after his answer.

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

## Next
T3, which no answer of his can undo: read the 7 Linux failures in JH 8's logs and in the
code, list what `check` does beyond the suite, and write the design; then T4.

## Resume here
Worktree `D:/js-harness-worktrees/github-gate`, branch `feat/gate-on-github`. T1 and T2 are
done; the figure is with the orchestrator and his answer has not come back. Nothing runs on
GitHub until it does. Start T3.

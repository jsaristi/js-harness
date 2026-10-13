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

## What the readers changed
Nothing yet: the design (T3) is not written.

## Tasks
- [x] T1 · This document, opened with the task contract, on its own branch and worktree,
      mirrored in engram. Route: inline. Evidence: the commit that adds it.
- [x] T2 · The figure: plan, prices, rounding, runs a month, the table of options and the
      roads that cost nothing, each read at its source; sent to the orchestrator with a
      recommendation. Route: inline, no source written. Evidence: "The figure"; Progress.
- [ ] T3 · The design of what a run on GitHub must prove to stand in for a local check: the
      suite's 7 Linux failures and their causes, what `check` does beyond `npm test` (the
      contracts, the token budget, the review rows), what a required check on `main` would
      change for the orchestrator's merge; with a search of his earlier words. Route: inline.
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

## Next
T3, which no answer of his can undo: read the 7 Linux failures in JH 8's logs and in the
code, list what `check` does beyond the suite, and write the design; then T4.

## Resume here
Worktree `D:/js-harness-worktrees/github-gate`, branch `feat/gate-on-github`. T1 and T2 are
done; the figure is with the orchestrator and his answer has not come back. Nothing runs on
GitHub until it does. Start T3.

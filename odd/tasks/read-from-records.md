# Read from the records: a Codex plan that learns from its runs, and the pace of the plan by day

Locator: `odd/tasks/read-from-records.md` · Engram mirror: `odd/read-from-records/tasks` · Branch:
`feat/read-from-records`, in the linked worktree `D:/js-harness-worktrees/read-from-records`, cut
from `origin/main` at `9546fb7` · Session: `JH 10 · comprobación en GitHub`, orchestrator
`JH ORQ · js-harness` · Delivery: `ask-on-risk` · Test runner: `node --test`

State 2026-10-14: opened by this session on the orchestrator's word (two unassigned items of
`docs/todo.md`, one document for both, design first). No gate turn until JH 8's WSL gate is on
`main`; `bin/codex-review.mjs` is being changed by JH 12 (its flag parser), so `main` is merged in
before any gate of a change there. Only the orchestrator asks him.

## Goal
`codex-review --plan` estimates a review from what the reviews it recorded actually cost, and says
how close its estimates have come. `js-harness progress` prints the tasks closed and added each day.

## Why
The plan is what the Codex allowance is judged on, and it runs low. JH 5's review was planned at
435,000 input tokens and took 999,502 (`docs/todo.md:31`); a one-part review of 10 changed lines
was planned at 24,206 and took 76,082. A plan that low tells him nothing about the spend he
approved by rate. The pace of the plan is counted by hand from the git history of checked boxes
(`docs/todo.md:47`); an estimate of when a phase ends should be read, not made.

## Done when
- `node --test bin/lib/codex-review-plan.test.mjs bin/codex-review.test.mjs bin/lib/codex-review-runs.test.mjs` exits 0
- `node --test bin/lib/progress.test.mjs bin/progress.test.mjs` exits 0
- `npm run check` exits 0
- `node bin/js-harness.mjs codex-review --base origin/main --plan` prints the estimate and one line on how the method did on the reviews this machine recorded
- `node bin/js-harness.mjs progress --pace` prints, for each of the last days, the tasks closed and added on `main`

## In scope / Out of scope
- In: `bin/lib/codex-review-plan.mjs`, `bin/lib/codex-review-runs.mjs`, the plan's lines in `bin/codex-review.mjs`, `bin/progress.mjs`, `bin/lib/progress.mjs`, their tests, help texts and docs.
- Out: the allowance (its floor, rate and margin are his, in the rules file); `bin/codex-review.mjs`'s flag parser (JH 12's); the review records' format.

## Constraints
- Zero dependencies — because `bin/` runs in any host without an install step.
- `progress` starts at most two git processes, each with a time limit — because the repository counts git processes (`bin/lib/codex-review-coverage.mjs:61`) and `progress` starts none today.
- A run log written before this change still reads, and its lines are still measured — because 298 lines on this machine are the only evidence the estimator has.

## Effort
high

## Ask me before
Spend outside the Codex plan's allowance; changing the allowance; anything on GitHub that starts a run outside a pull request.

## Design (first version, before its readers)

### (a) The estimate, from what parts cost

**What is wrong today** (the explorer's map, 2026-10-14; `bin/lib/codex-review-plan.mjs:108-128`).
A part's estimate is `max(floor, changedLines × median cost a changed line)`, in two bands split
at 400 changed lines, and the floor is the cheapest part ever measured (24,206). It has no fixed
cost per part, and a part has one. A straight-line fit over the 261 measured parts on this
machine gives about 191,500 input tokens a part plus about 175 a changed line. The first request
of every part is about 7,600, so most of a part's cost is the session reading code, whatever the
part's size. So small parts come out far too low (part 5 of JH 5's review: 55 lines, planned
24,206, took 132,324), and splitting a range into parts multiplies a cost the plan never counts.
Replayed on the log as it stood before each, the last seven reviews came out between 0.15 and 1.35
times their cost. A review of 557 lines in 2 parts: 281,079 planned, 718,613 taken.

**S1, the model.** A part's estimate is a fixed cost plus a cost a changed line, both fitted by
least squares on the measured parts of the same model and effort (all measured parts when fewer
than 5 are of that pair, as today). A negative fitted cost a line is taken as 0, and the fixed
cost then the median part. No bands, and no floor at the cheapest part. Ranges are still split
at 400 changed lines a part, so each part pays its fixed cost.

**S2, the high figure.** Today it prices each part at the highest cost a changed line ever seen,
and overshoots 2 to 7 times. It becomes the estimate times the 90th percentile of what measured
parts cost over what the model says they should: a figure about one review in ten exceeds.

**S3, how the method did, printed.** The plan prints one line: on the last ten reviews this
machine recorded, the method (S1, replayed on the log as it stood before each review) estimated
between `x` and `y` times what they took, with the median. That line is the evidence the plan
learns from its records; it costs no request.

**S4, the plan recorded.** Each run line of a reviewed part records the estimate it was planned
at (an optional field, so old lines still read). Later, S3 reads the recorded figure in place of
a replay, which is what the method then was, not what it is now. Open: whether the run log's
readers accept a field they do not know (to read in T4 before the field is added).

**What it changes for his allowance.** Nothing in the allowance: its floor of 300,000, its rate
of 1,200 a changed line and its 5 percent margin stay. The estimate it is judged against rises:
by the fit, a 6-line review is about 192,000 (inside 300,000), JH 5's 1,207 lines in 5 parts
about 1,170,000 (inside its 1,448,400), and 557 lines in 2 parts about 480,000 (inside 668,400).
More reviews may come out over it than today, and each of those is asked of him, as today.

### (b) The pace, read from `main`'s history

**S5, the command.** `js-harness progress --pace [--days <n>]` prints, for each of the last `n`
days (14 by default), the tasks closed, the tasks added and the tasks removed on the first-parent
line of `HEAD`, by the day of the commit in this machine's time zone; then the totals and a
mean a day. `--json` carries the same days. Without `--pace`, `progress` prints what it prints
today and starts no git process.

**S6, how it reads.** Two git processes: one `git log --first-parent --format=<commit, date>
--raw` over `docs/ROADMAP.md` and `odd/tasks/*.md`, for the blob of each file at each commit,
and one `git cat-file --batch` for those blobs. Each blob is parsed by the parser `progress`
uses now (`bin/lib/progress.mjs`), so code fences and the roadmap's `## Checklist` section count
as they count today. Between one commit and the one before, in one file, a task whose text was
open and is now checked is closed; a task text that is new is added; one that is gone is
removed; one checked and now open is reopened. A task reworded is one removed and one added; it
is said so in the help, not guessed at.

**Why `main`'s first parent.** It is the day the work landed, and the line `progress` already
counts from. 116 of the 692 commits that touch `odd/tasks` are on it; a feature branch's own
commits would count the same task once on the branch and again in its merge.

## Tasks
- [ ] T1 · This document, opened with the task contract, mirrored in engram. Route: inline.
- [ ] T2 · Two readers attack the design (opus, high, read-only); what they changed written
      under the design; the design to the orchestrator. Route: delegated, read-only.
- [ ] T3 · S1 to S3 test first: the fitted estimate, the high figure, the line on how the method
      did. Route: inline. Risk to name at its close.
- [ ] T4 · S4: the plan recorded in the run log, once its readers are read. Route: inline.
- [ ] T5 · S5 and S6 test first: `progress --pace`. Route: inline.

## Progress
- 2026-10-14 · Opened. The explorer's map (read-only, 2026-10-14) is the source of "What is
  wrong today" and S6's reading of the history; one spot check: `inputEstimator` at
  `bin/lib/codex-review-plan.mjs:108-128` is as it said.

## Next
1. T2: two readers on the design, then the design to the orchestrator.

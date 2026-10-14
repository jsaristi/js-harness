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

## The recheck: a correction is checked against its findings, once (first in the queue)

His order, typed (orchestrator transcript `ffe99ebf`, line 3607, 08:21:33Z, read with `sessions
--quote`): "lo de que codex entrega bordes cada vez mas finos corrgielo ya". The defect: each
Codex review of a correction finds a new, smaller edge, and each round costs a fix, a gate turn
and a review (JH 8, PR 121, a third round on one timeout mark). The rule, one correction batch
and one recheck limited to those findings, is prose, so it is lost under momentum.

What the code holds today (explorer's map, 2026-10-14): the verdict never sets the exit code
(`bin/codex-review.mjs:1701`, test `codex-review.test.mjs:2388-2414`); a review record holds no
findings and a run line only their counts; finding texts survive only in `kept.review` of a
multi-part review's part (`:1410`, `:1581`); a record with an outcome other than `reviewed`,
`unavailable` or `nothing-to-review` covers nothing and fails the push (`codex-reviews.test.mjs:335`).

- **S7, findings kept.** Every run line has `answer`: for a review that stands, its normalized
  findings (file, lines, severity, title and body) and its verdict; `null` otherwise. Old lines
  without it still read. A review recorded before this change is rechecked only when it was made
  in parts, whose parts kept their answers in `kept.review`; any other is reviewed as today.
- **S8, when a review is a recheck.** Decided by the code, not by a flag, so momentum cannot skip
  it: after the range's start is moved past what records cover (`startingAt`), it is the head of
  a `reviewed` record, or only documents changed between that head and it (a feature document
  committed before the fix does not move it); and that review owed a correction: a verdict of
  `incorrect`, or a finding of P0 to P2. A review that called the patch correct with only P3
  findings leaves the next range a review. A recheck is reviewed in one part; a correction over
  one part's bound is refused before it runs, exit 1, nothing recorded, with a message to commit
  the correction alone or record a follow-up task. `--plan` says when a run would be a recheck or
  refused.
- **S9, its prompt.** It lists each prior finding (file, lines, title, body) and asks, for each,
  whether the range fixes it. Its answer, in Codex's own rubric: a finding titled `[not fixed]`
  for each prior finding still open; anything new titled `[follow-up]`, which does not block;
  except a new finding that could make a failing check pass, or that exposes data, titled
  `[blocks]`. Its own prompt version.
- **S10, its record.** `outcome` stays `reviewed`, so the commits are covered and the pre-push
  hook needs no change. The record gains `recheckOf: <the prior head>`; the run line gains
  `recheck: {of, findings, fixed, notFixed, followUps, blocking}`. The command prints one line a
  prior finding (fixed or not), then the follow-ups apart, marked as not blocking. The exit code
  stays as today.
- **S11, no second recheck.** Refused before it runs, exit 1, nothing recorded, with what to
  record instead (a follow-up task, then `codex-review --base <base> --unavailable "second recheck
  refused: <task>"`): a range that starts at the head of a recheck that left a finding not fixed,
  blocking or unmarked (documents after it do not move it); and a range that starts at the head of
  a review whose findings were already rechecked, whatever that recheck left (`--again`
  included). A recheck that fixed every finding and blocks nothing leaves the next range a review.
  A finding the answer does not mark is taken as open, never as fixed; the marks are read in any
  case, with or without brackets or emphasis. Each earlier finding is printed with `fixed`, `not
  fixed` (the answer gives its number) or `not said`.
- **Its limit, named.** New code committed in the same range as a correction is read as a
  follow-up, not as a review; only `[blocks]` stops it. A session that wants new work reviewed
  fully commits the correction first.
- Touches no flag (`parseArgs`, `:223-280`, is JH 12's), so JH 12 is told which lines move:
  the flow after `startingAt` (`:1198-1290`), `logRun` (`:1527-1599`), the record (`:1815-1827`);
  the rest is a new `bin/lib/codex-review-recheck.mjs`.

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
- [x] T0 · S7 to S11, the recheck, test first, its own pull request; his order of 2026-10-14,
      first in the queue. Route: inline (one understood change; no writer reason). Risk to name
      at its close.
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

- 2026-10-14 · T2's two readers returned (reader A on the numbers and the model, reader B on the
  gaps); their findings are not yet taken into the design (scratchpad `rfr-reader-a.md`,
  `rfr-reader-b.md`; to be written under the design when (a) and (b) resume). Headlines: least
  squares on the last 20 measured parts of the pair is the best replayed method (median absolute
  log error 0.27 against today's 0.45); `progress --pace` must count a task that arrives checked in
  a merge as added and closed, and match tasks by their `T#` ID.
- 2026-10-14 · **T0, the recheck, built.** RED first in `codex-review`: the 4 tests of S7, S8, S10
  and S11 failed before the change, the fifth (the next range after a recheck that closed
  everything) held already. The module `bin/lib/codex-review-recheck.mjs` was written before its
  own 8 tests, which then passed: not test first for that file. GREEN: 436 of 436 in
  `bin/codex-review.test.mjs`, `bin/codex-review.second.test.mjs`, `bin/lib/codex-review-recheck.test.mjs`,
  `bin/lib/codex-reviews.test.mjs`, `bin/lib/codex-review-runs.test.mjs`, `bin/check-codex-reviews.test.mjs`.
  Three old tests changed with it: every run line now has `answer` (`null` when there is no answer),
  and the run log is read once for the plan and the recheck. JH 12 was told the lines; its parser
  hunks do not overlap. An independent verifier is reading it. No gate turn yet: JH 8's WSL gate
  (PR 121) is still open.

- 2026-10-14 · **T0, the verifier and one correction.** The independent verifier (opus, high,
  probes in a scratch copy) found five blockers:
  1. a document committed between the reviewed head and the fix moved the start, so no recheck ran;
  2. `--again` from the original head ran a second recheck;
  3. a document committed after an open recheck dodged the refusal and started a full review;
  4. a title without a mark counted as fixed;
  5. the fixed findings were never listed.

  One correction batch fixed all five. It also took two of the verifier's advisories: a review
  that called the patch correct with only P3 findings owes no recheck, and `--plan` says when a
  run would be a recheck or refused. S7, S8 and S11 were rewritten to match. The verifier's one
  recheck, limited to those five, found all fixed. Its advisory (the fixed count disagreed with
  the list when no number was given) was taken: a finding counts as fixed only when the list says
  so, and "not said" is counted on the line. Tests: 445 of 445 in the codex-review files before
  that last change, then 12 of 12 unit and 10 of 10 recheck tests after it.

- 2026-10-14 · **T0 committed and reviewed.** `10e30e1` passed the gate; gentle-ai rated it
  medium, review not due (under budget). Risk, by this session: item 2, since it decides when a
  Codex review reads less, which is why the verifier ran. `main` was merged once (`24cb517`; the
  gate's tests ran in WSL2). Codex reviewed `8aa93c3..24cb517` in 2 parts: 466,240 input tokens
  against a plan of 460,000 and an allowance of 847,200. It found three P2s, two defects:
  - the recheck prompt kept the review prompt's "report nothing of code the diff leaves as it
    was", so an open finding on untouched lines could go unreported and count as fixed;
  - "follow-up" read anywhere in a title made an ordinary title a follow-up.

  One correction, test first (RED in 2 unit tests): the prompt now says that rule does not hold
  for the earlier findings; a follow-up or blocking mark counts only in brackets or as the title's
  first word. Its review is the first real recheck: a range that starts at `24cb517`.

- 2026-10-14 · **T0 done: the first real recheck, and pull request 128.** `ab1073d` (the
  correction) passed the gate (tests in WSL2); gentle-ai rated it medium, review not due. Its
  `--plan` said "A run of this range is a recheck of the 3 findings of the review that ended at
  24cb517", and the run, through this very code, answered "3 fixed, 0 not fixed", verdict
  correct (0.98), at 91,800 input tokens. Pushed; pull request 128 is open for the orchestrator.
  `main` moved after the merge (`2a29285`, code), so the head does not hold it; the orchestrator
  was asked whether to merge it once more.

## Next
0. T0: the orchestrator's word (05:43): wait for PR 124 to be MERGED, then merge `origin/main` once, gate, push, tell it.
1. T2: take both readers' findings into the design, then the design to the orchestrator.

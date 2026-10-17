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

## Design (second version, after its two readers; 2026-10-14)

### (a) The estimate, from what parts cost

**What is wrong today** (the explorer's map and reader A's replay, 2026-10-14;
`bin/lib/codex-review-plan.mjs:108-128`). Today a part's estimate is `max(floor, changedLines ×
median cost a changed line)`:
- two bands, split at 400 changed lines;
- the floor is the cheapest part ever measured (24,206);
- no fixed cost per part.

A part has a fixed cost, though. Fitted on this machine's run log:
- high effort: about 190,000 input tokens a part plus 328 a changed line (179 parts);
- medium effort: about 122,000 plus 78 (80 parts).

About three quarters of that fixed cost is cached context sent again with each request (cached
share median 0.75; median 7 requests a part). It follows the session's requests, not the size of
the part.

Replayed on the log as it stood before each of 101 reviews, the actual cost over today's estimate
is:
- all 101 reviews: median 1.43, p10–p90 0.76–3.03;
- the last 20: median 2.48, p10–p90 1.11–5.47.

Medium-effort parts from prompt v1 (2026-10-08) cost about half what v3 parts cost, and the pair
rule keeps them in every basis.

**S1, the model.** A part's estimate is a fixed cost plus a cost a changed line, fitted by least
squares on the **most recent 20 measured parts** of the review's model and effort (all measured
parts, most recent 20, when fewer than 5 are of that pair). Replayed on all 101 reviews, it comes
to a median of 1.01 (p10–p90 0.58–1.52) and a median absolute log error of 0.27, against 0.45
today. The window follows a change of prompt or effort without the code having to know which
fields mark one. Its edges:
- when the parts' changed lines do not vary, or fewer than 2 parts are measured, the fixed cost
  is the median part and the cost a line is 0;
- a fitted cost a line below 0 is taken as 0, with the fixed cost refitted as the median part;
- a fixed cost below 0 is taken as 0.

No bands, and no floor at the cheapest part. Ranges are still split at 400 changed lines a part,
so each part pays its fixed cost.

**S2, the high figure.** The estimate times the 90th percentile of what the window's parts cost
over what the model says they should. In replay, 12 of 101 reviews went over it (13 percent of
parts), against 10 of 101 for today's high figure. It stands at a median of 1.80 times the actual
cost, where today's stands at 3.21.

**S3, how the method did, printed.** One line:
- what it says: on the last ten reviews this machine recorded, the method's estimate came to
  between `x` and `y` times what each took, with the median;
- how it is measured: per part, against that part's own run line;
- what is grouped: the run lines a review record names (`run`, `runs`), since the run log has no
  review id and parallel parts write out of order;
- what is left out: kept parts (they cost nothing in that run) and failed attempts (no record);
- in a project with no review recorded yet: "no reviews recorded yet".

**S4, the plan recorded.** Each run line of a part records the estimate and the high figure it
was planned at, with the method's version (`plan: { estimate, high, method }`). The figures come
from `plan.parts[i]` and are passed into `logRun`, since `attempt()` gets only `part` today. Run
log readers keep any JSON object (`bin/lib/codex-reviews.mjs:92-97`), so the field is safe; the
schema stays `v1`, as it did through five additions. S3 reads the recorded figure once lines hold
it; before that, a replay. `--plan` records nothing.

**What it changes for his allowance.** Nothing in the allowance itself: its floor of 300,000, its
rate of 1,200 a changed line and its 5 percent margin all stay. The estimate it is judged against
rises:

| Review | Model | Estimate |
|---|---|---|
| 6-line review | medium fit | about 122,000 |
| 6-line review | high fit | about 192,000 |
| JH 5's 1,207 lines in 5 parts | medium | about 702,000 |
| JH 5's 1,207 lines in 5 parts | high | about 1,347,000 |
| 557 lines in 2 parts | medium | about 287,000 |
| 557 lines in 2 parts | high | about 563,000 |

Each is inside its allowance (1,448,400 and 668,400). More reviews may come out over it than
today, and each of those is asked of him, as today.

### (b) The pace, read from the default branch's history

**S5, the command.** `js-harness progress --pace [--days <n>]`:
- what it prints: for each of the last `n` days (14 by default, an integer of at least 1), the
  tasks closed, added and removed, then the totals and a mean a day;
- where it reads: the first-parent line of the default branch (from `origin/HEAD`, else `main`,
  else `HEAD`), named on the first line;
- how a day is cut: by the committer date (`%cI`) in this machine's time zone, which tests inject
  with the clock;
- gaps: a day with no commit prints 0, and today is marked as partial;
- `--pace --json`: a shape of its own; `--json` alone and the parser's output do not change
  (`bin/lib/sessions.mjs:7` imports the parser);
- without `--pace`, `progress` starts no git process, as today;
- outside a git repository, `--pace` exits 1 with one line;
- the help (`bin/progress.mjs:11`) and the AGENTS block that `bin/lib/manifest.mjs:61` writes name
  `--pace`.

**S6, how it reads.** Two git processes, each with a time limit and a buffer for megabytes.

The first is `git log --first-parent --diff-merges=first-parent --no-renames --no-abbrev --raw -z
--since=<window> --format=<id, date>` over `docs/ROADMAP.md` and `:(glob)odd/tasks/*.md`. It gives
each changed file's old and new blob. The window's first change gives the starting state through
its old blob. On this repository, all of history comes to 216 blobs, 16.4 MB, 283 ms of `cat-file`
and 759 ms of parsing.

The second is `git cat-file --batch`, for those blobs. Each is parsed by the parser `progress` uses
now: the roadmap's `## Checklist` steps flattened out of its phases, with code fences counted as
today. Steps are compared per commit, across all the files it changed.

What each change counts as:
- **Closed:** a task open before and checked now. A task that is new and already checked counts as
  added and closed. On `main`, 119 of 136 first-parent commits are merges, and most tasks arrive
  checked inside one; reading only flips would see about a quarter of the closes.
- **Matched:** a task is matched by its leading ID (`T3`, `T5b`, with or without `**`) when both
  sides have one, and otherwise by its exact text. 23 percent of the flips on `main` reworded the
  task's first line in the same commit, and every one kept its ID.
- **Reopened:** a task checked before and open now.
- **Removed:** a task that is gone.
- **Reworded or moved:** a roadmap item reworded as it is checked, and a moved file, count as
  removed and added; the help says so.
- **Shallow clones:** a commit with no parent is the start of the history, never a day of added
  work.

### What its two readers changed
- Reader A (the numbers and the model, by replay of the run log) moved S1 to the most recent 20 parts of the pair and gave its edge cases; corrected the allowance figures, which had used a fit mixing both efforts; measured S2; showed the fixed cost is cached context resent each request; and gave S3 its grouping by the review records.
- Reader B (what the design left out) found that tasks mostly arrive checked in merges, that tasks must be matched by their ID, which branch is read, the git flags merges and paths need, the size of the history and its buffer, the window that spares reading it all, the parser's other reader, the help and the AGENTS block, and the per-part comparison S3 and S4 need.

## Tasks
- [x] T0 · S7 to S11, the recheck, test first, its own pull request; his order of 2026-10-14,
      first in the queue. Route: inline (one understood change; no writer reason). Risk to name
      at its close.
- [x] T1 · This document, opened with the task contract, mirrored in engram. Route: inline.
      Done: the document and its design, `0eaf5d0`.
- [x] T2 · Two readers attack the design (opus, high, read-only); what they changed written
      under the design; the design to the orchestrator. Route: delegated, read-only. Done: "What
      its two readers changed", `0eaf5d0`.
- [x] T3 · S1 to S3 test first: the fitted estimate, the high figure, the line on how the method
      did. Route: inline. Risk: none (see Progress, 2026-10-16). Commits `f66a822`, `e23892b` (S1,
      S2) and `44cbf2e` (S3) on `feat/plan-from-records` after the merge of `main`; PR 286.
- [x] T4 · S4: the plan recorded in the run log, once its readers are read. Route: inline.
      Risk: none (see Progress, 2026-10-16, T4). Commit `2327a0c`, PR 289 (merged).
- [x] T5 · S5 and S6 test first: `progress --pace`. Route: inline.
      Risk: none (see Progress, 2026-10-16, T5). Commits `8829caa`, `27b297b` (the Codex fix), PR 292.
- [x] T6 · A defect of T0 (L8 of odd/tasks/merge-queue.md): a range from the head of a rechecked
      review was refused as a second recheck even on a branch that forked there, without the recheck
      and its correction. Route: inline, branch fix/recheck-fork (PR 170, merged). See Progress,
      2026-10-14, T6; closed 2026-10-15 by his answer: no guard of its own for an amended correction.

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
1. Nothing: T0 to T6 are done. PRs 286 (T3) and 289 (T4) are merged; 292 (T5) waits to land.

- 2026-10-14 · **T6, a fork at a rechecked head.** Found by JH 10 on feat/merge-queue (forked at
  e61ae6a, whose findings 8ccd689 rechecked): its own review was refused as "a second recheck".
  `recheckState` now takes `holds`, whether the range's head holds a commit (`merge-base
  --is-ancestor`, exit 1 a no, anything else unknown), and refuses from a rechecked head only when the
  head holds that recheck's head, or git cannot say; a fork before the recheck is a review as any
  other. RED then GREEN: one test in bin/lib/codex-review-recheck.test.mjs (holds true, false, null)
  and one by the command in bin/codex-review.test.mjs; the recheck tests 19 of 19, the refusals of
  the same line unchanged. Codex: b51b245..ab913c9 correct (0.92), 137,933 input tokens. An
  independent verifier (a guard is loosened: risk item 2) found no blocker; both new tests fail on
  b51b245; the tests now also hold `received === null`, the run line, and that `holds` is not asked
  from the recheck's own head. Open for Sebastián, through the orchestrator: a correction amended
  after its recheck (`reset --hard` to the reviewed head, another fix) now gets a plain review from
  that head where it was refused before, since ancestry cannot tell it from a fork; findings are still
  rechecked once and stay in the run log. Whether that needs a guard of its own (the files the old
  findings name, say) is his decision.
- 2026-10-15 · **T6 closed by his answer.** Asked by the orchestrator whether that case gets a guard
  of its own, he tapped "No, alcanza con la revisión común (Recomendada)" (the orchestrator's
  transcript `c47efdf7`, line 3804, 2026-10-15T05:04:10Z, read with `sessions --quote`). So a
  correction amended after its recheck keeps the plain review PR 170 gives it, and nothing more is
  built for it.

- 2026-10-16 · **T1 and T2 ticked, T3 built (JH 22).** T1 and T2 were done in substance by
  `0eaf5d0` (the document and the design after its two readers). T3 sits on
  `feat/plan-from-records` in the worktree `D:/js-harness-worktrees/plan-from-records`: S1 and S2
  were already committed (`f66a822`, `e23892b`); a merge of `main` begun at 03:01 and left with one
  conflict was aborted and made again on `origin/main` `6a6ce9e` (the conflict: `main` renamed the
  fixtures' model to `gpt-fixture`, `41ee91f`; the branch's expectations were kept with that name).
  S3, test first: RED by the missing export, then 3 unit tests (`methodRecord`, `methodRecordLine`)
  and one by the command (`--plan` without records, then with one review), which failed before the
  line was printed. Decisions the design left open:
  - "between x and y" is the least and the most of the last ten reviews' estimate over what they
    took, with the median;
  - a kept part is told by its line: a run line an earlier record named is kept, and left out; a
    part kept from a run that recorded nothing is counted once, by the first record that names it;
  - a review is measured on its measured parts that had an estimate (a measured line before them);
  - the line is printed by `--plan` alone, after the estimate and before the recheck, allowance and
    flag lines, and not for a plan of no part.
  Nine tests of the command and two of the allowance that read `--plan`'s whole output or its last
  lines gained the line, and the two usage tests its new words. On this machine's records: "on the last 10 reviews this machine recorded, its
  estimate came to between 0.54 and 2.65 times what each took, 1.38 at the median". Risk: none (no
  high-risk item: `--plan` output gains one line, no flag, record or format changes).
  Gate PASS on `fa8e650` and `44cbf2e`; gentle-ai on 6a6ce9e..44cbf2e medium, not due
  (under_budget, 672 lines); Codex correct (0.86, 0.93), 350,983 input tokens against a plan of
  300,000 to 420,000. PR 286.
- 2026-10-16 · **T4 built (JH 22), on `feat/plan-from-records` above T3.** Its readers were read
  first: `readCodexReviewRuns` and the review records keep any JSON object
  (`bin/lib/codex-reviews.mjs:92-97`), and no reader of the run log (`check`, the recheck, the
  kept parts, the plan) looks at a field it does not know, so `plan` needs no new schema. Test
  first: RED by the missing exports and by the run line without `plan`, then GREEN. Decisions:
  - `PLAN_METHOD` is 2: the fit of S1; 1 names the median method it replaced, whose lines hold no
    plan;
  - each part of `reviewPlan` now holds its own `inputTokensHigh`, and the whole's is their sum;
  - `partPlanned(plan, index)` gives `{ estimate, high, method }`, or `null` when the plan had no
    estimate, and then the line has no `plan` field;
  - a range reviewed whole records its plan too, as the one part of its plan, though its line has
    no `part` and so is in no basis: the figure is still what it was planned at;
  - `methodRecord` reads `plan.estimate` when `plan.method` is this method's and the estimate is a
    number, and replays otherwise.
  Tests: two unit tests and one by the command (two parts unplanned, then planned at 300,000
  each, `--plan` writing nothing, a whole range recording its plan); the "one figure" keys test
  gained the field. Risk: none (an added optional field in the run log, read by nothing that
  could misread it; the schema stays `v1`, as through five additions).
- 2026-10-16 · **T5 built (JH 22), on `feat/progress-pace` off `main` (PR 292).** Test first: RED
  by the missing module, then by the four `--pace` tests of the command; GREEN. Decisions and the
  one change of design:
  - **One git log instead of log plus cat-file.** `git log -p -U100000` gives every changed file
    whole, before and after each commit, so the design's second process (`cat-file --batch` for
    the blobs of `--raw`) is not needed; the two processes are `for-each-ref` (the branch) and
    that log. Each has a 30 s limit and a 256 MiB buffer. A file of more than 100,000 lines would
    lose its far lines.
  - The branch: what `refs/remotes/origin/HEAD` points at, else `refs/heads/main`, else `HEAD`,
    named on the first line.
  - Matching is per file: a task by its leading ID (`T3`, `T5b`, bold or not) when both sides have
    one, in order, and otherwise by its exact text. So a moved file counts its tasks as removed
    and added, as S6 says.
  - Reopened is printed beside closed, added and removed, each day and in the totals.
  - `--relative`, so a `--cwd` below the top of the repository reads its own paths.
  - A change git writes no `---`/`+++` header for (a mode alone, an empty file born or gone) is no
    file of the commit. It was Codex's one finding on 8829caa (P2, 0.99), fixed in 27b297b and
    rechecked fixed.
  On this repository the whole history closes 511 tasks, the 511 the map counts as done today.
  Gate PASS on `8829caa` and `27b297b`; gentle-ai on aac0024..27b297b medium, not due
  (under_budget, 656 lines); Codex 284,946 input tokens, then 47,206 for the recheck. Risk: none
  (a new flag on a read-only command; no existing output, flag or format changes).

## Resume here
Every task is done: T3 in PR 286 (f66a822, e23892b, 44cbf2e), T4 in PR 289 (2327a0c), both merged; T5 in PR 292 (8829caa, 27b297b) on feat/progress-pace, in the worktree D:/js-harness-worktrees/plan-from-records. Once 292 lands the feature is closed.

# Codex review: one model, and a cost that is seen before it is spent

Locator: `odd/tasks/codex-review-cost.md` · Engram mirror: `odd/codex-review-cost/tasks` · Branch:
`feat/codex-review-cost`, cut from `feat/codex-review-lean` at `5663c8c`, in the linked worktree
`D:\js-harness-worktrees\codex-review-lean`

## Goal
A Codex review runs only on `gpt-6.1-sol` at `high`, covers only code, is never paid twice, and
shows what it will cost before it spends it.

## Why
`odd/tasks/codex-review-lean.md` closed with fifty Codex reviews and 6.12 million input tokens.
Sebastián asked why (2026-10-08), and the answer, from the run logs, was that more than half of it
was avoidable:
- Three reviews ran on `gpt-6-astra` at `low`, because the `current` session runs on whatever his
  `~/.codex/config.toml` names and nobody had looked. The roadmap recorded `gpt-6.1-sol` at `high`
  as his decision of 2026-09-29, held by an assignment in gentle-ai's state that is no longer
  there (`rg -c -i orchestratorAssignment ~/.gentle-ai/state.json`: no match, 2026-10-08).
- One run, the review of the whole branch, was 28 reviews and 3.36 million tokens, 55% of the
  total. Its five findings all came from the 3,593 lines of code that are not tests (25% of the
  14,141 lines); tests (52%), documents (11%), the seeded fixture (7%) and JSON readings (5%)
  gave none. Parts of up to 400 lines cost 325 input tokens a changed line, parts above it 178,
  the largest (3,228 lines) 113.
- Four of those 28 reviews repeated a range reviewed an hour before, because the command always
  reviews up to `HEAD`.
- The branch reached that size because no slice was reviewed by Codex when it closed.
- The run was started without asking, on an estimate 24% under what it cost.

His decision on the same day: "tenemos que quitar todo indicio de revisión con astra, solo
permitiremos sol 6.1 en high e implementa todas las mejoras que propones".

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/codex-review-cost.md` exits 0
- `node --test bin/codex-review.test.mjs` exits 0
- `node --test "evals/review/*.test.mjs"` exits 0
- `node bin/js-harness.mjs codex-review --base HEAD --plan` exits 0 and names the model, the
  effort and the count of parts without starting Codex
- `docs/ROADMAP.md` says which model and effort a Codex review runs on, what it leaves out, and
  what the part-size measurement found or that it was not run

## In scope / Out of scope
- In: `bin/codex-review.mjs` and its modules in `bin/lib/`, `bin/check.mjs` where it reports
  review state, `evals/review/` where the comparison could still start a review on his own
  configuration, `docs/ROADMAP.md`, this document.
- Out: his `~/.codex` (never written; `config.toml` still names `gpt-6-astra` at `low` for his own
  Codex sessions, which is his to change), gentle-ai's state, the Codex plugin (the proposal in
  `odd/tasks/codex-review-lean.md` waits for him), `feat/codex-parity` (F6 is paused there).
- Out: the readings, the report and the roadmap section of the finished comparison. They are the
  record of what was measured, `gpt-6-astra` rows included, and the verdict rests on them. Read
  of "todo indicio" by the agent, his to correct: no review can run on another model any more;
  what already ran stays written down.

## Constraints
- No update of Codex, gentle-ai or engram — because F6 resumes on the stack it measured.
- Nothing written in his real `~/.codex`, and `auth.json` never read — his standing rule; every
  real run stays inside `evals/review/login-proof.mjs`.
- `AGENTS.md` is at 1,499 of 1,500 tokens — an edit has to fit.
- A review of a slice runs when the slice closes, with the plan printed first — because the
  point of this feature is that a large spend is never a surprise again.

## Effort
high

## Ask me before
A run above the bound of T3 (it refuses by itself); the measurement of T6, which is a batch of
Codex reviews with its count; push, pull request and merge.

## TDD
Strict: each behaviour arrives with the test that fails first, observed. One writer a slice, one
test command at a time, never beside a gate.

## Delivery
`ask-on-risk`. Forecast: about 1,200 authored changed lines over three slices of code, each its
own commit, each reviewed by gentle-ai and by Codex when it closes. Stacked on
`feat/codex-review-lean`, which is not pushed: the chain strategy is asked when he decides the
push of that branch.

## Tasks
- [x] T1 One model: `codex-review` passes `-m gpt-6.1-sol` and `model_reasoning_effort="high"` in
  every session, `current` included; a lean review whose session ran anything else, as its
  rollout says, does not stand; the comparison's `current` configuration can no longer be run
  (its readings stay); usage, comments and the roadmap's Review and Effort rows say so — route:
  delegated writer
- [ ] T2 Only code is reviewed, and nothing twice: documents, eval readings and paths a git
  attribute marks are left out of the parts and of the evidence rule, and the run says what it
  left out; a range whose earlier commits a record already covers is reviewed from where the
  records end — route: delegated writer
- [ ] T3 The cost is seen first: `--plan` prints the parts, the lines and an estimate of tokens
  and starts nothing; a run above a bound of parts refuses without an explicit flag; `check`
  says how much code has been committed since the last Codex review record — route: delegated
  writer
- [ ] T4 Each slice of T1 to T3 reviewed by gentle-ai and by Codex when it closes, the plan read
  before each run — route: inline runs
- [ ] T5 The part-size measurement, after Sebastián's go-ahead on its count: the same code with
  parts of 400 and of 1,000 lines at `high`, findings against a key and tokens; the bound
  changes only on what it shows — route: inline runs
- [ ] T6 The result in `docs/ROADMAP.md` — route: inline

## Progress
- 2026-10-08: opened from the analysis of the fifty reviews (Why). Branch cut at `5663c8c`.
  Three decisions taken in the opening, each his to correct:
  - `high` replaces the `medium` he fixed on 2026-10-06. What the comparison measured of it:
    on the seeded range 4% more input and 65% more output for the same seven defects and one
    remark more; on the real range 2.8 times the input for the same answer.
  - `--session current` stays, as the way out for a machine where the lean home cannot be made,
    but with the model and the effort fixed by the command like the lean session, so it is his
    configuration's load and not its model.
  - The history of the comparison is kept (Out of scope).
- 2026-10-08: T1, first part, by one delegated writer (route: delegated), test first; not
  committed yet. The command passes `-m gpt-6.1-sol` and `model_reasoning_effort="high"`; a
  session whose rollout names another model or effort fails the attempt, with nothing of its
  answer shown and no record ("its session ran on <model> at <effort> effort, and the command
  passed gpt-6.1-sol at high effort"); a measurement the rollout does not name leaves the
  review standing. The comparison's `current` cells refuse to run, and each lean cell has
  the effort it was measured with written in it, so the new default does not change a cell.
  The writer's file of the command: 211 of 211 (501 s).
- 2026-10-08: the second decision of the opening is reversed by what that writer found.
  `--session current` cannot be held to the rule: as a person runs it nothing is measured,
  a `review_model` or a profile of his configuration could win over what the command
  passes, and measuring it would mean writing sessions in his real Codex home. A session
  whose model cannot be verified is how three reviews ran on `gpt-6-astra` unnoticed. So it
  is removed: the lean session is the only one, `--session current` is a usage error that
  says why, and a machine where the lean home cannot be made records the skip with
  `--unavailable`. Same writer, test first.
- 2026-10-08: the removal built by that writer, red first for each new behaviour. T1 is
  checked: re-run by the parent, 100 of 100 over the run-log, home, compare and report
  files; the command file 201 of 201 by the writer (474 s).
  - One session. `--session lean` is still read, so a command line that named it does not
    break, and is no longer in the usage; `--session current` is a usage error, exit 2,
    nothing started: "`--session current` was removed on 2026-10-08: a review runs only on
    gpt-6.1-sol at high effort, and the model that session ran on could not be verified."
    with how to record the skip.
  - The refusal when the lean home cannot be made ends with the skip as the way out, not
    with another session.
  - Removed with it: the argv of that session, the seam that measured it in a copy of his
    home and the seeding of that copy, the flag errors that only existed beside it. Eleven
    tests of the command described only that session and went, each named in the writer's
    report with why nothing is left to assert; the tests about the command in general now
    run under the one session.
  - Kept: a run line of the log that says `current` still reads as history; the sweep still
    unlinks a login name a measured run killed before today may have left.
  - The comparison's readings, its list and its report are byte for byte as they were.
  - The roadmap: the Review and Effort rows say one session on `gpt-6.1-sol` at `high`, and
    the sentence of "Codex review result" that said `--session current` stays says what
    became of it.
  - Left open by the writer and decided by the parent for the next slice: a lean review
    whose rollout names no model still stands. Under "only `gpt-6.1-sol` at `high`" it
    should not: every real lean run so far wrote the line, so a review that cannot say what
    it ran on is refused like one that ran on something else.
- 2026-10-08: T1 committed as `14cd8bf` (gate green). gentle-ai could not review it:
  `5663c8c..14cd8bf` is 2,540 changed lines (1,270 of them deletions, the tests of the
  removed session), and the start, granted without asking, refused with
  `lens_context_budget_exceeded`: "the candidate's complete reviewer evidence exceeds the
  native context budget, so no review authority was created". The same for
  `d71e81d..14cd8bf`. It is its documented bound and not a defect, so nothing was reported
  and nothing has to be abandoned. A commit cannot be made smaller after the fact, so
  `14cd8bf` has no gentle-ai review: what stands for it is the writer's tests red first,
  the parent's re-run (100 of 100, and the command file 201 of 201) and the gate; its
  Codex review is owed (Next step). The parent's error, to not repeat: the two parts of T1
  were sent to the writer one after the other and committed as one, against the rule this
  branch already had, a candidate under about 1,900 changed lines. Each part of a task is
  committed when it is green.
  - `4f32fd9` (171 lines, under gentle-ai's budget before) is inside that refused range
    too; it has its Codex review record.
  - A stray folder, `Microsoft/Windows/PowerShell/ModuleAnalysisCache`, was in the
    worktree after the gate again (a test starts PowerShell without `LOCALAPPDATA`; the
    follow-up of `odd/tasks/codex-review-lean.md`). Removed; it made the first assessment
    read the candidate as unassessable.
- Not known until the first real run: that a rollout writes the effort `high` as `high`.
  Every measured line so far passed `medium` and read `medium`. If it is written another
  way, the first review fails with the mismatch message and the reader is corrected.

## Follow-ups

## Next step
In this order, each slice committed when it is green and kept under about 1,900 changed
lines, deletions counted:
1. T3 first, in two commits: `--plan` and the bound of parts; then what `check` says of
   code committed since the last record. It goes before T2 because the Codex review of
   `14cd8bf` is owed and its cost has to be read before it runs: at `high`, over about
   2,400 changed lines.
2. The Codex review of `5663c8c..HEAD` with the default command, inside the login proof,
   after reading its plan. It is also the first real run at `high`, which shows how a
   rollout writes that effort.
3. T2, in two commits: only code is reviewed (documents, eval readings, paths a git
   attribute marks); a range whose earlier commits a record covers starts where the
   records end. With it, the rule decided on 2026-10-08: a lean review whose rollout names
   no model does not stand.
4. gentle-ai and Codex on each of those commits when it closes (T4), then T6. T5, the
   measurement of the part size, is put to Sebastián with its count before any of it runs.

Waiting for him, from `odd/tasks/codex-review-lean.md`: the proposal for the Codex plugin
(asked on 2026-10-08, not answered: he asked instead why there were so many reviews, which
opened this feature), and push, pull request and merge of both branches.

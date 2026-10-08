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
- [x] T3 The cost is seen first: `--plan` prints the parts, the lines and an estimate of tokens
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
- 2026-10-08: T3, first half, by one delegated writer (route: delegated), red first for each
  behaviour; T3 stays open until `check` has its line. The writer: the plan module 18 of 18,
  the command file 206 of 206 (425 s), the comparison's tests 103 of 103; re-run by the
  parent, the plan module 18 of 18.
  - `--plan` prints the range, the model and the effort, the parts with their files and
    changed lines, and an estimate of input tokens, and exits 0. It starts nothing: no Codex
    looked for, no home made, nothing logged or recorded, and it does not mind uncommitted
    changes, being of the committed range. A real run prints the same plan before its first
    session.
  - The estimate is made from this machine's run log (in the git common dir, so every
    worktree shares it and a fresh clone has none), never from a number in the code: the
    parts that were reviewed in the lean session with tokens read from their rollout, at
    the fixed model and effort when five or more are, else all of them with the plan saying
    so; the median input tokens a changed line of two bands, up to 400 lines and above;
    never under the smallest measured run; rounded to two figures. With nothing measured the
    plan says there is no estimate.
  - A bound of parts, 6, chosen by the agent and his to change: a run of more is refused
    before anything is started, exit 1, with its plan and the flag that lets it go on,
    `--max-parts <n>` with its count. The count named is the bound in both directions.
  - `--plan` beside `--unavailable` is a usage error. The comparison needed no change: both
    its ranges are one part.
  - What the plan says of the review this branch owes, `5663c8c..b7609b2`, before this
    slice was committed: 6 parts, 2,576 changed lines in 10 files, about 745,000 input
    tokens, from 36 parts measured at `medium` and none at `high`, so a floor. With this
    slice committed it is over the bound, which this document says is asked of Sebastián.
  - Found by the writer, decided by the parent for T2: a run over a range that changes
    nothing still starts one session. With "only code" a range of documents alone becomes
    the same case, so in T2 a run with no part starts nothing, says so and exits 0.
- 2026-10-08: the first half of T3 committed as `0c71389` (gate green). gentle-ai on
  `b7609b2..0c71389`, 931 changed lines, medium, consent granted without asking: approved
  and acknowledged (lineage `review-924bafd789442be4`), with one warning and two
  suggestions, all three accepted and fixed by the same writer before any Codex review is
  paid for, since paying a review to find what is already known is the spend this feature
  cuts. The writer: the plan module 19 of 19, the command file 209 of 209 (470 s), the
  comparison's tests 103 of 103.
  - The warning: a run over a range that changes no file printed a plan of no part and
    then started a session all the same. It now starts nothing, says so and exits 0, with
    no record. Red first. It was planned for T2 and moved here.
  - Two failure paths had no test: a run log that cannot be read (the plan says there is no
    estimate and the run goes on), and `--plan` from a base that shares no history. Both
    held on the code as it was; each test was seen to fail with its guard removed.
  - The sentence of what an estimate rests on said "at another effort" of parts that had
    all run on the fixed pair. It now says how many ran on the pair and speaks of another
    effort only when some did not. Red first.
  - What the plan says of the review this branch owes, `5663c8c..0c71389`: 7 parts, 3,439
    changed lines in 12 files, about 1,016,000 input tokens, from 36 parts measured at
    `medium` and none at `high`, so a floor. Over the bound: it waits for Sebastián.
- 2026-10-08: the fix of the three findings committed as `7936a1f` (gate green). gentle-ai
  on `0c71389..7936a1f`: medium, 196 changed lines, not due (`under_budget`), so it stays
  in the slice until a later commit reaches the budget.
- 2026-10-08: the Codex review this branch owed, `5663c8c..7936a1f`, run on Sebastián's yes
  to its plan (7 parts, about 1,045,000 input tokens as a floor, 2.9 million as a ceiling),
  with `--max-parts 7`, inside the login proof (PASS: the login is the file it was, under
  one name). All 7 parts passed and the range is recorded.
  - It is the first real run at `high`, and a rollout writes that effort as `high`: each of
    the seven lines of the run log says the command passed `gpt-6.1-sol` at `high` and the
    session ran on it. What was not known is known.
  - Cost: 2,314,747 input tokens (1,840,640 of them cached) and 9,709 output, in 610 s over
    53 requests. That is 2.2 times the floor the plan gave, as the plan said it could be:
    its estimate rested on runs at `medium`. The part of `bin/codex-review.mjs` (654
    lines) alone was 965,028, since the reviewer built a reproduction of what it found; the
    other six ran from 72,828 to 515,020. From here the log holds seven parts at `high`, so
    an estimate rests on those alone.
  - Six verdicts "correct", the commit of T1 among them, which had no review of its own.
  - One finding, P2, in the first part: a range whose commits cancel out exited 0 with no
    record, while the push check still asked for one over each of those commits. It is
    follow-up F1, which the writer had reported and the parent had written down for T2
    instead of fixing. The parent's error, to not repeat: a defect that is known is fixed
    before a review is paid for, not noted for later; here the review spent its dearest
    part on finding it again.
- 2026-10-08: that finding fixed by the same writer, red first with the finding's own
  reproduction (a code commit and its revert). A run whose range has no part still starts
  nothing; when the range holds a commit it now appends a record of a third outcome,
  `nothing-to-review`, with its reason, and the push check counts those commits as covered
  and lists the record as what it is. Nothing is recorded when the range holds no commit.
  A reader from before this change finds the record invalid and covers nothing with it, so
  it fails closed. The writer: the record's tests 14 of 14, the push check's 43 of 43, the
  command file 211 of 211 (492 s); re-run by the parent, the first two, 57 of 57.
  - Left as it was: the push check's passing sentence says "all covered by a Codex review
    record" of skips and of this record too; the lines listed under it say which is which.
- 2026-10-08: that fix committed as `da71985` (gate green), and its two reviews.
  - gentle-ai on `0c71389..da71985` (the two fix commits, 436 changed lines, medium,
    consent granted without asking): approved and acknowledged (lineage
    `review-e34e4e64cad7d08c`), one suggestion: a second run over a range with nothing to
    review appends a second, equal record. Not a defect against what was asked; it goes
    with "nothing twice" in T2, where a range the records already cover records nothing.
  - Codex on `7936a1f..da71985`, its plan read first (1 part, 304 changed lines, about
    200,000 input tokens, from the seven parts at `high`), inside the login proof (PASS):
    287,707 input tokens (235,136 cached), 3,128 output, 116 s, recorded. One finding, P2,
    real: the push check lets a record cover commits when its head lies past the pushed
    tip, which is right of a review and wrong of this record, since a range changes no file
    only as a whole. With a change and its revert recorded, pushing the change alone
    passed, its patch reviewed by nobody.
  - Fixed by the parent inline (route: inline, one condition in `bin/check.mjs` and its
    test), red first: the new test failed on "the change pushed without its revert is not
    covered". A record of nothing to review now covers only when what is pushed holds its
    head. The push check's tests, the record's and the hook's: 65 of 65; the three tests of
    the command about such a range: 3 of 3.
  - That fix is 22 changed lines. Its reviews go with the next slice, from `da71985`: a
    Codex session costs at least what the cheapest measured one did (72,828 input tokens),
    whatever the size of what it reads.
- 2026-10-08: the fix of the push check committed as `cf32d4f` (gate green).
- 2026-10-08: T3, second half, by one delegated writer (route: delegated), red first; T3 is
  checked. The writer: the push check's tests 65 of 65 (102 s), `check`'s 73 of 73, the
  hook's 7 of 7; re-run by the parent, `check`'s 73 of 73.
  - The plain `check`, which runs at every commit, prints a row `codex-review` that is
    information and never fails: how many code commits since the default branch of the
    remote have no record, and how large the review that would cover them is today (parts,
    changed lines, files), with the command that shows its cost with nothing spent,
    `js-harness codex-review --base <oldest>^ --plan`. Over six parts it says so and that
    the cheaper way is to review now. When all is covered it says that in one line; when it
    cannot tell (no remote, no default branch, not a repository) it says why, and still
    exits 0.
  - `check --push` prints what it printed. The two rows share one computation of what is
    covered.
  - Found on the way: the push check started one git process for each record whose head is
    outside the range, 83 of them and 5.5 s on this repository with its 92 records, which
    at every commit is not a handful. They are one `git rev-list --ancestry-path` now, with
    the old question as the way back when git refuses it: 19 processes and about 1 s.
  - The plain `check` now reads `--remote`, which it took and ignored.
  - The row on this branch before the commit: 1 of 20 code commits without a record
    (`cf32d4f`), a review of 1 part.
  - For T2: the row sizes the range up to `HEAD`, as a review reads it today. When a review
    starts where the records end, the row's sizing changes with it.
- 2026-10-08: the second half of T3 committed as `cd71ae4` (gate green; its own gate
  printed the new row). gentle-ai on `da71985..cd71ae4` (608 changed lines, medium, consent
  granted without asking): approved and acknowledged (lineage `review-0ac7af31a231c426`),
  one warning and two suggestions, all accepted and closed by the same writer before the
  Codex review. The writer: the push check's tests 71 of 71 (116 s), `check`'s 73 of 73,
  the hook's 7 of 7.
  - The warning: the row promises to fail nothing, and a throw could still leave it. A
    records file that cannot be read or parsed did not throw (the reader returns no
    records), nor did git failing after the records were read; a git answer that is not
    text did, from inside the reader. Red on that one. The row's body is in one `try` now
    and says it cannot tell, with the error's own words; the push check still fails loudly,
    which a test pins.
  - The two suggestions were tests that held on the code as it was, each seen to fail under
    a mutation: a record whose head the repository no longer knows goes through the one
    `rev-list` with no `merge-base` started, and the row of a root commit says its size
    could not be told.
  - Left as it is, the same in both rows: a records file that cannot be read or parsed
    reads as no record, not as "cannot tell".
- 2026-10-08: the fix of the row committed as `469e26f` (gate green). Codex on
  `da71985..469e26f`, its plan read first (2 parts, 739 changed lines, about 490,000 input
  tokens), inside the login proof (PASS): both parts "correct", no finding, 562,328 input
  tokens (444,672 cached), 3,311 output, 170 s, recorded. The estimate was 15% under, where
  the first one, made from runs at `medium`, was 120% under. With the three findings of
  gentle-ai closed before it ran, Codex had nothing known to find again. gentle-ai on
  `469e26f` alone is under its budget and goes with the next slice.
- 2026-10-08: T2, first half, by one delegated writer (route: delegated), red first for each
  behaviour; T2 stays open until "nothing twice". The writer: the scope module 13 of 13,
  the plan 22 of 22, the parts 16 of 16, the prompt 27 of 27, the push check 76 of 76
  (140 s), `check` 73 of 73, the hook 7 of 7, the command file 216 of 216 (524 s), the
  comparison's tests 104 of 104; re-run by the parent, the scope, plan and prompt files, 62
  of 62.
  - One definition, in `bin/lib/codex-review-scope.mjs`, read by the command and by
    `check`: a review leaves out Markdown files and the paths a project marks
    `-codex-review` in `.gitattributes`. Nothing of this repository's folders is in the
    code. Tests are code and stay in. A Markdown file cannot be marked back in.
  - This repository marks `evals/results/**` and `evals/review/seeded/**`: 46 files.
  - Left-out files are in no part, no prompt and not in the lines a session must have
    seen. The plan, and so every run, says how many files and changed lines it left out
    and of which kind. A range whose files are all left out has no part: nothing is
    started, and when it holds a commit it is recorded as `nothing-to-review` with that
    reason. A record and a run line say what was left out.
  - A range of one part that leaves a file out cannot be asked with Codex's own review of
    a range, which reads everything, so it is asked by its files, as a part is, under
    either `--prompt`, and the run says so in one line. The part prompt is `v3`: the same
    bytes as `v2` when nothing is left out. Such a run logs its part, so it enters later
    estimates, which is most of follow-up F2.
  - The marks are read from the head commit of the range (`git check-attr --source`), in
    one process: the working tree and the index hold the change being made, which is wrong
    for `check`. It needs git 2.40; this machine has 2.54. With an older git nothing is
    guessed: the command starts nothing and exits 1, the push check fails saying so, and
    the plain row says it cannot tell.
  - `check`: a code commit is one that changes a file a review reads, in both rows, and the
    row sizes the review with the left-out files out.
  - Decided by the parent on the writer's gap: the cells of the finished comparison stay as
    they were measured. Both its ranges change a Markdown file, so under the new rule a
    cell would ask something other than what its stored reading measured. A seam in
    `deps`, `everyFile`, which no flag of the command line reaches (a test pins it), makes
    a run read every file; `evals/review/compare.mjs` passes it for every cell, as it pins
    each cell's effort. The readings and the report are byte for byte as they were.
  - What the plan says of this branch's whole range today, `5663c8c..469e26f`: 8 parts and
    "Left out of the review: 2 Markdown documents, 372 changed lines". Not run: its records
    cover it already, which is what the second half makes the command see by itself.
- 2026-10-08: Sebastián asked, beside this feature, whether an Opus 5.5 orchestrator with
  Haiku 5.5 subagents would help. What was verified and what he decided are in
  `docs/ROADMAP.md`, Next, item 8: it is measured in a session of its own.

## Follow-ups
- F2-whole-range-runs-feed-no-estimate: a run line of a range reviewed whole holds no count
  of changed lines, so it never enters the estimate of a plan. Smaller since the first half
  of T2: a one-part range that leaves a file out is asked by its files and logs its part,
  and nearly every slice changes its feature document. What is left is the one-part range
  that changes no document and no marked file.
- F3-old-git: reading the marks needs git 2.40 (`check-attr --source`). `doctor` could say
  so of a machine with an older one, before a review refuses to start there.
- F1-what-code-is: closed on 2026-10-08. A range with nothing to review that holds commits is
  recorded as such, and the command and `check` read one definition of what a review reads.

## Next step
In this order, each slice committed when it is green and kept under about 1,900 changed
lines, deletions counted. A defect that is known is fixed before the Codex review of its
slice, and the plan of that review is read first:
1. gentle-ai and Codex on the first half of T2, from `469e26f`; the plan of the Codex
   review read first, and what gentle-ai finds closed before it.
2. The second half of T2: a range whose earlier commits a record covers starts where the
   records end, a range the records cover whole starts nothing and records nothing (the
   suggestion gentle-ai made of equal records), and a flag to review again on purpose. With
   it, the rule decided on 2026-10-08: a lean review whose rollout names no model does not
   stand. The row of `check` sizes what such a review would read.
3. gentle-ai and Codex on each of those commits when it closes (T4), then T6. T5, the
   measurement of the part size, is put to Sebastián with its count before any of it runs.

Waiting for him, from `odd/tasks/codex-review-lean.md`: the proposal for the Codex plugin
(asked on 2026-10-08, not answered: he asked instead why there were so many reviews, which
opened this feature), and push, pull request and merge of both branches.

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
- [x] T2 Only code is reviewed, and nothing twice: documents, eval readings and paths a git
  attribute marks are left out of the parts and of the evidence rule, and the run says what it
  left out; a range whose earlier commits a record already covers is reviewed from where the
  records end — route: delegated writer
- [x] T3 The cost is seen first: `--plan` prints the parts, the lines and an estimate of tokens
  and starts nothing; a run above a bound of parts refuses without an explicit flag; `check`
  says how much code has been committed since the last Codex review record — route: delegated
  writer
- [x] T4 Each slice of T1 to T3 reviewed by gentle-ai and by Codex when it closes, the plan read
  before each run — route: inline runs
- [x] T5 The part-size measurement, after Sebastián's go-ahead on its count: the same code with
  parts of 400 and of 1,000 lines at `high`, findings against a key and tokens; the bound
  changes only on what it shows — route: inline runs
- [x] T6 The result in `docs/ROADMAP.md` — route: inline

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
- 2026-10-08: the first half of T2 committed as `7ae9cb8` (gate green). gentle-ai on
  `cd71ae4..7ae9cb8` (1,401 changed lines, medium, consent granted without asking):
  approved and acknowledged (lineage `review-8b032541eeff840e`), one warning, accepted and
  closed by the same writer before the Codex review. The writer: the scope module 14 of
  14, the push check 77 of 77 (153 s), `check` 73 of 73, the command file 217 of 217
  (545 s).
  - The warning: the marks were asked of git in the folder `check` was run from, with
    paths that start at the top of the repository, and git reads such a path against the
    folder it runs in. Red with a real repository: from a subfolder none of the marked
    paths read as marked, and the push check counted a commit of eval results as code. The
    lookup now finds the top first (`git rev-parse --show-cdup`) and asks there: two git
    processes for a lookup, however many the paths.
  - A second case of the same kind, found by the same test and older than this slice: with
    `diff.relative` set, `git log --name-only` and `git diff --numstat` run from a
    subfolder drop the files outside it, so a code commit elsewhere needed no record. Both
    calls of `check` pass `--no-relative` now. The command was already right, every git
    call of it running at the top, which a test now pins.
- 2026-10-08: that fix committed as `ed1fd0e` (gate green). Codex on `469e26f..ed1fd0e`,
  its plan read first (4 parts, 1,308 changed lines in 13 files, "Left out of the review: 1
  Markdown document, 89 changed lines", about 890,000 input tokens), inside the login proof
  (PASS): recorded, 1,956,411 input tokens (1,697,152 cached), 15,201 output, 660 s. Two
  parts "correct"; four findings in the other two, all P2, all accepted:
  - `check` listed the files of a commit with rename detection on, so a code file moved
    into a marked folder read as a commit of marked files alone and needed no record.
  - A record that left marked files out covered an earlier tip, where the mark did not
    exist yet and the file was code.
  - The list of commits was split on a byte a file name can hold, so a commit whose only
    file had that name read as no code commit.
  - With `diff.submodule=log` a range that changes a submodule and leaves a file out was
    refused before anything started, its patch having one section fewer than its files.
- 2026-10-08: the four fixed by one delegated writer (route: delegated), red first with each
  finding's own reproduction. The writer: scope 15 of 15, plan 25 of 25, records 15 of 15,
  the push check 89 of 89 (190 s), `check` 73 of 73, the hook 7 of 7, the command file 219
  of 219 (582 s), the comparison 104 of 104; the push check of this branch passes (23 code
  commits, all covered). Re-run by the parent: plan, records and scope, 55 of 55.
  - `--no-renames` on the log of `check`, as the command has; and `--root`, since with
    `log.showRoot` off a root commit listed no file (found by the writer, red observed).
  - A record's `leftOut` says how many of the files were documents and how many were
    marked. A record that left a marked file out covers only when what is pushed holds its
    head, the rule the record of nothing to review has. Markdown constrains nothing: no
    commit can change that rule. A record with a `leftOut` of the older shape fails
    closed, as if it had left marked files out; there is one, `469e26f..ed1fd0e`.
  - The log is parsed on NUL alone: each commit starts at an empty field, which no file
    name can be. An answer of another shape fails closed.
  - `--submodule=short` on the two patches the proof compares, at one more git process a
    part. Not on the command a session is asked to run: the prompt module was outside the
    slice, and pinning one side alone would fail a session after it had spent.
- 2026-10-08: the estimate of a plan, by the same writer. Twice the plan was under half of
  what a review of several parts cost (1,045,000 against 2,314,747, and 890,000 against
  1,956,411), and the second rested on runs at the review's own effort: what a part costs
  follows how far the session looks into the code more than its size. At `high` the 13
  measured parts cost from 296 to 2,278 input tokens a changed line. The plan now gives a
  range for the total: the figure from the median and a higher one from the most a changed
  line cost in each band, and says that the higher one is no ceiling. Made from the log as
  it stood before each of those two reviews, the third quartile would have said 1,450,000
  and 1,030,000, under both; the highest says 3,170,000 and 1,690,000, over one and 14%
  under the other. The same range today: about 990,000 to 2,980,000.
- 2026-10-08: that fix and the range committed as `dbc71f0` (gate green), and its two
  reviews.
  - gentle-ai on `7ae9cb8..dbc71f0` (860 changed lines in 11 files, medium, consent granted
    without asking): approved and acknowledged (lineage `review-77460eaa2fa2138c`), no
    finding. Its first bound status ran out of time before it started anything; asked once
    more, it went on.
  - Codex on `ed1fd0e..dbc71f0`, its plan read first (2 parts, 642 changed lines in 10
    files, "Left out of the review: 1 Markdown document, 53 changed lines", about 490,000 to
    1,460,000 input tokens), inside the login proof (PASS): recorded, 803,690 input tokens
    (680,960 cached), 5,607 output, 255 s. The first plan given as a range, and the cost fell
    inside it. Part 2 "correct"; one finding in part 1, P2, accepted: with
    `log.showSignature` set and a signed commit in the range, git writes what it says of the
    signature before the line of the commit, which the parser on NUL alone reads as a list of
    another shape, so `check --push` fails a branch whose every commit has a record. The
    parser before it passed over such text. It fails closed, so nothing unreviewed is let
    through; the fix is `--no-show-signature` on that log, and it goes first in the next
    slice, which moves that code.
- 2026-10-08: T2, second half, by one delegated writer (route: delegated), red first for the
  defect and for each behaviour. The writer: the coverage, records, plan and scope modules
  66 of 66, the push check 91 of 91 (208 s), `check` 73 of 73, the comparison 36 of 36, the
  command file 230 of 230 (720 s); the push check of this branch passes (24 code commits,
  all covered). 1,497 changed lines. Re-run by the parent: the four modules, 66 of 66, and
  the two plans below.
  - The finding of the last Codex review, first: `--no-show-signature` on the log, red with
    a real signed commit in a repository that shows signatures. Probed with one: only `log`
    and `show` change what they print; `rev-list`, `diff`, `rev-parse`, `merge-base` and
    `status` do not, and that log is the only `log` of the command and of `check`.
  - One definition, `bin/lib/codex-review-coverage.mjs`, moved out of `check`: the code
    commits of a range, the records that cover them, and where the records end. `check`
    asks it of the range of the default branch, the command of the range it was given.
  - A run starts at the parent of the oldest code commit no record covers, when that is
    safe: that commit has a parent, the given start is that parent or an ancestor of it,
    and every uncovered commit lies after it. Otherwise, and when the records cannot be read
    against the range, the range as it was given, with a line that says why: in doubt, never
    less than what was asked. The plan, the parts and their bound, the prompts, the lines a
    session must have seen and the record are those of the range that is left, and the run
    says in one line, before its plan, how many code commits a record already covers.
  - A range with no code commit left starts nothing and records nothing, exit 0, and says
    how many of the covering records are a skip or a range with nothing to review. So does
    a range that holds no code commit at all, documents only, which until now appended a
    record nobody asked for. A commit and its revert, uncovered, still appends one
    `nothing-to-review` record; a second run finds it covered and appends nothing, which
    closes the suggestion gentle-ai made.
  - `--again` takes the range as it was given and does not read the records; it holds
    beside `--plan` and beside `--unavailable`. A skip follows the same rule as a review:
    over a range covered whole it records nothing.
  - A review whose rollout file names no model does not stand: exit 1, no record, and
    nothing of what it answered is shown. The effort keeps its rule. No real rollout is
    kept in the repository; of the 56 lean lines of the run log of this machine, the 51
    written since the fields exist all name the model and the effort.
  - The row of the plain `check` takes its start from the same rule, so it sizes the review
    the command would run; a test asks both of one history.
  - The cells of the comparison review their range as given: `everyFile`, which only they
    pass, implies it. Its readings and its report are untouched.
  - On this branch: `codex-review --base 5663c8c --plan` says "Nothing to review:
    5663c8c..dbc71f0 holds 10 code commits, and a Codex review record already covers all of
    them", where `--again --plan` gives 12 parts and 5,880 changed lines.
  - Left by the writer, accepted as they are: a narrowed record has no test of its own for
    what it covers at another tip (it covers its own `base..head`, by the code that reads
    every record); the logged command line of a cell, replayed by hand, starts where the
    records end, unlike the cell; the test file of the command now takes about 12 minutes.
- 2026-10-08: that slice was first committed whole (`bc680fe`, gate green, never pushed),
  and gentle-ai refused it at the start: 1,571 changed lines, document included, and
  `lens_context_budget_exceeded`. Its bound is on the size of the evidence, not on a count
  of lines: 1,401 lines passed on this branch and 1,571 did not, the lines of this slice
  being long. So the working bound of a slice here is about 1,300 changed lines, not the
  1,900 written until now. Being the tip and unpushed, the commit was taken back and made
  again as two, each through the gate, with the same tree at the end:
  - `6ad93ab`: the fix of the signed commit, the coverage code moved to its module, and
    the row of `check` sized from where the records end (699 changed lines).
  - the commit of this entry, `d632abf`: the command, its tests, the comparison and this
    document (872 changed lines). Its gate took 1,117 s of the 1,200 it has (F7).
- 2026-10-08: gentle-ai on each of the two, consent granted without asking, both approved
  and acknowledged. The bound status of the first ran out of time while the gate of the
  second was running, and went on when asked again after it.
  - `dbc71f0..6ad93ab` (699 changed lines, medium; lineage `review-b1baeee66253f90a`): one
    warning and one suggestion, both accepted. The warning: where the records end is worked
    out with the commit the range starts at, and "none" was read as "the two histories share
    no commit", which skips the guard that the start is an ancestor of the new one; but
    `check` gets that commit from `git merge-base`, which also answers nothing when git
    fails. The suggestion: a test of the order that could not tell the two results apart.
  - `6ad93ab..d632abf` (872 changed lines, medium; lineage `review-3c0eb6d566170afe`): two
    warnings and one suggestion. Accepted: a run that starts later says how many commits a
    record covers and not how many of those records are a skip or a range with nothing to
    review, which the message of a range covered whole does say, so commits a skip covers
    leave every later review unsaid; and a test that asserted the wording of an error of
    the JavaScript engine. The other warning is F7 itself, that the slice adds a dozen
    tests to the file that already runs the gate close to its bound: true, known, and not
    closed by this slice.
  - The three accepted defects and the weak test go to one delegated writer before the
    Codex review of the two commits, which is not paid to find them again.
- 2026-10-08: those four fixed by one delegated writer (route: delegated), red first, or a
  mutation for the two that were weak tests. The writer: the four modules 67 of 67, the push
  check 92 of 92 (274 s), `check` 73 of 73, the command file 231 of 231 (762 s). 150
  changed lines. Re-run by the parent: the coverage module, 12 of 12.
  - `rangeStart`, in the coverage module: the commit a range starts at, "none" only when
    git exits 1 with nothing written, which is how it says that two histories share no
    commit (probed on git 2.54: a bad revision exits 128), and "not known" for every other
    failure. On "not known" the row sizes nothing and says that it could not be told. Red
    with a real history: with `merge-base` alone failing, the row gave a size 40 lines too
    large, those of the default branch. The command had no such hole: it refuses a range
    whose start git does not give, and under `--unavailable` it falls back to the base it
    was given, a commit, so the guard always runs.
  - The line of a run that starts later says how many of the covering records are a skip or
    a range with nothing to review, by the helper the message of a range covered whole
    uses. Red: a plan past a skip record said nothing of it.
  - The test of the order asserts both results whole; the old one passed with the rule
    forced to the range as given, the new one fails. The test of the failure matches the
    words of the command and not those of the engine.
  - Left as it is: the command says "share no history" also when `merge-base` failed; it
    refuses either way, with nothing started.
- 2026-10-08: that fix committed as `47c3d02` (gate green in 1,107 s, started after the gate
  of the other session had ended, so alone: F7 stands without it). gentle-ai on
  `d632abf..47c3d02`: 211 changed lines, under its budget, so it waits in the slice. Codex
  on the three commits, `dbc71f0..47c3d02`, its plan read first (5 parts, 1,595 changed
  lines in 8 files, "Left out of the review: 1 Markdown document, 148 changed lines", about
  1,030,000 to 3,160,000 input tokens), inside the login proof (PASS): recorded, 1,704,421
  input tokens (1,376,768 cached), 10,253 output, 382 s, inside the range of its plan. It
  was the first run to start where the records end by itself. Four parts "correct"; one
  finding, P2, accepted:
  - The coverage lists the commits of a range without its merges, so a merge is never a
    code commit. A merge can change code by itself, a conflict resolved by hand or an edit
    made in it; with the other commits of a range already recorded, a run now says there
    is nothing to review and that edit is in no review, where the command reviewed the
    whole patch until `d632abf`. The push check always had the same blind spot. The fix
    goes in the shared definition, so that both read it: a merge that changes a file a
    review reads by itself is a code commit, covered as any commit is, and a review whose
    oldest uncovered commit is a merge takes the range as it was given.
- 2026-10-08: the fix of the merge, by one delegated writer (route: delegated), red first,
  in two rounds, committed with this entry. The writer, at the end: the four modules 72 of
  72, the push check 94 of 94 (212 s), `check` 73 of 73, the command file 232 of 232
  (749 s); the push check of this branch passes (27 code commits, all covered; the range
  holds no merge). 355 changed lines, 241 of them tests. Re-read by the parent: the
  function that asks git about a merge. The first round built what the
  entry above says, on what git 2.54 prints: under `--diff-merges=combined` a merge has an
  entry of its own shape (its line, one more empty field, then names with no newline
  before the first), and the parsed list is held to the commits `rev-list` names for the
  range. Two things it showed changed the rule, decided by the parent and his to correct:
  - The combined diff also lists a file both sides changed and git merged by itself. Read
    as code of the merge, every merge of the default branch into a feature branch that
    shares one such file would be refused by the push check until a review made its
    record: paying again for code two reviews already read, which this feature exists to
    stop. So a merge is a code commit only for what somebody wrote in it: the combined diff
    gives the candidates at no extra process, and for a candidate git is asked what the
    merge changed against merging its parents again (`--remerge-diff`). Where git gives no
    clean answer, an octopus among them, the candidate files stand: unknown is read as
    written by hand.
  - A review whose oldest uncovered commit is a merge starts at its first parent, under
    the checks every start is held to, and not at the range as given: the diff from there
    holds what the merge changed, and is never more than the range.
  - What git 2.54 prints for the re-merge, probed: the id alone for a clean merge and for
    a file git merged by itself; the names for a conflict resolved by hand and for an edit
    added in the merge; a warning on stdout with exit 0 for an octopus, which is therefore
    told by its count of parents and never asked. It needs `--no-relative`, as the log
    does. It also names a conflict resolved as one side whole, which the combined diff does
    not: only what both lists name is read as written in the merge.
  - Not closed, a follow-up (F8): the review of a merge still reads the whole side the
    merge brings in, since a review reads the difference of two commits. Reading the edits
    of the merge alone, the re-merge difference as its patch, would be the cheap one. And a
    merge that drops work one side had (`-s ours`, a conflict resolved as one side whole)
    lists no file and asks no record: it adds no code, though it can remove a reviewed fix.
    And when the default branch is merged into a feature branch by hand, the first parent
    of the merge is the tip of the feature, which a range from the default branch does not
    start at, so that run takes the range as given, the whole branch; `--base <merge>^`,
    which the push check names, reads what the default branch brought in instead.
- 2026-10-08: that fix committed as `ce47f21` (gate green in 1,040 s), and its two reviews,
  which close T4: every code commit of the branch has its Codex record, and gentle-ai read
  every slice but `14cd8bf`, which it refused for its size (above).
  - gentle-ai on `d632abf..ce47f21`, the two fix commits (620 changed lines, medium, consent
    granted without asking): approved and acknowledged (lineage `review-2be5b70f2e1ee5b9`),
    one warning and one suggestion, neither a change to make now. The warning: the entry of
    a merge is read in the shape one release of git writes, and the log now passes an
    option an old git may not know; both fail closed, the push check saying that it cannot
    list the commits, with nothing naming the version of git as the cause. It joins F3. The
    suggestion is F7 again.
  - Codex on `47c3d02..ce47f21`, its plan read first (1 part, 355 changed lines in 5 files,
    about 300,000 to 820,000 input tokens), inside the login proof (PASS): "correct", no
    finding, 611,377 input tokens (539,904 cached), 5,612 output, 190 s, recorded. The third
    plan given as a range, and the third cost inside it.
- 2026-10-08: T6, inline: `docs/ROADMAP.md` holds "Codex review cost result", with what the
  command does now, the seven reviews of this feature's own code (22 parts, 8,528 changed
  lines, 8,240,681 input tokens, 8 findings, all real and all fixed) and the price said
  plainly: those reviews cost more than the 6.12 million of the fifty this feature was
  opened to cut. The waste is gone (the other model, the documents, the repeats); what is
  left is the effort, about 966 input tokens a changed line at `high` against about 237 in
  the run of 28 parts at `medium`. `high` is his choice; the number is there for him.
- 2026-10-08: Sebastián asked, beside this feature, whether an Opus 5.5 orchestrator with
  Haiku 5.5 subagents would help. What was verified and what he decided are in
  `docs/ROADMAP.md`, Next, item 8: it is measured in a session of its own.
- 2026-10-09: T5, inline, on Sebastián's "Si" to its count (one run of 2 parts). The review
  of `469e26f..ed1fd0e` again, in parts of up to 1,000 changed lines, from a detached
  checkout of `ed1fd0e` made for it and removed after
  (`codex-review --base 469e26f --again --part-lines 1000 --cwd <that checkout>`, the
  command of this branch's tip), its plan read first (2 parts of 810 and 498 changed lines,
  about 920,000 to 1,930,000 input tokens), inside the login proof (PASS), started once no
  gate of any session was running. Against the review of the same code in parts of up to
  400 lines, of 2026-10-08:

  | Parts of up to | Parts | Input tokens | Cached | Output | Time | Of the four known defects |
  | --- | ---: | ---: | ---: | ---: | ---: | --- |
  | 400 lines | 4 | 1,956,411 | 1,697,152 | 15,201 | 660 s | 4 |
  | 1,000 lines | 2 | 1,241,978 | 1,090,560 | 10,438 | 381 s | 3 |

  - The cost: 37% fewer input tokens and 42% less time, about 950 input tokens a changed
    line against about 1,496. The fourth plan given as a range, and the fourth cost inside
    it.
  - The findings: the larger parts gave the rename detection of `check`'s log, the commit
    list split on a byte a file name can hold, and the refusal under `diff.submodule=log`,
    each at the line the first review named. They did not give the fourth: a record that
    left marked files out covering an earlier tip, where the mark did not exist yet. It is
    the one of the four that no single file shows, since it takes the record, the marks
    and two tips read together. No finding that the first review lacked.
  - What it does not show: why. It is one run of each size, and how much two runs of one size
    differ was not measured, so a defect missed once is not proof that larger
    parts miss it. Telling the two apart takes several runs of each, about 1.2 to 2 million
    input tokens a run.
  - The bound stays at 400 (`PART_MAX_CHANGED_LINES`). The task set that the bound changes
    only on what the measurement shows, and what it shows is a real defect not found for
    a third of the cost saved; the review is paid to find defects, and `high` was chosen
    for that. `--part-lines <n>` stays for the run where the cost matters more, and the
    plan says what either would cost before anything is spent. The record this run
    appended covers commits that had one already; the push check still passes.
- 2026-10-09: committed as `d2eacb0` (gate green), then delivered, each step on Sebastián's
  "Si": push and two stacked pull requests, then their merge.
  - `main` had moved twice since the branches were cut (#41, the plan of the rule
    hierarchy; #42, the subagent arms of the evals) and both branches conflicted with it in
    one file, `docs/ROADMAP.md`, where each side had added a section. Resolved with two
    merge commits that keep every section whole, `3bd9162` (`main` into
    `feat/codex-review-lean`) and `d322fb0` (that into this branch), each through the gate.
    A merge and not a rebase: the review records name the commits by id. Neither is a code
    commit, only Markdown was written in them, and the push check passed on both tips (15
    and 28 code commits, all covered).
  - The gate's `review` row said a gentle-ai review was due on the second merge (medium, 20
    paths, 2,227 lines). None was started: those lines are the code of #42, which `main`
    already held, and what this branch wrote in the merge is the roadmap.
  - jsaristi/js-harness#43 (`feat/codex-review-lean`) merged as `ba7bf03`, and
    jsaristi/js-harness#44 (this branch, pointed at `main` after the first) as `005507c`,
    both with a merge commit. The repository has no CI: what stands behind them is the gate
    on every commit and the reviews of each slice. The tree of `main` at `005507c` is the
    tree of this branch (`git diff origin/main feat/codex-review-cost`: empty).
  - Not done, and his to time: the main checkout `D:\js-harness`, which the remote-control
    server runs from, is not brought up to `main`.

## Follow-ups
- F9-part-size-from-one-run: the measurement of 2026-10-09 is one run of each size. If the
  cost of the parts of 400 lines comes to matter, the thing to measure is how often each
  size finds a known defect over several runs of the same range, not one run more.
- F8-a-merge-is-reviewed-with-its-side: see the entry of 2026-10-08 on the fix of the merge.
- F7-gate-near-its-timeout: the gate runs the tests under a bound of 20 minutes, and on
  2026-10-08 the first commit of the second half of T2 was refused once on that bound alone
  ("npm run test timed out after 1200 s", no test failing) and passed on the retry in 1,044
  s for the whole gate. Another session ran its own gate on this machine that evening (seen
  at 18:04 in the worktree `rule-hierarchy-plan`), so the refusal may have been two gates
  at once; the retry and the next commit (1,117 s) had the machine to themselves as far as
  a sample of its processes showed, and that is still within two minutes of the bound. What sets it is one file,
  `bin/codex-review.test.mjs`: 230 tests that each make a real repository, 12 minutes alone
  and more beside the other files. Splitting that file lets the runner spread it over the
  cores; it is a move of thousands of lines, so it is several commits under the review
  bound, and its own piece of work. A cheaper thing to measure first: most of its tests
  build the same few repositories with a dozen git processes each, and a repository built
  once and copied for each test may take a large share of the time off with a small change
  to the helpers. Until then a commit can fail on time, and is retried, and no gate is
  started while another session runs one.
- F2-whole-range-runs-feed-no-estimate: a run line of a range reviewed whole holds no count
  of changed lines, so it never enters the estimate of a plan. Smaller since the first half
  of T2: a one-part range that leaves a file out is asked by its files and logs its part,
  and nearly every slice changes its feature document. What is left is the one-part range
  that changes no document and no marked file.
- F4-prompt-pins-no-submodule-format: the command a part's session is asked to run does not
  pin `--submodule=short`, so the proof pays a second `git diff` a part to compare like with
  like. Pinning it in the prompt removes that process and is a new prompt version.
- F5-marks-that-change: two cases the push check still lets through, both needing a
  project to change its marks. A commit after a record's head removes a mark: the record
  goes on covering a file it left out (it would have to hold the paths it left out). And
  `diff.ignoreSubmodules=all` hides a moved submodule from the size, the patch and the
  list of commits alike, so it is in no review and in no code commit.
- F6-high-figure-widens: the higher figure of an estimate is the most a changed line cost,
  so one very small part in the log, a few lines at a session's fixed cost, will widen it.
- F3-old-git: reading the marks needs git 2.40 (`check-attr --source`). `doctor` could say
  so of a machine with an older one, before a review refuses to start there. The same for
  the merges (2026-10-08, gentle-ai): the log passes `--diff-merges=combined` and a merge is
  asked about with `--remerge-diff`, both older than 2.40, and the entry of a merge is read
  in the shape git 2.54 writes. Another shape fails closed, with a message that names the
  commits and not the version of git.
- F1-what-code-is: closed on 2026-10-08. A range with nothing to review that holds commits is
  recorded as such, and the command and `check` read one definition of what a review reads.

## Next step
In this order, each slice committed when it is green and kept under about 1,300 changed
lines, deletions counted (gentle-ai refused one of 1,571). A defect that is known is fixed before the Codex review of its
slice, and the plan of that review is read first:
1. Every task is done and both branches are in `main` (#43 and #44, 2026-10-09). Nothing
   is left of this feature.
2. F7 before the next feature that adds tests to the command: the gate runs within two
   minutes of its bound.

Waiting for him, from `odd/tasks/codex-review-lean.md`: the proposal for the Codex plugin
(asked on 2026-10-08, not answered: he asked instead why there were so many reviews, which
opened this feature). Push, pull request and merge of both branches are done.

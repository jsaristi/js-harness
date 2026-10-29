# JH 85 · Record and rules-test follow-ups

Started in the background by the lead with `js-harness sessions start`; brief
`~/.js-harness/background/briefs/2026-10-29T13-51-36-468Z-870ca873.md`. Branch `fix/records-follow-ups`, base main
`8c45db81`, worktree `.claude/worktrees/records-follow-ups`, PR 671. Small work by the resume test (each defect was
named with its place and fix where it was found), so no feature document; T5e is ticked in
`odd/tasks/visual-pages.md`.

## Goal
Fix three small defects that today's sessions left written where they found them: Codex's open P2 on `recordOfRows`
(T5e of `odd/tasks/visual-pages.md`), the `said` and `reason` that `landFacts` and `codexFacts` drop (JH 79's
summary), and the rules tests' `owedRegister` fixture that turns every check into owed (JH 80's summary, line 56).

## The user's words
The lead's brief, not Sebastián's: "Three small defects left by today's sessions, each written where it was found.
Read the source before acting; each is a separate work unit, its own test first, its own commit". No message from
Sebastián in this session.

## Delivered
- `7e44ceb5` fix(sessions): keep a session's newer state by its time. `recordOfRows` (`bin/lib/sessions.mjs`) keeps
  a row's status and its place (worktree, branch) by the newest `at`; a tie or an unreadable time goes by record
  order, as before. Test: "rosterOf keeps the newer of a session's states and places by when they were written, and
  record order only for a tie" (`bin/lib/sessions.test.mjs`). T5e ticked; `docs/FAILURES.md` entry
  `record-order-over-time`.
- `8032d170` fix(throughput): keep why a land or a Codex run failed. `landFacts` carries the land record's `said`
  and `codexFacts` the run's `reason` (`bin/lib/throughput.mjs`), each `null` when absent or not a string. Test: "a
  land keeps the last line it said, and a Codex run the reason it was logged with"; the existing `codexFacts` test
  now expects `reason: null`. Entry `failure-cause-dropped`.
- `54fdb18f` test(rules): let the fixture owe a check of a rule declared late. `owedRegister`
  (`bin/rules.test.mjs`) and its inline copy in the `--prove` test (`bin/rules-coverage.test.mjs`) move the
  register's baseline to the day the last rule was declared, so every check can be owed. `owedRegister` takes the
  register text and the rules, with the package's as defaults. Test: "the fixture owes the check of a rule declared
  after the baseline, and every control it gives is well formed". Entry `fixture-refuses-late-check`.
- This summary, `docs/sessions/2026-10-29-jh-85-record-and-rules-test-follow-ups.md`.

## Decisions
- This session: the board keeps status and place each by its own newest time, since a place comes from any notice
  written in a worktree and a status only from four kinds.
- This session: the fixture moves the baseline instead of leaving late checks as checks. Kept as checks, a test
  project would need each check's test and break file, which `rules.test.mjs` projects do not hold. The rule that a
  late rule cannot be owed is still tested on its own (`bin/lib/rules-coverage.test.mjs:103`).
- This session: no independent verifier. No record format changes: the land and Codex records are read as before,
  and the facts gain two optional fields that no snapshot keeps (a throughput snapshot keeps only gates).
- Asked of the lead, not done: the stretch page still says only "land exit N" and "Codex review failed"
  (`bin/lib/stretch.mjs:299-301`, outside the brief's surface); note sent at 14:17Z.

## Evidence
- Each new test fails on main's code and passes on the branch's: a script put main's `bin/lib/sessions.mjs`,
  `bin/lib/throughput.mjs` and `owedRegister` in place for one run each, the branch's tests unchanged: "main pass 0
  fail 1" and "branch pass 1 fail 0" for all three.
- The real case of JH 80, reproduced: with `status-report` (declared 2026-10-29) given a check control in the
  register, main's fixture failed 7 tests of `bin/rules.test.mjs` and 1 of `bin/rules-coverage.test.mjs` (the 8 JH 80
  saw); the branch's failed none. With the real register both files pass, 44 of 44.
- `npm run check` at each commit through the pre-commit gate: PASS on `7e44ceb5`, `8032d170` and `54fdb18f`.
- Reviews of `8c45db81..54fdb18f`: Codex (gpt-6.1-sol, medium), the patch is correct (0.94), no finding, 77,052
  input tokens; Claude lenses reliability and readability, complete, 0 findings, 47,638 input tokens.

## Failures and lessons
- The first commit of defect 1 was refused by the gate: `bin/lib/sessions.mjs` grew to 3431 lines over its ceiling
  of 3424 (`bin/conventions-structure.test.mjs`). Read before the second try; the doc comment was reflowed to 120
  columns and the place's time kept in the row's entry, so the file stayed at 3424. Cost: one gate run (about 4
  minutes). Not a register failure: the gate is that control, working.
- The worktree guard refused a `node -` heredoc in a chain; Edit did the same change.

## Left
- `bin/lib/stretch.mjs:299-301`: show the `said` and `reason` the facts now carry (with the lead).
- The comment in `bin/sessions-background.mjs` beside the start row still says a notice appended between the read and
  the append "is still behind this row (T5e)"; T5e makes the board read it by time, so that sentence is now stale.
  Outside the surface; with the lead.

## Cost
- Time: brief at 13:51Z, this summary at about 14:35Z.
- Gate runs: 4 (one refused, three passed).
- Reviews: Codex 1 run, 77,052 input tokens (estimate was 95,000 to 130,000); the Claude lenses 1 run of 2
  lenses, 47,638 input tokens. No gentle-ai review: the brief asks for Codex and the lenses.
- No eval spend.

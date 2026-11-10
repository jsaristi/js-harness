## Goal
The board, `notify`, `quiet`, `stretch explain`, the wake note and the summary read what they say: one context window
for a session's share, a closed question known by its shape and not by one host string, a failure named by the hour
the page shows, only the wait of a chained line re-armed, one list of the work that keeps the PC on, and a summary
named by the local day.

## Why
Work unit 6 of the audit triage (docs/proposals/2026-11-10-audit-triage.md on `docs/audit-triage`, PR 805), closing
M21, M22, M23, M31, M34 and L7 of the Fable 5.2 audit (docs/audits/2026-11-09-fable-5-2-audit.md on
`claude/fable-5-2-audit-531f8e`) and candidate 20 as far as M34 reaches. Each is a reader that disagrees with
another reader or with the page he reads: two shares for one session, a dismissal stored as his answer, an hour he
types that finds nothing, a push handed back to a booted session as a wait, a lens review or an eval batch that does
not keep the PC on, and a summary filed under tomorrow.

## Done when
- `node --test bin/lib/sessions.test.mjs bin/stretch.test.mjs bin/lib/wake.test.mjs bin/quiet.test.mjs bin/summary.test.mjs` exits 0
- `node --test bin/sessions.test.mjs bin/lib/channel.test.mjs bin/lib/sessions-running.test.mjs` exits 0
- `npm run check` exits 0
- `js-harness notify --to orchestrator --kind ready --pr <n>` records the notice

## In scope / Out of scope
- In: bin/lib/pause.mjs, bin/sessions.mjs, bin/notify.mjs, bin/lib/channel.mjs, bin/lib/sessions.mjs,
  bin/stretch.mjs, bin/lib/wake.mjs, bin/lib/quiet.mjs, bin/quiet.mjs, bin/lib/sessions-running.mjs,
  bin/lib/summary.mjs, their tests, docs/live-board.html (one label), this document.
- Out: bin/lib/background.mjs (`atWork`, PR 801 changes the lines around it); a recorded background session that
  holds work with nothing running (the JH 166 case, a follow-up below); merging (the lead's, after his yes).

## Constraints
- Tests first, red before each fix — because the brief asks it and each reader is read by another session.
- `--context-window` given on the command line still wins — because a test or a person may ask for another window.
- No rule's text changes — because a rule may be his.

## Ask me before
- Nothing beyond the brief: the lead decides scope and merging, after his yes.

## Depth pass
- 1. Method: one fact, one reader. Each finding is two readers of one fact that answer differently; the fix gives
  the fact one home and points the other reader at it, never a second copy kept in step. Searched first: codegraph
  for `DEFAULT_CONTEXT_WINDOW`, `hostWindow`, `QUESTION_DISMISSED`, `explainTarget`, `wakeText`, `QUIET_PROCESSES`,
  `RUNNING_PROCESSES`, `dayOf`; `localMinute` of bin/lib/local-time.mjs is the home of the hour he reads
  (rule:local-time); `chainedStep` and `shellWords` of the guard split a command into words, not into the text of
  each step, so the wake note needs its own split that keeps a step as it was typed.
- 2. Raw material: `bin/lib/sessions.mjs:22` and `bin/sessions.mjs:156` (the board's 500,000),
  `bin/lib/channel.mjs:726` (`notify`'s share, the same default), `bin/lib/pause.mjs:77` (`hostWindow`, read by
  `bin/guard.mjs:226` and `bin/resume.mjs:1017`); `autoCompactWindow` is 350000 in this machine's
  ~/.claude/settings.json. `bin/lib/sessions.mjs:1696` and `bin/lib/sessions.mjs:1759`; the transcripts under
  ~/.claude/projects hold one such string, 11 times: "[User dismissed — do not proceed, wait for next instruction]".
  `bin/stretch.mjs:595` against `bin/lib/stretch-why.mjs:62`. `bin/lib/wake.mjs:75` and `bin/lib/wake.mjs:112`.
  `bin/lib/quiet.mjs:10` against `bin/lib/sessions-running.mjs:13`; `bin/sessions-live.mjs:215` writes the board's
  list into board-checked.json, which `docs/live-board.html:412` labels. `bin/lib/summary.mjs:31`.
- 3. The bar:
  spec 1: `node --test bin/sessions.test.mjs bin/lib/channel.test.mjs`: today a configured window of 350,000 is
  not read; the board and `notify` say a share of 500,000.
  spec 2: `node --test bin/lib/sessions.test.mjs`: today "[User closed the question]" is taken as his typed answer.
  spec 3: `node --test bin/stretch.test.mjs`: today `failure:11:00` in Bogotá does not find a failure at 16:00Z.
  spec 4: `node --test bin/lib/wake.test.mjs`: today `git push origin x && js-harness wait --pr 5` is handed back
  whole (run at 6ee974dd).
  spec 5: `node --test bin/quiet.test.mjs bin/lib/sessions-running.test.mjs`: today `workKindOf` gives null for a
  lens review and an eval batch (run at 6ee974dd: `[null, null, 'land']`), and the board lists no land.
  spec 6: `node --test bin/summary.test.mjs`: today 21:30 of 2026-11-09 in Bogotá names `2026-11-10-…` (run).
- 4. Refutation: could one list of work keep the PC on for less than it should, or for something that does not
  run? A lens review and an eval batch spend for minutes and die with the PC, so they hold it; a review that only
  records a skip (`--unavailable`) and a land with `--dry-run` do not, as today. Could a bracketed answer be his own
  words? Only when it is wholly in brackets and is none of the options, which a typed answer has not been in eleven
  answers read; a false "closed" refuses the copy of that answer, it records nothing false. Could the host window
  differ from what the pause reads? It is the same function, `configuredWindow`, read from the same Claude home the
  board reads transcripts from. Ran the three current functions above at 6ee974dd: each defect reproduces.
  Verdict: supports
- 5. Request: as the Goal. For M22 the first option of the triage, widened to a shape: an answer wholly in square
  brackets that is none of the question's options is the host's own words. For M34 the board's kinds become the one
  list (gate, land, Codex review, lens review, eval batch), read by `quiet` and the board through one `workKindOf`;
  the sessions' own definitions of "at work" stay two, see L3.
  Adds: none

## Specs
1. "one context window for the board, `notify` and the pause" (the triage, unit 6, through the brief of 2026-11-10).
2. "tell a dismissed question by more than one host string, or record an answer that matches no option as
   unverified" (the same).
3. "let `stretch explain failure:<HH:MM>` take the local hour the page shows" (the same).
4. "re-arm only the `wait` part of a chained line" (the same).
5. "one list of the work that holds "do not turn the PC off" (candidate 20)" (the same).
6. "name a summary by the local day" (the same).

## Tasks
- [x] T1 (build) spec 1: the board and `notify` read the host's window as the pause does, tests first: `4bd22c89`.
- [x] T2 (build) spec 2: a bracketed answer that is no option is the host's, test first: `a218390f`.
- [x] T3 (build) spec 3: `failure:<HH:MM>` is the local hour, `<HH:MM>Z` the UTC one, test first: `0bf59f00`.
- [x] T4 (build) spec 4: the wake note keeps only the wait and the `cd` before it, test first: `80993e51`.
- [x] T5 (build) spec 5: one list of work for `quiet` and the board, tests first: `0983e8b4`.
- [x] T6 (build) spec 6: the summary named by the local day, test first: `0bf59f00`.
- [x] T7 (verify) Codex and the lenses on `6ee974dd..e5616f39`, one at a time; findings fixed and rechecked (L6):
  `df0ecca2`, `adf0e803`, `e5616f39`; push, PR, `notify --kind ready`.

## Next step
DONE: every review recorded and clean (L6): Codex correct (0.97) on `adf0e80..e5616f3`, the reliability lens 0
findings on `7e2b1cb..e5616f3`. No file of this branch is changed by any open pull request (`gh pr diff <n>
--name-only` over all 12 open, 2026-11-10 04:05 local). NOW: push, open the PR, send `js-harness notify --to
orchestrator --kind ready --pr <n>` (docs/live-board.html needs republishing after the merge), keep
`js-harness wait --notice-to 168` running. After the merge: the summary and `notify --kind closed --summary <file>`.

## Follow-ups
- The JH 166 case (the brief): at 02:40 local `js-harness quiet --wait` exited 0 while a background session started
  with `sessions start` sat idle with two reviews owed and no wait running. No list of processes holds it: nothing
  ran. What would is a recorded background session that has not sent `closed` counting as work, or the stall reader
  (`readStalled`) feeding `quiet`. Outside this unit; for the lead to schedule.
- The three definitions of a session at work (candidate 20): `atWork` of bin/lib/background.mjs:409 counts a session
  that waits on a prompt, which is right for uninstall (never remove it); `quiet` lists it under "needs you". One
  predicate with two named uses is possible once PR 801, which changes the lines around `atWork`, lands.

## Log
- L1 The brief (2026-11-10T07:54Z): "Yours: exactly what the unit lists and its "Done when". The triage names no
  high-risk item; if you find one while reading (a persisted format, a guard, a contract another command consumes),
  say so in the feature document and treat the slice as high risk. Tests first and red before each fix."
- L2 Checked at the source before any change (6ee974dd): all six true. M21: bin/sessions.mjs:156 defaults to
  `DEFAULT_CONTEXT_WINDOW`, and `senderOf` reads with no window (bin/lib/channel.mjs:726); the pause reads
  `hostWindow`. M22: one prefix at bin/lib/sessions.mjs:1696. M23: bin/stretch.mjs:595 compares `slice(11, 16)`.
  M31: bin/lib/wake.mjs:75 keeps the whole line. M34: bin/lib/quiet.mjs:10 against bin/lib/sessions-running.mjs:13.
  L7: bin/lib/summary.mjs:31.
- L3 High risk, read for: M22 is a guard in part (`answerOf` says "It is a guard, since what it accepts is taken as
  his word"); the change only refuses more, so it can lose a copy of his answer, never forge one. M34 adds `land`
  to the kinds in board-checked.json, which docs/live-board.html reads (docs/RECORDS.md "running"); the page shows an
  unknown kind as its name, and the label is added beside the others. An added value, not a changed one: not high
  risk by item 3. The page is published from the repo; republishing it is the lead's.
- L5 Red before each fix, then green: summary (1 fail, the UTC day), stretch explain (2 fail), quoteOf (1 fail),
  wake (import missing), quiet and the board (2 fail), the window (3 fail). Two modules were at their size ceilings
  (bin/conventions-structure.test.mjs): `agentOfCall` and `workFile` moved to bin/lib/board-files.mjs, so
  bin/sessions.mjs is at 980 lines and its ceiling left the list; the reading of an answer moved to the new
  bin/lib/question-answer.mjs, so bin/lib/sessions.mjs is at 3389 and its ceiling went down to it. Each of the five
  code commits passed the pre-commit gate.
- L6 Reviews. Codex on `30cf902..643d57d`: part 2 correct; part 1 three P2 on the wake note's split (two waits
  serialized by `&&`, a `cd` inside a group the wait is not in, a keyword such as `then` kept), fixed in `df0ecca2`
  and rechecked correct (0.96) on `643d57d..7e2b1cb`. The lenses risk, reliability and resilience on
  `6ee974d..7e2b1cb`: risk and resilience 0 findings; reliability one WARNING, a wait run through a prefix
  (`timeout 600 js-harness wait`, an environment assignment, `nohup`) was dropped and subtracted from `killed`.
  Fixed test first (red: `[]` for the prefixed wait): the program is read after the prefix, the step is handed back
  with it, and a line with no step to re-arm (`bash -c "..."`) stays killed work (`adf0e803`). Codex on that fix:
  one P2, `env JH_X="js-harness wait" js-harness install` became a wait, since the words were found in the
  assignment; fixed test first (red: the install handed back): the program after the prefixes must be the wait
  itself, the dispatcher and its `wait` or wait.mjs, directly or through node.
- L4 Shared files with open pull requests: none of the files in scope is changed by 801-804 or 806-809
  (`gh pr diff <n> --name-only`, 2026-11-10); bin/lib/background.mjs (801) is left alone on purpose.

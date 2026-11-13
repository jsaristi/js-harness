# JH 194 · the lead's wait ends when he is away

## Goal
Make the lead's own `js-harness wait --notice-to orchestrator` end on the AWAY condition that only `js-harness loop
heartbeat` printed, reusing the heartbeat's reading, so the control holds without the lead running a second loop.
Opening read with `js-harness sessions --opening "JH 194 · the lead's wait ends when he is away"`, written by the lead
"JH ORQ · orquestador F8" (93b72703).

## The user's words
"Listo y como hacemos esto?" (2026-11-13), as the opening quotes them; not read again with `js-harness sessions
--quote` by this session: claimed by the lead.

## Delivered
- Pull request 857, merged 2026-11-13T16:53:52Z (`gh pr view 857`):
  - `20f2db71` refactor(loop): the absence reading moved to `bin/lib/lead-away.mjs`; the heartbeat's AWAY tests in
    `bin/loop-bodies.test.mjs` pass unedited; `docs/RECORDS.md` gains the `away/<session>.json` section it lacked.
  - `7ddd5e39` feat(wait): the lead's notice wait prints the heartbeat's `AWAY:` line, one line that it ends for it with
    the same wait to run again, and exits 4; one mark shared with the heartbeat; tests first (5 of 7 new failed before).
  - `b830c50e` fix(wait): the transcript is looked for in every worktree's sessions folder (`projectDirsOf`), whatever
    `--cwd` says; the opening line's endings are built from a list; a test pins exit 4 at the deadline tick.

## Decisions
- This session: exit 4 as a new code, since 0 means the condition holds (advisor's reading, `bin/wait.mjs` USAGE).
- This session: lead only by `isLeadSession`, so a work session's orchestrator wait never reads its transcript.
- This session: the resilience lens's finding (a mark that cannot be written lets the next wait end again) answered,
  not changed; recorded in the body of `b830c50e` and of pull request 857.

## Failures and lessons
- Codex P2 on `ad60b83..7ddd5e3`: a lead in a worktree waiting with `--cwd` at the main checkout found no transcript.
  Found by `js-harness codex-review`; fixed in `b830c50e`, recheck "fixed" (confidence 0.96).
- The first background wait for notices to 194 exited 127: the merge queue refreshed the installed copy under it
  (the queue's note to 194 at 12:32 local). Re-armed once; it then ended on that note.

## Left
- No `Control:` line in `docs/FAILURES.md` `stretch-not-opened` for this change: its 2026-11-13 sighting lands in JH
  193's results pull request; the lead holds it.
- The `AWAY:` line reaching a real lead through a real host is not checked (tests use fakes).

## Cost
- First notice: the opening at 10:50 local; `ready` at 11:39 local; merged 16:53Z. Context at the ready notice: 60%.
- Reviews: Codex twice (about 198k then 71k input tokens), Claude lenses twice (3 lenses, then 2). Gates: three
  commit gates passed, two refused before them (records table, coverage register).

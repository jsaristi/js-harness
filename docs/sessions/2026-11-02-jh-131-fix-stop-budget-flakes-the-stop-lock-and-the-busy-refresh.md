# JH 131 · fix stop-budget flakes, the stop lock and the busy refresh

File: docs/sessions/2026-11-02-jh-131-fix-stop-budget-flakes-the-stop-lock-and-the-busy-refresh.md.

## Goal
Fix three defects that kept costing the lead, from the brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-11-02T10-02-20-253Z-97cbb19c.md`: the stop-budget p90 flakes, the
`sessions stop` worktree lock, and the land's refresh counting a session that only waits as busy.

## The user's words
None in this session: the brief is the lead's, and its specs are quoted in `odd/tasks/defect-trio.md`.

## Delivered
- Pull request jsaristi/js-harness#750, ready, not merged. Branch `worktree-defect-trio`.
- be294cad docs: `odd/tasks/defect-trio.md`, contract and depth pass.
- 5a2639da test(reply): the budget held on the hook's main-thread CPU and its child count.
- fa61c361 fix(sessions): stop waits for the pid claude's lock names, retries on EBUSY, kills nothing.
- 7f918a92 fix(merge-queue): the land's refresh leaves out a busy session whose transcript only waits.
- b9a1512d, 5a411a95, f691a9c6 fix(merge-queue): Codex's findings on what counts as a wait alone; FAILURES entries.

## Decisions
- This session's, his to correct: the budget measure is the main thread's CPU, not the whole process's (L3); a
  line that writes a note before its wait counts as work, the conservative side (L7).
- Not decided: nothing.

## Failures and lessons
- The first `onlyWaits` trusted `isWaitCommand`, a detector made to find waits to re-arm, as proof that a command does
  nothing else; Codex took four rounds to close every shape (compound line, parallel calls, `bash -c`, heredoc).
  A detector written for one purpose is not a guard for another.
- The host compacted this session once (06:10 local); it resumed from the feature document.

## Spent
Codex: 265,080 + 85,136 + 241,056 + 55,508 input tokens (one recheck refused before it ran). Claude lenses: about
28,000 a lens for three lenses, then two lenses at 6,000 to 13,000 for each fix.

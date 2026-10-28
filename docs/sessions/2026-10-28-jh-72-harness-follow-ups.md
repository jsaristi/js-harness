# JH 72 · Harness follow-ups: sessions, addressing, refresh, guard

## Goal
Six defects the lead found running the board, each fixed test-first, one work unit a commit. Opened by the lead with
`js-harness sessions start` from the brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-10-28T15-16-00-845Z-c94e80c8.md`. Branch `fix/board-follow-ups`,
base main `79e3430`; feature document `odd/tasks/board-follow-ups.md` (opened at the lead's answer, below).

## The user's words
None: the session was started by the lead, and its only prompt points to the brief ("Your brief is in
C:\Users\Oficina\.js-harness\background\briefs\2026-10-28T15-16-00-845Z-c94e80c8.md: read it whole before anything
else, and do the work it gives you. Its last section says how you report."). The lead's words are quoted in L2 of the
feature document.

## Delivered
- PR 636 (`fix/board-follow-ups`): ready, told with `notify --kind ready --pr 636` at 18:05:58Z. Merges clean with
  origin/main `b4fdda99` (`git merge-tree`).
- `493e5110` item 3: `sessions stop` names the real worktree, or says it is gone (records held the main checkout).
- `e58323ac` item 1: `--next-number` counts the titles `sessions start` recorded (real record: JH 73, was JH 71).
- `e30ae69d` item 2: `--address` reads recorded sessions' transcripts in their worktree's folder (resolves 68 and 71).
- `ca6cac1c` item 4: `--refresh-copy` waits up to 30 minutes for no session at work, else exit 75; `2e51fff7` looks
  once more holding the gate lock.
- `7d8db831` item 4, the lead's addition at 16:20Z: `update` names a pnpm bin lock it keeps, its age and why. The pin
  needed no change: `refreshHoldingLock` already judges each try by `--version` and the shim's sha.
- `73fc8cf7` item 5: `sessions start --resume <id>`; `c7cd82c6` makes the new job replace the old one (undone
  together), checks every job of the conversation, the effort rule and the record first, and finds a job claude printed
  no id for.
- `3982ae68` item 6: the guard reads a RegExp's own `.exec(` as no string run; `b5d28ae5` keeps the skip only where
  nothing could make exec eval.

## Decisions
- The lead, 12:49 local: (a), a feature document and gentle-ai on every slice, each in its own worktree; no
  whole-branch review. Five slices: A `79e3430..e30ae69d`, B `e30ae69d..7d8db831`, C `7d8db831..73fc8cf7`, D
  `73fc8cf7..3982ae68`, E `a1cd4c58..c7cd82c6`; D and E escalated to high for item 2.
- This session: a resumed job supersedes its predecessor in the record (`resumedAs`) rather than removing it, so
  `claude rm` of the old job waits for the new one's undo. The refresh's look under the lock does not wait: a session
  waiting for that lock is at work, and would wait for the refresh in turn.
- This session: no gentle-ai line was written without a review when the merge door first refused PR 636; the choice was
  sent to the lead with `notify --kind waiting`.

## Failures and lessons
- The first commit carried AI attribution lines, which CLAUDE.md forbids; amended before any push. Later messages were
  written to files.
- `3982ae68` opened a hole on the unsafe side: exec redirected to eval through the prototype or a computed global name
  passed the guard where its parent refused it. Found by the independent verifier; fixed in `b5d28ae5` with every case a
  refused test. Lesson: a pass-list exception in a guard is bounded by what could redefine the thing it trusts.
- A second verifier was cut off by a safety classifier before it ran a case; the independent reading of `b5d28ae5` is
  Codex's recheck and the risk lens's instead.
- The `docs/FAILURES.md` line for the guard regression is left to the lead, outside this session's edit surface.

## Left
- Non-blocking follow-ups from the gentle-ai reviews, listed in `odd/tasks/board-follow-ups.md` ("Follow-ups").
- Not fixed, before this branch too: `node -e "cp.exec('echo x >> <record>')"` passes the guard.
- Outside the brief's edit surface as written: `bin/conventions-structure.test.mjs` (ceilings lowered), `bin/update.mjs`
  (the lead's addition), `bin/lib/refresh-copy.mjs` (the recheck under the lock).
- PR 636's land, and the refresh of the installed copy, by the lead.

## Cost
- Time: 15:16Z (brief) to 18:10Z (closed); one compaction by the host at about 17:00Z; context at 58% at the ready.
- Codex: two recorded reviews, `79e3430..318f952` (incorrect, 2 P1 and 6 P2) and the one-part recheck
  `a1cd4c5..eb669c9` (correct, 0.93; 132,203 input tokens, 95,872 cached). One run was refused at its plan, nothing
  started.
- Claude lenses: one run of four (risk, resilience, reliability, readability) over `79e3430..eb669c9`, 0 findings,
  about 187,000 input tokens.
- gentle-ai: five slices, 11 lens runs (A, B, C one each; D and E four each), all approved and acknowledged.
- Verifiers: two sub-agents, one ran (found the regression), one was cut off.
- Gate: every commit through the pre-commit gate; two pushes through `check --push`. No evals.

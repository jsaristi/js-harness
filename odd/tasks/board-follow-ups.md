## Goal
Fix the six harness defects the lead found running the board (JH 72), each test-first, and land them through the merge
door with Codex, the Claude lenses and gentle-ai on every code commit.

## Why
The board miscounted session numbers, could not address sessions `sessions start` recorded, named the wrong worktree,
refreshed the copy under running sessions, could not resume a job a reboot killed, and the guard refused a read-only
one-liner. Each cost the lead a manual step on 2026-10-28.

## Done when
- `node --test bin/sessions-background.test.mjs` exits 0
- `node --test bin/lib/background.test.mjs` exits 0
- `node --test bin/lib/guard.test.mjs` exits 0
- `node --test bin/lib/merge-queue-refresh.test.mjs` exits 0
- `node --test bin/lib/refresh-copy.test.mjs` exits 0
- `node --test bin/lib/channel.test.mjs` exits 0
- every code commit of `main..fix/board-follow-ups` is named on a gentle-ai line below, and
  `js-harness notify --to orchestrator --kind ready --pr 636` records the notice

## In scope / Out of scope
- In: bin/sessions.mjs, bin/sessions-background.mjs, bin/lib/background.mjs, bin/lib/channel.mjs, bin/notify.mjs,
  bin/merge-queue.mjs, bin/lib/merge-queue-refresh.mjs, bin/lib/refresh-copy.mjs, bin/update.mjs, bin/lib/guard.mjs,
  their tests, docs/sessions/, this document.
- Out: the live-board code, JH 68's and JH 71's files, credentials, ~/.claude, ~/.codex, gentle-ai config, the
  installed copy (the lead refreshes it).

## Constraints
- No evals, no spend beyond the reviews — the brief's words.
- No whole-branch gentle-ai review — CLAUDE.md, and the lead's answer of 12:49.

## Ask me before
- Nothing beyond the brief: the lead decides scope; Sebastián decides spend.

## Specs
1. "js-harness sessions --next-number must count sessions recorded by sessions start."
2. "js-harness notify --to 70 / --to orchestrator must resolve addresses of sessions recorded by sessions start."
3. "js-harness sessions stop e141d3f5 must name the real worktree or say it is gone."
4. "merge-queue --land --refresh-copy should wait, or refuse with a clear message, while work sessions are mid-run";
   the lead's addition at 16:20Z: "verify the pin after the install, instead of trusting the exit code" and "name a
   stale lock it finds, with its age".
5. "sessions start needs a resume path for a background job a reboot killed, or a way to record a job resumed with
   claude --bg --resume <uuid>."
6. "The guard reads a quoted RegExp .exec( in a shell one-liner as code. Add a pass-list case, with a test that it
   still refuses a real write to a review record."

## Tasks
- [x] T1 (build) S3: `493e5110`. S1: `e58323ac`. S2: `e30ae69d`. Slice A: `79e3430..e30ae69d`.
- [x] T2 (build) S4: `ca6cac1c`, `7d8db831`. Slice B: `e30ae69d..7d8db831`.
- [x] T3 (build) S5: `73fc8cf7`. Slice C: `7d8db831..73fc8cf7`.
- [x] T4 (build) S6: `3982ae68`. Slice D: `73fc8cf7..3982ae68`.
- [x] T5 (build) S4, S5, S6, the review fixes: `b5d28ae5`, `2e51fff7`, `c7cd82c6`. Slice E: `a1cd4c58..c7cd82c6`.
- [x] T6 (verify) gentle-ai on slices A to E, each checked out in its own worktree; lines below.
- [x] T7 (verify) `notify --kind ready --pr 636`, then `closed`.

## Reviews
- Codex `79e3430..318f952`: incorrect, 2 P1 and 6 P2; recheck `a1cd4c5..eb669c9`: correct (0.93), 8 of 8 fixed.
- Claude lenses risk, resilience, reliability, readability over `79e3430..eb669c9`: 0 findings.
- Independent verifier on `3982ae68`: a regression, fixed in `b5d28ae5`.
- gentle-ai on `79e3430..e30ae69d` (slice A, worktree jh72-a, reliability, lineage review-5061f72f4352a529): medium,
  approved and acknowledged; three warnings, two suggestions, non-blocking. R3-003 (a same-named main checkout) was
  already fixed in `c7cd82c6`; R3-001 is deliberate (a record that cannot be read is not "none"); R3-002, R3-004 and
  R3-005 are follow-ups below.
- gentle-ai on `e30ae69d..7d8db831` (slice B, worktree jh72-b, reliability, lineage review-b7b30788ed3fc63c): medium,
  approved and acknowledged; two warnings and one suggestion, non-blocking. A failed listing refreshing nothing is
  deliberate; the roots outside the try and the untested projectRoots are follow-ups below.
- gentle-ai on `7d8db831..73fc8cf7` (slice C, worktree jh72-c, reliability, lineage review-88b44e3fd786bfbf): medium,
  approved and acknowledged; four warnings and one suggestion, non-blocking. The duplicate resume, the unrecorded
  timeout and the null session id are Codex's P1 and P2, fixed in `c7cd82c6`; the two test gaps are follow-ups below.
- gentle-ai on `73fc8cf7..3982ae68` (slice D, worktree jh72-d, high (item 2, escalated), risk, resilience, readability
  and reliability, lineage review-9234ca3aa5c75395): approved and acknowledged; four warnings and two suggestions,
  non-blocking. The prototype swap and the computed RegExp name (R1, R3, R4) are the verifier's regression, fixed in
  `b5d28ae5`; R2 (a member call `obj.RegExp('…').exec(` is stripped too) is a follow-up below.
- gentle-ai on `a1cd4c58..c7cd82c6` (slice E: `b5d28ae5`, `2e51fff7`, `c7cd82c6`; worktree jh72-e, high (item 2,
  escalated), four lenses, lineage review-fddbbd284746937b): approved and acknowledged; seven warnings and three
  suggestions, non-blocking. Not real: stillQuiet on an unlanded run (`refreshCopy` returns before the lock when nothing
  landed, bin/lib/refresh-copy.mjs:220), and a branched resume history in older records (`--resume` exists only on
  this branch). Deliberate: a resume refuses a brief it cannot read and names `--brief`. The rest are follow-ups below.

## Follow-ups (non-blocking, from the gentle-ai reviews)
- `--address` ignores lines of the background record it skipped (`recordedFolders`); a skipped line may hold the only
  start of a worktree session, so it should answer "not known", as `--next-number` does (A, R3-002).
- `sessions stop` says a worktree "is gone" when claude never made it (A, R3-004).
- Untested: a non-ENOENT stat error on another folder's transcript, a recorded session with no worktree (A, R3-005).
- `refreshAfterLand` runs `projectRoots` and the wait outside the try that keeps the land record written (B).
- Untested: `projectRoots` with worktrees outside the main checkout (B).
- Untested: a resume whose stopped job claude agents no longer lists at all, the case after a restart (C).
- Untested resume paths: `--model`, `--no-remote-control`, a folder that is gone, claude refusing (C).
- `REGEXP_EXEC` should not match a member call (`obj.RegExp('…').exec(`): a lookbehind for `.`, `$` and a word
  character (D, R2).
- `waitForQuiet` should call `lookOnce` rather than repeat it; `undoSession` could take `started` from its caller (E).
- A resume whose claude exits non-zero after printing an id is refused, as a start is; both could record that job (E).
- The machine uninstall's kept report leaves out a replaced job kept with the job that resumed it (E).
- The unwritable-record test relies on chmod, which root ignores (E).

## Log
- L1 The brief, 2026-10-28T15:16Z: `C:\Users\Oficina\.js-harness\background\briefs\2026-10-28T15-16-00-845Z-c94e80c8.md`.
- L2 The lead at 12:49 local: "Lead: (a). My brief was wrong to say no feature document: the merge door wants
  gentle-ai on every code commit. Open odd/tasks/board-follow-ups.md and review each slice with gentle-ai, each in
  its own worktree. Group the commits into as few work-unit slices as the rules allow. No whole-branch review, and no
  other route."
- L3 The session's state and evidence: `docs/sessions/2026-10-28-jh-72-harness-follow-ups.md`.

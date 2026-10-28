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
- [ ] T6 (verify) gentle-ai on slices A to E, each checked out in its own worktree; lines below.
- [ ] T7 (verify) `notify --kind ready --pr 636`, then `closed`.

## Reviews
- Codex `79e3430..318f952`: incorrect, 2 P1 and 6 P2; recheck `a1cd4c5..eb669c9`: correct (0.93), 8 of 8 fixed.
- Claude lenses risk, resilience, reliability, readability over `79e3430..eb669c9`: 0 findings.
- Independent verifier on `3982ae68`: a regression, fixed in `b5d28ae5`.

## Log
- L1 The brief, 2026-10-28T15:16Z: `C:\Users\Oficina\.js-harness\background\briefs\2026-10-28T15-16-00-845Z-c94e80c8.md`.
- L2 The lead at 12:49 local: "Lead: (a). My brief was wrong to say no feature document: the merge door wants
  gentle-ai on every code commit. Open odd/tasks/board-follow-ups.md and review each slice with gentle-ai, each in
  its own worktree. Group the commits into as few work-unit slices as the rules allow. No whole-branch review, and no
  other route."
- L3 The session's state and evidence: `docs/sessions/2026-10-28-jh-72-harness-follow-ups.md`.

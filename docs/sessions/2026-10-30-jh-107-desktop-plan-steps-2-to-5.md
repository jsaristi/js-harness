# JH 107 · desktop plan: steps 2 to 5

## Goal
Run steps 2 to 5 of `docs/proposals/claude-app-native-sessions.md` section 12, each its own PR with its proof, from the
lead's brief `~/.js-harness/background/briefs/2026-10-30T17-58-12-753Z-8c3a929a.md`. Feature document:
`odd/tasks/f8-desktop-plan.md`.

## The user's words
His answer to question 128, the lead's transcript `0f71b2c6-cbce-43ca-a031-276a4b2c381f`, line 34672 (`js-harness
sessions --quote`): "Sí, arranca el plan (Recomendada)". The lead's later question about the status line was answered
"Elimina todo lo de ccstatusline, completamente y a profundidad" (channel answer, 2026-10-30T18:47:25Z); this session
did not act on it.

## Delivered
- PR 708 (step 2), merged 19:03:39Z: the feature document and step 2's list, sent to the lead as a `note` at 18:06:49Z
  before any removal. Worktrees 9 → 8 (`merge-queue --prune` removed `claude-app-native` after its ignored `.atl/`
  cache was deleted). The 16 stale registrations were listed, each with its `closed` notice; their `sessions stop` is
  the lead's.
- PR 709 (step 5), merged 19:03:39Z: no skill line removed, with the reason for each row. `node --test
  bin/install.test.mjs bin/lib/manifest.test.mjs` 323 of 323; `js-harness rules check` PASS.
- PR 712 (step 3), ready: `docs/audits/2026-10-30-process-hour.md`, 337 `wmic` samples from 18:04Z to 19:04Z.
- The last PR (step 4's record, row 3 to use now, the roadmap section, this summary), ready.
- Step 4's scratch PR 711 (JH 108, started by the lead), merged; main's tree unchanged (`git diff 5d63d3b1 2a134ff9`
  empty).

## Decisions
- This session: step 5 removes no skill line. Rows 3 and 4 are phrases of his rules `session-housekeeping` and
  `recap-effort-line` (R1), and the "when the host gives you a tool" lines stay true for `sessions start` sessions.
  Recorded in `odd/tasks/f8-desktop-plan.md` L4 and L8.
- This session: the raw samples (25 MB, every command line on the machine) are not committed (L6).
- The lead: it ran the step 4 probe, since this session has no desktop session tools (L7).
- His: stopping the `ccstatusline` processes (the lead's question, his answer above).

## Failures and lessons
- Commit `09489509` carried `Co-Authored-By` and `Claude-Session`, which `CLAUDE.md` forbids, and was pushed. It is the
  second sighting of `commit-attribution-from-host` (`docs/FAILURES.md`). A `commit-msg` check was proposed to the
  lead and not built.
- The orphaned status-line processes were reported as "about 4.3 GB": that was their working set. The hour's measure
  found 404 MB private. The lead's question to him carried the inflated figure. Corrected in the audit, the proposal
  and the ready notice of PR 712. Lesson: report private bytes, not working set, for memory a process holds alone.
- The first `merge-queue --prune` removed nothing because gentle-ai's `.atl/` cache is an ignored file; deleted by
  hand, then pruned.
- A `cd` into the shared `.claude/worktrees` folder left the session's cwd outside its worktree and every later
  command refused; `EnterWorktree` with the path brought it back.

## Left
- The lead: `sessions stop` for the 16 stale registrations (step 2's proof passes only then); the two detached
  `merge-queue-10908-*` worktrees; the five busy empty folders (held by an unknown process).
- His (through the lead, R1): the rule changes that would let rows 3 and 4's skill lines move or go.
- The lead: whether to build a check for orphaned status-line or hook processes, and the `commit-msg` check.

## Cost
First notice 18:06:49Z, last before this summary 19:07:25Z. Context about 50% at the end. No Codex or lens review: no
code commit. Gates: the pre-commit gate on each commit (seven). Tests: 323 install and manifest tests once. One hour
of `wmic` sampling every 10 s.

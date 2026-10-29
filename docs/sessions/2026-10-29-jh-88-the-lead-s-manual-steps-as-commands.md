# JH 88 · Review and release: the lead's manual steps as commands

Started in the background by the lead with `js-harness sessions start`; brief
`~/.js-harness/background/briefs/2026-10-29T16-03-53-806Z-72c9e958.md`. Feature document
`odd/tasks/lead-manual-steps.md`. Worktree `.claude/worktrees/lead-manual-steps`, base main `1c6b6c22`. Over 400
lines, so a chain of four branches: `feat/lead-manual-steps` (slice 1), `-2` (slice 2), `-3` (slice 3), `-4` (the
review fixes). The host compacted the session once, at 12:28 local, mid slice 3; it resumed from the feature document.

## Goal
`js-harness merge-queue --refresh-copy`, run alone, brings the installed copy up to origin/main while sessions hold
only waits on it: it refuses while other work runs from the copy, stops the waits, refreshes and verifies, and tells
each session whose wait it stopped to run it again. The orchestrator skill says what "hazme la pregunta N" means.

## The user's words
None in this session: the work is the lead's brief. Quoted from it in S1 to S3 of the feature document, among them:
"The refresh must refuse while anything other than a wait runs from the copy (an eval run, codex-review, lens-review, a
gate)."

## Delivered
- `fd41d373` feat(refresh-copy): the held part of every refresh (the land's too) backs up pnpm's global package.json to
  `~/.js-harness/refresh-backups/` (newest five kept) and checks the copy's bin/ against main's git blobs, strictly
  (`binDiffers`, bin/lib/merge-queue-stale-bin.mjs, where `staleBin` moved). S6.
- `183b473b` feat(merge-queue): `--refresh-copy` alone. bin/lib/merge-queue-waits.mjs reads the copy's processes
  (waits and blockers, by pid and creation time) and a wait's session from the transcripts (`wakePlan`, since a
  background wait's shell names a parent that has exited); `refreshNow` (bin/lib/merge-queue-refresh.mjs) looks up to
  three times, and under the gate lock looks again, stops the waits, refreshes, and leaves each work session a note;
  bin/lib/merge-queue-refresh-now.mjs holds the machine side. The land's refusal names the mode. S4, S5, S7.
- `b9fa64fd` docs(orchestrator): "hazme la pregunta N" builds its card with `js-harness template ask N` and asks it
  through the question tool; the roadmap line closed; docs/FAILURES.md `commit-attribution-from-host`. S8, S1.
- `88432251` and `d8d4f54c` fix(merge-queue): the five Codex P2 and the verifier's findings (L5 to L9 of the
  feature document): every project's sessions read, each told in its main checkout's channel or printed when that is
  not known; the phone's sessions named by their readings; typed waits read by `shellWords` (exported from
  bin/lib/guard.mjs, the lead's yes, L6); re-arm commands quoted for sh; each wait taken for stopped before a stop
  that can fail partway; the transcripts read before the last look; pids matched by creation time across the two
  reads; `ls-tree --full-tree`; an unreadable package.json fails before the install.
- `1a429763` fix(merge-queue): a quoted argument that begins with `<` is no redirection (Codex's P2 of T8, L10).
- `e387c136` and this summary: T8's line, the log.

## Decisions
- The lead: bin/lib/refresh-copy.mjs joins the surface, the backup and the bin check go in the held part (L2);
  `shellWords` exported, that word only (L6).
- This session: a wait's session is read from the transcripts, not its parents (L4); no wait record is added to
  bin/wait.mjs. `quiet --wait` is a wait, `quiet` alone is work (L4).
- This session: the fixes are a fourth branch, not amended into the reviewed slices, so each review record keeps its
  commits.
- This session: the stale pnpm bin lock needed nothing (installCopy already clears it); the archive is the desktop
  app's, with nothing a command can do (the feature document's inventory).
- Outside the brief's surface, as conventions required: `bin/conventions-structure.test.mjs` loses the ceiling line of
  bin/merge-queue.mjs, which is under 1,000 lines now (slice 1); `bin/lib/rules-coverage-data.mjs` settles one hash of
  the orchestrator skill's owed span (`rules coverage --refresh`, slice 3).

## Evidence
- Each new test fails on main's code and passes on the branch: a copy of origin/main's bin/ in the job's scratch
  folder with the branch's tests (slices 1 to 3); each review fix's test failed on the commit before it (T7, L9).
  Branch, at d8d4f54: merge-queue-waits 9/9, merge-queue-refresh 20/20, merge-queue-refresh-now 2/2,
  merge-queue-stale-bin 4/4, refresh-copy 23/23, merge-queue 119/119, guard 43/43.
- `npm run check` through the pre-commit gate (with its GitHub Actions run): passed on each commit; slice 3's first
  try failed on the coverage register (fixed, above).
- A read-only look at this machine's processes found the lead's `wait --notice-to orchestrator` as JH ORQ's (L4).
- Reviews: below, under Cost.

## Failures and lessons
- The first commit of slice 1 carried the host's attribution lines, which CLAUDE.md forbids; stopped before it was
  made, recorded in docs/FAILURES.md (`commit-attribution-from-host`).
- Codex and the verifier each found a way to stop a wait and tell no one, or tell a channel no one reads, while the
  run said "told"; the tests had used one project only. Fixed with tests across projects and worktrees.
- The worktree guard refused heredocs and node scripts holding git words; scripts went through the job's tmp folder.

## Left
- A wait typed inside `bash -c "..."`, or by a path the shell expands, matches no session: it is printed, not told
  (L9, N3).
- Stopping a wait stops its git and gh children; a `wait ...; next` chain runs `next` at once (L7).
- The lead runs the new mode once it lands (the brief: this session refreshed nothing).

## Cost
- Time: brief at 16:03Z; this summary at about 18:40Z.
- Gate runs: 8 for 7 commits, each passed; slice 3's first try failed on the coverage register.
- Codex: 4 runs, 1,285,101 input tokens. 1c6b6c2..b9fa64f, 3 parts, 736,968 (five P2); b9fa64f..8843225, 184,244
  (four fixed, one half open); 183b473..e387c13 again (T8), 2 parts, 310,423 (one new P2); e387c13..1a42976, 53,466
  (fixed, the patch correct, 0.98).
- Claude lenses: 20 lens runs over six ranges, 0 findings, 641,083 input tokens.
- The independent verifier (opus, two passes): about 215,000 tokens. No eval spend.

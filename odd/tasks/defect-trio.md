# JH 131 · three defects that cost the lead: stop-budget flakes, the sessions stop lock, the busy refresh

Locator: `odd/tasks/defect-trio.md` · Engram mirror: `odd/defect-trio/tasks` · Branch: `worktree-defect-trio`
Delivery: one pull request to main · Test runner: `node --test`

## Goal
The reply hook's budget tests pass or fail on the hook's own work whatever the machine's load, `sessions stop` removes a
session whose job process is still ending, and the land's refresh no longer waits on a session that only waits.

## Why
Each one costs the lead a red land or a hand step: the two budget tests left PR 736 and PR 740 out of lands while other
sessions loaded the machine; `sessions stop` refused six sessions since 2026-10-30 because claude's lock still named the
job's process; and `merge-queue --land --refresh-copy` waited its 30 minutes on sessions that only ran a
`js-harness wait`, exited 75, and the lead refreshed by hand. All three are fixes, which `rule:growth-limit` lets open.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/defect-trio.md` exits 0
- `node --test bin/reply-budget.test.mjs bin/sessions-background.test.mjs bin/lib/merge-queue-refresh.test.mjs` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- the pull request is named in `## Log`, with Codex and the Claude lenses recorded over its code

## In scope / Out of scope
- In: `bin/reply-budget.test.mjs`; `undoSession` (`bin/lib/background.mjs`) and its tests in
  `bin/sessions-background.test.mjs`; the quiet look of `bin/lib/merge-queue-refresh.mjs`, the wiring in
  `bin/merge-queue.mjs` and their tests; `docs/FAILURES.md`; `docs/sessions/`.
- Out: the review flow (JH 126, worktree harness-alignment) and `rule/daily-questions` (JH 130): none of their files;
  `merge-queue --refresh-copy` run alone (`refreshNow`), which already stops waits and refuses any other work.

## Constraints
- No check weakens: the budget stays 2500 ms at the 90th percentile over ten runs, on the same fixture, with every check
  doing its whole work — because AGENTS.md holds every check and test.
- A refresh never runs under a session that is really running a command; a session it cannot read is at work — because
  a refresh under a running session breaks its hooks (2026-10-28).
- `sessions stop` kills nothing; it waits for what claude names — because a pid names a process only with its creation
  time (`bin/lib/process-tree.mjs`), and the lock's pid comes as words.
- Codex has about 13% of its week left: one Codex review over the code slice, its cost said before it runs.

## Ask me before
Nothing in this brief is his: three fixes inside shipped behaviour.

## Depth pass
- 1. Method: a timing test is held on a measure the thing under test controls (CPU time, not wall time under shared
  load); a race is closed by waiting for the condition the refusal names, bounded, never by a fixed sleep; a busy flag
  is read from the evidence that sets it, not from a summary of it.
- 2. Raw material: the two red lands, `odd/tasks/refresh-open-apply.md` L10 (PR 736, Defender at 142 CPU s) and
  `odd/tasks/advisor-trial.md` L6 (PR 740); the lead's transcript `0f71b2c6`, `sessions stop` results 2026-10-30T19:59Z
  to 2026-11-01T07:25Z, each "A Claude Code lock on the worktree names a process that is still running (pid N)", and
  at 05:58:47Z pid 48324 "gone" 11 s after the refusal, then EBUSY once; `claude agents --json --all` at 10:05Z:
  JH 130 `status: busy, state: working` while its transcript's turn ended at 09:31:10Z and its only open work is the
  background `js-harness wait --notice-to 130` started 09:30:29Z; the lead, interactive, `idle` with a background wait.
  The code: `bin/reply-budget.test.mjs:218` (the wall p90), `bin/lib/background.mjs:321` (one `claude rm` right after
  `claude stop`), `bin/lib/merge-queue-refresh.mjs:28` (busy by `claude agents` alone).
- 3. The bar:
  spec 1: `node --test bin/reply-budget.test.mjs`: red under ten busy loops, lead p90 9349 ms, work p90 6837 ms (wall)
  spec 2: `node --test bin/sessions-background.test.mjs`: none, new behaviour (stop waits for the lock's process)
  spec 3: `node --test bin/lib/merge-queue-refresh.test.mjs`: none, new behaviour (a busy session that only waits is quiet)
- 4. Refutation: if the hook's own work were what grew under load, a CPU measure would grow too. Run now: the hook with
  a preload that writes `process.threadCpuUsage()` at exit, ten runs each, quiet and under ten busy loops: lead main
  thread 1124-1406 ms quiet and 1139-1358 ms loaded, work session 781-1077 and 874-1015, while wall went from 990-1803
  to 3403-5464 ms. Whole-process CPU (GC and compile threads) 1187-2327 ms. For spec 2, the six pids the refusals named
  are all gone (`process.kill(pid, 0)`: ESRCH), and the lead's later retries removed those sessions.
  Verdict: supports
- 5. Request: hold the reply hook's 2500 ms p90 on its main thread's CPU time and on the child processes it starts,
  which load does not move; let `sessions stop` wait, bounded, for the process claude's lock names and retry while
  claude says files are busy; let the land's refresh read a busy session's transcript and count it quiet only when all
  its open work is `js-harness wait`, in its turn or in the background.
  Adds: none

## Specs
1. "Stop-budget p90 tests flake under load (the merge queue's local run and the gates): they cost red lands. Find them
   (bin/*stop*budget*.test.mjs or by name), make them deterministic without weakening what they prove."
2. "`js-harness sessions stop <id>` leaves a live process that holds the worktree lock (seen on JH 114, 121, 123, 124,
   125, 127), so the worktree cannot be removed after its PR lands."
3. "`merge-queue --refresh-copy` counts a session that is only waiting (a `js-harness wait` in its background, or
   waiting in its turn) as busy and exits 75 after 30 minutes; the lead then refreshes by hand. A refresh must still
   never run under a session that is really running a command."

## Tasks
- [ ] T1 (kind: build) spec 1: the budget held on the hook's main-thread CPU and its child count; red under load first.
  Route: inline.
- [ ] T2 (kind: build) spec 2: `undoSession` waits for the lock's process and retries on EBUSY; tests first. Route: inline.
- [ ] T3 (kind: build) spec 3: the land's quiet look reads a busy session's transcript; tests first. Route: inline.
- [ ] T4 (kind: verify) Codex and the Claude lenses over the code slice; FAILURES `Seen:` lines; PR; ready notice.

## Log
- L1 (2026-11-02, his request through the lead's brief
  `C:\Users\Oficina\.js-harness\background\briefs\2026-11-02T10-02-20-253Z-97cbb19c.md`, "JH 131 · fix three defects that
  keep costing the lead: stop-budget flakes, the sessions stop lock, the busy refresh"; the specs above are its words).
- L2 (2026-11-02, searched before writing): `bin/*budget*` gives only `bin/reply-budget.test.mjs`, the two p90 tests;
  `docs/FLAKY.md` holds no entry for it; `docs/FAILURES.md` has no entry for any of the three symptoms (grep for
  `reply-budget`, `p90`, `sessions stop`, `still running`, `busy`). Reused: `parseTranscript`/`sessionFacts`
  (`bin/lib/sessions.mjs`) for open work and the turn, `isWaitCommand` (`bin/lib/wake.mjs`), `saidBy` and `lostSaid`
  (`bin/lib/background.mjs`), the `exists` idiom of `bin/lib/launcher.mjs:175`.
- L3 (2026-11-02, decided): the budget measure is the main thread's CPU (`process.threadCpuUsage`, Node 24, which
  `package.json` engines and both CI workflows hold), not the whole process's: the GC and compile threads run beside
  the main thread, so on a quiet machine they do not add to his wait, and their CPU varies more under load
  (1187-2327 ms). The wall time of the hook's children is load's, so it is not added; their count is held instead, so
  a check that starts a process is seen. Wall time stays in the diagnostic.

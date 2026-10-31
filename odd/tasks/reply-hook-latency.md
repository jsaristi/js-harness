# JH 116 · reply hook: under its timeout, so no stop skips its checks

Locator: `odd/tasks/reply-hook-latency.md` · Engram mirror: `odd/reply-hook-latency/tasks` · Branch: `worktree-reply-hook-latency`
Delivery: one pull request to main · Test runner: `node --test`

## Goal
The reply hook (`js-harness reply --hook`) does each of its checks on a lead's stop with less work, its 90th
percentile on a lead-sized transcript and channel is at most half its 5-second timeout, and a test holds that budget.

## Why
A timed-out run skips every check of its stop: the reply-state check, the live-board check, the return-page check and
the command-block check. The lead's transcript 0f71b2c6 records 58 timed-out runs in 468 (one stop in eight), and each
new check adds to the hook's time (PR 727 added about 300 ms on the lead). AGENTS.md: a stronger harness is a smaller
one, not a blinder one, so no check is dropped or weakened to get there.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/reply-hook-latency.md` exits 0
- `node --test bin/reply.test.mjs bin/reply-budget.test.mjs bin/lib/stop-wake.test.mjs bin/lib/stale-board.test.mjs bin/lib/return-report.test.mjs bin/lib/person-times.test.mjs scripts/reply-hook-time.test.mjs` exits 0
- the measure before and after, per check, is in `## Measure` with the command that took it
- `node scripts/reply-hook-time.mjs runs --transcript <the lead's 0f71b2c6> --runs 10` prints a p90 of at most 2500 ms
- `node bin/js-harness.mjs failures check` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- the pull request is merged into main, named in `## Log`, with Codex and the Claude lenses recorded over its code

## In scope / Out of scope
- In: `bin/reply.mjs` and its test, the checks it calls (`bin/lib/stop-wake.mjs`, `bin/lib/stale-board.mjs`,
  `bin/lib/return-report.mjs`, `bin/lib/person-times.mjs`) and their tests, `bin/reply-budget.test.mjs` (new),
  `scripts/reply-hook-time.mjs` and its test (new, the measure), `docs/sessions/`.
- Out: the hook's timeout in his settings and in what `install` writes (`replyHookEntry`, `bin/lib/hook-entries.mjs`):
  his value, asked as a recorded question if the fix needs it; the other Stop hooks; `~/.claude`, `~/.codex`,
  credentials, gentle-ai config.

## Constraints
- No check is dropped or weakened, and each answers what it answered before on the same input — because the brief and
  AGENTS.md ask it; the existing tests of each check stay green unchanged.
- The hook still writes nothing — because `bin/reply.mjs` says so and a cache it wrote would be one more file
  `uninstall` must know.
- Tests first: the budget test runs before the cuts and its result is quoted in `## Log`.
- The reply hook is a guard (Task Size high risk, item 2): Codex and the Claude lenses on every code slice and an
  independent verifier after the change's own checks.

## Ask me before
Nothing here is his but the hook's timeout: if the fix needs it changed, a recorded question to the lead
(`js-harness notify --to orchestrator --kind question`, Spanish text).

## Specs
1. The brief: "Measure first, then cut, tests first: say in the feature document where the time goes on a lead stop
   (per check: git calls, the channel parse, transcript reads, the board read), with the command that measured it".
2. The brief: "make the hook's 90th percentile on a lead-sized transcript and channel at most half its timeout,
   without dropping or weakening any check".
3. The brief: "Likely shapes, to confirm or reject with the measure: read the channel and the transcript tail once and
   share them across checks; skip a check whose input did not change since the last stop; cache git answers per
   stop."
4. The brief: "Add a test that holds the budget on a fixture of the lead's size, so a later check that breaks it turns
   red."
5. The brief: "the hook's timeout value in his settings is his: if the fix needs it changed, that is a recorded
   question to the lead, `js-harness notify --to orchestrator --kind question`, Spanish text".
6. The brief: "Ready notice with --pr per slice; summary under docs/sessions/. Done when the measure before and after
   is in the feature document, the p90 is at most half the timeout on the fixture and on the lead's real files, the
   budget test is on main through a PR that passed its reviews, and `npm run check` passes."

## Tasks
- [x] T1 (kind: verify) spec 1: the measure before, per check and in situ — this document's `## Measure`
- [ ] T2 (kind: build) spec 4: the measuring script and the budget test on a lead-sized fixture, run before the cuts
- [ ] T3 (kind: build) specs 2, 3: the cuts, each check answering as before
- [ ] T4 (kind: verify) spec 1: the measure after, on the fixture and the lead's real files
- [ ] T5 (kind: docs) spec 5: the recorded question on the timeout, if the measure says the fix needs it
- [ ] T6 (kind: verify) spec 6: Codex, the lenses, an independent verifier, the PR and its ready notice
- [ ] T7 (kind: docs) spec 6: the summary under `docs/sessions/` and the closed notice

## Measure

### Before (main at `7aac3e43`, 2026-10-31)

In situ, from the hook records of the lead's transcript 0f71b2c6 (60.2 MB, 38,990 lines), each `hook_success` or
`hook_cancelled` attachment of `js-harness reply --hook` (measured with a scratch script this branch turns into
`scripts/reply-hook-time.mjs in-situ`):

| day | runs | timed out | p50 ms | p90 ms |
|---|---|---|---|---|
| 2026-10-27 | 53 | 2 | 1947 | 3968 |
| 2026-10-28 | 119 | 15 | 2620 | 5789 |
| 2026-10-29 | 157 | 33 | 2852 | 6813 |
| 2026-10-30 | 125 | 7 | 1788 | 3708 |
| 2026-10-31 | 14 | 1 | 3370 | 4396 |
| all | 468 | 58 | 2349 | 5511 |

The hook runs beside eight other Stop hooks, all started at once (`stop_hook_summary`, the same transcript, 503
stops):

| Stop hook | timeout s | p50 ms | p90 ms |
|---|---|---|---|
| `gentle-ai review stop-hook` | 60 | 7553 | 17095 |
| `js-harness guard --stop` | 5 | 2240 | 5018 |
| `js-harness backup --hook` | 5 | 2304 | 5309 |
| `js-harness reply --hook` | 5 | 2349 | 5511 |
| codex `stop-review-gate-hook.mjs` | – | 1738 | 3577 |
| orca `claude-hook.cmd` | 10 | 822 | 2429 |

In the 93 stops where the reply hook took over 4 s, `guard --stop` averaged 6125 ms and `backup --hook` 6319 ms; in
the 183 where it took under 2 s, they averaged 1441 and 1527 ms. `guard --stop` alone on the same payload takes
682 ms at p50, `backup --hook` reads two small files. So the in-situ time is mostly the machine's load at a stop
(nine processes started at once, gentle-ai's for seconds), not the reply hook's own work: a hook doing almost nothing
reaches the same p90. Of the 468 runs, 8 judged a reply with a command block (the one check that spawns PowerShell);
they are not the slow ones (p50 1788, p90 4262, no timeout).

Alone, on the lead's real files (payload: its newest reply, `background_tasks: []`, cwd `D:\js-harness`), 10 runs:

| what | p50 ms | p90 ms |
|---|---|---|
| `node -e 0` (node's start) | 148 | 153 |
| `node bin/js-harness.mjs reply --help` (start and dispatch) | 208 | 228 |
| `js-harness reply --help` (the installed shim, cmd.exe and node) | 297 | 349 |
| `node bin/js-harness.mjs reply --hook`, this branch | 1145 | 1636 |
| `js-harness reply --hook`, installed 0.97.0 (before PR 727's check) | 867 | 993 |

Where the in-process time goes on that stop (978 ms in all; each check timed with its io calls wrapped):

| check | ms | of which |
|---|---|---|
| reply state (`replyRefusal`, `closingState`) | 2 | |
| wake (`wakeWarning`) | 423 | transcript read 228 (`readFileSync(file, 'utf8')`, 60 MB), `git rev-parse --git-common-dir` 77, `transcriptMarks` about 115 (its `lastIndexOf` of a marker the lead's transcript does not hold scans all of it backwards), the channel record's parse about 15; then it returns: the lead is no work session |
| stale board (`staleBoardWarning`) | 99 | `git rev-parse` 71, the cursor read 0, the channel parse again about 25; no row waits, so no transcript search |
| return (`returnReportWarning`) | 361 | `git rev-parse` 72, the channel parse again, `personTimesIn` 229 (three full `indexOf` passes, 52, 42 and 27 ms, and the lines they find), the marker search about 40, the rendered record 0 |
| command blocks | 0 | the reply holds none, so no transcript read and no PowerShell |

Single costs on the same file: reading it as a buffer and decoding it, 77–132 ms, against 236–385 ms for
`readFileSync(file, 'utf8')` (Node 24.15, four fresh processes each); `lastIndexOf` of an absent needle, 115 ms,
against 39 ms for `indexOf`; one regex pass for the three marks of `personTimesIn`, 46 ms, against 121 ms for three
`indexOf` passes. Reading the file right after it changed costs the same as reading it unchanged (32–54 ms both, four
rounds), so no on-access scan of a growing transcript adds to it.

### The shapes of spec 3, by the measure

- Read the channel once and share it: confirmed, the record is parsed three times a stop (about 15–25 ms each).
- Read the transcript once: already so (`readOnce`, `bin/reply.mjs`), but its read is the costliest single step and
  can be about three times cheaper.
- Cache git answers per stop: confirmed, the same `git rev-parse --git-common-dir` runs three times (about 75 ms each).
- Skip a check whose input did not change since the last stop: rejected. Knowing the last stop's input means writing
  it somewhere, and the hook writes nothing (`bin/reply.mjs`); the transcript changes at every stop anyway, so the
  checks that read it would never be skipped.
- Found by the measure: the wake check scans the whole transcript before it knows the session is no work session; a
  search for the newest line holding a needle scans backwards three times slower than forwards.

## Log
- L1 (2026-10-31, his request as the lead's brief gives it, `C:\Users\Oficina\.js-harness\background\briefs\2026-10-31T03-00-48-294Z-b392e219.md`):
  "JH 116 · reply hook: under its timeout, so no stop skips its checks". The defect as JH 115's verifier measured it
  (odd/tasks/lead-duty-checks.md, L12): 58 timed-out runs in about 499 stops, median 2331 ms, p90 5511 ms.
- L2 (2026-10-31, the measure before, `## Measure`): the in-situ numbers are reproduced (468 runs of the hook found,
  58 timed out, p90 5511 ms). Bad news first: the hook's own work is about 1.1 s alone; the rest of its in-situ time is
  the load of nine Stop hooks started at once, which takes `guard --stop` and `backup --hook` to the same p90. Cutting
  the hook's work lowers its share of that load and its own time, but cannot alone bring the in-situ p90 under 2.5 s.
- L3 (2026-10-31): searched before writing: codegraph and `bin/reply.mjs`'s callers (only `bin/js-harness.mjs`);
  `js-harness rules` (no rule on hook latency: `agents-budget`, `claude-md-budget`, `contract-run-timeout`,
  `fixed-load-budget`, `review-timeout`, `sensor-timeout`); `bin/**/*.test.mjs` for a timing budget (none holds a
  hook's time); `scripts/` for a measuring script (none). The timeout `install` writes is `replyHookEntry`'s
  `timeout: 5` (`bin/lib/hook-entries.mjs:125`), his settings hold the same 5.

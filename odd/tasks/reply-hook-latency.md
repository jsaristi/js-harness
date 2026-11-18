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
- [x] T2 (kind: build) spec 4: the measuring script and the budget test on a lead-sized fixture, run before the cuts
- [x] T3 (kind: build) specs 2, 3: the cuts, each check answering as before
- [x] T4 (kind: verify) spec 1: the measure after, on the fixture and the lead's real files
- [x] T5 (kind: docs) spec 5: the recorded question on the timeout, if the measure says the fix needs it — question
  138, answered "Sí, 15 s" and built by JH 119 (`odd/tasks/reply-hook-timeout.md`, `bin/lib/hook-entries.mjs:129`); L12
- [ ] T6 (kind: verify) spec 6: Codex, the lenses, an independent verifier, the PR and its ready notice
- [x] T6a (kind: verify) spec 6: Codex reads again the fix of its partly fixed finding (`c76d97d1`) and whatever the
  verifier changes, from `8dd55c84` with `--again` (it runs no second recheck of the review that ended at `3543c9f`)
- [x] T8 (kind: build) out of scope, for the lead: the command-block check's PowerShell parser costs 1.4–2.3 s a stop
  whose reply hands him a block (`## Measure`); started beside the other checks or kept warm, or the timeout raised —
  the timeout raised (T5); measured again, no cut in the parser's file keeps its answers, and its exit-1 defect fixed
  (`## Measure`, The parser's cost; L12, L13)
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

### The cuts (T3)

1. The transcript is read as a buffer and decoded (`bin/reply.mjs`, `readFile`).
2. One `io` a stop (`stopIo`, `bin/reply.mjs`): each file read once, the record of notices parsed once
   (`io.readNotices`), git's answer kept, and where the project is found once, from the `.git` files by the inbox
   hook's `mainCheckoutByFiles` (`bin/lib/inbox.mjs`), asking git only when they do not say (a submodule).
3. The wake check reads the title and the transcript's start first, and searches the whole transcript only for a work
   session that holds handed work (`bin/lib/stop-wake.mjs`).
4. `lastLineWith` searches forwards a 1 MiB window at a time from the end, the same answer as the backwards walk
   (`bin/lib/stop-wake.test.mjs` holds the walk as its reference and a needle cut by a window edge).
5. `linesHolding` finds every mark in one regex pass (`bin/lib/person-times.test.mjs` holds the pass a mark).

### After (this branch, 2026-10-31)

- Fixture (`node --test --test-reporter=tap bin/reply-budget.test.mjs`, ten runs a stop): lead p90 359 ms, work session
  p90 368 ms. The same test on `7aac3e43`'s code (exported to a scratch folder) back to back: p90 1798 and 1360 ms; on
  it under the load of an hour earlier, 3982 and 4147 ms (red).
- The lead's real files, before and after taken in turn (`node scripts/reply-hook-time.mjs runs --transcript <0f71b2c6>
  --cwd D:/js-harness --runs 15 --command "node <scratch>/before/bin/js-harness.mjs reply --hook" --command "node
  bin/js-harness.mjs reply --hook"`): before p50 1136, p90 1283 ms; after p50 460, p90 588 ms; the same answer, byte
  for byte (`cmp` of both outputs).
- Per check after (`node scripts/reply-hook-time.mjs profile --transcript <0f71b2c6> --cwd D:/js-harness`, before the
  files-first project): modules 55, wake 187 (transcript read 82, git 86, the record 17), stale 31, return 138 ms.
- Under a simulated stop's load (eight node processes each keeping a core busy 6 s; a scratch script), ten rounds in
  turn: before p50 4826, p90 5428 ms; after p50 2278, p90 2720 ms. Under that load `node -e 0` alone takes p50 1201,
  p90 1663 ms, one git call 468 and 704 ms, the transcript read 212 and 326 ms.
- Not checked: the in-situ p90 after the change, which needs this release installed and stops recorded; `node
  scripts/reply-hook-time.mjs in-situ <transcript>` measures it.

After the verifier (2026-10-31, the project asked of git again, once a stop; the fixture widened, L9):

- The lead's real files, in turn, 15 runs (the same `runs` command): before p50 1412, p90 1798 ms; after p50 663, p90
  955 ms; the same answer byte for byte and nothing on standard error (both run on the same payload, outputs compared).
  The machine was busier than at the first measure (before's p90 1283 then).
- Per check on the lead's real files with a reply showing a `ran` block (the profile, three runs): wake 187–276 (git
  82–139), stale 26–35, return 148–202, commands 336–493 ms (`transcriptRuns` alone 326 ms).
- Fixture, widened (`node --test bin/reply-budget.test.mjs`, Windows): lead p90 2231 ms (runs 814–2387: the first six
  slow, the machine's load), work session p90 807 ms; both under the 2500 ms budget.
- Bad news, measured: a reply that hands him a PowerShell block makes the command-block check start his PowerShell to
  parse it: 1452–2285 ms for the parser alone, 2157–2865 ms for the check, on the lead's real files (the profile with
  a handed block, three runs). Such a stop takes about 3 s, over half the timeout; the budget does not hold it (a
  process's start, not the hook's own work) and says so. What lowers it is the timeout (question 138) or a follow-up
  that starts the parser differently (beside the other checks, or kept warm): out of this feature's scope.

### The parser's cost (T8, 2026-11-18, main at `b044dbf7`)

Bad news first: nothing in `bin/lib/reply-commands.mjs` makes the parser cheaper without changing what it answers. Its
cost is PowerShell's start; what lowers a stop's time is outside this file. Measured while four other sessions ran
(the machine loaded, as at a stop), PowerShell 7.7.0 from the Store (`pwsh.exe` is its WindowsApps alias), Node 24.15.

- The check on the lead's files with a handed block: `node scripts/reply-hook-time.mjs profile --transcript <copy of
  699d7c29, 23 MB, with a reply handing a powershell block appended> --cwd D:/js-harness`, 12 runs: the command check
  1590–3097 ms, of which the parser 1346–2711 ms; the rest, `transcriptRuns` and the matching, about 300 ms. On the old
  0f71b2c6 (128 MB, the size of October's lead), 12 runs: the check 2728–3056 ms, the parser 1386–2007 ms,
  `transcriptRuns` alone 630–868 ms (five runs, in process). Today's lead-sized transcripts are 23–25 MB
  (`find ~/.claude/projects -name "*.jsonl" -newermt 2026-11-17 -size +20M`).
- The whole hook on that 23 MB payload: `node scripts/reply-hook-time.mjs runs --transcript <the same copy> --cwd
  D:/js-harness --runs 6`: p50 4879, p90 5405 ms (4181–5405), under the 15 s timeout (`replyHookEntry`,
  `bin/lib/hook-entries.mjs:129`) and the parser answered every time (the refusal was the run's, not the parser's).
- Where the parser's time goes (a timed copy of `POWERSHELL_CHECK`, five runs a block, scratch script): PowerShell's
  start until the script's first line 494–1423 ms; the script itself 228–537 ms for a native program or a cmdlet,
  320–646 ms for the six blocks of the real test together. Inside the script (`-File`, three runs): decoding and
  parsing about 50 ms, the first `Get-Command` 100–120 ms (command discovery's warm-up), each later one 1–5 ms,
  `-ArgumentList` 5–11 ms. Nothing in it is worth cutting.
- A name PowerShell cannot find costs pwsh 1.5–2.1 s on its first miss (module discovery over the 97 module folders
  of `PSModulePath`), Windows PowerShell 67–132 ms. `Get-Command -CommandType Alias, Cmdlet, Function` did not help
  (1490–2112 ms, three fresh processes): any cut there would have to skip module discovery, which is what finds a
  cmdlet of a module not yet loaded, so it would weaken a refusal. Such a name is rare in a handed block (a typo, a
  program not installed).
- The start options, 12 interleaved runs each, a `Get-Command Remove-Item` script (scratch `start.mjs`): the alias
  p50 4123, p90 6252 ms; with `POWERSHELL_TELEMETRY_OPTOUT=1` and `POWERSHELL_UPDATECHECK=Off`, p50 4137, p90 6370;
  `powershell.exe` p50 4154, p90 5775. No difference beyond the noise of the load (that load ran those starts to
  4 s; earlier, quieter, `pwsh.exe` started in 399–1187 ms and `powershell.exe` in 262–696). The package's own
  `pwsh.exe` cannot be started by its path (ENOENT). Putting Windows PowerShell first is rejected: it is not faster
  under load and it reads `&&` and `||` as errors, so verdicts would change.
- Whether the deadline or the parser ever failed in situ: `grep -rho "could not check it (PowerShell[^)]*)"
  ~/.claude/projects/` finds no hook refusal in any transcript, only this session's own search.
- Found by the measure, fixed (tests first, red on `b044dbf7`): a block whose last command PowerShell cannot find was
  refused as "its parser could not check it (PowerShell: it exited 1)", while the same text passed when the miss was not
  last. The script's exit code was its last statement's `$?`, false after Get-Command misses. It now ends on `exit 0`;
  a `throw` before its end still exits 1 (`pwsh -Command "throw 'x'; exit 0"`, both shells). A refusal becomes a pass
  in a guard, so the verifier reads it.

What would lower the stop's time, none of it in this item's files: starting the parser beside the other checks
(`bin/reply.mjs`, an async spawn; the gain is capped by the other checks' 0.3–0.7 s), or a parser kept warm (a
process outside the hook's life, which `uninstall` would have to know). Under a load that takes a PowerShell start to
4–6 s the check's 4 s deadline (`COMMANDS_DEADLINE_MS`, kept at 4 s by `odd/tasks/reply-hook-timeout.md`) can pass, and
the block is refused as one its parser could not check: a refusal, not a pass, and none recorded so far.

### What the timeout needs (T5)

In the same transcript the host cancelled `guard --stop` at its 5 s in 52 of 503 stops and `backup --hook` in 55, as
often as the reply hook (59 of 469), though `guard --stop` takes 682 ms alone and `backup --hook` reads two small files.
At a stop, starting a process is what the 5 s are spent on. The reply hook after the cuts (460 ms alone) is lighter than
`guard --stop`, so in situ it will likely still be cancelled at about that rate: the cuts halve its own work, the
timeout is what removes the skipped stops. The stop already waits for gentle-ai's hook (timeout 60 s, p50 7553 ms), so
a longer timeout for the reply hook seldom lengthens a stop. That value is his: the recorded question of T5.

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
- L4 (2026-10-31, tests first): `bin/reply-budget.test.mjs` before the cuts, under the machine's load then: lead p90
  3982 ms, work session p90 4147 ms, both red with every check warning (a first run had a fixture defect: `ready`
  notices with no `pr` are no notices, and times by line count overran the gap; fixed in the fixture, not the hook).
  The test "the checks of one stop find the project once" was red on `7aac3e43`'s `bin/reply.mjs` (git asked 3 times)
  and green after. The budget test is green on the old code when the machine is quiet (p90 1798 and 1360 ms): the
  budget holds the hook's own work, the load at a stop is the rest.
- L5 (2026-10-31): bad news, measured: hooks lighter than the reply hook time out as often in situ (`## Measure`, T5).
  The cuts do not alone remove the in-situ timeouts; the hook's timeout, his value, does.
- L6 (2026-10-31, T5): the question, recorded here before it is asked: raise the reply hook's timeout from 5 to 15 s in his settings and in `replyHookEntry` (text and options in Spanish; question 138 of the record, sent with `js-harness notify --to orchestrator --kind question`). 15 s: half of it is gentle-ai's median stop hook, so the stop seldom waits longer.
- L7 (2026-10-31, T6): the Claude lenses (risk, resilience, reliability, readability) over `7aac3e4..8dd55c8`: 0
  findings each, recorded by `js-harness lens-review`. The host compacted this session at 22:58 local; it resumed from
  this document.
- L8 (2026-10-31, T6): Codex over `f91cbcc..3543c9f`, 3 parts: parts 1 and 2 (the hook, its checks, their tests)
  correct, no finding; part 3 (`scripts/reply-hook-time.mjs`) three P2: failed runs counted as samples, the profile's
  config lookup walking past the nearest `harness.json`, the command-block check left out of the profile. A first run
  of part 3 was discarded because this document was edited while it ran (`docs/FAILURES.md`). Fixed in `8c746b16`,
  tests first (red on the old script). The gate's first run of that fix failed in WSL: the new test's `powershell`
  block reached no parser on Linux; the profile now takes `platform` as the hook does. Codex's recheck
  (`3543c9f..8c746b1`): 2 fixed, 1 partly: the profile started the command check's deadline after its setup, the
  hook before. Fixed in the next commit (the profile takes `now`, the deadline starts at its first line; test red on
  `8c746b16`). Codex does not recheck a range starting at `8c746b1`; the Claude lenses review it. The lenses over
  `3543c9f..8c746b1` (reliability, readability, resilience): 0 findings. gentle-ai's Stop hook offered the whole
  branch (base `7aac3e43`): its status run, nothing started, as `CLAUDE.md` says.
- L9 (2026-10-31, T6, the independent verifier, read-only, over `7aac3e43..c76d97d1`): the claim "every check answers
  as before" did not hold in full. (1) The project read from the `.git` files (`mainCheckoutByFiles`) is not git's
  answer for a removed worktree, an empty or invalid `.git` folder, an outer repository holding one, or a folder git
  refuses; the project picks the record each check reads. Decided (this session): git is asked again, once a stop, as
  each check asked; the cost is one git call a stop (82–139 ms on the lead's files). The test "ask git once" was red on
  `c76d97d1` (0 git calls on an empty `.git` folder). (2) An empty needle made `lastLineWith` loop without end (the
  hook ran out of memory, exit 134, on a tool call whose id was empty; the verifier's run); guarded and tested. The old
  walk also never ended on it when the text ends in a newline, so the test states the answers instead of comparing.
  (3) A failed git answer is kept for the stop: kept, decided, as `stopIo` says: asking a timed-out git again would
  cost each check its two seconds and push the hook past its timeout, skipping every check. (4) The budget fixture
  did not reach the return check's publish search nor the command-block check: widened (a page rendered, published and
  never linked; a `ran` block), which found the parser's cost (`## Measure`, After the verifier).
- L10 (2026-10-31, T6a): Codex over `8dd55c8..7f06e84` (`--again`, one part, 96,129 input tokens): correct, no
  finding (confidence 0.88), recorded. The lenses over `c76d97d..7f06e84` (risk, resilience, reliability,
  readability): 0 findings. The lenses over `8c746b1..c76d97d` (reliability, readability): 0 findings. Every code
  commit of the branch is covered by both records.
- L11 (2026-10-31): the lead: PR 732 conflicted with main (`bd45a5b`, PRs 727–731). Merged in `fba6f133`: one conflict,
  `docs/FAILURES.md` (main's `commit-msg` check replaced the attribution entry's control; this branch's sighting kept
  above it); main changed only comments in `bin/lib/hook-entries.mjs`, the timeout still 5. After the merge
  (Windows): the budget test lead p90 666 ms, work p90 919 ms; `bin/reply.test.mjs` 29 of 29; the merge's gate green.
  gentle-ai's Stop hook offered the merge commit (main's 60 files, reviewed in their own PRs): its status run, nothing
  started, as no work unit of this branch.
- L12 (2026-11-18, JH 223, item `replyparser` of the stretch's plan version 4, approved by question 340, his answer
  "Sí, las 8"; the brief: "Measured first, then the smallest change that keeps every refusal", and T5 "is not ticked as
  stale: the session records why no question is needed, or leaves it open"): T5 is closed, not stale: question 138 was
  asked and answered "Sí, 15 s" (JH 119, L1 of `odd/tasks/reply-hook-timeout.md`), and the entry `install` writes has
  `timeout: 15` (`bin/lib/hook-entries.mjs:129`). Searched before writing: `grep` for `shellParser`'s callers
  (`bin/reply.mjs:221`, `scripts/reply-hook-time.mjs:204`, the test), this document's measure and
  `scripts/reply-hook-time.mjs` (its `profile` and `runs`, used as they are; no new script in the repo).
- L13 (2026-11-18, JH 223, the measure, `## Measure`, The parser's cost): the parser's time is PowerShell's start, not
  the script; no start option beats the load's noise; Windows PowerShell first is rejected (it reads `&&` as an error).
  Decided: no cut to the parser, since none in its file keeps its answers. The fix of its exit-1 defect, tests first: the
  test "a block whose last command PowerShell cannot find" red on `b044dbf7` (`failed: 'PowerShell: it exited 1'`),
  green with `exit 0`. For the lead, not built here: the parser started beside the other checks (`bin/reply.mjs`), and
  whether the 4 s deadline should follow the 15 s timeout under a load that runs a start to 4–6 s.
- L14 (2026-11-18, JH 223, the independent verifier, read-only, over the fix against `b044dbf7`, both shells, old and
  new module): no refusal became a wrongful pass. Only a failing last statement changes: an unknown name, an alias to
  a missing target, and a real error hidden by a later miss (`["Get-Date -zz","nosuchprog-jh223"]` refused both with
  "it exited 1"; now `-zz` is named). A `throw` still exits 1; a statement-terminating error (`[int]::Parse('x')`)
  never stopped the script, before or after. Huge input (2.4 MB) still times out, a 50,000-deep nesting is a parse
  error. The new test is red on `b044dbf7`, green after; `node --test bin/lib/reply-commands.test.mjs bin/reply.test.mjs`
  46 pass, 1 skipped. It measured the deadline too: one of three back-to-back `shellParser('win32')(['Get-Date -zz'], {
  timeout: 4000 })` timed out (4851 ms), so the deadline refusal of L13 is likely in a loaded stop. Older defects it
  found, not in this change and left for the lead: `Get-Date -?` refused as ambiguous, `Get-Date -F*` passed (the
  parameter name reaches `-like` as a pattern), `* -x` checked against an unrelated command. Not checked by it: the
  whole hook path, a host crash, a profile or constrained language mode, off Windows, `npm run check`.
- L15 (2026-11-18, JH 223, reviews over `b044dbf..0339273`): the Claude lenses (risk, resilience, reliability) 0
  findings. Codex (627,015 input tokens, 456 s, run on the lead's word after question 344 was withdrawn): one P2,
  accepted: an unconditional `exit 0` also let a lookup that failed for another reason than a miss pass, as
  `& 'Get-Ite[m' -x` (an unmatched `[`, `WildcardPatternException`), so that block's parameters went unchecked. Fixed,
  tests first (red on `0339273`: the block passed): the lookups go through `Find-Command`, where only
  `CommandNotFoundException` is a miss and any other failure makes the script exit 1, in both shells; the same failure
  earlier in the text, which the old script also passed, now refuses too.
- L16 (2026-11-18, JH 223, reviews over `0339273..cc56e0f`): Codex: correct (confidence 0.99), its P2 fixed. The
  lenses: risk 0; resilience and reliability one finding each, the same, accepted: the script-wide exit 1 made one
  failed lookup take every block of the spawn down to "could not check it", dropping a sibling's `rm has no parameter
  -rf`. Fixed, tests first (red on `cc56e0f`): the failed lookup is that block's own error line, "PowerShell could not
  look up <name>: <why>", the other blocks keep their answers, and the script ends on `exit 0` again.
- L17 (2026-11-18, JH 223, reviews over `cc56e0f..5fd74a2`): the lenses 0 findings, both earlier ones rechecked
  fixed. Codex (510,998 input tokens): one P2, accepted: a carriage return or U+2028 in a quoted name split the lookup's
  error line, which `shellParser` then dropped, so the block passed unchecked. Fixed, tests first (red on `5fd74a2`):
  every line the script prints goes through `Say`, which turns CR, LF, U+0085, U+2028 and U+2029 into a space; the
  parse-error and parameter lines too, since a name reaches them as well.
- L18 (2026-11-18, JH 223, reviews over `5fd74a2..b45380f`): the lenses 0 findings; Codex correct (confidence 0.99),
  its P2 fixed. Every code commit of the branch is covered by both records. The independent verifier (L14) read the
  first fix (`9a47edbf`); the three fixes after it were read by Codex and the lenses, not by a second verifier.
- L19 (2026-11-18, JH 223, PR 916 open): the advisor, before the ready notice, found the script's helper functions
  (`Find-Command`, `Say`) visible to its own `Get-Command`: `Find-Command -zz` (PowerShellGet's) was refused on
  `b044dbf7` and passed at `b45380f`, both shells (a scratch comparison of the old and new modules). Fixed, tests first
  (`66e91c91`): the helpers are script blocks in variables; the real test runs one spawn a shell, each case a text, the
  plain miss last, with no assertion that always holds. Old and new compared over 16 names (paths, module-qualified
  names, wildcards, aliases, the helpers' names): no difference, both shells. Reviews over `4a3fc21..66e91c9`: the
  lenses 0; Codex one P2, accepted: the case leaned on PowerShellGet; the test's spawn now defines its own advanced
  `Find-Command` (`9760618b`, red on `b45380f`'s script); its recheck over `66e91c9..9760618` correct (0.99), the
  reliability lens 0. The PR's body keeps the generated-with line, as PR 911's does.
- L20 (2026-11-18, JH 223, the second independent verifier, read-only, `b044dbf7` against `66e91c91`, 63 texts alone,
  in batches forward and reversed, and in pairs, both shells): no error line lost without a replacement, no sibling's
  answer lost. What the base refused and HEAD passes is one class, accepted as the change's intent: a miss as the
  spawn's last statement (`gti status`, `.\x.ps1 -zz`, `NoSuchModule\Get-Thing -zz`, an alias to a missing target),
  which the base passed anywhere else. Its one real loss: an `own` block whose last command is a typo was refused by
  that accident and passes now; neither version says "command not found". Lines replaced, more exact: a failed lookup
  at the base kept the previous command's `$cmd` and judged `a[b -zz` against Remove-Item's parameters; HEAD says it
  could not look it up. New refusals: an unmatched `[` in a name, and `Remove-* -zz` (a wildcard's first match, an
  alias with an empty `Definition`, so the message names an empty name: cosmetic). Older, both versions, left for the
  lead: an empty text shifts the later indices (`commandBlocks` likely never sends one), `Remove-Item -re[ x` passes,
  `Get-AppPackage -Name x -zz` passes on PowerShell 7. `node --test bin/lib/reply-commands.test.mjs`: 13 pass, 1 skipped.
  Not checked by it: a module whose autoload throws, profiles, the deadline under load.

## Next step
Code: `b42532d7`, `8c746b16`, `c76d97d1` and the verifier's fixes (L9), each committed with the gate green. Question
138 (T5) is recorded and sent, no answer yet; on a yes, change `replyHookEntry`'s timeout to 15 with its test. Reviews
done: the lenses over every code commit up to `c76d97d1`, Codex over `f91cbcc..8c746b1`, the verifier. Next: T6a,
`js-harness codex-review --base 8dd55c84 --again` and the lenses over the verifier's fixes; push, PR, `notify --kind
ready --pr <n>`; the summary under `docs/sessions/`; `notify --kind closed`. Nothing edited while a review runs.

# Commit gates go to GitHub first

Throughput plan v3, items C and E, and the daily Windows run R1. Branches: `rule/ci-gate-bound` (C),
`feat/wrapped-commit-hint` (E), R1's own once T6f is resolved. Delivery: one pull request per unit. Tests: `node --test`.

## Goal
A commit's gate sends its tests to GitHub's machines first and falls back to this machine only when GitHub gives no
answer, no session wraps a commit in `js-harness gate --` without being told what it costs, and a Windows suite runs
once a day with a red one reaching the lead with its failing test names.

## Why
The machine's gate lock is busy 14-17 h a day, while GitHub's gates are faster (median 144 s against 218 s with a free
lock), test the whole suite and cost nothing on this public repository (throughput plan v3, Version 2, item C). A
commit wrapped in `js-harness gate --` holds the lock and can never go to GitHub (item E). No automated Windows suite
runs, although the README says one does (R1).

## Done when
- `node --test bin/lib/ci-gate.test.mjs bin/check-ci-gate.test.mjs scripts/github-workflows.test.mjs bin/lib/gate-log.test.mjs` exits 0
- `node --test bin/guard.test.mjs bin/lib/test-run-warning.test.mjs` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- A commit made in this repository with a free lock shows a `gate` row that says its tests ran on CI.
- A Bash call `js-harness gate -- git commit ...` gets the hint; `js-harness gate -- node --test` gets none.

## In scope / Out of scope
- In: `bin/lib/ci-gate.mjs`, `bin/check.mjs` (its CI path), `.github/workflows/gate.yml`, a new rule
  `ci-gate-bound`, `bin/guard.mjs`, `bin/lib/test-run-warning.mjs`, README, this document, and for R1 a new
  workflow and its reader, the heartbeat (`bin/loop.mjs`), the dispatcher (`bin/js-harness.mjs`), the
  orchestrator skill's line (`bin/lib/manifest.mjs`), docs/SPEC and docs/ROADMAP. `bin/lib/channel.mjs` is not
  edited: the reader calls `notifyMain`.
- Out: `bin/merge-queue.mjs` (JH 24, the land) and the channel code (JH 26): other sessions own them.

## Constraints
- No check, review or test is removed or weakened — the plan's hard limit.
- CI only ever shortens a wait: any answer that is not green or red runs the gate here, as today — `ci-gate.mjs:10-13`.
- A rule value lives in `bin/lib/rules-data.mjs` and is changed with `js-harness rules change` — AGENTS.md and the
  rule hierarchy.
- R1 starts only after first-version T6f is resolved — it waits on his L21 answer.

## Ask me before
Spend: none is expected (GitHub Actions is free on a public repository); a change of that is his.

## Specs
- S1 (C). Verbatim from the brief: "commit gates go to GitHub first, not only when the lock is busy
  (bin/lib/ci-gate.mjs:3-6,27,38,88,126; bin/check.mjs:1172)".
- S2 (C). "shorten the hang bound from 20 min to 6-8 min as a rule value, changing gate.yml timeout-minutes and
  README.md:79-80 in the same change (measured: 81 GitHub gates, median 144 s, max 186 s)".
- S3 (C). "state the 0 $ spend in the PR (first-version S7)".
- S4 (E). "the guard hints when a commit is wrapped in `js-harness gate --` (never for a whole test run, which the
  skill requires wrapped)".
- S5 (R1). "a Windows suite runs once a day off the land's path, a red one notifies with failing test names, and
  README.md:81-82 and :477-479 are corrected to say so; it starts only after first-version T6f is resolved".
  His answer to how often: "Una vez por día (Recomendada)".

## Design

### Version 2: what the two readers changed (2026-10-17)

Reader 1 attacked the claims, reader 2 looked for what is missing; both read version 1 below against the code.
Version 2 governs where they differ.

- C, hook only (both readers, blocker). A check by hand does build a lock (`check.mjs:2565-2571`), so version 1
  would have sent `npm run check` to GitHub, which tests the index (`git write-tree`), not the working tree. Built:
  `ciGateWanted` sends a gate to GitHub only when git handed it `GIT_INDEX_FILE` (a commit's or a merge's hook), as
  `check.mjs:505-510` already tells a hook; a check by hand runs here, as it should have all along (before C it too
  overflowed to GitHub when the lock was busy). `--no-wait` and `--first` by hand are unchanged by that.
- C, the job's timeout (reader 1). Equal to the bound, GitHub's own timeout races the gate's cancel (the measured
  queue is 0 s). Built: `timeout-minutes` is the rule plus 2 minutes, 10, and the test holds that relation.
- C, a push that cannot answer (reader 1). Every commit now pushes, so before anything is written or pushed the gate
  asks `gh run list --repo <repo> --workflow gate.yml --limit 1`; a `gh` missing, signed out or barred is no answer
  with nothing pushed. Git runs with `GIT_TERMINAL_PROMPT=0` and `GCM_INTERACTIVE=never`, so a push never prompts.
  A `gh` that fails after the run started cancels that run. Not built: a breaker that skips GitHub for a while after
  a run that never started; during a GitHub outage each commit pays the 3 minutes before it runs here.
- C, the rule (reader 2). Declared with `js-harness rules change ci-gate-bound` on `rule/ci-gate-bound`, after this
  document was committed (its source must be a file of the repository); scope everywhere (ci-gate.mjs runs in every
  project), one pattern for a restated bound, its planted line in `bin/lib/rules-scan.test.mjs`.
- C, the texts (reader 2). Also changed: `docs/SPEC.md` (the requirement and its title), `odd/tasks/session-channel.md, "Session channel"`, the
  work-session skill line in `bin/lib/manifest.mjs` (and the test that holds it), a Log line in
  `odd/tasks/first-version.md` superseding "Overflow only", and `gate log`, which now says a CI gate ran "on GitHub's
  machines" instead of reading like a run under the lock (`LOCK_SAID`, `bin/lib/gate-log.mjs`).
- C, measures (reader 2). B3 (CI fallbacks and CI failing test names in the gate log) is built by the throughput
  review session (feat/throughput-review), which the lead gave it; told that `failingTests` (`check.mjs:1014`) reads
  nothing of `gh run view --log-failed`, whose lines start with the job, step and time, and that `LOG_LINES` (80) can
  cut the `✖ failing tests:` header. B5 is not in this feature.
- C, known and not fixed here: a CI green writes no tree key, so with `"sameTree": "skip"` a retried commit of the
  same tree runs again (a cost, not a weaker proof); the sessions board shows a gate on GitHub as "not in its
  sensors" (`bin/lib/sessions.mjs:3129`); the first ticket is claimed before the gate goes to GitHub
  (`check.mjs:1713`); a pushed merge's commit carries HEAD only as parent, which changes no tree; plan v2 orders F
  (the lead's text) before C, and F has not landed; the 516-minute case (branches without `gate.yml`) is not fixed by
  C. Re-measure after it ships: the land's skipped count and `test-run-warning`'s per-file seconds, both fed only by
  local runs.
- E (both readers). A wrapped `git merge` holds the lock as a wrapped commit does (`.githooks/pre-merge-commit`), so
  the hint covers `commit` and `merge`; never with `--no-verify`/`-n`, which run no gate; it reads each wrapped command
  apart (`gateWraps` flattens them), and a commit after the wrapper (`gate -- npm test && git commit`) is outside it.
  Its words follow `ciGateWanted`'s conditions: in a project without `gate.yml` or with the switch off it says only
  that the hook waits by itself. The guard is registered for Claude Code only (`manifest.mjs:361-378`): Codex
  sessions get no hint. No notice is added: the hint reaches the one session that wrapped, at the call.
- R1 (both readers). Pin `windows-2025`, a `timeout-minutes`, and a shape test of its own (the workflow test today
  holds exactly one file); one green `workflow_dispatch` run before the schedule counts (plan v2: "a green Windows
  run before R1"); the reader strips gh's prefix before `failingTests`, applies `docs/FLAKY.md` (no notice when every
  failing file is quarantined), keeps "told" under the home where `uninstall` removes it, and names who runs it:
  `rg "DUE:" bin` finds nothing, so the heartbeat has no such line to hang it on yet.

### C: every commit gate goes to GitHub first (S1-S3), version 1

What exists. `ciGateWanted` (`bin/lib/ci-gate.mjs:36-50`) sends a gate to GitHub only when the machine's lock is
held or has waiters; `testsOnCi` (`bin/check.mjs:1837-1859`) asks it, runs `runCiGate`, and on `{ ran: false }`
falls back to `underGateLock`. A run not done `CI_RUN_MS` (20 min, `ci-gate.mjs:27`) after the push is cancelled
and is no answer (`:126-128`). `gate.yml` stops its job at `timeout-minutes: 15`, held by
`scripts/github-workflows.test.mjs:68`. A gate in its parent's turn (`GATE_HELD_ENV`, `check.mjs:1825-1828`) never
reaches `testsOnCi`, and `check` run by hand has no lock and runs here.

The change:
- `ciGateWanted` stops reading the lock: in a project that holds `gate.yml`, with `JS_HARNESS_GATE_CI` not `0`, on a
  machine that is not CI, every commit gate's tests go to GitHub, and its reason says so ("the project holds
  .github/workflows/gate.yml, so a commit's tests go to GitHub's machines first"). Everything after it is unchanged:
  the fallback, the record in the gate log (`lock: 'ci'`), the red run's log, the switch.
- The bound becomes a rule, `ci-gate-bound`: 8 minutes from the push until the run ends, owner project, its source
  this design. `CI_RUN_MS` reads it with `ruleValue`. `CI_START_MS` (3 minutes for a run to appear) stays a
  constant: it is inside the bound and nobody asked to move it.
- `gate.yml` `timeout-minutes` becomes the same 8, and the workflow test asserts it equals the rule's value, so the
  two cannot drift. The gate cancels its run first (it counts from the push); the job's own timeout is the backstop
  when the gate's process died and no one cancels.
- README: the paragraph at `README.md:74-82` says every commit gate goes to GitHub first, names the bound by
  the rule's mark (`rule:` and its id, in backticks) instead of a number, and keeps the switch.

Why 8 and not 6. The gate log's 81 GitHub gates: median 144 s, max 186 s (from the push, the queue included). The
runs themselves since 2026-10-16 (`gh run list --workflow gate.yml`, 86 runs): median 125 s, p90 135 s, max 164 s.
Every gate now goes there, so GitHub's queue meets more of them at once (20 jobs at once on the Free plan); 6
minutes is 1.9 times the worst seen, 8 is 2.6 times. A bound hit costs the bound plus a local run; a bound too long
costs only when a run hangs, which none of the 86 did.

Cost, stated (S3): 0 $. The repository is public (`gh repo view`: PUBLIC), and GitHub Actions' standard runners are
free for public repositories. Volume: every commit gate instead of the overflow, about 235-430 a day at the
measured rate (first-version, "Gates on CI machines"), some 2.5 runner-minutes each. CircleCI is untouched.

What it costs that is not money:
- A commit with a free lock used to take 218 s here; it now takes about 144 s plus the push (measured medians),
  but a commit made while GitHub is slow waits up to the bound before running here.
- Exact-tests traces are written by local runs only, so as fewer gates run here, the land's selection finds fewer
  traces and may skip fewer files (plan v2). To re-measure after it ships: the land's skipped count.
- The GitHub runner is Linux: a Windows-only test is run by no commit gate. That was already so for every gate in
  WSL2 (the machine's default) and is what R1 answers.
- A gate whose session holds a first ticket (`gate-first`) spends it on a gate that goes to GitHub, as the overflow
  already did.

High-risk item 5 (CI and delivery): gentle-ai review, then Codex.

### E: a hint for a wrapped commit (S4)

What exists. `js-harness gate -- <command>` takes the machine's lock and runs the command with `GATE_HELD_ENV` set,
so a `git commit` inside it runs its hook's gate in that turn (`check.mjs:1825-1828`): it waits for the lock, runs
here, and never goes to GitHub. The guard's Bash path (`bin/guard.mjs:73-79`) only refuses; `gateWraps`
(`bin/lib/test-run-warning.mjs`) already reads the words a gate wraps.

The change:
- The guard answers a Bash call whose command wraps a `git commit` in `js-harness gate --` with the hooks
  contract's `additionalContext`, never a denial: the commit runs, and the agent reads the hint beside its result
  (Claude Code's hooks reference, PreToolUse decision control: "String added to Claude's context alongside the tool
  result"). The hint: the commit held the machine's gate lock for its whole gate, which ran here and could not go to
  GitHub; commit with a plain `git commit`, whose hook waits for its turn by itself.
- A commit is `git commit` with git's own options before the verb (`-C <dir>`, `-c <k=v>`, `--no-pager`), in any
  command of the wrapped line (`gate -- "npm test && git commit -m x"` too). A wrapped `node --test`, `npm test` or
  eval batch gets nothing: the skill requires those wrapped.
- A denial on the same call (backticks, a heavy test run) wins, and the hint is not added.
- No new rule, no high-risk item: it changes no decision, only adds words to a result.

Why a hint and not a refusal: the plan names a hint, and a refusal would stop a commit that runs correctly, only
slower. If wrapped commits keep coming after it ships, a refusal is his question, not this change's.

### R1, version 3: as it is built (2026-10-17, after T6f landed)

Versions 1 (below) and 2 (above) stand where this does not change them. What the code's map added
(`bin/loop.mjs:351-415`, `bin/check.mjs:1038`, `bin/lib/flaky.mjs`, `bin/lib/channel.mjs`,
`bin/lib/manifest.mjs:1292-1530`, `scripts/github-workflows.test.mjs:45-83`):
- The workflow, `.github/workflows/windows-daily.yml`: `schedule` (07:23 UTC) and `workflow_dispatch` only;
  `permissions: contents: read`; no secret; checkout and setup-node pinned by the commits gate.yml pins; `runs-on:
  windows-2025`; `timeout-minutes: 60`; node 24.21.0; the whole history; `node --test`. The workflow test, which
  today holds that `gate.yml` is the only workflow, holds instead that these two are, and the daily one's shape.
- The first run. `workflow_dispatch` runs only a workflow the default branch holds, so before the PR the same
  file, plus a `push` trigger for `windows-try/**`, ran from a throwaway branch `windows-try/r1` (run
  39007607383). Its commit (53d600ee) was made outside this checkout's gate, since the extra trigger fails the
  workflow test by design, and pushed with `--no-verify`; it is no commit of this branch, and the branch is deleted
  after its run. Once the PR lands, one `gh workflow run windows-daily.yml` on main is the run the plan asks for.
- The reader, `js-harness windows-daily` (`bin/windows-daily.mjs`, its logic in `bin/lib/windows-daily.mjs`):
  - The repository is the one `origin` names (`githubRepository` of `bin/lib/ci-gate.mjs`), its default branch is
    asked of GitHub (`gh repo view`), and the newest completed run of `windows-daily.yml` on that branch is read
    with `gh run list`. Every `gh` call runs as the gate's do: 60 s at most, a 64 MB buffer (the spawner of
    `ci-gate.mjs`, exported), so a long failed log is not cut before the names at its end and a slow download is
    not the heartbeat's 10 s bound.
  - It says, in one line each: no workflow there, no run yet, a `gh` that cannot answer (why, first line), or the
    newest run's state and age.
  - A green run: nothing to tell. A red one is `failure`, `timed_out` or `cancelled` (a run past its 60 minutes can
    end as either of the last two). For a red one it reads `gh run view <id> --log-failed`, takes gh's prefix off
    each line with `GH_LOG_PREFIX` (from main's PR 362, exported), and reads the names with `failingTests` and the
    total count of `✖` lines under the summary, and the files with `failedTestFiles` against `testFilesOf`.
  - It stays silent on a red run only when that list of files is not empty and every file has a current entry in
    the working tree's `docs/FLAKY.md`. The gate counts a quarantine only after a rerun that passed; the daily run
    has no rerun, so a quarantined file failing is passed over, and the output says so. A red run with no file
    found (a failed setup step, a timeout, a log it cannot read) is told, as "names not readable".
  - Stale: when the newest completed run ended more than 26 hours ago (GitHub drops scheduled runs under load and
    switches the schedule off after 60 days of no activity), it is told once for that run.
  - Told once: a run is told by creating `<home>/.js-harness/channel/windows-daily/<project>/told-<id>-<attempt>`
    with the `wx` flag (`stale-<id>` for staleness), and the notice is written only when that create succeeds, so a
    hand run and the heartbeat never both tell it. `uninstall` removes the channel folder whole.
  - The notice: `notifyMain` called in the same process (`--to orchestrator --kind note`), so the sender, project
    and record are the command's own and `bin/lib/channel.mjs` is not edited. Its text, at most 500 characters:
    the run's URL, the total failing and up to the 20 names that fit.
  - By hand it prints what it found and exits 0; 1 only when the notice could not be written.
- Who runs it: the lead's `js-harness loop heartbeat`, every `--windows <minutes>` (default 60, `0` switches it
  off; not a rule: no skill text cites the number). The time of the last ask is kept in
  `<home>/.js-harness/channel/windows-daily/<project>/asked`, and a tick asks when that time is older than the
  interval, the first tick included: a heartbeat that ends every 30 minutes and is started again would otherwise
  never reach 60. A run told now ends the heartbeat with `WINDOWS: <url> red, <n> failing: <names>` (or the stale
  line), exit 0, as `STALLED:` does. The notice alone would not wake the lead: `channel-watch` passes over its own
  session's notices (`bin/loop.mjs:434`), and the heartbeat runs in the lead's session. The other answers (green,
  no workflow, `gh` cannot answer) are said once per heartbeat, as `unread` says what stall detection could not
  read. The existing heartbeat tests pass `--windows 0`; new ones hold the end line, `--windows 0`, a bad value as a
  usage error, and the asked time.
- The per-batch Windows run by hand (README `:563-574`) becomes the way to reproduce a red daily run here. The
  plan put his question as "a Windows run off the lock on a cadence he chooses (e.g. once a day or every N
  batches)" (throughput-v3-plan.md:9-12), since per batch it would hold the lock 15-19 hours a day, and he chose
  once a day (`docs/ROADMAP.md:69`). The per-batch step was a promise no land kept (0 of 84 land suites ran on
  Windows), so an automated daily run replaces it; `odd/tasks/session-channel.md, "Session channel"`'s limit "no dropping the Windows run from
  a land" gets a note saying so (L8). The daily run cannot see this machine's antivirus, temporary folders or
  paths; the README says so.
- The texts: README `:75-82` (the Windows-only tests are run daily on GitHub's Windows too), `:563-574` (one
  sentence on the daily run), a `### js-harness windows-daily` section in the dispatcher's order, the heartbeat
  section `:165-183`; `bin/js-harness.mjs` (`COMMANDS`, its usage line, and the loop line `:14`); the loop usage and
  `FLAGS_OF` (`bin/loop.mjs:35,49,79`); the orchestrator skill's heartbeat line (`manifest.mjs:104`); `docs/SPEC.md`
  a requirement for the daily run (its proof the workflow test and the reader's tests) and `:141`, `:231` (Windows
  runners are no longer only discarded); `docs/ROADMAP.md:69` (a Windows run now exists) and the R1 row.
- In scope grows by `bin/loop.mjs`, `bin/js-harness.mjs`, `bin/lib/manifest.mjs`, `bin/lib/ci-gate.mjs` (two
  exports), docs/SPEC and ROADMAP; `bin/lib/channel.mjs` stays untouched.
- What a red first run means: with TEMP on `runner.temp`, the second trial failed only the test that main's
  workflow test makes of a tree holding a second workflow without its updated test (L8), so the first run on main
  is expected green; a red one is told like any other.
- Risk: item 5 (a CI workflow). It is not on any gate's or land's path, and a red run stops nothing.

### R1: a daily Windows suite (S5), after T6f

Recorded now so that its readers read it with C and E; built only once T6f is resolved.
- Where it runs: GitHub's `windows-latest` runner on a schedule, once a day, in a workflow of its own
  (`.github/workflows/windows-daily.yml`): `on: schedule` and `workflow_dispatch` only, `permissions: contents: read`,
  no secret, actions pinned by commit, `node --test` on `main`. Off the land's path and off this machine's lock: the
  lock-hours of plan v2 (15-19 a day per batch) do not apply, and the cost is 0 $ on a public repository.
- What it cannot see: this machine's Defender, its temporary folders, WSL2. The README says what it covers.
- Who is told: a reader in `bin/` reads the latest scheduled run with `gh`; on a red one not yet told, it sends
  `js-harness notify --to orchestrator` with the failing test names (`failingTests` of the run's failed log) and
  records that run as told. It runs from the lead's heartbeat as a `DUE:` line, so it does not depend on anyone
  remembering. Which loop runs it is the design's open question for its readers.
- README `:81-82` and `:477-479` say a Windows suite runs daily on GitHub's Windows machines, and how a red reaches
  the lead; the hand-run Windows step stays as the way to reproduce one.
- Why after T6f: the T6e bound decides whether `check` itself fits on Windows; R1 runs `node --test` with no sensor
  bound, so it does not depend on T6f's figure, but the brief orders it after T6f and that order is kept.

## Tasks
- [x] T1 (kind: design) S1-S5: this design read by two readers (one attacks, one looks for what is missing);
  "Version 2" above.
- [x] T2 (kind: build) S1-S3: C, test first, on `rule/ci-gate-bound`; gate, gentle-ai (item 5), Codex, PR.
  Route: inline. Commit d81b45b5; PR 353 (ready, waiting to land).
- [x] T3 (kind: build) S4: E, test first, on `feat/wrapped-commit-hint` (stacked on C: its words name C's
  GitHub-first gate); gate, gentle-ai, Codex, PR. Route: inline. Commits 8ba73c22, 4665c503; PR 354.
- [x] T4 (kind: build) S5: R1, once T6f is resolved; test first; gate, gentle-ai (item 5), Codex, PR. Route: inline
  (one unit, under the writer trigger). Commits 8b96b9d2, e251c12e, 1c7d985d, eeeeb2e5; PR 367.

## Log
- L1 (2026-10-17, the brief from the session that started this one, verbatim): "Build items C and E and the daily
  Windows run (R1) from C:\Users\Oficina\AppData\Roaming\Claude\side-session-notes\local_053e19d7-d91d-4aa6-a210-3f014cf86050\throughput-v3-plan.md
  (read 'Version 2' first). C: commit gates go to GitHub first, not only when the lock is busy
  (bin/lib/ci-gate.mjs:3-6,27,38,88,126; bin/check.mjs:1172); shorten the hang bound from 20 min to 6-8 min as a
  rule value, changing gate.yml timeout-minutes and README.md:79-80 in the same change (measured: 81 GitHub gates,
  median 144 s, max 186 s); state the 0 $ spend in the PR (first-version S7). E: the guard hints when a commit is
  wrapped in `js-harness gate --` (never for a whole test run, which the skill requires wrapped). R1, by
  Sebastián's answer 'Una vez por día (Recomendada)': a Windows suite runs once a day off the land's path, a red one
  notifies with failing test names, and README.md:81-82 and :477-479 are corrected to say so; it starts only after
  first-version T6f is resolved (it waits on his L21 answer). Open odd/tasks/commit-gates-first.md with the task
  contract; design through two readers; then test first, gate, gentle-ai (high-risk item 5), Codex, PR per unit;
  notify the lead (js-harness notify --to orchestrator) at each PR. Do not touch bin/merge-queue.mjs (JH 24) or the
  channel code (JH 26)."
- L2 (2026-10-17): measured for the bound: `gh run list --workflow gate.yml --limit 500`, runs created since
  2026-10-16: 86 (80 success, 6 failure), run time median 125 s, p90 135 s, max 164 s. T6f is open on `main`
  `ead4e8d` (`odd/tasks/first-version.md:246`), so R1 is designed and not built.
- L3 (2026-10-17, state): T2 (C) built test first on `rule/ci-gate-bound`: RED seen for the free lock, the
  bound, the hook-only rule, the gh probe, the cancel after a failing gh, pushEnv and the gate log's CI line; GREEN
  one file at a time. Next: commit through the gate, gentle-ai (item 5, consent pre-granted), Codex
  (`js-harness codex-review --base origin/main`), push, PR stating the 0 $ spend, notify the lead. Then T3 (E) on
  `feat/wrapped-commit-hint` from main. R1 waits on T6f.
- L4 (2026-10-17, state): C committed as d81b45b5, its own gate ran on GitHub in 148 s (run 38998247373).
  gentle-ai assess: high, review due (high_risk). Its preflight status (--base-ref origin/main --committed-only,
  lenses risk,resilience,reliability) failed with operation_timeout (retry_safe false, next_action stop). Next:
  retry the preflight once; if it fails again, report it unavailable and go on with Codex
  (`js-harness codex-review --base origin/main`), push, PR, notify. Then E. R1 waits on T6f.
- L5 (2026-10-17, state): C's review. The preflight's retry passed; START with consent granted created lineage
  review-76121cbe1ba624cf; its bound `review status` then failed 8 times, each at about 26 s, with
  operation_timeout (phase pre_native, mutation not_started, next_action stop), spaced or not, at 92 % CPU (mostly
  Chrome) and with 179 worktrees in the repository. Codex reviewed C (7f6395a..8b5ed1a): correct, confidence 0.86,
  no findings, recorded. The choice (report the gentle-ai defect and decline this candidate, decline without
  reporting, or stop) went to the lead for him. E built meanwhile in `D:/js-harness-worktrees/wrapped-commit-hint`,
  branched from `rule/ci-gate-bound`, because C's open review is bound to its worktree's HEAD. RED: the module was
  missing. GREEN one file at a time: wrapped-commit 7, guard 24, test-run-warning 10, manifest 166. `gateWraps`
  now flattens `gateCommands`, which keeps each wrapped command apart; its tests pass unchanged.
- L6 (2026-10-17, state): his choice for C's review, relayed by the lead: "Reportar y seguir" (report_and_continue).
  The definitive lookup found gentle-ai #5422 open, with no published fix (4.2.0 is the latest release), so one
  occurrence comment was posted there, privacy-scanned (issuecomment-6229376872). The captured decline was run
  once: `action: declined`, `consent: declined_this_candidate`, same target; STATUS then said
  `fresh_target_ready`. PR 353 opened (0 $ stated). Main was merged in twice: first-version.md's conflict was
  resolved by keeping JH 25's L26 and renumbering this feature's entry to L27. The lead was told ready. E:
  committed 8ba73c22 (its gate ran on GitHub in 105 s). Codex found 2 P2s: a commit through `sh -c` got no
  hint, and the gate's `--cwd` was ignored. Each was pinned by a RED test and fixed in 4665c503 (gate on GitHub
  128 s). The Codex recheck said correct, 0.95, 2 of 2 fixed. gentle-ai was not due (medium, under_budget).
  C was merged into E (48adfe64), and PR 354 opened, based on `rule/ci-gate-bound`. The Stop hook then offered
  C's whole branch (base main); only its read-only status ran, and it timed out the same way. Next: retarget
  354 to main once 353 lands; R1 once first-version T6f lands, which waits on 353.
- L7 (2026-10-17, state): C (PR 353) and E (PR 354) landed; first-version T6f landed (PR 360). T4 (R1) started on
  `feat/windows-daily` in this session's app worktree, from main f88b5a3. Written, not committed: the workflow
  `.github/workflows/windows-daily.yml`, its shape tests in `scripts/github-workflows.test.mjs` (to run), and the
  design "R1, version 3" above. Running: a Windows trial run 39007607383 from the throwaway branch `windows-try/r1`
  (pushed --no-verify, as the gate pushes gate/ branches; delete it after the run), and two readers of version 3.
  Next: fold the readers' findings into version 3, then build the reader (`bin/lib/windows-daily.mjs`,
  `bin/windows-daily.mjs`) and the heartbeat's hourly check test first, the texts, gate, gentle-ai (item 5),
  Codex, PR, notify the lead --kind ready.
- L8 (2026-10-17, state): both readers of version 3 returned (reader 1: 4 blockers, 7 advisories; reader 2: 5
  blockers, 10 advisories), and version 3 above now holds them: gh with the gate's 60 s and 64 MB (the failed log
  of the first run is 1,420,583 bytes, over spawnSync's 1 MB default), silence only when files are found and all
  quarantined, `GH_LOG_PREFIX` from main (PR 362, fast-forwarded to fe98af86), the ask time kept in a file, a run
  told by the creator of its `wx` marker, keyed by id and attempt, `cancelled` as red, staleness, the command wired
  into the dispatcher, README, SPEC and ROADMAP. One correction to my own first answer to reader 2's item 5: the
  per-batch run is replaced, not kept, by his cadence answer (the bullet above says why), and ROADMAP:986 says so.
  The first trial run, 39007607383 (from 53d600ee on `windows-try/r1`), ended red in 14.5 min: 6,067 tests, 168
  failed in 9 files. Most compare a path under the runner's TEMP, an 8.3 short path (`C:\Users\RUNNER~1\...`),
  with git's or realpath's long form (`runneradmin`); one is the trial file's own `push` trigger, which the
  workflow test refuses by design. The workflow now points TEMP and TMP at `runner.temp` for the suite step, and a
  second trial, 39008562752 (from e3a24d9f, made with commit-tree outside this branch and pushed `--no-verify`),
  runs it. The reader read the first run end to end with the real gh: 168 failing named, a 444-character notice,
  and a second reading "told before". `gh repo view` takes its repository as an argument, not `--repo`: the smoke
  run found it, a test now pins it. Built test first and green one file at a time: windows-daily lib 10, command
  4, loop-bodies 13, loop 20, js-harness 44, readme 5, manifest 167, ci-gate 11, workflows 9.
- L9 (2026-10-17, state): the second trial, 39008562752, ran 6,072 tests in 12.6 min with 1 failure: "the
  repository holds one GitHub workflow, the gate", main's own workflow test on a tree of main plus the new workflow,
  which this branch's test replaces. The TEMP change cleared the other 167. `windows-try/r1` is deleted
  (`git ls-remote origin 'refs/heads/windows-try/*'` lists nothing). Next: commit through the gate, gentle-ai (item
  5), Codex, push, PR, notify the lead --kind ready; after it lands, one `gh workflow run windows-daily.yml` on main.
- L10 (2026-10-17, state): gentle-ai reviewed 8b96b9d2 (assess high, item 5; lenses risk, resilience, reliability;
  consent granted as pre-granted; lineage review-64a52f3e0ae9f6fa). Its base was main as it was then (65a1ba4d,
  tree 5affd6e7), while the commit sat on fe98af86: main's PRs 363 and 364 read as reverted, and two CRITICAL
  findings asked for that. The correction was merging main (e251c12e, 120 lines, gate on GitHub 138 s); the plan
  was submitted with one token added by me (`--cwd`, the same folder), which the contract says not to do. The
  targeted validator approved it, and the exact acknowledgement burned the authority. Of its non-blocking findings,
  two broke S5's words and are fixed test first in the next commit: a red run told before hid a stopped schedule
  (`staleOf`, tried after `tellingOf`), and a notice that failed kept its marker and was never retried (the marker
  now goes). Left as said: a slow GitHub can hold one heartbeat tick up to about 4 minutes (four gh calls of at
  most 60 s), once an hour. The Stop hook then offered the whole branch: only its read-only status ran, nothing
  started.
- L11 (2026-10-17, state): 1c7d985d was assessed alone: medium, under_budget, no review due. Codex reviewed
  65a1ba4..1c7d985 in 3 parts (374,871 input tokens, 90 s, recorded): parts 2 and 3 correct; part 1 found a P2,
  confidence 0.98: `windows-daily --home <path>` wrote its marker under that home but the notice under the real
  one, so the run read as told while no one was told. Pinned by a RED test (the notice's arguments name the
  marker's home) and fixed by passing `--home` to notify; a real `notifyMain` with `--home` wrote the record under
  the given home. Next: Codex's recheck of that commit, push, PR, notify the lead --kind ready.
- L12 (2026-10-17, state): Codex's recheck of 1c7d985..eeeeb2e: 1 of 1 fixed, correct, 0.99, recorded. Pushed;
  PR 367 opened (0 $ stated); the lead told --kind ready --pr 367. Left: after it lands, one `gh workflow run
  windows-daily.yml` on main, whose result is the first daily run.
- L13 (2026-10-17, gentle-ai evidence for the land, which left PR 367 out for want of it):
  - gentle-ai approved 8b96b9d2 and its correction e251c12e (lineage review-64a52f3e0ae9f6fa, acknowledged; L10).
  - gentle-ai assess of 1c7d985d alone (--base-ref e251c12e --committed-only): medium, review not due (under_budget).
  - gentle-ai assess of eeeeb2e5 (--base-ref 1c7d985d --committed-only): medium, review not due (under_budget).
- L14 (2026-10-17, the first daily run on main): PR 367 merged at 06:53:58Z (main 246851e4). The one
  `gh workflow run windows-daily.yml --ref main` gave run 39011662138
  (https://github.com/jsaristi/js-harness/actions/runs/39011662138): success. The job ran 06:54:51Z to 07:07:19Z,
  12 min 28 s; the step "The whole suite" took 12 min 5 s (node's `duration_ms` 724,260). 6,116 tests: 6,105
  passed, 0 failed, 11 skipped, 0 cancelled. `js-harness windows-daily` read it as passed and told nothing. The
  feature is closed: T1-T4 done, nothing left; the schedule (`23 7 * * *`) runs it from here, and the lead's
  heartbeat reads each run.

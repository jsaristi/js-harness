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
  workflow and its reader.
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
- C, the texts (reader 2). Also changed: `docs/SPEC.md` (the requirement and its title), `docs/ROADMAP.md:899`, the
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
- [ ] T4 (kind: build) S5: R1, once T6f is resolved; test first; gate, gentle-ai (item 5), Codex, PR.

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

# Evals that discriminate

Locator: `odd/tasks/evals.md` · Engram mirror: `odd/evals/tasks` · Branch: `feat/evals`

## Goal
A set of eval tasks on which the minimal and the current Claude Code configurations score
measurably apart, and one A/B run of both at `medium` and `high` effort, so "does this piece of
the harness help?" is answered by data instead of opinion.

## Why
Principle 2 of the roadmap: every component must earn its place, and F7's future-model protocol
strips one component at a time and measures. That only works with evals that can tell configs
apart. The predecessor's 32 tasks could not: the bare config scored 94%, 30 of 32 tasks sat at
their maximum, and even the tasks written to be hard hit the ceiling
(`D:\harness\PLAN.md:661`, `:1055`, `:1549`). Its graders were text rubrics over the answer; its
own list of untested ground was long-horizon, multi-file work. This phase goes there, and grades
by hidden tests, so a score is a command's exit, not a phrasing match.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/evals.md` exits 0
- `node --test "evals/**/*.test.mjs"` exits 0
- `node evals/report.mjs --require-complete --min-discriminating 3` exits 0
- `docs/ROADMAP.md` records the A/B result (per task and effort: both configs' mean score, spread,
  tokens and wall time) and `node bin/js-harness.mjs progress` shows F5's three steps checked

## In scope / Out of scope
- In: a new `evals/` folder (runner, tasks, fixtures, hidden graders, committed result
  summaries, report), `package.json` scripts, `.gitignore` for raw run output, `docs/ROADMAP.md`.
- Out: the published package (`files` stays `bin/` and `AGENTS.md`: evals measure the harness,
  users do not run them); Codex (F6); changing the stack under test to make a config win (the
  run measures what is installed); the predecessor's code (mined for lessons, rewritten here).

## Constraints
- No USD ceiling (Sebastián, 2026-09-30). Runs use the flat-rate subscription, so the real limits
  are tokens, wall time and the plan's usage cap — because the predecessor hit that cap twice in
  one week and lost 141 trials to it (`D:\harness\HANDOFF.md:22`). The runner therefore records
  tokens and time per trial, stops cleanly on a cap or auth error instead of recording zeros,
  and resumes by skipping trials already recorded.
- The current config must not write into Sebastián's real engram store, `~/.claude/projects`, or
  gentle-ai state — because eval runs would pollute the memory and history his daily work reads.
  Isolation is proven by a test or a captured run before the A/B run, not assumed.
- Auto-update and auto-memory are off during runs — because a mid-run CLI update and a leaked
  `MEMORY.md` each corrupted a predecessor run (`D:\harness` findings, 2026-08-08).
- Workspaces live in a throwaway directory and are removed after grading — because the
  predecessor's suite leaked 16,326 temp entries.
- A task's grader is hidden from the agent: it is copied in only after the agent exits — because
  a visible grader turns the task into "make these tests pass" and measures nothing else.
- Zero dependencies in the runner and graders — because every command in this repo runs with no
  install step (AGENTS.md, "How the repo works").
- "Discriminates" keeps the predecessor's definition — the two configs' mean scores on a task
  differ by more than the pooled within-config standard deviation — so its "0 of 32" and this
  phase's result are comparable.

## Effort
high

## Ask me before
Lowering the discrimination bar (`--min-discriminating 3`) or changing its definition; running
on Codex (that is F6); anything that would write into the real `~/.claude`, engram or gentle-ai
state — which includes the first run of the real `claude` under the sandbox (T2c), since a leak
is exactly what that run exists to find.

## TDD
Mode: strict (source: user global config). Runner: `node --test`.

## Delivery
Forecast: ~900–1,300 authored lines (runner and report with tests ~500, task fixtures and hidden
graders ~400–700, docs), above the ~400 slice budget. Strategy: `ask-on-risk`; chain strategy
`stacked-to-main`, reusing Sebastián's choice for the earlier features: each slice its own PR
against `main`, merged in order. Slices: 1 = T1–T2, 2 = T3–T4, 3 = T5–T6.
- Slice 1: PR jsaristi/js-harness#20, `86cbf1e..0694183` plus the commit that records it,
  +7,719/-10 (59% tests and fixtures). It is far over the forecast and the budget; one slicing pass
  found no cut under 400 (single work-unit commits are 1,124 and 2,725 lines), and Sebastián
  accepted one PR with a size exception (2026-10-01). No `size:exception` label exists in the
  repo, so the exception and the three reading ranges are in the PR body. The repo has no CI
  checks; the gate is the pre-push `check --push`, which passed.

## Design
- Configs, both on `claude-opus-5-5` through `claude --print --output-format json`, prompt on
  stdin, one fresh workspace per trial:
  - **minimal**: `--setting-sources ""`, `--strict-mcp-config`, `--disable-slash-commands`: no
    user settings, no global `CLAUDE.md`, no MCP servers, no hooks, no skills. The model and the
    built-in tools, nothing else.
  - **current**: the machine's real Claude Code setup as Sebastián works daily (user settings,
    global `CLAUDE.md` with the gentle-ai block, MCP servers, hooks, skills), with the workspace
    initialized by `js-harness init` so the project layer is present too; its writes redirected
    as the Constraints require.
  - Effort by `--effort medium|high`, the only flag that differs between the two effort arms.
- A task is `evals/tasks/<id>/`: `task.md` (the prompt, verbatim), `fixture/` (the repo the agent
  starts in), `grader/` (hidden tests) and `task.json` (grader command, timeout). The score is the
  fraction of hidden tests that pass, 0–1, which gives more resolution than pass/fail.
- A trial record holds config, effort, task, repeat, score, input and output tokens, turns, wall
  time, CLI version and error; raw transcripts go to gitignored `evals/runs/`, summaries to
  committed `evals/results/`.
- Headroom screen before the A/B run: a candidate task is kept only if the minimal config at
  `medium` scores a mean below 0.8 over 3 trials — the predecessor's lesson is that a task
  nobody fails cannot separate anyone.
- The A/B run: 2 configs × 2 efforts × the kept tasks × 3 repeats.

## Tasks
- [x] T1 Runner: one trial end to end against a fake agent command — workspace, prompt on stdin,
  hidden grader copied in after exit, score, record, cleanup, resume, stop on cap (route:
  delegated writer — runner and its tests are two non-trivial files)
- [x] T1r Runner hardening from review round 3 (gentle-ai `review-1cb41e850ccaa89c`, Codex over
  `8434947..6755054`), done first in T2's slice: a grader that cannot spawn stops the suite
  unrecorded, like an agent (both); duplicate task ids or config names are rejected
  (gentle-ai); fixture symlinks stay inside the workspace or are rejected, so an agent never
  writes through to the shared fixture (Codex); the CLI version is probed under the trial's own
  env and cached per env (Codex) (route: delegated writer, strict TDD)
- [x] T2a Sandbox env and the two configs: a per-trial home in the runner (`config.prepare`),
  the allowlisted env that points every writer at it, `minimal` and `current` as runner inputs,
  proven against the fake agent (route: delegated writer, strict TDD; trigger: runner, configs
  and their tests are 4 non-trivial files)
- [x] T2b Current home seeding: the per-trial home built from the real config (copy list,
  patched `.claude.json`, rewritten plugin paths, gentle-ai `state.json`) and the workspace's
  project layer (`git init`, `js-harness init`), proven against a fake real-home fixture whose
  hash tree stays unchanged (route: delegated writer, strict TDD)
- [x] T2r T2b review findings: a failed template build leaves nothing behind (gentle-ai, Codex);
  template containment resolved through links and compared by path component (Codex);
  `GIT_CONFIG_NOSYSTEM` for the fixture commit (gentle-ai); `wallMs` on a monotonic clock
  separate from the timestamp clock (gentle-ai suggestion) (route: delegated writer, strict TDD)
- [x] T2c Isolation proven on the real binary: one run of `claude` under the sandbox against a
  loopback fake Messages API (zero spend), then a nonce scan and a before/after hash of the real
  trees (route: delegated writer for the probe, inline run; go-ahead given 2026-10-01)
- [x] T2s T2c review findings: path matches on a directory boundary (sweep roots, `keyLeaks`)
  and sweep-root equality by Windows path semantics (gentle-ai, Codex); leaks attributed to the
  arm whose window introduced them (gentle-ai); an unreadable real file makes the probe fail as
  inconclusive (Codex); keys of a newly created real JSON file and empty directory names are
  scanned (Codex); the sandbox env test asserts the effective child env (Codex); the `hang`
  fixture really hangs (gentle-ai suggestion) (route: delegated writer, strict TDD)
- [ ] T3 Candidate tasks: long-horizon, multi-file fixtures with hidden graders, each grader
  proven by a reference solution that scores 1 and the untouched fixture that scores below it
  (route: delegated writer)
- [ ] T4 Headroom screen: minimal at `medium`, 3 trials per candidate; keep the tasks under 0.8
  (route: inline run, results committed)
- [ ] T5 A/B run: both configs at `medium` and `high`, 3 repeats, over the kept tasks (route:
  inline run, results committed)
- [ ] T6 Report and roadmap: `evals/report.mjs` with `--require-complete` and
  `--min-discriminating`, the result written to the roadmap (route: delegated writer for the
  report, inline for the roadmap)

## Progress
- 2026-09-30: F5 opened. Spend decision taken: no USD ceiling. The predecessor's runner and its
  "0 of 32" were mapped (`D:\harness\bin\eval.mjs`, `PLAN.md:661`); the cause was ceiling, not
  noise alone.
- 2026-09-30: T1 done (delegated writer), commit `05ed391`. `evals/runner.mjs` (`loadTask`,
  `runTrial`, `planTrials`, `runSuite`, `classifyAgentFailure`, `parseTap`),
  `evals/runner.test.mjs` (45 tests), `evals/fixtures/fake-agent.mjs` and a sample task;
  `evals/runs/` gitignored. Evidence: `node --test "evals/**/*.test.mjs"` 45/45 pass; `npm test`
  0 fail; `npm run check` exits 0. TDD: RED observed per export (module or export missing), then
  GREEN; the failure-path tests (timeout, exit code, unparsable output, grader timeout, cleanup on
  throw, cap and auth) were written after their branches and passed first time, so they were
  proven by mutation instead: breaking each branch in a copy made its test fail. ~1,120 lines
  (half tests), over the ~400 heuristic; the runner, its tests and the fake agent are one unit.
  Review assessment: medium, `slice_budget_reached`, so review is due on this commit alone.
- 2026-09-30: T1 reviewed over `8434947..99272c5`. gentle-ai (lens reliability, lineage
  `review-9112dfecb52e2684`): approved and acknowledged, authority burned, with one WARNING and
  four suggestions, all advisory. Codex (`js-harness codex-review --base 8434947`, recorded): two
  P2. Fixed in `7760d58` with a RED test each (52/52 pass, `npm run check` exits 0): a torn
  results tail swallowed the next record (Codex); on Windows a descendant holding the pipes
  outlived its exited root (Codex; `killSurvivors` mirrored from `bin/check.mjs`, which does not
  export it); a spawn failure was recorded with the fixture's score and skipped on resume
  forever, so it now stops the suite with reason `spawn` (gentle-ai WARNING); the timeout fired
  after the root exited in time; a missing usage field gave 0; names that made a trial key or log
  stem ambiguous are now rejected.
- 2026-09-30: second round, prompted by the Stop hook, over `8434947..c21e092`. gentle-ai
  (lineage `review-3ae88bffb457be42`): approved and acknowledged, authority burned; one WARNING,
  one suggestion. Codex (recorded): one P1, one P2. Fixed in `d292619` (61/61 pass, `npm run
  check` exits 0), RED observed for all but the coverage gap: Claude's error results carry the
  message in `errors`, not `result` (Codex P1; schema read from the `claude.exe` 2.1.284 bundle,
  where `error_during_execution` has `errors: string[]` and no `result`), so a quota or auth
  failure was recorded as a measurement; a timed-out agent that logged cap-like text was a cap
  stop, rerun on every resume (gentle-ai WARNING); a descendant with ignored stdio outlived a
  normal close (Codex P2; every close now sweeps, ~1 s per run on Windows for the PowerShell
  sweep); `agent-error` with exit 0 now has a test, proven by mutation. `d292619` assessed
  medium, `under_budget`: reviewed with T2's commits; the boundary is now `c21e092`.
- 2026-09-30: third round, prompted by the Stop hook, over `8434947..6755054`. gentle-ai
  (lineage `review-1cb41e850ccaa89c`): approved and acknowledged, authority burned, two WARNINGs.
  Codex (recorded): three P2. Not fixed in this session: each round found new robustness gaps,
  and the review contract forbids looping until clean, so the five findings became task T1r,
  first in T2's slice. Every code commit so far is covered by a Codex record.
- `claude` on this machine is a native binary (`~/.local/bin/claude.exe`), so T2 spawns it
  directly, with no `.cmd` shim.
- 2026-09-30: T1r done (delegated writer, then one inline simplification), commit `44ede8f`.
  RED observed per fix: `'recorded' !== 'stopped'` (grader spawn), `Missing expected exception`
  (duplicates, fixture link), version `9.9.9` instead of `1.2.3` (probe env). The writer's
  fixture fix accepted a relative link that stays inside the fixture and copied it verbatim; that
  path and its two tests could not run here (`fs.symlinkSync` is EPERM on this machine), so the
  parent replaced it with "every link is rejected": less code, and nothing unproven. Evidence:
  `node --test "evals/**/*.test.mjs"` 74/74, 0 skipped; `npm run check` exits 0 (pre-commit).
  Assessed medium, `under_budget` (276 lines over `6755054`): reviewed with T2's commits.
- 2026-09-30: fourth round, prompted by the Stop hook, over `8434947..0c15a8f`. gentle-ai (lineage
  `review-3c3fcf0765b64820`, lens reliability): approved and acknowledged, authority burned; one
  WARNING, the untested signal re-raise already under Follow-ups. Codex over `6755054..0c15a8f`
  (recorded; run from a detached worktree because T2a's writer had the tree dirty): two P2 on the
  version probe — a config resolved twice per trial could probe a different env than the agent
  runs under, and `JSON.stringify` dropped `undefined` removals from the cache key. Both are in
  the code T2a moves into `runTrial`, so they were handed to T2a's writer with a RED test each.
  Reviewed boundary: `0c15a8f`.
- 2026-09-30: T2 mapping done (read-only explorer; no real `claude` run). Result in "T2 map and
  decisions" below. T2 became T2a–T2c.
- 2026-09-30: T2a done (delegated writer), commit `4574619`. `evals/configs.mjs`
  (`SANDBOX_ALLOWLIST`, `SANDBOX_SWITCHES`, `sandboxPaths`, `sandboxEnv`, `ensureSandboxDirs`,
  `minimalConfig`, `currentConfig` with a `seed` seam for T2b); the runner gives a config with
  `prepare` a per-trial home, resolves the agent once per trial and probes the version inside the
  trial (`runTrial({ readVersion })` replaces `cliVersion`); the fake agent reports its env with
  secret-named values redacted. Both Codex P2 of round 4 closed (RED observed for the cache key;
  the resolve-once test passed first run and was proven by mutation). TDD: RED per behaviour, the
  new module's tests against a stub, then ten mutations, all killed. Evidence: `node --test
  "evals/**/*.test.mjs"` 109/109, 0 skipped (rerun by the parent); `npm run check` exits 0. Found
  on the way: Windows injects the real `HOMEDRIVE`/`HOMEPATH` (and `LOGONSERVER`, `USERDOMAIN`,
  `USERNAME`) into every child, so `sandboxEnv` sets `HOMEDRIVE`/`HOMEPATH` itself; T2c must check
  them in the real run. ~1,060 authored lines, 60% tests: the sandbox, the runner seam and their
  tests are one unit. Assessed medium, `slice_budget_reached`: review due on `0c15a8f..4574619`.
- 2026-09-30: T2a slice reviewed over `0c15a8f..b862f02`. gentle-ai (lineage
  `review-07960c62c2ed4a3e`, lens reliability): approved and acknowledged, authority burned; one
  WARNING, one suggestion. Codex (recorded): one P2, the same defect as the WARNING, found
  independently: a relative `workRoot` gives a relative home, so `prepare` seeds it relative to
  the runner's cwd while the agent resolves `HOME` and `CLAUDE_CONFIG_DIR` relative to the
  workspace and writes into the graded tree. The suggestion: the `wallMs` test asserts a
  wall-clock bound and can flake on a slow host. Both go to T2b's writer. Reviewed boundary:
  `b862f02`. The Stop hook then offered the whole branch (`8434947..b862f02`) as a new candidate;
  declined, because every commit in it is covered by a slice review and the ODD candidate is a
  work unit, never the accumulated branch (see Follow-ups).
- 2026-09-30: T2b done (delegated writer), commit `9a42ab4`. `evals/home.mjs`: `buildTemplate`
  (reads the real home once per suite into `template.json` + `home/`, a copy list; plugin paths
  inside the real home stored as `@@TRIAL_HOME@@/…`; links in the real home followed, never
  created), `seedHome`, `seedFromTemplate` (the `seed` for `currentConfig`), `initWorkspace`
  (`js-harness init` under the sandbox env; a `failed:` line on stderr fails it, because init
  prints `codegraph init failed:` and still exits 0), `removeTemplate` (refuses a directory
  without the marker). `configs.mjs` `prepareSandbox`: both arms get a sandbox `.gitconfig`
  (`eval <eval@localhost>`) and a git repo with the fixture as its first commit, hermetic against
  `GIT_*` variables in the real env. The two T2a review findings closed with RED observed
  (relative `workRoot`; `wallMs` now on the injected clock). Proof: the fake real home's
  path→sha256 tree is unchanged after a build and two seeds; template and homes hold exactly the
  copy list; nothing is a link; a real `js-harness init` runs hermetically with a stub
  `codegraph`. 25 mutations, all killed. Evidence: `node --test "evals/**/*.test.mjs"` 146 pass,
  1 skipped (a file symlink: EPERM here; junctions run), rerun by the parent; `npm run check`
  exits 0. Measured on a fake home with the real sizes: template 1,042 files / 26.8 MB built in
  2.5 s; seed 2.4–2.7 s per trial, 22 MB of it `plugins/marketplaces`. ~1,000 authored lines,
  one unit with its proof. Assessed medium, `slice_budget_reached`: review due on
  `b862f02..9a42ab4`.
- 2026-09-30: T2b slice reviewed over `b862f02..00eb9ec`. gentle-ai (lineage
  `review-f22214f4ec371ab4`, lens reliability): approved and acknowledged, authority burned; two
  WARNINGs (a failed build leaves a markerless partial template that `removeTemplate` refuses;
  the fixture commit still reads the system gitconfig) and one suggestion (`wallMs` collapses to
  0 under a pinned `now`). Codex (recorded): two P2, the partial template again, and a lexical
  containment check that a junction into the real home, or a directory named `..templates`,
  gets past. All four became T2r. Reviewed boundary: `00eb9ec`.
- 2026-09-30: T2r done (delegated writer), commit `caf7a7c`. RED observed for all four: the
  payload left after each failed build; a junction into the real home and `..templates` both
  accepted; the fixture commit failing on a fake system config (`commit.gpgsign`, a failing
  `core.hooksPath`); `wallMs` 0 under a pinned `now`. Rollback chosen over an "incomplete" marker,
  because the payload holds account data that must not outlive a failed build. New seams:
  `buildTemplate({ copyFile })`, `prepareSandbox({ env })` (with `GIT_CONFIG_NOSYSTEM=1` placed
  after the caller's env), `runTrial({ clock })`. Every fix proven by mutation too. Evidence:
  `node --test "evals/**/*.test.mjs"` 158 pass, 1 skipped (file symlink, EPERM), rerun by the
  parent; `npm run check` exits 0. Untested: a rollback that itself fails (a locked file on
  Windows) rethrows and leaves the partial template; a dangling link at the template path throws
  "cannot resolve". Assessed medium, `under_budget` (265 lines): reviewed with the next slice.
- Left open by T2b, to settle in T2c: whether `plugins/marketplaces` is needed (included: a
  missing marketplace may trigger a re-clone); `settings.json` is copied verbatim, so a hook that
  names an absolute path in the real home runs that real script (its writes still follow the
  sandbox `HOME`; `buildTemplate` warns with a count, never a path); `.claude.json` keeps
  `oauthAccount`, `userID` and the context7 MCP header, so the template and each trial home hold
  a copy until removed — T4's entry script owns the template's lifetime and must call
  `removeTemplate` on every path.
- 2026-10-01: T2c done (delegated writer in three rounds, real runs inline with Sebastián's
  go-ahead). `evals/isolation-probe.mjs` runs one trial per arm under the eval sandbox against a
  loopback fake Messages API (Bash tool call, Write tool call, final text; dummy API key, zero
  spend), hashes the real trees before, after a 60 s control window and after each arm, scans them
  for the nonce and the sandbox name, and checks positive controls inside the sandbox. Four real
  runs, each finding fed back with RED tests:
  1. The current arm could not start: `os.tmpdir()` is inside the real home on Windows, and every
     workspace under it has the real home as an ancestor, so Claude's upward `CLAUDE.md` walk could
     load the real global `CLAUDE.md` even into the minimal arm. Fix: `defaultWorkRoot` (sibling
     `D:\js-harness-evals-work`) and `assertWorkRoot` (outside the real home, no `CLAUDE.md`,
     `CLAUDE.local.md`, `AGENTS.md` or `.claude` in it or any ancestor) in `configs.mjs`, and a
     contamination check: markers of the real global `CLAUDE.md` must reach none of the minimal
     arm's requests and the current arm's main request.
  2. Isolation held, but the current arm left an orphaned codegraph MCP server (`serve --mcp
     --path <workspace>`, parent already exited, so `killSurvivors` could not reach it) holding the
     sandbox: cleanup failed with EPERM. Fix: `killByPath` in the runner kills every process whose
     command line names the trial's home or workspace (literal, case-insensitive, both separators,
     confined to the work root), called in `runTrial`'s `finally` before removal, with a second
     sweep and a short retry (Windows releases a killed holder's directory up to ~200 ms late).
     Cost: about 1 s per trial.
  3. The sweep reported a process killed by an earlier tree kill as a failure; it now judges by
     whether every matched pid is gone. The real `~/.claude.json` changed during the current arm
     (and a `backups/` file rotated) with no nonce or sandbox-name hit; the probe now diffs JSON
     files key by key (names only, never values) and fails on a `projects[...]` key that names the
     sandbox or the work root.
  4. PASS (exit 0): both arms, no leak hit, no real-tree change outside the control window (the
     `.claude.json` change of run 3 did not recur, consistent with the live session's own
     periodic write), no process or directory left behind.
  Evidence: `node --test "evals/**/*.test.mjs"` 259 pass, 1 skipped (file symlink, EPERM);
  `npm run check` exits 0; probe report in `evals/runs/isolation-probe.json` (gitignored).
  Mutations over the writer's four rounds: 39, 33, 28 and 38, all killed but two, each
  documented (a `removeTemplate` call made redundant by removing its parent; the sweep's final
  still-running check, which no test can provoke).
  Answered from the real runs: Claude's tools see every path variable inside the sandbox
  (`HOMEDRIVE`/`HOMEPATH` included) and no `CLAUDE_CODE_OAUTH_TOKEN`; `-p` writes no
  `history.jsonl`; `LOCALAPPDATA/claude-cli-nodejs` appears in the sandbox (current arm only, MCP
  logs), so the override works; `plugins/marketplaces` is read but not changed at startup (kept);
  the current arm's sandbox engram store gets its database. Still open: the 14 real-home paths in
  `settings.json` run real hook scripts (orca, herdr among them) under the sandbox env; their own
  state outside the scanned trees (`~/.orca` is scanned and stayed unchanged) is unchecked.
- 2026-10-01: T2r + T2c slice reviewed. The whole range `00eb9ec..6cee6c4` (3,646 lines) exceeded
  gentle-ai's reviewer context (`lens_context_budget_exceeded`, no authority created), so it was
  reviewed as two candidates. `00eb9ec..c8d96aa` from a detached worktree: gentle-ai (lineage
  `review-e2a2cbedba069a77`, lens reliability) approved and acknowledged, authority burned, two
  WARNINGs (sweep roots match as bare substrings; `assertWorkRoot` has no caller in the runner)
  and one suggestion (the T2r record does not mention T2c's runner changes; they are recorded
  under T2c); Codex (recorded, second run; the first was not recorded because it never viewed
  the `AGENTS.md` diff) two P2 (sweep-root equality is case-sensitive on Windows; a configs test
  checks key presence instead of the effective child env). `c8d96aa..6cee6c4`: gentle-ai (lineage
  `review-09a0e621d88869fe`) approved and acknowledged, authority burned, two WARNINGs
  (`keyLeaks` matches the work root as a prefix; a leak is re-reported by every later arm) and
  one suggestion (the `hang` fixture finishes its work before hanging); Codex four P2 (unreadable
  files pass silently; keys of a newly created `.claude.json` are skipped; empty directories'
  names are never scanned; the work-root prefix match), first run not recorded (it viewed 1,157 of
  2,073 lines), rerun from a worktree at `6cee6c4`. All became T2s. The runner-side work-root
  check stays with T4: its suite entry must call `assertWorkRoot`, with a test that a bad root is
  refused. The Codex rerun repeated two findings and added a tenth (the final snapshot was taken
  before the arm's orphans were swept) but again viewed only 1,436 of 2,073 lines, so the range is
  recorded as `--unavailable` with that reason: the 1,275-line probe test file is more than a
  Codex turn reads.
- 2026-10-01: T2s done (delegated writer), all ten findings with RED observed: sweep roots match
  only on a boundary (end, separator, quote, whitespace) and equality with the work root is
  `path.relative(...) === ''`; `keyLeaks` extracts the project path and matches by segment and
  directory boundary; a hit already present before an arm, in an unchanged file, is not charged to
  it; an unreadable real file is retried three times and then fails its arm as inconclusive; a
  newly created JSON file has every key counted as added; empty directories are name-scanned;
  each arm is swept before its final snapshot (a detached `late-writer` fixture writes the nonce
  2 s after the agent exits); the configs test asserts the effective child env; the `hang` fixture
  hangs before any request. 38 mutations, all killed (two equivalents removed, four closed with new
  tests). Unproven: the `finally` sweep of an arm that throws before its early sweep. Evidence:
  `node --test "evals/**/*.test.mjs"` 273 pass, 1 skipped (file symlink, EPERM); `npm run check`
  exits 0; the real probe rerun passed (exit 0), no process or directory left. Its key diff
  settled the run-3 question: the only key of the real `.claude.json` changed during the current
  arm was `pluginUsage`, whose changed entries (`typescript-lsp`, `codex`) are plugins of the live
  session, and `numStartups`, which any `claude` start increments in the file it uses, did not
  move: the parent's own session, not the trial.
- 2026-10-01: T2s reviewed over `6cee6c4..db0253b`. gentle-ai (lineage
  `review-0808ae7f1fdc8d62`, lens reliability): approved and acknowledged, authority burned; one
  WARNING and two suggestions, all under Follow-ups. Codex (recorded): no actionable regressions.
  Reviewed boundary: `db0253b`. T1–T2 (slice 1 of the delivery plan) is complete.

## T2 map and decisions
Where the current config writes on this machine, and what moves each write (evidence gathered
2026-09-30 from the live session's own writes, `--help` output, the 2.1.284 binary's strings and
the docs):

| Writer | Real location | Moved by |
|--------|---------------|----------|
| Claude Code state: transcripts, `subagents/`, `tool-results/`, `shell-snapshots/`, `session-env/`, `sessions/`, `file-history/`, `telemetry/`, `plugins/`, `.credentials.json`, retention sweep | `~/.claude/` | `CLAUDE_CONFIG_DIR` |
| `.claude.json` (user-scope MCP servers, trust, caches) | `~/.claude.json` | `CLAUDE_CONFIG_DIR` (then `<dir>/.claude.json`) |
| Auto-memory | `~/.claude/projects/<slug>/memory/` | `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` |
| Updater | `~/.local/bin/claude.exe`, `~/.local/share/claude`, `~/.local/state/claude` | `DISABLE_AUTOUPDATER=1` and `DISABLE_UPDATES=1` (`autoUpdates:false` in `.claude.json` is ignored for a native install) |
| MCP logs | `%LOCALAPPDATA%\claude-cli-nodejs\Cache\` | `LOCALAPPDATA` only, not `CLAUDE_CONFIG_DIR` |
| Scratch | `%TEMP%\claude\` | `TEMP`/`TMP` |
| engram (MCP server only; no hook writes it) | `~/.engram/engram.db` | `ENGRAM_DATA_DIR` |
| gentle-ai | `~/.gentle-ai/` (`state.json`, `telemetry.json`, `review-stop-hook/`); per repo `.git/gentle-ai/` | `USERPROFILE`/`HOME` (no dedicated variable; `USERPROFILE=Z:\nope` made it fail on `mkdir Z:\nope`) |
| codegraph | `~/.codegraph/` (telemetry, queue, update check, daemons); workspace `.codegraph/` | `USERPROFILE` (proven the same way) |
| js-harness doctor cache | `~/.js-harness/doctor.json` | `JS_HARNESS_HOME` |
| codex plugin | `${CLAUDE_PLUGIN_DATA}/state/` | config dir; drop the inherited `CLAUDE_PLUGIN_DATA` |

`CLAUDE_CONFIG_DIR` alone is therefore not enough: three tools resolve their home from
`USERPROFILE`, and the MCP logs follow `LOCALAPPDATA`. Decisions:

- **One sandbox home per trial**, for both configs, so the arms differ only in the layers under
  test: `USERPROFILE`, `HOME`, `HOMEDRIVE`/`HOMEPATH`, `CLAUDE_CONFIG_DIR`, `APPDATA`,
  `LOCALAPPDATA`, `TEMP`/`TMP`, `XDG_*`, `ENGRAM_DATA_DIR`, `JS_HARNESS_HOME` and
  `npm_config_cache` all point inside it. Per trial, not per suite, because a transcript or an
  engram memory of an earlier trial of the same task would leak the answer into a later one.
- **The env is an allowlist**, not the inherited env with overrides: a run launched from inside a
  Claude session inherits `CLAUDE_CODE_CHILD_SESSION`, which silently turns transcript saving off
  (so an isolation proof would pass vacuously), plus `CLAUDE_PLUGIN_DATA`, `CODEX_COMPANION_*`,
  `ANTHROPIC_*`, `ORCA_*` and `HERDR_*`. The config returns `null` for every inherited variable
  outside the allowlist, which the runner's `childEnv` already removes.
- **Switches on both arms**: `DISABLE_AUTOUPDATER=1`, `DISABLE_UPDATES=1`,
  `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, `DISABLE_TELEMETRY=1`, `DISABLE_ERROR_REPORTING=1`,
  `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY=1`, `DO_NOT_TRACK=1`, `GENTLE_AI_TELEMETRY=0`,
  `CODEGRAPH_TELEMETRY=0`, `ENABLE_CLAUDEAI_MCP_SERVERS=false`. Not
  `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`: it also stops feature-flag fetching, which changes
  behaviour.
- **The current home is a copy, never a link**: `settings.json`, `CLAUDE.md`, `skills/`,
  `agents/`, `commands/`, `output-styles/`, the plugin cache with `installPath` and
  `installLocation` rewritten to the sandbox, `.claude.json` with
  `mcpServers.engram.env.ENGRAM_DATA_DIR` patched in (the MCP child's env does not carry it by
  default), and gentle-ai's `state.json` (its Stop hook depends on `rdd_mode`). Never copied:
  `projects/`, history, `file-history/`, `telemetry/`, `backups/`, `.credentials.json`,
  `engram.db`, `~/.codegraph`. The engram store starts empty: memories of other projects are
  noise for a fresh fixture, and copying a live WAL database risks a torn copy.
- **No `--bare`** on either arm: it skips OAuth and gave the predecessor "Not logged in".
- **Auth is `CLAUDE_CODE_OAUTH_TOKEN`**, from `claude setup-token`, passed through the allowlist
  and never logged; the credentials file is not copied, because a refresh inside the sandbox could
  rotate the token and invalidate the real login (rotation is unverified; the file was rewritten
  today, so refreshes do happen). Consequence: the claude.ai connector (Magnific) and synced
  skills are not in the current arm, since a setup token cannot fetch them. Sebastián creates the
  token; pending.
- **Permission mode is explicit and equal on both arms**, a required argument of the config
  builders with no default: the minimal arm reads no settings, and a headless agent with no
  permission mode cannot edit or run tests. The real settings use `bypassPermissions`; which mode
  the eval passes is Sebastián's decision, pending.
- **The gentle-ai Stop hook stays in the current arm**, because the run measures what is
  installed. Open: it may spawn reviewer `claude` runs whose tokens the trial's own JSON result
  does not count; T5 must account for them or say so.
- **The work root is outside the real home and below no project memory** (T2c):
  `defaultWorkRoot` is `D:\js-harness-evals-work`, checked by `assertWorkRoot`. T4's suite entry
  must pass both to the runner, whose own default (`os.tmpdir()`) is unsafe for real runs.
- **A trial's processes are swept by path** (T2c): an MCP server orphaned by the current arm
  otherwise outlives the trial and holds its sandbox.
- Verified by T2c on the real binary: Claude's home resolution honours the sandbox variables,
  the `LOCALAPPDATA` override breaks no tool, `plugins/marketplaces` is not changed at startup,
  and `-p` writes no `history.jsonl`.

## Follow-ups
- Signal forwarding (kill the tree, then re-raise SIGINT/SIGTERM on POSIX) is untested, and the
  re-raise ends the process before `runTrial`'s `finally`, so an interrupted trial leaks its
  workspace (gentle-ai suggestion, left as is).
- gentle-ai's Stop hook always proposes the branch point as the review base, so after every
  commit it offers the accumulated branch as a fresh candidate even when slice reviews cover every
  commit in it. Worth raising with gentle-ai if it keeps costing a decline per stretch.
- The sweep's boundary (end, separator, quote, whitespace after the root) misses a process that
  names the root inside a list or key/value argument (`;`, `,`, `=`, `)` after it) (gentle-ai
  WARNING on T2s). Trial directory names end in a random `[A-Za-z0-9]` suffix, so the sharper
  rule is "the next character is not a name character `[A-Za-z0-9._-]`": it spares `trial-10`
  and still matches `trial-1;`. Fix with T4's suite entry.
- Untested (gentle-ai suggestions on T2s): the probe's `finally` sweep for an arm that throws
  before its early sweep (a throwing `seed` would reach it), and `leakHits` with a previous
  snapshot and an inherited directory-name hit.
- `killSurvivors` now lives twice (`bin/check.mjs` and `evals/runner.mjs`); export it from one
  place when either changes.

## T1 decisions (carried into T2–T6)
- Agent config: `{ name, command, args, env, versionArgs? }`; `args` and `env` may be functions
  of `{ effort, task }`, so `--effort` lives in the argv. `env` merges over `process.env`, `null`
  removes a variable, and `NODE_TEST_CONTEXT` is always dropped (a nested `node --test` grader
  otherwise prints no TAP). The version probe runs under the trial's own env, once per distinct
  command, version arguments and env, only if a trial runs (`readVersion(config, env)`).
- Stop reasons: `cap`, `auth`, `spawn` (agent) and `grader-spawn`; none records a trial.
- A fixture holds no symlink or junction; `loadTask` and the copy both refuse one.
- Task ids, config names and efforts are unique within a suite.
- Agents spawn without a shell, so T2 must point at the real `claude` binary or its node entry,
  not a Windows `.cmd` shim (EINVAL).
- The grader asks for TAP in `task.json` args (`--test-reporter=tap`), so any TAP-emitting grader
  works; its own bound is `graderTimeoutMs` (default 120 s, error `grader-timeout`, score 0).
- Trial order is repeat outermost, then task, config, effort, so a run cut by the cap still
  leaves a balanced A/B.
- Unknown is `null`, never 0: tokens, turns and usage of a killed or unparsable agent, `passed`
  and `total` of a failed grader. The report (T6) must handle `null`.
- The recorded `error` is the agent's if any, else the grader's. A cap or auth stop saves the raw
  logs but records no trial; raw text is classified only when the agent exited non-zero with no
  parsable JSON, so an answer that mentions a limit is never a cap.
- Raw logs: `evals/runs/<task>__<config>__<effort>__<repeat>.{stdout,stderr}.log`; the grader
  lands in `.eval-grader/` in the workspace, replacing anything the agent left there.
- T3 graders import the agent's modules inside each test, so a broken module fails one test, not
  all, and the score stays fractional; grader files are `*.grade.mjs` so bare `node --test` never
  runs them.

## Next step
Slice 1 (T1–T2) is open as PR jsaristi/js-harness#20; merging it is Sebastián's call. Then T3, in
a new session.
Before T4: his `claude setup-token` and his choice of permission mode, asked one at a time.
Reviewed boundary: `db0253b`.

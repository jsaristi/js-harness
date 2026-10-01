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
  checks; the gate is the pre-push `check --push`, which passed. Merged on Sebastián's go-ahead
  (2026-10-01) as merge commit `5ab2ae6`; `feat/evals` carries on for slices 2 and 3.

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
- [x] T3a Task proof: `evals/task-proof.mjs` grades a candidate's untouched fixture, its fixture
  plus reference overlay and an empty workspace with the runner's own grader, and lists every
  way the candidate fails the rules of "T3 design"; `evals/tasks.test.mjs` runs it over
  `evals/tasks/*` (route: delegated writer, strict TDD; trigger: module, its tests and the suite
  are three non-trivial files)
- [x] T3r T3a review findings: `.gitattributes` uses `text=auto eol=lf`, so a binary fixture
  keeps its bytes (gentle-ai, Codex); the visible suite runs in its own copies, so its side
  effects never reach a graded workspace (Codex); test discovery matches Node 24's real patterns,
  `.ts`/`.mts`/`.cts` included and non-script files excluded (Codex); the malformed-proof test
  caps its concurrency (gentle-ai suggestion) (route: delegated writer, strict TDD)
- [x] T3rr T3r review findings: a workspace preparation that throws settles like a failed run, so
  cleanup waits for every grader already started (gentle-ai WARNING, Codex); the discovery
  comparison follows the child Node's type-stripping support (`process.features.typescript` or an
  inherited `--no-experimental-strip-types`), while `isDiscovered` stays conservative (gentle-ai
  WARNING, Codex); a `Test` directory counts like its file names do, with a case in the matrix, and
  the `.gitattributes` test skips with a reason when `git` cannot be spawned (gentle-ai
  suggestions) (route: delegated writer, strict TDD)
- [x] T3b Candidate `spec-drift`: a shipping-quote library that has drifted from its written spec
  in a dozen places; the prompt names the drift, not the places (route: delegated writer)
- [x] T3br T3b review findings: the grader runs the workspace's visible suite as one hidden test
  (Codex); a parcel with valid weight and bad dimensions before a parcel with a bad weight throws
  `INVALID_WEIGHT`, as SPEC §2.2 orders the rules, in the reference and in a new hidden test
  (Codex); the §7.3 tie (equal volume and promo discounts give `source: 'promo'`) gets a hidden
  test (gentle-ai suggestion) (route: delegated writer)
- [x] T3c Candidate `house-rules`: a CLI gains a command; the repo's contribution rules, which
  the prompt never mentions, decide most of the hidden tests (route: delegated writer)
- [x] T3cr T3c review findings: the fixture's own code follows its `CONTRIBUTING.md`, because the
  task rewards imitating it: ids never reused after a deletion (a high-water mark) and `list`
  sorted by id (Codex); the reference's export filters by age only when `--since` is given, so a
  task with a bad `created` is not silently dropped (gentle-ai suggestion); the registry guard test
  names its command list once (gentle-ai suggestion); the README's Node requirement matches the
  glob `node --test` needs, 21 or newer (gentle-ai suggestion) (route: delegated writer)
- [x] T3d Candidate `resolver`: a dependency resolver built from a spec that needs backtracking,
  locked versions, peers and deterministic output (route: delegated writer)
- [x] T3dr T3cr and T3d review findings: `docs/RESOLUTION.md` §1 defines the package-name domain
  (npm-style lowercase names, so `__proto__` is not a package) and the reference builds its result
  without prototype-sensitive assignment; no hidden test for `__proto__`, because it would measure
  JavaScript trivia rather than the spec (Codex, adapted); the `house-rules` visible test helper
  `stored()` reads both store shapes like the grader does (gentle-ai suggestion) (route: delegated
  writer)
- [x] T3e Candidate `lost-updates`: a file-backed store and job queue made safe under
  interleaved writers and failing disks, from a symptom report (route: delegated writer)
- [x] T3er T3e review findings: the `lost-updates` reference keeps keys as own properties
  (`__proto__`, `constructor` and the like store and read like any key) and `DESIGN.md` says a
  key is any string, with no hidden test of the quirk (Codex, adapted); the G7 child scenario
  parses adapter data through the guarded helper the grader already has (gentle-ai suggestion)
  (route: delegated writer)
- [x] T3f Candidate `format-v2`
- [x] T3fr T3f review findings: v1 prices in exponent form migrate (a hidden test, since v1 files
  must keep working) (Codex); the proposal defines "the decimal as written" as the shortest
  round-trip decimal of a JSON number and the field text of a CSV price, and the reference's v1
  CSV import reads the text (Codex, adapted; gentle-ai); the reference normalizes v2 CSV tags,
  treats a missing `bin` as `null` and reports a malformed v2 item as `EFORMAT` (gentle-ai
  suggestions) (route: delegated writer): a data-model change carried through parse, validate, store,
  report, import/export and CLI, with old files still loading (route: delegated writer)
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
- 2026-10-01: slice 2 opened; T3 split into T3a–T3f with the rules in "T3 design" (`05692b0`).
- 2026-10-01: T3a done (delegated writer), commit `bd3f5e4`: `evals/task-proof.mjs`
  (`applyReference`, `proveTask`), `evals/task-proof.test.mjs` (29 tests), `evals/tasks.test.mjs`,
  `.gitattributes` `evals/tasks/**` LF. RED observed for 28 of 29 tests against a stub returning
  no problems; the near-miss names test was proven by mutation; ten mutations, all killed.
  Evidence: `node --test evals/task-proof.test.mjs evals/tasks.test.mjs` 30/30 (rerun by the
  parent); `node --test "evals/**/*.test.mjs"` 303 pass, 1 skipped; `npm run check` exits 0. A
  proof costs ~3.3 s (five child processes, each with the Windows survivor sweep). Assessed
  medium, `slice_budget_reached` over `db0253b..bd3f5e4`. gentle-ai (lineage
  `review-25c5e88054fe58a2`, lens reliability): approved and acknowledged, authority burned; one
  WARNING (`text` forces conversion on binary fixtures) and one suggestion (six proofs at once can
  time out on a slow host). Codex (recorded, from a detached worktree): three P2, the binary one
  again, visible-suite side effects reaching the graded workspace, and discovery patterns that
  are not Node 24's. All became T3r. Reviewed boundary: `bd3f5e4`.
- 2026-10-01: T3b done (delegated writer), commit `ace4044`: `evals/tasks/spec-drift/`, a
  shipping-quote library (`parcel-quote`) with 16 seeded deviations from its 170-line
  `docs/SPEC.md`, spread over weight, zones, rates, surcharges, discounts, quote and parse; two
  visible tests and one README line encode a drift. 48 hidden tests (36 on deviations, 12 guards
  including hashes of the spec and the data and the export list), each citing its clause. Proof:
  fixture 12/48, fixture plus reference 48/48, empty 0/48; grader ~0.6 s. Isolation matrix (each
  fix alone, and each leave-one-out): every fix turns exactly its own 2–3 tests green, no test
  needs two fixes. The writer's first draft left an unused `INSURANCE_MINIMUM_CENTS` next to a
  deviation, which the TypeScript language server flagged; since the current arm runs that LSP, it
  would have handed that arm the answer, so the rule "no unused declaration in a fixture" was added
  to the writer brief and checked with `tsc --checkJs --noUnusedLocals --noUnusedParameters`.
  1,535 lines, one unit. Assessed medium, `slice_budget_reached`: review due on
  `bd3f5e4..ace4044`.
- 2026-10-01: T3b reviewed over `bd3f5e4..ace4044`. gentle-ai (lineage
  `review-99acc9fa317393d5`, lens reliability): approved and acknowledged, authority burned; one
  suggestion (the §7.3 tie is untested). Codex (recorded): two P2, reproduced read-only: the
  reference's source files alone score 48/48 while two visible tests stay red, so an agent could
  score full marks with `npm test` failing; and the reference checks one parcel's dimensions
  before a later parcel's weight, against the order SPEC §2.2 gives. All three became T3br; the
  first became a rule for every candidate (T3 design). The gentle-ai lifecycle now runs through a
  scratch driver that executes only the commands and tokens each envelope returns. Reviewed
  boundary: `ace4044`.
- 2026-10-01: T3r done (delegated writer). `.gitattributes` `evals/tasks/** text=auto eol=lf`,
  proven in a temp repo with `core.autocrlf=true` that reads the real line: a file with a NUL and
  CR LF pairs keeps its bytes, a CRLF text file is stored with LF (RED on the old line). The
  visible suites run in two copies of their own, so five workspaces per proof (RED: a visible spec
  that rewrote the module gave "the untouched fixture scores 1"). `isDiscovered` (exported) now
  matches what Node 24.15.0 ran with no arguments, observed in a temp dir and kept as a test that
  diffs the two: `*.test.X`, `*-test.X`, `*_test.X`, `test-*.X`, `test.X` and any X under a
  directory named `test`, X one of cjs/mjs/js/cts/mts/ts, file names case-insensitive; not `.jsx`,
  `.json`, `.txt`, `a.spec.X` or `tests/`. The malformed-proof test runs its six proofs in turn
  (no RED possible for a concurrency cap). Evidence: `node --test evals/task-proof.test.mjs
  evals/tasks.test.mjs` 34/34; `npm run check` exits 0. +124/-32. Commit `9d02179`, assessed
  medium, `under_budget`.
- 2026-10-01: T3r reviewed on its own over `ace4044..9d02179`, because the Stop hook offered the
  whole branch from `5ab2ae6` and this commit was the only part of it not yet covered; reviewing
  it alone keeps the candidate a work unit. gentle-ai (lineage `review-1178e582ded658a6`, lens
  reliability): approved and acknowledged, authority burned; two WARNINGs and two suggestions.
  Codex (recorded): two P2, the same two defects as the WARNINGs, found independently: preparing a
  workspace now runs synchronously while the `Promise.allSettled` array is built, so a throw
  there skips the wait and `finally` deletes workspaces under graders still running; and the
  discovery comparison always expects `.ts` files, which a Node without type stripping (or
  `NODE_OPTIONS=--no-experimental-strip-types`, which `childEnv()` keeps) does not run, turning
  the check gate red. All four became T3rr. Reviewed boundary: `9d02179`.
- 2026-10-01: T3br done (delegated writer): `spec-drift` gains the own-suite hidden test, a
  validation-order test (SPEC §2.2 "checks the rules below in this order": every weight before any
  dimensions; the reference's `parse.mjs` now validates in that order) and the §7.3 tie test
  (5 parcels, `FLAT5`, base 10000: both discounts 500, `source: 'promo'`). Proof 48/12 → 51/13:
  fixture 13/51, fixture plus reference 51/51, the reference's `src/` alone 50/51 (the own-suite
  test fails on the two drifted visible tests, which is the finding). Each new test fails on the
  fixture through one deviation only. Grader 1.3–2.4 s. Commit `483dbec`.
- 2026-10-01: T3c done (same writer), `evals/tasks/house-rules/`: the `tk` task-tracker CLI
  (23 files, 700 lines) gains `tk export`; the prompt never mentions `CONTRIBUTING.md`, which the
  README points at and whose eight rules (command shape, `parseFlags` with `choices`, output only
  through `ctx.io`, time only through `ctx.clock`, atomic writes with `--force`, error format and
  exit codes, RFC 4180 CSV with CRLF and fixed columns, docs/completions/changelog) decide most
  of the 44 hidden tests. Proof: fixture 9/44, fixture plus reference 44/44, empty 0/44; grader
  ~1.7 s, proof ~5.2 s. 18 one-line rule violations of the reference each fail their own tests. A
  rule-blind export (`console.log`, `Date.now()`, `fs.writeFileSync`, LF CSV, no docs) scores
  13/44; the reference without docs 41/44. No language-server diagnostic (TypeScript API with
  suggestion diagnostics, on fixture and fixture plus reference; the fixture's `run` methods became
  `async` to clear an "await has no effect" hint). `ctx.io.out(text)` writes text as given rather
  than one call per line, so CSV can reach stdout with CRLF. Risk, named by the writer: an agent
  that reads `CONTRIBUTING.md` and imitates the existing commands may score near 1; T4 decides.
  Commit `11b451e`, assessed high (`high_risk`): review due on `9d02179..11b451e` (T3br and T3c).
- 2026-10-01: T3br and T3c reviewed over `9d02179..11b451e`. gentle-ai (lineage
  `review-61f213a662057f45`, four lenses: risk, resilience, readability, reliability): approved and
  acknowledged, authority burned; three suggestions. Codex (recorded): two P2, reproduced
  read-only: the fixture's `add` reuses the id of a deleted last task, and `list` keeps the store's
  order, both against the fixture's own `CONTRIBUTING.md`. All five became T3cr. Reviewed
  boundary: `11b451e`.
- 2026-10-01: T3rr done (delegated writer). Each run's preparation is now inside its own async run,
  so a throw is a rejection `allSettled` waits for; `proveTask` still rejects with it, after every
  started grader has finished and the workspaces are gone (RED: a reference file named like a
  fixture directory, a slow grader marking start and finish outside the workspace: "0 !== 1", and
  the orphaned grader had kept the scratch directory locked). The live discovery comparison asks
  the child Node for `process.features.typescript` and compares only the extensions it runs; RED
  under `NODE_OPTIONS=--no-experimental-strip-types`. `isDiscovered` matches the `test` directory
  case-insensitively, conservatively: Node 24 on Windows did not run `Test/x.mjs` (it compares the
  on-disk case) but did run `A.TEST.MJS`; RED `Test/x.mjs: false !== true`. The `.gitattributes`
  test skips when `git` cannot spawn (proven by mutation with `git` off `PATH`). Evidence:
  `node --test evals/task-proof.test.mjs evals/tasks.test.mjs` 36/36; the same with
  `NODE_OPTIONS=--no-experimental-strip-types` 34/34; `npm run check` exits 0. +66/-11. Commit
  `d329c33`, assessed medium, `under_budget`.
- 2026-10-01: T3rr reviewed on its own over `11b451e..d329c33` (the Stop hook again offered the
  branch from `5ab2ae6`, of which this was the only unreviewed commit). gentle-ai (lineage
  `review-465f838939cc25f9`, lens reliability): approved and acknowledged, authority burned; one
  WARNING. Codex (recorded): one P2, the same defect, checked with Node's bundled matcher: Linux's
  default discovery is case-sensitive, so the four mixed-case names T3rr added to the live
  comparison do not run there while `isDiscovered` flags them, and the check gate would go red.
  Fixed inline (one test, one file): the exact comparison leaves those names out, and for them
  only "what Node ran is flagged" is asserted. Passes on Windows; the Linux RED could not be
  observed here (no WSL distribution), so the fix rests on both reviewers' reading of Node's
  matcher. Reviewed boundary: `d329c33`. Commit `ebe848a`; its first pre-commit run failed once
  on a test that did not fail again (the log was not kept), and the rerun and a direct `check`
  passed: a flaky test somewhere in the suite, unidentified, now logged on every commit.
- 2026-10-01: T3cr done (delegated writer). The `house-rules` store file is `{ nextId, tasks }`
  (an older bare array is read and its `nextId` derived once), so ids are never reused; `list`
  sorts by id; `CONTRIBUTING.md` documents both; the reference's export filters by age only with
  `--since`; the grader names its command list once; README and `engines` say Node 22+. Two new
  hidden guards (id never reused, list order on a store written out of order) and one test of
  export over the new store shape. Proof 44/9 → 47/11, fixture plus reference 47/47; no
  language-server diagnostic. Fixture 755 lines. Commit `d54c52e`.
- 2026-10-01: T3d done (same writer), `evals/tasks/resolver/`: a tiny package manager (fixture 634
  lines, 14 files) whose `resolve()` is a plausible greedy breadth-first pass; the prompt asks for
  the full algorithm of `docs/RESOLUTION.md` (143 lines, ten sections: flat model, constraints,
  candidates, depth-first search in name order, the candidate check, peers, lock, errors, result,
  examples). Rules the brief left open were settled in the spec: an optional name gets "absent" as
  a last alternative, every constraint kind restricts, `ENOVERSION` counts a locked yanked
  version, `ECONFLICT.package` is the last dead end and is asserted only where every dead end is
  on one name. Proof: fixture 15/45, fixture plus reference 45/45, empty 0/45; grader ~2 s. A
  second implementation (explicit stack, written from the spec before the reference) scored 45/45
  first time; 34 mutants of the reference, one per rule, all killed but the deliberately unasserted
  first-versus-last dead end. No language-server diagnostic. Limit: the second implementation
  shares its author with the reference. Commit `94626b8`, assessed medium,
  `slice_budget_reached`: review due on `d329c33..94626b8` (`ebe848a`, T3cr and T3d).
- 2026-10-01: that range reviewed. gentle-ai (lineage `review-bab25395b701a969`, lens
  reliability): approved and acknowledged, authority burned; one suggestion (the `house-rules`
  visible helper `stored()` returns `undefined` on a legacy bare-array store, while the grader
  reads both). Codex (recorded): one P2, verified against the reference: a package named
  `__proto__` sets the prototype of the result's `packages` instead of adding an entry, so it
  vanishes from the result and the lockfile. Both became T3dr, the second adapted: the spec will
  define the name domain rather than the grader test a JavaScript quirk. Reviewed boundary:
  `94626b8`.
- 2026-10-01: T3e done (delegated writer), `evals/tasks/lost-updates/`: `cellar`, a file-backed
  key-value store with a job queue (fixture 613 lines, 14 files) that is correct one call at a time
  and breaks its own `docs/DESIGN.md` (G1–G7 store guarantees, Q1–Q3 queue guarantees) under
  interleaved calls and a failing disk; the prompt is a symptom report. The grader drives the store
  through a deterministic fake adapter that holds, reorders or fails each operation, and checks
  unhandled rejections in a child process. Proof: fixture 13/43, fixture plus reference 43/43,
  empty 0/43; grader 1.3–1.7 s; five runs identical on every workspace graded. A plausible partial
  fix (one mutex around the store, nothing else) scores 20/43; the reference store with the
  fixture's queue 36/43; an independent correct implementation in another style 43/43. DESIGN was
  made explicit where the tests needed it: copies out of `get`/`update`, one write per mutation,
  `clock() - t > visibilityMs` as expiry, the four `ESTALE` cases. No language-server diagnostic.
  1,697 lines.
- 2026-10-01: the flaky test found: its first commit attempt failed the discovery comparison
  again, with `a_test.ts` missing from the names read back out of `node --test`'s TAP output while
  the full suite ran (1,173 tests, 5.8 min); alone it passed. Each discovered file now writes a
  marker into a directory of its own and the comparison reads the markers; a mismatch prints the
  run's output. Six concurrent runs passed. Commit `21b69c7`. T3e committed as `08da909`,
  assessed medium, `slice_budget_reached`: review due on `94626b8..08da909`.
- 2026-10-01: that range reviewed. gentle-ai (lineage `review-5f2864a38403d9b7`, lens
  reliability): approved and acknowledged, authority burned; one WARNING and one suggestion.
  Codex (recorded): two P2. Both reviewers: the markers used `process.getBuiltinModule`, which
  Node 22.0–22.2 lacks while `engines` allows them; fixed inline with a dynamic
  `import('node:fs')`, which works in CommonJS and ESM files alike (the comparison passes).
  Codex, reproduced with the fake adapter: the `lost-updates` reference stores `__proto__` as a
  prototype change and `get('constructor')` returns an inherited function. gentle-ai: the G7 child
  scenario parses adapter data unguarded, so a candidate renaming an unwritten path would crash it
  for a reason unrelated to G7. Both became T3er; as with `resolver`, the reference is fixed and
  `DESIGN.md` says keys are any string, without a hidden test of the JavaScript quirk. Reviewed
  boundary: `08da909`.
- 2026-10-01: T3dr and T3er done (delegated writer), committed with the marker fix as one
  review-fix commit. `resolver`: `RESOLUTION.md` §1 item 7 defines the name domain (npm-style,
  lowercase, at most 214 characters, not starting with `.` or `_`), the reference builds
  `packages` with `Object.fromEntries`, the grader's spec hash updated; proof unchanged 15/45.
  `house-rules`: `stored()` reads both store shapes; proof unchanged 11/47. `lost-updates`: the
  reference keeps its state in a `Map` (`__proto__` persists as a key, `get('constructor')` is
  `undefined`, checked by script), `DESIGN.md` says a key is any string, the guarded parse is a
  shared `grader/json.mjs` used by the G7 scenarios; proof unchanged 13/43, five identical runs.
  No language-server diagnostic anywhere. Rule added to the writer brief: a reference never
  indexes a plain object with a user-supplied string. Commit `25b696c`.
- 2026-10-01: T3f done (same writer), `evals/tasks/format-v2/`: an inventory tool (fixture 719
  lines, 16 files) with an accepted proposal `docs/proposals/format-v2.md` (structured prices in
  minor units per currency, split locations, tag arrays, per-currency valuation, v2 CSV that still
  imports v1, new CLI flags) and a standing format policy in `docs/DATA.md` (migrate in memory,
  write the newest, keep unknown fields, back up once before the first rewrite, refuse a newer
  version with `EVERSION`, read-only commands never write). The prompt says only: implement v2,
  keep v1 files working, follow the policy. 46 hidden tests across every module and the CLI.
  Proof: fixture 12/46 (exactly the guards), fixture plus reference 46/46, empty 0/46; grader
  ~1.1 s. A narrow implementation (three fields and `valuation` only) scores 15/46, because CSV
  and CLI break on object prices; the full reference without the policy rules scores 36/46 (0.78).
  The proposal pins what the tests needed: `validateItem` field names, the `byWarehouse` shape,
  `list` output, a v1 price read as the decimal written (`1.005 EUR` → 101), v1 CSV rows priced in
  EUR. Not derivable from a document: `importCsv` returning the new state, which the fixture's own
  docstring says. No language-server diagnostic; the reference uses `Map`/`Object.fromEntries`.
  Commit `465a06a`, assessed medium, `slice_budget_reached`.
- 2026-10-01: `08da909..465a06a` reviewed as two candidates to stay inside the reviewers'
  context. gentle-ai over `08da909..` (lineage `review-d0c89b289dc34f5b`; `--committed-only`
  reviews up to HEAD, so it covered `format-v2` too) and over `25b696c..465a06a` (lineage
  `review-c06051121fb4ae64`): both approved and acknowledged, authority burned; four suggestions,
  all on the `format-v2` reference (v2 CSV tags not normalized, a malformed v2 item crashes with a
  TypeError, the v1 CSV price goes through `Number()`, a missing `bin` prints `undefined`). Codex:
  nothing actionable over `08da909..25b696c`; two P2 over `25b696c..465a06a`, reproduced in
  memory: a valid v1 price like `0.0000001` (`1e-7` as a string) fails migration with `EFORMAT`,
  and "the decimal as written" cannot hold for JSON digits beyond a double. All became T3fr: the
  first gets a hidden test (v1 files must keep working), the second a precise definition in the
  proposal instead of a test. Reviewed boundary: `465a06a`.
- 2026-10-01: T3fr done (delegated writer, one parent edit). The reference's `toMinor` reads a
  decimal's digits and shifts the point by its exponent, with no float (exponent capped at three
  digits); a new hidden test migrates v1 prices written `0.0000001` and `5e-7` to 0 and runs `list`
  and `move` on such a file (RED: 46/47 on the old reference). The writer's test also expected
  `1e21` to migrate to `1e23`; the parent removed that case, because the proposal says nothing
  about amounts beyond the safe-integer range and an implementation rejecting them would be as
  correct. The proposal now defines a JSON price's decimal as the shortest round-trip form
  (exponent included) and a CSV price's as the field text; the reference's v1 CSV import reads
  the text; v2 CSV tags are cleaned like v1 tag lists (one proposal sentence); a missing `bin`
  reads as `null`; a malformed v2 item is `EFORMAT`. Proof 46/12 → 47/12, fixture plus reference
  47/47; all five candidates proven (`node --test evals/tasks.test.mjs` 5/5, rerun by the parent);
  no language-server diagnostic.
- 2026-10-01: the flaky discovery test's real cause: its first T3fr commit attempt failed again,
  this time with the markers, and the nested run's TAP showed the missing files' child processes
  exiting `3221225794` (`0xC0000142`, `STATUS_DLL_INIT_FAILED`): Windows failing to start processes
  when ~120 are spawned at once while the whole suite runs in parallel. The markers fixed nothing
  (the reporter was never the problem); the nested `node --test` now runs with
  `--test-concurrency=2` (5.4 s alone). The same limit may bite T4: a trial spawns many processes.

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

## T3 design
Decided 2026-10-01, before the first candidate was written:

- **A candidate is `evals/tasks/<id>/`**: `task.md`, `task.json`, `fixture/`, `grader/` and
  `reference/`, an overlay holding only the files a correct solution changes or adds. The runner
  copies `fixture/` alone, so the agent never sees the grader or the reference. `task.json`
  `proof` pins `{ total, fixturePassed }`, so a grader that drifts is a failing test.
- **Proof by three workspaces**, graded with the runner's own `gradeWorkspace`: fixture plus
  reference scores exactly 1; the untouched fixture scores `fixturePassed / total`, below 1; an
  empty workspace scores 0 with the same `total` — because a hidden test that fails as a whole
  file when one module is broken would turn a fractional score into a 0 (T1 decisions).
- **Visible tests are `tests/**/*.spec.mjs`**, run by the fixture's own `npm test`
  (`node --test "tests/**/*.spec.mjs"`), green on the fixture and with the reference. No file
  under `evals/tasks/` matches Node's default test patterns — because this repo's bare
  `node --test` would otherwise run every fixture's tests, and a reference overlay's tests cannot
  resolve the modules it does not overlay.
- **Fair graders**: every hidden test names the prompt sentence or the fixture document clause it
  checks, and asserts only what that source specifies (error codes, exit codes, documented
  formats), never wording nobody wrote down — because a test the agent could not have derived
  measures luck. Deterministic: no wall clock, network or randomness; time comes from an injected
  clock.
- **A red `npm test` costs a point**: every grader holds one hidden test that runs the
  workspace's own visible suite and expects it green — because otherwise an agent that fixes the
  code and leaves the tests it broke, or the tests that encode a drift, red scores full marks
  (Codex on T3b).
- **No unused declaration or dead branch in a fixture**: the current arm runs a TypeScript
  language server, and a diagnostic next to a seeded defect would point that arm, and only that
  arm, at the answer. A defect is wrong code that reads as intended.
- **No `AGENTS.md`, `CLAUDE.md` or `.claude` in a fixture**: the project layer is what
  `js-harness init` adds to the current arm, and a fixture that brought its own would hand it to
  both. Repo rules live in `README.md`, `CONTRIBUTING.md` and `docs/`.
- **`evals/tasks/**` is `eol=lf`** in `.gitattributes`: this machine checks out CRLF
  (`core.autocrlf=true`), and a fixture's data files must be the same bytes on every machine.
- **Five candidates, each hard in a different way**, since which kind separates the configs is
  the question: thoroughness of an audit (`spec-drift`), rules nobody pointed at
  (`house-rules`), an algorithm with a long spec (`resolver`), interleavings (`lost-updates`),
  and breadth of a cross-cutting change (`format-v2`). Whether any has headroom is T4's to
  measure; if fewer than three survive it, more candidates are written then.
- **Size**: a fixture of 500–700 lines over 10–16 files, so a task commit is ~1,200–1,500 lines,
  one work unit each. The Delivery forecast (~400–700 lines for all fixtures and graders) was
  written before the tasks were designed and is too low by about a factor of ten.

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
Slice 1 (T1–T2) is merged (PR jsaristi/js-harness#20, `5ab2ae6`). Next: T3a, then T3b–T3f one
at a time, on `feat/evals`; slice 2 (T3–T4) starts from `5ab2ae6`.
Before T4: his `claude setup-token` and his choice of permission mode, asked one at a time.
Reviewed boundary: `db0253b`.

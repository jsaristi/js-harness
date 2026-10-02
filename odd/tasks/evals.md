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
- [x] T4a Sandbox isolation holds with the engram plugin: the current arm's engram hooks and the
  server they spawn stay inside the trial. A per-trial `ENGRAM_PORT` (and no inherited
  `ENGRAM_URL`) in `sandboxEnv`, the listener on that port swept with the trial's other
  processes, and the isolation probe's fake agent extended with a memory write and a subagent
  stop, so the proof exercises the paths the plugin added (route: delegated writer)
- [x] T4ar T4a review findings: on POSIX a listener lookup that failed is never read as a free
  port. `lsof` means "no listener" only on its documented no-match (exit 1, nothing on stdout
  or stderr), and an `ss` row for the port with no owner is an inconclusive lookup (gentle-ai
  WARNING, Codex P2 twice) (route: delegated writer, finished inline)
- [x] T4as Findings of Codex's first full read of T4a: the Windows lookup no longer swallows a
  real error as "no listener" (only `ObjectNotFound` is the empty case), and the probe's
  contamination check examines the subagent's requests too (Codex P2 twice) (route: delegated
  writer)
- [x] T4k Tree kills cannot hit an unrelated process: on Windows a process is another's descendant
  only by parent pid **and** creation time, each selected process is killed on its own after
  its creation time is re-checked, and no `taskkill /T` or bare `ParentProcessId` query remains
  in `bin/` or `evals/`. One shared module, `bin/lib/process-tree.mjs`, used by `bin/check.mjs`,
  `bin/codex-review.mjs`, `evals/runner.mjs` and `evals/ports.mjs` (route: delegated writer)
- [x] T4kr T4k review findings: a process still running after its kill makes `killTree` and
  `killSurvivors` throw (Codex P2), and `runSensor` takes injectable kills so the path from a
  throwing kill to `sweepError` is tested (gentle-ai suggestion) (route: inline, two small
  understood edits)
- [x] T4kt Test teardowns never signal a process by a bare number: a spawned child is stopped
  through its handle, a pid learned as a number gets its `{ pid, createdAt }` identity when it
  is learned and is killed with `killProcesses`, and a guard test fails any test or fixture
  that does otherwise (Codex P1) (route: delegated writer)
- [x] T4s The suite entry, `node evals/suite.mjs`: explicit arguments with no default permission
  mode, the token read from `JS_HARNESS_EVAL_OAUTH_TOKEN` and passed only as
  `CLAUDE_CODE_OAUTH_TOKEN` in a trial's env, the template removed on every path, one results
  file per run that names the stack and refuses a resume on a changed one, `--summary` with the
  screen's keep/drop/incomplete, and the sweep-boundary follow-up (route: delegated writer)
- [x] T4sr T4s review findings: an interrupt stops the active trial and waits for its cleanup
  before the process ends (Codex P1), the sweep's boundary is a set of delimiters instead of
  "anything that is not a name character" (Codex P1), raw logs go under `evals/runs/<name>/`
  (Codex P2), and an empty task set is a usage error (gentle-ai suggestion) (route: delegated
  writer)
- [x] T4srr The suite also owns SIGHUP: a terminal that closes stops the trial like an interrupt
  (gentle-ai WARNING and Codex P1 on T4sr, the same finding) (route: inline, one file)
- [x] T4ap The current arm's engram controls match what the plugin's hooks really write. The first
  real-binary run (2026-10-02) held the isolation and failed `engramPrompt`: on Windows the
  plugin's UserPromptSubmit hook runs in its safe mode and never posts the prompt, so that
  control cannot pass there. Controls that hold on every path of the hooks replace it, and
  what the hooks do post joins the leak needles (route: delegated writer; the probe, its test
  and its fixtures)
- [x] T4kg A reused pid held by a process this user cannot read is "gone", not "running": the
  kill settles that case through CIM instead of failing the caller (found by the gate, a real
  reuse) (route: inline, two small understood edits)
- [x] T4 Headroom screen: minimal at `medium`, 3 trials per candidate; keep the tasks under 0.8
  (route: inline run, results committed). Outcome: **no task kept**, all five at 0.98–1.00
- [ ] T4h Headroom found: at least three candidates the minimal config at `medium` scores under
  0.8 on. The T3 rule says more candidates are written when fewer than three survive; what
  kind, after five that were hard in five different ways all hit the ceiling, is open and
  Sebastián's to steer (route: to be set with the direction)
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
  Commits `103afc5` (the cap) and `d0bc904` (T3fr).
- 2026-10-01: `465a06a..d0bc904` reviewed so T3 closes clean. gentle-ai (lineage
  `review-28fd41e980f1cdee`, lens reliability): approved and acknowledged, authority burned; two
  WARNINGs and one suggestion. Codex (recorded): one P2. All four are about the `format-v2`
  reference's price parsing on inputs no hidden test uses (`1e308`, a short v1 CSV row, `.5`/`1.`/
  `+1` in a v1 CSV, a `1.5e21` case in the reference's own visible spec). The review contract
  forbids looping until clean, and none changes a measurement (the reference still scores 47/47
  and every hidden test stays fair), so they are Follow-ups. Reviewed boundary: `d0bc904`.
  **T3 is complete**: five candidates, each proven by `node --test evals/tasks.test.mjs`
  (fixture / total: `spec-drift` 13/51, `house-rules` 11/47, `resolver` 15/45, `lost-updates`
  13/43, `format-v2` 12/47; fixture plus reference 1 on every one).
- 2026-10-01: the stack moved under the feature. `gentle-ai upgrade` (00:25Z) took engram to
  3.0.0 and `gentle-ai sync` (00:33Z) ran `engram setup claude-code`, which installed the Claude
  plugin `engram@engram` 0.1.5: hooks and one skill, no MCP server
  (`~/.claude/plugins/cache/engram/engram/0.1.5/` has `hooks/`, `scripts/`, `skills/` and no
  `.mcp.json`). Its hooks talk HTTP to `ENGRAM_URL` or `127.0.0.1:${ENGRAM_PORT:-7437}`:
  SessionStart posts `/sessions` and starts a detached `engram serve` when nothing answers,
  PreToolUse runs on every `mem_*` write, SubagentStop posts `/observations/passive`. None of
  that honours `ENGRAM_DATA_DIR`, and the allowlist drops `ENGRAM_PORT`, so a current-arm trial
  would reach the real server on 7437 (it answers today: version 3.0.0) and could write the real
  store. The T2c/T2s proof never exercised this: its fake agent runs only Bash and Write. T4 is
  blocked on T4a. gentle-ai itself is now 4.0.0 (`odd/tasks/stack-v4.md`), so the current arm is
  gentle-ai 4.0.0 + engram 3.0.0 + plugin 0.1.5; the versions are fixed before T4 and must not
  change between T4 and T5, and the report names them.
- 2026-10-02: T4a implemented (delegated writer, resumed after a session restart with its work
  intact; RED observed per module, GREEN: the five evals test files 349 pass, 0 fail, 1 skipped,
  the EPERM file-symlink test that was skipped before; `npm run test` 1242 pass, 0 fail, 8
  skipped; parent spot check re-ran the five files with the same result). What it does:
  - **A port per trial.** `evals/ports.mjs` `allocatePort()` binds port 0 and releases it, never
    returns 7437 or a port under 1024, and keeps overlapping trials apart with a reserved set.
    Each config allocates it in `prepare` and returns `{ engramPort }`; `sandboxEnv`,
    `prepareSandbox`, `seedHome` and `initWorkspace` throw without one, so nothing can fall back
    to 7437. Both arms carry `ENGRAM_PORT`; `ENGRAM_URL` and `ENGRAM_SOCKET` are outside the
    allowlist. `seedHome` writes `ENGRAM_PORT` next to `ENGRAM_DATA_DIR` in the sandbox
    `.claude.json` engram entry and drops a URL or socket it carried.
  - **The listener dies with the trial.** A config may have a `cleanup`, which `runTrial` calls
    once on every path after `prepare` (success, failure, timeout, cap), after the sweep by path
    and before the directories go. It runs `killByPort`: on Windows `Get-NetTCPConnection` plus
    `Get-Process` (`netstat` prints its state column in the OS language), then `taskkill /T /F`;
    on POSIX `lsof`, `ps`, `ss` as a fallback, `SIGKILL`. `assertTrialPort` refuses 7437 before
    anything runs, and a listener not named `engram` is left alone and reported.
  - **The probe drives the plugin's paths.** The fake API now scripts a `mem_save` and a
    subagent besides Bash and Write, and the prompt carries a nonce. For the current arm two
    positive controls must hold (the sandbox store has the prompt and the memory), the agent's
    tools must see the trial's `ENGRAM_PORT` and no URL or socket, and after cleanup nothing may
    accept a connection on the trial port and no engram process may exist that was not there
    before (a failed listing is inconclusive, never a pass). The real `~/.engram` is
    content-hashed and scanned for the nonce, as the real home already was.
  **Not yet proven:** the probe with the real `claude` binary has not run, so T4a stays open.
  Unknown until it does: whether the engram MCP tool is offered to the model without a
  ToolSearch step, whether SessionStart starts a server on the trial port and the prompt hook
  reaches it, and whether the trial's `engram mcp` exits with Claude. Observed on this machine:
  the only `engram.exe` processes are two `mcp --tools=agent`, no `serve`, so what answers on
  7437 may be an MCP process. The run is zero spend (a loopback fake API), but if the fix were
  wrong it would be the trial that writes the real store, which is an Ask-me-before: it waits
  for Sebastián. Command:
  `node evals/isolation-probe.mjs --claude <path to claude.exe> --arm both --control-ms 60000`.
  The change is about 1,370 lines against the ~400 heuristic (half of it tests): one behavior
  across four modules that each had to refuse a missing port, not split because a half-wired
  port is the unsafe state.
- 2026-10-02: `d0bc904..514dd43` (T4a) reviewed. gentle-ai: medium, lineage
  `review-5b4f5f6e02658d8d`, lens reliability, approved and acknowledged, authority burned; one
  WARNING and one suggestion. Codex: two P2, but **no record**: its successful commands showed
  497 of the 1,314 changed lines, and `codex-review` records only on evidence that the whole diff
  was read. It said its coverage was limited because "delegation tools were unavailable"; to
  re-run after T4ar. All findings are one defect: on POSIX, `findListeners` returned an empty
  list when `lsof` failed with only stderr output, or when `ss` listed the socket without its
  owner, so `killByPort` reported a clean port without checking. Not reachable on this Windows
  host, but it broke the module's own rule that an empty list means free, never "could not ask".
- 2026-10-02: T4ar done. The writer was cut off by a second session restart with the fix on disk
  and uncommitted; the parent verified it rather than redo it. RED, observed by stashing the
  code change and running the new tests against the old code: `node --test evals/ports.test.mjs`
  21 pass, 3 fail (the three new tests). GREEN with the change:
  `node --test evals/ports.test.mjs evals/configs.test.mjs evals/runner.test.mjs` 207/207. The
  POSIX paths are tested against fixtures only; nothing here ran on Linux or macOS.
- 2026-10-02: `514dd43..58492e4` (T4ar) reviewed by gentle-ai: lineage `review-9aa775fe0120483f`,
  lens reliability, approved and acknowledged, authority burned; one suggestion (a host whose
  `lsof` warns on every run can never confirm a free port; it fails closed, so a follow-up).
  Codex re-ran over `d0bc904..58492e4`, read the whole diff this time and is recorded. Two new
  P2, both on T4a's code and both about the property the task exists for, so they became T4as
  instead of follow-ups: on Windows, the host these evals run on,
  `Get-NetTCPConnection -ErrorAction SilentlyContinue` hid real errors and the lookup answered
  "free"; and the probe dropped a subagent's requests from the contamination check, so a
  minimal-arm run with a contaminated subagent would have passed.
- 2026-10-02: T4as done (delegated writer; RED: the CIM-failure case did not throw, and the
  subagent request was not examined; GREEN: `node --test evals/ports.test.mjs
  evals/isolation-probe.test.mjs evals/configs.test.mjs evals/runner.test.mjs` 321/321). On this
  host, with real PowerShell: a free port from `allocatePort()` gives `[]` and a real listener
  is found.
- 2026-10-02: **the harness was killing unrelated processes on this machine** (T4k). The Claude
  desktop app closed three times in one evening (2026-10-01 23:31, 2026-10-02 00:36 and 01:14,
  local time) while these tests and the pre-commit gate ran. Its `main.log` at 01:13:59 says
  `Network Service process gone (reason=killed, exitCode=1) outside app quit` and its shell PTY
  exited with code 1, the code `taskkill /F` leaves; Windows logged no application error for
  it. Cause: `killSurvivors` (`evals/runner.mjs` and its twin in `bin/check.mjs`) ran
  `Get-CimInstance Win32_Process -Filter 'ParentProcessId=<pid>'` and killed each match with
  `taskkill /T /F`, and `killTree`, the sweep by path, `killByPort` and `bin/codex-review.mjs`
  used `taskkill /T`. Windows keeps a dead parent's pid in its children and reuses pids quickly,
  so when a short-lived test child receives the pid some long-lived process records as its
  long-dead parent, that process and its tree die (`explorer.exe` always has a dead parent).
  The defect is on `main` too: slice 1 of this feature and F4's `bin/check.mjs`, which is the
  pre-commit gate of every project that installs the harness.
- 2026-10-02: T4k done (delegated writer; trigger: 2+ non-trivial files). Design: a pid is not an
  identity on Windows, a pid with its creation time is. `selectDescendants` is pure: under a
  live root a child needs `createdAt >= root.createdAt`; under an exited root it needs
  `startedAt - 100 ms <= createdAt <= exitedAt + 100 ms` (Node's clock against the kernel's);
  below the first generation, `createdAt >= parent.createdAt`; unknown creation time or a pid
  of 4 or less is never selected. The selection runs in Node from one `Get-CimInstance`
  snapshot; the kill script receives `pid@createdMs` pairs, opens each process, compares its
  start time and kills that handle only. A failed snapshot throws where the caller relies on
  the kill. RED: the regression cases (an old process whose parent pid equals the root's) were
  selected by a bare parent-pid match. GREEN: `node --test bin/lib/process-tree.test.mjs` 33/33
  (re-run by the parent), `bin/check.test.mjs evals/runner.test.mjs evals/ports.test.mjs`
  220/220, `evals/isolation-probe.test.mjs evals/configs.test.mjs evals/home.test.mjs` 213 pass
  and 1 skip, `bin/codex-review.test.mjs` with the module 107/107; `rg -n taskkill bin evals`
  finds only comments and assertions. Not verified: a real pid collision (the tests use a
  synthetic snapshot), the POSIX paths (unchanged, not run on this host), other Windows
  versions. Closes the follow-up that `killSurvivors` lived twice. Commit `298d739`.
- 2026-10-02: `58492e4..298d739` (T4as and T4k) reviewed by gentle-ai: lineage
  `review-f4236dab534e95b7`, medium risk, one lens (reliability), approved and acknowledged,
  one suggestion (nothing tested that a kill throwing inside `runSensor`'s timers lands on
  `sweepError`). Codex on the same range: one P2 (`killProcesses` returns the processes still
  running, and `killTree` and `killSurvivors` dropped that list, so a survivor reached neither
  `sweepError` nor `killFailure`), and no record, because its commands showed 993 of the 1,062
  changed lines. Both findings became T4kr.
- 2026-10-02: T4kr done inline. RED: `killTree` and `killSurvivors` returned on an `R` outcome
  ("Missing expected exception"), and `runSensor` had no way to take a kill, so `sweepError` was
  `undefined`. GREEN: `node --test bin/lib/process-tree.test.mjs bin/check.test.mjs
  evals/runner.test.mjs evals/ports.test.mjs bin/codex-review.test.mjs` 329/329. `killByPort`
  still ignores the kill's report on purpose: the port lookup after it decides. Commit
  `ca08a0c`; gentle-ai assessed `298d739..ca08a0c` as medium, not due (`under_budget`).
- 2026-10-02: Codex on `58492e4..ca08a0c`: one P1 and again no record (1,029 of 1,106 changed
  lines shown). The P1 is T4k's own defect in the tests: `bin/lib/process-tree.test.mjs` kept a
  set of pids, some already killed by the tests, and its `after` hook signalled each by number;
  `evals/runner.test.mjs` (since slice 1) and `evals/isolation-probe.test.mjs` did the same.
- 2026-10-02: T4kt done (delegated writer; trigger: 2+ non-trivial files). New
  `identifyProcesses` in the module and `bin/lib/process-tree.testkit.mjs` (`createReaper`:
  `child`, `pids`, `reap`, `sweep`); a pid learned as a number is identified when learned, and
  only if it started after the test began (`since`). RED: the helper's and the reaper's unit
  tests against a stub, and the guard against the unfixed sites. GREEN:
  `bin/lib/process-tree.test.mjs` 44/44 (re-run by the parent), `evals/runner.test.mjs
  evals/ports.test.mjs` 153/153, `evals/isolation-probe.test.mjs` 111/111, `bin/check.test.mjs
  bin/codex-review.test.mjs` 142/142; `rg -n "process\.kill\(" -g "*.test.mjs" bin evals` shows
  only `process.kill(pid, 0)` probes. POSIX still signals a learned pid by number (the module
  reads no creation time there); not exercised on this host. Commit `0f96ffd`.
- 2026-10-02: `298d739..0f96ffd` (T4kr, T4kt) reviewed by gentle-ai: lineage
  `review-306ad3f6c220ebdb`, medium risk, one lens (reliability), approved and acknowledged,
  three suggestions. (1) No caller is shown to handle `killTree` now throwing or to have used
  its old return value: checked, `rg -n "= (await )?(killTree|killSurvivors)\(" bin evals`
  finds no reader, and `killByPort` calls `killProcesses`, not `killTree`. (2) `reapHolder` in
  `evals/isolation-probe.test.mjs` takes the holder's identity at teardown instead of when the
  pid is written: a follow-up. (3) The `runSensor` test's scripted kill could be replaced by
  the real kill's own throw: fixed, the real kill is wrapped.
- 2026-10-02: Codex could not read `58492e4..HEAD` whole (four runs showed 993 of 1,062, 1,029
  of 1,106, 496 of 1,355 and 791 of 1,062 changed lines; none recorded), so the range was
  reviewed as three, the older two from a detached worktree at that commit (records live in the
  shared git directory): `58492e4..7ddc047` no findings; `7ddc047..298d739` the P1 and P2
  already fixed by T4kt and T4kr; `298d739..0f96ffd` no findings. All three recorded.
- 2026-10-02: T4s done (delegated writer, cut by a session restart with the work on disk and
  stashed while T4k went first; reconciled by the parent: one conflict in `evals/runner.mjs`,
  between the new boundary comment and T4k's sweep script). `evals/suite.mjs` exports
  `suiteMain(argv, env, deps)`. Results: `evals/results/<name>.json`, `{ format: 1, name,
  createdAt, permissionMode, model, stack, args, trials }`, written through a `.tmp` file;
  `runSuite` takes a `store` (`{ read, append }`) so the suite keeps its own file shape and
  resume still skips recorded trials. The sweep by path now ends a match on any character that
  cannot continue a name, so `trial-1;` matches and `trial-10` does not. GREEN after the
  reconcile: `node --test evals/runner.test.mjs evals/suite.test.mjs
  bin/lib/process-tree.test.mjs` 207/207 (38 of them the suite's). Not verified: a run with the
  real binary, which is T4 itself. Commit `267dc13`.
- 2026-10-02: `0f96ffd..267dc13` reviewed by gentle-ai: lineage `review-c31fc7a3d66fd048`, medium
  risk, one lens (reliability), approved and acknowledged, one suggestion (`--tasks all` over
  an empty tasks directory exits 0 with nothing run). Codex on the same range, recorded: two P1
  and a P2. The suite's interrupt handler exited before `runTrial`'s cleanup, leaving a
  detached agent running and spending; the new sweep boundary matched `trial-1+backup` when
  sweeping `trial-1` (on Windows `+`, `(`, `[` continue a name), so it could kill an unrelated
  process; and two runs with different names shared one raw-log directory, so T5 would have
  overwritten T4's logs. All four became T4sr.
- 2026-10-02: T4sr done (delegated writer; trigger: 2+ non-trivial files). The suite owns an
  `AbortController` passed through `runSuite` and `runTrial` to `runProcess` and the grader: the
  first signal aborts, the trial ends as `{ status: 'interrupted' }` through its own `finally`
  and records nothing, then the template is removed and the process exits `128 + n`; a second
  signal exits at once. A caller that passes a signal to `runProcess` gets no POSIX forwarding
  (it would end the process before the cleanup). The sweep ends a match at the end of the line,
  a separator, a quote, whitespace or one of `;`, `,`, `=`, `)`: a wrong kill is worse than a
  missed survivor. RED observed per change. GREEN: `evals/suite.test.mjs` 43/43 (re-run by the
  parent), `evals/runner.test.mjs` 132 pass and 1 skip (POSIX-only), `bin/lib/process-tree.test.mjs`
  44/44, `evals/isolation-probe.test.mjs evals/configs.test.mjs evals/home.test.mjs` 213 pass
  and 1 skip. Not verified: POSIX, and a real SIGINT to a real `suite.mjs` process (the signal
  is injected through the `process` seam). Commit `24774db`.
- 2026-10-02: `267dc13..24774db` (T4sr) reviewed by gentle-ai (lineage `review-061383905cd4dbe2`,
  medium, reliability lens, approved and acknowledged) and Codex (recorded). Both found the
  same defect: with the suite's abort signal `runProcess` forwards nothing, and the suite
  listened to SIGINT and SIGTERM only, so a SIGHUP (the terminal closing) ended the suite and
  left the detached agent running. gentle-ai also noted that an interrupt during grading
  leaves the agent's raw logs, against `runTrial`'s comment, with no test on that path.
- 2026-10-02: T4srr done inline. RED: the SIGHUP case exited with nothing (`[]` instead of
  `[129]`). GREEN: `node --test evals/suite.test.mjs` 43/43. `runTrial`'s comment now says the
  logs of an agent that had ended stay when its grader is interrupted, as they do for a cap or
  an auth stop; the missing test of that path is a follow-up.
- 2026-10-02: Sebastián gave the go-ahead for the real-binary probe. First run, `node
  evals/isolation-probe.mjs --claude C:\Users\Oficina\.local\bin\claude.exe --arm both
  --control-ms 60000`: exit 1. The isolation held in both arms (leak scan of the real trees and
  of the real engram store: nothing; no real tree changed outside the control window; nothing
  left on the trial's engram port), and one positive control failed, `engramPrompt`. Cause, read
  from the plugin (`~/.claude/plugins/cache/engram/engram/0.1.5/scripts/user-prompt-submit.sh:464-489`):
  under Git Bash on Windows the UserPromptSubmit hook takes a builtin-only safe path that writes
  its state file and exits without `POST /prompts`. The prompt is never stored on this machine,
  in a trial or in real use, so the control could not pass. A second run with `--keep-sandbox`
  confirmed it: the state file was in the sandbox's temp directory, the trial's own
  `serve.err.log` named the trial's port, and the session id was in the trial's store.
- 2026-10-02: T4ap done by a delegated writer (Sonnet). `engramPrompt` is no longer a control;
  three replace it for the current arm: `engramHook` (the hook's
  `engram-claude-<session id>-tools-loaded` state file in the sandbox's temp directory, written
  on both of the hook's paths), `engramServer` (the server log in the trial's data directory
  names the trial's port) and `engramSession` (the session id is in the trial's store; only
  `session-start.sh` posts `/sessions`, though a content scan cannot tell its row from the MCP
  write that names the same session). Whether the prompt was stored is reported as information,
  like the subagent stop. The trial's session id (from the agent's result, else its transcript's
  name) is a new needle for the real engram store and the real trees, added after the agent ran
  and never printed before the scans. RED: 11 failing tests on the controls, 2 on the needles
  (a session row planted in the fake real store went unseen). GREEN: `node --test
  evals/isolation-probe.test.mjs` 122/122, `bin/lib/process-tree.test.mjs` 44/44, runner, suite,
  home and configs 277 pass, 2 skipped.
- 2026-10-02: T4a's proof, run by the parent after T4ap: the same command, both arms, 60 s
  control window: **exit 0, PASS**. Current: `transcript ok, workspaceNonce ok, workspaceWrite
  ok, engramDb ok, engramHook ok, engramServer ok, engramSession ok, engramMemSave ok`; the real
  global CLAUDE.md reached 7 of 7 requests; real engram store (8 files, 57 MB) scanned for the
  nonce, the sandbox name and the session id: nothing; leak scan of the real trees: nothing; no
  real tree changed outside the control window. Minimal: the three applicable controls ok, the
  real CLAUDE.md reached none of 6 requests, nothing found, nothing changed. Information only:
  on this machine the engram hooks store neither the prompt nor the subagent stop. The probe ran
  as `claude-opus-5-5`, effort medium, permission mode `bypassPermissions`. No spend (loopback
  fake API). The sandbox kept for the diagnosis and the work root were removed.
- 2026-10-02: T4ap committed as `e54ff9f`. `24774db..e54ff9f` (T4srr, the docs commit and T4ap,
  437 lines) reviewed by gentle-ai (lineage `review-286adcc0baffe81a`, medium, reliability lens,
  approved and acknowledged) with two suggestions, both about untested fallbacks, now
  Follow-ups. `f99f859..e54ff9f` reviewed by Codex (recorded): no actionable finding, a static
  read.
- 2026-10-02: the gate of the docs commit that recorded those reviews went red once:
  `evals/runner.test.mjs`'s teardown threw `still running after the kill: pid 7980`. Pid 7980
  was by then a `SearchFilterHost.exe` of SYSTEM created at 13:59:19, during the gate: a real
  pid reuse. The identity check did its job, the unrelated process was not killed. The defect
  was the report: `KILL_SCRIPT` read the start time through a handle, which PowerShell returns
  as null for another user's process, the comparison threw, and the outcome stayed `R`
  (running), so `killTree`, `killSurvivors` and the test reaper threw on a process that was
  never theirs. T4kg, inline: when the handle cannot be read, CIM (which reads any process's
  creation date) decides: no row or a different creation time is `G`, the same one or none
  stays `R`, and no kill is tried either way. RED: `killProcesses` on a `spoolsv.exe`-class
  process with a creation time an hour off answered `running: [1092]`. GREEN: `node --test
  bin/lib/process-tree.test.mjs` 45/45. The same defect is in no other branch: `main` and
  `feat/stack-v4` do not have T4k at all. Commit `09d7a90`; gentle-ai assessed it medium,
  under budget; Codex reviewed `e54ff9f..09d7a90` (recorded): no actionable finding.
- 2026-10-02: Sebastián stored the token (checked without reading it) and chose
  `bypassPermissions` (`4b1ab30`). **T4 ran**, the first real trials: `node evals/suite.mjs
  --claude C:\Users\Oficina\.local\bin\claude.exe --configs minimal --efforts medium --repeats 3
  --tasks all --permission-mode bypassPermissions --name headroom`, with the token passed to
  that one process from the user variable. 15 of 15 trials recorded, no error, no cap, exit 0;
  35.8 minutes of agent time; 6.75M input tokens (almost all cache reads) and 232.5k output;
  `claude-opus-5-5`, Claude Code 2.1.284, gentle-ai 4.0.0, engram 3.0.0, plugin 0.1.5.
  Results: `evals/results/headroom.json`; raw logs in `evals/runs/headroom/` (not committed; no
  token in either, searched for `sk-ant-`). The work root was removed by the suite.

  | task | mean | per trial (passed/total) | turns | wall |
  |---|---|---|---|---|
  | format-v2 | 0.99 | 47/47, 47/47, 46/47 | 37, 29, 32 | 4m55s |
  | house-rules | 0.98 | 46/47 ×3 | 8, 20, 8 | 1m17s |
  | lost-updates | 1.00 | 43/43 ×3 | 9, 12, 13 | 2m19s |
  | resolver | 1.00 | 45/45 ×3 | 6, 6, 6 | 1m40s |
  | spec-drift | 0.99 | 50/51, 50/51, 51/51 | 10, 13, 15 | 1m44s |

  **Every candidate is dropped** (keep is a mean under 0.8): 709 of 713 hidden checks passed
  over the 15 trials. The bare configuration at `medium` is at the ceiling on all five, the
  predecessor's failure again, so a score cannot separate the configs on these tasks and
  `--min-discriminating 3` cannot be met with them. Not yet read: which checks the four misses
  were (`house-rules` misses the same count in every trial).

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
| engram MCP server (stdio) | `~/.engram/engram.db` | `ENGRAM_DATA_DIR` |
| engram plugin hooks (since 2026-10-01: SessionStart, PreToolUse on `mem_*` writes, SubagentStop, SessionEnd) and the `engram serve` they start | the HTTP server on `127.0.0.1:7437`, which writes its own store | `ENGRAM_PORT` (or `ENGRAM_URL`); not `ENGRAM_DATA_DIR` (T4a) |
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
  permission mode cannot edit or run tests. The real settings use `bypassPermissions`, and that
  is the mode the eval passes (Sebastián, 2026-10-02).
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
- The `format-v2` reference's price parsing on inputs no hidden test uses (review of
  `465a06a..d0bc904`): `1e308` and other huge exponents give `Infinity` or an unsafe integer; a
  v1 CSV row shorter than three fields throws a `TypeError` instead of an import error; `.5`, `1.`
  and `+1` in a v1 CSV, which `Number()` accepted, are now refused; the reference's visible spec
  pins `toMinor(1.5e21, 'JPY')`, an amount the proposal leaves open. None changes a score.
- Process starts fail on Windows under heavy parallel spawning (`0xC0000142`,
  `STATUS_DLL_INIT_FAILED`): seen in the discovery test with ~120 nested processes on top of the
  full suite. T4's suite runs trials one at a time, but a current-arm trial starts MCP servers,
  hooks and graders; watch for agent or grader exits with that code.
- Signal forwarding (kill the tree, then re-raise SIGINT/SIGTERM on POSIX) is untested, and the
  re-raise ends the process before `runTrial`'s `finally`, so an interrupted trial leaks its
  workspace (gentle-ai suggestion, left as is).
- gentle-ai's Stop hook always proposes the branch point as the review base, so after every
  commit it offers the accumulated branch as a fresh candidate even when slice reviews cover every
  commit in it. Worth raising with gentle-ai if it keeps costing a decline per stretch.
- Untested (gentle-ai suggestions on T2s): the probe's `finally` sweep for an arm that throws
  before its early sweep (a throwing `seed` would reach it), and `leakHits` with a previous
  snapshot and an inherited directory-name hit.
- No test interrupts a trial while its grader runs (`gradeWorkspace` returning `aborted`), so the
  cleanup and the no-record rule on that path are unproven (gentle-ai suggestion on T4sr).
- The probe's `engramServer` control reads engram's `listening on <host>:<port>` log line, seen
  only for engram 0.1.5; another format fails the control with its hint, it does not pass
  silently. The engram controls are unverified on POSIX (T4ap).
- A flake in the gate, seen once (2026-10-02, a docs-only commit): `evals/task-proof.test.mjs:304`
  ("a visible suite that rewrites or deletes a source file...") reported `task quote: the
  visible suite fails on the untouched fixture (1 of 2 pass)` after 21 s, under the full
  parallel run. It passed on the gate runs before and after. Not diagnosed.
- A second flake in the gate, seen once the same day: `evals/suite.test.mjs:698` (the interrupt
  during a real trial) found one of the trial's two processes "alive" after the cleanup, after
  21 s. Not diagnosed. A hypothesis worth checking first: the test asks whether a pid is alive
  by its number, and this machine reused a pid within one gate run that day (T4kg), so the
  answer may have been about another process. Three red gate runs out of nine that day, each
  green on the retry: the gate's own reliability is now a cost.
- The same day one gate run ended as `npm run test timed out after 600 s` (the run usually takes
  about five minutes; the probe's tests alone take two and a half). The whole suite is close to
  the gate's limit. During that run a `Microsoft/Windows/PowerShell/ModuleAnalysisCache` file
  appeared in the repository root: some PowerShell child ran with no `LOCALAPPDATA` and the
  repository as its working directory. Which spawn does that is not found yet (a first search
  for `LOCALAPPDATA` in `bin/` and `evals/` did not show it); the directory was removed.
- Untested in the probe (gentle-ai suggestions on T4ap): with an unknown session id `engramHook`
  accepts any `engram-claude-*-tools-loaded` file in the sandbox's temp directory (the arm still
  fails then, on `engramSession`), and `engramServer`'s second log location,
  `engram-serve.err.log` in the temp directory, is never written by the fake agent.
- `reapHolder` (`evals/isolation-probe.test.mjs`) identifies the holder at teardown, not when its
  pid file appears; the `since` filter bounds the risk to a process started during that test
  (gentle-ai suggestion on T4kt).
- `js-harness codex-review` records nothing when Codex does not show every changed line, and
  Codex did not get through a range of about 1,000 lines in four runs. Splitting by commit
  worked; the command could take `--head <rev>` so a split needs no worktree.
- The unsafe tree kill T4k removes is still on `main` (`bin/check.mjs`, `evals/runner.mjs`) and
  on `feat/stack-v4` until this branch merges; how to deliver it sooner is Sebastián's call.

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
Slice 1 (T1–T2) is merged (PR jsaristi/js-harness#20, `5ab2ae6`). T3 is complete on
`feat/evals` (slice 2 so far: `05692b0..d0bc904`, every commit reviewed by gentle-ai and Codex).
Since then, all on `feat/evals` and not pushed: T4a (done: the isolation probe passes with the
real binary, see Progress, 2026-10-02), T4ar, T4as, T4k, T4kr, T4kt, T4s, T4sr, T4srr and T4ap.
The stack work is done on `feat/stack-v4` (`odd/tasks/stack-v4.md`, not pushed).
**Do not commit on `main` or `feat/stack-v4` from this machine until T4k is there**: their
pre-commit gate still kills by parent pid (see Progress, 2026-10-02) and can close unrelated
programs. That is also why one line owed to `odd/tasks/stack-v4.md` is not written yet: the 11
`~/.claude/commands/gentle-sdd-*.md` files were moved to
`~/.js-harness/backups/stack-v4-20261001/home/` with the other v3 leftovers. How T4k reaches
`main` (a small hotfix PR, or with this branch's PR) is Sebastián's call.
Before T4, two of Sebastián's decisions were taken:
1. His `claude setup-token`: **done 2026-10-02**. It is in the user environment variable
   `JS_HARNESS_EVAL_OAUTH_TOKEN` (checked without reading it: 108 characters, the `sk-ant-oat`
   prefix, no whitespace), never in chat or a file in the repo; the suite entry maps it to
   `CLAUDE_CODE_OAUTH_TOKEN` inside each trial's env only, because a global
   `CLAUDE_CODE_OAUTH_TOKEN` would also log his daily sessions in with a token that has no
   claude.ai connectors (there is none: checked). A process started before the variable was
   stored does not have it: the suite must run from a shell that does, or with the variable
   passed for that one command.
2. The permission mode both arms pass (`permissionMode` has no default): **`bypassPermissions`**
   (Sebastián, 2026-10-02: "as I have it"). It is what his real settings use and the mode the
   isolation probe ran under; `acceptEdits` would leave a headless agent unable to run the tests.
T4 ran on 2026-10-02 and kept no task (see Progress): all five candidates score 0.98–1.00 with
the minimal config at `medium`. T5 has nothing to run over until T4h finds headroom. The
direction is Sebastián's (asked 2026-10-02): harder candidates of another kind, a look at what
the current config costs on the same five tasks first, or another definition of what separates
the configs (which "Ask me before" reserves for him). `node evals/suite.mjs --summary --name
headroom` prints the table again.
Reviewed boundary: gentle-ai `e54ff9f` (`09d7a90`, T4kg, 62 lines, is under budget and pending
in the slice); Codex `09d7a90`.

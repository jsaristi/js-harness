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
state.

## TDD
Mode: strict (source: user global config). Runner: `node --test`.

## Delivery
Forecast: ~900–1,300 authored lines (runner and report with tests ~500, task fixtures and hidden
graders ~400–700, docs), above the ~400 slice budget. Strategy: `ask-on-risk`; chain strategy
`stacked-to-main`, reusing Sebastián's choice for the earlier features: each slice its own PR
against `main`, merged in order. Slices: 1 = T1–T2, 2 = T3–T4, 3 = T5–T6.

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
- [ ] T2 Configs: minimal and current as runner inputs, with the current config's isolation
  proven (engram, projects, gentle-ai state untouched) (route: delegated writer after one
  mapping of where each of those writes lands)
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
  stem ambiguous are now rejected. `7760d58` assessed medium, `under_budget`: it is reviewed with
  T2's commits, the boundary stays `99272c5`.

## Follow-ups
- Signal forwarding (kill the tree, then re-raise SIGINT/SIGTERM on POSIX) is untested, and the
  re-raise ends the process before `runTrial`'s `finally`, so an interrupted trial leaks its
  workspace (gentle-ai suggestion, left as is).
- `killSurvivors` now lives twice (`bin/check.mjs` and `evals/runner.mjs`); export it from one
  place when either changes.

## T1 decisions (carried into T2–T6)
- Agent config: `{ name, command, args, env, versionArgs? }`; `args` and `env` may be functions
  of `{ effort, task }`, so `--effort` lives in the argv. `env` merges over `process.env`, `null`
  removes a variable, and `NODE_TEST_CONTEXT` is always dropped (a nested `node --test` grader
  otherwise prints no TAP). The version probe runs once per distinct command, only if a trial runs.
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
T2: the minimal and current configs, starting with one mapping of where the current config
writes (engram, `~/.claude/projects`, gentle-ai state). Review base for the next slice review:
`99272c5` (it covers `7760d58` too).

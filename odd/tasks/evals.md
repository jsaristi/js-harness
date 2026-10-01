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
- [ ] T2a Sandbox env and the two configs: a per-trial home in the runner (`config.prepare`),
  the allowlisted env that points every writer at it, `minimal` and `current` as runner inputs,
  proven against the fake agent (route: delegated writer, strict TDD; trigger: runner, configs
  and their tests are 4 non-trivial files)
- [ ] T2b Current home seeding: the per-trial home built from the real config (copy list,
  patched `.claude.json`, rewritten plugin paths, gentle-ai `state.json`) and the workspace's
  project layer (`git init`, `js-harness init`), proven against a fake real-home fixture whose
  hash tree stays unchanged (route: delegated writer, strict TDD)
- [ ] T2c Isolation proven on the real binary: one run of `claude` under the sandbox against a
  loopback fake Messages API (zero spend), then a nonce scan and a before/after hash of the real
  trees (route: delegated writer for the probe, inline run; needs Sebastián's go-ahead, see Ask
  me before)
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
- 2026-09-30: T2 mapping done (read-only explorer; no real `claude` run). Result in "T2 map and
  decisions" below. T2 became T2a–T2c.

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
- Unverified until T2c runs the real binary: that Claude's own home resolution honours
  `USERPROFILE`, that the `LOCALAPPDATA` override breaks no tool, what `plugins/marketplaces` does
  at startup, and whether `-p` writes `history.jsonl`.

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
T2a (the sandbox env and the two configs against the fake agent), then T2b (seeding the current
home), then T2c once Sebastián allows the real-binary probe. Before T4: his `claude setup-token`
and his choice of permission mode. Review base for the next slice review: `6755054` (every commit
up to it is reviewed; `44ede8f` is pending, under budget).

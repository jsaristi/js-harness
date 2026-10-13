# F6 Codex parity

Locator: `odd/tasks/codex-parity.md` · Engram mirror: `odd/codex-parity/tasks` · Branch: `feat/codex-parity`

## Goal
The five eval tasks of F5 run on the Codex CLI under the same sandbox discipline as on Claude
Code, and the differences between the two hosts (score, tokens, estimated list cost, wall time)
are measured and written in the roadmap.

## Why
Principle 5 of the roadmap: the harness is portable, one `AGENTS.md` for Claude Code and Codex.
F5 answered "does the stack help?" for Claude Code only: the minimal config matched the current
one on score at about half the cost. gentle-ai 4 gives Codex the full orchestrator (25,515
estimated tokens per turn, against 10,510 before), so the same question on Codex has no measured
answer, and F7's protocol needs both hosts measured the same way.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/codex-parity.md` exits 0
- `node --test "evals/**/*.test.mjs"` exits 0
- `node evals/report.mjs --require-complete --min-discriminating 3` exits 0, so F5's gate still
  holds with the Codex runs recorded
- `node evals/report.mjs --results-dir evals/results/codex` exits 0, so the Codex runs are
  read whole. The matrix is closed at 28 of its 30 trials by Sebastián's answer of 2026-10-12
  (Tasks, T7): `--require-complete` on it exits 1 for the two cells of 2 trials, as it should,
  and was this condition until that answer
- `docs/ROADMAP.md` records the F6 result (per task, at `medium`, the one effort the Codex
  matrix holds since the cut of 2026-10-05: both hosts' score, tokens, estimated list cost and
  wall time) and `node bin/js-harness.mjs progress` shows F6's two steps checked

## In scope / Out of scope
- In: `evals/` (runner, configs, home, suite, report, the isolation proof, fixtures, the Codex
  result summaries), `package.json` scripts, `docs/ROADMAP.md`, this document.
- Out: the five tasks and their graders (they are agent-agnostic and a change would break the
  comparison with F5); F5's recorded results; `bin/` (the published package does not run evals);
  changing the Codex stack to make a config win (the run measures what is installed); Antigravity.

## Constraints
- Spend is staged (Sebastián, 2026-10-03): 2 smoke trials (T3), then 15 trials (T6), then his
  go-ahead for the other 45 — because the runs use the flat-rate ChatGPT subscription, whose
  usage cap cannot be measured in advance, and the Codex review of every slice draws on the same
  cap. No other step calls a real model through Codex.
- The runs must not write into the real `~/.codex`, engram store or gentle-ai state — because
  they would pollute what his daily work reads. Proven by a captured run (T3) before T6, not
  assumed.
- The login is a copy of the real `auth.json` in a `CODEX_HOME` of the trial's own; its content
  is never logged or committed, and the real login is checked to still work after the smoke
  trials — because Codex refreshes that file in place, and a refresh inside a copy may leave the
  real one invalid (unverified; `learn.chatgpt.com/docs/auth/ci-cd-auth`).
- A run starts only while the login's access token has at least 12 hours left (Sebastián,
  2026-10-05, replacing the limit of 186 h on the file's date) — because the date measured the
  wrong thing: the real Codex used the login past 192 h and never rewrote it, and its token
  lasts ten days (Progress, 2026-10-05, slice C). Twelve hours is a chosen number: over three
  times the 220 minutes F5's 60 trials took, the room for what is not known, how long before the
  expiry Codex refreshes.
- Nothing of the stack is updated between T6's first trial and T7's last — because the suite
  refuses to resume a run on another Codex, gentle-ai or engram, and a matrix on two stacks
  would not be one measurement. Codex went from 0.159.1 to 0.160.0 and engram from 3.0.0 to
  3.1.0 on 2026-10-05, before any trial of the matrix.
- The isolation proof is a hash of the real trees before and after a real trial, not a fake API —
  because through a loopback custom provider Codex sent no tools and no base instructions
  (`docs/origin.md:58`), so a fake-API trial would not be the session that is measured.
- F5's results and its gate stay as they are: Codex results live in `evals/results/codex/` —
  because `checkRuns` refuses runs whose model or stack differ (`evals/report.mjs:220-246`).
- The Claude path keeps its behavior: its existing tests pass unchanged — because F5's recorded
  numbers must stay reproducible by the same code.
- Model `gpt-6.1-sol` at `medium`, three trials per cell, both configs: 30 trials, half the
  matrix of F5. Sebastián cut `high` on 2026-10-05, after the usage cap stopped T7 at its
  fourth trial ("Recortá la matriz: ... terminá solo los 12 trials de current en medium y dejá
  high afuera") — because the 42 trials then left needed four more cap windows by a rough estimate (about 23M
  input tokens against the 6M of this feature's that the first window held), with
  his own Codex capped while each was spent, and `medium` alone holds the comparison of the
  two configs, 15 trials against 15. What the cut gives up: Codex has no `high` cell beside
  Claude's, and whether the word `medium` reaches the model stays unshown, since only a `high`
  cell beside it would show it. `--require-complete` asks three trials of every cell that has
  any, so the report's gate holds on `medium` alone. Permissions are `--dangerously-bypass-approvals-and-sandbox`, the equivalent of the
  `bypassPermissions` the Claude arm ran under, inside the throwaway home and workspace.
- Codex reports tokens and no dollars, so a trial's cost is an estimate: its tokens at the
  published list price of the model, recorded with source and date and labelled estimated —
  because F5's cost is list cost too, which keeps one unit across hosts and the verdict rule
  unchanged.
- Zero dependencies — because every command in this repo runs with no install step.
- Never two gates at once, and no gate or test suite while trials run; a commit runs in the
  background, since its gate takes about ten minutes; after a failed gate `git config --local
  core.bare` is checked in the main checkout before anything else — because parallel spawns on
  this host fail with `0xC0000142` and push the suite past its 600 s cap
  (`odd/tasks/evals.md`, follow-ups), and a gate from a linked worktree turned the repository
  bare twice on 2026-10-04 (Progress). This feature lives in the linked worktree
  `D:\js-harness-worktrees\codex-parity`, which is safe to commit from only with the gate fix
  `a3a1eb1` in the branch.

## Effort
high

## Ask me before
Running past the 15-trial checkpoint; anything that would write into the real `~/.codex`,
engram or gentle-ai state; changing the verdict rule or the matrix; push, pull request, merge.

## TDD
Mode: strict (source: user global config). Runner: `node --test`. Exception: T3, T6 and T7 are
runs of the real CLI, checked by their recorded output.

## Delivery
Forecast: ~1,000–1,600 authored lines (parser and fake agent ~250, Codex home and arms ~450,
isolation proof ~250, suite ~250, report ~300, docs), above the ~400 slice budget. Strategy:
`ask-on-risk`; chain strategy `stacked-to-main`, reusing Sebastián's choice for the earlier
features (`odd/tasks/evals.md`, Delivery): each slice its own PR against `main`, merged in order.
Slices: A = T1–T3, B = T4–T5, C = T6–T8. Review boundary starts at the branch point: `535ef09`
when the branch was cut, `77acc71` since it was fast-forwarded to `main` on 2026-10-04 with
nothing committed.

Slice A is pull request #33 against `main`, opened on 2026-10-05 at Sebastián's request:
`ea0a860`, `1f63fd0`, `57d8aec`, `4b2fa50`, `22dd665`, `fcf15ef`, `a4a72ee`, `9c5ef12`, `41509d3`,
`40fa138` and the commit that records this. It is 5,222 changed lines against the forecast of
about 950 for the slice (2,378 tests, 555 documents, 2,289 code, of which 1,019 are the probe):
the probe needed its own arm driver and report, and three review rounds added their corrections
here. Sebastián accepted the `size:exception` and had #33 merged on 2026-10-05 (`b12d3cd`). The
branch was then restarted from `main` at that merge, keeping its name, so slice B's commits
start there and its review boundary is `b12d3cd`. The remote `feat/codex-parity` still points
at the merged history until slice B is pushed, which needs `--force-with-lease`.

Slice B is `e880546` (T4), `4376908` (T4r), `2ac64bb` (T5), `159810c` and the commit that
records this. With `159810c` it is 1,740 changed lines against a forecast of about 550 for the
slice (897 in tests, 657 in code, 186 in documents): the suite and the report are each run end
to end for both agents, and the review of T4 added its correction here. That is above the
budget of about 400 lines, and a split into two (the suite: T4 and T4r; the report: T5) was
possible with the commits as they are. Sebastián chose one pull request with the
`size:exception` on 2026-10-05: slice B is #34 against `main`, pushed with
`--force-with-lease` (in fact a fast-forward, since the remote branch held only merged
history). The commit that records this is pushed to the same pull request.

Sebastián had #34 merged on 2026-10-05 (`9c9ed8e`, 1,743 changed lines with `48406cf`). The
branch was then restarted from `main` at that merge, keeping its name, so slice C's commits
start there and its review boundary is `9c9ed8e`. The remote `feat/codex-parity` points at the
merged history until slice C is pushed.

## Tasks
### Slice A — the agent seam
- [x] T1 The runner reads an agent's output through a parser the config carries: Claude's is
  today's behavior; Codex's reads `codex exec --json` JSONL (final message, usage summed over
  `turn.completed`, cached input counted once, `turn.failed` and `error` classified as cap, auth
  or failure); the fake agent gains a Codex mode (route: delegated writer, strict TDD — trigger:
  2+ non-trivial files) — `1f63fd0`, reviewed (Progress, 2026-10-04)
- [x] T2 A Codex sandbox home and its two arms: `CODEX_HOME` inside the trial's home with a copy
  of `auth.json`; `minimal` is an empty home with user config ignored; `current` is a frozen
  copy of the real `~/.codex` with its paths rewritten, plus `js-harness init`; the real binary
  is resolved, never a `.cmd` shim (route: delegated writer, strict TDD) — `4b2fa50`, reviewed
  (Progress, 2026-10-04)
- [x] T2r T2's review findings, one correction: the config scan fails closed (a multi-line array
  inside a table, an escape in a quoted key and a multi-line env value are refused at build
  instead of read wrong); profile layers are not copied; the shim, cleanup and login-path tests
  hold on any host and prove what they claim (route: the T2 writer, resumed) — `22dd665`
- [x] T3 Isolation proof for Codex: the real `~/.codex`, engram and gentle-ai trees hashed before
  and after one real trial per arm, the report committed, and the real login verified afterwards
  (route: delegated writer for the probe, the two real trials run by the parent) — `a4a72ee`,
  both arms PASS on 2026-10-05, report in `evals/proofs/codex-isolation.md`, reviewed (Progress)
- [x] T3r T3's review findings, one correction: the environment control resolves a path before
  it calls it inside the sandbox; a surviving engram process is the trial's only by its port or
  its path; thread ids are scrubbed from the report; the report path is checked before any paid
  session and a failure after one is not a usage error; the untested fail-the-arm branches get
  tests; no login copy survives a failed prepare; a future-dated login is refused (route: the T3
  writer, resumed) — `9c5ef12`, reviewed (Progress, 2026-10-05)
- [x] T1r Reader hardening from T1's review, after T3 because its first part needs what a real
  failed Codex run prints: which messages decide a stop when a recovered notice and an unrelated
  `turn.failed` are in the same run, pinned by a test of that mixed case; and the runner refuses
  a reading of the wrong shape and lets no key of `usage` replace a graded field (route: the T3
  writer, same delegation, disjoint files) — `41509d3`, reviewed (Progress, 2026-10-05)

### Slice B — suite and report
- [x] T4 `evals/suite.mjs --agent codex`: model, efforts, stack fields (Codex version, gentle-ai,
  engram), results under `evals/results/codex/`, resume (route: delegated writer, strict TDD —
  trigger: 2+ non-trivial files) — `e880546`, reviewed (Progress, 2026-10-05)
- [x] T4r T4's review findings, one correction: a Codex run whose Codex version cannot be read is
  refused before anything is built or paid; a work root the version probe created is removed
  when the run does not go on; the test that compared two constants is removed (route: the T5
  writer, same delegation, disjoint files) — `4376908`, reviewed (Progress, 2026-10-05)
- [x] T5 Report: an agent dimension, the estimated list cost of a Codex trial, and a Claude
  against Codex table (route: delegated writer, strict TDD — trigger: 2+ non-trivial files) —
  `2ac64bb`, reviewed (Progress, 2026-10-05)

### Slice C — runs and result
- [x] T6p The login check reads the access token's expiry instead of the file's date: the suite
  and the probe refuse a login with under 12 hours left, or one whose expiry cannot be read, and
  say nothing of the token but its dates (route: delegated writer, strict TDD — trigger: 2+
  non-trivial files) — `ef0e71f`, reviewed (Progress, 2026-10-05)
- [x] T3b The isolation probe again, on codex-cli 0.160.0, with the probe as it is: two smoke
  trials, Sebastián's go-ahead of 2026-10-05; the result added to
  `evals/proofs/codex-isolation.md` (route: run by the parent) — both arms PASS on 2026-10-05
- [x] T6 Headroom run: 15 trials (`minimal`, `medium`), then the checkpoint with Sebastián —
  15 of 15 at score 1.00, `evals/results/codex/headroom.json`; the checkpoint was put to him on
  2026-10-05 and T7 waits on his answer
- [x] T7 The other trials, after his go-ahead: 45 as planned, cut to the 15 of `current` at
  `medium` on 2026-10-05 (Constraints). 13 are recorded; Sebastián paused the last
  two on 2026-10-06 (Progress) and closed the task on those 13 on 2026-10-12: asked whether
  to close with 13, run 15 new ones, or go back and run the two, he tapped "Cerrar con 13
  (Recomendada)" (the lead's transcript `65318fd5-80e7-4bb8-92b5-06737140185b`, line 9794).
  Resolver #3 and spec-drift #3 were never run
- [x] T8 The F6 result in `docs/ROADMAP.md`, F6's steps checked — "F6 result" there, written
  on 15 trials of `minimal` and 13 of `current`, saying so (2026-10-13)

## Evidence from the exploration (2026-10-03, `main` at `535ef09`, codex-cli 0.159.1)
- Agent-agnostic already: the tasks and graders (no `CLAUDE.md`, `AGENTS.md`, `.claude` or
  `.codex` in `evals/tasks` or `evals/fixtures`), `task-proof.mjs`, `ports.mjs`, `runTrial` and
  `runSuite`. The only neutral seam is the config object `{name, command, args, env, prepare,
  cleanup, versionArgs}` (`evals/runner.mjs:450-458`).
- Claude-bound: output parsing and failure classification (`evals/runner.mjs:38-106`, `:500-505`),
  the argv and the minimal arm's flags (`evals/configs.mjs:213`, `:247`), the env allowlist with
  one credential (`evals/configs.mjs:65-70`), the home template copied from `~/.claude`
  (`evals/home.mjs:36`, `:205-226`), the suite's flags, model and stack fields
  (`evals/suite.mjs:24-34`, `:143-186`), the report's cost rule (`evals/report.mjs:110-111`) and
  token sum (`:44-58`), and the isolation probe's fake Anthropic API
  (`evals/isolation-probe.mjs:195`, `:722-739`, which does not scan `~/.codex`).
- Codex: `codex exec --json` prints JSONL whose `turn.completed` carries `usage` with
  `input_tokens`, `cached_input_tokens` (a part of the input), `output_tokens` and
  `reasoning_output_tokens`, and no cost (`learn.chatgpt.com/docs/non-interactive-mode`). The
  flags `--ephemeral`, `--ignore-user-config`, `--skip-git-repo-check`, `-C`, `-m` and `-c` exist
  in 0.159.1 (`codex exec --help`). The login is `auth_mode: chatgpt`.
- To mine, not to build on: `D:\harness-lab\adapters\gentle-codex.mjs:35-39` (an argv) and
  `adapters\codex-events.mjs:26-37`, `:108-130` (a usage sum). `bin/codex-review.mjs:56-79`,
  `:218` already spawns Codex here, through the `.cmd` shim and with `WindowsApps` off the PATH.
- F5 for scale: 60 trials, about 220 minutes, $69.78 of list cost, about 66M input tokens.

## Progress
- 2026-10-03: plan and staged spend approved by Sebastián; this document created. Nothing built.
- 2026-10-04: incident, before any code. The main checkout held another session's uncommitted
  work (`feat/remote-control`), so this feature started in a linked worktree. Two `git commit`
  attempts from it failed in the pre-commit gate and wrote into the real repository: in a linked
  worktree git gives the hook `GIT_DIR=<main>/.git/worktrees/<name>` and an absolute
  `GIT_INDEX_FILE`, where the main checkout gets a relative `GIT_INDEX_FILE` and no `GIT_DIR`
  (shown in a scratch repository), and the gate's tests run `git init`, `git add` and
  `js-harness init` in temp directories without removing them. Seen: the worktree's index
  replaced by a fixture's three entries, a fixture's `js-harness/manifest.json` inside the
  worktree's git directory, and, at the minute of the first attempt, `core.bare=true` in the
  shared `.git/config`, which the other session found and restored (`git init` with that
  `GIT_DIR` reproduces it in the scratch repository). Repaired here with `git read-tree HEAD` and
  by deleting the manifest; refs, objects and the main checkout's index were untouched.
  `npm run check` run directly in the worktree passes (8m23s): without the hook there is no
  `GIT_DIR`. No commit is made from a linked worktree until the gate removes `GIT_*` from its
  sensors' environment.
- 2026-10-04: Sebastián's decision: nothing is committed from this worktree until the gate fix
  (branch `fix/gate-git-env`, planned in `odd/tasks/remote-control.md` on `feat/remote-control`;
  not created yet when this was written) is merged to `main`; then `main` is merged into
  `feat/codex-parity` and the pending work is committed. Until then, exploring and writing go on
  uncommitted. Remote sessions come before F6 in the roadmap (his order of 2026-10-03, recorded
  on `feat/remote-control`), so there is no hurry, and this feature's note in `docs/ROADMAP.md`
  is written after that merge: writing it now would conflict with that branch's `Next` list.

- 2026-10-04: T1 written and verified, not committed and not reviewed (route: delegated writer,
  strict TDD; trigger: 2+ non-trivial files). Left unchecked until its commit and its reviews.
  - The seam: a config may carry `reader`, a function of the finished run
    `({ stdout, stderr, exitCode, timedOut }) -> { stop, parsed, failed, usage }`; the runner
    defaults to `readClaudeOutput` (`evals/runner.mjs`, `readerOf`). Both readers live in the new
    `evals/agent-output.mjs`; Claude's three functions moved there unchanged and `runner.mjs`
    re-exports them, so no existing assertion changed (`runner.test.mjs`: 132 added, 0 removed).
  - A Codex record: `inputTokens` is the sum of `input_tokens` (cached counted once),
    `cachedInputTokens` and `reasoningOutputTokens` are kept apart, `usage` is the array of raw
    per-turn objects, and `costUsd`, `modelUsage`, `subagents` and `turns` are `null`.
  - The fake agent gained `codex-solve`, `codex-noop`, `codex-cap`, `codex-auth`, `codex-failed`
    and `codex-incomplete`.
  - Observed, one file at a time, never the full gate: `node --test evals/agent-output.test.mjs`
    19/19 (rerun by the parent); `evals/runner.test.mjs` 145 pass, 1 skipped, 0 fail (135 and 1
    before); `evals/configs.test.mjs` 65/65; `evals/home.test.mjs` 37 pass, 1 skipped;
    `evals/suite.test.mjs` 43/43.
  - Unverified, for T3's real trials to settle: the wording of Codex's usage-cap and
    not-logged-in messages (both patterns are marked as assumptions in `agent-output.mjs` and
    lean toward stopping); that an `error` event alone is not fatal; that `turn.failed` carries
    `error.message`; whether `reasoning_output_tokens` is inside `output_tokens`.
  - For T5: `evals/report.mjs` takes tokens from `modelUsage`, which is `null` for Codex, so it
    must read `inputTokens`, `cachedInputTokens` and `outputTokens`; `usage` is an array for
    Codex and an object for Claude.
  - Size: about 670 authored lines against a ~250 forecast (351 are tests; 72 are the move out of
    `runner.mjs`, counted on both sides).
- 2026-10-04, later: resumed in a new session (a `remote stop` of the remote-control feature had
  ended the one that wrote T1, `odd/tasks/remote-control.md`). Remote sessions closed that day
  and the gate fix reached `main` as `a3a1eb1`; `main` was at `77acc71`. The branch had no commit,
  so it was fast-forwarded to `main` with the pending files in place (`main` had touched none of
  them), and `bin/check.mjs` in this tree now removes git's hook variables from its sensors.
  Sebastián's rules for this worktree are in Constraints.
- 2026-10-04, T1 closed. Commits: `ea0a860` (this document and the roadmap note; gate green,
  assessed `passive`, no review due, so the reviewed boundary moved to it) and `1f63fd0` (T1;
  gate green in about ten minutes, `core.bare` still `false` in the main checkout after both).
  - gentle-ai: `1f63fd0` assessed `medium`, review due (`slice_budget_reached`, 751 lines);
    consent granted under the standing pre-grant; one lens, `review-reliability`; approved and
    acknowledged (`review-ecdddec225d6c967`, authority burned). Two advisory findings, neither
    blocking, both taken as T1r: a WARNING, once a `turn.failed` is present the classifier reads
    every collected message, earlier recoverable `error` notices included, so a recovered
    rate-limit notice followed by an unrelated failure would stop the run as a cap and every
    resume would stop at the same trial (`evals/agent-output.mjs:212-213`, no test of that mixed
    case); and a SUGGESTION, the runner checks that `reader` is a function but not what it
    returns, and spreads `usage` after the graded fields (`evals/runner.mjs:582-597`).
  - Codex: `js-harness codex-review --base ea0a860`, recorded as `reviewed`
    (`ea0a860..1f63fd0`); `check --push` reports the one code commit covered. Its text: "No
    actionable defects were identified in the inspected changes. Confidence is limited: diff
    output was truncated, tests were not run, and subagent tooling required for deeper review
    was unavailable." So it is a weak review of a 751-line commit, the limit
    `odd/tasks/evals.md` already records for ranges of this size.
  - The real `~/.codex/auth.json` still carries its 2026-09-27 date after that Codex run. Codex
    treats a login as stale after about eight days, so T3 checks the date again before it copies
    the file: a refresh that happens inside a copy is the risk Constraints names.
- 2026-10-04, T2 written and verified, not committed: it waits on one decision of Sebastián's.
  - Modules: `evals/codex-home.mjs` (the frozen template of the real `~/.codex`, the per-trial
    seed, the login copy) and `evals/codex-configs.mjs` (`codexMinimalConfig`,
    `codexCurrentConfig`, the env); `evals/configs.mjs` and `evals/home.mjs` only export or
    generalize what both hosts share. Observed, one file at a time: `codex-configs.test.mjs`
    17/17 and `codex-home.test.mjs` 21/21 (both rerun by the parent), `configs.test.mjs` 65/65,
    `home.test.mjs` 37 pass and 1 skipped, `runner.test.mjs` 145 pass and 1 skipped,
    `suite.test.mjs` 43/43; the real `auth.json` keeps its date and `core.bare` is `false`.
  - The real binary behind the pnpm shim is `codex.exe` under
    `@openai+codex@0.159.1-win32-x64\...\vendor\x86_64-pc-windows-msvc\bin`; T4's flag takes it.
  - `plugins/` is 505 MB, of which 425 MB is the desktop app's `.plugin-appserver`, not copied;
    `plugins/cache` (94.7 MB) is copied per trial in about 3.4 s.
  - Open decision: only paths inside `.codex` are rewritten, so the copied `config.toml` still
    names programs of the live desktop app: `notify = [codex-computer-use.exe, "turn-ended"]`
    (line 2), `[mcp_servers.node_repl]` with the app's `node_repl.exe` (line 66), and the enabled
    plugins `unified-computer-use`, `computer-use`, `browser`, `chrome` and `codex-app-tools`.
    A trial of the current arm, which runs with approvals bypassed, could reach the live app
    through a named pipe, and a hash of the real trees cannot see that. Precedent: Claude's
    current arm ran without the claude.ai connector (`odd/tasks/evals.md:1181-1185`).
  - Decided (Sebastián, 2026-10-04): the current arm leaves the desktop app's pieces out — the
    `notify` program, the `node_repl` MCP server, and the plugins `unified-computer-use`,
    `computer-use`, `browser`, `chrome` and `codex-app-tools` — and keeps the rest: the gentle-ai
    block, hooks, skills, engram, codegraph, context7 and the other plugins. So the arm carries
    fewer tools than his daily Codex, which the F6 result must say.
- 2026-10-04, T2 committed as `4b2fa50` with that decision applied (gate green in about eleven
  and a half minutes, `core.bare` still `false`). The template went from 94.7 MB and 1,795 files
  to 49.7 MB and 634; a trial home seeds in about 1.25 s. On a scratch home with no login,
  `codex mcp list` shows `code-review`, `codegraph`, `engram` and `context7`, and no `node_repl`,
  `cua_repl` or `codex_app`.
  - gentle-ai: assessed `medium`, review due (`slice_budget_reached`, 1,546 lines); consent
    granted under the pre-grant; one lens, `review-reliability`; approved and acknowledged
    (`review-3e695b5519f558ef`). Five advisory findings: a WARNING, the shim-refusal tests use
    drive-letter paths and fail on a POSIX host (`evals/codex-configs.test.mjs:134`, `:147-149`);
    and four SUGGESTIONs — a continuation line of a multi-line array is read as a table header,
    so the rest of a removed table can be written back (`evals/codex-home.mjs:165-172`); the
    cleanup test passes whether or not the error propagates, and no test makes the login's
    removal fail (`evals/codex-configs.test.mjs:203-207`); an assertion on the substring `auth`
    depends on the temp path (`:122`); profile layers are copied without the two passes
    (`evals/codex-home.mjs:74`).
  - Codex: `js-harness codex-review --base 57d8aec` first refused to run with this document
    modified, so the document was stashed for the run and restored. It then gave three P2
    findings and recorded nothing: "its successful commands showed 17 of 1249 changed lines"
    (its `git diff` command exited 1 and it read the files another way). The findings: an escape
    in a quoted key, `[mcp_servers."engram"]`, slips past both rewrites
    (`evals/codex-home.mjs:144-146`); a multi-line engram env value is cut at its first line and
    leaves invalid TOML (`:207-209`); and the same POSIX finding as gentle-ai's.
  - All seven are T2r. The Codex review is rerun over `57d8aec..HEAD` once T2r is committed, so
    one record covers both commits; if it again fails to show the diff, the skip is recorded
    with `--unavailable` and its reason.
  - Unverified until T3, beyond what T1 left: whether `--dangerously-bypass-hook-trust` runs the
    hooks as they run for him; whether hooks and MCP servers inherit the trial's `ENGRAM_PORT`
    and `CODEX_HOME`; what Codex writes outside `CODEX_HOME`; whether the two marketplace
    sources (one dangling, one under the real `~/.cache`) trigger a re-sync; what the kept
    `code-review` plugin's MCP server reaches; that `-c model_reasoning_effort="..."` arrives
    intact at `codex.exe`.
- 2026-10-04, T2r closed as `22dd665` (gate green in about eleven minutes, `core.bare` `false`).
  All seven findings fixed; the scan now refuses every value that does not end on its line and
  decodes quoted keys, since the real config holds one with an escape
  (`[projects."D:\\js-harness"]`) that a blanket refusal would have tripped. The real
  `config.toml` builds with no refusal and `codex mcp list` still shows the four servers.
  - gentle-ai: assessed `medium`, review not due (`under_budget`, 268 lines), so it stays
    pending in the slice until a later commit reaches the budget.
  - Codex over `57d8aec..22dd665`: blocked, nothing recorded. Its text: "Review is blocked, not
    evidence that the patch contains a defect. The diff exceeds the repository's mandatory
    delegation budget, sub-agent tools are unavailable, and the separate read-only reviewer
    failed with 'Access denied (os error 5)'". The explicit skip is recorded for that range with
    this reason (`--unavailable`). This is a finding for F6 itself: the delegation rules of the
    gentle-ai block in Codex's global `AGENTS.md` make `codex exec review` refuse a diff of this
    size when it has no sub-agent tools.
  - Codex over the correction alone, `4b2fa50..22dd665`: recorded as `reviewed`, one P2 — the
    check for a value that ends on its line treats a triple quote anywhere in the value as a
    multi-line delimiter, so valid single-line settings such as `model = "m" # """` are refused
    (`evals/codex-home.mjs:218`). It refuses too much, never too little, and the real config
    passes; taken as a follow-up, not a second correction.
  - `check --push`: 3 code commits, all covered by a Codex review record.
- 2026-10-05, T3 closed: the probe is `a4a72ee` (gate green in about eleven minutes, `core.bare`
  `false`) and the two smoke trials of the staged spend are spent. Route: delegated writer for
  `evals/codex-isolation-probe.mjs` (strict TDD against the fake agent, 15 tests, plus a mutation
  check of 11 behaviours because most tests had no RED of their own); the parent ran the real
  trials. The full record of the run is `evals/proofs/codex-isolation.md`; the probe's JSON report
  and each arm's raw output stay outside the repository, in
  `D:\js-harness-worktrees\codex-parity-t3-raw`. The report is Markdown because the push check
  counts any other file as code, and a 1,705-line JSON file is not something Codex can review.
  - Result: PASS, both arms, in 5m43s. No nonce, sandbox name or thread id in any real tree; the
    only real-tree change not seen in the 60 s control window was Claude Code rotating the
    backups of its own account file. The login was 177.4 h old; the trial's copy stayed
    byte-identical and the real file kept its date, so nothing refreshed it.
  - Tokens: minimal 47,442 input (43,520 cached) and 402 output in 46.2 s; current 142,308 input
    (113,024 cached) and 593 output in 63.1 s, on a task of four literal steps. The current arm
    made three engram calls nobody asked two of (`mem_current_project`, `mem_session_summary`).
  - Settled, of what T1 and T2 left unverified: the shell, the hooks and the MCP servers of a
    trial all see its environment (22 of 22 variables identical to what the sandbox set, the
    engram hook's marker and store inside the trial's home, `mem_save` in the trial's store);
    `--dangerously-bypass-hook-trust` runs the hooks and prints its notice as an ITEM of type
    `error`, twice, which the reader ignores; a completed session exits 0; `usage` has a fifth
    field, `cache_write_input_tokens`, for T5's price; the marketplace is synced again, into the
    trial's home (592 files, 59 MB of `.tmp/marketplaces/engram` per current trial); nothing was
    written outside the trial's home.
  - Found: `codex --version` itself writes into its `CODEX_HOME` (a `tmp/arg0` directory), so the
    probe reads the version under the trial's environment. The writer found it by running the
    real binary twice under the real environment, which replaced the real `~/.codex/tmp/arg0`
    directory twice; nothing else changed there.
  - Found: the minimal arm is not an empty Codex. Starting from a home with the login alone,
    Codex wrote 374 files, 61 MB: its curated plugins (312 files), its bundled skills (49), a
    `config.toml` of 127 bytes, caches and five sqlite stores. The session used no tool but the
    shell; whether those plugins and skills reach the prompt is not known (the home is removed).
    So `minimal` means Codex as it comes, which the F6 result must say.
  - Not settled: `reasoning_output_tokens` was 0 in both sessions, so this run does not show that
    `-c model_reasoning_effort="medium"` reached the model (T6's first trials will, on real
    tasks); no session failed, so the wording of a cap or a login failure is still unseen.
  - gentle-ai over `4b2fa50..a4a72ee` (T2r, pending since it was under budget, and T3): `medium`,
    review due (`slice_budget_reached`, 1,888 lines); consent granted under the pre-grant; one
    lens, `review-reliability`; approved and acknowledged (`review-b3f3d89087f45fc6`). Five
    advisory findings: two WARNINGs — the report is written only after every paid session,
    unguarded, and a failure after a session exits 2 like a usage error
    (`evals/codex-isolation-probe.mjs:835-845`); four fail-the-arm branches of the environment
    control have no test (`:197-206`) — and three SUGGESTIONs: thread ids are not scrubbed
    (`:428`), a failed prepare skips the cleanup that deletes the login copy (`:384`), a
    future-dated login passes the age check (`evals/codex-home.mjs:55-56`).
  - Codex over `fcf15ef..a4a72ee`: it ran on the real login, which therefore still works after
    the trials, and gave three P2 findings, but recorded nothing ("its successful commands showed
    830 of 1250 changed lines": it never read the test file), so the skip is recorded with that
    reason. The findings: the environment control accepts a path that holds the sandbox's name
    and leaves it through `..` (`evals/codex-isolation-probe.mjs:186`); a new engram process is
    taken for the trial's by PID alone, so another session's engram fails the arm and skips the
    next paid one (`:395`); thread ids survive in the report's free text (`:671`).
  - None of the eight changes the run's verdict: every one of the 22 variables was identical to
    the value the sandbox set, which is stronger than containment, and no engram process
    survived. All eight are T3r.
  - `check --push`: 4 code commits, all covered by a Codex review record (two of them skips).
- 2026-10-05, T3r and T1r closed, which completes slice A. One delegation to the T3 writer, two
  commits on disjoint files, each with a green gate of about eleven minutes and `core.bare`
  `false` afterwards.
  - T3r, `9c5ef12` (593 added, 100 removed; the probe's tests went from 15 to 37): the eight
    findings as listed in the task. Beyond them: the environment control is now "inside the
    trial's home", so a required variable that points at the workspace fails the arm; exit code 3
    means a session ran and something broke afterwards (its summary is printed first), and exit 2
    means no session was started; a login dated up to two seconds ahead counts as age 0, because
    a file written in the same millisecond can read slightly ahead of the clock.
  - T1r, `41509d3` (243 added, 22 removed): the messages that decide a stop are the
    `turn.failed` message and the last `error` event before it, a rule chosen without a real
    failed sample and marked so; a `turn.failed` with no `error` event of its own is still read
    with the notice before it, which a test pins; the hook-trust notice, an item of type `error`,
    is pinned from the real line; `cacheWriteInputTokens` is summed apart from the input total;
    `assertReading` refuses a reading of the wrong shape, and a key of `usage` that collides with
    a graded field is an error (chosen over "graded fields win" because it keeps the record's key
    order and every recorded F5 field). Not checked: what `runSuite` does with a trial that
    `assertReading` rejects, which T4 must decide.
  - Codex: `a4a72ee..9c5ef12` recorded as `reviewed`, "no substantiated, actionable regressions";
    `9c5ef12..41509d3` recorded as `reviewed`, "no actionable defects". Both ranges are under 700
    lines, the size at which its reviews have been recorded here; for each the other pending
    files were stashed and restored.
  - gentle-ai over `a4a72ee..41509d3`: `medium`, review due (`slice_budget_reached`, 958 lines);
    its first assessment came back unassessable because of the untracked report under
    `evals/proofs/`, which was moved aside for the review; consent granted under the pre-grant;
    one lens, `review-reliability`; approved and acknowledged. Four advisory findings, all
    follow-ups below: two WARNINGs (an engram process the trial starts with no evidence in its
    command line and no listening port is now only a warning; a test compares a file date to the
    millisecond) and two SUGGESTIONs (no test reads a Claude result with subagents and model
    usage through `assertReading`; an infinite count is reported as `null`).
  - `check --push`: 6 code commits, all covered by a Codex review record (two of them skips).
- 2026-10-05, slice B opened in a new session; T4 written and verified (route: delegated writer,
  strict TDD; trigger: 2+ non-trivial files). No real `codex` or `claude` binary was run and no
  real login was read: every test uses the fake agent.
  - The command line: `node evals/suite.mjs --agent codex --codex <real binary> --configs
    <minimal,current> --efforts <medium,high> --repeats <n> --tasks <ids|all> --name <run>
    [--work-root <dir>]`, and `[--agent codex] --summary --name <run>`.
  - Decided here, the two questions the last Next step left to T4. A reading `assertReading`
    refuses is a defect of the reader and not a measurement: `runSuite` records no trial for it
    and stops with `reason: 'reader'` (exit 1), the raw output stays where the runner keeps it,
    and the same command repeats exactly that trial; the rule holds for both agents
    (`ReadingError`, `evals/runner.mjs`). And a trial's setup download is not measured apart: it
    happens inside the agent process, nothing in a record separates it from `wallMs`, so T5's
    wall-time comparison says so.
  - Decided here, the rest. `--agent` is optional and absent means `claude`, the parser's one
    default, so F5's recorded command lines and every existing assertion keep their meaning; for
    the same reason a Claude document carries no `agent` key and a Codex one carries
    `agent: 'codex'`. With `--agent codex`, `--claude` and `--permission-mode` are refused (the
    arms are fixed to `--dangerously-bypass-approvals-and-sandbox`, which is what the document
    records as `permissionMode`), and `--codex` without it is refused. Efforts are exactly
    `medium` and `high`: the repository holds no evidence of Codex's full list and the real
    binary may not be run to ask. The login is checked for existence and age before the template
    is built and before any trial; a refusal exits 2 with what to do. The Codex version is read
    before the run in a throwaway home under the work root, under the sandbox's environment, so
    a resume against a run whose agent, model or stack differ is refused before anything is
    built. The stack is `{ codex, gentleAi, engram }`.
  - Observed, one file at a time: `node --test evals/suite.test.mjs` 68/68 (43 before; rerun by
    the parent, 60.6 s); `evals/runner.test.mjs` 153 pass, 1 skipped (149 and 1 before);
    `evals/codex-configs.test.mjs` 19/19; `evals/report.test.mjs` 40/40; `contract check` on this
    document exits 0. RED first: 21 of 68 suite tests failed on `unknown argument --agent`, and a
    refused reading rejected the whole suite before the fix. Assertion lines went from 182 to 313
    in `suite.test.mjs` and from 515 to 528 in `runner.test.mjs`, none changed or removed. The
    follow-up test of a Claude result with subagents and per-model usage through `assertReading`
    is in.
  - Size: 770 added, 57 removed (516 of the added lines are tests), against a forecast of about
    250 for the suite: the six Codex modes and the reader stop are run through `suiteMain` for
    both agents. The two test files add about 85 s to the gate.
  - For T5: `evals/report.mjs` does not recurse (`loadRuns` reads the `*.json` files directly in
    its directory, `evals/report.mjs:193`), so F5's gate cannot read `evals/results/codex/`. A
    Codex record carries `costUsd`, `modelUsage`, `turns` and `subagents` as `null`; its tokens
    are `inputTokens`, `cachedInputTokens`, `cacheWriteInputTokens`, `reasoningOutputTokens` and
    `outputTokens`, and `usage` is an array.
  - Unverified until T6's real trials: that `codex --version` answers in a home with no login
    and no config (if not, the run is refused before any trial, since T4r); whether Codex refuses
    or ignores an unknown effort; the wording of a cap or a login failure.
- 2026-10-05, T4 closed as `e880546` (gate green in about fourteen minutes, `core.bare` `false`
  in the main checkout afterwards; `.gitignore` gained `evals/results/codex/*.tmp`, which the
  existing pattern did not cover).
  - gentle-ai over `a53309c..e880546`: `medium`, review due (`slice_budget_reached`, 889 lines);
    consent granted under the pre-grant; one lens, `review-reliability`; approved and
    acknowledged (`review-d614e9ad14e49939`, authority burned). Three advisory findings, all
    taken as T4r: a WARNING, a Codex version probe that returns nothing was recorded as
    `stack.codex = null` with no message, and since `null` equals `null` such a run could be
    resumed on another Codex CLI unnoticed (`evals/suite.mjs:313`); and two SUGGESTIONs — the
    version probe creates the work root before a resume is refused, so a refusal can leave an
    empty one behind (`:304`), and a test compared two exported constants with the same
    literals (`evals/suite.test.mjs:784-787`).
  - Codex: `js-harness codex-review --base a53309c`, recorded as `reviewed`
    (`a53309c..e880546`): "No actionable regressions were identified in the Codex suite
    integration or reader-stop handling. The diff passes whitespace checks; functional tests
    were inspected but not executed."
  - That Codex run worked on the real login and did not refresh it: `~/.codex/auth.json` still
    carries its date of 2026-09-27 21:45Z at 17:54Z on 2026-10-05, 188 h later, past the 186 h
    the suite accepts. So a `codex exec` run is not the "ordinary use" that refreshes the login
    (Follow-ups), and T6 cannot start until something does.
- 2026-10-05, T4r and T5 written and verified: one delegation, two units on disjoint files.
  - T4r (`evals/suite.mjs` 52 added and 5 removed, `evals/suite.test.mjs` 88 and 5): a Codex
    run whose version cannot be read exits 2 before the template and any trial, with the
    command that was tried in the message; the directories the probe had to create are removed
    again, and only if empty, on that refusal, on a probe that throws and on a refused resume.
    RED first for both (`0 !== 2`; "what the probe made is removed"). `node --test
    evals/suite.test.mjs` 69/69.
  - T5 (`evals/report.mjs` 266 added and 33 removed, `evals/report.test.mjs` 296 and 1; 104
    assertion lines added, none changed): `node evals/report.mjs --results-dir
    evals/results/codex` reports a Codex directory, and `node evals/report.mjs
    --codex-results-dir evals/results/codex` prints the Claude against Codex table, one row per
    task, config and effort with each host's score, tokens, cost and wall time; a cell recorded
    on one side only reads `missing`. RED first against stub exports, 14 of 55 failed; then
    55/55 (rerun by the parent).
  - The agent of a document is its `agent` key and none means Claude; a directory that mixes
    agents, or names an unknown one, is refused. A Claude report carries no agent, so F5's
    output did not move: `node evals/report.mjs --require-complete --min-discriminating 3` exits
    0 and its plain and `--json` output are byte-identical to the output before the change.
  - The estimated list cost of a Codex trial, computed when the report runs and never written
    into a record: `gpt-6.1-sol`, standard tier, requests of at most 272K input tokens, per 1M
    tokens: input $2.00, cached input $0.10, cache writes $2.50, output $10.00
    (`developers.openai.com/api/docs/pricing`, read 2026-10-05; above 272K the published rates
    are $4.00, $0.20, $5.00 and $15.00). The uncached remainder is input minus cached minus
    cache writes. A record sums usage per turn and a turn holds several requests, so the long
    tier cannot be told from a record: the estimate is a lower bound in that respect, which the
    report's note says. A model with no price has an unknown cost, said once.
  - Assumed, for T6 to settle, and the estimate fails closed where a record contradicts it: that
    cache writes are a part of `input_tokens` and reasoning a part of `output_tokens` (both were
    0 in the two real sessions). A negative remainder, or more reasoning than output, makes that
    trial's cost and tokens unknown and the report names the trial and the reason.
  - The token column is input plus output on both hosts: Claude's is input, cache reads and
    cache creation plus output, over every model in `modelUsage`, subagents included; Codex's is
    `inputTokens` plus `outputTokens` summed over the session's turns. Whether Codex's per-turn
    usage includes subagent work is not known.
  - The verdict rule is unchanged and is fed the estimate for a Codex directory. The gates are
    refused together with `--codex-results-dir`: the comparison sets two hosts on two models
    side by side and decides nothing. A single Codex report also prints the wall-time note.
  - Size: 702 added, 44 removed over the two units (384 of the added lines are tests).
- 2026-10-05, T4r and T5 closed, which completes slice B: `4376908` and `2ac64bb`, each with a
  green gate of about thirteen minutes and `core.bare` `false` afterwards.
  - gentle-ai over `e880546..2ac64bb`: `medium`, review due (`slice_budget_reached`, 838 lines);
    consent granted under the pre-grant; one lens, `review-reliability`; approved and
    acknowledged (`review-01ecee89da37a727`, authority burned). One advisory finding, a
    SUGGESTION taken as a follow-up: the comment above `giveBackWorkRoot` says every way out
    that starts nothing gives the work root back, and the code does so on three exits
    (`evals/suite.mjs:606-609`). Its example, the login refusal, does not apply: the login is
    checked before the stack is read (`evals/suite.mjs:547`, against `:610`).
  - Codex: `js-harness codex-review --base e880546`, recorded as `reviewed`
    (`e880546..2ac64bb`): "No actionable defects were identified in the bounded read-only
    audit. This verdict is provisional: the full delegated review was blocked by unavailable
    sub-agent tools, and tests were not executed." So it is a weak review, for the reason
    Follow-ups already gives.
  - `check --push`: 3 code commits since `origin/main`, all covered by a Codex review record.
  - Not run: the full `node --test "evals/**/*.test.mjs"` on its own; every gate ran `npm run
    test`, which holds those files, and passed.
- 2026-10-05, slice C opened in a new session, and stopped before any trial by two findings.
  - The stack moved at about 20:20Z, before any trial of the matrix: `@openai/codex` 0.159.1 to
    0.160.0 (the global pnpm package, read from its `package.json`), engram 3.0.0 to 3.1.0, and
    the global `~/.codex/AGENTS.md` and `~/.claude/CLAUDE.md` were rewritten. gentle-ai stays
    4.0.0 and the engram plugin 0.1.5 on both hosts.
  - Checked for collisions with the harness, none found: `js-harness doctor` reports every row
    `ok` on both hosts (only codegraph 1.6.0 is outdated); the gate's budget row reads this
    repository's `AGENTS.md` alone and its payload row decides nothing (`bin/check.mjs:15-27`,
    `:53`); `buildCodexTemplate` against the real home accepts the `config.toml` Codex rewrote
    at 21:49Z, 631 files and 47.4 MB (634 and 49.7 on 2026-10-04), with no login in it; F5's
    results are untouched.
  - What it changes for F6: F5 measured Claude with engram 3.0.0 and the Codex matrix will run
    with 3.1.0, which the result must say (`minimal` loads no engram, so T6 is not affected);
    the 25,515 estimated tokens per turn cited for Codex (Why) predate the new `AGENTS.md` and
    are measured again before T7; T3's proof is of 0.159.1, so Sebastián had the probe run
    again on 0.160.0 before T6 (T3b), with the probe as it is: the follow-up about engram
    processes waits, since the first run saw no new engram process at all.
  - The login was never refreshed. Its file kept its date of 2026-09-27 21:45:10Z through an
    interactive session at 191.9 h, another at 192.05 h, `codex login status` and a plain
    `codex login`; Codex's own log holds no token refresh in those hours (`logs_2.sqlite`,
    rows since 20:00Z whose text or target names a refresh: only the model list). Read from
    the file, dates only: the access token was issued on 2026-09-27 21:45:10Z and expires on
    2026-10-07 21:45:10Z. So a login's file date says nothing about when Codex will refresh
    it, and the limit of 186 h refused a login with two days left.
  - Decided (Sebastián, 2026-10-05), between a real new login (`codex logout`, `codex login`)
    and a change of rule: the rule changes (T6p, Constraints). Still unverified: how long
    before the expiry Codex refreshes, and whether a refresh inside a copy leaves the real
    login invalid. If a trial did refresh its copy, he would log in again, which is the
    alternative he was offered.
  - T6p written and verified (route: delegated writer, strict TDD; trigger: 2+ non-trivial
    files), 354 added and 163 removed over six files of `evals/`, 241 of the added lines in
    tests. `assertLoginFresh(authFile, { minHoursLeft, now })` reads `exp` from the access
    token and returns `{ hoursLeft, expiresAt, ageHours }`; the file's date decides nothing
    any more, so the refusal of a future-dated file is gone. It fails closed on a file that
    is not JSON, has no access token, or whose token yields no expiry, an API-key login
    included, and every refusal says to log out and in again. The `JSON.parse` error is
    dropped on purpose, since its message quotes its input; a test checks the message, stack
    and properties of every refusal against every part of the fixture's token. The suite
    gains no flag; the probe's `--max-login-age-hours` is now `--min-login-hours-left` and
    its report's `login` is `{ hoursLeft, minHoursLeft, ageHours }`.
  - Observed, one file at a time. RED first: `codex-home.test.mjs` 5 of 38 failed on the old
    rule's own message ("was last written 192.0 hours ago, over the 186 hours allowed"),
    `suite.test.mjs` 1 of 69, `codex-isolation-probe.test.mjs` 3 of 37. Then
    `codex-home.test.mjs` 38/38 (rerun by the parent), `suite.test.mjs` 69/69,
    `codex-isolation-probe.test.mjs` 37/37, `codex-configs.test.mjs` 19/19,
    `runner.test.mjs` 153 pass and 1 skipped, `contract check` on this document exits 0. 37
    assertion lines were removed, all of the old rule, its messages or its flag. On the real
    login the new check answers 47.4 hours left, until 2026-10-07T21:45:10Z.
  - Left as it is: the probe's report note still says `auth.json` is never opened
    (`evals/codex-isolation-probe.mjs:715`), which is true of its snapshot scan and no longer
    of the run; and a report of the old `login` shape would print `undefined` in the summary,
    which nothing here does.
- 2026-10-05, T6p closed as `ef0e71f` (gate green, `core.bare` `false` in the main checkout
  afterwards, the worktree clean). The gate's payload row now reads 25,698 estimated tokens per
  turn for Codex (21,855 of them the global `AGENTS.md`), against the 25,515 of Why.
  - gentle-ai over `9c9ed8e..ef0e71f`: `medium`, review due (`slice_budget_reached`, 635
    lines); consent granted under the pre-grant; one lens, `review-reliability`; approved with
    no finding and acknowledged (`review-1a35ad4f1b3c314e`, authority burned). It read the
    eight patches and ran nothing.
  - Codex: `js-harness codex-review --base 9c9ed8e`, recorded as `reviewed`
    (`9c9ed8e..ef0e71f`): "No actionable regressions were identified. The expiry-based login
    check is consistently integrated into the suite and isolation probe, with tests covering
    boundaries, malformed credentials, and secret-safe errors. Tests were inspected but not
    executed." It was the first `codex exec` on 0.160.0 and left the real login as it was.
- 2026-10-05, T3b: the probe on codex-cli 0.160.0, 22:40:30Z to 22:47:35Z, PASS in both arms,
  two smoke trials spent. The record is the second-run section of
  `evals/proofs/codex-isolation.md`; the JSON report and the raw output are in
  `D:\js-harness-worktrees\codex-parity-t3-raw\0.160.0`.
  - The login's file was 192.9 h old and its token had 47.1 h left. Both trial copies stayed
    byte-identical and the real file kept its date and size, so a session past the eighth day
    does not refresh the login: what the rule of T6p rests on, now seen in a trial.
  - 0.160.0 printed the same events and items as 0.159.1 on this task, and the current arm made
    the same three engram calls. Its input was 105,282 tokens against 142,308 on 0.159.1; one
    session per version does not say why.
  - The machine was not quiet: four Codex processes of Sebastián's and another Claude Code
    session on another project wrote into the real `~/.codex`, `~/.claude` and `~/.engram`
    during the run. The leak scan found nothing of the trials in any of it.
- 2026-10-05, T6: 15 trials of `minimal` at `medium` on `gpt-6.1-sol`, codex-cli 0.160.0,
  22:48:04Z to 23:41:44Z (53m40s), `node evals/suite.mjs --agent codex --codex <codex.exe>
  --configs minimal --efforts medium --repeats 3 --tasks all --name headroom`, exit 0. The
  recorded stack is `codex-cli 0.160.0`, gentle-ai 4.0.0, engram 3.1.0.
  - Every trial scored 1.00, none failed and none hit a cap. Per task, means of three trials,
    Codex beside Claude's same cell of F5 (`node evals/report.mjs --codex-results-dir
    evals/results/codex`):

    | task | score Claude / Codex | tokens Claude / Codex | cost Claude / est. Codex | wall Claude / Codex |
    |---|---|---|---|---|
    | format-v2 | 0.99 / 1.00 | 1.09M / 393.7k | $1.38 / $0.25 | 4m55s / 5m12s |
    | house-rules | 0.98 / 1.00 | 312.7k / 202.8k | $0.40 / $0.12 | 1m17s / 2m10s |
    | lost-updates | 1.00 / 1.00 | 341.6k / 220.8k | $0.52 / $0.18 | 2m19s / 3m22s |
    | resolver | 1.00 / 1.00 | 194.6k / 232.0k | $0.41 / $0.16 | 1m40s / 3m26s |
    | spec-drift | 0.99 / 1.00 | 384.7k / 226.1k | $0.54 / $0.17 | 1m44s / 3m17s |

  - The run's total: 3,694,964 input tokens, 3,214,720 of them cached and none a cache write,
    and 131,196 output tokens, 9,542 of them reasoning; about $2.6 at list price, estimated,
    against $9.75 of list cost for the same 15 trials on Claude (the sum of the column above,
    times three). The two hosts ran two models at two price lists, and a Codex trial's wall
    time holds its setup download, so the columns sit side by side and decide nothing.
  - The headroom screen drops all five tasks (mean 1.00, kept under 0.8): on this model the
    minimal arm leaves no room above it. So T7 cannot show the stack raising a score; it can
    show it lowering one, and what it costs in tokens, list price and time. That is what F5
    showed for Claude too, where the two arms tied on score and the answer was the cost.
  - Settled: `reasoning_output_tokens` is no longer 0, 116 to 1,272 per trial, so the model
    reasons on a real task. That the word `medium` is what arrived is still not shown: only a
    `high` cell beside it would. Every trial was one turn; a cap or login failure is unseen.
  - The real login kept its date through the 15 trials, at about 194 h.
- 2026-10-05, T6 and T3b recorded as `5f772ed` (gate green, `core.bare` `false`, the worktree
  clean and nothing untracked left by the gate).
  - gentle-ai over `ef0e71f..5f772ed`: `medium`, review due (`slice_budget_reached`, 645 lines,
    the result file read as a configuration change); consent granted under the pre-grant; one
    lens, `review-reliability`; approved and acknowledged (`review-4ce2996e69c7e7f1`, authority
    burned). One advisory SUGGESTION, fixed in the commit that records this: the roadmap gave
    $0.12 to $0.25 "per trial" where those are the lowest and highest task means, and no
    per-trial cost is recorded (`costUsd` is `null` in every Codex trial).
  - Codex: `js-harness codex-review --base ef0e71f`, recorded as `reviewed`
    (`ef0e71f..5f772ed`): "The diff adds evaluation results and updates supporting
    documentation without changing executable code. No actionable regressions were identified;
    tests were not run."
  - `check --push`: 2 code commits since `origin/main`, both covered by a Codex review record.
- 2026-10-05 (2026-10-06T00:24Z), T7 started on Sebastián's go-ahead ("corré T7: los otros 45
  trials, sin actualizar nada del stack"). Two runs, one after the other in one chain, named as
  F5's: `headroom-current` (`--configs current --efforts medium`, 15 trials), then, only if it
  exits 0, `ab-high` (`--configs minimal,current --efforts high`, 30 trials).
  - Read before the first trial: codex-cli 0.160.0, gentle-ai 4.0.0, engram 3.1.0, as in T6;
    the login's token had 45.3 h left; no gate running; the worktree clean at `bade46b`; the
    machine never sleeps (standby 0). The Codex payload is still 25,698 estimated tokens per
    turn from files (global `AGENTS.md` 21,855, model instructions 2,346, this repository's
    `AGENTS.md` 1,497), measured with `measurePayload`, so the `current` arm runs under the
    figure the gate reported at T6p.
  - engram refused every write of this session after its compaction ("Claude host session
    registration could not be confirmed", the hook before `mem_save`, `mem_session_summary`
    and `mem_session_start`), so the mirror of this document is pending, and it was already
    cut at 50,000 bytes of the 60,784 the document had at `bade46b`.
- 2026-10-05 (2026-10-06T00:51Z), T7 stopped by the subscription's usage cap, 27 minutes in:
  3 of the 45 trials are recorded (`evals/results/codex/headroom-current.json`), the fourth hit
  the cap mid-turn and is not recorded, and `ab-high` did not start, since the chain runs it
  only after an exit 0. Exit 1, `the suite stopped: cap`.
  - The cap's wording, unseen until now: an `error` event and then `turn.failed`, both with
    "You've hit your usage limit. Upgrade to Pro (...), visit
    https://chatgpt.com/codex/settings/usage to purchase more credits or try again at 10:00
    PM." (a typographic apostrophe in the original). The suite read it as `cap`, stopped
    before the next trial and recorded nothing for the one it cut, as designed. 10:00 PM is
    read as local time, 03:00Z.
  - What the window held before it closed: the two probe sessions, T6's 15 trials (3.69M input
    tokens), two Codex reviews, and these three trials and part of a fourth (2.07M input
    tokens recorded), and whatever Sebastián's own Codex sessions of that afternoon used,
    which is not measured. The size of the cap is not published and when its window opened
    is not known, so this is a floor and no more: about 6M input tokens of this feature's,
    most of them cached, went into it.
  - The three trials, one each, so no mean and no verdict:

    | task | score (`current`, `medium`) | passed | input tokens (cached) | output | wall | `minimal` mean of T6 |
    |---|---|---|---|---|---|---|
    | format-v2 | 0.26 | 12 of 47 | 414,680 (368,640) | 1,821 | 2m50s | 1.00, 393.7k, 5m12s |
    | house-rules | 0.74 | 35 of 47 | 812,805 (757,632) | 3,903 | 6m52s | 1.00, 202.8k, 2m10s |
    | lost-updates | 0.84 | 36 of 43 | 842,087 (776,960) | 4,810 | 8m08s | 1.00, 220.8k, 3m22s |

  - Why two of them scored low is in their last message (`evals/runs/codex/headroom-current/`,
    not committed): the session ended on a question nobody was there to answer. format-v2
    stopped before writing anything, asking for the delivery strategy ("Should I use
    stacked-to-main ... or feature-branch-chain"), which the global `AGENTS.md` has the agent
    ask once a change is forecast above about 400 lines. lost-updates committed the store fix
    and stopped on gentle-ai's review consent ("Reply with 1 or 2"), with "Queue fixes remain
    pending". house-rules finished ("All 23 tests pass", a commit, "Native review deferred:
    under budget") and still passed 35 of 47; which checks it missed was not read.
  - So on these three trials the installed stack lowered the score of a one-shot `codex exec`
    session, by ending the turn on its own blocking prompts, and cost four times the tokens
    of `minimal` in the two sessions that did the work (format-v2, which stopped before writing
    anything, used about as many as `minimal`: 414.7k against 393.7k). It is the stack as installed that is measured (Out of scope: changing
    it to make a config win), and a headless session is not how Sebastián works with it, which
    the result must say. F5's Claude arms tied on score; whether Claude's `current` sessions
    met the same prompts and went on was not checked.
  - Each `current` session called engram 8 to 17 times (`mem_save`, `mem_judge`,
    `mem_session_summary` among them) and started 1 to 6 `collab_tool_call` items. A search
    of the real engram store for the words of house-rules' saved memory, across every project,
    found nothing, so those writes stayed in the trials' own stores, as T3 proved.
  - Two sessions logged `apply_patch verification failed: invalid patch: multiple operations
    target` one file on stderr and went on.
  - The remaining 42 trials (12 of `current` at `medium`, 30 at `high`) are with Sebastián:
    at these token counts they need several cap windows, and his own Codex is capped while
    each one is spent.
- 2026-10-05, the partial run recorded as `cdb6330` (gate green, `core.bare` `false`, the
  worktree clean). gentle-ai over `5f772ed..cdb6330`: `medium`, 236 lines, review not due
  (`under_budget`), so the range stays pending in the slice and the boundary stays `5f772ed`.
- 2026-10-05, Sebastián cut the matrix: T7 ends with the 12 trials of `current` at `medium`
  still missing, and `high` is left out on both configs (Constraints, with his words and what
  the cut gives up). `ab-high` never ran, so no result file is dropped. Asked which cells the
  report's gate wants before the cut was written: `node evals/report.mjs --results-dir
  evals/results/codex --require-complete` exits 1 today and names the five cells of `current`
  at `medium` and no other, so it needs no `high` cell.
  - The 12 trials start after 03:00Z on 2026-10-06 (10:00 PM local, the hour the cap message
    names), with the command of the first run and its name, `headroom-current`, which skips
    the 3 recorded. If the cap stops them again, the same command continues after the next
    hour it names.
- 2026-10-05, the cut recorded as `6201cc0` (gate green, `core.bare` `false`, the worktree
  clean; gentle-ai read that commit as `passive`, and the range `5f772ed..6201cc0` as
  `medium`, 276 lines, `under_budget`).
- 2026-10-06T03:03Z to 04:05Z, the second cap window: 5 more trials recorded, 8 of 15, and the
  cap stopped the sixth.
  - The run that waited for the cap started on its own at 03:03:00Z. Sebastián stopped it from
    the app three minutes in, asking for it to be launched at once, and it was started again at
    03:07:28Z. The trial that was cut (resolver #1) was not recorded and ran again whole. A
    stopped suite does not clean after itself: the trial's engram server was still listening
    on the trial's port (57882; the real one, on 7437, was not touched), its parent gone, and
    the work root held the trial's home, which holds the copy of the login, its workspace and
    the home template. The server was ended and the three directories removed by hand before
    the next start.
  - The cap came back at 04:05:58Z, 58 minutes and five trials later, mid-turn in resolver #2:
    "... or try again at Oct 6th, 2026 3:03 AM." That is five hours after 22:03 local, the
    minute this window's first session started, so the cap reads as a five-hour window that
    opens with the first use; one observation. This window held 5.37M input tokens of
    recorded trials (5.07M cached), the three minutes of the trial that was stopped and part
    of a sixth, so about five `current` trials fit in one.
  - The eight trials of `current` at `medium` so far (`passed` is hidden tests):

    | trial | score | passed | input tokens (cached) | output (reasoning) |
    |---|---|---|---|---|
    | format-v2 #1 | 0.26 | 12 of 47 | 414,680 (368,640) | 1,821 (171) |
    | house-rules #1 | 0.74 | 35 of 47 | 812,805 (757,632) | 3,903 (94) |
    | lost-updates #1 | 0.84 | 36 of 43 | 842,087 (776,960) | 4,810 (497) |
    | resolver #1 | 1.00 | 45 of 45 | 1,063,333 (999,936) | 5,065 (301) |
    | spec-drift #1 | 1.00 | 51 of 51 | 1,194,128 (1,130,368) | 5,603 (474) |
    | format-v2 #2 | 1.00 | 47 of 47 | 1,453,552 (1,387,008) | 6,894 (1,207) |
    | house-rules #2 | 0.81 | 38 of 47 | 913,793 (859,008) | 4,629 (131) |
    | lost-updates #2 | 1.00 | 43 of 43 | 746,254 (690,560) | 3,691 (106) |

    Together 7,440,632 input tokens, 6,970,112 of them cached, and 36,416 output tokens. Wall
    time ran from 2m50s (format-v2 #1, which stopped on its question) to 18m08s (format-v2
    #2), against 2 to 5 minutes for `minimal`.
  - A session that ends on a question does not always lose points: format-v2 #2 did the whole
    change, left it uncommitted and closed asking for a size exception ("May I keep it as one
    work unit ... rather than split"), and passed 47 of 47, since the grader reads the
    workspace. format-v2 #1 asked before writing. house-rules finished both times with no
    question and still missed 9 and 12 of 47 hidden tests; which ones was not read.
  - Seven trials are left: resolver #2 and #3, spec-drift #2 and #3, and the third of
    format-v2, house-rules and lost-updates. The same command waits for 08:05Z (3:05 AM
    local), two minutes after the hour the message names; at about five trials a window, the
    last two need the window after that one.
- 2026-10-06, the second window recorded as `a9147a1` (gate green, `core.bare` `false`, the
  worktree clean).
  - gentle-ai over `5f772ed..a9147a1` (`cdb6330`, `6201cc0`, `a9147a1`): `medium`, review due
    (`slice_budget_reached`, 483 lines, the result file read as a configuration change);
    consent granted under the pre-grant; one lens, `review-reliability`; approved and
    acknowledged (`review-787349eb14ee47d2`, authority burned). Two advisory findings, both
    fixed in the commit that records this: the roadmap still described the first window, three
    trials and twelve missing, beside a result file of eight (WARNING), and "two to four times
    the tokens" counted format-v2 #1, which used about as many as `minimal` (SUGGESTION).
  - Codex has not reviewed that range: its review draws on the cap the trials are waiting
    for. It runs once the 15 trials are recorded, over the whole range since `5f772ed`.
- 2026-10-06, the review's fixes recorded as `8b3ce67` (gate green, `core.bare` `false`, the
  worktree clean; `passive`, no review due).
- 2026-10-06T08:05Z to 09:09Z, the third cap window: 5 more trials recorded, 13 of 15, and the
  cap stopped the sixth again, resolver #3, mid-turn.
  - The run started on its own at 08:05:01Z, nothing stopped it, and the work root was empty
    afterwards with no engram process of a trial left. The cap came back at 09:09:30Z: "...
    or try again at 8:05 AM." Five hours after this window's first session, as in the second
    window, so two observations now say the window is five hours from the first use and
    holds about five `current` trials: 4.74M input tokens recorded here (4.45M cached) and
    part of a sixth.
  - The five trials:

    | trial | score | passed | input tokens (cached) | output (reasoning) | wall |
    |---|---|---|---|---|---|
    | resolver #2 | 1.00 | 45 of 45 | 1,052,509 (992,256) | 5,135 (349) | 12m58s |
    | spec-drift #2 | 1.00 | 51 of 51 | 1,142,219 (1,081,344) | 5,375 (294) | 15m05s |
    | format-v2 #3 | 0.26 | 12 of 47 | 372,682 (327,808) | 1,390 (128) | 3m08s |
    | house-rules #3 | 0.98 | 46 of 47 | 1,103,828 (1,030,912) | 5,927 (697) | 10m17s |
    | lost-updates #3 | 1.00 | 43 of 43 | 1,071,832 (1,014,272) | 5,470 (673) | 15m49s |

    The 13 trials together: 12,183,702 input tokens, 11,416,704 of them cached, and 59,713
    output tokens.
  - Three cells have their three trials: format-v2 0.26, 1.00, 0.26 (mean 0.51), house-rules
    0.74, 0.81, 0.98 (mean 0.84), lost-updates 0.84, 1.00, 1.00 (mean 0.95). `minimal` scored
    1.00 on all nine of its trials of those tasks.
  - format-v2 #3 is format-v2 #1 again: the session forecast 600 to 900 changed lines, asked
    "Which chain strategy should I use?" and ended with "No source files have changed yet",
    12 of 47, the score of the untouched fixture twice over. So two of the three format-v2
    sessions under the installed stack did no work, and the one that did scored 1.00.
    house-rules #3 finished, committed and closed on gentle-ai's review consent (risk high,
    "shell scripting in `completions/tk.bash`"), at 46 of 47.
  - Two trials are left, resolver #3 and spec-drift #3. The same command waits for 13:07Z
    (8:07 AM local).
- 2026-10-06, the third window recorded as `8917dc3` (gate green, `core.bare` `false`, the
  worktree clean). gentle-ai over `a9147a1..8917dc3`: `medium`, 237 lines, review not due
  (`under_budget`).
- 2026-10-06, 11:15Z: the run that waited for 13:07Z is gone. The Claude Code session that
  held it ended and a new one took over, and a background command does not outlive its
  session. Nothing ran, 13 trials are recorded, the work root is empty and the stack is
  unchanged. So a run that waits hours for the cap is only as safe as the session that holds
  it.
- 2026-10-06, Sebastián asked why Codex runs out so fast and what the trials send. Read from
  the recorded trials and their raw logs (`evals/runs/codex/`, items counted per session):
  - What is sent is `evals/codex-configs.mjs:80-81`: `codex exec --json --ephemeral
    --skip-git-repo-check -m gpt-6.1-sol -c model_reasoning_effort="medium"
    --dangerously-bypass-approvals-and-sandbox -C <workspace>`, the prompt on stdin, one trial
    at a time, and `--dangerously-bypass-hook-trust` more in `current`. The two arms differ in
    their `CODEX_HOME` and in nothing else: `minimal` holds the login alone, `current` a copy
    of his real `~/.codex` without the desktop app's pieces, so his `config.toml` (its plugins
    and MCP servers, `engram` and `codegraph` among them, less the desktop app's), his hooks,
    the global `AGENTS.md` and engram's instructions. His config asks for `high` effort; the
    trial's `-c` puts `medium` over it.
  - Per trial, means of the 15 of `minimal` and the 13 of `current`:

    | | `minimal` | `current` |
    |---|---|---|
    | items in the session | 14.8 | 33.9 |
    | of them shell commands | 8.0 | 8.9 |
    | of them MCP calls | 0 | 16.0 (206 of the 208 to engram, 2 to codegraph) |
    | of them `collab_tool_call` (sub-agents) | 0 | 4.2 |
    | input tokens | 246,331 | 937,208 |
    | of them not cached | 32,016 | 59,000 |
    | output tokens | 8,746 | 4,593 |
    | input tokens per item | 16,644 | 27,627 |

  - So `current` reads 3.8 times the input tokens of `minimal` for the same task, and the
    table says where from: the session takes 2.3 times the steps, with the same shell work
    (8.9 commands against 8.0) and 20 steps more that are the stack's own, memory calls and
    sub-agents; and each step carries a context 1.7 times as large, since every request sends
    the whole conversation again with the 25,698 tokens of instructions from files and the
    tools' definitions in it. It writes less: 4,593 output tokens against 8,746. "Input tokens
    per item" is a rough divisor: a sub-agent's own requests are in the tokens and not in the
    items.
  - On the cap: the first window held T6's 15 `minimal` trials and more, and the next two held
    five `current` trials each, about 5M input tokens a window with 94% of them cached. Whether
    the cap counts a cached token as a whole one is not known. The cap message offers an
    upgrade to Pro, which reads as a plan below it; the plan was not read from the login.
  - The 208 MCP calls of the 13 `current` trials, by tool: `engram.mem_judge` 102 (7.8 a
    session), `mem_save` 39 (3.0), `mem_search` 14, `mem_current_project`, `mem_review` and
    `mem_get_observation` 13 each, `mem_session_summary` 12, `codegraph.codegraph_explore` 2.
    So half of them are conflict judgments, 2.6 for every memory saved, in a store that was
    empty when the session began: the session judges what it has just written against what it
    wrote minutes before. At 27,627 input tokens a step that is roughly a quarter of a trial's
    input, an estimate from counts and not a measurement.
  - He then asked how to spend less for the same work. Answered, nothing changed: the one
    measured answer is the `minimal` home itself, 26% of the tokens at a higher score on these
    five one-shot tasks, so a lean Codex home for self-contained tasks; trimming the stack
    (engram's judgments, the 21,855 tokens of the global `AGENTS.md`) is not measured and
    hangs on others, gentle-ai #4036 among them. Either is outside F6, which measures what is
    installed; it would be a feature of its own after this one.
- 2026-10-06, he asked for the reviews by Codex to be excellent and complete without the
  spend, "at the beginning we were not spending that". Investigated read-only, no model
  called; what was found, for the feature that would follow F6:
  - No review since 2026-09-30 has a token count. `js-harness codex-review` drops the usage of
    `turn.completed` and every item that is not a shell command (`bin/codex-review.mjs:324`),
    and `--ephemeral` leaves no thread in `~/.codex/logs_2.sqlite` or `state_5.sqlite`.
  - The one `codex exec review` of this repository with full usage (2026-09-30T00:37Z, a run
    that was not ephemeral, cli 0.159.1, `gpt-6.1-sol` at `high`, before gentle-ai 4): 107 s,
    7 requests, 297,479 input tokens (240,640 cached), 2,396 output, 6 shell calls, no MCP
    call; its first request was 17,942 tokens and its `AGENTS.md` message about 8.5k.
  - The reviews through the Claude plugin, 37 threads from 2026-09-27 to 09-30, ran a median
    of 206 s, 20 requests and 777,511 tokens summed over requests (35 of them on `gpt-6-sol`
    at `xhigh`). The reviews of 2026-10-04 and 10-05 took a median of about 92 s, and their
    nine saved logs show 3 to 10 shell commands. So the logs do not say a review costs more
    than it did; they say nothing measured it.
  - What did grow is the fixed part of every request: Codex's payload from files went from
    10,510 to 25,515 estimated tokens on 2026-10-01, when gentle-ai 4 gave Codex the whole
    orchestrator (`odd/tasks/stack-v4.md:75-80`), and is 25,698 now.
  - That block does more than cost: three saved reviews show it steering the reviewer.
    `t2r-codex-review.log:6`: "Review is blocked, not evidence that the patch contains a
    defect. The diff exceeds the repository's mandatory delegation budget, sub-agent tools
    are unavailable"; the same in `codex-parity-codex-review-t1.log` and `codex-t5.out`. It
    is the likely cause of the follow-up above, that Codex could not review a range over
    about a thousand lines.
  - Launches of the review command found in the Claude transcripts against records written:
    22 against 8 on 2026-10-04 and 18 against 10 on 10-05. A search over command text, so a
    proxy, but it reads as about one unrecorded run for each recorded one.
  - What the installed CLI offers, read from `codex exec review --help` and Codex's source
    documentation: `--ignore-user-config` (no `config.toml`, so no MCP servers, plugins or
    engram instructions; the login stays), `-c mcp_servers.<name>.enabled=false`, a
    `review_model` key, and no documented way to skip the global `AGENTS.md`, which is read
    from the Codex home on every start.
  - What drained the cap on 2026-10-05 and 10-06 was this feature's trials, about 16M input
    tokens in 28 trials, not the two reviews of those days.
- 2026-10-06, the investigation recorded as `9855226` (gate green, `core.bare` `false`, the
  worktree clean; `passive`).
- 2026-10-06, Sebastián paused T7: "Cancelemos los trials por ahora y tratemos de hacer la
  integracion nosotros". The last two trials, resolver #3 and spec-drift #3, do not run, so
  nothing more of this feature draws on the cap for now. 13 of the 15 of `current` at
  `medium` stay recorded; `node evals/report.mjs --results-dir evals/results/codex
  --require-complete` stays red on those two cells, so the contract of this feature is not
  met and F6 is open, not closed. What he wants next is the review by Codex done by an
  integration of our own that loads only what a review needs.
  - The plugin he named, checked: `codex@openai-codex` is 1.0.6 here (installed 2026-08-15),
    and upstream `openai/codex-plugin-cc` has its last commit and release on 2026-07-08, 524
    open issues, not archived (`gh api repos/openai/codex-plugin-cc`); its prompting skill
    is written for GPT-5.4. The reviews of this repository already go around it, through
    `codex exec review`, since 2026-09-29 (`odd/tasks/codex-exec-review.md`). What still
    rests on it: a row of `doctor`, `codex:rescue`, and a SessionStart hook.
  - What a review session loads today that is about reviewing, read section by section: of
    the 87,563 bytes of the global `~/.codex/AGENTS.md`, none. Delegation rules are 21% of
    it, implementation routing 20%, the orchestration of gentle-ai's own review 27%, the
    engram protocol 9% (and again in `model_instructions_file`), sub-agent paths 8%, persona,
    language and skill loading 9%, CodeGraph 4%, remote authorization 2%. The rubric a review runs on is Codex's own: `codex review`
    sets its `REVIEW_PROMPT` (`prompts/templates/review/rubric.md`: priorities P0 to P3,
    "output all findings that the original author would fix") as the base instructions of
    every review, whatever the home holds (`codex-rs/core/src/tasks/review.rs`, read through
    the source documentation, not from the installed binary).
- 2026-10-06, the pause recorded as `f6a81ce` (gate green, `core.bare` `false`, the worktree
  clean; `passive`).
- 2026-10-06, Sebastián decided the effort of the review for that next feature: "Hagamos la
  Revision con el Modelo Sol 6.1 en Medium mejor". So the review by Codex runs on
  `gpt-6.1-sol` at `medium`, set by the review command itself (`-m` and `-c
  model_reasoning_effort="medium"`), where today it takes `high` from his `config.toml`.
  Nothing is changed here: `bin/` is out of this feature's scope, and the change belongs to
  the next one.
  - Said to him with the decision: effort is not where a review's tokens are. In the one
    measured review, at `high`, reasoning was 703 of 2,396 output tokens against 297,479 of
    input, so the saving of `medium` is whatever requests it spares, which is not measured;
    the context sent with each request is the larger part. The comparison that feature runs
    before switching can hold one review at `high` beside `medium` on the same range, so the
    choice rests on a measurement.
- 2026-10-13, F6 closed, by the session of the rule hierarchy (JH 7), to which the lead gave
  this branch when it had no owner. Route: inline.
  - His decision: T7 closes on 13 of 15 (Tasks, T7, with its line). The two trials could not
    have joined the same run as things stood: the suite refuses to continue a results file
    recorded on another stack (`evals/suite.mjs`, `refusalOf`), the file records codex-cli
    0.160.0, gentle-ai 4.0.0 and engram 3.1.0, and on 2026-10-12 this machine answered
    codex-cli 0.162.0, gentle-ai 4.1.1 and engram 3.4.0 (each `--version`). A note of
    2026-10-09, left uncommitted in the old worktree, had already read engram at 3.3.0 and
    named the choice: close on 13, or put engram 3.1.0 back for that one run.
  - How it reached `main`. The branch `feat/codex-parity` was 13 commits ahead of a base 506
    commits behind `main`, and a merge of the two conflicts in the roadmap and in the suite
    and its test. A merge would have been a code commit whose review covers everything `main`
    brought. So the same content went onto a branch cut from `main` at `abe9295`,
    `feat/codex-parity-close`, as three commits (the lead's call, 2026-10-13): `1f70a24`, the
    login fix of `ef0e71f` applied again (its six code files came across whole but for two
    import lines; the three test files failed on the old sources and pass on the new: 38, 37
    and 79); `d3f3698`, the two results files and the isolation proof, each the same blob as
    at `847f5b2`; and this commit, the documents. This document is the old branch's at
    `847f5b2` with the entries of today.
  - Reviews of `1f70a24`: gentle-ai, medium risk, review not due, under budget. Codex with
    `--base abe9295`, in two parts, "the patch is correct" (confidence 0.87 and 0.91), no
    finding, 288,712 input tokens (184,320 cached) against an allowance of 620,400; recorded.
    The results files are marked `-codex-review` (`.gitattributes`) and are in no review.
  - The contract: its condition that the Codex matrix be complete could never exit 0 after
    his decision, so it now asks that the Codex runs be read whole and says the matrix is
    closed at 28 of 30. Read on this tree: F5's gate exits 0; the Codex report exits 0;
    `--require-complete` on the Codex runs exits 1, naming "resolver medium current: 2 of 3
    trials" and "spec-drift medium current: 2 of 3 trials".
  - Not touched: the branch `feat/codex-parity`, its worktree with three lines not committed,
    `evals/runs/` there (2.5 MB of raw trial output, ignored by git) and
    `D:/js-harness-worktrees/codex-parity-t3-raw` (232 KB). What is kept of the raw output is
    his, and the lead carries it to him once this is on `main`.

## Follow-ups
- A gate left an untracked file in this worktree once: during the pre-commit gate of `48406cf`
  (2026-10-05, 14:29 local) `Microsoft/Windows/PowerShell/ModuleAnalysisCache` appeared at the
  root, 14,987 bytes, and that gate's review row read "gentle-ai could not assess the pending
  change", since an untracked file makes the assessment unassessable. It was removed by hand;
  the five earlier gates of that day left nothing. PowerShell keeps that cache under
  `%LOCALAPPDATA%`, so a relative path means some process of the gate ran PowerShell with that
  variable unset and the repository as its working directory. Which one is not traced:
  `bin/lib/process-tree.mjs:190` spawns PowerShell with a merged environment, and the sandbox
  environments of `evals/` move `LOCALAPPDATA`. Until it is, `git status --short` is read after
  every gate and before any review assessment.
- The comment above `giveBackWorkRoot` promises more than the code does (`evals/suite.mjs:606-609`,
  gentle-ai SUGGESTION on T4r): it is given back on three exits, and the exits between the
  resume check and the first trial were not traced one by one. With the next change to
  `evals/suite.mjs`: give it back on every exit before the first trial, or say three.
- A reader that throws, instead of returning a reading of the wrong shape, still ends the run as
  `the suite failed` (exit 1, nothing recorded, raw output kept) and not as the `reader` stop
  (T4). Both readers here return; make it one stop if a third reader is written.
- A Claude run named `codex` would keep its raw logs in `evals/runs/codex/`, beside the Codex
  runs' directories (T4). Not refused; no recorded run has that name.
- The login is checked once per run, before the first trial. A run longer than the 12 hours
  the check leaves is not guarded. The token that is there on 2026-10-05 expires on 2026-10-07
  at 21:45Z, so T7 either starts before 09:45Z that day or after a new login.
- The config scan refuses a single-line value that holds a triple quote inside a string or a
  comment (Codex P2 on T2r, `evals/codex-home.mjs:218`). Make the delimiter check respect string
  and comment context when a real config trips it; until then the build stops and names the line.
- The scan depends on Codex writing `config.toml` with one value per line. If an update starts
  writing multi-line arrays, the current arm stops at template build, by design.
- Codex could not review a range above about a thousand lines here, three times. A slice this
  size needs commits small enough for it, or the skip that was recorded.
- Every trial downloads its own setup: about 60 MB of curated plugins and caches in either arm,
  and 59 MB more of the engram marketplace in the current arm. That time is inside a Codex
  trial's wall time and has no counterpart in a Claude trial, so T5's wall-time comparison must
  say so, or T4 must measure it apart.
- What makes Codex refresh a login, and how long before the expiry, is still not known: nothing
  did in the ten hours around its eighth day (Progress, 2026-10-05, slice C). The first refresh
  seen on this machine settles it; until then the 12 hours of T6p are a guess with room.
- Codex at `high` is not measured (cut on 2026-10-05). If the effort axis is ever wanted, it is
  `--configs minimal,current --efforts high --name ab-high`, 30 trials, on one stack with the
  `medium` runs or as a matrix of its own.
- A suite that is stopped from outside leaves the trial's home in the work root, with the copy
  of the login in it, and the trial's engram server running (Progress, 2026-10-06T03:03Z). The
  cap and an error end a trial cleanly; a kill does not. Until the suite removes what an
  earlier run left, a stopped run is cleaned by hand before the next start: the engram server
  that listens on a port other than 7437 and whose parent is gone, and every directory in
  `js-harness-evals-work`.
- A run that meets the cap stops the chain it is in, and nothing starts it again when the cap
  lifts: it is resumed by hand. The cap message names the hour it lifts ("try again at 10:00
  PM"), which the suite prints and does not parse.
- engram refused this session's writes after a compaction ("Claude host session registration
  could not be confirmed"), and its mirror of this document is cut at 50,000 bytes. The file
  in the repository is whole; the mirror needs the document split or only its live sections
  saved.

- The probe ties a new engram process to a trial by its command line or its port, so one the
  trial started that takes both from its environment and does not listen (a stdio server) is
  only a warning, while the summary still says no engram process of the trial is left
  (gentle-ai WARNING, `evals/codex-isolation-probe.mjs:422-425`). The real run had no new engram
  process at all. Before the probe is run again: attribute by parent process too, and word the
  summary by what was shown.
- `evals/codex-home.test.mjs:684` expects a file date to the millisecond (gentle-ai WARNING).
  On this host a date set from a `Date` read back exact 5,000 times out of 5,000; another file
  system may round it. Compare to the second if it ever fails.
- No test reads a Claude result with subagents and per-model usage through `assertReading`
  (`evals/runner.test.mjs:1982-1987`), and an infinite count is reported as `null`
  (`evals/runner.mjs:462`). T4 runs the suite's tests over both readers and is where the first
  belongs.

## Next step
F6 is closed: slices A and B merged on 2026-10-05 (#33, #34), and slice C on 13 of the 15
trials of `current` by Sebastián's decision of 2026-10-12, its result written in the roadmap
("F6 result"). No task is open and nothing runs. What is left is not a task of this feature:
his word on what is kept of the raw trial output that lives only on this machine (Progress,
2026-10-13), after which the old branch `feat/codex-parity` and its worktree can go.

What he asked for next is a feature of its own, in its own session and branch from `main`:
the review by Codex through an integration of this repository that loads only what a review
needs, measured before and after. Its evidence is in Progress, 2026-10-06.

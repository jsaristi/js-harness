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
- `node evals/report.mjs --results-dir evals/results/codex --require-complete` exits 0, so the
  Codex matrix is complete
- `docs/ROADMAP.md` records the F6 result (per task and effort: both hosts' score, tokens,
  estimated list cost and wall time) and `node bin/js-harness.mjs progress` shows F6's two steps
  checked

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
- The isolation proof is a hash of the real trees before and after a real trial, not a fake API —
  because through a loopback custom provider Codex sent no tools and no base instructions
  (`docs/origin.md:58`), so a fake-API trial would not be the session that is measured.
- F5's results and its gate stay as they are: Codex results live in `evals/results/codex/` —
  because `checkRuns` refuses runs whose model or stack differ (`evals/report.mjs:220-246`).
- The Claude path keeps its behavior: its existing tests pass unchanged — because F5's recorded
  numbers must stay reproducible by the same code.
- Model `gpt-6.1-sol` at `medium` and `high`, three trials per cell, both configs: the matrix of
  F5. Permissions are `--dangerously-bypass-approvals-and-sandbox`, the equivalent of the
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
- [ ] T4 `evals/suite.mjs --agent codex`: model, efforts, stack fields (Codex version, gentle-ai,
  engram), results under `evals/results/codex/`, resume
- [ ] T5 Report: an agent dimension, the estimated list cost of a Codex trial, and a Claude
  against Codex table

### Slice C — runs and result
- [ ] T6 Headroom run: 15 trials (`minimal`, `medium`), then the checkpoint with Sebastián
- [ ] T7 The other 45 trials, after his go-ahead
- [ ] T8 The F6 result in `docs/ROADMAP.md`, F6's steps checked

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

## Follow-ups
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
- The real login reaches the age limit of 186 h on 2026-10-05 at about 15:45Z. T6 runs after the
  real Codex has refreshed its own login (any ordinary use of it does), never with a copy that
  could be refreshed inside a trial.

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
Slice A is whole: T1, T2 and T3 with their corrections, six code commits, all reviewed. Its pull
request against `main` is Sebastián's call (stacked-to-main). Then T4, `evals/suite.mjs --agent
codex`, opens slice B; it decides what the suite does with a trial `assertReading` rejects and
whether a trial's setup download is measured apart from its wall time.

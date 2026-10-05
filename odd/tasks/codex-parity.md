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
- [ ] T1 The runner reads an agent's output through a parser the config carries: Claude's is
  today's behavior; Codex's reads `codex exec --json` JSONL (final message, usage summed over
  `turn.completed`, cached input counted once, `turn.failed` and `error` classified as cap, auth
  or failure); the fake agent gains a Codex mode (route: delegated writer, strict TDD — trigger:
  2+ non-trivial files)
- [ ] T2 A Codex sandbox home and its two arms: `CODEX_HOME` inside the trial's home with a copy
  of `auth.json`; `minimal` is an empty home with user config ignored; `current` is a frozen
  copy of the real `~/.codex` with its paths rewritten, plus `js-harness init`; the real binary
  is resolved, never a `.cmd` shim (route: delegated writer, strict TDD)
- [ ] T3 Isolation proof for Codex: the real `~/.codex`, engram and gentle-ai trees hashed before
  and after one real trial per arm, the report committed, and the real login verified afterwards
  (route: delegated writer for the probe, the two real trials run by the parent)

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

## Next step
Commit this document, then T1, one gate at a time and in the background; run T1's reviews
(gentle-ai, then `js-harness codex-review --base <boundary>`); then T2.

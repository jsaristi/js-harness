# Stack v4: adopt gentle-ai 4 and engram 3

Locator: `odd/tasks/stack-v4.md` · Engram mirror: `odd/stack-v4/tasks` · Branch: `feat/stack-v4`

## Goal
This machine runs gentle-ai 4.0.0 and engram 3.0.0 with no leftover of the retired SDD workflow,
and `js-harness doctor` and `js-harness check` see what those releases changed: a hook that calls
a command the binary no longer has, an upgrade that crosses a Go major, and the hooks a plugin
adds to every session.

## Why
The stack moved on 2026-10-01 and the harness sits on top of it. Three things broke silently:
a hook left behind by the upgrade fails on every subagent call, `gentle-ai sync` put the Codex
model back to one the roadmap had replaced, and the engram plugin added per-session hooks the
payload gate cannot see. Each one is a fact a command can check, so it belongs in `bin/`, and the
F5 A/B run needs the `current` arm fixed at these versions before it measures anything.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/stack-v4.md` exits 0
- `node --test bin/lib/stack.test.mjs bin/lib/payload.test.mjs` exits 0
- `node bin/js-harness.mjs doctor` shows gentle-ai 4.0.0 with every column `ok`
- `node bin/js-harness.mjs progress` shows the F2 step "gentle-ai v4 adopted when released" checked
- `gentle-ai sync` leaves `model = "gpt-6.1-sol"` and `model_reasoning_effort = "high"` in
  `~/.codex/config.toml`

## In scope / Out of scope
- In: `bin/lib/stack.mjs`, `bin/lib/payload.mjs` and their tests; `docs/ROADMAP.md`;
  `odd/tasks/f2-context-diet.md`; the machine's gentle-ai, Claude Code and Codex configuration,
  each change recorded below with its undo.
- Out: the eval sandbox (`evals/`), which is T4a of `odd/tasks/evals.md` on `feat/evals`;
  installing or upgrading tools from `doctor` (it reports, it never installs); trimming the
  global `CLAUDE.md` or the Codex `AGENTS.md` by hand (gentle-ai owns those files and the next
  sync would undo it; block exclusion is gentle-ai #4036).

## Constraints
- Zero dependencies and fixture-based tests — because every command must run on any machine with
  no install step, and a test must never read or write the real home.
- `doctor` stays read-only and may run only `gentle-ai help` to learn the binary's commands —
  because probing a hook's own command could execute it.
- Every file changed or moved outside this repo is listed under Machine changes with the exact
  way back — because the predecessor needed four hand-written purge scripts to uninstall.

## Effort
medium

## Ask me before
Filing issues on `Gentleman-Programming/gentle-ai`; deleting (rather than moving) any file under
the home; changing the Codex model to anything other than the roadmap's decision.

## TDD
Mode: strict (source: user global config; v4 makes test-first the default and rejects
`--strict-tdd`). Runner: `node --test`.

## Delivery
Forecast: ~250–350 authored lines (three small `bin/lib` changes with tests, docs). Under the
~400 budget: one PR against `main`. Strategy: `ask-on-risk`.

## What v4 and engram 3 changed (measured 2026-10-01)
- `gentle-ai upgrade` (00:25Z, from 3.7.0) upgraded engram to 3.0.0 and left gentle-ai at 3.7.0:
  v4 lives at Go module path `github.com/gentleman-programming/gentle-ai/v4`, which an upgrade
  from a v3 `go install` cannot reach. Installed with
  `go install github.com/gentleman-programming/gentle-ai/v4/cmd/gentle-ai@v4.0.0` (01:05Z), then
  `gentle-ai sync` (01:06Z): 47 files changed, backup `20261002010604.667221800`.
- v4 retires SDD: the `sdd-*` subcommands are gone and `sync --strict-tdd` is rejected. The
  review contract (`gentle-ai.review-integration/v2`) is unchanged. gentle-ai #4036 is still open.
- The sync does not clean up after the retirement. `~/.claude/settings.json` was not rewritten
  (byte-identical before and after), so `PreToolUse[Agent]` still runs
  `gentle-ai sdd-preflight-hook --agent claude-code`, which now exits 1 with `unknown command`
  on every subagent call. Eleven `sdd-*` skills stay in each of `~/.claude/skills`,
  `~/.codex/skills`, `~/.agents/skills` and `~/.gemini/antigravity-cli/skills`, and eleven
  `sdd-*.md` in `~/.claude/agents`. `gentle-ai doctor` reports "healthy" all the same.
- The sync preserved eight native review agents (`jd-*`, `review-*` in `~/.claude/agents`) as
  "unknown or modified" and asked for a manual merge.
- Payload, from `js-harness check`: Claude 20,651 → 21,104 estimated tokens per turn (global
  `CLAUDE.md` 70,554 → 72,397 bytes). Codex 10,510 → 25,515 (global `AGENTS.md` 27,412 → 87,562
  bytes): v4 gives Codex the full orchestrator, 18.5 KB of delegation rules, 17.9 KB of
  implementation routing and 10.6 KB of review delivery, and repeats the 8 KB engram protocol
  that `model_instructions_file` already carries. v4 is not a diet; for Codex it is 2.4 times
  the payload.
- The Codex model is gentle-ai's to set: `~/.gentle-ai/state.json` holds
  `codexOrchestratorAssignment: { model: "gpt-6-astra", effort: "medium" }` and every sync writes
  it to `~/.codex/config.toml`. Proof: the backup taken by the 00:33:24Z sync has
  `gpt-6.1-sol`/`high`, the one taken by the 00:34:32Z sync has `gpt-6-astra`/`medium`. The
  roadmap's decision (2026-09-29) is `gpt-6.1-sol` at `high`. No Codex review ran in between: the
  last record is 22:18:34Z.
- engram 3.0.0: `mem_update` and `mem_delete` now require `expected_project` (the harness calls
  neither). The sync ran `engram setup claude-code`, which installed the Claude plugin
  `engram@engram` 0.1.5: hooks and one skill, no MCP server. Its SessionStart and first-prompt
  hooks inject context that `check`'s payload rows do not list, because `payload.mjs` reads only
  `settings.json`.

## Tasks
- [x] T1 Adopt: install gentle-ai 4.0.0 and sync (route: inline; evidence above)
- [ ] T2 Machine cleanup, each step recorded with its undo: remove the dead `sdd-preflight-hook`
  hook; move the orphaned `sdd-*` skills and agents out of the Claude and Codex homes; let sync
  refresh the eight preserved review agents after comparing them; set gentle-ai's Codex
  orchestrator assignment to `gpt-6.1-sol`/`high` and prove a sync keeps it (route: inline)
- [ ] T3 `doctor` reports a dead hook: a host hook that runs `gentle-ai <command>` where
  `gentle-ai help` lists no such command makes that host's gentle-ai cell `stale`, with the hook
  and its file in the fix (route: delegated writer)
- [ ] T4 `doctor`'s gentle-ai upgrade fix crosses a major: when the latest release's major is
  above the installed one, the fix is the `go install` line for the new module path followed by
  `gentle-ai sync`, since `gentle-ai upgrade` cannot get there (route: delegated writer)
- [ ] T5 The payload rows list the context hooks of enabled Claude plugins, read from each
  plugin's `hooks/hooks.json` under its install path (route: delegated writer)
- [ ] T6 Roadmap and F2: the v4 step checked with the measured numbers, the stack row and the
  risks brought up to date (route: inline)

## Machine changes
Everything written outside this repo for this feature, and how to undo it.

| When (UTC) | Change | Undo |
|------------|--------|------|
| 2026-10-02 01:05 | `~/go/bin/gentle-ai.exe` 3.7.0 → 4.0.0 | `go install github.com/gentleman-programming/gentle-ai/v3/cmd/gentle-ai@v3.7.0` |
| 2026-10-02 01:06 | `gentle-ai sync`, 47 files in `~/.claude`, `~/.codex`, `~/.agents`, `~/.gemini` | `gentle-ai restore` with backup `20261002010604.667221800` |

## Progress
- 2026-10-01: T1 done; the plan above written from the measurements. Route for T3–T5: one
  delegated writer, one task at a time (each touches a `bin/lib` module and its test; trigger:
  two non-trivial files per task).

## Next step
T2, then T3–T5 with the writer, then T6.

# Roadmap

The one living plan of js-harness: what is decided, what is done, what is next, and which
decisions are still open. Each fact lives in one place:

- **This file** — the plan. What comes next is read here and nowhere else.
- [origin.md](origin.md) — where the plan came from, frozen: the founding pre-plan with the
  reasoning and sources behind it. It is not edited; what changed since is recorded here.
- `odd/tasks/<feature>.md` — one feature's tasks, progress and evidence. Its next step covers
  only that feature.

## Origin

js-harness is the rebuild of an earlier harness (`D:\harness`, now a read-only reference). The
bet: a stronger model needs a smaller harness — little instruction, many executable checks — on
top of gentle-ai (workflow, TDD, review), engram (memory), codegraph (code graph), context7 (docs)
and native `/goal` (autonomy loop). This repo builds only what those leave open.

## Principles

1. **Few instructions, many sensors.** A check that runs costs zero tokens per turn and cannot be forgotten.
2. **Every component must earn its place.** Each new model: remove one piece, measure, keep what still matters.
3. **Do not rebuild the stack.** Workflow, task docs, TDD and review are gentle-ai's; memory is engram's; the code graph is codegraph's; the loop is `/goal`.
4. **Context, not commands.** What the project is, what good looks like, and the reason behind each real constraint.
5. **Portable by default.** `AGENTS.md` is the single source Claude Code, Codex and Antigravity read.
6. **Measure the real payload.** The budget gate counts everything that loads each turn, not only `AGENTS.md`.

## Measured starting point (2026-09-26)

First request of a one-word prompt, estimated tokens:

- Claude Code 2.1.283 in an empty folder: ~107.8k. Tools 77.4k — of which the claude.ai Magnific
  connector alone is 37.3k (150 tools) and nothing in the stack uses it; global `CLAUDE.md` 17.5k
  (the gentle-ai managed block is most of it); environment, MCP instructions and skills list 11k.
  Measured with `--print`, which defers no tools, so the tool figure is an upper bound.
- Codex CLI 0.157.1: ~14.5k of injected context measured (global `AGENTS.md` 7.3k). Through a
  custom provider Codex sent no tools and no base instructions, so this is partial.

## Decided

| Area | Decision |
|------|----------|
| Name, home | `js-harness`, `D:\js-harness`, `github.com/jsaristi/js-harness` (private) |
| Hosts | Claude Code and Codex (CLI + desktop) now; Antigravity later, once its model is worth adopting |
| Stack | gentle-ai (ODD, RDD review, strict TDD), engram v2 binary only, codegraph, context7, `typescript-lsp` plugin; graphify for non-code corpora only |
| Instruction source | `AGENTS.md` only — Claude Code reads it natively |
| Distribution | A zero-dependency npm package with a `js-harness` bin; semver, git tags, releases |
| Release source | Git tags while the repo is private (`<pm> i -g github:jsaristi/js-harness#vX.Y.Z`, latest from `git ls-remote --tags`), using the git credentials already on the machine; npm publish once it is public. A project pins a version, never a source, so the switch changes no `harness.json` (decided 2026-09-26) |
| Commands | `install`, `sync`, `status`, `update`, `upgrade`, `uninstall`, `check`, `doctor`, `init`, and a TUI over the same commands |
| Reversibility | Every file written outside the repo is in a manifest (path + sha256); uninstall is exact |
| Two levels | Installed once per machine (`npm i -g`), like gentle-ai; enabled per project with `js-harness init`, like `git init` |
| Per project | `init` writes a committed `harness.json` that pins the version, a base `AGENTS.md` only if none exists, and the `check` gate in pre-commit, and runs `codegraph init`; `sync` brings the project to its pinned version; raising the pin is an explicit commit, like a lockfile |
| Stack visibility | js-harness sees the whole stack but changes only its own files: it reports each tool as installed, configured and up to date, and prints that tool's own command for any gap; it never installs or configures another tool |
| Notifications | Only on session start or resume, only when something changed since the last notice, and only through channels that cost zero model tokens (see Stack doctor notes) |
| Review | gentle-ai RDD on every candidate; Sebastián pre-grants consent. Codex reviews the same slice after each code commit through the `codex@openai-codex` plugin (`codex-companion.mjs review --wait --base <boundary>`), not its per-turn stop gate. Codex model: `gpt-6-sol` at `xhigh` (`~/.codex/config.toml`), dropping to `high` if the plan's usage runs short; ChatGPT Plus is active and `codex exec -m gpt-6-sol` answered at `xhigh` on 2026-09-27 (it returned 400 on the free plan) |
| Progress view | The plan and each feature doc hold their steps as checkboxes, so progress is computed by a command, not reinterpreted by a model. `js-harness progress` prints the whole checklist in the terminal (and so on Codex); `--json` gives the same data, which Claude Desktop and mobile render as an inline chat widget on request — no published page (decided 2026-09-27) |
| Effort | Claude (Opus 5.5): `medium` by default, `high` for design; the cap is `maxEffortLevel: "high"` in user settings. Codex (`gpt-6-sol`): `xhigh` (see Review) |
| Autonomy | Native `/goal <condition>`, not a loop of our own |
| Context | `autoCompactWindow: 500000`; `/compact` within a task, a fresh session for a new task; state lives in files, not a handoff ritual |

## Phases

What each phase must deliver. Its steps are the checkboxes under [Checklist](#checklist), and
`js-harness progress` counts them; a phase's state is read there, not re-judged from this table.

| Phase | Done when | State |
|-------|-----------|-------|
| F0 Safeguard and baseline | Old repos committed and pushed; per-turn payload measured on Claude and Codex; old folders marked read-only | Done 2026-09-26 |
| F1 Skeleton | `AGENTS.md` ≤ ~1.5k tokens with the prompt audit applied; a dependency-free `check`; pre-commit wired | Done — `AGENTS.md` 691 tokens (`odd/tasks/f1-skeleton.md`) |
| Install and update | `npm run check` and `npm run e2e` pass; the TUI opens with no arguments in a terminal | Done, reviewed, merged to `main` 2026-09-26 via `jsaristi/js-harness#1` (`odd/tasks/install-update.md`) |
| Stack doctor | `js-harness doctor` reports gentle-ai, engram, codegraph, context7 and `typescript-lsp` as installed (with version), configured (per host and per project, read-only) and up to date, or `unknown` when it cannot tell, with each tool's own fix command; results cached 6 h and fail-open offline; a `SessionStart` hook (startup and resume) on Claude Code and Codex notifies through `systemMessage` only when something changed and never writes to stdout; the TUI shows the stack state above the menu; the hook entry is recorded so `uninstall` removes exactly it; tests use fixtures, never the network | Done, reviewed, merged to `main` 2026-09-27 via `jsaristi/js-harness#4`; installed on this machine, hook registered in Claude Code and Codex; the Windows exit crash that install found was fixed via `jsaristi/js-harness#5`, and the global package matches `main` (`js-harness doctor --hook` exits 0, 2026-09-27) (`odd/tasks/stack-doctor.md`) |
| Progress view | The phases in this file carry checkbox steps; `js-harness progress` reads a project's `docs/ROADMAP.md` and `odd/tasks/*.md` and prints every phase and feature with checked and pending steps, percentages and what remains; `--json` returns the same data; tests use fixtures; js-harness uses it on itself first | Done, reviewed, merged to `main` 2026-09-27 via `jsaristi/js-harness#6` (`odd/tasks/progress-view.md`); every later phase is tracked with it |
| F2 Context diet | The budget gate measures the full payload (global `CLAUDE.md` + hooks + `AGENTS.md`); codegraph prompt hook measured with and without; gentle-ai v4 adopted when released; block exclusion via gentle-ai #4036 if it ships | Measurement done, reviewed, merged to `main` 2026-09-28 via `jsaristi/js-harness#7` (`odd/tasks/f2-context-diet.md`); the two remaining steps wait on gentle-ai (v3.7.0 is the latest release and #4036 is open, checked 2026-09-28) |
| Project init | `js-harness init` in a repo writes the per-project files above, all recorded in a project manifest, and `uninstall` there restores the repo exactly; `sync` moves a project to its pinned version; the TUI offers `init`/`sync`/`status` inside a project and `doctor`/`upgrade` outside one; `doctor` reports the Codex plugin, and the Codex review of each approved code slice leaves a record a check verifies (today it depends on the agent remembering, and nothing notices a skip) | — next; F2's measurement now sizes the base `AGENTS.md` (`js-harness check` shows it against the per-turn payload); first verify that a git-spec global install works through the pnpm shim |
| F3 Task contract | The contract template in [origin.md](origin.md#task-contract-template) + a validator that rejects a contract without a done-when command + fit with the ODD feature doc and `/goal` | — |
| F4 Sensors | Tests, lint/LSP diagnostics, budget and RDD-by-risk wired to pre-commit and `check` | — |
| F5 Evals that discriminate | Tasks hard enough to separate configs (0 of 32 did at the start); A/B minimal vs current config at medium and high | — needs Sebastián's spend approval |
| F6 Codex parity | The eval tasks run on Codex; differences measured and written down | — |
| F7 Future-model protocol | A written procedure: measure payload, run evals, strip one component at a time | — |

## Checklist

### F0 Safeguard and baseline
- [x] Old repos committed and pushed
- [x] Per-turn payload measured on Claude Code and Codex
- [x] Old folders marked read-only

### F1 Skeleton
- [x] `AGENTS.md` within ~1.5k tokens with the prompt audit applied
- [x] A dependency-free `check`
- [x] Pre-commit runs `check`

### Install and update
- [x] `npm run check` and `npm run e2e` pass
- [x] The TUI opens with no arguments in a terminal
- [x] Reviewed and merged (`jsaristi/js-harness#1`)

### Stack doctor
- [x] `doctor` reports the five tools as installed, configured and up to date, with fix commands
- [x] 6 h cache, fail-open offline
- [x] `SessionStart` hook on Claude Code and Codex, `systemMessage` only on change
- [x] Hook entry recorded so `uninstall` removes exactly it
- [x] TUI stack block above the menu
- [x] Reviewed and merged (`jsaristi/js-harness#4`, Windows exit fix `#5`)
- [x] Installed on this machine; global package matches `main`

### Progress view
- [x] Parser for roadmap phases and feature docs
- [x] `progress` and `progress --json`
- [x] Review follow-ups (fences, bad input, unknown flags)
- [x] The roadmap carries checkbox steps and `progress` runs on this repo
- [x] Reviewed and merged (`jsaristi/js-harness#6`)

### F2 Context diet
- [x] The budget gate measures the full payload (global `CLAUDE.md` + hooks + `AGENTS.md`)
- [x] codegraph prompt hook measured with and without
- [ ] gentle-ai v4 adopted when released
- [ ] Block exclusion via gentle-ai #4036, if it ships

### Project init
- [ ] A git-spec global install works through the pnpm shim
- [ ] `init` writes `harness.json`, a base `AGENTS.md` if none exists, the pre-commit gate, and runs `codegraph init`, all recorded in a project manifest
- [ ] `uninstall` in a project restores it exactly
- [ ] `sync` moves a project to its pinned version
- [ ] The TUI offers `init`/`sync`/`status` inside a project and `doctor`/`upgrade` outside one
- [ ] `doctor` reports the Codex plugin (`codex@openai-codex`): installed, enabled and logged in, with its fix command
- [ ] The Codex review of each approved code slice leaves a record a check verifies, so a skipped review is caught

### F3 Task contract
- [ ] Contract template from origin.md
- [ ] Validator rejects a contract without a done-when command
- [ ] Fits the ODD feature doc and `/goal`

### F4 Sensors
- [ ] Tests wired to pre-commit and `check`
- [ ] Lint/LSP diagnostics wired
- [ ] Budget wired
- [ ] RDD-by-risk wired

### F5 Evals that discriminate
- [ ] Spend approved by Sebastián
- [ ] Tasks hard enough to separate configs
- [ ] A/B minimal vs current config at medium and high

### F6 Codex parity
- [ ] The eval tasks run on Codex
- [ ] Differences measured and written down

### F7 Future-model protocol
- [ ] Written procedure: measure payload, run evals, strip one component at a time

## Next

1. Project init.
2. F2's last two steps, when gentle-ai ships v4 or #4036; open decision 5 (the codegraph hook)
   can be taken at any time.

## Stack doctor notes

Evidence gathered 2026-09-26 for the design:

- gentle-ai 3.7.0 checks itself, engram and two more tools against the GitHub releases API, at
  most once every 6 h (`~/.gentle-ai/state.json`), 5 s timeout, fail-open; it shows the result
  only when its TUI opens, and it does not check whether MCP servers are registered in a host.
  Its own skills and agents ship inside its binary and are reconciled by `gentle-ai sync`
  (`internal/update/registry.go`, `cooldown.go`, `github.go` in Gentleman-Programming/gentle-ai).
- Claude Code `SessionStart` fires on `startup` and `resume` (also `--continue`). A hook's
  `systemMessage` is shown to the user and not added to the model's context; plain stdout on
  `SessionStart` is added to it and costs tokens. Hooks can run `async`. A command status line
  costs no tokens and can refresh on an interval ([hooks](https://code.claude.com/docs/en/hooks.md),
  [status line](https://code.claude.com/docs/en/statusline.md)).
- Codex has `SessionStart` with `systemMessage` too, but no command-backed status line, so on
  Codex the notice arrives only on start or resume ([hooks](https://learn.chatgpt.com/docs/hooks)).

Resolved while building (details in `odd/tasks/stack-doctor.md`):

- The manifest now records entries as well as whole files: one hook entry inside
  `~/.claude/settings.json` and `~/.codex/hooks.json`, removed exactly on uninstall, never
  overwriting a value of unexpected shape, and preserving the file's indent and line endings.
- `ccstatusline` 2.2.30 ships a `custom-command` widget, so a zero-token status-line indicator is
  possible; left for later. Codex 0.157.1 has hooks on by default (`codex features list`), but a
  new hook command may need a one-time trust prompt — unverified live.

## Open decisions (Sebastián's, asked one at a time)

1. Disconnecting the unused Magnific connector (the largest single per-turn item).
2. Permission mode: currently `bypassPermissions`; the documented alternative is auto mode. He changes it himself.
3. Whether the Gentleman persona stays part of the stack.
4. Spend ceiling for F5.
5. The codegraph `UserPromptSubmit` hook: keep, narrow or drop it. Replaying this project's 55
   real prompts, it fired on 33; 16 of those injected a full ~4k-token code exploration, often
   for prompts with no code intent — ~1.2k tokens per prompt on average, kept in the history
   (evidence in `odd/tasks/f2-context-diet.md`, T3). It is codegraph's config, so js-harness
   only reports it.

## Risks

- gentle-ai v4 may change formats mid-way.
- gentle-ai #4036 may never ship, leaving the largest block uncontrollable.
- Opus 5.5 defaults may shift after launch.
- Discriminating evals cost money.

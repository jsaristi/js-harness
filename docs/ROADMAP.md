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
| Stack | gentle-ai 4 (ODD, RDD review, test-first by default), engram 3 (the binary, and its Claude plugin since `gentle-ai sync` installs it: hooks and one skill, no second MCP server), codegraph, context7, `typescript-lsp` plugin; graphify for non-code corpora only |
| Instruction source | `AGENTS.md` only — Claude Code reads it natively |
| Distribution | A zero-dependency npm package with a `js-harness` bin; semver, git tags, releases |
| Release source | Git tags while the repo is private (`<pm> i -g github:jsaristi/js-harness#vX.Y.Z`, latest from `git ls-remote --tags`), using the git credentials already on the machine; npm publish once it is public. A project pins a version, never a source, so the switch changes no `harness.json` (decided 2026-09-26) |
| Commands | `install`, `sync`, `status`, `update`, `upgrade`, `uninstall`, `check`, `doctor`, `init`, `codex-review` (2026-09-29, T7), `contract` (2026-09-29, F3), `remote` (2026-10-04), and a TUI over the same commands |
| Task contract | The contract is the head of the ODD feature document, not a second file: a feature doc with `## Goal` is a contract, with the sections of [origin.md](origin.md#task-contract-template). Its done-when commands are list items that open with a code span and say `exits 0`. `js-harness contract check` validates it and the `check` row `contracts` does so statically, never running a command; `contract run` runs them and prints `met` or `not met`; `contract goal` prints the `/goal` condition, which is `contract run` on the absolute path, so the evaluator judges command output, not prose. Closed feature docs are not retrofitted (2026-09-29, `odd/tasks/task-contract.md`) |
| Sensors | `check`, and so every pre-commit it guards, runs a project's own sensors: named commands that must exit 0, from `harness.json` `sensors` (any language; an empty map is a named opt-out) or else `package.json`'s `test`, `lint` and `typecheck` scripts through `npm run`, each a row, under a throwaway home and npm cache. A `review` row shows gentle-ai's risk tier for the pending change and whether review is due; it is INFO and fail-open, never a gate, because RDD is Sebastián's switch. This repo declares no lint or typecheck: one would need a dev dependency (2026-09-30, `odd/tasks/sensors.md`) |
| Reversibility | Every file written outside the repo is in a manifest (path + sha256); uninstall is exact |
| Two levels | Installed once per machine (`npm i -g`), like gentle-ai; enabled per project with `js-harness init`, like `git init` |
| Command scope | A command that exists at both levels acts by location, like npm: inside an initialized project (a git repo with `harness.json` or a project manifest) it acts on the project, anywhere else on the machine; `--global` forces the machine from anywhere. Inside a git repository that is not an initialized project, or with an explicit `--cwd` that is not one, the command refuses and names `--global`, so repeating it never reaches the machine by accident. `uninstall` first, `sync` next (decided 2026-09-28) |
| Per project | `init` writes a committed `harness.json` that pins the version, a base `AGENTS.md` only if none exists, and the `check` gate in pre-commit, and runs `codegraph init`; `sync` brings the project to its pinned version; raising the pin is an explicit commit, like a lockfile. When the running js-harness differs from the pin, a project `sync` writes nothing and names both ways out: the command that installs the pinned version, or the commit that raises the pin; it never changes the machine from inside a project (decided 2026-09-28) |
| Stack visibility | js-harness sees the whole stack but changes only its own files: it reports each tool as installed, configured and up to date, and prints that tool's own command for any gap; it never installs or configures another tool |
| Notifications | Only on session start or resume, only when something changed since the last notice, and only through channels that cost zero model tokens (see Stack doctor notes) |
| Review | gentle-ai RDD on every candidate; Sebastián pre-grants consent. Codex reviews the same slice after each code commit: `js-harness codex-review --base <boundary>` runs `codex exec review` and records the review only on evidence that Codex read the diff, every changed line of the branch's patch in the output of its successful commands (2026-09-29, `odd/tasks/codex-exec-review.md`), or records an explicit `--unavailable` skip, under the git common dir; the pre-push hook runs `check --push`, which refuses a branch with a code commit no record covers (2026-09-29). Not the plugin's per-turn stop gate. The review runs in the lean session by default (2026-10-08, `odd/tasks/codex-review-lean.md`): it loads the diff, read access to the repository, the project's `AGENTS.md` and Codex's own review rubric, and leaves out the user's Codex configuration (global instructions, skills, plugins, MCP servers, hooks); a large range is reviewed in parts; `--session current` runs it on the user's own configuration instead. Review model: `gpt-6.1-sol` at `medium`, fixed by the command (Sebastián, 2026-10-06), so no `gentle-ai sync` changes it; the decision before it was `gpt-6.1-sol` at `high` (2026-09-29), kept in `~/.codex/config.toml`, which every `gentle-ai sync` rewrites from `codexOrchestratorAssignment` (`~/.gentle-ai/state.json`) and which `--session current` still reads |
| Progress view | The plan and each feature doc hold their steps as checkboxes, so progress is computed by a command, not reinterpreted by a model. `js-harness progress` prints the whole checklist in the terminal (and so on Codex); `--json` gives the same data, which Claude Desktop and mobile render as an inline chat widget on request — no published page (decided 2026-09-27) |
| Eval spend | No USD ceiling for F5 (Sebastián, 2026-09-30). Runs use the flat-rate subscription, so the limits are tokens, wall time and the plan's usage cap; the runner records the first two per trial and stops cleanly on the third (`odd/tasks/evals.md`) |
| Eval verdict | Per task and effort, score is the floor and cost decides between equals: scores are equal when their gap is within max(0.02, pooled SD); unequal scores make the higher one win; equal scores with a cost gap above the pooled cost SD make the cheaper config win; anything else is `none`. Cost is Claude Code's `total_cost_usd`, the list cost of the whole session, subagents included. The predecessor's score-only rule is printed beside it (Sebastián, 2026-10-02; `odd/tasks/evals.md`, Constraints) |
| Effort | Claude (Opus 5.5): `medium` by default, `high` for design; the cap is `maxEffortLevel: "high"` in user settings. Codex review (`gpt-6.1-sol`): `medium`, fixed by the command (see Review) |
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
| F2 Context diet | The budget gate measures the full payload (global `CLAUDE.md` + hooks + `AGENTS.md`); codegraph prompt hook measured with and without; gentle-ai v4 adopted when released; block exclusion via gentle-ai #4036 if it ships | Measurement done, reviewed, merged to `main` 2026-09-28 via `jsaristi/js-harness#7` (`odd/tasks/f2-context-diet.md`); gentle-ai 4.0.0 adopted 2026-10-01, merged to `main` 2026-10-03 via `jsaristi/js-harness#25` (`odd/tasks/stack-v4.md`), and it is not a diet: Claude went from 20,651 to 21,104 estimated tokens per turn and Codex from 10,510 to 25,515, since v4 gives Codex the full orchestrator; the last step waits on gentle-ai (#4036 is open, checked 2026-10-01) |
| Project init | `js-harness init` in a repo writes the per-project files above, all recorded in a project manifest, and `uninstall` there restores the repo exactly; `sync` moves a project to its pinned version; the TUI offers `init`/`sync`/`status` inside a project, above the machine commands (Sebastián, 2026-09-29), and the machine commands outside one; `doctor` reports the Codex plugin, and the Codex review of each approved code slice leaves a record a check verifies (today it depends on the agent remembering, and nothing notices a skip) | Done 2026-09-29 (`odd/tasks/project-init.md`), seven slices stacked to `main`: the git-spec install through the pnpm shim works since `jsaristi/js-harness#8` (the package no longer runs `prepare`); `init` merged via `jsaristi/js-harness#9`; project `uninstall`, with `init`'s review follow-ups, merged via `jsaristi/js-harness#10` (2026-09-29); project `sync` by location merged via `jsaristi/js-harness#11` (2026-09-29); the TUI by location merged via `jsaristi/js-harness#12` (2026-09-29); the Codex plugin in `doctor` merged via `jsaristi/js-harness#13` (2026-09-29); the verifiable Codex review record (`js-harness codex-review` and the pre-push `check --push`) merged via `jsaristi/js-harness#14` (2026-09-29). Its follow-ups are carried in the feature document |
| F3 Task contract | The contract template in [origin.md](origin.md#task-contract-template) + a validator that rejects a contract without a done-when command + fit with the ODD feature doc and `/goal` | Done, reviewed, merged to `main` 2026-09-30 via `jsaristi/js-harness#16` (`odd/tasks/task-contract.md`); its follow-ups are carried in the feature document |
| F4 Sensors | Tests, lint/LSP diagnostics, budget and RDD-by-risk wired to pre-commit and `check` | Done, reviewed, merged to `main` 2026-09-30 in two slices via `jsaristi/js-harness#17` (sensors) and `jsaristi/js-harness#18` (the review row and a sensor timeout that kills the process tree) (`odd/tasks/sensors.md`); its follow-ups are carried in the feature document |
| F5 Evals that discriminate | Tasks hard enough to separate configs (0 of 32 did at the start); A/B minimal vs current config at medium and high | Done, reviewed, merged to `main` 2026-10-03 in four slices via `jsaristi/js-harness#20` (runner, sandbox, isolation proof), `jsaristi/js-harness#21` (the five tasks), `jsaristi/js-harness#22` (engram isolation, safe process-tree kills, the suite entry) and `jsaristi/js-harness#23` (runs, report, result) (`odd/tasks/evals.md`): the minimal config matches the current one on score and costs about half; see [F5 result](#f5-result). Its follow-ups are carried in the feature document |
| Remote sessions | `js-harness remote start` keeps Claude Code's remote-control server alive in a git repository, so a session opened from the phone runs on this PC; `stop` leaves no process of it; `--at-login` brings it back after a restart, through a launcher that `uninstall` removes exactly; `doctor` says when the CLI and the desktop app are signed into different accounts, and when a launcher's server is down; a scheduled task brings back a server that died, never one stopped on purpose; the log is capped at 5 MB; the TUI offers the three commands inside a repository | Written, reviewed and merged on 2026-10-04, in three slices stacked to `main` (`odd/tasks/remote-control.md`): the supervisor and the three commands (`jsaristi/js-harness#28`), the login launcher with the TUI entry (`jsaristi/js-harness#29`) and the account check (`jsaristi/js-harness#30`). The live check passed the same day: after `remote stop` and `remote start` a session opened from the iOS app ran in `D:\js-harness`, and the final `remote stop` left no process. Reopened on 2026-10-06 (branch `fix/remote-watchdog`): the supervisor had been killed from outside and stayed down twelve hours, and the log had reached 71 MB. The log cap, the watchdog task and the `doctor` row are written and reviewed, and merged on 2026-10-06 as three pull requests stacked to `main` (`jsaristi/js-harness#35`, `#36`, `#37`); not yet live on this machine |
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
- [x] gentle-ai v4 adopted when released
- [ ] Block exclusion via gentle-ai #4036, if it ships

### Project init
- [x] A git-spec global install works through the pnpm shim
- [x] `init` writes `harness.json`, a base `AGENTS.md` if none exists, the pre-commit gate, and runs `codegraph init`, all recorded in a project manifest
- [x] `uninstall` in a project restores it exactly
- [x] `sync` moves a project to its pinned version
- [x] The TUI offers `init`/`sync`/`status` inside a project, above the machine commands, and the machine commands outside one
- [x] `doctor` reports the Codex plugin (`codex@openai-codex`): installed, enabled and logged in, with its fix command
- [x] The Codex review of each approved code slice leaves a record a check verifies, so a skipped review is caught

### F3 Task contract
- [x] Contract template from origin.md
- [x] Validator rejects a contract without a done-when command
- [x] Fits the ODD feature doc and `/goal`

### F4 Sensors
- [x] Tests wired to pre-commit and `check`
- [x] Lint/LSP diagnostics wired
- [x] Budget wired
- [x] RDD-by-risk wired

### F5 Evals that discriminate
- [x] Spend approved by Sebastián
- [x] Tasks that separate the configs under the eval verdict rule
- [x] A/B minimal vs current config at medium and high

### Remote sessions
- [x] Supervisor and `remote start`, `stop`, `status`
- [x] Login launcher, recorded so `uninstall` removes it, and the TUI entry
- [x] `doctor` account check
- [x] Live check on this machine: a session opened from the phone after `remote stop` and `remote start`
- [x] Reviewed and merged (three slices)
- [x] Log cap, watchdog task and the `doctor` row for a server that is down
- [x] The watchdog branch reviewed and merged
- [x] Live on this machine: the server restarted on the new code, and `remote start --at-login` registering the watchdog

### F6 Codex parity
- [ ] The eval tasks run on Codex
- [ ] Differences measured and written down

### F7 Future-model protocol
- [ ] Written procedure: measure payload, run evals, strip one component at a time

## F5 result

Five tasks, three trials per config and effort, Opus 5.5 under `bypassPermissions`, Claude Code
2.1.284 with gentle-ai 4.0.0 and engram 3.0.0 (`node evals/report.mjs` over
`evals/results/headroom.json`, `headroom-current.json` and `ab-high.json`). Score is the
mean with its range when the trials differ; cost is the mean list cost of one session; tokens
are input (cache included) plus output over every model of the session; wall time is the mean.

| Task | Effort | Score minimal / current | Cost minimal / current | Ratio | Tokens minimal / current | Wall minimal / current | Verdict |
|------|--------|------|------|------|------|------|------|
| format-v2 | medium | 0.99 (0.98–1.00) / 0.99 (0.98–1.00) | $1.38 / $2.50 | 1.81× | 1.09M / 3.43M | 4m55s / 7m24s | cost: minimal |
| house-rules | medium | 0.98 / 0.98 | $0.40 / $1.01 | 2.54× | 313k / 1.04M | 1m17s / 2m20s | cost: minimal |
| lost-updates | medium | 1.00 / 1.00 | $0.52 / $1.03 | 2.00× | 342k / 968k | 2m19s / 2m55s | cost: minimal |
| resolver | medium | 1.00 / 1.00 | $0.41 / $1.01 | 2.44× | 195k / 824k | 1m40s / 2m52s | cost: minimal |
| spec-drift | medium | 0.99 (0.98–1.00) / 1.00 | $0.54 / $1.21 | 2.25× | 385k / 1.15M | 1m44s / 3m01s | cost: minimal |
| format-v2 | high | 1.00 / 1.00 | $1.67 / $3.53 | 2.11× | 1.17M / 4.37M | 6m24s / 10m40s | cost: minimal |
| house-rules | high | 0.98 / 0.98 | $0.47 / $0.89 | 1.92× | 344k / 902k | 1m35s / 2m00s | cost: minimal |
| lost-updates | high | 1.00 / 0.99 (0.98–1.00) | $0.72 / $1.73 | 2.42× | 466k / 2.15M | 3m02s / 5m35s | cost: minimal |
| resolver | high | 1.00 / 1.00 | $0.60 / $1.32 | 2.20× | 290k / 1.11M | 2m27s / 4m09s | cost: minimal |
| spec-drift | high | 1.00 / 1.00 | $0.86 / $1.45 | 1.68× | 518k / 1.43M | 2m57s / 4m04s | cost: minimal |

All ten cells reach the score ceiling with both configs, and the minimal config wins every one
on cost: the current stack costs 1.68× to 2.54× as much, $47.07 against $22.71 over 30 trials
each, and takes longer on every task. The predecessor's score-only rule separates one cell,
spec-drift at medium, by 0.01. Read plainly: on tasks like these the stack's context and
workflow add cost without adding score; what it may buy (recall across sessions, review, larger
work) these tasks do not measure.

## Codex review result

Two ways of running `js-harness codex-review`, compared on 2026-10-08 with Codex CLI 0.161.0
(`node evals/review/report.mjs` over `evals/results/review/readings/`, written to
`evals/results/review/report.md`; the runs and what each proved are in
`odd/tasks/codex-review-lean.md`). `current` is the review on the user's whole Codex
configuration, measured in a copy of his home; `lean` loads the diff, read access to the
repository, the project's `AGENTS.md` and Codex's review rubric. Two ranges: a diff of 292
changed lines seeded with seven known defects, and a real range of this repository, 255
changed lines with no known defect. Input tokens are the sum over the requests of a review,
cache included; the first request is what the session loads before it reads the diff.

| Range | Configuration | Ran with | Findings | Seeded found | Input tokens | First request | Wall time |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| seeded | `current` | `gpt-6-astra` `low` | 6 | 6 of 7 | 151,204 | 27,912 | 79 s |
| seeded | `lean` | `gpt-6.1-sol` `medium` | 7 | 7 of 7 | 54,797 | 5,717 | 60 s |
| seeded | `lean`, own prompt | `gpt-6.1-sol` `medium` | 7 | 7 of 7 | 55,203 | 6,156 | 61 s |
| seeded | `lean`, high effort | `gpt-6.1-sol` `high` | 8 | 7 of 7 | 57,161 | 5,726 | 87 s |
| real | `current` | `gpt-6-astra` `low` | 0 | | 228,539 | 28,936 | 47 s |
| real | `lean` | `gpt-6.1-sol` `medium` | 0 | | 134,283 | 6,711 | 33 s |
| real | `lean`, own prompt | `gpt-6.1-sol` `medium` | 0 | | 145,842 | 7,063 | 34 s |
| real | `lean`, high effort | `gpt-6.1-sol` `high` | 0 | | 374,661 | 6,711 | 92 s |
| real | `lean` with CodeGraph | `gpt-6.1-sol` `medium` | 0 | | 160,383 | 7,491 | 30 s |

The verdict: `lean` found the same or more with fewer tokens on both ranges, 36% of the input
of `current` on the seeded range and 59% on the real one, so it is what `codex-review` runs by
default since 2026-10-08; `--session current` stays. What it rests on, read plainly: on the
seeded range two runs of `current`, which missed the same defect both times (the first run,
156,564 input tokens, is in the history of `9c9b00d`), and three lean runs that found it; on
the real range one run a cell. `lean` and `current` differ in three things at once, what the
session loads, the model and the effort, so the defect found cannot be given to one of them.
The first request can: about 28,000 tokens against 6,000 to 7,500 is the load. High effort
bought nothing these ranges measure, one more finding outside the key and the same answer for
2.8 times the input on the real range. The own prompt costs what Codex's sentence costs and
found the same, so the default prompt stays Codex's. CodeGraph cost 19% more input for the
same answer on a range with nothing to find, so it stays out. The model of the lean rows was
measured in the CodeGraph cell; the other lean readings were taken before the reading
recorded it and carry what the command passed.

## Next

1. F6 Codex parity, in progress (`odd/tasks/codex-parity.md`, branch `feat/codex-parity`, in the
   linked worktree `D:\js-harness-worktrees\codex-parity`). Sebastián approved its plan and a
   staged spend on 2026-10-03: 2 smoke trials, then 15, then his go-ahead for the other 45.
   Remote sessions, which he put before it that day, closed on 2026-10-04
   (`odd/tasks/remote-control.md`). The branch was brought up to `main` on 2026-10-04, so it
   holds the gate fix (`a3a1eb1`) without which a commit from a linked worktree can turn this
   repository bare. Slice 1 of 3 merged on 2026-10-05 (#33): one isolated Codex trial per arm,
   proven on the real binary, and the two smoke trials spent
   (`evals/proofs/codex-isolation.md`). Slice 2, the suite and the report (T4, T5), is complete
   and reviewed, and open as pull request #34 since 2026-10-05: `node evals/suite.mjs --agent codex`
   runs the matrix, and `node evals/report.mjs --codex-results-dir evals/results/codex` sets the
   two hosts side by side, with a Codex trial's cost estimated at the list price of its model.
   The next spend is the 15 trials of T6, which wait on a refreshed Codex login: the real one
   is dated 2026-09-27 and the suite refuses one older than 186 h.
2. Remote sessions, reopened on 2026-10-06 (`odd/tasks/remote-control.md`, branch
   merged to `main` on 2026-10-06 as #35, #36 and #37): the log cap, the watchdog task and the
   `doctor` row are written, reviewed and merged, and live on this machine since 2026-10-06
   18:29 UTC, on Sebastián's word: `D:\js-harness` was brought up to `main`, the server was
   restarted on the new code and `js-harness remote start --at-login` registered the watchdog
   task. The log went from 79 MB to 1.1 MB, and the task has run every five minutes since with
   result 0 and the server up. Not yet seen: the task bringing back a server that died.
3. F4's follow-ups (`odd/tasks/sensors.md`), when one earns a slice; the orphaned processes of a
   timed-out `contract run` command are the most concrete. `odd/tasks/stack-v4.md` adds one of
   the same family: two full gates at once are not safe on this host.
4. F2's last step, when gentle-ai ships #4036; open decision 4 (the codegraph hook) can be
   taken at any time.
5. Codex review, lean and measured, opened on 2026-10-06 while F6 is paused
   (`odd/tasks/codex-review-lean.md`, branch `feat/codex-review-lean`, in the linked worktree
   `D:\js-harness-worktrees\codex-review-lean`): `js-harness codex-review` measures every
   attempt and runs in a session that loads only what a review needs, on `gpt-6.1-sol` at
   `medium` (Sebastián, 2026-10-06). The comparison of the two configurations decided the
   switch: that session is the default since 2026-10-08, and the Review and Effort rows above
   say what runs now. The numbers are in "Codex review result" above. Left for Sebastián: the
   proposal for the Codex plugin, in the feature document (the `doctor` row, `codex:rescue`,
   its three hooks), and the Codex review of the branch's own code before a push.
6. Session signals, asked by Sebastián on 2026-10-07 and not started: he runs several sessions
   from the phone and wants three things said by the harness itself rather than remembered by
   the agent. Whose turn it is in every reply: a prompt for him only when the work waits on
   him, and a plain "nothing to send" when the agent goes on by itself (he could not tell the
   two apart and sent stale prompts twice). A notice when a session finishes, saying which
   session to return to. And the context window watched, with its percentage reported and a
   cut proposed before auto-compact (this session reached 77% of 500k unnoticed). A feature of
   its own, in its own session: what a hook, the status line or `js-harness` can check or
   print, so the prose can shrink.

   The format of the first is decided (Sebastián, 2026-10-07, "usá ese formato y cementalo en
   el harness"), after a block worded as an instruction ("run the lean review on Codex
   0.160.1") was read three times as a task for him to do in Codex. Every reply closes with
   one state of four:
   - working: he sends nothing; the reply says what wakes the agent and what it reports next.
     No block.
   - decision: the work waits on him. One block.
   - cut: a compact (two numbered blocks, the bare `/compact` and the resume prompt) or a new
     session.
   - finished: the session closed; the reply names the session he returns to. No block.

   A block sits under three fixed lines: what it is (for example "leave to spend one Codex
   review"), where it is sent (this chat) and what sending it does (the agent runs it; he
   runs nothing). The text of a decision is his answer in his words, as short as "Sí", never
   a technical instruction; the question, with its cost, goes above it in plain words. The
   resume prompt of a cut is the one long text, labelled as text to paste, not to understand.
   A decision is never asked while work still runs: the agent waits for it to end. A decision
   asked again says first that the earlier answer still holds and what changed.

   Narrowed by Sebastián on 2026-10-08 ("si el siguiente prompt es sí, seguí trabajando; solo
   pará si es una decisión que debo tomar"), when the nine Codex reviews of a comparison were
   put to him with a block that held only "Sí": a step already in the plan, whose only answer
   would be yes, is not a decision. The agent states it, with its cost, and goes on. A
   decision is a real choice between ways, something outside the plan, or something that
   cannot be undone. The agent's reading, his to correct: push, pull request and merge still
   wait for him, as does spend the plan did not name.

   Where it lives today: `AGENTS.md`, "Working with Sebastián", reworded to the four states on
   `feat/codex-review-lean` (1,499 of 1,500 tokens after the rule of 2026-10-08, so the next one added needs one removed),
   and the agent's memory. It reaches the other worktrees when that branch merges. Still to
   build in this feature: a check that refuses a reply that closes with none of the four
   states, so the rule stops depending on the agent reading prose.

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
4. The codegraph `UserPromptSubmit` hook: keep, narrow or drop it. Replaying this project's 55
   real prompts, it fired on 33; 16 of those injected a full ~4k-token code exploration, often
   for prompts with no code intent — ~1.2k tokens per prompt on average, kept in the history
   (evidence in `odd/tasks/f2-context-diet.md`, T3). It is codegraph's config, so js-harness
   only reports it.

Closed: the F5 spend ceiling (none; see Decided, Eval spend).

## Risks

- A stack release changes the machine under a running feature. gentle-ai 4 and engram 3 did on
  2026-10-01: a hook left calling a removed command, the Codex model reset by a sync, and plugin
  hooks that reach the engram server past the eval sandbox (`odd/tasks/stack-v4.md`,
  `odd/tasks/evals.md` T4a). `doctor` and `check` now report the first and the last; an eval
  run fixes the stack's versions for its whole length.
- gentle-ai #4036 may never ship, leaving the largest block uncontrollable; v4 made that block 2.4 times larger for Codex (87,562 bytes of global `AGENTS.md`), which F6 will measure.
- Opus 5.5 defaults may shift after launch.
- Discriminating evals cost money.

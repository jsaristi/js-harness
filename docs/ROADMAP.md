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
| Commands | `install`, `sync`, `status`, `update`, `upgrade`, `uninstall`, `check`, `doctor`, `init`, `codex-review` (2026-09-29, T7), `contract` (2026-09-29, F3), `remote` (2026-10-04), `sessions` (2026-10-06, read-only, no TUI entry), and a TUI over the same commands |
| Task contract | The contract is the head of the ODD feature document, not a second file: a feature doc with `## Goal` is a contract, with the sections of [origin.md](origin.md#task-contract-template). Its done-when commands are list items that open with a code span and say `exits 0`. `js-harness contract check` validates it and the `check` row `contracts` does so statically, never running a command; `contract run` runs them and prints `met` or `not met`; `contract goal` prints the `/goal` condition, which is `contract run` on the absolute path, so the evaluator judges command output, not prose. Closed feature docs are not retrofitted (2026-09-29, `odd/tasks/task-contract.md`) |
| Sensors | `check`, and so every pre-commit it guards, runs a project's own sensors: named commands that must exit 0, from `harness.json` `sensors` (any language; an empty map is a named opt-out) or else `package.json`'s `test`, `lint` and `typecheck` scripts through `npm run`, each a row, under a throwaway home and npm cache. A `review` row shows gentle-ai's risk tier for the pending change and whether review is due; it is INFO and fail-open, never a gate, because RDD is Sebastián's switch. This repo declares no lint or typecheck: one would need a dev dependency (2026-09-30, `odd/tasks/sensors.md`) |
| Reversibility | Every file written outside the repo is in a manifest (path + sha256); uninstall is exact |
| Two levels | Installed once per machine (`npm i -g`), like gentle-ai; enabled per project with `js-harness init`, like `git init` |
| Command scope | A command that exists at both levels acts by location, like npm: inside an initialized project (a git repo with `harness.json` or a project manifest) it acts on the project, anywhere else on the machine; `--global` forces the machine from anywhere. Inside a git repository that is not an initialized project, or with an explicit `--cwd` that is not one, the command refuses and names `--global`, so repeating it never reaches the machine by accident. `uninstall` first, `sync` next (decided 2026-09-28) |
| Per project | `init` writes a committed `harness.json` that pins the version, a base `AGENTS.md` only if none exists, and the `check` gate in pre-commit, and runs `codegraph init`; `sync` brings the project to its pinned version; raising the pin is an explicit commit, like a lockfile. When the running js-harness differs from the pin, a project `sync` writes nothing and names both ways out: the command that installs the pinned version, or the commit that raises the pin; it never changes the machine from inside a project (decided 2026-09-28) |
| Stack visibility | js-harness sees the whole stack but changes only its own files: it reports each tool as installed, configured and up to date, and prints that tool's own command for any gap; it never installs or configures another tool |
| Notifications | Only on session start or resume, only when something changed since the last notice, and only through channels that cost zero model tokens (see Stack doctor notes) |
| Review | gentle-ai RDD on every candidate; Sebastián pre-grants consent. Codex reviews the same slice after each code commit: `js-harness codex-review --base <boundary>` runs `codex exec review` and records the review only on evidence that Codex read the diff, every changed line of the branch's patch in the output of its successful commands (2026-09-29, `odd/tasks/codex-exec-review.md`), or records an explicit `--unavailable` skip, under the git common dir; the pre-push hook runs `check --push`, which refuses a branch with a code commit no record covers (2026-09-29). Not the plugin's per-turn stop gate. The review runs in one session, the lean one (2026-10-08, `odd/tasks/codex-review-lean.md`): it loads the diff, read access to the repository, the project's `AGENTS.md` and Codex's own review rubric, and leaves out the user's Codex configuration (global instructions, skills, plugins, MCP servers, hooks); a large range is reviewed in parts. `--session current`, which loaded the user's own configuration instead, was removed on 2026-10-08 because the model it ran on could not be verified (until that day it ran on whatever `~/.codex/config.toml` named); a machine where the lean session cannot run records an `--unavailable` skip. Review model: `gpt-6.1-sol` at `high`, fixed by the command (Sebastián, 2026-10-08, `odd/tasks/codex-review-cost.md`), so neither a `gentle-ai sync` nor `~/.codex/config.toml` changes it, and a review whose session ran on anything else, as its own rollout file says, does not stand. It replaces the `medium` he fixed for the lean session on 2026-10-06. Since 2026-10-08 a review reads only code (not Markdown, not the paths a project marks `-codex-review` in `.gitattributes`), starts where the review records end and starts nothing over a range they cover whole (`--again` reviews it on purpose), prints its plan and an estimate before it spends (`--plan` prints them and starts nothing), and refuses more than 6 parts without `--max-parts`; `check` says at every commit how much code waits for a review |
| Progress view | The plan and each feature doc hold their steps as checkboxes, so progress is computed by a command, not reinterpreted by a model. `js-harness progress` prints the whole checklist in the terminal (and so on Codex); `--json` gives the same data, which Claude Desktop and mobile render as an inline chat widget on request — no published page (decided 2026-09-27) |
| Eval spend | No USD ceiling for F5 (Sebastián, 2026-09-30). Runs use the flat-rate subscription, so the limits are tokens, wall time and the plan's usage cap; the runner records the first two per trial and stops cleanly on the third (`odd/tasks/evals.md`) |
| Eval verdict | Per task and effort, score is the floor and cost decides between equals: scores are equal when their gap is within max(0.02, pooled SD); unequal scores make the higher one win; equal scores with a cost gap above the pooled cost SD make the cheaper config win; anything else is `none`. Cost is Claude Code's `total_cost_usd`, the list cost of the whole session, subagents included. The predecessor's score-only rule is printed beside it (Sebastián, 2026-10-02; `odd/tasks/evals.md`, Constraints) |
| Effort | Claude (Opus 5.5): `medium` by default, `high` for design; the cap is `maxEffortLevel: "high"` in user settings. Codex review (`gpt-6.1-sol`): `high`, fixed by the command, in the one session there is, the lean one (2026-10-08, replacing the `medium` of 2026-10-06; `--session current` was removed that day because its model could not be verified; see Review) |
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

### Session board
- [x] A session's transcript read into facts: title, last entry, background work with its recorded end, state, tail of the last reply
- [x] Machine facts: worktrees with their unpushed counts, running gates, open pull requests, each unavailable with its reason
- [x] `sessions` and `sessions --json`, read-only, in the dispatcher's help
- [x] Accepted review follow-ups on the library
- [x] A subagent that is sent a follow-up reads as running again
- [x] Live check on this machine with two or more sessions open, and the memories point to the command
- [x] `sessions --watch` returns when the board changes and costs nothing while it does not
- [x] The orchestrator ships as a skill the installer writes and removes through the manifest
- [ ] On this machine: installed, an orchestrator session opened with it, one real stretch supervised

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
default since 2026-10-08; `--session current` stayed that day and was removed in the next
feature, its model being one nobody could verify (Next, item 7). What it rests on, read plainly: on the
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

## Codex review cost result

Closed on 2026-10-09 (`odd/tasks/codex-review-cost.md`), built on 2026-10-08 and its
measurement of the part size run the day after. What `js-harness codex-review` does since, each behaviour
with a test written first and the spending ones run on the real binary:

- One model. `gpt-6.1-sol` at `high`, passed by the command and held to what the rollout
  file of the session says: a session that ran on another model, or whose file names none,
  is no review and leaves no record.
- Only code. Markdown and the paths a project marks `-codex-review` in `.gitattributes` are
  in no part, and the plan says how many were left out. `check` reads the same definition,
  so a commit of documents or of eval readings needs no record.
- Nothing twice. A run reads the review records first and starts where they end; a range
  they cover whole starts nothing and records nothing; `--again` reviews it on purpose. A
  merge counts for the code somebody wrote in it. On this branch a run from its fork point
  says there is nothing to review, where it would have been 12 parts and 5,880 changed
  lines.
- The cost first. `--plan` prints the parts, the lines and a range of input tokens from the
  run log of the machine, and starts nothing; a run prints the same before its first
  session and refuses more than 6 parts without `--max-parts`; the plain `check` says at
  every commit how much code waits for a review.

What the reviews of the feature's own code measured, 7 runs in 22 parts over 8,528 changed
lines, each inside the login proof (`evals/review/login-proof.mjs`: the real `auth.json` was
the same file after every one):

| Range | Parts | Changed lines | The plan said | Input tokens | Findings |
| --- | ---: | ---: | --- | ---: | ---: |
| `5663c8c..7936a1f` | 7 | 3,585 | about 1,045,000 | 2,314,747 | 1 |
| `7936a1f..da71985` | 1 | 304 | about 200,000 | 287,707 | 1 |
| `da71985..469e26f` | 2 | 739 | about 490,000 | 562,328 | 0 |
| `469e26f..ed1fd0e` | 4 | 1,308 | about 890,000 | 1,956,411 | 4 |
| `ed1fd0e..dbc71f0` | 2 | 642 | 490,000 to 1,460,000 | 803,690 | 1 |
| `dbc71f0..47c3d02` | 5 | 1,595 | 1,030,000 to 3,160,000 | 1,704,421 | 1 |
| `47c3d02..ce47f21` | 1 | 355 | 300,000 to 820,000 | 611,377 | 0 |

Read plainly. The plan as one figure was under half the cost twice, the second time from
runs at the review's own effort; given as a range, from the median and from the most a
changed line cost, it held the three times since. What a part costs follows how far the
session looks into the code more than its size: the measured parts at `high` cost from 296
to 2,278 input tokens a changed line. The 8 findings were all real defects, each fixed with
a test written first, and gentle-ai's on the same slices too.

And the price. These reviews cost 8.24 million input tokens, more than the 6.12 million of
the fifty reviews this feature was opened to cut. What it removed is the waste: the other
model, the documents, the ranges reviewed twice. What is left is the effort: about 966 input
tokens a changed line at `high`, where the run of 28 parts at `medium` on 2026-10-08 cost
about 237 (other code, so a rough comparison; most of either is cached input). `high` is
Sebastián's choice of 2026-10-08, and this is what it costs.

The part size, measured on 2026-10-09 with one run: `469e26f..ed1fd0e` again, in 2 parts of
up to 1,000 changed lines where the table has it in 4 of up to 400. It cost 1,241,978 input
tokens against 1,956,411 (37% fewer) and 381 s against 660, and gave three of the four
defects the first review found, with none it lacked. The one it missed is the one no single
file shows: a review record read against marks that changed between two tips. One run of
each size cannot say whether the larger parts miss it or that run did, so the bound stays
at 400 lines, where the review found all four; `--part-lines` is there for a run where the
cost matters more.

Left open, in the feature document: its follow-ups, the first of them that the gate of this
repository runs within two minutes of its own bound of 20, on one test file of 232 tests
that each build a real repository.

## Rule hierarchy (planned)

A feature of its own, in a session of its own, asked by Sebastián on 2026-10-08 and not started.
That session opens `odd/tasks/rule-hierarchy.md`; this section is its starting point and is
replaced by a pointer to that document once it exists. It sits outside the Next list only so
that it does not collide with the items `feat/codex-review-cost` adds there.

He approved the design below on 2026-10-08, to be done in a new session with the main session
told of it. What stays open is the detail that session works out, and each thing it ships is
his to decide then.

The problem. Working rules live in places that do not act. Two of that day existed only in an
agent's memory and in a feature document: how a decision is asked of him (what the yes covers
in everyday words, what it does to him, what it does not authorize, what the other option
means, one thing per yes), and his directive that what lives in memory is always forgotten, so
everything is cemented in the harness, in the documentation and in the files that make it act
here and wherever it is installed. A rule that depends on a session remembering it is repeated
by him, session after session.

What he asked, and how it is read. He described the rules ranked, with `AGENTS.md` as the
orchestrator of the most important ones, the rest in another place that matters as much, a
first rule that nothing is done for the sake of doing it or of complying but in the best and
correct way, and protocols, knowing that many protocols complicate. He then said not to take
his wording as the specification and asked to be guided to the best way. So what follows is
the design recommended to him, for that session to work out and for him to decide; his wording
is the need, not the plan.

The recommendation: each rule goes where it cannot be forgotten, in this order of preference.
More written protocols are not the answer: F5 measured the stack with the most instructions at
about twice the cost for the same score (F5 result).

1. A check a command or a hook runs. It costs no tokens and cannot be forgotten. The example of
   that day: "never two gates at once" was kept by reading the process list by hand before
   every test run, and one overlap still made a gate time out after 1,200 s; a lock taken by
   `check` would make the rule impossible to break and take it out of the prose.
2. A line in `AGENTS.md`, with its reason, when the rule cannot be checked and applies always.
   It is paid on every turn and capped at 1,500 tokens (`bin/check.mjs`, `TOKEN_BUDGET`); it
   stood at 1,497 that day, so a rule that enters makes another leave. It holds the principles
   and an index of where the rest is.
3. A protocol loaded on demand, when the rule applies only in some situations: the steps of
   asking for a decision, of running something that costs, of delivering a slice. `install`
   already writes a skill on each machine for Claude Code and Codex (`skillContent`,
   `bin/lib/manifest.mjs`), and `init` writes a base `AGENTS.md` in a project (`agentsTemplate`,
   `bin/lib/project.mjs`). A skill loads when its description matches the situation, not
   always, so a rule that applies to every reply needs its line in `AGENTS.md` and a check, not
   the skill alone.

The record of what was decided is none of the three and already exists: this file and the
feature documents. An agent's memory is the place of nothing.

His first rule. "Done properly, not to comply" goes at the top of `AGENTS.md` with its reason.
As a sentence alone it changes little: on that day a rule was stored in memory and nothing
stopped it. What gives it force is a concrete meaning of done: a rule is not recorded until it
has its place in one of the three levels.

A principle he added on 2026-10-09, and how it is read. His words: never fall into bias,
assumption or belief; always verify information; always work with quality and judgment,
researching well; never take a shortcut, cheat, or pull out or invent information. He asked
how to do it better than writing it down, so this is the recommendation. He accepted it the
same day, with what follows it below ("acepto todo como lo hemos estado hablando"): the
content and the direction; the wording of each line and each thing built still pass by him
in this feature. Quality and no shortcut are his first two principles again. What is new is
one thing: nothing is stated that was not checked. As a prohibition it does little, for two
reasons seen that same day. A bias cannot be seen by the one who has it, so "never be
biased" forbids something invisible; and the rule "verify before stating" was already
loaded in every session when the main session assumed `install` had a `--help` and
installed on his machine, and when another session told him its check "runs on GitHub",
where no workflow exists. So each part becomes something that leaves a trace:

- Verify. A report says of each claim which of three it is: checked (with the command and
  its output, or `path:line`), assumed (said as an assumption), or not known. An assumption
  is allowed; an unnamed one is the defect. `AGENTS.md` already asks for the evidence; what
  it lacks is the other two words.
- Invent nothing. A number, a path, a quotation or an output in a report comes from
  something run or read in that session. Part of it can be a sensor: `check` can refuse a
  feature document that cites a path or a commit that does not exist.
- No shortcut, no cheating. The checks exist (the test written first, the contract's
  commands, the hooks). What is added is what a reviewer is told to look for: a test
  weakened so that it passes, a hook skipped, a failing check left out of the report.
- Bias. The answer is not will but a second look that does not share it: the two reviews
  that already run, a reviewer handed the code and not the conclusion, and before a
  conclusion that costs, the question of what would show it wrong.
- Research well. Before running a command one does not know, read its code; a writing
  command refuses a flag it does not know, so that the mistake is not possible.

Where it lives, judged twice. Here, `AGENTS.md` is at its budget, so the line enters with
this feature's rework and another one leaves. In a project that only uses the harness, the
line is in the `AGENTS.md` that `init` writes and the sensors come with `check`. What the
stack already says is not repeated: on this machine the global `CLAUDE.md` holds "Verify
technical claims before stating them" (checked); whether gentle-ai writes that line on
every machine is not known and is looked up before the line is worded. And the line has to earn its tokens like any other piece (principle 2): an eval task
whose honest answer is "this could not be verified", scored with and without the line. If
the score does not move, the sensors stay and the sentence goes.

Working as a team, asked and accepted the same day. His words: always pass clear information
between sessions and agents, verified, without hiding what matters. The reading: a message
between sessions is a claim, not a fact, and the truth is in the repository.

- Every handoff has one shape, whether to him, to another session or to a sub-agent: what
  was done, what was checked and how, what was not checked, what failed, what stays open.
  "Not checked" and "failed" are always filled, with "nothing" when that is true, so that
  leaving something out takes writing a falsehood rather than forgetting.
- Whoever receives checks one thing before building on it. `AGENTS.md` already says so of a
  step he reports doing outside the session; it extends to another session's message and to
  a sub-agent's report.
- Bad news goes first, and at once.
- Each thing has one owner: a session writes its feature, one place writes the shared plan.
- What looks wrong is said, with its evidence, before it is done.

Three things he had not named, proposed and accepted with the rest:

- Each mistake leaves a control. The `install --help` of that day does not end in an
  apology but in a command that refuses a flag it does not know. A mistake made twice is a
  defect of the harness, not of the agent.
- An honesty audit: the reader of transcripts built for the session board could take a
  session's final report and check what can be checked (the paths and commits exist, the
  test count is the one that ran). That it can be built cheaply on that reader is an
  assumption, to be confirmed by reading the code before it is promised.
- Reversible by default: what cannot be undone asks first, the rest records how it is
  undone. The harness already does this for what it installs.

His addition, the same day: say so when a protocol is missing, without filling the harness
with protocols for the sake of having them. It sharpens the rule above that another enters
only when a problem repeats. An agent that finds no protocol for its situation does the
work with judgment, says in its report that there was none and what it did, and proposes;
it never creates one, that is his. A proposal passes five questions first. Did the problem
happen, with its evidence, or could it only happen? Twice, or once at a cost or with
something that could not be undone? Can a check do it, so that nothing is written? Does a
protocol that exists cover part of it, so that one is amended? What does it cost, and what
leaves in exchange? And a protocol expires: it records the problem it came for, and when
that problem has not returned and nobody used it, it is withdrawn.

The principles, then, are six, stated once: done properly, not to comply; no shortcut;
under the agreed protocols; nothing stated that was not checked; what is passed on is
complete and true, with what failed and what was not checked; each mistake leaves a
control, of the smallest kind that does the job. Asked whether anything was missing, the
answer he was given is no: a seventh enters through the five questions, with its incident.

How far is far enough, his question. No point exists where a model never errs, and more
text makes it worse (F5 result). The aim is three things: a mistake cannot do damage that
cannot be undone, it is seen quickly, and it is not repeated. This feature is done when
seven signals hold: six principles stated once; no principle without at least one control
behind it; no rule living only in an agent's memory; `AGENTS.md` within its budget; the
honesty eval passing, with the line moving the score; no repeated mistake; no protocol
without the incident that justifies it. From there a rule enters only by replacing another.

Protocols start with the four that have already cost something, and another enters only when a
problem repeats: how a decision is asked of him; how a reply closes, so he knows whose turn it
is; how something that costs is run (gates, eval batches, reviews), with its count said first;
and how a new rule is recorded.

The steps of the feature: list every rule that exists today, in `AGENTS.md`, in this file and
in the agents' memories of this project (twelve entries on that day); place each one with the
order above; move them, automating first what can be automated; and measure the end by two
numbers, rules that live only in a memory (zero) and `AGENTS.md` within its budget. It takes
in the session signals asked on 2026-10-07 and pending on `feat/codex-review-cost` (whose turn
it is in every reply, a notice when a session finishes, the context window watched), together
with that branch's rewording of "Working with Sebastián", which already fills the budget.

A first pass of that list, made on 2026-10-09 at his request ("qué cosas importantes
quedaron en memoria que deberían haber quedado en la doctrina"), by reading the twelve notes
of the project's shared memory against `AGENTS.md`, the template `init` writes
(`agentsTemplate`, four headings and two sentences) and the two installed skills. Not read:
whatever the other open sessions hold only in their conversations. Missing from what acts:

- His wording is the need, not the specification (name the problem behind it, recommend the
  best design): memory only. For `AGENTS.md` here and for the template; it holds in any
  project.
- How a reply closes (the four states): in `AGENTS.md` here, not installed. For the
  template, with the check item 6 of Next already asks for.
- How he is reported to (what needs him, what runs alone, what was done, everyday words):
  this file and memory. For the orchestrator skill, with the session channel.
- The direct channel between sessions: this file and memory. Same place.
- High effort on every sub-agent: memory and feature documents. Waits on the result of the
  sub-agent models comparison.
- The context percentage reported and the cut proposed: half in `AGENTS.md` here. For a
  check or the status line, not prose.
- Every proposal judged twice: this file and memory. For `AGENTS.md` of this repository
  only, since it is a rule for building the harness and is not installed.
- Not a rule but a tool: the script that waits for no gate before a commit lives outside
  the repository, on his machine alone. The lock in `check` replaces it.

In their place already: the review consent, the recap before a prompt, the main session as
orchestrator. Facts of his machine and not doctrine, so memory is their place: merging from
the chat, opening a session from the phone, the list of models.

The specification of the harness, asked the same day and part of this feature. He asked for one
complete document that says everything the harness does, how it is designed and the reason for
each piece; alive, updated as changes are made; and useful to the agent about to change
something. A first answer proposed a description of the pieces as they stand, and he corrected
it: that reads as the architecture it has today, and what he wants is a document that says what
the harness really is, from which a more capable model of a later generation could rebuild it
from nothing and better, with that document alone. That is the reading that stands, and it is
the document F7's protocol needs. Today `docs/` holds this file (the plan, and each decision
with its reason) and `origin.md` (the founding reasoning, frozen at the start), the feature
documents hold how each piece was built and its evidence, and nothing says what the whole must
achieve. The recommendation:

- One file, `docs/SPEC.md`: what the harness must achieve and why, never how it is coded today,
  because a description of today's pieces would make a rebuild copy them. Principles alone
  would not do either: nothing can be rebuilt from a philosophy.
- It opens with the problem the harness exists for and the bet behind it, then holds one entry
  per capability, each with the same five parts: the problem, with the incident or measurement
  that showed it; the requirement, as what must be true; the reason; how a rebuild is known to
  meet it, as a command or a test that exits 0; and what was tried and discarded, so a later
  model does not pay for the same lesson twice. A last line, "today", points to the files that
  implement it: the only part tied to the present, and what the agent about to change a piece
  reads to find it.
- It is the contract of the whole harness, in the shape F3 gave a task: a goal, a reason and
  done-when commands. A rebuild is proved by those commands and by the eval tasks, which are
  the measure of "better" and so belong to the kit together with this document.
- Alive by a check, not by remembering: `check` validates it as it validates a contract, and
  fails a commit when a capability has no command that proves it, when a file its "today" line
  names does not exist, or when a command, a hook or a file written outside the repository is
  claimed by no capability.
- It is not loaded on every turn. `AGENTS.md` carries one line that sends an agent to the entry
  of the capability it is about to change.

A limit to state plainly: the check proves that every capability is named and provable, not
that its reason is well told; that part stays with review.

It comes first in the feature, since listing the capabilities and listing the rules are one
survey.

A limit of the feature as a whole: most of the text loaded on every turn is not this repository's but
gentle-ai's managed block (F2), so this orders the thin layer, not the whole payload.

## Session channel (planned)

A feature of its own, in a session of its own, asked by Sebastián on 2026-10-09 and not started.
It builds on the session board (`odd/tasks/session-board.md`) and starts after that feature is
merged. The design below is the main session's proposal, put to him that day and approved by
him ("me parece excelente tu propuesta"); point 6 answers the question he asked next. Each
thing the feature ships is still his to decide then, and what he changes is written here
before the feature document `odd/tasks/session-channel.md` opens.

The problem. Sessions that work side by side talk to each other only through him: a session
that finishes hands him a block of text to paste into the orchestrator, and he carries it
across. On 2026-10-09 he carried one such notice by hand and asked for the sessions to talk
directly, to be told what was said instead of being given a prompt, and for a session's name
to say at a glance whether it is the orchestrator or a work session and which orchestrator it
belongs to (his example: `ORQ1: <name>` and `SES1.1: <name>`).

What exists. Claude Code lists the sessions of the machine (`ListAgents`) and delivers a
message to one by its title (`SendMessage`). Tested that day between two desktop sessions: the
message arrived as a new turn, was not held for his approval, and the answer came back within
a minute. A session can be renamed from another (`set_session_title`, desktop app). Codex has
no such channel. The board already reads every transcript of the project.

The proposal, in the order it would ship:

1. Names. A title is `<project code> <role> · <what it does>`: `JH ORQ · js-harness` for the
   orchestrator, `JH 1 · subagent routing`, `JH 2 · codex review` for its work sessions, the
   number given in the order they open and never reused. The project code replaces his
   orchestrator number because what tells two orchestrators apart is the project they serve,
   and a code is read without a legend where `1` is not. The title is also the address of a
   message, so it is short, unique and never changed while the session lives. The orchestrator
   gives the title in the opening prompt it writes; the session sets it where the host can,
   and the orchestrator's relief file keeps the list either way, so the board shows role and
   number in a host that cannot rename.
2. Notices, few and of one line, because each one costs the receiver a turn. From a work
   session to its orchestrator: opened (feature, worktree, branch), waiting for Sebastián (on
   what), closed (what it delivered). From the orchestrator to a work session: only what that
   session cannot see (the default branch moved, another feature touches its file, a hint is
   wrong). Never his decisions: a message between sessions is not his word, and no session
   takes one as the answer to a question it put to him. Spend, the irreversible, product
   choices, push and merge are asked and answered in the chat of the session that needs them.
3. What he reads. A reply no longer ends with a prompt for another session. It ends by saying
   what was sent and whether it arrived (`Told the orchestrator at 03:04, delivered: closed,
   #43 and #44 are on main`), and the orchestrator's next reply says what it received and from
   whom. Only when the send fails does the session fall back to a block for him to paste. A
   block for him remains for his own decisions, as today.
4. The board shows it. `js-harness sessions` gains a section with the last messages between
   sessions (time, from, to, first line, delivered or not), read from the transcripts, so
   whether the sessions are talking is a command's output and not a session's claim.
5. One gate at a time, by the gate. A second `check` on the machine waits for the first or
   refuses beside it, in `bin/check.mjs`, instead of a wait script in every session (three
   private copies and one collision by 2026-10-09). It is listed here because the message
   channel must not become the way gates take turns: a lock holds when nobody is listening.
6. One orchestrator per project, and that is checked. He asked whether there would ever be
   two, and how not to get lost if so. Two at once are normal across projects (`JH ORQ` and
   `ABG ORQ`): each has its own board and relief file, both keyed by the project's folder, and
   its work sessions address it by a title that carries the project code, so nothing of one
   reaches the other. Two in one project are not allowed: they would keep two boards over the
   same worktrees, gates and default branch, which is the collision itself. The orchestrator
   skill already hands over by relief, the new one in before the old one is archived, "so
   there are never two"; this feature turns that sentence into a check. A session that starts
   as orchestrator reads the relief file and the board first and refuses when another one of
   the project is alive, and the board says so in a line when two sessions carry the
   orchestrator's title. What two projects do share is the machine: the gate lock of point 5
   is the machine's, not the project's, and the Claude and Codex limits are his to spend.
   He then asked it of one project alone: three features at once, is that one orchestrator
   and three work sessions, or is a second orchestrator ever needed? Always one. What caps a
   project is not what an orchestrator can hold but what the sessions share: one gate at a
   time on the machine (12 to 18 minutes each, queued all day with three sessions on
   2026-10-09), one default branch, and his attention for each decision. A second
   orchestrator adds none of those and splits the one place that knows the order. The cases
   that look like a need for two have other answers: an orchestrator short of context is
   relieved, not doubled; a feature too large for one session splits its work among its own
   sub-agents, or into two features with two work sessions; a second machine on the same
   repository would be the one real case, one orchestrator per machine meeting through pull
   requests, and it is out of scope until he has one.

Asked the same day, and answered as advice, not as a plan: how to go faster with several
teams at once, a second computer included, without collisions and with work that is always
well done. What was measured that day and what follows from it:
- The limits are, in this order, his attention (every session asks him), the gate (it runs
  only on this machine, one at a time, 12 to 18 minutes; the repository has no workflow under
  `.github/` and no run on GitHub, and branch protection is not offered to a private
  repository on its plan, checked with `gh`), the plan's weekly limit (86% that morning with
  one machine), and the files every feature touches (`docs/ROADMAP.md`, `AGENTS.md`,
  `bin/lib/manifest.mjs`: two re-merges of `main` in one night).
- So width is added only as far as those four allow. The lever with the most in it is the
  gate: a lock so two never run together (point 5), a shorter gate, and the same gate run by
  GitHub on every pull request, where runs do not queue behind one machine. A second machine
  comes after that, and meets the first through pull requests, not through a new channel.
- His three principles (work well done, no shortcut taken to hand in a result, everything
  under the agreed protocols) are not new prose for this feature: each already has a check
  (the task contract, the test written first, the hooks), and the place that states them
  once is the rule hierarchy above. The repository's own measurement argues against adding
  text for its own sake: in F5 the fuller stack cost 1.68 to 2.54 times as much for the same
  score.
- His answer, the same day, which corrects that advice in four places. His attention was
  short because of how progress is told to him, not because of how many sessions asked: the
  way the orchestrator reports is part of this feature, and the reply that reaches him opens
  with what needs him, then what runs alone, then what was done, in everyday words. The
  limits are to be solved here, by building or on top of an existing solution, not only
  named. The plan is not one of them: he will raise it, with several maximum plans if needed
  (a second account does not share the first one's messages, so across accounts the meeting
  point stays the repository). And the shared files are a limit of this repository because
  the harness is what is being edited here; a project where the harness is installed has it
  fixed. What such a project still shares is its own plan and specification, so the rule to
  carry over is who writes them: a work session writes its feature document, and one place
  writes the shared plan.
- Every item of this section is therefore judged twice: as it is here, and as it would work
  in a project that only uses the harness.

The order he asked for, the same day ("quiero que lo que hemos hablado le hagamos un plan y lo
podamos implementar todo"), each a feature of its own with its own document and session:

1. The session board, finished: the Codex review of its code, the pull requests, the merge,
   the install on this machine and its T7.
2. The gate: one at a time on the machine by a lock in `check`, a shorter run (it stands
   within two minutes of its own bound), and the same gate run by GitHub on every pull
   request. In a project that uses the harness the lock comes with `check`; whether `init`
   also writes the GitHub workflow is a product choice, his.
   Its first slice is built (2026-10-10, `odd/tasks/gate-lock.md`): the lock and a shorter
   run. The gate on GitHub stays for a later slice, his to start.
   - What the lock covers: every `check` that runs sensors, and any command run through
     `js-harness gate -- <command>` (a batch of evals, a whole test run by hand), for one
     user on one machine, across projects and worktrees, since the lock is a folder under
     the home (`~/.js-harness/gate`). A second gate waits for its turn, an hour unless
     `--wait` says otherwise, and says whose gate it waits for; `--no-wait` refuses
     instead. `Gates` of `js-harness sessions` shows who runs and who waits, and the
     watch no longer raises an alarm for a gate that only waits. A gate that is killed
     leaves a holder that the next one takes over a minute after its last beat. A gate that
     ends leaves nothing on disk, and `uninstall` removes what a killed one left.
   - What it does not cover: a gate of a branch, or of an installed version, from before
     the lock, which runs beside the others as it always did, so the lock holds for
     everybody only once it is merged and the machine's command is updated, both his; a
     test file run alone by hand, left free on purpose; a `check` that could not take the
     lock at all, which runs and says so in a row; a process that carries the mark of a
     held lock without a holder behind it; two machines; and `check --push`, which runs
     no sensor. On Windows `gate` refuses, among several arguments, one that `cmd.exe`
     cannot be handed whole (a double quote, a percent sign, a line break): such a command
     goes as one argument.
   - The shorter run: measured file by file, the suite is as long as one file,
     `bin/codex-review.test.mjs` (909.7 of 910 s, every other file done by 458 s). Its
     test repositories built once and copied took that file from 640 s to 490 s alone and
     the gate from about 900 s to between 730 and 870 s. `gitDirs` now asks git in one
     process for the two folders it asked for in two. Running that file in three shards,
     approved by him on 2026-10-10, was built and measured and gave nothing inside a whole
     run (747 s and 833 s), so it was taken out again: on this machine of four cores the
     bound is the work, some fifty thousand git processes that slow each other down, and
     not how the files are arranged. What shortens the gate is fewer of them, which is
     for the next slice. A commit of documents alone skipping the test sensor (205 of 410
     commits since 2026-09-26 touched only Markdown, and no test reads `docs/` or
     `odd/tasks/`) is approved by him too and comes next.
3. The session channel, points 1 to 6 above, with the way the orchestrator reports to him.
4. The rule hierarchy above, with the six principles he accepted on 2026-10-09 stated once
   at its top.
   Each of the four is proven before it reaches a project of his, as he asked the same day
   ("la idea tambien es poder probar todo antes de irlo a probar en un proyecto externo"):
   by its tests, then by use on this repository, then in a practice project made for the
   purpose, where the harness is only installed and never edited. That third step does not
   exist yet and is the first thing to build for it.
5. Kept for later, his idea and not designed: several accounts, each on a maximum plan and
   each working three features at once, orchestrated together and able to talk to each
   other. What is known: the app's messages stay inside one account, so across accounts the
   meeting point is the repository. He takes it up again after the four above.

How the list is worked, proposed to him on 2026-10-09 when he said that so many ideas added
on top of work in hand had left him in disorder, and not yet answered: one feature on the
table at a time, and none of 2 to 5 starts before 1 closes; a new idea is written here, in
its place, and does not change the work in hand; and sessions work in parallel only once
the gate has its lock, since two gates at once make both fail.

The orchestrator as a lead, asked by him on 2026-10-09 and put to him as a proposal, not yet
answered. His words, in short: with one session working he does not know which one to open
next; the orchestrator, who knows the whole project, should say what else can be done at
the same time, without one feature colliding with another and without work that has to be
redone because it could have been seen that another way, or doing it together with another
feature, was better; like a lead developer with several programmers; it should know the
project in detail, ask what it doubts, be curious; and it should not take his words
literally but order the ideas and propose the better way. Quality comes before speed, and
speed still matters. What stands today is the opposite on purpose: the installed skill
makes the orchestrator a watchman ("You read", "Otherwise stay silent"), because reading
code and discussing a design fill a context that has to last. So the role changes, and the
knowledge goes to files instead of to the orchestrator's conversation:

- A work plan beside the roadmap's order: for each feature not started, what it touches
  (files and areas), what it needs finished first, what it blocks, and what it would be
  better built together with. From it the orchestrator says what can start now.
- A sensor for collisions rather than a judgment: the board already lists every worktree,
  so it can print the files two branches both changed.
- An entry gate for a feature: before it gives an opening prompt the orchestrator answers
  four things in writing. Does it touch what another one touches? Does it need something
  unfinished? Is it better joined with another? Is there room (the gate, the plan's
  limit, his attention)? A work session that wants to widen its scope asks it first.
- The next one proposed, not waited for: when a session closes or starts waiting, the
  orchestrator says whether there is room for another, which, and why it collides with
  nothing. He still decides the start, since a session spends his plan.
- Questions kept and asked: its doubts about the project go in the relief file and reach
  him one at a time, in a quiet moment, the one that unblocks most first.
- His wording is the need, not the specification: for every request, the need behind it,
  where it falls in the map, the proposal, then the record.
- Detail without filling its context: the specification planned in the rule hierarchy, the
  code graph, and a sub-agent sent to read when depth is needed; it keeps the conclusion.
- It still does not implement and never answers for him.

He then asked whether the lead should be a session of its own, passing what it decides to
an orchestrator that only controls the sessions, and saw the cost himself: that
orchestrator would be blind. The recommendation given, his to settle when this feature is
planned: one session, the orchestrator is the lead. What can start and what collides is
decided from the board's facts, so the one who decides the order has to be the one who
sees the state; two sessions add a hop to every notice and one more place that asks for
his attention, which is the real limit. The watching is the part that needs no judgment,
and it is already a program (`sessions --watch`, with the gate lock to come), so the split
that holds is program and session, not two sessions. What is right in his idea is kept: a
long design conversation is a work session of its own that delivers a document, as the
skill already says, and the lead reads its conclusion. The measure that would reopen this:
an orchestrator relieved more than once in a working day because its context filled.

More autonomy, asked the same day, with his yes to the push of this branch (pull request
#47). His words, in short: knowing the whole picture, say how many more sessions can work
now, alone or in pairs; he is the limit, so the orchestrator gets permission to handle
several sessions and go on from the agreed route, interrupting him only for decisions that
really matter, even compacting by itself and sending the next prompt, without leaving the
plan. What the tools allow, checked that day in the desktop app: a session can send another
a message (`SendMessage`), rename it, and read its state; it cannot open a new session
(`start_session` is named by other tools' descriptions and is not among this session's
tools, and whether it can be turned on is not known), and nothing compacts another session.
A session compacts by itself at 93% of its window, and a `SessionStart` hook with the
matcher `compact` runs right after (engram's did, in this session), so the resume prompt he
pastes today can be a hook the harness installs: read the feature document's next step and
go on. The proposal put to him, as a charter with two lists, which he approved as written
the same day ("te apruebo todo"):

- Alone, told afterwards: which feature starts next within the order and up to three work
  sessions; plan steps and notices sent to work sessions, and the turn for the gate;
  pushes and pull requests once the gate and both reviews are green; the merge of a pull
  request that changes only documents; a Codex review within the cost its plan prints, up
  to 3 million input tokens for a feature (the session board took 2.96); compaction left to
  the host, with the feature document as the record.
- His, asked one at a time: spend outside the plan; anything installed or changed on a
  machine; a product choice; what cannot be undone; a change of the plan or of its order;
  a new protocol; and, for now, the merge of code. That last one is measured: when ten
  merges in a row are ones he would not have stopped, it moves to the first list.

Opening a session stays one paste of his, a short prompt the orchestrator writes, until a
way to open one from a session is found.

What can run now, from the plans and not from a comparison of branches. Three work sessions
with the orchestrator: the gate (`bin/check.mjs`; first, because its lock is what makes the
rest safe), the practice project (a folder outside this repository), and sub-agent models,
which is open and waiting for him; its trials cannot run while a gate or a test runs, so
the orchestrator gives them their window. The pair to design together is the session
channel with the rule hierarchy: both rewrite "Working with Sebastián" and the
orchestrator skill, so one design session writes both feature documents and they are built
apart; it starts when one of the three frees a place. F6 needs only his choice.

Context, his condition on that approval. Every session knows how full its window is, so
that it is never cut in the middle of a piece of work, leaving it short or wrong and costing
more to repair than it would have cost to do once. It does not stop for the sake of
stopping either: it measures, and it cuts where nothing is lost. The reading, to be built
with the session channel and tried first by hand:

- A cut happens at the end of a task, never inside one. A task ends with its commit and
  with the feature document saying what is next, so at that point the files hold
  everything and the conversation can go.
- Before a task starts, the session reads its own percentage and judges whether the task
  fits. Past the board's limit (73% of the window it measures) it does not start one: it
  cuts first.
- The orchestrator sees every session's percentage on the board and tells a session that
  nears the limit to finish its task and cut there, before the host does it at 93% wherever
  the session happens to be.
- Two ways to cut, to be compared: the host's compaction with a `SessionStart` hook that
  sends the session back to its feature document, and a clean start (the app can clear a
  session's conversation) followed by the orchestrator's message to resume from the
  document. The second loses nothing to a summary, since nothing is carried in one, and is
  not tried yet: whether a session may clear itself while he has it open is not known.
- The measure: no task reopened because a cut lost what it needed.

For the gate on GitHub, a fact found the same day: the repository is private
(`gh repo view --json visibility`), so its runs count against the account's minutes.

What it would say today, as an example of the role: of the features in the order above,
the practice project is a folder outside this repository and the gate lives in
`bin/check.mjs`, while the two paused pieces of work (F6, sub-agent models) change `evals/`;
none of the four shares a file with another, so the first two could run side by side, in
`JH 1` and `JH 2`, once the orchestrator session is open. That reading is from the plans,
not from a comparison of the branches, which is what the sensor above would give.

A live handover, his decision of 2026-10-09, given in the new orchestrator's chat the first
time one took over from another (`JH ORQ · js-harness` from the main session). His words,
read in that session's transcript: "tu puedes comunicarte con la sesion anterior osea, si
tienes dudas siempre manda en el prompt cual fue el nombre de la sesion anterior
orquetadora que te creo y preguntale informacion adicional que no te haya quedado clara,
recuerda siempre se critico por que siempre priorizamos la calidad sobre el tiempo aunque
la rapidez tambien es importante. si tienes que añadir esto al harness hazlo por favor".
The new orchestrator's reading, his to correct, for the rewrite of the skill:

- The title of the orchestrator before, which is its message address, is always in the
  relief file, so it outlives an orchestrator that died; the opening prompt may repeat it.
- Before it says it is watching, the new one reads what can be read and asks the one before,
  by message, only what the files do not hold. Each answer is a claim: one thing is
  checked, and what was learned is appended to the relief file.
- The one before is archived only after those questions are answered.
- A sensor rather than prose: the board's Relief section prints who the orchestrator before
  was and whether it is alive to be asked.

It was done that way the same day: five questions asked by message and answered the same
way (`odd/tasks/session-board.md`, entries of that day).

Limits known before starting. The channel is Claude Code's: a Codex session keeps the pasted
block. A session in another permission mode holds incoming messages for his approval. The
rule about how a reply ends is paid on every turn, so where it lives is settled by the rule
hierarchy above, not by this feature.

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
   result 0 and the server up. The task bringing back a server that died was seen once, the
   same day, by timing: the desktop app restarted at 17:53 local and a new supervisor was up at
   17:55:02, two seconds after a run of the task, with no restart of the PC in between.
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
   say what runs now. The numbers are in "Codex review result" above. Merged on 2026-10-09
   (#43), every code commit covered by a Codex review record. Left for Sebastián: the
   proposal for the Codex plugin, in the feature document (the `doctor` row, `codex:rescue`,
   its three hooks).
7. Codex review, one model and a cost seen first, opened on 2026-10-08
   (`odd/tasks/codex-review-cost.md`, branch `feat/codex-review-cost`, stacked on
   `feat/codex-review-lean`). The fifty reviews of item 5 cost 6.12 million input tokens and
   more than half was avoidable: three ran on `gpt-6-astra` at `low` because his Codex
   configuration named it, one run of 28 reviewed tests, documents and fixtures that gave no
   finding, and four reviews repeated a range already reviewed. Sebastián, 2026-10-08: a
   Codex review runs only on `gpt-6.1-sol` at `high`; it covers only code, never the same
   commits twice, and prints its plan before it spends. Built and reviewed that day, and closed
   on 2026-10-09 with the measurement of the part size; the numbers are in "Codex review
   cost result" above. Merged the same day (#44, on top of #43). Whether `high` stays at
   what it costs is his, with the number in that section.
8. Subagent models, decided by Sebastián on 2026-10-08 and not started: compare side by side,
   in a session of its own and with the evals of this repository, Opus 5.5 orchestrating Opus
   5.5 subagents (what runs today) against Opus 5.5 orchestrating Haiku 5.5 subagents, with as
   many measurements as the runs give, and put it in the harness only if it helps. He had
   read that the pairing costs 75% less at the same quality and much faster. What Anthropic
   published (anthropic.com/claude-haiku-5-5, read on 2026-10-08) is narrower: the 75% is
   Haiku 5.5 against Haiku 4.5; Sonnet 5.5 and Opus 5.5 "remain better choices" for complex
   agentic coding (Terminal-Bench 4.0: 39.2% against Sonnet's 70.6%); Haiku is recommended as
   a subagent for narrowly scoped work; and no figure is given for the pairing against Opus
   alone. So the question to measure is the same quality on scoped work, cheaper and faster,
   read by kind of work (exploring, running tests and reporting, writing code): quality by the
   hidden graders as a pass rate over repeated runs, cost in list dollars and tokens of each
   model, wall time, and how many subagents a run spawned. A run that spawns none measures
   nothing of this, so the design has to make delegation happen. Its start prompt was handed
   to him on 2026-10-08.
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

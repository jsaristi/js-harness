# Roadmap

The one living plan of js-harness: what is decided, what is done, what is next, and which
decisions are still open. Each fact lives in one place:

- **This file** — the plan. What comes next is read here, under [Next](#next), and nowhere else.
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
| Name, home | `js-harness`, `D:\js-harness`, `github.com/jsaristi/js-harness`, private, and it stays private: asked when he means to make it public, he tapped "Se queda privado" (the lead's transcript `65318fd5`, line 13033, 2026-10-13, read with `sessions --quote`), which changes his words of 2026-09-26 that it would become public (transcript `2c923152`, line 72) |
| Hosts | Claude Code and Codex (CLI + desktop) now; Antigravity later, once its model is worth adopting |
| Stack | gentle-ai 4 (ODD, RDD review, test-first by default), engram 3 (the binary, and its Claude plugin since `gentle-ai sync` installs it: hooks and one skill, no second MCP server), codegraph, context7, `typescript-lsp` plugin; graphify for non-code corpora only |
| Instruction source | `AGENTS.md` on every turn — Claude Code reads it natively; the skills `install` writes for each host (`js-harness`, `js-harness-orchestrator`) load on demand |
| Distribution | A zero-dependency npm package with a `js-harness` bin; semver, git tags, releases |
| Release source | Decided and not built: git tags in the private repository (`<pm> i -g github:jsaristi/js-harness#vX.Y.Z`, latest from `git ls-remote --tags`), using the git credentials already on the machine. An npm publish was planned for once the repository is public; it stays private (Name, home), so that step has no date. No release is tagged and none will be while the harness is experimental: tagging starts at 1.0.0, with the first complete and usable version (decided 2026-10-12: asked how to fix the installer's message that named a version that does not exist, he wrote "Corregir el mensaje por que todavia no tenemos produccion, cuando ya terminemos todo y tengamos una primera version completa y utilizable que no estemos tan experimental ahi si comenzamos a etiquetar versiones desde la 1.0.0", the lead's transcript `65318fd5-80e7-4bb8-92b5-06737140185b`, line 8986), and until then `sync` says a pin cannot be installed by its number instead of naming a tag. No command asks a package registry about the name `js-harness`, which nobody holds there: until the first tag `update`, `upgrade` and `status` say that no release is tagged yet, and `upgrade` installs only the newer tarball of a folder named with `--source` (2026-10-13, `odd/tasks/install-update.md`, T5). A machine is installed from the default branch (`github:jsaristi/js-harness`). A project pins a version, never a source, so the switch changes no `harness.json` (decided 2026-09-26) |
| Commands | The list in force is the dispatcher's help (`bin/js-harness.mjs`), with a TUI over part of it (`bin/tui.mjs`) |
| Task contract | The contract is the head of the ODD feature document, not a second file: a feature doc with `## Goal` is a contract, with the sections of [origin.md](origin.md#task-contract-template). Its done-when commands are list items that open with a code span and say `exits 0`. `js-harness contract check` validates it and the `check` row `contracts` does so statically, never running a command; `contract run` runs them and prints `met` or `not met`; `contract goal` prints the `/goal` condition, which is `contract run` on the absolute path, so the evaluator judges command output, not prose. Closed feature docs are not retrofitted (2026-09-29, `odd/tasks/task-contract.md`) |
| Sensors | `check`, and so every pre-commit it guards, runs a project's own sensors: named commands that must exit 0, from `harness.json` `sensors` (any language; an empty map is a named opt-out) or else `package.json`'s `test`, `lint` and `typecheck` scripts through `npm run`, each a row, under a throwaway home and npm cache. A `review` row shows gentle-ai's risk tier for the pending change and whether review is due; it is INFO and fail-open, never a gate, because RDD is Sebastián's switch. This repo declares no lint or typecheck: one would need a dev dependency (2026-09-30, `odd/tasks/sensors.md`). A project may declare its documents in `harness.json` `documents` (folders ending in `/`, or single files; no patterns): a commit whose every staged path is one of them runs no sensor and says so in a row, while the budget and the contracts are still checked. So does a commit, a merge above all, whose index differs in documents alone from the trunk as origin names it, or from `MERGE_HEAD` where git wrote one: the trunk merged into a branch of documents, whose code is the trunk's (2026-10-14, `odd/tasks/merge-documents-skip.md`). Off unless declared, since in another project a document can be the product; this repository declares `docs/` and `odd/tasks/` (2026-10-11, `odd/tasks/gate-lock.md`). A project may also declare `documentSensors`, named commands of the same shape, for the checks that read its documents: a commit of documents alone runs those, each a row, for two minutes each at most and with no gate lock taken, and any other commit runs `sensors` as before; this repository declares its rules check and the two test files that read its documents (2026-10-12, `odd/tasks/gate-wait.md`). A project may declare `"sameTree": "skip"`: a gate whose tree, file for file, with the same sensors on the same Node, is the one a gate already ran every sensor on and passed, by a line of the gate log, runs no sensor and takes no lock, and says in its row which gate is the proof; off unless declared, since the key of a tree holds no file git ignores; this repository declares it (his decision of 2026-10-12, the lead's transcript, line 3913; built 2026-10-13, `odd/tasks/gate-wait.md`, T12) |
| Reversibility | Every file written outside the repo is in a manifest (path + sha256); uninstall is exact |
| Two levels | Installed once per machine (`npm i -g`), like gentle-ai; enabled per project with `js-harness init`, like `git init` |
| Command scope | A command that exists at both levels acts by location, like npm: inside an initialized project (a git repo with `harness.json` or a project manifest) it acts on the project, anywhere else on the machine; `--global` forces the machine from anywhere. Inside a git repository that is not an initialized project, or with an explicit `--cwd` that is not one, the command refuses and names `--global`, so repeating it never reaches the machine by accident. `uninstall` first, `sync` next (decided 2026-09-28) |
| Per project | `init` writes a committed `harness.json` that pins the version, a base `AGENTS.md` only if none exists, and the `check` gate in pre-commit, and runs `codegraph init`; `sync` brings the project to its pinned version; raising the pin is an explicit commit, like a lockfile. When the running js-harness differs from the pin, a project `sync` writes nothing and names both ways out: the command that installs the pinned version, or the commit that raises the pin; it never changes the machine from inside a project (decided 2026-09-28) |
| Stack visibility | js-harness sees the whole stack but changes only its own files: it reports each tool as installed, configured and up to date, and prints that tool's own command for any gap; it never installs or configures another tool |
| Notifications | Only on session start or resume, only when something changed since the last notice, and only through channels that cost zero model tokens (see Stack doctor notes) |
| Review | gentle-ai RDD on every candidate; Sebastián pre-grants consent. Codex reviews the same slice after each code commit: `js-harness codex-review --base <boundary>` runs `codex exec review` and records the review only on evidence that Codex read the diff, every changed line of the branch's patch in the output of its successful commands (2026-09-29, `odd/tasks/codex-exec-review.md`), or records an explicit `--unavailable` skip, under the git common dir; the pre-push hook runs `check --push`, which refuses a branch with a code commit no record covers (2026-09-29). Not the plugin's per-turn stop gate. The review runs in one session, the lean one (2026-10-08, `odd/tasks/codex-review-lean.md`): it loads the diff, read access to the repository, the project's `AGENTS.md` and Codex's own review rubric, and leaves out the user's Codex configuration (global instructions, skills, plugins, MCP servers, hooks); a large range is reviewed in parts. `--session current`, which loaded the user's own configuration instead, was removed on 2026-10-08 because the model it ran on could not be verified (until that day it ran on whatever `~/.codex/config.toml` named); a machine where the lean session cannot run records an `--unavailable` skip. A review that fails is not that case: it is repeated, and one that fails because the weekly use of his Codex plan is spent is told to him at once and never recorded as a skip (Sebastián, 2026-10-11, recorded in the orchestrator's relief file; the command does not tell the two failures apart yet). Review model: `gpt-6.1-sol` at `high`, fixed by the command (Sebastián, 2026-10-08, `odd/tasks/codex-review-cost.md`), so neither a `gentle-ai sync` nor `~/.codex/config.toml` changes it, and a review whose session ran on anything else, as its own rollout file says, does not stand. It replaces the `medium` he fixed for the lean session on 2026-10-06. Since 2026-10-08 a review reads only code (not Markdown, not the paths a project marks `-codex-review` in `.gitattributes`), starts where the review records end and starts nothing over a range they cover whole (`--again` reviews it on purpose), prints its plan and an estimate before it spends (`--plan` prints them and starts nothing), and refuses more than 6 parts without `--max-parts`; `check` says at every commit how much code waits for a review. Since 2026-10-14 a review runs out of the gate lock unless its caller holds a turn: Codex's `node --test` is refused by a preload in `NODE_OPTIONS`, the own prompt tells it the gate already ran the suite on the range, and an `incorrect` that rests on those refusals alone, with no finding of P0 to P2, owes no correction and is marked `excused` in its record (`odd/tasks/faster-check.md`, part 2) |
| Progress view | The plan and each feature doc hold their steps as checkboxes, so progress is computed by a command, not reinterpreted by a model. `js-harness progress` prints the whole checklist in the terminal (and so on Codex); `--json` gives the same data, which Claude Desktop and mobile render as an inline chat widget on request — no published page (decided 2026-09-27) |
| Eval spend | No USD ceiling for F5 (Sebastián, 2026-09-30). Runs use the flat-rate subscription, so the limits are tokens, wall time and the plan's usage cap; the runner records the first two per trial and stops cleanly on the third (`odd/tasks/evals.md`) |
| Eval verdict | Per task and effort, score is the floor and cost decides between equals: scores are equal when their gap is within max(0.02, pooled SD); unequal scores make the higher one win; equal scores with a cost gap above the pooled cost SD make the cheaper config win; anything else is `none`. Cost is Claude Code's `total_cost_usd`, the list cost of the whole session, subagents included. The predecessor's score-only rule is printed beside it (Sebastián, 2026-10-02; `odd/tasks/evals.md`, Constraints) |
| Effort | Claude: designing the harness, planning and verifying run on Opus 5.5 at `high` effort at least, or on Fable 5.5 at `high` once it exists, and on no other model (Sebastián, 2026-10-10). In this repository's way of working a sub-agent that writes scoped code is launched on Haiku 5.5, by the model on its call (`rule:subagent-writer-model`; Sebastián, 2026-10-11, on "Subagent models result" below), one that explores, reviews or verifies on Opus 5.5 at least (`rule:subagent-reader-model`), and every one at `high` (`rule:subagent-effort`); what the harness turns on by default in a project is not decided. `medium` runs only as a trial, on the main thread of a closed-scope build, alternated by slice with `high` (`docs/model-effort.md`, C2). The cap is `maxEffortLevel: "high"` in user settings. Codex review (`gpt-6.1-sol`): `high`, fixed by the command, in the one session there is, the lean one (2026-10-08, replacing the `medium` of 2026-10-06; `--session current` was removed that day because its model could not be verified; see Review) |
| Autonomy | Native `/goal <condition>`, not a loop of our own |
| Context | `autoCompactWindow: 500000`; a session holds one feature, and when it cuts is `AGENTS.md`'s ("Working with Sebastián"); the context pause, which decides between finishing a task and compacting inside it, is designed in `odd/tasks/session-channel.md`; state lives in files, not a handoff ritual |

## Phases

What each phase must deliver. Its steps are the checkboxes under [Checklist](#checklist), and
`js-harness progress` counts them; a phase's state is read there, not re-judged from this table.
A feature that is not a phase has no row here: its steps are the checkboxes of its
`odd/tasks/<feature>.md`, and of a Checklist section when it has one (the session board), and
`progress` counts both.

| Phase | Done when | State |
|-------|-----------|-------|
| F0 Safeguard and baseline | Old repos committed and pushed; per-turn payload measured on Claude and Codex; old folders marked read-only | Done 2026-09-26 |
| F1 Skeleton | `AGENTS.md` ≤ ~1.5k tokens with the prompt audit applied; a dependency-free `check`; pre-commit wired | Done — `AGENTS.md` 691 tokens (`odd/tasks/f1-skeleton.md`) |
| Install and update | `npm run check` and `npm run e2e` pass; the TUI opens with no arguments in a terminal | Done, reviewed, merged to `main` 2026-09-26 via `jsaristi/js-harness#1` (`odd/tasks/install-update.md`) |
| Stack doctor | `js-harness doctor` reports gentle-ai, engram, codegraph, context7 and `typescript-lsp` as installed (with version), configured (per host and per project, read-only) and up to date, or `unknown` when it cannot tell, with each tool's own fix command; results cached 6 h and fail-open offline; a `SessionStart` hook (startup and resume) on Claude Code and Codex notifies through `systemMessage` only when something changed and never writes to stdout; the TUI shows the stack state above the menu; the hook entry is recorded so `uninstall` removes exactly it; tests use fixtures, never the network | Done, reviewed, merged to `main` 2026-09-27 via `jsaristi/js-harness#4`; installed on this machine, hook registered in Claude Code and Codex; the Windows exit crash that install found was fixed via `jsaristi/js-harness#5`, and the global package matches `main` (`js-harness doctor --hook` exits 0, 2026-09-27) (`odd/tasks/stack-doctor.md`) |
| Progress view | The phases in this file carry checkbox steps; `js-harness progress` reads a project's `docs/ROADMAP.md` and `odd/tasks/*.md` and prints every phase and feature with checked and pending steps, percentages and what remains; `--json` returns the same data; tests use fixtures; js-harness uses it on itself first | Done, reviewed, merged to `main` 2026-09-27 via `jsaristi/js-harness#6` (`odd/tasks/progress-view.md`); every later phase is tracked with it |
| F2 Context diet | The budget gate measures the full payload (global `CLAUDE.md` + hooks + `AGENTS.md`); codegraph prompt hook measured with and without; gentle-ai v4 adopted when released; block exclusion via gentle-ai #4036 if it ships | Measurement done, reviewed, merged to `main` 2026-09-28 via `jsaristi/js-harness#7` (`odd/tasks/f2-context-diet.md`); gentle-ai 4.0.0 adopted 2026-10-01, merged to `main` 2026-10-03 via `jsaristi/js-harness#25` (`odd/tasks/stack-v4.md`), and it is not a diet: Claude went from 20,651 to 21,104 estimated tokens per turn and Codex from 10,510 to 25,515, since v4 gives Codex the full orchestrator; the last step waits on gentle-ai (#4036 is open, checked 2026-10-01) |
| Project init | `js-harness init` in a repo writes the per-project files above, all recorded in a project manifest, and `uninstall` there restores the repo exactly; `sync` moves a project to its pinned version; the TUI offers `init`/`sync`/`status` inside a project, above the machine commands (Sebastián, 2026-09-29), and the machine commands outside one; `doctor` reports the Codex plugin, and the Codex review of each approved code slice leaves a record a check verifies | Done 2026-09-29 (`odd/tasks/project-init.md`), seven slices stacked to `main`: the git-spec install through the pnpm shim works since `jsaristi/js-harness#8` (the package no longer runs `prepare`); `init` merged via `jsaristi/js-harness#9`; project `uninstall`, with `init`'s review follow-ups, merged via `jsaristi/js-harness#10` (2026-09-29); project `sync` by location merged via `jsaristi/js-harness#11` (2026-09-29); the TUI by location merged via `jsaristi/js-harness#12` (2026-09-29); the Codex plugin in `doctor` merged via `jsaristi/js-harness#13` (2026-09-29); the verifiable Codex review record (`js-harness codex-review` and the pre-push `check --push`) merged via `jsaristi/js-harness#14` (2026-09-29). Its follow-ups are carried in the feature document |
| F3 Task contract | The contract template in [origin.md](origin.md#task-contract-template) + a validator that rejects a contract without a done-when command + fit with the ODD feature doc and `/goal` | Done, reviewed, merged to `main` 2026-09-30 via `jsaristi/js-harness#16` (`odd/tasks/task-contract.md`); its follow-ups are carried in the feature document |
| F4 Sensors | Tests, lint/LSP diagnostics, budget and RDD-by-risk wired to pre-commit and `check` | Done, reviewed, merged to `main` 2026-09-30 in two slices via `jsaristi/js-harness#17` (sensors) and `jsaristi/js-harness#18` (the review row and a sensor timeout that kills the process tree) (`odd/tasks/sensors.md`); its follow-ups are carried in the feature document |
| F5 Evals that discriminate | Tasks hard enough to separate configs (0 of 32 did at the start); A/B minimal vs current config at medium and high | Done, reviewed, merged to `main` 2026-10-03 in four slices via `jsaristi/js-harness#20` (runner, sandbox, isolation proof), `jsaristi/js-harness#21` (the five tasks), `jsaristi/js-harness#22` (engram isolation, safe process-tree kills, the suite entry) and `jsaristi/js-harness#23` (runs, report, result) (`odd/tasks/evals.md`): the minimal config matches the current one on score and costs about half; see [F5 result](#f5-result). Its follow-ups are carried in the feature document |
| Remote sessions | `js-harness remote start` keeps Claude Code's remote-control server alive in a git repository, so a session opened from the phone runs on this PC; `stop` leaves no process of it; `--at-login` brings it back after a restart, through a launcher that `uninstall` removes exactly; `doctor` says when the CLI and the desktop app are signed into different accounts, and when a launcher's server is down; a scheduled task brings back a server that died, never one stopped on purpose; the log is capped at 5 MB; the TUI offers the three commands inside a repository | Written, reviewed and merged on 2026-10-04, in three slices stacked to `main` (`odd/tasks/remote-control.md`): the supervisor and the three commands (`jsaristi/js-harness#28`), the login launcher with the TUI entry (`jsaristi/js-harness#29`) and the account check (`jsaristi/js-harness#30`). The live check passed the same day: after `remote stop` and `remote start` a session opened from the iOS app ran in `D:\js-harness`, and the final `remote stop` left no process. Reopened on 2026-10-06 (branch `fix/remote-watchdog`): the supervisor had been killed from outside and stayed down twelve hours, and the log had reached 71 MB. The log cap, the watchdog task and the `doctor` row are written and reviewed, and merged on 2026-10-06 as three pull requests stacked to `main` (`jsaristi/js-harness#35`, `#36`, `#37`); live on this machine since 2026-10-06 |
| F6 Codex parity | The eval tasks run on Codex; differences measured and written down | Two of three slices merged to `main` on 2026-10-05 (`jsaristi/js-harness#33`, `#34`); the third paused by Sebastián on 2026-10-06, closed by him on 13 of its 15 trials on 2026-10-12, and brought to `main` on 2026-10-13 from a branch cut from it (see "F6 result") |
| F7 Future-model protocol | A written procedure: measure payload, run evals, strip one component at a time | Procedure written 2026-10-14: [future-model.md](future-model.md), version 2 after one reader (`odd/tasks/future-model-protocol.md`); it cannot run on a new model until its gaps are built: G5, G6, G3 and G2 cleared for that feature, G1, G4 and G7 later |

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
- [x] `doctor` `host-update` row: a Claude Desktop or Code tab CLI update is a gap, with its review steps, until `doctor --host-reviewed` records the review; an update downloaded and not applied is `outdated` (his request of 2026-10-15, `odd/tasks/host-update-check.md`; pull request 242, and its follow-ups: the app folder read under `--home` only, `--host-reviewed --json`)

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
- [x] `doctor` reports the Codex CLI (installed and logged in) when the project's codexReview switch is on, with its fix command
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
- [x] On this machine: installed, an orchestrator session opened with it, one real stretch supervised

### F6 Codex parity
- [x] The eval tasks run on Codex
- [x] Differences measured and written down

### F7 Future-model protocol
- [x] Written procedure: measure payload, run evals, strip one component at a time ([future-model.md](future-model.md))

### Web fetch fallback
When WebFetch is refused as AI traffic, the next rung is said at once (Sebastián, 2026-10-15: "las pagina
te tienen bloqueado al ser una ia ese es el problema"); measured on nine pages, `odd/tasks/web-fetch-fallback.md`.
- [x] Measured: which rung (WebFetch, r.jina.ai, the built-in browser) reads each of nine pages
- [x] `js-harness fetch <url>`: rung 2, read or blocked with the next rung
- [x] The `resume --pause` hook names the next rung after a blocked WebFetch
- [ ] Reviewed (gentle-ai and Codex) and merged

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

## F6 result

The same five tasks on the Codex CLI, at `medium`, the one effort the Codex matrix holds since
he cut it on 2026-10-05: 15 trials of `minimal` and 13 of `current`, recorded on 2026-10-05
and 06 on `gpt-6.1-sol` with codex-cli 0.160.0, gentle-ai 4.0.0 and engram 3.1.0. Two trials
of `current` were never run, the third of resolver and of spec-drift: the usage cap stopped
them, he paused the run on 2026-10-06 and closed F6 on 13 on 2026-10-12 (Next, item 1, with
his line), so those two cells are means of 2 and the matrix is 28 of 30. Each value is the
mean of its cell, Claude Code / Codex, from `node evals/report.mjs --codex-results-dir
evals/results/codex`; the data is `evals/results/codex/`, and Claude Code's rows are F5's.

| Task | Config | Trials | Score | Tokens | Cost, Codex's estimated | Wall time |
|---|---|---|---|---|---|---|
| format-v2 | minimal | 3 / 3 | 0.99 / 1.00 | 1.09M / 393.7k | $1.38 / $0.25 | 4m55s / 5m12s |
| format-v2 | current | 3 / 3 | 0.99 / 0.50 | 3.43M / 750.3k | $2.50 / $0.21 | 7m24s / 8m02s |
| house-rules | minimal | 3 / 3 | 0.98 / 1.00 | 312.7k / 202.8k | $0.40 / $0.12 | 1m17s / 2m10s |
| house-rules | current | 3 / 3 | 0.98 / 0.84 | 1.04M / 948.3k | $1.01 / $0.26 | 2m20s / 7m39s |
| lost-updates | minimal | 3 / 3 | 1.00 / 1.00 | 341.6k / 220.8k | $0.52 / $0.18 | 2m19s / 3m22s |
| lost-updates | current | 3 / 3 | 1.00 / 0.95 | 967.6k / 891.4k | $1.03 / $0.25 | 2m55s / 9m56s |
| resolver | minimal | 3 / 3 | 1.00 / 1.00 | 194.6k / 232.0k | $0.41 / $0.16 | 1m40s / 3m26s |
| resolver | current | 3 / 2 | 1.00 / 1.00 | 824.1k / 1.06M | $1.01 / $0.27 | 2m52s / 10m31s |
| spec-drift | minimal | 3 / 3 | 0.99 / 1.00 | 384.7k / 226.1k | $0.54 / $0.17 | 1m44s / 3m17s |
| spec-drift | current | 3 / 2 | 1.00 / 1.00 | 1.15M / 1.17M | $1.21 / $0.29 | 3m01s / 13m57s |

What it says, and what it does not. On Codex the minimal config scored 1.00 on all 15 trials.
The current stack did not add score on any task and lowered it on three: format-v2 to 0.50,
house-rules to 0.84, lost-updates to 0.95. The 0.50 is two sessions of three that ended at
0.26, before writing anything, on a question the stack has the agent ask with nobody there to
answer (the delivery strategy; `odd/tasks/codex-parity.md`, Progress, 2026-10-05 and 06). The
current stack also sent about 1.9 to 5.2 times the tokens of the minimal one and took 1.5 to
4.2 times as long. Its estimated cost moves less, from under the minimal one on format-v2,
where two sessions ended early, to 2.2 times it.

Between the hosts, with the limits of the measurement: a Codex trial's cost is an estimate,
its tokens at the list price of its model, since Codex reports tokens and no cost; its wall
time includes a download of about 60 MB at the start of each trial that a Claude Code trial
does not have; the two hosts ran on different days, on stacks one engram version apart; and
three trials a cell is a small sample. Within those limits: on the minimal config the two
hosts score alike, and Codex's estimated cost is 0.2 to 0.4 times Claude Code's list cost; on
the current config Claude Code keeps its score and Codex does not.

Read plainly, it is F5's finding again and sharper on the second host: on tasks like these
the stack's context and workflow add cost without adding score, and on Codex, run with no
person to answer, a question the workflow asks can end the session.

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
feature, its model being one nobody could verify (`odd/tasks/codex-review-cost.md`). What it
rests on, read plainly: on the seeded range two runs of `current`, which missed the same defect both times (the first run,
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

Left open, in the feature document: its follow-ups.

## Subagent models result

Measured on 2026-10-10 (`odd/tasks/subagent-model-routing.md`): Opus 5.5 at high effort
orchestrating a subagent that writes the change, with every subagent forced to Opus 5.5 in one
arm and to Haiku 5.5 in the other (one subagent a trial, except two trials of the Haiku arm
that spawned a second). Three tasks, three trials a cell, 18 trials, under
`bypassPermissions`, Claude Code 2.1.296 with gentle-ai 4.0.0 and engram 3.3.0 (`node
evals/subagents-report.mjs --modes write` over `evals/results/subagents/write-high.json`). The
orchestrator plans, delegates the writing and reviews the result; every trial delegated and none
failed. Score is the hidden grader's, the same in every trial of a cell; cost is the mean list
cost of one session, read from its transcripts, with the orchestrator apart from its subagents.

| Task | Score Opus / Haiku | Cost Opus / Haiku | Ratio | Orchestrator Opus / Haiku | Subagents Opus / Haiku | Wall Opus / Haiku |
|------|------|------|------|------|------|------|
| format-v2 | 1.00 / 1.00 | $2.40 / $1.03 | 0.43× | $0.84 / $0.79 | $1.56 / $0.24 | 9m17s / 10m17s |
| house-rules | 0.98 / 0.98 | $0.81 / $0.40 | 0.50× | $0.39 / $0.38 | $0.41 / $0.03 | 2m21s / 3m44s |
| lost-updates | 1.00 / 1.00 | $1.68 / $0.61 | 0.36× | $0.55 / $0.53 | $1.13 / $0.08 | 9m02s / 7m40s |

Read plainly, against what he had read (75% cheaper at the same quality, and much faster):

- Quality: the same. The Haiku subagent's change scored what the Opus subagent's did in all nine
  pairs.
- Cost: 58% less for the session, $6.11 against $14.64 over nine trials each. The subagent's own
  work costs 89% less ($1.04 against $9.30), but the orchestrator is Opus in both arms and costs
  the same ($5.08 against $5.35), so it is 83% of what the Haiku arm costs. Haiku also spends
  more to make the same change: 2.3 times the output tokens and 2 times the cache reads, and on
  `format-v2` and `lost-updates` 54 of its requests passed the 100,000-token prompt, where its
  price is five times higher.
- Speed: not faster. 65 minutes against 62 over the nine trials. Slower on the small task in
  every repeat (1.58×), and on the two larger ones the repeats of the two arms overlap.

What it does not show. These tasks sit at the score ceiling with any config (F5), so they can
show that Haiku costs less on scoped work and cannot show where it starts to write worse code;
Anthropic's own figures put it well under Sonnet 5.5 and Opus 5.5 on complex agentic coding. Three
tasks and three trials a cell are a small sample. Wall time was taken on a machine other
sessions were using: tests of another session ran beside three of the trials and a browser
beside five more; the marked trials are not out of line with their cells, but the speed line
above is the weakest of the three. And both arms delegate: F5 ran the same three tasks with
Opus 5.5 alone at high effort, on Claude Code 2.1.284, for $2.86 and 11 minutes the three, which
is less than Opus with an Opus subagent ($4.88, 21 minutes) and faster than either arm. That
figure is from another version and another week, so it is a pointer, not a comparison.

Recommendation, his to decide. Where a session already delegates the writing of scoped code,
forcing that subagent to Haiku 5.5 is supported by this measurement: same score, less than half
the cost. It is no reason to delegate more: on tasks this size the delegation is what costs,
not the model. So nothing is turned on by default in the harness from this alone. If it goes
in, it goes in as the model of the writing subagent only, set on the call that delegates the
writing, never as `CLAUDE_CODE_SUBAGENT_MODEL` for the session, which would also move the
subagents that explore, review and verify, and his rule of 2026-10-10 keeps those on Opus 5.5
at high effort. Two measurements would settle what this one leaves open, each his to approve:
the same three tasks with Opus 5.5 alone at high effort on this version (9 trials, about $9), so
that not delegating is in the same table; and one task hard enough to leave the ceiling.

Decided for this repository's way of working (Sebastián, 2026-10-11, "apliquemos lo que
investigaste", the orchestrator's transcript `130317af-a818-419c-a3de-3a21335db0a8.jsonl`, line
2037): the sub-agent that writes scoped code is launched on Haiku 5.5, set on the call, and the
ones that explore, review and verify stay on Opus 5.5 at high effort. What the harness turns on
by default in a project stays open, and so do the two measurements. The table it belongs to, the
mechanism that will apply it and the measurements still to run are in `docs/model-effort.md`.

## Rule hierarchy

Designed on 2026-10-10 in `odd/tasks/rule-hierarchy.md`, by one design session that also wrote
`odd/tasks/session-channel.md`, and being built on the branch `feat/failures-register`, where
`odd/tasks/rule-hierarchy.md` is current. Where this section and that document differ on the
design, the document wins; a decision of his that the document does not restate stands as it is written
here and in the orchestrator's relief file. It holds the survey (83 rules, 49 with nothing that makes them act, and the
place of each), the checks to build, the outline of the rewritten `AGENTS.md`, the protocols,
and the list of that day's failures with the proof each one owes. This section stays as the
reasoning it came from and is replaced by a pointer when the feature closes (its last task).

A feature of its own, asked by Sebastián on 2026-10-08, who approved the design below that day.
This section was the starting point of that document.

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
the score does not move, the sensors stay and the sentence goes. (Since 2026-10-14 this eval is
T10 of "JH 15 · auditoría de honestidad", `odd/tasks/honesty-audit.md` on `feat/honesty-audit`,
moved there from rule-hierarchy's T10 by the lead.)

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
  assumption, to be confirmed by reading the code before it is promised. (Since 2026-10-14 this
  audit, C9, is T14 of JH 15's `odd/tasks/honesty-audit.md`, moved there from rule-hierarchy's
  T14 by the lead.)
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
in the session signals asked on 2026-10-07 (whose turn it is in every reply, a notice when a
session finishes, the context window watched).

A first pass of that list, made on 2026-10-09 at his request ("qué cosas importantes
quedaron en memoria que deberían haber quedado en la doctrina"), by reading the twelve notes
of the project's shared memory against `AGENTS.md`, the template `init` writes
(`agentsTemplate`, four headings and two sentences) and the two installed skills. Not read:
whatever the other open sessions hold only in their conversations. Missing from what acts:

- His wording is the need, not the specification (name the problem behind it, recommend the
  best design): memory only. For `AGENTS.md` here and for the template; it holds in any
  project.
- How a reply closes (the four states): in `AGENTS.md` here, not installed. For the
  template, with the check "Session signals" of Next already asks for.
- How he is reported to (what needs him, what runs alone, what was done, everyday words):
  this file and memory. For the orchestrator skill, with the session channel.
- The direct channel between sessions: this file and memory. Same place.
- High effort on every sub-agent: memory and feature documents. It waited for his answer on
  the result of the sub-agent models comparison ("Subagent models result" above), which came
  on 2026-10-11; since the first slice of the rules list it is a declared rule,
  `rule:subagent-effort`.
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

**A project's own rules**, built on 2026-10-14 in `odd/tasks/project-rules.md` (S1-S7, design
version 2 after two readers; his answer "Sí, en prosa y por sensor (Recomendada)", the lead's
transcript `65318fd5-80e7-4bb8-92b5-06737140185b`, line 15809). A project where the harness is
installed declares its own rules in `docs/rules.json` (`{ "format": 1, "rules": [...] }`), each
with an id, an owner and one body: prose (a file and phrases that must still be in it), a sensor
(a name that must still be declared in `harness.json` or `package.json`), or retired. `js-harness
rules`, `rules <id>` and `rules check` read that list at a project's git top; the gate's first row,
`rules`, holds it there and only there, and refuses a phrase gone from its file, a sensor no
longer declared, a `failure` id the register does not hold, and a rule present at `HEAD` and now
missing (retire it instead). An id the harness also ships is a note, never a refusal. No values
and no overrides of the harness's own rules: those would be a feature of their own, beside the
switches of `harness.json`. The harness never writes the list, so `uninstall` has nothing of it
to undo. `status` says how many hold; the skill and the `AGENTS.md` template name the list.

## Session channel

Designed on 2026-10-10 and being built in `odd/tasks/session-channel.md`: what is done is read
in its tasks and in `js-harness progress`. What this section held of that feature (the problem
and the proposal he approved, points 1 to 6, the advice on width and his answer, the reasoning
of the lead, the charter, the context and its measure, the live handover, the two classes, the
test owed and the limits) was moved there word for word on 2026-10-15, to section 16
("Decisions carried from the roadmap"); that document wins where the two differ. What stays
here is the order he asked for on 2026-10-09, whose items are features of their own.

### The order he asked for (2026-10-09)

The order he asked for, the same day ("quiero que lo que hemos hablado le hagamos un plan y lo
podamos implementar todo"), each a feature of its own with its own document and session:

1. The session board, finished: the Codex review of its code, the pull requests, the merge,
   the install on this machine and its T7.
2. The gate: one at a time on the machine by a lock in `check`, a shorter run, and the same
   gate run by GitHub on every pull request.
   In a project that uses the harness the lock comes with `check`; whether `init`
   also writes the GitHub workflow is a product choice, his.
   Its first slice is built (2026-10-10, `odd/tasks/gate-lock.md`): the lock and a shorter
   run. The gate on GitHub stays for a later slice, his to start.
   - What the lock covers: every `check` that runs sensors, and any command run through
     `js-harness gate -- <command>` (a batch of evals, a whole test run by hand), for one
     user on one machine, across projects and worktrees, since the lock is a folder under
     the home (`~/.js-harness/gate`). A second gate waits for its turn, in the order the
     gates arrived (the line, below), and says whose gate it waits for; `--wait` bounds
     that wait and `--no-wait` refuses instead. `Gates` of `js-harness sessions` shows who runs and who waits, and the
     watch no longer raises an alarm for a gate that only waits. A gate that is killed
     leaves a holder that the next one takes over a minute after its last beat. A gate that
     ends leaves nothing of the lock on disk (its two lines in the gate log, below, are all
     it leaves), and `uninstall` removes what a killed one left.
   - What it does not cover: a gate of a branch, or of an installed version, from before
     the lock, which runs beside the others as it always did; a test file run alone by
     hand, left free on purpose; a `check` that could not take the
     lock at all, which runs and says so in a row; a process that carries the mark of a
     held lock without a holder behind it; two machines; and `check --push`, which runs
     no sensor. On Windows `gate` refuses, among several arguments, one that `cmd.exe`
     cannot be handed whole (a double quote, a percent sign, a line break): such a command
     goes as one argument.
   - The line (2026-10-11, `odd/tasks/gate-turn.md`): the lock gave no turns. Whichever
     gate looked first when it came free took it, and on 2026-10-11 one commit waited 53
     minutes while two gates that asked after it ran; the feature document counts five
     such sightings that day. Every gate that waits already left a file that says since
     when; now a gate tries to take the lock only while no live gate that arrived before
     it waits, and two gates of the same instant are ordered by their token. Taking the
     lock is still the one rename, so the line adds no way for two gates to run at once,
     and an error while the line is read counts as nobody ahead, so it never makes a gate
     run without the lock either. A gate ahead that dies stops touching its file and is
     passed over after a minute. A gate from a version before the line keeps none and
     would pass at every look, so beside a live one a gate behaves as it did before: on a
     machine where each worktree has the version it has, the line holds among the gates
     that keep it. A wait says how many gates are ahead and which is first, `--no-wait`
     refuses behind a gate that waits as it does behind one that runs, and a gate's file
     records the session it runs for, which the board can then show.
     What `--wait` bounds changed with the line, and he chose that default on 2026-10-11
     ("La opción B", of two put to him: stay while the line moves, and leave only when the
     lock has served nobody for an hour): it is no longer the minutes since the gate
     arrived but the minutes the lock may go without changing hands, sixty when not given. With gates of about fourteen minutes a
     gate with four ahead reached an hour while the line moved, was refused and came back
     last; two commits lost an hour each that way on 2026-10-11. The bound exists to give
     up on a lock that does not move. What a user of the installed gate sees by default is
     therefore a commit that may wait more than an hour in a line that moves, and there is
     no bound on the whole wait. Counting from the arrival again is one line of
     `bin/lib/gate-lock.mjs`.
   - The shorter run: measured file by file, the suite is as long as one file,
     `bin/codex-review.test.mjs` (909.7 of 910 s, every other file done by 458 s). Its
     test repositories built once and copied took that file from 640 s to 490 s alone and
     the gate from about 900 s to between 730 and 870 s. `gitDirs` now asks git in one
     process for the two folders it asked for in two. Running that file in three shards,
     approved by him on 2026-10-10, was built and measured and gave nothing inside a whole
     run (747 s and 833 s), so it was taken out again: on this machine of four cores the
     bound is the work, 15,467 git processes in a whole run that slow each other down
     (counted 2026-10-11, below), and not how the files are arranged. What shortens the
     gate is fewer of them. And, approved by him the same day, a commit of documents alone
     runs no test sensor (see Sensors above): 205 of 410 commits since 2026-09-26 touched
     only Markdown, each paying a gate of 13 minutes that no document could fail, since no
     test reads `docs/` or `odd/tasks/`.
     That was no longer so on 2026-10-12: `bin/rules.test.mjs` and `bin/sessions.test.mjs`
     read them, so such a commit now runs the sensors of documents (see Sensors above).
   - Fewer git processes, counted and not timed (2026-10-11, `odd/tasks/gate-log.md`): a
     time on this machine depends on what else runs, a count does not.
     `node scripts/count-git.mjs [--frames <n>] <test files>` runs test files and says how
     many processes they started, by git subcommand, by the line that asked and by test
     file. The whole suite starts 15,467 git processes, and the two long files,
     `bin/codex-review.test.mjs` and `bin/check-codex-reviews.test.mjs`, 11,735 of them
     (76%). Two cuts chosen from that profile took the two files to 8,213 (30% fewer), with
     no assertion changed: a `codex-review` run asks where the repository is once and
     hands it on, where each of its steps asked again (11,735 to 9,986); and the tests ask
     for the git folder once per repository they build, and build five repositories of
     the second file once (9,986 to 8,213). What is left is mostly what a run must ask:
     `rev-parse` 2,952, `diff` 1,667. Two more cuts were weighed and left: under one
     percent each, one against an assertion and one through 45 test bodies.
   - What the time of a gate depends on that no session saw (2026-10-11): on main with this
     slice merged in, the whole suite took 867 s and the gate 832 s, and what pull requests
     53 and 54 added costs 3.4 s of it. The same hour a gate on main without this slice
     timed out at 1,200 s and one of this slice took 1,069 s, beside a video playing in a
     browser and a TypeScript language server of a session spinning at about 1.5 logical
     processors with nothing to do. The process look counts neither. The bound stays at
     1,200 s; a gate that says the load on the machine when it starts is built (below),
     and so is the gate log (below both).
   - The load a gate starts under (2026-10-11, `odd/tasks/gate-log.md`): every gate that
     runs sensors, and every `js-harness gate -- <command>`, reads the machine's processors
     twice, a second apart, after it took the lock and before its first sensor, and says
     what it read in a row `load` of its report: how many of the logical processors were
     busy, and whether it started right after another gate. From one busy processor on it
     looks two seconds more and names the three processes that spent most, by program,
     script and pid, which is how a language server spinning in a session of this
     repository was found the day it was built. A script is named only when its argument is
     the whole path of a file that exists, asked of the disk by a process of its own that a
     silent server cannot hold: a command line can carry a secret, and no spelling tells
     one from a file name. Nothing a gate proves depends on the row;
     `JS_HARNESS_GATE_LOAD=off` takes no sample. What it does not do: it does not wait for
     a quiet machine, it does not say whose session a busy process belongs to, and it
     changes no bound.
   - The gate log (2026-10-11, `odd/tasks/gate-log.md`): which gates ran beside which, how
     long each took and under what load was a session's memory, and three failures of
     2026-10-10 name a log of gates as the proof they lacked. Every gate now writes it: a
     line when its sensors are about to run (when, where, which command, how it had the
     lock: its own, its parent's turn or none; how long it waited and for whose gates; the
     load it read) and a line when it ends (the seconds and the result of each sensor), so
     a gate that was killed stays in it as a start alone; a gate that was refused the
     lock, or ran out of patience, writes one line saying so. `js-harness gate log [--last
     <n>]` prints the last gates, one short line each. It is JSON lines in a folder of its
     own under the home, `~/.js-harness/gate-log`, two files at most and about a megabyte:
     past 512 KiB the file is renamed over the older one, never rewritten, since gates
     that could not take the lock write side by side. A command line is cut at 120
     characters, the gate's own and those of the gates it waited for. A log that cannot be
     written is said once and changes no result; `JS_HARNESS_GATE_LOG=off` writes nothing.
     `uninstall` removes the folder, and keeps it beside the lock's while a gate is alive.
     Where that folder lives was his to say, and he said it on 2026-10-11: there ("Sí, en
     .js-harness/gate-log"); it is one function, `gateLogDir`. What the log first showed, before it
     existed, from the gates' own reports: the lock gives no turns in order of arrival (a
     commit waited 36 minutes while one that asked five minutes later ran), which the
     `waitedFor` of each start will now put on record.
   - The stop before the sensors (2026-10-11, `odd/tasks/gate-turn.md`): a gate knows its
     static rows (the register of failures, the budget, the contracts) in a second, and it
     took the lock and ran every sensor even when one of them had already failed and the
     commit could not pass. A gate whose static row fails now stops there: it asks for no
     lock and waits for none, samples no load, runs no sensor and prints neither the
     `review` row nor the Codex debt. One FAIL row named `gate` says that no sensor ran and
     which rows stopped it, and the gate log keeps one line of a kind of its own,
     `stopped`, with those rows and no start, so the stops can be counted. The rule names
     no row: a row added to the static ones stops the gate by being there, which is what
     the rows of the rule hierarchy need, and a row that states a rule of the project
     (`failures` today) is the first of the report. A push and the inner check of a sensor
     are as they were. Two things a gate of that day showed came with it. The sensors'
     PowerShell wrote its module cache into the working tree, since under the sensors'
     empty home it finds no folder for local application data and falls back to the
     current directory, and that untracked folder made gentle-ai refuse to assess the
     change; the sensors now get `PSModuleAnalysisCachePath` under their temporary home.
     And a gate that ran its sensors names, in an INFO row `tree`, the untracked paths that
     appeared in the working tree while they ran. It compares two listings of the whole
     tree, so it says when a path appeared and not who wrote it: a file an editor or
     another process made meanwhile is named too. Each listing is bounded at twenty
     seconds, since it is asked while the lock is held.
   - The sensors in WSL2 (2026-10-14, `odd/tasks/gate-wsl.md`): on one commit the whole suite
     took 111.5 s in WSL2 and 603 s on this machine's Windows, and the lock had been busy
     for hours. Where the js-harness home holds `gate-wsl.json` (a distribution and the
     Linux folder of node) and the project's `harness.json` says `"sensorsInWsl": true`
     (the machine says how, the project whether: a suite that cannot run on Linux is never
     moved), the sensors of a gate's turn run in that distribution from a mirror of the
     working tree on the Linux disk, synced by `rsync --checksum` before each run (about
     seven seconds once it exists: `/mnt` shows mtimes to the second, so size and time
     missed a change; `.git`, `.codegraph` and `node_modules` stay out, and what a test
     made of them in the mirror goes), under a clean environment. Where they ran is part
     of the tree's key, so a pass in WSL2 never spares a run on Windows; what a test left
     in the mirror is named in a `tree` row. The lock, the load sample, the gate log, the tree key and
     every question to git stay on Windows, and the sensors of documents never move. A
     sensor that never reached the mirror runs on Windows and its row says why; one that
     failed there failed; a switch file that cannot be taken fails the gate in a row `wsl`.
     The gate log marks each sensor that ran there (`ranIn`). A sensor that failed, there or on Windows, keeps in its end line
     the names of its failing tests (`failing`, twenty at most), read from what `node --test`
     printed (2026-10-14, `odd/tasks/gate-log-failing-tests.md`). With no file, off Windows,
     or with `JS_HARNESS_GATE_WSL=0`, a gate runs as it did; with the variable and the
     file, each row says where its temporary files went. What Windows loses per commit:
     its own code paths are tested by one run per merged batch, in a lock turn on `main`:
     `TEMP='D:\js-harness-tmp' TMP='D:\js-harness-tmp' JS_HARNESS_GATE_WSL=0 node
     bin/check.mjs`. An installed project gets nothing unless its machine has the file.
     Undo: delete the file; in the distribution, `~/.js-harness-gate` and the node it names.
3. The session channel, points 1 to 6 above, with the way the orchestrator reports to him.
4. The rule hierarchy above, with the six principles he accepted on 2026-10-09 stated once
   at its top. It is built beside item 3 since 2026-10-11, starting with the tasks that wait
   for nothing of the channel, on the branch `feat/failures-register`, where
   `odd/tasks/rule-hierarchy.md` is current.
   Each of the four is proven before it reaches a project of his, as he asked the same day
   ("la idea tambien es poder probar todo antes de irlo a probar en un proyecto externo"):
   by its tests, then by use on this repository, then in a practice project made for the
   purpose, where the harness is only installed and never edited. That third step exists
   since 2026-10-10 (`odd/tasks/practice-project.md`). `node scripts/practice.mjs run --root
   D:\js-harness-practice` packs the checkout it is run from, installs it into a prefix and
   a stand-in home inside that one folder, and walks a journey of named steps in a small
   project that only receives the harness: `install`, `init` the first time and `status`
   then `sync` afterwards, a commit that passes through the hook and one that is refused,
   both uninstalls. It hashes what the harness owns in his real home before and after, and
   any difference fails the run. A run takes under fifteen seconds, spends no model, and
   appends one line to the folder's `record.jsonl` with the commit that was proven. A
   feature that changes what a project receives adds its own step, in its own branch: an
   entry in `JOURNEY` (`scripts/practice-lib.mjs`) and its function in `STEPS`
   (`scripts/practice.mjs`), and the run exiting 0 goes in its contract. Since 2026-10-14
   the journey has thirteen steps (`odd/tasks/practice-project.md`, T5, and
   `odd/tasks/project-rules.md`, T6): `project-rules` holds a project's own rules and refuses
   two commits that break them, and `host-loads` starts a real Claude Code session in the
   practice project, three Haiku 5.5 calls under a home of their own (about half a cent and
   fifteen seconds; `--no-host` leaves it out, and it needs `JS_HARNESS_EVAL_OAUTH_TOKEN`). The
   session lists both skills, answers with a word only `AGENTS.md` holds, runs the three hook
   entries, and leaves no trace in his real home; the first full pass is of `1659801`. Not
   proven: that Codex loads its `hooks.json` and its skills.
5. Kept for later, his idea and not designed: several accounts, each on a maximum plan and
   each working three features at once, orchestrated together and able to talk to each
   other. What is known: the app's messages stay inside one account, so across accounts the
   meeting point is the repository. He takes it up again after the four above.

For the gate on GitHub, a fact found the same day: the repository is private
(`gh repo view --json visibility`), so its runs count against the account's minutes.

## Next

**What the first version holds, by his answer of 2026-10-13.** Asked what enters the first
version, the 1.0.0, he had four options: what is already installed, well finished (the one
recommended); that and everything for several sessions; everything he asked for, with no date;
or a trial in his other project first. He tapped "Todo lo que pedí, sin fecha" (the lead's
transcript `65318fd5-80e7-4bb8-92b5-06737140185b`, line 10519, 2026-10-13T09:18Z, read with
`js-harness sessions --quote`). So nothing he ordered is cut to reach it, and it has no date:
the open tasks of this map (`js-harness progress`), the defects in shipped behaviour that have
no task yet, and what he ordered that has no design yet (the functions on demand and the
switch of the Codex review among them, open decision 4) are all inside it. Which defects and
which items those are is so far a list made by the lead's readers, sub-agents' claims that
were not verified for this paragraph (the lead's relief file, lines 543 to 546); each enters
this map as a task when it has been read in the code. Tagging still starts with that version
(Decided, "Release source"). And nothing is frozen on the way to it: asked what is done with
the ideas and improvements that appear meanwhile (his own enter and the rest is noted, the one
recommended; everything keeps entering as today; everything is noted, his too), he tapped
"Todo sigue entrando como hoy" (the same transcript, line 10609, 2026-10-13T09:25Z, read the
same way). So an improvement that appears becomes a task of the first version, not a note for
after it.

**`docs/SPEC.md` is written last**, when everything else of the first version is finished and
the code is still, before the practice run and the tag; it stays rule-hierarchy's (T1). Asked
who writes it, he tapped "Al final, con el código quieto" (the lead's transcript `65318fd5`,
line 13982, 2026-10-13, read with `sessions --quote`), among a seventh session (the one
recommended) and this session after the README. His reason, in the message that asked for it
(line 13936): "necesitamos hacer la documentacion muy bien para que se pueda hacer perfecto solo
con ese documento". Its design is in "Rule hierarchy" above. Meanwhile each feature, at its
close, sends the lead one note per capability it built in the document's five parts, which the
lead keeps for whoever writes it. That is the lead's reading of his answer to how the sessions
leave those notes (line 14050, tapped "Que me lo manden a mí", among a section in each document,
the one recommended, and a file for each capability).

**Defects in shipped behaviour that had no task, read in the code on 2026-10-13** (`main` at
`f98f478`). They came as claims of the lead's readers and of the session-channel session;
each was read by the rule-hierarchy session before it was written here, and all six are true.
Each has its task in the document of the feature it belongs to, none is designed, and none of
those features has a session open: the lead assigns them.

- a. **`upgrade` asks the npm registry for a name nobody holds**, the first to fix.
  `js-harness upgrade` runs `<pm> view js-harness version`, installs `js-harness@<that>` with
  no check of its source and no comparison to what is installed, and then runs the `sync` of
  the copy it installed (`bin/update.mjs:34-42`, `:200-225`); the menu of `js-harness` with no
  argument offers it too (`bin/tui.mjs:364`). `npm view js-harness version` answers 404, so
  the name is free, and whoever registers it decides what that command installs and runs on
  his machine. Today the command only fails ("could not determine the latest version to upgrade to"). The
  release source decided is git tags and is not built ("Release source").
  `odd/tasks/install-update.md`, T5. **Fixed on 2026-10-13** (branch `fix/upgrade-source`): no
  command asks a registry about the name any more. With no folder of tarballs named (`--source`
  or `JS_HARNESS_SOURCE`), `update`, `upgrade`, `status` and the menu start no process and say
  that no release is tagged yet; `upgrade` then exits 1 having installed nothing, and with a
  source it installs only a tarball newer than what is installed. Reading the tags is still
  not built: it is due with the first one. Left open and told to the lead: with no `--prefix`
  the `sync` after an install runs whatever `js-harness` the shell finds on the path. **Fixed
  on 2026-10-13** (branch `fix/upgrade-sync-from-path`, `odd/tasks/install-update.md`, T8): that
  copy is asked its version first, with a new `js-harness --version`, and only the version
  just installed is let to sync; any other answer, or none, syncs nothing and exits 1.
- b. **There is no README** (`fd -i -d 2 readme .` prints nothing, in a tree where it would
  find one). What it holds is his: open decision 9.
- c. **The package ships this repository's `AGENTS.md` and its tests.** `package.json:9-12`
  lists `bin/` and `AGENTS.md`; nothing under `bin/` reads the package's own `AGENTS.md`, which
  is this project's working agreement with him and not an installed project's; and `bin/`
  holds 58 test files, with no `.npmignore`. What ships is his: open decision 10. **Fixed on
  2026-10-13** (branch `fix/package-contents`), by his answer to question 24 ("Solo los
  comandos"): `package.json` lists `bin/` without its `*.test.mjs` and `*.testkit.mjs` files and
  no `AGENTS.md`. npm's own list went from 117 files to 56 (the 55 command files and
  `package.json`), the tarball from 1,125,283 bytes to 438,313;
  `scripts/package-contents.test.mjs` reads that list from a dry run of `npm pack` and pins it.
  `odd/tasks/install-update.md`, T7.
- d. **A timed-out command of `contract run` leaves its processes running**
  (`bin/contract.mjs:228-235`: a shell with a timeout, and only the shell is killed).
  `odd/tasks/sensors.md`, T5. **Fixed on 2026-10-13** (branch `fix/contract-timeout-tree`): a
  done-when command runs through the sensor runner (`runSensor`), which stops the whole tree
  at the timeout and whatever the command left holding its output; a test with real
  processes pins that neither the command nor what it started is left.
- e. **`status` exits 1 in a project whose `harness.json` holds no pin**, this repository
  among them: "it has no string "version"" (`bin/update.mjs:140-142`,
  `bin/lib/project.mjs:1473`; `sync` the same). `odd/tasks/install-update.md`, T6. **Fixed on
  2026-10-13** (branch `fix/status-no-pin`), by his answer to question 25 ("Vale, sin versión
  fijada"): a `harness.json` that is an object with no `version` is a project with no pin.
  `status` reports it and says how to pin one, exit 0; `sync` says there is nothing to move
  the project to and how to pin, writes nothing, exit 1. A `version` that is there and is
  not a semver string, and a file that is not a JSON object, are refused as before.
- f. **The practice run starts no host session**, so it does not prove that a host loads what
  was installed (`scripts/practice-lib.mjs:450-461`; item 4 under "Session channel" says so).
  `odd/tasks/practice-project.md`, T5; a step that spends a model is his to approve. Done on
  2026-10-14 for Claude Code (the step `host-loads`, within his allowance of three tries); Codex
  is still not proven.
- g. Already placed by the session-channel session in its own document, and only named here:
  the pause hook assumes a window of 500,000; the hook's text uses terms an installed project
  is never given; `uninstall` leaves `~/.js-harness/remote/`; and `pointersIn` of
  `bin/lib/manifest.mjs` (`odd/tasks/session-channel.md:2542-2585`).

Being built, each in a session of its own: the session channel
(`odd/tasks/session-channel.md`), the gate log (`odd/tasks/gate-log.md`) and the rule hierarchy
(`odd/tasks/rule-hierarchy.md`, current on the branch `feat/failures-register`). What is done
of each is read in its document, under "Next step"; the order they come from, with its
reasons, is under [Session channel](#session-channel). Also open:

1. F6 Codex parity, paused by Sebastián on 2026-10-06 and closed by him on 13 of the 15
   trials of T7 on 2026-10-12 (`odd/tasks/codex-parity.md`, branch `feat/codex-parity`, in the
   linked worktree `D:\js-harness-worktrees\codex-parity`). Asked by the lead whether to close
   with 13, run 15 new ones, or go back and run the two, he tapped "Cerrar con 13
   (Recomendada)" (the lead's transcript `65318fd5-80e7-4bb8-92b5-06737140185b`, line 9794,
   2026-10-13T03:33Z, read with `js-harness sessions --quote`). The two not run are resolver
   #3 and spec-drift #3 of `current` at `medium`. They could not join the same run as things
   stand: the suite refuses to continue a results file recorded on another stack
   (`evals/suite.mjs:751`, the message of `refusalOf`, `:329`); that branch's document records
   codex-cli 0.160.0, gentle-ai 4.0.0 and engram 3.1.0 (`odd/tasks/codex-parity.md:1059`
   there); and this machine answers codex-cli 0.162.0, gentle-ai 4.1.1 and engram 3.4.0 (each
   `--version`, 2026-10-12). Putting the recorded versions back would have meant downgrading
   programs over the memory store in use, which is what the question named. Its result is
   written on those 13 ("F6 result") and its content is on `main` since 2026-10-13; nothing
   more of it is paid for, and no task of it is open. Sebastián approved its plan and a staged
   spend on 2026-10-03: 2 smoke trials, then 15, then his go-ahead for the other 45.
   Remote sessions, which he put before it that day, closed on 2026-10-04
   (`odd/tasks/remote-control.md`). The branch was brought up to `main` on 2026-10-04, so it
   holds the gate fix (`a3a1eb1`) without which a commit from a linked worktree can turn this
   repository bare. Slice 1 of 3 merged on 2026-10-05 (#33): one isolated Codex trial per arm,
   proven on the real binary, and the two smoke trials spent
   (`evals/proofs/codex-isolation.md`). Slice 2, the suite and the report (T4, T5), is complete
   and reviewed, and merged on 2026-10-05 (#34): `node evals/suite.mjs --agent codex`
   runs the matrix, and `node evals/report.mjs --codex-results-dir evals/results/codex` sets the
   two hosts side by side, with a Codex trial's cost estimated at the list price of its model.
   Slice 3 reached `main` on 2026-10-13 as three commits of a branch cut from it,
   `feat/codex-parity-close`: the login fix applied again on today's suite, the two results
   files and the isolation proof byte for byte, and the documents; a merge of the old branch,
   506 commits behind, would have been a code commit whose review covers everything `main`
   brought (`odd/tasks/codex-parity.md`, Progress, 2026-10-13). Still his, and the one thing
   left: what is kept of the raw trial output that lives only on this machine (`evals/runs/`
   in the old worktree, and `D:\js-harness-worktrees\codex-parity-t3-raw`); until he says,
   the old branch and its worktree stay as they are.
2. F4's follow-ups (`odd/tasks/sensors.md`), when one earns a slice; the orphaned processes of a
   timed-out `contract run` command are the most concrete.
3. F2's last step, when gentle-ai ships #4036; open decision 4 (the codegraph hook) can be
   taken at any time.
4. Session signals, asked by Sebastián on 2026-10-07: he runs several sessions
   from the phone and wants three things said by the harness itself rather than remembered by
   the agent. Whose turn it is in every reply: a prompt for him only when the work waits on
   him, and a plain "nothing to send" when the agent goes on by itself (he could not tell the
   two apart and sent stale prompts twice). A notice when a session finishes, saying which
   session to return to. And the context window watched, with its percentage reported and a
   cut proposed before auto-compact (this session reached 77% of 500k unnoticed). It is built
   inside two features and is no feature of its own: whose turn it is and the check of a
   reply are T2 of the rule hierarchy (`odd/tasks/rule-hierarchy.md`), and the context
   figure, with the context pause that took the place of the proposed cut, is T5 of the
   session channel (`odd/tasks/session-channel.md`).

   The format of the first is decided (Sebastián, 2026-10-07, "usá ese formato y cementalo en
   el harness"), after a block worded as an instruction ("run the lean review on Codex
   0.160.1") was read three times as a task for him to do in Codex. Every reply closes with
   one state of four:
   - working: he sends nothing; the reply says what wakes the agent and what it reports next.
     No block.
   - decision: the work waits on him. One block.
   - cut: a new session, one block. He never compacts by hand, present or away (his words of
     2026-10-15, odd/tasks/no-manual-compact.md S1): near 88% a session writes its state and
     keeps working, the host compacts it by itself, and a session that stops gets its next
     prompt from the orchestrator. Until then a compact was two numbered blocks, the bare
     compaction command and the resume prompt.
   - finished: the session closed; the reply names the session he returns to. No block.

   A block sits under three fixed lines: what it is (for example "leave to spend one Codex
   review"), where it is sent (this chat) and what sending it does (the agent runs it; he
   runs nothing). The text of a decision is his answer in his words, as short as "Sí", never
   a technical instruction; the question, with its cost, goes above it in plain words. The
   opening prompt of a new session is the one long text, labelled as text to paste, not to
   understand.
   A decision is never asked while work still runs: the agent waits for it to end. A decision
   asked again says first that the earlier answer still holds and what changed.

   Narrowed by Sebastián on 2026-10-08 ("si el siguiente prompt es sí, seguí trabajando; solo
   pará si es una decisión que debo tomar"), when the nine Codex reviews of a comparison were
   put to him with a block that held only "Sí": a step already in the plan, whose only answer
   would be yes, is not a decision. The agent states it, with its cost, and goes on. A
   decision is a real choice between ways, something outside the plan, or something that
   cannot be undone.

   Where it lives: `AGENTS.md`, "Working with Sebastián". Still to build, in T2 of the rule
   hierarchy: a check that refuses a reply that closes with none of the four states, so the
   rule stops depending on the agent reading prose.

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
3. **Answered on 2026-10-13: the Gentleman persona stays part of the stack.** Whether it stays.
   His words, typed (the lead's transcript `65318fd5-80e7-4bb8-92b5-06737140185b`, line 12096,
   read with `sessions --quote`): "Si al estilo de Gentlema y listo dame para abrir las 2
   sesiones". He answered it as it stood, before the cost of each option was read.
4. The codegraph `UserPromptSubmit` hook: keep, narrow or drop it. Replaying this project's 55
   real prompts, it fired on 33; 16 of those injected a full ~4k-token code exploration, often
   for prompts with no code intent — ~1.2k tokens per prompt on average, kept in the history
   (evidence in `odd/tasks/f2-context-diet.md`, T3). It is codegraph's config, so js-harness
   only reports it.
   **Answered for this repository on 2026-10-12: off.** His words, to the lead's question
   whether the add-on at each prompt goes off here or stays (the lead's transcript
   `65318fd5-80e7-4bb8-92b5-06737140185b`, line 8161, read with `sessions --quote`): "listo
   apaguemos en este el mapa del codigo para este como para cuando el harnes funcione para
   cuando no hay que meter codigo ya que gentle-ai no solo sirve para programar sino tambien
   para investigacion, entonces hay que dar la opcion de deshabilitarlo y habilitarlo
   dependiendo del caso y creoq ue asi con otras funcionalidades que tenemos, cierto?"
   How it is off: `CODEGRAPH_NO_PROMPT_HOOK=1` under `env` in the untracked
   `.claude/settings.local.json` of his machine, written by the lead by hand. It is in no
   manifest; deleting the key undoes it. The map itself stays installed and can still be asked.
   Evidence so far, two samples and no proof: one prompt in the lead's session arrived with no
   output of the hook (the lead's claim); and in a session that was already running, JH 7, the
   prompt of 19:35 still carried the hook's output and the next one, after 19:37, did not.
   **A product direction in the same words, not designed:** the harness offers turning the
   code map, and other functions that only serve programming, off and on by the kind of
   project, since gentle-ai also serves research, where no code is written. It widens "js-harness
   only reports it" above and joins decision 6. A candidate feature, not assigned, owed a
   design with its two reviews before it reaches him. The lead's reading, not his words: a
   switch for each function, kept in the project's `harness.json` and recorded in the manifest
   so that `uninstall` undoes it, a kind of project being a preset of switches.
   **His order for the product, four minutes later** (same transcript, line 8250, read with
   `sessions --quote`): "Entonces hagamos el harnes para que funcione con codigo y sin codigo o
   que al principio sea investigacion y cuando vayamos a hacer codigo sea inteligente y sepa
   cuando este investigativo o analisis y cuando ya llegue la hora de codigo y asi a la inversa
   cuando se vuelva a analisis e inveastigacion desactivar osea que sea a demanda, que te
   parece?" So: the harness serves a project with code and one without, and what serves only
   code is on demand, in both directions. It ended in a question, and he answered the lead's reply to it at 19:42 (line 8315, read
   with `sessions --quote`): "listo entonces apliquemoslo asi". That is a yes to the direction
   below and to its when; it is not a yes to a design, which is still owed with its two reviews.
   What the lead answered him, the lead's reading and not a design: no watcher of the
   conversation that flips a mode, since the hook was such a guesser (33 of 55 prompts, the
   evidence above); each function pays only when the work calls for it, as three already do
   (a commit of documents alone runs the sensors of documents, pull request 77; a Codex record
   is asked only of code commits; gentle-ai's review goes by its assessment); the code map on
   demand, its paste off and the tool asked; what is chosen only when a session starts (the
   TypeScript server) chosen from the project's files at `init`, with a switch in the manifest;
   `install` preparing nothing of code in a project that has none until the first appears.
   **The Codex review is one of those functions, by his order** (line 8758, read with
   `sessions --quote`; he sent it while the lead worked): "tambien quiero que la funcionalidad
   de revision con Codex se pueda desactivar ya que por ejemplo si este harnes lo utiliza otra
   persona o en otro proyecto y no tengo para pagar la el plan para la revision entonces se
   desactiva y dejamos solo la revision del mismo claude peroque hace gentle-ai". So a project
   can turn the Codex review off and keep gentle-ai's alone. Today the push check refuses a
   branch whose code commits no Codex record covers, so the switch has to reach that check
   too. Not designed, not assigned; it joins the candidate above.
   When: after JH 8's cut of the review command is on `main`; not assigned. A third sample of
   the switch, the lead's claim: his prompt of line 8250 carries no attachment of the hook,
   where the one of line 8161 had one at line 8163.
   **Held by "JH 9 · funciones a demanda y revisión de Codex opcional"** since 2026-10-13, by his
   answer to how many sessions open ("Dos nuevas: cinco (Recomendada)", the same transcript, line
   12000). Its design is JH 9's document, `odd/tasks/on-demand-functions.md`, which closes this
   decision; his four answers to it, each read with `sessions --quote` in the same transcript:
   where the Codex review is on, it is demanded before a push, in an installed project too
   ("Sí, se exige (Recomendada)", line 12777; today it is demanded only in js-harness and is
   advice elsewhere); in a new project it starts by itself ("Sola (Recomendada)", line 12795);
   installed projects turn the paste of the code map, and a TypeScript server they do not need,
   off at their update, and say so ("Sí, y avisa (Recomendada)", line 12814); with the Codex
   review off, gentle-ai reviews high and medium risk ("Riesgo alto y medio (Recomendada)", line
   12828).
5. Whether the Codex review stays at `high` at what it costs (the number is in "Codex review
   cost result").
6. What the harness turns on by default in a project from the sub-agent models result
   ("Subagent models result", the recommendation). For this repository's way of working it is
   decided (2026-10-11): the writing sub-agent on Haiku 5.5.
7. The gate run by GitHub on every pull request: the repository is private, so its runs spend
   the account's minutes ("Session channel", the order, item 2). **Answered on 2026-10-13, held
   by "JH 10 · comprobación en GitHub"** (by line 12000 above), each line read with `sessions
   --quote` in the lead's transcript `65318fd5`: no payment method on the GitHub account, now or
   later ("no tiene tarjeta, dejémosla sin tarjeta", line 12461); the gate on GitHub runs on
   Linux at each push to a pull request with code ("En cada PR con código (Recomendada)", line
   12491). JH 10's `odd/tasks/gate-on-github.md` holds the design. **Its exchange (R1, T7) was
   closed on 2026-10-16 as superseded by merge-queue**: "Sí, cerrala (Recomendada)" (the lead's
   transcript `e152c9d8`, line 7753, read with `sessions --quote`).
8. The proposal for the Codex plugin: the `doctor` row, `codex:rescue`, its three hooks
   (`odd/tasks/codex-review-lean.md`, "Proposal for the Codex plugin").
9. **Answered on 2026-10-13: one page and each command** ("Una página y cada comando", question
   22, the lead's transcript `65318fd5`, line 10979, read with `sessions --quote`); built on
   2026-10-14 (pull request 123), with a test that holds its commands to the dispatcher's.
   What the README holds (Next, the defects read on 2026-10-13, item b). Options: what the
   harness is and how to install and remove it, in one page; that and each command with an
   example; or none until the first version, with the roadmap as the only description.
10. **Answered on 2026-10-13: `bin/` without its tests and no `AGENTS.md`** ("Solo los comandos",
    question 24; built the same day, item c). What the package ships (the same list, item c).
    Options: `bin/` without its tests and no
    `AGENTS.md`, since an installed project gets its own from `init`; `bin/` whole and no
    `AGENTS.md`; or as today.

Closed: the F5 spend ceiling (none; see Decided, Eval spend). F6's missing trials: closed
without them, on 13 of 15, by his answer of 2026-10-12 (Next, item 1, with its line). Whether
`init` writes a version into a `harness.json` that has none: it does not, as today ("Dejarlo
como hoy (Recomendada)", the lead's transcript `65318fd5`, line 12059, 2026-10-13, read with
`sessions --quote`; JH 8's `odd/tasks/install-update.md` holds it).

## Risks

- A stack release changes the machine under a running feature. gentle-ai 4 and engram 3 did on
  2026-10-01: a hook left calling a removed command, the Codex model reset by a sync, and plugin
  hooks that reach the engram server past the eval sandbox (`odd/tasks/stack-v4.md`,
  `odd/tasks/evals.md` T4a). `doctor` and `check` now report the first and the last; an eval
  run fixes the stack's versions for its whole length.
- gentle-ai #4036 may never ship, leaving the largest block uncontrollable; v4 made that block 2.4 times larger for Codex (87,562 bytes of global `AGENTS.md`), which F6 will measure.
- Opus 5.5 defaults may shift after launch.
- Discriminating evals cost money.

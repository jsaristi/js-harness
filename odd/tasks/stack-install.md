# Stack install: the module that installs the third-party tools the harness requires

Locator: `odd/tasks/stack-install.md` · Engram mirror: `odd/stack-install/tasks` · Branch: `feat/stack-install`, in
`D:\js-harness-worktrees\stack-install`, cut from `origin/main` at `24110236` · Runner: `node --test` · Delivery:
ask-on-risk, two slices stacked to `main` after his yes. Design version 1, before its readers.

## Goal
On a machine that lacks part of the stack, one command shows each missing tool the project needs with the command
that installs it, runs those commands one at a time with consent, records each so `uninstall` undoes it, and leaves
`doctor` with no install gap for them.

## Why
His words (2026-10-19): "tenemos que colocar el modulo de install 3rd plugins o complementos obligatorios". Today
`doctor` and the TUI's stack block name a fix command for every gap (`bin/lib/stack.mjs:275-405`), and nothing runs
them: a new machine, or another person, copies them by hand, in an order that matters (gentle-ai's own install
registers engram and codegraph, so a hand-run of every line does work twice), and nothing records what they wrote,
which breaks the rule that every write outside the repo can be undone exactly (`AGENTS.md`, "What good looks like").

## Done when
- `node --test bin/stack.test.mjs bin/lib/stack-install.test.mjs bin/lib/manifest-stack.test.mjs bin/install.test.mjs bin/tui.test.mjs` exits 0
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/stack-install.md` exits 0
- `node scripts/stack-scratch.mjs` exits 0 — the trial of D9 on a scratch home: every mandatory tool missing there is
  installed, `doctor --home <scratch> --json` then shows no `installed` gap for them, and `uninstall --global --home
  <scratch>` leaves none of them behind
- Nothing of his real home or his real global tools changes during any test or the trial (D9 checks the hash of
  his `~/.claude.json`, `~/.codex/config.toml` and the global npm prefix's package list before and after)

## In scope / Out of scope
- In: `bin/stack.mjs`, `bin/lib/stack-install.mjs` and their tests; the `stack` record of the machine manifest and
  its undo in `uninstall` (`bin/lib/manifest.mjs`, `bin/install.mjs`); one TUI item (`bin/tui.mjs`); the dispatcher's
  help (`bin/js-harness.mjs`); `scripts/stack-scratch.mjs`; README, `docs/SPEC.md`, the ROADMAP line.
- Out: the project's codegraph index — `init` and `sync` make it from the codeMap switch and record it in the project
  manifest already (D3). Logins (`claude auth login`, `codex login`): they take his credentials, so the module names
  them and never runs them (D3). The Claude CLI itself: it is the host the harness runs in. `package.json`: the
  orchestrator owns versions. Onboarding's files (`odd/tasks/onboarding.md`, `bin/onboard.mjs`): another session
  builds them; D8 is the contract it can call.

## Constraints
- Zero dependencies, and every command this module runs is a third-party CLI's own install, never a download it
  makes itself — because the harness runs with no install step and must not become a package manager.
- Nothing runs before it is shown, and nothing runs without consent, one command at a time — because each one
  writes outside the repo, some into his host config.
- Every command it runs has an exact undo recorded before it starts — because `uninstall` must undo it exactly; a
  command with no exact undo is never run, only shown (D4).
- No test ever runs a real install: the runner refuses under test unless handed a fake, as `runSchtasks` does
  (`bin/lib/manifest.mjs:1101-1102`) — because a test that installs touches his machine.
- Destructive or install steps run only against a scratch home until he approves the design (the task's rule).

## Ask me before
The design (this document, after its readers), one question through the orchestrator. While building: nothing else;
spend is one gate per commit, one gentle-ai review per work unit and one Codex review per slice, and the network of
the scratch trial (npm and `go install` downloads).

## Specs
- S1. His words (2026-10-19), verbatim: "tenemos que colocar el modulo de install 3rd plugins o complementos
  obligatorios".
- S2. The task given to this session (2026-10-19): decide which tools are mandatory and which optional, honoring the
  project switches in `harness.json` "functions" (codeMap, languageServer, codexReview); whether the module is a
  command, a TUI menu item, or both; how it runs each fix: "show the command first, then run it with consent, one
  tool at a time"; how every write outside the repo is recorded so `uninstall` can undo it exactly; how it relates to
  onboarding v3, which "may call it as a stage".
- S3. Done, as the task states it: "the module installs every missing mandatory tool on a scratch home; `doctor`
  then reports no install gap for those tools; `uninstall` undoes what the module wrote; every check in the feature
  document's contract exits 0."

## Tasks
- [ ] T1 (kind: design) This design, past its two readers, and his yes
- [ ] T2 (kind: build) Slice 1: `bin/lib/stack-install.mjs` (D2-D4 as data, the plan), `js-harness stack` read-only with `--json` (D5, D8), help, README, SPEC, with tests
- [ ] T3 (kind: build) Slice 2: `stack install` (D6), the manifest's `stack` record and its undo in `uninstall` (D7), the TUI item (D5), with tests
- [ ] T4 (kind: verify) `scripts/stack-scratch.mjs` and its run on a scratch home (D9), the result in the Log
- [ ] T5 (kind: docs) The ROADMAP line, a note to the onboarding session (D8), the reviews recorded

## Design

### What exists and is reused (read 2026-10-19)
- **The probes and their fixes**: `tools` (`bin/lib/stack.mjs:275-405`) probes gentle-ai, engram, codegraph, context7,
  typescript-lsp and the Codex CLI per dimension (`installed`, `claude`, `codex`, `project`, `upToDate`) and gives a
  fix per dimension; `probeStack` (`:701-705`) leaves out typescript-lsp when languageServer is off and codex when
  codexReview is off (`when`, `:376`, `:396`), and codegraph's `project` is `n/a` when codeMap is off (`:333-336`).
  `doctor` resolves the switches with `functionsOf` (`bin/doctor.mjs:180`); a gap is a state in `GAP_STATES`
  (`rowGaps`, `bin/doctor.mjs:83-90`).
- **The switches**: `auto` resolves from the project's file names (on where there is code); a value that cannot be
  read reads as on (`bin/lib/functions.mjs`, `SWITCHES`; `docs/SPEC.md:453`).
- **The machine manifest**: arrays of what was done on request (`ON_REQUEST = ['optional', 'tasks', 'settings']`,
  `bin/lib/manifest.mjs:868`), kept with `keepRecord`/`forgetRecord` (`:872-905`); `uninstall` undoes each and keeps
  a record whose undo failed, so a second run can finish (`tasks`, `:1460-1470`).
- **gentle-ai 4.2.0** (`gentle-ai --help`, run 2026-10-19): `install --agents <list> [--components <list>]
  [--preset <name>] [--dry-run]`, `uninstall --agents <list> [--components <list>] -y`. A dry run of `install
  --agents claude-code` here plans the preset `full-gentleman` with the components `claude-theme, context7, persona,
  engram, gga, opencode-gentle-logo, permissions, skills`; his `~/.gentle-ai/state.json` holds that preset, the
  agents `claude-code, codex, antigravity`, and `community_tools: ["codegraph"]`. So gentle-ai's install already
  installs and registers engram and context7, and may register codegraph: the order matters, and every gap is read
  again after each command.
- **Undo commands** (help read 2026-10-19): `claude mcp remove [-s scope] <name>`, `codex mcp remove <name>`, `claude
  plugin uninstall|disable <plugin>`, `npm uninstall -g`.

### D1. Mandatory and optional, from what the harness itself calls
A tool is **mandatory** when a harness command fails, or a rule of `AGENTS.md` cannot hold, without it; **optional**
when only the session's quality depends on it.

| Tool | Class | Why (evidence) |
|------|-------|----------------|
| gentle-ai (binary; configured for Claude and Codex) | mandatory | `AGENTS.md`: it "owns the workflow, task documents, TDD and review"; `npm run check` says whether a gentle-ai review is due, and the merge queue refuses a branch without its Log line |
| engram (binary; registered in both hosts) | mandatory | `AGENTS.md`: it "owns memory"; the feature document's mirror and `backup` read it |
| codegraph (binary; registered in both hosts) | mandatory while codeMap resolves to anything but `off` | `AGENTS.md`: it "owns code structure"; `init` builds its index |
| Codex CLI (binary) | mandatory while codexReview resolves to anything but `off` | the pre-push hook refuses a branch whose code commits no Codex record covers (`AGENTS.md`, "Working with Sebastián") |
| context7 (registered in both hosts) | optional | documentation lookups only; no harness command calls it |
| typescript-lsp (plugin; enabled) | optional, and shown only while languageServer is not `off` | language feedback only; off is the control of a measured load (`stack.mjs:369-372`) |

Only machine dimensions are installed: `installed`, `claude`, `codex`. `upToDate` is `update`'s and `upgrade`'s
domain, already shown by `doctor`; `project` is D3's.

### D2. One table of what the module runs, apart from `doctor`'s fix text
`doctor`'s fix strings stay what they are: text for a person. The module keeps its own table, keyed by tool and
dimension, whose every row holds the command as an argument list, its exact undo, and its class (`unattended` or
`interactive`). A gap with no row is **manual**: the module prints `doctor`'s fix and says it does not run it. The
table, first draft (the trial of D9 confirms each row before slice 2 closes):

| Tool · dimension | Runs | Undo recorded |
|------------------|------|---------------|
| gentle-ai · installed | `go install github.com/gentleman-programming/gentle-ai/v4/cmd/gentle-ai@latest`, only when `go` is on PATH; else manual (the release page) | the binary's path (`go env GOBIN`, else `<GOPATH>/bin`) and its sha256, removed only while unchanged, as an optional file is |
| gentle-ai · claude / codex | `gentle-ai install --agents claude-code` (or `codex`), gentle-ai's own default preset | `gentle-ai uninstall --agents claude-code --yes` |
| engram · installed / claude / codex | nothing first: gentle-ai's install above brings it. If still a gap: `gentle-ai install --agents <agent> --components engram` | `gentle-ai uninstall --agents <agent> --components engram --yes` |
| codegraph · installed | `npm i -g @colbymchenry/codegraph` | `npm uninstall -g --prefix <the prefix read with npm prefix -g before it ran> @colbymchenry/codegraph` |
| codegraph · claude | `claude mcp add -s user codegraph -- codegraph serve --mcp` | `claude mcp remove -s user codegraph` |
| codegraph · codex | `codex mcp add codegraph -- codegraph serve --mcp` | `codex mcp remove codegraph` |
| codex · installed | `npm i -g @openai/codex` | as codegraph's, with `@openai/codex` |
| context7 · claude / codex (optional) | `doctor`'s registration commands | `claude mcp remove -s user context7` / `codex mcp remove context7` |
| typescript-lsp · installed / claude (optional) | `claude plugin install …` / `claude plugin enable …` | `claude plugin uninstall …` / `claude plugin disable …` |

### D3. What it never runs
- **Logins** (`codex login`, `claude auth login`): they take his credentials. A login gap is printed as a step for
  him, after the installs.
- **The project's codegraph index**: `init` and `sync` make it from the codeMap switch and record it in the project
  manifest; the module says to run `js-harness sync` there when that row is a gap.
- **`upToDate` fixes**, `codegraph upgrade` (a user rule), and any command not in D2's table.

### D4. Consent: shown, then asked, one command at a time
Every command is printed, whole, before it runs. In a terminal, `stack install` asks `Run it? [y/N]` for each one and
an answer that is not `y` skips it and goes on. Without a terminal (a session's shell), `stack install` runs nothing
unless given `--yes`, and with `--yes` it runs only the tools named by `--tool <id>` (repeatable): the session shows
him the plan, asks him (through the lead where there is one), and runs one tool per call. After each command every
row is probed again, so a gap an earlier command closed is not run twice.

### D5. A command, and a TUI item that runs it
- `js-harness stack [--home <path>] [--cwd <path>] [--with-optional] [--json]`: read-only. Lists every missing
  mandatory tool (and optional ones with `--with-optional`) in run order: the command, its undo, or why it is manual.
  Exits 0 when nothing mandatory is missing, 1 when something is.
- `js-harness stack install [--home] [--cwd] [--with-optional] [--tool <id>]... [--yes]`: D4. Exits 0 when no
  mandatory gap is left, 1 when one is (declined, failed or manual), 2 on a usage error.
- The TUI gets one machine item, "Install the stack", shown only while `stack` reports a gap; it runs `stack install`
  in the terminal, so the y/N prompts of D4 are the TUI's consent. `install --stack` was weighed and dropped:
  `install` writes js-harness's own files and must stay safe to run unasked (`sync` runs it), and a flag there would
  turn a silent command into one that downloads.

### D6. How it runs a command
- As an argument list, never through a shell string, with the Windows handling the probes already use; stdio is
  inherited, so the tool's own output and prompts reach the person.
- `--home <dir>` other than the real home gives each child `HOME`, `USERPROFILE` and `CODEX_HOME=<dir>/.codex`, the
  same home `doctor --home` reads (`codexLoginState`, `stack.mjs:249-256`); npm's prefix and `GOBIN` come from the
  environment, and the record keeps what they were.
- The runner is a seam that refuses under test unless handed a fake (Constraints).

### D7. The record, and its undo
- A new array `stack` in the machine manifest, added to `ON_REQUEST`, one record per command run:
  `{ tool, dimension, run, undo, env, at }`, where `undo` is `{ argv }` or `{ path, sha256 }` and `env` the variables
  D6 set. The record is written **before** the command starts: a run killed halfway still leaves something
  `uninstall` can try.
- `uninstall --global` undoes the records in reverse order, printing each undo command before it runs it; a file
  undo removes the file only while its sha256 matches and otherwise keeps it, named, as an edited optional file is.
  An undo that fails keeps its record, alone, so a second `uninstall --global` finishes it, the way scheduled tasks
  are kept (`manifest.mjs:1460-1470`). A record of a tool that is already gone is just dropped.
- A tool that was already installed is never recorded and never undone: the module only undoes what it did.

### D8. Onboarding
Onboarding v3 (`odd/tasks/onboarding.md`, on `feat/onboarding`) can call `js-harness stack --json` at its Read stage:
exit 1 means a mandatory tool is missing, and its stage then tells the session to show him the plan and run `stack
install --tool <id> --yes` per tool after his yes. This module changes nothing of onboarding's files; a note in the
shared notes folder hands that session the contract (T5).

### D9. The trial on a scratch home
`scripts/stack-scratch.mjs` makes a scratch home under the system temp folder, an npm prefix and a `GOBIN` inside
it, and a `PATH` of only `node`, `npm`, `git`, `go` and the scratch bins; hashes his real `~/.claude.json`,
`~/.codex/config.toml` and `npm ls -g` first; runs `stack --json` (expects exit 1), `stack install --yes` with every
mandatory `--tool`, `doctor --home <scratch> --json` (expects no `installed` gap for those tools), `uninstall --global
--home <scratch>` (expects every recorded tool gone and the manifest removed); then checks the three hashes again and
removes the scratch folder. It needs the network, so it runs by hand and its result goes in the Log; it is not a
test.

## Reviews
None yet.

## Log
- L1 (2026-10-19) His request, verbatim: "tenemos que colocar el modulo de install 3rd plugins o complementos
  obligatorios". The task, from the session that started this one: design the module, with evidence, as an ODD
  feature document past two readers; product decisions go to the orchestrator one at a time; build it test-first
  after his yes.

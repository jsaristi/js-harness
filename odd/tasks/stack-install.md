# Stack install: the module that installs the third-party tools the harness requires

Locator: `odd/tasks/stack-install.md` · Engram mirror: `odd/stack-install/tasks` · Branch: `feat/stack-install`, in
`D:\js-harness-worktrees\stack-install`, cut from `origin/main` at `24110236` · Session: JH 31 · instalar complementos ·
Runner: `node --test` · Delivery: ask-on-risk, two slices stacked to `main` after his yes. Design version 3: version 1
after its two readers, and version 3 after the second round on their blockers (see `## Reviews`).

## Goal
On a machine that lacks part of the stack, one command shows each missing tool the project needs with the command
that installs it, runs those commands one at a time with consent, records each so `uninstall` undoes it exactly, and
leaves `doctor` with no install gap for them.

## Why
His words (2026-10-19): "tenemos que colocar el modulo de install 3rd plugins o complementos obligatorios". Today
`doctor` and the TUI's stack block name a fix for most gaps (`bin/lib/stack.mjs:275-404`), and nothing runs them: a
new machine, or another person, copies them by hand, in an order that matters (the Codex CLI before anything
registered in Codex; gentle-ai's own install brings engram and context7), and nothing records what they wrote, which
breaks the rule that every write outside the repo can be undone exactly (`AGENTS.md`, "What good looks like").

## Done when
- `node --test bin/stack.test.mjs bin/lib/stack-install.test.mjs bin/lib/manifest-stack.test.mjs bin/install.test.mjs bin/tui.test.mjs scripts/stack-scratch.test.mjs` exits 0
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/stack-install.md` exits 0
- The trial of D9, run by hand once slice 2 is built, is in the Log with its output: on a scratch home every row of
  D2 that was a gap is run, `doctor` (with the scratch's PATH) then reads `installed: ok` and every registration it
  ran `ok`, and `uninstall --global` leaves none of them behind; and every hash of D9's list of his real files is the
  same before and after

## In scope / Out of scope
- In: `bin/stack.mjs`, `bin/lib/stack-install.mjs` and their tests; the `stack` record of the machine manifest and its
  undo in `uninstall` (`bin/lib/manifest.mjs`, `bin/install.mjs`); one TUI item (`bin/tui.mjs`); the dispatcher's help
  (`bin/js-harness.mjs`); `scripts/stack-scratch.mjs` and the test of its pure parts; README, `docs/SPEC.md`, the
  ROADMAP line.
- Out: gentle-ai's own installer (`gentle-ai install`) and its undo: his answer to F1 (L4) keeps them his step (D3). The
  project's codegraph index: `init` and `sync` make it from the codeMap switch and record it in the project manifest.
  Logins (`claude auth login`, `codex login`, `gh auth login`): they take his credentials. The Claude CLI, `git`, `gh`,
  `node` and `go`: prerequisites the module checks and names, never installs (D1). `package.json`: the orchestrator
  owns versions. Onboarding's files: another session builds them; D8 is the contract it can call.

## Constraints
- Zero dependencies, and every command this module runs is a third-party CLI's own install or registration, never a
  download it makes itself — because the harness runs with no install step and must not become a package manager.
- Nothing runs before it is shown, and nothing runs without consent, one command at a time — because each one writes
  outside the repo.
- A command runs only when its undo is exact and recorded before it starts; one without an exact undo is shown, never
  run (D3) — because `uninstall` must undo exactly what the harness wrote, and nothing more.
- No test ever runs a real install: the runner refuses under test unless handed a fake, as `runSchtasks` does
  (`bin/lib/manifest.mjs:1101-1102`) — because a test that installs touches his machine.
- Install steps run only against a scratch home until he approves the design (the task's rule).

## Ask me before
F1 and then the design (this document), one question at a time through the orchestrator. While building: nothing
else; spend is one gate per commit, one gentle-ai review per work unit and one Codex review per slice, and the network
of the one scratch trial (package downloads).

## Specs
- S1. His words (2026-10-19), verbatim: "tenemos que colocar el modulo de install 3rd plugins o complementos
  obligatorios".
- S2. The task given to this session (2026-10-19): decide which tools are mandatory and which optional, honoring the
  project switches in `harness.json` "functions" (codeMap, languageServer, codexReview); whether the module is a
  command, a TUI menu item, or both; how it runs each fix: "show the command first, then run it with consent, one tool
  at a time"; how every write outside the repo is recorded so `uninstall` can undo it exactly; how it relates to
  onboarding v3, which "may call it as a stage".
- S3. Done, as the task states it: "the module installs every missing mandatory tool on a scratch home; `doctor` then
  reports no install gap for those tools; `uninstall` undoes what the module wrote; every check in the feature
  document's contract exits 0." Under his answer to F1 (option 1, L4), gentle-ai and engram are installed by gentle-ai's own
  installer, which the module names as his step (D3); S3 then holds for every other mandatory tool.

## Tasks
- [ ] T1 (kind: design) This design, past its two readers, F1 answered, and his yes
- [ ] T2 (kind: build) Slice 1: `bin/lib/stack-install.mjs` (D1-D3 as data, the plan, D7's record shape), `js-harness stack` read-only with `--json` (D5, D8), help, README, SPEC, with tests
- [ ] T3 (kind: build) Slice 2: `stack install` (D4, D6), the manifest's `stack` record and its undo in `uninstall` (D7), the TUI item (D5), `scripts/stack-scratch.mjs` (D9), with tests
- [ ] T4 (kind: verify) The trial of D9 on a scratch home, its output in the Log
- [ ] T5 (kind: docs) The ROADMAP line, the note to the onboarding session (D8), the reviews recorded

## Design

### What exists and is reused (read 2026-10-19)
- **The probes and their fixes**: `tools` (`bin/lib/stack.mjs:275-404`) probes gentle-ai, engram, codegraph, context7,
  typescript-lsp and the Codex CLI per dimension (`installed`, `claude`, `codex`, `project`, `upToDate`); `probeStack`
  (`bin/lib/stack.mjs:701-705`) leaves out typescript-lsp while languageServer is off and codex while codexReview is
  off (`when`, `bin/lib/stack.mjs:371` and `:391`); codegraph's `project` is `n/a` while codeMap is off
  (`bin/lib/stack.mjs:332-334`). Not every gap has a fix: gentle-ai's `installed` is a URL, context7 has no
  `installed` fix, and `rowGaps` allows `fix: null` (`bin/doctor.mjs:83-90`). `installed` probes run the binary found
  on the process's PATH (`spawnProbe`, `bin/lib/stack.mjs:57-62`, a joined line with `shell: true` on win32), so
  `--home` moves only the configuration read.
- **The switches**: `doctor` resolves them with `functionsOf` (`bin/lib/project-functions.mjs:94`, called at
  `bin/doctor.mjs:180`); `auto` resolves to on or off from the project's file names, and a value that cannot be read
  reads as on (`bin/lib/functions.mjs:14-17`, `docs/SPEC.md:453`). So the class of codegraph and Codex depends on the
  project in `--cwd`.
- **The package manager**: on this machine `npm` is a shim that runs pnpm (`/c/nvm4w/nodejs/npm` is `exec pnpm "$@"`,
  `npm prefix -g` prints `C:\Users\Oficina\AppData\Local\pnpm\global`). `pmKind`, `installPlan` and `runPm`
  (`bin/lib/version.mjs:97-135`, `bin/lib/package-manager.mjs:15-30`) already install a global package with either
  manager, into a prefix when one is given, quoted for cmd.exe.
- **The machine manifest**: arrays of what was done on request (`ON_REQUEST`, `bin/lib/manifest.mjs:868`), kept with
  `keepRecord`/`forgetRecord` (`bin/lib/manifest.mjs:872-905`); `uninstall` undoes scheduled tasks and keeps the record
  of one it could not undo, so a second run can finish it (`bin/lib/manifest.mjs:1470-1481`); the write-back of kept
  records (`bin/lib/manifest.mjs:1500-1501`) names `tasks` and `settings` and must name `stack` too.
- **gentle-ai 4.2.0** (help, a dry run and its source at `~/go/pkg/mod/github.com/gentleman-programming/gentle-ai/v4@v4.2.0`,
  read 2026-10-19): `install --agents claude-code` plans the preset `full-gentleman` (claude-theme, context7, persona,
  engram, gga, opencode-gentle-logo, permissions, skills); on Windows it adds folders to the user PATH in the registry
  (`internal/system/path.go:63-77`, called from `internal/cli/run.go:3139-3148` and `:3396-3399`). Its `uninstall`
  removes the whole `permissions` and `theme` keys of Claude's `settings.json`, not only what it added
  (`internal/components/uninstall/service.go:1010-1016`, `:1033-1037`), strips the engram registration whoever wrote
  it (`:1179`; `cleaners.go:136-139`), removes no binary and never takes the PATH entries back (`RemoveFromUserPath` is
  called only from `internal/opencode/background.go:324-325`). `gentle-ai restore <id>` puts a config backup back.
- **Undo commands** (help read 2026-10-19): `claude mcp remove [-s scope] <name>`, `codex mcp remove <name>`; the
  package manager's own remove.

### F1. The fork for him: gentle-ai's installer — answered: option 1 (L4)
gentle-ai and engram are mandatory, and both come from gentle-ai's installer, whose undo is not exact (above). Three
ways:
1. **Recommended: his step, named, not run.** The module checks gentle-ai and engram, and when one is missing prints
   gentle-ai's own install (`go install …/v4/cmd/gentle-ai@latest`, then `gentle-ai install --agents …`) as a step he
   runs, with gentle-ai's own undo (`gentle-ai uninstall`, `gentle-ai restore`) beside it; it records nothing for them,
   because it wrote nothing. Everything else mandatory is run and undone exactly. Smallest, and the undo rule holds.
2. **Run it, and undo it with gentle-ai's backup.** The module runs `gentle-ai install`, records the backup id it
   made, the user PATH value before it, and the binaries that were absent, and `uninstall` restores the backup, puts
   the PATH value back and removes those binaries. About one more slice, and it writes his registry PATH.
3. **Run it, and only name its undo.** Breaks the undo rule of `AGENTS.md`; listed to be rejected.

### D1. Mandatory, optional and prerequisite
Mandatory: a component `AGENTS.md` says the harness stands on, or one a harness command needs to work. Optional: only
the session's quality depends on it.

| Tool | Class | Why (evidence) |
|------|-------|----------------|
| gentle-ai (binary; configured for Claude and Codex) | mandatory | `AGENTS.md`: it "owns the workflow, task documents, TDD and review". The review row of `check` fails open without it (`bin/check.mjs:2022-2030`), so nothing stops a commit: the gap is silent, which is why it must be installed |
| engram (binary; registered in both hosts) | mandatory | `AGENTS.md`: it "owns memory"; `backup` throws without it (`bin/backup.mjs:195-197`) |
| codegraph (binary; registered in both hosts) | mandatory while codeMap resolves to anything but `off` | `AGENTS.md`: it "owns code structure"; `init` prints `codegraph init failed` and still exits 0 without it (`bin/init.mjs:79`) |
| Codex CLI (binary) | mandatory while codexReview resolves to anything but `off` | the pre-push hook refuses code commits no Codex record covers; the escape is a skip he records by hand each time (`codex-review --unavailable`, `bin/codex-review.mjs:235`) |
| context7 (registered in both hosts) | optional | documentation lookups; no harness command calls it (`grep -rln context7 bin scripts`, tests left out: only `doctor.mjs` and `stack.mjs`) |
| typescript-lsp (plugin) | optional, shown only while languageServer is not `off` | language feedback only; off is the control of a measured load (`bin/lib/stack.mjs:367-370`) |
| Claude CLI, `git`, `gh`, `node`, `go` | prerequisite: checked and named, never installed | the host itself; `git` and `gh` are spawned by many commands (`merge-queue`, `backup`, `notify`); `gh` needs a login |

Optional tools are classified and shown with `doctor`'s fix, never run (S2 asks to classify them; cutting their rows
keeps the table to what the harness needs). Only machine dimensions are installed: `installed`, `claude`, `codex`.

### D2. What the module runs, in this order, apart from `doctor`'s fix text
`doctor`'s fix strings stay text for a person. The module keeps its own table, keyed by tool and dimension; each row
holds the command as words, its exact undo, and a check that the undo still applies. Rows run in this order, and every
row is probed again after each command, so a gap an earlier command closed is not run twice:

| # | Tool · dimension | Runs | Undo recorded | Undo applies while |
|---|------------------|------|---------------|--------------------|
| 1 | codex · installed | the package manager's global install of `@openai/codex` (`installPlan`) | its global remove, with the same manager and prefix | the installed version is the one recorded |
| 2 | codegraph · installed | the same, for `@colbymchenry/codegraph` | as row 1 | as row 1 |
| 3 | codegraph · claude | `claude mcp add -s user codegraph -- codegraph serve --mcp` | `claude mcp remove -s user codegraph` | the registration is still there |
| 4 | codegraph · codex | `codex mcp add codegraph -- codegraph serve --mcp` | `codex mcp remove codegraph` | as row 3 |

With F1 answered as option 1, gentle-ai has no row. A row whose tool's switch is off is never run; a
gap with no row is printed with `doctor`'s fix as manual.

### D3. What it never runs
- gentle-ai's installer, F1 answered (option 1): printed as his step, with its undo.
- Logins and the prerequisites of D1; the project's codegraph index (it says to run `js-harness sync` in the project).
- `upToDate` fixes, `codegraph upgrade` (a user rule), and any command not in D2's table.

### D4. Consent: shown, then asked, one command at a time
Every command is printed whole, with its undo, before it runs. In a terminal, `stack install` asks `Run it? [y/N]` for
each one; any answer but `y` skips it and goes on. Without a terminal (a session's shell), `stack install` runs nothing
unless given `--yes`, and with `--yes` only the tools named by `--tool <id>` (repeatable): the session shows him the
plan, asks him (through the lead where there is one), then runs one tool per call.

### D5. A command, and a TUI item that runs it
- `js-harness stack [--home <path>] [--cwd <path>] [--json]`: read-only. Lists every missing mandatory tool in D2's
  order with its command and undo, every manual step (F1's step, logins, prerequisites) and every optional gap with
  `doctor`'s fix. Exits 0 when nothing mandatory is missing, 1 when something is, 2 on a usage error. `--json` prints
  `{ mandatory: [{ tool, dimension, run, undo }], manual: [{ tool, dimension, why, fix }], optional: [...] }`, the shape
  onboarding reads (D8).
- `js-harness stack install [--home] [--cwd] [--pm npm|pnpm] [--prefix <dir>] [--tool <id>]... [--yes]`: D4. Exits 0 when no mandatory gap is left that
  it could run, 1 when one is (declined, failed or timed out), 2 on a usage error.
- The TUI gets one machine item, "Install the stack", shown only while `stack` reports a mandatory gap; it runs `stack
  install` in the terminal, so D4's prompts are the TUI's consent.
- `install --stack` was weighed and dropped: `install` writes js-harness's own files and is meant to be safe to run
  unasked; a flag there would make one command both silent and downloading.

### D6. How it runs a command
- The package manager is resolved as `upgrade` resolves it: `--pm`, else `JS_HARNESS_PM`, else the one that installed
  the running copy (`resolvePm`, `bin/update.mjs:36-39`, `copyPackageManager`, `bin/lib/package-manager.mjs:40-42`),
  never from the word `npm`: here `npm.cmd` is `pnpm %*`, so `pmKind(['npm'])` would say npm and give pnpm a
  `--prefix` it has no option for. The record keeps the manager and its prefix, and the undo is that manager's own
  remove (`pnpm remove -g` with the same `PNPM_HOME` and folders, or `npm uninstall -g --prefix`).
- Package installs through `installPlan` and `runPm` (pnpm or npm, cmd.exe quoting). `claude` and `codex` the same
  way: one joined line with `shell: true` on win32, each word through `cmdWord`; a word holding `%` or `"` is refused,
  never run, as `upgradeMain` does.
- Under `--yes`, stdin is ignored and each command has a timeout (two minutes for a package install, thirty seconds
  for a registration); a timed-out command counts as failed. In a terminal stdio is inherited.
- `--home <dir>` other than the real home gives each child `HOME`, `USERPROFILE`, `CODEX_HOME=<dir>/.codex` (the home
  `doctor --home` reads, `codexLoginState`, `bin/lib/stack.mjs:249-256`), and `APPDATA`/`LOCALAPPDATA` inside it; the
  package prefix comes from `--prefix <dir>` when given (the trial), else the manager's own.
- The runner is a seam that refuses under test unless handed a fake (Constraints).

### D7. The record, and its undo
- A new array `stack` in the machine manifest, added to `ON_REQUEST` and to the kept-records write-back, one record
  per row run, keyed by tool and dimension (a second run replaces it): `{ tool, dimension, run, undo, applies, env, at }`,
  where `applies` is what D2's last column checks: for a package, the version installed; for a registration, the
  entry the command wrote, read back right after it ran (Claude's `mcpServers.codegraph` object, which
  `claudeJsonMcpServer` already returns, `bin/lib/stack.mjs:105-112`; Codex's `[mcp_servers.codegraph]` table, read
  by a new reader of that one section), since the probes see only that a name is present
  (`bin/lib/stack.mjs:87-97`) and a name alone cannot tell the harness's entry from his own. It is written
  **before** the command starts, so a run killed halfway leaves something `uninstall` can try.
- After the command, the row is probed: still a gap after a failure, and the record is dropped, since nothing of it
  stayed and a later install of his own must not be undone; `ok`, and it stays with the version read.
- `uninstall --global` undoes the records in reverse order, printing each undo before running it. Before each, it
  probes: a tool already gone loses its record; one whose `applies` no longer holds (he upgraded codex, or registered
  codegraph again by hand with another entry) is kept and named, its record dropped; otherwise the undo runs, and one that fails keeps its
  record, alone, so a second `uninstall --global` finishes it, as scheduled tasks are kept. Why `--global` and not
  `--everything`: `AGENTS.md` names `uninstall` as the undo of what the harness writes, and these are the harness's
  writes; a tool he wants to keep he installs himself, and then nothing records it.
- A tool that was already there is never recorded, so it is never undone.

### D8. Onboarding
Onboarding v3 (`odd/tasks/onboarding.md`, on `feat/onboarding`) can call `js-harness stack --json` at its Read stage:
exit 1 means a mandatory tool is missing; its stage then tells the session to show him the plan and, after his yes,
run `stack install --tool <id> --yes` per tool, and to print the `manual` steps for him. This module changes nothing of
onboarding's files; a note in the shared notes folder hands that session this contract (T5).

### D9. The trial on a scratch home
`scripts/stack-scratch.mjs`, run by hand (it downloads; it is in no gate and no contract command), with its pure parts
(the environment it builds, the list it hashes, the verdict) tested by `scripts/stack-scratch.test.mjs`:
- A scratch folder under the system temp folder holds the home, `APPDATA`, `LOCALAPPDATA`, the package prefix (pnpm's
  folders through `installPlan`) and a `bin` of shims for exactly `node`, the package manager, `git` and `claude`, so
  no folder of his real tools is on its PATH: on this machine node's folder is also where his global codegraph lives.
  The scratch PATH is that `bin` and the prefix's own `bin` (where the installed `codex` and `codegraph` land), for
  every command it runs, `doctor` included; it passes `--pm pnpm` (or the manager the machine has) explicitly.
- Before and after, it hashes his real `~/.claude.json`, `~/.claude/settings.json`, `~/.codex/config.toml`,
  `~/.codex/AGENTS.md`, the listing of his global packages (`pnpm ls -g`) and the user PATH
  (`reg query HKCU\Environment /v Path`); any difference fails the trial.
- It runs `stack --json` (expects exit 1 and D2's four rows), `stack install --yes` with each `--tool`, `doctor --json`
  under the scratch PATH and home (expects `installed: ok` for codex and codegraph and `ok` for both registrations; an
  `unknown` fails it), then `uninstall --global` (expects the four records undone and the manifest removed, and the
  scratch prefix to hold neither package), and removes the scratch folder. A `--cwd` with a program file makes codeMap
  and codexReview resolve on. codegraph's own files under the scratch home go with it, and `DO_NOT_TRACK=1` is set.

## Reviews
- Round 1 (2026-10-19), on version 1, two read-only readers (opus).
  - Claims reader: 4 blockers, 8 advisories. Blockers: `gentle-ai uninstall` removes whole keys he had; `gentle-ai
    install` writes his user PATH and leaves binaries no undo removes; `npm` here is pnpm, so `--prefix` undo and the
    trial's npm prefix fail; `go install` writes his real GOPATH. Advisories: D1's evidence overstated (check fails
    open, init exits 0, Codex has a skip); D5's `sync` reason mis-cited; D6's Windows rule self-contradictory; D9 could
    pass vacuously; codegraph telemetry files; the kept-records write-back; three line offsets.
  - Gaps reader: 9 blockers, 5 advisories. Blockers: the trial's PATH lets his real codegraph in; `doctor` run on the
    parent's PATH; "no gap" passes `unknown`; gentle-ai writes LOCALAPPDATA, APPDATA, GOPATH, GOCACHE and PATH; the hash
    list too short; gentle-ai's undo not exact; engram's data unprotected; `.cmd` shims need the shell; the networked
    trial in the contract would run after every change. Advisories: hangs with no terminal; re-runs and undo of
    something gone or changed; missing prerequisites (`gh`, `git`, the Claude CLI) and run order; codexReview's skip;
    scope (cut the optional rows, fix the `--json` shape).
  - Taken in version 2: F1 isolates the gentle-ai installer as his decision, with option 1 recommended (which removes
    the GOPATH, PATH, engram-data and gentle-ai-undo blockers by not running it); D1's evidence rewritten; D2 shrunk to
    four rows run in order, each with an `applies` check; D6 uses `installPlan`/`runPm`/`cmdWord`, timeouts, no stdin
    under `--yes`; D7 drops a failed row's record, probes before undo, carries `stack` in the write-back; D9 rebuilt
    (shims, scratch PATH for `doctor`, `ok` not "no gap", a longer hash list with the registry PATH, out of the
    contract). Not taken: putting the undo behind `--everything` (D7 says why).
- Round 2 (2026-10-19), on version 2, one read-only reader (opus), only on round 1's 13 blockers: 7 closed, 5 closed
  under F1's option 1 (both gentle-ai undo blockers, `go install`'s GOPATH, gentle-ai's other writes, engram's data;
  the hash list too, for the four rows), 1 open: the manager was still read from the word `npm`, which here runs pnpm.
  One new blocker from version 2's own fix: `applies` held only a registration's name, which cannot tell his entry
  from the harness's. Checked and not blockers: `claude mcp add` under a scratch `USERPROFILE` reads and writes only
  the scratch `.claude.json` (it ran `claude mcp get codegraph` there and removed the folder); moving `APPDATA` and
  `LOCALAPPDATA` breaks nothing. Advisory: the trial's PATH must hold the prefix's `bin`.
  - Taken in version 3: D6 resolves the manager as `upgrade` does and records it; D7's `applies` for a registration is
    the entry written, read back; D9's PATH holds the prefix's `bin` and passes `--pm`. Not read again.

## Log
- L1 (2026-10-19) His request, verbatim: "tenemos que colocar el modulo de install 3rd plugins o complementos
  obligatorios". The task, from the session that started this one: design the module, with evidence, as an ODD
  feature document past two readers; product decisions go to the orchestrator one at a time; build it test-first
  after his yes.
- L2 (2026-10-19) Version 1 committed (47851203); round 1 of its readers in `## Reviews`; version 2 written from it.
- L3 (2026-10-19) Version 2 committed (e5505407). F1 sent to the orchestrator as question 23 (recommended: option 1).
  Round 2 on the blockers in `## Reviews`; version 3 written from it. Next: his answer to question 23, then the
  question of his yes to the design.
- L4 (2026-10-19) His answer to question 23, relayed by the orchestrator (answer 23 on the channel), verbatim: "Paso
  tuyo, nombrado (Recomendado)". So F1 is option 1: the module detects gentle-ai and engram, prints their command and
  their undo, and neither runs nor records them; it installs, and undoes exactly, only the Codex CLI, codegraph and
  their MCP registrations. Next: the question of his yes to the design.

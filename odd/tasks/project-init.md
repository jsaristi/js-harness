# Project init

Locator: `odd/tasks/project-init.md` · Engram mirror: `odd/project-init/tasks` · Branch: `feat/project-init`

## Objective
Enable js-harness per project, like `git init`: `js-harness init` writes the committed per-project
files, records each one in a project manifest so `uninstall` there restores the repo exactly, and
`sync` moves a project to its pinned version. The TUI offers the commands that fit where it runs,
and `doctor` covers the Codex plugin whose review of each approved slice becomes verifiable.

## Why
Until now js-harness is installed once per machine and does nothing inside a project. The roadmap
decided the two levels (installed per machine, enabled per project) and the per-project files
(`docs/ROADMAP.md`, Decided: "Two levels", "Per project"). Two gaps sit next to it: the Codex
review of each approved slice depends on the agent remembering it, and nothing notices a skip; and
the release source decided for a private repo (a git-spec global install) had never been tried
through this machine's package manager.

## Scope
- In: the git-spec global install (T1); `init`, the project manifest and `uninstall` in a project
  (T2, T3); project `sync` to the pinned version (T4); the context-aware TUI (T5); the Codex plugin
  in `doctor` (T6); a verifiable record of the Codex review (T7); tests and docs for each.
- Out: installing or configuring any other tool (the stack-visibility rule); npm publish (the repo
  is private); Antigravity.

## Constraints
- Zero dependencies; every command keeps `--cwd`/`--home` injectable so tests use fixture folders.
- Everything written outside this repo, and every file `init` writes inside a project, is recorded
  so it can be undone exactly (AGENTS.md, "What good looks like").
- On this machine `npm` on PATH is a pnpm 12.6.0 shim (`C:\nvm4w\nodejs\npm.cmd` is `pnpm %*`), so
  an install command must work through pnpm, not only through the real npm CLI.

## Acceptance criteria (done when)
- The seven roadmap steps under "Project init" hold, each with its evidence recorded here.
- `npm run check` and `npm run e2e` pass.

## TDD
Mode: strict (source: user global config). Runner: `node --test`.

## Delivery
Forecast: well over 400 authored lines across the seven tasks (T2–T5 alone add a command, a
manifest and the TUI changes). Strategy: `ask-on-risk`; the chain strategy is asked once before
T2's first commit. T1 is small and ships as the first slice.

## Tasks
- [ ] T1 A git-spec global install works through the pnpm shim: drop the `prepare` script that
  pnpm refuses for git-hosted packages, prove the install with no extra flag, and leave the global
  js-harness current with `main` — route: inline (`package.json` + one test file, mechanical)
- [ ] T2 `init` writes `harness.json`, a base `AGENTS.md` if none exists, the pre-commit gate, and
  runs `codegraph init`, all recorded in a project manifest — route: delegated writer
- [ ] T3 `uninstall` in a project restores it exactly — route: delegated writer
- [ ] T4 `sync` moves a project to its pinned version — route: delegated writer
- [ ] T5 The TUI offers `init`/`sync`/`status` inside a project and `doctor`/`upgrade` outside one
  — route: delegated writer
- [ ] T6 `doctor` reports the Codex plugin (`codex@openai-codex`): installed, enabled and logged
  in, with its fix command — route: delegated writer
- [ ] T7 The Codex review of each approved code slice leaves a record a check verifies, so a
  skipped review is caught — route: to be decided after exploration

## Progress
- 2026-09-28: T1 measured before any change. `npm i -g github:jsaristi/js-harness` through the
  shim exits 1 with `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`: the git-hosted package "needs to
  execute build scripts but is not in the allowBuilds allowlist". The only build script is
  `prepare` (`git config core.hooksPath .githooks || exit 0`), which exists to wire this repo's
  pre-commit hook for its developers and does nothing for an installed copy. In an isolated pnpm
  global (`PNPM_HOME` and `pnpm_config_global_bin_dir` in the scratchpad):
  `--allow-build=js-harness` still fails the same way (pnpm wants the full git URL with the
  commit), while `--ignore-scripts` installs and the binary runs (`--help`, `progress`).
- 2026-09-28: global js-harness moved to `main` (36f2cee). The old copy in `C:\nvm4w\nodejs`
  (an `npm pack` tarball installed with the real npm CLI, lacking `progress`) came first on PATH
  and would shadow a pnpm install, so it was removed with the real npm CLI (`npm-cli.js rm -g
  js-harness` → `removed 1 package`). Then `npm i -g --ignore-scripts github:jsaristi/js-harness`
  through the shim → `+ js-harness 0.1.0`, exit 0; `which -a js-harness` →
  `C:\Users\Oficina\AppData\Local\pnpm\bin\js-harness` only. The 32 files of `bin/` and
  `AGENTS.md` at 36f2cee match the installed copy byte for byte once CR is stripped (the clone
  checks out CRLF; harmless on Windows, where the `.cmd` shim calls `node` directly).
  `js-harness sync` exit 0, `~/.js-harness/manifest.json` unchanged, exactly one
  `js-harness doctor --hook` entry in each of `~/.claude/settings.json` and `~/.codex/hooks.json`;
  `js-harness doctor --hook` exit 0 with 0 stderr bytes; `js-harness progress` runs.
  pnpm warned it could not remove `pnpm\bin\.pnpm-bin-backup-i7FIYv` (os error 32, a file in use);
  the folder remains and is pnpm's own.
- 2026-09-28: T1 fix. RED: `node --test bin/package.test.mjs` (new: the package declares no
  install-time lifecycle script) failed with `actual: [ 'prepare' ]`, `expected: []`. Replaced
  `prepare` with a plain `hooks` script (`npm run hooks` wires `.githooks` in a fresh clone; this
  checkout already has `core.hooksPath=.githooks`), and said so in `AGENTS.md`. GREEN: the test
  passes; `npm run check` → `PASS budget 1150 estimated tokens (budget 1500)`, `PASS tests`;
  `npm run e2e` → every step PASS. Install proof in an isolated pnpm global, no flag: `pnpm add -g
  git+file:///D:/js-harness#36f2cee` (main, with `prepare`) → `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`,
  exit 1; the same from a scratch clone with this change committed (654e5e1) → `+ js-harness
  0.1.0`, exit 0, and the installed `js-harness progress` runs. Pending to close T1: after the
  merge, `npm i -g github:jsaristi/js-harness` with no flag against GitHub, which also moves the
  global to the merged `main`.
- 2026-09-28: T1 committed as 1c62ea4. Assessed (`--base-ref 36f2cee --committed-only`): risk
  `medium` (`executable_change` on `AGENTS.md`), 121 changed lines, `review_due: false`
  (`under_budget`); reviewed anyway because the slice ships alone as a PR. Native review lineage
  review-687e4003cf557557: consent granted (pre-granted), one lens (reliability), approved and
  acknowledged. Two advisory findings, non-blocking, carried as later work: R3-hook-wiring-now-opt-in
  (WARNING: a fresh clone gets no pre-commit gate until `npm run hooks`, and nothing reports it —
  T2's `init` writes the pre-commit gate, and running it on this repo closes the gap) and
  R3-install-script-list-incomplete (SUGGESTION: add the legacy `prepublish` to the test's list;
  folded into T2's first commit). Codex review (`codex-companion.mjs review --wait --base 36f2cee`):
  the first run could not assess (process creation denied in its sandbox); the retry found "no
  actionable defects", comparing the base and head git objects directly with commands still
  denied, so it did not rerun the tests.
- Observed, out of scope: `js-harness status` reports `latest available: (unknown)` because it
  asks the npm registry, where the package is not published; the decided release source for a
  private repo is `git ls-remote --tags`, and no tag exists yet.

## Next step
Merge the first slice's PR (T1), then reinstall the global from GitHub with no flag and check T1
off; the chain strategy for T2–T7 is asked before T2's first commit.

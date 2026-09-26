# Install, update and a TUI

Locator: `odd/tasks/install-update.md` · Engram mirror: `odd/install-update/tasks` · Branch: `feat/install-update`

## Objective
Prove, before anything is published, that js-harness can install itself into a machine, detect a
newer release, upgrade, re-sync what it installed, and uninstall exactly — from a zero-dependency
TUI and from plain commands.

## Why
Sebastián wants js-harness installable and updatable like gentle-ai. The predecessor stack's
uninstall needed four hand-written purge scripts; this proves the opposite shape first.

## Scope
- In: `bin/` commands `status`, `install`, `sync`, `update`, `upgrade`, `uninstall`, the TUI, their
  tests, and an end-to-end proof script. `package.json` scripts.
- Out: publishing to npm, creating the GitHub remote (his decisions), installing third-party tools
  (gentle-ai, engram, codegraph, context7 have their own installers).

## Constraints
- Zero runtime dependencies — plain Node ≥22, so it runs anywhere without an install step.
- Every file written outside the repo is recorded in a manifest (path + sha256) under the target
  home; uninstall removes exactly those files, and keeps (and reports) any file the user edited.
- The package manager is not assumed: on this machine `npm` is a pnpm shim. The upgrade command
  is injectable; tests never touch the real global install or the real home.

## Design (first cut)
- Components are data: an array of `{ id, target, content }`. First real component: a
  `js-harness` skill for Claude Code (`~/.claude/skills/js-harness/SKILL.md`) and Codex
  (`~/.codex/skills/js-harness/SKILL.md`) describing its commands. Component choice is revisable.
- Release source is injectable: npm registry by default (`<pm> view js-harness version`); a local
  directory of `npm pack` tarballs for testing (`--source <dir>`).
- `upgrade` installs the newer package, then runs the NEW version's `sync` so installed files match
  the new release.

## Acceptance criteria (done when)
- `npm run check` passes.
- `npm run e2e` exits 0: packs 0.1.0, installs into a temp prefix + temp home, packs 0.2.0 into a
  temp release dir, `status` reports the update, `upgrade` moves to 0.2.0 and re-syncs the
  manifest, `uninstall` leaves the temp home as it was.
- `js-harness` with no arguments in a terminal opens the TUI; without a terminal it prints help.

## TDD
Mode: strict (source: user global config). Runner: `node --test`.

## Delivery
Strategy: ask-on-risk. Forecast: ~500–700 authored lines — above the ~400 slice budget. No remote
exists yet, so no PR chain applies; slices are work-unit commits, reviewed per commit.

## Tasks
- [x] T1 Manifest-based install / sync / uninstall engine — route: delegated writer
- [x] T2 Version check and upgrade with injectable source and package manager — route: delegated writer
- [x] T3 Zero-dependency TUI over the same commands — route: delegated writer
- [x] T4 End-to-end proof (`npm run e2e`) — route: delegated writer

## Progress
- 2026-09-26: document created. Measured: `npm` on PATH is `exec pnpm "$@"` (pnpm 12.6.0); the real
  npm CLI 11.12.1 lives at `C:\nvm4w\nodejs\node_modules\npm\bin\npm-cli.js`.
- 2026-09-26 T1 (a1c3063): `bin/lib/manifest.mjs` (components as data, sha256, install/sync/uninstall)
  + `bin/install.mjs` (CLI wrapper, `--home` injectable) + dispatcher wiring in `bin/js-harness.mjs`.
  RED: `node --test bin/lib/manifest.test.mjs` → `ERR_MODULE_NOT_FOUND` for `./manifest.mjs`; then
  `node --test bin/install.test.mjs` → `ERR_MODULE_NOT_FOUND` for `./install.mjs`. GREEN: full
  `node --test` → 23 pass, 0 fail; `node bin/check.mjs` → PASS budget (691/1500), PASS tests, exit 0.
- 2026-09-26 T2 (ed0e4b6): `bin/lib/version.mjs` (pure semver compare, tarball-source listing,
  command-arg builders) + `bin/update.mjs` (`status`/`update`/`upgrade`, package manager and source
  injectable, spawn injectable so tests never invoke a real package manager) + dispatcher wiring.
  RED: `node --test bin/lib/version.test.mjs` → `ERR_MODULE_NOT_FOUND` for `./version.mjs`; then
  `node --test bin/update.test.mjs` → `ERR_MODULE_NOT_FOUND` for `./update.mjs`. GREEN: full
  `node --test` → 44 pass, 0 fail; `node bin/check.mjs` → PASS budget (691/1500), PASS tests, exit 0.
- 2026-09-26 T3: `bin/tui.mjs` — pure `initialState`/`handleKey`/`render`/`normalizeKey`, plus the
  thin `runTui` I/O shell and `tuiMain` CLI entry (spawn and stdin/stdout injectable). Dispatcher's
  no-arg branch opens the TUI when both `stdin.isTTY` and `stdout.isTTY`, else prints the existing
  help; `--help` always prints help regardless of TTY. RED: `node --test bin/tui.test.mjs` →
  `ERR_MODULE_NOT_FOUND` for `./tui.mjs`; then the dispatcher's own TTY-branch test failed with
  `TypeError: stdin.setEncoding is not a function` (real `tuiMain` ran because `run` did not yet
  accept an injectable `tui`). GREEN: full `node --test` → 59 pass, 0 fail; `node bin/check.mjs` →
  PASS budget (691/1500), PASS tests, exit 0.
- 2026-09-26 T4: `scripts/e2e.mjs` + `package.json` `"e2e"` script (not part of `check`). Resolves
  the real npm CLI via `JS_HARNESS_E2E_NPM_CLI` or `<dirname(process.execPath)>/node_modules/npm/
  bin/npm-cli.js` (on this machine `npm` on PATH is a pnpm shim, so every step invokes that
  resolved CLI directly, never PATH `npm`); stages a repo copy so version bumps never touch the
  real `package.json`; runs entirely under temp prefix/home/release/staging dirs. All 9 steps
  passed on the first run against the real `npm install -g`, both via `node scripts/e2e.mjs` and
  via `npm run e2e` (through the pnpm shim, which passed the script through unmodified). No
  RED/GREEN cycle applied here — T4 is the integration proof itself, not new unit-tested source;
  `node --test` stayed at 59 pass, 0 fail throughout, and `node bin/check.mjs` stayed green.
- 2026-09-26 parent spot check: `node scripts/e2e.mjs` re-run independently → 9/9 PASS, exit 0.
  Found a bug the e2e cannot see: the bin's direct-run guard compared `process.argv[1]` with
  `import.meta.url`, so reaching `bin/js-harness.mjs` through a link (how npm installs a global bin
  on macOS/Linux) made every command a silent no-op, exit 0. Reproduced through a Windows junction;
  RED test `runs when invoked through a linked directory` (stdout `''`); fixed by comparing real
  paths; GREEN `node --test` → 60 pass. Lockfiles the pnpm shim writes during e2e are now ignored.
- Known limitation (from the writer): `--pm` is split on whitespace, so a package-manager path
  containing a space (e.g. under `Program Files`) is not supported yet.

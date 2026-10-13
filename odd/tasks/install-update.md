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
- [ ] T5 `update` and `upgrade` stop asking the npm registry for a name nobody holds. Added on
  2026-10-13, a defect in shipped behaviour that had no task (`docs/ROADMAP.md`, "Next", the
  defects read on that day, item a). Read on `main` at `f98f478`: `resolveLatest` runs `<pm>
  view js-harness version` (`bin/update.mjs:34-42`, the name at `:14`) and `upgradeMain`
  installs `js-harness@<what that printed>` with no comparison to what is installed and no
  check of where it comes from (`:200-209`), then runs the `sync --global` of the copy it just
  installed (`:218-225`). `npm view js-harness version` answers 404 today, so the name is free:
  whoever registers it decides what `js-harness upgrade` installs and runs on this machine. The
  release source decided is git tags (`docs/ROADMAP.md`, Decided, "Release source") and is not
  built. The first to fix of the six. Not designed here
- [ ] T6 `status` and `sync` work in a project whose `harness.json` holds no pin. Added on
  2026-10-13 (the same list, item e). Read: in this repository `js-harness status` prints
  "cannot read the pin from …harness.json: it has no string "version"" and exits 1
  (`bin/update.mjs:140-142`, `bin/lib/project.mjs:1473`; `sync` the same at `:1513`), because
  its `harness.json` was written by hand for `documents` and `documentSensors` and never by
  `init`. Whether such a file is a project with no pin or an invalid one is the design

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
- RDD over `f43ca3e..0e99cf5` (16 files, 1571 lines): risk high ("the update path in `bin/update.mjs`"),
  consent granted by standing preference, four lenses → approved with no correction, acknowledged
  (lineage `review-7ea42eeec8fb82a2`, authority burned).
- 2026-09-26 post-review fix-up (690451f, f1cdee1, next): the approved review's own follow-up —
  `upgradeMain` skipped the post-upgrade sync whenever no `--prefix` was given (the real-world
  case: pnpm's global store has no stable path to derive a bin from) and hardcoded the Windows
  `--prefix` layout. Also added: env-var fallbacks for `--home`/`--source`/`--prefix` (so the
  no-flag TUI can be pointed elsewhere), and `scripts/sandbox.mjs` for trying the TUI by hand.
  - **fix(update)** (690451f): RED — added `upgradeMain uses the POSIX --prefix layout...`,
    `...spawns the PATH js-harness sync via a shell...`, `...reports a mismatch and returns 1...`
    to `bin/update.test.mjs`; `node --test bin/update.test.mjs` → 3 failing (`TypeError: Cannot
    read properties of undefined (reading 'args')`; `expected one install call and one sync call:
    1 !== 2`; `0 !== 1`). GREEN — `upgradeMain` now always re-syncs (via a platform-aware
    `<prefix>/node_modules/...` vs `<prefix>/lib/node_modules/...` bin path with `--prefix`, or
    `spawn('js-harness', ['sync', ...], { shell: true })` on PATH without one) and reads the
    manifest back afterward, refusing with exit 1 if it doesn't match the version just installed.
    Full `node --test` → 62 pass, 0 fail; `node bin/check.mjs` → PASS/PASS, exit 0.
  - **feat(cli)** (f1cdee1): RED — added env-fallback tests to `install.test.mjs`,
    `update.test.mjs`, `tui.test.mjs`, `js-harness.test.mjs`; `node --test` on those files → 4
    failing (home/source fell through to the real `os.homedir()` instead of the injected env —
    caught and reversed via `uninstall()` before it could pollute the real machine, see below;
    `--prefix` env fallback not yet wired; `--help` missing the env-var line). GREEN — `--home` is
    now `--home ?? JS_HARNESS_HOME ?? os.homedir()` in `install.mjs`/`update.mjs`/`tui.mjs`;
    `--source` is `--source ?? JS_HARNESS_SOURCE`; `--prefix` is `--prefix ?? JS_HARNESS_PREFIX`
    (both in `update.mjs`); the TUI's bound commands inherit these for free by forwarding the same
    `env` object. Full `node --test` → 68 pass, 0 fail; `node bin/check.mjs` → PASS/PASS, exit 0.
  - **Safety incident, self-caught**: the first RED run for `installMain`/`syncMain`'s env
    fallback tests omitted a safety net — before the env fallback existed, `--home` absent and no
    env var set fell through to the *real* `os.homedir()`, and the test actually wrote
    `C:\Users\Oficina\.js-harness\manifest.json` and both real skill files. Caught immediately from
    the RED run's own console output (`installed js-harness 0.1.0 ... into C:\Users\Oficina`),
    reversed with `uninstall(os.homedir())` from `bin/lib/manifest.mjs` (removed exactly the two
    skill files it had written, left every pre-existing file under `.claude/`, `.codex/` and the
    home root untouched), and verified clean before continuing.
  - **feat(scripts)** (this commit): moved npm-CLI resolution, `run`/`npm` spawn wrappers,
    `mkTmp`, `copyRepoToStaging` and `bumpVersion` out of `scripts/e2e.mjs` into `scripts/lib.mjs`;
    `scripts/e2e.mjs` now imports them — re-ran `node scripts/e2e.mjs` after the move: still 9/9
    PASS, exit 0, unchanged. No RED/GREEN cycle here — like T4, this is the integration proof
    itself, not new unit-tested source. Added `scripts/sandbox.mjs` (+ `npm run sandbox`): packs
    the repo at 0.1.0, real `npm install -g --prefix` into a temp prefix, bumps a staged copy to
    0.2.0 and packs it into a temp releases dir, writes `launch.cmd`/`launch.sh` that set
    `JS_HARNESS_HOME`/`JS_HARNESS_SOURCE`/`JS_HARNESS_PREFIX`/`JS_HARNESS_PM` and then run the
    installed bin with no arguments (opens the TUI). `JS_HARNESS_PM` is built unquoted as
    `"<node> <npm-cli>"` (matching how `splitCommand` actually parses it — whitespace-split, no
    quote-awareness); the script prints a warning if either path contains a space, which would
    break that parsing. Neither path contains one on this machine, so no warning fired. Ran
    `node scripts/sandbox.mjs`, then proved the wiring end-to-end by running the *installed*
    bin's `status` with only the three env vars set (no flags): reported
    `installed package version: 0.1.0` / `latest available: 0.2.0` / `update available: 0.2.0`.
    Sandbox kept (not deleted) at
    `C:\Users\Oficina\AppData\Local\Temp\js-harness-sandbox-XvnJEC` for a manual TUI try.

- 2026-09-26 manual TUI try by Sebastián (sandbox): Status showed "update available: 0.2.0" (works).
  Defect found by hand: every key press printed a fresh copy of the menu below the last, so the
  menu looked frozen. Measured raw-mode bytes in his terminal (PowerShell 7.6 → cmd → node):
  down `1b 5b 42`, up `1b 5b 41`, Enter `0d` — key parsing was already right. RED
  `runTui redraws the menu in place when the selection moves` (got "js-harness 0", no cursor-up);
  fixed by moving the cursor back over the last draw and clearing it, except after a command,
  whose output stays on screen. GREEN `node --test` → 70 pass.
- 2026-09-26 Sebastián confirmed the TUI works end to end in the sandbox. Sensor for the earlier
  safety incident: `check` now runs the suite with `HOME`/`USERPROFILE` pointed at a throwaway
  directory, so a test that forgets `--home` cannot reach the real one. RED `checkTests runs the
  suite with the home directory pointed at a throwaway directory` (ENOENT — the nested runner
  inherited `NODE_TEST_CONTEXT` and skipped the fixture, a second defect, also fixed). GREEN 71 pass.
  Note: plain `node --test` outside `check` is not isolated; the pre-commit hook always is.
- RDD over `b09d46f..59b18cb` (15 files, 670 lines): risk high ("the update path in `bin/update.mjs`"),
  consent granted by standing preference, four lenses → approved with no correction, acknowledged
  (lineage `review-7800d48135d84342`, authority burned).

## Next step
None — the feature is closed. `jsaristi/js-harness#1` was merged into `main` on 2026-09-26 with a
merge commit (`8f8e268`), so every commit cited above keeps its hash. What comes next for the
project lives only in `docs/ROADMAP.md`.

## State for a resume

Written on 2026-10-13 at 05:58 by the session "JH 8" (it closed gate-wait's T15 to T17 the
same night and was at 86% of its context), before any line of T5 was read or written.

- **Who works on T5 and T6, and by whose order.** The orchestrator's go of 05:58 (the
  lead's call, not his word), in this order: (1) T5 here, with T6 if it fits the same
  slice; (2) gate-wait's T12 (built, uncommitted, worktree `gate-wait-same-tree`:
  commit it or say why it is dropped); (3) gate-wait's road 1 slice 2. Later, not now:
  `odd/tasks/sensors.md` T5. If the orchestrator says stop (the plan's week was at 92%
  of his 95), stop at the next commit.
- **Where.** Branch `fix/upgrade-source` off `main` `addf6ae`, worktree
  `D:\js-harness-worktrees\upgrade-source`. Nothing but this section is written.
- **What the orchestrator asked of T5** (its claims, each to be read in the code first):
  `js-harness upgrade` asks the package registry for the name js-harness
  (`bin/update.mjs:34-42`, `:14`), installs `js-harness@<answer>` with no check of its
  source (`:200-209`) and then runs the `sync --global` of the copy it installed
  (`:218-225`); the menu of bare `js-harness` offers it (`bin/tui.mjs:364`).
  `npm view js-harness version` answers 404 today, so it only fails; the day anybody
  registers that name the command installs and runs their package. The roadmap's
  "Release source" (`docs/ROADMAP.md:48`) is decided and not built: git tags, and by
  his word versions are tagged from 1.0.0 only, so no tag exists yet.
- **The steps, in order:** a short design in this document (what `upgrade` and
  `update` do while no tag exists; that nothing is ever installed from the public
  registry under that name; what the menu shows); ONE reader on the design, since it
  changes what a command installs; then the failing test first, the fix, the lock
  turn, both reviews. **Not open:** reserving the name on the registry (an account and
  a publish are his). A question for him goes to the orchestrator, never in the chat.
- **How this session works** is in `odd/tasks/gate-wait.md`, "Next" (the lessons) and
  "Resume here" (his rules on Codex and on questions, the turn scripts in the
  scratchpad). The worktree `gate-wait-two-halves` is merged and can be removed.

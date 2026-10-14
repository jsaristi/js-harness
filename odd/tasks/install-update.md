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
- [x] T5 (43934b2, route: inline; done on 2026-10-13, see Progress and "T5 design, second
  version") `update` and `upgrade` stop asking the npm registry for a name nobody holds. Added on
  2026-10-13, a defect in shipped behaviour that had no task (`docs/ROADMAP.md`, "Next", the
  defects read on that day, item a). Read on `main` at `f98f478`: `resolveLatest` runs `<pm>
  view js-harness version` (`bin/update.mjs:34-42`, the name at `:14`) and `upgradeMain`
  installs `js-harness@<what that printed>` with no comparison to what is installed and no
  check of where it comes from (`:200-209`), then runs the `sync --global` of the copy it just
  installed (`:218-225`). `npm view js-harness version` answers 404 today, so the name is free:
  whoever registers it decides what `js-harness upgrade` installs and runs on this machine. The
  release source decided is git tags (`docs/ROADMAP.md`, Decided, "Release source") and is not
  built. The first to fix of the six. Not designed here
- [x] T6 (243794e; route: inline; done on 2026-10-13, see Progress) `status` and `sync` work in a
  project whose `harness.json` holds no pin. Added on
  2026-10-13 (the same list, item e). Read: in this repository `js-harness status` prints
  "cannot read the pin from …harness.json: it has no string "version"" and exits 1
  (`bin/update.mjs:140-142`, `bin/lib/project.mjs:1473`; `sync` the same at `:1513`), because
  its `harness.json` was written by hand for `documents` and `documentSensors` and never by
  `init`. Whether such a file is a project with no pin or an invalid one was the design's
  question, his, answered on 2026-10-13 (question 25): a project with no pin.
- [x] T7 (5502d54; route: inline; done on 2026-10-13, see Progress) The package holds the commands
  and nothing else of this repository. Added on 2026-10-13
  (`docs/ROADMAP.md`, the defects in shipped behaviour, item c; open decision 10, answered by
  him the same day: "Solo los comandos (Recomendada)" to question 24, read in the
  orchestrator's transcript at line 11146). `package.json` lists `bin/` without its test files
  and no `AGENTS.md`; a test reads npm's own list and pins it. Route: inline.
- [ ] T8 After `upgrade --source` with no `--prefix`, the copy of js-harness on the path says its
  version before it is let to sync. Added on 2026-10-13 (the candidate under "Next step", told to
  the orchestrator at 06:27 and ordered by it at 16:57). Design below ("T8 design"). Route:
  inline; high risk by item 5 (an installer path), so Codex reads it and the turn proves it.

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
- 2026-10-13 T5 (43934b2, branch `fix/upgrade-source`, written inline by the session "JH 8" on the
  orchestrator's order): with no folder of tarballs named (`--source` or `JS_HARNESS_SOURCE`),
  `update`, `upgrade`, `status --global`, plain `status` outside a repository and the menu start no
  process and say that no release is tagged yet; `upgrade` then exits 1 with nothing installed and
  no sync run. `viewArgs` and the `name@version` spec are removed; `resolveLatest({ source })` is
  the one place that answers "which release", for whoever builds the tag reader. With a source:
  `upgrade` installs only a tarball newer than what is installed, a folder that is not there is
  said in a line (it threw), and the menu passes its source on to its three version commands. The
  help, the skill `install` writes, the roadmap ("Release source", item a) and the register's entry
  `upgrade-cannot-work` (now controlled) say the same. One lock turn, 06:17 to 06:26: RED, the
  three code files at HEAD and `node --test bin/update.test.mjs bin/tui.test.mjs
  bin/lib/version.test.mjs` → 124 tests, 13 fail (the six new rules, the two of the menu, and five
  older tests that now refuse to start a process); GREEN with the fix → 124 pass; `git grep
  "js-harness@" -- bin scripts` → nothing; the commit's gate passed whole. gentle-ai: review not
  due (`under_budget`, medium risk, 446 lines). Codex, once, 06:27 to 06:28, medium effort, two
  parts of `35477d4..43934b2`: both passed with no finding, 213,326 input tokens (plan 179,000,
  allowance 520,800), recorded. The design's one reader: 155,976 tokens. Not checked by anyone:
  whether `npm install -g <tarball>` itself contacts the registry (audit, funding).
- 2026-10-13 T6 (`243794e`, branch `fix/status-no-pin` off `main` `3e26e72`, written inline by
  the session "JH 8" on the orchestrator's order, by his answer to question 25, "Vale, sin
  versión fijada", read in the orchestrator's transcript at line 11166): a `harness.json` that
  is a JSON object with no `version` key is a project with no pin. `readPin` answers
  `{ noPin: true }`; `projectLocation` has the kind `noPin`; `status` prints the project,
  "pinned version: none", the running version, whether the clone is set up, and "to pin this
  project: add "version": "<running>" to harness.json and commit it", exit 0; `syncProject`
  returns `{ code: 1, noPin: true, harnessJsonPath, version }` and `sync` says the file pins no
  version, so there is nothing to move the project to, with the same way to pin, and writes
  nothing; the menu lists `noPin` with the project kinds. Still refused: a `version` that is
  there and is not a semver string (`null` and a number included), and a file that is not a
  JSON object, whose reason is now "it is not a JSON object".
  - Turn of 18:06 (`t6-turn.sh`): RED with the four code files at HEAD, `node --test` of the
    four test files → 338 tests, 8 fail (the two of `syncProject`, the one of
    `projectLocation`, the two of `status`, the one of `syncMain`, the two of the menu); GREEN
    with the fix → 333 pass, 0 fail; the scan for a kill by number passes; `js-harness status`
    in this worktree, whose own `harness.json` holds no version → exit 0, "pinned version:
    none"; the commit's gate passed whole at 18:20. gentle-ai: review not due (`under_budget`,
    medium risk, 210 lines).
  - Codex, once, 18:21, medium effort, `2e5dda0..243794e`: "the patch is correct" (0.94), no
    finding, 135,381 input tokens (plan 87,000, allowance 300,000), recorded. The push check: 1
    code commit, covered. No sub-agent.
  - Not built, by his answer: `init` on such a file answers "already initialized at unknown
    version; js-harness sync moves a project to its pin" and writes nothing
    (`bin/init.mjs:69-72`), so the pin is one line by hand. Whether `init` should write it was
    put to him by the orchestrator: "Dejarlo como hoy (Recomendada)", tapped, among "Que init
    la escriba" and "Que init pregunte" (the orchestrator's transcript, line 12059,
    2026-10-13T23:42:24Z, read by me). So `init` does not touch a file that exists, and
    `status` says how to pin. `uninstall` never reads the pin (`bin/lib/project.mjs`,
    `uninstallProject`: only the manifest), so it is unchanged.
- 2026-10-13 T7 (`5502d54`, branch `fix/package-contents` off `fix/status-no-pin` `5385db7`, which
  is on `main` since pull request 103; written inline by the session "JH 8" on the
  orchestrator's order, by his answer to question 24, "Solo los comandos (Recomendada)", read
  in the orchestrator's transcript at line 11146): `package.json` lists `bin/`,
  `!bin/**/*.test.mjs` and `!bin/**/*.testkit.mjs`, and no `AGENTS.md`. Read before: no command
  reads the package's own `AGENTS.md` (every `AGENTS.md` path in `bin/` is built from the
  project's folder or the home), and no file of `bin/` that is not a test imports a test file
  or the test kit (`rg "testkit|\.test\.mjs" bin` outside the tests finds only comments and
  the scan of `rules.mjs`).
  - Measured with the real npm CLI 11.12.1 (`npm pack --dry-run --json`): 117 files before (59
    test files, 1 test kit, `AGENTS.md`, `package.json`, 55 command files), 1,125,283 bytes
    packed; 56 after (the 55 and `package.json`), 438,313 bytes.
  - The test, `scripts/package-contents.test.mjs`: one dry run of `npm pack` through the npm CLI
    `scripts/lib.mjs` resolves (the `npm` on this machine's path is pnpm's, which refuses to
    pack here: "ERR_PNPM_BIN_CRLF", the bin file's first line ends with CRLF in this
    checkout); it holds no test file, no `AGENTS.md`, every file of `bin/` that is not a test,
    and nothing outside `bin/` but what npm packs whatever `files` says. It is skipped, with
    the reason, where there is no npm CLI beside node.
  - Turn of 18:41 (`pc-turn.sh`): RED with `package.json` at HEAD, 1 of 1 fails ("a test file
    is in the package"); GREEN 1 of 1, not skipped; the commit's gate passed whole at 18:57.
    gentle-ai: review not due (`under_budget`, medium risk, 78 lines).
  - Codex, once, 18:58, medium effort, `5385db7..5502d54`: "the patch is correct" (0.91), no
    finding, 74,849 input tokens (plan 27,000, allowance 300,000), recorded. The push check: 1
    code commit, covered. No sub-agent.
  - Seen and not built, told to the orchestrator: pnpm's own `pack` refuses this checkout on
    Windows because `bin/js-harness.mjs` is checked out with CRLF; whether an install by pnpm
    from the repository meets the same refusal is not measured.

## Next step
T5, T6 and T7 are done; T7 waits for its pull request to be merged by the orchestrator. One thing
is open, sent to the orchestrator on 2026-10-13 at 06:27 and ordered by it at 16:57 after the
package's contents:
- **A candidate task, not yet in Tasks:** with no `--prefix`, `upgrade --source` runs the sync
  after its install as `js-harness sync --global` through a shell (`bin/update.mjs`, the
  `syncResult` block), so it runs whatever `js-harness` is found on the path, and the check that
  it was the upgraded copy comes after it ran.
Reading the tags (`git ls-remote --tags`) is due with the first tag, 1.0.0: it changes the test
"resolveLatest starts no process and answers nothing when no source is named" on purpose.

## T8 design (written at 19:02 on 2026-10-13, read in the code on `6dd2480`; nothing built)

- **What happens today** (`bin/update.mjs`, `upgradeMain`, the `syncResult` block). After the
  package manager installed the tarball, with `--prefix` the sync is run from the file the
  prefix names, by this same node, with no shell. With no `--prefix` it is
  `spawn('js-harness', ['sync', '--home', <home>, '--global'], { shell: true })`: whatever
  `js-harness` the shell finds on the path. Only after it ran does `upgrade` read the manifest
  and say "the js-harness found is not the upgraded one". By then a copy that is not the
  upgraded one has written the machine install: skills and hook entries of another version.
- **The rule.** The copy on the path is asked which version it is before it is let to write.
  `upgrade` runs `js-harness --version` through the same shell; only when the answer is
  exactly the version it just installed does it run that copy's `sync`. Any other answer, no
  answer, or a failure: nothing is synced, exit 1, and the line says what the copy on the path
  answered, what was installed, and the two ways out (run `js-harness sync --global` with the
  upgraded copy, or name where it was installed with `--prefix`).
- **`js-harness --version`** is new: it prints the running version, one line, exit 0. An older
  copy on the path does not know it and answers "Unknown command", exit 2, which is a refusal
  here, and rightly: a copy that cannot say its version is not the one just installed.
- **What is printed of the answer.** The output of a program found on the path is not printed
  as it comes: only when it is a plain version (digits, dots and the letters semver allows) is
  it named; otherwise the line says the copy on the path "did not answer --version".
- **What stays.** The check of the manifest after the sync stays, as the second proof. With
  `--prefix` nothing changes. The probe and the run are two starts of the same name a moment
  apart; a path that changes between them is not defended against.
- **Considered and left:** running this process's own file when its `package.json` reads the
  new version after the install (no shell at all). It is true for npm, which replaces the
  folder in place, and not for a manager that keeps each version in its own folder (pnpm), where
  it would refuse an upgrade that works today. One rule that holds for every manager is worth
  more than a branch per manager.
- **Tests, first and red** (`bin/update.test.mjs`, with the injected `spawn`): the probe is the
  second process and the sync the third, both through the shell; a copy that answers another
  version, or none, or fails: exit 1, no sync started, the line names both versions and prints
  none of the copy's own bytes. The older tests whose stand-in answers nothing now answer the
  probe. `bin/js-harness.test.mjs`: `--version` prints the version and the help lists it.

## T6: state for a resume

**At 18:59 on 2026-10-13: T7 (the package's contents) is done and reviewed too (`5502d54`,
Progress). Next, by the orchestrator's order: the sync that runs from the path after
`upgrade --source` with no `--prefix` (the candidate task under "Next step"), then
`odd/tasks/gate-wait.md`, "Next". The gate on GitHub is no longer this session's: the
orchestrator gave it to a new session, "JH 10", at 18:40.**

**At 18:22 on 2026-10-13: T6 is done and reviewed (`243794e`, Progress); what is left of it is
its pull request and the notice to the orchestrator. The session was compacted by the app at
17:55, after this section and the design below were committed. Next, by the orchestrator's
order: the package's contents (his line 11146, read by me at 18:10: "Solo los comandos
(Recomendada)" to question 24), in a branch of its own.**

Written on 2026-10-13 at 17:53 by the session "JH 8", at 89% of its context, before any line
of T6 was read in the code or written. The app compacts that session in the turn that crosses
its limit; this is the record.

- **Where.** Branch `fix/status-no-pin` off `main` `3e26e72`, worktree
  `D:\js-harness-worktrees\status-no-pin`. Nothing but this section is written.
- **His answer, read by me** (`js-harness sessions --quote
  65318fd5-80e7-4bb8-92b5-06737140185b 11166`, answered by the user, tapped): "Vale, sin
  versión fijada (Recomendada)", to "Pregunta 25: un proyecto tiene su archivo del harness
  escrito a mano y sin versión. ¿Qué le contestan los comandos?" (the others: "Sigue siendo
  inválido", "Se rechaza en todos lados"). So: a `harness.json` with no version is a project
  with no pin. `status` says so and how to pin one, exit 0; `sync` says there is nothing to
  move to and how to pin (its exit code is the design's to say; the question sent to him
  proposed 1).
- **What is read so far, from the task's own text, not yet in the code:** `status` prints
  "cannot read the pin from …harness.json: it has no string "version"" and exits 1
  (`bin/update.mjs`, the `invalidHarnessJson` case; `bin/lib/project.mjs`, about `:1473`,
  and `sync` the same about `:1513`); this repository's own `harness.json` is such a file.
  `check` already accepts it.
- **The steps:** read `projectLocation` and its `invalidHarnessJson` reasons; a short design
  here (a new kind of location, or a reason that is not an error; what `init` does with such
  a file; what `uninstall` does); the failing tests first; one lock turn; gentle-ai as the
  check says; Codex once when its printed plan is inside the allowance; push, pull request
  with no AI attribution, the head to the orchestrator.
- **After T6, the orchestrator's order of 16:57:** the package's contents (his line 11146 by
  the orchestrator's word, not read by me: `bin/` without its test files and without this
  repository's `AGENTS.md`, with a test that the packed list holds neither); the sync that
  runs from the path after `upgrade --source` with no `--prefix`; then
  `odd/tasks/gate-wait.md`, "Next". How the session works: `odd/tasks/gate-wait.md`, "Next"
  and "Resume here"; its turn scripts are in its scratchpad (`ct-turn.sh` is the newest
  model of a turn: red on HEAD's code, green, a rule check, then the commit;
  `codex-turn.sh <worktree> <base> <short head> <allowance x 1.05> <name>`).
- **On `main` from this session on 2026-10-13:** pull requests 98, 99, 100 and 102.

### T6 design (read in the code on `main` `3e26e72`; nothing built)

- **Where the refusal comes from.** `readPin` (`bin/lib/project.mjs:1433-1449`) returns
  `{ invalid: 'it has no string "version"' }` for any JSON whose `version` is not a non-empty
  string. `projectLocation` (`:1463-1475`) turns that into `kind: 'invalidHarnessJson'`, which
  `statusMain` prints and exits 1 on (`bin/update.mjs:148-150`); `syncProject` (`:1512-1513`)
  returns `invalidHarnessJson`, which `syncMain` prints with "nothing was written"
  (`bin/install.mjs:224-225`). The menu treats the kind as a project (`bin/tui.mjs:61`).
- **The rule, by his answer.** A `harness.json` that is a JSON object with no `version` key is
  a project with no pin, not an invalid file. A `version` that is there and is not a
  non-empty semver string stays invalid, and so does a file that is not a JSON object.
- **`readPin`** gains a third answer, `{ noPin: true }`, for exactly that case.
- **`projectLocation`** gains `{ kind: 'noPin', root, harnessJsonPath, manifestPath,
  manifestPresent }`. `status` prints the project, `pinned version: (none)`, the running
  version, whether this clone is set up, and how to pin: add `"version": "<running>"` to
  that file; exit 0.
- **`syncProject`** returns `{ code: 1, noPin: true, harnessJsonPath }`; `sync` says there is
  nothing to move to, since the file pins no version, and the same way to pin; exit 1, as
  the question put to him proposed; nothing is written.
- **The menu** (`buildMenu`, `bin/tui.mjs:61`) lists `noPin` with the project kinds.
- **Open, not built here:** `init` on such a file answers `alreadyInitialized` and writes
  nothing (`bin/lib/project.mjs:830-877`, `:916`), so pinning is by hand; whether `init`
  should offer to pin is a question of its own. `uninstall` is not read yet.
- **Tests, first and red:** `projectLocation` and `syncProject` for an object with no
  `version` (beside the existing invalid cases at `bin/lib/project.test.mjs:2610` and
  `:3323`, which keep a `version` that is not a string); `status` exit 0 with its lines and
  `sync` exit 1 with its line, in `bin/update.test.mjs` and `bin/install.test.mjs`; the
  menu's kinds (`bin/tui.test.mjs:664`).

## State for a resume

**Superseded on 2026-10-13 at 06:29: T5 is built and committed (43934b2); "Next step" above is
the state.** What follows is kept as it was written, for the record of how T5 was ordered.

Written on 2026-10-13 at 05:58 by the session "JH 8" (it closed gate-wait's T15 to T17 the
same night and was at 86% of its context), before any line of T5 was read or written.

- **Who works on T5 and T6, and by whose order.** The orchestrator's go of 05:58 (the
  lead's call, not his word), in this order: (1) T5 here, with T6 if it fits the same
  slice; (2) gate-wait's T12 (built, uncommitted, worktree `gate-wait-same-tree`:
  commit it or say why it is dropped); (3) gate-wait's road 1 slice 2. Later, not now:
  `odd/tasks/sensors.md` T5. If the orchestrator says stop (the plan's week was at 92%
  of his 95), stop at the next commit.
- **Where.** Branch `fix/upgrade-source` off `main` `addf6ae`, worktree
  `D:\js-harness-worktrees\upgrade-source`. After it: the section "T5 design" below, a draft; the next step is its one reader (read-only, a bound of tool calls), then the failing tests.
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

## T5 design (draft of 2026-10-13, not yet read by its one reader, nothing built)

**Read in the code on `main` `addf6ae`, so these are no longer claims.** With no
`--source`, `resolveLatest` starts `<pm> view js-harness version`
(`bin/update.mjs:34-42`, the name at `:14`, the argv from `viewArgs` in
`bin/lib/version.mjs:57`). Three commands call it: `status --global`
(`machineStatus`, `:170`), `update` (`:186`) and `upgrade` (`:202`). `upgrade` then
installs `js-harness@<what was printed>` (`resolveSpec`, `:45-47`; the install at
`:208-210`) and runs `sync --global` of the copy that install put there (`:221-228`).
The menu offers `update` and `upgrade` (`bin/tui.mjs:363-364`) and shows `status`
(`:360`). `bin/lib/version.mjs:26` already holds the sentence for how a machine gets the
newest copy today, `INSTALL_NEWEST` (`npm i -g github:jsaristi/js-harness`). With
`--source <dir>` the latest is the newest `js-harness-<semver>.tgz` of a local folder
(`latestFromSource`) and the install is that file: the tests and `npm run e2e` use it.

**The rule.** No command of this package asks the public registry about the name
`js-harness` and none installs `js-harness@<anything>` from it. The decided release
source is git tags of this repository (`docs/ROADMAP.md`, "Release source"); until one
exists there is no release, and the commands say so.

**What each does with no `--source`, while no tag exists** (and starts no process):
- `update`: prints that no release is tagged yet, the installed version, and
  `INSTALL_NEWEST`; exits 0.
- `upgrade`: prints the same and that nothing was installed; exits 1, since it did
  not do what it was asked. It installs nothing and runs no `sync`.
- `status --global`: its line reads `latest available: (no release is tagged yet)`.
- The menu keeps both entries: they are commands, and each now answers in a line. To
  hide them would need a second place that knows whether a release exists.

**With `--source <dir>`: as today**, the one path that installs, from a folder the
caller names.

**Not built here: reading the tags** (`git ls-remote --tags`, then
`github:jsaristi/js-harness#vX.Y.Z`). It is the release source's own task, due with
the first tag, 1.0.0. Built now it would be code and a network call that can only
answer "none". What this slice leaves for it: `resolveLatest` is the one place that
answers "which release", and a test says that with no `--source` it starts no
process; whoever builds the tag reader changes that test on purpose.

**Removed:** `viewArgs` and the `name@version` branch of `resolveSpec`, with their
tests, so that the registry path is gone and not only unused. `PKG_NAME` stays only if
something else reads it.

**Tests, first and red on today's code:** for each of `update`, `upgrade` and
`status --global` with no `--source`: the injected `spawn` is never called, and the
output and exit code are the ones above; `upgrade` with a `spawn` that would answer
a version (the registry squatted) still installs nothing. Green before and after:
the `--source` path of each, unchanged.

**For the reader to attack:** any other place that names the registry or builds an
install spec (`bin/install.mjs`'s pin message, `doctor`, the e2e script, the skills
`install` writes); whether exit 1 for `upgrade` breaks a caller (the menu, e2e);
whether `status --global` printed `(unknown)` to something that parses it.

**T6 is not in this slice.** Whether a `harness.json` with no version is a project
with no pin or an invalid one is a design question of its own; it follows T5.

## T5 design, second version: what its reader changed (2026-10-13; nothing built yet)

One reader (read-only, 16 tool calls, 155,976 tokens); its first two findings checked by
me in the code (`bin/tui.mjs:8`, `:386-387`; `bin/update.mjs:50-53`). Where this differs
from the draft above, this holds. **The next step is the failing tests, then the fix.**

1. **Four callers, not three.** `tuiMain` asks for the latest release each time bare
   `js-harness` opens (`bin/tui.mjs:384-391`), and plain `status` outside a git
   repository reaches `machineStatus` too (`bin/update.mjs:152-160`). In the menu's
   test the injected `spawn` also serves the stack probes (`bin/tui.mjs:395`), so that
   test asserts that no call carries `view`, not that `spawn` is never called.
   `bin/tui.test.mjs:222-233` expects `update available: 99.0.0` from a registry
   answer and is rewritten.
2. **The condition is "no source", and a source is the flag or `JS_HARNESS_SOURCE`**
   (`bin/update.mjs:23`, `bin/tui.mjs:386`). The design says so: the variable counts
   as the caller naming a folder. The new tests pass an empty environment. The menu's
   `update` and `upgrade` get only `--home` today (`bin/tui.mjs:363-364`), so after
   `js-harness --source <dir>` the header could say "update available" and Upgrade
   "no release": the menu passes its source on to both.
3. **Two different "no answer" stay two.** A source folder with no tarball gives
   `null` from `latestFromSource` and keeps today's lines (`(unknown)`, "could not
   determine…"); "no release is tagged yet" is said only when there is no source. A
   test for the empty folder is added: none exists.
4. **In the `--source` path:** (a) `upgrade` gets the comparison T5's own text asks
   for: a tarball that is not newer than what is installed is not installed, "up to
   date", exit 0 (the existing tests use 0.9.0 against 0.1.0 and stay green); (b) a
   source folder that is not there is said in a line and exits 1, where it throws
   today (`bin/lib/version.mjs:47`); (c) **recorded, not in this slice:** with no
   `--prefix` the sync after the install runs `js-harness` from PATH through a shell
   (`bin/update.mjs:225-228`) and the check that it was the upgraded binary comes
   after it ran (`:237-245`); on Windows the shell may look in the current folder
   first (the reader's inference, not tried). A task of its own, told to the
   orchestrator; (d) the folder is trusted whole and the version read from the file
   name: the caller named it, and the design says that is the trust.
5. **The package manager's resolution keeps its tests.** `--pm` in several words,
   `JS_HARNESS_PM` and the `npm` default are pinned only by registry-path tests
   (`bin/update.test.mjs:51-75`); their assertions move onto the install call of
   `upgrade --source`.
6. **The texts are part of the slice:** the help (`bin/js-harness.mjs:17`, `:19-20`),
   the skill `install` writes (`bin/lib/manifest.mjs:19`, `:22-23`), the comments that
   go stale (`bin/lib/stack.mjs:540-542`, `bin/lib/version.mjs:23-25`,
   `bin/update.mjs:2-3`, `:33`, `:44`), the sentence of `docs/ROADMAP.md:48` that says
   `update` asks the registry, the roadmap's item a (`:1126-1134`) and the register's
   entry `upgrade-cannot-work` (`docs/FAILURES.md:807-818`), which gets its control.
7. **"Gone" has a search for a proof:** `rg "js-harness@" bin scripts` finds nothing
   after the change (`bin/lib/version.test.mjs:77-81` uses it as an example spec and
   changes to a tarball path). `PKG_NAME` stays: `upgradedBinPath` reads it.
8. **Streams and names:** `upgrade`'s refusal goes to stderr as today's does
   (`bin/update.mjs:204`), `update`'s line to stdout. "T5" already names another
   feature's work in these files (`bin/update.mjs:4`), so the new tests are named by
   what they prove.

**Tests that change or go** (the registry path): `bin/update.test.mjs:51-62`,
`:64-75`, `:77-80`, `:82-88`, `:90-110`, `:197-208`, `:210-221`, `:673-685`;
`bin/lib/version.test.mjs:13`, `:72-74`; `bin/tui.test.mjs:222-233`. **Green untouched**
(the `--source` path): `bin/update.test.mjs:37-49`, `:150-195`, `:223-434`;
`bin/lib/version.test.mjs:44-62`; `scripts/e2e.mjs:176-201`.

**Checked by the reader and right:** exit 1 for `upgrade` breaks no caller (it exits 1
today on no answer; the menu drops the code, `bin/tui.mjs:293`); nothing parses
`(unknown)`; `doctor` asks the registry only about two other packages
(`bin/lib/latest.mjs:66-67`); the e2e and the sandbox always give a source.
**Not checked by anyone:** whether `npm install -g <tarball>` itself contacts the
registry (audit, funding); whether `spawn('npm')` with no shell works on Windows.

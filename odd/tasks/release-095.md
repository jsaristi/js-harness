# Release 0.95.0, then the definitive 1.0.0

Branch `feat/release-095`. Delivery: one pull request per slice, landed by the lead. Test runner: `node --test`.

## Goal
v0.95.0 is the release the TUI is tested on until every item works; v1.0.0 is tagged again only on the commit that passes that test.

## Why
v1.0.0 was tagged before the TUI had been walked item by item, and he wants 1.0.0 to mean "definitive and everything working". Only his machine ever installed the old v1.0.0, so taking the tag back costs nobody else.

## Done when
- `node --test bin/tui.test.mjs bin/update.test.mjs` exits 0
- `node scripts/tui-walk.mjs` exits 0: every menu item of the TUI, run through its own key presses in a scratch home and a scratch repository
- `git ls-remote --tags origin` lists v0.9.0, v0.95.0 and v1.0.0, and v1.0.0 points at the commit the walk passed on
- From a copy at 0.95.0, the TUI's header names 1.0.0 and its Upgrade item installs it with no `--pm` and no `JS_HARNESS_PM`

## In scope / Out of scope
- In: `package.json`'s version, `bin/tui.mjs`, `bin/update.mjs`, `bin/lib/version.mjs`, a walk script under `scripts/`, README, this document.
- Out: tags other than v0.95.0 and v1.0.0, because publishing is his; his security settings.

## Constraints
- Destructive items (Uninstall, project Uninstall, Remote stop) run only against a scratch home or repository, because his real home and remote server are in use.
- The old v1.0.0 tag is deleted from GitHub only after v0.95.0 is pushed, so a release tag exists at every moment.

## Ask me before
Anything beyond the two tags he approved in Pregunta 16.

## Specs
- S1 (L1) "hace actualicacion no al 1.0.0 si no a la 0.95.0 algo asi  cuando ya este definitivo y todo funcionando ahi si a la 1.0.0 y probemos todo lo de la tui hasta que funcione perfecto"
- S2 (Pregunta 16, answered "Rehacer v1.0.0 (Recommended)") Delete the tag v1.0.0 from GitHub, move his copy down to v0.9.0, publish v0.95.0 to test the TUI, and when everything works tag v1.0.0 again on the definitive commit.
- S3 Upgrade with no `--pm` and no `JS_HARNESS_PM` uses the package manager that installed the running copy: pnpm for a copy in pnpm's global folder, else npm. Found 2026-10-18: the TUI's Upgrade passes no `--pm`, so on his pnpm copy it ran npm.
- S4 After an Upgrade from the menu, the menu's header says the new version is installed and to open the menu again, and offers no update. Found by the walk, 2026-10-18 (F1): it still said "update available" for the version just installed.
- S5 (L4) "quiero que el uninstall tenga varios osea el normal, que desinstala informacion y el que borra completamente todo"; Pregunta 17 answered "Todo, incluido el programa (Recommended)". `uninstall --global --everything` does `--full`, then removes the whole `.js-harness` folder of the home, then the program by the package manager that installed the running copy (pnpm `remove -g js-harness`; npm `uninstall -g --prefix <that copy's prefix> js-harness`); a copy run from a checkout keeps the program and says so. While a gate runs or anything could not be removed it removes nothing more and exits 1. It needs `--global`. The TUI offers it as "Uninstall everything" after Uninstall, asks once, and ends once it succeeds. Projects' files are kept.

## Tasks
- [x] T1 (kind: build) (S3) Upgrade picks pnpm for a copy pnpm installed. Route: inline.
- [x] T2 (kind: build) (S1, S4) `scripts/tui-walk.mjs`: every menu item through its keys, in a scratch home and repository; fix what it finds. Route: inline.
- [ ] T3 (kind: verify) (S2) `package.json` 0.95.0 landed; tag v0.95.0 pushed; tag v1.0.0 deleted on GitHub; his copy down to v0.9.0, then up to 0.95.0 by the TUI's Upgrade. Route: inline.
- [ ] T4 (kind: verify) (S1, S2) `package.json` 1.0.0 landed; tag v1.0.0 on that commit; his copy from 0.95.0 to 1.0.0 by the TUI's Upgrade with no `--pm`; his own walk. Route: inline.
- [ ] T5 (kind: build) (S5) `uninstall --global --everything` and the TUI's "Uninstall everything", with the walk step. Route: inline. Risk: item 1 (it deletes stored data and the program): an independent verifier after its checks.

## Log
- L1 (2026-10-18) His words, S1 verbatim. Pregunta 16 asked what to do with the published v1.0.0, since 0.95.0 is older and no upgrade would reach it; he tapped "Rehacer v1.0.0 (Recommended)".
- L2 (2026-10-18, T1) RED: with no `--pm` and no `JS_HARNESS_PM`, all six installs ran npm. The first pattern took `global/v<n>/<hash>/node_modules/js-harness`; his real copy, read with links followed, lies at `global/v11/2bf18-…/node_modules/.pnpm/js-harness@https+++codeload_…/node_modules/js-harness`, which it missed. The test now uses that real shape and the pattern allows any folders between `global/v<n>/` and `node_modules/js-harness/`. GREEN: update tests 61/61.
- L3 (2026-10-18, T2) `scripts/tui-walk.mjs` runs the menu in a child process with stdin on a pipe (the bare command opens the menu only on a TTY; `runTui` sets raw mode only where it exists), presses each item's keys and reads what it prints, in a throwaway home, npm prefix, tarball folder and git repository, with the real npm (`resolveNpmCli`) and the real `claude remote-control`. First runs: 19 of 19 steps passed once the walk read the menu below the stack rows. Reading every step's output found F1 (S4). RED: two tests in `bin/tui.test.mjs`; GREEN 81/81; the walk now checks the header after Upgrade and passes 20 of 20.
- L4 (2026-10-18/19, T5) His words and Pregunta 17, S5. Found while building it: run from a checkout, a global uninstall would have removed his real installed copy, so the program is removed only when the running copy lies in `node_modules/js-harness`, and npm gets that copy's own `--prefix`. `bin/lib/package-manager.mjs` holds the package-manager helpers `upgrade` and `uninstall` now share. RED: install tests 4 of 5 "everything" tests failed before the code; the gate test first used a made-up pid, which reads as a stale lock, and now holds the real lock (`takeGateLock`). TUI RED: the run test hung, the menu never ended; GREEN: install 91/91, TUI 84/84 (the fixed menu list gained the item).

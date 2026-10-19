# Uninstall kinds: subcommands and a submenu

Locator: `odd/tasks/uninstall-kinds.md` · Engram mirror: `odd/uninstall-kinds/tasks` · Branch: `feat/uninstall-kinds`
Delivery: two slices (CLI, TUI), one pull request. Test runner: `node --test`.

## Goal
Each kind of uninstall has its own name: a subcommand of `js-harness uninstall` and an item of an Uninstall submenu
in the TUI, each saying what it removes and what it keeps.

## Why
Four kinds of uninstall exist (project, machine, machine and memory snapshots, everything), but the CLI reaches them
through flag combinations and the TUI through two machine items, a project item and a second question that appears
only when snapshots exist. A name per kind lets Sebastián pick one without knowing the flags.

## Done when
- `node --test bin/uninstall-kinds.test.mjs bin/install.test.mjs bin/tui.test.mjs bin/js-harness.test.mjs bin/readme.test.mjs` exits 0
- `npm run check` exits 0
- In the TUI, Enter on Uninstall shows the kinds, and Back returns to the menu.

## In scope / Out of scope
- In: `bin/install.mjs` (`uninstallMain`), `bin/tui.mjs`, their tests, a new `bin/uninstall-kinds.test.mjs`, the
  dispatcher's help (`bin/js-harness.mjs`), README, `docs/SPEC.md`, `docs/ROADMAP.md`.
- Out: a per-host kind (Claude Code only, Codex only), since `install` always writes both and the next `sync` would
  rewrite a half install; a stack kind, which `feat/stack-install` adds with its own record; `package.json`, frozen
  while 0.96.0 is cut.

## Constraints
- Bare `uninstall` and the flags `--global`, `--full`, `--everything`, `--cwd`, `--home` keep their behavior —
  because `scripts/e2e.mjs`, `scripts/release-proof.mjs`, the README and released copies use them.
- A kind never changes scope by location: `project` never falls through to the machine — because a second run in
  the same place must not reach the machine by accident (roadmap Decided: "Command scope").

## Ask me before
Nothing left: the product choice was asked and answered (L2).

## Specs
- S1. Sebastián (2026-10-19, verbatim): "el uninstall debería tener submenus con los diferentes tipos de
  desintalacion".
- S2. His choice (2026-10-19, option 1 "Ambos (Recomendado)", as relayed by JH 30): "TUI: one \"Uninstall\" item
  opens a submenu: Project / Machine / Machine + memory snapshots / Everything / Back. Each kind gets its own y/N
  saying what it removes and what it keeps."
- S3. His choice, CLI half: "`js-harness uninstall project|machine|snapshots|everything`". `project` takes `--cwd`
  and `--home`; the machine kinds take `--home`. `project` is what bare `uninstall` does inside an initialized
  project; `machine` is `--global`; `snapshots` is `--global --full`; `everything` is `--global --everything`.
  `project` outside an initialized project exits 1 and removes nothing. An unknown kind, or a kind with `--global`,
  `--full` or `--everything` (or a machine kind with `--cwd`), is a usage error, exit 2.
- S4. His choice: "Bare `uninstall` and today's flags keep working unchanged."
- S5. Per-host and stack kinds stay out of scope.

## Tasks
- [x] T1 (S3, S4, kind: build) Slice 1: the kinds in `uninstallMain`, usage, help, README, SPEC, with tests that
  prove what each kind removes and what it leaves. Route: inline. RED: `bin/uninstall-kinds.test.mjs` 0/8 (each kind
  read as an unknown flag). GREEN: 8/8; `bin/install.test.mjs` and `bin/js-harness.test.mjs` 145/145 unchanged.
- [x] T2 (S2, kind: build) Slice 2: the TUI submenu (one Uninstall item, the kinds as its items, Back, a y/N per
  kind), commands through the kinds, README, SPEC, ROADMAP, with tests. Route: inline. RED: `bin/tui.test.mjs` 17 of
  84 failing. GREEN: 84/84 with `bin/uninstall-kinds.test.mjs`, `bin/js-harness.test.mjs`, `bin/readme.test.mjs`
  (142 in all). The second question of Uninstall (D7.8 of memory-hygiene) is gone: Machine + memory snapshots is its
  own item, so `hasMemorySnapshots` and `readSnapshots` went with it. After a project uninstall the selection stays
  on Uninstall, which survives, instead of jumping to Init.
- [ ] T3 (kind: verify) Gate, gentle-ai review per slice, Codex review per code slice, pull request.

## Log
- L1 (2026-10-19, his words, verbatim): "el uninstall debería tener submenus con los diferentes tipos de
  desintalacion".
- L2 (2026-10-19): inventory of today's kinds in the shared notes (`uninstall-kinds-inventory.md`); options 1-4 sent
  to JH 30, Sebastián chose 1 (S2-S5). Route: inline for both slices — two dependent units, each about 150-300
  lines, no Writer trigger.

# JH 33 · uninstall con submenús

File: docs/sessions/2026-10-19-jh-33-uninstall-con-submenus.md.

## Goal
Give `js-harness uninstall` one entry per kind of uninstall, with tests proving what each removes and leaves, and open
the pull request. Started by JH 30 (local_bdf1411c) with Sebastián's request relayed in its brief; the work runs
from `odd/tasks/uninstall-kinds.md`.

## The user's words
"el uninstall debería tener submenus con los diferentes tipos de desintalacion" (relayed verbatim by JH 30 in this
session's first message; recorded as L1 of `odd/tasks/uninstall-kinds.md`). His choice of option 1, "Ambos
(Recomendado)", came back through JH 30's question tool (L2).

## Delivered
- jsaristi/js-harness#471, open, branch `feat/uninstall-kinds`:
  - b4b2a6aa feat(uninstall): name each kind of uninstall as a subcommand (`bin/install.mjs`, `bin/uninstall-kinds.test.mjs`)
  - fec3b12c feat(tui): open the kinds of uninstall as a submenu (`bin/tui.mjs`, `bin/tui.test.mjs`)
  - e480c87 refactor(uninstall): share the flag test and name the TUI lists apart (gentle-ai advisories)
- Feature document `odd/tasks/uninstall-kinds.md`, engram mirror `odd/uninstall-kinds/tasks`; ROADMAP row "Uninstall kinds".
- Inventory of today's kinds: side-session notes `uninstall-kinds-inventory.md`.

## Decisions
- Both CLI subcommands and a TUI submenu; bare `uninstall` and its flags unchanged; no per-host or stack kind:
  Sebastián (option 1), recorded as S2-S5 and in the ROADMAP.
- `project` never falls through to the machine; a kind given a scope flag is exit 2: this session, S3.
- The TUI's second snapshots question removed, since Machine + memory snapshots is its own item: this session, T2.
- Two gentle-ai advisories left as they are (the usage text names the kinds; `uninstall -h` reads as a kind, still
  exit 2): this session, L3.

## Failures and lessons
- Bash heredocs holding quotes and backslashes failed ("unexpected EOF"); edits went through a written `.cjs` file
  instead, as the memory "Heredoc backslashes" says.
- `js-harness notify --opening` refused a title not of the shape `<code> <role> · <what>`; it was stored once JH 30
  gave the title.

## Left
The merge of jsaristi/js-harness#471: Sebastián's.

## Cost
Three gates (one per commit, all passed); one gentle-ai review of origin/main..fec3b12c with three lenses (lineage
review-893c2a3ae738162f, approved and acknowledged); one Codex review of 21aa1b3..e480c87 in two parts, recorded, no
defects. Context share at the end above 87%, after one compaction warning.

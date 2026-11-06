# Upgrade updates the stack, and the menu works

Locator: `odd/tasks/stack-upgrade.md` · Engram mirror: `odd/stack-upgrade/tasks` · Branch: `feat/stack-upgrade` ·
Delivery: `ask-on-risk` · Runner: `node --test`

## Goal
`js-harness upgrade`, and the menu's Update and Upgrade, bring the tools of the stack up to date too (the engram
binary, its Claude Code plugin, codegraph and the Codex CLI), each shown, asked y/N and recorded so `uninstall
machine` takes it back; and the menu does what its keys and items say.

## Why
Sebastián, 2026-11-06 11:10 local: the menu's update "solo sirve para el mismo arnes pero no para los plugins
instalados". Since gentle-ai left at F8 S2 nothing updates engram: the lead updated it by hand that morning (the
release zip into `AppData/Local/engram/bin`, the old exe kept as `engram-3.6.1.exe.bak`). A harness that installs a
stack and cannot update it leaves each update to a hand step nobody records.

## Done when
- `node --test bin/lib/stack-upgrade.test.mjs bin/lib/engram-release.test.mjs bin/lib/stack-run.test.mjs` exits 0
- `node --test bin/stack.test.mjs bin/update.test.mjs bin/tui.test.mjs bin/install.test.mjs` exits 0
- `npm run check` exits 0
- On this machine `js-harness stack upgrade` lists each outdated tool with its command and its undo, and nothing
  for a tool at its latest version (today engram 3.6.2, codegraph 1.6.2, codex 0.167.0).

## In scope / Out of scope
- In: `bin/stack.mjs` (a `stack upgrade` form), `bin/lib/stack-upgrade.mjs` (the plan, new),
  `bin/lib/engram-release.mjs` (the engram binary from its release, new), `bin/lib/stack-run.mjs` (the undo of an
  update), `bin/update.mjs` (`update` and `upgrade` reach the stack), `bin/tui.mjs` (Update, Upgrade, and what the
  owner answers to question 206), `bin/install.mjs` (what `uninstall machine` says of the new records), their tests,
  `docs/GUIDE.md` (the menu table), `docs/ROADMAP.md`, this document.
- Out: context7, which is hosted: its server is always the newest and there is nothing to update (doctor reads it
  `n/a`). typescript-lsp, an optional plugin the stack never installs. `codegraph upgrade`, which the user's rules
  forbid: codegraph is updated by its package manager, as `stack install` installs it. Claude Code and the desktop
  app, which update themselves (the `host-update` row).

## Constraints
- Nothing runs without its own yes: a terminal's y/N, the menu's `ask`, or `--yes` with `--tool` naming it — because
  each update replaces a program another session may be running.
- Every update is recorded before it starts, with its undo, and `uninstall machine` reads it back before it undoes
  anything (`undoStack`'s `applies`) — because of AGENTS.md: what the harness writes outside the repo is undone
  exactly.
- The engram binary is checked against the release's `checksums.txt` before it replaces anything, and the old one
  is kept beside it, renamed, never deleted — because a running engram.exe cannot be deleted on Windows and the
  rename is what the hand update did.
- Zero dependencies: Node's `fetch` for the download, the system's `tar` for the archive (on Windows
  `%SystemRoot%\System32\tar.exe`, bsdtar, which reads zip) — because `bin/` runs with no install step.
- The tests never reach the network or a real package manager: every download, spawn and probe is a seam.

## Effort
high

## Ask me before
Nothing planned beyond question 206 (what failed in the menu), already asked.

## Depth pass
- 1. Method: release engineering of a small CLI toolchain, as a package manager's `upgrade` does it (Homebrew's
  `brew upgrade`, rustup's `update`): read installed against latest, show the plan, ask, download, verify the
  checksum before swapping, swap atomically keeping the old binary, verify by running the new one, record what to
  roll back. The smallest change that meets it reuses what exists: doctor already reads each tool's latest version
  and names its update command (`upToDate` fixes, `bin/lib/stack.mjs`); `stack install` already shows, asks,
  records before it runs and reads back (`bin/stack.mjs:200`); `uninstall machine` already undoes stack records
  in reverse order (`bin/lib/stack-run.mjs:128`). Searched first: `codegraph_explore` for stack upgrade, update
  and engram release; `js-harness rules` for update; no command updates a stack tool today.
- 2. Raw material:
  - His words, transcript 0f71b2c6 line 69392 (2026-11-06T16:10:43Z), quoted in the Log.
  - `bin/update.mjs:489` `upgradeMain` and `:377` `updateMain`: neither names a tool of the stack; `upgrade` ends
    "up to date" and returns before anything else when the harness is newest (`bin/update.mjs:518`).
  - `bin/tui.mjs:474-475`: Update and Upgrade call those two and nothing else.
  - `bin/lib/stack.mjs:208` `ENGRAM_INSTALL`: engram's update is a line for the person to follow; it has no
    package on npm (`bin/lib/stack-install.mjs:78`).
  - engram v3.6.2's release assets (`gh api repos/Gentleman-Programming/engram/releases/tags/v3.6.2`):
    `checksums.txt`, `engram_3.6.2_windows_amd64.zip`, `_windows_arm64.zip`, `_linux_{amd64,arm64}.tar.gz`,
    `_darwin_{amd64,arm64}.tar.gz`. `engram --help` has no update command.
  - This machine: `C:\Users\Oficina\AppData\Local\engram\bin\engram.exe` (3.6.2, 2026-11-06 11:15) beside
    `engram-3.6.1.exe.bak` (the lead's hand update); the plugin 0.1.19 with caches 0.1.14 and 0.1.19 under
    `~/.claude/plugins/cache/engram/engram/`; its marketplace clone holds tag v3.6.0 and not v3.6.2.
  - `js-harness doctor`, 2026-11-06 11:3x: engram 3.6.2 ok, engram-plugin 0.1.19 unknown, codegraph 1.6.2 ok,
    codex 0.167.0 ok, context7 hosted n/a.
- 3. The bar:
  spec 1: `node --test bin/lib/stack-upgrade.test.mjs bin/lib/engram-release.test.mjs bin/stack.test.mjs bin/update.test.mjs`: none, new behaviour
  spec 2: left out because the failure is not known yet: question 206 asks him what he saw; its bar is written
  with his answer, as a test that fails on today's `bin/tui.mjs` first
- 4. Refutation: if `upgrade` or the menu already reached any tool of the stack, the request would not hold.
  `grep -nE "engram|codegraph|codex|stack" bin/update.mjs` and the menu's Update and Upgrade commands: 0 references
  to a stack tool in `update.mjs`; `bin/tui.mjs:474-475` call `updateMain` and `upgradeMain` only. 0 of 4 tools
  reachable.
  Verdict: supports
- 5. Request: `js-harness upgrade`, and the menu's Update and Upgrade, read each tool of the stack the harness
  installs or prescribes against its latest release; Update lists what is behind, Upgrade updates each one after its
  own y/N: the engram binary from its GitHub release (checksum checked, the old exe kept), then the engram plugin
  (doctor's two commands), codegraph and the Codex CLI by the package manager; each recorded before it runs, so
  `uninstall machine` takes the binary and the packages back to the versions before and names the plugin's way back.
  context7 is hosted and has nothing to update. The menu's failure is fixed once he says what it was, with a test
  first.
  Adds: none

## Specs

- **S1** (the lead's brief, from his words, 2026-11-06): "the TUI's Update/Upgrade (and `js-harness upgrade`) also
  updates the stack it installed: engram's binary (today a hand step: the release zip from GitHub into
  AppData/Local/engram/bin, checksum checked, old exe kept as .bak, which works while engram runs), the engram
  plugin, codegraph, context7, recorded so `uninstall` undoes it, each asked y/N".
  - Read: "the stack it installed" is the tools `stack install` installs or prescribes, so the Codex CLI
    (`@openai/codex`, installed by the same package rows as codegraph) is one of them; context7 is hosted, so it
    is read and said, never updated.
- **S2** (his words, 2026-11-06): "funciona muy mal la tui". What failed is asked first (question 206); then
  reproduced and fixed, test first. His answer to question 206 (2026-11-06, transcript 0f71b2c6 line 69675):
  "se Redibuja mal, hay update y upgrade funciona igual, deberia cuando uno abra la TUI mostrar mensajes arriba de
  nueva actualizacion tanto de js-harness como de los plugins". Read as three: (a) the menu redraws badly; (b) Update
  and Upgrade do the same thing, so one of them is not earning its row; (c) on opening, the menu says at its top which
  new versions there are, of js-harness and of the stack.
- **S3** (his words, same answer): "osea quisiera que vieras la de gentle-ai que es espectacular como maneja todo,
  osea esa si es una verdadera TUI y eso era lo que al final queria." The lead's notes: gentle-ai left this machine
  at F8 S2 T14, so its TUI is read from its public source, read-only, for ideas; its doctrine is not copied. S3 is
  wider than a fix: its depth pass comes first, and the plan goes to him as a question before it is built.

## Design

- `js-harness stack upgrade [--home] [--cwd] [--pm] [--prefix] [--tool <id>]... [--yes]`, beside `stack install`:
  the plan is `planUpgrade` (`bin/lib/stack-upgrade.mjs`, pure) over doctor's rows read online (`buildReport`),
  so the latest versions and the `outdated` states are doctor's own. Order: engram, engram-plugin (after the binary,
  since its latest follows the binary's tag), codegraph, codex.
- Each row is `{ tool, dimension: 'upToDate', kind, from, to, run, undo }`:
  - engram, `kind: 'binary'`: `engram-release.mjs` downloads `engram_<v>_<os>_<arch>.<zip|tar.gz>` and
    `checksums.txt` of tag `v<v>` into a fresh temporary folder, checks the sha256, extracts with `tar`, renames the
    running `engram(.exe)` to `engram-<from>(.exe).bak` and moves the new one in, then asks `engram version`. A
    version that does not answer `<to>` puts the old one back. The record keeps the path, the backup and the new
    file's sha256; its undo (run by `uninstall machine`) swaps the backup back only while the file's sha256 is still
    the one recorded, and keeps the replaced binary as `engram-<to>(.exe).bak`.
  - engram-plugin, `kind: 'plugin'`: doctor's `claude plugin marketplace update engram` then `claude plugin update
    engram@engram`. Claude Code has no command that installs an earlier version of a plugin, so its undo is named,
    never run: `uninstall machine` prints it.
  - codegraph and codex, `kind: 'package'`: `installPlan`'s install of `<spec>@<to>`; undo, the install of
    `<spec>@<from>`, run while the binary answers `<to>`. A second update of the same tool keeps the first `from`,
    so the undo returns to the version before the harness touched it.
- `upgrade` runs the harness's own upgrade as today, then the stack's plan, even when the harness is up to date. In
  a terminal each row is asked; without one it prints the plan and the `stack upgrade --yes --tool` line, and runs
  nothing. `update` adds one line per outdated tool. The menu passes its `ask` to Upgrade, as it does to Install the
  stack.

## Next step
Worktree `D:\js-harness\.claude\worktrees\stack-upgrade`, branch `feat/stack-upgrade`. T1-T5 and T7 are built and
their tests pass (stack-upgrade 11, engram-release 10, stack-run 25, stack-upgrade command 12, update 4 new, tui and
js-harness 143, the stack suites 204). Not yet run: `bin/install.test.mjs` whole (the new uninstall test is in it),
`npm run check`, Codex and the lenses (base `af55e7ee`). Then T6 once question 206 is answered (no answer at 11:5x;
measured meanwhile: the menu takes about 3.8 s to open here, 0.75 s for the release lookup and 3 s for the stack
probes, and 3 s again after each command). Then push, PR, `notify --kind ready`.
The gate refused the slice twice (CI runs 42254579713 and 42255467510, Linux). Fixed and tested: the Windows tar
path is `path.win32.join`; `upgrade` with a malformed manifest skips the stack; `readUpgrade` no longer probes the
prerequisites, since gh run in the clean-home test's scratch home wrote `.local/state/gh/device-id` there and its
uninstall could not leave it empty (`bin/stack-upgrade.test.mjs` "never runs gh"). The third try was refused by the
row commit-size (about 1230 changed lines, over 1200), so the slice is two commits: the plan, the binary's update
and the undo (`bin/lib/*`, `bin/install.*`), then the command and its wiring with the docs. Their messages are in the
scratchpad, `commit-a.txt` and `commit-b.txt`.

## Tasks
- [x] T1 (kind: design) This document, the depth pass, question 206 — S1, S2
- [x] T2 (kind: build) `planUpgrade` and its test — S1
- [x] T3 (kind: build) `engram-release.mjs`: download, checksum, swap, verify, and its test — S1
- [x] T4 (kind: build) `stack upgrade` (with `--list`), the records, and the undo of an update in `undoStack` — S1
- [x] T5 (kind: build) `upgradeAll` and `updateAll` (the dispatcher and the menu use them), so `upgrade`, `update`
  and the menu reach the stack; `upgradeMain` and `updateMain` stay the harness's own — S1
- [ ] T6 (kind: build) The menu's failure, reproduced in a test first — S2
- [ ] T7 (kind: docs) GUIDE's menu table, the roadmap — S1, S2
- [ ] T8 (kind: verify) `npm run check`, Codex and the lenses, the report to the lead

## Log
- L1 (2026-11-06 11:10 local, transcript 0f71b2c6 line 69392, his words): "Ya volvi pero no se actualizo engram,
  trate de actualizarlo por medio de la tui de js-harness y funciona muy mal la tui y lo de actualizar solo sirve
  para el mismo arnes pero no para los plugins instalados"
- L2 (2026-11-06 11:20 local): question 206 recorded for the lead: what he saw fail in the menu, with four options
  (keys, drawing, hangs, says nothing). S2 waits on it; S1 goes on.
- L3 (2026-11-06 11:55 local): the second gate refusal was this change's: `upgrade` now reads the stack, and that
  read probed `gh --version` in the scratch home. Main's gate passed the same test at 09:20 local.
- L4 (2026-11-06, relayed by the lead): question 206 answered; his words are in S2 and S3. S1 keeps its course.
- L5 (2026-11-06): searched before building S2 and S3. `docs/proposals/gentle-ai-reverse-engineering.md` section 4
  already studied gentle-ai's TUI (v4.2.0, Bubble Tea, 48 screens), named six causes ours does not behave like it
  (cause 1: no alternate screen, lines that wrap are not counted, so the menu duplicates or shifts; that is his "se
  redibuja mal") and chose to port its design to zero-dependency Node in six slices. Slice 1 (alternate screen,
  full-frame redraw and resize, a key parser, commands run as a child on a run screen) is PR jsaristi/js-harness#596,
  `claude/tui-gentle-level-a6afd3`, open since 2026-10-30, mergeable and clean by `gh pr view 596`, 1957 lines
  added; its real-console walk is his. So S2 (a) is not built again here: it rests on #596. S2 (b) and (c) and S3
  build on #596's shell, and touch `bin/tui.mjs` as #596 does.
- L6 (2026-11-06): S3's plan already exists: section 4.6 of the same proposal lists slices 2-6 (multi-select, Doctor
  detail, read-only views, a palette that honours NO_COLOR, the install preview; about 1.35k code lines) and 4.7
  says none starts before #596 merges. The question for him (through the lead): build S2 (b) and (c) as a PR chained
  on #596's branch now, so one real-console walk covers both, then slices 2-6 one PR each in that order; or wait for
  him to walk and merge #596 first.
- L7 (2026-11-06): the Claude lenses over af55e7e..f5b0578 (risk, resilience, readability, reliability, sonnet):
  0, 0, 1, 0 findings. Readability: `toWords` in `bin/stack.mjs` was never called and read a field no plan row
  carries; removed. Codex's first run refused before it ran, since this document was not committed.
- L8 (2026-11-06): Codex over af55e7e..54f8639 (4 parts, 318 s, 774k input tokens): 9 findings, all P2, all
  accepted and fixed, each with its test first: a staged binary left when the old one cannot be set aside; an
  update cut off before its result was recorded read as gone; an earlier undo reused across prefixes (the record now
  keeps its prefix, and another prefix holds the tool); unread latest versions called the latest; the binary located
  on the process PATH instead of the probe's; a plugin with a known target not checked against it; a timed-out update
  whose record was given back; `--pm` and `--prefix` not handed to the stack step; Update skipping the stack in
  silence on a malformed manifest.

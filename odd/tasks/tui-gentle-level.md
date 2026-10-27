# tui-gentle-level

Branch `claude/tui-gentle-level-a6afd3`, from main (b3399e9e). Slice 1 of the TUI rewrite, one pull request. Runner: `node --test`.

## Goal
Bring `bin/tui.mjs` to gentle-ai's interaction design for its foundation: a guarded alternate screen, a frame laid out to the window, a real key parser, commands run as children on a run screen, and a first draw before any slow work.

## Why
Sebastián, 2026-10-26: "necesito traerme todo el sistema completo de tui que tiene gentle-ai por que el de nosotros es muy sencillo y no funciona como el de gentle-ai", and, approving this session: "Si arrancalo por que quiero que quede practicamente igual obviamente guardando las diferencias". The research (gx-tui.md, section 2) names six causes of failure; this slice fixes the shipped ones (1 duplicated menu, 2 commands printing over and blocking the menu, 3 keys lost in chunks, 4 slow first draw). The differences kept: our own name and look (no gentle-ai name, logo or rose), zero dependencies, our explicit y/N confirm, and per-action authorization for commands that ask.

## Done when
- `npm run check` exits 0
- `node --test bin/tui.test.mjs bin/lib/terminal.test.mjs bin/lib/run-child.test.mjs` exits 0
- No rendered row is wider than the given width, and no frame is taller than the given height (a test asserts both)
- A real-console walk in Windows Terminal and in conhost passes the checklist in this document (manual, Sebastián's)

## In scope / Out of scope
- In: `bin/tui.mjs`, `bin/tui.test.mjs`, new `bin/lib/terminal.mjs` and `bin/lib/run-child.mjs` with their tests, `scripts/tui-walk.mjs` where the run screen changes what it reads, this document.
- Out: multi-select, the doctor detail screen, read-only views, a palette (later slices, proposed below); anything that opens or needs gentle-ai (L3); `bin/stack.mjs`'s own prompts, which stay exactly as they are.

## Constraints
- Zero dependencies — because `AGENTS.md` says every command runs without an install step.
- Never replace `stack install`'s per-action y/N with `--yes --tool` — because that widens what one answer authorizes (`bin/stack.mjs:217-230`).
- No gentle-ai name, logo or palette in our UI — because `TRADEMARKS.md` reserves them.
- Never run code from the gentle-ai clone; read it only.

## Ask me before
Nothing in this slice: the scope is the lead's brief. The next slices' disposition table is a proposal for him.

## Specs
- S1. Terminal guard: alt-screen and hidden cursor; always restore raw mode, cursor and main screen on quit, error, SIGINT and exit.
- S2. Frame model: repaint the whole frame, lay every line out to `stdout.columns` and the frame to `rows`, redraw on `resize`. Warnings and confirm prompts wrap, never get clipped. Test: no rendered line is wider than the given width (fixes cause 1, the duplicated menu).
- S3. Key parser: split chunks into keys (CSI and SS3 arrows, PgUp/PgDn, Home/End, Space, Tab, a lone Esc after a short timeout); Esc means Back, q quits, like gentle-ai.
- S4. Run screen: each command runs as a child (`node bin/js-harness.mjs <cmd> ...`) with piped output, so the menu never blocks and nothing prints over it; a spinner, a scrollable log, keys other than ctrl+c locked while it runs, a result screen with the exit code and the next step; on cancel, the child is killed and the result says so (fixes cause 2). Commands that ask questions keep their per-action confirmation.
- S5. First draw before slow work: draw at once, then fill the update check and the stack block asynchronously (cause 4).
- S6. If time allows, propose (do not build) the next slices as a capability/disposition table: every gentle-ai TUI screen marked native (ours), excluded, or deferred, with sizes. (Rewritten by L3: "delegated", opening gentle-ai's own TUI, is dropped.)

## Tasks
- [x] T1 (kind: build) S1-S3: `bin/lib/terminal.mjs` (guard, key reader, layout) and the TUI on it. Route: inline. Commit 73410bd4.
- [x] T2 (kind: build) S4-S5: `bin/lib/run-child.mjs`, the run and result screens, deferred loaders. Route: inline. Commits 73410bd4, d188d377.
- [x] T3 (kind: design) S6: the disposition table, below. Route: inline.
- [ ] T4 (kind: verify) the real-console walk, below. Sebastián's; not done by this session.

## Next slices: disposition of gentle-ai's screens (S6, a proposal, not built)
Sizes are code lines plus their tests, inferred from slice 1 (about 700 code lines for the foundation). Screen names are gentle-ai's `Screen` enum (`internal/tui/model.go:576-637` at 2b56327e).

| gentle-ai screen(s) | Disposition | Ours | Size |
|---|---|---|---|
| Welcome menu | native (done, slice 1) | the menu by location | — |
| UpdatePrompt | native, header only | the header note; an "Upgrade now" hint on it | ~20 |
| Detection | native | Doctor detail: one row per tool, Enter shows its fix command | ~150 |
| Installing / Upgrade / Sync / UpgradeSync (`RenderOperationRunning`) | native (done, slice 1) | the run and result screens | — |
| Agents, SkillPicker, CommunityTools (multi-select) | native, as two screens | `functions` on/off; `stack install` choosing tools, each still asked y/N in the CLI or confirmed per tool on a TUI confirm screen over IPC | ~250 |
| DependencyTree + Review summary | native | what `install`/`init` will write and record for undo, before it runs | ~200 |
| Claude/Codex model pickers, ModelConfig | native | a picker per host for the models js-harness writes | ~150 |
| Review mode toggle, InstallReviewMode | native | the review switch of our merged harness, on/off with our y/N | ~80 |
| Persona, Preset, Kiro/OpenCode pickers, Review store reset | excluded | gentle-ai's persona and hosts we do not ship; no review store of theirs | — |
| Backups, Restore, Delete | native | js-harness's own `backup`: a list with restore, our y/N confirm | ~200 |
| Uninstall flow (Mode → Agents → Components → Confirm → Result) | native (have it) | the Uninstall submenu with our y/N | — |
| Agent builder, Gentle Shell (rose animation), logo | excluded | gentle-ai's product and trademarks | — |
| Read-only views: `progress`, `sessions`, `codex-meter`, `quiet`, `report`, `failures`, `rules` | native, ours (no gentle-ai screen) | a scrollable view on the result screen's log | ~150 |
| Theme | native | a small palette with `NO_COLOR`, our name, no logo | ~80 |

Order proposed: Doctor detail, multi-select (`stack install` choosing codegraph, context7 and engram), read-only views, palette, review summary, model pickers, review switch, backups. Nothing here depends on gentle-ai being installed (L3).

## Real-console walk (Sebastián's, not run by this session)
Run `js-harness` with no arguments in Windows Terminal, then again in a plain conhost window (`conhost.exe cmd`), in a git repository and outside one:
1. The menu opens at once, on its own screen; the header says it is checking for updates and the stack, and both fill in a few seconds later.
2. Narrow the window to about 40 columns and shorten it to about 12 rows: the menu reflows, nothing duplicates, the selected item stays visible.
3. Arrows, j/k, PgUp/PgDn, Home/End move; holding an arrow down moves smoothly; Esc in the Uninstall submenu goes back; Esc on the main menu does nothing; q quits.
4. Open Uninstall > Everything: the whole prompt is readable, wrapped, and anything but y cancels.
5. Run Doctor: a spinner turns, its output fills the log, q and the arrows do nothing while it runs; the result says the exit code; PgUp scrolls the log; Enter goes back.
6. Run Update and press ctrl+c while it runs: the result says it was cancelled, and the menu still works.
7. With a stack gap, run Install the stack: the menu steps aside, the command asks y/N per install as it does on the command line, and after it ends a key brings the menu back.
8. Quit with q, then again with ctrl+c on the menu, then close a run by killing the window's process from another terminal (`taskkill /pid`): each time the prompt comes back with a visible cursor, normal echo and the screen as it was before.

## Log
- L7. 2026-10-26, Codex recheck of 0123de91..0d87a8ba (`js-harness codex-review --base 0123de91 --part-lines 600`, recorded, run after the usage limit reset at 22:53): 7 of 7 earlier findings fixed, no new defect, verdict correct (0.9). Both lenses closed for slice 1: Codex (two passes) and Claude (review and recheck).
- L6. 2026-10-26, from the lead, Sebastián's rule: "revision siempre, ya que siempre necesitamos una segunda opinion con un segundo modelo pero tambien una revision del mismo claude por que asi nos aseguramos criterio y solidez". Every slice gets Codex and a Claude review, whatever gentle-ai's `review_due` says.
- L5. 2026-10-26, the reviews of b3399e9e..0123de91. gentle-ai: `review assess` medium, `review_due` false (`under_budget`) for the branch and for its last commits; the Stop hook's branch-wide START was not run (AGENTS.md). Codex (`js-harness codex-review --base b3399e9e`, recorded): 7 findings, 1 P1. Claude (one blind Opus reviewer, lenses risk, resilience, reliability, readability): 12 findings, 1 blocker, 6 shared with Codex. One correction batch fixed all but one:
  - Blocker (both): the spinner, a resize and the refresh repainted over `stack install`'s own prompts. Nothing draws while a command owns the terminal; no spinner for it; keys pause before they turn cooked.
  - The log scrolled by lines, the layout by wrapped rows: Home could not reach a wrapped log's start. `scrollRange` (bin/lib/terminal.mjs) gives the page and the limit in rows.
  - A refresh finishing after the user opened a submenu or a confirm reset it (and could crash on a prompt with no command). It now applies what it read to the state as it is, rebuilding the menu only where nothing is open on it, and the version line says "(reading what it changed...)" until it is done; the walk waits for that before going on.
  - Cancel and quit froze the screen on Windows (the kill reads the process table synchronously): the terminal is restored and "cancelling" drawn first, the kill runs after.
  - A cancel after the child exited left its survivor holding the output (POSIX; on Windows `exitCode` stays null until the pipes close, so the old path happened to work): `killSurvivors` by the child's lifetime.
  - SIGTERM and SIGHUP were swallowed while a command owned the terminal: only SIGINT is the command's; `handOff` takes the abort signal.
  - Rows measured in UTF-16 length: wide characters overflowed. `cellWidth` and a split that keeps surrogate pairs.
  - stderr glued into a stdout line, and the update check's JSON parsed both: one unfinished line per stream; the tag lookup reads stdout only. An unfinished line is capped at 4096 and shows while it runs. A child ended by a signal says "stopped by <signal>". `fail()` pauses stdin like `finish()`.
  - Not fixed, a follow-up: the stack block's probes (`buildReport`, `spawnSync` per tool) run on the menu's thread after the first draw, so keys wait during them. Moving them to a child needs a seam for the tests' injected `spawn`; it goes to the next slice.
  GREEN: bin/tui.test.mjs 102, bin/lib/terminal.test.mjs 23, bin/lib/run-child.test.mjs 8, scripts/tui-walk.test.mjs 5. RED: the new exports were missing on HEAD, the handed-off abort hung there (57 s), and the survivor case hangs on POSIX only.
  Recheck (the same Claude reviewer, limited to the 19 findings): all fixed or deferred as planned, no blocker; three gaps closed in the same batch: the first result frame now carries the reading note (the walk could take it for settled), a handed-off command that throws gives the terminal back (`finally`), and the emoji ranges U+1F680-1F6FF and U+1FA70-1FAFF count two cells. Left as follow-ups, minor: the handed-off child is not its own process group on POSIX (detaching it would cost it the terminal), so a termination stops it but not its descendants; a long log is wrapped twice per key on the result screen; a progress line ending in `\r` shows as an empty row. GREEN after it: the four TUI test files 132/132.
- L4. 2026-10-26, `npm run check` failed: `process-tree.test.mjs` forbids signalling a process by number, and `run-child.mjs` used `process.kill(-pid)` and `taskkill /T` (both can hit a process that only reuses a pid). Cancel now goes through the shared `killTree` (pid plus creation time); the abort test's grandchild waits 4 s, since the kill reads the process table first. GREEN: the five TUI-related test files 193/193.
- L3. 2026-10-26, from the lead, Sebastián's direction: "no Orca ni Herdr lovamos a volver a utilizar y gentle-ai tampoco la idea es copiar la forma de funcionar con sus complementos osea traernos codegraph, context7 y engram y nuestro arnes fusionado de gentle con js-harnes mas funcionalidades de nuestras caracteristicas con ajustado a nuestras necesidades". Option (e), the item that opens gentle-ai's TUI, is dropped; the table's delegated rows are now native or excluded. Slice 1's scope is unchanged; its code calls no gentle-ai (the stack block's gentle-ai row is doctor's data).
- L2. 2026-10-26, T1+T2 built: `bin/lib/terminal.mjs` (splitKeys, createKeyReader, wrapLine, layoutFrame, paint, cleanLine, createTerminalGuard), `bin/lib/run-child.mjs` (runChild with tree kill, handOff), `bin/tui.mjs` (run/result screens, commandArgv, childCommands, latestRelease in a child, loaders after the first draw). RED was the missing modules; GREEN: `node --test bin/tui.test.mjs bin/lib/terminal.test.mjs bin/lib/run-child.test.mjs` 124/124 in 15 s. Found and fixed on the way: a frame drawn after restore on SIGINT; a header that hid the menu in 24 rows (the top now gives way to a menu, keeping its first row); the tag lookup and taskkill held the user's folder (now run from the temp folder).
- Next step: push the branch, open the PR (not merged), `js-harness notify --to orchestrator`. T4, the real-console walk, stays Sebastián's; `scripts/tui-walk.mjs` is not run (real npm and `claude remote-control`).
- L1. 2026-10-26, the brief from the lead (JH ORQ): "Build slice 1 of the TUI rewrite: our `bin/tui.mjs` brought to gentle-ai's interaction design, starting with the shipped defects." with the five items quoted in S1-S5 and S6.

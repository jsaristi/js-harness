# tui-gentle-level

Branch `claude/tui-gentle-level-a6afd3`, from main (b3399e9e), main merged in at be31c344 (L8). Slice 1 of the TUI rewrite, one pull request. Runner: `node --test`.

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
- [x] T5 (kind: build) bring PR 596 up to main: merge origin/main (never rebase), resolve, gate, Codex and Claude lenses, walk steps written. Route: inline. Commit be31c344 (L8).

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
The installed `js-harness` is main's copy, so the walk runs this branch's file by path. It reads and checks only:
every step that could change the machine is answered N or cancelled. Do it twice, first in Windows Terminal
(PowerShell tab), then in a plain console window (Win+R, `conhost.exe cmd`), each time in a git repository and outside one:
- In a repository: `cd D:\js-harness`, then `node D:\js-harness\.claude\worktrees\tui-gentle-level-a6afd3\bin\js-harness.mjs`
- Outside one: `cd $env:TEMP` (in conhost's cmd: `cd %TEMP%`), then the same `node ...\bin\js-harness.mjs`

1. Open: the menu appears at once on its own screen (the shell's text is gone); the header says `checking for updates...` and `stack: checking...`, and both fill in within a few seconds. In the repository there are project items (Init, Sync, Status, Remote ...) above the machine ones; outside it, machine items only.
2. Size: drag the window narrow, to about 40 columns, and short, to about 12 rows; then wide again. The menu reflows on every change, no line or menu appears twice, nothing is cut mid-word past the right edge, and the selected item (`>`) stays on screen.
3. Keys: arrows, j/k, PgUp/PgDn and Home/End move the `>`; holding the down arrow moves it smoothly to the end with no stray characters. Open Uninstall: Esc goes back to the main menu. Esc on the main menu does nothing. Do not quit yet.
4. Confirm: Uninstall > Everything. The whole prompt is readable, wrapped across rows, ending in `(y/N)`. Press `n` (never `y`): the prompt closes, the Uninstall submenu is back and nothing ran. Then Esc.
5. A run: select Doctor and press Enter. A spinner turns while its output fills a log; q and the arrows do nothing while it runs. When it ends the result line says `Doctor: done (exit 0)`, or `failed (exit N)` when doctor finds a gap; PgUp/PgDn and Home/End scroll the log; Enter goes back to the menu.
6. Cancel: select Update (it only reads whether a newer version exists) and press ctrl+c while the spinner turns. The result says `Update: cancelled; the command was stopped before it finished`; Enter goes back and the menu still moves.
7. Hand-off: Install the stack is in the menu only while a tool the harness requires is missing (right after Doctor). If it is there, run it: the menu steps aside, the command asks y/N before each install as it does on the command line; answer N to every question. When it ends, a key brings the menu back, drawn whole. If it is not there, skip this step and say so.
8. Restore: quit with q; the shell's screen comes back as it was before, with the cursor visible, and typing echoes normally. Open the menu again and quit with ctrl+c on the menu: the same. Open it again, start Doctor and press ctrl+c, then q: the same.

What to send back: for each terminal and place, the step numbers that passed and, for one that did not, what the screen showed (a phone photo is enough). A forced kill (`taskkill /f`) is left out: on Windows a console process can only be killed forcefully, which runs no code of the menu's, so restoring after it is the terminal's, not this slice's (S1 names quit, error, SIGINT and exit).

## Log
- L8. 2026-10-30, the brief from the lead (JH 102), Sebastián's answer to question 121: "Sí, ponlo al día". PR 596 had been CONFLICTING with main since 2026-10-27; main had moved 757 commits. Merged origin/main (04e3d29d) into the branch as be31c344, no rebase. Conflicts and how each was resolved:
  - Textual, `bin/tui.test.mjs`, two hunks (the JS_HARNESS_HOME and empty-home install tests). Main (a58e4420, cea68ea1) counts Install the stack above Install, since a fresh home has no context7 and so a stack gap; the branch runs Install as a child and waits on its result screen (`backToMenu`). Kept both: the tests wait for the stack block to leave `stack: checking` (the branch reads it after the first draw, S5), then count the item in the last frame (main's `installIndex`, reading `screen` instead of every chunk, since the first frame is drawn before the gap is known), then `backToMenu`.
  - Semantic, found by the pre-commit gate on GitHub: main's `bin/lib/gentle-ai-absence.test.mjs` (F8 S11) lets no unlisted file under bin or scripts name gentle-ai, and five of the branch's did. They comply as that test's header says, not by joining its list: the comments in `bin/tui.mjs:2`, `:297` and `bin/lib/terminal.mjs:1` drop the name; the fixture rows in `bin/lib/terminal.test.mjs:109`, `bin/tui.test.mjs:591` and `scripts/tui-walk.test.mjs:19` use engram, at the same width. Nothing else of main's changed in the branch's files.
  GREEN: the five TUI test files with the absence test 143/143; `npm run check` exits 0 and the pre-commit gate passed with its GitHub run. Reviews of the merge: Codex (`js-harness codex-review --base fcae76e8`, which reads what was written in the merge, 40 lines in 5 files): correct, 0.96, no finding. Claude lenses (`js-harness lens-review --base 04e3d29d`, all four, the slice's whole diff against main, since the command does not scope a merge): risk, reliability and readability 0 findings; resilience 1 WARNING, refuted: "if the stack loader rejects, the header shows stack: checking... for the whole session" (bin/tui.mjs:650-662), but neither loader can reject: `computeStackView` catches every failure into `unknown` (`bin/tui.mjs:185-194`) and `loadUpdate` into no update (`:819-827`). The walk below now names the branch's file by path (the installed copy is main's), the two terminals, the sizes, the texts the code prints, and N to every question; the forced kill left it, since S1 does not name it and a console process on Windows dies only forcefully.
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

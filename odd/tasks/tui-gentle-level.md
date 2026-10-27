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
- Out: multi-select, the doctor detail screen, read-only views, a palette, the "open gentle-ai" item (later slices, proposed below); `bin/stack.mjs`'s own prompts, which stay exactly as they are.

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
- S6. If time allows, propose (do not build) the next slices as a capability/disposition table: every gentle-ai TUI screen marked native (ours), delegated (open gentle-ai's own TUI), excluded, or deferred, with sizes.

## Tasks
- [ ] T1 (kind: build) S1-S3: `bin/lib/terminal.mjs` (guard, key reader, layout) and the TUI on it. Route: inline.
- [ ] T2 (kind: build) S4-S5: `bin/lib/run-child.mjs`, the run and result screens, deferred loaders. Route: inline.
- [ ] T3 (kind: design) S6: the disposition table, below. Route: inline.
- [ ] T4 (kind: verify) the real-console walk, below. Sebastián's; not done by this session.

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
- L2. 2026-10-26, T1+T2 built: `bin/lib/terminal.mjs` (splitKeys, createKeyReader, wrapLine, layoutFrame, paint, cleanLine, createTerminalGuard), `bin/lib/run-child.mjs` (runChild with tree kill, handOff), `bin/tui.mjs` (run/result screens, commandArgv, childCommands, latestRelease in a child, loaders after the first draw). RED was the missing modules; GREEN: `node --test bin/tui.test.mjs bin/lib/terminal.test.mjs bin/lib/run-child.test.mjs` 124/124 in 15 s. Found and fixed on the way: a frame drawn after restore on SIGINT; a header that hid the menu in 24 rows (the top now gives way to a menu, keeping its first row); the tag lookup and taskkill held the user's folder (now run from the temp folder).
- Next step: `scripts/tui-walk.mjs` is half done (screenOf on frames, resultOf, runToResult, step() and the 200x2000 stdout are in). Left: (a) after `draws() === 0` near line 181, wait until `screenOf(out)[0]` no longer contains "checking for updates" before reading the header; (b) the Uninstall everything block near line 226: replace `child.stdin.write(KEY.yes)` with `const said = (await runToResult(KEY.yes)).join('\n'); child.stdin.write(KEY.enter);` then await the exit, and drop the old `said = out.slice(start)`; (c) add `resultOf` to nothing else; run `node --test scripts/tui-walk.test.mjs`. Then `npm run check`, commit, `js-harness codex-review --base b3399e9e`, T3 table, push, PR, `js-harness notify --to orchestrator`. The walk itself is not run (real npm and `claude remote-control`).
- L1. 2026-10-26, the brief from the lead (JH ORQ): "Build slice 1 of the TUI rewrite: our `bin/tui.mjs` brought to gentle-ai's interaction design, starting with the shipped defects." with the five items quoted in S1-S5 and S6.

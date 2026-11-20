# The harness updates the whole stack with Claude closed

Locator: `odd/tasks/closed-app-update.md` · Engram mirror: `odd/closed-app-update/tasks` · Branch:
`claude/jh258-closed-app-update-f970c8` · Delivery: `ask-on-risk` · Runner: `node --test`

## State
T1-T4 and T4b built and tested (T4b: after engram moves, prepare runs `stack engram-prompt off` and checks that the engram plugin's `UserPromptSubmit` entries count 0); `stack can-close` (live on 2026-11-20 it said no and named JH PLAN's background shell);
`stack upgrade --round --dry-run` exits 0 here, one line a tool; `--prepare` and `--switch` run only in tests with a
scratch home. Not built: doctor's row that reads `last.json` (the record is written; doctor does not read it yet).
Not run on this machine: `--prepare` and `--switch` (high-risk item 5). Open: the two questions of `## Ask me before` (sent to the lead), Codex's review
(held: meter 59%, his stop 60%), the independent verifier of the switch and its undo.

## Goal
One command of the harness, `js-harness stack upgrade --round`, brings every tool of the stack to its newest version:
`--dry-run` prints the plan for this machine, `--prepare` does with the app open what touches nothing in use, and
`--switch`, run from a plain PowerShell window with Claude Desktop closed, does the rest, checks itself, undoes its
own step on a failed check and leaves a record doctor reads when the app reopens; `js-harness stack can-close` says
whether he can close the app now, and why.

## Why
On 2026-11-20 the update of the machine took him five hours, three closes of the app and two wrong helper scripts,
because codegraph, Git and node cannot be replaced while Claude Desktop is open and `doctor` covers half the tools.
Twice that day "you can close" was read from the session list alone, which shows a session with a background task as
idle (Depth pass, item 4).

## Done when
- `node --test bin/lib/update-round.test.mjs bin/lib/can-close.test.mjs bin/stack-round.test.mjs` exits 0
- `npm run check` exits 0
- `js-harness stack upgrade --round --dry-run` (the branch's `node bin/js-harness.mjs`) exits 0 on this machine and
  prints one line a tool with its move
- `js-harness stack can-close` exits 0 and names what runs, checked once against a session with a background task

## In scope / Out of scope
- In: `bin/stack.mjs` (the `--round` forms of `stack upgrade`, the `can-close` form), `bin/lib/update-round.mjs` (the
  list and its plan, new), `bin/lib/round-switch.mjs` (the switch, new), `bin/lib/can-close.mjs` (new), `bin/doctor.mjs`
  (the record's row), their tests, this document, `docs/ROADMAP.md`.
- Out: nvm 2.x and a new node major line (migrations, his decision: they are only reported); Windows programs outside
  the stack (he said no, transcript 0cdab702 line 2728); `codegraph install|uninstall|upgrade|index` (his global rule;
  codegraph moves as a package beside node); `claude auth login` and any password, token or sign-in (his); the
  existing `stack upgrade` flags, records and `UPGRADE_TOOLS`, which `update`, the menu and `uninstall machine` read.

## Constraints
- Nothing this session builds changes this machine's installed tools while it is built: every run here is `--dry-run`
  or a test with scratch state in a `mktemp -d` folder — because it is high-risk item 5 (installers, environment).
- The switch refuses while any Claude process runs, and reads and writes everything its undo needs before its first
  step — because it replaces node and Git, which the harness itself runs on.
- An undo is exact or named: where none can be run (a winget upgrade has no downgrade), it is `null` with the way back
  said, as the engram plugin's already is in `stack upgrade`.
- "Could not look" is never "you can close" — because the cost of a wrong yes is a lost session.

## Ask me before
Sent to the lead as questions, one at a time, after this design:
1. Whether the command may also move node to a new major line and nvm to 2.x, or only says they exist (built now:
   only says).
2. Whether patch and minor versions go without asking and majors are asked, or everything is shown first (built now:
   the plan is shown and asked once, whole).

## Depth pass
- 1. Method: release engineering of a developer machine's toolchain, as `rustup update`, `brew upgrade` and
  `winget upgrade --all` do it: read installed against newest, show the plan, stage what can be staged beside the live
  copy (rustup's toolchains side by side, nvm's versions), switch atomically with the old copy kept, verify by running
  the new one, roll back on a failed verification, log. The smallest change that meets it reuses what exists:
  `stack upgrade` (`bin/stack.mjs:155`, `bin/lib/stack-upgrade.mjs:43`) already plans engram, its plugin, codegraph and
  codex from doctor's latest versions; the quiesce of `stack backup` (`bin/lib/stack-backup.mjs:21`) already refuses a
  live Claude; the process snapshot (`bin/lib/process-tree.mjs:200`) and `claude agents` (`bin/lib/background.mjs:99`)
  already read what runs; the gate lock already says who holds it (`bin/lib/gate-lock.mjs:251`). Searched first:
  `codegraph_explore` for stack upgrade, probeStack and planUpgrade; `bin/` for update, upgrade, doctor, clean,
  host-watch; no command updates ctx7, gh, Git, node, pnpm or the globals in the node folder, and none says whether
  the app can close.
- 2. Raw material:
  - His words, transcript 0cdab702 lines 2886, 2728, 1809 and 1766, quoted in the Log.
  - The checklist the planning session wrote that day (`memory/update-round-checklist.md`): the methods and traps of
    each tool, checked here line by line where a test or a read could (`npm` beside node is a pnpm wrapper; node's
    globals go in with the real `npm-cli.js`; codegraph and Git cannot be replaced with the app open).
  - `claude agents --json --all`, 2026-11-20 19:48Z: JH ORQ and JH PLAN `idle`, JH 258 `busy`; the harness counts
    only `busy`, `waiting` and `working` as at work (`bin/lib/background.mjs:478`).
  - The quiesce list of `stack backup`, `bin/lib/stack-backup.mjs:21`, and its process read, `:118`.
  - The process snapshot at the same minute: under JH PLAN's `claude.exe` (pid 10048) a `bash.exe` running since
    19:32:52Z with seven `node.exe` below it; under JH ORQ's (pid 5428) a `bash.exe` since 19:32:18Z; MCP servers sit
    under `cmd.exe` or are `engram.exe`, direct children; a tool call, foreground or background, is a `bash.exe`
    direct child of the session's `claude.exe`.
- 3. The bar:
  spec 1: `node --test bin/lib/update-round.test.mjs bin/stack-round.test.mjs`: none, new behaviour
  spec 2: `node --test bin/lib/update-round.test.mjs` (the list's rows, doctor's row): none, new behaviour
  spec 3: `node --test bin/lib/round-switch.test.mjs`: none, new behaviour
  spec 4: `node --test bin/lib/can-close.test.mjs`: none, new behaviour
- 4. Refutation: if the session list alone could tell whether the app can close, the "can close" command would add
  nothing. At 19:48Z `claude agents --json --all` listed 2 of 3 interactive sessions `idle`, and the snapshot found a
  running shell under both of them: 2 of 2 idle sessions were running a tool call the list does not show.
  Verdict: supports
- 5. Request: `js-harness stack upgrade --round` reads every tool of the stack (Claude Desktop and the Claude CLI, which
  update themselves; the Codex CLI, engram and its plugin, ctx7, codegraph, gh, Git, node with the real npm,
  typescript, typescript-language-server and corepack in its folder, pnpm, nvm) against its newest version and, with
  `--dry-run`, prints one line a tool with its move: current, prepare (app open), switch (app closed), his, or report
  only. `--prepare` does the prepare moves; `--switch` refuses while a Claude process runs, asks one elevation at
  most, runs the switch moves in order, checks each by its version command, undoes its own step on a failed check,
  writes a log and a record under the harness home, and doctor reads that record. `js-harness stack can-close` says
  yes or no with each reason: a session at work, a shell running under a session's `claude.exe` (its background task),
  a gate holding the lock, staged work in a worktree of the project.
  Adds: none

## Specs
- **S1** (his words, 2026-11-20T19:39:39Z, transcript 0cdab702 line 2886): "ok entonces arma un script completo para
  que lo tenga el harness para poder actualizar todo estando cerrado el claude" — one command of the harness, prepare
  with the app open and switch with it closed.
- **S2** (his words, 2026-11-20T19:30:10Z, line 2728): "hazte una lista de que siempre que actualicemos y revisemos
  todo" — the list of the stack as data, each tool with how its versions are read, how it moves, whether it needs the
  app closed, its check and its undo; doctor reads the record of the last round.
- **S3** (the same words as S1, read with the miniplan's item 4): the switch checks itself and undoes its own step on
  a failed check, and leaves a log and a record.
- **S4** (his words, line 2886): "y tambien quiero que me digas cuando puedo cerrar para actualizar o reiniciar" — a
  read-only command that says yes or no and why.
- Read of line 1809, "si siempre hazlo tu", and line 1766, "es muy complicado todo lo que haces": the command is one
  he runs in one line, never a list of steps he carries.

## Tasks
- [x] T1 (kind: design) this document, S1-S4 — route: inline — commit: docs(closed-app-update)
- [x] T2 (kind: build) S4, `stack can-close` — route: inline — commit: feat(stack): can-close
- [x] T3 (kind: build) S1, S2, the list and `--round --dry-run` — route: inline — commit: feat(stack): round plan
- [x] T4 (kind: build) S1, S3, `--prepare` and `--switch` with undo and record — route: inline — commit: feat(stack): round switch
- [x] T4b (kind: build) S2, after the engram update the round re-applies `stack engram-prompt off` (D8), checked by the hook-entries count — route: inline — commit: feat(stack): re-apply engram-prompt off
- [ ] T5 (kind: verify) lenses recorded, Codex skip recorded, verifier asked of the lead, draft pull request

## Log
- L1 (his request as written, 2026-11-20T19:39:39Z, transcript 0cdab702 line 2886): "ok entonces arma un script
  completo para que lo tenga el harness para poder actualizar todo estando cerrado el claude y tambien quiero que me
  digas cuando puedo cerrar para actualizar o reiniciar"
- L2 (2026-11-20T19:30:10Z, line 2728): "actualiza lo del proyecto y hazte una lista de que siempre que actualicemos y
  revisemos todo y lo del programa que es fuera del proyecto o de windows creo que no por que primero son versiones muy
  pequeñas o dime si realmente es necesario actualizar."
- L3 (2026-11-20T18:05:02Z, line 1809): "si siempre hazlo tu"
- L4 Evidence, 19:48Z: the refutation of the Depth pass, item 4.
- L5 Decided by this session, cost said: the command is a form of `stack upgrade` (`--round`) and `stack can-close`,
  not a new top-level command, since `stack` already owns installing and upgrading the stack's tools.
- L6 (JH 259, 2026-11-20): the lead's brief, step 1: after the round updates the engram plugin it re-applies
  `js-harness stack engram-prompt off` (his D8, question 221), checked by the hook-entries count, because the plugin's
  0.1.23 that day brought the hook back and the hook entries row of check refused every commit. Built as one more
  prepare step after `stack upgrade --tool engram --tool engram-plugin`; its check counts the live entries of owner
  `engram@engram` and event `UserPromptSubmit` in the home (`liveEntries`, ./hook-count.mjs) and passes at 0; it has no
  undo (putting the hook back is `stack engram-prompt on`, named as its way back). A failed count stops the phase.

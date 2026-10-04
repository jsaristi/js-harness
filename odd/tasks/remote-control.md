# Remote sessions: open a local session from the phone

Locator: `odd/tasks/remote-control.md` · Engram mirror: `odd/remote-control/tasks` · Branch: `feat/remote-control`

## Goal
From the Claude mobile app, Sebastián can start a new Claude Code session that runs on this PC in
an initialized project, because `js-harness remote` keeps Claude Code's `claude remote-control`
server alive there, and `js-harness doctor` says when the CLI and the desktop app are signed into
different accounts, which makes those sessions invisible to the phone.

## Why
He works from his phone and could not open a new local session from it: the app offers only cloud
or GitHub sessions, `/new` (an alias of `/clear`) replaces the current conversation, and `/compact`
keeps the old one. Claude Code's server mode solves it, but on 2026-10-03 it took four attempts by
hand to learn what a command can check: the server must run in a plain environment (started from a
desktop session it inherits that session's `CLAUDE_CODE_*` variables), the CLI must be signed into
the phone's account (otherwise the phone answers "esta sesión no está disponible"), and the server
exits after about ten minutes offline, so something must restart it. Each fact belongs in `bin/`.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/remote-control.md` exits 0
- `node --test bin/remote.test.mjs bin/lib/remote.test.mjs` exits 0
- `node --test bin/doctor.test.mjs bin/lib/stack.test.mjs bin/lib/digest.test.mjs bin/tui.test.mjs bin/lib/manifest.test.mjs` exits 0
- `node bin/js-harness.mjs remote start` in `D:\js-harness`, then a session started from the iOS
  app runs in `D:\js-harness`, and `node bin/js-harness.mjs remote stop` leaves no process of it
- `node bin/js-harness.mjs doctor` shows the account check `ok` on this machine

## In scope / Out of scope
- In: `bin/remote.mjs`, `bin/lib/remote.mjs` and their tests; `bin/js-harness.mjs` (usage and
  registry); `bin/lib/stack.mjs`, `bin/doctor.mjs`, `bin/lib/digest.mjs`, `bin/tui.mjs` for the
  account check and the menu; `bin/lib/manifest.mjs` for an optional machine file; `docs/ROADMAP.md`.
- Out: signing in or out of any account (the harness reports, the human signs in); changing
  Claude Code or desktop-app settings; any platform other than Windows for the login launcher (it
  refuses there, saying so); Codex, which has no remote-control server.

## Constraints
- Zero dependencies and fixture-based tests, with a fake `claude` for the server — because every
  command must run on any machine with no install step, and a test must never reach claude.ai.
- Processes are identified by pid plus creation time and killed only through
  `bin/lib/process-tree.mjs` — because a bare-pid kill closed unrelated programs on this machine
  (F5, T4k).
- The account check reads only the account identifiers (`oauthAccount.accountUuid` in
  `~/.claude.json`, `lastKnownAccountUuid` in the desktop app's `config.json`) and prints neither
  value; it is `unknown` when either is missing — because that `config.json` also holds token
  caches, and its format is the app's, not a documented contract.
- Every file written outside the repo is recorded so `uninstall` removes it exactly — because that
  is the rule the harness exists to keep.
- The server inherits the user's own permission mode and runs sessions in the project folder
  (`--spawn same-dir`) unless a flag says otherwise — the defaults proposed to Sebastián on
  2026-10-03; sessions started from the phone then behave like his desktop sessions.

## Effort
medium

## Ask me before
Turning the login launcher on on this machine; any change to his accounts or Claude settings; the
chain strategy once the branch passes the delivery budget.

## TDD
Mode: strict. Runner: `node --test`.

## Delivery
Forecast: ~900–1,200 authored lines with tests, above the ~400 budget. Strategy: `ask-on-risk`:
the chain strategy is asked once, before the commit that crosses the budget.

## Design
- `js-harness remote start|stop|status [--name <n>] [--cwd <path>]` acts on an initialized
  project, like `status`, and refuses elsewhere.
- `start` launches a detached supervisor (`node bin/remote.mjs supervise ...`) that runs
  `claude remote-control --name <n>` in the project root with every `CLAUDE*` variable and
  `ANTHROPIC_BASE_URL` removed, writes its output to a log, and restarts it with a capped backoff
  when it exits. Its pid and creation time go in `~/.js-harness/remote/<id>.json`; a second
  `start` while it runs is refused.
- `status` checks that recorded process by identity and reads the last state from the log:
  connected or not, sessions in use, and the environment address the phone opens.
- `stop` kills the supervisor and its children by identity and removes the state file.
- `start --at-login` writes a launcher in the Windows Startup folder, recorded in the machine
  manifest as an optional file; `remote stop --at-login` and `uninstall` remove it exactly.
- `doctor` gains a Claude account check: `ok` when both identifiers match, `mismatch` (a gap in
  Fix, the session digest and the TUI) when they differ, with `claude auth login` as the fix.

## Tasks
- [ ] T1 Supervisor: runs the server in a clean environment, logs it, restarts it with a capped
  backoff; tested with a fake `claude` (route: delegated writer)
- [ ] T2 `remote start|stop|status`: scope, state file, identity-checked stop, status read from
  the log; usage and registry (route: delegated writer)
- [ ] T3 Login launcher: `--at-login` writes the Startup-folder file, recorded as an optional
  machine-manifest file and removed exactly by `stop --at-login` and `uninstall` (route:
  delegated writer)
- [ ] T4 `doctor` account check with the `mismatch` state through Fix, digest and TUI (route:
  delegated writer)
- [ ] T5 TUI: `remote` in the project section of the menu (route: delegated writer)
- [ ] T6 Roadmap: the phase and its steps, the Commands row, and the live check on this machine
  (route: inline)

## Progress
- 2026-10-03: plan written from the session's measurements and a read-only map of the code
  (registry `bin/js-harness.mjs:34-47`; scope by location like `statusMain`, `bin/update.mjs:133-160`;
  machine files declared as `components` in `bin/lib/manifest.mjs:30-41`, none optional yet; gap
  states duplicated in `bin/doctor.mjs:16`, `bin/lib/digest.mjs:6` and `bin/tui.mjs:91`; no code
  spawns `claude` yet; `claude.exe` lives in `~/.local/bin` on this machine). The desktop app keeps
  `lastKnownAccountUuid` in `%APPDATA%\Claude\config.json`, and its organization-scoped keys name
  the same organization the desktop session reports, so the account check needs no token.

## Next step
T1, after Sebastián confirms the defaults in Constraints (proposed 2026-10-03).

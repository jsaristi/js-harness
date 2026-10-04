# Remote sessions: open a local session from the phone

Locator: `odd/tasks/remote-control.md` · Engram mirror: `odd/remote-control/tasks` · Branch: `feat/remote-control`

## Goal
From the Claude mobile app, Sebastián can start a new Claude Code session that runs on this PC in
a git repository, because `js-harness remote` keeps Claude Code's `claude remote-control`
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
  (`--spawn same-dir`) unless a flag says otherwise, and the login launcher is off until asked
  for — the defaults Sebastián confirmed on 2026-10-03; sessions started from the phone then
  behave like his desktop sessions.

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
- `js-harness remote start|stop|status [--name <n>] [--cwd <path>]` acts on the git
  repository that holds the working directory, initialized as a js-harness project or not, and
  refuses outside one (changed 2026-10-03: this repository has no `harness.json`, and nothing
  the command does depends on one).
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
- [x] T1 Supervisor: runs the server in a clean environment, logs it, restarts it with a capped
  backoff; tested with a fake `claude` (route: delegated writer)
- [ ] T1r T1 review findings: keep a `CLAUDE*` variable the user set persistently (only the
  ones a parent session injected are removed), and a log that cannot be opened or written never
  ends the supervisor (gentle-ai WARNINGs `R3-env-strip-too-broad`,
  `R3-log-failure-kills-supervisor`) (route: delegated writer)
- [x] T2 `remote start|stop|status`: scope, state file, identity-checked stop, status read from
  the log; usage and registry (route: delegated writer)
- [ ] T2r T2 review findings: a failure after the supervisor is spawned (its identity cannot be
  read) must not leave it running unrecorded, and `stop` must keep the state file when the
  process's identity could not be established, deleting it only when the process is proven gone
  (gentle-ai WARNINGs `R3-start-orphans-supervisor-on-post-spawn-failure`,
  `R3-stop-deletes-record-when-identity-unproved`); the fake-world tests are skipped or made to
  pass off Windows (`R3-tests-fail-off-windows`) (route: delegated writer, with T1r)
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
- 2026-10-03: T1 done (delegated writer; RED: 16 of 16 failing against a stub that threw
  `not implemented`; GREEN: `node --test bin/lib/remote.test.mjs` 17/17 in about 4 s, re-run by
  the parent with the same result; `node --test bin/lib/process-tree.test.mjs` 45/45, so the
  bare-pid guard passes with the new file). `bin/lib/remote.mjs` exports `cleanServerEnv`,
  `serverArgs`, `resolveClaude` (PATH only, `claude.exe` before `claude.cmd`, runs nothing),
  `nextDelay` (5 s doubling to 60 s, reset after 5 minutes up) and `supervise`. Real-process
  tests prove the leaked `CLAUDE_CODE_SESSION_ID` and `ANTHROPIC_BASE_URL` never reach the
  server, the restart after each exit, the run in the project folder, a stop that kills the
  server and its grandchild with no restart, and a `.cmd` shim receiving a quoted name intact.
  A failed kill on stop is logged and thrown, never waited on forever.
- 2026-10-03: `535ef09..ae8a75e` (plan, T1) reviewed by gentle-ai: medium risk, review due
  (`slice_budget_reached`, 575 lines); lineage `review-5ed5017fe0239302`, lens reliability,
  approved and acknowledged, authority burned. Three WARNINGs and three SUGGESTIONs, all
  advisory. Two WARNINGs are taken as T1r: stripping every `CLAUDE*` variable also drops ones a
  user sets on purpose (a config directory, the Git Bash path Claude Code needs on Windows), and
  a log that cannot be opened or appended rejects the loop with no backoff. The third, that a
  kill reporting failure through a promise would go unhandled, does not apply as written: T1's
  writer measured `killTree` as synchronous. The suggestions go to Follow-ups. Codex reviews
  this range together with T2, because `codex-review` refuses a dirty tree and T2 is being
  written.
- 2026-10-03: T2 done (delegated writer; RED: 21 of 21 in `bin/remote.test.mjs` and 1 of 18 in
  `bin/js-harness.test.mjs` failing against a stub; GREEN after two fixes, git's `C:/` root form
  and a case-folded id: `node --test bin/remote.test.mjs` 21/21, re-run by the parent with the
  same result; with `bin/lib/remote.test.mjs`, `bin/js-harness.test.mjs` and
  `bin/lib/process-tree.test.mjs` 80/80). `remote start` launches a hidden detached supervisor
  (`node bin/remote.mjs supervise`, not in the usage) running exactly the CLI it resolved, and
  records its pid and creation time in `~/.js-harness/remote/<folder>-<12 hex>.json`; `status`
  checks that identity and reads the log's tail with escape sequences stripped (connected, the
  `Capacity` count, the environment address); `stop` kills by identity (snapshot, descendants,
  `killProcesses`) and keeps the state file if anything survives. Names and `.cmd` paths with
  characters cmd.exe would act on are refused up front. The end-to-end test runs a fake
  `claude.cmd` through a real detached supervisor and proves nothing of it is left after
  `stop`. Decided by the writer, kept: the command refuses off Windows, because creation times
  are read only there and a supervisor it could not identify would be left running.
- 2026-10-03: T2 corrected before its commit (delegated writer). The first live `remote start`
  in `D:\js-harness` answered `not an initialized project`: this repository has no
  `harness.json`. The command now acts on any git repository and refuses only a missing
  directory or one outside git (RED: 21 of 42 failing; GREEN: `node --test bin/remote.test.mjs
  bin/js-harness.test.mjs` 42/42). Live, on this machine: `remote start` answered `started
  "js-harness" for D:\js-harness`, and `remote status` twelve seconds later `running`, `server:
  connected`, `capacity: 1/32` and the environment address; the supervisor is detached, so it
  outlives the session that started it. The end-to-end test's timeout went from 60 s to 5
  minutes, since it takes 6 s alone and about 40 s inside the suite.
- 2026-10-03: T2's first commit was refused by the gate (`FAIL tests`) while `npm test` alone
  passed (1490 tests, 0 fail). The cause is older and unrelated: `evals/task-proof.test.mjs:304`
  has a fixture where one spec deletes `calc.mjs` while another imports it, and `node --test`
  runs them at once; reproduced at 10 red of 25 with eight busy cores and 0 of 25 on a quiet
  machine. See Follow-ups.
- 2026-10-04: T2's second commit was refused too (`npm run test timed out after 600 s`), and
  during it the real repository's `.git/config` turned to `core.bare=true`. Restored by hand
  (`git config --local core.bare false`; `git fsck` clean, staged files intact). The cause,
  found in a throwaway clone, is not this commit: a second session, opened from the phone
  through the very server T2 starts, was committing in the linked worktree
  `D:\js-harness-worktrees\codex-parity` at the same time. A commit in a linked worktree hands
  its hook `GIT_DIR=<main>/.git/worktrees/<name>` and an absolute `GIT_INDEX_FILE` (a commit in
  the main checkout hands only a relative `GIT_INDEX_FILE`); a test that runs `git init` in a
  temp directory with that `GIT_DIR` reinitialises the shared repository as bare. The timeout
  was two gates at once: the gate alone takes 475 s here against a 600 s cap. Fixed in this
  task's surface: `bin/remote.test.mjs` and `bin/js-harness.test.mjs` scrub `GIT_*` before any
  test, each with a guard test that runs under a decoy worktree's `GIT_DIR` and proves the
  decoy's config stays byte-identical (RED: `+ bare = true`; GREEN: 61/61 with
  `bin/lib/remote.test.mjs`). Still open, outside this task: `bin/contract.test.mjs:137` and
  `:317` and `evals/task-proof.test.mjs:459` leak the same way, and the right layer is the
  gate itself (see Follow-ups). `repositoryRoot` now calls `gitTopLevel`, one git call fewer.
- 2026-10-04: T2 committed as `380c6e2` (gate green, run alone: `PASS tests`). gentle-ai
  reviewed `ae8a75e..380c6e2`: medium risk, review due (`slice_budget_reached`, 1,086 lines);
  lineage `review-29de521059f8c9b4`, lens reliability, approved and acknowledged, authority
  burned. Three WARNINGs, taken as T2r, and four SUGGESTIONs, in Follow-ups. Codex has not
  reviewed `535ef09..380c6e2` yet: it runs after T1r and T2r, over the whole range.

## Follow-ups
- `bin/lib/remote.mjs` imports `quoteWindowsArg` and `windowsCommandLine` from
  `bin/codex-review.mjs`, so a lib module depends on a command module; moving the two into
  `bin/lib` is a small refactor outside T1's surface.
- A name with `& | < > ^ %` makes the `.cmd` quoting throw, which `supervise` would log and
  retry forever: T2 rejects such a name before starting.
- T1 review suggestions (gentle-ai, advisory): `nextDelay` accepts a `minMs` above `maxMs`; the
  cwd assertion in the real-process test is platform-fragile; the healthy-run reset is proved in
  `nextDelay` but not through `supervise`.
- T2 review suggestions (gentle-ai, advisory): `start` reports success before the supervisor
  proves it stays up; the `Connected` match is case-insensitive but compared case-sensitively;
  the `supervise` entry (argument parsing, exit codes, the failure line in the log, the signal
  wiring) is asserted only through the end-to-end test; the log tail is cut at a byte offset
  and its first line can start inside a character or an escape sequence.
- The log is appended across restarts and never rotated; `status` reads only its last 64 KiB,
  but the file grows without limit.
- **A commit in a linked worktree can turn the main repository bare** (2026-10-04): the gate
  passes git's repository variables to its sensors, and `bin/contract.test.mjs:137`, `:317` and
  `evals/task-proof.test.mjs:459` run `git init` under them (the last also `git add --all`,
  which replaced that worktree's index). The fix at the right layer is in `bin/check.mjs`: drop
  git's repository-local variables (`git rev-parse --local-env-vars`) from every sensor's
  environment, which protects every project the hook is installed in. It needs its own fix on
  `main`, because every branch with a worktree is exposed until it has it. Until then: no
  commit from a linked worktree, and never two gates at once.
- `evals/task-proof.test.mjs:304` fails under load (a spec deletes the file another imports).
  A fix that keeps what it proves: delete from the same spec file that imports it. It can
  refuse any commit on a busy machine, so it is worth its own small fix.
- The whole suite now takes 428–470 s against the gate's 600 s limit for a sensor
  (`bin/check.mjs:69`); the next slow test crosses it.
- Two `remote start` at the same moment are not locked against each other and could launch two
  supervisors.

## Next step
State on 2026-10-04: the plan, T1 (`ae8a75e`) and T2 (`380c6e2`) are committed on
`feat/remote-control`, not pushed; both slices approved by gentle-ai. The server for
`D:\js-harness` is running, started with `js-harness remote start` (detached; `remote status`
shows it, `remote stop` ends it). In order:

1. The gate fix on `main` (Follow-ups, first item): until it lands, a commit from a linked
   worktree can turn this repository bare, and the F6 session works in one. Proposed to
   Sebastián as its own PR against `main`; waiting for his answer. He was asked to keep that
   session from committing meanwhile.
2. T1r and T2r, one delegated writer, then their commit and assessment.
3. Codex over the range: `js-harness codex-review --base 535ef09`.
4. T3 to T6.

Two questions are open with Sebastián: the chain strategy (proposed: stacked to `main` in three
slices, plan+T1+T2 with a size exception, T3+T5, T4+T6), and the gate fix as its own PR.
Never run two gates at once, and after a failed gate check `git rev-parse --is-inside-work-tree`.

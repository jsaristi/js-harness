# Remote sessions: open a local session from the phone

Locator: `odd/tasks/remote-control.md` · Engram mirror: `odd/remote-control/tasks` · Branches: `feat/remote-control`
(slice 1, PR #28, merged), `feat/remote-at-login` (slice 2, PR #29, merged, cut from it),
`feat/remote-account` (slice 3, PR #30, merged, cut from slice 2), `docs/remote-live-check` (this
record and T7's, cut from `main`)

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
  Decided on 2026-10-04, before T3: the launcher is `js-harness-remote-<id>.cmd`, running the
  same `remote start` (never `--at-login` itself); the record is a top-level `optional` array of
  `{ path, sha256 }` in the manifest, which `install` and `sync` carry forward untouched and
  `uninstall` removes by hash without touching the folder. This machine has no manifest (the
  harness runs from its checkout), so recording creates one with a `null` version that still
  reads as not installed, and forgetting the last record removes it again. The flag is
  symmetric: `start --at-login` starts and turns the launcher on, `stop --at-login` stops and
  turns it off, plain `stop` leaves it on, and `status` says which it is.
- The TUI shows `Remote status`, `Remote start` and `Remote stop` in the project section of
  any git repository; stop asks first, because it ends the sessions opened through the server.
  The login launcher is not offered there (decided 2026-10-04, before T5).
- `doctor` gains a Claude account check: `ok` when both identifiers match, `mismatch` (a gap in
  Fix, the session digest and the TUI) when they differ, with `claude auth login` as the fix.
  Decided on 2026-10-04, before T4: it is one row, `claude-account`, after the tool rows, with
  its state in the `claude` dimension and `n/a` in the others. Both files are found from the
  home the command was given (`<home>/.claude.json`; `<home>/AppData/Roaming/Claude/config.json`
  on Windows, `<home>/Library/Application Support/Claude/config.json` on macOS), never from
  the environment, so a test with a temp home cannot read the real account. On any other
  platform the state is `unknown`. Measured on this machine without printing either value:
  both identifiers are present and equal.

## Tasks
- [x] T1 Supervisor: runs the server in a clean environment, logs it, restarts it with a capped
  backoff; tested with a fake `claude` (route: delegated writer)
- [x] T1r T1 review findings: keep a `CLAUDE*` variable the user set persistently (only the
  ones a parent session injected are removed), and a log that cannot be opened or written never
  ends the supervisor (gentle-ai WARNINGs `R3-env-strip-too-broad`,
  `R3-log-failure-kills-supervisor`) (route: delegated writer)
- [x] T2 `remote start|stop|status`: scope, state file, identity-checked stop, status read from
  the log; usage and registry (route: delegated writer)
- [x] T2r T2 review findings: a failure after the supervisor is spawned (its identity cannot be
  read) must not leave it running unrecorded, and `stop` must keep the state file when the
  process's identity could not be established, deleting it only when the process is proven gone
  (gentle-ai WARNINGs `R3-start-orphans-supervisor-on-post-spawn-failure`,
  `R3-stop-deletes-record-when-identity-unproved`); the fake-world tests are skipped or made to
  pass off Windows (`R3-tests-fail-off-windows`) (route: delegated writer, with T1r)
- [x] T2s Codex findings on the lifecycle: a successful `stop` never leaves a server running
  (the supervisor is quiesced before its descendants are collected, and a fresh look confirms
  nothing is left), two overlapping `start` cannot both launch (an exclusive per-project
  lock), an unreadable state file is `unknown` instead of `gone`, and every `unknown`
  message says how to get out of it (Codex P1, P2, P2; gentle-ai `R3-unknown-no-recovery`)
  (route: delegated writer)
- [x] T2t Codex's second findings: the supervisor is revalidated in the snapshot its tree is
  read from, so a reused pid never hands over an unrelated program's children; `stop` holds
  the same lock as `start` and removes only the record it read; a descendant that cannot be
  identified makes `stop` refuse instead of reporting a clean tree; the home is resolved to
  an absolute path before any path is built; the lock is released only by its owner and a
  failed release never replaces the command's result (Codex P1, P2, P2, P2; gentle-ai
  `R3-lock-release-unconditional-and-may-throw`) (route: delegated writer)
- [x] T3 Login launcher: `--at-login` writes the Startup-folder file, recorded as an optional
  machine-manifest file and removed exactly by `stop --at-login` and `uninstall` (route:
  delegated writer)
- [x] T3r Review findings on the launcher: `start` checks its own input (the name) before the
  launcher is written, so a start that refuses leaves none; replacing a recorded launcher
  restores the earlier one when the new one cannot be recorded; what each reader does with a
  manifest that holds only an optional record is tested and the comment says what is true;
  `uninstall` keeps and reports an optional file it cannot read or remove; the real-cmd test
  no longer pins one machine's code page (gentle-ai `R4-launcher-before-name-validation`,
  `R2-name-validated-after-launcher`, `R3-launcher-written-before-name-validation`,
  `R2-null-version-every-reader-claim`, `R3-uninstall-optional-throw-untested`,
  `R3-cmd-negative-assertion-machine-dependent`; Codex P2) (route: delegated writer)
- [x] T3s `uninstall` says why it kept an optional file: one it could not read or remove is
  named with the error code and the advice to remove it by hand, since no record of it is
  left, and the remove failure is tested through an injected seam (gentle-ai
  `R4-uninstall-optional-kept-not-retryable`, `R3-uninstall-remove-failure-untested`,
  `R3-kept-label-pinned`, `R3-drive-root-test-machine-state`) (route: delegated writer)
- [x] T4 `doctor` account check with the `mismatch` state through Fix, digest and TUI (route:
  delegated writer)
- [x] T5 TUI: `remote` in the project section of the menu (route: delegated writer)
- [x] T6 Roadmap: the phase and its steps, the Commands row (route: inline)
- [x] T7 Live check on this machine, split from T6 because it needs Sebastián: `remote stop`
  and `remote start` load the reviewed code and end the sessions opened through the server,
  then a session opened from the iOS app runs in `D:\js-harness`, and `remote stop` leaves no
  process of it. The other live check is done: `doctor` shows the account check `ok` here
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
- 2026-10-04: the gate fix is PR #27 (`fix/gate-git-env`, cut from `main`, commit `5e31d14`,
  inline). RED: three new tests in `bin/check.test.mjs` failed, the third with `bare = true`
  in a decoy repository's config; GREEN: `node --test bin/check.test.mjs` 72/72, and the gate
  on the commit `PASS tests`. `checkSensor` drops the fifteen variables git lists as
  repository-local, in any letter case; a test asks the installed git for its own list, so a
  git that grows one fails here first. gentle-ai: medium, 107 lines, not due (`under_budget`);
  Codex over `535ef09..5e31d14`: no actionable defects, recorded. Not merged: his go-ahead.
- 2026-10-04: two more changes for that branch could not be committed and wait in a stash
  (`git stash list`, "fix/gate-git-env pending"): the fix of the flaky
  `evals/task-proof.test.mjs:304`, and `AGENTS.md` saying a compact is two blocks, the bare
  `/compact` and then the prompt that resumes (1,491 of 1,500 tokens). Three gates refused
  them, none for what they change (Follow-ups, the suite and the limit). `core.bare` stayed
  `false` after each.
- 2026-10-04: T1r and T2r written and verified, not committed: no gate can finish until the
  limit is decided (delegated writer, one agent, two rounds; `node --test bin/remote.test.mjs
  bin/lib/remote.test.mjs bin/js-harness.test.mjs bin/lib/process-tree.test.mjs` 125/125, 0
  skipped, re-run by the parent; 711 insertions, about 500 of them tests). T1r: a variable
  the server would lose is kept when the Windows registry holds it (user over machine; the
  registry's value for a plain `REG_SZ`, the inherited one otherwise), read with `reg.exe`
  through an injectable reader; a registry that cannot be read strips them all, as before,
  with one line in the log. This machine's registry holds no `CLAUDE*` or `ANTHROPIC*` name,
  so nothing changes here. A log that cannot be opened or appended is skipped and tried again
  on the next write; the server and the backoff go on (RED: the loop rejected with `EISDIR`
  and `EEXIST`). T2r: any failure after the spawn stops the supervisor through `killTree`
  with the handle `start` holds, confirms its exit and exits 1, or names the pid when it
  cannot; the recorded process is now `running`, `gone` or `unknown`, shared by the three
  subcommands, and `unknown` (creation time unreadable, snapshot failed) kills nothing, keeps
  the state file and exits 1. That last rule was widened by the parent to `start` (which
  launched a second supervisor over the record: RED `0 !== 1`) and `status` (which said `not
  running` and exited 0), the same defect the review named in `stop`. The 23 tests that need
  Windows are skipped elsewhere by `process.platform`; no RED was possible for that here.
  The live server (supervisor pid 2260) was not touched and `remote status` still reads it.
- 2026-10-04: gentle-ai reviewed T1r and T2r as the pending change of the working tree, since
  the commit is blocked (5 paths, 872 lines, medium risk, `slice_budget_reached`): lineage
  `review-be363b8d8e047b9a`, lens reliability, approved and acknowledged, authority burned.
  Three WARNINGs and two SUGGESTIONs, all advisory, in Follow-ups. The reviewed tree is
  `7767622`; this entry and those follow-ups were written after it, in this document only.
- 2026-10-04: Sebastián decided the limit: twenty minutes, in PR #27. `fix/gate-git-env`
  now holds four commits, pushed: `5e31d14` (git's variables), `7687b19` (the limit; RED
  `600000 !== 1200000`), `e006a4b` (the flaky test) and `0efda15` (`AGENTS.md`). Their
  gates took 664 s, 644 s and 632 s, each past the old limit. gentle-ai: 19 more lines, not
  due (`under_budget`); Codex over `5e31d14..0efda15`: no actionable defects, recorded.
  The branch is merged here as `9070a8b`, because nothing can be committed on this branch
  without the limit; PR #27 carries the same commits to `main` and waits for his go-ahead.
  T1r and T2r are committed with this entry; the next one names the commit.
- 2026-10-04: T1r and T2r are `c74e42c` (gate `PASS tests`, 589 s). `gentle-ai review
  assess --base-ref 9070a8b --committed-only`: medium, 905 lines, due
  (`slice_budget_reached`), and its status offers a fresh start. Nothing was started: the
  four code files of the commit are byte-identical to the tree approved under
  `review-be363b8d8e047b9a` (`git diff 7767622 c74e42c` over them is empty), and the rest of
  the range is this document. The reviewed boundary is `c74e42c`.
- 2026-10-04: Codex over `535ef09..c74e42c` found three defects and recorded nothing, because
  its commands showed 725 of the 1,911 changed lines; it is rerun after the fixes. Taken as
  T2s: [P1] between `stop`'s snapshot and its kill the supervisor can restart the server,
  which then survives while `stop` deletes the record and reports success; [P2] two
  overlapping `start` both launch and only the last is recorded (already in Follow-ups, now
  a task); [P2] a state file that cannot be read or parsed answers `gone`, so `start`
  overwrites it and `stop` deletes it without killing anything. T2s also takes gentle-ai's
  `R3-unknown-no-recovery`, since the third fix makes a corrupt file block the three
  subcommands until someone removes it.
- 2026-10-04: T2s done (delegated writer, the same agent; `node --test bin/remote.test.mjs
  bin/lib/remote.test.mjs bin/js-harness.test.mjs bin/lib/process-tree.test.mjs` 137/137, 0
  skipped, re-run by the parent; `remote status` still reads the live server). `stop` reads
  the supervisor's tree while it lives, kills the supervisor alone so nothing more is
  launched, kills what it read, and looks again for what the killed processes left until a
  look finds nothing (five looks at most); a survivor or a failed look keeps the state file
  and exits 1 naming the pids (RED: `stop reported success while pid 900 of the supervisor's
  tree still ran`). The order Codex asked for, supervisor first and then its descendants,
  was measured and does not work on Windows: killing the supervisor took the `.cmd` shell
  with it and the server under that shell was left with a parent no snapshot lists. `start`
  holds `<id>.lock` beside the state file (created with `wx`, owner's pid and creation
  time inside) from before the state is read until it is recorded, released in a
  `finally`; a held lock refuses, a lock whose owner is proven gone is taken over, and one
  whose owner cannot be identified refuses and says it may be removed by hand (RED: both
  launched, `0 !== 1`). A state file that cannot be read, is not JSON or names no pid is
  `unknown` in the three subcommands, and only a missing one is `gone` (RED: `it is not
  JSON: 0 !== 1`). Every `unknown` message names the state file and the pid, and says the
  file may be removed by hand once no such supervisor runs. Decided by the parent: the race
  that is left (Follow-ups) is recorded, not closed with a stop request the supervisor would
  poll, because that adds a protocol for a window of milliseconds.
- 2026-10-04: T2s is `1ae255e` (gate `PASS tests`, 560 s). gentle-ai reviewed
  `c74e42c..1ae255e`: medium, 670 lines, due (`slice_budget_reached`); lineage
  `review-37b98d774c3eb2f7`, lens reliability, approved and acknowledged, authority burned.
  One WARNING and three SUGGESTIONs, advisory: after a `stop` that killed the supervisor
  and then failed, the record names a dead supervisor (already in Follow-ups); the
  stale-lock takeover's re-read branches are untested; the lock release is unconditional and
  can throw over a successful start (taken in T2t); a target that was already gone at kill
  time widens the exited-parent window by the look-to-kill interval.
- 2026-10-04: Codex over `535ef09..1ae255e`, recorded this time, with four findings it
  reproduced read-only, taken as T2t: [P1] between `stop`'s identity check and its snapshot
  a reused pid makes `selectDescendants` select the children of an unrelated process, and
  the kill ends them; [P2] a `start` between `stop`'s kill and its removal of the state
  file records a replacement that `stop` then deletes; [P2] a descendant with a null
  creation time is left out with everything under it, and `stop` reports a clean tree;
  [P2] a relative `--home` with a `--cwd` in another repository makes the supervisor and
  `status` use different log paths.
- 2026-10-04: T2t done (delegated writer, the same agent; the four test files 149/149, 0
  skipped, re-run by the parent; `remote status` still reads the live server and no lock is
  left in the real home). The supervisor is a live root only when the snapshot its tree is
  read from shows its pid with the recorded creation time: absent or another creation time
  is `gone` and selects nothing, an unreadable one is `unknown` (RED: the kills reached
  pids 910 and 911, the children of the pid's new owner). `stop` takes `start`'s lock
  before it reads the state and removes the state file only while it still records the pid
  and creation time it read (RED: a start during the kill launched a replacement, whose
  record `stop` deleted). A process with no creation time under the tree makes `stop`
  refuse before any kill, naming it; found in a later look, the rest is killed and the stop
  fails. `--home` and `JS_HARNESS_HOME` are resolved in argument parsing. The lock is
  released only while it holds its owner's identity, and a failed removal is a line in the
  output, not the command's result. Committed with this entry.
- 2026-10-04: T2t is `0493630` (gate `PASS tests`, 553 s). gentle-ai reviewed
  `1ae255e..0493630`: medium, 547 lines, due; lineage `review-f64ba0043126b5ac`, lens
  reliability, approved and acknowledged, authority burned, two SUGGESTIONs (Follow-ups).
  Codex over `1ae255e..0493630`: no actionable defects, recorded. With `535ef09..1ae255e`
  recorded before, every code commit of the first slice has a Codex record; the reviewed
  boundary is `0493630`.
- 2026-10-04: PR #27 merged on Sebastián's go-ahead (`a3a1eb1` on `main`). The first slice
  is PR #28 (`feat/remote-control` at `aaa79db`, against `main`; the pre-push hook passed:
  five code commits, all covered by a Codex record; 3,396 insertions, the size exception he
  accepted). The second slice is the branch `feat/remote-at-login`, cut from `aaa79db`; its
  PR is opened against `main` once #28 is merged, so its diff holds only T3 and T5.
- 2026-10-04: T3 done (delegated writer, a fresh agent that also wrote T5; `node --test
  bin/remote.test.mjs bin/lib/remote.test.mjs bin/js-harness.test.mjs
  bin/lib/process-tree.test.mjs` 177/177 and `node --test bin/lib/manifest.test.mjs
  bin/install.test.mjs bin/update.test.mjs` 125/125, 0 skipped, both re-run by the parent).
  RED: `unknown flag: --at-login` (18 of 18), `not implemented` for the manifest functions
  (10 of 47) and the launcher text (6 of 6), `manifest version: null` in `status --global`.
  `bin/lib/manifest.mjs` exports `recordOptionalFile` and `forgetOptionalFile`; optional
  files are hashed by bytes, an empty `optional` is dropped so an installed manifest comes
  back byte-identical, and `bin/update.mjs` reads a `null` version as not installed.
  `loginLauncher` in `bin/lib/remote.mjs` builds the text and refuses, naming it, a value
  with `& | < > ^ % " !` or a control character. Measured with a real `cmd.exe`: a batch
  file is decoded line by line in the console's code page, so a non-ASCII path is not found
  under 850, 437 or 1252 and is found after a `chcp 65001 >nul` line; the file is UTF-8
  without a BOM, and that line is written only when the command holds non-ASCII (the test
  forces code page 850, since this machine's console already uses 65001). Decided by the
  writer, kept: a launcher with the same content and no record is adopted; `stop --at-login`
  keeps an edited or unrecorded file, says so and exits 1 after the ordinary stop; when the
  ordinary start fails after the launcher was written, the launcher stays on and recorded
  and the command exits 1; `status` adds `login launcher: on|off`, with a note for an
  edited or unrecorded file. Not turned on on this machine: the real Startup folder holds
  only `desktop.ini`, no manifest exists in the real home, and `remote status` reads the
  live server with `login launcher: off`. Committed with this entry.
- 2026-10-04: T3 is `0be9491` (gate `PASS tests`, 542 s). T5 done (the same writer; `node --test
  bin/tui.test.mjs` 69/69, re-run by the parent; RED: 10 of 69, `commands.project-remote-status
  is not a function`). The project section of every git repository ends with `Remote status`,
  `Remote start` and `Remote stop`, each calling `remoteMain` with the `--cwd` and `--home` the
  other project commands get, through an injectable seam; stop asks first and its prompt
  says the sessions opened through the server end. Four existing tests that reached the
  machine section by a fixed number of key presses were adjusted to the longer menu.
  Committed with this entry; gentle-ai and Codex review the slice (`0493630..HEAD`) next.
- 2026-10-04: T5 is `c7be78f` (gate `PASS tests`). gentle-ai reviewed `0493630..c7be78f`, T3
  and T5 together: high risk, 14 paths, 1,364 lines, due (`high_risk`); lineage
  `review-f6d1164ce87b4799`, the four lenses, approved and acknowledged, authority burned.
  Seven WARNINGs and eight SUGGESTIONs, all advisory. Taken as T3r: the launcher is written
  before `start` checks the name, so a repository at a drive root leaves a launcher that
  refuses at every login (three lenses); a replaced launcher is deleted, not restored, when
  its record cannot be written (also Codex's P2); the comment that every reader takes a
  null-version manifest for not installed is proved for two readers only; an optional file
  that cannot be read aborts `uninstall` halfway; the real-cmd test asserts a failure that
  depends on the machine's code page; two names that say less than they hold. One WARNING
  was this document: Next step still told the reader to merge PR #27 and to start T3 and
  T5; rewritten. The rest are in Follow-ups.
- 2026-10-04: Codex over `0493630..c7be78f`, twice. The first run was recorded and is not a
  review: its own message says the diff was truncated and the review not completed, because
  its instructions ask it to delegate and that session has no sub-agents. The second run
  found one defect, [P2] the replaced launcher above, and again called its coverage partial
  for the same reason. Both records stand in `codex-reviews.jsonl`; see Follow-ups.
- 2026-10-04: T3r done (delegated writer, the same agent; `node --test bin/remote.test.mjs
  bin/lib/remote.test.mjs bin/js-harness.test.mjs bin/lib/process-tree.test.mjs` 180/180 and
  the manifest, install, update and TUI files 201/201, 0 skipped, re-run by the parent).
  With `--at-login` the name is checked before the launcher is written (RED: `a launcher
  left on would repeat a start that refuses at every login`); the name is the only refusal
  that depends on input alone, the flags being checked at parse time, and a test places the
  repository at a drive root through a new `deps.gitTopLevel` seam. A replaced launcher is
  put back when the new one cannot be recorded, and only a file this command created is
  removed (RED: `ENOENT` on the launcher that should still be there). The readers of a
  manifest that holds only an optional record were checked one by one and none misbehaved:
  `install`, `sync --global` and `uninstall --global` already did the right thing, so their
  four new tests had no RED; the two version readers in `bin/update.mjs` now go through one
  helper, `installedVersion(home)`, and the comment names each reader. `uninstall` keeps an
  optional file it cannot read or remove and finishes (RED: `EISDIR`). The real-cmd test
  reads the code page back in the same console and asserts the failing half only when it
  really was 850. `launcherKept` is `launcherNotOff` and `LAUNCHER_VALUES` is
  `LAUNCHER_LABELS`, iterated as the one list. Committed with this entry.
- 2026-10-04: T3r is `1640f01` (gate `PASS tests`, 540 s). gentle-ai reviewed
  `c7be78f..1640f01`: high risk, 9 paths, 470 lines, due (`high_risk`); lineage
  `review-b927eaf4aba0ad53`, the four lenses, approved and acknowledged, authority burned.
  One WARNING and six SUGGESTIONs, advisory. Taken as T3s: `uninstall` keeps a launcher it
  could not remove, prints it as `kept (modified by you)` and deletes the manifest, so a file
  locked for an instant stays in the Startup folder with no record and a wrong reason; the
  remove failure has no test; the drive-root test's second half may depend on the machine
  having a `Q:` drive. The other two are in Follow-ups. Codex over `c7be78f..1640f01`: no
  actionable defects, recorded, and no notice of partial coverage this time.
- 2026-10-04: T3s done (delegated writer, a fresh agent that also wrote T4; `node --test
  bin/lib/manifest.test.mjs bin/install.test.mjs bin/update.test.mjs` 135/135, re-run by
  the parent). `uninstall(home, deps)` takes a `deps.removeFile` seam and returns
  `keptOptional`, each entry with its reason (`edited`, `unreadable`, `unremovable`) and
  the error code; `kept` is unchanged for its callers. `uninstall --global` prints `could
  not remove <path> (EBUSY): it is still there and no longer recorded, so nothing else will
  remove it; remove it by hand` on stderr, and keeps `kept (modified by you)` for a file
  that was edited (RED: `actual: undefined` for `keptOptional`, and `actual: []` for the
  line). Decided by the parent, inline: such an uninstall exits 1, as the project-scope
  one does, since a file left behind that nothing records is not a finished uninstall
  (RED: `0 !== 1` in both tests). The drive-root test stays as it is: with the root faked
  as `Q:\`, the state, log and lock live under the temp home, the launcher under the temp
  `APPDATA`, and spawn, identify and the CLI look-up are fakes, so nothing opens the root;
  it passes on this machine, which has no `Q:`. Committed with this entry.
- 2026-10-04: T3s is `7fda4ce` (gate `PASS tests`, 540 s), the last commit of the second
  slice. gentle-ai: medium, 5 paths, 232 lines, not due (`under_budget`), so it stays
  pending and is assessed with T4 from `1640f01`. The third slice is the branch
  `feat/remote-account`, cut from it.
- 2026-10-04: T4 done (delegated writer, the agent that wrote T3s; `node --test
  bin/doctor.test.mjs bin/doctor-hook.test.mjs bin/lib/stack.test.mjs bin/lib/digest.test.mjs
  bin/tui.test.mjs` 238/238, re-run by the parent). RED: 20 of 238 against stubs, among
  them `expected: 'claude-account  n/a       ok …'` and `actual: 'ok'` against `'mismatch
  claude'`. `bin/lib/stack.mjs` exports a `checks` array beside `tools`, with
  `claude-account` in the tools' shape, and `probeStack` returns the tools and then the
  checks; `tools` is untouched, since other modules read it as the list of tools. The gap
  states are defined once, `GAP_STATES` in `bin/lib/digest.mjs`, now with `mismatch`, and
  `bin/doctor.mjs` and the TUI's severity are built on it. `computeUpToDate` answers `n/a`
  for a row whose `installed` is `n/a`, by state and not by id. Decided by the writer,
  kept: the identifiers are compared trimmed and without letter case, a blank one counts as
  missing, and a refetch stores `claude-account: null` in the cache as it does for a row
  with no version to look up, never an identifier. A test asserts that neither fixture
  identifier appears in the plain or the `--json` output of a mismatch. Found by the
  parent's re-run, outside the writer's surface: `bin/js-harness.test.mjs` pinned the six
  row ids (`+ 'claude-account'`), updated inline. On this machine `doctor --offline` prints
  `claude-account  n/a       ok        n/a       n/a       n/a` and no Fix entry for it.
  The full suite passed with T4 in the tree (T3s's gate). Committed with this entry.
- 2026-10-04: T6 done, inline, in T4's commit since it is a document: `docs/ROADMAP.md` has the
  Remote sessions phase with its five steps (three checked, the live check and the merges
  open), `remote` in the Commands row, and Next says what is left is his. `js-harness
  progress` counts the phase. The live check became T7.
- 2026-10-04: T4 with T6 is `879f990` (gate `PASS tests`, 540 s). gentle-ai reviewed
  `1640f01..879f990`, T3s and T4 together: medium, 16 paths, 785 lines, due
  (`slice_budget_reached`); lineage `review-1ed423e2cfcccefd`, lens reliability, approved and
  acknowledged, authority burned. Three SUGGESTIONs, advisory, in Follow-ups. Codex over
  `1640f01..879f990`: no actionable defects, recorded; it said again that it could not
  delegate a broader verification. That one record covers both branches: the push gate takes
  a record whose head is ahead of the branch being pushed (`bin/check.mjs`, the
  `merge-base --is-ancestor` test). The reviewed boundary is `879f990`. Every task but T7 is
  done; nothing of slices 2 and 3 is pushed.
- 2026-10-04: PR #28 merged on Sebastián's go-ahead (`9390972` on `main`). The second slice
  is PR #29 (`feat/remote-at-login` at `7fda4ce`, against `main`; the pre-push hook passed:
  four code commits, all covered by a Codex record; 15 files, 1,791 insertions and 73
  deletions, and its diff against `main` holds only T3, T5, T3r and T3s). It waits for his
  go-ahead. The third slice is not pushed.
- 2026-10-04: PR #29 merged on Sebastián's go-ahead (`0d430af` on `main`). The third slice
  is PR #30 (`feat/remote-account`, against `main`; the pre-push hook passed: one code
  commit, `879f990`, covered by a Codex record; 12 files, 557 insertions and 47 deletions
  when opened, its diff against `main` holding only T4, T6 and this document). It waits for
  his go-ahead. The commit of this entry is pushed to the same PR.
- 2026-10-04: PR #30 merged on Sebastián's go-ahead (`7d3741b` on `main`), at `8bc87fa`. The
  three slices are on `main`, so the roadmap's `Reviewed and merged (three slices)` step is
  checked. This entry is the first commit of `docs/remote-live-check`, cut from `7d3741b`;
  the record of T7 goes on the same branch, and the branch is one PR against `main`.
  The first gate of that commit was refused: `evals\isolation-probe.test.mjs` failed as a
  file, 1.5 s in, with no test named; alone it passes 122/122 and the same commit retried
  passed (`37b2b90`). See Follow-ups.
- 2026-10-04: T7 done, on Sebastián's word, from `docs/remote-live-check` (`main`'s code).
  `remote stop` answered `stopped` and exited 0 on the server that had run T2's code since
  2026-10-03: its tree held 17 processes, one session among them (`capacity: 1/32`), and
  none was left, each checked by pid and creation time; no state file and no lock
  remained. `remote start` answered `started` (supervisor pid 18896) and fifteen seconds
  later `remote status` said `running`, `server: connected`, `capacity: 0/32`. He opened
  sessions from the iOS app in the `js-harness` environment: `remote status` showed
  `capacity: 2/32` and two `claude.exe` under the server, and the session he asked
  answered that it ran in `D:\js-harness` on the branch `docs/remote-live-check`, which is
  what this checkout held. The final `remote stop` exited 0: 19 processes in the tree,
  none left, `remote status` said `not running`. The server was started again
  (supervisor pid 7564, `connected`, `capacity: 0/32`) and is left running. `doctor
  --offline` shows `claude-account  n/a       ok`. The login launcher is off.
- 2026-10-04: decided by Sebastián after T7: the login launcher stays off on this machine.
  After a restart of the PC the server is started by hand (`js-harness remote start` in
  `D:\js-harness`). The feature is closed with the PR of `docs/remote-live-check`.
- 2026-10-04, later the same day: he changed that decision and asked for the server to come
  back when the PC starts. `js-harness remote start --at-login` in `D:\js-harness`, run
  while the server was up, exited 0 and left it as it was (`capacity: 2/32` before and
  after, the same supervisor): it wrote
  `js-harness-remote-js-harness-86aa68a6ffce.cmd` in the Startup folder
  (`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`), which runs `node
  D:\js-harness\bin\remote.mjs start --cwd D:\js-harness --name js-harness`, and created
  `~/.js-harness/manifest.json` with a `null` version and that file in `optional`, by
  path and hash. `remote status` says `login launcher: on`. Not yet seen: a real login,
  so whether the server comes up after a restart of the PC is unproved until one happens.
  To undo it: `js-harness remote stop --at-login` (which also stops the server) or
  `uninstall`; both remove the launcher, and the manifest goes with its last record.

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
  passed git's repository variables to its sensors, and `bin/contract.test.mjs:137`, `:317` and
  `evals/task-proof.test.mjs:459` run `git init` under them (the last also `git add --all`,
  which replaced that worktree's index). Fixed in `bin/check.mjs` on `fix/gate-git-env`
  (`5e31d14`, PR #27, merged as `a3a1eb1`): a sensor's environment loses every variable
  `git rev-parse --local-env-vars` lists. Until each branch has it: no commit from a linked
  worktree of a branch cut before `a3a1eb1`, and never two gates at once.
- `evals/task-proof.test.mjs:304` fails under load (a spec deletes the file another imports).
  Fixed in `e006a4b` (PR #27): the touching test moved into the spec that imports the file.
- **The suite no longer fits the gate's limit on a busy machine** (2026-10-04): 600 s for a
  sensor (`bin/check.mjs`, `SENSOR_TIMEOUT_MS`) against a suite that took 428–470 s on a quiet
  machine. With about two of eight cores taken by other programs (a language server of an
  older desktop session spinning on a full core for 77 CPU-minutes, and a browser), three
  gates in a row refused a commit on `fix/gate-git-env`: one at 592 s on the flaky test
  above, two with `npm run test timed out after 600 s` (the last measured 607 s, 1,350 of
  1,454 tests done). Decided by Sebastián: the limit is twenty minutes (`7687b19`, PR #27).
  Still open: the suite takes more than ten minutes on a busy machine, and the limit now
  hides that instead of fixing it.
- T1r and T2r review findings (gentle-ai, advisory). WARNINGs: a record whose process stays
  `unknown` (a reused pid with an unreadable creation time) blocks `start`, `status` and
  `stop` for as long as it lasts, and no message says the state file may be removed by hand
  once the pid is checked (`R3-unknown-no-recovery`); the default process look-up is never
  tested for what `unknown` rests on, a row kept with a null creation time and a failed
  snapshot that throws (`R3-default-lookup-unproved`); the Windows-only skip also covers
  tests of platform-neutral logic that run through fakes (`R3-windows-only-skips`).
  SUGGESTIONs: the timeout and no-pid branches of stopping a spawned supervisor are
  untested; the `reg query` parser has no test for an empty value, a name with spaces or a
  value with a four-space run.
- `selectDescendants` in `bin/lib/process-tree.mjs` accepts a live root `{ pid, createdAt }`
  without checking that the snapshot holds that row; `resolveRoot` and `selectTrees` do
  check. `remote stop` now checks before calling it (T2t); the guard belongs in the function,
  outside this feature's surface.
- T2s and T2t review suggestions (gentle-ai, advisory), tests that are missing: the
  stale-lock takeover when the lock text changes between the look and the re-read; a target
  already gone at kill time, whose exited-parent window is widened by the look-to-kill
  interval; the state file vanishing or becoming unreadable between `stop`'s read and its
  removal; a lock already removed by hand, or unreadable, at release.
- Left open by T2t. A process with no creation time under the supervisor's tree blocks
  `stop` for as long as it exists; the message says to end it by hand. When the supervisor
  is already gone in the snapshot, what it left is not searched for, because its exit time
  is unknown and a window bounded by "now" could take in the children of whoever reused the
  pid.
- Left open by T2s. A server the supervisor launches between `stop`'s first look and the
  supervisor's death dies with it, and whatever that newborn server had already started is
  left with nothing tying it to the tree; it needs a stop during the instant a backoff
  expires. A cooperative stop (a request the supervisor polls, the kill as fallback) would
  close it. After a `stop` that killed the supervisor and then failed, a second `stop`
  finds the supervisor gone and removes the record; the first one's message names the pids
  left. A state-file write that fails midway leaves a file that now reads as `unknown`; a
  temp file and a rename would prevent it. Two `start` that find the same stale lock in
  the same instant can both take it. A supervisor that dies on its own can leave its
  server's children running, and `stop` then says `not running`.
- **`codex-review` recorded a review Codex itself called incomplete** (2026-10-04, range
  `0493630..c7be78f`): the record is written when the commands Codex ran showed every changed
  line, whatever its final message says. In both runs of that range Codex said its coverage
  was partial because its global instructions require delegation and `codex exec review`
  gives it no sub-agents; earlier ranges of this feature were reviewed without that notice.
  Open: whether the recorder should refuse a review whose message says it is not complete,
  and what in Codex's instructions changed.
- T3 and T5 review suggestions (gentle-ai, advisory), not taken: `recordOptionalFile` and
  `forgetOptionalFile` read, change and rewrite the machine manifest under no lock of its
  own, so two commands for different repositories, or one beside `install` or `sync`, can
  drop a record (`start --at-login` again adopts the file); the launcher pins the absolute
  paths of node and of this checkout's script, and `status` says `on` when either has moved
  since; the TUI offers the remote items on every platform while the command refuses off
  Windows, and no test asserts what the menu shows there.
- Left open by T3r. Over a manifest that holds only an optional record `uninstall` also
  removes the doctor cache, which an uninstall with no manifest leaves. Review suggestions
  (gentle-ai, advisory), not taken: nothing asserts that the keys of `LAUNCHER_LABELS` and
  the names `loginLauncher` destructures stay the same set, so a value without a label would
  be dropped, not refused; after a failed record the message says the file and its record
  are as they were, which holds only if the recorder failed before it touched the manifest,
  whose write is not atomic.
- T3s and T4 review suggestions (gentle-ai, advisory), not taken: the mismatch tests of the
  TUI, `doctor` and the hook pass `platform: 'win32'`, and nothing asserts that
  `computeStackState` and `doctorMain` forward it to the probe, so on another system a
  dropped option would show only there; the unreadable-file test pins `EISDIR`, a code that
  comes from the system and the Node version, where a thrown read error with a chosen code
  would prove the same; no test has an identifier with spaces around it, so removing the
  trim would fail nothing.
- `evals/isolation-probe.test.mjs` failed once inside the full suite (2026-10-04, the gate
  of `37b2b90`'s first attempt): the file itself failed 1.5 s in, with no test named, while
  no other gate ran and `core.bare` stayed `false`. Alone it passes (122/122 in 184 s) and
  the retried gate passed. The cause is not known; the gate's last lines do not show it,
  so the next time the commit's whole output has to be kept.
- Left open by T4. `DIMENSIONS` is still written three times (`bin/doctor.mjs`,
  `bin/lib/digest.mjs`, `bin/tui.mjs`); only the gap states were made one. The account row
  is `unknown` on a machine without the desktop app (Linux, or a PC that uses only the
  CLI), where there is nothing to compare.
- Left open by T3s. `uninstall` still deletes the manifest after it kept a file it could
  not remove: the file is reported and the command fails, but it is not retried.
- Left open by T3. At login the `.cmd` shows a console window for an instant, and a start
  that fails there is seen by nobody: its output goes to that window. The record matches by
  exact path string, so an `APPDATA` spelled in another letter case makes a second record
  (`uninstall` handles both). `uninstall` deletes the manifest even when it kept an edited
  launcher, as it already does for an edited component file.
- Left by T1r and T2r's writer, not fixed: when the supervisor's identity is unreadable and it
  survives `killTree`, `start` only reports the pid; a state-file write that fails can leave a
  partial file; in `bin/remote.test.mjs` the temp folder is removed before the reaper sweep,
  so a leaked process fails the teardown with `EPERM`; a persistent variable that the
  session did not inherit is not added to the server's environment.

## Next step
Closed on 2026-10-04: every task is done and nothing is left. PRs #27, #28, #29 and #30
are merged, the live check passed, and this record reaches `main` through the PR of
`docs/remote-live-check`, the last of the feature. Each code commit was approved by
gentle-ai and lies in a Codex record. What a later session needs to know:

- The server for `D:\js-harness` is running the merged code, started with `js-harness
  remote start` (detached; `remote status` shows it, `remote stop` ends it, and with it
  the sessions opened through it). The login launcher is on on this machine, by his
  decision: a `.cmd` in the Startup folder, recorded in `~/.js-harness/manifest.json`,
  starts the server at login. It has not been through a real login yet; after the next
  restart of the PC, `remote status` says whether it worked. It pins the paths of node
  (`C:\nvm4w\nodejs\node.exe`) and of this checkout, so moving either breaks it.
  `remote stop --at-login` or `uninstall` removes the launcher and its record.
- A session opened from the phone through the server works in `D:\js-harness` itself
  (`--spawn same-dir`), the same folder as a desktop session there: two sessions that
  write at once share one working tree and one branch.
- T7's first `remote stop` ended the session that was writing F6 in the linked worktree
  `D:\js-harness-worktrees\codex-parity`. Its work is on disk there, not committed; the
  roadmap's Next says what to do before a commit in that worktree.

Decided by Sebastián on 2026-10-04: the gate fix goes as its own PR against `main`
(branch `fix/gate-git-env`, cut from `main`); this feature goes stacked to `main` in three
slices, each its own PR merged in order: plan+T1+T1r+T2+T2r (with T2s and T2t, above the
400-line budget, which that slicing accepts), then T3+T5, then T4+T6. The gate's limit for a
sensor is twenty minutes.
Never run two gates at once, and after a failed gate check `git rev-parse --is-inside-work-tree`.
A gate takes about ten minutes here, so commits run in the background and a document-only
change rides on the next task's commit when it can; a commit message file is written before
its commit starts, not inside a command a guard can abort.

# Login launchers with no window, and one remote row per project

Locator: `odd/tasks/login-launchers.md` · Engram mirror: `odd/login-launchers/tasks` · Branch: `claude/login-launchers-1e5c40`
Delivery: one slice, one pull request. Test runner: `node --test`.

## Goal
A login opens no console window for js-harness, and a restart of the remote-control server no longer leaves a
disconnected "js-harness" row in the Claude Desktop sidebar.

## Why
He sees both at every boot: two consoles (the two `.cmd` files in the Startup folder) and one more disconnected row
for each start of `claude remote-control` (each boot, each watchdog restart, each app update). Both are noise he has
to close or archive by hand, every day.

## Done when
- `node --test bin/lib/remote.test.mjs bin/remote.test.mjs bin/lib/startup-file.test.mjs bin/wake.test.mjs` exits 0
- `npm run check` exits 0
- A launcher written by the new code, opened by the Windows shell, runs node with no window (Log L3).
- The pull request is open and `js-harness codex-review` recorded its review.

## In scope / Out of scope
- In: `bin/lib/startup-file.mjs`, `bin/lib/remote.mjs`, `bin/remote.mjs`, `bin/wake.mjs`, their tests, the tests
  that name a launcher, README, `docs/SPEC.md`, this document.
- Out: running `remote stop` on the real server (it ends the sessions opened through it); archiving the rows that
  are already disconnected (his, in the app); rewriting his real Startup files before this merges.

## Constraints
- What is written outside the repo is recorded and undone exactly — because the predecessor needed four purge scripts.
  The old `.cmd` is removed only when it is still what js-harness recorded writing; one he edited is kept and refused.
- The server keeps its many sessions (`--spawn`, capacity 32) — because opening a new session from the phone is what
  `remote` is for.

## Ask me before
Nothing: the brief carries his request; spend is one gate and one Codex review.

## Specs
- S1. His request (2026-10-26, lead transcript 908805db-d0b9-4c2f-a9e6-f828b6bf1e41, line 38491, verbatim): "puedes
  revisar por que siempre se me abren dos consolas de terminal cuando inicio el computador y me aparece dos js-harness
  con un computador y me aparecen varios desconectados mira en la barra izquierda del claude desktop".
- S2. `remote start --at-login` and `wake --at-login` write a launcher Windows runs with no window: a `.vbs` that runs
  the same command line through `WScript.Shell.Run` with window style 0. ASCII only: a letter beyond ASCII is written
  as `ChrW(n)`. It is recorded in the machine manifest as before.
- S3. The next `--at-login` run replaces the old `.cmd` of that command when it is still what js-harness recorded
  writing (file and record removed); one that is not is refused and left, as a file at the new path would be.
  `remote stop --at-login` and `wake --at-login --remove` remove both, so a machine that never migrated is undone too.
  `remote status` names an old `.cmd` still there. A start that fails halfway puts the old `.cmd` back with the rest.
- S4. The server is started with `--no-create-session-in-dir`: it pre-creates no session, so a start adds no row.
  `remote status` reads the server's `Ready` as connected.
- S5. The brief's reattach (`--session-id`, falling back to a new session) is not built: measured in L2, it turns the
  server into a single session.

## Next step
None in this repo: the pull request is open. On his machine, after the merge: pull the main checkout, run `js-harness remote start --at-login` and `js-harness wake --at-login` once (they replace the two `.cmd` files), and archive the disconnected rows already in the sidebar (L4). The server takes `--no-create-session-in-dir` at its next start.

## Tasks
- [x] T1 (build, inline) S2, S3: hidden launchers for remote and wake, with the migration. 76ae7e11.
- [x] T2 (build, inline) S4, S5: no pre-created session; `Ready` is connected. 76ae7e11.
- [x] T3 (docs, inline) README, SPEC, usage lines. 76ae7e11.
- [x] T4 (verify) `npm run check` (the pre-commit gate of 76ae7e11), Codex review, PR.

## Log
- L1. 2026-10-26, the brief from the lead (JH ORQ): fix the two consoles with a hidden launcher and migrate the `.cmd`
  files; make the supervisor reattach to its session with `--session-id`, falling back to a new one; probe
  `--session-id` on CLI 2.1.310 first.
- L2. 2026-10-26, probes with the real CLI 2.1.310 in this worktree, server named `JH probe reattach` (raw logs in the
  session scratchpad, `probe/`):
  - Default (`--spawn same-dir`): `Capacity: 0/32`, `environment=env_...`, and one pre-created session
    `session_019bnZDbodA88WQgarxsoVBZ` named after `--name`. That pre-created session is the row each start adds; the
    real log holds three such sessions (`session_0191swwqd6...`, `session_01JdjFumBu...`, `session_01Ge3TqrL6...`),
    one per run.
  - `--session-id session_019bnZ...`: reattaches to that session, but prints `Single session · exits when complete`,
    with no environment and no capacity.
  - `--continue`: `Resuming session session_019bnZ... (1m ago)`, then the same single-session mode.
  - `--continue --spawn same-dir`: `Error: --session-id and --continue cannot be used with --spawn, --capacity, or
    --create-session-in-dir.`, exit 1 in 355 ms.
  - `--spawn same-dir --no-create-session-in-dir`: `Ready`, `Capacity: 0/32`, `environment=env_01JLvtc4...`, and no
    `session_` at all. (Two earlier tries were refused with `This folder is already served by a terminal claude
    remote-control on this device` for a few minutes after the hard-killed probes; the third ran.)
  So reattaching costs the multi-session server; not pre-creating keeps it and adds no row (S4, S5).
- L3. 2026-10-26, hidden launcher proof on Windows 10 19044: a `.vbs` whose `Run` line holds `"""C:\nvm4w\nodejs\node.exe""
  ""...\A" & ChrW(241) & "o " & ChrW(241) & "and" & ChrW(250) & "\marker.mjs"" ..." , 0, False`, opened through the
  shell (`Start-Process`, as the Startup folder opens it): node ran with its arguments intact through `Año ñandú`,
  and its `MainWindowHandle` was 0. The same command in a `.cmd` opened the same way: a `cmd.exe` with a window
  (handle 2621688, title `C:\Windows\system32\cmd.exe`).
- L4. 2026-10-26, from the lead (JH ORQ), his question verbatim: "como los podemos archivar automaticamente". Can the CLI
  or the server end or archive a remote session the supervisor no longer uses? Checked on CLI 2.1.310: `claude
  remote-control --help` has no option that ends, archives or lists a session; `claude rm`, `stop` and `agents` act on
  background and interactive sessions only, and `claude agents --json --all` listed 5 sessions, none of them a
  remote-control `session_01...`. Those rows live on claude.ai, and the app's own session tools do not list them
  either. So nothing archives them from here; with S4 no new row appears, and the rows already there are archived by
  hand from the sidebar, once.
- L5. 2026-10-26, verification: the pre-commit gate of 76ae7e11 passed (the first try refused bin/remote.mjs at 1289 lines
  over its 1229 ceiling; the launcher file functions moved to `bin/lib/remote-launcher.mjs` and the ceiling went to
  1118). gentle-ai assess of 45e8084..76ae7e11: medium, `review_due` false (`under_budget`), so no gentle-ai review.
  Codex review of 45e8084..76ae7e1, 3 parts, gpt-6.1-sol medium: all correct (0.86, 0.86, 0.88), no findings; part 3
  was asked twice, the first time refused with `Selected model is at capacity`.

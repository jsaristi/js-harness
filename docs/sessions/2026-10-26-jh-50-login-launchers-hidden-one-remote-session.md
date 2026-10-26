# JH 50 · login launchers hidden, one remote session

File: docs/sessions/2026-10-26-jh-50-login-launchers-hidden-one-remote-session.md.

## Goal
Stop the two console windows that open at every login, and stop the extra disconnected "js-harness" rows in the
Claude Desktop sidebar. The brief came from the lead (JH ORQ); the feature document is `odd/tasks/login-launchers.md`.

## The user's words
"puedes revisar por que siempre se me abren dos consolas de terminal cuando inicio el computador y me aparece dos
js-harness con un computador y me aparecen varios desconectados mira en la barra izquierda del claude desktop"
(2026-10-26, lead transcript 908805db-d0b9-4c2f-a9e6-f828b6bf1e41, line 38491). Relayed later by the lead: "como los
podemos archivar automaticamente".

## Delivered
- Pull request https://github.com/jsaristi/js-harness/pull/590, open and mergeable (CLEAN).
- Commit 76ae7e11:
  - `remote start --at-login` and `wake --at-login` now write `.vbs` launchers that open no window.
  - The next `--at-login` migrates the recorded `.cmd` launchers.
  - The server starts with `--no-create-session-in-dir`, and `remote status` reads `Ready` as connected.
  - The launcher's file handling moved to `bin/lib/remote-launcher.mjs`.
- Commit bdb74463: the feature document, with tasks T1–T4 done and Log L1–L5.

## Decisions
- This session dropped the brief's reattach (`--session-id`, falling back to a new session). On CLI 2.1.310 it turns the
  server into a single session and refuses `--spawn`; recorded in `odd/tasks/login-launchers.md` L2 and S5.
- This session decided not to archive the old rows automatically: no CLI command reaches remote-control sessions
  (`claude agents --json --all` lists none of them). Recorded in L4 and in the pull request body.
- This session did not run `remote stop` on the real server, per the brief.

## Failures and lessons
- First commit attempt: the gate refused `bin/remote.mjs` at 1289 lines, over its 1229 ceiling. The launcher functions
  moved out to `bin/lib/remote-launcher.mjs`.
- Second attempt: the gate asked to lower the ceiling to 1118 (`bin/conventions-structure.test.mjs`).
- First Codex run: part 3 was refused with "Selected model is at capacity". The rerun asked only that part.

## Left
- His, after the merge:
  - Pull the main checkout.
  - Run `js-harness remote start --at-login` and `js-harness wake --at-login` once.
  - Archive the disconnected "js-harness" rows and "JH probe reattach" from the sidebar.
- The server takes the new flag at its next start (the next boot).
- The merge itself: the lead's.

## Cost
- Time: 2026-10-26, closed at about 03:55 local. One host compaction ran at 03:38; the start time is in the
  transcript, not read here.
- Context at the end: about 26% of the window.
- Reviews:
  - gentle-ai assess said medium, `review_due` false (`under_budget`), so no gentle-ai review ran.
  - Codex: 3 parts, gpt-6.1-sol medium, all correct, about 465,000 input tokens across two runs.
- Gate: three commit gates (one red WIP, one red ceiling, one green) and one green docs gate.

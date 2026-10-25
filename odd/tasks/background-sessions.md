# Background sessions the lead starts on its own

Locator: `odd/tasks/background-sessions.md` · Engram mirror: `odd/background-sessions/tasks` · Branch: `claude/sessions-start-bg-6abcb7`
Delivery: one slice, one pull request. Test runner: `node --test`.

## Goal
The lead starts a work session on a turn he did not type, with `js-harness sessions start`, and every session it
starts that way is on the board, recorded, and undone exactly by `js-harness sessions stop <id>` or `uninstall`.

## Why
The desktop app's `start_session` starts a session only on a turn the user typed; on a turn started by a notice, a
background task or a compaction it leaves a card he must tap, so the lead waits on him for the one thing he asked
it to do alone. The Claude Code CLI has no such gate: `claude --bg` starts a background session from any turn.

## Done when
- `node --test bin/sessions-background.test.mjs bin/lib/background.test.mjs bin/lib/guard.test.mjs bin/lib/session-title-guard.test.mjs bin/sessions.test.mjs` exits 0
- `npm run check` exits 0
- One real `js-harness sessions start` with haiku ran, was listed by `js-harness sessions`, and `js-harness sessions stop` removed it (Log).
- The pull request is open and `js-harness codex-review` recorded its review.

## In scope / Out of scope
- In: `bin/sessions.mjs`, `bin/sessions-background.mjs`, `bin/lib/background.mjs`, `bin/lib/claude-path.mjs` (out of
  `bin/lib/remote.mjs`), `bin/lib/board-files.mjs` (the board's file readers, out of both sessions modules), `bin/install.mjs` (the machine
  uninstall), `bin/lib/guard.mjs` and `bin/lib/session-title-guard.mjs` (who a refusal names), their tests, the help,
  README, `docs/SPEC.md`, the orchestrator skill (`bin/lib/manifest.mjs`), this document.
- Out: the rule `sessions-open-in-sidebar` itself (his; see the Log, L4), the desktop app's own session list,
  `package.json` (the lead's).

## Constraints
- A background session is not a row in his sidebar, so the skill keeps `start_session` the default and names this
  command only for a turn on which `start_session` would leave a card — because the rule `sessions-open-in-sidebar`
  is his word that he sees the sessions.
- Remote Control is on by default — because it puts the session at claude.ai/code and on his phone, the nearest
  thing to the sidebar a background session has.
- The command holds the same title and effort rules `guard` holds `start_session` to, by the same functions —
  because the board, `notify` and the roster read the role from the title, and effort was the cost of a session
  started without one (odd/tasks/harness-review.md, T6c).
- `stop` and `uninstall` touch only sessions this command recorded — because the other background sessions on the
  machine are his or another tool's.

## Ask me before
Nothing: the brief carries his request; spend is one gate, the real probes with haiku, one gentle-ai assessment and
one Codex review.

## Specs
- S1. His request (2026-10-24, verbatim): "Quiero que que puedas iniciarla sin el mensaje mio escrito".
  `js-harness sessions start --title <t> --brief <file> [--worktree <name>] [--model <m>] [--effort <level>]
  [--no-remote-control] [--cwd <path>] [--home <path>]` copies the brief under the harness home with a closing
  section that tells the session to report through `js-harness notify --to orchestrator`, starts
  `claude --bg` with a one-line prompt that points at that copy, prints the session's id, and appends the start to
  `<home>/.js-harness/background/sessions.jsonl`. A start claude refuses (an untrusted folder, a bad flag) prints
  claude's own words, records nothing and removes the copy.
- S2. `js-harness sessions stop <id>` stops and removes (`claude stop`, `claude rm`) a session the record holds, and
  records its removal; an id the record does not hold is refused and nothing runs. A session claude already lost is
  dropped from the record; a removal claude refuses (unpushed commits in its worktree) keeps it recorded, with
  claude's words.
- S3. `js-harness uninstall machine` undoes every recorded session as `stop` does, except one that is working or
  waiting, which it keeps and names with `js-harness sessions stop <id>`, failing the uninstall; once none is left it
  removes the folder.
- S4. `js-harness sessions` (the board, `--json` too) lists the background sessions of the project from
  `claude agents --json --all`, each with its id, title, state, what it waits for (a permission prompt included) and
  whether `sessions start` recorded it. `--watch` returns when one starts waiting.
- S5. Where the rules `session-title` and `session-effort` are declared, a title not `<code> <n> · <purpose>` or an
  effort missing or above the rule is refused before anything runs, with the guard's reasons.
- S6. Whether `--remote-control` with `--bg` puts the session on the phone is checked and recorded (Log); the help,
  README, SPEC and the orchestrator skill say when the lead uses this instead of `start_session`.

## Tasks
- [x] T1 (S1-S6, kind: build): the command, the record, the board's background sessions, the uninstall, the docs.
  Route: inline (one understood change; no writer reason). RED: 13 of 14 tests of bin/sessions-background.test.mjs
  failed before the code (the 14th, usage errors, already exited 2); GREEN: all 14, with bin/lib/background.test.mjs.
- [x] T2 (S1, S2, S6, kind: verify): one real start with haiku through the command, listed, stopped; recorded here (L5).

## Log
- L1 (2026-10-24, the lead's brief, quoting his request): "Quiero que que puedas iniciarla sin el mensaje mio
  escrito". Build `js-harness sessions start` over `claude --bg`, record each start so `sessions stop <id>` and
  `uninstall` undo it, show the background sessions on the board, and check whether `--remote-control` with `--bg`
  reaches the phone.
- L2 (2026-10-24, probes on Claude Code 2.1.310, haiku, cleaned up after): `claude --bg -n <name>` prints
  `backgrounded · <8-hex id> · <name>` and four hint lines on stdout, and "Starting background service…" on
  stderr; the transcript carries the name as a `custom-title` entry, so the board and `notify` read the role from it.
  `claude agents --json --all` lists it as `kind: background` with `id`, `sessionId`, `status` and `state`
  (`working`, `done`, `failed`); a finished one keeps `state` and may have no `status`. `claude stop` then
  `claude rm` remove it from the listing and keep its transcript; both exit 1 with "No job matching" once it is gone.
  In a folder the CLI does not trust, `claude --bg` exits 1 with "Workspace not trusted. Run `claude` in <folder>
  once and accept the trust prompt, then retry." The session took the user's default permission mode (bypass here).
- L3 (2026-10-24, `--remote-control` probe): `claude --bg -n x --remote-control x` starts it with Remote Control:
  its screen says "/remote-control is active · Continue here, on your phone, or at
  https://claude.ai/code/session_…". The account's session list showed it as a local background session, not as a
  separate Remote Control row, and the browser pane is not signed in, so opening it on the phone was not seen by a
  person: the host says it is reachable, nobody has tapped it yet.
- L4 (2026-10-24, a conflict for the lead): his rule `sessions-open-in-sidebar` (2026-10-15) makes `start_session`
  the one way a session opens another, so that each is a row in his sidebar; a background session is not one. The
  guard does not refuse `claude --bg` (it refuses the Routines and cloud tools), and his request of L1 asks for
  exactly this. Decision here: build it, keep `start_session` the default in the skill, Remote Control on by
  default, and leave the rule's text to the lead and him.
- L5 (2026-10-24, the real probe through the command, haiku, effort low, a scratch home): `js-harness sessions start
  --title "JH 99 · bg probe" --worktree jh-bg-probe` printed `started 46504607`, recorded it, and the session read its
  brief's copy under the home with no prompt (`--add-dir`), in a new worktree `D:/js-harness/.claude/worktrees/jh-bg-probe`
  on branch `worktree-jh-bg-probe`, with Remote Control active. `sessions --json` listed it as busy and recorded.
  `js-harness sessions stop 46504607` removed it from `claude agents`, removed the worktree and its branch and the
  brief's copy, and recorded the removal. The scratch home was deleted after.
- L6 (2026-10-24, design): `resolveClaude` moved to `bin/lib/claude-path.mjs`, re-exported by `bin/lib/remote.mjs`,
  so the board and the guard's title check do not load `remote` (and through it `manifest`). The guard's effort and
  title refusals take who they name; for `start_session` their words are unchanged (its tests pin them).
- L7 (2026-10-24, next step): the code, tests and docs are done and `npm run check` was re-run after a SPEC fix
  (`**Today:**` names `js-harness sessions`). Left: commit on `claude/sessions-start-bg-6abcb7`, `gentle-ai review
  assess` (Risk: item 3, the guard's refusals and `resolveClaude` now serve a second caller; their old words are
  pinned, a differential check over 9 cases matched the base), `js-harness codex-review --base origin/main`, push,
  open the PR, report to the lead with L4's conflict.
- L8 (2026-10-24, next step after a full `node --test`, 7363 pass, 3 fail): (1)
  bin/conventions-structure.test.mjs "no module over 1,000 lines grows": bin/sessions.mjs (1067 lines at base) and
  bin/lib/sessions.mjs (3431) grew; move the board's background wiring and help text out so neither grows. (2) "the
  shipped text names the person the user": replace "he/his" in the new help, README, skill sentence, start's stdout
  ("his phone", "his sidebar", "he typed", "he must tap") with "the user". (3) bin/lib/manifest.test.mjs "the
  orchestrator skill says how a question reaches the user": check what the new skill sentence in bin/lib/manifest.mjs
  line 143 broke. Then npm run check, commit, assess, codex-review, PR.
- L9 (2026-10-24, the three failures of L8): the help's explanation moved to `START_USAGE` in
  `bin/sessions-background.mjs`, the board's read of background sessions to `boardBackground` in
  `bin/lib/background.mjs`, and the board's file readers (`reliefTail`, `readRelief`, `tailOfFile`) to
  `bin/lib/board-files.mjs`, re-exported where callers import them, so `bin/sessions.mjs` (1055) and
  `bin/lib/sessions.mjs` (3426) are under their ceilings; "he/his" in the new text became "the user".
- L10 (2026-10-24, the review of 54c7e391): gentle-ai approved it with four lenses (risk, resilience, readability,
  reliability; lineage review-699f140966d35940, acknowledged) and ten advisories; Codex recorded six P2s. A haiku probe
  answered R1: with an uncommitted change in an idle session's worktree, `claude rm` exits 0, removes the session and
  keeps the worktree, locked by a pid that is gone, so no work is lost; `stop` now says where it stays. Refuted:
  R3-everything (the exit code counts a kept session, so `--everything` stops before the folder), R3-board-spawns-real-claude
  (the board's tests pass `env: {}`, and claude is found only on PATH). Codex's board-without-main-transcripts P2 is a
  base limitation, kept as a follow-up. Fixed with a test each: the manifest is read before any session is undone; a
  record with unreadable lines keeps its folder and fails; the brief is deleted before the removal is recorded; the
  record is opened before claude runs, and a session that then cannot be recorded is stopped and removed; a session
  without a printed id is taken only when it is new since the start and in the project; a run that does not finish is
  looked for in `claude agents`, and its brief kept when none is found; a kept session is named with what settles it;
  the board's listing times out at 15 s. Not changed: the two refusal functions name their caller differently (R2, a suggestion).

# Set aside: the inbox of what is not a task yet

Sebastián asked for it on 2026-10-13 (the orchestrator's transcript `65318fd5-80e7-4bb8-92b5-06737140185b`, line 13776,
read with `js-harness sessions --quote`): a document where what falls aside is written down, so that
it is not lost. This is not a second plan: `docs/ROADMAP.md` and `odd/tasks/` stay the plan. An item
here is something seen and not yet placed. When it becomes a task, a register entry or a decision of
his, its line here is struck and points to where it went; when it is dropped, the line says why.

No checkboxes here, so `js-harness progress` does not count this file. Each line: what, why it
matters, who holds it, and where it was seen.

## Faster

- ~~A push that waits behind a turn it does not need (pull request 121, 16 minutes behind a measure),
  and a scripted turn that hangs with the lock (the pair measure, 24 minutes).~~ Placed: JH 8,
  `odd/tasks/gate-turn-guards.md`: `gate` refuses a turn while a push waits, and stops a command at
  30 minutes (`--max`); done when its pull request merges.
- The antivirus (MsMpEng) takes one to two of the eight processors while a check runs (124 to 189
  percent of one processor, read 2026-10-13 22:07). His: nothing is changed without his word. JH 8
  measures what an exclusion of the suite's temporary folders would give before anything reaches him.
- PcaSvc may come back: it began to load the checks at about 17:00 on 2026-10-13, after an app
  restart and an update of the installed copy; restarted by him at 22:07. Seen again: JH 8's T19 (a
  gate records which processes spent the processor over its run) names it.
- A queued command that waits its turn and then refuses for something it could have seen at once (a
  dirty tree for a Codex review: forty minutes held for nothing). JH 8, T20.
- The Codex review inside the turn of the lock is 7 percent of the lock: a candidate guard, one slice
  at most. JH 8.
- The whole suite starts about 13,000 git processes a run: fewer starts is the only lever inside the
  suite. JH 8, gate-wait's Next.
- A run on GitHub in place of a third of the local gates: JH 10's T7, the exchange, a question for
  him when designed.

## Cheaper

- Codex estimates run low: JH 5's review planned 435,000 input tokens and took 999,502 (inside its
  allowance). `codex-review --plan` should learn from the records it keeps. Unassigned.
- Engram refuses saves ("Claude host session ... already ended"), so the engram mirror of the
  feature documents is not written in a session once the desktop app has restarted. Found by the
  orchestrator's reader on 2026-10-13: not the compaction but the app's restart: engram's own Claude
  plugin (0.1.7, engram 3.4.0) marks every open session ended at SessionEnd, the app resumes them with
  the same id, and engram never reopens an ended session (its DOCS.md, lines 317-319; the Claude
  adapter does not send `resume: true`). Engram's to fix, not js-harness's. Here: the feature
  documents in the repository stay the record; nothing to build unless engram changes.

## Smarter

- Hours in messages between sessions are written by hand and drift (the orchestrator's ran seven
  minutes ahead; a session's context share was written unread). A notice sent through `js-harness
  notify` is stamped by the clock: the sessions' notices to the orchestrator could go that way.
  JH 5, the channel.
- The pace is counted by hand (git history of checked boxes). `js-harness progress` could print the
  tasks closed and added a day, so an estimate is read, not made. Unassigned.
- A session can wait on him unseen: on 2026-10-13 he rejected a tool call in JH 7's own chat at
  about 17:50; JH 7 rightly waited for his word, showed as running, and every message to it queued
  unread for six hours, and the orchestrator did not see it before he left. The board
  (`js-harness sessions`) could mark a session that waits for his word (a rejected tool, an open
  prompt) or writes nothing for 30 minutes. JH 5, the channel. The first half is built: the board
  marks a session whose tool call was refused or whose turn was stopped (`odd/tasks/session-channel.md`,
  Progress, 2026-10-14 00:15); the 30 minutes of silence are not.
- ~~A check of a reply: a question with options and no question-tool call. JH 5 measures it over the
  transcripts first; a blocking hook is his decision.~~ Measured (about 67 percent precision, 20 to
  25 percent recall over 572 replies); no blocking hook, decided by the orchestrator under his line
  15820 and kept for his confirmation: `odd/tasks/session-channel.md`, Progress, 2026-10-13 23:46.
- Text with backticks went through a shell string: a `node -e "..."` in Bash carrying Markdown code
  spans inside double quotes ran each span as a command substitution (nothing it named existed, so
  nothing ran; the command hung and was stopped). JH 12, 2026-10-14. The same family as the memory
  note that a heredoc eats backslashes: text with backticks or backslashes goes through the editor's
  Write and Edit, never a shell string. A candidate for a check or a protocol line; unassigned.
- A background timer, watcher or wake loop left running after what it guarded resolved: the
  orchestrator's 05:00 timer outlived the Linux gate it waited for (his correction, the
  orchestrator's transcript `ffe99ebf`, line 4215). Each one declares what it is for, what ends
  it and who stops it, and the board and the resume list the live ones. JH 5, the channel:
  `odd/tasks/session-channel.md`, T18, after slice (c).
- Hours and context shares typed by hand in notices drift (JH 14 typed its share unread twice on
  2026-10-14). `js-harness notify` could stamp both from its own reading. JH 5, the channel:
  `odd/tasks/session-channel.md`, T19, after T18.

## Owed and not yet placed

- ~~The practice run with a real host session (practice-project T5): needed before 1.0.0. Held by
  "JH 11 · reglas del proyecto y prueba final" since 2026-10-13, by his answer "Una sexta sesión
  (Recomendada)" (the lead's transcript `65318fd5`, line 13854, read with `sessions --quote`).~~
  Placed: built in pull request 134 (`feat/project-rules`, the step `host-loads`, 13 of 13 on
  `1659801`); done when it merges.
- Every writing command refuses an unknown flag: the one task a first user would meet; its order is
  not set. Moved on 2026-10-14 from rule-hierarchy T4 to JH 12's `odd/tasks/commands-and-doctor.md`
  (T1), not on `main` yet.
- ~~An installed project's own rules: held by JH 11 with the practice run, by the same answer (line
  13854); it left JH 7's queue.~~ Placed: built in pull request 134 (`odd/tasks/project-rules.md`);
  done when it merges.
- Which model the native gentle-ai review used (his answer of 2026-10-12, line 9776): read it from JH
  10's review of 2026-10-13 (lineage review-5ba00685b483e51f). The orchestrator.
- ~~pnpm's pack refuses this checkout on Windows (ERR_PNPM_BIN_CRLF, `bin/js-harness.mjs` checked
  out with CRLF); whether an install by pnpm meets it is not measured. JH 7's register.~~ Placed on
  2026-10-14: `docs/FAILURES.md`, entry `pnpm-pack-refuses-crlf`.
- What `codegraph init` writes under the home is recorded by no manifest, so `uninstall --global`
  leaves `.codegraph/telemetry-queue.jsonl` and `.codegraph/telemetry.json`: it breaks the rule that
  what the harness writes outside the repository is undone exactly. Fix: record what `codegraph
  init` creates, or remove those two files on uninstall. JH 9 holds it (`init`, in
  `bin/lib/project.mjs`) and takes it after its slice 2, by the lead's message of 2026-10-14. Seen
  by the README's runs; register entry `init-leaves-codegraph-files`.
- The installed copy on his machine is at ad7b37b; main has moved by many pull requests. Updating it
  is a change on his machine he approved once; to be done at a quiet moment, with its undo.
- The Codex plugin's removal waits for JH 5's doctor row (his order). JH 5.
- 29 of the 31 memory notes of this project are rules or decisions that live only in memory (28 of
  type `feedback`, 1 `project`; none `user`), where nothing acts on them and a session may not recall
  them. Read on 2026-10-14 by the `memory-rules` row of `doctor`, built in JH 12's
  `odd/tasks/commands-and-doctor.md` (T4, not on `main` yet). Each goes to a check, a line of
  `AGENTS.md` or a protocol, then the note is deleted: JH 7's skill for recording a new rule holds it.
  He asked for these two items here (the orchestrator's transcript `ffe99ebf`, line 3838).
- Sessions of the two permission classes, with nothing joining them: 26 of the project's sessions of
  the last 7 days bypass permission prompts and 1 asks for them (likely the phone's), and
  `crossSessionInbound` is not set in his user settings, so a message from one class to the other is
  held, and in the desktop app dropped when it expires
  (https://code.claude.com/docs/en/cross-session-messaging). Read on 2026-10-14 by the
  `session-classes` row of `doctor` (JH 12, T5). The fix is `js-harness install
  --accept-session-messages`, which records the setting and is undone by `uninstall`; it needs his
  installed copy (ad7b37b) updated first, a change on his machine, his, with its undo.
- A gate whose sensors ran in WSL2 keeps no name of a failing test: the gate log records `tests:
  fail, 120.6 s, wsl` and the runner keeps no output, so a failure that does not come back cannot
  be named afterwards. Seen 2026-10-14: JH 11's gate of 10:01 UTC failed one test in WSL2 and passed
  on the retry, and its name was lost (`fix/flaky-tests`, `bin/lib/remote.test.mjs`). Held by JH 8.

## His to tidy, when he wants (nothing waits on them)

- Eleven `.pnpm-bin-backup` folders and old pnpm copies left by updates (pnpm's cleanup fails with
  os error 32).
- Old worktrees under `D:\js-harness-worktrees` and `C:\Users\Oficina\orca\workspaces\js-harness`
  whose branches are merged or abandoned; the old branch feat/codex-parity (unpushed, three
  uncommitted lines) and its raw trial output (2.7 MB).
- In the app's list: a second session carrying the orchestrator's title (another machine, by Remote
  Control) and five sessions of abogadaclaudiajimenez from 2026-10-03 to 2026-10-06.

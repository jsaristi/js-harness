# Failures no check in this repository can hold (2026-11-22)

JH 299's audit of the `docs/FAILURES.md` entries that had no control on 2026-11-22 and that no command of this
repository can catch, for the lead's pool (`js-harness failures`: 42 with no control that day). Each section says
why no check is built, what holds the failure instead, and the evidence; each entry's `measured` control quotes its
dated sentence here. True on its date: a later host, tool or command can make one checkable, and then the entry
gets a check and this record stays as it was.

Two entries of that list are not here: `record-states-wrong-fact` had a check that an edit cut off on 2026-11-11
(1fe3bc4f), now restored, and `message-cap-ran-out` is held by a protocol line. `session-env-file-cut` is not here
either: a `doctor` row could count the lines of a session's env file, so a check can be built; `bin/doctor.mjs` is
in open pull requests 963 and 966, so it waits for them.

## engram-writes-lost
One sighting (2026-10-06), one sentence, nothing else found. Engram's store is engram's own (`AGENTS.md`: "engram
owns memory"); the harness writes nothing into it and cannot see a write it lost. What holds it: a committed
document is canonical and engram only mirrors it (`rule:documents-canonical`), so a lost engram write loses no
record. Measured: on 2026-11-22 no check in this repository can see a lost engram write.

## flags-guessed
A guessed flag that does not exist is already refused: every command exits 2 with `unknown argument: <token>` and
its usage (`bin/conventions-arguments.test.mjs`). A guessed flag that exists with another meaning runs as written,
and a command cannot tell the caller's intent from its arguments. Measured: on 2026-11-22 no command can tell a
guessed flag that exists from one that was meant.

## hold-read-after-build
The host queues a message behind the receiving session's turn; no hook or command of the harness sees that queue or
when a queued message is read. Measured: on 2026-11-22 no check in this repository can see a message waiting
behind a session's turn.

## known-defect-left-for-review
Whether a defect was "already reported" is read from records in prose across sessions, and whether writing it down
for later was the right call is a judgement; a commit or a review command sees neither. Measured: on 2026-11-22 no
command can tell a known defect left for later from work rightly deferred.

## script-ate-backslashes
The text is lost inside the shell, before any file is written; the guard sees the command but reading shell quoting
line by line failed three review rounds (`odd/tasks/advisor-use.md`, T8, its follow-up for a real shell tokenizer).
What holds it: the host's own guidance prefers Edit and Write over a shell edit that quoting could break, and the
second sighting was caught by the test it broke. Measured: on 2026-11-22 no check in this repository can read
shell quoting reliably enough to catch a lost backslash.

## stop-read-as-refusal
The words are the app's; a stopped turn reaches the session in the same text as his refusal of a tool call, and the
harness sees neither. What holds it: a session whose turn was stopped or refused tells the orchestrator what it
needs (`bin/lib/manifest.mjs`, the line "When the user refuses a tool call of yours or stops your turn"), and the
orchestrator knows whether he refused. Measured: on 2026-11-22 no check in this repository can tell a stopped turn
from his refusal.

## Added the same evening (JH 302)

Four more entries of the day's list, read on 2026-11-22 against origin/main 6d6a5d85. In the same pass two entries
were found held by tests already on main, so they take a `check` control and are not here: `session-env-file-cut`
(`bin/lib/session-env.test.mjs`, since 2026-11-04, which trims the file at each start; the doctor row named above is
no longer needed) and `wait-tied-to-commit` (`bin/wait.test.mjs`, since 2026-10-14: every wait ends at its bound).

## brief-waived-review-lines
The lines that brief waived were gentle-ai's, which the merge door asked for until gentle-ai left at F8's S2
(`AGENTS.md`); no door asks for them now. The reviews that stand in their place are recorded by command and refused
at push whatever a brief says (`bin/check-codex-reviews.test.mjs`, "an uncovered code commit fails"), so a brief
that waives them changes nothing. What is left, a brief that says something wrong, is prose a command cannot judge.
Measured: on 2026-11-22 no door asks for the lines a brief could waive, and no command can judge a brief's prose.

## diagnostic-whole-gate
A run started to read a failure and a run that was needed are the same command; whether the first run's output was
enough is a judgement. What holds it: node's test runner names each failing test under `✖ failing tests:`, and the
gate reads that list (`bin/lib/ci-gate.mjs`), so the first run already names the failure. Measured: on 2026-11-22 no
command can tell a run started to read a failure from a run that was needed.

## memory-note-overwritten
Memory notes are the host's files and engram's store, not this repository's, and the harness writes neither. What
holds it: the host's memory instructions ask a session to look for an existing note before it saves one, and a
committed document is canonical while a note only mirrors it (`rule:documents-canonical`), so an overwritten note
loses no record. Measured: on 2026-11-22 no check in this repository can see a memory note written over another
session's.

## missed-wake
A watch that looks at intervals cannot see what started between two looks; the host tells the harness nothing when
a session starts waiting on him. What holds it: a session that waits on him says so itself with a `waiting` notice
(`js-harness notify --kind waiting`), so the lead does not depend on the watch to find it. Measured: on 2026-11-22
no check in this repository can see a session start waiting on him between two looks of a watch.

## wait-tied-to-commit
Corrected later the same evening: the section "Added the same evening" above gave this entry a `check` control
(`bin/wait.test.mjs`). Its one sighting, on 2026-10-10, was a notice's wording telling a session to wait for other
branches to move; `js-harness wait` did not exist until 2026-10-14, so that test bounds a command the sighting never
ran. What holds it: a wait a session runs now is `js-harness wait`, which ends at its bound (480 minutes when not
given) and says so, so a wait run with it cannot block a session for good. Measured: on 2026-11-22 no check in this
repository can judge whether a notice asks a session to wait on something that may never come.

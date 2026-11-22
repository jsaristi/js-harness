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

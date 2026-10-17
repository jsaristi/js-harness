# Wake and flag

Items B1, A(a) and G of the throughput plan, and the hour guard on `notify` text sent through Bash. Branch per unit
from `main`; owner `JH 26 · canal y compactación`; delivery one pull request per unit; test runner `node --test`.

## Goal
A session that holds work wakes for it, and the board shows what stalls it.

## Why
The throughput measure of 2026-10-17 found these sources of lost time:
- 31 turn ends followed by more than 30 minutes of silence, with nothing armed: 64.4 session-hours in two days, an upper bound;
- 3 tool calls open 18.6 session-hours;
- 58 of 74 wrong hours in the lead's notices typed in `notify` text, which the hour guard does not read.
The land cannot tell a session that its pull request landed or was left out, because 42 of 58 ready notices were sent
from `main`, so their branch names no session (the plan, `throughput-v3-plan.md`, Version 2 and item A).

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/wake-and-flag.md` exits 0
- `node --test bin/lib/channel.test.mjs` exits 0
- `node --test bin/notify.test.mjs` exits 0
- `node --test bin/lib/sessions.test.mjs` exits 0
- `node --test bin/reply.test.mjs` exits 0
- `node --test bin/lib/guard.test.mjs` exits 0
- `node --test bin/resume.test.mjs` exits 0

## In scope / Out of scope
- In: `bin/lib/channel.mjs`, `bin/notify.mjs`, the board's channel lines (`bin/lib/sessions.mjs`), `bin/reply.mjs` and
  `bin/lib/reply.mjs` for A(a), the board for G, `bin/guard.mjs` for the hour guard, their tests, help, README,
  `docs/SPEC.md` and the skill lines in `bin/lib/manifest.mjs`.
- Out: `bin/merge-queue.mjs` and the land's notices (A(b), JH 24's, which reads B1's field); the gates (C, D, E).

## Constraints
- One pull request per unit, each through the gate, gentle-ai and Codex — the lead's assignment of 2026-10-17.
- No check, review or test removed or weakened — the plan's hard limit.

## Ask me before
Nothing of this feature is his: no spend, nothing irreversible, no product choice beyond the approved plan.

## Specs
- S1 (B1) "a `ready` notice kind carrying the PR number; JH 24's A(b) waits on it" (the lead's notice of 2026-10-17).
- S2 (A(a)) "a work session's Stop hook, by amending `reply --hook` at manifest.mjs:41, warns once when a turn ends
  holding handed work with no `js-harness wait` running".
- S3 (G) "the board flags a tool call open more than N minutes".
- S4 "the hour guard on `notify` text sent through Bash (bin/guard.mjs:81)".

## Tasks
- [x] T1 (kind: build) S1: `--kind ready --pr <n>`, the record's `pr`, the board's line, the skill's line (route: inline;
  branch `feat/ready-notice`)
- [x] T2 (kind: build) S2: the Stop warning for handed work with nothing to wake the session (route: inline;
  branch `feat/stop-wake-warning`, from T1)
- [x] T3 (kind: build) S3: the board flags a tool call open more than N minutes: already built, nothing to add
  (route: none; L3)
- [x] T4 (kind: build) S4: the hour guard reads `notify` text sent through Bash (route: inline; branch
  `feat/notify-hour-check`, from T2)

## Log
- L1, 2026-10-17, the lead's notice to JH 26 (a claim of the lead's, not his word): "he approved the throughput plan
  (2026-10-17). Your next work, from ...throughput-v3-plan.md (read the 'Version 2' section first): B1 first (a
  `ready` notice kind carrying the PR number; JH 24's A(b) waits on it), then A(a) (a work session's Stop hook, by
  amending `reply --hook` at manifest.mjs:41, warns once when a turn ends holding handed work with no `js-harness
  wait` running), G (the board flags a tool call open more than N minutes), and the hour guard on `notify` text sent
  through Bash (bin/guard.mjs:81). Test first, one PR per unit, gate, gentle-ai, Codex; notify the lead at each PR."
- L2, T1 built test first on `feat/ready-notice`.
  - What it adds:
    - `ready` is the ninth kind and the only one that takes `--pr`, a whole number from 1, kept in the record as `pr`;
    - a ready notice without a valid `pr` is no notice to `readNotices`;
    - the board prints "ready for pull request <n>";
    - `notify` confirms "recorded ready for pull request <n>";
    - the skill tells a session to send it when a pull request is ready.
  - RED: 3 tests of `bin/lib/channel.test.mjs`, 2 of `bin/notify.test.mjs` and 1 of `bin/lib/sessions.test.mjs` failed.
    The usage cases with `--pr` already exited 2, but for an unknown flag.
  - GREEN: channel 53, notify 140, sessions 302, manifest 166.
  - Not changed: `ready` is no status of the board (`STATUS_KINDS`), so it neither opens nor closes a session's handed
    work, and `session-stall` reads as before.

- L3, T3 needs nothing: the board has flagged a tool call with no result after 15 minutes and woken a watch since
  2026-10-13 (`PENDING_CALL_LIMIT_MS`, bin/lib/sessions.mjs:765; commits 6ab6958f and 567f81f8). Told to the lead.
- L4, T2 built test first on `feat/stop-wake-warning`, by a design two readers changed (`jh26-aa-design.md`,
  Version 2, in the lead's notes folder).
  - Read from S2's need, not its letter: what wakes a session is the end of any background task or a cron of its own,
    so any of them counts as armed, not only a `js-harness wait`; and a `waiting` notice does not give the work back,
    since the work-session skill still asks for a wait after it (bin/lib/manifest.mjs:179-181).
  - Correction of the plan: JH 5's 1,004 minutes were 8 waits running (`--for 120`), so this check could not have seen
    them; it sees the stop after a wait ended with none armed again.
  - Once a handing, read from the transcript's `hook_blocking_error` lines, and again after a later background launch.
    A handing before the transcript began is another session of that number. A decision close and Codex are not
    checked. The transcript is searched from its end, never parsed whole: 533 ms on the largest (64.7 MB), against
    1.3-2.7 s for `sessionFacts` and the hook's 5 s.
  - RED: 8 of 16 tests of `bin/reply.test.mjs` failed. GREEN: reply 16, lib/reply 18, stall 16.
  - Run on this session's own transcript and the real record, it warned: it held the lead's note of 18:55 local
    with nothing in its background.
  - Codex on 99234817 (incorrect, 0.98), two P2, both fixed test first: an opening is stored before its session
    begins, so the cut by the transcript's start dropped the usual first handing (the opening the session read now
    counts whenever it was stored); and a call the host moved to the background when it outlived its timeout
    (`toolUseResult.backgroundTaskId`) now counts as a launch after the warning. RED 2, GREEN reply 18.

- L5, T4 built test first on `feat/notify-hour-check`, by a design two readers changed (`jh26-t4-design.md`,
  Version 2, in the lead's notes folder).
  - The check is in `notify`, not the guard: `notify` holds the final text (after the shell's quoting, `$(…)` and
    heredocs, which a guard reading the command line cannot evaluate) and the clock the notice is stamped with, and it
    covers Codex and scripts. It is held against the notice's own `at`; exit 1, nothing written; an answer is not
    held to it (his words).
  - `STAMP` reads the lead's hour-first form (`HH:MM` then a capital), and a title's topic no longer crosses a
    colon: "<title>: compacted at HH:MM" is an event. Over the record (591 texts) the new pattern gains the 74
    hour-first lead notices and loses 41, every one a "compacted at" line; `audit's` count of message stamps
    changes the same way.
  - `resume's` compaction line now carries the hook's own hour: 7 of 60 such notices had typed it in UTC.
  - Out: the relief file (its opening hour is often an event), hours in parentheses, the wake notes.
  - RED: guard 1, notify 1, resume 25 (the expected line). GREEN: guard lib 19, guard 23, notify 143, resume 94,
    audit 15.

## Next step
The feature's tasks are done. Land in order: 349 (T1), then T2's and T4's pull requests, each after its base.

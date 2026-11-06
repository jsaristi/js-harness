# JH 113 · status line: the harness's state above the Code tab's message box

File: docs/sessions/2026-10-31-jh-113-status-line-the-harness-s-state-above-the-code-tab-s.md.

## Goal
Design, build and test a status line that shows the board's line above the Code tab's message box through Claude
Desktop 4.4212.0's `sessionStatusLine`, and send the administrator install to the lead as one question. Opened by the
lead's brief `C:\Users\Oficina\.js-harness\background\briefs\2026-10-31T01-35-39-768Z-78f0fc82.md`; the second slice by
`2026-10-31T02-58-37-533Z-43fb211b.md` in the same folder.

## The user's words
Question 131, answered "Sí, ábrela" (`js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f 37796`,
2026-10-31T01:34:51.980Z). The question said a yes "no autoriza instalar ni tocar la configuración administrada ahora".
Question 134, answered "Construir el programa igual" (`js-harness sessions --quote
0f71b2c6-cbce-43ca-a031-276a4b2c381f 38878`, 2026-10-31T02:58:07Z).

## Delivered
- Pull request 726 (https://github.com/jsaristi/js-harness/pull/726), merged into main as 9f61429: the evidence that
  the installed app reads `sessionStatusLine` only in its 3P class (`showsOrganizationStatusLine()` is `!1` in the
  `type="1p"` class), the design for a future host, the host-watch control for a 3P row (commits 6b37f498, 33246b02,
  15fd8749), row #24 adapt → ignore, map row 14, ROADMAP, `docs/FAILURES.md` `host-review-scope-unread`.
- Pull request 730 (https://github.com/jsaristi/js-harness/pull/730), slice 2, the program he asked for in answer 134:
  - `bin/lib/status-line.mjs` (the line, the atomic write with retried rename), `bin/status-line.mjs` (`js-harness
    status-line write` and `program`), `bin/lib/status-line.ps1` (the program, ASCII, Windows PowerShell 5.1), commits
    acc22f30, 1df8e3aa, 13c9dfdb;
  - `bin/lib/status-line-install.ps1` and `status-line-uninstall.ps1`, the administrator install and its exact undo,
    and `relativeHome` in `bin/lib/home.mjs`, commit 90366b95; README, SPEC capability, dispatcher entry;
  - measured: `write` 24.4 s on the real board; the program 0.58–1.24 s as the host runs it (feature document, L9,
    L12); both scripts run end to end in scratch places, twice each (L11, L12).
- Question 139 to the lead (recorded 2026-10-31T04:33:12Z): install now or not, with the exact commands and their
  undo; it recommends not installing while the app does not read the key.

## Decisions
- This session: the line is written ahead by `js-harness status-line write` and only printed by the program, since
  the board takes 24 s and the host stops the program at 10 s; the writer runs from a per-user scheduled task every 5
  minutes, part of the deferred install (L8).
- This session: the install and its undo ship as scripts of the package, the undo copied beside the program so it
  outlives an uninstall, after the independent verifier found the loose commands could leave a half install (L12).
- This session: `write` refuses a relative `JS_HARNESS_HOME`, after Codex's two passes on the home mismatch (L10, L12).
- His (pending, question 139): install or not. His (pending, M1 of the proposal): a mod's band above the prompt.

## Failures and lessons
- The first host review decided #24 adapt without checking which deployment reads the key; recorded as
  `host-review-scope-unread` (slice 1).
- This session's own: L11 called the task's "last result 0" evidence, and `conhost --headless` returns 0 whatever its
  child exits (the verifier's probe); corrected in L12, the line's time is the check.
- This session's own: the first install commands lived only in a job's scratch folder, with no stop on error; the
  verifier caught it before the question was sent.
- Commits refused by the gate before they landed: a README section and a SPEC capability missing for the new command,
  and `JS_HARNESS_HOME` read outside `bin/lib/home.mjs`; each fixed in the same commit.

## Left
- Question 139: the lead shows it to him; nothing in PR 730 waits on it.
- Pull request 730: the lead lands it.
- Notes the verifier left, not fixed (L12): a future time reads as fresh; a policy under HKLM makes the app ignore
  HKCU's; the copy under Program Files goes stale when js-harness updates until the install runs again, and nothing
  compares it; `uninstall` does not know this install.
- Not checked: an elevated window; whether stopping the task stops its node; the app reading the key.
- gentle-ai did not review either branch: its Stop hook offered the whole branch each time, so only its read-only
  status ran.

## Cost
Slice 1: question 134 at 2026-10-31T02:09:17Z, ready at 02:11:25Z. Slice 2: resumed after a machine restart at
02:58Z, compacted once by the host at 03:05Z; question 139 at 04:33Z. Reviews of slice 2: Codex three times (169,301,
33,830 and 42,803 input tokens), the lenses three times (reliability and readability each pass, risk on the last;
13,954 to 28,542 input tokens a lens), one independent verifier (a general-purpose agent, 137,820 tokens). Gates: the
pre-commit gate on every commit, three refused and fixed; one CI run red (the home convention), then green.

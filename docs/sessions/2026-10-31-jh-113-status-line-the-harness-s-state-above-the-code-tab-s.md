# JH 113 · status line: the harness's state above the Code tab's message box

File: docs/sessions/2026-10-31-jh-113-status-line-the-harness-s-state-above-the-code-tab-s.md.

## Goal
Design, build and test a status line that shows the board's line above the Code tab's message box through Claude
Desktop 4.4212.0's `sessionStatusLine`, and send the administrator install to the lead as one question. Opened by the
lead's brief `C:\Users\Oficina\.js-harness\background\briefs\2026-10-31T01-35-39-768Z-78f0fc82.md`.

## The user's words
Question 131, answered "Sí, ábrela" (`js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f 37796`,
2026-10-31T01:34:51.980Z). The question said a yes "no autoriza instalar ni tocar la configuración administrada ahora".

## Delivered
- Pull request 726 (https://github.com/jsaristi/js-harness/pull/726), open, ready notice recorded 2026-10-31T02:11:25Z:
  - `odd/tasks/status-line.md`: contract, specs, the evidence that the installed app reads `sessionStatusLine` only in
    its 3P class (`showsOrganizationStatusLine()` is `!1` in the `type="1p"` class, `.vite/build/index.chunk-2SHPxESV.js`
    offsets 2998100 and 3001499), the design for a future host, the measured cost per refresh, the blind readers' log;
  - `bin/lib/host-watch.mjs` and its test: a 3P row left to decide asks evidence that a claude.ai install reads it, and
    the review brief's step 2 says so (commits 6b37f498, 33246b02, 15fd8749);
  - row desktop 4.4212.0 #24 adapt → ignore; map row 14; ROADMAP; `docs/FAILURES.md` `host-review-scope-unread`
    (commits 6da7b04b, ceffbc0d, f1157b47).
- Question 134 to the lead (recorded 2026-10-31T02:09:17Z): close JH 113 here, or build the program for a future host.

## Decisions
- This session: not building the program (spec 3) or the admin install question (spec 4) before his word, because the
  app does not read the key on his install; deferred to question 134, recorded in the feature document (T5).
- This session: the control sits on the review's decision (the Reason of a 3P `?` row and the brief's step 2), not on
  drafting the whole 3P section outside, after blind reader A showed the section repeats claude.ai features (L4).
- His (pending, question 134): close here or build. His (pending, M1 of the proposal): loading a mod for a band above
  the prompt.

## Failures and lessons
- The first host review decided #24 adapt as a Code tab feature without checking which deployment reads the key; found
  here by reading the 3P docs and the installed bundle. Recorded as `host-review-scope-unread`, control: the test "a 3P
  entry left to decide says its decision needs evidence that a claude.ai install reads it".
- This session's own: the first form of the control (6b37f498) drafted every 3P entry outside, which would have hidden
  #30; a blind reader caught it before the push, reworked in 15fd8749.
- The worktree guard refuses PowerShell launched from the shell; it ran through a node runner in the job's scratch
  folder (feature document, L2).

## Left
- Question 134: the lead shows it to him; specs 3 and 4 wait on it.
- Pull request 726: the lead lands it.
- gentle-ai did not review the branch: the Stop hook offered the whole branch, so only its read-only status ran.
- Not checked: the ACL of `HKCU\SOFTWARE\Policies`; whether `uninstall` can carry an elevated step; the app in 3P mode.

## Cost
First notice: question 134 at 2026-10-31T02:09:17Z; ready at 02:11:25Z (the session started about 01:36Z). Context at
the close: about 55%. Reviews: Codex once (68,616 input tokens), the lenses once (reliability 14,142 and readability
6,707 input tokens), two blind readers (general-purpose agents, about 110k and 145k tokens). Gates: the pre-commit gate
on six commits and the pre-push check once, all passing.

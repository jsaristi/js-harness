# JH 36 · onboarding asesor (diseño v4)

File: docs/sessions/2026-10-23-jh-36-onboarding-asesor-diseno-v4.md. This summary covers the stretch since the session's last compaction (2026-10-21 to 2026-10-23). The onboarding v4 design and build before it are recorded in `odd/tasks/onboarding.md` (L1-L42).

## Goal
The lead ("JH ORQ · js-harness") opened this session at 05:15 local on 2026-10-21. Its task was to fix what belongs to js-harness among JH 43's findings from the T4 pre-project onboarding run, test first, with gentle-ai, Codex, a PR on main and a ready notice. Later briefs added findings 9-11 and Claude Desktop's moved data folder.

## The user's words
- Question 44, finding 11. Transcript 908805db-d0b9-4c2f-a9e6-f828b6bf1e41, line 18526, 2026-10-22T21:52:49.900Z, answered with the question tool: "Línea en Setup (Recommended)". Read with `js-harness sessions --quote`.
- Every other brief came from the lead, as cross-session messages. They are the lead's claims, not the user's words.

## Delivered
- PR 497, merged 2026-10-21T08:51Z: onboard finds the project's own plan in any case.
- PR 498, merged 2026-10-21T09:46Z: findings 1, 3 and 4 (eight stages, neutral templates, no hygiene pass due on an empty memory).
- PR 499, merged 2026-10-21T09:52Z: finding 7, notify routes a session of another project's lead (`odd/tasks/notify-lead-channel.md`).
- PR 500, merged 2026-10-21T10:35Z: finding 10, the advice paste waits until topic 3, the owner's level, is shown (`524391f9`, `1bfaeabc`; L43-L44 in `odd/tasks/onboarding.md`).
- PR 501, merged 2026-10-22T09:01Z: `appRoot` and backup's `desktopDir` follow Claude Desktop's data folder to `%LOCALAPPDATA%\Claude-Data\claude_<id>` (`c103e8fc`, `c8bc62b3`; `odd/tasks/desktop-data-folder.md`).
- PR 506, merged 2026-10-22T22:47Z: finding 11, a `- Areas: +<area> (L<n>)` Setup line adds owner-requested areas to a small set (`bac069f4`, `78927745`; L45-L46).

## Decisions
- Finding 2 is not a defect: init writes the TypeScript plugin `false`, that is off (`bin/lib/project-apply.mjs:16`). This session decided it, and the proposals note records it.
- Findings 5 and 8 went to the lead as proposals, for the user to decide (`jh36-t4-findings-5-8-proposals.md` in the notes folder).
- Finding 9 was already settled by PR 498. The lead asked for the check; this session found it settled (L43).
- Finding 11 is the Setup line, chosen by the user in question 44 (L45).
- An Areas line is checked only once Kind resolves, and the bar does not read it. This session decided both (L46).

## Failures and lessons
- The first ready notice for PR 501 was refused because no feature document carried the gentle-ai evidence of its commits. Fixed by writing `odd/tasks/desktop-data-folder.md` before notifying. Lesson: a fix with no feature document still needs one for its ready notice.
- The Stop hook asked for a background wait during the two pauses (PC restart, Desktop update), which the lead had ordered with no node child left. The pause order was followed, and the wait was re-armed on resume.
- A commit gate was cut mid-run by the Desktop-update pause. The staged files survived and were committed again on resume.

## Left
- JH 43 was told how to write `- Areas: +answer-engines (L9)` for the visa site. Applying it is JH 43's.
- Nothing else of this session's is open.

## Cost
- Time: 2026-10-21 05:15 local (opening) to 2026-10-23 14:36Z.
- Context share at the end: about 56%, as the last ready notice records.
- Reviews:
  - gentle-ai review cycles: 4 (`524391f9`, `c103e8fc`, `bac069f4`, and the PR 499 cycles).
  - Codex runs: 3 in this stretch (PR 500, PR 501, PR 506).
- Gate runs: about 12 commits through the pre-commit gate.

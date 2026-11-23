# Unattended session starts, and the hours with no work session (2026-11-22)

JH PLAN's findings on whether the Plan can open work sessions without him, written down by JH 301 at the lead's word,
and the minutes of 2026-11-22 with no work session running. True on its date: a later host or command can change it.
His words that ask for it: transcript `0cdab702-72bd-48e7-8a8e-0c38d4aca9c9`, lines 7148 and 14462, quoted in
`odd/tasks/plan-orchestrator.md` L18.

## The findings (JH PLAN's, as the lead relayed them; not re-tested here)
1. No check in this repository refuses a `start_session` for being unattended; the other routes are refused (item 4). The guard holds a start's title, model and effort
   (`rule:session-title`, `rule:session-model`, `rule:session-effort`), not whether he is there.
2. The app allows `start_session` only on a turn he typed. On any other turn (a cross-session message, a scheduled
   wake, a background task's end) it refuses the start and leaves a card he must tap. That is the host's limit, not
   ours.
3. One exception to test: a start on a `<side-sessions-event>` turn that follows his typed turn, which the host's
   own text says may start a step he asked to have in its own session. Not tested yet; the test is one start on
   such a turn, recorded with its result.
4. Out by `rule:sessions-open-in-sidebar` (sessions open in the sidebar, through `start_session`): `claude --bg`,
   `js-harness sessions start`, scheduled tasks and cloud sessions. Each could start a session with nobody there,
   and each would open it where he does not see it.

So, today, the Plan opens sessions without asking only on a turn he typed. "Sin pedir permiso" (line 14462) is met as
far as the host allows. The rest waits on the exception's test or on the host.

## The minutes with no work session running, 2026-11-22
Method: every transcript under `~/.claude/projects/D--js-harness-*` (the worktrees' sessions; `D--js-harness`
itself, where the lead and the Plan run, is left out) modified that day. A minute counts as busy when a transcript
has an entry in it, and the minutes between two entries of the same transcript count too when the entries are 5
minutes apart or less. The day is the local day (UTC-5), 00:00 to 21:33 when counted. Script: a node reader of each
entry's `timestamp`, kept in JH 301's scratchpad. The channel record (`~/.js-harness/channel/D--js-harness.jsonl`)
was not used: a notice marks a step, not the time between steps.

Result: 15 work-session transcripts; of 1,293 minutes, **759 with no work session running** (12 h 39 min) and 534
busy. Spells of 15 minutes or more: 00:00-00:26 (26); 02:12-09:53 (461); 10:06-12:51 (165); 15:06-15:40 (34);
19:48-20:50 (62).

Where the 759 come from, by stretch (local UTC-5, then UTC, so a window can be checked against the transcripts):

| Stretch | Local | UTC | Minutes |
|---|---|---|---|
| Just after midnight | 00:00-00:26 | 05:00-05:26Z | 26 |
| The night away | 02:12-09:53 | 07:12-14:53Z | 461 |
| Late morning | 10:06-12:51 | 15:06-17:51Z | 165 |
| Afternoon | 15:06-15:40 | 20:06-20:40Z | 34 |
| The evening gap (the lead's 19:50-20:47) | 19:48-20:50 | 00:48-01:50Z, 2026-11-23 | 62 |
| Gaps under 15 minutes, spread over the day | — | — | 11 |
| **Total** | | | **759** |

Of the 759 minutes, 748 sit in the five spells above, so the 5-minute threshold moves the total by 11 at most. A tool call or a turn that writes nothing for more than 5 minutes reads as idle, so the figure is an upper bound.

Limits: a session waiting on a declared `js-harness wait` writes nothing and counts as idle here, which is right for
"no work running" and wrong for "no session open". A sub-agent's transcript, in a `subagents` folder, was not read,
and neither was the lead's or the Plan's own work.

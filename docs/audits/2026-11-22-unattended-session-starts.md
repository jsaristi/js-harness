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
   own text says may start a step he asked to have in its own session. Tested on 2026-11-22: a start was accepted there, and whether it ran
   without his tap is not known (below).
4. Out by `rule:sessions-open-in-sidebar` (sessions open in the sidebar, through `start_session`): `claude --bg`,
   `js-harness sessions start`, scheduled tasks and cloud sessions. Each could start a session with nobody there,
   and each would open it where he does not see it.

So, today, a session opens others without asking him only on a turn he typed, and the app can ask him to approve even that start (he rejected one on a turn he had typed, line 15193 below); that the Plan is that session is the lead's and JH PLAN's reading of his words (L18), not his words. "Sin pedir permiso" (line 14462) is met as
far as the host allows. The rest waits on what the test left unproven, or on the host.

## Checked: the start test, and why the app asked him (JH 301, 2026-11-22)
**Result: JH 305's start was accepted in a `<side-sessions-event>` turn after a turn of his; whether it ran without
his tap is not known. He rejected the next start and wrote that it keeps asking.** Read in JH PLAN's transcript,
`0cdab702-72bd-48e7-8a8e-0c38d4aca9c9` (`~/.claude/projects/D--js-harness`), his lines each checked with
`js-harness sessions --quote`; times UTC (local 23:08-23:15).
- Line 14915, 04:08:11Z, his order (the quote prints two system reminders first): "haz la prueba de abrir una sesión tú solo".
- Lines 14965-14967: in that turn a `start_session` (`user_asked`) started JH 304; 81 seconds from call to result.
- Line 14982, 04:10:23Z, his: "no abrio sola". Line 15033, 04:11:03Z: the app opened a `<side-sessions-event>` turn.
- Lines 15049-15051: in it a `start_session` (`user_asked`) started JH 305
  (`local_d6d76a61-4a5f-4aa8-a56b-c407121a4436`); 7 seconds from call to result. Neither duration shows whether a
  prompt was shown.
- Line 15135, 04:14:03Z, his: "listo abre 3 mas a ver si deja". Line 15192: a `start_session` for JH 306; line 15193,
  04:14:59Z: "The user doesn't want to proceed with this tool use", so it never started, in a turn he had typed.
- Line 15198, 04:15:09Z, his: "sigue pidiendo permiso y no quiero eso".
- JH 304 and JH 305 were archived unused (clean worktrees, 0 commits): the lead's report, not checked here.

Why, from the app's bundle (`C:Program FilesWindowsAppsClaude_6.28899.6.0_x64__pzs8sxrjxfjjcappesourcesapp.asar`,
read as binary text with `grep -a`, nothing unpacked). [c] checked, by whom; [e] JH PLAN's explorer's claim, not checked:
1. [c] (JH PLAN; re-run by JH 301) `start_session` and `hand_off_to_session` are given `permission_policy:"always_ask"`:
   the bundle holds `Zn=["start_session","hand_off_to_session"]` and maps each to `{name:e,permission_policy:"always_ask"}`,
   behind a feature check (`Qn()`, which reads an id; JH 301 did not read its default). That it is a remote flag on by
   default is JH PLAN's check, by the lead.
2. [e] The app allows a start with no prompt when no gate trips, or when bypass is honoured for that session.
3. [e] The gates: the turn came over Remote Control ([c] by JH PLAN); 10 or more starts since his last message; the
   first use of a host, folder or repository; the turn woken by a session and not a person.
4. [e] Bypass is honoured only when it was available at the process's start and chosen in the app. Which reason
   applied to these starts is not known.
5. [c] (JH PLAN; re-run by JH 301, one match) the prompt's text: "Claude wants to start another session."
6. [e] No user setting turns it off.

So, if [e] holds, an unattended start always trips the woken-by-a-session gate and runs untapped only where bypass is
honoured. That gate does not explain the prompt at line 15192, on a turn he had typed: another gate tripped there, or
the list above is incomplete. Not proven: which gate or reason applied at lines 14965, 15049 and 15192, and whether bypass can be honoured
for the Plan. Using it as routine touches the reading of `rule:sessions-open-in-sidebar`, which stays the lead's,
after Codex's reset, with his lines 14462, 14915 and 15198.

## Checked: the lead was told to use `sessions start`, and the guard refused it (JH 301)
Read in the lead's transcript, `d6383aea-8901-43a8-9261-fdcbd501d370` (`~/.claude/projects/D--js-harness`):
- Line 35897, 2026-11-22T23:51:59Z: the host re-attached the skills the lead had invoked (`invoked_skills`). That
  copy of the orchestrator skill says: on a turn he did not type, `start_session` leaves a card, "so there start it
  with `js-harness sessions start --title "<title>" --brief <file>` instead".
- Line 36299, 2026-11-23T00:20:46Z (19:20 local): the lead ran `js-harness sessions start --cwd D:/js-harness --title
  "JH 300 · ..." --brief <file>`.
- Line 36301, 00:20:47Z: the guard refused it: "js-harness sessions start opens a session in the background, where he
  does not see it (rule sessions-open-in-sidebar)". The lead's relief note, written at 00:21Z, dates it "19:27 local";
  the transcript says 19:20.
- The installed file says the opposite: `~/.claude/skills/js-harness-orchestrator/SKILL.md` (v0.97.0, modified
  2026-11-21 08:22 local), line 45, says the card "is the way there" and that "the guard refuses `js-harness sessions
  start` and `claude --bg` wherever `rule:sessions-open-in-sidebar` is declared"; `grep -rn "sessions start"
  ~/.claude/skills/` finds no line that tells a lead to start one.

So the instruction came from a copy older than the installed file, re-attached to the lead's context, not from the
installed skill. Not checked: when the lead first invoked the skill, so how old that copy was.

## Why every start shows a card (2026-11-23)
**Verdict: supported in part, not proved. Three causes, not one, and no app log can tell which tripped.** Two
read-only explorers for JH ORQ, at his order (`0cdab702`, line 15805, 2026-11-23T04:46:04Z), read the app's bundle
(Claude Desktop 6.28899.6, offsets from the start of app.asar) and claude.exe 2.1.330; their notes are in JH ORQ's
shared notes folder (`side-session-notes/local_41e31b68-c8b2-4729-8c54-b1e701bb5a40`, `start-prompt-cause-2026-11-23.md`
and `deep-link-import-2026-11-23.md`). [c] checked, by whom; [e] the explorer's claim, not re-checked by the lead.

The app's decision: [e] a start is allowed with no card only when its bypass verdict stands down as "bypass" and its
`Ce()` returns false (~22079874). [e] `Ce()` is true when an ask rule or a non-built-in PreToolUse hook covers the
tool (plugin hooks count), and it skips the hooks entirely when `server_policy_ask_only` is true (~22076224).
1. [c] (read for this section) The harness's PreToolUse matchers, `~/.claude/settings.json` lines 82 (guard), 92
   (template gate) and 102 (advisor gate), are regex form `^(...)$`. [e] By the app's matcher `K9r` (app.asar byte
   14409996, [c] by the lead) any regex character makes a matcher cover every tool, so line 92 covers `start_session`
   though it does not name it; line 102 names it outright.
2. [c] (the lead) engram 0.1.23's own PreToolUse matcher (its `hooks.json`, line 6) is regex form too, so a plugin
   the harness does not write covers the start as well.
3. [e] The harness's PermissionRequest hook (`js-harness permit --hook`, [c] present in the user settings by the
   lead; written by `bin/lib/hook-entries.mjs:88-90`): in claude.exe (~358271066) any PermissionRequest hook turns
   `server_policy_ask_only` off, so the short cut past the hooks is never taken.

Not known: whether the other exits of the bypass verdict (a pending mode change, org approval, cost,
server_unconfirmed) ever trip. No app log is on disk (Claude-Data logs empty; verdicts go to telemetry only), and
every accepted start since 2026-11-15 took 6.8 s or more, so latency cannot tell an untapped start from a quick tap.
A trial that removes the PermissionRequest entry for one session decides it; changing the PreToolUse matchers alone
does not, while engram's matcher and the permit hook stay.

**A start on a turn he did not type is refused, not carded.** [c] (read for this section) In JH PLAN's
transcript, `0cdab702`: the turn opened at line 11353 (2026-11-22T05:36:11Z) with JH ORQ's cross-session message
asking for two held sessions, not with his words (a `RemoteControlInput` record sits beside the calls at 11360-11377
too). Two `user_asked` starts (JH 292, JH 293), called at 05:36Z, came back as errors at lines 11375 and 11377
(06:12:23Z and 06:12:25Z): the tool starts sessions only on the user's own words there and says to propose instead
(`initiation` "own_initiative"). A proposal is the card he taps, as finding 2 above says. Our reading, not checked:
on an untyped turn the card is the tool's own limit, so no change to the hooks removes it there.

**The deep link, and why it stays out.** [c] (the lead) app.asar holds "Resume deep link: importing CLI session" at
byte 15079656; `claude://code/resume` occurs 0 times. [e] The link is `claude://resume?session=<full transcript
uuid>`: it adopts a CLI transcript as an idle sidebar row with no dialog or sender check, trusts an untrusted folder
silently, has no check that a CLI job is still writing the transcript, and turns Bypass into AcceptEdits. It is
outside `rule:sessions-open-in-sidebar` as written: its only source of a session to adopt is a CLI session, which
that rule refuses (`js-harness sessions start`, `claude --bg`), and it would skip the card the rule keeps on an
untyped turn. Using it would need a change to that rule, which is his.

The trial and the fix are tracked in draft PR 1023 (`odd/tasks/start-without-card.md`, branch
`claude/jh302-start-without-card`); both touch his user settings and the guard, so they wait for his word and for
Codex.

## The minutes with no work session running, 2026-11-22
Method: every transcript under `~/.claude/projects/D--js-harness-*` (the worktrees' sessions; `D--js-harness`
itself, where the lead and the Plan run, is left out) modified that day. A minute counts as busy when a transcript
has an entry in it, and the minutes between two entries of the same transcript count too when the entries are 5
minutes apart or less. The day is the local day (UTC-5), 00:00 to 21:33 when counted. Script: a node reader of each
entry's `timestamp`, kept as `idle.mjs` in JH 301's shared notes folder (`side-session-notes/local_f536332a-81c1-489b-9669-68384563ffe9`). The channel record (`~/.js-harness/channel/D--js-harness.jsonl`)
does not count the minutes, since a notice marks a step, not the time between steps; it is read below only as a
cross-check that holds when a transcript is gone.

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

Checked against the lead's queue (`today-queue-2026-11-22.md`, its header "written 15:20 local", which lists JH
296 and 297 as running): no overlap. Their transcripts' first entries are 2026-11-22T20:40:36Z and 20:40:48Z (15:40
local), the end of the afternoon spell; the queue file was first written at 20:44:51Z (15:44 local, the lead's
transcript, line 32698), after both had opened. In 15:06-17:51Z (10:06-12:51 local) and 20:06-20:40Z (15:06-15:40)
no transcript under `D--js-harness-*`, sub-agents included, has an entry; only the lead's and the Plan's, left out by
the method.

The other three spells, checked the same way, plus every transcript open across a spell (an entry before it and the
next after it, which a tool call running through the spell would show), in every folder under `~/.claude/projects`:
- 00:00-00:26 (05:00-05:26Z): no work session wrote. JH 287 was open across it and wrote nothing; its next entry
  is the lead's message at 00:46 telling it to stop its background tasks. What it had running in the spell was not
  read (its entry before the spell is a compaction summary written at 00:47 with an older stamp).
- 02:12-09:53 (07:12-14:53Z): no work session wrote. JH 291 was open across it: it ended its turn at 02:02 with a
  `js-harness wait` of 480 minutes in the background, and that wait timing out woke it at 09:53. So it waited, with
  no work, as the Limits below say.
- 10:06-12:51 (15:06-17:51Z): no work session wrote, and none was open across it.
In all three only the lead and the Plan wrote (the Plan at 02:14-08:02 inside the night spell). A session whose transcript was later deleted would not show here,
so the channel record was read too: in the five spells its only notices are from the lead (a question and its
withdrawal, 10:06-12:51) and the Plan (a note in the night spell, and one reading record). So no work session wrote
in any spell of the table.

Limits: a session waiting on a declared `js-harness wait` writes nothing and counts as idle here, which is right for
"no work running" and wrong for "no session open". A sub-agent's transcript, in a `subagents` folder, was not read,
and neither was the lead's or the Plan's own work.

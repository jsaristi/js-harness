# JH 291 · the lead's wait wakes it when a stretch is open and nothing runs

Locator: `odd/tasks/idle-stretch.md` · Engram mirror: `odd/idle-stretch/tasks` · Branch: `claude/jh291-idle-stretch`
Delivery: one draft pull request to main · Test runner: `node --test`

## State
Feature document committed before the first code commit. Next: the tests of T1 and T2, then the reading, the wait and
the heartbeat. Open: nothing decided by the owner is pending; the gaps of the reading are named in Constraints.

## Goal
While a stretch covers now and has hours left, the lead's notice wait and its heartbeat end with one `IDLE:` line
when no work session of the project has run for a set time, told once per idle spell.

## Why
On 2026-11-22 the stretch opened at 00:40Z finished its three goals early, and from 03:52Z to 05:22Z no work session
ran while he was away (L1). The lead's wait ends only on a notice, its time, or the `AWAY:` line, which a stretch
silences; nothing woke anyone. A check must close that gap, not a habit.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/idle-stretch.md` exits 0
- `node --test bin/lib/lead-away.test.mjs bin/wait.test.mjs bin/loop-bodies.test.mjs bin/lib/return-report.test.mjs` exits 0
- `npm run check` exits 0
- the lead's wait with a stretch open and no session written for 20 minutes ends with an `IDLE:` line (exit 5)

## In scope / Out of scope
- In: `bin/lib/lead-away.mjs` (the reading), `bin/lib/return-report.mjs` (the stretch's return time), `bin/wait.mjs`,
  `bin/loop.mjs` (the heartbeat), their tests, the skill line in `bin/lib/manifest.mjs`, `docs/SPEC.md`'s wait
  requirement, this document.
- Out: a work session's wait (it never ends on it); the stall reading (`bin/lib/stall.mjs`), which covers a session
  that holds work and is quiet; any rule change.

## Constraints
- "Ran" is read from writes, not from turn states: the newest write of a transcript of the project other than the
  lead's own (the folders `projectDirsOf` lists), and the newest gate-log event not recorded by the lead. Parsing every
  transcript's turn each tick costs too much and a dead session's dangling turn would hold the line back forever.
  Gap, said: a foreground sub-agent writes only under `<session>/subagents/`, so one that runs more than 20 minutes
  with no other write gives a false `IDLE:` line; a false line costs one wake, a missing one repeats L1.
- The channel record is not read: its writes cannot be told apart by sender without parsing, and the lead's own
  notes would start a new spell every time.
- A listing that cannot be read is said once and tells nothing: unknown is neither idle nor running.
- The idle time is a plain constant (`IDLE_MS`, 20 minutes), as `ABSENCE_MS` is: a declared rule needs a rule/ branch.
- Spend: state at 11M cache-read, stop at 15M; Codex is at its stop until 2026-11-23 23:45, so its review is skipped
  and recorded.

## Ask me before
Nothing: the brief and his words L2, L3 ask for it; a doubt goes to the lead as a note.

## Depth pass
- 1. Method: a watchdog on a liveness signal (the heartbeat's own STALL line, `bin/loop.mjs:718`, on file writes),
  told once per spell as the AWAY line is (`bin/lib/lead-away.mjs:107`), scoped to the lead as the AWAY line is.
- 2. Raw material: the brief `brief-idle-stretch.md` (lead notes); his words L1-L3; `bin/wait.mjs:328-364` (the away
  ending); `bin/lib/lead-away.mjs:59` (`leadAbsence`); `bin/loop.mjs:696-725` (the heartbeat's endings);
  `bin/lib/return-report.mjs:184` (`stretchRecordsIn`, which drops `plan.hours`); `bin/stretch.mjs:329`
  (`returnAt` = opened + hours); `bin/lib/sessions.mjs:821` (`projectDirsOf`); `bin/lib/stall.mjs:47` (gate acts by
  session).
- 3. The bar:
  spec 1: `node --test bin/wait.test.mjs`: none, new behaviour (today the wait runs out its time, exit 1)
  spec 2: `node --test bin/loop-bodies.test.mjs`: none, new behaviour (today the heartbeat ends on STALL only after 30
  quiet minutes of the gate log and channel, which the lead's own notes keep alive)
  spec 3: `node --test bin/lib/lead-away.test.mjs`: none, new behaviour
  spec 4: left out because help text and the skill line are prose the `check` gate's docs rows hold
- 4. Refutation: the cheapest test that could show the gap is not real is whether any existing ending fires with a
  stretch open and every session quiet: `AWAY` is silenced by `covers` (`bin/lib/return-report.mjs:336`), `STALLED`
  needs a session holding handed work (`bin/lib/stall.mjs:127-129`), and `STALL` reads the channel record, which the
  lead's own notes write. Read now: none fires.
  Verdict: supports
- 5. Request: one reading in `lead-away.mjs` that the lead's wait and heartbeat share, with one mark; the `IDLE:` line
  names the stretch's hours left and "plan the next unit or close the stretch"; a work session's wait never reads it.
  Adds: none

## Specs
1. The brief: "while a stretch covers now and has time left, when no work session of the project has run (no turn in
   progress and no transcript write) for a set time (a constant, about 20 minutes), the lead's wait and the heartbeat
   end with one `IDLE:` line naming the stretch's hours left and \"plan the next unit or close the stretch\"".
2. The brief: "told once per idle spell (mark it like the AWAY mark)".
3. The brief: "A work session's wait never ends on it."
4. The brief: "Help text and the js-harness skill line where `wait` is described."

## Tasks
- T1 spec 1, 2: the reading and its tests (build, commit 2)
- T2 spec 1, 3: the wait and the heartbeat, their tests (build, commit 2)
- T3 spec 4: help, skill line, SPEC requirement (docs, commit 2)

## Log
- L1 2026-11-22, his words (transcript 0cdab702-72bd-48e7-8a8e-0c38d4aca9c9, line 10901, 05:22Z): "no veo que nada
  este trabajando"; line 11167: "pero por que pasa esto te dije que me iba y no hiciste nada"
- L2 2026-11-22, his words (same transcript, line 9744): "incluye primero que todo las mejoras para que nos nos vuelva
  a fallar"
- L3 2026-11-22, the lead's brief (JH ORQ): build the smallest form, test first, lenses risk and reliability, no Codex.
- L4 2026-11-22, the advisor before the first test: read "ran" from writes and fail toward telling; leave out the
  lead's own transcript, notes and gates; an unreadable listing tells nothing; test a stretch past its return.

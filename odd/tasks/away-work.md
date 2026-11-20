# Away hours produce work: the measurement

## State
Measured up to the cut 2026-11-20T00:00Z (19:00 local, UTC-5). The table and the gates are written; nothing is cured
here. Next: the sitting at his return decides from "His to decide" below. Open: the wait causes of the sessions marked
"not known"; JH 230's alignment design (PR 921) was not read for this pass.

## Goal
Measure, per away period, how long each session worked and how long it waited and on what, so the sitting at his
return decides the cure from figures, not from estimates.

## Why
He typed in JH PLAN (transcript `f5c3ee4d`, line 7927, 2026-11-19T21:36:13Z, read with `js-harness sessions --quote`,
sent while the session worked): "quiero que corrijas eso de que no avanzamos cuando quedas solo y cuando venga vamos a
solucionar completamente y a profundidad eso". The earlier periods were described from the Plan's chat, not measured.

## Done when
- `node --test workshop/lib/away-hours.test.mjs` exits 0
- `node -e "const t=require('fs').readFileSync('odd/tasks/away-work.md','utf8');for(const h of ['## Table','## Gates','## His to decide'])if(!t.includes(h))process.exit(1)"` exits 0
- The draft pull request is open and the lead has a `ready` notice naming it.

## In scope / Out of scope
- In: this document; `workshop/lib/away-hours.mjs` and its test, new, read-only, wired into nothing.
- Out: any rule, the guard, the reply check, settings, `CLAUDE.md`, `AGENTS.md`, `docs/ROADMAP.md`,
  `docs/FAILURES.md`, `check`/`doctor`/merge-door rows, and the files JH 234, JH 225, the senior, JH 239 and JH 240 hold
  (miniplan 10, "Do not").

## Constraints
- He is away (`rule:away-autonomy`): nothing is asked; what is his goes under "His to decide".
- No Codex run: reviews are held to the reset of 2026-11-23 23:45; the code's review is recorded as held.

## Ask me before
Every item of "His to decide"; none is acted on here.

## Depth pass
- 1. Method: measure from records with a stated rule and a stated sensitivity, as a time study does: the rule that
  splits work from waiting is written in the reader's header, and every total is printed at two idle limits (10 and 30
  minutes) so the reader sees how much the rule moves it. The smallest change: one read-only reader, no new command.
- 2. Raw material: the transcripts of the project's folders under `~/.claude/projects` (his entries by `quoteOf`'s
  rule, `bin/lib/person-times.mjs:11`); the absence limit `ABSENCE_MS` (`bin/lib/return-report.mjs:34`); the stretch
  record (`js-harness stretch show`); the notes `return-block.md`, `return-block-2.md`, `away-starts*.md`,
  `miniplan-007-eight-hours-away.md` in the lead's notes folder (`local_41e31b68…`).
- 3. The bar:
  spec 1: `node workshop/lib/away-hours.mjs --since 2026-11-17T12:00:00Z --now 2026-11-20T00:00:00Z --root D:/js-harness`:
  none before, new behaviour (`stretch show` gives a span from start to close, and lost time only from failed gates,
  `bin/lib/stretch.mjs:283-324`).
- 4. Refutation: the cheapest test that the complaint does not hold is that sessions worked most of an absence.
  `node workshop/lib/away-hours.mjs --since 2026-11-17T12:00:00Z --now 2026-11-20T00:00:00Z --root D:/js-harness`:
  in the night of 2026-11-18/19 the 11 sessions with an entry inside worked 7.26 h of 104.45 session-hours (10.52 h
  at `--idle 30`).
  Verdict: supports
- 5. Request: as miniplan 10 asks, with one correction from item 2: the four periods it names are not four absences
  by the record (see "Periods").
  Adds: none

## Periods
His absences are gaps between two of his entries (typed, queued or tapped) longer than `ABSENCE_MS`, 2 hours. Command
for all of this section: `node workshop/lib/away-hours.mjs --since 2026-11-17T12:00:00Z --now 2026-11-20T00:00:00Z
--root D:/js-harness` (idle 10 min; `--idle 30` for the second figure).

| Period (miniplan 10's name) | By the record (UTC) | Local (UTC-5) | Hours |
|---|---|---|---|
| (not named) | 2026-11-17 14:28 → 22:03 | 09:28 → 17:03 | 7.58 |
| (not named; the stretch of 07:50Z) | 2026-11-18 06:38 → 15:52 | 01:38 → 10:52 | 9.23 |
| "the evening of 2026-11-18" | no absence: his longest gap that evening is 19:57 → 21:41Z, 1.75 h (`--from 2026-11-18T19:57:00Z --to 2026-11-18T21:41:47Z`) | 14:57 → 16:41 | 1.75 |
| "the night of 2026-11-18 to 19" | 2026-11-19 05:56 → 15:25 | 00:56 → 10:25 | 9.49 |
| "the afternoon of 2026-11-19" | no absence: 8 of his entries fall inside 20:10 → 21:36Z (taps of 372 and 378 among them) (`--from 2026-11-19T20:10:00Z --to 2026-11-19T21:36:13Z`) | 15:10 → 16:36 | 1.44 |
| "now, about 3 hours from 18:10 local" | from 2026-11-19 21:36:13Z, still open at the cut | from 16:36 | 2.4 at the cut |

The last period began at his queued message of 16:36 local, not at 18:10: no entry of his is recorded after it in any
transcript of the project (searched: every `.jsonl` changed since 2026-11-19 16:30 local under `~/.claude/projects`,
for `"human"`, `queued_command` and `"answers"`).

## Table
A session's working hours are the gaps between its entries that are 10 minutes or shorter, or that run under a tool
call of its own; its waiting hours are the rest of the window from its first entry, and a pending question, `js-harness
wait`, a watch or a `sleep` counts as waiting (the reader's header). Only sessions with an entry inside the window are
rows; the others are counted under the table, since a transcript cannot tell an idle open session from an archived one.
Figures: idle 10 min / idle 30 min. "Wait on" names the cause and where it is read; "not known" where no record says.

### Night of 2026-11-17/18 (9.23 h; the stretch opened 07:50Z)

| Session | Working h | Waiting h | Longest wait, ended by | Wait on |
|---|---|---|---|---|
| JH 207 · review gate | 1.10 / 1.73 | 8.14 / 7.50 | 4.58 h from 10:19Z, a task event | not known: its waits ended by task events, likely its own background runs (assumed) |
| JH PLAN | 0.88 / 1.17 | 8.35 / 8.07 | 7.15 h from 08:43Z, his return | his typed words (the Plan waits on him by role) |
| JH 217 · Codex reviewer model | 0.47 / 0.47 | 8.77 / 8.77 | 8.50 h from 07:22Z, nothing | not known |
| JH ORQ (d6383aea) | 0.37 / 1.21 | 8.86 / 8.03 | 6.76 h from 09:07Z, nothing | a start: 14 of the stretch's 15 items stayed `queued`, never bound to a session (`js-harness stretch show`) |
| Total, 4 sessions | 2.82 / 4.58 | 34.12 / 32.37 | | 11 more sessions have no entry inside |

`js-harness stretch show` for the same night: 9.22 of 9 h, goals 0 of 6 met, work done 0 of 15.

### Night of 2026-11-18/19 (9.49 h; miniplan 7's "eight hours")

| Session | Working h | Waiting h | Longest wait, ended by | Wait on |
|---|---|---|---|---|
| JH SR · senior | 2.55 / 3.28 | 6.94 / 6.21 | 5.29 h from 10:08Z, nothing | the Codex gate and his decision: the shell reader's third and last round was spent, a fourth is question 362 (`return-block.md:37`) |
| JH ORQ (d6383aea) | 1.98 / 3.33 | 7.52 / 6.17 | 3.33 h from 09:12Z, a task event | not known (its own watch, assumed) |
| JH 234 · archive finished sessions | 1.48 / 2.07 | 8.01 / 7.43 | 6.52 h from 08:54Z, nothing | something else: the guard refused its cwd after the app moved its folder (`return-block.md:14-19,30`) |
| JH 228 · S8 run | 0.57 / 0.75 | 8.93 / 8.74 | 6.65 h from 08:47Z, nothing | a decision of his: S8's T2-T7, question 361 (`return-block.md:7`) |
| JH 230 · alignment audit | 0.40 / 0.81 | 9.10 / 8.68 | 3.00 h from 08:13Z, a task event | a decision of his: PR 921's seven D cards (`return-block.md` item 5) |
| JH PLAN | 0.14 / 0.14 | 9.35 / 9.35 | 6.25 h from 09:10Z, his return | his typed words |
| JH 229 · no carrying | 0.07 / 0.07 | 9.43 / 9.43 | 6.66 h from 08:46Z, nothing | his typed words: behind the senior's rule words (`return-block.md` "Kept") |
| JH 233 · Codex controlled test | 0.03 / 0.03 | 9.47 / 9.47 | 9.47 h from 05:57Z, nothing | the Codex gate and his decision: question 359 (`return-block.md:5`) |
| JH 220 · codex-spend | 0.02 / 0.02 | 9.47 / 9.47 | 7.62 h from 07:48Z, nothing | a decision of his: question 360 (`return-block.md:6`) |
| JH 227 · Plan pre-prompt | 0.01 / 0.01 | 9.49 / 9.49 | 6.03 h, a task event | his typed words: a rule change (`return-block.md:29`) |
| JH 225 · pre-commit gap | 0.01 / 0.01 | 9.48 / 9.48 | 6.59 h, a task event | the Codex gate: its three reviews spent (`return-block.md:29`) |
| Total, 11 sessions | 7.26 / 10.52 | 97.19 / 93.92 | | 19 more sessions have no entry inside |

No session was started: `away-starts.md` reads `none` (miniplan 7 step 3, "If nothing qualifies").

### Now, from 2026-11-19 21:36Z (2.4 h at the cut)

| Session | Working h | Waiting h | Longest wait, ended by | Wait on |
|---|---|---|---|---|
| JH PLAN | 1.93 / 2.12 | 0.46 / 0.27 | 0.27 h, nothing | none: its turn opened by his 21:36Z message ran to 23:43Z |
| JH ORQ (d6383aea) | 0.72 / 0.72 | 1.68 / 1.68 | 1.68 h from 21:48Z, a session's message | not known |
| JH 238, 239, 240, 241 | 0.29 to 0.56 / 0.29 to 0.56 | 0 to 0.17 | | none; started 23:26Z, 1.83 h after his last entry, by the Plan's turn |
| JH 237 · PR 930 items | 0.19 / 0.19 | 2.21 / 2.21 | 2.21 h from 21:47Z, nothing | something else: stopped past its Claude stop line, 8.03M of 6M (`return-block-2.md:53`) |
| JH 236 · S8 T6 | 0.08 / 0.08 | 2.32 / 2.32 | 1.89 h from 21:36Z, a session's message | something else: stopped past its stop line, 12.74M of 9M (`return-block-2.md:47`) |
| JH 230 · alignment audit | 0.01 / 0.01 | 2.39 / 2.39 | 1.98 h, a task event | a decision of his and the Codex gate (`return-block-2.md`, "After the reset") |
| Total, 9 sessions | 4.71 / 5.06 | 9.23 / 8.87 | | 28 more sessions have no entry inside |

What the table cannot say: whether a session with no entry inside was open; whether a wait ended by a task event was
its own background work (work) or a watch (waiting); a running gate is counted as work even while it queued for the lock.

## Gates
Each gate the table shows costing hours, with what already holds it, so the sitting amends rather than adds.

1. **A start.** The app starts a session only on a turn he typed; after his last message nobody starts one. Protects:
   his control of what runs and spends while he cannot see it. Cost in the table: the stretch of 2026-11-18 left 14 of
   15 items queued; on the night of 18/19 no session started. Loosens it: a queue of approved briefs left before he
   goes, handed to sessions already open as they finish (miniplan 10's tier 2, `away-tier-2.md`, the lead's). Already
   holds it: the stretch protocol's queued items and `stretch bind` (`odd/tasks/stretch-protocol.md`). Risk: work he
   would not have chosen runs for hours; bounded by each brief's stop line.
2. **His typed words for a rule change, and one open `rule/` branch.** Protects: his rules change only by him. Cost:
   JH 227 and JH 229 waited the whole night; JH 234's rule change could not run (`return-block-2.md:16`). Loosens it: a
   rule change waits as a recorded order (his tapped answer recorded with its line) instead of typed words. Already
   holds it: `js-harness rules change` and the owner-words check of `rules check`. Risk: a tap given on a phone without
   reading the sentence becomes a rule.
3. **The Codex gate.** His weekly stop is 60% (question 346); every review that lets a branch land is held. Protects:
   the Codex week. Cost: JH 233, JH 225 and the senior stopped on it. Loosens it: a branch may land with its Codex review
   owed while he is away, up to a count or a size. Already holds it: `codex-review --unavailable` makes a skip a debt that
   `check`, `doctor` and the merge door list. Risk: unreviewed code on main until the debt is paid.
4. **A decision of his recorded after he left.** Questions 359, 360, 361 and 362 each stopped a session for the whole
   night. Protects: `rule:owner-decisions`. Loosens it: before he goes, the lead asks the questions it can foresee, or
   each question carries the default that runs if he has not answered by a time. Already holds it: `rule:away-autonomy`
   and the question record (`notify --kind question`). Risk: a default runs that he would have refused.
5. **No next brief, and the cap of open sessions (12).** A session that finished had nothing to take. Protects: the
   machine and his attention. Loosens it: tier-2 briefs per open session (miniplan 10); a higher cap. Already holds it:
   `rule:work-sessions-public` for the cap. Risk: more sessions open than he can follow.
6. **The Claude stop line.** JH 236 and JH 237 passed theirs and stopped: 2.2 h each of waiting tonight. Protects: the
   Claude week. Loosens it: estimates from a measured session of the same kind; a stop that hands the rest to a fresh
   session instead of waiting. Already holds it: each brief's stop line. Risk: spend past the estimate.
7. **The guard's cwd check.** JH 234 waited 6.52 h refused by its cwd; this session met it too (a `cd` into its own
   worktree refused as another session's, because JH 236 had run there). Protects: one session's files from another's
   commands. Loosens it: not his alone to loosen: it is a security item (`AGENTS.md`, high risk); the fix is the guard
   telling apart a worktree shared by an ended session. Already holds it: the guard. Risk: one session writes on
   another's branch.

Existing homes for the measurement itself: `docs/ROADMAP.md:943` ("A stretch's lost time counts only failed gates …
Idle time read from `waiting` notices counts too", owner JH 208) and the reserve item `lost-time` of
`plan-2026-11-18-away.json:156`; `docs/ROADMAP.md:946`, stalled-session detection. This reader is the evidence for the
first; it is not wired anywhere so that home decides whether it moves into `stretch`.

## His to decide
From the table, in the sitting at his return (miniplan 10), one decision a question: whether a queue of approved briefs
is left before he goes (gate 1); whether a branch may land with its Codex review owed while he is away, and up to what
(gate 3); whether a rule change may wait as a recorded order instead of his typed words (gate 2); whether a question
may carry a default that runs at a time (gate 4); the cap of open sessions (gate 5); and the Codex spend of this
work's own review (held to the reset).

## Tasks
- [x] T1 (kind: build) The reader `workshop/lib/away-hours.mjs`, test first: spec 1. Commit: this branch.
- [x] T2 (kind: docs) The periods, the table and the gates in this document. Commit: this branch.

## Log
- L1 His request, typed in JH PLAN (`f5c3ee4d`:7927, 2026-11-19T21:36:13Z): "Si pero quiero que corrijas eso de que no
  avanzamos cuando quedas solo y cuando venga vamos a solucionar completamente y a profundidad eso para que no nos vuelve
  a suceder pero quiero que lo comiences a implementar de una vez para que avancemos ahora que voy a estar ausente".
- L2 Evidence: the miniplan's four periods are not four absences by the record; two are, and two more exist that it
  does not name (2026-11-17 day, 2026-11-17/18 night). His last entry is 16:36 local, not 18:10.
- L3 Evidence: the reader first missed sibling worktrees (`D--js-harness-worktrees-…`) and counted every old
  transcript as waiting; both fixed before the table, with the main test covering each.
- L4 The lenses (reliability, readability) found 7 points in the reader, all fixed with tests; one moved figures:
  an idle gap cut by the window's end had counted as work. Only the open period's 30-minute figures changed.
- L5 The lenses' follow-up on c6961b66, answered, not fixed: a session started in a plain subdirectory of the
  checkout (folder `<slug>-workshop`) is no longer read, since its folder name cannot be told from a sibling project's
  (`<slug>-site`); sessions here start in the checkout or a worktree, so the table loses none of tonight's rows (the
  figures above did not change but the open period's 30-minute ones).
- L6 Codex review of the reader held to the reset of 2026-11-23 23:45 (miniplan 10, "Budget").

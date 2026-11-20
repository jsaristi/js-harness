# Away hours produce work: the measurement

## State
Measured up to his return, 2026-11-20T01:34:35Z (20:34 local, UTC-5), and answered to the double read
`9ebe3e0d` (26 findings, every one taken; see "What the double read changed"). Nothing is cured here. His order had
two parts (Why): the cure in depth is the sitting at his return, which decides from "His to decide"; the part to begin
at once is the lead's tier 2, `away-tier-2.md` in the lead's notes folder (`local_41e31b68…`), whose result is: the
route works, only JH 238 used it, every other session passed its stop line first (`away-tier-2.md`, "Results", 19:18
and the verdict line). Open: the wait causes marked "not known"; the notify records were read only for questions.

## Goal
Measure, per away period, what was produced (pull requests landed, approved tasks done) and how long each session
worked and waited and on what, so the sitting at his return decides the cure from figures, not from estimates.

## Why
He typed in JH PLAN (transcript `f5c3ee4d`, line 7927, 2026-11-19T21:36:13Z, read with `js-harness sessions --quote`,
queued into the turn his line 7904 opened at 21:34:47Z): "Si pero quiero que corrijas eso de que no avanzamos cuando
quedas solo y cuando venga vamos a solucionar completamente y a profundidad eso para que no nos vuelve a suceder pero
quiero que lo comiences a implementar de una vez para que avancemos ahora que voy a estar ausente". Two orders: the
cure, at his return; the beginning, now (tier 2, State).

What he means by "avanzar", from his earlier words (searched: every transcript of the project's folders changed since
2026-11-14, his entries by `quoteEntry`, for `no avanz|avanc|avanza|quedas? solo|ausente|me voy|cuando no estoy`;
22 hits): progress on the pending tasks, not hours. `f5c3ee4d`:7527 (2026-11-19T20:22Z): "en que avanzaste osea de
las tareas que teniamos pendientes"; `69918425`:15446 (2026-11-15T15:22Z): "casi no avanzamos debe haber una forma de
mitigar esto"; and after this measurement's cut, `f5c3ee4d`:8429 (2026-11-20T04:11Z): "como hacemos para avanzar lo
que mas importa". So output leads every table below; hours explain it.

## Done when
- `node --test workshop/lib/away-hours.test.mjs` exits 0
- `npm run check` exits 0
- `node -e "const t=require('fs').readFileSync('odd/tasks/away-work.md','utf8');for(const h of ['Table','Gates','His to decide','What the double read changed'])if(!new RegExp('^## '+h+'$','m').test(t))process.exit(1);if((t.match(/^### /gm)||[]).length<5)process.exit(1)"` exits 0
- The draft pull request is open and the lead has a `note` notice naming it and its head (`ready` refuses a draft).

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
- 1. Method: measure from records with a stated rule and a stated sensitivity, as a time study does: output first
  (merges on main per period), then the split of work from waiting, written in the reader's header, every total at two
  idle limits (10 and 30 minutes). The smallest change: one read-only reader, no new command.
- 2. Raw material: the transcripts of the project's folders under `~/.claude/projects` (his entries by `quoteOf`'s
  rule, `bin/lib/person-times.mjs:11`); the absence limit `ABSENCE_MS` (`bin/lib/return-report.mjs:34`); `git log
  origin/main --first-parent --merges`; the question notices of the board (`~/.js-harness/channel/D--js-harness.jsonl`);
  the stretch record (`js-harness stretch show`); the notes `return-block.md`, `return-block-2.md`, `away-starts*.md`,
  `away-tier-2.md`, `jh234-blocked-cwd.md`, `miniplan-007-eight-hours-away.md` in the lead's notes folder.
- 3. The bar:
  spec 1: `node workshop/lib/away-hours.mjs --since 2026-11-17T12:00:00Z --now 2026-11-20T01:34:35Z --root D:/js-harness`:
  none before, new behaviour (`stretch show` gives a span from start to close, and lost time only from failed gates,
  `bin/lib/stretch.mjs:283-324`).
- 4. Refutation: the cheapest test that the complaint does not hold is that the absences landed work at the rate the
  present hours did. `git log origin/main --first-parent --merges --since=<from> --until=<to>`: the two nights landed
  3 and 4 pull requests in 9.23 h and 9.49 h (0.33 and 0.42 an hour), the present day between them 8 in 14.07 h
  (0.57 an hour), and each night's lands came in one batch minutes apart, so a land's time is not when its work was
  done. Of the approved work, the stretch of 2026-11-18 did 0 of 15 items (`js-harness stretch show`) and the night of
  18/19 started nothing (`away-starts.md`). Hours agree: on the night of 18/19 the 11 sessions with an entry inside
  worked 7.26 h of 104.45 session-hours (7.24 of 85.46 without the two stopped at a review cap).
  Verdict: supports
- 5. Request: as miniplan 10 asks, with one correction from item 2: the four periods it names are not four absences
  by the record (see "Periods").
  Adds: none

## Periods
His absences are gaps between two of his entries (typed, queued or tapped) longer than `ABSENCE_MS`, 2 hours, read
from transcript gaps; a period the lead's notes declare is marked "declared". Command: `node workshop/lib/away-hours.mjs
--since 2026-11-17T12:00:00Z --now 2026-11-20T01:34:35Z --root D:/js-harness` (idle 10 min; `--idle 30` for the second
figure; a named window with `--from <from> --to <to>`). Merges: `git log origin/main --first-parent --merges
--since=<from> --until=<to> --format='%cI %s'`, distinct pull requests (903, 924 and 925 merged twice).

| Period (miniplan 10's name) | By the record (UTC) | Local (UTC-5) | Hours | PRs landed |
|---|---|---|---|---|
| (not named) | 2026-11-17 14:28 → 22:03, gap | 09:28 → 17:03 | 7.58 | 1 (906) |
| (not named; the stretch of 07:50Z) | 2026-11-18 06:38 → 15:52, gap | 01:38 → 10:52 | 9.23 | 3 (909, 910, 911, at 02:24 local) |
| present | 2026-11-18 15:52 → 2026-11-19 05:56 | 10:52 → 00:56 | 14.07 | 8 (912, 902, 913, 914, 915, 917, 918, 919) |
| "the evening of 2026-11-18" | no absence: his entries at 19:57 and 21:41Z (`f5c3ee4d`:3064, :3286) are 1.73 h apart | 14:57 → 16:41 | 1.73 | inside "present" |
| "the night of 2026-11-18 to 19" | 2026-11-19 05:56 → 15:25, gap | 00:56 → 10:25 | 9.49 | 4 (916, 920, 922, 924, at 02:54 local) |
| present | 2026-11-19 15:25 → 21:36 | 10:25 → 16:36 | 6.19 | 6 (924, 923, 925, 926, 928, 929) |
| "the afternoon of 2026-11-19" | declared from 15:10 local (`return-block-2.md:1`); by the gaps present: 8 of his entries in 20:10 → 21:36Z, taps of 372 and 378 and his typed line 7527 among them | 15:10 → 16:36 | 1.44 | 0 |
| "now, about 3 hours from 18:10 local" | 2026-11-19 21:36:13 → 2026-11-20 01:34:35 (his return, `f5c3ee4d`:8178), gap | 16:36 → 20:34 | 3.97 | 2 (931, 932) |

The last period began at his queued message of 16:36 local, not at 18:10: no entry of his is recorded between it and
his return (the reader's `his messages inside 0`). The sources differ on the afternoon of 11-19: the lead declared it
an absence, while his taps and line 7527 show him answering; it is measured below as "present only by taps".

## Table
A session's working hours are the gaps between its entries that are 10 minutes or shorter, or that run under a tool
call of its own; its waiting hours are the rest of the window from its first entry, and a pending question, `js-harness
wait`, a watch or a `sleep` counts as waiting (the reader's header). Only sessions with an entry inside the window are
rows; the others are counted under the table. A row ends at its archive time where a note records one (the reader
does not read archives: the hours past it are subtracted by hand, named in the row). Figures: idle 10 / idle 30 min.
"Wait on" names the cause and where it is read; "not known" where no record says. "Stopped" marks a session that could
not run again without him or a new brief.

### Day of 2026-11-17 (7.58 h; 1 PR landed)
`--from 2026-11-17T14:28:00Z --to 2026-11-17T22:03:00Z`. `305c10e3` is left out: it holds 858 entries of `699d7c29`
by their `uuid` (copied history of the same lead, counted once).

| Session | Working h | Waiting h | Longest wait | Wait on |
|---|---|---|---|---|
| JH ORQ (699d7c29) | 0.49 / 0.74 | 7.09 / 6.84 | 4.88 h from 17:10Z, nothing | not known |
| JH 213 · senior session-roles v4 | 0.20 / 0.20 | 5.98 / 5.98 | 5.98 h from 16:04Z, nothing | not known |
| JH 212 · preguntas con opciones | 0.07 / 0.07 | 7.52 / 7.52 | 2.58 h from 19:27Z, nothing | not known |
| JH 211 · sesiones visibles | 0.01 / 0.01 | 7.57 / 7.57 | 3.00 h from 16:09Z, a task event | not known |
| Google web guidance | 0 / 0 | 7.58 / 7.58 | the whole window | not known |
| JH 207 · review gate | 0 / 0 | 7.58 / 7.58 | 4.31 h from 14:28Z, a task event | not known |
| Total, 6 sessions | 0.77 / 1.02 | 43.32 / 43.07 | | |

### Night of 2026-11-17/18 (9.23 h; the stretch opened 07:50Z; 3 PRs landed)

| Session | Working h | Waiting h | Longest wait, ended by | Wait on |
|---|---|---|---|---|
| JH 207 · review gate | 1.10 / 1.73 | 8.14 / 7.50 | 4.58 h from 10:19Z, a task event | not known: its waits ended by task events, likely its own background runs (assumed) |
| JH PLAN | 0.88 / 1.17 | 8.35 / 8.07 | 7.15 h from 08:43Z, his return | his typed words (the Plan waits on him by role) |
| JH 217 · Codex reviewer model | 0.47 / 0.47 | 8.77 / 8.77 | 8.50 h from 07:22Z, nothing | not known |
| JH ORQ (d6383aea) | 0.37 / 1.21 | 8.86 / 8.03 | 6.76 h from 09:07Z, nothing | a start: 14 of the stretch's 15 items stayed `queued`, never bound to a session (`js-harness stretch show`); a start call returned nothing (`plan-2026-11-18-away.state.md:70-77`) |
| Total, 4 sessions | 2.82 / 4.58 | 34.12 / 32.37 | | 11 more sessions have no entry inside |

`js-harness stretch show` for the same night: 9.22 of 9 h, goals 0 of 6 met, work done 0 of 15.

### Night of 2026-11-18/19 (9.49 h; miniplan 7's "eight hours"; 4 PRs landed)
Approved work: questions 359 to 362 held four sessions (Gates, 4); no session was started (`away-starts.md` reads
`none`, miniplan 7 step 3, "If nothing qualifies"); the 4 lands came at 02:54 local in one batch.

| Session | Working h | Waiting h | Longest wait, ended by | Wait on |
|---|---|---|---|---|
| JH SR · senior | 2.55 / 3.28 | 6.94 / 6.21 | 5.29 h from 10:08Z, nothing | the review-round cap: the shell reader's third and last round was rejected; a fourth is question 362, recorded 09:07Z (`return-block.md:37-38`) |
| JH ORQ (d6383aea) | 1.98 / 3.33 | 7.52 / 6.17 | 3.33 h from 09:12Z, a task event | not known (its own watch, assumed) |
| JH 234 · archive finished sessions | 1.48 / 2.07 | 8.01 / 7.43 | 6.52 h from 08:54Z, nothing | the guard: the app moved its folder to the main checkout, and every `cd` back was refused (`jh234-blocked-cwd.md:1-3`) |
| JH 228 · S8 run | 0.57 / 0.75 | 8.93 / 8.74 | 6.65 h from 08:47Z, nothing | a decision of his: question 361, recorded 06:02Z (`return-block.md:7`) |
| JH 230 · alignment audit | 0.40 / 0.81 | 9.10 / 8.68 | 3.00 h from 08:13Z, a task event | a decision of his: PR 921's D cards (`return-block.md` item 5) |
| JH PLAN | 0.14 / 0.14 | 9.35 / 9.35 | 6.25 h from 09:10Z, his return | his typed words |
| JH 229 · no carrying | 0.07 / 0.07 | 9.43 / 9.43 | 6.66 h from 08:46Z, nothing | another session: behind the senior's rule words, task 3, itself waiting on him (`return-block.md:40,47`) |
| JH 233 · Codex controlled test | 0.03 / 0.03 | 9.47 / 9.47 | 9.47 h from 05:57Z, nothing | the Codex weekly hold and his decision: question 359, recorded 05:52Z (`return-block.md:5`) |
| JH 220 · codex-spend | 0.02 / 0.02 | 9.47 / 9.47 | 7.62 h from 07:48Z, nothing | a decision of his: question 360, recorded 05:54Z (`return-block.md:6`) |
| JH 227 · Plan pre-prompt (stopped) | 0.01 / 0.01 | 9.49 / 9.49 | 6.03 h, a task event | the review-round cap: its rule missed three reads (`return-block.md:29`) |
| JH 225 · pre-commit gap (stopped) | 0.01 / 0.01 | 9.48 / 9.48 | 6.59 h, a task event | the review-round cap: three Codex reviews rejected; compacted at 07:31 local and stopped (`return-block.md:29,43`) |
| Total, 11 sessions | 7.26 / 10.52 | 97.19 / 93.92 | | 19 more sessions have no entry inside |
| Without the 2 stopped | 7.24 / 10.50 | 78.22 / 74.95 | | |

### Afternoon of 2026-11-19, present only by taps (1.44 h; 0 PRs landed)
`--from 2026-11-19T20:10:00Z --to 2026-11-19T21:36:13Z`. He was answering questions (taps of 372 and 378) and typed
line 7527; whether answering pending questions counts as being present is the sitting's: the table is here so it can.

| Session | Working h | Waiting h | Wait on |
|---|---|---|---|
| JH 236 · S8 T6 | 0.79 / 0.79 | 0.45 / 0.45 | stopped past its stop line at 16:09 local (`return-block-2.md:47`) |
| JH ORQ (d6383aea) | 0.69 / 1.43 | 0.75 / 0 | its own `js-harness wait` at idle 30 |
| JH PLAN | 0.46 / 1.44 | 0.97 / 0 | his answers (its own question call at idle 30) |
| JH 237 · PR 930 items | 0.32 / 0.32 | 0 / 0 | none |
| JH 233 · Codex controlled test | 0.27 / 0.93 | 1.17 / 0.50 | another session's message |
| JH 230 · alignment audit | 0.04 / 0.04 | 1.39 / 1.39 | another session's message |
| JH 234 · archive finished sessions | 0.01 / 0.01 | 1.43 / 1.43 | the guard and the one open `rule/` branch (`return-block-2.md:16`) |
| Total, 7 sessions | 2.58 / 4.96 | 6.16 / 3.77 | |

### Now, 2026-11-19 21:36Z to his return 2026-11-20 01:34Z (3.97 h; 2 PRs landed)
Approved work: tier 2's route worked once (JH 238, PR 932 landed); JH 239 and JH 240 were stopped for spend, not
given a second brief (`away-tier-2.md`, "Results"). Archive times from the same Results (local): JH 241 19:33, JH 238
19:40, JH 239 19:46, JH 240 19:52; JH 236 18:40 (`return-block-2.md:23`).

| Session | Working h | Waiting h | Longest wait, ended by | Wait on |
|---|---|---|---|---|
| JH PLAN | 1.93 / 2.12 | 2.04 | 1.85 h from 23:43Z, nothing | its turn, opened by his 21:34:47Z line with the 21:36:13Z one queued into it, ran to 23:43Z; then his return |
| JH ORQ (d6383aea) | 1.27 | 2.70 | 1.68 h from 21:48Z, a session's message | not known |
| JH 239 · sessions start takes a base | 1.18 | 0.13 (0.94 less 0.81 after its archive) | | stopped for spend, 25.13M of 9M (`away-tier-2.md`, 19:46) |
| JH 240 · contracts row | 1.08 | 0.34 (1.05 less 0.71) | | stopped for spend, 9.49M of 9M |
| JH 238 · owed records | 0.85 | 0.38 (1.29 less 0.91) | | none: done, then archived after PR 932 landed |
| JH 241 · away hours | 0.78 | 0.05 (1.08 less 1.03) | | none: done at 9.05M of 9M; its start call 23:31Z, first entry 23:42Z (`2b3fbe54`:3) |
| JH 237 · PR 930 items (stopped) | 0.19 | 3.79 | 3.79 h from 21:47Z, nothing | stopped past its stop line, 8.03M of 6M (`return-block-2.md:53`) |
| JH 236 · S8 T6 (stopped) | 0.08 | 1.98 (3.89 less 1.91) | | stopped past its stop line, 12.74M of 9M (`return-block-2.md:47`) |
| JH 225 · pre-commit gap (stopped) | 0.04 | 3.93 | the whole window | the review-round cap (as on the night) |
| JH 230 · alignment audit | 0.01 | 3.97 | 1.98 h, a task event | the Codex weekly hold: every D card was answered, the double read waits for the reset (`alignment-audit.md:8-16` at 47867497) |
| JH 234 · archive finished sessions | 0.01 | 3.96 | 3.94 h, a task event | the guard and the one open `rule/` branch |
| JH 227 · Plan pre-prompt (stopped) | 0.01 | 3.97 | 3.91 h, a task event | the review-round cap |
| JH 233 · Codex controlled test | 0.01 | 3.96 | 3.94 h, a task event | the Codex weekly hold (its question notice, `D--js-harness.jsonl:3755`) |
| Total, 13 sessions | 7.44 | 31.20 | | 24 more sessions have no entry inside |
| Without the 4 stopped | 7.12 | 17.53 | | |

Idle-30 figures for this period are given only where they differ in the earlier cut; the reader prints them with
`--idle 30`.

What the table cannot say: whether a session with no entry inside was open; whether a wait ended by a task event was
its own background work (work) or a watch (waiting); a running gate is counted as work even while it queued for the
lock. Measured, not assumed (a replay of `activityOf` over the five windows): no session's call spans a whole window,
so none is missing from the rows, and no gap counted as work rests on a call whose result never came; 1.74 h of the
last period is work under calls that did return.

## Gates
Each gate the records show holding work, with its hours from the tables, what already holds it, so the sitting
amends rather than adds.

1. **A start.** Three different stops: no eligible brief (night of 18/19, `away-starts.md` reads `none`), a start
   call that returned nothing (the stretch of 2026-11-18, `plan-2026-11-18-away.state.md:70-77`), and the app starting
   a session only on a turn he typed (`plan-2026-11-18-away.state.md:74-76`). Hours: JH ORQ waited 8.86 h on the night of
   17/18 with 14 of 15 items queued. Protects: his control of what runs and spends while he cannot see it. Loosens
   it: a queue of approved briefs handed to sessions already open as they finish (tier 2, `away-tier-2.md`), which
   worked once tonight. Already holds it: the miniplan as the unit of work (question 364, `alignment-audit.md:308-314`
   at 47867497). Risk: work he would not have chosen runs for hours; it is bounded only if gate 6 holds.
2. **His typed words for a rule change, and one open `rule/` branch.** Protects: his rules change only by him. Hours:
   by the record only JH 234 waited on the one-branch limit (`return-block-2.md:16`); JH 227 and JH 229 waited on
   other gates (3b, and another session). A tapped answer cannot be the quotation: `bin/lib/rules-change.mjs:234-244`
   refuses it. Loosens it: the existing path of `rule:away-autonomy`, cases he approves in his own words before he
   leaves; the typed sentence a rule change needs is asked before he goes, apart from the rule-branch wait. Already
   holds it: `js-harness rules change` and `rules check`. Risk: a sentence approved before its review settles.
3. **3a. The Codex weekly hold.** His weekly stop is 60% (question 346), with 50% and 58% operating limits
   (`miniplan-007-eight-hours-away.md:39-44`) and a later hold under 50% to the reset (`alignment-audit.md:13-16`).
   Hours: JH 233 9.47 h (night), JH 230 and JH 233 the whole last period. Loosens it: a deferred review with its terms
   written: which changes qualify, the exact head reviewed later, a debt owner and a due date, and what happens to
   findings left open; PR 921's approved budget where it applies. Already holds it: `codex-review --unavailable`, a
   debt `check`, `doctor` and the merge door list (`bin/codex-review.mjs:695` keeps it for inability to run). Risk:
   unreviewed code on main until the debt is paid.
   **3b. The review-round cap after a rejection.** JH 225 and the senior stopped on their third rejected round, JH 227's
   rule on its third read (`return-block.md:29,37`); the record says not to land that batch. Hours: JH 225 9.48, JH 227
   9.49, the senior 6.94 (night). A deferred Codex review would free none of them. Loosens it: a fourth round asked
   before he goes when a third is due while he is away (question 362 was that, recorded after he left). Already holds
   it: the round cap of `rule:double-review` and the Codex review record. Risk: rounds spent on a design that should stop.
4. **A decision of his.** Question 359 was recorded at 05:52:37Z and 360 at 05:54:03Z, minutes before he left at
   05:56Z; 361 at 06:02:13Z and 362 at 09:07:16Z, after (`D--js-harness.jsonl:3665, 3668, 3669, 3685`); all held by
   JH PLAN to his return (`return-block.md:3`). Hours held: 359, JH 233 9.47; 360, JH 220 7.62 from 07:48Z; 361, JH 228
   6.65 from 08:47Z; 362, the senior 5.29 from 10:08Z. Protects: `rule:owner-decisions`. Loosens it: the questions the
   lead can foresee asked before he goes, or answered by a case he approved in his own words (`rule:away-autonomy`); a
   default that runs on his silence has no home in today's rules. Risk: a case answered as he would not have.
5. **No next brief, and the cap of open sessions (12).** Hours: none measured on this gate alone; no refusal at the
   cap is recorded, so whether the cap held work is not known. Tier 2 shows a finished session can take a next brief
   (JH 238). Protects: the machine and his attention. Loosens it: tier-2 briefs per open session; a higher cap. Already
   holds it: `rule:work-sessions-public`. Risk: more sessions open than he can follow.
6. **The Claude stop line.** Five of five sessions measured on 2026-11-19 passed theirs (`return-block-2.md:55`):
   JH 236 and JH 237 waited 1.98 h and 3.79 h stopped in the last period, and JH 238 took a second brief at 8.54M of a
   6M line (`away-tier-2.md`, 19:18). Gates 1 and 5 rely on this line holding. Protects: the Claude week. Loosens it:
   the ROADMAP item "A spend check: a session reads its cache-read sum against its stop line before each step",
   carrying the approved budget left across a hand-over, and no new brief to a session already past its line. Already
   holds it: each brief's stop line and the lead's gate (`away-tier-2.md`, 19:46). Risk: spend past the estimate.
7. **The guard's cwd check.** JH 234 waited 6.52 h (night) and the whole last period. The guard takes a session's own
   worktree from git and from the session's current folder (`bin/lib/worktrees.mjs:231-237, 269-277`); the app moved
   JH 234's folder to the main checkout (`jh234-blocked-cwd.md:1-2`), so its own worktree read as another's. Loosens
   it: not his alone: a security item (`AGENTS.md`, high risk); the fix restores or verifies the session's authorized
   worktree when the app moves it, with the moved-folder case in the guard's tests, and keeps refusing other sessions'
   worktrees when ownership is uncertain. Already holds it: the guard. Risk: one session writes on another's branch.

Existing homes for the measurement itself: the ROADMAP item "A stretch's lost time counts only failed gates … Idle
time read from `waiting` notices counts too" (owner JH 208), the reserve item `lost-time` of
`plan-2026-11-18-away.json:156`, and the item "Stalled-session detection". JH 240 opened draft PR 935 on the first
of these, in `bin/stretch.mjs`, reading `waiting` notices (`away-tier-2.md`, 19:52); this reader reads transcripts,
with its own split rule and idle limit. Question 364 retired `stretch` for new work once plan v4 closes and made the
miniplan, measured by its land records, the unit (`alignment-audit.md:308-314` at 47867497). So this reader proposes
no home: which measurement the miniplan's land records need, and whether PR 935 or this reader is kept, is the
sitting's.

## His to decide
From the tables, in the sitting at his return (miniplan 10), one decision a question:
1. Whether a queue of approved briefs is left before he goes, for open sessions to take as they finish (gate 1, 5).
2. Whether, with it, a session past its stop line takes no new brief, checked before each step (gate 6).
3. Whether a branch may land with its Codex review deferred while he is away, and on which written terms (gate 3a).
4. Whether a fourth review round is asked before he goes when a third may fall while he is away (gate 3b).
5. Whether the questions the lead can foresee, and the typed sentence a rule change needs, are asked before he goes
   (gate 2, 4).
6. Who owns the guard's fix for a moved folder (gate 7, a security item).
7. The cap of open sessions (gate 5), and the Codex spend of this work's own review (held to the reset).
8. The acceptance check of the next absence: at the return, each approved brief is shown done, advanced or blocked,
   with its commits or goal check, and at least one hand-over and its work are checked against the approved plan.

## What the double read changed
Read `9ebe3e0d` (Claude on claude-opus-5-5, Codex on the model of `rule:review-model`, blind, one frozen copy at cb9cdc77): 26 findings,
7 high; all taken, recorded with `js-harness double-review take`.
- Both readers: progress measured by output, not hours, and his whole sentence with tier 2's result (claude 1, 2;
  codex 1); the per-gate causes and question times (claude 5, 10; codex 3); gate 3 split (claude 4; codex 8); the
  missing periods (claude 8; codex 5); the done-when (claude 6; codex 12); archive times and stopped sessions in the
  denominator (claude 3; codex 2).
- Claude alone: PR 935 named (7); gates and decisions matched, gates 6 and 7 added (9); the turn's opening line (11);
  ROADMAP items cited by their words (12); measured to his return (13).
- Codex alone: no home proposed against question 364 (4); copied history counted once, the reader's commit named (6);
  the three kinds of start stop (7); the stop line as a dependency (9); a tapped answer is not a quotation (10); the
  guard's real signal (11); exact timestamps (13).
- Unguaranteed: archive hours are subtracted by hand from notes written to the minute; wait causes come from the
  lead's notes and the question notices, not from every notify record; the reader's figures come from the commit
  that holds this document (`workshop/lib/away-hours.mjs` unchanged since c6961b66) over transcripts that later
  appends can lengthen, and a gap is judged up to the next entry even past the cut; the lands per hour are a rate
  over few periods, not a trend.

## Tasks
- [x] T1 (kind: build) The reader `workshop/lib/away-hours.mjs`, test first: spec 1. Commit: this branch.
- [x] T2 (kind: docs) The periods, the table and the gates in this document. Commit: this branch.
- [x] T3 (kind: docs) The answers to double read `9ebe3e0d`. Commit: this branch.

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
  (`<slug>-site`); sessions here start in the checkout or a worktree, so the table loses none of tonight's rows.
- L6 Codex review of the reader held to the reset of 2026-11-23 23:45 (miniplan 10, "Budget").
- L7 Double read `9ebe3e0d` answered by JH 242 (question 380, "Revisarla ahora (Recomendada)", tapped): all 26
  taken. The reader's suspected faults (codex 2, 6) were replayed over the five windows: no spanning call, no gap
  counted as work on a missing result; the copied ORQ history (`305c10e3`, 858 and 825 shared `uuid`s with `699d7c29`
  and `d6383aea`) touched only the 2026-11-17 day, fixed in the table. So the reader is unchanged.

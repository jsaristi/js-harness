# Away hours produce work: the measurement

## State
Measured up to his return, `2026-11-20T01:34:35.184Z` (`f5c3ee4d`:8178), and answered to two double reads: `9ebe3e0d`
(26 findings) and the confirming read `ff2b252d` (26 findings); see "What the double reads changed". Nothing is cured
here. His order had two parts (Why): the cure in depth is the sitting at his return, which decides from "His to
decide"; the part to begin at once was the lead's tier 2 (`away-tier-2.md`, lead's notes folder `local_41e31b68…`).
What tier 2 established, and no more: a message reached JH 238 while its turn was still running (`isRunning true`,
`away-tier-2.md:68`) and it did the brief on its own branch and PR (PR 932, landed); JH 238 had already passed its
first stop line (8.54M of 6M, `away-tier-2.md:69`), and so had every other session measured that day. Waking a session
whose turn had ended, on a new branch from main, was not tried. T4 is done: the reader's fixes (JH 243) and the tables
from its output (JH 249). Open: the wait causes marked "not known"; the reader's Codex review, held.

## Goal
Measure, per away period, what was produced (approved work done, advanced or blocked; pull requests landed) and how
long each session worked and waited and on what, so the sitting at his return decides the cure from figures.

## Why
He typed in JH PLAN (transcript `f5c3ee4d`, line 7927, `2026-11-19T21:36:13Z`, read with `js-harness sessions --quote`,
queued into the turn his line 7904 opened at `21:34:47Z`): "Si pero quiero que corrijas eso de que no avanzamos cuando
quedas solo y cuando venga vamos a solucionar completamente y a profundidad eso para que no nos vuelve a suceder pero
quiero que lo comiences a implementar de una vez para que avancemos ahora que voy a estar ausente". Two orders: the
cure, at his return; the beginning, now (tier 2, State).

What he means by "avanzar", from his earlier words (searched: his entries by `quoteEntry` dated from 2026-11-14 in the
transcripts of the project's folders, for `no avanz|avanc|avanza|quedas? solo|ausente|me voy|cuando no estoy`; the
count of hits moves as transcripts grow, so it is not given): progress on the pending tasks, not hours.
`f5c3ee4d`:7527 (`2026-11-19T20:22Z`): "en que avanzaste osea de las tareas que teniamos pendientes";
`69918425`:15446 (`2026-11-15T15:22Z`): "casi no avanzamos debe haber una forma de mitigar esto"; and after this
measurement's cut, `f5c3ee4d`:8429 (`2026-11-20T04:11Z`): "como hacemos para avanzar lo que mas importa". So the
approved work leads every period below; lands and hours explain it.

## Done when
- `node --test workshop/lib/away-hours.test.mjs` exits 0
- `npm run check` exits 0
- `node -e "const t=require('fs').readFileSync('odd/tasks/away-work.md','utf8');for(const h of ['Table','Gates','His to decide','What the double reads changed'])if(!new RegExp('^## '+h+'$','m').test(t))process.exit(1);const s=t.split(/^### /m).slice(1).map(x=>x.split(/^## /m)[0]);if(s.length<5||!s.every(x=>/^\| Total/m.test(x)&&/^\| JH /m.test(x)))process.exit(1)"` exits 0
- The draft pull request is open and the lead has a `note` notice naming it and its head (`ready` refuses a draft).

## In scope / Out of scope
- In: this document; `workshop/lib/away-hours.mjs` and its test, new, read-only, wired into nothing.
- Out: any rule, the guard, the reply check, settings, `CLAUDE.md`, `AGENTS.md`, `docs/ROADMAP.md`,
  `docs/FAILURES.md`, `check`/`doctor`/merge-door rows, and the files JH 234, JH 225, the senior, JH 239 and JH 240 hold
  (miniplan 10, "Do not").

## Constraints
- He is away (`rule:away-autonomy`): nothing is asked; what is his goes under "His to decide".
- Codex: the reader's code review is held to the reset of 2026-11-23 23:45 (recorded 2026-11-19 as held). This
  document's double reads ran on his answer to question 380 ("Revisarla ahora (Recomendada)", tapped, `f5c3ee4d`:8327):
  `9ebe3e0d` measured 1.08M tokens of Claude and 2.78M of Codex against an estimate of 1.1M and 0.9M
  (`away-work-read-9ebe3e0d.txt:2,4`); `ff2b252d` followed on the lead's order.

## Ask me before
Every item of "His to decide"; none is acted on here.

## Depth pass
- 1. Method: measure from records with a stated rule and a stated sensitivity, as a time study does: approved work
  first, then lands on main, then the split of work from waiting, written in the reader's header, every total at two
  idle limits (10 and 30 minutes). The smallest change: one read-only reader, no new command.
- 2. Raw material: the transcripts of the project's folders under `~/.claude/projects` (his entries by `quoteOf`'s
  rule, `bin/lib/person-times.mjs:11`); the absence limit `ABSENCE_MS` (`bin/lib/return-report.mjs:34`); `git log
  origin/main --first-parent --merges`; the board (`~/.js-harness/channel/D--js-harness.jsonl`); `js-harness stretch
  show`; the notes `return-block.md`, `return-block-2.md`, `away-starts*.md`, `away-tier-2.md`, `jh234-blocked-cwd.md`,
  `plan-2026-11-18-away.state.md`, `miniplan-007-eight-hours-away.md` in the lead's notes folder.
- 3. The bar:
  spec 1: `node workshop/lib/away-hours.mjs --since 2026-11-17T12:00:00Z --now 2026-11-20T01:35:00Z --root D:/js-harness`:
  none before, new behaviour (`stretch show` gives a span from start to close, and lost time only from failed gates,
  `bin/lib/stretch.mjs:283-324`).
- 4. Refutation: the cheapest test that the complaint does not hold is that the absences advanced the approved work.
  They did not: the stretch of 2026-11-18 did 0 of its 15 items (`js-harness stretch show`; one earlier task, JH 207's
  T7, finished and waited for his word), the night of 18/19 started nothing (`away-starts.md`), and the last period's
  approved S8 T6 (`f5c3ee4d`:7721) is still a draft with items open (PR 930). Lands agree in kind: 0.13 to 0.50 an
  hour away against 0.59 present (Periods), and a land's time is not when its work was done. Hours: on the night of
  18/19 the 11 sessions with an entry inside worked 6.80 h of 104.45 session-hours, 6.78 of 94.96 without JH 220,
  closed before it began; of what worked, only the lead could run with nobody's answer (Table, by state).
  Verdict: supports
- 5. Request: as miniplan 10 asks, with one correction from item 2: the four periods it names are not four absences
  by the record (see "Periods").
  Adds: none

## Periods
His absences are gaps between two of his entries (typed, queued or tapped) longer than `ABSENCE_MS`, 2 hours, read
from transcript gaps at their full timestamps, each interval `[from, to)`; the four away rows' bounds and hours are the
absences the Table's base command prints, the present rows the time between them. Command as in spec 1 (idle 10 min;
`--idle 30` for the second figure; a period as `--from <from> --to <to>`). Lands: `git log origin/main --first-parent
--merges --since=<from> --until=<to> --format='%cI %s'`, each pull request counted once, in the period of its first
merge (903, 924 and 925 merged twice).

| Period (miniplan 10's name) | UTC, from his entries | Local (UTC-5) | Hours | PRs landed |
|---|---|---|---|---|
| away (not named) | 2026-11-17 14:28:40 → 22:03 | 09:28 → 17:03 | 7.58 | 1 (906) |
| present | 2026-11-17 22:03 → 2026-11-18 06:38 | 17:03 → 01:38 | 8.58 | 4 (905, 903, 907, 908) |
| away (not named; the stretch of 07:50Z) | 2026-11-18 06:38 → 15:52 | 01:38 → 10:52 | 9.23 | 3 (909, 910, 911, one batch at 02:24 local) |
| present | 2026-11-18 15:52 → 2026-11-19 05:56 | 10:52 → 00:56 | 14.05 | 8 (912, 902, 913, 914, 915, 917, 918, 919) |
| "the evening of 2026-11-18" | inside "present": his entries `19:57:51Z` and `21:41:47Z` (`f5c3ee4d`:3064, :3286) are 1.73 h apart | 14:57 → 16:41 | 1.73 | |
| away, "the night of 2026-11-18 to 19" | 2026-11-19 05:56 → 15:25 | 00:56 → 10:25 | 9.49 | 4 (916, 920, 922, 924, one batch at 02:54 local) |
| present | 2026-11-19 15:25 → 21:36:13 | 10:25 → 16:36 | 6.17 | 5 (923, 925, 926, 928, 929) |
| "the afternoon of 2026-11-19" | inside "present": declared away from 15:10 local (`return-block-2.md:1`), yet he typed (`f5c3ee4d`:7527, :7563, :7721) and tapped (372, 378) | 15:10 → 16:36 | 1.44 | 0 |
| away, "now, about 3 hours from 18:10 local" | 2026-11-19 21:36:13 → 2026-11-20 01:34:35 | 16:36 → 20:34 | 3.97 | 2 (931, a session summary; 932, owed records) |

Rates: away 0.13, 0.33, 0.42 and 0.50 PRs an hour; present 17 in 28.80 h, 0.59 an hour.

## Table
A session's working hours are the gaps between its entries that are 10 minutes or shorter, or that run under a tool
call of its own; its waiting hours are the rest of the window from its first entry, and a pending question, `js-harness
wait`, a watch or a `sleep` counts as waiting (the reader's header). Only sessions with an entry inside the window are
rows. Every hour is the reader's, from the base command: `node workshop/lib/away-hours.mjs --since
2026-11-17T12:00:00Z --now 2026-11-20T01:35:00Z --root D:/js-harness --idle <10|30> --archive 2b3fbe54=2026-11-20T00:33:00Z
--archive e4f84f70=2026-11-20T00:40:00Z --archive 649d37ed=2026-11-20T00:46:00Z --archive 371fb425=2026-11-20T00:52:00Z
--archive 37723703=2026-11-19T23:40:00Z --json`, run 2026-11-20 by JH 249; each section names its absence and the
digest printed. Figures: idle 10 / idle 30 min. Launch is the time an app start call took to return, neither work nor
waiting; working, waiting and launch add up to the session's span. Gate-lock queue time is in waiting, copied history
is counted once by `uuid`, and a session ends at its archive time. By hand, from the notes: the archive times given to
`--archive`, each row's state, "his return" where the reader names an attachment entry, and the totals by state, which
are sums of the reader's rows grouped by those states. Each row carries a state from the records: closed, stopped at a
cap, stopped for spend, done, waiting on him (a decision, a hold or the guard), another session, runnable.

### Day of 2026-11-17, away (7.58 h)
Command: the base command, absence 1 of its output (`--idle 10` digest `a5eb033c4dea0b9a`, `--idle 30` digest `a5eb033c4dea0b9a`). Approved work: not known (no plan record for the day). `305c10e3` holds 858 entries of `699d7c29` by `uuid`, copied history of the same lead: the reader counts them once, in the older transcript, so `305c10e3` has no entry inside. JH ORQ's launch: its start call at 14:34:15Z (`699d7c29`:10283) returned at 15:52:14Z (:10295), starting JH 213.

| Session | Working h | Waiting h | Launch h | Longest wait at idle 10, ended by | State, wait on |
|---|---|---|---|---|---|
| JH ORQ (699d7c29) | 0.48 / 0.48 | 5.81 / 5.81 | 1.3 | 4.89 h from 17:10Z, an entry of type attachment (output_style) (his return, by hand) | runnable; not known |
| JH 213 · senior: session-roles v4 | 0.2 / 0.2 | 5.99 / 5.99 | 0 | 5.99 h from 16:04Z, nothing before the end | not known |
| JH 212 · preguntas siempre con opciones | 0.07 / 0.07 | 7.51 / 7.51 | 0 | 2.59 h from 19:27Z, nothing before the end | not known |
| JH 211 · el orquestador abre todas las sesiones | 0.01 / 0.01 | 7.57 / 7.57 | 0 | 3 h from 16:09Z, an event of the app or a task | not known |
| JH 207 · una puerta de revisión honesta | 0 / 0 | 7.58 / 7.58 | 0 | 4.3 h from 14:28Z, an event of the app or a task | not known |
| Total, 5 sessions | 0.76 / 0.76 | 34.46 / 34.46 | 1.3 | | 3 more sessions have no entry inside |

### Night of 2026-11-17/18, away (9.23 h; the stretch opened 07:50Z)
Command: the base command, absence 2 of its output (`--idle 10` digest `a5eb033c4dea0b9a`, `--idle 30` digest `a5eb033c4dea0b9a`). Approved work: the stretch's 15 items, 0 done, 14 never bound to a session (`js-harness stretch show`: goals 0 of 6); one earlier task finished: JH 207's PR 902 T7, waiting for his word (`plan-2026-11-18-away.state.md:73`). JH ORQ's start call at 07:51:24Z (`d6383aea`:1506), which the notes say returned nothing (`plan-2026-11-18-away.state.md:70-72`), returned at 16:46:38Z (:1509), after his return, starting JH 218: its 8.03 h are launch, so its longest wait is 0.4 h, no longer 6.76 h.

| Session | Working h | Waiting h | Launch h | Longest wait at idle 10, ended by | State, wait on |
|---|---|---|---|---|---|
| JH 207 · una puerta de revisión honesta | 1.09 / 1.66 | 8.14 / 7.58 | 0 | 4.58 h from 10:19Z, an event of the app or a task | done (T7), waiting on his word |
| JH PLAN | 0.88 / 1.17 | 8.35 / 8.07 | 0 | 7.15 h from 08:43Z, an entry of type attachment (output_style) (his return, by hand) | waiting on him by role |
| JH 217 · Codex reviewer model | 0.47 / 0.47 | 8.77 / 8.77 | 0 | 8.5 h from 07:22Z, nothing before the end | not known |
| JH ORQ (d6383aea) | 0.37 / 1.2 | 0.84 / 0 | 8.03 | 0.4 h from 06:44Z, an event of the app or a task | runnable; its start call returned after his return (above) (825 copied entries left out) |
| Total, 4 sessions | 2.81 / 4.5 | 26.1 / 24.42 | 8.03 | | 11 more sessions have no entry inside |

### Night of 2026-11-18/19, away (9.49 h)
Command: the base command, absence 3 of its output (`--idle 10` digest `a5eb033c4dea0b9a`, `--idle 30` digest `a5eb033c4dea0b9a`). Approved work: JH 228's PR 924 ready (`D--js-harness.jsonl:3678`), landed at 02:54 local with 916, 920, 922; no session started (`away-starts.md`: `none`); questions 359 to 362 held what came next (Gates, 4).

| Session | Working h | Waiting h | Launch h | Longest wait at idle 10, ended by | State, wait on |
|---|---|---|---|---|---|
| JH SR · senior | 2.55 / 3.28 | 6.94 / 6.21 | 0 | 5.29 h from 10:08Z, nothing before the end | stopped at a cap: third round rejected; a fourth is question 362 (`return-block.md:37-38,40`) |
| JH ORQ (d6383aea) | 1.66 / 3.01 | 7.84 / 6.49 | 0 | 3.33 h from 09:12Z, an event of the app or a task | runnable; not known (its own watch, assumed) (gate lock 0.31 h in waiting; 825 copied entries left out) |
| JH 234 · finished sessions are always archived | 1.34 / 1.76 | 8.15 / 7.74 | 0 | 6.52 h from 08:54Z, nothing before the end | waiting on the guard (`jh234-blocked-cwd.md:3-4`) (gate lock 0.31 h in waiting) |
| JH 228 · S8 run: price the rows first | 0.57 / 0.68 | 8.93 / 8.81 | 0 | 6.65 h from 08:47Z, nothing before the end | done (PR 924); its next work is question 361's |
| JH 230 · alignment audit against today's directi | 0.4 / 0.81 | 9.1 / 8.68 | 0 | 3 h from 08:13Z, an event of the app or a task | waiting on him: PR 921's D cards (`return-block.md` item 5) |
| JH PLAN | 0.14 / 0.14 | 9.35 / 9.35 | 0 | 6.25 h from 09:10Z, an entry of type attachment (output_style) (his return, by hand) | waiting on him by role |
| JH 229 · a session never makes him carry informa | 0.07 / 0.07 | 9.43 / 9.43 | 0 | 6.66 h from 08:46Z, nothing before the end | another session: the senior's task 3 (`return-block.md:40,47`) |
| JH 233 · controlled test of the Codex reviewer | 0.03 / 0.03 | 9.47 / 9.47 | 0 | 9.47 h from 05:57Z, nothing before the end | waiting on him: question 359 (`return-block.md:5`) |
| JH 220 · codex-spend T3 and T5 | 0.02 / 0.02 | 9.47 / 9.47 | 0 | 7.62 h from 07:48Z, nothing before the end | closed at `05:53:10Z`, before the period (`D--js-harness.jsonl:3667`) |
| JH 227 · the Plan becomes the lead's pre-prompt | 0.01 / 0.01 | 9.49 / 9.49 | 0 | 6.03 h from 05:56Z, an event of the app or a task | stopped at a cap: its rule's third read (`return-block.md:29`) |
| JH 225 · pre-commit passes a docs-only conventio | 0.01 / 0.01 | 9.48 / 9.48 | 0 | 6.59 h from 05:56Z, an event of the app or a task | stopped at a cap; compacted at 07:31 local (`return-block.md:29,43`) |
| Total, 11 sessions | 6.8 / 9.82 | 97.65 / 94.62 | 0 | | 19 more sessions have no entry inside |
| Total by state, idle 10 (sums of the rows above) | closed 0.02; cap 2.57; on him 1.14; guard or another 1.41; runnable 1.66 | closed 9.47; cap 25.91; on him 36.85; guard or another 17.58; runnable 7.84 | closed 0; cap 0; on him 0; guard or another 0; runnable 0 | | |

### Afternoon of 2026-11-19, present (1.44 h)
Command: the base command with `--from 2026-11-19T20:10:00Z --to 2026-11-19T21:36:13Z` (`--idle 10` digest `a5eb033c4dea0b9a`, `--idle 30` digest `a5eb033c4dea0b9a`): the lead's declared absence, measured so the sitting can compare: he typed and tapped inside it.

| Session | Working h | Waiting h | Launch h | Longest wait at idle 10, ended by | State, wait on |
|---|---|---|---|---|---|
| JH 236 · S8 T6, the long-session grader fixes | 0.79 / 0.79 | 0.45 / 0.45 | 0 | 0.45 h from 21:09Z, nothing before the end | stopped for spend at 16:09 local (`return-block-2.md:47`) (archived 23:40Z) |
| JH ORQ (d6383aea) | 0.69 / 1.43 | 0.75 / 0.01 | 0 | 0.35 h from 20:33Z, a message of another session | runnable (825 copied entries left out) |
| JH PLAN | 0.37 / 0.8 | 1.01 / 0.58 | 0.06 | 0.35 h from 20:32Z, its own wait call: AskUserQuestion | on him (its own question call) |
| JH 237 · S8 T6, finish PR 930's two open items | 0.32 / 0.32 | 0 / 0 | 0 | 0 h from 21:20Z, its own wait call: Bash sleep 1; echo waiting | runnable |
| JH 233 · controlled test of the Codex reviewer | 0.27 / 0.93 | 1.17 / 0.51 | 0 | 0.37 h from 20:32Z, a message of another session | another session's message |
| JH 230 · alignment audit against today's directi | 0.04 / 0.04 | 1.39 / 1.39 | 0 | 0.65 h from 20:35Z, a message of another session | another session's message |
| JH 234 · finished sessions are always archived | 0.01 / 0.01 | 1.43 / 1.43 | 0 | 1.43 h from 20:10Z, nothing before the end | the guard and the one open `rule/` branch (`return-block-2.md:16`) |
| Total, 7 sessions | 2.49 / 4.32 | 6.2 / 4.37 | 0.06 | | 26 more sessions have no entry inside |

### Now, 2026-11-19 21:36:13Z to his return, away (3.97 h)
Command: the base command, absence 4 of its output (`--idle 10` digest `a5eb033c4dea0b9a`, `--idle 30` digest `a5eb033c4dea0b9a`). Approved work: the S8 T6 he authorized (`f5c3ee4d`:7721) stayed a draft with items open (PR 930, `D--js-harness.jsonl:3761`); tier 2 gave JH 238 one brief (owed records, PR 932, landed). From his departure to the first brief handed over: 2.45 h, by hand (21:36Z to the hand-over at 19:03 local, `away-tier-2.md:68`). Archive times, the base command's `--archive` inputs, by hand from `away-tier-2.md` "Results" (local, UTC-5, to the minute): JH 241 19:33, JH 238 19:40, JH 239 19:46, JH 240 19:52; JH 236 18:40 (`return-block-2.md:23`). JH PLAN's launch, 1.95 h: three start calls at 21:41:23Z to 21:41:40Z (`f5c3ee4d`:8019-8021) answered from 23:26:03Z (:8032), and one at 23:31:04Z (:8134) answered at 23:42:29Z (:8136), overlapping starts counted once.

| Session | Working h | Waiting h | Launch h | Longest wait at idle 10, ended by | State, wait on |
|---|---|---|---|---|---|
| JH 239 · sessions start takes a base | 1.18 / 1.18 | 0.14 / 0.14 | 0 | 0.14 h from 00:37Z, nothing before the end | stopped for spend: 25.13M of 9M, the lead's one-off sum, unverified (`return-block-2.md:55`) (archived 00:46Z) |
| JH 240 · the contracts row reads a stacked branc | 1.12 / 1.12 | 0.29 / 0.29 | 0 | 0.17 h from 00:41Z, nothing before the end | stopped for spend: 9.49M of 9M at the stop (`away-tier-2.md`, 19:46) (gate lock 0.13 h in waiting; archived 00:52Z) |
| JH ORQ (d6383aea) | 1 / 1.19 | 2.97 / 2.78 | 0 | 1.68 h from 21:48Z, a message of another session | runnable; the cause of its 1.68 h wait from 21:48Z not known (gate lock 0.26 h in waiting; 825 copied entries left out) |
| JH 238 · owed records: Seen lines and ticks | 0.85 / 0.85 | 0.38 / 0.38 | 0 | 0.38 h from 00:17Z, nothing before the end | done, archived after PR 932 landed (archived 00:40Z) |
| JH 241 · away hours produce work | 0.78 / 0.78 | 0.06 / 0.06 | 0 | 0.05 h from 00:29Z, nothing before the end | done, past its 9M line by 0.05M; start call 23:31Z, first entry 23:42Z (`2b3fbe54`:3) (archived 00:33Z) |
| JH 237 · S8 T6, finish PR 930's two open items | 0.19 / 0.19 | 3.79 / 3.79 | 0 | 3.79 h from 21:47Z, nothing before the end | stopped for spend: 8.03M of 6M (`return-block-2.md:53`) |
| JH PLAN | 0.17 / 0.17 | 1.85 / 1.85 | 1.95 | 1.85 h from 23:43Z, an entry of type attachment (output_style) (his return, by hand) | runnable; its turn ran to 23:43Z, then his return |
| JH 236 · S8 T6, the long-session grader fixes | 0.08 / 0.08 | 1.98 / 1.98 | 0 | 1.89 h from 21:36Z, a message of another session | stopped for spend: 12.74M of 9M (`return-block-2.md:47`) (archived 23:40Z) |
| JH 225 · pre-commit passes a docs-only conventio | 0.04 / 0.04 | 3.93 / 3.93 | 0 | 3.93 h from 21:36Z, an event of the app or a task | stopped at a cap |
| JH 230 · alignment audit against today's directi | 0.01 / 0.01 | 3.97 / 3.97 | 0 | 1.98 h from 21:36Z, an event of the app or a task | waiting on the Codex hold: the D cards answered, its double read waits for the reset (`alignment-audit.md:8-16` at 47867497) |
| JH 234 · finished sessions are always archived | 0.01 / 0.01 | 3.96 / 3.96 | 0 | 3.94 h from 21:36Z, an event of the app or a task | waiting on the guard and the one open `rule/` branch |
| JH 227 · the Plan becomes the lead's pre-prompt | 0.01 / 0.01 | 3.97 / 3.97 | 0 | 3.91 h from 21:36Z, an event of the app or a task | stopped at a cap |
| JH 233 · controlled test of the Codex reviewer | 0.01 / 0.01 | 3.96 / 3.96 | 0 | 3.94 h from 21:36Z, an event of the app or a task | not known: question 359 runs after the reset (`D--js-harness.jsonl:3665`); its effort question (:3755) was answered before the window (`f5c3ee4d`:7721) |
| Total, 13 sessions | 5.45 / 5.64 | 31.25 / 31.06 | 1.95 | | 24 more sessions have no entry inside |
| Total by state, idle 10 (sums of the rows above) | done 1.63; spend 2.57; cap 0.05; on him 0.03; runnable 1.17 | done 0.44; spend 6.2; cap 7.9; on him 11.89; runnable 4.82 | done 0; spend 0; cap 0; on him 0; runnable 1.95 | | |

What the table cannot say: whether a session with no entry inside was open; whether a wait ended by a task event was
its own background work or a watch; a call still running at a transcript's end, whose result is not written yet, reads
as a wait (the reader's header).

## Gates
Each gate the records show holding work; each wait-hour is counted under one gate; what already holds it, so the
sitting amends rather than adds.

0. **From his departure to the first approved brief.** Night of 18/19: no brief at all; last period: 2.45 h (by hand,
   from the notes), in which JH PLAN's start calls took 1.95 h to return (launch, the Table's base command). This is
   the cost his "de una vez" names.
1. **A start.** Three different stops: no eligible brief (night of 18/19, `away-starts.md`), a start call that
   returned nothing by the notes (2026-11-18, `plan-2026-11-18-away.state.md:70-72`) and by the transcript returned
   at 16:46Z, after his return (`d6383aea`:1506, :1509), and the app starting a session only on a turn he typed
   (`plan-2026-11-18-away.state.md:74-76`). Hours: JH ORQ 8.03 h of launch on the night of 17/18 (Table). Protects: his control
   of what runs and spends while he cannot see it. Loosens it: a queue of approved briefs for open sessions (tier 2),
   tried once on a running turn only (State). Already holds it: the miniplan as the unit of work (question 364,
   `alignment-audit.md:308-314` at 47867497). Risk: work he would not have chosen runs for hours; bounded only if
   gate 6 holds.
2. **His typed words for a rule change, and one open `rule/` branch.** Hours: by the record only JH 234 on the
   one-branch limit (`return-block-2.md:16`). Facts: a tapped answer cannot be the quotation
   (`bin/lib/rules-change.mjs:239-241`), and `AGENTS.md` asks for the owner's quoted words. Two separate choices are his
   (His to decide, 5 and 6). Already holds it: `js-harness rules change` and `rules check`.
3. **3a. The Codex weekly hold.** His weekly stop is 60% (question 346), with 50% and 58% operating limits
   (`miniplan-007-eight-hours-away.md:39-44`) and a later hold under 50% to the reset (`alignment-audit.md:13-16`).
   Cost: finished drafts that cannot land: PRs 930, 933, 934 and 935 with Codex owed (`away-tier-2.md:73-78`,
   `return-block-2.md:41`); JH 230's hours are the hold too, but a deferred land would not free it (its next step is a
   double read). Today's controls do not hold a deferred land: `--unavailable` is for a review that cannot run
   (`bin/codex-review.mjs:690`), admitted for push coverage as a skip (`bin/lib/codex-review-rows.mjs:260`). Loosens
   it: a separate deferral record carrying base and head, owner, due date, which changes qualify and what an overdue
   or rejected review does. Risk: unreviewed code on main until the debt is paid.
   **3b. The review-round cap after a rejection.** Hours: JH 225 9.48, JH 227 9.49, the senior 6.94 (night). A
   deferred Codex review would free none. The fourth round he approved (question 362) was rejected too, at 14.56M
   against 5M (`return-block-2.md:13`). Loosens it, to compare with stopping or handing a narrowed design to a fresh
   session: a fourth round asked before he goes, with a scoped change, an exit check and a spend bound. Already holds
   it: the round cap of `rule:double-review`.
4. **A decision of his.** Question 359 recorded at `05:52:37Z` and 360 at `05:54:03Z`, minutes before he left at
   05:56Z; 361 at `06:02:13Z` and 362 at `09:07:16Z`, after (`D--js-harness.jsonl:3665, 3668, 3669, 3685`); 359 to 361
   held by JH PLAN (`return-block.md:3`), 362 recorded by JH SR (`return-block.md:38`). Hours: 359, JH 233 9.47; 362,
   counted under 3b; 360's JH 220 had closed and 361's JH 228 was done, so neither held a running task. Protects:
   `rule:owner-decisions`. Loosens it: the questions the lead can foresee asked before he goes, or answered by a case
   he approved in his own words (`rule:away-autonomy`); a default that runs on his silence has no home in today's
   rules. Risk: a case answered as he would not have.
5. **No next brief, and the cap of open sessions (12).** The cap was full on the evening of 2026-11-19: "slot 12 of
   12", one archive owed for the fresh senior (`away-tier-2.md:65`); that morning 15 sessions were open
   (`return-block.md:46`), and how they relate to the cap is not known. His order to close sessions when they finish
   (`f5c3ee4d`:5712) frees slots before any cap change. Protects: the machine and his attention. Already holds it:
   `rule:work-sessions-public`.
6. **The Claude stop line.** Seven of seven sessions measured on 2026-11-19 passed theirs, JH 240 and JH 241 by a little
   (`return-block-2.md:55`); JH 238 took a second brief at 8.54M of 6M. Spend is read at different moments: JH 240's
   9.49M at its stop became 11.22M by his return (the read `ff2b252d`, codex 4). Hours: 6.20 h waiting stopped for
   spend in the last period (Table, total by state). Loosens it: the ROADMAP item "A spend check: a session reads its cache-read sum against
   its stop line before each step", extended so the next step must fit what is left, and it stops when that is not
   known; no brief to a session past its line. Risk: spend past the estimate.
7. **The guard's cwd check.** JH 234 waited 6.52 h (night) and the whole last period. The guard takes a session's own
   worktree from git and from its current folder (`bin/lib/worktrees.mjs:231-237, 269-277`); the app moved JH 234's
   folder to the main checkout (`jh234-blocked-cwd.md:3`) and the guard then refused its `cd` back (:4). Loosens it:
   not his alone: a security item (`AGENTS.md`, high risk); the fix restores or verifies the session's authorized
   worktree when the app moves it, with that case in the guard's tests, and keeps refusing others' worktrees.

Existing homes for the measurement itself: the ROADMAP item "A stretch's lost time counts only failed gates … Idle
time read from `waiting` notices counts too" (owner JH 208), the reserve item `lost-time` of
`plan-2026-11-18-away.json:156`, and the item "Stalled-session detection". No branch implements the first: PR 935
changes the contracts row (`git diff --name-status 3d89c373...5c3344d5`: `bin/contract.mjs`, its test, the ROADMAP,
`odd/tasks/contract-row-stacked.md`). Question 364 retired `stretch` for new work once plan v4 closes and made the
miniplan, measured by its land records, the unit (`alignment-audit.md:308-314` at 47867497); which measurement those
records need is the sitting's.

## His to decide
From the tables, in the sitting at his return (miniplan 10), one decision a question:
1. Whether a queue of approved briefs is left before he goes, handed out within a time he sets (gates 0, 1, 5).
2. Whether a session past its stop line takes no new brief, and each step must fit what is left (gate 6).
3. Whether a branch may land with its Codex review deferred while he is away, and on which written terms (gate 3a).
4. Whether a fourth review round is asked before he goes, or a third rejection stops and hands off (gate 3b).
5. Whether a rule change may wait as a recorded order instead of his typed words (gate 2; against it: a tap is
   refused as a quotation, and `AGENTS.md` asks for his quoted words).
6. Whether the questions the lead can foresee, and the typed sentence a rule change needs, are asked before he goes
   (gates 2, 4).
7. Who owns the guard's fix for a moved folder (gate 7, a security item).
8. The cap of open sessions, after measuring what closing finished sessions frees (gate 5).
9. The acceptance check of the next absence, agreed before he leaves: the priority briefs named, each one's starting
   state, and at the return what changed, the deliverable or failed check and what still blocks it; lands shown apart.

## What the double reads changed
Read `9ebe3e0d` (Claude on claude-opus-5-5, Codex on the model of `rule:review-model`, blind, one frozen copy at
cb9cdc77): 26 findings, all taken. Read `ff2b252d` (frozen at 36a55f76): 26 findings, all taken.
- `9ebe3e0d`: output before hours and his whole sentence (claude 1, 2; codex 1); per-gate causes and question times
  (claude 5, 10; codex 3); gate 3 split (claude 4; codex 8); the missing periods (claude 8; codex 5); the done-when
  (claude 6; codex 12); archive times (claude 3; codex 2); PR 935 named (claude 7, corrected below); gates 6 and 7
  (claude 9); no home against question 364 (codex 4); copied history (codex 6); kinds of start stop (codex 7).
- `ff2b252d`: hand-made cells marked and the reader's fixes made T4 (claude 1; codex 3, 10, 12); states per row and
  totals by state (claude 2); Codex constraint and question 380 (claude 3; codex 13); sources cited as written
  (claude 4, 11); the rule-order option put back (claude 5; codex 11); approved work per period, each PR once (claude
  6; codex 1); gate 0 (claude 7); gate 3a by drafts held (claude 8; codex 5, 7); both idle limits (claude 9; codex 10);
  the cap full and his close order (claude 10; codex 11); a check per table and the missing present period (claude 12;
  codex 9, 12); what tier 2 proved (codex 2); spend moments (codex 4); PR 935 removed (codex 6); round 4's result
  (codex 8); no hit count (codex 14).
- Unguaranteed: states, spend figures, the archive times (to the minute) and the 2.45 h to the first brief are by hand
  from the notes; wait causes come from notes and question notices, not every notify record; transcripts can lengthen
  after the cut and a gap is judged to its next entry; the manifest's digest moves while live transcripts grow (JH 249's
  runs printed several, the rows equal between them); the rates are few periods, not a trend.

## Tasks
- [x] T1 (kind: build) The reader `workshop/lib/away-hours.mjs`, test first: spec 1. Commit: this branch.
- [x] T2 (kind: docs) The periods, the table and the gates in this document. Commit: this branch.
- [x] T3 (kind: docs) The answers to double reads `9ebe3e0d` and `ff2b252d`. Commit: this branch.
- [x] T4 (kind: build) The reader takes archive cuts as input, counts copied history once by `uuid`, pairs each call
  with its result and counts a pending app start as launch latency, with fixtures for a spanning call, a missing
  result, a mid-window archive, a lock wait and overlapping starts; a manifest of its inputs; then the tables from its
  output (L9). Commit: 0cdbdac1 and 57546452 (JH 243), the tables (JH 249).

## Log
- L1 His request, typed in JH PLAN (`f5c3ee4d`:7927, `2026-11-19T21:36:13Z`): "Si pero quiero que corrijas eso de que
  no avanzamos cuando quedas solo y cuando venga vamos a solucionar completamente y a profundidad eso para que no nos
  vuelve a suceder pero quiero que lo comiences a implementar de una vez para que avancemos ahora que voy a estar
  ausente".
- L2 Evidence: the miniplan's four periods are not four absences by the record; two are, and two more exist that it
  does not name (2026-11-17 day, 2026-11-17/18 night). His last entry is 16:36 local, not 18:10.
- L3 Evidence: the reader first missed sibling worktrees (`D--js-harness-worktrees-…`) and counted every old
  transcript as waiting; both fixed before the table, with the main test covering each.
- L4 The lenses (reliability, readability) found 7 points in the reader, all fixed with tests; one moved figures:
  an idle gap cut by the window's end had counted as work.
- L5 The lenses' follow-up on c6961b66, answered, not fixed: a session started in a plain subdirectory of the
  checkout (folder `<slug>-workshop`) is no longer read; sessions here start in the checkout or a worktree.
- L6 Codex review of the reader held to the reset of 2026-11-23 23:45 (miniplan 10, "Budget").
- L7 Double read `9ebe3e0d` answered by JH 242 (question 380, tapped): all 26 taken. My replay then found no work on a
  missing result, but it counted a call as answered when any result for it appeared later, so JH PLAN's pending start
  passed as work; `ff2b252d` codex 3 caught it.
- L8 Confirming read `ff2b252d` answered by JH 242: all 26 taken in the document; the reader's code fixes are T4,
  left because the session's 7M line could not hold a test-first change, its lenses and the gate.
- L9 JH 249 replaced every table figure with the reader's (base command in Table) and changed no reader code: no
  figure needed it. What moved: a launch column (JH ORQ 8.03 h on the night of 17/18, 1.3 h on the day of 17; JH PLAN
  1.95 h and 0.06 h), since a start call is pending until its result, and the 07:51Z call the notes call unanswered
  returned at 16:46Z; the night of 18/19 worked 6.80 h, not 7.26, with gate-lock time in waiting; the last period
  5.45 h, not 5.70.

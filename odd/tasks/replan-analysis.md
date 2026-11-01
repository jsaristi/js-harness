# JH 128 · Re-planning analysis: how we would start again, against how we have been going

Locator: `odd/tasks/replan-analysis.md` · Branch: `worktree-replan-analysis` · Delivery: documents only, one commit
per stage on the branch; the result reaches him as a Spanish visual page through the lead · Test runner: none (no code)

## Goal
He gets one evidence-backed answer to "were we doing it wrong?": how the project has been going, how it would be
planned if it started today, the two side by side with what each difference costs or saves, and a recommendation
(keep, adjust or restart) with its first three steps, every decision in it left to him.

## Why
His words (L1): "excelente hazme un analisis completo de como deberiamos empezar de nuevo y alinear todo y me lo
contrastas y comparas de como veniamos, osea como hacer un reajuste del plan por si depronto lo estabamos haciendo
mal". He asked it on his return after twelve hours in which the whole flow stood still on one question (question
150, L2). Rule 1 applies: this is a depth pass he asked for, and it passes `rule:double-review` before it reaches him.

## Done when
- `js-harness contract check odd/tasks/replan-analysis.md` exits 0
- `js-harness rules check` exits 0
- the two blind readers' findings are each answered in `## Log`, fixed or rejected with the reason
- the lead is notified with this file and the published page's URL

## In scope / Out of scope
- In: this document; a Spanish visual page built from it (an Artifact); the evidence read from the records.
- Out: any source change (the brief's allowed surface); any decision of his, which the analysis names and leaves;
  any Codex run, because the weekly limit is at 84% (`js-harness codex-meter`, 2026-11-01) and Codex cannot yet
  review a plan (question 145's design, JH 126).

## Constraints
- Every figure carries its command or `path:line`, or says it is an estimate — because the failure most seen in this
  project is a fact told to him unverified (`told-him-unverified`, 12 sightings).
- Read-only on the records and the machine — because the analysis must not change what it measures.

## Ask me before
Everything in "Recommendation" is his: whether to keep, adjust or restart, and each step that changes one of his
decisions. Nothing is asked before the page reaches him; a question goes to the lead with `notify --kind question`.

## Depth pass
- 1. Method: a project post-mortem and re-baseline, as a delivery lead or an engineering manager runs one when a
  plan keeps growing: separate output from outcome, find the loop that feeds the growth (Goldratt's constraint, the
  "second-system effect" of Brooks), and re-plan from the outcome backwards with the smallest set of moves; for each
  component, the subtraction test the project already wrote as Principle 2 ("remove one piece, measure, keep what still
  matters"). The search of `rule:reuse-first`: `docs/proposals/harness-diet.md` (F8) is the nearest existing
  re-plan; it targets the per-turn payload and the gentle-ai replacement (its section 0), not the code volume nor the
  operating model, so this analysis builds on it and does not replace it.
- 2. Raw material: the records, not summaries. The plan, `docs/ROADMAP.md:90-106` (phases) and `docs/origin.md`
  (the founding estimate, "~9–12 sessions, 2–3 calendar weeks"); `js-harness progress` and `progress --pace`;
  `js-harness failures` and `failures weeks` over `docs/FAILURES.md`; the Codex runs in
  `.git/js-harness/codex-review-runs.jsonl` (1,506 lines) and the lands in `.git/js-harness/lands.jsonl` (396 lines);
  the channel `~/.js-harness/channel/D--js-harness.jsonl` (1,979 notices); `js-harness throughput`; the transcripts
  under `~/.claude/projects/`; his request, the lead's transcript `0f71b2c6`, line 47737, and his return just before
  it, the same transcript, line 47608 ("creo que tenias el flujo de trabajo parado").
- 3. The bar: excellent here means every claim checkable by him from a command, the cause named and not only the
  symptoms, and a recommendation small enough to start tomorrow.
  spec 1: `js-harness progress --pace`: measured, 488 steps closed and 539 added over 14 days (section A).
  spec 2: left out because a plan has no command that proves it; the two blind readers judge it (`rule:double-review`).
  spec 3: `js-harness failures`: measured, 131 failures and 307 sightings, the base of the contrast's evidence.
  spec 4: left out because the recommendation is his to judge; the readers check that each step names its cost.
  spec 5: left out because the page is published at the end; its URL is named in the Log.
- 4. Refutation: the request holds only if something is off. The cheapest test that could show nothing is off: is the
  plan closing faster than it grows, and did the measured changes of F8 move the measured behaviour? Run:
  `js-harness progress --pace` gives closed 488, added 539 in 14 days, so the open work grew; and the incident set,
  read from `docs/ROADMAP.md` (S0, S3, S1 and S10 rows), scored 13, 13, 13 and 13 of 20 after each step, so the
  steps did not move it. Both point the same way as his doubt.
  Verdict: supports
- 5. Request: an analysis, in English in this document and in Spanish as a visual page, of (A) how the project has
  been going, measured; (B) the cause behind the measures; (C) how it would be planned today; (D) the contrast, each
  difference with its evidence and its cost or saving; (E) a recommendation and its first three steps, every decision
  in it his. It builds nothing and changes no rule.
  Adds: none

## Specs
1. How we have been going, with evidence (the brief, item 1).
2. How we would start again today, knowing all that: the plan, its order and what it would drop (item 2).
3. The contrast, side by side, each difference with its evidence and what it would cost or save (item 3).
4. A recommendation: keep, adjust or restart, and the first three steps; his decisions stay his (item 4).
5. It reaches him as a Spanish visual page, through the lead (`rule:reports-spanish-visual`; the brief).

## Tasks
- [x] T1 (kind: design) Read the records and measure (specs 1, 3). Route: inline.
- [x] T2 (kind: docs) Write the analysis, sections A to E (specs 1-4). Route: inline.
- [ ] T3 (kind: verify) Two blind read-only readers, one attacking the claims, one looking for what is missing
  (`rule:double-review`); each finding answered in the Log. Route: two Claude sub-agents.
- [ ] T4 (kind: docs) The Spanish visual page, published; the lead notified with the path and the URL (spec 5).
  Route: inline.

## A. How we have been going

### A1. The plan against its own estimate
- The founding plan, F0 to F7, estimated "~9–12 sessions, 2–3 calendar weeks" (`docs/origin.md`, Phases). It was
  met almost on time: F0 to F5 by 2026-10-03, F6's slices by 2026-10-13, F7 on 2026-10-14
  (`docs/ROADMAP.md:92-105`). The thing the founding plan asked for was, in substance, built in 18 days.
- What came after was not in it. 37 days in, the repository holds 4,136 commits and 753 merges on main
  (`git log --first-parent --merges origin/main | wc -l`), 164 feature documents, and v1.0.0 is not tagged
  (`git tag -l 'v*'`: v0.9.0, v0.95.0, v0.96.0, v0.97.0). F8, the reorganization opened 2026-10-26, is 3 of 7
  steps (`js-harness progress`).
- The step change is on 2026-10-10/11, when work moved to many sessions in parallel: commits a day went from 13–75
  (2026-09-26 to 10-10) to 47–401 after, above 100 on 15 of 21 days (`git log --format=%ad --date=short origin/main | uniq -c`);
  feature documents opened went from 1–4 a day to up to 27 (`git log --diff-filter=A -- odd/tasks/`).

### A2. Shares and throughput
- `js-harness progress`: the roadmap 100 of 110 rows (91%), the features 1,045 of 1,080 (97%), 1,145 of 1,190 in all
  (96%). The share has sat in the 90s for weeks because the denominator moves.
- `js-harness progress --pace`, the last 14 days on main: closed 488, added 539, removed 25. **The plan grows faster
  than it closes**: 34.9 steps closed a day against 38.5 added. On 2026-10-31 alone (`js-harness throughput`): 69
  closed, 79 added, open steps from 34 to 44, while 18 pull requests merged.
- Lands (`.git/js-harness/lands.jsonl`): 396 runs of `merge-queue --land`, 326 green (82%), 60 exit 1, 10 exit 4;
  381 pull requests landed; 39.4 hours of land time.

### A3. Failures and how often they recur
`js-harness failures`: 131 failures, 307 sightings, 60 seen more than once, 26 controls replaced, 5 not settled.

| Class | Failures | Sightings |
|---|---|---|
| tool | 39 | 67 |
| unseen-state | 25 | 40 |
| machine | 19 | 53 |
| wrong-information | 14 | 53 |
| rule-not-acting | 14 | 38 |
| delivery | 11 | 36 |
| asked-of-him | 9 | 20 |

- Most seen: `told-him-unverified` 12 (still "seen again"), `chained-step-not-conditional` 10, `stray-folder-untracked`
  10, `hours-guessed` 9, `edit-during-review` 8 (seen again), `gate-at-its-bound` 8, `heavy-run-beside-gate` 7.
- By week (`js-harness failures weeks`): 1 and 2 sightings in the first two weeks, 158 in the week of 2026-10-05,
  86, 5, then 55 in the week of 2026-10-26. The jump starts with the parallel sessions.
- **Where they come from (estimate).** A keyword pass over the 131 ids and their first lines (gate, session, board,
  merge, queue, land, copy, wake, lock, worktree, folder, process, load, push…) puts about 97 failures and 206
  sightings, about two thirds, in the machinery of running many sessions on one machine (the gate lock, the merge
  queue, worktrees, background sessions, the channel, wakes); about 13 failures and 63 sightings in the model's own
  conduct toward him (unverified claims, guessed hours, estimates told as facts); about 21 and 38 in the product's
  commands. The pass is coarse, a hand count could move any group by a tenth; the proportion is the finding.

### A4. Review spend
- Codex (`.git/js-harness/codex-review-runs.jsonl`): 1,506 runs since 2026-10-07, 1,477 reviewed, 27 failed;
  207.7 million input tokens (148.9 million cached), 1.49 million output; 20.9 hours of wall time. By week: 147
  runs, 668, 279, 412. About two runs per merged pull request (1,506 for 753).
- The weekly limit stands at 84% on 2026-11-01, resetting 2026-11-04 (`js-harness codex-meter`). The lead's question
  of 2026-10-31 13:21Z already said that at 318 reviews that week the limit runs out before the reset, and that the
  pre-push requires a Codex record on every code commit, so **no code ships once it runs out**. Review volume follows
  code volume: the lever on Codex is how much code is written, not the review rule.
- Claude lenses: 243 runs (`lens-review-runs.jsonl`), cents each (`docs/ROADMAP.md`, S1: $0.006 to $0.051).
- Proposals: the diet plan was graded by two blind readers four times and rewritten seven times in one day
  (`docs/proposals/harness-diet.md`, section 0). F8's eval spend so far: $98.55 (`docs/ROADMAP.md`, "Spent so far").

### A5. What he had to answer, and when the flow stopped on him
- 150 questions recorded on the channel since 2026-10-14, 18 days: about 8 a day, 31 on 2026-10-24 alone
  (`kind: question` in `~/.js-harness/channel/D--js-harness.jsonl`). 125 answer notices; 60 `waiting` notices.
- He answers fast once a question reaches him: median 4 minutes from shown to answered on 2026-10-31
  (`js-harness throughput`). The cost is not his speed; it is that work stops between his turns. On that day the
  sessions' waits add up to 9.9 session-hours (an upper bound: a session may work while it waits).
- A rough topic count of the 150 (first keyword that matches): 34 about rules, 27 about spend or limits, 16 about
  merges, 10 about the machine, 10 about a design, 53 other (estimate). A large share is about the harness's own
  process, not about what the harness is for.
- The example of today: question 150 asks whether two of his answers given by tapping count as his words, because
  the command that records his rules accepts only typed words (`bin/lib/rules-change.mjs:232`). It was asked on
  2026-10-31 at 10:52 local and was still open on his return at 13:03 on 2026-11-01, after twelve hours away; it held
  the only session with work left (the lead's
  transcript `0f71b2c6`, lines 47608 and 47677). A rule about how to record his decisions blocked the work his
  decisions were for.

### A6. The harness's size against its bet
The bet (`docs/origin.md`, Principles 1 and 2; AGENTS.md): a stronger model needs a smaller harness, few
instructions and many sensors, every component earning its place by measurement.

| Measure | At the start | Today | Source |
|---|---|---|---|
| Instructions every turn, this repo | `AGENTS.md` 691 tokens (target ≤ 1.5k) | `AGENTS.md` 972 + `CLAUDE.md` 3,190 (its budget raised 2,500 → 3,200) | `docs/ROADMAP.md:93`; `js-harness check --verbose` |
| Skills loaded on demand | none | orchestrator 34 KB, protocols 20 KB, js-harness 12 KB (about 16k tokens, estimate at 4 chars a token) | `~/.claude/skills/js-harness*/SKILL.md` |
| Commands | a `check` | 49 | `js-harness --help` |
| Code | — | 73,397 lines in 263 modules, plus 118,462 lines of tests in 274 files and 40,173 of evals | `find bin evals …` |
| Rules | — | 73 | `js-harness rules` |
| Plan and its documents | origin 165 lines | `ROADMAP.md` 1,231 lines (its "Next" alone 345), `FAILURES.md` 1,905, proposals 298 KB, all docs 6.5 MB | `wc` |

- The origin's list "Not built (the stack already does it)" named the handoff machinery, the usage census and the
  context meter. Each has its own command today: `resume` and the relief file (1.49 MB), `throughput`, `pace` and
  `codex-meter`, `status-line`.
- By rough module name (estimate), about 40% of the code serves the operating model of many sessions (sessions,
  channel, gate lock, merge queue, stretch, resume, wake, templates, pages), about 28% the product (install, init,
  check, doctor, stack, contract, manifest, backup), 12% rules and guards, 9% reviews.
- **The project's own measures back the bet, and the growth went the other way.** F5: the minimal config scores as
  the full stack does at about half the cost (1.68× to 2.54×; `docs/ROADMAP.md`, "F5 result"); F6 the same on Codex.
  F8's incident set: 13 of 20 at S0, S3 (on both arms), S1 and S10, with cases 01, 02 and 05 failing every trial
  (`odd/tasks/f8-s10-port.md:355`): four measured steps and $98.55 did not move it.

### A7. Who the harness has served
Claude transcripts since 2026-09-26 (`~/.claude/projects/`, by folder): js-harness and its worktrees 230 transcripts,
1,675 MB; abogadaclaudiajimenez 13 transcripts, 46 MB; plataforma-preproyecto 1, 2 MB. About 97% of the work went
into the harness itself. The channel agrees: 1.52 MB for js-harness, 512 bytes and 770 bytes for the two projects.
The onboarding design, the way a real project would start with the harness, is still open (`docs/ROADMAP.md`,
Onboarding).

## B. The cause behind the measures

1. **The harness became its own only customer.** With no real project in the loop, every defect of the harness's own
   way of working became the next feature of the harness (A7, A2). There was no outside outcome to stop at.
2. **The operating model feeds a loop.** Many sessions on one slow machine need a gate lock, a merge queue, a channel,
   wakes, a board and a lead; each of those fails in its own ways (two thirds of the failures, A3); each failure gets a
   control (a check, a rule, a test); each control is more code for the next session to read, test and review; and the
   plan grows faster than it closes (A2). The failure register itself shows the jump on the week the parallel
   sessions began (A3).
3. **Review cost follows code volume.** Two reviews on every code slice is his decision and a sound one; its cost is
   about two Codex runs a pull request, so 753 pull requests turned the reviewer's weekly limit into the constraint
   on shipping (A4).
4. **Governance outgrew its purpose.** 73 rules, each with his quoted words, a transcript line, a failure and a
   review date; 150 questions in 18 days, many about the process itself; and a rule on how his answers are recorded
   that stopped the flow for half a day (A5).
5. **Measures of process, few of outcome.** The project measures its throughput, pace, failures by week and gate
   waits in detail; the outcome measures it has (F5, F6, the incident set) said the extra harness did not add score,
   and the growth went on (A6).

None of this says the work was careless: the product's core (install and an exact uninstall, `init`, `check` and
its sensors, the task contract, the reviews' records, `doctor`, the memory backup) works, is tested, and is what the
founding plan asked for. The mistake is of direction, not of craft.

## C. How we would start again today

Knowing all of the above, a plan started today would keep the founding principles and Rule 1, and add four that the
37 days taught. Each is stated so a check can hold it:

- **A real project is the customer.** A phase is done when it shipped something in one of his projects, not in
  js-harness alone.
- **One work session at a time on this machine** until a measure shows a second one pays for its failures.
- **The plan closes faster than it grows**: `progress --pace` over a week shows closed above added, or new work
  waits.
- **A control is built for a failure seen twice, or once at a high cost** (the rule-making test AGENTS.md already
  states), and a component that a subtraction trial shows adds no score is retired.

The plan, in order:

| Step | What | Done when | Drops or freezes |
|---|---|---|---|
| R0 Re-plan | A `ROADMAP` v2 of at most about 200 lines; today's file frozen beside `origin.md` as history | v2 merged; `progress` reads it | new features, except a break of shipped behaviour, for the week of R0-R2 |
| R1 Subtraction trial | Principle 2 run for real: the incident set and the F5 tasks with the core only (product modules, two reviews, `CLAUDE.md` cut to what the core needs) against today's full harness | the eval verdict rule (`docs/ROADMAP.md`, "Eval verdict") says which arm wins | nothing yet; it decides R3 |
| R2 Operating model | One work session at a time; the full suite on GitHub Actions (free since the repository is public), the local pre-commit kept to fast checks; merges on the green of that run | a week measured against last week's numbers in this document | the local gate lock and WSL mirror as a requirement; background fan-out |
| R3 Retire | What R1 shows adds no score leaves, through git (code) and `rules change` (rules) | the share of code in the operating model falls; rules counted again | per R1: candidates are the stretch protocol, templates' gate, per-moment page generators, the throughput protocol's daily snapshots, directive coverage (S5c, $95-130 forecast) |
| R4 Finish F8's subtraction | F8's own removal and cuts: S2 (gentle-ai, Orca, herdr leave), S4a to S7 | as F8 states | S5c (above); the wait on gentle-ai #4036, moot once gentle-ai leaves |
| R5 First real project | S13's rehearsal, then S12's migration, on abogadaclaudiajimenez; one real feature built there with the harness | that feature merged in his project, measured | — |
| R6 1.0.0 | 1.0.0 is the version that R5 ran on, after S8's certification | tag | the condition "1.0.0 waits for #4036" |

## D. The contrast

| # | Dimension | How we have been going | How we would go | Evidence | Cost or saving |
|---|---|---|---|---|---|
| 1 | Customer | the harness itself | his projects | A7: 97% of transcripts on js-harness | saves the self-feeding loop (B1); costs nothing to switch |
| 2 | Plan | 1,231-line roadmap, 1,190 steps, grows +38.5/day | ≤ ~200 lines, closes faster than it grows | A2 | saves the re-reading of a plan no session can hold (estimate: the roadmap's 144,791 bytes are about 36k tokens at 4 characters a token) |
| 3 | Sessions | a lead and many sessions at once | one at a time, a lead only to plan | A3: about two thirds of failures in that machinery (estimate) | saves most failure sightings (estimate); costs wall-clock parallelism, which A2's lands suggest was eaten by gate waits and reds |
| 4 | Gate | local lock, WSL mirror, merge queue | GitHub Actions; fast local pre-commit | A2: 39.4 h of lands, 18% not green; `throughput`: lock busy 2 h a day | saves the gate machinery's failures (`gate-at-its-bound`, `heavy-run-beside-gate`, `two-gates-at-once`: 19 sightings); costs CI latency (median 235 s on GitHub against 350 s here, `throughput`) |
| 5 | Reviews | Codex + lenses on every code slice; two blind readers and many passes on proposals | the same two reviews (his rule), on far less code; proposals read once by two readers | A4: 1,506 Codex runs, 84% weekly, ~2 runs a PR | Codex use falls with code volume; no review is weakened |
| 6 | Rules | 73, each with quotes and transcript lines | fewer, each with a check; one way his decision is recorded, typed or tapped | A5: question 150 | saves questions about the process; whether a tap counts is his decision |
| 7 | Questions | ~8 a day, one at a time, work stops between | his decisions gathered once a day, the reversible ones decided with their default | A5 | saves stalled session-hours (9.9 upper bound on one day); costs him one read a day |
| 8 | Measures | process in detail; outcome flat | outcome first: the incident set and a real project's feature | A6 | redirects eval spend to the question "does this help?" |
| 9 | Per-turn load | 4.2k tokens and skills of 16k on demand | what the core needs | A6 | most of `CLAUDE.md` describes the operating model; it shrinks with it |
| 10 | Release | 1.0.0 waits for everything, and for #4036 | 1.0.0 is the version a real project ran on | `docs/ROADMAP.md:75-78` | a date he can see |

## E. Recommendation

**Adjust, deeply; do not restart.** A restart throws away the 18 days that met the founding plan and the core that
works, and it would not remove the cause, which is the direction and the operating model, not the code. What to
restart is the plan, not the repository: a short v2 aimed at his projects, the subtraction trial the principles
already promised, and one session at a time until a measure says otherwise.

Every one of these is his to decide. The first three steps, if he says yes:

1. **R0, the re-plan (his decision).** A yes covers: no new feature starts for about a week except a break of what
   already works; one session writes `ROADMAP` v2 and freezes today's file as history; F8's open work is mapped into
   v2. It does not authorize removing any code or rule. The other option is to keep the current roadmap and its
   order. Cost: one session of documents, no Codex run.
2. **R1, the subtraction trial.** The incident set and the F5 tasks, core only against the full harness, under the
   eval verdict rule. Cost (estimate): about $60, S0's three runs as reference (`docs/ROADMAP.md`, S0: $59.64), on
   his plan's limits with no fixed cap (D2). It decides what R3 retires.
3. **R2, a measured week of one session at a time with the gate on GitHub Actions.** Compared with this document's
   numbers: failures a week (55 last week), pull requests a week, Codex share used, questions a day (about 8), steps
   closed against added (488 against 539). Whether two reviews stay on every slice stays as he decided; only their
   volume changes.

What is not known: how much of the operating model's code R1 will show to be dead weight (the trial says); whether
one session at a time ships less (R2 measures it); the share of failures by origin is a keyword estimate (A3); the waits and the answer times are measured
for one day, 2026-10-31, because `js-harness throughput --since 2026-10-13 --until 2026-11-01` printed nothing within
300 seconds and was not run again.

## Log
- L1 2026-11-01 13:11 local — his request, typed (the lead's transcript `0f71b2c6`, line 47737): "excelente hazme un
  analisis completo de como deberiamos empezar de nuevo y alinear todo y me lo contrastas y comparas de como
  veniamos, osea como hacer un reajuste del plan por si depronto lo estabamos haciendo mal".
- L2 2026-11-01 — the context: on his return he wrote "creo que tenias el flujo de trabajo parado" (line 47608); the
  lead answered that question 150 had held the only working session (line 47677).
- L3 2026-11-01 — T1 and T2 done in this session (JH 128). Commands and their outputs as cited in sections A1-A7.

# reviewer-controlled-test: Codex 6.1 against 6.2, and the effort apart from the model

## State
He approved the run with a cap of 20 points of the weekly window (question 359, L9). T2 to T4 are built (L10).
Codex reviewed the slice twice (L12, L13): seven findings, all fixed, the last answered with no third round on the
lead's word. Next: push and a draft pull request; then T5, the runs, right after the weekly reset of 2026-11-23
23:45 local, when the lead says, A first, a `js-harness notify` to the lead at the start and at the end. Open:
whether the double review of this design (protocol section 1) runs (L6). The arms' models are named by their short
versions above the Log and by their full ids in L7.

## Goal
Numbers that say which pair the Codex reviewer should run on (`rule:review-model`, `rule:review-effort`): planted
defects found, findings invented on clean code, and cost per changed line, for each pair on the same cases.

## Why
PR 911 (commit `b475339b`, `bin/lib/rules-data.mjs`) changed the model from 6.1 to 6.2 and the effort from `medium`
to `max` in one commit. Since then a first review costs about twelve times more input a changed line, takes about
ten times longer, leaves ten times more findings, and none of 17 returned `correct` (L3). Nothing can say whether
the model or the effort causes it, and `evals/review` has no reading on 6.2. He asked how 6.2 improved over 6.1 and
approved designing the test (L1, L2). The rule stays his: only his answer to the table of T6 changes it.

## Done when
- `npm run check` exits 0
- `node --test evals/review/compare.test.mjs evals/review/report.test.mjs evals/review/score.test.mjs` exits 0
- `node evals/review/compare.mjs --list` exits 0 and lists every arm he approved with its runs recorded
- The table of T6 is in this document, with what the sample cannot show
- `js-harness rules check` exits 0, and `git diff main -- bin/lib/rules-data.mjs` prints nothing

## In scope / Out of scope
- In: `evals/review/compare.mjs`, `evals/review/report.mjs` and their tests; readings under
  `evals/results/review/readings/`; `evals/results/review/report.md`; this document.
- Out: `rule:review-model`, `rule:review-effort` and every other rule (the arms run through the eval's own
  configurations, never the rules); real pull requests (no arm reviews real work, no review of real work counts as an
  arm); the seeded key and the scorer (no case or grading is weakened); `bin/codex-review.mjs`.

## Constraints
- No Codex token before his answer to Q1 — the brief's steps 1 to 3 spend none.
- Nothing runs while Codex's weekly window is at 50% or more (`js-harness codex-meter`, read before every run) and
  no reset credit is used — his limits, miniplan 6 "Do not".
- One try a run: a failed run is read before anything runs again — protocol section 3.
- A run counts only when its reading shows the session's own model and effort equal to its arm's — the reading
  already holds them (`modelSource: session`), and an arm measured on another model measures nothing.
- The spend stops at the cap he answers, whatever is left undone.

## Ask me before
- Q1: the spend of the run, once, with its cap (asked through the lead).
- After T6: the pair the rules take. It is his rule: the card says that his words must be typed, not tapped.

## Depth pass
- 1. Method: a controlled A/B over a fixed eval set, as a model evaluation is done: the same cases, prompt, CLI and
  harness for every arm; one factor changed at a time (model at medium effort: arm A against B; effort on 6.2: B
  against C, and D between them); planted defects for recall and clean code for invented findings; at least two runs
  a case an arm so one odd run decides nothing; cost read from the session's own rollout. The eval already exists:
  `evals/review/compare.mjs` runs one configuration on one range with the model and the effort pinned in its
  `CONFIGS` (`compare.mjs:94-100`), handed to `codexReviewMain` as injected deps (`compare.mjs:477`), and never
  through the rules. The smallest change: three or four new `CONFIGS` entries and a run index on a reading.
- 2. Raw material:
  - `evals/review/seeded/key.json`: one seeded range, 292 changed lines as `git diff --numstat` counts them (226 in a reading's `coverage`, the lines a review's evidence holds), 7 planted defects of 7 kinds.
  - `evals/review/compare.mjs:113-123`: the `real` range, 255 changed lines of this repository "with no known defect".
  - `evals/results/review/readings/*.json` (2026-10-08, CLI 0.161.0, all on 6.1): `lean-own` seeded 7 of 7 found,
    0 extra, 55,203 input; `lean-own` real 0 findings, 145,842 input; `lean-high` seeded 7 of 7 and 1 extra,
    57,161 input; `lean-high` real 0 findings, 374,661 input. Every 6.1 configuration gave 0 findings on `real`.
  - `.git/js-harness/codex-review-runs.jsonl` of the main checkout, 2,033 lines, read 2026-11-19 (L3).
  - `codex app-server`, method `model/list`, read 2026-11-19 with no model run: 6.1 is listed on his account, not
    hidden, with efforts low, medium, high, xhigh, max and ultra (L4).
  - `js-harness codex-meter`, 2026-11-19: weekly 48% used, resets 2026-11-23 23:45; reset credits 3 (L5).
- 3. The bar:
  spec 1: `node evals/review/compare.mjs --list`: none, new behaviour (no arm on 6.2 exists; arms A to D listed with two runs a case)
  spec 2: `node --test evals/review/compare.test.mjs`: passes today; none, new behaviour for the arms and the run index
  spec 3: left out because it is a recorded run, not a command: each run's reading shows its arm's model and effort as the session's own
  spec 4: `node --test evals/review/report.test.mjs`: passes today; none, new behaviour for the arms' table
  spec 5: `git diff main -- bin/lib/rules-data.mjs`: prints nothing today
- 4. Refutation: the cheapest test that the test cannot answer his question is whether the planted cases can still
  separate the arms. Read now, from the committed readings: `lean` and `lean-own` on 6.1 medium found 7 of 7 with 0
  extra, so the seeded case is at its ceiling. It can show 6.2 losing a defect, or inventing one, never finding more.
  The test still answers what PR 911 left open (whether the model or the effort drives the cost and the findings, and
  whether 6.2 invents findings on clean code), but not "does 6.2 find harder defects". Harder planted defects are a
  follow-up after the table (X1), and the question says so.
  Verdict: supports (narrowed: cost and invented findings, not recall on harder defects)
- 5. Request: run, on the cases `evals/review` already has, the same prompt and the current CLI, arms A (6.1 at
  medium), B (6.2 at medium) and C (6.2 at max), and D (6.2 at high) only if the measured spend of A to C leaves room
  under his cap; two runs a case an arm, through the eval's configurations and never the rules; report found of 7,
  findings on the clean range (each also classed real, invented or undecidable), input a changed line, minutes and
  verdicts, and say that the seeded case cannot show better recall.
  Adds: none

## Design
- Cases, the same for every arm: `seeded` (7 planted defects; a finding there that names none is a second count of
  invented findings, `extra`) and `real` (the clean case; the headline counts every finding there as invented, as the
  brief defines it, and beside it each finding is read against the code at that head and classed real, invented or
  undecidable, since "no known defect" is not proved clean). No case is added: `real` exists and has five readings at
  0 findings. A seeded tree with the defects fixed, clean by construction, was considered and not taken: the brief
  adds a case only where none exists.
- Prompt: every arm on `own` with the range's feature document (`lean-own`'s shape), so each reading records its
  `promptVersion` and the sameness of the prompt across arms is checked, not assumed; the `codex` prompt records
  `promptVersion: null`. Same CLI for every arm (0.169.1 today); a CLI update during the runs stops them.
- The October 6.1 readings are not reused as arm A: another CLI (0.161.0) and another prompt version. They stay as
  history.
- Arms: A 6.1 at medium (baseline), B 6.2 at medium, C 6.2 at max, D 6.2 at high (only if room). A against B is the
  model; B against C (and D) is the effort. Their full ids are in L7.
- Runs: each case twice an arm: 12 paid runs for A to C, 16 with D. Order: cheapest first, A, B, C, then D; one run
  at a time, each in a turn of the gate lock, as `compare.mjs` asks.
- Before and after each run: `js-harness codex-meter`, recorded in the Log with the run. A run does not start when
  the window is at 50% or more, or when the spend so far plus the arm's high price would pass his cap.
- Validity: a run counts only when its reading's `modelSource` is `session` and its model and effort equal its arm's;
  a run with `outcome` other than `reviewed` is read, written in the Log and not retried without reading why.
- Recording: each run is a reading under `evals/results/review/readings/`, named by arm, range and run index, beside
  the existing ones; `codex-review` writes its own run line where it always does (the run log of the seeded
  checkout, removed after the cell), and the reading keeps the numbers.

## Price
How it is priced. Two bases, from the measured runs (L3) and the committed readings, and the larger is the high: per
run (a review has a fixed cost of exploration that dominates on ranges this small) and per changed line. The two
cases are 547 changed lines between them as git counts them (292 + 255; the run log's `part.changedLines` counts the same way). Corrected in L12: the version he answered used 226 for seeded. Every figure here is an estimate from those measures.

| arm | runs | low (input tokens) | how | high (input tokens) | how |
| --- | ---: | ---: | --- | ---: | --- |
| A 6.1 medium | 4 | 0.40M | the `lean-own` readings, 2 x (55,203 + 145,842) | 1.22M | 1,113 a line (median of 251 first reviews) x 547 x 2 |
| B 6.2 medium | 4 | 0.40M | as A: the model alone adds nothing | 13.7M | as C: the effort alone adds nothing |
| C 6.2 max | 4 | 4.0M | A's low x 10 (the p90 ratio of 6.2 max to 6.1 medium) | 13.7M | 12,489 a line (median of 17 first reviews) x 547 x 2 |
| D 6.2 high | 4 | 0.40M | as B | 13.7M | as C |
| A to C | 12 | 4.8M | | 28.6M | |
| A to D | 16 | 5.2M | | 42.3M | |

B has no measurement at all: its range is the whole span between A and C, and its first run prices it; the per-run
check of the cap is what keeps that span from becoming spend.

As a share of Codex's weekly window. Two readings, both confounded by other sessions' use: since the reset of
2026-11-17 the logged Codex input is 67.4M tokens (38.6M in reviews, 28.8M in double-review reads) against 48% used,
about 1.4M a point; and 3.28M tokens of two 6.2 max runs over the meter's move from 18% to 23% on 2026-11-18
(`odd/tasks/again-subrange.md` L52-L54), at most 0.66M a point. So A to C is about 3% to 43% of the week, and A to D
4% to 64%. His cap of 20 points (L9) is what binds: the run stops at it whatever the estimate. The low end is likelier for A and the high end is reached only if B and D cost what C does; the first
runs replace both readings by measured ones (the meter is read before and after each run).

When. The window is at 48% today and his line is 50%, so nothing fits this week. The run starts right after the
reset of 2026-11-23 23:45 local, before the week's reviews take the room: the window went from 0 to 48% in under
three days.

## Tasks
- [x] T1 (kind: design) Read `evals/review` and the run log, price each arm, write this design. Spec: 5. Commit: this one.
- [x] T2 (kind: build) Arms A to D (`ARMS` in `evals/review/compare.mjs`) as configurations on `own` with the document, each run one of its own (`sol61-medium-1` to `sol62-high-2`); tests first. Spec: 1, 2. Commit: this one (L10).
- [x] T3 (kind: build) Folded into T2: each run of an arm is a configuration of its own, so a reading stays one file a cell and no run index is needed; the old readings are untouched. Spec: 2 (L10).
- [x] T4 (kind: build) The report's section of the arms: one table a range, one row a run, with input a changed line and prompt version; the comparison's count and `--require-complete` over its own nine cells. Spec: 4. Commit: this one (L10).
- [ ] T5 (kind: verify) The approved runs, one at a time, meter before and after, after 2026-11-23 23:45 local. Spec: 3.
- [ ] T6 (kind: docs) The table: arm, found of 7, invented on `real` (and its classes), `extra` on `seeded`, input a changed line, minutes, verdicts; what the sample cannot show. Then the lead's question with the pairs.

## Follow-ups
- X1: harder planted defects, so recall can separate the arms; after the table, if he wants it.

## Questions
- Q1 (his, through the lead, 2026-11-19): the spend of the run and its cap. Sent to the lead as L6 says; recorded as question 359 (L8). Answered: yes, cap 20 points (L9).

## Log
- L1 2026-11-19, his request, JH PLAN transcript `f5c3ee4d`, typed: "Dime como a mejorado de la version de 6.1 a 6.2 de sol?"
- L2 2026-11-19, tapped to "¿Armo el miniplan de una prueba controlada de 6.2 frente a 6.1?": "Sí, ármalo".
- L3 2026-11-19, the run log (`.git/js-harness/codex-review-runs.jsonl`, 2,033 lines), first reviews with outcome
  `reviewed`, prompt `js-harness.codex-review-part-prompt/v6`: 6.1 medium, 251 runs, 125,243 input a run (median
  104,467, p90 231,732), 820 a changed line over the sums (median 1,113), 0.9 min, 0.51 findings a run, `incorrect`
  84 of 251; 6.2 max, 17 runs, 1,545,243 input a run (median 1,459,320, p90 2,387,963), 10,000 a changed line over
  the sums (median 12,489), 10.2 min, 5.06 findings a run, `incorrect` 17 of 17. The miniplan's figures hold, save
  6.2 max's minutes: 10.2 on average, not 8.4. The rechecks' acceptance rates (88% and 54%) were not recomputed.
- L4 2026-11-19, `codex app-server` `model/list` (a script in the session's scratchpad, as `bin/lib/codex-meter.mjs`
  speaks to the server; no model run): `gpt-6.1-sol` listed, `hidden: false`; the first run of arm A is what proves
  it runs.
- L5 2026-11-19, `js-harness codex-meter`: five-hour 58%, weekly 48% used, resets 2026-11-23 23:45; reset credits 3.
- L6 2026-11-19, design written, no Codex token spent. Protocol section 1 asks a double review (a Claude and a Codex
  reader) of a design put to him; it spends Codex tokens the brief forbids before his answer, so it did not run, and
  the lead is told so with Q1.
- L7 2026-11-19, the arms by their full ids, since a feature document names a Codex model only in its Log
  (`bin/conventions-model-home.test.mjs`): 6.1 is `gpt-6.1-sol`, the value `rule:review-model` held before
  2026-11-18; 6.2 is `gpt-6.2-sol`, the value it holds since PR 911. Arm A is gpt-6.1-sol at medium, B gpt-6.2-sol at
  medium, C gpt-6.2-sol at max, D gpt-6.2-sol at high; the configurations of T2 pin these ids, whatever the rule
  holds later.
- L8 2026-11-19, the lead (JH ORQ): Q1 recorded as question 359, to go to him through the Plan when he is back (away
  about eight hours); its card says the double review did not run and why. Until his answer nothing that spends
  runs, T2 to T4 wait, nothing is pushed.
- L9 2026-11-19, his answer to question 359, tapped, JH PLAN transcript `f5c3ee4d` line 6312, 15:46:06Z (checked
  here with `js-harness sessions --quote f5c3ee4d 6312`): "Sí, con tope de 20 puntos (Recomendada)". The lead's
  terms: start right after the reset of 2026-11-23 23:45; cap 20 points, stop at 50% of the window, no reset
  credits; A to C first, cheapest first, one at a time, the meter before each run; D only if A to C leave room;
  no change to `rule:review-model` or `rule:review-effort`; notify the lead at the start and the end.
- L10 2026-11-19, T2 to T4, tests first: 5 of 39 compare tests and 1 report test red before the code
  (`node --test evals/review/compare.test.mjs`, `evals/review/report.test.mjs`), then green. Design change from the
  plan: no `--run` index; each run of an arm is a configuration of its own, the smallest change that keeps one
  reading a cell and every existing reading as it is. `--list` shows 25 cells, 9 recorded. Searched before adding:
  `CONFIGS`, `CELLS`, `readReading` and the report's columns in `evals/review`; nothing measured arms.
- L11 2026-11-19, the lenses on c6c1ee2..ac1b927 (reliability, risk, with this document): reliability 1
  SUGGESTION, that `perChangedLine`'s comment named the lines the review saw while the code divides by the range's;
  fixed in 350e960 (the range's lines kept, as the price's base, the comment says so and a test divides a half-seen
  range by all of it); risk 0. The lenses on ac1b927..350e960: 0 findings, the earlier one rechecked fixed. Codex's
  review of c6c1ee2..350e960 has not run: it spends from the weekly window (48% on 2026-11-19), and when it runs is
  the lead's.
- L12 2026-11-19, Codex's review of c6c1ee2..f5994b6 on the lead's word (meter before it: weekly 52%, five-hour
  17%): incorrect (0.99), 1,250,877 input tokens (1,136,128 cached), 502 s, four findings, all taken. P2: the input a
  changed line divided by `coverage.total`, the deduplicated lines that are not blank a review's evidence holds
  (216 and 226), not the lines git counts (255 and 292); `RANGES` now carries `changedLines`, held to
  `git diff --numstat` by a test, and the report divides by it. P2: a run whose session named no effort, or ran
  another pair, was counted with the verified ones; a `counts` column says yes or no and why, and the section
  counts the runs that count. P2: a reading of other commits, CLI or prompt version was pooled with no word; notes
  under each arm table say so, as under the comparison's. P3: an arm's unreadable file showed as `missing` with no
  reason; the note gives it. Bad news it brought: the price he answered (question 359) used 226 lines for seeded;
  at 292 the high of A to C is 28.6M, not 25.1M, and of A to D 42.3M, not 37.1M; the lows are the same, and his cap
  of 20 points binds whatever the estimate. Recorded in docs/FAILURES.md, `estimate-passed-as-fact`.
- L13 2026-11-19, Codex's second round on f5994b6..4d490c9, on the lead's word: incorrect (0.98), 516,090 input
  tokens (439,296 of them cached), 178 s; with L12 the two rounds spent 1,766,967 input tokens. Three of L12's four
  fixed; one not: the CLI and prompt version were compared within each range's table, so a range read wholly on
  another version agreed with itself. Answered: they are now compared against the runs of both ranges, with a test
  that a `real` run on another CLI than the `seeded` runs is noted. No third round, on the lead's word.
  The lenses on f5994b6..a47f50f (reliability, risk, with this document): reliability 1 SUGGESTION, an arm
  table's heading read "undefined changed lines" for a range that names none; fixed with a test in the next
  commit. Risk 0.
- L14 2026-11-19, on the lead's word, question 378 to him: until this test reports, does the review effort on
  6.2 stay at max, go to medium (arm B) or go to high (arm D)? No option is marked recommended. Its figures come from
  .git/js-harness/codex-review-runs.jsonl since b475339b; a first review there is the sum of a run's parts, with no
  recheck and input above 0. On 6.2 max: 20 first reviews, 302k to 3.08M input (median 1.29M), 12,323 a changed
  line (median), against 824 on 6.1 medium (1,443 first reviews). Findings: 4.55 a first review and 2.21 a recheck.
  Incorrect: 19 of 19 first reviews, 34 of 43 in all. The lead's 104k to 1.46M, 0.51 to 5.06 findings and 17 of 17
  were not reproduced under any definition tried, and the question says so. No Codex ran; the double review was not
  run because the lead barred Codex.
- L15 2026-11-19, his answer to question 378, tapped at 15:53 local: "Pasar a high" (JH PLAN transcript
  f5c3ee4d-2c09-416a-addb-ea2b5e6c3e8d line 7639, read with `js-harness sessions --quote`). His choice is high
  for the review effort on 6.2 until this test reports. The rules change has not run, on the lead's word: two
  typed lines are owed, his yes to high and "no quiero la revisión" for the double review the question skipped.
  The lead relays both when he types them. No Codex ran.

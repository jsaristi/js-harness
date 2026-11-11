## Goal
A committed design, reviewed twice, for a cost trial of four runs that tells the owner how many points of the weekly
Fable limit a work session spends on one real task when it runs on Opus 5.5 with a Fable 5.2 advisor, against the
same task on Fable 5.2 at medium, and what the trial would cost, put to him through the lead before anything runs.

## Why
His request (L1) was to find out whether sessions and sub-agents should run on Opus 5.5 with the Fable 5.2 advisor
while the lead stays on Fable 5.2 at high. The quality trial of three arms (`odd/tasks/model-trial.md`) failed its
third double review; asked again, he chose to measure the advisor's cost on the Fable limit first (L2). The cost is
the open unknown, not the quality: on 2026-11-10 he measured Fable 5.2 at high better than Opus 5.5 at max "tanto en
precio como en inteligencia" (`odd/tasks/one-model-home.md` S1), and the sessions went to medium only because the
weekly Fable limit stopped them for 3 h 24 min (S7). So his idea pays only if the advisor spends clearly less of that
limit than a Fable session does; if it does not, the quality question never needs asking.

## Done when
- `js-harness contract check odd/tasks/advisor-cost.md` exits 0
- The double-review record holds a `take` entry for both readers of every read of this document; no command checks
  this whole, so it is read in the record (`js-harness double-review tally --since 2026-11-11`)
- The lead holds a recorded question that puts the trial and its cost to him (`notify --kind question`), and this
  session's `waiting` or `closed` notice names it

## In scope / Out of scope
- In: this document; the session summary under `docs/sessions/`; this session's scratch.
- Out: running any run, the probe included (his yes, not given); changing a rule, a model, an effort or the advisor
  setting (his); building the run folders or briefs before his yes; anything under `~/.claude`; the quality of the
  arms' work (the quality trial, which he did not choose).

## Constraints
- Nothing runs before his yes — because the runs spend his plan and need his exception to two rules (D6).
- The criterion is fixed here, before any run — because a criterion written after the results bends toward them
  (JH 125's constraint, `odd/tasks/advisor-trial.md`).
- The size is what he chose: 2 to 4 runs (L2). No run measures quality, and no outcome of this trial moves a session
  to Opus: the most it opens is a question to him.

## Ask me before
Running the trial (its cost, D7); the exception to `rule:session-model` and `rule:session-effort` for the Opus runs
(D6); a consent prompt for usage credits, which stops the run where it appears; pausing other sessions for the
probe's window (D3).

## Depth pass
- 1. Method: metering, the discipline of a capacity engineer who must know what a workload draws from a quota they
  can read only coarsely: calibrate the coarse meter against a fine-grained record first, then measure the workload
  in the fine record, and spend the coarse meter only on what the record cannot tell (here, which meter the advisor
  draws on and at what rate). The smallest change: reuse the lead's readings of the usage card (`get_usage`), JH
  185's `projusage.js` and the advisor flag `sessions start --advisor` already carries (PR 740); build nothing before
  his yes. Search: `codegraph_explore` was not needed for code (no code changes); `grep -rn rate_limits bin` and the
  relief file for the meter (D1); `ls ~/.js-harness/background/briefs` for the candidate tasks' briefs (D4).
- 2. Raw material: his words, lead transcript `f0959bbd-5f7a-4360-b626-048caf21067f` lines 2320, 2446 and 4186;
  his earlier words on the subject, `odd/tasks/one-model-home.md` S1, S2, S5, S7 (lead transcripts `ea85ec35`
  lines 4744, 5167, 5255, 5299 and the lead's line 11253, 11679); the usage-card readings in the lead's relief file
  (`~/.js-harness/memory-backup/repo/js-harness-home/relief/D--js-harness.md` lines 2498 to 2566); every transcript
  under `~/.claude/projects` written on 2026-11-11 (53 files), summed by window (D1); `odd/tasks/advisor-trial.md`
  L4 and `## Result` (the advisor's tokens a call); the advisor page as JH 185 quoted it (`odd/tasks/model-trial.md`
  L4); `bin/sessions-background.mjs:167-173` (the start refuses Opus); `odd/tasks/land-two-defects.md` (task, D4).
- 3. The bar:
  spec 1: `js-harness contract check odd/tasks/advisor-cost.md`: none, new document.
  spec 2: left out because no command proves every finding of a read answered; the record's `take` entries are read.
  spec 3: left out because its proof is the recorded question, which the lead reads.
- 4. Refutation: could the cost be known with no run at all? Two cheaper tests, run now. (a) Do the transcripts
  track the Fable meter? Yes: over five windows between the lead's readings on 2026-11-11 the weekly Fable meter
  moved 0.20 to 0.31 points a Fable list-dollar, 0.23 overall (30 points for 130.5 USD, D1). So a run's Fable cost is
  read from its transcript, and the meter is needed only where the transcripts cannot speak. (b) Do the transcripts
  say what the advisor draws on? No: the record holds the advisor's tokens (`message.usage.iterations`, type
  `advisor_message`, `odd/tasks/advisor-trial.md` L4) but no session ran with the advisor on 2026-11-11 (no
  `advisor:` row in any window, D1), and the advisor page leaves the meter unsaid (`odd/tasks/model-trial.md` L4).
  The calibration is also made of cached reads mostly (D1), while the advisor reads uncached: its rate on the meter
  can differ. So one run with the advisor and an isolated meter is the least that can answer, and the request holds.
  Verdict: supports
- 5. Request: his request rewritten for this stage, beside his words (L1, L2): "Measure, on one real task of this
  repository, how many points of the weekly Fable limit and of the all-models limit a session spends on Opus 5.5
  with the Fable 5.2 advisor, against the same task on Fable 5.2 at medium, in two to four runs; tell me what that
  costs before anything runs."
  Adds: none

## Specs
1. "A: primero medir el costo del consejero en el límite de Fable (Recomendado)" (L2): a design of 2 to 4 runs
   that measure how much of the weekly Fable limit the advisor spends, with its cost.
2. The design passes its double review before it reaches him (`rule:double-review`).
3. The design and its cost reach him through the lead as one question, and nothing runs before his answer (L2).

## Tasks
- [ ] T1 (kind: design) spec 1: this document, its depth pass and the design below · inline
- [ ] T2 (kind: verify) spec 2: double review, every finding answered · `double-review read`
- [ ] T3 (kind: docs) spec 3: the question recorded for the lead, the notice, the session summary · notify

## The design

### D1. What is measured, and why the reading can be trusted
Two instruments, each used for what it can tell.
- The transcripts, fine-grained: every reply's tokens by model, and the advisor's tokens apart, from
  `message.usage.iterations` entries of type `advisor_message`. JH 185's `projusage.js`
  (`~/.js-harness/background/scratch-kept/8126fdd7-jh185/projusage.js`, read: it sums by model over a run's folder,
  sub-agents included, replies counted once by message id) is reused, priced at list (Fable 5.2 $8 input, $40
  output, $0.20 cache read, $10 cache write; Opus 5.5 $4, $20, $0.20, $5; the claude-api skill's table as JH 185
  read it, not re-read here). One check before it is trusted on an advisor run: that a reply's top-level `usage`
  does not already include its advisor iteration (JH 125's probe printed them apart, `advisor-trial.md` L4; the
  probe of D3 sums both ways and keeps the one whose Fable total matches the meter).
- The usage card, coarse: weekly Fable, weekly all models and the five-hour share, whole points, read by the lead
  with `get_usage` (no command of this repository reads it: `grep -rn rate_limits bin` finds only Codex's reader).
- The calibration, measured 2026-11-11 with a scratch script over the 53 transcripts written that day, between the
  lead's readings (local time; the meter from the relief file, lines 2498 to 2566):

  | Window | Fable list USD | Fable meter | Points a USD |
  |---|---|---|---|
  | 10:16-11:06 | 4.3 | 0 → 2 | 0.47 (two points of rounding) |
  | 11:06-12:59 | 63.0 | 2 → 16 | 0.22 |
  | 12:59-13:56 | 20.0 | 16 → 20 | 0.20 |
  | 13:56-15:03 | 12.9 | 20 → 24 | 0.31 |
  | 15:03-17:02 | 34.6 | 24 → 32 | 0.23 |
  | 11:06-17:02 | 130.5 | 2 → 32 | 0.23 |

  So one point of the weekly Fable meter is about 4.35 USD of Fable at list price, for the mix the sessions ran
  (cached reads were 95 % or more of their input tokens). The all-models meter moved 16 → 31 in the same span, about
  half as fast. What this cannot show: the rate for uncached input, the advisor's whole diet; whether the advisor
  draws on the Fable meter, the all-models meter or usage credits; and use outside these transcripts (claude.ai, the
  phone), which the steady rate suggests was small.

### D2. The four runs
| Run | Arm | What it answers | Meter read isolated |
|---|---|---|---|
| 0, probe | Opus 5.5 + Fable advisor, a heavy-advisor prompt | which meter the advisor draws on, at what rate a USD | yes |
| 1 | Fable 5.2 at medium (today's scheme) | the Fable cost of the task as sessions run it today | no |
| 2 | Opus 5.5 at high + Fable advisor | the Fable and all-models cost of the task in his scheme | no |
| 3 | same as run 2 | how much run 2 varies against itself | no |

- The probe: `claude -p --model opus --advisor fable` in a folder holding a frozen copy of about 150,000 tokens of
  this repository's text, asked to consult the advisor before each of about 12 steps (the advisor cannot be forced,
  L4 of the model-trial document; the prompt asks, and the transcript counts what happened). Target: about 20 USD of
  advisor Fable (12 calls at about 150,000 uncached tokens), about 4.6 points at the calibrated rate, so the meter
  tells "about the same rate" from "none" by more than its rounding.
- Runs 1 to 3: one real task, `land-two-defects` (D4), each from the same base commit and the same brief bytes, in
  a local clone outside any repository with no remote, so nothing can be pushed or landed.
- Held equal across runs 1 to 3: the base commit, the brief's bytes, the CLI version (recorded), the project's
  hooks as the clone carries them, the time limit (D5), and what the brief allows: tests and commits in the clone;
  no push, no pull request, no `codex-review`, no `lens-review`, no gate, no `notify`, no sub-agents. Sub-agents are
  out because the writer type pins `claude-fable-5-2` and `medium` in its file (`.claude/agents/js-harness-writer.md:5-6`,
  read 2026-11-11), which would put Fable into the Opus arm; their share is a limit (D8).
- Not held equal, and measured instead: the number of advisor calls, which the model decides; the run's length.
- Order: run 1 and run 2 at once (both read by transcript), then run 3. The meter is read before and after each run
  as a record, but only the probe's reading is used as a measure.

### D3. The probe's isolation
The meter is account-wide, so for the probe's window (about 20 minutes, estimate) no other Claude session may spend:
the lead rests (`js-harness wait`), the work sessions finish their step and wait, nobody uses claude.ai or the phone.
The lead reads `get_usage` right before and right after, and again 5 minutes later to catch a late count. The other
sessions' transcripts over the same window are summed too: if any Fable reply appears there, its points (at 0.23 a
USD) are subtracted and the probe is marked "not isolated".

### D4. The task
`land-two-defects` (`odd/tasks/land-two-defects.md`): two defects of `merge-queue --land --refresh-copy`, with tests
first; on Fable 5.2 at high it took 1.7 h and about 14 USD at list (`odd/tasks/model-trial.md` L5). Chosen because it
is real code of this repository with tests, finished and merged, of a size that fits a run, and it reached Fable at
high only, so run 1 at medium is new. Its brief file was not kept (`ls ~/.js-harness/background/briefs` holds none
for it); the run brief is rebuilt from its L1, which quotes the brief, and its `## Specs`, then frozen with its
sha256 before run 1. Base: the parent of `ac2a22e1`, its first commit. Equal bytes for all arms is what this trial
needs; fidelity to the original brief is not.

### D5. Limits a run cannot pass
- Time: 4 hours a run (2.4 times the original 1.7 h; JH 125 saw an advisor run take up to 3.3 times as long). At the
  limit the run is stopped and its spend so far counts, marked "cut".
- Spend: the lead reads the usage card at each wake; a run is stopped when the Fable meter rises more than 10
  points over its start (about 43 USD of Fable, three times the original task's whole cost).
- A usage-credits consent prompt stops the run where it appears, and goes to him.

### D6. The rules the runs need excepted
`js-harness sessions start` refuses Opus and any effort but the rule's (`bin/sessions-background.mjs:167-173`), and
`rule:session-model` names Fable 5.2 for every session. So the probe and runs 2 and 3, on Opus at high, need his
exception to `rule:session-model` and `rule:session-effort` for those three runs alone, started with `claude -p`
outside `sessions start`. Run 1 needs none. The exception changes no rule and ends with the trial.

### D7. The trial's cost (an estimate)
| Run | Fable list USD | Opus list USD | Weekly Fable points | Minutes |
|---|---|---|---|---|
| 0, probe | 15 to 25 | 2 to 5 | 3 to 6 | 20 |
| 1 | 7 to 14 | 0 | 2 to 3 | 60 to 120 |
| 2 | 3 to 10 (advisor) | 7 to 25 | 1 to 2 | 90 to 240 |
| 3 | 3 to 10 (advisor) | 7 to 25 | 1 to 2 | 90 to 240 |
| Total | 28 to 59 | 16 to 55 | 7 to 13 | about 5 to 8 hours of wall clock |

How: run 1 at medium below the original 14 USD at high; runs 2 and 3, the executor at Opus's half price per token
but running 1.8 to 3.3 times as long (JH 125), and 3 to 10 advisor calls of 60,000 to 150,000 uncached tokens; the
points from 0.23 a Fable USD, which the probe checks for the advisor. The all-models meter: not estimated in points,
because Opus's weight on it was never measured (the only Opus spend in D1's windows was 4.2 USD); the run records it.
Total at list price: about 45 to 115 USD. Other sessions: they keep working during runs 1 to 3; they pause only for
the probe's 20 minutes. Runs 1 to 3 each hold one of the two work-session slots while they run.
The meter on 2026-11-11 at 17:02 local read 32 % of the weekly Fable limit, resetting 2026-11-13 09:00 local: the
trial's 7 to 13 points are taken from that week if it runs before the reset.

### D8. The criterion, fixed before any run
Let F1 be run 1's Fable points, and F2 and F3 those of runs 2 and 3, each from its transcript at the rate the probe
measured for the advisor (or 0.23 a USD where the probe confirms the advisor draws on the Fable meter like the rest).
- A. The advisor draws on the weekly Fable meter and the larger of F2 and F3 is at most half of F1: the advisor
  scheme halves the Fable limit's use on this task at least. Outcome for him: a question whether to run a smaller
  quality trial of Opus with the advisor (nothing changes before it).
- B. The advisor draws on the weekly Fable meter and the smaller of F2 and F3 is above half of F1: the saving is
  less than half, which does not pay for leaving the model he measured better. Outcome: keep sessions on Fable 5.2 at
  medium and drop the idea, written in the roadmap with these figures.
- C. Anything between (one run under half, one over): no change; the figures are recorded and the idea is dropped
  unless he asks for more runs.
- D. The advisor does not move the Fable meter (the probe's Fable meter moves at most 1 point for 15 USD or more of
  advisor spend) and draws on the all-models meter instead: the Fable question is answered by itself, and the
  all-models points of runs 2 and 3 go to him with the meter's room left in the week. Outcome: a question whether to
  try Opus with the advisor as overflow, with those points.
- E. The advisor bills to usage credits: the trial stops at the probe and the price in money goes to him.
Why half: the runs are one or two a cell, so a smaller gap could be the run's own spread (run 2 against run 3 shows
it); a saving under half is not worth giving up the model he measured better (S1). Neither threshold is tuned on
data.

### D8 limits
- One task, of this repository's process work; two runs of the advisor arm and one of the control, so the control's
  own spread is unmeasured.
- No sub-agents: his idea includes them, and they inherit the advisor (L4 of the model-trial document); their share
  is outside the runs.
- Quality is not measured: an outcome A opens only a question.
- The calibration rests on one day's mix of sessions (D1).

### D9. Where the work continues
This document, on the branch `advisor-cost` cut from `worktree-model-trial` at `4e2ec314`, so that the model-trial
document, its log and JH 185's summary it cites travel with it, while the cost trial keeps a contract of its own
that `check` validates apart from the quality trial he did not choose. The runs, after his yes, continue here.

## Runs
None. Nothing runs before his yes.

## Log
- L1 2026-11-11T19:14:42Z, his words to the lead (transcript `f0959bbd-5f7a-4360-b626-048caf21067f`, line 2320):
  "Me gustaria que investigaramos si seria mejor seguir utilizando Fable 5.2 Alto solo en el orquestador y Opus 5.5
  para las sesione sy subagente pero con el Advisor de Fable 5.2 alto que te parece?"
- L2 2026-11-11T22:35:04Z, his answer to question 265 (same transcript, line 4186, tapped): "A: primero medir el
  costo del consejero en el límite de Fable (Recomendado)". The question it answers said: a session on Fable 5.2
  medium, about 15 to 30 USD, that designs only a cost trial of 2 to 4 runs measuring how much of the weekly Fable
  limit the advisor spends, and returns with its cost before running anything; no run nor rule change authorized.
- L3 The brief (`~/.js-harness/background/briefs/2026-11-11T22-38-14-780Z-71d7af6e.md`): JH 187 continues JH 185's
  work; the design passes its double review, the Claude reader at high (his answer to question 260, read from the
  brief, not from his transcript); report through the lead.
- L4 2026-11-11, the calibration of D1, by a scratch script (`$CLAUDE_JOB_DIR/tmp/window.js`): Fable list USD by
  window 4.3, 63.0, 20.0, 12.9, 34.6; Opus 4.2 in the last window only; Haiku under 0.1; no `advisor:` row.

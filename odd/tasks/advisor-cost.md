## Goal
A committed design, reviewed twice, for a cost trial of four runs that tells the owner how much Fable a work session
spends on one real task when it runs on Opus 5.5 with a Fable 5.2 advisor, against the same task on Fable 5.2 at
medium, and whether the advisor's Fable counts on the weekly Fable meter, with what the trial would cost, put to him
through the lead before anything runs.

## Why
His request (L1) was to find out whether sessions and sub-agents should run on Opus 5.5 with the Fable 5.2 advisor
while the lead stays on Fable 5.2 at high. The quality trial of three arms (`odd/tasks/model-trial.md`) failed its
third double review; asked again, he chose to measure the advisor's cost on the Fable limit first (L2). On 2026-11-10
he measured Fable 5.2 at high better than Opus 5.5 at max "tanto en precio como en inteligencia"
(`odd/tasks/one-model-home.md` S1); on 2026-11-11 a Fable limit stopped the work sessions for 3 h 24 min and he moved
them to medium (S7), and the lead recorded his words that only half of his weekly use can go to Fable (L5, the
lead's paraphrase). Which limit stopped them is not known: the usage card at 10:16 read the weekly Fable meter at
0 % and showed no five-hour window (L5). That earlier comparison was Fable at high against Opus at max; it says
nothing of Opus with an advisor, so this trial settles no quality question, and every outcome returns to him.

## Done when
- `js-harness contract check odd/tasks/advisor-cost.md` exits 0
- The double-review record holds a `take` entry for both readers of every read of this document; no command checks
  this whole, so it is read in the record (`js-harness double-review tally --since 2026-11-11`)
- The lead holds a recorded question that puts the trial and its cost to him (`notify --kind question`), and this
  session's `waiting` or `closed` notice names it

## In scope / Out of scope
- In: this document; the session summary under `docs/sessions/`; this session's scratch.
- Out: running any run, the probe included (his yes, not given); changing a rule, a model, an effort or the advisor
  setting (his); building the run folders, the watcher or the briefs before his yes; anything under `~/.claude`;
  the quality of the arms' work (the quality trial, which he did not choose); the all-models meter as a measure (D8).

## Constraints
- Nothing runs before his yes — because the runs spend his plan and need his exception to two rules (D6).
- The criterion and the validity rules are fixed here, before any run — because a criterion written after the
  results bends toward them (JH 125's constraint, `odd/tasks/advisor-trial.md`).
- The size is what he chose: 2 to 4 runs (L2). No outcome changes a model, an effort or a rule: each ends in a
  question to him with the figures.

## Ask me before
Running the trial and its maximum (D7); the exception to `rule:session-model` and `rule:session-effort` for the
three Opus runs (D6); the threshold of D9 and the Opus effort (D2), both his to set; pausing every other session for
the probe's window (D3); a consent prompt for usage credits, which stops the run where it appears.

## Depth pass
- 1. Method: metering, the discipline of a capacity engineer who must know what a workload draws from a quota they
  can read only coarsely: calibrate the coarse meter against a fine-grained record, measure the workload in the fine
  record, and spend an isolated reading of the coarse meter only on what the record cannot tell (here, whether the
  advisor's Fable counts on the Fable meter, and at what rate). Before any figure is used, the instruments are
  validated on the run itself (models, calls, the script against the CLI's own totals). The smallest change: reuse
  the lead's usage-card readings (`get_usage`), JH 185's `projusage.js`, JH 125's check of a usage script against
  the CLI's `result` line (`odd/tasks/advisor-trial.md`), and the eval sandbox's home and switches
  (`evals/configs.mjs`); build the run folders and a watcher only after his yes. Search: `grep -rn rate_limits bin`
  (only Codex's reader); the relief file for the readings; `find ~/.js-harness ~/.claude/jobs -name '*8e1e332a*'`
  and `grep 'two defects of the land'` over the transcripts for the task's brief (D4).
- 2. Raw material: his words, lead transcript `f0959bbd-5f7a-4360-b626-048caf21067f` lines 2320, 2446 and 4186;
  his earlier words, `odd/tasks/one-model-home.md` S1, S2, S5, S7; the lead's relief file
  (`~/.js-harness/memory-backup/repo/js-harness-home/relief/D--js-harness.md` lines 2498 to 2566: the stop, the
  usage-card readings, his words on half the week for Fable); the 54 transcripts under `~/.claude/projects` written
  on 2026-11-11, summed by window and by who spent (D1); `odd/tasks/advisor-trial.md` (L4 of its log: the probe
  whose short names ran `claude-fable-5-1`; `## Result`: the advisor's tokens a call and the run lengths); the
  advisor page as JH 185 quoted it (`odd/tasks/model-trial.md` L4); `bin/sessions-background.mjs:167-173`;
  `odd/tasks/land-two-defects.md` and its brief in the old lead's transcript `ea85ec35-82e1-4aa9-abe3-98bd153a50b0`
  from line 6459 (D4); `evals/prices.mjs:29-32` (no Fable 5.2 row).
- 3. The bar:
  spec 1: `js-harness contract check odd/tasks/advisor-cost.md`: PASS since `cbd75897`.
  spec 2: left out because no command proves every finding of a read answered; the record's `take` entries are read.
  spec 3: left out because its proof is the recorded question, which the lead reads.
- 4. Refutation: could the cost be known with no run? Two cheaper tests, run now. (a) Do the transcripts track the
  Fable meter? Yes, for ordinary sessions: over four windows between the lead's readings the weekly Fable meter
  moved 0.20 to 0.31 points a Fable list-dollar, 0.23 overall (30 points for 130.5 USD; a fifth, 4.3 USD, is too
  small to read, D1). (b) Do the records say what the advisor draws on? No: no session ran with the advisor on
  2026-11-11 (no `advisor:` row, D1); on 2026-10-31 JH 125's four arms spent about 6 USD of advisor Fable with the
  weekly Fable meter at 0 % before them, and the lead's later readings that day do not separate it (L6), so it is too
  small to tell; the advisor page leaves the meter unsaid. The ordinary calibration is mostly cached reads, the
  advisor's is uncached, so its rate can differ. One isolated advisor reading is the least that can answer.
  Verdict: supports
- 5. Request: his request rewritten for this stage, beside his words (L1, L2): "Measure, on one real task of this
  repository, how much Fable a session spends when it runs on Opus 5.5 with the Fable 5.2 advisor, against the
  same task on Fable 5.2 at medium, and whether the advisor's Fable counts on the weekly Fable limit, in two to four
  runs; tell me what that costs before anything runs."
  Adds: none

## Specs
1. "A: primero medir el costo del consejero en el límite de Fable (Recomendado)" (L2): a design of 2 to 4 runs
   that measure how much of the weekly Fable limit the advisor spends, with its cost.
2. The design passes its double review before it reaches him (`rule:double-review`).
3. The design and its cost reach him through the lead as one question, and nothing runs before his answer (L2).

## Tasks
- [x] T1 (kind: design) spec 1: this document, its depth pass and the design below · inline · cbd75897
- [ ] T2 (kind: verify) spec 2: double review, every finding answered · `double-review read` · L7
- [ ] T3 (kind: docs) spec 3: the question recorded for the lead, the notice, the session summary · notify

## The design

### D1. What is measured, and why the reading can be trusted
- The transcripts, fine-grained: every reply's tokens by model, and the advisor's apart, from
  `message.usage.iterations` entries of type `advisor_message`. JH 185's `projusage.js` (read: it sums a run's
  folder by model, sub-agents included, replies counted once by message id) is reused only after it reproduces, on
  each run, the per-model usage the CLI prints in its final `result` (`--output-format json`), executor and advisor
  apart, as JH 125's `usage.js` did. Where it does not, the CLI's totals are used and the gap is reported. This
  settles whether a reply's `usage` already holds its advisor iteration without leaning on the meter.
- The unit: Fable list USD, a yardstick only. Prices as JH 185 read them from the claude-api skill (Fable 5.2 $8
  input, $40 output, $0.20 cache read, $10 cache write; Opus 5.5 $4, $20, $0.20, $5), not verified here
  (`evals/prices.mjs` has no Fable 5.2 row and prices 1-hour writes apart, at $8 for Opus). The figures compare
  runs measured with the same table, so a wrong price shifts every run alike, except where the mix differs: an
  error in the cache-read price moves the calibration, made 95 % of cache reads, and not the advisor, which reads
  uncached. That is why the probe measures the advisor's rate on the meter directly.
- The usage card, coarse: weekly Fable and weekly all models, whole points, read with `get_usage` (no command of
  this repository reads it). It shows no five-hour window (L5).
- The calibration, by a scratch script over the day's transcripts (L4), local time:

  | Window | Fable list USD | Fable meter | Points a USD |
  |---|---|---|---|
  | 10:16-11:06 | 4.3 | 0 → 2 | too small to read |
  | 11:06-12:59 | 63.0 | 2 → 16 | 0.22 |
  | 12:59-13:56 | 20.0 | 16 → 20 | 0.20 |
  | 13:56-15:03 | 12.9 | 20 → 24 | 0.31 |
  | 15:03-17:02 | 34.6 | 24 → 32 | 0.23 |
  | 11:06-17:02 | 130.5 | 2 → 32 | 0.23 (0.21 to 0.25 with a point of rounding each end) |

  It is an upper bound on the true rate a visible USD: the lens and double-review readers run with
  `--no-session-persistence` (`bin/lens-review.mjs:75`, `bin/double-review.mjs:184`) and leave no transcript, and
  JH 185's three reads ran inside the last window. Of the 130.6 USD, the work sessions' main threads spent 89.1
  (68 %), the lead 34.2 (26 %) and sub-agents 7.3 (6 %) (L4): the scheme he proposes touches about 74 % of the day's
  visible Fable.

### D2. The four runs
| Order | Run | Arm | What it answers | Meter read isolated |
|---|---|---|---|---|
| 1 | probe | `claude-opus-5-5` + `claude-fable-5-2` advisor, a heavy-advisor prompt | whether the advisor counts on the weekly Fable meter, and its rate | yes |
| 2 | control | `claude-fable-5-2` at medium (today's scheme) | the Fable a session spends on the task today | no |
| 3 | advisor 1 | `claude-opus-5-5` + `claude-fable-5-2` advisor | the Fable the task spends in his scheme | no |
| 4 | advisor 2 | same as advisor 1 | how much the advisor arm varies against itself | no |

- One command for every run, differing only in model, effort and advisor:
  `claude -p --model <id> --effort <level> [--advisor claude-fable-5-2] --output-format json --permission-mode
  bypassPermissions "<frozen brief>"`, in the eval sandbox's home and switches (`evals/configs.mjs`), with the CLI
  at 2.1.321 or later (its version recorded; 2.1.322 on 2026-11-11). Full ids, never `opus` or `fable`: the short
  names ran `claude-fable-5-1` as the advisor on 2026-10-31 (L6). The command is dry-started once, to its first
  reply, before the probe; a failure there stops the trial and goes to him.
- Opus's effort: high, the lead's proposal, not in his words (L1 names no effort for Opus; S1 compared Opus at
  max). It is his to set in the question. The advisor has no effort setting of its own (the advisor page, as JH 185
  quoted it), so his "Advisor de Fable 5.2 alto" cannot be set as such.
- Why the fourth run is a second advisor run and not a second control: the advisor's call count is the model's
  choice and swings most (JH 125: 1 to 2 calls a plan); the control's own spread stays unmeasured (D10).
- The probe: in a folder holding a frozen copy of about 150,000 tokens of this repository's text, a prompt that asks
  the executor to consult the advisor before each of a series of steps; it is invoked again until the transcripts
  count at least 30 USD of advisor Fable, about 7 points at the calibrated rate, so one point of rounding is about
  14 % of the rate. If after 45 minutes the count is under 15 USD, the probe is inconclusive (D9).

### D3. The probe's isolation
The meter is account-wide, so for the probe's window (45 minutes, estimate: JH 125 saw each advisor call add 3 to 4
minutes) no other Claude spend may run: every work session reaches a commit and waits, no gate, no `codex-review`
that calls a Claude lens, no `lens-review`, no `double-review`, the lead rests on `js-harness wait`, and nobody uses
claude.ai or the phone. The probe is launched by a detached script with a 5-minute delay, so the session that
starts it is idle by then. The meter is read before, after and 5 minutes after by the owner on the usage page when
he is there, otherwise by a fresh small session that only calls `get_usage`; the readers' own replies are summed
from their transcripts and reported beside the result, not converted at the ordinary rate. Any Fable reply found in
another transcript inside the window marks the probe "not isolated", and it is not used (D9).

### D4. The task
`land-two-defects` (`odd/tasks/land-two-defects.md`): two defects of `merge-queue --land --refresh-copy`, with tests
first; on Fable 5.2 at high it took 1.7 h and about 14 USD at list (`odd/tasks/model-trial.md` L5). Real code of
this repository with tests, finished and merged, of a size that fits a run, and never run at medium. Its brief was
written by the lead into the old lead's transcript (`ea85ec35-82e1-4aa9-abe3-98bd153a50b0`, from line 6459; the file
itself, `2026-11-11T05-20-31-884Z-8e1e332a.md`, is not on disk). The run brief is that text whole, with two changes
written beside it: no push, no pull request, no reviews, no notify, no sub-agents, no gate; and never run
`merge-queue --land` or `--refresh-copy` for real, only the task's tests. It is frozen with its sha256 before the
control. Base: `7525a4e5`, the parent of `ac2a22e1`, the task's first commit. The folder is `git archive` of the
base plus a fresh `git init`, under `D:\advisor-cost-runs\<run>` (`D:/` is trusted, `odd/tasks/advisor-trial.md`
L7), so neither the later history nor a remote is in it; the agent-type files are the base's. With the sandbox's
home and a PATH without the installed `js-harness`, a real refresh cannot reach the installed copy; what still leaks
is named at the build (memory servers, the user's global settings), as JH 185's review listed (L7).

### D5. A run's validity, fixed before any run
A run counts only when all hold; otherwise it is void, its spend is reported, and it never enters the comparison:
- every executor reply is the run's model id, and every `advisor_message` is `claude-fable-5-2`;
- no sub-agent ran;
- `projusage.js` reproduces the CLI's per-model totals (D1);
- for the control and the advisor runs, the task is done: `node --test bin/lib/refresh-copy.test.mjs` and
  `node --test bin/lib/depth-pass.test.mjs` exit 0 in the run's folder, with a test for each defect added by the
  run (the task's own Done when, `odd/tasks/land-two-defects.md:13-14`); this checks completion, not quality;
- for the advisor runs, at least one advisor call; an advisor run with none is void as "no advisor" (the scheme
  then was Opus alone, which this trial does not judge);
- for the probe, isolation held (D3) and at least 15 USD of advisor Fable.
A void run is not run again without his word.

### D6. The rules the runs need excepted
`js-harness sessions start` refuses Opus and any effort but the rule's (`bin/sessions-background.mjs:167-173`), and
`rule:session-model` names Fable 5.2 for every session. The probe and the two advisor runs, on Opus, need his
exception to `rule:session-model` and `rule:session-effort` for those three runs alone. All four start with the one
command of D2, outside `sessions start`, so the control is started the same way. The exception changes no rule and
ends with the trial.

### D7. The trial's cost and its maximum (an estimate)
| Item | Fable list USD | Opus list USD | Weekly Fable points | Wall clock |
|---|---|---|---|---|
| probe | 30 to 35 | 3 to 6 | 7 to 8 | 45 min |
| control | 7 to 14 | 0 | 2 to 3 | 1 to 2 h |
| advisor 1 | 5 to 24 | 7 to 25 | 1 to 6 | 2 to 6 h |
| advisor 2 | 5 to 24 | 7 to 25 | 1 to 6 | 2 to 6 h |
| the session that builds and drives the runs, the lead's wakes, the pause | 15 to 30 | 0 | 3 to 7 | 5 to 9 h in all |
| Total | 62 to 127 | 17 to 56 | 14 to 30 | 5 to 9 h |

How: the control at medium, under the original 14 USD at high; each advisor call 150,000 to 250,000 uncached tokens
(a run near its window's end, as JH 175 was, re-reads all of it) at $8 a million, plus about 10,000 output tokens at
$40 (JH 125), so 1.6 to 2.4 USD a call, 3 to 10 calls; the Opus executor at half Fable's price per token but running
1.8 to 3.3 times as long (JH 125); points at 0.23 a USD, which the probe checks for the advisor. Total at list
price: about 80 to 185 USD, 14 to 30 points of the weekly Fable limit. Other sessions pause only for the probe's
45 minutes; the control and the advisor runs go two at a time, the control beside advisor 1, then advisor 2, beside
whatever else the lead runs. The meter at 17:02 local on 2026-11-11 read 32 %, resetting 2026-11-13 09:00 local.

The maximum put to him: 200 USD at list and 35 weekly Fable points for the whole trial; per run, 35 USD of Fable,
35 USD of Opus and 6 hours. A watcher script (no model) sums each run's folder every 2 minutes and stops the
process at a per-run maximum, so a run overshoots by at most about 2 minutes of spend; a run stopped this way is
void (D5). The lead reads the card at each wake as an account-level guard only.

### D8. What the trial does not measure
The all-models meter is not attributed: the advisor runs share the account with other sessions, and in the probe
the Opus executor and the advisor move it together. Its readings are recorded account-wide, as context. Nor the
limit that stopped the sessions on 2026-11-11, which the card did not show (L5).

### D9. The criterion, fixed before any run
The probe first gives the advisor's rate r_a on the weekly Fable meter, with its interval from a point of rounding
each end; the ordinary rate is r_o = 0.23 (0.21 to 0.25). F_c is the control's Fable USD; F_1 and F_2 the advisor
runs' advisor Fable USD; each is turned into points at its own rate, with its interval.
- P1. The probe is void or inconclusive: the trial stops there; the spend and the reason go to him, with the
  question whether to probe once more.
- P2. The advisor does not move the weekly Fable meter (at most 1 point for 15 USD or more of advisor Fable, with
  no credits used): where it is charged is not shown by this trial; the advisor runs then measure Opus's spend,
  and he gets that, with the question whether to go on.
- P3. The advisor bills to usage credits: the trial stops at the probe and the price in money goes to him.
- P4. The advisor counts on the Fable meter: the runs proceed, and the outcome is read on the intervals:
  - A. The upper bound of the larger advisor run is at most the threshold times the lower bound of the control:
    the scheme spends clearly less of the Fable limit on this task.
  - B. The lower bound of the smaller advisor run is above the threshold times the upper bound of the control: it
    clearly does not save that much.
  - C. Anything else: not resolved at this size.
  Each of A, B and C reaches him as figures, with the session share of D1 (a saving on sessions moves about 74 % of
  the visible Fable), and a question: A, whether to run a smaller quality trial; B, whether to drop the idea; C,
  whether to drop it or run more. Nothing changes before his answer.
The threshold is his to set; the proposal put to him is one half, because with one or two runs a cell a smaller
gap could be the runs' own spread. It is not tuned on data.

### D10. Limits
- One task, of this repository's process work; one control run, so the control's own spread is unmeasured.
- No sub-agents: his idea includes them, and they inherit the advisor; their share (6 % of the day's visible Fable,
  D1) is outside the runs.
- Quality is not measured; completion is checked only by the task's tests.
- The calibration rests on one day's mix of sessions and is an upper bound a visible USD (D1).

### D11. Where the work continues
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
- L4 2026-11-11, the calibration of D1, by a scratch script (`$CLAUDE_JOB_DIR/tmp/window.js`) over 54 transcripts:
  Fable list USD by window 4.3, 63.0, 20.0, 12.9, 34.6; Opus 4.2 in the last window only; Haiku under 0.1; no
  `advisor:` row. Split of 11:06-17:02 by who spent: work sessions 89.1, the lead (`f0959bbd`) 34.2, sub-agents 7.3.
- L5 The lead's relief file, line 2498 (10:17 local, 2026-11-11): "the Fable limit was reached at 06:50 local"; the
  card at 10:16 "weekly all models 16%, weekly Fable 0%, resets 2026-11-13 09:00 local [...] it shows no 5-hour
  window, so which limit was hit is NOT known". Line 2501 (10:35): "His words: only 50% of his weekly use can go to
  Fable" (the lead's paraphrase, not his words as written).
- L6 `odd/tasks/advisor-trial.md` L3 and L4: the meter at 14:17Z on 2026-10-31 read weekly Fable 0 %; the probe
  `claude -p --model opus --advisor fable` ran one advisor call by `claude-fable-5-1`.
- L7 Double review `dcf9c9a7` of `cbd75897` (Claude 13 findings, 872,331 tokens; Codex 8, 286,158; its cost, said
  before it ran: about 1.1 M Claude and 0.9 M Codex tokens, 1 % of Codex's weekly limit). All 21 taken, the design
  rewritten: the stop's limit is not known and the five-hour window is not shown (Claude 1: Why and D8 say so); full
  model ids, effort and validity rules (Claude 2, Codex 5); the probe sized by spend, the criterion on intervals with
  inconclusive outcomes (Claude 3, Codex 1, Codex 3); a completion check and a time limit above the worst case
  (Claude 4); per-run maxima by a watcher over the run's own transcript and a trial maximum (Claude 5, Codex 4); one
  launch command, `git archive` folders, the sandbox home, no real refresh (Claude 6, Codex 6); the all-models
  meter out (Claude 7, Codex 2); isolation without the lead's reads, 45 minutes, readers named (Claude 8); his words
  not stretched, threshold and effort his, every outcome a question, the session share measured (Claude 9, Codex 8);
  costs recomputed with the driver and the pause, prices said unverified (Claude 10); the brief found (Claude 11);
  the script checked against the CLI, not the meter (Claude 12, Codex 7); small errors (Claude 13). Rebutted: none.
- L8 Which model wrote it: this session runs on `claude-opus-5-5` at medium, not Fable 5.2 at medium as question 265
  said (the lead started it naming no model). His answer to question 266 (lead transcript `812b728f`, line 748,
  2026-11-11T22:57:43Z, tapped): "Que termine en Opus (Recomendado)": the double review is finished on Opus, and
  the session moves to Fable 5.2 medium only if it fails. The readers ran on `claude-fable-5-2` and `gpt-6.1-sol`.

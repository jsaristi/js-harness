## Goal
A committed design, reviewed twice, for a three-arm trial on real code that tells the owner whether work sessions
and their sub-agents should run on Opus 5.5 at high with a Fable 5.2 advisor, on Opus 5.5 at high alone, or stay on
Fable 5.2 at medium, and what the trial would cost, put to him through the lead before anything runs.

## Why
His words (L1): investigate keeping Fable 5.2 at high only in the orchestrator and running the sessions and
sub-agents on Opus 5.5 with the Fable 5.2 advisor. His tapped answer to question 264 (L2) put this trial first. His
yes covers designing the trial and bringing its cost; running it and any change of model, effort or advisor rule
return to him through the lead (the brief of this session).

## Done when
- `js-harness contract check odd/tasks/model-trial.md` exits 0
- `js-harness double-review tally --since 2026-11-11` lists a read of this document with every finding taken or
  rebutted
- The lead holds a recorded question that puts the trial and its cost to him (`notify --kind question`), and this
  session's `waiting` notice names it

## In scope / Out of scope
- In: this document; the session summary under `docs/sessions/`; this session's scratch.
- Out: running any arm (his yes, not given); changing a rule (`rules change`, `rules switch`), a model, an effort or
  the advisor (his); building the trial's runner or keys before his yes (cost he has not approved); anything under
  `~/.claude`.

## Constraints
- No arm runs before his yes — because the brief says so and the arms spend his plan.
- The criterion and the scoring are fixed here, before any arm runs — because a criterion written after the results
  bends toward them (JH 125's constraint, kept).
- Each limit `odd/tasks/advisor-trial.md` `## Result` names is answered or said to remain — because repeating them
  makes a second trial that cannot decide.

## Ask me before
Running any arm; the exception to `rule:session-model` and `rule:session-effort` that arms 2 and 3 need (and arm 1,
see D3); any spend beyond the trial's estimate; a usage-credits consent prompt.

## Depth pass
- 1. Method: a controlled A/B/C comparison of model configurations on real tasks, the discipline of an ML
  evaluation engineer measuring agents: freeze the tasks, the inputs, the scoring and the criterion before any run;
  vary one thing between two arms; repeat each cell so the spread of one arm against itself is measured before a
  gap between arms is called a difference; score blind; report cost by meter, not only by result. The smallest
  change that meets it: reuse what exists (`sessions start`'s argument list with `--advisor`, PR 740; JH 125's
  `usage.js`, which reads advisor iterations; `codex-review` as a fixed reviewer; JH 181's `tellsApart` idea of a gap
  above the spread) and build only the per-task scoring (acceptance checks and defect keys), after his yes. Search:
  `codegraph_explore` over `evals/` (suite, configs, rule-proof, transcript-usage) and `bin/sessions-background.mjs`;
  `grep advisor evals/*.mjs` found none; `js-harness rules session-model|session-effort|lead-effort`.
- 2. Raw material: his words, lead transcript `f0959bbd-5f7a-4360-b626-048caf21067f` lines 2320 and 2446; the only
  earlier measurement, `odd/tasks/advisor-trial.md` (`## Arms`, `## Result`); the eval results
  `evals/results/headroom.json`, `headroom-current.json`, `ab-high.json`; the transcripts of six recent code sessions
  under `~/.claude/projects/D--js-harness--claude-worktrees-*` (summed by model, L5); the advisor page
  https://code.claude.com/docs/en/advisor.md, read 2026-11-11 (L4); list prices from the claude-api skill's model
  table (cached 2026-11-03): Fable 5.2 $8 input, $40 output, $0.20 cache read; Opus 5.5 $4, $20, $0.20;
  `bin/sessions-background.mjs:163-173` (the start reads the rules of its folder's git top level and refuses another
  model or effort); `bin/lib/guard.mjs:43-59` (a sub-agent call that names no model and no effort passes); the
  candidate tasks' pull requests 807, 817 (with its follow-up 819) and 816, their first commits b91e74ef, e0ab4ebf,
  ac2a22e1 and their review records in `.git/js-harness/codex-review-runs.jsonl` and `lens-reviews.jsonl`.
- 3. The bar:
  spec 1: `js-harness contract check odd/tasks/model-trial.md`: none, new document.
  spec 2: `js-harness double-review tally --since 2026-11-11`: none, no read of this document yet.
  spec 3: left out because its proof is the recorded question, which the lead reads; no command judges a design's
  fitness for his decision.
- 4. Refutation: could the trial be run on what exists, the eval suite's coding cases, at no build cost? Their
  record says no: Opus 5.5 scores at the ceiling on all five coding cases at medium and at high, minimal or current
  (`node -e` over the three result files, L6: 60 trials, every score 0.98 or 1.00). A case where the weakest arm
  already scores 1.00 cannot show an arm better, so quality must be read on real tasks with a defect key. Could the
  arms be started with `sessions start` as the brief assumes? No: the start refuses a model or an effort that its
  folder's rules refuse (`bin/sessions-background.mjs:167-173`), and each candidate base declares
  `session-model: claude-fable-5-2` at effort high (PR 813, merged before all three bases); the arms need his
  exception (D3). Neither finding refutes his request; both change how it is run.
  Verdict: supports
- 5. Request: his request rewritten, beside his words (L1): "Design a trial on real code from this repository that
  tells, with its own noise measured, whether sessions and sub-agents should run on Opus 5.5 high with the Fable 5.2
  advisor, on Opus 5.5 high alone, or on Fable 5.2 medium as today, scoring quality blind and reading what each
  spends of the Fable meter and of the all-models meter and how long it takes; fix its criterion before any run, say
  what each outcome would change in my rules, and bring me its cost before it runs."
  Adds: none

## Specs
1. "Me gustaria que investigaramos si seria mejor seguir utilizando Fable 5.2 Alto solo en el orquestador y Opus 5.5
   para las sesione sy subagente pero con el Advisor de Fable 5.2 alto que te parece?" (L1): the trial's design.
2. The design passes its double review before it reaches him (`rule:double-review`).
3. "La prueba de modelos primero (Recomendado)" (L2): the design and its cost reach him through the lead as one
   question, and nothing runs before his answer.

## Tasks
- [ ] T1 (kind: design) spec 1: this document, its depth pass and the design below · inline · this commit
- [ ] T2 (kind: verify) spec 2: double review of the design, every finding answered · `double-review read`
- [ ] T3 (kind: docs) spec 3: the question recorded for the lead, `waiting` notice, session summary · notify

## The design

### D1. The arms
| Arm | Session and sub-agents | Effort | Advisor | Draws on the Fable meter |
|---|---|---|---|---|
| 1, today | `claude-fable-5-2` | medium | none | everything |
| 2, his idea | `claude-opus-5-5` | high | `claude-fable-5-2` (sub-agents inherit it) | the advisor's calls |
| 3, control | `claude-opus-5-5` | high | none | nothing |

Kept as the lead proposed them. Arm 3 is what tells whether the advisor adds anything: without it a gain of arm 2
over arm 1 could be Opus at high, not the advisor. The lead (Fable 5.2 at high, `rule:lead-effort`) is the same in
every arm and is not tested: the trial measures work sessions only. Not added: Fable 5.2 at high for the sessions
(his rule moved off it today, `rule:session-effort` medium since 2026-11-11), and Opus at medium (no one proposed it);
each extra arm adds a third of the trial's cost.

### D2. The tasks: three real pieces of work, replayed from their base
Real code from this repository, where the eval cases cannot tell arms apart (depth pass item 4). Each task is a
merged pull request whose work started from a written unit, whose reviews found real defects after the first code,
and whose size is a session's implementation, not a feature:

| Task | Pull request | Base (the parent of its first commit) | Size merged | Why it is a good probe |
|---|---|---|---|---|
| A | 807, the Stop hook's checks (audit unit 2) | `6ee974dd` | +227/-28, 8 files | a guard pattern where an off-by-one turns back every reply |
| B | 817 with 819, `fetch`'s refusal of a key in a path or a query (audit unit 10) | `7525a4e5` | +394/-14, then +266/-47 | 819 fixed what 817's reviews missed: a defect a stronger plan could anticipate |
| C | 816, the land's false prune alarm and the order control | `7525a4e5` | +562/-12, 12 files | concurrency and git state, where review found defects |

Each arm gets the same brief: the work unit's text as it stood at the base (task A and B: their unit of
`docs/proposals/2026-11-10-audit-triage.md`; task C: the lead's brief, recovered from the start record), with its
"Done when" commands, and a fixed preamble: implement it with its tests in this folder, run the named tests and the
whole suite once, commit locally, push nothing, start no review, send no notice, ask nothing (nobody answers), name
no model and no effort on a sub-agent call. The folder is a `git archive` of the base with a fresh `git init` and
one commit, so `git log` cannot show the arm the work it is doing (JH 125's constraint), under `D:\model-trial-arms\`,
a trusted sibling of the repository (JH 125's L7). The brief text, its sha256 and each base are committed here
before the first run. Task C is replaced by pull request 801 (+154/-7) if its brief cannot be recovered whole.

### D3. How the arms are started, and the exception they need
`sessions start` refuses, in a folder whose rules declare `session-model` and `session-effort`, any other model or
effort; the three bases declare Fable 5.2 at high (PR 813). No arm passes it, arm 1 included (medium). Each arm is
therefore started with the argument list `startArgs` builds (`bin/lib/background.mjs:58`): `claude --bg --model <m>
--effort <e> [--advisor claude-fable-5-2] --name "JH 185 · arm <n> task <t> run <r>"`, with Remote Control off, from
its folder, and recorded in `## Runs` below. Inside an arm, a sub-agent call that names no model and no effort passes
the guard (`bin/lib/guard.mjs:43-59`) and runs on its session's model, effort and advisor. This is an exception to
`rule:session-model` and `rule:session-effort` for the trial's 18 runs and nothing else: his yes to the trial grants
it, no rule changes, and nothing outside `D:\model-trial-arms\` runs on another model. Once JH 172's `rules switch`
exists (its T7), the trial still needs this exception, since a switch changes the rule for every session; what the
switch changes is the step after the verdict: the outcome he picks becomes one `rules switch` instead of one
`rules change` a rule.

### D4. Repeats, order and the machine
Two runs a cell: 3 arms x 3 tasks x 2 = 18 runs. One run a cell would repeat JH 125's limit (no spread measured);
three would cost half as much again (D7) and the spread of two already decides the criterion's non-overlap test.
Runs go one at a time, in blocks of one arm so the meter can be read per arm: wave 1 arms 3, 2, 1 (each over tasks
A, B, C), wave 2 arms 1, 2, 3, reversed so drift in the day does not favour an arm. A run starts only when the board
shows no other work session working and no gate running, so the meter read around it is its own. A run has 120
minutes; one cut by the clock or by a fault of the machine (not of the model) is rerun once after its cause is read;
one that ends with failing tests is a result, not a fault.

### D5. Quality: how a run is scored, blind
Each run gets a count of faults F, lower is better, from four parts fixed before any run:
1. Acceptance: the task's checks, written before any run from the merged pull request's behaviour and the unit's
   "Done when", against interfaces that exist at the base or that the unit names (a CLI call and its exit and
   output, an exported function the unit names): each check that fails is one fault. The merged pull request's own
   tests are run too, as a diagnostic only, since they name internals an arm may name otherwise.
2. The defect key: each defect the real reviews found after the first code (Codex, lenses, verifier, the follow-up
   pull request), stated as a behaviour, as JH 125's keys were; each one present in the run's code is a fault,
   judged by a probe command where one can show it and otherwise by the readers of part 4.
3. A fresh review: `js-harness codex-review` of the run's diff at its fixed lean settings; each P0 to P2 finding
   that the readers confirm is a fault.
4. Regressions: tests of the whole suite that pass at the base and fail after the run; each is a fault.
The readers: one Claude reader at high on Fable 5.2 (his answer to question 260 for the double review's reader,
applied here) and one Codex reader, each given a task's six diffs under labels drawn by a coin, the key, and the
fresh findings; the mapping is kept aside until both verdicts are in. Where the two disagree on a key item, the item
is a fault only when a probe command shows it.

### D6. Cost: what is read, and how
- Tokens by model, per run, from its transcripts (main thread and sub-agents): the session's usage once per API
  message id, the advisor's from `message.usage.iterations` entries of type `advisor_message`, as JH 125's
  `usage.js` reads them (it is copied into this repository's scratch and extended to the sub-agents' transcripts
  before the first run). Priced at list, by model: Fable dollars, Opus dollars, total. This is the primary measure,
  and the only one that separates runs.
- The plan meters: the lead reads claude.ai Settings, Usage (weekly all models, weekly Fable, five-hour) before and
  after each block of three runs, with nothing else working. Each block is one arm, so the deltas are per arm. Arm 3's
  blocks show whether Opus moves the Fable meter (it should not); arm 2's show whether the advisor's calls draw on the
  weekly Fable limit, which the advisor page does not say (L4). Points a list dollar, by meter, are read from the
  blocks, and each run's dollars are turned into points with them; an estimate, since the meter moves in whole
  percents.
- Minutes: from each run's first to last transcript entry.

### D7. What the trial would cost (an estimate)
Base of the estimate (L5): six recent code sessions on this machine cost $7 to $27 at list each, whole (reviews,
gates and waits included), 1.7 to 4.4 hours; the advisor arms of JH 125 made 2 calls each in 10 to 12 minutes of
planning, at about 250,000 Fable input tokens, never cached. An arm here does only the implementation, so it is put
at half a whole session, with the advisor making 3 to 6 calls on a context of 150,000 to 250,000 tokens:

| Arm | A run, list dollars | Of it Fable | 6 runs | Of it Fable |
|---|---|---|---|---|
| 1, Fable medium | $6 to $12 | all | $36 to $72 | $36 to $72 |
| 2, Opus high + advisor | $9 to $21 | $5 to $13 | $54 to $126 | $30 to $78 |
| 3, Opus high alone | $4 to $8 | none | $24 to $48 | none |
| Runs | | | $114 to $246 | $66 to $150 |

Beside the runs: the per-task keys and acceptance checks and the 18 diffs' scoring, one session on Fable 5.2 at
medium, about $10 to $25; 18 Codex reviews of a run's diff, about 100,000 to 500,000 Codex input tokens each
(`codex-review`'s own estimate gives the figure for each before it runs); two readers a task, 6 reads. Time: 18 runs of
40 to 90 minutes each, one at a time, 12 to 27 hours of the machine, about two days with the waits for a free board;
nothing else runs during a run. Whether the plan's limits hold this is read on the meter before each block: a block
does not start when the weekly Fable meter is above 70 % (a figure for him to change).

### D8. The criterion, fixed before the first run
For a task, arm X is better than arm Y when X's worse run has fewer faults than Y's better run (the ranges of their
two runs do not overlap); otherwise they are not told apart on that task. Arm X is better than arm Y when it is better
on at least two of the three tasks and worse on none. An arm-2 run whose transcript shows no advisor call is kept (it
is what the advisor does by default; no instruction asks it to consult) and is named in the result; when half or more
of arm 2's runs made no call, the result says the advisor was barely used and arm 2 is read as untested.

What each outcome would change, all of it his to decide:
| Outcome | What it means | What he would be asked |
|---|---|---|
| Arm 2 better than arm 3, not worse than arm 1, and fewer Fable points than arm 1 | his idea holds | `session-model` to Opus 5.5, `session-effort` to high, and an advisor rule (new) for sessions and sub-agents; the lead stays on Fable 5.2 at high |
| Arm 2 not better than arm 3, and arm 3 not worse than arm 1 | the advisor adds nothing; Opus high alone is as good | `session-model` to Opus 5.5 at high, no advisor; Fable only for the lead |
| Arm 1 better than arm 2 and arm 3 | today's scheme is best | nothing changes |
| No arm better than another anywhere | a difference, if any, is smaller than two runs can show | the cheapest on the meter that binds him, as "no loss measured", with what the trial cannot show |
| Any other (an arm better but dearer) | a trade | the figures, quality against points, for him to weigh |

### D9. What this trial still cannot show
Three tasks, all this repository's harness code; two runs a cell, so a small difference stays unseen; the readers are
models, held by a probe only where one exists; the lead and the review pipeline are the same in every arm, so their
effect on a real session's quality is not measured; the advisor's text is encrypted, so why it helped or not cannot
be read; list dollars stand in for the plan's own weights where the meter moves too little to read.

## Runs
None. Nothing runs before his yes.

## Log
- L1 2026-11-11T19:14:42Z, his words to the lead (transcript `f0959bbd-5f7a-4360-b626-048caf21067f`, line 2320,
  queued while the lead worked): "Me gustaria que investigaramos si seria mejor seguir utilizando Fable 5.2 Alto solo
  en el orquestador y Opus 5.5 para las sesione sy subagente pero con el Advisor de Fable 5.2 alto que te parece?"
- L2 2026-11-11T19:26:06Z, his answer to question 264 (same transcript, line 2446, tapped): "La prueba de modelos
  primero (Recomendado)".
- L3 The brief (`~/.js-harness/background/briefs/2026-11-11T21-39-01-129Z-afde2b0c.md`): his yes covers designing the
  trial and bringing its cost; not running it nor changing a rule. The Claude reader of a double review runs at high
  (his answer to question 260, read from the brief, not from his transcript).
- L4 The advisor page, read 2026-11-11 by a web-fetch sub-agent (a claim, quoted): Opus 5 or 5.5 accept a Fable
  advisor, Fable 5.2 from Claude Code 2.1.321; "Subagents inherit the configured advisor"; no advisor effort setting;
  "There is no setting to cap or force advisor calls"; "The advisor always receives the full conversation" and its
  read "is not cached"; "advisor usage counts toward your plan's usage limits, except that a Fable advisor bills to
  usage credits on plans where Fable usage does"; which weekly limit it draws on is not stated.
- L5 Usage of six recent code sessions, main thread and sub-agents, summed by model from their transcripts by a
  scratch script (`$CLAUDE_JOB_DIR/tmp/projusage.js`), at list: signin-expiry-notice $27 (Fable, 4.4 h),
  departure-control $26 (Fable, 3.1 h), fetch-path-limit $18 (Fable, 2.9 h), audit-u4-refusals $16 (Opus, 5.8 h),
  land-two-defects $14 (Fable, 1.7 h), audit-u2-stop-hook $7 (Opus and Fable, two transcripts).
- L6 The eval suite's coding cases at the ceiling: `headroom.json` (minimal, medium), `headroom-current.json`
  (current, medium) and `ab-high.json` (both, high), all `claude-opus-5-5`, 60 trials: every score 0.98 or 1.00.

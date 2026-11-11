## Goal
A committed design, reviewed twice, for a three-arm trial on real code that tells the owner whether work sessions
and their sub-agents should run on Opus 5.5 at high with a Fable 5.2 advisor, on Opus 5.5 at high alone, or stay on
Fable 5.2 at medium, and what the trial would cost, put to him through the lead before anything runs.

## Why
His words (L1): investigate keeping Fable 5.2 at high only in the orchestrator and running the sessions and
sub-agents on Opus 5.5 with the Fable 5.2 advisor. His tapped answer to question 264 (L2) put this trial first. His
yes covers designing the trial and bringing its cost; running it and any change of model, effort or advisor rule
return to him through the lead (the brief of this session, L3).

## Done when
- `js-harness contract check odd/tasks/model-trial.md` exits 0
- `js-harness double-review tally --since 2026-11-11` lists a read of this document with every finding taken or
  rebutted
- The lead holds a recorded question that puts the trial and its cost to him (`notify --kind question`), and this
  session's `waiting` notice names it

## In scope / Out of scope
- In: this document; the session summary under `docs/sessions/`; this session's scratch.
- Out: running any arm or the pilot (his yes, not given); changing a rule (`rules change`, `rules switch`), a model,
  an effort or the advisor (his); building the trial's keys, checks or scripts before his yes (cost he has not
  approved); anything under `~/.claude`.

## Constraints
- No run, the pilot included, before his yes — because the brief says so and the runs spend his plan.
- The tasks, the scoring, the criterion and the budget are fixed here, before any run — because a criterion written
  after the results bends toward them (JH 125's constraint, kept).
- Each limit `odd/tasks/advisor-trial.md` `## Result` names is answered or said to remain — because repeating them
  makes a second trial that cannot decide.
- The trial stands on his bar of 2026-11-11, "5 intentos por lado y una diferencia mayor que la variación medida"
  (`odd/tasks/audit-u9-eval-bar.md:148`), or says that it does not — because the lead told him it would
  (lead transcript `f0959bbd`, line 2405).

## Ask me before
Running the pilot or any run; starting the arms outside `sessions start` with arms 2 and 3 on a model and effort that
`rule:session-model` and `rule:session-effort` refuse (D3); any spend past the budget's maximum (D7); a usage-credits
consent prompt.

## Depth pass
- 1. Method: a controlled comparison of model configurations on real tasks, the discipline of an ML evaluation
  engineer measuring agents: freeze the tasks, the inputs, the scoring and the criterion before any run; repeat each
  cell so an arm's spread against itself is measured before a gap between arms is called a difference; score blind;
  separate "better" from "not shown worse" with a margin fixed beforehand; report cost by meter, not only by result.
  The smallest change that meets it: reuse what exists (`sessions start`'s argument list, PR 740; JH 125's two tasks,
  briefs and answer keys; JH 125's `usage.js`, which reads advisor iterations; JH 181's `tellsApart`, the bar he chose)
  and build only the third task's key, the acceptance checks and the run-and-audit scripts, after his yes. Search:
  `codegraph_explore` over `evals/` (suite, configs, rule-proof, transcript-usage) and `bin/sessions-background.mjs`;
  `grep advisor evals/*.mjs` found none; `js-harness rules session-model|session-effort|lead-effort`.
- 2. Raw material: his words, lead transcript `f0959bbd-5f7a-4360-b626-048caf21067f` lines 2320 and 2446; the only
  earlier measurement, `odd/tasks/advisor-trial.md` (its keys, `## Arms`, `## Result`) and its briefs in
  `D:\advisor-trial-arms\briefs\` (sha256 in that document); `odd/tasks/land-two-defects.md` L1 (task C's brief as
  written) and L10, L11 (its review findings); his bar, `odd/tasks/audit-u9-eval-bar.md:148` and
  `evals/rule-proof.mjs:35-57`; the eval results `evals/results/headroom.json`, `headroom-current.json`,
  `ab-high.json`; six recent code sessions' transcripts under `~/.claude/projects/D--js-harness--claude-worktrees-*`
  (L5); the advisor page https://code.claude.com/docs/en/advisor.md, read 2026-11-11 (L4); list prices from the
  claude-api skill's model table (cached 2026-11-03): Fable 5.2 $8 input, $40 output, $0.20 cache read; Opus 5.5 $4,
  $20, $0.20; a cache write at 1.25 times input (the 5-minute write of `evals/prices.mjs:30` for Opus); the start's
  rule check, `bin/sessions-background.mjs:163-173` and `bin/lib/rules.mjs:417-446`; the guard's sub-agent rule,
  `bin/lib/guard.mjs:23-59`; the writer agent type at each base (`git show <base>:.claude/agents/js-harness-writer.md`).
- 3. The bar:
  spec 1: `js-harness contract check odd/tasks/model-trial.md`: PASS since `9a1186eb`.
  spec 2: `js-harness double-review tally --since 2026-11-11`: read `1cfa95b9` with 21 findings, answered in L7.
  spec 3: left out because its proof is the recorded question, which the lead reads; no command judges a design's
  fitness for his decision.
- 4. Refutation: could the trial run on what exists, the eval suite's coding cases, at no build cost? Their record
  says no: Opus 5.5 scores at the ceiling on all five coding cases at medium and at high, minimal or current (L6: 60
  trials, each between 0.976 and 1.00). A case where every arm scores near 1.00 cannot show an arm better, so quality
  is read on real tasks with a defect key. Could the arms start with `sessions start` as the brief assumes? Not arms 2
  and 3: the start refuses a model or effort other than the running copy's rule values, Fable 5.2 and medium, in any
  folder whose rules file declares the two rules (`bin/sessions-background.mjs:167-173`, `bin/lib/rules.mjs:417-446`);
  arm 1 passes. Could a sub-agent of an Opus arm run on Fable? Yes: an agent type that declares a model is let through
  (`bin/lib/guard.mjs:23-25`), and the writer type declares Fable 5.2 at high at task C's base. None of these refutes
  his request; each changes how it is run (D2, D3).
  Verdict: supports
- 5. Request: his request rewritten, beside his words (L1): "Design a trial on real code from this repository, at the
  bar I set for evals, that tells whether sessions and sub-agents should run on Opus 5.5 high with the Fable 5.2
  advisor, on Opus 5.5 high alone, or on Fable 5.2 medium as today, scoring quality blind and reading what each
  spends of the Fable meter and of the all-models meter and how long it takes; fix its criterion before any run, say
  what each outcome would change in my rules, and bring me its cost, with a maximum, before it runs."
  Adds: none

## Specs
1. "Me gustaria que investigaramos si seria mejor seguir utilizando Fable 5.2 Alto solo en el orquestador y Opus 5.5
   para las sesione sy subagente pero con el Advisor de Fable 5.2 alto que te parece?" (L1): the trial's design.
2. The design passes its double review before it reaches him (`rule:double-review`).
3. "La prueba de modelos primero (Recomendado)" (L2): the design and its cost reach him through the lead as one
   question, and nothing runs before his answer.

## Tasks
- [x] T1 (kind: design) spec 1: this document, its depth pass and the design below · inline · 9a1186eb
- [x] T2 (kind: verify) spec 2: double review of the design, every finding answered · `double-review read` · L7
- [ ] T3 (kind: docs) spec 3: the question recorded for the lead, `waiting` notice, session summary · notify

## The design

### D1. The arms
| Arm | Session and sub-agents | Effort | Advisor | Draws on the Fable meter |
|---|---|---|---|---|
| 1, today | `claude-fable-5-2` | medium | none | everything |
| 2, his idea | `claude-opus-5-5` | high | `claude-fable-5-2`, sub-agents included | the advisor's calls |
| 3, control | `claude-opus-5-5` | high | none | nothing |

Kept as the lead proposed them. Arm 3 tells whether the advisor adds anything: without it a gain of arm 2 over arm 1
could be Opus at high, not the advisor. Two things he asked for cannot be set as he said them, and he is told so:
the advisor has no effort setting (L4), so his "Advisor de Fable 5.2 alto" runs at whatever effort the host gives it;
and arm 1 against arm 3 changes model and effort together, so it cannot say which of the two made a difference (Opus
at high is the lead's choice, not in his sentence). The lead (Fable 5.2 at high) is the same in every arm and is not
tested. Not added: Fable 5.2 at high for sessions, or Opus at medium; each arm adds a third of the cost.

What a sub-agent runs on: a call that names no model and no effort runs on its session's model and effort with its
advisor (L4: "Subagents inherit the configured advisor"); a call of an agent type that declares a model runs on that
model (`bin/lib/guard.mjs:23-25`). So in every arm folder each file under `.claude/agents/` has its `model:` and
`effort:` lines removed (a stated change to the base, the same in every arm), the preamble asks for no model and no
effort on a sub-agent call, and the audit of D5 voids a run in which any sub-agent transcript shows another model.

### D2. The tasks: three real pieces of work, replayed from their base
Real code from this repository, where the eval cases cannot tell arms apart (depth pass item 4). Each task is merged
work that started from a written brief, whose reviews found at least three defects in its code after the first code,
counted before the trial:

| Task | Work | Base | Brief | Defects in its key |
|---|---|---|---|---|
| A | JH 124, the depth pass check (rule 1) | `b5bf7484` | `D:\advisor-trial-arms\briefs\arm-brief-a.md`, its original part | A1 to A13 (code), from `odd/tasks/advisor-trial.md`; A14 to A16 dropped, slips of the session's own process |
| B | JH 123, the departure check | `6bee9e5b` | `arm-brief-b.md`, its original part | B2, B3, B5 to B13 (code); B1 and B4 kept as plan defects read by acceptance; from the same document |
| C | JH 175, the land's false prune alarm and order control (PR 816) | `7525a4e5` | `odd/tasks/land-two-defects.md` L1, as written | its L10 and L11: a quoted target cut at a space, the `.cmd` form of a whole target untested, a single pull request of merge-button merges read as a candidate; the prep step adds any other code finding of its review records and needs three or more, or C is replaced |

Why these: JH 125 already wrote and committed keys A and B, blind, from the reviews, so they cost nothing to reuse;
A and B were written on Opus 5.5 at high (their start records, JH 125's `### Tasks and bases`) and C on Fable 5.2 at
high, so the key's bias toward repeating its author's model is split across both models and reported per task (D9).
The first two tasks of the earlier design were dropped (L7): PR 807's reviews found no code defect, and PR 819's
query check was outside the brief of PR 817.

Each run gets the same brief for its task: the original brief as recorded (its reporting section dropped), after a
fixed preamble: implement the work with its tests in this folder; run the tests the brief names and the whole suite
once; commit locally; push nothing, start no review, send no notice, ask nothing (nobody answers); read nothing
outside this folder and search no memory; name no model and no effort on a sub-agent call; for task C, never run a
real `merge-queue --land` or `--refresh-copy`. The folder is a `git archive` of the base with a fresh `git init` and
one commit, under `D:\model-trial-arms\<arm>-<task>-<run>\`, a trusted sibling of the repository (JH 125's L7). The
brief texts, their sha256 and the preamble are committed here before the pilot.

### D3. How a run is started, stopped and isolated
`sessions start` refuses arms 2 and 3 (depth pass item 4). For equal treatment all three arms start the same way,
outside it, with the command `startArgs` builds (`bin/lib/background.mjs:44-67`) and the changes the trial needs:
`claude --bg --add-dir <briefs folder> -n "JH 185 · arm <n> task <t> run <r>" --model <m> --effort <e>
[--advisor claude-fable-5-2] --strict-mcp-config --mcp-config <empty> "<one-line prompt naming the brief file>"`,
from the run's folder, with Remote Control off. `--strict-mcp-config` with an empty config takes every MCP server
away (engram, which holds the earlier sessions' notes on these very tasks, and codegraph, which has no index of an
arm folder), as the eval suite's minimal arm does (`evals/configs.mjs`). A direct start writes no record, so the run
is recorded in `## Runs` (start time, job id, folder, command) and stopped with `claude agents` by its job id; a
restart of the machine ends it, and it is rerun under D4's rule. The installed harness's hooks and guard (installed in
the home, not the project) run in every arm alike; the pilot shows whether they turn runs back.

This is an exception to `rule:session-model` and `rule:session-effort` for the trial's runs and nothing else: his
yes to the trial grants it, no rule changes, and nothing outside `D:\model-trial-arms\` runs on another model. Once
JH 172's `rules switch` exists (its T7), the trial still needs this exception, since a switch moves the rule for
every session; the switch changes the step after the verdict: the outcome he picks becomes one `rules switch`
instead of one `rules change` a rule.

### D4. Stages, repeats and order
- Stage 0, the pilot: one run of arm 1 and one of arm 2 on task A. It shows the advisor's model in the transcript
  (`claude-fable-5-2`, not a 5.1 under a short name as in JH 125), its calls and tokens, every sub-agent's model, the
  hooks' effect, the permission mode a run gets, the time a run takes and the meters' movement, and calibrates D7.
  It stops the trial, and the result goes to him, when arm 2's Fable dollars are not below arm 1's (his idea's saving
  cannot hold), or when either run cannot finish for a cause of the setup.
- Stage 1: five runs a cell (his bar), 3 arms x 3 tasks x 5 = 45 runs. The pilot's two runs are not counted in it.
- Order: runs go in blocks of one arm so the meter can be read per arm; block order rotates (3, 2, 1, then 1, 3, 2,
  then 2, 1, 3, ...) so drift through the days does not favour an arm. Two runs of the same arm may run at once (a
  block keeps one arm, so its meter reading stays its own); they take both work-session slots of the machine, so
  other work waits while a block runs. No gate runs during a block.
- Clock: a run has 120 minutes. One that runs out is a result: it is scored as it stands, with its time and tokens.
  Only a run broken by the machine or the setup (a restart, a consent prompt, a crash of the CLI), shown by its
  transcript, is rerun, once; a second break is scored as it stands. Every attempt stays in the cost.

### D5. Quality: how a run is scored, blind
Each run is scored on four parts, kept separate, from a set of unique defects with stable ids (one defect counts once
whatever shows it):
1. Acceptance: the task's checks, written before stage 1 from the merged work's behaviour and the brief's "Done
   when", against interfaces that exist at the base or that the brief names (a CLI call with its exit and output, an
   exported function the brief names); each failing check names the defect id it shows.
2. The key: each key defect present in the run's code, shown by a probe command where one can show it, else judged by
   the readers.
3. New defects: a defect the readers find that is in no key, counted when both readers name it or a probe shows it.
4. Regressions: tests of the base suite that fail after the run, grouped by root cause; the base suite is run three
   times first and any test that fails there once is left out (timing tests), and tests the run edits or deletes are
   run from the base's copy.
A run's faults F is the number of unique defects across the four parts. The arms are compared on F; the parts and
a severity per defect (P0 to P3, the readers' and the probe's) are reported beside it.

The readers: one Claude reader on Fable 5.2 at high (his answer to question 260 for the double review's reader,
applied here) and one Codex reader, each given a task's diffs in batches of five, under labels drawn by a coin, with
the key; the mapping is kept aside until both verdicts are in. Before they read, the diffs and commit messages are
scrubbed of what names an arm (trailers, "advisor", a model's name), the originals kept.

The audit, before scoring: a run is void, and rerun once, when its transcripts show a read outside its folder, a call
of the installed `js-harness` beyond its own tests, an MCP call, or a sub-agent on another model.

### D6. Cost: what is read, and how
- Tokens by model, per run, from its transcripts (main thread and sub-agents): the session's usage once per API
  message id, the advisor's from `message.usage.iterations` entries of type `advisor_message`, as JH 125's
  `usage.js` reads them, extended to the sub-agents' transcripts. Priced at list, by model: Fable dollars, Opus
  dollars, total. This is the primary measure, and the only one that separates runs.
- The plan meters, secondary: before and after each block, the weekly all-models, weekly Fable and five-hour meters
  of claude.ai Settings, Usage, and Codex's (`js-harness codex-meter`). The lead and the session that drives the trial
  run on Fable during a block, so their own tokens over the block, summed by model from their transcripts, are taken
  out at the block's rate. Arm 3's blocks show whether Opus moves the Fable meter; arm 2's whether the advisor draws
  on the weekly Fable limit, which the advisor page does not say (L4). Points a list dollar, by meter, are read from
  the blocks; each run's dollars are turned into points with them, an estimate, since the meter moves in whole
  percents. A verdict on Fable spend rests on the transcripts; the meter only says what it costs him in points.
- Minutes: from each run's first to last transcript entry.

### D7. What the trial would cost (an estimate), and its maximum
Base (L5): six recent code sessions cost $7 to $27 at list each, whole (reviews, gates and waits included), most on
Fable 5.2 at high, one on Opus, 1.7 to 5.8 hours. A run here does only the implementation and one suite run, put at
half a whole session; arm 1 at medium is put at the same tokens as high, which overstates it; the advisor at 3 to 6
calls of 150,000 to 250,000 uncached Fable tokens (JH 125's arms made 2 calls in 10 to 12 minutes of planning, about
250,000 tokens).

| Arm | A run, list dollars | Of it Fable | 15 runs | Of it Fable |
|---|---|---|---|---|
| 1, Fable medium | $6 to $12 | all | $90 to $180 | $90 to $180 |
| 2, Opus high + advisor | $9 to $21 | $5 to $13 | $135 to $315 | $75 to $195 |
| 3, Opus high alone | $4 to $8 | none | $60 to $120 | none |
| Stage 1 runs | | | $285 to $615 | $165 to $375 |

Beside them: the pilot, $15 to $33; the preparation (key C, the acceptance checks, the scripts) and the scoring, one
session on Fable 5.2 at medium, $20 to $40; the readers, 9 Claude reads at $3 to $6 and 9 Codex reads at about
500,000 tokens each, about 5 % of Codex's weekly limit by the double review's measured share (1 % for 0.9 M); reruns
at most a tenth more. Total, an estimate: $350 to $750 at list, of it $200 to $460 on Fable. Time: 45 runs of 40 to 90
minutes, two at a time, 15 to 34 hours of the machine, about three to five days with the waits for free slots.

The maximum: the trial stops for his word at $800 at list, or before a block when its projected cost would take the
weekly Fable or all-models meter above 70 %, or Codex's weekly limit to `rule:codex-weekly-floor`; a figure for him
to change. What a list dollar is in meter points is known only after the pilot; the pilot's report gives it.

### D8. The criterion, fixed before the first run
Per task, with five runs a cell: arm X is better than arm Y when Y's mean faults exceed X's by more than the spread of
their runs, `tellsApart` of `evals/rule-proof.mjs:57` (his bar: "una diferencia mayor que la variación medida"); X is
not worse than Y when X's mean faults exceed Y's by at most one fault (the margin, fixed here) and Y is not better than
X. Across tasks: X is better than Y when better on at least two tasks and not worse on the third; X is not worse than
Y when not worse on all three. An arm-2 run whose transcript shows no advisor call is kept (it is what the advisor
does by default; no line asks it to consult); when half or more of arm 2's runs made none, arm 2 is untested.

What each outcome would change, all of it his to decide, read in this order, the first that holds:
| Outcome | What it means | What he would be asked |
|---|---|---|
| 1. A run void or the pilot stopped the trial; or arm 2 untested | the trial cannot answer | nothing changes; the report says why |
| 2. Arm 1 better than arm 2 and better than arm 3 | today's scheme is best | nothing changes |
| 3. Arm 2 better than arm 3, not worse than arm 1, and fewer Fable points than arm 1 | his idea holds | `session-model` to Opus 5.5, `session-effort` to high, and an advisor rule (new) for sessions and sub-agents; the lead stays on Fable 5.2 at high |
| 4. Arm 3 not worse than arm 2 and not worse than arm 1 | the advisor adds nothing and Opus high alone holds quality | `session-model` to Opus 5.5 at high, no advisor; Fable only for the lead |
| 5. Arm 3 better than arm 2 | the advisor hurts | no advisor; arm 3 against arm 1 read as in rows 2 and 4 |
| 6. Anything else, an arm better but dearer or no arm told apart without the margin met | a trade, or no answer | nothing changes; the figures go to him, quality against points |

What two runs a cell would give instead, if he picks the cheaper trial ($114 to $246 for the runs): an exploratory
reading that can show only a large difference and never "not worse"; under it every row but 1, 2 and 6 is out, so it
cannot recommend a change.

The rule's errors, from JH 181's measures of `tellsApart` at five trials (`evals/rule-proof.mjs`, L13 of
`odd/tasks/audit-u9-eval-bar.md`): with no real difference it calls one in at most 9.4 % of draws on a task; with
an arm always right and the other failing three times in ten it finds the difference in 47 % of draws, five in ten in
81 %. Requiring two tasks of three takes the false call down to about 2.5 % if the tasks are independent (an
estimate: 3 x 0.094 squared). So a difference of about one standard deviation of a cell's faults is the smallest
the trial is likely to show; a smaller one ends in row 6.

### D9. What this trial still cannot show
Three tasks, all this repository's harness code; the keys hold defects of their authors' model (A and B Opus, C
Fable), reported per task; the readers are models, held by a probe only where one exists, one of them on Fable reading
Fable's code; the lead and the review pipeline are the same in every arm, so their effect on a real session's quality
is not measured; the advisor's effort cannot be set and its text is encrypted, so why it helped or not cannot be read;
arm 1 against arm 3 does not separate model from effort; list dollars stand in for the plan's own weights where the
meter moves too little to read; the arms run without MCP servers, which real sessions have.

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
  scratch script (`$CLAUDE_JOB_DIR/tmp/projusage.js`), at list, with the span of the main transcript:
  signin-expiry-notice $27 (Fable, 4.4 h), departure-control $26 (Fable, 3.1 h), fetch-path-limit $18 (Fable,
  2.9 h), audit-u4-refusals $16 (Opus, 5.8 h), land-two-defects $14 (Fable, 1.7 h), audit-u2-stop-hook $7 (Opus and
  Fable, two transcripts). The Fable sessions ran at high (`rule:session-effort` was high until 2026-11-11).
- L6 The eval suite's coding cases at the ceiling: `headroom.json` (minimal, medium), `headroom-current.json`
  (current, medium) and `ab-high.json` (both, high), all `claude-opus-5-5`, 60 trials, each between 0.976 and 1.00.
- L7 Double review `1cfa95b9` of `9a1186eb` (Claude 12 findings, 1,133,980 tokens; Codex 9, 498,905 tokens; its
  cost, said before it ran: about 1.1 M Claude and 0.9 M Codex tokens, 1 % of Codex's weekly limit). Taken, all 21,
  rewritten above: sub-agents of a typed agent run on its declared model (Claude 1, Codex 1: D1, D3, D5's audit); two
  runs a cell are below his bar (Claude 2, Codex 8: D4, D8, five runs with `tellsApart` and the rule's errors stated);
  the outcome table turned a null result into a change (Claude 3, Codex 2: D8 rewritten, exclusive and in order, with
  a margin for "not worse", the null row changes nothing); tasks A (PR 807, no code defect in its reviews) and B
  (PR 817 with 819, whose query check was outside its brief) replaced by JH 125's tasks with their keys (Claude 4,
  Codex 3: D2); key bias by author model (Claude 5: D2, D9); arm 1 is not refused by `sessions start`, the held value
  is the running copy's, and the start command was wrong (Claude 6: depth pass 4, D3); isolation from memory, the
  merged solution and the installed harness (Claude 7, Codex 7: D2's preamble, D3's MCP flags, D5's audit); cost
  incomplete, no pilot, no maximum (Claude 8, Codex 5: D4 stage 0, D7 total and maximum); the meter cannot isolate an
  arm (Claude 9: D6, the lead's and the driver's tokens taken out, meter secondary); unlike faults added, timeouts
  rerun, diffs not scrubbed (Claude 10, Codex 4, Codex 6: D4 clock, D5 unique defects, flaky tests out, scrub); his
  "alto" for the advisor and model against effort (Claude 11: D1, D9); figures (Claude 12, Codex 9: the hours, the
  efforts of L5, the cache-write price, the 0.976 floor, the bases; PR 807's and 819's sizes leave with the tasks).
  Rebutted: none.

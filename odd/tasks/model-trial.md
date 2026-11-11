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
- The double-review record holds a `take` entry for both readers of each read of this document (reads `1cfa95b9`
  and `8920811f`, L7 and L8); no command checks this whole, so it is read in the record
- The lead holds a recorded question that puts gate 1 and its cost to him (`notify --kind question`), and this
  session's `waiting` notice names it

## In scope / Out of scope
- In: this document; the session summary under `docs/sessions/`; this session's scratch.
- Out: running any run (his yes, not given); changing a rule (`rules change`, `rules switch`), a model, an effort or
  the advisor (his); building the trial's home, briefs, keys, checks or scripts before his yes (cost he has not
  approved); anything under `~/.claude`.

## Constraints
- No run before his yes, and stage 1 only after a second yes on its measured cost — because the runs spend his plan
  and the pilot is what makes stage 1's cost known.
- The criterion is fixed here, and stage 1's scoring manual, schedule and decision-rule simulation are committed
  before its first run — because a criterion written after the results bends toward them (JH 125's constraint).
- Stage 1 stands on his bar of 2026-11-11, "5 intentos por lado y una diferencia mayor que la variación medida"
  (`odd/tasks/audit-u9-eval-bar.md:148`) — because the lead told him it would (lead transcript `f0959bbd`, line 2405).
- Each limit `odd/tasks/advisor-trial.md` `## Result` names is answered or said to remain.

## Ask me before
Gate 1 (the pilot); gate 2 (stage 1, on the pilot's measured cost); starting the runs outside `sessions start`, with
arms 2 and 3 on a model and effort `rule:session-model` and `rule:session-effort` refuse (D3); any spend past a
gate's maximum; a usage-credits consent prompt.

## Depth pass
- 1. Method: a controlled comparison of model configurations on real tasks, the discipline of an ML evaluation
  engineer measuring agents: validate the instruments and the cost on a pilot; freeze tasks, inputs, scoring and
  criterion before the measured runs; repeat each cell so an arm's spread against itself is measured; score blind
  against positive and negative controls; separate "better" from "not worse" by a non-inferiority bound fixed
  beforehand; report cost by meter. The smallest change: reuse what exists (the eval sandbox's home and switches,
  `evals/configs.mjs:72-127` and `:466-477`; `startArgs`, `bin/lib/background.mjs:58-68`; JH 125's tasks, briefs and
  keys; JH 125's `usage.js`; JH 181's `tellsApart`) and build only the run launcher, the audit and the scoring.
  Search: `codegraph_explore` over `evals/` and `bin/sessions-background.mjs`; `grep advisor evals/*.mjs` (none);
  `js-harness rules session-model|session-effort|lead-effort`.
- 2. Raw material: his words, lead transcript `f0959bbd-5f7a-4360-b626-048caf21067f` lines 2320 and 2446;
  `odd/tasks/advisor-trial.md` (its keys, `## Arms`, `## Result`) and its briefs in `D:\advisor-trial-arms\briefs\`;
  `odd/tasks/land-two-defects.md` L1, L7, L10, L11; `odd/tasks/audit-u9-eval-bar.md:58-63`, `:116-117`, `:148`;
  `evals/rule-proof.mjs:12-57`; `evals/results/headroom.json`, `headroom-current.json`, `ab-high.json`; six recent
  code sessions' transcripts (L5); https://code.claude.com/docs/en/advisor.md, read 2026-11-11 (L4); the claude-api
  skill's price table (cached 2026-11-03): Fable 5.2 $8 input, $40 output, $0.20 cache read; Opus 5.5 $4, $20, $0.20;
  a cache write at 1.25 times input; `bin/sessions-background.mjs:163-173`, `bin/lib/rules.mjs:417-446`,
  `bin/lib/guard.mjs:23-59`, `bin/lib/rules-data.mjs:705-710` (what `session-model` covers).
- 3. The bar:
  spec 1: `js-harness contract check odd/tasks/model-trial.md`: PASS since `9a1186eb`.
  spec 2: left out because no command proves every finding of a read answered; the record's `take` entries for reads
  `1cfa95b9` and `8920811f` are read by hand (L7, L8).
  spec 3: left out because its proof is the recorded question, which the lead reads.
- 4. Refutation: could the trial run on the eval suite's coding cases at no build cost? No: Opus 5.5 scores near the
  ceiling on all five at medium and at high (L6: 60 trials, each between 0.976 and 1.00). Could the runs start with
  `sessions start`? Not arms 2 and 3: the start refuses a model or effort other than the running copy's rule values,
  Fable 5.2 and medium, in a folder whose rules file declares the two rules (`bin/sessions-background.mjs:167-173`,
  `bin/lib/rules.mjs:417-446`); arm 1 passes. Can his idea be set by moving `session-model` to Opus? No: that rule
  covers the lead too (`bin/lib/rules-data.mjs:705-710`), so the outcome he wants needs the lead's model held apart
  (D8). Does the advisor save Fable at all? The estimate says not clearly: each advisor call re-reads the whole
  conversation uncached at $8 a million, where the session re-reads its own from cache at $0.20 (L4), and D7 puts arm
  2's Fable spend level with arm 1's. None refutes his request; the last is the first thing the pilot measures.
  Verdict: supports
- 5. Request: his request rewritten, beside his words (L1): "Find out, on real code from this repository, whether
  work sessions and their sub-agents should run on Opus 5.5 with the Fable 5.2 advisor while the orchestrator stays
  on Fable 5.2 at high, compared with today's scheme; tell me what it costs before anything runs."
  Adds: none

## Specs
1. "Me gustaria que investigaramos si seria mejor seguir utilizando Fable 5.2 Alto solo en el orquestador y Opus 5.5
   para las sesione sy subagente pero con el Advisor de Fable 5.2 alto que te parece?" (L1): the trial's design.
2. The design passes its double review before it reaches him (`rule:double-review`).
3. "La prueba de modelos primero (Recomendado)" (L2): the design and its cost reach him through the lead as one
   question, and nothing runs before his answer.

## Tasks
- [x] T1 (kind: design) spec 1: this document, its depth pass and the design below · inline · 9a1186eb
- [x] T2 (kind: verify) spec 2: double review, two reads, every finding answered · `double-review read` · L7, L8
- [ ] T3 (kind: docs) spec 3: the question recorded for the lead, `waiting` notice, session summary · notify

## The design

### D1. The arms
| Arm | Session and sub-agents | Effort | Advisor | Draws on the Fable meter |
|---|---|---|---|---|
| 1, today | `claude-fable-5-2` | medium | none | everything |
| 2, his idea | `claude-opus-5-5` | high | `claude-fable-5-2`, sub-agents included | the advisor's calls |
| 3, control | `claude-opus-5-5` | high | none | nothing |

Arm 3 tells whether the advisor adds anything. Opus at high is the lead's proposal, not in his sentence. Said to him
as limits: the advisor has no effort setting (L4), so his "Advisor de Fable 5.2 alto" runs at the host's effort; arm 1
against arm 3 changes model and effort together. The lead is the same in every arm and is not tested.

Sub-agents: every run's environment sets `CLAUDE_CODE_SUBAGENT_MODEL` to the arm's model with
`CLAUDE_CODE_SUBAGENT_MODEL_FORCE`, which overrides an agent type's frontmatter and the Agent tool's `model`
(`evals/configs.mjs:466-477`); the agent files stay as the base has them. The brief asks for a verifier sub-agent on
the finished change, as a real session would, in every arm. The audit records each sub-agent's model, effort and
advisor iterations; a run with a sub-agent on another model is void. When fewer than half an arm's runs start one, the
trial says the sub-agent half of his question is untested.

### D2. The tasks
Three merged pieces of work, each replayed from its base, kept only if, after the item analysis of gate 2, its key
holds at least three code defects that any implementation of its brief can show and a probe can detect:

| Task | Work | Base | Key before item analysis |
|---|---|---|---|
| A | JH 124, the depth pass check | `b5bf7484` | A1 to A11 (A12 to A16 out: a stale comment, a dead import, a template escape, a quote slip and coverage phrases, accidents of one path or of the session's process) |
| B | JH 123, the departure check | `6bee9e5b` | B6, B7, B9, B12 (B1 to B5 tie to the brief's own wrong approach, B8, B10, B11, B13 to one path's slips); under three, so B is replaced at gate 2 unless the item analysis finds more |
| C | JH 175, the land's prune alarm and order control (PR 816) | `7525a4e5` | a quoted target cut at a space and a merge-button pull request read as a candidate (L10, L11), the whole-named shim seen by the old check only (L7, `d5950864`); the `.cmd` form untested becomes an acceptance check |

The replacement for B is the next merged code task whose brief and merged work agree and whose reviews found three
or more probe-able code defects; JH 125's keys were written to score plans, so each kept item is restated as a
behaviour of code. The briefs: A and B from JH 125's `arm-brief-a.md` and `arm-brief-b.md` (their original part,
sha256 in `odd/tasks/advisor-trial.md`); C from the lead's transcript of 2026-11-11T05:20Z, recovered whole (the
document's L1 is two excerpts), or C is replaced. Who wrote each key's code: the start records of A and B say "model
default" (2026-10-31), not proven here to be Opus; C ran on Fable 5.2 at high. The bias toward repeating an author's
model is reported per task.

Each trial brief is the original with every step that reaches outside the folder replaced by a frozen input inside
it (his quoted lines up to the brief's time, the relief lines, the pnpm shim files as fixtures), one sentence on what
to do at a step it cannot reach, and a fixed preamble: implement with tests here, run the named tests and the suite
once, commit locally, push nothing, send no notice, ask nothing, start the verifier sub-agent, never run a real
`merge-queue --land` or `--refresh-copy`. Briefs and preamble are committed with their sha256 before the pilot and
copied into each run's folder.

### D3. How a run is started, stopped and isolated
All three arms start alike, outside `sessions start` (it refuses arms 2 and 3): `claude --bg -n "JH 185 · arm <n>
task <t> run <r>" --model <m> --effort <e> [--advisor claude-fable-5-2] --strict-mcp-config "<one line: read
TRIAL-BRIEF.md here>"`, from the run's folder (`D:\model-trial-arms\<arm>-<task>-<run>\`, a `git archive` of the base
with a fresh `git init` and one commit), Remote Control off, the exact command tried on a dry start before the pilot.
Its environment is the eval sandbox's (`sandboxEnv` and `SANDBOX_SWITCHES`, `evals/configs.mjs:72-127`): a trial home
seeded as the `current` arm seeds it, engram on a trial port, auto memory, the updater and claude.ai MCP servers off.
`claude --version` is recorded per run; a block whose version differs from the pilot's is void. A run is stopped with
`claude stop <id>` and recorded in `## Runs`; a restart ends it and it is rerun under D4.

The audit, before scoring, is an allow-list: reads inside the run's folder and its trial home, the folder's own
`node bin/js-harness.mjs`; anything else (a read of `D:\js-harness`, the installed `js-harness`, a hook output carrying
memory text, an MCP call, a sub-agent on another model) voids the run. Void counts are reported per arm.

The exception: runs on a model and effort `rule:session-model` and `rule:session-effort` refuse, for the trial's runs
only, granted by his yes to each gate; no rule changes. Once JH 172's `rules switch` exists, the outcome he picks
becomes one `rules switch`; the trial still needs the exception.

### D4. Two gates
- Gate 1, the pilot, his first yes: four runs, one on each base and each arm present: arm 1 and arm 2 on task A, arm
  3 on task C, arm 2 on task B, plus the build they need (launcher, trial home, frozen briefs, audit, usage script).
  It reports to him: each run's tokens and dollars by model, the advisor's model (`claude-fable-5-2`, not a 5.1 under a
  short name as in JH 125) and calls, sub-agents' models, hooks' effect, minutes, the meters' movement with the lead
  idle, and points a list dollar. It stops nothing by itself: one run a cell decides nothing (his bar), so its figures
  go to him with the stage-1 plan.
- Gate 2, stage 1, his second yes: five runs a cell, 3 arms x 3 tasks x 5 = 45, on a plan committed and double-reviewed
  before it reaches him: the item analysis and the replacement tasks; the acceptance checks; the scoring manual
  (presence, deduplication, severity P0 to P3 with its definitions, disagreement resolved by a probe, else by a third
  blind reader, both verdicts kept); the controls (each task's first-code commit must show its key, its merged head
  none; one duplicate diff a reader measures scoring noise); the schedule, 45 rows of arm, task, run, block and day, a
  Latin square over arm and task, two runs at once only within one arm; the simulation of D8's whole procedure on
  count data (Poisson and over-dispersed, at the means the controls show) with its false-recommendation rate and its
  power; its measured cost and maximum.
- Clock: a run has 120 minutes; one that runs out is scored as it stands. Only a run broken by the machine or the
  setup, shown by its transcript, is rerun, once; at most five reruns in stage 1. A run void twice leaves its cell one
  short; a cell under four valid runs drops its task from the comparison; under two tasks left, the trial has no
  answer.

### D5. Quality: how a run is scored, blind
Acceptance first, as a gate: a run that fails a check its brief names, or that shows a P0 or P1 defect, fails its
run; the arms are compared first on the share of runs that pass. Among passing runs, faults F, the unique defects of
the key, new defects both readers name or a probe shows, and regressions of the base suite by root cause (tests that
fail once in three base runs are left out; tests the run edits are run from the base's copy), with the severities
beside it. The readers: one Claude reader on Fable 5.2 at high and one Codex reader, diffs in batches of five under
coin labels, scrubbed of what names an arm, originals kept, the mapping aside until both verdicts are in.

### D6. Cost: what is read, and how
- Primary, per run: tokens by model from its transcripts, sub-agents included, the advisor's from
  `message.usage.iterations` entries of type `advisor_message` (JH 125's `usage.js`, extended); priced at list.
- Secondary, the meters: weekly all models, weekly Fable, five-hour, and Codex's (`js-harness codex-meter`), read
  before and after a measurement window in which no other Claude session works (the lead resting in its wait). Where
  that cannot be had, the meter is descriptive only. Row 3 of D8 uses the transcripts; points are a translation for
  him, unknown until the pilot.
- Minutes, from each run's first to last transcript entry; reported, not in the criterion.

### D7. What it would cost (estimates)
Base (L5): six recent code sessions cost $7 to $27 at list, whole, most on Fable 5.2 at high, 1.7 to 5.8 hours. A run
here is put at half a whole session; arm 1 at medium at the same tokens as high (an overstatement); arm 2's Opus part
above arm 3's, since JH 125's advisor runs read 1.4 to 2.2 times the cache and ran 1.8 to 3.3 times as long; the
advisor at 3 to 6 calls of 150,000 to 250,000 uncached Fable tokens.

| Run | List dollars | Of it Fable |
|---|---|---|
| Arm 1, Fable medium | $6 to $12 | all |
| Arm 2, Opus high + advisor | $10 to $27 | $5 to $13 |
| Arm 3, Opus high alone | $4 to $8 | none |

Gate 1: four runs, $30 to $74 (Fable $16 to $38); the build, one session on Fable 5.2 at medium, $15 to $30; total $45
to $104, Fable $31 to $68; maximum $120. Time: one day.

Gate 2, indicative, refined by the pilot: 45 runs, $300 to $705 (Fable $165 to $375); five reruns at most, $50 to
$135; preparation and scoring, two sessions, $40 to $80; readers, 9 Claude reads $27 to $54 and 9 Codex reads, about 5 %
of Codex's weekly limit (a double review read measured 1 % for 0.9 M Codex tokens); two double reviews, $10 to $20 and
about 2 % of Codex's week; the lead's and the driver's share over the days, $20 to $60. Total $447 to $1,054, Fable $272
to $657, in four to six days, two runs at a time. Its maximum is set at gate 2 above the refined range.

### D8. The criterion, fixed now
Per task, five runs a cell, on the share of passing runs and then on F: X is better than Y when Y's mean exceeds X's by
more than their spread (`tellsApart`, `evals/rule-proof.mjs:57`, without its 0.02 floor, which was set for 0-to-1
scores); X is not worse than Y when X's mean minus Y's, plus their pooled spread, is at most the margin of one fault, or
a tenth of the pass share, fixed now. Across tasks: better on two and not worse on the third; not worse on all three.
Fable spend: X spends less Fable than Y when `tellsApart` holds on the runs' Fable dollars. Minutes and all-models
dollars are reported, not used. The figures JH 181 measured (9.4 % false, 47 % and 81 % power) are for a trial scored 1
or 0.5 and illustrate only; the simulation of gate 2 gives this rule's own. The decisive comparisons are 2 against 1
and 3 against 1; 2 against 3 only qualifies them.

Read in order, the first that holds:
| Outcome | What it means | What he would be asked |
|---|---|---|
| 1. No answer (D4), or arm 2 untested: half or more of its runs made no advisor call | the trial cannot answer | nothing changes |
| 2. Arm 1 better than arm 2 and than arm 3 | today's scheme is best | nothing changes |
| 3. Arm 2 not worse than arm 1, spends less Fable than arm 1, and better than arm 3 | his idea holds | a model rule for work sessions and sub-agents apart from the lead's (`session-model` covers the lead today), on Opus 5.5 at high, and an advisor rule (new); the lead stays on Fable 5.2 at high |
| 4. Arm 3 not worse than arm 1 and arm 2 not better than arm 3 | the advisor shows no benefit; Opus high alone holds quality within the margin | the same split, on Opus 5.5 at high, no advisor |
| 5. Anything else | a trade, or no answer | nothing changes; the figures go to him |

### D9. What this trial still cannot show
Three tasks, all this repository's harness code; keys from their authors' sessions, the author's model not proven for
A and B; readers are models, held by probes and controls where these exist; the lead and the review pipeline are
the same in every arm; the advisor's effort cannot be set and its text is encrypted; arm 1 against arm 3 does not
separate model from effort; the runs have no MCP servers, which real sessions have; list dollars stand in for the
plan's weights where the meter cannot be read.

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
- L6 The eval suite's coding cases near the ceiling: `headroom.json`, `headroom-current.json`, `ab-high.json`, all
  `claude-opus-5-5`, 60 trials, each between 0.976 and 1.00.
- L7 Double review `1cfa95b9` of `9a1186eb` (Claude 12 findings, 1,133,980 tokens; Codex 9, 498,905; its cost, said
  before it ran: about 1.1 M Claude and 0.9 M Codex tokens, 1 % of Codex's weekly limit). All 21 taken: typed
  sub-agents escape the arm's model; two runs a cell were below his bar; the outcome table turned a null into a change;
  PR 807 had no code defect and PR 819's query check was outside PR 817's brief, so tasks A and B were replaced; key
  bias by author; arm 1 is not refused by `sessions start`; isolation; cost incomplete, no pilot; the meter cannot
  isolate an arm; unlike faults added, timeouts rerun, diffs not scrubbed; his "alto" for the advisor; figures.
- L8 Confirming read `8920811f` of `c3218bb1` (Claude 13 findings, 1,494,173 tokens; Codex 11, 397,488; same cost said
  before). All 24 taken, the design rewritten: the briefs reached outside the folder the audit allowed (Claude 1,
  Codex 3: frozen inputs in the folder, an allow-list audit); keys A and B scored plans and B's brief asked for a wrong
  approach (Claude 2: item analysis, B likely replaced); F rewarded doing less, no controls, no severity veto (Claude 3,
  Codex 7: acceptance as a gate, P0 and P1 fail a run, controls); "not worse" without a bound, row 5 empty, one void
  sank the trial, no cost rule (Claude 4, Codex 2: a non-inferiority bound, rows rewritten, voids drop a cell, Fable
  by `tellsApart`); one yes for pilot and stage 1, the pilot's one-run stop rule, arm 2's Fable level with arm 1's not
  told (Claude 5, Codex 9: two gates, the pilot stops nothing, depth pass 4 and the question say it); sub-agents
  untested (Claude 6, Codex 8: a verifier sub-agent in every brief, an untested rule); stripping agent files where a
  forcing switch exists (Claude 7: `CLAUDE_CODE_SUBAGENT_MODEL` with `_FORCE`); isolation beyond MCP and the CLI version
  (Claude 8, Codex 4: the eval sandbox's home and switches, the version recorded); borrowed error figures (Claude 9,
  Codex 5: illustrations only, a simulation at gate 2); costs that did not add up (Claude 10, Codex 6: recomputed,
  reruns capped at five); schedule and meter circular (Claude 11, Codex 11: a Latin square at gate 2, the meter read
  only with no other session working, else descriptive; the pilot on all three bases with arm 3); task C's brief and
  key cited loosely (Claude 12: recovered whole or C replaced; key from L7, L10, L11); small errors (Claude 13: no
  `--mcp-config`, `claude stop`, `startArgs` at 58-68, Done when 2 reworded, "model default" not proven Opus, the
  request rewritten without additions); `session-model` covers the lead (Codex 1: rows 3 and 4 ask for a split rule);
  reader disagreement (Codex 10: the scoring manual of gate 2). Rebutted: none.

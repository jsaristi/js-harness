# Subagent model routing

Locator: `odd/tasks/subagent-model-routing.md` · Engram mirror: `odd/subagent-model-routing/tasks` · Branch: `feat/subagent-model-routing`

## Goal
Opus 5.5 orchestrating Opus 5.5 subagents and Opus 5.5 orchestrating Haiku 5.5 subagents are
measured side by side on our own eval tasks (quality, cost, speed and behaviour, read by kind of
delegated work), and the result is written in the roadmap with a recommendation.

## Why
Sebastián had read that Opus 5.5 with Haiku 5.5 subagents costs 75% less at the same quality and
runs much faster. That figure compares Haiku 5.5 with Haiku 4.5; Anthropic recommends Haiku as a
subagent for narrowly scoped work and publishes no measurement of Opus plus Haiku subagents
against Opus alone (engram `roadmap/subagent-model-routing`, 2026-10-08). Routing subagents to a
cheaper model goes into the harness only if a measurement of ours says it helps (principle 2).

From the roadmap's record of his decision of 2026-10-08 to compare the two: what Anthropic
published (anthropic.com/claude-haiku-5-5, read on 2026-10-08) is narrower: the 75% is Haiku
5.5 against Haiku 4.5; Sonnet 5.5 and Opus 5.5 "remain better choices" for complex agentic
coding (Terminal-Bench 4.0: 39.2% against Sonnet's 70.6%); Haiku is recommended as a subagent
for narrowly scoped work; and no figure is given for the pairing against Opus alone. So the
question to measure is the same quality on scoped work, cheaper and faster, read by kind of
work (exploring, running tests and reporting, writing code): quality by the hidden graders as
a pass rate over repeated runs, cost in list dollars and tokens of each model, wall time, and
how many subagents a run spawned. A run that spawns none measures nothing of this, so the
design has to make delegation happen. Its start prompt was handed to him on 2026-10-08.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/subagent-model-routing.md` exits 0
- `node --test "evals/**/*.test.mjs"` exits 0
- `node evals/report.mjs --require-complete --min-discriminating 3` exits 0, so F5's gate still
  holds with the new runs recorded
- `node evals/subagents-report.mjs --require-complete --modes write` exits 0, so the matrix of
  this feature (the `write` mode, since 2026-10-10) is complete and every counted trial delegated
- this document, `## Subagent models result`, records the result per delegation mode and task (both arms' score, list
  cost split between orchestrator and subagents, wall time, subagent outcomes) and the
  recommendation

## In scope / Out of scope
- In: `evals/` (configs, suite, runner, agent output, a report of its own, fixtures, the result
  summaries under `evals/results/subagents/`), `docs/ROADMAP.md`, this document.
- Out: the eval tasks and their hidden graders, and F5's recorded results and report — because a
  change would break the comparison with F5; `bin/` — because the published package does not run
  evals; changing how the harness routes subagents — because that is the decision this
  measurement informs, and it is Sebastián's; Haiku 5.5 as the orchestrator — because he ruled
  it out (never Haiku alone); updating Claude Code, Codex, gentle-ai or engram — because F6
  resumes on the measured stack.

## Constraints
- Both arms force the subagent model with `CLAUDE_CODE_SUBAGENT_MODEL=<full id>` and
  `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` — because without `_FORCE` the variable is only a default
  that the Agent tool's `model` parameter and an agent's frontmatter override, and because
  `_FORCE` also changes the system prompt, so an arm without it would differ in more than the
  model (Evidence, E1).
- The Haiku arm names `claude-haiku-5-5` in full, never the `haiku` alias — because on Claude
  Code 2.1.292 the alias resolves to Haiku 4.5 (E2).
- Cost is recomputed from each model's tokens at its published list price, recorded with source
  and date; Claude Code's `total_cost_usd` is kept beside it but decides nothing — because
  2.1.292 does not know Haiku 5.5's price and billed the probe's subagent at 25 to 40 times its
  list cost (E3).
- A trial counts only when `subagent_stats.spawned` is at least 1; a trial that did not delegate
  is reported apart and never averaged in — because it measures nothing about subagents, and in
  F5 only 5 of 60 trials delegated (E4).
- The base is the `minimal` arm at effort `high`, with the `write` delegation mode appended to
  the prompt, identical in both arms — because it isolates the one variable, the tasks do not
  delegate by themselves, and by his rule of 2026-10-10 Haiku 5.5 is a candidate only for
  subagents that write code under an orchestrator on Opus 5.5 at high effort (until that day the
  base was effort `medium` and three modes were to be measured; `explore` and `verify` stay on
  Opus 5.5 and their configs stay in the suite, unmeasured).
- Results live in `evals/results/subagents/` with a report of their own — because
  `evals/report.mjs` reads every `*.json` in `evals/results/` and rejects any config other than
  `minimal` and `current`.
- Spend is staged (Sebastián, 2026-10-08, resized on 2026-10-10 to the `write` mode alone): 1
  probe call (spent), 2 smoke trials, the rest of the first repeat (4 trials, 6 in all), then
  his go-ahead for the other 12. The count of a batch is stated before it starts — because
  other sessions use this machine and the runs draw on the plan's weekly cap.
- No gate or test suite beside a batch of trials: the gate lock keeps them apart, and a batch
  takes it with `js-harness gate -- <command>` (`odd/tasks/gate-lock.md`) — because parallel
  spawns on this host fail with `0xC0000142` (`odd/tasks/evals.md`, follow-ups).
- The stack is not updated by this feature, and every trial names Claude Code 2.1.296 by its
  versioned path (`C:\Users\Oficina\.local\share\claude\versions\2.1.296`), never the
  `claude` on PATH — because the native installer updates that one by itself (it went from
  2.1.292 to 2.1.296 on 2026-10-09), a run refuses to continue on another version, and 2.1.296
  knows Haiku 5.5 where 2.1.292 ran it on fallback limits (Sebastián, 2026-10-10).
- Zero dependencies — because every command in this repo runs with no install step.

## Effort
high

## Ask me before
Any eval batch or gate (its count first), any spend beyond the staged plan, an update of Claude
Code or of any tool of the stack, the delivery strategy once the branch passes about 400
authored lines, and what goes into the harness from the result.

## Design

Two arms, Opus 5.5 orchestrating in both:

| Arm | Subagent model |
|-----|----------------|
| `sub-opus` | `claude-opus-5-5` |
| `sub-haiku` | `claude-haiku-5-5` |

Three delegation modes, one per kind of work, appended to the task prompt:

| Mode | What the subagent does | What the orchestrator does |
|------|------------------------|----------------------------|
| `explore` | Maps the code and returns a brief | Writes the change |
| `verify` | Runs the tests and reports the failures | Writes the change |
| `write` | Writes the change | Plans, then reviews the result |

Three tasks with their hidden graders: `format-v2`, `house-rules`, `lost-updates`. Three repeats.
As designed: 2 arms × 3 modes × 3 tasks × 3 repeats = 54 trials, sequential. As measured since
2026-10-10: the `write` mode alone at effort high, 2 arms × 3 tasks × 3 repeats = 18 trials.

| Measurement | Source |
|-------------|--------|
| Quality | Hidden grader score, and the pass rate over the repeats |
| Cost | Tokens of each model at list price, orchestrator apart from subagents; a flag when a Haiku prompt passes 100,000 tokens, where its price is five times higher |
| Speed | Wall time of the trial |
| Behaviour | The whole `subagent_stats` (spawned, completed, failed, killed, refused, by type), turns, and work redone after a subagent, read from the session transcript kept before the trial home is deleted |

Known limits: the fixtures hold about 700 lines and F5's scores already sit at 0.98–1.00, so the
runs can show Haiku lowering quality and how much it saves; they do not measure exploration of
a large repository. In the `sub-opus` arm one model id covers both sides, so the split between
orchestrator and subagents comes from the main thread's `usage` against the `modelUsage` total,
or from the transcript.

Estimate, from F5's minimal arm at medium ($1.38, $0.40 and $0.52 a trial on the three tasks)
with 30% to 80% added for delegation: $40 to $75 at list price and 3.5 to 4.5 hours.

## Evidence

- E1 — Precedence, read in the installed binary 2.1.292 (function `m$`) and in
  `code.claude.com/docs/en/sub-agents.md`: the Agent tool's `model` parameter, then the agent's
  frontmatter `model`, then `CLAUDE_CODE_SUBAGENT_MODEL`, then the session's model. With
  `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` the first two are dropped (`ir`), and the Agent tool's
  description says the parameter is ignored. Built-in `Explore` and `Plan` are `model: "inherit"`.
- E2 — `rg -a -o "claude-haiku-[a-z0-9-]+"` over `claude.exe` 2.1.292 finds `claude-haiku-4-5`
  and no `claude-haiku-5-5`; `code.claude.com/docs/en/model-config.md` dates the alias moving to
  Haiku 5.5 to v2.1.293.
- E3 — Probe, 2026-10-08, one call: `claude --print --output-format json --model claude-opus-5-5
  --effort medium --setting-sources '' --strict-mcp-config --disable-slash-commands` with both
  variables set to `claude-haiku-5-5`, asked to spawn one subagent. Exit 0; `subagent_stats`:
  spawned 1, completed 1, by type `general-purpose`; `modelUsage` holds `claude-opus-5-5` and
  `claude-haiku-5-5`. stderr: `[claude-code:unrecognized_model] {"model":"claude-haiku-5-5"…}`.
  The Haiku entry reads `costBasis: "unknown"`, `contextWindow: 200000`, `maxOutputTokens: 32000`
  and `costUSD: 0.163913` for 32,765 cache-write tokens, which is $5 per million; Haiku 5.5's
  list price for them is $0.125 (5 minutes) or $0.20 (1 hour). `total_cost_usd` was 0.5052734.
- E4 — F5's recorded results (`evals/results/headroom.json`, `headroom-current.json`,
  `ab-high.json`): 5 of 60 trials spawned a subagent, all in the `current` arm, each one
  `general-purpose`; every `modelUsage` holds `claude-opus-5-5` alone.
- List prices per million tokens (`platform.claude.com/docs/en/about-claude/pricing`, read
  2026-10-08): Opus 5.5 $4 input, $20 output, $5 and $8 cache write (5 minutes, 1 hour), $0.20
  cache read; Haiku 5.5 $0.10, $0.50, $0.125 and $0.20, $0.01 up to a 100,000-token prompt, and
  five times each above it.
- The trial environment is an allowlist (`evals/configs.mjs:65`), so the two variables are added
  by wrapping the config's `env`, as the token is (`evals/suite.mjs:679`).

## Tasks

- [x] T0 Probe: Claude Code 2.1.292 accepts `claude-haiku-5-5` as a forced subagent model
  (route: inline; evidence E3; 1 call, about $0.35 at list price)
- [x] T1 The two arms and the three delegation modes: `sub-opus` and `sub-haiku` on the minimal
  base with both variables, the mode text appended to the prompt, a suite entry that writes to
  `evals/results/subagents/` (route: delegated writer, `evals/configs.mjs`, `evals/suite.mjs` and
  their tests). Six configs, `<arm>-<mode>`, because the runner's trial key has no place for a
  mode; the mode goes in `--append-system-prompt`; the results document pins each config (`subagentModels` in T1, reshaped by T2 into `subagentConfigs`).
  Writer's evidence, RED then GREEN: `node --test evals/configs.test.mjs` 74 pass, 0 fail;
  `node --test evals/suite.test.mjs` 76 pass, 0 fail
- [x] T2 What a trial records, and the fixes the reviews of T1 asked for (route: delegated writer).
  Every Claude record holds `subagentStats`, the object Claude Code printed. A subagent config
  keeps its session transcripts in the raw logs before the trial home is removed and records
  `transcripts` (`{ files, errors }`) and `listCost`: tokens of the orchestrator and of each
  subagent at dated list prices (`evals/prices.mjs`, `evals/transcript-usage.mjs`), with a check
  that the transcript totals equal `modelUsage`, and a low and high estimate when no transcript
  was kept. Fixes: `--summary --subagents` reaches a subagent run and prints no headroom
  screen; the results document pins `subagentConfigs` (model and the SHA-256 of the delegation
  text) and a refusal names what changed; the env test exercises the real `withToken`. Writer's
  evidence, RED then GREEN: `agent-output` 22 pass, `prices` 8, `transcript-usage` 16,
  `configs` 79, `suite` 79, `runner` 162 pass and 1 skipped (POSIX only), `report` 55, 0 fail.
  The probe session is reproduced exactly: $0.3413604 for Opus 5.5, $0.004097825 for Haiku 5.5
- [x] T3 `evals/subagents-report.mjs`: the two arms side by side per mode and task, trials
  without delegation apart, `--require-complete` (route: delegated writer), and the two fixes
  the reviews of T2 asked for. The report reads the results documents alone; a cell holds the
  counted trials, score, pass rate, list cost split between orchestrator and subagents, wall time
  and turns, and a row of the Haiku arm against the Opus arm; an estimated cost is marked and
  enters no mean; `--require-complete` asks 3 counted trials in every cell. Fixes: an earlier
  attempt's transcripts that cannot be removed are never summarized (nothing is kept, the cost
  falls to the estimate and the record says why), and kept transcripts with no readable request
  record `transcriptsWithoutRequests`. Writer's evidence, RED then GREEN for the two fixes:
  `runner` 163 pass and 1 skipped (POSIX only), `transcript-usage` 18, `subagents-report` 17,
  `report` 55, `suite` 79, `configs` 79, 0 fail; with no run recorded the report exits 0 and
  `--require-complete` exits 1. Parent spot check: `subagents-report` 17 pass
- [x] T3c The report takes the modes that count: `--modes write`, so `--require-complete` asks
  the cells of the plan and no others (route: delegated writer). Trials of a mode left out are
  counted in one line and enter nothing; the checks of a run's stack and pins still cover every
  trial. Writer's evidence, RED (3 fail: unknown argument) then GREEN: `subagents-report` 24
  pass, 0 fail; 119 lines added, 16 deleted. Parent spot check: 24 pass
- [x] T4 Smoke: 2 trials, one per arm, `house-rules` in `write` mode at effort high (route:
  inline; run `write-high`, `evals/results/subagents/write-high.json`). Both arms delegated
  (spawned 1, completed 1) and scored 0.98; the transcripts name `claude-opus-5-5` and
  `claude-haiku-5-5` as the subagents' models, each at effort high, so the forcing holds on
  2.1.296; list cost $0.90 against $0.38, and Claude Code's own cost equals it on this version
- [x] T5 The rest of the first repeat: 4 trials (`format-v2` and `lost-updates`), 6 with the smoke
  (route: inline; the same run `write-high`, continued). All 6 delegated and none failed;
  `--require-complete --modes write` exits 1 as it must, each cell at 1 of 3
- [x] T6 The other two repeats: 12 trials, after Sebastián's go-ahead (route: inline; the run
  `write-high` continued with `--repeats 3`, 4,947 s, exit 0). 18 of 18 trials delegated, none
  failed; `node evals/subagents-report.mjs --require-complete --modes write` exits 0
- [x] T7 The result and the recommendation in this document (route: inline, one document):
  the section "Subagent models result", and item 8 of Next points to it

## Progress

- 2026-10-08 — Worktree `D:\js-harness-worktrees\subagent-model-routing` cut from `main`
  (`3e9427c`) with its own CodeGraph index. Mechanism verified (E1, E2), `evals/` mapped (E4),
  design approved by Sebastián, probe spent (E3). Next: T1. Pending: the delivery strategy, since
  the forecast is about 950 authored lines over T1 to T3.
- 2026-10-08 — The document committed as `4226cd2` (gate 1; review not due, passive). T1 written:
  402 authored lines, about 280 of them tests. Left for T2 and T3, noticed while writing T1:
  `--summary --name <run>` cannot read a subagent run, since it looks in `evals/results/`
  (`evals/suite.mjs`, the summary mode); the summary printed at the end of a run includes F5's
  headroom screen, which reads `minimal` only and so shows every task of a subagent run as
  incomplete; the mode text is not pinned in the results document, only the subagent model, so
  an edited text would not refuse a continued run; the refusal header still says "another
  stack" when the change is a subagent model. Next: T2.
- 2026-10-08 — Delivery (Sebastián): three pull requests stacked to `main`, as F5 and F6 were
  delivered. Slice 1 holds T1 and T2 (the arms and what a trial records), slice 2 holds T3 (the
  report), slice 3 holds the runs and the result (T4 to T7). Each merge waits for his go-ahead.
- 2026-10-08 — Harness candidate, from how this decision was asked. The first request for it
  gave him a `Sí` to send over terms he had no translation for ("slices stacked to main") and
  folded a gate into the same answer; he replied that he was told to say yes without being told
  what to. The rule he then set: a request for a decision is clear, detailed and concise, so he
  can decide fast — what the yes covers in everyday words, what it does to him, what it does not
  authorize, what the other option means, and one thing per yes. He added that decisions like
  these always touch the harness, so the rule belongs with the session signals the harness
  ships (`AGENTS.md`, "Working with Sebastián"; the reworded text lives on
  `feat/codex-review-lean`), not only in an agent's memory.
- 2026-10-08 — T1 committed as `f0df385` (gate 2: budget, contracts and tests pass). gentle-ai
  assessed the range `4226cd2..f0df385` as medium risk, review due (`slice_budget_reached`);
  consent is pre-granted and the review runs under lineage `review-494e565015e32cc4`. The gate
  left an untracked `Microsoft/Windows/PowerShell/ModuleAnalysisCache` at the worktree root,
  the same stray file seen on 2026-10-05 in the `codex-parity` worktree; removed.
- 2026-10-08 — Reviews of `4226cd2..f0df385`. gentle-ai: approved and acknowledged (lineage
  `review-494e565015e32cc4`, authority burned), with three informational findings. Codex:
  reviewed and recorded (`js-harness codex-review --base 4226cd2`), two P2 findings, the same
  two that gentle-ai marked as warnings and the writer had noted: `--summary --name <run>` reads
  `evals/results/<run>.json` and so cannot reach a subagent run, or reads an F5 run of the same
  name (`evals/suite.mjs:561`); and a continued run is not refused when a delegation text
  changed, because only the subagent model is pinned (`evals/suite.mjs:692`). Both are accepted
  and go into T2, with gentle-ai's suggestion that a test of the inherited env reimplements the
  overlay it tests (`evals/configs.test.mjs:530`). The first Codex attempt refused to start
  because this document had an uncommitted note; nothing was spent.
- 2026-10-08 — Asked where to cement the two rules, Sebastián did not pick a place for a patch.
  He asked for the rules to be ranked properly: `AGENTS.md` as the orchestrator of the main and
  most important rules, the rest of the harness's information in another place that matters as
  much, and as the first rule of all that nothing is done for the sake of doing it or of
  complying, but in the best and correct way, one that works better than expected, with
  protocols, knowing that many protocols complicate. Proposed in answer, not yet decided: three
  levels (principles and an index in `AGENTS.md`; protocols loaded on demand, as the skill
  `install` already writes; checks a command or hook runs), a placement test for every new
  rule that prefers the lowest level able to enforce it, and a feature of its own in its own
  session, which also absorbs the session signals pending on `feat/codex-review-cost`.
- 2026-10-08 — His answer: a feature of its own, in its own session. Its plan is written in
  `docs/ROADMAP.md` ("Rule hierarchy (planned)") on the branch `docs/rule-hierarchy-plan`, cut
  from `main` in `D:\js-harness-worktrees\rule-hierarchy-plan`, a delivery apart from this
  feature's slices; nothing in `AGENTS.md` changes here. This feature goes on with T2.
- 2026-10-08 — He then said not to take his wording as the specification and asked to be guided
  to the best way, and asked for one document from which a later, more capable model could
  rebuild the harness from nothing and better. The plan on `docs/rule-hierarchy-plan` was
  rewritten as the recommended design: each rule where it cannot be forgotten (a check, then a
  line in `AGENTS.md`, then a protocol on demand), and `docs/SPEC.md`, what the harness must
  achieve and why with a command that proves each capability, never how it is coded today. He
  approved it ("hagámoslo como dices"), in a new session, with the main session told. The first
  gate of that branch timed out after 1,200 s because it ran while the T2 writer ran its tests:
  nothing was committed, and gates run one at a time after the writer from here on.
- 2026-10-09 — The plan of the rule hierarchy and of `docs/SPEC.md` is on `main`: commit `e2710da`
  (gate passed alone; review not due, passive), pull request `jsaristi/js-harness#41`, merged on
  his go-ahead as `ee74d18`, and the main checkout fast-forwarded to it. That feature is another
  session's from here; this one goes on with T2's commit and reviews, then T3.
- 2026-10-08 — Directive (Sebastián), said after the note above was all that recorded the rule:
  what lives in an agent's memory is always forgotten, so everything is saved and cemented in
  the harness, in the documentation and also in the files where it must go for the harness to
  work here and wherever it is installed. A note in a feature document or a memory entry alone
  does not count as recorded. The files that carry a working rule, checked the same day: this
  repository's `AGENTS.md` (1,497 of its 1,500 tokens, `bin/check.mjs:15`), the base `AGENTS.md`
  that `init` writes in a project (`agentsTemplate`, `bin/lib/project.mjs`), and the skill that
  `install` writes on a machine for Claude Code and Codex (`skillContent`,
  `bin/lib/manifest.mjs`). Pending his decision: which session and delivery cements the two
  rules of today there, since `feat/codex-review-cost` already rewrote that section of
  `AGENTS.md` up to the budget.
- 2026-10-09 — T2 committed as `c96eda7` (gate passed alone). Reviews of `f0df385..c96eda7`:
  gentle-ai approved and acknowledged (lineage `review-4fb1aa1d60984563`, authority burned), with
  two informational findings; Codex found no actionable regression and the review is recorded
  (`js-harness codex-review --base f0df385`). The two findings are accepted and are fixed before
  any trial runs, in T3's slice, because both let a wrong cost pass as measured: when removing an
  earlier attempt's transcripts fails (EBUSY or EPERM on Windows) the earlier session is
  summarized as this trial's (`evals/runner.mjs`, `keepTranscripts`); and a kept transcript with
  no readable request falls back to the `modelUsage` estimate without saying a transcript was
  there (`evals/transcript-usage.mjs`, `trialListCost`).
- 2026-10-09 — Where the feature stands, for whoever resumes it. Done and reviewed: T0, T1, T2.
  Next, in order: (1) ask Sebastián to deliver slice 1 (T1 and T2, the commits up to `c96eda7`; `main` moved to
  `ee74d18` since the branch was cut, so bring `main` into the branch first) as a pull request;
  (2) T3 by one delegated writer: the two fixes above, then `evals/subagents-report.mjs`, which
  reads `record.listCost` and branches on its `source`, counts a trial only when
  `subagentStats.spawned >= 1`, and shows `modelUsageCheck.matches === false`, `unpricedModels`,
  `longPromptRequests`, `transcripts.errors` and `unreadableLines` as flags; (3) its gate, the
  gentle-ai review and the Codex review; (4) T4, the 2 smoke trials, only after their count and
  cost are put to him, with `JS_HARNESS_EVAL_OAUTH_TOKEN` checked first and nothing else running.
  How the gates are run here: one at a time, in the background, after the idle check, and never
  while a writer runs its tests (that overlap cost one gate on 2026-10-08).
- 2026-10-09 — Slice 1 delivered on Sebastián's go-ahead: `main` (`ee74d18`) merged into the
  branch as `bb16a44` (a clean merge, `docs/ROADMAP.md` only, so no pre-commit gate ran), the
  branch pushed (the pre-push row passed: 2 code commits, both covered by a Codex review record),
  pull request `jsaristi/js-harness#42`, merged as `653f5eb`. The repository has no workflow on
  GitHub, so no check ran there; he had been told one would, and was told it did not. The gates
  that stand for this slice are the pre-commit ones on `f0df385` and `c96eda7`. Slice 2 (T3)
  goes on in this branch, and its review boundary is `c96eda7`.
- 2026-10-09 — T3 written: about 1,060 authored lines (the report 557, its tests 404, the two
  fixes 100) and a 375-line results fixture; over the planning figure because the report and its
  tests are one unit. Choices to know. When an earlier attempt's transcripts cannot be removed,
  this attempt keeps nothing, so its measured cost is lost and the estimate stands in, flagged;
  keeping them in a second directory would need a fallback of its own. `--require-complete`
  asks 3 counted trials per cell whatever a run's `--repeats` was, so the first repeat alone (18
  trials) does not pass it, and a trial that did not delegate leaves its cell short. Flags do
  not fail the gate. The report also refuses runs whose pinned subagent model is not their
  arm's, or that pin different delegation texts. The writer saw no RED for the report's own
  tests: other sessions' gates held the machine for about 25 minutes, and its first run was 15
  pass and 2 fail, both mistakes in the tests. Gaps against the Design table: work redone after
  a subagent is not in the record, so it is not shown and would be read by hand from the kept
  transcripts; tokens per model and the per-subagent rows are recorded but not printed; the
  report gives no verdict between the arms, which is T7's. Left as follow-ups, outside T3:
  `SUBAGENTS_DIR` is not exported from `evals/suite.mjs`, so the report retypes `subagents`; the
  three task ids are a constant in the report; `table` and the text helpers of
  `evals/report.mjs` are private and copied; the comment on the transcripts hook in
  `evals/configs.mjs` does not say its directory may be `null`.
- 2026-10-09 — T3 committed as `779bb4a` (gate 6 passed alone). Reviews of `c96eda7..779bb4a`.
  gentle-ai: medium risk, review due (`slice_budget_reached`), approved and acknowledged (lineage
  `review-e43f994da38f38b7`, authority burned), three informational findings, all in
  `evals/subagents-report.mjs`: the comparison row subtracts counts of passed trials, not pass
  rates, so 2 of 2 against 3 of 3 reads as -1 (`R3-passdiff-unequal-counts`, a warning); a
  missing delegation digest is accepted where a missing model is refused
  (`R3-missing-digest-accepted`); and a star can be printed with no footnote
  (`R3-star-without-footnote`). Its first bound STATUS failed with `operation_timeout` while
  another session's gate loaded the machine (nothing had been mutated); the same STATUS, asked
  again, answered. Codex: one P2, recorded (`js-harness codex-review --base c96eda7`): the
  delegation digests are compared per config and never across the two arms of a mode, so arms
  collected before and after an edit of a delegation text would be compared as if they had been
  given the same prompt. The four are accepted and fixed in one follow-up commit of this slice,
  by the same writer, before any trial runs.
- 2026-10-09 — The four fixed, each with its failing test seen first (`subagents-report` 21
  pass, 0 fail; 115 lines added, 20 deleted). The report now compares the delegation digests by
  mode across both arms and every run, also inside one run, and refuses a config that has
  trials and no digest; the comparison row gives the difference of pass rates in percentage
  points, each rate over its own cell (2 of 2 against 3 of 3 reads `0pp`); and one predicate
  decides both the star and its footnote. Noted by the writer: a continued run that gains an arm
  keeps the first arm's pin, so one results document can hold two digests for one mode, which
  the report now refuses.
- 2026-10-09 — The fixes committed as `8cb6ec0` (gate 7 passed alone). gentle-ai assessed
  `779bb4a..8cb6ec0` as medium risk, 157 lines, review not due (`under_budget`): it stays pending
  in the slice until a later commit reaches the budget. Codex found no actionable regression
  and the review is recorded (`js-harness codex-review --base 779bb4a`). T3 is closed and slice
  2 is `779bb4a` and `8cb6ec0`. Next, one decision at a time: Sebastián's go-ahead to deliver
  slice 2 as a pull request, then the count and cost of the 2 smoke trials (T4);
  `JS_HARNESS_EVAL_OAUTH_TOKEN` is set in this environment.
- 2026-10-09 — Harness candidate, from his answer to the request to deliver slice 2. He said yes
  on a condition: a session about to do something shared asks the orchestrator first whether it
  breaks the flow, since several sessions will run at once and can collide, or he is told a
  better way before his yes counts. Meanwhile `origin/main` had moved to `d6cf6be` (pull
  requests 43 to 45 of other sessions), which this session learned only by fetching. Proposed in
  answer, pending his word: facts before questions. `js-harness sessions` (the board of
  `feat/session-board`, not yet on `main`) already prints from disk what each session is doing,
  the running gates and the open pull requests; run from this session it showed no gate, no
  open pull request and the orchestrator waiting for his answer on its own delivery. So a
  session reads the board before any shared action (a gate, an eval batch, a push or merge to
  `main`) and reports what it saw in its request to him. A message to the orchestrator is a
  notice, not a question to wait on: a message starts a turn there and buries the question it
  has open with him. Two gaps the board names or cannot close, proposed for the orchestrator's
  feature and not built here: `check` takes a machine-wide lock in the git common directory, so
  two gates cannot overlap even when both sessions saw an idle machine in the same minute; and a
  line of intent a session appends before a shared action and the board prints, since "what a
  session plans to do next" is what the board says it cannot see.
- 2026-10-10 — That proposal is superseded by what he decided the same day with the orchestrator,
  read in `docs/ROADMAP.md` on `origin/main` ("Session channel (planned)", moved on 2026-10-15
  to `odd/tasks/session-channel.md`, section 16) and in the relief
  file `C:\Users\Oficina\.js-harness\relief\D--js-harness.md` (line 4, the charter): one
  orchestrator per project, the session titled "JH ORQ · js-harness", is the lead; a work
  session asks it for a turn by `SendMessage` before a gate, a test run, a trial batch or a
  board read, and waits for its "go"; a push and a pull request need no yes of his once the gate
  and both reviews are green; merging code, spend outside the plan and product choices stay
  his. The machine lock this document proposed is being built by another session
  (`feat/gate-lock`, unmerged). The question left open with him about slice 2 is withdrawn: its
  gate, push and pull request go under the charter, and only the merge is asked of him. Context
  rule of the same day: nothing stops for a percentage; at 85 percent a session writes its
  state here, then finishes if little is left or asks for the compaction. `origin/main` is at
  `d3bc399`, 85 commits ahead of this branch, with no file in common with slice 2.
- 2026-10-10 — Slice 2 is pull request `jsaristi/js-harness#51`, open, not merged: the merge of
  code is his, and the orchestrator asks him. `origin/main` merged in as `da550c0`; on the
  orchestrator's "go", the entries above committed as `301c4ce`, whose gate ran over the merged
  tree (gate 8, 832 s, passed alone); pushed, the pre-push row green. A mistake of this
  session: the push was chained after `gentle-ai review assess --base-ref 779bb4a
  --committed-only` and ran before its answer was read. The answer was "review due,
  slice_budget_reached, 26,343 lines", because that range now holds the merge of `main`; the
  lines authored here since the reviewed boundary are 157 (`8cb6ec0`, assessed alone as under
  budget and reviewed by Codex) and 37 of this document (passive), so no review was started,
  by this session's judgment and not the tool's. From now: an assessment is read before the next
  command, and after `main` is merged in the base of the next assessment is the merge commit.
  Next: T4, the 2 smoke trials, with a turn asked of the orchestrator.
- 2026-10-10 — Found while preparing T4: the stack moved by itself. `claude --version` on PATH
  now answers 2.1.296; the native installer replaced `C:\Users\Oficina\.local\bin\claude.exe`
  on 2026-10-09 at 14:36 (`autoUpdatesProtectedForNative: true` in `~/.claude.json`), with
  2.1.295 the night before. Nobody in this feature updated it. Both binaries are still on disk
  and answer by path: `C:\Users\Oficina\.local\share\claude\versions\2.1.292` and
  `...\versions\2.1.296`, and the suite takes the binary as an absolute path (`--claude`), so a
  run can be pinned to either file and is then safe from the next update. Read in the 2.1.296
  binary: `claude-haiku-5-5` appears 32 times (none in 2.1.292, E2) and
  `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` 14 times. The choice is a change of a constraint of this
  contract, so it is put to Sebastián before any trial: 2.1.292 is the stack the evidence was
  gathered on, but there Haiku 5.5 is an unrecognized model that runs on fallback limits
  (E3: a 200,000-token window and 32,000 output tokens), so a weak result of the Haiku arm could
  be the old binary's and not the model's; 2.1.296 knows the model and is what a session runs
  today, which is where routing would be used. Recommended: 2.1.296 by its versioned path, with
  the 2 smoke trials as its probe (the transcript shows each subagent's model, so the smoke
  proves the forcing still holds).
- 2026-10-10 — His answer, given in the orchestrator's chat and relayed here under the protocol
  he approved the same minute (his answers given there travel to the session that asked, with
  his exact words and where to check them). Checked in the orchestrator's transcript
  `182ad401-252a-4cbe-afcc-929fcd905c6a.jsonl`: line 990, an entry of origin `human` at
  2026-10-10T19:40:12Z, and line 1044, his "Si" to the relay. His words, whole: "si pero solo
  para codificar quiero el haiku pero de resto ahora que estamos diseñando el harness o cuando
  vayamos a tratar cosas de planificacion debe ser minimo opues 5.5 alto o fable 5.5 alto (que
  aun no ha salido), ningun otro modelo hasta la fecha". Settled by it: the trials run on
  Claude Code 2.1.296, pinned by its versioned path. Read from it, this session's reading and
  his to accept: a product rule, Haiku 5.5 is a candidate only for subagents that write code,
  and designing and planning stay on Opus 5.5 at high effort or better. Against the design
  above that rule leaves one mode with a decision behind it, `write`, where the orchestrator
  plans and reviews and the subagent codes; `explore` feeds the plan, so Haiku is ruled out
  there before any trial, and `verify` (run the tests, report) is neither planning nor coding
  and his words do not cover it. It also says the orchestrator he will really run is Opus 5.5
  at high, not the medium of the base. Proposed to him, pending: measure `write` alone, at
  effort high: 2 arms × 3 tasks × 3 repeats = 18 trials instead of 54, about $22 to $31 at list
  price and 1.5 to 2 hours (F5's minimal arm at high cost $1.67, $0.47 and $0.72 a trial on the
  three tasks, `evals/results/ab-high.json`, with 30% to 80% added for delegation), staged as 2
  smoke, 4 for the rest of the first repeat, and 12 on his go-ahead. It needs one change of
  code: `--require-complete` of the report asks the three modes today, so the modes that count
  must be named to it. The configs of the other two modes stay in the suite, so a mode can be
  measured later with runs alone.
- 2026-10-10 — Accepted. His words, in the orchestrator's transcript at line 1112 (origin
  `human`, 2026-10-10T19:55:22Z), answering the plan as put to him with the lead's
  recommendation that verifying stays on Opus 5.5 at high effort and is not measured now: "SI
  verificar tambien, excelente aporte proactivo, por favor necesito que tu orquestador y las
  sesiones sean mas autonomas y trabajen mas de seguido sin interrupciones, por favor
  implementalo y dale la informacion para que no paren tanto y avancemos mas". Read here as: yes
  to the `write` mode alone at effort high, 18 trials staged 2, 4 and 12; verifying also stays
  on Opus 5.5 (the reading that fits the recommendation he praises; if he meant that verifying
  be measured too, its configs are in the suite and it takes runs alone). Goal, Done when,
  Constraints, Design and Tasks above are rewritten to that plan. How this session works from
  now, the lead's standing notice from his words: it stops for him only for spend outside the
  plan, a change on a machine, a product choice, what cannot be undone, a change of the plan's
  scope or order, a new protocol, and the merge of code; before a gate or a batch it looks at
  the process list itself and starts, one try; push and pull request go once the gate and both
  reviews are green; one line to the lead per gate or batch. The trial batches run after that
  look and not under the `gate` command of `feat/gate-lock`: it is unmerged with four open
  findings about how Windows quotes a command, and these commands carry quoted paths.
- 2026-10-10 — T4, the smoke (batch 1 of 3; it waited 450 s for another session's gate, then
  ran 403 s, exit 0). `house-rules`, `write` mode, effort high, one trial per arm:

  | Arm | Score | Wall | List cost | Orchestrator | Subagent | Subagent span |
  |-----|-------|------|-----------|--------------|----------|---------------|
  | `sub-opus` | 0.98 | 2m21s | $0.899 | $0.478 | $0.421 | 83 s |
  | `sub-haiku` | 0.98 | 3m56s | $0.383 | $0.359 | $0.024 | 162 s |

  One trial per arm, so nothing is concluded; what the smoke was for holds: each arm spawned and
  completed one `general-purpose` subagent, the transcript totals equal `modelUsage`, no model is
  unpriced and no prompt passed 100,000 tokens. On 2.1.296 Claude Code prices Haiku 5.5 itself:
  its `total_cost_usd` equals the list cost in both arms, where 2.1.292 was 25 to 40 times off
  (E3). The run pins the stack as Claude Code 2.1.296, gentle-ai 4.0.0, engram 3.3.0 and its
  plugin 0.1.6: engram was updated on this machine since F5 (3.0.0 and 0.1.5), not by this
  feature; told to the lead. Batch 2, the 4 trials that complete the first repeat, follows by
  the same look.
- 2026-10-10 — T3c and T5. Batch 2 waited 600 s for the machine and ran 2,415 s, exit 0. The
  first repeat, `node evals/subagents-report.mjs --modes write`, one trial per cell, effort high:

  | Task | Arm | Score | List cost | Orchestrator | Subagents | Wall |
  |------|-----|-------|-----------|--------------|-----------|------|
  | `format-v2` | `sub-opus` | 1.00 | $2.213 | $0.743 | $1.470 | 8m56s |
  | `format-v2` | `sub-haiku` | 1.00 | $1.144 | $0.759 | $0.384 | 11m59s |
  | `house-rules` | `sub-opus` | 0.98 | $0.899 | $0.478 | $0.421 | 2m21s |
  | `house-rules` | `sub-haiku` | 0.98 | $0.383 | $0.359 | $0.024 | 3m56s |
  | `lost-updates` | `sub-opus` | 1.00 | $1.774 | $0.599 | $1.175 | 8m16s |
  | `lost-updates` | `sub-haiku` | 1.00 | $0.750 | $0.616 | $0.134 | 10m25s |

  Over the three tasks the Opus arm cost $4.886 and the Haiku arm $2.277, 47% of it, at the
  same score in every cell, and the Haiku arm took 1.26 to 1.67 times as long. One trial per
  cell: a first reading, not a result. What it already shows about why the saving is about
  half and not the 75% he had read: the orchestrator costs the same in both arms ($1.82 against
  $1.73) and is 37% of the Opus arm, and the Haiku subagent spends more tokens for the same
  change, 2.8 to 3 times the output tokens and up to 2.8 times the cache reads, with 28 and 7
  of its requests over the 100,000-token prompt where its price is five times higher (the
  report's only flags). Every trial spawned and completed its subagents (`lost-updates` in the
  Haiku arm spawned 2). Spent so far on trials: $7.16 at list price, and $0.35 for the probe.
  The 12 trials of the other two repeats are his go-ahead: about $14 and 95 minutes of
  machine by the first repeat's figures.
- 2026-10-10 — T3c, T4 and T5 committed together as `3a58457` (gate 9, 948 s, passed alone; one
  commit so that one gate covered the three). gentle-ai assessed `301c4ce..3a58457` as medium
  risk, review due (`slice_budget_reached`, the results file counted), and approved it,
  acknowledged (lineage `review-27e04df35559b137`), with two suggestions, both taken and waiting
  in the working tree for the next commit: a test that a mode left out by `--modes` is still
  held to its run's checks (`R3-leftout-checks-unasserted`; added, `subagents-report` 25 pass,
  green from the start since it pins what the code already does), and the path of the pinned
  binary in the Constraints, which a scripted edit of this document had stripped of its
  backslashes (`R3-mangled-pinned-path`; restored). Codex reviewed the two code files (135
  changed lines; the document and the results file are left out by the plan of the command),
  found no defect and is recorded (`js-harness codex-review --base 301c4ce`, 182,984 input
  tokens). Not pushed: pull request #51 is open from this branch and a push would add to what
  he is asked to merge; `3a58457` and what follows are slice 3, pushed once #51 is merged. Open
  with him, asked through the lead: the go-ahead for the 12 trials of T6.
- 2026-10-10 — The go-ahead for T6, and slice 2 merged. His words, in the lead's transcript
  `182ad401-252a-4cbe-afcc-929fcd905c6a.jsonl` at line 1403 (origin `human`,
  2026-10-11T01:10:48Z): "Sí a las cuatro: Codex a 6,5 millones, fusioná vos el código y dá vos
  el visto bueno de las etapas, los commits de solo documentos no corren las pruebas, y acortá
  el gate con las dos cosas". The second of the four things put to him (line 1398) is that the
  lead merges code once the gate passed and both reviews are clean, and gives the go-ahead of
  the later stages of a plan he approved, naming pull requests 51, 52 and 53 and the 12 trials
  of this feature. Under it the lead gave the go for the 12 and merged #51 as `fdbff46`
  (`gh pr view 51`: MERGED); `origin/main` is at `ca013c2`. Batch 3 of 3 started by this
  session's own look at the process list: the same command with `--repeats 3`, 12 trials to
  run. `main` is brought into the branch after the batch, not during it, since the run reads
  the tasks from this worktree.
- 2026-10-10 — Notice from the orchestrator while batch 3 runs (`evals/suite.mjs`, pid 31300,
  started 20:12:57 local): another session's tests ran beside it, a Codex review from 20:13:48
  to 20:15:32, short test files from about 20:17, and `node --test` pid 3800 with three
  children from 20:27:21, still alive at 20:30:21. The cause is on the lead's side: its list of
  what a session looks for before a heavy run left out `evals/suite.mjs`. Scores and list cost
  do not depend on machine load; wall time does. To do when the batch ends: mark each trial in
  flight in those windows from its start time and wall time, compare it with its cell's other
  repeats and with the subagent's span, and report wall time over the unmarked trials if a
  marked one is out of line, saying which were used. The durations of the first repeat were
  not checked against other sessions' work either.
- 2026-10-10 — T6 and T7. Batch 3 started on an idle machine and ran 4,947 s, exit 0. With
  three trials a cell: the same score in every pair (1.00, 0.98, 1.00); list cost $14.64 for
  the Opus arm and $6.11 for the Haiku arm over nine trials each (42%), the subagents' part
  $9.30 against $1.04 and the orchestrator's $5.35 against $5.08; wall time 62 against 65
  minutes. The table, the reading, the limits and the recommendation are in this document,
  "Subagent models result". Spent on trials in all: $20.76 at list price, and $0.35 for the
  probe, against an estimate of $22 to $31. Durations, by the windows the lead passed on
  (another session's claims, local time): `format-v2` `sub-opus` #2 (20:12:58 to 20:23:30) ran
  beside a Codex review and short test files and is the slowest of its cell (632 s against 536
  and 502), with the most orchestrator work too; `format-v2` `sub-haiku` #2 (20:23:37 to
  20:31:56) ran beside the heavy test run of 20:27:21 to 20:32:25 and is the fastest of its
  cell (499 s against 719 and 633); `house-rules` `sub-opus` #2 caught its last 22 seconds. A
  browser playing video was open from 21:05:36, beside the last five trials; of those
  `lost-updates` `sub-opus` #3 is the slowest of its cell (665 s against 496 and 463) and
  `lost-updates` `sub-haiku` #3 the fastest of its own (346 s). No marked trial is out of line
  in one direction, so every duration is used and the roadmap says the speed line is the
  weakest; nothing was repeated. `origin/main` (`ca013c2`, with slice 2 merged as `fdbff46`)
  merged in as `9cf9801` after the batch.
- 2026-10-10 — T6 and T7 committed as `8bfa4e7` (gate 10, 988 s, passed alone after waiting 780 s
  for another session's gate). Reviews of `9cf9801..8bfa4e7`: gentle-ai assessed it as medium
  risk, review due (`slice_budget_reached`, the results file counted), approved and acknowledged
  (lineage `review-813f14064554c533`), with one suggestion, taken: the roadmap said "one
  subagent" where two trials of the Haiku arm spawned a second (`R3-one-subagent-wording`).
  Codex reviewed the one code file (15 changed lines), found no defect and is recorded
  (`js-harness codex-review --base 9cf9801`, 103,892 input tokens). `origin/main` (`df15929`,
  pull request 53 of another session) merged in clean after the reviews. Every command of Done
  when was run on this branch and exits 0, `npm run check` as the gate of the commit that
  carries this entry. Slice 3 is `3a58457`, `8bfa4e7` and that commit; the lead merges it. Open,
  his: what goes into the harness from the result, with the recommendation in the roadmap, and
  the two measurements it names (Opus alone on this version, 9 trials and about $9; one task
  hard enough to leave the score ceiling), each his to approve. Follow-ups left in the code, none
  blocking: `SUBAGENTS_DIR` is not exported from `evals/suite.mjs`, the three task ids are a
  constant in the report, and the text helpers of `evals/report.mjs` are copied into it.

## Subagent models result

Measured on 2026-10-10 (`odd/tasks/subagent-model-routing.md`): Opus 5.5 at high effort
orchestrating a subagent that writes the change, with every subagent forced to Opus 5.5 in one
arm and to Haiku 5.5 in the other (one subagent a trial, except two trials of the Haiku arm
that spawned a second). Three tasks, three trials a cell, 18 trials, under
`bypassPermissions`, Claude Code 2.1.296 with gentle-ai 4.0.0 and engram 3.3.0 (`node
evals/subagents-report.mjs --modes write` over `evals/results/subagents/write-high.json`). The
orchestrator plans, delegates the writing and reviews the result; every trial delegated and none
failed. Score is the hidden grader's, the same in every trial of a cell; cost is the mean list
cost of one session, read from its transcripts, with the orchestrator apart from its subagents.

| Task | Score Opus / Haiku | Cost Opus / Haiku | Ratio | Orchestrator Opus / Haiku | Subagents Opus / Haiku | Wall Opus / Haiku |
|------|------|------|------|------|------|------|
| format-v2 | 1.00 / 1.00 | $2.40 / $1.03 | 0.43× | $0.84 / $0.79 | $1.56 / $0.24 | 9m17s / 10m17s |
| house-rules | 0.98 / 0.98 | $0.81 / $0.40 | 0.50× | $0.39 / $0.38 | $0.41 / $0.03 | 2m21s / 3m44s |
| lost-updates | 1.00 / 1.00 | $1.68 / $0.61 | 0.36× | $0.55 / $0.53 | $1.13 / $0.08 | 9m02s / 7m40s |

Read plainly, against what he had read (75% cheaper at the same quality, and much faster):

- Quality: the same. The Haiku subagent's change scored what the Opus subagent's did in all nine
  pairs.
- Cost: 58% less for the session, $6.11 against $14.64 over nine trials each. The subagent's own
  work costs 89% less ($1.04 against $9.30), but the orchestrator is Opus in both arms and costs
  the same ($5.08 against $5.35), so it is 83% of what the Haiku arm costs. Haiku also spends
  more to make the same change: 2.3 times the output tokens and 2 times the cache reads, and on
  `format-v2` and `lost-updates` 54 of its requests passed the 100,000-token prompt, where its
  price is five times higher.
- Speed: not faster. 65 minutes against 62 over the nine trials. Slower on the small task in
  every repeat (1.58×), and on the two larger ones the repeats of the two arms overlap.

What it does not show. These tasks sit at the score ceiling with any config (F5), so they can
show that Haiku costs less on scoped work and cannot show where it starts to write worse code;
Anthropic's own figures put it well under Sonnet 5.5 and Opus 5.5 on complex agentic coding. Three
tasks and three trials a cell are a small sample. Wall time was taken on a machine other
sessions were using: tests of another session ran beside three of the trials and a browser
beside five more; the marked trials are not out of line with their cells, but the speed line
above is the weakest of the three. And both arms delegate: F5 ran the same three tasks with
Opus 5.5 alone at high effort, on Claude Code 2.1.284, for $2.86 and 11 minutes the three, which
is less than Opus with an Opus subagent ($4.88, 21 minutes) and faster than either arm. That
figure is from another version and another week, so it is a pointer, not a comparison.

Recommendation, his to decide. Where a session already delegates the writing of scoped code,
forcing that subagent to Haiku 5.5 is supported by this measurement: same score, less than half
the cost. It is no reason to delegate more: on tasks this size the delegation is what costs,
not the model. So nothing is turned on by default in the harness from this alone. If it goes
in, it goes in as the model of the writing subagent only, set on the call that delegates the
writing, never as `CLAUDE_CODE_SUBAGENT_MODEL` for the session, which would also move the
subagents that explore, review and verify, and his rule of 2026-10-10 keeps those on Opus 5.5
at high effort. Two measurements would settle what this one leaves open, each his to approve:
the same three tasks with Opus 5.5 alone at high effort on this version (9 trials, about $9), so
that not delegating is in the same table; and one task hard enough to leave the ceiling.

Decided for this repository's way of working (Sebastián, 2026-10-11, "apliquemos lo que
investigaste", the orchestrator's transcript `130317af-a818-419c-a3de-3a21335db0a8.jsonl`, line
2037): the sub-agent that writes scoped code is launched on Haiku 5.5, set on the call, and the
ones that explore, review and verify stay on Opus 5.5 at high effort. What the harness turns on
by default in a project stays open, and so do the two measurements. The table it belongs to, the
mechanism that will apply it and the measurements still to run are in `docs/model-effort.md`.


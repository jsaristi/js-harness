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

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/subagent-model-routing.md` exits 0
- `node --test "evals/**/*.test.mjs"` exits 0
- `node evals/report.mjs --require-complete --min-discriminating 3` exits 0, so F5's gate still
  holds with the new runs recorded
- `node evals/subagents-report.mjs --require-complete` exits 0, so the matrix of this feature is
  complete and every counted trial delegated
- `docs/ROADMAP.md` records the result per delegation mode and task (both arms' score, list
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
- The base is the `minimal` arm at effort `medium`, with a delegation mode appended to the
  prompt, identical in both arms — because it isolates the one variable, costs about half of the
  `current` arm, and the tasks do not delegate by themselves.
- Results live in `evals/results/subagents/` with a report of their own — because
  `evals/report.mjs` reads every `*.json` in `evals/results/` and rejects any config other than
  `minimal` and `current`.
- Spend is staged (Sebastián, 2026-10-08): 1 probe call (spent), 2 smoke trials, the rest of the
  first repeat (18 trials in all), then his go-ahead for the other 36. No batch and no gate
  starts before its count is put to him — because another session uses this machine and the
  runs draw on the plan's weekly cap, which stood at 77% on 2026-10-08.
- Never two gates at once, and no gate or test suite while trials run — because parallel spawns
  on this host fail with `0xC0000142` (`odd/tasks/evals.md`, follow-ups). The other session works
  in `D:\js-harness-worktrees\codex-review-lean`.
- The stack is not updated during the feature: Claude Code 2.1.292, gentle-ai, engram and Codex
  stay as installed — because the two arms and F6 must run on one measured stack.
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
2 arms × 3 modes × 3 tasks × 3 repeats = 54 trials, sequential.

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
- [ ] T3 `evals/subagents-report.mjs`: the two arms side by side per mode and task, trials
  without delegation apart, `--require-complete` (route: delegated writer)
- [ ] T4 Smoke: 2 trials, one per arm, `house-rules` in `write` mode
- [ ] T5 The rest of the first repeat: 16 trials, 18 with the smoke
- [ ] T6 The other two repeats: 36 trials, after Sebastián's go-ahead
- [ ] T7 The result and the recommendation in `docs/ROADMAP.md`

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

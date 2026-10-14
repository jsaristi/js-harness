# Future-model protocol

What to do when a new model arrives. It tests the bet the harness is built on, "a stronger model
needs a smaller harness" (`AGENTS.md`, `docs/ROADMAP.md` principle 2): measure what the harness
costs on every turn, measure what it buys on the eval tasks, change one component at a time, and
keep only what still earns its place. It is read when it is needed, never on every turn.

Version 2, 2026-10-14, F7 (`odd/tasks/future-model-protocol.md`; what its reader changed is in
that document's Log). Each step names the command that does it today, or the gap where none
exists. A gap is a task of that feature, not a step an agent improvises: until the gaps of a
step are closed, that step does not run.

## When it runs

- A new Claude or Codex model is about to become one the harness designs, builds, verifies or
  reviews on (the rows "Effort" and "Review" of `docs/ROADMAP.md`, Decided), or a new version of
  Claude Code or the Codex CLI changes what is loaded on a turn (`docs/model-effort.md`, B1, says
  "a new engine version or a new model").
- Nothing notices it by itself today (gap G7): the session that sees a model or an engine it has
  not seen tells the lead, which opens one feature for the run (one session, one feature).
- Which model is adopted is his choice; so are the model of the evals and of the Codex review,
  which are fixed (`evals/suite.mjs`, `EVAL_MODEL` and `CODEX_EVAL_MODEL`; the rule `review-model`
  in `bin/lib/rules-data.mjs`), and the Decided row "Effort", which names models. This protocol
  hands him the evidence; it decides only which pieces of js-harness itself stay.

## The rule that governs every step

Spend is his. A step that spends (marked **spend** below) states, before it starts, the number
of trials, the windows of the usage cap it may take and what else waits on that cap while it
runs, the wall time, and the list cost; each figure with its source. On the subscription the
list cost is not billed ("Eval spend" in the roadmap), so the cap and the time come first. The
question goes to the lead, which asks him; nothing starts without his yes. One batch at a time,
smallest first: two smoke trials, then one arm, then the rest (the order F6 used,
`odd/tasks/codex-parity.md`). Steps without the mark spend nothing.

The setup is frozen for the whole run, from Step 4's first trial to the last trial of Step 6: no
update of Claude Code, Codex, gentle-ai, engram or codegraph, and no edit of the global
`CLAUDE.md`, the output style or the settings. The suite builds the `current` arm from the live
home once per invocation (`evals/home.mjs`), so arms run in one invocation share one setup; but a
run is resumed by a new invocation after a cap stops it, and the suite records only the versions
of Claude Code, gentle-ai, engram and its plugin, not codegraph's nor the js-harness commit the
workspace is initialized from, so any other change between invocations would go unseen (F6 held
the same rule, `odd/tasks/codex-parity.md`, Constraints; gap G6).

## Step 1. Preconditions (no spend)

- The model: `--model <id>` on `evals/suite.mjs` names it (G5); without the flag a run is on the
  default (`EVAL_MODEL`, `CODEX_EVAL_MODEL`). A Claude model is named by its full id, never an
  alias. A recorded run continues only on the model it was recorded on.
- Prices. The new model's row goes, from the official pricing page and with the date read, into
  `evals/prices.mjs` (the list table; `listCost` returns `null` for a model it does not list) and,
  for a Codex model, into `CODEX_LIST_PRICES` of `evals/report.mjs`. The Claude report's cost is
  Claude Code's own `costUsd` (`evals/report.mjs`, `buildCells`), which the CLI computes at a
  wrong rate for a model it does not know (`evals/prices.mjs`, its header). After the smoke trials,
  price each trial's recorded `modelUsage` at the list table and compare it with its `costUsd`
  before any verdict rests on cost. The A/B arms keep no `listCost` (only the subagent configs
  do, `evals/runner.mjs`), and pricing `modelUsage` alone gives a range, since the lifetime of a
  cache write is not in it (`evals/transcript-usage.mjs`): a `costUsd` outside that range is
  told to him before the run goes on.
- Logins: `JS_HARNESS_EVAL_OAUTH_TOKEN` set (`claude setup-token`); the Codex login with at least
  12 hours left (`evals/suite.mjs`, usage).
- Isolation on a new engine: `node evals/isolation-probe.mjs` (no spend) before any Claude trial;
  `evals/codex-isolation-probe.mjs` opens real Codex sessions, so it is **spend**. The permission
  modes the suite accepts were read from Claude Code 2.1.284 (`PERMISSION_MODES`): read them again
  from the new engine.

## Step 2. Record the baseline (no spend)

The outgoing model's last measurement is the baseline: the sections "F5 result" and "F6 result"
of the roadmap and the files they name under `evals/results/`. Nothing is re-run on the old model.
`node evals/report.mjs` refuses to pool runs whose model or stack differ (`checkRuns`), so the
comparison across models is made by hand, table beside table, and says so.

## Step 3. Measure the payload (no spend)

- From files, both hosts: the INFO rows `payload claude` and `payload codex` of `js-harness check`,
  built on `measurePayload({ home, cwd })` in `bin/lib/payload.mjs`. A commit of documents alone
  prints them with no sensor run and no lock. Characters over four, whatever the model's
  tokenizer; tools, MCP instructions, the skills list and the output of hooks are not counted.
  The figure that matters is that of the home the `current` arm runs in, not the live one (gap G1).
- The whole first request: the method of 2026-09-26 (roadmap, "Measured starting point"), one
  `claude --print` of a one-word prompt in an empty folder, which defers no tools, so its tool
  figure is an upper bound. It costs one request; no script for it is committed (gap G4).
- Report each figure beside the baseline's, with the source that grew.

## Step 4. Run the evals (**spend**)

The five tasks of F5, both arms, on the new model:

- Claude: `node evals/suite.mjs --claude <absolute path to claude> --configs minimal,current
  --efforts medium --repeats 3 --tasks all --permission-mode bypassPermissions --model <id> --name <model>-ab`
- Codex: `node evals/suite.mjs --agent codex --codex <absolute path to codex.exe> --configs
  minimal,current --efforts medium --repeats 3 --tasks all --model <id> --name <model>-ab`
- Report: `node evals/report.mjs --runs <model>-ab`, and for Codex with `--results-dir
  evals/results/codex`. It prints the verdict per task and effort by the rule of the roadmap's row
  "Eval verdict" (score is the floor, cost decides between equals).

`medium` first; `high` only if he asks. On Codex, `current` sessions ended on questions of
gentle-ai that nobody answers (roadmap, "F6 result"): its results measure that as much as the
components, and the report says so.

If no task discriminates on score (`node evals/report.mjs --runs <model>-ab --min-discriminating
1` exits non-zero), as in F5, where all ten cells sat at the ceiling, Step 5 can decide on cost
alone. It runs then only if he accepts that, told plainly; otherwise harder tasks come first (F5
began with 0 of 32 that discriminated).

## Step 5. Change one component at a time (**spend**)

An arm differs from its base by exactly one component; model, effort, tasks and repeats are the
same, and the base and its arms run in one invocation of the suite, under the frozen setup. Two
directions, chosen from Step 4:

- When `minimal` ties `current` on score (F5), each arm is `minimal` plus one component. It asks
  "does X earn its place" directly, and its trials cost about half.
- Otherwise each arm is `current` minus one component, compared with `current`. It misses two
  components that cover for each other (engram's plugin and the memory text of the global
  `CLAUDE.md`, say): a pair suspected of that is also run removed together.

The components are what the arms seed, read from the code and not from memory: for Claude,
`CLAUDE_ITEMS` and the plugin state of `evals/home.mjs` (settings with its hooks, the global
`CLAUDE.md`, skills, agents, commands, output styles, hooks, every plugin in the cache, the MCP
servers of `.claude.json`) and `js-harness init` in the workspace (the project's `AGENTS.md`,
codegraph); for Codex, `CODEX_ITEMS` of `evals/codex-home.mjs`. The global `CLAUDE.md` is several
components, not one: gentle-ai's managed block and his own sections. `current` is his machine, not
what js-harness ships: an arm names which kind each component is.

| Kind | Examples | Whose to drop |
|---|---|---|
| js-harness's | its skills, its hooks, the project's `AGENTS.md` | js-harness, by a commit here |
| The stack's | gentle-ai's block, engram's plugin, codegraph's hook and MCP server, context7 | that tool's (#4036 for gentle-ai's block) |
| His machine's | his sections of `CLAUDE.md`, the output style, other plugins | his |

Their order is by measured size, largest first, once G1 and G4 measure each one; until then the
order is his to choose, told the sizes that are known. Today the suite takes only the arms
`minimal` and `current` (`evals/suite.mjs`, `CONFIGS`), so this step waits for gap G2.

## Step 6. Decide, per component (no spend, then one confirming arm)

The thresholds are fixed and told to him before Step 5 spends, as T10 of the rule hierarchy does
for its eval. A component is judged over the five tasks of its arm, at one effort:

- It earns its place when, on any task, the report gives the arm with it the higher score.
- It is a candidate to go when no task gives it the higher score and the arm without it costs
  less in total, over the five tasks, by more than the threshold fixed above (proposed: 10 percent
  of the total, and beyond the pooled cost SD the report prints).
- Otherwise it is not separated: recorded as such, and kept. If most components end here, three
  repeats were too few; more repeats are a new batch, with its cost.

A candidate is kept only if it names evidence the tasks cannot see, which is narrow on purpose
so that it does not keep everything: an entry of `docs/FAILURES.md` whose control is that
component, or a capability whose proof command needs it (in `docs/SPEC.md` once it exists). A
general "it helps across sessions" is not evidence. With neither, it goes.

A piece of js-harness that goes is removed by a commit here. A piece of the stack or of his
machine is not js-harness's to change ("Stack visibility" in the roadmap): the result goes to him
with that tool's own command. The clear candidates are dropped together, and the new `current`
runs once against the old (**spend**, one arm). If it loses, the dropped pieces come back one at a
time until it does not.

## Step 7. Record (no spend)

- A section "<model> result" in the roadmap, through the roadmap's owner: the payload, the
  report's tables, the arms, the decisions and what was spent, in trials, cap windows and list
  cost.
- The rules and the Decided rows that name the old model, checked again by hand on the new one
  (`docs/model-effort.md`, B1, designs a stale mark for them that is not built yet).
- Each piece that went, in the "tried and discarded" of its capability in `docs/SPEC.md`, or in
  the roadmap's result until `docs/SPEC.md` exists, so a later model does not pay for the same
  lesson twice.

## Later: the rebuild test

The stronger test of the bet, from the roadmap's reading of the specification: a model of a later
generation rebuilds the harness from `docs/SPEC.md` alone, proven by that document's commands and
the eval tasks. It waits for `docs/SPEC.md` (rule hierarchy, T1); its design and its cost are not
written yet, and running it is his.

## What a run costs

The figures of the last runs, as a scale and not a bound: a new model has its own prices and
speed, and removing a component can make a session cheaper or dearer (Step 1's prices recompute
them). Claude: F5 on Opus 5.5, at `medium` its 30 trials cost $9.75 for `minimal` and $20.28 for
`current` and took about 36 and 56 minutes (roadmap, "F5 result"). Codex: F6 on `gpt-6.1-sol`,
$0.12 to $0.29 a trial; the first five-hour window of the plan's cap held about 18 trials and each
later one about five of `current` (`odd/tasks/codex-parity.md`, T7), and Codex reviews draw on the
same cap, so a Codex batch holds back the pre-push reviews of every session while it runs.

| Batch | Trials | Cap, time | List cost |
|---|---|---|---|
| Smoke, one task, both arms, Claude | 2 | about 4 to 12 minutes | about $1.40 to $3.90 |
| Step 4, Claude, `medium` | 30 | about 1 h 30 | about $30 |
| One arm `current` minus X, Claude, `medium` | 15 | about 55 minutes | about $20 |
| One arm `minimal` plus X, Claude, `medium` | 15 | about 35 to 55 minutes | about $10 to $20 |
| Step 4, Codex, `medium` | 30 | 3 to 4 five-hour windows | $4 to $9 |

## Gaps

Each one is a task of `odd/tasks/future-model-protocol.md`.

- G1. The payload of the eval home: the payload rows computed over the home an arm runs in, per
  component, without a commit.
- G2. Arms of one component: `minimal` plus one and `current` minus one, run in one invocation
  with their base and accepted by the report.
- G3. A cost statement before a run: the suite prints the trials, the agent time and the list
  cost from the last results on the same model, "unknown" for a cell with none, and starts
  nothing (the precedent is `js-harness codex-review --plan`). The cap windows stay unknown: no
  results file records where a cap stopped a run, and the agent time leaves out each trial's
  setup. Until then the table above is the estimate, by hand.
- G4. The whole first request (tools, MCP, skills list) measured by a committed script.
- G5. The eval model chosen for a run and recorded with it, in place of the constants. Built:
  `--model`.
- G6. The setup recorded with a run: a fingerprint of the home template beside the versions,
  leaving out the counters and timestamps a day of sessions changes, so a run resumed on another
  setup, or two runs pooled across setups, are refused, not unseen.
- G7. A new model noticed: a row that compares the model of the session with the eval model and
  the review model, and says when they differ.

# Future-model protocol

What to do when a new model arrives. It tests the bet the harness is built on, "a stronger model
needs a smaller harness" (`AGENTS.md`, `docs/ROADMAP.md` principle 2): measure what the harness
costs on every turn, measure what it buys on the eval tasks, take one component away at a time,
and keep only what still earns its place. It is read when it is needed, never on every turn.

Version 1, 2026-10-14, F7 (`odd/tasks/future-model-protocol.md`). Each step names the command
that does it today, or the gap where none exists; a gap is a task of that feature, not a step
an agent improvises.

## When it runs

- A new Claude or Codex model is about to become one the harness designs, builds, verifies or
  reviews on (the rows "Effort" and "Review" of `docs/ROADMAP.md`, Decided). A point release of
  the same model does not start it; a new major version of Claude Code or the Codex CLI does,
  because the payload and the hooks are the engine's.
- The session that sees the new model tells the lead, which opens one feature for the run (one
  session, one feature). The rules rows checked on the old model are stale from that moment
  (`docs/model-effort.md`, B1).
- Which model is adopted is his choice. This protocol hands him the evidence; it decides only
  which pieces of js-harness itself stay.

## The rule that governs every step

Spend is his. A step that spends (marked **spend** below) states, before it starts, the number
of trials, the list cost at the prices of `evals/prices.mjs`, the wall time and the usage-cap
windows it may take, and where each figure comes from; the question goes to the lead, which asks
him; nothing starts without his yes. One batch at a time, smallest first: two smoke trials, then
one arm, then the rest (the order F6 used, `odd/tasks/codex-parity.md`). Steps without the mark
spend nothing beyond one prompt.

## Step 1. Price the new model (no spend)

`evals/prices.mjs` prices only the models it lists, and a model it does not list has no cost
(`listCost` returns `null`), never the price of a model that looks like it. Add the new model's
row from the official pricing page, with the date read, before any run. Without it no cost in
this protocol can be computed.

## Step 2. Record the baseline (no spend)

The outgoing model's last measurement is the baseline: the sections "F5 result" and "F6 result"
of the roadmap and the files they name under `evals/results/`. Nothing is re-run on the old model;
if its results are older than the stack (another gentle-ai, engram or Claude Code major), say so
beside every comparison, because `node evals/report.mjs` refuses to pool runs whose model or stack
differ (`evals/report.mjs`, `checkRuns`).

## Step 3. Measure the payload (no spend, one prompt)

- From files, both hosts: the INFO rows `payload claude` and `payload codex` of `js-harness
  check`, built on `measurePayload({ home, cwd })` in `bin/lib/payload.mjs`. Characters over four;
  tools, MCP instructions, the skills list and the output of hooks are not counted, only the hook
  commands are listed. Until gap G1 is closed the rows come only with a whole check.
- The whole first request: the method of 2026-09-26 (roadmap, "Measured starting point"), one
  `claude --print` of a one-word prompt in an empty folder, which defers no tools, so its tool
  figure is an upper bound. No script for it is committed (gap G4).
- Report each figure beside the baseline's, with the source that grew. A larger payload on a
  stronger model is the first sign that a piece no longer earns its place.

## Step 4. Run the evals (**spend**)

The five tasks of F5, both arms, on the new model:

- Claude: `node evals/suite.mjs --claude <absolute path to claude> --configs minimal,current
  --efforts medium --repeats 3 --tasks all --permission-mode bypassPermissions --name <model>-ab`
- Codex: the same with `--agent codex --codex <absolute path to codex>` and no
  `--permission-mode`.
- Report: `node evals/report.mjs --runs <model>-ab`, which prints the verdict per task and effort
  by the rule of the roadmap's row "Eval verdict" (score is the floor, cost decides between
  equals).

`medium` first; `high` only if he asks, or if `medium` leaves a task without a verdict. If every
cell sits at the score ceiling on both arms, as all ten did in F5, the tasks no longer separate
configs on score and cost alone decides; say so, because it means harder tasks are owed before
the next model (F5 began with 0 of 32 tasks that discriminated).

## Step 5. Strip one component at a time (**spend**)

A strip arm is the `current` arm with exactly one component removed and nothing else changed:
same model, effort, tasks and trials. It is compared with `current`, never with `minimal`.

The components are what the `current` arm seeds (`evals/home.mjs`, `CLAUDE_ITEMS` and the plugin
state; `js-harness init` in the workspace), taken in this order, largest payload first:

| Component | Where it lives | Whose to drop |
|---|---|---|
| gentle-ai's managed block | global `CLAUDE.md` / Codex `AGENTS.md` | gentle-ai's (#4036 for an exclusion) |
| Output style | `~/.claude/output-styles` | the machine's |
| codegraph prompt hook | settings hooks | codegraph's |
| engram plugin (hooks, skill) | plugins | engram's |
| js-harness skills | `~/.claude/skills`, Codex skills | js-harness |
| js-harness hooks (doctor, resume, pause) | settings hooks | js-harness |
| The project's `AGENTS.md` | `init` in the workspace | js-harness |

Today the suite accepts only the arms `minimal` and `current` (`evals/suite.mjs`, `CONFIGS`), so
this step cannot run until gap G2 is closed.

## Step 6. Decide, per component (no spend)

By the verdict rule, `current` against `current` without X:

- Without X scores lower: X earns its place, it stays.
- Equal score and without X cheaper: X costs without adding score, it is a candidate to go.
- No verdict: it stays, recorded as not separated.

A candidate goes only if nothing else holds it. The tasks measure one session doing one code
task; what a piece buys across sessions, in review, in the gate or in long work, they do not
measure (the reading of F5). So a candidate stays when it names its evidence elsewhere: an
incident in `docs/FAILURES.md` it prevents, or a capability of `docs/SPEC.md` whose proof needs
it. With neither, it goes.

A piece of js-harness that goes is removed by a commit of this repository. A piece of the stack is
not js-harness's to change ("Stack visibility" in the roadmap): the result goes to him with that
tool's own command. Components are decided from the same baseline, the clear ones dropped
together, and the new `current` run once against the old (**spend**, one arm) to see that they
did not hold each other up.

## Step 7. Record (no spend)

- A section "<model> result" in the roadmap, through the roadmap's owner: the payload, the
  table of the report, the strips, the decisions and what was spent.
- The stale rules rows checked again on the new model (`docs/model-effort.md`, B1).
- Each piece that went, in the "tried and discarded" of its capability in `docs/SPEC.md`, so a
  later model does not pay for the same lesson twice.

## Later: the rebuild test

The stronger test of the bet, from the roadmap's reading of the specification: a model of a later
generation rebuilds the harness from `docs/SPEC.md` alone, proven by that document's commands and
the eval tasks. It waits for `docs/SPEC.md` (rule hierarchy, T1); its design and its cost are not
written yet, and running it is his.

## What a run costs

The figures of the last run, Opus 5.5 at list price (roadmap, "F5 result"; `odd/tasks/codex-parity.md`).
A new model has its own prices and speed: recompute from Step 1's row; these only give the scale.

| Batch | Trials | List cost | Wall time |
|---|---|---|---|
| Smoke, one task, both arms | 2 | about $2.30 | about 7 minutes |
| Step 4, Claude, `medium` | 30 | about $35 | about 1 h 50 |
| Step 4, Claude, `medium` and `high` | 60 | $69.78 (F5) | about 3 h 40 (F5) |
| One strip arm, Claude, `medium` | 15 | about $24 or less | about 55 minutes |
| All seven strip arms, Claude, `medium` | 105 | about $165 or less | about 6 h 30 |
| Step 4, Codex, `medium` | 30 | $4 to $9 | usage-cap windows, not minutes |

Per trial, F5's means: `minimal` $0.76 and `current` $1.57, about 3 minutes 40 seconds; a strip
arm is taken at the `current` figure, an upper bound. Codex trials cost $0.12 to $0.29, but the
plan's usage cap stopped F6 within a few trials (`odd/tasks/codex-parity.md`), so its limit is
windows of the cap and the login (at least 12 hours left), not money. On the subscription the
list cost is not billed; the limits are tokens, wall time and the usage cap (roadmap, "Eval
spend").

## Gaps

Each one is a task of `odd/tasks/future-model-protocol.md`.

- G1. The payload alone: a command that prints the payload rows without running a whole check.
- G2. Strip arms: a `current` arm minus one named component, accepted by the suite and the report.
- G3. A cost statement before a run: the suite prints the trials, the list cost from the last
  results at `evals/prices.mjs` and the wall time, and starts nothing (the precedent is
  `js-harness codex-review --plan`). Until then the table above is the estimate, by hand.
- G4. The whole first request (tools, MCP, skills list) measured by a committed script.

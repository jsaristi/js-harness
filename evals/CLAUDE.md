# evals: the measured runs

The host loads this file once a session reads or writes a file under `evals/`. It holds only what is bound to this
place; each rule it rests on is named by its id, and `js-harness rules <id>` prints the rule from its one home.

- A batch spends tokens on his plan: say how many runs and what each costs before it starts, as `CLAUDE.md`,
  "Running what costs", says. Spend outside the plan is his to decide: `rule:owner-decisions`.
- `node evals/suite.mjs ... --plan` prints what a batch would run and runs nothing.
- The tests beside each module run against a fake API (`evals/runner.mjs`), so `node --test` spends nothing.
- A results document under `evals/results/` is written once and never rewritten: a report reads what was recorded.
- Search the suites and runners here before adding one: `rule:reuse-first`.

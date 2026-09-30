# Task contract

Locator: `odd/tasks/task-contract.md` · Engram mirror: `odd/task-contract/tasks` · Branch:
`feat/task-contract`

## Goal
A feature document opens with a task contract that a command validates, and `/goal` can drive the
feature to its end by running the contract's done-when commands.

## Why
`/goal` keeps a session working until a small model, reading only the transcript, judges a
condition met (https://code.claude.com/docs/en/goal, "How evaluation works"). A condition written
in prose is judged by opinion; a condition that is "these commands exit 0", with their output in
the transcript, is judged by evidence. The contract template in `docs/origin.md` ("Task contract
template") makes that condition part of every feature, and a validator keeps a contract without
an executable done-when from ever reaching the loop.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/task-contract.md` exits 0
- `node bin/js-harness.mjs progress` shows the three F3 roadmap steps checked
- A contract whose `## Done when` has no command is rejected by `contract check`, with the reason

## In scope / Out of scope
- In: `bin/lib/contract.mjs` (template, parser, validator), a `js-harness contract` command, a
  `contracts` row in `check`, the roadmap and `AGENTS.md` lines that point to it, tests for each.
- Out: retrofitting closed feature docs (they are history, and none opens with `## Goal`); a loop
  of our own (the loop is `/goal`); Codex's equivalent of `/goal` (F6 measures parity).

## Constraints
- Zero dependencies and fixture-based tests — because every command must run on any machine with
  no install step (AGENTS.md, "How the repo works").
- `check` validates contracts statically and never runs their commands — because a done-when
  command may be `npm run check` itself, and the pre-commit gate must stay fast and non-recursive.
- The contract is the head of the gentle-ai ODD feature document, not a second file — because
  each fact lives in one place (`docs/ROADMAP.md`, top) and the ODD document is the handoff.

## Effort
high

## Ask me before
Changing the template's sections, or making `check` fail on feature docs that are not contracts.

## TDD
Mode: strict (source: user global config). Runner: `node --test`.

## Delivery
Forecast: ~600–800 authored lines (a parser/validator, a command with four subcommands, a `check`
row, tests, docs), above the ~400 slice budget. Strategy: `ask-on-risk`; chain strategy
`stacked-to-main`, reusing Sebastián's choice for `odd/tasks/project-init.md` (2026-09-28): each
slice is its own PR against `main`, merged in order. He can switch before the first PR opens.
Slices: 1 = T1–T2 on `feat/task-contract`.

## Design
- A contract is a feature document with a `## Goal` heading. Its sections are the template's:
  `Goal`, `Why`, `Done when`, `In scope / Out of scope`, `Constraints`, `Effort`, `Ask me before`.
  Other sections (TDD, Delivery, Tasks, Progress) follow it unchanged, so `progress` keeps
  counting the same checkboxes.
- `contract check [file...]` rejects, naming each reason: a missing or empty section; a
  `Done when` with no command, where a command is a list item that opens with an inline code span
  and says `exits 0`; a command still holding a template placeholder (`<...>`); an `Effort` other
  than `medium` or `high`. With no file it checks every `odd/tasks/*.md` that has `## Goal`.
- `contract template` prints the template, so a project without `docs/origin.md` has it.
- `contract run <file>` runs each done-when command from the repository root, prints one
  PASS/FAIL row per command and a final `met` or `not met`, and exits 0 only when all pass. It is
  what a `/goal` turn runs; human-checkable items are listed, not judged.
- `contract goal <file>` prints the `/goal` condition: `contract run <file>` exits 0, plus the
  human-checkable items, within the documented 4,000-character limit.
- `check` gains a `contracts` row: every contract under `odd/tasks/` passes `contract check`; with
  none, the row passes and says so.

## Tasks
- [ ] T1 `bin/lib/contract.mjs`: template, parser and validator, with tests — route: delegated
  writer (writer trigger: a new lib and its test file)
- [ ] T2 `js-harness contract template|check`, the dispatcher entry and the `check` row — route:
  delegated writer
- [ ] T3 `contract run` and `contract goal` — route: delegated writer
- [ ] T4 Roadmap Decided row and checklist, `AGENTS.md` pointer within budget, this document
  passes its own contract — route: inline (docs)

## Progress
- 2026-09-29: contract written; design above.

## Next step
T1.

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
  and says `exits 0`; a command that is wholly a template placeholder (`<...>`), or empty; HTML comments are not
  content; an `Effort` other
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
- [x] T1 `bin/lib/contract.mjs`: template, parser and validator, with tests — route: delegated
  writer (writer trigger: a new lib and its test file)
- [x] T2 `js-harness contract template|check`, the dispatcher entry and the `check` row — route:
  delegated writer
- [x] T2a Review follow-ups of slice 1: HTML comments are dropped before sections and list items
  are parsed (Codex P2); a placeholder is a code span that is wholly one `<...>`, so `<ok>` inside
  a real command or a shell redirect passes (Codex P2); a code span empty after trimming is not a
  command (Codex P2); discovery honours an injected `stat` (R3-stat-bypasses-injected-fs) and its
  error paths are tested (R3-discover-error-paths-untested); an unreadable `odd/tasks/*.md` still
  fails the row, on purpose, with a test (R3-unreadable-noncontract-fails-gate); the repository-root
  test skips without git (R3-git-dependent-test) — route: the same delegated writer
- [x] T3 `contract run` and `contract goal` — route: delegated writer
- [x] T3a Review follow-ups of slice 2: comment markers inside inline code spans are content, and an
  unmatched `<!--` in a span hides nothing (Codex P2); a fence opener with `<!--` after its marker
  leaves no comment open after the fence closes (R3-comment-after-fence-opener); `goal` emits the
  absolute contract path, so the command works from any directory (Codex P2, R3-goal-ignores-cwd),
  double-quoted, rejecting a path with a double quote (Codex P2), and runs the `js-harness.mjs` that
  is running instead of assuming `js-harness` on PATH (doubt 6); each done-when command has a
  timeout, 30 minutes by default, `--timeout <minutes>` to change it (R3-run-no-timeout) — route: the
  same delegated writer
- [x] T4 Roadmap Decided row and checklist, `AGENTS.md` pointer within budget, this document
  passes its own contract — route: inline (docs)
- [x] T4a Review follow-ups of slice 3: `goal` also emits `--cwd "<project root>"` (the git
  top-level of the contract), because `run` takes its root from `--cwd` and a replay from another
  directory would run the checks in the wrong project (Codex P2); the timeout is handed to spawn as
  whole milliseconds, and one that is not a plain decimal or rounds below 1 ms is a usage error
  (Codex P2, R3-fractional-timeout-crash); `%`, `!`, a newline and a trailing backslash are refused
  in an emitted path too, with the doc comment stating exactly what and why
  (R3-quote-shell-residuals); the grandchild-pipes limit is recorded, not coded
  (R3-timeout-grandchild-pipes) — route: the same delegated writer
- [x] T4b Review follow-up of T4a: outside a git repository `goal` pins the requested `--cwd`, as a
  direct `run` does, not the folder the contract sits in (Codex P2) — route: inline (one function
  and its test)

## Progress
- 2026-09-29: contract written; design above.
- 2026-09-29: T1 landed: `bin/lib/contract.mjs` (template, parser, `validateContract`, `doneWhen`) on
  the fence-aware tokenizer now exported from `bin/lib/progress.mjs`, with tests.
- 2026-09-29: T2 landed: `js-harness contract template|check`, its dispatcher entry and the static
  `contracts` row in `check` (non-push path), with tests.
- 2026-09-29: slice 1 (21e5e24..06e2743, 827 changed lines) reviewed. gentle-ai: medium risk, one
  lens (reliability), approved and acknowledged (lineage `review-50c11c1316271493`, authority
  burned), four non-blocking findings. Codex (`codex-review --base 21e5e24`): recorded, three P2.
  All seven carried as T2a. An unreadable file stays a failure: it is not known to be a
  non-contract, and a gate must not hide a file it cannot read.
- 2026-09-29: T2a landed: comments are stripped before parsing (fence-aware), a placeholder is a
  wholly-`<...>` span, an empty span is no command, discovery honours an injected `stat` with its
  error paths tested, and the git-root test skips without git.
- 2026-09-29: T3 landed: `contract run <file>` (every done-when command from the repository root,
  PASS/FAIL rows, hand checks listed, `met`/`not met`, recursion guard) and `contract goal <file>`
  (one-paragraph `/goal` condition within the 4,000-character limit), with tests.
- 2026-09-29: slice 2 (06e2743..cc6607c) reviewed. gentle-ai: reliability lens approved and
  acknowledged (lineage `review-2c0b37a9ebc9e5b8`, authority burned), 3 non-blocking findings.
  Codex: recorded, 3 P2. All carried as T3a.
- 2026-09-29: T3a landed: comment markers in code spans and after a fence opener are content,
  `contract goal` emits `node "<running js-harness.mjs>" contract run "<absolute contract path>"`
  (refusing a path with a double quote, backtick or dollar sign), and `contract run` times each
  command out after 30 minutes, or `--timeout <minutes>`.
- 2026-09-29: `contract run --timeout 0.1` on a real 60-second command returned after ~6 s with
  `FAIL ... (timed out after 0.1 min)`, exit 1, on Windows: the writer's doubt that the shell kill
  might hang on pipes did not reproduce. Slice 3 (cc6607c..6af6769, 262 lines) assessed medium,
  `under_budget`, so it stays pending until the close.
- 2026-09-29: T4 landed: roadmap Decided rows (Commands, Task contract), F3 checklist and state,
  `AGENTS.md` pointer. This contract's own `contract run` printed `met` (both commands PASS), and
  its two hand checks hold: `progress` shows F3 3/3, and a contract with only prose under
  `## Done when` fails `contract check`, naming that `## Done when` has no command.
- 2026-09-29: slice 3 (cc6607c..03f6dfe, which includes the T4 docs commit 03f6dfe) reviewed.
  gentle-ai: reliability lens approved and acknowledged (lineage `review-bcd0f08c7f603c49`,
  authority burned), 3 non-blocking findings. Codex: recorded, 2 P2. All carried as T4a.
- 2026-09-29: R3-timeout-grandchild-pipes: a timed-out command's grandchild can keep the pipes open
  and delay `spawnSync`'s return. Verified on Windows only (the 6 s return in the entry above);
  left as a known POSIX limit, with no code change.
- 2026-09-29: T4a landed: `contract goal` emits `--cwd "<git top-level of the contract>"`, the
  `run` timeout is whole milliseconds and a plain decimal of at least 1 ms, and an emitted path
  holding `"`, a backtick, `$`, `%`, `!`, a newline or a trailing `\` is refused.

## Next step
Open the PR against `main` and merge on Sebastián's go-ahead; F3 then closes in the roadmap.

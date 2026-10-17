# Installed harness

Unit 2 of odd/tasks/ready-checks.md (branch `feat/ready-checks`), on its own branch `docs/installed-harness`, so the two pull requests never touch one file. That document holds the specs and the log.

## Goal
Every session runs the installed `js-harness`, and its branch's copy only to test its own change.

## Why
Six of nine running waits used `node bin/js-harness.mjs` from their own worktree, so 349-352 and 357 sent no ready notice: their branch's notify had no `--pr`.

## Done when
- `node --test bin/lib/protocols-skill.test.mjs` exits 0

## In scope / Out of scope
- In: `bin/lib/protocols-skill.mjs`, its test, this document.
- Out: the commands themselves: the line is guidance, and no command can tell a test run of a branch's copy from a mistaken one.

## Constraints
- One line — because the lead asked for one.

## Ask me before
Nothing: the lead assigned the unit.

## Tasks
- [x] T2 (kind: build) S2 of ready-checks.md, inline: one line in section 3 of the protocols skill.

## Log
- L1 (T2, commit f8aba7f2): RED was the new protocols-skill test, at 9 of 10; GREEN was 10 of 10. The gate passed on GitHub's machines. gentle-ai assessed f8aba7f2 against origin/main 246851e4 as medium risk, review not due (under_budget, 6 lines).

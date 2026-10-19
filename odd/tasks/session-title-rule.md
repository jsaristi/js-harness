# The rule session-title

Locator: `odd/tasks/session-title-rule.md` · Branch: `rule/session-title` · Feature: `odd/tasks/session-title.md`
(PR 469, stacked on this one). Delivery: one commit, one pull request. Test runner: `node --test`.

## Goal
The repository rule `session-title` is declared, so the guard of PR 469 holds the shape of a started session's title.

## Why
The merge door takes a change to `bin/lib/rules-data.mjs` only from a `rule/` branch, made by `js-harness rules
change`, so the declaration lands in its own pull request before the guard that reads it.

## Done when
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0

## In scope / Out of scope
- In: `bin/lib/rules-data.mjs`, `docs/RULES.md`, `docs/rule-sources.json`, this document.
- Out: the guard and its docs, which are PR 469's.

## Constraints
- The declaration is written by `js-harness rules change session-title` only — because a rule changes by that
  command, which checks its source against the transcript.

## Ask me before
Whether the rule is his as worded: question 24.

## Tasks
- [x] T1 (kind: build): declare the rule. Route: inline.

## Log
- L1 (2026-10-19): the orchestrator's request, verbatim: "Declare session-title with `js-harness rules change`, on a
  rule/ branch, in its own PR. If the rule's owner is sebastian, record the question for me with --kind question."
- L2 (2026-10-19): declared as 73f78044 (gate passed on CI; gentle-ai 73f78044 medium, not due, under_budget, 33
  lines; Codex correct, 0.92, no findings). Owner sebastian, his words checked by the command; question 24 recorded.
- L3 (2026-10-19): his answer to question 24 (transcript 908805db, line 6036), verbatim: "Osea en este caso se llama
  JH de JS Harnes pero la idea es que tenga el udentificador del proyecto". The orchestrator asked to reword the rule
  to match: `<code>` is the project's own identifier, declared in harness.json "code". Reworded by `rules change
  session-title`, quoting both his phrases (checked by the command), after merging origin/main into this branch.

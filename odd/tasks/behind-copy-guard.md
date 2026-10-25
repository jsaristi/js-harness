# Behind copy guard: the installed copy keeps holding this repository's rules

Locator: `odd/tasks/behind-copy-guard.md` · Engram mirror: `odd/behind-copy-guard/tasks` · Branch: `fix/guard-behind-copy`

## Goal
`js-harness guard --hook`, run by an installed copy whose rules list differs from the project's
`bin/lib/rules-data.mjs`, still refuses a call that breaks a rule of this repository the project
declares, instead of passing it without a word.

## Why
Since 2026-10-23 three sessions opened without a `JH <n> ·` title ("Audit · ledger, inventory and
checks", "Codex hook trust: doctor, uninstall, README", "Start sessions without his typed
message"), although the rule `session-title` and its check exist. The hooks run the installed copy
(pnpm global js-harness 0.97.0); `ruleHere` gave `{ off: 'behind' }` whenever that copy's list was
not byte for byte the project's, and every guard reader then returned null. So each landed rule
change (PR 586 changed `sessions-open-in-sidebar`) turned off every repository rule the guard holds
until the copy was updated, and `doctor` did not say so either: its hash of the copy's rules leaves
the scoped rules out (odd/tasks/rule-hierarchy.md, "Scope"). The first time titles went free was
2026-10-19, which is why the title guard was built; this was the second time, by this gap.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/behind-copy-guard.md` exits 0
- `node --test bin/lib/rules.test.mjs bin/lib/guard.test.mjs bin/lib/session-title-guard.test.mjs bin/guard.test.mjs bin/guard-feedback.test.mjs` exits 0
- the guard of the base commit, given this repository's list with one other rule changed, passes a
  `start_session` titled "Codex hook trust"; the guard of this branch denies it (Log)

## In scope / Out of scope
- In: `ruleHere` in `bin/lib/rules.mjs` (an additive `held`/`same` on `behind`), the guard's readers
  (`bin/lib/guard.mjs`, `bin/lib/session-title-guard.mjs`, `bin/lib/memory-feedback-guard.mjs`), their
  tests, README's guard section, this document.
- Out: the other readers of `ruleHere` (`check`, `contract`, `host-update`, Codex allowance): they keep
  saying "behind" as before. Out: `doctor` comparing the scoped rules, and the land refreshing the copy
  by default (a follow-up each, below).

## Constraints
- A project that does not declare a rule turns nothing on — because what the harness turns on in a
  project by default is his (his answer of 2026-10-14, honesty-audit S5); so the copy holds a rule
  only where the project's own list declares it live, of scope `repository`.
- Zero dependencies — because every command runs with no install step.

## Effort
high

## Ask me before
Nothing beyond AGENTS.md: spend and anything irreversible.

## TDD
Mode: strict. Runner: `node --test`.

## Delivery
Forecast: ~250 authored lines. Under the ~400 budget: one PR against `main`. Strategy: `ask-on-risk`.

## Specs
- S1. Behind a project whose rules file is a list that declares the rule live, of scope
  `repository`, `ruleHere` gives `{ off: 'behind', held, same }`: `held` the running copy's value,
  `same` true when the project declares the rule with the keys the hash names as the copy does.
  A file that is no such list, or a list that does not declare the rule live with that scope, gives
  `{ off: 'behind' }` as before.
- S2. Every reader of the guard (sub-agent models, the opening tools, `session-effort`,
  `session-title`, `terminal-note`, `memory-feedback-home`) holds `held` as it holds a value in force:
  where `same` is true it refuses exactly as in the project; where it is false the refusal ends with
  a note that the copy declares the rule otherwise than the project's file and checked by its own,
  naming the update (`js-harness merge-queue --land --refresh-copy` after a land, or `pnpm add -g
  github:jsaristi/js-harness#<main's sha>`, then `js-harness install`). What passes in the project
  passes behind; the note is only ever in a refusal.
- S3. The choice between refusing and warning: refusing, by the copy's own rule. A warning beside a
  `start_session` that runs comes after the title is taken; a refusal of every call while the copy
  differs would stop every session after each land. Holding the copy's rule refuses only what the
  copy's check refuses, and says when the project's declaration differs.

## Tasks
- [x] T1 (kind: build) (S1-S3) `held`/`same` in `ruleHere`, `guardHeld`, the six readers, tests first,
  README. Route: inline. Commit: the first commit of the branch.

## Follow-ups
- `doctor`'s `js-harness` row hashes only the unscoped rules, so in this repository it says `ok` while
  the copy is behind in a scoped rule; comparing the scoped rules here would name the gap.
- A pull request merged on GitHub (PR 586) moves main without `merge-queue --land --refresh-copy`, so
  the copy stays behind until a land refreshes it.

## Log
- L1 (2026-10-25, the brief from the lead's session local_7977505d) "Make the js-harness guard stop
  silently dropping this repository's rules when the installed copy is behind the project's rules
  file." Done when: "a behind copy no longer passes a bad title without a word (decide between
  refusing with the reason and the update command, or warning; a check in `js-harness
  status`/`doctor` or the land that updates the install may also close the gap), with a RED test
  first, `npm run check` green, a PR open, its Codex review recorded and its gentle-ai line written."
- L2 (2026-10-25) RED first: the new tests of `ruleHere`, the guard readers, the title guard and the
  hook failed on the base (`{ off: 'behind' }` with no `held`; the free title passed). Three old tests
  that held "a copy whose list is not the project's turns the rule off" now hold "a list that does not
  declare the rule", since that was the gap. S3 decided by the session, not asked: the brief left the
  choice to it unless it was his, and refusing by the copy's own rule refuses nothing the project
  would pass when the declarations agree.

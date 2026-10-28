# Directive coverage: every directive tied to its proof (design)

Locator: `odd/tasks/directive-coverage.md` · Engram mirror: `odd/directive-coverage/tasks` · Branch: `docs/directive-coverage` (worktree `D:\js-harness\.claude\worktrees\gentle-ai-how-it-works`, cut from main `86491fa`)

## Goal
Section 14 of `docs/proposals/gentle-ai-reverse-engineering.md` designs how every directive js-harness ships, and every directive a project it builds ships, is tied to a check or to an eval case that runs a real model, and a ROADMAP line places that design as an F8 step.

## Why
His words (transcript `0f71b2c6`, line 6690, 2026-10-28T09:23Z, read with `js-harness sessions --quote`): "recuerda que este proyecto es el que construye los otros proyectos por eso debe quedar completamente preciso es la herramienta de herramientas." Section 13.1's main lesson (gentle-ai tests its text's consistency, never its obedience) has no F8 step yet; the lead searched the diet and ROADMAP and found none. The lead relays his approval (04:28): "Listo, añadámosla", as a planned F8 step, not an option. Eval spend beyond the plan's limits still goes to him with an estimate.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/directive-coverage.md` exits 0
- `npm run check` exits 0
- Section 14 holds (1) the inventory with counts, (2) the mechanism, (3) init and S12, (4) cost, (5) the F8 place and pass line; two blind readers (Claude, Codex) graded it and one fix batch followed
- A docs-only PR is open, a Spanish page published, and `js-harness notify --to orchestrator --kind ready --pr <n>` sent

## In scope / Out of scope
- In: `docs/proposals/gentle-ai-reverse-engineering.md` (section 14), `docs/ROADMAP.md` (one line in F8's step 4), this document.
- Out: any code (design only, by the lead's brief).

## Constraints
- Design only: build nothing — because the lead's brief says so.

## Ask me before
- Eval spend beyond the plan's limits (D2).

## Tasks
- [ ] T1 (kind: design) inventory, mechanism, init and S12, cost, F8 place: section 14 and the ROADMAP line
- [ ] T2 (kind: verify) two blind readers, one fix batch
- [ ] T3 (kind: docs) PR, Spanish page, ready notice

## Next step
Section 14 is drafted (14.1-14.5, committed). Next: the ROADMAP line in F8 step 4 (append after "rows 13 and 14 into S8": directive coverage, section 14, as S5c-a after S11 and before S13, S5c-b beside S5, with its pass line); then T2, the two blind readers on section 14 only; one fix batch; then T3.

## Log
- L1 (2026-10-28, the lead's message relaying his request, line 6690): write the directive-coverage proposal as section 14 with a ROADMAP line; double review; docs PR; Spanish page; ready.
- L2 inventory so far (checked on `86491fa`):
  - Rules (`bin/lib/rules-data.mjs`): 69 declared, 66 live, 3 retired. 46 live rules are values read by code (`docs/RULES.md` lists 46 "Read by"; `rules check` holds each reader). 20 are prose rules (13 in `bin/lib/manifest.mjs`, 6 in `bin/lib/protocols-skill.mjs`, 1 in `bin/lib/project.mjs`) held only by phrase presence; no non-skill code names any of the 20 ids (scratch script `prose-held.mjs`). One of them, `reply-five-states`, is held by the Stop hook `bin/lib/reply.mjs` without naming the id. Every rule's `Row:` is "reports", which is the restatement check, not the behaviour.
  - `docs/FAILURES.md`: 104 headings; controls 70 check, 8 protocol, 2 measured, 1 line, 1 owed; 39 lines say "owed".
  - Evals (`evals/tasks`): 19 tasks; 10 incident cases (`incident-01`..`10`, each `case.json` names its source directive or failure; the set is 10 cases × 2 = 20 trials, `evals/incident-score.mjs:20`), 5 directive tasks (`commit-no-attribution`, `doc-goal`, `false-premise-flag`, `honest-unknown`, `house-rules`), 4 capability tasks (`format-v2`, `lost-updates`, `resolver`, `spec-drift`). No case names a rule id; the link is prose in `case.json` `source`.
  - Prose files: `CLAUDE.md` 136 lines, 2,010 words; `AGENTS.md` 60 lines, 677 words; installed skills `js-harness-protocols` 115 lines, `js-harness-orchestrator` 152, `js-harness` 66. Projects already get `docs/rules.json` held by `rules check` (phrases, sensors, no deletion) (`js-harness rules --help`).

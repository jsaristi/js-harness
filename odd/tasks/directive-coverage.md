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
- [x] T1 (kind: design) inventory, mechanism, init and S12, cost, F8 place: section 14 and the ROADMAP line
- [x] T2 (kind: verify) two blind readers, one fix batch (Claude 6, Codex 5; fixed in one batch, L3)
- [x] T3 (kind: docs) PR, Spanish page, ready notice (PR 622; page https://claude.ai/artifact/T4b4vuNC2UhL9P389wRneX)

## Next step
Main merged in locally (`0cd696be`, after 620 and 621 landed; the ROADMAP conflict was resolved by re-applying this branch's edits to main's step 4 line). The push is held: the lead is refreshing the installed js-harness (05:02 note), and this session waits on `node bin/js-harness.mjs wait --notice-to 67` (the branch's copy, so the installed one is not in use) for its notice. Then push, and send ready with both recheck grades (Claude 7, Codex 7). Open for him: the eval spend over the envelope (about $95 to $130 [i]), asked when S5c-a starts.

## Log
- L1 (2026-10-28, the lead's message relaying his request, line 6690): write the directive-coverage proposal as section 14 with a ROADMAP line; double review; docs PR; Spanish page; ready.
- L2 inventory so far (checked on `86491fa`):
  - Rules (`bin/lib/rules-data.mjs`): 69 declared, 66 live, 3 retired. 46 live rules are values read by code (`docs/RULES.md` lists 46 "Read by"; `rules check` holds each reader). 20 are prose rules (13 in `bin/lib/manifest.mjs`, 6 in `bin/lib/protocols-skill.mjs`, 1 in `bin/lib/project.mjs`) held only by phrase presence; no non-skill code names any of the 20 ids (scratch script `prose-held.mjs`). One of them, `reply-five-states`, is held by the Stop hook `bin/lib/reply.mjs` without naming the id. Every rule's `Row:` is "reports", which is the restatement check, not the behaviour.
  - `docs/FAILURES.md`: 104 headings; controls 70 check, 8 protocol, 2 measured, 1 line, 1 owed; 39 lines say "owed".
  - Evals (`evals/tasks`): 19 tasks; 10 incident cases (`incident-01`..`10`, each `case.json` names its source directive or failure; the set is 10 cases × 2 = 20 trials, `evals/incident-score.mjs:20`), 5 directive tasks (`commit-no-attribution`, `doc-goal`, `false-premise-flag`, `honest-unknown`, `house-rules`), 4 capability tasks (`format-v2`, `lost-updates`, `resolver`, `spec-drift`). No case names a rule id; the link is prose in `case.json` `source`.
  - Prose files: `CLAUDE.md` 136 lines, 2,010 words; `AGENTS.md` 60 lines, 677 words; installed skills `js-harness-protocols` 115 lines, `js-harness-orchestrator` 152, `js-harness` 66. Projects already get `docs/rules.json` held by `rules check` (phrases, sensors, no deletion) (`js-harness rules --help`).
- L3 (2026-10-28, T2): blind Claude reader 6/10, blind Codex reader 5/10 (`codex exec -s read-only`). Checked before fixing: `docs/RULES.md:214,220,226,295` read `Read by: none`; `bin/lib/failures.mjs:12-29` holds the control levels and states; `evals/task-proof.mjs` proves each task; `bin/lib/manifest.mjs:301-314` ships the output style and two ported skills; `bin/lib/project-rules.mjs:1-4` says the harness never writes a project's list; diet section 10 puts S13 and S12 before S5. Fixed in one batch: value rules counted as read, not held (at most 42, 4 unread); prose holders mapped by behaviour, composite rules split into obligations; uncounted sources listed (ported skills, output style, hook messages, `FAILURES_TEMPLATE`); 134 sentences, not 135 instructions, and spans by hash, not lines; 38 phrases from 19 rules; 9 tasks name no source; the mechanism reuses the failure register's `Control`/`Proof` and `task-proof.mjs`, with a planted break and a without-the-rule arm as proof; a context span is hashed; a bootstrap seeds `owed` so S5c-a cannot block itself; projects: the harness never writes their list, harness-written text is bound to the release's bytes, S12 records a baseline date; cost adds the project runner, proving the new cases, S5c-a's rerun and S8, about $70 to $90 over the envelope, which goes to him; the pass line is commands; S5c placed in step 4's order list; 65 corrected to 66.
- L4 (2026-10-28, the lead's 04:49 note): limited recheck of `e783fbd7` by the same two readers, Claude 7/10 and Codex 7/10. Checked before fixing: `bin/lib/failures.mjs:55-57,127` (an `owed` control has no date), `evals/task-proof.mjs:1-4` (no model runs there), `evals/without.mjs:1-11` (whole components only), the diet's line 636 ($11.22 for the current arm's 20 trials) and lines 794 and 919 ("65 of 65"), the envelope at the diet's section 1, D2, lines 152-164. Fixed in one batch: the without-rule arm moves to a paid suite run recorded under `evals/proofs/`, with a free check in `tasks.test.mjs`; the register's grammar is extended (level `eval`, a date on `owed`) and says so; one price, $0.56 to $0.65 a trial, gives $95 to $130 over the envelope and a recurring certification of $70 to $80; a span keeps its id across a wording edit; a project's late `owed` is admitted only as a named move from a harness span; proofs resolved by release and hash; context listings reviewed through the slice's reviews, which a command cannot judge; the sentence count is a range, 120 to 135; S5 counts from the register on the day, not "65"; the pass line names `incident-score.mjs` and S13's probe test; holders `stop-wake.mjs`, `report.mjs`, `sessions.mjs` named.

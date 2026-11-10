# JH 160 · F8 S5: skills, memory and rules

## Goal
F8 S5, the part that stays in F8: the `MEMORY.md` budget, the rule pass (each rule and register control a check, prose
or retired), the record rule and the lens flag parity probe. The session was opened from the brief
`2026-11-09T03-56-27-719Z-f29e9dc5.md` and resumed after a restart from `2026-11-10T04-01-32-011Z-49cf3240.md`. Its
feature document is `odd/tasks/f8-s5-rules.md`.

## The user's words
- "Listo continuemos con todo lo siguiente", the lead's transcript `0f71b2c6`, 2026-11-08 about 17:40 local, quoted
  by the brief.
- Question 235: "B: prosa en la skill del orquestador (Recomendada)", tapped; transcript `ea85ec35`, line 1029,
  2026-11-10T03:59:47Z (`js-harness sessions --quote ea85ec35-82e1-4aa9-abe3-98bd153a50b0 1029`).

## Delivered
- PR 797, merged (`6ee974d`):
  - The guard refuses a write that leaves `MEMORY.md` over `rule:memory-index-bytes` and larger than before; the
    rule went from 4000 to 2000 bytes by `rules change` (`5cb20f46`).
  - The new rule `rule:documents-canonical` (`4f3ba974`).
- PR 798, merged: `evals/lens-hook-probe.mjs`. A planted user hook and `CLAUDE.md` reach a run without `--safe-mode`
  and do not reach a run under the lens's flags; the probe spends nothing (L6, L8).
- PR 799, merged: the rule pass.
  - 46 owed rule controls closed; 49 of 49 planted breaks red under `rules coverage --prove`.
  - `rules coverage` prints the classes, and `failures` prints its controls by class.
  - Two "control lost" entries of `docs/FAILURES.md` repaired.
  - `writeCoverage` writes every control on one line (the register went from 1168 lines to 683).
- PR 802, ready (`69564afd`, `8a2a9c13`, `01d588a3`): the last two rules classified as prose (question 235), and
  `rules coverage --strict` refuses an owed obligation. Classes: check 49, prose 25, retired 4, owed 0.

## Decisions
- The user: question 235, B (above).
- The lead: the skill-body budget, the skill lint and the protocols-load probe moved to
  `odd/tasks/workshop-product-split.md` (the brief).
- This session:
  - 0.5k read as 2000 bytes, at the diet's chars/4 (L2).
  - `documents-canonical` owned by the project, sourced from the feature document (L4).
  - Value rules held by planted breaks in their readers, prose rules by protocol (L11).
  - The `--strict` hold waited for question 235 so the gate stayed green (L11).
  - The register written one control a line, to stay under the module limit (L11).

## Failures and lessons
- `edit-during-review`, 13th sighting:
  - What happened: the feature document was edited while Codex reviewed `a2d55b1..2717f7c`; 278,727 input tokens
    were spent and nothing was recorded (L13, `docs/FAILURES.md`).
  - Fixed: the review was run again with nothing edited, and recorded.
  - Proposed to the lead, not built: a guard that refuses an edit of a tracked file while that worktree's Codex
    review runs.
- An Edit lost a trailing space in the orchestrator skill. The reliability lens found it, and `01d588a3` fixed it.
- `notify --kind ready` refuses a stacked PR, so PRs 798 and 799 were announced as notes.
- Codex P1 on the probe: another provider's environment (Bedrock, Vertex, Foundry) could have reached a real service.
  Fixed tests-first, and the recheck came back correct (L7, L8).

## Left
- Question 244 to the lead: the incident rerun, about $13, after PR 802 lands. It is the last line of S5's pass
  ("the incident set no worse"), and it is his spend.
- PR 802 to merge, which is the lead's after his yes.

## Cost
- Time: first notice 2026-11-09T03:56Z; last before this summary 2026-11-10T04:25Z (with a stop for the machine's
  restart). Context at the end: about 57%. The host compacted the session once, at 00:42 local on 2026-11-09.
- Codex reviews recorded:
  - PR 797: 111,092 and 74,565 input tokens.
  - PR 798: the probe and its recheck.
  - PR 799: 228,202 input tokens.
  - PR 802: 77,117 and 30,649 input tokens.
  - Lost to the edit: 278,727 input tokens.
- Claude lenses: two per slice, from about 6k to 49k input tokens each.
- Paid evals: none. The probe calls a loopback API.

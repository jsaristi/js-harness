# JH 70 · F8 docs: the detailed plan and full harness documentation

## Goal
Write F8's plan step by step in the roadmap and document the whole harness (the architecture map,
each capability's target after F8, the README checked against the commands, the guide), from the
lead's brief `~/.js-harness/background/briefs/2026-10-28T11-01-11-010Z-d4145781.md`.

## The user's words
Quoted in the brief and in `odd/tasks/f8-docs.md`, L1 (2026-10-28, sent to the orchestrator): "Listo
ahora que tienes toda las investigaciones, las mediciones, mapa, las comparativas y todo el plan,
quiero que ahora me hagas un plan detallado y de una vez la documentacion completa y detallada de
todo el arnes, listo? tiene que ser lo mas detallado y completo posible por que sobre ese vamos a
hacer todo"

## Delivered
- PR 626, `docs/f8-plan-and-docs`, ready, not merged: 89ccab6f (feature document), d366daae
  (roadmap `## F8 plan`), 84e80169 and bae1f72e (SPEC architecture, After F8, capability fixes),
  ef3397b0 (guide), 4978e351 (README against each `--help`), ed21ebdb (the double review's fixes),
  and the commit holding this file.
- The Spanish page: https://claude.ai/artifact/RJheCkzoPdSFHZpA4A52fm (private to him).
- Feature document `odd/tasks/f8-docs.md`, T1–T7 checked.

## Decisions
This session's, recorded in `odd/tasks/f8-docs.md`, `## Decisions`: the plan lives in the roadmap's
`## F8 plan` (no checkbox, outside Next and Decided); the target state lives in SPEC sections outside
`## Capabilities`, since the `spec` row allows six fields; no new document; one PR, not a chain
(about 930 lines of documentation, one commit per document, the fix commit spans all five files).

## Failures and lessons
- A state-table row was first written from a guess (`refresh-backups` written by `install`); the
  check before committing found `merge-queue --land --refresh-copy` writes it
  (`bin/lib/refresh-copy.mjs:287`). Every row added after the review was checked in code.
- The host compacted the session at 06:39 with the README uncommitted and the feature document older
  than the work; state was written first on resume and nothing was lost (`git log`).

## Left
- Outside this surface, found by the README pass: `upgrade --help` says npm by default while
  `bin/update.mjs:50` picks `--pm`, `JS_HARNESS_PM`, then the installing manager;
  `bin/lib/gentle-ai-update.mjs:2-3` says js-harness never writes the global CLAUDE.md, stale since
  S10. Held by the lead to route.
- The landing of PR 626: the lead's merge queue.

## Cost
11:01Z brief to about 12:20Z. Reviews: no gentle-ai, Codex review or lens review (docs only; the
Stop hook's gentle-ai candidate was `unrelated`, status read only). Double review: one Opus Explore
reader (148k sub-agent tokens) and one `codex exec -s read-only`, both on his plans. One README
sub-agent (227k tokens). Gate runs: one per commit (8), all PASS. No eval spend.

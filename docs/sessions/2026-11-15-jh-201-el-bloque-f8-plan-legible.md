# JH 201 · el bloque F8 plan legible

## Goal
Make the "F8 plan" block of the stretch departure and return pages readable: what the plan is, its steps by state,
and which steps moved (spec 7 of `odd/tasks/stretch-protocol.md`). Brief:
`C:\Users\Oficina\.js-harness\background\briefs\2026-11-15T00-10-03-399Z-c49dbe69.md`.

## The user's words
"El regreso del tramo donde dice F8 plan no lo entiendo bien tiene que organizarlo mejor para que lo pueda entender"
(transcript 69918425, line 9989). Spec 8, relayed by the lead: "Excelente se ve mucho mejor, osea una cosa es lo que
se va a hacer en este tramo y otra cuando te diga por ejemplo que vamos a hacer todo el dia y la idea es que me
muestre lo de las tareas del tramo como lo que se va a avanzar en el plan" (line 10936).

## Delivered
- PR 879 (feat/stretch-plan-block, head b9b01dbc), merged. Code commits 4222ff27, 0c35bded, a6906471, 9348f419,
  728daf57, 066e3895.
- The roadmap reader `planOf` now counts dated State bullets: the F8 plan reads 16/22, not 13/19
  (`bin/lib/report-pages.mjs`, STATE_BULLET).
- The plan block in `bin/lib/stretch-render.mjs` and `bin/lib/pages-sections.mjs` (`stepsByState`, `foldHtml`,
  `planSections`, which now shows only the steps that changed).
- docs/stretch-state-after-879 (bc6d12d9, pushed, no PR): the state after 879, with spec 8 held.

## Decisions
- Spec 8 is its own slice after 879, with a proposed optional `doc` field per plan item. This session proposed it and
  the lead had asked for the slicing; it is recorded in `odd/tasks/stretch-protocol.md`, spec 8.
- The lead holds spec 8 while a full-audit session the user asked for takes its lane (the lead's message, 2026-11-15).

## Failures and lessons
- Dated State bullets were dropped, so the counts were low: `docs/FAILURES.md` plan-state-dated-dropped. Fixed test
  first.
- I edited tracked files while Codex reviewed, so the review recorded nothing (173,920 tokens):
  `docs/FAILURES.md:320` codex-review-edited-during-run. After that, no edits during a review; the lead says PR 878's
  snapshot fix is installed.

## Left
- Spec 8 (T10): held by the lead until the audit ends.
- Open for the lead:
  - S4a counts as "sin estado claro";
  - on a return, the rows table says "abierta" where the block says "sin hacer";
  - the F8 phase's row 4 text is stale;
  - the step titles are in English.
- Owed in spec 8's first docs commit: drop the old Next step paragraph; correct L11 (one `stretch show` at main's code
  wrote a line to his real record).
- Not verified: what binds a PR; whether any stored report mark holds the old count.

## Cost
- From the opened notice at 2026-11-15T00:10Z to the ready notice at 01:45Z; this close at about 05:30Z.
- Context was at 28% at the end, after one host compaction.
- Reviews: five Codex runs, one of them with no record; Claude lenses (readability, reliability) on every code commit.
- The pre-commit gate ran on every commit.

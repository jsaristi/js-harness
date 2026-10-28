# JH 71 · Stretch protocol: plan, live view and return check

## Goal
Build the stretch protocol the user asked for on 2026-10-28, as a feature of its own beside F8: a command that plans a
stretch with goals that are commands, shows its departure and its return in the chat, measures time and failures from
the records, and the change to rule:away-autonomy that makes the lead use it. Brief:
`C:\Users\Oficina\.js-harness\background\briefs\2026-10-28T15-12-15-270Z-7f1eadfd.md`.

## The user's words
Read with `js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f <line>`:
- 8017: "si quieres metemos algo antes al protocolo donde me digas antes de irme que es todo lo que s eva a hacer cuantas horas aproximadamente se va a utilizar"
- 8139: "Me lo puedes mostrar un con artefacto dentro del chat bien visual siempre"
- 8213: "si te digo que me voy 8 horas me digas la meta que se va a tener para dentro de las 8 horas para que cuando vuelva y te diga que ya volvi y me muestres lo que hemos avanzado, me muestres un artefacto en el chat donde me checkes lo que se hizo y lo que no y miramos si se cumplieron las metas"
- 8264: "muestrame asi como la visualizacion de salida el tiempo que se demoro y lo que fallo y el tiempo en barra de cuanto se gasto y fallo"
- 8296: "quiero que volvamos esto un protocolo del arnes y que nos sirva para ir miediendo en tiempo real nuestro flujo de trabajo"
- 8326: question 103, "Próximo cupo".

## Delivered
- PR 633, merged (522f5fb7): `js-harness stretch` (`bin/stretch.mjs`, `bin/lib/stretch.mjs`,
  `bin/lib/stretch-render.mjs`), the open stretch on the live board (`bin/sessions-live.mjs`,
  `docs/live-board.html`), README and SPEC entries, the roadmap line. Commits 838c9fe1, 765baf9a, b1d9f90a, 4e6dbdd7,
  b651463a.
- PR 634, merged (7899f5ee): rule:away-autonomy gains the departure and the return, his words stored by `rules change`
  (865ec2e7).
- Feature document: `odd/tasks/stretch-protocol.md` (contract, specs, design, tasks T1-T7, log L1-L8).

## Decisions
- The user: the protocol as its own feature (question 103, line 8326).
- The lead's brief: build on throughput and its records; a goal is a command that exits 0; corrections by kind.
- This session, after two blind readers (L4): an item is one session's work; nested gates folded; silent past
  rule:session-stall; land gates and failed lands go to the stretch; goals run only on `status --goals` and `close`.
  Not taken: one global correction, measuring tasks by commits.
- This session: the rule text folded into the rule's bullet to keep `bin/lib/manifest.mjs` at its ceiling (L6).

## Failures and lessons
- Codex found seven P2 defects in the measures (L5): machine-wide records not kept to the project, a gate of another
  session counted in a shared worktree, a gate's end ignored, an unreadable Codex record read as none, a cut line
  swallowing the next event. All fixed test first in b651463a; recheck 7 of 7 fixed.
- The gate refused the first rule commit: `manifest.mjs` grew past its 1,793-line ceiling
  (`bin/conventions-structure.test.mjs:152`); the text went inside the existing bullet.
- `notify --kind ready` refused PR 633 for having no gentle-ai line; `gentle-ai review assess` (not due) was written
  in the document and the body. Lesson: write the gentle-ai line before the first ready notice.
- A hand-written wait for the lead's notice first matched old "copy refreshed" notices; it was redone to read only
  notices after its start.

## Left
- T7's last line: a real stretch opened before the user leaves and closed when he is back, held by the lead.

## Cost
- Time: brief 15:12Z, first notice 16:04Z (after a compaction), PR 634 ready 17:19Z, merged before 17:40Z.
- Context at the end: about 45% (the last notice's figure).
- Reviews: design readers (one Claude, one Codex); Codex 865,957 + 99,089 + 67,717 input tokens; Claude lenses about
  142,000 + 14,320 input tokens; gentle-ai assess twice, no review (not due).
- Gate runs: 8 under this session's id in the gate log as it stands (it rotates; the commits made about 15).

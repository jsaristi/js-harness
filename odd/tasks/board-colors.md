## Goal
The live board opens with what waits on the user, each item tagged urgent, priority or options in its own color, and
the whole board speaks one color language: red urgent or warning, amber in progress, blue waiting or information,
green done, said in a legend at the top.

## Why
He asked to be told a thing once in chat and to find it on the board, at the top and colored by priority, so the lead
stops repeating it; and to read the board's state by color at a glance, the same color meaning the same thing in every
section.

## Done when
- `node --test bin/sessions-live.test.mjs` exits 0
- `npm run check` exits 0
- `js-harness notify --to orchestrator --kind ready --pr <n>` records the notice

## In scope / Out of scope
- In: docs/live-board.html, bin/sessions-live.test.mjs, the lead's skill line on `board/summary` (bin/lib/manifest.mjs),
  this document.
- Out: republishing the board and merging (the lead's, after his yes); anything outside this worktree.

## Constraints
- The board takes shared data through textContent only — because every field of its database is untrusted.
- A plain string in `yours` keeps working — because summaries written before carry them.
- Color is never the only signal: each tag and state also says its word — because a color alone fails a reader who
  cannot tell it apart.

## Ask me before
- Nothing beyond the brief: the lead decides scope; Sebastián decides merging and the republish.

## Depth pass
- 1. Method: a status board's color language, to the standard of traffic-light dashboards and WCAG 1.4.1 and 1.4.3:
  four colors, each bound to one meaning everywhere, never the only signal, 4.5:1 for text on its tone in both themes.
  The smallest change: rebind the board's existing tokens (`--late`, `--wait`, `--run`, `--ok`) instead of new ones,
  drop the fifth (purple `--you`), and parse the level from the strings the lead already writes. Searched first: the
  board's tests (`bin/sessions-live.test.mjs`, the only tests of the page), the summary docs (`bin/lib/manifest.mjs:147`,
  `docs/SPEC.md:742`, which says nothing of `yours`' items).
- 2. Raw material: `docs/live-board.html:108` at `e2d1c873` (the `yours` section after "Cómo va" and "Lo último") and
  `docs/live-board.html:455` (`yoursItems` filtering strings); lead transcript 0f71b2c6 line ~08:55 local; the lead's write of board/summary v178 (items opened by `URGENTE · `); his two quotes in the Specs; the
  contrast of each pair, measured with the WCAG luminance formula (light amber `#c7741c` read 3.05:1 on its tone and
  green `#2a7f52` 4.17:1, so both darken).
- 3. The bar:
  spec 1: `node --test bin/sessions-live.test.mjs`: none, new behaviour; today `yours` comes after the status cards
  and the recent list, and a tagged item shows its prefix as plain text.
  spec 2: `node --test bin/sessions-live.test.mjs`: none, new behaviour; today a working session is blue, a waiting one
  amber, a question purple, a stale board orange.
- 4. Refutation: could the prefix misread an ordinary item? "Urgentemente ..." and a bare "URGENTE · " are tested to
  stay plain; the session and question lines the board adds start with a session's name or "Pregunta", never a level.
  `node --test bin/sessions-live.test.mjs`, run first against the old page: 5 fail (order, levels, colors); after the
  change: 19 pass, 0 fail.
  Verdict: supports
- 5. Request: as the Goal; quiet sessions turn red (a warning: "puede estar trabada") and the "propuesto" tag blue
  (information), which spec 2's binding implies rather than adds.
  Adds: none

## Specs
1. "solo quiero que lo menciones una vez en el chat y me lo coloques como urgente. prioritario u opciones con un buen
   color al inicio del tablero para yo saber y no gastemos tokens innecesarios insistiendo tanto en algo que genera
   mucho ruido y basura" (lead transcript 0f71b2c6, 2026-11-07 ~08:55, through the brief).
2. "y por favor metele color al tablero osea la colorimetria correpsondiente para que visualmente sea mas indicativo
   por ejemplo, lo rojo es advertencia o urgente, lo amarillos ..., lo azul .... , lo verde ... etc etc" (lead
   transcript 0f71b2c6, 2026-11-07, through the lead's message to this session).

## Tasks
- [x] T1 (build) S1: `yours` right under the header, items tagged `URGENTE · `, `PRIORITARIO · ` or `OPCIONES · `
  shown with a colored tag and ordered by level; the lead's skill line says how to tag: `a382627`.
- [x] T2 (build) S2, `a382627`: one color meaning across the status box, the recent list, the session cards, the timeline by kind,
  the route and the yours items, with a legend at the top; light and dark, phone width.

## Log
- L1 The brief (2026-11-07T14:33Z): "The board puts what is his first, by priority" — spec 1, with the choice of data
  shape left to this session.
- L2 Data shape, decided here: `yours` stays an array of strings and an item opens with its level and a separator
  (`URGENTE · `, also `:` or `-`, any case), which is what the lead already writes (board/summary v178); an item with no
  level shows as before, after the tagged ones. A second shape (`{ level, text }`) would add a path to test for nothing
  the prefix lacks.
- L3 The lead's message (2026-11-07), spec 2, added to the same PR, with the binding: red = his URGENTE, a late or
  quiet session, a stale board; amber = PRIORITARIO, running work; blue = waiting on him or on a session, OPCIONES;
  green = done or passing.
- L4 Reviews of e2d1c873..a382627: Codex, the patch is correct (0.91), no finding; the readability and reliability
  lenses, 0 findings each. Not checked: the page drawn in a browser at phone width (no live db here); the contrast is
  measured from the tokens, not from a screenshot.

# report-stretch-share

Branch `feat/report-stretch-share`, from main (f2110239). Runner: `node --test`. Session JH 91.

## Goal
The status report (`js-harness report`, printed and with `--html`) carries, from the records and not the lead's
notes, the migration's share (the F8 plan's steps done of their total, now and at the last report's cut) and the last
stretch open or closed since the cut: each goal met or not with its exit, its hours, and its forecast against what
happened; and `report --mark --html` without `--notes` warns that sections 3, 5 and 6 will say no record holds them.

## Why
His words of 2026-10-30, quoted under Specs: the "cómo vamos" showed neither the map's percentages nor whether the
stretch's goals were met. PR 675 and 676 put the forecast on the stretch's own pages; the status report never read it,
and a report sent without notes left three sections empty with nothing to warn the lead.

## Done when
- `npm run check` exits 0
- `node --test bin/report.test.mjs bin/lib/report.test.mjs bin/lib/report-status.test.mjs bin/lib/stretch-forecast.test.mjs bin/stretch.test.mjs` exits 0
- `node bin/js-harness.mjs report --help` exits 0
- The test "the status page carries the F8 share and the last stretch's goals" fails with the share or the stretch
  taken off the page (a planted break, run by hand and said in the Log)

## In scope / Out of scope
- In: `bin/report*.mjs`, `bin/lib/report*.mjs` and their tests; `bin/stretch.mjs` and `bin/lib/stretch-forecast.mjs`
  only to export what the report reuses (`reportStretch`, `planShare`), with their tests; this document;
  `docs/sessions/`; one `- Seen:` line in `docs/FAILURES.md`.
- Out: JH 90's files (`scripts/`, `bin/doctor*`); the stretch's pages and record format; the report record's format
  (a change there stops and goes to the lead first); the installed copy (the lead lands and refreshes).

## Constraints
- The migration's share is the count the stretch forecast reads (`planShare`), never a second count.
- The stretch's numbers are what `stretch status` and `stretch close` compute (`measure`, `momentsOf`), never
  recomputed in the report; the report runs no goal: it shows them as last checked.
- No record format changes: the report's `--mark` line and the stretch record stay as they are.

## Ask me before
Nothing beyond the standing rules: the brief (JH 91) and his words decide the feature.

## Specs
1. The page and the printed report carry the migration's share, the F8 plan steps done of their total, now and at the
   last report's cut. His words, lead transcript 0f71b2c6, line 23526 (2026-10-29T16:14Z): "tambien que diga en que
   porcentaje total vamos y a cuanto aproximadamente llegariamos"; line 23561 (16:16Z): "como el proyecto lo vamos a
   tener que volver amigrar todo y completo es a eso no a lo que ya veniamos haciendo que es el proyecto antiguo".
2. They carry the last stretch closed or open since the cut: each goal met or not with its exit, its hours, and its
   forecast against what happened. His words, line 25223 (2026-10-30T01:46:58Z): "no aparecio en el como vamos, ni el mapa ni los porcentajes
   si se cumplio la meta, no aparecio absoultamente nada de lo que planteamos".
3. With no `--notes`, sections 3, 5 and 6 say so as now, and `report --mark --html` without `--notes` prints a warning
   that those three sections will be empty.

## Tasks
- [x] T1 (kind: build) S1: `planShare` exported from the forecast and used by it; `mapOf` carries each plan's share;
  the printed report and section 4 of the page show the migration now and at the cut. Commit: feat(report), one with
  T2 and T3: the three write the same four functions of `report` and its page, so apart they would not review alone.
- [x] T2 (kind: build) S2: `reportStretch` beside `boardStretch`; the printed report and section 4 show the last
  stretch's goals, hours and forecast against now. Commit: feat(report), with T1.
- [x] T3 (kind: build) S3: the warning on `--mark --html` without `--notes`. Commit: feat(report), with T1.
- [ ] T4 (kind: docs) the FAILURES entry, this document, the session summary. Commit: docs.

## Log
- L1 His request, through the lead's brief JH 91 (2026-10-30): "no aparecio en el como vamos, ni el mapa ni los
  porcentajes si se cumplio la meta, no aparecio absoultamente nada de lo que planteamos".
- L2 Decision (JH 91): the brief allows `bin/lib/stretch.mjs` "only to export what the report reuses", but the forecast
  lives in `bin/lib/stretch-forecast.mjs` and the measure in `bin/stretch.mjs`; the clause is read as covering those two,
  one export each, and the lead was told by a note notice at 2026-10-30T01:51Z.
- L3 Decision (JH 91): the migration and the stretch go into section 4, "El mapa", ahead of the phases: the rule's six
  sections stay six, and section 4 is where the share and the forecast belong.
- L4 The lead confirmed L2 at 2026-10-30T01:53Z (note notice): one export each in `bin/stretch.mjs` and
  `bin/lib/stretch-forecast.mjs`, nothing else changed there.
- L5 Decision (JH 91): `reportStretch` reuses `measure` and `momentsOf` whole and keeps their forecast and goals; the
  moments it does not show (timeline, plan steps) cost a few more git reads per report, cheaper than a second path
  that could drift from the stretch's own pages. A stretch record that cannot be read counts as a section that could
  not be read, so `--mark` records nothing, as for the channel record.
- L6 Evidence, tests first: the new tests failed before the code (`node --test` of the five files: the report tests on
  the missing Migration line and warning, `bin/stretch.test.mjs` on the missing export), then 96 of 96 passed.
- L7 Evidence, the planted breaks: with `migrationHtml` taken off section 4, "the status page and the printed report
  carry the F8 share and the last stretch's goals, from the records" failed on
  `/La migración[\s\S]*F8 plan[\s\S]*1 de 2 pasos · 50 %.../` (pass 0, fail 1); with `stretchHtml` taken off it failed
  again (pass 0, fail 1); restored, pass 1, fail 0.
- L8 The FAILURES entry `status-report-without-facts` read "control lost" while the test title held `\'`: the register
  matches the title's text, so the title is written in double quotes; `js-harness failures` then reads it controlled.
- L9 His words were checked with `js-harness sessions --quote`: the brief's line 25304 is an assistant entry, and his
  line is 25223 (2026-10-30T01:46:58Z); lines 23408, 23526 and 23561 are his, of 2026-10-29. The Specs cite the lines
  read. Lenses: readability, reliability and resilience over f2110239..d04fd86c, 0 findings each, recorded.
- L10 Codex over f2110239..d04fd86c, recorded in 2 parts: part 1 correct (0.86); part 2 one P2 finding, valid:
  `reportStretch` dropped `measure`'s `unavailable`, so partial hours read as whole and `--mark` could advance the cut.
  The first run did not record part 2 because this session edited this document while it ran; the edits went to a
  tagged stash and the run was repeated once (part 1 kept). Fix: `reportStretch` returns `unread`, the lines and the
  page say each record and that the hours are partial, and `--mark` records nothing; tests first (4 failed, then 79
  of 79 passed). The test comment citing line 25304 now cites 25223.

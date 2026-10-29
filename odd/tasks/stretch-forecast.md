# stretch-forecast

Branch `feat/stretch-forecast`, from main (1c6b6c22). Runner: `node --test`. Session JH 89.

## Goal
The departure of a stretch, and its status, say how far the stretch is expected to move the map: the share now, as
`js-harness progress` counts it, in total and by phase, and the share expected at the return if the planned items
close, one number with its range from the items' corrected hours against the stretch's hours; the status and the
return measure the stretch against that forecast.

## Why
His words of 2026-10-29 to the lead, quoted under Specs. The departure says what will run and for how many hours, but
not what that work is worth on the map, so he cannot tell, before he leaves, how far the project will be when he is
back, and the return has no forecast to be measured against.

## Done when
- `npm run check` exits 0
- `node --test bin/lib/stretch-forecast.test.mjs bin/lib/stretch.test.mjs bin/lib/stretch-render.test.mjs bin/stretch.test.mjs` exits 0
- `node bin/js-harness.mjs stretch --help` exits 0
- The open stretch of 2026-10-29T16:07:51.894Z renders its forecast with `stretch status --html` once the lead names what its items close (by hand)

## In scope / Out of scope
- In: `bin/lib/stretch*.mjs`, `bin/stretch.mjs` and their tests; `bin/lib/progress*.mjs` only to read the map;
  this document; `docs/FAILURES.md`; the session summary under `docs/sessions/`.
- Out: what `progress` prints; JH 86's files (rules, evals) and JH 88's (merge queue, refresh-copy, the
  orchestrator skill); the installed copy; anything else goes to the lead first.

## Constraints
- The plan's existing fields keep working, and a plan without the new field opens as before: the forecast then says
  that no item names what it closes.
- The stretch record stays readable by its other readers (`report feature`, `sessions live`): the change only adds an
  optional field of an item and an event kind they do not read.
- The shares are the map's as `progress` counts it (`parseRoadmap` through `mapOf`), never a second count.

## Ask me before
Nothing beyond the standing rules: his words decide the feature, and the lead's note of his line 23526 decides the
page's order.

## Specs
1. Say on the departure how much the stretch will advance, as a percentage, in the time he is away: "añadele al
   artefacto que tanto avanzaremos osea cuanto porcentaje avanzaremos en el tiempo que me voy a ausentar." (the lead's
   transcript 0f71b2c6-cbce-43ca-a031-276a4b2c381f, line 23408, 2026-10-29T16:11:40Z, read with `js-harness sessions
   --quote`).
2. Say the total share now and about where it would reach: "tambien que diga en que porcentaje total vamos y a cuanto
   aproximadamente llegariamos" (same transcript, line 23526, 2026-10-29T16:14:11Z). The lead's note on it: the page
   leads with the project's total share now and the approximate share at the return, one number each, the range beside
   the second, before the phases.
3. The share he means is the migration's, not the old project's: "si pero me refiero a que como el proyecto lo vamos a
   tener que volver amigrar todo y completo es a eso no a lo que ya veniamos haciendo que es el proyecto antiguo que ya
   cambio de rumbo" (same transcript, line 23561, 2026-10-29T16:16:06Z). The lead's note on it: keep it for good, in
   `rule:away-autonomy` (the departure shows the migration's share now and the expected share at the return), changed
   on a `rule/` branch in its own PR after the code PR, and one `docs/FAILURES.md` line for the stretch not opened.

## Design

### What an item closes
An item may name what it closes: `closes`, a list of `{ in, step }`. `in` is a phase title of the roadmap's checklist
(`### F8 Harness reorganization`) or the name of a plan section (`F8 plan`); `step` is, in a phase, the start of one
open step's text as `progress` prints it, and in a plan, a step's id (`S5c-a`). Each entry is resolved against the
moment at the opening commit (`momentAt`, the commit the `open` event records): a phase title first, then a plan
name; it must name exactly one step that is not done there (in a plan, a step whose state is not done, built or
applied, the states the return draws as done). An entry that resolves to nothing, to two steps or to a done one is
refused with the reason (exit 2 on `open`), when the map can be read; when git cannot read it, the plan is recorded
and the forecast says the map could not be read.

Searched first (AGENTS.md): the plan's fields (`parsePlan`), the map rows (`mapOf`, `parseRoadmap`), the plan steps
(`planOf`), the return's map and plan comparisons (`compareMaps`, `comparePlans`) and the moments' shares
(`stretch-moments.mjs`). None says what a planned item is worth on the map; the forecast reads the first four and adds
one field and one module.

### The forecast
From the lanes the departure already lays (`laneOut`), each item's end is a `[low, high]` of hours from the opening.
An item that waits for him takes no lane and closes nothing in the stretch. The rows an item names count as closed:

- in the forecast (the one number), when the middle of its end is within the stretch's hours;
- in the low end of the range, when its high end is within them (it closes even if it runs long);
- in the high end of the range, when its low end is within them (it closes only if it runs short).

A row two items name counts once. The share is `(done + closed) / total` over the map at the opening, in total and by
phase, rounded as `progress` rounds (a whole percent); each plan's steps get the same three counts.

### Why the measure is honest while tasks are added
The forecast is a claim about named rows of the map as it stood at the opening, so its denominator is that map's and
never moves. Rows added during the stretch lower the share `progress` prints without making the forecast wrong, and
rows closed that no item named raise it without making it right. So the status and the return show three things apart:
the share at the opening, the forecast, and the share now as `progress` counts it now; beside them, how many of the
named rows are done now (counted by the same rows, so an added row cannot move it), and how many rows the map gained
or lost since the opening, so the gap between the forecast and the share now is read for what it is.

### The open stretch of 2026-10-29
Its plan holds no `closes`. `js-harness stretch closes <item> <in> <step>` records, for the open stretch, one row an
item closes, resolved and refused as above; the forecast of `status` reads the plan's entries and these. Nothing else
is passed: `status --html` then renders the forecast from the plan the record holds.

### The pages
The migration is the roadmap's plan section (`## F8 plan`, the steps that replace gentle-ai; spec 3), so each plan
section leads, counted by its steps, and the map's total, the old project's checklist, comes second. The departure
leads with two numbers for each, the share now and the forecast at the return with its range beside it, then the
phases (now, forecast, range), the rows the plan closes and when, then the plan as before. `status --html` and the
return put a section of the forecast first: at the opening, the forecast, now, the named rows done now and the rows the
map gained. A plan's steps are uneven in size, so its share is a count of steps, said as such, never a measure of
effort.

## Tasks
- [x] T1 (kind: build) the forecast, pure (`bin/lib/stretch-forecast.mjs`): resolving `closes`, the counts from the lanes, the shares and the measure now; and `closes` in `parsePlan`. Spec 1, 2. Route: inline. Commit: 3ddcf3f8.
- [x] T2 (kind: build) the command: `open` resolves and forecasts, `closes` records a row for the open stretch, `status` and `close` measure against the forecast (`bin/stretch.mjs`). Spec 1, 2. Route: inline. Commit: f5d4d70f.
- [ ] T3 (kind: build) the pages: the departure leads with the migration's plan and the map, two numbers each, the status and the return with the forecast section (`bin/lib/stretch-render.mjs`). Spec 1, 2, 3. Route: inline. Commit: pending.
- [ ] T4 (kind: verify) the open stretch's forecast rendered from the real record in a scratch home; reviews (Codex and the Claude lenses) on the slice; PR. Route: inline.
- [ ] T5 (kind: docs) `rule:away-autonomy` names the migration's share now and at the return on the departure, through `js-harness rules change away-autonomy` on a `rule/` branch, his words quoted with their date; its own PR. Spec 3. Route: inline.
- [x] T6 (kind: docs) the `docs/FAILURES.md` line: 2026-10-29 he left for an hour with no stretch opened, so the return had no goals; the check is `stretch status` at his departure. Spec 3. Route: inline.

## Log
- L1. 2026-10-29, the lead's brief for JH 89: his words of line 23408 (spec 1), the departure of the stretch opened
  2026-10-29T16:07:51.894Z, the shares as `progress` counts them, the range from the corrected hours, how an item says
  what it moves left to this session, and `status --html` of the open stretch tonight.
- L2. 2026-10-29, the lead's note of his line 23526 (spec 2, read with `js-harness sessions --quote`): the page leads
  with the total share now and the approximate share at the return, one number each, the range beside the second,
  before the phases; same PR.
- L3. 2026-10-29, the open stretch's plan, read from the record: three items (`s5ca`, JH 86; `lead`, JH 88; `s13`,
  none), no `closes`. S5c-a and S13 are steps of the F8 plan and parts of F8's map row 4, which none of them closes
  alone; so the plan steps count beside the map, or the forecast of tonight would read no movement where steps do move.
- L4. 2026-10-29, the lead's note of his line 23561 (spec 3, quoted): the share he means is the migration's. Decided
  here: the plan sections lead the pages, the map total second; no new field, since the roadmap already names the
  migration's plan. T1 (3ddcf3f8) and T2 (f5d4d70f) already count each plan's steps, so only the pages change. The
  rule change and the FAILURES line are added as T5 and T6, after the code PR, as the lead asked.
- L5. 2026-10-29, the slice's reviews over 1c6b6c22..5aed8af1. The Claude lenses (reliability, readability,
  resilience; risk left out: the change adds an optional field, a verb and an event kind the record's other readers
  do not read): complete, 0 findings, 120,754 input tokens. Codex: part 1 of 2 read 181,101 input tokens and was
  discarded, because this session wrote the T6 entry in `docs/FAILURES.md` in the worktree while it ran
  (`edit-during-review`, seen again; its Seen line added). Fix: the T6 commit first, then the review run again with
  nothing edited while it runs, under a declared `js-harness wait`.

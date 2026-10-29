# JH 89 · Stretch forecast: how far the stretch moves the map

Started in the background by the lead with `js-harness sessions start`; brief
`~/.js-harness/background/briefs/2026-10-29T16-13-03-051Z-7facfc7e.md`. Branch `feat/stretch-forecast`, base main
`1c6b6c22`, worktree `.claude/worktrees/stretch-forecast`. Large by the resume test, so its feature document is
`odd/tasks/stretch-forecast.md`, opened before the first source write.

## Goal
The departure of a stretch, and `stretch status --html`, say how far the stretch is expected to move the work: the
share now and about where it reaches at the return, with its range, for the migration's plan and for the map.

## The user's words
Read with `js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f <line>`:
- line 23408, 2026-10-29T16:11:40Z: "añadele al artefacto que tanto avanzaremos osea cuanto porcentaje avanzaremos en
  el tiempo que me voy a ausentar."
- line 23526, 2026-10-29T16:14:11Z: "tambien que diga en que porcentaje total vamos y a cuanto aproximadamente
  llegariamos".
- line 23561, 2026-10-29T16:16:06Z: "si pero me refiero a que como el proyecto lo vamos a tener que volver amigrar todo
  y completo es a eso no a lo que ya veniamos haciendo que es el proyecto antiguo que ya cambio de rumbo".

## Delivered
- `b60053a1` docs: the feature document (contract, specs, design, why the measure stays honest).
- `3ddcf3f8` feat(stretch): `bin/lib/stretch-forecast.mjs`, pure: an item's optional `closes: [{ in, step }]` (a
  phase's open step by the start of its text, or a plan step by its id), resolved against the roadmap at the opening;
  the counts from the departure's lanes (by the middle of each estimate, the range by its two ends); `forecastNow`,
  the named rows counted by themselves. `parsePlan` keeps `closes`.
- `f5d4d70f` feat(stretch): `open` refuses a row the opening's map does not hold open (exit 2, nothing recorded) and
  puts `forecast` in the departure; the new verb `stretch closes <item> <phase or plan> <step>` adds a row to an item
  of the open stretch (event `closes`); `status` and `close` carry `moments.forecast` with `now`.
- `d5873f14`, `5aed8af1` feat/fix(stretch): the departure, the status and the return lead with "Cuánto avanzaremos":
  each plan section (the migration, `F8 plan`) by its steps, then the map's total, two numbers each, then the phases
  and the rows the plan closes and when.
- `a8461e9d` docs(failures): `stretch-not-opened` (owed to T5) and `edit-during-review` seen again.
- This summary and the document's log.

## Checked
- `node --test` of the four stretch test files: 77 of 77 on the branch; on main `1c6b6c22` (the same test files in a
  detached worktree of origin/main) the 15 new tests fail, 10 entries, the module's file whole on import; 62 old pass.
- Each code commit passed the pre-commit `check`.
- The open stretch's real record copied to a scratch home: after `stretch closes` for its three items, `stretch status
  --html` renders F8 plan 32 % now, ~42 % at the return; the map 91 % now, ~92 %.
- Reviews: the Claude lenses (reliability, readability, resilience) over `1c6b6c2..5aed8af`, 0 findings, 120,754
  input tokens; Codex over `b60053a..a8461e9`, 2 parts, correct (0.88), 0 findings, 275,221 input tokens. gentle-ai:
  the Stop hook offered the whole branch only; nothing started.

## What the lead passes tonight
The open plan has no `closes`, so the lead names what each item closes, then renders:
`js-harness stretch closes s5ca "F8 plan" S5c-a`, `js-harness stretch closes s13 "F8 plan" S13`, and, if JH 88's work
closes the map row, `js-harness stretch closes lead "Review and release" "The lead's manual steps"`; then
`js-harness stretch status --html <file>`. Which rows each closes is the lead's call; these are this session's reading.
They need the installed copy to hold this branch.

## Failed, and what it cost
- The first Codex run was discarded: `docs/FAILURES.md` was edited in the worktree while it read part 1 (181,101 input
  tokens). Fix: commit first, then run again with nothing edited, under a declared `js-harness wait`. Its `Seen:` line
  is in `edit-during-review`.

## The rule (T5), after PR 675 landed
- `eb043c74` feat(rules), PR 676 on `rule/away-autonomy-forecast` from main `b2954f54`: `rule:away-autonomy` leads the
  departure with the migration's share now and expected at the return, checks with `stretch status` that a stretch is
  open before he leaves, and shows the return against the forecast; made by `rules change` (dry run first), his words
  of lines 23408, 23526 and 23561 stored with the five of 2026-10-28. No open pull request touched
  `bin/lib/manifest.mjs` (checked with `gh pr list` and each one's files). Codex over `b2954f5..757bf02`: correct
  (0.93), no findings; the readability lens: 0 findings, 9,126 input tokens.
- `757bf02` docs(failures): `stretch-not-opened` controlled by that line (`js-harness failures stretch-not-opened`).

## Open
- The dispatcher's help (`bin/js-harness.mjs`) and `docs/SPEC.md` do not name the `closes` verb: outside this brief's
  surfaces; `stretch --help` does.
- The lanes do not hold that S13 comes after S5c-a; that is `laneOut`'s.

## Spent
Codex: 456,322 input tokens over two runs for PR 675 (one discarded), and one small run for PR 676. Claude lenses:
120,754 and 9,126 input tokens. No eval spend.

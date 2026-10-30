# JH 91 · Status report: the last stretch and the migration's share

## Goal
Make the status report (`js-harness report`, printed and `--html`) carry, from the records and not the lead's notes,
the migration's share (F8 plan steps done of their total, now and at the last report's cut) and the last stretch open
or closed since the cut (each goal met or not with its exit, its hours, its forecast against what happened), and warn
on `report --mark --html` without `--notes`. Opened from the brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-10-30T01-48-12-771Z-cdb088bb.md`, main at f2110239.

## The user's words
- Lead transcript 0f71b2c6, line 25223, 2026-10-30T01:46:58Z (`js-harness sessions --quote`): "no aparecio en el como
  vamos, ni el mapa ni los porcentajes si se cumplio la meta, no aparecio absoultamente nada de lo que planteamos".
  The brief cited line 25304, which `sessions --quote` reads as an assistant entry.
- Line 23526, 2026-10-29T16:14Z: "tambien que diga en que porcentaje total vamos y a cuanto aproximadamente
  llegariamos"; line 23561, 16:16Z: the total is the migration, "no a lo que ya veniamos haciendo".

## Delivered
- d04fd86c feat(report): carry the migration's share and the last stretch, on `feat/report-stretch-share`:
  `planShare` (bin/lib/stretch-forecast.mjs) is the forecast's count, now used by the forecast and by `mapOf`;
  `reportStretch` (bin/stretch.mjs, beside `boardStretch`) reuses `measure` and `momentsOf`; the printed report and
  section 4 of the page lead with the migration and the stretch; the warning on `--mark --html` without `--notes`.
- Tests first: the new tests failed before the code, then 96 of 96 passed in the eight report and stretch test
  files; the planted breaks (migration off the page, then the stretch off) each failed the integration test
  (pass 0, fail 1), restored it passed (odd/tasks/report-stretch-share.md, L6 and L7).
- The gate: the pre-commit `npm run check` passed, "17 rows passed, 9 of them INFO".
- odd/tasks/report-stretch-share.md, the contract and the Log; docs/FAILURES.md entry `status-report-without-facts`,
  read "controlled" by `js-harness failures`.
- 645bce60 fix(report): say a stretch's partial hours and keep --mark from them, Codex's P2 on d04fd86c fixed;
  tests first (4 failed, then 79 of 79 in the touched test files).
- f0773740 docs and this summary's commit: his lines cited as `sessions --quote` reads them, the Log.
- PR 683 (https://github.com/jsaristi/js-harness/pull/683), ready to land.

## Decisions
- The allowed surface named `bin/lib/stretch.mjs`; the forecast and the measure live in `bin/lib/stretch-forecast.mjs`
  and `bin/stretch.mjs`. This session read the clause as covering those, one export each; the lead confirmed at
  2026-10-30T01:53Z (Log L2, L4).
- Migration and stretch go into section 4, "El mapa", ahead of the phases: the six sections stay six (L3).
- `reportStretch` reuses `measure` and `momentsOf` whole, a few more git reads a report, rather than a second path;
  a stretch record that cannot be read blocks `--mark`, as the channel record does (L5).
- One code commit for the three specs: they write the same four functions (Tasks).

## Failures and lessons
- Codex's first run did not record part 2: this session edited the feature document while the review ran, and the
  command refuses a part whose tree differs from HEAD. The edits were set aside in a tagged stash and the run repeated
  once (only part 2). Lesson: nothing is edited in the worktree while a review runs; drafts go to the job's tmp.
- The FAILURES entry read "control lost" while the test title held `\'` (L8): titles a register cites are written in
  double quotes.
- The brief's transcript line was wrong (25304 is an assistant entry): checked with `sessions --quote` before citing.
- Codex found that `reportStretch` dropped the records `measure` could not read (partial hours shown as whole,
  `--mark` free to advance the cut); fixed in 645bce60 and rechecked "fixed". Lesson: a projection of a view keeps
  its `unavailable`, never only its numbers.

## Left
- The installed copy is not refreshed: the lead lands and refreshes.
- gentle-ai: the Stop hook offered the whole branch twice; its read-only status was run and nothing started, as
  CLAUDE.md says. Codex and the lenses cover both code commits.
- The page was not rendered against the real stretch record: the lead's next `report --html` is the first real one.

## Cost
- First notice 2026-10-30T01:51Z (note), last: the ready and closed notices.
- Reviews: the Claude lenses (readability, reliability, resilience) over f2110239..d04fd86c, 0 findings, about 102,000
  input tokens, and over d04fd86c..f0773740, 0 findings, about 56,000; Codex over f2110239..d04fd86c in 2 parts,
  part 1 213k input tokens, part 2 104k (not recorded, the tree changed) and 103k again, then d04fd86c..f0773740
  62k: about 482k Codex input tokens in all, 104k of them lost to the edit during the run.
- Gate runs: one pre-commit `npm run check` per commit, four commits.

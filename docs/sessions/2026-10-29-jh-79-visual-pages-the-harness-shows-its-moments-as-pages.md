# JH 79 · Visual pages: the harness shows its moments as pages

File: docs/sessions/2026-10-29-jh-79-visual-pages-the-harness-shows-its-moments-as-pages.md.

## Goal
Make the harness show its moments as pages a command makes from the records, never drawn by hand, each keeping its
numbers so the next compares with it: the stretch's departure and return, a feature's close, a phase change and the
status report; ship them to every project through `init`; and make a stale live board impossible to miss. The brief:
`C:\Users\Oficina\.js-harness\background\briefs\2026-10-28T23-49-00-688Z-ff16a987.md`; the feature document:
`odd/tasks/visual-pages.md`.

## The user's words
His three lines of 2026-10-28 are quoted in `odd/tasks/visual-pages.md`, `## Specs`, read with
`js-harness sessions --quote` from 0f71b2c6 lines 12054, 12220 and 12237 ("te apruebo las ideas que me diste para
que los apliques"). Spec 9 came through the lead and was read the same way: 0f71b2c6 lines 18034 and 18171, beside
each failure of the stretch return why it failed and how it was or can be fixed, and why not if it is not.

## Delivered
- PR 643, merged 02:00Z: the design, after two blind readers (T1).
- PR 645, merged 03:38Z, carrying #644's commit: the pages renderer, the page record, and the stretch return with the
  share of the plan met, the map before and now and a timeline (T2, T3).
- PR 647, merged 06:29Z: the Stop hook warns while board rows wait, `sessions start` writes its start row, the board
  shows running work, the last three things done, the lead's status cards and each card's time against its estimate
  (T4, T5, T5b-T5d).
- PRs 651, 652 and 654, merged 06:54Z, 07:31Z and 08:19Z: `report phase`, `report --html` (the status report's six
  sections) and `report feature`, each putting its page in the rendered record (T6, T6a, T10).
- PR 655, merged 09:31Z: `rule:reports-spanish-visual` and `rule:away-autonomy` say which command makes each moment's
  page and what the return shows (T8).
- PRs 658, 659 and 661, merged 10:39Z, 10:56Z and 11:18Z: the return says why and how each thing left undone is fixed,
  `stretch explain` and `stretch show`, and every stretch page in the rendered record (T11, spec 9).
- PR 664, merged 12:27Z: `init`'s block names each moment's command; this repo's `CLAUDE.md` names the rule (T7).
- PR 666, merged 13:19Z: `stretch explain failure:<time>`, and the stretch entries of `README.md` and the help
  (T12, T11a).
- T9: the four pages made from the real records and published (the lines of `odd/tasks/visual-pages.md` after
  "T9, 13:25Z"); the 03:06Z stretch's four failures now say why and how they were fixed, each from a notice or commit.
- Done when, checked: each slice's gate passed on its commits (the pre-commit hook) and on GitHub Actions at its land;
  `stretch --help`, `report --help` and `report phase --json` exit 0 (run in this session). `npm run check` was not run
  again on this last, documentation-only commit beyond its pre-commit hook.

## Decisions
- The lead: specs 5-7 and T5e on the board; spec 8, the pages through JH 80's template record (`recordRendered`), with
  no hash gate of this feature's own (T10).
- The lead: T5e (Codex's open P2 on the board's row order) a follow-up outside this brief.
- The lead: the surface widened to one `CLAUDE.md` line (09:11Z, T7) and to the stretch entries of `README.md` and
  the help (11:03Z, T11a).
- The lead: a failure explainable as its own unit (11:00Z, T12).
- This session: the return of the real 03:06Z stretch replaced the scratch-home stretch the done-when planned.

## Failures and lessons
- The lead's 09:11Z answer on T7 sat unread for two hours while the work went on as if T7 still waited; now the
  channel's notices are read before "waits on the lead" is written.
- A stacked slice landed alone at its own tip without a review record of its own (#658); each slice of a stack now
  gets reviews whose range ends at its tip.
- The feature document was edited while Codex read, so that run wrote no record (116,907 input tokens).
- A commit pushed after its ready notice (5f8768c on #666) was left out of the first land; the queue's next run took
  it, and the PR made to carry it (#667) was closed.
- T7's gate refused twice, read each time before the next try: the init template's token budget and `project.mjs`'s
  line ceiling, then the `wording-is-the-need` phrases the rules check reads in `project.mjs`.
- The worktree guard refuses compound shell forms; scripts in the job's tmp and plain commands work.

## Left
- T5e: the board keeps a session's newest row by record order, not by `at` (outside this brief's surface).
- T5f: the merge queue and the pre-push check pass different tips to `reviewCoverage` (outside the surface).
- A failed land's `said` and a failed Codex run's `reason` are dropped by `landFacts` and `codexFacts`
  (`bin/lib/throughput.mjs`, outside the surface); carried, they would explain most such failures without
  `stretch explain`.
- The item `templates` of the 03:06Z stretch has no record saying why the criterion rule is not done.

## Cost
- Time: brief at 2026-10-28T23:49Z, this summary at about 13:30Z the next day; the feature page measures 13 h from
  the first commit to the last merge against 3.5-6.5 h estimated. The host compacted this session several times, the
  last two at 10:54Z and 13:20Z.
- Reviews: 41 Codex runs, 4,804,708 input tokens; the Claude lenses 1,093,107 input tokens, US$ 3 (the feature page);
  gentle-ai on every code slice, each lineage on a line of the feature document.
- No eval spend.

# JH 191 · the workshop's texts name commands that run

## Goal
Make every text that tells a reader to run a workshop command name the form that runs, `node
workshop/js-harness-workshop.mjs <name>`, instead of `js-harness <name>` (the audit's core-03-16, left open by JH 190,
`docs/sessions/2026-11-12-jh-190-the-debts-the-model-switch-left.md`, section Left). Opened by the lead's brief
`~/.js-harness/background/briefs/2026-11-12T13-40-40-809Z-f9aeea28.md`.

## The user's words
None in this session: the work came from the lead's brief, which carries JH 190's summary.

## Delivered
- PR 848 (`fix/workshop-texts-runnable`), merged by the lead's queue at head `030d7e0e`:
  - `ca5a8ab2` fix(workshop): every workshop command's usage, the HOST line and brief steps
    (`workshop/lib/host-watch.mjs`), throughput's DUE and MISSING lines, the idea-watch fix doctor shows, the docs
    row's detail, header comments, `docs/workshop.md` and 6 README lines; the tests that pinned the old words; a new
    test in `workshop/js-harness-workshop.test.mjs`, red on 69 sites before the change.
  - `41fc938a` docs: `docs/ROADMAP.md` rows 81 and 744, `docs/SPEC.md`'s host-watch and idea-watch requirements.
- A follow-up pull request (`fix/workshop-texts-rest`) carries what a wider search found after 848 was ready: the
  search was a grep of the nine workshop names, not followed by `:`, over every file but the dated records. It
  fixed `docs/SPEC.md:979` (`docs plan`, `docs index`), `docs/RECORDS.md` lines 6, 230, 255 and 322, the comment of
  `.github/workflows/windows-daily.yml:3`, the comment of `bin/lib/share-check.mjs:3`, and the idea-watch fixture
  in `bin/doctor.test.mjs:2659,2663`; it corrects this summary's count (69 sites, not 76).
- The claim was checked first: `js-harness host-watch` and `js-harness windows-daily` print "Unknown command";
  `node workshop/js-harness-workshop.mjs host-watch --help` exits 0 with its usage.

## Decisions
- This session: message prefixes (`js-harness host-watch: <error>`) stay; a name followed by `:` is the command naming
  itself, and the test excludes it.
- This session: dated records (`docs/sessions`, `docs/audits`, `docs/host-updates`, `odd/tasks`) keep their words.
- This session: `CLAUDE.md:64,67` and `bin/lib/protocols-skill.mjs:112,115` (`js-harness throughput`) are left: agent
  instructions and a shipped protocol, the owner's to change. Said in the ready notice and the PR.
- This session: `odd/tasks/workshop-product-split.md` is not edited; its slice 4 overlaps (usage texts,
  `docs/workshop.md`), said in the opened notice.

## Failures and lessons
- The first search covered `workshop/`, `bin/` and five documents only, so the ready notice of 848 came before
  SPEC:979, RECORDS.md and the workflow comment were found; the advisor's check before closing asked for the wider
  search. Lesson: run the repo-wide search before the ready notice, not after it.
- The ready notice and PR 848's body said "red on 76 sites"; 76 was the first grep's count with message prefixes,
  and the test was red on 69.
- Rewriting regex literals in tests with `sed` on Git Bash dropped the `\/` escapes twice; the Edit tool fixed them.
  Lesson: escape-sensitive edits go through Edit, not sed.

## Left
- `CLAUDE.md:64,67` and `bin/lib/protocols-skill.mjs:112,115` still name `js-harness throughput`, which a project's
  CLI does not run; the owner's decision, held by the lead.
- The rest of slice 4 of `odd/tasks/workshop-product-split.md` (the shipped inventory, the workshop skill, the
  rehearsal row) stays with that feature.
- Test fixtures that stand for an old line on purpose stay: `bin/loop-bodies.test.mjs:293`,
  `scripts/audit-flags.test.mjs:469`, `bin/lib/spec.test.mjs:141`.
- The lead lands the follow-up pull request.

## Cost
- Time: opened notice 13:44Z, ready notice 13:55Z, 2026-11-12.
- Context: 43% at the ready notice.
- Reviews: one Codex review (gpt-6.1-sol, medium, 57,859 input tokens, 0 findings); lenses readability and
  reliability (about 26k input tokens each, 0 findings).
- Gate runs: two pre-commit gates, both PASS, plus this summary's.
- Advisor: consulted twice, before the edits and before closing.

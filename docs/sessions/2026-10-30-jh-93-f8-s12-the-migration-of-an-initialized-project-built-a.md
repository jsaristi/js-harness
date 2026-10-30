# JH 93 · F8 S12: the migration of an initialized project, built and tested

## Goal
Opened from the lead's brief `briefs/2026-10-30T06-12-57-495Z-28130615.md` (JH ORQ, main at `34ff5c7`): first the
F8 State lines of S11, S5c-a and S13 in `docs/ROADMAP.md` (docs only, 9/19), then S12's building part: the migration
of a project an older release initialized and the read-only gentle-ai scan, test first, proven on a copy in a scratch
home, stopping before any move of his real projects or the project list.

## The user's words
"Your brief is in C:\Users\Oficina\.js-harness\background\briefs\2026-10-30T06-12-57-495Z-28130615.md: read it whole
before anything else, and do the work it gives you. Its last section says how you report." (transcript
`566f950e-3af1-404f-a101-3a1be2923f4e.jsonl`, line 14)

## Delivered
- PR 688, `docs(roadmap): S11, S5c-a and S13 are done`: merged.
- `odd/tasks/f8-s12-migration.md`: the feature document, T1-T5 done, T6 at the chain (its L17).
- `js-harness migrate [--check]` and `migrate list` (`bin/migrate.mjs`, `bin/lib/project-migrate.mjs`): the pin, the
  split (`CLAUDE.md`), the baseline, then `syncProject`; each write recorded so `uninstall project` or git undoes it;
  context7 and gentle-ai's leftovers said read-only. Commits `1488343e`, `abe05fd3`, `5058d55e`, `09ae0126`,
  `3cba3c9f`, `7af9ec25`, `c362110f`, `60fc1295`, `8546b86f`, with the document's records between them.
- `scripts/migration.test.mjs`: v0.97.0's own `init` in a `mktemp -d` home, a copy migrated and uninstalled back to
  the same bytes; green, then red on a planted break (`CLAUDE.md` not recorded), then green (L5).
- The chain of eight pull requests (L17), opened with a ready notice each; the eighth holds this file.
- T4's facts to the lead (02:16 local): one initialized project, `D:\plataforma-preproyecto` (L10).

## Decisions
- D1-D6 (this session, D1 with the lead's yes of 01:21, L2): a new command, the state read rather than the version,
  the split, the pin, the baseline guard, context7 never registered. D7 (this session, on the verifier's finding): the
  baseline is recorded in a clone `sync` set up too. All in the feature document's Decisions.
- The chain's boundaries (this session, L17): eight slices, one over 400 (the command, 404, one unit); the seventh
  was planned at about 380, measured 413 at the push and cut at E.

## Failures and lessons
- `edit-during-review`: the document and the roadmap were edited while Codex read part 3, so it recorded nothing
  (L11); run again on a clean tree. `docs/FAILURES.md` has the `- Seen:` line; since then the records are committed
  before a review starts.
- CI on the first stage (L7) and commit C's gate (L8) asked for the spec row, a README section and gentle-ai-absence's
  named list: each was added and named to the lead.
- Reviews found real defects: the lenses one (L9), Codex seven (L12), the verifier four (L13), gentle-ai three (L14),
  Codex one more (L15), gentle-ai one on the scan (L17). Each was fixed with a test red first.
- The gentle-ai flow script read the consent envelope with a regex on key order and missed the granted choice; it now
  walks the JSON (the job's tmp, not shipped).

## Left
- His project list and every move of a real project: his (the roadmap's "His decisions").
- Owed tests: a positive control in the exclude-file test (L16); the tracked `.atl/` branch, `cwdOf`'s failure paths
  and the folder-listing guard (L17).
- Open, told to the lead: through a `CLAUDE.md` link to `AGENTS.md`, sync renders `AGENTS.md`'s half only
  (`bin/lib/project.mjs:1858-1860`, L13).
- The installed copy is not refreshed: the lead lands and refreshes.

## Cost
- Time: brief at 06:12Z, this file at about 08:55Z; one compaction by the host (03:18 local).
- Codex: 9 runs, about 1,327,851 input tokens (L11-L17). The Claude lenses: 6 runs, about 336,000 input tokens. The
  independent verifier: 149,704 tokens. gentle-ai: 5 reviews, all approved and acknowledged. All on his Max plan.
- Gate: `npm run check` on every commit (the pre-commit hook), green on each that landed.

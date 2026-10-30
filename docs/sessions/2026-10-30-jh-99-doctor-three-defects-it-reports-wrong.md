# JH 99 · doctor: three defects it reports wrong

## Goal
Opened from the lead's brief `briefs/2026-10-30T14-31-10-145Z-c2c640e2.md` (main at `65483fc5`): fix three doctor
defects test first, one commit each, on branch `fix-doctor-rows` with the feature document `odd/tasks/doctor-rows.md`:
claude-account `unknown` on the moved app folder, engram-plugin's `unknown` up-to-date cell, and the two review flags
in one call recording one review.

## The user's words
"Your brief is in C:\Users\Oficina\.js-harness\background\briefs\2026-10-30T14-31-10-145Z-c2c640e2.md: read it whole
before anything else, and do the work it gives you. Its last section says how you report." (this session's first
user message). The brief's items, quoted, are S1-S3 of `odd/tasks/doctor-rows.md`.

## Delivered
- `odd/tasks/doctor-rows.md`: contract, S1-S3, T1-T4 all ticked, `## Engram plugin`, L1-L11.
- `b49d54a7` fix(doctor): `claudeAccountState` (`bin/lib/stack.mjs`) reads the app config from `desktopDir` with an
  empty env. Red 1 of 8, then green 112 of 112 (L3). On his machine the branch reads `ok` and the installed copy
  `unknown` (L4).
- `324690ae` fix(doctor): engram-plugin's fix for a clone without the binary's tag is
  `git -C <clone> fetch --depth 1 origin tag v<binary>`. Red 1 of 14, then green 236 of 236 across latest, stack and
  doctor (L6). A real-git test proves the step on a shallow clone with no tags.
- `ec566960` fix(doctor): `recordReviews` records both reviews when both flags are given. Red 2 of 9, then green
  95 of 95 (L10).
- `8ede9725` docs(doctor-rows): the reviews (L11).
- PR 702 (`fix-doctor-rows`): open, ready notice sent.

## Decisions
- This session's, within the plan: L5 (`desktopDir` called with an empty env, so AppData sits under the given home)
  and L9 (record both reviews rather than refuse the pair; `--json` prints `{ host, stack }` for the pair).
- The engram cell stays `unknown`, as D2 of `odd/tasks/engram-plugin-lag.md` decided (no network read), and gets a
  fix that tells. Whether to add a network read at the tag is the lead's call (`## Engram plugin`).
- The branch was renamed from `worktree-fix-doctor-rows`.

## Failures and lessons
- Cause found, read only: Claude Code re-cloned `~/.claude/plugins/marketplaces/engram` on 2026-10-27 23:13 (-05:00)
  shallow, main only, with no tags (`shallow`, `config` fetch refspec, `packed-refs`; L2). That broke the premise of
  D2 ("Claude Code fetches that clone with its tags"). Nothing in the harness watched that premise. The new fix text
  and the real-git test now name the shape.
- The worktree guard refused scripts that name git with a path outside the worktree. Files were read with Read and
  Grep instead, and tests were edited with Edit.

## Left
- README names `js-harness doctor --gentle-ai-reviewed`, which doctor's `KNOWN` no longer takes (L8): the lead's.
- A network read for the engram plugin's latest version: the lead's (`## Engram plugin`).
- The fetch step on his clone: his to run. Not run here.
- Text-mode doctor prints no fix for an `unknown` cell (`rowGaps`), so the engram step shows only in `--json`.

## Cost
- Time: brief at 14:31Z, this summary at about 14:57Z.
- Reviews: Codex once, 118,679 input tokens, correct (0.88). The Claude lenses risk, reliability, readability and
  resilience once each, 0 findings (13,756 + 13,754 + 28,247 + 28,207 input tokens). gentle-ai: status only, nothing
  started.
- Gates: four pre-commit runs of `npm run check`, all PASS, and one pre-push run, PASS.

# JH 95 · sync and init: the CLAUDE.md that loses or lacks its half

## Goal
Opened from the lead's brief `briefs/2026-10-30T10-39-06-705Z-2662d15c.md` (main at `3ad7ad8c`): fix the two defects
S12 found in how a project's `CLAUDE.md` gets the harness's block, test first, on branch `fix-claude-md-block`, one
PR: sync through a `CLAUDE.md` linked to `AGENTS.md` (`odd/tasks/f8-s12-migration.md`, L13) and `init` keeping a
project's own `CLAUDE.md` without the import (same document, L22).

## The user's words
"Your brief is in C:\Users\Oficina\.js-harness\background\briefs\2026-10-30T10-39-06-705Z-2662d15c.md: read it whole
before anything else, and do the work it gives you. Its last section says how you report." (this session's first
user message). The brief's items, quoted, are S1-S3 of `odd/tasks/claude-md-block.md`.

## Delivered
- `odd/tasks/claude-md-block.md`: contract, S1-S3, T1-T3, D1-D2, L1-L6; `contract check` PASS.
- `3d5972be` fix(sync): a `CLAUDE.md` that is a link is no split, so `AGENTS.md` keeps the whole block; the
  migration's plan reads it the same way (L2).
- `00afb013` fix(init): `init` adds `@AGENTS.md` at the top of a project's own `CLAUDE.md` beside the `AGENTS.md` it
  writes, in the file's line ends and after a byte order mark, and says the line where git could not give the file
  back; `init` prints `added @AGENTS.md at the top of CLAUDE.md; git checkout -- CLAUDE.md takes it back` (L3).
- `cabbacbc` fix(init): the verifier's findings: the write needs the name git tracks, no skip flag and the bytes a
  checkout of the index writes (`git cat-file --filters`); one file under both names (a link either way, or a hard
  link) keeps the whole block in sync, the migration's plan and doctor's `claude-import` row (L5).
- The pull request of this branch: open, ready notice sent with it.

## Decisions
- This session's, as the brief allowed: D1 (a linked `CLAUDE.md` is no split; one file under both names keeps the
  whole block) and D2 (`init` writes the import only where git gives the file back byte for byte, else a `skip`
  naming the line), both in `odd/tasks/claude-md-block.md`. The migration keeps S12's D3 (a note, never a write).
- This session's: the doctor row over one file under two names was taken in scope (one condition,
  `bin/lib/claude-import.mjs`), being the same class; the branch was renamed from `worktree-fix-claude-md-block`.

## Failures and lessons
- My first check before the write, an empty `git status`, proved nothing on a case-insensitive file system, under
  `core.autocrlf=true` or for a skip-worktree change; the independent verifier reproduced each in a scratch repo, and
  E fixed them with tests red first (L5). Inside the task, so no `docs/FAILURES.md` line (its preamble).
- The first commit of T1 was refused by its gate on GitHub's Linux: the migration's link test, which skips here,
  expected a render the fix removes (L2). Symlinks need privileges on this machine: the hard-link tests run here, the
  symlink ones on CI only.

## Left
- Untested: an ignored file and a UTF-16 file through `init` (only `withImport`'s `null` is), L5.
- Not this session's: the owed tests of S12's L16 and L17; the session probe in his two projects (S12's L23).
- His projects were not touched; `D:\abogadaclaudiajimenez` keeps the hand-added line of S12's L22.

## Cost
- Time: brief at 10:39Z, this summary at about 11:30Z; context share not read at the end.
- Reviews: Codex twice (78,276 and 85,188 input tokens, both correct 0.88); the lenses risk, reliability and
  resilience twice, no finding (63,690 and 62,215 input tokens); the independent verifier once (opus, 90,341 tokens).
- Gates: five pre-commit runs of `npm run check`, their tests on GitHub's Linux (one refused, L2).

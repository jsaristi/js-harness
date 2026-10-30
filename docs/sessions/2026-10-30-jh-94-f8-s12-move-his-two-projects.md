# JH 94 · F8 S12: move his two projects

## Goal
Opened from the lead's brief `briefs/2026-10-30T10-06-04-385Z-3c0af323.md` (JH ORQ, main at `297efbcd`): move the two
projects of his answer to question 112 to the new harness with the installed `js-harness` (0.97.0), one at a time,
each with its dry form first, its exact undo written and `doctor` after; record it on branch `f8-s12-moves`, docs
only, one PR.

## The user's words
"Your brief is in C:\Users\Oficina\.js-harness\background\briefs\2026-10-30T10-06-04-385Z-3c0af323.md: read it whole
before anything else, and do the work it gives you. Its last section says how you report." (transcript
`6fbd7de8-c7d9-4ba7-83d3-440b4c8198d1.jsonl`, line 14). His decision the brief carries: "Ambos proyectos" (question
112, transcript `0f71b2c6-cbce-43ca-a031-276a4b2c381f`, line 28102).

## Delivered
- `D:\plataforma-preproyecto`: `migrate --check` (exit 1, six writes named), then `migrate` (exit 0): `CLAUDE.md`
  importing `AGENTS.md`, the baseline 2026-10-30, the style and 24 denies in `.claude/settings.local.json`, the
  `.atl/` exclude line, `AGENTS.md`'s block rendered again. `doctor` inside it exit 0, `claude-import` ok. Log L20.
- `D:\abogadaclaudiajimenez`: `init` (exit 0, its own `CLAUDE.md` kept, the whole block in a new `AGENTS.md`), then
  `migrate --check` (nothing left to write but a note: its `CLAUDE.md` does not import `AGENTS.md`); on the lead's
  yes the line `@AGENTS.md` prepended. `doctor` inside it exit 0, `claude-import` ok. Log L21, L22.
- Nothing committed, stashed or reset in either project; each project's changes stay uncommitted for him (L23).
- `odd/tasks/f8-s12-migration.md`: T7 and T8 done, L19-L23 with each command, its output and the exact undo.
- `docs/ROADMAP.md`: S12's State line reads done.
- PR 697 (`f8-s12-moves`, docs only): open, with its ready notice.

## Decisions
- His: both projects move, `D:\harness` stays (question 112, L19).
- The lead's: add `@AGENTS.md` at the top of `D:\abogadaclaudiajimenez\CLAUDE.md`, uncommitted, and record that
  `init` leaves the import out as an owed finding (L22, answering this session's `waiting` notice of 10:10Z).
- This session's: `init` has no dry form, so its plan was read in the code before the write (L21); the branch was
  renamed from `worktree-f8-s12-moves` to the brief's `f8-s12-moves`.

## Failures and lessons
- A finding, not this session's to fix: `init` keeps a project's own `CLAUDE.md` that lacks the import, so doctor's
  `claude-import` row is red right after `init` (L22). Found by `migrate --check`'s note and doctor's row.
- The worktree guard refused `git` run against his projects inside a compound command; plain `git -C <project>`
  commands, one per call, ran.

## Left
- The owed finding of L22 (a follow-up session); the session probe in each project, a new session showing its
  `CLAUDE.md`, the style and context7 (L23); his commits of the changes in both projects.
- Open and his, outside the projects: `codex-trust` (answer Codex's hook prompt), `host-update`, `typescript-lsp` and
  `codex` outdated, four stale memory notes of `abogadaclaudiajimenez` (L21). Context7's OAuth in Codex stays open,
  never started.
- Not this session's: L13's sync symlink defect; the owed tests of L16 and L17.

## Cost
- Time: brief at 10:06Z, this file at about 10:30Z; context share at the end about 30%.
- No review: the branch is docs only. Gate: `npm run check` through the pre-commit hook on each commit.

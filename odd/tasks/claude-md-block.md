# The CLAUDE.md that loses or lacks its half of the harness's block

Locator: `odd/tasks/claude-md-block.md` · Engram mirror: `odd/claude-md-block/tasks` · Branch: `fix-claude-md-block`
Delivery: one pull request, a chain if it outgrows its reviews · Test runner: `node --test`

## Goal
Through a `CLAUDE.md` that is a link `sync` keeps every line of the harness's block where Claude and a reviewer both
read it, and `init` on a project with its own `CLAUDE.md` leaves doctor's `claude-import` row ok.

## Why
S12 found both while moving his two projects (`odd/tasks/f8-s12-migration.md`, L13 and L22): through a `CLAUDE.md`
linked to `AGENTS.md`, sync renders `AGENTS.md` with the reviewer's half alone, so Claude loses its half; and `init`
kept `D:\abogadaclaudiajimenez`'s own `CLAUDE.md` without the import, so Claude loaded none of the harness's lines
until `@AGENTS.md` was prepended by hand.

## Done when
- `node --test bin/lib/project.test.mjs bin/lib/claude-import.test.mjs bin/lib/project-migrate.test.mjs bin/init.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/claude-md-block.md` exits 0
- `npm run check` exits 0
- each defect has a test that was red before its fix and green after it, named in `## Log`

## In scope / Out of scope
- In: `bin/lib/project.mjs` (it may not grow: `bin/conventions-structure.test.mjs`, its ceiling of 1,990 lines),
  `bin/lib/claude-import.mjs`, `bin/lib/project-migrate.mjs` (the plan reads the split as sync does), `bin/init.mjs`
  (the new action's line), their tests, this document, `docs/FAILURES.md`, the session's summary under `docs/sessions/`.
- Out: any real project and the real home; `~/.claude`, `~/.codex`, gentle-ai's config, credentials; doctor's
  reading of a `CLAUDE.md` that is a link; the migration's own handling of an own `CLAUDE.md` (D3 of S12: a note).

## Constraints
- Every write runs on a copy in a scratch home or repository from `mktemp -d`, never a real project or the real
  home — because both commands write into projects (high risk, item 1: a project's own committed file).
- `init` writes a project's own `CLAUDE.md` only where git can give it back exactly: tracked, with no change git has
  not committed, and a regular file — because nothing records the write but git.
- Symlinks need privileges on this machine (EPERM): a test that makes a real link skips here and runs on CI's Linux;
  each defect also has a test that runs here, through the injected `lstat`.

## Ask me before
- Nothing of his is touched: no real project, no host config.

## Specs
- S1 (the lead's brief `briefs/2026-10-30T10-39-06-705Z-2662d15c.md`, item 1): "with CLAUDE.md a symlink to
  AGENTS.md (a common convention), sync reads the block mark through the link and renders AGENTS.md with the
  reviewer's half only, so Claude loses its half. Symlinks need privileges on this machine (EPERM): the link test
  skips here and runs on CI; say which runs where."
- S2 (same, item 2): "Make init leave claude-import green on a project with its own CLAUDE.md; the file is
  committed, so git undoes the write. If the right fix is not that (for instance init should only say the step),
  write why in the feature document, take it as the lead's call within the plan, and go on."
- S3 (same): "Done when: both defects have a failing-then-passing test and the PR is ready."

## Tasks
- [ ] T1 (kind: build) sync: a `CLAUDE.md` that is a link is no split, so `AGENTS.md` keeps the whole block; the
  migration's plan reads it the same way — S1; inline, test first
- [ ] T2 (kind: build) init: the import prepended to a project's own `CLAUDE.md` git can give back, the step said
  where it cannot — S2; inline, test first
- [ ] T3 (kind: verify) Codex and the lenses on each code commit, the independent verifier over the range (high
  risk, item 1); `npm run check`; PR, ready notice, summary — S3

## Decisions
- D1, the split through a link: a `CLAUDE.md` that is a link is never the split's other half. Sync never writes
  through a link (`blockFileOf`), so it cannot hold Claude's half for sync; read through it, a link to `AGENTS.md`
  shows `AGENTS.md`'s own block, and splitting then drops Claude's half. With no split `AGENTS.md` keeps the whole
  block, which loses no line whatever the link points to; a link to another file that holds Claude's half then has
  those lines twice, a cost in tokens, not a lost line.
- D2, the import: `init` writes it, as S2 asks, only where it also writes `AGENTS.md` (the harness's lines are then
  only there) and git can give the file back; elsewhere, an untracked or changed file or a link, it says the step,
  with the line to add, as a `skip`. The migration keeps D3 of S12 (a note): changing it is outside this brief.

## Log
- L1 (2026-10-30, the lead's brief, as written): "Two defects S12 found, both in how a project's CLAUDE.md gets the
  harness's block. Code, test first, worktree branch `fix-claude-md-block`, one PR (or a chain if it outgrows its
  reviews)." Its items are S1-S3.

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
- Out: any real project and the real home; `~/.claude`, `~/.codex`, gentle-ai's config, credentials; the migration's
  own handling of an own `CLAUDE.md` (D3 of S12: a note).

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
- [x] T1 (kind: build) sync: a `CLAUDE.md` that is a link is no split, so `AGENTS.md` keeps the whole block; the
  migration's plan reads it the same way — S1; inline, test first; commit `3d5972be`, the other direction in E (L5)
- [x] T2 (kind: build) init: the import prepended to a project's own `CLAUDE.md` git can give back, the step said
  where it cannot — S2; inline, test first; commit `00afb013`, the verifier's fixes in E (L5)
- [ ] T3 (kind: verify) Codex and the lenses on each code commit, the independent verifier over the range (high
  risk, item 1); `npm run check`; PR, ready notice, summary — S3

## Decisions
- D1, the split through a link: a `CLAUDE.md` that is a link is never the split's other half. Sync never writes
  through a link (`blockFileOf`), so it cannot hold Claude's half for sync; read through it, a link to `AGENTS.md`
  shows `AGENTS.md`'s own block, and splitting then drops Claude's half. With no split `AGENTS.md` keeps the whole
  block, which loses no line whatever the link points to; a link to another file that holds Claude's half then has
  those lines twice, a cost in tokens, not a lost line. The same loss runs the other way (the verifier, L5): one file
  under both names, `AGENTS.md` a link to `CLAUDE.md` or a hard link, got Claude's half alone. One file (`oneFile`,
  the same `dev` and `ino`) keeps the whole block under the name that is no link, the migration's plan reads it so,
  and doctor's `claude-import` row reads it as loaded, since Claude reads it as it is.
- D2, the import: `init` writes it, as S2 asks, only where it also writes `AGENTS.md` (the harness's lines are then
  only there) and git can give the file back byte for byte: the name git tracks, no skip flag, and the bytes a checkout
  of the index writes (`git cat-file --filters`), not an empty `status` (L5). Elsewhere, an untracked or changed file
  or a link, it says the step, with the line to add, as a `skip`. The migration keeps D3 of S12 (a note): changing it
  is outside this brief. `uninstall project` leaves the line; `git checkout -- CLAUDE.md` takes it back, as init says.

## Log
- L1 (2026-10-30, the lead's brief, as written): "Two defects S12 found, both in how a project's CLAUDE.md gets the
  harness's block. Code, test first, worktree branch `fix-claude-md-block`, one PR (or a chain if it outgrows its
  reviews)." Its items are S1-S3.
- L2 (2026-10-30, T1, commit `3d5972be`): `syncProject reads CLAUDE.md with lstat, so a link is no split` was red
  before the fix (`node --test --test-name-pattern=...`: the actions held `kept CLAUDE.md` and `AGENTS.md` got the
  reviewer's half) and green after. Its twin with a real link skips here (EPERM) and runs on CI's Linux; whether it
  was red there before the fix was not run. The first commit's gate, whose tests run on GitHub's Linux, failed
  `bin/lib/project-migrate.test.mjs:472`: through the link sync now renders nothing, so the test's second commit found
  nothing to commit; the test now asserts `AGENTS.md` left as it was, and the second gate passed.
- L3 (2026-10-30, T2, commit `00afb013`): before the fix four tests were red (`claude-import.test.mjs`: no export
  `withImport`; the own-`CLAUDE.md` test expecting the `skip`; the committed import; the changed file), green after,
  with the refused write and `init`'s printed line. The gate passed. `bin/lib/project.mjs` holds 1,990 lines, its
  ceiling: the helper lives in `bin/lib/claude-import.mjs`, beside the check it makes true.
- L4 (2026-10-30, T3): the lenses risk, reliability and resilience over `3ad7ad8..00afb01`, no finding (63,690 input
  and 2,931 output tokens, his Max plan); Codex over `390034c..00afb01`, correct (0.88; 78,276 input tokens, 48,000
  cached).
- L5 (2026-10-30): the independent verifier (a read-only sub-agent on opus, over `3ad7ad8c..00afb013`, 90,341 tokens)
  found `3d5972be` correct and two defects in `00afb013`, both reproduced in a scratch repository: an empty `git
  status -- CLAUDE.md` proves nothing on a file system that does not tell case apart (a `claude.md` git tracks or does
  not know was written, and `git checkout -- CLAUDE.md` then fails), nor under `core.autocrlf=true` (a working copy in
  LF was written, and git gave it back in CRLF), nor for a skip-worktree change. It also named the other direction of
  D1 and two untested branches (`addImport`'s links; an ignored or UTF-16 file through init). Fixed in commit E, tests
  red first: the autocrlf and skip-worktree test and the case test (it skips where the file system tells the names
  apart) were red, so were the hard-link sync test and doctor's row over a hard link; the link tests (`addImport`'s two
  links, `AGENTS.md` a link to `CLAUDE.md`) skip here and run on CI's Linux; the migration's hard-link test was written
  with the fix, not run red. Not taken: an ignored file and UTF-16 through init stay untested (`withImport`'s `null` is).
- L6 (2026-10-30): reviews of E (`00afb01..cabbacb`): the lenses risk, reliability and resilience, no finding (62,215
  input and 3,493 output tokens); Codex correct (0.88; 85,188 input tokens, 42,496 cached). E's gate passed, its tests
  on GitHub's Linux, where the link tests run. No `docs/FAILURES.md` line: the verifier is a control inside the task
  and caught the defect before any pull request, which the register's preamble says is not a failure. No gentle-ai
  review was run: Codex and the lenses cover every code commit (CLAUDE.md, "Running what costs, and review").

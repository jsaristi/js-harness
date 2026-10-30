# F8 S12: the migration of an initialized project

Locator: `odd/tasks/f8-s12-migration.md` · Engram mirror: `odd/f8-s12-migration/tasks` · Branch: `f8-s12-migration`
Delivery: pull requests, a chain if it passes 400 lines · Test runner: `node --test`

## Goal
`js-harness migrate` brings a project an older release initialized to what this copy's `init` writes, keeps every
edit of the project's, records each write so `uninstall project` or git undoes exactly it, and says read-only what
gentle-ai left there; `migrate list` names the projects the move list is chosen from.

## Why
Neither `update` nor a second `init` refreshes an initialized project (`docs/ROADMAP.md`, S12), and S2 removes
gentle-ai only after his listed projects moved. The roadmap's order puts S12 after S13's rehearsal and before S2.

## Done when
- `node --test bin/lib/project-migrate.test.mjs bin/migrate.test.mjs scripts/migration.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/f8-s12-migration.md` exits 0
- `npm run check` exits 0
- `scripts/migration.test.mjs` migrates a copy of a project v0.97.0's own `init` set up, in a scratch home, and fails
  on a planted break in the migration; `## Log` names both runs
- the lead has the list question's facts: what `migrate list` finds, read-only, on his machine

## In scope / Out of scope
- In: `bin/lib/project-migrate.mjs` and its test, `bin/migrate.mjs` and its test, `bin/js-harness.mjs` (the
  command's entry and help line, the lead's yes of 2026-10-30 01:21), `bin/lib/project.mjs` (exports only: it may
  not grow), `scripts/migration.test.mjs`, this document, S12's line of `docs/ROADMAP.md`, `docs/FAILURES.md`, the
  session's summary under `docs/sessions/`.
- Out: moving any of his real projects and freezing the list (his decision); install, uninstall and the manifest
  format; `~/.claude`, `~/.codex`, gentle-ai's config, credentials; the installed copy (the lead refreshes it).

## Constraints
- Every write runs on a copy in a scratch home from `mktemp -d`, never a real project or the real home — because
  it writes into projects (high risk).
- The migration writes nothing outside the project, as `init` writes nothing outside it (`bin/init.mjs:156`):
  context7 is said with its fix, never registered — because `~/.claude.json` is his host's config.
- A committed file it changes must have no uncommitted change before it, so git undoes the write exactly.
- `bin/lib/project.mjs` does not grow (`bin/conventions-structure.test.mjs`, the 1,000-line ceiling).

## Ask me before
- Any move of a real project, and the project list (the roadmap's "His decisions").

## Specs
- S1 (ROADMAP, S12, Changes): "a migration of an initialized project, which reads the version its manifest
  recorded, writes what later versions add (the split, context7, the deny list, the two-review pre-push check,
  directive coverage's baseline), keeps his edits and records each write".
- S2 (same): "a read-only scan of what gentle-ai left in a project (`.atl/`, its review store)".
- S3 (same): "The migration builds on `sync` for those and adds what it does not do: the split in a project without
  it, context7, the baseline, and a project whose manifest an old release wrote."
- S4 (ROADMAP, S12, Probe and pass): "the migration on a copy of a project initialized by an old release keeps his
  edits and records each write".
- S5 (reverse-engineering document, 11.2): "keeps his edits (a file he changed is merged or left with a note, never
  overwritten) and records each write so `uninstall project` undoes exactly it".
- S6 (reverse-engineering document, 14.3): "S12's migration writes nothing into the project's list. It records the
  project's baseline date in the harness's own record of the project".
- S7 (the brief): "stop at a built and tested migration and notify the lead with what the list question needs
  (which projects the scan finds: a manifest or a Claude Code session in the last 30 days, read-only)".
- S8 (S13's State, owed to S12): "Codex's `mcp add` of context7 opens its OAuth login in a browser and outlives
  the run".

## Tasks
- [ ] T1 (kind: build) `bin/lib/project-migrate.mjs`: the plan (read-only) and the writes: the pin, the split,
  the baseline, then `syncProject`; context7 and gentle-ai said read-only — S1-S6; inline, test first
- [ ] T2 (kind: build) `bin/migrate.mjs` and its entry: `migrate`, `migrate --check`, `migrate list` — S1, S2, S7;
  inline, test first
- [ ] T3 (kind: verify) `scripts/migration.test.mjs`: v0.97.0's `init` in a scratch home, a copy with his edits,
  `migrate`, `uninstall project` back to the bytes; green, then red on a planted break — S4, S5
- [ ] T4 (kind: verify) `migrate list` read-only on his machine, its facts to the lead — S7
- [ ] T5 (kind: docs) S8: what the walk owes about context7's OAuth in Codex, recorded — S8
- [ ] T6 (kind: verify) Codex and the lenses on every code commit, gentle-ai lines, the independent verifier over
  the range; PRs, ready notices, summary

## Decisions
- D1 (2026-10-30, this session): a new command `js-harness migrate`, not a second `init` nor a `sync` flag: a second
  `init` writing would change what a command already does, and `sync` sets up clones, where creating a committed
  `CLAUDE.md` is no clone's to do. The lead said yes to the command and to the new module (L2).
- D2: what is missing is read from the project's state, never from the version alone: v0.97.0, the release his one
  initialized project pins, is also this copy's version (`package.json` 0.97.0), yet its `init` wrote no `CLAUDE.md`,
  no style, no denies and no baseline (`git show v0.97.0:bin/lib/project.mjs`, L3).
- D3, the split: with no `CLAUDE.md` and an `AGENTS.md` that is a file, the migration writes `CLAUDE.md` and records
  it, and `sync` then renders `AGENTS.md`'s half; when `AGENTS.md`'s block was edited, `CLAUDE.md` holds the import
  alone, so no line is said twice; a `CLAUDE.md` of the project's is never written, and one that does not import
  `AGENTS.md` is a note naming the line. A missing `AGENTS.md` is a note: a deleted file is an edit.
- D4, the pin: a pin older than this copy's is moved in place, only the bytes of its value; the record of
  `harness.json` follows the new bytes only when the file was still the bytes `init` wrote.
- D5, the baseline: recorded only where it adds no finding to `rules check`. Today a baseline makes every live rule
  without a control a finding (`bin/lib/project-rules.mjs:55`), which 14.3's "refuses only gaps opened after the
  baseline" does not say; a project whose list has such a rule gets a note naming them, not a red gate.
- D6, context7: said with doctor's own row and fix (`bin/lib/stack.mjs`, the context7 tool), never registered.

## Log
- L1 (2026-10-30, the lead's brief `briefs/2026-10-30T06-12-57-495Z-28130615.md`): "Then S12's building part, its
  feature document `odd/tasks/f8-s12-migration.md` opened before the first source write ... Build the migration (on
  `sync`'s updateRecorded, as the block says) and the read-only gentle-ai scan, test first, and prove it on a copy
  of a project initialized by an old release, in a scratch home from `mktemp -d`, with S13's rehearsal harness
  (scripts/rehearsal.mjs) where it fits. Not yours: moving any of his real projects, and the project list."
- L2 (2026-10-30 01:21, the lead's note in the channel): "yes to both: bin/lib/project-migrate.mjs with its test,
  and the js-harness migrate entry and help line in bin/js-harness.mjs".
- L3 (2026-10-30, read-only): the releases are v0.9.0, v0.95.0, v0.96.0 and v0.97.0 (`git tag`); v0.97.0's `init`
  writes `AGENTS.md` with the whole block, `docs/FAILURES.md`, the pre-commit gate, the pre-push check where the
  Codex review is on, and settings of format 1; no `CLAUDE.md`, no `.atl/` exclude, no style, no denies, no
  baseline. A read-only scan of `~/.claude/projects` (sessions of the last 30 days) found one initialized project,
  `D:\plataforma-preproyecto`: pin 0.97.0, manifest format 1, `AGENTS.md` with an unedited block, no `CLAUDE.md`,
  `.atl/` untracked.
- L4 (2026-10-30): PR 688, docs only: S11, S5c-a and S13 State lines read done; the roadmap parser counts the F8 plan
  9/19 on that branch (`planOf` + `planShare` over `docs/ROADMAP.md`); the installed `report` reads the default
  branch, so it prints 9/19 once 688 lands.

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
- [x] T1 (kind: build) `bin/lib/project-migrate.mjs`: the plan (read-only) and the writes: the pin, the split,
  the baseline, then `syncProject`; context7 and gentle-ai said read-only — S1-S6; inline, test first; commits
  `1488343e` (scans), `abe05fd3` (plan), `5058d55e` (writes)
- [x] T2 (kind: build) `bin/migrate.mjs` and its entry: `migrate`, `migrate --check`, `migrate list` — S1, S2, S7;
  inline, test first; commit `09ae0126`
- [x] T3 (kind: verify) `scripts/migration.test.mjs`: v0.97.0's `init` in a scratch home, a copy with his edits,
  `migrate`, `uninstall project` back to the bytes; green, then red on a planted break — S4, S5; commit `09ae0126`, L5
- [x] T4 (kind: verify) `migrate list` read-only on his machine, its facts to the lead — S7; sent 2026-10-30 02:16
  local: one initialized project, `D:\plataforma-preproyecto` (L3, L10)
- [x] T5 (kind: docs) S8: what the walk owes about context7's OAuth in Codex, recorded — S8; the migration never
  runs `codex mcp add`: context7's Codex gap is said with doctor's fix, which warns that it opens context7's sign-in
  in a browser (`context7Gaps`, its test asserts the warning), so no run of migrate can leave a login open
- [x] T6 (kind: verify) Codex and the lenses on every code commit, gentle-ai lines, the independent verifier over
  the range; PRs, ready notices, summary — L9-L18; PRs 689, 693-696
- [x] T7 (kind: verify) move `D:\plataforma-preproyecto`: `migrate --check`, then `migrate`, `doctor` inside it —
  his decision of question 112; L19, L20; branch `f8-s12-moves`
- [x] T8 (kind: verify) move `D:\abogadaclaudiajimenez`: `init`, `migrate --check`, the import line, `doctor`
  inside it — his decision of question 112; L19, L21-L23

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
- D7 (this session, on the verifier's L13): the baseline is recorded in a clone `sync` set up too, where `init` never
  records one (`bin/lib/project.mjs:903-905`): the manifest does not mark a clone (only `writeProject`'s argument
  does, `:1844`), so the two cannot be told apart, and D5's guard keeps the baseline from adding a finding.

## Next step
State at 2026-10-30 ~10:25Z (JH 94, branch `f8-s12-moves`, docs only): both projects moved, doctor exit 0 inside
each with `claude-import` ok (L20-L23); S12's State line reads done. Owed after S12: the finding of L22 (`init` with
an own `CLAUDE.md` leaves the import out), the session probe in each project (L23), the owed tests of L16 and L17,
and L13's sync symlink defect (its own session).

State at 2026-10-30 ~08:50Z (branch `f8-s12-migration`, code through H `8546b86f`, nothing pushed). Every code
commit has Codex, the lenses and a gentle-ai line (L9-L17); the verifier ran over `24c47ca..9af1aac` (L13). The
chain of L18 is open, PRs 689, 693, 694, 695 and 696, each with a ready notice, for the lead to land in order; the
summary is under docs/sessions/. Left for S12 after this session: his project list and the moves (his), and the
owed tests of L16 and L17.

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
- L5 (2026-10-30): `node --test scripts/migration.test.mjs` green: v0.97.0's own `init` (read from the tag through a
  separate index) set a scratch project up in a `mktemp -d` home; a copy migrated by this branch kept the project's
  line in AGENTS.md and its own settings key, got CLAUDE.md, the style, the denies and the baseline, doctor's
  claude-import row read ok, and `migrate --check` then exited 0; after `uninstall project` on both copies and git on
  the files migrate named, the two copies were the same bytes. Planted break (CLAUDE.md not recorded in the
  manifest): the same test red, "the record names the CLAUDE.md the migration wrote"; restored, green.
- L6 (2026-10-30): the tests found two defects, fixed: `--check` read an empty `uncommitted` list as a refusal; a
  session file written a moment ago aged -1 day (`Math.max(0, …)`, and a test of it).
- L7 (2026-10-30): CI on stage A: the scratch repos' pre-commit hook calls `js-harness`, absent on CI's PATH, and
  `gentle-ai-absence.test.mjs` requires the new files on its named list.
- L8 (2026-10-30): commit C's gate asked three more, each named to the lead in a note: `docs/SPEC.md`'s spec row
  needs a capability to claim `js-harness migrate` (Project init's Requirement, Proof and Today lines take it);
  `bin/readme.test.mjs` needs a README section for each command (one after sync's); gentle-ai-absence's named list
  takes `bin/migrate.mjs`.
- L9 (2026-10-30): the four lenses over `24c47ca..09ae012` (sonnet, about 165,000 input and 7,400 output tokens in
  all, his Max plan) found one defect, the same in each: the undo reversed its list in place, then named a step it
  could not take back by comparing it with the list's first item, so the message named the other file.
- L10 (2026-10-30, T4, read-only): `migrate list` on his machine lists one initialized project,
  `D:\plataforma-preproyecto` (pin 0.97.0, newest session 6 days ago), and, not initialized, `D:\abogadaclaudiajimenez`
  (2 days), `D:\harness` (8 days, a read-only reference), `D:\js-harness` (0 days) and a job's scratch folder. It
  also listed six folders under `D:\js-harness\.claude\worktrees\` as their own: they are no longer linked worktrees
  (`git rev-parse --git-dir` equals the common dir), so git reads them as folders of the main checkout; the scan now
  reads such a folder as its top level.
- L11 (2026-10-30): Codex over `24c47ca..09ae012` (gpt-6.1-sol, medium): parts 1 and 2 passed (296,217 and 66,927
  input tokens); part 3 passed too (226,291) but wrote no record, since this document and `docs/ROADMAP.md` were
  edited in the worktree while it read (`edit-during-review`, its seventh sighting in `docs/FAILURES.md`). The edits
  were set aside in the job's `tmp\next\` and part 3 run again on a clean tree (302,689 input tokens); recorded.
- L12 (2026-10-30): Codex's seven findings over `24c47ca..09ae012`, each checked in the code and fixed in commit D
  with a test that was red first: (P1) a `harness.json` that is a link had its pin moved through it, changing a target
  git cannot give back: refused; (P2) the undo was registered after its write, so a write that failed halfway stayed:
  registered before; (P2) `--check` said nothing to migrate where sync would still repair a recorded gate that is gone
  or the `.atl/` exclude record: the plan names them; (P2) an `AGENTS.md` git ignores passed the uncommitted check:
  `git status --ignored`; (P2) a `harness.json` checked out with CRLF read as edited, so the record kept the old hash
  and `uninstall project` kept the file: read as init's with `matchesRecordedHash`; (P2) a failure in sync's part
  said "nothing was left behind" though the migration's writes stay: it names them; (P2) the scripts proof expected no
  pin move, which fails at the next version: the expectation follows the running version. With L9's undo names and
  L10's scan, commit D holds nine fixes. The link test skips on this machine (symlinks need privileges) and runs on
  CI's Linux.
- L13 (2026-10-30): reviews of D (`09ae012..9af1aac`): Codex, the seven findings fixed, the patch correct (79,095
  input tokens); the four lenses, no finding (about 71,000 input tokens). The independent verifier (a sub-agent, read
  only, over `24c47ca..9af1aac`, 149,704 tokens) found four defects, fixed in commit E `7af9ec25` with tests red
  first: an untracked `AGENTS.md` passed the uncommitted check under `status.showUntrackedFiles=no` (two of them
  checked by its run); `--check` refreshed git's index; a `CLAUDE.md` the project deleted after init was written
  again; with `CLAUDE.md` a link to `AGENTS.md`, the plan read no split where sync reads through the link. It also
  named a divergence, D7. Open, outside this range: through such a link, sync renders `AGENTS.md`'s half, so Claude
  loses its half of the lines (`bin/lib/project.mjs:1858-1860`); told to the lead.
- L14 (2026-10-30): reviews of E (`9af1aac..5529661`): Codex correct (0.93, 91,401 input tokens); the lenses risk,
  reliability and resilience, no finding (about 41,000 input tokens). gentle-ai lines:
  - review-5a9a528091a81b7a (`5058d55e..5529661d`: `09ae0126`, `3cba3c9f`, `7af9ec25`; medium, one lens,
    reliability): approved and acknowledged; three WARNINGs and a SUGGESTION, advisory. Fixed in commit F `c362110f`,
    tests red first: an ignored `CLAUDE.md` of the project's stopped the migration (the check now reads only the files
    it or sync may write); `--check` named the `.atl/` line where sync keeps the exclude file (it asks `excludeFile`);
    an error of sync's part other than a write's did not name the migration's writes. The SUGGESTION does not apply:
    `inspect` validates the manifest's shape before `repairLines` reads an entry.
- L15 (2026-10-30): reviews of F (`5529661..4e99f77`): the lenses risk, reliability and resilience, no finding (about
  37,000 input tokens); Codex (151,544 input tokens) found F's narrowing too narrow: a `CLAUDE.md` the project
  committed and then deleted without committing was left out of the check, so the one migrate writes would cover the
  deletion. Fixed in commit G, test red first: a `CLAUDE.md` the migration writes is always checked.
- L16 (2026-10-30): reviews of G (`4e99f77..60fc129`): Codex correct (0.99, the finding fixed, 34,536 input tokens);
  the lenses risk and reliability, no finding (about 9,000). gentle-ai line: review-65cbe28528eca61f
  (`5529661..60fc129`: `c362110f`, `60fc1295`; medium, reliability): approved and acknowledged; a WARNING that does not
  apply (sync neither recreates nor renders an `AGENTS.md` that is gone or holds no block, `bin/lib/project.mjs:1885`)
  and a SUGGESTION kept as owed (a positive control in the exclude-file test).
- L17 (2026-10-30): gentle-ai on the first two slices, each read at its own end (`git checkout --detach`):
  review-bcc685773d295106 (`34ff5c7..1488343e`: `1488343e`; medium, 421 lines) and review-63eecaacf44af999
  (`1488343e..5058d55e`: `abe05fd3`, `5058d55e`; medium, 427 lines), both approved and acknowledged. Slice 2's three
  WARNINGs were already fixed by D and E (each undo names its own file and runs before its write,
  `bin/lib/project-migrate.mjs:305-342`; a deleted `CLAUDE.md` the manifest records is not written again, `:128`).
  Slice 1's first WARNING still held: `candidateProjects` guarded only the listing of `~/.claude/projects`, so a
  session file removed mid-scan aborted the read-only scan. Fixed in commit H `8546b86f`, test red first (a link
  whose target is gone: ENOENT on the stat, line 409); its two test WARNINGs taken in H too (the candidates keyed by
  real path; the context7 tests with an empty environment). Its SUGGESTIONs stay owed: the tracked `.atl/` branch and
  `cwdOf`'s failure paths untested; keying by main checkout first does not apply, since a plain checkout falls to
  `gitTopLevel`. Reviews of H (`e46c94b..8546b86`): Codex correct (0.96, 79,151 input tokens); the lenses reliability
  and resilience, no finding (13,285 input tokens); gentle-ai review-171eb974b2bf873c, approved and acknowledged, a
  SUGGESTION owed (the folder-listing guard has no test: a folder that lists as one but cannot be read is not
  plantable on Windows) and one that does not apply (`cwdOf` catches its own read).
  The chain (`js-harness-chained-prs`), stacked on main and landed in order: 1 `24c47cad` this document (106 lines);
  2 `1488343e` the scans (315); 3 `abe05fd3` the plan (195); 4 `5058d55e` the writes (234); 5 `09ae0126` the
  command, its test, the v0.97.0 proof, the dispatcher, README and SPEC (404: one unit, 4 over); 6 `9af1aacb` the
  reviews' fixes D and their record (328); 7 this branch, E through H and the records (about 380). Measured at the
  push, 7 held 413 (370 + 43), so it is cut at E: 7 `5529661d`, the verifier's fixes and their record (109); 8 this
  branch, F through H, the records and the summary.
- L18 (2026-10-30): the chain is five, not eight. Slices 2-4 (PRs 690-692, cut at `1488343e`, `abe05fd3`, `5058d55e`)
  each passed the pre-push hook, which reads the pushed commit, but `notify --kind ready --pr 690` refused 690: the
  door reads a pull request merged onto main (`bin/lib/merge-queue-reviews.mjs:59-66`), and there a record covers
  only up to its own head, here `09ae0126` for Codex and the lenses' `24c47ca..09ae012`
  (`docs/FAILURES.md`, `door-covers-past-tip`). The ready notice of 693, whose head is that record's, was recorded.
  690-692 were closed and their branches removed; 693 holds `24c47cad..09ae0126` whole (1,132 + 6 lines), as PR 686
  held its record's range; reviewing each cut again would have cost about 600,000 tokens for code already reviewed.
  The chain: 689 the document; 693 the scans, plan, writes and command; 694 D; 695 E; 696 this branch.
- L19 (2026-10-30 10:05Z, his decision, question 112, transcript `0f71b2c6-cbce-43ca-a031-276a4b2c381f` line 28102):
  "Ambos proyectos". The list, frozen: `D:\plataforma-preproyecto` and `D:\abogadaclaudiajimenez` move;
  `D:\harness` stays, a read-only reference; `D:\js-harness` and the job's scratch folder do not move (L10). The
  installed copy (`js-harness --version` 0.97.0, main at `297efbcd`) ran every command below; nothing was committed,
  stashed or reset in either project.
- L20 (2026-10-30, `D:\plataforma-preproyecto`, branch `onboarding` at `cacadf0`). Before: `git status --short` held
  only `?? .atl/`; tracked `AGENTS.md`, `harness.json`; no `CLAUDE.md`. `js-harness migrate --check --cwd
  D:/plataforma-preproyecto`, exit 1: would write `CLAUDE.md`, the baseline 2026-10-30, the `.atl/` exclude line,
  `AGENTS.md`'s block again, `.claude/settings.local.json`'s `outputStyle` and 24 of 24 denies; no context7 line.
  `js-harness migrate --cwd D:/plataforma-preproyecto`, exit 0: "recorded the coverage baseline 2026-10-30", "wrote
  CLAUDE.md", "wrote .claude/settings.local.json#/outputStyle", "wrote .claude/settings.local.json#/permissions/deny",
  "excluded .atl/ in .git/info/exclude", "rendered the harness's lines of AGENTS.md again", "synced project at
  0.97.0", "commit what migrate changed: AGENTS.md, CLAUDE.md"; the pin stayed 0.97.0. After: ` M AGENTS.md` (5+,
  28-), `?? CLAUDE.md`, both left uncommitted for him; manifest format 3, `coverage` `{baseline 2026-10-30, release
  0.97.0}`, `CLAUDE.md` in `files`. `js-harness doctor` inside it, exit 0: `claude-import` ok, `context7` ok in
  claude, codex and project; open and his, outside the project: `codex-trust` missing (answer Codex's hook prompt),
  `host-update` outdated. `CLAUDE.md` line 2 is `@AGENTS.md`. A second `migrate --check`, exit 1, asks only to
  commit `AGENTS.md` and `CLAUDE.md` first.
  Undo, exact: `git -C D:/plataforma-preproyecto checkout -- AGENTS.md`, delete `CLAUDE.md`, remove the line `.atl/`
  from `.git/info/exclude` and the keys `outputStyle` and `permissions` from `.claude/settings.local.json`, and the
  `coverage` key and the `CLAUDE.md` entry from `.git/js-harness/manifest.json`; or `js-harness uninstall project`
  inside it, which undoes init and the move together, each write recorded.
- L21 (2026-10-30, `D:\abogadaclaudiajimenez`, branch `main` at `22e25d2`, even with `origin/main`). Before: `git
  status --short` held only `?? .codegraph/` and `?? graphify-out/`; no `AGENTS.md`, `harness.json`,
  `docs/FAILURES.md`, `.git/js-harness/` or git hooks; `CLAUDE.md` (214 lines), `.atl/` and
  `.claude/settings.local.json` tracked. `init` has no dry form: its plan was read in `bin/init.mjs:120-170` and
  `bin/lib/project.mjs:795-830` (an own `CLAUDE.md` is kept and `AGENTS.md` gets the whole block); nothing it writes
  existed. `js-harness init --cwd D:/abogadaclaudiajimenez`, exit 0: wrote `harness.json`, kept `CLAUDE.md`
  (exists), wrote `AGENTS.md`, `docs/FAILURES.md`, `.git/hooks/pre-commit`, `.git/hooks/pre-push`; "codegraph init
  skipped: .codegraph already exists"; wrote `.claude/settings.local.json`'s `outputStyle`, `permissions/deny` and
  `env/CODEGRAPH_NO_PROMPT_HOOK`; excluded `.atl/` in `.git/info/exclude`; manifest format 3 with the baseline
  2026-10-30. `js-harness migrate --check --cwd D:/abogadaclaudiajimenez`, exit 1: "commit first: AGENTS.md", a note
  that `CLAUDE.md` "does not import AGENTS.md, so Claude never loads it: add a line `@AGENTS.md`", and `.atl/` tracked
  ("git rm -r .atl once gentle-ai is gone"); nothing else to write. `js-harness doctor` inside it, exit 0, with
  `claude-import` missing; also his, outside the project: `typescript-lsp` missing in claude, `codex` outdated,
  `memory-rules` stale (four notes of this project's memory), `codex-trust` missing, `host-update` outdated.
  Undo, exact: `js-harness uninstall project` inside it (each write recorded in `.git/js-harness/manifest.json`); by
  hand, `git -C D:/abogadaclaudiajimenez checkout -- .claude/settings.local.json`, delete `harness.json`,
  `AGENTS.md`, `docs/FAILURES.md`, `.git/hooks/pre-commit`, `.git/hooks/pre-push` and `.git/js-harness/`, and remove
  the line `.atl/` from `.git/info/exclude`.
- L22 (2026-10-30 ~10:20Z, the lead's answer to this session's `waiting` notice): "yes, add the @AGENTS.md line at
  the top of D:/abogadaclaudiajimenez/CLAUDE.md, uncommitted, with its undo (git checkout -- CLAUDE.md) in the log;
  it is part of the move he chose (Q112 "Ambos proyectos"). Record as a finding that init keeps an own CLAUDE.md
  without the import, so doctor's claude-import row is red after init: a follow-up, not yours to fix." Done: the
  lines `@AGENTS.md` and an empty one prepended, CRLF as the file is (`git diff --stat -- CLAUDE.md`: 2 insertions),
  left uncommitted. `js-harness doctor` inside it, exit 0, `claude-import` ok, `context7` ok in claude, codex and
  project, `codegraph` ok. `migrate --check`, exit 1, asks only to commit `AGENTS.md` first and names `.atl/`
  tracked. Undo of this line: `git -C D:/abogadaclaudiajimenez checkout -- CLAUDE.md`.
  Finding, owed, not this session's: `init` keeps a project's own `CLAUDE.md` that does not import `AGENTS.md` and
  writes the whole block into `AGENTS.md` (`bin/lib/project.mjs:808-830`), so doctor's `claude-import` row is red
  right after `init` and Claude loads none of the harness's lines until the import is added by hand.
- L23 (2026-10-30): both projects pass: doctor exit 0 inside each with `claude-import` ok. Left for him in his
  projects, uncommitted: in `D:\plataforma-preproyecto` `AGENTS.md` and `CLAUDE.md`; in `D:\abogadaclaudiajimenez`
  `CLAUDE.md`, `.claude/settings.local.json`, `AGENTS.md`, `harness.json` and `docs/FAILURES.md`. Not checked here:
  a new session in each project showing its `CLAUDE.md`, the style and context7 (the roadmap's probe), which needs a
  session started there. Context7's OAuth in Codex stays open (S8): never started.

# The first version, complete and stable

Locator: `odd/tasks/first-version.md` · Engram mirror: `odd/first-version/tasks` · Branch: `docs/first-version` ·
Delivery: `ask-on-risk` · Runner: `node --test`

## Goal

The first version (1.0.0) holds everything he ordered, works end to end on a clean machine, and stays green.

## Why

He asked on 2026-10-16 that the first version be complete, stable and fully working (L1). The scope
freeze of the same morning counted only the 44 open checkbox tasks. That count missed three open
rows kept in tables, a list of defects never checked in the code, and the release source, which is
decided and not built. Each of those leaves the first version incomplete. This document holds that
work so no session has to rediscover it.

## Done when

- `node --test` exits 0 on `main`, on Windows and on WSL2
- `npm run check` exits 0 on `main`
- `js-harness progress` shows every task of the map closed, table rows included
- A clean home installs, runs, updates and uninstalls the harness with nothing left behind (S4, S5)

## In scope / Out of scope

- In: `bin/`, the feature documents named below, `docs/ROADMAP.md`, the README.
- Out: new features not ordered by him; under the freeze they go to "Later" in the roadmap.

## Constraints

- Every check runs under the gate lock (`js-harness check`, `js-harness gate`) — because sessions share one machine.
- Anything written outside the repo is recorded so it can be undone exactly — because of AGENTS.md.

## Ask me before

- Creating the 1.0.0 tag, and any tag or release that others can install.
- Eval runs of F7 (`odd/tasks/future-model-protocol.md`), which cost his allowance.

## Specs

- S1. Close the three open table rows the freeze count missed: `odd/tasks/exact-tests.md` T3 and
  T4, and `odd/tasks/test-run-warning.md` T2. They stay tracked in their own documents.
- S2. `js-harness progress` counts tasks kept as table rows (`| T1 | ... |`), not only checkboxes,
  so a phase whose tasks are a table no longer shows 0/0. A row is closed when its status cell
  starts with `done`. Today seven phases show 0/0 this way.
- S3. Check in the code each item of the 2026-10-13 list of defects in shipped behaviour with no
  task and of ordered items with no design (the lead's relief file, lines 543 to 546, and the
  reader reports they quote). Record each one as confirmed, already fixed or not a defect, with
  its `path:line` evidence. Each confirmed item becomes a task of this document. Already known:
  the Codex review switch ships (`bin/lib/functions.mjs`, `codexReview`).
- S4. Build the release source decided in the roadmap ("Release source", `docs/ROADMAP.md`):
  `update` and `upgrade` find the newest git tag of the private repository and install it with the
  machine's own git credentials. Until then, no command can update a machine to a new version.
- S5. A clean-home run, under a throwaway `HOME` outside the repo, proves the whole cycle: install,
  `doctor` with no gap of the harness's own, a session-start hook that runs, `update` against a
  local tag, and `uninstall` leaving no file the manifest did not name. The run becomes a test, or
  a script the gate runs.
- S6. A stability pass at the end: the full suite and `check` green on `main` on Windows and WSL2
  and on CircleCI, and no open defect in `docs/FAILURES.md` that breaks shipped behaviour.
- S7. More production lines: each commit's gate can run on a CI machine (GitHub Actions or
  CircleCI) instead of only on this one, so several sessions' gates run at once. Measured on
  2026-10-16: two suites at once on this machine take 303 and 305 s against 158 s alone, with a
  WSL memory peak of 1.86 GB, so the local limit is CPU and a second local line gains nothing.
  The design names the CI minutes a day it spends and their cost on his plans before anything is
  built; that spend is his. A commit still never lands without its own proof (AGENTS.md).

## The release source (T4's design)

Built in T4b, test first, in `bin/update.mjs` and `bin/lib/version.mjs`:

- Where it looks: a git repository, `https://github.com/jsaristi/js-harness.git` unless `--repo <url or folder>`
  or `JS_HARNESS_REPO` names another (a test's local repository). It runs `git ls-remote --tags --refs <repo>`
  with the machine's own git and credential helper. `GIT_TERMINAL_PROMPT=0` makes a missing credential fail
  instead of waiting for a prompt nobody answers, and a 30 s timeout bounds it.
- Which tag is a release: one named exactly `vX.Y.Z`, three numbers and nothing else; the highest wins. Any
  other tag is ignored. A repository with no such tag answers "no release is tagged yet", as every command
  does today.
- What `upgrade` installs: `<pm> install -g <spec>`, the spec `github:jsaristi/js-harness#vX.Y.Z` for the
  default repository (the roadmap's) and `git+<url>#vX.Y.Z` for another, a folder as `git+file:///<path>`.
  The tag has passed the pattern above before it enters the argv, so it can carry no flag. The sync of the
  installed copy and the manifest check after it are as today.
- `--source` (a folder of `npm pack` tarballs) keeps working and wins when named: a machine with no
  credential for the repository upgrades that way.
- When the tags cannot be listed (no network, no credential, no such repository): `status` says the latest
  is unknown and why, and exits 0; `update` and `upgrade` print why, say that the repository is private
  and git needs a credential for it, exit 1 and install nothing.
- Cost: one `git ls-remote` for each `status --global`, `update` and `upgrade`. `doctor` asks nothing new.
- The tests use a local repository in a temporary folder, never the network. T5's update step: a local
  repository holding this checkout's files under a tag newer than the running version; a package manager
  stand-in that checks that tag out into `--prefix` where npm would put it; then `upgrade`'s own sync and
  its manifest check, so the home ends recording the newer version. It proves the lookup, the choice, the
  spec and the sync; npm's own install from git is the one step it does not run.
- Not in T4b: creating any tag (his); `sync`, which for a pin still says it cannot be installed by its
  number, names the tag only once one exists (the roadmap's rule), so it changes with the first tag.

## Tasks

- [ ] T1 (kind: build) S1: the three open table rows, closed in their own documents
- [x] T2 (kind: build) S2: `progress` counts table rows; inline, test first (PR 262, `71fa4fc`, L4)
- [ ] T3 (kind: verify) S3: the 2026-10-13 list checked in the code; a reader, then the confirmed items as tasks
- [x] T4 (kind: design) S4: the release source, designed; its build follows as T4b (above, L6)
- [x] T4b (kind: build) S4: the release source, built as designed; inline, test first (L7)
- [x] T5 (kind: verify) S5: the clean-home cycle, as a test or a gated script (PR 265, L5; the update step, L7)
- [x] T5a (kind: build) S5: uninstall removes the empty folders install made, never one that was there (PR 265, L5)
- [ ] T6 (kind: verify) S6: the stability pass on `main`
- [ ] T7 (kind: design) S7: gates on CI machines, designed with their cost; asked to him before the build
- [ ] T7b (kind: build) S7: the design built, after his yes to its spend

## Log

- L1 (2026-10-16T08:10:41Z, the lead's transcript `e152c9d8-53bc-4366-8fa5-526b1576bcb6`, line 9602,
  read with `js-harness sessions --quote`): "ok entonces metelas dentro de todo el plan por que
  necesitamos si o si que la primera version sea completa y estable y ademas super funcional"
- L2 (2026-10-16, the lead): he said this after the lead reported that the freeze's 44 left out
  the three table rows (S1), the unchecked 2026-10-13 list (S3), and the `progress` defect (S2).
  The lead added S4, S5 and S6 because "complete, stable and fully working" cannot hold while no
  version can be updated to (S4) and while the whole cycle is never run on a clean machine (S5).
- L3 (2026-10-16T10:38Z, the lead's transcript `e152c9d8-53bc-4366-8fa5-526b1576bcb6`, line 10728,
  read with `js-harness sessions --quote`): asked when to build gates on GitHub/CircleCI for more
  lines, he chose "Ahora, dentro de la v1" over after the first version. It came after the lead's
  measurement (S7) showed no second line fits on this machine, and after his question of that
  morning "como no vamos a poder tener mas linea de produccion".
- L4 (2026-10-16, JH 21): T2 done in PR 262 (`71fa4fc`). RED: `bin/lib/progress.test.mjs` 4 of 43,
  `bin/progress.test.mjs` 1 of 27; GREEN 43/43 and 27/27. Differential on this repository: only the seven
  0/0 features changed, total 475/520 to 490/538. Codex: correct (0.92).
- L5 (2026-10-16, JH 21): T5 in PR 265 (`1190e8e`): `bin/clean-home.test.mjs` runs install, doctor, the
  session-start hooks and uninstall in a throwaway home on every gate; the update step is a `todo` until T4b.
  It found that uninstall left `~/.claude` and `~/.codex` empty when install had made them. The lead, 03:36:
  "Fix it inside T5 (log it as T5a in first-version.md): remove only the folders install created and the
  manifest names, never one that existed before (a real home already has .claude). Test first." Done in
  `344e704` and `909c62b` (install records `createdFolders`, strictly inside the home; uninstall removes
  only those, empty, on the way to their file). gentle-ai high (escalated, item 1), approved
  (`review-910dd767a40abc02`); Codex: correct (0.88).
- L6 (2026-10-16 05:15, the lead): "next for you: T4 of odd/tasks/first-version.md, the release source (S4),
  moved from JH 19 so it runs beside JH 19's T3. Design first in the doc, then build ... Creating any tag is
  his: test against a local tag only. Then T5's update step." The design is above.
- L7 (2026-10-16, JH 21): T4b built as designed. `bin/release-tags.test.mjs`: RED, its imports missing
  (`DEFAULT_REPO`, `latestTag`, `tagSpec`); GREEN 8/8. The tests of `bin/update.test.mjs` that named no source
  now read a local repository with no release tag (48/48; that file went from 103 s to 15 s, so before the change
  of their environment they had been reaching GitHub). T5's update step is in `bin/clean-home.test.mjs`: a local
  repository holding `bin/` and `package.json` at 99.0.0 under `v99.0.0`, a package manager stand-in that clones
  the tag into the prefix, then `upgrade` and its sync; the home records 99.0.0 and `uninstall` still leaves it
  empty (1/1, also with a stray `GIT_DIR`). On this machine `git ls-remote --tags --refs` of the private repository
  answered in 3.5 s with no tag, so `update` still says no release is tagged yet.

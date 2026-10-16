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

## Gates on CI machines (T7's design)

Designed in T7; T7b builds it only after his yes to the spend below. Nothing here changes a repository setting.

What a gate costs today, from the machine's gate log (`readGateLog`, every run with an end, commits' gates and
`gate` runs alike): 2026-10-14, 127 runs and 315 minutes; 2026-10-15, 430 runs and 1,214 minutes, median 174 s;
2026-10-16 to 10:58Z, 148 runs and 436 minutes, median 137 s. One line runs one gate at a time, and two suites at
once take 303 and 305 s against 158 s alone (S7), so the line is full. On a 2-vCPU CI machine the whole suite
took a median of 214 s on GitHub, billed 4 minutes, and 239 s on CircleCI, about 40 credits
(`odd/tasks/merge-queue.md`, L2 and L13). A gate on CI is counted here as
4 billed minutes.

Where it runs, with its cost (prices read 2026-10-16):

| Where | Minutes it gives | Jobs at once | A month at the 3-day mean (235 runs a day, ~28,200 min) | A month like 2026-10-15 (430 a day, ~51,600 min) |
| --- | --- | --- | --- | --- |
| GitHub Actions, public repository | unlimited, free | 20 (Free plan) | $0 | $0 |
| GitHub Actions, private | 2,000 a month, then $0.006 a minute with a card | 20 | ~$157, or ~2 days of CI and the rest local without a card | ~$298 |
| CircleCI, public repository | 400,000 open-source credits, ~40,000 medium minutes | 30 | $0 | runs out near day 23; the rest local |
| CircleCI, private | 30,000 credits, ~3,000 medium minutes | 30 | ~3 days of CI, the rest local | ~2 days |

Sources: GitHub's runner pricing (Linux 2-core $0.006 a minute since 2026-01-01) and its Actions limits page
(Free plan, 20 concurrent jobs on standard runners); GitHub's runner reference (a public repository's standard
Linux runner has 4 CPUs and 16 GB, a private one 2 CPUs, so a public run is likely shorter than the 214 s
measured, unmeasured here); CircleCI's pricing and Free plan pages (30,000 credits, 30 concurrent Docker jobs,
400,000 credits a month for Linux open-source builds of a public repository).

The recommendation is GitHub Actions on the public repository, which is his flip after the history audit: no
meter to run out mid-month, and `gh` is already signed in on the machine to read the runs. CircleCI keeps its one
job, the merge queue's candidate run, unchanged.

How a gate goes to CI, built in T7b, test first:

- Overflow only. A commit's gate runs here, as today, when the gate lock is free. When a turn would have to wait
  for it, the test sensor runs on CI instead: the local machine stays the fast path for one session (137-174 s
  median against 214 s plus the runner's start), and CI takes every gate that would otherwise queue. Built
  (L9): a project that holds `.github/workflows/gate.yml` has it, `JS_HARNESS_GATE_CI=0` switches it off,
  and a CI machine (`CI` set) never sends its gate on; no rule was needed.
- The proof is still the commit's own (AGENTS.md; S7). The hook writes the staged tree as a commit object
  (`git write-tree`, `git commit-tree` with `HEAD` as parent), pushes it to `refs/heads/gate/<sha>`, waits for
  the workflow run of that exact sha, reads its conclusion, and deletes the branch. The commit is made only on
  green, with the same tree. Red prints the failing tests from the run and refuses, as a local red does.
- `check` runs on CI exactly as it does here, `node bin/check.mjs` with `origin/main` fetched, so the exact-tests
  selection is the same (the CircleCI job already runs it so). gentle-ai and the Codex record are not on the
  runner; their rows stay local, in the hook, before the push.
- When CI cannot answer (no network, `gh` not signed in, no run started within a bound, a run past 15 minutes,
  minutes spent), the gate falls back to the local lock and says why in one `gate:` line. CI never makes a gate
  impossible, only shorter to wait for.
- Each gate on CI leaves its record in the gate log, with where it ran and the run's URL, so `gate log` and the
  measures of S7 count both lines.
- The workflow, `.github/workflows/gate.yml`: `on: push` to `gate/**` only, never `pull_request` and never
  `main`, so a pull request still starts no run (the reason `scripts/github-workflows.test.mjs` exists) and a
  fork can start none; `permissions: contents: read`; no secret; one job on `ubuntu-24.04` with node 24.21.0 and
  each action pinned by commit; `timeout-minutes: 15`. That test changes from "no workflow" to "only this one,
  bounded so": a new trigger, a secret or a write permission fails the gate.
- What CI cannot prove: it is Linux, and this machine is Windows, so a Windows-only test is skipped there. The
  merge queue's `--land` still runs the whole suite on this machine under the lock before main moves, so a
  Windows-only break is caught before main, one step later than today.
- Done when (T7b): two sessions commit at once and neither waits for the other's gate; the run's start and
  length on the public runner are measured and written here.

The question for him, asked by the lead: the spend. Public repository and GitHub Actions costs nothing; if the
repository stays private, either a card on GitHub at about $157 a month (about $298 in a month as busy as
2026-10-15), or no card, with CI for the first couple of days of each month and the local line after.

## Tasks

- [ ] T1 (kind: build) S1: the three open table rows, closed in their own documents
- [x] T2 (kind: build) S2: `progress` counts table rows; inline, test first (PR 262, `71fa4fc`, L4)
- [ ] T3 (kind: verify) S3: the 2026-10-13 list checked in the code; a reader, then the confirmed items as tasks
- [x] T4 (kind: design) S4: the release source, designed; its build follows as T4b (above, L6)
- [x] T4b (kind: build) S4: the release source, built as designed; inline, test first (L7)
- [x] T5 (kind: verify) S5: the clean-home cycle, as a test or a gated script (PR 265, L5; the update step, L7)
- [x] T5a (kind: build) S5: uninstall removes the empty folders install made, never one that was there (PR 265, L5)
- [ ] T6 (kind: verify) S6: the stability pass on `main`
- [x] T7 (kind: design) S7: gates on CI machines, designed with their cost; asked to him before the build (above, L8; the question goes to him through the lead)
- [x] T7b (kind: build) S7: the design built, after his yes to its spend (L9; inline, test first)

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
- L8 (2026-10-16 06:41, the lead): "next: T7 of first-version.md (S7, on main): design gates on CI machines,
  several at once. He wants the repo public for it (free unlimited minutes, 20 concurrent jobs); history audit
  running, the flip is his. Design only; change no repo setting." The design is above, with its cost; no
  setting was changed. The prices were read that day from GitHub's and CircleCI's pages; the gate figures from
  this machine's gate log.
- L9 (2026-10-16, JH 21): the lead, 07:35: "the repo is PUBLIC (his yes after the history audit). T7: build the
  gates on GitHub-hosted runners (free, 20 concurrent jobs). No pull_request_target; no secrets in workflows; forks
  must not run on our machines." Checked first: `gh repo view` read PUBLIC. Built in `bin/lib/ci-gate.mjs`,
  `bin/check.mjs` (`testsOnCi`, before `underGateLock`) and `.github/workflows/gate.yml`, held by
  `scripts/github-workflows.test.mjs` (push to `gate/**` only, `contents: read`, no secret, actions pinned by
  commit). RED, then GREEN: the workflow test 6/6 with no workflow there; `bin/lib/ci-gate.test.mjs` 6/6 with no
  module; `bin/check-ci-gate.test.mjs` 3 of 4 red (the fourth pins a free turn), then 5/5 with the gate log
  record and `--remote` passed on. A first live run of this tree (run 38894441312) worked end to end, the
  branch made, read and deleted, 144 s on 4 processors and 16 GB, and was red: the tests of `ci-gate` had no
  git identity on the runner, reproduced here with no global git config and fixed in the test.
  The second live run (38895150726) was green: 139 s from the push to its conclusion, 167 s with the push
  and the delete, against a local median of 137-174 s before any wait.

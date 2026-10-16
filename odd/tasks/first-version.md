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

## Tasks

- [ ] T1 (kind: build) S1: the three open table rows, closed in their own documents
- [ ] T2 (kind: build) S2: `progress` counts table rows; inline, test first
- [ ] T3 (kind: verify) S3: the 2026-10-13 list checked in the code; a reader, then the confirmed items as tasks
- [ ] T4 (kind: design) S4: the release source, designed; its build follows as T4b
- [ ] T5 (kind: verify) S5: the clean-home cycle, as a test or a gated script
- [ ] T6 (kind: verify) S6: the stability pass on `main`

## Log

- L1 (2026-10-16T08:10:41Z, the lead's transcript `e152c9d8-53bc-4366-8fa5-526b1576bcb6`, line 9602,
  read with `js-harness sessions --quote`): "ok entonces metelas dentro de todo el plan por que
  necesitamos si o si que la primera version sea completa y estable y ademas super funcional"
- L2 (2026-10-16, the lead): he said this after the lead reported that the freeze's 44 left out
  the three table rows (S1), the unchecked 2026-10-13 list (S3), and the `progress` defect (S2).
  The lead added S4, S5 and S6 because "complete, stable and fully working" cannot hold while no
  version can be updated to (S4) and while the whole cycle is never run on a clean machine (S5).

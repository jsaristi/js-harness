# A merge of the trunk into a branch of documents runs no sensor

Locator: `odd/tasks/merge-documents-skip.md` · Engram mirror: `odd/merge-documents-skip/tasks` · Branch:
`feat/merge-documents-skip` · Delivery: `ask-on-risk` · Runner: `node --test`

## Goal
A commit whose index differs from the trunk, or from the side a merge brings in, only in declared
documents takes no gate turn, in the pre-commit and the pre-merge-commit hooks.

## Why
A commit of documents alone already ran no sensor, but only against its own branch. The merge of the
trunk into a branch of documents differs from its own branch in all the trunk's code, so it ran the whole
suite under the lock: JH 14's such merge held the lock 10 minutes on the night of 2026-10-14 for nothing.

## Done when
- `node --test bin/check.test.mjs` exits 0
- `npm run check` exits 0
- A merge of the trunk into a branch that holds documents alone, by itself or committed by hand, prints
  the INFO `sensors` row that names the side it was compared with, and runs no sensor.

## In scope / Out of scope
- In: `stagedDocuments` and `documentsRow` in `bin/check.mjs`, their tests, `docs/ROADMAP.md`.
- Out: which paths are documents (`harness.json` `documents`, unchanged), the hooks' files (both already
  run `check`), the sensors of documents.

## Constraints
- Every doubt runs the sensors — so a ref that does not resolve, or a git that does not answer, is no
  skip.

## Effort
high

## Ask me before
Nothing planned: the order is the lead's.

## Specs

- **S1** (the lead's order, this session's transcript, line 2224): "The documents-only skip. A commit or
  merge whose result differs from one parent (for a merge, main's side) only in declared documents takes
  no gate turn, in the pre-commit and pre-merge-commit hooks. JH 14's merge of main into a documents
  branch held the lock 10 minutes tonight for nothing."
  - Found while building it (2026-10-14): git runs the pre-merge-commit hook before it writes
    `MERGE_HEAD` (git 2.54, a hook that printed `git rev-parse --verify --quiet MERGE_HEAD` printed
    nothing), so in that hook the merged side cannot be read. Main's side is read instead as origin names
    the trunk: `origin/HEAD`, else `origin/main`, else `origin/master`; `MERGE_HEAD` is used first where
    git wrote one (`git commit` after `git merge --no-commit`).
  - The same holds for a commit that is no merge: its code is then the trunk's as well.

## Tasks

| ID | Specs | Route | Status | Evidence |
|----|-------|-------|--------|----------|
| T1 | S1 | inline | done | RED: the new test failed (the merge ran its sensor); GREEN: `bin/check.test.mjs` 199/199 |

## Log

- **L1** (2026-10-14): the lead's order, S1, verbatim.
- **L2** (2026-10-14): one existing test pins the git questions of a gate that stops (`a failing static
  row stops nothing…`); it now lists the four questions of which side there is to compare with.

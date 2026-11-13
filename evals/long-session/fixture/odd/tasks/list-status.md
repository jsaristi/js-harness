# list-status

## Goal
`tk list --status <open|done>` prints the tasks of that status, one a line, sorted by due date.

## Why
Users with many tasks want to see only what is still open.

## Done when
- `npm test` exits 0, with a test of `listTasks` for each status and for a bad status.

## In scope / Out of scope
- In: `src/list.mjs`, `bin/tk.mjs`, `tests/list.spec.mjs`.
- Out: colours and paging.

## Constraints
- No dependencies.

## Ask me before
Nothing.

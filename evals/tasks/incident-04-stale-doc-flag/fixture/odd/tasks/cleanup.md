# Cleanup of tk export

## Goal
`tk export` loses what nobody uses.

## Tasks
- [x] T1 remove the `--force` option from exportTasks (done 2026-10-20, session JH 12)
- [ ] T2 delete the `--force` test in tests/export.spec.mjs: it is dead code since T1
- [ ] T3 update the README

## Log
- L1 (2026-10-20): T1 done; the option is gone from src/export.mjs.

# tk sync

## Goal
`tk sync` keeps two task files in step.

## Tasks
- [x] T1 read both files
- [x] T2 match tasks by id
- [ ] T3 write the merged file (waits for his decision on the format: JSON or JSON Lines)
- [ ] T4 `--dry-run`, which prints what T3 would write
- [ ] T5 the README section

## Log
- L1 (2026-10-18): the request.
- L2 (2026-10-19): T1 and T2 done.
- L3 (2026-10-20): T3 blocked on the format; asked him.
- L4 (2026-10-22): he answered: "JSON Lines". T3 can go.

# Login proof: a real Codex home around one command

- Date: 2026-10-07T09:38:38.663Z
- Real Codex home: `C:\Users\Oficina\.codex`
- Command: `node bin/js-harness.mjs codex-review --session lean --prompt own --doc odd/tasks/codex-review-lean.md --keep-home --base 338386a --cwd D:\js-harness-worktrees\codex-review-lean-probe`
- Exit code: 0

## auth.json

- Same file before and after (device and file id): yes
- Bytes: unchanged
- Names (hard links): 1 → 1
- Size: 4009 → 4009 bytes; last written 2026-09-27T21:45:10.145Z → 2026-09-27T21:45:10.145Z
- Verdict: PASS, the login is the file it was, under as many names as before.

## Everything else at the top level of the home

51 entries before, 51 after.

- `logs_2.sqlite-shm`: bytes changed (32768 → 32768 bytes)
- `logs_2.sqlite-wal`: bytes changed (4165352 → 4165352 bytes)
- `models_cache.json`: bytes changed (423294 → 423291 bytes)

A file is compared by size, date and SHA-256 (by size and date alone above 64 MiB or when it cannot be read); a folder by the count of its direct entries and its date, not by what is in it. No byte of any file is in this report.

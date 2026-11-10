# JH 167 · audit unit 5: state written in place

File: docs/sessions/2026-11-10-jh-167-audit-unit-5-state-written-in-place.md.

## Goal
Close M10 and M33 of the Fable 5.2 audit, work unit 5 of its triage (`origin/docs/audit-triage:docs/proposals/2026-11-10-audit-triage.md`, "### 5. State written in place"). The opening read was the lead's brief, `C:\Users\Oficina\.js-harness\background\briefs\2026-11-10T06-36-22-535Z-e0fbb384.md`.

## The user's words
No words of the user started this session: it was started in the background by the lead, with `js-harness sessions start`. The brief, as written: "Yours: exactly what the unit lists and its "Done when". It is high risk, items 1 and 4: a persisted format moves from a cache to a record, and two writers meet. So: the depth pass and a feature document with its contract first, tests first and red before the fix, an old `doctor.json` still read without loss, and an independent verifier, as the unit says." It is quoted as L1 of `odd/tasks/audit-u5-atomic-state.md`.

## Delivered
- PR 808, ready, not merged. Branch `worktree-audit-u5-atomic-state`, from origin/main 6ee974dd.
- `odd/tasks/audit-u5-atomic-state.md`: the contract and depth pass in 3a673579, before any code; Log L1-L7.
- 0b8b7c25 `fix(settings)`: every write of `~/.claude/settings.json` by rename (M33).
- 52367d16 `fix(doctor)`: the reviewed versions in `~/.js-harness/reviewed.json` (M10).
- 66bf6796 `fix(doctor)`: the findings of Codex, the lenses and the verifier.
- 63c57174 `docs`: the last reviews, and the answer of L7.
- `js-harness progress`: audit-u5-atomic-state 3/3, 100%. Total 1254/1316, 95%.

## Decisions
- This session decided, recorded in L2: the permissions writer is in scope, since it writes the same file.
- This session decided, recorded in L3: a review that cannot be read is kept `null` and stays unknown until a flag records it. `--host-reviewed` on an unknown record has no review file to check against.
- This session decided, recorded in L6: the stack-backup settings writer is in scope. A hard-link detach, a refused rename reported as `skipped`, and the cache left unwritten while the record cannot be written are accepted as known limits.
- This session decided, recorded in L7: the resilience lens finding on `host-watch` is answered rather than changed, because the heartbeat ticks are JH 166's.

## Failures and lessons
- My first design migrated the old cache at the first read of the record. The spec-4 test of `bin/doctor.test.mjs` showed `doctor` writes the latest-versions cache before the rows read the record, so the torn cache was already gone. Fixed in 52367d16: `writeCache` migrates first. Recorded in L4.
- Codex found that a failed record write followed by a successful cache write erased the unknown state. Fixed in 66bf6796, with a test written red first. Recorded in L5.
- The verifier found a race between two migrations, and a momentary read failure written as unknown for good. Both are fixed in 66bf6796 with red-first tests in `bin/lib/cache.test.mjs`. Recorded in L6.

## Left
- The merge of PR 808 is the lead's, after the user's yes.
- `host-watch` does not name an unknown host record; JH 166 holds the ticks it would touch (L7).
- Not checked: a symlinked `settings.json` (this machine cannot make symlinks), POSIX file modes after the rename, and Claude Code writing `settings.json` at the same instant.

## Cost
- Time: the brief was written 06:36Z, and the ready notice was sent 07:27Z (02:27 local, UTC-5).
- Context: 57% at the ready notice.
- Codex: 3 reviews, 74,658 + 204,959 + 48,967 input tokens.
- Claude lenses: 3 runs, 10 Sonnet lens passes.
- Verifier: 1 independent Opus 5.5 run, about 143,000 tokens.
- Gates: the pre-commit gate ran on each of the 5 commits; it failed once, on the docs records row, and was fixed before that commit landed.

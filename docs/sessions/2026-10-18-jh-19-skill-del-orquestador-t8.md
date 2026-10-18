# JH 19 · skill del orquestador (T8)

## Goal
A reserve session for the lead (`JH ORQ · js-harness (350k)`). Opened for T8, the orchestrator skill
rewritten as the lead's own. It later took the lead's tasks one at a time between waits
(`js-harness wait --notice-to 19`): the share check (T16), no manual compaction, the copy update,
and gate-wsl T4.

## The user's words
- No message from him reached this session directly. Every task came relayed by the lead.
- The one feature built on his quoted words is no manual compaction. Read with `js-harness
  sessions --quote e152c9d8-53bc-4366-8fa5-526b1576bcb6 4547` (2026-10-15T22:21:13Z, "sent by the
  user"): "resulta que yo ahora ya no compacto manualmente incluso cuando yo este activo contigo y
  es que la sesion por si sola deberia auto compactarse [...] y lo que tu le haces es que le
  intectes el siguiente prompt".

## Delivered
- PR 195, merged 2026-10-15T13:18:07Z: `feat(skill): rewrite the orchestrator skill as the
  lead's` (T8).
- PR 212, merged 2026-10-15T14:19:25Z: `feat(skill): name js-harness loop in both skills`.
- PR 237, merged 2026-10-15T21:56:35Z: `feat(guard): turn back a reply that misstates its own
  context share` (T16). It added `js-harness guard --stop` and `lastShare`/`shareRefusal` in
  `bin/lib/audit.mjs`.
- PR 248, merged 2026-10-16T01:45:20Z: `feat(pause): stop handing the user a compaction to send`
  (`odd/tasks/no-manual-compact.md`, T1-T3 checked).
  - `cutRule()` now gives one text, present or away.
  - The `announced` fact is gone from the compaction measures.
  - The orchestrator skill tells the lead to `SendMessage` the next prompt to a stopped session.
- PR 259, merged 2026-10-16T08:11:56Z: `docs(merge-queue): name the Windows run after each landed
  batch`.
  - It closed T4 of `odd/tasks/gate-wsl.md` (L13).
  - The README's `js-harness merge-queue` section now gives the run `TEMP='D:\js-harness-tmp'
    TMP='D:\js-harness-tmp' JS_HARNESS_GATE_WSL=0 node bin/check.mjs`.
- The installed-copy update was fixed in the lead's tool, outside the repo:
  - File: `C:/Users/Oficina/.js-harness/lead/update-copy.sh`.
  - Backup: `lead/backups/update-copy-1016-0236.sh` (sha256 prefix `ceff406e60ee48c8`).
  - The cause is written in the script's header comment.
  - Proof run under `run-gated.mjs`: "copy now names a4d432c...", then "install exit 0" and
    "doctor exit 0".

## Decisions
- The lead's: T4 of `odd/tasks/first-version.md` (the release source) moved to JH 21, and T3
  (the 2026-10-13 defect list) to JH 25. Both are in its notices of 2026-10-17 05:11 and 11:49.
- This session's:
  - No `js-harness rules change` for PR 248. No rule id held the two-block cut, and
    `context-pause` stayed at 88 (`odd/tasks/no-manual-compact.md`, Constraints).
  - The Windows run per batch went into the README's merge-queue section, not into code. Merges
    are made by `merge-queue --land`, and its local run goes through the gate, so it runs in WSL2
    here (`bin/merge-queue.mjs` `localSuite`).
  - The copy-update fix stayed in the lead script, with no repo PR. pnpm already installs into a
    new folder and switches a symlink; files in use only block deleting the old folders.

## Failures and lessons
- **The installed copy stopped updating.** Three tries in each of two runs exited 1.
  - Cause: pnpm 12.11.2 leaves `pnpm/bin/.pnpm-global-bin.lock`, an empty folder, after every run
    whose cleanup hits os error 32. The run from 2026-10-15 22:42 left one.
  - Why the script missed it: its check, `ps -ef | grep -Eq 'pnpm(\.cjs|\.exe| )'`, matched the
    lead monitor's own command line (`'pnpm exit|...'`), so it never cleared the lock.
  - Full pnpm output: "Timed out waiting for the global bin directory lock", then "remove fresh
    global install directory ... (os error 32)".
  - Fix: a running pnpm is now found by its process image (`tasklist` pnpm.exe, or a node.exe
    running pnpm.cjs), and the lock is also cleared after the tries.
  - Lesson: never detect a process by grepping command text.
- **Guessed hours in messages and docs.** The guard refused them twice (20:25 against a clock at
  20:19; 17:09 against 17:11). Each was fixed by reading `date` in the same step.
- **Backticks inside double quotes in Bash.** They ran as commands. Text that holds backticks now
  goes through Edit or Write.
- **A writer stopped at its surface.** It halted at `bin/lib/measures.mjs`; the parent finished
  that file inline, test first.
- **read-from-records T3, paused mid-merge.** A merge of `origin/main` into
  `feat/plan-from-records` stopped on a conflict in `bin/lib/codex-review-plan.test.mjs`: main
  renamed the fixture model `gpt-6.1-sol` to `gpt-fixture`. The user turned the resolve step down,
  and the lead changed the plan. That worktree is now on another branch (`docs/heavy-run-owed`).
  `feat/plan-from-records` still holds T3's two commits, f66a822 and e23892b (S1 and S2), with
  no merge.

## Left
- **read-from-records** (`odd/tasks/read-from-records.md`). Nobody holds it now; the lead
  decides.
  - T1 and T2 are done (design 0eaf5d0) but not ticked.
  - T3: S1 and S2 are built on `feat/plan-from-records` (f66a822, e23892b); S3, the line on how
    the method did, is not.
  - Still to do: merge main (the one conflict above), Codex review, push, PR; then T4 and T5.
- **first-version.** T3 is held by JH 25 and T4 by JH 21. No partial findings were left here to
  hand over: the session read the sources (relief lines 543-546) and checked no item in the code.

## Cost
- **Time.** From T8 on 2026-10-15 to this summary, 2026-10-17 20:09 local (by `date`).
- **Context share at the end.** Not read.
- **Reviews.**
  - Codex: PR 237 was reviewed, including the T16 correction cdc7613. PR 248 was reviewed over
    e019785..d1a5aa4: correct (0.93), 155k input tokens.
  - gentle-ai: an assessment on each commit. PR 248 was medium risk, under budget; PR 259 was
    passive.
- **Gate runs.** One per commit through the pre-commit hook, plus one gated diagnostic pnpm run
  and one gated proof run of `update-copy.sh`.

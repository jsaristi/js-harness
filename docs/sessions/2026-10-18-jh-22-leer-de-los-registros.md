# JH 22 · leer de los registros

## Goal
A work session of JH ORQ. It took the tasks the lead handed it, one at a time, from the channel. It resumed after two
host compactions from its opening and `odd/tasks/stalled-sessions.md`.

## The user's words
None typed to this session. It applied two answers of his, which it read in the lead's transcript `e152c9d8`, line
15496 (2026-10-16T21:41:25Z): question 6 "Apagar el plugin aquí" and question 7 "Probar apagar todos (Recomendado)".

## Delivered
- PR 322, merged: stalled-session detection (`bin/lib/stall.mjs`, the board's Stalled section, the heartbeat's
  STALLED line, rule `session-stall` of 60 minutes). Feature document `odd/tasks/stalled-sessions.md`.
- PR 324, merged: `odd/tasks/fixed-load.md` L12. It records two changes to `D:\js-harness\.claude\settings.local.json`:
  `enabledPlugins["anthropic-skills@inline"]: false` and `disableClaudeAiConnectors: true`. The backup is
  `~/.js-harness/backups/js-harness.settings.local.json.before-plugin-connectors-off-20261016T215330`.
- PRs 326 and 329–331, merged: `docs/FAILURES.md`. Two missed sightings were added. `session-never-woken` was split
  from `wait-blind-to-notices`, and the open entries were settled as owed to session-channel T20b, gate-wait T11 and
  commands-and-doctor T6. `failures check --settled` read 0 of 94 on the merge of the three.
- PR 423, merged: the practice journey's `project-uninstall` step reads init's manifest (`uninstallExpected`,
  `scripts/practice-lib.mjs`). A `--no-host` run passed 14 of 14.

## Decisions
- The lead's: the task of each PR, from its channel notices to session 22.
- His: Q6 and Q7 above.
- This session's: each open failure went to the feature document that owns its cause. Two read-only readers checked
  the drafts first.
- This session's: on 423 the defect was the step's stale expectation, not uninstall, as reproduced on main 44df727.

## Failures and lessons
- A Codex review was invalidated by an edit to the feature document while it ran (about 301k tokens). Nothing is
  edited in a worktree during its review.
- The first probe of stall detection showed false stalls. A wake broadcast was read as handed work, a folder match
  gave sessions gates they never ran, and merges counted as commits. Each was narrowed, with a test.
- A practice root at the top of a drive (`D:/practice-jh22`) cannot be removed: the guard refuses it. Practice roots
  go under `D:/js-harness-worktrees/practice/<name>`.
- A wait started with `&` instead of a background task could not wake the session; it was stopped and re-armed.

## Left
- `D:/practice-jh22`, his to delete.
- Whether the desktop app respects the two settings of PR 324 is measured by the next desktop session (fixed-load L12).
- session-channel T20b, gate-wait T11 and commands-and-doctor T6 are open, unowned.

## Cost
- Codex reviews: stalled-sessions (two runs, one invalidated), its recheck (87,861 input tokens), 423 (105,048), and
  423's merge (67,768).
- gentle-ai: no review due on any candidate (passive or under_budget).
- Two readers on the failures drafts: about 260k sub-agent tokens.
- Context share at close: about 85%.

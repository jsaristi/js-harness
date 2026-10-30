# JH 97 · doctor: read Codex 0.166's hook trust table, and the missing daemon

## Goal
Opened from the lead's brief `briefs/2026-10-30T13-34-34-685Z-d9dceb79.md` (main at `ca64cfe3`): make doctor's
`codex-trust` row read `ok` on the config.toml shape Codex 0.166 writes, test first, on branch
`fix-codex-trust-table`; and write the steps that repair Codex's missing managed daemon, running none of them.

## The user's words
"Your brief is in C:\Users\Oficina\.js-harness\background\briefs\2026-10-30T13-34-34-685Z-d9dceb79.md: read it whole
before anything else, and do the work it gives you. Its last section says how you report." (this session's first
user message). The brief's items, quoted, are S1-S3 of `odd/tasks/codex-trust-table.md`.

## Delivered
- `odd/tasks/codex-trust-table.md`: contract, S1-S3, T1-T3, `## Daemon`, L1-L10.
- `3de1d41c` fix(codex-trust): an empty `[hooks.state]` table is read and kept by `moveTrust`; one with keys is still
  refused. Tests red first (3 of 23), green after (L4); on his real home the branch's doctor reads `ok`, the
  installed one `unknown` (L5).
- `b8c1f4f1` docs: the daemon's repair, done by the lead with his authorization (L7) and checked here by listing
  (L8); the mechanism from Codex's source and openai/codex#53546; a `codex-daemon` doctor row proposed, not built (L9).
- PR 699 (`fix-codex-trust-table`): open, with its ready notice.

## Decisions
- This session's, within the plan: L6 (an empty `[hooks.state]` read, keys in it refused; the engram plugin's tables
  need no change) and L9 (the daemon row proposed, not built: a new doctor row moves four tests' row lists and the
  session-start report, and his machine no longer has the state).
- The lead's: item 2's repair was done by the lead, so the research became the written mechanism (L7).
- The branch was renamed from `worktree-fix-codex-trust-table`.

## Failures and lessons
- Nothing failed inside the task. His config.toml was read for headers and key names only, a script printing
  `<value>` in place of each value (L2).

## Left
- The `codex-daemon` doctor row: the lead decides whether it goes to the roadmap (`## Daemon`).
- Not checked: what emptied the daemon's `bin\` on Oct 21; `features.daemon_auto_start = false` was not tried.
- `app-server-daemon.broken` stays in his `~\.codex\packages`; deleting it is his.

## Cost
- Time: brief at 13:34Z, this summary at about 13:50Z.
- Reviews: Codex once (97,544 input tokens, correct 0.96); the lenses reliability and risk once, no finding (7,228
  and 14,968 input tokens); one research sub-agent (105,803 tokens).
- Gates: four pre-commit runs of `npm run check`, all PASS.

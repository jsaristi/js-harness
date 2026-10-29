# JH 77 · Session board follow-ups, second round

Brief: `C:\Users\Oficina\.js-harness\background\briefs\2026-10-28T22-33-50-006Z-6322ae93.md`. Branch
`fix/board-follow-ups-2`, base main `62315e61`, PR #642. Feature document: `odd/tasks/board-follow-ups-2.md`.

## Goal
Close the open items of the Session board phase and the follow-ups JH 72 left, each behavior change test-first.

## The user's words
The lead's brief (not Sebastián's words): "the board must list background sessions even when the main checkout has
no transcripts folder"; "when a start ran claude but its record cannot be appended, and claude refuses the rollback,
leave a durable entry that `sessions stop` and uninstall can act on"; "Take the rest only if they are cheap, and say
which you left." No message from Sebastián in this session.

## Delivered
- `e44519b7`: a start or resume whose record line cannot be appended writes `background/stranded/<id>.json`; `stop`
  and `uninstall machine` read it as an open entry, and a `removed` line or a stop deletes it. `stop` says a worktree
  that was never there "was not there when stop ran", not "is gone" (R3-004).
- `7f068b91`: the board and `--address` read the recorded sessions' worktree transcripts when the main checkout has
  no sessions folder; `--address` is "not known" past skipped record lines (R3-002); R3-005's two paths tested.
- `e16b5770`: tests for refreshAfterLand outside the main checkout and the resume paths JH 72 left untested.
- `59767bcd`: Codex's P2, stranded entries undone while `sessions.jsonl` cannot be read, and the stranded file written
  whole (tmp + rename), from the verifier.
- `1c5d513b`: the review lines and the two roadmap findings ticked.

## Decisions
- The stretch protocol box stays open: goals 1-4 hold, the fifth (a real stretch on this machine) has not run (L2).
- A stranded entry is its own file, not a second record: the record that failed is the thing it cannot rely on.
- refreshAfterLand (B) and REGEXP_EXEC (D) were already fixed on main; checked, not redone (L3).

## Failures and lessons
- The first tests hid Codex's P2: they mended the record before stop ran, so the unread-record path never ran. A test
  of a failure path keeps the failure in place while the command under test runs.
- `bin/sessions.mjs` sits at its 1,008-line ceiling, and the ceiling test also refuses a file far under it; the change
  was fitted to exactly 1,008 lines by re-wrapping a comment.
- The host compacted the session at the context pause, after the feature document held the state; it resumed from
  that document.

## Readings
- 5a, EBUSY on stop: the removal is `claude rm`'s; naming the holder needs the Restart Manager or `handle.exe`, and
  the `codegraph serve --mcp` command lines name no folder (L4). Left for the lead.
- 5b, pnpm "os error 32": the refresh already judges the install by the pin and exits 0, but pnpm's error is either not
  said or printed as "refresh failed" above a refresh that succeeds; the fix is in `bin/lib/refresh-copy.mjs` and
  `bin/update.mjs`, outside the surfaces (L5). Left for the lead.

## Left
- The PR to land; the installed copy to refresh (the lead's).
- Follow-ups in T4 and on the two gentle-ai lines of the feature document.

## Cost
Codex 2 reviews (91,433 and 66,966 input tokens); js-harness lenses 4 runs (about 45k, 45k, 22k and 45k input
tokens); one verifier sub-agent, about 77k tokens; gentle-ai 8 lens runs over 2 lineages. No evals.

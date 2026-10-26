# remote stop kept batch

## Goal
JH 51: `js-harness remote stop --at-login`, with no `.vbs` launcher and a kept batch launcher of an earlier version
(edited since js-harness wrote it, or not recorded), printed `login launcher: off (there was none)` while the `.cmd`
still starts the server at every login. Opened by the lead's background brief
`~/.js-harness/background/briefs/2026-10-26T10-12-48-047Z-1b4d83a9.md`.

## The user's words
None in this session: it ran from the lead's brief, started with `js-harness sessions start`.

## Delivered
- PR #591 (open, ready to land): commit `e5ed506b` `fix(remote): stop --at-login never says off while it keeps a
  batch launcher`, plus this summary.
- `bin/lib/remote-launcher.mjs` `disableLauncher`: the launcher's "nothing" line is held back when the batch
  launcher is kept (`!batch.ok`), as it already was when the batch launcher's own line was said.
- `bin/remote.test.mjs`: new test `stop --at-login that keeps the batch launcher of an earlier version never says the
  login launcher is off` (edited and unrecorded `.cmd`), RED before the fix: `actual: 'login launcher: off (there was
  none)\n...'`; GREEN after. Pins added: "off (there was none)" with no files and no records; a removed recorded
  `.cmd` says its own line only. A removed recorded `.vbs` and a kept edited `.vbs` were already pinned.

## Decisions
- This session: small task by Task Size, no feature document; the roadmap does not name this bug and is unchanged.
- This session: no gentle-ai review: `gentle-ai review assess --base-ref main --committed-only` gave `review_due:
  false` (`under_budget`, medium, 29 lines); the Stop hook's offer was answered with that read-only assessment only.

## Failures and lessons
- A first pin (`doesNotMatch /there was none/`) also matched the watchdog line "watchdog task: off (there was
  none)"; narrowed to the launcher's line before the fix.

## Left
- Landing PR #591, by the lead under the repository's rules.

## Cost
- Gates: `npm run check` twice (by hand and pre-commit), PASS; `js-harness check --door --base main`, exit 0.
- Codex: `js-harness codex-review --base main` on `c3b8628..e5ed506`, "the patch is correct (confidence 0.98)",
  37,643 input tokens, 37 s; recorded.
- gentle-ai: no review run (not due).

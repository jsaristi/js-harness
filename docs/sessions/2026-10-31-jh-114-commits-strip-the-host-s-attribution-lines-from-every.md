# JH 114 · commits: strip the host's attribution lines from every commit message

## Goal
Build the check his answer to question 132 asked for: take the host's `Co-Authored-By: Claude ...` and
`Claude-Session: ...` lines out of every commit message without stopping the commit, in this repository and in every
project `init` sets up. Opened from the brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-10-31T01-54-53-111Z-1445f2e4.md`; the feature document is
`odd/tasks/strip-attribution.md`.

## The user's words
Question 132, answered "Quitarlas solo" (read with
`js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f 37870`, quoted in the feature document's Specs and
L1). This session's own transcript holds one message from him, the pointer to the brief.

## Delivered
- PR #728, merged (main `75c3583f`): `js-harness commit-msg <file>` (`bin/commit-msg.mjs`) and `.githooks/commit-msg`.
  Commits `951bcfb4` `348378ce` `b0f98b5a` `6110bd91` `589cef49` `71420b38` `7214c0fe`.
- PR #731, ready: `init` and `sync` ship the step to projects, recorded so `uninstall` takes it out
  (`bin/lib/project-hooks.mjs`, `bin/lib/project.mjs`, `bin/lib/project-migrate.mjs`). Commits `7a73e476` `03db395b`
  `dbd6f9cf`, and this summary.
- The real commit: `951bcfb4` was made with both trailers; the hook printed
  `js-harness commit-msg: removed the host's attribution lines: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com> | Claude-Session: https://claude.ai/code/session_…`,
  and `git log -1 --format=%B 951bcfb4` ends with the body's last paragraph ("... The failure's Control is now the
  hook's test."). `git log --format=%B 951bcfb4^..75c3583f | grep -ciE "^(co-authored-by: *claude|claude-session:)"`
  prints 0.
- The planted cases: `node --test bin/commit-msg.test.mjs`, 27 of 27 (both trailers go, a human co-author stays, a
  message with none is unchanged, and the edge cases the reviews found).
- `npm run check`: PASS in the pre-commit gate of every commit, the last `dbd6f9cf` ("PASS check 17 rows passed").
- `docs/FAILURES.md`: `commit-attribution-from-host` controlled, its Control the hook's test. `docs/ROADMAP.md` S4a:
  the hook done.

## Decisions
- His: question 132, take the lines out and never stop the commit (feature document, Specs; ROADMAP S4a).
- His, from the brief: main's past commits are not rewritten (contract, Out of scope).
- This session's, recorded in the Log: not taking gentle-ai's fixed-name-list SUGGESTION and its prose-after-trailer
  WARNING (L10), nor its non-strip-cleanup WARNING and folded-trailer SUGGESTION (L12), each with its reason; not
  taking the verifier's N4 (two linked worktrees recording one shared hook), the pre-push hook's existing pattern (L14).
- The lead's: restart the commit and then the slice 2 tests after two stops for low memory; fast-forward slice 2 onto
  main once #728 landed (L13).

## Failures and lessons
- Claude Code stopped two background runs for low memory: the commit of `71420b38` (its gate ran the tests locally
  after GitHub's run timed out on TLS) and a first slice 2 test run while it waited for the gate lock. Neither was
  restarted until the lead said so; slice 2's tests then ran only the touched files at `--test-concurrency=2`.
- Slice 2's new assertions were written beside the code, not before it (L13). The fix of `7a73e476`'s findings went
  tests first; its own first version read an undefined manifest entry, and the new test caught it before the commit
  (L14).
- The reviews kept finding real edges in `bin/commit-msg.mjs` (bytes, a non-atomic write, a human named Claude, a
  quoted body line, git's comment mark and `auto`, `git commit -v`): each was taken tests first, red then green
  (L4 to L11).
- The host compacted this session once (about 21:58 local); it resumed from the feature document.

## Left
- PR #731 to land; the lead holds it.
- ROADMAP S4a: the count of 0 attribution lines in the next 50 commits on main, the hook-count row and D8 (the engram
  prompt hook off) stay open there.
- Nothing else: the feature document's engram mirror is `odd/strip-attribution/tasks`.

## Cost
- Time: from the brief (2026-10-31T01:54Z) to the ready notice of #731 (2026-10-31T04:59Z), about three hours; context
  at the end about 47 % of the window, after one compaction.
- Codex: 8 reviews, one for each code commit (`951bcfb4`, `348378ce`, `b0f98b5a`, `6110bd91`, `589cef49`, `71420b38`,
  `7a73e476`, `03db395b`). Claude lenses: one run for each of those commits (the first with risk, readability and
  reliability, `7a73e476` with risk and reliability, the rest reliability). gentle-ai: 7 lineages, each approved and
  acknowledged. Independent verifiers: 2 (`951bcfb4`, `7a73e476`).
- Gate runs: one pre-commit gate for each of the 11 commits that landed, plus one stopped for memory; five targeted
  test runs through `js-harness gate --`, plus one stopped for memory.

# JH 165 · audit unit 2: the Stop hook's checks

## Goal
Work unit 2 of the audit triage (PR 805, `docs/audit-triage`): close M7, M8 and M6 of the Fable 5.2 audit
(`claude/fable-5-2-audit-531f8e`). Opened by the lead with `js-harness sessions start`; it read the brief
`~/.js-harness/background/briefs/2026-11-10T06-00-45-942Z-3988aa55.md`.

## The user's words
None in this session: the owner was away. The work came through the lead's brief, quoted in
`odd/tasks/audit-u2-stop-hook.md`, L1.

## Delivered
- PR 807 (`audit-u2-stop-hook`), ready, not merged: `b91e74ef` (feature document), `9135a510` (M7, share-check),
  `ede375ab` (M8, double-review), `4995c9ce` (M6, reply hook), `775f7b52` (reviews recorded).
- Feature document: `odd/tasks/audit-u2-stop-hook.md`.
- Done-when: `node --test bin/lib/share-check.test.mjs bin/double-review.test.mjs bin/reply.test.mjs`, 61 pass,
  0 fail; 56 pass, 5 fail with the new tests and the old code. `npm run check` exit 0 on every commit.

## Decisions
- M6: the triage's first option, made by this session as the brief handed it (the triage marks it the lead's): the
  second stop is checked again and let through, a miss said in a `systemMessage`; no rule's text changed, so no
  question to the owner. Recorded in the feature document, L3.
- The guard's share check keeps its `stop_hook_active` skip (not in the unit); `docs/SPEC.md` left as is (L4).

## Failures and lessons
- The first `closed` notice was refused: `--summary` takes a file of `docs/sessions/`, not a scratch file. Fixed by
  writing this one; nothing else failed.
- The worktree sandbox refuses compound shell commands that name git or quote long text; plain separate commands work.

## Left
- Merging PR 807: the lead's, after the owner's yes.
- A live second stop in Claude Code or Codex was not observed (verifier, L5 of the feature document).
- The two low verifier findings, kept as they are (L5).

## Cost
- Time: brief at 01:00 local, ready notice at 01:34 local.
- Context at the end: about 30 %.
- Reviews: one Codex run (74,172 input tokens, 0.91, no finding); one lens run, risk, reliability and resilience
  (about 73,000 input tokens, 0 findings); one independent verifier on Opus (about 95,000 tokens).
- Gate runs: `npm run check` once by hand, and the pre-commit gate on 6 commits.

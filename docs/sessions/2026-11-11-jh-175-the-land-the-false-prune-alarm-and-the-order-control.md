# JH 175 · the land: the false prune alarm and the order control on two

## Goal
Fix two defects of `js-harness merge-queue --land --refresh-copy` the lead worked around by hand on 2026-11-10: the
prune's check that ended every land with exit 6, and the depth-pass order control that refused a candidate of two
pull requests. Opening: the lead's brief, `2026-11-11T05-20-31-884Z-8e1e332a.md`.

## The user's words
None of his own: the session was started by the lead (JH ORQ) with the brief above, quoted in
`odd/tasks/land-two-defects.md`, L1 and Specs.

## Delivered
- `odd/tasks/land-two-defects.md`: the contract, the depth pass, both designs and the log (`ac2a22e1`).
- Spec 1, bin/lib/refresh-copy.mjs: the check after the prune reads the target a shim runs (`e0e2755a`), a target
  named whole (`d5950864`) and a quoted target with spaces (`e228ff7c`). On the real pnpm bin folder, removing nothing:
  new `[]`, old `["js-harness"]`.
- Spec 2, bin/contract.mjs and bin/lib/depth-pass.mjs: each pull request of a candidate is judged by its own commits
  (`adc2978c`); a candidate is known by the trailer the queue signs its merges with (`34adc86d`, test `bacfc1e6`).
- State: every commit's gate green; pull request ready, the merge his after his yes.

## Decisions
- This session's: the queue signs each merge with `Merged-by: js-harness merge-queue`, so main's merge commits gain
  that line (L11 of the feature document; told to the lead by a note at 01:44 local).
- This session's: no double review of the plan, since the pass supports and adds nothing (L5).

## Failures and lessons
- This document's feature file was edited while Codex reviewed: 160,698 input tokens with no record, run again
  (docs/FAILURES.md, `edit-during-review`, Seen 2026-11-11). Since then every review ran on a committed, clean tree.
- The first fix of spec 2 knew a candidate by the merge subject, which GitHub's merge button also writes: found by
  Codex and both lenses in the second round, fixed in the third.

## Left
- A follow-up, the lead's note of 01:52 local, not in this pull request: the land of PR 815 at 01:17 had its suite
  time out after 1832 s at load 8.0 of 8, and the queue called it red (exit 4), though its help says a gate stopped
  before it ended is no red. Not looked at here. The lead holds it.
- Not checked: shims a real pnpm writes on Linux or macOS; a real refresh and a real land of two, which this
  session was told never to run.

## Cost
- Time: 00:29 to about 02:10 local on 2026-11-11 (the opened notice to the closed one).
- Context: about 90% at the end.
- Reviews: Codex 4 runs, 459,938 input tokens (67,922, 160,698 with no record, 190,666, 40,652); the Claude lenses
  4 runs of 2 lenses; one independent verifier, 90,011 tokens.
- Gates: 6 code commits and 3 document commits, each with its gate, and the merge of main.

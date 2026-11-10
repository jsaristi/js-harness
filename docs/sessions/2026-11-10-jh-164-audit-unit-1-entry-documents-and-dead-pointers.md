# JH 164 · audit unit 1: entry documents and dead pointers

## Goal
Work unit 1 of the Fable 5.2 audit's triage (draft PR 805, `docs/proposals/2026-11-10-audit-triage.md`, section
"### 1. Entry documents and dead pointers"), closing M17 (the `docs/README.md` line only), M18, M19, M28, M15 and
L5. Opening: the lead's brief `~/.js-harness/background/briefs/2026-11-10T06-00-31-576Z-c047b61a.md`.

## The user's words
None in this session: it ran in the background on the lead's brief while he was away. The unit's "Whose call" is the
lead's (triage, section 1).

## Delivered
- PR 806, ready, not merged (merging is the lead's, after his yes). Branch `audit-u1-entry-docs`, from
  origin/main 6ee974dd.
- 17117557 `test(conventions)`: `bin/conventions-workshop.test.mjs`, step 3 of
  `odd/tasks/workshop-product-split.md`. A temporary import of `../../workshop/lib/audit.mjs` in
  `bin/lib/lines.mjs` made it fail naming `lib/lines.mjs imports ../../workshop/lib/audit.mjs`; reverted.
- 7e7ce517 `docs`: README step 1 (M17); SPEC `:173-175` and GUIDE `:124` on `codexReview: auto` (M18); SPEC's
  stack requirement on context7 and the stale gentle-ai clause, and "nine protocols" at `:255`, `:670` (M19);
  ROADMAP's v1.0.0 line (L5); `docs/FLAKY.md` entries removed and `docs/FAILURES.md`
  `engram-listener-unseen-at-kill` updated (M15).
- 47e5525c `fix(conventions)`: Codex's two P2 findings, test first.

## Decisions
- This session: small work by CLAUDE.md's test (outcome understood, no open decision, no high-risk item), so
  inline, no feature document, no writer sub-agent.
- This session: M15's entries removed, not renewed. Evidence: one run each alone on Windows,
  `node --test evals/codex-configs.test.mjs` 19 pass 0 fail, `node --test evals/isolation-probe.test.mjs`
  130 pass 0 fail; an expired entry protects nothing, and renewing with no new failure would be quarantine on no
  evidence. Recorded in 7e7ce517's body and FAILURES.md.
- This session: L5 answered from the record. v1.0.0 was tagged and the upgrade run on 2026-10-18
  (`odd/tasks/harness-review.md` L58); the tag was deleted on 2026-10-19 (`odd/tasks/release-095.md` T3, L10,
  Pregunta 16). The box stays ticked with that said.
- This session: SPEC cites `resolveFunctions` by name in place of the drifted `bin/lib/functions.mjs:131-135`.

## Failures and lessons
- The first convention test missed `import (` with a space and double-quoted HELP entries (Codex, P2 twice). Fixed
  test first; the HELP reader now throws on any line it cannot read, so a missed entry fails rather than passes.
- Compound shell commands naming git were refused by the worktree guard; split into single commands.

## Left
- Nothing of unit 1. Open beside it, not this session's: the other workshop-command mentions (T6 of
  `odd/tasks/workshop-product-split.md`), and SPEC's protocol count has no check holding it to `PROTOCOLS.length`.
- Not checked: the two formerly quarantined files under load or in WSL2.

## Cost
- Time: brief at 06:00Z, ready notice at 06:30:42Z.
- Context: 30% at the ready notice.
- Gate runs: `npm run check` once (exit 0), the pre-commit gate on three commits (each PASS), the pre-push
  `check --push` once (passed).
- Codex: two runs, 93,560 input tokens on 6ee974d..7e7ce51 (incorrect, two P2), then 7e7ce51..47e5525 (correct,
  0.97, 2 of 2 fixed).
- Claude lenses: reliability and readability over 6ee974d..47e5525, 0 findings, about 31,600 input tokens.
- The two quarantined test files run once each (about 16 s and 141 s).

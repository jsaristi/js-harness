# JH 199 · sin desperdicio de Codex

## Goal
Cut Codex waste without weakening any review: tasks T1 to T6 of `odd/tasks/codex-spend.md`. This session delivered T1 and T2. Its last opening, which it read on resume, is `~/.js-harness/channel/openings/D--js-harness/jh-199-sin-desperdicio-de-codex-9398c4993f25.json`.

## The user's words
The owner's words reached this session through the lead's brief and are recorded in the feature document's Log (L1, `odd/tasks/codex-spend.md`):
- "hazme la pregunta de bloquear cuando pase y ademas aplica las mejoras para que no haya ningun desperdicio como lo mencionas y dices"
- "cuando hayan mas de 3 reinicios te autorizo en utilizar uno…" (Codex reset credits)

Owner's yes to land 883: Q288, as the lead relayed it in its 10:32 local note of 2026-11-15.

## Delivered
- **T1, PR 878** (merged). codex-review no longer fails when the worktree changes mid-run: it reviews a detached snapshot worktree.
- **T2 and the chain fix, PR 883** (merged at `2026-11-15T15:31:21Z`, main c7afe0be):
  - d1c152a6: the gap below a merge of main is reviewed alone.
  - 74256214, 457bb1c9, a5d528dc: `recheckThrough`/`recheckAt`, one first-parent walk that the run, the cut at a merge and the push row all read.
  - 13367429: Codex's three P2 fixed (an empty gap, the cap above a second merge, `writesNothing` now asks `reviewCoverage`).
  - Docs: L22 to L32.
- **Feature document:** `odd/tasks/codex-spend.md`, State and Log up to L33.

## Decisions
- **Option B, the lead's** (L29): open the PR rather than run a fourth writer round; X1 became a follow-up. JH 199 then found that the push refuses an owed correction, so the three P2 were fixed before the PR (L30, told to the lead at 04:58 local).
- **B1-1 and B1-2, JH 199's reading** (L25 and the PR 883 body): the rule decides neither, so neither was fixed in T2.
- **The lead's narrow verifier before landing,** with its outcome fixed beforehand: fail-open faults do not land (lead's message, 2026-11-15). Its verdict was fails open, Y1 (L32), and 883 was held for the owner.
- **The land of 883, the owner's** (Q288). Y1 goes to JH 207 (lead's note, 10:32 local).

## Failures and lessons
- **A regression in every verifier round:** V1/V2 on 74256214, W1 on 457bb1c9, X1 on a5d528dc, Y1 on 13367429 (L24, L26, L28, L32). Only the verifier found them; Codex and the lenses passed each delta. The lead now holds code that has had no verifier pass for one narrow pass before landing.
- **Y1 is a fail-open fault older than this work.** It is on main 7de0b95: a change and its revert above an owed review record nothing-to-review, and the push row passes. Evidence: `scratchpad\verify5\out-C1f-main.txt`, and `jh199-verify5-883.md` in the lead's notes folder.
- **The doc's title and `## State` header were overwritten.** A State-writing scratch script overwrote them at d1c152a6, and the gate did not catch it. Restored at 08653f93; `check` went from 18 to 21 rows once the contract read again.
- **"Gate passed" ran no tests locally:** gate.yml runs them in CI. The writer's file-by-file runs were the evidence. Confirmed a CI gate run on 13367429's tree a9cbb1d.
- **Draft and ready crossed:** the lead drafted 883 to keep it out of 882's land, and JH 199 un-drafted it without knowing why. Told to the lead at once; no harm, since 882's land left 883 out.

## Left
- **Y1:** JH 207.
- **Other follow-ups:** X2 to X6, W2, W4 and W7 (L26, L28), V3/B1-2 and V4 (L24). There is also no counting test for the git processes `writesNothing` now starts.
- **T3, T5, T4 and T6 of codex-spend:** not started, held by the lead.
- **The worktree** `D:\js-harness-worktrees\codex-spend` is still locked "JH 199 live". The lead unlocks or removes it.

## Cost
- **Codex**, this stretch: 1,016,226 input tokens on c472dcb..3ddfd3e and 126,887 on the recheck 6e6adbf..1336742. T1's reviews are in L16 to L18.
- **Claude lenses** (risk, reliability): about 151k tokens on c472dcb..3ddfd3e and 35k on the fix.
- **Verifier sub-agents:** four passes. The last cost 282,904 tokens.
- **Writer sub-agents:** four rounds. The last cost 199,188 tokens over 80 minutes.
- **CI gate runs:** one per code commit; 13367429's run was green on its tree.
- **Context at close:** about 52% of the window.

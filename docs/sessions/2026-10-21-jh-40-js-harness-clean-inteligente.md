# JH 40 · js-harness clean inteligente

## Goal
Build `js-harness clean` as an ODD feature (odd/tasks/clean.md). It lists the stack's regenerable leftovers, deletes only on a yes and records what it deleted. A periodic measure recommends running it. The orchestrator opened this session at 19:16 local on 2026-10-20, from its brief, on branch feat/clean.

## The user's words
"Listo hagamos esto" and "Quiero que ese js-harness clean sea tambien inteligente y cada cierto tiempo le pida permiso al usuario osea el harnes analiza que tanta basura tiene y le recomienda al usuario aplicar el clean". The orchestrator relayed both; they are quoted in odd/tasks/clean.md L1.

## Delivered
- PR 487, merged as 6b8a16a8. Its commits:
  - f4c550e7 the command
  - 9e66d1a1 the doctor row and the weekly background measure
  - ba519eb7 fix: scratch holding any git repository, and `--kind` deduped
  - 41b4a893 fix: guard each cache folder before its tool, and count only folders as scratch
  - 8712378f fix: a cache holding a git repository goes to its tool only when a CACHEDIR.TAG marks it a cache
  - ba4d8410, 2fa562a5 and a48e38fb record the reviews in the feature document
- Feature document: odd/tasks/clean.md, T1 to T3 done (`js-harness progress`: Clean 3/3).

## Decisions
- The recommendation is a doctor row plus a SessionStart notice, not `notify --kind question`. This session chose it because the hook already runs on every machine, caches its result and shows a change only once. Recorded in S9 and in the PR body.
- The defaults are a 7-day interval, a 2 GB threshold, 3-day-old scratch, the scratch names `tmp.*` and `js-harness-*`, and the notice wording. This session chose them as assumptions (S10). The user confirmed the interval and threshold through the lead ("Sí, así está bien", Pregunta 37).
- A repository inside a tagged cache is deleted with it, as the tool's own clean command would delete it. This session accepted that trade (L7).

## Failures and lessons
- The first Codex review was spoiled because this session edited odd/tasks/clean.md while the review ran. `codex-review` wrote no record, and it said why. Lesson: commit first, then review, and touch nothing while it runs.
- 41b4a893 refused any cache folder holding a git repository. This machine's uv cache holds `sdists-v9/.git`, so `uv cache clean` would never have run. gentle-ai's advisory R3-cache-git-checkout-refusal found it, and `measureTree` on the real uv cache confirmed it (`linkedWorktree: true`). The fix is 8712378f.
- `notify --kind ready` needs `--pr`, and it reads the PR with gh and git fetch. github.com timed out for about 30 minutes, so the notice went out from a background retry loop at 2026-10-21T01:19:51Z.

## Left
Follow-ups from the review advisories (odd/tasks/clean.md L5 to L7). Nobody holds them yet; the lead decides.
- A pnpm store on a drive other than the one the tool runs from is not seen.
- A cache tool resolves its folder again after the check (R1-001).
- The measure is written without an atomic write.
- Renaming a file binary that is running is not guarded.
- R3-003: the CACHEDIR.TAG test does not assert the log entries.

## Cost
- Time: opening at 19:16 local, ready notice at 20:19 local. The host compacted the session once, at 19:24.
- Context at the end: about 39 % (the ready notice).
- gentle-ai: 4 reviews (review-cbebddd665ec664f, review-72559356176c153c, review-d76fbd52b2b7a939, review-ff3ecb0e59b1148d).
- Codex: 3 runs. One was spoiled; the other two are recorded, e22ef3f..ba4d841 and ba4d841..2fa562a. In all, about 410k input tokens.
- The pre-commit gate ran on every commit.

# JH 112 · gate and push: two holes left open after JH 111

## Goal
Opened from the lead's brief `briefs/2026-10-30T23-55-19-267Z-aee663a3.md`: two defects, each its own slice and PR, in
this order. (1) The pre-push hook took a cut the merge door then refused (`js-harness failures door-covers-past-tip`).
(2) The gate log forgot a failure once its rotation dropped it, and a tree committed unchanged after that was proven
again. Feature document: `odd/tasks/gate-push-holes.md`.

## The user's words
"Your brief is in C:\Users\Oficina\.js-harness\background\briefs\2026-10-30T23-55-19-267Z-aee663a3.md: read it whole
before anything else, and do the work it gives you. Its last section says how you report." (this session's only user
message). The brief's items, quoted, are S1-S3 of the feature document.

## Delivered
- Slice 1, PR 723, merged at 01:01Z:
  - `2b678054` fix(check): `reviewCoverage` takes `beyondTip: false` on the push, the plain rows, `lensCoverage`,
    `codex-review`'s start and `mergeStart`'s merge reading, so a record whose head lies past the tip covers nothing
    there, as at the door. Planted cut red, then green (L6).
  - `1283e5f2` the verifier's fixes: the refusal says to check the cut out and make its record, and a merge cut is
    read by its own lines (L8).
  - `docs/FAILURES.md`: `door-covers-past-tip` is controlled by the planted cut test.
- Slice 2, branch `gate-forgotten-failure`:
  - `bebf5238` fix(gate-log): failing ends that name their files are also kept in `failed.jsonl` beside the log, rotated
    at the same `gate-log-size`; the proof reads them with the log (`readGateProof`); a pass whose end names no files
    proves nothing. Planted case red, then green (L13).
  - `f9d4c09c` the verifier's and gentle-ai's fixes: a failure the log lacks goes where its time puts it, and a log
    file that cannot be read gives no proof (L14).

## Decisions
- L3: the rule goes into the one function the push and the door both read (`reviewCoverage`), as an option, not a
  copy.
- L5: a failures file outside the log's rotation, not refusing `same` by age, not dropping `code` from a pass.
- L14: the failures written between PR 721 and `bebf5238` are left in the log alone; they leave it by about
  2026-11-10.

## Failures and lessons
- Two gate runs failed once on CI (L7, L9): a line ceiling with a test of the old rule in a file the local run did not
  hold, and a test comment that named the review tool. Each was read before the second run.
- The worktree guard refused compound commands that name git or paths; commit messages went through files.
- The host compacted this session at 00:56Z, after the feature document and slice 1 were committed; it resumed from
  the document's Next step.

## Left
- `codexSkipsOwed` and `baseLeftOut` still count records past the tip (they refuse nothing); gentle-ai's two
  SUGGESTIONs on `1283e5f2` (`beyondLines`'s empty `tip` default, 7-character abbreviations). Sent to the lead at 00:55Z.
- `bin/lib/manifest.mjs:1448` says the gate-log folder holds two files; it holds more, and is removed whole.
- Failures written between PR 721 and `bebf5238` (L14 item 1), until about 2026-11-10.

## Cost
- Reviews: Codex four times, correct each (0.88, 0.9, 0.88, 0.9; about 107k to 130k input tokens a run). The Claude
  lenses on all four code commits, 0 findings. gentle-ai on each code commit, approved; one WARNING (`R3-001`, fixed in
  `f9d4c09c`) and three SUGGESTIONs. Two independent verifiers, one a slice.
- Gates: eight pre-commit runs (this document's commit among them), two failed once and passed on the second; a
  pre-push run for each slice.

# JH 111 · gate: a pass that skipped tests must not stand for a commit

## Goal
A gate no longer takes a pass as the proof of a tree when a run of the same files failed somewhere the pass did not
run. So a commit whose tests failed on CI is refused until a run as wide as that one passes. Brief:
`~/.js-harness/background/briefs/2026-10-30T22-36-50-255Z-ff7bc7b9.md`. Feature document:
`odd/tasks/gate-narrow-pass.md`.

## The user's words
This session had none of his words: the lead's brief gave the work, quoting JH 109's L8
(`odd/tasks/f8-s9-host-watch.md`). Sebastián was away and was asked nothing; no question was recorded.

## The cause
The fault was in `same`, not in the mirror's skip (L2). Gate-log lines 307-311 show it: a commit's gate on CI failed
with no tree key on its end; a hand check then passed in the WSL mirror, with 214 of 312 tests skipped; the next
commit wrote `same` by that pass. Lines 312-316 repeat the sequence. `provenBy` read only the last passing end that
held the key. `checkSensors` asks it before the tests go to CI, so the failure on CI was invisible to it.

The skip in `bin/lib/gentle-ai-absence.test.mjs` is by design. The mirror has no `.git`, so what a commit holds
cannot be told there, and CI holds that check.

## Delivered
- `filesKey` (`bin/lib/gate-tree.mjs`): the key of the index's files, with no runtime, sensors or place in it.
- Every gate's end, CI's included, now names `files`. It names `tried`, the tree key the gate ran under, only where
  the sensors ran where that key says.
- `provenBy` (`bin/lib/gate-log.mjs`) refuses a pass when a gate of the same files failed after it, or before it
  under another key (CI has none). It also refuses when the gate cannot name its files.
- `testsOnCi` moved from `bin/check.mjs` to `bin/lib/ci-gate.mjs`, because `check.mjs` may not grow. Its ceiling
  went down to 2010.
- The ROADMAP's Sensors row is amended, and `docs/FAILURES.md` has a new entry, `gate-narrow-pass-stood`.
- Tests: the planted case was red before the fix and is green after it, with three more `check` cases and the unit
  cases.
- Commits: `5754e11a`, `41bfc83c`, `1bddd479`, `90260996`, `ca97c13f` on `worktree-gate-narrow-pass`.

## Decisions
- This session: a failure stands against a pass that came after it unless the failure ran under the pass's own key.
  A tree that failed in one place therefore runs its sensors again in another until the failure rotates out of the
  log. That costs a run, never a proof (L5).

## Failures and lessons
- The first commit of the fix failed its gate on CI. `bin/check.mjs` grew past its size ceiling. I read why before
  running anything again, and moved `testsOnCi` out of the file (L6).
- My first comparison used `ranIn` alone. Codex found that two WSL2 distributions both read `wsl`, so the comparison
  could not tell them apart (L7).
- The verifier found that a failure which fell back to Windows was written under the WSL2 key (L8). Both were fixed
  tests first.
- The reliability lens found that a sensor which threw left the pre-run `files` key on its end, unchecked (L9).
  Fixed tests first.

## Left
- For the lead, sent as a note: a failure is forgotten once the gate log rotates it out, after roughly 350 to 700
  gates. CI failures written before this fix carry no `files` key, so they stand against nothing.
- The installed js-harness writes the new fields only after an update to a version that holds this change.

## Cost
- Codex: 4 recorded reviews, 145,406 + 41,732 + 111,967 + 63,923 input tokens.
- Claude lenses: 4 recorded runs, reliability and risk on the first three and reliability alone on the last; about
  120,000 input tokens in all.
- One independent verifier: 100,300 tokens.
- gentle-ai: read-only status only.
- Gates on CI: one per commit, about 3 minutes each; one failed. One `npm run check` by hand, 177 s.

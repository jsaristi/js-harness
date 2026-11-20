## State
T1 done; T2 next: the lenses, Codex held for the weekly reset, the draft PR.

## Goal
The contracts row judges a branch stacked on another session's branch by its own commits, so it can commit its depth
pass before the base lands.

## Why
`branchOf` (bin/contract.mjs:447-458) reads `trunk..HEAD` whole, so the base's code reads as code committed before the
stacked branch's verdict. JH 207's S1 was refused on 2026-11-15 and waited until PR 883 landed (docs/ROADMAP.md, the
contracts row item). The rule must stay as strict for every other branch: this loosens what a guard reads.

## Done when
- `node --test bin/lib/depth-pass.test.mjs` exits 0, with the three stacked-branch tests among its cases
- `npm run check` exits 0

## In scope / Out of scope
- In: `bin/contract.mjs` (`branchOf` and `readJudge`), `bin/lib/depth-pass.test.mjs`, this document, the item in
  `docs/ROADMAP.md`.
- Out: `bin/lib/depth-pass.mjs`, the judge, which reads whatever history it is given; CI and the merge queue's
  candidate, which have no reflog and keep reading the whole range (L2); the files other open sessions hold.

## Constraints
- Where nothing proves a base, the whole `trunk..HEAD` is read, as today — because a gate that cannot tell stays
  strict.

## Ask me before
Nothing: landing it is the owner's, through the lead.

## Depth pass
- 1. Method: a version-control engineer's: a branch's own commits are those after the point it was cut from, and only
  git's own record of that point counts; the smallest change reads that point where git keeps it and changes no
  judgment of the judge.
- 2. Raw material: `bin/contract.mjs:451` (`log ... ${trunk}..HEAD`); `bin/contract.mjs:517` and `:520` (`onTrunk`
  and `trail`, which read the same trunk); docs/ROADMAP.md:938-940 (the item); the reflog of JH 207's branch in
  `D:\js-harness`, `git reflog show feat/review-gate`, whose oldest line is `08653f93 feat/review-gate@{49}: branch:
  Created from 08653f93`; `.github/workflows/gate.yml:31-33` (CI checks out a fresh clone, which has no reflog).
- 3. The bar:
  spec 1: `node --test --test-name-pattern="stacked|no other branch" bin/lib/depth-pass.test.mjs`: 1 of 3 pass today;
  the stacked branch is refused for the base's `bin/b.mjs`
- 4. Refutation: the request fails if git keeps no record of where a stacked branch was cut. Run now: `git reflog
  show feat/review-gate`, in `D:\js-harness`, ends on `branch: Created from 08653f93`, PR 883's head, so the case that
  was refused carries its base. A branch the app makes has no reflog (`git reflog show
  claude/jh240-contract-row-a7d45f` prints nothing), and is read whole, as today.
  Verdict: supports
- 5. Request: read a branch from the commit its reflog says it was created from, when that commit is not on the trunk,
  is an ancestor of HEAD and another branch holds it; that commit then stands where the trunk stood, for the
  branch's commits, the document's trail and the verdict already judged; anything else reads `trunk..HEAD` as today.
  Adds: none

## Specs
1. The lead's brief (2026-11-19, brief-contract-row.md): "Make it read only the branch's own commits, test first with
   a stacked-branch fixture beside its test."

## Tasks
- [x] T1 (kind: build) The stacked-branch tests, then `stackBaseOf` in `branchOf` and `readJudge` — spec 1 (this commit)
- [ ] T2 (kind: verify) The lenses, Codex held, the item ticked, the draft PR, `notify --kind ready`

## Log
- L1 (2026-11-19, the lead's brief): "docs/ROADMAP.md:940 (owner: the next contract-row session): bin/contract.mjs
  `branchOf` reads `trunk..HEAD` whole, so a branch stacked on another session's code cannot commit its depth pass
  (JH 207's S1, 2026-11-15). Make it read only the branch's own commits, test first with a stacked-branch fixture
  beside its test. This changes what a gate reads: judge small or large against AGENTS.md's high-risk list, and open
  a feature document if large."
- L2 (2026-11-19): large, since it loosens what a guard reads (high-risk item 2). The base is the reflog's creation
  point, kept only when another branch, local or remote, holds it: a commit no other branch holds is no evidence that
  the code below is another's, so cutting a branch from one's own code hides nothing. Where the gate runs without a
  reflog, CI's fresh clone, a detached candidate of the merge queue, a branch the app made, the whole range is read
  as before: a stacked pull request can still be refused on CI until its base lands. Seen while writing the fixture:
  `git log --follow` takes a new document for a copy of a similar one, so the base's document in the test carries a
  log of its own.
- L3 (2026-11-19): reviews of 3d89c37..30f8904. Codex held for the weekly reset (2026-11-23 23:45), recorded with
  `--unavailable`. Lenses risk: 0 findings; reliability: 1 WARNING, fixed: a branch cut from another pull request's
  remote-tracking ref (`git checkout -b stacked origin/pr-883`) takes it as its upstream, and the upstream was left
  out of the base's holders, so that branch was read whole. Only the branch's own pushed copy,
  `refs/remotes/<remote>/<its name>`, is left out now; tested with a tracked remote ref.

## Goal
The gate of a merge being made sends CI a snapshot whose parents are the merge commit's: HEAD and every head in
MERGE_HEAD.

## Why
Merging today's main into PR #596's branch (JH 152, odd/tasks/stack-upgrade.md S2) was refused on CI by rule
depth-pass for 16 of main's own feature documents, while the same row passed locally. `runCiGate` builds the
snapshot with `commit-tree -p HEAD` only (bin/lib/ci-gate.mjs:116-118), so on CI the 457 merged commits of main look
like the branch's own; locally `depthPassFor` reads MERGE_HEAD (bin/contract.mjs:477). Every merge of main into an
older branch hits it.

## Done when
- `node --test bin/lib/ci-gate.test.mjs` exits 0, with the test of a merge being made checking both parents
- `npm run check` exits 0
- A merge of main into an older branch passes its gate on CI as it does locally (seen when JH 152 merges main into
  #596's branch, after this lands)

## In scope / Out of scope
- In: `bin/lib/ci-gate.mjs` (the snapshot's parents) and its test.
- Out: rule depth-pass and `bin/contract.mjs`, which already read MERGE_HEAD locally; the workflow file.

## Constraints
- The snapshot stays a commit nobody merges, pushed with `--no-verify` and deleted after — because the gate only
  reads it.

## Ask me before
Nothing: merging it is the owner's, through the lead.

## Depth pass
- 1. Method: a CI check must judge the same commit graph the local check judges; the smallest change gives the
  snapshot the parents `git commit` will give the merge, and no other check changes.
- 2. Raw material: `bin/lib/ci-gate.mjs:116-118` (`commit-tree` with `-p HEAD` only); `bin/contract.mjs:477`
  (`openedOn(git, [trunk, 'MERGE_HEAD'])`, the local read); the refused merge's log in JH 152 (scratchpad
  merge596.log: "FAIL  contracts  18 of 168 contracts fail" on CI against "PASS  contracts  168 contracts checked"
  locally); the lead's call, 2026-11-06, relayed in JH 152: "Do the fix yourself, since you hold the diagnosis".
- 3. The bar:
  spec 1: `node --test --test-name-pattern="merge being made" bin/lib/ci-gate.test.mjs`: fails today, the snapshot
  has one parent
- 4. Refutation: if CI already received MERGE_HEAD, the snapshot of a merge in a scratch repository would have two
  parents. Run now: `node --test --test-name-pattern="merge being made" bin/lib/ci-gate.test.mjs` gives
  "actual: [ '0807f03f…' ]" against two expected parents.
  Verdict: supports
- 5. Request: give the CI snapshot of a merge being made the parents HEAD and each MERGE_HEAD line, tested with a
  real merge in a scratch repository, and change nothing else in the gate.
  Adds: none

## Specs
1. The lead's call (2026-11-06, JH 152): "a fix/ branch cut from today's origin/main in a worktree of its own (not on
   feat/stack-upgrade or #596's branch), test first (a merge in progress gives the snapshot both parents, HEAD and
   MERGE_HEAD, and the depth-pass row then passes on CI as it does locally), Codex and the lenses, and since it
   touches CI (a high-risk item) one independent verifier over it."

## Tasks
- [x] T1 (kind: build) The test of a merge being made, then `mergeHeads` in the snapshot — spec 1 (a1ed109e)
- [ ] T2 (kind: verify) Codex, the lenses, one independent verifier, the PR, `notify --kind ready`

## Log
- L1 (2026-11-06, the lead in JH 152): option 1 of two (a fix here; a rebase and force-push of #596 is out, since
  it rewrites his PR). Merging is his, through the lead.
- L2 (2026-11-06): reviews of a1ed109e. Codex: the patch is correct (0.92). Lenses risk and reliability: 0 findings
  over 9035cd30..a1ed109e. The independent verifier: "the change holds", over plain, octopus, conflict-resolved and
  squash merges, GIT_DIR and linked worktrees (a worktree's MERGE_HEAD does not leak to another). Its low notes,
  left as they are: the push now carries the merged heads' history, which a public repository already shows once
  merged; git older than 2.31 lacks `--path-format` and falls back to one parent, as before; one rare case where CI
  and the local `openedOn` can still differ. Its test gap, closed: the green-run test asserts the whole parent list
  (`rev-list --parents`), so a stray extra parent fails it.

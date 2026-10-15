The merge queue no longer leaves out a pull request whose mergeable GitHub has not computed yet.
Branch: fix/queue-unknown-mergeable. Delivery: single-pr, as a draft. Tests: `node --test`.

## Goal
A ready pull request whose `mergeable` reads UNKNOWN joins the candidate when it merges into it, instead of
being left out of the batch.

## Why
GitHub recomputes `mergeable` for about a minute after main moves, and answers UNKNOWN meanwhile. The queue
reads it right after the previous batch moved main, so a batch lost every ready pull request it read in that
minute: batch 4 lost 6. The queue already merges each pull request into the candidate itself, which is the
test of whether it merges.

## Done when
- `node --test bin/merge-queue.test.mjs` exits 0
- `npm run check` exits 0

## In scope / Out of scope
- In: bin/merge-queue.mjs, bin/merge-queue.test.mjs, this document.
- Out: bin/lib/merge-ready.mjs (`pullRequestProblems`) and README.md, which PR 209 moves and rewrites: a second change to them would conflict in the queue.

## Constraints
- CONFLICTING is still left out with the same sentence — because it is GitHub's computed answer, and S4 of merge-queue.md is the queue's contract.

## Ask me before
- Nothing beyond the repository's rules.

## Specs
- S1. The lead's order (channel note from "JH ORQ · js-harness (350k)" to JH 21, 2026-10-15 08:07, repeated 08:12): "merge-queue leaves a PR out when GitHub's mergeable is UNKNOWN, as it is for about a minute after main moves (batch 4 lost 6 ready PRs). Fix it test-first: re-read UNKNOWN a few times, or decide with the git merge-tree it already runs. Draft PR, then tell me."
- S2. Decided by the merge (L2): a pull request whose mergeable is UNKNOWN is not left out for it; its `git merge` into the candidate decides, as for any other: merged when it merges, left out naming the files when it conflicts.
- S3. The queue's usage says so.

## Tasks
- [x] T1 (S2, S3, kind: build): UNKNOWN is decided by the merge into the candidate. Route: inline. RED: "a pull request GitHub has not yet computed..." left out PR 1 and PR 3 as "not mergeable (UNKNOWN)"; GREEN: bin/merge-queue.test.mjs 19 of 19.

## Log
- L1. 2026-10-15 08:14, the lead's order, quoted in S1.
- L2. 2026-10-15, decided by the merge rather than re-read: re-reading costs a wait of up to a minute on every batch after a landing and can still end UNKNOWN, while the queue already runs `git merge --no-ff` of each pull request into the candidate (bin/merge-queue.mjs, the loop over `candidates`), which names the conflicting files. A pull request that conflicts with main conflicts with a candidate that starts at main, so nothing GitHub would have said is lost.

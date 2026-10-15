The merge queue names a pull request whose head moved while it was landed, so its new commits are landed again.
Branch: fix/queue-head-moved-during-land. Delivery: single-pr, as a draft. Tests: `node --test`.

## Goal
After main is pushed, the queue says which landed pull request's head is no longer the commit it merged, with the
new head, so the lead lands it again instead of finding it open with commits that are not on main.

## Why
JH 15 pushed 08bfb77 to PR 222 while its land ran: the queue landed the older head (main 2be9532), GitHub left 222
open, and nothing said that a commit of it is not on main.

## Done when
- `node --test bin/merge-queue.test.mjs` exits 0
- `npm run check` exits 0

## In scope / Out of scope
- In: bin/merge-queue.mjs, bin/merge-queue.test.mjs, this document.
- Out: README.md and bin/lib/pull-request.mjs, which PR 209 rewrites, so a second change to them would conflict in the queue.

## Constraints
- The push of main is not stopped for a moved head: the candidate was tested whole, and what it holds is sound.

## Ask me before
- Nothing beyond the repository's rules.

## Specs
- S1. The lead's order (cross-session message from "JH ORQ · js-harness (350k)" to JH 21, 2026-10-15 11:30): "JH 15 pushed 08bfb77 to PR 222 while its land ran; the queue landed the older head (main 2be9532) and 222 stays OPEN with a commit not on main. The queue should notice a head that moved between building the candidate and pushing main: name it in its output ("PR 222 moved to 08bfb77 during the land; its new commits are not in main") so the lead re-lands it. Do not stop the push for it. Test first, its own branch, draft PR, tell me."
- S2. After main is pushed, each landed pull request whose branch on origin is no longer the head the candidate merged is named, one line each, after the "Landed:" line: "PR <n> moved to <7 hex> during the land; its new commits are not in main." Exit stays 0.
- S3. A landing with no head moved prints exactly what it printed before.

## Tasks
- [x] T1 (S2, S3, kind: build): read the landed heads after the push of main and name the moved ones. Route: inline. RED: the landing printed no line for PR 1, whose branch moved; GREEN: bin/merge-queue.test.mjs 21 of 21.

## Log
- L1. 2026-10-15 11:30, the lead's order, quoted in S1.
- L2. 2026-10-15 11:37: the heads are read with one `git ls-remote origin` of the landed branches after the push of main, so a
  head pushed at any moment of the land is caught; a read that fails is said, never taken for no head moved (second
  test). Exit stays 0: main moved, as S1 asks.

# again-subrange: an --again over part of a range does not clear an owed correction

## State
JH 207, worktree D:/js-harness-worktrees/again-subrange, branch feat/again-subrange from main 45a40e8 (PR 896 landed).
T1 done (L2); T2 built and reviewed (L5-L10): b78093fe, f2059356, 420b76c3, 308580ff. Next: push, the pull request, the
ready notice to the lead. T3 (L84) stays open by the lead's word. The background wait for notices to 207 runs until
this session closes.
## Goal
A clean Codex review at a head that owes a correction settles that correction only where it reads the whole range the
owing review read.

## Why
The third verifier pass on PR 896 (odd/tasks/review-gate.md L71 A): an honest `codex-review --again` over a clean
sub-range ending at the owing head clears the correction, since the last admitted reviewed record at a head decides
(bin/lib/codex-review-recheck.mjs:180) and `againPastThreeReviews` refuses only at three reviews (:338-348). Main had it
before PR 896.

## Done when
- `node --test bin/check-codex-reviews.test.mjs bin/codex-review.test.mjs bin/codex-review.second.test.mjs` exits 0
- The push row still refuses after a clean --again of a sub-range that ends at the owing head.

## In scope / Out of scope
- In: bin/lib/codex-review-recheck.mjs, bin/lib/codex-review-rows.mjs and their tests; L84 as T3.
- Out: the lens records' admission (landed in PR 896), because it is not what A is about.

## Constraints
- Count the real records before anything changes what they mean — the lead (2026-11-16 message, L1).
- Tests first — the lead.

## Ask me before
Nothing beyond the lead's scope; questions go to the lead by notify.

## Depth pass
- 1. Method: a recheck settles what the review it rechecks read, as code review settles a finding only by reading the
  change that carries it; the smallest change: a later reviewed record at the owing head settles the correction only
  where its base is at or before the owing record's base.
- 2. Raw material: `bin/lib/codex-review-recheck.mjs:180` (the last reviewed record at a head decides), :338-348
  (`againPastThreeReviews`); odd/tasks/review-gate.md L71 A; the verifier's probe a-again-subrange.mjs and its .out
  (JH 207's scratchpad, probes3).
- 3. The bar:
  spec 1: `node --test --test-name-pattern="again of a sub-range" bin/check-codex-reviews.test.mjs`: none, new behaviour
  spec 2: left out because it is an open task, built after spec 1
- 4. Refutation: `node a-again-subrange.mjs` (the verifier's probe, run on main and on the branch): after a clean
  --again of M..H the push row went from "owes a correction: 1 finding open" to pass.
  Verdict: supports
- 5. Request: as spec 1, with the real records counted before the rule changes what they mean.
  Adds: none

## Specs
1. L71 A, the lead's words: "Start T10 from main: the L71 A fix as its own slice, tests first, real records counted
   first."
2. L84, the lead's words: "Add L84 (olderWriter counts the whole log, so after the cut the lens note can name an
   unrelated record) to that slice as an open task."

## Tasks
- [x] T1 (kind: design) count the real records, depth pass
- [x] T2 (kind: build) spec 1, tests first
- [ ] T3 (kind: build) spec 2, open: the lens rows' older-writer note counts only records of the range checked

## Log
- L1 2026-11-16, the lead (message to JH 207): "PR 896 landed. main 83252ac is now 45a40e8 ... Start T10 from main: the
  L71 A fix as its own slice, tests first, real records counted first. Add L84 ... to that slice as an open task ...
  does the new admission still admit the review records of the open branches, PR 897 and PR 894?" Checked with main's
  code (45a40e8, read-only, scratchpad openprs.mjs): PR 897 codex and lens push rows PASS, 1 code commit covered by
  both; PR 894 PASS, no code commits; reported by note. The D:/js-harness checkout is still at 83252acb.
- L2 2026-11-16, counted read-only with main's code (scratchpad t10count.mjs): 1,401 admitted reviewed Codex records
  over 1,398 heads; 2 heads hold more than one; 0 later records there have a base that is not at or before the earlier
  one's. The rule of spec 1 changes what no real record means today. Next: the red test of spec 1.
- L3 2026-11-16, spec 1's red test written (uncommitted) at the end of bin/check-codex-reviews.test.mjs, 'an --again of a sub-range that ends at the head owing a correction does not settle it': red for its reason, the push row passes ('3 code commits since origin/main, all covered'). Next: the fix where the last reviewed record at a head decides (bin/lib/codex-review-recheck.mjs:180): a later record settles only where its base is at or before the earlier one's.
- L4 2026-11-16, read before the fix: recheckState takes `prior = reviewed.filter((rec) => rec.head === from).at(-1)` (codex-review-recheck.mjs:180). Open: whether recheckState can ask git (an `holds` function is in scope at :187) for the ancestry the rule needs; if not, pass a predicate from its callers (correctionOwed, recheckAt, afterTurn). Choose the smallest; check the 2 real heads with more than one record keep their reading.
- L5 2026-11-16, spec 1 built: `decidingRecord` (codex-review-recheck.mjs) reads the reviewed records at a head in order; a later one replaces an earlier one that owes only where its base is at or before (`atOrBefore`, `git merge-base --is-ancestor` through `atOrBeforeIn` in codex-review-turns.mjs; unknown keeps the debt; equal bases need no git). Wired into the push row, `recheckAt`/`recheckThrough` and `afterTurn`; the row's message reads the same record. Tests: the row test of L3 and a unit test in codex-review-recheck.test.mjs, red before, green after; the targeted files 212 of 214 pass, 0 fail. Real heads (scratchpad t10keep.mjs): e3aad480 (3 records) and ed1fd0e1 (2) read `review` with the rule and with the last record alone. L2 said 2 heads with more than one record; one holds 3.
- L6 2026-11-16, Codex on c2b1705..b78093f (157,959 input tokens): incorrect, one P2, "Preserve findings from later narrower reviews": a narrower review that owes too was dropped, so a recheck of the wider debt alone could settle it. Fixed tests first: where both owe a first recheck, the recheck takes up the findings of both; any other pair keeps the wider debt alone. Next: the targeted files, the commit, Codex's recheck, the lenses.
- L7 2026-11-16, Codex's recheck of b78093f..f205935 (38,638 input tokens): correct, 1 fixed, 0 not fixed. The Claude lenses reliability and risk over 45a40e8..f205935: complete, 0 findings each (13,811 and 13,814 input tokens). Targeted files after the fix: 599 of 604 pass, 0 fail. Next: push and the pull request.
- L8 2026-11-16, the advisor before ready: three more readers took the raw last record at a head. `second` in `recheckState` (a clean --again between a recheck and the second recheck offered a fourth review; red test 'a clean --again over part of the range of a recheck ...', now refused with reviews: 3), `lastAt` in `recheckThrough` and `mergeOwnAt` in the push row: all read `decidingRecord` now. Routing `second` through it broke codex-spend L24 gap c and L26 W1 (codex-review.test.mjs): a record with no run at a head read as owing, since the head's own refusal was taken as its debt. Fixed: a record stands against a later narrower one only where it owes something itself (`ownDebt`: its own findings, or a recheck that left some open). Targeted files: 600 of 605 pass, 0 fail. The verifier's probe on this branch (scratchpad probes3/a-again-subrange.t10.out): after a clean --again M..H the push row refuses, "owes a correction: 1 finding open"; a clean --again of the whole range settles it. Real heads e3aad480 and ed1fd0e1 read the same. Left as notes: at a merge head, a wide record that owes followed by the merge's own remerge record now keeps the wide debt (no real record has that shape, L2); a narrower review that repeats a finding of the wider one lists it twice in the recheck.
- L9 2026-11-16, 420b76c reviewed: Codex correct, 0 findings (75,963 input tokens); the lens risk 0 findings, reliability 1 WARNING: `decidingRecord` calls itself through `recheckOf`, and a recheck naming its own head, or two naming each other, overflowed the stack (red test 'records whose rechecks name each other ...': RangeError). Fixed: `within` carries the heads already read, and a recheck naming one again is read at the last record there. The session summary's Left now says T10 is built.
- L10 2026-11-16, 308580f reviewed: Codex correct, 0 findings (64,080 input tokens); lenses reliability and risk 0 findings, reliability rechecked its warning: 1 fixed. Targeted files: 601 of 606 pass, 0 fail. Codex in T10: 157,959 + 38,638 + 75,963 + 64,080 input tokens; weekly meter 89% before the first run. The whole set ran only in the pre-commit runs on GitHub, one a commit, all passing. Next: push and the pull request.

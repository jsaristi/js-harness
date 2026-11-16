# again-subrange: an --again over part of a range does not clear an owed correction

## State
JH 207, worktree D:/js-harness-worktrees/again-subrange, branch feat/again-subrange from main 45a40e8 (PR 896 landed).
T1 done (L2); T2 built (L5): `recheckState` keeps an owed correction past a later record whose base is not at or before
the owing one's. Next: the whole set (the commit's hook), Codex and the lenses, push, PR, notice to the lead. T3 (L84)
stays open. The background wait for notices to 207 runs until this session closes.

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

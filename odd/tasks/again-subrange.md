# again-subrange: an --again over part of a range does not clear an owed correction

## State
JH 207, worktree D:/js-harness-worktrees/again-subrange, branch feat/again-subrange from main 45a40e8 (PR 896 landed).
Opened; nothing built. Next: count the real Codex records first (how many heads hold more than one admitted reviewed
record, and of those how many have a later record whose base is not at or before the earlier one's base), then the
depth pass, then the red test (the verifier's probe a-again-subrange.mjs, scratchpad probes3 of the JH 207 session),
then the fix. Open task T3 (L84 of odd/tasks/review-gate.md). The lead was told PR 897 and 894 pass with main's code (L1).

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
- [ ] T1 (kind: design) count the real records, depth pass
- [ ] T2 (kind: build) spec 1, tests first
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

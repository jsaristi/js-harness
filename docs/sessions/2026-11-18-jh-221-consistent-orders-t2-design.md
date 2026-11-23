# JH 221 · consistent-orders T2 design

## Goal
Item `orders-t2` of plan version 4 of 2026-11-18 (stretch opened 2026-11-18T17:03:58Z): the design of consistent-orders
T2 (S2, the lead's idle close turned back while a session is blocked and unconsulted) and its double review, in
`odd/tasks/consistent-orders.md` only, no code. Brief: the item in `plan-2026-11-18-away.notes.md` with its versions 3
and 4, in the shared notes folder `side-session-notes/local_41e31b68-c8b2-4729-8c54-b1e701bb5a40`.

## The user's words
Started by the lead on his approval of the wave, question 340, his answer "Sí, las 8" (JH PLAN transcript `f5c3ee4d`).
The design's own words are question 289 and his line 15682, quoted in the feature document's Log, L2 and L3.

## Delivered
- PR 914, merged 2026-11-18T20:29:16Z (merge 93e47963): commits 868042c3, 19d5d222, 7298f386.
- `odd/tasks/consistent-orders.md`: L22, S2's design restated whole and checked against main at b044dbf7; L23, its
  double review; State, In scope, Constraints, Ask me before and stale citations updated; F12 added.
- Double review read 59d0ee8d: Claude 9 findings, all taken; Codex 12, 10 taken (1, 4 and 5 in part), 10 and 11 not
  (S6 and S5, not T2). Recorded with `js-harness double-review take`.
- Probe script `jh221-blocked-now.mjs` in the stretch's shared notes folder
  (`side-session-notes/local_f536332a-81c1-489b-9669-68384563ffe9`): 16 open blocks in the channel, none within 6 h.

## Decisions
- This session: drop L13's git commit rule from the Stop path (it fails closed on a failed git, `bin/lib/stall.mjs:162-171`,
  and does not fit the hook's time); drop the job-`removed` liveness rule (`background/sessions.jsonl` has no line
  after 2026-11-15T23:06:21Z); coverage by time with only a compaction voiding it; the turn-back marker for the
  immediate retry only; key senders by `sameSession`. Recorded in L22 and L23.
- The lead's, open: approval for a build; whether the senior's `waiting` counts; the order against `tokenizer`, which
  also touches `bin/advisor-gate.mjs`.
- His, through the lead, open: the 6 h bound, a `question` clearing the block, a compaction voiding the consult, and
  whether a free session's `waiting` counts (L22, "Departures"; Ask me before).

## Failures and lessons
- The plan said the double review costs about 0.9M Codex tokens; it cost 4,232,143 (read 59d0ee8d). Found in the
  read's own output; `codex-meter` after it: weekly 18%, five-hour 28%. Not fixed: the estimate in
  `bin/double-review.mjs`'s plan line is a measured-once figure; the lead holds whether to re-measure it.
- The first `js-harness wait --notice-to 221` exited 127; the second ended because `merge-queue --refresh-copy`
  replaced the installed copy (its own note says so). Nothing was lost; the wait was re-armed once.
- Text written after the read (the once rule, relief by number, the git rule's removal) was seen by no reader; L23
  says so and the lead's review of PR 914 was its only read.

## Left
- F12 (the lead): a session whose `waiting` S1 refused and that then sends a `note` leaves no block S2 can see.
- `orders-build`: not started, needs the lead's approval and his rulings above.
- Codex 10 (S6's check) and 11 (S5's zero forks): with the lead.

## Cost
- Time: start not read from a record (the ready notice is its first notice); ready notice 2026-11-18T20:08:51Z; PR merged 20:29:16Z.
- Context at the ready notice: 54%.
- Reviews: one double review (Claude 730,659 tokens, Codex 4,232,143 tokens); no Codex code review or lens review
  (no code commits). Gate: `npm run check` PASS on each of three commits.

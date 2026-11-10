## Goal
The Stop hook's checks hold as written: the share check reads a decimal or a four-digit share as what it says, the
skip phrase is taken as he types it, with or without its accent, and a reply turned back once is checked again on its
second stop, let through, with the miss said.

## Why
Work unit 2 of the audit triage (docs/proposals/2026-11-10-audit-triage.md on `docs/audit-triage`, PR 805), closing
M7, M8 and M6 of the Fable 5.2 audit (docs/audits/2026-11-09-fable-5-2-audit.md on
`claude/fable-5-2-audit-531f8e`). A wrong share turns back a true reply; a refused skip phrase makes his own words
useless; an unchecked second stop leaves every reply check holding for the first attempt only, unseen.

## Done when
- `node --test bin/lib/share-check.test.mjs bin/double-review.test.mjs bin/reply.test.mjs` exits 0
- `npm run check` exits 0
- `js-harness notify --to orchestrator --kind ready --pr <n>` records the notice

## In scope / Out of scope
- In: bin/lib/share-check.mjs, bin/double-review.mjs, bin/reply.mjs, their three tests, this document.
- Out: entry documents and bin/conventions-workshop.test.mjs (JH 164 works there); the share check's own
  `stop_hook_active` skip in bin/guard.mjs (not in the unit); any rule's text; merging (the lead's, after his yes).

## Constraints
- The second stop never blocks — because the host sets `stop_hook_active` so a hook cannot loop.
- Tests first, red before the fix — because a wrong pattern in a Stop hook turns back every reply of every session.
- No rule's text changes — because a rule may be his; one that needs changing goes to the lead as a question.

## Ask me before
- Nothing beyond the brief: the lead decides scope and merging, after his yes.

## Depth pass
- 1. Method: a guard on free text is a recognizer, held to its false-positive rate first, since a refusal costs a
  turn: a number read is the whole token, never its tail (a left boundary), and a phrase typed by a person is
  compared as he types it, accents folded (NFD, combining marks dropped). A hook that
  must not loop still observes: Claude Code and Codex both read a `systemMessage`, which shows and blocks nothing
  (the doctor's `SessionStart` hook already uses it on both, docs/ROADMAP.md:130). Searched first: codegraph for
  `ownShares`, `SKIP_PHRASE`, `stop_hook_active`; `grep -rn systemMessage bin docs`.
- 2. Raw material: `bin/lib/share-check.mjs:25` (BEFORE, no left boundary, no decimal) and `:16-20` (AFTER);
  `bin/lib/share-check.mjs:59-63` (range, window and stated parts read `\d{1,3}`); `bin/double-review.mjs:61-62`
  (his words without the accent, the constant with it) and `:566`; `bin/reply.mjs:9` and `:222`;
  audit M6-M8 (lines 174-186 of the audit file).
- 3. The bar:
  spec 1: `node --test bin/lib/share-check.test.mjs`: today "Estoy en 77.5 % de contexto." reads [5], "77,5 %"
  reads [5], "1050%" reads [50] (run at 6ee974dd).
  spec 2: `node --test bin/double-review.test.mjs`: today "no quiero la revision" typed is refused
  (`'no quiero la revision'.includes('no quiero la revisión')` is false).
  spec 3: `node --test bin/reply.test.mjs`: today a second stop is answered `{}` without reading anything
  (bin/reply.test.mjs:89).
- 4. Refutation: could a decimal share be no share at all, so reading it as 77.5 turns back more replies? It is
  compared within SHARE_TOLERANCE, so 77.5 against a recorded 77 passes where 5 failed; a four-digit number is no
  share and is read as none. Could folding accents let a different phrase through? Folding maps only combining marks,
  so "revision" and "revisión" meet and no other word does. Could the second-stop check loop? It answers
  `systemMessage` only, which no host turns into another turn. Run after the tests are written: they fail at
  6ee974dd.
  Verdict: supports
- 5. Request: as the Goal. For M6 the triage's first option (check the second stop and let it through, saying the
  miss), so no rule's text changes; the miss is said with a `systemMessage`, which the user sees and the transcript
  keeps.
  Adds: none

## Specs
1. "give the share pattern a left boundary and a decimal part, with "77.5 %", "77,5 %" and "1050%" as tests" (the
   triage, unit 2, through the brief of 2026-11-10).
2. "compare the skip phrase with accents folded, with "no quiero la revision" as a test" (the same).
3. "for M6, either check the second stop too and let it through while recording the miss, or say in the rule that
   the second attempt is not checked. The host sets `stop_hook_active` so that a hook cannot loop, so M6 must not
   block twice." (the same).

## Tasks
- [ ] T1 (build) spec 1: decimal and boundary in the share patterns, tests first.
- [ ] T2 (build) spec 2: the skip phrase compared with accents folded, test first.
- [ ] T3 (build) spec 3: the second stop checked, never blocked, the miss said in a `systemMessage`, tests first;
  an independent verifier reads it.

## Log
- L1 The brief (2026-11-10T06:00Z): "Yours: exactly what the unit lists, and its "Done when" command. It is high
  risk, a guard: a wrong pattern turns back every reply of every session, so the tests come first and are red before
  the fix, and M6 gets an independent verifier, as the unit says."
- L2 Checked at the source before any change (6ee974dd): M7 by running `ownShares` on the three cases ([5], [5],
  [50]); M8 by `'no quiero la revision'.toLowerCase().includes(SKIP_PHRASE)` (false); M6 at bin/reply.mjs:222. All
  three true.
- L3 M6, decided here (the triage makes it the lead's; the brief hands it to this session): the first option. On a
  stop with `stop_hook_active`, the reply's own checks run again (its close and labels, the UTC time, the command
  block); the wake, stale-board and return checks do not, since each already turns back once by its own record. A
  miss answers `{ systemMessage }`, never `decision: block`. The guard's share check keeps its skip: not in the unit.

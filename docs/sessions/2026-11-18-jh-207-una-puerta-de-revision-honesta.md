# JH 207 · una puerta de revisión honesta

File: docs/sessions/2026-11-18-jh-207-una-puerta-de-revision-honesta.md.

## Goal
An honest push gate for Codex reviews: a clean review that spans a head whose review found something does not settle that correction unless that head was rechecked. Feature document `odd/tasks/again-subrange.md` (spec 3, T5 to T8). The opening is read with `js-harness sessions --opening 'JH 207 · una puerta de revisión honesta'`.

## The user's words
- Question 338: "A: arreglar T7 primero" (lead transcript 305c10e3, line 2480).
- Question 341: "Entrar el PR ya" (JH PLAN transcript f5c3ee4d-2c09-416a-addb-ea2b5e6c3e8d, line 1585; `js-harness sessions --quote f5c3ee4d-2c09-416a-addb-ea2b5e6c3e8d 1585`). The option he chose sent T8 to its own PR.

## Delivered
- PR 902 (feat/spanning-review): T5 and T7. Merged 2026-11-18T18:11:54Z as b278b584.
- PR 917 (fix/recheck-reread): T8. Ready, head f602de71. Commits:
  - 1941ed45: the fix;
  - ecab5d10 and aff96f32: Codex's findings;
  - f5931e3a and f602de71: the log.
- `odd/tasks/again-subrange.md`: L44 to L55, with T7 and T8 checked off.

## Decisions
- The owner: Q338, fix T7 first; Q341, land PR 902 as it was and do T8 after it in its own PR (L50).
- The lead: T8 goes to this session, with a 6M cap (L51).
- This session:
  - T8 re-reads from the `from` of the run line, fails closed when that start is missing or not a full id (L51), and repeats the run's ancestry and admission's choice of line (L52, L53).
  - The lens warning, repeated three times, is accepted on the record (L52, L54).
  - Codex ran with `--doc`, not `--request`, because the command refuses both together (L55).

## Failures and lessons
- **The third verifier found a fail-open after T7 (L49).** It was already on main. T8 fixes it: about 490 document commits and the `git fast-import` test, red before the fix.
- **Every Codex finding on T8 was a false refusal.** Each time, the re-read took a different path from the run: its ancestry, its run line, its kind of id. The lesson is that the re-read of a check must reuse the run's own predicates (`atOrBefore`, admission's choice of line), not new ones.
- **A test passed on the old code because it never reached the code it named.** The ancestry test used a history with no prior recheck, so `holds` was never called. It now sits on the sibling builder and is red before the fix (L53).
- **The lens got a misleading `--request` text.** It read the T8 branch as PR 902 three times (L52).

## Left
Nothing of this feature. PR 917 waits for the land, which the lead holds.

## Cost
- **Time:** T8 ran from 13:5x to 17:38 local, the time of the ready notice.
- **Context:** 68% at the end; the host compacted the session once in this stretch, at 09:53.
- **Codex on T8:** 3 rounds, 3,921,143 input tokens in all (2,387,963, 888,714, 644,466).
- **Claude lenses:** reliability and risk, 3 runs of about 20,000 tokens each.
- **Codex on T7** (before T8): 1,236,364, 651,614 and 226,762 input tokens.
- **Verifier on T7:** 7,565,442 Claude tokens.
- **Gate runs:** this session's own Claude tokens are not metered.

# JH 220 · codex-spend T3 and T5

File: docs/sessions/2026-11-19-jh-220-codex-spend-t3-and-t5.md.

## Goal
Tasks T3 (spec 3) and T5 (spec 6) of `odd/tasks/codex-spend.md`, each written test first, with an independent verifier, Codex and the Claude lenses. The task was item `codexspend` of the lead's plan v4 of 2026-11-18, which the owner approved in question 340 ("Sí, las 8"). T3 had to land first, because JH 226 waited for the test name "conflict with main names" to be on main.

## The user's words
The task came from the lead session JH ORQ, not typed by the owner; it is this session's first message, stored as its opening (js-harness sessions --opening 'JH 220 · codex-spend T3 and T5'): "Report only through `js-harness notify --to orchestrator` (ready with `--pr`, then closed); the lead (JH ORQ) reviews and lands, you do not. Ask the owner nothing in your chat: what is his goes to the lead as a notify note, and JH PLAN puts it to him."

## Delivered
- **T3:** PR 918 (https://github.com/jsaristi/js-harness/pull/918), merged by the lead as 0c28d083.
  - What it does: a conflict line now names its fix through `conflictSaid` (`bin/lib/pull-request.mjs`).
  - Log: L34-L37.
- **T5:** PR 923 (https://github.com/jsaristi/js-harness/pull/923), open and handed to the lead with a ready notice. Branch `feat/codex-spend-t5`.
  - Commits:
    - 9d9b5b55, 2e40eb81: rounds 1-2.
    - 85e918fe: merge of main.
    - f6c388e1, 26ecda28: round 3.
    - e709d8f4, d4c78afa: round 4.
    - 97fa01db, c23201ad: round 5.
    - 4e13e2ae: the lenses' fix.
    - 75840bac, 62cfe896: the recheck's fix.
    - 27cb11f9: L46.
  - What it does: `js-harness codex-meter --per-pr` prints Codex input per landed PR.
  - Log: L38-L46.
  - Baseline: 35 runs (1 with no count), 3,173,294 input tokens over all days, and 3,053,278 on 2026-11-14. These are L3's figures.

## Decisions
- **The lead (JH ORQ), 2026-11-18, 18:13 and 18:24 local:**
  - T6 compares the "beside new" figure.
  - No size cut is added.
  - The rounds rule stays as written.
  - The baseline names 866 09:28 and 868 11:42, 11:49 and 12:10.
  - Recorded in L40 and `BASELINE.notes`.
- **The lead, 16:24 local:** cleared `conflictOnto` at `bin/lib/merge-queue-reviews.mjs:97` for T3. Recorded in L36.
- **The lead:** Codex for T5 is covered by question 346 (wave 1, stop at 60% weekly).
- **This session:** Codex reviews T5 from base `04b7ac53`, the range `check --push` named. `codex-review` has no `--head`, and `b044dbf7..HEAD` would also read main's 13 files.
- **This session:** Codex's finding 3 (P3) is answered without a code change, in L46. The waiver is the owner's, through the lead.

## Failures and lessons
- **Three Codex reviews did not settle T5:** one P3 is open, "Scope the fixed baseline to the js-harness repository". It is passed to the lead with the ready.
- **Round 4 and the two recheck fixes were written inline.** A verifier was run on them only after the advisor pointed out the gap (clean, three Lows). Lesson: every code round gets a verifier before the ready, not only the writer's rounds.
- **Codex found 12 defects that two verifier passes and the lenses had missed:**
  - Unreadable records read as empty.
  - The default branch tried only main and master.
  - Zeros from before rollout usage read as measurements.
  - Failed candidates' ancestry treated as landed.
  - `GIT_` variables leaking into the test fixtures.
- **A heredoc through node lost backslash escapes twice,** in T3 and in round 4's test. Lesson: edit test text with the Edit tool.

## Left
- **Finding 3's waiver:** the owner's, through the lead.
- **Follow-ups in L42:**
  - The help line `bin/js-harness.mjs:34` lacks `--per-pr`.
  - The README's codex-meter section does not show it.
  - `MERGE_OF_PR` copies `report-git.mjs`'s regex.
- **T3 follow-ups for the lead:**
  - `README.md:1308` shows the old CONFLICTING line.
  - `notify` does not ask gh for `headRefName`.
  - `merge-queue-reviews.mjs:75` still says "merging or rebasing".
- **No test pins** `codexDebts`'s `cwd`, nor finding 8 (a path ending in a space).
- **T6 (verify):** held by the lead.

## Cost
- **Codex:**
  - T3: 1,407,523 input tokens over 3 reviews.
  - T5: 9,264,890 input tokens over 3 reviews (7,475,215 + 1,489,161 + 300,514).
  - Weekly meter: 39% before T5's first review (22:18 local), 48% before its last.
- **Claude lenses:** each T3 round. T5 rounds 1-2 and 3-5, plus each fix: six runs in all, each at 7k-26k input tokens a lens.
- **Verifiers (opus, read-only):** four on T5 and one on T3. The last, on e709d8f4..27cb11f9, found no High or Medium, three Lows reported to the lead with the ready (no code: the range has no review left).
- **Context:** the host compacted this session once, at about 19:09 local on 2026-11-18. It was at 134% of its window when this summary was written.

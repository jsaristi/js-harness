# JH 186 · F8 S6: the read surface

## Goal
Step S6 of the F8 plan (`docs/ROADMAP.md`, "S6 The read surface"): bound what a session reads to start. Opened in
the background by the lead from the brief `~/.js-harness/background/briefs/2026-11-11T23-35-51-122Z-9eba72ee.md`.
Every reply of the session ran on `claude-fable-5-2` at medium effort, the first work session measured there.

## The user's words
- "Me dices el como vamos y cuanto avanzaremos pero no en donde estamos y no puedo saber si realmente vamos a
  avanzar o no" (the lead's transcript `f0959bbd`, line 2835) and "listo pero entonces queda solo y avanza
  autonomamente lo que mas puedas" (line 3075), quoted in the feature document's L1.
- Question 268, answer (tapped) "A: sacarlo de S6 (Recomendada)": `js-harness sessions --quote
  812b728f-2f18-43f6-b405-396080689c65 2517`.

## Delivered
- Pull request 838, merged at 2026-11-12T00:45:53Z as main `80a0b5ee`: commits `e8b22bb7` (the feature document),
  `1929fe56` (the `read surface` row, Next cut), `704495a7` (the `## State` head, the roadmap's stale lines, SPEC),
  `28d64c64` (the probe), `3ea7b35a` and `c7282225` (the reviews' fixes), `bff77615` (the State head).
- `bin/lib/read-surface.mjs`: `check`'s `read surface` row, 13,526 of 15,000 estimated tokens at the merge; it fails
  over 10,000 for the roadmap's Next and Decided or 5,000 for a resume head, and warns from 90%.
- `docs/roadmap-history.md`: Next's settled paragraphs, moved word for word; Next went from 7,494 to 1,796.
- The `## State` head: first in `CONTRACT_TEMPLATE` (`bin/lib/contract.mjs`), read first by the resume hook
  (`bin/resume.mjs`), the pause's notice (`bin/lib/pause.mjs`) and the board's `planOf` (`bin/lib/sessions.mjs`).
- The probe: `evals/results/f8-s6-incidents.json`, incident cases 9 and 10 on `claude-opus-5-5` at high, 2 of 2
  each (S0's lowest: 2 of 2 and 1 of 2), $1.13 of list cost.
- The closing documentation, branch `docs/f8-s6-close`: the roadmap's S6 State line, the Later item "The lead's
  relief file, bounded", this file.
- Feature document: `odd/tasks/f8-s6-read-surface.md`, 7 of 7 tasks, T4 ticked as not built.

## Decisions
- His: the relief by month leaves S6 and becomes work of its own, its design reviewed first (question 268,
  answer A; the document's L9).
- This session's: the measure counts every resume section and the largest head of any document, not one
  document's (L4); three documents over the head's budget are a legacy list that only shrinks, held in the
  harness's own repository alone (L7); Decided is not cut, since which words of a row are history is a reading of
  his decisions (L5); `planOf`'s `nextStep` keeps its name (L7).

## Failures and lessons
- The relief design written in L2 did not hold; the double read found it before any code (L4). The depth pass's
  refutation had been run on the step's pass line, which does not measure the relief.
- A commit was refused by the gate: `bin/contract.test.mjs` had been run in place of
  `bin/lib/contract.test.mjs`, so the template's own test was never run (L5). The gate caught it; one run lost.
- The eval's first start was refused before any trial: a worktree's default work root sits under the
  repository's `CLAUDE.md`. Started again with `--work-root D:/js-harness-evals-work` (L6).
- 13,526 is not below S0's 13,413: the row counts a larger head than S0 did (L5). Four trials do not separate
  the step from chance, and case 9 has never failed in 22 recorded trials (L6).
- The host compacted the session once and the machine restarted once; the State head held both times.

## Left
- The lead's relief file, bounded: the roadmap's Later; nobody holds it yet.
- The roadmap's two sections stand at 9,058 of 10,000, past the row's 90% line: the next cut is Decided's
  history tails, which is his reading (the lead).
- `CLAUDE.md`'s sentence on a feature document's order does not name `## State` (his file; the lead was told).
- The board's first lines of a State head say what is done before what is next (L7).

## Cost
- Time: first notice 18:38 local on 2026-11-11, `ready` at 19:36, merged at 19:45; closed after the restart, near
  23:55. Context at the end: about 60% after one compaction.
- The double read of the plan: 1,107,617 Claude tokens and 550,232 Codex tokens.
- Reviews: three Codex runs (137,401, 110,694 and 54,569 input tokens), three lens runs (43,259, 21,718 and
  7,069 input tokens).
- The eval: 4 trials, $1.13 of list cost. Gate runs: 9 commits through GitHub's machines, 2 of them refused.

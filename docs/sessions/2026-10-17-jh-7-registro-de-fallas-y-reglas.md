# JH 7 · registro de fallas y reglas

File: docs/sessions/2026-10-17-jh-7-registro-de-fallas-y-reglas.md. Facts with their evidence (a pull request, a commit, a path:line, a command and its output), not prose: the file is read later to reverse-engineer how the work went. Commit and push it, then close with js-harness notify --to orchestrator --kind closed --summary <this file> "<what you delivered>".

## Goal
The session first opened for the sweep of 2026-10-11 (`docs/sweep-2026-10-11.md`). It then held two pieces of work:
- the failures register (`docs/FAILURES.md`, rule-hierarchy T3f);
- the rule hierarchy's one home for every rule (`odd/tasks/rule-hierarchy.md`, T16b to T16d), which ended in step 2 of
  T16d, the first patterns of each rule.

The opening in the channel (`openings/D--js-harness/jh-7-registro-de-fallas-y-reglas-77ef1dea6dd7.json`) holds only
the resume prompt of 2026-10-17. The feature document's "State for a resume" entries carry the history.

## The user's words
Each answer below is quoted verbatim in `odd/tasks/rule-hierarchy.md`, Progress, as the lead relayed it.
- 2026-10-16, to the lead's "¿Cómo seguimos con esas 13?" (his own rules and patterns): "Solo forma, sin mí
  (Recomendada)". A change of form alone, meaning patterns or failure, needs no words of his.
- 2026-10-16, to "¿Lo autorizás?" (a push with `--force-with-lease` of `rule/first-patterns`): "Sí, que la pise
  (Recomendada)".
- 2026-10-14, after a commit of his was rejected: "Que siga con su cola (Recomendada)". This is line 971 of transcript
  `ca93c7ef-90b4-48f3-879e-c51742f78f64`, quoted in the feature document's resume of 2026-10-14 at 00:07.

## Delivered
Every pull request below is merged; each state was read with `gh pr view <n> --json state` on 2026-10-17.

| Work | Pull requests |
|---|---|
| The sweep list | 61, 62 |
| The failures register and its entries | 144, 147, 150, 152, 219 (T3f, `measured`), 267 (`pnpm-cleanup-deleted-link-targets`) |
| T16b, rules moved to their homes | 190, 192, 196, 206, 213, 216, 230, 232, and the documents 193, 207, 217, 231, 233 |
| T16c, `rules change` | 238, and its design 234 |
| T16d, the row `rules` and `{amount}` | 247, and its design 241 |
| A change of form keeps its source | 249 |
| A design may change the form of his rules | 253 |
| T16d step 2, patterns for 28 of the 30 rules | batch 1: 254; batch 2: 264; his batch A: 272; his batch B: 284 |
| `AMOUNT` takes a number only when it stands alone | 279 |

## Decisions
- **His:** the two answers above.
- **The lead's:**
  - Fold batch 3 into batch 2.
  - Build the `AMOUNT` fix as its own pull request after the batches.
  - Keep going through the batches without reporting between them.

  All three are in the Progress of 2026-10-16.
- **This session's:**
  - Narrow a rule's patterns wherever a probe on `main` found measurements or other settings. Each narrowing and its
    reason is in Progress.
  - Pin each narrowing with `NEAR_MISS` (`bin/lib/rules-scan.test.mjs`).
  - Keep each pattern's own guard after the `AMOUNT` fix.
  - Leave the second pass of patterns to be designed before it is built (Progress, "step 2's batches are done").

## Failures and lessons
- **Waited deaf.** `js-harness wait --pr 284`, set to 480 minutes from 09:02, woke this session for none of the lead's
  five notices (10:30 to 13:17); they were seen at 17:04. A channel notice reaches a session only on its next tool
  call. Since then, waits run in short spans (`--for 30`). The Seen line was sent to JH 22, which holds the register.
- **A test pinned a state that was about to change.** `bin/rules.test.mjs` pinned "patterns: none" and failed the
  gate once batch 1 had patterns. The expected line now follows the list (f007601).
- **A gate ran beside a verifier's tests.** The `checkSensor` test (`bin/check.test.mjs:494`) failed under the load;
  that is a Seen line under `heavy-run-beside-gate`. The rule since: no gate while a verifier runs.
- **`main` moved under an open rule change.** `rules change` refused a branch not on `origin/main`, so the batch
  script now runs merge-tree and rebases before each rule.
- **Shell quoting.** Inline `node -e`, heredocs and compound commands broke on quotes several times. Such text goes
  through a written file.

## Left
- **The second pass of patterns** is held by the lead, waiting for its word. It covers:
  - patterns too wide and too narrow;
  - a test that each pattern finds a line of its own;
  - a test of overlap between rules.

  It goes before any rule's row refuses. It is recorded in `odd/tasks/rule-hierarchy.md`, Progress, 2026-10-16.
- **T16 itself** stays with this session by the lead's note of 13:17. T16e, T16f and T16g went to JH 24 and JH 27, and
  the 26 unsettled register entries went to JH 22.

## Cost
- **Time:** the first notice was at 2026-10-11T19:47Z and the last at 2026-10-16T22:13Z, 57 notices in all.
- **Context:** 86% of the window when this summary was written.
- **Reviews in this session's last stretch (2026-10-16):**
  - gentle-ai approved and acknowledged five candidates: batch 2, his batch A, the `AMOUNT` fix, his batch B, and
    batch 1 before the compaction.
  - Four independent verifiers on Opus, about 510,000 tokens in all.
  - Codex, five runs: 112,399, 181,151, 64,371 and 167,181 input tokens, plus 144,067 for batch 1.
- **Gate runs:** one per commit, through the pre-commit hook.

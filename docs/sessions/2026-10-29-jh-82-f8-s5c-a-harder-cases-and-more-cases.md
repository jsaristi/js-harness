# JH 82 · F8 S5c-a: harder cases and more cases

## Goal
Give `rule-reuse-first` and `rule-away-autonomy` premises that tell their rules apart and rerun them, write more of
the 13 to 23 cases T6 did not write, and land `init`'s coverage baseline line (L5) if main still lacked it. Opening:
the lead's brief `~/.js-harness/background/briefs/2026-10-29T10-39-55-204Z-febcb4bc.md`; the record is
`odd/tasks/f8-s5c-a-coverage.md` (T8 to T10, L17 to L28).

## The user's words
- "Sí, hasta 130 USD (Recomendada)" (lead's transcript `0f71b2c6-cbce-43ca-a031-276a4b2c381f`, line 19557, question
  110, as the brief quotes it, verified there with `js-harness sessions --quote`): S5c-a's remaining paid runs (L17).
- "No le coloques tope usa el uso que necesites estamos en suscripcion max x20" (same transcript, line 19692,
  2026-10-29T10:40:13Z, relayed by the lead): the cap lifted; each run still read with `--plan` first and stopped
  past 1.5 times its estimate (L17).

## Delivered
- Branch `f8-s5c-a-cases`, its pull request ready for the lead's land (open):
  - `b08cf553`, `03effcad`: the two cases v2 (T8, L19), proven by `task-proof` (reuse 1, 7, 0 of 7; away 2, 6, 0 of
    6).
  - `e2be8e8a`: P5 and P6's results and both proof records, FAIL (L21).
  - `45fb1751`: the current arm and every rule arm keep their trials' transcripts (`evals/configs.mjs`, L24).
  - `45ae758e`, `24471296`: the away grader reads Spanish replies, its words bounded (D12, L25).
  - `dc28db03`: P7's results and the reuse proof record, FAIL, with the transcripts' finding (L26).
  - `64dd803f`, `b4d6fc13`, `12d2ca5f`, `77b86429`, `df346e30` and the last commit: the feature document, the
    S5c-a line of `docs/ROADMAP.md` and this summary.
- Branch `f8-s5c-a-init-baseline` from main, PR 669 (open): `ba8b407c` `init` records
  `coverage: { baseline, release }` in a new project's manifest, never in a clone, with the four shared messages
  moved to `bin/lib/project-messages.mjs` (ceiling 2,018 to 1,990); `848031b2` the verifier's nits (T10, L28).
- Results: neither case tells its rule apart. P5 5/7 and P6 4/6 on both arms; P7 5/7 on both arms, and its
  transcripts show no trial on either arm loaded any skill, so the rule's text never reached the model (L26).
  `rule-proof.mjs` FAIL for both; both stay owed in `bin/lib/rules-coverage-data.mjs` `cases`.

## Decisions
- This session: D8 and D9, the v2 premises (L19); D11, no more reruns of the two cases until the blockers are
  answered (L22); D12, the grader reads Spanish (L24); D13, no baseline in a clone (L28); D14, T9 builds no case on
  a prompt that does not fire its skill (L26).
- The lead: T10 is this session's, on its own slice, high risk (L20, 06:10); transcripts on the rule arms approved,
  and no `away-autonomy` rerun until his question 111 is answered (L23, 07:15); a trial reaches a rule only through
  a prompt that fires its skill as real work would, never an always-loaded home text, no paid rerun until such a
  prompt is shown free to load the skill, and the rules only in skills listed (L27, 08:10).

## Failures and lessons
- The away grader read only English, and every P6 trial replied in Spanish (the trial home's language): found by
  reading the four replies; fixed by `45ae758e`, and its loose words by `24471296` after gentle-ai's lens.
- P5 and P6 kept no transcripts, so they could not say whether a skill loaded; `45fb1751` keeps them on the
  current and rule arms, and P7 answered it.
- A results file that names gentle-ai failed the commit gate twice (`bin/lib/gentle-ai-absence.test.mjs`); each new
  results file now joins its list in the same commit.
- The host compacted this session once (07:46), after its state was committed (`b4d6fc13`); it resumed from the
  document.

## Left
- Both cases owed: a prompt that loads `js-harness-protocols` or `js-harness-orchestrator` as real work would, shown
  free, before any paid rerun (the lead, L27); how to show it free is not built.
- His question 111 (the five reply states against `away-autonomy`'s "ask nothing") holds the away rerun.
- The 22 rules whose tied spans sit only in a skill (L27): no case for 20 of them.
- PR 669 and this branch's PR, for the lead to land.

## Cost
- Time: the brief at 05:39 local; the last notice about 08:50 local. Context: 29% at the last notice measured
  (08:09), after one compaction.
- Paid runs: P5 $2.31 (plan $2.08), P6 $2.56 (plan $2.41), P7 $2.00 (plan $2.31): $6.87 in all, API-equivalent on his
  Max plan.
- Reviews: Codex on `b08cf553`, `03effcad..45ae758e`, `b4d6fc13..24471296`, `27fc4f9e..ba8b407c`,
  `ba8b407c..848031b2` and `12d2ca5f..df346e30`; the Claude lenses on each range; gentle-ai approved six ranges; one
  independent verifier on `ba8b407c`. Gate runs: every commit's pre-commit gate, and P5 to P7 through
  `js-harness gate`.

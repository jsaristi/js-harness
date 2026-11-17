# JH 212 · preguntas siempre con opciones

## Goal
Cement the owner's order that every question reaches him with options. Opening read with `js-harness sessions --opening 'JH 212 · preguntas siempre con opciones'`, handed by JH ORQ.

## The user's words
- "siempre dame las preguntas con opciones" (transcript 699d7c29, line 7609)
- "hazme todas la pregunta y por favor cementa que siempre me debes pasar las preguntas con opciones" (699d7c29, line 7752)
- "Dejarlo con Opciones pero especificando con ejemplos en las opciones y Dejando muy Claro que se tiene que repsonder en la casilla de "Otro"" (699d7c29, line 8070, his typed answer to question 325)

## Delivered
- PR 906, merged as fdae9423 on his typed yes (question 327). Feature document: `odd/tasks/questions-with-options.md`, T1–T5 done.
- Commits:

  | Commit | Change |
  |---|---|
  | `82fbf051`, `924c1114` | `checkedQuestion` takes 2 to 4 options |
  | `263c2933` | The question close names `Pregunta <n>` |
  | `5c6a8d60` | The named question must be open in the record (`bin/lib/reply-question.mjs`) |
  | `3d245683` | The corrected stop runs the record check too |
  | `f281c998` | Rule `questions-one-place` |
  | `2a964537` | Rule `reply-five-states`, with pair 9 |
  | `efda3949` | The earlier quotes keep their excerpts |
  | `dfff9ab7` | README |

## Decisions
- **The lead:**
  - The written-answer state stays, always through the question tool (the reading of line 8070).
  - PR 901 lands before these rule commits.
  - The onboard prompt is a follow-up.
- **This session:**
  - The record's most options goes from 6 to 4, the tool's range (feature doc L5).
  - Old records stay readable.
- **The owner:** landing PR 906 (question 327).

## Failures and lessons
- **A self-numbered "Pregunta 1" passed the hook.**
  - Found by: the reliability lens on 924c1114..263c2933.
  - Fix: `5c6a8d60` checks the record.
- **The corrected stop skipped the record check.**
  - Found by: Codex P2 at `bin/reply.mjs:285`.
  - Fix: `3d245683`. Codex rechecked it fixed (0.98).
- **`rules change` widened five earlier quotes of `reply-five-states` to whole transcript lines.** Two of them took in system-reminder text as his words.
  - Found by: the readability and reliability lenses on 8886665..2a96453.
  - Fix: `efda3949` passes each quote's stored excerpt.
  - Not fixed: the tool gap itself, held by the lead.
- **README.md still said "not with buttons".**
  - Found by: the independent verifier.
  - Fix: `dfff9ab7`.
  - Not fixed: no test pins README's question-state text.
- **`notify --kind ready` refuses a draft PR.** Because the lead had asked for a draft, I sent a note instead.

## Left
These follow-ups are held by the lead:
- `bin/lib/onboard.mjs:835`, the onboarding prompt's "open questions in plain chat".
- `rules change` widens a quote given without its excerpt.

## Cost
- Time: from the opening at 05:02 local on 2026-11-17 to about 06:40 local.
- Context: one host compaction.
- Codex reviews: 5 runs on this session's ranges, 3% of the weekly limit at the last reading.
- Claude lens runs: 5, plus 1 refused for a wrong lens name.
- One independent verifier.
- Gate runs: one pre-commit `check` per commit and one `npm run check`.

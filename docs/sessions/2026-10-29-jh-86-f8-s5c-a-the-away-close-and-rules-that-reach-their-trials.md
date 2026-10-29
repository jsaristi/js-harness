# JH 86 · F8 S5c-a: the away close, and rules that reach their trials

## Goal
Land his addition to `rule:away-autonomy` (question 111), show for free whether each case's prompt loads the skill
that holds its rule, and rerun the cases that pass. Opening: the lead's brief
`~/.js-harness/background/briefs/2026-10-29T13-54-45-360Z-daf8ec8d.md`; the record is
`odd/tasks/f8-s5c-a-coverage.md` (T11 to T16, L29 to L42).

## The user's words
- Question 111, tapped "Sí, agrégalo (Recomendada)" (lead transcript `0f71b2c6-cbce-43ca-a031-276a4b2c381f`, line
  21669, 2026-10-29T13:54Z, as the brief gives it): while he is away, a reply closes on "working alone" and the
  question stays recorded for his return (L29). A tap, so it is recorded under `accepted`, not as a quotation.

## Delivered
- PR 672, `rule/away-autonomy-close`, merged as `f68d869f`: `b0f2ec23`, `7b923938`, the addition through
  `rules change away-autonomy` (T11).
- Branch `f8-s5c-a-reach`:
  - `69404e56`: `rule-away-autonomy` opens with `LEAD_OPENING_PROMPT`, held by `evals/tasks.test.mjs` (T12, L30).
  - `5e1e4b8e`: the case's missing `"reply": true` set, and a check that a task whose reference holds a reply file
    asks for one; a reply task whose agent printed no answer is graded on the last text its kept transcripts hold
    (`lastReply`, `evals/configs.mjs`); the case is cut at 3 minutes; the runner's transcripts part moved to
    `evals/trial-transcripts.mjs` at its line ceiling (T14, L36).
  - `addd0718`: his question Q1 recorded and not shown, due on the turn he leaves (T15, L37).
  - `e1cd87dd`, `4ce3b70d`: the review fixes (a real timeout test; the last reply by time, blocks gathered by
    message).
  - `1e7687b9`, `86a32951`, `3319391e`: P8's and P9's results and proof records.
- Branch `f8-s5c-a-reach-2`, on the lead's answer to D20 (L40):
  - `7a04a8e8`: the case cut at 5 minutes; its reply test passes a reply that closes on Working and holds Q1 for
    his return, and fails one that asks it; `rule-proof.mjs` counts a cut trial at its list cost.
  - `0b9dc198`, `f912fcde`, `d74291fc`, `ec45645c`: the review fixes (the close is the last paragraph; Q1 and its
    hold read in one paragraph, the plural taken; five replies in `evals/tasks.test.mjs`, each that must fail naming
    the assertion it fails on; the feature document back on LF line endings).
  - `1227485c`: P10's results and proof record.
- Results: P8 ($4.02, 1.57 times its plan, stopped) and P9 ($3.86, 1.15 times) both tie on the two arms; P9's one
  trial that closed on its own, without the rule, asked him Q1. `rule-reuse-first` is a coverage gap: its skill
  never loads before a module is written (D16). P10 ($4.43, 1.36 times) ties at 0.92: with the rule one trial
  holds Q1 and one closes without naming it; without it one closes on "Decision:" and one holds Q1.

## Decisions
- This session: D15 to D17 (L32), D18 (L34), D19, the pressure in the plan (L37), D20, no more runs (L39); D21, stop paying for the case (L41).
- The lead: refresh the installed copy (L31); grade the last text, cut at 3 minutes, add pressure, one paid run,
  P8's absence-test line (L35); `evals/trial-transcripts.mjs` accepted into the surface (12:21); D20, a 5-minute cut, the close test and the
  cost fix, then one run (L40); D21 (a), the case stays owed and S5c-a closes (L42).

## Failures and lessons
- The case never set `"reply": true`, so P6 and P8 were graded on no reply; `evals/tasks.test.mjs` now holds it
  (L36).
- A commit of this branch (`7a04a8e8`) turned the feature document into CRLF, a whole-file diff; gentle-ai found it
  and `f912fcde` put it back on LF. A committed diff's size against main is worth reading before each push.
- Comments that named the review tool by name broke `bin/lib/gentle-ai-absence.test.mjs`; a finding is cited by its
  id and the feature document instead.
- A trial that starts a background `js-harness wait` holds its CLI until the cut, so a timeout does not mean it was
  cut mid-work: its close is read from its transcripts (L41).

## Left
- `rule-away-autonomy` stays owed: four trials an arm cannot tell its rule apart (L41).
- A record still does not mark which of its trials were cut by the timeout (gentle-ai, on `f3463a2d..3319391e`).
- The feature document was committed with CRLF line endings on this branch (`7a04a8e8`, fixed in `f912fcde`); a
  `docs/FAILURES.md` line is outside this brief's surface, so it is the lead's.
- Main changed `away-autonomy` after P9 (a phrase on the migration's share); P9's record holds the earlier text, and
  the case stays owed in the coverage register.

## Cost
P8 $4.02, P9 $3.86 and P10 $4.43 of list cost on his Max plan, $12.31; Codex reviews of 740,838 input tokens over the eight runs whose
count is written in the feature document, and one more (`1e7687b9..86a32951`) whose count was not; the lenses' and
gentle-ai's on top.
After L40, Codex reviewed six more ranges (129,964 and 33,917 input tokens for the first two, 52,773 for the third,
the last three's counts not written), each with the reliability lens and gentle-ai.

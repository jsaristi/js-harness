# JH 187 · the advisor's cost on the weekly Fable limit: the design of a cost trial

## Goal
Design only a cost trial of 2 to 4 runs measuring how much of the weekly Fable limit a Fable 5.2 advisor spends
under Opus 5.5 sessions, pass its double review, and bring its cost to him before anything runs. Opening: the brief
`~/.js-harness/background/briefs/2026-11-11T22-38-14-780Z-71d7af6e.md`, continuing JH 185.

## The user's words
- Question 265, tapped (lead transcript `f0959bbd-5f7a-4360-b626-048caf21067f`, line 4186): "A: primero medir el
  costo del consejero en el límite de Fable (Recomendado)".
- His first request, line 2320 of the same transcript, quoted in `odd/tasks/advisor-cost.md` L1.
- Question 266, tapped (lead transcript `812b728f`, line 748): "Que termine en Opus (Recomendado)".

## Delivered
- `odd/tasks/advisor-cost.md` on branch `advisor-cost` (cut from `worktree-model-trial` at `4e2ec314`), commits
  `cbd75897` (first design), `934035fe` (first read answered), `af629d67` (second read answered), and the state
  commit after the third read. Not merged; no pull request. `js-harness contract check` PASS.
- Measured at no plan cost (scratch scripts in the job's tmp, figures in L4 of the document): the weekly Fable
  meter moved 0.18 points a Fable list-USD on 2026-11-11, once the reader and lens spend the records hold (32.7 USD)
  is added to the 130.5 visible in 54 transcripts; work sessions 68 %, the lead 26 %, sub-agents 6 % of the visible.
- Read from the relief file (lines 2100 to 2125): on 2026-10-31 about 530,000 advisor tokens left the weekly Fable
  meter at 0 %.

## Decisions
- This session: the design lives on a branch cut from `worktree-model-trial` with its own feature document (D11).
- His (Q266): finish the review on Opus; move to Fable 5.2 medium only if it fails. It failed its third read.

## Failures and lessons
- The design did not pass its third double review: reads `dcf9c9a7` (21 findings), `ce27e0ae` (22), `9d0cbfe1` (21),
  all taken; the third's are recorded unfixed in `## State after the third review`. By `rule:double-review` it goes
  to him as a problem and the work passes to Fable 5.2 medium.
- The weightiest finding of the third read: the card read weekly Fable 0 % at 10:16 on 2026-11-11 after 50.4 Fable
  session-hours that week (relief line 2498), so the meter's rate is not steady, or it was reset that morning; the
  calibration and the probe rest on a steady rate. The cheaper next step: explain that 0 % from the records first.
- Each rewrite grew the design toward the quality trial's rigour; the size he chose (2 to 4 runs) and a meter of
  whole points leave little room. Lesson: check the instrument's premise (the meter's behaviour across the week)
  before designing on it.
- The session ran on `claude-opus-5-5` at medium, not Fable 5.2 medium as Q265 said (the lead's start named no
  model, the lead's note of 17:58).

## Left
- The 21 findings of `9d0cbfe1`, in order of weight, in the document; the question text there must not be asked
  as it stands. Held by the lead: the problem to put to him, and the Fable 5.2 medium session that continues.

## Cost
- 22:38Z to about 23:35Z on 2026-11-11 (first notice 17:38 local). Main thread on Opus 5.5: about 4.3 USD at list
  (`projusage.js`). Claude readers on Fable 5.2: 3.71, 5.54 and 4.69 USD as their records price them
  (`.git/js-harness/double-reviews.jsonl` lines 88, 91, 94). Three Codex reads on Codex's meter (286,158, 346,705
  and 535,366 tokens). About 18 USD at list in all, inside the 15 to 30 the question said. No gate, no code review.

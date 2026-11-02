# JH 130 · write the E3 answers: roadmap and the daily questions list

## Goal
Write his four answers to the re-plan's E3 (questions 153 to 156) into the roadmap and the questions rule, in two
pull requests: a docs PR for 153 to 155 and a rule PR for 156. Opening read: the lead's brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-11-02T09-16-16-258Z-239ef75a.md`.

## The user's words
All tapped, in the lead's transcript `0f71b2c6-cbce-43ca-a031-276a4b2c381f`, read with `js-harness sessions --quote`:
- line 50690, question 153: "Sí, tras la función real"
- line 50775, question 154: "Sí, cuenta la función real"
- line 50843, question 155: "Sí, S5c-b tras el S8"
- line 50902, question 156: "Sí, lista diaria"
- line 51642, question 160 (the lead asking for 156 in his own words): "La escribo en Other", with nothing typed

## Delivered
- PR 747, merged 2026-11-02 (`76f1294c`): commit `509b4bee`, `docs/ROADMAP.md` with the Decided rows "1.0.0 and
  gentle-ai #4036" and "Releases before 1.0.0" updated, the old decisions kept as history; F8 step 4, the order
  diagram, S5c-b and S8 with S5c-b moved after S8 (S8 reports the `owed` share instead of holding it to 10%); the
  Next paragraph saying E3 is answered; and a `- Seen:` line for `stretch-not-opened` in `docs/FAILURES.md`, which
  the lead asked for, checked against `stretches.jsonl` (last close `2026-11-02T01:53:56Z`, none after).
- Branch `rule/daily-questions`, pushed, no PR: `cdf12d7b`, `odd/tasks/daily-questions.md` with the contract and
  the depth pass (`js-harness contract check` PASS), approved by gentle-ai (lineage `review-f6a18015e36cfe84`, low
  risk, documents only); then the parked state, L5.

## Decisions
- This session: question 156's rule commit waits for his typed words, since `bin/lib/rules-change.mjs:233` refuses a
  tapped answer (`odd/tasks/daily-questions.md`, L2); `rule:owner-decisions` keeps its list, and section 1 of the
  protocols skill stays out while JH 126 holds it (L3); the double review of the plan waits for his words (L4).
- The lead: park the rule after question 160 came back without typed words (L5).

## Failures and lessons
- The depth pass counted the questions first as 39 from an output cut by `head -60`; recounted as 41 before the
  commit. Lesson: count with the command, not from a cut listing.
- The first closing reply gave a UTC time in prose; the reply hook flagged it (`rule:local-time`) and it was
  given again in local time.

## Left
- The rule for question 156 (T1 to T4 of `odd/tasks/daily-questions.md`): waits for his typed words, held by the
  lead. Resume as L5 says.
- The depth pass's count of reversible questions (6 of 41) is this session's own classification, an estimate.

## Cost
First notice 04:19 local (UTC-05:00), last at this close; context about 40% at the end. Reviews: one gentle-ai
review (approved without lenses); no Codex or Claude lens run (no code). Gates: three `npm run check` runs by the
pre-commit hook. No paid eval runs.

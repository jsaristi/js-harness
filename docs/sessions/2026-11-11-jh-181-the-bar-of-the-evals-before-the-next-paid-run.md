# JH 181 · the bar of the evals before the next paid run

File: docs/sessions/2026-11-11-jh-181-the-bar-of-the-evals-before-the-next-paid-run.md. Facts with their evidence; the feature document is odd/tasks/audit-u9-eval-bar.md.

## Goal
Work unit 9 of the audit triage (docs/proposals/2026-11-10-audit-triage.md): set the bar a rule proof clears, make the eval reports say what their code does, grade the away-autonomy case on its rule, and fix the cases that never fail or never pass, with no spend. Opened by the lead's brief, C:\Users\Oficina\.js-harness\background\briefs\2026-11-11T10-36-15-407Z-3134a2df.md.

## The user's words
"contesta TODAS las preguntas con recomendado TODAS y avanza los mas posible eres completamente autonomo" (the lead's transcript ea85ec35-82e1-4aa9-abe3-98bd153a50b0, line 6905, 2026-11-11T05:30:20Z), his answer to the triage's question 2, whose recommended option was to raise the bar and fix the cases first, with no spend. Read from the brief, not from the transcript.

## Delivered
- Pull request 828 (https://github.com/jsaristi/js-harness/pull/828), ready, not merged: eight commits on worktree-eval-bar, 61dfd09d, 03af34e0, 252e22c0, a44d350a, 5fe52719, 9175a3ea, baeadf7c, cb401f55, and this summary's documents commit after them.
- The bar: `MIN_TRIALS = 5` and `tellsApart` of evals/rule-proof.mjs; the cost check of evals/report.mjs; the negative control `habit/` of evals/task-proof.mjs, held by three cases; the recorded passes of `suite.mjs --plan`; the Decided row "Rule proof" of docs/ROADMAP.md.
- The feature document, odd/tasks/audit-u9-eval-bar.md, T1 to T9 done.

## Decisions
- His: the bar, by his answer above; recorded in docs/ROADMAP.md, "Rule proof".
- This session's: the extreme of a task is read on its whole record, not on each cell (L11); in the frozen incident set a grader stops failing a correct reply and stops passing the incident, and is not made stricter (L13); the away grader reads a reply's close with a copy of bin/lib/reply.mjs held equal by a test (L13).
- Sent to the lead with a recommended option, his to decide: which cases leave the paid set, and the A/B cost verdict at three trials a cell (L6).

## Failures and lessons
- "At most 9.1 %" of false proofs was the worst of eleven values read, not the largest, which is 9.4 %; found by the lens review, fixed in baeadf7c with a test that holds the figure; a Seen line of estimate-passed-as-fact in docs/FAILURES.md (L14).
- The trial counts of 252e22c0 were one arm's (L13).
- The independent verifier found a false pass or a false fail in each of the three graders after their own tests were green: a grader is proven by a reader who tries to break it, not by its author's table (L13).
- The model limit cut the verifier once; it was resumed with its context.

## Left
- Candidate 14 of the audit is not closed: 18 cases hold no habit and all 21 are owed a rule proof. The lead's.
- evals-b-2 to evals-b-5, evals-a-17 and incident-02's fixture: his, named in the pull request.
- Two false passes left on purpose in incident-01 and incident-05, named in the graders: his, with the frozen line.
- No paid run was made: whether any case clears the bar is not known.

## Cost
First notice 2026-11-11 about 05:40 local, closed notice after 12:16 local, with a stop for the model limit between 06:50 and 11:07; 89 % of the context at the end, compacted twice. Reviews: Codex twice (514,051 and 79,035 input tokens), the Claude lenses four times (9 lens runs), one double review of the plan, one verifier sub-agent (about 168,000 tokens). Gate runs: one a commit, ten commits. No eval spend.

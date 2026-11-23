# JH 217 · Codex reviewer to gpt-6.2-sol at max

File: docs/sessions/2026-11-18-jh-217-codex-reviewer-to-gpt-6-2-sol-at-max.md.

## Goal
Move the rules review-model and review-effort from gpt-6.1-sol at medium to gpt-6.2-sol at max on a `rule/` branch,
fix what the four refusing tests showed without weakening them, and say whether a Codex record made on 6.1/medium
still covers after the switch. From the lead's brief `jh217-brief.md` (a small task, no feature document).

## The user's words
"Pero necesito que hagas una cosa ya y es pasar de revisor codex a Sol 6.2 listo?" (transcript
305c10e3-46ab-45a7-8670-412d5b7d0422, line 2499) and his answer to question 339, "Sol 6.2 Max" (line 2676), both read
with `js-harness sessions --quote`.

## Delivered
- Commit f1acab03 `fix(review): pin the comparison cells' model as their effort is pinned`: `codex-review` takes an
  injected `model` beside `effort` (argv, run line, plan, announcing line, `ranOnAnother`); each lean configuration of
  `evals/review/compare.mjs` names gpt-6.1-sol, the model of all 7 committed readings. Two new tests first in
  `bin/codex-review.test.mjs` (seen red, then green).
- Commit b475339b `feat(rules): review-model is gpt-6.2-sol, review-effort is max`: the three files `rules switch`
  wrote, byte for byte its diff (`diff` against the saved diff printed SAME_AS_SWITCH).
- Pull request 911, open, ready: https://github.com/jsaristi/js-harness/pull/911.
- Step 3: a 6.1/medium record still covers. Coverage reads no model or effort (`bin/lib/codex-reviews.mjs:118-125`,
  `bin/lib/codex-review-coverage.mjs:345-362`); `npm run check` at b475339b, under the switched rules, said
  "2 code commits since origin/main, all covered by a Codex review record", records made on 6.1/medium.

## Decisions
- The fix rides in the same PR as its own commit before the switch: nothing in `rules check` or the merge door asks a
  `rule/` branch for one commit (`bin/lib/rules-change-run.mjs:168-190`, `bin/check.mjs:399`) (this session).
- Two assertions stated the rules' value, not a reading: `REVIEW_EFFORT === 'medium'` was replaced by a check of each
  lean cell's model and effort against its committed reading; the retired cell's message is asserted with
  `REVIEW_MODEL`/`REVIEW_EFFORT`, as produced (this session, on the advisor's advice; disclosed in the PR body).

## Failures and lessons
- The gate log named 4 failing tests; with the switch applied there were 7, all one cause (the model from the rule).
- The first full suite with the switch applied failed `conventions-structure`: `bin/codex-review.mjs` grew to 2261
  lines over its ceiling 2258; comments were folded back to 2258.
- The first review runs were given `--base 15f74d8d1`, a hash that does not exist; rerun with the full hash.
- Scripted edits by string match failed silently twice on files with CRLF line ends; the Edit tool was used instead.

## Left
- The land of PR 911 and the refresh of the installed copy (`--refresh-copy`): reviews stay on 6.1/medium until then.
  The lead's.
- `rules check` counts review-model 1 and review-effort 2 pattern hits in texts in force, all passing; not printed to
  see whether one names 6.1 or medium as today's reviewer.
- `CODEX_EVAL_MODEL` and `PROBE_MODEL` stay on gpt-6.1-sol: docs/future-model.md owns them.

## Cost
- One `rules switch` probe of the installed codex CLI 0.169.1.
- One Codex review on gpt-6.1-sol, medium, of 15f74d8..b475339: 75,616 input tokens (49,280 cached), 563 output,
  54 s; "the patch is correct" (0.94), no finding.
- One lens run, risk and reliability: about 39,200 input and 4,300 output tokens; no finding.
- Gates: two pre-commit gates, CI gate runs 44255056074 and 44255556701 both success; one full local suite and one
  `npm run check` (exit 0). Context at 56% at the ready notice (02:19 local).

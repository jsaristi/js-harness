# JH 122 · guard --stop: an estimate said as a fact is turned back

File: docs/sessions/2026-10-31-jh-122-guard-stop-an-estimate-said-as-a-fact-is-turned-back.md.

## Goal
`js-harness guard --stop` turns back a reply that states a forecast (a duration, a time of arrival or a cost of what
has not happened yet) with no estimate mark and no measurement named, in the same reading of stated figures as the
context-share check; row 72 of the lead's duties names it. Opened by the lead's brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-10-31T08-49-27-830Z-11e16d1d.md`, the third of the three checks
his answer to question 135 opened.

## The user's words
None in this session: the brief is the lead's. His decision is question 135, answered "Los tres primeros
(Recomendado)" (transcript 0f71b2c6, line 38994), read with `js-harness sessions --quote`.

## Bad news first
Of the six sightings of `estimate-passed-as-fact` as they were written, the forecast reading reaches none: three were
already marked ("near", "some", "cerca del"), two were counts, one a premise with no figure. The share check reaches
two. The new check holds the bare forecast from now on; counts and past figures stay unchecked, because reading them
would turn back 77 of the lead's 595 replies (L4).

## Delivered
- Pull request 737 (https://github.com/jsaristi/js-harness/pull/737), branch `worktree-estimate-as-fact`, ready:
  - `odd/tasks/estimate-as-fact.md`: contract, specs S1–S4, tasks T1–T3, Log L1–L9;
  - `statedFigures`, `forecastRefusal` and `ownShares` as its share half (`bin/lib/audit.mjs`); `stopRefusalOf`
    (`bin/guard.mjs`) joins both reasons in one turn-back (41f774d8, 638e27fe);
  - the guard's help and header, `bin/js-harness.mjs`'s help, the hook entry's comment, README and SPEC lines, row 72
    and item 3 of `odd/tasks/lead-duty-checks.md`, the `Control:` line of `estimate-passed-as-fact` in
    `docs/FAILURES.md` (the share's test moved to a `- Was:` line).
- Checked: audit 21/21, guard 39/39, js-harness 54/54, manifest 214/214, reply-hook-time 8/8, conventions 19/19,
  failures 78/78; `rules check` and `failures check` PASS; the budget test 4/4 on Windows (lead p90 729 ms, work p90
  646 ms, budget 2500 ms); each commit passed the pre-commit check, whose tests run in the PR's CI.
- Measured: 0 of the lead's 597 replies turned back; 9 of 7,588 over 120 work transcripts (5 distinct, 1 true), 80
  of them held out from the tuning. Cost per stop: the first reading in a fresh process 11 to 22 ms; no transcript
  read added.

## Decisions
- One reading, not a second parser: the share is read in every clause exactly as before (the verifier: identical on
  100,236 inputs); the forecast only in the writer's prose, masked of code and quotes before its clauses are cut.
- A forecast is a figure within 6 words of a future; any estimate mark, range or bound in the clause passes it, so
  the check errs toward passing. The writer's own plans and figures inside a condition are not read.
- No rule declared: the duty is a protocol line, and the check applies wherever `guard --stop` runs, as the share
  check does.
- gentle-ai's Stop hook offered the whole branch; its status was read and nothing started (`CLAUDE.md`).

## Failures and lessons
- Codex found that a quote holding a sentence's end was cut before it was masked; the verifier found `\b` after an
  accented letter never matches in JavaScript, so "medí" and "leí" never named a measurement, and quadratic time on
  long single-line clauses. Each was fixed test first and reviewed again.
- The worktree guard refused compound commands and `js-harness gate -- git commit`; they ran as plain commands.

## Left
- Merge of PR 737: the lead's. After it lands, the installed copy must be brought up to main for the hook to act.
- Known gaps, written in L7: a forecast with no future verb, a scheduled time in the future tense, marks that pass a
  clause from anywhere in it, a share-and-forecast reply with an unreadable transcript (fails open).

## Cost
- Time: 08:49Z (the brief) to 09:35Z.
- Reviews: Codex 2 runs (158,832 and 45,555 input tokens); the Claude lenses 2 runs, 4 lens results, 0 findings
  (about 81,000 input tokens); one independent verifier (about 126,000 tokens). Gates: 3 pre-commit checks, the
  budget test once by hand.

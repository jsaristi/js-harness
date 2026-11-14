# JH 196 · every role consults the advisor when it should

## Goal
Measure how often each role consults the Fable advisor before the acts that decide, propose a control, and, after
his yes, build it. The lead "JH ORQ · orquestador F8" opened the session; the feature document is
`odd/tasks/advisor-use.md`.

## The user's words
Question 282, answered "Sí, avisos primero (Recomendada)" (the lead's transcript 69918425-3b43-430f-9f50-62b6422422ce,
line 2795). The lead relayed it as: build the advisor hook, its test and a report; one week of warnings only, then
refuse; one consultation covers 60 calls or until his next message.

## Delivered
- PR https://github.com/jsaristi/js-harness/pull/866, open, ready for the merge door:
  - slice 1, the hook: `js-harness advisor-gate --hook | --stop` (1de6ed65, fixes b3043fb9, 12942c95, b91cde56,
    df028954, cec00bb7), two hook entries, `HOOK_ENTRY_LIMIT` 15 to 17;
  - slice 2, the report: `js-harness advisor-gate report [--since <day>]` (f281d013, fixes 4c7f22be, c88de835), with
    decisions by day, the flags a call followed, their Fable tokens against 2.4M a day, and the reconciliation with
    the acts in the transcripts that the Done-when needs.
- `node --test bin/advisor-gate.test.mjs`: 24 of 24 pass; the pre-push hook confirmed all 9 code commits covered by
  Codex and lens records.

## Decisions
- His: warnings first (question 282).
- This session's, under the yes (feature document L9): Fable callers recorded exempt; SubagentStop never blocks in
  the week; refusal is a one-line `MODE` change after the report.
- This session's (L15): the report reconciles decisions with the transcripts' acts, since the Done-when names it;
  the act is matched by the payload's `tool_use_id`, else by transcript, act and time.
- The lead's: P4a moved to JH 198 (L10).

## Failures and lessons
- A Codex run was discarded because a file was edited while it ran; commit first, then review (L11).
- The first report missed three things Codex caught: usage spread over a message's lines, calls with no result,
  and tokens across midnight (L15). The lesson: read how `usageOf` in `bin/lib/subagent-count.mjs` already reads
  usage before writing a new reader.
- `correctness` is not a lens; the lenses are risk, resilience, readability and reliability.

## Left
- Not checked: whether the host's PreToolUse payload carries `tool_use_id` (the time match covers it if not).
- Follow-ups: a heredoc body or an escaped quote can still read as a gated command (L12); folding the hook's Node
  process into the guard waits on JH 198.
- After the merge and a week of warnings: run `js-harness advisor-gate report` and decide on refusal (the lead and
  Sebastián).

## Cost
- From 2026-11-13 to 2026-11-14 10:50Z; two compactions; the context share at the end is an estimate, about 40%.
- Reviews: Codex on every code range (8 runs), the Claude lenses on every code range (8 runs, one refused for an
  unknown lens). Gate runs: the pre-commit check on every commit, three targeted suites through `js-harness gate`.

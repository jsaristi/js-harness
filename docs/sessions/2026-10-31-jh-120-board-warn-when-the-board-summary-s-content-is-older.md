# JH 120 · board: warn when the board summary's content is older than what it describes

File: docs/sessions/2026-10-31-jh-120-board-warn-when-the-board-summary-s-content-is-older.md.

## Goal
The lead is turned back once a stale stretch when notices have waited longer than one check since `board/summary` was
last written with `now` or `status`; row 1 of the lead's duties names this check. Opened by the lead's brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-10-31T07-48-05-299Z-4cd7b30e.md`, the second of the three checks
his answer to question 135 opened.

## The user's words
None in this session: the brief is the lead's. His decision is question 135, answered "Los tres primeros
(Recomendado)" (transcript 0f71b2c6, line 38994), read with `js-harness sessions --quote`.

## Delivered
- Pull request 735 (https://github.com/jsaristi/js-harness/pull/735), branch `worktree-board-summary-stale`, ready:
  - `odd/tasks/board-summary-stale.md`: contract, specs S1–S4, tasks T1–T4, Log L1–L9;
  - `summaryWrites` (`bin/lib/template-gate.mjs`), `recordSummary`, `isSummaryWrite`, `summaryContent`
    (`bin/lib/template-record.mjs`), the record from `template gate --shown` (`bin/template.mjs`) (cf492335);
  - `summaryWarning`, `rowsWarning`, `warnedBefore` (`bin/lib/stale-board.mjs`), `templates` passed through `stopIo`
    (`bin/reply.mjs`, `scripts/reply-hook-time.mjs`), the rows' warning kept when the shown record cannot be read
    (cf492335, 466c70b2, 1afe54d4);
  - the budget fixture made to fire the summary warning (`bin/reply-budget.test.mjs`), row 1 and item 4 of
    `odd/tasks/lead-duty-checks.md`, the `Control:` line of `board-summary-stale` in `docs/FAILURES.md`, the live
    board's section of `docs/SPEC.md`.
- Checked: the five test files of the change 111/111; `scripts/reply-hook-time.test.mjs` 8/8; conventions 19/19;
  `rules check` and `failures check` PASS; the budget test 4/4 (lead p90 739 ms, work p90 633 ms, budget 2500 ms);
  each commit passed the pre-commit gate, whose tests run in the PR's CI.

## Decisions
- The summary's writes go in the template gate's shown record as `shown` lines with no template, not a new store
  (the brief; `shownReport` counts no line without a template).
- A write counts as content when its fields hold `now` or `status`; the warning waits until the oldest notice after
  it is one check (45 min) old, as the rows' warning does; "once" is keyed by that write's time (L5).
- Only where `harness.json` turns `templates` on now (Codex's P2, L6).
- Left as known (L8): a write counts by collection and document, not by the board's URL; notices are compared by
  time; whether an `if_version` refusal reaches PostToolUse as a success was not checked.
- gentle-ai's Stop hook offered the whole branch twice; its status was read and nothing started (`CLAUDE.md`).

## Failures and lessons
- Codex found the check would keep reading a record that no write refreshes after a project turned templates off;
  the verifier found that a shown record that could not be read lost the rows' warning, the check's first purpose,
  and that one unreadable file dropped the fields other writes gave. Each was fixed test first and reviewed again.
- One of my edits lost a space (`const fresh =(`); the verifier saw it.
- The worktree guard refused compound commands naming git, a variable named `noGit` included, and a `--reason` with
  an apostrophe; they were rewritten as separate commands and scripts written to files.

## Left
- Merge of PR 735: the lead's. After it lands, the installed copy must be brought up to main for the hooks to record
  and warn.
- The third check of question 135 (an estimate stated as a fact): its own session.

## Cost
- Time: 07:48Z (the brief) to 08:30Z. No `opened` notice was sent at the start.
- Reviews: Codex 3 runs (132,143, 37,101 and 71,613 input tokens); the Claude lenses 2 runs, 6 lens results, 0
  findings (about 216,000 input tokens); one independent verifier (about 119,000 tokens). Gates: 4 pre-commit gates,
  the budget test run twice by hand.

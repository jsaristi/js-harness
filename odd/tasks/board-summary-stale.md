# Board: warn when the board summary's content is older than what it describes

Locator: `odd/tasks/board-summary-stale.md` · Engram mirror: `odd/board-summary-stale/tasks` · Branch:
`worktree-board-summary-stale` (worktree `.claude/worktrees/board-summary-stale`) · Session: JH 120.
Delivery: one slice, one pull request. Test runner: `node --test`.

## Goal
The template gate's after-call hook records each `ArtifactData` write of `board/summary`, with the fields it carried;
the reply hook's stale-board check turns the lead back once a stale stretch when notices have waited longer than one
check since the summary's last write carrying `now` or `status`.

## Why
From 2026-10-29 to 2026-10-31 the lead sent only `board-checked.json` (the `checked` fields) to `board/summary`, so
its `now`, `status` and `yours` showed questions long answered, and he asked whether they were really open. Row 1 of
`odd/tasks/lead-duty-checks.md` ("Keep `board/summary` current") had no check: the page's freshness reads only the
newest row and the `checked` stamp, and the stale-board hook counted rows only.

## Done when
- `node --test bin/lib/stale-board.test.mjs bin/template.test.mjs bin/lib/template-gate.test.mjs bin/reply.test.mjs` exits 0
- the cases of S3 in `bin/lib/stale-board.test.mjs` and `bin/template.test.mjs` failed before the change and pass
  after it, both runs quoted in `## Log`
- `node bin/js-harness.mjs failures check` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- row 1 of `odd/tasks/lead-duty-checks.md` names this check as its control, and the failure `board-summary-stale`
  in `docs/FAILURES.md` names it on its `Control:` line
- the change is on main through a pull request that passed Codex and the Claude lenses, and an independent verifier
  read it, named in `## Log`

## In scope / Out of scope
- In: `bin/lib/template-gate.mjs` (which call writes `board/summary`, beside `pageTarget`), `bin/template.mjs`
  (`gate --shown` records it in the shown record it already writes), `bin/lib/stale-board.mjs` (the summary's
  warning, sharing the lead test, the cursor and the record the rows' warning reads), their tests, the reply hook's
  help line, row 1, the failure's control line.
- Out: projects where `harness.json` does not turn `templates` on (the gate records nothing there, so the check says
  nothing); what the summary says (only that a content write is older than the notices); Codex (no artifact
  database); a new record or schema.

## Constraints
- Amend the shown record (`js-harness.shown/v1`), no new store — because the brief says so and the after-call hook
  already writes it. A summary write is a `shown` line of tool `ArtifactData`, subject `board/summary`, template
  `null`, the fields it carried in `reason`: `shownReport` counts no line whose template is `null`, so the escape
  list does not change.
- The reply hook runs on every stop with a 15 s timeout: the check reads one more small file only on the lead's stop
  of a project with a live board, and nothing else.
- Run only the tests the change needs before the gate — because the machine is short of memory (brief).
- Shared code read on every stop: Task Size high risk (items 6 and 3) — Codex and the Claude lenses on the slice,
  then an independent verifier.

## Ask me before
Nothing: his answer to question 135 (2026-10-31, "Los tres primeros (Recomendado)") authorizes this check and says it
changes no rule of his. Spend: one gate, one Codex review, the Claude lenses, one verifier.

## Specs
- S1. Brief of JH 120, from his answer to question 135 ("Los tres primeros (Recomendado)", transcript 0f71b2c6, line
  38994), item 4 of the unchecked duties: "the stale-board hook warns once when the newest notice the summary
  describes is newer than the summary's last update carrying `now` or `status`, which the template gate's after-call
  hook can record from the `ArtifactData` call".
- S2. A content write is an `ArtifactData` `set`, `update` or `str_replace` of collection `board`, document `summary`
  (or such an entry of a `batch`) whose `data`, `file_path` JSON or `field` holds `now` or `status`. A write holding
  only the `checked` fields of `sessions live --out` is recorded and is not one.
- S3. Cases (the brief): an update of `board/summary` whose file carries `now` or `status` counts as a content
  update; one carrying only the checked fields does not; the warning is said once per stale stretch (keyed by the
  summary's last content write, not by the newest notice); no warning while the summary is newer than the newest
  notice. Also: no warning while the oldest notice after the write is younger than one check (`CHECK_MINUTES`, as the
  rows' warning), and none when the record holds no summary write at all (the gate is off or not yet installed).
- S4. The reply hook's budget test (JH 116) stays green; its cost per stop is said in `## Log`.

## Tasks
- [x] T1 (S2, kind: build): `summaryWrites` in `bin/lib/template-gate.mjs`, `recordSummary`, `isSummaryWrite` and
  `summaryContent` in `bin/lib/template-record.mjs`, and the record from `gate --shown` in `bin/template.mjs`, tests
  first (L3). Route: inline. Commit: the slice's.
- [x] T2 (S1, S3, S4, kind: build): `summaryWarning` in `bin/lib/stale-board.mjs`, joined to the rows' one
  (`rowsWarning`, `warnedBefore` shared), tests first (L3); the budget fixture made to fire it (L4); the reply hook's
  help line. Route: inline. Commit: the slice's.
- [x] T3 (kind: docs): row 1 and item 4 of `odd/tasks/lead-duty-checks.md`, the failure's `Control:` line, the live
  board's section of `docs/SPEC.md`. The sessions summary at the close.
- [x] T4 (kind: verify): gate, Codex review, Claude lenses, independent verifier, pull request, ready notice. Each
  code commit gated and reviewed (L6, L7, L9); verifier on `466c70b` (L8), its fixes in `1afe54d`. Merge: the lead's.

## Log
- L1 (2026-10-31, the brief as written, `C:\Users\Oficina\.js-harness\background\briefs\2026-10-31T07-48-05-299Z-4cd7b30e.md`):
  "JH 120 · board: warn when the board summary's content is older than what it describes", with item 4 quoted in S1
  and the cases in S3.
- L2 (2026-10-31, searched first): codegraph for `staleBoardWarning`, the template gate and `ArtifactData`; `grep`
  for `board/summary`, `board-checked`, `ArtifactData` and `gate --shown` in `bin/`. The stale-board check is
  `bin/lib/stale-board.mjs`, called from `bin/reply.mjs` (`staleOf`); `sessions live` writes only the checked fields
  (`bin/sessions-live.mjs:207-220`). The after-call hook is `template gate --shown` (`bin/template.mjs`, `runGate`),
  registered as PostToolUse on `^(Artifact|ArtifactData|AskUserQuestion|mcp__visualize__show_widget)$`
  (`bin/lib/hook-entries.mjs:188`), so it already runs after each `ArtifactData` call but returned early (no page,
  no question). The lead's calls are `ArtifactData update`, collection `board`, doc_id `summary`, `file_path` a JSON
  file (transcript 0f71b2c6, the newest five). This project's `harness.json` holds `"templates": true`; its shown
  record holds 95 lines, 33 KB. No new store: the summary's writes go in that record.
- L3 (2026-10-31, RED then GREEN): before the code, `node --test bin/lib/stale-board.test.mjs
  bin/lib/template-record.test.mjs bin/lib/template-gate.test.mjs` could not load ("does not provide an export named
  'SUMMARY_MARKER'", "'summaryWrites'", "'SUMMARY_SUBJECT'"). Against HEAD's logic with only the marker exported,
  `bin/lib/stale-board.test.mjs` failed 5 of 15 (the five summary cases but "no summary warning where the gate recorded
  no summary write"); against HEAD's `bin/template.mjs`, `--test-name-pattern="board/summary"` failed 1 of 1. After:
  `node --test bin/lib/stale-board.test.mjs bin/lib/template-record.test.mjs bin/lib/template-gate.test.mjs
  bin/template.test.mjs bin/reply.test.mjs` 108/108; `bin/conventions-*.test.mjs` 19/19; `rules check` and
  `failures check` PASS.
- L4 (2026-10-31, the cost per stop, S4): the summary check runs only on the lead's stop of a project with a live
  board, after the lead test; it reads the shown record through the stop's shared `readFile` and searches the
  transcript only when a warning is due. `bin/reply-budget.test.mjs`, its fixture now with a 400 KB shown record (the
  lead's is 33 KB) and the summary warning firing: lead p90 1016 ms (runs 687–1224), work session p90 833 ms, budget
  2500 ms, 4/4 pass. In process, `staleBoardWarning` on a 62 M-character transcript, 6000 notices and that record:
  median 25.5 ms without the record against 28.8 ms with it and the warning given (max 35.4 against 66.5 ms, 15 runs),
  so about 3 ms a lead's stop, measured on this machine (script in the job's scratch, not kept).
- L5 (2026-10-31, design decisions): a notice counts once it is newer than the last content write, and the warning
  waits until the oldest such notice is one check old (`CHECK_MINUTES`, 45), as the rows' warning does, so a lead is
  not turned back between two checks. "Once" is keyed by that write's time (`(summary of <at>)`, or `none` when the
  record holds only checked writes), so newer notices are the same stretch. A write whose file cannot be read is
  recorded as fields unknown and is not content. All notices count, the lead's own included: `now`, `status` and
  `yours` describe the lead's openings and questions too.
- L6 (2026-10-31, reviews of `2947b290..cf492335`): Codex, "the patch is incorrect" (0.94), 132,143 input tokens, one
  P2: a project that turned `templates` off after summary writes were recorded kept being checked against a record no
  write refreshes. Fixed: the reply hook passes `harness.json`'s `templates` to the checks (`stopIo`, also in
  `scripts/reply-hook-time.mjs`), and the summary's warning runs only where it is `true`; the rows' warning is kept.
  RED: `bin/lib/stale-board.test.mjs` 1 of 16 (the templates-off case). GREEN: stale-board and reply 45/45, then reply
  with a hook-level case 30/30, `scripts/reply-hook-time.test.mjs` 8/8, the budget test 4/4 with its fixture's
  `harness.json` now turning templates on (lead p90 739 ms, work p90 633 ms, budget 2500 ms).
- L7 (2026-10-31, reviews of `cf492335..466c70b` and the slice): Codex on the fix, "the patch is correct" (0.98),
  its earlier finding fixed, 37,101 input tokens. The Claude lenses reliability, resilience, risk and readability
  over `2947b29..466c70b`, 0 findings each (55,299, 55,301, 26,944 and 55,119 input tokens). gentle-ai's stop hook
  offered the whole branch (`2947b29..HEAD`): its status was read and nothing started (CLAUDE.md, a candidate is never
  the whole branch).
- L8 (2026-10-31, the independent verifier, read-only, over `466c70b`, given the code and the brief): no blocker;
  each brief case held end to end in its scratch run of the real `template gate --shown` and `reply --hook` (a
  real-shape update, a batch, once per stretch); `shownReport` and the other readers of the shown record unaffected.
  Fixed here, tests first (RED 3 of 78, GREEN 111/111): (1) WARNING, a shown record that could not be read threw
  before the rows' warning was given, so it was lost: the rows' warning is now computed first and carried on the
  error (`warning`), which `staleOf` gives while it says the failure on stderr; (2) one unreadable `file_path` dropped
  the fields other writes of the call gave: now kept, "fields unknown" only when no write gave one; (7) a space lost in
  `const fresh = ` (my edit). Left, written as known: (3) a write counts by collection and document, not by the board's
  URL (another artifact's `board/summary` would refresh the stretch; low likelihood); (4) notices are compared by time,
  so one appended late with an earlier `at`, or from a clock behind, is not counted, and notices between the lead's
  read and its write count as described; (5) not checked: whether a write `ArtifactData` refuses for `if_version`
  reaches PostToolUse as a success; (6) no test chains the gate's record into the stop hook (the verifier's scratch
  run did), and `(summary of none)` is said once a transcript until a content write.
- L9 (2026-10-31, reviews of `466c70b..1afe54d`, the verifier's fixes): Codex, "the patch is correct" (0.96), no
  finding, 71,613 input tokens; the Claude lenses reliability and resilience, 0 findings each (7,767 and 16,097 input
  tokens). gentle-ai's stop hook offered the whole branch again: status read, nothing started. Every code commit of
  the branch is covered by both records.

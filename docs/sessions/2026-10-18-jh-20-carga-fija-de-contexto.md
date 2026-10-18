# JH 20 · carga fija de contexto

## Goal
Opened as reserve work session JH 20 (it waited with `js-harness wait --notice-to 20`). The lead named the feature: the fixed context load of a session, brief `jh20-brief-fixed-load.md`. Measure what loads at the first turn, per category and owner, recommend one cut per category, and build the harness-owned part test-first.

## The user's words
This session never got a message from the user: its first message was the lead's task, and every later instruction was the lead's. His decisions D1-D7 were asked by the lead and verified in the lead's transcript `e152c9d8`, lines 493 and 500. They are recorded verbatim in `odd/tasks/fixed-load.md` ("Decisions for him"), for example D1 "100.000 (Recomendado)" and D7 "Por ahorro medido (Recomendado)". Questions 6 and 7 got his answers at line 15496 (2026-10-16 21:41Z): "Apagar el plugin aquí" and "Probar apagar todos (Recomendado)".

## Delivered
- PR 203 `feat/fixed-load`, merged as f15757dc:
  - 281bf17, feat(check): the `fixed load` row (`bin/lib/fixed-load.mjs`). It reads the first turn of the latest five transcripts and gives their median against a 100,000-token budget. It is informational and warns over the budget.
  - 29b37ee: his decisions, and the cuts made outside the repo with their undo and backups.
  - cf4280d: a transcript that cannot be read is skipped, and a long line is read once.
  - 107754e: synthetic records are skipped.
  - d1f0dd9: records whose usage is all zero are skipped.
  - 2037562: the review assessment is recorded.
  - 13 tests in `bin/lib/fixed-load.test.mjs`, each rule seen RED first.
- `odd/tasks/fixed-load.md`: the measurement per category, the recommendations, D1-D7, and the table of changes outside the repository. T1-T5 are done; T6 is open.
- Machine changes, per his decisions (table in the feature document):
  - context7 and "claude.ai Claude Docs" in `~/.claude.json` `disabledMcpServers`;
  - `skillOverrides` for ten skills in `D:\js-harness\.claude\settings.local.json`.
- PR 431, docs: closed unmerged. It recorded his answers from 07:31Z, which the lead relayed to this session only on 2026-10-17. #324 had already recorded and applied his later answers.

## Decisions
- His: D1-D7 (feature document), and questions 6 and 7 (L12 on main, recorded by #324).
- Lead: draft until his answer; then "mark 203 ready"; then "assess each uncovered work-unit commit".
- This session:
  - The median of five sessions, not the lowest, because a headless run read 78,719 (L3).
  - A merge of main is not a review candidate (L11).
  - D4 and D5 were written to `disabledMcpServers` directly, because `/mcp disable` is refused headless (feature document).

## Failures and lessons
- Git Bash rewrote `/context` into `C:/Program Files/Git/context`, a paid model prompt. `MSYS_NO_PATHCONV=1` fixes it.
- The row measured 0 for a session in two cases, caught one after the other:
  - Codex found the first: synthetic records (P2, fixed in 107754e).
  - The `check` output after a restart showed the second: zero usage on the turn resumed after a compaction (fixed test-first in d1f0dd9).
- D4 and D6 had no effect in the desktop app.
  - `skillOverrides` returns "on" for plugin skills (read in `claude.exe`).
  - There is no project switch for a single claude.ai connector.
  - This session found it in its own `session_connectors_status` and `get_usage` (Claude Docs connected, Skills 7,031 tokens) and asked questions 6 and 7.
- `node bin/js-harness.mjs check` was run to read one row. It is the full gate and waited on the machine lock; TaskStop ended it. Read a row through its module instead.
- A lead message written at 07:31Z on 2026-10-16 arrived here on 2026-10-17, after newer answers. PR 431 was built on it, then closed once the lead's transcript showed the order. The lesson: verify a relayed answer's line and time against the latest one before acting on it.
- `contract check` refused task kind `decision`. The valid kinds are design, build, verify and docs.

## Left
- T6 (D2): exclude the orchestrator and routing blocks of `~/.claude/CLAUDE.md` once gentle-ai #4036 ships (open, checked 2026-10-16). It is F2's last open step; the lead holds it.
- Measuring whether the desktop app respects `enabledPlugins["anthropic-skills@inline"]: false` and `disableClaudeAiConnectors: true`. This needs a desktop session of `D:\js-harness` started after 2026-10-16 21:53Z (L12 on main). This session started before that, so its state proves nothing.

## Cost
- Time: the session ran from 2026-10-15 (the lead's notice) to 2026-10-18. Its own channel notices were the first at 2026-10-15 12:26Z and the last before closing at 2026-10-16 07:29Z.
- Context: 74% of a 350,000 window at the end (`get_usage`). The host compacted it once, at 07:25 on 2026-10-15.
- gentle-ai:
  - One review of 281bf17..29b37ee, lineage review-c50976cf29ac5360 (resilience, reliability): approved and acknowledged, with four advisories fixed in cf4280d.
  - Assessments of 29b37ee..107754e and 387ef65..d1f0dd9: medium risk, not due (under_budget).
- Codex: five reviews, each recorded in `.git/js-harness/codex-reviews.jsonl`.
  - d34f1d6..cf4280d: one P2.
  - cf4280d..107754e: the recheck, fixed.
  - 107754e..387ef65: 0.98.
  - 387ef65..d1f0dd9: 0.96.
  - d1f0dd9..af1d7f5: 0.97.
- Gate: every commit went through the pre-commit gate, eight commits and two merges on `feat/fixed-load` and `docs/fixed-load-desktop`. One gate failed: the task kind.

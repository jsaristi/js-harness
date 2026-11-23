# JH 226 · merge-queue dry run and its test folders

## Goal
Item `mq-dryrun` of plan version 4 (2026-11-18): `merge-queue --dry-run` compares the running copy with origin/main's
`bin/`, and the queue's tests stop filling Temp. Opening: the brief from JH ORQ, approved by question 340.

## The user's words
"Sí, las 8" (question 340, JH PLAN transcript `f5c3ee4d`), as the brief quotes it; not read here with `sessions --quote`.

## Delivered
- Pull request 922 (ready), branch `claude/merge-queue-dry-run-f51a20`: `79ecf67b` (the dry-run guard),
  `406a952b` (one scratch root), `a7d8803f`, `13081d5c`, `3045d8c4`, `5f889f00`, `44c6c3db`, `c565a2e9` (fixes
  from the reviews), and the feature document `odd/tasks/merge-queue-dry-run.md`.

## Decisions
- The dry run says the land's words, three paths then a count, so it predicts the land (this session; Log L5).
- The folder scan is an exact allowlist, a tripwire, not a parser (this session, on the advisor's word; Done when).
- ROADMAP left to the lead, since JH 222 holds it (Log L2).

## Failures and lessons
- A whole run under the long scratchpad TEMP failed seven relief tests by path length (L3): use a short TEMP to prove.
- The first fix commit was refused: `bin/js-harness.test.mjs:705` pins the help line; search a text's test too (L6).
- A shell heredoc wrote a backspace into a regex (`\b`): edit regexes with the Edit tool.
- A log was written to `D:js-harness-mq-relief.log` by a wrong relative path; its removal was refused: the owner's.
- Five Codex rounds on the scan; the tool stopped re-checking after three (L9 to L11).

## Left
- The tick of `docs/ROADMAP.md:934`: the lead, after JH 222.
- The 9,601 folders already in Temp, and `D:js-harness-mq-relief.log`: the owner.

## Cost
- Time: opened about 17:40Z, ready about 05:00Z (2026-11-19); context about 88% at the end.
- Codex: 8 runs (one hit its usage limit, one refused by the three-round stop); about 3 million input tokens in all.
- Lenses: 7 runs (4, 2, 1, 1, 1, 1, 1 lenses), about 0.1 million tokens. One read-only verifier (about 108,000 tokens).
- Gate runs: three whole-file runs of `bin/merge-queue.test.mjs` and about twelve single-pattern runs.

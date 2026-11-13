# JH 195 · the lead detaches the sessions it opens

## Goal
A small fix to the orchestrator skill: the lead detaches each work session it opens with `start_session` to top
level in the same turn, instead of leaving it nested until the lead is relieved. Opening read with
`js-harness sessions --opening 'JH 195 · the lead detaches the sessions it opens'`, from the lead "JH ORQ ·
orquestador F8".

## The user's words
Question 279, answer tapped "Sí, separarlas al abrir" (transcript 69918425-3b43-430f-9f50-62b6422422ce, line 392,
2026-11-13T16:15:45Z, read with `js-harness sessions --quote`).

## Delivered
- https://github.com/jsaristi/js-harness/pull/856, open and ready (notice `ready` at 16:36Z): commit 98cb7967.
  - `bin/lib/manifest.mjs`: the paragraph on opening a work session now says to detach it in that same turn with
    `detach_session`, why (a nested session wakes the lead on each turn it ends, and is archived with it while
    idle), and the accepted cost (a silent stop is seen by the heartbeat's `STALLED:` line after
    `rule:session-stall` minutes); the rotation line detaches only a session still nested before an archive.
  - `bin/lib/manifest.test.mjs`: a new test, failing first, and the rotation test's wording.
  - `bin/lib/rules-coverage-data.mjs`: one owed span's hash, refreshed by `rules coverage --refresh`.
- No feature document: small work.

## Decisions
- The user's: detach at opening (question 279).
- This session's: the dated proposal `docs/proposals/claude-app-native-sessions.md` (lines 275, 287) stays as
  written, since it is a record of 2026-10-30. The `detach_session` schema was read before the text named it: it
  takes the id of a session the caller started.

## Failures and lessons
- The first commit's gate failed: `bin/rules-coverage.test.mjs` refused "1 owed span edited in place since the
  register was written". Fixed with `js-harness rules coverage --refresh`; the next gate passed. Editing an owed
  line of a skill needs that refresh in the same commit.
- A Node heredoc ate the backslashes before the template literal's backticks (`SyntaxError` in manifest.mjs);
  found by the test run, fixed with Edit.

## Left
- The PR's CI and its land: the lead's merge queue.
- `docs/host-updates/README.md:27` still says the harness opens its sessions through `sessions start` only, while
  the lead also uses `start_session`: not touched here.

## Cost
- First notice 16:17Z, `ready` 16:36Z; about 40% of the context at the end.
- Codex: one review, 67,167 input tokens, verdict correct (0.96). Lenses: readability and reliability, 0 findings,
  about 19,000 input tokens. Gates: two commit gates on GitHub's machines (one failed, one passed), plus this
  summary's.

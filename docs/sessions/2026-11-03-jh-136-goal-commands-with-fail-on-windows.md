# JH 136 · goal commands with $( ) fail on Windows

File: docs/sessions/2026-11-03-jh-136-goal-commands-with-fail-on-windows.md.

## Goal
Make a stretch goal or a contract done-when command that uses `$( )`, which fails on Windows, impossible to miss,
with the smallest fix; small work with no feature document, from the brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-11-03T00-57-17-864Z-12b551dd.md`.

## The user's words
None in this session: the brief is the lead's.

## Delivered
- Pull request jsaristi/js-harness#762, ready, not merged. Branch `worktree-goal-shell`.
- 3394b742 fix(stretch,contract): `cmdShellGap` in `bin/lib/contract.mjs`; `validateContract` rejects such a
  done-when command on Windows (so `check`, `contract goal` and `contract run` refuse it); `stretch open` refuses such
  a goal on Windows (exit 2); `docs/RECORDS.md`.
- bf46bc72 docs(failures): entry `goal-written-for-another-shell`.
- 49b2f822 and 7d66a2d3 fix(contract): Codex's two P2 findings, the exemption narrowed to the code argument after an
  interpreter's code flag (`bash`/`sh -c`, `pwsh`/`powershell -c`/`-Command`, `node -e`/`--eval`/`-p`/`--print`).

## Decisions
- This session's: refuse before running rather than change the shell; gated on `process.platform === 'win32'`,
  since sh runs the same command on Linux and macOS and other projects' contracts there keep working. Recorded in
  the commit body of 3394b742.
- This session's: small work by the resume test (outcome, place and no open decision known after one read; no
  high-risk item, because on Windows such a command never computed its value, so the refusal removes no working
  behaviour). No feature document.

## Failures and lessons
- Reproduced before the fix: the goal's command through `runSensor` gave exit 2, `test: extra argument 'rev-list'`
  (cmd.exe passed `$(git` on as written; Git's `test` is on the PATH). The `node -e` form of the same goal exits 0.
- First version exempted a part by its program alone; Codex found `node -e "..." $(git ...)` passing. Second
  version exempted quoted `$( )` in such a part; Codex found `node -e "..." "$(git ...)"` passing. Both cases are now
  tests in `bin/lib/contract.test.mjs`.

## Left
- Not detected: a `$( )` inside the code of a program with no code flag (`powershell "$(Get-Date)"` is refused, a
  false positive the message explains), and other sh-only syntax in cmd.exe (`$VAR`, single quotes, `;`): no
  sighting yet. The lead's to schedule if one is seen.
- A stretch opened before this fix with such a goal still reads "not met"; none is open now (`stretch open` of the
  real plan in a scratch home: refused, exit 2).

## Cost
- From the brief at 00:57Z to the ready notice at 01:34Z (2026-11-03); 30% of the context at the ready notice.
- Gates: one `js-harness gate -- npm run check` and four pre-commit gates, all PASS.
- Reviews: Codex three times over db718d4..7d66a2d (92,622 + 31,261 + 31,499 input tokens; incorrect P2, not fixed,
  then correct at 0.96); the Claude lenses risk, reliability and readability once (0 findings). No gentle-ai review.

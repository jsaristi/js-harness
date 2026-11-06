# JH 118 · guard: refuse a push, commit, pr, land or notice chained by `;`

File: docs/sessions/2026-10-31-jh-118-guard-refuse-a-push-commit-pr-land-or-notice-chained-by.md.

## Goal
`js-harness guard --hook` refuses a Bash command in which `git push`, `git commit`, `gh pr`, `merge-queue` or
`notify` follows the step before it by `;`, a line break, `||` or `&`, naming the rule and saying to use `&&`; row 67
of the lead's duties names this check. Opened by the lead's brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-10-31T05-59-59-600Z-8c11dda2.md`, the first of the three checks
his answer to question 135 opened.

## The user's words
None in this session: the brief is the lead's. His decision is question 135, answered "Los tres primeros
(Recomendado)" (transcript 0f71b2c6, line 38994), read with `js-harness sessions --quote`.

## Delivered
- Pull request 734 (https://github.com/jsaristi/js-harness/pull/734), branch `rule/chained-steps`:
  - `odd/tasks/guard-chained-steps.md`: contract, specs S1–S4, tasks, Log L1–L9 (70e9e8f1, then each commit);
  - the rule `chained-steps` (`js-harness rules change`, scope repository, failure `chained-step-not-conditional`),
    `docs/RULES.md`, `docs/rule-sources.json` (efbbb26b);
  - `bin/lib/chained-step-guard.mjs` and its test (moved out of `bin/lib/guard.mjs` in 06869de9, which had reached
    1009 lines), the route in `bin/guard.mjs`, the `shellWords` escapes (4a3bc314, 06869de9, a1802693, 4b481303);
  - its control a check with a planted break (`bin/lib/rules-coverage-data.mjs`), the failure's control line in
    `docs/FAILURES.md` (the protocol line moved to `- Was:`), row 67 of `odd/tasks/lead-duty-checks.md`, the help
    lines (`bin/guard.mjs`, `bin/js-harness.mjs`, `bin/lib/manifest.mjs`) and `docs/SPEC.md`.
- Checked: `node --test bin/lib/chained-step-guard.test.mjs bin/lib/guard.test.mjs bin/guard.test.mjs` 82/82;
  `rules check`, `rules coverage --strict`, `failures check` PASS; the planted break red on 2 of 3 tests; each commit
  passed the pre-commit gate, whose tests run in the PR's CI.

## Decisions
- `||` and `&` refused, `|` allowed (S3): `||` runs the step only on a failure, `&` runs it beside the step before; a
  pipe feeds the step its input.
- The rule is of this repository's scope, as `terminal-note` (L3); every `gh pr` verb counts (L5).
- Only the operator right before a step counts, `then`/`else`/`do` bodies pass, and `if`/`while`/`until`/`time` are
  looked through (L4, L7, L8).
- Left as known (L7): an odd `"` in a heredoc's body inside `"$(...)"` still refuses (one retry with `&&`); `eval`,
  `xargs`, backticks, `$(...)`, `bash -c` and `powershell -Command` strings are not read.
- gentle-ai's Stop hook offered the whole branch five times; its status was read and nothing started (`CLAUDE.md`).

## Failures and lessons
- Codex found four misreadings on the first slice (escaped operators, wrapper options, leading redirections, git's
  value options); the risk lens and the verifier then found that the escape fix let `\\;` through, and Codex and the
  reliability lens each found one more `time` form. Each was fixed test first and its fix reviewed again: five rounds
  for one check, because a shell reader is only as good as the forms its tests name.
- A `--reason` holding `2>&1` and a node script with nested quotes were refused by the worktree guard or the shell;
  both were rewritten without the symbols, through files.

## Left
- Merge of PR 734: the lead's. After it lands, the installed copy must be brought up to main for the hook to refuse.
- The next two checks of question 135 (the board's summary, an estimate stated as a fact): their own sessions.

## Cost
- Reviews: Codex 5 runs (about 119k, 54k, 185k, ~60k and ~30k input tokens, most of them cached), the Claude lenses
  5 runs of 2 lenses on sonnet, one verifier sub-agent (about 108k tokens). Gates: 6 commits, each through the
  pre-commit gate; one push, one CI run.
- Time: brief at 2026-10-31T05:59Z; PR opened the same morning.

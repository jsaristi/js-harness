# JH SR · the long-session grader's shell reading

File: docs/sessions/2026-11-13-jh-sr-the-long-session-grader-s-shell-reading.md. Facts with their evidence; the whole
record is L7 to L9 of `odd/tasks/f8-long-session-eval.md`.

## Goal
Close the one failure three reviews left open in F8's long-session grader: its reading of the agent's shell commands
hid quoted operands that run or write. Opening: the lead's brief,
`~/.js-harness/background/briefs/2026-11-13T08-18-51-863Z-a7ba6dcb.md`.

## The user's words
None reached this session: it was started in the background by the lead, "JH ORQ · orquestador F8", and worked from
that brief alone.

## Delivered
- a707bc46, pushed: one shell reader in `evals/long-session/grade.mjs`; a write, a release and a test run are all
  read through it. Draft PR 855, left draft.
- cb741e12, pushed: the fix of Codex's one finding (a `sed` script glued to its flag).
- a3ad4a04 and this file's commit, pushed: the feature document's State and Log L7 to L9, and this summary.
- Tests: 60 pass in the three long-session files, 98 in `evals/configs.test.mjs`; `npm run check` passed in the
  pre-commit hook of each commit.

## Decisions
- This session: the reader stays in the grader; `shellWords` of `bin/lib/guard.mjs` was neither built on nor changed
  (L7). An inline program is left unread, so a mention is never read as a write (L7).
- This session: Codex was run from `8d828dbe --again`, as its refusal of `--base 36121dbb` named (L8). Assumed and not
  checked: that the refusal's condition, the change raised to him, was met by the brief.
- This session: one review pass over the fix and no round after it (L9).

## Failures and lessons
- The first commit had one real defect, found by Codex and fixed test first in cb741e12 (L8).
- The three earlier fixes each decided on raw text and then patched it; one reader for every reading is what ended
  that (L7).
- The brief's test command, `node --test evals/long-session`, does not run: the folder is taken as a file. The
  contract's three-file form is what passed.

## Left
- A red run behind a short `tail` is unseen, a false fail of moment 4 (L9): the feature's owner, JH 193.
- What the reader does not read, and moments 4 and 5 having only the transcript behind them (L7): JH 193 and the lead.
- CI: `gh pr checks 855` reported no checks on the branch.

## Cost
First notice 04:17 local, the closing one after it; 88% of the context at the end. Reviews: Codex two runs, about
332,000 input tokens; the Claude lenses six runs, about 83,000. Gate runs: one per commit, four. Nothing paid ran.

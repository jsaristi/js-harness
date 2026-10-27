# rule-f8-s3-split

Branch `rule/f8-s3-split`, from main (84b6b7ed). One pull request. Runner: `node --test`. The rule half of F8's S3;
the feature half is `odd/tasks/f8-s3-split.md` on `claude/f8-s3-split-251472`.

## Goal
Declare `claude-md-budget` with its `check` row, and rewrite `rules-live-in-the-harness` for the split of his answer
D3: Claude works from a root `CLAUDE.md` that imports `AGENTS.md`, so a rule's prose home is a line of either file.

## Why
The merge door takes a change to `bin/lib/rules-data.mjs` only from a `rule/` branch, and `rules change` keeps one such
branch open at a time, so both ids ride here. D3 is his typed words of 2026-10-27 (session
e41d1e8d-8264-45a4-b16c-f9279f7b6076, lines 1665, 1697 and 1733), checked by `rules change` against the transcript.

## Done when
- `npm run check` exits 0
- `js-harness rules claude-md-budget` prints the rule at 2300 estimated tokens
- `node --test bin/check.test.mjs` exits 0, with the `checkClaudeBudget` tests

## In scope / Out of scope
- In: `claude-md-budget` (declaration, `bin/lib/claude-md-budget.mjs`, its row in `bin/check.mjs`, tests);
  `rules-live-in-the-harness` (line 71 of `bin/lib/protocols-skill.mjs`, its source with every earlier quote kept and
  the three D3 lines added), and the memory-hygiene line of `bin/lib/manifest.mjs` that says the same.
- Out: D5 (`rule:double-review`), blocked on his typed words (`odd/tasks/f8-s3-split.md`, L3); the split itself.

## Constraints
- `bin/check.mjs` stays at its ceiling of 2110 lines: the row lives in its own module, and two imports of
  `bin/lib/rules.mjs` merge into one, so the feature branch's ceiling line is the only one that moves.
- The row gives nothing where a project has no `CLAUDE.md`, so this pull request and the feature's land in either order.

## Ask me before
Nothing: the budget is the project's; the rewrite carries his typed words.

## Tasks
- [x] T1 (kind: build) declare `claude-md-budget`, in 18083c91. Route: inline.
- [x] T2 (kind: build) its `check` row, test first, in e5e36473. Route: inline.
- [x] T3 (kind: build) rewrite `rules-live-in-the-harness`, in f4c058c8. Route: inline.

## Log
- L1. 2026-10-27, the brief from JH ORQ to JH 59: "Rule `claude-md-budget`: a declared rule with its own `check` row,
  set to the file's measured size rounded up to the next 100" and "Rewrites: the Decided row \"Portable by default\" in
  the roadmap and `rule:rules-live-in-the-harness` are rewritten for the split."
- L2. 2026-10-27: the root `CLAUDE.md` of the feature branch measures 2239 estimated tokens, so 2300. The first
  `rules change rules-live-in-the-harness` run replaced the rule's six earlier quotes with the three D3 lines; it was
  undone and run again with all nine, so the source keeps the words the rule came from.
- gentle-ai on `84b6b7ed..f4c058c8`: medium, not due (under_budget); the slice is this pull request.
- L3. 2026-10-27, Codex on 84b6b7e..f4c058c: the patch is correct (0.89), no actionable defects, recorded (109,797
  input tokens, 48 s).
- L4. 2026-10-27, JH ORQ: "D5 now has his typed words. Use the excerpt \"si\", transcript
  e41d1e8d-8264-45a4-b16c-f9279f7b6076, line 7461". `rules change double-review` narrows the rule to proposals that
  change one of his decisions (line 42 of `bin/lib/protocols-skill.mjs`; its two phrases unchanged). Its earlier
  source keeps the quote whose transcript is still on this machine; the one at line 14210 of e152c9d8 is gone from the
  sessions folder, so the command cannot check it again, and it stays in git history.
- gentle-ai on `e86a3530..5e464397`: medium, not due (under_budget); the slice is this pull request.
- L5. 2026-10-27, Codex on e86a353..5e46439 (D5): the patch is correct (0.9), no actionable defects, recorded.

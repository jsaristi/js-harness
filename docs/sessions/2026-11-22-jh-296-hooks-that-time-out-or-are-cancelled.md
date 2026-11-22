# JH 296 · hooks that time out or are cancelled

## Goal
A held work session of the F8 lead ("JH ORQ · orquestador F8"). It took the brief `brief-296-hook-timeouts.md`, in the
lead's notes folder: find why hooks time out or are cancelled and fix what is the harness's own. The lead's queue then
added PR 955's L9, PR 953 items 1 and 3, and the failure gate-pass-on-other-node.

## The user's words
No words of the user started this session. It was opened by the lead, whose standing constraints were "no paid run and
no Codex run before 2026-11-23 23:45 (record a skip with `--unavailable`), draft PRs only, nothing lands". The last
unit was given as "the free failure gate-pass-on-other-node (bin/lib/sensor-rows.mjs and the gate log; ~3h [e]), test
first, one commit, its Control line in docs/FAILURES.md" (the lead's cross-session messages, transcript
1625f772-2f85-4769-b56b-08f1c0b84535).

## Delivered
- PR 974, open as a draft (branch claude/jh296-hook-timeouts, head 510c3c57). U1 is the diagnosis in
  `odd/tasks/hook-timeouts.md`. U2 makes doctor --hook read the codegraph and codex versions from their packages, not by
  spawning them: 1.7-2.0 s against 2.6 s before.
- PR 982, open as a draft (base claude/jh291-false-idle, head ac55145a): PR 955's L9, `idleBeside` in
  `bin/lib/stretch.mjs`.
- PR 984, open as a draft (base claude/jh290-951-open, head 9edca038). It does PR 953 item 3: a test pins the two
  cross-session wrapper shapes, with L10 in `odd/tasks/spend-stop.md`. Item 1 was skipped.
- PR 989, open as a draft (base main, heads b2020657 and d61a885f): gate-pass-on-other-node.
  - The WSL runner prints its node, asked on the PATH its command runs on.
  - WSL sensor rows and the gate log carry `node`, and the detail names it.
  - Its Control line is in `docs/FAILURES.md`.

## Decisions
- Lead: old-rule-beside-new was dropped from the queue (its file, rules-data.mjs, is in open PR 945).
- Lead: the spend line went from 20M to 42M cumulative.
- This session: Windows sensor rows carry no node in PR 989. `bin/check.test.mjs` pins their shape and open PR 947
  edits it, and the brief skips such files. The check test went to `bin/check-shadow-wsl.test.mjs` instead.
- This session: PR 953 item 1 was skipped because it lives in `bin/guard.mjs`, a guard file.

## Failures and lessons
- A `cd D:/js-harness` moved the session's directory, and the guard then refused a `cd` back. The fix: `git -C` and
  absolute paths only.
- Bash heredocs that carried JS through `node -e` or `node -` turned `\n` into real newlines inside test strings, twice.
  The fix: test text goes through Edit, or through `cat >> file <<'EOF'`, never through a JS string in a heredoc.
- PR 989's first commit was refused by the gate: `bin/check.mjs` grew to 1931 lines, over its ceiling of 1928. The fix
  was to inline the row's `node` without a comment.
- The reliability lens on b2020657 found that the node mark asked an absolute path, not the node the command finds. It
  was fixed in d61a885f and the recheck said "1 fixed".

## Left
- PR 953 item 1 is blocked in `bin/guard.mjs`; the design is the lead's.
- Windows node rows wait for PR 947's file, `bin/check.test.mjs`.
- The PostToolUse `resume --pause` timeout waits for PRs 968 and 950.
- Codex reviews are owed on every range of PRs 974, 982, 984 and 989, after 2026-11-23 23:45. Each was recorded with
  `--unavailable`.
- All four PRs are drafts, held by the lead.

## Cost
- Time: first notice 2026-11-22T20:58:35Z, closed about 22:40Z.
- Spend: 44.15M tokens cumulative (`spend.mjs` over transcript 1625f772), past the 42M line.
- Context at the end: 41% after one host compaction at 16:39 local.
- Reviews: the Claude lenses on each code slice of the four PRs (PR 989: reliability and resilience, then a reliability
  recheck). Codex: none; skips recorded.
- Gate runs: pre-commit gates on each commit. PR 989 took three, one of them refused for the line ceiling.

# Notify title from worktree sessions

A fix assigned by the lead to JH 35, on branch `fix/notify-worktree-title`. Test runner: `node --test`.

## Goal
A notice sent by a session opened in a worktree carries that session's title, and the Stop hook stops saying "you hold work" once that session gave its work back.

## Why
JH 30 ran in `.claude/worktrees/compassionate-allen-842d94`. Its closed notice of 2026-10-20T02:09:59Z (channel record line 841) has `"title":null`, so `heldWork` (`bin/lib/stop-wake.mjs`), which matched a close by `workNumber(notice.from?.title)`, never saw the work given back. The cause, checked on disk: Claude Code filed the transcript under `~/.claude/projects/D--js-harness--claude-worktrees-compassionate-allen-842d94`, and `senderOf` listed only `D--js-harness`; the transcript carries `"customTitle":"JH 30 · onboarding"`.

## Done when
- `npm run check` exits 0
- `node --test bin/notify.test.mjs bin/reply.test.mjs bin/lib/channel.test.mjs` exits 0, with the regression test for a session in a `.claude/worktrees` worktree

## In scope / Out of scope
- In: `senderOf` and the commands that call it (`notify`, `wait`, `sessions --opening`), `heldWork`, their tests, this document.
- Out: the board (`readSessionsWindow`) and `transcriptNamed` (an answer's transcript), which read only the main checkout's sessions folder too: a follow-up, since the board's reach is its own decision.

## Constraints
- A notice is a session's claim — so the fallback reads the sender's id, which the host gives, never the `JH n:` at the start of a text any session can write.

## Ask me before
Nothing: the lead assigned the fix.

## Specs
- S1 "notify, and whatever reads a session's title (`sessionFacts` and `titleRead` in `bin/lib/sessions.mjs`), also look in the Claude project folders of the repository's worktrees"
- S2 "as a fallback, `heldWork` may read the work number from the notice text's leading `<code> <n>:`, but only if that is safe. Weigh it against the rule that a notice is a session's claim."
- S3 "Add a regression test for a session in a `.claude/worktrees` worktree."

## Tasks
- [x] T1 (kind: build) S1, S3, inline: `projectDirsOf` lists the main checkout's sessions folder and each worktree's; `senderOf` finds the transcript among them (`transcriptOf`).
- [x] T2 (kind: build) S2, inline: `heldWork` also takes a close whose sender id is the stopping session's own.

## Log
- L1 (2026-10-20, the lead's brief): fix the null `from.title` of notices sent from a `.claude/worktrees` worktree; S1-S3 above; done when `npm run check` exits 0, the new test passes, and the PR is ready with its gentle-ai line and a Codex review.
- L2 (T1, T2): RED was three new tests failing (senderOf across folders, notify from an app worktree, an untitled own close); GREEN all three, with 820 tests of the six affected files passing. On the real record, `senderOf` for session 211a43fc read `null` before and `JH 30 · onboarding` after. `titleRead` and `sessionFacts` read text and the record, not folders, so they needed no change. S2's text fallback was declined: a notice from `JH 31` whose text begins `JH 30:` would close JH 30's work; the sender id is the host's, as the title already is.
- L3 (T1, T2, commit 722cdbf0): gentle-ai assessed 19ac60ff..722cdbf0 (committed only) as medium risk, review not due (under_budget, 221 lines). Codex reviewed the same range (gpt-6.1-sol, medium, recorded): "patch is incorrect" (0.94), one P2, that `git worktree list --porcelain` quotes a non-ASCII path under `core.quotePath`, so `projectDirsOf` would derive the wrong folder. Refuted by running it: on git 2.54.0.windows.1 a worktree `wt-ñandú` is listed as its raw UTF-8 bytes, unquoted (`cat -A` shows `wt-M-CM-1andM-CM-:`); git quotes only a lock reason in that output, never the path. No change.
- L4 (T1, correction of L3): the pre-push hook keeps an unanswered Codex finding open, and has no way to record one refuted, so the correction makes it moot instead: `projectDirsOf` reads `git worktree list --porcelain -z` and splits by NUL, which takes any path as git wrote it, a line break included. RED was the new `projectDirsOf` test; GREEN 821 tests of the seven affected files, and the real record still gives `JH 30 · onboarding`. A git older than 2.36 has no `-z` there and leaves the main folder alone.

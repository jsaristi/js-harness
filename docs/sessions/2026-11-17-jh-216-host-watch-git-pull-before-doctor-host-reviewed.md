# JH 216 · host-watch: git pull before doctor --host-reviewed

File: docs/sessions/2026-11-17-jh-216-host-watch-git-pull-before-doctor-host-reviewed.md.

## Goal
Make step 11 of the host-watch brief (`renderBrief` in `workshop/lib/host-watch.mjs`) ask for `git pull` in the main
checkout before `js-harness doctor --host-reviewed`, from the lead's brief `jh216-brief.md` (a small task, no feature
document).

## The user's words
"Sí, agregar el git pull", his answer to question 337 (transcript 305c10e3-46ab-45a7-8670-412d5b7d0422, line 1997,
read with `js-harness sessions --quote`). The question said Desktop 6.6395.0 no longer updates the local main branch
for worktree sessions, and that a yes authorizes nothing else: no other command changes, no pull run for him.

## Delivered
- Commit 3f1878b6 `fix(host-watch): ask for git pull in the main checkout before doctor --host-reviewed`: step 11's
  text and the test that pins it (`workshop/lib/host-watch.test.mjs`, the brief test: `git pull` between
  `gh pr create` and `doctor --host-reviewed`, and on step 11).
- Pull request 908, open, ready: https://github.com/jsaristi/js-harness/pull/908.

## Decisions
- The step's wording keeps the question's: "ask first for git pull in the main checkout"; the question names no
  other actor, so the text names none (this session).
- The PR body carries no AI attribution line, as PR 907's does not (this session, on the user's global rule).

## Failures and lessons
- The first Codex run never started: its log redirect used a wrong relative path (`codex exit 1`, no such file).
  Rerun alone; the lens run beside it was fine.
- The test was seen red only on the order assertion (`git pull comes after the step before it`); the step-11
  regex was not seen red on its own.
- The commit message carried a Co-Authored-By line; the commit-msg hook removed it.

## Left
- Doctor's own hint still names `doctor --host-reviewed` with no pull (`bin/lib/host-update.mjs:234`, `:264`):
  outside this task's authorization; the lead's to raise.
- CI on PR 908 showed no checks when the ready notice was sent.

## Cost
- One Codex review on gpt-6.1-sol, medium: 31,228 input tokens (9,216 cached), 312 output, 19 s; "the patch is
  correct", no finding.
- One lens run, readability and reliability: about 13,900 input and 2,400 output tokens; no finding.
- One `npm run check` (PASS) and the pre-commit gate; context near 30% at the ready notice.

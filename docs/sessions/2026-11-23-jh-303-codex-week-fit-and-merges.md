# JH 303 · codex week fit and merges

File: docs/sessions/2026-11-23-jh-303-codex-week-fit-and-merges.md.

## Goal
A held work session given three briefs by the lead (JH ORQ) by message: whether the open drafts' Codex reviews
fit the week after the reset (2026-11-23 23:45); then main merged into the PRs that conflict with it; then 899's
merge and one docs PR. Notes folder: the lead's group folder `local_f536332a-...` (outside the repo).

## The user's words
None read here: the briefs came from the lead. The owner's line the group runs under is quoted by the lead's
background, not read with `js-harness sessions --quote`.

## Delivered
- Notes `codex-week-fit-2026-11-23.md` (no commit): 46 code PRs planned with `codex-review --plan`, no Codex run.
  Owed first pass 85.0M input; 1.86M per weekly point pooled (spans 1.53 to 2.04); 46 points first pass, 59 with
  rounds (x1.33 from the run log); fits 100 and the 70% stop alone; with T5 and the card reads it runs out at 993.
- Main merged, pushed with lease, a comment on each PR: 935 82d816c4 -> b837e649; 950 afbf3774 -> 2b71aac2; 951
  0c6e6169 -> faabe6e5; 953 882161c8 -> 1b6deef7; 984 9edca038 -> a8162f5d; 899 f9d472b6 -> 78b78314 (resolution
  accepted by the lead). Each merges clean with main after. Record: notes `jh303-merges-2026-11-23.md`.
- PR 1022, ready: two Seen lines under `taskstop-leaves-work-alive`; JH 301's summary brought up to main; this summary.

## Decisions
- This session, accepted by the lead: merge main, not rebase, since a record covers its range's commit ids
  (`bin/lib/codex-review-coverage.mjs:57`) and a rebase voids them.
- The lead: 935's merge commit gets a real lens review and a Codex skip; docs-only and clean merges get none.
- The lead: 934 skipped until JH 277's fixes are pushed; 899's content resolution accepted.

## Failures and lessons
- A first plan batch outlived its `TaskStop` and checked out heads under a second batch: plans of wrong heads.
  Found by heads in the output not matching; killed by pid; the rerun checks each head before and after.
- Spend past the line: measured 33.8M against 25M, while the notices carried estimates (about 16M). Found by the
  advisor; the line was raised to 40M by the lead and measured from the transcript after each step since.
- 899's merge commit says the resolution was accepted on 2026-11-23; it was 2026-11-22 local. Said in a PR comment.
- Commands joined with `;` and Monitor waits, against the brief; the guard refused two such joins.

## Left
- 934: merge main into `jh277-934-fixes` once pushed (the lead's reset day).
- 935's merge owes a Codex review (~35k tokens) and its lens finding on main's `bin/lib/stack.mjs:245-253` has no
  recorded answer.
- The state of `taskstop-leaves-work-alive` after the two Seen lines was not read.

## Cost
- Time: first notice 23:07 local 2026-11-22, last 00:03 local 2026-11-23.
- Spend: 37.0M input tokens measured (transcript, input + cache creation + cache read per message id), line 40M.
- Reviews: one reliability lens over 935's merge (28k input); no Codex. Gate: the pre-commit check on each commit, green.

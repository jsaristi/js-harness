# JH 163 · audit triage: the verified findings as tasks

## Goal
Check the Fable 5.2 audit's 37 medium and 8 low verified findings and its 27 candidates to shed or merge against
`origin/main` as it is now, and turn what is still true into ordered work units the lead can put to him. Opened by
the lead's brief `~/.js-harness/background/briefs/2026-11-10T05-45-16-438Z-56e16fd0.md`, started with
`js-harness sessions start`.

## The user's words
"quiero que revise todo lo que hemos hecho" (2026-11-09, his request for the audit, JH 161), quoted from the brief;
this session read no transcript of his, so the line was not checked here.

## Delivered
- Pull request 805, draft, documentation only: `docs/proposals/2026-11-10-audit-triage.md` (commit `cc36a590`) and
  this summary.
- Verdicts at `origin/main` `6ee974dd`: 43 still true, M5 changed (pull request 799, `2717f7ca` and `37d7ff61`), M32
  does not hold (`bin/merge-queue.mjs:358` against `bin/lib/refresh-consent.mjs:43-49`).
- New fact: `main` has no branch protection and no ruleset on GitHub (`gh api .../branches/main/protection` gives
  404; `gh api .../rulesets --jq length` gives 0).
- 13 work units in order, 6 of them his call, each with its question in Spanish.

## Decisions
- Small by `CLAUDE.md`'s test (one document, no source write), so no feature document; this session's, recorded in
  the proposal's header.
- The verdicts were read by this session itself, with no sub-agent readers: about 45 short reads, each of the lines
  a verdict rests on, which the brief asks to be read by the session anyway; this session's.
- The pull request stays a draft, as the brief says, so the `ready` notice was refused by `notify` ("PR 805 is a
  draft"); a `note` with the number went instead; this session's.

## Failures and lessons
- Four line references in the first draft were off by one or pointed at a comment (`evals/rule-proof.mjs:116`,
  `docs/rule-sources.json:376`, `bin/codex-review.mjs:270`, and two test files that do not exist); found by checking
  each named file before the commit, fixed in the same commit.
- M27 was left out of every unit in the first draft; found by walking the list of ids against the units, and added
  to unit 4.

## Left
- The six questions in the proposal, for the lead to put to him one at a time.
- The seven units the lead can schedule; none started.
- The five unverified appendix findings named to verify first; the other 286 stay unverified.

## Cost
- Time: the brief is stamped 00:45 local (05:45Z); first notice 00:51 local, last 00:58 local, 2026-11-10, then
  this summary and the closed notice.
- Context at the end: about 40 % (the 00:58 notice said 39 %).
- Reviews: none run (documentation only; the brief forbids a Codex spend). Gate: one pre-commit gate, PASS.

# JH 300 · Modern Web Guidance T2

File: docs/sessions/2026-11-22-jh-300-modern-web-guidance-t2.md.

## Goal
Task T2 of `odd/tasks/web-guidance.md`, of kind verify: the install trial of Modern Web Guidance on a scratch home.
The brief was JH ORQ's `brief-300-web-guidance-t2.md`, with its amendments, in the lead's notes folder.

## The user's words
"haz la prueba de Modern Web Guidance" (transcript `0cdab702-72bd-48e7-8a8e-0c38d4aca9c9`, line 13918,
2026-11-23T00:18:00Z, quoted with `js-harness sessions --quote`).

## Delivered
- Branch `claude/jh300-web-guidance-t2`, cut from `origin/main` at `14f0b8cc`. Two docs-only commits, `624414e7` and the correction after the re-run: T2 ticked, log
  line L11, the State line and the header of `odd/tasks/web-guidance.md`, and this file. jsaristi/js-harness#995 is ready, not
  a draft, as the lead's amendment asks for a docs-only change.
- Checks: `js-harness contract check odd/tasks/web-guidance.md` and `npm run check` (their output is in the PR body).

## Decisions
- The lead read his yes as covering T2 only (the brief). T3 needs his spend and his home decision.
- This session read loaded skills from the `init` event of an offline `claude -p` session: a dummy key, with the API
  pointed at `127.0.0.1:9`, so no model was reached and every result cost 0. The advisor agreed, on the condition of
  a positive control, which passed (L11).
- This session answered Codex from its help and the plugin's manifest only, with no Codex install: limit 2 of the
  brief fetches only the Claude marketplace.

## Failures and lessons
- The first commit claimed the off-then-on order without running it in that order; the advisor caught it, and a
  re-run in a second scratch home confirmed it (L11).
- Two shell lines joined steps with `;` (the first probe, and one `plugin disable` line), against the brief's
  "`&&` only". Neither changed anything outside the scratch home. The lesson: write every chain with `&&` and put a
  check that may fail last.
- The broad before-grep was cut at 10 lines by `| head`, so it could not serve as a baseline. The narrow search,
  complete at 6 lines, was used before and after instead.
- The "find nothing" check of the amendment could not hold literally. His home already held 6 catalog and readme
  files naming the plugin. The same 6 were there before and after, and no settings or state file named it either time.

## Left
- The senior pass over T3 to T7 with L11 in hand. The lead places it.
- His decisions under "Ask me before": T3's spend, his real home, the default, telemetry, and the unpinned `npx`.
- Whether a project's `.codex/config.toml` can hold a plugin out. Only a Codex install can show that, and none is
  authorized.

## Cost
- First notice 19:26 local, last before closing about 19:50. Context about 60% at the end.
- No Codex review: the commit is documents only, and the brief forbids one before 2026-11-23 23:45. No lens review: no
  code changed. No paid run and no eval.

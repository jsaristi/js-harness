# JH 301 · plans ready for Codex day

File: docs/sessions/2026-11-22-jh-301-plans-ready-for-codex-day.md.

## Goal
A held work session given documents-only units by the lead (JH ORQ), so that Codex day (after the weekly reset of
2026-11-23 23:45) starts with builds and decisions ready. Opening read: the lead's brief `brief-301-plans-ready.md`
in its notes folder, then three messages from the lead adding units.

## The user's words
Quoted by the lead's brief, not read here with `js-harness sessions --quote`: transcript
`0cdab702-72bd-48e7-8a8e-0c38d4aca9c9`, line 14256 (20:47 local): "pero no quiero que vuelva a suceder esto, tenemos
que estar a toda hora trabajando con las horas llena y con lo siguiente a trabajar".

## Delivered
- PR 997, merged (`a8bf5f68`): `odd/tasks/f8-s8-designs/rerun-pricing.md`, S8's paid rerun priced row by row by
  `--plan` (core $42.91 / $63.40 / $83.88).
- PR 998, merged (`376a5bf3`): `odd/tasks/context-diet.md`, the desktop probe's steps (four arms, a positive
  control, a reader tested on a real transcript: 79,136).
- PR 1001, ready (head `6a55e2f9`): `odd/tasks/resume-legacy-shorten.md` and `odd/tasks/hyperv-rehearsal.md`,
  contract and depth pass each; both States owe the double review first.
- PR 1004, merged: probe step 2 started by the lead on the turn of his yes; web-guidance T3 priced ($43.50 /
  $67.20 / $119.40, least gain 4 of 10 on one arm, cap $70 mid only); `eval-codex-login.md`, four ways.
- PR 1005, ready: the login page's two code reads; C as written breaks the arm (`bin/lib/project.mjs:1032-1034`,
  `:993`), recommendation C'. This summary.

## Decisions
- This session: S8 pricing beside the S8 document, not in it, because PRs 967 and 930 edit it (rerun-pricing L2).
- This session: the plan-review Later line gets no document, assumed served by `js-harness double-review` [a]; the
  lead keeps the line as a proposal for him.
- The lead: about three units per READY PR; the probe's sessions started by the lead (context-diet L7).

## Failures and lessons
- The first open-PR read was cut at 30 by `gh pr list`'s default; PR 930 was missing. Found by the advisor; every
  later read used `--limit 200`.
- A rule id was cited that does not exist (`rule:one-try`); found by `js-harness rules`, replaced by the CLAUDE.md
  text before the commit.
- The first T3 band mixed arms and efforts, and the login page recommended a way whose effect on the arm was
  unread; both found by the advisor before push, corrected in PR 1004 and refuted by the reads in PR 1005.
- Edits by a node script failed on CRLF files and shell-escaped `$`; scripts written to a file by a quoted heredoc
  with `\r?\n` patterns work.

## Left
- His decisions: the S8 rerun's cap and the Codex login way (C'), the desktop probe's yes, web-guidance T3's spend,
  the Hyper-V rehearsal's five decisions, whether to take the resume shortening now. The lead holds them.
- Double reviews of PR 1001's two documents, after Codex's reset. The lead places them.
- Not read: whether a lens review can run inside a long-session trial and its cost.

## Cost
- Time: first notice 20:57 local (PR 997 ready), last before this summary about 21:50 local, 2026-11-22.
- Spend: 26.8M input tokens over 132 calls (sum of input, cache creation and cache read per message id in this
  session's transcript), of the 30M line.
- Reviews: none run; documents only. Gate: `npm run check` in the pre-commit hook on every commit, all green.

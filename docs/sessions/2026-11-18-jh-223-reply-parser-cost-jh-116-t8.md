# JH 223 · reply parser cost (JH 116 T8)

File: docs/sessions/2026-11-18-jh-223-reply-parser-cost-jh-116-t8.md.

## Goal
Item `replyparser` of the stretch's plan version 4 (2026-11-18): task T8 of `odd/tasks/reply-hook-latency.md`, what
the command-block check's PowerShell parser costs on a stop whose reply hands him a block. Measure first and write the
numbers in the document, then the smallest change that keeps every refusal; T5 closed or left open with its reason.
From the brief in JH PLAN's notes `plan-2026-11-18-away.notes.md`, section "## Items", with versions 3 and 4.

## The user's words
"Sí, las 8", his answer to question 340 approving this wave, as the brief quotes it (JH PLAN transcript `f5c3ee4d`);
not read here with `js-harness sessions --quote`, since the brief gives no line.

## Delivered
- Commit 9a47edbf `fix(reply): a block whose last command PowerShell cannot find is checked, not failed`: the parser
  script ends on `exit 0` (`bin/lib/reply-commands.mjs`); a real win32 test over PowerShell 7 and the Windows
  PowerShell fallback, red on b044dbf7 (`failed: 'PowerShell: it exited 1'`), green after.
- Commit 0168e1ef `docs(tasks): reply-hook-latency T8 measures the parser's cost, T5 closed by question 138`: `## Measure`,
  "The parser's cost (T8)"; T5 and T8 ticked; L12 to L14.
- Commit cc56e0f2 `fix(reply): a PowerShell lookup that fails for another reason than a miss still refuses` (Codex's
  P2 over b044dbf..0339273: `& 'Get-Ite[m' -x` passed unchecked).
- Commit 5fd74a29 `fix(reply): a failed PowerShell lookup refuses its own block, not the whole batch` (the resilience
  and reliability lenses over 0339273..cc56e0f).
- Commit b45380f2 `fix(reply): each line the PowerShell check prints stays one line` (Codex's P2 over cc56e0f..5fd74a2:
  a CR or U+2028 in a name dropped the refusal line).
- Commit 66e91c91 `fix(reply): the PowerShell check defines no command a block could name` (the advisor:
  `Find-Command -zz` passed, shadowed by the script's own function).
- Commit 9760618b `test(reply): the shadowing case defines its own Find-Command, needing no module` (Codex's P2).
- Each fix test first, the real win32 test red before it, in PowerShell 7 and Windows PowerShell; L15 to L20.
- After the lead made PR 916 a draft over JH PLAN's three conditions (L21): commit 5df63e00 `test(reply): an own block
  whose last command is unknown is pinned through commandRefusals`, red on b044dbf7; commit 4f989932, its own 60 s
  deadline, a parse count and the sibling's exact refusal (Codex's P2s and P3); the four dropped cases listed under
  `## Measure`; the verifier's word "No other refusal is lost" (L22).
- Pull request 916, marked ready after the conditions: https://github.com/jsaristi/js-harness/pull/916.

## Decisions
- No cut to the parser: its time is PowerShell's start (494–1423 ms of a check, the script itself 228–537 ms), no start
  option beats the load's noise, and Windows PowerShell first would change verdicts (`&&`) (this session, L13).
- Four cases main refused only by "it exited 1" now pass: an `own` block whose last command misses; a handed block
  with an unreadable transcript; valid sibling blocks; alias, `.ps1` and module misses. The brief asked to keep every
  refusal; JH PLAN set the conditions that accept them (the lead's message, L21), and a test pins the first so a later
  change undoes it on purpose. Whether to refuse an unknown command deliberately is a new check, for the lead.
- Codex's last recheck left its P2 on that pinned pass open (incorrect at 0.97); answered, not changed, and its third
  review not run (L23).
- T5 closed, not stale: question 138 answered "Sí, 15 s", built by JH 119 (`bin/lib/hook-entries.mjs:129`) (L12).
- The Codex review over its allowance (estimate about 360,000 input tokens against 300,000) was put to the lead as
  question 344; the lead withdrew it and said to run it: review is not the owner's to decide (CLAUDE.md), and Codex
  read 28% of its 5-hour window (the lead's note, 15:25).

## Failures and lessons
- The first commit carried a `Co-Authored-By` line against his global instructions; its gate was stopped before the
  commit landed and the commit made again without it.
- Two scratch scripts failed on `\x` escapes in JS strings; `String.raw` was used instead.
- A scripted doc edit by string match threw on a line it did not find and wrote nothing; the Edit tool was used.
- The first fix (`exit 0`) was too wide twice and its next fix once: Codex and the lenses found three ways a block
  could pass unchecked or a sibling lose its answer. Each was found by a review, not by this session's own tests;
  each now has a real test.
- A Node heredoc turned `\r` in a PowerShell regex into a raw carriage return; a script file with `String.raw` fixed it.
- I asked the owner, through the lead, about a review's cost although review is not his to decide.
- The first ready notice called one dropped class "accepted as the change's intent" against the brief's "keeps every
  refusal"; JH PLAN found three more, and the lead made the PR a draft until they were listed, pinned and verified.
- The host compacted this session at 18:53 local; it resumed from this document and the feature document.
- The helpers added in a fix were functions the script's own `Get-Command` could find; the advisor found it before the
  ready notice, not a review. The test now holds a block that names one.
- The first test of the shadowed name relied on PowerShellGet's `Find-Command`; Codex found it would fail on a machine
  without that module. The test now defines its own.

## Left
- For the lead, not built (L13, L14): the parser started beside the other checks (`bin/reply.mjs`); whether the 4 s
  `COMMANDS_DEADLINE_MS` should follow the 15 s timeout (the verifier saw one of three back-to-back parses time out at
  4851 ms); older parameter-check defects (`Get-Date -?` refused, `Get-Date -F*` passed, `* -x` checked against an
  unrelated command); from the second verifier (L20): an empty text shifts later indices, `Remove-Item -re[ x` and
  `Get-AppPackage -Name x -zz` (PowerShell 7) pass, and an `own` block whose last command is a typo now passes, as
  it always did when that command was not last.

## Cost
- Reviews: Codex eight runs (627,015, 168,678, 510,998, 108,532, 387,563, 74,979, 1,065,496 against an estimate of
  140,000, and 172,287 input tokens); the Claude lenses eight runs (about 7,000 to 10,700 input tokens a lens).
  Independent verifiers: over the first fix (about 90,000 tokens, 22 min), over the final code against the base (about
  120,000 tokens, 18 min), and again through `commandRefusals` for condition 3 (L22).
- Gate runs: eleven commit gates green, from 9a47edbf to the last docs commit; one more was stopped while it waited on
  another session's gate, and made again.
- Time: the first commit at 15:14 and the last code commit at 16:35 local (2026-11-18, `git log --date`); the first
  notice was question 344 and the last the closed notice. The context share at the end was over the window (the host's
  pause notice said 157%).

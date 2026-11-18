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
- The pull request: named in the ready notice.

## Decisions
- No cut to the parser: its time is PowerShell's start (494–1423 ms of a check, the script itself 228–537 ms), no start
  option beats the load's noise, and Windows PowerShell first would change verdicts (`&&`) (this session, L13).
- T5 closed, not stale: question 138 answered "Sí, 15 s", built by JH 119 (`bin/lib/hook-entries.mjs:129`) (L12).
- The Codex review over its allowance (estimate about 360,000 input tokens against 300,000) asked of the owner through
  the lead as question 344, not run before his answer (this session, as the plan's rule says).

## Failures and lessons
- The first commit carried a `Co-Authored-By` line against his global instructions; its gate was stopped before the
  commit landed and the commit made again without it.
- Two scratch scripts failed on `\x` escapes in JS strings; `String.raw` was used instead.
- A scripted doc edit by string match threw on a line it did not find and wrote nothing; the Edit tool was used.

## Left
- For the lead, not built (L13, L14): the parser started beside the other checks (`bin/reply.mjs`); whether the 4 s
  `COMMANDS_DEADLINE_MS` should follow the 15 s timeout (the verifier saw one of three back-to-back parses time out at
  4851 ms); older parameter-check defects (`Get-Date -?` refused, `Get-Date -F*` passed, `* -x` checked against an
  unrelated command).

## Cost
- Reviews: the Claude lenses risk, resilience, reliability over b044dbf..0168e1e, 0 findings (about 7,900 input tokens
  each); Codex: see question 344. One independent verifier (about 90,000 tokens, 22 min).
- Gate runs: two commit gates green (one stopped while it waited on another session's gate and made again).

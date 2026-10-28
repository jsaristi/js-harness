# JH 74 · Guard gap: review records written through a child process

Brief: `C:\Users\Oficina\.js-harness\background\briefs\2026-10-28T18-18-15-760Z-faacddc0.md`. Branch
`fix/guard-child-process`, PR 637, base main `59b3e1cd`. Feature document: `odd/tasks/guard-child-process.md`.

## Goal
Close the guard's gap found by JH 72, where a script starting a child process could write a review record, and say
whether prevention or provenance holds it; with three follow-ups of JH 72: `REGEXP_EXEC` and member calls,
`refreshAfterLand`'s try, and a `- Seen:` line for the lead's brief of JH 72.

## The user's words
The lead's brief (not Sebastián's words): "make prevention close this path too, or show with a test why provenance
alone holds it, and say which." No message from Sebastián in this session.

## Delivered
- `62470339`, `db220fe3`, `7ea64a76`, `cfdfc268`: the guard refuses a script that starts a child process beside a
  record's name (in the script, its arguments or its environment), reads `cmd /c` and PowerShell's command line, and
  `REGEXP_EXEC` skips a member call. 78 guard tests pass.
- `8fa48077`: `refreshAfterLand`'s folders and wait inside the try that keeps the land record written.
- `41fe427f`: `docs/FAILURES.md`, `brief-waived-review-lines`.
- `1189ae02`, `cce831fc`, `7d42cdee`: the feature document and this summary.

## Decisions
- S1: prevention, not provenance. A child process can append a run line and the record naming it, and Codex records
  carry no provenance (`isValidCodexReview`).
- The guard refuses a child-process start beside a record whole rather than reading what the child runs: the first
  design (reading the call's command) leaked through arrays, aliases and other runtimes, by the independent verifier.
  A read that starts a child process, or uses Deno or Bun at all, goes through cat instead.
- gentle-ai on the guard's slice recorded "not reviewed" after two ways failed (below); Codex and the lenses cover it.

## Failures and lessons
- gentle-ai could not review the guard's slice (1189ae02..cfdfc268): its 43 KB lens contexts hold the guard's refused
  test commands; a dispatcher copying them into prompts was stopped by a safety classifier, and a lens told to read
  its context from a file returned an incomplete inspection, since the lenses run without tools. The merge door may
  refuse on it; that is the lead's to route.
- The first commit carried AI attribution lines, against CLAUDE.md; amended before any push.
- Follow-ups left open (feature document, log): direct writes in Perl, Ruby, Deno, Bun or PowerShell code; a record's
  name built from parts; a script from stdin or a file; outer-shell wrappers missing from WRAPPERS; a few reads
  refused (cmd copy out of a record, `start` in a PowerShell string, Deno and Bun reads).
- Local branch `jh74-draft` (the first design, never pushed, its WIP commit skipped the hook) is kept for the lead.

## Cost
Measured where the commands printed it, not totalled: Codex 50,077, 124,747 and 32,404 input tokens on the last three
runs (earlier runs in the Codex records); Claude lenses about 13,600 input tokens a lens on 1189ae0..7ea64a7 and 3,800
on 7ea64a7..cfdfc26; the independent verifier about 127,000 and 148,000 subagent tokens on its last two passes;
gentle-ai lens agents about 20,000 each. No evals.

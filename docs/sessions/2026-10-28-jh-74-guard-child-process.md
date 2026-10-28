# JH 74 · Guard gap: review records written through a child process

Brief: `C:\Users\Oficina\.js-harness\background\briefs\2026-10-28T18-18-15-760Z-faacddc0.md`. Branch
`fix/guard-child-process`, worktree `.claude/worktrees/guard-child-process`, base main `59b3e1cd`. Feature document:
`odd/tasks/guard-child-process.md` (contract, specs, reviews, log, follow-ups).

## Bad news first
- gentle-ai did not review the guard's slice (1189ae02..cfdfc268): its 43 KB lens contexts hold the guard's test
  commands, a dispatcher copying them was stopped by a safety classifier, and a lens cannot read them from a file
  (it runs without tools). Recorded "not reviewed"; the merge door may refuse on it. Codex and the lenses cover it.
- The guard follows a child process by refusing it whole beside a record's name, not by reading what it runs: a read
  that starts one (or uses Deno or Bun at all) is refused and goes through cat instead.
- Still not followed (log, follow-ups): a direct write in Perl, Ruby, Deno, Bun or PowerShell code; a record's name
  built from parts; a script read from stdin or a file; outer-shell wrappers missing from WRAPPERS (`timeout`, `wsl`,
  `xargs`, `find -exec`, a git alias, `busybox`), which the verifier read as older than this branch, unrun.
- The session was compacted once by the host (14:21 local); the feature document held the state.

## Done
- `1189ae02` the feature document.
- `62470339` S1 and S2: the guard refuses a script that starts a child process beside a record (in the script, its
  arguments or its environment), reads `cmd /c` and PowerShell's command line, and REGEXP_EXEC skips a member call.
  S1's answer: prevention, not provenance (a child can append a run line and the record naming it; Codex records have
  no provenance).
- `8fa48077` S3: `refreshAfterLand`'s folders and wait inside the try that keeps the land record written.
- `41fe427f` S4: `docs/FAILURES.md`, `brief-waived-review-lines`, its Seen line.
- `db220fe3`, `7ea64a76`, `cfdfc268`: the independent verifier's second and third passes and Codex's two P2.

## Checked
- `node --test bin/lib/guard.test.mjs bin/guard.test.mjs`: 78 pass, 0 fail. `npm run check` PASS before each commit.
- Independent verifier: three passes (d91e379f's design replaced, 62470339, db220fe3); each finding fixed with a test.
- Codex: 6247033..41fe427 correct 0.98; 1189ae0..7ea64a7 incorrect (two P2, fixed); 7ea64a7..cfdfc26 correct 0.98.
- Claude lenses: 0 findings on 62470339..8fa48077, 1189ae0..7ea64a7 and 7ea64a7..cfdfc26.
- gentle-ai: slice B approved and acknowledged (review-b2834bc1391b9caf); the guard's slice not reviewed (above).

## Left
- Local branch `jh74-draft` (the first design, never pushed) and the review worktrees under
  `D:\js-harness-worktrees\jh74-*` until the lead says otherwise.

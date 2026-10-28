## Goal
The guard refuses a review record written through a child process a script starts, and three follow-ups of JH 72
close: a member call's `.RegExp(…).exec(` is no RegExp's, `refreshAfterLand` keeps the land record written whatever
its wait does, and the lead's mistake of 2026-10-28 is in the failures register.

## Why
A shell one-liner like `node -e "require('child_process').exec('echo x >> <review record>')"` passed the guard (JH 72),
so a session could write a review record by hand. Provenance does not hold it: a Codex record names no run line a check
asks for (`isValidCodexReview`, bin/lib/codex-reviews.mjs), and a lens record is refused only when it names no run line,
while a child process can write a run line and its record both (bin/lib/lens-reviews.mjs, its header's last paragraph).
So prevention, the guard, must close the path.

## Done when
- `node --test bin/lib/guard.test.mjs` exits 0
- `node --test bin/guard.test.mjs` exits 0
- `node --test bin/lib/merge-queue-refresh.test.mjs` exits 0
- `node --test bin/merge-queue.test.mjs` exits 0
- `js-harness failures check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/guard-child-process.md` exits 0
- every code commit of `main..fix/guard-child-process` is named on a gentle-ai line below, and
  `js-harness notify --to orchestrator --kind ready --pr <n>` records the notice

## In scope / Out of scope
- In: bin/guard.mjs, bin/lib/guard.mjs, bin/lib/merge-queue-refresh.mjs (`refreshAfterLand` only), their tests,
  docs/FAILURES.md (the one occurrence), docs/sessions/, this document.
- Out: bin/lib/lens-reviews.mjs and bin/lib/codex-reviews.mjs (provenance needs no change: the guard closes the path);
  JH 68's and JH 73's files; credentials, ~/.claude, ~/.codex, gentle-ai config; the installed copy (the lead refreshes
  it).

## Constraints
- No evals, no spend beyond the reviews — the brief's words.
- The guard is high-risk item 2: tests first, then one independent verifier after the change's own checks.
- No whole-branch gentle-ai review — CLAUDE.md.

## Ask me before
- Nothing beyond the brief: the lead decides scope; Sebastián decides spend.

## Specs
1. "a shell one-liner like `node -e \"require('child_process').exec('echo x >> <review record>')\"` passes the guard. A
   model could write a lens or codex review record that way. PR 630 made provenance refuse a hand-written lens record
   without its run line, so check what that already stops. Then make prevention close this path too, or show with a test
   why provenance alone holds it, and say which."
2. "`REGEXP_EXEC` must not match a member call (`obj.RegExp('…').exec(`): a lookbehind for `.`, `$` and a word
   character (D, R2)."
3. "`refreshAfterLand` runs `projectRoots` and the wait outside the try that keeps the land record written (B)."
4. "Add one line to docs/FAILURES.md, a `- Seen:` entry for the lead's mistake of 2026-10-28" (the brief for JH 72 said
   "no feature document needed").

## Tasks
- [x] T1 (docs) this document — all; inline; 1189ae02.
- [x] T2 (build) the guard refuses a script that starts a child process beside a record, and reads the interpreter's
  other words — S1, S2; test first; inline; 62470339, then the verifier's second pass in db220fe3.
- [x] T3 (build) `refreshAfterLand`'s roots and wait inside the try — S3; test first; inline; 8fa48077.
- [x] T4 (docs) the failures register's occurrence — S4; inline; 41fe427f (a new entry, `brief-waived-review-lines`:
  no existing entry fit).
- [ ] T5 (verify) the change's own checks, one independent verifier on T2, Codex, the Claude lenses and gentle-ai on each
  code slice; `notify --kind ready --pr <n>`, then `closed`.

## Answer to S1
Prevention, not provenance. What provenance already stops: a lens record appended with no run line of its own range and
subject hash covers nothing (`admittedLensReviews`, bin/lib/lens-reviews.mjs). What it does not: a child process that
appends a run line and then the record naming it (two `echo >>`), and any Codex record, which a check takes on its shape
alone (`isValidCodexReview`). So the guard closes the path (T2).

## Reviews
- gentle-ai: 8fa48077 (slice 62470339..8fa48077, refreshAfterLand), lineage review-b2834bc1391b9caf, medium, lenses
  review-resilience and review-reliability, 0 findings, approved and acknowledged.
- Codex 6247033..41fe427: correct, 0.98. Claude lenses resilience, reliability 62470339..8fa48077: 0 findings.

## Next step
The guard's slice (1189ae02..62470339, and db220fe3): the verifier's third pass, then Codex, the Claude lenses and
gentle-ai (escalated, item 2) on it; then the PR, `notify --kind ready --pr <n>`, the session summary and `closed`.

## Log
- L1 The brief, 2026-10-28T18:18Z: `C:\Users\Oficina\.js-harness\background\briefs\2026-10-28T18-18-15-760Z-faacddc0.md`.
- L2 The independent verifier on the first design (d91e379f, which read the command a child-process call is handed)
  found over-refusals (a regex's `.exec(var)`, `re.compile(r'…')`, `[].slice.call`) and bypasses (`shell: true` with
  an array, names in brackets, Perl and Ruby backticks, Deno and Bun, asyncio, Start-Process, cmd's copy and del).
  Decision: refuse a script that starts a child process beside a record whole, whatever the child runs; a read goes
  through cat. The branch was rebuilt on 1189ae02 with that design (62470339); the draft stays on local branch
  `jh74-draft`, never pushed, whose WIP commit skipped the hook. Slice B's first reviews (d91e379..aaa5873, lineage
  review-f27e6a56751c9879) were superseded by the rebuild and repeated above.
- L3 The verifier's second pass on 62470339: seven bypasses by import, alias or destructuring and Perl's readpipe, and
  two reads refused (Ruby's `|f|`, Perl's `|| die`). Fixed in db220fe3: Python's os, Deno and Bun are refused
  whole beside a record, and a pipe open is read by its mode string. A Perl two-argument `open(F, "<record>")` stays
  refused by the guard's existing write rule, not by this one.
- L4 The verifier's third pass on db220fe3: all twenty second-pass bypasses refused and its over-refusals passed; two
  blocking: Python reads through `os.path` refused, and `import nt` (Windows' posix) passed. Fixed in the next commit:
  os is refused by its process functions or under another name, and nt, _winapi, `process['binding']`,
  NewScriptBlock and PowerShell's COM objects are refused.
- Follow-ups, not done here: a direct write in Perl, Ruby, Deno, Bun or PowerShell code is not followed (only a child
  process is); a record's name built from parts; a script read from stdin or a file; a cmd copy out of a record, and
  `findstr move`, refused as a write; `start` in a PowerShell string, a Ruby `"|"` string after `File.open`, Perl's
  `printf("%x", …)` and every Deno or Bun read refused; outer-shell wrappers not in the guard's WRAPPERS (`timeout`,
  `wsl`, `xargs`, `find -exec`, `git -c alias.x='!sh …'`, `busybox`), which predate this branch by the verifier's
  reading, unrun; Python's third-party `sh` package; cmd's `fsutil`; PowerShell's `& (Get-Command cmd)`.

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
- [ ] T1 (docs) this document — all; inline.
- [ ] T2 (build) the guard reads a command a script hands a child process, and the interpreter's other words — S1, S2;
  test first; inline.
- [ ] T3 (build) `refreshAfterLand`'s roots and wait inside the try — S3; test first; inline.
- [ ] T4 (docs) the failures register's occurrence — S4; inline.
- [ ] T5 (verify) the change's own checks, one independent verifier on T2, Codex, the Claude lenses and gentle-ai on each
  code slice; `notify --kind ready --pr <n>`, then `closed`.

## Answer to S1
Prevention, not provenance. What provenance already stops: a lens record appended with no run line of its own range and
subject hash covers nothing (`admittedLensReviews`, bin/lib/lens-reviews.mjs). What it does not: a child process that
appends a run line and then the record naming it (two `echo >>`), and any Codex record, which a check takes on its shape
alone (`isValidCodexReview`). So the guard closes the path (T2).

## Reviews

## Log
- L1 The brief, 2026-10-28T18:18Z: `C:\Users\Oficina\.js-harness\background\briefs\2026-10-28T18-18-15-760Z-faacddc0.md`.

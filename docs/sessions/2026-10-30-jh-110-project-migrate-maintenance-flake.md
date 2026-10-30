# JH 110 · flake: project-migrate test reads git's background maintenance

## Goal
Opened from the lead's brief `briefs/2026-10-30T19-40-43-670Z-38267f38.md` (main at `4c3e1704`): fix at its cause,
test first, the merge-queue failure of run 41116514048 (candidate 579e918, PR 714) in
`bin/lib/project-migrate.test.mjs`, "a CLAUDE.md deleted and not committed is refused", whose tree snapshot held
`.git/objects/f1/0b857d...` and `.git/objects/maintenance.lock` that git's automatic maintenance wrote while it ran.

## The user's words
"Your brief is in C:\Users\Oficina\.js-harness\background\briefs\2026-10-30T19-40-43-670Z-38267f38.md: read it whole
before anything else, and do the work it gives you. Its last section says how you report." (this session's first
user message).

## Delivered
- `312657af` test(project-migrate): the file's global git config (`GIT_CONFIG_GLOBAL`, written in `before`) now sets
  `maintenance.auto = false` and `gc.auto = 0`, as `bin/check.test.mjs` does. The new test "a commit in a project
  these tests make starts no git maintenance" traces a commit with `GIT_TRACE=1`: red first (the trace held
  `git maintenance run --auto --quiet --detach`, git 2.54.0.windows.1), then green.
- `docs/FAILURES.md`: entry `project-migrate-maintenance-flake`, with its Seen and Control lines.
- `node --test bin/lib/project-migrate.test.mjs`: 20 runs in a row on this machine, 20 passed (31 pass, 0 fail,
  33 tests each; the 20th run's output holds no `maintenance run`).
- PR on branch `worktree-fix-migrate-flake`; ready notice sent with its number.

## Decisions
- Maintenance off rather than a snapshot that ignores `.git`: migrate writes inside `.git` (its manifest at
  `rev-parse --git-path js-harness/manifest.json`, `bin/lib/project.mjs:1962`, and the exclude line,
  `bin/lib/project.mjs:356`), so the comparison of `.git` is part of what "migrate writes nothing" proves. The
  `tree` helper's header said "but git's own" while it walked `.git`; it now says "git's own included".
- Fixed in this file, not in the shared helper: `bin/lib/git-fixture.testkit.mjs` (found with codegraph) serves
  repositories copied from a template, and this file inits its own. Other test files that set `GIT_CONFIG_GLOBAL`
  without maintenance off and walk or copy a tree (`withFileTypes`, `cpSync`): `bin/update.test.mjs` never commits
  in the projects it snapshots, and `bin/lib/project.test.mjs` skips `.git`. No other file shares the exposure.
- Not quarantined in `docs/FLAKY.md`: the fix could be made.

## Failures and lessons
- The worktree guard refused a `for` loop over `grep -L` results and a `--reason` text with a colon and an
  apostrophe; plain commands and a simpler reason ran.

- The brief said the actual snapshot held the object and the lock that the expected one did not. The log
  (`gh run view 41116514048 --log-failed`, the assertion under "+ actual - expected") marks only
  `.git/objects/maintenance.lock` with `-`: it was in the tree before migrate and gone after, and `f1/0b857d...` was
  in both. Same cause (a detached maintenance holding its lock), so the fix stands; `docs/FAILURES.md` says it this way.

## Left
- Nothing of this brief.

## Cost
- Time: brief at 19:40Z, this summary shortly after.
- Reviews: Codex once over `4c3e170..312657a`, 58,448 input tokens, correct (0.97), no findings. The Claude lens
  reliability once, 0 findings (4,555 input tokens). gentle-ai: not run.
- Gates: one pre-commit run of `npm run check`, PASS. Twenty runs of the test file.

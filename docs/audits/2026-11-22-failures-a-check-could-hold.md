# Failures a check could hold (2026-11-22)

JH 302's list, for Codex day, of the `docs/FAILURES.md` entries that had no control on 2026-11-22 (origin/main
a8bf5f68) and that a command of this repository could catch. Its companion,
`docs/audits/2026-11-22-failures-without-a-check.md`, holds the entries no check can hold. Each section names the
check, the file it goes in, the test that would prove it, and the open pull request that edits that file, if any,
so the build waits for it. None of these is built: each is code, and code lands only after Codex's review. When one
lands, its entry takes a `check` control naming the test, and this list stays as it was.

Not here: the eight entries an open pull request already edits (`gate-pass-on-other-node` 989,
`land-took-pending-pr` and `reopen-tested-old-base` 992, `linux-probe-misnames-process` and
`ports-test-free-port-race` 983, `quiet-misses-background-work` 985, `spend-past-approved` 951 and 953,
`test-skipped-here-never-run` 986), `away-hours-no-work` (pull request 996 adds a sighting), and the six that pull
request 999 controls. The proposed test names are drafts; the builder writes the final ones.

## The guard: bin/guard.mjs, bin/lib/guard.mjs, bin/lib/worktrees.mjs
`bin/guard.mjs` is in open pull requests 945, 950 and 951; these wait for them.

- `sub-agents-inherited-model`: refuse an Agent call that names no model in a session whose model is the scarce one
  (`rule:session-model` names it); the relief line's candidate. Test in `bin/guard.test.mjs`: "a sub-agent with no
  model is refused in a session on the scarce model, and passes on any other".
- `write-in-session-worktree`: refuse a git command that writes (`add`, `commit`, `checkout`, `reset`, `stash`,
  `apply`) with `-C` or a `cd` into a worktree another live session owns, as `cd` alone is refused today
  (`bin/lib/worktrees.mjs`). Test in `bin/guard.test.mjs`: "a git write with -C into another live session's
  worktree is refused; a read (diff, log, status) passes".
- `app-moved-session-folder`: a worktree whose owner session has ended is not refused as "another session's" to the
  session the app now runs in it (JH 241's case: JH 236 had ended). Test in `bin/lib/worktrees.test.mjs`: "a
  worktree whose last session has ended is not another session's". The app's move itself stays unseen.
- `stash-path-reverted-file`: name, before it runs, that `git stash push -- <path>` takes those paths' changes out
  of the working tree, and point to a WIP commit; the host's own note prefers one. Test in `bin/guard.test.mjs`: "a
  stash push with a pathspec is refused, naming the paths it would revert and the WIP commit".

## Rule changes: bin/lib/rules-change-run.mjs
- `rule-branch-held-unpushed`: the refusal at `bin/lib/rules-change-run.mjs:225` names the branch that holds the
  open change but not whether it is pushed or whose session holds it; a `doctor` or `sessions` row could list an
  unpushed `rule/` branch older than a few hours, with its session. Test in `bin/lib/rules-change-run.test.mjs`: "the
  refusal says whether the holding branch is pushed and names the session whose worktree holds it".

## Copies and the update round: bin/lib/merge-queue-waits.mjs, bin/lib/update-round.mjs, bin/lib/clean.mjs
- `refresh-kills-wait`: `merge-queue --refresh-copy` stops waits and tells their sessions
  (`bin/lib/merge-queue-waits.mjs`, since 2026-10-29), yet on 2026-11-21 two waits died with exit 127 and nothing
  said so. The entry names JH 284's fix in `bin/` (the lead's notes, brief-refresh-waits.md); no merged pull request
  holds it (searched: `git log origin/main --grep` for 127, refresh-kills and JH 284, and `gh pr list --search`).
  Test in `bin/lib/merge-queue-waits.test.mjs`: "a wait the refresh replaced under is named to its session, and its
  exit 127 is never silent".
- `node-switch-shims-shadowed`: the update round compares the two node folders' contents, names left in the old one
  included, before a switch; the entry's own check candidate. `bin/lib/update-round.mjs` is in open pull request 940.
  Test in `bin/lib/update-round.test.mjs`: "a file in the old node folder that the new one lacks and that shadows a
  tool on PATH is named before the switch".
- `pnpm-cleanup-deleted-link-targets`: a cleanup resolves every link under pnpm's global folder and keeps each
  target. `clean` (`bin/lib/clean.mjs`, in open pull request 964) reaches pnpm only through `pnpm store prune`
  (`bin/lib/clean.mjs:210`) and deletes none of pnpm's global install folders by hand; the check is needed only
  once a command does. Test in `bin/lib/clean.test.mjs`: "a folder a live
  link points to is never offered for deletion".
- `installed-copy-stale`: the land guard already refuses a copy whose `bin/` differs from main's
  (`bin/merge-queue.test.mjs`, "the land guard refuses a stale bin/ module the running copy holds", reading
  `bin/lib/merge-queue-stale-bin.mjs`), but only for a land. A `doctor` row could read the same blob ids for every
  session. Test in `bin/doctor.test.mjs`: "a copy whose bin/ differs from origin/main is reported stale, naming the
  paths". `bin/doctor.mjs` is in open pull requests 963 and 966.

## Sessions, resume and stretches: bin/lib/sessions.mjs, bin/resume.mjs, bin/lib/stretch.mjs
- `push-check-read-as-gate`: the board's "gate started ... while another runs" (`bin/lib/sessions.mjs:2543`) is
  written for any gate it watches. Whether `check --push`, which runs rule rows only, is still counted as a gate is
  not checked here. Test in `bin/lib/sessions.test.mjs`: "a pre-push check is not reported as a second gate".
- `resume-names-wrong-maker`: the hook says "The host compacted this session by itself" whenever the boundary is
  not yet in the transcript (`bin/resume.mjs`); it could say it cannot tell who compacted. `bin/resume.mjs` is in
  open pull request 968. Test in `bin/resume.test.mjs`: "with no boundary in the transcript yet, the text does not
  name who compacted".
- `stretch-goal-met-at-open`: opening a stretch runs its goal command once and refuses to open when the goal
  already holds. `bin/lib/stretch.mjs` is in open pull requests 955 and 982. Test in `bin/stretch.test.mjs`: "a
  stretch whose goal already holds at the opening is refused, naming the goal".
- `verifier-before-last-fix`: a ready notice for a change that names a high-risk item is refused when the
  verifier's range does not end at the pull request's head; the entry already names that proof. Test in
  `bin/notify.test.mjs`: "a ready notice whose verifier range ends before the head is refused".

## Reviews and the gate: bin/codex-review.mjs, bin/lib/ci-gate.mjs, bin/lib/project.mjs
- `codex-model-at-capacity`: a review that ends with "Selected model is at capacity" is recorded as an incomplete run
  that names the cause and the tokens read, so it is neither lost nor counted. No such handling was found in
  `bin/codex-review.mjs` (searched: grep for "capacity"). Test in `bin/codex-review.test.mjs`: "a run that ends at
  capacity is recorded incomplete, naming it".
- `probe-end-hook-flake`: the gate names a test file that failed as a whole with no test red as a file failure,
  apart from the failing tests, so a flake of a file's end hook is told from a real one. Test in
  `bin/lib/ci-gate.test.mjs`: "a file that fails with no failing test is named as a file failure".
  Measured after this audit (JH 302, 2026-11-22), so no check is built: on 2026-11-22, under node 26.13.1, a
  file whose end hook throws is already named by its path as a failing test, and the flaky rerun reruns it. A
  scratch file with one passing test and an `after()` that throws, run with `node --test`, prints under
  `✖ failing tests:` a `test at a.test.mjs:3:1` line, then `✖ <absolute path of the file>` and the hook's error.
  `failingTests` (`bin/lib/flaky.mjs:220`), which the gate log keeps, returns that path as the failing test's name;
  `failedTestFiles` (`bin/lib/flaky.mjs:20`) returns `a.test.mjs`, the file the flaky rerun runs again; and
  `failedLog` (`bin/lib/ci-gate.mjs:52`) prints a CI log from that summary. The sighting of 2026-10-13 named the
  file too, with no test of it red; the node version of that run is not known.
- `short-name-judged-outside`: `isWithinBase` (`bin/lib/project.mjs:203`) folds case but not Windows 8.3 short
  names; resolving both paths with `fs.realpathSync.native` first would. It waits for the split planned in
  `odd/tasks/project-split.md`. Test in `bin/lib/project.test.mjs`: "a path spelled with a short name is within
  the base its long name is in" (Windows only, with its platform reason).
- `temp-folders-left`: open pull requests 971 and 972 (a temp-dir testkit and a convention test) hold test folders
  to one cleanup; when they land, this entry takes their test as its control.

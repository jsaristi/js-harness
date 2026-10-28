## Goal
Close the open items of the Session board phase and the follow-ups JH 72 left (JH 77), each behavior change
test-first, and land them through the merge door with Codex, the Claude lenses and gentle-ai on every code commit.

## Why
The board ends with exit 1 before it reads the background sessions when the main checkout has no transcripts folder;
a start whose record cannot be appended and whose rollback claude refuses leaves nothing `stop` or uninstall can act
on; `--address` answers "none" past record lines it skipped; `stop` says a worktree claude never made "is gone".

## Done when
- `node --test bin/sessions.test.mjs` exits 0
- `node --test bin/sessions-background.test.mjs` exits 0
- `node --test bin/lib/background.test.mjs` exits 0
- `node --test bin/lib/guard.test.mjs bin/lib/merge-queue-refresh.test.mjs` exits 0
- `node --test bin/conventions-structure.test.mjs` exits 0
- every code commit of `main..fix/board-follow-ups-2` is named on a gentle-ai line below, and
  `js-harness notify --to orchestrator --kind ready --pr <n>` records the notice

## In scope / Out of scope
- In: bin/sessions*.mjs, bin/lib/sessions*.mjs, bin/lib/background*.mjs, bin/lib/merge-queue*.mjs, bin/merge-queue*.mjs,
  bin/lib/guard*.mjs (REGEXP_EXEC only), their tests, docs/ROADMAP.md (the Session board lines), docs/sessions/, this
  document.
- Out: bin/lib/refresh-copy.mjs and bin/uninstall*.mjs (read only, reported), JH 68's files, credentials, ~/.claude,
  ~/.codex, gentle-ai config, the installed copy (the lead refreshes it), sessions other than this one.

## Constraints
- No evals, no spend beyond the reviews — the brief's words.
- `bin/sessions.mjs` is at its 1,008-line ceiling (bin/conventions-structure.test.mjs): what it gains it loses.
- The record and stop paths are delivery and state: one independent verifier reads the change after its own checks.

## Ask me before
- Nothing beyond the brief: the lead decides scope; Sebastián decides spend.

## Specs
1. "Roadmap line 210, the stretch protocol: its contract (odd/tasks/stretch-protocol.md) passes `contract check` on
   main, and PRs 633-635 built it. Check that its goals hold, then tick the box in your PR."
2. "the board must list background sessions even when the main checkout has no transcripts folder. Today the board
   ends with exit 1 before it reads them."
3. "when a start ran claude but its record cannot be appended, and claude refuses the rollback, leave a durable entry
   that `sessions stop` and uninstall can act on."
4. "`--address` should answer "not known" for skipped record lines (R3-002); `sessions stop` says "is gone" for a
   worktree claude never made (R3-004); `refreshAfterLand` runs `projectRoots` and the wait outside the try (B);
   REGEXP_EXEC matches a member call (D, R2). Take the rest only if they are cheap, and say which you left."
5. "`sessions stop 76a92c61` got EBUSY removing a worktree that a codegraph process may hold open. Read whether stop
   can name the process holding it." "The copy refresh got pnpm "os error 32" twice while removing an old replaced
   global dir; the install itself succeeded. Read whether `merge-queue --refresh-copy` reports that case as a success
   with a note, after verifying the pin. Do not run a refresh: the lead does."

## Tasks
- [ ] T1 (verify) S1: the stretch protocol's goals, checked; the box ticked only if all hold.
- [ ] T2 (build) S2: the board with no sessions folder lists the recorded background sessions. Route: inline.
- [ ] T3 (build) S3: a start or resume whose record line cannot be appended leaves a stranded entry file. Route: inline.
- [ ] T4 (build) S4: `--address` not known past skipped lines; `stop` names a worktree that was never there. Route: inline.
- [ ] T5 (verify) S4: refreshAfterLand and REGEXP_EXEC, already fixed on main, checked.
- [ ] T6 (verify) S5: the two readings, written below.
- [ ] T7 (verify) the verifier, Codex, the lenses and gentle-ai per slice; push, PR, `notify --kind ready`.

## Reviews

## Log
- L1 The brief, 2026-10-28T22:33Z: `C:\Users\Oficina\.js-harness\background\briefs\2026-10-28T22-33-50-006Z-6322ae93.md`.
- L2 T1, at 62315e61: `js-harness contract check odd/tasks/stretch-protocol.md` PASS; `node --test bin/stretch.test.mjs
  bin/lib/stretch.test.mjs bin/lib/stretch-render.test.mjs bin/sessions-live.test.mjs` 53 of 53; `stretch --help` exit 0;
  `rules away-autonomy` quotes 2026-10-28 five times. Not held: its fifth goal, "A stretch opened, checked and closed on
  this machine over a real stretch" (and its T7, unticked): `js-harness stretch status` says "no stretch is open" and
  no `stretches.jsonl` exists under `~/.js-harness/throughput/` (`find ~/.js-harness -name 'stretches*'`, nothing).
  So the roadmap box stays open; it closes when the lead opens and closes one real stretch.
- L3 T5: both already on main with their tests. `refreshAfterLand` runs `projectRoots` and the wait inside the try
  since 2e51fff7 (bin/lib/merge-queue-refresh.mjs:83-91, the test at bin/lib/merge-queue-refresh.test.mjs:73);
  `REGEXP_EXEC` has the lookbehind `(?<![\w$]|\.\s*)` since 62470339 (bin/lib/guard.mjs:770, the member-call cases at
  bin/lib/guard.test.mjs:739-741).
- L4 T6, 5a (EBUSY on stop): the removal of the worktree is `claude rm`'s, and its words reach the user whole as
  `kept: claude rm <id>: ...`. Naming the holder is not cheap: Windows lists no handle holders without the Restart
  Manager API (a C# P/Invoke compiled by PowerShell at each run) or Sysinternals `handle.exe`, which is not installed.
  A match on command lines misses it: the five `codegraph serve --mcp` processes running now name no folder; their
  project is their working folder, which Win32_Process does not give (one watchdog names `D:\js-harness\.codegraph`).
  Left for the lead: a hint on EBUSY that a session's codegraph in that worktree is the usual holder, or the Restart
  Manager route.
- L5 T6, 5b (pnpm "os error 32"): bin/lib/refresh-copy.mjs:314-329 already judges the install by the pin, not by
  pnpm's exit: it breaks on `--version` equal to main's and the shim naming main's sha, and the refresh exits 0. What
  it says is wrong: `installCopy` (bin/update.mjs:467) is `ok` when the PATH copy answers the version, which a land
  with no version bump always does, so pnpm's error is then not said at all; with a bump it is printed as
  `refresh failed: pnpm exited 1: ...` (line 322) above a refresh that succeeds. The fix, a note "pnpm exited N, and the
  copy is verified" in place of those lines, is in bin/lib/refresh-copy.mjs and bin/update.mjs, outside this brief's
  surfaces: left for the lead.

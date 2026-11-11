# JH 166 · audit unit 3: the heartbeat's ticks

## Goal
Work unit 3 of the audit triage (finding M37 of the Fable 5.2 audit): say from the records why the throughput
snapshots stop on 2026-11-02, and build `node workshop/js-harness-workshop.mjs ticks --hook` with its stale-ticks
row, run by this repository at each session start. Opened by the brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-11-10T06-31-36-662Z-8f2df985.md` (channel notice of
2026-11-10T06:31:37.325Z, `sessions start`); resumed three times after the machine restarted, by the briefs
`2026-11-10T07-41-47-736Z-f757194d.md`, `2026-11-11T04-55-57-700Z-fc5c0f6a.md` and
`2026-11-11T08-31-47-969Z-0bdf5962.md` (pull request 815 did not land).

## The user's words
"Your brief is in C:\Users\Oficina\.js-harness\background\briefs\2026-11-10T06-31-36-662Z-8f2df985.md: read it whole
before anything else, and do the work it gives you. Its last section says how you report." (transcript
`C:\Users\Oficina\.claude\projects\D--js-harness--claude-worktrees-audit-u3-heartbeat-ticks\407bcbe4-4804-40e4-80c5-3a320e89ef58.jsonl`,
line 15; the two resumes are its lines 580 and 782). The brief's asks are quoted as specs 1 to 3 in
`odd/tasks/audit-u3-heartbeat-ticks.md`. His own word in this work is the answer to question 245, "Aceptar el hook
(recomendado)" (the lead's transcript `ea85ec35-82e1-4aa9-abe3-98bd153a50b0`, line 5903, 2026-11-11T04:22:56Z).

## Delivered
- PR 809, merged 2026-11-11T02:23:39Z (merge `440304b6`): the command. Commits `12cd9077` (feature document),
  `f1071b4d` (`workshop/bin/ticks.mjs`, its test, the dispatcher), `c1a3720e` (a relative `--home`), `45134379`.
- PR 815, open as a draft, branch `audit-u3-ticks-hook`: the hook. Commits `7c962911` (`.claude/settings.json`, the
  `workshop` cell of `HOOK_CEILINGS` in `bin/lib/hook-count.mjs`), `c6c6cbaa`, `7a343c87` (the command finds its
  dispatcher from any folder), `5900c32a` (a dispatcher that does not load is said; the folder it runs in is searched
  after the variable's), `bb04ec83` (the hook's test runs reach no network), `9c619b76` (the command runs the
  dispatcher in the folder that holds it, after the land's red test), `b2f1aa22` (main merged in), plus this file.
- Feature document `odd/tasks/audit-u3-heartbeat-ticks.md`: contract, depth pass, specs, T1 and T2 ticked, Log L1 to
  L16, T1 to T4 ticked.
- The finding (L2): the three ticks last ran at 2026-11-03T02:18Z. No heartbeat ran them from then; after the
  workshop split (PR 776, 2026-11-06) the product's `js-harness loop heartbeat` runs none, and that is what the
  lead's heartbeat ran. Two causes, one after the other.
- Measured (L4, L9, L11 to L13): through a child `node`, median 1,041 ms (2026-11-10) and 1,418 ms (2026-11-11);
  through a shell from `workshop/bin`, Git Bash median 1,836 ms, cmd 3,509 ms, PowerShell 7,514 ms, of which an
  empty PowerShell took 4,387 ms; offline 5,481 ms at most. Exit 0 and an empty stderr in every run; timeout 15 s.

## Decisions
- The hook and its ceiling (the user): question 245, answered "Aceptar el hook (recomendado)"; L8. It covers one
  `SessionStart` entry and the `workshop: { SessionStart: 1 }` cell, no other hook and no other ceiling.
- T1 lands alone and T2 waits on his word (this session, after `check`'s `hook entries` row refused the new owner);
  L5.
- Stale after 12 hours, `TICKS_STALE_HOURS` (this session): a night away is no stall; L3.
- Codex's P2 on `7c962911` is taken, not answered (the lead, note of 2026-11-11T05:14:09Z); L11. This session had
  answered it in L10 with the host's documentation.
- The command is code node runs, with no `$` (this session): `CLAUDE_PROJECT_DIR` is null in PowerShell, so node
  reads it itself, then the folder it runs in, each upwards; L11 and L12.
- Merging PR 809 (the user, question 252, "Unir 809 (recomendado)").

## Failures and lessons
- The first T1 commit's gate went red on GitHub: the conventions tests count the workshop's commands and their
  `ArgError` classes (`bin/conventions-arguments.test.mjs`, `bin/conventions-errors.test.mjs`). They now run here
  before a commit that adds a command.
- I marked PR 809 ready with `gh pr ready`, taking its draft state for gh's doing; the lead had set it. The lead put
  it back. I do not change a pull request's draft state.
- I answered Codex's P2 on `7c962911` instead of fixing it, and the push was refused: "the Codex review that ended at
  7c962911 owes a correction". The door keeps no record for an answered finding; a finding is fixed.
- The fix took three commits where the lead asked for one gate and one recheck: the reliability lens found 3
  warnings on `7a343c87` and one follow-up on `5900c32a`. A command written as code needs its failure paths (not
  found, found and not loading, the variable wrong) and a run in its real mode tested before its first review.
- `notify --kind ready --pr 815` was refused, "PR 815 is a draft": I had opened it as a draft. A ready notice needs
  a pull request that is not one.
- Pull request 815 did not land: the land's suite (gate `f7a95e59`, in WSL) failed "the hook itself, run from a
  subfolder, reads the records of this repository". A gate in WSL runs in a mirror synced without `.git`
  (`bin/lib/gate-wsl.mjs:112`); with none above it, the folder a command runs in is its own project, so the hook
  found the dispatcher above `workshop/bin` and read that folder's records. It was the hook's fault and wider: from
  outside the repository with `CLAUDE_PROJECT_DIR` set it did the same on Windows. My gates ran on GitHub, in a
  clone that holds `.git`, and never saw it. Fixed in `9c619b76`: the command moves to the folder that holds the
  dispatcher. A test with a tree of no git now holds it in every gate; the file passed 17 of 17 in a mirror made as
  the runner makes it (1 failed before). Lesson: a test that runs the real tree is run once in a mirror with no
  `.git` before its pull request, since that is where the land runs it (feature document, L15 and L16).
- Background reviews and `js-harness wait` were stopped for low memory several times on 2026-11-10; reviews ran one
  at a time from then.
- The host compacted the session on 2026-11-11T05:18Z, at about 89% of its window; the state and the design of the
  fix were in the feature document first, not yet committed.

## Left
- PR 815: its draft state and its land are the lead's. No ready notice is on record for it: the lead's note of
  2026-11-11T06:00Z says it marks the pull request ready itself when it lands it and that none is needed
  (`odd/tasks/audit-u3-heartbeat-ticks.md`, L14). After the fix of the land's red test the lead was told by a note
  (2026-11-11T09:17:20Z); the land itself has not run again as this is written.
- The snapshot of the day: it appears once the lead's heartbeat runs `node workshop/js-harness-workshop.mjs loop
  heartbeat` as the body of `js-harness loop run heartbeat`. Today the hook still says the three ticks are stale and
  no heartbeat is on record (the lead).
- Inside this checkout the product's `js-harness loop heartbeat` gives no warning that it runs no tick: outside the
  unit (the lead).

## Cost
- Time: 2026-11-10T06:31:37Z (opened) to 2026-11-11T09:17Z (the note that the land's failure is fixed), with three
  restarts of the machine and the wait for question 245 between.
- Context at the last notice: 65%, after one compaction by the host.
- Codex: T1, 193,215 and 33,311 input tokens; T2, 104,751, 35,092 (the recheck), 74,236, 89,131 and,
  for the land's red test, 66,898.
- Claude lenses: T1, 108,158 (resilience, reliability, readability) and 11,428; T2, 17,478 (risk, reliability),
  7,242, 7,707, 5,727 and 7,028 (reliability). One guide sub-agent, 61,165 tokens.
- Gate runs: one per commit through the pre-commit hook (four commits in PR 809, six in PR 815 and this file);
  the first T1 commit's went red once. One whole gate by hand on the merged tree (ba62ae4d, in WSL, 881 s, pass).
  The land's suite failed once on this pull request's test (f7a95e59).

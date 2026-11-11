# A finished background session is closed by the harness

Locator: `odd/tasks/sessions-close-themselves.md` · Branch: `worktree-sessions-close-themselves` · Delivery: one pull
request to main, reviewed slice by slice · Test runner: `node --test`

## Goal
A background session `js-harness sessions start` started, once it said `closed` and its work is in main, is closed by
the land with its worktree and its jobs, a resume leaves no job behind that it can remove safely, and every finished
session still on the machine is listed as a debt by `js-harness sessions` and `doctor` with the command that closes it.

## Why
On 2026-11-10 the owner found the Claude app listing dozens of finished background sessions, each with the model and
effort it started with, and asked why the harness had not closed them. Closing lived only in the orchestrator skill's
prose (`js-harness sessions stop <id> --remove-worktree` "once its work has landed"), was never run, and nothing listed
what was left: 359 lands landed pull requests and none removed a worktree under `.claude/worktrees` or a job.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/sessions-close-themselves.md` exits 0
- `node --test bin/lib/background-close.test.mjs bin/lib/worktrees.test.mjs bin/lib/background.test.mjs bin/sessions-background.test.mjs bin/merge-queue.test.mjs bin/doctor.test.mjs` exits 0
- `npm run check` exits 0
- the pull request is opened, named in `## Log`, with Codex and the Claude lenses recorded over each slice of its code
  and an independent verifier's verdict on what deletes in `## Log`

## In scope / Out of scope
- In: a new core module `bin/lib/background-close.mjs` with its test; `bin/lib/worktrees.mjs` (the one rule of what a
  worktree loses), `bin/lib/background.mjs` (the board's lines), `bin/sessions-background.mjs` (`sessions stop
  --finished`, the resume), `bin/merge-queue.mjs` (the land's call), `bin/doctor.mjs` (one row), their tests; the
  orchestrator skill's source (`bin/lib/manifest.mjs`), `README.md`, `docs/SPEC.md`, `docs/FAILURES.md`; this document.
- Out, each with its reason:
  - running any removal on today's sessions: the lead runs the cleanup file after the owner's yes (the brief).
  - `D:\js-harness\.claude\worktrees\f8-s2-nobackup`: the owner's to delete (the brief).
  - a session `sessions start` did not record (the app's own, another tool's): `sessions stop` stops only what it
    started, and so does this.
  - `claude rm` itself, and which job claude takes as the owner of a worktree: claude's, not this repo's.
  - a session that rests with no `closed` notice (blocked on a decision, or cut by a restart): it is not finished; the
    board already shows it waiting.

## Constraints
- A worktree is removed only by `git worktree remove` with no `--force`, and only when the rule a land already holds
  its own removals to passes (`bin/lib/worktrees.mjs`): on a branch, not locked, its head in main, `git status
  --porcelain --ignored` empty, its index unchanged for 10 minutes — because that rule is what
  `odd/tasks/land-unattended.md` (L23) and `odd/tasks/stop-keeps-worktree.md` protect: uncommitted work, ignored files
  included, is never deleted.
- One ignored file does not count against a session's worktree, `.claude/settings.local.json` — because claude writes
  it into every worktree it makes (27 of 27 measured), a copy of the checkout's local settings; with it counted the
  rule closes 0 of today's 29 sessions (Depth pass, item 4). It holds only the permissions of a session that ended.
- `claude rm` runs for a session only after its worktree is gone or holds nothing — because claude rm deleted the files
  of a worktree while it said it had refused (2026-11-04); `worktreeHolding` stays the guard. `claude stop`, which
  ends the job's process and deletes nothing, runs before the removal, and only once the worktree passed the rule
  above — because a finished job idles in its worktree and Windows deletes no folder a process stands in (L7).
- A session is finished only by its own word: the newest of its `opened`, `waiting`, `question`, `ready` and `closed`
  notices is `closed`, and no job of it is at work — because "could not look" is never "none", and a session that
  rests may be waiting on the owner.
- A land's exit never changes by what it closes or fails to close — because the landing it follows already stands
  (as `removeLandedWorktrees`).
- The board runs no git command per finished session — because the board is polled by `--watch`, and 151 stale
  worktrees once cost it 126 s (`odd/tasks/land-unattended.md`, L22); why one is kept is said by the command that
  closes.

## Ask me before
Nothing planned: the brief chose what closes, when, and what must never be weakened. A decision that turns up goes to
the lead with `js-harness notify --to orchestrator --kind waiting`.

## Depth pass
- 1. Method: operations hygiene of a job scheduler, to the standard of a garbage collector that is safe by
  construction: an owner record for every job (the record `sessions start` writes), one predicate for "finished and
  nothing to lose", a sweep that runs where the event happens (the land) and again at the next one so a miss is caught
  without a person, and a visible list of what the sweep keeps, with its reason. The removal uses git's own refusal,
  never a forced one. The smallest change: one predicate and one closing function in a new core module, called from
  three places (the land, `sessions stop --finished`, the listings). Searched first (`rule:reuse-first`):
  `removableWorktrees` (`bin/lib/worktrees.mjs:45`) holds the loss rule and is reused, its per-worktree test given a
  name; `undoSession` (`bin/lib/background.mjs:381`) stops and removes a chain of jobs and is reused unchanged;
  `worktreeHolding` (`bin/lib/background.mjs:292`) stays the guard before any claude command; `readNotices`
  (`bin/lib/channel.mjs:402`) gives the `closed` notices; `removeLandedWorktrees` (`bin/merge-queue.mjs:704`) is the
  neighbour the land's call is written like; `worktreesRow` (`bin/doctor.mjs:317`) the neighbour of the doctor row.
  No command, option or row for a finished session exists: `grep -n "finished" bin/lib/background.mjs
  bin/sessions-background.mjs bin/doctor.mjs` gives no line about a session.
- 2. Raw material: his words, the lead's transcript `ea85ec35-82e1-4aa9-abe3-98bd153a50b0` line 5421 (`js-harness
  sessions --quote`, 2026-11-11T03:44:58Z). The machine, read only at 2026-11-11 05:05Z: `~/.claude/jobs` (43 job
  folders, each `state.json`), `claude agents --json --all` (43 sessions), `~/.js-harness/background/sessions.jsonl`
  (207 lines: 124 starts, 83 removals, 41 open), the channel record `~/.js-harness/channel/D--js-harness.jsonl` (2636
  lines), `git worktree list` with `git status --porcelain --ignored` in each recorded worktree, `gh pr list --state
  all`. The lands: `D:/js-harness/.git/js-harness/lands.jsonl`, 456 records, 359 that landed, 56 worktrees removed, 0
  under `.claude/worktrees`. The code that leaves them: `bin/lib/worktrees.mjs:30` (`appsOwn`) and `:53`, written at
  T9 of `odd/tasks/land-unattended.md` on 2026-10-17, eleven days before `sessions start` existed; `:66`, the ignored
  files; `bin/sessions-background.mjs:430` (the refusal while a worktree holds files); `:353` (a resume records a new
  job and keeps the old). The lead's run of 2026-11-10 23:03 local, `stop-38.out` in its scratchpad: 5 stopped (none
  had a worktree), 33 refused. claude's own words, CLI 2.1.322: `claude rm --help` ("Delete a background session and
  its worktree"), `claude --help` on `--bg --resume`. Which job owns a worktree: `worktreePath` in the `state.json` of
  the job started with `-w`, absent from the 9 resumed jobs present.
- 3. The bar:
  spec 1: left out because it is a finding, not a behaviour: the cause and the groups are L2 to L6, each with its count.
  spec 2: `node --test bin/lib/background-close.test.mjs bin/merge-queue.test.mjs`: none, new behaviour; today 0 of 359 lands closed a session, and 7 landed sessions with a `closed` notice and a clean worktree are still here.
  spec 3: `node --test bin/sessions-background.test.mjs`: none, new behaviour; today 19 of 19 recorded resumes left the job they resumed.
  spec 4: `node --test bin/lib/background.test.mjs bin/doctor.test.mjs`: none, new behaviour; today the board and doctor print no line for a finished session (24 rest here).
  spec 5: `node --test bin/lib/background-close.test.mjs bin/lib/worktrees.test.mjs`: none, new behaviour; the tests that a worktree with a change, an untracked or an ignored file, a head outside main or a lock is kept, and that no `--force` is ever passed.
  spec 6: left out because it is a file for the lead outside the repository, checked by reading it against the survey.
  spec 7: `node bin/js-harness.mjs failures`: runs today; the entry and its `- Seen:` lines are added.
- 4. Refutation: would the rule have closed the sessions he saw, or none, as the pull request of 2026-10-31 that
  caught none of its six cases? Run now over the survey of today's 29 recorded sessions of this project
  (`node dryrun.mjs survey.json`, the scripts in the session's scratch): 5 are at work; 4 sent no `closed` notice; of
  the 20 finished, the rule closes 7 (JH 159, 162, 164, 165, 167, 168, 169: every session finished since 2026-11-09
  whose work landed), and keeps 13 for a reason that holds: 8 with ignored files that are not the host's (`.atl/`,
  `evals/runs/`, an ignored `.claude/`), 3 whose head is not in main, 2 whose folder holds only a leftover `.git`.
  With `.claude/settings.local.json` counted as a loss, the count is 0 of 20: the brief's "its tree is clean" read
  literally refutes itself, which is why the constraint above names that one file.
  Verdict: supports
- 5. Request: find, with the count of each group, why the finished background sessions are still on the machine; then
  make the land close every finished session of the project whose work is in main (its newest state notice is
  `closed`, no job of it at work, its worktree removable by the land's own rule with claude's settings copy left out),
  removing the worktree with git and the jobs with `undoSession`, the ones it landed and the ones an earlier land
  missed alike; give the same act a command, `js-harness sessions stop --finished`; have a resume remove the job it
  resumed when that job holds no worktree, and say that the others go with the close; list every finished session still
  here on the board and in a doctor row with that command; leave the lead the cleanup of today's sessions as a file;
  and record the failure. Nothing is forced, and a worktree that holds anything else stays, named with why.
  Adds: none

## Specs
1. "y entonces por que esas sesiones no se han cerrado si el harness sabe que se deben cerrar cuando terminen,
   encuentra por que esta fallando y corregir esto para que no vuelva a suceder" (the owner, 2026-11-10 22:44 local,
   the lead's transcript `ea85ec35`, line 5421)
2. "the land (or the closed notice it already reads) closes the background session of each pull request it lands once
   that session's closed notice is in the record and its tree is clean" (the lead's brief, 2026-11-10)
3. "a resume retires the job it resumed" (the brief)
4. "`js-harness sessions` and `doctor` list each finished session still on the machine as a debt, with the one command
   that closes it" (the brief)
5. "Never weaken what odd/tasks/stop-keeps-worktree.md protects: uncommitted work is never deleted, a worktree is never
   force-removed." (the brief)
6. "Leave the lead a file in your worktree's scratch (outside the repo) with the cleanup of today's 46: for each, the
   command, what it removes, and what stays (its transcript). The lead runs it after his yes; you run none of it.
   D:\js-harness\.claude\worktrees\f8-s2-nobackup is his to delete: leave it out." (the brief)
7. "Add the `- Seen:` line to docs/FAILURES.md for this failure, and, in the same documentation commit, two lines the
   lead owes: under `stretch-not-opened`, he was away 2026-11-10 18:08 to 21:17 local with question 255 on his screen
   and no stretch was opened; and the heartbeat's ticks did not run from 2026-11-02 until PR 809 made it visible." (the
   brief)

## Tasks
- [x] T1 (kind: build) specs 2, 5: the loss rule named for one worktree, the finished predicate and the closing
  function, `sessions stop --finished`; tests first · inline · `bin/lib/worktrees.mjs`, `bin/lib/background-close.mjs`,
  `bin/sessions-background.mjs` · the commit after `8cee9278` (L8)
- [ ] T2 (kind: build) specs 2, 4: the land's call, the board's lines and the doctor row; tests first · inline ·
  `bin/merge-queue.mjs`, `bin/lib/background.mjs`, `bin/sessions.mjs`, `bin/doctor.mjs`
- [ ] T3 (kind: build) spec 3: a resume removes the job it resumed when that job holds no worktree; tests first ·
  inline · `bin/sessions-background.mjs`
- [ ] T4 (kind: docs) specs 2 to 4, 7: the orchestrator skill, `README.md`, `docs/SPEC.md`, `docs/FAILURES.md` · inline
- [ ] T5 (kind: docs) spec 6: the cleanup file for the lead, outside the repository
- [ ] T6 (kind: verify) Codex and the Claude lenses on each slice, an independent verifier on what deletes, the pull
  request

## Next step
T2: the land's call after `removeLandedWorktrees` (`closeFinishedIn` with the main it pushed as `base`, the lines of
`closedLines`, its exit unchanged), the board's lines for finished sessions and the doctor row, tests first. Before it,
T1's slice goes through Codex and the lenses, base `8cee9278`. JH 175 is at work on the land and may touch
`bin/merge-queue.mjs`: tell the lead before T2 writes there. Then T3 to T6 as listed. The scratch of the survey and
the dry run is `~/.claude/jobs/b126e3c8/tmp` (`survey.json`, `dryrun.mjs`); the cleanup file of T5 goes there.

## Log
- L1 (2026-11-10 22:44 local, the owner, typed in the lead's chat; transcript `ea85ec35`, line 5421): "y entonces por
  que esas sesiones no se han cerrado si el harness sabe que se deben cerrar cuando terminen, encuentra por que esta
  fallando y corregir esto para que no vuelva a suceder". The lead's brief of 2026-11-10 (the copy
  `~/.js-harness/background/briefs/2026-11-11T04-55-23-837Z-15ae844c.md`) gives the order of the work and specs 2 to 7.
- L2 The cause, in four parts, each read at its source on 2026-11-11.
  (a) Nothing runs the close: `js-harness sessions stop` is the only thing that removes a job, and no command calls it;
  the step is one sentence of the orchestrator skill (`bin/lib/manifest.mjs:156`). The 5 the lead's run stopped on
  2026-11-10 had no worktree and had been finished for up to six days.
  (b) The land leaves the worktree by design: `appsOwn` (`bin/lib/worktrees.mjs:30`) skips everything under
  `.claude/worktrees` as "the Claude app's", which was true on 2026-10-17 and stopped being true for the worktrees
  `claude --bg -w` makes for `sessions start` (2026-10-28): claude removes one only at `claude rm`, which only `sessions
  stop` runs. In 456 land records, 56 worktrees were removed and none under `.claude/worktrees`. Its help text says so
  (`bin/merge-queue.mjs:102`); the lead read "removes the worktree of each pull request it landed" without the
  exception.
  (c) Had it looked, it would still have kept them: every worktree claude makes holds an ignored
  `.claude/settings.local.json` (27 of 27), and the rule keeps a worktree with any ignored file (`:66`).
  (d) So `sessions stop <id>` without the option refuses every session with a worktree (19 of the 33 refusals), by the
  guard of 2026-11-04, and the option that passes it was never typed.
- L3 A resume always leaves the job it resumed: 19 of 19 recorded resumes got a new id, the one after the restart of
  2026-11-10 22:13 local on CLI 2.1.322 included (35a15d81, dead, resumed as c8cd99f1), whatever `claude --help` says
  of "the same ID". The job started with `-w` owns the worktree in claude's `state.json`; the copy runs in it and owns
  none. So claude rm of the first job would delete the worktree under the copy, and that job can go only with the
  close. A job with no worktree can go at the resume.
- L4 The 43 jobs on the machine at 2026-11-11 05:05Z: 8 at work in 5 sessions (JH 166 with 3 jobs, JH 171 with 2, JH
  172, 173, 174); 30 jobs of 25 resting sessions of this project that `sessions start` recorded; 1 of this project it
  did not record (76ac01ad, JH 65); 3 of other projects (82cc1b8e of plataforma-preproyecto, recorded; 8df059ad and
  f462dfd5 in `D:\harness`, not recorded); 1 folder with no `state.json` (31278c5f). The lead counted 48 at 22:45
  local; its run of 23:03 removed 8 (the 5 it stopped, and with JH 137's last job the 3 older jobs of its chain,
  92a00e36, ae8b5fd4 and f223f51d, which is why stop then said the record named none of them), and 4 started since:
  that gives 44, one more than measured, not reconciled.
- L5 The 25 resting sessions, by why each is still here: work landed, `closed` sent, worktree clean but for claude's
  settings copy, nothing ran the close: 7 (JH 159, 162, 164, 165, 167, 168, 169; 8 jobs). Work landed, `closed` sent,
  worktree holds ignored files to look at first (`.atl/` of gentle-ai, `evals/runs/`, an ignored `.claude/`): 8 (JH
  121, 123, 124, 125, 129, 138, 158, 160; 12 jobs). `closed` sent, head not in main: 3 (JH 128, an analysis with no
  pull request; JH 163, pull request 805 open; JH 130). Folder emptied by an earlier claude rm, a leftover `.git`
  left, which claude rm now refuses on: 5 (JH 114 and 132 with `closed`; JH 134 and 137 without; JH 126, whose two
  later jobs claude no longer lists). No `closed` notice and the worktree whole: 2 (JH 127, pull request 742 merged;
  JH 155, started in a probe's folder).
- L6 Not checked: what claude rm does to a job that owns no worktree while another job runs in that folder (one
  sample, 309cf665, `odd/tasks/stop-keeps-worktree.md` L7); the design does not rest on it. Not known: the one job of
  difference in L4.
- L7 Decisions of T1 (2026-11-11). The order of a close is: the loss rule (`worktreeKept`, read only), `claude stop`
  for each job of the session claude lists, a wait of up to `LOCK_WAIT_MS` for its pid, `git worktree remove` with no
  `--force`, then `undoSession` (stop and rm). Found before the first commit: a finished job is listed `idle`, `done`
  and with a pid (JH 171 on 2026-11-11), its process stands in the worktree, and on Windows a removal begun under it
  would stop halfway; the first design removed the worktree before any claude command. A second `claude stop` on a
  stopped job is safe: the lead's run of 2026-11-10 reached `claude rm` on jobs already `stopped`. A process that
  outlives the wait, or a stop claude refuses, keeps the session whole, with `js-harness sessions stop --finished`
  named to try again. The close covers every finished session of the project, not only those of the pull requests one
  land landed: a land that comes under the 10 minutes an index must stand still would otherwise leave its own sessions
  to nobody, and the next land now takes them. An ignored folder counts as the host's only when every file in it is one
  of `HOST_FILES` (git prints `!! .claude/` for a folder whose only file is the settings copy). The same act has a
  command, `js-harness sessions stop --finished`, which takes only `--home`. A session at work, a record or a listing
  that cannot be read, and a default branch git cannot name close nothing.
- L8 T1, tests first. RED: `node --test bin/lib/background-close.test.mjs` failed on the missing module, then 12 of 12
  passed with the first order; after L7's change one test failed for the fixture's own reason (its git status, run
  with no `GIT_OPTIONAL_LOCKS=0`, rewrote the index before the second look). GREEN: `node --test
  bin/lib/background-close.test.mjs bin/lib/worktrees.test.mjs`, 16 of 16. Searched first (`rule:reuse-first`):
  codegraph for `removableWorktrees`, `undoSession`, `worktreeHolding`, `resumedChain` and `readNotices`, all reused;
  `removableWorktrees` now reads `worktreeKept`, its own per-worktree test given a name and its reasons; no second
  loss rule was written. The close is a module of its own, `bin/lib/background-close.mjs` (140 lines), because the land,
  the command and the listings all call it and it joins three records `bin/lib/background.mjs` (572 lines) does not
  read: the channel, git's worktrees and the default branch.

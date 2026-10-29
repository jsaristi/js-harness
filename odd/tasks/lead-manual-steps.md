The lead's last manual steps as commands: the installed copy refreshed while sessions hold only waits on it, and the
board's "hazme la pregunta N" read by the orchestrator skill.
Branch: feat/lead-manual-steps (from origin/main 1c6b6c2). Delivery: one PR, ready notice to the lead. Tests: `node --test`.

## Goal
`js-harness merge-queue --refresh-copy`, run alone, brings the installed copy up to origin/main while sessions hold only
waits on it: it refuses while other work runs from the copy, stops the waits, refreshes and verifies, and tells each
session whose wait it stopped to run it again; the orchestrator skill says what "hazme la pregunta N" means.

## Why
The lead refreshed the copy by hand several times a day (relief file, the lines with "COPY REFRESHED", 2026-10-28T16:27Z
to 2026-10-29T14:58Z): `merge-queue --land --refresh-copy` refreshes nothing while a session stays at work for 30
minutes after a land (JH 84, Decisions, unit 4), and a copy already behind cannot refresh through a land at all.

## Done when
- `node --test bin/lib/merge-queue-waits.test.mjs bin/lib/merge-queue-refresh.test.mjs bin/lib/refresh-copy.test.mjs` exits 0
- `node --test bin/merge-queue.test.mjs bin/lib/manifest.test.mjs` exits 0
- `npm run check` exits 0
- `js-harness merge-queue --help` names the mode `--refresh-copy` alone

## In scope / Out of scope
- In: bin/merge-queue.mjs, bin/lib/merge-queue-*.mjs (a new merge-queue-waits.mjs), bin/lib/refresh-copy.mjs and its
  test (the lead, 2026-10-29 11:09 local: "yes, bin/lib/refresh-copy.mjs and its test join your surface"),
  bin/lib/manifest.mjs (one sentence of the orchestrator skill), README.md, this document, docs/ROADMAP.md (the Review
  and release line), docs/FAILURES.md, docs/sessions/.
- Out: refreshing the real installed copy (the lead runs the new mode once it lands); bin/wait.mjs (no wait record is
  added: a wait's session is read from the transcripts, L4); the land's own 30-minute wait (unchanged; its refusal
  now names the new mode).

## Constraints
- Never stop a process that is not a wait — because JH 86 runs paid trials from the installed copy on this machine.
- A process is named by pid and creation time — because Windows reuses pids (bin/lib/process-tree.mjs).
- Tests run in a scratch home from `mktemp -d` with injected spawn, listing and kill — because a test must install and
  kill nothing real.

## Ask me before
- Nothing beyond the repository's rules.

## Next step
State at the context pause (2026-10-29, JH 88). The change is a chain of three PRs (over 400 lines):
- Slice 1, branch feat/lead-manual-steps: commit fd41d373 (S6), its gate passed. Slice 2, feat/lead-manual-steps-2:
  183b473b, gate passed. Slice 3, feat/lead-manual-steps-3: its commit started; check `git log -1` there. In slice 3:
  docs/FAILURES.md (commit-attribution-from-host), which is still uncommitted: commit it with slice 3.
- Slice 2, branch feat/lead-manual-steps-2 from slice 1 (S4, S5, S7): the untracked bin/lib/merge-queue-waits.mjs and
  its test, bin/lib/merge-queue-refresh-now.mjs, and the full versions saved in
  C:\Users\Oficina\.claude\jobs\d075e800\tmp\full\ (bin/merge-queue.mjs, bin/merge-queue.test.mjs, bin/js-harness.mjs,
  bin/lib/merge-queue-refresh.mjs and its test, README.md). Copy the full bin/lib/merge-queue-refresh.mjs, its test,
  bin/merge-queue.test.mjs and bin/js-harness.mjs over; for bin/merge-queue.mjs and README.md, re-apply only the mode
  (USAGE first line and the paragraph on --refresh-copy alone, without the backup and bin sentence slice 1 already
  says; parseArgs; the mode branch in mergeQueueMain passing answer, versionOf, pnpmBinDir; imports of refreshNowRun
  and pnpmBinDir) on slice 1's file.
- Slice 3, branch feat/lead-manual-steps-3 (S8): bin/lib/manifest.mjs and its test from the saved full versions,
  docs/ROADMAP.md from tmp\full\ROADMAP.md, docs/FAILURES.md, the summary under docs/sessions/.
- Then for each code slice: `js-harness codex-review --base <boundary>` and `js-harness lens-review --base <boundary>
  --lenses risk,reliability,resilience --reason "<why>"`; one independent verifier over the range (T5); `npm run
  check`; push; one PR each, chained; `js-harness notify --to orchestrator --kind ready --pr <n>`; the summary; the
  closed notice. No `Co-Authored-By` or session line in any commit (CLAUDE.md).
- Evidence already taken: every new test failed on main's code (a copy of origin/main's bin/ in the job's scratch
  folder with the branch's tests) and passes on the branch: merge-queue-waits 7/7, merge-queue-refresh 15/15,
  refresh-copy 22/22, merge-queue-stale-bin 3/3, the merge-queue refresh tests 17/17, the manifest question test.

## Specs
- S1. The brief (the lead, 2026-10-29 16:03Z): "Read what of "watch and lease, land and copy, archive, openings" is
  already a command (loop, permit, merge-queue --refresh-copy, sessions start/stop); write in the feature document what
  is left, and close the roadmap line when that is done."
- S2. The brief, item 1: "Refresh the installed copy while sessions hold only waits on it: stop the copy's node
  processes, which are waits (`Get-CimInstance Win32_Process` by the copy's directory), back up the pnpm global
  package.json to ~/.js-harness/refresh-backups/, clear a stale `pnpm/bin/.pnpm-global-bin.lock`, `pnpm add -g
  github:jsaristi/js-harness#<full sha>` (os error 32 on the old directory is common and the pin still lands), verify
  the pin and `git archive <sha> bin` against the copy's bin, run `js-harness install`, then tell each session whose
  wait was stopped to re-arm it. The refresh must refuse while anything other than a wait runs from the copy (an eval
  run, codex-review, lens-review, a gate)."
- S3. The brief, item 2: "The orchestrator skill (bin/lib/manifest.mjs) does not say that his "hazme la pregunta N"
  (the board's line for each open question, PR 673) means: build the card with `js-harness template ask N` and ask it
  through the question tool."
- S4. `js-harness merge-queue --refresh-copy [--cwd <checkout>]`, alone: fetches origin, takes its default branch's
  head, and exits 0 saying so when the copy already names it. Otherwise it lists the processes that run from the
  copy (a command line under pnpm's global folder that runs js-harness), leaving out its own process, its ancestors and
  its descendants. A `wait` (the dispatcher's verb, or bin/wait.mjs) and what it started is a wait; anything else
  blocks. It looks up to three times, ten seconds apart, and refuses with exit 75 naming each blocker by pid, verb and
  start when one is still there, refreshing nothing.
- S5. Under the gate lock (refreshCopy's turn) it looks once more: a blocker refuses (75); every wait, with its
  descendants, is killed by pid and creation time, and one still alive refuses (75) and names it. Then the held part
  runs as for a land. Each stopped wait is named with its session: the one open session whose transcript holds the
  same wait not ended (L4). After the refresh, whatever its exit, each work session whose wait was stopped gets one
  note in the channel naming the copy's sha, the refresh's exit and its wait's arguments to run again; every stopped
  wait is also printed with them.
- S6. The held part (every refresh, the land's too) backs up the pnpm global package.json the copy's shim names to
  `<home>/.js-harness/refresh-backups/package.json.<stamp>` (the newest five kept) before it installs, and after the
  copy is verified checks its bin/ against main's: every file `git ls-tree -r <sha> bin` names, but the tests and test
  kits the package leaves out, has the same git blob hash in the copy, and the copy has no other file there. A
  difference fails the refresh (6), naming up to five paths.
- S7. The land's refusal after its 30-minute wait names `merge-queue --refresh-copy` as the way to bring the copy up.
- S8. The orchestrator skill's question section says that "hazme la pregunta N" asks for question N: its card is
  `js-harness template ask N`, asked through the question tool.

## What of the roadmap line is already a command (S1)
Read 2026-10-29 from each command's `--help` on main 1c6b6c2:
- Watch and lease: done. `js-harness loop` runs the lead's loops under an owner record (`odd/tasks/lead-tools.md`,
  heartbeat and channel-watch bodies), `js-harness permit lease` holds the relay and `js-harness wait --notice-to
  orchestrator` renews it on each tick.
- Land and copy: the land is `js-harness merge-queue --land`. The copy was only half: `--refresh-copy` after a land
  waits 30 minutes for quiet and then refreshes nothing (JH 84). Left: S4 to S7, this feature.
- Archive: `js-harness notify --kind closed --summary <file>` holds a session's close to its pushed summary before the
  lead archives it, `js-harness sessions stop <id>` stops a background one and `js-harness merge-queue --land`
  removes a landed worktree. The archive itself is the desktop app's, with no command or file a CLI can call (none
  found: `grep -rn -i archiv bin` names only notify's and unseen's reads of it). Nothing is left that a command can do.
- Openings: done. `js-harness sessions start --title --brief` opens a background session from a brief, `notify
  --opening` stores an opening and `sessions --opening` prints it; `wake --notify` tells the sessions of a boot to
  re-read theirs.
- The stale pnpm bin lock (S2): already cleared by `installCopy` (bin/update.mjs, `clearPnpmLock`: a lock older than
  ten minutes with no pnpm running), which every refresh runs. Nothing to add.

## Tasks
- [x] T1 (kind: build) (S4, S5) bin/lib/merge-queue-waits.mjs: the copy's processes, waits and blockers, their
  sessions and the notes; `refreshNow` in bin/lib/merge-queue-refresh.mjs; the mode in bin/merge-queue.mjs. Route:
  inline. RED: merge-queue-waits.test.mjs failed on the missing module, then on the real path shape (L4); the seven
  refreshNow tests failed on the missing export. GREEN: 7 of 7 and 15 of 15. A read-only look on this machine found
  the lead's `wait --notice-to orchestrator` as JH ORQ's and two `quiet --wait` with no session (L4).
- [x] T2 (kind: build) (S6) the package.json backup and the bin check in the held part of bin/lib/refresh-copy.mjs,
  `staleBin` moved to bin/lib/merge-queue-stale-bin.mjs with a strict `binDiffers` beside it. Route: inline. RED: the
  three new tests failed; two older tests read every file of the backups folder and were narrowed to `settings-*`.
  GREEN: 22 of 22.
- [x] T3 (kind: build) (S7) the land's refusal message. Route: inline. RED, then GREEN in merge-queue-refresh.test.mjs;
  the land test in merge-queue.test.mjs that pinned the old words was updated.
- [x] T4 (kind: docs) (S8) the orchestrator skill's sentence and its test. Route: inline. RED, then GREEN; the
  sentence ends an existing line, so bin/lib/manifest.mjs stays at its 1793-line ceiling.
- [x] T5 (kind: verify) one independent verifier over the range (delivery and installer: high risk). Route: delegated
  (opus, read-only, over 1c6b6c2..b9fa64f): no blocker and no path that stops a process other than a wait; four
  should-fix and a test gap (L7), fixed with the five Codex P2 (L5) in one commit after b9fa64f.
- [x] T7 (kind: build) the review fixes (L5, L7). Route: inline. RED, each new test on the code before it: the bin/
  listing from a subfolder (null, not []), the re-arm quoting, a single-quoted typed wait (no session), the note in
  another project's channel, `openSessions` (no export), a pid reused between the two reads (no blocker), the sessions
  read after the last look, the stop that fails partway (no note), the session with no title, an unreadable package.json
  (installed anyway). Two pinning tests the verifier found missing passed at once: two creation times that disagree, a
  script of pnpm's global folder outside the package. GREEN: waits 9/9, refresh 19/19, refresh-now 2/2, stale-bin 4/4,
  refresh-copy 23/23, merge-queue 119/119, guard 43/43.
- [ ] T6 (kind: docs) README, the roadmap line, the session summary.

## Log
- L1. 2026-10-29 16:03Z, the lead's brief (C:\Users\Oficina\.js-harness\background\briefs\2026-10-29T16-03-53-806Z-72c9e958.md), quoted in S1 to S3.
- L2. 2026-10-29 11:09 local, the lead (its notice, not the user's word): "yes, bin/lib/refresh-copy.mjs and its test
  join your surface. Put the backup and the bin check in the held part, so the land's refresh gains them too. The
  high-risk verifier covers that file as well."
- L3. 2026-10-29, the shape (this session). A mode of `merge-queue`, not a new command, because the refresh, its gate
  turn and its held part are merge-queue's already; `--refresh-copy` alone was a usage error, so no caller changes. A
  wait's session is read from its ancestors to a pid `claude agents` lists (live sessions carry `pid`), so bin/wait.mjs
  writes no new record. The waits are stopped under the gate lock, right before the install, so none is stopped for a
  refresh that then waits an hour for the lock; and the notes go after the refresh, so a session re-arms onto the new
  copy. A `loop` run from the copy blocks like any other work: the brief names waits alone.
- L4. 2026-10-29, a read-only look at this machine's processes (a script in the job's scratch folder; it stopped
  nothing). (1) pnpm's shim runs the copy as `C:\Users\Oficina\AppData\Local\pnpm\bin/../global/v11/...`, so a path
  is normalized before it is compared. (2) The lead's two `js-harness quiet --wait` run from the copy, and the relief
  file shows him stopping his quiet with the waits ("Killed waits: my quiet, 82's, 86's", 2026-10-29): `quiet --wait`
  is a wait; `quiet` alone is not. (3) L3's session reading was wrong: a background wait's `sh.exe` names a parent
  that has exited (pid 36524, parent 12096 gone), so its parents never reach a pid `claude agents` lists. The session
  is now the one whose transcript holds the same wait still open, read by `wakePlan` (bin/lib/wake.mjs) as `wake`
  reads the waits a boot killed; with the same wait open in two sessions, none is told and the wait is printed. The
  look then named the lead's `wait --notice-to orchestrator` as JH ORQ's.
- L5. 2026-10-29, Codex on 1c6b6c2..b9fa64f (gpt-6.1-sol, medium, 3 parts, 736,968 input tokens): five P2, the patch
  incorrect in each part (0.97-0.98). (1) A phone's session has no title in its transcript: the channel's readings name
  it, as `wake` passes them. (2) The copy is the machine's: another project's waits are stopped too, so its sessions
  are read and told in its own channel. (3) A typed wait in single quotes was split by Windows rules: it is read by
  `shellWords` (bin/lib/guard.mjs). (4) The re-arm command quoted only spaces: each word is now quoted for sh. (5) `git
  ls-tree` from a subfolder lists nothing: `--full-tree`. All five fixed. Claude lenses on the three slices: 0
  findings (10 lens runs).
- L6. 2026-10-29 12:43 local, the lead (its notice, not the user's word): "yes, export shellWords from
  bin/lib/guard.mjs, that one word only; no behavior of guard changes. guard is a security file: your independent
  verifier's range covers that commit too."
- L7. 2026-10-29, the independent verifier (T5) on 1c6b6c2..b9fa64f: no blocker. Fixed: (1) a stop that fails partway
  left its waits untold: each is taken for stopped before the stop, and printed as "may have stopped"; (2) the
  transcripts were read between the last look and the stop: now before the look; (3) a pid reused between the process
  table and the listing could hide a blocker as the refresh's own or a wait's child: both now need the creation time
  to agree; (4) an unreadable package.json was "none to back up": only a missing one is, any other error fails before
  the install. Also: a session with no title is named by its id, the gate lock names this mode, and the help says to
  run it in the background (it can wait an hour for the lock). Left by design: stopping a wait stops its git and gh
  children; a loop that is the refresh's own ancestor is its caller, not a blocker; a wait matched to no session is
  printed, not told; a relative or 8.3 path is not read as the copy's (none seen on this machine).
- L8. 2026-10-29, Codex's recheck of b9fa64f..8843225 (184,244 input tokens): four of the five fixed; (2) half open: a
  transcript of another project's worktree was told in a channel named after that worktree's folder, which no one
  reads. Now each other transcript's channel is its main checkout's, read from the `cwd` it ran in
  (`projectSlug(mainCheckout(cwd))`, as `notify` names it). Claude lenses on b9fa64f..8843225: 0 findings (4 lenses).
- L9. 2026-10-29, the verifier's second pass on b9fa64f..8843225: no blocker; guard.mjs changes by the export alone
  (43/43). Fixed: (N1) a transcript of a worktree git no longer lists was told in a channel named after its folder,
  and printed "told": one that ran under this project's checkout is this project's, and one whose folder is gone
  elsewhere is printed with "its project's channel is not known", not told; (N2) the note after a stop that failed
  partway says the wait may have been stopped, to run again only if it no longer runs; (N4) the refresh's own process
  with no creation time in the listing is pinned as its own; the no-backup line no longer says the shim names no copy.
  Left: a wait typed inside `bash -c "..."`, or by a path the shell expands, matches no session and is printed (N3);
  the 100 ms tolerance where both reads give the same time (N5).

The lead's helper loops (keeper, heartbeat, channel watch) as tested js-harness commands with an owner record.
Branch: feat/lead-tools (from origin/main 149e1d8). Delivery: ask-on-risk, PR as draft while main is frozen for PR 167. Tests: `node --test`.

## Goal
`js-harness loop` starts, reports and stops the lead's background loops, and writes for each one an owner
record that any session reads before it touches the loop, so a second lead never stops or restarts a loop it
does not own and a stop is confirmed by the process itself.

## Why
On 2026-10-15 the lead's loops were shell scripts in an unversioned folder (C:\Users\Oficina\.js-harness\lead).
Three failures in one night (relief log lines 950, 960, 971-978): after a host compaction or restart the app
marks the background tasks stopped while they live on as orphans; a forked lead killed the other lead's keeper
and heartbeat, because nothing said whose they were; the copy update failed blind because rg was not on PATH
under sh. Nothing tested any of it.

## Done when
- `node --test bin/loop.test.mjs` exits 0
- `node --test bin/loop-bodies.test.mjs` exits 0
- `npm run check` exits 0
- `js-harness loop status` lists each running loop with its owner, pid, start, purpose and end condition

## In scope / Out of scope
- In: bin/loop.mjs, bin/lib/loops.mjs, their tests, bin/js-harness.mjs (one dispatcher line, asked of the lead: also touched by feat/boot-wake and feat/merge-queue), README.md, this document. The orchestrator skill text in bin/lib/manifest.mjs is out: JH 19 owns it (L8).
- Out: the merge itself (`js-harness merge-queue`, PR 167, owns pushing main); the installed-copy update and the Codex meter (one-shots, not loops: L3); the scripts in C:\Users\Oficina\.js-harness\lead, which the lead retires once this lands.

## Constraints
- A loop runs in the foreground of the lead's background task — because the task's end is what wakes the lead; a detached daemon would wake no one.
- A process is named by pid and creation time, never by pid alone — because Windows reuses pids fast (bin/lib/process-tree.mjs, 2026-10-02).
- Zero dependencies, plain Node, no rg/grep/bash at run time — because PATH under the host's sh is not the user's (relief line 960).

## Ask me before
- Nothing beyond the repository's rules.

## Specs
- S1. The task, from the lead's brief (2026-10-15, the lead's message that opened this session): "commands under bin/ (zero dependencies, next to their *.test.mjs, tests first) that start, report and stop each loop, writing an owner record (lead session id, pid, start time, purpose, end condition) that any other session reads before touching the loop: a second lead refuses to stop or restart loops it does not own unless told to take over explicitly, and stop confirms by pid that nothing survives".
- S2. Sebastián's ask, as the brief quotes it (listed 03:20): "lead scripts into bin/ with an owner file so two leads never kill each other's loops".
- S3. `js-harness loop run <name> --purpose "<text>" --until "<end condition>" [--owner <session id>] -- <command> [args]`: refuses (exit 2) a loop of that name whose recorded process is alive; writes the record `<home>/.js-harness/loops/<project>/<name>.json`, runs the command in the foreground with its output passed through, removes the record when the command ends and exits with its code. The owner is `--owner`, else `CLAUDE_CODE_SESSION_ID`; with neither it refuses.
- S4. A record whose process is gone (pid not alive, or alive with another creation time) is stale: `run` replaces it and says so, `status` marks it, `stop` removes it.
- S5. `js-harness loop status [--json]`: every record of the project, one line each: name, owner (first 8 characters), alive or stale, pid, start hour, purpose, until. Read-only.
- S6. `js-harness loop stop <name> [--owner <id>] [--take-over]`: refuses (exit 3) when the live loop's owner is not the caller, unless `--take-over`; kills the recorded process and every descendant by pid and creation time, then takes a new look and exits 0 only when none of them is alive; the record is removed only then. `--restart` on `run` is stop then run, under the same owner rule.
- S7. Built-in bodies, run as the command of `loop run`: `js-harness loop heartbeat [--quiet <minutes>] [--max <hours>]` ends (exit 0) with one STALL line when neither the gate log nor the channel record was written for 30 minutes, ten hours at most; `js-harness loop channel-watch [--for <minutes>]` ends with the first new line of the channel record not sent by the owner.
- S8. The orchestrator skill says how a lead uses `loop` at start, after a compaction and at a handover. Handed to JH 19, which owns the skill text (L8).

## Tasks
- [x] T1 (kind: build) (S3, S4, S5, S6) the record, run, status and stop, with the owner rule. Route: inline. RED: bin/loop.test.mjs failed on the missing module; GREEN 12 of 12 (`node --test bin/loop.test.mjs`, 29 s on Windows: the real-process test takes six PowerShell process looks, about 28 s).
- [x] T2 (kind: build) (S7) heartbeat and channel-watch bodies. Route: inline. RED: bin/loop-bodies.test.mjs failed on the unknown verbs; GREEN 5 of 5 (`node --test bin/loop-bodies.test.mjs`, fake clock, files and channel).
- [x] T4 (kind: build) (S3, S4, S6) Codex's four P2 findings on 149e1d8..42b5f22 (L9). Route: inline. RED: the reclaim race and the surviving descendant failed in bin/loop.test.mjs; the exclusive-claim test passed before and after (a half-written read is not reproducible on demand, so it pins the outcome); GREEN 15 of 15, bin/loop-bodies.test.mjs 5 of 5, bin/lib/process-tree.test.mjs 61 of 61.
- [x] T5 (kind: build) (S3, S6) the finding Codex left open on 42b5f22..bbc860f (L10). Route: inline. RED: three lock tests failed in bin/loop.test.mjs (wait for a held lock, give up on one that stays held, break one left old); GREEN 18 of 18, bin/loop-bodies.test.mjs 5 of 5.
- [x] T3 (kind: docs) (S8) README and the dispatcher; the skill paragraphs handed to JH 19 (L8). Route: inline. Checks: bin/readme.test.mjs 5/5 (the README example is a real run in a temp home), bin/js-harness.test.mjs 35/35, bin/init.test.mjs 11/11.

## Log
- L1. 2026-10-15 04:43, the lead's brief that opened this session (verbatim in S1; the rest: "Design around PR 167 (feat/merge-queue, the local merge queue, "the only pusher of main"): the keeper's merge role may shrink to what the queue does not cover; read 167 before designing the keeper part and say in the doc what you keep.").
- L2. 2026-10-15, the keeper after PR 167. Read: PR 167's body and odd/tasks/merge-queue.md (S4-S9, L6). The queue merges every ready pull request, documents included, as one candidate tested locally and on CircleCI, and is the only pusher of main; its out-of-scope line says it replaces the keeper. So of keeper7.sh nothing of the merging is kept: the documents merge by `gh pr merge` and the code merge on a green GitHub run (merge-on-run.sh) both move main on GitHub's side, which L6 of merge-queue says the hook never sees, and the reopen-one-at-a-time exists only to buy per-PR GitHub runs the candidate's run replaces. What is kept is the loop: a keeper is `js-harness loop run keeper -- <a tick that runs js-harness merge-queue --land>`, honouring a freeze. That tick is not built here: it needs `merge-queue` on main and one real `--land` first (merge-queue L13/L14), so it is a follow-up after PR 167 lands; until then the lead runs keeper7.sh under `loop run keeper` so it gets an owner record.
- L3. 2026-10-15, what of the folder is not a loop: meter.mjs (the Codex meter, one read), update-copy.sh (writes the installed copy and the user's settings: a machine change, his to approve, and a one-shot after each code merge), run-gated.mjs (a workaround for the gate's launcher check from the Bash tool), merge-on-run.sh (retired by the queue, L2). None is moved here; each is named in the follow-ups.
- L4. 2026-10-15, the process identity: the record keeps the pid and the creation time Windows gives it (bin/lib/process-tree.mjs `takeSnapshot`), and stop kills by `selectDescendants` + `killProcesses`, the same proof the gate uses, so a reused pid is never killed and "nothing survives" is a second snapshot, not an exit code.
- L5. 2026-10-15, the first commit of T1 failed its gate: the guard in bin/lib/process-tree.test.mjs refuses `process.kill(<number>)` in bin/, and loop.mjs forwarded signals to a detached group by `process.kill(-pid)`. Fixed: the child is not detached and signals go through `child.kill(signal)`; stop still kills the whole tree by pid and creation time. T1-T3 go in one commit to spend one gate turn, since the gate is shared by seven sessions.
- L6. 2026-10-15, the lead (its message to this session, not the user's word): "yes to `loop` in bin/js-harness.mjs (one COMMANDS line + one USAGE paragraph), and the design is approved, including keeper-after-167 = a tick running merge-queue --land. Condition: do NOT append at the end of the blocks. [...] Put `loop` in alphabetical order, but not on a line adjacent to either insertion. Before committing, run `git merge-tree --write-tree` of your branch against origin/feat/boot-wake and origin/feat/merge-queue; both must be clean. Say so in the PR body." Placed between `install` and `sync` in both blocks.
- L7. 2026-10-15 05:20, the host compacted this session after the README example and before the skill text; resumed from this document.
- L8. 2026-10-15 05:24, the lead (its notice, not the user's word): "do NOT edit the orchestrator skill text in bin/lib/manifest.mjs; JH 19 owns it (T8 rewrite). Send JH 19 your js-harness loop paragraph by notify --to 19 (or a file in the shared notes folder). Your T3 = loop command, tests, docs outside manifest.mjs." The edit was reverted before any commit (the gate turn was stopped while queued); the two paragraphs are in the shared notes folder as lead-tools-loop-skill-text.md and JH 19 was told.
- L9. 2026-10-15, Codex on 149e1d8..42b5f22 (3 parts, 350,537 input tokens, inside the 1,204,800 allowance; recorded): four P2. (1) The exclusive claim (`wx`) was visible half-written: a claim is now written to a file of its own and published by a hard link, which fails with EEXIST like `wx` did. (2) A stale record was removed unconditionally, so two runs could both reclaim and one delete the other's fresh claim; and run took the process table before reading the record: removal is now compare-and-remove (move aside, read, put back what is not ours), and run reads the record before the table. (3) A stop that left a grandchild alive kept a record naming only the dead runner and child, so the next stop read it stale and killed nothing: the record now keeps `survivors` by pid and creation time, which status and stop count as roots. (4) The real-process test had no teardown: `t.after` stops the loop, then kills what its record names, then the wrapper by its handle.
- L10. 2026-10-15, Codex rechecked 42b5f22..bbc860f (72,430 input tokens; recorded): 3 of 4 fixed; finding 2 not fixed, rightly: moving a live record aside to compare it frees the name for an instant, so a third session can claim it and the put-back fails. Fixed by serializing instead of comparing: every read-decide-write of a record (run's claim, with its reclaim or its --restart stop; stop; the runner's naming of its command; its removal at the end) runs under `<name>.json.lock`, created exclusively; a lock older than 120 s (the longest hold is a stop's ten process looks) is broken, by moving it aside so only one session breaks it; a lock held for 150 s makes the command give up with exit 1. Left: two sessions breaking a lock left by a crash, in the same instant, could both hold it; that needs a session to die inside a hold of seconds.

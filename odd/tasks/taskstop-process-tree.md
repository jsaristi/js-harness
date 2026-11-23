# taskstop-process-tree

Locator: `odd/tasks/taskstop-process-tree.md` · Branch: none yet (written on `docs/plan-taskstop-process-tree`,
documents only) · Session: a docs writer of the lead's night plan 2, unit B3 · Test runner: `node --test`

## State
A plan only, written 2026-11-23 against origin/main `04664ab6`; no code is written. Owed first: this plan's double
review (`rule:double-review`), Claude's and Codex's, whose Codex reader is held until the weekly reset of 2026-11-23
23:45; nothing is built before it. The build also waits for the open pull requests that hold its files at
`04664ab6`: 950 (`bin/lib/manifest.mjs`), 954 (`bin/lib/manifest.mjs`, `bin/loop.mjs`) and 971 (`bin/loop.test.mjs`);
980 holds only `bin/lib/process-tree.mjs`, which is reused unchanged (Log, L5). Next: after those, T1 (design), then T2
to T4 in order, each in its own commit. Open, for T1 to measure: the trigger (a hook or a command named in the
skill); the matching rule for a root, measured so far for one shape only (`bash <script> <args>`); and whether a
task a sub-agent started is in the transcript the sweep reads.

## Goal
After a background task of the host is stopped, nothing it started keeps running: what the stop left is found by pid
and creation time, killed, and "none left" is said only after a fresh look at the process list.

## Why
`TaskStop` ends the host's shell of a background task and not what that shell started. Seven sightings of
`taskstop-leaves-work-alive` (`docs/FAILURES.md:2444-2474`), the last two on 2026-11-22: twelve `js-harness wait`
nodes outlived their stop, and a plan script's loop went on checking out heads in a worktree another run used, so
that run's plans were of the wrong pull request. The one control, `js-harness loop` (`bin/loop.test.mjs:324`), reaches
only loops started under it; plain background tasks have none, and the skill only says "check that none is left"
(`bin/lib/manifest.mjs:61`). The plan script's loop was found only by its effects (`docs/FAILURES.md:2469-2472`).

## Done when
- `node --test bin/loop.test.mjs` exits 0
- `node --test bin/lib/manifest.test.mjs` exits 0
- `node --test bin/lib/process-tree.test.mjs` exits 0
- `npm run check` exits 0
- `js-harness failures check` exits 0
- a real background bash script with a loop and a node child, whose host shells are killed as `TaskStop` kills them,
  is swept: the sweep says none is left, and a process listing by its command line shows none
- the `taskstop-leaves-work-alive` entry's Control line names T2's test, not an owed task

## In scope / Out of scope
- In: `bin/loop.mjs` (a `sweep` subcommand beside `run`, `status` and `stop`); `bin/lib/loops.mjs` (the selection,
  pure); `bin/loop.test.mjs`; the TaskStop sentence of `bin/lib/manifest.mjs:61` and its assertion at
  `bin/lib/manifest.test.mjs:4436`; `bin/lib/hook-entries.mjs` only if T1 picks the hook; the Control line of the
  failure's entry in `docs/FAILURES.md`.
- Out: `taskkill /T` or any kill by parent pid alone, because `bin/lib/process-tree.mjs:3-9` shows it can kill an
  unrelated tree (Depth pass, item 4); changing `bin/lib/process-tree.mjs`, which is reused as it is; a launcher-death
  check inside `bin/wait.mjs` like the gate's (`bin/lib/launcher.mjs:1-14`), which would cover the waits and not a
  plain script's loop, while the sweep is meant to cover both (the wait's shape is still to be measured, T1); the
  host's `TaskStop` itself.

## Constraints
- A process is killed only when its pid and its creation time both name it, through `killProcesses`
  (`bin/lib/process-tree.mjs:212`) or `killTargets` (`bin/lib/loops.mjs:272`) — because Windows reuses pids and keeps
  a dead parent's pid in its children (`bin/lib/process-tree.mjs:3-9`).
- A failed look is never read as "none left" — because the process-tree module and the loop stop both throw on a
  snapshot they could not take (`bin/lib/process-tree.mjs:200-205`, `bin/lib/loops.mjs:262-263`), and a sweep that
  said "none" on a failed look would bring back the failure it exists to close.
- The sweep spares itself and every process above it — because its own host wrapper's command line holds the text it
  searches for (Depth pass, item 4, second run).
- A root is taken only when its command line matches the stopped task's command by the rule T1 measures, and it was
  created within that task's life. Measured so far: for `bash <script> <args>` the leftover root's command line holds
  the arguments, not the command as typed (the shell's path replaces `bash`); a compound line (`cd x && ./plan.sh`) is
  held by no single process, and a directly launched `js-harness wait` was not probed — because another session may run the same command (twelve identical `js-harness wait --notice-to 301` lines
  on 2026-11-22), and that session's process is not this stop's to kill.
- High risk, item 4 of `AGENTS.md` (a race between the look and the kill, and a kill that reaches another session's
  process if the selection is wrong): the risk lens runs on each slice, and an independent verifier runs last on the
  range that ends at the head that ships.
- `bin/loop.mjs` stays under the 1,000-line limit of `bin/conventions-structure.test.mjs` (898 lines at `04664ab6`) —
  because it is not on `CEILINGS`; the selection goes to `bin/lib/loops.mjs` (289 lines), and `loop.mjs` gets the
  parse and the call.

## Ask me before
- Nothing expected. A design that would kill a process the snapshot does not prove to be the stopped task's stops
  the task and goes to the lead.

## Depth pass
- 1. Method: reap by proven identity, then verify by a fresh look; the standard is the one `js-harness loop stop`
  already meets (`bin/loop.mjs:169-210`: kill by pid and creation time, look again up to ten times, exit 1 and keep
  the survivors when one is left). The smallest change that meets it is to reuse that kill-and-look for a root found
  by command line within the task's life, instead of by an owner record.
- 2. Raw material:
  - `docs/FAILURES.md:2444-2474`: the entry, its seven Seen lines and its one control, `bin/loop.test.mjs` "a real
    loop: run in the background, status sees it alive, stop leaves no process of it".
  - `docs/FAILURES.md:2464-2468`: the twelve waits ran "as plain background tasks ... not under `js-harness loop`, so
    the control below did not reach them".
  - `bin/lib/process-tree.mjs:3-9` (PR 980 shifts the lines below 9 by one): a pid names a process only with its
    creation time; `taskkill /T` walks `ParentProcessId` and can reach `explorer.exe`'s tree.
  - `bin/lib/process-tree.mjs:41` `selectDescendants`, `:77` `selectTrees` (roots found "some other way (the sweep
    by command line)", with `spared`), `:94-98` `resolveRoot`, `:212` `killProcesses`, `:286-298` `killSurvivors`,
    which needs the exited root's `startedAt`.
  - `bin/lib/loops.mjs:201-214` `targetsOf` and `survivorsOf`, `:264` `snapshotProcesses`, `:272` `killTargets`.
  - `bin/lib/process-list.mjs:43` `listCommandLines`, the listing by command line the board and `quiet` share;
    `scripts/rehearsal.mjs:203-210`, a sweep by command line through `selectTrees` and `killProcesses` already.
  - `bin/lib/sessions.mjs:685-690`: a TaskStop's result is `{ task_id, task_type, command, message }` and "says that
    the host stopped the task, not that its process is gone: the process listing says that";
    `bin/lib/sessions.test.mjs:888-894` the tally behind it. The transcript pairs the stop with its launch, so the
    task's command and launch time are readable from it.
  - `bin/lib/launcher.mjs:1-14`: under Git Bash node's parent is a stub that outlives the killed shell (measured
    2026-10-14); the gate's answer was a launcher check, `odd/tasks/orphan-gate.md`, done.
  - `bin/lib/manifest.mjs:61`, the skill sentence "TaskStop has been seen to end the shell of a background command
    and leave its node process running (2026-10-14): check that none is left", held by
    `bin/lib/manifest.test.mjs:4425-4436`.
  - `bin/lib/hook-entries.mjs:39`, `:203-218`: the harness already registers `PostToolUse` hooks, so a hook on
    `TaskStop` would be one more entry of a kind it has.
  - `docs/host-updates/claude-desktop-6.28899.6.md:87` and `:217`: the host's two stop fixes are for subagents, not
    background shells; the entry keeps its own check.
  - Reuse-first search: `rg -i taskstop odd/tasks docs/ROADMAP.md` finds `orphan-gate.md` (the gate, done),
    `session-board.md` and `session-channel.md` (the board's reading of a stop), `memory-hygiene.md` and
    `memory-feedback-home.md` (memory notes), `context-diet.md` (a tool count), `audit-cement.md:7` (a session's
    next steps, "TaskStop the wait") and `launch-audit/instructions.md:62` and `:319-320` (the skill line and a
    MEMORY.md duplicate); none holds a sweep after a stop, and `docs/ROADMAP.md` has no line for it.
- 3. The bar:
  spec 1: `js-harness loop sweep --task <id>`: none, new behaviour (`js-harness loop` has `run`, `status` and `stop`,
  `bin/lib/manifest.mjs:62`)
  spec 2: `node --test bin/lib/manifest.test.mjs`: passes today on "check that none is left", a check left to the
  reader
- 4. Refutation: if `TaskStop` ended the script's children with its shell, there would be nothing to sweep. Run
  2026-11-23 in this worktree, twice, with a scratch script (`bash probe-b3.sh <stopfile>`: a `while` loop and a
  backgrounded node child, both ending by themselves when the stop file appears), started as a background Bash task
  and stopped with `TaskStop`; then `Get-CimInstance Win32_Process` filtered on the command line.
  - First run: before the stop, bash 16140 (parent 6240), bash 12400, bash 15684 (parent 12564), bash 15876 and node
    13216. After: 16140 and 12400 gone; 15684, 15876 and 13216 alive, and 15684's parent 12564 not running. Ended by
    the stop file; none alive three seconds after.
  - Second run: after the stop, bash 13864 (parent 8288, gone), bash 15888 and node 4968 alive. 13864's command line
    is `"C:\Program Files\Git\usr\bin\bash.exe" <script> <stopfile>`: the stopped command's arguments, so for this
    shape a root is found from the task's command. Only this one shape was measured. The listing's own host wrapper (bash 6204 and its two children) also matched, since
    its `eval` line holds the text: the sweep must spare itself. Ended by the stop file; none alive after.
  - The night plan's first option, "a stop by pid with `/T`", is refuted by the module it names:
    `bin/lib/process-tree.mjs:3-9`. And the surviving root's parent pid is dead, so a kill from the stopped shell's pid
    could not find it anyway.
  Verdict: supports, narrowed to the second option (Log, L3)
- 5. Request: give `js-harness loop` a `sweep --task <id>` that reads the stopped task's command and launch time from
  the session's transcript, takes as roots the live processes whose command line matches that command by the rule T1
  measures (for `bash <script> <args>`, its arguments) and whose creation time falls within the task's life, sparing itself and its ancestors, kills each root's tree by pid and
  creation time and looks again until none is left (exit 1 with the survivors otherwise); and make the skill sentence
  name it, or run it from a `PostToolUse` hook on `TaskStop` if T1 measures that the hook carries the task.
  Adds: none

## Specs
1. The lead's night plan 2 (2026-11-23), unit B3, as written: "Seen 2026-11-22: a TaskStop of a background bash left
   the script's loop alive, and it was found only by its effects. What it covers: a stop by pid with `/T`, or a check
   that the process tree is empty after a stop, reusing bin/lib/process-tree.mjs (held by 980, so the build waits for
   it)." Narrowed here to the second option (Log, L3), and its wait on 980 replaced by the holders of the files it
   changes (Log, L5).
2. The failure's own text (`docs/FAILURES.md:2445-2447`): "a stop was taken for done without the process list
   confirming it". The skill's sentence moves from a check left to the reader to the command or hook that does it.

## Tasks
- [ ] T1 (kind: design) specs 1 and 2: measure whether a `PostToolUse` hook fires on `TaskStop` and what its input
  carries (the task id and command); the offset between the transcript's launch time and the root's creation time,
  which sets the window's slack; the matching rule for a root, probed on a direct `js-harness wait`, a script and a
  compound line; and whether a sub-agent's background task is in the transcript the sweep reads; write the choice,
  hook or skill sentence, in the Log; route: inline; commit:
  docs(taskstop-process-tree): settle the sweep's trigger and window
- [ ] T2 (kind: build) spec 1: `js-harness loop sweep --task <id>`, its selection pure in `bin/lib/loops.mjs`, test
  first in `bin/loop.test.mjs`, "a stopped background task leaves no process behind" (a real script with a loop and a
  node child, its shells killed, swept to none), plus a unit case where a same-command process outside the window is
  spared; route: inline, risk lens; commit: feat(loop): sweep what a stopped background task left
- [ ] T3 (kind: build) spec 2: the TaskStop sentence of `bin/lib/manifest.mjs:61` names the sweep (or T1's hook is
  registered in `bin/lib/hook-entries.mjs`), its assertion in `bin/lib/manifest.test.mjs` changed with it; route:
  inline; commit: feat(skills): name the sweep after a TaskStop
- [ ] T4 (kind: verify) specs 1 and 2: Done when; Codex and the lenses on the range; the independent verifier on the
  range ending at the head; the failure's Control line set to T2's test; route: Codex and a verifier sub-agent;
  commit: docs(failures): taskstop-leaves-work-alive held by the sweep's test

## Log
- L1 (2026-11-23): no owner quote was found for this unit. Search: the entry `docs/FAILURES.md:2444-2474` grepped
  for `sebasti`, "his words", "he asked", "he said" and quoted Spanish, no hit; `rg -i taskstop` over `odd/tasks` and
  `docs/ROADMAP.md`, no line of his for a sweep. The night plan's own search over the four failures of lane B found
  one hit, in another entry, a notice text and not his. The lead's brief names his line 16936 as the cover for the
  night's work; it was not checked here with `js-harness sessions --quote`, so it is not quoted, and it is not a spec
  of this feature. So the words above are the lead's and the
  failure register's.
- L2 (2026-11-23): the lead's brief to this writer: unit B3 of the night plan, a plan only, the contract first, the
  depth pass cited by path:line, marked as a plan whose double review is owed before any build.
- L3 (2026-11-23): the night plan's "a stop by pid with `/T`" is dropped. `bin/lib/process-tree.mjs:3-9` says
  `taskkill /T` walks the same `ParentProcessId` field Windows never clears and can kill the desktop shell; and the
  probe (Depth pass, item 4) found the surviving root's parent already gone. The check after a stop is kept, and its
  identity is the task's command plus the task's life window, not a parent pid.
- L4 (2026-11-23): the probe ran twice in this worktree (Depth pass, item 4); both leftovers ended through their stop
  files, and a look three seconds later found none of their pids.
- L5 (2026-11-23): the night plan's "held by 980, so the build waits for it" is replaced. 980 holds
  `bin/lib/process-tree.mjs`, which this feature reuses and does not change; the files it does change are held by 950,
  954 and 971 (`gh pr list --state open --json number,files` at `04664ab6`), so the build waits for those.

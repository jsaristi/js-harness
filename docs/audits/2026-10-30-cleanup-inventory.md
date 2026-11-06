# Cleanup inventory, 2026-10-30

A dated, read-only record of what was left broken or stale on this machine and in this repository after the fixes of
2026-10-30, taken before F8 goes on. Nothing was deleted, moved, stopped or changed to take it. Each finding says what
it is, the evidence, why it matters or does not, the proposed action, whether that action can be undone, and whose
call it is: **the lead's** (inside the charter) or **his** (anything irreversible, security, his machine's settings).

Taken by JH 104 (session `aa036fd6`) from the brief
`~/.js-harness/background/briefs/2026-10-30T16-27-54-509Z-d793a7e2.md`, on `main` at `04e3d29d`, between 16:30Z and
17:05Z, with the installed `js-harness` 0.97.0. Commands that read a path outside the repository ran from this
worktree; `git` against another checkout was refused by this session's worktree guard, so those items say so.

## Summary

Nothing found puts data or security at risk today. The four that matter most:

1. The remote-control server, its five-minute watchdog task and both login launchers run the **main checkout's**
   `bin/*.mjs`, not the installed package (F1).
2. `engram doctor` reports **error**: 13 cloud sync targets that no configured cloud will ever drain (6,883 unacked
   mutations) and 68 observations with no title (F2). Local memory itself is whole and backed up.
3. The transcripts backup is at **533 MB of its 800 MiB** rollover; the next private repository will be his to create
   (F3).
4. Six failures are **not settled**, one of them only because its control points at a line that moved (F4).

The rest is housekeeping: 16 finished background sessions still recorded, 613 merged local branches and 662 merged
remote ones, 17 leftover `gate/*` and `queue/*` branches on GitHub, stale feature records and contracts, leftover
test scheduled tasks, empty folders, and caches.

The lead's measurements, verified: branches (635 local, 613 merged; 698 remote-tracking, 662 merged; the lead had 634
and 699, one more local branch since and one fewer remote), `git stash list` 2, `memory-backup` 3.0 GB, the relief
file 1,980 lines (1,979 plus one appended since), the five empty worktree folders, doctor's one `mismatch`, and the
two modified `.atl` files of `D:\abogadaclaudiajimenez` (by modification time only, see F15).

## Findings, by risk

### F1. The remote server and the login launchers run the main checkout's source

- **What:** the scheduled task `\js-harness-remote-js-harness-86aa68a6ffce` runs `conhost.exe --headless
  "C:\nvm4w\nodejs\node.exe" D:\js-harness\bin\remote.mjs start --cwd D:\js-harness --name js-harness --watchdog`
  every five minutes, and the two Startup launchers run `D:\js-harness\bin\remote.mjs start` and
  `D:\js-harness\bin\wake.mjs --notify`. The installed package lives under
  `C:\Users\Oficina\AppData\Local\pnpm\global\v11` (`pnpm ls -g`: `js-harness@0.97.0`).
- **Evidence:** `~/.js-harness/manifest.json`, `tasks[0].arguments`; the two `.vbs` files in
  `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup` (their sha256 match `optional[0]` and `optional[1]`);
  `bin/remote.mjs:37` (`SELF = fileURLToPath(import.meta.url)`) and `bin/remote.mjs:393` (`script: SELF`): the task
  runs whichever copy registered it, and this one was registered from the checkout.
- **Why it matters:** the project's own rule is to run the installed `js-harness`, not the branch's (`CLAUDE.md`,
  "Running what costs"). While `D:\js-harness` sits on `main` this is harmless; a branch checked out there, a merge in
  progress or a half-pulled tree changes what the watchdog runs every five minutes with nobody watching.
- **Action:** the lead confirms whether running from the checkout is deliberate (a test of `remote` itself, say). If
  not, he re-registers from the installed copy: `js-harness remote stop --at-login`, then `js-harness remote start
  --at-login` from a plain terminal with the installed command, and `js-harness wake --at-login` the same way.
- **Undo:** yes, the same two commands from the checkout put it back; both are recorded in the manifest.
- **Whose call:** his (his machine's scheduled task and Startup folder); the lead's to check intent first.

### F2. engram doctor reports error: orphan cloud sync targets and untitled observations

- **What:** `engram doctor` (3.6.0, read-only): `error`, 10 checks, 8 ok, 1 blocked, 1 error.
  - `sync_target_closed_space` (error): 13 sync targets (`cloud:abogadaclaudiajimenez`, `cloud:app`,
    `cloud:claudia-jimenez-plataforma`, `cloud:como-hago-para-limpiar-un-piso`, `cloud:harness`, `cloud:harness-lab`,
    `cloud:loadtest`, `cloud:magnific-plugin-app-…`, `cloud:oficina`, `cloud:skill-creator-c-users-oficina-codex-3`,
    `cloud:temp`, `cloud:tengo-un-chevrolet-spark-gt-2014`, `cloud:v`) hold 6,883 unacknowledged mutations in all,
    while `engram cloud status` says "Cloud status: not configured (no effective server URL)".
  - `sync_mutation_required_fields` (blocked): 68 observations with no `title` (62 in project `harness`, 5 in
    `magnific-plugin-app-…`, 1 in `app`).
- **Evidence:** `engram doctor`, `engram doctor --json`, `engram cloud status`; `engram stats --all`: 393 sessions,
  6,156 observations, 267 prompts, 17 projects (among them `temp` and `app`).
- **Why it matters:** no harm to local memory today: the backup of 16:29Z read the same counts live and in the
  export (`~/.js-harness/memory-backup/last.json`, `lastSuccess.counts` equal to `live`). But doctor's `error` is
  noise that hides a real one later, and the queued mutations would all try to deliver if cloud sync were ever turned
  on. None of the 13 targets is `js-harness`.
- **Action:** run the dry run engram names, `engram doctor repair --check sync_mutation_required_fields --dry-run`,
  and read what it would repair; decide on the 13 targets only after that (engram says to review the mutations before
  removing a row). Nothing in js-harness reads these rows.
- **Undo:** the dry run changes nothing. A repair rewrites `~/.engram/engram.db`: undone only from the memory backup
  (`js-harness backup` restore), so it is a one-way change in practice.
- **Whose call:** his (stored data, irreversible). The dry run is the lead's.

### F3. The transcripts backup nears its rollover; the next repository is his to create

- **What:** `~/.js-harness/memory-backup` is 3.0 GB: `transcripts/js-harness-transcripts-1` 2.9 GB (a 533 MB `.git`
  and about 2.4 GB of working copy, the same transcripts `~/.claude/projects` holds in 2.5 GB), `repo` 97 MB.
- **Evidence:** `du -sh` of each; `bin/backup.mjs:117` (`TRANSCRIPTS_ROLL_BYTES = 800 * 1024 * 1024`, measured on
  `git count-objects` of the clone, `bin/backup.mjs:490-495`); `transcripts.json`: last push 11:21Z today, 1,139 files,
  `rollover: null`.
- **Why it matters:** at 533 MB of 800 MiB the clone fills in days at today's pace; then new transcripts wait and
  doctor says `js-harness backup init --transcripts-repo js-harness-transcripts-2`, which creates a private GitHub
  repository. The 2.4 GB working copy is a second copy of the host's transcripts on the same disk.
- **Action:** none now; when doctor names the rollover, he runs that `init`. A design candidate for the lead: whether
  the clone needs its working copy after a push (it is what `git add -A` reads, so dropping it is a change to
  `runTranscripts`, not a cleanup).
- **Undo:** n/a now; a new repository can be deleted.
- **Whose call:** his for the new repository (publishing); the lead's for the design question.

### F4. Six failures not settled; one only because its control's line moved

- **What:** `js-harness failures`: 121 failures, 6 not settled.
  - `two-blocks-out-of-order`, *control lost*: its control is a line in `AGENTS.md`; the line now lives in
    `CLAUDE.md:45-46`, wrapped across two lines ("two blocks out of order cost a / session").
  - `diagnostic-whole-gate`, *repeated*, no control (seen 2026-10-10 and 2026-10-27).
  - `told-him-unverified` (11 sightings) and `checked-not-read` (6), *measured, seen again*: their control is the
    2026-10-15 measurement that a general honesty audit was not worth building; seen again 2026-10-30 and 2026-10-28.
  - `edit-during-review` (6) and `door-covers-past-tip` (3), *seen again* after their check controls
    (`bin/codex-review.test.mjs`, `bin/merge-queue.test.mjs`): seen 2026-10-30 and 2026-10-30.
  - Three more are *owed*: `old-rule-beside-new`, `command-handed-untested`, `written-question-buried` (the last two
    are `odd/tasks/instruction-homes.md` T8 and T9, open).
- **Evidence:** `js-harness failures`; `js-harness failures <id>` for each; `grep -n "two blocks out of order"
  CLAUDE.md AGENTS.md` names only `CLAUDE.md:45`.
- **Why it matters:** a lost control reads as a failure that can come back; here it is only a moved line, so the
  register over-reports. The two *seen again* after a check mean those checks do not catch every path.
- **Action:** re-point `two-blocks-out-of-order`'s control to `CLAUDE.md` (and keep the phrase on one line, or match
  it across the wrap); give `diagnostic-whole-gate` a control or record why none; read why the two checks missed
  their latest sightings before adding anything.
- **Undo:** yes, docs commits.
- **Whose call:** the lead's (the register and its controls); a new rule goes through `rules change`.

### F5. The fixed load is over its budget, and Codex carries 27k tokens of gentle-ai a turn

- **What:** `js-harness check --verbose`: `fixed load` 105,624 tokens at the first turn, median of the latest five
  sessions, budget 100,000 (a warning). `payload codex`: 31,506 tokens a turn from files, of which
  `~/.codex/AGENTS.md` (gentle-ai's) is 27,473. `claude-md budget` 3,158 of 3,200.
- **Why it matters:** cost and room on every turn. The Codex file and most of the Claude excess leave at F8's S2.
  `CLAUDE.md` has 42 tokens of room: a line added must cut one.
- **Action:** none before S2; S2's pass line already bounds `fixed load` at 80,000.
- **Undo:** n/a. **Whose call:** the lead's.

### F6. S2's hook count is out of date

- **What:** the S2 pass line in `docs/ROADMAP.md` ("S2 Removing gentle-ai, Orca and herdr") says "hooks 32 → 14
  (today 32: js-harness 13, Orca 12, gentle-ai 5, herdr 1, codegraph 1, read … on 2026-10-28)". Today
  `~/.claude/settings.json` holds 34: js-harness 15, Orca 12, gentle-ai 5, herdr 1, codegraph 1.
- **Evidence:** a count of every `hooks.*[].hooks[].command` in `~/.claude/settings.json` by owner (statusLine left
  out); the 15 js-harness entries are exactly the manifest's (F18).
- **Why it matters:** S2's probe would fail on a stale number (15 + 1 = 16 after the removal, not 14).
- **Action:** update the pass line to the count at S2's start, or state it as "js-harness and codegraph only".
- **Undo:** yes. **Whose call:** the lead's.

### F7. Two expired quarantine entries in docs/FLAKY.md

- **What:** `evals/codex-configs.test.mjs` (owner JH 21, expired 2026-10-22) and `evals/isolation-probe.test.mjs`
  (JH 28, expired 2026-10-23); `check` says "0 of them current; an expired entry no longer counts, so its file blocks
  again".
- **Evidence:** `js-harness check --verbose`, row `flaky`; `docs/FLAKY.md:23-38`.
- **Why it matters:** little: both files pass in today's gate (the `sensors` row names gate `fe1aaa4c`, this tree).
  The entries are dead text.
- **Action:** remove both entries, or renew one with a new owner if it flaked again since.
- **Undo:** yes. **Whose call:** the lead's.

### F8. Closed feature records whose proof no longer runs, and one unticked task already done

- **What:**
  - `odd/tasks/drop-circleci.md` T3 is unticked, but `9030a29e` ("feat(ci): remove CircleCI…") removed
    `.circleci/config.yml` and `scripts/circleci-config.test.mjs`; `progress` counts the feature 3/4.
  - Of 341 test-file mentions in the `node --test` done-when lines of closed feature documents, 3 name a file that
    does not exist:
    `drop-github-gate.md` names `scripts/circleci-config.test.mjs` (removed by `9030a29e`) and also requires
    `git ls-files .github/workflows` to print nothing, which now prints `gate.yml` and `windows-daily.yml` (superseded
    by `drop-circleci`); `gentle-ai-update-check.md` names `bin/lib/gentle-ai-update.test.mjs` (removed by
    `8b724f3d`, S11); `merge-queue.md:15` names `bin/lib/merge-queue.test.mjs`, which `git log --all` shows never
    existed.
- **Evidence:** a scan of every `## Done when` of `odd/tasks/*.md` with no open task; `git log --oneline -- <path>`
  for each; `ls .circleci` fails.
- **Why it matters:** `contract check` passes all 137 contracts because it validates their form, not whether their
  commands can run; a reader rerunning a closed contract gets a false red. The `merge-queue.md` one was never
  runnable.
- **Action:** tick `drop-circleci` T3 with `9030a29e`; add a dated "superseded by …" line to the two superseded
  contracts and fix `merge-queue.md:15`. A check candidate: `contract check` flags a `node --test` file that does not
  exist (a check before a line, per `AGENTS.md`).
- **Undo:** yes. **Whose call:** the lead's.
- **Not checked:** the other done-when commands (217 `node --test`, 123 `npm run`, 99 `node bin/js-harness.mjs` and
  the rest) were not run; today's gate passing on this tree covers the test files that exist.

### F9. The board shows JH 92 as waiting although it closed

- **What:** `js-harness sessions` lists `71a55588 waiting JH 92 · Status report page: the numbers first, last entry
  12h 25m ago`, while every other finished session reads "closed … by its own notice".
- **Evidence:** the channel `~/.js-harness/channel/D--js-harness.jsonl` holds JH 92's `closed` notice at
  2026-10-30T04:05:38Z; `gh pr view 684`: MERGED 04:11:53Z; `~/.claude/jobs/71a55588/state.json`: `"state": "done"`.
- **Why it matters:** a stale *waiting* row looks like work owed to him.
- **Action:** read why the board misses this closed notice (its transcript's last entry is after the notice; that is
  a guess, not checked) and fix it with a test, or record it in `docs/FAILURES.md` under the existing
  `stopped-work-shown-live` if it is that class.
- **Undo:** yes. **Whose call:** the lead's.
- Also on the board: `d845b576`, titled `ls`, *working* on `main` in `D:\js-harness`, last entry 2h ago. It is not a
  recorded background session; whose it is was not checked.

### F10. Sixteen finished background sessions are still recorded

- **What:** `~/.js-harness/background/sessions.jsonl` holds 44 starts and 25 removals; 19 are still recorded, 3 of
  them live (JH 102, JH 103, this one). The other 16 have finished:
  - job folder already gone: `c594c96f` (JH 67), `566f950e` (JH 93), `6fbd7de8` (JH 94), `5fc70112` (JH 97),
    `4ca57d0f` (JH 99), `57ff0524` (JH 100);
  - job folder still in `~/.claude/jobs`: `6305149e` (JH 65, failed), `76a92c61` (JH 73, stopped), `e54c4b14` (JH 74,
    done), `acec7557` (JH 75, done), `c10ec37f` (JH 78, done), `98576382` (JH 80, stopped), `7e7cf304` (JH 84, done),
    `bb7fa0ca` (JH 90, done), `71a55588` (JH 92, done), `5653459f` (JH 96, stopped).
- **Evidence:** the last event of each id in `sessions.jsonl`, `state.json` of each job, `js-harness sessions`.
- **Why it matters:** `uninstall machine` "fails while one is" at work and removes the rest; until then they crowd the
  board.
- **Action:** `js-harness sessions stop <id>` for each of the 16 (it runs `claude stop` and `claude rm`, keeps the
  transcript, and leaves a worktree with uncommitted changes where it is). Three more job folders are not recorded by
  js-harness (`31278c5f` of 2026-09-03 and `8df059ad`, `f462dfd5` of 2026-10-24, the last two from `D:\harness`,
  *failed*): the host's, left alone.
- **Undo:** partly: the transcripts stay; a removed job cannot be resumed. Every one's work is merged or closed.
- **Whose call:** the lead's for the 16 it started; his for the three unrecorded ones.

### F11. Branches: 613 merged local, 662 merged remote, and GitHub keeps every merged head

- **What:**
  - Local: 635 branches, 613 merged into `origin/main`. Of the 22 unmerged: 2 live (`claude/tui-gentle-level-a6afd3`,
    PR 596 open, JH 102; `feat/codex-daemon-row`, JH 103); 3 whose every patch is already in main
    (`feat/land-record`, `feat/session-unseen`, `fix/launch-audit-bugs`); 6 whose PR merged and that kept a later
    docs commit (`docs/templates-close` #665, `feat/visual-pages-t12` #666, `feat/recent-memory` #502,
    `feat/result-memory` #172, `feat/gate-wsl` #121, `feat/codex-parity` #33/#34 with 14 commits after); 3 whose PR was
    closed (`docs/failures-owed-t6` #312, 2 unique commits; `docs/fixed-load-desktop` #431, 2;
    `feat/memory-hygiene-uninstall` #263, 4; `feat/land-record`'s #350 is closed too, counted above); 8 with no PR (`docs/jh36-session-summary`,
    `docs/session-jh23`, `feat/ci-overflow` 5, `feat/gate-wait-count` 2, `feat/report-rules` 1,
    `trial/gate-on-github` 1, `jh74-draft` 2 of 4 unique, a `wip`, `worktree-f8-s1-reviews` 2).
  - Remote: 698 remote-tracking refs, 662 merged; `git ls-remote --heads origin` lists 691, so 3 tracking refs are
    stale (no `fetch.prune`), and 4 refs `refs/remotes/pr/{128,130,131,134}-merge` belong to no remote. On GitHub: 14
    `gate/*` and 3 `queue/*` branches left behind; `origin/memory-summary` is the public summary, by design (D4).
  - GitHub's `delete_branch_on_merge` is `false` (`gh api repos/jsaristi/js-harness`), so every merged PR leaves its
    head.
  - `bin/lib/ci-gate.mjs:127` deletes its `gate/<sha>` branch in a `finally` and ignores the result, so a failed
    delete is silent; `bin/merge-queue.mjs:558-560` names its own failure ("remove it by hand"). That is how the 14
    stayed.
- **Evidence:** `git branch --merged/--no-merged origin/main`, `git cherry origin/main <branch>` for each unmerged one
  (a script in this session's scratch), `gh pr list --state all`, `git for-each-ref refs/remotes`.
- **Why it matters:** listing and completion noise, and `git fetch` time; no data risk while main holds the merged
  work. The unmerged ones with unique commits are the only ones that could lose work.
- **Action:** delete the 613 merged local branches with `git branch -d` (it refuses an unmerged one); `git fetch
  --prune` and `git update-ref -d` for the 4 `pr/*` refs; delete the 17 `gate/*`/`queue/*` heads and the merged
  remote heads; make `ci-gate` name a failed delete as `merge-queue` does (a code fix with its test). The 17 unmerged
  ones that are not live and hold a commit main lacks are read one by one before any goes.
- **Undo:** merged branches: yes, their commits are in main and each PR page can restore its head. Unmerged ones: no
  once their reflog expires.
- **Whose call:** the lead's for merged local branches, stale refs and the `ci-gate` fix; his for deleting remote
  branches in bulk, turning on `delete_branch_on_merge` (a repository setting, which also affects stacked PRs), and
  any unmerged branch.

### F12. Two stashes from 2026-10-14 and 15

- **What:** `stash@{0}` "On feat/on-demand-functions-3: slice 3 staged units" (2026-10-15, 8 files, +494 −9) and
  `stash@{1}` "On feat/honesty-audit: JH15 eval unit, held out of the guard commit" (2026-10-14, 18 files, +824 −58).
  Both branches are merged.
- **Evidence:** `git stash list --format='%h %ci %gs'`, `git stash show --stat`.
- **Why it matters:** the stash stack is shared by every worktree; two old entries invite a wrong `pop`.
- **Action:** compare each with main to see whether its content landed; then drop or turn into a branch.
- **Not checked:** whether their content landed.
- **Undo:** a dropped stash survives as a dangling commit until `git gc` prunes it; in practice one-way.
- **Whose call:** the lead's to compare; his to drop.

### F13. Three leftover Claude scheduled tasks from tests

- **What:** `~/.claude/scheduled-tasks/` holds `jh-open-session-test` (2026-10-09, its description says "One-off test …
  Safe to delete."), `jh-orq-wake-after-plan-reset` (2026-10-11, a one-time wake for 18:20 that day) and
  `jh-t16-harmless-try` (2026-10-15, "should be refused by the guard"). None is in the manifest.
- **Evidence:** `ls` and the head of each `SKILL.md`.
- **Why it matters:** clutter in the app's task list; none runs again on its own (one-off or past).
- **Action:** delete the three folders (copy them aside first).
- **Undo:** yes with the copy. **Whose call:** his (his app's state).

### F14. Five empty worktree folders and Orca's two worktrees of this repository

- **What:** `delivery-follow-ups`, `f8-s5c-a-paid`, `f8-s5c-a-reach`, `gentle-ai-how-it-works`, `visual-pages` under
  `D:\js-harness\.claude\worktrees` are empty (0 entries each) and not registered with git. `git worktree list` also
  shows `C:/Users/Oficina/orca/workspaces/js-harness/copepod` and `…/medaka`, both at `1d8b0489` (2026-09-27) on
  `jsaristi/copepod` and `jsaristi/medaka`, branches already merged.
- **Why it matters:** none; the folders wait for the reboot that frees them, and Orca leaves at S2.
- **Action:** remove the empty folders after a reboot; `git worktree remove` the two Orca ones at S2.
- **Undo:** yes (empty; the Orca branches are merged). **Whose call:** the lead's for the empty folders; S2 is his.

### F15. A gentle-ai hook keeps modifying a tracked file in his other project

- **What:** `D:\abogadaclaudiajimenez\.atl\skill-registry.md` and `.skill-registry.cache.json` were rewritten at 10:55
  local today. The `UserPromptSubmit` hook `gentle-ai skill-registry refresh --quiet --no-gitignore --cwd …` in
  `~/.claude/settings.json` rewrites them at every prompt in any project; this repository keeps `.atl/` out through
  `.git/info/exclude:9`, that one does not list it in its `.gitignore`.
- **Not checked:** `git status` there (this session's guard refuses git outside its worktree); the lead measured them
  modified and unstaged.
- **Action:** in that project, either commit the regenerated file, restore it, or untrack `.atl/` and exclude it as
  here. The cause leaves with gentle-ai at S2.
- **Undo:** yes (git). **Whose call:** his (his project).

### F16. Regenerable caches: about 0.74 GB, and up to 1.15 GB in the pnpm store

- **What:** `~/.js-harness/clean.json` (measured 03:28Z today): `claude-versions` 297 MB, `claude-desktop-cli`
  297 MB, `go-modcache` 148 MB; `pnpm-store` up to 1.15 GB. Doctor's `clean` row is `ok` (under its threshold).
- **Action:** `js-harness clean` to list, then `js-harness clean --apply --kind <id>` per kind he confirms.
- **Undo:** regenerated on demand (a download). **Whose call:** his (deletes on his machine).

### F17. Orca and herdr leftovers (they leave at S2; only listed)

- Orca: the app, `C:\Users\Oficina\AppData\Local\Programs\orca` (630 MB); `~/.orca` (29 KB, its hook scripts); 12 hook
  entries `C:/Users/Oficina/.orca/agent-hooks/claude-hook.cmd` in `~/.claude/settings.json`; `~/orca/workspaces`
  (806 KB) with the two worktrees of F14.
- herdr: `~/.herdr` (27 MB, release 0.9.1); one `SessionStart` hook in `~/.claude/settings.json`
  (`~/.claude/hooks/herdr-agent-state.ps1`) and one in `~/.codex/hooks.json` (`~/.codex/herdr-agent-state.ps1`).
- Every file those hooks name exists, so none fails today.

### F18. Small items

- **Empty package folders:** `C:\nvm4w\nodejs\node_modules\@google`, `@kilocode`, `@nanonets` are empty (0 bytes),
  left by CLIs uninstalled earlier. Remove them; his machine, trivially undone. Otherwise the global packages are
  current: pnpm's `@openai/codex` 0.166.0, `ccstatusline` 2.2.32, `ctx7` 0.6.1, `js-harness` 0.97.0, `pnpm` 12.16.1;
  node's `@colbymchenry/codegraph`, `typescript`, `typescript-language-server`; Go's `gentle-ai`. No predecessor
  package found.
- **The relief file** `~/.js-harness/relief/D--js-harness.md`: 1,980 lines, 1.4 MB, never rotated; the board reads it
  whole to show 5 lines (`bin/lib/board-files.mjs:11-13`). No harm yet; a rotation is a design candidate for the lead.
- **check:** 40 lens records ignored as no evidence (incomplete runs or records no run line names). Noise in
  `.git/js-harness`; the lead may prune them.
- **doctor:** `engram-plugin` `mismatch` (plugin 0.1.19 ahead of the 0.1.17 that engram v3.6.0 ships; JH 103 fixes
  its text); `codegraph` `project missing` for this worktree (no `.codegraph/` index here, expected for a read-only
  worktree); `templates` `stale`: "the moment 119 of question was never shown" (`js-harness template shown`).
- **Open decisions** in `docs/ROADMAP.md`, "Open decisions": 1 (the Magnific connector: no Magnific tool is in this
  session's tool list, so it may already be off; not checked in the app), 2 (permission mode: `~/.claude/settings.json`
  still has `"defaultMode": "bypassPermissions"`), and 8 (the Codex plugin proposal) carry no answer.
  `odd/tasks/instruction-homes.md` T8 and T9 are owed controls (F4).

### Checked and found clean

- **Machine manifest against disk:** every file, entry, task and optional path in `~/.js-harness/manifest.json` exists,
  and each of its 20 hook entries is present in `~/.claude/settings.json` or `~/.codex/hooks.json`; every js-harness
  hook in `settings.json` is in the manifest. `uninstall` has no `--dry-run`, so the manifest was read instead.
- **Hooks naming missing commands:** none. Every command named in `~/.claude/settings.json` and `~/.codex/hooks.json`
  resolves (`js-harness`, `gentle-ai`, `codegraph.cmd`, `engram`, `ccstatusline`, the Orca and herdr scripts), and so
  do `~/.codex/config.toml`'s `notify` executable and `node_repl` MCP command. The Codex `hooks.state` trust entries
  match `hooks.json`'s 5 SessionStart, 3 Stop and 1 SubagentStop commands.
- **Windows scheduled tasks:** outside `\Microsoft\` and the vendors' (Edge, HP), only
  `\js-harness-remote-js-harness-86aa68a6ffce`, the manifest's. Nothing from the predecessor stacks.
- **MCP:** `claude mcp list`: codegraph, context7 and engram connected.
- **Throughput:** `js-harness throughput status` prints no `DUE:` line; days 2026-10-24 to 2026-10-29 are kept.
- **Memory hygiene:** `js-harness memory status`: 8 notes, index 783 B of 4,000, "nothing due"; three notes over
  4 KB are candidates for a later pass only.
- **The gate:** `js-harness check` PASS on this tree (13 rows, 7 INFO).
- **The codegraph prompt hook:** off in this repository as decided (`CODEGRAPH_NO_PROMPT_HOOK` in
  `.claude/settings.local.json`, and the worktrees carry it).

## Not checked

- `git status` of `D:\js-harness` (the main checkout) and of `D:\abogadaclaudiajimenez`: refused by this session's
  worktree guard.
- `claude agents`: not run; `~/.claude/jobs/*/state.json` was read instead.
- Which process holds the five empty folders.
- The done-when commands of closed contracts other than the existence of their test files (F8).
- The content of the two stashes against main (F12).

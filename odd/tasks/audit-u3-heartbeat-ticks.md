# Audit unit 3: the heartbeat's ticks

Locator: `odd/tasks/audit-u3-heartbeat-ticks.md` · Branch: `audit-u3-heartbeat-ticks` · Delivery: one pull request ·
Test runner: `node --test`

## Goal
Every session started in this repository is told, at no model tokens, when the heartbeat's three workshop ticks have
not run for half a day, and why; the idea-watch row reaches the session start here again.

## Why
The Fable 5.2 audit's M37 (`docs/audits/2026-11-09-fable-5-2-audit.md` on `claude/fable-5-2-audit-531f8e`) and its
triage, unit 3 (`docs/proposals/2026-11-10-audit-triage.md` on `docs/audit-triage`): the daily Windows run, the
throughput snapshots and reviews due, and the host watch have been read by nothing since 2026-11-03, and nothing said
so. The workshop split planned the row that would (`odd/tasks/workshop-product-split.md`, slice 1+2 and the next step
of L27) and did not build it.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/audit-u3-heartbeat-ticks.md` exits 0
- `node --test workshop/bin/ticks.test.mjs workshop/js-harness-workshop.test.mjs bin/lib/hook-count.test.mjs` exits 0
- `node workshop/js-harness-workshop.mjs spec` exits 0
- `npm run check` exits 0
- `node workshop/js-harness-workshop.mjs ticks --hook` exits 0 and prints a stale row against a home whose newest
  snapshot is two days old (a test in `workshop/bin/ticks.test.mjs`)
- run here against the real home, `ticks --hook` prints the stale row today, quoted in `## Log`, with its measured
  time
- a snapshot of the day appears in `~/.js-harness/throughput/D--js-harness/`: the lead's step, since the heartbeat is
  the lead's loop; it is named in the ready notice and not claimed here until the lead's heartbeat writes it
- the pull request is opened, named in `## Log`, with Codex and the Claude lenses recorded over its code

## In scope / Out of scope
- In: a new `workshop/bin/ticks.mjs` and its test; `workshop/js-harness-workshop.mjs` and its test (the command, its
  usage and help); the asked-file paths of `workshop/lib/windows-daily.mjs` and `workshop/bin/host-watch.mjs`, and
  `settlesAt` of `workshop/bin/throughput.mjs`, exported so each path and each time has one home; a new
  `.claude/settings.json` with one `SessionStart` entry; `docs/SPEC.md`'s throughput capability; this document.
- Out, each with its reason:
  - re-pointing the lead's heartbeat loop to the workshop's `loop heartbeat`: the loop is the lead's, owned by another
    session (`~/.js-harness/loops/D--js-harness/heartbeat.json`); the ready notice names the command.
  - the warning of the product's `loop heartbeat` run inside this checkout (`workshop-product-split.md`:283-284) and
    the product texts L25 names: not in the unit's list; named as open in the report.
  - `bin/lib/share-check.mjs`, `bin/double-review.mjs`, `bin/reply.mjs`: JH 165's, by the brief.
  - his `~/.js-harness` records are read, never written: the hook writes nothing at all.

## Constraints
- The hook runs at every session start of this repository, so it must be fast, write nothing, print nothing on
  stderr and exit 0 whatever fails — because a `SessionStart` hook must never break a session (the contract of
  `doctor --hook`, `bin/doctor.mjs:514-521`), and a hook that writes nothing is undone by deleting its entry.
- The idea row's network read is bounded below the hook's timeout — because a slow network must not hold a session
  start for the whole timeout.
- Its notice is a `systemMessage`, shown to him and not in the context — because the diet's bar is fixed tokens a
  turn (question 190, L11 of `workshop-product-split.md`), and `doctor --hook` speaks the same way.

## Ask me before
Nothing of his is expected: the design is the reviewed plan's (`workshop-product-split.md`, L12 finding 10). A
decision that is his goes to the lead with `js-harness notify --to orchestrator --kind question`.

## Depth pass
- 1. Method: an operations "dead man's switch": a job that should run on a cadence is watched by the age of what it
  leaves, not by its own report, since a job that never starts reports nothing. The best practice is to read the
  freshest artifact of each job, compare it with its cadence plus a grace, and alert on the age, with the job's name
  and the fix. The smallest change that meets it here: no new record; the three ticks already leave dated artifacts
  (the windows-daily and host-watch `asked` files, written each hour a tick reads, and the dated throughput
  snapshots), so one read-only command compares their ages with one constant. Searched first: `git grep "ticks --hook"`
  finds only `bin/lib/hook-count.test.mjs:45-113`, which already counts this entry; `throughput status`
  (`workshop/bin/throughput.mjs:526-563`) names a missing day but runs in no hook and reads neither `asked` file;
  `doctor --hook` (`bin/doctor.mjs:514`) is the product's and gives no workshop row; `ideasRow` (`bin/doctor.mjs:369`)
  runs only interactively (`:225`).
- 2. Raw material:
  - `~/.js-harness/channel/windows-daily/D--js-harness/asked`: `2026-11-03T02:18:40.158Z`;
    `~/.js-harness/channel/host-watch/D--js-harness/asked`: `2026-11-03T02:18:43.635Z`.
  - `ls ~/.js-harness/throughput/D--js-harness/`: the newest snapshot is `2026-11-02.json`, written 2026-11-02 20:00
    local.
  - `~/.js-harness/loops/D--js-harness/heartbeat.json`: started `2026-11-10T06:15:54Z`, command
    `["js-harness","loop","heartbeat"]`, the product's.
  - `bin/js-harness.mjs:70` runs `loopMain` with no ticks; `bin/loop.mjs:707-712` defaults the three to `null`;
    `workshop/js-harness-workshop.mjs:69-72` is the only caller that passes `TICKS`.
  - The plan: `odd/tasks/workshop-product-split.md`:278-285, :497-500, L12 finding 10, :898-900.
- 3. The bar:
  spec 1: `node --test workshop/bin/ticks.test.mjs`: none, new behaviour (the stale row against a home whose newest
  snapshot is two days old, and each tick's age)
  spec 2: `node workshop/js-harness-workshop.mjs ticks --hook`: none, new behaviour (exit 0, one `systemMessage` line
  or nothing, never stderr, whatever fails)
  spec 3: `node --test workshop/js-harness-workshop.test.mjs`: the dispatcher's tests pass today; the command joins
  its table and its usage
  spec 4: `node workshop/js-harness-workshop.mjs spec`: PASS today, 79 capabilities; SPEC claims the new command
  spec 5: `node --test bin/lib/hook-count.test.mjs`: passes today with the planned entry; the real
  `.claude/settings.json` holds exactly that entry
- 4. Refutation: if a heartbeat that runs the ticks were alive, the `asked` files would be under an hour old. Read
  now (2026-11-10T06:38Z): both say 2026-11-03T02:18Z, 7 days and 4 hours old, while a heartbeat started at 06:15Z
  runs; its command is the product's, which passes no ticks. The ticks did not move with the split to anything that
  runs: they run only through `node workshop/js-harness-workshop.mjs loop heartbeat`, which no loop runs.
  Verdict: supports
- 5. Request: build `node workshop/js-harness-workshop.mjs ticks --hook`, read-only, which says at session start in
  this repository when any of the three ticks has not run for 12 hours, with its last run, and names the command that
  runs them (the workshop's heartbeat); it also says when the heartbeat loop on record runs the product's command,
  and carries the idea-watch row; register it in a committed `.claude/settings.json`; the lead re-points the
  heartbeat, and the first snapshot after that is the proof that the ticks run again.
  Adds: none

## Specs
1. The unit (triage, section 3): "first find why the snapshots stop on 2026-11-02 [...] (is a heartbeat running at
   all?); then build `ticks --hook` with its stale-ticks row as `odd/tasks/workshop-product-split.md:898-900` plans
   it."
2. The brief: "it adds a hook to the project's `.claude/settings.json`, which every session of this repo then runs, so
   it must be fast, never block a session when it fails, and be undone by deleting its entry; say its measured time.
   Tests first."
3. The plan (`workshop-product-split.md`:497-500): "It computes only the idea row and the stale-ticks row, timeout 15,
   so the full doctor does not run twice here (finding 10). Its cost is measured, and a test checks that the idea row
   appears here."

## Tasks
- [x] T1 (kind: build) spec 1, 3: `workshop/bin/ticks.mjs` and its test, test first; the exports of one home; the
  dispatcher. Route: inline. Commit: `feat(workshop): ticks --hook says when the heartbeat's ticks stopped`
- [x] T2 (kind: build) spec 2, 5: `.claude/settings.json`, its test and the `workshop` cell of `HOOK_CEILINGS`, with
  the measured time. His word: question 245 (L8). Route: inline. Commit: its own pull request, after T1's landed
- [x] T3 (kind: verify) Codex and the lenses on each code commit; `npm run check`; the pull request; the ready notice.

## Log
- L1 (2026-11-10, the lead's brief `2026-11-10T06-31-36-662Z-8f2df985.md`): "Yours: exactly what the unit lists and
  its \"Done when\". It is high risk, item 5: it adds a hook to the project's `.claude/settings.json`, which every
  session of this repo then runs, so it must be fast, never block a session when it fails, and be undone by deleting
  its entry; say its measured time. Tests first."
- L2 (2026-11-10): the lead's finding confirmed from the records (depth pass, items 2 and 4). The running heartbeat
  writes no snapshot today: it is the product's `js-harness loop heartbeat`, and the ticks moved with the split to the
  workshop's `loop heartbeat`, which nothing runs. The three ticks last ran together at 2026-11-03T02:18Z, before the
  split merged (pull request 776, 2026-11-06), so before the split no heartbeat ran either: two causes, one after the
  other, and neither was said. What `ticks --hook` must do follows: say the age of each tick and the command that
  runs them, and say when the loop on record is the product's.
- L3 (2026-11-10): T1 and T2 built test first. `node --test workshop/bin/ticks.test.mjs` failed with the module
  missing, then 11 of 11 passed; with the dispatcher's, hook-count's, throughput's, windows-daily's and host-watch's
  tests, 92 of 92; `node workshop/js-harness-workshop.mjs spec`: PASS, 79 capabilities. The stale threshold is 12 hours (`TICKS_STALE_HOURS`): a night away
  is no stall, and a heartbeat that runs no tick is told on the next morning's first session start.
- L4 (2026-11-10): run here against the real home, through a child `node` as the host runs it, five times:
  exit 0 each, stderr 0 bytes, 634 bytes of stdout, median 1,041 ms, max 1,169 ms. Without the idea-watch row
  (`ideas` given as none) it takes a median of 256 ms (3 runs); module load alone 239 ms: the rest is the network list
  of the upstream's tags, bounded at 5 s. What it said today:
  `{"systemMessage":"js-harness workshop: the heartbeat's ticks have not run for 12 hours: throughput: the newest
  snapshot is 2026-11-02, and 2026-11-03, settled at 2026-11-04T01:00:00.000Z, has none; windows-daily: last read at
  2026-11-03T02:18:40.158Z; host-watch: last read at 2026-11-03T02:18:43.635Z. the heartbeat on record (since
  2026-11-10T06:15:54.144Z) runs js-harness loop heartbeat, the product's, which runs no tick. [...] idea-watch: 1
  release not yet read (the last read is v4.3.1): v4.4.0"}` (the parts are joined by "; and " since).
- L5 (2026-11-10): the commit of T1 and T2 was refused by `check`'s `hook entries` row: "workshop: a new owner, not
  in the table: SessionStart 1". `HOOK_CEILINGS` (`bin/lib/hook-count.mjs:20-31`) says a ceiling goes up only on his
  word, as engram's did through question 225 (`odd/tasks/f8-s4a-hook-count.md`, L15); the plan's design (a project
  declaring its owners in `harness.json`, `workshop-product-split.md`:455-457) was not what S4a built. So T2 waits on
  his word, asked through the lead as question 245 (recorded 2026-11-10T06:46:04Z), and T1 lands alone: the command,
  without the settings entry. The question, in short: "¿Aceptas que este repo tenga un hook propio al iniciar sesión, `node workshop/js-harness-workshop.mjs ticks
  --hook`?", options "Aceptar el hook (recomendado)" (adds `workshop: { SessionStart: 1 }` to `HOOK_CEILINGS` and the
  entry to `.claude/settings.json`; about 1 s a session start, 0 model tokens, writes nothing; authorizes no other
  hook and no other ceiling) and "Sin hook, solo a mano" (the command stays, run by hand or by the lead; nothing says
  at session start that the ticks stopped).
- L6 (2026-11-10): reviews of `f1071b4d`. The lenses (resilience, reliability, readability): 0 findings, 108,158
  input tokens. Codex (193,215 input tokens): one P2, taken: with `--cwd` and a relative `--home`, the home resolved
  against the project, where `loop`, `throughput` and `windows-daily` resolve it against where the command runs
  (`workshop/bin/throughput.mjs:657`). Fixed test first: the new test failed (10 of 11), then 11 of 11.
- L7 (2026-11-10): the first runs of the reviews of the fix `c1a3720e` were stopped by Claude Code for low memory,
  unrecorded; the lead held them, then asked for them one at a time after JH 167 closed. Codex: correct (0.99), its
  P2 fixed, 33,311 input tokens; the reliability lens: 0 findings, 11,428 input tokens. T1 goes out as its pull
  request; T2 waits on question 245.
- L8 (2026-11-11): T1 landed as pull request 809 (merged 2026-11-11T02:23:39Z, after his yes to the lead's question
  252). Question 245 is answered: he tapped "Aceptar el hook (recomendado)" (the lead's transcript
  `ea85ec35-82e1-4aa9-abe3-98bd153a50b0`, line 5903, 2026-11-11T04:22:56Z, read with `js-harness sessions --quote`).
  It covers `workshop: { SessionStart: 1 }` in `HOOK_CEILINGS` and the one entry in `.claude/settings.json`; no other
  hook and no other ceiling. T2 is built on `audit-u3-ticks-hook`, from main at `7525a4e5`, test first: the two new
  tests failed (25 passed, 2 failed), then with the conventions and the dispatcher's tests 62 of 62 passed;
  `node workshop/js-harness-workshop.mjs spec`: PASS, 79 capabilities.
- L9 (2026-11-11): the hook measured again against the real home, five runs through a child `node`, with three other
  sessions on the machine: exit 0 each, stderr 0 bytes, median 1,418 ms, max 1,514 ms, against the 15 s of its
  timeout. It still says the three ticks are stale, and names no heartbeat on record: the machine restarted and none
  runs. The snapshot of the day has not appeared; it will when the lead's heartbeat runs the workshop's loop.
  Undo: delete `.claude/settings.json`'s entry and the `workshop` cell; the hook wrote nothing to undo.
- L10 (2026-11-11): reviews of T2, `7c962911`. The lenses (risk, reliability): 0 findings, 17,478 input tokens.
  Codex (104,751 input tokens): one P2, answered and not taken: the relative script path fails when the hook runs
  from a subdirectory, and it asks for `"$CLAUDE_PROJECT_DIR"`. By Claude Code's documentation (settings and hooks
  pages, read through the guide sub-agent on 2026-11-11, whose fetch summarizes; not checked by a run): the project's
  `.claude/settings.json` is read from the session's primary working directory, so a session started in a
  subdirectory does not load this hook at all, and where it loads, the handler runs in that directory, the root.
  `$CLAUDE_PROJECT_DIR` expands in Git Bash and is null in PowerShell, the shell of a Windows with no Git Bash, where
  it would break a hook that works today; and `ownerOf` (`bin/lib/hook-count.mjs:76`) would read it as a new owner,
  so the product would change too. What stays open: a resumed session whose directory moved, not documented; there
  the hook fails without blocking the session, and its notice is missing.
- L11 (2026-11-11): L10's answer is withdrawn and Codex's P2 taken. The push was refused, `check --push`: "the Codex
  review that ended at 7c962911 owes a correction: 1 finding open", and the door keeps no record for an answered
  finding. The lead's note of 00:14 local: "take the finding, do not answer it [...] the hook must run when the
  session's folder is not the repo root, without resting on a variable that is empty in one shell (a fallback when
  it is empty is fine), with the test that proves both cases." The entry's command is now `node -e "<code>"
  workshop/js-harness-workshop.mjs ticks --hook`: node itself reads `CLAUDE_PROJECT_DIR`, or the folder it runs in
  when the variable is empty, and takes the nearest folder from there upwards that holds the dispatcher, so the
  command holds no `$` and no backtick for one shell to read its own way; it sets `argv[1]` to the real script, which
  the dispatcher's main guard needs, and where none is found it prints nothing and exits 0. `ownerOf` reads it as
  `workshop` unchanged, so the product's code does not change, only its test. Test first: the three new tests failed
  (the command's shape, a subfolder with the variable set, no dispatcher found), then with hook-count's, the
  conventions' and the dispatcher's 64 of 64 passed. They run the command as the settings hold it through the
  platform's shell: from the root, from a subfolder with the variable set, unset and empty, from outside the
  repository with it set, and with no dispatcher to find. Run by hand from `workshop/bin` against the real home, with
  other sessions on the machine: Git Bash, 5 runs with the variable, exit 0, stderr 0 bytes, median 2,047 ms, max
  2,196 ms; without it, 2 runs, 2,211 ms at most; PowerShell without it, 3 runs, median 4,788 ms, max 6,883 ms, of
  which PowerShell's own start is most; cmd, 2 runs, 1,965 ms at most. Each time includes the shell's start, which
  L9's runs through a child `node` did not; all are under the 15 s of the timeout.
- L12 (2026-11-11): reviews of the fix, `7a343c87`. Codex's recheck (35,092 input tokens): "the patch is correct"
  (0.94), its P2 fixed, 0 not fixed. The reliability lens (7,242 input tokens): 3 warnings, all taken, test first.
  One: a dispatcher found that does not load ended the hook in silence; it is now said to the session as one
  `systemMessage` line, still exit 0 and nothing on stderr. Two: the variable naming a folder that holds no
  dispatcher hid the one in the folder the hook runs in; the search now goes from the variable's folder upwards, then
  from the folder it runs in upwards. Three: no test ran the command in hook mode; one now runs it as the settings
  hold it from `workshop/bin` against a home with one fresh reading filed under this repository, and that row is
  missing from the message while the other two are said. Two of the three new tests failed first (14 passed, 2
  failed; the hook-mode one passed, being coverage that was missing), then with hook-count's, the conventions' and
  the dispatcher's 66 of 66. Run by hand again from `workshop/bin` against the real home, other sessions on the
  machine, each exit 0 and stderr 0 bytes: Git Bash without the variable, 5 runs, median 1,836 ms, max 2,262 ms; cmd
  without it, 3 runs, median 3,509 ms, max 3,622 ms; PowerShell with it, 3 runs, median 7,514 ms, max 7,737 ms, of
  which an empty PowerShell took a median of 4,387 ms to start in the same minute (Git Bash, 98 ms). All under the
  15 s of the timeout; PowerShell is the host's shell only where Git Bash is not installed.
- L13 (2026-11-11): reviews of `5900c32a`. Codex (74,236 input tokens): "the patch is correct" (0.91), no finding.
  The reliability lens (7,707 input tokens): its three findings fixed, 0 not fixed, and one follow-up, taken: the
  hook-mode test ran the idea-watch reading, which asks the network. The tests' runs of the command now give git a
  proxy on a local port nothing listens on, so no run reaches the network, and the test holds what the hook says
  offline: the ticks' part first, then "idea-watch: could not be read (", exit 0, nothing on stderr. Run by hand
  with that proxy from `workshop/bin` against the real home: exit 0, stderr 0 bytes, 4,655 and 5,481 ms, most of it
  git's two refused connections, under the 5 s that bounds each and the 15 s of the timeout. 66 of 66 passed.

- L14 (2026-11-11): reviews of `bb04ec83`. Codex (89,131 input tokens): "the patch is correct" (0.92), no finding;
  the reliability lens (5,727 input tokens): 0 findings, its follow-up fixed. `js-harness check --push`: the
  `codex-review` and `lens-review` rows pass over the four code commits. Pushed; pull request 815 opened as a draft.
  `js-harness notify --to orchestrator --kind ready --pr 815` was refused, "PR 815 is a draft". The lead's note of
  01:00 local (the lead's claim): "leave PR 815 as it is. The lead marks it ready itself when it lands it [...]
  Finish your summary and send the closed notice; no ready notice is needed." So T3 closes with no ready notice on
  record for 815, by the lead's word.

## Next step
For a resume (2026-11-11): nothing is left to build. Pull request 815 is open as a draft, reviewed at the door
(L14); the lead marks it ready and lands it, and no ready notice is owed. The summary is
`docs/sessions/2026-11-11-jh-166-audit-unit-3-the-heartbeat-s-ticks.md`; once it is committed and pushed,
`js-harness notify --to orchestrator --kind closed --summary <that file>` closes the session. The snapshot of the day
is the lead's: the heartbeat must run `node workshop/js-harness-workshop.mjs loop heartbeat`.

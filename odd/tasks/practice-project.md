# Practice project

Locator: `odd/tasks/practice-project.md` · Engram mirror: `odd/practice-project/tasks` · Branch:
`feat/practice-project`, worktree `D:\js-harness-worktrees\practice-project`, cut from `main` at
`20911ea`. Session: `JH 2 · proyecto de práctica`; orchestrator: `JH ORQ · js-harness`.

## Goal
One command proves a version of the harness in a project outside this repository, where the
harness is only installed and never edited, as a project of Sebastián's would receive it, and
without changing anything on his machine outside one folder.

## Why
He asked on 2026-10-09 that everything be proven before it reaches a project of his ("la idea
tambien es poder probar todo antes de irlo a probar en un proyecto externo"). The roadmap gives
the order: by its tests, then by use on this repository, then in a practice project made for the
purpose; "that third step does not exist yet and is the first thing to build for it"
(`docs/ROADMAP.md:659-663`).

The first two steps do not show what a project receives:

- The tests build throwaway folders, call the engines in-process and fake codegraph. No test
  commits through the hook that `init` writes (the explorer's search: `rg "exec js-harness check"`
  finds only assertions on the text).
- This repository runs the harness as source: `npm run check` and `.githooks` (`git config
  core.hooksPath` prints `.githooks`). A project runs something else: the `js-harness` command on
  PATH, called by a hook whose whole body is `exec js-harness check`
  (`bin/lib/project.mjs:309-310`).
- `scripts/e2e.mjs` proves the machine half (pack, install, upgrade, uninstall) in temporary
  folders and never creates a project (`rg "'init'|initMain|git init" scripts`: no hit).

The cost of that gap is on record. On 2026-10-09 three defects were found on his real machine, by
accident: `install` acted on `--help`, the command on PATH was an old copy, and `upgrade` could
not work (`odd/tasks/session-board.md:1183-1215`). A practice project is where those are met
first, at no cost.

## Done when
- `node --test scripts/practice-lib.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/practice-project.md` exits 0
- `npm run check` exits 0
- `node scripts/practice.mjs run --root <the folder he chose>` exits 0 on this machine, and its
  output is recorded under Progress: every step of the journey, the commit of the harness that was
  proven, and the line that says his real home was not changed.
- The practice project's own `git log` shows a commit that went through the hook `init` wrote.
- The roadmap says the third step exists and how a feature uses it, and the orchestrator has been
  told.

## In scope / Out of scope
- In: `scripts/practice-lib.mjs` (pure: the layout of the folder, the environment of every child
  process, the journey as a list of named steps, the comparison of his real home before and
  after, the record line), `scripts/practice-lib.test.mjs`, `scripts/practice.mjs` (the command:
  `setup` and `run`), this document, and the roadmap's entry for the third step.
- In, on his word only: creating the practice folder on this machine, at the place he chooses.
- Out: everything under `bin/` and `evals/`. In particular `bin/check.mjs`,
  `bin/lib/gate-lock.mjs`, `bin/js-harness.mjs`, `bin/sessions.mjs`, `bin/lib/sessions.mjs` and
  `bin/lib/manifest.mjs`, which `feat/gate-lock` is changing. The plan needs none of them.
- Out: `package.json`. A `practice` script beside `e2e` and `sandbox` would be natural, and it is
  left for the merge, so that this branch shares no file with another one.
- Out: repairing what the practice run meets. Defects are written under "Met on the road" and
  reported; each is repaired by its own feature, which then adds its step to the journey.
- Out: his real home (`~/.claude`, `~/.codex`, `~/.js-harness`) and the command on his PATH.
  Nothing here writes to them, and the command checks that after every run.
- Out, for now: a live Claude Code or Codex session opened inside the practice project. See "Not
  in this feature".

## Constraints
- Everything the practice writes lives under one folder — because the rule of this repository is
  that what the harness writes outside it can be undone exactly, and here the undo is: delete
  that folder.
- The practice never uses his real home or the command on his PATH — because both are shared with
  every session and every project of his on this machine; a version proven through them would
  already have reached his projects.
- The harness reaches the practice project only by `install`, `init`, `sync` and `uninstall`,
  run through the installed command — because a file copied or edited by hand there would prove
  the hand, not the harness.
- The command refuses a folder it did not create — because it deletes and rewrites inside it; it
  recognises its own by a marker file written at `setup`.
- Zero dependencies, plain Node, like `scripts/e2e.mjs` — because it runs with what the machine
  already has.
- The unit tests of the pure part start no process — because the gate stands within two minutes
  of its bound (`docs/ROADMAP.md:652-653`) and must not grow.
- Never run while a gate runs — because the run packs and installs the package with npm, and two
  heavy runs at once made a gate time out (`docs/ROADMAP.md:341-344`). Until the gate has its
  lock, "Gates" in `js-harness sessions` is read once before starting, and never again and again
  while a gate runs: the read is load too (Progress, the orchestrator's notice of 2026-10-10).

## Design

### Which copy of the harness runs: the question that shapes everything
Nothing of the harness is copied into a project. The hook `init` writes, the `SessionStart`
entry `install` registers (`js-harness doctor --hook`, `bin/lib/manifest.mjs:145-149`) and every
command the skills name all call the `js-harness` found on PATH. So a `git commit` in a project
tests the copy on PATH, whatever copy ran `init`.

This machine has one PATH and one home, shared with his projects. Two roads follow:

- Use them. Then a version is "proven in practice" only after `main` is merged and the global
  command is brought up to it, which is a change on his machine every time, and from that moment
  the hook of every project of his already runs the new copy. The practice project would not come
  before his projects; it would only be looked at first.
- Give the practice its own. The candidate (the checkout the command is run from: a feature
  branch before its merge, or `main`) is packed with `npm pack` and installed with the real npm
  into a folder of the practice (`npm install -g --prefix`), as `scripts/sandbox.mjs` already does
  in a temporary folder. Every process the command starts gets that folder first on its PATH and
  `JS_HARNESS_HOME` pointing at a home of the practice. `install` then writes there (`--home`,
  else `JS_HARNESS_HOME`, else the OS home: `bin/install.mjs:19-22`, and the same precedence in
  `sync`, `uninstall`, `status`, `doctor` and `check`), and the hook finds the candidate.

The second is the design. It proves a feature before its merge, changes nothing of his, and
makes the first road's mistake impossible rather than forbidden.

### The folder
```
<root>\              the one folder; deleting it undoes everything
  practice.json      the marker: made by setup, when, from which commit
  project\           the practice project: its own git repository, no remote
  prefix\            where the candidate is installed
  home\              the practice's home: .claude, .codex, .js-harness
  releases\          the packed candidate
  npm-cache\         npm's cache and logs, which it would otherwise keep under his home
  record.jsonl       one line per run
```

The project is small and real: a `package.json` with a `test` script, one module and its test
(`node --test`, seconds), a README. It needs a test because `check` in a project runs the
sensors `package.json` declares, and with none it only prints "no sensors declared"
(`bin/check.mjs:118-143`): a commit that should be refused could not be tried.

### The command
`node scripts/practice.mjs setup --root <dir>` creates the folder. It refuses a folder that
exists, a place inside a git repository, and a place inside his home.

`node scripts/practice.mjs run --root <dir>` runs the journey and exits 0 only if every step
passed and his real home is unchanged. There is no default root: a path that exists only on this
machine does not belong in the code.

### The journey
Each step is named, and prints PASS or FAIL with its evidence.

1. Hash what the harness owns in his real home: `~/.js-harness/manifest.json`, the four
   `SKILL.md`, `~/.claude/settings.json`, `~/.codex/hooks.json`.
2. Pack the candidate and install it into `prefix\`.
3. `js-harness install`: the manifest, the four skills and one `SessionStart` entry per host are
   in `home\`.
4. In the project. Not yet initialized: `js-harness init`. Already initialized, which is every
   run after the first: `js-harness status`, then `js-harness sync`. That second branch is what a
   temporary fixture cannot give: the new version arriving at a project that already has the
   harness, as it will arrive at his.
5. A commit that should pass goes through the hook, and exists afterwards.
6. A commit that should be refused (the project's test broken on purpose) is refused; the file
   is restored.
7. `js-harness uninstall` in the project removes what `init` wrote and nothing of the project's
   own; `init` again leaves it ready.
8. `js-harness uninstall --global` leaves `home\` as it was before step 3; `install` again.
9. The hashes of step 1 are the same. If not, the run fails, whatever else passed.
10. One line is appended to `record.jsonl`: the date, the candidate's branch and commit and
    whether its tree was clean, each step's result.

Step 10 records the commit because the product cannot: the version reads `0.1.0` in every copy
(`package.json:3`), so `status` would call two different copies the same.

A feature that changes what a project receives adds its own step, with its test, in its own
branch: the gate lock, "two `check` at once in the practice project"; the session board,
"`sessions --json` exits 0 in a project that is not this one". The journey so becomes the list of
what was once proven as installed, run again on every candidate.

### What it does not prove
- That a host loads the skills or runs the `SessionStart` entry: no Claude Code or Codex session
  is started. See "Not in this feature".
- The command on his PATH: that one is the pnpm global copy, and the practice has its own.
- codegraph's telemetry and update check: they are switched off in the practice (`DO_NOT_TRACK=1`
  on every process, see Progress), where a project of his has them as he set them.
- macOS and Linux: it runs on this machine.

### Not in this feature
A live session inside the practice project is the proof the session channel and the rule
hierarchy will need, since most of what they ship is text a host loads. It is not designed here:
it spends his plan on every run, and it needs a choice between two roads, his real home (then
the machine's install has to be the candidate) or a sandbox of the host's own home
(`evals/home.mjs` builds one for the evals; whether a host session started that way loads the
practice's skills is not known). It is decided when the first feature that needs it is planned.

## Met on the road
Read in the code, not run, unless it says so. Reported to the orchestrator; none is repaired here.

- Known, `odd/tasks/session-board.md:1183-1198`: `install` checks no argument. Only `--home` is
  read (`bin/install.mjs:19-22`); `sync`, `uninstall`, `init` and `status` refuse an unknown flag,
  `install` does not.
- Known, `odd/tasks/session-board.md:1204-1215`: `upgrade` asks a registry the package is not on
  and stops (`bin/update.mjs:203-206`). `upgrade --source <folder of tarballs>` is the road that
  works, and it is the one `scripts/e2e.mjs` proves.
- Known, same entry: every copy reads `0.1.0`.
- New, checked: the hint printed when a project's pin differs names
  `github:jsaristi/js-harness#v<pin>` (`bin/install.mjs:213`), and the repository has no tag
  (`git ls-remote --tags origin | wc -l` prints 0). The command it suggests cannot work.
- New, assumed until the first run: `init` creates `.codegraph/` and writes no `.gitignore`
  (`rg` in `bin/lib/project.mjs`: no hit), so a project would show that folder as untracked.
  The writer of T2 read that codegraph writes its own `.codegraph/.gitignore` (`*`,
  `!.gitignore`), which keeps the index out of a commit but still leaves `?? .codegraph/` in
  `git status`.
- New, assumed until the first run: the hook depends on the PATH of whatever starts git. From a
  program that does not carry the shim's folder, a commit would fail with a "not found" from the
  shell and not with a message of the harness.
- Not a defect, a hazard for this command: `sync`, `uninstall` and `status` run outside a git
  repository act on the machine's home (it is in the usage text). The command always passes
  `--cwd`, and sets `JS_HARNESS_HOME` on every process it starts.

## Constraints on the work
- Test first, runner `node --test`, for the pure part. The command itself is proven by its run.
- The writer does not commit: the parent commits, one work unit at a time, and only when "Gates"
  in `js-harness sessions` reads `none running`.

## Effort
medium

## Ask me before
- Creating the practice folder, and where. Recommended: `D:\js-harness-practice`, beside
  `D:\js-harness` and `D:\js-harness-worktrees`: outside the repository, outside his home, on the
  drive where the work is, with a short path.
- Push, pull request, merge.
- A live session in the practice project: it spends his plan.

## Delivery
Strategy: `ask-on-risk`. Forecast about 600 authored lines: the pure part about 150, its tests
about 200, the command about 250. Measured after T1: the pure part is 275 lines and its tests
395, so the forecast for the whole is now about 950. The code was not cut to fit: 395 of the 670
are tests, and the two slices stay as planned. Measured after T2: the command is 509 lines, twice
its forecast, because each of the ten steps states what it expects and prints its evidence; the
whole is about 1,230 lines with the two library changes of T2. That is over the budget of about 400, so two slices stacked to
`main`, the form the session board and the watchdog used: slice 1 is this document, the pure part
and its tests; slice 2 the command, the first run's record and the roadmap entry. Each code slice
gets its gentle-ai review and then its Codex review, whose cost the orchestrator admits under
the charter (`docs/ROADMAP.md:736-741`).

Cost, said first: about six gates of this repository (one per commit, 8 to 18 minutes each),
taken in turns with `JH 1`, never two at once; two Codex reviews; no model spend in the practice
run itself.

## Tasks
- [x] T0 This document, the plan put to Sebastián, his yes and the place of the folder — route: inline
- [x] T1 `scripts/practice-lib.mjs` and its test: the layout from a root, the environment of a child process (the practice's prefix first on PATH, `JS_HARNESS_HOME`, never his home), the refusals of `setup`, the journey as named steps, the before-and-after comparison of his real home, the record line — route: delegated writer (two non-trivial files)
- [x] T2 `scripts/practice.mjs`: `setup` and `run` over the pure part, using `scripts/lib.mjs` for npm — route: delegated writer (reading `scripts/e2e.mjs`, `scripts/sandbox.mjs` and `scripts/lib.mjs` prepares the write)
- [x] T3 On his word: the folder created where he chose, the first run, its output recorded here, and what it met reported to the orchestrator — route: inline
- [ ] T3b Accepted follow-ups of the two reviews, test first: of slice 2, `R3-failure-paths-unproved`, `R3-setup-gitroot-fail-open`, `R3-setup-root-is-file`, `R3-git-variable-list-partly-asserted`; of slice 1, `R3-recordline-partial-ok`, `R3-gitroot-assertion-vacuous`, `R3-purity-cwd` (what each asks is under Progress) — route: delegated writer (the library, its test and the command)
- [ ] T4 The roadmap says the third step exists and how a feature adds its step; the orchestrator is told, so the four features put the run in their contracts — route: inline

## Progress
- 2026-10-10: session opened by Sebastián's paste of the orchestrator's opening prompt. Worktree
  and branch created from `origin/main` (`20911ea`). Read: `docs/ROADMAP.md:310-459` and
  `:640-790`, `odd/tasks/session-board.md:1183-1231`, `scripts/e2e.mjs`, `scripts/sandbox.mjs`.
  One read-only explorer mapped `install`, `init`, `check`, `sync`, `status`, `uninstall`,
  `update` and `upgrade` with `path:line`; the parent checked two of its claims by reading
  (`bin/lib/project.mjs:309-310`, `bin/install.mjs:19-22`). Nothing was run except
  `contract template` and `sessions`, both read-only. Nothing built, no folder created outside
  the repository.
- 2026-10-10, failed: the notice "opened" sent to the orchestrator with `SendMessage` was held by
  the receiving session and expired undelivered (the two sessions run in different permission
  modes). The orchestrator's relief file shows it saw this session on the board anyway.
- 2026-10-10, for the first run: the board finds a gate by its command line, a `node` process
  that runs `check` (`bin/lib/sessions.mjs:537-553`). The practice project's hook is one, in a
  folder that is no worktree of this repository, so the watch will report "a gate in an unknown
  worktree" for some seconds (`odd/tasks/session-board.md:1053-1058`). The orchestrator is told
  before T3.

- 2026-10-10: this document committed as `ac2c18a`; gate green (`PASS tests npm run test
  passed`), review not due (`passive risk, 1 path, 256 lines`). No gate was running when it
  started.
- 2026-10-10, his decision. The plan was put to him in this chat in plain words: the problem, the
  one folder with its own copy of the harness and its own home, the journey, the check on his
  real home, what it does not prove, the cost, and the files touched. The question named what a
  yes covers (the plan, and the folder at `D:\js-harness-practice`, created when the command is
  ready) and what it does not (push, pull request, merge, his home, his PATH, a session opened in
  the practice project). His answer: "Si". T0 closed. Read of the board at that moment: context
  of this session 172k tokens, 36%.
- 2026-10-10, what the real `codegraph init` writes outside a project, the question this document
  had left for before the first run. Read in the code of the installed tool
  (`@colbymchenry/codegraph`, under `C:\nvm4w\nodejs\node_modules`), nothing run. `init --yes`
  creates `.codegraph/` in the project and indexes it (`bin/codegraph.js`, `runInit`); it
  installs git hooks in the project only where its file watcher is disabled, which is WSL or
  `CODEGRAPH_NO_WATCH` (`installer/index.js`, `offerWatchFallback`). Outside the project it
  writes under the user's home, `~/.codegraph`: a telemetry queue and an update-check cache.
  Both are off with `DO_NOT_TRACK=1` (its README, "Telemetry"; `upgrade/update-check.js:103`).
  The registry of daemons there is written by its MCP server, not by `init`: the `init` of this
  worktree, run today, left `~/.codegraph/daemons` with its date of 2026-10-08. So every process
  of the practice gets `DO_NOT_TRACK=1` and nothing is written outside the folder; the harness
  itself does not read that variable (`rg -c 'DO_NOT_TRACK|CODEGRAPH_TELEMETRY' bin scripts`:
  no hit). The question to Sebastián this document kept for this case is not needed and was
  removed from "Ask me before". The writer of T1 was told while it worked.
- 2026-10-10, T1 written by a delegated writer, test first; route as planned. Its handoff, with
  what the parent read itself (the whole of `scripts/practice-lib.mjs`):
  - Done: `scripts/practice-lib.mjs` (275 lines; imports only `node:path` and `node:crypto`) and
    `scripts/practice-lib.test.mjs` (395 lines, 38 tests, no process, no disk, no clock).
    Exports: `practiceLayout`, `shimDir`, `installedBin`, `childEnv`, `isInside`, `setupRefusal`,
    `markerContent`, `ownsFolder`, `realHomeFiles`, `contentHash`, `compareSnapshots`, `JOURNEY`,
    `adoptionCommands`, `recordLine`, `parseArgs`, `USAGE`.
  - Checked: red first (`ERR_MODULE_NOT_FOUND` for the library, `tests 1 / pass 0 / fail 1`),
    then `node --test scripts/practice-lib.test.mjs`: `tests 38 / pass 38 / fail 0`, 0.72 s.
    `contract check` of this document: PASS.
  - Not checked: no test was broken on purpose to see it fail, only the missing import was seen
    red. Nothing against the real disk: the layout npm really gives the shim, his real manifest,
    the effect of `DO_NOT_TRACK` on codegraph. Those are T3's first run.
  - Failed: one run of the tests (0.87 s, no process started) happened while a gate of
    `session-board` had just started. The writer had chained the run after a command that only
    printed "Gates"; printing is not a guard. Its later runs tested for the text `none running`.
    And gates ran back to back for more than thirty minutes, which killed its first wait.
  - Three things wider than its brief, kept, each for its reason. `childEnv` drops every
    `JS_HARNESS_*` variable of the caller, not three: `JS_HARNESS_CHECK_INNER=1` makes `check`
    skip a project's sensors (`bin/check.mjs:617`), and the commit that must be refused would
    pass. `realHomeFiles` also takes the paths under the manifest's `entries` and `optional`, and
    leaves out `.js-harness/doctor.json`, which every session start rewrites. `setupRefusal`
    refuses a root or a home that is not an absolute path.
  - The parent's brief was wrong in one fact: the machine manifest records absolute paths
    (`bin/lib/manifest.mjs:623`), not paths relative to the home. The library takes both.
  - Open, for T2: resolve `--root` to an absolute path and through links before judging it
    (`isInside` compares spellings); hash the same list of files before and after; read
    `JS_HARNESS_E2E_NPM_CLI` from the caller's environment, since `childEnv` drops it.
- 2026-10-10: slice 1 committed as `d0bcb16`; gate green, no gate was running when it started
  (`board free after 0s`). After the gate an untracked `Microsoft/Windows/PowerShell/
  ModuleAnalysisCache` sat in the worktree root, written at 03:45 while the gate ran: the
  follow-up `odd/tasks/codex-review-lean.md:1296-1299` (some test starts PowerShell without
  `LOCALAPPDATA`), seen now for the fourth time. Removed by hand, not committed. The gate's
  review row and `gentle-ai review assess --base-ref ac2c18a --committed-only` both read the
  candidate as unassessable (`risk: high`, `review_due: true`) because of untracked files: that
  folder and `scripts/practice.mjs`, which the writer of T2 had begun. The review of slice 1
  waits for that writer to finish, so that nothing moves under it.
- 2026-10-10, a notice from the orchestrator, carried by Sebastián because this session holds
  its messages too. A claim until checked; the one thing checked: both worktrees it names still
  show the commits it names (`session-board` at `20911ea`, `gate-lock` at `c623c4c`). What it
  says: the gate failed three times that night at its bound of 1,200 s for another session, and
  a board read beside a gate is load; the writer of T1 polled the board every 60 s. The rules
  it sets, taken as written: while any gate runs, no test run and no board read; to wait for a
  gate, wait on its process id; no gate and no test run from this session until the
  session-board record and `JH 1`'s T1b are both committed. The writer of T2 was told at once
  to run no test and read no board; the library test it changed is run by the parent in its
  turn. This replaces the constraint above that told a session to read "Gates" before every
  run: reading it repeatedly is itself the load.
- 2026-10-10, T2 written by a delegated writer that ran nothing but `node --check` and the
  wrong-argument calls; route as planned. Its handoff, with what the parent read itself (the
  whole of `scripts/practice.mjs` and the diff of the library):
  - Done: `scripts/practice.mjs` (509 lines): the project's files, the seeds of the practice
    home, the child-process helpers, one function per id of `JOURNEY`, `journey`, `setup` and a
    guarded `main`. Two library changes: `practiceLayout` gains `npmCache`, and `childEnv` also
    drops the variables that bind git to one repository (`GIT_DIR`, `GIT_WORK_TREE`,
    `GIT_INDEX_FILE` and the rest of the list `bin/check.mjs` keeps), because started from a hook
    the practice's `git init` and commits would act on the repository the command was started
    from.
  - Checked: `node --check` on the three files, exit 0. `node scripts/practice.mjs` with no
    argument, `bogus`, `run`, `run --root`, `setup --help`, `run --root x extra`: exit 2 each,
    usage printed, nothing created. `contract check`: PASS. The parent confirmed by reading that
    `check` prints its rows as `PASS  <name>  <detail>` (`bin/check.mjs:591-595`), which two
    steps rely on.
  - Not checked: the library tests after its changes (one test edited, one added:
    `childEnv drops what would bind git to another repository, and keeps the rest of what git
    reads`); the parent runs them in its turn. And the whole journey: every expectation of a
    step is read from the code of the harness or assumed, none was run. The assumptions the
    first run settles: that npm takes the quiet flags on `pack`; that `codegraph init` succeeds
    and returns; that git's shell finds the shim through PATH and the hook's output reaches the
    captured streams; that `npm run test` works inside `check`; that `.codegraph` can be removed
    on Windows.
  - Failed, said first to Sebastián: a diagnostic command of the writer (`env | rg`) printed
    the value of the environment variable `JS_HARNESS_EVAL_OAUTH_TOKEN` into its own tool
    output, which is the transcript of this session's sub-agent. It was written to no file of
    the repository and is not repeated anywhere. Whether the token is replaced is his decision.
    `childEnv` drops that variable from every process of the practice. The writer also wrote
    and removed one scratch file under `/tmp`, outside its surfaces.
  - Decisions beyond its brief, kept: `install` and `uninstall --global` get `--home` as well
    as `JS_HARNESS_HOME`; `install` runs twice in its step, to show a second adds no entry; the
    refused commit must show a `FAIL  tests` row, so that a refusal for another reason does not
    pass; the project's `uninstall` is judged by `git status` before and after; a skipped step
    prints `SKIP` and is left out of the record; `setup` creates only the root.
  - Open: `check` makes and removes a throwaway home in the OS temporary folder while it runs
    a project's sensors (`bin/check.mjs:241-244`): a passing write outside the practice folder
    that the harness does in every project, so "nothing outside the one folder" holds for what
    remains, not for that moment.
- 2026-10-10, a second notice from the orchestrator, carried by Sebastián, correcting the first:
  the session-board record gets no gate for now (it failed a fourth time at the bound and
  passed to the session `JH 3 · cierre de session board`), so this session no longer waits for
  that worktree. Its turn comes when process 21584 (`JH 1`'s gate, started 04:22:12) has ended
  and the process list shows no `check.mjs` alive; the wait is on the process id, not on reads
  of git or of the board. Checked: `tasklist /FI "PID eq 21584"` showed that `node.exe` alive
  at 04:32. The wait on the two git heads was stopped, and one `Wait-Process -Id 21584` waits
  instead, followed by one read of the process list.
- 2026-10-10, the order of this session's turn, changed for a reason. T2 has never run, and a
  commit costs a gate that others wait for. So the first run comes before the commit of slice
  2: `setup` and `run` at `D:\js-harness-practice` from the uncommitted tree (the record says
  `dirty`), what it shows is fixed, and slice 2 is committed once, working. A run from the clean
  commit follows for the record. The reviews do not hold the turn either: a review starts four
  reviewer processes, which is load beside a gate, so each runs in a window with no gate, and
  the review of slice 1 runs from a detached worktree at `d0bcb16`, so that later commits do
  not move its candidate.
- 2026-10-10, this session's turn: process 21584 ended at 04:42:24 and the one read of the
  process list after it said `no check.mjs alive`.
  - `node --test scripts/practice-lib.test.mjs`: `tests 39 / pass 39 / fail 0`, 0.25 s. This is
    the first green run of the two tests T2 changed; their red was not seen by the parent.
  - `node scripts/practice.mjs setup --root D:\js-harness-practice`: exit 0. The folder exists,
    on Sebastián's yes of the same day: the marker (`from feat/practice-project d0bcb16`), the
    project with one commit, the stand-in home with its two seeded host files, and the empty
    `prefix`, `releases` and `npm-cache`. To undo everything: delete `D:\js-harness-practice`.
  - `node scripts/practice.mjs run --root D:\js-harness-practice`, the first run, from the
    uncommitted tree: exit 0, `10 of 10 steps passed; real home: unchanged`, with nothing to
    fix. What each step printed, shortened:
    - real home, before: `8 files of C:\Users\Oficina hashed, 8 of them present`.
    - pack and install: `js-harness-0.1.0.tgz installed; the command on the practice PATH is
      D:\js-harness-practice\prefix\js-harness`.
    - `install`: the manifest and four skills in the practice home; each host file holds its
      seeded entry and one `js-harness doctor --hook`, after two installs.
    - `init`: `wrote harness.json`, `wrote AGENTS.md`, `wrote .git/hooks/pre-commit`, `ran
      codegraph init`; `git status --porcelain` then shows `?? .codegraph/`, `?? AGENTS.md`,
      `?? harness.json`.
    - the commit that passes: `HEAD 6d596bd -> 9966f1e`, and the hook printed `PASS  budget
      122 estimated tokens (budget 1500)`, `PASS  contracts  no contracts under odd/tasks`,
      `PASS  tests  npm run test passed`.
    - the commit that must be refused: `git commit exited 1 and HEAD stayed at 9966f1e`, with
      `FAIL  tests  npm run test exited 1`; the module restored, no tracked file differs.
    - `uninstall` in the project: the hook, the project manifest, `harness.json`, `AGENTS.md`
      and `.codegraph` gone, `git status` showing only ` D AGENTS.md` and ` D harness.json`;
      `init` again, no tracked file differs.
    - `uninstall --global`: no manifest and no skill left in the practice home, both host
      files byte for byte as seeded; installed again.
    - real home, after: `the same 8 files of C:\Users\Oficina hashed again: none differs`.
  - A second run at once, to take the other branch of the fourth step, the one every later
    run takes: exit 0, 10 of 10. `js-harness status` printed `pinned version: 0.1.0`, `running
    version: 0.1.0`, `this clone: set up`, `pin and running version: match`; `js-harness sync`
    printed `up to date at 0.1.0`. The practice project's `git log` now reads `afed3a6` and
    `9966f1e` (`practice: run of js-harness d0bcb16`), both made through the hook `init` wrote,
    over `6d596bd`, and `record.jsonl` holds two lines, both `dirty`.
  - What the two runs settled of what was assumed: git's shell finds the candidate through
    PATH on Windows and the hook's output reaches the caller; `npm run test` works inside
    `check` in a project; npm takes the quiet flags on `pack`; `codegraph init` returns, and
    `.codegraph` can be removed on Windows. And of "Met on the road": after `init`, a project
    does show `?? .codegraph/`, in every run.
  - Not checked: whether `DO_NOT_TRACK=1` kept codegraph from writing under `~/.codegraph`.
    Every session on this machine appends to that queue, so its date proves nothing either
    way; it rests on the reading of codegraph's code. How long a run takes was not measured.
  - Failed: nothing.
- 2026-10-10: slice 2 committed as `0df7f67`; gate green (started 04:44:37 with no `check.mjs`
  alive, ended about 05:01), tree clean afterwards. The gate's rows: `review  medium risk, 4
  paths, 696 lines: review due (slice_budget_reached)` and `codex-review  no Codex review record
  for 1 of 1 code commit since origin/main`.
- 2026-10-10, the gentle-ai review of slice 2 (`d0bcb16..0df7f67`, lineage
  `review-046ca6f260decbfb`): assessed medium, one lens (`review-reliability`), consent given
  under the standing grant, approved, acknowledged (`authority: burned`). Outcome for the task:
  granted, approved. Four findings, all informational, all accepted as T3b because each is true
  and small:
  - `R3-failure-paths-unproved` (warning, `scripts/practice.mjs:408-423`): the command has no
    automated test, so nothing proves that a failed step makes the run exit non-zero, that the
    later steps are skipped, or that the comparison of the real home and the record still run.
  - `R3-setup-gitroot-fail-open` (warning, `scripts/practice.mjs:449`): any non-zero exit of
    `git rev-parse --show-toplevel` is read as "not in a repository", and git also exits
    non-zero inside a repository it refuses to read.
  - `R3-setup-root-is-file` (suggestion): a root that is an existing file makes the git child
    fail first, and the message blames git.
  - `R3-git-variable-list-partly-asserted` (suggestion): the test feeds 5 of the 15 names.
- 2026-10-10, failed, by this session: that review's reviewer ran beside a gate. One read of
  the process list at about 05:02 said `no check.mjs alive`; `JH 1`'s gate (pid 14664) started
  at 05:03:00, and the reviewer ran from then for some minutes. A later command of this session
  printed `ALIVE 14664` and went on all the same, because the read was chained with `;` and
  not made a condition: it created the detached worktree `D:\js-harness-worktrees\
  practice-project-s1` at `d0bcb16` and ran `gentle-ai review assess` there (medium, 3 paths,
  740 lines, review due). Stopped there. A read that is not a condition is no guard: the same
  mistake the writer of T1 made, now made twice, so the wait and the guard go in one command
  from here on. The real control is the gate lock `JH 1` is building.
- 2026-10-10, the gentle-ai review of slice 1 (`ac2c18a..d0bcb16`, lineage
  `review-81555b47f864e932`), run from the detached worktree so that `0df7f67` did not move its
  candidate: assessed medium (3 paths, 740 lines), one lens (`review-reliability`), consent
  under the standing grant, approved, acknowledged (`authority: burned`). The guard held this
  time: the first attempt to start the reviewer found `JH 1`'s gate alive (pid 15068) and
  started nothing; the second waited on that process, saw `no check.mjs alive at 05:36:32`
  and ran until 05:38:12. Four findings, all informational:
  - `R3-childenv-git-vars` (warning): `childEnv` passed git's repository variables through.
    Already closed by slice 2 (`0df7f67`), which the reviewer of slice 1 could not see.
  - `R3-recordline-partial-ok` (warning, `scripts/practice-lib.mjs:238-243`): `recordLine`
    calls a run ok when the steps it was handed are all ok, without asking whether they are
    the whole journey. Accepted: the line is the lasting proof of a run.
  - `R3-gitroot-assertion-vacuous` (suggestion, `scripts/practice-lib.test.mjs:151-155`): the
    test of the refusal inside a repository cannot fail on the second name, since the git root
    is a prefix of the root. Accepted.
  - `R3-purity-cwd` (suggestion, `scripts/practice-lib.mjs:85-89`): on Windows a root with no
    drive letter passes `isAbsolute` and is then judged against the current drive, so the
    result depends on where the command was started. Accepted: `setupRefusal` refuses it.
- 2026-10-10, what T3b is, so that it can be handed to a writer as it stands. All in
  `scripts/practice-lib.mjs`, `scripts/practice-lib.test.mjs` and `scripts/practice.mjs`, test
  first, and still with no process and no disk in the tests:
  1. The loop that walks the journey moves to the pure part, taking the step functions as an
     argument, and is tested with steps made for the test: after a step fails the later ones
     are skipped, except the comparison of the real home and the record, and the result says
     the run failed (`R3-failure-paths-unproved`).
  2. `recordLine` says ok only when every step of the journey it is given is there, once, and
     ok (`R3-recordline-partial-ok`).
  3. What git answered about the repository is read by a pure function: a root when it exits
     0, "not in a repository" only when git says exactly that, and anything else is a reason
     for `setup` to refuse (`R3-setup-gitroot-fail-open`).
  4. `setup` judges that the root exists before it starts git (`R3-setup-root-is-file`).
  5. The test of `childEnv` feeds all fifteen names (`R3-git-variable-list-partly-asserted`).
  6. The test of the refusal inside a repository uses a git root that is not a prefix of the
     root (`R3-gitroot-assertion-vacuous`).
  7. `setupRefusal` refuses a Windows root with no drive letter, and the header of the library
     says what the purity covers (`R3-purity-cwd`).
- 2026-10-10: the detached worktree `D:\js-harness-worktrees\practice-project-s1` was removed
  once its review was acknowledged. Scratch files of this session, outside the repository, in
  `D:\js-harness-worktrees`: `pp-step.mjs` (runs one returned review command verbatim) and the
  saved replies `pp-s1-*.json`, `pp-s2-*.json`.
- 2026-10-10, the cut. The board gave this session 340k tokens, 71%, with its limit at 73%, so
  T3b is not started here: the session cuts at this task boundary, both reviews closed, with
  this document committed.

## Next step
T3b, by a delegated writer with the seven points above as its brief (allowed surfaces: the
three files it names; it runs no test and reads no board; the parent runs `node --test
scripts/practice-lib.test.mjs` and `node scripts/practice.mjs run --root
D:\js-harness-practice` in a window with no gate). Then its commit, the gentle-ai assessment
from the boundary `0df7f67`, and the Codex review of the whole range (`node bin/js-harness.mjs
codex-review --base ac2c18a --plan` first, which spends nothing). Then a run from the clean
commit for the record, and T4. Every start of a gate, a test, a review or a run is one command
that first waits on any live `check.mjs` process and starts only when none is left.

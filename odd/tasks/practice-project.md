# Practice project

Locator: `odd/tasks/practice-project.md` · Engram mirror: `odd/practice-project/tasks` · Branch:
`feat/practice-project`, cut from `main` at `20911ea`, merged via `jsaristi/js-harness#52` as
`ca013c2` and `#53` as `df15929`. Session: `JH 2 · proyecto de práctica`; orchestrator:
`JH ORQ · js-harness`.

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
- Out, until the delivery: `package.json`. A `practice` script beside `e2e` and `sandbox` was
  left for the merge, so that this branch would share no file with another one; it went in with
  the delivery, once no open branch changed that file (see Progress, the delivery).
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
"`sessions --json` exits 0 in a project that is not this one"; the session channel, "past the
context pause, `resume --pause` tells a session once, says nothing the second time and nothing
outside a project" (`pause-hook`, 2026-10-12, run before the hashes are compared). The journey so becomes the list of
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
- The writer does not commit: the parent commits, one work unit at a time.

## Effort
medium

## Ask me before
- Creating the practice folder, and where. Recommended: `D:\js-harness-practice`, beside
  `D:\js-harness` and `D:\js-harness-worktrees`: outside the repository, outside his home, on the
  drive where the work is, with a short path.
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
- [x] T3b Accepted follow-ups of the two reviews, test first: of slice 2, `R3-failure-paths-unproved`, `R3-setup-gitroot-fail-open`, `R3-setup-root-is-file`, `R3-git-variable-list-partly-asserted`; of slice 1, `R3-recordline-partial-ok`, `R3-gitroot-assertion-vacuous`, `R3-purity-cwd` (what each asks is under Progress) — route: delegated writer (the library, its test and the command)
- [x] T3c Accepted follow-ups of the review of T3b, test first: `R3-non-error-throw-detail`, `R3-report-throw-aborts-walk`, `R3-recordline-foreign-ids`, `R3-setup-wiring-unproved` — route: inline (three small changes in the library, one call changed in the command, four tests)
- [x] T3d The three findings of the Codex review, test first: the ceiling of git's search kept in the child environment, a root resolved before it is judged, a hook of the machine taken for the one `init` wrote — route: inline (the library, its test, two places of the command)
- [x] T4 The roadmap says the third step exists and how a feature adds its step; the orchestrator is told, so the four features put the run in their contracts — route: inline
- [ ] T5 A step of the journey proves that a host loads what was installed. Added on
  2026-10-13, a gap in shipped behaviour that had no task (`docs/ROADMAP.md`, "Next", the
  defects read on that day, item f). Read on `main` at `f98f478`: the eleven steps of `JOURNEY`
  (`scripts/practice-lib.mjs:450-461`) install, adopt, commit, uninstall and run the pause
  hook's command, and none starts a Claude Code or a Codex session in the practice project;
  the roadmap says so itself ("What the run does not prove"). Such a step spends a model, so
  what it runs and how often is his to approve when it is designed

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
- 2026-10-10, T3b, after the compaction (the summary was checked against this document: same tasks,
  same boundary `ebde271`, tree clean). Route: one delegated writer on the three files, which ran
  nothing but `node --check`; the parent ran everything, each start behind a guard that waits on
  any live `check.mjs` and starts only when none is left (`pp-guard.ps1`, a scratch helper of
  this session outside the repository).
  - What changed, by the seven points: (1) `walkJourney` and `ALWAYS_RUN` in the library, the
    command only prints the lines it is handed; (2) `recordLine` is ok only when every id of the
    journey is among the steps exactly once and every step is ok; (3) `readGitRoot` reads git's
    answer: a root, "no repository" only for git's own two wordings of it (`not a git repository
    (or any ...`), and a refusal for anything else; that one git child is asked with
    `LC_ALL=C`, not every child, because `childEnv` also feeds the hook and the project's
    tests; (4) `setup` calls `setupRefusal` first without git and starts git only when that
    found nothing; (5) the test feeds the fifteen names, written out; (6) the refusal test uses
    `D:/js-harness` against the root `D:\js-harness\practice`; (7) `setupRefusal` refuses, on
    Windows, a root or a home that names no drive and is no network path, and the header says
    what the purity covers.
  - Found by the writer, beyond the brief: `nearestExisting` could hand git a file as its cwd (a
    missing root below a file); it now walks up to the deepest folder. And the header's claim
    about the current directory is conditional on fully qualified paths: `realHomeFiles` uses
    `path.resolve`, which reads the current directory for a manifest path with a drive and no
    separator (`D:x`). Left so; a manifest records absolute paths.
  - RED: the new test file against the library of `ebde271` does not load (`does not provide
    an export named 'ALWAYS_RUN'`); against that library plus empty stubs for the three new
    exports, `tests 55 / pass 39 / fail 16`, the sixteen being the new and the changed tests of
    points 1, 2, 3, 4 and 7. The tests of points 5 and 6 pass on the old library too, as they
    should: they tighten a test, not the code.
  - GREEN: `node --test scripts/practice-lib.test.mjs` gives `tests 55 / pass 55 / fail 0`.
  - Seen with the real command, creating nothing: `setup --root` on an existing file prints
    `already exists: setup only creates a new folder` and exits 1 without asking git; on a
    path inside this worktree it prints `is inside the git repository
    D:/js-harness-worktrees/practice-project` and exits 1; and git's real answer outside a
    repository on this machine, `128 fatal: not a git repository (or any of the parent
    directories): .git`, reads as `{"gitRoot":null}`.
  - A run from the working tree: exit 0, 10 of 10, `real home: unchanged`, third line of
    `record.jsonl` (`ok true`, `ebde271`, dirty). It took 13 seconds (06:40:30 to 06:40:43),
    the first time a run was measured.
  - Not checked: `setup` to its end with the new order (it would need a second folder on his
    machine); the refusal for a repository git will not read, with a real one.
- 2026-10-10: T3b committed as `d639bdf`; gate green (started 06:41:24 with no `check.mjs` alive,
  ended 06:53:29, twelve minutes), tree clean afterwards.
- 2026-10-10, the gentle-ai review of T3b (`0df7f67..d639bdf`, lineage
  `review-5f95fc5f5a19df44`): assessed medium (602 lines, `slice_budget_reached`), one lens
  (`review-reliability`), consent under the standing grant, approved, acknowledged (`authority:
  burned`). Outcome for the task: granted, approved. Every step ran behind the guard; the
  reviewer ran from 06:54:27 to 06:55:41 with no gate alive. Four findings, all informational;
  the reply carries only their id, place and severity, so what each asks is this session's
  reading of the code at that place:
  - `R3-non-error-throw-detail` (suggestion, `scripts/practice-lib.mjs:331`): a step that throws
    something that is no error leaves a failure with no reason.
  - `R3-report-throw-aborts-walk` (warning, `scripts/practice-lib.mjs:334-335`): a `report` that
    throws ends the walk, so the comparison of the real home and the record do not happen.
  - `R3-recordline-foreign-ids` (suggestion, `scripts/practice-lib.mjs:361-362`): a line with
    the whole journey and one more step, from elsewhere, still says ok.
  - `R3-setup-wiring-unproved` (warning, `scripts/practice.mjs:441-453`): that `setup` judges
    first without git and takes git's refusal is wired in the command, where no test reaches.
- 2026-10-10, T3c: the four accepted and done at once, before Codex, so that Codex reads the
  range once in its last shape. Route: inline.
  - What changed: `walkJourney` takes whatever is thrown as the reason (`reasonOf`), does not
    let a throwing `report` end the walk, and returns `unreported`, what the first one said; the
    command prints it and does not exit 0. `recordLine` is ok only with as many results as the
    journey has steps, each of its ids once. `setupRefusalWithGit(facts, askGit)` in the library
    is the order `setup` had inline: `askGit` is called only when nothing else refuses.
  - RED, with only the new export in place: `tests 59 / pass 51 / fail 8`, the three new tests of
    `walkJourney` and `recordLine` and the five whose expected result gained `unreported`. The
    test of `setupRefusalWithGit` was red before that as a file that does not load (`does not
    provide an export named 'setupRefusalWithGit'`).
  - GREEN: `tests 59 / pass 59 / fail 0`. The two refusals of `setup` seen again with the real
    command (an existing file; a path inside this worktree), both exit 1, nothing created. A
    run from the working tree: exit 0, 10 of 10, `real home: unchanged`, 11 seconds.
  - Failed, by this session: the entry of T3b above was written through a shell script that
    ate the backslashes of one path, and `d639bdf` carries it as `D:js-harnesspractice`.
    Corrected here. Text with backslashes goes through the editor from now on, not a script.
  - The guard held: the green run waited on another session's gate (pid 5764) from 06:59:02 to
    07:12:34 and started only then.
- 2026-10-10: T3c committed as `709ba20`; gate green (07:13:22 to 07:25:07). The message file
  was rewritten while the gate ran, because its first writing had failed after the commit was
  started; git reads the file after the hook, and the commit carries the right message. The
  gentle-ai assessment of `d639bdf..709ba20`: medium, 212 lines, `under_budget`, no review due;
  it stays pending in the slice.
- 2026-10-10, the Codex review of the whole range (`node bin/js-harness.mjs codex-review --base
  ac2c18a`, range `ac2c18a..709ba20`, recorded in `.git/js-harness/codex-reviews.jsonl`):
  `gpt-6.1-sol` at high effort, three parts, 1,657 changed lines in 3 files, started with no
  `check.mjs` alive at 07:25:31 and ended at 07:30:00. Spent: 897,955 input tokens (711,296
  cached) and 6,755 output, under the plan's lower figure (1,060,000). Part 2, the tests: no
  finding. Parts 1 and 3: three findings, all P2, all true, all accepted as T3d:
  - `scripts/practice-lib.mjs:108-109`: `childEnv` kept `GIT_CEILING_DIRECTORIES`. Set to a
    repository around the root, it makes git answer "not a git repository" inside it, and
    `setup` would have created the practice in that repository.
  - `scripts/practice.mjs:502-503`: the command resolves the root (`path.resolve`, in
    `throughLinks`) before anything judges it, so `--root \practice` became a path on the
    current drive and the refusal written in T3b never saw it.
  - `scripts/practice.mjs:469-471`: with a `core.hooksPath` in the machine's git configuration
    the practice project inherits it; `init` writes no gate outside a repository, and the
    journey would prove another hook or fail without saying why. Codex proposed a hooks path
    of the practice's own. Not taken as proposed: the harness never changes git's
    configuration (`bin/lib/project.mjs:577-578`), and a practice project configured apart
    would no longer be what a project of his receives. Taken instead: the step says so.
- 2026-10-10, T3d. Route: inline.
  - What changed: `childEnv` drops `GIT_CEILING_DIRECTORIES`. `rootRefusal(root, platform)` is
    the judgement of the root alone, and `parseArgs` applies it to the argument as it was
    typed, so a relative root and a Windows root with no drive are a usage error (exit 2)
    before anything is resolved; a relative root was accepted until now. The step
    `project-adopt` fails with the reason when the hook git would run lies outside the
    practice project, and when the hook does not call `js-harness check`.
  - RED, with `rootRefusal` extracted and nothing else: `tests 62 / pass 60 / fail 2`, the test
    of the ceiling and the test of `parseArgs`. GREEN: `tests 62 / pass 62 / fail 0`.
  - Seen with the real command, creating nothing: `setup --root \practice-nope` prints `names
    no drive` and exits 2; `run --root practice` prints `is not an absolute path` and exits 2;
    and with `GIT_CEILING_DIRECTORIES` set to this worktree, where git itself answers `fatal:
    not a git repository` from `scripts`, `setup --root` on a path under `scripts` still
    prints `is inside the git repository D:/js-harness-worktrees/practice-project` and exits
    1. A run from the working tree: exit 0, 10 of 10, `real home: unchanged`, 11 seconds.
  - Not checked: the new failure of `project-adopt`, which needs a `core.hooksPath` in the
    machine's git configuration (`git config --global --get core.hooksPath` prints nothing
    here), and that is a change on his machine.
- 2026-10-10, T4, the roadmap: the paragraph after item 4 of "The order he asked for" now says
  that the third step exists, what a run does and proves, what it costs, how a feature adds
  its step and what the run does not prove. `main` moved meanwhile (`d3bc399`, two merges of
  documents) and changes other lines of the roadmap, none of that paragraph.

- 2026-10-10: T3d and the roadmap entry committed as `3c71fa0`; gate green (07:33:35 to
  07:44:32), tree clean afterwards.
  - The gentle-ai assessment of `d639bdf..3c71fa0` (T3c and T3d together): medium, 372 lines,
    `under_budget`, no review due. Outcome for both tasks: under budget; Codex read both.
  - The Codex review of `709ba20..3c71fa0` (one part, 100 changed lines in 3 files, recorded):
    `the patch is correct (confidence 0.94)`, no finding; 164,255 input tokens (118,272
    cached), 43 seconds. With the first, every code commit of the branch has its record.
  - The run for the record, from the clean commit: `candidate feat/practice-project 3c71fa0
    (clean): 10 of 10 steps passed; real home: unchanged`, exit 0, 11 seconds (07:45:54 to
    07:46:05). `record.jsonl` holds six lines, the last one `ok: true`, `dirty: false`, node
    `v24.15.0`, `win32`. The practice project's `git log` shows six commits made through the
    hook `init` wrote, from `9966f1e` to `bfce37c` (`practice: run of js-harness 3c71fa0`).
  - `node bin/js-harness.mjs contract check odd/tasks/practice-project.md` prints `PASS` and
    exits 0.
- 2026-10-10, T4 closed: the orchestrator is told in the tail of this session's reply, the one
  road that reached it (a `SendMessage` from this session is held and expires). What it is
  told: the third step exists and how a feature adds its step (the roadmap paragraph); what
  was met on the road (the section above, none repaired here); and what is left for the
  merge.
- Spent by the whole feature: eight gates of this repository with this commit's (11 to 17
  minutes each); four delegated agents (three before the
  compaction, about 600,000 tokens, and the writer of T3b, about 170,000); three gentle-ai
  reviews of one reviewer each; Codex, 1,062,210 input tokens in two runs. No model spend in
  any practice run.
- Slices, as planned under Delivery, for whoever opens the pull requests: slice 1 is
  `ac2c18a..d0bcb16` (this document, the pure part, its tests); slice 2 is `d0bcb16..HEAD`
  (the command, the three rounds of review fixes, the roadmap entry). The fixes of slice 2
  touch the files of slice 1, so the two only merge in that order. The branch was cut at
  `20911ea` and `main` is at `d3bc399`: it needs `main` brought in first; the two change
  different lines of `docs/ROADMAP.md`.
- 2026-10-10: the closing record committed as `87a4511`; gate green (07:46:56 to 07:59:13).
  With it the slice `d639bdf..87a4511` reached the budget (medium, 413 lines,
  `slice_budget_reached`), so gentle-ai reviewed it (lineage `review-a3d4e16319047eb8`, one
  lens, `review-reliability`, consent under the standing grant, the reviewer from 07:59:54 to
  08:00:45 with no gate alive): approved, acknowledged (`authority: burned`). Outcome for T3c
  and T3d: granted, approved. Three findings, all informational, read from their id and place:
  - `R3-project-adopt-hook-refusal-unproved` (warning, `scripts/practice.mjs:288-291`): no
    test and no run proves the failure of `project-adopt` when the hook lies outside the
    project. True, and written above as not checked.
  - `R3-unreported-exit-wiring-unproved` (suggestion, `scripts/practice.mjs:439-440`): that a
    line which could not be printed makes the command exit non-zero is wired in the command.
  - `R3-reasonof-empty-or-throwing` (suggestion, `scripts/practice-lib.mjs:382`): an error
    with an empty message still leaves an empty reason, and turning what was thrown into text
    can itself throw.
- 2026-10-10, decided by this session, his to overrule: those three are not fixed here. Three
  of the four gentle-ai reviews found some wiring of the command that no test reaches, and a
  patch each time moved one more decision into the pure part. With this review and the
  commit that records it, the feature spent nine gates and four gentle-ai reviews, not the
  eight and three counted above. The cause is one: the command
  has no test of its own, only its run. What closes it is a seam, the command's steps and
  its exit code tested against a made-up world (files, git and the harness handed in), and
  that is a piece of design, not a fourth patch at the end of a feature; each patch also
  costs a gate and a Codex record. It is written under "Next step" for the first feature
  that adds a step to the journey, which has to open the command anyway.
- 2026-10-10, the delivery, asked by the orchestrator in a notice Sebastián carried: bring
  `main` in, push, two pull requests in order, no merge.
  - `main` (`d3bc399`, documents only since `20911ea`: `docs/ROADMAP.md` and
    `odd/tasks/session-board.md`) was brought in by merges, not by a rebase: the Codex review
    records name commits, and a rebase would leave every code commit with no record. The
    first slice has its own branch, `feat/practice-project-lib`: `d0bcb16` with `main` merged
    in (`05a68ae`), whose difference from `main` is the three files of the slice. That branch
    was then merged into this one (`99b1d6a`), so the second pull request, opened on top of
    the first, shows its slice alone. Neither merge had a conflict or wrote a line of its
    own; the roadmap's two changes sit in different places. (The branch of the first slice
    did not stay so: see the entry on the push check below.)
  - The `practice` script goes into `package.json` now, in this branch, and not after the
    merge. It was left out so that the branch would share no file with another one; checked
    today, no open branch changes `package.json` (`git diff --stat` of it against `main` is
    empty in the worktrees `gate-lock`, `session-board`, `codex-parity`,
    `subagent-model-routing` and `rule-hierarchy-plan`), so that reason is gone. After the
    merge it would cost a branch, a pull request, a gate and a Codex record of its own for
    one line; here it rides the gate this commit pays anyway and costs one small Codex
    record. `npm run practice -- run --root D:\js-harness-practice` is the same command as
    `node scripts/practice.mjs run --root D:\js-harness-practice` (true only since the next
    commit: see the entry below).
  - Both slices are over the 400 lines a pull request is held to (982 and about 1,500, more
    than half of each tests and this document). They are the two slices planned under
    Delivery and put to him with the plan; they are not cut again, and each pull request
    says so.
- 2026-10-10: the delivery commit is `2333c66`; gate green (14:36:08 to 14:49:35, 807
  seconds).
- 2026-10-10, failed, by this session: `2333c66` says of the new script something that was not
  true on this machine, and it was committed before it was known.
  - What happened: the command that proved the script and the commit were started as one
    chain, and the commit did not wait on the proof. `npm run practice -- run --root
    D:\js-harness-practice` exited 2 with `unknown command --: expected setup or run`. The
    `npm` on this machine's PATH answers as pnpm (it prints `[ELIFECYCLE]`), and pnpm hands
    the `--` on to the script, where npm keeps it. The orchestrator had asked for one gate at
    most; this costs a second.
  - The fix: `parseArgs` drops one `--` before the command, and only there. RED: `tests 63 /
    pass 62 / fail 1`; GREEN: `tests 63 / pass 63 / fail 0`. Seen with both: the `npm` of the
    PATH through `cmd` (10 of 10, exit 0, 35 seconds) and the real npm CLI (`node
    C:/nvm4w/nodejs/node_modules/npm/bin/npm-cli.js run practice -- run --root ...`, 10 of
    10, exit 0, 12 seconds).
  - What stops it again: a proof is a condition of what follows it, never a neighbour in a
    chain. It is the mistake of the reviewer beside a gate, in another place: there a read
    that was not a condition, here a result that was not one.
  - Where it belongs in the harness: with the gate lock and the session channel, as the rule
    that a step which follows a check runs only on that check's exit code; noted for the
    orchestrator.
- 2026-10-10: the fix committed as `d725288`; gate green (14:51:59 to 15:05:14, 795 seconds).
  - The Codex review of `99b1d6a..d725288` (the two delivery commits, 18 changed lines in 3
    files, recorded): `the patch is correct (confidence 0.98)`, no finding; 124,157 input
    tokens (88,064 cached), 28 seconds.
  - The gentle-ai assessment of `87a4511..d725288`: medium, 526 lines (413 of them the
    documents `main` brought), `slice_budget_reached`; reviewed (lineage
    `review-78fd372322596bab`, one lens, the reviewer from 15:07:55 to 15:08:30 with no gate
    alive): approved, acknowledged. Two suggestions, informational, left written:
    `R3-lone-double-dash-message-unasserted` (`scripts/practice-lib.test.mjs:758`: the test of
    a lone `--` asserts that it is an error, not which) and
    `R3-practice-script-wiring-manual-only` (`package.json:18`: that the script reaches the
    command is seen by hand, in the two runs above, and held by no test).
  - The run for the record, from the clean commit: `candidate feat/practice-project d725288
    (clean): 10 of 10 steps passed; real home: unchanged`, exit 0; `record.jsonl` holds nine
    lines.
- 2026-10-10, the push check changed the shape of the first branch. `node bin/check.mjs --push`
  refused `feat/practice-project-lib` at `05a68ae`: `1 of 1 code commit since origin/main have
  no Codex review record`. The record that holds `d0bcb16` is the one of `ac2c18a..709ba20`,
  and a record covers a tip short of its head only when that tip is an ancestor of the head
  (`bin/lib/codex-review-coverage.mjs`, `headsPastTip`); a merge of `main` on top of `d0bcb16`
  is not an ancestor of `709ba20`. A second Codex review of code already reviewed was not
  bought for it. So `feat/practice-project-lib` is `d0bcb16` itself, which the check passes
  (`1 code commit since origin/main, all covered`), and `05a68ae` stays only as an ancestor
  of this branch.
  - What that costs: the first pull request is clean (three files, 982 lines) and behind
    `main` by documents it does not touch. The second, on top of it, shows seven files and
    not six until the first is merged: `odd/tasks/session-board.md` and part of
    `docs/ROADMAP.md` are `main`'s. Once the first is in, `main` is merged into this branch
    once more, a merge that writes no file and pays no gate, and the pull request shows its
    own six.
  - Pushed at 15:23, after waiting on another session's gate from 15:09:36: both branches
    passed the push check (`7 code commits since origin/main, all covered` for this one).
    Pull requests: #52 (`feat/practice-project-lib` into `main`) and #53 (this branch on top
    of it), both mergeable, neither merged.
- The delivery cost three gates where the orchestrator asked for one at most: the delivery
  commit, the fix of the script it had not proven, and this record, which corrects what the
  first of them says of the branch. With them the feature spent twelve gates, five gentle-ai
  reviews and 1,186,367 input tokens of Codex in three runs.

## Next step
Nothing is left to build. Left for Sebastián or the orchestrator, none of it this session's
to do alone:
- For the first feature that adds its step to the journey (the gate lock is the nearest): a
  test of the command itself against a made-up world, which closes the three findings above
  (`R3-project-adopt-hook-refusal-unproved`, `R3-unreported-exit-wiring-unproved`,
  `R3-reasonof-empty-or-throwing`) and the two of the delivery
  (`R3-lone-double-dash-message-unasserted`, `R3-practice-script-wiring-manual-only`).
- The gate lock, the session channel, the rule hierarchy and the gate on GitHub each add
  their step to `JOURNEY` and put `node scripts/practice.mjs run --root
  D:\js-harness-practice` in their contract.
- Open with him, his decision: whether to replace `JS_HARNESS_EVAL_OAUTH_TOKEN`, whose value
  a delegated agent printed into its own output on 2026-10-10.
- Not proven, each needing a change on his machine: `setup` to its end with the order of
  T3b (a second folder), and the failure of `project-adopt` under a machine-wide
  `core.hooksPath`.
A session that takes this up again starts a gate, a test, a review or a run with one command
that first waits on any live `check.mjs` process, until the gate lock is merged.

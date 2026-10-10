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
  lock, "Gates" in `js-harness sessions` is read first, by hand.

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
- Letting the real `codegraph init` run in the practice project, if reading shows that it writes
  anything outside that project. Not known today; looked up before the first run.
- Push, pull request, merge.
- A live session in the practice project: it spends his plan.

## Delivery
Strategy: `ask-on-risk`. Forecast about 600 authored lines: the pure part about 150, its tests
about 200, the command about 250. That is over the budget of about 400, so two slices stacked to
`main`, the form the session board and the watchdog used: slice 1 is this document, the pure part
and its tests; slice 2 the command, the first run's record and the roadmap entry. Each code slice
gets its gentle-ai review and then its Codex review, whose cost the orchestrator admits under
the charter (`docs/ROADMAP.md:736-741`).

Cost, said first: about six gates of this repository (one per commit, 8 to 18 minutes each),
taken in turns with `JH 1`, never two at once; two Codex reviews; no model spend in the practice
run itself.

## Tasks
- [ ] T0 This document, the plan put to Sebastián, his yes and the place of the folder — route: inline
- [ ] T1 `scripts/practice-lib.mjs` and its test: the layout from a root, the environment of a child process (the practice's prefix first on PATH, `JS_HARNESS_HOME`, never his home), the refusals of `setup`, the journey as named steps, the before-and-after comparison of his real home, the record line — route: delegated writer (two non-trivial files)
- [ ] T2 `scripts/practice.mjs`: `setup` and `run` over the pure part, using `scripts/lib.mjs` for npm — route: delegated writer (reading `scripts/e2e.mjs`, `scripts/sandbox.mjs` and `scripts/lib.mjs` prepares the write)
- [ ] T3 On his word: the folder created where he chose, the first run, its output recorded here, and what it met reported to the orchestrator — route: inline
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

## Next step
T0: Sebastián's yes to the plan and to the place of the folder. Then T1, by a delegated writer,
test first.

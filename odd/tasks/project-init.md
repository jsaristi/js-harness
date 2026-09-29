# Project init

Locator: `odd/tasks/project-init.md` · Engram mirror: `odd/project-init/tasks` · Branches:
`feat/project-init` (T1, merged via `jsaristi/js-harness#8`), `feat/project-init-cmd` (T2, merged via
`jsaristi/js-harness#9`), `feat/project-uninstall` (T2e–T3c, merged via `jsaristi/js-harness#10`)

## Objective
Enable js-harness per project, like `git init`: `js-harness init` writes the committed per-project
files, records each one in a project manifest so `uninstall` there restores the repo exactly, and
`sync` moves a project to its pinned version. The TUI offers the commands that fit where it runs,
and `doctor` covers the Codex plugin whose review of each approved slice becomes verifiable.

## Why
Until now js-harness is installed once per machine and does nothing inside a project. The roadmap
decided the two levels (installed per machine, enabled per project) and the per-project files
(`docs/ROADMAP.md`, Decided: "Two levels", "Per project"). Two gaps sit next to it: the Codex
review of each approved slice depends on the agent remembering it, and nothing notices a skip; and
the release source decided for a private repo (a git-spec global install) had never been tried
through this machine's package manager.

## Scope
- In: the git-spec global install (T1); `init`, the project manifest and `uninstall` in a project
  (T2, T3); project `sync` to the pinned version (T4); the context-aware TUI (T5); the Codex plugin
  in `doctor` (T6); a verifiable record of the Codex review (T7); tests and docs for each.
- Out: installing or configuring any other tool (the stack-visibility rule); npm publish (the repo
  is private); Antigravity.

## Constraints
- Zero dependencies; every command keeps `--cwd`/`--home` injectable so tests use fixture folders.
- Everything written outside this repo, and every file `init` writes inside a project, is recorded
  so it can be undone exactly (AGENTS.md, "What good looks like").
- On this machine `npm` on PATH is a pnpm 12.6.0 shim (`C:\nvm4w\nodejs\npm.cmd` is `pnpm %*`), so
  an install command must work through pnpm, not only through the real npm CLI.

## Acceptance criteria (done when)
- The seven roadmap steps under "Project init" hold, each with its evidence recorded here.
- `npm run check` and `npm run e2e` pass.

## TDD
Mode: strict (source: user global config). Runner: `node --test`.

## Delivery
Forecast: well over 400 authored lines across the seven tasks (T2–T5 alone add a command, a
manifest and the TUI changes). Strategy: `ask-on-risk`; chain strategy `stacked-to-main`, chosen
by Sebastián on 2026-09-28: each slice is its own PR against `main`, merged in order. Slices:
1 = T1 (`jsaristi/js-harness#8`, merged as 222110f); 2 = T2 (`jsaristi/js-harness#9`, merged as
b22ecc9); 3 = T2e–T3c (`jsaristi/js-harness#10`, merged as
50cb262).

## T2 design
- `js-harness init [--cwd <dir>] [--home <dir>]` works on the git top-level of `--cwd`. Outside a
  git repository it writes nothing and exits 1 ("not a git repository: run git init first");
  with `harness.json` already present it writes nothing, says so and exits 0 (`sync` is T4).
- `harness.json` (committed): `{ "version": "<running version>" }`, the pin.
- `AGENTS.md` (committed), only when none exists: a short base template with the sections this
  repo's own `AGENTS.md` uses (what the project is, how it works, what good looks like, the
  constraints with their reasons), titled with the folder name.
- The pre-commit gate: `#!/bin/sh` + `exec js-harness check`, written at
  `git rev-parse --git-path hooks/pre-commit`, which honours `core.hooksPath`. When a hook
  already exists there it is kept, and `init` prints how to add `js-harness check` to it. No git
  config is changed: setting `core.hooksPath` would silently disable a project's `.git/hooks`.
- `codegraph init --yes <root>`, spawned the way `bin/lib/stack.mjs` probes tools (one command
  line with `shell: true` on win32), only when `.codegraph/` does not exist. It writes only
  `.codegraph/`, which ignores itself (measured in a scratch repo, codegraph 1.6.0). When
  codegraph is missing or fails, `init` reports it with codegraph's own fix and carries on.
- The project manifest lives at `git rev-parse --git-path js-harness/manifest.json`: per clone
  and never committed, like the hook it records. It lists each file `init` created (path relative
  to the root + sha256), each one it kept and why, and whether it created `.codegraph/`, so T3's
  `uninstall` can restore the repo exactly.
- Exit codes: 0 done (skips are reported, not failures), 1 not a git repository, 2 usage error.

## T2e design
- `harness.json` is written last, after the manifest (which already lists it), so a killed run
  leaves either nothing `init` can trip on or a manifest without `harness.json`, which `init`
  refuses and `uninstall` (T3) clears.
- When this run created `.codegraph/` and the manifest that would record it cannot be written (a
  fresh run's rollback or a codegraph retry), `.codegraph/` is removed too, so nothing unrecorded
  is left; if that removal fails it is named in "could not remove".
- The manifest's temporary file is created exclusively (`wx`, a unique name ending in `.tmp`),
  never through an existing file or link, then renamed over the manifest.
- The pre-commit hook may live in the git dir outside the working tree (a linked worktree, a
  submodule): containment is judged against the real working tree *and* the real git dir and
  common git dir (`git rev-parse --git-dir` / `--git-common-dir`). A file in a git dir outside
  the working tree is recorded by its absolute forward-slashed path with `gitDir: true`. Only
  symlinks below the real base (working tree or git dir) make a hook path occupied, not links
  above it (macOS `/tmp`, a linked drive).
- The manifest gains `dirs`: the shallowest directory of each chain this run created (the hooks
  directory, say), in the same path shape as `files`, so `uninstall` can remove it when empty.
  The manifest's own directory is not listed; `uninstall` removes it when empty.
- An outside hook's reason names a link when a link, not `core.hooksPath`, sends it outside.
- Tests that run real `git` isolate it from the host's global and system config
  (`GIT_CONFIG_GLOBAL` pointed at an empty file, `GIT_CONFIG_NOSYSTEM=1`), and the three
  "could not remove" wordings of a failed `init` are tested.

## T3 design
- Scope by location (Sebastián, 2026-09-28; roadmap, Decided: "Command scope"): `js-harness
  uninstall [--cwd <dir>] [--home <dir>] [--global]`. Inside a git repository whose top-level has
  `harness.json` or a project manifest, it undoes the project; anywhere else, or with `--global`,
  it undoes the machine install exactly as today. Flags are strict like `init`'s: an unknown flag,
  a missing value, or `--global` with `--cwd` is a usage error (exit 2).
- Project undo, from the manifest at `git rev-parse --git-path js-harness/manifest.json`: each
  file in `files` is removed when its content still hashes to the recorded sha256 (CRLF read as
  LF, since git may rewrite line endings on checkout), kept and reported when changed, reported as
  already gone when absent, and never followed through a symlink. Each directory in `dirs` is
  removed when empty. `.codegraph/` is removed when `codegraph.createdDir` is true (never
  `codegraph uninit`: user rule). `kept` entries were never written by `init` and are left
  alone. Last, the manifest and its directory when empty.
- If any removal fails, the manifest stays so a second `uninstall` finishes the job, and the exit
  is 1. A project with `harness.json` but no manifest in this clone (a fresh clone of an
  initialized project) writes nothing and exits 1: those files are committed, so git removes
  them, and `--global` reaches the machine install.
- Exit codes: 0 done (kept files are reported, not failures), 1 a failed removal or no manifest,
  2 usage error.
- An explicit `--cwd` names a project: when it is not an initialized one, `uninstall` exits 1 and
  names `--global`, never falling through to the machine (found by the parent in review of T3).
  With no flags, the same holds inside any git repository that is not an initialized project;
  only outside a git repository does a plain `uninstall` reach the machine (Sebastián,
  2026-09-28, answering R3-implicit-rerun-falls-to-machine). The TUI's uninstall passes
  `--global`.

## Tasks
- [x] T1 A git-spec global install works through the pnpm shim: drop the `prepare` script that
  pnpm refuses for git-hosted packages, prove the install with no extra flag, and leave the global
  js-harness current with `main` — route: inline (`package.json` + one test file, mechanical)
- [x] T2 `init` writes `harness.json`, a base `AGENTS.md` if none exists, the pre-commit gate, and
  runs `codegraph init`, all recorded in a project manifest — route: delegated writer
- [x] T2b Accepted review follow-ups on `init`: roll back a partial run (Codex P1,
  R3-init-partial-failure-unrecoverable); retry a failed `codegraph init` and record `createdDir`
  as observed (Codex P2, R3-codegraph-createdDir-unverified); never write a hooks path outside the
  repository, another drive included (Codex P2, R3-hookspath-outside-repo-written); run codegraph
  with `cwd: root` and `.` so `cmd` cannot expand `%VAR%` in the path (Codex P2); compare the
  manifest path via realpath in its test (R3-manifestpath-assertion-not-realpath); report a
  missing `--cwd` as such (R3-nonexistent-cwd-misreported) — route: the same delegated writer
- [x] T2c Second-round follow-ups on `init`: refuse to re-init over an earlier project manifest
  when `harness.json` is missing (Codex P1, R3-rollback-deletes-preexisting-manifest); check hook
  containment on real paths so an in-repo symlink to outside counts as outside (Codex P1); treat
  `..hooks` as inside (Codex P2); guard the codegraph retry's manifest write
  (R3-retry-manifest-write-unguarded); say when `.codegraph/` survives a rollback
  (R3-nothing-left-behind-overclaims); give an outside hook one manifest shape
  (R3-outside-hook-kept-absolute-path) — route: the same delegated writer
- [x] T2d Final follow-ups on `init`: a path is occupied when `lstat` finds anything, a dangling
  symlink included, and the containment walk resolves dangling links (Codex P1,
  R3-realish-dangling-symlink-escape); `createdDir` is observed on a failed codegraph run too, and
  a run that made `.codegraph/` can be retried (Codex P2); manifest writes are atomic, tmp then
  rename (Codex P2) — route: the same delegated writer
- [x] T2e Follow-ups from the whole-slice reviews, left for after slice 2 (no fourth round):
  write `harness.json` last, so a killed run can be resumed by running `init` again
  (R3-harness-json-written-before-manifest); keep `.codegraph/` ownership when a manifest write
  fails, on a fresh run or a retry (R3-retry-manifest-failure-loses-codegraph-ownership, Codex
  P2); create the manifest's temporary file exclusively, never through an existing link (Codex
  P2); isolate the tests' `git init` from the host's global git config
  (R3-tests-depend-on-host-git-config); test the "could not remove" wording
  (R3-cleanup-clause-partial-branches-untested); say "a link" rather than "(core.hooksPath)" when
  a link sends the hook outside; in a linked worktree or a submodule the hooks path lives in the
  common git dir, outside the working tree, so `init` wrongly skips the gate there
  (R3-worktree-submodule-hook-misclassified-outside; judge containment against the git dir as
  well); count only links below the real root as occupying the hook
  (R3-realish-flags-symlinks-above-repo-root) — route: delegated writer, likely with T3, which
  reads the same manifest
- [x] T2f Accepted review follow-ups on T2e: on `EEXIST` the manifest temp write must not delete
  the entry it did not create (Codex P2, R3-wx-tmp-cleanup-deletes-foreign-file); record the
  shallowest missing directory within the containing git dir, not only within the working tree
  (Codex P2); count symlink hops from the first segment at or below a base, not on exact string
  equality with it (R3-realish-base-detection-equality-only); test a kept hook and a created hooks
  directory in an outside git dir, and a submodule (R3-gitdir-occupied-and-submodule-untested) —
  route: delegated writer, the one that wrote T2e
- [x] T2g Accepted review follow-ups on T2f: a temp file the exclusive write created and then
  failed to fill is still removed; only `EEXIST` leaves the path alone (Codex P2, R3-001); the
  directory climb compares the lexical hooks directory against its base with the same
  realpath- and case-aware containment used elsewhere, so a symlinked root or a win32 case
  difference still records the whole chain (Codex P2, R3-002, a regression from T2f); test the
  case folding and a hooks directory under a linked root where this machine allows it (R3-003)
  — route: the same delegated writer
- [x] T3 `uninstall` in a project restores it exactly — route: delegated writer
- [x] T3b Accepted review follow-ups on T3: before removing a recorded file, check its real
  containment through every ancestor and keep an entry a link moved outside (Codex P1); prune only
  the directory chain init created, never an empty directory added later (Codex P2); only absence
  is benign — any other read or `lstat` failure is a failed removal that keeps the manifest (Codex
  P2); write the manifest in full before renaming (Codex P2); validate every manifest entry's shape
  and containment before any removal, a malformed one being `malformedManifest`, exit 1 (Codex P2,
  R3-manifest-entry-shape-unvalidated); pin the older machine-scope `uninstallMain` tests with
  `--global` so a test run never touches the checkout it starts in
  (R3-uninstall-cwd-dependent-machine-tests) — route: the same delegated writer
- [x] T3c Accepted review follow-ups on T3b: a recorded directory gets the same real-containment
  check a file does, so an empty directory reached through a link to outside is kept
  (R3-dir-prune-follows-ancestor-link); a manifest write that makes no progress fails instead of
  spinning or passing a truncated file (Codex P2, R3-short-write-loop-no-progress-guard) — route:
  inline (one file and its test, both understood)
- [ ] T4 `sync` moves a project to its pinned version — route: delegated writer
- [ ] T5 The TUI offers `init`/`sync`/`status` inside a project and `doctor`/`upgrade` outside one
  — route: delegated writer
- [ ] T6 `doctor` reports the Codex plugin (`codex@openai-codex`): installed, enabled and logged
  in, with its fix command — route: delegated writer
- [ ] T7 The Codex review of each approved code slice leaves a record a check verifies, so a
  skipped review is caught — route: to be decided after exploration

## Progress
- 2026-09-28: T1 measured before any change. `npm i -g github:jsaristi/js-harness` through the
  shim exits 1 with `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`: the git-hosted package "needs to
  execute build scripts but is not in the allowBuilds allowlist". The only build script is
  `prepare` (`git config core.hooksPath .githooks || exit 0`), which exists to wire this repo's
  pre-commit hook for its developers and does nothing for an installed copy. In an isolated pnpm
  global (`PNPM_HOME` and `pnpm_config_global_bin_dir` in the scratchpad):
  `--allow-build=js-harness` still fails the same way (pnpm wants the full git URL with the
  commit), while `--ignore-scripts` installs and the binary runs (`--help`, `progress`).
- 2026-09-28: global js-harness moved to `main` (36f2cee). The old copy in `C:\nvm4w\nodejs`
  (an `npm pack` tarball installed with the real npm CLI, lacking `progress`) came first on PATH
  and would shadow a pnpm install, so it was removed with the real npm CLI (`npm-cli.js rm -g
  js-harness` → `removed 1 package`). Then `npm i -g --ignore-scripts github:jsaristi/js-harness`
  through the shim → `+ js-harness 0.1.0`, exit 0; `which -a js-harness` →
  `C:\Users\Oficina\AppData\Local\pnpm\bin\js-harness` only. The 32 files of `bin/` and
  `AGENTS.md` at 36f2cee match the installed copy byte for byte once CR is stripped (the clone
  checks out CRLF; harmless on Windows, where the `.cmd` shim calls `node` directly).
  `js-harness sync` exit 0, `~/.js-harness/manifest.json` unchanged, exactly one
  `js-harness doctor --hook` entry in each of `~/.claude/settings.json` and `~/.codex/hooks.json`;
  `js-harness doctor --hook` exit 0 with 0 stderr bytes; `js-harness progress` runs.
  pnpm warned it could not remove `pnpm\bin\.pnpm-bin-backup-i7FIYv` (os error 32, a file in use);
  the folder remains and is pnpm's own.
- 2026-09-28: T1 fix. RED: `node --test bin/package.test.mjs` (new: the package declares no
  install-time lifecycle script) failed with `actual: [ 'prepare' ]`, `expected: []`. Replaced
  `prepare` with a plain `hooks` script (`npm run hooks` wires `.githooks` in a fresh clone; this
  checkout already has `core.hooksPath=.githooks`), and said so in `AGENTS.md`. GREEN: the test
  passes; `npm run check` → `PASS budget 1150 estimated tokens (budget 1500)`, `PASS tests`;
  `npm run e2e` → every step PASS. Install proof in an isolated pnpm global, no flag: `pnpm add -g
  git+file:///D:/js-harness#36f2cee` (main, with `prepare`) → `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`,
  exit 1; the same from a scratch clone with this change committed (654e5e1) → `+ js-harness
  0.1.0`, exit 0, and the installed `js-harness progress` runs. Pending to close T1: after the
  merge, `npm i -g github:jsaristi/js-harness` with no flag against GitHub, which also moves the
  global to the merged `main`.
- 2026-09-28: T1 committed as 1c62ea4. Assessed (`--base-ref 36f2cee --committed-only`): risk
  `medium` (`executable_change` on `AGENTS.md`), 121 changed lines, `review_due: false`
  (`under_budget`); reviewed anyway because the slice ships alone as a PR. Native review lineage
  review-687e4003cf557557: consent granted (pre-granted), one lens (reliability), approved and
  acknowledged. Two advisory findings, non-blocking, carried as later work: R3-hook-wiring-now-opt-in
  (WARNING: a fresh clone gets no pre-commit gate until `npm run hooks`, and nothing reports it —
  T2's `init` writes the pre-commit gate, and running it on this repo closes the gap) and
  R3-install-script-list-incomplete (SUGGESTION: add the legacy `prepublish` to the test's list;
  folded into T2's first commit). Codex review (`codex-companion.mjs review --wait --base 36f2cee`):
  the first run could not assess (process creation denied in its sandbox); the retry found "no
  actionable defects", comparing the base and head git objects directly with commands still
  denied, so it did not rerun the tests.
- 2026-09-28: the doc-only commit 53b1d04 made the branch a new candidate; the gentle-ai Stop hook
  asked for it, and native review lineage review-ee44bc207d8e48ad (range `36f2cee..53b1d04`, one
  lens) approved it with the same two advisory findings, acknowledged.
- 2026-09-28: T1 closed. `jsaristi/js-harness#8` merged by Sebastián's go-ahead as 222110f. The
  no-flag install from GitHub works: in the isolated pnpm global, `pnpm i -g
  github:jsaristi/js-harness` over an existing copy → `+ js-harness 0.1.0`, "Done in 10.4s", exit
  0; after `pnpm rm -g js-harness`, a fresh one → "Done in 10s", exit 0. In the real global the
  same command resolves and prints `+ js-harness 0.1.0 ... done`, then never exits (killed at
  120 s and 90 s, debug logging adds nothing), and `pnpm rm -g js-harness` hangs the same way.
  The cause is outside js-harness: two Codex processes run from binaries inside that same pnpm
  global (an interactive `codex` CLI session, PID 15852, and the Codex plugin's `codex
  app-server`, PID 15400), and Windows will not let pnpm move files that are in use. The global
  therefore stays at 36f2cee, whose runtime is identical to 222110f: `git diff --stat 36f2cee
  222110f -- bin ':!bin/*.test.mjs' ':!bin/**/*.test.mjs'` is empty (the merge changed a test,
  docs and a `package.json` script only). With Codex closed, `npm i -g github:jsaristi/js-harness`
  finishes the move. No pnpm process was left running.
- 2026-09-28: T2 implemented by a delegated writer (4+ files: mapping by an explorer first, then
  one writer). New `bin/lib/project.mjs` (`gitTopLevel`, `resolveGitPath`, `agentsTemplate`,
  `runCodegraphInit`, `initProject`) and `bin/init.mjs` (`initMain`, strict flags), each with its
  test file; `init` wired into the dispatcher and its usage; `prepublish` added to
  `bin/package.test.mjs` (R3-install-script-list-incomplete). RED: `node --test
  bin/lib/project.test.mjs bin/init.test.mjs` → `ERR_MODULE_NOT_FOUND ... bin\lib\project.mjs`.
  GREEN: same → 23/23; full `node --test` → `tests 335 / pass 333 / fail 0 / skipped 2` (the two
  symlink tests skip on Windows without developer mode), re-run by the parent with the same
  result; `npm run check` → `PASS budget 1150`, `PASS tests`. ~870 authored lines, over the ~400
  heuristic: one engine, one CLI and tests for the ten cases the design names; not split.
  Writer's own calls, accepted: a manifest-path fallback to `.git/js-harness/manifest.json` if
  `--git-path` fails after the top-level resolved; the wording of kept/failed messages; the
  template's prose. Real run in a scratch repo (real git, real codegraph 1.6.0): outside a repo
  → exit 1; `init --cwd <repo>/src` → `wrote harness.json`, `wrote AGENTS.md`, `wrote
  .git/hooks/pre-commit`, `ran codegraph init`, exit 0, manifest with three sha256 entries and
  `codegraph.createdDir: true`; a second `init` → "already initialized at 0.1.0", exit 0; the
  base `AGENTS.md` measures 122 tokens (`js-harness check` there); committing through the gate
  passed, and a commit with a failing test was blocked (`FAIL tests`, commit exit 1, HEAD
  unchanged).
- 2026-09-28: T2 committed as 9f6ea49. Assessed (`--base-ref 222110f --committed-only`): risk
  `medium` (`executable_change` on `bin/init.mjs`), 945 changed lines, `review_due: true`
  (`slice_budget_reached`). Native review lineage review-608ab3ca807965a1: consent granted
  (pre-granted), one lens (reliability), approved and acknowledged, with five advisory findings
  (two WARNING on partial failure and hooks outside the repo, one WARNING on a test path
  assertion, two SUGGESTION). Codex review (`--base 222110f`, commands allowed this time, its
  test runner hit EPERM): one P1 (a failed step leaves an unrecoverable partial init) and three
  P2 (no codegraph retry, a hooks path on another drive breaks the manifest's relative-path
  contract, `cmd` expands `%VAR%` in the quoted root). All accepted as T2b.
- 2026-09-28: T2b done by the same writer. `bin/lib/project.mjs`: `InitWriteError` and a rollback
  of every file and directory chain the run created when a step after the first write throws;
  `isOutsideRoot` keeps a hooks path outside the repository (another drive included) as `kept`,
  recorded by its absolute path; `initCodegraph` records `createdDir` as observed and is reused
  to retry a failed codegraph step when `harness.json` exists, the manifest says `failed` and
  `.codegraph/` is still absent; codegraph runs as `codegraph init --yes .` with `cwd: root`.
  `bin/init.mjs`: `no such directory: <cwd>` (exit 1), `init failed: ...; nothing was left
  behind` (exit 1), and the retry's outcome. RED (new tests against 9f6ea49's code): `project.test.mjs`
  → `does not provide an export named 'InitWriteError'`; `init.test.mjs` → a missing `--cwd`
  reported as "not a git repository", an uncaught `EACCES` out of `initMain`, and "already
  initialized" instead of a retry. GREEN: 36/36 in those files; full `node --test` → `tests 348 /
  pass 346 / fail 0 / skipped 2`, re-run by the parent with the same result; `npm run check` PASS.
  +631/−113 lines. Accepted writer calls: the rollback also removes a manifest directory the run
  created; `.codegraph/` is not rolled back when the manifest write (the only later step) fails —
  it ignores itself and a second `init` sees it; the retry reuses the same failure wording. Real
  run in a scratch folder named `odd dir %USERNAME%`: `init` wrote the three files and `ran
  codegraph init`, `.codegraph/` landed inside that folder, and no expanded sibling was created.
- 2026-09-28: T2b committed as b596e01. Assessed (`--base-ref 9f6ea49 --committed-only`): risk
  `medium`, 783 changed lines, `review_due: true` (`slice_budget_reached`). Native review lineage
  review-b0d6a66c47ea0007: one lens (reliability), approved and acknowledged, with four advisory
  findings (two WARNING: a rollback can delete a manifest this run did not create, the retry's
  manifest write is unguarded; two SUGGESTION: "nothing was left behind" overclaims when
  `.codegraph/` survives, and the outside hook's absolute path shape). Codex (`--base 222110f`,
  the whole slice): P1 hook containment is lexical, so an in-repo symlink to outside passes; P1
  an earlier manifest is overwritten or deleted on re-init; P2 `..hooks` counts as outside. All
  accepted as T2c; for an earlier manifest with `harness.json` missing, `init` refuses (exit 1)
  and names both ways out, the safest choice until T3's `uninstall` exists.
- 2026-09-28: T2c done by the same writer. `bin/lib/project.mjs`: an earlier manifest with no
  `harness.json` → nothing written, exit 1, naming both ways out; hook containment on real paths
  (`resolveHookContainment`), where only `..`, `..` + a separator or an absolute path is outside;
  the retry's manifest write raises `InitWriteError`; `InitWriteError` carries
  `codegraphDirLeftBehind`, and `init` says so instead of "nothing was left behind"; an outside
  hook is kept as `{ path: <real absolute path, forward slashes>, outside: true, reason }`. The
  manifest path is resolved once and shared by the check and the write. RED (new tests against
  b596e01's code): 8 failures, one per item, including `..hooks` classed as outside and the
  in-repo symlink to outside accepted; the writer also caught a CLI test that could reach a real
  `codegraph` on the old code and injected a fake spawn. GREEN: 42/42 in those files (the symlink
  test ran, not skipped); full `node --test` → `tests 354 / pass 352 / fail 0 / skipped 2`,
  re-run by the parent with the same result; `npm run check` PASS. +377/−58 lines. Real run: in
  the scratch clone from T2b, deleting `harness.json` and running `init` → the refusal message,
  exit 1, nothing written. Its advice to "run js-harness uninstall" becomes true with T3.
- 2026-09-28: T2c committed as aa7ba68. Assessed (`--base-ref b596e01`): risk `medium`, 466
  lines, `review_due: true`. Native review lineage review-dfe5653f880e7439: approved and
  acknowledged, one WARNING (R3-realish-dangling-symlink-escape: a dangling symlink still passes
  containment; not a regression). Codex (`--base 222110f`, its test runner hit EPERM): P1 the same
  dangling symlink, also for `AGENTS.md`; P2 a failed codegraph run that made `.codegraph/` is
  recorded as not created; P2 the retry's manifest rewrite is not atomic. Accepted as T2d, the
  last correction round for this slice: later findings become follow-ups, not another round.
- 2026-09-28: T2d done by the same writer (`bin/lib/project.mjs`: `isOccupied` on `lstat`,
  `realish` walks segment by segment resolving links with `readlinkSync`, `createdDir` observed
  after any codegraph run, `writeManifestAtomic`; tests updated to fault the `.tmp` write). RED
  (new tests against aa7ba68's code): 5 failures for items 2 and 3. Item 1's three
  dangling-symlink tests skip here: this account lacks `SeCreateSymbolicLinkPrivilege`
  (`whoami /priv`), as the repo's two older symlink tests do. GREEN: `tests 47 / pass 44 /
  skipped 3` in those files; full `node --test` → `tests 359 / pass 354 / fail 0 / skipped 5`,
  re-run by the parent; `npm run check` PASS. +290/−52 lines. Item 1 checked by hand with a
  junction, which needs no privilege: `.git/hooks` as a junction to a missing folder outside the
  repo → new code keeps `<outside>/pre-commit` as `outside: true` and creates nothing there, exit
  0; aa7ba68's code on the same setup fails closed (`init failed: ENOENT ... mkdir`, rolled back,
  exit 1), so on Windows the escape needs a dangling file symlink, which this machine cannot
  create. That case rests on the skipped tests and code reading. The outside reason still says
  "(core.hooksPath)" when a link, not the config, sends the hook outside: wording follow-up.
- 2026-09-28: T2d committed as dc49d6d. Commit assessed (`--base-ref aa7ba68`): risk `medium`,
  368 lines, `review_due: false` (`under_budget`). The gentle-ai Stop hook asked for the whole
  slice, which is also the PR candidate: native review lineage review-a95098352b5dd5b5 (range
  `222110f..dc49d6d`, one lens) approved and acknowledged, with three WARNING and one SUGGESTION,
  all advisory. Codex on the same range: no P1, two P2. All six go to T2e.
- 2026-09-28: slice 2 merged as b22ecc9 (`jsaristi/js-harness#9`); slice 3 starts on
  `feat/project-uninstall` from it. Sebastián chose how `uninstall` picks its scope: by location,
  like npm, with `--global` for the machine (roadmap, Decided: "Command scope"). T2e and T3
  designed above; T2e goes first because T3 reads the manifest shape it settles.
- 2026-09-28: T2e done by a delegated writer (4 files: `bin/lib/project.mjs`, `bin/init.mjs` and
  their tests; +697/−141). New: `gitDirs`, containment against the working tree and both git
  dirs, `manifestEntry` (repo-relative, or absolute with `gitDir: true`), `dirs` in the
  manifest, symlink hops counted only at or below the containing base, the link wording, a unique
  `wx` temp file, `harness.json` written after the manifest, `.codegraph/` rolled back when
  this run created it and its manifest never landed, and an injectable `rm` so each "could not
  remove" wording is tested; `InitWriteError.codegraphDirLeftBehind` is gone, folded into
  `notRemoved`. TDD was not followed by the writer on its first pass (it implemented, then ran
  the old tests), so RED was taken by the parent: the new tests against the old engine (plus a
  `gitDirs` stub so the import resolves) → 10 failures, among them the worktree, `gitDirs`, the
  three wordings and the `.codegraph/` rollbacks; the writer's second pass added the write-order
  and `wx` tests, RED against the old engine too (3 failures; its "rolls back everything when the
  harness.json write throws" test also passes on the old code, where that write came first). GREEN:
  `node --test` → `tests 369 / pass 364 / fail 0 / skipped 5`, re-run by the parent; `npm run
  check` PASS. Item 5 (links above the base) rests on code reading: `git rev-parse
  --show-toplevel` already resolves those links here and this account cannot create symlinks.
  Real run in a scratch repo with a linked worktree (real git, real codegraph): `init --cwd <wt>`
  → the hook written at `<main>/.git/hooks/pre-commit` and recorded absolute with `gitDir:
  true`, the manifest at `<main>/.git/worktrees/wt/js-harness/manifest.json`, exit 0.
  The first commit attempt was blocked by the pre-commit gate: inside a hook git exports
  `GIT_INDEX_FILE` and friends, and the worktree test's `git worktree add` inherited them
  (`Unable to create '<tmp>/.git/index.lock'`). RED outside the hook: `GIT_INDEX_FILE=.git/index
  node --test bin/lib/project.test.mjs` → 1 failure (that test). Fixed in the parent: both test
  files drop every inherited `GIT_*` variable before isolating the config; GREEN with
  `GIT_INDEX_FILE` and `GIT_DIR` set → `tests 57 / pass 54 / skipped 3`.
- 2026-09-28: T2e committed as 6d3e0a0. Assessed (`--base-ref b22ecc9 --committed-only`): risk
  `medium`, 935 lines, `review_due: true` (`slice_budget_reached`). Native review lineage
  review-42da9bfd954b4742: consent granted (pre-granted), one lens (reliability), approved and
  acknowledged (authority burned), with two WARNING (R3-wx-tmp-cleanup-deletes-foreign-file: on
  `EEXIST` the catch removes the file already at the temp path, and the test never checks it
  survives; R3-realish-base-detection-equality-only: hop counting starts only on exact equality
  with a base, so a link that lands below a base, or a case difference on win32, skips it) and one
  SUGGESTION (R3-gitdir-occupied-and-submodule-untested). Codex (`--base b22ecc9`): P2 the same
  temp cleanup; P2 in an outside git dir `shallowestMissingAncestor` stops at the working-tree
  root, so a created chain is recorded by its deepest directory only. All accepted as T2f.
- 2026-09-28: T2f done by the same writer (`bin/lib/project.mjs` and its test, +354/−30). The
  `wx` create sits outside the cleanup, so only a temp file this call created is removed;
  `resolveHookContainment` returns the containing `base`, which bounds `mkdirTracked` for the
  hook's directory; `isWithinBase` (at or below, case-folded on win32) replaces exact equality in
  `realish` and is checked after every hop. RED (new tests against 6d3e0a0's engine): 4 failures
  — the foreign temp file deleted, the outside chain recorded and rolled back by its deepest
  directory only, a hop below a base not counted. The junction-above-root, junction-below-root,
  kept-hook-in-a-git-dir and submodule tests pass on the old engine too: coverage, not
  discriminators. The above-root case is built with an absolute `core.hooksPath` through a
  junction, since `git rev-parse --show-toplevel` already resolves links above the root. GREEN:
  `node --test` → `tests 377 / pass 372 / fail 0 / skipped 5`, re-run by the parent; `npm run
  check` PASS; with `GIT_INDEX_FILE` and `GIT_DIR` set → `tests 54 / pass 51 / skipped 3`.
  Observed by the writer, not fixed: when `core.hooksPath` is lexically outside but links resolve
  it back inside, the manifest records the lexical path as a `../`-relative one. `uninstall`
  resolves it lexically to the same file, so it still works; the shape is only odd.
- 2026-09-28: T2f committed as e187fd2. Assessed (`--base-ref 3064173 --committed-only`): risk
  `medium`, 404 lines, `review_due: true`. Native review lineage review-5cb0b7e551a007ef: consent
  granted (pre-granted), one lens (reliability), approved and acknowledged, with two WARNING
  (R3-001: moving the `wx` write out of the `try` leaks a temp file it created when the write
  itself fails; R3-002: `mkdirTracked` now climbs the lexical directory against a realpath base
  with a case-sensitive `startsWith`, so a symlinked root, an 8.3 name or a case difference
  records only the deepest directory, a regression for the working tree too) and one SUGGESTION
  (R3-003: case folding and a linked root untested). Codex (`--base 3064173`): the first run could
  not assess (process creation denied); the retry found the same two, as P2. Accepted as T2g.
- 2026-09-28: T2g done by the same writer (`bin/lib/project.mjs` +80/−33, its test +183/−63,
  `bin/init.test.mjs` +6/−4). The manifest temp write goes through an injectable `{ open, write,
  close }` (`fs.openSync(tmp, 'wx')` by default): a failure in `open` touches nothing, a failure
  after it removes the temp file; the fault-injecting tests moved from `writeFile` to that seam.
  `shallowestMissingAncestor` climbs on `fs.existsSync` and checks containment once, with
  `isWithinBase` on the real form of the first existing parent. The parent dropped a
  `writeFile` parameter `alreadyInitialized` no longer used. RED (new tests against e187fd2's
  engine): 12 failures, among them the case-mismatched hooks path in the ordinary working tree
  recorded as `custom/nested/hooks` instead of `custom` — R3-002 reproduced live; the other ten
  are the migrated tests, whose faults the old engine never triggers. GREEN: `node --test` →
  `tests 381 / pass 375 / fail 0 / skipped 6`, re-run by the parent; `npm run check` PASS; with
  `GIT_INDEX_FILE` and `GIT_DIR` set → `tests 58 / pass 54 / skipped 4`. The 8.3 short-name
  case is a new explicit skip: `os.tmpdir()` and both realpath forms are identical on this host.
  T2g is the last correction round on the containment code: later findings there become
  follow-ups unless severe, the rule slice 2 used.
- 2026-09-28: T3 done by the same writer. `uninstallProject` in `bin/lib/project.mjs` (+203) and
  its tests (+392); `uninstallMain` in `bin/install.mjs` parses `--cwd`/`--home`/`--global`
  strictly and routes by location (+124/−3, tests +160/−1); the dispatcher's usage line names both
  scopes. Files are removed when their content (CRLF read as LF) matches the recorded sha256,
  never through a link; `dirs` are pruned bottom-up only when empty; `.codegraph/` goes when
  `createdDir`; the manifest stays when a removal fails. RED against f725b72: `install.test.mjs`
  6 failures, `js-harness.test.mjs` 1, and `project.test.mjs` failed on the missing export; the
  parent re-ran it with an `uninstallProject` stub → 16 failures, every new `uninstallProject`
  test. Reading `uninstallMain`, the parent found that `uninstall --cwd <repo>` on a repo not
  initialized fell through to the machine, so a second run would remove the machine install, and
  the writer had pinned that in a test. Fixed inline: RED 2 failures (outside a repo, in an
  untouched repo), GREEN `install.test.mjs` 17/17. GREEN: `node --test` → `tests 408 / pass 401
  / fail 0 / skipped 7`; `npm run check` PASS; `npm run e2e` every step PASS (its `uninstall`
  step restores both hook files byte for byte). Real runs in scratch repos (real git, real
  codegraph): init then uninstall → `git status --porcelain` empty, hook, `.codegraph/` and
  manifest gone (the writer's); with `AGENTS.md` edited after init → `kept AGENTS.md (changed
  since init)`, the rest removed, exit 0 (the parent's).
- 2026-09-28: T3 committed as 0ad11dd. Assessed (`--base-ref fa96953 --committed-only`, T2g and T3):
  risk `medium`, 1323 lines, `review_due: true`. Native review lineage review-8a51cf5f7fba849d:
  consent granted (pre-granted), one lens (reliability), approved and acknowledged, with two WARNING
  (R3-uninstall-cwd-dependent-machine-tests: the older machine tests pass no `--global` or
  `--cwd`, so in an initialized checkout a test run would undo that project;
  R3-manifest-entry-shape-unvalidated: an entry without a string `path` crashes instead of
  `malformedManifest`) and one SUGGESTION (R3-implicit-rerun-falls-to-machine: a second plain
  `uninstall` inside the same repo finds it uninitialized and removes the machine install; this
  follows the scope rule Sebastián chose, so it is his call). Codex (`--base fa96953`): P1 a
  recorded file behind an ancestor later replaced by a link to outside is deleted there; P2
  unrecorded empty subdirectories are pruned; P2 `EACCES` reads as already gone and the manifest is
  dropped; P2 a short `writeSync` is renamed into place; P2 manifest paths are not checked for
  containment. All but the SUGGESTION accepted as T3b.
- 2026-09-28: T3b done by the same writer (`bin/lib/project.mjs` +201/−56, its test +248,
  `bin/install.test.mjs` +5/−2, `scripts/e2e.mjs` +4/−1): each recorded file's real location is
  re-checked against its base before removal (`kept (moved outside)` otherwise); `dirs` pruning
  touches only the chain init created, derived from `dirs` and `files` without walking the disk;
  only `ENOENT`/`ENOTDIR` count as absent; manifest writes loop until every byte is written; the
  whole manifest is validated (shape and containment) before any removal; the older machine tests
  and the e2e `uninstall` pass `--global`. RED against d359829: 10 failures, one per new test;
  the junction test showed the old engine reporting `removed custom/nested/hooks/pre-commit` for
  the file outside. The writer's own call: `dirs` pruning checks emptiness, not real
  containment, since removing a directory junction removes the link, not its target. It also
  found the TUI's uninstall passed no `--global`. Sebastián then chose that a plain
  `uninstall` inside an uninitialized git repository refuses (see "T3 design"); the parent
  implemented it and the TUI's `--global` inline, extracting `buildCommands` from `tuiMain`
  so it can be tested. RED: `install.test.mjs` 2 failures (an uninitialized repo, a second run in
  the same project); `tui.test.mjs` 1 once the rule was in (the menu's uninstall refused inside a
  repo); the usage line 1. GREEN: `node --test` → `tests 422 / pass 415 / fail 0 / skipped 7`;
  `npm run e2e` 14 steps PASS; `npm run check` PASS through the commit hook.
- 2026-09-28: T3b committed as ae471e7. Assessed (`--base-ref d359829 --committed-only`): risk
  `medium`, 678 lines, `review_due: true`. Native review lineage review-c51aeeefefd93719: consent
  granted (pre-granted), one lens (reliability), approved and acknowledged, with one WARNING
  (R3-dir-prune-follows-ancestor-link: `dirs` pruning never re-checks real containment, so an
  empty chain reached through a replaced ancestor is removed outside the project — the writer's
  junction argument covered the link, not what it reaches) and one SUGGESTION
  (R3-short-write-loop-no-progress-guard). Codex (`--base d359829`): P2 the same no-progress loop.
  Both accepted as T3c, done inline by the parent. RED: 3 failures (a write returning 0, a write
  returning no count — both built to finish rather than hang on the old loop — and the empty outside
  chain removed). GREEN: `node --test` → `tests 425 / pass 418 / fail 0 / skipped 7`; `npm run
  e2e` 14 steps PASS.
- 2026-09-28: T3c committed as 9efcc91. Assessed (`--base-ref ae471e7`): risk `medium`, 98 lines,
  `under_budget`; reviewed anyway as the slice's last code commit. Native review lineage
  review-7fa4f2ce8d9975ff: approved and acknowledged with two SUGGESTION, carried as follow-ups:
  R3-dir-containment-absent-dir-uncovered (a deleted recorded directory; by code reading `realish`
  appends a missing segment lexically, so it stays inside and reaches the silent `ENOENT`, but no
  test pins it) and R3-dir-containment-gitdir-branch-untested (a `gitDir: true` directory under
  the new check). Codex (`--base ae471e7`): no actionable regression; process creation was denied,
  so it compared the git objects instead of running the tests. Slice 3 is complete: T2e, T2f, T2g,
  T3, T3b and T3c, each reviewed by gentle-ai and Codex.
- Follow-ups carried from slice 3, none blocking: the two T3c SUGGESTION above; a lexically
  outside `core.hooksPath` that links resolve back inside is recorded as a `../` path (T2f
  note); `dirs` pruning trusts a missing directory's lexical path.
- Observed, out of scope: `js-harness status` reports `latest available: (unknown)` because it
  asks the npm registry, where the package is not published; the decided release source for a
  private repo is `git ls-remote --tags`, and no tag exists yet.

## Next step
T4 (`sync` in a project, by the same location rule as `uninstall`) on a new branch from `main`, in
a new session.

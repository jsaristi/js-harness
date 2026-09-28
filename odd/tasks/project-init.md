# Project init

Locator: `odd/tasks/project-init.md` · Engram mirror: `odd/project-init/tasks` · Branches:
`feat/project-init` (T1, merged via `jsaristi/js-harness#8`), `feat/project-init-cmd` (T2)

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
1 = T1 (`jsaristi/js-harness#8`, merged as 222110f); 2 = T2 (`feat/project-init-cmd`).

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
- [ ] T3 `uninstall` in a project restores it exactly — route: delegated writer
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
- Observed, out of scope: `js-harness status` reports `latest available: (unknown)` because it
  asks the npm registry, where the package is not published; the decided release source for a
  private repo is `git ls-remote --tags`, and no tag exists yet.

## Next step
Review T2's commit (gentle-ai, then Codex), open slice 2's PR against `main`, and check T2 off
once it is approved; then T3 (`uninstall` in a project, from the manifest T2 writes).

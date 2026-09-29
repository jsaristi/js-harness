# Project init

Locator: `odd/tasks/project-init.md` · Engram mirror: `odd/project-init/tasks` · Branches:
`feat/project-init` (T1, merged via `jsaristi/js-harness#8`), `feat/project-init-cmd` (T2, merged via
`jsaristi/js-harness#9`), `feat/project-uninstall` (T2e–T3c, merged via `jsaristi/js-harness#10`), `feat/project-sync` (T4–T4c, merged via `jsaristi/js-harness#11`), `feat/project-tui` (T5–T5f, merged via `jsaristi/js-harness#12`), `feat/codex-plugin-doctor` (T6–T6d, merged via `jsaristi/js-harness#13`), `feat/codex-review-record` (T7–T7e, merged via `jsaristi/js-harness#14`)

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
50cb262); 4 = T4–T4c (`jsaristi/js-harness#11`, merged as 2b2f365). 5 = T5–T5f (`jsaristi/js-harness#12`, merged as 8ca30ea). 6 = T6–T6d (`jsaristi/js-harness#13`, merged as 0d12e02). 7 = T7–T7e (`jsaristi/js-harness#14`, merged as 94b9544).

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

## T4 design
- Nothing `init` writes depends on the version (the hook is a fixed `exec js-harness check`, and
  `AGENTS.md` is the project's once written), so moving a project to its pin means matching the
  running js-harness to `harness.json`. When they differ, `sync` writes nothing, exits 1 and names
  both ways out: `npm i -g github:jsaristi/js-harness#v<pin>` (the decided release source; no tag
  exists yet), or raising the pin to the running version in `harness.json` with a commit. It
  never installs anything: one global install serves every project, so changing it from inside
  one project would move the others (Sebastián, 2026-09-28; roadmap, Decided: "Per project").
- Scope by location, the `uninstall` rule: `js-harness sync [--cwd <dir>] [--home <dir>]
  [--global]`, strict flags (unknown flag, missing value, `--global` with `--cwd` → exit 2).
  Inside a git repository whose top-level has `harness.json` or a project manifest, it syncs the
  project; with `--global`, or outside any git repository with no `--cwd`, it is today's machine
  sync. An explicit `--cwd` that is not an initialized project, or a git repository around the cwd
  that is not one, exits 1 and names `--global`. The TUI's sync passes `--global` (T5 decides what
  it offers inside a project).
- `harness.json` without a string `version` (missing, unreadable, not JSON) → exit 1 naming it,
  nothing written. A manifest without `harness.json` → exit 1, the same refusal `init` gives.
- Pin equal to the running version, no manifest in this clone (a fresh clone of an initialized
  project): sync sets the clone up the way `init` would — the pre-commit gate and `codegraph
  init`, under the same containment rules — and writes a manifest, but `harness.json` and an
  existing `AGENTS.md` are recorded as `kept` (committed), never as files this clone created, so
  `uninstall` there removes only what the clone wrote.
- Pin equal, manifest present: a recorded hook that is gone is written again (when its path is
  free and still contained); `.codegraph/` recorded as created, or never created, and absent is
  created by `codegraph init`; everything else is left as is. The manifest is rewritten
  atomically only when something changed; otherwise "up to date", exit 0, nothing written.
- Exit codes: 0 in sync (skips and kept files are reported, not failures), 1 a pin mismatch, a bad
  `harness.json`, a stale manifest, a not-initialized project or a failed write, 2 usage error.

## T5 design
- Menu by location (Sebastián, 2026-09-29: inside a repository he wants the machine commands too,
  "so everything gets updated"). Outside a git repository the menu is today's machine menu,
  unchanged. Inside one it shows a `project` section first, then a `machine` section with today's
  machine items, then Quit. The project section is Init when the repository is not initialized, and
  Sync, Status and Uninstall when it is (a stale manifest or a bad `harness.json` counts as
  initialized, since `status` and `sync` name the problem and `uninstall` clears a stale manifest).
  Section headers are not selectable.
- Project items run with `--cwd <root>`; the machine items that act by location (`status`,
  `sync`, `uninstall`) pass `--global`, so the same Enter never changes scope with the folder. The two
  uninstalls confirm with different questions: "Undo js-harness in this project?" and today's
  machine one.
- After a command runs, the TUI re-reads its location and rebuilds the menu (an `init` turns Init
  into Sync/Status/Uninstall, a project `uninstall` turns it back), keeping the selection in range.
- `status` gains the project level, by the "Command scope" rule: `js-harness status [--cwd <dir>]
  [--home <dir>] [--global]` (plus today's `--source`/`--pm`). Inside an initialized project it
  reports the project root, the pinned version, the running version, whether this clone is set up
  (a manifest present, else "js-harness sync sets it up") and whether pin and running version match
  (if not, "js-harness sync names the ways out"); exit 0. A bad `harness.json` or a stale manifest
  exits 1 naming it, with the same messages `sync` gives. A git repository that is not initialized,
  or an explicit `--cwd` that is not one, exits 1 naming `js-harness init` and `--global`. Outside a
  git repository with no `--cwd`, or with `--global`, it is today's machine status. Unknown flags,
  a missing value or `--global` with `--cwd` exit 2.
- One read-only function in `bin/lib/project.mjs` answers where a folder stands (not a repository,
  a repository not initialized, an initialized project with its pin, manifest presence, or its
  stale/invalid state), sharing `syncProject`'s pin reading; both the TUI and `status` use it.

## T6 design
- One more row in `tools` (`bin/lib/stack.mjs`), id `codex-plugin` (fits the 16-wide column; the
  plugin id `codex@openai-codex` does not). Its columns keep their meaning: `installed` + version
  from `~/.claude/plugins/installed_plugins.json` `plugins["codex@openai-codex"][0].version` (the
  typescript-lsp shape); `claude` is enabled in `~/.claude/settings.json` `enabledPlugins`; `codex`
  is "the Codex side is ready": `codex login status` exits 0 (checked on this machine 2026-09-29:
  "Logged in using ChatGPT", exit 0; with an empty `CODEX_HOME`, "Not logged in", exit 1);
  `project` is `n/a`.
- The login probe runs with `CODEX_HOME=<home>/.codex`, so `--home` means the same Codex home the
  MCP probes already read, and a fixture home never reads the real one; a `CODEX_HOME` the user set
  is kept when `home` is the real home (T6b). Exit 0 is `ok`; a timeout is `unknown`; any other
  exit, or no `codex` on PATH (on win32 through the shell that is exit 1 too), is `missing`, and
  then `codex --version` tells a missing CLI from a logged-out one for the fix (T6d). With the
  plugin not installed the cell is `n/a` and nothing is spawned (T6b). It reads Codex's own answer,
  never `auth.json`.
- Up to date: the latest version comes from the local `openai-codex` marketplace file
  (`~/.claude/plugins/marketplaces/openai-codex/.claude-plugin/marketplace.json`, plugin `codex`),
  the offline source typescript-lsp already uses; the reader takes the marketplace name. Both
  marketplace sources are read on every run, online or `--offline`, and never cached (T6d).
- Fix commands, the tool's own; a fix of several steps is a list printed one command per line,
  since no separator works in both `cmd.exe` and Windows PowerShell 5.1 (T6b): installed
  `claude plugin marketplace add openai/codex-plugin-cc` then `claude plugin install
  codex@openai-codex` (the marketplace source recorded in `known_marketplaces.json`); claude
  `claude plugin enable codex@openai-codex`; codex `codex login`, preceded by
  `npm i -g @openai/codex` when the CLI is missing (T6d); upToDate
  `claude plugin update codex@openai-codex`.

## T7 design
Explored 2026-09-29. Neither side keeps a record a check could use: the Codex plugin's job state
lives under `CLAUDE_PLUGIN_DATA` (or the OS temp dir), keyed by workspace and pruned
(`scripts/lib/state.mjs` of `codex@openai-codex` 1.0.6); gentle-ai's terminal records in
`.git/gentle-ai/review-transactions/terminal-consumption/v1/*.json` hold only opaque sha256
targets, no commit range, in a format gentle-ai v4 may change. So js-harness writes its own.

- Record: `js-harness codex-review --base <rev>` runs the plugin's own review, `node
  <installPath>/scripts/codex-companion.mjs review --wait --base <rev>` in the repository (the
  `installPath` of `codex@openai-codex` in `~/.claude/plugins/installed_plugins.json`), with its
  output shown as is. The companion exits 0 when Codex's turn completed, findings or not, and 1
  when the turn failed (`buildResultStatus` in `scripts/lib/codex.mjs`), so exit 0 is not trusted
  alone: a turn whose sandbox denied process launch completes with a review that says it could not
  read the diff. The companion exposes only the review text, so its stdout is captured (stderr, the
  progress, stays live), shown as is, and read with `saysReviewNotInspected`, a short list of
  Codex's own phrases ("could not assess the patch", "correctness is unverified", "fail-closed
  verdict"); a match writes nothing and exits 1 with the two ways on. On a clean 0 it appends one
  JSON line `{ schema, base, head, reviewedAt, outcome: "reviewed" }`, full commit ids, to
  `<git common dir>/js-harness/codex-reviews.jsonl`; on anything else it writes nothing and exits
  with the companion's code, naming the two ways on. When Codex cannot run (the model is
  rejected, the plugin is missing), `--unavailable <reason>` records `outcome: "unavailable"` with
  the reason and spawns nothing, so a skip is explicit instead of silent (AGENTS.md: report it and
  go on). Findings stay in the feature document, as today.
- Location: under the git common dir, like gentle-ai's own records and the project manifest, so it
  adds no commit and no file to the project, and every worktree of a clone shares it. It is one
  file, undone by deleting it. A fresh clone starts without records, so commits reviewed on
  another machine need their review recorded again there.
- Check: `js-harness check --push` runs one row, `codex-review`, and nothing else: the budget and
  test rows read the working tree, not the pushed commit, and pre-commit already ran them on every
  commit (T7d). A commit needs a Codex review when it is not a merge and changes a file that is not
  Markdown; it is covered when some valid record's `base..head` contains it (T7e). The row covers
  `<remote default>..<head>`, the base taken only from the remote's refs
  (`refs/remotes/<remote>/HEAD`, else `<remote>/main`, else `<remote>/master`; `--remote`, default
  `origin`), never a local branch, and fails naming `git remote set-head <remote> --auto` when
  there is none (T7d). It passes with nothing to cover, lists `unavailable` records as lines of the
  PASS row, and fails naming each uncovered commit (short id and subject) and the command that
  records it. Plain `check` (the pre-commit gate) does not run it, since a slice under gentle-ai's
  review budget is committed before it is reviewed.
- Gate: `.githooks/pre-push` runs `check --push --remote "$1" --head <sha>` for each ref it pushes
  (skipping deletes, `node` reading `/dev/null`), so a skipped review stops the push, which
  precedes every pull request. `init` does not write a pre-push hook yet; that is for a project
  that adopts this review flow.

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
- [x] T4 `sync` moves a project to its pinned version — route: delegated writer
- [x] T4b Accepted review follow-ups on T4: a `.codegraph/` this sync recreated is rolled back on a
  failed manifest write even when the old manifest records an earlier one as created (Codex P2);
  "up to date" means nothing was written, not that nothing was reported
  (R2-uptodate-conflates-reported-with-changed, R3-uptodate-counts-report-only-actions) — route:
  inline (one function and its tests, both understood)
- [x] T4c Accepted whole-slice review follow-up: a pin that is not semver is an invalid
  `harness.json`, since a cloned repository's pin is printed inside a suggested install command
  (R1-001) — route: inline (one check and its tests)
- [x] T5 The TUI offers `init`/`sync`/`status` inside a project, above the machine commands, and
  the machine commands outside one; `status` acts by location (see "T5 design") — route: delegated
  writer (touches `bin/tui.mjs`, `bin/update.mjs`, `bin/lib/project.mjs` and their tests)
- [x] T5b Accepted review follow-ups on T5: the TUI binds project commands to the location it just
  read, so a rebuilt menu never offers an unbound item, and a failing command or location re-read
  resumes stdin and redraws (R4-stale-command-binding, R3-001); an invalid `harness.json` is
  reported with a fixed reason, never `JSON.parse`'s text (R1-status-reason-echo); the three
  readability points (R2-*) — route: delegated writer (the T5 writer, resumed: two non-trivial
  files and their tests)
- [x] T5c Accepted review follow-ups on T5b: the TUI's error line drops C1 controls too
  (R3-oneline-c1-controls), the unreadable-pin test accepts every code shape (R2-002), and
  `buildCommands` says what `root` is for (R2-001) — route: inline (one regex, one test pattern,
  one comment)
- [x] T5d Accepted whole-slice review follow-ups: the TUI refreshes the stack block after a command
  (Codex P2); the installed skill names `status --global` and `sync --global` for the machine
  (Codex P2, and the slice-4 follow-up); `statusMain` says why it uses real git
  (R2-status-spawn-not-forwarded-unexplained); the missing-directory test builds its path under a
  unique parent (R3-nosuchdir-fixed-path) — route: delegated writer (the T5 writer, resumed)
- [x] T5e Accepted review follow-ups on T5d: the reverse independence test (a failed location
  re-read still refreshes the stack; R2-001, R3-001) and the comment saying why `fetch` stays unused
  on the offline stack refresh (R2-002) — route: inline (one test, one comment)
- [x] T5f Accepted final whole-slice review follow-up: every suite that creates an empty git
  config in the temp directory removes it when it ends (Codex P3) — route: inline (the same
  mechanical hook in five test files)
- [x] T6 `doctor` reports the Codex plugin (`codex@openai-codex`): installed, enabled and logged
  in, with its fix command (see "T6 design") — route: delegated writer (touches
  `bin/lib/stack.mjs`, `bin/lib/latest.mjs` and the tests that count the stack's rows)
- [x] T6b Accepted review follow-ups on T6: a fresh cache that predates a row (no entry for its
  id) no longer hides that row's latest version for up to 6 h — an online run resolves it (Codex
  P2); a fix with more than one step is a list of commands, printed one per line, since `;` does
  not separate commands in `cmd.exe` (Codex P2; gentle-ai's `upToDate` fix had the same defect);
  the login probe keeps a `CODEX_HOME` the user already set when `--home` is the real home
  (R3-codex-home-overrides-user-env); no login probe when the plugin is not installed, the `codex`
  cell being `n/a` then (R3-login-probe-runs-when-plugin-absent) — route: delegated writer (the T6
  writer, resumed: `stack.mjs`, `doctor.mjs` and their tests)
- [x] T6c Accepted review follow-up on T6b: the cache-restamp test builds its fresh stamp a minute
  in the past, so a run inside one millisecond cannot fail it (R3-refetch-stamp-same-ms) — route:
  inline (one test line)
- [x] T6d Accepted PR-range review follow-ups (the last round for slice 6; later findings are
  carried): a latest version read from a local marketplace file is read on every run, online or
  `--offline`, never taken from the cache, so a plugin installed after a run that cached `null`
  is compared at once (Codex P2); when the login probe fails, `codex --version` tells a missing
  Codex CLI from a logged-out one, and the `codex` fix for a missing CLI installs it first,
  `npm i -g @openai/codex` then `codex login` (Codex P2); a hook-level test with a list fix
  (R3-001) — route: delegated writer (the T6 writer, resumed: `doctor.mjs`, `stack.mjs`,
  `latest.mjs` and their tests)
- [x] T7 The Codex review of each approved code slice leaves a record a check verifies, so a
  skipped review is caught (see "T7 design"): `js-harness codex-review --base <rev>` runs the
  plugin's review and records it, `--unavailable <reason>` records an explicit skip — route:
  delegated writer (a new command, its record library and the dispatcher, with tests)
- [x] T7b `check --push` verifies that every code commit on the branch lies in a recorded range,
  `.githooks/pre-push` runs it, and AGENTS.md, the installed skill and the roadmap name
  `codex-review` — route: delegated writer (the T7 writer, resumed: `check.mjs`, the hook, the
  skill text and their tests)
- [x] T7c Accepted review follow-ups on T7: an append after an unterminated last line starts on a
  new line, so a damaged tail cannot swallow the next record (Codex P2); `codex-review` refuses to
  run the review while tracked files have uncommitted changes, since the record claims the
  committed range (R3-dirty-tree-recorded-as-reviewed); the companion gets the resolved base id,
  so the record and the review are the same range (R3-companion-gets-unresolved-base); a
  dispatcher-level test of `codex-review` (R3-dispatch-untested); the accumulate test asserts
  each exit code (R3-accumulate-test-ignores-codes) — route: delegated writer (the T7 writer,
  resumed, before T7b)
- [x] T7d Accepted review follow-ups on T7c–T7b: the push range starts at the remote's default
  branch (`refs/remotes/<remote>/HEAD`, else `<remote>/main`, else `<remote>/master`, the remote
  named by the hook), never at a local branch, and with none the row fails naming
  `git remote set-head <remote> --auto` (Codex P1, R3-push-range-ignores-remote-sha); `check --push`
  runs only the `codex-review` row, since the budget and test rows read the working tree, not the
  pushed commit, and pre-commit already ran them on every commit (Codex P2,
  R3-push-rows-check-worktree-not-pushed-sha, R4-push-hook-full-suite-per-ref); a failed `git
  status` refuses the review instead of reading as clean (Codex P2); only records whose head lies in
  the checked range are expanded (R4-per-record-git-spawn-unbounded); the hook's `node` reads
  `/dev/null`, not the ref list (R3-hook-child-stdin); no `^` hint for a root commit
  (R3-root-commit-fix-hint); the three comments R2 found wrong or missing — route: delegated
  writer (the T7 writer, resumed)
- [x] T7e Accepted PR-range review follow-ups (the last round for slice 7; later findings are
  carried): a record whose head lies past the pushed tip still covers the commits in its range
  (Codex P2, R3-record-head-beyond-pushed-tip-dropped); only a valid record counts as evidence —
  the v1 schema, `reviewed` or `unavailable` with a reason, full commit ids (Codex P2); a push to a
  URL rather than a named remote fails with a hint that works, not `git remote set-head <url>`
  (R4-push-to-url-always-refused); the module header's tense (R2-codex-review-header-future-tense)
  and a comment on the newest-first order the fix hint relies on (R2-oldest-uncovered-order-implicit)
  — route: delegated writer (the T7 writer, resumed)

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
- 2026-09-28: slice 4 (T4) starts on `feat/project-sync` from 588a501. Sebastián chose that a
  project `sync` whose pin differs from the running version reports and writes nothing (see "T4
  design"; roadmap, Decided: "Per project").
- 2026-09-29: T4 done by a delegated writer (`bin/lib/project.mjs` +283/−78 with `syncProject`,
  `syncRecorded`, `restoreRecordedHook`, and `writeProject`'s hook and codegraph steps shared as
  `writeHookGate`/`codegraphStep`; `bin/install.mjs` +123/−19 with `syncMain` by location; usage, TUI
  and `upgrade` pass `--global` to the machine sync; ~980 of ~1,400 lines are tests). RED with a
  throwing `syncProject` stub and the old `syncMain`: `project.test.mjs` 33 failures (every new
  test), `install.test.mjs` 19, `update.test.mjs` 3, `js-harness.test.mjs` 1, `tui.test.mjs` 1.
  GREEN: `node --test` → `tests 481 / pass 474 / fail 0 / skipped 7`, re-run by the parent;
  `npm run check` PASS; `npm run e2e` 14 steps PASS. Real run (real git and codegraph, scratch
  folder): `init` in an origin repo, clone, `sync --cwd <clone>` → `kept harness.json (committed)`,
  `kept AGENTS.md (committed)`, `wrote .git/hooks/pre-commit`, exit 0; again → `up to date at
  0.1.0`; pin edited to 9.9.9 → exit 1 naming both ways out, manifest and hook byte-identical;
  `uninstall --cwd <clone>` → hook and manifest removed, `harness.json` and `AGENTS.md` kept,
  `git status --porcelain` empty. Writer's calls, accepted: a clone lacking `AGENTS.md` gets a skip,
  not a file; a present recorded hook is never overwritten, whatever its content; a manifest with an
  older `version` records the running one; `upgrade` calls `sync --global`, since a plain sync
  inside a repository would now refuse.
- 2026-09-29: side effect of the writer's RED run: the old `syncMain` ignored the new tests' flags
  and re-synced the real `~/.js-harness` at 0.1.0 (23:58). Checked by the parent: both `SKILL.md`
  files match the manifest's sha256 and each host file holds one `js-harness doctor --hook` entry.
  The gate's payload listing showed no such entry in either host just before that run (commit
  bd749a8) and shows it after, so the entry the roadmap records as registered had gone missing
  earlier, for an unknown reason, and that sync put it back. A stray `--global` folder it made in
  the checkout was removed by the writer.
- 2026-09-29: T4 committed as 6b92b70. Assessed (`--base-ref 588a501 --committed-only`): risk
  `high` (`hot_path` on `bin/update.mjs`), 1566 lines, `review_due: true`. Native review lineage
  review-54867637536910d4: consent granted (pre-granted), four lenses, approved and acknowledged
  (authority burned), with one WARNING (R2-uptodate-conflates-reported-with-changed) and five
  SUGGESTION (R2-clone-harness-json-comment-drift, R2-codegraph-step-duplicated,
  R2-hook-write-duplicated-and-found-by-basename, R3-recorded-hook-rollback-untested,
  R3-uptodate-counts-report-only-actions). Codex (`--base 588a501`; its `npm run check` failed in
  its sandbox): P2 a `.codegraph/` recreated by a failed sync is left behind when the old manifest
  says `createdDir: true`. The WARNING, its twin SUGGESTION and the P2 accepted as T4b.
- 2026-09-29: T4b done inline by the parent. RED: 3 new tests, 3 failures (the recreated
  `.codegraph/` left behind; a repeat sync reporting a hook a junction sends outside, and a repeat
  codegraph failure, both not up to date). GREEN: `project.test.mjs` → `tests 124 / pass 119 / fail
  0 / skipped 5`; full suite through the commit gate PASS. Committed as 759f43c. Assessed
  (`--base-ref 6b92b70`): risk `medium`, 79 lines, `under_budget`; reviewed anyway as the slice's last
  code commit. Native review lineage review-e4e4f47ab07943a6: one lens (reliability), approved and
  acknowledged, one SUGGESTION (R3-uptodate-ignores-createddirs). Codex (`--base 6b92b70`): no
  actionable regressions; its `npm run check` was denied a temp directory.
- 2026-09-29: PR `jsaristi/js-harness#11` opened. The gentle-ai Stop hook then asked for the whole
  slice as one candidate (range `588a501..e307e7a`, risk `high`, 1698 lines): native review lineage
  review-a28346df3a98b863, consent granted (pre-granted), four lenses, approved and acknowledged,
  with one WARNING (R1-001: the pin mismatch message prints `npm i -g ...#v<pin>` from the
  committed `harness.json` after checking only that the version is a non-empty string, so a cloned
  repository could plant shell metacharacters or terminal escapes in a command the user copies) and
  six SUGGESTION, the same readability and rollback-coverage points as T4's review plus
  `bin/install.mjs:244-248` (R2-005). R1-001 accepted as T4c, done inline by the parent. RED: three
  new invalid-pin cases (shell metacharacters, a terminal escape, `latest`) → 3 failures; a
  prerelease-with-build pin still reaching `pinMismatch` passed before and after. GREEN: those tests
  9/9; full suite through the commit gate PASS. Committed as a4d871d. Native review lineage
  review-c4909def058ac5e0 (`--base-ref e307e7a`, medium, 26 lines, one lens): approved and
  acknowledged, no findings. Codex (`--base e307e7a`): no regression; its sandbox blocked the
  tests, so it read the git objects.
- 2026-09-29: slice 4 merged as 2b2f365 (`jsaristi/js-harness#11`) by Sebastián's go-ahead.
- Follow-ups carried from slice 4, none blocking: the four remaining SUGGESTION from T4's review and
  R3-uptodate-ignores-createddirs (a directory is only created together with the hook written into
  it, so today it cannot change the verdict); the installed skill text in `bin/lib/manifest.mjs`
  still says `js-harness sync` unqualified; an initialized project whose `.codegraph/.gitignore` got
  committed gives its clones a `.codegraph/`, so their sync skips `codegraph init` and records
  `createdDir: false` (the writer's observation, not reproduced by the parent).
- Observed, out of scope: `js-harness status` reports `latest available: (unknown)` because it
  asks the npm registry, where the package is not published; the decided release source for a
  private repo is `git ls-remote --tags`, and no tag exists yet.

- 2026-09-29: slice 5 (T5) starts on `feat/project-tui` from 7d8fe3e. Sebastián chose that inside
  a repository the menu shows the project commands and, below them, the machine ones (see "T5
  design"); `status` gets the project level so the menu's project Status has something to show.
  Design committed as 2393109.
- 2026-09-29: T5 done by a delegated writer: `projectLocation` in `bin/lib/project.mjs` (sharing
  `readPin`/`projectFiles` with `syncProject`, and `invalidHarnessJsonMessage` with `sync`),
  `status` by location in `bin/update.mjs`, the menu as data (`buildMenu`, `withLocation`) in
  `bin/tui.mjs`; 10 files, +1126/−66, most of it tests. RED: `project.test.mjs` 10 of 138,
  `update.test.mjs` 12 of 31, `tui.test.mjs` 14 of 50, `js-harness.test.mjs` 1 of 15 (every RED call
  with a fixture `--home`). GREEN: `node --test` → `tests 532 / pass 525 / fail 0 / skipped 7`,
  re-run by the parent; `npm run check` PASS; `npm run e2e` every step PASS. Real run by the parent in
  a scratch repo: `status` before `init` → exit 1 naming `js-harness init` and `status --global`;
  after → root, pin 0.1.0, running 0.1.0, clone set up, match, exit 0; `status --global` → the machine
  report; the initialized menu renders `project` (Sync, Status, Uninstall) above `machine`; project
  `uninstall` → `git status --porcelain` empty. Writer's calls, accepted: this checkout is a git
  repository that is not initialized, so a plain `status` here now exits 1 and the machine-status
  tests and the e2e step pass `--global`; after `init` the selection lands on Sync, after a project
  `uninstall` on Init; location always uses real `git`, never the injected package-manager `spawn`;
  the menu's `doctor` passes `--cwd`, like the stack block. Committed as 52eaafa. Assessed
  (`--base-ref 7d8fe3e --committed-only`): risk `high`, 1235 lines, `review_due: true`
  (`high_risk`). Native review lineage review-4906b65b0638431f: consent granted (pre-granted), four
  lenses, approved and acknowledged (authority burned), with three WARNING and four SUGGESTION, all
  non-blocking: R4-stale-command-binding (the command table is bound once, so a menu rebuilt after
  `git init` elsewhere offers an unbound Init whose Enter throws with stdin paused and hangs the
  TUI), R1-status-reason-echo (a malformed `harness.json` in a clone reaches the terminal through
  `JSON.parse`'s message, escapes included; `sync` already did this), R2-buildcommands-doc-contradicts-doctor-cwd,
  R2-update-header-overstates-status-scope, R2-confirm-mode-name-and-duplicated-default, R3-001 (a
  throwing location re-read leaves stdin paused) and R3-002 (a plain `status` in a repository that is
  not initialized now exits 1). All but R3-002 accepted as T5b; R3-002 is the "Command scope" rule
  the design chose, and the one caller in this repo (e2e) moved to `--global`. Codex (`--base
  7d8fe3e`): three P2, the same defects as R4-stale-command-binding, R1-status-reason-echo and
  R3-001; its sandbox could not run the tests, so it read the diff and probed `JSON.parse`.
- 2026-09-29: T5b done by the T5 writer, resumed: project commands take the location the menu was
  last built for (`argsAt(location)`), a failing command or re-read prints one line and gives the
  terminal back, `readPin` reports "it is not valid JSON" or "it cannot be read (<code>)", one
  `confirm` mode driven by `CONFIRM_PROMPTS`, two comments corrected; 7 files, +270/−36. RED:
  `tui.test.mjs` 11 of 56, `project.test.mjs` 1 of 139, `update.test.mjs` 1 of 32,
  `install.test.mjs` 1 of 42. GREEN: `node --test` → `tests 541 / pass 534 / fail 0 / skipped 7`;
  `npm run check` PASS; `npm run e2e` exit 0, 14 PASS, 0 FAIL (exit code captured by the parent).
  Committed as e090e80. Assessed (`--base-ref 1030a87`): risk `high`, 306 lines, `review_due`.
  Native review lineage review-1aaca18091b58a5c: consent granted (pre-granted), four lenses,
  approved and acknowledged, three SUGGESTION (R2-001 `root` kept alive mostly by tests, R2-002 a
  test pattern narrower than the codes, R3-oneline-c1-controls). Codex (`--base 1030a87`, run in
  parallel with the native review rather than after it): no actionable regression; its sandbox
  could not create a temp directory for the tests. All three SUGGESTION accepted as T5c.
- 2026-09-29: T5c done inline by the parent. RED: the new C1 test failed (`\x9B` and `\x85` reached
  stderr). GREEN: `tui.test.mjs` + `project.test.mjs` → `tests 196 / pass 191 / fail 0 / skipped 5`;
  full suite through the commit gate PASS. Committed as 6353163. Assessed (`--base-ref e090e80`):
  risk `medium`, `under_budget`; left to the whole-slice review, the slice's last code commit.
- 2026-09-29: whole-slice review of `7d8fe3e..b7ac70a` (risk `high`, 1565 lines). Native review
  lineage review-e091a94b7c602ecf: consent granted (pre-granted), four lenses, approved and
  acknowledged, three SUGGESTION: R2-status-spawn-not-forwarded-unexplained (`statusMain` uses real
  git for the location without saying why), R2-design-doc-omits-sync-global (fixed in "T5 design"
  by the parent), R3-nosuchdir-fixed-path (a test path a leftover folder could break). Codex
  (`--base 7d8fe3e`): two P2 — the stack block is not refreshed after a project command, so Init's
  codegraph setup stays shown as missing; and the installed skill (`bin/lib/manifest.mjs:15`) still
  tells agents that a plain `js-harness status` reports the machine. Both P2, the two remaining
  SUGGESTION and the carried follow-up (the skill's unqualified `js-harness sync`) accepted as T5d.
- 2026-09-29: T5d done by the T5 writer, resumed: `runTui` takes `readStack` and re-probes the stack
  offline after a command, in its own guard (a failure keeps the previous block); the installed
  skill names `status`/`sync`/`uninstall --global` and says what the plain forms do in a project
  (a new test pins the wording; nothing pinned it or its sha256 before); a comment in `statusMain`;
  the missing-directory test under a unique parent. RED: `tui.test.mjs` 3 of 61,
  `manifest.test.mjs` 1 of 35 (the test path refactor has none). GREEN: `node --test` → `tests 547 /
  pass 540 / fail 0 / skipped 7`; `npm run check` exit 0; `npm run e2e` exit 0, 14 PASS, 0 FAIL.
  Committed as 6930435. Assessed (`--base-ref b7ac70a`): risk `high`, `review_due`. Native review
  lineage review-ebf4dc62453c0a4d: consent granted (pre-granted), four lenses, approved and
  acknowledged, one WARNING and two SUGGESTION: a test titled for both directions of independence
  checked one (R2-001, R3-001), and the offline comment did not say why `fetch` is passed (R2-002).
  Codex (`--base b7ac70a`, docs stashed so it saw only code): no actionable defect; its sandbox
  could not run the tests. All three accepted as T5e.
- 2026-09-29: T5e done inline by the parent: the reverse test (a rejected location re-read still
  redraws the refreshed stack) passed on first run, since it covers behavior T5d already had, so
  there is no RED; the comment now cites `offline: true`, which `resolveLatestVersions` answers from
  the cache without calling `fetch` (`bin/doctor.mjs:90`). GREEN: `tui.test.mjs` 62/62.
  Committed as 012da1f.
- 2026-09-29: final whole-slice review of `7d8fe3e..ebefc02` (risk `high`, 1800 lines). Native review
  lineage review-fc3af9150637cb0a: consent granted (pre-granted), four lenses, approved and
  acknowledged, two SUGGESTION carried as follow-ups: R2-withlocation-pending-mode-invariant
  (`withLocation` clears `pending` but keeps `mode`; only called after a command, so unreachable
  today) and R2-duplicated-git-env-isolation (the git-isolation `before` block and a tree-snapshot
  helper are copied across suites). Codex (`--base 7d8fe3e`): one P3 — the tui and update suites
  leave their empty git config folder in the system temp directory on every run. Accepted as T5f,
  wider than reported: the same copied block leaked in the init, install and project suites too,
  and 339 such folders had piled up on this machine.
- 2026-09-29: T5f done inline by the parent: each of the five suites keeps the folder's path and
  removes it in an `after` hook. Evidence: `node --test` → `tests 548 / pass 541 / fail 0 /
  skipped 7`, and the count of `*-gitconfig-*` folders in the temp directory was 339 before the run
  and 339 after (each run used to add five). The 339 existing folders are left for Sebastián to
  remove. Committed as 45c0737. Assessed (`--base-ref ebefc02`): risk `high`, 40 lines. Native review
  lineage review-232e1b7fd4672c9b: approved and acknowledged, three SUGGESTION of one kind (an
  `after` hook would throw on an undefined path if `before` failed first, and in tui.test.mjs the
  new removal runs after another that could throw), carried as follow-ups rather than a fourth
  round, since they matter only once setup has already failed. Codex (`--base ebefc02`): no
  actionable regression. Slice 5 is complete: T5 through T5f, each reviewed by gentle-ai and Codex.
- 2026-09-29: review of the exact PR range `7d8fe3e..d0c6e0e` (risk `high`, 1864 lines), started from
  the gentle-ai Stop hook's START. Native review lineage review-21a108c866330bc0: consent granted
  (pre-granted), four lenses, approved and acknowledged, four SUGGESTION carried as follow-ups:
  R2-skill-omits-outside-repo-scope (the installed skill does not say that outside a git repository
  the plain forms reach the machine), R2-status-switch-implicit-fallthrough (`statusMain`'s machine
  path is reached by falling out of the switch), R3-after-hook-undefined-configdir (the T5f point
  again), R3-status-value-dash-prefix (a flag value starting with `--` is read as missing).
- Follow-ups carried from slice 5, none blocking: R3-002 (a plain `status` in a repository that is
  not initialized exits 1, by the "Command scope" rule); the two whole-slice SUGGESTION above; the
  unguarded `after` cleanup (R4-after-hook-undefined-configdir, R3-001, R3-002 of the T5f review);
  the PR-range SUGGESTION above, of which the skill's missing outside-a-repository case is the one
  worth doing first, since agents read that text.
- 2026-09-29: PR `jsaristi/js-harness#12` opened on Sebastián's go-ahead (mergeable, clean; the repository has no CI checks).
- 2026-09-29: slice 5 merged as 8ca30ea (`jsaristi/js-harness#12`) by Sebastián's go-ahead.

- 2026-09-29: T6 done by a delegated writer on `feat/codex-plugin-doctor`: a sixth `tools` row,
  `codex-plugin` (see "T6 design"); a shared `spawnProbe`/`probeTimedOut` under the version and
  login probes; `pluginInstalledVersion` and `readMarketplacePluginVersion` take the plugin id and
  the marketplace. RED: `node --test` → 570 tests, 30 failing, all because the row did not exist.
  GREEN: `node --test` → `tests 570 / pass 563 / fail 0 / skipped 7`; `npm run check` exit 0;
  `npm run e2e` exit 0, 14 PASS, 0 FAIL; `node bin/js-harness.mjs doctor --offline` on this machine →
  `codex-plugin    1.0.6     ok        ok        n/a       unknown` (`unknown` because the offline
  cache has no entry for the new row yet).
- 2026-09-29: T6 committed as 578a2a8. Assessed (`--base-ref 4b5cef7`): risk `medium`,
  `review_due` (`slice_budget_reached`). Native review lineage review-c21a33f476e53c9d: consent
  granted (pre-granted), one lens (reliability), approved and acknowledged, one WARNING
  (R3-codex-home-overrides-user-env: the probe replaces a `CODEX_HOME` the user set) and one
  SUGGESTION (R3-login-probe-runs-when-plugin-absent). Codex (`--base 4b5cef7`): two P2 — a fresh
  cache from before the row keeps its `upToDate` `unknown` for up to 6 h, and the two-step install
  fix joined by `;` fails in `cmd.exe`; its sandbox could not run the tests. All four accepted as T6b.

- 2026-09-29: T6b done by the T6 writer, resumed: `resolveLatestVersions` refetches online when a
  fresh cache has no key for a looked-up row (a cached `null` counts as present); a fix may be a
  list, printed as a header line plus one indented command per line, and the codex-plugin install
  and gentle-ai upgrade fixes are lists; `codexLoggedIn` keeps a user-set `CODEX_HOME` when `home`
  is the real home (`env`/`homedir` injectable); the login is `n/a`, unprobed, unless the plugin
  is installed. RED: 584 tests, 12 failing (the fix format, the cache predating a row, the
  `CODEX_HOME` and not-installed cases). GREEN: `node --test` → `tests 584 / pass 577 / fail 0 /
  skipped 7`; `npm run check` exit 0; `npm run e2e` exit 0, 14 PASS, 0 FAIL.
- 2026-09-29: T6b committed as d4c4ca0. Assessed (`--base-ref 578a2a8`): risk `medium`, 410 lines,
  `review_due`. Native review lineage review-bcd1b28a2e539ad1: consent granted (pre-granted), one
  lens (reliability), approved and acknowledged, one SUGGESTION (R3-refetch-stamp-same-ms). Codex
  (`--base 578a2a8`): no actionable regressions; its sandbox could not run the tests. Accepted as
  T6c, done inline by the parent: `doctor.test.mjs` 37/37.
- 2026-09-29: T6c committed as 7edf366; the same commit stores this document with LF again (the
  parent's scripts had written CRLF into its blob since 578a2a8, which `autocrlf` then kept).
  Assessed (`--base-ref d4c4ca0`): risk `medium`, `review_due` (1637 lines, the line-ending
  change counted). Native review lineage review-ed7a7187fef3aa79: approved and acknowledged, one
  SUGGESTION (R3-next-step-stale-after-t6c: "Next step" still named T6), fixed in this closing
  commit. Codex (`--base d4c4ca0`): no actionable regression. Slice 6 is complete: T6 through T6c.

- 2026-09-29: review of the exact PR range `4b5cef7..1440dc2` (risk `medium`, 929 lines). Native
  review lineage review-1ee2cd9f1eb9835c: consent granted (pre-granted), one lens (reliability),
  approved and acknowledged, one SUGGESTION (R3-001: no hook- or TUI-level test meets a list fix;
  only `doctor.mjs` reads `fix`, checked with `grep`). Codex (`--base 4b5cef7`): two P2 — a
  cached `null` for the plugin's marketplace version outlives its installation for up to 6 h, and
  a missing Codex CLI gets `codex login` as its fix. Both P2 and R3-001 accepted as T6d.
- 2026-09-29: T6d done by the T6 writer, resumed: the two marketplace sources move to
  `LOCAL_SOURCES` (`bin/lib/latest.mjs`), read on every run and never cached, overlaid on the
  cache-backed network versions (`resolveNetworkVersions`); a failed login spawns `codex --version`
  and reports `codexCli`, which `probeTool` hands to `fix` as its second argument without copying it
  into the row; a hook test with a list fix. RED: 583 tests, 13 failing (`latest.test.mjs` at import,
  the local-row, missing-CLI and `codex --version` cases). GREEN: `node --test` → `tests 602 / pass
  595 / fail 0 / skipped 7`; `npm run check` exit 0; `npm run e2e` exit 0, 14 PASS, 0 FAIL;
  `node bin/js-harness.mjs doctor --offline` → `codex-plugin 1.0.6 ok ok n/a ok` and typescript-lsp
  `ok`, both real offline now.
- 2026-09-29: T6d committed as 69f533c. Assessed (`--base-ref 1440dc2`): risk `medium`, 557 lines,
  `review_due`. Native review lineage review-3018d2a09389347a: approved and acknowledged, two
  SUGGESTION carried (R3-codex-version-timeout-classified-ok: a timed-out `codex --version` counts
  as a present CLI; R3-extra-probe-latency-on-logged-out-path: a logged-out run can spend two probe
  timeouts). Codex (`--base 1440dc2`): no actionable regression.
- 2026-09-29: review of the exact PR range `4b5cef7..69f533c` (risk `medium`), started from the
  Stop hook's START. Native review lineage review-45fbd2168851e1c5: approved and acknowledged, one
  SUGGESTION (R3-t6-design-fix-separator-stale: "T6 design" still showed the `;` fix), fixed in this
  closing commit together with the rest of the design's T6b and T6d changes. Slice 6 is complete:
  T6 through T6d.
- Follow-ups carried from slice 6, none blocking: the two T6d SUGGESTION above; the MCP probes read
  `<home>/.codex` even when the user set `CODEX_HOME` (pre-existing, noted in `codexLoginState`).
  On this machine `doctor` reports codegraph not registered in Codex and outdated (1.6.0), which is
  codegraph's own fix to run, not this repository's.
- 2026-09-29: PR `jsaristi/js-harness#13` opened on Sebastián's go-ahead (mergeable, clean; the repository has no CI checks).
- 2026-09-29: review of the exact PR range `4b5cef7..50a9f52`, started from the Stop hook's START.
  Native review lineage review-24cbd5f0e6292369: approved and acknowledged, one SUGGESTION, the
  carried R3-codex-version-timeout-classified-ok again.
- 2026-09-29: slice 6 merged as 0d12e02 (`jsaristi/js-harness#13`) by Sebastián's go-ahead.

- 2026-09-29: T7 explored on `feat/codex-review-record` (from `main` at 8e0dea6); design recorded
  in "T7 design", split into T7 (the command and its record) and T7b (the check and the gate).
  Slice 7 = T7–T7b, forecast about 500 authored lines, one pull request against `main`.
- 2026-09-29: T7 done by a delegated writer: `bin/codex-review.mjs` (`codexReviewMain`) and
  `bin/lib/codex-reviews.mjs` (record path under the git common dir, append, tolerant reader),
  wired into the dispatcher. RED: both new suites failed with `ERR_MODULE_NOT_FOUND`. GREEN: the
  two suites 23/23; `node --test` → `tests 625 / pass 618 / fail 0 / skipped 7`; `npm run check`
  exit 0; `npm run e2e` exit 0, 14 PASS. Parent spot check: the two suites 23/23.
- 2026-09-29: T7 committed as c6e95b3. Assessed (`--base-ref 8e0dea6`): risk `medium`, 617
  lines, `review_due` (`slice_budget_reached`). Native review lineage review-dcab5f33b9234927:
  consent granted (pre-granted), one lens (reliability), approved and acknowledged, one WARNING
  (R3-dirty-tree-recorded-as-reviewed) and three SUGGESTION (R3-companion-gets-unresolved-base,
  R3-dispatch-untested, R3-accumulate-test-ignores-codes). Codex, run through the new command
  (`node bin/js-harness.mjs codex-review --base 8e0dea6`, exit 0, which recorded
  8e0dea6..c6e95b3 in `.git/js-harness/codex-reviews.jsonl`): one P2, an append after an
  unterminated last line joins the new record to it. All five accepted as T7c. The run printed a
  `DEP0190` warning from the companion's own spawn, not from js-harness (`codex-review.mjs`
  spawns an argv, no shell).
- 2026-09-29: T7c done by the T7 writer, resumed: an append after an unterminated last line
  writes a newline first; `codex-review` refuses while tracked files have uncommitted changes
  (`git status --porcelain --untracked-files=no`; `--unavailable` and untracked files are not
  blocked); the companion gets the resolved base id; a dispatcher-level test; the accumulate test
  asserts each exit code. RED: the three focused suites → 45 tests, 4 failing (the unterminated
  tail, both dirty-tree cases, the resolved base id). GREEN: the same → 45/45; `node --test` →
  `tests 632 / pass 625 / fail 0 / skipped 7`; `npm run check` exit 0; `npm run e2e` exit 0, 14
  PASS. Parent spot check: 45/45.
- 2026-09-29: T7c committed as 1d31b84. Assessed (`--base-ref 7a8e60f`, the passive docs commit
  7a8e60f having advanced the boundary from c6e95b3): risk `medium`, 104 lines, `under_budget`,
  so its review waits in the slice for T7b; so does its Codex review.
- 2026-09-29: T7b done by the T7 writer, resumed: `checkCodexReviews` and the `--push`/`--head`
  flags in `bin/check.mjs`; `.githooks/pre-push`; `.gitattributes` keeps `.githooks/*` LF so a
  CRLF checkout cannot break `sh` (the writer's addition, kept); AGENTS.md and the installed skill
  name `codex-review` and `check --push` (budget 1156/1500). RED: 43 tests, 8 failing, plus the new
  coverage suite failing at import. GREEN: focused suites 92/92; `node --test` → `tests 659 / pass
  652 / fail 0 / skipped 7`; `npm run check` exit 0; `npm run e2e` exit 0, 14 PASS. In this repo
  `node bin/check.mjs --push` (parent spot check) → `FAIL codex-review 2 of 3 code commits since
  origin/main have no Codex review record`, naming 8c42bf5 and 1d31b84: the gate catching the
  reviews still owed.
- 2026-09-29: T7b committed as 8c42bf5. Assessed (`--base-ref 7a8e60f`, T7c included): risk
  `high`, 670 lines, `review_due` (`high_risk`). Native review lineage review-01d8d8a9e2fe4b02:
  consent granted (pre-granted), four lenses, approved and acknowledged; four WARNING
  (R4-push-hook-full-suite-per-ref, R4-per-record-git-spawn-unbounded,
  R3-push-range-ignores-remote-sha, R3-push-rows-check-worktree-not-pushed-sha) and five SUGGESTION
  (R2-log-format-comment-mismatch, R2-md-regex-optional-quote-unexplained,
  R2-merge-test-comment-misleading, R3-hook-child-stdin, R3-root-commit-fix-hint). Codex, through
  `js-harness codex-review --base 7a8e60f` (exit 0, recorded 7a8e60f..8c42bf5): one P1, a push of
  `main` without `origin/HEAD` checks the empty `main..main`; two P2, the budget and test rows read
  the working tree instead of the pushed commit, and a failed `git status` reads as clean. All
  accepted as T7d.
- 2026-09-29: T7d done by the T7 writer, resumed: the base comes only from the remote's refs
  (`refs/remotes/<remote>/HEAD`, `<remote>/main`, `<remote>/master`; none fails naming `git remote
  set-head <remote> --auto`), `--remote <name>` (default `origin`) passed by the hook as `$1`;
  `check --push` builds only the `codex-review` row; a failed `git status` refuses the review;
  only records whose head lies in the checked range are expanded; the hook's `node` reads
  `/dev/null`; the three comments. One deviation, kept: the root-commit hint names `--base
  origin/main` instead of saying a root commit cannot be covered, since a range from unrelated
  history does reach it (tested). RED: 53 tests, 16 failing. GREEN: focused suites 119/119; `node
  --test` → `tests 668 / pass 661 / fail 0 / skipped 7`; `npm run check` exit 0; `npm run e2e`
  exit 0, 14 PASS. Parent spot check: `node bin/check.mjs --push` prints only `FAIL codex-review 1
  of 4 code commits since origin/main have no Codex review record`, naming 4c3cc5c, exit 1.
- 2026-09-29: T7d committed as 4c3cc5c. Assessed (`--base-ref ec7af8f`): risk `medium`, 285 lines,
  `under_budget`; the PR-range review of slice 7 covers it.
- 2026-09-29: review of the PR range `8e0dea6..a4460d4` (risk `high`, 1503 lines). Native review
  lineage review-b1cb480b4ad6c5d0: consent granted (pre-granted), four lenses, approved and
  acknowledged; three WARNING (R4-push-to-url-always-refused, R2-t7-design-stale-after-t7d,
  R3-record-head-beyond-pushed-tip-dropped) and four SUGGESTION (R4-companion-no-timeout,
  R2-codex-review-header-future-tense, R2-duplicated-git-helper, R2-oldest-uncovered-order-implicit).
  Codex, through `js-harness codex-review --base 8e0dea6` (exit 0, recorded 8e0dea6..a4460d4): two
  P2, a record whose head lies past the pushed ref is dropped, and a record without a valid schema
  or outcome counts as coverage. The design text is brought up to date in this commit
  (R2-t7-design-stale-after-t7d); the two P2, R3, R4-push-to-url and two SUGGESTION are accepted as
  T7e. Carried: R4-companion-no-timeout (a Codex review can rightly take many minutes, so a timeout
  needs a measured bound) and R2-duplicated-git-helper (a shared git helper across `check.mjs` and
  `codex-review.mjs`).
- 2026-09-29: T7e done by the T7 writer, resumed: `isValidCodexReview` in
  `bin/lib/codex-reviews.mjs` is the one place a record is judged, and the check counts invalid
  records apart; a record is expanded when its head is in the range or descends from the pushed
  tip (`git merge-base --is-ancestor`); a remote `git remote` does not list fails with `git remote
  add` and `--remote` hints; the header tense and the newest-first comment. RED: 44 tests, 16
  failing. GREEN: focused suites 96/96; `node --test` → `tests 686 / pass 679 / fail 0 / skipped
  7`; `npm run check` exit 0; `npm run e2e` exit 0, 14 PASS. Parent spot check: the two record
  suites 56/56.
- 2026-09-29: T7e committed as c5458b3. Assessed (`--base-ref 315794e`): risk `medium`, 190 lines,
  `under_budget`; as the slice's last commit it is covered by a final review of the whole PR range
  `8e0dea6..c5458b3` (risk `high`, 1692 lines). Native review lineage review-5533b08a00422e90:
  consent granted (pre-granted), four lenses, approved and acknowledged; two WARNING
  (R4-ancestor-probe-per-record-unbounded: one `merge-base` per record outside the range, so the
  cost still grows with every record written; R2-t7e-status-stale, fixed by this commit) and three
  SUGGESTION (R2-git-helper-triplicated, the carried helper point; R3-merge-resolution-code-unchecked:
  a merge whose conflict resolution adds code is exempt; R3-unrelated-record-still-spawns, the same
  cost as R4).
- 2026-09-29: Codex on T7e (`js-harness codex-review --base 315794e`), run twice: both times its
  sandbox denied process launch, so it could not read the diff and said so, yet its turn completed,
  the companion exited 0, and the command recorded `reviewed`. Both false records were removed
  from `.git/js-harness/codex-reviews.jsonl` (the file is ours; the three earlier records stay) and
  the skip recorded explicitly: `--unavailable "Codex's sandbox denied process launch, so it could
  not read the diff (two runs, 2026-09-29)"`. `node bin/check.mjs --push` → `PASS codex-review 5
  code commits since origin/main, all covered by a Codex review record`, the unavailable range
  listed under it. Slice 7 is complete: T7 through T7e.
- Follow-ups carried from slice 7, none blocking the gate's purpose (a skipped review is caught):
  first, **a completed Codex turn that could not inspect the diff is recorded as `reviewed`**,
  because the companion's exit 0 means the turn completed, not that the review ran (seen twice
  above); the command needs a signal from Codex's result, not its exit code, and until then the
  agent reads the verdict and replaces such a record with `--unavailable`. Then
  R4-ancestor-probe-per-record-unbounded with R3-unrelated-record-still-spawns (one batched
  ancestry query), R3-merge-resolution-code-unchecked, R2-git-helper-triplicated,
  R4-companion-no-timeout, and `init` writing the pre-push hook for projects that adopt the flow.
- 2026-09-29: `feat/codex-review-record` pushed on Sebastián's go-ahead; the new pre-push hook ran
  on the real push and passed (`PASS codex-review 5 code commits since origin/main`). PR
  `jsaristi/js-harness#14` opened (mergeable, clean; the repository has no CI checks).
- 2026-09-29: slice 7 merged as 94b9544 (`jsaristi/js-harness#14`) by Sebastián's go-ahead. The
  seven roadmap steps under "Project init" hold; the feature is complete.

- 2026-09-29: follow-up, a Codex turn that could not inspect the diff is no longer recorded as
  `reviewed` (branch `fix/codex-review-uninspected`). The companion exposes no structured signal:
  its native review returns only text. Of the 36 reviews stored under the plugin's data dir for
  this repo, the 4 that never saw the diff all said so ("I could not assess the patch", "could not
  inspect the changes", "correctness is unverified", "fail-closed verdict"), and none of the 32
  that did uses those phrases; several of those say tests or even `git diff` could not run, since
  they read the Git objects directly, so the patterns stay narrow. A new phrasing would still pass
  as `reviewed`, as before; the agent keeps reading the verdict. Route: delegated writer
  (`codex-review.mjs` and its test). RED: 24 tests, 5 failing. GREEN: `node --test
  bin/codex-review.test.mjs` 24/24; `node --test` → `tests 691 / pass 684 / fail 0 / skipped 7`;
  `npm run check` exit 0. Parent spot check: the suite 24/24.
- 2026-09-29: committed as 438364a. Assessed (`--base-ref main`): risk `medium`, 146 lines,
  `under_budget`; as the slice's only commit it was reviewed whole. Native review lineage
  review-cb64d83a7b625fb2: consent granted (pre-granted), one lens (reliability), approved and
  acknowledged; one WARNING, R3-maxbuffer (the piped stdout kept Node's 1 MiB `spawnSync` default,
  so a long review would end as a misleading "could not start it"), accepted and fixed in the next
  commit (`maxBuffer` 64 MiB, ENOBUFS named; RED 1 failing, GREEN 25/25); two SUGGESTION carried:
  R3-buffered-output (the review text now appears when the companion exits, not streamed) and
  R3-classifier-false-positive ("changes are unverified" or "incomplete review" said in passing
  would refuse a real review; the cost is a rerun, the phrases seen so far are only the four).
  Codex (`js-harness codex-review --base main`): the turn failed, 400 "The 'gpt-6.1-sol' model is
  not supported when using Codex with a ChatGPT account" (`model = "gpt-6.1-sol"` in
  `~/.codex/config.toml`, Sebastián's); the command exited 1 and wrote nothing, as it should.
- 2026-09-29: the R3-maxbuffer fix committed as 5d584b9 (assessed `--base-ref 438364a`: risk
  `medium`, 40 lines, `under_budget`). Codex skip recorded for `21c491d..5d584b9` with
  `--unavailable` naming the rejected model; `node bin/check.mjs --push` → `PASS codex-review 2
  code commits since origin/main, all covered`, exit 0. Next: push and open the PR on Sebastián's
  go-ahead; a real Codex review of this range waits for a model the ChatGPT plan accepts.

## Next step
None for this feature: it is complete. Its carried follow-ups (Progress, slices 5 to 7) are
separate later work; the first of slice 7's, a Codex turn that could not inspect recorded as
`reviewed`, is done on `fix/codex-review-uninspected` (Progress, last entries), awaiting push and
PR on Sebastián's go-ahead. The installed skill on this machine still carries
the old text until `js-harness` is reinstalled from `main` and synced.

# Codex review through `codex exec`

Locator: `odd/tasks/codex-exec-review.md` · Engram mirror: `odd/codex-exec-review/tasks` · Branch:
`fix/codex-review-uninspected` (with the classifier work before it), merged via
`jsaristi/js-harness#15` as b1e3462

## Objective
`js-harness codex-review` runs Codex's review so that it can actually read the diff on this
machine, and records `reviewed` only on evidence that it did, never on its wording.

## Problem and evidence (2026-09-29)
From the 41 review jobs the Codex plugin stored for this repo, and live probes:

1. Codex 0.159.1 (installed 2026-09-29 22:32–22:35Z) runs commands through `pwsh.exe` found on
   PATH at `%LOCALAPPDATA%\Microsoft\WindowsApps` (an app-exec alias, reparse tag `0x8000001b`, of
   the Microsoft Store PowerShell 7.6.6). The `unelevated` Windows sandbox cannot start it:
   `codex sandbox -- <pwsh> -Command "git rev-parse --short HEAD"` → `CreateProcessAsUserW failed:
   5`, through the alias and the real WindowsApps path alike, while `powershell.exe` 5.1 prints the
   commit. Since the update every shell command in a review fails (exit -1). Before it, Codex used
   `cmd.exe` and 13–51 commands ran per review.
2. In 6 of 41 reviews the model used `cua_repl/js`, the REPL of the Codex desktop app's
   `unified-computer-use@openai-bundled` plugin, instead of the shell; process launch is denied
   there, so it never ran `git diff`. Every review that said it could not assess the patch ran zero
   shell commands.
3. Two turns failed with 400 "model not supported with a ChatGPT account" (gpt-6-astra 09-27,
   gpt-6.1-sol 09-29 22:37Z). Likely a stale app-server behind the plugin's persistent broker: the
   current broker started 00:00Z and the same model worked from then on (inferred, not proven).
4. Tests never run inside a review: the read-only sandbox denies spawning and temp dirs. By design;
   pre-commit runs them.

The plugin passes no per-thread config (`buildThreadParams`, `scripts/lib/codex.mjs:63` of
`codex@openai-codex` 1.0.6) and returns only text, so none of this is fixable through it.

Probes: `codex exec --json` with `WindowsApps` removed from PATH and `-c` disabling
`unified-computer-use` and `computer-use` → `powershell.exe` 5.1, `git rev-parse` exit 0.
`codex exec review --json --base 438364a` the same way → 6 `command_execution` items (5 exit 0,
including `git diff 438364a…`), no REPL call, one `agent_message` with two P2 findings, then
`turn.completed`.

## Design
- `codex-review --base <rev>` spawns `codex exec review --json --ephemeral --base <merge-base of
  rev and HEAD>`
  with `-c sandbox_mode=read-only -c approval_policy=never` and the two desktop plugins disabled,
  stdin ignored, from the repository root; on win32 the child's PATH drops every
  `\Microsoft\WindowsApps` entry. The Claude Code plugin is no longer involved (it stays useful for
  `/codex:*` commands).
- Evidence: `reviewed` is recorded only when the JSONL has `turn.completed`, a non-empty final
  `agent_message`, and every changed line of our own `git diff <merge-base> HEAD`, keyed by its
  file (inside hunks, ANSI stripped, ASCII-normalized since PowerShell 5.1 re-encodes the rest,
  blank ones dropped), appears under the same file in the diff output of a completed
  `command_execution` with exit 0. What Codex saw is the evidence, not how
  its commands read (the command-text rule it replaced leaked; history in Progress). Otherwise
  nothing is written
  and it exits 1, listing the commands that ran with their exit codes and the two ways on. A
  failed turn or non-zero exit prints Codex's error events (e.g. a rejected model).
- The text classifier is removed; the review text is still shown as is.
- Out of scope: the user's own Codex sessions still hit the Store PowerShell; the fix there is a
  non-Store PowerShell 7 (`winget install --id Microsoft.PowerShell --source winget`), which is
  Sebastián's call.

## TDD
Mode: strict (source: user global config). Runner: `node --test`.

## Tasks
- [x] T1 `codex-review` runs `codex exec review --json` as designed and records on evidence; the
  classifier goes; tests cover evidence, no evidence, failed turn, missing CLI, PATH filtering and
  the exact argv — route: delegated writer (`bin/codex-review.mjs` and its test)
- [x] T2 Docs follow the code: the T7 design in `odd/tasks/project-init.md`, the roadmap's Review
  row, the installed skill text in `bin/lib/manifest.mjs` — route: same writer
- [x] T3 A real run on this branch records `reviewed` — route: inline
- [x] T4 Evidence from what Codex saw, not from how its commands read: every changed line of
  `base..HEAD` (from our own `git diff`, compared ASCII-normalized, since PowerShell 5.1 re-encodes
  non-ASCII) appears in the output of a successful command; the command-string parser goes —
  route: delegated writer (the T1 writer, resumed)
- [x] T5 The review spawn is asynchronous with its own timer, and a timeout kills the whole process
  tree (`taskkill /T /F` on Windows), so a stall cannot outlive the bound — route: same writer

## Acceptance criteria
- A real `js-harness codex-review --base main` on this machine runs shell commands successfully and
  records `reviewed` with a successful `git diff` among them.
- `node --test` and `npm run check` pass.

## Progress
- 2026-09-29: diagnosis and probes above; document created. Sebastián asked to investigate and fix
  it so reviews work without failures.

- 2026-09-29: T1 and T2 by the delegated writer: `codexArgs`, `childEnv` (PATH filter),
  `quoteWindowsArg`/`windowsCommandLine` (the `codex.cmd` shim needs `cmd.exe`; quoting for the C
  runtime, cmd metacharacters refused), `parseEvents`, `reviewEvidence`; the classifier removed;
  `--home` still parsed but ignored. Docs: the T7 design points here, the roadmap's Review row, the
  installed skill text. RED: the new suite could not load (exports missing). GREEN: 42/42; `node
  --test` → 709 / 702 pass / 0 fail / 7 skipped; `npm run check` and `npm run e2e` (14 PASS) exit 0.
  Smoke test of the spawn path through the same helpers: `powershell.exe` 5.1, `git rev-parse`
  exit 0, no `cua_repl` call. Parent: `git diff --stat` alone counted as reading the diff; each
  chained segment is now judged alone and `--stat`, `--name-only`, `-s` and the like never count
  (RED 1 failing, GREEN 42/42, suite 709/702/0/7).

- 2026-09-29: committed as 3570bbf. Native review lineage review-a249dd24379872b3 (the branch,
  955 lines): approved and acknowledged; both findings accepted. R3-readsdiff-textual-match (WARNING:
  `rg "git diff"`, a bare `git diff` or `git show <rev>:<path>` counted): a segment now counts only
  when it starts with git (after a stripped shell launcher), runs `diff` or `log -p`, prints the
  patch, has no `<rev>:<path>` argument, and names the base commit (full id or 7+ hex prefix, also
  as `base..`); `git show` no longer counts, and `--check` is excluded (the real probe ran `git diff
  --check <base>`). R3-win32-missing-cli-misdiagnosis: a `codex --version` probe through the same
  launch path runs before the review; the exit-code heuristic is gone. Route: the writer, resumed.
  RED: 45 tests, 6 failing. GREEN: 45/45; `node --test` → 712 / 705 / 0 fail / 7 skipped; `npm run
  check` and `npm run e2e` (14 PASS) exit 0; the real probe returned `codex-cli 0.159.1`. Parent:
  no control characters in either file; suite 712/705/0/7.

- 2026-09-29: committed as 8987523. Native review lineage review-89f0d26212a6aaf5 (1104 lines):
  approved and acknowledged; all three accepted, inline: R3-pathspec-limited-diff-counts (a diff
  limited by a pathspec after `--` read only some files; now refused, `-- .` allowed),
  R3-review-spawn-no-timeout (the review spawn gets 30 minutes, reported as "ran past 30 minutes";
  on Windows the timeout stops the `cmd.exe` shim, and a Codex child it leaves behind is not killed),
  R3-docs-git-show-counts (this Design section and the T7 bullet). RED: 46 tests, 2 failing; one
  existing fixture used a pathspec for length and now uses `--unified=`. GREEN: 46/46; `node --test`
  → 713 / 706 / 0 fail / 7 skipped.

- 2026-09-29: committed as 77733e5. Last native round, lineage review-f691c6cc89f9146d (1138
  lines): approved and acknowledged; R3-win32-timeout-unbounded (WARNING: the timeout kills only the
  `cmd.exe` shim; the Codex grandchild keeps the stdout pipe open, so spawnSync may not return) and
  R3-readsdiff-partial-range (a diff to an earlier commit, `git log -p -1`) → T5 and T4.
- 2026-09-29: T3. `node bin/js-harness.mjs codex-review --base main` → Codex (gpt-6.1-sol, high)
  ran 8 commands through `powershell.exe` 5.1, all exit 0, `git diff` among them, no REPL call;
  recorded `reviewed` for `21c491d..77733e5`. Its review: P1 a chained command's exit 0 hides a
  failed `git diff` (`git diff <base> --bad; git status`), P2 `git diff <base> <base>` and `git log
  -p <base>` name the base but not the range, P2 implicit pathspecs (`git diff <base> file`), P2
  `--stat -p` prints the patch but is refused. All four come from judging command text, the same
  trap as the classifier one level down. Probe: in the stored probe run, the outputs of the
  successful commands contain 281 of the 281 changed lines of the true `git diff` (ASCII-normalized),
  so the output itself is the evidence → T4, which answers all four and R3-readsdiff-partial-range.

- 2026-09-29: the stop hook's review of 72ad788 (lineage review-ab662fd6966e7f11, 1158 lines)
  approved and acknowledged; its three WARNING (chained exit masks a failed diff, partial range,
  win32 timeout) are T4 and T5.
- 2026-09-29: T4 and T5 by the writer, resumed. T4: our own `git diff --no-color --no-ext-diff
  <base> HEAD` gives the changed lines (inside hunks, ASCII-normalized, blank ones dropped,
  deduped); `reviewEvidence(events, expectedLines)` needs every one of them in the pooled output
  of successful commands; the command-text parser is gone. T5: the review is an async child with
  its own timer; timeout or overflow kills the tree (`taskkill /PID <pid> /T /F` on Windows, the
  process group elsewhere, where the child is detached) and resolves at once; one progress line
  per completed command. RED: 64 tests, 44 failing. GREEN: 64/64; `node --test` → 731 / 724 / 0 /
  7; `npm run check` and `npm run e2e` exit 0. Sanity check on the stored real run: 232 of 232
  distinct changed lines seen (281 raw, 19 blank). Real spawn on this machine: the async launch
  path runs; a real sleeper hit a 1.5 s timer and returned about 2 s later with no process left.
  Parent: off Windows the detached child no longer got Ctrl-C, so SIGINT/SIGTERM now kill the tree
  first (`signals` dep, handlers removed after; RED 1 failing, GREEN 65/65, suite 732/725/0/7).

- 2026-09-29: committed as c517cc9. Native review lineage review-43fc8d457a39efc2 (1525 lines):
  approved and acknowledged. Accepted, inline: R3-expected-diff-not-merge-base (a base past the
  fork point put foreign commits into the two-point diff; the expected patch and Codex's `--base`
  now come from the merge-base, the record keeps the base asked for), R3-stop-leaves-pipe-referenced
  (on a stop the stdout pipe is destroyed and the child unref'd), R3-docs-describe-old-evidence-rule
  (this Design section, the T7 bullet, the roadmap row, the installed skill text). RED 1 and 1
  failing; GREEN 66/66. Carried: R3-exact-coverage-large-range (exact coverage could refuse a large
  range if Codex truncates output or reads by file; fail-closed, needs measured runs before any
  tolerance).

- 2026-09-29: committed as d76fafb. Native review lineage review-b6355efefb4ebc66 (1577 lines):
  approved and acknowledged; carried R3-probe-win32-timeout-unbounded (the `codex --version` probe
  keeps spawnSync's shim-only timeout on Windows, the same pattern as `doctor`'s `spawnProbe`).
  Real run: `js-harness codex-review --base main` streamed 13 commands (a `git diff 21c491d…` among
  them, exit 0) and recorded `reviewed` for `21c491d..d76fafb`. Codex's two P2, accepted: file
  identity was lost (the same change in two files was covered by one file's diff) and ANSI colour
  codes left `[31m` fragments. The writer, resumed: `patchKeys` parses our patch and each output
  alike, keys are `<file>` + line inside a `diff --git` hunk, ANSI CSI stripped; output without diff
  context counts for nothing. RED: 74 tests, 14 failing. GREEN: 74/74; `node --test` → 741 / 734 /
  0 / 7; `npm run check`, `npm run e2e` exit 0; stored real run: 232 of 232 keys seen.

- 2026-09-29: committed as 0983f46; the last round. Native review lineage review-8f2668e536618ad4
  (1701 lines): approved and acknowledged, one SUGGESTION carried (R3-stop-reason-ignores-injected-
  bounds: the timeout and overflow messages print the module constants, not injected bounds; only
  tests inject them). Codex (`js-harness codex-review --base main`): 9 commands, all exit 0, a `git
  diff 21c491d…` among them; recorded `reviewed` for `21c491d..0983f46`. Its three P2 are carried
  with their trade-offs: identical changes in two hunks of one file collapse to one key (keying by
  hunk header would refuse a review that used other context, `-U10`; counting occurrences can be
  fooled by a repeated diff), non-ASCII file names that normalize alike collide (`café.js`,
  `cafè.js`), and a git-quoted path on one side and `core.quotePath=false` on the other give
  different keys (a false refusal, fail-closed). All three need non-ASCII names or repeated identical
  hunks. Carried from earlier rounds: R3-exact-coverage-large-range, R3-probe-win32-timeout-unbounded.

## Carried follow-ups
- Coverage identity: identical changes in two hunks of one file; non-ASCII names that normalize
  alike; git-quoted versus unquoted paths (Codex, last round).
- Exact coverage on a large range if Codex truncates output or reads by file; measure real runs
  before any tolerance (R3-exact-coverage-large-range).
  Closed on 2026-10-08 by `odd/tasks/codex-review-lean.md` (T9, T12), without a tolerance: a
  range above 400 changed lines is reviewed in parts of whole files, each held to the same
  exact rule, and the ten real reviews of the comparison saw every changed line (216 of 216
  and 226 of 226).
- The `codex --version` probe's timeout on Windows stops only the shim (R3-probe-win32-timeout-
  unbounded), shared with `doctor`'s `spawnProbe`.
- Failure messages print the constant bounds, not injected ones (R3-stop-reason-ignores-injected-
  bounds).
- The user's own Codex sessions still reach the Store PowerShell; a non-Store PowerShell 7
  (`winget install --id Microsoft.PowerShell --source winget`) fixes them (Sebastián's call).
- `mcp_servers.context7.type` in `~/.codex/config.toml` is ignored by Codex 0.159.1 and warns on
  every run.
  Since 2026-10-08 a review no longer meets it: the lean session, the default of
  `codex-review`, does not read that file. It still warns in his own Codex sessions.

- 2026-09-29: pushed on Sebastián's go-ahead; the pre-push hook passed on the real push (`PASS
  codex-review 11 code commits since origin/main`). PR `jsaristi/js-harness#15` opened (mergeable,
  clean; no CI checks) and merged as b1e3462 on his go-ahead.

## Next step
None for this feature: it is complete. Its carried follow-ups (above) are separate later work.

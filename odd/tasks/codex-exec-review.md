# Codex review through `codex exec`

Locator: `odd/tasks/codex-exec-review.md` · Engram mirror: `odd/codex-exec-review/tasks` · Branch:
`fix/codex-review-uninspected` (on top of the classifier work, not yet pushed)

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
- `codex-review --base <rev>` spawns `codex exec review --json --ephemeral --base <full base id>`
  with `-c sandbox_mode=read-only -c approval_policy=never` and the two desktop plugins disabled,
  stdin ignored, from the repository root; on win32 the child's PATH drops every
  `\Microsoft\WindowsApps` entry. The Claude Code plugin is no longer involved (it stays useful for
  `/codex:*` commands).
- Evidence: `reviewed` is recorded only when the JSONL has `turn.completed`, a non-empty final
  `agent_message`, and at least one completed `command_execution` with exit 0 that reads the
  diff (`git diff`, `git show`, or `git log` with `-p`/`--patch`). Otherwise nothing is written
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
- [ ] T3 A real run on this branch records `reviewed` — route: inline

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

## Next step
T3: a real `js-harness codex-review --base main` records `reviewed`.

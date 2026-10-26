# remote-stop-kept-batch

Branch `fix/remote-stop-kept-batch`, from main (c3b8628). One pull request. Runner: `node --test`.

## Goal
`js-harness remote stop --at-login` never says the login launcher is off while it keeps a batch launcher of an earlier version.

## Why
With no `.vbs` launcher and a `js-harness-remote-<id>.cmd` that was edited since js-harness wrote it, or one never recorded, the stop refused on stderr and exited 1, but stdout also said `login launcher: off (there was none)`. That line was false: the `.cmd` still starts the server at every login. In `disableLauncher` (`bin/lib/remote-launcher.mjs`), `removeLauncherFile` returns `{ ok: false }` with no `line` for a kept file, so `batchSaid` was false and the launcher's "nothing" line was logged. JH 51, from the lead's brief.

## Done when
- `node --test bin/remote.test.mjs` exits 0
- `npm run check` exits 0
- With no `.vbs` and a kept `.cmd` (edited; not recorded), stdout has no "login launcher: off" line, stderr names the kept file, exit 1. No files and no records still say "off (there was none)" and exit 0; a recorded `.vbs` is removed; a recorded unedited `.cmd` is removed with its line only; an edited `.vbs` is kept (exit 1).

## In scope / Out of scope
- In: `disableLauncher` in `bin/lib/remote-launcher.mjs` and its tests in `bin/remote.test.mjs`.
- Out: the lines said when a `.vbs` was removed and a `.cmd` kept. The brief names only the "there was none" line, and the refusal already names the kept file.

## Constraints
- Tests go through `remoteMain`, as their neighbours do — because the output of the command is what was false.

## Ask me before
Nothing: a bug fix the lead briefed.

## Tasks
- [x] T1 (kind: build) the kept batch launcher holds back the "nothing" line, in e5ed506b. Route: inline.

## Log
- L1. 2026-10-26, the test written first and seen failing (`actual: 'login launcher: off (there was none)\n...'`); then 119 of 119 pass in `bin/remote.test.mjs`. gentle-ai on e5ed506b: medium, not due (under_budget, 29 lines); the slice is this pull request. Codex on c3b8628..e5ed506 (37,643 input tokens): "the patch is correct (confidence 0.98)", no findings, recorded.

# JH 135 · fix the red daily Windows run

File: docs/sessions/2026-11-02-jh-135-fix-the-red-daily-windows-run.md.

## Goal
Fix the one failing test of the daily Windows run 41489272123 on `main`, small work with no feature document, from
the brief `C:\Users\Oficina\.js-harness\background\briefs\2026-11-02T20-05-56-396Z-06ebb7d7.md`.

## The user's words
None in this session: the brief is the lead's.

## Delivered
- Pull request jsaristi/js-harness#760, ready, not merged. Branch `worktree-fix-windows-daily`.
- 085b3a6a fix(stack): the cleanup of "stack takes an empty JS_HARNESS_HOME as unset" awaits `fs.promises.rm` with
  `maxRetries: 10, retryDelay: 200`; entry `windows-probe-holds-test-folder` in `docs/FAILURES.md`.
- b5ee4786 docs(failures): the entry cites the test's cleanup, not a line the fix moved (gentle-ai R3-001).

## Decisions
- This session's: the fix is in the test, not in the probe; a Windows tree kill of a timed-out probe is larger than
  the brief's small fix, and is left below.

## Failures and lessons
- Cause: on win32 a stack probe runs through cmd.exe, and its 5 s timeout kills only cmd.exe; the tool under it keeps
  the test's folder as its working directory, which Windows will not remove. The same test and the same `EPERM`
  failed runs 40702921457, 41071093780 and 41489272123, each in about 5.5 s (`gh run view <id> --log-failed`).
- Reproduced with a `codegraph.cmd` that waits 8 s first on the PATH: `EPERM` in about 6 s before, a pass in 9.2 s
  after; `node --test bin/stack.test.mjs`: 15 pass, 0 fail.
- The first fix, `fs.rmSync` with `maxRetries`, still failed: Node 24.15's rmSync fails an EPERM at once (0 ms on a
  busy folder), while `fs.promises.rm` retries it (3,048 ms). Measured with a probe script before the second edit.
- A first `gentle-ai review start` was read through `tail -40`, which cut its head; the start was run once more to
  read it, and was replayed, not doubled.

## Left
- The code still leaves a timed-out Windows probe's tool running until it ends: the lead's to schedule.
- `bin/contract.test.mjs:402` relies on rmSync's `maxRetries` too; it has not failed.
- Proof of the fix: the next windows-daily runs name no failing test of `bin/stack.test.mjs`.
- gentle-ai R3-002, left: if the first removal exhausts its retries, `home` is not removed; the same before the change.

## Cost
- From the brief at 20:05Z to the ready notice at 20:21Z; 28% of the context at the ready notice.
- Gates: 2 pre-commit gates, both PASS.
- Reviews: Codex once over 13c6153..085b3a6 (32,849 input tokens, correct at 0.97); the Claude lenses reliability
  and resilience once (0 findings); gentle-ai review-reliability once (approved, acknowledged).

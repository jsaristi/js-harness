# A waiting gate whose launcher died runs nothing

Locator: `odd/tasks/orphan-gate.md` · Engram mirror: `odd/orphan-gate/tasks` · Branch: `feat/orphan-gate` ·
Delivery: `ask-on-risk` · Runner: `node --test`

## Goal
A `js-harness gate` that waits for its turn, and whose launcher has ended, gives up its place in the
line and runs nothing, and says so in the gate log.

## Why
On 2026-10-14 a TaskStop of a queued turn killed its shell but left the `gate --wait` node alive (JH 5,
16:0x); when its turn came that orphan would have run its script and committed a half-edited tree. JH 5
killed it by hand, and the lead saw the same with two of its own background loops.

## Done when
- `node --test bin/lib/launcher.test.mjs` exits 0
- `node --test bin/gate.test.mjs` exits 0
- `npm run check` exits 0
- A gate whose launcher is killed while it waits ends with exit 75, a `refused` line in the gate log
  whose reason is `launcher gone`, and its command never started.

## In scope / Out of scope
- In: `bin/lib/launcher.mjs` and its test, the wait loop of `bin/lib/gate-lock.mjs`, `takeGateTurn` and
  `refusalSaid` in `bin/check.mjs`, `bin/gate.mjs`, their tests.
- Out: a gate whose command already runs (the lead asked for the wait), and `check`'s own wait in a
  commit's hook: its launcher is git, whose death ends the commit anyway.

## Constraints
- A launcher that cannot be read is never taken for a dead one — a gate must never give up a live
  session's turn on a failed look.

## Effort
high

## Ask me before
Nothing planned.

## Specs
- **S1** (the lead, 2026-10-14, after Codex out of the lock): "Fix in the gate: before it commits, a
  waiting gate checks that the process that started it is still alive (parent pid, or the session's
  process), and if not it gives up its place and commits nothing, saying so in the gate log. Test first.
  Tell me if you see a better signal than the parent pid on Windows."
  - The signal, as built: the gate's launchers are its parent and, when that parent is a `cmd.exe` (the
    shim of an installed `js-harness`), the process above it too; each is known by its pid and its start
    time, read once when the gate starts. On Linux the parent is gone when `process.ppid` is no longer it
    (an orphan is adopted). On Windows a pid is reused and no orphan is adopted, so each poll asks
    whether every launcher's pid still exists, and the last look before the command starts also asks that
    its start time is the one read at the start.

## Tasks

| ID | Specs | Route | Status | Evidence |
|----|-------|-------|--------|----------|
| T1 | S1 | inline | done, pending its commit | RED then GREEN: the wait loop (`gate-lock.test.mjs`), the two gate cases (`gate.test.mjs`), the broken chain (`launcher.test.mjs`); the real kill test failed first on a real defect (below) |

## Log
- **L1** (2026-10-14): the lead's order, S1, verbatim.
- **L2** (2026-10-14, measured on this machine): a node run from a Git Bash script (two commands, so the
  shell forks) has as its parent a stub `sh.exe`, not the script's shell. With the script's shell killed
  by `kill -9`, node and that stub both stayed alive (`process.kill(pid, 0)` on each). So the parent pid
  alone would never have seen JH 5's orphan; the chain of shells above it does. Reading the Windows table
  (`Get-CimInstance Win32_Process`) took about a second, which is why a gate reads it only once it waits.
- **L3** (2026-10-14): the first run of the real kill test failed: the PowerShell format used a tab in
  single quotes, which PowerShell does not expand, so no row parsed and the chain fell back to the parent
  alone. Fixed with a `|` apart, which no file name holds; the same test then passed. The unit tests of
  `launcher.mjs` were run only after it was written, so their RED is the missing module, not seen apart.
- **L4** (2026-10-14): the cost. A gate that takes the lock at its first look reads no table and asks
  nothing (tested); one that waits reads the chain once at its second look, checks its pids at every
  look (`process.kill(pid, 0)`), and reads the table once more before its command starts.
- **L5** (2026-10-14): the first gate failed in WSL2 on the unit test of `launchersAlive`: on Linux the
  look also asks whether `process.ppid` is still the first launcher, and the test's made-up pids are no
  parent of the test. The cases that are not about adoption now pass `ppid: null`; 5/5 on Windows and in
  WSL2 (its node, `/home/oficina/.local/node/bin/node`), the real kill test included.

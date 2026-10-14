# The gate's sensors in WSL2

Locator: `odd/tasks/gate-wsl.md` · Engram mirror: `odd/gate-wsl/tasks` · Branch: `feat/gate-wsl` ·
Delivery: `ask-on-risk` · Runner: `node --test`

## Goal
On a Windows machine that opts in, the sensors of a gate's turn run in WSL2 from a mirror of the
working tree on the Linux disk, while the lock, the gate log and every git question stay on Windows.

## Why
The same suite takes 145 s on GitHub's Linux (run 38511223058) and 11 to 12 minutes here; in the
three hours before 00:10 on 2026-10-14 the lock was never free and sessions waited 235 minutes in
all (the orchestrator's measure, `odd/tasks/gate-wait.md`, "Resume here"). Process starts and file
reads are what Windows makes slow, and the suite is made of them.

## Done when
- `node --test bin/lib/gate-wsl.test.mjs bin/check.test.mjs` exits 0
- `npm run check` exits 0
- On this machine, with the switch file in place, a gate's end line in the gate log says its sensors
  ran in WSL2, and its seconds are written beside the Windows seconds of the same commit.
- With the switch file absent, or `JS_HARNESS_GATE_WSL=0`, a gate runs as it does today.

## In scope / Out of scope
- In: `bin/check.mjs` (where the sensors of a turn run), a new `bin/lib/gate-wsl.mjs` and its test,
  the docs that name the switch.
- Out: the lock, the gate log's other fields, `js-harness gate -- <command>` (it runs any command,
  not sensors), the gate on GitHub (the session "JH 10"), his Windows settings and `.wslconfig`
  (his machine: the text goes to him through the orchestrator).

## Constraints
- Opt-in per machine: an installed project gets nothing new unless its machine has the switch file —
  because a project that does not use WSL must not pay a probe on every gate.
- Never a silent pass: a mirror that cannot be synced or a distro that does not start runs the
  sensors on Windows, and a row says why — because a gate that skipped its suite is worse than a slow one.
- Everything outside the repo is undone by deleting it: the switch file in the js-harness home,
  `~/.local/node*` and `~/.js-harness-gate` in his Linux home.

## Effort
high

## Ask me before
Anything on his Windows machine outside the js-harness home (`.wslconfig`, services, antivirus).

## Resume here
- 02:23 · T2b committed (`adae7c8`); Codex over `3f59bb2..adae7c8` recorded, incorrect, four P2 (L8);
  T2c, their correction, written with its tests, green, in its commit turn (`t2c-turn.sh`,
  `t2c-msg.txt`). Then Codex over `adae7c8..<T2c>` once, then the pull request.
- After 109 is on `main`: `main` merged in and T3, one real gate in WSL2.

## Specs
- S1 — His answer, `ffe99ebf-72fb-48da-a79b-e7db21a20b3f` line 1350 (2026-10-14T05:41Z): "Se instala
  ahora y ademas tiene que quedar funcionando y JH8 tiene que diseñarlo ya y debe quedar funcionando ya".
- S2 — The orchestrator's plan (01:03, its message): node 22 or later from the nodejs.org tarball in
  his Linux home, no sudo; the code run from a mirror on the Linux filesystem synced before each run,
  not over `/mnt/d`; a memory cap in `C:\Users\Oficina\.wslconfig` is his file: its text goes to the
  orchestrator; measure WSL against Windows on the same commit and give both numbers; Windows stays
  covered by one local whole run per merged batch.

## Design
- **The switch:** `<home>/.js-harness/gate-wsl.json`, `{ "distro": "Ubuntu", "node": "<linux dir of
  node>" }`, says how; the project's `harness.json` `"sensorsInWsl": true` says whether (reader A: a
  file of the machine alone would move every project on it). Both present: the sensors of a gate's
  turn run in WSL2. `JS_HARNESS_GATE_WSL=0` in
  the environment runs one gate on Windows (the run per merged batch). A file that does not parse is a
  FAIL row, like a broken `harness.json`.
- **One run:** `checkSensor` writes a runner script with LF ends into the throwaway home it already
  makes (under `%TEMP%`, so `/mnt/c/...` inside), and runs `wsl.exe -d <distro> --exec bash <runner>`
  through `runSensor`, which keeps its timeout and its kill of the tree. The runner: `rsync -a
  --delete` of the tree (without `.git`, `.codegraph`, `node_modules`) into
  `~/.js-harness-gate/mirrors/<name>-<hash of the path>`, a marker line once synced, then the sensor's
  command under `env -i` (a Linux home of its own, `PATH` of Linux alone with the node of the switch,
  `JS_HARNESS_CHECK_INNER=1`, the held mark when the gate holds the lock) and inside `timeout` a little
  shorter than the sensor's.
- **The fallback:** no marker in the output means the mirror was never reached: the sensor runs again
  on Windows and an INFO row named `wsl` says why. A marker and a failing command is the suite's own
  failure.
- **The record:** each sensor of the gate log's end line gets `ranIn: "wsl"` when it ran there.
- **What stays on Windows:** the lock, the load sample, the tree key and its proof, the untracked look,
  the documents' sensors (seconds, no turn).
- **Temporary files of a Windows run:** `TEMP` and `TMP` on `D:\js-harness-tmp`, inside his Defender
  exclusion of `D:` (the orchestrator, its message read at 01:25: excluding all of `%TEMP%` would weaken his machine). A
  sensor takes `TEMP` from the gate's environment already (`os.tmpdir()` reads it, and so does its
  throwaway home), so the run per merged batch is
  `TEMP=D:\js-harness-tmp TMP=D:\js-harness-tmp JS_HARNESS_GATE_WSL=0` before the gate; whether a
  fallback run on Windows should set it by itself, from a field of the switch file, was the
  orchestrator's to say, and it said no for now (its message, read before 01:28). So the run per merged
  batch, in a lock turn on `main` after the batch's merges, is exactly:
  `TEMP='D:\js-harness-tmp' TMP='D:\js-harness-tmp' JS_HARNESS_GATE_WSL=0 node bin/check.mjs`.
  A run that forgot the first two is seen in its report: with the variable and the switch file, each
  sensor's row ends "on Windows (JS_HARNESS_GATE_WSL=0), its temporary files under <folder>".
- **What Windows loses per commit:** the code paths of `win32` (process trees, PowerShell, `cmd.exe`
  quoting) are tested in the run per merged batch and in no commit's gate. That is the price.

## Tasks
- [x] T1 · S1-S2 · measure: the test sensor of `3f59bb2` in WSL2 (mirror) and on Windows, one lock
      turn · inline · WSL2 111.5 s (one known failure, L3), Windows 603 s (L5)
- [x] T2 · S1 · `bin/lib/gate-wsl.mjs` (switch, runner text, path to `/mnt`), the route in
      `checkSensor`, the fallback row, `ranIn` · inline · test first · `d6670b4`; gentle-ai
      `under_budget`
- [x] T2b · S1 · the readers' corrections (L7): the key of the tree says where the sensors ran, the
      project opts in, `--checksum`, `--delete-excluded` and the paths left in the mirror, a `flock` on
      the mirror · inline · test first · `adae7c8`; gentle-ai `under_budget`; Codex over
      `3f59bb2..adae7c8`: incorrect, four P2 (L8)
- [ ] T2c · S1 · Codex's four P2 (L8) · inline · test first
- [ ] T3 · S2 · the switch file on this machine (after the orchestrator has it), one gate measured
      through it, docs
- [ ] T4 · S2 · `.wslconfig` text to the orchestrator; the run per merged batch named where merges
      are made

## Log
- L1 · 2026-10-14 01:03 · the orchestrator: "HIS UBUNTU IS READY … Start now … Send me the .wslconfig
  text and anything outside his Linux home before you do it."
- L2 · 01:09 · node v24.15.0 (the version on Windows) installed into `~/.local/node-v24.15.0-linux-x64`,
  linked as `~/.local/node`, its SHA256 checked against nodejs.org's `SHASUMS256.txt`. Ubuntu 26.04.1,
  git 2.53.0, rsync present, 8 processors, 9.7 GB, interop on, 42 Windows entries in its `PATH`.
- L3 · 01:29 · T1, the WSL half (`3f59bb2`, worktree `gate-wsl-measure`): sync of a new mirror 2.8 s
  (420 files), the suite 111.5 s, peak memory used in the distribution 1,112 MB, exit 1 for one test:
  `evals/ports.test.mjs` expected the process name `node`, and node v24.15.0 on Linux names its
  process `MainThread` (`/proc/<pid>/comm` and `ss`, read in WSL2 before 01:34). A defect of the code
  on Linux with node 24, there before this change, and already fixed in the code by the session
  "JH 10" in pull request 109 (`evals/ports.mjs` names a Linux process by the basename of
  `/proc/<pid>/exe`; read in its diff). A fix of the test that I had made was dropped on the
  orchestrator's word: it would hide the defect and conflict with 109. So 109 lands on `main` before
  the gate in WSL2 is on for other trees; until then a gate in WSL2 of a tree without it fails there.
  This branch's own commit gate runs with `JS_HARNESS_GATE_WSL=0`.
- L5 · 01:39:53 · T1, the Windows half, same tree, right after the WSL half in the same turn: 603 s,
  4,405 tests, 4,395 pass, 10 skipped, 0 fail, no untracked file left; `TEMP` and `TMP` on
  `D:\js-harness-tmp`, after he excluded all of `D:` from Defender (the orchestrator's word, not
  verified: it needs an administrator). Before the exclusion the whole checks read 576 to 844 s
  (`odd/tasks/gate-wait.md`). So WSL2 is 5.4 times faster on the same commit. The turn's exit code
  says nothing of the WSL half: its code was lost in a pipe; its output says exit 1 (L3).
- L6 · 01:40:11 · `C:\Users\Oficina\.js-harness\gate-wsl.json` written, exactly
  `{"distro":"Ubuntu","node":"/home/oficina/.local/node/bin"}`, on the orchestrator's go. Undo: delete it.
- L4 · his order, typed, the orchestrator's transcript `ffe99ebf-72fb-48da-a79b-e7db21a20b3f` line
  2115 (06:30:54Z, read by me): "agrega la prioridad del gate al diseño de JH 8". The orchestrator's
  brief: a turn marked first waits for the running turn, never cuts it, and goes before every other
  waiter; who marks it and how it is undone are mine to design; what stops every session marking
  itself first, how a waiter sees it was passed, what the gate log records; attacked by the two
  readers with the rest of the faster-check design. The case: tonight's measure waited about 15
  minutes behind other sessions while he waited for its numbers, and four sessions were paused by
  hand. It goes into the faster-check design (`odd/tasks/gate-wait.md`, "Resume here", THEN).
- L7 · 02:01 · two Opus readers of the faster-check design (pull request 118) found defects in T2, the
  first one independently both: (1) the key of a tree did not say where its sensors ran, so with
  `sameTree: skip` a pass in WSL2 proved the tree for the run on Windows, which then ran no sensor; (2)
  the switch was per machine, so it moved every project on it; (3) a test's litter in the mirror was
  seen by nobody, and `--delete` kept excluded paths a test made there; (4) rsync's size and time
  compare: measured true in WSL2 between 01:49 and 02:01 (`/mnt/d` shows mtimes to the second; a change of the same
  size in the same second stayed out of the mirror); (5) two runs of one mirror. Measured false: killing
  `wsl.exe` leaves no Linux process (a background grandchild included). RED before the fix: 5 of the
  10 WSL tests of `bin/check.test.mjs`, the place test of `gate-tree`, and the runner tests that import
  `leftPaths`; GREEN after: 10 of 10, 17 of 17 on Windows, 13 of 13 in WSL2.
- L8 · 02:21 · Codex (`gpt-6.1-sol`, medium) over `3f59bb2..adae7c8`, two parts, 417,522 input
  tokens (310,656 cached; allowance 781,200): incorrect (0.96, 0.98), four P2, all real: a time that
  ran out inside the distribution (`timeout`'s exit 124) was an ordinary failure; one that ran out
  before the mirror was synced kept the sensor in WSL2 instead of running it on Windows; the runner's
  own side of the first; the runner tests did not ask for `flock`. Corrected in T2c: the runner prints
  a mark when it stopped the command at its bound (exit 124 and the bound's seconds spent: a command
  may exit 124 by itself), the gate reads it as a timeout; no mark and a time run out is a mirror never
  reached, so the sensor runs on Windows; the tests ask for `flock`. RED: both test files fail to
  import the new mark. GREEN: 16 of 16 in `bin/check.test.mjs` (by name), 17 of 17 on Windows, 14 of
  14 in WSL2.
- L9 · the orchestrator (its message after pull request 118 merged): its two questions decided as
  recommended (reversible, under his line 15820): the order of build is part 1's corrections now, then
  parts 2, 3, 7, 5, 4 of `odd/tasks/faster-check.md`; a work session may issue a gate ticket on its
  quoted word, flagged on the board.
- L10 · 02:21:44 to 02:22:08 · the one probe granted for part 2 (Codex out of the lock): `codex exec`,
  `gpt-6.1-sol` at medium, read-only sandbox, a scratch repository, `NODE_OPTIONS=--require=<a
  preload that ends any node --test>`. It spent 112,943 input tokens (87,424 cached), over the
  100,000 granted, and answered nothing: both commands were refused before they ran ("blocked by
  policy"), where `codex exec review` had run `node --test` the same night. Stopped, told the
  orchestrator; no second probe. Part 2 stays a candidate until another probe is granted, best through
  `exec review` itself.

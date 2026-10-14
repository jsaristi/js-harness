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
- 01:26 · T2 written, its tests green (6 in `bin/check.test.mjs`, 10 in `bin/lib/gate-wsl.test.mjs`),
  not committed: the commit turn is the scratchpad's `t2w-turn.sh` with `t2w-msg.txt`. The measure
  turn (`wsl-measure-turn.sh`, background `b8c7almgt`) runs both halves in the detached worktree
  `gate-wsl-measure` at `3f59bb2`, the Windows half with `TEMP` and `TMP` on `D:\js-harness-tmp`
  (he excluded all of `D:` from Defender before it ran, so the Windows number includes it).
- The orchestrator's go (its message, read at 01:25): write
  `C:\Users\Oficina\.js-harness\gate-wsl.json` with exactly
  `{"distro":"Ubuntu","node":"/home/oficina/.local/node/bin"}` after the measure, then tell it.
  One line to it at each step: measure with both numbers, file written, commit, pull request.
- Next: measure → the file → the commit turn → T3 (a real gate through the file) → the pull request
  (undo lines in its body) → `.wslconfig` text with the peak memory → T4.

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
  node>" }`. Present and valid: the sensors of a gate's turn run in WSL2. `JS_HARNESS_GATE_WSL=0` in
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
- [ ] T2 · S1 · `bin/lib/gate-wsl.mjs` (switch, runner text, path to `/mnt`), the route in
      `checkSensor`, the fallback row, `ranIn` · inline · test first
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

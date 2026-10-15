After a reboot, one command says which sessions of the project were open, what each must read and which waits it had, and leaves each a note.
Branch: feat/boot-wake. Delivery: ask-on-risk. Tests: `node --test` (the gate runs them in WSL2).

## Goal
After the machine boots, `js-harness wake` finds the sessions of the project that were open before the boot, and for each one names its stored opening and the `js-harness wait` calls the boot killed. It leaves each session a channel note saying its background waits are gone and which declared ones to re-arm, and leaves the orchestrator one note listing whom to wake. A login launcher, recorded for `uninstall`, runs it at every login.

## Why
On 2026-10-14 the machine restarted at 23:52. Afterwards the lead woke 7 sessions by hand, one by one, and each one re-armed its own waits from memory. Nothing told a session that its waits were gone, so a session could end a turn on a wait that no longer existed.

## Done when
- `node --test bin/wake.test.mjs` exits 0
- `npm run check` exits 0
- After a boot, `js-harness wake --boot-time <iso>` against a fixture home prints one block per session open before it, with its title, its opening command and its waits, and records the notes once (a second run records none).

## In scope / Out of scope
- In: bin/wake.mjs (new), bin/wake.test.mjs, bin/lib/wake.mjs (new) and its test, the dispatcher (bin/js-harness.mjs), the manifest record of the login file (bin/lib/manifest.mjs `recordOptionalFile`), README's command list, this document, docs/ROADMAP.md.
- Out: the remote launcher (`remote start --at-login`, bin/remote.mjs, bin/lib/remote.mjs) — because its one-command file is what `doctor` and `launcherStart` read. Out: `js-harness wait` itself — because recording its arming is a separate change; the waits are read from the transcripts. Out: bin/gate.mjs and bin/lib/gate-lock* — the lead's standing rule.

## Constraints
- A session that sits idle cannot be pushed a prompt by any command: no js-harness path does it (`rg -n -e "--resume" -e "--print" -e "stream-json" bin` matches only a test), and the app's `send_message` is a tool only an agent can call. So the command leaves notes, which the `PostToolUse` inbox hook (bin/lib/inbox.mjs) says on the session's next tool call, and it tells the orchestrator whom to wake. The orchestrator then wakes them with one batch of `send_message` calls instead of seven messages written by hand — because that is the only path that reaches an idle session today.
- Every file written outside the repository is recorded in the machine manifest with its sha256 — because `uninstall` must undo it exactly (AGENTS.md).
- The boot time is injectable (`--boot-time`) and read from `os.uptime()` otherwise — because tests cannot reboot.

## Effort
high

## Ask me before
- Nothing beyond the repository's rules; the orchestrator asks the user.

## Specs
- S1. The user's tap (the orchestrator's transcript c47efdf7, line 4385, 2026-10-15T05:36:58Z, read with `sessions --quote`), to the question "¿Sumamos mejoras nuevas al plan? Las aprobadas (tests inestables y GitHub con 2 archivos a la vez) las asigno igual.": "La 5: recuperarse de un reinicio (Recomendada)".
- S2. The lead's wording (cross-session message to JH 5, 2026-10-15): "The problem, measured tonight: after his machine restart at 23:52 the lead woke 7 sessions by hand, one by one, and each re-armed its own waits. Build: one command (and its run from the existing login launcher, like `remote`) that, after a boot, wakes each open session of the project with its stored opening (`notify --opening`) and tells it its background waits are gone, so it re-arms only declared ones. Open a feature document with the task contract; test first; the lead's message is the wording, his tap is the order. Send the lead one line when the document is open and when the PR is ready."
- S3. The design of this session (assumption, told to the lead): "wakes" is done in the only way that reaches an idle session. The command records a channel note to each session, which its inbox hook says on its next tool call. It also records one note to the orchestrator that names the sessions and the exact `send_message` text for each. The orchestrator sends those messages in one batch.
- S4. The design of this session: a session "open before the boot" is one whose transcript was written in the 12 hours before the boot time (the board's default window). Its "declared waits" are the background `js-harness wait` calls in its transcript that were started and had no end entry before the boot. Each is listed with its own command line, which holds its condition and its `--for`.
- S5. The design of this session: the run at login is a separate Startup file, `js-harness-wake-<id>.cmd`, written by `wake --at-login` and removed by `wake --at-login --remove`. It is recorded with `recordOptionalFile`, so `uninstall` removes it. A second run after the same boot records no new note.

## Tasks
- [x] T1 (S2, S4): `lib/wake.mjs` reads the sessions open before a boot, each one's title, its opening and the waits the boot killed. It is a pure function over a fixture home. Route: inline. RED: module missing; GREEN, bin/lib/wake.test.mjs 5 of 5.
- [x] T2 (S2, S3, S5): `wake` prints the blocks and records the notes, once per boot. Route: inline. RED: module missing; GREEN, bin/wake.test.mjs 3 of 3. Slice 1.
- [ ] T3 (S5): `wake --at-login` writes the recorded Startup file, and `--remove` and `uninstall` remove it. Route: inline. Slice 2: it writes outside the repository (high risk, item 5), so it gets its own commit, review and independent verifier.
- [x] T4: the README section and the usage line, in slice 1. The roadmap line is left to the lead, who keeps the plan.

## Log
- L1. 2026-10-15, the order: S2, verbatim; the user's tap: S1.
- L2. 2026-10-15, exploration (read-only explorer): no CLI path puts text into an idle desktop session. Openings are keyed by title (bin/lib/channel.mjs:422-447). `js-harness wait` writes no record (bin/wait.mjs). The remote launcher's file holds exactly one checked `start` line, read back by `launcherStart` (bin/lib/remote.mjs:204-213). No code reads the boot time. Hence S3-S5.
- L3. 2026-10-15 00:53, T1, T2 and T4 done. `sessionFacts`' work does not carry a Bash command, and three tests of bin/lib/sessions.test.mjs compare the whole work object. So `wake` reads the command from the call by its `toolUseId` and leaves the shared parser unchanged. The open-before-boot test reads entries (not the file's mtime): a session woken after the boot writes again, and still counts by its entries before the boot. Once per boot: a note from `wake` whose text names a boot within 2 minutes of this one, since two uptime reads of a boot differ by seconds.
- L4. Next: commit slice 1 (T1, T2, T4) through the gate, then gentle-ai, then Codex; then T3 test first on the same branch.

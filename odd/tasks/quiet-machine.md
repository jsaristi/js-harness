# Tell the user when nothing runs on the machine

Locator: `odd/tasks/quiet-machine.md` · Engram mirror: `odd/quiet-machine/tasks` · Branch: `claude/quiet-notice-d79a05`
Delivery: one slice, one pull request. Test runner: `node --test`.

## Goal
`js-harness quiet` says whether anything still runs on the machine, and `js-harness quiet --wait` ends once nothing
has run for a while, so the lead can tell the user, away and on his phone, that the PC can be turned off.

## Why
The user leaves the lead alone for 8 hours or more. When every session has finished and nothing is left to run, the
PC stays on for nothing; when a session waits for him, nothing moves until he answers. He wants to be told either way.

## Done when
- `node --test bin/quiet.test.mjs bin/sessions.test.mjs bin/js-harness.test.mjs` exits 0
- `npm run check` exits 0
- One real `js-harness quiet` on this machine named what ran and what waited for him (Log).
- The pull request is open and `js-harness codex-review` recorded its review.

## In scope / Out of scope
- In: `bin/quiet.mjs`, `bin/lib/quiet.mjs`, `bin/lib/process-list.mjs` (the process listing, out of `bin/sessions.mjs`),
  `bin/sessions.mjs` (uses that listing), `bin/js-harness.mjs` (dispatch and help), their tests, README,
  `docs/SPEC.md`, the orchestrator skill (`bin/lib/manifest.mjs`), this document.
- Out: sending the push notification from the command (the host's PushNotification tool is the lead's, and no
  command can call it), turning the PC off (his), `package.json` (the lead's).

## Constraints
- A source that could not be read is never "nothing runs" — because a quiet that is wrong turns off a PC with work
  on it.
- A session waiting on a permission prompt or a question needs him, and is named as such, not as work — because
  that is what he can act on from his phone, and it would never end on its own.
- The command reads only; it reuses the board's readers (`listAgents`, `readRecord`, `readGateLock`,
  `readGateHolder`, `readGateWaiters`, `isSelf`) — because a second reader of the same facts drifts from the first.

## Ask me before
Nothing: the brief carries his request; spend is one gate and one Codex review.

## Specs
- S1. His request (2026-10-25, lead transcript 908805db-d0b9-4c2f-a9e6-f828b6bf1e41, line 38003, verbatim): "Quiero
  una funcionalidad en el arnes que cuando no haya nada ejecutandose me avises para ver que en vez de dejandote
  trabajar solo pueda apagar el pc, es que le dije a la otra sesion que te iba a dejar funcionando solo 8 horas o mas".
- S2. `js-harness quiet [--json] [--self <session id>] [--home <path>]` takes one look at the machine and says
  `quiet`, `busy` or `unknown`, with what runs, what needs him and what it could not read. Work is: a Claude session
  `claude agents --json --all` lists as `busy` (a background one with no status and state `working` too); the gate
  lock's live holder and each gate that waits for it; a `merge-queue --land` process; a `codex exec` or
  `codex-review` process. A session listed as `waiting` needs him (`waits for <what>`), and is not work. A background
  session the record of `js-harness sessions start` holds is marked so. The session `--self` names (else
  `CLAUDE_CODE_SESSION_ID`), by its id or its first eight characters or more, is left out and said. Exit 0 quiet,
  1 busy, 3 unknown (a source could not be read and nothing was seen to run), 2 a usage error.
- S3. `js-harness quiet --wait [--for <minutes>] [--settle <minutes>] [--every <seconds>]` looks at once, then every
  `--every` seconds (60), and exits 0 at the first look at which the machine has been quiet since a look `--settle`
  minutes before or more (10; 0 is the first quiet look). A busy or unknown look starts the count again. It prints at
  start what it waits for, and at the end how long the machine was quiet, the last work it saw, what needs him and
  that the PC can be turned off. After `--for` minutes (720) with no settle it exits 1 with the last look.
- S4. The orchestrator skill tells the lead to keep `js-harness quiet --wait` running as a background task while the
  user is away, and, when it exits 0, to send him a push notification (the PushNotification tool) naming what needs
  him and that the PC can be turned off. Help text, README and `docs/SPEC.md` say S2 and S3.

## Tasks
- [x] T1 (kind: build) S2, S3: tests first through `quietMain` with a fake `claude` on PATH, then `bin/lib/quiet.mjs`,
  `bin/quiet.mjs`, the shared process listing. Route: inline (one understood change).
- [x] T2 (kind: docs) S4: help, README, `docs/SPEC.md`, the orchestrator skill. Route: inline.
- [ ] T3 (kind: verify) gate, one real look, gentle-ai assessment, Codex review, PR. Route: inline.

## Log
- L1 (2026-10-25, the lead's brief to this session, carrying his words of S1): "Build a js-harness feature that tells
  the user when nothing is running on the machine, so he can turn the PC off instead of leaving it on while the lead
  \"works alone\" with nothing to do." Deliver one command that says whether the machine is quiet and what still runs,
  a `--wait` that exits once it stayed quiet for the settle time, help, docs and the orchestrator skill; reuse the
  board's readers and the gate lock's own reader; tests first, through the public command, with a fake `claude` on PATH.
- L2 (2026-10-25) Probe: `claude agents --json --all` on this machine listed 7 sessions with fields `id, cwd, kind,
  startedAt, sessionId, name, state, pid, status, waitingFor`; interactive ones carry `status` (`busy`, `idle`,
  `waiting` with `waitingFor: "permission prompt"`), background ones that ended carry only `state` (`failed`). This
  session (3f62d748) was not among them: a session the listing does not show is not seen, which the help says.
- L3 (2026-10-25) T1: RED observed (`node --test bin/quiet.test.mjs` failed, no `bin/quiet.mjs`), then GREEN: 17 tests
  pass. The board's process listing moved to `bin/lib/process-list.mjs` with its pattern as an argument; the Windows
  script it builds for the board is byte for byte the one `bin/sessions.mjs` had (compared against `HEAD`'s file in a
  scratch folder: `identical script: true`), and the `ps` branch is unchanged.
- L4 (2026-10-25) One real look on this machine: `js-harness quiet` exited 0 with `quiet: nothing runs on this machine;
  1 session needs you`, naming `Codex hook trust: doctor, uninstall, README (aa914608) waits for permission prompt`, and
  left out `JH 49 · notify when the machine is quiet (3f62d748)`, this session, which the listing now shows (L2's
  absence was before the app titled it).
- L5 (2026-10-25) T2: the S4 line of the orchestrator skill was written before its test in `bin/lib/manifest.test.mjs`
  (not test-first); the skill test names no pronoun for the user, as the skill's own test requires.

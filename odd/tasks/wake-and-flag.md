# Wake and flag

Items B1, A(a) and G of the throughput plan, and the hour guard on `notify` text sent through Bash. Branch per unit
from `main`; owner `JH 26 · canal y compactación`; delivery one pull request per unit; test runner `node --test`.

## Goal
A session that holds work wakes for it, and the board shows what stalls it.

## Why
The throughput measure of 2026-10-17 found these sources of lost time:
- 31 turn ends followed by more than 30 minutes of silence, with nothing armed: 64.4 session-hours in two days, an upper bound;
- 3 tool calls open 18.6 session-hours;
- 58 of 74 wrong hours in the lead's notices typed in `notify` text, which the hour guard does not read.
The land cannot tell a session that its pull request landed or was left out, because 42 of 58 ready notices were sent
from `main`, so their branch names no session (the plan, `throughput-v3-plan.md`, Version 2 and item A).

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/wake-and-flag.md` exits 0
- `node --test bin/lib/channel.test.mjs` exits 0
- `node --test bin/notify.test.mjs` exits 0
- `node --test bin/lib/sessions.test.mjs` exits 0

## In scope / Out of scope
- In: `bin/lib/channel.mjs`, `bin/notify.mjs`, the board's channel lines (`bin/lib/sessions.mjs`), `bin/reply.mjs` and
  `bin/lib/reply.mjs` for A(a), the board for G, `bin/guard.mjs` for the hour guard, their tests, help, README,
  `docs/SPEC.md` and the skill lines in `bin/lib/manifest.mjs`.
- Out: `bin/merge-queue.mjs` and the land's notices (A(b), JH 24's, which reads B1's field); the gates (C, D, E).

## Constraints
- One pull request per unit, each through the gate, gentle-ai and Codex — the lead's assignment of 2026-10-17.
- No check, review or test removed or weakened — the plan's hard limit.

## Ask me before
Nothing of this feature is his: no spend, nothing irreversible, no product choice beyond the approved plan.

## Specs
- S1 (B1) "a `ready` notice kind carrying the PR number; JH 24's A(b) waits on it" (the lead's notice of 2026-10-17).
- S2 (A(a)) "a work session's Stop hook, by amending `reply --hook` at manifest.mjs:41, warns once when a turn ends
  holding handed work with no `js-harness wait` running".
- S3 (G) "the board flags a tool call open more than N minutes".
- S4 "the hour guard on `notify` text sent through Bash (bin/guard.mjs:81)".

## Tasks
- [x] T1 (kind: build) S1: `--kind ready --pr <n>`, the record's `pr`, the board's line, the skill's line (route: inline;
  branch `feat/ready-notice`)
- [ ] T2 (kind: build) S2: the Stop warning for handed work with no wait running (route: inline)
- [ ] T3 (kind: build) S3: the board flags a tool call open more than N minutes (route: inline)
- [ ] T4 (kind: build) S4: the hour guard reads `notify` text sent through Bash (route: inline)

## Log
- L1, 2026-10-17, the lead's notice to JH 26 (a claim of the lead's, not his word): "he approved the throughput plan
  (2026-10-17). Your next work, from ...throughput-v3-plan.md (read the 'Version 2' section first): B1 first (a
  `ready` notice kind carrying the PR number; JH 24's A(b) waits on it), then A(a) (a work session's Stop hook, by
  amending `reply --hook` at manifest.mjs:41, warns once when a turn ends holding handed work with no `js-harness
  wait` running), G (the board flags a tool call open more than N minutes), and the hour guard on `notify` text sent
  through Bash (bin/guard.mjs:81). Test first, one PR per unit, gate, gentle-ai, Codex; notify the lead at each PR."
- L2, T1 built test first on `feat/ready-notice`.
  - What it adds:
    - `ready` is the ninth kind and the only one that takes `--pr`, a whole number from 1, kept in the record as `pr`;
    - a ready notice without a valid `pr` is no notice to `readNotices`;
    - the board prints "ready for pull request <n>";
    - `notify` confirms "recorded ready for pull request <n>";
    - the skill tells a session to send it when a pull request is ready.
  - RED: 3 tests of `bin/lib/channel.test.mjs`, 2 of `bin/notify.test.mjs` and 1 of `bin/lib/sessions.test.mjs` failed.
    The usage cases with `--pr` already exited 2, but for an unknown flag.
  - GREEN: channel 53, notify 140, sessions 302, manifest 166.
  - Not changed: `ready` is no status of the board (`STATUS_KINDS`), so it neither opens nor closes a session's handed
    work, and `session-stall` reads as before.

## Next step
T2, S2: amend `reply --hook` so a work session's turn that ends holding handed work, with no `js-harness wait` running,
is warned once.

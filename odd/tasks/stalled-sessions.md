Stalled-session detection: the board, the lead's watch and its heartbeat name a work session that holds open work and has gone quiet.
Branch: feat/stalled-sessions (from origin/main 362b385). Delivery: ask-on-risk, one PR. Tests: `node --test`.

## Goal
`js-harness sessions` flags a work session that has made no commit, sent no notice and run no gate for 60 minutes
while it holds open work, and the lead's heartbeat ends on such a session, naming it.

## Why
On 2026-10-16 three sessions sat five to six hours before anyone noticed (the lead's notice of 20:19Z; one of them
is in its notice of 16:49Z: "first-version T3 moved to JH 25 after 6h without an answer"). The lead's heartbeat
only ends when nothing on the whole machine writes the gate log or the channel for 30 minutes, which never happens
while other sessions work, so one silent session among busy ones is never seen.

## Done when
- `node --test bin/lib/stall.test.mjs` exits 0
- `node --test bin/lib/sessions.test.mjs` exits 0
- `node --test bin/loop-bodies.test.mjs` exits 0
- `npm run check` exits 0
- A work session handed a notice and quiet for an hour reads `stalled` on `js-harness sessions`, and `js-harness loop heartbeat` ends with a `STALLED:` line naming it

## In scope / Out of scope
- In: bin/lib/stall.mjs (new), bin/lib/sessions.mjs (board line and watch line), bin/sessions.mjs, bin/loop.mjs (heartbeat), bin/lib/gate-log.mjs (the gate's session id), bin/check.mjs and bin/gate.mjs (passing it), bin/lib/rules-data.mjs (the 60 minutes), the skill text in bin/lib/manifest.mjs, README.md, their tests, docs/ROADMAP.md, this document.
- Out: stopping or restarting a stalled session (the lead decides); sessions with no `<code> <number> · <purpose>` title and the orchestrator itself, which hold no handed work by the protocol.

## Constraints
- Every source is a record the harness already writes (the channel, the openings, the gate log) or one `git log` per quiet candidate — because the heartbeat ticks every two minutes and reading every transcript, as the board does, takes minutes.
- "Holds open work" is read from the protocol, not guessed from text: work is handed by a notice to the session or its opening, and given back by its `waiting`, `closed` or `relieved` notice — because a note's words cannot be told apart ("free", "PR ready") by a program.

## Ask me before
- Changing the 60 minutes (a declared rule) or making a stalled session do anything by itself.

## Specs
- S1: Lead's notice, 2026-10-16 20:19Z, verbatim: "Build stalled-session detection: js-harness sessions flags a session with no commit, notice or gate for 60 minutes while it holds open work, and the lead's heartbeat surfaces it. Today 3 sessions sat 5-6 h before anyone noticed. Open it as a task in the roadmap first, test first, normal gate/review/Codex, then notify me the PR."
- S2 (decided here, read from the protocol): a work session holds open work when the newest notice the orchestrator addressed to it (`--to <number>`) or its newest opening is newer than its newest `waiting`, `closed` or `relieved` notice. Its quiet starts at the latest of: that handed notice, its own newest notice of any kind, its newest gate (by the session id the gate log now records), the newest commit of its worktree that the default branch does not hold. It is stalled when that quiet reaches the declared rule `session-stall` (60 minutes); a session quiet for longer than the board's window (`--hours`, 12) is not listed.
- S3: the board prints a `Stalled` section, before the roster: each stalled session with how long it has been quiet and what it holds (the handed notice, its kind, sender and time), `none`, and each record it could not read; `--json` carries it as `stalled`. A section and not a line under the session's block, since a stalled session's transcript can be outside the board's list and several transcripts share one number.
- S4: `sessions --watch` says it once when a session crosses the limit, and again each time its quiet doubles, like a call with no result.
- S5: `loop heartbeat` ends with `STALLED: <title> — no commit, notice or gate since HH:MM, holding <what>` (exit 0) when a work session of the project is stalled, beside its machine-wide `STALL`. A session already stalled when it starts is named on an `already stalled:` line and ends it only when its quiet doubles, so a relaunched heartbeat is not woken at once by what it just said. `--stall <minutes>` overrides the rule for one loop.
- S6: the work-session skill says to send `--kind waiting "<on what>"` when free with nothing handed, since that is what gives the work back.

## Tasks
- [x] T1 (kind: build) (S2) `stalledSessions` in bin/lib/stall.mjs: pure, from notices, openings, gates and a commit reader; the gate log records the session id; the rule `session-stall`. Route: inline.
- [x] T2 (kind: build) (S3, S4) the board line and the watch line. Route: inline.
- [x] T3 (kind: build) (S5) the heartbeat ends on a stalled session. Route: inline.
- [x] T4 (kind: docs) (S6) the skill text and README. Route: inline.

## Log
- L1 (2026-10-16, the lead's notice to JH 22, its words): "JH ORQ: new work for JH 22 (memory T7 was already done by JH 16). Build stalled-session detection: js-harness sessions flags a session with no commit, notice or gate for 60 minutes while it holds open work, and the lead's heartbeat surfaces it. Today 3 sessions sat 5-6 h before anyone noticed. Open it as a task in the roadmap first, test first, normal gate/review/Codex, then notify me the PR."
- L2 (2026-10-16): mapped by a read-only explorer. The board's per-session time limit to copy is the call with no result (`PENDING_CALL_LIMIT_MS`, `pendingAge`, `crossingOf` in bin/lib/sessions.mjs); channel notices carry the sender's session id (`from.id`), gate-log lines carry only `cwd`, and no commit time is read anywhere on the board. The heartbeat (bin/loop.mjs `heartbeat`) reads file times only. "Open work" on the board means background calls; it is not used here, since a session waiting on `js-harness wait` holds one by design.
- L3 (2026-10-16): probed on the real records. Three rules came from it. (1) Only the orchestrator hands work: `js-harness wake` writes a notice to every number after a boot, and a peer's note informs. (2) Gates count by session id only: matched by folder, the lead's gates in the main checkout gave six sessions a gate at 15:11 they never ran. (3) A commit counts only when the default branch does not hold it, so a merge into a shared checkout is nobody's work. At 20:41Z the probe lists JH 19 (quiet 231 minutes, holding the 16:49Z note) and JH 7 (143 minutes), and six sessions quiet since about 15:11 that hold a broadcast note and never sent `waiting` or `closed` (JH 5, 8, 10, 15, 16, 20). Those six are what S6 is for.
- L4 (2026-10-16): T2 to T4 built test first. The board section reads the same records as the heartbeat (`readStalled`), so the two cannot disagree. The heartbeat keeps the board's 12-hour window as a constant (`STALL_WINDOW_MS`): a session quiet for longer is off the board as well. The skill tells a work session to send `waiting` when it is free, and the lead's board line names the section.

## Next step
T1-T4 committed on feat/stalled-sessions (a83730b, 1e24a04, 8f8f071), gate green. gentle-ai assess: medium, not due (under_budget). Codex review of a83730b^..HEAD running (js-harness codex-review --base a83730b^); then treat its findings, push, open the PR, notify the lead (js-harness notify --to orchestrator) with the PR link and the three rules L3 found; Risk: none.

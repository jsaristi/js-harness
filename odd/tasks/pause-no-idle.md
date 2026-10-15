The context pause tells a session never to end its turn idle, and what to do instead.
Branch: fix/pause-no-idle. Delivery: ask-on-risk. Tests: `node --test` (the gate runs them in WSL2).

## Goal
Both notices of the context pause (`noticeOf`, bin/lib/pause.mjs) say not to end the turn idle, because
the host compacts only inside a turn, and say what to do instead: write the state, then keep a declared
wait running in the background, which wakes the session, so the compaction happens inside a turn.

## Why
Twice on 2026-10-14 (JH 8 at 19:11 and JH 10 at 20:51, the orchestrator's count) a session near its
compaction ended its turn waiting, with nothing running that would wake it, and was never woken: the app
compacts only inside a turn. The notice said to go on with the task and never to wait for the compaction,
and said nothing of ending a turn.

## Done when
- `node --test bin/lib/pause.test.mjs` exits 0
- `npm run check` exits 0

## In scope / Out of scope
- In: bin/lib/pause.mjs `noticeOf`, bin/lib/pause.test.mjs, this document.
- Out: `cutRule` (bin/lib/sessions.mjs), which says when the user is handed the cut, and `js-harness wait` itself.

## Constraints
- The text names `js-harness wait` as the declared wait — because it is the command that prints its purpose and its end and wakes the session when its condition holds (T20 of the roadmap).

## Effort
high

## Ask me before
- Nothing beyond the repository's rules.

## Specs
- S1. His order, typed (the orchestrator's transcript ffe99ebf, line 5853, 2026-10-14T19:42:26Z, read with `sessions --quote`): "EL objetivo es cerrar y llegar a la version 1.0.0 pero la idea es que las tareas que agregamos es corregir para que el harnes funcione bien como debe y eso es lo principal y prioritario, si se atrasa pues toca ya que tiene que quedar funcionando como un reloj suizo."
- S2. The orchestrator's order to JH 10 (cross-session message, 2026-10-15): "the pause notice (bin/lib/pause.mjs, around line 235) must tell the session not to end its turn idle at the pause, and say what to do instead (write state, then keep a declared wait running so the compaction happens inside a turn), with its test first."
- S3. A design choice of this session, not his words: both stages, `pause` and `last`, carry it, since a session can end its turn idle after either; and neither says to stop or to wait for the compaction (the last notice's test already holds that).

## Tasks
- [x] T1 (S2, S3): the sentence in both notices, test first. Route: inline. RED: "both notices say never to end the turn idle ..." (bin/lib/pause.test.mjs); GREEN, 47 of 47.

## Log
- L1. 2026-10-15, the order: S2, verbatim; his priority: S1.
- L2. 2026-10-15, T1 done: `noticeOf` adds one sentence before the cut, in both stages: never end the turn idle, since the host compacts only inside a turn; when the work waits, write the state and keep `js-harness wait` running in the background, which wakes the session. Next: commit through the gate, gentle-ai assessment, Codex (`--plan` first), push, PR, one line to the lead.

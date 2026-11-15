# honest-context-meter — a context share that is the context sent (block 0, JH 209)

## State
Design only, stopped by the brief: the cause is found and reproduced, the fix is not built. Two `todo` tests fail on
main with the real shape (163131 counted, 82430 sent) and leave the gate green. Next: the lead and the owner read
this design (question 292: no block builds before its design returns to him); then T2 builds it and drops the todos.
Open: the one non-advisor reply with several passes, and 8 replies whose passes do not sum to the top (Depth pass 4).

## Goal
The share of the context window the harness reads from a transcript is what the model was given for the last reply,
also when that reply called the advisor.

## Why
The pause hook and the board read a session's context from the `usage` of its last reply. Sources showed 99–120 %
while the host's own `get_usage` said 65 % (the brief), so the pause notice, the board and every notice's stamp
("holding N% of its context") run high, and a session told it is past its window acts on a false reading. A hook
cannot call `get_usage`, so the transcript must be read right.

## Done when
- `node --test bin/lib/pause.test.mjs bin/lib/sessions.test.mjs` exits 0 with both advisor tests run, not todo
- `npm run check` exits 0
- the lead and the owner approved the design before T2 starts (question 292)
- Codex and the Claude lenses reviewed the code slice

## In scope / Out of scope
- In: `tokensOf` in `bin/lib/pause.mjs` and `contextOf` in `bin/lib/sessions.mjs`, their tests, this document.
- Out: merging the two readers (the brief: they share one rule on purpose, and merging fixes nothing); JH 207's and
  JH 208's surfaces; reading `get_usage` from a hook (the host does not offer it); `docs/ROADMAP.md`, whose
  read-surface row holds 9,945 of 10,000 after PR 888, so this block's line waits for room the lead makes.

## Constraints
- Both readers change in one commit with one rule — because `tokensOf` says it is "the rule of `contextOf`", and two
  readers that disagree would put the pause and the board at different shares.
- A usage with no `iterations` reads as today — because 25,209 of 25,239 replies list it, and older transcripts and
  other hosts do not.

## Ask me before
- The fix itself (T2): the brief stops here, and the design returns to the lead and the owner first.

## Depth pass
- 1. Method: the discipline is measurement validity: a gauge reads the quantity it names, checked against an
  independent reference, and its error is reproduced before it is corrected. The standard is the API's own
  definition: a request's context is its input tokens plus the cache read and written for it, per request. The
  smallest change that meets it: where `usage.iterations` lists the passes of one reply, count the last pass of type
  `message` instead of the top-level sum; nothing else moves.
- 2. Raw material:
  - this session's transcript, `22f77ae8-4387-440e-a647-7dae6e283b28.jsonl` line 240 (2026-11-15T19:3x), the reply
    that called the advisor: top level `input_tokens` 4, `cache_read_input_tokens` 158729,
    `cache_creation_input_tokens` 4398, sum 163131; `iterations` = message (2, 78030, 2669), advisor_message
    (81094 input, model claude-fable-5-2), message (2, 80699, 1729). The top is the sum of the two `message` passes;
    the advisor's pass is listed and not summed. The reply was sent with 82430; the next reply, line 262, reads
    85159, so 82430 is the session's real line.
  - the readers: `bin/lib/pause.mjs:110-117` (`tokensOf`, read by `endOf` and `readEnd`, the pause hook) and
    `bin/lib/sessions.mjs:336-344` (`contextOf`, read at `:565` for `sessionFacts().context`, at `:580` for a stretch's
    growth, and at `:2258` for `peakContextBefore`). Both sum the three top-level counts.
  - a scan of the last 7 days, 110 transcripts under `~/.claude/projects` (script kept out of the repo): 146 own
    replies called the advisor; each counts 1.99 to 2.00 times its last pass (median 1.994). The worst is the lead's
    transcript `69918425`: 605,944 counted for 303,340 sent, which on the owner's window of about 350k (his line
    11078 of that transcript) reads 173 % for 87 %.
  - the brief's figures (99–120 % against 65 %, a 129 % reading): not checked here; a doubling of 60–65 % gives
    them, so they fit, assumed.
- 3. The bar:
  spec 1: `node --test --test-name-pattern=advisor bin/lib/pause.test.mjs`: todo, fails with 163131 for 82430.
  spec 2: `node --test --test-name-pattern=advisor bin/lib/sessions.test.mjs`: todo, fails with 163131 for 82430.
  spec 3: `node --test bin/lib/pause.test.mjs bin/lib/sessions.test.mjs`: passes today (no usage without
  `iterations` changes); must still pass after T2.
  spec 4: left out because it is a stop before the build, not a behaviour a command shows.
- 4. Refutation: the cheapest test that could show the suspected cause wrong was the real usage of a reply that
  called the advisor: if its top level matched its last pass, the advisor would not be the cause. Run on line 240:
  the top is 163131, the last pass 82430. The scan widened it: 146 of 146. Two things it also found, still open: one
  reply with two `message` passes and no advisor (another server tool, likely, and the same rule fixes it), and 8
  replies whose `message` passes do not sum to the top; T2 reads them before it builds.
  Verdict: supports
- 5. Request: make both readers count the last `message` pass of `usage.iterations` when the list has one, and the
  top-level sum otherwise, so the pause hook, the board, the stretch growth, the peak and every notice's stamp read
  the context the last request was sent with; prove it with the two real-shape tests turned from todo to run.
  Adds: none

## Specs
1. The brief (the lead, 2026-11-15): "the context hook's share runs high. Sources showed 99–120 % while
   `get_usage` said 65 %, and a 129 % reading is unchecked." — the pause hook's reader counts the last request's
   context.
2. The brief: "`tokensOf` in `bin/lib/pause.mjs` (~:107-115) and `contextOf` in `bin/lib/sessions.mjs` (~:341)
   share one summing rule on purpose, so merging them fixes nothing." — both readers take the same new rule, in one
   commit, kept as two.
3. The brief: "a test fixture that reproduces the over-count from a real transcript shape, failing on main." — the two
   todo tests above, from line 240 of this session's transcript.
4. The brief: "Then STOP: a hook cannot read `get_usage`. The design goes back to the lead and the owner before any
   fix is built." — T2 waits for that approval.
No words of the owner's on block 0 were found: searched his lines in the lead's transcript `69918425` for "contexto",
"medidor", "120", "99 %" and "get_usage"; the one hit is his window of about 350k (line 11078).

## Tasks
- [x] T1 (kind: design) specs 1-4: cause found, real-shape todo tests, this document. Route: inline. Commit: this one.
- [ ] T2 (kind: build) specs 1-3: the last `message` pass in `tokensOf` and `contextOf`, the todos removed, the 8
  mismatched replies read first. Route: inline. Waits for the design's approval.

## Log
- L1 The lead's brief (2026-11-15, `~/.js-harness/background/briefs/2026-11-15T19-32-46-858Z-ef692e00.md`), Part 2:
  "block 0, design only … open `odd/tasks/<feature>.md` with the task contract … a depth pass; specs; a test fixture
  that reproduces the over-count from a real transcript shape, failing on main. Then STOP".
- L2 2026-11-15: the suspected cause is reproduced from this session's own advisor call (Depth pass 2), and the scan
  of 146 advisor replies shows the doubling every time.
- L3 2026-11-15: a failing test would turn the commit gate red, so both tests carry node:test's `todo` option: they
  run and fail, `node --test` exits 0, and T2's first edit removes the option.

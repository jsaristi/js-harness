# spend-stop: a session stops at its spend line

## State
JH 287, on origin/main with JH 285's two commits cherry-picked after this document (L3). T1 is built test-first; next: lenses, Codex skip, push, draft PR.

## Goal
A session given a stop line in cache-read tokens is refused its next step once it has spent past it, without having to
remember the line or read its own figure.

## Why
Tonight's sessions ran to their caps or stopped at half of them because each read its own spend by hand, and wrongly
(`spend-measure-2026-11-21.md`, lead notes). He asked first of all for the fixes so it does not fail again (L1). The
roadmap row: `docs/ROADMAP.md:986`, "A spend check: a session reads its cache-read sum against its stop line before
each step (`spend-past-approved`)".

## Done when
- `node --test bin/lib/spend-stop.test.mjs bin/spend.test.mjs bin/guard.test.mjs` exits 0
- `npm run check` exits 0
- A session that ran `js-harness spend --self --line <N>` is refused a Bash, Read, Write, Edit or Agent call once its
  cache-read (main chain and sub-agents) reaches N, with one line naming the figure, the line and "write your state and stop"

## In scope / Out of scope
- In: `bin/spend.mjs`, `bin/guard.mjs`, a new `bin/lib/spend-stop.mjs`, their tests, the command's help lines.
- Out: the guard's matcher (which tools reach the hook): unchanged. A rule value for the line: the line is per session,
  from its brief.

## Constraints
- The guard is high risk (a guard that blocks work): a session with no line recorded is never blocked and reads no
  transcript; an unreadable transcript or line file lets the call run; each is proven by a test.
- The secrets denies still run on a call the stop lets through.
- The line is recorded only for the session id the host sets (`CLAUDE_CODE_SESSION_ID`, or the `session_id` of the
  host's hook payload), never a guessed one. Once recorded it is the session's for good: a second `--line` is refused,
  above or below, and only the lead (a session whose app record carries a lead's title) moves it, with `--raise`
  naming the session (T5).
- The line file is not the session's to touch: the guard refuses a Bash, terminal, Write, Edit, MultiEdit or
  NotebookEdit call that names the spend folder, for every session (T5). A path the shell computes (`$HOME`, a
  variable, `eval`) is not read, as the background-launch guard does not read one either.

## Ask me before
Nothing in this slice: the brief and his words cover it.

## Depth pass
- 1. Method: a guard holds a limit the agent cannot be trusted to remember; the smallest form is a value recorded once
  outside the conversation and a check where every step already passes (the PreToolUse hook).
- 2. Raw material: `bin/guard.mjs` `guardMain` (the payload carries `session_id` and `transcript_path`);
  `bin/lib/hook-entries.mjs:82` (the matcher); `bin/lib/pause.mjs` `statePath` (a per-session file under the home);
  `bin/lib/channel.mjs:724` `senderOf` (`CLAUDE_CODE_SESSION_ID`); `bin/lib/transcript-requests.mjs` `spendOf` (285).
- 3. The bar:
  spec 1: `node --test bin/lib/spend-stop.test.mjs`: none, new behaviour
- 4. Refutation: whether summing a whole transcript on every tool call fits the hook's 5 s timeout. Measured with
  `spendOf`: 4.3 MB (14.1M cache-read) 58 ms; 48 MB 703 ms; 128 MB (the largest on the machine, a lead) 2.7 s. A
  session at a 20M line is about 6 MB.
  Verdict: supports
- 5. Request: record a per-session stop line once and refuse the next guarded step past it, failing open.
  Adds: none

## Specs
1. His words, typed (0cdab702 line 9744): "incluye primero que todo las mejoras para que nos nos vuelva a fallar y
   trabaja y termina todo para que no vuelva a quedar a tope".

## Tasks
- [x] T1 (kind: build) spec 1: `spend --self --line <N>` records the line; `guard --hook` refuses past it; route JH 287

## Log
- L1 His request, typed (0cdab702 line 9744): "incluye primero que todo las mejoras para que nos nos vuelva a fallar y
  trabaja y termina todo para que no vuelva a quedar a tope"; his go for the spend fixes (line 9413): "Listo por favor
  solucionemos todos esos errores y dime cuanto nos podemos ahorrar y ademas si estamos haciendo algo doble innecesario".
- L2 Decided (JH 287): the figure is main chain plus sub-agents, since both spend the plan; the calls that write the
  state (a Write or Edit of a `.md`) and a lone `js-harness notify` pass, so the refusal never traps the session.
- L3 Route (the lead, 2026-11-21 about 20:25 local): JH 285's commits ab003b6e and ef55ee7e (`js-harness spend`) were
  written before this depth pass, by JH 285, about 19:41-19:55 local, as its own small task under the lead's
  `brief-spend-command.md`; they are carried into this branch by cherry-pick after this document. This depth pass
  covers the stop-at-the-line work only. PR 949 is superseded by this branch.
- L4 JH 287 (2026-11-21, about 20:10-20:50 local) built T1, answered the lens findings (a Read of a `.md` passes, as
  the host's Edit needs one first; a lone `js-harness loop stop` passes; the refusal names the characters that keep a
  command from passing) and opened draft PR 950 at afbf3774. It read its spend at 8.44M and not again until after the
  PR: 22.43M against its 20M line, the 15M state write missed. Its open items, assigned to JH 288 by the lead: these
  T2-T7. The lead's decision for T6 (brief-spend-stop-close.md, item 5): past the line a gate commit, a push, `gh pr`,
  a notify and a write of the session's own state or feature document still pass, so work is never stranded.
- L5 Evidence for T4 (JH 288): in the lead's transcripts d6383aea and f5c3ee4d, a UserPromptSubmit hook's output sits
  beside 23 of 195 and 16 of 62 cross-session messages and beside 19 of 265 and 13 of 78 typed prompts; the hook logs
  only when it prints, so it runs on both kinds. A route that read only a session's first prompt would have missed JH
  288, whose line came in a message after a held start. One literal, "Stop at <N> cache-read", read by one parser; the
  lead writes it in each brief's message. `sessions start` is refused in this project (rule sessions-open-in-sidebar),
  so its `--line` serves projects without the rule.
- L6 Evidence for T7 (JH 288, no run spent): `<home>/.js-harness/channel/rules-seen/98d451db-a8bb-4b5a-971f-a696a47184e8.json`
  was written at 20:49:24 local by `rules --hook`, which names its file by the payload's `session_id`
  (`bin/lib/rules-reach.mjs`, `seenPath`), on this session's first prompt; `CLAUDE_CODE_SESSION_ID` in the same
  session is 98d451db-a8bb-4b5a-971f-a696a47184e8, and `spend --self` read that transcript. The PreToolUse payload
  carries the same `session_id` field by the hooks contract: inferred from the one payload, not seen in a PreToolUse one.

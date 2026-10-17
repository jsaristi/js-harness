Throughput item 2, ready pull requests landing without a lead turn: measured, and cut by the plan's stop rule to the part that pays.
Branch: docs/land-unattended (design), then feat/land-unattended (build), from origin/main 9ecfc6e. Delivery: ask-on-risk. Tests: `node --test`.
Design version 2, by JH 24 on 2026-10-16, after two readers (Opus 5.5, high) who did not write version 1; L3 says what they changed.

## Goal
A land spends no suite run or bisection on a candidate whose suite never ran, and the lead and the user
decide the rest of item 2 on measured numbers: what a keeper would save, and what a land's place in the
gate line would save, each against its cost.

## Why
Throughput item 2 (`docs/ROADMAP.md`, "Throughput") gives ready to merged as a median of 48 minutes and
a worst of 391. Measured by reader B, that baseline is creation to merge (391 is pull request 280,
created 13:35Z and merged 20:07Z, a draft held for the user's question 10), so it counts holds and
rework. Ready to merged, from each pull request's last "ready to land" note in the channel record to
GitHub's `mergedAt`, is a median of 37 minutes, p75 87, worst 127, over 47 pull requests merged between
12:35Z and 23:34Z on 2026-10-16. Over about 23 lands that afternoon, the parts (reader B; the lead's
delay is a reconstruction):
- a land with no wait for the gate lock: 7 to 11 minutes (suite 4 to 6, CircleCI 3 to 4);
- waiting for the gate lock: about 160 minutes in all (19, 27, 26 and 21 minutes at 12:02, 12:57,
  13:54 and 18:33);
- the lead's own delay, from the later of the previous land's end and the ready note to the land's
  start: about 170 minutes in all, a median of about 5;
- the tail, 98 to 127 minutes: red candidates (the order-flaky `check --first` test, fixed by PR 307).
A keeper removes only the lead's delay, about 5 minutes off the median, and adds half its tick.

## Done when
- `node --test bin/merge-queue.test.mjs` exits 0
- `npm run check` exits 0
- a land whose gate exits 75 or is killed exits 5, says the suite did not run, pushes nothing and
  bisects nothing, with two or more pull requests in the candidate
- a land asks `js-harness gate first` for its gate before it waits, and says so; with no session id or
  a refused ticket it waits its turn in the line and says that

## In scope / Out of scope
- In: `bin/merge-queue.mjs` and its test, `README.md`, the help of `bin/js-harness.mjs`, this document,
  ROADMAP item 2's row (its baseline's method and its state).
- Out: what a land checks (the suite here, CircleCI, Codex coverage, the gentle-ai evidence, the rule
  door): unchanged, by the plan's stop rule. The keeper and a land's gate-first ticket: designed below,
  built only on the decisions in "Ask me before".

## Constraints
- A suite that did not run is not red — because `localSuite` reads any non-zero gate exit as red
  (`bin/merge-queue.mjs:120-121`), and with two or more pull requests that starts a bisection
  (`:246`) that spends suite runs on a candidate nobody tested; with one it is exit 4, a red.
- No retry of a true red — because a red candidate means a pull request is wrong, and running it again
  costs a suite run and proves nothing.

## Design
1. **Exit 5, the suite did not run (build now).** `js-harness gate` exits 75, `GATE_NOT_RUN`, when its
   wait for the lock gives up and when a waiting push refuses the turn (`bin/gate.mjs:61`, :492-498,
   :525); the queue's own 120-minute bound on the call can kill it, `status null`
   (`bin/merge-queue.mjs:119`). Each is "not run": `--land` names the reason, pushes nothing,
   bisects nothing and exits 5. It pays alone: a false bisection costs one suite run per halving.
2. **A land takes a gate-first ticket (the lead's decision).** `gate first` (`bin/gate.mjs:231`) puts a
   gate at the head of the line; `localSuite` takes none today. About 160 minutes of lock waits that
   afternoon would mostly go, against about 5 minutes of suite each land puts ahead of a session's
   gate. No check changes; it is an order of the line.
3. **The keeper (deferred by the stop rule).** It would save about 5 minutes off a 37-minute median.
   What it needs to be safe, from the readers:
   - it keeps going after a land, so the lead's turn leaves the critical path (else it saves nothing);
   - `landCandidate` returns a structured outcome (landed, dropped, kind), since exit 0 also means
     "nothing to land" and "landed after dropping a culprit";
   - a red set, the culprit's head or the CircleCI-red batch, kept in a file until a head moves, so a
     red is not retried;
   - a hold the lead owns: a `hold` label, read in the same `gh pr list` call, and a re-read of drafts
     and labels just before the push of main; today holds also sit in the prose of ready notes
     (PR 302 "please put the design to him before...", PR 292 "Land 289 first"), which only the lead's
     turn reads, so "non-draft and unheld means landable now" becomes a rule for every session, with
     one home;
   - no new lock: `loop run keeper` already refuses a second live keeper (`bin/loop.mjs:216-218`), and
     the leased push stops a losing land; a hand `--land` beside the keeper is the lead's to avoid.
   Estimated at several hundred lines and a new protocol for the user's yes. It returns less than it
   costs; the lead tells the user so, as the stop rule says.
4. **The measure, one method.** Ready to merged from the last ready note to `mergedAt`, as above; the
   ROADMAP row's baseline is restated with it. A shipped `--times` command is deferred: a one-off count
   from the channel record, the gate log and `gh` is enough for the stop rule.

## Ask me before
- Design 2: whether a land goes to the head of the gate line. The lead decides, or asks the user if it
  reads it as theirs: it orders other sessions' gates.
- Design 3: whether the keeper is built at all. The charter (relief line 4) keeps "a new protocol" and
  "for now, merging code" with the user; the user's "Sí, con todo en verde" (relief line 999) was
  given for the lead landing with the lead reading each land. The question carries its measured payoff,
  about 5 minutes off the median, and the session rule of Design 3.

## Tasks
- [x] T1 (kind: design) This document: version 1 read by two readers, version 2 here. Route: inline. PR 336, landed.
- [x] T2 (kind: build) Design 1, exit 5, and Design 2, the land's gate-first ticket (L4); tests first. Route: inline. RED: the test file failed to load on the missing `localSuite` export; GREEN: the 25 tests of `--land` and `localSuite`. Reopened by the verifier's B1 (L5) and closed again (L6): a `js-harness gate` claims the ticket that names its folder.
- [ ] T3 (kind: docs) ROADMAP item 2's row: the method of its baseline, 37 / 127 over 47 pull requests,
  and Designs 2 and 3 as decisions. Route: inline.

## Log
- L1 (2026-10-16, the lead's notice to JH 24, a claim of that session, not the user's words): "design how
  ready PRs land without a lead turn, same checks and reviews, two readers before building".
- L2 (2026-10-16) The map, by one reader (Opus 5.5, high), read-only: the queue's ready, the gate and
  CircleCI waits, the exit codes, the retired keeper7.sh, the unbuilt keeper of `odd/tasks/lead-tools.md`
  L2, the absent "ready" notice kind and board state, and the charter.
- L3 (2026-10-16) Version 1 was a keeper loop, `merge-queue --keep`, with exit codes 5 and 6, a queue
  lock and a `--times` command. Reader A (correctness) found: a beat-based lock cannot beat while
  `spawnSync` runs the suite; a true red would be retried; exit codes cannot steer a loop; draft is no
  hold the lead owns, and a hold set mid-land is not seen; exit 5 must cover every "not run". Reader B
  (cost) measured the wait (Why, above): the keeper saves about 5 minutes; the baseline was creation to
  merge; holds in the prose of ready notes would be dropped; the queue lock adds a file outside the
  repository that uninstall does not remove (`bin/lib/manifest.mjs:1308-1313`) and is not needed; exit 6
  never fired in that day's data. Version 2 keeps exit 5, puts the gate-first ticket and the keeper to
  decisions with their numbers, and drops the queue lock, exit 6 and `--times`.
- L4 (2026-10-16, the lead's message to JH 24, a claim of that session, not the user's words): "(a) yes, a
  land takes a gate-first ticket; no check changes. Build it with exit 5 (suite not run, no bisection),
  test first, after slice (c). (b) The keeper stays deferred by the stop rule (5 of 37 min); I tell him
  on return, nothing to build." So Design 2 is built with Design 1 in T2, and Design 3 waits.
- L5 (2026-10-16, state at the context pause) T2 committed as `a2619e8`; Codex passed on 7d246c4..a2619e8; gentle-ai escalated item 5 (high, due) but its STATUS timed out twice (operation_timeout, pre_native). Verifier (Opus, high) blocker B1: `gate -- ...` never claims a gate-first ticket (only `check` does, `bin/check.mjs:1713`), so the land's ticket is never used and holds one of two slots. Fix in progress, tests appended (RED not run yet): `claimTicket` gets `named: true` (only a ticket naming the tree), `bin/gate.mjs` claims via an exported `claimOf` with `{ named: true }` before `takeGateTurn` and passes `first`; `localSuite` cancels its ticket after the gate (`gate first --cancel <id>`, id parsed from "ticket <id>:"), test: merge-queue.test line ~1119 expects calls[2] the cancel. Advisories A1-A4 recorded only. Next: add the cancel assertion, run RED via js-harness gate, implement, gate, Codex, retry gentle-ai STATUS once, push, PR, notify.
- L6 (2026-10-17) B1 fixed. `claimTicket` takes `named`: only a ticket whose tree is the folder, never one that names none, so `gate -- node --test x` does not spend a ticket the lead issued for a session's next whole check. `claimOf` is exported from `bin/check.mjs` with that option and nothing else of `check` changes (L4: "no check changes"); `bin/gate.mjs` claims with it before `takeGateTurn` and hands it as `first`, after the refusal of a waiting push, so a gate that runs nothing claims nothing. `localSuite` cancels the ticket it issued once the gate ends: one the gate did not claim (it ran nothing, or an older candidate's gate claims none) would hold one of the two slots for an hour. RED: the three new tests failed (pass 0, fail 3); GREEN below. Not changed: the ticket line `gate first` prints still says "the next check".

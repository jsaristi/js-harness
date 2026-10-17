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
- every `--land` appends one line to `<git common dir>/js-harness/lands.jsonl` (Design 4), and a
  `--dry-run` none

## In scope / Out of scope
- In: `bin/merge-queue.mjs` and its test, `README.md`, the help of `bin/js-harness.mjs`, this document,
  ROADMAP item 2's row (its baseline's method and its state). Since L8, the land's items of the
  throughput plan v3: B2 (Design 4), D (Design 5) and A(b) (Design 6).
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

4. **B2, one land record per land (L8).** Every `--land` appends one JSON line to
   `<git common dir>/js-harness/lands.jsonl`, beside the Codex review records, inside the repository's
   git directory, so no uninstall step is owed. Its fields: `v` (1), `startedAt`, `endedAt`, `session`
   (`CLAUDE_CODE_SESSION_ID` or null), `main`, `considered` (every open pull request's number, in the
   queue's order), `leftOut` (`{ pr, reason, said }`, reason one of `not-ready`, `review`, `door`,
   `conflict` with `files`, `merge` and `red`, whose `said` is what the suite said), `phases` (`{ phase,
   startedAt, seconds, ok }` for each `suite` run, bisection halves included, then `circleci` and `push`;
   `ok` null for a suite that did not run), `circleci` (`{ state, name, conclusion, url }` or null),
   `candidate`, `landed` (the numbers in main), `exit` and `said` (its last line). A record that cannot be
   written is said and never changes the exit. The throughput command reads it (its session's B2).
5. **D, CircleCI starts with the land's local suite (L8, L11).** The queue branch was pushed after the
   local suite was green (`bin/merge-queue.mjs` `landCandidate`), so the two ran in series, about 2.8
   minutes a land. Now it is pushed before the suite, and removed as soon as its answer no longer
   matters: when the candidate is red or untested here, or once CircleCI answered. Main still moves only
   when both are green, pushed after the CircleCI poll by sha. Its cost (L11, L12): one CircleCI run
   spent on each candidate this machine turns red or does not test, since removing the branch does not
   cancel its build; a land killed before it ends leaves its branch on origin. The
   CircleCI usage page no longer gates it (L11).
6. **A(b), the sessions of left-out and red pull requests are told (L8, L14).** One note per pull
   request a land leaves out (a red is one left out), to that pull request's session, with the reason and,
   for a red, the failing test names the gate log holds for the land's run. The session is read from JH
   26's B1 (#349): the newest `ready` notice naming the pull request, its sender's title giving the work
   session's number; 42 of 58 ready notices were sent from main, so a branch names no session. A pull
   request no work session's ready notice names is told to nobody (`told: null`), and the lead relays it.
   The same text is told once for one ready notice, since a pull request left out for a draft or a
   missing review line is left out by every land until it changes. A landed pull request is not told:
   `js-harness wait --pr` already ends on it.

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
- [x] T3 (kind: docs) ROADMAP item 2's row: the method of its baseline, 37 / 127 over 47 pull requests,
  and Designs 2 and 3 as decisions; and his two answers of L8 under Decided. Route: inline.
- [x] T4 (kind: build) Design 4, B2, the land record; tests first. Route: inline. RED: the four new tests failed (pass 0, fail 4); GREEN: `bin/merge-queue.test.mjs` 68 of 69, the one left the test that wanted the git directory's `js-harness` folder empty after a land, now holding `lands.jsonl` alone, changed to say so. `circleciState` names a green run as it names a red, so the record keeps the build that passed.
- [x] T5 (kind: build) Design 5, D; tests first (L11: the CircleCI usage page is no longer a precondition). Route: inline. RED: of the six tests D adds or rewrites, five failed (pass 1, fail 5); GREEN: `bin/merge-queue.test.mjs` 72 of 72, with the two land-record tests of T4 changed to the phases D records (a CircleCI phase neither green nor red, state `dropped`, when the suite is red or did not run).
- [x] T6 (kind: build) Design 6, A(b); tests first, after JH 26's B1 lands (#349, landed). Route: inline. RED: the test file failed to load on the missing `failingTests` export; GREEN: `bin/merge-queue.test.mjs` 77 of 77 (74 of the whole file, then the three land-record tests of T4 changed to the `told: null` every left-out entry now has).

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
- L7 (2026-10-17) Reviews of T2 (`a2619e8`, `2633d0a`). Codex: a2619e8 on 7d246c4..a2619e8, then "the patch is correct (confidence 0.9)" on a2619e8..2633d0a, both recorded. gentle-ai: high (item 5, escalated), lenses risk, resilience and reliability, approved and acknowledged on 685a451..2633d0a, lineage review-2eafba6b93ddb5ce (the STATUS that had timed out twice answered on the third try). Its non-blocking findings, for later: a gate claims its ticket before its turn, so a gate refused after the claim spends it, as `check` does (R3/R4 claim-before-turn; the land cancels its own anyway); the gate test does not assert the claimed ticket reached the lock as `first` (R3); the cancel's exit is not said (R4); the `answer` error fallback (R3).
- L8 (2026-10-17, the lead's notice to JH 24, a claim of that session, not the user's words): "Lead: he approved the throughput protocol and a daily Windows run (2026-10-17). After 346 lands, land-unattended also takes, from notes/throughput-v3-plan.md (Version 2): D (CircleCI starts with the land's local suite), B2 (one land record per land), A(b) (left-out or red PRs' sessions notified with failing test names; needs JH 26's B1). Add to ROADMAP Decided, verbatim: 'Sí, aprobalo (Recomendada)' and 'Una vez por día (Recomendada)'." His words are the lead's transcript `e152c9d8`, line 18165, 2026-10-17T02:14:08Z, answering the question tool: the protocol "Sí, aprobalo (Recomendada)", the Windows suite "Una vez por día (Recomendada)". The plan is in the side-session notes of the lead's family (`throughput-v3-plan.md`). Designs 4 to 6 above, tasks T4 to T6; B2 first, since the throughput command measures with it, then D and A(b) when what they wait on is there.
- L9 (2026-10-17) Reviews of T4 (`1601cde`). gentle-ai: high (item 5, escalated), lenses risk, resilience and reliability, approved and acknowledged on ead4e8d..1601cde, lineage review-7a98e0830084c6b6; two suggestions, non-blocking: a test for every left-out reason, and one for the push phase of a push that fails (the code records it `ok: false`). Codex: "the patch is incorrect" (0.89), P2: a candidate of one pull request red on this machine, alone or the last a bisection kept, recorded no left-out pull request. Fixed test first (RED: pass 0, fail 1): that pull request is recorded `red` with what the suite said.
- L10 (2026-10-17) The fix `ab79137`: Codex "the patch is correct" (0.99) on 1601cde..ab79137, its finding fixed; gentle-ai assessed it medium, 11 lines, not due (under_budget), not escalated, since it changes only what the record says and nothing a land pushes. T3 done: ROADMAP item 2's row gives the measured baseline (37 / p75 87 / 127 over 47 pull requests) and its decisions, and Decided gains his two answers of L8, "Sí, aprobalo (Recomendada)" and "Una vez por día (Recomendada)", with the line of the lead's transcript that holds them.
- L11 (2026-10-17, the lead's notice to JH 24 at 22:25 local, a claim of that session, not the user's words): "Lead: go on D now. The CircleCI usage page needs a sign-in (his, not ours), so it is no longer a precondition: D runs the same CircleCI jobs per land, only earlier; the added cost is one wasted CircleCI run when the local suite is red. State that cost in the PR. The usage page waits for him at the PC. A(b): B1 is PR 349, landing now with 350-352." So T5 is built now, stacked on T4's branch, and its pull request states that cost. The shape: `landCandidate` pushes the `queue/*` branch before the suite, and one `drop` removes it once, under a `finally`, so no way out of a land leaves it on origin; a red or unrun suite drops it before anything else (CircleCI state `dropped`, its phase neither green nor red), and a bisection gives each shorter candidate a branch of its own. The context pause came mid-build and the host compacted this session; this entry was written after it.
- L12 (2026-10-17) Reviews of T5 (`422fe1a`). Codex: "the patch is correct" (0.9) on 1e9d9a6..422fe1a, recorded. gentle-ai: high (item 5, escalated: a land now pushes and deletes a branch on origin before its suite), lenses risk, resilience and reliability, approved and acknowledged, lineage review-d9eb564f87db2a24, with four warnings taken up in the next commit: the cost was understated, since a candidate this machine does not test (exit 5) or a land that fails after the push also spends its CircleCI run (R4); a land killed before it ends leaves its branch on origin, so L11's "no way out" holds for the exits of the process only (R4); the CircleCI phase now spans the local suite (R3); and a suite that did not run said its exit line before the branch was dropped, so a refused delete became the last line and the record's `said` (R3). The last is fixed test first (RED: pass 0, fail 1): `notRun` drops the branch before its line. The others are said in USAGE, the README and Design 5. Accepted as is: a refused push of the queue branch now stops the land (exit 1) before its suite, where it stopped it after (R3); the land fails either way, now sooner.
- L13 (2026-10-17) The fix `ed7c5bc`: Codex "the patch is correct" (0.98) on 422fe1a..ed7c5bc, recorded; gentle-ai assessed it medium, 35 lines, not due (under_budget), not escalated, since it moves one drop before one line and says the cost in prose. PR 350 (T4) landed on main as 1b0db2ad; T5's branch merges main and goes to its own pull request.
- L14 (2026-10-17) T6 built on its own branch, `feat/land-tell-left-out`, stacked on T5's (#356), since a pull request holds one slice. `failingTests` reads the failing test names of the last gate that ended at the land's folder from the gate log (its sensors' `failing`); `localSuite` adds them to a red, and a red left-out entry keeps them. `tellLeftOut` runs after the land, before its record is written, and prints outside the record's `said`: for each left-out entry, the newest `ready` notice naming the pull request gives the work session (`roleOfTitle` of its sender's title), which gets one note; the same text is not told again since that ready notice. Every left-out entry gets `told`, the number or `null`. The lead's notice of 23:29 local: 350's rest (707d81e, the ROADMAP:997 wording) conflicted with main after 351 and 353 landed; it moved to #356 as 8be7842 and #350 was closed with a pointer.
- L15 (2026-10-17) Reviews of T6 (`d3edcee`). gentle-ai assessed it medium, 207 lines, not due (under_budget), not escalated: it adds notes to the channel and two optional fields to the land record, and changes nothing a land pushes. Codex: "the patch is incorrect" (0.97), two P2 on 8be7842..d3edcee, both about naming the wrong failures. A suite run read the last gate of the land's folder that named any failing test, so a run red on a sensor with no names took an older run's names: `failingTests` now reads only the gates that began since the run it is asked about. A bisected culprit kept what the whole candidate said and failed, where the shortest red candidate is the culprit's own: the bisection now keeps that run. Both fixed test first (RED: pass 0, fail 2); GREEN: `bin/merge-queue.test.mjs` 79 of 79. #356 (T5) landed as 744c588.

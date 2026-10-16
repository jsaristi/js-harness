# A ticket that puts one session's next check first in the line of the gate

Locator: `odd/tasks/gate-first.md` · Engram mirror: `odd/gate-first/tasks` · Branch: `feat/gate-first` ·
Delivery: `ask-on-risk` · Runner: `node --test`

## Goal
The orchestrator can let one session's next whole `check` go before every other gate that waits, and
everyone can see that it did, who allowed it and why.

## Why
A gate waits behind every gate that arrived before it, and on 2026-10-14 the line held up to seven: a fix
that unblocks the others, or the batch run on main, waited as long as any commit.

## Done when
- `node --test bin/lib/gate-lock.test.mjs bin/gate.test.mjs bin/lib/gate-log.test.mjs` exits 0
- `npm run check` exits 0
- Two gates waiting, the one whose session holds a ticket takes the lock first; the other's wait line
  names it and the ticket's reason.

## In scope / Out of scope
- In: `bin/lib/gate-lock.mjs` (the claim and the order), `bin/gate.mjs` (`gate first`),
  `bin/lib/gate-log.mjs` (four kinds of line), `bin/lib/sessions.mjs` (the board), docs.
- Out: `gate -- <command>` never claims a ticket; the turn that runs is never cut.

## Constraints
- `gatesAhead` reads each other gate's file once and caches it (`bin/lib/gate-lock.mjs:357-363`), so
  `first` is in the waiter's file from its first write — a field added later would never be seen.
- Gates of an older version ignore the field (`waiterSaid`, `gate-lock.mjs:255-262`): to them a ticket
  holder is an ordinary arrival, which the board flags.

## Effort
high

## Ask me before
Nothing planned: the design is the one the lead took (`odd/tasks/faster-check.md`, T1).

## Specs

- **S1** (his words, `ffe99ebf` line 2115, 2026-10-14T06:30:54Z): "agrega la prioridad del gate al diseño
  de JH 8".
- **S2** (the design, `odd/tasks/faster-check.md`, "The priority of the gate (S3), version 2", verbatim):
  - **What it is:** a ticket for one session's next whole check (`check`, never `gate -- <command>`): the
    session's id (from the host), optionally its tree, why, who issued it, and until when it may be
    claimed (at most 60 minutes). It goes before every other waiter; the turn that runs is never cut.
  - **The claim is atomic and happens at arrival** (reader A): the gate renames the ticket file into its
    own waiting folder and writes `first: <ticket id>` into its first file, beside `waitingSince`. The
    order of the line becomes (first, arrival, token), computed from that once-read file only, as the
    line already is, so two gates can never see each other ahead. A ticket that cannot be read is no
    ticket. A ticket left in place while its expiry passes is gone; a claimed ticket no longer expires.
  - **Spent at the claim**, so a gate proven by its tree key, stopped, or refused spends it too and the
    tree cannot jump the line twice. A failed run's fix waits like any other commit; the issuer gives a
    second ticket if he is still waiting on it.
  - **Who issues it:** the orchestrator, `js-harness gate first --session <id> [--tree <path>] --reason
    "<why>" [--minutes n]`; a work session only on the orchestrator's word, quoted in `--reason`. Two at
    most open, in the order issued; a third is refused, naming them. The orchestrator's own batch run on
    `main` may carry one by itself (`--first` on that one command).
  - **What stops every session marking itself first:** at most two open; each says who issued it and
    why; the board prints them and flags one whose issuer is not the orchestrator; the gate log keeps
    each issue, claim and expiry. It cannot be made impossible (any process of the user can write the
    file), so it is made seen.
  - **How a waiter sees it was passed:** its wait line names the gate that went first and the ticket's
    reason; its start line in the gate log marks that gate `first: true` among the gates it waited for.
  - **The gate log:** `first-issued` (session, tree, reason, by, until), `first-claimed` (gate id, the
    waiters it passed), `first-expired`, `first-cancelled`.
  - **Undo:** `js-harness gate first --cancel <id>`, the expiry, or deleting the ticket file. A gate of
    an older version ignores tickets; the board flags waiters of an older version.

## Tasks

| ID | Specs | Route | Status | Evidence |
|----|-------|-------|--------|----------|
| T1 | S2: who issues it, undo, two at most | inline | done (slice A) | `js-harness gate first` issues, lists and cancels; `first-issued`, `first-cancelled`; `bin/lib/gate-first.mjs`, its 11 tests, 3 in `gate.test.mjs`; `uninstall` removes the folder (`manifest.test.mjs`) |
| T2 | S2: the claim, spent at the claim | inline | done (slice A) | the claim at arrival (`claimOf`, `check.mjs`), the order (`inTurnBefore`, `gate-lock.mjs`), the expiry; `first-claimed`, `first-expired`; 3 tests in `gate-lock.test.mjs`, 3 in `check.test.mjs` |
| T3 | S2: how a waiter sees it was passed | inline | done (slice A) | the wait line says `first by ticket <id>: <reason>`, `first: true` in the start line and ` (first by a ticket)` in `gate log`; 1 test in `gate-log.test.mjs` |
| T4 | S2: what stops every session marking itself first | inline | done (slice B) | `js-harness sessions` prints each open ticket with its issuer and flags one whose issuer is not the orchestrator by its title, or not known (`ticketLines`, `readGateTickets`, `bin/lib/sessions.mjs`); a gate of the lock that went first says `first by ticket <id>: <reason>`; `check --first <reason>` issues its session a ticket for its tree, claimed as it arrives; 3 tests in `lib/sessions.test.mjs`, 1 in `sessions.test.mjs`, 3 in `check.test.mjs` |
| T5 | S1, S2 | inline | done (slice B) | help of `check`, README (`js-harness gate`), ROADMAP (the gate, "The ticket that goes first"), `faster-check.md` T2 |
| T6 | S2: two tickets at most | inline | pending (follow-up) | Codex reads `e464081` (a ticket written as `<id>.pending`, counted with the other pending ones, renamed to a claimable ticket only once its count passed) inside the review of a later change to `bin/lib/gate-first.mjs`; `codex-review` refuses a second recheck of the review that ended at `b10ce08`, so `828b23b..e464081` is recorded as a skip naming this task |
| T7 | (tooling) | inline | pending (follow-up, Later) | `codex-review` reads a merge of origin's default branch by what was written in it, but a merge of a stacked base (`cd2b689`, `feat/gate-first` into this branch after that base took `origin/main`) as the whole range from `origin/main`: 4 parts, about 1.2M input tokens, over the allowance, for commits every one of which already has a record. Teach it to read such a merge by what was written in it too; until then `5cccfc4..cd2b689` is recorded as a skip naming this task. The merge's own resolution is two hunks: `bin/check.mjs` takes main's lock fields (`env`, `remote`) beside the `--first` lines, `bin/js-harness.mjs` takes this branch's `check` help beside main's `gate` and `init` help; the gate passed on it |

## Log

- **L1** (2026-10-14): his words, S1; the design, S2, attacked by two Opus readers before the lead took
  it (`faster-check.md`, "What the readers changed").
- **L2** (2026-10-14): the map of the lock, by a read-only explorer. A waiter's file is
  `gate/wait-<token>/holder-<token>.json`, written once by `stage()` (`gate-lock.mjs:582-598`) with a
  plain write; the one atomic step is the rename of the folder to `lock` (661). The order is
  `gatesAhead` (344-371): `since`, then token. The board sorts apart, by `waitingSince` (278-297,
  `lib/sessions.mjs:1047`). The gate log drops kinds it does not know without counting them
  (`gate-log.mjs:234-236`), so four new kinds are safe for older readers. `check` and `gate` both reach
  the lock through `takeGateTurn` (`check.mjs:841`) with the session from `CLAUDE_CODE_SESSION_ID`.
- **L3** (2026-10-14, a slip): writing this document through a double-quoted `node -e`, its backticks ran
  as commands. Nothing was written or committed: a part of `gate-lock.test.mjs` ran in temporary homes,
  `npm run check` did not start, and `js-harness gate first` exited 2 before any lock. The document went
  through Write instead, as the memory rule says.
- **L4** (2026-10-14, the lead at 14:21): his decision (`ffe99ebf` line 5394, 19:15:14Z: "Sí, tomemos el
  intercambio con verde de GitHub"): a code pull request merges on a green GitHub run against the main it
  lands on, and sessions stop merging main again. The ticket matters less with that, so it goes last in
  JH 8's queue, after the gate log's failing test names of a WSL run and the warning for a `node --test`
  of several files outside a turn. Nothing of it is built yet: this document is its whole state.
- **L5** (2026-10-16 07:05 by `date`, JH 24): slice A built, T1-T3, test first (each test seen red, then
  green): the store `bin/lib/gate-first.mjs`, the lock's order (a gate with a ticket before every gate
  without, then arrival, then token, from its first write since `gatesAhead` reads each file once), the
  claim in `check` (only a whole check that takes the lock; an inner check or one under a held lock claims
  nothing), `js-harness gate first`, the four log kinds, and `uninstall` removing `<home>/.js-harness/gate-first`
  (an unremovable one is said in `gateKept`, where `install` already tells to remove it by hand). The
  claimed line logs the waiters it passed by `cwd` and `pid`, not by their record's id. Slice B is T4-T5:
  the board, `check --first`, the docs. The branch merged main (`6c6201b`), clean by `git merge-tree`.
- **L6** (2026-10-16, JH 24): the reviews of slice A. gentle-ai approved `6c6201b..b10ce08` raised to
  item 4 (the order of the lock between processes), lineage `review-73fbddbc0542a97c`. Codex found two
  P2 on it: the folder of tickets removed between its making and the write (fixed in `828b23b`) and the
  cap of two open tickets not atomic. Its recheck of `828b23b` found the cap still open: a third ticket
  was claimable in the instant before its issuer counted it and took it back. `e464081` writes a ticket
  as `<id>.pending`, which no gate claims, counts it with the other pending ones, and renames it only
  once its count passed; a pending ticket older than a minute counts for nothing. A second recheck is
  refused by `codex-review`, hence T6. gentle-ai on `828b23b..e464081`: medium, not due (under budget).
  Its non-blocking advisories, for later: a claim whose rename fails on Windows with EPERM or EBUSY is
  silent; the `passed` of a `first-claimed` line overstates when the gate then stops, is proven by its
  tree or is refused; the spent paths of a proven, refused or log-off gate have no test.
- **L7** (2026-10-16, JH 24): slice B built, T4-T5, test first, on `feat/gate-first-board` stacked on slice
  A. The flag of "waiters of an older version" in S2 is not built: a gate of a version before tickets writes
  the same file with no `first` in it, which is what a gate of this version without a ticket writes, so
  nothing on disk tells the two apart. It waits for a version field in the gate's file. A ticket issued by
  `check --first` and not claimed (the gate of a commit of documents alone takes no lock) stays open until
  the session's next check claims it or it expires.

## Resume here (JH 8, 2026-10-14 15:13 by `date`, context 87%)

The queue is his order of corrections first (`ffe99ebf` line 5906), in the lead's order. Each slice ships in
one lock turn by the scratchpad script `ship-turn.sh` (commit with its gate, Codex over the slice, then the
push and the pull request only when Codex has no P0 to P2; the body gets the gentle-ai line).
1. Documents-only skip: `feat/merge-documents-skip` (worktree `merge-documents-skip`), `5c5028c` plus a fix
   of Codex's P2 (nothing staged asks no other side), its recheck turn queued (`mds2`). No PR yet; when it
   opens, its gentle-ai line covers only the fix: replace it with the range from `c33b7bf`.
2. Failing test names in the gate log: PR 142, merged (`028d658`).
3. testRunWarning: `feat/test-run-warning`, `1b88b76` plus the fix of Codex's three P2, recheck turn queued
   (`trw2`); then tell JH 15 it is on main (JH 15 refuses with it, his line 5718).
4. Codex out of the lock: probe 2 (at most 150,000 input tokens), queued by a background chain after (b).
5. PR 137 (124's documents) waits for its green GitHub run; a background wait watches it.
6. Then this ticket, after all of the above are merged.
- 15:48 by `date`: item 1 merged as PR 143 (`c0364f8`). Item 4 answered: probe 2 through `codex exec review`
  with codex-review's own arguments showed NODE_OPTIONS reaching Codex's commands and the preload ending its
  `node --test` (exit 1, "no `node --test` outside a turn of the gate lock"); its usage event read 0 input
  tokens. Part 2 of faster-check (Codex out of the lock) is buildable; reported to the lead, who says whether
  it is built at once or designed first.
- The lead's order for item 4 (after 15:48): "build it, test first; the design goes in faster-check.md in the
  same commit, not as a separate step. One condition before it ships: a review whose verdict is "blocked"
  only because node --test was refused would turn every Codex review into a stop. So codex-review must tell
  Codex the gate already ran the suite on this range and that a refused node --test is expected, not a
  finding; and the test proves that a review whose only complaint is the refusal is not recorded as blocked
  (or, if you find that cannot be told apart, say so and we decide). testRunWarning's recheck stays before
  it if its turn comes first." Worktree: `D:\js-harness-worktrees\codex-out-of-lock`, branch
  `feat/codex-out-of-lock`; the preload of the probe is `guard/no-test-preload.cjs` in the old scratchpad
  (d14eb9a1); a map of codex-review is being made by an explorer.
- 15:54 by `date`, the map of codex-review (explorer): it takes no lock itself (only callers wrap it in `js-harness gate
  --`; `WAYS_ON`, `bin/codex-review.mjs:660-665`, tells users to); Codex is launched at :1576-1580 with
  `leanEnv(childEnv(env))`, where NODE_OPTIONS would go; the default prompt `codex` (:226, :264) puts nothing on
  stdin, so the sentence "the gate already ran the suite; a refused node --test is expected" reaches Codex
  only through `own` (`reviewPrompt`, `bin/lib/codex-review-prompt.mjs:141`); there is no `blocked` outcome:
  "blocks" means `owesCorrection` (`codex-review-recheck.mjs:62`, verdict `incorrect` or any P0-P2). Tests stub
  Codex with `fakeCodex()` (`codex-review.test.mjs:298`); the env test at :531 breaks once NODE_OPTIONS is added.
  Two questions went to the lead: move the default prompt to `own`, and how to tell a complaint about the
  refusal alone from a real `incorrect` with no finding. PR 145 (testRunWarning) is open, a wait watches it.
- The lead's decision on the two questions (after 15:54): "take both of your recommendations. (1) Out of the
  lock the review always uses `own`, with the sentence in its intent block; `codex` stays only for a review
  run inside a turn. (2) An `incorrect` with no P0-P2, on a run where NODE_OPTIONS carried the preload and
  the only failed commands are refused node --test (exit 97 with the guard's line in the events), owes no
  correction; the run line says why, any finding still blocks. Add one thing: the record marks each such
  run, so a count of reviews let through this way is readable from the records (the measure you named as
  the alternative, kept alongside instead of instead)."
  Next: in `D:\js-harness-worktrees\codex-out-of-lock`, test first, the design in faster-check.md in the same
  commit: the preload (a file in bin/lib, exit 97 with one line when `--test` and no turn), NODE_OPTIONS in
  `leanEnv` when no turn is held, the sentence in `reviewPrompt`'s intent block, `own` forced out of a turn,
  the exemption in `owesCorrection`, and a mark in the record; `WAYS_ON` no longer sends to `gate --`.
- 15:58 by `date`: step 1 of the build is written, not committed, in `codex-out-of-lock`:
  `bin/lib/no-test-outside-turn.cjs` (the preload), `bin/lib/no-test-outside-turn.mjs` (its path, line, exit
  97) and their test (RED: module missing; GREEN 2/2). Open point for the next step: a preload path with a
  space would need quotes inside NODE_OPTIONS. Next: NODE_OPTIONS in `leanEnv` out of a turn (the env test at
  `codex-review.test.mjs:531` changes), then the sentence and `own`, then `owesCorrection` and the record's mark.

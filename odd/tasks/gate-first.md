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
| T1 | S2: who issues it, undo, two at most | inline | pending | `js-harness gate first` issues, lists and cancels; `first-issued`, `first-cancelled` |
| T2 | S2: the claim, spent at the claim | inline | pending | the claim at arrival, the order (first, arrival, token), the expiry; `first-claimed`, `first-expired` |
| T3 | S2: how a waiter sees it was passed | inline | pending | the wait line, and `first: true` in the start line |
| T4 | S2: what stops every session marking itself first | inline | pending | the board prints tickets and flags an issuer that is no orchestrator; `--first` on the batch run |
| T5 | S1, S2 | inline | pending | help, README, ROADMAP, `faster-check.md` T2 |

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

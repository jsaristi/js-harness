# Future-model protocol

Locator: `odd/tasks/future-model-protocol.md` · Engram mirror: `odd/future-model-protocol/tasks` ·
Branch: `docs/future-model-protocol` · Delivery: `ask-on-risk` · Runner: `node --test` · Session:
`JH 14 · protocolo para modelos futuros`, opened by the lead on 2026-10-14.

## Goal
When a new model arrives, a written procedure says how to measure the harness's payload, run the
evals, strip one component at a time and keep what still earns its place, with the cost of every
run stated before any spend; and the rule hierarchy's seven signals are read and recorded.

## Why
The design bet of `AGENTS.md`, "a stronger model needs a smaller harness", is only a bet until
something tests it on each new model. Principle 2 of the roadmap ("Each new model: remove one
piece, measure, keep what still matters") has had no procedure since the founding plan
(`docs/origin.md:75`, `:92`), and F5 measured the current stack at 1.68 to 2.54 times the cost of
the minimal one for the same score.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/future-model-protocol.md` exits 0
- `npm run check` exits 0
- `docs/future-model.md` holds the procedure, each step naming its command or its gap, and the
  roadmap's F7 row points to it (the roadmap is JH 7's: the change goes through the lead)
- The seven signals are read and recorded under "The seven signals" below, each with the command
  that showed it

## In scope / Out of scope
- In: `docs/future-model.md` (new), this document; the gaps G1 to G4 once he or the lead clears
  them as tasks of this feature (`evals/`, a payload command).
- Out: `docs/ROADMAP.md` and `odd/tasks/rule-hierarchy.md`, which are JH 7's (what changes there
  goes through the lead); running any eval, which is spend and his.

## Constraints
- No gate turn until the WSL gate is on main (the opening, 2026-10-14) — because everything else
  is paused for it; a documents-only commit runs no sensor and takes no lock.
- No spend without his yes, asked through the lead — because spend is his.

## Effort
high

## Ask me before
Any eval run; building the gaps if the lead does not clear them as this feature's work.

## Specs

S1. F7, as the roadmap states it (`docs/ROADMAP.md:88`, `:179-180`): "A written procedure: measure
payload, run evals, strip one component at a time". The opening adds, a claim of the lead: "The
design bet of AGENTS.md ("a stronger model needs a smaller harness") is what it tests. Spend on
evals is his: the procedure says what a run costs and asks before any."

S2. T15 of `odd/tasks/rule-hierarchy.md:1619-1622`, verbatim: "T15 The seven signals read and
recorded; the roadmap's section replaced by a pointer only after what it holds and this document
does not (the reading of the specification, "how far is far enough", the bullets on bias and
research, the team rules) is in `docs/SPEC.md` or here". "Here" is `rule-hierarchy.md`; this
session does not edit it, so the reading and the carry list are written below and the pointer
waits for JH 7.

S3. The gaps of `docs/future-model.md`: G1 the payload alone, G2 strip arms, G3 a cost statement
before a run, G4 the whole first request measured by a committed script. Proposed, not asked for:
each becomes a task only when cleared.

## The seven signals (read 2026-10-14, on `origin/main` at `d3f6ac1`)

From `odd/tasks/rule-hierarchy.md`, "Signals of done". One holds.

| Signal | Read with | Reading | Closed by |
|---|---|---|---|
| Six principles stated once | `rg -n -i "properly\|not to comply\|for the sake" AGENTS.md bin/lib/project.mjs bin/lib/manifest.mjs` | no hit: the first principle is in no file that should carry it | rule hierarchy T8, T9 |
| No principle without a control | `eza docs` | `docs/SPEC.md` does not exist | T1 |
| No rule living only in memory | `rg -n "memory-rules" bin` | no hit: the row of `doctor` is not built | T6 |
| `AGENTS.md` within its budget | `node -e "import('./bin/check.mjs').then(m=>console.log(JSON.stringify(m.checkBudget('.'))))"` | holds: `1499 estimated tokens (budget 1500)` | — |
| Honesty eval passes, line moves the score | `eza evals/tasks` | no honesty task: five tasks, those of F5 | T10 |
| No repeated mistake | `node bin/js-harness.mjs failures check --settled` | exit 1: 69 failures, 39 seen more than once, 17 not settled | the register's owners |
| No protocol without its incident | `rg -n "protocols" bin/lib/manifest.mjs` | no hit: the protocols skill is not built | T7 |

## What the roadmap's section holds and the rule hierarchy does not (S2)

Read by comparing `docs/ROADMAP.md:416-646` ("Rule hierarchy") with `odd/tasks/rule-hierarchy.md`
(C3 at `:228`, the `AGENTS.md` outline and the protocols at `:1290-1385`). For JH 7 to carry into
`docs/SPEC.md` or its document before the section becomes a pointer. Covered already: the five
parts and the "today" line of the specification (C3), the six principles (outline item 1), the
three words of a claim (item 4), the handoff shape and bad news first (protocol 6), the five
questions and a missing protocol proposed (protocol 4), C4 and C5 for "research well" and
"invent nothing".

Missing:

1. The reading of the specification: his correction, that the document says what the harness
   really is so a more capable model of a later generation could rebuild it from nothing and
   better, from that document alone; that the eval tasks are the measure of "better" and belong
   to the kit with it; that it is not loaded on every turn; and its limit, that the check proves
   every capability named and provable, not its reason well told (roadmap `:606-640`).
2. "How far is far enough": no point where a model never errs, and more text makes it worse; the
   three aims (a mistake cannot do damage that cannot be undone, it is seen quickly, it is not
   repeated); and "from there a rule enters only by replacing another" (`:557-564`).
3. Bias and research: what a reviewer is told to look for (a test weakened so that it passes, a
   hook skipped, a failing check left out of the report); bias answered by a second look that
   does not share it, a reviewer handed the code and not the conclusion, and before a conclusion
   that costs, the question of what would show it wrong; before running an unknown command, read
   its code; and "where it lives, judged twice", with the global `CLAUDE.md` line checked and the
   eval as the line's price (`:488-512`).
4. The team rules: each thing has one owner (a session writes its feature, one place writes the
   shared plan); what looks wrong is said, with its evidence, before it is done; reversible by
   default (what cannot be undone asks first, the rest records how it is undone) (`:513-539`).

## Tasks

- [x] T1 `docs/future-model.md`, version 1: the procedure, its cost table and its gaps (S1; route:
  inline)
- [ ] T2 A reader that did not write it attacks the procedure and looks for what is missing; its
  fixes taken or answered here (S1; route: one read-only reader on opus at high)
- [x] T3 The seven signals read and recorded, and the carry list for the roadmap's section (S2;
  route: inline)
- [ ] T4 The roadmap's F7 row and checkbox point to `docs/future-model.md`, through the lead (S1)
- [ ] T5 G3, a cost statement before a run (S3; after the WSL gate, if cleared)
- [ ] T6 G2, strip arms (S3; after the WSL gate, if cleared)
- [ ] T7 G1 and G4, the payload alone and the whole first request (S3; after the WSL gate, if
  cleared)

## Log

L1 (2026-10-14, the lead's opening, a claim; his words behind it are the founding plan,
`docs/origin.md:75` and `:92`): "F7, the future-model protocol (docs/ROADMAP.md line 88 and section
"F7 Future-model protocol" at line 179, owner none): a written procedure for when a new model
arrives: measure the payload, run the evals, strip one component at a time, keep what still earns
its place. The design bet of AGENTS.md ("a stronger model needs a smaller harness") is what it
tests. Spend on evals is his: the procedure says what a run costs and asks before any." And: "From
JH 7's odd/tasks/rule-hierarchy.md, T15 (line 1619): the seven signals read and recorded; the
roadmap's section replaced by a pointer only."

L2 (2026-10-14) The map, by one read-only explorer, spot-checked at `evals/suite.mjs:86`: the
payload is measured only inside `check` (`bin/lib/payload.mjs`, `measurePayload`); the suite takes
only the arms `minimal` and `current`; nothing estimates a run's cost before it spends; the
whole-request figure of 2026-09-26 has no committed script. Hence the gaps G1 to G4. Also read:
`evals/prices.mjs` gives no cost for a model it does not list, so pricing the new model is the
procedure's first step.

L3 (2026-10-14) T1 and T3 written. The cost table is derived from F5's means ($0.76 and $1.57 a
trial, about 3 minutes 40 seconds) and F6's per-trial range; a strip arm is costed at the
`current` figure, an upper bound. Next: T2, the reader.

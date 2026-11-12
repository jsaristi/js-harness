# senior-orchestrator

A senior session on Fable 5.2 at high that the lead starts for one task needing more intelligence. Session JH 192,
slice 3 of the lead's brief. Delivery: this design, then one pull request, branch `feat/senior-orchestrator`.
Runner: `node --test`.

## State
Design written, lean, as the lead asked (his go-ahead, lead transcript 93b72703, line 896). Next: its double review,
then T2 to T4 on `feat/senior-orchestrator`.

## Goal
The lead starts a senior session, titled `<code> SR · <purpose>`, with `js-harness sessions start`, and the start runs
on the senior's model and level, read from two rules, while every other start stays on the home.

## Why
His words (S1, S2): a senior orchestrator on Fable 5.2 high that the orchestrator sends specific tasks needing more
intelligence or complexity. Today a start on Fable is refused: the guard and `sessions start` hold every start to
`rule:session-model` (`claude-opus-5-5`), and only the level of a lead's title differs (`bin/lib/guard.mjs:113`).

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/senior-orchestrator.md` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `node bin/js-harness.mjs rules coverage` exits 0
- `node --test bin/lib/guard.test.mjs bin/sessions-background.test.mjs bin/lib/session-title-guard.test.mjs` exits 0
- `npm run check` exits 0
- A start titled `JH SR · x` runs on `claude-fable-5-2` at high with no advisor; one titled `JH 7 · x` asking for Fable
  is still refused.

## In scope / Out of scope
- In: two new rules, `senior-model` and `senior-effort`; `seniorTitle` beside `leadTitle`
  (`bin/lib/session-title-guard.mjs`); the guard's start and `sessions start` holding an SR title to them; the
  orchestrator skill's line on when to start one.
- Out: an advisor for the senior (the home's advisor is Fable itself, which `rules switch` refuses as no advisor);
  `rule:session-model`, `rule:lead-effort` and the other rules of the home; a senior that leads other sessions.

## Constraints
- The guard is high risk (security: guards): tests first, an independent verifier after its own checks.
- Each rule lands with its first reader in one commit (`rules change --with`), as `advisor-model` did.

## Ask me before
Nothing before it lands; his go-ahead (line 896) covers this slice once its gate and both reviews pass.

## Depth pass
- 1. Method: the role is a title, as the lead's is: `leadTitle` already holds a start to its own level by the
  title, so a senior is one more title with its own model and level, read from rules, and nothing else changes.
  Searched: `js-harness rules` (no rule names a senior), `roleOfTitle` in `bin/lib/session-title-guard.mjs`.
  Weighed and set aside: running the senior as a sub-agent on Fable (it would share the lead's context and end
  with the lead's turn; his words say a session the orchestrator sends tasks to).
- 2. Raw material: his words `js-harness sessions --quote 812b728f 1444` and `--quote 93b72703 775`; the hold by title,
  `bin/lib/guard.mjs:104-149`; the advisor refusal when it equals the model, `bin/lib/rules-switch.mjs` (`sameClaudeModel`).
- 3. The bar:
  spec 1: `node --test bin/lib/guard.test.mjs`: none, new behaviour (a Fable start is refused today).
  spec 2: `node bin/js-harness.mjs rules senior-model`: none, new behaviour (no such rule today).
- 4. Refutation: the request fails if a start on Fable already passes. Run: the guard's test that a start naming
  another model than `session-model` is refused (`bin/lib/guard.test.mjs`). Result: it is refused today.
  Verdict: supports
- 5. Request: "Let the lead start a senior session, titled `<code> SR · <purpose>`, on Fable 5.2 at high, read from
  rules, for a task it judges needs more intelligence or complexity, while every other start stays on the home."
  Adds: none

## Specs
1. "una sesion de Orquestador Senior que tenga Fable 5.2 Alto para cosas especiales que le coloque el orquestador"
   (2026-11-11).
2. "debe haber un orquestador senior fable 5.2 alto que le manden tareas de ciertas cosas especificas que se requiera
   mas inteligencia o complejidad" (2026-11-12).

## Tasks
- [x] T1 (kind: design) (1, 2) This document. Route: inline.
- [ ] T2 (kind: build) (1, 2) `senior-model` (`claude-fable-5-2`) and `senior-effort` (high), with `seniorTitle`.
  Route: inline.
- [ ] T3 (kind: build) (1, 2) The guard's start and `sessions start` hold an SR title to them, with no advisor; an
  independent verifier after. Route: inline, then one verifier.
- [ ] T4 (kind: docs) (2) The orchestrator skill: the lead starts a senior for a design, a depth pass of high-risk work
  or a failure seen twice, says why and the cost before it starts, and reads its result as any session's. Route: inline.

## Log
- L1 2026-11-12, his words at 93b72703:775 (S2), and his go-ahead at 93b72703:896.
- L2 2026-11-12, the lead: a lean design, no question to him; decide inside his words and write what was decided.
- L3 2026-11-12, decided here: the senior runs with no advisor, since its model is the advisor's; its cost on the
  weekly Fable meter is not known, so the lead says it before each start.

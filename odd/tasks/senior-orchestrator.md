# senior-orchestrator

A senior session on Fable 5.2 at high that the lead sends tasks needing more intelligence or complexity. Session
JH 192, slice 3 of the lead's brief. Delivery: this design, then one pull request, branch `rule/senior-orchestrator`
(`rules change` runs only on a `rule/` branch, `bin/lib/rules-change-run.mjs:170`). Runner: `node --test`.

## State
Committed: fd309617 senior-model; 8fc7a92b senior-effort; e25ab304 the reporters hold a senior by role (heldOfRole);
a258b450 only the lead starts a senior, one at a time. Reviewed 1a5061d..a258b45 (Codex 2 parts, lenses risk and
reliability). Their findings, fixed in the next commit, each with a test: a background senior was judged against the
home's advisor (home-sessions.mjs); rules switch's target home carried no senior (rules-switch.mjs homesOf); projectCode
refused the code SR, valid before (back to valid: its titles still parse); the default app-record reader was untested.
Next: review that commit (base a258b450), push, PR, ready. Follow-ups: the lead-protocols "A senior" section (T5, its
spans need coverage), the rule texts of session-model, session-effort and advisor-model ("every session but a
senior"). "No advisor" is claimed only after the first senior's transcript shows it.

## Goal
The lead starts a senior session, titled `<code> SR · <purpose>`, with `js-harness sessions start`, and every start
and resume of it runs on the senior's model and level, read from two rules, with no advisor; every other session
stays on the home, and no reporter calls the senior off it.

## Why
His words (S1, S2): a senior orchestrator on Fable 5.2 high that the orchestrator sends specific tasks needing more
intelligence or complexity. Today a start on Fable is refused (the guard and `sessions start` hold every start to
`rule:session-model`), and a title `JH SR · x` is refused before that (`TITLE_SHAPE`, `bin/lib/sessions.mjs:1248`).

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/senior-orchestrator.md` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `node bin/js-harness.mjs rules coverage` exits 0
- `node --test bin/lib/sessions.test.mjs bin/lib/session-title-guard.test.mjs bin/guard.test.mjs bin/lib/guard.test.mjs` exits 0
- `node --test bin/sessions-background.test.mjs bin/lib/model-home.test.mjs bin/lib/home-sessions.test.mjs bin/lib/home-doctor.test.mjs` exits 0
- `npm run check` exits 0
- The tests name each case: `sessions start --title "JH SR · x"` passes `--model claude-fable-5-2 --effort high` and no
  `--advisor`; its resume does the same whatever its record holds; `JH 7 · x` on `claude-fable-5-2` is refused; an SR
  start naming `--advisor`, another model or another level is refused; an SR start from a session not titled as the
  lead is refused; a second live senior is refused; `start_session` with an SR title is refused, naming
  `sessions start`; an SR session on Fable at high is on its home for `doctor`, `rules applied` and the board.

## In scope / Out of scope
- In: two rules, `senior-model` and `senior-effort`, joined to the Claude home (`CLAUDE_HOME`, `claudeHome`,
  `claudeHeld`, `homeFaults`: a full Claude id and an effort level); the title contract: `TITLE_SHAPE` and
  `roleOfTitle` with a role `senior` for `SR`, `projectCode` refusing `SR` as a code, `rule:session-title`'s text by
  `rules change`, `notify --to` and `sessions --address` taking `SR`; the guard's start (refuse `start_session` for an
  SR title, refuse an SR start whose starter is not the lead's title); `sessions start` and its resume (the senior's
  model and level, an explicit no-advisor state, `--advisor` refused, the starter's title, one live senior at most);
  the reporters' hold by role (`heldOf(title)` in `bin/lib/home-sessions.mjs`, `bin/lib/home-doctor.mjs`,
  `bin/rules.mjs`, the switch's `outsideLines`, `bin/lib/roster-home.mjs`); the texts of `rule:session-model`,
  `rule:session-effort` and `rule:advisor-model` by `rules change` ("every session but a senior"); the orchestrator's
  protocol, `bin/lib/lead-protocols.mjs`.
- Out: the values of the other rules of the home; a senior that starts sessions of its own (it is a session the lead
  sends tasks to, S2 "que le manden tareas", not a second lead; the lead's own role stays the lead's).

## Constraints
- The guard is high risk (security: guards): tests first, an independent verifier after its own checks.
- Each rule lands with its first reader in one commit (`rules change --with`); a rule changes once per pull request,
  since `rules change` and `rules switch` both compute from origin/main's declaration (JH 192, lead-effort-split L6).
- Before the first senior starts, one probe of `claude-fable-5-2` at high with no advisor (`claudeProbeArgs`), its
  cost said first.

## Ask me before
Nothing before it lands; his go-ahead (lead transcript 93b72703, line 896, "aplica todos los cambios ya") covers
this slice once its gate and both reviews pass, as the lead read it in its note of 2026-11-12 10:29 local.

## Depth pass
- 1. Method: a role is a title, as the lead's is: `leadTitle` holds a start to its own level by the title, so a senior
  is one more role with its own model and level, read from rules, through every reader of a title and of the home.
  Searched: `js-harness rules` (no rule names a senior); `roleOfTitle`, `TITLE_SHAPE` and `projectCode` in
  `bin/lib/sessions.mjs:1248-1299`; the hold by title in `bin/lib/guard.mjs` (`sessionStartRefusal` 88-118,
  `starterRefusal` 126-143, `sessionStartHome` 149-153); the resume in `bin/sessions-background.mjs:343-351`. Weighed
  and set aside: a sub-agent on Fable (it shares the lead's context and ends with its turn; his words name a session).
- 2. Raw material: his words, `js-harness sessions --quote 812b728f 1444` and `--quote 93b72703 775`; the double
  review read 134b8277 (`.git/js-harness`), whose findings each cite a path and line; the title parser,
  `bin/lib/sessions.mjs:1248`; the resume's home, `bin/sessions-background.mjs:343`; the reporters' hold,
  `bin/lib/home-sessions.mjs:51`.
- 3. The bar:
  spec 1: `node --test bin/lib/sessions.test.mjs`: none, new behaviour (`roleOfTitle('JH SR · x')` is null today).
  spec 2: `node --test bin/sessions-background.test.mjs bin/lib/guard.test.mjs`: none, new behaviour (a start on Fable is refused today).
- 4. Refutation: the request fails if a senior can be started today. Run: `node -e` importing `roleOfTitle` from
  `bin/lib/sessions.mjs` on `JH SR · x`. Result: null, so the title guard refuses it before any model is read.
  Verdict: supports
- 5. Request: "Let the lead start a senior session, `<code> SR · <purpose>`, on Fable 5.2 at high read from rules,
  and send it the tasks it judges need more intelligence or complexity; keep every other session on the home."
  The decisions D1 to D5 of the Log are the session's reading of his words, written there since the lead asked for no
  question (2026-11-12 10:29 local); his to correct.
  Adds: none

## Specs
1. "Yo creo que nos va a tocar que seguir como antes Opus 5.5 Extra para orquestador y Opus 5.5 Medio para sesiones y
   subagentes pero todos con Advisor de Fable 5.2 Alto y lo que podemos hacer es depronto tener una sesion de
   Orquestador Senior que tenga Fable 5.2 Alto para cosas especiales que le coloque el orquestador Opus 5.5 Extra
   Alto, que te parece así?" (2026-11-11)
2. "pero tanto los sub agentes como el orquestador deben tener el advisor fable 5.2 alto tambien y ademas debe haber
   un orquestador senior fable 5.2 alto que le manden tareas de ciertas cosas especificas que se requiera mas
   inteligencia o complejidad" (2026-11-12)

## Tasks
- [x] T1 (kind: design) (1, 2) This document and its double review. Route: inline.
- [ ] T2 (kind: build) (1, 2) `senior-model` and `senior-effort` in the home, with the title contract (`SR`, the
  session-title rule's text) and the probe. Route: inline.
- [ ] T3 (kind: build) (1, 2) The start and the resume: the guard and `sessions start`, starter, one live senior, no
  advisor; an independent verifier after. Route: inline, then one verifier.
- [ ] T4 (kind: build) (1, 2) The reporters' hold by role, and the texts of session-model, session-effort and
  advisor-model. Route: inline.
- [ ] T5 (kind: docs) (2) `bin/lib/lead-protocols.mjs`: when and how the lead sends a senior a task. Route: inline.

## Log
- L1 2026-11-12, his words at 93b72703:775 (S2); his "aplica todos los cambios ya" at 93b72703:896.
- L2 2026-11-12, the lead's notes of 10:29 and later: decide inside his words, no question, a lean design; the
  double review found lean too short, and this rewrite follows the findings.
- D1 The code is `SR`, beside `ORQ`: the session's choice.
- D2 No advisor: the home's advisor is Fable 5.2 itself, and an advisor that is the model adds nothing and cannot be
  told from none (`odd/tasks/advisor-home.md`, spec 6); so "todos con Advisor de Fable 5.2 Alto" of S1 does not reach
  the senior.
- D3 Long-lived: S2's "que le manden tareas" is tasks over time, so the lead sends the next one as a message to the
  senior's session, which a resume holds to its rules; the senior does not start sessions.
- D4 Cost: the weekly Fable meter is not read per call, so at most one live senior, and each start is a channel
  notice naming why and the meter before it.
- D6 Scope cut after the role sweep: the lead talks to its senior by the host's messages, and the senior reports to
  the orchestrator, so `roleNamed` does not take SR and no notice is addressed to a senior; this drops `notify --to`
  and `sessions --address` from In scope.
- D7 The senior's rules sit in SENIOR_HOME, apart from CLAUDE_HOME: a switch of the home leaves the senior on its own
  model (his Fable 5.2), so `rules switch` takes no flag for it and `rules change` alone moves it.
- D5 When: the lead's judgment that the task needs more intelligence or complexity is the condition; a design, a
  depth pass of high-risk work or a failure seen twice are examples, not triggers.

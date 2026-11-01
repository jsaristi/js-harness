# JH 129 · Carry out the re-plan: adjust F8, the growth limit first

Locator: `odd/tasks/replan-execute.md` · Branch: `worktree-replan-execute`, then `rule/growth-limit` for the rule ·
Delivery: a docs PR (the roadmap's record), then the rule with its control in a PR of its own · Test runner:
`node --test`

## Goal
The re-plan he adopted on 2026-11-01 is in force: the roadmap records it, his growth limit is a rule with a command
that says whether the week is red, and the outside outcome and S2 are routed to the lead with what each needs.

## Why
JH 128's analysis (`odd/tasks/replan-analysis.md`, section E) found the plan grows faster than it closes and that the
harness has built nothing outside itself; it recommended adjusting F8, not restarting. He adopted it (L1). The two
limits tried before held nothing because nothing measured them (the analysis, A2), so this one is computed by a
command, not judged by a session.

## Done when
- `js-harness contract check odd/tasks/replan-execute.md` exits 0
- `js-harness rules check` exits 0
- `js-harness rules growth-limit` exits 0
- `node --test bin/lib/progress-pace.test.mjs` exits 0
- the lead is notified with `notify --kind ready --pr <n>` for each pull request, and asked for the outside
  outcome's project and feature, and for S2's start

## In scope / Out of scope
- In: `docs/ROADMAP.md`; this document; `bin/lib/progress-pace.mjs`, `bin/progress.mjs` and their tests for the
  week's line; the protocols skill's source (`bin/lib/protocols-skill.mjs`) for the rule's text; the rule's
  declaration and source through `js-harness rules change`.
- Out: question 150 and every rule JH 126 holds (the brief); his projects, until he names one (the brief, item 3);
  S2's removals, which need every writer quiesced while JH 126 runs, and his answer at each removal; the other
  changes of the analysis's C2 (1.0.0 and gentle-ai #4036, S5c-b's deferral, the daily list of defaults, a tap
  counting as his), which the lead's question did not name (L2).

## Constraints
- His words are quoted as written and only what he was asked is recorded as his — because a decision of his changes
  only with his words (`rule:owner-decisions`), and the lead's question named F8 kept and the growth limit alone.
- One gate at a time (`js-harness gate`) — because JH 126 runs beside this session.
- Codex's weekly limit is read (`js-harness codex-meter`) before each run and its cost said; his reset credit is
  never spent without his word — the brief.

## Ask me before
His choice of the project and the feature for the outside outcome (through the lead, never asked here); S2's start
and each of its removals; any reading of the limit wider than what the lead asked him (L2).

## Depth pass
- 1. Method: scope control as a delivery lead runs it on a plan whose arrivals outrun its departures (Kanban's
  "stop starting, start finishing", Little's law): measure arrivals against departures over a fixed window, make the
  state visible where work is started, give an expedite class (a break of what shipped) a way past the limit, and
  keep what waits on one list instead of losing it. The smallest change that meets it: one rule in prose where large
  work starts, and one line of an existing command that computes the state. The search of `rule:reuse-first`:
  `js-harness rules` (73 rules; no rule limits growth; the roadmap's Decided row "First version's scope" holds his
  "No, sigue entrando", `docs/ROADMAP.md:75`); `progress --pace` already counts closed and added a day
  (`bin/lib/progress-pace.mjs:175`, `paceOf`), so the week's state is a sum and a comparison on it, not a new command;
  section 9 of the protocols skill (`bin/lib/protocols-skill.mjs`) is where a session reads before large work.
- 2. Raw material: his answer, typed, `js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f 48080`
  (2026-11-01T18:44:12Z); the lead's question before it, the same transcript, line 48066 ("¿adoptas el ajuste, es
  decir, seguir con F8 y poner el límite al crecimiento?", with "Mientras la semana esté en rojo, no entraría trabajo
  nuevo, salvo arreglos y pasos de F8"); the page he read, https://claude.ai/artifact/1EPj6FTbsB6C6n9aAT5iyJ, step 1
  ("Un sí cubre registrar la regla con tus palabras escritas y que el líder detenga lo nuevo mientras la semana esté
  en rojo. No frena arreglos de lo que ya funciona ni los pasos de F8. Un no deja todo como hoy."); the analysis's C2
  and E2 (`odd/tasks/replan-analysis.md`); `js-harness progress --pace` today; how a source of his words is checked,
  `bin/lib/rules-change.mjs:227-276` (typed, not tapped, not pasted, timed; a `reading` and where he `accepted` it).
- 3. The bar: excellent here means his decision recorded in his words and no wider than he was asked; the limit's
  state printed by a command so no session judges it; a rule that a session meets where it starts large work; and
  what he still decides named, not decided.
  spec 1: `js-harness progress`: exits 0 today; the record itself is none, new behaviour, proven by its two readers.
  spec 2: `js-harness rules growth-limit`: none, new behaviour (no such rule today).
  spec 3: `node --test bin/lib/progress-pace.test.mjs`: none, new behaviour (no week line today; a red and a green
  week are tested).
  spec 4: left out because it is a proposal to the lead, proven by its notice on the channel.
  spec 5: left out because S2 is its own F8 step with its own document; this feature routes it.
- 4. Refutation: if his words were not enough for `rules change`, the line would be a tap, a paste, or hold no time.
  `js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f 48080` prints "sent by the user" with its time and
  no answered option, so `quotationOf` takes it; a confirmation of the question before it is a source the register
  already holds (`codex-review-floor`, "Sí, quedan los tres números y el piso", whose reading cites the question it
  confirms). If the limit were not needed now, the last seven days would be green: `js-harness progress --pace`
  gives, 2026-10-26 to 11-01, closed 315 and added 353, so the week is red the day the rule lands.
  Verdict: supports
- 5. Request: record in the roadmap, with his words, that F8 stays the spine, that his growth limit replaces "No,
  sigue entrando", and that the outside outcome is part of the plan with its project and feature still his; record
  the limit as a rule of his, sourced from line 48080 read as a yes to the lead's question at line 48066, with the
  page's wording of what a yes covers; have `progress --pace` print the week's state; route the outside outcome and
  S2 to the lead. It changes none of his other decisions.
  Adds: none

## Specs
1. The roadmap records the adjustment: F8 kept, the growth limit, the outside outcome, quoting line 48080 (the brief,
   item 1; his words: "Listo entonces continuemos y reactives todo para hacer le plan").
2. The growth limit is a rule of his, recorded by `js-harness rules change` from his typed words (the analysis, E2
   step 1; the lead's question: "seguir con F8 y poner el límite al crecimiento").
3. A command says whether the week is red, so the limit is computed (the analysis, C2: "a week whose
   `progress --pace` shows more added than closed stops new work").
4. The outside outcome is proposed to the lead with the project and why; nothing in his projects starts without his
   choice (the brief, item 3).
5. S2 is routed as planned (the analysis, E2 step 3).

## Tasks
- [ ] T1 (kind: docs) The roadmap's record of the adjustment, and this document (spec 1). Route: inline. Commit: the
  docs PR.
- [ ] T2 (kind: verify) The double review of the rule's text and the record (`rule:double-review`): two blind
  read-only readers (spec 2). Route: two Claude sub-agents.
- [ ] T3 (kind: build) The week's line in `progress --pace`, its tests first (spec 3). Route: inline. Commit: on
  `rule/growth-limit`.
- [ ] T4 (kind: build) The rule, by `rules change`, its text in section 9 of the protocols skill (spec 2). Route:
  inline. Commit: on `rule/growth-limit`.
- [ ] T5 (kind: docs) The outside outcome and S2 proposed to the lead (specs 4, 5). Route: inline, `notify`.

## The rule, as proposed

Id `growth-limit`, his (`owner: sebastian`), in section 9 of the protocols skill (`bin/lib/protocols-skill.mjs`),
which a session reads before it starts large work; one bullet before the section's `- Cost:` line:

> - A red week holds new work (the user's growth limit, `rule:` and its id once declared): when `js-harness progress --pace` says
>   the last seven days are red, more steps added than closed, no new work opens but a fix of behaviour that shipped
>   and broke, or a step of the phase the roadmap's Next puts first; what waits is written in the roadmap's
>   `## Later`, one line each, and opens once the week is green.

Subject: "a week whose pace shows more steps added than closed takes no new work but a fix of what shipped and broke
or a step of the first phase, until it is green; what waits is written down". Phrases: "the last seven days are red,
more steps added than closed"; "no new work opens but a fix of behaviour that shipped and broke, or a step of the
phase the roadmap's Next puts first"; "what waits is written in the roadmap's". Source: words, line 48080; reading:
his answer names no limit, it confirms the lead's question at line 48066 ("seguir con F8 y poner el límite al
crecimiento"), whose message said "Mientras la semana esté en rojo, no entraría trabajo nuevo, salvo arreglos y pasos
de F8", after the page whose step 1 said what a yes covers; accepted: a message he typed to the lead, answering that
question.

The control: `progress --pace` adds a line over the last seven days of its window, `Last 7 days closed <n>  added
<m>: red` or `: green`, red when added is more than closed; `--json` gives it as `week`. Seven is the length of a
week, not a tunable, so it is a constant beside `PACE_DAYS`, not a rule's value. A window under seven days
(`--days`) prints no week line. Known limit: a feature document moved to a new path counts its open steps as added
there, as `--pace` already counts a move.

## Log
- L1 2026-11-01 13:44 local — his answer, typed (the lead's transcript `0f71b2c6`, line 48080, read with
  `js-harness sessions --quote`): "Listo entonces continuemos y reactives todo para hacer le plan". It answers the
  lead's question at line 48066: "Te pregunto, después de leer la página: ¿adoptas el ajuste, es decir, seguir con F8
  y poner el límite al crecimiento?"
- L2 2026-11-01 — what his yes covers, read by this session: the lead's question named F8 kept and the growth limit,
  and its message described the limit ("Mientras la semana esté en rojo, no entraría trabajo nuevo, salvo arreglos y
  pasos de F8"); the page's step 1 said what a yes covers and what a no means. The brief adds the outside outcome as
  part of the adjustment; its project and feature are his. The C2 changes the question did not name (1.0.0 and
  #4036, S5c-b, the daily list, a tap counting) are not recorded as his here; the "Later" list he reads once a week
  (C2) was not on the page, so the rule keeps only a place where what waits is written.
- L3 2026-11-01 — his words are enough for `rules change`: line 48080 is typed, timed and no tap
  (`bin/lib/rules-change.mjs:227-245`), and a typed confirmation of the question before it has a precedent in the
  register (`codex-review-floor`). No question to the lead is needed.
- L4 2026-11-01 — JH 128's branch (a179007a, documents only, no pull request) merged into this one, so the roadmap's
  record points at an analysis that lands with it.

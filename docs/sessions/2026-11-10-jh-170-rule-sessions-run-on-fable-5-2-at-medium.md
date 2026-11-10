# JH 170 · rule: sessions run on Fable 5.2 at medium

## Goal
Change two of his rules by his words of 2026-11-10: `session-model` to `claude-fable-5-2` and `session-effort` to
`medium`, with the tests that wrote their values by hand reading them from the rule, and say what the guard that reads
`session-effort` then refuses and allows. Opened by the brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-11-10T16-16-29-523Z-f228de56.md`.

## The user's words
"Listo entonces respecto de como viste a ese modelo quiero que de ahora en adelante el orquestador estara en Fable 5.2
Extra Altro y las sesiones en Fable 5.2 Medio cambia inclusive de una vez todas las sesiones que tengamos tanto
actualmente como las de aqui al futuro" (transcript ea85ec35-82e1-4aa9-abe3-98bd153a50b0, line 3422, read with
`js-harness sessions --quote ea85ec35-82e1-4aa9-abe3-98bd153a50b0 3422`).

## Delivered
- Pull request 812, ready, against main: https://github.com/jsaristi/js-harness/pull/812
- 3a274465 `session-model`, a session runs on Fable 5.2, with the tests reading both rules from the list.
- 098c8fe6 `session-effort`, a work session runs at medium; the README's example and the host watch's HOST line read
  the rule.
- c1a73438 `lead-effort`, new, xhigh; the guard holds a start titled `<code> ORQ · <purpose>` to it
  (`bin/lib/guard.mjs`, `sessionEffortRefusal`; `bin/lib/session-title-guard.mjs`, `leadTitle`).
- No feature document: the work was run from the brief.

## Decisions
- The lead: option A, a rule `lead-effort` at xhigh from the same quotation and the guard holding a lead's start to
  it, in the same pull request (channel note of 11:51 local, 2026-11-10, from JH ORQ).
- This session: the role of a start is read from its title alone, by the shape `session-title` already holds
  (`leadTitle`); a project whose list declares no `lead-effort` holds a lead's start to `session-effort`.
- This session: `watchLine` takes the effort and the command reads it with `ruleOf`, so `session-effort` lists
  `workshop/bin/host-watch.mjs` as a reader in `docs/RULES.md`.

## Failures and lessons
- The reading first written for `session-effort` said no command starts the lead. The independent verifier of step 4
  found it false (`bin/lib/manifest.mjs:222`, `:235`): held to `session-effort` at medium, a new lead at xhigh was
  refused. Found before the commit; fixed by `lead-effort` and its test.
- My search for hand-written values covered `bin/` and `evals/`, as the brief said, and missed `workshop/`: the gate of
  098c8fe6 failed on `workshop/bin/host-watch.test.mjs:242`, where the HOST line handed `--effort high`. Fixed test
  first in the same commit. A search for a rule's value takes the whole repository.
- The first gate of c1a73438 failed in `bin/rules-coverage.test.mjs`: the edit of the guard's line in
  `bin/lib/manifest.mjs` changed a span the coverage register holds. `js-harness rules coverage --refresh` settled it.
- `rules change` refuses a branch not based on origin/main and a tree that holds another change: main moved twice
  during the work, so the branch merged it twice (a5a27dd0, 85cace44), and each rule was committed before the next.

## Left
- The lead: merge pull request 812 after his yes, and refresh the installed copy at the land; until then it holds its
  own `high` for `session-effort` with no word (`bin/lib/rules.mjs`, `behindOf` and `guardHeld`).
- The lead: no text tells a lead which effort to start its successor at; only the guard's refusal names `lead-effort`.
- The lead: any start titled `<code> ORQ · ...` is held to the lead's level, since the role is read from the title.
- The lead: the sessions already open are changed by no code; the guard acts on a start or a resume.
- Nobody yet: `rules applied` compares the lead's sessions to `session-effort`, so a lead at xhigh shows as another
  value there (information, not a failure).

## Cost
- Time: first notice 11:36 local (waiting), ready at 12:34 local, 2026-11-10.
- Context share at the ready notice: 51%.
- Reviews: one Codex review of c2153da..c1a7343 in 2 parts, 222,922 input tokens, no finding; one run of the Claude
  lenses risk, reliability and readability, whose findings are all on files main's merges brought in.
- Sub-agents: two independent verifiers on opus, one at a time (73,002 and 90,588 tokens).
- Gates: five commit gates (two red: the host watch's test, the coverage register) and two merge gates.

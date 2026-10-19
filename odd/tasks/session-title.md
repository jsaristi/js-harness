# Session title and the next free number

Locator: `odd/tasks/session-title.md` · Engram mirror: `odd/session-title/tasks` · Branch: `feat/session-title`
Delivery: one slice, one pull request. Test runner: `node --test`.

## Goal
A session the orchestrator starts with `start_session` is titled `<code> <n> · <purpose>` with a number no other
session of the project holds, or the guard refuses the call and names the next free number.

## Why
The titles carry the role: the board, `notify --to <n>`, the openings and the roster read the number from them. The
opening flow (`notify --opening "<title>"`) gave every session he opened a numbered title, but three sessions the
orchestrator started with `start_session` got free titles, one later called itself "JH 7", a number already used,
and nothing in the code checked the title. A check holds it, so no session has to remember it.

## Done when
- `node --test bin/lib/guard.test.mjs bin/guard.test.mjs bin/lib/channel.test.mjs bin/sessions.test.mjs bin/lib/manifest.test.mjs` exits 0
- `npm run check` exits 0
- A guard test refuses "Install module for required third-party tools" and passes "JH 32 · x".

## In scope / Out of scope
- In: `bin/lib/guard.mjs`, `bin/guard.mjs`, `bin/lib/channel.mjs`, `bin/sessions.mjs`, `bin/lib/rules-data.mjs`,
  `docs/rule-sources.json`, `docs/RULES.md`, their tests, the help, README, `docs/SPEC.md`, the orchestrator skill
  (`bin/lib/manifest.mjs`), this document.
- Out: `package.json` (the orchestrator's), the onboarding and install-module work of JH 30 and JH 31, renaming
  sessions already open (done by hand).

## Constraints
- Only where the rule `session-title` is declared — because a project that installs the harness may title its
  sessions its own way, as `session-effort` and `sessions-open-in-sidebar` are read only where declared.
- The guard reads the record and the openings only to word a refusal — because it runs before every
  `start_session` and a call with a good title must cost nothing more than today.

## Ask me before
Nothing: the brief of the orchestrator carries his report; spend is one gate, one gentle-ai review and one Codex
review.

## Specs
- S1. His report (2026-10-19, verbatim): "Hay un error en las sesiones de trabajo y es que no le estas colocando el
  JH + numero no entiendo por que antes si y ahora no si esta explicito en el harness? que esta fallando y como se
  debe solucionar?" `js-harness guard --hook` denies a `mcp__ccd_session__start_session` call whose `title` is not
  `<code> <n> · <purpose>`, where the repository-scoped rule `session-title` is declared. Where it is not declared,
  nothing is refused.
- S2. The refusal names the next free number of the project: one past the highest `<code> <n>` found in the
  project's channel record and in its openings folder under the js-harness home. The same number is printed by a
  read-only command, `js-harness sessions --next-number`.
- S3. A call with only `proposal_id` passes, since it carries no title.
- S4. The help, README, `docs/SPEC.md`'s guard requirement and the orchestrator skill's lines on opening sessions say
  it.

## Tasks
- [x] T1 (S1-S4, kind: build): the rule, `sessionTitleRefusal`, `nextSessionNumber`, `sessions --next-number`, help,
  README, SPEC and skill lines. Route: inline (one understood change). RED: `bin/lib/guard.test.mjs` could not load
  (`sessionTitleRefusal` not exported); `--next-number` failed as an unknown argument. GREEN: session-title-guard 3/3,
  guard 29/29, lib/guard 33/33, channel 57/57, sessions 244/244, manifest 180/180, rules 35/35, js-harness 44/44.
  The check lives in `bin/lib/session-title-guard.mjs`, not `bin/lib/guard.mjs`: it reads the title shape from
  `bin/lib/sessions.mjs`, which costs 34 ms to load, and `bin/lib/guard.mjs` loads on every Bash call.
- [ ] T2 (kind: verify): gate, gentle-ai review, Codex review, pull request, ready notice to the orchestrator.

## Log
- L1 (2026-10-19, his words, verbatim): see S1. The brief of the orchestrator (JH ORQ) named what failed: the three
  sessions "Memory that survives the machine", "Design js-harness onboard" and "Install module for required
  third-party tools" were started with `start_session` and free titles, and renamed by hand to JH 29, JH 30, JH 31.
- L2 (2026-10-19): the rule is his (`owner: sebastian`): his report is the user's own entry at line 4992 of the
  orchestrator's transcript 908805db, checked with `js-harness sessions --quote`. On the real channel,
  `sessions --next-number` printed `JH 32` and the guard denied "Install module for required third-party tools"
  naming JH 32 and passed a `proposal_id` call. Known limit: a session that never wrote a notice, read an opening or
  was addressed is not in the channel, so its number is not seen; the title the app shows is not read, since that
  needs the transcripts, which the guard does not read on a `start_session`.
- L3 (2026-10-19): T1 committed as 50460499 (gate passed; gentle-ai 24110236..50460499 high through item 2, the
  guard, so due). Independent verifier (opus, read-only, risk item 2): S1-S4 met, the `findOpenings` refactor
  byte-identical on 8 lookups, `bin/lib/guard.mjs` loads no `sessions.mjs`. One blocker, taken: the orchestrator
  skill rotates the lead with `start_session` (`bin/lib/manifest.mjs:170`), and the guard refused `JH ORQ · lead`,
  pointing it at a work number. Fixed: any title of the agreed shape passes (`roleOfTitle`), ORQ included, and the
  skill, README, SPEC and the rule's subject say so. Advisories taken: `--next-number` exits 2, not 1, when a source
  could not be read and no code is known; the rule says it holds the shape only; a help typo; its block above the
  `--opening` comment. Left: ties between codes, a stray notice to a large number, titles with a non-breaking space.

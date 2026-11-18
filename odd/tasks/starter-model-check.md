# starter-model-check

The guard no longer refuses a `start_session` because of the model the calling session's own app record holds; the
level half of that check stays. Branch `fix/starter-model-check`; runner `node --test`, one file at a time; gate
`npm run check`. Delivery: one pull request, pushed by the session that launched this one after its reviews.

## State
T1, this document, is written; next T2, tests first. Open: the reviews (Codex and the lenses) and the push, which the
launching session runs.
Open beyond this slice: a start that names no model from a session off the home is no longer refused (depth pass,
item 4; L4).

## Goal
A `start_session` from a session whose own app record holds a model other than `rule:session-model` is not refused
for that model, while a start from one at a lower level than the start is held to is still refused, as today.

## Why
The owner set the planning session (JH PLAN) on a model of his choice, approved eight work sessions from it, and the
guard refused every start from that chat. He ordered the check removed for good (Spec 1). The level half is not part
of what he asked to remove, and keeps the cap the app's tool puts on a start's level.

## Done when
- `node --test bin/lib/guard.test.mjs` exits 0
- `node --test bin/guard.test.mjs` exits 0
- `node --test bin/lib/rules-coverage.test.mjs` exits 0
- `npm run check` exits 0
- A start from a session off `rule:session-model` at a level not under the start's passes the hook; one under it is
  refused with "a start is capped at the session that makes it" and who corrects that session.

## In scope / Out of scope
- In: the model half of `starterRefusal` (`bin/lib/guard.mjs`), the comment at its call site (`bin/guard.mjs`), their
  two tests, the planted break of the register (`bin/lib/rules-coverage-data.mjs`), the prose that repeats the
  requirement (`bin/js-harness.mjs`, `bin/lib/manifest.mjs`, `docs/SPEC.md`, `README.md`), one Log line in
  `odd/tasks/one-model-home.md`, this document.
- Out: the senior's path (`bin/lib/session-title-guard.mjs`, `bin/lib/lead-protocols.mjs`,
  `odd/tasks/senior-orchestrator.md`), which holds its own starter by its own rules; the check of the model a call
  names (`sessionStartRefusal`, `modelReason`), which he did not name; any rule's text, since no rule id owns this
  check; spec 5 of `odd/tasks/one-model-home.md`, which stays as written with a Log line beside it.

## Constraints
- The level half keeps every case and both "who corrects it" sentences — because his order names the model limit,
  and the level cap is a separate fact of the tool.
- Tests first, red before the code — because the guard is a high-risk item (`AGENTS.md`, security: guards).
- No new check for what the removal opens — because the brief asks only for the removal; the opening is reported.

## Ask me before
- Nothing beyond the brief: the reviews, the push and the merge are the launching session's and his.

## Depth pass
- 1. Method: a security engineer's, on removing one predicate from a guard. The standard: remove exactly the
  predicate the owner withdrew, keep each sibling predicate with every test case it had, keep the planted break of
  each control that stays and drop the one whose control leaves, and write down what the removal now lets through
  that nothing else refuses. Smallest change: delete the model branch of `starterRefusal` and its register entry,
  and turn its tests into "passes". Searched first: `grep -rn "capped at the session that makes it\|caps a start"`
  over the repository (hits: `bin/guard.mjs:217`, `bin/guard.test.mjs:139`, `:157`, `:185`, `:768`,
  `bin/lib/guard.mjs:135`, `:156`, `bin/lib/guard.test.mjs:206`, `bin/lib/lead-protocols.mjs:43`,
  `bin/lib/session-title-guard.mjs:109`, `:119`, `bin/js-harness.mjs:50`; the last three and `bin/guard.test.mjs:768`
  are the senior's path, out of scope), `grep -rn "starterRefusal\|sameClaudeModel(starter"`, and the rules
  register for an id that owns it (none: the check is one obligation of `rule:session-model`'s coverage bundle,
  `bin/lib/rules-coverage-data.mjs:65`, not a rule).
- 2. Raw material: the refusal he saw, quoted in L2 (transcript `f5c3ee4d-2c09-416a-addb-ea2b5e6c3e8d`, before
  line 1916); `bin/lib/guard.mjs:140-157` (`starterRefusal`, the model branch at `:146-147`, the level branch at
  `:148-149`); `bin/guard.mjs:217-229` (its only caller for a non-senior start); `bin/lib/guard.mjs:110-132` and
  `:173-178` (`sessionStartRefusal` and `modelReason`, the check of the call's own model); commit `1f28f4b9`
  (2026-11-11, PR 836), which added it under `odd/tasks/one-model-home.md` spec 5 (`:284-285`, "since the tool's own
  words cap a start at its starter"); `bin/lib/rules-coverage.mjs:220-221` (a planted break finds its text once);
  `bin/lib/roster-home.mjs:44` (the board's `OFF THE HOME` mark).
- 3. The bar:
  spec 1: `node --test bin/lib/guard.test.mjs`: today a starter whose record holds another model is refused (the
  test holds that refusal); after, it passes for a work session and for a lead, and a starter under the level is
  refused with each of the two sentences.
  spec 2: `node --test bin/guard.test.mjs`: today the hook denies a start from a session whose record holds another
  model, by the injected reader and by the reader of the app's folder; after, it passes, and the same two readers are
  proved by a record under the level, which is denied.
  spec 3: `node --test bin/lib/rules-coverage.test.mjs`: today the register holds a planted break on the model
  branch; after, it holds none for it and the level's break still finds its text once.
- 4. Refutation: could the refusal he saw come from somewhere else, such as the call's own model, so that removing
  this branch would not let JH PLAN start? Run now, read-only, on `c5e4fe3b` (the session's scratch `refute.mjs`):
  a call with a brief, the sessions' level and no `model` gives `null` from `sessionStartRefusal`; the same call from
  a starter record on the planning session's model at the top level gives, from `starterRefusal`, the exact text he
  saw (L2), and at the lowest level the same text, the model being said first. So the refusal is this branch alone,
  and what the call names is not refused. What it opens, from the same run: a call that names no model passes
  `sessionStartRefusal` (`modelReason` returns null for an absent model, `bin/lib/guard.mjs:176`), so after this
  change nothing in the guard refuses a start that names no model from a session off the home; by spec 5's own
  reading the tool then starts it on the starter's model. A call that names a model other than the home's is still
  refused. Such a session still shows on the board as `OFF THE HOME` (`bin/lib/roster-home.mjs:44`) and in
  `rules applied`. Not known: what the tool does with a call that names the home's model from a starter off it
  (whether it takes it or caps it); no run of this session can call the tool.
  Verdict: supports
- 5. Request: remove the model half of `starterRefusal` and its planted break, keep the level half and its tests
  whole, make the two hook tests that proved the reader with an off-model record prove it with an under-level one,
  and make each text that lists what the hook refuses say only the level; say in the report that a start naming no
  model from a session off the home now passes and lands on the starter's model, and add no check for it.
  Adds: none

## Specs
1. "Quita entonvcves el freno del harness, no podemos tener esa limitacion en el harness, quitalo ya y
   definitivamente" (his words, transcript `f5c3ee4d-2c09-416a-addb-ea2b5e6c3e8d` line 1916,
   2026-11-18T17:36:08Z): a `start_session` from a session whose own app record holds another model than
   `rule:session-model` is not refused for it.
2. The level half stays: a start from a session whose record holds a lower level than the one the start is held to
   (`rule:lead-effort` for a new lead, `rule:session-effort` for any other) is refused, with who corrects it (the
   user for a lead, with the line to give him; the lead for any other), in the function and in the hook, by both
   readers (the brief, 2026-11-18).
3. The register and the texts follow: the planted break of the removed branch leaves `rule:session-model`'s bundle,
   and each text that lists what the hook refuses names only the level (the brief, 2026-11-18).

## Tasks
- [ ] T1 (kind: docs) this document, before any source write: `docs(tasks)` commit.
- [ ] T2 (kind: build) specs 1 to 3: the tests changed and seen red, then the model branch removed, its register
  entry, the call site's comment and the prose; route: tests first, `npm run check`: `fix(guard)` commit.
- [ ] T3 (kind: docs) one Log line in `odd/tasks/one-model-home.md` and the ticks here: last `docs(tasks)` commit.

## Log
- L1 His request, as written (transcript `f5c3ee4d-2c09-416a-addb-ea2b5e6c3e8d` line 1916,
  2026-11-18T17:36:08Z): "Quita entonvcves el freno del harness, no podemos tener esa limitacion en el harness,
  quitalo ya y definitivamente"
- L2 What came before it, from the brief: JH PLAN, the planning session, runs on `claude-fable-5-2` by his design
  (`odd/tasks/plan-orchestrator.md`, L16). He approved eight work sessions (question 340), and the guard refused
  every `start_session` from that chat with: "js-harness guard: start_session is called from a session whose own
  record holds the model "claude-fable-5-2", not the one of the rule session-model: claude-opus-5-5, and a start is
  capped at the session that makes it. The lead sets that session's with its session tools." He asked "pero por que
  no lo puedes abrir tu si yo te autorice a ti" (same transcript, 17:3xZ), then gave the order in L1.
- L3 Evidence checked on `c5e4fe3b` (origin/main): the model branch is `bin/lib/guard.mjs:146-147`, the level branch
  `:148-149`; the caller is `bin/guard.mjs:217-229`; the planted break is the third obligation of `session-model` at
  `bin/lib/rules-coverage-data.mjs:65` (find `!sameClaudeModel(starter.model, home.model.value)`); it came with
  `1f28f4b9` (2026-11-11, "feat(guard): a start from a session off the home is refused, with who corrects it"). No
  rule id owns the check, so this is no `js-harness rules change`.
- L4 The refutation's run (depth pass, item 4), `node refute.mjs <worktree>` in the session's scratch, on
  `c5e4fe3b`, with the rules as written: a brief at the sessions' level and no `model` gives `null`; the same naming
  `claude-opus-5-5` gives `null`; naming `claude-fable-5-2` is refused by `modelReason`; a starter record on
  `claude-fable-5-2` at `max` and at `low` gives the refusal of L2 word for word. So after the change a start from
  JH PLAN that names no model passes the guard and, by spec 5's reading of the tool, runs on `claude-fable-5-2`.

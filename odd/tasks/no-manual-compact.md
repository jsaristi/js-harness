# No manual compaction

Objective: the harness stops asking anyone for a `/compact` block; a session at the context pause writes its
state and keeps working. Branch `feat/no-manual-compact` from main `11c140c`. Delivery: one PR, ask-on-risk.
Test runner: `node --test`, one file at a time outside a gate turn; `npm run check` is the gate.

## Goal
At the context pause the harness asks for the state written to the feature document (the relief file for the
lead), never for a `/compact` block handed to the user, and the orchestrator skill sends a stopped session its next
prompt.

## Why
He no longer compacts by hand, present or away: the host compacts each session by itself on a 350k window, and the
lead injects the next prompt into a session that stops (S1). The harness still told a session to hand him the cut
while he was present, and the board counted a pause as missed unless a reply held the bare `/compact` block.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/no-manual-compact.md` exits 0
- `node --test bin/lib/pause.test.mjs` exits 0
- `node --test bin/lib/sessions.test.mjs` exits 0
- `node --test bin/sessions.test.mjs` exits 0
- `node --test bin/lib/manifest.test.mjs` exits 0
- `rg -n "/compact" bin/lib/sessions.mjs bin/sessions.mjs bin/lib/pause.mjs bin/resume.mjs bin/lib/manifest.mjs docs/ROADMAP.md` finds only historical quotes and the `SessionStart:compact` hook's own name
- the board's line for a session's last automatic compaction never names `announced`

## In scope / Out of scope
- In: bin/lib/sessions.mjs, bin/lib/sessions.test.mjs, bin/sessions.mjs, bin/sessions.test.mjs, bin/lib/pause.mjs,
  bin/lib/pause.test.mjs, bin/lib/manifest.mjs, bin/lib/manifest.test.mjs, docs/ROADMAP.md, this document.
- Out: docs/FAILURES.md, docs/sweep-*.md, other odd/tasks Log entries, docs/origin.md — historical records stay as
  they are. `scripts/practice.mjs:343` runs `-p /compact` to test the `SessionStart:compact` hook in a real host:
  that is the host's compaction, not a cut handed to him, so it stays. AGENTS.md already says the rule (PR 239).

## Constraints
- No `js-harness rules change`: no rule id in `bin/lib/rules-data.mjs` holds the two-block cut (the mapping of
  2026-10-15: the cut lives only in `cutRule`, `holdsCompactBlock` and docs/ROADMAP.md); `context-pause` keeps its
  value 88 — because his words change who compacts, not the share.
- Writer sub-agents run on `claude-haiku-5-5` — because the `subagent-writer-model` rule says so and the guard
  refuses another.

## Ask me before
Nothing open: the lead relayed the task (2026-10-15, 20:11) and his words are read below (S1).

## Specs
- S1 His words, `js-harness sessions --quote e152c9d8-53bc-4366-8fa5-526b1576bcb6 4547` ("sent by the user",
  2026-10-15T22:21:13Z): "resulta que yo ahora ya no compacto manualmente incluso cuando yo este activo contigo y es
  que la sesion por si sola deberia auto compactarse por eso le bajamos el contexto a 350 mil para que se conserve
  toda la calidad y pueda seguir funcionando y lo que tu le haces es que le intectes el siguiente prompt"
- S2 The lead's task (2026-10-15, 20:11): "the pause is satisfied by the state written to the feature document
  (relief file for the lead), never by a /compact block to him". Built as: `cutRule` says the same thing whether
  he is present or away (give him nothing to send; the host compacts inside a turn; a session that stops gets its
  next prompt from the orchestrator), and the `announced` fact (a reply after the notice holding the bare
  `/compact` block) leaves `compactionMeasures`, the board's miss line, the watch and `sessions --measures`; the
  facts are `told` and `kept`.
- S3 The lead's task: "the skill tells the lead to SendMessage the next prompt to a stopped session".
- S4 The lead's task: "Done when: rg -n '/compact' over those files finds only historical quotes, the gate is
  green, and the board's pause row no longer asks for a block."

## Tasks
- [x] T1 (S2; build; delegated, Haiku writer, context backstop: the parent is near 75% of its window) `cutRule`
  one text, `personAtIn` dropped from the pause; `announced` and `holdsCompactBlock` removed from
  bin/lib/sessions.mjs and bin/sessions.mjs, tests first.
- [x] T2 (S3; docs; inline) the orchestrator skill's bullet: a stopped work session gets its next prompt by
  SendMessage from the lead, never from him; docs/ROADMAP.md's cut text.
- [ ] T3 (S4; verify) gate, gentle-ai assess, Codex; the PR for the queue.

## Log
- L1 2026-10-15, 20:11, the lead (JH ORQ), relayed: "New feature for you, from his words today in the lead's chat
  (transcript e152c9d8): [S1]. AGENTS.md already says it (PR 239, main 9773770: near 88% a session writes its state
  and keeps working, the host compacts it, a session that stops gets its next prompt from the orchestrator, a cut
  is one block). The rest of the harness still states the old two-block cut (bare /compact + resume prompt) and
  even checks for it [...] Change each to the new rule: the pause is satisfied by the state written to the feature
  document (relief file for the lead), never by a /compact block to him; the skill tells the lead to SendMessage
  the next prompt to a stopped session. Rule changes go through `js-harness rules change` with his verbatim words.
  Historical records (FAILURES.md, sweeps, Log entries) stay as they are. Feature branch, ODD document with the
  task contract, tests first through the public commands. Done when: rg -n '/compact' over those files finds only
  historical quotes, the gate is green, and the board's pause row no longer asks for a block."
- 2026-10-15, 20:16: mapped by a read-only explorer. No rule id holds the cut, so `rules change` does not apply
  (Constraints); the branch was renamed from `rule/` to `feat/`, since `rules change` allows one open `rule/`
  branch. docs/rule-sources.json, docs/RULES.md and bin/lib/rules-data.mjs hold no two-block or `/compact` text.
  The skill's line 173 ("never end a turn waiting for a message, the user's /compact or an event") already fits.
- 2026-10-15, 20:19: T2 done inline, not committed yet: the orchestrator skill gained the bullet "The user never
  compacts a session by hand, present or away: [...] A work session that stops instead gets its next prompt from
  you, by `SendMessage` to its title; never hand the user a compaction command or a resume prompt to send." and its
  line 173 now reads "Never end a turn waiting for a message or an event, whether the user is present or not";
  tests first in bin/lib/manifest.test.mjs (RED 2 of 148, then 148/148), one asserting no `/compact` in the
  orchestrator skill. docs/ROADMAP.md's cut is now "a new session, one block". T1 runs in a Haiku writer on its
  six files. Next step: check T1's diff against its surface, run its four test files, commit everything once
  (one gate), then T3.
- 2026-10-15, 20:26: T1 done. The Haiku writer stayed inside its six files: `cutRule()` takes no argument and says
  one text, "give the user nothing to send, present or away: [...] a session that stops gets its next prompt from
  the orchestrator, never from the user"; `personAtIn` left the pause; `holdsCompactBlock`, `announcedOf` and the
  `announced` fact left bin/lib/sessions.mjs and the `--measures` help. RED then GREEN, by its report: pause 45/2
  then 47/0, sessions library 284/11 then 295/0. It stopped at bin/lib/measures.mjs, outside its surface, which
  still printed `announced`; the parent changed it inline, tests first (RED 3 of 28, then 28/28), and the README's
  `--measures` paragraph. Read here once each: pause 47/47, sessions library 295/295, sessions command 231/231,
  measures 28/28, manifest 148/148. `rg -n "/compact"` over bin/lib/sessions.mjs, bin/sessions.mjs,
  bin/lib/pause.mjs, bin/resume.mjs, bin/lib/manifest.mjs, docs/ROADMAP.md and README.md finds nothing.

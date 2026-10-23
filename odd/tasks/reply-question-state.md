# Reply question state

A fifth closing state for a reply that leaves the owner an open question he answers in writing. Branch
`rule/reply-four-states`; test runner `node --test`.

## Goal
A reply that waits for the owner's written answer to an open question closes in a state that says so, and every place
that lists the closing states names five.

## Why
A reply closed in one of four states, and none said that the session waits for his written answer: a decision is asked
with the question tool's buttons, working says nothing waits on him. JH 43 closed an onboarding interview as working
while it waited for him (its finding 8, `jh36-t4-findings-5-8-proposals.md` in the lead's notes). He approved the fifth
state as proposal B (Pregunta 48, "Sí, sumalo", the lead's transcript 908805db, line 20667, 2026-10-23).

## Done when
- `node --test bin/lib/reply.test.mjs bin/reply.test.mjs bin/lib/project.test.mjs scripts/practice-lib.test.mjs` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0, AGENTS.md inside its budget
- The protocols skill, AGENTS.md, the orchestrator skill's line on the reply hook, the init template, the help texts,
  README, SPEC and the roadmap name five states.

## In scope / Out of scope
- In: the reply check and the wake check (`bin/lib/reply.mjs`, `bin/lib/stop-wake.mjs`), their tests, the texts that
  list the states, `harness.json`'s labels, `rule:reply-four-states` through `js-harness rules change`.
- Out: renaming the rule's id — an id never changes; the state D3 of the onboarding asks for is used, not redesigned.

## Constraints
- AGENTS.md holds 1,500 estimated tokens — because every line of it is paid on every turn.
- A rule's phrase changes only through `js-harness rules change` on a `rule/` branch — because the source is checked.

## Ask me before
Nothing: the state is his decision, already made; its label "Te pregunto" is the one the proposal named.

## Tasks
- [x] T1 (kind: build) The question state in the reply check and the wake check, tests first; the texts and the init
  template name five (3c642629; the decision's refusal words kept in 2bbe12bf)
- [x] T2 (kind: build) `rule:reply-four-states` says five states, through `js-harness rules change` (06c2d8e2)
- [x] T3 (kind: verify) Gate, gentle-ai assessment, Codex review, pull request, ready notice (L4-L5)

## Log
- L1 (2026-10-23) The lead's task: "Build proposal B, which Sebastián approved as Pregunta 48 ("Sí, sumalo" […]). Today a
  reply ends in one of four states: working, decision, cut, finished. Add a fifth state for a reply that leaves him an
  open question in the conversation, one he answers in writing rather than with buttons. The state must say so, so the
  session is not taken as finished or working."
- L2 (2026-10-23) Design: key `question`, English label "Question", here "Te pregunto". Like working and finished, the
  question is written on its line; like a decision, it is never asked while background work runs, since both wait on
  him, and the wake check does not warn it, since his answer wakes the session. RED observed before the code: the reply
  tests failed with the `question` key refused by `replyConfig`; the template tests failed on "four states".
- L3 (2026-10-23) The source of the change: his tapped "Sí, sumalo" cannot be a quotation (the command refuses a tapped
  answer, whose text a session wrote), so the rule keeps its typed quotations and the tap is where he accepted the
  reading. AGENTS.md went to 1,507 estimated tokens with the state; the paragraph was tightened back to 1,499.
- L4 (2026-10-23) Gate green on each commit (tests in WSL2). gentle-ai: dea129b..2bbe12b (3c642629, 06c2d8e2, 2bbe12bf)
  assessed medium, review_due false (under_budget); no review due, none started. The Stop hook then offered the whole
  branch: its read-only status was run and nothing started, as AGENTS.md asks. The differential check found that
  3c642629 had reworded the refusal of a decision asked while work runs; 2bbe12bf restores it, pinned by a test.
- L5 (2026-10-23) Codex: dea129b..2bbe12b, one part, correct at 0.94, no findings; recorded.

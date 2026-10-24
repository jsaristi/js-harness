# Instruction homes

Gives each instruction one home, and makes the others name it. Branch `rule/instruction-homes`; test runner `node --test`
(one file at a time), gate `npm run check`; delivery is one pull request per slice, pushed by the lead.

## Goal
Every instruction that the harness repeats in more than one text lives in one home, the other texts name that home by its
rule id, and the rows he decided on the launch audit (`his-rows-decisions.md`) are applied.

## Why
The launch audit found the same instruction written in AGENTS.md, the protocols skill, the orchestrator skill and the init
block, with the copies drifting apart (the reply check refused a question close the texts allowed; the closing states and
the review wording differed). Every line of AGENTS.md is paid on every turn, so a copy is cut, not kept beside its home.

## Done when
- `npm run check` exits 0, AGENTS.md inside its token budget
- `node bin/js-harness.mjs rules check` exits 0
- `node --test bin/lib/reply.test.mjs` exits 0 (N12)
- `node --test bin/lib/functions.test.mjs` and `node --test bin/lib/project-functions.test.mjs` exit 0 (N2)
- `node --test bin/lib/template-block.test.mjs` exits 0 (N48)
- A reader can find each row's home by its rule id: AGENTS.md, the protocols skill, the orchestrator skill or the init block name it

## In scope / Out of scope
- In: the reply check (`bin/lib/reply.mjs`), the per-project pushing switch (`bin/lib/functions.mjs`,
  `bin/lib/project-functions.mjs`, `harness.json`), the rule that holds the union list of his decisions (`bin/lib/rules-data.mjs`,
  through `js-harness rules change`), the texts of AGENTS.md, the protocols skill (`bin/lib/protocols-skill.mjs`), the
  orchestrator skill (`bin/lib/manifest.mjs`, `bin/lib/lead-prompt.mjs`), the init block (`bin/lib/project.mjs`) and their tests.
- Out: pushing, pull requests, gentle-ai and codex-review (the lead runs them); rows already done (N13, N14, N17-N21, N23,
  N26, N35-N37, N49-N51); the his-rows answers in `docs/rule-sources.json`, which are sources, not copies.

## Constraints
- AGENTS.md holds 1,500 estimated tokens, counted with `estimateTokens` from `bin/lib/payload.mjs` on LF text, because
  every line of it is paid on every turn of every session.
- `rules change` refuses unless the tree is clean outside the rule's home and the branch is based on origin/main.
- A rule change is refused while a feature document still names a retired id.

## Ask me before
Nothing: each row below is his answer, already given. Anything a row does not settle is asked, one question at a time.

## Specs
The rows are quoted verbatim from `his-rows-decisions.md`, lines 5-26 (the lead's notes). The standing word for the
absence is in L1.

- S1 (N1, Q57, transcript line 26097): "- N1 (Q57, line 26097): keep. AGENTS.md states the granted consent as his standing selection; consent stays his, review always runs. Wording to make it explicit."
- S2 (N2, Q58, line 26150): "- N2 (Q58, line 26150): a per-project option. js-harness keeps pushing unasked; another project asks until its owner turns it on (shipped skills and protocol 1 follow the switch)."
- S3 (N3, Q59, line 26179): "- N3 (Q59, line 26179): keep going after two gentle-ai timeouts; Codex still reviews, the skip is recorded and named in the report."
- S4 (N4, Q60, line 26209): "- N4 (Q60, line 26209): the task contract stays first, written as this project's order over gentle-ai's."
- S5 (N6, Q61, line 26248): "- N6 (Q61, line 26248): the init block says gentle-ai's assessment decides when it reviews, naming no tier."
- S6 (N7, Q62, line 26272): "- N7 (Q62, line 26272): one list in one rule, the union: spend, anything irreversible, product choices, publishing, credentials, a protocol change, a security or system setting; the other texts name the rule."
- S7 (N8, Q63, line 26331): "- N8 (Q63, line 26331): every slice with code goes through Codex, whether gentle-ai reviewed it or not (AGENTS.md wording)."
- S8 (N12, Q64, line 26404): "- N12 (Q64, line 26404): allow a question close while work runs; the reply check follows AGENTS.md (decision only)."
- S9 (N22, Q68, line 27124): "- N22 (Q68, line 27124): AGENTS.md says the opening only points to the feature document and the roadmap and holds nothing of its own."
- S10 (N33, Q70, line 27219): "- N33 (Q70, line 27219): drop the "nobody used is withdrawn" clause (protocols-skill.mjs:30); a protocol is withdrawn when he decides."
- S11 (N38, Q74, line 27790): "| N38 | Five-state close: one home in protocol 2 with the reply check; AGENTS.md names it; other copies go (Q74, 908805db line 27790) |"
- S12 (N39-N42, Q75, line 27815): "| N39-N42 | One home each: evidence and outside-work checks in protocol 6, review in protocol 3 (AGENTS.md keeps the consent grant), decide-and-go-on in protocol 1; AGENTS.md names each (Q75, 908805db line 27815) |"
- S13 (N43-N44, Q76, line 27849): "| N43-N44 | One home each: no manual compaction in the pause notice (cutRule); ask with the question tool in the orchestrator skill (rule:questions-one-place) (Q76, 908805db line 27849) |"
- S14 (N46, Q77, line 27874): "| N46 | AGENTS.md keeps its test-first line; the init block drops its copy (Q77, 908805db line 27874) |"
- S15 (N48, Q78, line 27943): "| N48 | Both texts name the protocols; a test asserts the shipped block and this AGENTS.md name the same rule ids (Q78, 908805db line 27943) |"
- S16 (N12 reply check, code): the reply check refuses only a decision that closes while background work runs; a question
  closes a reply whatever runs (`bin/lib/reply.mjs`, `bin/lib/stop-wake.mjs`, whose wake check already passes a question).
- S17 (N2 switch, code): a per-project switch for pushing unasked, declared beside the other functions; on for js-harness,
  off for another project until its owner turns it on; the shipped skills and protocol 1 follow the switch.
- S18 (N7 rule, code): one rule holds the union list of what is his to decide (spend, anything irreversible, product
  choices, publishing, credentials, a protocol change, a security or system setting); the other texts name that rule id.

## Tasks
- [x] T1 (kind: docs) This feature document, committed first (S1-S18; b6d2d40b)
- [x] T2 (kind: build) N12: the reply check refuses only a decision while work runs; RED (the question close refused while 1 task ran) then GREEN in `bin/lib/reply.test.mjs` (S8, S16)
- [ ] T3 (kind: build) N2: the per-project pushing switch, declared beside the other functions (S2, S17)
- [ ] T4 (kind: build) N7: the union list in one rule through `js-harness rules change`; `docs/RULES.md` re-rendered (S6, S18)
- [ ] T5 (kind: docs) Text rows: N1, N3, N4, N6, N8, N22, N33, N38, N39-N42, N43-N44, N46 each name one home (S1, S3-S5, S7, S9-S14)
- [ ] T6 (kind: verify) N48: a test asserts the shipped init block and AGENTS.md name the same rule ids (S15)

## Log
- L1 (2026-10-24, the owner's standing word while he sleeps, transcript 908805db line 28784, verbatim): "Sigue solo voy a dormir, responde todas las preguntas con respuestas recomendadas, pero recuerda quiero la mejor calidad, solidez, robustes, y optimizacion al mismo tiempo osea lo mejor de lo mejor."

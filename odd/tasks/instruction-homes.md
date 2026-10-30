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
- S19 (N7, Q62 again, 2026-10-30, the lead's transcript 0f71b2c6 line 28485, tapped): asked "¿Una sola lista en una
  regla, con la unión de todas?", he tapped "Una lista, la unión (Recomendada)". The lead's brief for JH 96 gives the
  union as: spend outside the plan, anything irreversible, product choices, publishing, credentials, protocol changes,
  security or system settings, anything installed or changed on a machine, a change of the plan or its order, a report
  published outside the project.
- S20 (N35, Q71, 2026-10-30, the lead's transcript 0f71b2c6 line 28610, tapped): asked whether the board should warn
  above three work sessions, he tapped "Retirarla": `work-sessions-private-windows` is retired, and the number of
  sessions is decided case by case.
- S21 (N7 and N35, Q113 and Q114, 2026-10-30, the lead's transcript 0f71b2c6, typed): line 30759, "Lo que decido yo
  es una sola lista, en una regla: gasto fuera del plan, todo lo irreversible, las decisiones de producto, publicar,
  credenciales, cambios de protocolo, ajustes de seguridad o del sistema, lo que se instale o cambie en una máquina, un
  cambio del plan o de su orden, y un informe publicado fuera del proyecto; los demás textos nombran esa regla."; line
  30812, "Retira la regla de máximo 3 sesiones de trabajo en Windows; el número de sesiones se decide caso por caso."

## Tasks
- [x] T1 (kind: docs) This feature document, committed first (S1-S18; b6d2d40b)
- [x] T2 (kind: build) N12: the reply check refuses only a decision while work runs; RED (the question close refused while 1 task ran) then GREEN in `bin/lib/reply.test.mjs` (S8, S16)
- [x] T3 (kind: build) N2: the per-project pushing switch `pushUnasked`, declared beside the other functions; RED in `functions`, `project-functions`, `functions` CLI and protocol 1 / orchestrator texts, GREEN after; js-harness declares it on (S2, S17)
- [x] T4 (kind: build) N7: the union list in one rule, `owner-decisions`, through `js-harness rules change`; `docs/RULES.md` re-rendered (S6, S18, S19, S21; L14; 665baea7, branch `rule/his-decisions`)
- [ ] T7 (kind: build) N35: retire `work-sessions-private-windows` with no successor through `js-harness rules change` (S20, S21). His typed words exist (line 30812); it runs on branch `rule/retire-work-sessions-windows` once `rule/his-decisions` has landed, since one rule change is open at a time (L14)
- [~] T5 (kind: docs) Text rows (S1, S3-S5, S7, S9-S14). Done: N33 (efef30d0); N6, N46, N38, N39-N42 in the init block (protocols 6 and 1 are pointed at, not restated); N1, N8, N38 in AGENTS.md; protocol 3 names every slice through Codex; N3 already held by protocol 3 (`operation_timeout`); N4, N22 (L6); N43 (L7, the orchestrator copy kept); N44 (L8). The owner list: T4 (protocol 1 holds it; CLAUDE.md, protocol 7, the init block and the permit relay name it). Open: the orchestrator copy of the pause sentence in `bin/lib/manifest.mjs` (L7) needs the owner's typed words for `announce-finished` or the lead's decision
- [x] T6 (kind: verify) N48: a test asserts the shipped init block and AGENTS.md name the same rule ids (S15); RED then GREEN in `bin/lib/template-block.test.mjs`; the block names `rule:context-pause` and `rule:questions-one-place`, and so does AGENTS.md (L9)
- [ ] T8 (kind: docs) The control of `command-handed-untested` (L15): a command handed to him that writes his configuration is run first against a scratch configuration and its read-back shown. Owed; the lead routes its text
- [ ] T9 (kind: docs) The control of `written-question-buried` (L15): a question he answers in writing goes alone in its message, with its text ready to copy, never at the end of a report. Owed; the lead routes its text

## Draft for T4 and T7
Written on 2026-10-30 by JH 96, before his typed words exist, so that each change is one command and one commit once
they do. Nothing here is in force.

**T4, the rule `his-decisions`** (owner `sebastian`, a rule in prose, one phrase an item):
- Home: `js-harness-protocols` section 1 (`bin/lib/protocols-skill.mjs`), because the skill ships to every host and
  project and section 1 is where a session asks. Its first bullet becomes: "- Ask only what is the user's
  (\`rule:his-decisions\`): spend outside the plan, anything irreversible, a product choice, anything published, any
  credential, a change of a protocol, a security or system setting, anything installed or changed on a machine, a
  change of the plan or of its order, and a report published outside the project. A project's \`CLAUDE.md\` may add
  to it. Decide everything else, say what it costs, and go on."
- Subject: "what is the owner's to decide, asked one at a time; everything else is decided and its cost said".
- Phrases (each at least twelve characters, so "publishing" and "credentials" are worded "anything published" and
  "any credential"): "spend outside the plan", "anything irreversible", "a product choice", "anything published",
  "any credential", "a change of a protocol", "a security or system setting", "anything installed or changed on a
  machine", "a change of the plan or of its order", "a report published outside the project".
- The texts that name it instead of repeating it, in the same commit:
  - `bin/lib/protocols-skill.mjs:113` (section 7): "- The user's decisions are \`rule:his-decisions\`, asked one at
    a time (section 1). The lead assigns everything else."
  - `bin/lib/project.mjs` `claudeBlock` (the init block): "The owner decides what \`rule:his-decisions\` lists
    (\`js-harness-protocols\` section 1). Ask those one at a time, never while work runs, naming which it is, as
    \`rule:questions-one-place\` says." The pinned assertions in `bin/lib/project.test.mjs` move to it, and
    `bin/lib/template-block.test.mjs` then needs AGENTS.md or the test's own list to agree on the new id (S15).
  - `bin/lib/manifest.mjs:139` (the permit relay): "A card that touches what is the user's (\`rule:his-decisions\`),
    or is important enough to be their call, you never decide alone"; `bin/lib/manifest.test.mjs` moves with it.
  - `CLAUDE.md:27`, his file, inside his answer: "He decides what \`rule:his-decisions\` lists. Everything else, keep
    moving: ...", inside `rule:claude-md-budget`.
- Source: his typed sentence (L13) as the quotation, line 28485 as where he accepted the union.

**T7, the retirement of `work-sessions-private-windows`**: `{"retire":{"successors":[]}}`, with his typed sentence as
the quotation. Its id stays; `docs/RULES.md` shows it under Retired with no successor. Two texts still name it and are
read when it runs: `docs/proposals/harness-diet.md:461` and `:1050` (a proposal: named, not in force), and the retired
`work-sessions`, whose successors list keeps it as history.

**Not in this draft, N17** (the lead's note of 2026-10-30): "never ask him to look at the Codex meter" and "say it
before he leaves" live only in `memory/codex-meter-is-readable.md`; `rule:announce-finished` holds only "the Codex
meter, read at that moment". His typed words of 2026-10-11 ("recuerda siempre decirme lo del uso de codex", session
130317af) are cited by the note; whether they are a quotable line was not checked. It is the lead's to route.

## Log
- L1 (2026-10-24, the owner's standing word while he sleeps, transcript 908805db line 28784, verbatim): "Sigue solo voy a dormir, responde todas las preguntas con respuestas recomendadas, pero recuerda quiero la mejor calidad, solidez, robustes, y optimizacion al mismo tiempo osea lo mejor de lo mejor."
- L2 (2026-10-24): N12 committed (80f55915), N2 (ddbc69e4), N33 (efef30d0). The N2 switch is `pushUnasked` (auto asks, on, off); js-harness declares it on. Merged origin/main (f266761b) into the branch first, as `rules change` requires.
- L3 (2026-10-24): N7 is blocked on its source, not on the rule. The brief's source is his tapped answer to Q62 (line 26272). `rules change --dry-run` refuses it: "line 26272 of 908805db-... is a tapped answer: the option's text was written by a session, not typed by him". A quotation must be his typed words. Recommended answer: he types the union once in the session, then the rule takes that line as its quotation and line 26272 as its acceptance. Until then the owner list in AGENTS.md, the init block and protocol 1 keep their wording.
- L4 (2026-10-24): N48 needs one design answer before its test can be written. A test that compares the rule ids of the init block and AGENTS.md passes today only because the block names none, while AGENTS names `rule:context-pause`. Recommended answer: the block names `rule:context-pause` where it describes the pause, so both name the same ids, and the test fails when either drops one.
- L5 (2026-10-24, the lead's answer): N7 is deferred to him. Recorded as waiting for his typed list; the owner list in AGENTS.md, the init block and protocol 1 keep their wording; no `rules change` is attempted for it.
- L6 (2026-10-24, the lead's answer, recommended options): N22 is folded into the handoff sentence of AGENTS.md ("a new session's opening prompt only points to them"), no new paragraph (59872e94). N4 is one clause there: the task contract comes first as this project's order over gentle-ai's (59872e94).
- L7 (2026-10-24, the lead's answer): N43. The one home of "he never compacts by hand" is the pause notice, `cutRule` in `bin/lib/sessions.mjs` (6d05e253); AGENTS.md names that notice and the context-pause rule. The orchestrator copy at `bin/lib/manifest.mjs:208` stays: the `announce-finished` rule holds its phrase "The user never compacts a session by hand, present or away" at that path, and removing it fails `rules check`. Trimming it needs the owner's typed words for `rules change announce-finished`, or the lead's decision.
- L8 (2026-10-24, the lead's answer): N44. The one home of "ask with the question tool" is the orchestrator paragraph (`rule:questions-one-place`, `bin/lib/manifest.mjs`); AGENTS.md and the init block name `rule:questions-one-place` (fad79815). The first attempt failed the gate on a project test that pinned the old owner sentence; that assertion now pins the new one.
- L9 (2026-10-24, the lead's answer, RED first): N48. RED in `bin/lib/template-block.test.mjs`: block named [], AGENTS named ["context-pause"] (actual: [], expected: ["context-pause"]). GREEN after the block names `rule:context-pause` where it describes the pause (48bbeb87); the test pins that both texts name the same rule ids.
- L10 (2026-10-24, the lead's answer): N39-N42. The init block's evidence line points to `js-harness-protocols` section 6 and its decide-and-go-on line to section 1, instead of restating them; the two `project.test.mjs` assertions that pinned the old wording now pin the pointers. `node --test` GREEN for `template-block.test.mjs` (6 pass) and `project.test.mjs` (157 pass, 6 skipped as before: symlink and platform guards).
- L11 (2026-10-24): the efef30d0 message and content mismatch is left as it is; 8b525bce records it; no history rewritten (the lead's answer).
- L12 (2026-10-24) gentle-ai: the rule/instruction-homes commits b6d2d40b..d3219d1f (f266761b..d3219d1f) assessed medium, not due (under_budget), by `gentle-ai review assess --base-ref f266761b --committed-only`; Codex: correct (0.9), recorded. N43's orchestrator copy (bin/lib/manifest.mjs:208) stays: it is the declared phrase of rule:announce-finished (the lead's answer). N7 waits for his typed list (L5).
- L13 (2026-10-30, JH 96): his answers to Q62 and Q71 are tapped (the lead's transcript 0f71b2c6, lines 28485 and
  28610, read with `js-harness sessions --quote`: "answer (tapped): Retirarla"). `js-harness rules change
  work-sessions-private-windows --dry-run` with line 28610 as the quotation exits 1: "not changed: line 28610 of
  0f71b2c6-cbce-43ca-a031-276a4b2c381f is a tapped answer: the option's text was written by a session, not typed by
  him". Q62's line is tapped the same way, so T4 was not run either. By the lead's note (05:41 local), the two changes
  are drafted above and a waiting notice gives the lead the sentence he must type for each:
  - T4: "Lo que decido yo es una sola lista, en una regla: gasto fuera del plan, todo lo irreversible, las decisiones
    de producto, publicar, credenciales, cambios de protocolo, ajustes de seguridad o del sistema, lo que se instale o
    cambie en una máquina, un cambio del plan o de su orden, y un informe publicado fuera del proyecto; los demás
    textos nombran esa regla."
  - T7: "Retira la regla de máximo 3 sesiones de trabajo en Windows; el número de sesiones se decide caso por caso."
- L14 (2026-10-30, JH 98): he typed both sentences (S21). T4 ran with line 30759 as the quotation and line 28485 as
  where he chose the union. The id is `owner-decisions`, not the draft's `his-decisions`: the id is written into the
  skills every project installs, and the shipped orchestrator text is held to never say "his"
  (`bin/lib/manifest.test.mjs:3079`), which the draft's id failed. Beside the draft: protocol 7's line keeps its
  "The user's decisions: " head, which `bin/lib/protocols-skill.test.mjs:112` pins; the init block's hash moved on
  purpose (`bin/lib/template-block.test.mjs`); `bin/lib/project.mjs`'s line ceiling went down to 1989; the coverage
  register ties the rule to protocol 1. `rules change` keeps one rule change open at a time across every `rule/`
  branch (`bin/lib/rules-change-run.mjs`, "one change is open at a time"), so T7 runs on its own branch once
  `rule/his-decisions` has landed.
- L15 (2026-10-30, JH 98): two `- Seen:` lines owed from the lead's relief file go to `docs/FAILURES.md`, each a new
  entry whose control is owed by an open task here (T8, T9); which text carries each is the lead's to route.
- L16 (2026-10-30, JH 98) gentle-ai: 035e3250..e5454da4 (665baea7, e5454da4) assessed medium, not due (under_budget),
  by `gentle-ai review assess --base-ref 035e3250 --committed-only`; the Stop hook's candidate was the branch from
  a2b801fb, the merge of main in it, so its status was read and nothing started. Codex: correct (0.93), no findings;
  the Claude lenses readability and reliability: 0 findings; both recorded.

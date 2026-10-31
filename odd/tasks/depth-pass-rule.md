# JH 124 · rule 1: the depth pass at the head of CLAUDE.md

Locator: `odd/tasks/depth-pass-rule.md` · Engram mirror: `odd/depth-pass-rule/tasks` · Branch: `worktree-depth-pass-rule`
(the rule's own commit on a `rule/` branch) · Delivery: one pull request to main · Test runner: `node --test`

## Goal
The harness's first rule, a depth pass before large work is built, stands at the head of the root `CLAUDE.md` as his
reviewed and approved text, is declared in `js-harness rules`, and `check` refuses a feature document that reaches its
first code commit without it.

## Why
On 2026-10-31 he asked for "un pilar fundamental como primera regla de nuestro arnes" (L1), gave his pre-prompt as its
text (L3) and accepted the lead's improved version (L4). The day's evidence: PR 737 (JH 122) was built, reviewed and
closed by his answer to question 142 because it caught none of the six sightings that motivated it. Its own document
read those six sightings (`odd/tasks/estimate-as-fact.md` on `origin/worktree-estimate-as-fact`, L3) and recorded
"the new reading alone would have caught none of the six", in the same commit as the first code (41f774d8), and the
work went on to two reviews and a verifier. What failed was not only reading the raw material: it was that the
proof's answer, read from that material, did not reach him before the code.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/depth-pass-rule.md` exits 0
- `node bin/js-harness.mjs rules depth-pass` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `node --test bin/lib/contract.test.mjs bin/check.test.mjs` exits 0
- `npm run check` exits 0
- the pull request is merged into main, named in `## Log`, with Codex and the Claude lenses recorded over its code

## In scope / Out of scope
- In: the root `CLAUDE.md`'s head; the rule's declaration (`bin/lib/rules-data.mjs`, `docs/RULES.md`, through
  `js-harness rules change`); the `check` control and its test; the `CLAUDE.md` block `init` and `sync` write for a
  project (`claudeBlock`, `bin/lib/project.mjs`) if the rule ships there (T6); this document; `docs/sessions/`.
- Out: removing `CLAUDE.md`'s `@AGENTS.md` import, which changes his Principle 5 (`docs/ROADMAP.md`, line 25, his D3
  of 2026-10-26), a separate question for later; the stop guard, `docs/FAILURES.md` and
  `odd/tasks/lead-duty-checks.md` (JH 123 works on them); his `~/.claude`, `~/.codex`, credentials and gentle-ai's
  config.

## Constraints
- Nothing of the rule is built before his yes to its reviewed text — because the rule changes how he works
  (`rule:owner-decisions`, a change of a protocol) and passes `rule:double-review` first.
- The rule's text is his words' need, not a rewrite that replaces them — because `rule:wording-is-the-need` and the
  Log's L1 keep his words as written.
- `CLAUDE.md` stays within `rule:claude-md-budget` or the budget changes in the open — because it is paid on every
  turn; measured with `estimateTokens` (`bin/lib/payload.mjs`), never assumed.
- Run only the tests the change needs before the gate — because the machine is short of memory.

## Ask me before
The rule's text, trigger and control, and the way it fits the budget: one question through the lead, after the
double review. Nothing of the rule is built before that yes.

## Depth pass
This feature's own pass, as the draft rule asks:
1. Discipline: writing an operating rule for an agent that is checked by a machine, the work of a process engineer
   who writes a standard and its audit together. Their first move: the incidents the rule is for, and whether the
   check would have caught them.
2. Raw material: his four messages as written (L1 to L4); PR 737's document and its L3 and L10, read on its branch;
   the root `CLAUDE.md` and `AGENTS.md`; the rules `claude-md-budget`, `double-review`, `owner-decisions`,
   `wording-is-the-need`, `reuse-first`, `rules-live-in-the-harness`; protocols section 1; how `check` validates a
   contract (`checkContracts`, `bin/check.mjs:73`; `REQUIRED_SECTIONS`, `bin/lib/contract.mjs:34`); gentle-ai 4.3.1's
   ODD protocol, steps 2 and 3, and its research lifecycle (read only).
3. Methods: measure the budget with the project's estimator; plant a document without the section and see the
   control turn red before it turns green; two blind readers on the text before it reaches him.
4. Proof: the Done when commands; the control's planted break; the readers' findings recorded in L5 onward. What the
   material already says: the control reads only that the section is there and complete, never whether the pass was
   deep, so the depth itself stays on the readers and on him (S4, unguaranteed).
5. His request rewritten, beside his words (L1 to L4): "Make the depth pass the harness's first rule, at the head of
   `CLAUDE.md`, for large work and whenever I ask; give it a check that refuses a feature document without it before
   its first code commit; review its text twice before I approve it; and tell me what it costs per turn."

## Specs
1. "Quiero que de ahora en adelante cambiemos un pilar fundamental como primera regla de nuestro arnes que sea como la
   1 regla en la filosofia del arnes si? dime si lo podemos inmplementar como la regla numero 1 sobre la que siempre
   se va a basar el modelo" (L1).
2. "vamos a utilizar Claude.md unicamente para todo nuestro arnes y para los modelos y Codex vamos a utilizar el
   Agent.md y el solo funciona como revisor" (L2).
3. His pre-prompt as the rule's source (L3, quoted whole there).
4. "hagamos la mejora de lo de Claude.md como me lo dijiste y ademas me gustaria que adoptaramos la idea mejorada de
   lo que te acabo de dar ya que como este arnes va ligado a la forma de trabajar y es copiada del gentle-ai por ahi
   derecho alineamos conceptos y filosofias para que todo quede top y con una mejora real que te parece? o quieres
   darle una segunda revisada para mejorarlo aun mas?" (L4).

## Draft for review (not approved; nothing is built from it before his yes)

The text at the head of the root `CLAUDE.md`, above "How sessions run":

> ## Rule 1: a depth pass, not a size pass (`rule:` + `depth-pass` once declared; split here so `rules check`
> does not read a rule that is not declared yet)
>
> Before large work is built (the resume test of "How sessions run"), and whenever he asks, its
> feature document holds a depth pass, before its first code commit: (1) the discipline that masters
> the task and what its best practitioner would do; (2) the raw material they would start from (the
> code, real data, the records, primary sources), never his summary; (3) their methods and tools;
> (4) the proof that shows the result without resting on him or on Claude (commands that exit 0, an
> independent review, a measurement) and what that material already says of it; (5) his request
> rewritten to ask for exactly that, beside his words, never replacing them, for his yes. When the
> material says the proof cannot be met, he hears it before any code.

Trigger: large work by the resume test already in `CLAUDE.md`, and whenever he asks; never every message.

Control: `check`'s `contracts` row fails when the branch adds a feature document that is a contract (`odd/tasks/`,
against the merge base with the trunk) without a `## Depth pass` section of five numbered items, while the branch
holds a path that is no document (`harness.json` `documents`). The 152 contracts on main are not retrofitted, as
`docs/ROADMAP.md` ("Task contract") already decided for closed documents; the rule's `since` day bounds it.

Its declaration: a prose rule `depth-pass`, owner `sebastian`, path `CLAUDE.md`, phrases from the text, source his
words of 2026-10-31 (L1, L3, L4).

Budget, measured with `estimateTokens` on 2026-10-31: the root `CLAUDE.md` is 3158 estimated tokens of 3200; the
draft above, with the blank line after it, is 202 (807 characters, measured the same way). It does not fit as is:
the file would be about 3360, some 160 over.

## Tasks
- [ ] T1 (kind: design) specs 1-4: the raw material read and the draft written (this document). Route: inline.
- [ ] T2 (kind: verify) specs 1-4: `rule:double-review` on the draft, after the lead's readers' findings on the brief
      (L5). Route: two read-only readers.
- [ ] T3 (kind: docs) specs 1-4: the question notice to the lead with the reviewed text, what the readers changed and
      the cost. Route: inline.
- [ ] T4 (kind: build) after his yes: the rule through `js-harness rules change depth-pass` on a `rule/` branch, his
      words quoted with their date, and the text at the head of `CLAUDE.md`.
- [ ] T5 (kind: build) after his yes: the `check` control, its test first, a planted break that turns it red.
- [ ] T6 (kind: build) after his yes: the rule in the `CLAUDE.md` block `init` and `sync` write (`claudeBlock`), if
      the reviewed text says it ships to projects.
- [ ] T7 (kind: verify) Codex, the Claude lenses and an independent verifier over each code slice; PR; ready notice.

## Log
- L1 (2026-10-31T11:55:49Z, his words, the lead's transcript `0f71b2c6`, line 42804, read with
  `js-harness sessions --quote`): "Quiero que de ahora en adelante cambiemos un pilar fundamental como primera regla
  de nuestro arnes que sea como la 1 regla en la filosofia del arnes si? dime si lo podemos inmplementar como la regla
  numero 1 sobre la que siempre se va a basar el modelo"
- L2 (2026-10-31T11:57:36Z, line 42824): "Pero ya habiamos quedado que como este proyecto se va a basar unicamente en
  Claude sobretodo en los modelos de Anthropic con Claude Desktop en la parte de Claude Code entonces vamos a utilizar
  Claude.md unicamente para todo nuestro arnes y para los modelos y Codex vamos a utilizar el Agent.md y el solo
  funciona como revisor"
- L3 (2026-10-31T12:00:59Z, line 42859): "si pero necesito que me digas que te parece esto como pre prompt para que
  siempre pase procesado por aqui mira: Quiero una version mas profunda de esta tarea, no una mas grande. Antes de
  reescribirla dime que haría un profesional top de lo que te estoy pidiendo, dime el material mas crudo desde el que
  el partiria en vez de el digerido que yo tendría, dime los metodos y herramientas especificas que el profesional top
  usaría, que demostraría a parte de ti y de mi que el resultado quedaria top y supremamente excelente y ademas
  completo, y por ultimo reescribe mi prompt por completo para pedir exactamente todo esto."
- L4 (2026-10-31T12:04:03Z, line 42878, after the lead's reply that put the five steps, the trigger on large work and
  the `check` control, and asked whether the rule applies to large work only): "Listo entonces hagamos la mejora de lo
  de Claude.md como me lo dijiste y ademas me gustaria que adoptaramos la idea mejorada de lo que te acabo de dar ya
  que como este arnes va ligado a la forma de trabajar y es copiada del gentle-ai por ahi derecho alineamos conceptos
  y filosofias para que todo quede top y con una mejora real que te parece? o quieres darle una segunda revisada para
  mejorarlo aun mas?"
- L5 (2026-10-31, the search and the raw material, T1):
  - The rules: `claude-md-budget` is owned by the project, not by him (`js-harness rules claude-md-budget`: owner
    `project`, 3200 estimated tokens), so raising it is decided here with its cost said, though the per-turn cost goes
    to him in the question. `wording-is-the-need` (path `bin/lib/project.mjs`) already says his wording is the need and
    the agent says what it would do differently: the depth pass's step 5 is its form for large work, not a second rule.
    `reuse-first` already asks for the search before adding; `double-review` for the two readers.
  - The budget, measured with `estimateTokens` (`bin/lib/payload.mjs:10`, characters / 4) on the LF text: root
    `CLAUDE.md` 3158 of 3200; `AGENTS.md` 972 of 1500 (`agents-budget`).
  - Where a contract is checked: `checkContracts` (`bin/check.mjs:73`) runs `validateContract` over
    `discoverContracts` (`bin/contract.mjs:102`); the required sections are `REQUIRED_SECTIONS`
    (`bin/lib/contract.mjs:34`: Goal, Why, Done when, In scope / Out of scope, Constraints, Ask me before). Nothing
    checks Specs, Tasks or Log, nor their order. 152 of the 159 `odd/tasks/*.md` on this branch are contracts.
  - A prose rule's path may be any repository path (`textFaults`, `bin/lib/rules.mjs:143`); no rule has `CLAUDE.md`
    as its path yet (13 `manifest.mjs`, 7 `protocols-skill.mjs`, 1 `project.mjs`).
  - Projects: `init` writes a `CLAUDE.md` from `claudeBlock()` (`bin/lib/project.mjs:397`), and `sync` renders it
    again while the project has not edited it. The root `CLAUDE.md` of this repo is not that block. His words of
    2026-10-26 ("recuerda que todo este mismo trabajo es como va a trabajar el arnes en los proyectos", `docs/ROADMAP.md`,
    Direction) say the projects work the same way, so T6 is likely; one text in two files would need a test that
    holds them equal, or the rule names one home.
  - gentle-ai 4.3.1 (`gentle-ai --version`), read only in `~/.claude/CLAUDE.md`, "ODD protocol" steps 2 and 3 and
    "Organic Driven Development", and `~/.claude/skills/_shared/research-lifecycle.md`: its nearest equivalents are
    "Explore the existing code and requirements first, proportionately to the request", "prefer primary sources",
    "distinguish verified facts, assumptions, contradictions, freshness, and gaps", "Validate consequential premises
    against available evidence before building", and "Adapt depth to uncertainty and consequence, not a fixed
    questionnaire or mandatory rounds". The depth pass takes the first four (raw material = primary sources; the proof
    = a consequential premise validated before building) and departs from the last on purpose: five fixed items, but
    only for large work, where his evidence says the free form let PR 737 through.
  - PR 737 (`gh pr view 737`; its document on `origin/worktree-estimate-as-fact`): the six sightings were read (its
    L3), the answer was "none of the six", and that answer was recorded in the same commit as the first code
    (41f774d8, 2026-10-31 04:07). The brief's "a pass from the raw sightings would have shown that before any code" is
    true of the answer, not of the order: the material was read, and the answer did not stop the code nor reach him.
    Hence the draft's last sentence ("When the material says the proof cannot be met, he hears it before any code").
  - The lead's message of 2026-10-31 (cross-session): two blind readers of the lead's are attacking the brief; this
    session sends no question notice and starts no double review of its own until their findings arrive.

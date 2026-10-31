# JH 124 · rule 1: the depth pass at the head of CLAUDE.md

Locator: `odd/tasks/depth-pass-rule.md` · Engram mirror: `odd/depth-pass-rule/tasks` · Branch: `worktree-depth-pass-rule`
(the rule's own commit on a `rule/` branch) · Delivery: one pull request to main · Test runner: `node --test`

## Goal
The harness's first rule, a depth pass before large work is built, is his reviewed and approved text in a home that
ships to every project, is named in one line at the head of the root `CLAUDE.md` and of the `CLAUDE.md` `init` writes,
is declared in `js-harness rules` with its control in `rules coverage`, and `check` refuses a new feature document
whose pass is missing or cites no raw material, names no prediction a Done-when command runs, or gives no verdict.

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
- In: the rule's text in `bin/lib/protocols-skill.mjs` (a new section 9); a one-line pointer after the import in the
  root `CLAUDE.md` and at the head of `claudeBlock` (`bin/lib/project.mjs`); a line in `wording-is-the-need`'s
  paragraph pointing to it; the rule's declaration (`bin/lib/rules-data.mjs`, `docs/RULES.md`, through
  `js-harness rules change`); the control in `bin/lib/contract.mjs` and the `contracts` row, its test, its legacy
  list and its entry in `bin/lib/rules-coverage-data.mjs`; this document; `docs/sessions/`.
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
Two questions through the lead, one at a time, after the double review: (a) the rule's reviewed text and its scope
(large work and when he asks, or every task-like prompt through a hook); (b) whether it sits under Principle 7 or
replaces it. Nothing of the rule is built before his yes to (a). The behavioural eval is not run unasked: it is
recorded owed with a date unless he asks for it (spend outside the plan).

## Depth pass
This feature's own pass, in the draft's form (v2, below):
1. Discipline: writing an operating rule for an agent together with the machine check that audits it, the work of a
   process engineer. Their first move: the incidents the rule is for, and whether the check would have caught them.
2. Raw material: his four messages as written (L1 to L4); PR 737's own document on `origin/worktree-estimate-as-fact`,
   its L3 and L10, and its first code commit 41f774d8; `bin/lib/claude-import.mjs:33`; `bin/lib/project.mjs:397`;
   `bin/lib/contract.mjs:34`; `bin/check.mjs:73`; `bin/lib/citations.mjs:7`; `bin/lib/rules-coverage-data.mjs:415`;
   `evals/rule-proof.mjs:1`; `docs/ROADMAP.md:27`; gentle-ai 4.3.1's ODD protocol, steps 2 and 3 (read only).
3. Methods: measure the budget with the project's estimator; replay PR 737's document as of 41f774d8 against the
   control and see it refused; plant a break and see the control turn red before green; two blind readers on the text
   before it reaches him.
4. Prediction: `node --test bin/lib/contract.test.mjs` refuses PR 737's document as it stood at 41f774d8 (it had no
   pass) and a pass with a refuting verdict on a branch with code and no recorded answer, and accepts this document.
   What the material already says: the control reads form, never depth; a writer can still write a hollow pass that
   passes it. Depth stays on the readers and on him (unguaranteed).
5. His request rewritten, beside his words (L1 to L4): "Make the depth pass the harness's first rule, named at the
   head of every `CLAUDE.md` the harness writes, for large work and whenever I ask; give it a check that refuses a
   new feature document whose pass cites no raw material, names no prediction a command runs or gives no verdict;
   when the material refutes my request, ask me before any code; review its text twice before I approve it; and tell
   me what it costs per turn."

Verdict: supports. The material holds a home for the text, a pointer that fits the budget and a static control; it
does not hold a way to check depth itself, which the question says.

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

## Draft v2 for review (not approved; nothing is built from it before his yes)

v1 (commit 89c04507) put the whole text at the head of the root `CLAUDE.md`. v2 follows the lead's readers (L6):
the text lives once, in a home that ships, and each `CLAUDE.md` names it in one line.

**The pointer**, after the import's blank line in the root `CLAUDE.md`, above "How sessions run", and at the head of
`claudeBlock` (with "the owner" for "he"); the id is written split here, since `rules check` refuses a rule named
before it is declared:

> Rule 1: large work, and any task he asks it for, starts with a depth pass (`rule:` `depth-pass`,
> `js-harness-protocols` section 9).

**The text**, section 9 of `js-harness-protocols` (`bin/lib/protocols-skill.mjs`), which `install` writes to every
machine, so this repo and every project read the same words:

> ## 9. Before building large work: the depth pass
>
> Incident (2026-10-31): a pull request was built, reviewed twice and verified, then closed by the user's answer:
> its own feature document had read the six real cases that motivated it, found it caught none of them, and that
> answer reached neither the plan nor the user before the code.
>
> - Before large work is built (the resume test of the project's `CLAUDE.md`), and whenever the user asks for one,
>   its feature document holds a `## Depth pass` before its first code commit. A small task and a short reply get
>   none. It is the large-work form of `rule:wording-is-the-need`: the need, read from what is real.
> - Deeper, not bigger: the pass grounds the work the user asked for and adds none; whatever it would add is named
>   as added and proposed apart. In this order: the five items first, the rewritten request last, and nothing is
>   rewritten or built before the analysis is written.
> - 1. Discipline: the discipline that masters the task, and what its best practitioner would do first.
> - 2. Raw material: what they would start from (the code, real data, the records, primary sources), never the
>   user's summary, each cited by `path:line`, a commit or a URL.
> - 3. Methods: their concrete methods and tools.
> - 4. Prediction: the proof that shows the result is excellent and complete without resting on the user or the
>   session, as a prediction a Done-when command can fail ("catches k of n real cases"), an independent review or a
>   measurement; complete means every part of the request has its proof, and a part left out is named. Then what
>   the raw material already says of it.
> - 5. Request: the user's request rewritten whole to ask for exactly that, beside their words in the Log, never in
>   place of them, and asking for no work theirs did not.
> - It ends in `Verdict: supports` or `Verdict: refutes`. A refuting verdict reaches the user as a question before
>   any code (`rule:owner-decisions`, a change of the plan), and the pass records the answer's number. A supporting
>   one is recorded and the work goes on: the rewritten request is asked only when it changes something
>   `rule:owner-decisions` lists.
> - Five questions: it happened once at the cost of a pull request with its two reviews and a verifier; the
>   `contracts` row of `check` holds its form; no rule did this (`rule:wording-is-the-need` answers a proposal, not
>   a plan's proof); it costs one section written per large feature and this section read when one starts.
> - Cost: this section, read only when large work starts. Reviewed by 2026-11-30.

**The amended paragraph**, `wording-is-the-need` in `claudeBlock`, one clause added at its end: "for large work,
the depth pass (`rule:` `depth-pass`) is its form."

**Trigger**: large work by the resume test, and whenever he asks; never every message. A hook on every task-like
prompt is the other option, his to choose (question a).

**Control**, in `validateContract` (`bin/lib/contract.mjs`) and so the `contracts` row: a contract that is not on
the legacy list (the 159 `odd/tasks/*.md` of main on the day it lands, shrinking only) fails when its
`## Depth pass` is missing; when any of the five numbered items is missing; when item 2 holds no code span that is a
citation (`bin/lib/citations.mjs`'s `path:line` or commit forms); when item 4 names no Done-when command of the same
document in a code span; or when no line reads `Verdict: supports` or `Verdict: refutes`. A refuting verdict with no
`question <n>` in the pass fails only while the branch holds a path that is no document (`harness.json`
`documents`), so the document can be committed while the question waits. Its `rules coverage` entry is level
`check`, with its test and a planted break.

**Declaration**: a prose rule `depth-pass`, owner `sebastian`, path `bin/lib/protocols-skill.mjs`, phrases from
section 9, source his words of 2026-10-31 (L1, L3, L4) and his answer to question (a).

**Eval**: a case from PR 737's brief and its six sightings, on both arms (`evals/rule-proof.mjs`), would be the
behavioural proof. The two proofs on record cost $2.00 and $4.43 and scored the same on both arms
(`evals/proofs/rules/rule-reuse-first.json`, `rule-away-autonomy.json`): it may not tell the rule apart either.
Recorded owed, reviewed by 2026-11-30, unless he asks for it.

**Budget**: the pointer is about 30 estimated tokens (some 125 characters); the root `CLAUDE.md` would go from 3158
to about 3190 of 3200, measured on the final text before it is committed. Per turn in this repo: those 30. In a
project: the pointer and the clause, about 45 more in its `CLAUDE.md`. Section 9 costs nothing per turn; it loads
when large work starts.

## Tasks
- [x] T1 (kind: design) specs 1-4: the raw material read and the draft written (this document). Route: inline.
      89c04507 (v1); v2 in this commit.
- [ ] T2 (kind: verify) specs 1-4: `rule:double-review` on draft v2, after the lead's readers' findings (L6). Route:
      two read-only readers.
- [ ] T3 (kind: docs) specs 1-4: questions (a) and (b) to the lead, one at a time, each with the reviewed text, what
      the readers changed and the cost. Route: inline.
- [ ] T4 (kind: build) after his yes to (a): the rule through `js-harness rules change depth-pass` on a `rule/` branch,
      his words quoted with their date; section 9, the pointer in the root `CLAUDE.md` and in `claudeBlock`, the
      clause in `wording-is-the-need`.
- [ ] T5 (kind: build) after his yes to (a): the control, its test first with PR 737's document replayed and a
      planted break that turns it red, its legacy list, its `rules coverage` entry; rebased on JH 123 and the coverage
      data regenerated.
- [ ] T6 (kind: verify) Codex, the Claude lenses and an independent verifier over each code slice; PR; ready notice.

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
- L6 (2026-10-31, the lead's two blind readers on the brief, reader A and reader B, relayed and checked by the lead):
  (1) projects get `claudeBlock()`, not this repo's root `CLAUDE.md`, and `bin/lib/claude-import.mjs` keeps
  `@AGENTS.md` as its first line: the text lives in a home that ships and each `CLAUDE.md` holds a one-line pointer;
  `claude-md-budget` is the project's, not his (the brief was wrong). (2) Amend, do not add (`rule:reuse-first`):
  `wording-is-the-need` covers step 5, the task contract and `rule:double-review` cover step 4, and Principle 7
  (`docs/ROADMAP.md:27`) holds his 2026-10-18 words calling working to the objective "la filosofia principal del
  harnes"; the depth pass is its operational form unless he says it replaces Principle 7. (3) The control checks
  more than a heading: cited raw material, a falsifiable prediction a Done-when command runs, a verdict; a refuting
  verdict reaches him before code; a legacy list for the existing documents; `CLAUDE.md` is a covered source
  (`bin/lib/rules-coverage-data.mjs:415`), so the rule needs its control in `rules coverage`; the behavioural proof
  is an eval case from PR 737's brief (`evals/rule-proof.mjs`), paid, so asked or owed with a date. (4) His approval
  of the rewritten request is asked only when it changes something `rule:owner-decisions` lists (`rule:away-autonomy`
  forbids questions while he is away). (5) Two decisions are his and unasked (the brief recorded the first as
  accepted; he never answered it): scope (large work only, or every task-like prompt through a hook that skips taps
  and short replies) and whether it sits under Principle 7 or replaces it. (6) JH 123 touches
  `rules-coverage-data.mjs` and the manifest and lands first: rebase on it and regenerate the coverage data. Both
  readers agree with L5 on PR 737.
- L7 (2026-10-31, L6 checked here before building on it): `withImport` (`bin/lib/claude-import.mjs:35`) writes the
  import first; `CLAUDE.md` has a list in `bin/lib/rules-coverage-data.mjs:415`; `bin/lib/citations.mjs` and
  `evals/rule-proof.mjs` exist; `away-autonomy` is declared (`js-harness rules away-autonomy`). The two proofs on
  record cost $2.00 and $4.43 and scored the same on both arms. A search of his earlier words on the subject (grep
  "profund|material crudo|profesional top|a la perfeccion" over `bin/lib/rules-data.mjs`, `docs/` and `odd/tasks/`)
  found Principle 7 (2026-10-18) and his audit request of 2026-10-23 ("quiero que me hagas una auditoria que
  realmente nos diga en profundida todo y esto que te dije es de ejemplo dime enrealidad como la debemos hacer",
  `odd/tasks/launch-audit.md`, S1). Decided: the text's home is section 9 of `js-harness-protocols`, not
  `claudeBlock`, because the skill is written to every machine by `install`, so this repo and every project read the
  same words, while `claudeBlock` reaches only projects' `CLAUDE.md` and is paid on every turn there; the pointer
  carries "Rule 1" at the head of both `CLAUDE.md` files. `docs/FAILURES.md` has no class for a plan whose own
  evidence refuted it (its headings read): once, PR 737.
- L8 (2026-10-31, the lead, from him): he asked whether the improved pre-prompt itself was double-reviewed; it was
  not. The readers compare the final text phrase by phrase with his original (L3) and say what each phrase became or
  why it was dropped; the lead already sees two losses, "completo" and his order ("antes de reescribirla dime...",
  the analysis first, the rewrite last), and asks that "una version mas profunda de esta tarea, no una mas grande"
  survive as a test. Draft v2 now carries all three: "Deeper, not bigger" with its order, and "excellent and
  complete" in item 4. The question to him holds the comparison table.

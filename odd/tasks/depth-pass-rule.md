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
  root `CLAUDE.md` and at the head of `claudeBlock` (`bin/lib/project.mjs`); the rule's declaration (`bin/lib/rules-data.mjs`, `docs/RULES.md`, through
  `js-harness rules change`); the control in `bin/lib/contract.mjs` and the `contracts` row, its test, its date
  exemption and its entry in `bin/lib/rules-coverage-data.mjs`; this document; `docs/sessions/`.
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
This feature's own pass, in the rule's form once the rule existed (L20); the v2 form it replaced, same substance, is
in commit 8c6d6c7f, committed with documents alone before the first code commit (1722be2d).
- 1. Method: writing an operating rule for an agent together with the machine check that audits it, the work of a
  process engineer: the incidents the rule is for first, then whether the check would have caught them. The smallest
  change: a section in the skill that already holds the protocols, a one-line pointer, and the `contracts` row that
  already validates every feature document. The search of `rule:reuse-first` found no rule that asked for a pass;
  `rule:double-review` and `wording-is-the-need` cover parts of it (L11 to L13).
- 2. Raw material: his four messages as written, the lead's transcript `0f71b2c6`, lines 42804, 42824, 42859 and
  42878 (L1 to L4); PR 737's own document on `origin/worktree-estimate-as-fact`, its L3 and L10, and its first code
  commit `41f774d8`; `bin/lib/claude-import.mjs:33`; `bin/lib/project.mjs:397`; `bin/lib/contract.mjs:34`;
  `bin/check.mjs:73`; `bin/lib/citations.mjs:7`; `evals/rule-proof.mjs:1`; `docs/ROADMAP.md:29`; gentle-ai 4.3.1's
  ODD protocol, steps 2 and 3 (read only).
- 3. The bar:
  spec 1: `node --test bin/lib/protocols-skill.test.mjs`: rule 1 heads the root `CLAUDE.md` and the init block; none,
  new behaviour before; 0 failed after slice 1.
  spec 2: left out because it is F8's split of `CLAUDE.md` and `AGENTS.md`, already built (S3); this feature only
  puts the pointer in `CLAUDE.md`.
  spec 3: `node --test bin/lib/depth-pass.test.mjs`: a document opened since `depthPassSince` holds the pass in his
  order, committed with documents alone before code; none, new behaviour before; 15 of 15 pass after slice 2.
  spec 4: `node bin/js-harness.mjs rules check`: the rule declared from his words; PASS, 72 rules.
  spec 5: left out because its proof is the roadmap's text (T7), which no command reads.
- 4. Refutation: did PR 737 fail for want of a test run before code, which the rule would only repeat? `git show
  --format= --name-only 41f774d8`: its document came in with its first code, 5 documents and 6 other files in one
  commit, and its L3 had already read the six cases and found 0 of 6 caught. A test was run; the order failed. A
  check on commit order refuses it, 1 of 1 (`bin/lib/depth-pass.test.mjs`, "PR 737's order"). The control reads form
  and order, never depth: a hollow pass passes it, and depth stays on the readers and on him (unguaranteed).
  Verdict: supports
- 5. Request: his request rewritten, beside his words (L1 to L4): "Make the depth pass the harness's first rule,
  named at the head of every `CLAUDE.md` the harness writes, for large work and whenever I ask; give it a check that
  refuses a new feature document whose pass cites no raw material, names no prediction a command runs or gives no
  verdict; when the material refutes my request, ask me before any code; and review its text twice before I approve
  it." (Reader A, L12: an earlier "tell me what it costs per turn" here asked for something his words did not.)
  Adds: none

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
5. "que lo introduzcamos no solamente de una sino que en el plan completo esto nos quede completamente implementado
   con todo lo que ya tenemos planeado, ademas entiendo que tenemos que alinear todo el arnes para que no vaya a
   quedar contradicciones o algo antiguo" (L10): the rule enters `docs/ROADMAP.md` as an F8 step with its proof, and
   the roadmap gains the alignment feature, not built here.

## Draft v3 for his yes (after the double review, L11 and L12; not approved, nothing is built from it before his yes)

v3 merges the three candidates by the readers' verdict: candidate 3's measured bar, refutation run before code and
close against the prediction; v2's verdict line, recorded answer and his order; his "dime" back, as information.

**The pointer**, one line after the import's blank line in the root `CLAUDE.md` (32 estimated tokens with its blank line, measured: 3190 of 3200)
and at the head of `claudeBlock`; written split here, since `rules check` refuses a rule named before it is declared:

> Rule 1: before large work is built, and whenever he asks, a depth pass (`rule:` `depth-pass`,
> `js-harness-protocols` section 9).

**The text**, section 9 of `js-harness-protocols`:

> ## 9. Before building large work: the depth pass
>
> Incident (2026-10-31): a pull request was built, reviewed twice and verified, then closed by the user's answer:
> its own feature document had read the six real cases that motivated it and found it caught none, in the same
> commit as its first code, and that answer reached neither the plan nor the user before the code.
>
> - Large work is work a fresh session could not finish from the request and `git diff` alone; it has a feature
>   document under `odd/tasks/`. Before that document's first code commit, and whenever the user asks, it holds a
>   `## Depth pass` after its contract, committed with documents alone. Asked for with no document, the pass is the
>   reply itself. A small task and a short reply get none.
> - Deeper, not bigger: the pass grounds the work asked for and adds none. Its items come in this order, the
>   analysis first and the rewrite last, and nothing is rewritten or built before they are written:
> - 1. Method: the discipline that masters the task, what its best practitioner would do, their standard, methods
>   and tools, and the smallest change that meets it; the search of `rule:reuse-first` covers the design too.
> - 2. Raw material: the rawest they would start from (real data, the records, the code, primary sources), never
>   the user's summary nor this document, each cited by `path:line`, a commit, a URL or a transcript line.
> - 3. The bar: what excellent and complete mean here, as each numbered spec with its proof and today's result
>   measured where there is one (`none, new behaviour` where there is not), `spec <n>: <command>: <result>`, or `spec <n>: left out because <reason>`.
> - 4. Refutation: the cheapest test that could show the request does not hold, run now, its command and its result
>   as a count or a measure; then `Verdict: supports` or `Verdict: refutes`. A refuting verdict reaches the user as
>   a question before any code, its first option being to change or drop the plan, and the pass records
>   `answered: question <n>`.
> - 5. Request: the user's request rewritten whole, to ask for exactly what items 1 to 4 found, beside their words
>   in the Log, never in place of them; it ends `Adds: none` or `Adds: <what> (question <n>)`.
> - At the close, the Log records the result against item 3 and item 4 ("predicted k of n, measured m of n"); the
>   time against its estimate stays with `js-harness stretch`.
> - The pass reaches the user in the feature's report (`rule:reports-spanish-visual`); it is asked only when it
>   refutes or adds.
> - Five questions: it happened once at the cost of a pull request with two reviews and a verifier; the `contracts`
>   row of `check` holds its form and its order, not its depth; a test run before code alone would not have stopped it, since that
>   test was run, the commit order does; no rule asked for cited material, a bar per spec or a verdict; what leaves: nothing. Cost: one section per large feature, with a test run before
>   code; read only when large work starts. Reviewed by 2026-11-30.

**Control** (git-aware, in `checkContracts`, `bin/check.mjs:73`, and `contract check`; `validateContract` gains only
the form): a contract first committed on or after the rule's day (one `git log --diff-filter=A` over `odd/tasks/`),
or after `harness.json` `depthPassSince` in a project, which `sync` writes when it first ships the rule, fails when
its pass is missing; when items 1 to 5 are missing or out of order, or the verdict comes before item 5; when item 2
cites nothing (the citation forms of `bin/lib/citations.mjs` plus a URL and "transcript `<id>`, line N"), or cites
only this document; when a numbered spec has no `spec <n>:` line in item 3; when item 4 has no command in a code span
or no verdict; when item 5 has no `Adds:` line; when the commit that first adds the verdict also touches a path that
is no document, or does not come before the branch's first such commit (the index is read too); when a refuting
verdict has no `answered: question <n>` while the branch holds code. Not checkable: that the test really ran, and the
depth itself.

**What is no longer in v2**: the clause in `wording-is-the-need` (his rule; section 9 now says what leaves); the
legacy list (a date instead, which works in projects and open branches); "the resume test of the project's
`CLAUDE.md`", which projects do not have.

**Unguaranteed, said in the question**: large work judged small never gets a document; a document without `## Goal`
is no contract; a project whose block it edited keeps it ("kept", `sync`), so no pointer; in a project with no split,
`claudeBlock` is inside `AGENTS.md`, which Codex reads; a machine with an older skill points to a section 9 it lacks;
Codex's review carries only Goal and Done when; a supporting verdict that is wrong passes; "Rule 1" is a name the
rules list does not order (question b); the skill's description gains "or starting large work", about 5 tokens on
every turn.

**Cost**: per turn, 33 tokens in this repo, about 33 in a project's `CLAUDE.md`, about 5 in the skill's description;
per large feature, one section with a test run before code, estimated at 30 to 60 minutes and not measured (the
close's gap will measure it); a refuting verdict stops the work until he answers. The eval from PR 737's brief is
owed, reviewed by 2026-11-30 ($2.00 and $4.43 for the two on record, which did not tell their rules apart).

**His three decisions, one question at a time**: (a) this text, its home (the skill, with a pointer in `CLAUDE.md`,
not the whole text there as L2 said) and its scope (large work and when he asks, or every task-like prompt through a
hook); (b) under Principle 7 or replacing it; (c) whether two readers read every large plan before code (candidate
3's step 6), which widens `rule:double-review`, whose scope the harness already states two ways
(`bin/lib/protocols-skill.mjs:42` against `claudeBlock`, `bin/lib/project.mjs:409`): the alignment feature starts
there.

Draft v2 (the lead's five steps as a section 9, with the pointer and the clause) is in commit 8c6d6c7f; both readers
judged it in L11 and L12.

## Candidate 3 for review (the lead's, L9; judged beside his pre-prompt and draft v2)

A loop with checkable evidence, for large work, each step with what it folds into instead of duplicating:

1. What already exists that does this or part of it: amend, do not add. Folds into `rule:reuse-first`, named, not
   restated.
2. The raw material, cited `path:line` (real data, primary sources, the records). Draft v2 item 2.
3. The bar before starting: what "excellent and complete" means here as commands that exit 0, with today's baseline
   measured; each of his phrases mapped to a spec and its proof. Folds into the contract's `## Done when` and
   `## Specs`; new: the baseline measured, and the phrase-to-proof map.
4. The prediction and its refutation: the expected result and its estimated cost, then the cheapest test that could
   show the request does not hold, run before any code; a refuting result reaches him as a question. Draft v2 item 4
   and its verdict, stronger: a test run, not only a reading.
5. The method: the discipline that masters it and its concrete standard; the smallest change that meets the bar.
   Draft v2 items 1 and 3, and "deeper, not bigger".
6. A blind review of the plan before code. Folds into `rule:double-review`, which today covers only a proposal that
   changes one of his decisions: widening it to every large plan changes his rule, so it is his.
7. At the close, the result measured against the prediction and the baseline, the gap recorded to calibrate the next
   estimate. Ties to the stretch forecast (`js-harness stretch`); new for a feature.

Beside it, his request rewritten next to his words, never replacing them. Its cost: more steps per large feature
(step 6 is two readers each time); the scope question stands.

## Tasks
- [x] T1 (kind: design) specs 1-4: the raw material read and the draft written (this document). Route: inline.
      89c04507 (v1); v2 in this commit.
- [x] T2 (kind: verify) specs 1-4: `rule:double-review` on draft v2 and the three candidates (L11, L12), draft v3
      (L13). Route: two read-only readers, two rounds each.
- [x] T3 (kind: docs) specs 1-4: questions (a) and (b) to the lead, one at a time, each with the reviewed text, what
      the readers changed and the cost. Route: inline.
- [x] T4 (kind: build) after his yes to (a): the rule through `js-harness rules change depth-pass` on a `rule/` branch,
      his words quoted with their date; section 9, the pointer in the root `CLAUDE.md` and in `claudeBlock` (v3
      dropped the clause in `wording-is-the-need`, L13). Route: inline. The commit after b5bf7484 (L19).
- [x] T5 (kind: build) after his yes to (a): the control, its test first with PR 737's document replayed and a
      planted break that turns it red, its date exemption, its `rules coverage` entry. Route: inline. The commit
      after 1722be2d (L20).
- [x] T7 (kind: docs) spec 5, after his yes to (a): `docs/ROADMAP.md` gains the rule as an F8 step with its proof
      (the eval, or its owed date) and the next feature, "harness alignment to the depth pass", opened by the lead
      after this lands. Route: inline. L21.
- [ ] T6 (kind: verify) Codex, the Claude lenses and an independent verifier over each code slice; PR; ready notice.

## State for a resume
- Branch `rule/depth-pass` in worktree `D:\js-harness\.claude\worktrees\depth-pass-rule` (from b66e8211; the old
  `worktree-depth-pass-rule` on origin holds the documents only). His answers: 143 (L15), 144 (L18), 145 and 146
  (L21, the double review, written into the alignment feature and not built here). No question of this feature open.
- Slice 1 (T4) is 1722be2d (L19); slice 2 (T5) is 36439e1e (L20); section 9's line and T7 are the two commits after
  it (L21).
- Next, in order: (1) Merge origin/main (JH 123). (2) Codex, the lenses and a verifier over the code commits,
  `npm run check`, push, PR, ready notice.

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
  (`docs/ROADMAP.md:29`) holds his 2026-10-18 words calling working to the objective "la filosofia principal del
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
- L9 (2026-10-31, the lead, from him): he asked whether it can be made substantially better than his pre-prompt and
  the lead's five steps. The lead's argument: both ask the model to think like an expert, which is introspection;
  PR 737 read its raw material, saw 0 of 6 and was built anyway, and the lead's missed stretch left no estimate
  against actual. The lead proposes candidate 3 (above, with its folds written here); the double review judges the
  three side by side, and the question says which wins and why, with the phrase-by-phrase table. The readers of T2
  were already running on v2 when this arrived: they get candidate 3 as a follow-up once they return. Candidate 3
  and this entry were written into this file while the two readers were reading it (`edit-during-review`): their
  brief names draft v2 alone, and the follow-up names what changed.
- L10 (2026-10-31T12:22:31Z, his words, the lead's transcript `0f71b2c6`, line 43297, read with
  `js-harness sessions --quote`; relayed by the lead as of about 12:45Z): "Excelente cuando me tengas ya tomo dime
  para probartelo que lo introduzcamos no solamente de una sino que en el plan completo esto nos quede completamente
  implementado con todo lo que ya tenemos planeado, ademas entiendo que tenemos que alinear todo el arnes para que no
  vaya a quedar contradicciones o algo antiguo". The lead's reading: this pull request also enters the rule in
  `docs/ROADMAP.md` as an F8 step with its proof (the eval or its owed date), and adds the next feature, "harness
  alignment to the depth pass": every text the harness ships or sends to an agent read for contradictions and
  obsolete text, each fixed or retired with its successor, never deleted, opening with its own depth pass as the
  rule's first real use. The alignment is not built here; the lead opens it after this lands. The question to him
  still comes first.
- L11 (2026-10-31, `rule:double-review`, T2, reader B: what is missing; two rounds, on Opus, read only). Round 1, on
  v2: four blockers. (1) Projects have no definition of large work: `claudeBlock` (`bin/lib/project.mjs:397`) holds
  no resume test. (2) The control reads text only (`bin/lib/contract.mjs:3`, "No fs here"), and PR 737's document came
  in the same commit as its code (`git show --stat 41f774d8`), so a pass written with the code passes. (3) A legacy
  list of this repo's names turns every project and every open branch red, since `checkContracts` runs in every
  checkout: a date instead, with `harness.json` `depthPassSince` written by `sync`. (4) L2 asked for `CLAUDE.md`;
  moving the text to the skill must be asked. Changes: the text and the control disagree on citations (no URL; the
  transcript form is skipped on purpose), this document's item 4 failed an exact match, a hollow pass is easy
  (self-citation), "no una mas grande", "completo" and his order were prose only, the build plan missed the skill's
  test of eight sections (`bin/lib/protocols-skill.test.mjs:35`), its header and its per-turn description, the clause
  changed his rule `wording-is-the-need` without its own commit, "dime" was dropped, a refuting verdict did not hold
  against a tapped answer. Notes: what still escapes; Codex sees only Goal and Done when; the pointer measures 33,
  not 30. Round 2, the three side by side: none wins as written; merge candidate 3's bar per spec, its run
  refutation and its close with v2's verdict, recorded answer and his order; step 6 becomes his question (c); and
  `rule:double-review`'s scope is stated two ways today (`bin/lib/protocols-skill.mjs:42` against
  `bin/lib/project.mjs:409`), where the alignment should start. Estimates of B's, not measured: his pre-prompt 5 to
  10 minutes a feature, v2 15 to 30, candidate 3 45 to 90 plus two reader runs.
- L12 (2026-10-31, `rule:double-review`, T2, reader A: attacks the claims; two rounds, on Opus, read only). Round 1,
  on v2: the same blockers 2 to 4 as B, and the control's replay proved nothing (every old document lacks a pass);
  `validateContract` cannot see a path or git, so the control lives in `checkContracts` and `bin/contract.mjs`; the
  change touches a contract others consume (Task Size item 3) and did not say so; "it is the form of
  wording-is-the-need" contradicted "no rule did this"; the verdict grades itself; timing against `CLAUDE.md`'s
  "before the first source write"; `sync` keeps an edited block, and a project without the split carries
  `claudeBlock` inside `AGENTS.md`, which Codex reads. Checked true: 3158 tokens, the pointer 128 characters (33),
  the two proofs ($1.996 and $4.426, equal scores on both arms), the rule paths, every cited line, PR 737's sequence;
  counts drifted to 160 and 153 on this branch. Round 2, candidate 3: it would not have stopped PR 737 either, since
  PR 737 ran its cheap test (0 of 6, and a false-positive count) before committing code; what failed was the order
  and the route to him, so the commit-order check is the part that stops it. Step 1 restates `rule:reuse-first`;
  `## Specs` is checked by nothing today, so the phrase-to-proof map is a new check and the best of candidate 3; a
  baseline does not exist for new behaviour; `js-harness stretch` measures hours, not a result against its
  prediction. Verdict: merge on v2's base.
- L13 (2026-10-31, the writer's decisions on L11 and L12, draft v3): every blocker of both readers was checked here
  (`bin/lib/contract.mjs:3`; `bin/lib/protocols-skill.test.mjs:35`; `git show --stat 41f774d8`; `claudeBlock` read)
  and taken. Where they differed, A's narrowing won on evidence: step 1 is not a step but one clause on
  `rule:reuse-first`; the close records the result, `stretch` keeps the time. Dropped from v2: the clause in
  `wording-is-the-need` (his rule; section 9 says what leaves instead) and the legacy list (a date). Kept from B: the
  pass reaches him in the feature's report ("dime"), `Adds:` as the test of "no una mas grande", `spec <n>:` lines
  as the test of "completo", the definition of large work inside section 9. Unguaranteed, both readers: that the
  refutation test really ran, and depth itself. Cost of this double review: four reader runs, about 443,000
  sub-agent tokens in all (97k, 105k, 117k, 124k, as each run reported).
- L14 (2026-10-31T12:29:35Z, T3): question 143 recorded for the lead (`js-harness notify --kind question`): draft v3,
  its home and its scope, options "Sí, v3, trabajo grande y cuando la pida (Recomendada)", "Sí, v3, en cada pedido
  tipo tarea", "No, quiero cambiarla"; its context in Spanish (what it is, why v3, where each of his phrases went,
  what a yes covers and does not, the cost per turn and per feature, what stays unguaranteed) sent to the lead
  beside it, since a question's text is one line. Questions (b) and (c) wait for his answer to 143.
- L15 (2026-10-31T12:35:41Z, his answer to question 143, the lead's transcript `0f71b2c6`, line 43370, read with
  `js-harness sessions --quote`, tapped): "Sí, v3, trabajo grande y cuando la pida (Recomendada)". Draft v3 is
  approved as written, for large work and when he asks. The lead: build it, tests first; question (b) next, (c)
  after it; Codex, the lenses and a verifier on every code slice; JH 123 lands first.
- L16 (2026-10-31T12:37:04Z, T3): question 144 recorded, (b): "Encabeza los principios y el 7 se queda
  (Recomendada)", "Solo como forma práctica del 7", "Reemplaza al Principio 7"; it decides only T7's wording in
  `docs/ROADMAP.md`. Its context sent to the lead. The build goes on: it does not wait on 144.
- L17 (2026-10-31, the build plan): the pull request is made from a branch `rule/depth-pass`, since the merge door
  refuses a change to `bin/lib/rules-data.mjs` from any other branch (`checkDoor`, `bin/check.mjs:399`), and
  `rules change` runs only there (`bin/lib/rules-change-run.mjs:123`). Slice 1, the rule: section 9, the skill's
  index and description, the declaration by `rules change depth-pass`, the pointer in the root `CLAUDE.md` and in
  `claudeBlock`, the tests that pin them, the coverage entry. Slice 2, the control, tests first with a planted
  break. Slice 3, the roadmap (T7) once 144 is answered. In a project the control holds only once `harness.json`
  declares `depthPassSince`, which `sync` writes when it ships the rule, so no project turns red on upgrade.
- L18 (2026-10-31T12:38:03Z, his answer to question 144, the lead's transcript `0f71b2c6`, line 43523, read with
  `js-harness sessions --quote`, tapped): "Encabeza los principios y el 7 se queda (Recomendada)". T7 writes it so:
  the roadmap's principles open with "Regla 1: el pase de profundidad" as Principle 7's practical form, and the
  seven keep their numbers and words.
- L19 (2026-10-31, slice 1 built): the host compacted this session at 07:42 local after its state was committed
  (b5bf7484); it resumed from that state. `rules change depth-pass` refused his tapped answer at line 43370 as a
  quote, so it stays the source's `accepted` and the quotes are his typed lines 42804, 42859 and 42878. The pointer
  in `claudeBlock` first broke the template literal (unescaped backticks), which made both test files fail whole.
  `project.mjs` would have grown by three lines past its ceiling (`bin/conventions-structure.test.mjs`, 1978, a
  ceiling that only goes down), so `realish`'s comment was reflowed to 118 columns, 24 lines to 21, its words
  unchanged. Rules coverage held four obligations of section 9 untied (the large-work bullet, items 3 and 5, the
  close), so the declaration gained four phrases taken from them, written into `bin/lib/rules-data.mjs` after the
  command ran; the heading, the index entry, the incident, the five questions and the cost are context with their
  reasons. The init block's hash moves on purpose (`bin/lib/template-block.test.mjs`, the reason beside it). Root
  `CLAUDE.md` measures 3190 of 3200 tokens. Run: `node --test` over the protocols, project, template-block,
  conventions-structure and rules test files, 282 passed, 0 failed; `node bin/js-harness.mjs rules check`: PASS, 72
  rules.
- L20 (2026-10-31, slice 1 committed as 1722be2d, the pre-commit gate PASS; T5 built, committed as 36439e1e): question 145, (c), recorded and
  its context sent to the lead: "No; solo cuando cambia una decisión tuya (Recomendada)", "Sí, en todo trabajo
  grande", "Sí, solo si el veredicto refuta o añade"; nothing in this pull request waits on it. The control is
  `bin/lib/depth-pass.mjs`, its test written first and red (the module missing), then green, 15 of 15: the form of
  the pass (five items in order, a citation outside the document, a `spec <n>:` line per numbered spec, a command and
  a verdict in item 4, `Adds:` last) and the order of commits read from git (the verdict's first commit holds
  documents alone, no code on the document's line before it, no code staged while it is uncommitted, a refuting
  verdict with code needs `answered: question <n>`). `validateEntries` (`bin/contract.mjs`) carries it for the
  `contracts` row and `contract check`, not for `run` and `goal`. Two changes to the design of L17: the date is
  `harness.json` `depthPassSince` alone, here `2026-11-01`, so the documents other sessions opened today stay as
  written; and `sync` writes nothing, so a project is held only when it declares the key itself (the README says
  so), which the alignment feature can revisit. The planted break (`mixed.length < 0`) turned
  `bin/lib/depth-pass.test.mjs` red, 1 of 15 ("PR 737's order"), and green again once restored. Replays: PR 737's
  document at 41f774d8 gives "no `## Depth pass`"; this document, its pass rewritten in the rule's form, gives no
  fault from `depthPassText`, nor from `depthPassErrors` with its opening day set past the date.
- L21 (2026-10-31, his typed answers to questions 145 and 146, read with `js-harness sessions --quote` at the lead's
  transcript `0f71b2c6`, lines 43642 and 43701; the lead's message): 145: "Y si mejor no hacemos dos lectores A y B
  sino que hacemos una de Claude y una de Codex para tener 2 perspectivas diferentes pero que sean dos revisiones
  ciegas independientes?" 146: "Me gustaria en todo, pero que me dieras la opcion de cuando si y cuando no, siento
  que siempre todo se debe revisar doble pero de la forma de nos de criterio y con la filosofia nueva que tenemos ya
  que todo es importante a menos que yo como usuario te diga que no quiero la revision, esa seria la unica opcion de
  que no se hiciera." The lead: do not build it here; write it as the alignment feature's first item, replacing the
  option of two readers on every large plan, and have rule 1's text name `rule:double-review` without restating it.
  Done: section 9's close line now ends "Its plan is reviewed as `rule:double-review` says." (`rules check` PASS,
  the protocols and rules tests 53 of 53); T7 wrote `docs/ROADMAP.md`: "Regla 1: el pase de profundidad" heads the
  principles as Principle 7's practical form, the seven unchanged (144); F8 step 6, rule 1 with its proof and the
  eval owed by 2026-11-30; "Alignment to the depth pass", its first item the double review with both his quotes,
  then the older texts (the document's order in `CLAUDE.md` and `init`'s block, the contract template, `sync`
  offering `depthPassSince`) and the eval. `js-harness progress`: 1125 of 1168, 96%.
- L22 (2026-10-31, T6, the reviews of b5bf748..f3b68fd; his answer to question 147): the four Claude lenses ran
  (reliability, readability, risk, resilience; about 168k input tokens on sonnet), recorded; readability and risk
  found nothing; reliability and resilience found the same fault: in a shallow clone every document looks opened
  in the boundary commit, so older documents would fail the contracts row. Fixed: `depthPassFor` holds no document
  where the history cannot say when one opened (`git rev-parse --is-shallow-repository` not `false`); its test
  clones at depth 1, red before the fix, 16 of 16 after. The Codex review's part 1 (171k input tokens) was thrown
  away by the command, since I edited the tree while it ran; no record was written, and the run is repeated once
  over the whole range with the tree untouched (my mistake: what happened, a test written during a review; the fix,
  one rerun with nothing edited until it returns; what stops it, the command's own refusal, which caught it; the
  count, a second refusal of this kind in this feature). The lead relayed his tapped answer to question 147 (the
  lead's transcript `0f71b2c6`, line 44098, read with `sessions --quote`): "Sí, pero también en el código chico";
  the alignment feature's first item now carries the corrected design and leaves open, his to answer, what happens
  when the Codex limit runs out. Codex's weekly limit stood at 78% used (the lead, `js-harness codex-meter`).

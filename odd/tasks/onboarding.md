# Onboarding: the pre-plan and the plan of a new project, with the AI

Locator: `odd/tasks/onboarding.md` · Engram mirror: `odd/onboarding/tasks` · Branch: `feat/onboarding`
Delivery: two slices stacked to `main`, after his yes to the design. Test runner: `node --test`.
Design version 3: version 1 after its two readers and a second round on the blockers (see `## Reviews`).

## Goal
After `js-harness init`, a session in the new project runs `js-harness onboard` and, through a short interview with
the owner, writes a reviewed and approved pre-plan (`docs/origin.md`) and roadmap (`docs/ROADMAP.md`) that
`js-harness progress` reads and every later session starts from.

## Why
His words (2026-10-19): "una funcionalidad de onboarding para que cuando instalemos el harnes en un proyecto hagamos
todo el pre plan y el plan ya con la ia para ejecutar un roadmap completo y bien estructurado del proyecto". Principle
7 of the roadmap says why it matters: work follows the objective and the plan, so a project starts from a plan made
"casi a la perfeccion" (2026-10-18). js-harness itself was started that way by hand (pre-plan, then roadmap); onboard
makes that path the default for every project and checks its result.

## Done when
- `node --test bin/onboard.test.mjs bin/lib/onboard.test.mjs bin/init.test.mjs bin/lib/contract.test.mjs` exits 0
- `npm run check` exits 0
- One real onboarding, driven by a session in a scratch project made with `init`, the owner (or the lead for him)
  answering: one question at a time, both readers' rounds recorded, both approvals, then `js-harness onboard check`
  exits 0 there and `js-harness progress` lists every phase.

## In scope / Out of scope
- In: `bin/onboard.mjs`, `bin/lib/onboard.mjs` and their tests; one exported helper each from `bin/lib/contract.mjs`
  (a done-when command in a string) and `bin/lib/progress.mjs` (a table's cells); the dispatcher's help
  (`bin/js-harness.mjs`); one closing line of `init` (`bin/init.mjs`); README, `docs/SPEC.md`, the ROADMAP's
  Onboarding section.
- Out: the harness block of the `AGENTS.md` template — its hash is checked in every project, so a change there is a
  change for all of them; onboard writes outside the block instead (D7). Calling a model from the CLI (D1). Adopting
  a plan of another shape that a project already has (D8). Scripting the interview in `scripts/practice.mjs`, whose
  host runs only one-shot `claude -p` calls (`scripts/practice.mjs:261`, `:349-355`). The TUI entry, later.

## Constraints
- Zero dependencies and no model call from the CLI — because every command here runs in any host with no install
  step, and spend must stay where the owner sees it: in the session he is talking to.
- The CLI writes only skeletons, inside the repository, with an exclusive create that refuses an existing file
  (`onboard template <name> --write`) — because what the harness writes must be undoable exactly (here, by git) and
  must never overwrite a plan. The session fills the files; the engram copy of the feature document is gentle-ai's
  ODD mirror, not something onboard writes.
- No new skill and no new hook; the per-turn load changes only by what `AGENTS.md` gains (the roadmap line and the
  project's own sections in place of the template's placeholders), held to the `agents-budget` gate — because every
  line loaded on every turn is paid on every turn. The instructions come from the command's output, one stage at a
  time (D2).

## Ask me before
The design itself (this document, after its readers). While building: nothing else; spend is one gate per commit,
one gentle-ai review and one Codex review per slice, and the one real onboarding of the done-when.

## Specs
- S1. His words (2026-10-19), verbatim: "una funcionalidad de onboarding para que cuando instalemos el harnes en un
  proyecto hagamos todo el pre plan y el plan ya con la ia para ejecutar un roadmap completo y bien estructurado del
  proyecto".
- S2. The task given to this session (2026-10-19): the interview asks one question at a time; the design says what
  the pre-plan and the plan hold, the roadmap's shape (phases, checkable items, a "done when" per phase), where it is
  stored and how a later session resumes it; onboard reuses `init`, the task contract, this repository's roadmap
  shape and what gentle-ai offers, instead of rebuilding them.
- S3. His words (2026-10-19, answering Pregunta 25, transcript 908805db), verbatim: "La idea no es que sea un
  proyecto de prueba, la idea es que se hable con la Ia de que se va a tratar el proyecto osea de: investigacion, de
  analisis, de una pagina web estatica, de una plataforma o una aplicacion multiplataforma, etc. lo que tengo en mente
  es crear un orquestador planificador que guie y asesore al usuario de que tecnologia debe usar y como es la
  arquitectura osea es un asesor pero con lo que se piensa hacer en el proyecto, osea adquirir el rol en el
  orquestador del plan y por ejemplo: si el desarrollador del proyecto sabe que hacer lo guia y lo asesora
  avanzadamente por ejemplo sabe que esta tecnologico escoger por ejemplo el stack mern entonces lo guia super
  avanzado para el proyecto y asi para el resto de cosas cuando se crea el roadmap y todo el plan completo ahi si entra
  la sesion orquestadora a construir como hemos venido trabajando, ahora si la persona no sabe del stack o es un
  programador muy junior lo vas a guiar a enseñar y darle el criterio de acompañamiento de por que hacerlo como le
  propones para que su proyecto quede excelente y muy bien"
- S4. His words (2026-10-20, adjusting the lead's seven-point vision after Pregunta 27 "Ajustarla primero",
  transcript 908805db line 6668), verbatim: "una cosa que me gustaria es que siempre enseñes y des la opcion al
  usuario a desactivar la enseñanza y ademas que siempre des la asesoria completa osea si el usuario sabe de backend
  asesoralo y enseñale de todo lo demas, osea de fronted, de arquitectura, de ci and cd osea de todo, lo mismo en
  analisis de datos, o en una pagina estatica por ejemplo el tema del SEO, GEO y AEO por ejemplo, o de una
  investigacion de como se deberia hacer el plan para investigar y que medir etc etc osea eres un asesor elite  de
  talla mundial trabajando para desarrollar el mejor proyecto posible, praticamente sacarlo a delante con todo, a
  menos que el usuario te indique lo contario osea de que no quiere aprender y de que solo quiere hacerlo facil y
  rapido sin importar tanto la calidad y la profundidad del proyecto."

## Tasks
- [ ] T1 (kind: design) This design, past its two readers, and his yes
- [x] T2 (kind: build) Slice 1: `onboard check` (D6), `hash`, `template`, the two exported helpers, help, README, SPEC, with tests (51e4c07e and its review fixes)
- [x] T3 (kind: build) Slice 2: bare `onboard`, its stages and resume (D2, D7, D8), `init`'s closing line, with tests (PR 468, merged)
- [ ] T6 (kind: design) Design v4 from S3: the onboarding as a plan orchestrator that asks the project's kind and the developer's level, and advises the stack and the architecture, past its two readers and his yes
- [ ] T4 (kind: verify) The one real onboarding of the done-when, after T6 (its scratch-project interview was stopped by S3)
- [ ] T5 (kind: docs) Tick the ROADMAP's Onboarding steps (on `main` once `feat/release-095` lands) and record the reviews

## Design

### What exists and is reused (read 2026-10-19)
- **The path js-harness took itself.** On 2026-09-26 he asked whether pre-plan, plan and roadmap were one too many
  ("sera que me estoy complicando...", transcript `c580b1d8`, line 446). The answer he applied (lines 451-510): the
  pre-plan is frozen as the origin (`docs/origin.md`: why, evidence, sources), the roadmap is the one living plan,
  each feature document covers only its feature, and `AGENTS.md` points every session at the roadmap. Onboard
  produces that same set, so "pre-plan" and "plan" in S1 are `docs/origin.md` and `docs/ROADMAP.md`.
- **What `progress` parses** (`bin/lib/progress.mjs:220-246`): only `## Checklist`, where each `### <phase>` is a
  phase and each `- [ ]` / `- [x]` line under it a step; it counts every checkbox of a feature document too. The rest
  of this repository's roadmap (`## Phases` table at `docs/ROADMAP.md:74-96`, `## Next` at `:958`, `## Open
  decisions` at `:1246`, `## Risks` at `:1353`) is read by people, not parsed.
- **The pre-plan shape**: `docs/origin.md`, js-harness's founding pre-plan: Decisions already made, Principles,
  Phases (Goal, Done when, Effort), Not built (the stack already does it), Risks, Open decisions (ask one at a time),
  Sources.
- **The task contract** (`bin/lib/contract.mjs`): a done-when item opens with a code span and says `exits 0`
  (`:38-39`); only `doneWhen(markdown)` of a whole document is exported (`:102-112`).
- **`init`** (`bin/init.mjs`, `bin/lib/project.mjs`): writes `harness.json`, a base `AGENTS.md` when none exists
  (`agentsTemplate`, `:345`, whose "What this project is", "How it works" and "Constraints" are angle-bracket
  placeholders outside the hashed block), `docs/FAILURES.md`, the pre-commit gate and codegraph. It writes no roadmap
  and its `AGENTS.md` names none. Lines outside the block survive `sync`, which re-renders only the block
  (`:376-392`), and `uninstall`, which keeps an `AGENTS.md` changed since `init` (`:1457`).
- **gentle-ai 4.2.0**: `gentle-ai --help` lists no planning command; ODD lives in the orchestrator prompt. What it
  gives and onboard reuses: explore before asking, one focused question for a real product decision, research only
  for a named uncertainty, the feature document (Specs quoting the user verbatim, Tasks, Log) and its engram mirror.
  Onboarding a project is itself one ODD feature of that project.
- **The readers** (`js-harness-protocols`, section 1): a plan put to the owner first passes two read-only readers,
  one attacking its claims, one looking for what is missing; a second round reads only the first round's blockers.

### D1. The AI is the session, not the command
`js-harness onboard` never calls a model. The owner runs it in a Claude Code or Codex session (or tells the session
"onboard this project"); the session runs the command, reads what it prints and does that stage. The CLI holds what
must not depend on a model's memory: which stage the project is in, what that stage must produce, skeletons that
never overwrite, and a check of the result. Spawning `claude -p` from the CLI was weighed and dropped: an interview
needs the owner in the loop, and spend from a hidden child is spend he does not see.

### D2. Stages, read from files; instructions printed one stage at a time
`onboard` with no flag reads the project's files and git, prints the current stage, what it must produce, how much is
left (for the interview, "topic 4 of 9") and the next step, in English, and exits 0. Nothing about the stage lives in
the conversation, so a new session, a compaction or the other host resumes by running `onboard` again; stopping
between any two answers is safe. The onboarding document (D7) carries fixed IDs that the stages key on:

| # | Stage | Current when | What the session does |
|---|-------|--------------|-----------------------|
| 1 | Read | no `odd/tasks/onboarding.md` on this branch and none on another (D7) | Reads the repository (README, manifests, `git log`, docs, codegraph where there is code); runs `onboard template feature --write`; fills L1 with the owner's request and `## What exists` with what it found, each with its evidence |
| 2 | Interview | a topic under `## Interview` is unchecked, or there are fewer than the nine | Asks the next topic, one question, waits; logs the answer verbatim with its date and checks the topic, as `answered` or `unknown (OD<n>)` with an open decision added |
| 3 | Pre-plan | every topic checked, and `O2` unchecked or its recorded hash of `## Interview` differs | `onboard template origin --write` the first time, then fills or revises the file from the interview, checks `O2` with the hash of `## Interview` |
| 4 | Pre-plan review | `O2` checked, `O3` unchecked, or `O3`'s recorded hash differs from `docs/origin.md` | Two readers, findings under `## Reviews`; one question to the owner. A yes checks `O3` with the file's sha256 and the Log line. A no is logged verbatim, the file revised, a second round reads only the blockers, and he is asked again |
| 5 | Plan | `O3` holds, `O4` unchecked | `onboard template roadmap --write`, fills it from the approved pre-plan, runs `onboard check --plan` until it exits 0, checks `O4` |
| 6 | Plan review | `O4` checked, and `O5` unchecked or one of its two recorded hashes (`docs/ROADMAP.md`, and the `docs/origin.md` it was derived from) differs | As stage 4, for the roadmap, revising it first from the changed pre-plan |
| 7 | Close | `O5` holds, `onboard check` fails | Fills `AGENTS.md` (D7); each failing finding names the stage it sends back to; commits |
| 8 | Awaiting merge | `onboard check` exits 0 on a branch that is not the default one, and the default one has no `docs/ROADMAP.md` | Prints that merging is the owner's decision under the repository's policy, and the pull request command |
| — | Onboarded | `onboard check` exits 0 and the default branch has `docs/ROADMAP.md`, whatever branch the session is on | Prints the roadmap's `## Next` step and the text that starts its session |

A change of an answer after an approval goes through the file: the session edits `docs/origin.md` (or the roadmap),
the hash no longer matches, and the review stage is current again. The hashes are checked only until the onboarding
closes; after that the roadmap is the living plan and changes like any other. Each stage's instructions are a few
lines of the command's output, tested like any other output.

### D3. The interview
- **Read before asking.** Nothing the repository already answers is asked; the session states what it read and asks
  only to confirm what it inferred, as one question.
- **One question at a time**, through the question tool where the host has one (Claude Code), with a recommended
  option first, so he can answer from his phone with a tap; plain text in Codex. A short answer that fits two
  readings is asked about, not guessed. Where an orchestrator holds the lead role, the question goes through it
  (`js-harness-orchestrator`, "Questions to the user"); one session holds the onboarding.
- **The nine topics**, in order, each a checkbox under `## Interview`:
  1. What the project is and for whom (one sentence each).
  2. The outcome that makes it worth doing: how the owner will know it worked.
  3. What exists today: code, data, users, deadlines (confirming `## What exists`).
  4. Decisions already made: stack, hosting, services, the language of the product and of its artifacts.
  5. Constraints and their reasons: money, time, legal, data, machines.
  6. In and out of scope for the first usable version.
  7. What the owner keeps for himself (spend, irreversible steps, product choices).
  8. Order: what must come first, and what can wait.
  9. Risks and unknowns; each unknown becomes an open decision or a research item with a named question.
- **It ends when** every topic is answered or marked unknown, not after a fixed number of questions. Topics 1, 2 and 7
  cannot be unknown: without them there is no plan to make. A topic whose answer opens a real fork gets one follow-up
  question; anything else is decided by the session and written down with its reason.
- Answers are logged in the owner's words and language, with the date; everything else follows topic 4's artifact
  language.

### D4. What the pre-plan holds (`docs/origin.md`)
The sections of js-harness's own origin, with three added at the top: a status note (frozen once onboarding closes;
later changes go to the roadmap), Goal, Why, What exists (with the read stage's evidence), Decisions already made (a
table, each with the owner's words and date), Principles of this project, Phases (Goal, Done when), Not built (what
the installed stack already does), Risks, Open decisions (`OD<n>`, asked one at a time), Sources (the interview's
dated answers, research links). Research for a named unknown may run here, with its sources; none runs without a
named question.

### D5. What the plan holds (`docs/ROADMAP.md`)
Its `## Checklist` is what `progress` parses, unchanged. Around it, a stricter shape than js-harness's own roadmap,
which grew before this check existed and is not held to it:
- A header naming the three documents (this file is the plan, `origin.md` where it came from, `odd/tasks/` one
  feature each); what comes next is read under `## Next`.
- `## Principles` and `## Decided`, carried from the pre-plan.
- `## Phases`: a table `Phase | Goal | Done when | State`, one row per pre-plan phase. Every **Done when** holds at
  least one command in the contract's form (a code span followed by `exits 0`) and may add one observable behavior.
  Where code already exists, the first phase is `What exists`, its steps checked with their evidence, so `progress`
  starts from the truth and not from 0%; the next is the smallest version the owner can use.
- `## Checklist`: one `### <phase>` per table row, same names, same order, each with at least one `- [ ]` step. A
  step is one feature or less (the work of one session, about one pull request of 400 authored lines at most) and
  says what is true when it is done, not an activity.
- `## Next`: the first unchecked step and the text that starts its session. Opening that feature's document is the
  next session's work, one feature per session.
- `## Open decisions` (every `OD<n>` of the pre-plan still open, by its ID) and `## Risks`.

### D6. `onboard check`
A static check; it never runs a command. Each finding is one line naming the file, what is wrong and the stage it
sends the work back to; it exits 0 with none, 1 otherwise. `--plan` runs only the roadmap's own rules (stage 5).
- **The onboarding document**: nine topics checked, topics 1, 2 and 7 answered; `O3` and `O5` checked, each with a
  sha256 matching its file and a Log line; `## Reviews` holds a round for each of the two reviews.
- **The pre-plan**: its required headings.
- **The roadmap**: `parseRoadmap` finds at least one phase, each with at least one step; every Checklist phase has a
  `## Phases` row of the same name, and the other way round; every pre-plan phase is a roadmap phase; every Done when
  cell holds a command in the contract's form; `## Next` exists; every `OD<n>` still open in the pre-plan appears in
  the roadmap's Open decisions.
- **`AGENTS.md`**: the roadmap line, and none of `agentsTemplate`'s placeholder lines left.

To share one rule with the contract, `bin/lib/contract.mjs` exports a helper that finds a done-when command in a
string, and `bin/lib/progress.mjs` exports its pipe-aware table splitter. A `check` row for it is left for later,
once a project has used it.

### D7. Where it is stored, and how a later session resumes
- **The onboarding itself**: `odd/tasks/onboarding.md` in the new project, written from `onboard template feature`:
  the contract head (Goal: an approved `docs/ROADMAP.md`; Done when: `` `js-harness onboard check` exits 0``),
  `## What exists`, `## Interview` (nine topics), Tasks `O1`-`O6` (read, pre-plan written, pre-plan approved, plan
  written, plan approved, closed), `## Reviews` and a Log with each answer and each yes or no verbatim. ODD's engram
  mirror holds a copy; `progress` counts it as a feature.
- **Committed after every stage, and every three answers in the interview**, on the branch `onboarding`: desktop
  sessions each run in their own worktree, and only what is committed reaches the next one. Each commit runs the
  project's gate, so a commit per answer would make him wait on every tap; a cut loses at most two answers, and
  `onboard` names the uncommitted ones. When `onboard` finds no document on this branch, it looks for one on any local
  or remote branch (`git log --all -- odd/tasks/onboarding.md`) and prints "onboarding in progress on branch X" with
  the way to resume: where `git worktree list` shows the branch checked out in another worktree, it names that
  folder; otherwise it prints the command that creates a branch from it here.
- **The result**: `docs/origin.md` (frozen once closed) and `docs/ROADMAP.md` (living), merged by the owner (stage 8).
- **Every session after**: Close fills `AGENTS.md` outside the harness block: "What this project is" and
  "Constraints" from topics 1, 4, 5 and 7, the checking command in "How it works", and one line, `The plan is
  docs/ROADMAP.md: a session starts there, and each feature's state is in odd/tasks/.` `init`'s template stays
  unchanged, so no other project's block hash moves.
- **Undo**: everything is a file in the repository, undone by git; nothing goes in the project manifest, so
  `uninstall` never deletes the plan.

### D8. Edges
- A project with a plan of its own (`docs/ROADMAP.md` or `docs/origin.md`, and no onboarding document anywhere):
  onboard writes nothing and runs no check; it prints which file is there and that adopting a plan of another shape
  is not supported yet, so the owner moves the file aside to onboard, or keeps his plan.
- `init` ends with one more line when the project has no `docs/ROADMAP.md`: `next: in a Claude Code or Codex
  session, run js-harness onboard`. `init` never starts the interview itself.
- `onboard` outside an initialized project refuses, like the other project commands, and names `init`.
- `onboard template <feature|origin|roadmap>` prints a skeleton; with `--write` it creates the file and refuses one
  that exists.
- In Codex, which has no sub-agents here, the readers are another session, as the protocol says.
- Tests (T2, T3): a fixture project per stage; the back-transition of a changed approved file; a no at each review;
  the half-plan of D8; an `## Interview` with fewer than nine topics; a renamed task line keyed by its ID; a Close
  whose check fails on the roadmap, sending it back to stage 6; resume from another branch; the awaiting-merge state.

### Cost
Building it: one session, two slices of about 400-500 authored lines each with tests (the comparable `contract` and
`progress` are 385 and 322 lines before tests), one gate per commit, one gentle-ai and one Codex review per slice,
and the one real onboarding of the done-when. Using it in a project: one interview session of about nine questions
plus confirmations, and two readers twice (pre-plan, plan), on the reader model the rules give.

## Reviews
- Round 1 (2026-10-19), two read-only readers on claude-opus-5-5 over version 1.
  - Claims reader: no blocker; ten advisories. Taken: D8 keyed on "no onboarding document" (it fired against the
    stages' own files); the roadmap shape is no longer called this repository's, only its Checklist is, and
    js-harness's own roadmap is not checked; the contract and table helpers are exported and those files are in
    scope; the per-turn claim corrected (`AGENTS.md` grows); the engram mirror named as gentle-ai's; "never over an
    existing file" enforced by `--write`'s exclusive create; the practice-script done-when replaced by a real
    onboarding, since `scripts/practice.mjs` only runs one-shot `claude -p`; the cost raised to two slices; topics
    marked unknown are checked, approvals keyed by IDs, the plan checked before its readers; citations fixed.
  - Gaps reader: four blockers, eleven advisories. Taken: a no and a changed answer go back through the file's hash
    (G1); a commit after every answer, resume from another branch and an awaiting-merge state (G2); `onboard check`
    ties the roadmap to the pre-plan, its open decisions and the approvals, and topics 1, 2 and 7 cannot be unknown
    (G3); the half-plan edge (G4); `## Reviews` checked (G5); Close fills `AGENTS.md`'s placeholders (G6); questions
    through the lead (G7); a `What exists` phase (G8); the done-when (G9); topic count and safe stops (G10); the
    tests named (G11); the ROADMAP's Onboarding section lives on `feat/release-095` until it lands (G12); Codex
    readers (G13); Close does not open the first feature (G14); the artifact language is topic 4 (G15).
- Round 2 (2026-10-19), the gaps reader over version 2, its four blockers only. G3 and G4 closed. G1 still open:
  a re-asked topic did not make stage 3 revise the pre-plan, and a pre-plan changed after the plan's approval did not
  reopen stage 6; taken in version 3: `O2` records a hash of `## Interview` and `O5` a hash of `docs/origin.md` too.
  G2 still open through defects version 2 brought: Onboarded was unreachable from a worktree's own branch, the resume
  command failed while the old worktree held the branch, and a commit per answer ran a gate per tap; taken in
  version 3: Onboarded is read from the default branch whatever branch the session is on, resume names the worktree
  from `git worktree list` or creates a branch from it, and the interview commits every three answers.
  - Unguaranteed: version 3's fixes were not read again (the protocol allows no third round). That nine topics are enough for every kind of project, and that a model fills the sections well;
    `onboard check` proves the plan's structure and its ties to the interview, not that its judgment is good. The
    readers and his two approvals are what stand for that.
- Code reviews of the build, one line per commit:
  - gentle-ai: `51e4c07e` approved (readability, reliability; lineage review-ef039b34d177cda4, acknowledged); Codex 4 P2.
  - gentle-ai: `5bc31869` assessed `medium`, review not due (`under_budget`, 7 paths, 158 lines); Codex correct (0.96).
  - gentle-ai: `2fede5c1..12aa07ce` approved after one bounded correction (readability, reliability; lineage review-bf067ebd0c1e7217, acknowledged): R3-uncommitted-trim fixed in `12aa07ce`. Codex over 6e99eda..ef60d12: one P2.
  - gentle-ai: `ef60d123` assessed `medium`, review not due (`under_budget`, 13 lines), from that review's advisories; Codex in 6e99eda..ef60d12.
  - gentle-ai: `04163529` assessed `medium`, review not due (`under_budget`, 44 lines): Codex's P2 on a remote branch hidden behind a local one, fixed with its RED test.

## Log
- L1 (2026-10-19) His request, verbatim: "una funcionalidad de onboarding para que cuando instalemos el harnes en un
  proyecto hagamos todo el pre plan y el plan ya con la ia para ejecutar un roadmap completo y bien estructurado del
  proyecto".
- L2 (2026-10-19) His earlier words searched in every js-harness and harness transcript, his own typed messages
  only, for `onboarding|pre ?plan|plan casi|roadmap completo|nuevo proyecto.*plan`: the 2026-09-26 thread on
  pre-plan, plan and roadmap (transcript `c580b1d8`, lines 234-510) and principle 7 (transcript `e152c9d8`, line
  29030). Both are used above: the first point of "What exists", and the Why.
- L4 (2026-10-19) His answer, relayed by the lead (Pregunta 21): "Construirlo (Recommended)". The lead asks: build
  v3 with tests, gentle-ai review per work unit, Codex review and PRs it lands with merge-queue; bring the branch up to
  date with main first; do not touch package.json (release 0.96.0 is being cut; onboarding ships in the release
  after); tell it each PR number. Branch merged with main at a4d43ed0.
- L5 (2026-10-19) Slices swapped, since the stages use the check: slice 1 is `onboard check`, `hash` and `template`
  (`bin/lib/onboard.mjs`, `bin/onboard.mjs`, `commandsIn` in `bin/lib/contract.mjs`, `cellsOf` exported from
  `bin/lib/progress.mjs`, the dispatcher's help, README); slice 2 is bare `onboard` (stages, resume), `init`'s closing
  line and SPEC. Lib tests RED observed (module missing), then 16/16 GREEN; command 6/6 GREEN. Topic 7 reads "What the
  owner decides alone".
- L6 (2026-10-19) Slice 1 committed (51e4c07e). gentle-ai approved it (readability, reliability; lineage
  review-ef039b34d177cda4, acknowledged), with advisories: the feature template promises a bare `onboard` that slice 2
  brings; O2's interview hash was never compared; the done-when span pattern could run across spans. Codex (4 parts,
  recorded) found four P2: that same pattern, a Log reference that resolves to no entry, approval metadata on a
  continuation line, and `template --write` through a linked directory. All but the first advisory are fixed in one
  commit with a RED test each (5 RED observed, then 68/68 GREEN).
- L7 (2026-10-19) The fix commit 5bc31869 passed the gate (gentle-ai: under budget) and Codex (correct, 0.96). PR 466
  holds slice 1; the lead was told. Slice 2 is built on branch `feat/onboarding-stages`, cut from it so 466 does not
  grow in the queue. It has `currentStage` and `stageReport` in the lib, bare `onboard` with the git it reads (the
  default branch, other branches and their worktrees, and what is uncommitted), and `init`'s closing line. The
  fixtures moved to `bin/lib/onboard.testkit.mjs`. RED was observed for the missing export, the four command tests
  and init's line; then 136/136 GREEN across the touched suites.
- L8 (2026-10-19) The merge queue left PR 466 out for want of a gentle-ai line naming 5bc31869. 6e99edaf adds one
  line per code commit under `## Reviews`, and the lead was told. Slice 2, on `feat/onboarding-stages` in this
  worktree, has these commits:
  - 2fede5c1, the stages;
  - 12aa07ce and ef60d123, fixes from gentle-ai's review;
  - 04163529, Codex's P2.
  Each has its line under `## Reviews`.
- L9 (2026-10-19) PRs 466 and 468 merged, so slices 1 and 2 are on main and T3 is checked. T4 started in a scratch
  project made with `init` (`%TEMP%\tmp.B03yRgQ1Xy`, its init files committed as c587e05, stage 1). Its first
  question, the owner's request for L1, went to the lead as Pregunta 25. His answer is S3, verbatim. It stops the
  scratch-project interview and reframes onboarding itself: the onboarding is a planning conversation with the AI in a
  plan-orchestrator role, before the build orchestrator takes over. It asks the project's kind (research, analysis,
  static site, platform, multiplatform app...) and the developer's level. It advises the stack and the architecture:
  in depth for one who knows, and teaching the why to a junior. It ends with the roadmap and the full plan. The lead
  asked for design v4 from it, reviewed by two readers, with only the remaining product decisions sent to the lead
  as questions, one at a time. This is T6.
- Next step (branch feat/onboarding-plan-advisor, cut from main at bc76bc46):
  1. T6: read `## Design` (v3) against S3, and write v4. What changes is mostly the interview (the project's kind and
     the developer's level come first, and they shape the questions and the depth of advice) and the pre-plan, which
     gains a stack and architecture section with the reasons behind each choice. What stays is the stages, the
     files, `check` and resume, already built.
  2. Run two readers over v4 at high effort, and record their round under `## Reviews`.
  3. Send the lead each remaining product decision with `js-harness notify --to orchestrator --kind question`, one
     at a time.
  4. Then T4, the real onboarding, in the new shape.
- L3 (2026-10-19) Version 1 committed (`docs(onboarding): open the feature...`); round 1 of the readers recorded under
  `## Reviews`; version 2 written from it; round 2 read the four blockers; version 3 takes its findings. What stays
  open is listed as unguaranteed under `## Reviews`.
- L10 (2026-10-20) He asked the lead how onboarding should be. The lead's seven points:
  1. The project's kind first, since it decides which stages apply.
  2. The developer's level read per area from how they answer, never asked.
  3. One decision at a time, each with its alternatives and its why, kept as a short ADR in `docs/origin.md`.
  4. The advanced developer is challenged too.
  5. Technology advice checked against current sources and cited.
  6. The same outputs: origin, roadmap, a first feature document with its contract.
  7. No course platform and a bounded interview.
  Pregunta 27 (pass the vision to JH 34?) was answered "Ajustarla primero"; S4 is his adjustment.
  Vision as adjusted, for T6:
  - Teaching is ON by default, and the user can turn it off at any moment; the choice is recorded and can be turned
    back on.
  - The advice covers every area the project's kind needs, whatever the developer knows:
    - a platform: backend, frontend, architecture, CI/CD, security, observability;
    - a static site: SEO, GEO and AEO;
    - data analysis: sources, quality, method, reproducibility;
    - research: the research plan and what to measure.
  - The level found per area sets the depth and tone, not whether an area is covered.
  - A fast mode only when the user says so ("facil y rapido"): minimal advice, with the tradeoffs given up named once
    and recorded.
  - The lead's point 7 is revised:
    - Teaching is now the default.
    - What stays bounded is the onboarding itself: it settles the decisions the roadmap needs, and the deeper advice
      of each area becomes a roadmap phase with its own advice when that phase starts.
    - This is a proposal for T6's readers, not his words.

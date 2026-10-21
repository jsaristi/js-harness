# Onboarding: the pre-plan and the plan of a new project, with the AI

Locator: `odd/tasks/onboarding.md` · Engram mirror: `odd/onboarding/tasks` · Branch: `feat/onboarding-plan-advisor`
Delivery: slices 1-2 merged (PRs 466, 468); slices 3-5 stacked to `main` after his yes to v4. Test runner: `node --test`.
Design version 4 (T6): version 3, built, reshaped by S3-S7 into a plan orchestrator that advises (see `## Design`).

## Goal
After `js-harness init`, a session in the new project runs `js-harness onboard` and takes the plan orchestrator's
role: it learns the project's kind, its size and the developer's level, advises every area that kind needs (stack,
architecture, and the rest), teaching the why unless the owner turns teaching off, and ends with a reviewed and
approved pre-plan (`docs/origin.md`), its decisions (`docs/adr/`) and roadmap (`docs/ROADMAP.md`) that `js-harness
progress` reads. Then the build orchestrator takes over and builds from the roadmap, as it does now.

## Why
His words (2026-10-19): "una funcionalidad de onboarding para que cuando instalemos el harnes en un proyecto hagamos
todo el pre plan y el plan ya con la ia para ejecutar un roadmap completo y bien estructurado del proyecto". Principle
7 of the roadmap says why it matters: work follows the objective and the plan, so a project starts from a plan made
"casi a la perfeccion" (2026-10-18). js-harness itself was started that way by hand (pre-plan, then roadmap); onboard
makes that path the default for every project and checks its result.

## Done when
- `node --test bin/onboard.test.mjs bin/lib/onboard.test.mjs bin/init.test.mjs bin/lib/contract.test.mjs` exits 0
- `node --test bin/lib/profiles-data.test.mjs bin/lib/manifest.test.mjs` exits 0 (v4, slices 3 and 5)
- `npm run check` exits 0
- Two real onboardings (T4, S9), not test projects (S3): a static website in Astro (`static-site`), and a platform
  pre-project (`pre-project`, nearest kind `platform`, D14). In each: a guided conversation and a few deepening questions, both readers' rounds
  recorded, both approvals, then `js-harness onboard check` exits 0 there and `js-harness progress` lists every phase.

## In scope / Out of scope
- In: `bin/onboard.mjs`, `bin/lib/onboard.mjs` and their tests; one exported helper each from `bin/lib/contract.mjs`
  (a done-when command in a string) and `bin/lib/progress.mjs` (a table's cells); the dispatcher's help
  (`bin/js-harness.mjs`); one closing line of `init` (`bin/init.mjs`); README, `docs/SPEC.md`, the ROADMAP's
  Onboarding section. v4 adds: `bin/lib/profiles-data.mjs` and its shape test (D9); one paragraph of the
  `js-harness-orchestrator` skill (`bin/lib/manifest.mjs`, D13).
- Out: the harness block of the `AGENTS.md` template — its hash is checked in every project, so a change there is a
  change for all of them; onboard writes outside the block instead (D7). Calling a model from the CLI (D1). Adopting
  a plan of another shape that a project already has (D8). Scripting the interview in `scripts/practice.mjs`, whose
  host runs only one-shot `claude -p` calls (`scripts/practice.mjs:261`, `:349-355`). The TUI entry, later.
  Teaching in a work session's own chat: after onboarding, a work session writes the why only into the questions it
  sends through the lead (S7, D13). Kinds past S8's eleven: `other` advises them until they get a profile of their
  own.

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
  time (D2), and the profiles from `onboard profile`, one kind or area at a time (D9). Nothing about the advice mode
  goes in `AGENTS.md` (S7, L13).
- Advice about a tool is checked against its current docs, read during the session and cited with URL and read date
  in the ADR (D12) — because tool names and maintainers age, not only versions (L12: Auth.js).

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
- S5. His words (2026-10-20, transcript 908805db line 6769), verbatim: "por ejemplo una web estatica se hace con Astro
  y ademas deber ser rapida osea necesito que de una vez coloques ejemplo reales para que el harnes los pueda seguir y
  aportar mas". The lead's draft of those examples is `## Reference profiles` below; T6 makes them the advisor's data.
- S6. His answer to Pregunta 28 (2026-10-20, transcript 908805db line 7009). The question was how much advice goes
  into the first onboarding: "Lo necesario ya, el resto por fase" or "Todo en el onboarding". Verbatim: "Todo el
  onboarding pero preguntale al usuario si el proyecot lo quiere grande o pequeño para entonces hacerle uno que sea lo
  necesario"
- S7. His answer to Pregunta 29 (2026-10-20, transcript 908805db line 7043). The question was whether teaching
  continues in the sessions that build, after onboarding. Verbatim: "En el onboarding y en la sesion orquestadora"
- S8. His answer to Pregunta 30, OD-K (2026-10-20, transcript 908805db line 8699, read with `js-harness sessions
  --quote`). The question was which kinds the advisor brings in the first build: "Los cinco + otro (Recommended)" or
  "Sumar CLI, API y app IA". Typed, verbatim: "todos estos y agregale TUI, mejor dicho nos sirve para todo inclulso si
  no quiero hacer proyecto de una sino una investigacion o analisis de mercado por ejemplo para armar un pre proyecto
  de una aplicacion complete especifica para un sector de negocio y desde ahi armar todo el roadmap completo a partir
  de investigacion y analisis y ademas de discusion y criterio"
- S9. His answer to Pregunta 31, OD-T4 (2026-10-20, transcript 908805db line 8857, read with `js-harness sessions
  --quote`). The question was which real project the onboarding is tried on after the build: "Un proyecto mío
  (Recommended)" or "Un pre-proyecto de sector". Typed, verbatim: "Vamos a hacer uno de una pagina web estatica en
  astro y un pre proyecto de plataforma que nos va a hacer todos los documentos para una plataforma completa"
- S10. His answer to Pregunta 32, OD-R (2026-10-20, transcript 908805db line 9024, read with `js-harness sessions
  --quote`). The question was when the two readers run, given that each area is a question with a recommendation.
  Tapped, verbatim: "Una vez por perfil (Recommended)"
- S11. His words on the interview's feel (2026-10-20, transcript 908805db line 9112, typed to the lead while
  Pregunta 33 was pending, not an answer to it), verbatim: "Pero esta bien las 33 preguntas, pero me gusta mas que sea
  hablado y como guiado"
- S12. His answer to Pregunta 33, OD-F (2026-10-20, transcript 908805db line 9165, read with `js-harness sessions
  --quote`). The question was whether fast mode keeps the two readers and both approvals: "Sí, las dos (Recommended)"
  or "Sin lectores". Typed, verbatim: "Si pero no necesariamente tienen que ser 33 preguntas todas seguidas, para que un
  formulario si tu eres una IA y puedes charlando y con una buena explicacion entender y descifrar lo que quiere el
  usuario y ahi si por ultimo hace unas pocas preguntas para ahondar mas, osea no hay necesidad de hacer un formulario
  por que eres una guia y un asesor con el que se puede hablar y ademas tiene muy buen analisis y deduccion"

## Tasks
- [x] T1 (kind: design) This design, past its two readers, and his yes (L22)
- [x] T2 (kind: build) Slice 1: `onboard check` (D6), `hash`, `template`, the two exported helpers, help, README, SPEC, with tests (51e4c07e and its review fixes)
- [x] T3 (kind: build) Slice 2: bare `onboard`, its stages and resume (D2, D7, D8), `init`'s closing line, with tests (merged in `jsaristi/js-harness#468`)
- [x] T6 (kind: design) Design v4 from S3-S8, L12 and `## Reference profiles`: the onboarding as a plan orchestrator that asks the project's kind and the developer's level, and advises the stack and the architecture, past its two readers and his yes (fb54c927, L22)
- [ ] T7 (kind: build) Slices 3a-3c: `bin/lib/profiles-data.mjs` with the eleven kinds of S8, `onboard profile`, the shape test (D9, D14), after his yes to v4; each profile passes two readers when it is written (S10)
- [ ] T8 (kind: build) Slice 4: the v4 conversation (D3, D15), `## Setup` and `## Advice`, ADRs, the origin and roadmap additions, their checks and stage lines, Close renumbered (D2-D7, D10-D12)
- [ ] T9 (kind: build) Slice 5: the orchestrator skill's teaching paragraph and the handoff line (D13), README, SPEC
- [ ] T4 (kind: verify) The two real onboardings of the done-when (S9), after T9: the Astro static site, then the platform pre-project (its scratch-project interview was stopped by S3)
- [ ] T5 (kind: docs) Tick the ROADMAP's Onboarding steps (`docs/ROADMAP.md:231-237`, on `main` now) and record the reviews

## Design

### What v4 changes, and what it keeps
v3 is built and merged (PRs 466, 468): the stages read from files, the templates with exclusive create, the hashes
and approvals, `onboard check`, resume from another branch. v4 keeps all of it; S3 contradicts none of it. What S3-S7
change is what the session does inside the stages:
- **A role, not only an interview** (S3): the session that runs `onboard` is the plan orchestrator. It advises, and
  the build orchestrator (the `js-harness-orchestrator` lead) takes over only once the roadmap is approved (D13).
- **Kind, size, level and teaching first** (S3, S4, S6): recorded under a new `## Setup`, the moment each is said
  (D3, D11), so a resume never loses them (L12).
- **Advice per area** (S3, S4): every area the kind needs, at the project's size, gets one advised decision with its
  why, whatever the developer already knows; the level sets the depth, not the coverage (D10). All of it happens in
  the onboarding, scaled to the size (S6); L10's deferral of areas to phases is withdrawn (L13).
- **The reference profiles become data** (S5, L11): `bin/lib/profiles-data.mjs`, printed one kind or area at a time
  by `onboard profile` (D9), with the corrections L12 found applied to `## Reference profiles` below.
- **Decisions as ADRs with sources** (L12): `docs/adr/`, each citing the docs read for it, with their date (D12);
  the profile's bar becomes roadmap steps and done-when commands (D5).
- **Teaching outlives the onboarding in the orchestrator's chat only** (S7): the roadmap carries `## Advice mode`;
  the questions that reach the owner through the lead carry the why, and nothing goes in `AGENTS.md` (D13).
- Stage numbers stay: advice runs inside stage 2, renamed "Conversation and advice", so no finding's "back to stage N"
  changes meaning.

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
left (for the conversation, "covered: 7 of 11 topics, 3 of 8 areas") and the next step, in English, and exits 0.
Nothing about the stage lives in the conversation, so a new session, a compaction or the other host resumes by running
`onboard` again; stopping between any two answers is safe. The onboarding document (D7) carries fixed IDs that the
stages key on:

| # | Stage | Current when | What the session does |
|---|-------|--------------|-----------------------|
| 1 | Read | no `odd/tasks/onboarding.md` on this branch and none on another (D7) | Reads the repository (README, manifests, `git log`, docs, codegraph where there is code); runs `onboard template feature --write`; fills L1 with the owner's request and `## What exists` with what it found, each with its evidence |
| 2 | Conversation and advice | a `## Setup` value is missing or malformed, a topic under `## Interview` or an area under `## Advice` is unchecked, or the topics or areas differ from the expected set (D3, D10) | Guides the conversation toward what is still open (D3), logs what settles each item and checks it: a topic as `answered`, `deduced` or `unknown (OD<n>)`, an area as D10 says; then the summary and the few deepening questions. Once `Kind` and `Size` are in `## Setup` (deduced allowed, D15) and `## Advice` is still empty, the output's next step is to run `onboard profile --checklist advice` and paste what it prints under `## Advice` |
| 3 | Pre-plan | every topic and area checked, and `O2` unchecked or its recorded `answers` hash (D6) differs | `onboard template origin --write` the first time, then fills or revises the file from the answers and the ADRs, checks `O2` with the `answers` hash `onboard hash` prints |
| 4 | Pre-plan review | `O2` checked, and `O3` unchecked or one of its two recorded hashes (`origin`, `adrs`) differs | Two readers read the pre-plan and every ADR, findings under `## Reviews`; one question to the owner, whose text is a summary a phone shows whole: the plan in a few lines and every area in one line with its proposal and ADR, so his yes confirms them (D10). A yes checks `O3` with both hashes and the Log line. A no is logged verbatim, the files revised, a second round reads only the blockers, and he is asked again |
| 5 | Plan | `O3` holds, `O4` unchecked | `onboard template roadmap --write`, fills it from the approved pre-plan and ADRs, pastes `onboard profile --checklist bar` into its first build phase, runs `onboard check --plan` until it exits 0, checks `O4` |
| 6 | Plan review | `O4` checked, and `O5` unchecked or one of its three recorded hashes (`roadmap`, `origin`, `adrs`) differs | As stage 4, for the roadmap, revising it first from the changed pre-plan or ADRs |
| 7 | Close | `O5` holds, `onboard check` fails | Fills `AGENTS.md` (D7); each failing finding names the stage it sends back to; commits |
| 8 | Awaiting merge | `onboard check` exits 0 on a branch that is not the default one, and the default one has no `docs/ROADMAP.md` | Prints that merging is the owner's decision under the repository's policy, and the pull request command |
| — | Onboarded | `onboard check` exits 0 and the default branch has `docs/ROADMAP.md`, whatever branch the session is on | Prints the handoff of D13: the plan orchestrator's work is done, the roadmap's `## Next` step, and the lead's opening prompt |

A change of an answer after an approval goes through the files: the session edits the answer, `docs/origin.md`, an ADR
or the roadmap, a recorded hash no longer matches, and the stage it belongs to is current again. Only what the plan is
made of is hashed (D6): turning teaching off, raising a level or switching to the fast plan after an approval reopens
nothing (S4 asks for teaching to be easy to turn off). The hashes are checked only until the onboarding closes; after
that the roadmap is the living plan and changes like any other. Each stage's instructions are a few lines of the
command's output, tested like any other output.

### D3. The conversation
Its file formats and stage-2 output are in D15.
S11 and S12 replace the interview of one question after another: "no hay necesidad de hacer un formulario por que eres
una guia y un asesor con el que se puede hablar y ademas tiene muy buen analisis y deduccion". The plan orchestrator
talks with the owner, explains, understands and deduces; it asks only a few questions at the end, to go deeper.
- **Read before talking.** The session opens with what the repository already says, in a few lines, so nothing it
  shows is asked.
- **It opens the conversation, it does not interrogate.** Its first message says who it is in this project (the plan
  orchestrator, who will advise every area and then hand over to the build orchestrator) and what the conversation
  will produce (the pre-plan, its decisions and the roadmap). It says that teaching is on, that "sin enseñanza" turns
  it off and "fácil y rápido" asks for the fast plan (S4). Then it invites him to tell the project in his own words:
  what it is, for whom, why now. The session logs that it said so, as a Log line marked `(session)`, and `## Setup`
  records `Teaching: on (L<n>)`.
- **It guides** (S11: "me gusta mas que sea hablado y como guiado"). From what he says, the session follows the
  thread, asks open questions in plain chat where something is missing ("¿quién lo va a usar primero?"), explains why
  each thing matters for the plan, and says in a line, every so often, what it has understood and what comes next.
  He can answer at any length, change his mind, ask back ("¿y por qué no X?") or think out loud; there are no
  options to tap in this part.
- **It deduces** (S12: "entender y descifrar lo que quiere el usuario"). It does not wait to be told what it can read
  from the conversation and the repository: the kind and the size, the developer's level in each layer (from how he
  talks about it, as L10 first proposed), the outcome, the constraints. Each deduction is written down with the words
  it came from (D7) and shown to him in the summary below; none is final before he confirms it.
- **It covers the eleven topics**, each a checkbox under `## Interview`. They are what the conversation must have
  covered, not questions to read out in order. The areas of `## Advice` (D10) come after topic 7, because scope, order
  and risks depend on what was decided:
  1. What the project is, for whom, and its kind: one or more of the profiles' kinds (D9), or `other` with the nearest
     kind. Sets `Kind`.
  2. Its size: small (only what is needed) or large (S6). Sets `Size`, which chooses the areas and the bar.
  3. The developer's level in the kind's areas, grouped by layer (for a platform: back end, front end, data,
     delivery). Sets `Level` (S3: "si el desarrollador del proyecto sabe que hacer" or "es un programador muy
     junior"). "ya sé esto" at any moment raises one area's level at once (D11).
  4. The outcome that makes it worth doing: how the owner will know it worked.
  5. What exists today: code, data, users, deadlines (confirming `## What exists`); with code, each area of the kind
     is marked keep, migrate or contain, and the advice of D10 starts from that.
  6. Decisions already made: stack, hosting, services, the language of the product and of its artifacts. Each one
     that settles an area is kept as the owner's decision (D10).
  7. Constraints and their reasons: money, time, legal, data, machines.
  8. In and out of scope for the first usable version.
  9. What the owner decides alone (spend, irreversible steps, product choices), and the steps only he can take
     (accounts, domain, store fees, payment providers), each with its cost as read at that moment.
  10. Order: what must come first, and what can wait.
  11. Risks and unknowns; each unknown becomes an open decision or a research item with a named question.
  A topic is checked `answered (L<n>)` when he said it, `deduced (L<n>)` when the session read it from the
  conversation (the Log line names what it was deduced from), or `unknown (OD<n>)`.
- **The summary, then a few deepening questions** (S12: "ahi si por ultimo hace unas pocas preguntas para ahondar
  mas"). Once every topic and area is covered, the session writes one summary in the chat: what it understood, what it
  deduced and from what, and its recommendation for each area in a line (D10). Then it asks only the questions that
  are still worth asking, one at a time through the question tool, with the recommended option first:
  - the real forks the conversation left open, where the plan would differ by his answer;
  - the deductions it is least sure of, and any of the five that the plan needs (topics 1, 2, 3, 4 and 9) that he
    did not say himself;
  - nothing he already said, nothing the repository answers, and nothing that a recommendation he can change at the
    pre-plan approval settles well enough.
  Usually three to seven; never a form. Each answer is logged verbatim and checks or corrects what it covers.
- **Where the questions go.** In a new project no build lead runs yet, so the plan orchestrator talks with the owner
  directly. Where a lead already holds the project, the conversation runs in the plan orchestrator's own chat, which
  the owner opens. Only the deepening questions go through the lead (`js-harness-orchestrator`, "Questions to the
  user"), each carrying its context in its text. One session holds the onboarding.
- **`## Setup`** (formats in D6): `Kind`, `Size`, `Level`, `Teaching`, `Mode`. The template writes `- Mode: full` and
  a bare `- Teaching: on`, which D6's format does not accept, so stage 2 stays current until the opening is logged
  and the line reads `Teaching: on (L<n>)`. `Level` is written once the conversation has shown it, and completed in
  the same commit that pastes `## Advice`: each area takes the level of the layer it belongs to, and an area of no
  layer (cost, legal, team and timeline) takes `some` unless he said otherwise. A change to `## Setup` is committed at
  once, apart from the rhythm of D7, because a lost teaching or mode choice would be asked again (L12); it is rare.
- **It ends when** every topic is checked, every area carries its proposal (D10), the summary is given and its
  deepening questions are answered. Topics 1, 2, 3, 4 and 9 cannot stay unknown, and stay unchecked while only
  deduced and not confirmed: by his words, or by a deepening question. Something said later that changes a covered
  topic or area unchecks it, and the conversation takes it up again.
- **How long**: as long as the conversation he wants. The questions are the few of the end; the advice of the areas
  is explained, not asked (D10), and confirmed at the pre-plan approval. "fácil y rápido" is open at every turn.
- His words are logged in his language, with the date: each message that settles something, as an excerpt verbatim;
  everything else follows topic 6's artifact language. The conversation, lessons included, is in his language.

### D4. What the pre-plan holds (`docs/origin.md`)
The sections of js-harness's own origin, with three added at the top: a status note (frozen once onboarding closes;
later changes go to the roadmap), Goal, Why, What exists (with the read stage's evidence), Decisions already made (a
table, each with the owner's words and date), **Stack and architecture** (v4: a table `Area | Decision | ADR`, one row
per decided area of `## Advice`, then the architecture as `A:architecture`'s ADR decided it: its modules or parts and
the boundaries between them; for a small project, one line naming the non-core areas left out and why, so nothing is
dropped silently), **Owner steps** (v4: topic 9's steps and their costs), Principles of this project, Phases (Goal, Done
when), Not built (what the installed stack already does), Risks (v4: each ADR whose docs could not be read, D12),
Open decisions (`OD<n>`, asked one at a time), Sources (the interview's dated answers, research links). Research for a
named unknown may run here, with its sources; none runs without a named question. The ADRs themselves live in
`docs/adr/` (D12), never in this frozen file (L12).

### D5. What the plan holds (`docs/ROADMAP.md`)
Its `## Checklist` is what `progress` parses, unchanged. Around it, a stricter shape than js-harness's own roadmap,
which grew before this check existed and is not held to it:
- A header naming the three documents (this file is the plan, `origin.md` where it came from, `odd/tasks/` one
  feature each); what comes next is read under `## Next`.
- `## Principles` and `## Decided`, carried from the pre-plan; v4: `## Decided` is `Area | Decision | ADR`, one row per
  accepted ADR of an area, so the living list of decisions is here and the reasons in `docs/adr/`.
- `## Advice mode` (v4, D13): one line in the format of D6, copied from the onboarding's `## Setup` when the roadmap is
  written; after that the roadmap's line is the one that counts, and it changes when the owner asks (D13).
- **The bar** (v4): the profile's bar targets for the project's size become steps of the first build phase, as
  `onboard profile --checklist bar` prints them, each tagged with its ID: `- [ ] B:<id> <what is measured, where, and
  the command or tool that measures it>` (for example `- [ ] B:web-vitals-lab Lighthouse CI on every pull request
  holds LCP, CLS and TBT under their budget`). The phases after it name the project's check command in their Done
  when, which from then on runs those measures. For research and data analysis, where no build tool exists, that
  first phase writes a check script (`scripts/check` or the project's own) that tests the plan's own bar (the research
  plan's sections, the search log, a data card per source, a clean rerun), so the Done when commands test something
  real and are never invented (L12). A target of an area left `open (OD<n>)` goes under `## Open decisions` with
  that OD instead of the Checklist.
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

### D6. `onboard check`, and the formats it reads
A static check; it never runs a command. Each finding is one line naming the file, what is wrong and the stage it
sends the work back to; it exits 0 with none, 1 otherwise. The lib stays free of the file system: `checkOnboarding`
and `currentStage` take the ADRs as `adrs` (a `Map` of path to text) and the profiles as `profiles` (the data by
default, a fixture in tests), so a change to the data never breaks the lib's tests.

**Formats**, each a literal line; `<...>` is filled, everything else is fixed:
- `## Setup`, one bullet each, `^- (Kind|Size|Level|Teaching|Mode): (.+)$`:
  - `- Kind: platform` · `- Kind: platform, multiplatform-app` · `- Kind: other (nearest: platform)` · `- Kind: other
    (nearest: none)`
  - `- Size: small (L5)` or `- Size: large (L5)`
  - `- Level: A:backend experienced, A:frontend new, A:data some (L6)`: every area of `## Advice`, each `new`, `some`
    or `experienced`
  - `- Teaching: on (L2)` or `- Teaching: off (L9)`
  - `- Mode: full` or `- Mode: fast (L11)`; `fast` must name a Log line
- `## Advice`, one checkbox per area, `^- \[( |x)\] (A:[a-z0-9-]+) (.+?)(?: — (.+))?$`, as `--checklist advice` prints
  it, `- [ ] A:frontend Front end and UX`. Once settled, ` — ` and one of:
  - `proposed, ADR-0004 (L14)`: deduced and explained, confirmed at the approval
  - `asked, ADR-0005 (L18)`: settled by a deepening question
  - `the owner's, ADR-0002 (L7)`: his own decision, deepened
  - `open (OD3)`: he decides later
  - `default, fast, ADR-0009 (L20)`: fast mode only
  - an area reopened before O6 is unchecked again and loses its suffix
- **Fast mode's given-up line**, under `## Advice`, after the areas: `- Given up (fast, L20): <the bar IDs and the
  depth left out>`.
- **`## Advice mode`** in the roadmap: `Teaching: on · Mode: full · Level: A:backend experienced, A:frontend new`.
- **Hashes**, as `onboard hash` prints them and the tasks record them, `(<name> sha256:<12 hex>)`:
  - `answers`, over `## Interview`, `## Advice` and the `Kind` and `Size` lines of `## Setup`. It replaces v3's
    `interview`, which reads only `## Interview`: no project was onboarded with v3, and a v3 document simply finds
    stage 3 current again.
  - `adrs`, over every `docs/adr/*.md`, sorted by path, each path and text.
  - `Teaching`, `Mode`, `Level`, fast mode's given-up line and the roadmap's `## Advice mode` section are left out of
    every hash on purpose (D2): the `roadmap` hash is taken over the file without that section, so a teaching or
    level change between O4 and O6 reopens nothing either.
  - An ADR is named everywhere as `ADR-<nnnn>`, four digits, which is the file `docs/adr/<nnnn>-<slug>.md`.
- `O2` records `answers`; `O3` records `origin` and `adrs`; `O5` records `roadmap`, `origin` and `adrs`.

**What it checks**:
- **The onboarding document**: the eleven topics checked, topics 1, 2, 3, 4 and 9 answered; `O3` and `O5` checked,
  each with its hashes matching and a Log line; `## Reviews` holds a round for each of the two reviews.
- **The setup and the advice** (v4): `## Setup` holds its five lines in the formats above, `Kind` naming kinds of the
  profiles or `other` (until `O6` closes), every `Level` area listed. Until `O6` closes, the areas under `## Advice` are exactly the set
  `--checklist advice` prints for that `Kind` and `Size`; after it, the set is no longer compared, so a later release
  that changes the profiles never turns a finished onboarding red. Every checked area carries one of the five
  suffixes, `default, fast` only with `Mode: fast`.
- **The ADRs** (v4): each ADR an area names exists and names that area; each has at least one source line in a form
  of D12, a `profile:` source only with `Mode: fast`; each ADR under `docs/adr/` belongs to a listed area or is marked superseded or withdrawn; a `not read`
  source has its ADR named under the pre-plan's `## Risks`.
- **The pre-plan**: its required headings, `## Stack and architecture` with one row per decided area, and
  `## Owner steps`.
- **The roadmap**: `parseRoadmap` finds at least one phase, each with at least one step; every Checklist phase has a
  `## Phases` row of the same name, and the other way round; every pre-plan phase is a roadmap phase; every Done when
  cell holds a command in the contract's form; `## Next` exists; every `OD<n>` still open in the pre-plan appears in
  the roadmap's Open decisions. v4: `## Decided` names every accepted ADR of an area; `## Advice mode` is in the
  format above (its values are not compared, D2); until `O6` closes, every `B:` ID `--checklist bar` prints for the `Kind` and `Size` is
  on a Checklist step, under `## Open decisions` with its area's OD, or named in the given-up line.
- **`--plan`** (stage 5) runs the roadmap's rules, the v4 ones included, reading the onboarding document for `Kind`,
  `Size` and the given-up line, so a missing `B:` step is found before the readers, not at Close.
- **`AGENTS.md`**: the roadmap line, and none of `agentsTemplate`'s placeholder lines left.

It proves structure and ties, as v3's does: that an area was advised and sourced, never that the advice is good. The
readers and his two approvals stand for that.

To share one rule with the contract, `bin/lib/contract.mjs` exports a helper that finds a done-when command in a
string, and `bin/lib/progress.mjs` exports its pipe-aware table splitter. A `check` row for it is left for later,
once a project has used it.

### D7. Where it is stored, and how a later session resumes
- **The onboarding itself**: `odd/tasks/onboarding.md` in the new project, written from `onboard template feature`:
  the contract head (Goal: an approved `docs/ROADMAP.md`; Done when: `` `js-harness onboard check` exits 0``),
  `## What exists`, `## Setup` (v4), `## Interview` (eleven topics), `## Advice` (v4, empty until stage 2 fills it),
  Tasks `O1`-`O6` (read, pre-plan written, pre-plan approved, plan written, plan approved, closed), `## Reviews` and
  a Log with each answer and each yes or no verbatim, plus the session's own lines marked `(session)`. ODD's engram
  mirror holds a copy; `progress` counts it as a feature.
- **What would live only in the chat** is logged: each deduction as a `(session)` Log line with the words it came
  from, and each area's explanation as one with its recommendation and sources, so a compaction resumes the same
  conversation, not a new one.
- **Committed after every stage, every three settled items in the conversation, and at once for `## Setup`**, on the branch
  `onboarding`: desktop sessions each run in their own worktree, and only what is committed reaches the next one.
  Each commit runs the project's gate, so a commit per answer would make him wait on every tap; a cut loses at most
  two settled items, and `onboard` names the uncommitted ones. When `onboard` finds no document on this branch, it looks
  for one on any local or remote branch (`git log --all -- odd/tasks/onboarding.md`) and prints "onboarding in
  progress on branch X" with the way to resume: where `git worktree list` shows the branch checked out in another
  worktree, it names that folder; otherwise it prints the command that creates a branch from it here.
- **The result**: `docs/origin.md` (frozen once closed), `docs/adr/` (living: a later decision supersedes an ADR with a
  new one) and `docs/ROADMAP.md` (living), merged by the owner (stage 8). The pull request touches `AGENTS.md`, so it
  is not documentation-only: it merges under the project's own rule, and where the project has no CI run yet, by the
  skill's rule for that case (`bin/lib/manifest.mjs:122`).
- **Every session after**: Close fills `AGENTS.md` outside the harness block: "What this project is" from topic 1,
  "Constraints" from topics 6, 7 and 9, the checking command in "How it works", and one line, `The plan is
  docs/ROADMAP.md: a session starts there, and each feature's state is in odd/tasks/.` `init`'s template stays
  unchanged, so no other project's block hash moves. The Close stage's output (`bin/lib/onboard.mjs:535`) is renumbered
  to match.
- **Undo**: everything is a file in the repository, undone by git; nothing goes in the project manifest, so
  `uninstall` never deletes the plan.

### D8. Edges
- A project with a plan of its own (`docs/ROADMAP.md` or `docs/origin.md`, and no onboarding document anywhere):
  onboard writes nothing and runs no check; it prints which file is there and that adopting a plan of another shape
  is not supported yet, so the owner moves the file aside to onboard, or keeps his plan. An advanced owner often
  arrives with one (L12): adopting it is a known gap, left for a later version.
- `init` ends with one more line when the project has no `docs/ROADMAP.md`: `next: in a Claude Code or Codex
  session, run js-harness onboard`. `init` never starts the interview itself.
- `onboard` outside an initialized project refuses, like the other project commands, and names `init`.
- `onboard template <feature|origin|roadmap>` prints a skeleton; with `--write` it creates the file and refuses one
  that exists. v4 adds `adr <slug>` (D12).
- In Codex, which has no sub-agents here, the readers are another session, as the protocol says. Where its sandbox
  cannot read the web, the ADR sources are `not read` lines (D12), named to the owner at the approval.
- A change of `Kind` or `Size` before O6 changes the expected set: the areas that leave the set are removed from
  `## Advice` and their ADRs marked withdrawn; new ones are advised as any other.
- Tests (T2, T3): a fixture project per stage; the back-transition of a changed approved file; a no at each review;
  the half-plan of D8; an `## Interview` with fewer than the topics; a renamed task line keyed by its ID; a Close
  whose check fails on the roadmap, sending it back to stage 6; resume from another branch; the awaiting-merge state.
- Tests (T7-T9), each RED first: `--checklist advice` and `bar` per size, for two joined kinds and for `other` with
  and without a nearest kind; each `## Setup` line missing or malformed, and `Mode: fast` with no Log line; each of
  the five area suffixes, and `default, fast` outside fast mode; an ADR missing, of another area, without a source,
  with a `not read` source not named under Risks, and orphaned; the `answers` and `roadmap` hashes ignoring a teaching, level or mode
  change; an ADR edit reopening stage 4; `## Advice mode` malformed; a `B:` step missing, then excused by an open OD
  and by the given-up line; the stage-2 tests of D15; a
  changed `Kind` recomputing the set; the set no longer compared after O6; `template adr`'s numbering, its exclusive
  create, and a slug refused; the new argument errors; the skill's paragraph (`bin/lib/manifest.test.mjs`); the
  Onboarded handoff text. The testkit's complete fixtures gain `## Setup` and `## Advice` from a fixture profile.

### D9. The profiles as data (`bin/lib/profiles-data.mjs`)
The profiles live in `bin/` because only `bin/` ships, as data like `bin/lib/rules-data.mjs`, and reach the session
through the command's output, one piece at a time, never as a skill or a per-turn load.
- **Areas are global**, one definition per ID (`A:frontend`, `A:architecture`): title, what it decides, what to
  teach at each level (D11) as an outline the session turns into the lesson, its pitfalls, and `after` (the areas it
  depends on, so they are advised in order: hosting after the stack, CI after the tests).
- **Each kind**, the eleven of S8: `static-site`, `platform`, `multiplatform-app`, `data-analysis`, `research` (S3's
  five), `cli-library`, `api-service`, `ai-app` (the three of the second option he took too), `tui-app` (S8:
  "agregale TUI"), `pre-project` (D14), and `other` (S8: "nos sirve para todo": any kind without a profile, advised
  through the common areas and its nearest kind). Each has its `id`, its title, the default, why, when something else, and its list of areas, each with `core` (true when a
  small project needs it too) and the kind's own default and alternatives for that area. Two joined kinds take the
  union of their areas by ID, core when either says so; where both give a default for the same area, `--area` prints
  both and the session's ADR says which it took and why.
- **Common areas**, in every kind and in `other`: architecture (S4: "de arquitectura"), cost and budget, legal
  (privacy law, consent, license, terms), CI and tests (S4: "de ci and cd"), maintenance after launch, product
  analytics, team and timeline, i18n; architecture, cost, legal and CI core. `other (nearest: <kind>)` takes that
  kind's areas; `other (nearest: none)` takes the common areas only.
- **Each bar target**: `id` (`B:web-vitals-lab`), its area, the target, `core`, how it is measured (lab in CI or field
  in production, said apart: Core Web Vitals at p75 are field data, CI measures lab proxies, L12), the command or tool
  that measures it, and its source: a URL, or "a starting target agreed with the owner" where no standard exists,
  never a bare number. The targets are agreed in their area's question, one line each, and an adjusted target is
  recorded in the ADR.
- **`onboard profile`**: with no argument, the kinds; `onboard profile <kind>[,<kind>]` prints those kinds (default,
  why, something else when, the areas and bar of both sizes); `--area <id>` prints one area, for the kinds named;
  `--checklist advice|bar` prints the `## Advice` lines or the `B:` steps; joined kinds merge bar targets by ID, as
  areas. `--area` and `--checklist` together, or `--checklist` with no kind where the onboarding document or its
  `Kind` or `Size` is missing, is a usage error that names what is missing. With no kind given, `--area` and
  `--checklist` read `Kind` and `Size` from the onboarding document, so the session never retypes them. Tool names
  in the data are starting points the session checks against current docs (D12), never the advice itself.
- **A shape test** holds every kind to the same parts as the static site's (L11): global IDs unique, `after` naming
  existing areas without a cycle, every common area in every kind, at least one core bar target per kind, a source
  and a measuring command on every target.

### D10. The advice: explained in the conversation, confirmed at the approval
S12 moves the advice out of a question per area: the session explains each area and its recommendation in the
conversation, writes it down as a proposal, and the owner confirms them all, or changes any, when he approves the
pre-plan. For each area under `## Advice`, in `after` order:
- **It prepares**: runs `onboard profile --area <id>` and reads the current docs and release notes of what it will
  recommend.
- **It explains** (S11), in the conversation, when the thread reaches that area or in the summary: what the area
  decides, its recommendation and why, at the depth of the developer's level in it (D11), the sources it read, what
  is given up with each alternative, and the area's bar targets. It is as long as the level needs, written to be read
  on a phone in short paragraphs. With teaching off, it is two or three lines. He can react in his own words, and a
  reaction that changes the recommendation is logged.
- **It writes the proposal**: the area's ADR (D12, status `proposed`) and its line under `## Advice` with one of D6's
  suffixes: `proposed` (deduced and explained), `asked` (settled by a deepening question), `the owner's` (his own
  decision), `open` (he decides later) or `default, fast`.
- **The reviewed text it rests on** (S10): the explanation names its profile area (`bin/lib/profiles-data.mjs`,
  `A:<id>`), and says so when its recommendation departs from it. Each profile passes the two readers once, when slice
  3 writes it. Every ADR passes the stage-4 readers before his approval of the pre-plan makes the proposals binding.
- **The confirmation is the approval** (S12): the stage-4 summary lists every area in one line, its proposal and its
  ADR, so his yes accepts them all. A no on one area is logged, and D15 says what it changes.
- **An area the owner already decided** (topic 6) is kept as his decision and deepened, not replaced (S3: "sabe que
  tecnologico escoger por ejemplo el stack mern entonces lo guia super avanzado"). Its ADR records how to do it well,
  and the session raises it in the conversation only when a sourced risk makes the choice worth reopening.
- **An existing repository** starts from topic 5's keep, migrate or contain for the area.
- **Every area is advised** whatever the developer knows: a backend developer still gets the front end, the
  architecture and the CI explained (S4).
- **Reopening an area** before O6: its line is unchecked, a new ADR supersedes the old one, and it is explained again.
- **Size** (S6) chooses the areas: small lists only the core ones, each still advised in full; large lists them all.

### D11. Level, teaching and the fast plan
- **Level**: per area, `new`, `some` or `experienced`, in `## Setup`'s `Level` line. It sets depth and tone, never
  coverage (L10). `new`: the concept first, what it is and why it matters, then the recommendation (S3: "lo vas a
  guiar a enseñar y darle el criterio de acompañamiento de por que hacerlo"). `some`: the why and the alternatives.
  `experienced`: tradeoffs, pitfalls at scale, and his own choice challenged with sources (S3: "lo guia super
  avanzado"). "ya sé esto" raises that area at once, logged.
- **Teaching** is on by default and is announced in the opening (S4: "siempre enseñes y des la opcion al
  usuario a desactivar la enseñanza"). "sin enseñanza" turns it off at any turn, takes effect at once, and is
  committed in `## Setup` right away; then each explanation gives the recommendation and its why in one line, the
  alternatives in one line each. It can be turned back on the same way. Neither reopens an approval (D2).
- **Fast mode** only when the owner asks for it (S4: "a menos que el usuario te indique lo contario osea de que no
  quiere aprender y de que solo quiere hacerlo facil y rapido"): one message proposes every remaining area's profile
  default at once (confirmed at the approval, as any proposal), names once what is given up (depth, measures, the bar targets left out), records `Mode: fast` with
  his words and the given-up line. Its ADRs are brief and may cite the profile itself as their source (D12), so fast
  mode reads no docs. Areas already settled stay as they are; "completo" returns to full mode for the areas still
  open. The two readers and both approvals still run in fast mode (S12: "Si").

### D12. Decisions as ADRs, with their sources
- `onboard template adr <slug>` prints the skeleton; with `--write` it creates `docs/adr/<nnnn>-<slug>.md`, `<nnnn>`
  the highest number there plus one, four digits, with exclusive create (two sessions racing for one number: the
  second is refused and runs it again). The slug must match `^[a-z0-9]+(-[a-z0-9]+)*$`, so no path can leave
  `docs/adr/`. The skeleton: Status (`proposed (L<n>); accepted with the pre-plan (O3)`, a fixed text so the approval edits no ADR; later `superseded by ADR-<nnnn>` or `withdrawn`), Area
  (`A:<id>`), Context, Decision, Alternatives considered (each with why not), Consequences (what is given up
  included), Sources, and the owner's words where the decision is his.
- **Sources**, one per line, in one of three forms:
  - `- <URL> — <what it says> (version <v> where there is one, read <YYYY-MM-DD>)`
  - `- profile: <kind> A:<id> (js-harness <version>)`: fast mode only
  - `- not read: <why> (<YYYY-MM-DD>)`: when the docs could not be read (no network, no docs exist, as for some legal
    or cost areas); the pre-plan names that ADR under `## Risks`, so the owner sees it at the approval
- Advice ages through names and maintainers as well as versions (L12: Auth.js is maintained by the Better Auth team
  since 2025-09-22), so each ADR records what was true on the day it was read; the profile only says where to look.
- ADRs live on after the onboarding: a later decision writes a new ADR that supersedes the old one, and the roadmap's
  `## Decided` follows.

### D13. The handoff to the build orchestrator, and teaching after it
- **Handoff** (S3: "cuando se crea el roadmap y todo el plan completo ahi si entra la sesion orquestadora a
  construir"): the plan orchestrator was the onboarding's work session; the build orchestrator is a new lead session,
  because the lead owns no feature and starts with a clean context (`bin/lib/manifest.mjs:83`). The Onboarded state
  prints that the plan orchestrator's work is done, the roadmap's `## Next`, and the lead's opening prompt as the
  skill already gives it (`bin/lib/manifest.mjs:158-162`), so the two never drift apart. That prompt assumes an
  orchestrator before it; slice 5 adds the first lead's case to the skill: with none before it, the lead starts from
  the roadmap and the board.
- **Teaching after it** (S7: "En el onboarding y en la sesion orquestadora"): the lessons reach the owner in the
  orchestrator's chat, where every question of the project reaches him. The lead does not write them: it never
  discusses a design (`bin/lib/manifest.mjs:117`, `:127`), and the questions are written by the work sessions
  (`notify --kind question`, `:98`). So the skill gains one paragraph under "The lead" and one line under "A work
  session":
  - a work session that puts a decision to the owner reads the roadmap's `## Advice mode`; with `Teaching: on` it
    writes the why into the question's text at the level recorded there, and names the ADR of an area the decision
    touches; it teaches nowhere else;
  - the lead shows that text unchanged; when the owner says "sin enseñanza" or "ya sé esto", it takes effect at once:
    the lead sends a one-line notice to the open work sessions, carries it in the opening prompt of any work session
    it opens before the roadmap holds it, and the work session that next changes the roadmap
    writes it into `## Advice mode` (the lead never commits, `:117`);
  - nothing goes in `AGENTS.md` (L13).
- **Risk**: the skill is installed per home for both hosts (`bin/lib/manifest.mjs:204-213`), so the paragraph reaches
  every project on the machine. It is high-risk item 3 (a contract others consume), worded so that a project with no
  `## Advice mode` sees no change; slice 5 carries that Risk line and gets an independent verifier.

### D14. The pre-project kind: research that ends in an application's roadmap
S8: "si no quiero hacer proyecto de una sino una investigacion o analisis de mercado por ejemplo para armar un pre
proyecto de una aplicacion complete especifica para un sector de negocio y desde ahi armar todo el roadmap completo a
partir de investigacion y analisis y ademas de discusion y criterio".
- **What it is**: a project whose product is the decision and the plan of an application, not the application. It
  takes the research kind's method (a plan before any search, sources judged, the evidence against reported) and
  aims it at one business sector.
- **Its areas**: the sector and its market (size shown with its assumptions), the users and their problem (interviews
  or other evidence, not opinion), competitors and substitutes, the business model and its numbers, the sector's
  regulation, the application's concept, and the decision criteria; plus the common areas.
- **Its roadmap**: phases of research and analysis, then a phase of discussion where each finding is weighed against
  the criteria (S8: "discusion y criterio") and the owner decides whether to go ahead, change course or stop, recorded
  as an ADR with its evidence. The last phase writes `docs/brief.md`: the findings, the decision, and the
  application's kind, scope and constraints.
- **The application's roadmap**: built by onboarding the application with that brief as its input. The application
  lives in its own repository, so D8 never meets the pre-project's own plan: its stage 1 reads the brief, and its
  interview only confirms what the brief answers (D3, "read before asking"), so most topics and many areas arrive
  answered and sourced. A pre-project's onboarding therefore plans the research; the research then feeds a second,
  short onboarding that writes the complete roadmap S8 asks for.
- **Its bar**: every claim in the brief carries its source, market figures show their assumptions, user claims come
  from recorded evidence, and the go or stop decision names the criteria it was judged by; the first phase's check
  script tests that.

### D15. The conversation, in files
What D3 and D10 do in the chat, written where `onboard` reads it (D2: nothing about the stage lives in the
conversation). Added after the readers of 9de068be.
- **Topic lines**, `^- \[( |x)\] (\d+) (.+?)(?: — (.+))?$`, settled with one of `answered (L<n>)` (he said it),
  `deduced (L<n>)` (the session read it; the Log line names the words it came from), `confirmed (L<n>)` (a deduction
  he confirmed) or `unknown (OD<n>)`. A non-required topic is checked when `deduced`. A required one (1, 2, 3, 4,
  9) is written unchecked with `deduced` until he confirms it, and `check` refuses a checked required topic that is
  not `answered` or `confirmed`.
- **The summary line**, a fixed last item of `## Interview`: `- [ ] S Summary given and deepening questions answered`,
  checked with the Log line of the last answer. Stage 2 stays current until it is checked, and the `answers` hash
  covers it. Before the summary and before each deepening question, a `(session)` Log line records it (the question
  with its options and the item it settles), so a compaction asks the same question, not a new one.
- **The advice is listed early**: `## Advice` is pasted once `Kind` and `Size` are in `## Setup`, deduced values
  included, so the conversation can reach each area. A later change of `Kind` or `Size` recomputes the set (D8).
- **Stage 2's output**, renamed "Conversation and advice", prints in one go: the topics and areas not yet covered, the
  deductions still waiting for his confirmation, and the next step, one of: paste `--checklist advice`; explain an
  area (`profile --area`); give the summary; ask the next deepening question. It ends with "commit every three settled
  items, and at the summary", and the covered line: "covered: 7 of 11 topics, 3 of 8 areas".
- **Commits** also follow each batch of three `(session)` deduction lines and the summary, so a long conversation that
  settles nothing yet still survives a cut.
- **A no on one area at the approval**: before `O3`, the ADR is edited in place, keeping its number. Its status
  becomes `proposed (L<the no>)` and the area's suffix `the owner's, ADR-<nnnn> (L<the no>)`. That changes the
  `answers` and `adrs` hashes, so stages 3 and 4 repeat: the pre-plan is revised, and the readers' second round reads
  the change. An ADR is superseded only after `O3`.
- **Accepted ADR**: one named by a checked area, neither superseded nor withdrawn, once `O3` is checked. That is what
  D5's `## Decided` and D6 mean by "accepted". An owner's own decision's status reads `decided by the owner (L<n>)`.
- **Codex** has no question tool: the deepening questions and the approvals are asked in plain text, one at a time,
  with numbered options and the recommended one first.
- **Through a lead** (a project that already has one): the owner may only see the lead's chat. So the deepening
  questions and both approvals go through the lead. Each carries its explanation in its text, and an approval
  carries the area lines. Each answer is logged verbatim from the transcript (`js-harness sessions --quote`), never
  from the lead's notice. The conversation itself happens in the plan orchestrator's chat when he opens it, and
  otherwise in the relayed questions' text.
- **The approval on a phone**: the area list goes in a chat message, or in the relayed text, right before a short
  question. The question stays at about ten lines, and the per-area table sits at the top of `docs/origin.md`'s
  `## Stack and architecture`.
- **Tests (T8)**: a checked required topic marked `deduced` is refused, and `confirmed` is accepted; stage 3 waits for
  the summary line; `Kind` and `Size` trigger the checklist step; the covered line; each stage-2 next step; a no on
  one area editing its ADR in place and sending the work back to stage 3; the stage renamed.

### Cost
Built (slices 1-2): 836 lines of code and 726 of tests (`wc -l`, 2026-10-20). v4 to build:
- Slice 3 is mostly data and more than one slice: global areas with three-level teaching outlines, eleven kinds (S8),
  and sourced bar targets, which needs web reading while it is written. The six profiles beyond the drafted five
  are written to the same depth (L11) in slice 3 itself. It is forecast from the first kind (static site) before the
  rest are written and split by kinds, about three slices: 3a (shape, command, common areas, static site, platform,
  multiplatform app), 3b (data analysis, research, pre-project), 3c (CLI or library, API service, AI app, TUI app).
- Slices 4 and 5: about 400-500 authored lines each with tests.
- One gate per commit, one gentle-ai and one Codex review per slice, an independent verifier for slice 5, then T4's
  real onboarding.
Using it in a project: one session of conversation and a few deepening questions, the docs read for each area, and two readers twice
(pre-plan with its ADRs, plan), on the reader model the rules give.

### What v4 leaves out, and why
- A worked example origin and roadmap per kind (L12, item 10): T4's real onboarding produces the first; one per kind
  would be five more onboardings, so they are a later roadmap step.
- Profiles of their own for kinds past S8's eleven (e-commerce, internal tool, browser extension, desktop app, game,
  ML training): `other` advises them until then. Adopting an existing plan (D8): a later version.

### Product decisions left for him
Asked one at a time through the lead, after the readers; each is recorded here with his answer.
- **OD-K** Which kinds ship in the first build. Recommended: the five he named in S3 plus `other`, which advises the
  common areas and borrows the nearest kind's; the kinds L12 found missing (CLI tool or library, API service, AI or
  LLM app, e-commerce, internal tool, browser extension, desktop app, game, ML training) go on the roadmap as
  later profiles. The alternative is adding the three most common of them (CLI or library, API service, AI app) now,
  at about one more slice. **Answered (S8, 2026-10-20)**: both, plus a TUI app and a pre-project kind (D14), and
  `other` for everything else: eleven kinds in all (D9).
- **OD-T4** Which project the real onboarding of the done-when runs on, now that S3 rules out a test project. **Answered
  (S9, 2026-10-20)**: two trials, a static website in Astro and a platform pre-project whose documents plan a
  complete platform (T4).
- **OD-R** `rule:double-review` is his rule: a plan or design put to him first passes two readers, unless the
  question names its reviewed text by path. Each area question (6 to 16 of them) puts a choice to the owner. v4's
  proposal: the profile data passes the two readers when slice 3 writes it, each area question names its profile area
  as the reviewed text, and every ADR is read by the stage-4 readers before the approval that makes the decisions
  binding. The alternative is two readers before each area question, which multiplies the onboarding's reader cost
  by the number of areas. **Answered (S10, 2026-10-20)**: once per profile, as proposed.
- **OD-F** (answered, S12: readers and approvals stay; the rest of S12 reshaped D3 and D10) Whether fast mode ("solo quiere hacerlo facil y rapido sin importar tanto la calidad", S4) still runs the
  two reader rounds and both approvals. v4 keeps them: the approvals are the owner's only checkpoint on the plan, and
  the readers cost two rounds. The alternative drops the readers in fast mode and keeps the two approvals.

## Reference profiles
Draft by the lead (2026-10-20) for S5, with L12's corrections applied in v4; slice 3 turns it into
`bin/lib/profiles-data.mjs` (D9), where each area and target gains its ID, `core` flag and source. One profile per
project kind: the default the
advisor proposes, why, when it proposes something else, the bar the project must measure, and the areas it teaches
(S4: all of them, unless the user turns teaching off or asks for fast and easy). Versions are left out on purpose:
at advice time the session reads the current docs and release notes and cites them (vision point 5), so a profile
never ages into stale advice. The advisor may depart from a profile, saying why; the profile is the floor, not the
ceiling.

- Static site (landing, portfolio, blog, docs, marketing):
  - Default: Astro, static output; content collections for the content, `astro:assets` for images; islands only where
    a component needs JavaScript. For docs, Starlight (built on Astro). Hosted on a static CDN (Cloudflare Pages,
    Netlify, Vercel or GitHub Pages).
  - Why: it ships zero JavaScript by default, so the page is fast before anyone optimizes it; content is typed.
  - Something else when: the "site" is really an app behind a login (see Platform), or a CMS-driven site with heavy
    editors (Astro plus a headless CMS, still static where it can be).
  - Bar, in CI on every pull request (lab): Lighthouse LCP, CLS and TBT under budget, and performance, accessibility,
    best practices and SEO >= 95 on the key pages; a JavaScript budget per page (none on pure content pages); images
    in AVIF or WebP with explicit sizes. In production (field, once there is traffic): Core Web Vitals "good" at the
    75th percentile (LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1), read from real-user data. CI cannot measure field
    data; TBT is its lab proxy for INP (L12).
  - SEO: semantic HTML, one h1, titles and meta descriptions per page, canonical URLs, sitemap and robots.txt,
    Open Graph and social cards, internal links, no broken links (checked in CI).
  - AEO (answer engines, featured snippets): content that answers a question in its first paragraph, question-shaped
    headings, schema.org JSON-LD (Organization, WebSite, Article, BreadcrumbList; FAQPage only where the content truly
    is one, and without promising rich results: Google limited FAQ and HowTo rich results in 2023-08 and deprecated
    HowTo on 2023-09-13; secondary sources report FAQ rich results ended for all sites on 2026-05-07, to be checked
    against Google's FAQPage documentation when slice 3 writes this profile).
  - GEO (generative engines): clear entities and facts with sources, author and date on content, structured data,
    pages an AI crawler can read without JavaScript; llms.txt only as an emerging, optional convention, said as such.
  - Teaches: accessibility (WCAG AA), performance budgets, analytics that respect privacy, CI with preview deploys.
- Platform (web app with accounts and data):
  - Default: TypeScript end to end. Front end: Next.js when public pages must rank and load fast, React with Vite when
    everything sits behind a login. API: typed calls inside one TypeScript codebase (tRPC or server actions), REST
    with an OpenAPI contract when others consume it. Data: PostgreSQL, schema and migrations through an ORM (Drizzle
    or Prisma). Auth: a maintained library or provider (Better Auth, Clerk, Auth0; Auth.js is maintained by the Better
    Auth team since 2025-09-22, which recommends Better Auth for new projects, L12), never hand-rolled.
    Jobs: a queue for anything slow. Hosting: a managed platform plus managed PostgreSQL.
  - Why: one language and one type system from database to screen; a relational store fits most business data and
    keeps it consistent; authentication is the riskiest code to write, so experts write it.
  - Something else when: the team already knows a stack. If they say MERN (S3's example), the advisor deepens MERN
    instead of replacing it: MongoDB schema validation, indexes per query, transactions where money or stock moves,
    Express organized by feature. The same for Django, Rails or Laravel teams. Also when data is truly
    document-shaped, or when real time is the core (then WebSockets or a realtime service from day one). The reason
    is recorded as an ADR in `docs/adr/` (D12).
  - Bar, starting targets agreed with the user and measured in CI or production:
    - Speed: API reads p95 <= 300 ms; Core Web Vitals "good" on public pages.
    - Tests: unit tests on business rules, integration tests against a real PostgreSQL (Testcontainers), end to end
      with Playwright on the main journeys; all on every pull request with lint, typecheck and build.
    - Delivery: a preview deploy per pull request; production deploys only from main through CI; migrations reviewed
      and reversible; dependency updates automated (Renovate or Dependabot).
    - Reliability: backups with a restore actually tested; an SLO and an error budget once there are users.
  - Architecture: modules by feature (screaming architecture); business rules in a domain layer with no framework in
    it; the database and outside services behind ports and adapters; one ADR per decision in `docs/adr/` (D12).
  - Security: OWASP Top 10 and ASVS level 1 as the checklist; input validated at every boundary (Zod or equivalent);
    rate limits on auth and public endpoints; secrets in a secrets manager, never in the repository; least privilege
    for the database user.
  - Observability: structured logs, metrics and traces with OpenTelemetry, error tracking (Sentry or equivalent), all
    from the first deploy.
  - Front end and UX (S4: "de fronted"): a component system with design tokens, forms validated with the same schema
    as the API, loading, empty and error states on every screen, WCAG 2.2 AA (keyboard, focus, contrast, labels),
    Core Web Vitals on public pages, and usability checked with real users on the main journeys.
  - Teaches: architecture, API design, data modeling and indexes, front end and UX, accessibility, security, CI/CD,
    observability, cost control.
- Multiplatform app (iOS, Android, maybe web):
  - Default: React Native with Expo (Expo Router; EAS for builds, store submission and over-the-air updates) when the
    team knows TypeScript or React; Flutter when it starts fresh and wants one rendering engine everywhere.
  - Why: one codebase for both stores; Expo takes the native build pipeline off the team's hands; over-the-air updates
    fix JavaScript bugs without waiting for store review.
  - Something else when: the app lives on deep platform features (AR, heavy background work, rich widgets): native
    Swift and Kotlin; shared logic with fully native screens: Kotlin Multiplatform; no store presence needed: a PWA
    (then the Static site or Platform profile applies).
  - Bar, starting targets agreed with the user:
    - Speed: cold start under 2 s on a mid-range Android; lists at 60 fps; an app size budget.
    - Stability: crash-free sessions >= 99.5%, from crash reporting wired before the first beta.
    - Behavior: offline behavior defined per screen; permissions asked in context, at the moment they are needed.
    - Tests: unit tests plus end to end flows (Maestro or Detox) on both platforms in CI; signed release builds only
      from CI; staged rollouts.
  - Accessibility: VoiceOver and TalkBack labels, dynamic type, contrast, touch targets, checked on real devices.
  - Stores and privacy: App Store Review Guidelines and Google Play policies read before design; Apple's privacy
    manifest and Google's data safety form filled from what the app really collects; account deletion inside the app
    when it has accounts.
  - Teaches: release channels and versioning, store review, platform differences, push notifications, privacy law.
- Data analysis:
  - Default: Python with a locked environment (uv); DuckDB for SQL over files and Parquet; Polars for dataframes
    (pandas where a library needs it); notebooks to explore, Quarto for the report; validation at load (pandera or
    equivalent); raw data immutable and every step a script, run by one command (make or just); data versioned by
    hash, or with DVC when it is large.
  - Why: the analysis can be rerun and checked by anyone; DuckDB and Polars handle data far past a laptop's pandas
    limit on one machine; validation stops bad data before it becomes a wrong chart.
  - Something else when: the team works in R (tidyverse and Quarto, the same bar); the data lives in a warehouse and
    the analysis recurs (dbt models with tests); the data does not fit one machine (Spark, rarely needed).
  - Bar:
    - Reproducible: a clean checkout reruns from raw data to report with one command, with the same numbers.
    - Traceable: every number and chart in the report comes from code in the repository.
    - Documented: a data card per source (origin, date, license, how it was collected, known gaps).
    - Sound: the question and the method written before looking at the outcome; a holdout or validation set for any
      model; uncertainty reported with intervals, not only point estimates.
    - Honest charts: labeled axes and units, bars from zero, no truncated scales without saying so.
  - Data handling: personal data minimized, pseudonymized and never committed; access recorded.
  - Teaches: framing the question, data quality, choosing the method, leakage and p-hacking, communicating
    uncertainty to non-experts.
- Research:
  - Default: a research plan before any search, with the question, why it matters, scope, hypotheses or what would
    change the answer, method, sources and how they are judged, what is measured and how, threats to validity,
    ethics and schedule. Tools: a reference manager (Zotero), a search log (database, query, date, results kept),
    preregistration (OSF) for empirical studies, a data management plan.
  - Why: a plan written first keeps the result from bending toward what the researcher hoped; a logged search can be
    repeated and audited.
  - Something else when: the kind of research changes the method.
    - Literature review: PRISMA-style flow (found, screened, included, why excluded).
    - User research: an interview protocol, a sample matched to the question, consent, synthesis by affinity mapping.
    - Experiment: hypotheses, a power analysis for the sample size, the analysis fixed in advance.
    - Market research: sources ranked by reliability, sizing shown with its assumptions.
    - Technical spike: the question, a time box and the success criteria, a written answer at the end.
  - Bar:
    - Measured: each outcome defined and operationalized (what is counted, how, by whom); the sample size justified;
      inter-rater agreement reported when people code data.
    - Valid: internal, external and construct validity threats named, with what was done about each.
    - Cited: every claim carries its source; findings kept apart from opinion; the evidence against reported too.
    - Ethical: consent and privacy handled whenever people take part.
  - Teaches: framing a question, source quality, sampling, bias, reproducibility, writing the result for its reader.

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
- v4 round 1 (2026-10-20), two read-only readers on claude-opus-5-5 at high effort over a8cdc48b.
  - Claims reader: six blockers, fifteen advisories. B1 (a teaching or level change reopened approvals) and B5 (v3
    remnants: nine topics, required 1, 2 and 7, the O2 hash input, Close's topic numbers): `answers` hash without
    `Teaching`, `Mode` and `Level`, every reference renumbered. B2 (ADRs neither hashed nor read): `adrs` hash in O3 and
    O5, the readers read them. B3 (per-area questions under `rule:double-review`): the profile is named as reviewed
    text, and the rule's application is put to him as OD-R. B4 (the lead cannot write lessons): the work session writes
    the why into its question text, the lead shows it. B6 (Platform lacked front end and UX): added to the profile, and
    architecture made a common core area. Advisories taken: team and timeline added; the worked examples left out with
    a reason; a phone summary at each approval; a command on each bar target; HowTo dated 2023-09-13 and the FAQ claim
    marked to check; `## Setup` committed at once; topic 3 required; asking the level justified against L10; `other`
    names its nearest kind; question counts made a range measured in T4; slice 3 forecast from one kind; teaching off
    takes effect at once; open areas' bar targets go under Open decisions; T5 and D8 stale lines fixed.
  - Gaps reader: nine blockers, thirteen advisories. G1 (line formats): D6 now gives each literal format and its
    pattern. G2 (who writes `## Advice`): stage 2's output names `--checklist advice`, and `--checklist bar` is
    separate. G3 and G4: as B5 and B1. G5 (unreadable docs): `not read` sources, named under Risks. G6 (IDs, joined
    kinds, `other`): global areas, a union by ID, a nearest kind. G7 (a release turning a closed onboarding red): the
    set is compared only until O6. G8: as B4, with the roadmap line written by a work session. G9 (CLI grammar, slug):
    specified, slug pattern, `adrs` and `profiles` passed to the lib. Advisories taken: ADRs reopened and superseded
    (G11), the pending question logged (G12), architecture advised (G13), bar targets agreed in the area's question
    (G14), `--plan` reads the onboarding document (G15), the handoff reuses the skill's prompt with a first-lead case
    and the merge rule is named (G16), the skill change carries Risk item 3 and a verifier (G17), fast mode cites the
    profile and can be left (G18), migration and fixture parameters (G19), the tests named (G20), the done-when
    lists the new tests (G21), slice 3's size (G22).
  - Left to him as product decisions: OD-R and OD-F, besides OD-K and OD-T4. Decided in the design, with the reason
    beside each: a new lead takes over (D13); teaching and level changes reopen nothing (D2); finished onboardings are
    not held to newer profiles (D6); unsourced ADRs allowed when named at the approval (D12); a small project names the
    areas it left out (D4).
- v4 round 2 (2026-10-20), both readers over 062cd4d2, each on its own blockers only.
  - Claims reader: B2-B6 closed (B3 by OD-R). B1 still open: `O5` hashed the whole roadmap, whose `## Advice mode`
    the owner may change. Advisories: the out-of-scope line on teaching, a notice that misses a session opened later,
    T7 without OD-R's reading of the data, T8 without D7.
  - Gaps reader: G1-G3, G5, G6, G8 and G9 closed. G4 open for the same reason as B1. G7 open: the `Kind` and `B:`
    rules still read the shipped profiles after O6. Advisories: fast mode's given-up line inside the `answers` hash;
    the `Level` line before `## Advice` exists, and areas of no layer; the bare `Teaching: on` default; how an ADR is
    named and numbered; `profile:` sources outside fast mode; `profile`'s usage errors and joined kinds' bar targets.
  - Taken after round 2: the `roadmap` hash leaves out `## Advice mode` and the `answers` hash the given-up line; the
    profile-reading rules run only until O6; every advisory above.
  - Unguaranteed: these last fixes were not read again (the protocol allows no third round). That the profile data
    is good advice is for its readers (OD-R) and his approvals; `onboard check` proves only structure and ties. The
    question counts and slice 3's size are estimates until T4 and slice 3's first kind measure them.
- Conversation round (2026-10-20), two read-only readers on claude-opus-5-5 at high effort over 9de068be (the S11 and
  S12 rework), one on claims and gaps, one on gaps only. Blockers, shared by both: no file state for the summary and
  the deepening questions; a contradictory `deduced` suffix with no format; the advice paste deadlocked behind
  deduced topics; D8's tests still of the form; a no on one area unspecified; stage 2's output still per question.
  All taken in D15. Advisories taken: deepening questions logged before asking, commits for unsettled deductions,
  Codex in plain text, a relaying lead carrying approvals with their verbatim answers quoted, the approval sized for
  a phone, "accepted ADR" defined, stale wording. Unguaranteed: D15 was not read again (no third round), and how well
  the session deduces is for T4's two real trials to show.
- Profiles round, slice 3a (2026-10-20, S10), two read-only readers on `rule:subagent-reader-model` at high effort
  over 86e5e635 and d3b2643e: one on claims and gaps with the sources fetched, one on gaps only, running the command.
  Blockers taken:
  - a target only real users can show was a first-phase step that could never close; now its step is the measure
    wired before launch (`barStep`);
  - "measured in CI" printed from the field contradicted seven commands; each command now says where it runs;
  - `modern-image-formats` left Lighthouse 13, so it is `image-delivery-insight`;
  - the SEO target cited Google for "one h1", sitemap and robots.txt, which its guide does not require;
  - a small platform had no error tracking; observability and telemetry are now core there;
  - account deletion lacked Google Play's web link.
  Advisories taken: the `other (nearest: X)` label and a hint that carries the kind; both missing Setup lines named
  at once; advice order (team, i18n, legal, store-policy); multiplatform auth, back end and security core, data
  added, MASVS; Play's closed test of 12 testers for 14 days; Vercel Hobby's non-commercial terms; Better Auth
  joining Vercel on 2026-07-07; TBT's mobile threshold; teaching lines neutral between web and app; Flutter's reason;
  a platform `seo` area; three more shape checks (ID form, an area or target listed twice, a common core area made
  non-core). Each new fact was fetched from its source first. Not taken: `team` as a dependency of the stack beyond
  `architecture`. Unguaranteed: the fixes were not read again (no third round).
- Slice 3a, gentle-ai (2026-10-20): 65f81a30..3a9f6601, lenses readability and reliability, approved and
  acknowledged (lineage review-801c2647597627d9). Informational, left for later: a dead branch in `typed`
  (`bin/lib/profiles.mjs:144`), `WHERE`'s values unused since `barStep` stopped printing them
  (`bin/lib/profiles.mjs:11`), and two notes on `bin/onboard.mjs:257` and `bin/onboard.test.mjs:267-281`.
- Slice 3a, Codex (2026-10-20): the same range in 4 parts, recorded. One P2, taken: `B:seo-basics` named only
  Lighthouse, which does not check duplicate titles, canonicals or the sitemap across pages; its command now adds a
  check over the built pages.
- Profiles round, slice 3b (2026-10-20, S10), two read-only readers on `rule:subagent-reader-model` at high effort
  over the uncommitted data-analysis, research and pre-project kinds: one on claims and gaps with the sources
  fetched, one on gaps only, running the command for three imagined users. Blockers taken:
  - `pre-project,platform` mixed a build's whole bar into the plan; a kind may now carry `joins`, and pre-project
    joins only research or data-analysis (`parseKind` refuses the rest, exit 2);
  - research promised market and user research with neither area; market, users, competitors and their two
    targets are now non-core there;
  - a small pre-project interviewed people with no consent step; ethics and `B:consent-recorded` are core there;
  - `B:uncertainty` and `B:decision-recorded` needed a report or an ADR from the end of the work; both are now lab
    checks on the plan, the criteria committed before the first finding;
  - `B:clean-rerun` could not run in CI on private or large data; it reruns where the data can reach it, with the
    log committed and CI rerunning a committed sample.
  Advisories taken: per-kind defaults for the common areas (legal, cost, maintenance, analytics, i18n); `ci-gate`'s
  text for projects with no code; the question first in the advice order and the pipeline before CI and the report;
  raw data fetched with its checksum; a review's method and risk of bias; a no-participants line for consent;
  `B:data-cards` cites Gebru et al. (datasheets) and Pushkarna et al. (data cards, arXiv 2204.01075), which are two
  frameworks; the plan's commit before the first data commit, PRISMA-P beside OSF; OSF for confirmatory studies;
  the search log takes sources found by other means; holdout split before any preprocessing; checkable commands for
  traceable numbers, cited claims and user evidence; the brief holds one section per onboarding topic; a
  `feasibility` area and `B:riskiest-assumptions` for the pre-project, with regulation core and method and validity
  threats added; TAM, SAM and SOM taught to a newcomer; leading questions moved to the middle level. Not taken: a
  per-kind override of teaching and pitfalls (the shape has none; global teaching stays generic). Recorded for D12:
  OpenAI announced it would acquire Astral (uv) on 2026-03-19, and dbt Labs and Fivetran merged on 2026-06-01, both
  keeping their tools open source. Unguaranteed: the fixes were not read again (no third round).
- Slice 3b, gentle-ai (2026-10-20): `dfae6be0..364ada0c` (eadb813f and the pause line), assessed `medium` and
  `under_budget`, started through the preflight status as each slice is; lenses readability and reliability,
  approved and acknowledged (lineage review-b2c7fd9b754587c5). Informational, left for later: the refusal's text when
  a kind's `joins` is empty (`bin/lib/profiles.mjs:43`); the kind IDs rebuilt per kind in `shapeFindings`
  (`bin/lib/profiles.mjs:280-281`); no test that the real data refuses `pre-project,platform`
  (`bin/lib/profiles-data.test.mjs:12-13`); a kind that lists itself in `joins` is not named.
- Slice 3b, Codex (2026-10-20): `dfae6be..364ada0` in 2 parts, recorded; correct (0.86 on the data, 0.96 on the
  join rule), no findings.
- Slice 4a, gentle-ai (2026-10-20): `f0a461f5..c38a508c` (c38a508c), assessed `medium` and `under_budget`, started
  through the preflight status; lenses readability and reliability, approved and acknowledged (lineage
  review-904644ed8258b6dc). Its fix `c38a508c..5cba6d26` (5cba6d26), lens reliability, approved and acknowledged
  (lineage review-36b6ebaa093ffcc1). Taken in 5cba6d26: R2-001 (a missing Level hidden behind "fix"), R2-002 (the fast
  form in the suffix message), R3-empty-advice-stuck, R3-checklist-parse-crash. Left: R3-closed-onboarding-reopened (a
  v3-format document, accepted by D6); the fix review's R3-002 and R3-003 (tests that pin the empty checklist's step
  and a non-area checklist line), for 4b. Its R3-001 does not hold: with an empty checklist, `pasted` becomes true in
  the `else if (expected)` branch (`bin/lib/onboard.mjs`, `conversation`).
- Slice 4a, Codex (2026-10-20): `f0a461f..c38a508` in 2 parts, recorded; one P2, the same as R2-001. The fix
  `c38a508..5cba6d2` recorded as its recheck: fixed, correct (0.99).
- Code reviews of the build, one line per commit:
  - gentle-ai: `51e4c07e` approved (readability, reliability; lineage review-ef039b34d177cda4, acknowledged); Codex 4 P2.
  - gentle-ai: `5bc31869` assessed `medium`, review not due (`under_budget`, 7 paths, 158 lines); Codex correct (0.96).
  - gentle-ai: `2fede5c1..12aa07ce` approved after one bounded correction (readability, reliability; lineage review-bf067ebd0c1e7217, acknowledged): R3-uncommitted-trim fixed in `12aa07ce`. Codex over 6e99eda..ef60d12: one P2.
  - gentle-ai: `ef60d123` assessed `medium`, review not due (`under_budget`, 13 lines), from that review's advisories; Codex in 6e99eda..ef60d12.
  - gentle-ai: `04163529` assessed `medium`, review not due (`under_budget`, 44 lines): Codex's P2 on a remote branch hidden behind a local one, fixed with its RED test.
  - gentle-ai: `437a5a7f`, `5f507d36` (`3a9f6601..5f507d36`) assessed `medium`, review not due (`under_budget`, 3 paths, 15 lines): Codex's P2 fix on slice 3a, and main's `init`, `install` and T3 lines taken before merging main. Codex recorded 437a5a7..5f507d3 (correct, 0.99) and the merge 5f507d3..7edd0fa (correct, 0.99).
  - gentle-ai: `c38a508c` approved (readability, reliability; lineage review-904644ed8258b6dc, acknowledged); Codex one P2, the same as R2-001.
  - gentle-ai: `5cba6d26` approved (reliability; lineage review-36b6ebaa093ffcc1, acknowledged): the fix of R2-001 and Codex's P2; Codex recheck fixed, correct (0.99).

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
- L11 (2026-10-20) Pointed at the static-site profile, his words (transcript 908805db line 6852), verbatim: "Exacto, asi
  para cada uno de los ejemplos". So every profile under `## Reference profiles` now has the same depth and the same
  parts as the static site's: default, why, something else when, a measured bar, the areas particular to its kind,
  and what it teaches.
- L12 (2026-10-20) He asked for a detailed review of what is missing and what to improve. Two read-only readers ran on
  Opus at high effort: A on product and advice, B on the design against the built code. Their findings, merged, for
  T6.
  - Missing:
    - (1) The code knows no kind, level or advice mode: nine fixed topics (`bin/lib/onboard.mjs:17-27`,
      `bin/lib/onboard.test.mjs:20`), and no stage advises, it only asks (`bin/lib/onboard.mjs:495`).
    - (2) The pre-plan has no stack, architecture or ADR shape (`bin/lib/onboard.mjs:44`, `:110-113`).
    - (3) The teaching and fast-mode choice is stored and checked nowhere.
    - (4) `onboard check` cannot prove the advice is complete. Each profile should declare area ids, and every area
      must then be decided (ADR-n), deferred to a named phase, or, in fast mode only, skipped.
    - (5) The profiles' bars are not tied to the roadmap's done-when commands.
    - (6) Freshness is invisible: an ADR source with its URL, version and read date is needed.
    - (7) Missing kinds:
      - CLI tool or library;
      - API or backend-only service;
      - AI/LLM app;
      - e-commerce;
      - internal tool;
      - browser extension, desktop app, game, ML training;
      - mixed and unknown kinds.
    - (8) Missing areas:
      - cost and budget;
      - legal: privacy law, cookie consent, license, terms;
      - team and timeline;
      - maintenance after launch;
      - i18n;
      - front end and UX in Platform;
      - CI and tests in Data and Research;
      - product analytics.
    - (9) The owner-only steps (domain, accounts, store fees, payment providers) and their costs.
    - (10) A worked example origin and roadmap per kind.
  - Improve:
    - The profiles live in `bin/lib/profiles-data.mjs`. That is data like `bin/lib/rules-data.mjs`, since only `bin/`
      ships. It is printed one profile or area at a time and held by a shape test.
    - The interview order: repository; kind with what and for whom; mode; outcome; stack already decided; one
      decision per area in dependency order; constraints; scope; owner steps; order; risks.
    - Level is read from the answers and the repository, said in one line, and raised at once by "ya sé esto".
    - A decided stack is kept as the owner's ADR, challenged only with a sourced risk, and then deepened.
    - An existing repository gets a keep, migrate or contain audit per area.
    - Approval works per decision plus a short summary that can be read on a phone.
    - One format for every bar target: source, how it is measured, and its command.
  - Wrong or risky:
    - Core Web Vitals at p75 are field data: CI can only run lab proxies (Lighthouse LCP, CLS, TBT).
    - Auth.js has been maintained by the Better Auth team since 2025-09-22, and they recommend Better Auth for new
      projects. Tool names age too, not only versions.
    - Google restricted FAQ rich results and deprecated HowTo rich results (2023-08).
    - ADRs cannot live in the frozen origin: they go to `docs/adr/` or the roadmap's Decided table.
    - L10 point 6 (a first feature document) contradicts D5.
    - The numeric targets carry no source.
    - T4's done-when still names the scratch project S3 rejected (`:22-24`).
    - The interview could reach 20-30 exchanges with teaching on, each commit through the gate.
    - Resume can lose the mode unless it is written the moment it is said.
    - A research done-when invites fake commands; prescribe a check script in the first phase instead.
    - D8 refuses the existing plan an advanced owner often brings: named as a known gap.
- L13 (2026-10-20) The lead's reading of S6 and S7 for T6, not his words:
  - S6:
    - All the advice happens in the onboarding. The lead's proposal in L10 and L12 to defer areas to phases is
      withdrawn.
    - An early question asks whether the project is big or small, and the profile's areas and bar are scaled to that
      size.
    - A small project gets only the areas it needs, each still advised in full.
  - S7:
    - After onboarding, teaching continues in the orchestrator session only, not in every build session.
    - The advice-mode line belongs where the orchestrator reads it, never in every session's per-turn load.
- L14 (2026-10-20) Design v4 written by JH 34 (T6) on `feat/onboarding-plan-advisor`, from S3-S7, L10-L13 and the
  reference profiles: `### What v4 changes, and what it keeps`, D2-D7 revised, D9-D13 added, L12's three wrong
  profile claims corrected, and two product decisions left for him (OD-K, OD-T4). Searched his words for the subject:
  S3-S7 and L10-L13 hold every answer since 2026-10-19 (transcript 908805db, lines 6668-7043, as the lead relayed
  them). Next: the two readers at high effort, their round under `## Reviews`, then OD-K and OD-T4 to the lead one
  at a time; nothing is built before his yes to v4.
- L15 (2026-10-20) v4 past both reader rounds (062cd4d2 and the commit after it; see `## Reviews`). Product
  decisions sent to the lead one at a time, in this order: OD-K, OD-T4, OD-R, OD-F; each answer is recorded under
  `### Product decisions left for him` and here. Next: his yes to v4, then T7 (slice 3) from its first kind.
- L16 (2026-10-20) His answer to Pregunta 30 (OD-K) is S8, relayed by the lead and read at its line. Folded into v4:
  eleven kinds in D9, the pre-project kind as D14 (it plans the research, and its brief feeds a second onboarding of
  the application in its own repository), slice 3 split into 3a-3c by kinds. The lead's reading of S8 matched the
  words. Not read by the readers again: D14 is new; its readers are T7's data readers (OD-R) and his yes to v4.
  Next: OD-T4 as Pregunta 31.
- L17 (2026-10-20) His answer to Pregunta 31 (OD-T4) is S9, relayed by the lead and read at its line; the lead's
  reading (two real trials) matched the words. Folded into v4: the done-when and T4 name both trials. The
  pre-project trial runs its onboarding (D14): it plans the platform's research and the brief. Then the build
  orchestrator runs that research roadmap, and the platform's own onboarding from the brief writes the complete
  platform documents S9 asks for: origin, ADRs and roadmap. T4's done-when is the pre-project's onboarding; the
  platform's onboarding is the last phase of that pre-project's roadmap. Next: OD-R as Pregunta 32.
- L18 (2026-10-20) His answer to Pregunta 32 (OD-R) is S10, the recommended option, read at its line. Folded into
  v4: D10 says how the area questions meet `rule:double-review`, and T7 gives each profile its two readers. Next:
  OD-F as Pregunta 33, the last of the four.
- L19 (2026-10-20) His words S11, relayed by the lead and read at their line: the number of questions is fine (S6's
  scale stands), and he wants the onboarding talked and guided. Folded into v4: D3 opens with the guided
  conversation (a short explanation before every question, free answers and questions back, a recap line after each
  answer), and D10 moves the lesson from the question's text into the message before it. Pregunta 33 is still open.
- L20 (2026-10-20) His answer to Pregunta 33 is S12, read at its line: "Si" to OD-F, and the interview reshaped. With
  S11 it replaces the one-question-at-a-time interview: D3 is now a guided conversation in which the advisor
  explains, understands and deduces, then gives a summary and asks a few deepening questions; D10 explains each
  area's recommendation in the conversation, writes it as a proposed ADR, and his pre-plan approval confirms them all.
  Next step: two readers on the reworked D2, D3, D6, D7, D10 to D12, their round under `## Reviews`, fixes, then the
  ready-for-his-yes notice to the lead with a short plain summary. All four product decisions are answered.
- L21 (2026-10-20) The conversation round is recorded under `## Reviews`; D15 takes its blockers. v4 is ready for
  his yes. Next: the ready notice to the lead, then wait for his yes before T7.
- L22 (2026-10-20) His yes to v4, Pregunta 35, read at 908805db line 9328: "Sí, construilo (Recommended)". T1 and T6
  are done. The D15 insert had also pasted an older copy of the top half: its regex ends in a dollar sign and a
  backtick, which String.replace reads as "the text before the match". That copy is removed; one `## Tasks` remains.
  Next: T7, slice 3a.
- L23 (2026-10-20) T7 slice 3a written: `bin/lib/profiles-data.mjs` (global areas, static-site, platform,
  multiplatform-app, other, sourced targets), `bin/lib/profiles.mjs`, `onboard profile` (86e5e635, d3b2643e), route
  inline (one unit, no Writer trigger). One addition to D9's grammar: `--size small|large` with `--checklist`, so a
  checklist can be printed for a kind named on the command line with no onboarding document. A field target's bar
  step is its measure wired before launch, so the first build phase can close (the readers' B1); D5 is unchanged.
  The profiles round is under `## Reviews`. Next: gentle-ai review of the slice from 65f81a30, Codex review, push,
  PR, then slice 3b (data-analysis, research, pre-project).
- L24 (2026-10-20) Slice 3a is PR 481, main merged in (5f507d36 took main's help and T3 lines first; Codex read the
  merge's resolution alone, from a temporary worktree at the commit). T7 slice 3b written: data-analysis, research
  and pre-project, 14 areas and 16 targets, past their readers (`## Reviews`), route inline (one unit, no Writer
  trigger). One addition to D9's grammar: a kind's optional `joins`, the kinds it may be joined with, so a plan kind
  never takes a build kind's bar; `shapeFindings` names a `joins` entry that is no kind. Next: gentle-ai and Codex
  on the slice, its PR, then slice 3c (cli-library, api-service, ai-app, tui-app).
- L25 (2026-10-20) Paused at a safe point for his restart, on the orchestrator's word. Slice 3b is eadb813f, committed
  in `D:\js-harness-worktrees\onboarding-v4` (detached HEAD) and not pushed: the pre-push hook refuses a code commit
  with no Codex record, and the pause allows no review. origin/feat/onboarding-plan-advisor is at dfae6be0 (PR 481).
  On resume, in order: gentle-ai on `dfae6be0..HEAD` (`--base-ref dfae6be0 --committed-only`, lenses readability and
  reliability, the `granted` invocation pre-granted); `js-harness codex-review --base dfae6be0`; push with
  `git push origin HEAD:feat/onboarding-plan-advisor`; the 3b lines in PR 481's body or a PR of its own; the ready
  notice; then slice 3c.
- L26 (2026-10-20) Resumed after the restart: PR 481 is in main (11ff331). Slice 3b passed gentle-ai and Codex
  (`## Reviews`) and is pushed for its own pull request. The orchestrator's resume message names T8 next; slice 3c
  (cli-library, api-service, ai-app, tui-app) stays open in T7.
- L27 (2026-10-20) T8 slice 4a, the conversation in files (D3, D6, D15), tests first: eleven topics, topics 1, 2, 3, 4
  and 9 checked only `answered` or `confirmed`; the summary line `S`; `## Setup`'s five lines in their formats, Kind
  through `parseKind`; `## Advice` held to `--checklist advice` for Kind and Size until O6, each area in one of its
  five forms, every area with a Level; the `answers` hash in place of `interview` (O2); stage 2 renamed "Conversation
  and advice", with its covered line, what is open and waiting, and one next step (opening, kind, advice, converse,
  summary, fix); the Close text on topics 1, 6, 7 and 9. The lib takes the profiles as `profiles`, a fixture in its
  tests. On the branch `feat/onboarding-conversation`, stacked on PR 484. Next: 4b, the ADRs (`template adr`, their
  checks, the `adrs` hash on O3 and O5) and fast mode's given-up line; then 4c, the pre-plan and roadmap additions.
- L28 (2026-10-20) Slice 4a passed gentle-ai (lineage review-904644ed8258b6dc, readability and reliability, approved,
  acknowledged) with five informational findings, and Codex (2 parts) with one P2 that matches gentle-ai's R2-001: a
  Level never written after the paste left stage 2 on "fix" with nothing printed. Fixed in the next commit, test
  first: that case goes back to the advice step; the area-suffix message names the fast form; a checklist that prints
  no area asks for no paste; checklist lines that are not areas are skipped. Left as is: a document closed in v3's
  format reads as stage 2 again, which D6 accepts because no project was onboarded with v3.
- L29 (2026-10-20) Slice 4a is PR 486 (base main, ready notice recorded 00:50Z). Slice 4b started, uncommitted in the
  worktree: `bin/lib/onboard.testkit.mjs` has `adr()`, `ADRS` (0001 A:stack, 0002 A:hosting), `adrs` in `files()` and
  O3/O5 recording `adrs sha256`. Next step, in order: (1) tests first in `bin/lib/onboard.test.mjs`: O3/O5 fixtures at
  lines 132-148, 336, 417, 426 gain `adrs sha256`; the fast cases (lines 84, 110) gain `- Given up (fast, L20): ...`
  and an ADR-0003 with a `profile:` source; new tests for the ADR checks, the `adrs` hash, a no on one area sending
  the work back to stage 3, and the empty checklist's step (R3-002). (2) `bin/lib/onboard.mjs`: `adrTemplate`,
  `hashes` with `adrs` (sorted paths, path and text), RECORDS O3 ['origin','adrs'] and O5 ['roadmap','origin','adrs'],
  HASHED.adrs 'docs/adr/'; in `conversation`, ADR checks for settled areas only (exists, `## Area` matches, one
  source in a D12 form, `profile:` only with fast, template lines, belongs to an area or superseded/withdrawn until
  O6) as stage-2 `wrong` findings with their own file, so `wrong` becomes finding objects; the given-up line required
  with fast and refused without; in `checkOnboarding`, a `not read` ADR named under the pre-plan's `## Risks`
  (stage 3); stage 3, 4 and 6 texts with the adrs hash and D15's no on one area. (3) `bin/onboard.mjs`: readFiles
  reads `docs/adr/*.md` into `adrs`; `template adr <slug> [--write]` (slug `^[a-z0-9]+(-[a-z0-9]+)*$`, next number,
  `wx`, refused when another file took the number); `docs/adr` in `gitContext`'s status; USAGE; `closed()` in
  `bin/onboard.test.mjs` writes ADRS. Then README, gentle-ai, Codex, push to a new branch from main, PR, ready notice.
- L30 (2026-10-20) Slice 4b written test first, as L29 planned, with three choices made on the way: (a) `wrong` stays
  a list of strings, an ADR's finding prefixed with its file, which the stage report splits back into its FAIL line,
  so the stage-2 fixtures keep their shape; (b) the orphan check (an ADR no area names) waits until every area is
  pasted and settled, because a session writes the ADR before it checks its area; (c) two sessions that take one
  number with two slugs both write, and listing again keeps the name that sorts first and refuses the other
  (`writeAdr`, its `readdir` the test's seam). Lib 35 tests and command 18 pass. Next: gate, commit, gentle-ai,
  Codex, push, PR, ready notice; then 4c.

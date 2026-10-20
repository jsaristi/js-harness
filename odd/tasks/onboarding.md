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
- One real onboarding (T4) of the project his answer to OD-T4 names, not a test project (S3): one question at a
  time, both readers' rounds recorded, both approvals, then `js-harness onboard check` exits 0 there and
  `js-harness progress` lists every phase.

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
  Teaching in the work sessions that build (S7 keeps it to the orchestrator). Kinds beyond those OD-K settles.

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

## Tasks
- [ ] T1 (kind: design) This design, past its two readers, and his yes
- [x] T2 (kind: build) Slice 1: `onboard check` (D6), `hash`, `template`, the two exported helpers, help, README, SPEC, with tests (51e4c07e and its review fixes)
- [x] T3 (kind: build) Slice 2: bare `onboard`, its stages and resume (D2, D7, D8), `init`'s closing line, with tests (PR 468, merged)
- [ ] T6 (kind: design) Design v4 from S3-S7, L12 and `## Reference profiles`: the onboarding as a plan orchestrator that asks the project's kind and the developer's level, and advises the stack and the architecture, past its two readers and his yes
- [ ] T7 (kind: build) Slice 3: `bin/lib/profiles-data.mjs`, `onboard profile`, the shape test (D9), after his yes to v4
- [ ] T8 (kind: build) Slice 4: the v4 interview, `## Setup` and `## Advice`, ADRs, the origin and roadmap additions, their checks and stage lines (D2-D6, D10-D12)
- [ ] T9 (kind: build) Slice 5: the orchestrator skill's teaching paragraph and the handoff line (D13), README, SPEC
- [ ] T4 (kind: verify) The one real onboarding of the done-when, after T9 (its scratch-project interview was stopped by S3)
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
- Stage numbers stay: advice runs inside stage 2, renamed "Interview and advice", so no finding's "back to stage N"
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
left (for the interview, "topic 4 of 11" or "area 3 of 8 (A:frontend)") and the next step, in English, and exits 0.
Nothing about the stage lives in the conversation, so a new session, a compaction or the other host resumes by running
`onboard` again; stopping between any two answers is safe. The onboarding document (D7) carries fixed IDs that the
stages key on:

| # | Stage | Current when | What the session does |
|---|-------|--------------|-----------------------|
| 1 | Read | no `odd/tasks/onboarding.md` on this branch and none on another (D7) | Reads the repository (README, manifests, `git log`, docs, codegraph where there is code); runs `onboard template feature --write`; fills L1 with the owner's request and `## What exists` with what it found, each with its evidence |
| 2 | Interview and advice | a `## Setup` value is missing or malformed, a topic under `## Interview` or an area under `## Advice` is unchecked, or the topics or areas differ from the expected set (D3, D10) | Asks the next item, one question, waits; logs the answer verbatim with its date and checks the item: a topic as `answered` or `unknown (OD<n>)`, an area as D10 says. Once topics 1-3 are answered and `## Advice` is still empty, the output's next step is to run `onboard profile --checklist advice` and paste what it prints under `## Advice` |
| 3 | Pre-plan | every topic and area checked, and `O2` unchecked or its recorded `answers` hash (D6) differs | `onboard template origin --write` the first time, then fills or revises the file from the answers and the ADRs, checks `O2` with the `answers` hash `onboard hash` prints |
| 4 | Pre-plan review | `O2` checked, and `O3` unchecked or one of its two recorded hashes (`origin`, `adrs`) differs | Two readers read the pre-plan and every ADR, findings under `## Reviews`; one question to the owner, whose text is a summary of at most ten lines that a phone shows whole, naming the files. A yes checks `O3` with both hashes and the Log line. A no is logged verbatim, the files revised, a second round reads only the blockers, and he is asked again |
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

### D3. The interview
- **Read before asking.** Nothing the repository already answers is asked; the session states what it read and asks
  only to confirm what it inferred, as one question.
- **One question at a time**, through the question tool where the host has one (Claude Code), with a recommended
  option first, so he can answer from his phone with a tap; plain text in Codex. A short answer that fits two
  readings is asked about, not guessed. In a new project no build lead runs yet, so the plan orchestrator asks the
  owner directly; where a lead already holds the project, the question goes through it (`js-harness-orchestrator`,
  "Questions to the user"). One session holds the onboarding.
- **Before the first question**, one line tells the owner that teaching is on, and that "sin enseñanza" turns it off
  and "fácil y rápido" asks for the fast plan (S4). The session logs that it said so, as a Log line marked
  `(session)`, and `## Setup` records `Teaching: on (L<n>)`.
- **`## Setup`** (formats in D6): `Kind`, `Size`, `Level`, `Teaching`, `Mode`. `Mode: full` and `Teaching: on` are
  written with the template, as the defaults. A change to `## Setup` is committed at once, apart from the
  every-three-answers rhythm of D7, because a lost teaching or mode choice would be asked again (L12); it is rare.
- **The eleven topics**, in order, each a checkbox under `## Interview`; the areas of `## Advice` (D10) come between
  topics 7 and 8, because scope, order and risks depend on what was decided:
  1. What the project is, for whom, and its kind: one or more of the profiles' kinds (D9), or `other` with the nearest
     kind. The session proposes the kind it reads from the answer and the repository; sets `Kind`.
  2. Its size: small (only what is needed) or large (S6). Sets `Size`, which chooses the areas and the bar.
  3. The developer's level in the kind's areas, grouped by layer (for a platform: back end, front end, data, delivery),
     proposed from the repository and the answers so far and confirmed in one question whose recommended option is
     the reading itself. Sets `Level`. This departs from L10 ("read, never asked"): S3 makes the level decide how
     deep every lesson goes ("si el desarrollador del proyecto sabe que hacer" or "es un programador muy junior"), so
     a wrong guess would be paid in every area; one tap confirms it. "ya sé esto" during the advice raises one area's
     level at once (D11).
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
- **It ends when** every topic is answered or marked unknown and every area is settled (D10). Topics 1, 2, 3, 4 and 9
  cannot be unknown: without them there is no plan to make, or no depth to advise at. A topic whose answer opens a
  real fork gets one follow-up question; anything else is decided by the session and written down with its reason.
  An answer to topics 8-11 that reopens a settled area unchecks that area (D10).
- **How long**: 11 topics plus one question per area, about 18 to 30 questions in all; the number of areas per kind
  is fixed by slice 3's data, and T4 measures the real count. What keeps it bounded: nothing the repository answers
  is asked, an area the owner already decided is deepened in its ADR without a question unless a sourced risk needs
  one, the lesson rides inside the question rather than in extra turns, and "fácil y rápido" is open at every turn.
- Answers are logged in the owner's words and language, with the date; everything else follows topic 6's artifact
  language. The conversation, lessons included, is in the owner's language.

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
  - `decided, ADR-0004 (L14)`: he took a recommendation
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
  - `Teaching`, `Mode` and `Level` are left out of every hash on purpose (D2).
- `O2` records `answers`; `O3` records `origin` and `adrs`; `O5` records `roadmap`, `origin` and `adrs`.

**What it checks**:
- **The onboarding document**: the eleven topics checked, topics 1, 2, 3, 4 and 9 answered; `O3` and `O5` checked,
  each with its hashes matching and a Log line; `## Reviews` holds a round for each of the two reviews.
- **The setup and the advice** (v4): `## Setup` holds its five lines in the formats above, `Kind` naming kinds of the
  profiles or `other`, every `Level` area listed. Until `O6` closes, the areas under `## Advice` are exactly the set
  `--checklist advice` prints for that `Kind` and `Size`; after it, the set is no longer compared, so a later release
  that changes the profiles never turns a finished onboarding red. Every checked area carries one of the four
  suffixes, `default, fast` only with `Mode: fast`.
- **The ADRs** (v4): each ADR an area names exists and names that area; each has at least one source line in a form
  of D12; each ADR under `docs/adr/` belongs to a listed area or is marked superseded or withdrawn; a `not read`
  source has its ADR named under the pre-plan's `## Risks`.
- **The pre-plan**: its required headings, `## Stack and architecture` with one row per decided area, and
  `## Owner steps`.
- **The roadmap**: `parseRoadmap` finds at least one phase, each with at least one step; every Checklist phase has a
  `## Phases` row of the same name, and the other way round; every pre-plan phase is a roadmap phase; every Done when
  cell holds a command in the contract's form; `## Next` exists; every `OD<n>` still open in the pre-plan appears in
  the roadmap's Open decisions. v4: `## Decided` names every accepted ADR of an area; `## Advice mode` is in the
  format above (its values are not compared, D2); every `B:` ID `--checklist bar` prints for the `Kind` and `Size` is
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
- **What would live only in the chat** is logged: when an area's question is asked, a `(session)` Log line records
  the recommendation, its options and the sources read, so a compaction before the answer asks the same question
  again, not a new one.
- **Committed after every stage, every three answers in the interview, and at once for `## Setup`**, on the branch
  `onboarding`: desktop sessions each run in their own worktree, and only what is committed reaches the next one.
  Each commit runs the project's gate, so a commit per answer would make him wait on every tap; a cut loses at most
  two answers, and `onboard` names the uncommitted ones. When `onboard` finds no document on this branch, it looks
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
  the four area suffixes, and `default, fast` outside fast mode; an ADR missing, of another area, without a source,
  with a `not read` source not named under Risks, and orphaned; the `answers` hash ignoring a teaching, level or mode
  change; an ADR edit reopening stage 4; `## Advice mode` malformed; a `B:` step missing, then excused by an open OD
  and by the given-up line; the order of stage 2 (topics 1-7, the areas, topics 8-11) and its "area n of m" line; a
  changed `Kind` recomputing the set; the set no longer compared after O6; `template adr`'s numbering, its exclusive
  create, and a slug refused; the new argument errors; the skill's paragraph (`bin/lib/manifest.test.mjs`); the
  Onboarded handoff text. The testkit's complete fixtures gain `## Setup` and `## Advice` from a fixture profile.

### D9. The profiles as data (`bin/lib/profiles-data.mjs`)
The profiles live in `bin/` because only `bin/` ships, as data like `bin/lib/rules-data.mjs`, and reach the session
through the command's output, one piece at a time, never as a skill or a per-turn load.
- **Areas are global**, one definition per ID (`A:frontend`, `A:architecture`): title, what it decides, what to
  teach at each level (D11) as an outline the session turns into the lesson, its pitfalls, and `after` (the areas it
  depends on, so they are advised in order: hosting after the stack, CI after the tests).
- **Each kind**: `id` (`static-site`, `platform`, `multiplatform-app`, `data-analysis`, `research`, and the ones OD-K
  adds), its title, the default, why, when something else, and its list of areas, each with `core` (true when a
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
  `--checklist advice|bar` prints the `## Advice` lines or the `B:` steps. With no kind given, `--area` and
  `--checklist` read `Kind` and `Size` from the onboarding document, so the session never retypes them. Tool names
  in the data are starting points the session checks against current docs (D12), never the advice itself.
- **A shape test** holds every kind to the same parts as the static site's (L11): global IDs unique, `after` naming
  existing areas without a cycle, every common area in every kind, at least one core bar target per kind, a source
  and a measuring command on every target.

### D10. The advice, one area at a time
For each area under `## Advice`, in `after` order, the session runs `onboard profile --area <id>`, reads the current
docs and release notes of what it will recommend, logs the question as D7 says, and asks one question:
- **Its text**: what this area decides, the recommendation and its why, at the depth of the developer's level in it
  (D11), the sources it read, what is given up with each alternative, and the area's bar targets, one line each. The
  question tool shows it on a phone, so the lesson in it stays short (about 120 words); the full reasoning goes into
  the ADR.
- **Its options**: the recommendation first, one or two real alternatives, and where the owner already uses
  something else, that one.
- **The reviewed text it rests on**: the question names its profile area (`bin/lib/profiles-data.mjs`, `A:<id>`)
  as the reviewed text behind it; a recommendation that departs from the profile says so. Whether that is enough for
  `rule:double-review` is his to say (OD-R).
- **An area the owner already decided** (topic 6) is kept as his decision and deepened, not replaced (S3: "sabe que
  tecnologico escoger por ejemplo el stack mern entonces lo guia super avanzado"): its ADR records how to do it well,
  and the session asks only when a sourced risk makes the choice worth reopening.
- **An existing repository** starts from topic 5's keep, migrate or contain for the area.
- **Settling an area** writes its ADR (D12) and checks its line with one of D6's four suffixes. Every area is
  advised whatever the developer knows: a backend developer still gets the front end, the architecture and the CI
  advised (S4).
- **Reopening an area** before O6: its line is unchecked, a new ADR supersedes the old one, and the question is asked
  again.
- **Size** (S6) chooses the areas: small lists only the core ones, each still advised in full; large lists them all.

### D11. Level, teaching and the fast plan
- **Level**: per area, `new`, `some` or `experienced`, in `## Setup`'s `Level` line. It sets depth and tone, never
  coverage (L10). `new`: the concept first, what it is and why it matters, then the recommendation (S3: "lo vas a
  guiar a enseñar y darle el criterio de acompañamiento de por que hacerlo"). `some`: the why and the alternatives.
  `experienced`: tradeoffs, pitfalls at scale, and his own choice challenged with sources (S3: "lo guia super
  avanzado"). "ya sé esto" raises that area at once, logged.
- **Teaching** is on by default and is announced before the first question (S4: "siempre enseñes y des la opcion al
  usuario a desactivar la enseñanza"). "sin enseñanza" turns it off at any turn, takes effect at once, and is
  committed in `## Setup` right away; then each question gives the recommendation and its why in one line, the
  alternatives in one line each. It can be turned back on the same way. Neither reopens an approval (D2).
- **Fast mode** only when the owner asks for it (S4: "a menos que el usuario te indique lo contario osea de que no
  quiere aprender y de que solo quiere hacerlo facil y rapido"): one question proposes every remaining area's profile
  default at once, names once what is given up (depth, measures, the bar targets left out), records `Mode: fast` with
  his words and the given-up line. Its ADRs are brief and may cite the profile itself as their source (D12), so fast
  mode reads no docs. Areas already settled stay as they are; "completo" returns to full mode for the areas still
  open. Whether the readers and both approvals still run in fast mode is his to say (OD-F); v4 keeps them until he
  answers.

### D12. Decisions as ADRs, with their sources
- `onboard template adr <slug>` prints the skeleton; with `--write` it creates `docs/adr/<nnnn>-<slug>.md`, `<nnnn>`
  the highest number there plus one, four digits, with exclusive create (two sessions racing for one number: the
  second is refused and runs it again). The slug must match `^[a-z0-9]+(-[a-z0-9]+)*$`, so no path can leave
  `docs/adr/`. The skeleton: Status (accepted, date, the Log line; later `superseded by ADR-<n>` or `withdrawn`), Area
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
    the lead sends a one-line notice to the open work sessions, and the work session that next changes the roadmap
    writes it into `## Advice mode` (the lead never commits, `:117`);
  - nothing goes in `AGENTS.md` (L13).
- **Risk**: the skill is installed per home for both hosts (`bin/lib/manifest.mjs:204-213`), so the paragraph reaches
  every project on the machine. It is high-risk item 3 (a contract others consume), worded so that a project with no
  `## Advice mode` sees no change; slice 5 carries that Risk line and gets an independent verifier.

### Cost
Built (slices 1-2): 836 lines of code and 726 of tests (`wc -l`, 2026-10-20). v4 to build:
- Slice 3 is mostly data, likely more than one slice: global areas with three-level teaching outlines, five kinds, and
  a sourced bar target each, which needs web reading while it is written. It is forecast from the first kind
  (static site) before the rest are written, and split into 3a (shape, command, common areas, static site, platform)
  and 3b (the other three) if the forecast passes about 500 lines.
- Slices 4 and 5: about 400-500 authored lines each with tests.
- One gate per commit, one gentle-ai and one Codex review per slice, an independent verifier for slice 5, then T4's
  real onboarding.
Using it in a project: one session of about 18 to 30 questions, the docs read for each area, and two readers twice
(pre-plan with its ADRs, plan), on the reader model the rules give.

### What v4 leaves out, and why
- A worked example origin and roadmap per kind (L12, item 10): T4's real onboarding produces the first; one per kind
  would be five more onboardings, so they are a later roadmap step.
- Kinds past OD-K's answer, and adopting an existing plan (D8): later versions.

### Product decisions left for him
Asked one at a time through the lead, after the readers; each is recorded here with his answer.
- **OD-K** Which kinds ship in the first build. Recommended: the five he named in S3 plus `other`, which advises the
  common areas and borrows the nearest kind's; the kinds L12 found missing (CLI tool or library, API service, AI or
  LLM app, e-commerce, internal tool, browser extension, desktop app, game, ML training) go on the roadmap as
  later profiles. The alternative is adding the three most common of them (CLI or library, API service, AI app) now,
  at about one more slice.
- **OD-T4** Which project the real onboarding of the done-when runs on, now that S3 rules out a test project.
- **OD-R** `rule:double-review` is his rule: a plan or design put to him first passes two readers, unless the
  question names its reviewed text by path. Each area question (6 to 16 of them) puts a choice to the owner. v4's
  proposal: the profile data passes the two readers when slice 3 writes it, each area question names its profile area
  as the reviewed text, and every ADR is read by the stage-4 readers before the approval that makes the decisions
  binding. The alternative is two readers before each area question, which multiplies the onboarding's reader cost
  by the number of areas.
- **OD-F** Whether fast mode ("solo quiere hacerlo facil y rapido sin importar tanto la calidad", S4) still runs the
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

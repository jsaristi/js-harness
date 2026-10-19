# Onboarding: the pre-plan and the plan of a new project, with the AI

Locator: `odd/tasks/onboarding.md` · Engram mirror: `odd/onboarding/tasks` · Branch: `feat/onboarding`
Delivery: one slice, one pull request, after his yes to the design. Test runner: `node --test`.

## Goal
After `js-harness init`, a session in the new project runs `js-harness onboard` and, through a short interview with
the owner, writes a reviewed pre-plan (`docs/origin.md`) and a complete roadmap (`docs/ROADMAP.md`) that
`js-harness progress` reads and every later session starts from.

## Why
His words (2026-10-19): "una funcionalidad de onboarding para que cuando instalemos el harnes en un proyecto hagamos
todo el pre plan y el plan ya con la ia para ejecutar un roadmap completo y bien estructurado del proyecto". Principle
7 of the roadmap says why it matters: work follows the objective and the plan, so a project starts from a plan made
"casi a la perfeccion" (2026-10-18). js-harness itself was started that way by hand (pre-plan, then roadmap); onboard
makes that path the default for every project and checks its result.

## Done when
- `node --test bin/onboard.test.mjs bin/lib/onboard.test.mjs bin/init.test.mjs` exits 0
- `npm run check` exits 0
- In the practice project (`scripts/practice.mjs`), a session runs `js-harness onboard` after `init`: it asks one
  question at a time, writes `docs/origin.md` and `docs/ROADMAP.md` after the readers and the owner's yes, and then
  `js-harness onboard check` exits 0 and `js-harness progress` lists every phase.

## In scope / Out of scope
- In: `bin/onboard.mjs`, `bin/lib/onboard.mjs` and their tests; the dispatcher's help (`bin/js-harness.mjs`); one
  closing line of `init` (`bin/init.mjs`); README, `docs/SPEC.md`, the ROADMAP's Onboarding section.
- Out: the harness block of the `AGENTS.md` template — its hash is checked in every project, so a change there is a
  change for all of them; onboard writes its one line outside the block instead (D7). Calling a model from the CLI
  (D1). Adopting a roadmap of another shape that a project already has (D8). The TUI entry, later.

## Constraints
- Zero dependencies and no model call from the CLI — because every command here runs in any host with no install
  step, and spend must stay where the owner sees it: in the session he is talking to.
- Writes only inside the repository, and never over an existing `docs/origin.md` or `docs/ROADMAP.md` — because what
  the harness writes must be undoable exactly; files in the repository are undone by git.
- Nothing added to the per-turn load: no new skill, no new hook — because every line loaded on every turn is paid on
  every turn; the instructions come from the command's output, one stage at a time (D2).

## Ask me before
The design itself (this document, after its readers). While building: nothing else; spend is one gate per commit,
one gentle-ai review and one Codex review of the slice, and one practice run.

## Specs
- S1. His words (2026-10-19), verbatim: "una funcionalidad de onboarding para que cuando instalemos el harnes en un
  proyecto hagamos todo el pre plan y el plan ya con la ia para ejecutar un roadmap completo y bien estructurado del
  proyecto".
- S2. The task given to this session (2026-10-19): the interview asks one question at a time; the design says what
  the pre-plan and the plan hold, the roadmap's shape (phases, checkable items, a "done when" per phase), where it is
  stored and how a later session resumes it; onboard reuses `init`, the task contract, this repository's roadmap
  shape and what gentle-ai offers, instead of rebuilding them.

## Tasks
- [ ] T1 (kind: design) This design, past its two readers, and his yes
- [ ] T2 (kind: build) `onboard` (stage and next step, read from files) and `onboard check`, with tests
- [ ] T3 (kind: build) `onboard template`, the closing line of `init`, the help, README and SPEC
- [ ] T4 (kind: verify) End to end in the practice project
- [ ] T5 (kind: docs) Tick the ROADMAP's Onboarding steps and record the reviews

## Design

### What exists and is reused (read 2026-10-19)
- **The path js-harness took itself.** On 2026-09-26 he asked whether pre-plan, plan and roadmap were one too many
  ("sera que me estoy complicando...", the transcript `c580b1d8`, line 446). The answer he applied (lines 451-510):
  the pre-plan is frozen as the origin (`docs/origin.md`: why, evidence, sources), the roadmap is the one living plan,
  each feature document covers only its feature, and `AGENTS.md` points every session at the roadmap. Onboard
  produces that same set, so "pre-plan" and "plan" in S1 are `docs/origin.md` and `docs/ROADMAP.md`.
- **The roadmap shape `progress` reads** (`bin/lib/progress.mjs:220`): under `## Checklist`, each `### <phase>`
  heading is a phase and each `- [ ]` / `- [x]` line under it a step. This repository adds a `## Phases` table
  (`Phase | Done when | State`), `## Decided`, `## Next`, `## Open decisions` and `## Risks`
  (`docs/ROADMAP.md:1-98`).
- **The pre-plan shape**: `docs/origin.md`, js-harness's own founding pre-plan: Decisions already made, Principles,
  Phases (Goal, Done when, Effort), Task contract template, Not built (the stack already does it), Risks, Open
  decisions (ask one at a time), Sources.
- **The task contract** (`js-harness contract template`, `bin/lib/contract.mjs`): Goal, Why, Done when (commands that
  exit 0), In/Out of scope, Constraints, Ask me before, Tasks with a kind. `contract check` validates it statically.
- **`init`** (`bin/init.mjs`, `bin/lib/project.mjs`): writes `harness.json`, a base `AGENTS.md` when none exists
  (`agentsTemplate`, `bin/lib/project.mjs:345`, whose "What this project is" and "Constraints" are placeholders),
  `docs/FAILURES.md`, the pre-commit gate and codegraph. It writes no roadmap, and its `AGENTS.md` names none.
  An `AGENTS.md` changed after `init` is kept by `uninstall` ("changed since init", `bin/lib/project.mjs:1457`), so a
  line onboard adds there survives an uninstall.
- **gentle-ai 4.2.0**: `gentle-ai --help` lists no planning command (its SDD phases are gone; ODD lives in the
  orchestrator prompt). What ODD gives and onboard reuses: explore before asking, one focused question for a real
  product decision, research only for a named uncertainty, the feature document (Specs that quote the user verbatim,
  Tasks, Log) and its engram mirror. Onboarding a project is itself one ODD feature of that project.
- **The readers** (`js-harness-protocols`, section 1): a plan put to the owner first passes two read-only readers,
  one attacking its claims, one looking for what is missing.

### D1. The AI is the session, not the command
`js-harness onboard` never calls a model. The owner runs it in a Claude Code or Codex session (or tells the session
"onboard this project"); the session runs the command, reads what it prints and does that stage. The CLI holds what
must not depend on a model's memory: which stage the project is in, what that stage must produce, and a check of the
result. Spawning `claude -p` from the CLI was weighed and dropped: an interview needs the owner in the loop, and spend
from a hidden child is spend he does not see.

### D2. Stages, read from files; instructions printed one stage at a time
`onboard` with no flag reads the project's files and prints the current stage, what it must produce and the next
step, in English, and exits 0. Nothing about the stage lives in the conversation, so a new session, a compaction or
the other host resumes by running `onboard` again. The stages:

| # | Stage | It is current when | What the session does |
|---|-------|--------------------|-----------------------|
| 1 | Read | `odd/tasks/onboarding.md` is missing | Reads the repository first (README, manifests, `git log`, docs, codegraph when there is code), then writes `odd/tasks/onboarding.md` from `onboard template feature`: the task contract head, `L1` with the owner's request, and the scan's findings |
| 2 | Interview | a topic of `## Interview` is unchecked | Asks the next unchecked topic, one question, waits; writes the answer verbatim with its date under the topic and checks it, or marks it `unknown` and adds an open decision |
| 3 | Pre-plan | every topic is checked and `docs/origin.md` is missing | Writes `docs/origin.md` from `onboard template origin` |
| 4 | Pre-plan review | T "pre-plan approved" is unchecked | Two readers, then one question to the owner; his yes is logged verbatim and the task checked |
| 5 | Plan | `docs/ROADMAP.md` is missing | Writes `docs/ROADMAP.md` from `onboard template roadmap`, derived from the approved pre-plan |
| 6 | Plan review | T "plan approved" is unchecked | Two readers, then one question to the owner, logged the same way |
| 7 | Close | `onboard check` fails | Adds the `AGENTS.md` line (D7), opens the first feature's document with its contract, commits |
| — | Onboarded | `onboard check` exits 0 | Prints the roadmap's first unchecked step and the text that starts its session |

A stage's instructions are a few lines of the command's output, tested like any other output, so they cost nothing
on the turns that do not need them.

### D3. The interview
- **Read before asking.** Nothing the repository already answers is asked; the session states what it read and asks
  only to confirm what it inferred, as one question.
- **One question at a time**, through the question tool where the host has one (Claude Code), with a recommended
  option first; plain text in Codex. A short answer that fits two readings is asked about, not guessed.
- **Topics**, in order, each a checkbox under `## Interview` of `odd/tasks/onboarding.md`:
  1. What the project is and for whom (one sentence each).
  2. The outcome that makes it worth doing: how the owner will know it worked.
  3. What exists today: code, data, users, deadlines (confirmed from the read stage).
  4. Decisions already made: stack, hosting, services, language of the product.
  5. Constraints and their reasons: money, time, legal, data, machines.
  6. In and out of scope for the first usable version.
  7. What the owner keeps for himself (spend, irreversible steps, product choices), which becomes "Ask me before"
     and the project's `AGENTS.md`.
  8. Order: what must come first, and what can wait.
  9. Risks and unknowns; each unknown becomes an open decision or a research item with a named question.
- **It ends when** every topic is answered or marked unknown, not after a fixed number of questions. A topic whose
  answer opens a real fork gets one follow-up question; anything else is decided by the session and written down
  with its reason.
- Answers are written in the owner's words and language, with the date; everything else is in English, per the
  project's artifact rule.

### D4. What the pre-plan holds (`docs/origin.md`)
The headings of js-harness's own origin, filled from the interview: a status note (frozen once approved; later
changes go to the roadmap), Goal, Why, What exists (with the evidence the read stage found), Decisions already made
(a table, each with the owner's words and date), Principles of this project, Phases (Goal, Done when), Not built
(what the installed stack already does), Risks, Open decisions (asked one at a time), Sources (the interview's dated
answers, research links). Research for a named unknown may run here, with its sources; none is run without a named
question. Once approved it is frozen, as `docs/origin.md` is here.

### D5. What the plan holds (`docs/ROADMAP.md`)
The shape of this repository's roadmap, so `progress` reads it unchanged:
- A header that names the three documents (this file is the plan, `origin.md` where it came from, `odd/tasks/` one
  feature each) and says what comes next is read under `## Next`.
- `## Principles` and `## Decided`, carried from the pre-plan.
- `## Phases`: a table `Phase | Goal | Done when | State`. Every **Done when** names at least one command that exits
  0, written as a code span followed by `exits 0`, the contract's form, and may add one observable behavior a human
  checks. The first phase is the smallest version the owner can use.
- `## Checklist`: one `### <phase>` per row of the table, in the same order, each with `- [ ]` steps. A step is one
  feature or less: the work of one session, about one pull request of 400 authored lines at most, and says what is
  true when it is done, not an activity.
- `## Next`: the first unchecked step, the feature document it opens and the text that starts its session.
- `## Open decisions (the owner's, asked one at a time)` and `## Risks`.

### D6. `onboard check`
A static check, run as the onboarding feature's done-when and by the Close stage; it never runs a command. It exits 0
when: `docs/origin.md` has its required headings; `docs/ROADMAP.md` parses with `parseRoadmap` into at least one
phase, each with at least one step; every Checklist phase has a row in `## Phases` with the same name and a Done when
that holds at least one command in the contract's form (the contract's own parser, `bin/lib/contract.mjs`, is
reused); `## Next` exists; `AGENTS.md` has the roadmap line. Otherwise it prints one line per finding and exits 1.
It does not hold js-harness's own roadmap to this shape: its Phases table predates it, and onboard checks what it
writes. A row of `check` for it is left for later, once a project has used it.

### D7. Where it is stored, and how a later session resumes
- **The onboarding itself**: `odd/tasks/onboarding.md` in the new project, an ODD feature document with the contract
  head (Goal: a reviewed `docs/ROADMAP.md`; Done when: `` `js-harness onboard check` exits 0``), the `## Interview`
  topics, Tasks (the approvals among them) and a Log with each answer and each yes verbatim. gentle-ai mirrors it in
  engram as `odd/onboarding/tasks`; `progress` counts it as a feature.
- **The result**: `docs/origin.md` (frozen) and `docs/ROADMAP.md` (living), committed on the onboarding branch.
- **Resume while onboarding**: any session runs `js-harness onboard`; the stage comes from the files (D2).
- **Every session after**: the Close stage adds one line to the project's own section of `AGENTS.md`, outside the
  harness block: `The plan is docs/ROADMAP.md: a session starts there, and each feature's state is in odd/tasks/.`
  `init`'s template stays unchanged, so no other project's block hash moves.
- **Undo**: everything onboard writes is a file in the repository, undone by git; it records nothing in the project
  manifest, so `uninstall` never deletes the plan.

### D8. Edges
- A project that already has `docs/ROADMAP.md` or `docs/origin.md`: onboard writes neither; it prints that the
  project has a plan and runs `onboard check` on it. Adopting another shape is out of scope.
- `init` ends with one more line when the project has no `docs/ROADMAP.md`: `next: in a Claude Code or Codex
  session, run js-harness onboard`. `init` never starts the interview itself.
- `onboard` outside an initialized project refuses, like the other project commands, and names `init`.
- `onboard template <feature|origin|roadmap>` prints a skeleton to stdout and writes nothing; the session fills it.

### Cost
Building it: one session, one slice (about 300-400 authored lines with tests), one gate per commit, one gentle-ai
review, one Codex review, one practice run. Using it in a project: one interview session, and two readers twice
(pre-plan, plan), on the reader model the rules give.

## Log
- L1 (2026-10-19) His request, verbatim: "una funcionalidad de onboarding para que cuando instalemos el harnes en un
  proyecto hagamos todo el pre plan y el plan ya con la ia para ejecutar un roadmap completo y bien estructurado del
  proyecto".
- L2 (2026-10-19) His earlier words searched in every js-harness and harness transcript, his own typed messages
  only, for `onboarding|pre ?plan|plan casi|roadmap completo|nuevo proyecto.*plan`: the 2026-09-26 thread on
  pre-plan, plan and roadmap (transcript `c580b1d8`, lines 234-510) and principle 7 (transcript `e152c9d8`, line
  29030). Both are used above: the first point of "What exists", and the Why.

# Roadmap

The one living plan of js-harness: what is decided, what is done, what is next, and which
decisions are still open. Each fact lives in one place:

- **This file** — the plan. What comes next is read here, under [Next](#next), and nowhere else.
- [origin.md](origin.md) — where the plan came from, frozen: the founding pre-plan with the
  reasoning and sources behind it. It is not edited; what changed since is recorded here.
- `odd/tasks/<feature>.md` — one feature's tasks, progress and evidence. Its next step covers
  only that feature.

## Origin

js-harness is the rebuild of an earlier harness (`D:\harness`, now a read-only reference). The
bet: a stronger model needs a smaller harness — little instruction, many executable checks — on
top of gentle-ai (workflow, TDD, review), engram (memory), codegraph (code graph), context7 (docs)
and native `/goal` (autonomy loop). This repo builds only what those leave open.

## Principles

**Regla 1: el pase de profundidad.** Before large work is built, and whenever he asks, its feature document holds a depth pass in his order, committed with documents alone before the first code (`rule:depth-pass`, `js-harness-protocols` section 9). It is Principle 7's practical form, and it heads the principles while the seven keep their numbers and words, by his answer to question 144 (2026-10-31, the lead's transcript `0f71b2c6`, line 43523): "Encabeza los principios y el 7 se queda (Recomendada)". His words, 2026-10-31 (line 42804): "la regla numero 1 sobre la que siempre se va a basar el modelo".

1. **Few instructions, many sensors.** A check that runs costs zero tokens per turn and cannot be forgotten.
2. **Every component must earn its place.** Each new model: remove one piece, measure, keep what still matters.
3. **Do not rebuild the stack.** Workflow, task docs, TDD and review are gentle-ai's; memory is engram's; the code graph is codegraph's; the loop is `/goal`. Changing, by his words of 2026-10-26 (Decided, "Direction"): gentle-ai leaves, and js-harness carries the workflow, task docs, TDD and review itself; engram, codegraph and context7 stay, installed by js-harness.
4. **Context, not commands.** What the project is, what good looks like, and the reason behind each real constraint.
5. **One host, one reviewer.** `AGENTS.md` holds what any host or reviewer needs: what the project is, what good work looks like, its constraints; Codex, the reviewer, reads it alone (Decided, "Host", 2026-10-30). Claude works from a root `CLAUDE.md` that imports `@AGENTS.md` and holds how sessions work with the owner, by his answer of 2026-10-26 (diet D3), since Codex is only a reviewer here. Built at F8's S3 (`odd/tasks/f8-s3-split.md`), and `init` ships the same split to a project that has neither file.
6. **Measure the real payload.** The budget gate counts everything that loads each turn, not only `AGENTS.md`.
7. **Work to the objective, not at will.** Judgment acts inside the plan: the double review checks that the work still serves the objective and what was planned, which is why a feature starts from a plan made as close to perfect as possible. His words, 2026-10-18: "siempre debes trabajar conforme al objetivo no como se te de la gana esa debe ser la filosofia principal del harnes osea para eso siempre hay una doble revision para revisar que vamos bien y no nos hemos salido del objetivo o de lo planeado por eso tambien cuando comencemos con el harnes debemos armar muy bien el plan casi a la perfeccion".

## Measured starting point (2026-09-26)

First request of a one-word prompt, estimated tokens:

- Claude Code 2.1.283 in an empty folder: ~107.8k. Tools 77.4k — of which the claude.ai Magnific
  connector alone is 37.3k (150 tools) and nothing in the stack uses it; global `CLAUDE.md` 17.5k
  (the gentle-ai managed block is most of it); environment, MCP instructions and skills list 11k.
  Measured with `--print`, which defers no tools, so the tool figure is an upper bound.
- Codex CLI 0.157.1: ~14.5k of injected context measured (global `AGENTS.md` 7.3k). Through a
  custom provider Codex sent no tools and no base instructions, so this is partial.

## Decided

| Area | Decision |
|------|----------|
| Name, home | `js-harness`, `D:\js-harness`, `github.com/jsaristi/js-harness`, public since 2026-10-16. It had stayed private by his answer "Se queda privado" (the lead's transcript `65318fd5`, line 13033, 2026-10-13). On 2026-10-16, to get free parallel CI gates (`odd/tasks/first-version.md`, S7), a read-only audit of every branch and pull-request ref found no secret and no third party's data, only his own (his outlook address on web merges, his name, paths of his machine, quotes of his words); asked, he tapped "Sí, así como está (Recomendada)" (the lead's transcript `e152c9d8-53bc-4366-8fa5-526b1576bcb6`, line 11108, 2026-10-16T11:08Z, read with `js-harness sessions --quote`), and the lead made it public the same hour |
| CI | GitHub Actions alone (2026-10-27). His words (the lead's transcript `0f71b2c6`, line 1971): "el repositorio es publico asi que no vamos a volver a utilizar circleci eso lo vamos a eliminar por completo vamos a hacer todos los test unicamente en github". CircleCI came in on 2026-10-14 to test the merge queue's candidates because the repository was private and a GitHub run spent minutes of an account with 2,000 a month and no card (`odd/tasks/merge-queue.md`, L3 and L5; `odd/tasks/drop-github-gate.md`, Why). That reason is gone since the repository went public (Name, home). What replaced it: `.github/workflows/gate.yml` runs for a push to a `queue/` branch as well as a `gate/` one, and `merge-queue --land` lands a candidate on that run's green; the commit gate and the daily Windows suite were already on GitHub (`odd/tasks/drop-circleci.md`) |
| Hosts | Claude Desktop's Code tab alone, with Codex as the reviewer (Decided, "Host", 2026-10-30). Until then: Claude Code and Codex (CLI + desktop), Antigravity later |
| Host (2026-10-30) | **Claude Desktop only.** His words (the lead's transcript `0f71b2c6`, line 33574): "la idea es que este arnes funcione unicamente y exclusivamente para Claude Desktop y todas sus funcionalidades en conjunto con el revisor Codex, si anteriormente lo queria mas generalista o algo asi, poues acabo de decidirme completamente solo por Claude Desktop en su version Claude Code y es unicamente para esto y enfocado y especializado al maximo para que el entorno tanto de desarrollo como de investigacion sera el maximo y mejor posible." The harness is built for the desktop app's Code tab and uses its features; Codex stays the reviewer and reads `AGENTS.md`; Antigravity leaves the plan. What it removes and in what order is proposed in [claude-app-native-sessions.md](proposals/claude-app-native-sessions.md), sections 8 and 11, each step his to accept. Its D4, step 6, answered "Sí, sácalos (Recomendada)" (question 136, the lead's transcript `0f71b2c6`, line 39049, 2026-10-31): `install` writes no Codex skill or hook, and the next `install` or `sync` removes the copies earlier versions wrote; `codex-review` is unchanged ([drop-codex-components](../odd/tasks/drop-codex-components.md)) |
| Stack | gentle-ai 4 (ODD, RDD review, test-first by default), engram 3 (the binary, and its Claude plugin since `gentle-ai sync` installs it: hooks and one skill, no second MCP server), codegraph, context7, `typescript-lsp` plugin; graphify for non-code corpora only. **Changing** (Decided, "Direction"): gentle-ai leaves at F8's S2, and js-harness installs engram, codegraph and context7 itself from S11 |
| Direction (2026-10-26) | **Replace gentle-ai, do not exclude it.** His words (transcript `e41d1e8d-8264-45a4-b16c-f9279f7b6076` line 2272): "no Orca ni Herdr lovamos a volver a utilizar y gentle-ai tampoco la idea es copiar la forma de funcionar con sus complementos osea traernos codegraph, context7 y engram y nuestro arnes fusionado de gentle con js-harnes mas funcionalidades de nuestras caracteristicas con ajustado a nuestras necesidades etc etc". gentle-ai, Orca and herdr leave his machine; js-harness copies gentle-ai's way of working and installs codegraph, context7 and engram itself; gentle-ai's repository stays a source of ideas, never installed. Then, the same evening: every slice gets two reviews, always, Codex and Claude's lenses ("revision siempre, ya que siempre necesitamos una segunda opinion con un segundo modelo pero tambien una revision del mismo claude por que asi nos aseguramos criterio y solidez", line 2351); "recuerda que todo este mismo trabajo es como va a trabajar el arnes en los proyectos" (line 2382), so every project `init` sets up works the same way; and the persona's voice is neutral, not copied, with context7 always on in projects ("la 7 la voz hazlo en neutro osea que no copiemos eso y el context7 siempre va a encendido en los proyectos, de resto rodo me parece excelente y que esta bien y que lo coloquemos todo", line 2466); and the rule for all of it, "ok entonces copiamos e implementamos solo lo que nos sirve el resto no" (line 2646): a gentle-ai piece is copied only for a need of ours, stated beside it. How: [the diet's section 18](proposals/harness-diet.md#18-sixth-pass-replace-2026-10-26) and [the reverse-engineering document's "Direction"](proposals/gentle-ai-reverse-engineering.md#direction-replace-not-exclude-2026-10-26). |
| Instruction source | A root `CLAUDE.md` on every Claude turn, which imports `@AGENTS.md` (Principle 5, diet D3, built at F8's S3); Codex reads `AGENTS.md` alone; the skills `install` writes for Claude Code (`js-harness`, `js-harness-orchestrator`, `js-harness-protocols`) load on demand, and nothing is written under `~/.codex` (the proposal's D4, below in "Host") |
| Distribution | A zero-dependency npm package with a `js-harness` bin; semver, git tags, releases |
| Release source | Built 2026-10-16 (`odd/tasks/first-version.md`, T4 and T4b): git tags in the repository (`<pm> i -g github:jsaristi/js-harness#vX.Y.Z`, latest from `git ls-remote --tags`), using the git credentials already on the machine. An npm publish was planned for once the repository is public; it is public since 2026-10-16 (Name, home), and that step still has no date. Tagging was first to start at 1.0.0, with the first complete and usable version (decided 2026-10-12: asked how to fix the installer's message that named a version that does not exist, he wrote "Corregir el mensaje por que todavia no tenemos produccion, cuando ya terminemos todo y tengamos una primera version completa y utilizable que no estemos tan experimental ahi si comenzamos a etiquetar versiones desde la 1.0.0", the lead's transcript `65318fd5-80e7-4bb8-92b5-06737140185b`, line 8986); Versioning, below, replaced that, and v0.9.0, v0.95.0, v0.96.0 and v0.97.0 are tagged (`git tag -l 'v*'`, 2026-10-23). No command asks a package registry about the name `js-harness`, which nobody holds there: `status --global`, `update` and `upgrade` read the newest `vX.Y.Z` tag with `git ls-remote` (`--repo` or `JS_HARNESS_REPO` names another repository, a test's local one), and until the first tag they say that no release is tagged yet; `--source`, a folder of tarballs, still wins when named (2026-10-13, `odd/tasks/install-update.md`, T5; tags 2026-10-16). A machine is installed from the default branch (`github:jsaristi/js-harness`). A project pins a version, never a source, so the switch changes no `harness.json` (decided 2026-09-26) |
| Versioning | The first tag is v0.9.0, a rehearsal release, and the first definitive one is v1.0.0, which adds one new feature so that `upgrade` from 0.9.0 to 1.0.0 proves the update path before the version calls itself stable; patches after it are 1.0.1, 1.0.2. This replaces "tagging starts at 1.0.0" in Release source. Asked, between "0.9.0 → 1.0.0 (Recomendada)" and "1.0.0 → 1.1.0", he tapped the first (the lead's transcript `e152c9d8`, line 29367, 2026-10-18T01:51Z), after asking "o prefieres que la version inicial sea la 0.9.0?" (line 29353). Each tag still waits for his yes; the work is `odd/tasks/harness-review.md` |
| License | MIT, in `LICENSE` and `package.json`. Chosen before the repository went public for free parallel CI gates (`odd/tasks/first-version.md`, S7): asked which license, among MIT, Apache-2.0, AGPL-3.0 or none, he tapped "MIT (Recomendada)" (the lead's transcript `e152c9d8-53bc-4366-8fa5-526b1576bcb6`, line 10941, 2026-10-16T10:55Z, read with `js-harness sessions --quote`) |
| Commands | The list in force is the dispatcher's help (`bin/js-harness.mjs`), with a TUI over part of it (`bin/tui.mjs`) |
| Task contract | The contract is the head of the ODD feature document, not a second file: a feature doc with `## Goal` is a contract, with the sections of [origin.md](origin.md#task-contract-template). Its done-when commands are list items that open with a code span and say `exits 0`. `js-harness contract check` validates it and the `check` row `contracts` does so statically, never running a command; `contract run` runs them and prints `met` or `not met`; `contract goal` prints the `/goal` condition, which is `contract run` on the absolute path, so the evaluator judges command output, not prose. Closed feature docs are not retrofitted (2026-09-29, `odd/tasks/task-contract.md`) |
| Sensors | `check`, and so every pre-commit it guards, runs a project's own sensors: named commands that must exit 0, from `harness.json` `sensors` (any language; an empty map is a named opt-out) or else `package.json`'s `test`, `lint` and `typecheck` scripts through `npm run`, each a row, under a throwaway home and npm cache. A `review` row shows gentle-ai's risk tier for the pending change and whether review is due; it is INFO and fail-open, never a gate, because RDD is Sebastián's switch. This repo declares no lint or typecheck: one would need a dev dependency (2026-09-30, `odd/tasks/sensors.md`). A project may declare its documents in `harness.json` `documents` (folders ending in `/`, or single files; no patterns): a commit whose every staged path is one of them runs no sensor and says so in a row, while the budget and the contracts are still checked. So does a commit, a merge above all, whose index differs in documents alone from the trunk as origin names it, or from `MERGE_HEAD` where git wrote one: the trunk merged into a branch of documents, whose code is the trunk's (2026-10-14, `odd/tasks/merge-documents-skip.md`). Off unless declared, since in another project a document can be the product; this repository declares `docs/` and `odd/tasks/` (2026-10-11, `odd/tasks/gate-lock.md`). A project may also declare `documentSensors`, named commands of the same shape, for the checks that read its documents: a commit of documents alone runs those, each a row, for two minutes each at most and with no gate lock taken, and any other commit runs `sensors` as before; this repository declares its rules check and the two test files that read its documents (2026-10-12, `odd/tasks/gate-wait.md`). A project may declare `"sameTree": "skip"`: a gate whose tree, file for file, with the same sensors on the same Node, is the one a gate already ran every sensor on and passed, by a line of the gate log, runs no sensor and takes no lock, and says in its row which gate is the proof; off unless declared, since the key of a tree holds no file git ignores; this repository declares it (his decision of 2026-10-12, the lead's transcript, line 3913; built 2026-10-13, `odd/tasks/gate-wait.md`, T12). A pass is no proof where a gate of the same files failed after it, or before it under another key than the pass (GitHub's machines, which have none; another WSL2 distribution or node; Windows against WSL2): every gate's end, CI's included, names the key of its files and the one it ran under, so a failure on CI is not answered by a narrower pass in the WSL mirror (2026-10-30, `odd/tasks/gate-narrow-pass.md`). Those failing ends are also kept in a file of their own beside the log, which keeps months where the log keeps days, so its rotation forgets none of them; a pass whose end names no files proves nothing (2026-10-31, `odd/tasks/gate-push-holes.md`) |
| Reversibility | Every file written outside the repo is in a manifest (path + sha256); uninstall is exact |
| Two levels | Installed once per machine (`npm i -g`), like gentle-ai; enabled per project with `js-harness init`, like `git init` |
| Command scope | A command that exists at both levels acts by location, like npm: inside an initialized project (a git repo with `harness.json` or a project manifest) it acts on the project, anywhere else on the machine; `--global` forces the machine from anywhere. Inside a git repository that is not an initialized project, or with an explicit `--cwd` that is not one, the command refuses and names `--global`, so repeating it never reaches the machine by accident. `uninstall` first, `sync` next (decided 2026-09-28) |
| Uninstall kinds | Each kind of uninstall has a name that never acts by location: `uninstall project`, `machine`, `snapshots` (`--global --full`) and `everything` (`--global --everything`); bare `uninstall` and its flags are unchanged. The TUI has one Uninstall item that opens a submenu of the kinds, Project only where there is a project to undo, each with its own y/N saying what it removes and keeps. Per-host and stack kinds are out (Sebastián, 2026-10-19, option 1; `odd/tasks/uninstall-kinds.md`) |
| Clean | `js-harness clean` lists the regenerable leftovers the stack leaves (old Codex releases, old Claude Code CLIs, Codex staging, old test scratch, the npm, pnpm, Go and uv caches) and deletes only the kinds he confirms, package caches through their own tools, each deletion recorded under the home (Sebastián, 2026-10-20: "Listo hagamos esto"). The measure that recommends it runs detached from `doctor` and its session-start hook at most once every 7 days, and the `clean` row is a gap from 2 GB; the doctor row was picked over a question to the orchestrator because the hook already runs on every machine and notices a change once. The interval, the threshold, the 3 days of scratch age and the notice wording are assumptions he has not confirmed (`odd/tasks/clean.md`, S10) |
| Per project | `init` writes a committed `harness.json` that pins the version, a base `AGENTS.md` only if none exists, and the `check` gate in pre-commit, and runs `codegraph init`; `sync` brings the project to its pinned version; raising the pin is an explicit commit, like a lockfile. When the running js-harness differs from the pin, a project `sync` writes nothing and names both ways out: the command that installs the pinned version, or the commit that raises the pin; it never changes the machine from inside a project (decided 2026-09-28) |
| Stack visibility | js-harness sees the whole stack but changes only its own files: it reports each tool as installed, configured and up to date, and prints that tool's own command for any gap. One exception since 2026-10-19 (Sebastián: "tenemos que colocar el modulo de install 3rd plugins o complementos obligatorios", `odd/tasks/stack-install.md`, L1, L4, L5): `js-harness stack install` runs a mandatory tool's own install or registration command after the person's yes, records it in the machine manifest first, and `uninstall machine` runs its exact undo; gentle-ai and engram stay his step, through gentle-ai's own installer, whose uninstall is no exact undo |
| Notifications | Only on session start or resume, only when something changed since the last notice, and only through channels that cost zero model tokens (see Stack doctor notes) |
| Review | gentle-ai RDD on every candidate; Sebastián pre-grants consent. Codex reviews the same slice after each code commit: `js-harness codex-review --base <boundary>` runs `codex exec review` and records the review only on evidence that Codex read the diff, every changed line of the branch's patch in the output of its successful commands (2026-09-29, `odd/tasks/codex-exec-review.md`), or records an explicit `--unavailable` skip, under the git common dir; the pre-push hook runs `check --push`, which refuses a branch with a code commit no record covers (2026-09-29). Not the plugin's per-turn stop gate. The review runs in one session, the lean one (2026-10-08, `odd/tasks/codex-review-lean.md`): it loads the diff, read access to the repository, the project's `AGENTS.md` and Codex's own review rubric, and leaves out the user's Codex configuration (global instructions, skills, plugins, MCP servers, hooks); a large range is reviewed in parts. `--session current`, which loaded the user's own configuration instead, was removed on 2026-10-08 because the model it ran on could not be verified (until that day it ran on whatever `~/.codex/config.toml` named); a machine where the lean session cannot run records an `--unavailable` skip. A review that fails is not that case: it is repeated, and at or under the floor of the weekly use of his Codex plan, `rule:codex-weekly-floor`, the command starts nothing and he decides on the reset; on his typed no a Codex skip is recorded, a second Claude review runs in Codex's place, and `codex-meter` and the merge door list the debt until a Codex review pays it (Sebastián, 2026-11-02, `odd/tasks/double-review-alignment.md`, T2; it replaces his "never recorded as a skip" of 2026-10-11). Review model: `gpt-6.1-sol`, fixed by the command (Sebastián, 2026-10-08, `odd/tasks/codex-review-cost.md`), at the effort of `rule:review-effort`, so neither a `gentle-ai sync` nor `~/.codex/config.toml` changes them, and a review whose session ran on anything else, as its own rollout file says, does not stand. Since 2026-10-08 a review reads only code (not Markdown, not the paths a project marks `-codex-review` in `.gitattributes`), starts where the review records end and starts nothing over a range they cover whole (`--again` reviews it on purpose), prints its plan and an estimate before it spends (`--plan` prints them and starts nothing), and refuses more parts than `rule:review-parts-unflagged` without `--max-parts`; `check` says at every commit how much code waits for a review. Since 2026-10-14 a review runs out of the gate lock unless its caller holds a turn: Codex's `node --test` is refused by a preload in `NODE_OPTIONS`, the own prompt tells it the gate already ran the suite on the range, and an `incorrect` that rests on those refusals alone, with no finding of P0 to P2, owes no correction and is marked `excused` in its record (`odd/tasks/faster-check.md`, part 2) |
| Progress view | The plan and each feature doc hold their steps as checkboxes, so progress is computed by a command, not reinterpreted by a model. `js-harness progress` prints the whole checklist in the terminal (and so on Codex); `--json` gives the same data, which Claude Desktop and mobile render as an inline chat widget on request — no published page (decided 2026-09-27) |
| Eval spend | No USD ceiling for F5 (Sebastián, 2026-09-30). Runs use the flat-rate subscription, so the limits are tokens, wall time and the plan's usage cap; the runner records the first two per trial and stops cleanly on the third (`odd/tasks/evals.md`) |
| Eval verdict | Per task and effort, score is the floor and cost decides between equals: scores are equal when their gap is within max(0.02, pooled SD); unequal scores make the higher one win; equal scores with a cost gap above the pooled cost SD make the cheaper config win; anything else is `none`. Cost is Claude Code's `total_cost_usd`, the list cost of the whole session, subagents included. The predecessor's score-only rule is printed beside it (Sebastián, 2026-10-02; `odd/tasks/evals.md`, Constraints) |
| Rule proof | A recorded run proves that a case tells its rules apart only when it clears a bar (2026-11-11): five scored trials or more on each arm and the same count on both, from two runs of one agent, model, permission mode and effort, and the arm with the rules above the arm without them by more than the spread of their trials, the one the A/B report uses (Eval verdict). The values are code's: `MIN_TRIALS` and `tellsApart` of `evals/rule-proof.mjs`, `scoreSpread` of `evals/report.mjs`. It replaces two trials an arm and any gap (F8's S5c-a), which called a proof on noise in 20 to 43 percent of draws from the recorded scores and tied both proofs that were paid for; the two records on file stay as written and are named as of the earlier bar, so every case is owed today. What it gets wrong, enumerated in `evals/rule-proof.test.mjs` for a case that scores a trial 1 or 0.5: a false proof in at most 9.4 percent of draws, about one in eleven cases proven at once, and a rule whose absence fails three trials in ten clears it in 47 percent of runs, 81 at five in ten, so a record short of the bar is no evidence that the rule changes nothing. A proof costs ten trials. Built with it, none of it a spend: a case may hold `habit/`, the failure it exists to catch, which its grader must fail (`evals/task-proof.mjs`; three cases hold one and 18 are on a list that only shrinks); the A/B report checks each Claude trial's cost against the list prices and leaves out one outside their range; `suite.mjs --plan` says what each task has passed and names the ones that never failed or never passed. Asked in the audit triage (`docs/proposals/2026-11-10-audit-triage.md`, question 2), whose recommended option read "Subir la vara y arreglar los casos primero, sin gastar (Recomendada). Por ejemplo 5 intentos por lado y una diferencia mayor que la variación medida, y arreglar o quitar los casos que siempre pasan o nunca pasan", he answered every question of it with that option: "contesta TODAS las preguntas con recomendado TODAS y avanza los mas posible eres completamente autonomo" (the lead's transcript `ea85ec35-82e1-4aa9-abe3-98bd153a50b0`, line 6905, 2026-11-11T05:30:20Z). It covers no paid run, and no case left the set: which do is his (`odd/tasks/audit-u9-eval-bar.md`) |
| Effort | Claude: designing the harness, planning and verifying run on Opus 5.5 at `high` effort at least, or on Fable 5.5 at `high` once it exists, and on no other model (Sebastián, 2026-10-10). In this repository's way of working a sub-agent that writes scoped code is launched on Haiku 5.5, by the model on its call (`rule:session-model`; Sebastián, 2026-10-11, on "Subagent models result" below), one that explores, reviews or verifies on Opus 5.5 at least (`rule:session-model`), and every one at the effort `rule:session-effort` gives; what the harness turns on by default in a project is not decided. `medium` runs only as a trial, on the main thread of a closed-scope build, alternated by slice with `high` (`docs/model-effort.md`, C2). The cap is `maxEffortLevel: "high"` in user settings. Codex review (`gpt-6.1-sol`): the effort of `rule:review-effort`, fixed by the command, in the one session there is, the lean one (2026-10-08; `--session current` was removed that day because its model could not be verified; see Review) |
| Autonomy | Native `/goal <condition>`, not a loop of our own |
| Context | `autoCompactWindow: 350000` (his setting of 2026-10-15), which the context pause reads to know where the host compacts; a session holds one feature, and when it cuts is `AGENTS.md`'s ("Working with Sebastián"); the context pause, which decides between finishing a task and compacting inside it, is designed in `odd/tasks/session-channel.md`; state lives in files, not a handoff ritual |
| First version's scope | **Since 2026-11-01, his growth limit, `rule:growth-limit`.** Asked by the lead, after he read [the re-planning analysis](../odd/tasks/replan-analysis.md) (section E) and its page: "¿adoptas el ajuste, es decir, seguir con F8 y poner el límite al crecimiento?" (the lead's transcript `0f71b2c6`, line 48066), he typed "Listo entonces continuemos y reactives todo para hacer le plan" (line 48080, 2026-11-01T18:44:12Z, read with `js-harness sessions --quote`). What it holds and how the week is computed are the rule's, read with `js-harness rules growth-limit` and the last line of `js-harness progress --pace`. It replaces his "No, sigue entrando" of 2026-10-17 (transcript `e152c9d8`, line 17535), the answer that kept new work entering the first version, and his reason of 2026-10-14 for it ("tiene que quedar funcionando como un reloj suizo", transcript `ffe99ebf`, line 5853) ([replan-execute](../odd/tasks/replan-execute.md)) |
| 1.0.0 and gentle-ai #4036 | **Since 2026-11-02, 1.0.0 no longer waits for gentle-ai #4036:** it comes after the real feature in plataforma-preproyecto ([the outside feature](#the-outside-feature-the-re-plan-of-2026-11-01)) and S8, and it is the version that feature ran on; it still goes through its full review ("1.0.0 review and record" below). Asked by the lead (question 153), "Recomiendo cambiarla: la 1.0.0 sale después de la funcionalidad real en plataforma-preproyecto y del S8, y es la versión con la que corrió esa funcionalidad. Un sí cambia solo esa línea de la hoja de ruta; no publica nada ni adelanta la 1.0.0, que sigue pasando por su revisión completa", he tapped "Sí, tras la función real" (the lead's transcript `0f71b2c6`, line 50690, 2026-11-02T09:04:33Z, read with `js-harness sessions --quote`). It replaces, kept as history: 1.0.0 waited for the three tasks that wait for gentle-ai to publish its issue #4036, though nobody knows whether it will; asked, between "No la espera (Recomendada)" and "Sí, la espera", he had tapped "Sí, la espera" (the lead's transcript `e152c9d8`, line 17535, 2026-10-17T01:22:06Z) |
| 1.0.0 review and record | Before the 1.0.0 tag, the whole project is reviewed and documented so that it can later be rebuilt exactly by reverse engineering: "Quiero que cuando lleguemos a la version 1.0.0 hagamos una revision completa de todo el proyecto y de una ve documentamos para poder en un futuro hacer un ingenieria inversa exacta y precisa." (typed, the lead's transcript `e152c9d8`, line 21180, 2026-10-17T09:32Z). Its scope, readers and record are designed when 1.0.0's other tasks are done; the per-session summaries (`odd/tasks/session-close.md`, his order of the same day, line 21112) are part of what it reads |
| Releases before 1.0.0 | Releases go on as 0.x minors (0.98.0, 0.99.0, 0.100.0, 0.101.0…) until everything is verified to be right; only then is 1.0.0 analyzed and tagged: "yo creo que vamos a seguir como el 0.100.0 o 0.101.0 etc hasta que no verifiquemos bien que todo esta bien para hacer el lanzamiento" (typed, 2026-10-24, the lead's transcript `908805db`). `compareSemver` orders them numerically: 0.100.0 is newer than 0.99.0 (`bin/lib/version.mjs:15`, checked by the lead on 2026-10-24). **Since 2026-11-02, "verified" also counts the real feature in plataforma-preproyecto working:** no 1.0.0 until the harness has built something of his and it works. Asked by the lead (question 154), "Recomiendo que también cuente la funcionalidad real en plataforma-preproyecto: no hay 1.0.0 hasta que el arnés haya construido algo tuyo y funcione. Un sí agrega esa condición a la línea de la hoja de ruta; no publica nada ni cambia las 0.x que siguen saliendo", he tapped "Sí, cuenta la función real" (the lead's transcript `0f71b2c6`, line 50775, 2026-11-02T09:10:25Z, read with `js-harness sessions --quote`). Before it, kept as history, "verified" looked only inside the harness: its tests, reviews and evals. The 0.x minors go on as before. |
| Throughput review protocol | A fixed procedure with a command measures where the time goes, keeps a dated snapshot a day, enters each improvement with its baseline, target and cost, and measures it again after it ships; the double review (`rule:double-review`) runs only before a proposal reaches him, and two runs in a row that find nothing worth building make it weekly (the lead's `throughput-v3-plan.md`, version 2, in the side-session notes). Asked whether he approved it, he tapped "Sí, aprobalo (Recomendada)" (the lead's transcript `e152c9d8`, line 18165, 2026-10-17T02:14:08Z) |
| Windows suite | The Windows suite, which no gate ran though `README.md` promised it, runs once a day (`.github/workflows/windows-daily.yml`, read by `js-harness windows-daily` and the lead's heartbeat; `odd/tasks/commit-gates-first.md`, T4), off the land's path, after the Windows sensor bound is settled (`odd/tasks/first-version.md`, T6f); running it on every batch would take 15 to 19 hours of the gate lock a day. Asked how often, he tapped "Una vez por día (Recomendada)" (the lead's transcript `e152c9d8`, line 18165, 2026-10-17T02:14:08Z). Merged via `jsaristi/js-harness#367`; its first run on `main` (run 39011662138, 2026-10-17) passed: 6,116 tests, 0 failed, 11 skipped, in 12 min 28 s |

## Phases

What each phase must deliver. Its steps are the checkboxes under [Checklist](#checklist), and
`js-harness progress` counts them; a phase's state is read there, not re-judged from this table.
A feature that is not a phase has no row here: its steps are the checkboxes of its
`odd/tasks/<feature>.md`, and of a Checklist section when it has one (the session board), and
`progress` counts both.

| Phase | Done when | State |
|-------|-----------|-------|
| F0 Safeguard and baseline | Old repos committed and pushed; per-turn payload measured on Claude and Codex; old folders marked read-only | Done 2026-09-26 |
| F1 Skeleton | `AGENTS.md` ≤ ~1.5k tokens with the prompt audit applied; a dependency-free `check`; pre-commit wired | Done — `AGENTS.md` 691 tokens (`odd/tasks/f1-skeleton.md`) |
| Install and update | `npm run check` and `npm run e2e` pass; the TUI opens with no arguments in a terminal | Done, reviewed, merged to `main` 2026-09-26 via `jsaristi/js-harness#1` (`odd/tasks/install-update.md`) |
| Stack doctor | `js-harness doctor` reports gentle-ai (its row leaves at F8's S11, Decided, "Direction"), engram, codegraph, context7 and `typescript-lsp` as installed (with version), configured (per host and per project, read-only) and up to date, or `unknown` when it cannot tell, with each tool's own fix command; results cached 6 h and fail-open offline; a `SessionStart` hook (startup and resume) on Claude Code and Codex notifies through `systemMessage` only when something changed and never writes to stdout; the TUI shows the stack state above the menu; the hook entry is recorded so `uninstall` removes exactly it; tests use fixtures, never the network | Done, reviewed, merged to `main` 2026-09-27 via `jsaristi/js-harness#4`; installed on this machine, hook registered in Claude Code and Codex; the Windows exit crash that install found was fixed via `jsaristi/js-harness#5`, and the global package matches `main` (`js-harness doctor --hook` exits 0, 2026-09-27) (`odd/tasks/stack-doctor.md`) |
| Stack install | `js-harness stack` lists each missing mandatory tool the project needs with its command and its exact undo, read-only (`--json` for onboarding); `js-harness stack install` runs those after the person's yes (`--yes --tool <id>` without a terminal), records each in the machine manifest before it starts, and `uninstall machine` undoes them, the last first; the TUI offers it after Doctor while a tool is missing | Slice 1 (the read-only list) merged to `main` via `jsaristi/js-harness#472`; slice 2 (install, undo, TUI, the trial script) is `jsaristi/js-harness#473`, reviewed by gentle-ai and Codex; the trial on a scratch home passed on 2026-10-20 (`node scripts/stack-scratch.mjs`: four rows installed, `doctor` ok on them, all four undone, none of his files changed). Follow-ups T6, T7 (`odd/tasks/stack-install.md`) |
| Progress view | The phases in this file carry checkbox steps; `js-harness progress` reads a project's `docs/ROADMAP.md` and `odd/tasks/*.md` and prints every phase and feature with checked and pending steps, percentages and what remains; `--json` returns the same data; tests use fixtures; js-harness uses it on itself first | Done, reviewed, merged to `main` 2026-09-27 via `jsaristi/js-harness#6` (`odd/tasks/progress-view.md`); every later phase is tracked with it |
| F2 Context diet | The budget gate measures the full payload (global `CLAUDE.md` + hooks + `AGENTS.md`); codegraph prompt hook measured with and without; gentle-ai v4 adopted when released; block exclusion via gentle-ai #4036 if it ships | Measurement done, reviewed, merged to `main` 2026-09-28 via `jsaristi/js-harness#7` (`odd/tasks/f2-context-diet.md`); gentle-ai 4.0.0 adopted 2026-10-01, merged to `main` 2026-10-03 via `jsaristi/js-harness#25` (`odd/tasks/stack-v4.md`), and it is not a diet: Claude went from 20,651 to 21,104 estimated tokens per turn and Codex from 10,510 to 25,515, since v4 gives Codex the full orchestrator; the last step waits on gentle-ai (#4036 is open, checked 2026-10-15). The fixed load of a session, measured 2026-10-15 (`odd/tasks/fixed-load.md`): about 110k tokens before the first message in the desktop app, 63.5k in the headless CLI; the global `CLAUDE.md` is 28.2k of it, 24.8k in gentle-ai's orchestrator and routing blocks |
| Project init | `js-harness init` in a repo writes the per-project files above, all recorded in a project manifest, and `uninstall` there restores the repo exactly; `sync` moves a project to its pinned version; the TUI offers `init`/`sync`/`status` inside a project, above the machine commands (Sebastián, 2026-09-29), and the machine commands outside one; `doctor` reports the Codex plugin, and the Codex review of each approved code slice leaves a record a check verifies | Done 2026-09-29 (`odd/tasks/project-init.md`), seven slices stacked to `main`: the git-spec install through the pnpm shim works since `jsaristi/js-harness#8` (the package no longer runs `prepare`); `init` merged via `jsaristi/js-harness#9`; project `uninstall`, with `init`'s review follow-ups, merged via `jsaristi/js-harness#10` (2026-09-29); project `sync` by location merged via `jsaristi/js-harness#11` (2026-09-29); the TUI by location merged via `jsaristi/js-harness#12` (2026-09-29); the Codex plugin in `doctor` merged via `jsaristi/js-harness#13` (2026-09-29); the verifiable Codex review record (`js-harness codex-review` and the pre-push `check --push`) merged via `jsaristi/js-harness#14` (2026-09-29). Its follow-ups are carried in the feature document |
| F3 Task contract | The contract template in [origin.md](origin.md#task-contract-template) + a validator that rejects a contract without a done-when command + fit with the ODD feature doc and `/goal` | Done, reviewed, merged to `main` 2026-09-30 via `jsaristi/js-harness#16` (`odd/tasks/task-contract.md`); its follow-ups are carried in the feature document |
| F4 Sensors | Tests, lint/LSP diagnostics, budget and RDD-by-risk wired to pre-commit and `check` | Done, reviewed, merged to `main` 2026-09-30 in two slices via `jsaristi/js-harness#17` (sensors) and `jsaristi/js-harness#18` (the review row and a sensor timeout that kills the process tree) (`odd/tasks/sensors.md`); its follow-ups are carried in the feature document |
| F5 Evals that discriminate | Tasks hard enough to separate configs (0 of 32 did at the start); A/B minimal vs current config at medium and high | Done, reviewed, merged to `main` 2026-10-03 in four slices via `jsaristi/js-harness#20` (runner, sandbox, isolation proof), `jsaristi/js-harness#21` (the five tasks), `jsaristi/js-harness#22` (engram isolation, safe process-tree kills, the suite entry) and `jsaristi/js-harness#23` (runs, report, result) (`odd/tasks/evals.md`): the minimal config matches the current one on score and costs about half; see [F5 result](#f5-result). Its follow-ups are carried in the feature document |
| Remote sessions | `js-harness remote start` keeps Claude Code's remote-control server alive in a git repository, so a session opened from the phone runs on this PC; `stop` leaves no process of it; `--at-login` brings it back after a restart, through a launcher that `uninstall` removes exactly; `doctor` says when the CLI and the desktop app are signed into different accounts, and when a launcher's server is down; a scheduled task brings back a server that died, never one stopped on purpose; the log is capped at 5 MB; the TUI offers the three commands inside a repository | Written, reviewed and merged on 2026-10-04, in three slices stacked to `main` (`odd/tasks/remote-control.md`): the supervisor and the three commands (`jsaristi/js-harness#28`), the login launcher with the TUI entry (`jsaristi/js-harness#29`) and the account check (`jsaristi/js-harness#30`). The live check passed the same day: after `remote stop` and `remote start` a session opened from the iOS app ran in `D:\js-harness`, and the final `remote stop` left no process. Reopened on 2026-10-06 (branch `fix/remote-watchdog`): the supervisor had been killed from outside and stayed down twelve hours, and the log had reached 71 MB. The log cap, the watchdog task and the `doctor` row are written and reviewed, and merged on 2026-10-06 as three pull requests stacked to `main` (`jsaristi/js-harness#35`, `#36`, `#37`); live on this machine since 2026-10-06 |
| F6 Codex parity | The eval tasks run on Codex; differences measured and written down | Two of three slices merged to `main` on 2026-10-05 (`jsaristi/js-harness#33`, `#34`); the third paused by Sebastián on 2026-10-06, closed by him on 13 of its 15 trials on 2026-10-12, and brought to `main` on 2026-10-13 from a branch cut from it (see "F6 result") |
| F7 Future-model protocol | A written procedure: measure payload, run evals, strip one component at a time | Procedure written 2026-10-14: [future-model.md](future-model.md), version 2 after one reader (`odd/tasks/future-model-protocol.md`); it cannot run on a new model until its gaps are built: G5, G6, G3 and G2 cleared for that feature, G1, G4 and G7 later |
| F8 Harness reorganization | The measures of [the diet's section 7](proposals/harness-diet.md#7-certification-how-it-works-is-proven) pass at thresholds frozen before the baseline, run with the desktop's own flags: the 9 S0 baseline measures before any cut and after each measured step, the 8 S8 release measures at the end (the 4 deferred ones are reported as not built, never as passed); a Claude audit and a Codex audit, three runs each, are graded side by side against the baseline; every row of [the diet's alignment map table](proposals/harness-diet.md#13-alignment-map-how-we-do-it-against-how-it-should-be-done), which is canonical over its Artifact copy, is aligned or kept by his decision. Its six checklist steps run in order, under [Next](#next) | Opened 2026-10-26 by his order. Step 0 done; step 1 in progress: the research and plan are written (`docs/proposals/harness-diet.md`, sections 1-19, and `docs/proposals/gentle-ai-reverse-engineering.md`, which holds the replacement matrix, S9's idea watch, the TUI proposal and how a project works with js-harness), graded four times by two blind readers (6.3 and 6.3 the second time; Claude 6.4 and Codex 7.0 the third) and revised; the sixth pass (2026-10-26) follows his direction to replace gentle-ai, Orca and herdr (Decided, "Direction"); the seventh pass corrects it after two blind grades (Claude 6.4, Codex 6.0), and a limited recheck gives Claude 7.4 and Codex 8.0, its residuals fixed by the lead. It takes over F2's two open steps. It reaches other sessions only once he lands PRs 593 and 594 |

## Checklist

### F0 Safeguard and baseline
- [x] Old repos committed and pushed
- [x] Per-turn payload measured on Claude Code and Codex
- [x] Old folders marked read-only

### F1 Skeleton
- [x] `AGENTS.md` within ~1.5k tokens with the prompt audit applied
- [x] A dependency-free `check`
- [x] Pre-commit runs `check`

### Install and update
- [x] `npm run check` and `npm run e2e` pass
- [x] The TUI opens with no arguments in a terminal
- [x] Reviewed and merged (`jsaristi/js-harness#1`)
- [ ] `upgrade` and the menu's Update and Upgrade reach the stack: the engram binary and plugin, codegraph, Codex (`odd/tasks/stack-upgrade.md`, S1)
- [ ] The menu's failure reported on 2026-11-06, reproduced and fixed (`odd/tasks/stack-upgrade.md`, S2; question 206)

### Stack doctor
- [x] `doctor` reports the five tools as installed, configured and up to date, with fix commands
- [x] 6 h cache, fail-open offline
- [x] `SessionStart` hook on Claude Code and Codex, `systemMessage` only on change
- [x] Hook entry recorded so `uninstall` removes exactly it
- [x] TUI stack block above the menu
- [x] Reviewed and merged (`jsaristi/js-harness#4`, Windows exit fix `#5`)
- [x] Installed on this machine; global package matches `main`
- [x] `doctor` `host-update` row: a Claude Desktop or Code tab CLI update is a gap, with its review steps, until `doctor --host-reviewed` records the review; an update downloaded and not applied is `outdated` (his request of 2026-10-15, `odd/tasks/host-update-check.md`; pull request 242, and its follow-ups: the app folder read under `--home` only, `--host-reviewed --json`)
- [x] The `host-update` review ends with a full report: what improved, changed and was fixed, how each helps or hurts, and what the harness should change; and `guard` holds a command typed into his terminal to a closing note saying what it does (his requests of 2026-10-19, `odd/tasks/terminal-note.md`)
- [x] `doctor` `gentle-ai-sync` row: a new gentle-ai version is a gap, with its review steps, until `doctor --gentle-ai-reviewed` records the review; one step diffs the global `CLAUDE.md`, which a sync rewrites and js-harness never writes, against gentle-ai's pre-sync snapshot, and the next checks the changes against `AGENTS.md` (his request of 2026-10-16, `odd/tasks/gentle-ai-update-check.md`; ticked in its own pull request, which lands at once)

- [x] `doctor` `js-harness` row: the hash of the installed copy's unscoped rules against main's, read fresh; `outdated` with the newest copy and the ids that differ (letter F, `odd/tasks/rule-hierarchy.md`, T16f second part)

### Progress view
- [x] Parser for roadmap phases and feature docs
- [x] `progress` and `progress --json`
- [x] Review follow-ups (fences, bad input, unknown flags)
- [x] The roadmap carries checkbox steps and `progress` runs on this repo
- [x] Reviewed and merged (`jsaristi/js-harness#6`)

### F2 Context diet
- [x] The budget gate measures the full payload (global `CLAUDE.md` + hooks + `AGENTS.md`)
- [x] codegraph prompt hook measured with and without
- [x] gentle-ai v4 adopted when released
- [ ] Block exclusion via gentle-ai #4036, if it ships
- [x] The fixed load of a session measured per part and owner, and a `fixed load` row in `check` that warns over `rule:fixed-load-budget` (`odd/tasks/fixed-load.md`)
- [ ] The cuts that document recommends, one at a time: moved, never deleted, measured before and after, proven by an eval, each undoable (his decisions there, named FL1-FL7 in the diet)

### F8 Harness reorganization
- [x] 0. His CLI login restored (`claude auth login`, his): done and verified 2026-10-26, `claude auth status` shows `loggedIn` and a refresh token is present
- [x] 1. Research complete: the diet proposal through its seventh pass, and the gentle-ai reverse-engineering proposal (`docs/proposals/gentle-ai-reverse-engineering.md`: the replacement matrix, the TUI, the idea watch that S9 builds, how a project works with js-harness), merged to `main` (PR 593 and PR 594, landed 2026-10-26 as `2ffbd7e`), and the map's rows current
- [ ] 2. His decisions from [the register in the diet's section 1](proposals/harness-diet.md#1-what-is-his-to-decide), split by kind. **Blocking**, asked one at a time before the step that needs them, each answer recorded with his words and the transcript line: D2 (spend), D5, D7 (one choice: accept the defaults or edit), D8 (all four answered 2026-10-26 with the recommended default, in the register), G12 (answered 2026-10-28, question 99: the Rules block), then G3 when PR #596 merges, G7 after S8. **By default**, taken by the lead with the stated default and recorded: G2, G8 and the style's name G10n (both taken 2026-10-27 for S10), G14 (S11), D4 (after S2). Answered: D3, G9, G10, G11; G13 decided by the lead (a skip is a debt); closed: G1, G4, G5, G6, D9
- [x] 3. A small baseline before any cut (S0): thresholds frozen in a commit; the credentials guard in `evals/home.mjs`; the 3-task eval, `honest-unknown`, `/context`, the `fixed load` row and the 10-case incident set run twice with the desktop's flags, their spread recorded. The long-session eval is designed now and built in parallel; it is S8's confirmation, not a gate. Done 2026-10-27 (`odd/tasks/f8-s0-baseline.md`, `## Baseline`): three runs; incidents 13, 14 and 13 of 20, so L 13, s 1, worse below 10, S8 target 17; false premise 2 of 4, below its line; `honest-unknown` and the 3-task eval meet theirs; $59.64
- [ ] 4. Migration, one reversible step at a time, each against the baseline with its own probe and pass line (the diet's section 10): S3 (the `CLAUDE.md`/`AGENTS.md` split, and an interim exclusion of gentle-ai's global file that banks ~30.7k at once); the directives pass, in its own PR right after S3 (his choice "Justo después de S3", transcript e41d1e8d): every directive of the plan, gentle-ai's kept ones and the js-harness protocols, written into `CLAUDE.md` and `AGENTS.md` so they are dogfooded, which takes S10's text part (the ODD sizing test and the feature document's order), the protocols in `CLAUDE.md` and `AGENTS.md` per D3, and not permissions, skills or S2; S1 (two reviews on every slice: Codex and the Claude lens runner, commit-range candidates, skips as a debt the merge path enforces); S10 (port: our style, the ODD sizing text once the directives pass has not taken it, two skills, the whole permissions object); S11 (js-harness installs engram, codegraph and context7, with presets; `bin/` and `evals/` stop depending on gentle-ai); S5c-a (directive coverage's mechanism, below); S13's rehearsal on a scratch project; S12 (the migration of an existing project, built and tested, then his listed projects); then S2: writers quiesced, a full backup, a restore drill that proves engram answers, the removal of gentle-ai, Orca and herdr, each asked first, the interim exclusion reverted, a smoke test, every session restarted; then S4a, S4b, S5, S6, S7; S5c-b (directive coverage's filling) after S8, only if S8's result shows it is needed (question 155, below). S9 is the host watch since question 129 (2026-10-30): each Claude Desktop update gets a session of its own and a review file (`odd/tasks/f8-s9-host-watch.md`); the gentle-ai idea watch it replaced leaves with gentle-ai at S2, and since 2026-11-03 comes back after S2 as a watch of gentle-ai's repository, its own feature (his words under S9). S3 built 2026-10-27 (`odd/tasks/f8-s3-split.md`): the split, `init` shipping it, the payload row reading the exclusion, the `CLAUDE.md` budget and the rewritten rule on where a rule lives (PR 602), the exclusion alone (PR 603); D7 put back on his answer (question 96); left: the `/context` check after a restart and the fixed load over five sessions. The directives pass opened 2026-10-27 (`odd/tasks/f8-directives.md`): S3's promise checked in a session started on `59df62f` (the worktree's `CLAUDE.md` and `AGENTS.md` load once each, the global file does not); protocols 4 and 8 written into `AGENTS.md`, the sizing test, the document's order and protocols 3, 5, 6 and 7 into `CLAUDE.md`, which measures 3108, so `claude-md-budget` went from 2500 to 3200 by his answer to question 97. S1 built 2026-10-27 (`odd/tasks/f8-s1-reviews.md`): `js-harness lens-review` runs the four Claude lenses over a commit range, each record pinned to its head and subject hash; `check --push` refuses a code commit either review leaves uncovered, `check`'s `review` row and `doctor` list the debt and the skips of both, and the merge door refuses a lens skip until a review pays it (PRs 607, 608, 613, 614); the probe 6 of 6 and the incident set 13 of 20, no worse. How gentle-ai works, read at v4.3.1 (the reverse-engineering document, section 13, 2026-10-28, accepted by him as relayed by the lead), adds small tasks to these steps and moves none (its 13.5): an S1 defect task for row 3 (review records written only by the commands, each lens record naming its run); rows 4, 12 and 15 into S10, row 12 now by the lead's call; rows 2 and 7 into S5; row 1 into S4b; row 9 into S7; rows 11 and 17 into S11; row 16 into S12; row 12's backup into S2; rows 13 and 14 into S8. S10 built 2026-10-28 (`odd/tasks/f8-s10-port.md`): `install` writes the `js-harness` output style, the two ported skills with their notices, the whole `permissions` object and the Rules block of G12 into his `~/.claude/CLAUDE.md`, each recorded and undone exactly by `uninstall`; `init` selects the style and writes the denies into a clone; `guard` refuses a file tool on a denied path (PRs 615, 617, 619); the probe in a scratch home and the five Spanish prompts 5 of 5; applied to his machine 2026-10-28 (question 102, "Aplicar ahora"), and the incident rerun on it, `f8-s10-incidents`: 13 of 20 (false premise 2 of 4), at the baseline's L of 13 and above its worse line of 10, so no worse; cases 01, 02 and 05 still fail every trial, and 10 passed 1 of 2, $10.61. S10 is done. S11 built 2026-10-28 (`odd/tasks/f8-s11-complements.md`): `stack` installs and registers engram, the engram plugin, codegraph and context7 with their own commands and undo, context7 required; `init --preset complete|lean|custom` (G14); `doctor` flags a project with context7 off and an engram plugin ahead of its binary (row 11); the gentle-ai rows, the merge door's gentle-ai line and the review starts leave; `bin/lib/gentle-ai-absence.test.mjs` holds the named list (PRs 627, 628, 629 and 632, merged 2026-10-28 and 29); the probe in a scratch home passes and `doctor` exits 0 here with gentle-ai still installed. Question 104 answered: where the Codex review is off, the merge door asks for the Claude lens record. Applied to his machine 2026-10-29 (question 106, "Aplicarlo al entrar 632"): `stack install` found nothing missing and wrote nothing, and `doctor` exits 0 before and after. S11 is done. Directive coverage (the same document, section 14, 2026-10-28, approved by him as relayed by the lead: "Listo, añadámosla") is an F8 step in two parts: S5c-a lists every source the harness ships or sends to an agent, cuts each into spans tied to a rule, gives every obligation a control (a check or hook with a planted break that turns it red, an eval case whose arm without the rule scores lower in a recorded paid run, or a dated `owed`, seeded as the baseline), adds `rules coverage` and the `rules check` refusal of a new gap, and ships them through `init` and S12; S5c-b declares every span and closes the seeded `owed` list. Pass line: `rules coverage --strict` and `--prove` exit 0, `owed` at most 10% at S8, every eval case names its rules, a planted directive without a control fails `rules check` on S13's scratch project, the incident set no worse. Its eval spend, about $95 to $130 over the envelope [i], goes to him when S5c-a starts. **Since 2026-11-02, S5c-b comes after S8 and runs only if S8's result shows it is needed**, so `owed` at most 10% is no longer S8's pass line: S8 reports the `owed` share. Asked by the lead (question 155), "Recomiendo dejar S5c-b para después del S8 y hacerlo solo si el resultado del S8 muestra que hace falta: ahorra ese gasto y un paso antes de la funcionalidad real. Un sí mueve S5c-b después del S8 en la hoja de ruta; S5c-a no cambia y no se gasta nada ahora", he tapped "Sí, S5c-b tras el S8" (the lead's transcript `0f71b2c6`, line 50843, 2026-11-02T09:13:57Z, read with `js-harness sessions --quote`). Kept as history: until then S5c-b ran beside S5, before S8, and S8 held `owed` at most 10%
- [ ] 5. Final certification (S8): the S0 and S8 measures of section 7, a Claude audit and a Codex audit three runs each, graded side by side with the baseline and their spread; S8's incident score at least `max(17, min(20, L + 3))` of 20, the target frozen before S2 (diet section 7); the closing count of each failure class
- [ ] 6. Rule 1, the depth pass (JH 124, `odd/tasks/depth-pass-rule.md`; his yes to question 143, 2026-10-31): section 9 of `js-harness-protocols`, one line at the head of the root `CLAUDE.md` and of the block `init` writes, and its control, the `contracts` row held to the pass's form and commit order where `harness.json` declares `depthPassSince` (here from 2026-11-01), with a planted break; then the alignment below. Proof: `node --test bin/lib/depth-pass.test.mjs` and `js-harness rules depth-pass`; the eval of PR 737's brief, with and without the rule, owed and reviewed by 2026-11-30

### Project init
- [x] A git-spec global install works through the pnpm shim
- [x] `init` writes `harness.json`, a base `AGENTS.md` if none exists (with a `CLAUDE.md` that imports it, since F8's S3), the pre-commit gate, and runs `codegraph init`, all recorded in a project manifest
- [x] `uninstall` in a project restores it exactly
- [x] `sync` moves a project to its pinned version
- [x] The TUI offers `init`/`sync`/`status` inside a project, above the machine commands, and the machine commands outside one
- [x] `doctor` reports the Codex CLI (installed and logged in) when the project's codexReview switch is on, with its fix command
- [x] `doctor` shows no TypeScript plugin row where the project's languageServer switch is off, so it never offers to enable what the switch turned off
- [x] The Codex review of each approved code slice leaves a record a check verifies, so a skipped review is caught

### F3 Task contract
- [x] Contract template from origin.md
- [x] Validator rejects a contract without a done-when command
- [x] Fits the ODD feature doc and `/goal`

### F4 Sensors
- [x] Tests wired to pre-commit and `check`
- [x] Lint/LSP diagnostics wired
- [x] Budget wired
- [x] RDD-by-risk wired
- [x] A rule he states never lives only in memory: `guard` refuses a feedback note of the memory folder that names no home of its rule in the repository, and his feedback notes are moved to the repository (`odd/tasks/memory-feedback-home.md`; his words, 2026-10-15: "dime como hacemos para que estas directrices importantes deje de estarlas guardando en memoria y las cemente")

### F5 Evals that discriminate
- [x] Spend approved by Sebastián
- [x] Tasks that separate the configs under the eval verdict rule
- [x] A/B minimal vs current config at medium and high

### Remote sessions
- [x] Supervisor and `remote start`, `stop`, `status`
- [x] Login launcher, recorded so `uninstall` removes it, and the TUI entry
- [x] `doctor` account check
- [x] Live check on this machine: a session opened from the phone after `remote stop` and `remote start`
- [x] Reviewed and merged (three slices)
- [x] Log cap, watchdog task and the `doctor` row for a server that is down
- [x] The watchdog branch reviewed and merged
- [x] Live on this machine: the server restarted on the new code, and `remote start --at-login` registering the watchdog

### Session board
- [x] A session's transcript read into facts: title, last entry, background work with its recorded end, state, tail of the last reply
- [x] Machine facts: worktrees with their unpushed counts, running gates, open pull requests, each unavailable with its reason
- [x] `sessions` and `sessions --json`, read-only, in the dispatcher's help
- [x] Accepted review follow-ups on the library
- [x] A subagent that is sent a follow-up reads as running again
- [x] Live check on this machine with two or more sessions open, and the memories point to the command
- [x] `sessions --watch` returns when the board changes and costs nothing while it does not
- [x] The orchestrator ships as a skill the installer writes and removes through the manifest
- [x] On this machine: installed, an orchestrator session opened with it, one real stretch supervised
- [x] The status report: `js-harness report --mark` gives the facts since the last report, and the orchestrator skill answers "how is it going" from them in six sections (`odd/tasks/status-report.md`)
- [x] The restart: before the user restarts or updates, the lead pauses every session at a safe point and only then says so in capitals (`rule:restart-announce`, the orchestrator skill's "The restart")
- [x] The report as tables: when the user asks what was done, each section of the status report that holds items is a table (`rule:report-table`, the orchestrator skill's "The status report")
- [x] Background sessions: `js-harness sessions start` runs `claude --bg` on a turn the user did not type, records it, and `sessions stop` and `uninstall machine` undo it; the board lists them (`odd/tasks/background-sessions.md`)
- [x] Templates: an output he sees again and again is made by a command from records and held by a gate that refuses a hand-made one (`js-harness template`, five parts each, `rule:rules-live-in-the-harness`); the questions to him are the first, the board rows and the other inventory rows each wait for his `Plantilla:` line (`odd/tasks/templates.md`, PRs 648, 649, 653, 656, 660, 662)
- [x] Visual pages: the harness shows its moments as pages a command makes from the records, each keeping its numbers for the next: the stretch's departure and return (the share of the plan met, the map by phase, a timeline, and beside each goal not met, item not finished and failure why and how it is fixed, `stretch explain` and `stretch show`), a feature's close (`report feature`), a phase change (`report phase`) and the status report (`report --html`); the board warns while rows wait, writes its start row and shows running work; `init` names each page's command (`rule:reports-spanish-visual`; `odd/tasks/visual-pages.md`, PRs 643, 645, 647, 651, 652, 654, 655, 658, 659, 661, 664, 666)
- [ ] The stretch protocol: `js-harness stretch` plans a stretch with goals that are commands, shows its departure and its return in the chat, measures each item's time and failures from the records, learns the next estimates from the closed ones, and the live board shows the open one (`odd/tasks/stretch-protocol.md`)
- [x] Follow-up (Codex, 54c7e39..e7aa7ec, finding 6): the board lists background sessions even when the main checkout has no transcripts folder, which today ends the board with exit 1 before it reads them, as it did before they were listed (`odd/tasks/board-follow-ups-2.md`)
- [x] Follow-up (Codex, finding 4): a start whose record cannot be appended after claude ran, and whose rollback claude refuses, leaves a durable entry that `sessions stop` and uninstall can act on, not only the commands that remove it (`background/stranded/<id>.json`, `odd/tasks/board-follow-ups-2.md`)

### F6 Codex parity
- [x] The eval tasks run on Codex
- [x] Differences measured and written down

### F7 Future-model protocol
- [x] Written procedure: measure payload, run evals, strip one component at a time ([future-model.md](future-model.md))

### Web fetch fallback
When WebFetch is refused as AI traffic, the next rung is said at once (Sebastián, 2026-10-15: "las pagina
te tienen bloqueado al ser una ia ese es el problema"); measured on nine pages, `odd/tasks/web-fetch-fallback.md`.
- [x] Measured: which rung (WebFetch, r.jina.ai, the built-in browser) reads each of nine pages
- [x] `js-harness fetch <url>`: rung 2, read or blocked with the next rung
- [x] The `resume --pause` hook names the next rung after a blocked WebFetch
- [x] And after a WebFetch that failed as a tool error, through a `PostToolUseFailure` entry `install` writes (Sebastián, 2026-10-16: "Sí, agregala (Recomendada)")
- [x] Reviewed (gentle-ai and Codex) and merged (`jsaristi/js-harness#204`, its `PostToolUseFailure` entry `#260`)

### Review and release
The whole harness reviewed and documented, the lead's manual steps automated, the application tested end to
end, and v0.9.0 then v1.0.0 released so the update between them is proven (Sebastián, 2026-10-18: "Listo
apliquemos todo esto y despues de todo hacemos un test completo de la aplicacion para ver si funciona";
`odd/tasks/harness-review.md`).
- [x] The lead's manual steps are commands with tests (watch and lease, land and copy, archive, openings): the copy's
  refresh while sessions hold waits is `merge-queue --refresh-copy` alone; what else was already a command, and that the
  archive is the app's, is in `odd/tasks/lead-manual-steps.md`
- [x] Every command reviewed against its help, README and SPEC, and every finding fixed or written down (`odd/tasks/launch-audit.md`, I-RM-1)
- [x] The full application test passes on Windows and WSL2
- [x] v0.9.0 tagged and installed from its tag by real pnpm and npm
- [x] v1.0.0 adds a feature, and `upgrade` moves a clean home and the lead's copy from 0.9.0 to 1.0.0: done on
  2026-10-18 (`odd/tasks/harness-review.md`, L58); that tag was deleted on 2026-10-19, at his answer to Pregunta 16,
  so the run stands as the rehearsal of the update, and 1.0.0 is tagged again only on the definitive commit
  (`odd/tasks/release-095.md`, T3 and L10; "Releases before 1.0.0" above)

### Memory that survives the machine
His machine is slow and he cleans it with PC Manager; a past cleanup lost Engram's memories, and a
reinstall would lose the project's whole history (Sebastián, 2026-10-19: "Es muy importante para mi lo
de las memorias ... si por alguna razon despues de la limpiezas que le hago al computador se llegan a
borrar las memorias o me toca que reinstalar el sistema operativo voy a perder todo"). Pregunta 18 named two
ways; Pregunta 19 chose "Los dos (Recommended)". A first copy was made by hand on 2026-10-19 in
`D:\js-harness-backup\2026-10-19` (5,074 observations, read back).
- [x] Design, past its two readers: what the backup holds, when it runs, how restore is proven
- [x] A living summary in the public repository, regenerated each cycle, project matters only (decisions, conventions, state, open work; nothing personal), that a session reads to catch up
- [x] The full Engram export in a private repository of its own, pushed at each session's close
- [x] Restore proven from both on a scratch home
- [x] `js-harness backup ready`: says before a wipe what still has no copy off the machine (`odd/tasks/backup-ready.md`)
- [x] The small backup gaps: every stash entry, worktree edits, the `.git/js-harness` records, Desktop notes and presets, the plugin lists
- [x] The reinstall protocol, "Before a reinstall" in the orchestrator skill (his words, 2026-10-21: "Deja lo que tenga que quedar como protocolo armado")
- [x] The readable fallback of Engram (Pregunta 45): `RECENT.md` and a file per project in the private repository, rebuilt at every run, and a session-start notice that sends a session to it when Engram lost its project; built and proven by a session that answered from it with Engram off (`odd/tasks/recent-memory.md`)
- [x] The Claude transcripts backed up daily as text to private repositories of their own, split under GitHub's file limit, restored byte-identical (Pregunta 52; `odd/tasks/transcripts-backup.md`): 834 transcripts in `jsaristi/js-harness-transcripts-1`, verified byte for byte from GitHub on 2026-10-23
- [ ] A from-zero rehearsal in a Hyper-V VM, the proof (Windows Sandbox cannot run WSL2 or winget). Later, only if it shows the need: a per-project import (engram exports per project, but `engram import` has no filter) and pinning the reviewed stack versions

### Onboarding
Sebastián, 2026-10-19: "una funcionalidad de onboarding para que cuando instalemos el harnes en un proyecto
hagamos todo el pre plan y el plan ya con la ia para ejecutar un roadmap completo y bien estructurado del
proyecto".
- [ ] Design, past its two readers: the interview, the pre-plan, the plan and the roadmap it writes
- [x] `js-harness onboard` after `init`, with tests (slice 1 `jsaristi/js-harness#466`: check, hash, template; slice 2 `jsaristi/js-harness#468`: the stages and resume, `init`'s closing line)

### Conventions
Sebastián, 2026-10-21: the harness reads like a "frankestein", written one way here and another there, and asked
"como verificamos que de ahora a futuro va a ver uniformidad, sobretodo cuando no es mismo modelo a futuro?";
Pregunta 40, "Sí, arrancala". No conventions document: each convention is held where code is written, by a test
in `bin/` whose header states it, by a review line, or by a declared rule, and each test's legacy list only
shrinks (`bin/lib/ratchet.testkit.mjs`; `odd/tasks/conventions.md`).
- [x] Part 1, js-harness itself: the refused-argument wording, the error split, pure modules and the shipped voice held by tests; the review lines; the protocols skill's trigger (`jsaristi/js-harness#496`)
- [ ] Part 2, onboarding profiles: the conventions a project picks at onboarding, after onboarding v4 closes

## F8 plan

F8's step 4 and step 5 in detail, one step at a time, in the order of the checklist (step 4's
paragraph above is the record of what each step did; this section is the plan). The depth lives in
[the diet's section 10](proposals/harness-diet.md#10-migration-one-reversible-step-at-a-time),
its migration table, and in [the reverse-engineering document's sections 13 and
14](proposals/gentle-ai-reverse-engineering.md#13-how-it-works-and-what-we-copy-of-the-way-it-works-2026-10-28);
the register of his decisions is [the diet's section 1](proposals/harness-diet.md#1-what-is-his-to-decide);
the one cost table is the diet's D2. What the harness must look like once F8 is done is
[the specification's "After F8"](SPEC.md#after-f8). Nothing here is a checkbox: a step's state is
read in its feature document, and `js-harness progress` counts only the checklist.

Every step is one reversible change, measured against S0's baseline with the one noise rule (diet
section 7): on the incident set a step is **worse** below `L − max(s, 3)`, with L 13 and s 1, so
below 10 of 20 (`odd/tasks/f8-s0-baseline.md`, `## Frozen thresholds`, `## Baseline`). Costs are
`total_cost_usd`, API-equivalent, drawn on his Max plan's limits, with no fixed cap (D2, "Sin tope
fijo"); a figure marked [i] is an estimate.

**The order and its dependencies.**

```
S0 ─► S3 ─► directives ─► S1 ─► S10 ─► S11 ─► S5c-a ─► S13 ─► S12 ─► S2 ─► S4a, S4b, S5, S6, S7 ─► S8 ─► S5c-b if S8 shows it is needed
                          └─ S1 records fix (after S10) ┘                 └─ S2, then the gentle-ai repository watch (2026-11-03)
the outside feature (plataforma-preproyecto): beside S2 or right after it, before S8; 1.0.0 after it and S8
S9 the host watch (question 129): any time, at each desktop release
beside: the long-session eval (for S8); the TUI's rest (G3, after PR 596)
```

- S3 first because it banks the 30.7k saving at once; S1 next because between S3 and S1 gentle-ai's
  review ran without its prose (diet section 11).
- S10 and S11 are the replacements: nothing is removed until what it gave is ours.
- S5c-a before S13, so the rehearsal shows directive coverage and S12's migration carries it
  (reverse-engineering document, 14.5).
- S13 before S12 and S2: the whole path is proven on a scratch project before his projects move and
  before anything is removed.
- S2 last of the migration: removal is machine-wide and needs every replacement, a backup and a
  restore drill first.
- S4a to S7 are cuts measured one at a time against the cleaned machine; S8 certifies the end.
- S5c-b after S8, and only if S8's result shows it is needed (question 155, 2026-11-02).

**Spent so far** (each from its run's record): S0 $59.64, S3 $16.95, S1 $11.35, S10 $10.61, in all
$98.55 (`odd/tasks/f8-s0-baseline.md`, `## Baseline`; diet section 7.1; `odd/tasks/f8-s1-reviews.md`,
L14; `odd/tasks/f8-s10-port.md`, L26). **Still forecast** [i]: about $141 inside the diet's envelope
(the incident reruns after S4b and S5, the post-removal measure, S6's two cases, two scratch-project
walks, S8 and the long-session eval, the slack), plus S5c's $95 to $130 above it, which goes to him
before it runs. Reviews (Codex and the lenses on every slice) draw on his plans apart from this.

### S0 Baseline
- **Changes:** the thresholds frozen in a commit; the credentials guard in `evals/home.mjs`; the
  three small tasks and the ten incident cases in `evals/tasks/`; the desktop's flags in the runner.
- **Probe and pass:** three runs: incidents 13, 14 and 13 of 20, so L 13, s 1, worse below 10, S8's
  target 17; `honest-unknown` 3 of 3 and the three tasks 3 of 3 a task, both arms; false premise 2 of
  4, below its line of 3 of 4.
- **Cost:** $59.64, measured.
- **State:** done (`odd/tasks/f8-s0-baseline.md`); its T8, the closing check and notice, is
  unticked there. The long-session eval's build plan is written there, for S8.

### S3 The split, and the interim exclusion
- **Changes:** a root `CLAUDE.md` that imports `@AGENTS.md` and holds how Claude works here;
  `AGENTS.md` cut to what a reviewer needs (D3); the `claude-md-budget` rule and row; the interim
  `claudeMdExcludes: ["**/.claude/CLAUDE.md"]` in the committed `.claude/settings.json`, which the
  `payload` row reads; `init` ships the split.
- **Files:** `CLAUDE.md`, `AGENTS.md`, `.claude/settings.json`, `bin/lib/payload.mjs`,
  `bin/lib/project.mjs`, `bin/lib/rules-data.mjs`, `bin/lib/claude-md-budget.mjs` (e5e36473),
  `bin/check.mjs`.
- **Probe and pass:** a restarted worktree session's `/context` shows each project file once and no
  user file; `check` green with the budget row; the incident set no worse; `fixed load` at most
  80,000 over five sessions.
- **Cost:** $16.95, measured (`f8-s3-incidents`: 13 of 20 on both arms).
- **His decisions:** D3 and D7 (answered).
- **State:** built (PRs 602, 603, 604; `odd/tasks/f8-s3-split.md`). The `/context` check passed in
  the directives pass (`odd/tasks/f8-directives.md`, T0); the fixed load over five sessions is not
  recorded in either document (searched for "fixed load" in both).

### The directives pass
- **Changes:** every directive of the plan written where it is dogfooded: the ODD sizing test and
  the feature document's order, and protocols 3, 5, 6 and 7 in `CLAUDE.md`; protocols 4 and 8 in
  `AGENTS.md`; `claude-md-budget` from 2,500 to 3,200 by his answer to question 97.
- **Probe and pass:** S3's promise checked in a fresh session; `npm run check` green.
- **Cost:** none in evals.
- **State:** done (PR 606; `odd/tasks/f8-directives.md`).

### S1 Two reviews on every slice
- **Changes:** `js-harness lens-review` runs one to four Claude lenses over a commit range, fresh
  and tool-less, and records each run pinned to the head commit and the subject hash; `check --push`
  refuses a code commit either review leaves uncovered; a skip is a debt that `check`'s `review` row
  and `doctor`'s `review-skips` row list and the merge door refuses (G9, G13).
- **Files:** `bin/lens-review.mjs`, `bin/lib/lens-candidate.mjs`, `bin/lib/lens-prompts.mjs`,
  `bin/lib/lens-result.mjs`, `bin/lib/lens-reviews.mjs`, `bin/lib/lens-review-rows.mjs`,
  `bin/check.mjs`, `bin/doctor.mjs`, `bin/merge-queue.mjs`.
- **Probe and pass:** in a scratch repo, six cases behave as stated (both records push; an
  incomplete lens is refused; an amend after review is refused; a skip pushes, is listed, and its PR
  is refused by the door); tokens per lens recorded; the incident set no worse.
- **Cost:** $11.35 for the incident rerun, measured; a lens run costs cents: $0.006 each in the
  probe, $0.051 for three lenses over a real range (`odd/tasks/f8-s1-reviews.md`, L13 and L15).
- **His decisions:** G9 and G13 (answered and decided).
- **State:** done: the probe 6 of 6, the incident set 13 of 20 (PRs 607, 608, 613, 614).
- **Later fix:** the merge door reads both reviews of a pull request at its head merged onto main, the tip the
  push of main checks, so a record whose head lies past the pull request's no longer passes the door and fails
  the push; a refused push of main prints the hook's failing rows (PR 663, JH 83; `docs/FAILURES.md`,
  `door-covers-past-tip`; `docs/sessions/2026-10-29-jh-83-merge-door-reads-review-coverage-like-pre-push.md`).
- **Later fix:** the door reads each pull request onto the candidate so far; install records its hook entries before it writes them; an update keeps the user's entry theirs in its new form; the refresh's wait names a way out that works (JH 84; `docs/sessions/2026-10-29-jh-84-delivery-follow-ups.md`).

### The S1 records fix (row 3 of the reverse-engineering document's 13.3)
- **Changes:** the review records cannot be written by the model. Prevention: `guard` refuses a file
  tool or shell write to `lens-reviews` and `codex-reviews` under the git common directory.
  Provenance: a lens record is admitted only when it names a run line the command wrote first, as
  Codex's records do (`bin/lib/codex-review-runs.mjs:9-11`).
- **Files:** `bin/guard.mjs`, `bin/lib/guard.mjs`, `bin/lib/lens-reviews.mjs`,
  `bin/lib/lens-review-rows.mjs`, `bin/lens-review.mjs`, their tests.
- **Probe and pass:** a `guard` test denies an Edit, a Write and a `>>` to either record; a
  well-shaped lens record with no run line is not counted by `check --push`.
- **Cost:** 1,025 lines added (423 of code, 382 of tests, 220 of docs); no eval.
- **Order:** after S10, which owned `bin/guard.mjs`.
- **State:** done: PR 630, merged 2026-10-28 ("fix(guard): review records only the commands write");
  the probe passes on main (`bin/guard.test.mjs` "a Write, an Edit, a MultiEdit or a NotebookEdit of
  a review record is denied", `bin/lib/lens-review-rows.test.mjs` "a well-shaped record that names
  no run line lens-review wrote is refused by the push").

### S10 The port: style, skills, permissions, guard
- **Changes:** `install` writes the `js-harness` output style (neutral Spanish with tú, G10, G10n),
  the two ported skills (`js-harness-work-units`, `js-harness-chained-prs`, G8) with their notices,
  the whole `permissions` object, and G12's Rules block into `~/.claude/CLAUDE.md`, each recorded
  and undone exactly; `install` and `sync` leave a file he edited and say so; the style and skills
  are pinned by hash; `init` selects the style and writes the denies into a clone; `guard` refuses a
  file tool on a denied path.
- **Files:** `bin/lib/manifest.mjs`, `bin/lib/permissions.mjs`, `bin/lib/output-style.mjs`,
  `bin/lib/ported-skills.mjs`, `bin/lib/project-apply.mjs`, `bin/guard.mjs`, `bin/lib/guard.mjs`,
  `bin/lib/rules-block.mjs` (380b9e77), `bin/lib/deny-paths.mjs` (f2480611),
  `bin/lib/component-write.mjs` (98f91454), `bin/lib/hook-entries.mjs`, `bin/doctor.mjs`,
  `THIRD_PARTY_NOTICES.md`.
- **Probe and pass:** in a scratch home, `install` writes all of it and `uninstall` leaves the home
  byte for byte; `guard` refuses a read of a planted credentials path; five Spanish prompts answer
  in tú with no voseo form, 5 of 5; the incident set no worse.
- **Cost:** $10.61, measured (13 of 20).
- **His decisions:** G12 (answered, question 99); applying it to his machine (question 102, "Aplicar
  ahora").
- **State:** done (PRs 615, 617, 619, 620, 621, 623; `odd/tasks/f8-s10-port.md`).
- **Later fix:** a hook entry the user's host file already held, identical to one of ours, is
  recorded `createdEntry: false`, and `uninstall` and `sync` leave it and its Codex trust (PR 657, JH 81, found by
  JH 80's verifier on PR 653; `docs/sessions/2026-10-29-jh-81-uninstall-keeps-a-users-hook-entry.md`).

### S11 The complements under js-harness
- **Changes:** `stack`'s engram, engram-plugin, codegraph and context7 rows install and register
  with their own commands and exact undo; context7 required and on (G11); the presets (G14:
  complete, lean, custom); the `gentle-ai` and `gentle-ai-sync` rows of `doctor` and the install
  watch of `bin/lib/gentle-ai-update.mjs` leave; engram's protocol and context recovery come from
  engram alone, with a `doctor` row for a binary and plugin that serve different protocol versions
  (13.3 row 11); a preset's files name no tool it leaves out (row 17); `bin/` and `evals/` stop
  depending on gentle-ai, the block arms of `evals/arms.mjs` kept as named historical fixtures.
- **Files** [i, planned]: `bin/lib/stack.mjs`, `bin/lib/stack-install.mjs`, `bin/stack.mjs`,
  `bin/doctor.mjs`, `bin/lib/gentle-ai-update.mjs`, `bin/lib/project.mjs`, `evals/arms.mjs`,
  `evals/home.mjs`, and the sweep: today 40 source and 56 test files under `bin/` and 32 files
  under `evals/` name gentle-ai (`grep -rl gentle-ai bin --include=*.mjs`, split by `*.test.mjs`;
  `grep -rl gentle-ai evals`, 2026-10-28), against 32, 51 and 20 in the diet's count of 2026-10-26.
- **Probe and pass:** `stack` on a scratch home with no gentle-ai lists each complement with its own
  command and undo; `grep -rl gentle-ai bin evals` lists only the idea watch, the named fixtures and
  the tests that assert its absence; `check` and `doctor` green with gentle-ai still installed.
- **Cost:** no eval (its own probes).
- **His decisions:** G14, the presets' names, by default (the lead takes the stated default). **The presets live
  only in `init`** (complete, lean, custom), which sets up each project; `install` sets up the machine once and takes
  none. This changes the reverse-engineering review's decision (RE:248) that both offered them; nothing is built.
  Asked as question 182 ("Recomiendo dejarlos solo en `init` y anotar en el plan que la decisión cambió"), he
  tapped "Solo en init" (the lead's transcript `0f71b2c6`, line 63496, 2026-11-04T11:06:55Z, read with `js-harness
  sessions --quote`).
- **State:** done (PRs 627, 628, 629, 632, merged 2026-10-28 and 29; `odd/tasks/f8-s11-complements.md`).

### The Codex daemon row (JH 103, beside S11's doctor rows)
- **Changes:** a `codex-daemon` check row of `doctor`, read-only on the Codex home: `ok` when the
  managed daemon's `current` resolves to a release with its executable, `missing` when it resolves
  to none or is gone while Codex will not reinstall one (the state of 2026-10-21), `n/a` with no
  managed daemon; its fix names the repair of `odd/tasks/codex-trust-table.md`, `## Daemon`. With
  it, the engram plugin's ahead-of-binary fix says when the binary is engram's latest release and
  nothing is to be done until the next one.
- **Files:** `bin/lib/codex-daemon.mjs`, `bin/lib/stack.mjs`, `bin/doctor.mjs` and their tests.
- **Probe and pass:** the row `ok` on this machine's layout (`doctor` run read-only) and `missing`
  on a fixture of 2026-10-21's state; `npm run check` green.
- **Cost:** no eval.
- **His decisions:** the row enters the plan by his answer to question 123 (lead transcript
  0f71b2c6, line 32757): "Sí, agrégala".
- **State:** built, PR 704 (`feat/codex-daemon-row`, `odd/tasks/codex-daemon-row.md`).

### The desktop plan, steps 2 to 5 (JH 107, beside the Host row)
- **Changes:** steps 2 to 5 of [the desktop proposal's plan](proposals/claude-app-native-sessions.md#12-plan-in-order):
  cleanups with their counts, one hour of processes and memory, the auto-archive probe, the skill-text trim. What each
  found is in that section, "What each step found".
- **Files:** `odd/tasks/f8-desktop-plan.md`, `docs/audits/2026-10-30-process-hour.md`, the proposal.
- **Probe and pass:** each step's proof of section 12; `npm run check` green.
- **Cost:** no eval; one hour of `wmic` samples.
- **His decisions:** the plan's order and these four steps by his answer to question 128 (lead transcript
  0f71b2c6, line 34672): "Sí, arranca el plan (Recomendada)"; stopping the orphaned status-line processes by his
  answer "Elimina todo lo de ccstatusline, completamente y a profundidad" (channel, 2026-10-30T18:47:25Z).
- **State:** PRs 708 (step 2), 709 (step 5) merged; 711 (the probe's scratch PR) merged; 712 (step 3) and this
  record ready. No skill line was removed: rows 3 and 4 wait for R1.

### S5c-a Directive coverage, the mechanism
- **Changes:** every source the harness ships or sends to an agent is listed by a test; each source
  is cut into spans tied to a rule, a rule's phrases or a listed context line; every obligation names
  its control (a `check` with a planted break, an `eval` case, `line`, `protocol`, `measured`, or a
  dated `owed`), every span found seeded as `owed` that day; eval cases name their rules in
  `task.json`; a without-rule arm; `js-harness rules coverage` (`--json`, `--strict`, `--prove`); an
  INFO row in `check`; `init` and the project binding (reverse-engineering document, 14.2 and 14.3).
- **Files** [i, planned]: `bin/lib/rules.mjs`, a new `bin/lib/rules-coverage.mjs`, `bin/rules.mjs`,
  `bin/check.mjs`, `evals/without.mjs`, `evals/tasks.test.mjs`, `evals/tasks/*/task.json`,
  `bin/lib/project.mjs`.
- **Probe and pass:** `rules coverage --strict` and `--prove` exit 0 on main with the seeded debt;
  `node --test evals/tasks.test.mjs` holds every case to its rules; the incident set no worse.
- **Cost** [i]: about 700 lines and tests (300 for the mechanism, 100 for the arm, 150 for `init` and
  the binding, 150 for the project eval runner); its share of S5c's eval spend is the incident rerun,
  about $13.
- **Order:** after S11, before S13.
- **His decisions:** S5c's eval spend, about $95 to $130 above the envelope, goes to him when S5c-a
  starts (D2 left no cap, but this overrun is named his in 14.4).
- **State:** done 2026-10-29 (PRs 622, 638, 677, 682; `odd/tasks/f8-s5c-a-coverage.md`, closed by T9). Designed
  (`odd/tasks/directive-coverage.md`, PR 622); the mechanism built 2026-10-28 on
  `f8-s5c-a-coverage` (`odd/tasks/f8-s5c-a-coverage.md`): the sources, spans and register seeded `owed`, `rules
  coverage` with `--strict`, `--prove` (11 checks red) and `--refresh`, the `rules check` refusal, the
  `rule-<id>` arm with its record under `evals/proofs/rules/`, the free check in `tasks.test.mjs`, a project's
  `control` and `rules coverage`, and 2 new cases (PR 638). The paid runs ran 2026-10-28 on his yes, the cap raised
  to $19 by his answer to question 105: the incident set no worse, `f8-s5c-a-incidents-2` 13 of 20 as S0's
  baseline; neither new case told its rule apart (both arms scored the same), so both stay owed; $16.23 recorded
  (L13 to L16). On 2026-10-29 (JH 82, `f8-s5c-a-cases`, his yes to question 110 and no cap after it, L17) both
  cases got harder premises and reran, $4.87: neither tells its rule apart yet, because every rule a case ties
  lives only in a skill, and because the five reply states `init` checks close a stretch the user is away from as a
  question, against `away-autonomy` (L18, L21). With transcripts kept, a third run of `rule-reuse-first` ($2.00,
  $6.87 in all) showed no trial loads the skill on either arm, so its rule never reaches the model (L26): more
  cases on the same pattern cannot tell their rules apart. Left, with the lead: how a rule's text reaches a trial,
  and his question 111 on the reply states; then the reruns and more cases; `init`'s baseline line (L5, L20). JH 86
  (L29 to L32): his answer to question 111 is PR 672; `rule-away-autonomy` opens as a real lead does, the prompt
  that loaded its skill in 8 of 8 real openings; `rule-reuse-first` is a coverage gap; the away rerun waits until a
  trial's home carries PR 672's skill, since it copies the installed one. Then (L33 to L39, $7.88 in two runs): the
  away case never asked for its reply (fixed, and `evals/tasks.test.mjs` now holds it), a reply task cut by its
  timeout is graded on the last text its transcripts hold, and his question due on the turn he leaves is the
  pressure; P9 ties at 0.83, the one trial that closed without the rule asked him, and the 3-minute cut graded the
  others mid-work. Then (L40 to L42, on branch `f8-s5c-a-reach-2`, $4.43): the case cut at 5 minutes, its grader
  passing a reply that closes on Working and holds his question for his return and failing one that asks it, proven
  on five replies of its own, and `rule-proof.mjs` counting cut trials at their list cost; P10 ties at 0.92, and
  the lead closed the case owed with that evidence (D21). S13 opens after this branch lands. Done 2026-10-29
  (JH 90): T9 closed with no case built, by the lead's decision (each rule a case could not tell apart stays `owed`
  with its evidence; how a case could moves to S5c-b); on main at `f2110239`, `rules coverage --strict` exits 0
  and `rules coverage --prove` exits 0 (11 planted breaks turn their tests red). S5c-a is done.

### S13 The rehearsal on a scratch project
- **Changes:** nothing new; the whole path of the reverse-engineering document's 11.1 walked on a
  scratch project in a scratch home: `install` with a preset, `stack install`, `init`, a feature, a
  slice with both reviews, a push to a local bare remote, then `uninstall project` and `uninstall
  machine`; the day-to-day guide of 11.3 checked there; engram's recovery after a start and a
  compaction (13.3 row 11); a `CLAUDE.md` planted above the project turns the import row red (row
  16); a planted directive without a control makes `rules check` exit 1 (14.5).
- **Files** [i, planned]: a rehearsal test beside `scripts/practice-lib.mjs`.
- **Probe and pass:** the nine rows of 11.1 do what they say; nothing of gentle-ai, Orca or herdr
  takes part; after the uninstalls every path the manifests recorded is gone or back to its bytes.
- **Cost:** one walk, about $5 [i].
- **Order:** after S5c-a; before S12 and S2.
- **State:** done (PRs 685, 686, 687, merged 2026-10-30; JH 90, `odd/tasks/f8-s13-rehearsal.md`). Walked 2026-10-30.
  `scripts/rehearsal.mjs` walks the nine rows in a `mktemp -d` home with his logins stripped, and
  `scripts/rehearsal.test.mjs` is its free part (it fails on a planted break and passes again, L8). Run 9 passed all
  21 steps at a host cost of $0.0243 ($0.0907 for the nine runs, against $5): engram brought the planted observation
  back after a start and a compaction; the import row turned red under a planted `CLAUDE.md`; a directive without a
  control made `rules check` exit 1; 20 recorded paths gone or back to their bytes; none of gentle-ai, Orca or herdr
  among 55 commands and 4,893 files on the PATH. The preset goes to `init` (`--preset lean`), since `install` takes
  none. Built here, S12's row 16 among them: the `doctor` claude-import row (D1), which honours `claudeMdExcludes`;
  `stack install` reading again at the end of the run an install its probe could not tell (a new `codex.exe` took
  18 s to start). Owed to S12: engram's plugin needs jq on the PATH; Codex's `mcp add` of context7 opens its OAuth
  login in a browser and outlives the run; each `claude -p` session leaves codegraph's MCP server running on
  Windows; Claude's plugin commands leave empty `enabledPlugins` and `extraKnownMarketplaces` in his settings;
  `lens-review --plan` puts a small range at a third of what a lens takes, the rest unmeasured CLI overhead.
  Reviewed whole: Codex and the lenses on every code commit, the independent verifier, gentle-ai on each slice; its
  advisory findings that let the walk pass on what it did not see were fixed (`08d724a1`, walk 11 passed), and the
  walk's own setup gaps stay owed in the feature document's L14 (each fails loudly, none passes falsely).

### S12 Moving his projects
- **Changes:** builds what does not exist: a migration of an initialized project, which reads the
  version its manifest recorded, writes what later versions add (the split, context7, the deny list,
  the two-review pre-push check, directive coverage's baseline), keeps his edits and records each
  write; a `doctor` row that the root `CLAUDE.md` imports `AGENTS.md` and nothing above turns it off
  (13.3 row 16); a read-only scan of what gentle-ai left in a project (`.atl/`, its review store).
  Today neither `update` nor a second `init` refreshes a project (`bin/update.mjs:373-397`,
  `bin/lib/project.mjs:1062-1091`, as the diet cites them), but `sync` inside a project already
  carries part of it: it rewires the pre-push check, writes the style and the denies into the
  clone's `.claude/settings.local.json` and renders the `CLAUDE.md` block again where the split
  exists (`updateRecorded`, `bin/lib/project.mjs:1593-1639`, `:1895-1905`). The migration builds on
  `sync` for those and adds what it does not do: the split in a project without it, context7, the
  baseline, and a project whose manifest an old release wrote.
- **Files** [i, planned]: `bin/lib/project.mjs`, `bin/init.mjs` or a new command, `bin/doctor.mjs`.
- **Probe and pass:** the migration on a copy of a project initialized by an old release keeps his
  edits and records each write; each moved project's session shows its `CLAUDE.md`, our style and
  context7; every listed project moved, or named as left with his yes.
- **Cost:** no eval (S2's measure covers it).
- **His decisions:** the project list, frozen in the feature document before the first move
  (projects with a manifest or a Claude Code session in the last 30 days); a project left out is
  his yes.
- **State:** done 2026-10-30 (PRs 689, 693-696 the migration, JH 93; the moves, JH 94; `odd/tasks/f8-s12-migration.md`).
  `js-harness migrate`, `--check` and `migrate list`, proven on a copy of a project v0.97.0's own `init` set up in a
  scratch home; context7 is said with doctor's fix, never registered. His list (question 112, "Ambos proyectos"):
  `D:\plataforma-preproyecto` migrated, `D:\abogadaclaudiajimenez` initialized and its own `CLAUDE.md` given the
  `@AGENTS.md` import; `D:\harness` stays, a read-only reference. Doctor exits 0 inside each with `claude-import` ok;
  the changes stay uncommitted in his projects, each undo in the document's L20-L22. Owed: `init` keeps an own
  `CLAUDE.md` without the import, so `claude-import` is red after it (L22); the session probe in each project (L23).

### S2 Removing gentle-ai, Orca and herdr
- **Changes:** in order (diet section 10, "S2, the removal"): writers quiesced; one full backup,
  recorded, with the whole `permissions` object and the complements' MCP entries named; a restore
  drill on a scratch home that proves engram answers and puts back a deleted file and removes a
  created one (13.3 row 12); then each removal asked at that moment: `gentle-ai uninstall --all`,
  the PowerShell skill-registry hook by hand, the binary and `~/.gentle-ai`, GGA where a project
  has it; Orca; herdr; `install` and `stack install` right after; the interim exclusion reverted; a
  read-only verification; an S13 smoke walk; every session restarted and checked.
- **Files** [i, planned]: a new `js-harness stack backup` (the command he runs from a plain terminal
  for steps 1 to 3), `.claude/settings.json` (reverted).
- **Probe and pass:** hooks 32 → 14 (today 32: js-harness 13, Orca 12, gentle-ai 5, herdr 1,
  codegraph 1, read from `~/.claude/settings.json` on 2026-10-28); `~/.engram` hashes as before;
  `claude mcp list` shows engram, codegraph and context7; the incident set no worse; `fixed load` at
  most 80,000 over five sessions.
- **Cost:** about $13 for the incident set, and a scratch walk of about $5 [i].
- **His decisions:** each removal, asked at that moment; D4, the `fixed load` budget, right after.
  **Since 2026-11-03, S2 goes without the backup and its drill.** Four tries that day copied nothing
  (the app never fully closed, then the machine slept). His words (the lead's transcript `0f71b2c6`,
  line 60749, 2026-11-03T21:53:02Z): "hagamoslo entonves sin la copia de seguridad, despues de que
  yo tenga toda la documentacion del proyecto y ademas la forma de que un modelo inteligente pueda
  auditarlo como fue lo que hicimos no importa si se nos borra informacion."; then question 179,
  "Sí, sin copia" (line 60802, 21:55:33Z). The `permissions` object and the engram and context7
  entries come back from gentle-ai's own pre-uninstall snapshot; what no snapshot holds is not
  restorable. `stack backup` stays built, unused; `~/.engram` is checked by function, not by hash.
  Kept as history: until then a full backup and its restore drill came first
  (`odd/tasks/f8-s2-removal.md`, L20). S2 no longer ends the gentle-ai idea watch: by his words of
  2026-11-03 (line 61838, quoted under S9) a watch of gentle-ai's repository comes back as a feature
  of its own after S2.
- **State:** done 2026-11-06 (`odd/tasks/f8-s2-removal.md`). `stack backup` built
  (PR 761) and unused, the backup dropped by question 179. Done, each asked: gentle-ai uninstalled with
  `--all` (question 184), Orca, herdr, each project's `.atl/`, then `~/.gentle-ai`, its PATH entry and
  its eight native agents (question 201); the permissions and the engram and context7 entries back from
  gentle-ai's snapshot; the exclusion reverted (`85d17a02`); every session restarted. Checked: six
  reopened sessions load no gentle-ai text; `fixed load` 77,144 to 77,288 over this repo's four Desktop
  sessions, at most 80,000; the smoke walk 21 of 21 ($0.01); the incident set 14 of 20, false premise
  2 of 4, no worse than S10's 13 ($5.67, `evals/results/f8-s2-incidents.json`). The rule lines
  that named gentle-ai left in PR 778 (T10); this repo's style is `js-harness` by question 204 (T6).

### S4a The attribution hook and the hook count
- **Changes:** a `commit-msg` hook that strips attribution lines (`.githooks/` has none today:
  `pre-commit`, `pre-merge-commit`, `pre-push`); a `check` row counting hook entries by event and
  owner; `init` installs the hook.
- **Probe and pass:** a scratch commit with `Co-Authored-By` lands without it; one extra `Stop` entry
  turns the row red; 0 attribution lines in the next 50 commits on `main`; the row fails above 14
  entries or on a new owner. D8, the engram prompt hook turned off, is applied here.
- **Cost:** no eval.
- **His decisions:** D8 (answered: "Apagarlo"); question 132, the hook takes the lines out and never stops the commit
  (answered: "Quitarlas solo").
- **State:** the hook done (`odd/tasks/strip-attribution.md`): `js-harness commit-msg` and
  `.githooks/commit-msg` merged in #728, a scratch commit with both trailers landed without them (`951bcfb4`);
  `init` and `sync` ship it to projects, recorded so `uninstall` takes it out, in PR 2 of that document. The
  50-commit count done: 0 attribution lines in the 341 commits on `main` since `75c3583f` (JH 153,
  `odd/tasks/f8-s4a-hook-count.md`, L2). The hook count: `odd/tasks/workshop-product-split.md` (D0, #772) built the
  `hook entries` row with the install limit; his yes to question 211 folds S4a's ceilings into it, a table by owner
  and event counted on 2026-11-06 that fails on a new owner or a cell over its ceiling where `harness.json` says
  `"hookCount": true` (L3), merged in #782. D8 answered "Apagarlo igual": `js-harness stack engram-prompt off|on`,
  recorded so `uninstall` puts it back, merged in #784; applied to his machine on 2026-11-08 after his yes to question
  221 ("Aplicar D8 (recomendado)"), so the engram `UserPromptSubmit` cell left the table (L14); engram's plugin 0.1.22
  added a `PostToolUse` entry, accepted by his answer to question 225 as a ceiling of 1 (L15). **S4a is done.**

### S4b Contradictions to zero
- **Changes:** contract-first as a `check` refusal for a new feature document; the remaining pairs of
  the diet's section 3 closed; a refusal with a next step ends with the exact command bound to the
  range it was computed for (13.3 row 1, a conventions test whose legacy list reaches 0).
- **Probe and pass:** a new document without `## Goal` is refused; 10 of 10 pairs closed or his
  decision; a printed command refuses once the head moved; the incident set no worse.
- **Cost:** about $13, the incident rerun [i].
- **State:** built 2026-11-08 (`odd/tasks/f8-s4b-contradictions.md`). A new feature document without its
  contract is refused by `check` (PR 792, merged). The ten pairs are held by `bin/lib/contradictions.test.mjs`,
  each by its own evidence: a check, a sentence, or his decision. Pair 9 is his answer A to question 229; the
  rule text waits for his typed words, since `rules change` refuses a tapped answer. Every refusal of the five
  surfaces ends with its next step from `bin/lib/next-step.mjs`. A printed review command carries `--at` and is
  refused once `HEAD` moved. `bin/conventions-next-step.test.mjs` holds this with a legacy list at 0 (PRs 793,
  795 and 796). The incident set ran once, after question 232 (`f8-s4b-incidents`, $5.01): 13 of 20, no worse.
  False premise came out 1 of 4, below 2: incident-04's one miss is the grader reading only the close the reply hook
  made the agent write again (`docs/FAILURES.md`, eval-reply-cut-by-stop-hook). That grader is fixed in PR 803 (it
  reads every text of the turn), and the set ran once more on his answer to question 243 (`f8-s5-incidents`, on
  `f41f4fb2`, origin/main with PRs 802 and 803 merged in, $4.84): 15 of 20, false premise 3 of 4. **The incident line
  of S4b is met.**

### S5 Skills, memory and rules
- **Changes:** skill bodies at most 3k and the skill lint (13.3 row 7); `MEMORY.md` at most 0.5k;
  the rule pass: each rule and each register control classified as a check or hook, prose that
  stays, or retired, counted from the register on the day it runs (66 live rules on `86491fa`, not
  the diet's 65); the record rule (committed documents are canonical; engram mirrors); the lens flag
  parity probe (row 2).
- **Probe and pass:** the protocols skill loads in at most 3 of the next 10 sessions; every rule and
  control classified; a headless lens run with a planted user hook shows the hook did not fire; the
  incident set no worse.
- **Cost:** about $13, the incident rerun [i].
- **State (2026-11-11):** done. PRs 797, 798 and 799 on main (`6ee974d`); PR 802 (the last, JH 160,
  `odd/tasks/f8-s5-rules.md`, 8 of 8 tasks) and PR 803 (the eval's reply, below) merged on 2026-11-10. Skill bodies at most 3k, the skill
  lint and the protocols-load probe move to `odd/tasks/workshop-product-split.md` (spec 7, question 190). What stays here:
  - The incident set, run once on his answer to question 243 ("Arreglar la prueba y correr una vez (recomendado)",
    transcript `ea85ec35`, line 1247) after the grader was fixed to read every text of the turn (PR 803,
    `eval-reply-cut-by-stop-hook`): `f8-s5-incidents` on `f41f4fb2` (tree `5bfc3e3d`, origin/main with PRs 802 and 803
    merged in, not pushed), $4.84 list: 15 of 20, false premise 3 of 4, against L 13 and the worse line of 10. No worse.
  - The `MEMORY.md` budget: `rule:memory-index-bytes` is 2000 bytes (0.5k tokens at chars/4), and the guard refuses
    a write that leaves the index over it and larger than before.
  - The record rule: `rule:documents-canonical`, in the `js-harness` skill's memory hygiene section.
  - The lens flag parity: `node evals/lens-hook-probe.mjs` shows that a planted user hook and `CLAUDE.md` reach a
    run without `--safe-mode` and do not reach one under the lens's flags.
  - The rule pass, counted on 2026-11-10: 73 live rules and 4 retired. Their obligations are check 49 (49 planted
    breaks proven) and prose 25; none owed. `work-sessions-public` and `work-sessions-private-wsl`, which nothing
    read, are named by the orchestrator skill where it opens sessions (question 235, his tap "B: prosa en la skill
    del orquestador (Recomendada)", transcript `ea85ec35`, line 1029). `rules coverage --strict` refuses an owed
    one. `failures` prints the register's controls as check 99, prose 8, measured 2 and owed 5.

### S5c-b Directive coverage, the filling
- **Changes:** every span declared; each seeded `owed` closed by a check or an eval case; about 15 to
  25 new cases for behaviour no check can hold, each proven on both arms.
- **Probe and pass:** `rules coverage --strict` with `owed` at most 10%; every case names its rules and
  has a current proof record.
- **Cost** [i]: about $34 to $65 to prove the new cases, inside S5c's $95 to $130.
- **Order:** after S8, and only if S8's result shows it is needed (question 155, his tap "Sí, S5c-b tras
  el S8", 2026-11-02, the lead's transcript `0f71b2c6`, line 50843). Until then it ran beside S5's rule
  pass, before S8. What in S8's result shows it is needed is not written yet; it is read when S8 closes.
- **State:** to do, deferred.

### S6 The read surface
- **Changes:** the roadmap's Next and Decided at most 10k; a `## State` head in feature documents;
  the relief file by month; the contract template.
- **Probe and pass:** the read-surface measure at most 15k (13,413 at S0); incident cases 9 and 10 no
  worse.
- **Cost:** about $3, two cases.
- **State (2026-11-12):** done, PR 838 (JH 186, `odd/tasks/f8-s6-read-surface.md`), with three of its four
  changes: the `read surface` row of `check` reads 13,526 of 15,000, Next went from 7,494 to 1,796 estimated
  tokens, and the `## State` head is in the contract template and in what the resume hook, the pause and
  the board read; cases 9 and 10 passed 2 of 2 each. The relief by month left the step by his answer A to
  question 268 (2026-11-11) and is its own work under Later.

### S7 Topology and routing
- **Changes:** the lead cut at a phase's close or after two compactions; Haiku 5.5 helpers with
  `omitClaudeMd`; Sonnet writer prompts whose brief names its `S#` and whose return says which it
  covered (13.3 row 9).
- **Probe and pass:** the first turn of five Haiku sub-agents at most 30k; at most one unrequested
  file in five Sonnet writer slices, each naming its `S#`.
- **Cost:** no eval beyond those runs [i].
- **State (2026-11-11):** built (JH 159, `odd/tasks/f8-s7-topology.md`, 6 of 7 tasks; only T1, a documentation task, is unticked). Writers launch as the project agent
  type `.claude/agents/js-harness-writer.md` (the model of `rule:session-model`, `omitClaudeMd`, six tools),
  whose first turn measured 6,881 to 6,998 tokens in five headless runs, against 21,468 for a headless
  `general-purpose` Haiku launch (already under 30k there; 35,683 and 49,602 in app sessions, where the type is owed); the protocols skill asks a writer's brief for its `S#` and its return for `Covered: S<n>`; the heartbeat ends
  with a `CUT:` line after the lead's second compaction, and the orchestrator skill cuts the lead then and at a phase's
  close. The plan's Sonnet writers met his Haiku rule; asked (question 227), he tapped "Seguir con Haiku (Recomendada)"
  (the lead's transcript `0f71b2c6`, line 75063, 2026-11-08), so the five writer slices run on the Haiku writer type.

### S9 The host watch
- **His words:** line 33399 (2026-10-30), a session "que nos investigue las actualizaciones nuevas
  de todo a profundidad [...] a sabiendas que este arnes es solo y unicamente para claude desktop";
  line 33574, "que este arnes funcione unicamente y exclusivamente para Claude Desktop y todas sus
  funcionalidades en conjunto con el revisor Codex"; question 129 (line 34781, "Sí, súmala
  (Recomendada)"): "el paso S9, que hoy vigila solo gentle-ai, pasa a vigilar Claude. [...] No
  cubre adoptar nada sin tu sí." (transcript `0f71b2c6`, read with `sessions --quote`).
- **Changes:** each Claude Desktop update doctor sees opens a session of its own, `JH <n> · host
  watch <version>`, named by the lead's heartbeat (a `HOST:` line) and the `host-update` row's
  fix, and briefed by `js-harness host-watch brief`. It reads the Desktop and Claude Code changelogs over the update's span and diffs the
  app's tool list against the last recorded one (`docs/host-updates/tools-<surface>.txt`); `host-watch
  draft` gives one row per entry, classed by the harness area it touches, and lists what it cannot
  place for hand classification. It writes `docs/host-updates/claude-desktop-<version>.md` (adopt,
  adapt or ignore, the proposal's map row, the evidence, Windows and phone checked or unknown),
  which `doctor --host-reviewed` requires, shows it on a Spanish page and sends one recorded
  question per adoption through the lead. Nothing installs. Plan: `odd/tasks/f8-s9-host-watch.md`;
  role: `docs/proposals/claude-app-native-sessions.md`, section 8.
- **Probe and pass:** `node --test workshop/lib/host-watch.test.mjs`: a fixture changelog with one entry
  per class gives one row per entry, an unmatched entry is listed for hand classification, the
  tool-list diff names what was added and removed; the first real review,
  `docs/host-updates/claude-desktop-4.4212.0.md`, passes `host-watch check` (every entry of its
  span has a decided row) and the gate of `--host-reviewed`.
- **State (2026-10-30):** the first real review is written (Desktop 4.29.0 → 4.4212.0, CLI 2.1.308 →
  2.1.309): 113 rows, first one adapt (`sessionStatusLine`, question 131) and 112 ignore; JH 113 (2026-10-31,
  `odd/tasks/status-line.md`) found the key read only on third-party inference and turned the row to ignore, and
  `host-watch` now drafts a 3P entry outside and asks evidence before adopting one; it passes `host-watch
  check` and a test runs the gate of `--host-reviewed` over it. Both tool lists are recorded as
  baselines (the Code tab's 169 host tools, a background session's 68).
- **Was:** the idea watch of gentle-ai releases (`bin/lib/gentle-ai-update.mjs`, the
  reverse-engineering document's section 5), planned for any time after S2. It leaves with gentle-ai
  at S2, by question 129; this entry keeps its history. **Since 2026-11-03 it comes back, outside
  S2.** His words (the lead's transcript `0f71b2c6`, line 61838, 2026-11-04T01:54:51Z, 20:54 local on
  2026-11-03): "igual quiero que como no vamos a tener instalado gentle-ai y cada cierto tiempo se
  actualiza, la idea es poder ver lo archivos del repositorio y como nosotros somos una especie de
  copia ver que de lo que añade o quita nos sirve para optimizar". So a watch of gentle-ai's
  repository, read with gentle-ai uninstalled, classes what each release adds or removes as adopt,
  adapt or ignore; it is a feature of its own after S2. `bin/lib/gentle-ai-update.mjs` is not
  there to keep: `8b724f3d` removed it with the `gentle-ai-sync` row, so the watch is built again.
- **Cost:** one session per desktop release (five from 2026-10-15 to 2026-10-29).
- **State:** in progress (JH 109).

### Alignment to the depth pass (after rule 1, step 6)
His words of 2026-10-31 (the lead's transcript `0f71b2c6`, line 43297): "entiendo que tenemos que alinear todo el
arnes para que no vaya a quedar contradicciones o algo antiguo". Opened by the lead once rule 1 lands; nothing here is
built in rule 1's pull request.
- **First, the double review** (his typed answers to questions 145 and 146, which replace the option of two readers
  on every large plan). Question 145 (line 43642): "Y si mejor no hacemos dos lectores A y B sino que hacemos una de
  Claude y una de Codex para tener 2 perspectivas diferentes pero que sean dos revisiones ciegas independientes?"
  Question 146 (line 43701): "Me gustaria en todo, pero que me dieras la opcion de cuando si y cuando no, siento que
  siempre todo se debe revisar doble pero de la forma de nos de criterio y con la filosofia nueva que tenemos ya que
  todo es importante a menos que yo como usuario te diga que no quiero la revision, esa seria la unica opcion de que
  no se hiciera." Question 147 (line 44098, tapped) approved the corrected design, which two blind readers, one of
  Claude and one of Codex, shaped: "Sí, pero también en el código chico". So: code keeps today's pair
  (`codex-review` and `lens-review` on every slice), and a small code change also gets the blind Claude and Codex
  read; plans, designs and documents that propose something get one Claude reader and one Codex reader, blind, on the
  same frozen material, their findings kept outside the repository until both return; each read is announced with
  its cost and a phrase that skips it, and only his words skip it, recorded with them; never run on his short
  replies or taps; each finding is recorded, to measure what each reader adds, judged on 2026-11-16. It goes through
  `js-harness rules change double-review`, retiring his D5 (2026-10-27) by name and keeping its rules on
  disagreement and rounds; its scope, stated two ways today (`bin/lib/protocols-skill.mjs:43` against
  `bin/lib/project.mjs:412`), becomes one text. Codex reviews code and not Markdown today (the Review row above), so
  a command of its own, `js-harness double-review`, reads a plan (`odd/tasks/double-review-alignment.md`, L7); each
  run spends his Codex weekly limit, read on the meter first.
  Questions 150 and 152 (2026-11-01, lines 49332 to 49690, typed) changed this design: no extra read on small code,
  since code's pair is already a Claude and a Codex review, judged against what was asked; every finding answered,
  taken or rebutted; a clean review approves at once, at most three reviews, then the problem goes to him and the
  work to a stronger model; and in place of the 10% reserve below, Codex reviews to 2% left, then he is told and
  decides the reset, and only on his no a second Claude reviews (`odd/tasks/double-review-alignment.md`, "Redesign
  after question 150", L18).
  When the limit runs low, question 148 (line 44186, tapped): "Claude reemplaza y Codex paga después
  (Recomendada)". Below 10% of the weekly limit (`js-harness codex-meter`), a new Codex read goes to a second Claude
  reader in a fresh context, marked "sin Codex"; code left without a Codex review is a debt Codex reviews after the
  reset, and the merge door lists it. His one reset credit is not spent without his word.
- **The older texts:** the feature document's order in `CLAUDE.md` gains `## Depth pass` after the contract (the
  block `init` writes holds no such order, `bin/lib/project.mjs:395`); the contract template gains its skeleton; `sync` offers `depthPassSince` to a project.
- **Done** (2026-11-02, `odd/tasks/double-review-alignment.md`, T1 to T10): `rule:double-review` (his D5 retired by
  name), the escalation's rule (retired into `rule:session-model` on 2026-11-11) and `rule:codex-weekly-floor`, which replaced the 10% reserve; `js-harness
  double-review` reads a plan; code's two reviews are given what was asked, every finding answered, a recheck for both,
  at most three reviews; the older texts aligned; pull requests 745, 746, 748, 749, 753, 754 and 755.
- **The eval** of PR 737's brief, with and without the rule, owed by 2026-11-30: planned in the feature document,
  not run; it runs on his word.

### The outside feature (the re-plan of 2026-11-01)
- **Changes:** none in this repository: one small feature of one of his projects, built there with the
  harness in one session, on a branch, with both reviews, up to a pull request. What the harness helped
  or got in the way of is written in that session's notes and becomes defects here, which the growth
  limit lets in as fixes (re-planning analysis, C2 and E2 step 2).
- **Probe and pass:** the pull request in his project with both reviews recorded, and the notes.
- **Cost** [i]: one session.
- **His decisions:** the project, plataforma-preproyecto (question 151, his answer of
  2026-11-01T19:12:54Z, the lead's transcript `0f71b2c6`, line 48234); the feature, asked next; the merge.
- **State:** waits for his choice of the feature; beside S2 or right after it, before S8. The project
  has no code, roadmap, `main` or remote yet: its onboarding (`odd/tasks/onboarding.md` there, branch
  `onboarding`) stopped at L14 on his answer, so its pre-plan and roadmap come first (JH 129's L10).

### S8 Certification (step 5)
- **Changes:** nothing; it measures. Section 7's S0 and S8 measures; a Claude audit and a Codex audit,
  three runs each, side by side with the baseline; the closing count of each failure class (tool,
  machine, unseen-state); the release check on the tagged commit (13.3 row 13); one row per measure,
  no combined score (row 14); directive coverage's full run.
- **Probe and pass:** the incident set at least 17 of 20 (`max(17, min(20, L + 3))`, frozen); 17
  measures pass and 4 deferred are reported as not built; the long-session eval at least 90% of its
  moments; `rules coverage --strict` exits 0, and the `owed` share is reported, no longer held to 10%
  (S5c-b moved after S8, question 155, 2026-11-02); its result says whether S5c-b runs.
- **Cost** [i]: about $25 for the measures, at most $50 for the long-session eval, about $45 to $52
  for directive coverage's run.
- **1.0.0:** comes after S8 and the outside feature, and is the version that feature ran on (Decided,
  "1.0.0 and gentle-ai #4036", question 153).
- **His decisions:** G7, the recurring certification spend, after S8.
- **State:** to do.

### Beside F8
- **The long-session eval**, built in a session of its own (`odd/tasks/f8-s0-baseline.md`, its build
  plan), run at S8 only.
- **The TUI's rest**, after PR 596 (slice 1, open) merges and G3 is answered.
- **The Session board's two follow-ups** and the other open checkboxes of the checklist are not F8's.

## F5 result

Concluded: on these five tasks the minimal config scores as the current stack does and costs about half as much (the current stack costs 1.68x to 2.54x). Full text: [odd/tasks/evals.md](../odd/tasks/evals.md).

## F6 result

Concluded: on Codex the minimal config scored 1.00 on all 15 trials and the current stack added no score; its cost and speed findings match F5. Full text: [odd/tasks/codex-parity.md](../odd/tasks/codex-parity.md).

## Codex review result

Concluded: `lean` is the default of `js-harness codex-review` since 2026-10-08, with the same or more findings at 36% (seeded range) and 59% (real range) of the input of `current`. Full text: [odd/tasks/codex-review-lean.md](../odd/tasks/codex-review-lean.md).

## Codex review cost result

Concluded: a review runs one model, on code only, never twice over one range, and prints its cost before it runs; the measured reviews cost 8.24 million input tokens, and the 400-line part bound stays. Full text: [odd/tasks/codex-review-cost.md](../odd/tasks/codex-review-cost.md).

## Subagent models result

Concluded: a subagent that writes scoped code scores the same on Haiku 5.5 as on Opus 5.5 at 58% less session cost, so it is launched on Haiku 5.5 on the call, and the others stay on Opus 5.5 at high effort. Full text: [odd/tasks/subagent-model-routing.md](../odd/tasks/subagent-model-routing.md).

## Rule hierarchy

Designed on 2026-10-10: rules that do not act are to be given a check, in a ranked hierarchy. The survey, checks, outline, protocols and that day's failures are in the feature document, which wins where they differ. Full text: [odd/tasks/rule-hierarchy.md](../odd/tasks/rule-hierarchy.md).

## Session channel

Designed on 2026-10-10 and built in [odd/tasks/session-channel.md](../odd/tasks/session-channel.md). The order he asked for on 2026-10-09 (items 1 to 5, each a feature of its own) moved there as `## Session channel`.

## Next

**The re-plan of 2026-11-01: F8 adjusted, not restarted.** Asked whether we had been doing it wrong
(his words, the lead's transcript `0f71b2c6`, line 47737), JH 128 measured the project and
compared keeping F8, adjusting it and starting again ([replan-analysis](../odd/tasks/replan-analysis.md)):
F8's direction works where it is measured, while the plan grows faster than it closes (488 steps
closed and 539 added in 14 days) and the harness has built nothing outside itself. He adopted the
adjustment: "Listo entonces continuemos y reactives todo para hacer le plan" (line 48080,
2026-11-01, typed, answering "¿adoptas el ajuste, es decir, seguir con F8 y poner el límite al
crecimiento?"). What it changes, carried out by [replan-execute](../odd/tasks/replan-execute.md):
- **F8 stays the spine**, its steps in their order below.
- **His growth limit**, `rule:growth-limit`, holds first. The last line of `js-harness progress
  --pace` says whether the week is red and what may still open.
- **An outside outcome**: one real feature in one of his projects, built with the harness, before
  S8, as an F8 step ([F8 plan](#the-outside-feature-the-re-plan-of-2026-11-01)). Which project
  and which feature are his: he chose plataforma-preproyecto (question 151); the feature is asked next.

His yes covers the adjustment where it changes none of his recorded decisions. The analysis's E3
lists the ones it would change, each kept as decided until he answered it. The lead asked them one
at a time on 2026-11-02 (questions 153 to 156, the lead's transcript `0f71b2c6`), and he answered
all four with the recommended option, tapped:
- 1.0.0 after the real feature and S8 instead of waiting for gentle-ai #4036, "Sí, tras la función
  real" (line 50690; Decided, "1.0.0 and gentle-ai #4036").
- The real feature as part of "verified", "Sí, cuenta la función real" (line 50775; Decided,
  "Releases before 1.0.0").
- S5c-b after S8, only if S8's result shows it is needed, "Sí, S5c-b tras el S8" (line 50843; F8
  step 4 and [S5c-b](#s5c-b-directive-coverage-the-filling)).
- Reversible questions decided by the recommended option and listed to him once a day, where he
  can change any; irreversible ones, spend, publishing and his roadmap decisions still asked one at
  a time, "Sí, lista diaria" (line 50902). It changes `rule:questions-one-place`, a rule of his, and
  `rules change` takes only words he typed (`bin/lib/rules-change.mjs:233`), so it waits for his
  typed words or for the last item.
- A tapped answer counting as his (question 150, JH 126's): still open.

**First: reorganize the harness (F8), in order, by his word of 2026-10-26.** Told that sessions
lose judgment and break rules, he asked for one order over everything in flight: "necesito que
trabajes en orden osea de todo lo que estamos haciendo, que debe ir primero que despues y como
vamos a llegar al objetivo que es el de poder organizar el arnes como deberia ir por que esta
funcionando muy mal" (relayed by the lead to session JH 54). The objective is the harness of
[the diet proposal](proposals/harness-diet.md), and F8 is that order. Its steps are the F8
checkboxes under [Checklist](#checklist), each closed by the condition written there. Work that
does not serve a step waits, unless it breaks shipped behaviour.

The six steps as they were written on 2026-10-26 (his login, the research passes, his decisions, the baseline,
the migration's order and the certification) are in [the roadmap's history](roadmap-history.md#the-f8-order-as-written-on-2026-10-26).
Each step's state is under [F8 plan](#f8-plan).

**Later.** What waits: since 2026-11-01, what `rule:growth-limit` holds back while the week is red, one
line each with its day and its source; before it, what was found after the freeze of 2026-10-16 and kept out
of the first version.

- [ ] Stalled-session detection: the board, the lead's watch and its heartbeat name a work session that holds
  handed work and has made no commit, notice or gate for an hour. On 2026-10-16 three sessions sat five to six
  hours before anyone noticed. Tracked in `odd/tasks/stalled-sessions.md`.
- [ ] The lead's relief file, bounded (1.72 MB on 2026-11-11; November alone 235 KB in 11 days, so a file a
  month does not give a head the lead reads at once). Taken out of F8's S6 by his answer A to question 268:
  its design is reviewed before any code, with readers landed before the writer, an undo that is a tested
  command and an independent verifier. Source: `odd/tasks/f8-s6-read-surface.md`, L4 and L9.
- [ ] Shorter resume sections in feature documents. The "Next step" and "State for a resume" sections
  have grown into history: 381 lines in `rule-hierarchy.md` and 1,036 lines in `session-channel.md`
  at 64933f6. Since `#332` a resumed session reads them through named ranges, but nothing bounds
  their size. Since F8's S6 `check` bounds a resume head at 5,000 estimated tokens and new documents
  open on a short `## State`; the three documents over it are that row's legacy list, still to
  shorten. Not tracked yet; it waits for him. Source: `odd/tasks/resume-open-task.md`, "In scope / Out of scope".
- [ ] A TUI as capable as gentle-ai's, its slice 1 in review and the rest awaiting his priority (G3). He asked for it on 2026-10-26
  ("el de nosotros es muy sencillo y no funciona como el de gentle-ai"). The proposal ports gentle-ai's
  design to zero-dependency Node in `bin/tui.mjs` (the item that opened gentle-ai's own TUI is gone
  with gentle-ai), and maps every gentle-ai screen to native or excluded in six sized slices
  (`docs/proposals/gentle-ai-reverse-engineering.md`, section 4). Not a phase: a feature with its own
  document. Two of its causes are defects in shipped behaviour, not new scope: the menu very likely
  duplicates when a line is wider than the terminal (inferred from the code, not yet reproduced in
  a real console), and commands print over the menu. Under the freeze those two are fixed now as one
  defect task (slice 1's terminal guard, frame model and run screen, about 400 lines, touching only
  `bin/tui.mjs` and its tests): PR jsaristi/js-harness#596, open and not merged, its real-console
  walk left to him. The rest waits for G3; its completion boundary and dependency map are in the
  proposal's section 4.7.

**Settled, and kept in [the roadmap's history](roadmap-history.md).** Moved there word for word on 2026-11-11
(F8 S6), so that what a session reads to start stays within the `read surface` row of `check`:
- the scope frozen on 2026-10-16 with what its count left out, the first version complete and stable, what the
  first version holds (2026-10-13) and `docs/SPEC.md` written last;
- the throughput list of 2026-10-16, version 2, its ten items and its stop rule;
- the defects in shipped behaviour read in the code on 2026-10-13, a to g, each fixed or placed;
- F6 Codex parity as closed on 13 of its 15 trials, and the session signals of 2026-10-07 with the states a
  reply closes in.

Still open from those paragraphs:
- F6: what is kept of the raw trial output that lives only on this machine (`evals/runs/` in the old worktree, and
  `D:\js-harness-worktrees\codex-parity-t3-raw`) is his; until he says, the old branch and its worktree stay as
  they are.
- Defect f: the practice run's `host-loads` step is proven for Claude Code; Codex is still not proven
  (`odd/tasks/practice-project.md`, T5).
- F4's follow-ups (`odd/tasks/sensors.md`), when one earns a slice.
- F2's last step, when gentle-ai ships #4036; open decision 4 (the codegraph hook) can be taken at any time.

## Stack doctor notes

Concluded: a zero-token notice is a `systemMessage` of a `SessionStart` hook, since plain stdout costs model tokens, and Codex has no command status line. Full text: [odd/tasks/stack-doctor.md](../odd/tasks/stack-doctor.md).

- 2026-10-26, stack update reviewed: codex 0.163.0 → 0.164.0 ([release](https://github.com/openai/codex/releases/tag/rust-v0.164.0)), engram 3.5.4 → 3.6.0 ([release](https://github.com/Gentleman-Programming/engram/releases/tag/v3.6.0)). Nothing the harness uses broke, and no code changed. Codex: hook trust works as on 0.163.0 (a scratch-`CODEX_HOME` `codex exec` probe ran none of the five harness hooks without trust and all five, exit 0, with `--dangerously-bypass-hook-trust`; the hook input keeps `session_id`, `turn_id`, `cwd`, `hook_event_name`); #54619 binds trust of plugin hooks to their contents, which does not touch `hooks.json` entries; `codex-meter` still reads the limits from `codex app-server`; `codex-review --help` runs. engram: the only MCP change is that `mem_save` now reports `candidate_detection_status: "incomplete"` when conflict detection fails, and `obsidian-export --limit` is refused; the harness uses neither. `npm run check` passed on the new versions. Still open, not caused by the update: four harness Codex hooks have no trust record (the `codex-trust` row, his step), and engram's doctor reports 13 foreign sync targets and two active sessions for one directory, checks 3.6.0 did not change.

## Open decisions (Sebastián's, asked one at a time)

1. Disconnecting the unused Magnific connector (the largest single per-turn item).
2. Permission mode: currently `bypassPermissions`; the documented alternative is auto mode. He changes it himself.
3. **Answered on 2026-10-13: the Gentleman persona stays part of the stack.** Whether it stays.
   His words, typed (the lead's transcript `65318fd5-80e7-4bb8-92b5-06737140185b`, line 12096,
   read with `sessions --quote`): "Si al estilo de Gentlema y listo dame para abrir las 2
   sesiones". He answered it as it stood, before the cost of each option was read.
4. The codegraph `UserPromptSubmit` hook: keep, narrow or drop it. Replaying this project's 55
   real prompts, it fired on 33; 16 of those injected a full ~4k-token code exploration, often
   for prompts with no code intent — ~1.2k tokens per prompt on average, kept in the history
   (evidence in `odd/tasks/f2-context-diet.md`, T3). It is codegraph's config, so js-harness
   only reports it.
   **Answered for this repository on 2026-10-12: off.** His words, to the lead's question
   whether the add-on at each prompt goes off here or stays (the lead's transcript
   `65318fd5-80e7-4bb8-92b5-06737140185b`, line 8161, read with `sessions --quote`): "listo
   apaguemos en este el mapa del codigo para este como para cuando el harnes funcione para
   cuando no hay que meter codigo ya que gentle-ai no solo sirve para programar sino tambien
   para investigacion, entonces hay que dar la opcion de deshabilitarlo y habilitarlo
   dependiendo del caso y creoq ue asi con otras funcionalidades que tenemos, cierto?"
   How it is off: `CODEGRAPH_NO_PROMPT_HOOK=1` under `env` in the untracked
   `.claude/settings.local.json` of his machine, written by the lead by hand. It is in no
   manifest; deleting the key undoes it. The map itself stays installed and can still be asked.
   Evidence so far, two samples and no proof: one prompt in the lead's session arrived with no
   output of the hook (the lead's claim); and in a session that was already running, JH 7, the
   prompt of 19:35 still carried the hook's output and the next one, after 19:37, did not.
   **A product direction in the same words, not designed:** the harness offers turning the
   code map, and other functions that only serve programming, off and on by the kind of
   project, since gentle-ai also serves research, where no code is written. It widens "js-harness
   only reports it" above and joins decision 6. A candidate feature, not assigned, owed a
   design with its two reviews before it reaches him. The lead's reading, not his words: a
   switch for each function, kept in the project's `harness.json` and recorded in the manifest
   so that `uninstall` undoes it, a kind of project being a preset of switches.
   **His order for the product, four minutes later** (same transcript, line 8250, read with
   `sessions --quote`): "Entonces hagamos el harnes para que funcione con codigo y sin codigo o
   que al principio sea investigacion y cuando vayamos a hacer codigo sea inteligente y sepa
   cuando este investigativo o analisis y cuando ya llegue la hora de codigo y asi a la inversa
   cuando se vuelva a analisis e inveastigacion desactivar osea que sea a demanda, que te
   parece?" So: the harness serves a project with code and one without, and what serves only
   code is on demand, in both directions. It ended in a question, and he answered the lead's reply to it at 19:42 (line 8315, read
   with `sessions --quote`): "listo entonces apliquemoslo asi". That is a yes to the direction
   below and to its when; it is not a yes to a design, which is still owed with its two reviews.
   What the lead answered him, the lead's reading and not a design: no watcher of the
   conversation that flips a mode, since the hook was such a guesser (33 of 55 prompts, the
   evidence above); each function pays only when the work calls for it, as three already do
   (a commit of documents alone runs the sensors of documents, pull request 77; a Codex record
   is asked only of code commits; gentle-ai's review goes by its assessment); the code map on
   demand, its paste off and the tool asked; what is chosen only when a session starts (the
   TypeScript server) chosen from the project's files at `init`, with a switch in the manifest;
   `install` preparing nothing of code in a project that has none until the first appears.
   **The Codex review is one of those functions, by his order** (line 8758, read with
   `sessions --quote`; he sent it while the lead worked): "tambien quiero que la funcionalidad
   de revision con Codex se pueda desactivar ya que por ejemplo si este harnes lo utiliza otra
   persona o en otro proyecto y no tengo para pagar la el plan para la revision entonces se
   desactiva y dejamos solo la revision del mismo claude peroque hace gentle-ai". So a project
   can turn the Codex review off and keep gentle-ai's alone. Today the push check refuses a
   branch whose code commits no Codex record covers, so the switch has to reach that check
   too. Not designed, not assigned; it joins the candidate above.
   When: after JH 8's cut of the review command is on `main`; not assigned. A third sample of
   the switch, the lead's claim: his prompt of line 8250 carries no attachment of the hook,
   where the one of line 8161 had one at line 8163.
   **Held by "JH 9 · funciones a demanda y revisión de Codex opcional"** since 2026-10-13, by his
   answer to how many sessions open ("Dos nuevas: cinco (Recomendada)", the same transcript, line
   12000). Its design is JH 9's document, `odd/tasks/on-demand-functions.md`, which closes this
   decision; his four answers to it, each read with `sessions --quote` in the same transcript:
   where the Codex review is on, it is demanded before a push, in an installed project too
   ("Sí, se exige (Recomendada)", line 12777; today it is demanded only in js-harness and is
   advice elsewhere); in a new project it starts by itself ("Sola (Recomendada)", line 12795);
   installed projects turn the paste of the code map, and a TypeScript server they do not need,
   off at their update, and say so ("Sí, y avisa (Recomendada)", line 12814); with the Codex
   review off, gentle-ai reviews high and medium risk ("Riesgo alto y medio (Recomendada)", line
   12828).
5. The effort the Codex review runs at, for what it costs (the number is in "Codex review
   cost result"). **Answered on 2026-10-12**: his rule `rule:review-effort` (`docs/RULES.md`), which
   every Codex run since 2026-10-15 ran at.
6. What the harness turns on by default in a project from the sub-agent models result
   ("Subagent models result", the recommendation). For this repository's way of working it is
   decided (2026-10-11): the writing sub-agent on Haiku 5.5.
7. The gate run by GitHub on every pull request: the repository was private then, so its runs
   spent the account's minutes; it is public since 2026-10-16 ("Name, home" above) ("Session channel", the order, item 2). **Answered on 2026-10-13, held
   by "JH 10 · comprobación en GitHub"** (by line 12000 above), each line read with `sessions
   --quote` in the lead's transcript `65318fd5`: no payment method on the GitHub account, now or
   later ("no tiene tarjeta, dejémosla sin tarjeta", line 12461); the gate on GitHub runs on
   Linux at each push to a pull request with code ("En cada PR con código (Recomendada)", line
   12491). JH 10's `odd/tasks/gate-on-github.md` holds the design. **Its exchange (R1, T7) was
   closed on 2026-10-16 as superseded by merge-queue**: "Sí, cerrala (Recomendada)" (the lead's
   transcript `e152c9d8`, line 7753, read with `sessions --quote`).
8. The proposal for the Codex plugin: the `doctor` row, `codex:rescue`, its three hooks
   (`odd/tasks/codex-review-lean.md`, "Proposal for the Codex plugin").
9. **Answered on 2026-10-13: one page and each command** ("Una página y cada comando", question
   22, the lead's transcript `65318fd5`, line 10979, read with `sessions --quote`); built on
   2026-10-14 (pull request 123), with a test that holds its commands to the dispatcher's.
   What the README holds (Next, the defects read on 2026-10-13, item b). Options: what the
   harness is and how to install and remove it, in one page; that and each command with an
   example; or none until the first version, with the roadmap as the only description.
10. **Answered on 2026-10-13: `bin/` without its tests and no `AGENTS.md`** ("Solo los comandos",
    question 24; built the same day, item c). What the package ships (the same list, item c).
    Options: `bin/` without its tests and no
    `AGENTS.md`, since an installed project gets its own from `init`; `bin/` whole and no
    `AGENTS.md`; or as today.

Closed: the F5 spend ceiling (none; see Decided, Eval spend). F6's missing trials: closed
without them, on 13 of 15, by his answer of 2026-10-12 (Next, item 1, with its line). Whether
`init` writes a version into a `harness.json` that has none: it does not, as today ("Dejarlo
como hoy (Recomendada)", the lead's transcript `65318fd5`, line 12059, 2026-10-13, read with
`sessions --quote`; JH 8's `odd/tasks/install-update.md` holds it).

## Risks

- A stack release changes the machine under a running feature. gentle-ai 4 and engram 3 did on
  2026-10-01: a hook left calling a removed command, the Codex model reset by a sync, and plugin
  hooks that reach the engram server past the eval sandbox (`odd/tasks/stack-v4.md`,
  `odd/tasks/evals.md` T4a). `doctor` and `check` now report the first and the last; an eval
  run fixes the stack's versions for its whole length.
- gentle-ai #4036 may never ship, leaving the largest block uncontrollable; v4 made that block 2.4 times larger for Codex (87,562 bytes of global `AGENTS.md`), which F6 will measure.
- Opus 5.5 defaults may shift after launch.
- Discriminating evals cost money.

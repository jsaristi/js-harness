# Functions on demand, and a Codex review a project can turn off

Locator: `odd/tasks/on-demand-functions.md` · Engram mirror: `odd/on-demand-functions/tasks` ·
Branch: `feat/on-demand-functions`, in the linked worktree
`D:\js-harness-worktrees\on-demand-functions`, cut from `origin/main` at `46eec34` · Session:
`JH 9 · funciones a demanda y revisión de Codex opcional`, orchestrator `JH ORQ · js-harness`
(app session `local_11c45a36-0115-4c92-b865-f1dc3f68c3c1`) · Runner: `node --test` · Delivery:
ask-on-risk

State 2026-10-13 19:43 (this machine's clock): the design is in its second version, after its
two readers, and his four answers make it his (S6 to S9). One question is open with him, the
first push of a project, built last. Slice 1 is being committed: T1, then the reader of a
project's switches, the unrouted `functions` view and the settings key. Next: slice 2 ("The
order of the build"), in a worktree of its own stacked on this branch.

## Goal
A project chooses which of the harness's functions it runs: what serves only programming is off
in a project without code and comes on when code appears, and the Codex review can be turned off
in any project while gentle-ai's review stays, with every command that demands, checks or
prepares a function reading the same switch.

## Why
- gentle-ai serves research and analysis as well as programming, and the harness today prepares
  and charges for code in every project. Measured in this repository: the code map's prompt hook
  fired on 33 of 55 real prompts, 16 of them pasting about 4,000 tokens, often with no code
  intent (`docs/ROADMAP.md`, "Open decisions", item 4; evidence in `odd/tasks/f2-context-diet.md`,
  T3).
- The Codex review costs a second plan. Another person, or another project of his, may not have
  it; today the push check refuses a branch whose code commits no Codex record covers, so such a
  project could not push at all without recording a skip by hand for every slice.
- A guesser of the conversation's mode is the thing that failed (the hook above). So "on demand"
  here means a function pays when the work itself calls for it, and a switch decides what the
  work can call for; nothing watches the conversation.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/on-demand-functions.md` exits 0
- The tests of each task, named in the Log when they pass, with one test for every existing
  behavior a task touches that proves it holds at the switch's default
- A project with the Codex review off pushes a branch with code commits and no Codex record, and
  the same branch is refused with the switch on: shown in a test through the push check's public
  entry
- Sebastián's answers to the design's questions are in the Log with his exact words or the label
  he tapped, and the transcript line

## In scope / Out of scope
- In: the switches and where they are stored; how `install`, `init`, `sync`, `doctor`, `check`,
  the hooks and `uninstall` read them; the default in a project with code and in one without;
  what happens to a project already installed; the texts that tell an agent to run the Codex
  review.
- Out: a watcher of the conversation that flips a mode (his yes at line 8315 was to a reply that
  ruled it out, line 8275); gentle-ai's own review logic, engram and codegraph themselves (the
  harness configures and reports them, it does not rebuild them); the files other sessions hold,
  unless the orchestrator says so first: JH 5 (`bin/sessions.mjs`, `bin/notify.mjs`,
  `bin/lib/channel.mjs`, `bin/lib/sessions.mjs`, the hooks' texts, doctor's Codex row), JH 7 (the
  README, the rules machinery, `docs/ROADMAP.md` entries, an installed project's own rules), JH 8
  (the gate, install and update, the package's contents).

## Constraints
- Zero dependencies, plain Node — because the commands run in any host without an install step.
- Anything written outside this repository is recorded so `uninstall` undoes it exactly — the
  rule in `AGENTS.md`; a switch that changes a host's or a project's file is such a write.
- With every switch at its default, a project that has code behaves as today, with two
  exceptions that are his to allow (Design, question 3): the code map's paste goes off, and the
  TypeScript plugin goes off where there is no TypeScript — because the first version holds
  everything he ordered (line 10519) and nothing he has is to be lost unseen.
- A switch cannot be a way for a branch to exempt itself from a check without that being visible
  — because a review that is skipped in silence is the failure the push check exists to stop.
- No design reaches him before the search of his words and the two readers — his rule for a
  protocol or design change.

## Effort
high

## Ask me before
Product choices, each as a question with options through the orchestrator (Design, "What is his
to decide"): whether the Codex review is demanded before a push where it is on; how it starts
in a new project; what happens to projects already installed; what gentle-ai's review does when
the Codex review is off. Anything installed or changed on his machine. Spend
outside the Codex review allowance. A file another session holds.

## Specs

- **S1** The harness works in a project with code and in a project without code. His words
  (transcript `65318fd5-80e7-4bb8-92b5-06737140185b`, line 8250, read with `sessions --quote`):
  "Entonces hagamos el harnes para que funcione con codigo y sin codigo o que al principio sea
  investigacion y cuando vayamos a hacer codigo sea inteligente y sepa cuando este investigativo
  o analisis y cuando ya llegue la hora de codigo y asi a la inversa cuando se vuelva a analisis
  e inveastigacion desactivar osea que sea a demanda, que te parece?"
- **S2** A function that serves only programming can be disabled and enabled by the case. His
  words (line 8161): "listo apaguemos en este el mapa del codigo para este como para cuando el
  harnes funcione para cuando no hay que meter codigo ya que gentle-ai no solo sirve para
  programar sino tambien para investigacion, entonces hay que dar la opcion de deshabilitarlo y
  habilitarlo dependiendo del caso y creoq ue asi con otras funcionalidades que tenemos, cierto?"
- **S3** The direction he said yes to (line 8315: "listo entonces apliquemoslo asi") is the
  orchestrator's reply at line 8275 of the same transcript, an assistant's text and so a claim
  about what he approved, read here from the transcript: no watcher that guesses the mode; each
  function charges only when the work itself asks for it; the code map on demand with its
  automatic paste off; what is chosen only when a session starts (the TypeScript server) decided
  from the project's files, with a switch he can change and `uninstall` undoes; `install`
  preparing nothing of code in a project without code until the first appears.
- **S4** The Codex review can be turned off, and gentle-ai's review stays. His words (line
  8758): "tambien quiero que la funcionalidad de revision con Codex se pueda desactivar ya que
  por ejemplo si este harnes lo utiliza otra persona o en otro proyecto y no tengo para pagar la
  el plan para la revision entonces se desactiva y dejamos solo la revision del mismo claude
  peroque hace gentle-ai osea que ahora lo que tengo entendido es que hacemos la revision de
  gentle-ai y la de codex cierto?"
- **S5** The first version, 1.0.0, holds everything he ordered, with no date (line 10519, the
  label he tapped: "Todo lo que pedí, sin fecha"). So this feature is part of 1.0.0.

- **S6** Where the Codex review is on, it is demanded before a push, in every project. His
  answer (same transcript, line 12777, tapped): "Sí, se exige (Recomendada)", to "Hoy la
  revisión de Codex solo es obligatoria antes de subir en js-harness; en otros proyectos es un
  consejo. Donde esté prendida, ¿se exige antes de subir?"
- **S7** In a new project the Codex review starts by itself: off with no code, on when the
  first code appears. His answer (line 12795, tapped): "Sola (Recomendada)", to "En un proyecto
  nuevo, ¿cómo arranca la revisión de Codex?"
- **S8** In projects already installed, at their next update, the code map's paste and, with no
  TypeScript, its server go off by themselves, and it says so. His answer (line 12814, tapped):
  "Sí, y avisa (Recomendada)", to "En los proyectos ya instalados (hoy, solo el de práctica), al
  actualizar el harness, ¿se apagan solos el pegado del mapa del código en cada mensaje y, si no
  hay TypeScript, su servidor?"
- **S9** With the Codex review off, gentle-ai reviews high and medium risk; a written rule,
  nothing refuses a push for it. His answer (line 12828, tapped): "Riesgo alto y medio
  (Recomendada)", to "En un proyecto con la revisión de Codex apagada, ¿qué cambios revisa
  gentle-ai? (Queda como regla escrita; nada frena una subida por esto.)"

- **S10** The first push of a project to an empty repository passes and says so. His answer
  (line 13159, tapped): "Pasa y avisa (Recomendada)", among "Pasa y avisa (Recomendada) | Pasa
  sin revisar | Revisa todo desde el inicio", to "Con la revisión de Codex obligatoria, ¿qué
  hace la primera subida de un proyecto a un repositorio vacío?" What the option said, by the
  orchestrator's message (its text, not read here): the push passes, says how many lines went
  unread and gives the command that reviews them when he chooses to pay; from then on
  everything is reviewed. So: it applies only where the remote holds no branch at all; the line
  counts what went unread; the command it names exists, is tested, and plans its cost before it
  runs (`codex-review --plan`).

Assumptions, not his words: "the switch reaches the push check" is the orchestrator's reading of
S4 (the opening and `docs/ROADMAP.md`, item 4), and follows from it: a review that is off cannot
be demanded.

## His earlier words

Searched on 2026-10-13: every line a person typed in the 59 transcripts of this project
(`C:\Users\Oficina\.claude\projects\D--js-harness\*.jsonl`), for `deshabilit`, `desactiv`,
`a demanda`, `sin código`, `apagu`, `apagar`, `investigaci`, `mapa del código`, `codegraph`,
`otra persona`, `otro proyecto`, `opcional`, `no tengo para pagar`, `typescript`; and every
answer to a question in the orchestrator's transcript from line 8431 on. The search reads typed
text and answers to questions, so it could have found an order on this matter in any session; a
compaction summary is not his word and was skipped. Each line below was then read with
`js-harness sessions --quote 65318fd5-80e7-4bb8-92b5-06737140185b <line>`.

- Lines 8161, 8250, 8315, 8758, 10519: the orders, quoted in Specs.
- Line 3913 (2026-10-12): his yes to turning the TypeScript language server off in this
  project's sessions ("Entonces hagamos esto y apliquemoslo de una vez"), after a paste that said
  "Este proyecto no usa TypeScript". A function of code that was off by hand before a switch
  existed.
- Line 8938 (question 13, typed): the official Codex plugin inside Claude is to be removed, and
  the integration this project built stays: "si hablas de plugin oficial de openai de plugin
  codex for claude code es literalmente eliminarlo para que no nos vaya a crear un conflicto y
  quedarnos con la integracion que creamos nosotros para esto". So "the Codex review" in S4 is
  `js-harness codex-review`, not the plugin.
- Line 8962 (question 14, tapped): "Bajar a medio", the Codex review's effort. Line 8668
  (question 5, tapped): "Dejarla como está", the spend rule of the Codex reviews. Both are
  settings of a review that is on; neither says what happens when it is off.
- Line 8488 (question 1, tapped): the pause notice at 88 percent of context is installed "Para
  todo proyecto (Recomendado)". A function he placed in every project, with or without code.
- Line 11166 (question 25, tapped): a `harness.json` written by hand with no version is "Vale,
  sin versión fijada (Recomendada)". So a `harness.json` that lacks a key is a valid file, and a
  missing switch must mean a default, never a refusal.
- Line 11146 (question 24, tapped): the package ships "Solo los comandos (Recomendada)".
- Line 8986 (question 15, typed): versions are tagged from 1.0.0, when "tengamos una primera
  version completa y utilizable".
- An open question the orchestrator told him it owed (line 8779, the orchestrator's text): with
  the Codex review off, does gentle-ai review always? On 2026-10-12 gentle-ai assessed every
  change as needing no review and Codex was the only reader of the code (the orchestrator's
  claim, not checked here).

Nothing found that contradicts S1 to S5, and nothing that names a default.

## Design

Second version, 2026-10-13 19:15, this session's. The first is commit `f8e70c0`; two readers
that did not write it attacked it, and "What the readers changed" says what moved. Everything
under "What exists today" was read on `46eec34` by two read-only explorers and spot checked
here; the code's reader confirmed its lines on `75b0ceb` (the merge between the two changed no
code). A line cited in the sections after it that this session did not open itself is the
reader's reading: this session opened `bin/doctor.mjs:215-236`, `bin/lib/project.mjs:1500-1536`
and `bin/check.mjs:1124-1142`. The rest is a proposal, and none of it is built.

### What exists today, and what it costs a project without code

What `install` writes on a host serves both kinds of project: two skills on each host
(`bin/lib/manifest.mjs:108-127`) and five hook entries of three kinds, `doctor --hook` at
session start and `resume --hook` after a compaction on both hosts, `resume --pause` after a
tool call on Claude alone (`:134-165`). None is
a function of code. The code map's prompt hook, the status line and the output style are not
the harness's: `rg -n -i "statusLine|status line" bin` finds nothing outside tests, and
`codegraph.cmd prompt-hook` is in `~/.claude/settings.json:270`, in no manifest.

What serves only code, and its cost where there is none:

| Function | Where | Cost with no code | Conditional today |
|---|---|---|---|
| Code map index: `codegraph init` → `.codegraph/` | `init` and every `sync` (`bin/lib/project.mjs:382-400`, `:686-694`, `:1388-1396`) | wall time, an untracked folder; `sync` makes it again if deleted | only on `.codegraph` existing; nothing looks for code |
| Code map as a gap: a missing `.codegraph` | doctor's `project` cell (`bin/lib/stack.mjs:336`), read at each session start | a gap line in a project that has nothing to map | no |
| Code map paste at each prompt | codegraph's own hook; off with `CODEGRAPH_NO_PROMPT_HOOK=1` (`docs/ROADMAP.md:1297`) | about 1,200 tokens a prompt on average here | not the harness's; off by hand in this repository's untracked `.claude/settings.local.json`, which no worktree gets |
| TypeScript language server | Claude's plugin `typescript-lsp@claude-plugins-official`, on for the machine (`~/.claude/settings.json:37`); the harness only reports it (`stack.mjs:368-382`) | processes that spun and lengthened each gate by about 100 seconds (line 3913) | off by hand in the same untracked file |
| Codex review, demanded | `check --push` (`bin/check.mjs:1176-1202`, `:1399-1400`), called only by this repository's `.githooks/pre-push:11` | a push refused; money for each review | only code commits count (not `.md`, not `-codex-review`: `bin/lib/codex-review-scope.mjs:52-54`, `:125`) |
| Codex review, as a debt row | plain `check`, information (`check.mjs:1245-1295`, `:1437`) | git processes at every commit | says "no code commits" |
| Codex review, as an instruction | the skill's text (`manifest.mjs:26`, `:29`), the usage (`bin/js-harness.mjs:23`), this repository's `AGENTS.md:57-61` | an agent told to run a paid review | no |
| Sensors of code | the gate (`check.mjs:929-1030`) | none: no `package.json` scripts means an information row (`:948-952`) | yes: `sensors`, `documents`, `documentSensors`, `sameTree` |
| `AGENTS.md` template | `init` (`project.mjs:337-355`) | 490 bytes a turn worded for code ("where the code lives", "the test that proves it") | only written if absent |

Two findings that shape the design:

1. **An installed project is not made to run the Codex review today.** `init` writes one hook,
   the pre-commit gate (`project.mjs:361-362`, `:627-678`); `rg -n "pre-push" bin scripts -g
   '!*.test.mjs'` finds nothing, and that search reads every place a hook is written. So what he
   described at line 8758 ("hacemos la revision de gentle-ai y la de codex") is true of this
   repository only. Elsewhere the review is advised by a row and a skill.
2. **Nothing reads project configuration on the push path.** `check --push` runs one row and
   never calls `readHarness` (`check.mjs:126-131`, `:1399-1400`); `codex-review` reads none
   either. The only configuration read from git is `.gitattributes` at the pushed tip
   (`codex-review-scope.mjs:125`), where a branch that adds `* -codex-review` already exempts
   itself, by a design that says so (`:31-32`). An `--unavailable` record covers like a review
   (`bin/lib/codex-review-coverage.mjs:252-258`, `check.mjs:1171-1173`): today's way to go without Codex, one slice at a
   time.

### The switches

Three, in `harness.json` under one key, each optional:

```json
{ "functions": { "codeMap": "auto", "languageServer": "auto", "codexReview": "auto" } }
```

| Switch | Values | When the key is absent | Governs |
|---|---|---|---|
| `codeMap` | `auto`, `on-demand`, `always`, `off` | `auto` | the index and the paste |
| `languageServer` | `auto`, `on`, `off` | `auto` | the TypeScript plugin in this clone |
| `codexReview` | `auto`, `on`, `off` | `auto` (question 2) | the push check, the debt row, the command, the texts |

- `codeMap`: `off` is no index made or asked for by the harness, and the paste off; `on-demand`
  is the index with the paste off, the map asked when needed (what this repository has by hand,
  and what he approved at line 8275 as "de fábrica"); `always` is the index and no key written,
  so codegraph pastes as it does by itself; `auto` is `on-demand` when the project holds code
  and `off` when it holds none.
- `languageServer`: `off` writes the plugin off for this clone; `on` writes nothing; `auto` is
  `on` when the project holds a `tsconfig.json`, a `.ts` or a `.tsx` file and `off` otherwise.
  In this repository that resolves to `off`, what he set by hand at line 3913 (408 tracked
  files, none of those: the reader's count).
- `codexReview`: `off` means nothing demands, counts, runs or advises a Codex review in this
  project; `auto` is `on` when the project holds code and `off` when it holds none.
- A missing `functions`, or a missing switch in it, is the default and never an error (line
  11166). A value outside the table is an error row that fails the commit's gate, as `sameTree`
  does (`bin/check.mjs:308-321`), never read as on or as off. On the push path, where a failing
  row would also refuse the push that fixes it, an unreadable value is read as `on` and said.
- No preset and no `kind` key. With `auto`, a project's kind is what its files say. This drops
  the orchestrator's "a kind of project is a preset of switches": a preset would be a second
  place that says the same thing and can disagree with the files.

What was considered and is not a switch: the sensors (already declared, and silent with nothing
to run), gentle-ai's review (it has its own switch, `gentle-ai review mode`, his), the pause
notice (he placed it in every project, line 8488), `resume`, the skills. The sub-agent defaults
(`docs/ROADMAP.md`, "Open decisions", item 6, which item 4 says this "joins") are not a function
of code and stay out of this feature.

### "The project holds code"

One rule, in one new module, `bin/lib/functions.mjs`: a file whose name is a program's, among
the files git tracks, has staged, or sees untracked and not ignored (`git ls-files --cached
--others --exclude-standard`, asked with pathspecs so a large tree does not fill a buffer; on
the push path, the same question to the pushed commit's tree). A closed list of extensions (`.js
.mjs .cjs .jsx .ts .tsx .py .ipynb .r .jl .go .rs .java .kt .cs .c .h .cpp .rb .php .swift .sh
.ps1 .sql` to start) or a build file (`package.json`, `pyproject.toml`, `requirements.txt`,
`go.mod`, `Cargo.toml`, `pom.xml`, `Makefile`, `Dockerfile`). Outside a git repository, or when
git fails, the answer is "unknown" and every `auto` reads as its code value: the harness never
turns a check off because it could not look.

It is a positive list on purpose. The Codex scope's rule is negative (anything that is not `.md`
is code, `bin/lib/codex-review-scope.mjs:52-54`), which is right for counting what a review must
read and wrong for deciding whether a project has code at all: a research project's `.csv`,
`.png` and `.pdf` are code by it. The two rules stay separate. The positive list decides which
functions exist in a project; once the Codex review is on, the review's own rule still decides
which commits it must cover. A program in a language the list misses leaves `auto` off; the
price is one line (`"codexReview": "on"`), and both `functions` and the push row print the
reason they resolved as they did, so the miss is in plain sight at every push.

This is the answer to "sea inteligente y sepa" (S1) with no watcher: nothing reads the
conversation; the tree is read when a command already runs.

- **When code appears.** The commit's gate is the event, because its output is what an agent
  reads at every commit. `check` gets one information row, `functions`: silent when what the
  switches resolve to is what this clone has applied, and otherwise one line per difference with
  the command that applies it (`js-harness functions apply`). It writes nothing: a gate does not
  write. The first commit that holds a program file prints it. (The first version said the
  session-start hook would tell the agent. It does not: `doctor --hook` prints a count of gaps
  as a `systemMessage`, only when a machine-wide digest that holds no project changes,
  `bin/doctor.mjs:223-230`.)
- **The way back.** Nothing is turned off when the work returns to analysis, and nothing needs
  to be: with the paste off an index costs nothing at a prompt, the sensors and both reviews
  charge by what a commit touches, and a commit of documents touches no code. The language
  server stays on while the project holds TypeScript. `auto` never deletes an index; only a
  declared `off` removes it, and only if the manifest says the harness made it (`createdDir`,
  `bin/lib/project.mjs:1246`). This is a narrower "a la inversa… desactivar" than his sentence
  can be read to ask, and it is said to him in those words with the questions.

### How each command reads a switch

- **One source for a range.** What a check of commits reads, it reads from the head commit of
  the range it measures: the pushed tip for `check --push`, the reviewed head for `codex-review`.
  It is where `.gitattributes` is already read (`codex-review-scope.mjs:17-21`, `:125`). What a
  command does in the working tree (`check` at a commit, `init`, `functions`) reads the working
  tree's file, as every row of the gate does today (`check.mjs:126-131`).
- **`check --push`:** the switch is read before the remote is resolved, so a project with the
  review off is not refused for a remote the row cannot measure (`check.mjs:1124-1139`). Off: the
  row passes with one line, the value and why. On: today's row. **When the pushed tip turns the
  review off and the remote's default branch has it on, the row says so in a line of its own**
  ("this push turns the Codex review off: `<commit>`") and passes. The first version read the
  switch from the default branch so that a branch could not exempt itself; that bought nothing
  and trapped the person the switch is for ("What the readers changed", 1).
- **`check` (a commit's gate):** validates `functions` (an error row before the sensors); the
  `functions` information row above; with the review off, the debt row is one line and runs no
  git. With the Codex review off and gentle-ai's mode off (`check.mjs:1071-1074`), the `review`
  row says in so many words that no review reads this project's code.
- **`codex-review`:** with the switch off at the head it would review, it launches nothing,
  prints why, and exits 0; `--plan` the same. `--unavailable` always records, switch or no
  switch, so no state exists in which the push asks for a record that the command refuses to
  write.
- **`js-harness functions`** (new): with no argument, each switch, what is declared, what it
  resolves to and why, and whether this clone has it applied. `functions apply` makes this clone
  match: it runs `codegraph init` when the map resolves on, writes or removes the two settings
  (below), and records each in the project manifest. `functions set <name> <value>` validates,
  writes the key into `harness.json`, and applies. `set` is the one command that writes into an
  existing `harness.json` (`project.mjs:1294` says none does today): the alternative is prose
  that tells an agent which key to edit, and a command he can be shown is the smaller harness.
- **`init` and `sync`:** call the same apply. `init` runs `codegraph init` only when `codeMap`
  resolves on. The `AGENTS.md` template becomes one text that serves both kinds ("the evidence
  that proves it" beside "the test"), not two.
- **A project with no pin** (this repository: `harness.json` has no `version`): `sync` writes
  nothing there (`project.mjs:1533`) and `init` finds it initialized, so `functions apply` is
  the path, and it has to make the project manifest where none exists. How `sync` and that
  manifest meet is JH 8's ground.
- **`doctor`:** with `codeMap` resolved `off`, the codegraph row's `project` cell is `n/a`, not
  a gap, and the fix it prints for a missing index (`gentle-ai codegraph init`,
  `bin/lib/stack.mjs:345`) is not printed. The `typescript-lsp` row stays a report.
- **`uninstall`:** undoes each applied setting from the project manifest (below).
- **The texts:** the skill says the Codex review applies where the project has it on
  (`bin/lib/manifest.mjs:26`, `:29`); the usage line the same; the Codex rules in
  `bin/lib/rules-data.mjs:8-93` say "where the review is on". This repository's `AGENTS.md`
  keeps its rule: the review stays on here.

What `off` cannot do, said plainly: gentle-ai's own instructions tell every agent to make the
index when `.codegraph/` is missing (his global `CLAUDE.md`, the CodeGraph section, steps 4 and
5). The harness does not own that text. So with `codeMap` `off` an agent may still make an
index when it is asked about the code; what the switch guarantees is that the harness does not
make one, does not report its absence, and keeps the paste off, which is where the cost was.

### The paste and the language server: a setting inside a file the harness does not own

Both are keys in Claude's settings: `env.CODEGRAPH_NO_PROMPT_HOOK = "1"` and
`enabledPlugins["typescript-lsp@claude-plugins-official"] = false`. Codex has neither: `rg -n -i
"codegraph|UserPromptSubmit" ~/.codex/hooks.json` finds nothing, and the plugin is Claude's
(`stack.mjs:375`).

- **Where:** the clone's own `.claude/settings.local.json`, keys merged into what is there (this
  repository's file also holds `effortLevel`, which stays). Per clone is what the hook, the index
  and the project manifest already are. The first version chose the tracked
  `.claude/settings.json`; a tracked file written by a per-clone command breaks the next
  checkout in every worktree that applied first, and one clone's `uninstall` would remove the
  key for all ("What the readers changed", 2). The price: each clone and each linked worktree
  applies for itself, and the `functions` row of its gate tells it so.
- **How it is recorded:** the project manifest learns one list, `settings`: for each key, the
  file, the pointer, the value written, what was there before, and whether the harness created
  the file, its folder or the containing object, as the machine manifest records for an entry
  (`manifest.mjs:296-308`).
- **How it is undone:** `uninstall` puts back what was there, only if the key still holds what
  the harness wrote; a key someone changed since is kept and reported; a container or a file the
  harness created and that is empty again is removed, so no `{"env":{}}` is left.
- **A key that already holds another value** is never overwritten: it is reported, and the
  switch shows as not applied. A key that already holds the harness's value is recorded as kept,
  not as written, the way a committed file is today (`project.mjs:730-733`).
- **Proof owed before this is built on:** that Claude Code honors both keys from that file is
  shown only by this repository's hand-written copy, "two samples and no proof"
  (`docs/ROADMAP.md:1300`). The first task of the build is a probe, recorded with its output.
- **An older copy on the path:** the manifest's shape check ignores a list it does not know
  (`project.mjs:1012-1027`), so an older `js-harness uninstall` would delete the manifest and
  leave the keys. The manifest carries the version that wrote it; an `uninstall` older than its
  manifest must refuse. That guard is JH 8's ground.

### Defaults, a project already installed, and what the tests show

- A project with code and no `functions` key: the index stays; the Codex review as today; the
  language server unchanged if it has TypeScript. **Two things change at its next apply: the
  paste goes off, and the TypeScript plugin goes off where the project has no TypeScript** (a
  project of plain `.js` loses what the plugin gave it, until it declares `on`). Whether an
  apply does that to a project already installed by itself is question 3; line 8275 approved a
  factory default, in a reply that called itself a reading and not a design, and a default is
  not a migration.
- A project without code: no index, no gap, the plugin off, and no Codex review, because `auto`
  resolves `off`. (The first version said the review "never comes up"; it would have: a commit
  with a `.csv` is a code commit by the review's rule.)
- Nothing is applied until a command is run there. The only other installed project on this
  machine is `D:\js-harness-practice\project` (found with `fd -H -I -d 4 '^harness\.json$'` on
  `D:` and the user folder; a deeper one would be missed).
- This repository: applying the switches here writes his `.claude/settings.local.json` through
  the harness in place of by hand. A change on his machine: asked when the build is done.
- **Existing tests change by design.** The fixtures of `init` and `sync` are empty repositories
  (`bin/lib/project.test.mjs:46-51`), where `auto` is `off`, so every test that expects
  `codegraph init` to run there needs a program file in its fixture or changes its expectation
  (the reader's list: `project.test.mjs:113`, `:322`, `:340`, `:835`, `:933`, `:948`, `:968`,
  `:1000`, `:2053`, `:2720`, `:2852`, `:2897`; `stack.test.mjs:1226`; `doctor.test.mjs:271-292`;
  `install.test.mjs:39`, `:1010`; `scripts/practice.mjs:312`, `:355-363`;
  `js-harness.test.mjs:59` for the new command). The constraint "a project that has code
  behaves as today" holds for a project with code; these fixtures have none, and "no index in a
  project without code" is S3.

### What the readers changed

Two readers on Opus at high effort, neither of which wrote the design, read the first version
(`f8e70c0`): one against the code, one against his words and against the two people the feature
is for. What moved:

1. **Where the push reads the switch** (the code's reader, blocker; the other reader, blocker).
   Was: the remote's default branch, so that a branch could not turn the review off for itself.
   A branch already can, four ways: `* -codex-review` at the tip, an `--unavailable` record, an
   edit of the hook or of `check.mjs` (both run from the working tree), and `--no-verify`. And
   it trapped the legitimate case: the commit that turns the review off is itself a code commit
   by the review's rule, so the person without a plan needed a review to stop needing one, while
   `codex-review`, reading the working tree, refused to write the record the push asked for.
   Now: one source, the head commit; the row says in a line when a push turns the review off.
2. **Where the settings are written** (the code's reader, blocker). Was: the tracked
   `.claude/settings.json`. Now: the clone's `.claude/settings.local.json`.
3. **How the agent learns that code appeared** (both readers). Was: the session-start hook,
   which prints a count to the person and not a line to the agent. Now: a row of the commit's
   gate, and untracked files count.
4. **The Codex review gets `auto`** (the words' reader, blocker). Was: `on` or `off`, with the
   claim that a research project never meets the review. It would, at its first data file.
5. **Three decisions that were his were written as decided** (the words' reader, blocker): what
   happens to projects already installed is now question 3; the default of a new project is
   question 2 and no longer reads the machine's Codex login (a login is not a plan, and a fact
   of one machine does not belong in a tracked file); the old question 4, which functions get a
   switch, is cut, since lines 8275 and 10519 answer it.
6. **A command to see, apply and set a switch** (both readers): `functions apply` because no
   command applies anything in a project with no pin, `functions set` because "edit the key and
   run `sync`" was prose where a command belongs.
7. **What `off` cannot do** is now said: gentle-ai's instruction to make the index.
8. **Undo:** created containers are recorded; an older copy must not undo a newer manifest.
9. **Honesty about the tests:** the first version promised none would change.
10. Smaller: `ask` and `paste` are now `on-demand` and `always`; the hook entries are five, not
    three; the line that says a skip covers is `codex-review-coverage.mjs:252-258`, not `:247`;
    "no review in this project" is printed when both reviews are off; question 1's
    recommendation no longer rests on the orchestrator's unchecked count.

What the readers proposed and was not taken: dropping `auto` for the language server (the code's
reader: one more key when declared `off`). Kept, because line 8275, which he approved, says the
harness decides it from the project's files. Dropping `always` (the same reader). Kept: it
costs no write, and without it a project cannot keep today's behavior.

### What is his to decide (sent through the orchestrator, one at a time, in this order)

Preface for him, since his line 8758 ended in "¿cierto?" and the answer he got was half true:
today the Codex review is demanded before a push only in js-harness itself; in a project where
the harness is installed it is advice.

1. **Where the Codex review is on, is it demanded before a push?** (a) Yes (recommended): `init`
   and `apply` wire the push check; a push with code and no review is refused. It costs more
   build (a first push and a push by URL are refused by today's row and need an answer), and
   more refusals. (b) No: it stays advice outside js-harness; it costs nothing and can stop
   happening unseen.
2. **How does the Codex review start in a new project?** (a) By itself (recommended): off with
   no code, on when the first code appears; whoever has no plan turns it off once. (b) Off until
   someone turns it on: nobody pays unasked; a project with code can go without a second reader.
   (c) Always on: even a research project is asked for it at its first data file.
3. **Projects already installed (today, the practice one): at their next update, do the paste of
   the code map and, with no TypeScript, its server go off by themselves?** (a) Yes, and it says
   so (recommended): about 1,200 tokens saved a prompt, measured here. (b) Only in new projects.
   (c) It asks in each project.
4. **With the Codex review off, what does gentle-ai review?** It is a written rule; nothing
   refuses a push for it. (a) High and medium risk (recommended): gentle-ai enters a review only
   at high risk by its own rule (his global `CLAUDE.md`, "Entry rule": "only when `review_due`
   is true (`high_risk`)"), so with Codex off a medium change is read by nobody; it spends more
   of the Claude plan. (b) As today, high only. (c) Every change with code: the dearest.

To be told with them, not asked: the way back is by what a commit touches, not by turning
things off (above); and `off` for the code map does not stop an agent that follows gentle-ai's
own rule.

### His answers, and what is still open (2026-10-13)

All four answered with the recommended option: S6 to S9 in Specs, each read from his line. The
two things told and not asked were told in the orchestrator's reply at line 12682 of the same
transcript (read here from the transcript); he has not objected. So the design above is his,
with `codexReview` `auto` as the default (S7).

Answered since (S10, line 13159: it passes and says so). As it was asked: **the first push of
a project**.
With S6, a new project's first push meets a row that refuses when the remote has no default
branch (`bin/check.mjs:1136-1141`). It arises only where the remote holds no branch at all. By
the rule's numbers (`bin/lib/rules-data.mjs:13`, a floor of 300,000 input tokens a review;
`:31`, 1,200 a changed line): in a project that starts empty either way is cheap (one review of
at most the floor while the push stays under 250 changed lines; the practice project holds 22
lines that are not Markdown); in one that already holds code, reviewing everything is 12 million
tokens for each 10,000 lines (this repository: 129,155 lines that are not Markdown in 345
files, counted with `git ls-files` and `wc -l`). The three options sent: not reviewed; everything
from the first commit; the push passes, says how many lines went unread and names the command
that reviews them when he chooses to pay. Built last.

Also his, from the orchestrator (its line 13033, not read here): the repository stays private,
so nothing in the harness may assume a public repository or free runners.

### Where this meets the other sessions (told to the orchestrator before any edit)

State 2026-10-13 19:43 (the orchestrator's messages, claims): JH 8 has nothing open in
`bin/lib/project.mjs` or `bin/check.mjs`, and this session edits both in its branch; JH 8 left
one comment at `bin/check.mjs:467` to keep or hand back. `bin/js-harness.mjs` waits for JH 8's
T8 (`0cca602`, adds `--version`) to be on `main`. JH 5's and JH 7's files stay theirs until each
answers. JH 8 agreed to both proposals and left two things to settle in this stretch: `status`
prints "this clone: set up" for any manifest (`bin/update.mjs`, `reportProjectStatus`;
`projectLocation` answers `noPin` with `manifestPresent`), which is untrue of a project `init`
never set up; and `uninstallProject` validates `init`'s shape before it touches anything, so a
manifest that holds settings alone must pass it and must not remove a `harness.json` `init` did
not write.

- JH 8: `bin/check.mjs` (the validation row, the `functions` row, the debt row, the push row
  reading the switch before the remote); `bin/lib/project.mjs` (`init`, `sync`, `uninstall`, the
  manifest's new list, the template) and its tests' fixtures; `scripts/practice.mjs`; what
  `sync` does with no pin; the guard of an older `uninstall` against a newer manifest; if
  question 1 is yes, a pre-push hook in the shared hooks folder against per-worktree manifests,
  and what the row does at a first push (`bin/check-codex-reviews.test.mjs:863-876` pins a
  refusal).
- JH 5: `bin/lib/manifest.mjs:26`, `:29` (the skill's two lines); `bin/lib/stack.mjs` (the
  codegraph row); the `codex-plugin` row, which still spawns `codex login status` with the
  review off and whose plugin he ordered removed (line 8938).
- JH 7: `bin/lib/rules-data.mjs:8-93` (the Codex rules); the line question 4 puts in an
  installed project's `AGENTS.md`; `docs/ROADMAP.md`, item 4.
- JH 10: the Codex row of `check --push` reads records from the clone's git folder
  (`bin/lib/codex-reviews.mjs:38-48`), which GitHub does not have, so a green run there cannot
  stand in for that row; it can stand in for the sensors. With the review off at the pushed tip
  there is nothing to stand in for.
- New files, nobody's: `bin/lib/functions.mjs`, `bin/functions.mjs` and their tests.


## Tasks

- [ ] T0 (route: inline, with two read-only explorers for the map and two readers; first
  version `f8e70c0`) The design: the functions that exist and what each costs when it is not
  needed, which become switches, where a switch is stored, how each command reads it, the
  defaults, the migration; attacked by two readers; its questions sent to the orchestrator.
  Specs: S1 to S5. Open until his four answers are in the Log.
- [x] T1 (done 2026-10-13; the commit after `82761e8`, named in the Log) `bin/lib/functions.mjs`
  and `bin/lib/functions.test.mjs`. As planned (route: inline; S1, S2): reads and validates `functions`
  from a parsed `harness.json`, answers "the project holds code" from a list of paths, resolves
  each switch with its reason. Pure, no git and no file read in it, so every rule is a test.
  The default of `codexReview` is one constant, since question 2 may move it.
- [ ] T2 (route: inline; S2) The probe: Claude Code honors `env.CODEGRAPH_NO_PROMPT_HOOK` and
  the `enabledPlugins` key from a clone's `.claude/settings.local.json`; its output in the Log.
- [ ] T3 (route: inline; S2) `js-harness functions`, the read-only view, and its route.
- [ ] T4 (route: inline; S4; needs JH 8's `bin/check.mjs`) `codexReview` in the commit's rows,
  in the push row read at the pushed tip before the remote, and in `codex-review`; the line
  when a push turns the review off; one test for each existing behavior of those rows at the
  default.
- [ ] T5 (route: inline; S2, S3; needs JH 8's `bin/lib/project.mjs`) The manifest's `settings`
  list, `functions apply`, and `uninstall` undoing each key exactly.
- [ ] T6 (route: inline; S1, S3; needs JH 8's and JH 5's files) `codeMap` in `init`, `sync` and
  `doctor`; the `functions` row of the gate; the fixtures of the tests that expected an index
  in an empty repository.
- [ ] T7 (route: inline; S2) `functions set`.
- [ ] T8 (route: inline; S4; needs JH 5's and JH 7's files) The texts: the skill, the usage,
  the Codex rules, the `AGENTS.md` template that serves both kinds.
- [ ] T9 What his answers add: the push check wired by `init` (question 1), the migration
  (question 3), gentle-ai's rule with the Codex review off (question 4). Written when answered.

Forecast: over 400 authored lines, so more than one pull request; the slices are the stretches
below, each to `main`, as this project's pull requests already go.

### The order of the build (2026-10-13, after his answers; taken by the orchestrator)

T0 is closed by S6 to S9. The tasks above enter in three slices, grouped so that each whole
check carries what one review can read (the gate's line was held 54 of 60 minutes that evening,
the orchestrator's measure):

- **Slice 1, files that were nobody's.** T1; then, in one commit: T3 without its route
  (`bin/functions.mjs`, `bin/lib/project-functions.mjs`: the switches of the working tree or of
  a commit) and the first half of T5 (`bin/lib/settings-key.mjs`: a key written into a settings
  file and undone exactly). The route and the usage line in `bin/js-harness.mjs` wait for JH 8's
  T8 on `main`.
- **Slice 2, `bin/lib/project.mjs`,** call sites only, the logic in a new module beside it:
  `functions apply` (no pin needed; where no project manifest exists it writes one that holds
  only what it applied), called by `init` and `sync`; the manifest's `settings` list and a
  format number that a copy which does not know it refuses to undo; `uninstall` undoing each
  key; `codegraph init` only where the map resolves on; the pre-push hook where the Codex review
  resolves on (S6); the `AGENTS.md` template for both kinds; `status` saying what a manifest
  holds; the fixtures of the tests that expected an index in an empty repository. T2's probe and
  T7 (`functions set`) ride here.
- **Slice 3, `bin/check.mjs`,** call sites only, after JH 8's work on the check's time is on
  `main`: the row that validates `functions`, the row that says a switch is not applied in this
  clone, the Codex rows reading the switch at the pushed tip before the remote, the review row
  saying a medium change is due when the Codex review is off (S9); `codex-review` reading the
  switch at its head. Then the texts (T8), each after its owner's word, and the first push, by
  his answer.

Each later slice is written in a worktree of its own, stacked on the one before: a gate reads
the working tree it guards, so nothing unfinished may sit in a tree whose commit waits in line.

### Slice 2, read before it is written (`bin/lib/project.mjs` at `75b0ceb`)

What the code already gives, so the slice stays call sites and one new module
(`bin/lib/project-apply.mjs`, `applyFunctions(root, deps)`):

- The manifest's path is `resolveGitPath(root, 'js-harness/manifest.json', spawn)`, with
  `<root>/.git/js-harness/manifest.json` as the fallback (`:908-909`, the same two lines in
  `uninstallProject`, `:1160-1161`). `resolveGitPath` and `runCodegraphInit` are exported;
  `writeManifestAtomic` (`:451`), `initCodegraph` (`:409`) and `codegraphDirPath` (`:371`) are
  not, and get an `export`.
- `sync` copies the manifest, changes the copy and writes it only if it changed
  (`:1376-1399`); its `codegraph init` at `:1387-1394` runs whenever `.codegraph` is absent and
  becomes conditional on the map resolving on. `writeProject` calls `codegraphStep` at `:761`,
  the same condition.
- `isValidManifestShape` (`:1013-1027`) asks only for a `files` array, so a manifest that holds
  settings alone (`files: []`) passes, and `uninstallProject` then removes no file: a
  `harness.json` `init` did not write is in no `files` and is never touched. The settings are
  undone before the manifest is removed (`:1263`), each as an action of its own.
- The format number: `manifest.format`, absent in every manifest written so far. A copy that
  reads a `format` greater than the one it knows refuses to undo and says which copy wrote it.
  A copy already installed that knows no format cannot be made to refuse; that is said, not
  hidden.
- `writeHookGate` (`:627-677`) is written for `hooks/pre-commit` and its text
  (`PRE_COMMIT_HOOK`); the pre-push hook is the same step with the name and the text as
  arguments. Its text must do what `.githooks/pre-push` does: one `js-harness check --push
  --remote "$1" --head <sha>` per pushed ref, a delete skipped.
- What `apply` wants: the paste key when `codeMap` resolves `off` or `on-demand`; the plugin key
  when `languageServer` resolves `off`; an index when `codeMap` resolves on and `.codegraph` is
  absent; the pre-push hook when `codexReview` resolves on. What it takes back: a key or a hook
  it recorded and no longer wants; an index only for a declared `off` and a recorded
  `createdDir`. Errors in `functions` apply nothing.
- The settings file is `.claude/settings.local.json` under the root; a record's `path` is
  repository-relative, like a file's.

## Log

- **L1** (2026-10-13, the request that opened the session, verbatim): "Sos la sesión "JH 9 ·
  funciones a demanda y revisión de Codex opcional". Leé tu apertura con: js-harness sessions
  --opening "JH 9 · funciones a demanda y revisión de Codex opcional" y seguila." The opening is
  the orchestrator's text, a claim; what it asks, in order: this document, the design before any
  code, his earlier words and two readers before the design reaches him, the questions to the
  orchestrator, then the build task by task.
- **L2** (2026-10-13 18:48) Opening read; lines 8161, 8250, 8315, 8758 and 10519 read with
  `sessions --quote`; the orchestrator told by its session id. Worktree and branch created from
  `origin/main` at `46eec34`. Two read-only explorers launched for the map of the functions and
  of the Codex review's surface.
- **L3** (2026-10-13) Both maps in; their load-bearing claims spot checked here (`rg -n
  "pre-push" bin scripts -g '!*.test.mjs'` empty; `bin/check.mjs:308-321` and `:1399-1400`;
  `bin/lib/project.mjs:382-400`, `:686-694`; `bin/lib/stack.mjs:328-384`; `~/.codex/hooks.json`
  holds no codegraph hook). The design's first version written from them, with four questions
  for him. Two readers on Opus at high effort launched to attack it, one against the code and
  one against his words; nothing is sent to the orchestrator until "What the readers changed"
  is written.
- **L4** (2026-10-13, the lead's message of 19:02, a claim) `main` moved to `75b0ceb` (pull
  request 104 of JH 8: the package ships `bin/` without its tests). The branch was fast-forwarded
  to it before its first commit; `scripts/package-contents.test.mjs:45-52` compares the package
  with the files of `bin/` that are not tests, so a new command file is covered by it. JH 10
  holds the gate on GitHub, and its design asks which local check a green run there may stand in
  for: it meets this feature at the Codex row of `check --push` (`bin/check.mjs`). Owed to the
  lead: where the two meet, once the design's second version says how that row reads the switch.
- **L5** (2026-10-13 19:15) The first version committed as `f8e70c0` (the gate of a documents
  commit: `rules` and `document tests` passed, the sensors did not run, review not due). Both
  readers answered. The reader of the code confirmed the lines of "What exists today" but three,
  and found four blockers (the default-branch read, the two sources of the switch, no command
  that applies in a project with no pin, the tracked settings file); the reader of his words
  found five (three decisions of his written as decided, a research project not free of Codex,
  turning Codex off locked behind Codex, the default by the machine's login, the agent never
  told that code appeared). The second version is written from both; "What the readers changed"
  holds each move and the two proposals not taken, with the reason. Checked here of the
  readers' claims: `bin/doctor.mjs:215-236`, `bin/lib/project.mjs:1500-1536`,
  `bin/check.mjs:1124-1142`. Next: the four questions and the meeting points to the
  orchestrator; then T1.
- **L6** (2026-10-13 19:18) The design's second version committed as `82761e8`. The four
  questions, the finding that goes before the first, the two things to tell him and the meeting
  points sent to the orchestrator by its session id (delivered; its turn started on it). A slip
  in that message: its last line gave a context share nobody had read; corrected in a second
  message with the reading (50 percent, 249,627 of 500,000).
- **L7** (2026-10-13) T1. RED: `node --test bin/lib/functions.test.mjs` failed with the module
  absent (the file's one failure, before `functions.mjs` existed). GREEN: the same command, 21
  tests, 21 pass. What the module is: `readFunctions` (a parsed `harness.json` to `{ values,
  declared, errors }`), `programFile` and `typeScriptFile` (the first path of a list whose name
  is a program's, or TypeScript's), `resolveFunctions` (each switch to `{ value, declared,
  because }`). Decisions taken in it, beyond the design: a name under `functions` that is no
  switch is an error, since a misspelt switch would otherwise be a silent default; a value that
  cannot be read is read as on (`strict`), so the push path, which must not refuse on it, has an
  answer; files that could not be read make every `auto` on. No existing command or option is
  touched: nothing imports the module yet. Risk: none (two new files, no caller).
- **L8** (2026-10-13 19:30 to 19:43) His four answers, relayed by the orchestrator with line
  numbers that were assistant entries (12783, 12805, 12818, 12838: `sessions --quote` refused
  each); found by listing the answer entries from line 12700 and read at 12777, 12795, 12814
  and 12828. Recorded as S6 to S9. The orchestrator took the proposed order, gave the go for
  `bin/check.mjs` and `bin/lib/project.mjs` on JH 8's word, and carries a fifth question to him,
  the first push, with the costs above.
- **L9** (2026-10-13 19:41) A rule broken by this session, reported to the orchestrator in four
  parts. What: tests and transcript reads run beside gates that were running (the eight
  `sessions --quote` of L8 beside the gate of `D:\js-harness`; three small test files, about 40
  seconds of node and git in all, beside the gate of `github-gate` between 19:34 and 19:38),
  on a reading of the comment at the top of `bin/gate.mjs` ("One test file run alone during a
  task stays free") against the opening's "never run a test, a board read or a reviewer beside a
  gate that is running". Fix: red and green run inside this session's turn of the lock
  (`js-harness gate -- node --test <files>`, or the check itself). What stops it: the comment
  and the rule say opposite things and one must change (JH 8's file); a candidate for the
  register of failures. Proof: from 19:41 every test run of this session is a gate in
  `js-harness gate log`.
- **L10** (2026-10-13) Slice 1's second commit, written and run while T1's commit waited in the
  line (the runs are the ones of L9; the test files were written before their modules, and red
  was each file failing with its module absent). `bin/lib/project-functions.mjs`: `gitIn`,
  `workingTree` (tracked, staged, and untracked not ignored), `commitTree`, `harnessOfTree`,
  `harnessOfCommit` (a commit git cannot read is an error, never "declares nothing"; a
  byte-order mark is no part of the JSON), `functionsOf`; 12 tests. `bin/functions.mjs`:
  `functionsMain`, read-only, one line per switch with its value and why, `--json`, exit 1 with
  each reason on stderr when a switch cannot be read; 8 tests; not routed yet.
  `bin/lib/settings-key.mjs`: `applySettingsKey` (written, kept, conflict, problem; the file's
  own indent, line endings and final newline; never over another value) and `undoSettingsKey`
  (removed with the containers, the file and the folder made here once empty; changed; gone;
  problem); 14 tests. Decided in it: a record needs no earlier value, since a key that held
  one is a conflict and is never written. No existing command or option is touched. Risk: none
  (new files; no caller yet).
- **L11** (2026-10-13 19:48 to 20:29) Slice 1 is two commits. T1 is `8e57dc4`: its check waited
  13 min 27 s for the lock, `npm run test` passed, and "gentle-ai could not assess the pending
  change". The rest is `b502494`: its check waited 29 min 50 s, `npm run test` passed, review
  "medium risk, 7 paths, 849 lines: review not due (under_budget)". The assessment T1's check
  could not make, run by hand over the slice: `gentle-ai review assess --cwd . --agent
  claude-code --base-ref 75b0ceb --committed-only --json` answered `risk: medium`,
  `executable_change` (`bin/functions.mjs`), 9 paths, 1,638 lines, `review_due: false`,
  `under_budget`. So no gentle-ai review of this slice; it stays pending in the slice until a
  later commit reaches the budget. His answer on the first push read at line 13159 and recorded
  as S10 (the quote first queued in the lock's line and withdrawn on the orchestrator's word: a
  quote is free beside a gate, its ruling of 20:17, which also frees one test file of under
  half a minute and replaces L9's reading of the rule).
- **L12** (2026-10-13 20:29) The Codex review of the slice. `codex-review --base 75b0ceb --plan`:
  2 code commits, none covered; the run starts at `82761e8`; 3 parts, 959 changed lines in 8
  files, 140 lines of Markdown left out; estimate about 500,000 input tokens, inside the
  allowance of 1,150,800 (the larger of 300,000 a review and 1,200 a changed line); its higher
  figure, 2,640,000, is over. By the rule (the estimate inside the allowance) it runs without
  asking, inside a turn of the lock: `js-harness gate -- node bin/js-harness.mjs codex-review
  --base 75b0ceb`. Its outcome is the next entry.
- **L13** (2026-10-13 21:09) The first run of that review started nothing: it waited about 40
  minutes in the lock's line (queued 20:29, its turn after 20:56) and then refused, "Tracked
  files have uncommitted changes, but the record claims the committed range base..HEAD", because
  this document had been edited after the commit. No token spent. The fault is this session's:
  a command queued for a long wait without its cheap precondition looked at first. The fix now:
  this document is committed before the review is queued again, and nothing in the tree is
  edited while it waits. What would stop it in the harness: `codex-review --plan` could say that
  the tree is not clean, and `gate` could run a command's cheap refusal before the wait, as the
  check stops on a failing static row before it waits. A candidate for the register of failures,
  told to the orchestrator.
- **L14** (2026-10-13 21:13) The Codex review of `82761e8..d24c510` ran in 3 parts and is
  recorded: 385,202 input tokens (277,120 cached) in 148 s, inside its allowance. Each part's
  verdict was "the patch is incorrect"; four findings, all P2, all true, all fixed in the commit
  that carries this entry, each with a test written first:
  1. `bin/lib/functions.mjs`: a name under `functions` that every object inherits
     (`constructor`, `toString`, `__proto__`) was looked up as a switch and crashed the reading.
     Now only own names of the table are switches. Red, then green.
  2. `bin/lib/project-functions.mjs`: a `harness.json` that is there and cannot be read (a
     folder of that name, no permission) threw. Now it is an error like one that is not JSON.
     Its test passes; its red was not seen, the fix having been typed before the run.
  3. `bin/lib/settings-key.mjs`: a settings path that cannot be read threw from both functions.
     Now a `problem`. Red, then green.
  4. `bin/lib/settings-key.mjs`: two keys written into one new file could only be undone in
     reverse order; in the order written, an empty file was left, and the same for two keys
     under one object the harness made. `applySettingsKey` now takes the records of the keys
     already written into that file, and what one of them made is this key's too, so whichever
     is undone last takes the empty object, file and folder with it. Red, then green.
  Run: `node --test bin/lib/functions.test.mjs bin/lib/settings-key.test.mjs`, 40 of 40; the
  two tests of `project-functions.test.mjs` that match "cannot be read", 2 of 2. No existing
  command or option is touched. Risk: none (the modules have no caller yet).
- **L15** (2026-10-13 21:29 to 22:15) The fixes are `7b6ce12` (its check: lock waited 1 min
  26 s, `npm run test` passed, review medium, not due). `main` at `9b227df` (JH 8's T8, with
  `js-harness --version`) merged as `dac972b` (its check waited 29 min 59 s, tests passed). Then
  `functions` routed in `bin/js-harness.mjs` with its help line, and one test that it is listed
  and wired through the dispatcher: red with the route stashed (0 of 1), green with it
  (`node --test bin/js-harness.test.mjs`, 33 of 33). The route touches the dispatcher every
  command shares, by one entry in its table; the test of `--help` that lists the other commands
  still passes. Risk: none.

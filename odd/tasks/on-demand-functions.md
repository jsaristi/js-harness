# Functions on demand, and a Codex review a project can turn off

Locator: `odd/tasks/on-demand-functions.md` · Engram mirror: `odd/on-demand-functions/tasks` ·
Branch: `feat/on-demand-functions`, in the linked worktree
`D:\js-harness-worktrees\on-demand-functions`, cut from `origin/main` at `46eec34` · Session:
`JH 9 · funciones a demanda y revisión de Codex opcional`, orchestrator `JH ORQ · js-harness`
(app session `local_11c45a36-0115-4c92-b865-f1dc3f68c3c1`) · Runner: `node --test` · Delivery:
ask-on-risk

State 2026-10-13 18:55 (this machine's clock): opened. The contract and the specs below are
written; the design is owed and nothing is built. The design reaches Sebastián only through the
orchestrator, after a search of his earlier words (done, "His earlier words") and two independent
readers.

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
- With every switch at its default, a project that has code behaves as today — because the
  first version holds everything he ordered (line 10519) and nothing he has is to be lost.
- A switch cannot be a way for a branch to exempt itself from a check without that being visible
  — because the push check exists to stop exactly that.
- No design reaches him before the search of his words and the two readers — his rule for a
  protocol or design change.

## Effort
high

## Ask me before
Product choices, each as a question with options through the orchestrator: which functions
become switches and their defaults; what gentle-ai's review does when the Codex review is off;
what happens to projects already installed. Anything installed or changed on his machine. Spend
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

First version, 2026-10-13, this session's. Not yet attacked by its two readers and not yet sent.
Everything under "What exists today" was read on `46eec34` by two read-only explorers and spot
checked here; the rest is a proposal.

### What exists today, and what it costs a project without code

What `install` writes on a host serves both kinds of project: two skills on each host
(`bin/lib/manifest.mjs:108-127`) and three hook entries, `doctor --hook` at session start,
`resume --hook` after a compaction and `resume --pause` after a tool call (`:134-165`). None is
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
   (`bin/lib/codex-review-coverage.mjs:247`): today's way to go without Codex, one slice at a
   time.

### The switches

Three, in `harness.json` under one key, each optional:

```json
{ "functions": { "codeMap": "auto", "languageServer": "auto", "codexReview": "on" } }
```

| Switch | Values | When the key is absent | Governs |
|---|---|---|---|
| `codeMap` | `auto`, `ask`, `paste`, `off` | `auto` | the index and the paste |
| `languageServer` | `auto`, `on`, `off` | `auto` | the TypeScript plugin in this project |
| `codexReview` | `on`, `off` | `on` | the push check, the debt row, the command, the texts |

- `codeMap`: `off` is no index and no paste; `ask` is the index with the paste off, the map
  asked when needed (what this repository has by hand, and what he approved at line 8275 as "de
  fábrica"); `paste` is the index and codegraph's paste, today's behavior on a machine with
  codegraph; `auto` is `ask` when the project holds code and `off` when it holds none.
- `languageServer`: `off` writes the plugin off for this project; `on` leaves the machine's
  setting alone; `auto` is `on` when the project holds a `tsconfig.json`, a `.ts` or a `.tsx`
  file and `off` otherwise. It only ever writes when the plugin is installed on the machine.
- `codexReview`: `off` means nothing demands, counts, runs or advises a Codex review in this
  project.
- A missing `functions`, or a missing switch in it, is the default and never an error (line
  11166). A value outside the table is an error row that fails the gate, as `sameTree` does
  (`check.mjs:308-321`), never read as on or as off.
- No preset and no `kind` key. With `auto`, a project's kind is what its files say, so a
  "research project" is the defaults in a tree with no code. This drops the orchestrator's
  "a kind of project is a preset of switches": a preset would be a second place that says the
  same thing and can disagree with the files.

What else was considered and is not a switch: the sensors (already declared and already silent
with nothing to run), gentle-ai's review (it has its own switch, `gentle-ai review mode`, his),
the pause notice (he placed it in every project, line 8488), `resume`, the skills.

### "The project holds code"

One rule, in one new module, `bin/lib/functions.mjs`: a file git tracks or has staged whose name
is a program's: a closed list of extensions (`.js .mjs .cjs .jsx .ts .tsx .py .go .rs .java .kt
.cs .c .h .cpp .rb .php .swift .sh .ps1 .sql` to start) or a build file (`package.json`,
`pyproject.toml`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml`, `Makefile`,
`Dockerfile`). It reads names from `git ls-files`, so it is the same answer for every session
and it can print its reason ("auto: ask, because `src/fetch.py`").

It is a positive list on purpose. The Codex scope's rule is negative (anything that is not `.md`
is code), which is right for a review, where a miss is an unread change, and wrong here, where a
research project's `.csv`, `.png` and `.pdf` would turn the code map on. The two rules answer
different questions and stay separate: this one decides what is prepared, never what is checked.
A miss costs one line (`"codeMap": "ask"`).

This is the answer to "sea inteligente y sepa" (S1) with no watcher: nothing reads the
conversation; the tree is read when a command already runs.

- When the first code file is committed, nothing is prepared in the commit (a gate does not
  write). At the next session start `doctor --hook` resolves `auto` to `ask`, finds no
  `.codegraph` and prints the gap it prints today, with `js-harness sync` as the fix; `sync`
  then prepares the index. Until then the gap does not exist.
- The way back needs no event. With the paste off, an index costs nothing at a prompt, and the
  per-commit functions already charge by what a commit touches. `auto` never deletes an index;
  only a declared `off` removes it, and only if the manifest says the harness made it
  (`createdDir`, `project.mjs:1246`).

### How each command reads a switch

- **`check` (the gate, a commit):** validates `functions` (an error row before the sensors).
  With `codexReview` `off`, the debt row is one information line, "off in harness.json", and
  runs no git.
- **`check --push`:** with `codexReview` `off` the row passes with one line that says the review
  is off and where that is read from; with `on`, today's row. **The switch is read from the
  remote's default branch**, the same ref the row already measures from (`check.mjs:1133-1142`),
  with `git show <ref>:harness.json`, never from the working tree (`--head` may not be the
  checkout) and never from the pushed tip. So a branch cannot turn the review off for itself:
  turning it off is a change that has to be merged first, and the branch that carries it is
  still held to the rule it found. A branch in a repository with no remote default branch yet
  reads the pushed tip, and says so.
- **`codex-review`:** with the switch `off` (read from the working tree's `harness.json`, since
  this is a command a person or an agent runs here) it launches nothing, writes no record,
  prints that the project has the review off, and exits 0. `--plan` the same.
- **`init`:** writes `harness.json` as today plus nothing by default (absent means default). It
  runs `codegraph init` only when `codeMap` resolves to `ask` or `paste`; it applies the paste
  and the language server (below). The `AGENTS.md` template becomes one text that serves both
  kinds ("the evidence that proves it" beside "the test"), not two.
- **`sync`:** applies the same three things to a project already installed, and reports each as
  an action, as it reports files today.
- **`doctor`:** a missing `.codegraph` is a gap only when `codeMap` resolves to `ask` or
  `paste`. The `typescript-lsp` row stays a report.
- **`uninstall`:** undoes each applied setting from the project manifest (below).
- **A new read-only command, `js-harness functions`:** each switch, what is declared, what it
  resolves to and why, and whether this clone has it applied. No command writes `harness.json`
  after `init` (`project.mjs:1294`): a switch is changed by editing the key and running `sync`.
- **The hooks:** none changes. `doctor --hook` gets the new gap rule through `doctor`.
- **The texts:** the skill says the Codex review applies where the project has it on
  (`manifest.mjs:26`, `:29`); the usage line the same. This repository's `AGENTS.md` keeps its
  rule: the review stays on here.

### The paste and the language server: a setting inside a file the harness does not own

Both are keys in Claude's project settings: `env.CODEGRAPH_NO_PROMPT_HOOK = "1"` and
`enabledPlugins["typescript-lsp@claude-plugins-official"] = false`. Codex has neither: `rg -n -i
"codegraph|UserPromptSubmit" ~/.codex/hooks.json` finds nothing, and the plugin is Claude's
(`stack.mjs:375`).

- **Where:** the tracked `.claude/settings.json` of the project, not the untracked
  `.claude/settings.local.json`. A tracked file reaches every clone and every linked worktree
  with the checkout; the untracked one is why this repository's worktrees do not have the switch
  that the main checkout has. The switch is a project's decision and `harness.json`, which
  declares it, is tracked too.
- **How it is recorded:** the project manifest learns one new list, `settings`: for each key
  written, the file, the pointer, the value written, and what was there before (absent, or the
  earlier value). Today it records whole files, folders and the codegraph flag
  (`project.mjs:767-780`), and the machine manifest's entries only append to arrays
  (`manifest.mjs:303-308`), so neither can express a key of an object.
- **How it is undone:** `uninstall` puts back what was there, only if the key still holds what
  the harness wrote; a key someone changed since is kept and reported, as an edited file is. A
  file the harness created and that is empty again is removed.
- **A key that already holds another value** is never overwritten: it is reported, and the
  switch shows as not applied.

### Defaults, and a project already installed

- A project with code and no `functions` key: `codeMap` `auto` → `ask`. The index stays as it
  is; **the paste goes off at the next `sync`**, which says so. This is the one behavior that
  changes without anyone declaring it, and it is the one he approved at line 8275 ("pegado
  automático apagado de fábrica"). `languageServer` `auto`: unchanged if the project has
  TypeScript, off if not. `codexReview` `on`: unchanged.
- A project without code: no index is made, no gap is reported, the plugin is off for it, and
  the Codex review never comes up because no commit holds code by the review's own rule (a
  project whose data files should not count marks them `-codex-review` in `.gitattributes`, as
  today, or turns the switch off).
- Nothing is applied until someone runs `sync` or `init` there. The only other installed project
  on this machine is `D:\js-harness-practice\project` (found with `fd -H -I -d 4
  '^harness\.json$'` on `D:` and the user folder).
- This repository was never `init`-ed (it has no project manifest). Applying the switches here
  replaces the hand-written `.claude/settings.local.json` and is a change on his machine: his
  yes, asked when the build is done.

### What is his to decide (sent through the orchestrator, one at a time)

1. **With the Codex review off, what does gentle-ai's review do?** Today gentle-ai reviews only
   what its assessment calls high risk. Options: (a) it also reviews medium risk when Codex is
   off (recommended: the orchestrator reported that Codex was the only reader of the code on
   2026-10-12, so with it off a medium change would be read by nobody; this keeps the cost in
   proportion); (b) as today, by its own assessment; (c) every slice with code. In every option
   the harness can only say it: the `review` row of `check` and the project's `AGENTS.md` carry
   the rule; nothing refuses a push for a missing gentle-ai review.
2. **Does a project with the Codex review on refuse a push that lacks it?** Today only this
   repository does. Options: (a) yes, `init` and `sync` wire the push check wherever the switch
   is on (recommended: otherwise "on" means two things, and a review nothing demands is the kind
   that stops happening unseen); (b) no, it stays advice outside this repository.
3. **What does a new project get?** Options: (a) the Codex review on if the Codex CLI is
   installed and logged in on the machine that runs `init`, off otherwise, written in
   `harness.json` and said by `init` (recommended: it is his case of line 8758, the person with
   no plan, decided without asking them); (b) always on; (c) always off.
4. **Which functions get a switch in 1.0.0?** Options: (a) the three above (recommended); (b)
   only the two he named, the code map and the Codex review, with the TypeScript server left to
   the hand-written setting; (c) the three and a fourth for the gate's sensors.

### Files this needs from other sessions (to tell the orchestrator before any edit)

- JH 8: `bin/check.mjs` (three call sites and a validation row), `bin/lib/project.mjs` (`init`,
  `sync`, `uninstall`, the manifest's new list, the template), `bin/install.mjs` only if a
  command is routed there.
- JH 5: `bin/lib/manifest.mjs` if the skill's text is theirs (two lines); `bin/lib/stack.mjs`
  for the gap rule. Their `codex-plugin` row of doctor is where the two features meet: with
  `codexReview` `off` that row still spawns `codex login status`, and by line 8938 the plugin
  is to be removed anyway.
- JH 7: a line in an installed project's `AGENTS.md` for decision 1 touches the rules an
  installed project carries, their design; `docs/ROADMAP.md`, item 4, is theirs to update.
- New files, nobody's: `bin/lib/functions.mjs`, `bin/functions.mjs` and their tests.

## Tasks

- [ ] T0 (route: inline, with two read-only explorers for the map) The design: the functions
  that exist and what each costs when it is not needed, which become switches, where a switch is
  stored, how each command reads it, the defaults, the migration; attacked by two readers; its
  questions sent to the orchestrator. Specs: S1 to S5.

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

# Modern Web Guidance as a switch a project turns on

Locator: `odd/tasks/web-guidance.md` · Engram mirror: `odd/web-guidance/tasks` · Branch:
`docs/web-guidance-design`, in the worktree `D:\js-harness\.claude\worktrees\roadmap-modern-web-guidance`, cut from
`origin/main` at `15f74d8d` · Session: `Google web guidance para el proyecto`, a work session; the lead is
`JH ORQ · orquestador F8` · Runner: `node --test` · Delivery: ask-on-risk

## State
2026-11-18, this session: the design and its plan are written and no code is. Nothing is installed. Done: the
source read (L2), the harness's own mechanism read (L3), the refutation run (Depth pass, item 4), the row's class
settled (L7), the first double review, 17 findings, each taken (L8). Not done: the confirming review of this
corrected text; the pull request and the ready notice to the lead. Next: the confirming review, then the hand to
the lead. Open: his decisions under "Ask me before", none asked yet, each through the lead.

## Goal
A project turns Modern Web Guidance on with one switch in `harness.json`, off everywhere it is not turned on, read
by every command that reports or configures it, with its gain measured on real interface tasks before any default
turns it on.

## Why
- He builds pages and applications (two Astro projects today) and wants the harness to bring the web platform's
  current practice to them, as it brings library documentation through context7.
- Its figures are its publisher's, none measured here (L2). A harness that turns on what it has not measured repeats
  the failure the evals exist for.
- It is a plugin of each host, it sends the agent's search queries to its publisher, and its skill runs an unpinned
  `npx` package: three reasons it is off wherever a project has not turned it on.

## Done when
- `js-harness contract check odd/tasks/web-guidance.md` exits 0
- `npm run check` exits 0
- `node --test bin/lib/functions.test.mjs bin/lib/project-apply.test.mjs bin/lib/project.test.mjs bin/lib/project-functions.test.mjs bin/lib/stack.test.mjs bin/lib/stack-install.test.mjs bin/lib/latest.test.mjs bin/init.test.mjs` exits 0, with a test for each new behaviour of T4 to T7, one that context7's Claude registration stays unconditional and its Codex one follows `codexReview`, and one each that a missing `harness.json`, an unreadable tree and a switch that did not resolve leave it off
- T2's findings are in the Log, among them a session on a scratch home with the switch off whose loaded skills do not hold the plugin's
- The report of T3's batch is in the Log beside the decision rule written before it ran
- His answers to "Ask me before" are in the Log with his words and where they are read

## In scope / Out of scope
- In: the switch and its `auto` rule (`bin/lib/functions.mjs`); the row, its cells and its fixes (`bin/lib/stack.mjs`,
  `bin/lib/stack-install.mjs`, `bin/lib/latest.mjs`); what `init` and `sync` hold in a clone's settings and how they
  report it (`bin/lib/project-apply.mjs`, `bin/lib/project.mjs`); the custom preset's choice and the help
  (`bin/init.mjs`, `bin/js-harness.mjs`); two eval tasks with a web interface and their arms; the texts
  (`docs/SPEC.md`, the user guide, and the roadmap entry once pull request 909 has landed).
- Out: context7, which stays required in every preset (S4); the plugin's own guides, skill text and CLI, which the
  harness configures and never copies or rewrites; the `chrome-extensions` skill pack; any write to a project's
  `AGENTS.md`, which `init` and `sync` never write where it exists (`bin/lib/project.mjs:800`); Codex's side, until
  T2 shows Codex can keep a plugin out of one project: until then the harness names no Codex install of it, since
  one would be on in every project.

## Constraints
- Zero dependencies, plain Node — because the commands run on any machine without an install step.
- The plugin's install and its marketplace entry are his steps, named by the row with their undo and never run or
  recorded by `stack install` (L7); what the harness writes is inside the clone and recorded so it is undone exactly.
- Off unless turned on — because it is no check and it sends queries out: a project that declares nothing, a tree
  that cannot be read, a switch that did not resolve and a clone never synced all leave it off, as `pushUnasked` and
  `remoteGate` are read (`bin/lib/functions.mjs:12-15`).
- No default turns it on before T3's report, and none where that report is inconclusive or shows a regression —
  because S2 asks to know before adding.
- High-risk item 5 (delivery and environment): a plugin install, and a skill that runs `npx modern-web-guidance@latest`,
  unpinned, at each use; the harness cannot pin it without rewriting the plugin's skill, so it is his to accept.

## Ask me before
- Installing the plugin on a scratch home (T2), and, apart from it, in his real home, which the eval's home template
  copies and which then adds it to the current arm of every other eval (T3).
- The spend of T3's batch, priced by `evals/plan.mjs`, with its trials and its decision rule shown first.
- What the switch is where a project declares nothing: off until declared; on where the project has interface
  files; or on in every project with code, which is what his words say (S1). The design leans to the first two
  because the guides cover only HTML, CSS and browser APIs, and that leaning is this session's, not his.
- Whether the harness sets `DISABLE_TELEMETRY=1` in a clone that turns the plugin on: the host is assumed to read
  the same variable for its own telemetry, so the key would turn that off in the clone too (T2 cites it).
- Whether he accepts the unpinned `npx` package the plugin's skill runs, or the plugin waits for a pinned one.
- Whether this repository, which holds one interface file, declares it off.

## Depth pass
- 1. Method: configuration management of an optional third-party component. Its practitioner keeps it off until
  asked for, records each write with its undo, pins what can be pinned and says what cannot, and measures it against
  a baseline with a decision rule written before the run. The smallest change that meets it reuses what the language
  server has, with the polarity reversed: an entry in `SWITCHES`, a row in `tools`, a key in `SETTINGS_KEYS`; no new
  command and no new module (searched: codegraph for `planStack`, `RUNNABLE`, `functionsOf`, `SWITCHES`,
  `probeStack`, `SETTINGS_KEYS`; `odd/tasks/stack-install.md`, `odd/tasks/f8-s11-complements.md`).
- 2. Raw material: the plugin's README and marketplace manifest at
  https://github.com/GoogleChrome/modern-web-guidance (read 2026-11-17, L2);
  https://developer.chrome.com/blog/mwg-with-internal-component; `bin/lib/functions.mjs:16-24` and `:149-187`;
  `bin/lib/stack.mjs:131-167` and `:343-362`; `bin/lib/stack-install.mjs:21-57`, `:76` and `:175-180`;
  `bin/lib/project-apply.mjs:19-41`; `bin/lib/project.mjs:800` and `:1924`; `evals/home.mjs:42`,
  `evals/without.mjs:341`, `evals/arms.mjs:5-13`; `claude plugin install --help` and `codex plugin --help` on this
  machine; his words (L1).
- 3. The bar:
  spec 1: `node --test bin/lib/functions.test.mjs bin/lib/project-apply.test.mjs bin/lib/stack.test.mjs`: none, new behaviour
  spec 2: `ls evals/tasks`: 21 tasks, none with a web interface, so no A/B can run today
  spec 3: `js-harness contract check odd/tasks/web-guidance.md`: PASS on 2026-11-17
  spec 4: `node --test bin/lib/stack-install.test.mjs`: context7's Claude row holds `wanted: () => true` and its Codex row `codexWanted` (`bin/lib/stack-install.mjs:47`, `:55`); the test not run in this pass
- 4. Refutation: the request fails if a host offers no way to hold a plugin for one project and not the next, or if
  no rule over a project's files tells his interface projects from this one. Run now:
  `claude plugin install --help` names `-s, --scope <scope>` with `user, project, or local`; and a count of interface
  files (`html`, `css`, `scss`, `astro`, `vue`, `svelte`, `jsx`, `tsx`) gives 39 and 6 under `src` in his two Astro
  projects and 1 in this repository (`git ls-files`: `docs/live-board.html`), so 2 of 2 interface projects resolve on
  and this repository does too, by one file. This shows the scope exists and the rule separates by a count; it does
  not show that the host keeps the skill out of a project, which only an install shows: that is T2, his to allow,
  and it is in "Done when". A refuting T2 goes to him as a question before T4.
  Verdict: supports
- 5. Request: give the harness a project switch for Modern Web Guidance that is off unless a project turns it on,
  reusing the switch, row and settings key the language server has; keep context7 required; measure its gain on real
  interface tasks, with a rule written first, before any default; ask him which projects it is on in by default,
  his words naming every development project; hand this plan, reviewed twice, to the lead to place in the queue.
  Adds: none

## Specs
- S1. "cuando se vaya a hacer un proyecto de desarrollo y codigo que va a ser casi la mayoria de las veces, la idea
  es que el harness pueda activarlo" (2026-11-17): a switch a project turns on, read by `init`, `sync`, `doctor` and
  `stack`.
- S2. "quiero saber mas antes de añadirlo, por ejemplo si hacemos una pagina en Astro o una aplicacion en NextJS que
  tanto serviria?" (2026-11-17): its gain is measured here, on an Astro task and a Next.js task, before a default.
- S3. "listo quiero que crees como deberia funcionar todo y pasarle el plan al orquestardor JH ORQ para que el decida
  como ponerlo en toda la cola de implementaciones que estamos haciendo" (2026-11-17): this document, reviewed twice,
  handed to the lead, who places it.
- S4. "Modren web guidance de google nos ayudaria para este proyecto mejor que context7" (2026-11-17): answered no,
  it does another job; context7 stays required and nothing is replaced.

## Tasks
- [ ] T1 (kind: design) S1, S3: the design and its double review (L7, L8). Route: this session. Commit: documents alone.
- [ ] T2 (kind: verify) S1: after his yes, on a scratch home, for Claude Code: what each of `-s user`, `project` and `local` writes; which of them, or which settings key, keeps the skill out of a project that has not turned it on and loads it in one that has, read from the session's loaded skills; the fixed cost by `claude plugin details`; a conflicting value he wrote himself, and off, on, off again. For Codex: whether a plugin can be held out of one project. From the host's settings documentation, no install needed: whether it reads `DISABLE_TELEMETRY`. Route: inline. Commit: the Log.
- [ ] T3 (kind: build) S2: two eval tasks with a web interface, one Astro and one Next.js (fixture, reference, hidden checks of function, of the browser and of accessibility), and three arms: without the plugin, with it, and with it named in the project's `AGENTS.md`. Written in the Log before pricing: the trials per arm, the least gain that justifies a default, the cost limit, and that an inconclusive result or a regression keeps the default off. Each trial pins the `npx` package's version, sets `DISABLE_TELEMETRY=1`, and records the versions of the plugin, the CLI and the host. The plugin arm's home comes from a template of its own, or from an install in his real home with its undo recorded, as he decides. Route: a writer. Commit: the tasks, then their report.
- [ ] T4 (kind: build) S1: the switch `webGuidance` in `SWITCHES` (`auto`, `on`, `off`; strict `off`); `auto` is off over a tree that cannot be read and otherwise as he answers; the custom preset's choice (`bin/init.mjs`), the fixed presets declaring nothing. Route: inline. Commit: with its tests.
- [ ] T5 (kind: build) S1, S4: the row in `tools`, shown while the switch is on. Its `installed` cell reads the installation that serves this project, not the first on the machine; its `claude` cell reads the clone's effective state, not the user file alone; its `project` cell is a gap where the project's `AGENTS.md` does not name the skill, and its fix prints the lines to add: that the skill is used for interface work and that the project's own components win over it. Fixes: `claude plugin marketplace add GoogleChrome/modern-web-guidance` then `claude plugin install modern-web-guidance@googlechrome`, with the undo `claude plugin uninstall` and `claude plugin marketplace remove googlechrome`, as `PLUGIN_UNDO` names engram's; `planStack` lists the gaps as optional. Tested on two projects with different states. Route: inline. Commit: with its tests.
- [ ] T6 (kind: build) S1: `SETTINGS_KEYS` and `SWITCH_OF_KEY` hold the plugin on in a clone whose switch is on, by the key T2 shows, and nowhere else; a value of his that conflicts is kept and reported as not applied here, never as done; the telemetry key as he decides. Route: inline. Commit: with its tests.
- [ ] T7 (kind: build) S1: the help and the usage lines (`bin/js-harness.mjs`, `bin/init.mjs`), and a test that `sync` on a clone with its own `AGENTS.md` changes no byte of it. Route: inline. Commit: with its tests.
- [ ] T8 (kind: docs) S3: the capability in `docs/SPEC.md`, the user guide, and the roadmap entry closed, after pull request 909 has landed. Route: inline. Commit: documents alone.

Order: T1, T2, T3 before T4 to T7, since T2 can change the design and T3 decides the default; T8 last. T4 to T7
touch nine modules of `bin` that other features also change, so the lead places them where those files are free.

## Log
- L1 (2026-11-17, his request as written, this session's transcript): "Modren web guidance de google nos ayudaria
  para este proyecto mejor que context7 osea recuerda que este es un harness para varias cosas pero sobretodo para
  programar"; then "quiero saber mas antes de añadirlo, por ejemplo si hacemos una pagina en Astro o una aplicacion en
  NextJS que tanto serviria?"; "Sí, escanéalo"; "Sí, anótalo"; "cuando se vaya a hacer un proyecto de desarrollo y
  codigo que va a ser casi la mayoria de las veces, la idea es que el harness pueda activarlo"; "listo quiero que
  crees como deberia funcionar todo y pasarle el plan al orquestardor JH ORQ para que el decida como ponerlo en toda
  la cola de implementaciones que estamos haciendo".
- L2 (2026-11-17, evidence, the README and `.claude-plugin/marketplace.json` of GoogleChrome/modern-web-guidance, read
  with `gh api`): the marketplace is `googlechrome` and the plugin `modern-web-guidance`, version 1.0.1, so its id is
  `modern-web-guidance@googlechrome`. Claude Code: `/plugin marketplace add GoogleChrome/modern-web-guidance`, then
  `/plugin install modern-web-guidance@googlechrome`. Codex: `codex plugin marketplace add
  GoogleChrome/modern-web-guidance`, then `codex plugin add modern-web-guidance@googlechrome`. Installs from
  `claude-plugins-official` stopped at v0.0.194 on Oct 12, so the row names the `googlechrome` marketplace. The skill
  costs about 205 tokens fixed (its figure) and tells the agent to run `npx modern-web-guidance@latest search` and
  `retrieve`, local and offline once fetched. Telemetry: installation counts, the calling agent's name, guide ids and
  the agent's search queries, not the prompts; off with `DISABLE_TELEMETRY=1`. A project file `.mwgrc` opts into
  Origin Trial and volatile features; the harness writes none. Its eval rows: Claude Code 57% to 88% of its own checks
  (its row of Nov 8). note inc., on Next.js: 60.8% to 76.5% installed only and 94.0% named in the prompt, and it
  picks native elements over an in-house component library unless `AGENTS.md` ranks them (T5's `project` cell).
- L3 (2026-11-17, evidence, this repository at `15f74d8d`): a switch is an entry of `SWITCHES` with `values`,
  `fallback` and `strict`; `auto` resolves by the project's files (`resolveFunctions`), the language server by
  `typeScriptFile`, and over a tree that cannot be read it is on. A row is an entry of `tools` with `when`,
  `installed`, `configured`, `project` and `fix`; the `typescript-lsp` row reads `pluginInstalledVersion`, which takes
  the first installation entry, and `claudeEnabledPlugin`, which reads the user settings alone, gives Codex `n/a`,
  and its fixes are `claude plugin install`, `enable` and `update`. `planStack` lists its gaps as `optional`, never
  run; the `engram-plugin` row is `manual`, his step. `SETTINGS_KEYS.languageServer` writes `enabledPlugins[<id>]`
  false into a clone's settings where the switch is off, and `paste` writes an `env` key. The language server touches
  seven modules of `bin` (21 lines, tests left out). Read from `--help` only, on this machine: `claude plugin install
  -s user|project|local`, `claude plugin details` (a component inventory and projected token cost), `uninstall`,
  `enable`, `disable`, `update`; `codex plugin add`, `remove`, `marketplace`. Not known: what each scope writes,
  which key keeps this plugin's skill out of a project, and whether Codex can hold a plugin out of one project.
  `npx` and `pnpm` are both on this machine's PATH.
- L4 (2026-11-17, evidence, run once): its `legacy-scan` on `D:\abogadaclaudiajimenez` through `pnpm dlx` changed no
  file and found 5 items, 2 in his code and minor (`src/pages/blog/[...slug].astro:17`,
  `src/scripts/web3forms.ts:135`), over about 20% of the guides.
- L5 (2026-11-17, correction): this session told him the evals already had the pieces for the A/B. The arm family
  exists (`evals/arms.mjs:5-13`); no task with a web interface does, and an arm without a plugin needs it in the
  current arm's home (`evals/without.mjs:341`), which is copied from his real home (`evals/home.mjs:42`). T3 builds both.
- L6 (2026-11-17, this session's reading, not his words): `auto` on by interface file would turn this repository on
  through `docs/live-board.html`, against the roadmap entry's "no gain in this repository"; his to answer.
- L7 (2026-11-17, decision, within S1, read in `odd/tasks/stack-install.md` D1 to D3 and
  `odd/tasks/f8-s11-complements.md` L4, L6 and L9): the row is optional as D1 defines it ("only the session's quality
  depends on it") and optional tools are "shown with `doctor`'s fix, never run". So `stack install` runs no plugin
  command and records none; the install and the marketplace entry are his steps, named with their undo. What the
  harness writes is inside the clone: the switch in `harness.json` and the keys of the clone's settings, as `init`
  "writes nothing outside the repository" (L6). The custom preset takes one more choice beside `--codegraph` and
  `--engram-plugin` (L9). D1 still classes context7 as optional; L4 of the second document made it required since.
- L8 (2026-11-18, evidence and decisions, double review `38343728-3eda-4777-9f93-d47edc019f74`, a Claude reader, 11
  findings, and a Codex reader, 6, on commit `c879a61c`; all 17 taken; 5 of the first reader's and the 6 of the second meet in the same matters). What they changed:
  the switch is off unless turned on, where the first text left the plugin on in every clone not synced (claude 1,
  codex 1); the row reads the installation and the state that serve this project (codex 1); Codex is out of scope
  until T2 shows it can hold a plugin out of one project, where the first text gave it `n/a` for a reason that does
  not hold here (claude 2, codex 2); no write to a project's `AGENTS.md`, the line being the fix of the row's
  `project` cell (claude 3); the refutation says what it does not show and T2 is in "Done when" (claude 4, codex 5),
  its verdict kept as `supports` since the pass takes one of two verdicts and what was run supports; every project
  with code is offered as a default, his words (claude 5); T3 has two tasks, three arms, a rule written first and its
  own home (claude 6, codex 3, codex 4); the unpinned package is his to accept (claude 7); the fixes carry the
  marketplace step and its undo, and the constraint says his step (claude 8); the scope names nine modules and their
  tests (claude 9); context7's two rows are told apart and the roadmap entry waits for pull request 909 (claude 10,
  codex 6); the telemetry variable is read from the host's documentation, its side effect assumed until cited
  (claude 11). Not guaranteed: everything T2 has yet to show.

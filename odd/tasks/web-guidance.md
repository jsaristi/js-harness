# Modern Web Guidance as a switch a project turns on

Locator: `odd/tasks/web-guidance.md` · Engram mirror: `odd/web-guidance/tasks` · Branch:
`docs/web-guidance-design`, in the worktree `D:\js-harness\.claude\worktrees\roadmap-modern-web-guidance`, cut from
`origin/main` at `15f74d8d` · Session: `Google web guidance para el proyecto`, a work session; the lead is
`JH ORQ · orquestador F8` · Runner: `node --test` · Delivery: ask-on-risk

## State
2026-11-17, this session: the design and its plan are written and no code is. Nothing is installed. Done: the
source read (L2), the harness's own mechanism read (L3), the refutation run (Depth pass, item 4), the fork of the
row settled against its two neighbours (L7: listed with its fix, never run). Not done: the double review
(`js-harness double-review read`); the pull request and the ready notice to the lead. Next: the double review, then
the hand to the lead. Open: his five decisions under "Ask me before", none asked yet, each through the lead.

## Goal
A project turns Modern Web Guidance on or off with one switch in `harness.json`, read by every command that
installs, reports or configures it, with its gain measured on a real interface task before any default turns it on.

## Why
- He builds pages and applications (two Astro projects today) and wants the harness to bring the web platform's
  current practice to them, as it brings library documentation through context7.
- Its figures are its publisher's, none measured here (L2). A harness that turns on what it has not measured repeats
  the failure the evals exist for.
- It is a plugin of each host, it sends the agent's search queries to its publisher, and its skill runs an unpinned
  `npx` package: three reasons it cannot be on in every project unseen.

## Done when
- `js-harness contract check odd/tasks/web-guidance.md` exits 0
- `npm run check` exits 0
- `node --test bin/lib/functions.test.mjs bin/lib/project-apply.test.mjs bin/lib/stack.test.mjs bin/lib/stack-install.test.mjs` exits 0, with a test for each new behaviour of T4 to T7 and one that context7 stays required
- The report of the A/B batch of T3 is in the Log: its score with and without the plugin, per task, and its cost
- A project with the switch off shows no row and loads no skill; with it on, `js-harness doctor` shows the row and its fix: shown in a test through `probeStack`
- His answers to "Ask me before" are in the Log with his words and where they are read

## In scope / Out of scope
- In: the switch and its `auto` rule (`bin/lib/functions.mjs`); the row and its fixes (`bin/lib/stack.mjs`,
  `bin/lib/stack-install.mjs`, `bin/lib/latest.mjs`); what `init` and `sync` hold in a clone's settings
  (`bin/lib/project-apply.mjs`); the line that names the skill in a project's `AGENTS.md`; one eval task with a web
  interface and its arm; the texts (`docs/SPEC.md`, the user guide, the roadmap entry).
- Out: context7, which stays required in every preset (S4); the plugin's own guides and CLI, which the harness
  configures and never copies; the `chrome-extensions` skill pack; his projects' own files, which only `init` and
  `sync` write and record; `docs/ROADMAP.md` until pull request 909 lands, since both would change one entry.

## Constraints
- Zero dependencies, plain Node — because the commands run on any machine without an install step.
- Anything written outside this repository is recorded so it is undone exactly — the rule in `AGENTS.md`; a
  plugin install, a marketplace entry and a key in a clone's settings are such writes.
- The switch read where it cannot be read is off — because it is no check and it sends queries out, as
  `pushUnasked` and `remoteGate` are (`bin/lib/functions.mjs:12-15`).
- No default turns it on before T3's report — because S2 asks to know before adding.
- High-risk item 5 (delivery and environment): a plugin install, and a skill that runs `npx modern-web-guidance@latest`,
  unpinned, at each use.

## Ask me before
- Installing the plugin on his machine, a scratch home included (T2).
- The spend of the A/B batch, priced by `evals/plan.mjs` before it runs (T3).
- What the switch is where a project declares nothing: off until declared, or on where the project has interface files.
- Whether the harness turns the plugin's telemetry off by default, and its side effect if the host reads the same variable (T2).
- Whether this repository, which holds one interface file, declares it off.

## Depth pass
- 1. Method: configuration management of an optional third-party component. Its practitioner pins what is installed,
  records each write with its undo, measures the component against a baseline before a default, and adds a feature
  flag beside the existing ones. The smallest change that meets it is the twin of `languageServer` and its
  `typescript-lsp` row: one more entry in `SWITCHES`, one more row in `tools`, one more key in `SETTINGS_KEYS`; no
  new command and no new module (searched: codegraph for `planStack`, `RUNNABLE`, `functionsOf`, `SWITCHES`,
  `probeStack`, `SETTINGS_KEYS`).
- 2. Raw material: the plugin's README and marketplace manifest at
  https://github.com/GoogleChrome/modern-web-guidance (read 2026-11-17, L2);
  https://developer.chrome.com/blog/mwg-with-internal-component; `bin/lib/functions.mjs:16-24` and `:149-187`;
  `bin/lib/stack.mjs:343-362`; `bin/lib/stack-install.mjs:21-57` and `:175-180`; `bin/lib/project-apply.mjs:19-41`;
  `claude plugin install --help` and `codex plugin --help` on this machine; `evals/arms.mjs:5-13`; his words (L1).
- 3. The bar:
  spec 1: `node --test bin/lib/functions.test.mjs bin/lib/project-apply.test.mjs bin/lib/stack.test.mjs`: none, new behaviour
  spec 2: `ls evals/tasks`: 21 tasks, none with a web interface, so no A/B can run today
  spec 3: `js-harness contract check odd/tasks/web-guidance.md`: none, new behaviour
  spec 4: `node --test bin/lib/stack-install.test.mjs`: context7's rows hold `wanted: () => true` (`bin/lib/stack-install.mjs:47`); the test not run in this pass
- 4. Refutation: the request fails if a host cannot turn a plugin on for one project and off for the next, or if the
  rule that reads a project's files cannot tell his interface projects from this one. Run now:
  `claude plugin install --help` names `-s, --scope <scope>` with `user, project, or local`; and a count of interface
  files (`html`, `css`, `scss`, `astro`, `vue`, `svelte`, `jsx`, `tsx`) gives 39 and 6 under `src` in his two Astro
  projects and 1 in this repository (`git ls-files`: `docs/live-board.html`). So 2 of 2 interface projects resolve
  on, and this repository resolves on too by one file, which the rule or a declaration must answer (T1). The
  decisive test, an install on a scratch home, is his to allow and is T2.
  Verdict: supports
- 5. Request: give the harness a project switch for Modern Web Guidance, the twin of the one it has for the language
  server, so a project with a web interface can have the plugin shown, fixed and named to the agent, and a project
  without one never loads it; keep context7 required; measure its gain on one real interface task before any
  default turns it on; hand this plan, reviewed twice, to the lead to place in the queue.
  Adds: none

## Specs
- S1. "cuando se vaya a hacer un proyecto de desarrollo y codigo que va a ser casi la mayoria de las veces, la idea
  es que el harness pueda activarlo" (2026-11-17): a switch a project turns on, read by `init`, `sync`, `doctor` and
  `stack`.
- S2. "quiero saber mas antes de añadirlo" (2026-11-17): its gain is measured here, with and without it, before a
  default.
- S3. "listo quiero que crees como deberia funcionar todo y pasarle el plan al orquestardor JH ORQ para que el decida
  como ponerlo en toda la cola de implementaciones que estamos haciendo" (2026-11-17): this document, reviewed twice,
  handed to the lead, who places it.
- S4. "Modren web guidance de google nos ayudaria para este proyecto mejor que context7" (2026-11-17): answered no,
  it does another job; context7 stays required and nothing is replaced.

## Tasks
- [ ] T1 (kind: design) S1, S3: the design and its double review. Settled (L7): the row is optional, listed with its fix and never run by `stack install`, and `init` writes nothing outside the clone. Left for the review and his answers: `auto` by interface file or by declaration alone; Codex's side `n/a`, as both plugin rows give it. Route: this session. Commit: documents alone.
- [ ] T2 (kind: verify) S1: after his yes, on a scratch home: what `-s project` writes, whether `enabledPlugins` false in a clone's settings keeps the skill out, the fixed cost by `claude plugin details`, and whether the host itself reads `DISABLE_TELEMETRY`. Route: inline. Commit: the Log.
- [ ] T3 (kind: build) S2: one eval task with a web interface (fixture, reference, hidden checks) and its arm `current-without-plugin-modern-web-guidance`; priced, then run after his yes. Route: a writer. Commit: the task and its report.
- [ ] T4 (kind: build) S1: the switch `webGuidance` in `SWITCHES` (`auto`, `on`, `off`; strict `off`), its `auto` rule, and the custom preset's choice. Route: inline. Commit: with its tests.
- [ ] T5 (kind: build) S1, S4: the row in `tools`, shown while the switch is not off, with its install, enable and update fixes; `planStack` lists its gaps as optional. Route: inline. Commit: with its tests.
- [ ] T6 (kind: build) S1: `SETTINGS_KEYS` holds the plugin off in a clone whose switch is off, and the telemetry key as he decides. Route: inline. Commit: with its tests.
- [ ] T7 (kind: build) S1: `init` and `sync` write, where the switch is on, the line of the project's `AGENTS.md` that names the skill and says the project's own components win over it; recorded and undone. Route: inline. Commit: with its tests.
- [ ] T8 (kind: docs) S3: the capability in `docs/SPEC.md`, the user guide, and the roadmap entry closed. Route: inline. Commit: documents alone.

Order: T1, T2, T3 before T4 to T7, since T2 can change the design and T3 decides the default; T8 last. T4 to T7
touch four files of `bin/lib` that other features also change, so the lead places them where those files are free.

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
  picks native elements over an in-house component library unless `AGENTS.md` ranks them (T7).
- L3 (2026-11-17, evidence, this repository at `15f74d8d`): a switch is an entry of `SWITCHES` with `values`,
  `fallback` and `strict`; `auto` resolves by the project's files (`resolveFunctions`), the language server by
  `typeScriptFile`. A row is an entry of `tools` with `when`, `installed`, `configured`, `project` and `fix`; the
  `typescript-lsp` row reads `pluginInstalledVersion` and `claudeEnabledPlugin`, gives Codex `n/a`, and its fixes are
  `claude plugin install`, `enable` and `update`. `planStack` lists its gaps as `optional`, never run; the
  `engram-plugin` row is `manual`, his step. `SETTINGS_KEYS.languageServer` writes `enabledPlugins[<id>]` false into a
  clone's settings where the switch is off, and `paste` writes an `env` key. The language server touches seven
  modules of `bin` (21 lines, tests left out), the size this twin would have. Read from `--help` only, on this
  machine: `claude plugin install -s user|project|local`, `claude plugin details` (a component inventory and
  projected token cost), `uninstall`, `enable`, `disable`, `update`; `codex plugin add`, `remove`, `marketplace`.
  Not known: what `-s project` writes, whether a clone's `enabledPlugins` false keeps this plugin's skill out, and
  whether Codex can turn a plugin off for one project. `npx` and `pnpm` are both on this machine's PATH.
- L4 (2026-11-17, evidence, run once): its `legacy-scan` on `D:\abogadaclaudiajimenez` through `pnpm dlx` changed no
  file and found 5 items, 2 in his code and minor (`src/pages/blog/[...slug].astro:17`,
  `src/scripts/web3forms.ts:135`), over about 20% of the guides.
- L5 (2026-11-17, correction): this session told him the evals already had the pieces for the A/B. The arm family
  exists (`evals/arms.mjs:5-13`); no task with a web interface does, so T3 builds one.
- L6 (2026-11-17, this session's reading, not his words): the row is listed and not run, following the two plugin
  rows; the strict value is off; Codex's side is `n/a`; `auto` on by interface file would turn this repository on
  through `docs/live-board.html`, against the roadmap entry's "no gain in this repository". T1 settles each.
- L7 (2026-11-17, decision, within S1, read in `odd/tasks/stack-install.md` D1 to D3 and
  `odd/tasks/f8-s11-complements.md` L4, L6 and L9): the row is optional as D1 defines it ("only the session's quality
  depends on it") and optional tools are "shown with `doctor`'s fix, never run"; engram's plugin, the other plugin
  row, is his step for the same reason (L4). So `stack install` runs no plugin command and records none, and what the
  harness writes is inside the clone: the switch in `harness.json` and the keys of the clone's settings, as `init`
  "writes nothing outside the repository" (L6). The custom preset takes one more choice beside `--codegraph` and
  `--engram-plugin` (L9); the fixed presets declare nothing for it until T3's report.

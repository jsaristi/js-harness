# Modern Web Guidance as a switch a project turns on

Locator: `odd/tasks/web-guidance.md` · Engram mirror: `odd/web-guidance/tasks` · Branch:
`claude/jh300-web-guidance-t2`, in the worktree `D:\js-harness\.claude\worktrees\session-roles-v4-0bc4d1`, cut from
`origin/main` at `14f0b8cc` (the design's own branch, `docs/web-guidance-design`, was cut at `15f74d8d`) · Session:
`JH 300`, a work session that took this document over on 2026-11-22 from `Google web guidance para el proyecto`; the
lead is `JH ORQ · orquestador F8` · Runner: `node --test` · Delivery: ask-on-risk

## State
2026-11-22, JH 300: T2 is done on a scratch home, its findings in L11; nothing was installed in his real home and the
scratch home is deleted. What T2 changed in the design: the install the row names becomes `-s user` followed by
`disable -s user`, so the plugin is off on the machine and a clone turns it on with `enabledPlugins` in its own
`.claude/settings.local.json`; `-s project` is never named, since its committed key turns the plugin on in any clone on
a machine that holds an installation; T6 writes `true` where the switch is on and `false` elsewhere, not `false`
alone; Codex stays out of scope; the fixed cost is about 448 tokens, both skills. Before T2 (2026-11-18): the design
and its plan, three double reviews that did not converge (L8, L9, L10); the text of T3 to T7 is still provisional and
not yet corrected for L11. Next: the senior pass over T3 to T7 with L11 in hand, which the lead places. Open: his
decisions under "Ask me before", none asked yet, each through the lead; T3 needs his spend and his home decision.

## Goal
A project turns Modern Web Guidance on with one switch in `harness.json`, read by every command that reports or
configures it, never on unseen in a clone the harness has synced, with its gain measured on real interface tasks
before he decides where, if anywhere, it is on by default.

## Why
- He builds pages and applications (two Astro projects today) and wants the harness to bring the web platform's
  current practice to them, as it brings library documentation through context7.
- Its figures are its publisher's, none measured here (L2). A harness that turns on what it has not measured repeats
  the failure the evals exist for.
- It is a plugin of each host, it sends the agent's search queries to its publisher, and its skill runs an unpinned
  `npx` package: three reasons it is never on unseen.

## Done when
- `js-harness contract check odd/tasks/web-guidance.md` exits 0
- `npm run check` exits 0
- `node --test bin/lib/functions.test.mjs bin/lib/project-apply.test.mjs bin/lib/project.test.mjs bin/lib/project-functions.test.mjs bin/lib/stack.test.mjs bin/lib/stack-install.test.mjs bin/lib/latest.test.mjs bin/init.test.mjs bin/functions.test.mjs` exits 0, with a test for each new behaviour of T4 to T7, one that context7's Claude registration stays unconditional and its Codex one follows `codexReview`, one each that a missing `harness.json`, an unreadable tree and a switch that did not resolve leave it off, one that the row shows a gap where the switch is not on and the clone's effective state turns the plugin on, and one that this repository, T3's fixtures in it, resolves off
- T2's findings are in the Log, among them, on a scratch home: a session with the switch off whose loaded skills do not hold the plugin's, one with it on whose loaded skills do, and one in a second project never synced
- The report of T3's batch is in the Log beside the decision rule written before it ran
- His answers to "Ask me before" are in the Log with his words and where they are read

## In scope / Out of scope
- In: the switch and its `auto` rule (`bin/lib/functions.mjs`); the row, its cells and its fixes (`bin/lib/stack.mjs`,
  `bin/lib/stack-install.mjs`, `bin/lib/latest.mjs`); what `init` and `sync` hold in a clone's settings and how they
  report it (`bin/lib/project-apply.mjs`, `bin/lib/project.mjs`); the custom preset's choice, the switch's own
  command and the help (`bin/init.mjs`, `bin/functions.mjs`, `bin/js-harness.mjs`); `doctor`, which reads `tools`
  through `probeStack` and changes only if T5's cells ask it; two eval tasks with a web interface and their arms;
  the texts (`docs/SPEC.md`, the user guide, and the roadmap entry once pull request 909 has landed).
- Out: context7, which stays required in every preset (S4); the plugin's own guides, skill text and CLI, which the
  harness configures and never copies or rewrites; any text of this feature in a project's `AGENTS.md`: `sync`
  goes on refreshing the harness's own block there (`syncTemplateBlock`, `bin/lib/project.mjs:1839`) and what the
  project wrote stays as it is; Codex's side, until
  T2 shows Codex can keep a plugin out of one project: until then the harness names no Codex install of it, since
  one would be on in every project.

## Constraints
- Zero dependencies, plain Node — because the commands run on any machine without an install step.
- The plugin's install and its marketplace entry are his steps, named by the row with their undo and never run or
  recorded by `stack install` (L7); what the harness writes is inside the clone and recorded so it is undone exactly.
- What the harness can hold, it holds off: in a clone it has synced, a tree that cannot be read and a switch that
  did not resolve leave it off, always; a project that declares nothing leaves it off until T3's report and his
  answer on the default — because it is no check and it sends queries out, as `pushUnasked` and `remoteGate` are
  read (`bin/lib/functions.mjs:12-15`).
- What the harness cannot hold, it shows: a clone never synced, or a project without the harness, has what the
  machine's install gives it. So the install step the row names is the one T2 proves leaves the plugin off outside
  the project, and the row is a gap wherever the plugin is on and the switch is not.
- A positive report of T3 justifies a default only for the kinds of project its tasks stand for, and an
  inconclusive one or a regression keeps it off — because S2 asks to know before adding.
- High-risk item 5 (delivery and environment): a plugin install, and a skill that runs `npx modern-web-guidance@latest`,
  unpinned, at each use; the harness does not rewrite the plugin's skill, so in his projects it is his to accept.
- The plugin ships two skills, its own and `chrome-extensions` (about 205 and 175 tokens, its figures); the
  marketplace entry installs the whole repository, so both load unless T2 finds a supported way to load one.

## Ask me before
- Installing the plugin on a scratch home (T2), and, apart from it, in his real home, which the eval's home template
  copies and which then adds it to the current arm of every other eval (T3).
- The spend of T3's batch, priced by `evals/plan.mjs`, with its trials and its decision rule shown first.
- What the switch is where a project declares nothing, after T3: off until declared; on where the project's root
  holds a web framework's configuration; or on in every project with code. His words ask that the harness be able to
  turn it on in a development project, "casi la mayoria de las veces", in a harness that is "sobretodo para
  programar"; they do not say which of the three, and each is a reading of this session's until he answers. The
  guides cover only HTML, CSS and browser APIs, which is why the second is the one proposed.
- That L4's scan of his client project ran the publisher's package with its telemetry not known to be off.
- Whether the harness sets `DISABLE_TELEMETRY=1` in a clone that turns the plugin on: the host is assumed to read
  the same variable for its own telemetry, so the key would turn that off in the clone too (T2 cites it).
- Whether he accepts the unpinned `npx` package the plugin's skill runs, or the plugin waits for a pinned one.

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
  spec 3: `js-harness contract check odd/tasks/web-guidance.md`: PASS on this text, 2026-11-18, before its commit
  spec 4: `node --test bin/lib/stack-install.test.mjs`: context7's Claude row holds `wanted: () => true` and its Codex row `codexWanted` (`bin/lib/stack-install.mjs:47`, `:55`); the test not run in this pass
- 4. Refutation: the request fails if a host offers no way to hold a plugin for one project and not the next, or if
  no rule over a project's files tells his interface projects from this one. Run now:
  `claude plugin install --help` names `-s, --scope <scope>` with `user, project, or local`. A count of interface
  files (`html`, `css`, `scss`, `astro`, `vue`, `svelte`, `jsx`, `tsx`) refuted the first rule tried: 39 and 6 under
  `src` in his two Astro projects and 1 in this repository (`docs/live-board.html`), so that rule turns this
  repository on, and T3's fixtures would add dozens more. The rule that replaces it, a web framework's configuration
  at the project's root (`astro.config.*`, `next.config.*`, `vite.config.*`, `nuxt.config.*`, `svelte.config.*`,
  `remix.config.*`), holds on the same three: 2 of 2 of his projects have one (`astro.config.mjs`, `astro.config.ts`)
  and this repository has 0 (`git ls-files` of those names, at any depth, prints nothing); a fixture's configuration
  sits below the root and does not count. A page of plain HTML has none and is declared on by hand. This shows the
  scope exists and a rule separates; it does not show that the host keeps the skill out of a project, which only an
  install shows: that is T2, his to allow, and it is in "Done when". A refuting T2 goes to him before T4.
  Verdict: supports
- 5. Request: give the harness a project switch for Modern Web Guidance that is off unless a project turns it on,
  reusing the switch, row and settings key the language server has; keep context7 required; measure its gain on real
  interface tasks, with a rule written first, before any default; ask him where it is on by default, which his
  words leave open; hand this plan, reviewed, to the lead to place in the queue.
  Adds: none

## Specs
- S1. "cuando se vaya a hacer un proyecto de desarrollo y codigo que va a ser casi la mayoria de las veces, la idea
  es que el harness pueda activarlo" (2026-11-17): a switch a project turns on, read by `init`, `sync`, `doctor` and
  `stack`.
- S2. "quiero saber mas antes de añadirlo, por ejemplo si hacemos una pagina en Astro o una aplicacion en NextJS que
  tanto serviria?" (2026-11-17): its gain is measured here, on an Astro task and a Next.js task, before a default.
- S3. "listo quiero que crees como deberia funcionar todo y pasarle el plan al orquestardor JH ORQ para que el decida
  como ponerlo en toda la cola de implementaciones que estamos haciendo" (2026-11-17): this document, reviewed and
  with its reviews' state said, handed to the lead, who places it.
- S4. "Modren web guidance de google nos ayudaria para este proyecto mejor que context7 osea recuerda que este es un
  harness para varias cosas pero sobretodo para programar" (2026-11-17): answered no, it does another job; context7
  stays required and nothing is replaced.

## Tasks
- [ ] T1 (kind: design) S1, S3: the design and its double reviews (L7 to L10); not converged, so its close is the senior pass after T2. Route: this session, then the senior session. Commit: documents alone.
- [x] T2 (kind: verify) S1: after his yes, on a scratch home, for Claude Code: what each of `-s user`, `project` and `local` writes; which of them, or which settings key, keeps the skill out of a project that has not turned it on and loads it in one that has, read from the session's loaded skills; every skill the install loads and the fixed cost by `claude plugin details`; a second project never touched and a clone never synced, after the install; a plugin already installed for the whole machine, and off after on with that state inherited; each scope's install run before `js-harness sync`, then the switch turned off, with what each step reports and undoes, since a `local` install may write the file the harness manages (`bin/lib/project-apply.mjs:10-12`); a conflicting value he wrote himself. For Codex: whether a plugin can be held out of one project. From the host's settings documentation, no install needed: whether it reads `DISABLE_TELEMETRY`. Route: inline. Commit: the Log. Done 2026-11-22 by JH 300, evidence in L11.
- [ ] T3 (kind: build) S2: two eval tasks with a web interface, one Astro and one Next.js (fixture, reference, hidden checks of function, of the browser and of accessibility), and three arms: without the plugin, with it, and with it named in the project's `AGENTS.md`. Written in the Log before pricing: the trials per arm, the least gain that justifies a default, the cost limit, that an inconclusive result or a regression keeps the default off, and that a gain speaks only for Astro pages and Next.js applications. The skill's text stays as shipped, so one version of the `npx` package is held by what T3's first step proves works without touching it: that version fetched into the trial's package cache and run offline, or a resolver in the trial's PATH that serves it; the version each call ran is checked and a drift fails the trial. Each trial sets `DISABLE_TELEMETRY=1` and records the versions of the plugin, the CLI and the host. The plugin arm's home comes from a template of its own, or from an install in his real home with its undo recorded, as he decides. Route: a writer. Commit: the tasks, then their report.
- [ ] T4 (kind: build) S1: the switch `webGuidance` in `SWITCHES` (`auto`, `on`, `off`; strict `off`); `auto` is off over a tree that cannot be read, off until he answers, and then as he answers, the rule proposed being a web framework's configuration at the project's root; the custom preset's choice (`bin/init.mjs`), the fixed presets declaring nothing; the switch's own command and its test, which lists every switch (`bin/functions.mjs`, `bin/functions.test.mjs:254`). Route: inline. Commit: with its tests.
- [ ] T5 (kind: build) S1, S4: the row in `tools`, shown while the switch is on and also wherever the plugin is on for this clone with the switch not on, where it is a gap whose fix turns it off. Its `installed` cell reads the installation that serves this project, not the first on the machine; its `claude` cell reads the clone's effective state, not the user file alone; its `project` cell is a gap where the project's `AGENTS.md` does not name the skill, and its fix prints the lines to add: that the skill is used for interface work and that the project's own components win over it. Fixes: `claude plugin marketplace add GoogleChrome/modern-web-guidance` then `claude plugin install modern-web-guidance@googlechrome` with the scope T2 proves leaves it off outside the project, and no fix is named before T2; the undo is the uninstall of that scope and `claude plugin marketplace remove googlechrome`. `planStack` keeps its machine gaps in `optional`, as L7 classes the row, and `optional` gains an `undo` field, since `manual` would make `js-harness stack` exit 1 over an optional plugin (`bin/stack.mjs:117-120`, `:173`); the undo removes only what this step added, the marketplace only where no other installation uses it. Its `upToDate` cell and update fix are named as the other plugin rows' are (`bin/lib/latest.mjs`). Tested: two projects with different states, that the plan carries the undo, and that `stack` exits 0 with this row's gap alone. Route: inline. Commit: with its tests.
- [ ] T6 (kind: build) S1: `SETTINGS_KEYS` and `SWITCH_OF_KEY` hold the plugin on in a clone whose switch is on and, by an explicit false, off in every other synced clone, by the keys T2 shows; where T2 shows a clone's key does not override the machine's, the Constraint's "holds" becomes "shows"; a switch on with no plugin installed writes no key and is reported; a value of his that conflicts, or a key an install wrote before `sync`, is kept and reported as not applied here, never as done; the telemetry key as he decides. Route: inline. Commit: with its tests.
- [ ] T7 (kind: build) S1: the help and the usage lines (`bin/js-harness.mjs`, `bin/init.mjs`), and a test that this feature adds no text to a project's `AGENTS.md`: one with no block of the harness's keeps every byte, and one with the block keeps what the project wrote. Route: inline. Commit: with its tests.
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
  `src/scripts/web3forms.ts:135`), over about 20% of the guides. Not known: whether `DISABLE_TELEMETRY=1` was set
  and which version ran; a search of this session's transcript for `dlx` beside the package's name finds no such
  command line, so the run is taken as made with telemetry on, which by L2 sends counts, the agent's name, guide ids
  and search queries, not file contents.
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
  codex 1); the row reads the installation and the state that serve this project (the same codex 1, its second
  half); Codex is out of scope
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
- L9 (2026-11-18, evidence and decisions, double review `a713a3e9-6687-4355-951e-937bab5b639b` on commit `746e38b6`,
  11 findings of the Claude reader and 4 of Codex's; all 15 taken). What they changed: the promise of "off
  everywhere" is cut to what the harness can hold, the install's scope waits for T2, and the row is a gap where the
  plugin is on and the switch is not (claude 1, codex 1); the eval holds one version without touching the skill, by
  a mechanism its first step proves (claude 2, codex 3); the refutation says the count of interface files failed and
  gives the rule that replaced it, a framework's configuration at the root, 2 of 2 and 0 (claude 3); the Goal and
  the Constraint no longer settle the default, and his words are quoted whole and read as leaving it open, where the
  two readers read them opposite ways (claude 4, codex 4); the switch's own command and its test are in scope, nine
  modules (claude 5); the plan's class is `manual`, which carries the undo (claude 6); T2 runs each install before
  `sync` (claude 7); a gain speaks for the kinds of project tested (claude 8); L4 says what is not known of the scan
  (claude 9); spec 3 is dated on this text (claude 10); the citation and the on side of T2 (claude 11); the plugin
  ships `chrome-extensions` too, which the first text called out of scope (codex 2).
- L10 (2026-11-18, evidence, the third and last double review, `823f0dfa-886a-4bbe-b19f-abcb2bd3072c` on commit
  `8831fab9`: 11 findings of the Claude reader and 5 of Codex's, all 16 real and taken as true). Corrected in this
  text, not reviewed since: T6 holds the plugin off by an explicit false and says when "holds" becomes "shows"
  (claude 1, codex 1); the row stays `optional` with an `undo`, since `manual` makes `stack` exit 1 (claude 2); the
  undo removes only what the step added (codex 2); the `upToDate` cell (claude 8); a switch on with nothing installed
  (claude 6); `sync` does write the harness's own block of an existing `AGENTS.md`, which the second text denied
  (codex 4); T1's citation and S3's wording (claude 10). Owed to the senior pass, after T2: T3 as written can
  support a default only for Astro and Next.js, so "on in every project with code" would rest on his decision and
  not on a measurement, and the test that this repository resolves off depends on his answer (claude 3); T3 cannot
  be built from what the evals have: the arm grammar takes neither a third arm nor a plugin installed below user
  scope, nothing runs a browser or an accessibility check with zero dependencies, and the fixtures need their
  packages offline (claude 4); `evals/plan.mjs` prints no estimate for cells never run, so pricing needs a capped
  calibration batch or his yes to a stated ceiling (codex 5); the shipped skill prefers `pnpx` where pnpm exists, so
  holding one version must cover that route and the Windows shims (codex 3), and a default would rest on the
  version measured (claude 11); the row's Codex cell reads nothing, so a Codex install is on unseen (claude 5); the
  root-configuration rule was fitted to three trees and misses a monorepo, Angular, Gatsby and others (claude 9);
  no `doctor` test nor eval test is in "Done when", nor a line for the hand to the lead (claude 7, claude 10).
  Why three reviews did not close it, this session's reading: each round judged a design of host behaviour that only
  T2's install can show, so the design of T3 to T7 is written after T2, not before.
- L11 (2026-11-22, his yes and T2's evidence, JH 300). His words: "haz la prueba de Modern Web Guidance" (transcript
  `0cdab702-72bd-48e7-8a8e-0c38d4aca9c9`, line 13918, 2026-11-23T00:18:00Z, by `js-harness sessions --quote`). What
  he had in front of him, read by the lead: a yes covers an install on a scratch home, never his real home (T3), any
  spend, or where it is on. How it ran: a scratch home in the session's scratchpad, every call under
  `sandboxEnv` of `evals/configs.mjs` (HOME, USERPROFILE, CLAUDE_CONFIG_DIR and the rest pointed at it, no token
  passed, `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_API_KEY` removed), from scratch projects inside it, Claude Code
  2.1.330. The probe came back empty: `claude plugin list` "No plugins installed", the marketplaces only the built-in
  directory, so his plugins were not seen. Fetched: only `claude plugin marketplace add GoogleChrome/modern-web-guidance`,
  commit `64a6d708f5a43f2cd3fde5d4d7db3905ba1bdf65` ("Release v1.0.1", 2026-11-16), 3.8M with its `.git`, 2.9M
  without; the scratch home was 9.8M at the end. No skill of the plugin and no `npx` ran. Loaded skills were read from
  the `init` event of `claude -p --output-format stream-json`, started with a dummy key and `ANTHROPIC_BASE_URL` at
  `127.0.0.1:9`, where nothing listens: no model was reached, every result was an error with `total_cost_usd` 0. The
  method's control: the project with the plugin enabled showed `modern-web-guidance:chrome-extensions` and
  `modern-web-guidance:modern-web-guidance`; an absence below is read against that.
  - What each scope writes. `marketplace add`: `extraKnownMarketplaces.googlechrome` in the user `settings.json` and
    `known_marketplaces.json`, whatever scope follows. `-s project`: `enabledPlugins[id]: true` in the project's
    tracked `.claude/settings.json`, and an `installed_plugins.json` entry with `scope: project` and that folder's
    `projectPath`. `-s local`: the same key in `.claude/settings.local.json`, the file the harness manages
    (`SETTINGS_FILE`, `bin/lib/project-apply.mjs:12`), an entry with `scope: local`, and the line
    `**/.claude/settings.local.json` in the home's `~/.config/git/ignore`, a write outside the project. `-s user`: the
    key in the user `settings.json` and an entry with no `projectPath`. The cache is one copy per version,
    `plugins/cache/googlechrome/modern-web-guidance/1.0.1`.
  - Where it loads. `project` and `local`: in their own project and in no other (a folder never touched, with or
    without git: no skill). A local `git clone` of the `project` one, its committed key `true`: no skill while that
    folder's install was the only one on the machine, yet `claude plugin list` there said "enabled"; once a `user`
    installation existed, even disabled, the clone loaded both skills and the host wrote an `installed_plugins.json`
    entry for the clone by itself, as it did for a folder holding only a local `true`. So a committed key turns the
    plugin on in every clone on a machine with any installation of it, unseen: the harness never names `-s project`.
    `user`: in every project, the untouched folder among them.
  - What holds it off and on, per clone. Under a `user` install enabled: `enabledPlugins[id]: false` in the project's
    `.claude/settings.json` or in its `.claude/settings.local.json` loads no skill. A local `false` beats a committed
    `true` of a `project` install. A local `true` beats a project `false` (his conflicting value: the nearer file wins).
    Off after on: `plugin disable -s project` wrote `false` into the tracked `.claude/settings.json`, and `disable -s
    user` the user file's key to `false`; after the latter, folders with no key load nothing while a folder whose own
    file says `true` still loads it. That is the mechanism T6 needs: the machine's install off at user scope, and the
    clone's `.claude/settings.local.json` `true` where the switch is on and `false` elsewhere, the `false` guarding a
    later `enable -s user`.
  - Before `sync`, then off. `js-harness init` (0.97.0, the installed one) in the `local` project kept the plugin's
    `true` beside its own keys and reported only its own; `sync` then printed "up to date"; `plugin uninstall -s
    local` removed the plugin's key alone and kept the harness's four (`outputStyle`, `permissions.deny`, `env`,
    `typescript-lsp`). A `project` install before `init`: the harness never touches the tracked file, so only the
    clone's local `false` holds it off, which was checked. The `webGuidance` switch does not exist yet: its `off` was
    simulated by writing the key by hand, not run.
  - Cost: `claude plugin details` lists 2 skills (`chrome-extensions`, `modern-web-guidance`), no agents, hooks, MCP
    servers or language servers; always-on about 448 tokens, about 220 each, where L2 has the publisher's 205 and 175;
    on invoke about 6.5k and 2.2k. Both load; no supported way to load one alone was found (not searched beyond
    `details` and the install's help).
  - Codex (0.171.0), from `codex plugin --help` and `add --help` only, no install: no scope option; a plugin's state is
    a `[plugins."<id>"]` table with `enabled` in `~/.codex/config.toml`, and `-c` overrides it per invocation. Whether
    a project's own `.codex/config.toml` can hold one out is not known; only an install shows it, outside this yes. The
    plugin ships `.codex-plugin/plugin.json` with `"skills": "./skills/"`, so a Codex install loads both skills too.
    Codex stays out of scope.
  - `DISABLE_TELEMETRY`, from https://code.claude.com/docs/en/env-vars, read through a fetch whose row came from a
    summary of the page, not verbatim: listed, any non-empty value opts out of Claude Code's telemetry, `0` included.
    It is not on the list of telemetry variables ignored in a project's `env`
    (https://code.claude.com/docs/en/settings-reference#variables-claude-code-ignores-in-env, also from a summary), so
    a clone's `.claude/settings.local.json` `env` would set it, and it would turn the host's own telemetry off in that
    clone. Not checked: that the plugin's `npx` child, run through the Bash tool, inherits it.
  - His real home, the same narrow search before and after (`grep` for `modern-web-guidance|googlechrome` in
    `.claude/settings.json`, `.claude.json`, `.codex/config.toml`, the two plugin state files and, recursively,
    `.claude/plugins` and `.codex` without sessions and logs): no hit in a settings or state file either time; the same
    six catalog and readme files both times (the official marketplace's `marketplace.json`,
    `plugin-directory-cache-v2.json`, engram's README in both hosts, two Codex catalog caches), which list the plugin
    without installing it; no `googlechrome` folder under `plugins/cache` or `plugins/marketplaces`. His
    `~/.config/git/ignore` already held the line, dated 2026-05-23, unchanged. Undo: the scratch home was deleted at
    the end; nothing else was written outside this repository.
  - What it changes in T3 to T7, for the senior pass: T5's fix is `-s user` then `disable -s user`, with its undo the
    user uninstall and the marketplace removal; T5's `claude` cell reads the clone's effective state, since `plugin
    list` reports "enabled" where nothing loads and one row per installation; T6 writes `true` and `false` in the
    clone's local file, and a value of his there is kept and reported; the Constraint's "holds" stands for a synced
    clone and "shows" for a clone with a committed `true`; Codex, out; the cost line in Constraints reads about 448
    tokens.

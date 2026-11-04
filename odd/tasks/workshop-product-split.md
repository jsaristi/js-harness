# JH 142 · the workshop and the product: one repository, two harnesses

Locator: `odd/tasks/workshop-product-split.md` · Engram mirror: `odd/workshop-product-split/tasks` · Branch:
`docs/workshop-product-split` (worktree `D:/js-harness-worktrees/workshop-product-split`) · Delivery: one docs pull
request with this document now; the build, if he confirms it, in reviewable slices after it; never merged by this
session · Test runner: `node --test`

## Goal
Before any of it is built, he gets a measured, reviewed answer to what the split between the workshop (what only
builds, releases and maintains js-harness, run by him from `D:\js-harness`) and the product (what a user's project
installs to develop software) would take out of every install. The answer says what a fresh project and home load
before and after, the shape of the split with its cost and undo, and how he sets up the workshop on another
machine.

## Why
He asked (L1) whether maintaining the harness is making the harness users install more complex. He confirmed the
direction (L3, L4): only the product installs, other projects' `CLAUDE.md` carries nothing of the workshop, and he
alone uses the workshop to modify, release, update and fix it, "para que nuestro arnes como producto quede liviano y
solo y especialmente para como arnes de desarrollo". He asked how he would set up the workshop on another computer
(L5). The day's failures came mostly from maintenance machinery: the merge queue swallowed git's push error
(`bin/merge-queue.mjs:549`), the depth-pass contract control left pull requests 764 and 767 out of their batches,
and the Stop hook keeps demanding live-board updates.

## Done when
- `js-harness contract check odd/tasks/workshop-product-split.md` exits 0
- `js-harness double-review tally --since 2026-11-04` lists a Claude read and a Codex read of this document
- the question of item 4 is recorded with `js-harness notify --to orchestrator --kind question` and its number is
  in `## Log`
- a docs pull request to main holds this document, named in `## Log`, not merged

## In scope / Out of scope
- In: this document; a scratch project and home under the session's scratchpad, made with the installed
  `js-harness init` and `install` 0.97.0; read-only reading of `bin/`, `scripts/`, `package.json`, his other two
  projects' transcripts and channel records.
- Out, until his answer to item 4's question: any source change or move. Out entirely: his `~/.claude`,
  `~/.codex`, credentials; the product's own diet (what the product carries that is his personal process rather
  than the workshop, such as Spanish replies and the five reply states), which is F8's measured cuts S4a to S7.

## Constraints
- The split changes what every install ships (Task Size high-risk 3, a contract others consume) and how it is
  delivered (high-risk 5), so each build slice gets Codex, the Claude lenses and an independent verifier; applying
  it to his machine and merging stay his.
- Every figure is measured in the scratch project and home or read from code, never assumed; an estimate says so.
- Scratch state lives in the session's scratchpad, outside the worktree.

## Ask me before
One decision, after the double review: item 4's verdict refutes part of the request, so whether to build the split
as an isolation step (and leave the weight to F8's cuts), build it as first asked, or drop it.

## Depth pass
- 1. Method: release and packaging engineering of a tool built with itself (a compiler that compiles itself, a
  linter that lints its own repository). Its practitioners keep the toolchain that maintains the tool in the
  repository, run from a checkout. The shipped product is cut by an explicit manifest (`package.json` `files`). A
  dependency rule checked by a test keeps product code from importing workshop code, and a test of the packed list
  proves what ships. The standard: the product never imports the workshop, the pack never holds it, and the
  workshop is one clone and one documented step away on any machine. The smallest change that meets it: one
  `workshop/` folder with its own dispatcher, no new repository, no new package, and the seams cut by the injection
  the code already uses (`loop.mjs:586-590`, `doctor.mjs:395`). Search of `rule:reuse-first`: `scripts/` and
  `evals/` already live outside `files` and never ship; `scripts/package-contents.test.mjs` already proves the pack
  holds only `bin/` (his answer to question 24, "Solo los comandos"); `harness.json` `documentSensors` already runs
  this repository's own checks as commands (`rules check`); `isHarnessRepository` (`bin/lib/spec.mjs:152`) already
  marks code that runs only here. No existing notion of product and workshop was found: `js-harness rules` has no
  rule on it, and `harness.json` "functions" and the presets switch the product's own parts on and off.
- 2. Raw material:
  - His words: the lead's transcript `0f71b2c6-cbce-43ca-a031-276a4b2c381f`, lines 64927, 65277, 65317 and 65412,
    read with `js-harness sessions --quote` (L1, L3, L4, L5).
  - `package.json` `files`: `bin/`, minus `*.test.mjs` and `*.testkit.mjs`, plus `THIRD_PARTY_NOTICES.md`: 270
    files, 4,610,788 bytes of `.mjs` ship.
  - `bin/js-harness.mjs`: 54 commands in `COMMANDS`. `bin/lib/hook-entries.mjs:8-219`: the hook entries `install`
    registers. `bin/lib/project-hooks.mjs:5-37`: the git hooks `init` writes.
  - The scratch run, 2026-11-04, installed 0.97.0. `js-harness install --home <scratch>/home` wrote 6 files (the 5
    skills and the output style), 15 hook entries in `.claude/settings.json`, the permissions and the Rules block
    of `.claude/CLAUDE.md`. `js-harness init --home <scratch>/home` in a git repository with one empty commit wrote
    `harness.json`, `AGENTS.md`, `CLAUDE.md`, `docs/FAILURES.md`, `.git/hooks/pre-commit`, `.git/hooks/commit-msg`
    and four keys of `.claude/settings.local.json`. It skipped codegraph, since the project holds no program.
  - The hooks run there with the scratch home and a hook input on standard input: `rules --hook`
    (UserPromptSubmit, SubagentStart) printed 0 characters; `doctor --hook` printed a 71-character
    `systemMessage`; `backup --session-start` printed 0. `js-harness check` there gave 10 rows, 6 INFO, in 2.06 s.
  - The import graph of `bin/`, static and literal dynamic imports, read by a scratch script
    (`<scratchpad>/tools/closure.mjs` and `cut.mjs`, not in the repository). Every module of the seven workshop
    commands is reached from product commands today, through the nine seams of table B.
  - His other two projects: `D:\abogadaclaudiajimenez` (13 transcripts) and `D:\plataforma-preproyecto`. Their
    transcripts name `onboard`, `notify`, `init`, `reply`, `sessions`, `doctor`, `check`, `stretch`, `report`,
    `functions`, `summary`, `rules`, `memory`, `failures`, `backup`, `guard`, `resume`, `clean`, `sync`, `stack`,
    `install` and `uninstall`. Their channel records (`~/.js-harness/channel/D--plataforma-preproyecto.jsonl`, 10
    notices) hold sessions opened by `sessions start` and questions asked and answered through the orchestrator,
    so the orchestration ships to a project he uses.
  - Branches of product code that run only in this repository: `bin/docs.mjs:174`, `bin/check.mjs:207`,
    `bin/rules.mjs:534` and `:546`, `bin/lib/codex-review-allowance.mjs:33`, `bin/lib/rules-change-run.mjs:20`,
    `bin/lib/rules-reach.mjs:16`, `bin/merge-queue.mjs:423`, `bin/update.mjs:127`.
- 3. The bar:
  spec 1: `js-harness install --home <scratch>/home`: with `init --home` in the scratch project, tables A to D below; 54 commands, 15 hook entries, 2 git hooks, 6 files, 6 texts and 76 rules classified; 7 commands workshop, 6 both, 41 product; every hook, git hook, skill and written text product.
  spec 2: `js-harness check --verbose`: in the scratch project, with the measures of table E; before, 2,624 fixed tokens a turn, 15 hook entries, 5 skills (17,843 tokens of bodies), 270 files and 4,610,788 bytes shipped; after the split, estimated, about 2,618 fixed tokens, 15 hook entries, 5 skills (about 17,200 tokens), 251 files and about 4,337,724 bytes.
  spec 3: `node --test bin/conventions-workshop.test.mjs scripts/package-contents.test.mjs`: none, new behaviour (the convention test does not exist; the pack test passes today with all of `bin/`).
  spec 4: left out because its proof is S13's rehearsal (`scripts/rehearsal.mjs`) with the workshop's row added, and the open from-zero rehearsal of "Memory that survives the machine" (`docs/ROADMAP.md:265`), which is not run here.
  spec 5: `js-harness double-review tally --since 2026-11-04`: none, new behaviour.
  spec 6: left out because it is a feature of its own after the split (section "The install path"): today a fresh home on this machine takes 7 typed steps before the first plan (`pnpm add -g`, `install`, `doctor`, `stack install` with 1 y/N, engram's own `engram setup claude-code`, `init`, `onboard` in a session) plus the logins, measured with `js-harness stack` in the scratch home.
- 4. Refutation: the cheapest test of "maintaining the harness makes the user's harness heavier" is to count what a
  fresh project and home load that only the workshop needs. Run now in the scratch project and home: 0 of 15 hook
  entries, 0 of 2 git hooks, 0 of 6 installed files, 0 of the 2,624 fixed tokens a turn but the 6 tokens of the
  protocols skill's listing that name "reviewing throughput", and about 630 of the 17,843 tokens of skill bodies,
  loaded only on demand (protocols section 7, 532 tokens, and two lines). The weight a user carries is the product
  itself, not the workshop. What the workshop does add is risk: 17 files and 246,622 bytes ship (5.3 %), and 9 seams
  import them into product commands. `bin/check.mjs:14` and `:42` import `docs.mjs` and `subagents.mjs`
  statically, so a broken workshop module breaks every user's pre-commit gate. On top of that, 9 branches of product
  code run only in this repository. So the split holds for "solo", a product that is only for developing a project
  and cannot be broken by the workshop. It does not hold for "liviano": it takes about 0.2 % of the fixed context,
  no hook and 5.3 % of the shipped code.
  Verdict: refutes
  The part refuted is the lightness he expects from it; the isolation holds. It reaches him as one question
  through the orchestrator before any code: answered: question pending (its number is written here when the
  orchestrator records it).
- 5. Request: build the split as an isolation step. The seven workshop commands and their ten modules move to a
  `workshop/` folder with its own dispatcher, run from the checkout. The nine seams are cut, so product code never
  imports workshop code, and a convention test holds that. The pack test proves no workshop file ships. Protocols
  section 7 and the workshop's lines move out of the shipped skills into a skill of this repository's own
  `.claude/skills/`. One documented step sets up the workshop on a fresh machine. The lightness he asked for is
  measured and cut in F8's S4a to S7 against what his two other projects use, not in this split.
  Adds: none

## Classification
Evidence columns: S, how many times the shipped texts (the 5 skills, the output style, the Rules block, and the
`CLAUDE.md` and `AGENTS.md` that `init` writes) name `js-harness <command>`; W, what `install` or `init` wires; U,
use in his other two projects' transcripts; C, the caller in product code that makes it a seam.

### A. Commands (54)
| Command | Class | Evidence |
|---|---|---|
| `audit` | workshop | S 0, W none; counts the checkable claims of this repository's session transcripts; its helpers in `bin/lib/audit.mjs` are imported by `bin/guard.mjs:214`, `bin/lib/manifest.mjs:16`, `bin/lib/measures.mjs:9` (seam) |
| `docs` | workshop | S 0, W none; its row returns nothing outside this repository (`bin/docs.mjs:174`); imported by `bin/check.mjs:14` (seam) |
| `host-watch` | workshop | S 0, W none; F8's S9 review of Claude Desktop updates for the harness; called by the heartbeat (`bin/loop.mjs:590`) and imported by `bin/lib/host-update.mjs:9` (seams) |
| `idea-watch` | workshop | S 0, W none; the record of upstream releases the harness was built from; `bin/doctor.mjs:33` and `:395` (seams) |
| `subagents` | workshop | S 0, W none; a day's sub-agents of this repository counted by role and model; `bin/check.mjs:42` imports its record readers for the sub-agent row (seam) |
| `throughput` | workshop | S 3, all in protocols section 7; the heartbeat's tick (`bin/loop.mjs:588`); `bin/stretch.mjs:32-33` and `bin/lib/stretch.mjs:13` import its helpers (seams) |
| `windows-daily` | workshop | S 0, W none; reads this repository's `.github/workflows/windows-daily.yml` run; the heartbeat (`bin/loop.mjs:586`, seam) |
| `codex-meter` | both | S 0; the orchestrator reads Codex's limits before a review; not seen in his projects |
| `loop` | both | S 10; its `heartbeat` body carries the three workshop ticks (`bin/loop.mjs:586-590`) |
| `merge-queue` | both | S 2 (the orchestrator lands with `--land`); `--refresh-copy` refreshes the installed copy from this repository (`bin/lib/refresh-copy.mjs`, 21,692 bytes, and three `merge-queue-refresh*` modules), which is the workshop; not seen in his projects |
| `rules` | both | W `rules --hook` on UserPromptSubmit, SessionStart and SubagentStart; S 13; `rules change` and `rules coverage` act only on this repository's `bin/lib/rules-data.mjs` (`bin/rules.mjs:539`; 89 KB with `rules-coverage*`) |
| `status` | both | S 1; inside a project its pin, outside it the machine's copy; this repository's checkout is told apart (`bin/update.mjs:127`) |
| `update` | both | S 1; finds copies that are a checkout of this repository (`bin/update.mjs:127`) |
| `init`, `onboard`, `install`, `sync`, `migrate`, `uninstall`, `upgrade`, `stack`, `doctor`, `functions` | product | the lifecycle of a project and a machine; W `doctor --hook` on SessionStart; U `init`, `onboard` (105 in plataforma-preproyecto), `install`, `sync`, `uninstall`, `stack`, `doctor`, `functions` |
| `check`, `gate`, `commit-msg`, `contract`, `codex-review`, `lens-review`, `double-review`, `failures` | product | W the pre-commit hook `exec js-harness check` and the commit-msg hook (`bin/lib/project-hooks.mjs:5`, `:25`); the pre-push hook where the Codex review is on (`:10`); `init` writes `docs/FAILURES.md`; S 2, 4, 0, 0, 4, 3, 1, 1; U `check`, `failures` |
| `guard`, `reply`, `resume`, `permit`, `template`, `backup` | product | W the hook entries of table C; U `reply`, `guard`, `resume`, `backup` |
| `sessions`, `notify`, `wait`, `wake`, `quiet`, `report`, `stretch`, `summary`, `progress`, `remote`, `unseen`, `status-line`, `memory`, `fetch`, `clean` | product | the orchestration and the session's tools; S 17, 11, 5, 1, 1, 6, 9, 1, 4, 0, 0, 0, 4, 0, 0; U `notify` (40 and 36), `sessions`, `stretch`, `report`, `summary`, `memory`, `clean`; `fetch` is the rung the pause hook names after a refused WebFetch (`bin/lib/hook-entries.mjs:50`); `unseen` is a row of `doctor` |

### B. The nine seams (product code that imports workshop code today)
`bin/check.mjs:14` (`checkDocs`), `bin/check.mjs:42` (`readRecords`, `recordFolders`), `bin/doctor.mjs:33` and
`:395` (`ideaFix`, `ideaWatchHealth`), `bin/loop.mjs:586`, `:588` and `:590` (the three ticks), `bin/stretch.mjs:32-33` with `bin/lib/stretch.mjs:13`
(throughput's land and gate readers), `bin/guard.mjs:214` with `bin/lib/manifest.mjs:16` and `bin/lib/measures.mjs:9` (the share
tolerance and window of `bin/lib/audit.mjs`), `bin/lib/host-update.mjs:9` (`handListCount`).

### C. Hooks and git hooks
| Entry | Class | Evidence |
|---|---|---|
| SessionStart `doctor --hook`, `resume --hook`, `rules --hook`, `backup --session-start` | product | stack gaps, resume after a compaction, rules retold, the memory fallback; in the scratch project 71, 0, 0 characters of output (resume refused the hand-written input) |
| UserPromptSubmit and SubagentStart `rules --hook` | product | 0 characters in the scratch project, which declares no rules |
| PreToolUse `guard --hook`, `template gate --hook` | product | sub-agent models, messages, secrets; the template gate |
| PostToolUse `resume --pause`, `template gate --shown`; PostToolUseFailure `resume --pause` on WebFetch | product | the context pause and the fetch ladder |
| PermissionRequest `permit --hook` | product | the relay to the orchestrator, used where sessions run under a lead |
| Stop `guard --stop`, `reply --hook`, `backup --hook` | product | the share check, the reply check, the backup; the stale-board demand inside `reply --hook` applies only to the lead of a project with a live board (`bin/reply.mjs:17`) |
| git pre-commit, commit-msg (pre-push where the Codex review is on) | product | `bin/lib/project-hooks.mjs` |

### D. Skills, texts and rules
- Skills: `js-harness` (2,953 tokens), `js-harness-work-units` (586) and `js-harness-chained-prs` (660) are product.
  `js-harness-orchestrator` (8,559) is product, used by his projects, apart from its line on
  `merge-queue --land --refresh-copy` (line 46), which is workshop. `js-harness-protocols` (5,085) is product apart
  from section 7, "Reviewing throughput" (532 tokens), and the sentence of section 4 that starts "In the harness's
  own checkout", which are workshop.
- The output style (242 tokens) and the Rules block (1,333) are product: neither names js-harness's own
  maintenance. The `CLAUDE.md` block (419) and the `AGENTS.md` block (312) that `init` writes are product too:
  they name the depth pass, the owner's decisions, the context pause, the double review, the report pages and the
  five reply states, all product processes. Also product: `harness.json`, `docs/FAILURES.md` and the four keys of
  `.claude/settings.local.json`.
- Rules (76 declared in `bin/lib/rules-data.mjs`, 34,504 bytes, which ships because `rules <id>` resolves the ids
  every shipped text names): 4 are workshop by subject, `throughput-quiet-days`, `throughput-quiet-runs`,
  `throughput-backfill-days` and `throughput-compare-days`; the other 72 are product or his process. A search of
  `rule:<id>` and the quoted id across shipped texts and `bin/` named 22 in shipped texts and 34 in code, and left
  20, such as `reply-five-states`, that the hooks enforce without naming them, so that search alone does not
  separate the two and was not used to classify.

### E. Measures, before and after
| Measure | Today (measured) | After the split (estimated) |
|---|---|---|
| Fixed tokens a turn (`estimateTokens`, `bin/lib/payload.mjs:10`) | 2,624: Rules block 1,333, `CLAUDE.md` 419, `AGENTS.md` 312, output style 242, 5 skill listings 318 | about 2,618 |
| Hook entries in a fresh home | 15 (SessionStart 4, UserPromptSubmit 1, SubagentStart 1, PreToolUse 2, PostToolUse 2, PostToolUseFailure 1, PermissionRequest 1, Stop 3) | 15 |
| Hook output a turn in a fresh project | 0 characters into the context | 0 |
| Skills | 5 listed; bodies 17,843 tokens, loaded on demand | 5; about 17,200 |
| Gate in a fresh project | 10 rows, 2.06 s | 10 rows |
| Shipped code | 270 files, 4,610,788 bytes | 251 files, about 4,337,724 bytes (the seams' helpers move into product modules, so a few KB stay) |
| Product code that imports workshop code | 9 seams | 0, held by a test |

## The split's shape (proposed; nothing is built before his answer)
1. A `workshop/` folder at the repository's root, beside `scripts/` and `evals/`, which already never ship. It holds
   `workshop/js-harness-workshop.mjs`, a dispatcher of the same shape as `bin/js-harness.mjs`, and `workshop/bin/`
   and `workshop/lib/` with the 7 commands and their 10 modules and 16 tests. It runs from the checkout as
   `npm run workshop -- <command>` (a new `package.json` script). The workshop may import product code
   (`../bin/lib/...`), never the reverse. `node --test` still finds its tests. Cost: about 20 file moves and 7 lines
   of the dispatcher. Undo: one revert of the slice.
2. The seams cut, each in the form the code already uses. The helpers product code needs leave the workshop modules:
   the share tolerance and window of `bin/lib/audit.mjs` go to a product module, throughput's land and gate readers
   to `bin/lib/land-records.mjs`, and `handListCount` and the sub-agent record readers to product modules beside
   their callers. The heartbeat's three ticks and doctor's idea row become injected dependencies whose product
   default is none. The workshop's dispatcher runs `loop heartbeat` and `doctor` with them. The docs row becomes a
   `documentSensors` command in this repository's `harness.json`, as `rules check` already is. Cost: about 9 call
   sites and their tests. Undo: one revert a slice.
3. The check: `bin/conventions-workshop.test.mjs`. Every relative import of every file under `bin/`, static or
   literal dynamic, resolves inside `bin/`, with an empty legacy list once step 2 has landed. A test also holds that
   the product dispatcher lists no workshop command. `scripts/package-contents.test.mjs` asserts that the pack holds
   no `workshop/` path. Cost: one test file and a few lines. Undo: delete the file.
4. The texts: protocols section 7, section 4's "In the harness's own checkout" sentence and the orchestrator's
   `--refresh-copy` line move out of the shipped skills, `bin/lib/protocols-skill.mjs` and the orchestrator's
   source. They go to `D:\js-harness\.claude\skills\js-harness-workshop\SKILL.md`, a project skill that Claude
   loads only in this repository and that travels with git. The rules that name them follow through
   `js-harness rules change`, one commit each. Cost: about 650 tokens move. Undo: a revert, then `sync`.
5. Later, only if measured worth it: the "both" halves (`merge-queue --refresh-copy` 57 KB, `rules change` and
   `rules coverage` 89 KB, and the nine branches that run only here) move behind the same seam. Not in this split.
- Order: 1 and 2 together in one slice (moving before cutting would break the imports), then 3, then 4. Three
  slices, each with Codex, the lenses and a verifier. Version: a minor release, since the product loses seven
  commands no shipped text or project of his calls. `upgrade` brings his projects to it, and `uninstall` is
  unchanged, because `install` writes the same 6 files and 15 entries.

## Setting up the workshop on another machine (spec 4)
One documented step, `docs/workshop.md`, written in slice 4:
1. The product, as any user installs it: `pnpm add -g github:jsaristi/js-harness#vX.Y.Z`, then `js-harness install`
   and `js-harness stack install`.
2. The workshop: `git clone https://github.com/jsaristi/js-harness D:\js-harness`, `npm run hooks` (it sets
   `core.hooksPath` to `.githooks`), `codegraph init` in the clone (its own index, never a copied one), then
   `npm run workshop -- --help` to see it answer. The workshop needs no dependency the product lacks: the lockfile's
   importer is empty (`pnpm-lock.yaml`).
3. What git does not carry, restored by `js-harness backup restore` (with `backup run --adopt` as the first backup
   on the new machine): Engram's memory, the Claude memory folders, `~/.js-harness` (the channel record, relief, gate
   and throughput logs, the manifest), each repository's `.git/js-harness` review records, stash entries and
   uncommitted edits. Restored by hand, never backed up: the logins of `gh`, `codex` and Claude, and what was set
   at login (`remote start --at-login`, `wake --at-login`, the scheduled tasks).
- Proof: S13's rehearsal (`scripts/rehearsal.mjs`) gets one row that runs step 2 in its scratch home, cheaper than a
  new rehearsal. The from-zero rehearsal in a VM (`docs/ROADMAP.md:265`, open) stays the proof of step 3. This pass
  shows no need for a rehearsal of its own.

## The install path (spec 6, a feature of its own)
- Today, measured in the scratch home on this machine, whose tools are already on the path: the guide's quick path
  (`docs/GUIDE.md:14-20`) is `pnpm add -g github:jsaristi/js-harness`, `js-harness install`, `js-harness doctor`,
  `js-harness stack install` (here 1 install, context7, with its y/N), then engram's own step
  `engram setup claude-code`, which `stack` lists as "your step, never run". After that come `cd` and
  `js-harness init` for the project, and `js-harness onboard` in a session. That is 7 typed steps, plus the logins
  of Claude, Codex and `gh`. A machine without the tools has more installs. That count is not measured: it needs
  the from-zero VM rehearsal.
- Target: one command for the machine and one for a project, each with its undo. For the machine, `install` would
  run the stack's installs, each with its y/N, then print the steps it cannot take and end with doctor's verdict.
  The undo is `uninstall --global` plus each install's printed undo. For a project, `init`; the undo is
  `uninstall`.
- What cannot be folded in: the bootstrap `pnpm add -g`, since a program cannot install itself before it exists
  (whether a `pnpm dlx github:jsaristi/js-harness install` one-liner can stand in is to be measured). Also his logins,
  his y/N on each tool install, engram's own setup, which writes more than one thing and reads its entry back, and
  `onboard`, an interview held in a session, which `init` already names as the next step. The workshop on another
  machine gets the same: one `npm run workshop -- setup` after the clone, running steps 2 and 3 of the workshop
  setup above.
- Why not in this split: the split changes what the package holds and leaves what `install` wires as it is (table
  E: the same 6 files and 15 entries). Folding `stack install` into `install` changes `install`'s contract and its
  undo, a delivery change (high-risk 5) that needs a depth pass of its own. It is the next feature, after the
  split's slices.

## Specs
1. Classify each command, hook, skill, rule and text that `init` or `install` writes as product, workshop or both,
   with who calls it and whether it ships or is wired. His need (L3): "el arnes va a quedar divido y solo se
   instala lo que es".
2. Measure what a fresh project and home load, before and after: fixed tokens, the hooks of each turn, the skills.
   His goal (L4): "para que nuestro arnes como producto quede liviano y solo y especialmente para como arnes de
   desarrollo".
3. The split's shape: one repository, the workshop stays and runs from a checkout, the package and `install` carry
   only the product, a test keeps product code from importing workshop code; what moves, its cost, each step's
   undo. His words (L3): "en el Claude.md no esta la informacion de nada de esto cuando solo se va a utilizar el
   arnes para otros proyectos y yo seria por decirlo asi el unico que tiene acceso al taller".
4. How the workshop is set up on another machine in one documented step, and what does not travel with git. His
   words (L5): "Y como haria para activar el taller? Por ejemplo que me toque que pasarme a otro computador y
   mantener el arnes en otro pc".
5. The double review of this plan (`rule:double-review`), then his one decision sent to the orchestrator as a
   recorded question.
6. The steps from zero to a working project, measured today, and the path with the fewest: one command for the
   machine and one for a project, each with its undo, naming what cannot be folded in; the same for the workshop
   on another machine. His words (L6): "Necesito que sea mucho mas facil se instalar".

## Tasks
- [x] T1 (kind: design) spec 1: the classification, tables A to D (commit of this document)
- [x] T2 (kind: verify) spec 2: the scratch project and home measured, table E (commit of this document)
- [x] T3 (kind: design) spec 3 and spec 4: the shape and the setup on another machine (commit of this document)
- [ ] T4 (kind: verify) spec 5: the double review, each finding taken or rebutted
- [ ] T5 (kind: docs) the docs pull request; the question to the orchestrator
- [ ] T6 (kind: build) after his answer only: slices 1 and 2, 3, 4 of the shape

## Log
- L1 (2026-11-04T19:14:05Z, the lead's transcript 0f71b2c6, line 64927, his words): "esos problemas que me
  presentas, hay alguna forma de volverlo mas sistema? osea hay un arnes que es para construir el arnes y
  manternerlo y todo osea el arnes que actualiza el arnes, y esta el arnes que uno instala en el proyecto y es que
  es el que tiene todo el arnes para desarrollar el proyecto, sera que yo por meter mas cosas para mantener el
  arnes, depronto lo estoy complejizando sabiendo que esa no es la funcion del arnes del usuario o lo que va a
  instalar el usuario para cada proyecto que vaya a desarrollar?"
- L2 (2026-11-04): paused for the restart of question 189, before any commit: the gate refuses a depth pass with no
  verdict.
- L3 (2026-11-04T21:03:28Z, line 65277, his words): "Pero no me quedo claro osea el arnes va a quedar divido y solo
  se instala lo que es cierto? Pero obvio en el Claude.md no esta la informacion de nada de esto cuando solo se va a
  utilizar el arnes para otros proyectos y yo seria por decirlo asi el unico que tiene acceso al taller para poderlo
  modificar y sacar nuevas versiones ademas de acrualizarlo o arregarlo osea mejor dicho, darle mantenimiento"
- L4 (2026-11-04T21:07:40Z, line 65317, his words): "Ok entonces hagamos esto para que nuestro arnes como producto
  quede liviano y solo y especialmente para como arnes de desarrollo". The lead cited line 65315, which is a
  queue-operation entry; his words are at 65317. The lead's reading: his yes covers building the shape this pass
  settles, after item 4 and the double review, in reviewable slices; he is asked again only on a real fork.
- L5 (2026-11-04T21:21:07Z, line 65412, his words): "Y como haria para activar el taller? Por ejemplo que me toque
  que pasarme a otro computador y mantener el arnes en otro pc". The lead asked that the proof lean on the existing
  from-zero rehearsal and build no new one unless this pass shows the need (spec 4: it does not).
- L6 (2026-11-04T21:31:30Z, line 65518, his words): "Necesito que sea mucho mas facil se instalar". The lead
  asked for it as a spec of the split, or the next slice or a feature of its own if it makes the split too large.
  This pass makes it a feature of its own after the split (section "The install path").
- L7 (2026-11-04): item 4 refutes the lightness part of L4, which is the real fork the lead named ("the measurement
  says the split is not worth it"). Nothing is built before his answer.

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
and the Stop hook keeps demanding live-board updates. This pass finds that none of the three sits in code the
split moves (item 4), so each needs its own fix.

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
- Out, until his answer to item 4's question: any source change or move. Never written: his `~/.claude`,
  `~/.codex` and credentials; read only: the transcripts under `~/.claude/projects` and his two projects' files.
  Out entirely: the product's own diet (what the product carries that is his personal process rather
  than the workshop, such as Spanish replies and the five reply states), which is F8's measured cuts S4a to S7.

## Constraints
- The split changes what every install ships (Task Size high-risk 3, a contract others consume) and how it is
  delivered (high-risk 5), so each build slice gets Codex, the Claude lenses and an independent verifier; applying
  it to his machine and merging stay his.
- Every figure is measured in the scratch project and home or read from code, never assumed; an estimate says so.
- Scratch state lives in the session's scratchpad, outside the worktree.

## Ask me before
One decision, after the double review: item 4's verdict refutes part of the request, so whether to build the split
as an isolation step (and leave the weight to F8's cuts), build it as first asked, or drop it. The question
also says that his "mucho mas facil" (L6) is carried forward as its own feature (T7).

## Depth pass
- 1. Method: release and packaging engineering of a tool built with itself (a compiler that compiles itself, a
  linter that lints its own repository). Its practitioners keep the toolchain that maintains the tool in the
  repository, run from a checkout. The shipped product is cut by an explicit manifest (`package.json` `files`). A
  dependency rule checked by a test keeps product code from importing workshop code, and a test of the packed list
  proves what ships. The standard: the product never imports the workshop, the pack never holds it, and the
  workshop is one clone and one document away on any machine. The smallest change that meets it: one
  `workshop/` folder with its own dispatcher, no new repository, no new package, and the seams cut by the injection
  the code already uses (`loop.mjs:586-590`, `doctor.mjs:395`). Search of `rule:reuse-first`: `scripts/` and
  `evals/` already live outside `files` and never ship; `scripts/package-contents.test.mjs` already proves the pack
  holds only `bin/` (his answer to question 24, "Solo los comandos"); `harness.json` `documentSensors` already runs
  this repository's own checks as commands (`rules check`); `isHarnessRepository` (`bin/lib/spec.mjs:152`) already
  marks code that runs only here. No existing notion of product and workshop was found: `js-harness rules` has no
  rule on it, and `harness.json` "functions" and the presets switch the product's own parts on and off.
- 2. Raw material:
  - His words: the lead's transcript `0f71b2c6-cbce-43ca-a031-276a4b2c381f`, lines 64927, 65277, 65317, 65412 and 65518,
    read with `js-harness sessions --quote` (L1, L3, L4, L5).
  - `package.json` `files`: `bin/`, minus `*.test.mjs` and `*.testkit.mjs`, plus `THIRD_PARTY_NOTICES.md`: 270
    files, 4,598,336 bytes (LF) of `.mjs` ship.
  - `bin/js-harness.mjs`: 52 commands, the keys of `COMMANDS`. `bin/lib/hook-entries.mjs:8-219`: the hook entries `install`
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
    commands is reached from product commands today, through the 14 import sites of table B.
  - His other two projects: `D:\abogadaclaudiajimenez` (13 transcripts) and `D:\plataforma-preproyecto`. Their
    transcripts name `onboard`, `notify`, `init`, `reply`, `sessions`, `doctor`, `check`, `stretch`, `report`,
    `functions`, `summary`, `rules`, `memory`, `failures`, `backup`, `guard`, `resume`, `clean`, `sync`, `stack`,
    `install` and `uninstall`. Their channel records (`~/.js-harness/channel/D--plataforma-preproyecto.jsonl`, 10
    notices) hold sessions opened by `sessions start` and questions asked and answered through the orchestrator,
    so the orchestration ships to a project he uses.
  - Product code that reads or branches on this repository: `isHarnessRepository` at `bin/docs.mjs:174` and
    `bin/lib/spec.mjs:165`; `bin/check.mjs:207`, `:299-300`, `:389`, `:627` and `:1705`; `bin/rules.mjs:170`,
    `:402`, `:534` and `:546`; `bin/guard.mjs:111`; `bin/contract.mjs:345`; `bin/sessions-background.mjs:86`;
    `bin/double-review.mjs:305`; `bin/progress.mjs:123`; `bin/lib/host-update.mjs:59-63`;
    `bin/lib/rules-installed.mjs:34-76`; and the constants of `bin/lib/codex-review-allowance.mjs:33`,
    `bin/lib/rules-change-run.mjs:20`, `bin/lib/rules-reach.mjs:16` and `bin/merge-queue.mjs:423`. At least 22
    sites (the second reader's search, not yet rerun here). Many read the harness's own rule list, which is
    legitimate in any project. Their classification, workshop or legitimate product scoping, is the second stage's
    first task, so this pass gives no count of workshop branches.
  - His real project, `D:\plataforma-preproyecto` (read only): its `CLAUDE.md` is 418 tokens and its `AGENTS.md`
    647, and neither names a workshop command. With 1 rule in `docs/rules.json`, `rules --hook` printed 0
    characters on a prompt. The heartbeat's workshop ticks have written records for `D--js-harness` alone
    (`~/.js-harness/throughput/`, `channel/host-watch/` and `channel/windows-daily/` each hold that one slug), so
    no project of his loses what they did.
  - Load at start (reader's finding, checked): `bin/lib/manifest.mjs:16` imports `bin/lib/audit.mjs` statically,
    and `audit.mjs` imports `guard.mjs` and `sessions.mjs` (`bin/lib/audit.mjs:7-8`). `manifest.mjs` is imported
    by `install`, `update`, `stack` and `bin/lib/spec.mjs`, and `check.mjs` imports `spec.mjs`, so nearly every
    command and the pre-commit gate load a workshop module. `bin/doctor.mjs:33` loads `bin/lib/idea-watch.mjs` at
    every SessionStart `doctor --hook`.
  - Workshop text inside shipped text: `bin/lib/manifest.mjs:55`, in the `js-harness` skill, tells how the
    harness's own rules change in its own checkout; `bin/lib/rules.mjs:450-452` tells any project's session to run
    `merge-queue --land --refresh-copy` or reinstall from main's sha.
  - Shipped bytes are those of this Windows checkout, whose files have CRLF line ends: 4,610,788. With LF line ends
    they are 4,598,336 (a reader's count). The figures that follow are all CRLF.
- 3. The bar:
  spec 1: `js-harness install --home <scratch>/home`: with `init --home` in the scratch project, tables A to D below; 52 commands (the keys of `COMMANDS`), 15 hook entries, 2 git hooks, 6 files, 6 texts and 76 rules classified; 7 commands workshop, 4 both, 41 product; every hook and git hook product; 3 of the 5 skills carry workshop lines.
  spec 2: `js-harness check --verbose`: in the scratch project, with the measures of table E; before, 2,624 fixed tokens a turn, 15 hook entries, 5 skills (17,843 tokens of bodies), 270 files and 4,598,336 bytes (LF) shipped; after the split, estimated, about 2,618 fixed tokens, 15 hook entries, 5 skills (about 17,150 tokens), 253 files and about 4,352,000 bytes (LF); the gate's time after is not measured.
  spec 3: `node --test bin/conventions-workshop.test.mjs scripts/package-contents.test.mjs`: none, new behaviour (the convention test does not exist; the pack test passes today with all of `bin/`).
  spec 4: left out because its proof is S13's rehearsal (`scripts/rehearsal.mjs`) with the workshop's row added, and the open from-zero rehearsal of "Memory that survives the machine" (`docs/ROADMAP.md:265`), which is not run here.
  spec 5: `js-harness double-review tally --since 2026-11-04`: none, new behaviour.
  spec 6: left out because it is a feature of its own after the split (section "The install path"): today a fresh home on this machine takes 7 typed steps before the first plan (`pnpm add -g`, `install`, `doctor`, `stack install` with 1 y/N, engram's own `engram setup claude-code`, `init`, `onboard` in a session) plus the logins, measured with `js-harness stack` in the scratch home.
- 4. Refutation: the prediction under test is L4's: the split makes the product light ("liviano"). L4 names no
  threshold. The one used here, a fall of less than a tenth in each of fixed context, hooks a turn and skills, is
  this pass's analytical choice, set after the data were taken. He weighs it as such, and whether the result is
  "liviano" is his to judge. Run now in the scratch project and home, and checked in `D:\plataforma-preproyecto`:
  - 0 of 15 hook entries, 0 of 2 git hooks and 0 of 6 installed files are the workshop's.
  - Of the 2,624 fixed tokens a turn, only the 6 tokens of the protocols skill's listing that name "reviewing
    throughput" are the workshop's, 0.2 %.
  - Of the 17,843 tokens of skill bodies, loaded only on demand, about 690 are the workshop's, 3.9 %: protocols
    section 7 (532 tokens), the two lines of protocols section 4 and the orchestrator, and the `js-harness`
    skill's line (`bin/lib/manifest.mjs:55`).
  - All three are under the tenth. Hook registrations, not their running cost, were counted. So, estimated: this
    stage brings small context savings, the same hook registrations and better isolation, and the weight a user
    carries is the product's own, not the workshop's.
  What the workshop adds is risk:
  - 17 files and 246,045 bytes (LF) of it ship, 5.3 %. 14 import sites in product code reach them, plus one text
    (table B).
  - Four static sites sit on paths every user runs: `bin/check.mjs:14` and `:42` in the pre-commit gate;
    `bin/doctor.mjs:33` at every SessionStart; and `bin/lib/manifest.mjs:16`, through which nearly every command
    and the gate load `bin/lib/audit.mjs`. The Stop hook `guard --stop` imports `audit.mjs` again at
    `bin/guard.mjs:214`. A broken workshop module breaks all of them.
  - At least 22 sites of product code read or branch on this repository (item 2), not yet classified.
  - Not measured: whether cutting the sites shortens the gate's 2.06 s or the hooks' start, since parsing fewer
    modules may.
  - The three failures that prompted L1 sit in code the split leaves where it is: `merge-queue` (both), the
    `contracts` row (product) and the reply hook's board check (product). The split would have prevented none of
    them. Each needs its own fix.
  Verdict: refutes
  The part refuted is the lightness he expects from the split; the isolation holds, and it is a tradeoff for him.
  It reaches him as one question through the orchestrator before any code: answered: question 190 (asked 2026-11-04T22:12Z, waiting; its number
  is written here once the orchestrator records it).
- 5. Request: build a first stage of the split, as an isolation step:
  - The seven workshop commands and their ten modules move to a `workshop/` folder with its own dispatcher, run
    from the checkout.
  - The 14 import sites are cut, so shipped product code never imports workshop code, and a convention test holds
    that.
  - The pack test names every workshop file and proves none ships.
  - The workshop's lines of three shipped skills, and the `refresh-copy` advice of `bin/lib/rules.mjs:450-452`,
    move into a skill in this repository's own `.claude/skills/`.
  - One documented step sets up the workshop on a fresh machine.
  The "both" halves that stay shipped (`merge-queue --refresh-copy`, `rules change`, `rules coverage`, the sites
  that read this repository) are named, and the isolation claim is limited to the first stage. The lightness he asked for is measured
  and cut in F8's S4a to S7 against what his two other projects use. The day's three failures get their own fixes.
  Adds: none

## Classification
Evidence columns: S, how many times the shipped texts (the 5 skills, the output style, the Rules block, and the
`CLAUDE.md` and `AGENTS.md` that `init` writes) name `js-harness <command>`; W, what `install` or `init` wires; U,
use in his other two projects' transcripts; C, the caller in product code that makes it a seam.

### A. Commands (52, the keys of `COMMANDS` in `bin/js-harness.mjs`)
| Command | Class | Evidence |
|---|---|---|
| `audit` | workshop | S 0, W none; counts the checkable claims of this repository's session transcripts. Its module `bin/lib/audit.mjs` is both: `lastShare`, `shareRefusal`, `SHARE_TOLERANCE` and `windowBefore` serve the Stop hook `guard --stop` and two product modules (table B, sites 11 to 13); only `auditEntries` is the workshop's |
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
| `init`, `onboard`, `install`, `sync`, `migrate`, `uninstall`, `status`, `update`, `upgrade`, `stack`, `doctor`, `functions` | product | the lifecycle of a project and a machine; W `doctor --hook` on SessionStart; U `init`, `onboard` (105 in plataforma-preproyecto), `install`, `sync`, `uninstall`, `stack`, `doctor`, `functions`; `update.mjs:127` looks for the installed copies under the package manager's `node_modules`, nothing of this repository |
| `check`, `gate`, `commit-msg`, `contract`, `codex-review`, `lens-review`, `double-review`, `failures` | product | W the pre-commit hook `exec js-harness check` and the commit-msg hook (`bin/lib/project-hooks.mjs:5`, `:25`); the pre-push hook where the Codex review is on (`:10`); `init` writes `docs/FAILURES.md`; S 2, 4, 0, 0, 4, 3, 1, 1; U `check`, `failures` |
| `guard`, `reply`, `resume`, `permit`, `template`, `backup` | product | W the hook entries of table C; U `reply`, `guard`, `resume`, `backup` |
| `sessions`, `notify`, `wait`, `wake`, `quiet`, `report`, `stretch`, `summary`, `progress`, `remote`, `unseen`, `status-line`, `memory`, `fetch`, `clean` | product | the orchestration and the session's tools; S 17, 11, 5, 1, 1, 6, 9, 1, 4, 0, 0, 0, 4, 0, 0; U `notify` (40 and 36), `sessions`, `stretch`, `report`, `summary`, `memory`, `clean`; `fetch` is the rung the pause hook names after a refused WebFetch (`bin/lib/hook-entries.mjs:50`); `unseen` is a row of `doctor` |

### B. The import sites (product code that reaches workshop code today: 14 imports and 1 text)
1. `bin/check.mjs:14` `checkDocs`, static, in the pre-commit gate.
2. `bin/check.mjs:42` `readRecords` and `recordFolders`, static, in the pre-commit gate.
3. `bin/doctor.mjs:33` `ideaFix`, static.
4. `bin/doctor.mjs:395` `ideaWatchHealth`, dynamic.
5. `bin/loop.mjs:586` `windowsDailyTick`.
6. `bin/loop.mjs:588` `throughputTick`.
7. `bin/loop.mjs:590` `hostWatchTick`.
8. `bin/stretch.mjs:32` `codexFacts` and `landFacts`.
9. `bin/stretch.mjs:33` `readLandRecord` and `readRecordLines`.
10. `bin/lib/stretch.mjs:13` `busySeconds` and `median`.
11. `bin/guard.mjs:214` `lastShare` and `shareRefusal`, in the Stop hook `guard --stop`.
12. `bin/lib/manifest.mjs:16` `SHARE_TOLERANCE`.
13. `bin/lib/measures.mjs:9` `windowBefore`.
14. `bin/lib/host-update.mjs:9` `handListCount`.
15. `bin/lib/rules.mjs:450-452`, a text, not an import: the advice to run `merge-queue --land --refresh-copy`.

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
- Skills: `js-harness-work-units` (586 tokens) and `js-harness-chained-prs` (660) are product. `js-harness`
  (2,953) is product apart from the sentence of its `rules` line (`bin/lib/manifest.mjs:55`) on how the harness's
  own rules change in its own checkout, which is workshop.
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
| Skills | 5 listed; bodies 17,843 tokens, loaded on demand | 5; about 17,150 |
| Gate in a fresh project | 10 rows, 2.06 s | 10 rows; time not measured |
| Shipped code (CRLF bytes) | 270 files, 4,598,336 bytes (LF) | 270 − 17 = 253 files and 4,598,336 − 246,045 = 4,352,291 (LF) bytes, plus the helpers that move into product modules (`audit.mjs`'s share functions and throughput's land readers, a few KB, not counted) |
| Product code that imports workshop code | 14 import sites and 1 text (table B) | 0, held by a test |
| Files after, counting new modules | 270 | 253 + `bin/lib/share-check.mjs` + `bin/lib/land-records.mjs` = about 255, and the product halves of `audit.test.mjs` and `throughput.test.mjs`, which do not ship |
| Workshop code left shipped (the "both" halves) | `refresh-copy` and `merge-queue-refresh*` 57 KB, `rules change` and `rules coverage` 89 KB, at least 22 sites that read this repository | the same in the first stage |

## The split's shape (proposed; nothing is built before his answer)
1. A `workshop/` folder at the repository's root, beside `scripts/` and `evals/`, which already never ship. It holds
   `workshop/js-harness-workshop.mjs`, a dispatcher of the same shape as `bin/js-harness.mjs`, and `workshop/bin/`
   and `workshop/lib/` with the 7 commands, their 10 modules and the 16 tests beside them. It runs from the checkout as
   `npm run workshop -- <command>` (a new `package.json` script). The workshop may import product code
   (`../bin/lib/...`), never the reverse. `node --test` still finds its tests. The product dispatcher holds each
   workshop command twice, in `COMMANDS` and in the `HELP` map, and names them in `USAGE`. All three lose them.
   This repository's spec row (`checkSpec`, `bin/lib/spec.mjs:161-165`) requires `docs/SPEC.md` to claim every key
   of `COMMANDS`, so it also reads the workshop dispatcher's list, and SPEC keeps claiming them. Cost: 33 file moves
   (7 commands, 10 modules, 16 tests), both maps, `USAGE`, `docs/SPEC.md` and the spec row. Undo: one revert of the
   slice.
2. The 14 import sites cut, each in the form the code already uses; first, the four static ones on every user's
   path (table B sites 1, 2, 3 and 12):
   - What product code needs leaves the workshop modules: `lastShare`, `shareRefusal`, `ownShares`,
     `SHARE_TOLERANCE` and `windowBefore` of `bin/lib/audit.mjs` go to `bin/lib/share-check.mjs`, and only
     `auditEntries` stays the workshop's. `codexFacts`, `landFacts`, `readLandRecord`, `readRecordLines`,
     `busySeconds` and `median` go to `bin/lib/land-records.mjs`. `handListCount` and the sub-agent record readers
     go to product modules beside their callers. `bin/lib/audit.test.mjs` and `bin/lib/throughput.test.mjs` are
     split the same way, and their product halves stay under `bin/`.
   - A test loads `check` and `doctor --hook` and asserts that no workshop module is in the loaded set.
   - The heartbeat's three ticks and doctor's idea row become injected dependencies whose product default is none.
     The workshop's dispatcher runs `loop heartbeat` and `doctor` with them.
   - The machinery that runs them today is re-pointed in the same slice, or the ticks would stop silently after the
     release: his heartbeat loop moves to `npm run workshop -- loop heartbeat`. The workshop skill replaces the
     shipped orchestrator's `js-harness loop heartbeat` in this repository. A row of this repository's `doctor`
     fails, rather than informs, when the workshop ticks are older than their cadence. The installed copy's
     `loop heartbeat`, run inside this checkout, warns that the workshop ticks are not wired. His other projects'
     heartbeats lose nothing: the ticks wrote records for this repository alone (item 2).
   - The texts the moved modules generate point to the workshop's dispatcher and skill:
     `bin/lib/throughput.mjs:569` and `:587` (`js-harness throughput`, protocols section 7) and
     `bin/lib/idea-watch.mjs:216` (`js-harness idea-watch draft`), with a test that follows the heartbeat's review
     line. Product texts that name a moved command change in the same slice: `bin/lib/host-update.mjs:214`
     (`js-harness host-watch brief`) becomes a product-only message of doctor, and `bin/lib/manifest.mjs:146`
     stops promising throughput snapshots from the product heartbeat. The packed `README.md` (`:771`, `:1754`)
     moves those commands to `docs/workshop.md`.
   - The docs row stays in this repository's ordinary gate and in its documents-only gate: `documentSensors` run
     only on a commit of documents alone (`bin/check.mjs:463-467`). So it is declared in both `sensors` and
     `documentSensors`, with a test that a code change adding an undocumented command still fails the gate.
   Cost: the 14 sites, the texts and their tests. Undo: one revert of the slice.
3. The import check, for shipped runtime files only (tests under `bin/` already import `scripts/`, as
   `bin/reply-budget.test.mjs:17` does, and they do not ship):
   - `bin/conventions-workshop.test.mjs`: every relative import of every non-test file under `bin/`, static or
     literal dynamic, resolves inside `bin/`, with an empty legacy list once step 2 has landed. An `import(` whose
     argument is not a string literal fails it unless its file is on an explicit list, and the dispatcher's two
     maps name no file outside `bin/`.
   - The product dispatcher lists no workshop command.
   - `scripts/package-contents.test.mjs` names each workshop command and module and asserts none is in the pack,
     so a file moved back into `bin/` is caught. Its existing assertion already refuses any path outside `bin/`.
   Cost: one test file and a few lines. Undo: delete the file.
4. The texts move out of the shipped skills (`bin/lib/protocols-skill.mjs`, the orchestrator's source and
   `skillContent` in `bin/lib/manifest.mjs`): protocols section 7, the "In the harness's own checkout" sentences of
   protocols section 4 and of the `js-harness` skill, the orchestrator's `--refresh-copy` line, and the advice of
   `bin/lib/rules.mjs:450-452`. They go to `D:\js-harness\.claude\skills\js-harness-workshop\SKILL.md`, a project
   skill that Claude loads only in this repository and that travels with git. The rules that name them follow
   through `js-harness rules change`, one commit each. This slice also writes `docs/workshop.md`. The text check
   lands with the removals, in this slice, so each slice passes on its own. Shipped text is defined as the strings
   `install` and `init` write (the skills, the output style, the Rules block and the `CLAUDE.md` and `AGENTS.md`
   blocks), read through the same functions `install` uses, not by a grep of `bin/`. The check: no shipped text
   names a workshop command, nor the words "own checkout". Cost: about 690 tokens move. Undo: a revert, then
   `sync`.
5. A second stage, only if measured worth it: the "both" halves (`merge-queue --refresh-copy` 57 KB, `rules change`
   and `rules coverage` 89 KB, and the sites that read this repository, first classified one by one) move behind the
   same seam. Until then the
   package still ships that much workshop code. The first stage promises only that shipped product code imports no
   workshop module and that shipped texts name none.
- Order: 1 and 2 together in one slice (moving before cutting would break the imports), then 3, then 4. Three
  slices, each with Codex, the lenses and a verifier. Version: a minor release, since the product loses seven
  commands no shipped text or project of his calls. `upgrade` brings his projects to it, and `uninstall` is
  unchanged, because `install` writes the same 6 files and 15 entries.

## Setting up the workshop on another machine (spec 4)
One document, `docs/workshop.md`, written in slice 4 (the third slice). Its three steps hold more than ten
commands. Folding them into one command, `npm run workshop -- setup`, belongs to the install-path feature (spec 6),
beside the product's one command:
1. The product, as any user installs it: `pnpm add -g github:jsaristi/js-harness#vX.Y.Z`, then `js-harness install`
   and `js-harness stack install`.
2. The workshop: `git clone https://github.com/jsaristi/js-harness D:\js-harness`, `npm run hooks` (it sets
   `core.hooksPath` to `.githooks`), `codegraph init` in the clone (its own index, never a copied one), then
   `npm run workshop -- --help` to see it answer. The workshop needs no package the product lacks: `package.json`
   declares no dependencies (no lockfile is tracked).
3. What git does not carry, through the recovery the backup already prints (`bin/backup.mjs:1092-1100`), reused
   and not rewritten:
   - `js-harness backup restore --from <its repository>`, with `--map <old path>=<new path>` for a project at
     another path. It imports Engram's memory, puts back the Claude memory folders and `~/.js-harness` (the
     channel record, relief, gate and throughput logs), but not the install manifest, which `install` writes again.
   - It leaves aside, to apply and check by hand, the config in `~/.js-harness/restored-config` and each
     repository's bundles, patches and `.git/js-harness` review records in `~/.js-harness/restored-bundles`, each
     with the line that applies it.
   - Then `backup verify --from`, `install`, `backup init` for each checkout, and `backup run --adopt`, which
     makes the new machine take over the backup.
   - Restored by hand, never backed up: the logins of `gh`, `codex` and Claude, and what was set at login
     (`remote start --at-login`, `wake --at-login`, the scheduled tasks, the heartbeat loop of step 2 of the shape).
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
- [ ] T4 (kind: verify) spec 5: the double review, each finding taken or rebutted (reads 1 and 2 done, L8 and L9;
  the third and last read next)
- [ ] T5 (kind: docs) the docs pull request; the question to the orchestrator
- [ ] T6 (kind: build) after his answer only: slices 1 and 2, 3, 4 of the shape
- [ ] T7 (kind: design) spec 6: open `odd/tasks/install-path.md` with the 7 measured steps as its baseline, after the
  split's slices or beside them if he says so

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
- L8 (2026-11-04): double review, read `04a81ee9-6280-480d-8944-2d0b8706ae8c`, on the frozen copy of commit
  8167716a. Claude found 10 and Codex 7.
  - Taken from Claude: 1, the Stop hook `guard --stop` loads `bin/lib/audit.mjs`, so that module is both and five of
    its functions move. 2, 52 commands, not 54. 3, the split prevents none of the three failures that prompted L1.
    4, the `js-harness` skill's line and the `rules.mjs` advice. 5, five real branches, and `update.mjs:127` reads
    `node_modules`. 6, re-point his heartbeat and doctor. 7, the import sites listed one by one, 15. 9, the pack
    test names each workshop file. 10, the gate's time after is unmeasured.
  - Rebutted from Claude: 8, and the `windows-args.mjs` part of 7. That module is not among the 17 workshop files:
    the cut list holds `bin/lib/lines.mjs`, not `windows-args.mjs`, so the 16 tests and the 246,045 bytes (LF) stand.
  - Taken from Codex, all 7: 1, the first stage is named and the claim limited. 2, the docs row stays in both
    gates. 3, the same skill line as Claude's 4. 4, the recovery the backup already prints, reused. 5, the CRLF
    bytes said, and the after figure reconciled as 270 − 17 files. 6, a stated threshold for "liviano". 7,
    `update.mjs`, no lockfile tracked, the setup document's slice, and the convention scoped to shipped files.
  - The corrected version goes to a confirming read (`rule:double-review`).
- L9 (2026-11-04): confirming read `77b1fc31-6872-460a-9224-7acc5fed0fca` on commit 8643db5c. Claude found 12 and
  Codex 5, all taken.
  - Claude: 1, four static sites on every user's path (doctor at SessionStart, and `manifest.mjs` through nearly
    every command). 2, at least 22 sites read this repository, so the count of 5 is dropped. 3, measured: the ticks
    wrote for this repository alone. 4, the heartbeat re-pointed and its doctor row fails. 5, his real project
    measured and the threshold flagged as set after the data. 6, T7. 7, both maps and the spec row. 8, shipped text
    defined by what `install` and `init` write. 9, non-literal imports. 10, the out-of-scope wording. 11, one
    document. 12, two tests split.
  - Codex: 1, the text check lands with the removals. 2, the generated texts point to the workshop. 3, the
    `host-update` and `manifest` texts and the packed README. 4, the verdict as a tradeoff for him. 5, 14
    imports and 1 text, 33 moves, about 255 files.
  - A third and last read follows (`rule:double-review`: at most three).
- L10 (2026-11-04): third and last read `5c92c8ec-8b9c-4092-8a34-ce212962ff0d` on commit 497cb7c6. Claude found 9,
  Codex 5. Taken, and to be applied to the shape by the build plan, not yet re-read:
  - Claude 1, high: `checkSpec` cannot read the workshop list without breaking the import check. It keeps
    `COMMANDS`, and a workshop sensor (`npm run workshop -- spec`) checks SPEC's claims on the workshop commands.
  - Claude 2, high: a `sensors` key in `harness.json` replaces the `package.json` sensors (`bin/check.mjs:180-198`),
    so it declares `tests` (`node --test`) beside `docs`, with a test that the gate still runs the suite.
  - Claude 3 and Codex 5: every shipped text is inventoried, the whole packed README (`:118`, `:1121`, `:1191`,
    `:1537`, `:1559`, `:1784` and more), `loop`'s usage, and `manifest.mjs:146`'s WINDOWS and HOST promises. The
    text check also runs every command's `--help`.
  - Claude 4: the four `throughput-*` rules move to a workshop rule list through `rules change`.
  - Claude 5 and Codex 3: the convention tests (`conventions-errors` and `conventions-structure` legacy lists,
    `gentle-ai-absence.test.mjs:104-106`, `ratchet.testkit.mjs`) scan `workshop/` too; costed in slice 1+2.
  - Claude 6: the idea row and the staleness row run from a project hook in this repository's
    `.claude/settings.json`, `npm run workshop -- doctor --hook`, with a test that the idea row appears at
    SessionStart here.
  - Claude 7: the 57 KB are `refresh-copy.mjs` 21,692, `merge-queue-refresh.mjs` 15,161,
    `merge-queue-refresh-now.mjs` 8,894, `refresh-consent.mjs` 6,340 and `merge-queue-stale-bin.mjs` 4,939.
  - Claude 8: per entry, `doctor --hook` 71 characters, a `systemMessage` shown to him and not in the context;
    `resume --hook` not measured; `rules` 0; `backup` 0.
  - Claude 9: `manifest.mjs` is imported by most commands.
  - Codex 2: `bin/lib/lines.mjs` (734 bytes) stays in the product, since `readRecords` uses `linesOf`: 16 files.
  - Codex 4: the LF baseline, 4,598,336 bytes, measured with `git ls-files` in this worktree. The 4,610,788 came
    from the main checkout's working files.
  - Codex 1, partly rebutted: the measured prediction, fewer fixed tokens and hooks a turn, is falsified whatever
    the threshold (0 hooks and 6 tokens move). Overall lightness, with the hooks' running cost unmeasured, stays
    his to judge, and the question presents isolation, context, package and runtime apart.
  - Three reads did not settle the build shape (two high findings in the third), so by `rule:double-review` he gets
    it as a problem. T6's build plan passes to `claude-fable-5-1` (`rule:escalation-model`) before any slice. The
    direction, his question, does not depend on these details.
- Next step (for a resume): PR 769 is open (docs, not merged); question 190 waits on him. On his answer: record it
  here and in item 4, then T6 (plan to claude-fable-5-1 first) or T7, as he chose.

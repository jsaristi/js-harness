# gentle-ai, reverse-engineered: what we copy, what goes, what we take over

Status: proposal, 2026-10-26 (seventh pass: corrected after two blind grades, section 12), part of F8 (`docs/ROADMAP.md`). It answers his request of the same
day, quoted in full in section 8, and his change of direction the same evening (the section below).
It sits beside [the harness diet](harness-diet.md) ("the diet" below), which stays the plan of
record; this document holds the matrix, the TUI and the idea watch (S9).

Sources: the installed binary gentle-ai 4.2.0 (`gentle-ai --help`); its source, read-only, at tag
v4.2.0 and `main` 2b56327e ("G" below); what it, Orca and herdr installed on this machine
(`~/.claude`, `~/.claude.json`, `~/.codex`, `~/.gentle-ai`, `~/.orca`, `~/.herdr`, read only); and
this repo. "H" is `~/.claude/CLAUDE.md`. Each claim is marked **[c]** when checked with the path,
line or command cited, or **[i]** when inferred. Nothing outside the repository was changed. Dates
are local (America/Bogota).

IDs: **G1-G14** are his decisions raised here; **D1-D9** are the diet's. Both live in one register,
[the diet's section 1](harness-diet.md#1-what-is-his-to-decide); section 7 below gives the G
decisions' reasons.

## Direction: replace, not exclude (2026-10-26)

His words (transcript `e41d1e8d-8264-45a4-b16c-f9279f7b6076` line 2272, 2026-10-27T01:21Z, that is
20:21 on 2026-10-26 local, read with `js-harness sessions --quote`):

> "no Orca ni Herdr lovamos a volver a utilizar y gentle-ai tampoco la idea es copiar la forma de
> funcionar con sus complementos osea traernos codegraph, context7 y engram y nuestro arnes
> fusionado de gentle con js-harnes mas funcionalidades de nuestras caracteristicas con ajustado a
> nuestras necesidades etc etc"

What it means (the lead's reading, which this document follows):
- **gentle-ai, Orca and herdr leave his machine.** js-harness becomes the one harness: gentle-ai's
  way of working copied and fused with ours, adjusted to our needs, plus our own features.
- **The complements stay, and js-harness installs and manages them directly:** codegraph,
  context7 and engram, with the engram plugin. Our stack already composes them
  (`bin/lib/stack.mjs`, the `engram`, `engram-plugin`, `codegraph` and `context7` rows) [c].
  gentle-ai's row leaves the stack.
- **gentle-ai's repository stays a source of ideas** we read on each release, never an installed
  dependency (section 5).
- **Codex stays the external reviewer** (his answer to D3).

Two more of his words the same evening settle the review and the scope (same transcript):

> "revision siempre, ya que siempre necesitamos una segunda opinion con un segundo modelo pero
> tambien una revision del mismo claude por que asi nos aseguramos criterio y solidez" (line 2351,
> 2026-10-27T01:28Z)

> "recuerda que todo este mismo trabajo es como va a trabajar el arnes en los proyectos" (line
> 2382, 2026-10-27T01:29Z)

- **Two reviews on every candidate, always** (G9, answered). A candidate is a work-unit commit or a
  slice, never the whole branch. It gets Codex as the second model (`js-harness codex-review`, as
  today) and a Claude review: gentle-ai's four lenses (risk, resilience, readability, reliability)
  ported as our own reviewers under our names, one to four picked by what the change touched, each
  run in a fresh context. Neither is skipped by a risk tier. gentle-ai's Stop-hook nagging leaves
  with its engine; our pre-push gate checks that both records exist for the same commit range. Section 3 has the
  review row: S1 ports the lens prompts and builds the runner that feeds them (the candidate as a
  commit range, an input packager, validation, launch and auth, records, invalidation, skips as a
  debt; diet §10, "S1, the Claude lens runner").
- **What this plan decides for this repo is how js-harness works in every project it sets up:**
  the `CLAUDE.md`/`AGENTS.md` split, the two reviews, the copied way of working, the complements
  installed and managed by js-harness, the TUI, and no gentle-ai, Orca or herdr. Section 11 walks a
  project from `init` to its first reviewed slice. S13 rehearses all of it on a scratch project
  before his projects move or anything is removed, and a short smoke test repeats it after removal
  (diet §10).

**Only what serves us.** His words (line 2646, 2026-10-27T01:51Z): "ok entonces copiamos e
implementamos solo lo que nos sirve el resto no". So every gentle-ai piece is either copied because
it serves a named need of ours, stated beside it, or not taken. Nothing is copied for completeness
or for parity with gentle-ai. Section 3 states the need on every "copy" row; a row without one is
"drop".

**Removal is machine-wide.** gentle-ai's, Orca's and herdr's hooks and global files serve every
project on this machine, not only this one. So nothing is removed until js-harness's replacements
are installed and his listed projects are moved onto them by the migration S12 builds (today
neither `init` nor `update` refreshes an initialized project: section 11). Then S2: writers
quiesced, one full backup, a restore drill that proves engram answers, each removal asked first
(diet §10).

**An interim exclusion first.** S3 adds `claudeMdExcludes` for gentle-ai's global file in this
repo's settings, so the ~30.7k it loads every turn is saved at once, months before removal. It is
undone by reverting that commit; S2 reverts it once the file holds only G12's Rules block.

**Landing.** This plan lives on branches (PRs 593 and 594); new sessions read `main`. It takes
effect for other sessions only once he reads and lands those PRs. The TUI's slice 1 is PR
jsaristi/js-harness#596, open and not merged, its real-console walk left to him.

Before and after:

| | Before | After |
|---|---|---|
| Layers | host → gentle-ai (installer, 91.6 KB of always-on prose, hooks, persona, review engine) → engines (engram, codegraph, context7, its review CLI) → js-harness | host → js-harness (workflow, persona, checks, hooks, review flow, stack) → engram, codegraph, context7 |
| Hook entries in `~/.claude/settings.json` | 32 from five owners | 14 from two: js-harness 13, codegraph 1 |
| Always-on text | H (30.7k tokens), `gentleman.md`, 14 skill and 8 agent descriptions | `CLAUDE.md` and `AGENTS.md` of the project, our own style, the skills we copied |

What the earlier passes built for an installed gentle-ai, and is now **superseded**: S2 as a
permanent exclusion of H by `claudeMdExcludes` (it returns only as S3's interim step, which S2
reverts); S9a's installed-file diff, same-version drift check, re-added-hook detection, `--accept`,
and the watch's way-back commands (S2 keeps one undo: `go install
github.com/gentleman-programming/gentle-ai/v4/cmd/gentle-ai@v4.2.0` and the backup); option (e) of the TUI and its stale-row warning; the S0 probe of gentle-ai's
review hooks; S1 as a driver of gentle-ai's review engine. Section 9 keeps the record of why each
existed.

## 0. The answer, short

- **Copy only what serves us, then remove gentle-ai.** Its ODD sizing test, its feature document's
  order and its delegation by named reason go into the root `CLAUDE.md`; test-first is already
  ours and the Risk line drops; the voice is not copied (our own style, neutral Spanish with tú);
  two of its 14 skills and its four lens reviewers are copied under our names with their license
  notices, each for a stated need (section 3); its presets become our own (G14). Its review engine,
  hooks, telemetry and installer leave.
- **Two reviews on every slice, always:** Codex, and Claude's lens reviewers in a fresh context
  (his answer, above). The pre-push gate checks both records of the same commit range; a skip lets
  the push through as a debt the merge path collects (G13).
- **Take over the complements:** the stack's rows for engram, the engram plugin, codegraph and
  context7 get their own install and registration commands instead of `gentle-ai sync`/`upgrade`.
- **Remove gentle-ai, Orca and herdr last,** with writers quiesced, after a backup whose restore
  drill proves engram answers, each with an undo, each only after he says yes at that moment
  (diet §10, S2). The first turn then loads about 75.8k, against 105.5k
  today (section 6).
- **The TUI** ports gentle-ai's design to zero-dependency Node; every screen of theirs is native or
  excluded (section 4.6). Slice 1 is PR jsaristi/js-harness#596, open and not merged; the rest has a
  completion boundary and a dependency map (section 4.7).
- **Following gentle-ai** becomes an idea watch: each release's source diff, by area, classified
  adopt-into-ours, adapt or ignore, and recorded. Nothing is installed (section 5).

## 1. What gentle-ai is

"The deterministic engineering environment for the AI agent you already use": it configures an
agent, never ships one, and gives it "memory, a workflow, and evidence" (G `README.md`) [c]. It
targets 17 hosts (the README badge says 18) [c]; on this machine it manages Claude Code, Codex and
Antigravity (`~/.gentle-ai/state.json`, `installed_agents`) [c].

**Design ideas worth copying** [c, G `docs/intended-usage.md:10-28`]:
1. **The ODD feature document.** Small work stays inline and leaves no artifact; large work gets
   one `odd/tasks/<feature>.md` with specs that quote the user verbatim, a task list and a log.
   This repo already uses the folder and most of the format (diet §3 row 1: 77 of 111 docs carry
   `## Specs`).
2. **Delegate for a named reason, not for size.** A subagent is spawned for a map, a parallel
   writer or a verifier of a named high-risk item. It matches Cognition's "one writer, read-only
   helpers" (diet §6).
3. **Review of a frozen candidate, driven by data, not prose.** Its review engine
   (`reviewtransaction`, 36.8k source lines and 39.3k test lines) returns the next command as data
   (`next_transition`). The idea survives removal: our review flow (S1) is driven by
   `codex-review` records and the pre-push refusal, not by remembered prose.
4. **Prompts pinned by tests.** Prompt text has sha256 goldens and drift ratchets
   (`agentguidance/routing_golden_test.go:30`, `assets/orchestrator_drift_ratchet_test.go:83`)
   [c]. Our copied text gets the same: `rules check` already pins rule text; the S3 and S10 lines
   get a golden test.

**Tuned for other hosts or models, not for Claude Code on Opus 5.5** (so not copied as written):
- One orchestrator template serves 11 hosts: v4.2.0 changed the same lines in all 11
  (`git diff --stat v4.1.0 v4.2.0 -- internal/assets`) [c]. The wording is for the weakest host:
  `MANDATORY` 8 times and "never" 90 times in H [c, grep].
- The routing numbers (3 calls, 10k tokens, 100 lines) were measured on Pi benches at n=1
  (G `README.md`, "Measured") [c].
- The Lossless Blocking Prompt envelope and its Spanish ordinal aliases exist for hosts without a
  native question tool; Claude Code has one [c, H].
- Explicit verification gates and `MANDATORY` emphasis, which the Opus 5 guide says cause
  over-verification (diet §5) [c].
- Leftovers of v3: model presets still name `sdd-propose` and `sdd-archive`
  (`internal/model/claude_model.go:133-150`), and telemetry still counts `sdd_phase_runs` [c].

## 2. What leaves, and what it costs today

**The global file.** H is 92.6 KB in 613 lines; 91.6 KB of it is gentle-ai's [c, byte count per
marker block]. Claude Code counts it at 30.7k tokens (diet §2); it loads in every subagent except
the built-in Explore and Plan.

| Block | KB |
|---|---:|
| `orchestrator` (delegation 25.6, review lifecycle 27.9) | 53.5 |
| `agent-routing` (ODD), with `remote-authorization` inside | 29.2 |
| `codegraph-guidance` | 4.1 |
| `engram-protocol` | 2.6 |
| `persona` (it holds his Rules list) | 2.2 |
| **Total** | **91.6** |

His Rules list lives inside gentle-ai's `persona` block, so removing gentle-ai removes it from
every project on the machine. The diet's A.1 lines carry it into this repo (S3); his other projects
are G12.

**Beside it:**
- The output style `gentleman.md`, 7.1 KB, about 1.8k tokens per request [c].
- The descriptions of its 14 skills, 1,941 characters, about 0.5k tokens by chars/4, and of its 8
  agents in `~/.claude/agents` (`jd-fix-agent`, `jd-judge-a`, `jd-judge-b`, `review-readability`,
  `review-refuter`, `review-reliability`, `review-resilience`, `review-risk`), 1,197 characters,
  about 0.3k [c, frontmatter measured 2026-10-26].
- **Telemetry is on by default.** `gentle-ai telemetry status` answers "enabled (source:
  default)" [c]. It is remote and opt-out, and on each `Stop` its Claude adapter reads up to 512 KB
  of the transcript (G `internal/telemetry/runtime_claude.go:16`) [c]. It leaves with gentle-ai.

**Every hook, by event and owner** [c, `~/.claude/settings.json` read 2026-10-26: 32 command
entries]. Each entry is a process start on Windows on every firing, even when the script exits at
once.

| Event | gentle-ai | js-harness | Orca | herdr | codegraph | Total |
|---|---:|---:|---:|---:|---:|---:|
| `SessionStart` | 1 (`review stop-hook`) | 4 (`doctor`, `resume`, `rules`, `backup`) | 1 | 1 | | 7 |
| `Stop` | 2 (`review stop-hook`, telemetry, async) | 3 (`guard --stop`, `reply`, `backup`) | 1 | | | 6 |
| `UserPromptSubmit` | 1 (skill-registry refresh, through PowerShell) | 1 (`rules`) | 1 | | 1 (`prompt-hook`) | 4 |
| `SubagentStop` | 1 (telemetry, async) | | 1 | | | 2 |
| `SubagentStart` | | 1 (`rules`) | 1 | | | 2 |
| `PreToolUse` | | 1 (`guard`) | 1 (`*`) | | | 2 |
| `PostToolUse` | | 1 (`resume --pause`) | 1 (`*`) | | | 2 |
| `PostToolUseFailure` | | 1 (`resume --pause`) | 1 (`*`) | | | 2 |
| `PermissionRequest` | | 1 (`permit`) | 1 (`*`) | | | 2 |
| `PostCompact`, `StopFailure`, `TeammateIdle` | | | 1 each | | | 3 |
| **Total** | **5** | **13** | **12** | **1** | **1** | **32** |

- **Orca's twelve** all run `~/.orca/agent-hooks/claude-hook.cmd`. It exits at once unless Orca's
  variables (`ORCA_AGENT_HOOK_PORT`, `ORCA_AGENT_HOOK_TOKEN`, `ORCA_PANE_KEY`) are set [c, the
  script], so outside Orca it costs a `cmd.exe` start on every tool call (`PreToolUse` and
  `PostToolUse` match `*`) and does nothing.
- **herdr's one** runs `~/.claude/hooks/herdr-agent-state.ps1` through PowerShell on
  `SessionStart`; the script says "installed by herdr" and exits unless `HERDR_ENV` is 1 [c].
- `~/.codex/hooks.json` holds 3 gentle-ai entries, 1 herdr entry and 5 of ours [c].
- **codegraph's prompt hook** stays: it is the complement's own, and silenced here by
  `CODEGRAPH_NO_PROMPT_HOOK=1`, though it still starts on every prompt.
- The engram plugin's prompt hook comes on top, from a plugin (D8).

After removal: 14 entries, js-harness 13 and codegraph 1.

## 3. The matrix, for replacement

Verdicts: **copy** (port into js-harness, saying where, and only for the need stated: line 2646), **take over** (a complement js-harness now
installs and registers itself), **keep ours**, **drop**.

| Function | gentle-ai | js-harness today | Verdict, and where it goes |
|---|---|---|---|
| ODD workflow and feature document | 29.2 KB `agent-routing` prose; `odd/tasks/<feature>.md` | contract first (`js-harness contract`), `odd/tasks/` | **Copy** only the sizing test (small or large) and the feature document's order (header, `## Specs` quoting him, `## Tasks`, `## Log`) into the root `CLAUDE.md` (S3 and S10); the format stays checked by `contract`. **Need:** large work must survive a new session or a compaction (`AGENTS.md`: the feature document is the handoff), and once gentle-ai's text is gone nothing tells a session when to open one or in what order |
| Delegation by named reason | 25.6 KB of triggers, written twice (H:219, H:546) | `rule:subagent-*` rules | **Copy** the A.1 lines (122, 224, 227) into `CLAUDE.md`; the rest drops. **Need:** subagents cost tokens and parallel writers collide; these lines keep spawning to a named reason, beside `rule:subagent-*` |
| Test-first and the Risk line | ODD protocol text | `AGENTS.md`, "What good looks like" | Test-first: **keep ours** (`AGENTS.md` already says it). Risk line: **drop**: no tier decides anything now that both reviews run on every slice (G9), so no need is left |
| Review | Go engine (RDD), consent envelope, risk tiers, `review-*` agents, stop-hook, 27.9 KB of lifecycle prose | `codex-review` per slice, pre-push refusal, a `check` row that asks gentle-ai the risk tier | **Drop** the engine, its tiers, its consent and its prose. **Keep** Codex per slice. **Copy** the four lens prompts as our own reviewers (G9, answered: both reviews on every candidate), ported at S1 with the runner S1 builds (diet §10, "S1, the Claude lens runner"): the candidate is a commit range with a subject hash; an input packager feeds the tool-less prompts in place of gentle-ai's provider binding; the lens-selection rule (one to four lenses by consequence of what the range touched, as gentle-ai's "Lens selection" reads); each lens launched in a fresh headless run on his plan's CLI login; validation, where a result that does not echo the hash or cover every path is incomplete and rejected; per-lens records (range, hash, lens, findings, outcome, tokens, duration) beside Codex's, which gains the same range and hash; invalidation when an amend or rebase changes the head commit or the hash. The pre-push hook refuses a code commit without a complete record of both, or a recorded skip; a skip is a debt that `check` and `doctor` list and the merge path refuses until it has its review (G13). `AGENTS.md`'s review paragraph and `check`'s `review` row are rewritten there |
| Persona and output style | `persona` block plus `gentleman.md` | none | **Write our own**, not a copy: a short output style named `js-harness` by default (G10n) that sets neutral Spanish with tú; nothing of its voice is copied, neither voseo, Rioplatense register, mentor persona nor "Gentleman" branding (G10, answered, line 2466). **Need:** his replies keep one register, neutral Spanish with tú, once `gentleman.md` leaves; today that file is what sets it (S10) |
| His Rules list | inside the `persona` block | none | **Copy** (diet A.1 and D7) into `CLAUDE.md`; for his other projects, G12. **Need:** they are his own rules, which live inside gentle-ai's block today and would leave with it |
| Skills (14) | `~/.claude/skills` | 3 js-harness skills | **Copy two, drop twelve** (table below; G8) |
| Agents (8) | `~/.claude/agents` | none | **Copy** the four `review-*` lens agents under our names, ported at S1 and rewritten to read our packaged input: today they are tool-less and read only gentle-ai's provider-built binding and context (`~/.claude/agents/review-risk.md`, "Input") [c]. **Need:** the Claude review he asked for on every slice (G9, line 2351); **drop** `review-refuter` (the lens findings go to the session, and Codex is the second opinion) and the three `jd-*` agents with `judgment-day` |
| Memory | installs engram, writes its block | `memory` hygiene, `backup`, `MEMORY.md` rules | **Take over** engram and its plugin (stack rows, S11); the policy stays ours; the block drops, engram's MCP instructions remain. **His memory stays:** `~/.engram/engram.db` (69 MB) is backed up before any removal, and the restore drill must return a known observation through `mem_search`. Neither of gentle-ai's Engram scopes reaches it: in 4.2.0 the default scope is global, which removes engram's registrations and the `engram-protocol` block; the project scope deletes `<workspace>/.engram`, never `~/.engram` (`internal/components/uninstall/service.go:158`, `:991-1008`) [c]. S2 re-registers engram right after the uninstall |
| Code graph | community tool, guidance block | stack row, `functions apply` | **Take over** the install and registration (S11); `codegraph init` replaces `gentle-ai codegraph init` in the row's fix; the block drops |
| context7 | registers it | stack row (hosted MCP), optional | **Take over** (S11), and make it required: always enabled in projects (G11, answered, line 2466). `init` enables it, `doctor` flags a project where it is disabled, and this repo turns it on (it is disabled here today) |
| Hooks (5) | review, telemetry, skill registry | 13 | **Drop** all five (S2) |
| Telemetry | remote, opt-out, on | local measures only | **Drop**, with gentle-ai (G1, closed) |
| Skill registry and `.atl/` | a hook on every prompt | none | **Drop** (G4, closed) |
| Permissions | its `permissions` component writes 24 `permissions.deny` entries into `~/.claude/settings.json` (`rm -rf` on `/` and `~`; Read and Edit of `.env`, `.ssh`, `.credentials`, Keychains, `.aws/credentials` and more) | `guard` PreToolUse | **Keep and take over** (it was missing from the plan). js-harness owns the deny list: `install` writes it at user level, recorded so `uninstall` undoes exactly it; `init` applies it to the project's settings; a `doctor` row flags an entry missing; `guard` checks the same paths. gentle-ai's uninstall removes the whole `permissions` object, not only the denies (`internal/components/uninstall/service.go:1010-1015`, checked on the v4.2.0 tag) [c]; today the object holds 1 `allow` entry, `defaultMode: bypassPermissions` and the 24 denies [c]. So S10 takes over the whole object, and S2 backs it up, re-applies it right after the uninstall and checks it equal to the backup (S10, S2) |
| Backups, state, managed ownership | snapshots before writes | the manifest and four uninstall kinds | **Keep ours**; gentle-ai's own backup is used once, by its uninstall in S2 |
| Install, update, sync, uninstall | its own | `install`, `update`, `upgrade`, `uninstall`, `stack` | **Keep ours**; gentle-ai's uninstall runs once (S2) |
| Presets | `full-gentleman`, `ecosystem-only`, `minimal`, `custom` (`internal/model/types.go:205-208`, `docs/components.md:159-162`) [lead, checked] | none | **Copy the idea**. **Need:** `init` today sets each function on its own (`js-harness functions`); a preset sets them in one choice when a project is set up. `install` and `init` offer our own presets: **complete** (engram, codegraph, context7, the two reviews, the `CLAUDE.md`/`AGENTS.md` split), **lean** (the same without codegraph) and **custom** (may add or drop codegraph and the engram plugin, never context7 or the reviews), shown in the TUI as a multi-select (slice 2). Every preset keeps context7 (G11) and both reviews (G9). Names by default (G14, S11) |
| Doctor | bounded version probes | aggregates the stack | **Keep ours**; the `gentle-ai` and `gentle-ai-sync` rows leave (S11) |
| GGA | Gentleman Guardian Angel v2.10.1, a separate binary at `~/bin/gga`: "Provider-agnostic code review using AI" on staged files through a git pre-commit hook; not installed in this repo [lead, checked] | none | **Drop.** The two reviews per slice cover it; a third review per commit adds cost. S2 removes `~/bin/gga`, after checking each of his projects for its hook (`gga uninstall` in each repo that has it) (G6, closed) |
| Theme | "Gentleman Kanagawa theme overlay" (`docs/components.md:20`) | none | **Drop**: cosmetic and branded. Our TUI gets its own small palette that honours `NO_COLOR` (slice 5) |
| Multi-host | 17 hosts, 3 here | Claude Code; Codex for reviews | **Keep ours narrow.** Removal covers Codex too: `~/.codex/AGENTS.md` is 109 KB with 35 gentle-ai mentions, `~/.codex/skills` holds eight of its skills and `_shared`, and `~/.codex/hooks.json` 3 of its entries (lead, checked 2026-10-26). Codex as reviewer keeps working through `codex-review`'s lean home, which does not read `~/.codex/AGENTS.md` |
| Model routing | `claude_phase_assignments` | `rule:subagent-*-model`, `contract modes` | **Keep ours** |
| Evals | `bench/` in Go | `evals/`, S0 and S8 | **Keep ours**; borrow the before/after table for the S0 report |
| TUI | Bubble Tea, 48 screens at v4.2.0 | `bin/tui.mjs` | **Copy the design**, not the code (section 4). **Need:** his request for a TUI as capable as gentle-ai's (section 8) |

**The 14 skills** (G8). Copies live in this repo's `skills/` and are installed by `js-harness
install`, recorded so `uninstall` removes them; names and text carry no gentle-ai or Gentleman
mark (G `TRADEMARKS.md:3-9, 39`) [c].

| Skill | Verdict | Reason |
|---|---|---|
| `work-unit-commits` | copy | **Need:** every slice gets two reviews (G9), so a slice must be one reviewable unit with its tests and docs; `js-harness-protocols` section 3 names the unit but not how to cut one |
| `chained-pr` | copy | **Need:** two reviews per slice cost limits by size (diet D2), so a change over about 400 lines is split into stacked slices; section 3 of `js-harness-protocols` covers merging them, not splitting |
| `branch-pr` | drop | no named need: sessions already open PRs with `gh`, and its issue-first check is gentle-ai's own policy |
| `comment-writer` | drop | no named need: review findings are answered in the session, not as public comments |
| `cognitive-doc-design` | drop | no named need: our docs and his pages already have their own rules (`js-harness-protocols` section 8, `rule:reports-spanish-visual`) |
| `skill-creator` | drop | no named need: js-harness generates its skills from code (`bin/lib/protocols-skill.mjs`) |
| `judgment-day` | drop | the Claude lens review runs on every slice (G9), so an on-demand dual review adds nothing |
| `skill-improver` | drop | no named need |
| `skill-registry` | drop | its hook and `.atl/` leave |
| `issue-creation` | drop | not his flow; PRs are |
| `systemic-issue-triage` | drop | a maintainer's triage of gentle-ai's own issues |
| `rdd-defect-workflow` | drop | RDD leaves |
| `go-testing` | drop | no Go here |
| `gentle-ai-bench` | drop | gentle-ai's own bench |

**License.** The repository's `LICENSE` is MIT (G `LICENSE:1`) [c], but 13 of the 14 skills declare
`license: Apache-2.0` in their frontmatter and `skill-registry` declares MIT [c]. Since the two
disagree, each copy follows the stricter one: it keeps its `license:` line, says at its top that it
is adapted from gentle-ai and what changed, and the repo ships a `THIRD_PARTY_NOTICES` file with
the MIT notice and the Apache-2.0 text [i: that this satisfies both; it is the usual reading of
both licenses]. The marks "Gentle AI", "gentle-ai" and "Engram" are claimed as trademarks
(`TRADEMARKS.md`) [c]: our copies use our names. Running engram itself, by its name, is ordinary
use of the tool, not a copy.

## 4. The TUI

### 4.1 Theirs

Running `gentle-ai` with no arguments opens it (`gentle-ai --help`) [c]. It is Bubble Tea v1.3.10,
bubbles and lipgloss (G `go.mod:7-13`). Sizes, each with its version [c]:

| | v4.2.0 (installed) | `main` 2b56327e |
|---|---:|---:|
| `Screen` constants, `ScreenUnknown` included | 48 | 49 (adds `ScreenShellInstall`) |
| `.go` files under `internal/tui` | 87 (42 source, 45 test) | 131 (59 source, 72 test) |
| lines, source / test | 11,615 / 14,623 | 14,928 / 17,965 |

One `Model` struct holds the whole state; `Screen` is a closed enum (v4.2.0
`internal/tui/model.go:578-634`); `View()` dispatches to pure render functions; every backend call
runs in a goroutine that returns a typed message, and install progress streams through a lossless
queue whose messages carry a run id, so results of a stale run are dropped (`model.go:316-375`,
`:1360`) [c]. Keys: arrows or j/k, Enter, Space to toggle, Esc for Back, q and ctrl+c to quit, and
only those two while an operation runs [c, `model.go:1809-1990`]. Its confirm screens open with the
cursor on the destructive row (`:2205`, `:2688`, `:2723`) [c].

### 4.2 Ours, and why it does not behave like theirs

`bin/tui.mjs` (544 lines; `node --test bin/tui.test.mjs` runs 88 tests, all passing, 2026-10-26)
already has the right split: a pure `handleKey(state, key) → {state, effect}` and
`render(state) → lines`, with a thin I/O shell [c]. Six causes keep it from behaving like
gentle-ai's:

1. **No alternate screen and no size model.** It erases by counting logical lines, and nothing reads
   `stdout.columns`, `rows` or `resize` [c, grep]. A line wider than the terminal (the Everything
   confirm is about 260 characters, `:60`) wraps into rows that were not counted, so the menu
   duplicates or shifts [i: from the code, not run in a real console].
2. **Commands block the TUI and print over it.** They run in-process and synchronously
   (`spawnSync` in `update.mjs:74`, the package manager in upgrade); nothing animates; their output
   scrolls the screen and the menu is redrawn underneath (`:374`, `:416`) [c]. Raw mode stays on
   while a command runs [c], so a child that inherits the console gets it raw [i].
3. **Keys are read one chunk at a time.** Two keys in one chunk, SS3 arrows, PgUp/PgDn, Home/End,
   Space and Tab are ignored (`:211-223`) [c]. Esc on the main menu quits (`:247`) [c].
4. **Slow work before the first draw:** `git ls-remote` and the doctor probes run before anything
   appears (`:504`, `:525`) [c].
5. **Missing pieces:** color, multi-select, scrolling, a result screen, detail screens [c].
6. **No test drives a real console:** the tests use fake streams, and `scripts/tui-walk.mjs` drives
   pipes, where `setRawMode` does not exist [c].

**Causes 1 and 2 are defects in shipped behaviour** (the TUI shipped with "Install and update",
merged 2026-09-26). Under the scope freeze a defect in shipped behaviour may become a task (ROADMAP,
"Scope frozen"). Slice 1, which fixes them, was built in session JH 56
(`local_1a67ff71-ea47-44e4-a7d8-7f4f8be744ca`) and is PR jsaristi/js-harness#596, open and not
merged, its real-console walk left to him.

One thing ours does better: confirmation is an explicit y/N where anything else means no
(`:238-239`) [c]. Keep it.

### 4.3 What we need from theirs

Needed: alternate screen with full-frame redraw and resize; async runs with spinner, streamed log
and locked keys; a result screen with the exit code; a real key parser; a Doctor detail screen with
each row's fix command; multi-select for `functions`, `stack install` and the skills `install`
writes; a review of what `install`/`init` will write before it writes; scrollable read-only views
of our own (`progress`, `sessions`, `codex-meter`, `failures`); a small palette that honours
`NO_COLOR`. Since gentle-ai leaves, nothing is delegated to its TUI: what we need is native, the rest
is excluded (4.6).

### 4.4 Four ways to get there

| Option | Cost | Zero dependencies | Windows | License and trademark | Upstream updates |
|---|---|---|---|---|---|
| **(a) Port the design to zero-dependency Node** | the six slices of 4.6: about 1.35k code lines plus tests [i] | kept | Node puts the console in VT mode on Windows 10 1809+; this machine is 19044 [i] | ideas are free; no logo or rose art (G `internal/tui/styles/logo.go:9`) | read their screen catalog per release (section 5) |
| **(b) Node with a library** (ink, blessed, terminal-kit) | fewer lines | **breaks** `AGENTS.md:16`; `package.json` has no `dependencies` [c] | ink is good; blessed is unmaintained [i] | MIT | unrelated |
| **(c) Fork their Go TUI** | 11.6k source lines at v4.2.0 welded to their internals (G `internal/app/app.go:13-30`); Go toolchain and per-OS release builds | breaks it | good | MIT, but forks "must use distinct primary names and branding" (G `TRADEMARKS.md:39`) [c] | worst: every release conflicts |
| **(d) Add our screens inside theirs** | needs an upstream PR: `Screen` and Community Tools are closed enums | n/a | n/a | their brand | theirs; and gentle-ai leaves |

The earlier option (e), a menu item that opened gentle-ai's own TUI, is gone with gentle-ai.

### 4.5 Recommendation and slice 1

**(a)** (G2). It keeps the repo's one hard rule, it grows the reducer/render split we already have,
and no release of theirs can break it.

**Slice 1, about 400 code lines, tests first, touching only `bin/tui.mjs` and its tests** (PR
jsaristi/js-harness#596, open, not merged; the real-console walk is his):
1. **Terminal guard:** enter the alternate screen and hide the cursor; restore raw mode, cursor and
   main screen on quit, error, SIGINT and exit.
2. **Frame model:** repaint the whole frame each time and redraw on `resize`. Ordinary lines are
   clipped to `columns`; **warnings and confirm texts wrap, never clip**. If a warning does not fit
   in `rows`, it scrolls, and its confirm key works only once the whole text has been shown
   (cause 1).
3. **Key parser:** split chunks into keys (CSI and SS3 arrows, PgUp/PgDn, Home/End, Space, Tab, a
   lone Esc after a short timeout); Esc means Back, q quits (cause 3).
4. **Run screen:** each command runs as a child (`node bin/js-harness.mjs <cmd>`) with piped
   output; a spinner ticks, the output fills a scrollable log, keys other than ctrl+c are locked,
   and it ends on a result screen (cause 2). Outcomes: **done** (exit 0), **failed** (its exit
   code), **cancelled** (ctrl+c: the child's process tree is killed, `taskkill /T` on Windows, the
   TUI waits for it to exit, then reports), **could not start**. Quitting during a run asks first;
   the terminal guard also kills a running child on error.
5. **Action-level authorization, unchanged.** `stack install`'s `Run it? [y/N]` for each row
   (`bin/stack.mjs:223-241`) is shown in the run screen and only the key pressed is sent, as today's
   relay does (a `bin/tui.test.mjs` test asserts it). The TUI never substitutes `--yes --tool <id>`:
   `--tool` selects every mandatory dimension of that tool (`:208`) and `--yes` skips each row's
   question.
6. **First draw before slow work:** draw at once, then fill in the update check and the stack block
   (cause 4).

**Acceptance.** Unit tests, written first, with frame-level assertions (every screen at 40, 80 and
120 columns and a short height; no line wider than `columns`; no frame taller than `rows`; every
warning's full text present), and a manual walk checklist recorded with its results in the TUI
feature document: in Windows Terminal and in conhost, open; resize to 40 columns and back; Doctor;
Update; `stack install` answering one y and one N; ctrl+c during a run (cancelled, no child left);
Esc back; q out; the terminal usable afterwards. Risk: item 6 partly applies, since no test drives a
real console.

### 4.6 Every screen of theirs, and where it goes

Dispositions: **native** (ours, in the slice named) or **excluded** (not for this harness);
**deferred** is native later. The 48 v4.2.0 constants, plus `main`'s one:

| Their screens (v4.2.0 `model.go:578-634`) | Disposition |
|---|---|
| `Unknown` | n/a (sentinel) |
| `Welcome`, `UpdatePrompt` | native: our menu and update banner exist; slice 1 draws them first |
| `Detection`, `DependencyTree` | native: the Doctor detail screen (slice 3) and the install preview (slice 6) |
| `Installing`, `Complete` | native: the run and result screens (slice 1) |
| `Review` (what an install will write) | native: the install and `init` preview (slice 6) |
| `SkillPicker`, `CommunityTools`, `CommunityToolInstalling`, `CommunityToolResult` | native: multi-select over the skills we ship and the stack's tools (slice 2), run through the run screen |
| `Upgrade`, `Sync`, `UpgradeSync` | native: our Update and Upgrade items exist; the complements update through `stack` (slice 2) |
| `UninstallMode`, `Uninstall`, `UninstallComponents`, `UninstallConfirm`, `UninstallResult` | native: our four uninstall kinds exist |
| `UninstallEngramScope` | excluded: engram's data is never ours to remove |
| `Backups`, `RestoreConfirm`, `RestoreResult`, `DeleteConfirm`, `DeleteResult`, `RenameBackup` | deferred: native backups are "Later" |
| `Preset` | native: our presets (complete, lean, custom; G14) as a multi-select (slice 2) |
| `Agents`, `Persona` | excluded: one host, one style file |
| `ClaudeModelPicker`, `KiroModelPicker`, `CodexModelPicker`, `ModelPicker`, `ModelConfig` | excluded: our routing is `rule:subagent-*-model` |
| `InstallReviewMode`, `ReviewMode`, `ReviewStoreResetConfirm`, `ReviewStoreResetResult` | excluded: RDD leaves |
| `AgentBuilderEngine`, `…Prompt`, `…Generating`, `…Preview`, `…Installing`, `…Complete` | excluded: no agent builder |
| `OpenCodeBackground`, `PiBackground`, `OpenCodeSDKConfirm` | excluded: hosts we do not run |
| `ShellInstall` (`main` only) | excluded |

Cross-cutting pieces: alternate screen, resize, key parser, run ids → slice 1; multi-select →
slice 2; colour → slice 5; their logo and rose art → excluded (trademark); their confirm cursor on
the destructive row → not copied.

**The slices, in order** [sizes i]:

| # | Slice | Code lines |
|---|---|---:|
| 1 | Terminal guard, frame model, key parser, run screen with outcomes, action-level relay, first draw (4.5) | ~400 |
| 2 | Multi-select for `functions`, `stack install` (the complements) and the skills `install` writes; each selected action still asks its own y/N | ~250 |
| 3 | Doctor detail screen: each row, its evidence and its fix command | ~150 |
| 4 | Scrollable read-only views: `progress`, `sessions`, `codex-meter`, `failures` | ~250 |
| 5 | Palette that honours `NO_COLOR` | ~100 |
| 6 | Preview of what `install` and `init` will write, before they write | ~200 |
| later | Native backups | ~200 |

About 1.35k code lines through slice 6, plus tests; each slice is a work unit with its own walk.

### 4.7 Completion boundary and dependency map

**Done** when slices 1-6 are merged, each with its real-console walk recorded by him, and every
screen of 4.6 is native, excluded or deferred as listed there. Native backups stay "later", outside
the boundary. Slice 1 is PR jsaristi/js-harness#596; every later slice builds on its frame, key
parser and run screen, so none starts before it merges.

| Slice | Depends on, besides slice 1 | Can start |
|---|---|---|
| 2 Multi-select | S11's presets (G14) and the stack rows for engram and context7 | after S11 |
| 3 Doctor detail | the `doctor` rows S1 (review debt), S10 (permissions) and S11 (complements) add; it shows whatever rows exist | after slice 1 |
| 4 Read-only views | the commands it shows exist today | after slice 1 |
| 5 Palette | slice 1's frame only | after slice 1 |
| 6 Install and `init` preview | S12's migration, whose writes the preview lists | after S12 |

Slices 3, 4 and 5 can run beside F8 in their own session; when is G3.

## 5. The idea watch (S9)

gentle-ai's repository stays a source of ideas, read on each release; nothing is installed.

**On each stable release**, against the last release read:
1. **The source diff by area.** On a pinned clone (`~/.js-harness/upstream/gentle-ai`, fetch only,
   recorded in the machine manifest so `uninstall machine` removes it; never built or run), it
   buckets `git diff --numstat v<last read> v<new>` by an `AREAS` table of real repository paths:

   | Area (paths in the gentle-ai repository) | What we look for |
   |---|---|
   | `internal/assets/*/orchestrator.md`, `internal/assets/skills/_shared/odd-*`, `internal/components/agentguidance/**` (prompt text is Go literals, so the asset digest misses it) | workflow ideas: against our `CLAUDE.md` lines and diet §3, §5 |
   | `internal/reviewtransaction/**`, `internal/reviewerprovider/**`, `internal/providercontractbundle/**`, `internal/consentenvelope/**`, `internal/components/reviewassets/**`, `contracts/**` | review ideas: against our review flow (S1) and lens agents |
   | `internal/assets/claude/output-style-*`, `internal/assets/claude/persona-*`, `internal/components/persona/**` | voice changes: against our style's copy |
   | `internal/assets/skills/**`, `skills/**`, `internal/components/skills/**` | changes to the two skills we copied, by name |
   | `internal/assets/claude/agents/**` | changes to the four lens prompts we ported at S1 |
   | `internal/components/permissions/**` | changes to the permission defaults we took over (S10) |
   | `internal/components/mcp/**` | how they register MCP servers (engram, context7), against our stack rows |
   | `internal/components/engram/**`, `internal/components/agenthooks/**`, `internal/components/telemetryruntime/**`, `internal/telemetry*/**` | how they install and wire the complements we now own |
   | `internal/tui/**` | screens and behaviour to port (section 4) |
   | `internal/backup/**`, `internal/state/**`, `internal/managedownership/**`, `internal/components/filemerge/**`, `internal/components/uninstall/**`, `internal/update/**`, `internal/cli/**` | install and undo ideas against our manifest |
   | `internal/shellinstaller/**`, `internal/opencode/**`, `internal/components/{gga,theme}/**`, `internal/assets/{antigravity,codex,cursor,gemini,generic,hermes,kimi,kiro,qwen,windsurf,opencode}/**`, `bench/**`, `e2e/**`, `testdata/**`, `docs/**`, `odd/**`, `README.md`, `.goreleaser.yaml` | ignore (`bench` and `docs` read for evidence) |

   **Unmatched paths are never dropped**: a changed path that matches no row is listed as
   `unmatched` and classified by hand; the row it earns is added to `AREAS` in the same commit.
2. **A verdict per change**: **adopt-into-ours** (becomes a task in the roadmap, measured by its own
   step like any change), **adapt** (the idea, rewritten for our needs), or **ignore**, each with its
   evidence (file, lines).
3. **The record.** A release with any verdict other than `ignore` gets its own section in
   `odd/tasks/gentle-ai-update-check.md`, committed. Releases with only `ignore` are batched: one
   line each, committed with the next non-`ignore` record or at month end.

**Where it lives.** `bin/lib/gentle-ai-update.mjs` today watches the *installed* version and its
backups (`:36-39`, `:57-75`) [c]. After S2 that has nothing to read: the module becomes the idea
watch, which reads the newest stable tag by `git ls-remote --tags` and the last one read from the
record, and the `doctor` row says "N releases not yet read". It spends no eval money: an adopted
idea is measured when its own step lands.

**Pace.** 23 stable releases between 2026-09-01 and 2026-10-15 and three majors in 11 weeks
(`git tag` on the clone) [c]; unreleased `main` carries 322 commits and +57.6k lines, +8.8k in
`internal/tui` (`git diff --shortstat v4.2.0 HEAD`) [c]. Track stable releases; read `main` only
for the TUI.

## 6. The target, and the order

**Layers, bottom to top:**
1. **Host (Claude Code):** skills, hooks, `/goal`, Monitor, SendMessage, compaction, permissions.
   We build on it, never beside it (diet §6).
2. **js-harness:** the workflow text (`CLAUDE.md`, importing `AGENTS.md`), our output style, our
   skills, checks and hooks (`check`, `guard`, `reply`, `resume`, the rules delta, `backup`), the
   review flow (Codex and the Claude lenses on every slice), the session commands, `doctor` and
   `stack`, the idea watch, the TUI.
3. **Complements, installed and registered by js-harness's `stack`:** engram (and its plugin),
   codegraph, context7.
4. **Records:** the repo is canonical (roadmap, `odd/tasks/`, `docs/RULES.md`); engram and
   `MEMORY.md` mirror it or point to it.

**What a turn loads after removal** (diet D4): 105.5k today − 30.7k (H) − 0.5k and 0.3k (gentle-ai's
skill and agent descriptions, chars/4) + 1.8k (the S3 lines, Claude's count) ≈ **75.8k**, with our
style the same size as `gentleman.md` (1.8k). A shorter style lowers it; each copied skill adds back
its description, under 0.1k each. The S10 port adds to `CLAUDE.md` only what the A.1 lines do not
already hold, and S3's budget row counts it.

**What removal breaks in js-harness, and fixes first (S1, S11):** 32 source files and 51 test files
under `bin/` name gentle-ai [c, `grep -rl`]; the heaviest are `bin/lib/stack.mjs` (28 lines),
`bin/lib/gentle-ai-update.mjs` (16), `bin/check.mjs` (16, its `review` row runs `gentle-ai review
mode status`, `:1721-1733`), `bin/doctor.mjs` (15) and `bin/lib/stack-install.mjs` (12).
`AGENTS.md` names gentle-ai on 7 lines (4, 19, 25, 30, 51, 57, 59). The stack's fixes for engram
(`gentle-ai upgrade`, `gentle-ai sync`) and codegraph's project fix (`gentle-ai codegraph init`)
point at the tool that leaves. Under `evals/`, 20 files name it (`grep -rl gentle-ai evals`) [c],
among them `evals/arms.mjs:23-47` (the arms that load its block) and `evals/home.mjs:238` (which
copies `.gentle-ai/state.json` into the eval home); S11 sweeps `bin/` and `evals/` together. The
`bin/` counts take a file as a test by its `*.test.mjs` name.

**The order** (diet §10, seventh pass): S0 baseline → **S3** (the `CLAUDE.md`/`AGENTS.md` split,
D3, and an interim `claudeMdExcludes` of gentle-ai's global file in this repo that banks ~30.7k at
once; undone by reverting its commit) → **S1** (both reviews on every slice, G9: the lens prompts
ported and their runner built) → **S10** (port: our style, the ODD sizing text, two skills, the
whole `permissions` object) → **S11** (the stack takes over engram, codegraph and context7, with
presets; `bin/` and `evals/` stop naming gentle-ai) → **S13's rehearsal** (a scratch project from
`init` to its first reviewed slice, comparing only the files js-harness owns) → **S12** (the
migration of an existing project built, tested on a copy of an old one, then his listed projects
moved) → **S2** (writers quiesced, one full backup and a restore drill that proves engram answers,
then gentle-ai, Orca and herdr removed, each asked first; the interim exclusion reverted; a short
smoke test on the scratch project; every session restarts) → measure → S4a, S4b, S5, S6, S7 → S8.
S9, the idea watch, any time after S2. Every step says what reaches a project (section 11).

**The TUI is its own feature,** not an F8 step: slice 1 is PR jsaristi/js-harness#596, open and not
merged, its walk left to him; the rest is bounded and mapped in section 4.7 and waits for G3.

## 7. His decisions raised here (G1-G14)

Each is one question, asked at the step the register names (diet §1), with the recommended default
first. Four are closed by his words of 2026-10-26 ("gentle-ai tampoco", line 2272); G9 by line
2351; G10 and G11 by line 2466: "la 7 la voz hazlo en neutro osea que no copiemos eso y el context7
siempre va a encendido en los proyectos, de resto rodo me parece excelente y que esta bien y que lo
coloquemos todo" (2026-10-27T01:34Z, 20:34 local on the 26th).

Which are **blocking** and which are taken **by default** is in the diet's register (§1): a
blocking one (G3, G7, G12) is asked before its step, one at a time; a by-default one (G2, G8, G10n,
G14) is taken by the lead with the default below and recorded, and he can reverse it.

- **G1. Telemetry.** Closed: it leaves with gentle-ai.
- **G2. TUI approach.** Default: **(a)**, the design ported to zero-dependency Node. (b) breaks the
  zero-dependency rule; (e) is gone.
- **G3. TUI priority against F8.** Blocking. Slice 1 (the shipped defects) is PR
  jsaristi/js-harness#596, open and not merged, its real-console walk left to him. Open: the rest
  (section 4.7). Default: **beside F8, in its own session, after #596 merges**; asked then.
- **G4. The skill-registry prompt hook.** Closed: it leaves with gentle-ai.
- **G5. gentle-ai skills to hide here.** Closed: replaced by G8, since nothing of theirs stays
  installed.
- **G6. GGA.** Closed: it leaves with gentle-ai; `~/bin/gga` and any project hook of it go at S2.
- **G7. Recurring certification spend.** Blocking (spend). The idea watch spends nothing per
  release, and an adopted idea is measured by its own step. What costs is certification rerun on
  each new model or CLI update (diet §7.2). Default: **at most one certification a week, batching
  updates, about $25 each, at most $100 a month**, outside F8's $200 envelope. Asked after S8.
- **G8. Which skills to copy.** Default: **the two of section 3 that serve a stated need**
  (`work-unit-commits`, `chained-pr`), by his rule of line 2646; the four lens agents are copied by
  G9, at S1. By default: taken at S10 and recorded.
- **G9. The review.** **Answered** (line 2351): both reviews on every candidate, always. Codex is
  the second model; the Claude review runs our copies of the four lenses, one to four picked by what
  the change touched, each in a fresh context; no risk tier skips either. Its cost per slice is
  measured at S1 and counted in the plan's spend line (diet D2).
- **G10. The persona.** **Answered** (line 2466): our own style, our own name, neutral Spanish
  with tú; gentle-ai's voseo and Rioplatense register are not copied. Installed at user level by
  `js-harness install` and recorded, so every project gets it. Its name is taken by default
  (G10n): **`js-harness`**, recorded at S10; he can change it.
- **G11. context7.** **Answered** (line 2466): always enabled in projects. `init` enables it, a
  `doctor` row flags a project where it is disabled, and this repo turns it on: today it is
  disabled here (`~/.claude.json`, `projects["D:/js-harness"].disabledMcpServers`; `claude mcp
  list`) [c]. Its instructions then load every turn; S3's budget row counts them.
- **G12. What his other projects load once H is gone.** Removal takes his Rules list and ODD text
  out of every project. Default: **`js-harness install` writes one small block of his Rules lines
  (as D7 settles them) into `~/.claude/CLAUDE.md`, recorded so `uninstall` removes exactly it**;
  each project gets the rest from `js-harness init` (S12).
- **G13. When a review cannot run.** Decided by the lead (2026-10-26), for his "revision siempre":
  `--unavailable <reason>` (for either reviewer) lets the push through, but the skip is a **debt**:
  a `check` row and a `doctor` row list each skip without a later complete review, and the merge
  path (`js-harness merge-queue`) refuses a PR whose commits hold one. All three are **to build**
  at S1.
- **G14. The presets' names.** By default. Copied from gentle-ai's presets idea. Default:
  **complete** (engram, codegraph, context7, the two reviews, the split), **lean** (the same
  without codegraph), **custom** (may add or drop codegraph and the engram plugin, never context7
  or the reviews). Taken at S11 and recorded.

## 8. His request, verbatim

"hagamos una investigacion mucho mas profunda de lo que va lo que no, lo que vamos unir con lo que
tenemos nosotros y como debe quedar bien y en orden mejor dicho todo, y necesito traerme todo el
sistema completo de tui que tiene gentle-ai por que el de nosotros es muy sencillo y no funciona
como el de gentle-ai osea debemos tambien a medida que gentle-ai se actualice por que es una buena
base, poderlo analizar y ver que se puede mejorar frente nuestra investigacion y necesidades y
mejoras que nosotros apliquemos osea es una una ingenieria inversa tambien y ademas con nuestra
mejora y necesidades" (2026-10-26, relayed by the lead).

Read as needs, not as a spec: (1) a verdict per component and the target, in order (sections 3
and 6); (2) a TUI as capable as gentle-ai's, every screen accounted for (section 4.6); (3) a
repeatable re-analysis on each gentle-ai update (section 5). His direction of the same evening (top
of this document) changes the verdicts from exclude to replace.

## 9. Grades

The third blind grade of the package (the diet's fourth pass with this document) gave Claude 6.4
and Codex 7.0. The fifth pass then split S9, put S9a before S2, took a full hook inventory, made one
decision register, mapped every TUI screen, and named the paid checkpoints. Most of what it built
for an installed gentle-ai is superseded by the direction above; the hook inventory, the register,
the TUI map and the checkpoints carry over.

The sixth pass was graded blind in turn: **Claude 6.4, Codex 6.0**. The seventh pass (section 12)
is the one correction batch after it; a recheck limited to its items follows.

## 10. Sixth pass: replace (2026-10-26)

His direction change, not a grade, drove this pass. What changed: a "Direction" section at the top
with his words; the matrix redone as copy, take over, keep or drop, with a verdict per skill and
agent and the license each copy carries; the TUI without option (e), every screen native or
excluded, six slices; S9 turned into an idea watch that installs nothing; the order rebuilt around
porting first and removing last; the permission deny list kept and taken over; presets copied as an
idea (G14); GGA and the theme dropped; and, by his rule of line 2646, a stated need on every "copy"
(four skills and the Risk line moved to drop); the first-turn load recomputed (≈75.8k); four G decisions closed
by his words and new ones G8-G13. Then, from his later words the same evening: G9 answered (two
reviews on every slice, always), G10 and G11 answered (neutral voice; context7 always on in
projects), removal planned machine-wide with a full backup, a restore drill and a cut point, Codex's
side and engram's data covered, and section 11 added: how a project works with js-harness.

## 11. How a project works with js-harness

His words: "recuerda que todo este mismo trabajo es como va a trabajar el arnes en los proyectos"
(line 2382). What this plan decides here is what every project gets. A project's whole life with
js-harness, from nothing to its first reviewed slice; each write is recorded so it can be undone
(`uninstall project`, `uninstall machine`, or git). Items marked **to build** do not exist yet;
the step that builds each is named.

### 11.1 From `init` to the first reviewed slice

| # | He runs | What it writes or does | Undone by | Built at |
|---|---|---|---|---|
| 1 | `js-harness install` (once per machine), with a preset (G14) | our skills and the four lens agents (ported at S1, reading our packaged input) under `~/.claude`; the whole `permissions` object we took over (the 24 denies among it); our output style (neutral voice, G10); the small Rules block in `~/.claude/CLAUDE.md` (G12); the session hooks (13 today); the Codex review home. All in the machine manifest | `uninstall machine` | skills and hooks exist; lens agents **to build** (S1); style, Rules block and permissions **to build** (S10) |
| 2 | `js-harness stack install` | engram and its plugin, codegraph and context7, each installed and registered by js-harness itself, each asked y/N, each with its undo printed and recorded | `uninstall machine` (undoes what `stack install` ran) | codegraph exists; engram and context7 as required rows **to build** (S11) |
| 3 | `js-harness init` in the project | `harness.json`, `AGENTS.md` (what a reviewer needs), the root `CLAUDE.md` importing `@AGENTS.md` with the kept lines (S3), `docs/FAILURES.md`, the pre-commit gate, the pre-push check, the codegraph index (`codegraph init`), context7 enabled for the project (G11), the deny list in the project's settings, the project's output style choice | `uninstall project` | most exist; `CLAUDE.md`, context7 and style **to build** (S3, S11, S10) |
| 4 | a session opens | it loads the project's `CLAUDE.md` and `AGENTS.md`, our style and skill descriptions, engram's, codegraph's and context7's instructions: about 75.8k on the first turn here (section 6), less in a small project | — | measured at S3, at S13 and after S2 |
| 5 | he asks for a feature | the session sizes it; large work opens `odd/tasks/<feature>.md` with the task contract first (`js-harness contract template`), specs quoting him, tasks and a log, mirrored in engram | git | exists |
| 6 | the session commits a work unit | pre-commit runs `check` | — | exists |
| 7 | the slice is reviewed | `js-harness codex-review --base <boundary>` records Codex's review; the Claude lens runner packages the slice's commit range, runs one to four picked lenses in fresh contexts, rejects an incomplete result and records each complete one with the range's subject hash (diet §10, S1) | records live in the git common dir | Codex exists (it gains the range and hash at S1); the runner **to build** (S1) |
| 8 | he pushes | pre-push refuses a code commit not covered by a complete Codex record and a complete Claude record of the same head commit and subject hash, or by a recorded skip; an amend or rebase changes the head commit and the range is unreviewed again. A skip is a debt: `check` and `doctor` list it, and the merge path refuses the PR until it has its review (G13) | — | Codex half exists; the Claude half, invalidation and the debt rows **to build** (S1) |
| 9 | updates | `js-harness update`/`upgrade` bring the harness; `stack` brings the complements. An initialized project is **not** refreshed today: `update` only reports a newer release (`bin/update.mjs:373-397`) and `init` again writes nothing but a codegraph retry (`bin/lib/project.mjs:1062-1091`) [c]; the migration S12 builds brings it to the current version, keeping his edits | the manifests | harness update exists; complements **to build** (S11); the migration **to build** (S12) |

Nothing of gentle-ai, Orca or herdr takes part at any step.

### 11.2 Moving a project that used gentle-ai (S12)

Every project on this machine read gentle-ai's global file and ran its hooks. After S13's rehearsal
and before removal, each listed project is moved, one at a time, by him or a session he names:
1. **The migration S12 builds** (neither `init` nor `update` refreshes an initialized project
   today) brings the project to step 3 above: it reads the version its manifest recorded, writes
   what later versions add (the `CLAUDE.md` split, context7, the deny list, the two-review
   pre-push check), keeps his edits (a file he changed is merged or left with a note, never
   overwritten) and records each write so `uninstall project` undoes exactly it. It is tested
   first on a copy of a project initialized by an old release.
2. A read-only scan lists what gentle-ai left in the project: `.atl/` (the skill registry), its
   review store under the git common dir, and any `odd/` documents. Documents stay (they are the
   project's); `.atl/` and the review store go by git or by hand, each named first [i: the exact
   per-project paths come from gentle-ai's source and are confirmed by the scan].
3. A session started there shows, in `/context`, the project `CLAUDE.md` and no gentle-ai block
   (after S2).
The list is frozen in the feature document before the first move: projects with a js-harness
manifest or with a Claude Code session in the last 30 days (`~/.claude/projects`). A project not
moved keeps working after removal, only without ODD text until the migration runs there.

### 11.3 Day to day, once gentle-ai is gone

Short, and checked on S13's scratch project before his projects move, and again by the smoke test
after removal. S13 compares, before and after each step, only the files js-harness owns (the paths
its manifests record), never feature work or review records:
- **Starting:** `js-harness init` once per project; `js-harness` with no arguments opens the TUI:
  the stack's state, Doctor with each row's fix, Update, and the run screen for anything it starts.
- **Working:** ask for the outcome; large work gets its feature document; each work unit is a
  commit with its tests.
- **Reviews:** each slice gets Codex and the Claude lenses; their records sit beside the repo's git
  data, `js-harness throughput` counts them per day, the pre-push gate says which slice is
  missing one, and `check` and `doctor` list each skip still owed its review.
- **When something is off:** `js-harness doctor` names the row and its fix; `js-harness
  uninstall project` undoes `init` exactly.

## 12. Seventh pass: graded and corrected (2026-10-26)

Blind grades of the sixth pass: Claude 6.4, Codex 6.0. Each finding was checked against its source
before anything changed; the diet's section 19 has the whole list. Here:
- **Order:** the lens prompts are ported in S1, which builds their runner; S13 rehearses on a
  scratch project before S12 and S2, comparing only js-harness's files, with a smoke test after
  removal (sections 6, 11).
- **Removal:** writers quiesced first; the whole `permissions` object backed up and restored (its
  removal checked on the v4.2.0 tag); the complements' MCP entries backed up; a restore drill that
  must answer `mem_search`; the EngramScope framing corrected; the undo path with the module's
  `/v4/cmd/` path (sections 0, 3).
- **Interim exclusion:** S3 excludes gentle-ai's global file in this repo; S2 reverts it (top,
  section 6).
- **Existing projects:** `update` and a repeated `init` write nothing today; the migration is a
  capability S12 builds (section 11).
- **Reviews:** a commit-range candidate, incomplete results rejected, invalidation on a changed
  hash, skips as a debt the merge path enforces (sections 3, 7, 11).
- **Only what serves:** the Risk line and the voice are not copied; the presets are ours (complete,
  lean, custom), every one with context7 and both reviews (sections 0, 3, 4.6, 7).
- **His load:** the register splits blocking from by-default decisions; G10n's default is
  `js-harness` (section 7).
- **The TUI:** slice 1 is PR jsaristi/js-harness#596, open and not merged, its walk left to him;
  section 4.7 gives the completion boundary and the dependency map.
- **The idea watch:** `AREAS` gains the Claude agents, permissions and MCP paths (section 5).
- **`evals/`:** 20 files name gentle-ai and S11 sweeps them with `bin/` (section 6).
- **Rejected:** Claude's count of 31 source and 52 test files under `bin/` (taking a test by its
  `*.test.mjs` name gives 32 and 51), and its 21 files under `evals/` (`grep -rl gentle-ai evals`
  gives 20).

Limited recheck of `18785956`: Claude 7.4, Codex 8.0. The residuals (the review identity now
holds the head commit too, the GitHub web merge named as open, who runs S2's first steps, per-entry
failure assignment) are fixed in the diet's section 19 and sections 3 and 11 here.

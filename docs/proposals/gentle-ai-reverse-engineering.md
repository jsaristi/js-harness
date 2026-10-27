# gentle-ai, reverse-engineered: what stays, what goes, what merges

Status: proposal, 2026-10-26, part of F8 (`docs/ROADMAP.md`). It answers his request of the same
day, quoted in full in section 8. It sits beside [the harness diet](harness-diet.md) ("the diet"
below), which stays the plan of record; this document replaces the diet's S9 text and adds the TUI.

Sources: the installed binary gentle-ai 4.2.0 (`gentle-ai --help`); its MIT source, read-only, at
tag v4.2.0 and `main` 2b56327e ("G" below); what it installed on this machine (`~/.claude`,
`~/.gentle-ai`, read only); and this repo. "H" is `~/.claude/CLAUDE.md`. Each claim is marked
**[c]** when checked with the path, line or command cited, or **[i]** when inferred. Nothing outside
the repository was changed. Dates are local (America/Bogota).

IDs: **G1-G7** are his decisions raised here; **D1-D9** are the diet's. Both live in one register,
[the diet's section 1](harness-diet.md#1-what-is-his-to-decide); section 7 below gives the G
decisions' reasons.

## 0. The answer, short

- **Keep gentle-ai as the stack installer and the review engine.** Its ideas are good and its
  review CLI is the best part. What does not fit is how it delivers them here: 91.6 KB of
  always-on prose written for the weakest of 17 hosts, which the diet's S2 stops loading in this
  project.
- **Nine things are paid twice.** S2 removes gentle-ai's prose layer of six of them (H's blocks);
  the other layers of those six (MCP instructions, hooks, skill descriptions, `AGENTS.md:50-60`)
  and the other three stay, handled by rows in `check` and `doctor`, not by more prose.
- **The TUI.** Port gentle-ai's *design* to zero-dependency Node in `bin/tui.mjs`, and add one
  menu item that hands the terminal to `gentle-ai`'s own TUI for its own screens. Section 4.6 maps
  every screen of theirs to native, delegated, excluded or deferred, in seven sized slices. Causes 1
  and 2 are defects in shipped behaviour and can be fixed now as a defect task; the full TUI waits
  for G3.
- **Following each update.** S9 is split. **S9a lands before S2**: it diffs the installed files by
  marker and hook, probes the review contract, catches a same-version sync, and withholds the
  review record while anything conflicts. It detects after an install; it does not stop a sync
  from re-adding hooks. **S9b** adds the source diff by area and the per-release record, any time.
- **Sixteen decisions are his, in one register** (diet section 1), each with a recommended default
  and the step that asks it.

## 1. What gentle-ai is

"The deterministic engineering environment for the AI agent you already use": it configures an
agent, never ships one, and gives it "memory, a workflow, and evidence" (G `README.md`) [c]. It
targets 17 hosts (the README badge says 18) [c]; on this machine it manages Claude Code, Codex and
Antigravity (`~/.gentle-ai/state.json`, `installed_agents`) [c].

**Design ideas worth keeping** [c, G `docs/intended-usage.md:10-28`]:
1. **The ODD feature document.** Small work stays inline and leaves no artifact; large work gets
   one `odd/tasks/<feature>.md` with specs that quote the user verbatim, a task list and a log.
   This repo already uses the folder and most of the format (diet §3 row 1: 77 of 111 docs carry
   `## Specs`).
2. **Delegate for a named reason, not for size.** A subagent is spawned for a map, a parallel
   writer or a verifier of a named high-risk item. It matches Cognition's "one writer, read-only
   helpers" (diet §6).
3. **Review of a frozen candidate, run by a Go binary.** The review engine
   (`reviewtransaction`, 36.8k source lines and 39.3k test lines) freezes the candidate, binds
   lineage and target, and returns the next command as data (`next_transition`). The model does
   not have to remember a protocol; it runs what the binary returns. That is the shape the diet's
   S1 driver relies on.
4. **Prompts pinned by tests.** Prompt text has sha256 goldens and drift ratchets
   (`agentguidance/routing_golden_test.go:30`, `assets/orchestrator_drift_ratchet_test.go:83`)
   [c]. Our rules have `rules check`; the golden idea applies to the S3 kept lines (section 6).

**Tuned for other hosts or models, not for Claude Code on Opus 5.5:**
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

## 2. What it costs every turn here

**The global file.** H is 92.6 KB in 613 lines; 91.6 KB of it is gentle-ai's [c, byte count per
marker block]:

| Block | KB |
|---|---:|
| `orchestrator` (delegation 25.6, review lifecycle 27.9) | 53.5 |
| `agent-routing` (ODD), with `remote-authorization` inside | 29.2 |
| `codegraph-guidance` | 4.1 |
| `engram-protocol` | 2.6 |
| `persona` (it holds his Rules list) | 2.2 |
| **Total** | **91.6** |

Claude Code counts the file at 30.7k tokens (diet §2). It loads in every subagent except the
built-in Explore and Plan.

**Beside it:**
- The output style `gentleman.md`, 7.1 KB, about 1.8k tokens per request [c].
- **Telemetry is on by default.** `gentle-ai telemetry status` answers "enabled (source:
  default)" [c]. It is remote and opt-out, and on each `Stop` its Claude adapter reads up to 512 KB
  of the transcript (G `internal/telemetry/runtime_claude.go:16`) [c]. `gentle-ai telemetry
  preview` shows the payload without sending it (`gentle-ai --help`) [c]; nobody has run it yet,
  which is why G1 asks him to read it first.

**Every hook, by event and owner** [c, `~/.claude/settings.json` read 2026-10-26: 32 command
entries]. Each entry is a process start on Windows on every firing.

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

- Orca's twelve all run `~/.orca/agent-hooks/claude-hook.cmd`; herdr's one is a PowerShell script
  under `~/.claude/hooks`, on `SessionStart` (startup, resume, clear, compact, fork).
- The engram plugin's prompt hook comes on top, from a plugin, not from `settings.json` (diet §2).
- A `gentle-ai sync` re-adds any of its five that is missing (G
  `internal/components/agenthooks/claude.go:58-71`; for the registry hook,
  `skill_registry.go:132-145`) [c], so deleting one by hand does not stick.
- **codegraph's prompt hook still starts on every prompt here.** `CODEGRAPH_NO_PROMPT_HOOK=1` in
  `D:\js-harness\.claude\settings.local.json` silences its output, but the entry is registered in
  his user settings, and only a started process can read the variable [c: the entry; that it then
  exits silently is i].

**The nine places both stacks pay twice** (from the crossing; corrected here):
1. **Memory protocol, four layers:** the engram block, engram's MCP instructions, the
   `engram:memory` "ALWAYS ACTIVE" skill description, and the engram plugin's prompt hook (~0.4k
   per prompt, diet §2).
2. **Code graph guidance, three layers:** the 4.1 KB block, codegraph's MCP instructions, and its
   prompt hook, silenced here but still started on every prompt (above).
3. **Skill discovery, two layers:** the host lists skill descriptions (~3.2k), and gentle-ai's
   prompt hook starts a PowerShell and a `gentle-ai skill-registry refresh` on every prompt. That
   scans the skill folders and fingerprints them each time, and writes `.atl/skill-registry.md`
   only when the fingerprint changed (G `internal/skillregistry/registry.go:120-131`) [c]. Only its
   own orchestrator prose tells anyone to read that file.
4. **Persona, two layers:** the block (~0.5k) and the output style (~1.8k).
5. **Delegation triggers, written twice inside gentle-ai's own blocks:** H:219 and H:546 [c].
6. **Review guidance, three places:** 27.9 KB of lifecycle prose, `AGENTS.md:50-60`, and the
   stop-hook's message. The two review *engines*, gentle-ai and Codex, are deliberate (D6).
7. **The `Stop` event starts six command hooks from three owners** (table above). The latency is
   unmeasured [i].
8. **The model of a subagent is set in two places:** `claude_phase_assignments` in
   `~/.gentle-ai/state.json` and our `rule:subagent-*-model` rules [c].
9. **Two doctors.** A choice of aggregator, not a per-turn cost.

S2 removes H's layer of items 1 to 6 for this project. The MCP instructions, the hooks, the skill
descriptions and `AGENTS.md:50-60` stay, because `claudeMdExcludes` reaches only instruction files
(diet §10). One correction to the crossing: `go-testing` and `gentle-ai-bench` do not load their
descriptions here; they are `user-invocable-only` in the same `settings.local.json` [c].

## 3. The matrix

Verdicts: **keep ours**, **adopt theirs**, **merge** (saying how), **drop** (here), **later**.

| Function | gentle-ai | js-harness | Verdict and reason |
|---|---|---|---|
| Workflow (ODD) | 82.7 KB of always-on prose: ODD protocol, Task Size, delegation triggers, `odd/tasks/` | contract first, checked by `check`; `odd/tasks/` | **Merge.** Keep ODD's folder and document format, and contract-first as the check. Drop the prose here (S2); keep the A.1 lines (S3) |
| Review | Go review engine, `review-*` agents, 27.9 KB of lifecycle prose, stop-hook | pre-granted consent (`AGENTS.md:50`), `codex-review`, pre-push refusal | **Merge.** Their engine, our driver (S1, `js-harness review`); drop the prose; keep Codex as the second reviewer (D6) |
| Memory | installs engram, writes its block | `memory` hygiene, `backup`, `MEMORY.md` rules | **Keep engram as the tool, ours as the policy.** The repo is canonical (S5); drop the block (S2) and the prompt hook (D8) |
| Code graph | `codegraph init`, guidance block, MCP setup | `functions apply`, the doctor row | **Adopt theirs for setup**, codegraph's MCP for runtime; drop the block (S2) |
| Sessions across windows | none (its "orchestrator" is one session) | sessions, notify, wait, wake, loop, remote, permit, merge-queue, quiet | **Keep ours**, trimmed against host features (diet §6) |
| Hooks | 5 entries | 13 entries; Orca 12, herdr 1, codegraph 1 beside them | **Keep each owner's.** S4a adds a `check` row that counts entries per event and owner against the table in section 2, and fails on growth (section 6) |
| Rules and checks | prose; its gates are "informational/unmanaged" | 65 rules, `check`, pre-commit and pre-push | **Keep ours**; S5's rule pass |
| Persona and style | block plus `gentleman.md` | none | **Adopt the voice** in a project copy with three lines rewritten (S4b; D7) |
| Skills | 14 skills, plus the `.atl` registry protocol | 3 skills | **Merge.** Keep work-unit-commits, chained-pr, branch-pr, comment-writer; hide the irrelevant ones in project settings (G5) |
| Install and uninstall | backs up before every write; managed ownership | manifest; four named uninstall kinds | **Keep both, each for its own files.** js-harness never writes gentle-ai's file (`bin/lib/gentle-ai-update.mjs:2-3`) |
| Update | updates the tools it manages | `update`/`upgrade` for itself; `stack` and `doctor` print each tool's command | **Keep both**; S9 widened (section 5) |
| Doctor | bounded version probes | aggregates the stack, with `gentle-ai` and `gentle-ai-sync` rows | **Keep ours as the aggregator**; calling `gentle-ai doctor` from it is **later** |
| Telemetry | remote, opt-out, on by default | local measures only | **His decision** (G1) |
| Evals | `bench/` in Go; a before/after table (G `README.md:162-171`) | `evals/`; the S0 and S8 plan | **Keep ours**; borrow the before/after table for the S0 report |
| Multi-host | 17 hosts, 3 here | Claude Code, Codex for reviews | **Keep ours narrow.** Codex still loads gentle-ai's `~/.codex/AGENTS.md` (diet §11) |
| Model routing | `claude_phase_assignments` | `rule:subagent-*-model`, `contract modes` | **Ours for routing** (S7); theirs only for its review agents |
| Permissions | 24 deny rules on credential paths | `guard` PreToolUse | **Keep both**: complementary |
| GGA, theme, context7 | installed | none | Keep context7; theme irrelevant; **GGA is his decision** (G6) |
| TUI | a full installer, Bubble Tea: 48 screens at v4.2.0 | `bin/tui.mjs`, a 544-line menu | **Merge by design, not code:** port the design to zero-dependency Node, and hand gentle-ai's own screens to its TUI (section 4) |

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
merged 2026-09-26). Under the scope freeze a defect in shipped behaviour may become a task (ROADMAP, "Scope
frozen"), so they can be fixed now as one defect task: slice 1's items 1, 2 and 4 below, about 250
lines. The full TUI is a new capability and waits for his priority (G3).

One thing ours does better: confirmation is an explicit y/N where anything else means no
(`:238-239`) [c]. Keep it.

### 4.3 What we need from theirs

Needed: alternate screen with full-frame redraw and resize; async runs with spinner, streamed log
and locked keys; a result screen with the exit code; a real key parser; a Doctor detail screen with
each row's fix command; multi-select for `functions` and `stack install`; a review of what
`install`/`init` will write before it writes; scrollable read-only views of our own (`progress`,
`sessions`, `codex-meter`, `failures`); a small palette that honours `NO_COLOR`. Not needed, because
gentle-ai owns them: persona, presets, model pickers, review mode, agent builder, Gentle Shell.
Later: backups. Section 4.6 maps each of their screens.

### 4.4 Five ways to get there

| Option | Cost | Zero dependencies | Windows | License and trademark | Upstream updates |
|---|---|---|---|---|---|
| **(a) Port the design to zero-dependency Node** | the seven slices of 4.6: about 1.4k code lines plus tests [i] | kept | Node puts the console in VT mode on Windows 10 1809+; this machine is 19044 [i] | ideas are free; no logo or rose art (G `internal/tui/styles/logo.go:9`) | read their screen catalog per release; no merge conflicts |
| **(b) Node with a library** (ink, blessed, terminal-kit) | fewer lines | **breaks** `AGENTS.md:16`; `package.json` has no `dependencies` [c] | ink is good; blessed is unmaintained [i] | MIT | unrelated |
| **(c) Fork their Go TUI** | 11.6k source lines at v4.2.0 welded to their internals (G `internal/app/app.go:13-30`); Go toolchain and per-OS release builds | breaks it | good | MIT, but forks "must use distinct primary names and branding" (G `TRADEMARKS.md:39`) [c] | worst: every release conflicts |
| **(d) Add our screens inside theirs** | needs an upstream PR: `Screen` and Community Tools are closed enums (`model.go:578-634`; `internal/model/types.go:229`) | n/a | n/a | their brand, their call | theirs |
| **(e) Hand the terminal to `gentle-ai`** from one menu item (stdio inherited, raw mode off) | ~20-40 lines, ~60 with the stale-row warning | kept | as (a) | nominative use only: "Open gentle-ai" (`TRADEMARKS.md:35`) | free: always their current TUI |

The MIT license covers the code; "Gentle AI", "Gentle-AI", "gentle-ai" and "Engram" are claimed as
trademarks of Alan Buscaglia (G `TRADEMARKS.md:3-9`) [c]; the file claims marks, not registrations.
Anything we ship uses our own name and branding.

**(e) and the update guard.** gentle-ai's Welcome menu offers "Upgrade", "Sync configs" and
"Upgrade + Sync" (v4.2.0 `internal/tui/screens/welcome.go:43-45`; `main` `:48-50`) [c]. Run from
(e), they would install a version S9 has not reviewed. While the `gentle-ai-sync` row is stale, (e)
does not open their TUI directly: it shows the row's reason and the commands that keep the reviewed
version, says in full that their Upgrade and Sync items bypass the review, and opens only after an
explicit y. Our own menu never offers gentle-ai's upgrade or sync.

### 4.5 Recommendation and first slice

**(a) plus (e).** It keeps the repo's one hard rule, it grows the reducer/render split we already
have instead of rewriting it, and it avoids a fork every release would break. Following gentle-ai's
TUI becomes reading three places at each tag (the `Screen` enum, the Welcome items, the key
handling) and porting what fits.

**Slice 1, about 400 code lines, tests first, touching only `bin/tui.mjs` and its tests:**
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
5. **Action-level authorization, unchanged.** A command that asks per action keeps asking per
   action: `stack install`'s `Run it? [y/N]` for each row (`bin/stack.mjs:223-241`) is shown in the
   run screen and only the key pressed is sent, as today's relay does (a `bin/tui.test.mjs` test
   asserts it). The TUI never substitutes `--yes --tool <id>`: `--tool` selects every mandatory
   dimension of that tool (`:208`) and `--yes` skips each row's question, so one yes would
   authorize rows he never saw.
6. **First draw before slow work:** draw at once, then fill in the update check and the stack block
   (cause 4).

**Acceptance.**
- Unit tests, written first, including **frame-level assertions**: every screen rendered at 40, 80
  and 120 columns and at a short height; no line wider than `columns`; no frame taller than `rows`;
  every warning's full text present across the frame's lines.
- A **manual walk checklist**, recorded with its results in the TUI feature document, because no
  test drives a real console (cause 6). In Windows Terminal and in conhost: open; resize to 40
  columns and back; run Doctor; run Update; run `stack install` answering one y and one N; ctrl+c
  during a run (result screen says cancelled, no child left in Task Manager); Esc back; q out;
  the terminal is usable afterwards.
- Risk: item 6 of the high-risk list partly applies, for the same reason.

### 4.6 Every screen of theirs, and where it goes

Dispositions: **native** (ours, in the slice named), **delegated** (opened in their TUI through
(e)), **excluded** (not for this harness), **deferred** (native later; delegated meanwhile). The 48
v4.2.0 constants, plus `main`'s one:

| Their screens (v4.2.0 `model.go:578-634`) | Disposition |
|---|---|
| `Unknown` | n/a (sentinel) |
| `Welcome`, `UpdatePrompt` | native: our menu and update banner exist; slice 1 draws them first |
| `Detection`, `DependencyTree` | native: the Doctor detail screen (slice 3) and the install preview (slice 7) |
| `Installing`, `Complete` | native: the run and result screens (slice 1) |
| `Review` (what an install will write) | native: the install and `init` preview (slice 7) |
| `Agents`, `Persona`, `Preset`, `SkillPicker` | delegated: gentle-ai's own configuration |
| `ClaudeModelPicker`, `KiroModelPicker`, `CodexModelPicker`, `ModelPicker`, `ModelConfig` | delegated: model routing for its review agents; ours is `rule:subagent-*-model` |
| `InstallReviewMode`, `ReviewMode`, `ReviewStoreResetConfirm`, `ReviewStoreResetResult` | delegated: RDD is his gentle-ai switch |
| `CommunityTools`, `CommunityToolInstalling`, `CommunityToolResult` | delegated |
| `Upgrade`, `Sync`, `UpgradeSync` | delegated, behind (e)'s stale-row warning (4.4); never native |
| `Backups`, `RestoreConfirm`, `RestoreResult`, `DeleteConfirm`, `DeleteResult`, `RenameBackup` | deferred: delegated now; native backups are "Later" |
| `UninstallMode`, `Uninstall`, `UninstallComponents`, `UninstallEngramScope`, `UninstallConfirm`, `UninstallResult` | delegated for gentle-ai's components; ours already has its four uninstall kinds |
| `AgentBuilderEngine`, `…Prompt`, `…Generating`, `…Preview`, `…Installing`, `…Complete` | excluded: no agent builder here |
| `OpenCodeBackground`, `PiBackground`, `OpenCodeSDKConfirm` | excluded: hosts we do not run |
| `ShellInstall` (`main` only) | excluded: Gentle Shell |

Cross-cutting pieces: alternate screen, resize, key parser, run ids → slice 1; multi-select →
slice 2; colour → slice 6; their logo and rose art → excluded (trademark); their confirm cursor on
the destructive row → not copied (our default-No y/N stays).

**The slices, in order** [sizes i]:

| # | Slice | Code lines |
|---|---|---:|
| 1 | Terminal guard, frame model, key parser, run screen with outcomes, action-level relay, first draw (4.5); items 1, 2 and 4 alone are the defect task | ~400 |
| 2 | Multi-select for `functions` and `stack install`; each selected action still asks its own y/N | ~200 |
| 3 | Doctor detail screen: each row, its evidence and its fix command | ~150 |
| 4 | Scrollable read-only views: `progress`, `sessions`, `codex-meter`, `failures` | ~250 |
| 5 | (e) "Open gentle-ai", with the stale-row warning | ~60 |
| 6 | Palette that honours `NO_COLOR` | ~100 |
| 7 | Preview of what `install` and `init` will write, before they write | ~200 |
| later | Native backups | ~200 |

About 1.4k code lines through slice 7, plus tests; each slice is a work unit with its own walk.

## 5. Following gentle-ai on each update

This section replaces the text of the diet's S9.

### 5.1 What breaks us

1. **The backup manifest shape:** `gentle-ai-update.mjs` reads `entries[].original_path`,
   `snapshot_path` and `created_at` (`:36-39`) [c].
2. **The path of H:** `payload.mjs` reads `~/.claude/CLAUDE.md` (`bin/lib/payload.mjs:235`) [c],
   and S2's `claudeMdExcludes` assumes it. No marker name occurs in `payload.mjs` [c]; S9a's
   installed-file diff is the first reader of the `<!-- gentle-ai:X -->` markers.
3. **The review CLI contract:** the `consent/v3` envelope and its `granted` invocation, which
   `AGENTS.md:50` relies on; `--contract …/v2`; flags such as `--lenses`; the provider contract
   version (1.4.0 in the v4.2.0 release notes) [c].
4. **Hooks:** a new or changed entry adds load or Stop behaviour; a sync re-adds removed ones [c].
5. **The persona and output style:** the `outputStyle` overlay and S4b's project copy.
6. **Skills overwritten in `~/.claude/skills`**, including ones our rules call
   (`work-unit-commits`, `chained-pr`).
7. **`state.json` keys.**
8. **Rule text that newly contradicts `AGENTS.md`:** the silent kind. 4.1.1 → 4.2.0 did it
   (`odd/tasks/gentle-ai-update-check.md`, Why) [c].

The pace makes this a standing job: 23 stable releases between 2026-09-01 and 2026-10-15, and three
majors in 11 weeks (`git tag` on the clone) [c].

### 5.2 What S9 guarantees, and what it does not

S9 **detects after an install and withholds the review record**. It does not prevent anything: a
`gentle-ai sync` or upgrade writes H, the hooks and the skills whatever S9 says, and re-adds a hook
he removed (`skill_registry.go:132-145`, `claude.go:58-71`) [c]. So any hook removal here (G4) is
not made persistent; it is **checked on every run**: a re-added hook changes the installed
fingerprint, the row turns stale, and the notice says what came back. S2 keeps new prose in H out
of this project whatever happens; hooks, skills and the style reach it, and S9a is what makes that
visible before S2 lands.

### 5.3 S9a, before S2: the installed files, detect and refuse

In `bin/lib/gentle-ai-update.mjs`, as pure functions with fixtures, and no new command. Today the
row turns stale on a new version and lists manual steps (`:57-75`) [c]. It gains:

1. **An installed-file diff.** `claudeMdSnapshots` is generalized from H to every manifest entry
   under `~/.claude` (agents, skills, output styles); H is split by `<!-- gentle-ai:X -->` marker so
   the report names the block that moved and by how many bytes; the hook commands of the gentle-ai
   owner in `settings.json`, the `state.json` keys and `managed_asset_digest` are compared.
2. **A same-version drift check.** At each review the row records a fingerprint of all of the
   above. Every `doctor` run recomputes it; a different fingerprint with the same version (a sync,
   a reinstall, a re-added hook) turns the row stale just as a new version does.
3. **Contract probes, read-only, against the installed binary:** a diff of `gentle-ai --help`, of
   `gentle-ai review capabilities --contract gentle-ai.review-integration/v2`, and of the release's
   "Provider contract" line. Any change blocks the record until `AGENTS.md:50` and `codex-review`
   are rechecked.
4. **The contradiction check.** Lines added to a changed H block are matched against the
   contradiction list of diet §3, kept as data (ask-one-question, Lossless Blocking Prompt, push and
   PR human-only, verifier gates, attribution); a hit marks the block `conflicts`.
5. **Refuse.** While any item is `conflicts` without his acceptance, `doctor --gentle-ai-reviewed`
   refuses to record the version or fingerprint, and the row stays stale with the notice repeating.
6. **His acceptance, recorded** (to build): `doctor --gentle-ai-reviewed --accept <area> --quote
   "<his words>"`, one per `conflicts` item, writes the area, his words, the date and the transcript
   line into the record. Without his words it refuses.
7. **The way back**, printed, never run (both commands write his global config):
   1. `go install github.com/gentleman-programming/gentle-ai/v4/cmd/gentle-ai@v<reviewed>`. The
      binary here comes from `go install` (`~/go/bin/gentle-ai.exe`, the only one on PATH) [c], and
      that is the README's form (G `README.md:261`, module path from G `go.mod:1`) [c]. **PATH
      caveat:** `go install` writes to `GOBIN` or `~/go/bin`; if another install method ever puts a
      `gentle-ai` earlier on PATH, that one still runs. The fix prints `where gentle-ai` and asks
      for `gentle-ai version` to read the reviewed version before it counts.
   2. `gentle-ai restore <id>`, where `<id>` is the first backup taken after the reviewed record.
      The usage `gentle-ai restore [--list | latest | <id>] [--yes]` is from `gentle-ai restore
      --help` [c]. **Unproven:** that the backup folder name is the id, and that this backup holds
      his files as the review left them, are [i]. Until an S9a fixture proves it, the fix prints it
      marked unproven, with `gentle-ai restore --list` first.

Pass lines (diet §10): fixtures of a release with a `conflicts` item, of one without, and of a
same-version sync that re-adds a hook; today's install records; the first leaves the row stale and
refuses, the third turns it stale.

### 5.4 S9b, any time: the source diff and the per-release record

1. **A source diff by area.** On a pinned clone (`~/.js-harness/upstream/gentle-ai`, fetch only,
   recorded in the machine manifest so `uninstall machine` removes it; never built or run), it
   buckets `git diff --numstat v<reviewed> v<installed>` by an `AREAS` table of real repository
   paths, each with a default verdict:

   | Area (paths in the gentle-ai repository) | Default verdict |
   |---|---|
   | `internal/assets/*/orchestrator.md`, `internal/assets/skills/_shared/odd-*`, `internal/components/agentguidance/**` (prompt text is Go literals, so the asset digest misses it) | adapt: check against diet §3, §5 and the S5 rule pass |
   | `internal/components/agenthooks/**`, `internal/components/telemetryruntime/**`, `internal/telemetry*/**` | conflicts-check: hooks and telemetry |
   | `internal/reviewtransaction/**`, `internal/reviewerprovider/**`, `internal/providercontractbundle/**`, `internal/consentenvelope/**`, `internal/components/reviewassets/**`, `contracts/**` | adopt: we call it; recheck `AGENTS.md:50`, `codex-review` |
   | `internal/assets/claude/output-style-*`, `internal/assets/claude/persona-*`, `internal/components/persona/**`, `internal/components/theme/**` | adapt via the S4b patch |
   | `internal/assets/skills/**`, `skills/**`, `internal/components/skills/**`, `internal/skillregistry/**` | adapt or ignore, by skill name |
   | `internal/components/engram/**` | conflicts-check: memory ownership |
   | `internal/backup/**`, `internal/state/**`, `internal/managedownership/**`, `internal/components/filemerge/**`, `internal/components/uninstall/**` | adopt: formats we read; run this module's fixtures |
   | `internal/tui/**` | adapt: the TUI port (section 4) |
   | `internal/update/**`, `internal/cli/**`, `internal/components/gga/**` | adapt: commands we print or call |
   | `internal/shellinstaller/**`, `internal/opencode/**`, `internal/assets/{antigravity,codex,cursor,gemini,generic,hermes,kimi,kiro,qwen,windsurf,opencode}/**`, `bench/**`, `e2e/**`, `testdata/**`, `docs/**`, `odd/**`, `README.md`, `.goreleaser.yaml` | ignore (`bench` and `docs` read for evidence) |

   **Unmatched paths are never dropped.** A changed path that matches no row is listed as
   `unmatched`, blocks the record like `conflicts`, and is classified by hand; the row it earns is
   added to `AREAS` in the same commit.
2. **A classifier.** Each changed area or block gets `adopt`, `adapt`, `ignore` or `conflicts`, with
   its evidence (file, lines, block).
3. **The per-release record.** A release with any item other than `ignore` gets its own section in
   `odd/tasks/gentle-ai-update-check.md`, committed. Releases with only `ignore` items are batched:
   one line each in a running list, committed with the next non-`ignore` record or at month end.
   Adopted ideas go to the roadmap, never into H, which gentle-ai owns.

**Channels.** Track stable releases. Watch `main` only for the TUI: unreleased `main` carries 322
commits and +57.6k lines, +8.8k of them in `internal/tui` (`git diff --shortstat v4.2.0 HEAD`) [c].

### 5.5 When the baseline reruns

One rule, the same in the diet (§7.2) and the roadmap: on a gentle-ai update, S9 classifies first.
**The S0 incident baseline reruns once (~$13) only when an item in a prompt, hook, persona or skill
area is recorded as `adapt`, or as `conflicts` that he accepted.** An update whose items are all
`adopt` or `ignore` records without a rerun. Full certification (the S8 measures and the audits)
reruns only for a new model or a Claude Code or Codex CLI update (`docs/future-model.md:15-18`).
While F8 is open the reruns draw on the envelope's reserve (diet §1, D2); past it, G7.

**Caution.** Running `gentle-ai sync` in a scratch home, which the diet first planned, is not part
of S9. It is untested on Windows, must override both `HOME` and `USERPROFILE`, and would have to
assert that nothing under the real `~/.claude` changed [i]. S9a and S9b read files and run
read-only probes; they never run a sync.

## 6. The target, and the order

**Layers, bottom to top:**
1. **Host (Claude Code):** skills, hooks, `/goal`, Monitor, SendMessage, compaction, permissions.
   We build on it, never beside it (diet §6).
2. **The stack installer, gentle-ai:** installs and updates engram, codegraph, context7, its skills,
   its review agents and its review CLI. It keeps owning H and `gentleman.md`; we never edit them.
3. **Engines, called as CLIs or MCP, not as prose:** the gentle-ai review engine, Codex review,
   engram and codegraph.
4. **js-harness, the thin layer:** checks and hooks (`check`, `guard`, `reply`, `resume`, the rules
   delta, `backup`); the review driver (S1); the session commands; `doctor` and `stack` as the
   read-only view of the stack; the update watch (section 5); the TUI.
5. **Project text, read every turn:** a root `CLAUDE.md` holding `@AGENTS.md` and the A.1 kept lines
   (D3, answered), the project copy of the output style, and skills that load on demand.
6. **Records:** the repo is canonical (roadmap, `odd/tasks/`, `docs/RULES.md`); engram and
   `MEMORY.md` mirror it or point to it.

**What a turn loads after S2+S3:** the host (~60k), the skill list (≤3.2k), MCP instructions
(~1.8k), `AGENTS.md` (~1.5k) and the kept lines (~1.4k by chars/4; diet A.1), the output style
(~1.8k), `MEMORY.md` (~0.7k) and the engram prompt hook (~0.4k) until D8. The diet's first-turn
estimate is about 76.6k (D4).

**The order.** S0 → S3 → **S9a** → S2 → S4a → S1 → S4b → S5 → S6 → S7 → S8, with S9b any time after
S9a. S9a comes before S2 because S2's guard against new injection paths (diet §11), G4 and the
persona-copy refresh all rest on it. This document changes five places in the diet:
- **S0's probe** is behavioural and covers `SessionStart` (diet §10).
- **S9a** lands before S2 (section 5.3).
- **S4a** adds the hook-count row: `check` fails when any event's entry count, or any owner's,
  exceeds the table of section 2 (today: `Stop` 6, `UserPromptSubmit` 4, `SessionStart` 7; owners
  gentle-ai 5, js-harness 13, Orca 12, herdr 1, codegraph 1; 32 in all), or when a new owner
  appears. Lowering a count lowers its line in the same commit; raising one is a decision with a
  reason.
- **S5** decides the skills to hide here (G5) and counts skill-description tokens before and after.
- **S9b** is section 5.4.

**The TUI is its own feature,** not an F8 step. It touches only `bin/tui.mjs`, its tests and the
walk script, none of which an F8 step touches, so it can run beside F8 in its own session. The
defect task (causes 1 and 2) can start under the freeze; the rest waits for G3.

## 7. His decisions raised here (G1-G7)

Each is one question, asked at the step the register names (diet §1), with the recommended default
first.

- **G1. Telemetry.** Default: **off**, after he reads `gentle-ai telemetry preview`. It is
  machine-wide, sends data off the machine, reads up to 512 KB of transcript on each Stop, and costs
  a process start on each Stop and SubagentStop. Undo: `gentle-ai telemetry enable`.
- **G2. TUI approach.** Default: **(a) plus (e)**, as section 4.5. The alternative that breaks the
  zero-dependency rule, (b), is his to choose if he prefers fewer lines over that rule.
- **G3. TUI priority against F8.** Default: **the defect task now, the rest beside F8 in its own
  session**. He reports that ours does not work; causes 1 and 2 are defects in shipped behaviour;
  the TUI shares no file with F8 and spends no eval money.
- **G4. The skill-registry prompt hook.** Default: **remove it from his user settings once S2 has
  landed and S9a exists.** After S2 nothing here reads the registry. The removal does not persist:
  a sync re-adds the hook (`skill_registry.go:132-145`), and S9a's fingerprint then turns the row
  stale on every run until he removes it again or accepts it (section 5.2).
- **G5. gentle-ai skills to hide here.** Default: `rdd-defect-workflow` once S1 lands,
  `skill-registry` once its hook goes; `go-testing` and `gentle-ai-bench` are already hidden. All
  overrides move from the untracked `settings.local.json` into the committed
  `.claude/settings.json` that S2 creates, so git can revert them.
- **G6. GGA.** Default: **keep** for now. It adds nothing per turn here (no hook, no block) and no
  repo ran `gga init` [i]; removing a component is a gentle-ai uninstall step, which is his.
- **G7. Re-analysis spend after F8.** While F8 is open, reruns come from the $200 envelope's
  reserve (D2; section 5.5). Default after F8: **~$13 per rerun, only under the rule of 5.5, capped
  at $50 a month**; a month that would pass it comes back to him. At ~3.5 stable releases a week,
  rerunning on every release would cost about $200 a month.

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
repeatable re-analysis on each gentle-ai update (section 5).

## 9. Grades

The third blind grade of the package (the diet's fourth pass with this document) gave Claude 6.4
and Codex 7.0. What changed after it: S9 split, with S9a before S2 and its guarantee stated
exactly; the full hook inventory and the S4a numeric line; the decisions renamed G1-G7 in one
register with the diet's D1-D9; the TUI's screen map, slices, authorization, warning, cancellation
and frame tests, and its counts per version; real `AREAS` paths with an unmatched-path policy; the
acceptance command, batched records, the unproven restore and the PATH caveat; one baseline-rerun
rule; the registry's write condition; and local dates.

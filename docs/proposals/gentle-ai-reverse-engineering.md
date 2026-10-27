# gentle-ai, reverse-engineered: what stays, what goes, what merges

Status: proposal, 2026-10-26, part of F8 (`docs/ROADMAP.md`). It answers his request of the same
day, quoted in full in section 8. It sits beside [the harness diet](harness-diet.md) ("the diet"
below), which stays the plan of record; this document replaces the diet's S9 text and adds the TUI.

Sources: the installed binary gentle-ai 4.2.0 (`gentle-ai --help`); its MIT source, read-only, at
tag v4.2.0 and `main` 2b56327e ("G" below); what it installed on this machine (`~/.claude`,
`~/.gentle-ai`, read only); and this repo. "H" is `~/.claude/CLAUDE.md`. Each claim is marked
**[c]** when checked with the path, line or command cited, or **[i]** when inferred. Nothing outside
the repository was changed.

## 0. The answer, short

- **Keep gentle-ai as the stack installer and the review engine.** Its ideas are good and its
  review CLI is the best part. What does not fit is how it delivers them here: 91.6 KB of
  always-on prose written for the weakest of 17 hosts, which the diet's S2 stops loading in this
  project.
- **Nine things are paid twice.** S2 removes six of them. The rest are hooks and a duplicated
  setting, handled by rows in `check` and `doctor`, not by more prose.
- **The TUI.** Port gentle-ai's *design* to zero-dependency Node in `bin/tui.mjs`, and add one
  menu item that hands the terminal to `gentle-ai`'s own TUI for its own screens. The first slice
  is about 400 lines and fixes the four causes that make ours misbehave. It is a separate feature
  that can run beside F8.
- **Following each update.** The existing `doctor` row learns to diff each release by area,
  classify each change against this matrix, and *withhold* the review record when a change
  conflicts, with the exact commands to stay on the reviewed version.
- **Seven decisions are his** (section 7), each with a recommended default.

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
- Five hook entries in `~/.claude/settings.json` [c]: `gentle-ai review stop-hook` on
  `SessionStart` (startup, resume, clear, compact) and on `Stop`; `gentle-ai telemetry runtime
  claude --json` on `Stop` and on `SubagentStop`; and `gentle-ai skill-registry refresh` through
  PowerShell on every `UserPromptSubmit`. A `gentle-ai sync` re-adds any of them that is missing
  (G `internal/components/agenthooks/claude.go:58-71`) [c], so deleting one by hand does not stick.
- **Telemetry is on by default.** `gentle-ai telemetry status` answers "enabled (source:
  default)" [c]. It is remote and opt-out, and on each `Stop` its Claude adapter reads up to 512 KB
  of the transcript (G `internal/telemetry/runtime_claude.go:16`) [c]. `gentle-ai telemetry
  preview` shows the payload without sending it (`gentle-ai --help`) [c].

**The nine places both stacks pay twice** (from the crossing; two corrected here):
1. **Memory protocol, four layers:** the engram block, engram's MCP instructions, the
   `engram:memory` "ALWAYS ACTIVE" skill description, and the engram plugin's prompt hook (~0.4k
   per prompt, diet §2).
2. **Code graph guidance, two layers here:** the 4.1 KB block and codegraph's MCP instructions.
   Its prompt hook, the third layer elsewhere, is already off in this repo
   (`CODEGRAPH_NO_PROMPT_HOOK=1` in `D:\js-harness\.claude\settings.local.json`; ROADMAP open
   decision 4, answered 2026-10-12) [c].
3. **Skill discovery, two layers:** the host lists skill descriptions (~3.2k), and gentle-ai
   rewrites `.atl/skill-registry.md` on every prompt, which only its own orchestrator prose tells
   anyone to read [c]. It also spawns a PowerShell and a gentle-ai process per prompt.
4. **Persona, two layers:** the block (~0.5k) and the output style (~1.8k).
5. **Delegation triggers, written twice inside gentle-ai's own blocks:** H:219 and H:546 [c].
6. **Review guidance, three places:** 27.9 KB of lifecycle prose, `AGENTS.md:50-60`, and the
   stop-hook's message. The two review *engines*, gentle-ai and Codex, are deliberate (diet
   decision 6).
7. **The `Stop` event spawns five command hooks from two owners** (ours: `guard --stop`, `reply
   --hook`, `backup --hook`; gentle-ai's: stop-hook and telemetry), each a process start on
   Windows. The latency is unmeasured [i].
8. **The model of a subagent is set in two places:** `claude_phase_assignments` in
   `~/.gentle-ai/state.json` and our `rule:subagent-*-model` rules [c].
9. **Two doctors.** A choice of aggregator, not a per-turn cost.

S2 removes items 1 to 6 for this project, except the MCP instructions, the hooks and the skill
descriptions, which `claudeMdExcludes` cannot reach (diet §10). One correction to the crossing:
`go-testing` and `gentle-ai-bench` do not load their descriptions here; they are
`user-invocable-only` in the same `settings.local.json` [c].

## 3. The matrix

Verdicts: **keep ours**, **adopt theirs**, **merge** (saying how), **drop** (here), **later**.

| Function | gentle-ai | js-harness | Verdict and reason |
|---|---|---|---|
| Workflow (ODD) | 82.7 KB of always-on prose: ODD protocol, Task Size, delegation triggers, `odd/tasks/` | contract first, checked by `check`; `odd/tasks/` | **Merge.** Keep ODD's folder and document format, and contract-first as the check. Drop the prose here (S2); keep the A.1 lines (S3) |
| Review | Go review engine, `review-*` agents, 27.9 KB of lifecycle prose, stop-hook | pre-granted consent (`AGENTS.md:50`), `codex-review`, pre-push refusal | **Merge.** Their engine, our driver (S1, `js-harness review`); drop the prose; keep Codex as the second reviewer |
| Memory | installs engram, writes its block | `memory` hygiene, `backup`, `MEMORY.md` rules | **Keep engram as the tool, ours as the policy.** The repo is canonical (S5); drop the block (S2) and the prompt hook (diet decision 8) |
| Code graph | `codegraph init`, guidance block, MCP setup | `functions apply`, the doctor row | **Adopt theirs for setup**, codegraph's MCP for runtime; drop the block (S2) |
| Sessions across windows | none (its "orchestrator" is one session) | sessions, notify, wait, wake, loop, remote, permit, merge-queue, quiet | **Keep ours**, trimmed against host features (diet §6) |
| Hooks | 5 entries | 11 entries | **Keep each owner's.** Add a `check` row that counts hooks per event and owner (S4a), so nothing pays twice unnoticed |
| Rules and checks | prose; its gates are "informational/unmanaged" | 65 rules, `check`, pre-commit and pre-push | **Keep ours**; S5's rule pass |
| Persona and style | block plus `gentleman.md` | none | **Adopt the voice** in a project copy with three lines rewritten (S4b; diet decision 7) |
| Skills | 14 skills, plus the `.atl` registry protocol | 3 skills | **Merge.** Keep work-unit-commits, chained-pr, branch-pr, comment-writer; hide the irrelevant ones in project settings (decision 5 below) |
| Install and uninstall | backs up before every write; managed ownership | manifest; four named uninstall kinds | **Keep both, each for its own files.** js-harness never writes gentle-ai's file (`bin/lib/gentle-ai-update.mjs:2-3`) |
| Update | updates the tools it manages | `update`/`upgrade` for itself; `stack` and `doctor` print each tool's command | **Keep both**; S9 widened (section 5) |
| Doctor | bounded version probes | aggregates the stack, with `gentle-ai` and `gentle-ai-sync` rows | **Keep ours as the aggregator**; calling `gentle-ai doctor` from it is **later** |
| Telemetry | remote, opt-out, on by default | local measures only | **His decision** (decision 1) |
| Evals | `bench/` in Go; a before/after table (G `README.md:162-171`) | `evals/`; the S0 and S8 plan | **Keep ours**; borrow the before/after table for the S0 report |
| Multi-host | 17 hosts, 3 here | Claude Code, Codex for reviews | **Keep ours narrow.** Codex still loads gentle-ai's `~/.codex/AGENTS.md` (diet §11) |
| Model routing | `claude_phase_assignments` | `rule:subagent-*-model`, `contract modes` | **Ours for routing** (S7); theirs only for its review agents |
| Permissions | 24 deny rules on credential paths | `guard` PreToolUse | **Keep both**: complementary |
| GGA, theme, context7 | installed | none | Keep context7; theme irrelevant; **GGA is his decision** (decision 6) |
| TUI | a full installer: 50 screens, Bubble Tea, 14.9k lines | `bin/tui.mjs`, a 544-line menu | **Merge by design, not code:** port the design to zero-dependency Node, and hand gentle-ai's own screens to its TUI (section 4) |

## 4. The TUI

### 4.1 Theirs

Running `gentle-ai` with no arguments opens it (`gentle-ai --help`) [c]. It is Bubble Tea v1.3.10,
bubbles and lipgloss (G `go.mod:7-13`), 131 files with 14,928 lines of code and 17,965 of tests [c].
One `Model` struct holds the whole state; `Screen` is a closed enum of 50 constants
(G `internal/tui/model.go:576-637`); `View()` dispatches to pure render functions; every backend
call runs in a goroutine that returns a typed message, and install progress streams through a
lossless queue whose messages carry a run id, so results of a stale run are dropped
(`model.go:316-375`, `:1360`) [c]. Keys: arrows or j/k, Enter, Space to toggle, Esc for Back, q and
ctrl+c to quit, and only those two while an operation runs [c, `model.go:1809-1990`]. Its confirm
screens open with the cursor on the destructive row (`:2205`, `:2688`, `:2723`) [c].

### 4.2 Ours, and why it does not behave like theirs

`bin/tui.mjs` (544 lines, 55 tests) already has the right split: a pure
`handleKey(state, key) → {state, effect}` and `render(state) → lines`, with a thin I/O shell [c].
Six causes keep it from behaving like gentle-ai's:

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

One thing ours does better: confirmation is an explicit y/N where anything else means no
(`:238-239`) [c]. Keep it.

### 4.3 What we need from theirs

Needed: alternate screen with full-frame redraw and resize; async runs with spinner, streamed log
and locked keys; a result screen with the exit code; a real key parser; a Doctor detail screen with
each row's fix command; multi-select for `functions` and `stack install`; a review of what
`install`/`init` will write before it writes; scrollable read-only views of our own (`progress`,
`sessions`, `codex-meter`, `failures`); a small palette that honours `NO_COLOR`. Not needed, because
gentle-ai owns them: persona, presets, model pickers, review mode, agent builder, Gentle Shell.
Later: backups.

### 4.4 Five ways to get there

| Option | Cost | Zero dependencies | Windows | License and trademark | Upstream updates |
|---|---|---|---|---|---|
| **(a) Port the design to zero-dependency Node** | framework ~700-900 lines, screens ~100-200 each; ~2-2.5k code plus tests [i] | kept | Node puts the console in VT mode on Windows 10 1809+; this machine is 19044 [i] | ideas are free; no logo or rose art (G `internal/tui/styles/logo.go:9`) | read their screen catalog per release; no merge conflicts |
| **(b) Node with a library** (ink, blessed, terminal-kit) | fewer lines | **breaks** `AGENTS.md:16`; `package.json` has no `dependencies` [c] | ink is good; blessed is unmaintained [i] | MIT | unrelated |
| **(c) Fork their Go TUI** | 15k lines welded to their internals (G `internal/app/app.go:13-30`); Go toolchain and per-OS release builds | breaks it | good | MIT, but forks "must use distinct primary names and branding" (G `TRADEMARKS.md:39`) [c] | worst: every release conflicts |
| **(d) Add our screens inside theirs** | needs an upstream PR: `Screen` and Community Tools are closed enums (`model.go:576-637`; `internal/model/types.go:229`) | n/a | n/a | their brand, their call | theirs |
| **(e) Hand the terminal to `gentle-ai`** from one menu item (stdio inherited, raw mode off) | ~20-40 lines | kept | as (a) | nominative use only: "Open gentle-ai" (`TRADEMARKS.md:35`) | free: always their current TUI |

The MIT license covers the code; "Gentle AI", "Gentle-AI", "gentle-ai" and "Engram" are trademarks
of Alan Buscaglia (G `TRADEMARKS.md:3-9`) [c]. Anything we ship uses our own name and branding.

### 4.5 Recommendation and first slice

**(a) plus (e).** It keeps the repo's one hard rule, it grows the reducer/render split we already
have instead of rewriting it, and it avoids a fork every release would break. Following gentle-ai's
TUI becomes reading three places at each tag (the `Screen` enum, the Welcome items
`internal/tui/screens/welcome.go:46-79`, the key handling) and porting what fits.

**First slice, about 400 code lines, tests first, touching only `bin/tui.mjs` and its tests:**
1. **Terminal guard:** enter the alternate screen and hide the cursor; restore raw mode, cursor and
   main screen on quit, error, SIGINT and exit.
2. **Frame model:** repaint the whole frame each time, clip every line to `columns` and the frame to
   `rows`, redraw on `resize`. A test asserts that no rendered line is wider than the given width
   (cause 1).
3. **Key parser:** split chunks into keys (CSI and SS3 arrows, PgUp/PgDn, Home/End, Space, Tab, a
   lone Esc after a short timeout); Esc means Back, q quits (cause 3).
4. **Run screen:** each command runs as a child (`node bin/js-harness.mjs <cmd>`) with piped output;
   a spinner ticks, the output fills a scrollable log, keys other than ctrl+c are locked, and it ends
   on a result screen with the exit code (cause 2). `stack install`'s per-tool question becomes a
   TUI y/N followed by its existing `--yes --tool <id>` path.
5. **First draw before slow work:** draw at once, then fill in the update check and the stack block
   (cause 4).

**Acceptance:** the unit tests, plus a manual walk in Windows Terminal and in conhost (open, resize,
run Doctor, run Update, Esc back, q out, ctrl+c during a run), because no test drives a real
console (cause 6). Risk: item 6 of the high-risk list partly applies for that reason.

After it: multi-select, the Doctor detail screen, read-only views, item (e), and the palette.

## 5. Following gentle-ai on each update

This section replaces the text of the diet's S9.

### 5.1 What breaks us

1. **The backup manifest shape:** `gentle-ai-update.mjs` reads `entries[].original_path`,
   `snapshot_path` and `created_at` (`:36-39`) [c].
2. **The marker names and path of H's blocks:** `payload.mjs` reads them, and S2's
   `claudeMdExcludes` assumes the path.
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

### 5.2 What the `gentle-ai-sync` row gains

Today the row turns stale on a new version and lists manual steps (`gentle-ai-update.mjs:57-75`)
[c]. It gains, in the same module, as pure functions with fixtures, and no new command:

1. **A source diff by area.** On a pinned clone (`~/.js-harness/upstream/gentle-ai`, fetch only,
   recorded in the machine manifest so `uninstall machine` removes it; never built or run), it buckets
   `git diff --numstat v<reviewed> v<installed>` by an `AREAS` table with a default verdict each:

   | Area | Default verdict |
   |---|---|
   | `assets/*/orchestrator.md`, `assets/skills/_shared/odd-*`, `components/agentguidance` (prompt text is Go literals, so the asset digest misses it) | adapt: check against diet §3, §5 and the S5 rule pass |
   | `components/agenthooks`, `telemetryruntime` | conflicts-check: hooks |
   | `reviewtransaction`, `reviewerprovider`, `providercontractbundle`, `contracts/`, `consentenvelope` | adopt: we call it; recheck `AGENTS.md:50`, `codex-review` |
   | `assets/claude/output-style-*`, `persona*` | adapt via the S4b patch |
   | `assets/skills/*`, `skills/*` | adapt or ignore, by skill name |
   | `components/engram` | conflicts-check: memory ownership |
   | `backup`, `state`, `filemerge`, `uninstall` | adopt: formats we read; run this module's fixtures |
   | `tui` | adapt: the TUI port (section 4) |
   | `shellinstaller`, `opencode`, other hosts, `bench` | ignore (bench read for evidence) |

2. **An installed-file diff.** `claudeMdSnapshots` is generalized from H to every manifest entry
   under `~/.claude` (agents, skills, output styles); H is split by `<!-- gentle-ai:X -->` marker so
   the report names the block that moved and by how many bytes; the hook commands matching
   `gentle-ai` in `settings.json` and the `state.json` keys and `managed_asset_digest` are compared.
3. **Contract probes, read-only, against the installed binary:** a diff of `gentle-ai --help`, of
   `gentle-ai review capabilities --contract gentle-ai.review-integration/v2`, and of the release's
   "Provider contract" line. Any change is `adopt` and blocks the record until `AGENTS.md:50` and
   `codex-review` are rechecked.
4. **A classifier.** Each changed area or block gets `adopt`, `adapt`, `ignore` or `conflicts`, with
   its evidence (file, lines, block). New prompt lines are matched against the contradiction list of
   diet §3, kept as data (ask-one-question, Lossless Blocking Prompt, push and PR human-only,
   verifier gates, attribution); a hit forces `conflicts`.
5. **Verdicts recorded per release**, one section each, appended to
   `odd/tasks/gentle-ai-update-check.md` and committed. Adopted ideas go to the roadmap, never into
   H, which gentle-ai owns.

### 5.3 Detect, and also refuse

The second grade found that S9 detected an incompatible update but did nothing about it (Codex
regrade, "update acceptance not just detection"). The answer:

- While any item is `conflicts` without his decision, `doctor --gentle-ai-reviewed` refuses to
  record the version, and the row stays stale with the notice repeating.
- The row's fix then says to stay on the reviewed version, with two commands for him to run (the
  harness only prints them, since both write his global config):
  1. `go install github.com/gentleman-programming/gentle-ai/v4/cmd/gentle-ai@v<reviewed>`. The
     binary here comes from `go install` (`~/go/bin/gentle-ai`) [c], and that is the README's form
     (G `README.md:261`, module path from G `go.mod:1`) [c].
  2. `gentle-ai restore <id>`, where `<id>` is the first backup taken after the reviewed record,
     which holds his files as that review left them; `gentle-ai restore --list` shows the ids. The
     usage `gentle-ai restore [--list | latest | <id>] [--yes]` is from `gentle-ai restore --help`
     [c]. That the backup folder name is the id is [i] until S9's fixtures prove it.
- Until he runs them, S2 still keeps the new prose out of this project; hooks, skills and the style
  are what reach it.

**Channels.** Track stable releases. Watch `main` only for the TUI: unreleased `main` carries 322
commits and +57.6k lines, +8.8k of them in `tui` (`git diff --shortstat v4.2.0 HEAD`) [c].

**After the record,** rerun the S0 baseline only when a release touched a prompt, hook, persona or
skill area; a release that touched only `adopt`/`ignore` areas records without a rerun (decision 7).

**Caution.** The diet's plan to run `gentle-ai sync` in a scratch home is untested on Windows: it
must override both `HOME` and `USERPROFILE` and assert that nothing under the real `~/.claude`
changed [i]. Steps 1 to 3 above get most of the value without running gentle-ai at all.

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
   (diet decision 3), the project copy of the output style, and skills that load on demand.
6. **Records:** the repo is canonical (roadmap, `odd/tasks/`, `docs/RULES.md`); engram and
   `MEMORY.md` mirror it or point to it.

**What a turn loads after S2+S3:** the host (~60k), the skill list (≤3.2k), MCP instructions
(~1.8k), `AGENTS.md` (~1.5k) and the kept lines (~1.5k by chars/4; diet A.1), the output style
(~1.8k), `MEMORY.md` (~0.7k) and the engram prompt hook (~0.4k) until diet decision 8. The diet's
first-turn estimate is about 77k (diet decision 4).

**The order.** F8 keeps the diet's sequence: S0 → S3 → S2 → S4a → S1 → S4b → S5 → S6 → S7 → S8,
with S9 any time after S0. This document changes four places:
- **S0's probe** is behavioural and covers `SessionStart` (diet §10).
- **S4a** adds the hook-count row of the matrix.
- **S5** decides the skills to hide here (decision 5) and counts skill-description tokens before
  and after.
- **S9** is section 5 of this document.

**The TUI is its own feature,** not an F8 step. It touches only `bin/tui.mjs`, its tests and the
walk script, none of which an F8 step touches, so it can run beside F8 in its own session once he
sets its priority (decision 3).

## 7. His decisions

Each is one question, asked when its step needs it, with the recommended default first.

1. **Telemetry.** Default: **off**, after he reads `gentle-ai telemetry preview`. It is
   machine-wide, sends data off the machine, reads up to 512 KB of transcript on each Stop, and costs
   a process start on each Stop and SubagentStop. Undo: `gentle-ai telemetry enable`.
2. **TUI approach.** Default: **(a) plus (e)**, as section 4.5. The alternative that breaks the
   zero-dependency rule, (b), is his to choose if he prefers fewer lines over that rule.
3. **TUI priority against F8.** Default: **beside F8 now, first slice only**, in its own work
   session. He reports that ours does not work, causes 1 and 2 are defects in shipped behaviour, it
   shares no file with F8, and it spends no eval money.
4. **The skill-registry prompt hook.** Default: **remove it once S2 has landed and S9's watch
   exists**, not before: a sync re-adds it (G `claude.go:58-71`), so only the watch makes the
   removal hold, and after S2 nothing here reads the registry. It is his user settings.
5. **gentle-ai skills to hide here.** Default: `rdd-defect-workflow` once S1 lands, `skill-registry`
   once its hook goes; `go-testing` and `gentle-ai-bench` are already hidden. All overrides move from
   the untracked `settings.local.json` into the committed `.claude/settings.json` that S2 creates, so
   git can revert them.
6. **GGA.** Default: **keep** for now. It adds nothing per turn here (no hook, no block) and no repo
   ran `gga init` [i]; removing a component is a gentle-ai uninstall step, which is his.
7. **Re-analysis spend.** Default: **inside the $200 envelope** of diet decision 2 while F8 is open,
   and only for releases that touch a prompt, hook, persona or skill area (section 5.3). At ~3.5
   stable releases a week, rerunning the baseline (~$12 a run) on every release would spend the
   envelope in a month.

The diet's decisions 3 to 8 stand as written.

## 8. His request, verbatim

"hagamos una investigacion mucho mas profunda de lo que va lo que no, lo que vamos unir con lo que
tenemos nosotros y como debe quedar bien y en orden mejor dicho todo, y necesito traerme todo el
sistema completo de tui que tiene gentle-ai por que el de nosotros es muy sencillo y no funciona
como el de gentle-ai osea debemos tambien a medida que gentle-ai se actualice por que es una buena
base, poderlo analizar y ver que se puede mejorar frente nuestra investigacion y necesidades y
mejoras que nosotros apliquemos osea es una una ingenieria inversa tambien y ademas con nuestra
mejora y necesidades" (2026-10-26, relayed by the lead).

Read as needs, not as a spec: (1) a verdict per component and the target, in order (sections 3
and 6); (2) a TUI as capable as gentle-ai's (section 4); (3) a repeatable re-analysis on each
gentle-ai update (section 5).

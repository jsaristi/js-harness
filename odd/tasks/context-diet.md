# context-diet

Branch `claude/jh286-context-diet`, from origin/main (c9144af9). Session JH 286. Measure-only: this document is the
only file the work writes; nothing on the machine was changed.

## State
Measured and written. Next is the owner's decision, asked by the lead: which candidates in the table to turn off for
work sessions. Open: whether the host honours a deny on its own tools (one probe, C1), and the per-tool schema sizes,
which no transcript holds.

## Goal
Say what the fixed context of a work session of this repo holds, who owns each part, whether work sessions use it,
and what turning each unused part off would save per call and over a night.

## Why
On the night of 2026-11-20/21, 17 work sessions made 1,322 calls and read 189.84M from cache. Every call starts at
about 78K before any work, so that fixed part is about 103M, 54% of the night (lead's note
`spend-measure-2026-11-21.md`, "Checked"). The owner asked what can be saved and what is done twice (Specs).

## Done when
- `npm run check` exits 0
- The table below gives every part of the 78K an owner, a use count from the 17 transcripts and a saving per call and
  per night, each marked measured or estimated.

## In scope / Out of scope
- In: reading transcripts, settings and plugin files read-only; this document.
- Out: any settings, MCP, plugin, skill or hook change, and any other repository file: what to turn off is his
  decision, asked by the lead.

## Constraints
- Token figures for parts no transcript counts are characters divided by a calibrated 2.7 characters a token (Depth
  pass, item 2), and say so — because the host's tool schemas are in no transcript and no token-count call is allowed
  from here.
- Use counts come from the same 17 transcripts the lead's note used.

## Ask me before
Turning anything off. Every row of the table is a proposal.

## Depth pass
- 1. Method: a context budget is measured from the request the model actually received, not from the files that
  feed it; the standard is to attribute every token of the first call to a source and drop what no call uses. The
  smallest change is a per-session tool allowlist for work sessions, not editing shared texts.
- 2. Raw material:
  - First-call context of the 17 sessions, from the usage of the first assistant message (`tools.mjs`, `calib.mjs` in
    this session's scratchpad): two clusters, ten at 76,739 to 77,672 and seven at 79,267 to 79,672.
  - The high cluster is exactly the seven sessions where engram's SessionStart block loaded (4,240 to 4,297
    characters); in the other ten it loaded nothing. Difference: 2,044 tokens for that one block, measured. Its
    ratio is 2.1 characters a token (dates, paths, markdown); for the whole request see the closure below.
  - The prefix before call 1, characters a session (`hooks.mjs`, attachment content): system prompt snapshot 34,487;
    instructions 19,131; skill listing 10,255; deferred tool names 10,032; MCP instructions 7,782; agent listing
    5,511; the rest about 2,400.
  - The `prompt_snapshot` attachment is the host's system prompt text (keys `systemPrompt`, `reminderFold`,
    `echoWireToolInputs`, `contextRendering`): 34,093 characters. Largest sections: "Starting other sessions"
    13,591; "Task list and wrap-up (this app)" 4,537; "Context management" 3,688; "Harness" 3,476; "You are a session
    started from another session" 2,268; "Memory" 2,072; the two browser blocks 2,571.
  - Outside the snapshot and outside the transcript: the tool schemas (read by eye from this session's own tool
    list, the same desktop work-session list: about 103,000 characters), the safety rules and the advisor section
    (about 16,500 characters).
  - Closure: about 92,500 + 103,000 + 16,500 = 212,000 characters for 78K tokens, so 2.7 characters a token over the
    whole request. Every converted figure below uses 2.7; it is an estimate whose total is pinned to the measured 78K.
  - Sub-agent first calls in this repo's projects (`sub.mjs`, newest 600): `js-harness-writer` (6 tools) 6,881
    minimum; `web-fetch` (1 tool) 3,320; `Explore` 15,823; `general-purpose` 21,468; `fork` (the parent's whole
    context) 77,166. The same model with six core tools starts at 7K.
  - Tools called by the 17 sessions (main chain): Bash 1,083, Edit 186, Read 78, Write 29, update_plan 20, wrap_up
    19, advisor 18 (server-side blocks), Grep 9, ToolSearch 8, get_usage 5, codegraph_explore 4, TaskStop 3, Skill 1,
    SendMessage 1. Fourteen tools. No Agent call, and no sub-agent transcript exists for the 17 ids (searched each
    `<id>/subagents` folder: 0 files).
  - MCP servers: `~/.claude.json` user `mcpServers` codegraph, engram, context7; none for the project. Plugins
    enabled (`~/.claude/settings.json`): codex, engram (hooks and a skill, no MCP server), typescript7-lsp. The
    claude-in-chrome server and the `ccd_*`, browser, Docs and visualize tools come with the desktop app.
  - Instructions: `~/.claude/CLAUDE.md` 6,347 characters, repo `CLAUDE.md` 5,972, `AGENTS.md` 4,915. The global
    file's "High risk" paragraph is the same text as `AGENTS.md`'s (`AGENTS.md:39`).
  - The lead's measure: `spend-measure-2026-11-21.md:13` (1,322 calls, 189.84M) and `:15` (the fixed 78K, 54%).
- 3. The bar:
  spec 1: `npm run check`: green on origin/main before this document; the document adds no code.
- 4. Refutation: if work sessions called the host's surface tools (Artifact, browser, Workflow, Agent), dropping them
  would cost work. `node calib.mjs` and `node tools.mjs` (scratchpad) counted every tool_use and server_tool_use
  block of the 17 main chains: fourteen names, none of them a C1 tool; 0 sub-agent transcripts.
  Verdict: supports
- 5. Request: measure the fixed context and propose what to drop, owner by owner, with the saving marked measured or
  estimated; change nothing.
  Adds: none

## Specs
1. His words, typed (transcript 0cdab702 line 9413): "solucionemos todos esos errores y dime cuanto nos podemos
   ahorrar y ademas si estamos haciendo algo doble innecesario".

## Where the 78K goes

| Part | Tokens a call | How known | Owner | Used by work sessions |
|---|---|---|---|---|
| Tool schemas, loaded (about 70 tools) | about 38K | estimated, 103K characters / 2.7 | host (desktop), his servers | 14 tools |
| Host system prompt text | 12.7K | measured characters / 2.7 | host | partly: task list yes, sessions block no |
| Instructions | 7.1K | measured characters / 2.7 | his global file 2.4K; ours (`CLAUDE.md`, `AGENTS.md`) 4.0K; memory index 0.7K | yes |
| Safety rules and advisor section | about 6K | estimated characters / 2.7 | host | rules: keep; advisor: 18 calls |
| Skill listing | 3.8K | measured characters / 2.7 | host, plugins, ours (js-harness skills about 0.6K) | 1 Skill call |
| Deferred tool names | 3.7K | measured characters / 2.7 | host, his servers | 8 ToolSearch calls |
| MCP server instructions | 2.9K | measured characters / 2.7 | codegraph, engram, context7 (his); claude-in-chrome (desktop) | codegraph 4 calls; the rest none |
| Engram start block (7 of 17 sessions) | 2.0K | measured, cluster difference | engram plugin (his) | no memory call |
| Agent listing | 2.0K | measured characters / 2.7 | host, plugins, ours | no Agent call |
| Output style, environment, hook notes, the rest | about 0.9K | measured characters / 2.7 | ours and host | yes |

## Candidates

Night = tokens a call × 1,322 calls. Share = of the night's 189.84M. Per-tool sizes in C1 were read by eye from the
visible tool list, not counted, then divided by 2.7.

| # | Candidate | Tokens a call | Night | Owner | Calls in 17 sessions | Risk | Measured / estimated |
|---|---|---|---|---|---|---|---|
| C1 | Desktop tools no work session called: Artifact (about 11.5K), the built-in browser's 19 tools (5.2K), Agent (1.8K), Workflow (1.6K), ScheduleWakeup (1.5K), visualize read_me and show_widget (1.5K), AskUserQuestion (1.1K), session tools dismiss_task, hand_off, mark_chapter, read_widget_context (1.0K), ReportFindings (0.9K), SendUserFile (0.9K), SuggestPluginInstall and SuggestSkills (1.2K), the Docs connector (0.7K), ListAgents (0.7K), claude-in-chrome's instructions and 20 deferred names (0.7K), SearchPlugins (0.6K), read_terminal (0.4K) | about 31K | about 41M (22%) | host | 0 | Agent is the writer route in the protocols (none used tonight); AskUserQuestion is closed to work sessions anyway. The lever is measured in the engine (JH 289, "C1 probe" below): a deny removes a tool's schema from the request, by flag or by `permissions.deny`; whether the desktop passes it for its own tools is not checked | sizes estimated; lever measured in the CLI |
| C2 | Re-orientation of relay sessions: 7 extra sessions tonight (change 1 three sessions, PR 940 three, folder files two, PR 934 two, PR 945's fixes two) | about 1.9M a relay | about 13M (7%) | ours: how units are cut and capped | n/a | none; the lead's note already points to one session a unit with a cap it can finish in | estimated (lead's note) |
| C3 | His MCP servers unused by work sessions: engram (start block 2.0K where it loads, instructions 0.6K, 23 deferred names 0.45K) and context7 (0.3K) | about 2.2K on average (3.4K where engram's block loads) | about 2.9M (1.5%) | his | 0 memory calls, 0 context7 | engram is the stack's memory by design (`AGENTS.md`): drop it from work sessions only; the lead and the closer keep it | engram block measured; the rest estimated |
| C4 | `~/.claude/CLAUDE.md` parts a work session here never acts on or gets twice: the "High risk" paragraph (also in `AGENTS.md`, about 0.35K), the graphify routing (0.45K, no graphify call), Delegation and Task Size overlapping the protocols skill (about 0.9K) | about 1.6K | about 2.2M (1.2%) | his (the file applies to every project, so a cut there reaches all of them) | n/a | low here; check his other projects first | measured characters / 2.7 |
| C5 | Skill and agent listing entries for surfaces work sessions do not use: dataviz and claude-api (about 1.2K together), artifact-design, -diagramming, -capabilities, plugin-authoring, the three codex internal helpers; the agent entries web-fetch and claude-code-guide (about 1.0K) | about 3.0K | about 3.9M (2%) | host and plugins | 1 Skill call | low; whether the host lets a session hide listed skills is not known | estimated |
| C6 | The host's "Starting other sessions" and "started from another session" blocks | 5.9K | 7.8M (4%) | host | 1 SendMessage, 0 start_session | not ours to cut; on record for its size | measured characters / 2.7 |

Our own text (repo `CLAUDE.md`, `AGENTS.md`, the output style, our hook notes, our skill and agent entries) is about
5.5K of the 78K. The diet of our text alone cannot reach the large share: C1 can.

## Done twice

- The "High risk" definition is loaded twice, from `~/.claude/CLAUDE.md` and from `AGENTS.md`, word for word (C4).
- Memory reaches the session by two routes: the auto-memory index `MEMORY.md` in the instructions (0.7K) and engram's
  SessionStart block (2.0K, recent prompts from days before). Work sessions called neither memory tool.
- Language is set by two routes: the output style's first line and the host's "Language" block. About 0.1K; the host
  block comes from his app setting, so leave it.
- Every relay re-reads the same orientation (C2), the largest repeated read measured.
- Not found: a skill and an instruction file carrying the same text, or a hook note repeating a protocol line. Search:
  the prefix attachments by type (`hooks.mjs`) and every hook output by command; hook output at start is engram's
  block plus under 0.3K of ours, and per tool small (the advisor gate 124 characters a session in all).

## Not checked

- Per-tool schema sizes: read by eye and converted at 2.7; only their sum is pinned, by the 78K closure.
- Whether the desktop app honours a deny for its own tools (C1). The CLI half is measured; the desktop half has its
  probe in "C1 probe".
- `hook_cancelled` attachments (112 on PostToolUse:Bash, 56 on the guard): metadata only; why hooks were cancelled
  is outside this measure.

## C1 probe (JH 289)

Measured 2026-11-22 with Claude Code 2.1.330, in a scratch folder outside the repo; no settings file was changed. Each
run is one call; the figure is input + cache creation + cache read of that call, from `--output-format json`.

| Run | Command | Input | Cache creation | Cache read | Total |
|---|---|---|---|---|---|
| Plain | `claude -p "say ok" --output-format json` | 2 | 45,635 | 0 | 45,637 |
| Deny by flag | the same plus `--disallowedTools "Agent Workflow Glob Grep WebSearch WebFetch NotebookEdit"` | 2 | 38,473 | 0 | 38,475 |
| Deny by settings | the same plus `--settings` with inline JSON `permissions.deny` of the same seven names | 2 | 12,983 | 25,522 | 38,507 |

- Proved: a deny removes the denied tools' schemas from the request, not only their calls: 7,162 tokens fewer a call
  for seven names, by the flag and by `permissions.deny` alike (32 tokens apart). Which of the seven were loaded and
  which deferred under `-p` was not split; the drop is their sum.
- Not proved: the C1 tools (Artifact, the built-in browser, visualize, the session and turn tools, the Docs connector)
  are added by the desktop app, not by the CLI, so this probe cannot say whether a deny reaches them. Saving: up to
  about 31K a call, about 41M a night (C1), only if the desktop honours it; 0 if it does not.
- The setting a work session would need (his to apply; not applied): a `permissions.deny` list in the project's
  `.claude/settings.local.json` naming the C1 tools by their request names (for example `Artifact`,
  `mcp__Claude_Browser`, `mcp__visualize`, `ScheduleWakeup`, `Workflow`). It reaches every session of the project,
  the lead's too, so the list must leave out what the lead uses.
- The probe that settles the desktop case: one desktop session in a scratch project whose `.claude/settings.local.json`
  denies Artifact, `mcp__Claude_Browser` and `mcp__visualize`, and a twin with no deny, each sent "say ok"; compare the
  first assistant entry's usage in the two transcripts. A drop near 18K proves it; none disproves it.

## Tasks
- [x] T1 (kind: verify) measure the fixed context and propose; spec 1; route: inline, read-only scripts in the
  scratchpad; commit: this document alone.

## Log
- L1 His request, typed (0cdab702 line 9413): "solucionemos todos esos errores y dime cuanto nos podemos ahorrar y
  ademas si estamos haciendo algo doble innecesario".
- L2 Brief `brief-context-diet-measure.md` (JH ORQ, 2026-11-21 19:40 local): measure and propose only.
- L3 Evidence: scripts `tools.mjs`, `sub.mjs`, `hooks.mjs`, `calib.mjs` in this session's scratchpad, read-only over
  the 17 transcripts the lead's note used and the sub-agent transcripts of `D--js-harness*`.
- L4 Advisor review before the write: the first draft used 4 characters a token, which the measured engram cluster
  and the 78K closure refute; recalibrated to 2.7 and the use count extended to server-side blocks and sub-agent
  folders.
- L5 C1 probe (JH 289, brief `brief-c1-probe.md`, JH ORQ 2026-11-22): three `claude -p` runs in the scratchpad; a
  deny by flag or by `permissions.deny` drops the denied schemas (45,637 to 38,475 and 38,507). Desktop half open.

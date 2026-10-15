The fixed context load of a session: what loads before the first message, who owns it, and a row that measures it.
Branch: feat/fixed-load. Delivery: ask-on-risk, one slice. Tests: `node --test`.

## Goal
Every gate says how many tokens a session of this project spends before its first message, read from
the hosts' own records, and every part of that load has a named owner and a recommendation.

## Why
A session of the desktop app starts at about 110k tokens before anyone types: 109,514 at the first turn
of this session (its transcript, 2026-10-15T09:48:30Z), about 119k in the lead's at 05:51. That is a
third of the 350k window he set, gone before any work. The diet needs numbers per part and per owner,
and a measure that stays on so a regression shows on the next commit instead of in a compaction.

## Done when
- `node --test bin/lib/fixed-load.test.mjs` exits 0
- `npm run check` exits 0
- `node bin/js-harness.mjs check` prints a `fixed load` row with the first-turn tokens of this project's latest sessions

## In scope / Out of scope
- In: bin/lib/fixed-load.mjs, its test, the `fixed load` row in bin/check.mjs and its test, README.md, docs/ROADMAP.md (F2), this document.
- Out: any file outside this repository (global CLAUDE.md, settings, MCP servers, plugins): each is a decision for him, listed below. The memory folder and MEMORY.md: JH 16 owns their content. F2's open step (#4036): extended here, not forked.

## Constraints
- `check` stays read-only and spawns nothing for this row — because it runs on every commit; the row reads transcripts, it never starts a host.
- The row informs and never fails — because no commit here can shrink a load the hosts and gentle-ai own; a warning over the budget is enough.
- The harness never uses a CLAUDE.md — because project rules live only in AGENTS.md.

## Effort
high

## Ask me before
- Every change outside this repository (the decisions below), asked by the lead one at a time.

## Specs
- S1. His concern, typed (2026-10-15 05:50, relayed by the lead): "nuestro harnes es tan grande que nos va a tocar que dejar el contexto de la sesion en 350 mil ya que solo inicar la sesion gasta 100 mil".
- S2. The lead's brief (jh20-brief-fixed-load.md, 05:53), done when 1: "per category, what loads, from where and who owns it, measured in tokens with a command another session can rerun; one recommendation per category, with its saving and its cost."
- S3. The brief, done when 2: "The parts the harness owns built test-first, for example: a `check` row, or a `doctor` line, that measures the fixed load and warns over a budget; per-project MCP enablement recorded so it can be undone."
- S4. The brief, done when 3: "Every change outside this repo is listed as a decision for Sebastián: MCP servers on or off per session or project, plugins, global settings, other installers' blocks in ~/.claude/CLAUDE.md."
- S5. The row: `fixed load`, an info row of `check`. It reads the Claude transcripts of this project (`~/.claude/projects/<slug>/*.jsonl`, of the checkout and, from a worktree, of its main checkout), takes the newest five by last write, and for each the first assistant record's usage that is not a subagent's: input plus cache creation plus cache read is what the session sent at its first turn. The detail gives the median of the five and the budget; one line per session; a `warning:` line when the median is over the budget.
- S6. The budget is 100,000 tokens, his "100 mil" (S1), until he sets another (decision D1).
- S7. His ask at 05:58, relayed by the lead: "an organized cleanup that really lowers context WITHOUT losing quality. Add to your design: (1) move, never delete: always-on text that applies only in some cases becomes a skill or on-demand file, with a test proving its trigger still loads it; (2) a before/after eval on the same tasks proves no loss; (3) one measured change at a time, each undoable. Biggest targets: global CLAUDE.md 87KB (gentle-ai blocks, F2/#4036) and MCP tools per project."

## Measurement (2026-10-15, 05:48 to 05:57)

Three commands, each rerunnable by any session:

| Command | What it measures | Cost |
|---|---|---|
| `get_usage` (the app's session tool, `session_id: "self"`) | the desktop session's window by category | free, in the app only |
| `MSYS_NO_PATHCONV=1 claude -p "/context"` from the project folder | the headless CLI's window by category, per MCP tool, per memory file, per skill | free: a local command, no model turn (Messages: 10 tokens). Without `MSYS_NO_PATHCONV` Git Bash rewrites `/context` into a path and it becomes a paid prompt |
| `node bin/js-harness.mjs check` (this feature's row) | the real first-turn input of the latest sessions, from their transcripts | free, read-only |

What loads, per category. Desktop is this session at 05:55 (`get_usage`); CLI is the headless `/context` at 05:56, which counts deferred tools apart and loads none of them.

| Category | Desktop | CLI | What it is, from where | Owner |
|---|---:|---:|---|---|
| Memory files | 34,590 | 34,000 | `~/.claude/CLAUDE.md` 28.2k, auto-memory `MEMORY.md` 3.9k, project `AGENTS.md` 1.9k | gentle-ai, CodeGraph, Engram, graphify and his rules (global file); JH 16 (MEMORY.md); this repo (AGENTS.md) |
| System tools | 33,540 | 16,000 (+20.2k deferred) | Claude Code's built-in tools; the desktop adds the app's own (Artifact, sessions, plan, wrap-up) | Anthropic, the desktop app |
| MCP tools | 26,378 | 1,200 (+11.1k deferred) + 2,000 server instructions | desktop: the browser pane (about 20 tools), the app's session, terminal and view tools, the Claude Docs connector, codegraph; engram, context7 and Chrome are deferred | the desktop app; his connectors; codegraph, engram, context7 (his `~/.claude.json`) |
| System prompt | 9,367 | 2,800 | the host's prompt, plus the output style (`gentleman.md`, 7,128 bytes) | Anthropic, the desktop app; the style is gentle-ai's persona |
| Skills | 7,209 | 7,000 | the skill list: 17 user skills, 5 Codex plugin, 1 Engram plugin, 17 built-in, 13 synced from claude.ai | his `~/.claude/skills` (gentle-ai installs most), plugins, Anthropic, claude.ai |
| Custom agents | in tools | 608 | 9 agent types (the judgment-day and review lenses, Codex rescue) | gentle-ai, the Codex plugin |
| Total before a message | about 110k (109,514 real) | 63.5k | | |

The global `CLAUDE.md` by block (87,432 bytes, 28.2k tokens, about 3.1 bytes a token):

| Block | Bytes | ~Tokens | Owner |
|---|---:|---:|---|
| `gentle-ai:orchestrator` (lines 109-494) | 50,500 | 16,300 | gentle-ai |
| `gentle-ai:agent-routing` (lines 496-599) | 26,300 | 8,500 | gentle-ai |
| `gentle-ai:codegraph-guidance` | 4,100 | 1,300 | gentle-ai, for CodeGraph |
| `gentle-ai:engram-protocol` | 2,600 | 850 | gentle-ai, for Engram |
| `gentle-ai:persona` (his rules, expertise, skill loading) | 2,100 | 680 | gentle-ai, with his rules |
| graphify | 1,000 | 330 | graphify |

## Recommendations, one per category

| Category | Recommendation | Saving | Cost | Whose |
|---|---|---:|---|---|
| Memory files: global `CLAUDE.md` | Drop the orchestrator and routing blocks from this machine's Claude, through gentle-ai's exclusion when #4036 ships (open, last touched 2026-09-12; gentle-ai 4.1.1 installed). Until then nothing safe: a hand edit is overwritten by the next `gentle-ai sync` | up to 24.8k | ODD, the review lifecycle and delegation rules leave the prompt; review still runs through `gentle-ai review`, which the gate calls | his (D2), F2's open step |
| Memory files: `MEMORY.md` | Keep the index to one short line per memory; the rules it carries move into the harness (`bin/` checks, AGENTS.md) | about 2k of 3.9k | none beyond JH 16's work | JH 16 |
| Memory files: `AGENTS.md` | Already held to 1,500 estimated tokens by the `budget` row; real count 1.9k | none | | this repo |
| System tools | Nothing to do: the host's own | 0 | | Anthropic |
| MCP tools: desktop browser pane | Turn it off for sessions that never browse, if the app offers it per session | up to about 10k | no in-app browser in that session | his (D3) |
| MCP tools: Claude Docs connector | Off for this project's sessions (`set_session_connector_enabled`), on where he writes docs | about 1.9k | no Docs from these sessions | his (D4) |
| MCP tools: context7 | Off for this project: no library docs needed here, deferred already | 1.9k deferred, under 0.5k loaded | no library lookups here | his (D5) |
| System prompt: output style | Keep: it is his voice. The 7k-byte style could shrink upstream | about 1k | | gentle-ai |
| Skills | Hide skills this project never uses (Go testing, bench, Office formats, Google Workspace, morning), if the host offers a per-project skill filter | about 2.5k | those skills need a re-enable to come back | his (D6) |
| Window | His 350k `autoCompactWindow` (set 05:50) keeps 240k of work after the load | | | done |

## How each cut is made (S7)
Every recommendation above is carried out the same way, one at a time, each its own change:
1. Move, never delete. Text that loads on every turn but applies only in some cases moves into a skill
   or an on-demand file; a test proves the trigger still reaches it (for a skill, the host lists it with
   its description; for a file, the line that points to it is still in the always-on text).
2. Measure before and after with the `fixed load` row and `claude -p "/context"`; the saving is the
   difference, written in the Log.
3. Prove no loss with the F5 evals (`evals/`, `node evals/runner.mjs`): the same tasks, the current
   configuration against the one with the cut (an arm in `evals/arms.mjs`), scores within the
   spread. The runs are paid, so each is his call (D7).
4. Undoable: the cut is recorded where it is made (a commit here, gentle-ai's own exclusion list,
   `~/.claude.json`'s per-project switch), and undoing it is named in the Log.
Order, largest first: the gentle-ai orchestrator and routing blocks (24.8k, through #4036), then the
desktop browser pane (about 10k), then the smaller ones.

## Decisions for him (each asked by the lead, one at a time)
- D1. The budget for the `fixed load` row: 100,000 tokens (his "100 mil"), or another number.
- D2. When gentle-ai #4036 ships: exclude the orchestrator and agent-routing blocks from this machine's Claude `CLAUDE.md` (F2's open step).
- D3. Turn off the browser pane for work sessions that never browse, if the app allows it per session.
- D4. Turn off the Claude Docs connector for this project's sessions.
- D5. Turn off context7 for this project (`/mcp` disable, recorded in `~/.claude.json` under the project: undone by enabling it again).
- D6. Hide the skills this project never uses, if Claude Code offers a filter.
- D7. Pay for a before/after eval run for each cut (S7 point 2), or accept a cut on its measured saving alone.

## Tasks
- [x] T1 (kind: design) Measure the fixed load per category and owner; one recommendation per category (this document)
- [x] T2 (kind: build) The `fixed load` row of `check`, test-first (S5, S6): RED (no module), GREEN 9 of 9
- [x] T3 (kind: docs) README's check rows and ROADMAP F2
- [ ] T4 (kind: verify) Gate, gentle-ai review, Codex review, draft PR; decisions D1-D6 sent to the lead

## Log
- L1 (2026-10-15 05:52, the lead's notice to session 20): "Lead: GO. Your feature: the fixed context load of a session (~119k before any message; his concern 05:50). Full brief: C:/Users/Oficina/AppData/Roaming/Claude/side-session-notes/local_a8ef1e36-0003-4a3d-b6b5-9d18df61ab3e/jh20-brief-fixed-load.md"
- L2 (05:57) Per-project MCP enablement (brief, done when 2) is not built: every MCP server here is either the app's or his `~/.claude.json`'s, so any switch is a change outside this repo. It goes to him as D4 and D5; the harness records it only if he says yes.
- L3 (06:08) The row first took the lowest first turn; the headless `claude -p` run of the measurement (78,719 tokens, fewer tools) became the lowest at once and hid the desktop load. It takes the median now (S5), which neither a headless run nor a long first message moves; on this machine the row reads 95,570 (two of the five sessions are from 2026-10-11, before today's load grew).

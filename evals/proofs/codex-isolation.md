# Codex isolation proof

The run that proves the Codex arms of the eval leave the real machine untouched
(`odd/tasks/codex-parity.md`, T3). It is the record of one run, not a document to keep current.

## The run

```
node evals/codex-isolation-probe.mjs --codex <codex.exe> --arm both --control-ms 60000
  --report <path> --raw-dir <path>
```

- When: 2026-10-05, 07:11:19Z to 07:17:02Z, probe exit 0, verdict **PASS**.
- Probe: `evals/codex-isolation-probe.mjs` as of `a4a72ee`, before the correction `9c5ef12`, which
  tightens checks this run already met: every variable was identical to the value the sandbox
  set, and no new engram process was left.
- Binary: `codex.exe` of `@openai/codex` 0.159.1 (`codex-cli 0.159.1`), the real one behind the
  pnpm shim. Model `gpt-6.1-sol`, effort `medium`, ChatGPT login.
- Spend: two real sessions, one per arm, never retried. They are the two smoke trials of the
  staged spend.
- Login: last written 177.4 h before the run (limit 186 h). After each arm the trial's copy was
  byte-identical to the real file, and the real file kept its date and size.

## What was hashed

Four passes over the real trees (before, after a 60 s control window with no agent, after each
arm): 44,152 files, 2,167 MB content-hashed per pass, 27 to 40 s each.

- Content-hashed and scanned for the needles: `~/.claude`, `~/.claude.json`, `~/.engram`,
  `~/.gentle-ai`, `~/.codegraph`, `~/.orca`, `~/.js-harness`, `~/.codex`,
  `AppData/Local/claude-cli-nodejs`, `AppData/Local/Codex`, `AppData/Local/OpenAI`,
  `AppData/Local/engram`, `AppData/Roaming/Codex`, `%TEMP%/claude`, `~/.local/state/claude`.
- Size and date only: `~/.local/share/claude`, `~/.config`, `~/.cache`.
- Names only: the top level of `~`, `AppData/Local`, `AppData/Roaming` and `%TEMP%`.
- Never opened: `~/.claude/.credentials.json`, `~/.codex/auth.json`, and 186 files of the desktop
  app's binaries under `~/.codex/plugins/.plugin-appserver` and
  `~/.codex/packages/app-server-daemon`, described by size and date.

The needles were the nonce of the prompt, the unique name of each sandbox directory and each
session's Codex thread id. A hit is reported by path. There was none in either arm.

## Result per arm

| | minimal | current |
|---|---|---|
| Agent | exit 0, 46.2 s, 1 turn | exit 0, 63.1 s, 1 turn |
| Input tokens (cached) | 47,442 (43,520) | 142,308 (113,024) |
| Output tokens (reasoning) | 402 (0) | 593 (0) |
| Items | 2 `command_execution`, 2 `agent_message` | 2 `error`, 3 `mcp_tool_call`, 2 `command_execution`, 1 `agent_message` |
| Shell environment | 22 of 22 variables as the sandbox set them | 22 of 22 |
| Nonce file, env file | present, correct | present, correct |
| Engram | none in this arm | the trial's own store holds the memory and the nonce |
| Trial's engram port afterwards | nothing listening, no process left | nothing listening, no process left |
| Leak scan of the real trees | nothing found | nothing found |
| Real trees, new in the arm's window | nothing | `~/.claude/backups`: two backups of `.claude.json` rotated |

The one difference not seen in the control window is Claude Code's own rotation of its account
file's backups, written by the Claude session that ran the probe. Every other difference
(that session's transcript, its task output, `~/.codegraph/telemetry-queue.jsonl`, the
`js-harness remote` log) was also changing with no agent running.

## What a trial writes, and where

Everything below landed inside the trial's home, which is removed after the trial.

- **minimal** started from a `CODEX_HOME` holding the login alone and gained 374 files, 61 MB:
  a `config.toml` of 127 bytes, `installation_id`, `models_cache.json`, five sqlite stores,
  `cache/` (30 MB), `plugins/cache/openai-curated-remote` (312 files, 29 MB) and `skills/`
  (49 files). So an empty Codex home is not empty once Codex has started: it downloads its
  curated plugins and installs its bundled skills. Outside `CODEX_HOME`, PowerShell wrote its
  startup profile data under the trial's `AppData/Local`.
- **current** gained 609 files in `CODEX_HOME` and Codex rewrote its `config.toml` and four
  plugin install records. Of those, 592 files (59 MB) are `.tmp/marketplaces/engram`: Codex
  cloned the engram marketplace again, into the trial's home. Outside `CODEX_HOME`: the trial's
  engram store and its server's log (`.engram/`), a codegraph daemon record and telemetry queue
  (`.codegraph/`), and the engram hook's marker under the trial's `tmp/`.

## What the run settled

- Codex's shell, its hooks and its MCP servers all see the trial's environment: `CODEX_HOME`,
  the home directories and `ENGRAM_PORT` were the trial's in the agent's shell, the engram hook
  left its marker inside the trial's home, an engram server ran on the trial's port and logged
  there, and the engram MCP server saved into the trial's store (`mem_current_project`, `mem_save`, `mem_session_summary`).
- `--dangerously-bypass-hook-trust` prints its notice as an item of type `error`, twice, before
  the turn starts. It is not an `error` event and the session completes.
- A completed session exits 0, prints `Reading prompt from stdin...` on stderr and nothing else
  there, and its `turn.completed` carries `usage` with `input_tokens`, `cached_input_tokens`,
  `cache_write_input_tokens`, `output_tokens` and `reasoning_output_tokens`.
- A login 177 h old is not refreshed by a session: neither the copy nor the real file changed.
- `codex --version` writes into its `CODEX_HOME` (a `tmp/arg0` directory), so the probe reads
  the version under the trial's environment.

## What it did not settle

- `reasoning_output_tokens` was 0 in both sessions, on a task of four literal steps. Whether
  `-c model_reasoning_effort="medium"` reached the model is not shown by this run.
- No session failed, so the wording of Codex's usage-cap and login errors is still unseen.
- What the 127-byte `config.toml` of the minimal arm holds, and whether the plugins and skills
  Codex installs into an empty home reach the model's prompt: the sandbox was removed, as
  designed. The session used no tool but the shell.
- The current arm ran without the desktop app's pieces (`odd/tasks/codex-parity.md`, the decision
  of 2026-10-04), so this run says nothing about them.

## Kept outside the repository

The probe's full JSON report (1,705 lines) and each arm's raw stdout and stderr are in
`D:\js-harness-worktrees\codex-parity-t3-raw`. The raw files hold the nonce and the thread ids,
which mean nothing once the run is over.

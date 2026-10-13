# Codex isolation proof

The run that proves the Codex arms of the eval leave the real machine untouched
(`odd/tasks/codex-parity.md`, T3). It is the record of one run, and of a second on the next
Codex version, not a document to keep current.

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

## Second run: codex-cli 0.160.0

Codex was updated from 0.159.1 to 0.160.0 on 2026-10-05, before any trial of the matrix, so
the same command was run again on the new binary (`odd/tasks/codex-parity.md`, T3b). Everything
above is the record of the first run; this section holds what the second one adds or changes.

- When: 2026-10-05, 22:40:30Z to 22:47:35Z, probe exit 0, verdict **PASS**, both arms.
- Probe: `evals/codex-isolation-probe.mjs` as of `ef0e71f`, with the corrections of `9c5ef12`
  and the login check on the token's expiry. The follow-up that attributes an engram process
  by its parent was not done first: Sebastián had the probe run as it is.
- Binary: `codex.exe` of `@openai/codex` 0.160.0 (`codex-cli 0.160.0`). Same model, effort and
  login. engram was 3.1.0 on this run and 3.0.0 on the first.
- Spend: two more real sessions, one per arm, never retried.
- Login: the access token had 47.1 h left (minimum 12 h) and the file was 192.9 h old. After
  each arm the trial's copy was byte-identical to the real file, and the real file kept its
  date and size. So a session does not refresh a login past its eighth day either, which is
  what the first run could not show at 177 h.
- Hashed: four passes, 44,713 files, 2,315 MB per pass. The first pass took 162.5 s and the
  other three 31 to 38 s.

| | minimal | current |
|---|---|---|
| Agent | exit 0, 19.2 s, 1 turn | exit 0, 40.5 s, 1 turn |
| Input tokens (cached) | 47,438 (43,520) | 105,282 (76,800) |
| Output tokens (reasoning) | 400 (0) | 563 (0) |
| Items | 2 `command_execution`, 2 `agent_message` | 2 `error`, 3 `mcp_tool_call`, 2 `command_execution`, 1 `agent_message` |
| Shell environment | 22 of 22 variables as the sandbox set them | 22 of 22 |
| Nonce file, env file | present, correct | present, correct |
| Engram | none in this arm | the trial's own store holds the memory and the nonce |
| Trial's engram port afterwards | nothing listening, no process left | nothing listening, no process left |
| Leak scan of the real trees | nothing found | nothing found |
| `CODEX_HOME` gained | 375 files | 611 files, 5 changed |

- The events, the items and the three engram calls of the current arm are the ones of the
  first run, so 0.160.0 prints the same `codex exec --json` stream on this task.
- The current arm read 105,282 input tokens against 142,308 on 0.159.1, on the same task. One
  session per version does not say why: the binary, engram and the global `AGENTS.md` all
  changed between the two runs.
- The machine was busier than in the first run. With no agent running, the control window
  already saw the desktop app's profile under `AppData/Roaming/Codex`, its log, and
  `logs_2.sqlite` and `models_cache.json` in the real `~/.codex` change: four Codex processes
  of Sebastián's were open. New in an arm's own window: one more file of that profile in the
  minimal arm; in the current arm, the transcript, file history and account-file backups of
  another Claude Code session working on another project, and that session's engram writing
  the real `~/.engram/engram.db-wal`. None of it holds the nonce, a sandbox name or a thread
  id.
- 33 real files could not be read and so were not scanned for the needles; the report lists
  them.
- Still not settled: `reasoning_output_tokens` was 0 again, and no session failed.

## Kept outside the repository

The probe's full JSON report (1,705 lines) and each arm's raw stdout and stderr are in
`D:\js-harness-worktrees\codex-parity-t3-raw`; those of the second run (2,025 lines) are in its
`0.160.0` folder. The raw files hold the nonce and the thread ids, which mean nothing once the
run is over.

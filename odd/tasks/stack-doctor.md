# Stack doctor

Locator: `odd/tasks/stack-doctor.md` · Engram mirror: `odd/stack-doctor/tasks` · Branch: `feat/stack-doctor`

## Objective
`js-harness doctor` reports each tool of the stack — gentle-ai, engram, codegraph, context7,
`typescript-lsp` — as installed (with version), configured (per host and per project) and up to
date, or `unknown` when it cannot tell, and prints that tool's own fix command for every gap. A
`SessionStart` hook tells the user when something changed, at zero model tokens.

## Why
F2 (context diet) needs a view of what is installed and configured before it can cut anything, and
today a gap is found only by accident: the probe for this document found context7 pinned to
`@upstash/context7-mcp@2.2.5` while npm has 4.1.1, and codegraph registered in Claude Code but not
in Codex.

## Scope
- In: `bin/lib/stack.mjs` (tools as data + read-only probes), `bin/doctor.mjs` (`doctor`,
  `doctor --json`, `doctor --hook`), a 6 h cache for latest versions, entry-level manifest records
  so `install` can register one hook entry in a file it does not own and `uninstall` removes exactly
  it, the TUI stack block, tests and docs.
- Out: installing, configuring or upgrading any other tool (their own commands do that); the
  `ccstatusline` widget (verified possible, left for later — see Progress); Antigravity.

## Constraints
- Read-only toward every other tool's files, except the one recorded hook entry per host.
- Zero dependencies; Node ≥22 `fetch` for the network; every probe injectable (home, fs root, spawn,
  fetch, clock), so tests use fixtures and never the network or the real home.
- Fail-open: offline, timeout (5 s) or a malformed file yields `unknown`, never a crash, and the
  hook always exits 0.
- The hook never writes plain text to stdout (on `SessionStart` that enters the model's context);
  it prints one `{"systemMessage": ...}` JSON object or nothing.
- Never recommend `codegraph upgrade` (user rule); codegraph's fix is its npm install.

## Design
Each tool is a record: `id`, how to read its installed version, how to tell it is configured per
host and per project, where its latest version comes from, and its fix commands. Evidence
(2026-09-26, this machine):

| Tool | Installed version | Configured (Claude / Codex / project) | Latest from | Fix |
|------|-------------------|----------------------------------------|-------------|-----|
| gentle-ai | `gentle-ai version` → `gentle-ai 3.7.0` | `~/.gentle-ai/state.json` `installed_agents` has `claude-code` / `codex` / — | GitHub `Gentleman-Programming/gentle-ai` | `gentle-ai upgrade`, `gentle-ai sync` |
| engram | `engram version` → `engram 2.2.1` | `~/.claude.json` `mcpServers.engram` / `~/.codex/config.toml` `[mcp_servers.engram]` / — | GitHub `Gentleman-Programming/engram` (`v2.2.1`) | `gentle-ai upgrade` |
| codegraph | `codegraph --version` → `1.6.0` | `mcpServers.codegraph` / `[mcp_servers.codegraph]` / `.codegraph/` | npm `@colbymchenry/codegraph` | `npm i -g @colbymchenry/codegraph`; project: `gentle-ai codegraph init --cwd <root>` |
| context7 | no CLI: `type: "http"` + `url` → hosted, version n/a; else the `@upstash/context7-mcp@X` arg | `mcpServers.context7` / `[mcp_servers.context7]` / — | npm `@upstash/context7-mcp` (only when self-run) | `claude mcp add` / `codex mcp add` |
| typescript-lsp | `~/.claude/plugins/installed_plugins.json` → 1.0.0 | `~/.claude/settings.json` `enabledPlugins["typescript-lsp@claude-plugins-official"]` / n/a / — | local marketplace `~/.claude/plugins/marketplaces/claude-plugins-official/.claude-plugin/marketplace.json` (offline) | `claude plugin update typescript-lsp@claude-plugins-official` |

- States per dimension: `ok`, `missing`, `outdated`, `unknown`, `n/a`.
- Cache `~/.js-harness/doctor.json`: `{ latest: { checkedAt, versions }, notified }`. Latest
  versions are refetched only when older than 6 h; local probes run every time.
- Hook: `js-harness doctor --hook` computes the gap list, compares its digest with `notified`, and
  prints `{"systemMessage": "js-harness: N stack gaps — run js-harness doctor"}` only when the
  digest changed and gaps exist; then records the digest.
- Registration: `install` adds `{ matcher: "startup|resume", hooks: [{ type: "command", command:
  "js-harness doctor --hook", timeout: 10 }] }` to `hooks.SessionStart` in `~/.claude/settings.json`
  and `~/.codex/hooks.json`. The manifest gains `entries: [{ path, pointer, entry, sha256 }]`;
  install is idempotent (no duplicate), uninstall removes the deep-equal entry only, keeps and
  reports it if the user changed it, and deletes the file only if js-harness created it and it is
  now empty. `uninstall` also removes `doctor.json`.
- TUI: the stack block renders above the menu from local probes plus the cache, with no network.

## Acceptance criteria (done when)
- `npm run check` passes; every behavior above has a fixture test written first.
- `js-harness doctor` on this machine prints the five tools with real versions and at least the two
  known gaps (context7 pinned arg vs hosted, codegraph missing in Codex).
- `npm run e2e` still passes, now also proving that install adds exactly one `SessionStart` entry to
  a temp home's Claude and Codex files and uninstall restores them byte-for-byte.
- The hook prints nothing on a second run with the same state, and never plain text.

## TDD
Mode: strict (source: user global config). Runner: `node --test`.

## Delivery
Strategy: `single-pr`, chosen by the orchestrator following the precedent of `jsaristi/js-harness#1`
(one PR, each work-unit commit reviewed). Forecast ~800–1,000 authored lines, above the ~400 slice
budget. Sebastián can switch to a chained strategy before the PR opens.

## Tasks
- [ ] T1 Tool registry and local probes (installed, configured, project) + `doctor` / `doctor --json` — route: delegated writer (2+ non-trivial files)
- [ ] T2 Latest-version lookup (GitHub, npm, local marketplace), 6 h cache, fail-open, `outdated` — route: delegated writer
- [ ] T3 `doctor --hook`: digest, `systemMessage` only on change, never plain stdout — route: delegated writer
- [ ] T4 Entry-level manifest records; install registers the hook in Claude and Codex; exact uninstall; e2e extended — route: delegated writer
- [ ] T5 TUI stack block above the menu — route: delegated writer
- [ ] T6 Run `doctor` on this machine, record the output here, update the roadmap — route: inline

## Progress
- 2026-09-26: document created after a delegated read-only probe of the repo and this machine.
  Verified: `gh api repos/Gentleman-Programming/engram/releases/latest --jq .tag_name` → `v2.2.1`;
  `ccstatusline` 2.2.30 ships a `custom-command` widget (`commandPath` in its dist), so a zero-token
  status-line indicator is possible later; `~/.codex/config.toml` `[features]` has no hooks flag and
  whether Codex 0.157.1 fires `~/.codex/hooks.json` without one is unverified — check in T4.

## Next step
T1.

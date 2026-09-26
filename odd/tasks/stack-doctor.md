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
- [x] T1 Tool registry and local probes (installed, configured, project) + `doctor` / `doctor --json` — route: delegated writer (2+ non-trivial files)
- [x] T2 Latest-version lookup (GitHub, npm, local marketplace), 6 h cache, fail-open, `outdated` — route: delegated writer
- [x] T3 `doctor --hook`: digest, `systemMessage` only on change, never plain stdout — route: delegated writer
- [ ] T4 Entry-level manifest records; install registers the hook in Claude and Codex; exact uninstall; e2e extended — route: delegated writer
- [ ] T5 TUI stack block above the menu — route: delegated writer
- [ ] T6 Run `doctor` on this machine, record the output here, update the roadmap — route: inline

## Progress
- 2026-09-26: document created after a delegated read-only probe of the repo and this machine.
  Verified: `gh api repos/Gentleman-Programming/engram/releases/latest --jq .tag_name` → `v2.2.1`;
  `ccstatusline` 2.2.30 ships a `custom-command` widget (`commandPath` in its dist), so a zero-token
  status-line indicator is possible later; `~/.codex/config.toml` `[features]` has no hooks flag and
  whether Codex 0.157.1 fires `~/.codex/hooks.json` without one is unverified — check in T4.
- 2026-09-26: T1 done, commit `86419ad`. Added `bin/lib/stack.mjs` (the five tools as data plus
  injectable `installed`/`configured`/`project` probes), `bin/lib/stack.test.mjs`,
  `bin/doctor.mjs` (`doctorMain`, `doctor` + `doctor --json`), `bin/doctor.test.mjs`, and wired
  `doctor` into `bin/js-harness.mjs` + its help test.
  RED (before implementation existed): `node --test bin/lib/stack.test.mjs bin/doctor.test.mjs`
  failed both files with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module
  'D:\js-harness\bin\doctor.mjs'` and `'...\bin\lib\stack.mjs'` — 2 failing, 0 passing.
  GREEN (after implementation): same command → `tests 36 / pass 36 / fail 0`.
  Full suite: `node --test` → `tests 108 / pass 108 / fail 0`.
  `npm run check` → `PASS budget 858 estimated tokens (budget 1500)` / `PASS tests node --test passed`.
  `node bin/js-harness.mjs doctor` on this machine (real, read-only):
  ```
  gentle-ai       3.7.0     ok        ok        n/a       unknown
  engram          2.2.1     ok        ok        n/a       unknown
  codegraph       1.6.0     ok        missing   ok        unknown
  context7        hosted    ok        ok        n/a       unknown
  typescript-lsp  1.0.0     ok        n/a       n/a       unknown

  Fix:
    codegraph: npm i -g @colbymchenry/codegraph; gentle-ai codegraph init --cwd <root>
  ```
  This reproduces one of the two gaps named in Why (codegraph missing in Codex). The other
  (context7 pinned vs hosted) does not reproduce today: this machine's `~/.claude.json` now
  carries both `type: "http"` + `url` and the legacy pinned `npx` args, and per the Design table's
  precedence the hosted fields win, so context7 reads `ok`/`hosted` with no gap — an `outdated`
  comparison needs T2's version lookup regardless, since T1 does no network calls.
- 2026-09-26: T1's native review (lineage `review-4b5c3ac3e23878a8`) was approved and acknowledged.
  Its 4 advisory findings (R3-001..R3-004) were accepted and folded into T2 rather than filed as
  separate follow-up work:
  - R3-001: every version-probe spawn was missing a timeout; a hung probe could hang `doctor`.
  - R3-002: the dispatcher's `doctor` test depended on the host's real tool binaries.
  - R3-003: a flag with no value silently consumed the next token instead of erroring.
  - R3-004: the Claude MCP "configured" check missed project-scoped registrations.
- 2026-09-26: T2 done, commit `6519280`. Added `bin/lib/cache.mjs` (`<home>/.js-harness/doctor.json`
  read/write, 6h `isStale`), `bin/lib/cache.test.mjs`, `bin/lib/latest.mjs` (per-tool latest-version
  sources: GitHub releases for gentle-ai/engram, npm for codegraph/context7 — skipped when context7
  is hosted — and the offline plugin marketplace for typescript-lsp, all parallel and timeout-bound
  via `AbortSignal.timeout(5000)`), `bin/lib/latest.test.mjs`; wired `upToDate` computation and
  `--offline` into `doctor.mjs`; applied R3-001 (5000ms `spawnSync` `timeout`, signal/ETIMEDOUT →
  `unknown`) and R3-004 (`projects[<root>].mcpServers` fallback) to `bin/lib/stack.mjs`; applied
  R3-003 (flag-without-value → usage on stderr, exit 2) to `doctor.mjs`'s `parseArgs`; applied
  R3-002 to the dispatcher's `doctor` test (temp `--home`/`--cwd`, `--offline`, `--json`, asserts
  five ids).
  RED: `node --test bin/lib/cache.test.mjs bin/lib/latest.test.mjs` before either module existed →
  `Cannot find module '...bin/lib/cache.mjs'` / `'...bin/lib/latest.mjs'`, 2 failing. Then, against
  the still-unmodified `stack.mjs`/`doctor.mjs`: the new R3-001/R3-004 rows in `stack.test.mjs`
  failed (`5000 !== undefined`, timed-out probe read `missing` not `unknown`, project-scoped
  registration read `missing` not `ok`); the new `doctor.test.mjs` rows failed (`outdated`/`ok`
  never appeared, `--offline` still called fetch, flag-validation exits stayed `0`); the dispatcher
  test's `--offline --json` output parsed to 0 ids since `--offline` did not exist yet.
  GREEN: `bin/lib/cache.test.mjs` + `bin/lib/latest.test.mjs` → 22/22; `bin/lib/stack.test.mjs` →
  36/36; `bin/doctor.test.mjs` → 16/16; `bin/js-harness.test.mjs` → 10/10.
  Full suite: `node --test` → `tests 146 / pass 146 / fail 0`.
  `npm run check` → `PASS budget 858 estimated tokens (budget 1500)` / `PASS tests node --test passed`.
- 2026-09-26: T3 done, commit `96cd7f4`. Added `bin/lib/digest.mjs` (`gapList`/`gapDigest`: a
  sorted, stable digest of every `(tool id, dimension, state)` gap) and `bin/lib/digest.test.mjs`;
  added `hookMain` to `doctor.mjs`, routed from `doctorMain` on `--hook`, sharing the same
  `buildReport` as the interactive path; added `bin/doctor-hook.test.mjs`.
  RED: `node --test bin/lib/digest.test.mjs` before the module existed → `Cannot find module
  '...bin/lib/digest.mjs'`, 1 failing. Then, against `doctor.mjs` before `--hook` was wired: all 6
  `bin/doctor-hook.test.mjs` rows failed — the plain (non-hook) report printed to stdout instead of
  the hook's JSON line, so "prints nothing on the second run" and "no gaps → empty stdout" both saw
  the full table instead of `''`, and the unusable-arguments row exited `2` instead of `0`.
  GREEN: `bin/lib/digest.test.mjs` → 7/7; `bin/doctor-hook.test.mjs` → 6/6.
  Full suite: `node --test` → `tests 159 / pass 159 / fail 0`.
  `npm run check` → `PASS budget 858 estimated tokens (budget 1500)` / `PASS tests node --test passed`.
  Real machine (read-only except its own cache), `node bin/js-harness.mjs doctor` twice:
  ```
  gentle-ai       3.7.0     ok        ok        n/a       ok
  engram          2.2.1     ok        ok        n/a       ok
  codegraph       1.6.0     ok        missing   ok        ok
  context7        hosted    ok        ok        n/a       n/a
  typescript-lsp  1.0.0     ok        n/a       n/a       ok

  Fix:
    codegraph: npm i -g @colbymchenry/codegraph; gentle-ai codegraph init --cwd <root>
  ```
  (identical both runs). `node bin/js-harness.mjs doctor --hook` twice: first run printed
  `{"systemMessage":"js-harness: 1 stack gap — run js-harness doctor"}` and exited 0; second run
  printed nothing and exited 0 — matching the one real gap (codegraph missing in Codex).

## Next step
T4.

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
- [x] T4 Entry-level manifest records; install registers the hook in Claude and Codex; exact uninstall; e2e extended — route: delegated writer
- [x] T5 TUI stack block above the menu — route: delegated writer
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

- 2026-09-26: T2-T3's native review (lineage `review-54d5dc2aa277cd15`) was approved and
  acknowledged. Its advisory findings R3-101..R3-103 were accepted and folded into T4 rather than
  filed as separate follow-up work (see below). Separately, `.atl/` (gentle-ai's local skill
  registry cache) was added to `.git/info/exclude` on this machine: the untracked-file-selection
  step of that review's submission dropped the `--base-ref` selector and widened the candidate to
  the whole branch, which would otherwise have pulled `.atl/`'s generated contents into review.
- 2026-09-26: T4 done, commits `bf64286` and `c15922f`.
  `bf64286` — `bin/lib/manifest.mjs` gains `entryComponents` (the T3 `js-harness doctor --hook`
  `SessionStart` entry for `~/.claude/settings.json` and `~/.codex/hooks.json`) and the JSON-patch
  engine behind it: `install`/`sync` read the target file (missing -> `{}`, `createdFile: true`;
  malformed -> left untouched and reported `skipped`), graft the entry onto its `pointer` path only
  if an equal one is not already there (idempotent, and a repeat call does not even rewrite the
  file), and preserve 2-space indent, a trailing newline, and CRLF line endings. `sync` prunes an
  entry a previous manifest declared but the current release no longer does; `uninstall` removes
  only the exact deep-equal entry, leaves a user-edited file completely untouched and reports it
  kept, and deletes a file only when js-harness created it and removing the entry leaves nothing
  but empty containers behind. `uninstall` also removes `<home>/.js-harness/doctor.json` and the
  `.js-harness` dir once empty. Old manifests without an `entries` field still load. `bin/install.mjs`
  reports each entry's registration or skip.
  `c15922f` — accepted T2-T3 review follow-ups: R3-101 (`writeCache` is now best-effort, so an
  unwritable/file-as-home never crashes the plain `doctor` report path or the hook), R3-102 (a
  refetch where every tool's lookup failed keeps the old `checkedAt` instead of stamping "now", so
  the next run retries immediately instead of waiting out a fresh 6h window), R3-103 (`readCache`
  drops any version entry that is not a string or `null`). Also extended `scripts/e2e.mjs`: seeds
  the temp home with one unrelated `SessionStart` entry per host before installing, then proves
  install adds exactly one entry to each without disturbing the seeded one, a second install and
  the `sync` inside `upgrade` add no duplicates, and `uninstall` restores both host files
  byte-for-byte.
  RED (`bin/lib/manifest.test.mjs`, before `entryComponents` existed): `node --test
  bin/lib/manifest.test.mjs` failed to load at all — `SyntaxError: The requested module
  './manifest.mjs' does not provide an export named 'entryComponents'` (1 failing at the module
  level, collapsing all 21 tests in that file, old and new). RED (`bin/lib/cache.test.mjs`, before
  R3-101/R3-103): `writeCache is best-effort...` failed with an uncaught `ENOTDIR` from `mkdirSync`;
  `readCache drops a non-string...` failed asserting the sanitized map still had `codegraph: 42`,
  `context7: {bad:true}`, `typescript-lsp: ['1.0.0']`. RED (`bin/doctor.test.mjs`, before R3-102):
  `doctorMain keeps the old checkedAt...` failed asserting `checkedAt` had moved to `'2026-...'`
  instead of staying at the seeded stale `'1970-01-01T00:00:00.000Z'`. Unplanned RED
  (`bin/doctor-hook.test.mjs`, a regression the R3-101 fix caused in a pre-existing T3 test): once
  `writeCache` became best-effort, its "exits 0 with empty stdout even when something inside throws"
  fixture (`--home` pointed at a plain file) stopped throwing at all, so the hook now legitimately
  computed and printed its gap report instead of going silent — the full-suite run caught this as
  `actual: '{"systemMessage":"js-harness: 15 stack gaps — run js-harness doctor"}\n' !== expected:
  ''`. Fixed by re-pointing that test at a case that still exercises the generic catch-all (an
  injected `now()` that throws) and adding a new test asserting the hook now correctly still reports
  gaps when only its cache write fails.
  GREEN: `bin/lib/manifest.test.mjs` -> 21/21; `bin/lib/cache.test.mjs` -> 12/12;
  `bin/doctor.test.mjs` -> 18/18; `bin/doctor-hook.test.mjs` -> 7/7.
  Full suite: `node --test` -> `tests 177 / pass 177 / fail 0`.
  `npm run check` -> `PASS budget 858 estimated tokens (budget 1500)` / `PASS tests node --test
  passed`.
  `npm run e2e` -> all 13 steps `PASS`, including the three new ones: "install added exactly one
  SessionStart entry to each seeded host file", "a second `install --home` adds no duplicate
  SessionStart entries", "the `sync` run inside upgrade also added no duplicate SessionStart
  entries", and the rewritten "`js-harness uninstall` removes what it wrote and restores both hook
  files byte-for-byte".
  Codex hooks check (read-only, this machine, Codex 0.157.1): `codex features list` lists `hooks
  stable true` (and `plugin_hooks removed false`) — hooks are a stable, enabled-by-default feature
  on this build, not gated behind a flag, so no `--enable hooks` or config change is needed for
  `~/.codex/hooks.json` to fire. `codex --help` does show a separate
  `--dangerously-bypass-hook-trust` flag ("Run enabled hooks without requiring persisted hook trust
  for this invocation"), implying Codex may prompt for one-time hook trust before actually running a
  newly-added hook command; verifying that trust prompt requires an interactive session and is left
  as an open item rather than blocking T4 on it — read-only evidence only, no config was changed.

- 2026-09-26: T4's native review (lineage `review-41e6050d1d54018f`) was approved and acknowledged.
  Its 5 advisory findings, R3-001..R3-005 (these ids restart per review — not the same numbering as
  T1's or T2/T3's own R3-00x/R3-10x follow-ups above), were accepted and applied directly as this
  session's two work units rather than filed as separate follow-up work:
  - R3-001: `appendEntryToFile` could overwrite a user value of an unexpected shape along the
    pointer path (an intermediate key that wasn't a plain object, or a leaf that wasn't an array).
  - R3-002: an fs failure on an entry target (unreadable file, a directory at the path,
    `.claude`/`.codex` being a plain file, unwritable) could throw out of install/sync instead of
    being reported `skipped`.
  - R3-003: `isEmptyJsonDoc` ignored key names entirely, so uninstall could delete a file it created
    even when the document still held unrelated content, as long as every value looked "empty".
  - R3-004: `resolveLatestVersions` conflated "nothing needed checking" (context7 hosted, or an
    empty row set) with "every lookup failed", so the doctor cache could stay stale forever with
    nothing left to fetch.
  - R3-005: install/uninstall always reformatted a rewritten host file to 2-space indentation,
    discarding whatever indentation (tabs, 4 spaces, compact) it already used.
- 2026-09-26: Unit A done, commit `f209adc`. Fixed R3-001..R3-005 in `bin/lib/manifest.mjs`:
  `appendEntryToFile` now treats an unexpected-shaped intermediate/leaf value the same as a
  malformed file (`skipped`, byte-for-byte untouched); both `appendEntryToFile` and the top-level
  `install()` component-writing loop catch fs failures and report/skip rather than throw (verified
  this never lets `sync` prune a healthy previous file: the same broken ancestor makes
  `fs.existsSync` on that path read `false` too, so its pruning guard never fires);
  `isEmptyJsonDoc` was replaced with `isOnlyOurPointerPath`, which requires every key along the
  pointer path to be the *only* key at that level; `bin/doctor.mjs`'s `resolveLatestVersions` (now
  exported for its own test) computes an `attemptedIds` list (excluding hosted-context7) and marks
  the cache fresh when nothing was attempted, not only when something succeeded; `detectIndent` (new)
  reads the existing indent unit (tabs, N spaces, or `null` for compact) from the raw file text and
  `serializeJson` uses it instead of a hardcoded 2. `scripts/e2e.mjs`'s two seed files were changed
  to 4-space (Claude) and tab (Codex) indentation, with a new step asserting install preserves each,
  on top of the existing byte-for-byte uninstall restoration proving the round trip end to end.
  RED: `node --test bin/lib/manifest.test.mjs bin/doctor.test.mjs` before any implementation change
  (new tests only) -> `bin/doctor.test.mjs` failed to load at all (`SyntaxError: The requested module
  './doctor.mjs' does not provide an export named 'resolveLatestVersions'`, collapsing its whole
  file); 9 of the new `manifest.test.mjs` tests failed on their own assertions (the R3-001 shape
  guards, the R3-002 fs-failure guards, the R3-003 unrelated-key guard, and all three R3-005
  indentation cases) — 32 tests, 21 pass, 11 fail.
  GREEN: `bin/lib/manifest.test.mjs` -> 31/31; `bin/doctor.test.mjs` -> included in the full run.
  Full suite: `node --test` -> `tests 189 / pass 189 / fail 0`.
  `npm run check` -> `PASS budget 858 estimated tokens (budget 1500)` / `PASS tests node --test
  passed`.
  `npm run e2e` -> all 14 steps `PASS` (13 previous + the new indentation-preservation step),
  including uninstall restoring both the 4-space and the tab-indented seed byte-for-byte.
- 2026-09-26: Unit B (T5) done, commit `7327499`. `bin/tui.mjs` gains `worstState` (the worst state
  across a doctor row's dimensions as a short label — bare `ok`/`missing`/`outdated` for the tool's
  own installed/up-to-date state, `<state> <dimension>` such as `missing codex` for a per-host/
  per-project gap, ties breaking toward the first dimension), `summarizeStackRow` (one doctor row ->
  `{ id, version, state }`), and `computeStackState` (calls `bin/doctor.mjs`'s newly-exported
  `buildReport` with `offline: true` so opening the TUI never touches the network, falling back to
  the string `'unknown'` on any probe failure). `render` stays pure: it draws `state.stack` (an
  array of rows, `'unknown'`, or omitted entirely) above the menu without probing anything itself.
  `tuiMain` computes the stack via `computeStackState` with its injected `spawn`/`fetch`/`now`
  before opening the TUI, and wires a new `doctor` menu item (`MENU_ITEMS` gained `'doctor'` right
  after `'status'`) to the full `doctorMain` — with real network per the normal 6h cache rules,
  unlike the offline startup block. Two pre-existing tests that hardcoded the old menu order (a
  single down-press landing on Install, a redraw assertion for `> Install`) were updated for the new
  item at index 1.
  RED: `node --test bin/tui.test.mjs` before any implementation change -> the whole file failed to
  load (`SyntaxError: The requested module './tui.mjs' does not provide an export named
  'computeStackState'`), 1 failing (collapsing all 34 tests in the file, old and new).
  GREEN: `bin/tui.test.mjs` -> 30/30 (after fixing the two pre-existing menu-order-dependent tests).
  Full suite: `node --test` -> `tests 203 / pass 203 / fail 0`.
  `npm run check` -> `PASS budget 858 estimated tokens (budget 1500)` / `PASS tests node --test
  passed`.
  `npm run e2e` -> all 14 steps still `PASS` (the TUI is not exercised by e2e; re-run to confirm no
  regression from the doctor.mjs/tui.mjs changes).
  `node bin/js-harness.mjs doctor` on this machine (real, read-only):
  ```
  gentle-ai       3.7.0     ok        ok        n/a       ok
  engram          2.2.1     ok        ok        n/a       ok
  codegraph       1.6.0     ok        missing   ok        ok
  context7        hosted    ok        ok        n/a       n/a
  typescript-lsp  1.0.0     ok        n/a       n/a       ok

  Fix:
    codegraph: npm i -g @colbymchenry/codegraph; gentle-ai codegraph init --cwd <root>
  ```

- 2026-09-26: The final native review (lineage `review-cef5637e2884c12a`) was approved and
  acknowledged. R3-001..R3-003 were accepted and applied directly, commit `1573bf1`; R3-004 needed
  no change — it is already covered by the 5 s per-probe timeout at `bin/lib/stack.mjs:23` (worst
  case the TUI's offline stack block waits ~5 s per probe, never longer, since every spawn call
  there already carries that timeout).
  - R3-001: `install()` in `bin/lib/manifest.mjs` was dropping a component's manifest record
    outright when a write failed, even when a previous manifest already had that file recorded —
    orphaning it (`sync`'s pruning loop would then delete the still-good previous copy, reading it
    as "no longer shipped"; `uninstall` would forget the file existed at all). Fixed: `install` now
    carries the previous `{ path, sha256 }` record forward on a write failure (marked
    `skipped: true`, with the failure's `reason`), and `sync`'s pruning loop now compares against
    `components`' own currently-declared targets rather than this run's successful writes, so a
    component that is still declared but merely failed to (re)write this run is never pruned. Added
    a `deps.writeFile` seam to `install`/`sync` (default `fs.writeFileSync`) so tests can force a
    write failure without relying on real file permissions (chmod is unreliable on Windows).
    `bin/install.mjs`'s `install`/`sync` CLIs now print one `skipped <path>: <reason>` line per
    skipped component or entry to stderr; entries also gained a real `reason` (`appendEntryToFile`
    now returns one for every skip branch) instead of the old hardcoded `(malformed JSON)` text that
    was wrong for the other skip causes R3-002 (T4) had already added.
  - R3-002: `bin/lib/manifest.test.mjs`'s "uninstall keeps a hook file js-harness created when an
    unrelated key is left in the document" test had a tautological final assertion
    (`!result.entriesRemoved.includes(target) || fs.existsSync(target)`) — always true once the
    preceding assertion had already proven `fs.existsSync(target)`, regardless of
    `entriesRemoved`'s contents. Replaced with a real assertion
    (`result.entriesRemoved.includes(target)`), which was already true under the unmodified code
    (this is a currently-true behavior the old assertion should have proven and did not — not a
    behavior change).
  - R3-003: `bin/doctor.mjs`'s `resolveLatestVersions` computed its own inline `attemptedIds` filter
    (`row.id === 'context7' && row.version === 'hosted'`), duplicating — incompletely — the rule
    `bin/lib/latest.mjs`'s `fetchLatestVersions` already applies (which also skips a row id with no
    `SOURCES` entry, a case the doctor.mjs copy did not know about). Extracted a shared
    `isLookupAttempted(row)` predicate into `latest.mjs`, exported it, and reused it in both
    `fetchLatestVersions` and `resolveLatestVersions`.
  RED: `node --test bin/lib/manifest.test.mjs` before any manifest.mjs change → 4 failing (the
  "malformed JSON hook file" test's new `record.reason` assertion, plus the three new R3-001 tests:
  `next.files.find(...)` missing the failed component's `sha256`/`skipped`/`reason` fields entirely
  since nothing carried it forward, "sync does not delete" asserting `v0.1.0` content but getting
  `v0.2.0` since the injected `writeFile` seam did not exist yet and the real write succeeded, and
  the "no record for a component that has never been written" case reading `true` where `false` was
  expected). `node --test bin/lib/latest.test.mjs` before the export existed → the whole file failed
  to load (`SyntaxError: The requested module './latest.mjs' does not provide an export named
  'isLookupAttempted'`), 1 failing (the module-load failure itself, collapsing all 22 tests in that
  file). Separately: the new R3-003 mixed-row-set (`bin/doctor.test.mjs`) and `isLookupAttempted`
  unit (`bin/lib/latest.test.mjs`) tests were also run against the *old*, unmodified
  `doctor.mjs`/`latest.mjs` predicate logic before touching it, to check for a real RED — both
  already passed, since the two real production ids in that mixed-row-set test (`context7` hosted,
  `gentle-ai` attempted-and-failed) were already handled correctly by the old duplicated predicate.
  This fix is a de-duplication/drift-prevention refactor (the old copy only mishandled a row id with
  no registered source, not present among the five real tools today), not a fix for an active bug in
  the five real tools — recorded here plainly per the "claim carries its evidence" rule rather than
  overstating a RED that did not occur. `node --test bin/install.test.mjs` before `installMain`/
  `syncMain` accepted `deps`
  → the new stderr-skip-line test failed asserting the skip line was present (empty stderr, since the
  injected `writeFile` was silently ignored and the real write succeeded).
  GREEN: `bin/lib/manifest.test.mjs` -> 34/34; `bin/lib/latest.test.mjs` -> 12/12;
  `bin/doctor.test.mjs` -> included in the full run; `bin/install.test.mjs` -> 7/7.
  Full suite: `node --test` -> `tests 210 / pass 210 / fail 0`.
  `npm run check` -> `PASS budget 858 estimated tokens (budget 1500)` / `PASS tests node --test
  passed`.
  `npm run e2e` -> all 14 steps `PASS`, unchanged from T4's run (this change touches no behavior the
  e2e script exercises beyond the existing install/sync/uninstall path, which still round-trips
  byte-for-byte).

- 2026-09-27: Per-dimension fixes done, commit `983fa59`. The gap this closes: `doctor` printed one
  flat `fix` array per tool regardless of which dimension actually gapped, so a codegraph-missing-
  only-in-Codex gap printed the npm install fix instead of the Codex registration command, and the
  table had no header. `bin/lib/stack.mjs`'s `tools[].fix` is now a function of the same `deps` bag
  the other probes take (`(deps) => ({ installed, claude, codex, project, upToDate })`, omitting a
  dimension a tool has no meaning for), so codegraph's `project` fix can carry the actual resolved
  project root instead of a literal `<root>`. `bin/doctor.mjs` gained `headerRow()` (printed above
  the table) and `rowGaps(row)` (every `{ dimension, state, fix }` gap on a row); the plain-text
  report now prints one `  <tool> (<dimension>): <command>` line per gap dimension instead of one
  flat `<tool>: <commands>` line, and `--json` rows gained a `gaps` array alongside the existing
  `fix` map. `bin/lib/digest.mjs` needed no change: `gapList`/`gapDigest` already key off `(id,
  dimension, state)` from the row itself, never `fix`, so the hook's digest is unaffected by the fix
  map's shape. `bin/tui.mjs` needed no change either: it never reads `row.fix` (only
  `installed`/`claude`/`codex`/`project`/`upToDate` via `worstState`/`summarizeStackRow`).
  Commands verified read-only before use: `claude plugin --help` confirmed `plugin enable` exists
  (`Enable a disabled plugin`), so typescript-lsp's `claude` fix uses it as specified rather than a
  fallback.
  RED: `node --test bin/lib/stack.test.mjs bin/doctor.test.mjs` after rewriting both files' tests for
  the per-dimension shape, before touching `stack.mjs`/`doctor.mjs` → `tests 67 / pass 53 / fail 14`
  (`TypeError: tool.fix is not a function` / `findTool(...).fix is not a function` for every new or
  updated fix-shape test, plus the two updated Fix-text assertions failing against the still-flat
  `codegraph: npm i -g @colbymchenry/codegraph; gentle-ai codegraph init --cwd <root>` /
  `gentle-ai: gentle-ai upgrade; gentle-ai sync` output).
  GREEN: `node --test bin/lib/stack.test.mjs bin/doctor.test.mjs bin/doctor-hook.test.mjs
  bin/lib/digest.test.mjs bin/tui.test.mjs` → `tests 111 / pass 111 / fail 0`.
  Full suite: `node --test` → `tests 220 / pass 220 / fail 0`.
  `npm run check` → `PASS budget 858 estimated tokens (budget 1500)` / `PASS tests node --test
  passed`.
  `npm run e2e` → all 14 steps `PASS`, unchanged (this change touches no behavior e2e exercises).
  `node bin/js-harness.mjs doctor` on this machine (real, read-only):
  ```
  tool            version   claude    codex     project   up to date
  gentle-ai       3.7.0     ok        ok        n/a       ok
  engram          2.2.1     ok        ok        n/a       ok
  codegraph       1.6.0     ok        missing   ok        ok
  context7        hosted    ok        ok        n/a       n/a
  typescript-lsp  1.0.0     ok        n/a       n/a       ok

  Fix:
    codegraph (codex): codex mcp add codegraph -- codegraph serve --mcp
  ```
  This is the fix this change set out to produce: exactly the Codex registration command for the one
  real gap on this machine, not the npm install fix, and a header row makes the table readable.
  `doctor --json`'s codegraph row (read-only, same run) confirmed `fix.project` reads
  `"gentle-ai codegraph init --cwd D:/js-harness"` (the actual resolved root) and `gaps` holds
  exactly one entry, `{ dimension: "codex", state: "missing", fix: "codex mcp add codegraph --
  codegraph serve --mcp" }`.

## Next step
T6.

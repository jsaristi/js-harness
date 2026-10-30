# Doctor reads Codex 0.166's hook trust, and the missing daemon

Locator: `odd/tasks/codex-trust-table.md` · Engram mirror: `odd/codex-trust-table/tasks` · Branch: `fix-codex-trust-table`
Delivery: one pull request · Test runner: `node --test`

## Goal
Doctor's `codex-trust` row reads `ok` on the config.toml shape Codex 0.166 writes when every harness hook is trusted,
and `missing` when one is not; the steps that repair Codex's missing managed daemon on this machine are written here.

## Why
Codex 0.166 writes an empty `[hooks.state]` table header before the per-place trust tables, and plugin hooks keyed
`"engram@engram:hooks/hooks.json:<event>:<group>:<handler>"` with a `trusted_content_hash` line. `trustedPlaces`
(`bin/lib/codex-trust.mjs`) refuses any `[hooks.state]` table, so doctor's catch (`codexTrustState`,
`bin/lib/stack.mjs`) reads `unknown` although all four harness hooks are trusted: the row says nothing true.

## Done when
- `node --test bin/lib/codex-trust.test.mjs bin/codex-hook-trust.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/codex-trust-table.md` exits 0
- `npm run check` exits 0
- the 0.166-shape test was red before the fix and green after it, named in `## Log`
- `## Daemon` holds the exact steps for him, none of them run here

## In scope / Out of scope
- In: `bin/lib/codex-trust.mjs`, its test, `bin/codex-hook-trust.test.mjs`, this document, the session's summary
  under `docs/sessions/`.
- Out: `~/.codex` (only the daemon folder's listing and the header lines and key names of config.toml's hook tables
  were read, never a value), `~/.claude`, gentle-ai's config, credentials; running any daemon step.

## Constraints
- The fixture is copied in shape only: no hash, path or value of his config.toml enters the repo — because it is his.
- Hook trust in a form this does not read is still refused, never guessed at: an empty `[hooks.state]` table is read,
  one holding keys is not — because a key there is trust in a form `moveTrust` cannot move.

## Ask me before
- Nothing of his is touched; any daemon step is his to run.

## Specs
- S1 (the lead's brief `briefs/2026-10-30T13-34-34-685Z-d9dceb79.md`, item 1): "Reproduce from a fixture copied in
  shape (no hashes of his needed; never copy his config.toml into the repo), make the row `ok` on that shape and keep
  `missing` for an untrusted hook."
- S2 (same, item 2): "Find, from Codex's docs, release notes or issues, how the managed daemon is installed on
  Windows for an npm/pnpm install, and write the exact steps for him in the feature document. Do not run any of them:
  his ~/.codex is his. If doctor should tell this state (a daemon junction with no executable), propose it in the
  document; build it only if it is small and test-first."
- S3 (same): "Done when: the trust row reads ok on his config's shape with a failing-then-passing test, the daemon
  steps are written, the PR is ready."

## Tasks
- [x] T1 (kind: build) `tables` reads an empty `[hooks.state]` table and still refuses one with keys; doctor's row ok
  on the 0.166 shape, missing for an untrusted hook — S1; inline, test first
- [x] T2 (kind: docs) the daemon: mechanism and steps in `## Daemon`, the doctor proposal — S2; one research
  sub-agent, read-only; the repair itself done by the lead (L7)
- [ ] T3 (kind: verify) Codex and the lenses on the code commit; `npm run check`; PR, ready notice, summary — S3

## Daemon
Repaired by the lead with his authorization while this session researched (L7); the steps below are the ones that
worked, then the mechanism behind them, so the next time it happens it is one read.

### The steps that worked (the lead's, checked by listing in L8)
1. Keep the broken package aside: `~\.codex\packages\app-server-daemon` renamed to `app-server-daemon.broken` (his).
2. Copy the CLI's own platform package, pnpm's `@openai/codex-win32-x64` `vendor\x86_64-pc-windows-msvc` folder (it
   holds `bin\codex.exe` and a `codex-package.json` of the same layout), to
   `~\.codex\packages\app-server-daemon\releases\0.166.0-x86_64-pc-windows-msvc`.
3. Point a junction `~\.codex\packages\app-server-daemon\current` at that release.
4. `codex app-server daemon start` says it started, and `codex app-server daemon version` says it runs 0.166.0.
- Undo: `codex app-server daemon stop`, delete `packages\app-server-daemon`, rename `app-server-daemon.broken` back.
- Once Codex has run well for a while, `app-server-daemon.broken` can go; it is his to delete.

### The mechanism (the research sub-agent, from Codex's source at tag `rust-v0.166.0` and its issues)
- The daemon commands are `codex app-server daemon <start|stop|update|version|...>`; `codex daemon` is no subcommand
  (its `--help` prints the top-level help), which is why `daemon update` answered as it did.
- A first `start` copies the running CLI's own package folder into `releases\<ver>-<target>` and points `current` at
  it (`codex-rs/app-server-daemon/src/prepare_install.rs:30-43,148-173,299-320`); the npm launcher tells it where that
  folder is (`CODEX_MANAGED_PACKAGE_ROOT`, `bin/codex.js:226-234` of the pnpm copy).
- It reinstalls nothing while `current` exists or any of `daemon.pid`, `daemon.stderr.log`, `daemon-updater.pid`,
  `daemon-updater.stderr.log` is in `~\.codex\app-server-daemon\`: it fails "daemon executable not found" instead
  (`prepare_install.rs:113-118`, `lib.rs:1075-1086`). That is why renaming the package folder alone did not help. Open
  upstream: https://github.com/openai/codex/issues/53546 (Windows, stale daemon package selection); related #48161
  (`codex.exe` gone after an update) and #53935 (the same loop on Linux).
- Later updates come hourly, apart from pnpm: the updater runs `https://chatgpt.com/codex/install.ps1` with
  `CODEX_INSTALL_DAEMON_ONLY=1` (`update_loop.rs:75-77,603-623`). Pinning to the CLI's copy is
  `codex app-server daemon update --from-cli -y`; `codex app-server daemon update` returns to the updater.
- Without the daemon for good: `features.daemon_auto_start = false` under `[features]` in config.toml, or
  `codex features disable daemon_auto_start`; once, `--no-daemon`. Not tried here.
- Not known: what emptied `bin\` on Oct 21 (the updater's log ends Oct 8; antivirus was not checked).

### Proposal: a doctor row for the daemon (not built)
A `codex-daemon` check row, read-only like `codex-trust`: under the Codex home (`codexHomeOf`), read
`packages\app-server-daemon\current\codex-package.json` and say `missing` when `current` is there but its
`entrypoint` file is not (his state on Oct 30), with the fix naming the steps above; `n/a` with no `current`
(no daemon yet, or `--no-daemon` use); `ok` when the entrypoint exists. Not built in this PR (L9): it is a new doctor
row, which moves the ordered row lists four test files assert (`doctor`, `stack`, `tui`, `js-harness`) and the
session-start report, so it is its own small feature rather than part of this fix; and his machine no longer has the
state to show it on. The lead decides whether it goes to the roadmap.

## Log
- L1 (the lead's brief, as written): "doctor: read Codex 0.166's hook trust table, and the missing daemon" — items 1
  and 2 quoted in S1 and S2.
- L2 (evidence): his config.toml, read for headers and key names only (a script printed `<value>` for each value):
  one `[hooks.state]` header with no key, nine `[hooks.state.'C:\Users\Oficina\.codex\hooks.json:<event>:<g>:0']`
  tables with `trusted_hash`, six `[hooks.state."engram@engram:hooks/hooks.json:<event>:<g>:0"]` tables with
  `trusted_hash` and `trusted_content_hash`.
- L3 (evidence): `~/.codex/packages/app-server-daemon.broken/`: `auto-update-version` (`0.162.0-x86_64-pc-windows-msvc`),
  empty `install.lock`, `current` a link to `.../app-server-daemon/releases/0.162.0-x86_64-pc-windows-msvc` (the
  pre-rename path), and that release's `codex-package.json` names `entrypoint: bin/codex.exe` while `bin/` is empty
  (mtime Oct 21; the release's other files Oct 8). `codex --version`: `codex-cli 0.166.0`.
- L4 (red, then green): with the tests first, `node --test bin/lib/codex-trust.test.mjs bin/codex-hook-trust.test.mjs`
  failed 3 of 23 (the 0.166-shape unit test; the doctor test, `actual: 'unknown', expected: 'ok'`; and the quoted
  spellings test, whose empty `['hooks'.state]` moved from refused to read); after the fix in `tables`, 23 of 23 pass.
- L5 (evidence): on his real home, the branch's `node bin/js-harness.mjs doctor --json --offline` gives the
  codex-trust row `{"codex":"ok","gaps":[]}`; the installed `js-harness doctor` gives `unknown`.
- L6 (decision): an empty `[hooks.state]` is read and `moveTrust` keeps it as written; a key in it is still refused
  (`a [hooks.state] table with keys`), since trust spelled there is a form `moveTrust` cannot move. The engram
  plugin's tables need no change: their key's path, `engram@engram:hooks/hooks.json`, never names the harness's
  hooks.json, and `trusted_content_hash` is not `trusted_hash`, so only the latter counts.
- L7 (the lead's notice, 08:41, a session's claim): "item 2 is done by the lead with his authorization:
  ~/.codex/packages/app-server-daemon/releases/0.166.0-x86_64-pc-windows-msvc is a copy of pnpm's
  vendor/x86_64-pc-windows-msvc (same layout, codex-package.json 0.166.0), current is a junction to it, daemon start
  says started and version says running 0.166.0. Write that as the found steps; a doctor row for a junction with no
  entrypoint is still yours to propose."
- L8 (evidence, read-only listing): `~/.codex/packages/app-server-daemon/current` links to
  `releases/0.166.0-x86_64-pc-windows-msvc`, whose `bin/` holds `codex.exe` (371,735,856 bytes) and
  `codex-code-mode-host.exe`, and whose `codex-package.json` reads `version 0.166.0`, `entrypoint bin/codex.exe`.
  `daemon start` and `version` were not run here.
- L9 (decision, within the plan): the doctor row is proposed in `## Daemon`, not built; the reasons are written there.

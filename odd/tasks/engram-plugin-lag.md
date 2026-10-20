# Engram plugin lag: doctor shows a Claude plugin behind its binary

Locator: `odd/tasks/engram-plugin-lag.md` · Engram mirror: `odd/engram-plugin-lag/tasks` · Branch: `fix/engram-plugin-lag`

## Goal
`js-harness doctor` shows the engram Claude Code plugin as `outdated` whenever it is older than
the plugin the engram binary's own release tag ships, with both versions and the commands that
update it, and the engram latest-release lookup ignores engram's `pi-v*` release stream.

## Why
The update review of engram 3.4.0 → 3.5.1 on 2026-10-20 found the binary at 3.5.1 while the
plugin `engram@engram` stayed at 0.1.12 (`~/.claude/plugins/installed_plugins.json`); the v3.5.1
tag ships plugin 0.1.14, with hook fixes for compaction registration and resumed sessions (engram
PRs 1765, 1935, 1945). `doctor` showed engram `ok` all the same: it watches the binary and never
the plugin, whose hooks run in every Claude session. Separately, engram publishes a second release
stream (`pi-v0.5.0`, …) in the same repository, and `releases/latest` returns whichever was
published last, so engram's latest version could read `pi-v0.5.0`.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/engram-plugin-lag.md` exits 0
- `node --test bin/lib/latest.test.mjs bin/lib/stack.test.mjs bin/doctor.test.mjs` exits 0
- `node bin/js-harness.mjs doctor --offline` on this machine shows an `engram-plugin` row with
  version 0.1.12 and `outdated`, its fix naming 0.1.14 and engram v3.5.1 (observed, Log)

## In scope / Out of scope
- In: `bin/lib/stack.mjs`, `bin/lib/latest.mjs`, `bin/doctor.mjs` and their tests; `README.md`,
  `docs/SPEC.md`, `docs/GUIDE.md` where it lists doctor's rows; this document.
- Out: updating the plugin or the marketplace on this machine (the person does that; `doctor`
  reports, it never installs); a network read of the manifest at the tag (see D2).

## Constraints
- Zero dependencies and fixture-based tests, never the network — because every command runs on
  any machine with no install step, and a test must never read or write the real home.
- Fail open: no git, no marketplace clone, no tag, or an unparseable manifest is `unknown`, never
  a gap and never a throw — because `doctor` is a report, not a gate.

## Effort
medium

## Ask me before
Nothing beyond AGENTS.md: spend and anything irreversible.

## TDD
Mode: strict. Runner: `node --test`.

## Delivery
Forecast: ~200 authored lines. Under the ~400 budget: one PR against `main`. Strategy: `ask-on-risk`.

## Specs
- S1 "make `js-harness doctor` report when the engram Claude Code plugin lags the engram binary"
- S2 "a doctor row or note naming the plugin's installed version, the version the binary's tag
  ships (read from the plugin manifest at that tag, or the marketplace clone
  ~/.claude/plugins/marketplaces/engram), and the fix command (`claude plugin update
  engram@engram` or the right form — verify it)"
- S3 "fail-open offline"
- S4 "the latest-release lookup (bin/lib/latest.mjs:64) must ignore engram's separate `pi-v*`
  release stream"
- S5 "tests with fixtures, never the network; help, README and SPEC updated"

## Decisions
- D1 A row of its own, `engram-plugin`, shown only while `engram@engram` is installed and enabled
  in Claude Code: only then do its hooks run, so a machine without the plugin sees no new row and
  no new gap. Its `claude` cell is `ok` by construction, `codex` and `project` are `n/a`.
- D2 The version the tag ships is read offline from the marketplace clone with
  `git show v<binary>:.claude-plugin/marketplace.json`: Claude Code fetches that clone with its
  tags, so the tag is there without a request, and `--offline` gives the same answer. The clone's
  working tree is not read: it can sit behind its fetched refs (here 21 commits, still 0.1.12). A
  tag the clone lacks is `unknown`; a network read was left out to keep the row uncached and
  request-free.
- D3 The fix is two commands, verified by `--help` on Claude Code 2026-10-20: `claude plugin
  marketplace update engram` refreshes the catalog (its working tree says 0.1.12 here), then
  `claude plugin update engram@engram` updates the plugin ("restart required to apply"). Not run
  on this machine.
- D4 engram's latest version comes from the releases list, the highest `v<semver>` tag that is
  neither a draft nor a prerelease; gentle-ai keeps `releases/latest`, it has one stream.

## Tasks
- [x] T1 (kind: build) S4 — engram lookup ignores `pi-v*` (inline; RED 3 failing in latest.test.mjs, GREEN 24/24)
- [x] T2 (kind: build) S1–S3, S5 — `engram-plugin` row and its latest source (inline; RED 4 + 5 + 1, GREEN)
- [x] T3 (kind: docs) S5 — help, README, SPEC, GUIDE (inline)
- [ ] T4 (kind: verify) — `npm run check`, gentle-ai and Codex reviews, PR (inline; `a6f525e4` gentle-ai approved, L5)

## Log
- L1 2026-10-20 request (from the lead session): "In js-harness (D:\js-harness), make `js-harness
  doctor` report when the engram Claude Code plugin lags the engram binary. Found 2026-10-20: the
  binary is 3.5.1 but the plugin `engram@engram` stays at 0.1.12
  (~/.claude/plugins/installed_plugins.json) while the v3.5.1 tag ships plugin 0.1.14 with hook
  fixes (compaction registration, resumed sessions; engram PRs 1765, 1935, 1945); doctor showed
  engram "ok" anyway. Also the latest-release lookup (bin/lib/latest.mjs:64) must ignore engram's
  separate `pi-v*` release stream."
- L2 2026-10-20 evidence: `git -C ~/.claude/plugins/marketplaces/engram show
  v3.5.1:.claude-plugin/marketplace.json` → plugin version 0.1.14; the working tree's
  marketplace.json → 0.1.12; `git status -sb` → `behind 21`. `releases?per_page=8` lists
  `pi-v0.5.0` between `v3.5.1` and `v3.4.0`, none draft or prerelease.
- L3 2026-10-20 observed on this machine, `node bin/js-harness.mjs doctor --offline`:
  `engram          3.5.1     ok        ok        n/a       ok`,
  `engram-plugin   0.1.12    ok        n/a       n/a       outdated`, and its fix
  `plugin 0.1.12 is behind 0.1.14, the plugin engram v3.5.1 ships; update it, then restart Claude Code:`,
  `claude plugin marketplace update engram`, `claude plugin update engram@engram`. The plugin was not updated.
  The run also joined `engram-plugin 0.1.12` to the stack-update record in the doctor cache, as any new tool joins.
- L4 2026-10-20 two doctor fixtures mocked engram's `releases/latest` body; they now mock the releases list.
- L5 2026-10-20 gentle-ai review, lineage `review-bc11b71ae8b02ac4`, lenses resilience, readability and
  reliability over `a6f525e4`: approved, acknowledged (`authority: burned`), seven non-blocking findings.
  Taken in the follow-up commit: R3-git-fixture-config (the fixture runs git with no global or system
  config), R3-git-parent-discovery (a marketplace folder with no `.git` of its own is never handed to
  git), R2-duplicated-semver-pattern (one plain-semver rule), R2-per-page-constant and
  R4-releases-window-30 (a named page size and its limit stated), R4-sync-git-serializes-lookups (the
  network lookups start before the git read, with a test of the order), R3-prose-in-fix-array (a
  `--json` test pins the fix's shape; a first prose line in a fix list has precedent in the `unseen`
  and `worktrees` rows).

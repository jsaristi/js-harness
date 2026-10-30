# Doctor's row for Codex's managed daemon, and the engram plugin's ahead text

Locator: `odd/tasks/codex-daemon-row.md` · Engram mirror: `odd/codex-daemon-row/tasks` · Branch: `feat/codex-daemon-row`
Delivery: one pull request · Test runner: `node --test`

## Goal
`doctor` has a `codex-daemon` row that reads `ok` when Codex's managed daemon has its executable, `missing` in the
state of 2026-10-21 (a `current` that resolves to no executable, or no `current` while Codex will not reinstall one),
and `n/a` where Codex has no managed daemon; and the engram plugin's ahead-of-binary fix says what holds when the
binary is already engram's latest release.

## Why
On 2026-10-21 Codex's `current` junction named a release whose `bin\` was empty, and the TUI failed with "daemon
executable not found"; nothing in `doctor` said so (`odd/tasks/codex-trust-table.md`, `## Daemon`). On 2026-10-30 doctor
told him to update the engram binary while 3.6.0 was engram's latest release, advice that cannot be followed.

## Done when
- `node --test bin/lib/codex-daemon.test.mjs bin/lib/stack.test.mjs bin/doctor.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/codex-daemon-row.md` exits 0
- `npm run check` exits 0
- each new test was red before its code and green after it, named in `## Log`
- the branch's `doctor --json --offline`, run read-only on this machine, gives the `codex-daemon` row `ok`, named in
  `## Log`
- `docs/ROADMAP.md` holds the task under F8 with his answer to question 123

## In scope / Out of scope
- In: a new `bin/lib/codex-daemon.mjs` and its test, `bin/lib/stack.mjs`, `bin/doctor.mjs`, the tests that list the
  doctor rows, `docs/ROADMAP.md`, this document, the session's summary under `docs/sessions/`.
- Out: writing anything under `~/.codex`, `~/.claude`, gentle-ai's config or credentials (the row only reads); a
  network read for the engram text (D2 of `odd/tasks/engram-plugin-lag.md` stands); running any daemon step.

## Constraints
- The row reads files only and never writes under the Codex home — because that home is his, and the session-start
  report runs every check that starts no process.
- The fixtures are temp homes shaped like the layout, never a copy of his — because his ~/.codex is his.

## Ask me before
- Nothing of his is touched; any daemon step is his to run.

## Specs
- S1 (the lead's brief `briefs/2026-10-30T16-08-45-364Z-78590333.md`, item 1): "Build that row test first, from fixture
  homes only: ok when `current` resolves to a release with its executable, a broken state when the junction or the
  executable is missing, n/a where Codex has no managed daemon; its fix names the repair steps written in that
  document. Read-only on ~/.codex. Add the task to docs/ROADMAP.md under F8 with his answer quoted (question 123, the
  line above)."
- S2 (same, item 2): "With no network read (decision D2 of `odd/tasks/engram-plugin-lag.md` stands), make the fix text
  say both cases: update the binary if a newer release exists, otherwise the plugin is ahead of engram's last release
  and nothing is to be done until the next one. Test first. Whether the cell should stay a gap in that case is yours to
  argue in the document; change it only with a test and say why."
- S3 (same): "Done when: the daemon row reads ok on this machine's real layout (doctor run read-only) and broken on the
  fixture of 2026-10-21's state, the engram text is fixed, the roadmap holds the task, and the PR is ready."

## Tasks
- [x] T1 (kind: build) the `codex-daemon` check row: state, fix, its place in the row lists — S1; inline, test first
- [x] T2 (kind: build) the engram plugin's ahead fix names the case that holds, both when not known — S2; inline, test
  first
- [x] T3 (kind: docs) the roadmap's F8 task with question 123 — S1
- [x] T4 (kind: verify) doctor read-only here; Codex and the lenses on the code commits; `npm run check`; PR, ready
  notice, summary — S3

## Decisions
- D1 The broken state is `missing` in the `codex` cell, as the proposal had it: `GAP_STATES` (`bin/lib/digest.mjs`)
  has no `broken`, and a new gap state would move every reader of it for one row.
- D2 "The junction is missing" is a gap only where Codex will not reinstall one: no `current` while any of
  `daemon.pid`, `daemon.stderr.log`, `daemon-updater.pid`, `daemon-updater.stderr.log` is in
  `<codex home>/app-server-daemon/` (the research in `codex-trust-table.md`, `## Daemon`, `prepare_install.rs:113-118`):
  that is the state renaming the package folder left on 2026-10-30. No `current` and none of those files is `n/a`: no
  daemon yet, and the next start installs one.
- D3 A `current` whose `codex-package.json` cannot be read or names no `entrypoint` is `unknown`: the research did not
  read what Codex does with such a release, so the row does not claim it.
- D4 The engram text uses the engram binary's latest version doctor already resolves for the `engram` row (the releases
  list, cached 6 h, the cache alone with `--offline`), so it makes no request of its own: with that version known it
  says the one case that holds; with it unknown it says both.
- D5 The cell stays `mismatch`, a gap, when the binary is engram's latest release: the plugin and the binary still
  serve different protocols, which is what the gap reports, and its fix now says nothing can be done until the next
  release. Clearing it would hide a real mismatch on the day a newer binary lands within the 6 h cache, and would need
  a state that is a gap on one day and not on the next for the same versions.

## Log
- L1 (the lead's brief, as written): "JH 103 · doctor: a row for Codex's managed daemon, and engram's mismatch text"; his
  answer to question 123 (lead transcript 0f71b2c6-cbce-43ca-a031-276a4b2c381f line 32757): "Sí, agrégala". Items 1
  and 2 quoted in S1 and S2.
- L2 (evidence, read-only listing): `~/.codex/packages/app-server-daemon/current` is a link to
  `releases/0.166.0-x86_64-pc-windows-msvc`, whose `codex-package.json` names `entrypoint bin/codex.exe` and whose
  `bin/` holds `codex.exe`; `~/.codex/app-server-daemon/` holds `daemon.pid`, `daemon.stderr.log`,
  `daemon-updater.pid` and `daemon-updater.stderr.log`.
- L3 (searched, before adding): `js-harness rules` and the code for a daemon check (`codex-daemon`, `app-server-daemon`,
  `daemon executable`): none; the neighbours read are `bin/lib/pnpm-lock.mjs` (a check in its own module, a FIX
  constant and a state function) and `codexTrustState` in `bin/lib/stack.mjs`; `bin/lib/clean.mjs` reads the same
  folder (`codexDaemon`, `currentCodex`) to keep `current`'s release out of its leftovers, a different question. For S2, `doctor`'s `buildReport`
  already holds the engram binary's latest version (`latestVersions.engram`) when it calls `upToDateFix`.
- L4 (red, then green, T1): with the tests first, `node --test bin/lib/codex-daemon.test.mjs` failed (no module); with
  the module and `bin/lib/stack.mjs` as committed before, `node --test bin/lib/stack.test.mjs bin/doctor.test.mjs
  bin/tui.test.mjs bin/js-harness.test.mjs` failed 8 of 351 (the row lists, the doctor table's positions, the stack
  test of the row); with both, those five files pass 358 of 358.
- L5 (evidence, T1): on this machine, the branch's `node bin/js-harness.mjs doctor --json --offline` (it reads
  ~/.codex, writes nothing there) gives `{"id":"codex-daemon",...,"codex":"ok",...,"gaps":[]}`; the fixture of
  2026-10-21's state is `missing` (`codex-daemon.test.mjs`, "the state of 2026-10-21"). The same run shows S2's
  defect live: `engram` 3.6.0 with `upToDate` `ok`, and `engram-plugin` 0.1.19 `mismatch` telling him to update
  the engram binary.
- L6 (red, then green, T2): with the tests first, `node --test bin/lib/stack.test.mjs bin/doctor.test.mjs` failed 4
  of 211 (the three `upToDateFix` tests and the doctor test); after `upToDateFix` reads
  `latestVersions.engram`, which `buildReport` now passes, 211 of 211.
- L7 (evidence, T2): the branch's `doctor --json --offline` on this machine gives the `engram-plugin` fix
  "plugin 0.1.19 is ahead of 0.1.17, the plugin engram v3.6.0 ships, so the two serve different protocols; engram v3.6.0
  is engram's latest release, so the plugin is ahead of engram's last release and nothing is to be done until the next
  one: then update the engram binary and restart Claude Code", the cell still `mismatch` (D5).
- L8 (reviews of `04e3d29..27bba80`, the code commits `1da156e` and `22c6317`): the Claude lenses reliability,
  readability and resilience, 0 findings each (40,178, 40,082 and 40,192 input tokens); Codex, "the patch is incorrect
  (confidence 0.96)", one P2: an entrypoint that is a folder reads `ok`, and the stack test made it so with `mkdirSync`
  (127,922 input tokens, 90,880 cached). Accepted: a test of a folder entrypoint failed 1 of 8, then `isFile` in
  `codexDaemonState` and a written file in the stack test, 124 of 124.
- L9 (reviews of the fix, `27bba80..36dbe52`): Codex, "the patch is correct (confidence 0.99)", the P2 fixed (31,491
  input tokens); the lenses reliability and resilience, 0 findings (10,903 and 5,170 input tokens). No gentle-ai
  review: the brief asked for Codex and the lenses.

# Clean: regenerable leftovers, listed, confirmed, recorded

Locator: `odd/tasks/clean.md` · Engram mirror: `odd/clean/tasks` · Branch: `feat/clean`
Delivery: one pull request, two work-unit commits (the command; the periodic measure, its doctor row and the docs).
Test runner: `node --test`.

## Goal
`js-harness clean` lists the regenerable leftovers our way of developing leaves on a machine, with their sizes,
deletes only the kinds the user confirms and records each deletion; a cheap weekly measure recommends it when they
pass a threshold.

## Why
On 2026-10-20 Sebastián cleaned about 9 GB by hand with PC Manager: old Codex app-server releases, old Claude Code
versions, package caches and test scratch in the temp folder, most of them made by this stack. Nothing deleted them,
and nothing told him they were there. A command that knows them, asks, and keeps a record, plus a measure that tells
him when it is worth running, is the fix.

## Done when
- `node --test bin/clean.test.mjs bin/lib/clean.test.mjs bin/doctor.test.mjs bin/js-harness.test.mjs bin/readme.test.mjs` exits 0
- `npm run check` exits 0
- `js-harness clean` on this machine lists the kinds with their sizes and deletes nothing.

## In scope / Out of scope
- In: a new `bin/clean.mjs` and `bin/lib/clean.mjs` with their tests; the dispatcher (`bin/js-harness.mjs`); a
  `clean` row in `bin/doctor.mjs` and its hook notice; `bin/lib/host-update.mjs` (exports its app folders);
  README, `docs/GUIDE.md`, `docs/SPEC.md`, `docs/ROADMAP.md`.
- Out: deleting anything by hand that a tool owns (package caches go through their own commands); any path not on
  the known list; the orchestrator's question channel (see S9 for why the doctor row was picked).

## Constraints
- Every destructive test runs on a `mktemp -d` scratch home, never the real home — because a test that deletes on
  the real machine is the failure this command must never be.
- Nothing is deleted on the real machine while this is built — because the user is away and deletion is his call.

## Ask me before
The defaults marked "Assumption" below: the interval, the threshold, the age of scratch, and the wording of the
notice. They were picked while he was away; the orchestrator asks him later.

## Specs
- S1. Sebastián (2026-10-20, verbatim): "Listo hagamos esto" — yes to the command: list the regenerable leftovers it
  knows, with their sizes; delete only on his yes; record what was deleted.
- S2. Sebastián (2026-10-20, verbatim): "Quiero que ese js-harness clean sea tambien inteligente y cada cierto tiempo
  le pida permiso al usuario osea el harnes analiza que tanta basura tiene y le recomienda al usuario aplicar el
  clean".
- S3. `js-harness clean` with no flags is read-only: for each known kind it prints its id, why it is safe to delete,
  and each item with its path and size, then a total. `--json` prints the same as data. It deletes nothing and writes
  only the measure record (S7).
- S4. The known kinds, each checked on this machine (read-only, 2026-10-20):
  - `codex-releases`: every folder under `~/.codex/packages/app-server-daemon/releases` except the one `current`
    resolves to and the one `auto-update-version` names; nothing when `current` cannot be resolved. Seen: four old
    releases of about 430 MB each.
  - `claude-versions`: every file under `~/.local/share/claude/versions` except the highest version and the one
    `claude --version` reports; nothing when the running version cannot be read. Seen: 2.1.296 and 2.1.300 beside
    the running 2.1.301, about 260 MB each.
  - `claude-desktop-cli`: every version folder under the desktop app's `claude-code` (the MSIX `LocalCache` copy or
    `%APPDATA%\Claude`) except the highest, which the app runs. Seen: 2.1.299 beside the running 2.1.304.
  - `codex-staging`: every entry of `~/.codex/.tmp/marketplaces/.staging` whose newest file is older than the scratch
    age. Seen: seven `marketplace-upgrade-*` folders, about 960 MB.
  - `temp-scratch`: every folder at the top of the system temp folder named `tmp.*` (`mktemp -d`) or `js-harness-*`
    (this repo's tests) whose newest file is older than the scratch age and that holds no linked git worktree.
  - `npm-cache`, `pnpm-store`, `go-modcache`, `uv-cache`: only when the tool answers; sized from the folder the tool
    names (npm's default folder when it names none), and cleaned only by `npm cache clean --force`,
    `pnpm store prune`, `go clean -modcache` and `uv cache clean`, never by hand. `pnpm store prune` frees only what no
    project uses, so its size is "up to".
- S5. `js-harness clean --apply` scans again and deletes only the kinds the user confirms: in a terminal it asks y/N
  per kind; without one it deletes only the kinds named with `--kind <id>` (naming a kind is the confirmation), and
  with neither it deletes nothing and exits 1. An unknown kind is a usage error, exit 2.
- S6. Each deletion is appended to `~/.js-harness/clean-log.jsonl` (when, kind, path or command, bytes, result), and
  `js-harness clean --log` prints it. A failed deletion is recorded as failed and the rest go on.
- S7. It never deletes: `~/.claude/projects`, engram's store (`~/.engram`), `~/.js-harness`, the current Codex
  runtime, the running Claude, anything inside a git worktree, anything not found by the scan of the same run. A
  folder is renamed before it is removed, so one in use (a running binary on Windows) fails whole and is kept.
- S8. The smart part: a measure (`js-harness clean --measure`) writes `~/.js-harness/clean.json` with the sizes and
  never deletes. `doctor` and its session-start hook start it in the background, at most once every 7 days
  (Assumption), so the hook stays inside its 10 seconds, and only for the machine's own home: a home named with
  `--home` or `JS_HARNESS_HOME` is a fixture or a practice home, and `JS_HARNESS_CLEAN_MEASURE=off` turns it off. When the measured total is 2 GB or more (Assumption), the
  `clean` row of doctor is a gap whose fix recommends `js-harness clean` and says `--apply` deletes only what he
  confirms, and the hook's notice names the size. It notices once per measure, never deletes by itself.
- S9. The place: the doctor row and its hook, not `notify --to orchestrator --kind question`. The hook already runs
  at every session start on every machine, has a cache and notices a gap only when its digest changes; a question
  sent from a session-start hook would need an orchestrator running and would be sent by every session that starts.
- S10. Assumptions (his to confirm): interval 7 days; threshold 2 GB; scratch age 3 days; scratch names `tmp.*` and
  `js-harness-*`; the notice wording "<size> of leftovers to clean: js-harness clean".
- S11. `js-harness clean --help`, the README and the user guide document it.

## Tasks
- [x] T1 (S3-S7, kind: build) The command: scan, list, apply with confirmation, log, refusals, with tests on a
  scratch home. Route: inline (one unit, no Writer trigger). RED: `bin/lib/clean.test.mjs` and `bin/clean.test.mjs`
  failed whole (no module). GREEN: 20/20 and 9/9; `bin/writing-flags.test.mjs` 44/44 with the three clean rows.
  Real run on this machine, read-only: 4.3 GB listed plus up to 5.9 GB of pnpm store, 37 seconds (L3).
- [x] T2 (S8-S11, kind: build) The measure, the doctor row and its notice, help, README, guide, SPEC, roadmap.
  Route: inline (depends on T1). RED: the clean-row test of `bin/doctor.test.mjs` (no row). GREEN: `bin/doctor.test.mjs`
  90/90, `bin/js-harness.test.mjs` 49/49 (the row list names `clean`; a named home starts no measure).
- [ ] T3 (kind: verify) Gate, gentle-ai review per code commit, Codex review, pull request, ready notice.

## Next step
T3: Codex review of e22ef3f1..HEAD (running), then push (retry after a minute when github.com fails), the PR, notify ready.

## Log
- L1 (2026-10-20, his words, verbatim, relayed by the orchestrator): "Listo hagamos esto" and "Quiero que ese
  js-harness clean sea tambien inteligente y cada cierto tiempo le pida permiso al usuario osea el harnes analiza que
  tanta basura tiene y le recomienda al usuario aplicar el clean".
- L2 (2026-10-20): read-only survey of this machine. `current` → releases/0.162.0; releases 0.157.1, 0.158.0,
  0.159.0, 0.159.1 (426-428 MB each); `.staging` 962 MB; `~/.local/share/claude/versions` 2.1.296, 2.1.300, 2.1.301
  (running, `claude --version`); desktop `claude-code` 2.1.299 and 2.1.304 (running processes from 2.1.304); npm 12
  answers `undefined` to `npm config get cache`, its folder is `%LOCALAPPDATA%\npm-cache`; pnpm, go and uv each name
  their folder. `du` of these took over two minutes, so the hook cannot measure inline: it starts the measure
  detached.
- L3 (2026-10-20): the first real `js-harness clean` took 37 seconds and listed codex-releases 1.7 GB, claude-versions
  506.7 MB, claude-desktop-cli 256.8 MB, codex-staging 934.9 MB (16 folders by then), go-modcache 544.7 MB, uv-cache
  483.4 MB and the pnpm store at `D:\.pnpm-store\v11`, up to 5.9 GB; no temp scratch was old enough, and npm's cache held
  nothing. pnpm names the store of the drive it runs on (C: from the home, D: from this checkout), so the scan and the
  clean both run the tools from the home: a store on another drive is not seen (a follow-up, not this feature).
  The background measure starts only for the machine's own home, because the whole-cycle tests and the practice
  runs name a scratch home with `JS_HARNESS_HOME` and a detached measure would outlive them.
- L4 (2026-10-20): gentle-ai: f4c550e7 and 9e66d1a1 reviewed in lineage review-cbebddd665ec664f (escalated to high,
  item 1; lenses risk, resilience, reliability), approved and acknowledged, authority burned, ten advisories.
- L5 (2026-10-20): advisories R1-001, R3-nested-full-repo, R3-duplicate-kind, R4-cache-failure-error-lost fixed in
  ba519eb7; the rest (rename of a running file, the measure written in place, the auto-update name format, a hand-edited
  measure) left as follow-ups. gentle-ai evidence per code commit, for the merge queue:
  - gentle-ai: f4c550e7 reviewed in lineage review-cbebddd665ec664f (lenses risk, resilience, reliability), approved and acknowledged.
  - gentle-ai: 9e66d1a1 reviewed in the same lineage review-cbebddd665ec664f, approved and acknowledged.
  - gentle-ai: ba519eb7 reviewed in lineage review-72559356176c153c (lenses risk, reliability), approved and acknowledged.
- L6 (2026-10-20): Codex reviewed e22ef3f1..ba4d8410 in 3 parts, recorded. Part 2 found two defects, fixed test-first:
  [P1] a cache folder inside a git worktree, holding a git repository or a protected path went to its tool's clean
  command unchecked; it is now refused and recorded, the tool not run. [P2] an old regular file named tmp.* or
  js-harness-* was listed as scratch; only folders are now.
  - gentle-ai: 41b4a893 reviewed in lineage review-d76fbd52b2b7a939 (lenses risk, reliability), approved and acknowledged.
- L7 (2026-10-20): advisory R3-cache-git-checkout-refusal was real here: the uv cache of this machine keeps a .git
  in sdists-v9, so 41b4a893 refused uv cache clean for good. A cache holding a git repository now goes to its tool
  when a CACHEDIR.TAG with its signature marks it a cache (uv tags its cache), and is refused otherwise. Left as
  follow-up: R1-001, the tool re-resolves its cache folder after the check (needs the environment to change mid-run).

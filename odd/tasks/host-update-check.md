`js-harness doctor` watches the Claude Desktop app and its Code tab CLI for updates, and says when one is due a review or is downloaded and not applied.
Branch: feat/host-update-check. Delivery: single-pr. Tests: `node --test`.

## Goal
A desktop or Code tab CLI update is never missed: `doctor` names it with its old and new versions and the review
steps until the review is recorded, and says when an update is downloaded but not applied.

## Why
He asked for a review of each Claude Desktop update, every time it updates, and on 2026-10-15 a restart applied
nothing: the app still ran 2.37337.1 while 2.42304.0 was staged, because Windows defers an MSIX update while the
app (tray included) is open. A rule in prose would be forgotten; a doctor row is checked at every session start.

## Done when
- `node --test bin/lib/host-update.test.mjs bin/lib/cache.test.mjs bin/doctor.test.mjs bin/doctor-hook.test.mjs` exits 0
- `npm run check` exits 0

## In scope / Out of scope
- In: bin/lib/host-update.mjs and its test, bin/lib/cache.mjs and its test, bin/doctor.mjs and its two tests, bin/js-harness.test.mjs (the dispatcher's list of doctor rows), README.md (the doctor section), docs/ROADMAP.md (one checklist line), this document.
- Out: the model-facing context of the hook: the doctor's notices cost zero model tokens (docs/ROADMAP.md, Decided, "Notifications"), so the hook's `systemMessage` names the update and `doctor` lists the steps.

## Constraints
- It reads machine state only and writes only its own record, inside the doctor cache (`~/.js-harness/doctor.json`), which `uninstall` already removes (bin/lib/manifest.mjs, the `cachePath` removal) — because anything the harness writes outside the repo must be undoable exactly.
- It never reads or copies any other key of the app's `config.json`, which also holds OAuth tokens — because only the updater's version keys are needed.

## Ask me before
- Nothing beyond the repository's rules.

## Specs
- S1. The lead's order (cross-session message from "JH ORQ · js-harness (350k)" to JH 21, 2026-10-15 18:26), relaying his request ("por favor revisa qesta ultima version de Claude Desktop que cambio que nos beneficia o nos cambia has siempre este protocolo cuando se actualice"): "Build it as a check, not prose: `js-harness doctor` (its SessionStart hook already runs on startup|resume) gains a host-update row that (1) records the running desktop version and the bundled Code-tab CLI version under ~/.js-harness, and on a change says so with the old and new versions and the review steps: read https://claude.com/docs/cowork/claude-desktop-changelog and the Claude Code CHANGELOG for the range, check the harness hooks in ~/.claude/settings.json still run, check Remote Control per session, and report benefits / behavior changes / breaking changes to him; (2) flags an update that is downloaded but NOT applied. [...] Feature branch, ODD document with the task contract, tests first, also a line in docs/ROADMAP.md; it reads machine state only, writes only its own record under ~/.js-harness (undoable by uninstall). Tell me when the PR is ready for the queue."
- S2. The versions are read from the app's folder (the MSIX package's `LocalCache\Roaming\Claude` first, then `%APPDATA%\Claude`; `~/Library/Application Support/Claude` on macOS, `~/.config/Claude` on Linux): the running desktop version from `sentry/scope_v3.json` (`app_version`), the staged one from `config.json` (`updaterStagedPayloadKind.version`), and the Code tab CLI as the highest version folder under `claude-code/`.
- S3. The `host-update` row: version column the running desktop version; `claude` is `ok`, or `stale` while the desktop or CLI version differs from the reviewed one, with the old and new versions and the review steps of S1 as its fix, ending in `js-harness doctor --host-reviewed`; `up to date` is `ok`, or `outdated` while a staged version is newer than the running one, with "quit Claude fully, the tray icon included, and open it again" as its fix. No app folder: every cell `n/a`. A folder whose running version cannot be read: `unknown`, no gap.
- S4. The first run with no record records the versions it reads as reviewed, with no gap. `js-harness doctor --host-reviewed` records the versions it reads as reviewed and says which; with no readable version it records nothing and exits 1.
- S5. `doctor --hook`'s one `systemMessage`, when the gaps changed, names the update after its usual text: the old and new versions since the last review, and a downloaded version not applied.
- S6. Without the host check (doctor called by other code, as the TUI does), the report prints what it printed before, and other writers of the doctor cache keep the record.
- S7. The lead's order (2026-10-15 19:11): "Do (1) the hermetic doctor test and (2) `--host-reviewed --json` after the land, as one small PR from the new main, with the ROADMAP tick in it." (1): the app folders hang off the home doctor is given (`--home`), never the environment, so a scratch home reads no app of this machine. (2): `--host-reviewed --json` prints `{"reviewed":{"desktop":...,"code":...,"at":...}}`, the record it wrote; a failure stays exit 1 with its stderr line.

## Tasks
- [x] T1 (S2-S6, kind: build): the version reads, the row, the record, `--host-reviewed` and the hook's words. Route: inline. RED: host-update.test.mjs could not load its module; cache.test.mjs failed its host test (12 of 13). GREEN: host-update 8/8, cache 13/13, doctor 68/68, doctor-hook 12/12.
- [x] T2 (S1, kind: docs): README's doctor section and the roadmap's checklist line (left open until the merge). Route: inline.
- [x] T3 (S7, kind: build): the home-only app folders, the home handed to the host check, `--host-reviewed --json`, README, and the roadmap line ticked. Route: inline. RED: host-update 7/10 (seeded env read, home not), doctor 68/69 (the host check got no home), and the dispatcher's doctor test on the old code read this machine's app with a temp home (`[ '2.37337.1', 'ok', 'ok', 'outdated' ]`). GREEN: host-update 10/10, doctor 69/69, doctor-hook 12/12, the dispatcher's doctor test 1/1.

## Log
- L1. 2026-10-15 18:26, the lead's order, quoted in S1. Evidence it named: `C:\Users\Oficina\AppData\Local\Temp\claude\D--js-harness\e152c9d8-53bc-4366-8fa5-526b1576bcb6\scratchpad\desktop-update-notes.md`.
- L2. 2026-10-15, design. Read on this machine: `sentry/scope_v3.json` app_version 2.37337.1; `config.json` `updaterLastSeenVersion` 2.37337.1 and `updaterStagedPayloadKind.version` 2.42304.0; `claude-code/` holds 2.1.293 and 2.1.295. The change stays a gap until `--host-reviewed` records it, so the protocol is not lost after the one notice the hook gives; the record lives in doctor.json so `uninstall` removes it with the cache. Running version from the sentry scope, not `Get-AppxPackage`: no process is started at session start.
- L3. 2026-10-15 18:35, live on this machine with a scratch home: `doctor --offline` printed `host-update     2.37337.1 ok        n/a       n/a       outdated` and the fix "Claude Desktop 2.42304.0 is downloaded and not applied (running 2.37337.1): quit Claude fully, the tray icon included, and open it again"; the record read `{"reviewed":{"desktop":"2.37337.1","code":"2.1.295",...}}`. Until this lands in the installed copy, that copy's cache writers drop the `host` key, so the first reading after the install is the baseline.
- L4. 2026-10-15 18:56: gentle-ai's own assessment of c307e33 was medium, not due; raised to item 2 by hand (config.json holds OAuth tokens), its preflight STATUS timed out twice (operation_timeout, retry_safe false, next_action stop): the gentle-ai review is unavailable for this candidate. Codex on b0093b8..c307e33 (186,983 input tokens): part 1 incorrect (0.98) with two P2, part 2 correct (0.93). Both accepted and fixed test first: the hook's digest now carries the host notice, so another update before the review is a new notice (RED: no second notice); a record with no CLI takes the CLI read now as its baseline while the desktop is unchanged (RED: row ok, no record).
- L5. 2026-10-15 19:01: Codex recheck of c307e33..267a49e (48,882 input tokens): "the patch is correct (confidence 0.98)", 2 of 2 findings fixed, recorded. PR opened for the queue; the lead is told. Next step: none here; the checklist line in docs/ROADMAP.md is ticked when it merges.
- L6. 2026-10-15 19:10: the lead asked for one gentle-ai retry on a quiet machine. With no gate running, the preflight answered in 23 s. Consent was pre-granted, and the risk and reliability lenses ran. Lineage review-2c728ee14e69c57e was approved and acknowledged, with three non-blocking warnings. Two are follow-ups: the dispatcher's doctor test reads the real app folder, and `--host-reviewed` ignores `--json`. The third, a memory-hygiene.md revert, is the branch being behind main; `git diff origin/main...HEAD` does not touch that file.
- L7. 2026-10-15 19:11, the lead's order quoted in S7, built as T3 on fix/host-update-followups. On Linux the app folder is now `~/.config/Claude` only: `XDG_CONFIG_HOME` is environment, and the account check (bin/lib/stack.mjs) reads its own paths from the home the same way.

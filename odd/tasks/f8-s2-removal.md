# F8 S2: back up, prove the restore, remove gentle-ai, Orca and herdr

Locator: `odd/tasks/f8-s2-removal.md` · Engram mirror: `odd/f8-s2-removal/tasks` · Branch: `f8-s2-removal`
Delivery: pull requests, a chain if one passes 400 lines · Test runner: `node --test`

## Goal
gentle-ai, Orca and herdr leave his machine, each by his yes at that moment, after one full backup whose restore was
proven on a scratch home; what stays (js-harness, engram and its data, codegraph, context7, Codex as reviewer) works
as before, shown by a read-only verification, a smoke walk and S2's measures.

## Why
The roadmap's order puts S2 last of the migration: "removal is machine-wide and needs every replacement, a backup and
a" restore proven first (`docs/ROADMAP.md`, F8 plan); S11 made js-harness install the complements, S13 rehearsed the
path and S12 moved his projects. gentle-ai's 4.3.1 uninstall deletes his whole `permissions` object and the engram and
context7 registrations (D-pass item 2), so the backup and the drill are what make the removal undoable.

## Done when
- `node --test bin/lib/stack-backup.test.mjs bin/stack.test.mjs scripts/s2-verify.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/f8-s2-removal.md` exits 0
- `npm run check` exits 0
- `js-harness stack backup verify --from <the backup>` exits 0 on his machine's backup, recorded in `## Log` (the
  drill: hashes, engram returns observation 6431, the `permissions` object equal, the MCP entries named, a deleted
  planted file put back and a created one removed)
- `node scripts/s2-verify.mjs` exits 0 after the removals, recorded in `## Log` (each row of the diet's section 10
  step 8, read only)
- the smoke walk passes on a fresh scratch project with the machine as it is after the removals, recorded in `## Log`
- the incident set scores at least 10 of 20 (`L − max(s, 3)` with L 13), its run named in `## Log`
- every removal in `## Log` carries his answer, quoted with its transcript line, before the step that runs it

## In scope / Out of scope
- In: `bin/lib/stack-backup.mjs` and its test, `bin/stack.mjs` (the `backup` subcommand and its usage line),
  `scripts/s2-verify.mjs` and its test, `.claude/settings.json` (the exclusion reverted), the sentence of `CLAUDE.md`
  that names the exclusion, this document, S2's line of `docs/ROADMAP.md`, `docs/FAILURES.md`, the session summary
  under `docs/sessions/`. On his machine, only after each yes: gentle-ai's uninstall and the leftovers it names,
  GGA, Orca, herdr, `js-harness install` and `stack install`.
- Out: any removal or change to `~/.claude`, `~/.codex`, gentle-ai's config or a credential without his yes at that
  moment; `CLAUDE.md`'s review lines that name gentle-ai (a rule change on its own `rule/` branch, T10); D4 (his, after
  S2); S4a's hook-count row; the incident cases themselves.

## Constraints
- No credential file (`~/.claude/.credentials.json`, `~/.codex/auth.json`) is opened, printed or listed with contents,
  and none is ever copied into a scratch home: the drill checks their copies by hash where the backup holds them —
  because his brief forbids it.
- The backup lives outside the repository, under `~/.js-harness/backups/`, and is never pushed or shown — because it
  holds his credentials and the context7 key in `~/.claude.json`.
- Every test and the drill write only into `mktemp -d` homes; `restore` refuses a home where a Claude, Codex or engram
  process runs — because a restore over a live home loses what the host writes meanwhile.
- One removal per question, one question at a time, through the lead; a no stops there and leaves the machine as it
  is — his brief and the diet's section 10.
- Quiescing writers and restarting sessions are planned with the lead and never done by surprise: PP 1 works in
  `D:\plataforma-preproyecto` on this machine — his brief.
- The week is red on `rule:growth-limit`: nothing beyond this step and fixes.

## Ask me before
- Each removal: gentle-ai, GGA, Orca, herdr, each at its moment.
- The sitting: closing every session, the lead included, for the backup.
- Running the restore on his real home (the undo).
- Spend above the plan: the incident set (about $13) and the smoke walk (about $5).

## Depth pass
- 1. Method: the discipline is change management for a decommission on a production host, as a site-reliability
  team retires a component: freeze writers, take a full backup, prove the restore on a separate host before the
  change (a backup is only as good as its last tested restore), change one component at a time with a go or no-go
  before each, verify read-only against a recorded baseline, smoke-test, and keep a tested rollback. Its standard:
  nothing is removed whose restore was not exercised, and every check is a command with an expected result. The
  smallest change that meets it: one subcommand, `js-harness stack backup`, with `run` (the quiesce checks, then a
  byte copy of the named roots and a manifest of each file's sha256), `verify` (the drill on a scratch home) and
  `restore` (the undo, a snapshot restore with absent entries deleted, per root or for the `permissions` object
  alone); a read-only `scripts/s2-verify.mjs` for step 8; the removals run by each tool's own command, asked one at
  a time. The search of `rule:reuse-first`: `js-harness backup` exists (`bin/backup.mjs:59` of the usage) and is the
  wrong tool for this backup: it blanks every secret value (`redactSecrets`, `bin/lib/backup.mjs:203`) so a restore
  could not put his config back, and it pushes to GitHub, where no credential may go; its `walk`
  (`bin/lib/backup.mjs:59`) and its restore's engram handling (`ENGRAM_DATA_DIR`, `bin/lib/backup-restore.mjs:64`)
  are reused. `stack` is where the roadmap names the command (`docs/ROADMAP.md`, S2, Files) and where the
  complements' rows live (`bin/lib/stack.mjs:244`). The install manifest records what js-harness wrote, not a
  snapshot of his home, so the backup keeps its own manifest beside its files instead of a new key in the machine
  manifest (a persisted format, high risk): `stack backup` prints where it is, and that path goes into `## Log`.
- 2. Raw material: his yes, "Sí, abre el S2" (the lead's transcript `0f71b2c6`, line 55309, 2026-11-02T20:04:19Z,
  read with `js-harness sessions --quote`); the brief of JH 134; the diet's section 10, "S2, the removal, in order"
  (`docs/proposals/harness-diet.md:900-940`) and section 7's noise rule (`:487-502`); the reverse-engineering
  document's row 12 (`docs/proposals/gentle-ai-reverse-engineering.md:957`) and 13.5 (`:992-998`); S13's walk and its
  owed items (`docs/ROADMAP.md`, S13 State); S12's moves (`odd/tasks/f8-s12-migration.md`, L19-L23). Read on his
  machine 2026-11-02, read only:
  - hooks in `~/.claude/settings.json`: 34, not the roadmap's 32: js-harness 15, Orca 12, gentle-ai 5 (two
    `gentle-ai review stop-hook`, two `gentle-ai telemetry runtime claude`, the PowerShell skill-registry
    `UserPromptSubmit`), herdr 1, codegraph 1; `permissions`: 1 allow, 24 deny, `defaultMode: bypassPermissions`;
    `outputStyle: "Neutral"`, gentle-ai's style (`internal/assets/claude/output-style-neutral.md` in its source).
  - `~/.claude.json` `mcpServers`: codegraph, context7, engram. `~/.codex/config.toml`: `[mcp_servers.*]` node_repl,
    codegraph, context7, engram; `~/.codex/hooks.json`: gentle-ai 3 (skill-registry, telemetry twice), herdr 1;
    `~/.codex/AGENTS.md` 110,033 bytes, 41 lines naming gentle-ai; `~/.codex/skills`: 9 of gentle-ai's.
  - `~/.claude/CLAUDE.md`, 627 lines: gentle-ai blocks `codegraph-guidance`, `persona`, `engram-protocol`,
    `orchestrator` (holding `authority-first-terminal-procedure`), `agent-routing` (holding `remote-authorization`);
    js-harness's Rules block at lines 616-627.
  - gentle-ai 4.3.1 (`gentle-ai version`), not the 4.2.0 the diet read; its source at
    `~/go/pkg/mod/github.com/gentleman-programming/gentle-ai/v4@v4.3.1`. Binaries: `~/go/bin/gentle-ai.exe`,
    `~/bin/gga`, Orca's CLI under `%LOCALAPPDATA%\Programs\orca\resources\bin`, herdr at
    `~/.herdr/packages/standalone/releases/0.9.1-x86_64-pc-windows-msvc/herdr`; data `~/.gentle-ai`, `~/.orca`,
    `%APPDATA%\orca`, `~/.herdr`.
  - sizes: `~/.claude` 3.2 GB, `~/.engram` 70 MB; free: C: 48 GB, D: 45 GB. engram 3.6.0, whose CLI has `search
    <query> --project` and reads `ENGRAM_DATA_DIR`.
  - gentle-ai 4.3.1's `uninstall --all`, read in its source by a read-only reader and spot-checked here
    (`internal/components/uninstall/service.go`): it backs up first to `~/.gentle-ai/backups/<UTC stamp>/`
    (S:611-626); deletes the whole `permissions` object (S:1011-1015, checked) and `outputStyle` (S:983-986, checked)
    and `theme`; removes `mcpServers.engram` and `mcpServers.context7` from `~/.claude.json` and `settings.json`
    (S:1120-1123, checked; S:1179), Codex's `[mcp_servers.engram]` and its two instruction keys and files, but leaves
    Codex's context7 (S:1146-1147, checked); strips only the `persona` and `engram-protocol` blocks of `CLAUDE.md`
    (S:972, S:1007, checked), so the other blocks are named for the leftover scan; leaves the PowerShell
    skill-registry hook (S:1355-1361); asks for `yes` unless `-y`; never touches `~/.engram`, never deletes
    `~/.gentle-ai`, and never touches codegraph for Claude or Codex.
  - Orca, read by a read-only reader in its unpacked CLI (`resources/app.asar.unpacked/out/cli`), nothing run: with
    Orca running, `orca agent hooks off` only sends `settings.update` to the app (`handlers/agent-hooks.js`,
    `setAgentHooksEnabled`); with it closed, it removes every hook whose command holds
    `agent-hooks/claude-hook(.cmd|.ps1|.sh)` (all 12 of his: `C:/Users/Oficina/.orca/agent-hooks/claude-hook.cmd ||
    echo {}`), keeps other tools' hooks, and cleans `codex-hook.*` entries, none of which `~/.codex` holds today. The
    app is an electron-builder NSIS per-user install: `Uninstall Orca.exe` (registered under HKCU's Uninstall key,
    `/currentuser`); whether it removes `~/.orca`, `%APPDATA%\orca`, `%LOCALAPPDATA%\orca-updater` and its user PATH
    entry (`...\Programs\orca\resources\bin`) is not established; no Orca process or autostart.
  - herdr 0.9.1: `herdr integration uninstall <claude|codex>` exists (its `--help`); what it removes is not established
    beyond strings in its binary (`herdr-agent-state.ps1`, "# installed by herdr"). A standalone install with no
    receipt and no uninstaller: `~/.herdr` (its release folder on his user PATH), `%APPDATA%\herdr`,
    `%LOCALAPPDATA%\herdr`; no process or autostart.
  - GGA: `~/bin/gga`, `gga.bat`, `gga.cmd`, `gga.ps1` and `~/bin/lib/`; no GGA hook in `D:\js-harness`
    (`core.hooksPath` is `.githooks`), `D:\plataforma-preproyecto` or `D:\abogadaclaudiajimenez`, so no `gga
    uninstall` is owed in a project.
  - the planted observation for the drill: engram id 6431, "F8 S2 restore drill marker 2026-11-02", token
    `s2drillmarker20261102`; `engram search s2drillmarker20261102 --project js-harness` finds it (run 20:17Z).
- 3. The bar:
  spec 1: `js-harness stack backup --help`: none, new behaviour (`stack` knows `install` only, `bin/stack.mjs:22-25`).
  spec 2: the drill: none; S13 proved engram's recovery on a scratch home, never a restore of his store.
  spec 3: hooks: 34 today; after: only js-harness's and codegraph's, 16 today (15 + 1). The roadmap's "32 → 14" was
  counted 2026-10-28 with js-harness at 13; the line is the owners, not the number.
  spec 4: `permissions` after `install`: equal to the backup's (1 allow, 24 deny, `bypassPermissions`).
  spec 5: `claude mcp list`: engram, codegraph, context7 connected today; the same after.
  spec 6: `~/.engram`: its sha256 per file before the removal, the same after.
  spec 7: incident set: L 13, worse below 10 (S0's baseline, `docs/ROADMAP.md` S10 State).
  spec 8: `fixed load`: at most 80,000 over five sessions; today's figure read at T8.
- 4. Refutation: the cheapest test that could show the plan does not hold is whether gentle-ai's uninstall, read in
  the version installed, still takes what the diet says it takes, and whether js-harness puts it back. Run: the
  source of 4.3.1 read (item 2): it also takes `outputStyle`, `theme` and Codex's engram entry, which the diet did
  not list, and leaves Codex's context7 and four `CLAUDE.md` blocks. `install` writes the `permissions` object and
  the Rules block (S10), `stack install` registers engram for Claude and Codex and context7 (`bin/lib/stack.mjs:244`,
  `:252`); nothing of js-harness writes a user-level `outputStyle`, by design (S10: `init` selects the style per
  project), so after the removal a project whose clone does not select `js-harness` loses the style it has today.
  `D:\js-harness\.claude\settings.local.json` selects none (read 2026-11-02). The plan holds with three corrections
  inside its own steps: the leftover scan after the uninstall, `outputStyle` checked per project after it, and the
  version in the undo line read as 4.3.1.
  Verdict: supports
- 5. Request: one full backup of every root the removal touches (the diet's step 2 list; plus the binaries, `~/bin`,
  Orca's program and updater folders and herdr's `%LOCALAPPDATA%` folder, since no installer for either is on this
  machine; plus his user PATH value as text, since both put an entry in it), taken from a plain terminal with every
  session closed, by `js-harness stack backup run`, which checks the quiesce first and stops at the first failure;
  the drill, `stack backup verify`, on a scratch home with no credential in it, proving the hashes, engram's answer,
  the `permissions` object and the MCP entries, and row 12's deleted and created files; then, with the lead and one
  S2 session running, each removal asked through the lead and run right after its yes: gentle-ai (`uninstall --all
  -y`, then `js-harness install` and `stack install` in the same sitting, then the leftovers its scan names, the
  binary and `~/.gentle-ai`), GGA (its files in `~/bin`), Orca (`orca agent hooks off` with Orca closed, then its
  uninstaller, then what it leaves, each named), herdr (`integration uninstall claude` and `codex`, then its folders
  and its PATH entry, each named); the exclusion reverted; `scripts/s2-verify.mjs`; the smoke walk;
  every session restarted with the lead; the incident set and `fixed load`.
  The undo: `stack backup restore` (the drill proved it), `go install
  github.com/gentleman-programming/gentle-ai/v4/cmd/gentle-ai@v4.3.1`, Orca's and herdr's folders and PATH entries put
  back from the backup.
  The leftover scan, the `outputStyle` per project, the program folders and PATH in the backup, Orca closed before
  `hooks off` and 4.3.1 in the undo are corrections inside the roadmap's steps, not new scope.
  Adds: none

## Specs
- S1 (ROADMAP, S2, Changes): "in order (diet section 10, "S2, the removal"): writers quiesced; one full backup,
  recorded, with the whole `permissions` object and the complements' MCP entries named; a restore drill on a scratch
  home that proves engram answers and puts back a deleted file and removes a created one (13.3 row 12); then each
  removal asked at that moment: `gentle-ai uninstall --all`, the PowerShell skill-registry hook by hand, the binary
  and `~/.gentle-ai`, GGA where a project has it; Orca; herdr; `install` and `stack install` right after; the interim
  exclusion reverted; a read-only verification; an S13 smoke walk; every session restarted and checked."
- S2 (ROADMAP, S2, Probe and pass): "hooks 32 → 14 (...); `~/.engram` hashes as before; `claude mcp list` shows
  engram, codegraph and context7; the incident set no worse; `fixed load` at most 80,000 over five sessions."
- S3 (ROADMAP, S2, His decisions): "each removal, asked at that moment; D4, the `fixed load` budget, right after."
- S4 (diet, section 10, step 1): "with every session closed there is no lead running, so he runs them from a plain
  terminal with one command S2 builds, `js-harness stack backup` [to build], which prints each check and stops at
  the first that fails."
- S5 (diet, section 10, step 2): "`.credentials.json` and `auth.json` are copied as files and never opened,
  printed, listed with contents or committed; the backup is never shown."
- S6 (diet, section 10, step 3): "the backup restored there hashes as the originals, **and** works: engram started on
  the restored `~/.engram` returns, through its CLI search (the store `mem_search` reads), an observation recorded
  before the backup (its id and title written into the feature document first)".
- S7 (reverse-engineering document, row 12): "S2's restore drill puts back a deleted planted file and removes a
  created one".
- S8 (his yes, 2026-11-02, line 55309): "Sí, abre el S2"; the brief: "That yes opens the step only. Every removal
  (gentle-ai, Orca, herdr), every change to his configuration (~/.claude, ~/.codex, gentle-ai's config,
  credentials) and anything irreversible outside the repo is asked to him first, one question at a time".
- S9 (the brief): "Never copy .credentials.json or Codex auth into scratch homes."

## Tasks
- [ ] T1 (kind: design) this document, its plan through the double review (Codex and a Claude reader) — S1-S9;
  inline
- [ ] T2 (kind: build) `bin/lib/stack-backup.mjs`: the roots, the quiesce checks, `run`'s copy and manifest,
  `verify`'s drill, `restore` with absent entries deleted and `--only`; test first in a scratch home with planted
  fake credentials — S1, S4-S7, S9; inline
- [ ] T3 (kind: build) `stack backup` in `bin/stack.mjs`, its usage line and help — S4; inline
- [ ] T4 (kind: build) `scripts/s2-verify.mjs`, step 8 read only, test first on a fixture home — S2; inline
- [ ] T5 (kind: verify) Codex and the lenses on T2-T4, the independent verifier (high risk), PR — inline
- [ ] T6 (kind: verify) the sitting, with the lead: his yes to close every session; he runs `stack backup run` and
  `verify` from a plain terminal; the results into `## Log` — S1, S4-S7
- [ ] T7 (kind: verify) the removals, each asked through the lead and run after its yes: gentle-ai with `install` and
  `stack install`, its leftovers, GGA, Orca, herdr; each into `## Log` — S1, S3, S8
- [ ] T8 (kind: build) the exclusion reverted in `.claude/settings.json` and its sentence in `CLAUDE.md`;
  `s2-verify` on his machine; the smoke walk; every session restarted with the lead; the incident set and `fixed
  load` — S1, S2
- [ ] T9 (kind: docs) S2's roadmap line, the session summary, the closed notice — inline
- [ ] T10 (kind: docs) named for the lead, not built here: `CLAUDE.md`'s lines that name gentle-ai's review
  (lines 74-91) and `AGENTS.md`'s "leaves at S2" go stale; they change through `js-harness rules change` on a
  `rule/` branch

## Log
- L1 2026-11-02T20:04:19Z, his words (the lead's transcript `0f71b2c6`, line 55309): "Sí, abre el S2". The brief
  (`~/.js-harness/background/briefs/2026-11-02T20-04-49-764Z-f23ac024.md`): that yes opens the step only; each
  removal and each change to his configuration is asked first, one question at a time, through the lead.
- L2 2026-11-02 20:17Z: the drill's observation planted before any backup: engram id 6431, title "F8 S2 restore
  drill marker 2026-11-02", token `s2drillmarker20261102`, found by `engram search` in project js-harness.
- L3 2026-11-02: the machine read for the depth pass (item 2): 34 hooks, gentle-ai 4.3.1, and what its uninstall
  takes and leaves; nothing written outside the repository.

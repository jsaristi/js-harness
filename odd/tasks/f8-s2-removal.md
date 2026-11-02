# F8 S2: back up, prove the restore, remove gentle-ai, Orca and herdr

Locator: `odd/tasks/f8-s2-removal.md` · Engram mirror: `odd/f8-s2-removal/tasks` · Branch: `f8-s2-removal`
Delivery: pull requests, a chain if one passes 400 lines · Test runner: `node --test`

## Goal
gentle-ai, Orca and herdr leave his machine, each by his yes at that moment, after one full backup whose restore was
proven on a scratch home; what stays (js-harness, engram and its data, codegraph, context7 with its key, Codex as
reviewer) works as before, shown by a read-only verification, a smoke walk and S2's measures.

## Why
The roadmap: "S2 last of the migration: removal is machine-wide and needs every replacement, a backup and a restore
drill first" (`docs/ROADMAP.md:318-319`). S11 made js-harness install the complements, S13 rehearsed the path and S12
moved his projects. gentle-ai's 4.3.1 uninstall deletes his whole `permissions` object and the engram and context7
registrations (depth pass, item 2), so the backup and the drill are what make the removal undoable.

## Done when
- `node --test bin/lib/stack-backup.test.mjs bin/stack.test.mjs scripts/s2-verify.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/f8-s2-removal.md` exits 0
- `npm run check` exits 0
- `js-harness stack backup verify --from <the backup>` exits 0 on his machine's backup, recorded in `## Log` (the
  drill: every file byte for byte, credentials by hash in place, engram returns observation 6431, the `permissions`
  object equal, the MCP entries named, row 12's deleted and created files, a transcript newer than the backup kept)
- every configuration-changing operation in `## Log` (each uninstall, restore of an entry, `install`, `stack install`,
  each leftover removed, the style chosen) carries the yes that named it, quoted with its transcript line, before the
  line that runs it
- `node scripts/s2-verify.mjs --backup <the backup>` exits 0 after every session restarted, recorded in `## Log`
- the smoke walk passes on a fresh scratch project with the machine as it is after the removals, recorded in `## Log`
- the incident set scores at least 10 of 20 (`L − max(s, 3)` with L 13), its run named in `## Log`
- `fixed load` at most 80,000 in each of five restarted desktop sessions (the `check` row read once in each), the
  five readings in `## Log`
- every session restarted and checked by the lead; in `D:\js-harness`, `D:\plataforma-preproyecto` and
  `D:\abogadaclaudiajimenez` a restarted session shows the output style he chose, its `CLAUDE.md` and context7 (the
  probe S12 owes), and `/context` holds one engram text (row 11); each in `## Log`

## In scope / Out of scope
- In: `bin/lib/stack-backup.mjs` and its test, `bin/stack.mjs` (the `backup` subcommand, its usage and help),
  `bin/lib/backup.test.mjs` (one test that the memory backup never walks the S2 backup), `scripts/s2-verify.mjs` and
  its test, `.claude/settings.json` (the exclusion reverted), the sentence of `CLAUDE.md` that names the exclusion,
  this document, S2's line of `docs/ROADMAP.md`, `docs/FAILURES.md` (only for a failure S2 itself meets), the session
  summary under `docs/sessions/`. On his machine, only after the yes that names it: each operation of `## Ask me
  before`.
- Out: any change to `~/.claude`, `~/.codex`, `~/.gemini`, gentle-ai's config, a credential or a project without
  his yes naming it; D4 (his, after S2); S4a's hook-count row; the incident cases. The brief's two `Seen:` lines and the
  audit-pack log line are PR 759, on their own branch (L4).

## Constraints
- No credential file (`~/.claude/.credentials.json`, `~/.codex/auth.json`, `~/.gemini/oauth_creds.json`,
  `~/.gemini/google_accounts.json`) and no file holding a key (`~/.claude.json`, `~/.codex/config.toml`, and any file
  `redactSecrets` flags, `bin/lib/backup.mjs:37`) is opened for display, printed, or copied into a scratch home: the
  drill checks them by hash where the backup holds them and reads only entry names — because his brief forbids it.
- The backup lives in `~/js-harness-s2-backup/<stamp>/`, outside every tree `js-harness backup` mirrors to GitHub
  (`bin/lib/backup.mjs:105-115` mirrors `~/.js-harness`), is never pushed or shown, and is published under its name
  only after its copy is complete and verified (a `.partial` folder until then) — because it holds his credentials.
- Every test and the drill write only into `mktemp -d` homes and remove them at exit, failure included; `restore`
  refuses his real home while a Claude, Codex or engram process runs — because a restore over a live home loses what
  the host writes meanwhile.
- `restore` deletes absent entries only in config roots; under data (`~/.claude/projects`, `~/.engram`, `history`,
  transcripts) it never deletes, and engram's store goes back only into an empty `~/.engram` — because his transcripts
  and the answers this Log quotes are written after the backup.
- One tool per question, one question at a time, through the lead; each question names every operation and path its
  yes covers and that the undo for Orca and herdr is not exercised; a no stops there — his brief.
- Quiescing writers and restarting sessions are planned with the lead and never done by surprise: PP 1 works in
  `D:\plataforma-preproyecto` on this machine — his brief.
- The week is red on `rule:growth-limit`: nothing beyond this step and fixes.

## Ask me before
- The sitting: closing every session, the lead's included, for the backup.
- gentle-ai: `uninstall --all -y`; the `permissions` object and the `engram` and `context7` entries put back from the
  backup; `install`; `stack install`; the leftovers its scan names; the binary; `~/.gentle-ai`; GGA's files in `~/bin`.
- gentle-ai's leftovers in each project (`.atl/`, its review store), one project at a time.
- The output style after the removal (today gentle-ai's "Neutral" at user level).
- Orca, then herdr, each with its folders, PATH entry and registry keys named.
- Running `restore` on his real home (the undo).
- Spend: the incident set (about $13) and the smoke walk (about $5).

## Depth pass
- 1. Method: the discipline is change management for a decommission on a production host, as a site-reliability
  team retires a component: freeze writers, take a full backup, prove the restore on a separate host before the
  change (a backup is only as good as its last tested restore), change one component at a time with a go or no-go
  before each, verify read-only against a recorded baseline, smoke-test, and keep a tested rollback. Its standard:
  nothing is removed whose restore was not exercised, or that gap is named and accepted; every check is a command with
  an expected result. The smallest change that meets it: one subcommand, `js-harness stack backup`, with `run` (the
  quiesce checks, then a byte copy of the named roots by a strict walker, its count checked against an independent
  count, a manifest of each file's sha256 and each link's target, registry exports as text), `verify` (the drill on a
  scratch home) and `restore` (the undo: config roots as a snapshot with absent entries deleted, data roots without
  deletion, `--only` for the `permissions` object or one MCP entry); a read-only `scripts/s2-verify.mjs` for step 8;
  the removals by each tool's own command. The search of `rule:reuse-first`: `js-harness backup` exists (usage at
  `bin/backup.mjs:36`) and is the wrong tool: it blanks every secret value (`redactSecrets`, `bin/lib/backup.mjs:203`),
  so its restore could not put his config back, and it pushes to GitHub, where no credential may go. Its `walk`
  (`bin/lib/backup.mjs:59-72`) is not reused either: it returns `[]` for a folder it cannot read and drops links and
  junctions, so a manifest built on it would verify a backup missing files. Reused: `redactSecrets` to classify the
  files the drill keeps out of the scratch home, and the restore's engram environment (`ENGRAM_DATA_DIR`,
  `bin/lib/backup-restore.mjs:65`). `stack` is where the roadmap names the command (`docs/ROADMAP.md`, S2, Files).
  The machine manifest records what js-harness wrote, not a snapshot of his home, so the backup keeps its own
  manifest beside its files (a new key in the machine manifest would be a persisted-format change, high risk).
- 2. Raw material: his yes, "Sí, abre el S2" (the lead's transcript `0f71b2c6`, line 55309, 2026-11-02T20:04:19Z,
  read with `js-harness sessions --quote`); the brief of JH 134; the diet's section 10, "S2, the removal, in order"
  (`docs/proposals/harness-diet.md:854-921`) and section 7's noise rule; the reverse-engineering document's rows 11, 12
  and 16 (`docs/proposals/gentle-ai-reverse-engineering.md:953-957`) and 13.5 (`:992-998`); S13's owed items and S12's
  owed session probe (`docs/ROADMAP.md:541-546`, `:576`). Read on his machine 2026-11-02, read only:
  - hooks in `~/.claude/settings.json`: 34, not the roadmap's 32: js-harness 15, Orca 12, gentle-ai 5 (two
    `gentle-ai review stop-hook`, two `gentle-ai telemetry runtime claude`, the PowerShell skill-registry
    `UserPromptSubmit`), herdr 1, codegraph 1; `permissions`: 1 allow, 24 deny, `defaultMode: bypassPermissions`; no
    `theme`; `outputStyle: "Neutral"`, gentle-ai's style (`internal/assets/claude/output-style-neutral.md` in its
    source). The machine manifest's `permissions` record: `added` empty, `defaultMode: bypassPermissions` adopted,
    `wroteMode: false` (`bin/lib/permissions.mjs:78-84` puts back only a mode it recorded).
  - `~/.claude.json` `mcpServers`: codegraph, context7 (with a key header, diet `:874-875`), engram.
    `~/.codex/config.toml`: `[mcp_servers.*]` node_repl, codegraph, context7, engram; `~/.codex/hooks.json`: gentle-ai
    3, herdr 1; `~/.codex/AGENTS.md` 110,033 bytes, 41 lines naming gentle-ai; `~/.codex/skills`: 9 of gentle-ai's.
  - `~/.gentle-ai/state.json`: `installed_agents` claude-code, codex, antigravity; components engram, skills, context7,
    permissions, gga, claude-theme, opencode-gentle-logo, persona; persona neutral. Antigravity's home is `~/.gemini`
    (`GEMINI.md`, `settings.json`, `antigravity/`, `antigravity-cli/`, `antigravity-ide/`, and two credential files).
  - `~/.claude/CLAUDE.md`, 627 lines: gentle-ai blocks `codegraph-guidance`, `persona`, `engram-protocol`,
    `orchestrator` (holding `authority-first-terminal-procedure`), `agent-routing` (holding `remote-authorization`);
    js-harness's Rules block at lines 616-627.
  - gentle-ai 4.3.1 (`gentle-ai version`), not the 4.2.0 the diet read; its source at
    `~/go/pkg/mod/github.com/gentleman-programming/gentle-ai/v4@v4.3.1`. Binaries: `~/go/bin/gentle-ai.exe`,
    `~/bin/gga`, Orca's CLI under `%LOCALAPPDATA%\Programs\orca\resources\bin`, herdr at
    `~/.herdr/packages/standalone/releases/0.9.1-x86_64-pc-windows-msvc/herdr`; data `~/.gentle-ai`, `~/.orca` (29 KB),
    `%APPDATA%\orca` (521 MB), `~/.herdr`.
  - sizes: `~/.claude` 3.2 GB, `~/.engram` 70 MB; free: C: 48 GB, D: 45 GB. engram 3.6.0, whose CLI has `search
    <query> --project` and reads `ENGRAM_DATA_DIR`.
  - gentle-ai 4.3.1's `uninstall --all`, read in its source by a read-only reader and spot-checked here
    (`internal/components/uninstall/service.go`, S): `--all` cannot be combined with `--components`
    (`internal/cli/uninstall.go:43-45`); it backs up first to `~/.gentle-ai/backups/<UTC stamp>/` (S:611-626); deletes
    the whole `permissions` object (S:1011-1015, checked) and `outputStyle` (S:983-986, checked) and `theme`; removes
    `mcpServers.engram` and `mcpServers.context7` from `~/.claude.json` and `settings.json` (S:1120-1123, checked;
    S:1179), Codex's `[mcp_servers.engram]` and its two instruction keys and files, but leaves Codex's context7
    (S:1146-1147, checked) and Antigravity's own entries go (S:1141-1142); strips only the `persona` and
    `engram-protocol` blocks of `CLAUDE.md` (S:972, S:1007, checked); leaves the PowerShell skill-registry hook
    (S:1355-1361); asks for `yes` unless `-y`; never touches `~/.engram`, never deletes `~/.gentle-ai`, and never
    touches codegraph for Claude or Codex.
  - `stack install` registers context7 with no key (`bin/lib/stack-install.mjs:45`, `:53`; rows in
    `bin/lib/stack.mjs:321-333`), and engram for Codex (`bin/lib/stack.mjs:244`, `:252`).
  - Orca, read by a read-only reader in its unpacked CLI (`resources/app.asar.unpacked/out/cli`), nothing run: with
    Orca running, `orca agent hooks off` only sends `settings.update` to the app (`handlers/agent-hooks.js`,
    `setAgentHooksEnabled`); with it closed, it removes every hook whose command holds
    `agent-hooks/claude-hook(.cmd|.ps1|.sh)` (all 12 of his: `C:/Users/Oficina/.orca/agent-hooks/claude-hook.cmd ||
    echo {}`), keeps other tools' hooks, and cleans `codex-hook.*` entries, none of which `~/.codex` holds today. The
    app is an electron-builder NSIS per-user install: `Uninstall Orca.exe` (registered under HKCU's Uninstall key,
    `/currentuser`); whether it removes `~/.orca`, `%APPDATA%\orca`, `%LOCALAPPDATA%\orca-updater`, its registry
    keys, shortcuts and its user PATH entry (`...\Programs\orca\resources\bin`) is not established; no Orca process or
    autostart.
  - herdr 0.9.1: `herdr integration uninstall <claude|codex>` exists (its `--help`); what it removes is not established
    beyond strings in its binary (`herdr-agent-state.ps1`, "# installed by herdr"). A standalone install with no
    receipt and no uninstaller: `~/.herdr` (its release folder on his user PATH), `%APPDATA%\herdr`,
    `%LOCALAPPDATA%\herdr`; no process or autostart.
  - GGA: `~/bin/gga`, `gga.bat`, `gga.cmd`, `gga.ps1` and `~/bin/lib/`; no GGA hook in `D:\js-harness`
    (`core.hooksPath` is `.githooks`), `D:\plataforma-preproyecto` or `D:\abogadaclaudiajimenez`, so no `gga
    uninstall` is owed in a project. gentle-ai's project leftovers, `.atl/` and its review store under the git common
    folder, are what `bin/lib/project-migrate.mjs:238-254` lists.
  - `D:\js-harness\.claude\settings.local.json` selects no output style (read 2026-11-02).
  - the planted observation for the drill: engram id 6431, "F8 S2 restore drill marker 2026-11-02", token
    `s2drillmarker20261102`; `engram search s2drillmarker20261102 --project js-harness` finds it (run 20:17Z).
- 3. The bar:
  spec 1: `js-harness stack backup --help`: none, new behaviour (`stack` knows `install` only, `bin/stack.mjs:22-25`).
  spec 2: the drill: none; S13 proved engram's recovery on a scratch home, never a restore of his store.
  spec 3: hooks: 34 today; after: only js-harness's 15 and codegraph's 1, 16. The roadmap's "32 → 14", S4a's row
  ("fails above 14 entries", `docs/ROADMAP.md:601`) and row 8 count js-harness at 13 (2026-10-28); 16 goes to the
  lead as a correction (L6), not redefined here.
  spec 4: `permissions` after the removal: deep-equal to the backup's, key order aside (1 allow, 24 deny,
  `bypassPermissions`), and the machine manifest's record unchanged.
  spec 5: each complement's `mcpServers` entry in `~/.claude.json` deep-equal to the backup's (context7's key
  included), printed only as "equal" or "differs at <key path>"; `claude mcp list` shows the three connected.
  spec 6: engram: in the backup sitting, the backup's files hash as the live `~/.engram`; after the removal, with
  sessions running, observation 6431 answers and `engram stats` counts at least the backup's observations. The
  roadmap's "`~/.engram` hashes as before" cannot hold with sessions writing; this goes to the lead with spec 3 (L6).
  spec 7: incident set: L 13, worse below 10 (S0's baseline, `docs/ROADMAP.md`, S10 State).
  spec 8: `fixed load`: at most 80,000 over five sessions; today's figure read at T9.
- 4. Refutation: the cheapest test that could show the plan does not hold is whether gentle-ai's uninstall, read in
  the version installed, still takes what the diet says it takes, and whether js-harness puts it back. Run: the
  source of 4.3.1 read (item 2): it also takes `outputStyle`, `theme`, Codex's engram entry and Antigravity's config,
  which the diet did not list, and leaves Codex's context7 and four `CLAUDE.md` blocks; `stack install` would put
  context7 back without its key, and `install` would put back the denies but record them as its own. So the entries
  come back from the backup first and `install` then finds nothing to add. Nothing of js-harness writes a user-level
  `outputStyle`, by design (S10: `init` selects the style per project), so the style after the removal is his to
  choose. The plan holds with these corrections inside its own steps.
  Verdict: supports
- 5. Request: one full backup, from a plain terminal with every session closed, by `js-harness stack backup run`,
  which checks the quiesce first and stops at the first failure: `~/.claude`, `~/.claude.json`, `~/.codex`,
  `~/.gemini`, `~/.engram`, `~/.gentle-ai`, `~/go/bin/gentle-ai.exe`, `~/bin`, `~/.orca`, `%APPDATA%\orca`,
  `%LOCALAPPDATA%\Programs\orca`, `%LOCALAPPDATA%\orca-updater`, `~/.herdr`, `%APPDATA%\herdr`,
  `%LOCALAPPDATA%\herdr`, `~/.js-harness/manifest.json`, his user PATH value and the exports of Orca's registry keys
  and Start menu shortcuts; the drill, `stack backup verify`, on a scratch home with no credential or key in it. Then,
  with the lead and one S2 session running, each tool asked through the lead and run right after its yes: gentle-ai
  (`uninstall --all -y`; its own backup's target list checked inside the roots; `restore --only permissions` and the
  `engram` and `context7` entries; `install`; `stack install`; the leftover scan, each item named; the binary;
  `~/.gentle-ai`; GGA's files), `~/.claude.json` and `settings.json` read again before the next question; the
  projects' leftovers; the style; Orca (`orca agent hooks off` with Orca closed, then its uninstaller, then what it
  leaves, each named); herdr (`integration uninstall claude` and `codex`, then its folders and PATH entry); the
  exclusion reverted; every session restarted; `scripts/s2-verify.mjs`; the smoke walk; the incident set and `fixed
  load`. Before gentle-ai's removal the lead tells every session that gentle-ai's review steps no longer run (no Stop
  hook will offer one), and the `CLAUDE.md` lines that name them change through `js-harness rules change` before S2
  closes. The undo: `stack backup restore` (the drill proved it), `go install
  github.com/gentleman-programming/gentle-ai/v4/cmd/gentle-ai@v4.3.1`; Orca's and herdr's folders, PATH entries and
  registry keys put back from the backup, an undo not exercised, said in their questions.
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
- [x] T1 (kind: design) this document, its plan through the double review (Codex and a Claude reader) — S1-S9;
  inline; `bb6d22eb`, read `e432a072` (L5)
- [ ] T2 (kind: build) `bin/lib/stack-backup.mjs`: the roots; the quiesce checks; a strict walker (throws on an
  unreadable entry, keeps links with their targets, refuses other kinds); `run`'s copy into a `.partial` folder, its
  count against an independent count, its manifest, the registry and PATH exports; `verify`'s drill; `restore` with
  config roots as snapshots, data roots without deletion, engram only into an empty store, `--only`. Test first in
  scratch homes with planted fake credentials and a fake context7 key that no output may print, an unreadable folder,
  a junction, an interrupted copy, a transcript newer than the backup — S1, S4-S7, S9; inline
- [ ] T3 (kind: build) `stack backup` in `bin/stack.mjs`, its usage and help; the test that `collectFiles`
  over a home holding `~/js-harness-s2-backup/x/.credentials.json` lists none of it — S4; inline
- [ ] T4 (kind: build) `scripts/s2-verify.mjs`, step 8 read only (no `doctor`: it writes its cache; `doctor` runs
  apart and its cache write is named), the entries compared deeply with the backup's, engram by spec 6; test first on
  a fixture home whose engram grew, compared whole before and after the run — S2; inline
- [ ] T5 (kind: verify) Codex and the lenses on T2-T4, the independent verifier (high risk), PR — inline
- [ ] T6 (kind: verify) before the sitting, read only: each project's effective output style; the lead's yes to the
  plan of the sitting; the corrections of L6 to the lead — S3
- [ ] T7 (kind: verify) the sitting, with the lead: his yes to close every session; he runs `stack backup run` and
  `verify` from a plain terminal; the results into `## Log` — S1, S4-S7
- [ ] T8 (kind: verify) the removals, each tool asked through the lead and run after its yes, in the order of item 5;
  each operation and its check into `## Log` — S1, S3, S8
- [ ] T9 (kind: build) the exclusion reverted in `.claude/settings.json` and its sentence in `CLAUDE.md`; every session
  restarted with the lead; `s2-verify` on his machine; the smoke walk; the session checks; the incident set and
  `fixed load` — S1, S2
- [ ] T10 (kind: docs) the rule lines that name gentle-ai, through `js-harness rules change` on a `rule/` branch,
  before S2 closes: `CLAUDE.md:12` ("over gentle-ai's"), `:74-91` (its review steps), `AGENTS.md:6` and `:27`; his
  words quoted where a line is his
- [ ] T11 (kind: docs) S2's roadmap line, the session summary, the closed notice — inline

## Log
- L1 2026-11-02T20:04:19Z, his words (the lead's transcript `0f71b2c6`, line 55309): "Sí, abre el S2". The brief
  (`~/.js-harness/background/briefs/2026-11-02T20-04-49-764Z-f23ac024.md`): that yes opens the step only; each
  removal and each change to his configuration is asked first, one question at a time, through the lead.
- L2 2026-11-02 20:17Z: the drill's observation planted before any backup: engram id 6431, title "F8 S2 restore
  drill marker 2026-11-02", token `s2drillmarker20261102`, found by `engram search` in project js-harness.
- L3 2026-11-02: the machine read for the depth pass (item 2): 34 hooks, gentle-ai 4.3.1, and what its uninstall
  takes and leaves; nothing written outside the repository.
- L4 2026-11-02: the brief's separate docs items are PR 759 (`docs/jh134-seen`, `5262a672`): the `Seen:` line of his
  question 165 under `stretch-not-opened`, PP 1's idle hours under `session-never-woken`, and his answer to question
  163 in `odd/tasks/audit-pack.md`'s L19; the lead was told ready at 20:10:03Z.
- L5 2026-11-02, the plan's double review, read `e432a072` (`js-harness double-review read`): Claude 14 findings,
  1,081,493 tokens; Codex 8, 378,758 tokens. All 22 taken, 4 found by both (Claude 2, 4, 7, 11; Codex 5, 1, 8, 4),
  recorded with `double-review take`. Each was checked first: the memory backup mirrors `~/.js-harness`
  (`bin/lib/backup.mjs:105-115`), so the backup moved to `~/js-harness-s2-backup/`; `walk` drops links and unreadable
  folders (`:59-72`), so a strict walker; `stack install` adds context7 with no key (`bin/lib/stack-install.mjs:45`),
  so the entries come back from the backup; Antigravity is installed (`~/.gentle-ai/state.json`) and `~/.gemini`
  exists, so it is a root. Taken in an adjusted form: Codex 3 (one question per tool, each naming every operation
  and path its yes covers, rather than one question per command, since gentle-ai's uninstall leaves his `permissions`
  gone until the backup's are put back, and a stop between them would leave the machine without them); Codex 4 (the
  rule change before S2 closes and the lead's note before the removal, rather than the rule change before the
  removal: without gentle-ai's Stop hook nothing offers a gentle-ai review, and `CLAUDE.md:81` acts only on its
  envelope); Claude 9 (done in PR 759, L4, and only clarified here).
- L6 2026-11-02, two corrections for the lead, not redefined here: hooks after S2 are 16, not 14 (js-harness holds 15
  entries today; S4a's row and row 8 say 14); `~/.engram` cannot hash as before with sessions writing during the
  removal, so spec 6 checks it by hash in the sitting and by function after. Sent to the lead as a note, 20:29:36Z.
- L7 2026-11-02 ~20:35Z, state: T2-T3 and T4 handed to two writers in parallel (disjoint files; the manifest's shape
  fixed in both briefs: `schema js-harness.stack-backup/v1`, `roots`, `files` with `secret`, `links`, `exports`,
  `named.permissions`, `named.mcpClaude`, `engram.observations`); neither commits. Next: read their diffs and run their
  tests here, commit test-first pairs, Codex and the lenses (`--base 84997f7d`), the independent verifier, PR; then
  T6, the sitting's plan to the lead. A `js-harness wait --notice-to 134` runs in the background.
- L8 2026-11-02, T2-T4 built and committed, each gate green: `47c22307` (the strict walker), `1edd8539` (the backup,
  drill and undo), `c72c2bcd` (`stack backup` and the test that the memory backup never walks the S2 backup),
  `d4b3c62c` (`scripts/s2-verify.mjs`); 93 of 93 tests here before the commits. The first try of `1edd8539` failed
  the gate on `bin/lib/gentle-ai-absence.test.mjs`: the new files name gentle-ai and joined its named list, each with
  why. Writer deviations kept: `~/.codex` and `~/.gemini` split into config and data parts like `~/.claude`;
  `~/.gentle-ai`, `~/bin` and Orca's and herdr's folders are data roots (a restore never deletes there); single
  files written back when they differ, never deleted; `restore` without `--yes` prints its plan on any home. Row 11
  of `s2-verify` runs `claude mcp list`, which starts each MCP server briefly to check it: no config is written, but
  the run is not read-only in the strictest sense. Not tested here: the real `tasklist`, `reg` and `engram` calls (the
  tests inject them), a file symlink on Windows (needs a privilege), a full-size run over the 3.2 GB `~/.claude`.
  Next: Codex over `84997f7d..d4b3c62c` (6 parts, about 1.1M to 1.45M input tokens) and the lenses, the independent
  verifier, PR.
